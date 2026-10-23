import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces } from '@portfolio/layout-core';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import { planExactWallLength, planWallSubdivision } from '@portfolio/layout-core';
import { planWallSplit } from '@portfolio/layout-core';
import {
	validateWallFirstPortalRelations,
	wallFirstAdjacentRooms
} from '@portfolio/layout-core';
import {
	resolveOpeningDragEdgeSnap,
	resolveOpeningDragRawValidity,
	resolveOpeningDragSnap,
	resolveOpeningDragSnapUseMode
} from '@portfolio/layout-core';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom
} from '@portfolio/layout-core';
import {
	planCenterWallFirstOpening,
	planCreateWallFirstOpening,
	planDeleteWallFirstOpening,
	planMoveWallFirstOpening,
	planUpdateWallFirstOpening,
	validateWallFirstOpeningSet,
	wallFirstOffsetFromEndDistance,
	wallFirstOffsetFromStartDistance,
	wallFirstOpeningClearances,
	wallFirstOpeningMetrics,
	wallFirstWallLength
} from '@portfolio/layout-core';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { captureFor, capturedId, freshCapture } from './__fixtures__/layout-id-capture';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	};

/**
 * Two-room wall-first fixture: a 6×4 enclosure split at x=3 by the shared
 * boundary Wall `wall-e` (bounds BOTH rooms — one physical Wall), plus a
 * disconnected roomless Wall `wall-rl`. Rooms come from real face extraction
 * so boundaries are genuine reconciled cycles.
 */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const junctions: Array<[string, number, number]> = [
		['j-a', 0, 0],
		['j-m', 3, 0],
		['j-b', 6, 0],
		['j-c', 6, 4],
		['j-n', 3, 4],
		['j-d', 0, 4],
		['j-x', 10, 0],
		['j-y', 10, 4]
	];
	const walls: WallSeed[] = [
		{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
		{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
		{ id: 'wall-b', start: 'j-b', end: 'j-c' },
		{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
		{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
		{ id: 'wall-d', start: 'j-d', end: 'j-a' },
		{ id: 'wall-e', start: 'j-m', end: 'j-n' },
		{ id: 'wall-rl', start: 'j-x', end: 'j-y' }
	];
	const shell = {
		units: 'meters' as const,
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		})),
		openings: [],
		objects: []
	};
	const extraction = extractBoundaryCandidateFaces({ ...shell, rooms: [] });
	const leftFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const rightFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	const room = (
		id: string,
		name: string,
		boundary: typeof leftFace.boundary
	): LayoutWallFirstRoom => ({
		id,
		name,
		boundary: boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return {
		...shell,
		rooms: [
			room('room-left', 'Left', leftFace.boundary),
			room('room-right', 'Right', rightFace.boundary)
		]
	};
}

const BASE = twoRoomDocument();

/**
 * T1.P02.S01 §1 — a captured identity, not allocation order. These tests mint
 * one nonce per operation; `DOOR_ID` is the id `DOOR_CAPTURE` derives on
 * `wall-e`, and every lookup/assertion names that captured identity.
 */
const DOOR_CAPTURE = captureFor('opening-door-01');
const DOOR_ID = capturedId(DOOR_CAPTURE, 'opening:door:wall-e');

function success(plan: ReturnType<typeof planCreateWallFirstOpening>) {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

function rejection(plan: {
	kind: 'success';
} | {
	kind: 'rejected';
	rejection: { code: string; message: string };
}) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

describe('P23.3 canonical Opening domain operations', () => {
	it('validates the fixture document and its (empty) opening set', () => {
		expect(validateWallFirstLayoutDocument(BASE).success).toBe(true);
		expect(validateWallFirstOpeningSet(BASE)).toEqual([]);
	});

	it('creates one authored Opening on a canonical Wall with document-global identity + defaults', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		expect(created.operation).toBe('opening-create');
		expect(created.changedOpeningIds).toEqual([DOOR_ID]);
		expect(created.changedWallIds).toEqual(['wall-e']);
		expect(created.document.openings).toHaveLength(1);
		const opening = created.document.openings[0]!;
		expect(opening).toMatchObject({
			id: DOOR_ID,
			wallId: 'wall-e',
			kind: 'door',
			offset: 1,
			width: 0.9,
			height: 2.1,
			sillHeight: 0,
			profile: 'rectangular'
		});
		// Identity is document-global, not Room- or Wall-scoped.
		expect(opening.connectsRoomIds).toBeUndefined();
		const secondCapture = freshCapture();
		const second = success(
			planCreateWallFirstOpening(
				created.document,
				{
					wallId: 'wall-b',
					kind: 'door',
					offset: 1
				},
				secondCapture,
				created.document.floor.id
			)
		);
		const secondId = capturedId(secondCapture, 'opening:door:wall-b');
		expect(second.document.openings.map((entry) => entry.id)).toEqual([DOOR_ID, secondId]);
		// Identity is captured per operation, not allocated from document occupancy:
		// a fresh nonce derives an id no existing Opening carries.
		const fresh = freshCapture();
		expect(
			second.document.openings.some(
				(entry) => entry.id === capturedId(fresh, 'opening:door:wall-e')
			)
		).toBe(false);
	});

	it('rejects an unknown hosting Wall without producing a document', () => {
		const plan = planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-missing',
				kind: 'door',
				offset: 0
			},
			freshCapture(),
			BASE.floor.id
		);
		expect(rejection(plan)).toMatchObject({ code: 'unknown_wall' });
	});

	it('rejects an offset outside the hosting Wall instead of clamping it', () => {
		const plan = planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-e',
				kind: 'door',
				offset: 3.5
			},
			freshCapture(),
			BASE.floor.id
		);
		const rejected = rejection(plan);
		expect(rejected.code).toBe('opening_set_invalid');
		expect(rejected.message).toContain('does not fit');
	});

	it('rejects same-Wall overlap atomically against the complete opening set', () => {
		const first = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const overlapping = planCreateWallFirstOpening(
			first.document,
			{
				wallId: 'wall-e',
				kind: 'window',
				offset: 1.5
			},
			freshCapture(),
			first.document.floor.id
		);
		expect(rejection(overlapping).code).toBe('opening_set_invalid');
		// The prior authored Opening is untouched (no partial commit).
		expect(first.document.openings).toHaveLength(1);
		// A disjoint sibling is fine even when the set is validated together.
		const fine = success(
			planCreateWallFirstOpening(
				first.document,
				{
					wallId: 'wall-e',
					kind: 'window',
					offset: 2.5
				},
				freshCapture(),
				first.document.floor.id
			)
		);
		expect(fine.document.openings).toHaveLength(2);
	});

	it('rejects a vertical-fit failure (sill + height over the hosting Wall height)', () => {
		// P23.6H — vertical fit is measured against the hosting Wall's
		// authoritative height; the message names the Wall, not the Floor.
		const plan = planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-e',
				kind: 'window',
				offset: 1,
				width: 1.2,
				height: 1.2,
				sillHeight: 2.2
			},
			freshCapture(),
			BASE.floor.id
		);
		const rejected = rejection(plan);
		expect(rejected.code).toBe('opening_set_invalid');
		expect(rejected.message).toContain("does not fit Wall 'wall-e'");
	});

	it('updates exact fields, preserves the host/Wall ID, and rejects no-ops', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const updated = success(
			planUpdateWallFirstOpening(created.document, DOOR_ID, {
				offset: 0.5,
				width: 1.1,
				height: 2.4,
				sillHeight: 0.1,
				profile: 'rounded'
			})
		);
		const opening = updated.document.openings[0]!;
		expect(opening).toMatchObject({
			id: DOOR_ID,
			wallId: 'wall-e',
			offset: 0.5,
			width: 1.1,
			height: 2.4,
			sillHeight: 0.1,
			profile: 'rounded'
		});
		expect(rejection(planUpdateWallFirstOpening(updated.document, DOOR_ID, { offset: 0.5 }))).toMatchObject({ code: 'no_op' });
		expect(rejection(planUpdateWallFirstOpening(BASE, 'opening:none', { offset: 0 }))).toMatchObject({ code: 'unknown_opening' });
	});

	it('reports exact meter metrics: length, offset, width, clearances, center', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		expect(wallFirstWallLength(created.document, 'wall-e')).toBeCloseTo(4, 12);
		const metrics = wallFirstOpeningMetrics(created.document, DOOR_ID)!;
		expect(metrics.wallLength).toBeCloseTo(4, 12);
		expect(metrics.offset).toBeCloseTo(1, 12);
		expect(metrics.width).toBeCloseTo(0.9, 12);
		expect(metrics.clearanceFromStart).toBeCloseTo(1, 12);
		expect(metrics.clearanceFromEnd).toBeCloseTo(2.1, 12);
		expect(metrics.centerOffset).toBeCloseTo(1.55, 12);
		expect(wallFirstOpeningClearances(created.document, DOOR_ID)).toEqual({
			fromStart: 1,
			fromEnd: 4 - (1 + 0.9)
		});
		// Distance helpers resolve back to the canonical meter offset.
		expect(wallFirstOffsetFromStartDistance(1.5)).toBe(1.5);
		expect(
			wallFirstOffsetFromEndDistance({ wallLength: 4, width: 0.9 }, 1.25)
		).toBeCloseTo(1.85, 12);
	});

	it('centers an Opening on its Wall with an exact meter offset', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const centered = success(planCenterWallFirstOpening(created.document, DOOR_ID));
		expect(centered.document.openings[0]!.offset).toBeCloseTo(1.55, 12);
		expect(rejection(planCenterWallFirstOpening(centered.document, DOOR_ID))).toMatchObject({ code: 'no_op' });
	});

	it('rejects a raw drag/move past the Wall end (no clamp-to-end commit)', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const moved = rejection(planMoveWallFirstOpening(created.document, DOOR_ID, 5.5));
		expect(moved.code).toBe('opening_set_invalid');
		// A valid raw candidate on the same Wall commits.
		const ok = success(planMoveWallFirstOpening(created.document, DOOR_ID, 3));
		expect(ok.document.openings[0]!.offset).toBe(3);
	});

	it('deletes the single physical Opening record', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const deleted = success(
			planDeleteWallFirstOpening(created.document, DOOR_ID)
		);
		expect(deleted.operation).toBe('opening-delete');
		expect(deleted.document.openings).toEqual([]);
		expect(rejection(planDeleteWallFirstOpening(deleted.document, DOOR_ID))).toMatchObject({ code: 'unknown_opening' });
	});
});

describe('P23.3 portal relations on authored Openings', () => {
	it('accepts the two physically adjacent Rooms of a boundary Wall and rejects strangers', () => {
		const accepted = success(
			planCreateWallFirstOpening(
				BASE,
				{
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					connectsRoomIds: ['room-left', 'room-right']
				},
				freshCapture(),
				BASE.floor.id
			)
		);
		expect(accepted.document.openings[0]!.connectsRoomIds).toEqual([
			'room-left',
			'room-right'
		]);
		const stranger = planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				connectsRoomIds: ['room-left', 'room-left']
			},
			freshCapture(),
			BASE.floor.id
		);
		expect(rejection(stranger).code).toBe('portal_relation_invalid');
		const exterior = planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-b',
				kind: 'door',
				offset: 1,
				connectsRoomIds: ['room-left', 'room-right']
			},
			freshCapture(),
			BASE.floor.id
		);
		expect(rejection(exterior).code).toBe('portal_relation_invalid');
	});

	it('allows exterior and partition doors without a relation', () => {
		const exterior = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-b', kind: 'door', offset: 1 },
				freshCapture(),
				BASE.floor.id
			)
		);
		expect(exterior.document.openings[0]!.connectsRoomIds).toBeUndefined();
		const partitionDoc: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.map((wall) =>
				wall.id === 'wall-rl' ? { ...wall } : wall
			)
		};
		const partition = success(
			planCreateWallFirstOpening(
				partitionDoc,
				{
					wallId: 'wall-rl',
					kind: 'door',
					offset: 1
				},
				freshCapture(),
				partitionDoc.floor.id
			)
		);
		expect(partition.document.openings[0]!.connectsRoomIds).toBeUndefined();
	});

	it('requires an explicit relation clear for door → window and invents none for window → door', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					connectsRoomIds: ['room-left', 'room-right']
				},
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const implicit = planUpdateWallFirstOpening(created.document, DOOR_ID, {
			kind: 'window'
		});
		expect(rejection(implicit).code).toBe('portal_relation_invalid');
		const cleared = success(
			planUpdateWallFirstOpening(created.document, DOOR_ID, {
				kind: 'window',
				connectsRoomIds: null
			})
		);
		expect(cleared.document.openings[0]!.kind).toBe('window');
		expect(cleared.document.openings[0]!.connectsRoomIds).toBeUndefined();
		// window → door never invents a relation; the old ID keeps its identity.
		const backToDoor = success(
			planUpdateWallFirstOpening(cleared.document, DOOR_ID, { kind: 'door' })
		);
		expect(backToDoor.document.openings[0]!.kind).toBe('door');
		expect(backToDoor.document.openings[0]!.connectsRoomIds).toBeUndefined();
	});

	it('rejects a relation update that names nonadjacent Rooms', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		const plan = planUpdateWallFirstOpening(created.document, DOOR_ID, {
			connectsRoomIds: ['room-left', 'room-left']
		});
		expect(rejection(plan).code).toBe('portal_relation_invalid');
	});
});

describe('P23.3 shared canonical opening-set validator (P23.1 shrink)', () => {
	it('rejects a Wall shrink that would leave an authored Opening unfit (atomic, shared validator)', () => {
		const created = success(
			planCreateWallFirstOpening(
				BASE,
				{ wallId: 'wall-e', kind: 'door', offset: 1 },
				DOOR_CAPTURE,
				BASE.floor.id
			)
		);
		// wall-e is 4 m; shrinking to 1.5 m would leave offset 1 + width 0.9
		// outside the new length → the shared Opening-set contract must reject.
		const shrunk = planExactWallLength(created.document, 'wall-e', 1.5);
		expect(shrunk).toMatchObject({ kind: 'rejected', rejection: { code: 'opening_set_invalid' } });
		// A shrink that still fits keeps the same authored Opening.
		const ok = planExactWallLength(created.document, 'wall-e', 3);
		if (ok.kind !== 'success') throw new Error('expected successful shrink');
		expect(ok.document.openings).toHaveLength(1);
		expect(ok.document.openings[0]!.offset).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// P23.3 gate 5 — raw drag validity is separate from snapping.
// ---------------------------------------------------------------------------

/** 4 m host Wall along +Z (canonical start at the wall start), as `wall-e`. */
const HOST_SPAN = { segmentId: 'wall-e', start: [3, 0] as LayoutVec2, end: [3, 4] as LayoutVec2 };
const SNAP_CONTEXT = { pixelsPerMeter: 50, snapRadiusCssPx: 8, gridStep: 0.25 };

function compiledWallFirst(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometry(document);
	return result;
}

function withDoor(overrides: Partial<{ offset: number; width: number }> = {}) {
	const created = success(
		planCreateWallFirstOpening(
			BASE,
			{
				wallId: 'wall-e',
				kind: 'door',
				offset: overrides.offset ?? 1,
				...(overrides.width === undefined ? {} : { width: overrides.width })
			},
			DOOR_CAPTURE,
			BASE.floor.id
		)
	);
	return created.document;
}

describe('P23.3 drag use-mode — clamping never converts an invalid drag into a valid commit', () => {
	it('does not honor the endpoint clamp for a pointer dragged past the Wall end', () => {
		const document = withDoor();
		const geometry = compiledWallFirst(document).geometry;
		// The bare P23.2 resolver offers the clamped end placement — the hazard.
		const bare = resolveOpeningDragSnap(geometry, HOST_SPAN, DOOR_ID, 5.05, 0.9, SNAP_CONTEXT);
		expect(bare.kind).toBe('snap');
		if (bare.kind !== 'snap') return;
		expect(bare.candidate.offset).toBeCloseTo(3.1, 9);
		// The P23.3 use-mode refuses to treat it as validity.
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 5.05, {
			anchor: { kind: 'center' as const, width: 0.9 },
			context: SNAP_CONTEXT
		});
		expect(useMode.snappedOffset).toBeNull();
		expect(useMode.rawOffset).toBeCloseTo(4.6, 9);
		expect(useMode.rawValid).toBe(false);
		expect(useMode.candidateValid).toBe(false);
	});

	it('honors a genuine endpoint-clearance snap win (pointer within acquisition of the Wall end)', () => {
		const document = withDoor();
		const geometry = compiledWallFirst(document).geometry;
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 3.95, {
			anchor: { kind: 'center' as const, width: 0.9 },
			context: SNAP_CONTEXT
		});
		expect(useMode.rawValid).toBe(false);
		expect(useMode.snappedKind).toBe('junction');
		expect(useMode.snappedOffset).toBeCloseTo(3.1, 9);
		expect(useMode.candidateValid).toBe(true);
	});

	it('honors an in-range interior snap win', () => {
		const document = withDoor();
		const geometry = compiledWallFirst(document).geometry;
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 2, {
			anchor: { kind: 'center' as const, width: 0.9 },
			context: SNAP_CONTEXT
		});
		expect(useMode.snappedKind).toBe('wall-midpoint');
		expect(useMode.snappedOffset).toBeCloseTo(1.55, 9);
		expect(useMode.rawValid).toBe(true);
		expect(useMode.candidateValid).toBe(true);
	});

	it('resolves width-handle drags in true edge space — flush at the Wall end, exactly', () => {
		const document = withDoor();
		const geometry = compiledWallFirst(document).geometry;
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 3.95, {
			anchor: { kind: 'edge' },
			context: SNAP_CONTEXT
		});
		expect(useMode.snappedKind).toBe('junction');
		// Exact (`toBe`), not “close to”: a surrogate-width edge resolver stopped
		// 1 mm short of the Wall end and 0.5 mm short of every other target, with
		// results that depended on the approach side.
		expect(useMode.snappedOffset).toBe(4);
		expect(useMode.candidateValid).toBe(true);
	});

	it('lands the moving edge exactly on the Wall start and the Wall midpoint', () => {
		const geometry = compiledWallFirst(withDoor()).geometry;
		const atStart = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, DOOR_ID, 0.04, SNAP_CONTEXT);
		expect(atStart.kind === 'snap' && atStart.candidate.offset).toBe(0);
		const atMid = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 1.99, {
			anchor: { kind: 'edge' },
			context: SNAP_CONTEXT
		});
		expect(atMid.snappedKind).toBe('wall-midpoint');
		expect(atMid.snappedOffset).toBe(2);
	});

	it('aligns a moving edge on another Opening’s edge identically from both approach sides', () => {
		const windowCapture = freshCapture();
		const windowId = capturedId(windowCapture, 'opening:window:wall-e');
		const document = success(
			planCreateWallFirstOpening(
				withDoor(),
				{ wallId: 'wall-e', kind: 'window', offset: 2.5 },
				windowCapture,
				withDoor().floor.id
			)
		).document;
		const geometry = compiledWallFirst(document).geometry;
		const reference = geometry.queries.spans.find((span) => span.openingId === windowId)!;
		const fromLeft = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, DOOR_ID, 2.4, SNAP_CONTEXT);
		const fromRight = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, DOOR_ID, 2.6, SNAP_CONTEXT);
		expect(fromLeft.kind === 'snap' && fromLeft.candidate.sourceId).toBe(`${windowId}#start`);
		expect(fromRight.kind === 'snap' && fromRight.candidate.sourceId).toBe(`${windowId}#start`);
		expect(fromLeft.kind === 'snap' && fromLeft.candidate.offset).toBe(reference.start[1]);
		expect(fromRight.kind === 'snap' && fromRight.candidate.offset).toBe(reference.start[1]);
		// The center-anchored body drag keeps its different, documented semantic
		// (nearest-edge: the approaching edge lands on the reference edge).
		const body = resolveOpeningDragSnap(geometry, HOST_SPAN, DOOR_ID, 2, 0.9, SNAP_CONTEXT);
		expect(body.kind === 'snap' && body.candidate.kind).toBe('opening-edge');
		expect(body.kind === 'snap' && body.candidate.offset).toBeCloseTo(1.6, 9);
	});

	it('snaps the moving edge to the grid step in edge space', () => {
		const geometry = compiledWallFirst(withDoor()).geometry;
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 3.24, {
			anchor: { kind: 'edge' },
			context: SNAP_CONTEXT
		});
		expect(useMode.snappedKind).toBe('grid');
		expect(useMode.snappedOffset).toBe(3.25);
		expect(useMode.rawValid).toBe(true);
	});

	it('does not honor an edge clamp that only reaches the Wall end by clamping', () => {
		const geometry = compiledWallFirst(withDoor()).geometry;
		// The bare resolver still offers the clamped end placement — the hazard.
		const bare = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, DOOR_ID, 6.05, SNAP_CONTEXT);
		expect(bare.kind === 'snap' && bare.candidate.offset).toBe(4);
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, DOOR_ID, 6.05, {
			anchor: { kind: 'edge' },
			context: SNAP_CONTEXT
		});
		expect(useMode.snappedOffset).toBeNull();
		expect(useMode.rawOffset).toBe(6.05);
		expect(useMode.rawValid).toBe(false);
		expect(useMode.candidateValid).toBe(false);
	});

	it('projects a clamped candidate honestly through the pure validity projection', () => {
		const clamped = {
			kind: 'snap' as const,
			candidate: { offset: 3.1, kind: 'grid' as const, sourceId: 'grid', distance: 0.05 }
		};
		const far = resolveOpeningDragRawValidity(clamped, {
			hostSpan: { start: [0, 0], end: [0, 4] },
			pointerOffset: 5.05,
			anchor: { kind: 'center' as const, width: 0.9 },
			context: SNAP_CONTEXT
		});
		expect(far.snappedOffset).toBeNull();
		expect(far.rawValid).toBe(false);
		expect(far.candidateValid).toBe(false);
		const endpointClearance = {
			kind: 'snap' as const,
			candidate: { offset: 3.1, kind: 'junction' as const, sourceId: 'wall-e#end', distance: 0.05 }
		};
		const near = resolveOpeningDragRawValidity(endpointClearance, {
			hostSpan: { start: [0, 0], end: [0, 4] },
			pointerOffset: 3.95,
			anchor: { kind: 'center' as const, width: 0.9 },
			context: SNAP_CONTEXT
		});
		expect(near.snappedOffset).toBeCloseTo(3.1, 9);
		expect(near.candidateValid).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// P23.3 gate 6 — one shared Wall → one authored Opening → one compiler cut,
// with no per-Room duplicates and roomless-Wall coverage.
//
// The `buildPlanRenderModel` half of this gate (one Opening *primitive*, one
// Wall stroke) went with the old Plan presentation model, which §5.1 removes.
// The compiler claims below are unchanged.
// ---------------------------------------------------------------------------

describe('P23.3 shared physical Wall single cut / no duplicates / roomless coverage', () => {
	it('hosts one authored Opening on a two-Room boundary Wall as one compiler cut with no fake roomId', () => {
		const document = withDoor();
		const { geometry } = compiledWallFirst(document);
		// The physical Wall is emitted exactly once even though both Rooms bound it.
		const hosts = geometry.walls.filter((wall) => wall.wallId === 'wall-e');
		expect(hosts).toHaveLength(1);
		expect(hosts[0]!.openings).toHaveLength(1);
		expect(hosts[0]!.openings[0]!.openingId).toBe(DOOR_ID);
		// No per-Room duplicate: Room detail stays identity + floor semantics only.
		expect(geometry.rooms).toHaveLength(2);
		for (const room of geometry.rooms) {
			expect(room.walls).toEqual([]);
			expect(room.openings).toEqual([]);
		}
		// Query spans carry the document-global wallKey and never a fake roomId.
		const openingSpans = geometry.queries.spans.filter((span) => span.kind === 'opening');
		expect(openingSpans).toHaveLength(1);
		expect(openingSpans[0]!.wallKey).toBe('wall-e');
		expect(openingSpans[0]!.segmentId).toBe('wall-e');
		expect(openingSpans[0]!.roomId).toBeUndefined();
		// A roomless Wall still compiles/renders (never dropped for lacking a Room).
		expect(geometry.walls.filter((wall) => wall.wallId === 'wall-rl')).toHaveLength(1);
	});
});
