/**
 * P23.6a — Wall-first Room unit move (domain).
 *
 * One canonical operation: a persisted Room's canonical boundary Junctions
 * translate by one rigid X/Z delta, correspondence is exact
 * boundary-lineage key equality (never geometric overlap/witness), and global
 * Room identity is asserted rather than assumed.
 */
import { describe, expect, it } from 'vitest';

import {
	canonicalBoundaryCycleKey,
	extractBoundaryCandidateFaces
} from '$lib/layout/layout-face-extraction';
import {
	connectedRoomIds,
	resolveIsolatedRoomGroupSubgraph,
	resolveIsolatedRoomSubgraph
} from '$lib/layout/layout-room-isolation';
import { planWallFirstRoomMove, roomBoundaryCycleKey } from '$lib/layout/layout-room-move';
import { validateWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWallFirstRoom,
	type LayoutWallOpening
} from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
	thickness?: number;
	height?: number;
};

function shell(options: {
	junctions: Array<[string, number, number]>;
	walls: WallSeed[];
	openings?: LayoutWallOpening[];
	objects?: LayoutDocumentWallFirst['objects'];
	rooms?: LayoutWallFirstRoom[];
}): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map((wall) => ({
			id: wall.id,
			startJunctionId: wall.start,
			endJunctionId: wall.end,
			role: wall.role ?? ('boundary' as const),
			thickness: wall.thickness ?? 0.2,
			height: wall.height ?? 3
		})),
		rooms: options.rooms ?? [],
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
 * Isolated-room fixture: one 6×4 enclosure (`room-1`) with a door on the
 * south Wall, one deliberately taller boundary Wall, one associated object and
 * one unassociated object inside the face, plus a roomless partition Wall far
 * to the right. `room-1` owns every boundary Wall and Junction exclusively.
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
			// Deliberately taller than its neighbours: P23.6H/P23.6I heights
			// must survive the move verbatim.
			{ id: 'wall-b', start: 'j-b', end: 'j-c', height: 4.5 },
			{ id: 'wall-c', start: 'j-c', end: 'j-d', height: 2.4 },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			{ id: 'wall-rl', start: 'j-x', end: 'j-y', role: 'partition' }
		],
		openings: [
			{
				id: 'opening:window:1',
				wallId: 'wall-a1',
				kind: 'window',
				offset: 2,
				width: 1.2,
				height: 1.2,
				sillHeight: 1,
				profile: 'rectangular'
			}
		],
		objects: [
			{
				id: 'obj-1',
				kind: 'box',
				position: [1, 0.5, 1],
				rotation: [0, 0.4, 0],
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
	const faces = extractBoundaryCandidateFaces(base);
	return { ...base, rooms: [roomFromFace('room-1', 'Alone', faces.faces[0]!)] };
}

/**
 * Two adjacent 4×4 enclosures sharing `wall-b` (and therefore its two
 * Junctions) — the connected group amendment A exists for.
 */
function twoRoomDocument(extra?: {
	openings?: LayoutDocumentWallFirst['openings'];
	thirdRoom?: boolean;
}): LayoutDocumentWallFirst {
	const base = shell({
		junctions: [
			['j-a', 0, 0],
			['j-b', 4, 0],
			['j-e1', 8, 0],
			['j-e2', 8, 4],
			['j-c', 4, 4],
			['j-d', 0, 4],
			...(extra?.thirdRoom
				? ([['j-x', 40, 0], ['j-y', 40, 4]] as Array<[string, number, number]>)
				: [])
		],
		walls: [
			{ id: 'wall-a', start: 'j-a', end: 'j-b' },
			{ id: 'wall-e', start: 'j-b', end: 'j-e1' },
			{ id: 'wall-f', start: 'j-e1', end: 'j-e2' },
			{ id: 'wall-g', start: 'j-e2', end: 'j-c' },
			{ id: 'wall-b', start: 'j-b', end: 'j-c' },
			{ id: 'wall-c', start: 'j-c', end: 'j-d' },
			{ id: 'wall-d', start: 'j-d', end: 'j-a' },
			...(extra?.thirdRoom
				? [
						{
							id: 'wall-rl',
							start: 'j-x',
							end: 'j-y',
							role: 'partition' as const
						}
					]
				: [])
		],
		openings: extra?.openings
	});
	const faces = extractBoundaryCandidateFaces(base);
	const leftFace = faces.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a')
	)!;
	const rightFace = faces.faces.find((face) => face !== leftFace)!;
	return {
		...base,
		rooms: [
			roomFromFace('room-left', 'Left', leftFace),
			roomFromFace('room-right', 'Right', rightFace),
			...(extra?.thirdRoom
				? [
						{
							id: 'room-other',
							name: 'Far',
							boundary: [{ wallId: 'wall-rl', direction: 'forward' as const }],
							floorThickness: 0.1,
							ceilingThickness: 0.1
						}
					]
				: [])
		]
	};
}

/** Two Rooms meeting at exactly one shared Junction (corner contact). */
function cornerConnectedRoomsDocument(): LayoutDocumentWallFirst {
	const base = shell({
		junctions: [
			['j-a', 0, 0],
			['j-b', 4, 0],
			['j-c', 4, 4],
			['j-d', 0, 4],
			['j-e', 8, 4],
			['j-f', 8, 8],
			['j-g', 4, 8]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a', end: 'j-b' },
			{ id: 'wall-a2', start: 'j-b', end: 'j-c' },
			{ id: 'wall-a3', start: 'j-c', end: 'j-d' },
			{ id: 'wall-a4', start: 'j-d', end: 'j-a' },
			{ id: 'wall-b1', start: 'j-c', end: 'j-e' },
			{ id: 'wall-b2', start: 'j-e', end: 'j-f' },
			{ id: 'wall-b3', start: 'j-f', end: 'j-g' },
			{ id: 'wall-b4', start: 'j-g', end: 'j-c' }
		]
	});
	const faces = extractBoundaryCandidateFaces(base);
	const first = faces.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const second = faces.faces.find((face) => face !== first)!;
	return {
		...base,
		rooms: [roomFromFace('room-a', 'A', first), roomFromFace('room-b', 'B', second)]
	};
}

/** Two independent enclosures with no shared Junction or Wall. */
function twoDisjointRoomsDocument(): LayoutDocumentWallFirst {
	const base = shell({
		junctions: [
			['j-a1', 0, 0],
			['j-a2', 6, 0],
			['j-a3', 6, 4],
			['j-a4', 0, 4],
			['j-b1', 20, 0],
			['j-b2', 26, 0],
			['j-b3', 26, 4],
			['j-b4', 20, 4]
		],
		walls: [
			{ id: 'wall-a1', start: 'j-a1', end: 'j-a2' },
			{ id: 'wall-a2', start: 'j-a2', end: 'j-a3' },
			{ id: 'wall-a3', start: 'j-a3', end: 'j-a4' },
			{ id: 'wall-a4', start: 'j-a4', end: 'j-a1' },
			{ id: 'wall-b1', start: 'j-b1', end: 'j-b2' },
			{ id: 'wall-b2', start: 'j-b2', end: 'j-b3' },
			{ id: 'wall-b3', start: 'j-b3', end: 'j-b4' },
			{ id: 'wall-b4', start: 'j-b4', end: 'j-b1' }
		]
	});
	const faces = extractBoundaryCandidateFaces(base);
	const first = faces.faces.find((face) =>
		face.boundary.some((ref) => ref.wallId === 'wall-a1')
	)!;
	const second = faces.faces.find((face) => face !== first)!;
	return {
		...base,
		rooms: [roomFromFace('room-a', 'A', first), roomFromFace('room-b', 'B', second)]
	};
}

function success(plan: ReturnType<typeof planWallFirstRoomMove>) {
	if (plan.kind !== 'success') {
		throw new Error(`expected success, got ${plan.rejection.code}: ${plan.rejection.message}`);
	}
	return plan;
}

function rejection(plan: ReturnType<typeof planWallFirstRoomMove>) {
	if (plan.kind !== 'rejected') throw new Error('expected rejection');
	return plan.rejection;
}

function junctionPoints(document: LayoutDocumentWallFirst, ids: readonly string[]) {
	return ids.map((id) => document.junctions.find((junction) => junction.id === id)!.point);
}

describe('P23.6a S2 — canonical boundary-cycle key', () => {
	it('is invariant under a pure translation of the same boundary cycle', () => {
		const document = isolatedRoomDocument();
		const roomId = 'room-1';
		const translated: LayoutDocumentWallFirst = {
			...document,
			junctions: document.junctions.map((junction) => ({
				...junction,
				point: [junction.point[0] + 100, junction.point[1]] as LayoutVec2
			}))
		};
		const before = roomBoundaryCycleKey(document.rooms.find((r) => r.id === roomId)!);
		const after = roomBoundaryCycleKey(translated.rooms.find((r) => r.id === roomId)!);
		expect(after).toBe(before);
		// The persisted Room cycle IS a canonical candidate-face key.
		expect(extractBoundaryCandidateFaces(document).faces[0]!.key).toBe(before);
		// Rotating the cycle start does not change the key.
		const room = document.rooms[0]!;
		const rotated = [...room.boundary.slice(1), room.boundary[0]!];
		expect(canonicalBoundaryCycleKey(rotated)).toBe(before);
	});
});

describe('P23.6a — isolated Room rigid move', () => {
	it('translates the boundary graph rigidly and preserves Room identity', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [12, -3]));

		expect(plan.movedRoomId).toBe('room-1');
		expect(plan.operation).toBe('room-move');
		expect([...plan.changedJunctionIds].sort()).toEqual(['j-a', 'j-b', 'j-c', 'j-d']);
		expect([...plan.changedWallIds].sort()).toEqual(['wall-a1', 'wall-b', 'wall-c', 'wall-d']);

		// Same IDs, translated points.
		expect(junctionPoints(plan.document, ['j-a', 'j-b', 'j-c', 'j-d'])).toEqual([
			[12, -3],
			[18, -3],
			[18, 1],
			[12, 1]
		]);
		// The roomless partition Wall and its Junctions did not move.
		expect(junctionPoints(plan.document, ['j-x', 'j-y'])).toEqual([
			[20, 0],
			[20, 4]
		]);
		// Room identity, name, metadata and boundary lineage are preserved.
		expect(plan.document.rooms).toHaveLength(1);
		const room = plan.document.rooms[0]!;
		expect(room.id).toBe('room-1');
		expect(room.name).toBe('Alone');
		expect(roomBoundaryCycleKey(room)).toBe(roomBoundaryCycleKey(document.rooms[0]!));
	});

	it('preserves Wall identity, role, thickness and authored height exactly', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [12, 0]));
		const before = new Map(document.walls.map((wall) => [wall.id, wall]));
		for (const wall of plan.document.walls) {
			const prior = before.get(wall.id)!;
			expect(wall).toEqual(prior);
		}
		expect(plan.document.walls.find((wall) => wall.id === 'wall-b')!.height).toBe(4.5);
		expect(plan.document.walls.find((wall) => wall.id === 'wall-c')!.height).toBe(2.4);
		expect(plan.document.walls.find((wall) => wall.id === 'wall-rl')!.role).toBe('partition');
	});

	it('preserves Opening identity and authored semantics across the move', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [0, 9]));
		expect(plan.document.openings).toEqual(document.openings);
		const opening = plan.document.openings[0]!;
		expect(opening.wallId).toBe('wall-a1');
		expect(opening.offset).toBe(2);
		expect(opening.width).toBe(1.2);
		expect(opening.height).toBe(1.2);
		expect(opening.sillHeight).toBe(1);
		expect(opening.profile).toBe('rectangular');
		// The defensive canonical Opening gate accepted the moved candidate.
		expect(validateWallFirstLayoutDocument(plan.document).success).toBe(true);
	});

	it('moves explicitly associated objects only, preserving their Y, yaw and dimensions', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [4, 4]));
		expect(plan.changedObjectIds).toEqual(['obj-1']);
		const moved = plan.document.objects.find((object) => object.id === 'obj-1')!;
		expect(moved.position).toEqual([5, 0.5, 5]);
		expect(moved.rotation).toEqual([0, 0.4, 0]);
		expect(moved.dimensions).toEqual([1, 1, 1]);
		expect(moved.roomId).toBe('room-1');
		// The unassociated object inside the face never moves.
		expect(plan.document.objects.find((object) => object.id === 'obj-free')).toEqual(
			document.objects.find((object) => object.id === 'obj-free')
		);
	});

	it('leaves every unassociated document record byte-identical', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [-2, 7]));
		expect(plan.document.objects).toHaveLength(document.objects.length);
		expect(plan.document.openings).toEqual(document.openings);
		expect(plan.document.floor).toEqual(document.floor);
		expect(plan.document.formatVersion).toBe(document.formatVersion);
		expect(plan.document.units).toBe(document.units);
		// Unrelated Junction/Wall records are byte-identical.
		expect(plan.document.walls.find((wall) => wall.id === 'wall-rl')).toEqual(
			document.walls.find((wall) => wall.id === 'wall-rl')
		);
		expect(plan.document.junctions.find((junction) => junction.id === 'j-x')).toEqual(
			document.junctions.find((junction) => junction.id === 'j-x')
		);
	});

	it('never mutates the input document (one immutable baseline)', () => {
		const document = isolatedRoomDocument();
		const snapshot = JSON.stringify(document);
		success(planWallFirstRoomMove(document, 'room-1', [8, 8]));
		expect(JSON.stringify(document)).toBe(snapshot);
	});

	it('preserves roomId across a large-distance move (no geometric correspondence)', () => {
		const document = isolatedRoomDocument();
		// 100 m is far beyond any overlap/witness signal: the pre-P23.6a
		// correspondence helper produced a component with no predecessor Room
		// at this distance, which would have rejected an ordinary move.
		const plan = success(planWallFirstRoomMove(document, 'room-1', [100, 100]));
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-1']);
		expect(junctionPoints(plan.document, ['j-a'])).toEqual([[100, 100]]);
	});

	it('produces zero Room births, retirements, splits or merges globally', () => {
		const document = isolatedRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-1', [12, 5]));
		const faceKeyToRoom = new Map(
			extractBoundaryCandidateFaces(plan.document).faces.map((face) => [
				roomOf(plan.document, face.boundary),
				face.key
			])
		);
		expect(plan.document.rooms).toHaveLength(document.rooms.length);
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(
			document.rooms.map((room) => room.id).sort()
		);
		expect(faceKeyToRoom.get('room-1')).toBe(
			extractBoundaryCandidateFaces(document).faces[0]!.key
		);
	});

	it('rejects intent-level failures with stable codes and no document', () => {
		const document = isolatedRoomDocument();
		expect(rejection(planWallFirstRoomMove(document, 'room-none', [1, 0])).code).toBe(
			'unknown_room'
		);
		expect(rejection(planWallFirstRoomMove(document, 'room-1', [Number.NaN, 0])).code).toBe(
			'invalid_value'
		);
		expect(rejection(planWallFirstRoomMove(document, 'room-1', [0, 0])).code).toBe('no_op');
	});
});

describe('P23.6a amendment A — the movable unit is the connected Room group', () => {
	it('moves a Room sharing a boundary Wall with another Room as one group', () => {
		const document = twoRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-left', [0, 20]));

		// The dragged Room anchors the group; the connected member travels with it.
		expect(plan.movedRoomId).toBe('room-left');
		expect(plan.movedRoomIds).toEqual(['room-left', 'room-right']);
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual([
			'room-left',
			'room-right'
		]);
		expect(plan.document.rooms).toHaveLength(document.rooms.length);

		// Both enclosures are where the delta put them.
		expect(junctionPoints(plan.document, ['j-a', 'j-b', 'j-c', 'j-d'])).toEqual([
			[0, 20],
			[4, 20],
			[4, 24],
			[0, 24]
		]);
		expect(junctionPoints(plan.document, ['j-e1', 'j-e2'])).toEqual([
			[8, 20],
			[8, 24]
		]);

		// Room identity and boundary lineage survive for every member.
		for (const room of document.rooms) {
			const moved = plan.document.rooms.find((candidate) => candidate.id === room.id)!;
			expect(moved.name).toBe(room.name);
			expect(roomBoundaryCycleKey(moved)).toBe(roomBoundaryCycleKey(room));
		}
	});

	it('translates the shared interior Wall exactly once, with identical records', () => {
		const document = twoRoomDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-right', [10, 10]));

		// The shared Wall is one record in the moved set, not duplicated.
		expect(plan.changedWallIds.filter((wallId) => wallId === 'wall-b')).toHaveLength(1);
		expect(plan.document.walls.filter((wall) => wall.id === 'wall-b')).toHaveLength(1);
		const before = new Map(document.walls.map((wall) => [wall.id, wall]));
		for (const wall of plan.document.walls) {
			// Fields never change; the Wall moves because its Junctions moved.
			expect(wall).toEqual(before.get(wall.id)!);
		}
	});

	it('groups Rooms that meet at only one shared Junction (corner contact)', () => {
		const document = cornerConnectedRoomsDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-a', [0, 12]));
		expect(plan.movedRoomIds).toEqual(['room-a', 'room-b']);
		// The shared corner Junction moved once, so neither Room was torn off it.
		expect(junctionPoints(plan.document, ['j-c'])).toEqual([[4, 16]]);
	});

	it('preserves a portal relation whose endpoints both move with the group', () => {
		const document = twoRoomDocument({
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-b',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-right']
				}
			]
		});
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const plan = success(planWallFirstRoomMove(document, 'room-left', [0, 20]));
		// An interior door stays a door: same record, same host Wall, same relation.
		expect(plan.document.openings).toEqual(document.openings);
	});

	it('rejects a portal relation with an endpoint outside the group', () => {
		const document = twoRoomDocument({
			thirdRoom: true,
			openings: [
				{
					id: 'opening:door:1',
					wallId: 'wall-b',
					kind: 'door',
					offset: 1,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['room-left', 'room-other']
				}
			]
		});
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const rejected = rejection(planWallFirstRoomMove(document, 'room-left', [0, 20]));
		expect(rejected.code).toBe('external_portal_relation');
		expect(rejected.message).toContain('opening:door:1');
	});

	it('moves only the dragged component when Rooms are disjoint', () => {
		const document = twoDisjointRoomsDocument();
		const plan = success(planWallFirstRoomMove(document, 'room-a', [0, 30]));
		expect(plan.movedRoomIds).toEqual(['room-a']);
		// The unrelated enclosure did not move at all.
		expect(junctionPoints(plan.document, ['j-b1', 'j-b2', 'j-b3', 'j-b4'])).toEqual([
			[20, 0],
			[26, 0],
			[26, 4],
			[20, 4]
		]);
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['room-a', 'room-b']);
	});
});

describe('P23.6a — isolation policy (shared with P23.4 duplicate)', () => {
	it('keeps the single-Room duplicate policy (shared Wall still rejects there)', () => {
		const document = twoRoomDocument();
		const single = resolveIsolatedRoomSubgraph(document, 'room-left');
		expect(single.kind).toBe('rejected');
		if (single.kind === 'rejected') {
			expect(single.rejection.code).toBe('room_not_isolated');
			expect(single.rejection.message).toContain('room-right');
			expect(single.rejection.message).toContain('wall-b');
		}
		// …while the group scope moves exactly that pair.
		const group = resolveIsolatedRoomGroupSubgraph(document, 'room-left');
		expect(group.kind).toBe('success');
		if (group.kind === 'success') {
			expect(group.subgraph.roomIds).toEqual(['room-left', 'room-right']);
		}
	});

	it('rejects a boundary Junction carrying an external Wall (including corner-only)', () => {
		const document = isolatedRoomDocument();
		const withStub: LayoutDocumentWallFirst = {
			...document,
			junctions: [...document.junctions, { id: 'j-t', point: [0, -3] }],
			walls: [
				...document.walls,
				{
					id: 'wall-stub',
					startJunctionId: 'j-a',
					endJunctionId: 'j-t',
					role: 'boundary',
					thickness: 0.2,
					height: 3
				}
			]
		};
		const stub = rejection(planWallFirstRoomMove(withStub, 'room-1', [20, 0]));
		expect(stub.code).toBe('room_not_isolated');
		expect(stub.message).toContain('wall-stub');
	});

	it('rejects a hosted Opening that carries an external portal relation', () => {
		const document = isolatedRoomDocument();
		const withRelation: LayoutDocumentWallFirst = {
			...document,
			// Only door openings may carry a portal relation (codec rule).
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
			rooms: [
				...document.rooms,
				{
					id: 'room-other',
					name: 'Far',
					boundary: [{ wallId: 'wall-rl', direction: 'forward' }],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		expect(validateWallFirstLayoutDocument(withRelation).success).toBe(true);
		const portal = rejection(planWallFirstRoomMove(withRelation, 'room-1', [12, 0]));
		expect(portal.code).toBe('external_portal_relation');
		expect(portal.message).toContain('opening:door:1');
	});

	it('rejects an explicitly associated read-only profile object', () => {
		const document = isolatedRoomDocument();
		const withProfile: LayoutDocumentWallFirst = {
			...document,
			objects: [
				...document.objects,
				{
					id: 'obj-profile',
					kind: 'profile',
					position: [3, 0, 3],
					rotation: [0, 0, 0],
					dimensions: [1, 1, 1],
					profile: {
						closed: true,
						segments: [
							{
								id: 'seg-1',
								kind: 'line',
								start: [0, 0] as LayoutVec2,
								end: [1, 0] as LayoutVec2
							}
						]
					},
					roomId: 'room-1'
				}
			]
		};
		const profile = rejection(planWallFirstRoomMove(withProfile, 'room-1', [12, 0]));
		expect(profile.code).toBe('profile_object_read_only');
		expect(profile.message).toContain('obj-profile');
	});

	it('exposes the shared subgraphs so duplicate and move can never drift', () => {
		const document = isolatedRoomDocument();
		const resolved = resolveIsolatedRoomSubgraph(document, 'room-1');
		expect(resolved.kind).toBe('success');
		if (resolved.kind !== 'success') return;
		expect(resolved.subgraph.wallIds).toEqual(['wall-a1', 'wall-b', 'wall-c', 'wall-d']);
		expect(resolved.subgraph.junctionIds).toEqual(['j-a', 'j-b', 'j-c', 'j-d']);
		expect(resolved.subgraph.openingIds).toEqual(['opening:window:1']);
		expect(resolved.subgraph.associatedObjectIds).toEqual(['obj-1']);
		expect(resolved.subgraph.profileObjectIds).toEqual([]);

		// Group scope: an isolated Room is a group of one, and the group
		// subgraph is the union over its members.
		const group = resolveIsolatedRoomGroupSubgraph(document, 'room-1');
		expect(group.kind).toBe('success');
		if (group.kind !== 'success') return;
		expect(group.subgraph.roomIds).toEqual(['room-1']);
		expect(group.subgraph.wallIds).toEqual(resolved.subgraph.wallIds);
		expect(group.subgraph.junctionIds).toEqual(resolved.subgraph.junctionIds);
		expect(group.subgraph.associatedObjectIds).toEqual(['obj-1']);

		// Connectivity is junction-based and deterministic: anchor first.
		expect(connectedRoomIds(twoRoomDocument(), 'room-right')).toEqual([
			'room-right',
			'room-left'
		]);
		expect(connectedRoomIds(twoDisjointRoomsDocument(), 'room-a')).toEqual(['room-a']);
	});
});

describe('P23.6a — destination topology is the existing canonical gate', () => {
	it('rejects a destination that lands a Junction on an existing Junction point', () => {
		const document = isolatedRoomDocument();
		// [20, 0] puts j-a exactly on j-x: duplicate Junction point, never a merge.
		const rejected = rejection(planWallFirstRoomMove(document, 'room-1', [20, 0]));
		expect(['topology_invalid', 'opening_set_invalid']).toContain(rejected.code);
		expect(planWallFirstRoomMove(document, 'room-1', [20, 0]).kind).toBe('rejected');
	});

	it('rejects a destination that overlaps an unrelated Wall', () => {
		const document = isolatedRoomDocument();
		// Straddling the roomless partition Wall at x = 20 crosses it.
		const rejected = rejection(planWallFirstRoomMove(document, 'room-1', [17, 0]));
		expect(rejected.code).toBe('topology_invalid');
	});
});

/** Room owning the given candidate face boundary, through face-key equality. */
function roomOf(
	document: LayoutDocumentWallFirst,
	boundary: readonly { wallId: string; direction: 'forward' | 'reverse' }[]
): string {
	const key = canonicalBoundaryCycleKey(boundary);
	const room = document.rooms.find((candidate) => roomBoundaryCycleKey(candidate) === key);
	return room?.id ?? 'missing';
}
