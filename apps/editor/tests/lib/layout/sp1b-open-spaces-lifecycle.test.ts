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
	deriveChainSpans,
	extractBoundaryCandidateFaces,
	interiorWitness,
	planDeleteWall,
	planDeleteWalls,
	planDissolveJunction,
	planDuplicateIsolatedRoom,
	planExactJunctionMove,
	planExactRectangleDimensions,
	planRemoveRoom,
	planRemoveSpace,
	planRoomMetadataUpdate,
	planWallChain,
	planWallFirstRoomMove,
	planWallFirstRoomRotation,
	planWallSubdivision,
	reconcileRooms,
	roomBoundaryPolygon,
	serializeWallFirstLayoutDocument,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type NodingIdAllocator
} from '@portfolio/layout-core';
import { AuthoringHistory, type HistoryState } from '$lib/authoring/f4/history';
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

function historyState(
	document: LayoutDocumentWallFirst,
	operationId: string
): HistoryState<LayoutDocumentWallFirst> {
	return {
		source: document,
		canonicalJson: serializeWallFirstLayoutDocument(document),
		sourceContentId: `sp1b:${operationId}`,
		operationId,
		blockingIssues: [],
		correspondence: []
	};
}

/**
 * B1 fixture: one enclosed Room whose curved south Wall dips below a deep
 * north notch. The authored curve is a simple outline; the straight chord that
 * replaces it on erase crosses both notch Walls, so destructive erase and a
 * non-erase edit reach the same self-crossing predicate.
 */
function curvedChasmRoom(): LayoutDocumentWallFirst {
	const points = {
		'j-a': [0, 0],
		'j-b': [8, 0],
		'j-c': [8, 6],
		'j-d': [5, 6],
		'j-e': [5, -1],
		'j-f': [3, -1],
		'j-g': [3, 6],
		'j-h': [0, 6]
	} as const satisfies Record<string, LayoutVec2>;
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: Object.entries(points).map(([id, point]) => junction(id, point)),
		walls: [
			{
				id: 'wall-curved',
				startJunctionId: 'j-a',
				endJunctionId: 'j-b',
				thickness: 0.2,
				height: 3,
				centerline: wallCubicChain(
					[{ id: 'wall-curved:knot:1', point: [4, -2] }],
					deriveChainSpans([points['j-a'], [4, -2], points['j-b']])
				)
			},
			wall('wall-bc', 'j-b', 'j-c'),
			wall('wall-cd', 'j-c', 'j-d'),
			wall('wall-de', 'j-d', 'j-e'),
			wall('wall-ef', 'j-e', 'j-f'),
			wall('wall-fg', 'j-f', 'j-g'),
			wall('wall-gh', 'j-g', 'j-h'),
			wall('wall-ha', 'j-h', 'j-a')
		],
		rooms: [
			{
				id: 'room-chasm',
				name: 'Chasm',
				boundary: [
					'wall-curved',
					'wall-bc',
					'wall-cd',
					'wall-de',
					'wall-ef',
					'wall-fg',
					'wall-gh',
					'wall-ha'
				].map((wallId) => ({ wallId, direction: 'forward' as const })),
				virtualEdges: [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

/**
 * The same chasm Walls as {@link curvedChasmRoom}, but open with an A→X→B
 * detour around the notch. Dragging X onto the A–B chord reproduces exactly
 * the outline the erase's straight chord would produce.
 */
function curvedChasmOpenDetour(): LayoutDocumentWallFirst {
	const document = curvedChasmRoom();
	document.junctions.push(junction('j-x', [4, -2]));
	document.walls = document.walls.filter((candidate) => candidate.id !== 'wall-curved');
	document.rooms[0]!.boundary = document.rooms[0]!.boundary.filter(
		(ref) => ref.wallId !== 'wall-curved'
	);
	document.rooms[0]!.virtualEdges = [
		{ startJunctionId: 'j-a', endJunctionId: 'j-x' },
		{ startJunctionId: 'j-x', endJunctionId: 'j-b' }
	];
	return document;
}

/** A separate open Space plus a pre-existing unreferenced Junction. */
function distantOpenSpaceAndStrayJunction(): LayoutDocumentWallFirst {
	const document = enclosedRectangle();
	document.junctions.push(
		junction('j-p', [20, 0]),
		junction('j-q', [24, 0]),
		junction('j-r', [24, 3]),
		junction('j-s', [20, 3]),
		junction('j-stray', [50, 50])
	);
	document.walls.push(wall('b-wall', 'j-p', 'j-q'));
	document.rooms.push({
		id: 'room-open-b',
		name: 'Open B',
		boundary: [{ wallId: 'b-wall', direction: 'forward' }],
		virtualEdges: [
			{ startJunctionId: 'j-q', endJunctionId: 'j-r' },
			{ startJunctionId: 'j-r', endJunctionId: 'j-s' },
			{ startJunctionId: 'j-s', endJunctionId: 'j-p' }
		],
		overhead: 'closed',
		floorThickness: 0.1,
		ceilingThickness: 0.1
	});
	return document;
}

function expectNoOrphanAnchors(document: LayoutDocumentWallFirst, allowed: readonly string[]): void {
	const referenced = new Set<string>();
	for (const candidate of document.walls) {
		referenced.add(candidate.startJunctionId);
		referenced.add(candidate.endJunctionId);
	}
	for (const room of document.rooms) {
		for (const edge of room.virtualEdges) {
			referenced.add(edge.startJunctionId);
			referenced.add(edge.endJunctionId);
		}
	}
	const orphans = document.junctions
		.filter((candidate) => !referenced.has(candidate.id) && !allowed.includes(candidate.id))
		.map((candidate) => candidate.id);
	expect(orphans).toEqual([]);
}

/** Three open-ish 2×3 rectangles in a row sharing m1 and m2. */
/** Signed area of each compiled floor polygon, in compiled Room order. */
function compiledFloorAreas(document: LayoutDocumentWallFirst): number[] {
	const compiled = compileWallFirstLayoutGeometry(document);
	return compiled.geometry.rooms.map(
		(room) =>
			room.floorPolygon.reduce((sum, point, index, polygon) => {
				const next = polygon[(index + 1) % polygon.length]!;
				return sum + point[0] * next[1] - next[0] * point[1];
			}, 0) / 2
	);
}

/**
 * Two open Spaces with coincident boundary edges but no shared ownership: the
 * west Space states an authored virtual edge exactly along the east Space's
 * `shared` Wall. Erasing that Wall must carry each Space on its own provenance
 * and never splice by endpoint coincidence.
 */
function coincidentVirtualSidePair(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-west-bottom', [0, 0]),
			junction('j-west-top', [0, 3]),
			junction('j-shared-bottom', [2, 0]),
			junction('j-shared-top', [2, 3]),
			junction('j-east-bottom', [4, 0]),
			junction('j-east-top', [4, 3])
		],
		walls: [
			wall('west-edge', 'j-west-top', 'j-west-bottom'),
			wall('shared', 'j-shared-top', 'j-shared-bottom'),
			wall('east-edge', 'j-east-bottom', 'j-east-top')
		],
		rooms: [
			{
				id: 'room-west',
				name: 'West',
				boundary: [{ wallId: 'west-edge', direction: 'forward' }],
				virtualEdges: [
					{ startJunctionId: 'j-west-bottom', endJunctionId: 'j-shared-bottom' },
					{ startJunctionId: 'j-shared-bottom', endJunctionId: 'j-shared-top' },
					{ startJunctionId: 'j-shared-top', endJunctionId: 'j-west-top' }
				],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-east',
				name: 'East',
				boundary: [
					{ wallId: 'east-edge', direction: 'forward' },
					{ wallId: 'shared', direction: 'forward' }
				],
				virtualEdges: [
					{ startJunctionId: 'j-east-top', endJunctionId: 'j-shared-top' },
					{ startJunctionId: 'j-shared-bottom', endJunctionId: 'j-east-bottom' }
				],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

function threeRoomRow(): LayoutDocumentWallFirst {
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: [
			junction('j-a', [0, 0]),
			junction('j-b', [2, 0]),
			junction('j-c', [2, 3]),
			junction('j-d', [0, 3]),
			junction('j-e', [4, 0]),
			junction('j-f', [4, 3]),
			junction('j-g', [6, 0]),
			junction('j-h', [6, 3])
		],
		walls: [
			wall('b0', 'j-a', 'j-b'),
			wall('m1', 'j-b', 'j-c'),
			wall('t0', 'j-c', 'j-d'),
			wall('b1', 'j-b', 'j-e'),
			wall('m2', 'j-e', 'j-f'),
			wall('t1', 'j-f', 'j-c'),
			wall('b2', 'j-e', 'j-g'),
			wall('right', 'j-g', 'j-h'),
			wall('t2', 'j-h', 'j-f')
		],
		rooms: [
			{
				id: 'room-left',
				name: 'Left',
				boundary: [
					{ wallId: 'b0', direction: 'forward' },
					{ wallId: 'm1', direction: 'forward' },
					{ wallId: 't0', direction: 'forward' }
				],
				virtualEdges: [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-middle',
				name: 'Middle',
				boundary: [
					{ wallId: 'b1', direction: 'forward' },
					{ wallId: 'm2', direction: 'forward' },
					{ wallId: 't1', direction: 'forward' },
					{ wallId: 'm1', direction: 'reverse' }
				],
				virtualEdges: [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			},
			{
				id: 'room-right',
				name: 'Right',
				boundary: [
					{ wallId: 'b2', direction: 'forward' },
					{ wallId: 'right', direction: 'forward' },
					{ wallId: 't2', direction: 'forward' },
					{ wallId: 'm2', direction: 'reverse' }
				],
				virtualEdges: [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
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

	it('carries a Space whose FIRST boundary Wall was erased', () => {
		const document = threeWallOpenSpace();
		const plan = planDeleteWall(document, 'wall-a', capture('sp1b-first-wall'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual(['wall-b', 'wall-c']);
		expect(plan.document.rooms[0]!.virtualEdges).toHaveLength(2);
		expect(plan.retiredRoomIds).toEqual([]);
	});

	it('carries a Space after opposite boundary Walls are erased together', () => {
		const document = enclosedRectangle();
		const plan = planDeleteWalls(document, ['wall-a', 'wall-c'], capture('sp1b-opposite'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId).sort()).toEqual([
			'wall-b',
			'wall-d'
		]);
		expect(plan.document.rooms[0]!.virtualEdges).toHaveLength(2);
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

	it('a removal set that would join three Spaces refuses as a whole', () => {
		const document = threeRoomRow();
		const plan = planDeleteWalls(document, ['m1', 'm2'], capture('sp1b-three-join'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind === 'rejected') {
			expect(plan.rejection.message).toContain('joining three or more is unsupported');
		}
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
	it('a merged Space that then retires clears the object instead of remapping to a missing Room', () => {
		const document = sharedWallPair();
		document.objects = [
			{
				id: 'obj-1',
				kind: 'box',
				position: [1, 0, 1],
				rotation: [0, 0, 0],
				dimensions: [1, 1, 1],
				roomId: 'room-left'
			}
		];
		const plan = planDeleteWalls(
			document,
			document.walls.map((candidate) => candidate.id),
			capture('sp1b-all-walls'),
			document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.objects[0]!.roomId).toBeUndefined();
	});

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

describe('SP1b — §5.2 acceptance', () => {
	it('B1 vs §5.4: a self-crossing outline retires on erase and refuses a Junction move', () => {
		const document = curvedChasmRoom();
		const baselineJson = serializeWallFirstLayoutDocument(document);

		const erased = planDeleteWall(document, 'wall-curved', capture('sp1b-b1-erase'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(erased.kind).toBe('success');
		if (erased.kind !== 'success') return;
		expect(erased.document.walls.some((candidate) => candidate.id === 'wall-curved')).toBe(false);
		expect(erased.document.rooms).toEqual([]);
		expect(erased.spaceRetirements).toEqual([
			{ roomId: 'room-chasm', reason: 'outline-self-intersects' }
		]);
		expectNoOrphanAnchors(erased.document, []);

		// The same chord reached by a non-erase edit is an atomic refusal: drag the
		// open detour's virtual Junction X onto the A–B line.
		const moveBaseline = curvedChasmOpenDetour();
		const moveBaselineJson = serializeWallFirstLayoutDocument(moveBaseline);
		const moveHistory = new AuthoringHistory(historyState(moveBaseline, 'baseline'));
		const moved = planExactJunctionMove(moveBaseline, 'j-x', [4, 0]);
		expect(moved.kind).toBe('rejected');
		if (moved.kind !== 'rejected') return;
		expect(moved.rejection.code).toBe('space_outline_invalid');
		expect(moved.rejection.message).toContain("Space 'Chasm'");
		expect(moved.rejection.message).toContain('crosses itself');
		// Nothing was written and a refusal adds no history entry.
		expect(serializeWallFirstLayoutDocument(moveBaseline)).toBe(moveBaselineJson);
		expect(moveHistory.depth).toBe(1);
		// B1's destructive route did erase the Wall (the creator never loses the erase).
		expect(serializeWallFirstLayoutDocument(document)).toBe(baselineJson);
	});

	it('I8: erase → open → last Wall → Remove space leaves no orphan anchor and spares an unrelated Junction', () => {
		const document = distantOpenSpaceAndStrayJunction();
		expectNoOrphanAnchors(document, ['j-stray']);

		const opened = planDeleteWall(document, 'wall-b', capture('sp1b-i8-open'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(opened.kind).toBe('success');
		if (opened.kind !== 'success') return;
		expect(opened.document.rooms.map((room) => room.id)).toEqual(['room-open', 'room-open-b']);
		expectNoOrphanAnchors(opened.document, ['j-stray']);

		// Erase the rest of the first Space's boundary: the support rule retires it.
		const lastWall = planDeleteWalls(
			opened.document,
			['wall-a', 'wall-c', 'wall-d'],
			capture('sp1b-i8-last'),
			opened.document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(lastWall.kind).toBe('success');
		if (lastWall.kind !== 'success') return;
		expect(lastWall.document.rooms.map((room) => room.id)).toEqual(['room-open-b']);
		expect(lastWall.spaceRetirements).toContainEqual({
			roomId: 'room-open',
			reason: 'last-boundary-wall'
		});
		expect(lastWall.document.junctions.some((candidate) => candidate.id === 'j-stray')).toBe(true);
		expectNoOrphanAnchors(lastWall.document, ['j-stray']);

		// Remove space releases only the second Space's virtual anchors.
		const removed = planRemoveSpace(lastWall.document, 'room-open-b', lastWall.document.floor.id);
		expect(removed.kind).toBe('success');
		if (removed.kind !== 'success') return;
		expect(removed.document.junctions.map((candidate) => candidate.id).sort()).toEqual([
			'j-p',
			'j-q',
			'j-stray'
		]);
		expect(removed.document.junctions.some((candidate) => candidate.id === 'j-stray')).toBe(true);
		expectNoOrphanAnchors(removed.document, ['j-stray']);
	});

	it('Undo/Redo restores exact canonical bytes through erase → open → redraw', () => {
		const baseline = enclosedRectangle();
		const eraseCapture = capture('sp1b-history-erase');
		const redrawCapture = capture('sp1b-history-redraw');
		const erased = planDeleteWall(baseline, 'wall-b', eraseCapture, baseline.floor.id, {
			openSpaces: 'keep'
		});
		expect(erased.kind).toBe('success');
		if (erased.kind !== 'success') return;
		const redrawn = planWallChain({
			baseline: erased.document,
			points: [
				[4, 0],
				[4, 3]
			],
			close: false,
			capture: redrawCapture,
			levelId: erased.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-c' }
			]
		});
		expect(redrawn.kind).toBe('success');
		if (redrawn.kind !== 'success') return;
		expect(redrawn.document.rooms.map((room) => room.id)).toEqual(['room-open']);
		expect(redrawn.document.rooms[0]!.virtualEdges).toEqual([]);

		const history = new AuthoringHistory(historyState(baseline, 'baseline'));
		history.push(historyState(erased.document, 'erase'));
		history.push(historyState(redrawn.document, 'redraw'));
		const baselineJson = historyState(baseline, 'baseline').canonicalJson;
		const erasedJson = historyState(erased.document, 'erase').canonicalJson;
		const redrawnJson = historyState(redrawn.document, 'redraw').canonicalJson;

		expect(serializeWallFirstLayoutDocument(history.current.source)).toBe(redrawnJson);
		history.undo();
		expect(serializeWallFirstLayoutDocument(history.current.source)).toBe(erasedJson);
		history.undo();
		expect(serializeWallFirstLayoutDocument(history.current.source)).toBe(baselineJson);
		history.redo();
		expect(serializeWallFirstLayoutDocument(history.current.source)).toBe(erasedJson);
		history.redo();
		expect(serializeWallFirstLayoutDocument(history.current.source)).toBe(redrawnJson);

		// Replay with the same captures is byte-identical.
		const replayErase = planDeleteWall(baseline, 'wall-b', eraseCapture, baseline.floor.id, {
			openSpaces: 'keep'
		});
		expect(replayErase.kind).toBe('success');
		if (replayErase.kind !== 'success') return;
		const replayRedraw = planWallChain({
			baseline: replayErase.document,
			points: [
				[4, 0],
				[4, 3]
			],
			close: false,
			capture: redrawCapture,
			levelId: replayErase.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-c' }
			]
		});
		expect(replayRedraw.kind).toBe('success');
		if (replayRedraw.kind !== 'success') return;
		expect(serializeWallFirstLayoutDocument(replayRedraw.document)).toBe(redrawnJson);

		// A different capture keeps the Space but derives different new Wall ids.
		const alternate = planWallChain({
			baseline: replayErase.document,
			points: [
				[4, 0],
				[4, 3]
			],
			close: false,
			capture: capture('sp1b-history-redraw-alt'),
			levelId: replayErase.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 1, junctionId: 'j-c' }
			]
		});
		expect(alternate.kind).toBe('success');
		if (alternate.kind !== 'success') return;
		expect(alternate.document.rooms.map((room) => room.id)).toEqual(['room-open']);
		expect(alternate.document.rooms[0]!.virtualEdges).toEqual([]);
		expect(serializeWallFirstLayoutDocument(alternate.document)).not.toBe(redrawnJson);
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

	it('splits a boundary Wall of an open Space without losing identity or virtual edges', () => {
		const document = threeWallOpenSpace();
		const allocator: NodingIdAllocator = {
			nextWallId: (_document, seed) => `${seed}-split`,
			nextJunctionId: (_document, seed) => `${seed}-split-junction`
		};
		const plan = planWallSubdivision(document, 'wall-b', 1.5, allocator);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room-open');
		expect(plan.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		expect(plan.document.rooms[0]!.boundary).toHaveLength(4);
	});

	it('joins two boundary Walls away from a virtual end and keeps the Space', () => {
		const document = threeWallOpenSpace();
		// wall-b and wall-c meet at j-c; give b a midpoint so the junction is degree 2.
		document.junctions.push(junction('j-mid', [4, 1.5]));
		document.walls = document.walls.filter((candidate) => candidate.id !== 'wall-b');
		document.walls.push(wall('wall-b1', 'j-b', 'j-mid'), wall('wall-b2', 'j-mid', 'j-c'));
		document.rooms[0]!.boundary = [
			{ wallId: 'wall-a', direction: 'forward' },
			{ wallId: 'wall-b1', direction: 'forward' },
			{ wallId: 'wall-b2', direction: 'forward' },
			{ wallId: 'wall-c', direction: 'forward' }
		];
		const plan = planDissolveJunction(document, 'j-mid', capture('sp1b-join-mid'), document.floor.id);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room-open');
		expect(plan.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
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

describe('SP1b — open merge provenance', () => {
	it('coincident virtual edges do not splice two Spaces on a deleted Wall', () => {
		const document = coincidentVirtualSidePair();
		const plan = planDeleteWall(document, 'shared', capture('sp1b-coincident'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.walls.some((candidate) => candidate.id === 'shared')).toBe(false);
		// Ownership is the deleted Wall itself, never the endpoint pair: both
		// Spaces survive with their own ids and no merge retirement.
		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-west', 'room-east']);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.spaceRetirements).toEqual([]);
		const west = plan.document.rooms.find((room) => room.id === 'room-west')!;
		const east = plan.document.rooms.find((room) => room.id === 'room-east')!;
		expect(west).toEqual(document.rooms.find((room) => room.id === 'room-west'));
		expect(east.virtualEdges).toEqual([
			{ startJunctionId: 'j-east-top', endJunctionId: 'j-shared-top' },
			{ startJunctionId: 'j-shared-top', endJunctionId: 'j-shared-bottom' },
			{ startJunctionId: 'j-shared-bottom', endJunctionId: 'j-east-bottom' }
		]);
		expect(
			plan.document.rooms.some((room) => room.boundary.some((ref) => ref.wallId === 'shared'))
		).toBe(false);
		expect(compiledFloorAreas(plan.document).sort((a, b) => a - b)).toEqual([6, 6]);
	});
});

describe('SP1b — §5.1 transition matrix', () => {
	it('erasing a second outside Wall adjacent keeps the corner anchor and one open side', () => {
		const document = enclosedRectangle();
		const first = planDeleteWall(document, 'wall-a', capture('sp1b-adjacent-first'), document.floor.id, {
			openSpaces: 'keep'
		});
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		const second = planDeleteWall(
			first.document,
			'wall-b',
			capture('sp1b-adjacent-second'),
			first.document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		const room = second.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.virtualEdges).toEqual([
			{ startJunctionId: 'j-a', endJunctionId: 'j-b' },
			{ startJunctionId: 'j-b', endJunctionId: 'j-c' }
		]);
		// The corner Junction survives with no Wall of its own.
		expect(second.document.junctions.some((candidate) => candidate.id === 'j-b')).toBe(true);
		expect(
			second.document.walls.some(
				(candidate) => candidate.id === 'wall-a' || candidate.id === 'wall-b'
			)
		).toBe(false);
		expect(second.retiredRoomIds).toEqual([]);
		expect(compiledFloorAreas(second.document)).toEqual([12]);
	});

	it('drawing an alternate enclosing path replaces the open side with the larger face', () => {
		const document = threeWallOpenSpace();
		const plan = planWallChain({
			baseline: document,
			points: [
				[0, 0],
				[-2, 0],
				[-2, 3],
				[0, 3]
			],
			close: false,
			capture: capture('sp1b-alternate-path'),
			levelId: document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-a' },
				{ pointIndex: 3, junctionId: 'j-d' }
			]
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		const room = plan.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.name).toBe('Open');
		expect(room.virtualEdges).toEqual([]);
		expect(room.boundary.map((ref) => ref.wallId)).toEqual(
			expect.arrayContaining(['wall-a', 'wall-b', 'wall-c'])
		);
		expect(compiledFloorAreas(plan.document)).toEqual([18]);
	});

	it('drawing a divider encloses one part of an open Space and leaves the remainder unowned', () => {
		const document = threeWallOpenSpace();
		const plan = planWallChain({
			baseline: document,
			points: [
				[2, 0],
				[2, 3]
			],
			close: false,
			capture: capture('sp1b-divide'),
			levelId: document.floor.id,
			endpointHostSnaps: [
				{ pointIndex: 0, wallId: 'wall-a' },
				{ pointIndex: 1, wallId: 'wall-c' }
			]
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		const room = plan.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.virtualEdges).toEqual([]);
		expect(compiledFloorAreas(plan.document)).toEqual([6]);
	});

	it('drawing exactly along a virtual edge closes the Space and keeps its identity', () => {
		const document = threeWallOpenSpace();
		const plan = planWallChain({
			baseline: document,
			points: [
				[0, 3],
				[0, 0]
			],
			close: false,
			capture: capture('sp1b-close'),
			levelId: document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-d' },
				{ pointIndex: 1, junctionId: 'j-a' }
			]
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room-open');
		expect(plan.document.rooms[0]!.virtualEdges).toEqual([]);
		expect(compiledFloorAreas(plan.document)).toEqual([12]);
	});

	it('a stroke along part of a virtual edge stays free-standing and leaves the Space unchanged', () => {
		const document = threeWallOpenSpace();
		const plan = planWallChain({
			baseline: document,
			points: [
				[0, 0],
				[0, 1.5]
			],
			close: false,
			capture: capture('sp1b-partial-edge'),
			levelId: document.floor.id,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'j-a' }]
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual(document.rooms);
		expect(plan.document.walls).toHaveLength(document.walls.length + 1);
		expect(compiledFloorAreas(plan.document)).toEqual([12]);
	});

	it('a stroke across a virtual edge without touching its ends leaves the Space unchanged', () => {
		const document = threeWallOpenSpace();
		const plan = planWallChain({
			baseline: document,
			points: [
				[1, 1.5],
				[-1, 1.5]
			],
			close: false,
			capture: capture('sp1b-cross-edge'),
			levelId: document.floor.id
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual(document.rooms);
		expect(plan.document.walls).toHaveLength(document.walls.length + 1);
		expect(compiledFloorAreas(plan.document)).toEqual([12]);
	});

	it('moving a Junction on an open boundary is allowed and updates the outline', () => {
		const document = threeWallOpenSpace();
		const plan = planExactJunctionMove(document, 'j-d', [0, 4]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.id).toBe('room-open');
		expect(plan.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		const moved = plan.document.junctions.find((candidate) => candidate.id === 'j-d')!;
		expect(moved.point).toEqual([0, 4]);
		expect(compiledFloorAreas(plan.document)).toEqual([14]);
	});

	it('rotating a two-component open Space moves every Wall and virtual-edge Junction', () => {
		const document = enclosedRectangle();
		const erased = planDeleteWalls(
			document,
			['wall-a', 'wall-c'],
			capture('sp1b-rotate-erase'),
			document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(erased.kind).toBe('success');
		if (erased.kind !== 'success') return;
		const before = new Map(
			erased.document.junctions.map((candidate) => [candidate.id, candidate.point])
		);
		const plan = planWallFirstRoomRotation(erased.document, 'room-open', [0, 0], Math.PI / 2);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		const room = plan.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.boundary.map((ref) => ref.wallId).sort()).toEqual(['wall-b', 'wall-d']);
		expect(room.virtualEdges).toEqual(erased.document.rooms[0]!.virtualEdges);
		const after = new Map(
			plan.document.junctions.map((candidate) => [candidate.id, candidate.point])
		);
		expect(after.get('j-a')).toEqual([0, 0]);
		for (const junctionId of ['j-b', 'j-c', 'j-d']) {
			expect(after.get(junctionId)).not.toEqual(before.get(junctionId));
		}
		const distance = (points: ReadonlyMap<string, LayoutVec2>): number =>
			Math.hypot(
				points.get('j-b')![0] - points.get('j-d')![0],
				points.get('j-b')![1] - points.get('j-d')![1]
			);
		expect(distance(after)).toBeCloseTo(distance(before), 9);
		expect(compiledFloorAreas(plan.document)).toEqual([12]);
	});

	it('F2(b): opposite Walls redrawn one after the other keep the same Space id', () => {
		const document = enclosedRectangle();
		const erased = planDeleteWalls(
			document,
			['wall-a', 'wall-c'],
			capture('sp1b-f2b-erase'),
			document.floor.id,
			{ openSpaces: 'keep' }
		);
		expect(erased.kind).toBe('success');
		if (erased.kind !== 'success') return;
		expect(erased.document.rooms[0]!.id).toBe('room-open');
		expect(erased.document.rooms[0]!.virtualEdges).toHaveLength(2);

		const first = planWallChain({
			baseline: erased.document,
			points: [
				[0, 0],
				[4, 0]
			],
			close: false,
			capture: capture('sp1b-f2b-redraw-a'),
			levelId: erased.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-a' },
				{ pointIndex: 1, junctionId: 'j-b' }
			]
		});
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		expect(first.document.rooms).toHaveLength(1);
		expect(first.document.rooms[0]!.id).toBe('room-open');

		const second = planWallChain({
			baseline: first.document,
			points: [
				[0, 3],
				[4, 3]
			],
			close: false,
			capture: capture('sp1b-f2b-redraw-c'),
			levelId: first.document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-d' },
				{ pointIndex: 1, junctionId: 'j-c' }
			]
		});
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(second.document.rooms).toHaveLength(1);
		expect(second.document.rooms[0]!.id).toBe('room-open');
		expect(second.document.rooms[0]!.virtualEdges).toEqual([]);
		expect(compiledFloorAreas(second.document)).toEqual([12]);
	});
});
