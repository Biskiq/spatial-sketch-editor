import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces } from '$lib/layout/layout-face-extraction';
import {
	LAYOUT_DUPLICATE_MAX_COPIES,
	isSupportedDuplicateLayoutObject,
	planDuplicateIsolatedRoom,
	planRepeatLayoutObject,
	planRepeatWallOpening
} from '$lib/layout/layout-duplicate';
import { validateWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { validateWallFirstTopology } from '$lib/layout/layout-wall-first-precision';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom
} from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	duplicateWallFirstRoom,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	repeatWallFirstObject,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	createLayoutInteractionState,
	selectLayoutObject,
	selectLayoutWallOpening
} from '$lib/editor/layout/layout-interaction';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
};

function shell(options: {
	junctions: Array<[string, number, number]>;
	walls: WallSeed[];
	openings?: LayoutDocumentWallFirst['openings'];
	objects?: LayoutDocumentWallFirst['objects'];
}) {
	return {
		units: 'meters' as const,
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: wall.role ?? ('boundary' as const),
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' } as const,
		})),
		rooms: [] as LayoutWallFirstRoom[],
		openings: options.openings ?? [],
		objects: options.objects ?? []
	};
}

function roomFromFace(
	id: string,
	name: string,
	face: ReturnType<typeof extractBoundaryCandidateFaces>['faces'][number]
): LayoutWallFirstRoom {
	return {
		id,
		name,
		boundary: face.boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	};
}

/**
 * Isolated-room fixture: one 6×4 enclosure (room-1) plus a roomless
 * partition wall far to the right. room-1 owns every boundary wall and
 * junction exclusively — cloneable without detaching shared architecture.
 */
function isolatedRoomDocument(): LayoutDocumentWallFirst {
	const base = shell({
		junctions: [
			['j-a', 0, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-d', 0, 4],
			['j-x', 20, 0],
			['j-y', 20, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-rl', start: 'j-x', end: 'j-y', role: 'partition' }
		],
		objects: [
			{
				id: 'obj-1',
				kind: 'box',
				position: [1, 0.5, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-1'
			},
			{
				id: 'obj-free',
				kind: 'box',
				position: [2, 0.5, 2],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1]
			}
		]
	});
	const extraction = extractBoundaryCandidateFaces(base);
	const face = extraction.faces.find((candidate) =>
		candidate.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	return { ...base, rooms: [roomFromFace('room-1', 'Alone', face)] };
}

/**
 * Two-room fixture: a 6×4 enclosure split at x=3 by the shared boundary
 * Wall `wall-e` (bounds BOTH rooms — the shared-boundary rejection case).
 */
function twoRoomDocument(
	openings: LayoutDocumentWallFirst['openings'] = [],
	objects: LayoutDocumentWallFirst['objects'] = []
): LayoutDocumentWallFirst {
	const base = shell({
		junctions: [
			['j-a', 0, 0],
			['j-m', 3, 0],
			['j-b', 6, 0],
			['j-c', 6, 4],
			['j-n', 3, 4],
			['j-d', 0, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-m' },
			{ id: 'wall-a2', start: 'j-m', end: 'j-b' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c1', start: 'j-c', end: 'j-n' },
			{ id: 'wall-c2', start: 'j-n', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-e', start: 'j-m', end: 'j-n' }
		],
		openings,
		objects
	});
	const extraction = extractBoundaryCandidateFaces(base);
	const leftFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const rightFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a2')
	)!;
	return {
		...base,
		rooms: [
			roomFromFace('room-left', 'Left', leftFace),
			roomFromFace('room-right', 'Right', rightFace)
		]
	};
}

const ISOLATED = isolatedRoomDocument();
const TWO_ROOM = twoRoomDocument();

function success(plan: ReturnType<typeof planRepeatLayoutObject>) {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

function rejection(plan:
	| { kind: 'success' }
	| { kind: 'rejected'; rejection: { code: string; message: string } }
) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

// ---------------------------------------------------------------------------
// Layout object duplicate / linear repeat
// ---------------------------------------------------------------------------

describe('P23.4 layout object repeat', () => {
	it('N copies get unique IDs and exact index × delta positions from the original', () => {
		const plan = success(
			planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 3, delta: [2, 1] })
		);
		expect(plan.createdObjectIds).toEqual(['obj-1-copy', 'obj-1-copy.2', 'obj-1-copy.3']);
		const copies = plan.document.objects.filter((object) =>
			plan.createdObjectIds.includes(object.id)
		);
		expect(copies).toHaveLength(3);
		expect(copies.map((object) => object.position[0])).toEqual([3, 5, 7]);
		expect(copies.map((object) => object.position[2])).toEqual([2, 3, 4]);
		// Y, rotation, dimensions and kind-specific data are preserved.
		for (const copy of copies) {
			expect(copy.position[1]).toBe(0.5);
			expect(copy.rotation).toEqual([0, 0, 0]);
			expect(copy.dimensions).toEqual([1, 1, 1]);
			expect(copy.kind).toBe('box');
		}
		// Copies remain document-level/project-world-local with the optional
		// semantic roomId preserved (P23.8 owns later remapping, not this op).
		expect(copies.every((copy) => copy.roomId === 'room-1')).toBe(true);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('duplicate is repeat with one copy', () => {
		const plan = success(
			planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 1, delta: [1, 0] })
		);
		expect(plan.createdObjectIds).toEqual(['obj-1-copy']);
		expect(plan.document.objects).toHaveLength(3);
	});

	it('rejects an unknown object and read-only profile objects', () => {
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-none', count: 1, delta: [1, 0] }))).toMatchObject({ code: 'unknown_object' });
		const withProfile: LayoutDocumentWallFirst = {
			...ISOLATED,
			objects: [
				...ISOLATED.objects,
				{
					id: 'obj-profile',
					kind: 'profile',
					position: [0, 0, 0],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					profile: {
						closed: true,
						segments: [{ id: 'seg-1', kind: 'line', start: [0, 0] as LayoutVec2, end: [1, 0] as LayoutVec2 }]
					}
				}
			]
		};
		expect(rejection(planRepeatLayoutObject(withProfile, { objectId: 'obj-profile', count: 1, delta: [1, 0] }))).toMatchObject({ code: 'profile_object_read_only' });
	});

	it('rejects out-of-range counts and non-finite deltas', () => {
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 0, delta: [1, 0] }))).toMatchObject({ code: 'count_out_of_range' });
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: LAYOUT_DUPLICATE_MAX_COPIES + 1, delta: [1, 0] }))).toMatchObject({ code: 'count_out_of_range' });
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 2.5, delta: [1, 0] }))).toMatchObject({ code: 'count_out_of_range' });
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 2, delta: [Number.NaN, 0] }))).toMatchObject({ code: 'invalid_value' });
		expect(rejection(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 2, delta: [1, Number.POSITIVE_INFINITY] }))).toMatchObject({ code: 'invalid_value' });
	});

	it('accepts exactly 50 copies with unique IDs and no ID collisions', () => {
		const plan = success(
			planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: LAYOUT_DUPLICATE_MAX_COPIES, delta: [0.01, 0] })
		);
		expect(plan.createdObjectIds).toHaveLength(LAYOUT_DUPLICATE_MAX_COPIES);
		expect(new Set(plan.createdObjectIds).size).toBe(LAYOUT_DUPLICATE_MAX_COPIES);
		const all = plan.document.objects.map((object) => object.id);
		expect(new Set(all).size).toBe(all.length);
		// index × delta from the original: no accumulated drift.
		const first = plan.document.objects.find((object) => object.id === 'obj-1-copy')!;
		const last = plan.document.objects.find((object) => object.id === 'obj-1-copy.50')!;
		expect(last.position[0] - first.position[0]).toBeCloseTo(49 * 0.01, 12);
	});
});

// ---------------------------------------------------------------------------
// Opening duplicate / linear repeat
// ---------------------------------------------------------------------------

function withDoor(document: LayoutDocumentWallFirst, offset = 1) {
	return {
		...document,
		openings: [
			...document.openings,
			{
				id: 'opening:door:1',
				wallId: 'wall-e',
				kind: 'door' as const,
				offset,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular' as const
			}
		]
	};
}

describe('P23.4 wall opening repeat', () => {
	it('copies get exact offsets and unique IDs on the same host Wall', () => {
		const seeded = withDoor(TWO_ROOM);
		const plan = success(
			planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 2, spacing: 1 })
		);
		expect(plan.createdOpeningIds).toEqual(['opening:door:1-copy', 'opening:door:1-copy.2']);
		const copy = plan.document.openings.find((opening) => opening.id === 'opening:door:1-copy')!;
		expect(copy.wallId).toBe('wall-e');
		expect(copy.offset).toBe(2);
		expect(copy.kind).toBe('door');
		expect(copy.width).toBe(0.9);
		expect(copy.height).toBe(2.1);
		expect(copy.sillHeight).toBe(0);
		expect(copy.profile).toBe('rectangular');
		const last = plan.document.openings.find((opening) => opening.id === 'opening:door:1-copy.2')!;
		expect(last.offset).toBe(3);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('validates the entire final opening set as one batch; an invalid last copy rolls back all copies', () => {
		const seeded = withDoor(TWO_ROOM);
		// wall-e is 4 m: door at 1 → copies at 2, 3, 4 → the last (4 + 0.9)
		// overflows the wall. The WHOLE batch rejects, nothing partial commits.
		const overflowing = planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 3, spacing: 1 });
		expect(rejection(overflowing)).toMatchObject({ code: 'opening_set_invalid' });
		// The baseline document is untouched.
		expect(seeded.openings).toHaveLength(1);
	});

	it('rejects same-wall overlap as one batch', () => {
		const seeded = withDoor(TWO_ROOM);
		const overlapping = planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 1, spacing: 0.5 });
		expect(rejection(overlapping)).toMatchObject({ code: 'opening_set_invalid' });
	});

	it('rejects out-of-range counts, non-finite spacing and unknown openings', () => {
		const seeded = withDoor(TWO_ROOM);
		expect(rejection(planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 0, spacing: 1 }))).toMatchObject({ code: 'count_out_of_range' });
		expect(rejection(planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 51, spacing: 1 }))).toMatchObject({ code: 'count_out_of_range' });
		expect(rejection(planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 1, spacing: Number.NaN }))).toMatchObject({ code: 'invalid_value' });
		expect(rejection(planRepeatWallOpening(seeded, { openingId: 'opening:none', count: 1, spacing: 1 }))).toMatchObject({ code: 'unknown_opening' });
	});

	it('copies a portal relation only when the new-schema adjacency contract still holds at the copy', () => {
		// wall-e bounds room-left and room-right → the relation is valid and
		// stays valid on the copy (same host Wall, same adjacent rooms).
		const related = twoRoomDocument([
			{
				id: 'opening:door:1',
				wallId: 'wall-e',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular',
				connectsRoomIds: ['room-left', 'room-right']
			}
		]);
		const plan = success(planRepeatWallOpening(related, { openingId: 'opening:door:1', count: 1, spacing: 1.5 }));
		const copy = plan.document.openings.find((opening) => opening.id === 'opening:door:1-copy')!;
		expect(copy.connectsRoomIds).toEqual(['room-left', 'room-right']);

		// A codec-legal but nonadjacent relation on an exterior wall can never
		// satisfy the new-schema contract at the copy location → the batch
		// rejects instead of blindly duplicating `connectsRoomIds`.
		const nonadjacent = twoRoomDocument([
			{
				id: 'opening:door:1',
				wallId: 'wall-d',
				kind: 'door',
				offset: 1,
				width: 0.9,
				height: 2.1,
				sillHeight: 0,
				profile: 'rectangular',
				connectsRoomIds: ['room-left', 'room-right']
			}
		]);
		expect(rejection(planRepeatWallOpening(nonadjacent, { openingId: 'opening:door:1', count: 1, spacing: 1 }))).toMatchObject({ code: 'portal_relation_invalid' });
	});
});

// ---------------------------------------------------------------------------
// Isolated Room duplicate
// ---------------------------------------------------------------------------

describe('P23.4 isolated Room duplicate', () => {
	it('clones each Junction, Wall and hosted Opening exactly once with one delta', () => {
		const withWindow = {
			...ISOLATED,
			openings: [
				{
					id: 'opening:window:1',
					wallId: 'wall-a1',
					kind: 'window' as const,
					offset: 2,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular' as const
				}
			]
		};
		const plan = success(planDuplicateIsolatedRoom(withWindow, { roomId: 'room-1', delta: [10, 0] }));
		expect(plan.createdRoomId).toBe('room-1-copy');
		// 4 junctions + 4 walls + 1 opening — exactly once each.
		expect(plan.createdJunctionIds).toHaveLength(4);
		expect(plan.createdWallIds).toHaveLength(4);
		expect(plan.createdOpeningIds).toHaveLength(1);
		const sourceIds = new Set([
			'j-a', 'j-b', 'j-c', 'j-d', 'wall-a1', 'wall-b', 'wall-c', 'wall-d', 'opening:window:1'
		]);
		for (const created of [...plan.createdJunctionIds, ...plan.createdWallIds, ...plan.createdOpeningIds]) {
			expect(sourceIds.has(created)).toBe(false);
		}
		// Cloned junction coordinates use the exact delta from the original.
		const cloneJunction = plan.document.junctions.find((junction) => junction.id === 'j-a-copy')!;
		expect(cloneJunction.point).toEqual([10, 0]);
		// Opening offsets stay unchanged (cloned wall geometry moves with them).
		const cloneOpening = plan.document.openings.find((opening) => opening.id === 'opening:window:1-copy')!;
		expect(cloneOpening.offset).toBe(2);
		expect(cloneOpening.wallId).toBe('wall-a1-copy');
		// The roomless partition wall was NOT cloned.
		expect(plan.document.walls.filter((wall) => wall.id === 'wall-rl')).toHaveLength(1);
		expect(plan.document.walls.filter((wall) => wall.id === 'wall-rl-copy')).toHaveLength(0);
	});

	it('cloned Room identity is new and its boundary references only cloned Walls', () => {
		const plan = success(planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [10, 0] }));
		const clone = plan.document.rooms.find((room) => room.id === 'room-1-copy')!;
		expect(clone).toBeDefined();
		expect(clone.name).toBe('Alone copy');
		expect(clone.floorThickness).toBe(0.1);
		expect(clone.ceilingThickness).toBe(0.1);
		const cloneWallIds = new Set(plan.createdWallIds);
		for (const ref of clone.boundary) {
			expect(cloneWallIds.has(ref.wallId)).toBe(true);
		}
		// The source room is untouched and both rooms coexist.
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['room-1', 'room-1-copy']);
	});

	it('associated Layout objects copy with translated world transforms and remapped roomIds; unassociated objects do not copy', () => {
		const plan = success(planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [10, 0] }));
		const copies = plan.document.objects.filter((object) => plan.createdObjectIds.includes(object.id));
		expect(copies).toHaveLength(1);
		const copy = copies[0]!;
		expect(copy.id).toBe('obj-1-copy');
		expect(copy.roomId).toBe('room-1-copy');
		expect(copy.position).toEqual([11, 0.5, 1]);
		// The unassociated object inside the face never copies.
		expect(plan.document.objects.filter((object) => object.id === 'obj-free')).toHaveLength(1);
		expect(plan.document.objects.filter((object) => object.id === 'obj-free-copy')).toHaveLength(0);
	});

	it('rejects shared-boundary Room duplicate with a clear diagnostic and no state change', () => {
		const rejected = rejection(planDuplicateIsolatedRoom(TWO_ROOM, { roomId: 'room-left', delta: [10, 0] }));
		expect(rejected.code).toBe('room_not_isolated');
		expect(rejected.message).toContain('wall-e');
		// No document was produced — the input is untouched.
		expect(TWO_ROOM.rooms).toHaveLength(2);
	});

	it('rejects a Room whose boundary junctions carry non-cloned walls', () => {
		// A T-stub attached to the enclosure's boundary junction makes the
		// bounded subgraph non-isolated (the clone would detach it).
		const withStub = {
			...isolatedRoomDocument(),
			junctions: [
				...isolatedRoomDocument().junctions,
				{ id: 'j-t', point: [0, -3] as LayoutVec2 }
			],
			walls: [
				...isolatedRoomDocument().walls,
				{
					id: 'wall-stub',
					startJunctionId: 'j-a',
					endJunctionId: 'j-t',
					role: 'boundary' as const,
					thickness: 0.2,
					height: 3,
					centerline: { kind: 'line' } as const,
				}
			]
		};
		const rejected = rejection(planDuplicateIsolatedRoom(withStub, { roomId: 'room-1', delta: [10, 0] }));
		expect(rejected.code).toBe('room_not_isolated');
		expect(rejected.message).toContain('wall-stub');
	});

	it('rejects an external portal relation that cannot be remapped safely', () => {
		// A codec-legal door relation on the isolated room's wall relates it
		// to a DIFFERENT Room outside the cloned subgraph.
		const farRoomDocument = isolatedRoomDocument();
		const withExternal: LayoutDocumentWallFirst = {
			...farRoomDocument,
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-a1',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-1', 'room-other']
				}
			],
			// room-other exists only as the relation's far endpoint; its boundary
			// references the roomless partition wall's junctions is not possible
			// (one wall cannot close a face), so give it a minimal real boundary
			// is unnecessary: the codec only checks that referenced walls exist,
			// not that the room face closes. Reuse wall-rl (it exists).
			rooms: [
				...farRoomDocument.rooms,
				{
					id: 'room-other',
					name: 'Far',
					boundary: [{ wallId: 'wall-rl', direction: 'forward' }],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		expect(validateWallFirstLayoutDocument(withExternal).success).toBe(true);
		const rejected = rejection(planDuplicateIsolatedRoom(withExternal, { roomId: 'room-1', delta: [10, 0] }));
		expect(rejected.code).toBe('external_portal_relation');
		expect(rejected.message).toContain('opening:door:1');
	});

	it('P23B.3a S7 RE-BASED — commits a clone that OVERLAPS independent geometry, joining nothing', () => {
		// This row asserted `topology_invalid`: the clone was refused because this
		// module classified it against every other Wall in the document with the
		// chord-exact classifier. S7 (D-8) deletes that second rule — the duplicate
		// path calls the canonical `validateWallFirstTopology`, whose subject is the
		// connected component — so the clone's overlap with its own source is
		// PERMITTED independent placement (F1/F5, D-9) rather than a violation. The
		// pre-policy refusal survives in the P23B.3a reference register as history.
		const snapshot = JSON.stringify(ISOLATED);
		const plan = success(
			planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [-2, 0] })
		);
		expect(plan.createdRoomId).toBe('room-1-copy');
		const sourceJunctions = new Set(ISOLATED.junctions.map((junction) => junction.id));
		const sourceWalls = new Set(ISOLATED.walls.map((wall) => wall.id));
		expect(plan.createdJunctionIds.every((id) => !sourceJunctions.has(id))).toBe(true);
		expect(plan.createdWallIds.every((id) => !sourceWalls.has(id))).toBe(true);
		// The clone's Walls meet only the clone's own Junctions: overlap created no
		// shared Junction and split nothing.
		const cloneJunctions = new Set(plan.createdJunctionIds);
		for (const wallId of plan.createdWallIds) {
			const wall = plan.document.walls.find((candidate) => candidate.id === wallId)!;
			expect(cloneJunctions.has(wall.startJunctionId)).toBe(true);
			expect(cloneJunctions.has(wall.endJunctionId)).toBe(true);
		}
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			...ISOLATED.walls.map((wall) => wall.id),
			...plan.createdWallIds
		]);
		expect(plan.document.junctions.map((junction) => junction.id)).toEqual([
			...ISOLATED.junctions.map((junction) => junction.id),
			...plan.createdJunctionIds
		]);
		// Planner and gate agree about the document the planner produced.
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
		expect(JSON.stringify(ISOLATED)).toBe(snapshot);
	});

	it('P23B.3a S7 RE-BASED — the old 1 m UI default delta is admitted as permitted overlap (explicit delta still required)', () => {
		// The 6×4 enclosure translated by only [1, 0] overlaps its own source. That
		// overlap is independent placement now, not `topology_invalid`. What this row
		// was written to protect is unaffected and is a UI decision rather than a
		// validity rule: the creator supplies an EXPLICIT delta, and the planner never
		// invents, defaults or normalizes one on the caller's behalf.
		const overlapping = success(
			planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [1, 0] })
		);
		expect(overlapping.createdRoomId).toBe('room-1-copy');
		expect(overlapping.document.rooms.map((room) => room.id)).toEqual([
			'room-1',
			'room-1-copy'
		]);
		expect(validateWallFirstTopology(overlapping.document)).toBeUndefined();
		expect(success(planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [10, 0] })).createdRoomId).toBe('room-1-copy');
	});

	it('rejects the whole Room batch when an associated object is read-only profile', () => {
		const withProfileInRoom: LayoutDocumentWallFirst = {
			...ISOLATED,
			objects: [
				...ISOLATED.objects,
				{
					id: 'obj-profile-in-room',
					kind: 'profile',
					position: [3, 0, 3],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					profile: {
						closed: true,
						segments: [{ id: 'seg-1', kind: 'line', start: [0, 0] as LayoutVec2, end: [1, 0] as LayoutVec2 }]
					},
					roomId: 'room-1'
				}
			]
		};
		expect(validateWallFirstLayoutDocument(withProfileInRoom).success).toBe(true);
		const rejected = rejection(planDuplicateIsolatedRoom(withProfileInRoom, { roomId: 'room-1', delta: [10, 0] }));
		expect(rejected.code).toBe('profile_object_read_only');
		expect(rejected.message).toContain('obj-profile-in-room');
		// The input document is untouched — no partial batch committed.
		expect(withProfileInRoom.objects).toHaveLength(3);
	});

	it('shares one supported-object predicate across standalone and Room-batch paths', () => {
		expect(isSupportedDuplicateLayoutObject({ kind: 'box' })).toBe(true);
		expect(isSupportedDuplicateLayoutObject({ kind: 'profile' })).toBe(false);
	});

	it('rejects unknown rooms and non-finite deltas', () => {
		expect(rejection(planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-none', delta: [1, 0] }))).toMatchObject({ code: 'unknown_room' });
		expect(rejection(planDuplicateIsolatedRoom(ISOLATED, { roomId: 'room-1', delta: [Number.NaN, 0] }))).toMatchObject({ code: 'invalid_value' });
	});
});

// ---------------------------------------------------------------------------
// Editor surface + history (P23.4 one command → one Layout history result)
// ---------------------------------------------------------------------------

function duplicateStore(seed: LayoutDocumentWallFirst = ISOLATED) {
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

function mutate(context: ReturnType<typeof duplicateStore>, run: () => { success: boolean }) {
	const outcome = runLayoutMutation(
		layoutMutationRunnerFor(context.store, context.preview),
		run,
		(result) => result.success
	);
	return outcome;
}

describe('P23.4 editor surface + history', () => {
	it('commits an object repeat as one history entry and Undo/Redo restores exact IDs', () => {
		const context = duplicateStore();
		const { store, preview } = context;
		const outcome = mutate(context, () =>
			repeatWallFirstObject(preview, { objectId: 'obj-1', count: 2, delta: [1, 0] })
		);
		expect(outcome.kind).toBe('committed');
		let live = wallFirstLive(preview);
		expect(live.objects.map((object) => object.id)).toEqual(['obj-1', 'obj-free', 'obj-1-copy', 'obj-1-copy.2']);

		expect(store.undo()).toBe(true);
		live = wallFirstLive(preview);
		expect(live.objects.map((object) => object.id)).toEqual(['obj-1', 'obj-free']);

		// Redo never reallocates: the exact same allocated IDs return.
		expect(store.redo()).toBe(true);
		live = wallFirstLive(preview);
		expect(live.objects.map((object) => object.id)).toEqual(['obj-1', 'obj-free', 'obj-1-copy', 'obj-1-copy.2']);
	});

	it('commits an isolated Room duplicate and Undo restores the exact prior document', () => {
		const context = duplicateStore();
		const { store, preview } = context;
		const outcome = mutate(context, () =>
			duplicateWallFirstRoom(preview, { roomId: 'room-1', delta: [10, 0] })
		);
		expect(outcome.kind).toBe('committed');
		let live = wallFirstLive(preview);
		expect(live.rooms.map((room) => room.id)).toEqual(['room-1', 'room-1-copy']);
		// 4 boundary junctions + 2 partition-wall junctions, doubled.
		expect(live.junctions).toHaveLength(10);
		// 4 boundary walls + 1 roomless partition wall → 5 + 4 cloned = 9.
		expect(live.walls).toHaveLength(9);
		expect(live.objects.map((object) => object.id)).toEqual(['obj-1', 'obj-free', 'obj-1-copy']);

		expect(store.undo()).toBe(true);
		live = wallFirstLive(preview);
		expect(live.rooms.map((room) => room.id)).toEqual(['room-1']);
		expect(live.junctions).toHaveLength(6);
		expect(live.walls).toHaveLength(5);
		expect(live.objects.map((object) => object.id)).toEqual(['obj-1', 'obj-free']);
		expect(store.redo()).toBe(true);
		expect(wallFirstLive(preview).rooms.map((room) => room.id)).toEqual(['room-1', 'room-1-copy']);
	});

	it('a rejected duplicate writes no history and leaves the document untouched', () => {
		const context = duplicateStore(TWO_ROOM);
		const { store, preview } = context;
		const before = JSON.stringify(wallFirstLive(preview));
		const outcome = mutate(context, () =>
			// room-left shares wall-e with room-right → rejected.
			duplicateWallFirstRoom(preview, { roomId: 'room-left', delta: [10, 0] })
		);
		expect(outcome.kind).toBe('cancelled');
		expect(JSON.stringify(wallFirstLive(preview))).toBe(before);
		expect(store.canUndo).toBe(false);
	});

	it('the Scene document stays byte-equivalent through duplicate operations', () => {
		const context = duplicateStore();
		const { preview } = context;
		const sceneBefore = JSON.stringify(preview.project.scene);
		expect(mutate(context, () =>
			duplicateWallFirstRoom(preview, { roomId: 'room-1', delta: [10, 0] })
		).kind).toBe('committed');
		expect(mutate(context, () =>
			repeatWallFirstObject(preview, { objectId: 'obj-1', count: 3, delta: [2, 0] })
		).kind).toBe('committed');
		expect(JSON.stringify(preview.project.scene)).toBe(sceneBefore);
	});

	it('opening duplicate selects the first new copy through the canonical wallOpening authority', () => {
		const seeded = withDoor(TWO_ROOM);
		const plan = success(planRepeatWallOpening(seeded, { openingId: 'opening:door:1', count: 1, spacing: 1.5 }));
		const firstCopyId = plan.createdOpeningIds[0]!;
		const copy = plan.document.openings.find((opening) => opening.id === firstCopyId)!;
		// Host wall is unchanged, so the Inspector selects (wallId, copyId).
		expect(copy.wallId).toBe('wall-e');
		const interaction = createLayoutInteractionState();
		selectLayoutWallOpening(interaction, copy.wallId, firstCopyId);
		expect(interaction.selection).toEqual({ kind: 'wallOpening', wallId: 'wall-e', openingId: firstCopyId });
	});

	it('object duplicate selects the first new copy through the object authority', () => {
		const plan = success(planRepeatLayoutObject(ISOLATED, { objectId: 'obj-1', count: 1, delta: [1, 0] }));
		const firstCopyId = plan.createdObjectIds[0]!;
		const interaction = createLayoutInteractionState();
		selectLayoutObject(interaction, firstCopyId);
		expect(interaction.selection).toEqual({ kind: 'object', objectId: firstCopyId });
	});
});
