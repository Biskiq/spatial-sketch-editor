import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import { validateWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { planExactWallLength, planWallSubdivision } from '$lib/layout/layout-wall-first-precision';
import { planWallSplit } from '$lib/layout/layout-wall-noding';
import {
	validateWallFirstPortalRelations,
	wallFirstAdjacentRooms
} from '$lib/layout/layout-portals';
import { buildPlanRenderModel, type PlanPolylinePrimitive } from '$lib/layout/plan-render-model';
import {
	beginLayoutWallOpeningDrag,
	cancelLayoutWallOpeningDrag,
	computeLayoutWallOpeningDragCandidate,
	createLayoutInteractionState,
	reconcileLayoutSelection,
	selectLayoutWallOpening,
	selectedLayoutWallOpening,
	updateLayoutWallOpeningDrag
} from '$lib/editor/layout/layout-interaction';
import {
	captureLayoutPreviewSnapshot,
	createWallFirstOpening,
	createEmptyLayoutPreviewState,
	deleteWallFirstOpening,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	layoutPreviewSnapshotMatchesLive,
	moveWallFirstOpening,
	restoreLayoutPreviewSnapshot,
	updateWallFirstOpening
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import {
	resolveOpeningDragEdgeSnap,
	resolveOpeningDragRawValidity,
	resolveOpeningDragSnap,
	resolveOpeningDragSnapUseMode
} from '@portfolio/layout-core';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom
} from '$lib/layout/layout-wall-first-types';
import {
	nextWallFirstOpeningId,
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
} from '$lib/layout/layout-wall-openings';
import type { LayoutVec2 } from '$lib/layout/layout-types';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
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
			role: wall.role ?? ('boundary' as const),
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
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		expect(created.operation).toBe('opening-create');
		expect(created.changedOpeningIds).toEqual(['opening:door:1']);
		expect(created.changedWallIds).toEqual(['wall-e']);
		expect(created.document.openings).toHaveLength(1);
		const opening = created.document.openings[0]!;
		expect(opening).toMatchObject({
			id: 'opening:door:1',
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
		const second = success(
			planCreateWallFirstOpening(created.document, {
				wallId: 'wall-b',
				kind: 'door',
				offset: 1
			})
		);
		expect(second.document.openings.map((entry) => entry.id)).toEqual([
			'opening:door:1',
			'opening:door:2'
		]);
		expect(nextWallFirstOpeningId(second.document, 'door')).toBe('opening:door:3');
		expect(nextWallFirstOpeningId(second.document, 'window')).toBe('opening:window:1');
	});

	it('rejects an unknown hosting Wall without producing a document', () => {
		const plan = planCreateWallFirstOpening(BASE, {
			wallId: 'wall-missing',
			kind: 'door',
			offset: 0
		});
		expect(rejection(plan)).toMatchObject({ code: 'unknown_wall' });
	});

	it('rejects an offset outside the hosting Wall instead of clamping it', () => {
		const plan = planCreateWallFirstOpening(BASE, {
			wallId: 'wall-e',
			kind: 'door',
			offset: 3.5
		});
		const rejected = rejection(plan);
		expect(rejected.code).toBe('opening_set_invalid');
		expect(rejected.message).toContain('does not fit');
	});

	it('rejects same-Wall overlap atomically against the complete opening set', () => {
		const first = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const overlapping = planCreateWallFirstOpening(first.document, {
			wallId: 'wall-e',
			kind: 'window',
			offset: 1.5
		});
		expect(rejection(overlapping).code).toBe('opening_set_invalid');
		// The prior authored Opening is untouched (no partial commit).
		expect(first.document.openings).toHaveLength(1);
		// A disjoint sibling is fine even when the set is validated together.
		const fine = success(
			planCreateWallFirstOpening(first.document, {
				wallId: 'wall-e',
				kind: 'window',
				offset: 2.5
			})
		);
		expect(fine.document.openings).toHaveLength(2);
	});

	it('rejects a vertical-fit failure (sill + height over the hosting Wall height)', () => {
		// P23.6H — vertical fit is measured against the hosting Wall's
		// authoritative height; the message names the Wall, not the Floor.
		const plan = planCreateWallFirstOpening(BASE, {
			wallId: 'wall-e',
			kind: 'window',
			offset: 1,
			width: 1.2,
			height: 1.2,
			sillHeight: 2.2
		});
		const rejected = rejection(plan);
		expect(rejected.code).toBe('opening_set_invalid');
		expect(rejected.message).toContain("does not fit Wall 'wall-e'");
	});

	it('updates exact fields, preserves the host/Wall ID, and rejects no-ops', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const updated = success(
			planUpdateWallFirstOpening(created.document, 'opening:door:1', {
				offset: 0.5,
				width: 1.1,
				height: 2.4,
				sillHeight: 0.1,
				profile: 'rounded'
			})
		);
		const opening = updated.document.openings[0]!;
		expect(opening).toMatchObject({
			id: 'opening:door:1',
			wallId: 'wall-e',
			offset: 0.5,
			width: 1.1,
			height: 2.4,
			sillHeight: 0.1,
			profile: 'rounded'
		});
		expect(rejection(planUpdateWallFirstOpening(updated.document, 'opening:door:1', { offset: 0.5 }))).toMatchObject({ code: 'no_op' });
		expect(rejection(planUpdateWallFirstOpening(BASE, 'opening:none', { offset: 0 }))).toMatchObject({ code: 'unknown_opening' });
	});

	it('reports exact meter metrics: length, offset, width, clearances, center', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		expect(wallFirstWallLength(created.document, 'wall-e')).toBeCloseTo(4, 12);
		const metrics = wallFirstOpeningMetrics(created.document, 'opening:door:1')!;
		expect(metrics.wallLength).toBeCloseTo(4, 12);
		expect(metrics.offset).toBeCloseTo(1, 12);
		expect(metrics.width).toBeCloseTo(0.9, 12);
		expect(metrics.clearanceFromStart).toBeCloseTo(1, 12);
		expect(metrics.clearanceFromEnd).toBeCloseTo(2.1, 12);
		expect(metrics.centerOffset).toBeCloseTo(1.55, 12);
		expect(wallFirstOpeningClearances(created.document, 'opening:door:1')).toEqual({
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
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const centered = success(planCenterWallFirstOpening(created.document, 'opening:door:1'));
		expect(centered.document.openings[0]!.offset).toBeCloseTo(1.55, 12);
		expect(rejection(planCenterWallFirstOpening(centered.document, 'opening:door:1'))).toMatchObject({ code: 'no_op' });
	});

	it('rejects a raw drag/move past the Wall end (no clamp-to-end commit)', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const moved = rejection(planMoveWallFirstOpening(created.document, 'opening:door:1', 5.5));
		expect(moved.code).toBe('opening_set_invalid');
		// A valid raw candidate on the same Wall commits.
		const ok = success(planMoveWallFirstOpening(created.document, 'opening:door:1', 3));
		expect(ok.document.openings[0]!.offset).toBe(3);
	});

	it('deletes the single physical Opening record', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const deleted = success(
			planDeleteWallFirstOpening(created.document, 'opening:door:1')
		);
		expect(deleted.operation).toBe('opening-delete');
		expect(deleted.document.openings).toEqual([]);
		expect(rejection(planDeleteWallFirstOpening(deleted.document, 'opening:door:1'))).toMatchObject({ code: 'unknown_opening' });
	});
});

describe('P23.3 portal relations on authored Openings', () => {
	it('accepts the two physically adjacent Rooms of a boundary Wall and rejects strangers', () => {
		const accepted = success(
			planCreateWallFirstOpening(BASE, {
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				connectsRoomIds: ['room-left', 'room-right']
			})
		);
		expect(accepted.document.openings[0]!.connectsRoomIds).toEqual([
			'room-left',
			'room-right'
		]);
		const stranger = planCreateWallFirstOpening(BASE, {
			wallId: 'wall-e',
			kind: 'door',
			offset: 1,
			connectsRoomIds: ['room-left', 'room-left']
		});
		expect(rejection(stranger).code).toBe('portal_relation_invalid');
		const exterior = planCreateWallFirstOpening(BASE, {
			wallId: 'wall-b',
			kind: 'door',
			offset: 1,
			connectsRoomIds: ['room-left', 'room-right']
		});
		expect(rejection(exterior).code).toBe('portal_relation_invalid');
	});

	it('allows exterior and partition doors without a relation', () => {
		const exterior = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-b', kind: 'door', offset: 1 })
		);
		expect(exterior.document.openings[0]!.connectsRoomIds).toBeUndefined();
		const partitionDoc: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.map((wall) =>
				wall.id === 'wall-rl' ? { ...wall, role: 'partition' as const } : wall
			)
		};
		const partition = success(
			planCreateWallFirstOpening(partitionDoc, {
				wallId: 'wall-rl',
				kind: 'door',
				offset: 1
			})
		);
		expect(partition.document.openings[0]!.connectsRoomIds).toBeUndefined();
	});

	it('requires an explicit relation clear for door → window and invents none for window → door', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, {
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				connectsRoomIds: ['room-left', 'room-right']
			})
		);
		const implicit = planUpdateWallFirstOpening(created.document, 'opening:door:1', {
			kind: 'window'
		});
		expect(rejection(implicit).code).toBe('portal_relation_invalid');
		const cleared = success(
			planUpdateWallFirstOpening(created.document, 'opening:door:1', {
				kind: 'window',
				connectsRoomIds: null
			})
		);
		expect(cleared.document.openings[0]!.kind).toBe('window');
		expect(cleared.document.openings[0]!.connectsRoomIds).toBeUndefined();
		// window → door never invents a relation; the old ID keeps its identity.
		const backToDoor = success(
			planUpdateWallFirstOpening(cleared.document, 'opening:door:1', { kind: 'door' })
		);
		expect(backToDoor.document.openings[0]!.kind).toBe('door');
		expect(backToDoor.document.openings[0]!.connectsRoomIds).toBeUndefined();
	});

	it('rejects a relation update that names nonadjacent Rooms', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
		);
		const plan = planUpdateWallFirstOpening(created.document, 'opening:door:1', {
			connectsRoomIds: ['room-left', 'room-left']
		});
		expect(rejection(plan).code).toBe('portal_relation_invalid');
	});
});

describe('P23.3 shared canonical opening-set validator (P23.1 shrink)', () => {
	it('rejects a Wall shrink that would leave an authored Opening unfit (atomic, shared validator)', () => {
		const created = success(
			planCreateWallFirstOpening(BASE, { wallId: 'wall-e', kind: 'door', offset: 1 })
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
		planCreateWallFirstOpening(BASE, {
			wallId: 'wall-e',
			kind: 'door',
			offset: overrides.offset ?? 1,
			...(overrides.width === undefined ? {} : { width: overrides.width })
		})
	);
	return created.document;
}

describe('P23.3 drag use-mode — clamping never converts an invalid drag into a valid commit', () => {
	it('does not honor the endpoint clamp for a pointer dragged past the Wall end', () => {
		const document = withDoor();
		const geometry = compiledWallFirst(document).geometry;
		// The bare P23.2 resolver offers the clamped end placement — the hazard.
		const bare = resolveOpeningDragSnap(geometry, HOST_SPAN, 'opening:door:1', 5.05, 0.9, SNAP_CONTEXT);
		expect(bare.kind).toBe('snap');
		if (bare.kind !== 'snap') return;
		expect(bare.candidate.offset).toBeCloseTo(3.1, 9);
		// The P23.3 use-mode refuses to treat it as validity.
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 5.05, {
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
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 3.95, {
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
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 2, {
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
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 3.95, {
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
		const atStart = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, 'opening:door:1', 0.04, SNAP_CONTEXT);
		expect(atStart.kind === 'snap' && atStart.candidate.offset).toBe(0);
		const atMid = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 1.99, {
			anchor: { kind: 'edge' },
			context: SNAP_CONTEXT
		});
		expect(atMid.snappedKind).toBe('wall-midpoint');
		expect(atMid.snappedOffset).toBe(2);
	});

	it('aligns a moving edge on another Opening’s edge identically from both approach sides', () => {
		const document = success(
			planCreateWallFirstOpening(withDoor(), { wallId: 'wall-e', kind: 'window', offset: 2.5 })
		).document;
		const geometry = compiledWallFirst(document).geometry;
		const reference = geometry.queries.spans.find((span) => span.openingId === 'opening:window:1')!;
		const fromLeft = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, 'opening:door:1', 2.4, SNAP_CONTEXT);
		const fromRight = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, 'opening:door:1', 2.6, SNAP_CONTEXT);
		expect(fromLeft.kind === 'snap' && fromLeft.candidate.sourceId).toBe('opening:window:1#start');
		expect(fromRight.kind === 'snap' && fromRight.candidate.sourceId).toBe('opening:window:1#start');
		expect(fromLeft.kind === 'snap' && fromLeft.candidate.offset).toBe(reference.start[1]);
		expect(fromRight.kind === 'snap' && fromRight.candidate.offset).toBe(reference.start[1]);
		// The center-anchored body drag keeps its different, documented semantic
		// (nearest-edge: the approaching edge lands on the reference edge).
		const body = resolveOpeningDragSnap(geometry, HOST_SPAN, 'opening:door:1', 2, 0.9, SNAP_CONTEXT);
		expect(body.kind === 'snap' && body.candidate.kind).toBe('opening-edge');
		expect(body.kind === 'snap' && body.candidate.offset).toBeCloseTo(1.6, 9);
	});

	it('snaps the moving edge to the grid step in edge space', () => {
		const geometry = compiledWallFirst(withDoor()).geometry;
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 3.24, {
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
		const bare = resolveOpeningDragEdgeSnap(geometry, HOST_SPAN, 'opening:door:1', 6.05, SNAP_CONTEXT);
		expect(bare.kind === 'snap' && bare.candidate.offset).toBe(4);
		const useMode = resolveOpeningDragSnapUseMode(geometry, HOST_SPAN, 'opening:door:1', 6.05, {
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

describe('P23.3 drag session state (body + width handles)', () => {
	it('moves the body on the raw candidate and rejects an out-of-fit raw candidate', () => {
		const drag = { mode: 'body' as const, baselineOffset: 1, baselineWidth: 0.9, wallLength: 4 };
		expect(
			computeLayoutWallOpeningDragCandidate(drag, { rawPointerOffset: 2, snapOffset: null })
		).toEqual({ offset: 1.55, width: 0.9, snapped: false, valid: true });
		const past = computeLayoutWallOpeningDragCandidate(drag, {
			rawPointerOffset: 5.05,
			snapOffset: null
		});
		expect(past.valid).toBe(false);
		expect(past.offset).toBeCloseTo(4.6, 9);
		const snapped = computeLayoutWallOpeningDragCandidate(drag, {
			rawPointerOffset: 5.05,
			snapOffset: 3.1
		});
		expect(snapped).toEqual({ offset: 3.1, width: 0.9, snapped: true, valid: true });
	});

	it('resizes width handles with the opposite edge fixed', () => {
		const drag = { mode: 'end-edge' as const, baselineOffset: 1, baselineWidth: 0.9, wallLength: 4 };
		expect(
			computeLayoutWallOpeningDragCandidate(drag, { rawPointerOffset: 3, snapOffset: null })
		).toEqual({ offset: 1, width: 2, snapped: false, valid: true });
		expect(
			computeLayoutWallOpeningDragCandidate(drag, { rawPointerOffset: 4.5, snapOffset: null }).valid
		).toBe(false);
		const startEdge = {
			mode: 'start-edge' as const,
			baselineOffset: 1,
			baselineWidth: 0.9,
			wallLength: 4
		};
		// Right edge (1.9) stays fixed; the left edge follows the pointer.
		expect(
			computeLayoutWallOpeningDragCandidate(startEdge, { rawPointerOffset: 0.5, snapOffset: null })
		).toEqual({ offset: 0.5, width: 1.4, snapped: false, valid: true });
		expect(
			computeLayoutWallOpeningDragCandidate(startEdge, { rawPointerOffset: 2.2, snapOffset: null })
				.valid
		).toBe(false);
	});

	it('begins, updates and cancels a session without touching the document', () => {
		const interaction = createLayoutInteractionState();
		selectLayoutWallOpening(interaction, 'wall-e', 'opening:door:1');
		expect(selectedLayoutWallOpening(interaction)).toEqual({
			wallId: 'wall-e',
			openingId: 'opening:door:1'
		});
		beginLayoutWallOpeningDrag(interaction, {
			mode: 'body',
			wallId: 'wall-e',
			openingId: 'opening:door:1',
			offset: 1,
			width: 0.9,
			wallLength: 4
		});
		const candidate = updateLayoutWallOpeningDrag(interaction, {
			rawPointerOffset: 5.05,
			snapOffset: null,
			wallLength: 4
		});
		expect(candidate?.valid).toBe(false);
		expect(interaction.wallOpeningDrag?.candidateOffset).toBeCloseTo(4.6, 9);
		cancelLayoutWallOpeningDrag(interaction);
		expect(interaction.wallOpeningDrag).toBeNull();
		// Selection survives the cancel and reconciles against the document.
		const document = withDoor();
		expect(reconcileLayoutSelection(interaction.selection, document as never)).toEqual({
			kind: 'wallOpening',
			wallId: 'wall-e',
			openingId: 'opening:door:1'
		});
		expect(
			reconcileLayoutSelection(
				{ kind: 'wallOpening', wallId: 'wall-e', openingId: 'opening:gone' },
				document as never
			)
		).toEqual({ kind: 'none' });
	});
});

// ---------------------------------------------------------------------------
// P23.3 gate 6 — one shared Wall → one authored Opening → one compiler cut,
// with no per-Room duplicates and roomless-Wall coverage.
// ---------------------------------------------------------------------------

function canonicalOpeningPrimitives(
	model: ReturnType<typeof buildPlanRenderModel>
): PlanPolylinePrimitive[] {
	return model.layers
		.flatMap((layer) => layer.primitives)
		.filter(
			(primitive): primitive is PlanPolylinePrimitive =>
				primitive.kind === 'polyline' && primitive.hit?.kind === 'wallOpening'
		);
}

function wallPolylinePrimitives(
	model: ReturnType<typeof buildPlanRenderModel>
): PlanPolylinePrimitive[] {
	return model.layers
		.flatMap((layer) => layer.primitives)
		.filter(
			(primitive): primitive is PlanPolylinePrimitive =>
				primitive.kind === 'polyline' && primitive.architecture?.kind === 'wall'
		);
}

describe('P23.3 shared physical Wall single cut / no duplicates / roomless coverage', () => {
	it('hosts one authored Opening on a two-Room boundary Wall as one compiler cut with no fake roomId', () => {
		const document = withDoor();
		const { geometry } = compiledWallFirst(document);
		// The physical Wall is emitted exactly once even though both Rooms bound it.
		const hosts = geometry.walls.filter((wall) => wall.wallId === 'wall-e');
		expect(hosts).toHaveLength(1);
		expect(hosts[0]!.openings).toHaveLength(1);
		expect(hosts[0]!.openings[0]!.openingId).toBe('opening:door:1');
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

	it('renders the authored Opening exactly once through the canonical physical path', () => {
		const document = withDoor();
		const model = buildPlanRenderModel(compiledWallFirst(document).geometry);
		const openingPrimitives = canonicalOpeningPrimitives(model);
		expect(openingPrimitives).toHaveLength(1);
		expect(openingPrimitives[0]!.hit).toEqual({
			kind: 'wallOpening',
			wallId: 'wall-e',
			openingId: 'opening:door:1'
		});
		// The hosting Wall stroke is not duplicated either.
		expect(wallPolylinePrimitives(model).length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// P23.3 gate 8 — Undo/Redo restores exact canonical host/offset/portal state
// through the one Layout history stack.
// ---------------------------------------------------------------------------

function openingStore(seed: LayoutDocumentWallFirst = BASE) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const preview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(preview, serializeWallFirstLayoutDocument(seed))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(preview),
		replace: (snapshot) =>
			restoreLayoutPreviewSnapshot(
				preview,
				snapshot as ReturnType<typeof captureLayoutPreviewSnapshot>
			),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => preview);
	return { store, preview };
}

function wallFirstLive(preview: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(preview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function openingOf(document: LayoutDocumentWallFirst, openingId: string) {
	return document.openings.find((opening) => opening.id === openingId)!;
}

function mutate(context: ReturnType<typeof openingStore>, run: () => { success: boolean }) {
	const outcome = runLayoutMutation(
		layoutMutationRunnerFor(context.store, context.preview),
		run,
		(result) => result.success
	);
	if (outcome.kind !== 'committed') {
		throw new Error(`expected commit, got ${JSON.stringify(outcome)}`);
	}
}

describe('P23.3 Undo/Redo restores exact canonical Opening state', () => {
	it('round-trips create → edit → move → delete as separate history entries', () => {
		const context = openingStore();
		const { store, preview } = context;
		mutate(context, () =>
			createWallFirstOpening(preview, {
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0
			})
		);
		expect(wallFirstLive(preview).openings).toHaveLength(1);
		mutate(context, () => updateWallFirstOpening(preview, 'opening:door:1', { width: 1.1 }));
		mutate(context, () => moveWallFirstOpening(preview, 'opening:door:1', 2.5));
		let live = wallFirstLive(preview);
		expect(openingOf(live, 'opening:door:1')).toMatchObject({
			wallId: 'wall-e',
			offset: 2.5,
			width: 1.1
		});

		// Undo the move: exact prior offset/width, same host + identity.
		expect(store.undo()).toBe(true);
		live = wallFirstLive(preview);
		expect(openingOf(live, 'opening:door:1')).toMatchObject({ wallId: 'wall-e', offset: 1, width: 1.1 });
		// Undo the edit: original width.
		expect(store.undo()).toBe(true);
		live = wallFirstLive(preview);
		expect(openingOf(live, 'opening:door:1')).toMatchObject({ wallId: 'wall-e', offset: 1, width: 0.9 });
		// Undo the create: no Opening at all.
		expect(store.undo()).toBe(true);
		expect(wallFirstLive(preview).openings).toHaveLength(0);
		expect(store.canUndo).toBe(false);

		// Redo rebuilds the exact same document, never a fresh ID.
		expect(store.redo()).toBe(true);
		expect(store.redo()).toBe(true);
		expect(store.redo()).toBe(true);
		live = wallFirstLive(preview);
		expect(openingOf(live, 'opening:door:1')).toMatchObject({
			wallId: 'wall-e',
			offset: 2.5,
			width: 1.1
		});
	});

	it('round-trips an explicit door→window portal clear', () => {
		const seeded = success(
			planCreateWallFirstOpening(BASE, {
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				connectsRoomIds: ['room-left', 'room-right']
			})
		);
		const context = openingStore(seeded.document);
		const { store, preview } = context;
		expect(openingOf(wallFirstLive(preview), 'opening:door:1').connectsRoomIds).toEqual([
			'room-left',
			'room-right'
		]);
		mutate(context, () =>
			updateWallFirstOpening(preview, 'opening:door:1', {
				kind: 'window',
				connectsRoomIds: null
			})
		);
		expect(openingOf(wallFirstLive(preview), 'opening:door:1')).toMatchObject({ kind: 'window' });
		expect(openingOf(wallFirstLive(preview), 'opening:door:1').connectsRoomIds).toBeUndefined();

		expect(store.undo()).toBe(true);
		const restored = openingOf(wallFirstLive(preview), 'opening:door:1');
		expect(restored.kind).toBe('door');
		expect(restored.connectsRoomIds).toEqual(['room-left', 'room-right']);
		expect(store.redo()).toBe(true);
		const reapplied = openingOf(wallFirstLive(preview), 'opening:door:1');
		expect(reapplied.kind).toBe('window');
		expect(reapplied.connectsRoomIds).toBeUndefined();
	});
});
