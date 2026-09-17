/**
 * P23 Junction dissolve / Wall join — core planner contract.
 *
 * `planDissolveJunction` is the exact inverse of `planWallSplit`: a degree-2
 * Junction whose two incident Walls join without inventing or losing geometry
 * dissolves into one Wall. Pinned here:
 *
 * - precondition order and stable codes (unknown / degree / degenerate /
 *   duplicate / incompatible / non-collinear);
 * - deterministic survivor policy (through-configuration extends the incoming
 *   wall, otherwise lexicographic);
 * - straight joins in all three orientation configurations;
 * - exact Opening rebasing (forward shift, reverse mirror, abutting edges);
 * - Room preservation with reconciliation-owned boundaries;
 * - atomic rejection (input document deep-equal unchanged);
 * - straight split → dissolve round trips, including float-residue tolerance.
 *
 * History-untouched is asserted at the editor/integration level — the core
 * planner owns no history.
 */
import { describe, expect, it } from 'vitest';
import {
	planDissolveJunction,
	planWallSplit,
	validateWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type DissolvePlan,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const allocator: NodingIdAllocator = {
	nextWallId: (_document, seed) => `${seed}-frag`,
	nextJunctionId: (_document, seed) => `${seed}-j`
};

type WallSeed = {
	id: string;
	start: string;
	end: string;
	role?: 'boundary' | 'partition';
	thickness?: number;
	height?: number;
	name?: string;
};

function buildDocument(options: {
	junctions: Array<[string, number, number]>;
	walls: WallSeed[];
	rooms?: LayoutDocumentWallFirst['rooms'];
	openings?: LayoutDocumentWallFirst['openings'];
}): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: options.junctions.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: options.walls.map(
			(wall): LayoutWall => ({
				id: wall.id,
				startJunctionId: wall.start,
				endJunctionId: wall.end,
				role: wall.role ?? 'boundary',
				thickness: wall.thickness ?? 0.2,
				height: wall.height ?? 3,
				centerline: { kind: 'line' },
				...(wall.name !== undefined ? { name: wall.name } : {})
			})
		),
		rooms: options.rooms ?? [],
		openings: options.openings ?? [],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
}

/**
 * 4×3 rectangular Room whose south edge is pre-split at M(2,0) into
 * w1a (A→M) + w1b (M→B), with a door on w1a. M is the dissolve target:
 * through-configuration, survivor w1a.
 */
function splitRectDocument(): LayoutDocumentWallFirst {
	return buildDocument({
		junctions: [
			['A', 0, 0],
			['M', 2, 0],
			['B', 4, 0],
			['C', 4, 3],
			['D', 0, 3]
		],
		walls: [
			{ id: 'w1a', start: 'A', end: 'M' },
			{ id: 'w1b', start: 'M', end: 'B' },
			{ id: 'w2', start: 'B', end: 'C' },
			{ id: 'w3', start: 'C', end: 'D' },
			{ id: 'w4', start: 'D', end: 'A' }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1a', direction: 'forward' },
					{ wallId: 'w1b', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{
				id: 'door',
				wallId: 'w1a',
				kind: 'door',
				offset: 0.5,
				width: 0.9,
				height: 2,
				sillHeight: 0,
				profile: 'rectangular'
			}
		]
	});
}

function rejectionOf(plan: DissolvePlan): { code: string; message: string } {
	expect(plan.kind).toBe('rejected');
	if (plan.kind !== 'rejected') throw new Error('unreachable');
	return plan.rejection;
}

describe('dissolve preconditions', () => {
	it('rejects an unknown junction', () => {
		const document = splitRectDocument();
		const before = JSON.stringify(document);
		const rejection = rejectionOf(planDissolveJunction(document, 'nope'));
		expect(rejection.code).toBe('unknown_junction');
		expect(JSON.stringify(document)).toBe(before);
	});

	it('rejects degree-0, degree-1 and degree-3 junctions', () => {
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['M', 2, 0],
				['B', 4, 0],
				['P', 2, 2],
				['Q', 9, 9],
				['R', 9, 8],
				['orphan', 20, 20]
			],
			walls: [
				{ id: 'w1a', start: 'A', end: 'M' },
				{ id: 'w1b', start: 'M', end: 'B' },
				{ id: 'stem', start: 'M', end: 'P', role: 'partition' },
				{ id: 'stub', start: 'Q', end: 'R', role: 'partition' }
			]
		});
		// M has three incident walls.
		const three = rejectionOf(planDissolveJunction(document, 'M'));
		expect(three.code).toBe('junction_degree_not_two');
		// R has one incident wall.
		const one = rejectionOf(planDissolveJunction(document, 'R'));
		expect(one.code).toBe('junction_degree_not_two');
		// P has one incident wall (partition stem endpoint).
		const stemEnd = rejectionOf(planDissolveJunction(document, 'P'));
		expect(stemEnd.code).toBe('junction_degree_not_two');
		// An orphan junction has none.
		const orphan = rejectionOf(planDissolveJunction(document, 'orphan'));
		expect(orphan.code).toBe('junction_degree_not_two');
	});

	it('rejects a self-loop incident wall', () => {
		const document = buildDocument({
			junctions: [
				['J', 0, 0],
				['E', 4, 0]
			],
			walls: [
				{ id: 'loop', start: 'J', end: 'J' },
				{ id: 'w', start: 'E', end: 'J' }
			]
		});
		const rejection = rejectionOf(planDissolveJunction(document, 'J'));
		expect(rejection.code).toBe('degenerate_wall_pair');
	});

	it('rejects walls sharing both endpoints', () => {
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['J', 4, 0]
			],
			walls: [
				{ id: 'w1', start: 'A', end: 'J' },
				{ id: 'w2', start: 'A', end: 'J' }
			]
		});
		const rejection = rejectionOf(planDissolveJunction(document, 'J'));
		expect(rejection.code).toBe('degenerate_wall_pair');
	});

	it('rejects when a third wall already spans the joined endpoints', () => {
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['M', 2, 0],
				['B', 4, 0]
			],
			walls: [
				{ id: 'w1a', start: 'A', end: 'M' },
				{ id: 'w1b', start: 'M', end: 'B' },
				{ id: 'wAB', start: 'A', end: 'B' }
			]
		});
		const rejection = rejectionOf(planDissolveJunction(document, 'M'));
		expect(rejection.code).toBe('duplicate_joined_wall');
	});

	it.each([
		['role', { role: 'partition' as const }],
		['thickness', { thickness: 0.3 }],
		['height', { height: 2.5 }]
	])('rejects %s mismatch', (_label, override) => {
		const document = splitRectDocument();
		const w1b = document.walls.find((wall) => wall.id === 'w1b')!;
		Object.assign(w1b, override);
		const rejection = rejectionOf(planDissolveJunction(document, 'M'));
		expect(rejection.code).toBe('incompatible_wall_pair');
	});

	it('rejects differing authored names but keeps a single name', () => {
		const conflict = splitRectDocument();
		conflict.walls.find((wall) => wall.id === 'w1a')!.name = 'South A';
		conflict.walls.find((wall) => wall.id === 'w1b')!.name = 'South B';
		expect(rejectionOf(planDissolveJunction(conflict, 'M')).code).toBe('incompatible_wall_pair');

		const single = splitRectDocument();
		single.walls.find((wall) => wall.id === 'w1b')!.name = 'South';
		const plan = planDissolveJunction(single, 'M');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.document.walls.find((wall) => wall.id === 'w1a')!.name).toBe('South');
	});

	it('rejects an angled straight pair', () => {
		const document = splitRectDocument();
		// Corner B: w1b ends at B, w2 starts at B — through-configuration, 90°.
		const rejection = rejectionOf(planDissolveJunction(document, 'B'));
		expect(rejection.code).toBe('non_collinear_straight_pair');
	});

	it('rejects a near-straight 179° pair (tolerance is noise-only)', () => {
		const angle = Math.PI / 180;
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['J', 2, 0],
				['B', 2 + 2 * Math.cos(angle), 2 * Math.sin(angle)]
			],
			walls: [
				{ id: 'w1', start: 'A', end: 'J' },
				{ id: 'w2', start: 'J', end: 'B' }
			]
		});
		const rejection = rejectionOf(planDissolveJunction(document, 'J'));
		expect(rejection.code).toBe('non_collinear_straight_pair');
	});
});

describe('straight dissolve', () => {
	it('dissolves a through-configuration pair into the surviving wall', () => {
		const document = splitRectDocument();
		const plan = planDissolveJunction(document, 'M');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('w1a');
		expect(plan.retiredWallId).toBe('w1b');
		expect(plan.retiredJunctionId).toBe('M');
		expect(plan.createdKnotId).toBeUndefined();

		const joined = plan.document.walls.find((wall) => wall.id === 'w1a')!;
		expect(joined.startJunctionId).toBe('A');
		expect(joined.endJunctionId).toBe('B');
		expect(joined.centerline).toEqual({ kind: 'line' });
		expect(plan.document.walls.some((wall) => wall.id === 'w1b')).toBe(false);
		expect(plan.document.junctions.some((junction) => junction.id === 'M')).toBe(false);

		// Room identity preserved with the reconciliation-owned single-ref cycle.
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room');
		expect(plan.document.rooms[0]!.boundary).toEqual([
			{ wallId: 'w1a', direction: 'forward' },
			{ wallId: 'w2', direction: 'forward' },
			{ wallId: 'w3', direction: 'forward' },
			{ wallId: 'w4', direction: 'forward' }
		]);

		// The door on the survivor keeps its offset.
		const door = plan.document.openings.find((opening) => opening.id === 'door')!;
		expect(door.wallId).toBe('w1a');
		expect(door.offset).toBe(0.5);
	});

	it('dissolves a both-end pair with reverse Opening rebasing', () => {
		// w1: A→J and w2: B→J are collinear; both end at J. Lexicographic
		// survivor is w1; w2 is traversed in reverse on the joined A→B wall.
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['J', 2, 0],
				['B', 4, 0]
			],
			walls: [
				{ id: 'w1', start: 'A', end: 'J' },
				{ id: 'w2', start: 'B', end: 'J' }
			],
			openings: [
				{
					id: 'win',
					wallId: 'w2',
					kind: 'window',
					offset: 0.25,
					width: 0.5,
					height: 1,
					sillHeight: 1,
					profile: 'rectangular'
				}
			]
		});
		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('w1');
		const joined = plan.document.walls.find((wall) => wall.id === 'w1')!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['A', 'B']);
		// w2 occupies [2,4] reversed: offset' = 2 + 2 − 0.25 − 0.5 = 3.25.
		const win = plan.document.openings.find((opening) => opening.id === 'win')!;
		expect(win.wallId).toBe('w1');
		expect(win.offset).toBeCloseTo(3.25, 12);
	});

	it('dissolves a both-start pair, rebasing the survivor itself', () => {
		// w1: J→A and w2: J→B are collinear; both start at J. Survivor w1 is
		// traversed in reverse on the joined A→B wall.
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['J', 2, 0],
				['B', 4, 0]
			],
			walls: [
				{ id: 'w1', start: 'J', end: 'A' },
				{ id: 'w2', start: 'J', end: 'B' }
			],
			openings: [
				{
					id: 'win',
					wallId: 'w1',
					kind: 'window',
					offset: 0.5,
					width: 0.5,
					height: 1,
					sillHeight: 1,
					profile: 'rectangular'
				}
			]
		});
		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('w1');
		const joined = plan.document.walls.find((wall) => wall.id === 'w1')!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['A', 'B']);
		// w1 occupies [0,2] reversed: offset' = 0 + 2 − 0.5 − 0.5 = 1.
		expect(plan.document.openings.find((opening) => opening.id === 'win')!.offset).toBeCloseTo(
			1,
			12
		);
	});

	it('rebases an opening abutting the junction exactly', () => {
		const document = splitRectDocument();
		// Window fills the far half of w1b: [1,2] of the [0,2] fragment.
		document.openings.push({
			id: 'win',
			wallId: 'w1b',
			kind: 'window',
			offset: 1,
			width: 1,
			height: 1,
			sillHeight: 1,
			profile: 'rectangular'
		});
		const plan = planDissolveJunction(document, 'M');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		const win = plan.document.openings.find((opening) => opening.id === 'win')!;
		expect(win.wallId).toBe('w1a');
		expect(win.offset).toBeCloseTo(3, 12);
	});

	it('preserves door portal relations across a shared wall', () => {
		// Two rooms sharing wall-e; the outer west edge is pre-split at W.
		const document = buildDocument({
			junctions: [
				['a', 0, 0],
				['w', 0, 2],
				['d', 0, 4],
				['n', 3, 4],
				['c', 6, 4],
				['b', 6, 0],
				['m', 3, 0]
			],
			walls: [
				{ id: 'wall-w1', start: 'a', end: 'w' },
				{ id: 'wall-w2', start: 'w', end: 'd' },
				{ id: 'wall-n1', start: 'd', end: 'n' },
				{ id: 'wall-n2', start: 'n', end: 'c' },
				{ id: 'wall-e1', start: 'c', end: 'b' },
				{ id: 'wall-s1', start: 'b', end: 'm' },
				{ id: 'wall-s2', start: 'm', end: 'a' },
				{ id: 'wall-e', start: 'm', end: 'n' }
			],
			rooms: [
				{
					id: 'left',
					name: 'Left',
					boundary: [
						{ wallId: 'wall-w1', direction: 'forward' },
						{ wallId: 'wall-w2', direction: 'forward' },
						{ wallId: 'wall-n1', direction: 'forward' },
						{ wallId: 'wall-e', direction: 'reverse' },
						{ wallId: 'wall-s2', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				},
				{
					id: 'right',
					name: 'Right',
					boundary: [
						{ wallId: 'wall-s1', direction: 'forward' },
						{ wallId: 'wall-e1', direction: 'forward' },
						{ wallId: 'wall-n2', direction: 'forward' },
						{ wallId: 'wall-e', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [
				{
					id: 'portal',
					wallId: 'wall-e',
					kind: 'door',
					offset: 1,
					width: 1,
					height: 2,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['left', 'right']
				}
			]
		});
		const plan = planDissolveJunction(document, 'w');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('wall-w1');
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['left', 'right']);
		expect(plan.document.walls.find((wall) => wall.id === 'wall-e')).toBeDefined();
		const portal = plan.document.openings.find((opening) => opening.id === 'portal')!;
		expect(portal.connectsRoomIds).toEqual(['left', 'right']);
		const left = plan.document.rooms.find((room) => room.id === 'left')!;
		// Reconciliation owns boundary reconstruction: the extractor emits its
		// own canonical winding, so assert the wall set (w2 folded into w1),
		// not ref order. The joined endpoints below pin the geometry.
		expect(left.boundary.map((ref) => ref.wallId).sort()).toEqual(
			['wall-e', 'wall-n1', 'wall-s2', 'wall-w1'].sort()
		);
		const joinedWest = plan.document.walls.find((wall) => wall.id === 'wall-w1')!;
		expect([joinedWest.startJunctionId, joinedWest.endJunctionId]).toEqual(['a', 'd']);
	});

	it('dissolves the shared wall itself, rehosting its door onto the survivor', () => {
		// Two rooms sharing wall-e, pre-split at S into wall-ea (m→S) +
		// wall-eb (S→n) with a door on the retiring fragment. Through-
		// configuration survivor is wall-ea; the door must ride the join.
		const document = buildDocument({
			junctions: [
				['a', 0, 0],
				['w', 0, 2],
				['d', 0, 4],
				['n', 3, 4],
				['c', 6, 4],
				['b', 6, 0],
				['m', 3, 0],
				['s', 3, 2]
			],
			walls: [
				{ id: 'wall-w1', start: 'a', end: 'w' },
				{ id: 'wall-w2', start: 'w', end: 'd' },
				{ id: 'wall-n1', start: 'd', end: 'n' },
				{ id: 'wall-n2', start: 'n', end: 'c' },
				{ id: 'wall-e1', start: 'c', end: 'b' },
				{ id: 'wall-s1', start: 'b', end: 'm' },
				{ id: 'wall-s2', start: 'm', end: 'a' },
				{ id: 'wall-ea', start: 'm', end: 's' },
				{ id: 'wall-eb', start: 's', end: 'n' }
			],
			rooms: [
				{
					id: 'left',
					name: 'Left',
					boundary: [
						{ wallId: 'wall-w1', direction: 'forward' },
						{ wallId: 'wall-w2', direction: 'forward' },
						{ wallId: 'wall-n1', direction: 'forward' },
						{ wallId: 'wall-eb', direction: 'reverse' },
						{ wallId: 'wall-ea', direction: 'reverse' },
						{ wallId: 'wall-s2', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				},
				{
					id: 'right',
					name: 'Right',
					boundary: [
						{ wallId: 'wall-s1', direction: 'forward' },
						{ wallId: 'wall-e1', direction: 'forward' },
						{ wallId: 'wall-n2', direction: 'forward' },
						{ wallId: 'wall-ea', direction: 'forward' },
						{ wallId: 'wall-eb', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [
				{
					id: 'portal',
					wallId: 'wall-eb',
					kind: 'door',
					offset: 0.5,
					width: 1,
					height: 2,
					sillHeight: 0,
					profile: 'rectangular',
					connectsRoomIds: ['left', 'right']
				}
			]
		});
		const plan = planDissolveJunction(document, 's');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('wall-ea');
		expect(plan.retiredWallId).toBe('wall-eb');
		expect(plan.retiredJunctionId).toBe('s');

		// Both rooms survive; the rejoined shared wall serves both faces in
		// opposite traversal directions (order-insensitive: winding is
		// reconciliation-owned — the extractor emits left forward / right
		// reverse here).
		expect(plan.document.rooms.map((room) => room.id).sort()).toEqual(['left', 'right']);
		const left = plan.document.rooms.find((room) => room.id === 'left')!;
		const right = plan.document.rooms.find((room) => room.id === 'right')!;
		expect(left.boundary).toContainEqual({ wallId: 'wall-ea', direction: 'forward' });
		expect(right.boundary).toContainEqual({ wallId: 'wall-ea', direction: 'reverse' });
		expect(left.boundary.some((ref) => ref.wallId === 'wall-eb')).toBe(false);
		expect(right.boundary.some((ref) => ref.wallId === 'wall-eb')).toBe(false);

		const joined = plan.document.walls.find((wall) => wall.id === 'wall-ea')!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['m', 'n']);
		expect(plan.document.walls.some((wall) => wall.id === 'wall-eb')).toBe(false);

		// wall-eb occupies [2,4] forward: offset' = 2 + 0.5 = 2.5 on the
		// 4-long survivor, portal relation intact.
		const portal = plan.document.openings.find((opening) => opening.id === 'portal')!;
		expect(portal.wallId).toBe('wall-ea');
		expect(portal.offset).toBeCloseTo(2.5, 12);
		expect(portal.connectsRoomIds).toEqual(['left', 'right']);
	});

	it('joins roomless partition walls with no rooms', () => {
		const document = buildDocument({
			junctions: [
				['A', 0, 0],
				['J', 2, 0],
				['B', 4, 0]
			],
			walls: [
				{ id: 'p1', start: 'A', end: 'J', role: 'partition' },
				{ id: 'p2', start: 'J', end: 'B', role: 'partition' }
			]
		});
		const plan = planDissolveJunction(document, 'J');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('p1');
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.walls).toHaveLength(1);
	});
});

describe('dissolve round trips', () => {
	function squareDocument(): LayoutDocumentWallFirst {
		return buildDocument({
			junctions: [
				['A', 0, 0],
				['B', 4, 0],
				['C', 4, 3],
				['D', 0, 3]
			],
			walls: [
				{ id: 'w1', start: 'A', end: 'B' },
				{ id: 'w2', start: 'B', end: 'C' },
				{ id: 'w3', start: 'C', end: 'D' },
				{ id: 'w4', start: 'D', end: 'A' }
			],
			rooms: [
				{
					id: 'room',
					name: 'Room',
					boundary: [
						{ wallId: 'w1', direction: 'forward' },
						{ wallId: 'w2', direction: 'forward' },
						{ wallId: 'w3', direction: 'forward' },
						{ wallId: 'w4', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [
				{
					id: 'door',
					wallId: 'w1',
					kind: 'door',
					offset: 2.5,
					width: 0.9,
					height: 2,
					sillHeight: 0,
					profile: 'rectangular'
				}
			]
		});
	}

	it('inverts a straight subdivision exactly, restoring the moved opening', () => {
		// Split at an inexact float distance so the junction carries genuine
		// double-rounding residue; the dissolve-local noise tolerance accepts it.
		const split = planWallSplit(squareDocument(), 'w1', 1.1, allocator);
		expect(split.kind).toBe('success');
		if (split.kind !== 'success') throw new Error('unreachable');

		const plan = planDissolveJunction(split.document, split.junctionId);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		expect(plan.survivorWallId).toBe('w1');
		const joined = plan.document.walls.find((wall) => wall.id === 'w1')!;
		expect([joined.startJunctionId, joined.endJunctionId]).toEqual(['A', 'B']);
		expect(joined.centerline).toEqual({ kind: 'line' });
		// The door rode the second fragment and returns to its authored offset.
		const door = plan.document.openings.find((opening) => opening.id === 'door')!;
		expect(door.wallId).toBe('w1');
		expect(door.offset).toBeCloseTo(2.5, 9);
		expect(plan.document.rooms[0]!.id).toBe('room');
	});

	it('every rejection leaves the input document unchanged', () => {
		const angled = splitRectDocument();
		const cases: Array<[LayoutDocumentWallFirst, string]> = [
			[splitRectDocument(), 'nope'],
			[splitRectDocument(), 'B'],
			[angled, 'M']
		];
		angled.walls.find((wall) => wall.id === 'w1b')!.thickness = 0.5;
		for (const [document, junctionId] of cases) {
			const before = JSON.stringify(document);
			const plan = planDissolveJunction(document, junctionId);
			expect(plan.kind).toBe('rejected');
			expect(JSON.stringify(document)).toBe(before);
		}
	});
});

describe('dissolve room tripwire and codec round trip', () => {
	it('rejects room_identity_lost when correspondence retires a room', () => {
		// Two rooms claiming the identical boundary cycle: the candidate face
		// reconciles by merge, retiring one room — the dissolve assert fires
		// instead of silently changing Room topology.
		const document = splitRectDocument();
		document.rooms.push({
			id: 'ghost',
			name: 'Ghost',
			boundary: document.rooms[0]!.boundary.map((ref) => ({ ...ref })),
			floorThickness: 0.1,
			ceilingThickness: 0.1
		});
		const before = JSON.stringify(document);
		const plan = planDissolveJunction(document, 'M');
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') throw new Error('unreachable');
		expect(plan.rejection.code).toBe('room_identity_lost');
		expect(JSON.stringify(document)).toBe(before);
	});

	it('a dissolved document round-trips through the canonical codec', () => {
		const plan = planDissolveJunction(splitRectDocument(), 'M');
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') throw new Error('unreachable');
		const revived = validateWallFirstLayoutDocument(
			JSON.parse(JSON.stringify(plan.document)) as unknown
		);
		expect(revived.success).toBe(true);
		if (!revived.success) throw new Error('unreachable');
		expect(revived.document.walls.map((wall) => wall.id).sort()).toEqual(
			['w1a', 'w2', 'w3', 'w4'].sort()
		);
		expect(revived.document.rooms.map((room) => room.id)).toEqual(['room']);
	});
});
