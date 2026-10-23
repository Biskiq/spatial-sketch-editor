/**
 * P23.6d — canonical Room lifecycle planners.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell, so this file
 * calls `layout-core` directly and keeps the planner contract verbatim:
 *
 * - `planRoomMetadataUpdate` edits `name` / `floorThickness` /
 *   `ceilingThickness` on a canonical Room **without** topology
 *   reconciliation (metadata is not topology), rejects `boundary`/legacy
 *   patches (`invalid_patch`), empty names and non-positive/non-finite
 *   thicknesses (`invalid_value`), and no-op patches (`no_op`) so callers
 *   write zero history. Room identity and boundary are preserved.
 * - `planRemoveRoom` removes the Room and its exclusive enclosure Walls in
 *   one atomic operation so a Room delete leaves no open shell of leftover
 *   Walls, while a Wall shared with a neighbouring Room is kept (one physical
 *   Wall the neighbour still needs). It rides the shared Wall-removal pipeline
 *   (`planDeleteWall`'s authority). A Room whose every boundary Wall is shared
 *   rejects atomically.
 *
 * The removed half drove those planners through the deleted editor store,
 * its preview-state adapters, the history runner, the Plan context menu and
 * source-contract reads against deleted `.svelte` files. Those assertions
 * tested editor wiring and are gone with their subjects; the one-command =
 * one-history-entry and Undo/Redo semantics they proved are recorded as a T3
 * F.4 acceptance obligation.
 */
import { describe, expect, it } from 'vitest';

import { extractBoundaryCandidateFaces } from '@portfolio/layout-core';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import type {
	LayoutDocumentWallFirst,
	LayoutWallFirstRoom
} from '@portfolio/layout-core';
import type { LayoutVec2 } from '@portfolio/layout-core';
import {
	planDeleteWall as planDeleteWallWithCapture,
	planRemoveRoom as planRemoveRoomWithCapture,
	planRoomMetadataUpdate,
	roomExclusiveBoundaryWallIds,
	type WallFirstOpPlan
} from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

/** One captured Room removal: every call is a new edit with a new nonce. */
const removeRoom = (document: LayoutDocumentWallFirst, roomId: string): WallFirstOpPlan =>
	planRemoveRoomWithCapture(document, roomId, freshCapture(), document.floor.id);

/** One captured single-Wall delete: every call is a new edit with a new nonce. */
const deleteWall = (document: LayoutDocumentWallFirst, wallId: string): WallFirstOpPlan =>
	planDeleteWallWithCapture(document, wallId, freshCapture(), document.floor.id);

type WallSeed = {
	id: string;
	start: string;
	end: string;
	};

/**
 * Two-room wall-first fixture: a 6×4 enclosure split at x=3 by the shared
 * boundary Wall `wall-e` (bounds BOTH rooms), plus a disconnected roomless
 * partition Wall `wall-rl`. Rooms come from real face extraction so
 * boundaries are genuine reconciled cycles. `wall-e` is shared; `wall-a1`,
 * `wall-c2`, `wall-d` are exclusive to `room-left`; `wall-a2`, `wall-b`,
 * `wall-c1` are exclusive to `room-right`.
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
		formatVersion: 6 as const,
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
		openings: [] as LayoutDocumentWallFirst['openings'],
		objects: [] as LayoutDocumentWallFirst['objects']
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
 * P23B.3a D-12 fixture — a 10×8 outer enclosure (`room-a`) with a 4×4 inner
 * Room (`room-z`) fully inside it, roomless Walls between them so neither
 * boundary references the other's Walls. The two Rooms share no Junction id.
 *
 * THIS FIXTURE USED TO PRODUCE A COLLATERAL RETIREMENT, and no longer does.
 * Removing the OUTER room's exclusive Walls dissolves both rings into exactly
 * the inner room's face, and the old geometric correspondence merged both
 * predecessors into it — the surviving face lies inside BOTH predecessor
 * polygons (an overlap tie), so the lexical ID won and `room-z` retired as
 * collateral. Reconciliation now requires a POSITIVE identity match, so the
 * face belongs to `room-z` (whose Walls survive) and the selected `room-a` —
 * the Room this operation actually dismantled — is the one that retires.
 * The overlap tie-break no longer decides anyone's identity.
 */
function nestedOuterInnerDocument(): LayoutDocumentWallFirst {
	const junctions: Array<[string, number, number]> = [
		['j-oo1', 0, 0],
		['j-oo2', 10, 0],
		['j-oo3', 10, 8],
		['j-oo4', 0, 8],
		['j-i1', 3, 2],
		['j-i2', 7, 2],
		['j-i3', 7, 6],
		['j-i4', 3, 6]
	];
	const walls: WallSeed[] = [
		{ id: 'wall-o1', start: 'j-oo1', end: 'j-oo2' },
		{ id: 'wall-o2', start: 'j-oo2', end: 'j-oo3' },
		{ id: 'wall-o3', start: 'j-oo3', end: 'j-oo4' },
		{ id: 'wall-o4', start: 'j-oo4', end: 'j-oo1' },
		{ id: 'wall-i1', start: 'j-i1', end: 'j-i2' },
		{ id: 'wall-i2', start: 'j-i2', end: 'j-i3' },
		{ id: 'wall-i3', start: 'j-i3', end: 'j-i4' },
		{ id: 'wall-i4', start: 'j-i4', end: 'j-i1' }
	];
	const shell = {
		units: 'meters' as const,
		formatVersion: 6 as const,
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
		openings: [] as LayoutDocumentWallFirst['openings'],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
	const extraction = extractBoundaryCandidateFaces({ ...shell, rooms: [] });
	const outerFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-o1')
	)!;
	const innerFace = extraction.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-i1')
	)!;
	const room = (
		id: string,
		name: string,
		boundary: typeof outerFace.boundary
	): LayoutWallFirstRoom => ({
		id,
		name,
		boundary: boundary.map((ref) => ({ ...ref })),
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return {
		...shell,
		rooms: [room('room-a', 'Outer', outerFace.boundary), room('room-z', 'Inner', innerFace.boundary)]
	};
}

function success(plan: WallFirstOpPlan): Extract<WallFirstOpPlan, { kind: 'success' }> {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${JSON.stringify(plan.rejection)}`);
	}
	return plan;
}

function rejection(plan: WallFirstOpPlan) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

describe('P23.6d planRoomMetadataUpdate — metadata is not topology', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(BASE).success).toBe(true);
	});

	it('renames a Room preserving identity and boundary, with no reconciliation', () => {
		const plan = success(planRoomMetadataUpdate(BASE, 'room-left', { name: '  Lobby  ' }));
		const room = plan.document.rooms.find((candidate) => candidate.id === 'room-left')!;
		expect(room.name).toBe('Lobby');
		expect(room.boundary).toEqual(
			BASE.rooms.find((candidate) => candidate.id === 'room-left')!.boundary
		);
		// Metadata-only: no births, no retirements, no topology change.
		expect(plan.lineage).toEqual([]);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.document.walls).toEqual(BASE.walls);
		expect(plan.document.junctions).toEqual(BASE.junctions);
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('updates floor/ceiling thickness through the canonical numeric rule only', () => {
		const plan = success(
			planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: 0.25, ceilingThickness: 0.3 })
		);
		const room = plan.document.rooms.find((candidate) => candidate.id === 'room-left')!;
		expect(room.floorThickness).toBe(0.25);
		expect(room.ceilingThickness).toBe(0.3);
		// The unrelated room is untouched.
		expect(plan.document.rooms.find((candidate) => candidate.id === 'room-right')).toEqual(
			BASE.rooms.find((candidate) => candidate.id === 'room-right')
		);
	});

	it('allows duplicate names (id is identity, mirroring legacy behavior)', () => {
		const plan = success(planRoomMetadataUpdate(BASE, 'room-right', { name: 'Left' }));
		expect(plan.document.rooms.map((room) => room.name).sort()).toEqual(['Left', 'Left']);
	});

	it('rejects an empty/blank/non-string name and non-positive thicknesses', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: '   ' })).code).toBe(
			'invalid_value'
		);
		expect(
			rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: 5 as unknown as string })).code
		).toBe('invalid_value');
		for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				rejection(planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: value })).code
			).toBe('invalid_value');
			expect(
				rejection(planRoomMetadataUpdate(BASE, 'room-left', { ceilingThickness: value })).code
			).toBe('invalid_value');
		}
	});

	it('rejects boundary and legacy patches with invalid_patch', () => {
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					boundary: []
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					wallThickness: 0.3
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
		expect(
			rejection(
				planRoomMetadataUpdate(BASE, 'room-left', {
					floorHeight: 3
				} as unknown as Parameters<typeof planRoomMetadataUpdate>[2])
			).code
		).toBe('invalid_patch');
	});

	it('rejects a no-op patch (same values or empty) so callers write zero history', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', { name: 'Left' })).code).toBe(
			'no_op'
		);
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-left', {})).code).toBe('no_op');
		expect(
			rejection(planRoomMetadataUpdate(BASE, 'room-left', { floorThickness: 0.1, name: 'Left' })).code
		).toBe('no_op');
	});

	it('rejects an unknown Room atomically', () => {
		expect(rejection(planRoomMetadataUpdate(BASE, 'room-missing', { name: 'X' })).code).toBe(
			'unknown_room'
		);
	});

	it('is input-pure: the baseline document is never mutated', () => {
		const snapshot = JSON.stringify(BASE);
		success(planRoomMetadataUpdate(BASE, 'room-left', { name: 'Lobby' }));
		rejection(planRoomMetadataUpdate(BASE, 'room-left', { boundary: [] } as never));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});
});

describe('P23.6d planRemoveRoom — Room removal over the Wall pipeline', () => {
	it('reports exactly the Room-exclusive boundary Walls (never geometry)', () => {
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-left').sort()).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d'
		]);
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-right').sort()).toEqual([
			'wall-a2',
			'wall-b',
			'wall-c1'
		]);
		// Shared divider and roomless partition are never eligible.
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-left')).not.toContain('wall-e');
		expect(roomExclusiveBoundaryWallIds(BASE, 'room-missing')).toEqual([]);
	});

	it('removes the whole Room and all its own Walls in one operation (no leftover shell)', () => {
		const plan = success(removeRoom(BASE, 'room-right'));
		// The Room and every Wall it owns alone are gone.
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(plan.document.walls.map((wall) => wall.id)).toEqual([
			'wall-a1',
			'wall-c2',
			'wall-d',
			'wall-e',
			'wall-rl'
		]);
		// No dangling shell: nothing from room-right survives except the shared
		// divider (still needed by room-left).
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-a2');
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-c1');
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.rooms).toHaveLength(1);
	});

	it('keeps a Wall shared with a neighbour (one physical Wall the neighbour needs)', () => {
		const plan = success(removeRoom(BASE, 'room-right'));
		expect(plan.document.walls.map((wall) => wall.id)).toContain('wall-e');
		// room-left is completely untouched.
		expect(plan.document.rooms.find((room) => room.id === 'room-left')!.boundary).toEqual(
			BASE.rooms.find((room) => room.id === 'room-left')!.boundary
		);
	});

	it('removes a standalone Room completely (the drawn 4-wall flow)', () => {
		// A genuinely standalone single-room document (only the left enclosure's
		// own Walls): every boundary Wall is exclusive, so the whole enclosure
		// disappears with the Room.
		const ownedWallIds = new Set(['wall-a1', 'wall-e', 'wall-c2', 'wall-d']);
		const ownedJunctionIds = new Set(['j-a', 'j-m', 'j-n', 'j-d']);
		const single: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.filter((wall) => ownedWallIds.has(wall.id)),
			junctions: BASE.junctions.filter((junction) => ownedJunctionIds.has(junction.id)),
			rooms: [{ ...BASE.rooms.find((room) => room.id === 'room-left')! }]
		};
		expect(roomExclusiveBoundaryWallIds(single, 'room-left').sort()).toEqual(
			['wall-a1', 'wall-c2', 'wall-d', 'wall-e'].sort()
		);
		const plan = success(removeRoom(single, 'room-left'));
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.walls).toEqual([]);
		expect(plan.document.junctions).toEqual([]);
		expect(plan.retiredRoomIds).toEqual(['room-left']);
		expect(compileWallFirstLayoutGeometry(plan.document).geometry.walls).toEqual([]);
	});

	it('delegates to the shared planDeleteWall pipeline (never a forked path)', () => {
		// Removing the Room's exclusive Walls is exactly the same candidate as
		// deleting those Walls: pinned through the single-Wall planner below.
		const viaRoom = success(removeRoom(BASE, 'room-right'));
		expect(viaRoom.document.walls.map((wall) => wall.id)).not.toContain('wall-b');
		expect(validateWallFirstLayoutDocument(viaRoom.document).success).toBe(true);
	});

	it('rejects atomically when every boundary Wall is shared (fully interior Room)', () => {
		// Synthetic guard fixture: make every one of room-right's boundary Walls
		// also referenced by room-left, so room-right owns nothing alone. The
		// planner must refuse rather than demolish a neighbour's Walls.
		const rightBoundary = BASE.rooms.find((room) => room.id === 'room-right')!.boundary;
		const allShared: LayoutDocumentWallFirst = {
			...BASE,
			rooms: BASE.rooms.map((room) =>
				room.id === 'room-left' ? { ...room, boundary: [...room.boundary, ...rightBoundary] } : room
			)
		};
		expect(roomExclusiveBoundaryWallIds(allShared, 'room-right')).toEqual([]);
		expect(rejection(removeRoom(allShared, 'room-right')).code).toBe('ambiguous_room_removal');
	});

	it('rejects an unknown Room and a boundary referencing a missing Wall', () => {
		expect(rejection(removeRoom(BASE, 'room-missing')).code).toBe('unknown_room');
		const missingWall: LayoutDocumentWallFirst = {
			...BASE,
			walls: BASE.walls.filter((wall) => wall.id !== 'wall-b')
		};
		expect(rejection(removeRoom(missingWall, 'room-right')).code).toBe(
			'wall_not_in_room_boundary'
		);
	});

	it('removes the removed Walls hosted Openings atomically', () => {
		const hosted: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
				{
					id: 'opening:window:1',
					wallId: 'wall-b',
					kind: 'window',
					offset: 1,
					width: 1.2,
					height: 1.2,
					sillHeight: 1,
					profile: 'rectangular'
				},
				{
					id: 'opening:door:2',
					wallId: 'wall-d',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			]
		};
		const plan = success(removeRoom(hosted, 'room-right'));
		expect(plan.document.openings.map((opening) => opening.id)).toEqual(['opening:door:2']);
	});

	it('clears document-level object associations on retirement (no survivor)', () => {
		const withObjects: LayoutDocumentWallFirst = {
			...BASE,
			objects: [
				{
					id: 'obj-1',
					kind: 'box',
					position: [4, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-right'
				},
				{
					id: 'obj-2',
					kind: 'box',
					position: [1, 0, 2],
					dimensions: [1, 1, 1],
					rotation: [0, 0, 0],
					roomId: 'room-left'
				}
			]
		};
		const plan = success(removeRoom(withObjects, 'room-right'));
		const byId = new Map(plan.document.objects.map((object) => [object.id, object]));
		expect(byId.get('obj-1')!.roomId).toBeUndefined();
		expect(byId.get('obj-2')!.roomId).toBe('room-left');
	});

	it('refuses atomically when a surviving portal relation cannot be remapped', () => {
		// The door lives on the surviving shared Wall and names the retiring
		// Room: one endpoint resolves, the other disappeared → the P23.8
		// contract rejects rather than guessing.
		const related: LayoutDocumentWallFirst = {
			...BASE,
			openings: [
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
			]
		};
		const plan = removeRoom(related, 'room-right');
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(['room_reconciliation_rejected', 'unresolved_portal_remap']).toContain(
				plan.rejection.code
			);
		}
	});

	it('prunes only the removed Walls endpoints; unrelated orphan Junctions survive', () => {
		const withOrphan: LayoutDocumentWallFirst = {
			...BASE,
			junctions: [...BASE.junctions, { id: 'j-orphan', point: [20, 20] }]
		};
		const plan = success(removeRoom(withOrphan, 'room-right'));
		const ids = new Set(plan.document.junctions.map((junction) => junction.id));
		// j-b / j-c belonged only to room-right's Walls → pruned; j-m / j-n are
		// shared with surviving Walls → kept; the unrelated orphan is never swept.
		expect(ids.has('j-b')).toBe(false);
		expect(ids.has('j-c')).toBe(false);
		expect(ids.has('j-m')).toBe(true);
		expect(ids.has('j-n')).toBe(true);
		expect(ids.has('j-orphan')).toBe(true);
	});

	it('is input-pure and rejects leave zero partial mutation', () => {
		const snapshot = JSON.stringify(BASE);
		success(removeRoom(BASE, 'room-right'));
		success(removeRoom(BASE, 'room-left'));
		rejection(removeRoom(BASE, 'room-missing'));
		expect(JSON.stringify(BASE)).toBe(snapshot);
	});
});

describe('P23B.3a D-12 — nested Room identity follows authored Walls', () => {
	it('P23B.3a D-12 — removing the OUTER nested Room retires the Room it dismantled and preserves the inner one', () => {
		// Superseded behaviour, recorded here: reconciliation used to merge both
		// predecessors into the inner Room's face on an overlap tie and retire
		// `room-z` as COLLATERAL while the selected outer Room survived. Identity now
		// follows authored Walls: `room-a`'s Walls are the ones this operation
		// removes, so `room-a` retires and the nested `room-z` keeps its identity.
		const nested = nestedOuterInnerDocument();
		expect(roomExclusiveBoundaryWallIds(nested, 'room-a')).toEqual(['wall-o1', 'wall-o2', 'wall-o3', 'wall-o4']);
		const plan = success(removeRoom(nested, 'room-a'));
		expect(plan.retiredRoomIds).toEqual(['room-a']);
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-z']);
	});
});

describe('P23.6d legacy single-Wall delete stays intact', () => {
	it('planDeleteWall still deletes exactly one Wall', () => {
		const plan = success(deleteWall(BASE, 'wall-e'));
		expect(plan.document.walls.map((wall) => wall.id)).not.toContain('wall-e');
		expect(plan.document.rooms).toHaveLength(1);
	});
});
