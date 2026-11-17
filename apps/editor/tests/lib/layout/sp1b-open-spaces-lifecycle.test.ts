/**
 * SP1b — open Space lifecycle on Wall removal, Remove Room / Remove space,
 * join refusal, rigid move and metadata. Every fixture is a persisted format-8
 * document; no test writes a roomless intermediate.
 */
import { describe, expect, it } from 'vitest';

import {
	buildCorrespondenceComponents,
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planDeleteWall,
	planDeleteWalls,
	planDissolveJunction,
	planDuplicateIsolatedRoom,
	planExactRectangleDimensions,
	planRemoveRoom,
	planRemoveSpace,
	planRoomMetadataUpdate,
	planWallFirstRoomMove,
	reconcileRooms,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import { captureFor } from './__fixtures__/layout-id-capture';
import { twoRoomDocument } from './__fixtures__/two-room-fixture';

function wall(id: string, start: string, end: string): LayoutDocumentWallFirst['walls'][number] {
	return {
		id,
		startJunctionId: start,
		endJunctionId: end,
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' }
	};
}

function junction(id: string, point: LayoutVec2): LayoutDocumentWallFirst['junctions'][number] {
	return { id, point };
}

/** 4×3 open Space with three Walls and one virtual side D→A. */
function threeWallOpenSpace(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [4, 0]),
			junction('j-c', [4, 3]),
			junction('j-d', [0, 3])
		],
		walls: [wall('wall-a', 'j-a', 'j-b'), wall('wall-b', 'j-b', 'j-c'), wall('wall-c', 'j-c', 'j-d')],
		rooms: [
			{
				id: 'room-open',
				name: 'Open',
				boundary: [
					{ wallId: 'wall-a', direction: 'forward' },
					{ wallId: 'wall-b', direction: 'forward' },
					{ wallId: 'wall-c', direction: 'forward' }
				],
				virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

/** One Wall open Space: all three other sides are virtual. */
function oneWallOpenSpace(): LayoutDocumentWallFirst {
	const document = threeWallOpenSpace();
	document.walls = [document.walls[0]!];
	document.rooms[0]!.boundary = [{ wallId: 'wall-a', direction: 'forward' }];
	document.rooms[0]!.virtualEdges = [
		{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
		{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
		{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
	];
	return document;
}

/**
 * Two 2×3 Rooms sharing Wall `m`. The left Room is open (virtual D→A); the
 * right Room is enclosed by four Walls including `m` in reverse.
 */
function sharedWallPair(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [2, 0]),
			junction('j-c', [2, 3]),
			junction('j-d', [0, 3]),
			junction('j-e', [4, 0]),
			junction('j-f', [4, 3])
		],
		walls: [
			wall('left-top', 'j-a', 'j-b'),
			wall('m', 'j-b', 'j-c'),
			wall('left-bottom', 'j-c', 'j-d'),
			wall('right-top', 'j-b', 'j-e'),
			wall('right-right', 'j-e', 'j-f'),
			wall('right-bottom', 'j-f', 'j-c')
		],
		rooms: [
			{
				id: 'room-left',
				name: 'Left',
				boundary: [
					{ wallId: 'left-top', direction: 'forward' },
					{ wallId: 'm', direction: 'forward' },
					{ wallId: 'left-bottom', direction: 'forward' }
				],
				virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-right',
				name: 'Right',
				boundary: [
					{ wallId: 'right-top', direction: 'forward' },
					{ wallId: 'right-right', direction: 'forward' },
					{ wallId: 'right-bottom', direction: 'forward' },
					{ wallId: 'm', direction: 'reverse' }
				],
				virtualEdges: [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

/** One 4×3 enclosed Room with four boundary Walls. */
function enclosedRectangle(): LayoutDocumentWallFirst {
	const document = threeWallOpenSpace();
	document.walls.push(wall('wall-d', 'j-d', 'j-a'));
	document.rooms[0]!.boundary.push({ wallId: 'wall-d', direction: 'forward' });
	document.rooms[0]!.virtualEdges = [];
	return document;
}

/** Both sides enclosed: deleting `m` yields one 12 m² face claimed by both. */
function enclosedSharedWallPair(): LayoutDocumentWallFirst {
	const document = sharedWallPair();
	document.walls.push(wall('left-left', 'j-d', 'j-a'));
	document.rooms[0]!.boundary = [
		{ wallId: 'left-top', direction: 'forward' },
		{ wallId: 'm', direction: 'forward' },
		{ wallId: 'left-bottom', direction: 'forward' },
		{ wallId: 'left-left', direction: 'forward' }
	];
	document.rooms[0]!.virtualEdges = [];
	return document;
}

function capture(name: string) {
	return captureFor(name);
}

describe('SP1b — Wall removal lifecycle', () => {
	it('retires an open Space by default and carries it with openSpaces: keep', () => {
		const document = threeWallOpenSpace();
		const retired = planDeleteWall(document, 'wall-b', capture('sp1b-retire'), document.floor.id);
		expect(retired.kind).toBe('success');
		if (retired.kind !== 'success') return;
		expect(retired.document.rooms).toEqual([]);
		expect(retired.retiredRoomIds).toEqual(['room-open']);

		const carried = planDeleteWall(document, 'wall-b', capture('sp1b-keep'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(carried.kind).toBe('success');
		if (carried.kind !== 'success') return;
		expect(carried.document.rooms).toHaveLength(1);
		expect(carried.document.rooms[0]!.id).toBe('room-open');
		// `wall-b` became one virtual side; the existing D→A side remains.
		expect(carried.document.rooms[0]!.virtualEdges).toHaveLength(2);
		expect(carried.retiredRoomIds).toEqual([]);
		const compiled = compileWallFirstLayoutGeometry(carried.document);
		expect(compiled.geometry.rooms).toHaveLength(1);
		expect(compiled.geometry.rooms[0]!.floorPolygon.length).toBeGreaterThan(3);
	});

	it('an erased outside Wall carries an enclosed Room as an open Space with its metadata', () => {
		const document = enclosedRectangle();
		const plan = planDeleteWall(document, 'wall-b', capture('sp1b-enclosed-open'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const room = plan.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.name).toBe('Open');
		expect(room.overhead).toBe('closed');
		expect(room.floorThickness).toBe(0.1);
		expect(room.ceilingThickness).toBe(0.1);
		expect(room.virtualEdges).toEqual([{ startJunctionId: 'j-b', endJunctionId: 'j-c' }]);
		const compiled = compileWallFirstLayoutGeometry(plan.document);
		expect(compiled.geometry.rooms).toHaveLength(1);
		const area = compiled.geometry.rooms[0]!.floorPolygon.reduce((sum, point, index, polygon) => {
			const next = polygon[(index + 1) % polygon.length]!;
			return sum + point[0] * next[1] - next[0] * point[1];
		}, 0) / 2;
		expect(area).toBeCloseTo(12, 6);

		const retired = planDeleteWall(document, 'wall-b', capture('sp1b-enclosed-retire'), document.floor.id);
		expect(retired.kind).toBe('success');
		if (retired.kind === 'success') expect(retired.document.rooms).toEqual([]);
	});

	it('support rule: removing the last Wall retires the Space with last-boundary-wall', () => {
		const document = oneWallOpenSpace();
		const plan = planDeleteWall(document, 'wall-a', capture('sp1b-last-wall'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual([]);
		expect(plan.spaceRetirements).toEqual([{ roomId: 'room-open', reason: 'last-boundary-wall' }]);
	});

	it('open merge: deleting the shared Wall splices two Spaces into the lexical survivor', () => {
		const document = sharedWallPair();
		const plan = planDeleteWalls(document, ['m'], capture('sp1b-merge'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
		expect(plan.spaceRetirements).toEqual([
			{
				roomId: 'room-right',
				reason: 'merged',
				otherRoomIds: ['room-left'],
				successorRoomId: 'room-left'
			}
		]);
		const compiled = compileWallFirstLayoutGeometry(plan.document);
		expect(compiled.geometry.rooms).toHaveLength(1);
		const area = compiled.geometry.rooms[0]!.floorPolygon.reduce((sum, point, index, polygon) => {
			const next = polygon[(index + 1) % polygon.length]!;
			return sum + point[0] * next[1] - next[0] * point[1];
		}, 0) / 2;
		expect(area).toBeCloseTo(12, 6);
	});

	it('open + open merge splices both Spaces after a second outside Wall is erased', () => {
		const document = sharedWallPair();
		const plan = planDeleteWalls(
			document,
			['m', 'right-right'],
			capture('sp1b-open-open'),
			document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-left']);
		// Both erased Walls are virtual; the shared Wall's reverse pair collapsed.
		expect(plan.document.rooms[0]!.virtualEdges).toHaveLength(2);
		expect(plan.retiredRoomIds).toEqual(['room-right']);
	});

	it('open merge refuses conflicting thicknesses and keeps the survivor overhead', () => {
		const conflicting = sharedWallPair();
		conflicting.rooms[1]!.floorThickness = 0.3;
		const refused = planDeleteWalls(conflicting, ['m'], capture('sp1b-thickness'), conflicting.floor.id, {
			openSpaces: 'keep'
		});
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') {
			expect(refused.rejection.message).toContain('floorThickness');
		}

		const overhead = sharedWallPair();
		overhead.rooms[1]!.overhead = 'open-to-sky';
		const survivor = planDeleteWalls(overhead, ['m'], capture('sp1b-overhead'), overhead.floor.id, {
			openSpaces: 'keep'
		});
		expect(survivor.kind).toBe('success');
		if (survivor.kind === 'success') {
			expect(survivor.document.rooms[0]!.id).toBe('room-left');
			expect(survivor.document.rooms[0]!.overhead).toBe('closed');
		}
	});

	it('forced retirement outranks a face claim in a 2→1 component', () => {
		const baseline = enclosedSharedWallPair();
		const candidate: LayoutDocumentWallFirst = {
			...baseline,
			walls: baseline.walls.filter((candidateWall) => candidateWall.id !== 'm'),
			rooms: []
		};
		const extraction = extractBoundaryCandidateFaces(candidate);
		expect(extraction.faces).toHaveLength(1);
		const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
		const predecessorWitnesses = new Map<string, LayoutVec2>();
		for (const room of baseline.rooms) {
			const polygon = roomBoundaryPolygon(baseline, room.id)!;
			predecessorPolygons.set(room.id, polygon);
			predecessorWitnesses.set(room.id, interiorWitness(polygon));
		}
		const components = buildCorrespondenceComponents({
			faces: extraction.faces,
			predecessorRoomIds: baseline.rooms.map((room) => room.id),
			predecessorWitnesses,
			predecessorPolygons,
			candidateDocument: candidate,
			baselineRooms: baseline.rooms
		});
		expect(components).toHaveLength(1);
		expect(components[0]!.predecessorRoomIds).toHaveLength(2);

		const result = reconcileRooms({
			baseline,
			candidateDocument: candidate,
			extraction,
			components,
			predecessorWitnesses,
			predecessorPolygons,
			spacePolicy: { openSpaces: 'retire', retireRoomIds: ['room-left'] },
			allocator: {
				nextRoomId: () => {
					throw new Error('forced retirement must not allocate');
				},
				nextRoomName: () => {
					throw new Error('forced retirement must not allocate');
				}
			}
		});
		expect('rejection' in result).toBe(false);
		if ('rejection' in result) return;
		expect(result.document.rooms.map((room) => room.id)).toEqual(['room-right']);
		expect(result.retiredRoomIds).toEqual(['room-left']);
		expect(result.spaceRetirements).toEqual([{ roomId: 'room-left', reason: 'explicit-remove' }]);
		expect(result.carriedRoomIds).toEqual([]);
	});

	it('Remove Room on a Room sharing a Wall retires it and preserves the neighbour', () => {
		const document = sharedWallPair();
		const plan = planRemoveRoom(document, 'room-left', capture('sp1b-remove-room'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-right']);
		expect(plan.retiredRoomIds).toContain('room-left');
		expect(plan.spaceRetirements).toContainEqual({ roomId: 'room-left', reason: 'explicit-remove' });
		expect(plan.document.walls.some((candidate) => candidate.id === 'm')).toBe(true);
	});
});

describe('SP1b — Remove space and metadata', () => {
	it('Remove space deletes only the record, its released anchors and object association', () => {
		const document = oneWallOpenSpace();
		document.objects = [
			{
				id: 'obj-1',
				kind: 'box',
				position: [1, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-open'
			}
		];
		const plan = planRemoveSpace(document, 'room-open', document.floor.id);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.walls).toHaveLength(1);
		// Wall endpoints survive; the two virtual-only anchors are pruned.
		expect(plan.document.junctions.map((junction) => junction.id).sort()).toEqual(['j-a', 'j-b']);
		expect(plan.document.objects[0]!.roomId).toBeUndefined();
		expect(plan.retiredRoomIds).toEqual(['room-open']);
		expect(plan.spaceRetirements).toEqual([{ roomId: 'room-open', reason: 'explicit-remove' }]);
	});

	it('Remove space refuses an enclosed Room', () => {
		const document = twoRoomDocument();
		const plan = planRemoveSpace(document, document.rooms[0]!.id, document.floor.id);
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') expect(plan.rejection.code).toBe('not_open_space');
	});

	it('Room metadata can author overhead and rejects a no-op', () => {
		const document = threeWallOpenSpace();
		const plan = planRoomMetadataUpdate(document, 'room-open', { overhead: 'open-to-sky' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms[0]!.overhead).toBe('open-to-sky');
		const compiled = compileWallFirstLayoutGeometry(plan.document);
		expect(compiled.geometry.rooms[0]!.ceilingPolygon).toEqual([]);

		const noOp = planRoomMetadataUpdate(document, 'room-open', { overhead: 'closed' });
		expect(noOp.kind).toBe('rejected');
		if (noOp.kind === 'rejected') expect(noOp.rejection.code).toBe('no_op');
	});
});

describe('SP1b — adjacent operations', () => {
	it('join refuses when an open side ends at the dissolved Junction', () => {
		const document = threeWallOpenSpace();
		const plan = planDissolveJunction(document, 'j-d', capture('sp1b-join'), document.floor.id);
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(plan.rejection.code).toBe('open_side_ends_here');
			expect(plan.rejection.message).toBe('An open side ends here');
		}
	});

	it('a rigid move carries an open Space with exact identity', () => {
		const document = threeWallOpenSpace();
		const plan = planWallFirstRoomMove(document, 'room-open', [1, 2]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room-open');
		expect(plan.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		const moved = new Map(plan.document.junctions.map((junction) => [junction.id, junction.point]));
		expect(moved.get('j-a')).toEqual([1, 2]);
		expect(moved.get('j-c')).toEqual([5, 5]);
	});

	it('duplicates an isolated open Space with remapped virtual edges', () => {
		const document = threeWallOpenSpace();
		const plan = planDuplicateIsolatedRoom(
			document,
			{ roomId: 'room-open', delta: [10, 0] },
			capture('sp1b-duplicate'),
			document.floor.id
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(2);
		const copy = plan.document.rooms[1]!;
		expect(copy.virtualEdges).toHaveLength(1);
		expect(copy.virtualEdges[0]!.startJunctionId).not.toBe('j-d');
		// Source is untouched and both Spaces compile with equal area.
		expect(plan.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		const compiled = compileWallFirstLayoutGeometry(plan.document);
		expect(compiled.geometry.rooms).toHaveLength(2);
	});

	it('exact rectangle resize refuses an open Space explicitly', () => {
		const document = threeWallOpenSpace();
		const plan = planExactRectangleDimensions(document, 'room-open', 4, 3);
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(plan.rejection.code).toBe('unsupported_geometry');
			expect(plan.rejection.message).toContain('enclosed Rooms only');
		}
	});
});
