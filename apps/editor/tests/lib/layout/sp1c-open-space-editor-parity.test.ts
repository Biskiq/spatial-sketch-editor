/**
 * SP1c — Open Space editor and visitor parity.
 *
 * These are regression properties over the **compiled** reading: an open Space
 * keeps one identity through erase/redraw, its virtual sides compile as open
 * sides (editor ink only), named consequence lines say what happened, and the
 * innermost containing Space wins floor selection. The adapter journey lives in
 * `layout-open-space-adapter.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	faceArea,
	parseWallFirstLayoutDocumentJson,
	planDeleteWall,
	planRemoveSpace,
	serializeWallFirstLayoutDocument,
	type CompiledLayoutQueryGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { planChainDraft } from '$lib/authoring/adapters/layout/chain';
import { planWallDeletion } from '$lib/authoring/adapters/layout/drawing-planners';
import { layoutRoomFacts } from '$lib/authoring/adapters/layout/precision';
import { findPlanHitRoom } from '$lib/authoring/layout/plan-hit';
import { innermostRoomId } from '$lib/authoring/adapters/scene/room-membership';
import { layoutKindWord } from '$lib/authoring/stage/shell/index-labels';
import { captureFor } from './__fixtures__/layout-id-capture';
import { buildP23B11ConnectedCase } from './__fixtures__/p23b11-connected-case';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from './__fixtures__/p23b-fixtures';

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

function enclosedRectangle(): LayoutDocumentWallFirst {
	const document = threeWallOpenSpace();
	document.walls.push(wall('wall-d', 'j-d', 'j-a'));
	document.rooms[0]!.boundary.push({ wallId: 'wall-d', direction: 'forward' });
	document.rooms[0]!.virtualEdges = [];
	return document;
}

describe('SP1c — open Space reads as one Space', () => {
	it('compiles virtual sides as dashed ink data and keeps area from the floor polygon', () => {
		const document = threeWallOpenSpace();
		const { geometry, issues } = compileWallFirstLayoutGeometry(document);
		expect(issues).toEqual([]);
		const room = geometry.rooms[0]!;
		expect(room.roomId).toBe('room-open');
		expect(room.openSides!).toHaveLength(1);
		expect(room.openSides![0]!.start).toEqual([0, 3]);
		expect(room.openSides![0]!.end).toEqual([0, 0]);
		expect(faceArea({ polygon: room.floorPolygon })).toBeCloseTo(12, 9);

		const facts = layoutRoomFacts(document, geometry, 'room-open');
		expect(facts).toContainEqual({ label: 'Kind', value: 'Open space', fieldId: 'kind' });
		expect(facts).toContainEqual({ label: 'Area', value: '12.00 m²', fieldId: 'area' });
		expect(facts).toContainEqual({ label: 'Overhead', value: 'Closed', fieldId: 'overhead' });
		expect(facts).toContainEqual({
			label: 'Bounds',
			value: '3 Walls · 1 open side',
			fieldId: 'bounds'
		});
		expect(layoutKindWord('room-floor', undefined, true)).toBe('Open space');
		expect(layoutKindWord('room-floor')).toBe('Room');
	});

	it('saves and reopens the same Room identity, virtual edge and compiled open side', () => {
		const document = threeWallOpenSpace();
		const json = serializeWallFirstLayoutDocument(document);
		const reopened = parseWallFirstLayoutDocumentJson(json);
		expect(reopened.success).toBe(true);
		if (!reopened.success) return;
		expect(serializeWallFirstLayoutDocument(reopened.document)).toBe(json);
		const room = reopened.document.rooms[0]!;
		expect(room.id).toBe('room-open');
		expect(room.virtualEdges).toEqual([{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]);
		const { geometry } = compileWallFirstLayoutGeometry(reopened.document);
		expect(geometry.rooms[0]!.openSides!).toHaveLength(1);
	});
});

describe('SP1c — Wall deletion consequence lines name the Space', () => {
	it('opens an enclosed Room and keeps it open on the second Wall deletion', () => {
		const document = enclosedRectangle();
		const first = planWallDeletion({
			document,
			wallId: 'wall-b',
			capture: captureFor('sp1c-open-first'),
			levelId: document.floor.id
		});
		expect(first.kind).toBe('planned');
		if (first.kind !== 'planned') return;
		expect(first.openedRoomIds).toEqual(['room-open']);
		expect(first.keptOpenRoomIds).toEqual([]);
		expect(first.summary).toContain('It opens Open; one side is now open.');

		const second = planWallDeletion({
			document: first.document,
			wallId: 'wall-c',
			capture: captureFor('sp1c-open-second'),
			levelId: document.floor.id
		});
		expect(second.kind).toBe('planned');
		if (second.kind !== 'planned') return;
		expect(second.openedRoomIds).toEqual([]);
		expect(second.keptOpenRoomIds).toEqual(['room-open']);
		expect(second.summary).toBe('This deletes the Wall. It keeps Open open.');
		const { geometry } = compileWallFirstLayoutGeometry(second.document);
		expect(geometry.rooms[0]!.openSides!).toHaveLength(2);
	});

	it('names a last-boundary-Wall retirement', () => {
		const document = oneWallOpenSpace();
		const last = planWallDeletion({
			document,
			wallId: 'wall-a',
			capture: captureFor('sp1c-last-wall'),
			levelId: document.floor.id
		});
		expect(last.kind).toBe('planned');
		if (last.kind !== 'planned') return;
		expect(last.spaceNotes).toContainEqual(
			expect.objectContaining({ roomId: 'room-open', name: 'Open', reason: 'last-boundary-wall' })
		);
		expect(last.summary).toContain('It removes Open — its last Wall is gone.');
		expect(last.document.rooms).toEqual([]);
	});

	it('counts two adjacent virtual edges as one open side and opposite gaps as two', () => {
		const first = planWallDeletion({
			document: enclosedRectangle(),
			wallId: 'wall-b',
			capture: captureFor('sp1c-runs-adjacent-first'),
			levelId: enclosedRectangle().floor.id
		});
		if (first.kind !== 'planned') throw new Error('the first adjacent deletion did not plan');
		const adjacent = planWallDeletion({
			document: first.document,
			wallId: 'wall-c',
			capture: captureFor('sp1c-runs-adjacent-second'),
			levelId: first.document.floor.id
		});
		if (adjacent.kind !== 'planned') throw new Error('the second adjacent deletion did not plan');
		const adjacentRoom = adjacent.document.rooms[0]!;
		// The raw data stays two edges; only the Card's reading is a run.
		expect(adjacentRoom.virtualEdges).toHaveLength(2);
		const adjacentGeometry = compileWallFirstLayoutGeometry(adjacent.document).geometry;
		expect(
			layoutRoomFacts(adjacent.document, adjacentGeometry, adjacentRoom.id).find(
				(fact) => fact.fieldId === 'bounds'
			)?.value
		).toBe('2 Walls · 1 open side');

		const oppositeFirst = planWallDeletion({
			document: enclosedRectangle(),
			wallId: 'wall-b',
			capture: captureFor('sp1c-runs-opposite-first'),
			levelId: enclosedRectangle().floor.id
		});
		if (oppositeFirst.kind !== 'planned') throw new Error('the first opposite deletion did not plan');
		const opposite = planWallDeletion({
			document: oppositeFirst.document,
			wallId: 'wall-d',
			capture: captureFor('sp1c-runs-opposite-second'),
			levelId: oppositeFirst.document.floor.id
		});
		if (opposite.kind !== 'planned') throw new Error('the second opposite deletion did not plan');
		const oppositeRoom = opposite.document.rooms[0]!;
		expect(oppositeRoom.virtualEdges).toHaveLength(2);
		const oppositeGeometry = compileWallFirstLayoutGeometry(opposite.document).geometry;
		expect(
			layoutRoomFacts(opposite.document, oppositeGeometry, oppositeRoom.id).find(
				(fact) => fact.fieldId === 'bounds'
			)?.value
		).toBe('2 Walls · 2 open sides');
	});

	it('states the changed area when a curved Wall leaves its straight chord', () => {
		const spec = P23B_MATRIX_SPECS.find((candidate) => candidate.id === 'p23b-12-wall-all-curved-v1');
		if (spec === undefined) throw new Error('the curved fixture is missing');
		const document = buildP23BMatrixFixture(spec);
		const plan = planWallDeletion({
			document,
			wallId: 'room-0:wall-0',
			capture: captureFor('sp1c-curved-erase'),
			levelId: document.floor.id
		});
		if (plan.kind !== 'planned') throw new Error('the curved outer-Wall deletion did not plan');
		expect(plan.summary).toMatch(/Its area is now \d+\.\d{2} m²\./);
	});

	it('names the survivor’s overhead when an open merge overrules it', () => {
		const enclosed = buildP23B11ConnectedCase();
		// Open room-0-0 first, then merge it with its enclosed neighbour across
		// the shared Wall. The two overheads differ, so the survivor's must be named.
		const opened = planWallDeletion({
			document: enclosed,
			wallId: 'grid:h-0-0',
			capture: captureFor('sp1c-overhead-merge-open'),
			levelId: enclosed.floor.id
		});
		if (opened.kind !== 'planned') throw new Error('the opening deletion did not plan');
		const document = opened.document;
		for (const room of document.rooms) {
			if (room.id === 'grid:room-1-0') room.overhead = 'open-to-sky';
		}
		const plan = planWallDeletion({
			document,
			wallId: 'grid:v-1-0',
			capture: captureFor('sp1c-overhead-merge'),
			levelId: document.floor.id
		});
		if (plan.kind !== 'planned') throw new Error('the shared-Wall deletion did not plan');
		const merged = plan.spaceNotes.find((note) => note.reason === 'merged');
		expect(merged).toBeDefined();
		expect(merged?.successorOverhead).toBeDefined();
		expect(merged?.successorName).toBeDefined();
		const label = merged!.successorOverhead === 'open-to-sky' ? 'Open to sky' : 'Closed';
		expect(plan.summary).toContain(`${merged!.successorName}'s ${label} overhead wins`);
	});

	it('names a re-closing stroke for its closure, never as a free-standing Wall', () => {
		const document = threeWallOpenSpace();
		const redrawn = planChainDraft({
			document,
			draft: {
				points: [
					{ point: [0, 3], target: { kind: 'junction', junctionId: 'j-d' } },
					{ point: [0, 0], target: { kind: 'junction', junctionId: 'j-a' } }
				],
				closed: false
			},
			capture: captureFor('sp1c-reclose-not-free-standing'),
			levelId: document.floor.id
		});
		if (redrawn.kind !== 'planned') throw new Error('the re-close did not plan');
		expect(redrawn.consequence.kind).toBe('closes');
		expect(redrawn.consequence.summary).toContain('Closes Open — every side is a Wall again.');
		expect(redrawn.consequence.summary).not.toContain('Free-standing Wall');
	});

	it('states the enclosed part and the ground left outside when a stroke divides an open Space', () => {
		const document = threeWallOpenSpace();
		const divided = planChainDraft({
			document,
			draft: {
				points: [
					{ point: [2, 0], target: { kind: 'host', wallId: 'wall-a' } },
					{ point: [2, 3], target: { kind: 'host', wallId: 'wall-c' } }
				],
				closed: false
			},
			capture: captureFor('sp1c-b3-division'),
			levelId: document.floor.id
		});
		if (divided.kind !== 'planned') throw new Error('the dividing stroke did not plan');
		expect(divided.closedRoomIds).toEqual(['room-open']);
		expect(divided.document.rooms.find((room) => room.id === 'room-open')?.virtualEdges).toEqual([]);
		expect(divided.consequence.summary).toContain('Open becomes a room · 6.00 m² left outside.');
	});

	it('re-closes an open Space by redrawing its missing side and names the Room', () => {
		const document = threeWallOpenSpace();
		const redrawn = planChainDraft({
			document,
			draft: {
				points: [
					{ point: [0, 3], target: { kind: 'junction', junctionId: 'j-d' } },
					{ point: [0, 0], target: { kind: 'junction', junctionId: 'j-a' } }
				],
				closed: false
			},
			capture: captureFor('sp1c-reclose'),
			levelId: document.floor.id
		});
		expect(redrawn.kind).toBe('planned');
		if (redrawn.kind !== 'planned') return;
		expect(redrawn.closedRoomIds).toEqual(['room-open']);
		expect(redrawn.document.rooms[0]!.id).toBe('room-open');
		expect(redrawn.document.rooms[0]!.virtualEdges).toEqual([]);
		expect(redrawn.consequence.summary).toContain('Closes Open — every side is a Wall again.');
	});

	it('Remove space keeps the Walls and the other Spaces', () => {
		const document = threeWallOpenSpace();
		const plan = planRemoveSpace(document, 'room-open', document.floor.id);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toEqual([]);
		expect(plan.document.walls.map((entry) => entry.id)).toEqual(['wall-a', 'wall-b', 'wall-c']);
	});
});

describe('SP1c — innermost Space resolution', () => {
	function polygon(
		roomId: string,
		points: readonly LayoutVec2[]
	): CompiledLayoutQueryGeometry['polygons'][number] {
		const xs = points.map(([x]) => x);
		const zs = points.map(([, z]) => z);
		return {
			id: `room-floor:${roomId}`,
			cacheKey: `room-floor:${roomId}`,
			kind: 'room-floor',
			polygon: points.map(([x, z]) => [x, z] as LayoutVec2),
			aabb: { min: [Math.min(...xs), Math.min(...zs)], max: [Math.max(...xs), Math.max(...zs)] },
			sourceId: roomId,
			roomId
		};
	}

	const queries: CompiledLayoutQueryGeometry = {
		points: [],
		spans: [],
		aabbs: [],
		polygons: [
			polygon('hall', [
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10]
			]),
			polygon('booth', [
				[4, 4],
				[6, 4],
				[6, 6],
				[4, 6]
			])
		]
	};

	it('picks the booth inside the hall, not the first query-array row', () => {
		expect(findPlanHitRoom(queries, [5, 5])).toEqual({ roomId: 'booth' });
		expect(findPlanHitRoom(queries, [1, 1])).toEqual({ roomId: 'hall' });
		expect(findPlanHitRoom(queries, [12, 12])).toBeNull();
		expect(findPlanHitRoom(queries, [5, 5], { allowedRoomIds: new Set(['hall']) })).toEqual({
			roomId: 'hall'
		});
	});

	it('picks the innermost witness for scene membership', () => {
		const area = new Map([
			['hall', 100],
			['booth', 4]
		]);
		expect(innermostRoomId(['hall', 'booth'], (id) => area.get(id) ?? Infinity)).toBe('booth');
		expect(innermostRoomId(['hall'], () => 1)).toBe('hall');
		expect(innermostRoomId([], () => 1)).toBeNull();
	});
});
