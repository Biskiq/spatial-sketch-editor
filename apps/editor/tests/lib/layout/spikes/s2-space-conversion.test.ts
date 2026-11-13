/**
 * S2 — Space conversion spike fixtures.
 *
 * The suite distinguishes **production verdicts** (real layout-core exported
 * APIs) from **simulations** (the harness policy in
 * `./s2-space-conversion.ts`). Nothing here is production acceptance, an
 * editor transaction or an F4 result: the point is to find the smallest
 * production change that would make an opened Room keep its identity.
 *
 * Approved requirement (docs/roadmap/t1-spatial-world/next-batch):
 * an exterior-Wall erase keeps the Room's id, name, thicknesses, associated
 * content and intended boundary through a virtual edge; redrawing the Wall
 * returns the same Room; a shared-Wall erase still merges; the last Wall
 * retires an unsupported Space; Undo/Redo and reconciliation stay
 * deterministic.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	ensureLayoutWorldIndex,
	extractBoundaryCandidateFaces,
	faceArea,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planDeleteWall,
	planWallChain,
	roomBoundaryPolygon,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom,
	type LayoutVec2
} from '@portfolio/layout-core';
import { AuthoringHistory, type HistoryState } from '$lib/authoring/f4/history';

import { captureFor, freshCapture } from '../__fixtures__/layout-id-capture';
import {
	applyOpenRoomPolicy,
	boundaryIsClosed,
	composedBoundaryArea,
	composeExplicitBoundary,
	composeSpaceBoundary,
	deriveVirtualEdges,
	moveVirtualEdgePerpendicular,
	probeExplicitVirtualEdges,
	productionVerdicts,
	redrawVirtualEdge,
	removeWallFromOpenSpace,
	slideVirtualEdgeEnd,
	type DerivedVirtualEdge
} from './s2-space-conversion';

type WallSeed = {
	readonly id: string;
	readonly start: string;
	readonly end: string;
};

const RECT_JUNCTIONS: ReadonlyArray<readonly [string, number, number]> = [
	['j-a', 0, 0],
	['j-b', 6, 0],
	['j-c', 6, 4],
	['j-d', 0, 4]
];

const RECT_WALLS: readonly WallSeed[] = [
	{ id: 'wall-a', start: 'j-a', end: 'j-b' },
	{ id: 'wall-b', start: 'j-b', end: 'j-c' },
	{ id: 'wall-c', start: 'j-c', end: 'j-d' },
	{ id: 'wall-d', start: 'j-d', end: 'j-a' }
];

function shell(
	junctions: ReadonlyArray<readonly [string, number, number]>,
	walls: readonly WallSeed[]
): Omit<LayoutDocumentWallFirst, 'rooms'> {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const
		})),
		openings: [],
		objects: []
	};
}

function roomFromFace(
	id: string,
	name: string,
	faceBoundary: ReadonlyArray<{ wallId: string; direction: 'forward' | 'reverse' }>
): LayoutWallFirstRoom {
	return {
		id,
		name,
		boundary: faceBoundary.map((ref) => ({ ...ref })),
		floorThickness: 0.15,
		ceilingThickness: 0.12
	};
}

/** One rectangular Room with a surviving Opening and an associated object. */
function galleryDocument(): LayoutDocumentWallFirst {
	const base = shell(RECT_JUNCTIONS, RECT_WALLS);
	const extraction = extractBoundaryCandidateFaces({ ...base, rooms: [] });
	expect(extraction.faces).toHaveLength(1);
	const face = extraction.faces[0]!;
	return {
		...base,
		rooms: [roomFromFace('room-gallery', 'Gallery', face.boundary)],
		openings: [
			{
				id: 'window-gallery',
				wallId: 'wall-a',
				kind: 'window',
				offset: 1.2,
				width: 1,
				height: 1.2,
				sillHeight: 1,
				profile: 'rectangular'
			}
		],
		objects: [
			{
				id: 'obj-bench',
				kind: 'box',
				position: [2, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-gallery'
			}
		]
	};
}

/** Two 3×4 Rooms sharing `wall-e`, each with one associated object. */
function twoRoomDocument(): LayoutDocumentWallFirst {
	const base = shell(
		[
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		[
			{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' }
		]
	);
	const extraction = extractBoundaryCandidateFaces({ ...base, rooms: [] });
	expect(extraction.faces).toHaveLength(2);
	const left = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const right = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	return {
		...base,
		rooms: [
			roomFromFace('room-left', 'Left', left.boundary),
			roomFromFace('room-right', 'Right', right.boundary)
		],
		objects: [
			{
				id: 'obj-left',
				kind: 'box',
				position: [1, 0, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-left'
			},
			{
				id: 'obj-right',
				kind: 'box',
				position: [4, 0, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-right'
			}
		]
	};
}

function successDelete(
	document: LayoutDocumentWallFirst,
	wallId: string,
	capture = freshCapture()
) {
	const plan = planDeleteWall(document, wallId, capture, document.floor.id);
	if (plan.kind !== 'success') {
		throw new Error(`expected delete success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

/** The R0 composed outline; not the production helper, which assumes a closed face. */
function polygonArea(document: LayoutDocumentWallFirst, roomId: string): number {
	const area = composedBoundaryArea(document, roomId);
	expect(area).not.toBeNull();
	return area!;
}

function openedGallery(): ReturnType<typeof applyOpenRoomPolicy> {
	const base = galleryDocument();
	const plan = successDelete(base, 'wall-b', freshCapture());
	return applyOpenRoomPolicy(base, plan);
}

function state(
	document: LayoutDocumentWallFirst,
	operationId: string
): HistoryState<LayoutDocumentWallFirst> {
	const validated = validateWallFirstLayoutDocument(document);
	if (!validated.success) {
		throw new Error(`fixture is not canonical: ${validated.issues[0]?.message}`);
	}
	return {
		source: document,
		canonicalJson: validated.canonicalJson,
		sourceContentId: operationId,
		operationId,
		blockingIssues: [],
		correspondence: []
	};
}

describe('S2 production baseline — what layout-core does today', () => {
	it('retires a Room when one exterior Wall is deleted', () => {
		const base = galleryDocument();
		const plan = successDelete(base, 'wall-b');
		// PRODUCTION VERDICT: the sweep title, its associated object and its
		// boundary are gone. This is the data-loss case S2 exists to replace.
		expect(plan.document.rooms).toEqual([]);
		expect(plan.retiredRoomIds).toEqual(['room-gallery']);
		expect(plan.document.objects.find((object) => object.id === 'obj-bench')?.roomId).toBeUndefined();
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('still merges two Rooms when their shared Wall is deleted', () => {
		const base = twoRoomDocument();
		const plan = successDelete(base, 'wall-e');
		// PRODUCTION VERDICT: ordinary 2→1 reconciliation remains intact.
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.retiredRoomIds).toHaveLength(1);
		const survivorId = plan.document.rooms[0]!.id;
		expect(['room-left', 'room-right']).toContain(survivorId);
		const associationById = new Map(
			plan.document.objects.map((object) => [object.id, object.roomId])
		);
		expect(associationById.get('obj-left')).toBe(survivorId);
		expect(associationById.get('obj-right')).toBe(survivorId);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});
});

describe('S2-1 opened Room keeps identity, content and intended boundary', () => {
	it('keeps the same Room and derives exactly one virtual edge from the erased Wall', () => {
		const base = galleryDocument();
		const plan = successDelete(base, 'wall-b');
		const opened = applyOpenRoomPolicy(base, plan);

		// SIMULATION: the harness keeps the record; production retired it above.
		expect(opened.openedRoomIds).toEqual(['room-gallery']);
		expect(opened.retiredRoomIds).toEqual([]);
		const room = opened.document.rooms.find((candidate) => candidate.id === 'room-gallery')!;
		expect(room.name).toBe('Gallery');
		expect(room.floorThickness).toBe(0.15);
		expect(room.ceilingThickness).toBe(0.12);
		expect(opened.document.objects.find((object) => object.id === 'obj-bench')?.roomId).toBe(
			'room-gallery'
		);
		expect(opened.document.openings.map((opening) => opening.id)).toEqual(['window-gallery']);

		const edges = opened.virtualEdgesByRoomId.get('room-gallery')!;
		expect(edges).toHaveLength(1);
		expect(new Set([edges[0]!.startJunctionId, edges[0]!.endJunctionId])).toEqual(
			new Set(['j-b', 'j-c'])
		);
		expect(edges[0]!.start).toEqual([6, 0]);
		expect(edges[0]!.end).toEqual([6, 4]);

		const composed = composeSpaceBoundary(opened.document, 'room-gallery');
		expect(composed.map((edge) => edge.kind)).toEqual(['wall', 'virtual', 'wall', 'wall']);
		expect(boundaryIsClosed(composed)).toBe(true);
		expect(polygonArea(opened.document, 'room-gallery')).toBeCloseTo(24, 9);
	});

	it('records the structural codec, compiler and world-index verdicts separately', () => {
		const opened = openedGallery();
		const verdicts = productionVerdicts(opened.document);
		// PRODUCTION VERDICTS: each is captured separately. The harness does not
		// infer validity from a polygon-producing compile.
		expect(verdicts.codec.success).toBe(true);
		// The compiler does not synthesize the missing boundary segment; it
		// produces no Room at all. A polygon-producing compile would not have
		// been enough evidence either.
		expect(verdicts.compiler.blocking).toBe(true);
		expect(verdicts.compiler.issueCodes).toEqual(['disconnected_boundary']);
		expect(verdicts.compiler.roomCount).toBe(0);
		expect(verdicts.faceCount).toBe(0);
		// The existing production polygon helper assumes contiguous refs and
		// produces a wrong triangle (12 m²) instead of the intended 24 m².
		expect(verdicts.roomBoundaryPolygonArea).toBeCloseTo(12, 9);
		expect(verdicts.composedBoundaryArea).toBeCloseTo(24, 9);
		// The certified index still requires every Room to be an exact positive
		// face; this is a second independent production touchpoint.
		expect(verdicts.worldIndex.certified).toBe(false);
	});
});

describe('S2-2 redrawing the virtual edge restores the same Room', () => {
	it('returns an all-Wall boundary with the same id, metadata and association', () => {
		const opened = openedGallery();
		const edge = opened.virtualEdgesByRoomId.get('room-gallery')![0]!;
		// PRODUCTION PLANNER over a SIMULATED baseline: feasibility of the 1→1
		// correspondence, not a production path (nothing creates this baseline).
		const restored = redrawVirtualEdge(opened.document, edge, captureFor('s2-restore'));
		expect(restored.kind).toBe('success');
		if (restored.kind !== 'success') return;

		expect(restored.document.rooms).toHaveLength(1);
		const room = restored.document.rooms[0]!;
		expect(room.id).toBe('room-gallery');
		expect(room.name).toBe('Gallery');
		expect(room.floorThickness).toBe(0.15);
		expect(room.ceilingThickness).toBe(0.12);
		expect(deriveVirtualEdges(restored.document, room)).toEqual([]);
		expect(room.boundary).toHaveLength(4);
		expect(restored.document.objects.find((object) => object.id === 'obj-bench')?.roomId).toBe(
			'room-gallery'
		);
		expect(restored.document.openings.map((opening) => opening.id)).toEqual(['window-gallery']);
		expect(restored.lineage).toEqual([]);
		expect(restored.retiredRoomIds).toEqual([]);

		expect(validateWallFirstLayoutDocument(restored.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(restored.document).geometry.rooms).toHaveLength(1);
		expect(ensureLayoutWorldIndex(restored.document)).toBeDefined();
	});
});

describe('S2-3 shared Wall removal still merges', () => {
	it('leaves the production 2→1 result untouched by the open-space policy', () => {
		const base = twoRoomDocument();
		const plan = successDelete(base, 'wall-e');
		const opened = applyOpenRoomPolicy(base, plan);
		// SIMULATION: the policy declines the shared-Wall case, so the production
		// merge result is the document.
		expect(opened.openedRoomIds).toEqual([]);
		expect(opened.virtualEdgesByRoomId.size).toBe(0);
		expect(opened.document.rooms).toHaveLength(1);
		expect(opened.retiredRoomIds).toEqual(['room-right']);
		const survivorId = opened.document.rooms[0]!.id;
		expect(survivorId).toBe('room-left');
		const associationById = new Map(
			opened.document.objects.map((object) => [object.id, object.roomId])
		);
		expect(associationById.get('obj-left')).toBe('room-left');
		expect(associationById.get('obj-right')).toBe('room-left');
		expect(polygonArea(opened.document, survivorId)).toBeCloseTo(24, 9);
	});
});

describe('S2-4 removing the final Wall retires the unsupported Space', () => {
	it('keeps a multi-gap open Space until its last Wall goes, then retires it', () => {
		let opened = openedGallery();
		for (const wallId of ['wall-a', 'wall-c']) {
			const removed = removeWallFromOpenSpace(opened.document, 'room-gallery', wallId);
			expect(removed.retired).toBe(false);
			expect(removed.document.rooms.map((room) => room.id)).toEqual(['room-gallery']);
			expect(removed.remainingVirtualEdges.length).toBeGreaterThan(0);
			opened = {
				...opened,
				document: removed.document,
				virtualEdgesByRoomId: new Map([
					['room-gallery', removed.remainingVirtualEdges]
				])
			};
		}
		const last = removeWallFromOpenSpace(opened.document, 'room-gallery', 'wall-d');
		// SIMULATION: no floor region exists in this batch, so the Space retires.
		expect(last.retired).toBe(true);
		expect(last.document.rooms).toEqual([]);
		expect(last.document.objects.find((object) => object.id === 'obj-bench')?.roomId).toBeUndefined();
		expect(validateWallFirstLayoutDocument(last.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(last.document).geometry.rooms).toEqual([]);
	});
});

describe('S2-5 Undo/Redo snapshots and reconciliation replay', () => {
	it('restores exact states and replays identity deterministically', () => {
		const base = galleryDocument();
		const plan = successDelete(base, 'wall-b', freshCapture());
		const opened = applyOpenRoomPolicy(base, plan);
		const edge = opened.virtualEdgesByRoomId.get('room-gallery')![0]!;
		const restored = redrawVirtualEdge(opened.document, edge, captureFor('s2-restore'));
		expect(restored.kind).toBe('success');
		if (restored.kind !== 'success') return;

		const history = new AuthoringHistory(state(base, 'boot'));
		const openedState = state(opened.document, 'open');
		const restoredState = state(restored.document, 'restore');
		history.push(openedState);
		history.push(restoredState);
		expect(history.depth).toBe(3);
		expect(history.position).toBe(2);

		expect(history.undo()?.canonicalJson).toBe(openedState.canonicalJson);
		expect(history.undo()?.canonicalJson).toBe(state(base, 'boot').canonicalJson);
		expect(history.redo()?.canonicalJson).toBe(openedState.canonicalJson);
		expect(history.redo()?.canonicalJson).toBe(restoredState.canonicalJson);
		// SIMULATION: AuthoringHistory proves exact snapshot restoration only; it
		// is not F4 acceptance or editor transaction wiring.

		const reopened = applyOpenRoomPolicy(
			base,
			successDelete(base, 'wall-b', freshCapture())
		);
		const reopenedState = state(reopened.document, 'open-replay');
		expect(reopenedState.canonicalJson).toBe(openedState.canonicalJson);

		const replaySameCapture = redrawVirtualEdge(
			reopened.document,
			reopened.virtualEdgesByRoomId.get('room-gallery')![0]!,
			captureFor('s2-restore')
		);
		expect(replaySameCapture.kind).toBe('success');
		if (replaySameCapture.kind !== 'success') return;
		expect(state(replaySameCapture.document, 'restore-replay').canonicalJson).toBe(
			restoredState.canonicalJson
		);

		const replayOtherCapture = redrawVirtualEdge(
			reopened.document,
			reopened.virtualEdgesByRoomId.get('room-gallery')![0]!,
			captureFor('s2-restore-other')
		);
		expect(replayOtherCapture.kind).toBe('success');
		if (replayOtherCapture.kind !== 'success') return;
		expect(replayOtherCapture.document.rooms[0]!.id).toBe('room-gallery');
		expect(replayOtherCapture.lineage).toEqual([]);
		expect(replayOtherCapture.retiredRoomIds).toEqual([]);
		expect(deriveVirtualEdges(replayOtherCapture.document, 'room-gallery')).toEqual([]);
		expect(ensureLayoutWorldIndex(replayOtherCapture.document)).toBeDefined();
	});
});

describe('S2-6 representation probes — R0 versus explicit edges', () => {
	it('records the codec verdict for an explicit virtualEdges Room field', () => {
		const opened = openedGallery();
		// PRODUCTION VERDICT: the current Room key set is exact.
		const verdict = probeExplicitVirtualEdges(opened.document, 'room-gallery', [
			{ startJunctionId: 'j-b', endJunctionId: 'j-c' }
		]);
		expect(verdict.success).toBe(false);
		expect(verdict.issueCodes).toContain('unknown_key');
	});

	it('shows R0 collapsing a corner when two adjacent exterior Walls are erased', () => {
		const base = galleryDocument();
		const first = successDelete(base, 'wall-b');
		const opened1 = applyOpenRoomPolicy(base, first);
		const second = removeWallFromOpenSpace(opened1.document, 'room-gallery', 'wall-c');
		expect(second.retired).toBe(false);
		const room = second.document.rooms[0]!;
		const edges = deriveVirtualEdges(second.document, room);
		// R0: one straight gap j-b → j-d, because the intermediate j-c Junction
		// was pruned with the second Wall. The intended corner is gone.
		expect(edges).toHaveLength(1);
		expect(new Set([edges[0]!.startJunctionId, edges[0]!.endJunctionId])).toEqual(
			new Set(['j-b', 'j-d'])
		);
		expect(second.document.junctions.some((junction) => junction.id === 'j-c')).toBe(false);
		const composed = composeSpaceBoundary(second.document, room);
		expect(boundaryIsClosed(composed)).toBe(true);
		// R0 cannot use the production polygon helper here: two surviving line
		// Walls produce only two vertices, so roomBoundaryPolygon() returns null.
		expect(roomBoundaryPolygon(second.document, 'room-gallery')).toBeNull();
		expect(faceArea({ polygon: composed.map((edge) => edge.start) as LayoutVec2[] })).toBeCloseTo(12, 9);
	});

	it('shows R1 preserving two erased Walls through a retained intermediate Junction', () => {
		const base = galleryDocument();
		const first = successDelete(base, 'wall-b');
		const opened1 = applyOpenRoomPolicy(base, first);
		const second = removeWallFromOpenSpace(opened1.document, 'room-gallery', 'wall-c');
		// R1 test-local simulation: retain the intermediate Junction as a
		// virtual-edge anchor and state both erased stretches explicitly.
		const withAnchor = structuredClone(second.document);
		if (!withAnchor.junctions.some((junction) => junction.id === 'j-c')) {
			withAnchor.junctions.push({ id: 'j-c', point: [6, 4] as LayoutVec2 });
		}
		const room = withAnchor.rooms.find((candidate) => candidate.id === 'room-gallery')!;
		const explicit = [
			{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
			{ startJunctionId: 'j-c', endJunctionId: 'j-d' }
		];
		const composed = composeExplicitBoundary(withAnchor, 'room-gallery', explicit);
		expect(composed.map((edge) => edge.kind)).toEqual(['wall', 'virtual', 'virtual', 'wall']);
		expect(boundaryIsClosed(composed)).toBe(true);
		const polygon = composed.flatMap((edge) => [edge.start]) as LayoutVec2[];
		expect(faceArea({ polygon })).toBeCloseTo(24, 9);
		expect(room.boundary.map((ref) => ref.wallId)).toEqual(['wall-a', 'wall-d']);
	});

	it('models an editable edge as a handle, not a selectable subject', () => {
		const opened = openedGallery();
		const edge = opened.virtualEdgesByRoomId.get('room-gallery')![0]!;
		expect(edge.kind).toBe('virtual');
		expect('id' in edge).toBe(false);

		// SIMULATION: mid-grip perpendicular move. The gap endpoints are shared
		// Junctions, so adjacent Walls stretch and the derived edge follows.
		const moved = moveVirtualEdgePerpendicular(opened.document, edge, -0.5);
		const movedEdges = deriveVirtualEdges(moved, 'room-gallery');
		expect(movedEdges).toHaveLength(1);
		expect(boundaryIsClosed(composeSpaceBoundary(moved, 'room-gallery'))).toBe(true);
		expect(polygonArea(moved, 'room-gallery')).toBeCloseTo(26, 9);
		// The existing production helper still loses the two Wall endpoints.
		const movedProductionPolygon = roomBoundaryPolygon(moved, 'room-gallery');
		expect(movedProductionPolygon).not.toBeNull();
		expect(faceArea({ polygon: movedProductionPolygon! })).toBeCloseTo(13, 9);
		expect(validateWallFirstLayoutDocument(moved).success).toBe(true);

		// SIMULATION: one end knob slides along its adjacent Wall.
		const slid = slideVirtualEdgeEnd(opened.document, 'room-gallery', edge, 0.5);
		expect(boundaryIsClosed(composeSpaceBoundary(slid, 'room-gallery'))).toBe(true);
		expect(polygonArea(slid, 'room-gallery')).toBeCloseTo(25, 9);
		const slidProductionPolygon = roomBoundaryPolygon(slid, 'room-gallery');
		expect(slidProductionPolygon).not.toBeNull();
		expect(faceArea({ polygon: slidProductionPolygon! })).toBeCloseTo(12, 9);
		expect(validateWallFirstLayoutDocument(slid).success).toBe(true);
	});
});

describe('S2 fallback probe — retire and redraw', () => {
	it('gives a redrawn production Room a new id, unlike the surviving-Room path', () => {
		const base = galleryDocument();
		const retired = successDelete(base, 'wall-b');
		expect(retired.document.rooms).toEqual([]);
		const redrawn = planWallChain({
			baseline: retired.document,
			points: [
				[6, 0],
				[6, 4]
			],
			close: false,
			height: 3,
			capture: captureFor('s2-fallback'),
			levelId: retired.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-c' }
			]
		});
		expect(redrawn.kind).toBe('success');
		if (redrawn.kind !== 'success') return;
		// PRODUCTION VERDICT: retire-then-redraw loses the Room id.
		expect(redrawn.document.rooms).toHaveLength(1);
		expect(redrawn.document.rooms[0]!.id).not.toBe('room-gallery');

		const opened = openedGallery();
		expect(opened.document.rooms[0]!.id).toBe('room-gallery');
	});
});
