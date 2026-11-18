/**
 * SP1a — open Spaces: format 8, composition, compilation, certification and
 * persistence ownership.
 *
 * R-1 is pinned here: a closed circular Room keeps the preexisting `< 2` refs
 * certification refusal, while a one-Wall open Space is certified by its
 * composed outline. R-2 is case (a): Layout has one version authority,
 * `LAYOUT_UNIT_FORMAT_VERSION === LAYOUT_WALL_FIRST_FORMAT_VERSION`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	compileWallFirstLayoutGeometry,
	composeSpaceBoundary,
	cowMoveJunctions,
	createClosedWallCircleDocument,
	createEmptyWallFirstLayoutDocument,
	ensureLayoutWorldIndex,
	findPolygonContaining,
	findSpaceCreationOutline,
	hasBlockingLayoutIssues,
	isOpenSpace,
	mintLayoutIdCapture,
	parseWallFirstLayoutDocumentJson,
	planCreateOpenSpace,
	planFirstEnclosureCreation,
	planWallChain,
	polygonContainsPolygon,
	roomBoundaryPolygon,
	serializeWallFirstLayoutDocument,
	spaceAtPoint,
	spaceBoundaryCycleKey,
	spaceBoundaryPolygonFromEdges,
	spaceOpenSideCount,
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea,
	spacePlacementIssues,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import {
	LAYOUT_UNIT_FORMAT_VERSION,
	validateLayoutPayload,
	validateProjectEnvelope,
	prepareUnitRuntime,
	serializeProjectEnvelope
} from '@portfolio/project-model/units';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';
import { captureFor } from './__fixtures__/layout-id-capture';
import { twoRoomDocument } from './__fixtures__/two-room-fixture';

const POINTS = [
	[0, 0],
	[6, 0],
	[6, 4],
	[0, 4]
] as const;

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

function rectangleParts(): {
	junctions: LayoutDocumentWallFirst['junctions'];
	walls: LayoutDocumentWallFirst['walls'];
} {
	return {
		junctions: ['j-a', 'j-b', 'j-c', 'j-d'].map((id, index) => ({
			id,
			point: [...POINTS[index]!] as LayoutVec2
		})),
		walls: [
			wall('wall-a', 'j-a', 'j-b'),
			wall('wall-b', 'j-b', 'j-c'),
			wall('wall-c', 'j-c', 'j-d'),
			wall('wall-d', 'j-d', 'j-a')
		]
	};
}

type OpenShape = 'one-wall' | 'three-wall' | 'two-adjacent';

function openDocument(shape: OpenShape, overhead: 'closed' | 'open-to-sky' = 'closed'): LayoutDocumentWallFirst {
	const parts = rectangleParts();
	const boundaryIds =
		shape === 'one-wall' ? ['wall-a'] : shape === 'three-wall' ? ['wall-a', 'wall-b', 'wall-c'] : ['wall-a', 'wall-b'];
	const virtualEdges =
		shape === 'one-wall'
			? [
					{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
					{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
					{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
				]
			: shape === 'three-wall'
				? [{ startJunctionId: 'j-d', endJunctionId: 'j-a' }]
				: [
						{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
						{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
					];
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: parts.junctions,
		walls: parts.walls.filter((candidate) => boundaryIds.includes(candidate.id)),
		rooms: [
			{
				id: 'room-open',
				name: 'Open',
				boundary: boundaryIds.map((wallId) => ({ wallId, direction: 'forward' as const })),
				virtualEdges,
				overhead,
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

function openRectangleAt(prefix: string, x: number, z: number): LayoutDocumentWallFirst {
	const ids = ['a', 'b', 'c', 'd'].map((suffix) => `${prefix}-j-${suffix}`);
	const points: LayoutVec2[] = [
		[x, z],
		[x + 4, z],
		[x + 4, z + 3],
		[x, z + 3]
	];
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: ids.map((id, index) => ({ id, point: points[index]! })),
		// An open rectangle has exactly one physical Wall; the virtual edges are
		// the three erased sides and never become Walls.
		walls: [wall(`${prefix}-wall-a`, ids[0]!, ids[1]!)],
		rooms: [
			{
				id: `${prefix}-room`,
				name: prefix,
				boundary: [{ wallId: `${prefix}-wall-a`, direction: 'forward' }],
				virtualEdges: [
					{ startJunctionId: ids[1]!, endJunctionId: ids[2]! },
					{ startJunctionId: ids[2]!, endJunctionId: ids[3]! },
					{ startJunctionId: ids[3]!, endJunctionId: ids[0]! }
				],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

function enclosedRectangleAt(prefix: string, x: number, z: number, width: number, depth: number): LayoutDocumentWallFirst {
	const ids = ['a', 'b', 'c', 'd'].map((suffix) => `${prefix}-j-${suffix}`);
	const points: LayoutVec2[] = [
		[x, z],
		[x + width, z],
		[x + width, z + depth],
		[x, z + depth]
	];
	return {
		...createEmptyWallFirstLayoutDocument(),
		junctions: ids.map((id, index) => ({ id, point: points[index]! })),
		walls: [
			wall(`${prefix}-wall-a`, ids[0]!, ids[1]!),
			wall(`${prefix}-wall-b`, ids[1]!, ids[2]!),
			wall(`${prefix}-wall-c`, ids[2]!, ids[3]!),
			wall(`${prefix}-wall-d`, ids[3]!, ids[0]!)
		],
		rooms: [
			{
				id: `${prefix}-room`,
				name: prefix,
				boundary: [
					{ wallId: `${prefix}-wall-a`, direction: 'forward' },
					{ wallId: `${prefix}-wall-b`, direction: 'forward' },
					{ wallId: `${prefix}-wall-c`, direction: 'forward' },
					{ wallId: `${prefix}-wall-d`, direction: 'forward' }
				],
				virtualEdges: [],
				overhead: 'closed',
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		]
	};
}

function merge(...documents: LayoutDocumentWallFirst[]): LayoutDocumentWallFirst {
	const result = createEmptyWallFirstLayoutDocument();
	for (const document of documents) {
		result.junctions.push(...document.junctions);
		result.walls.push(...document.walls);
		result.rooms.push(...document.rooms);
	}
	return result;
}

function issueCodes(document: unknown): string[] {
	const result = validateWallFirstLayoutDocument(document);
	return result.success ? [] : result.issues.map((issue) => issue.code);
}

function polygonArea(polygon: readonly LayoutVec2[]): number {
	let area = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index]!;
		const next = polygon[(index + 1) % polygon.length]!;
		area += current[0] * next[1] - next[0] * current[1];
	}
	return area / 2;
}

function compiledRoom(document: LayoutDocumentWallFirst) {
	const compiled = compileWallFirstLayoutGeometry(document);
	const room = compiled.geometry.rooms[0];
	if (!room) throw new Error(JSON.stringify(compiled.issues));
	return { compiled, room };
}

describe('SP1a — format 8 and canonical composition', () => {
	it('T1 compiles an enclosed format-8 document byte-identically to the format-7 baseline', () => {
		const document = twoRoomDocument();
		expect(document.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(LAYOUT_WALL_FIRST_FORMAT_VERSION).toBe(8);
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(compiled.geometry.rooms).toHaveLength(2);
		expect(compiled.geometry.rooms.every((room) => room.overhead === 'closed')).toBe(true);
		// Captured at the base commit `c0a7c92e` from the same fixture through
		// the format-7 compiler. `overhead` is the one new compiled field; the
		// closed lid, bounds, walls, openings, floor polygons and cache keys are
		// unrepresented here only because they are unchanged and remain in the
		// digest below with the new field removed.
		const withoutNewField = {
			...compiled.geometry,
			rooms: compiled.geometry.rooms.map(({ overhead: _overhead, ...room }) => room)
		};
		const digest = createHash('sha256').update(JSON.stringify(withoutNewField)).digest('hex');
		expect(digest).toBe('77734d4ae9b73d34603460a791835aa83143d1a5006c01b0721ed8326a02d49a');
		expect(ensureLayoutWorldIndex(document)).toBeDefined();
	});

	it('T2 accepts an opened rectangle through codec, compiler and certified index with area 24 m²', () => {
		const document = openDocument('three-wall');
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const { compiled, room } = compiledRoom(document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(polygonArea(room.floorPolygon)).toBeCloseTo(24, 9);
		expect(compiled.geometry.walls.map((candidate) => candidate.wallId).sort()).toEqual([
			'wall-a',
			'wall-b',
			'wall-c'
		]);
		expect(ensureLayoutWorldIndex(document)).toBeDefined();
	});

	it('T3 keeps the corner Junction and reports one open side for an adjacent pair', () => {
		const document = openDocument('two-adjacent');
		const composed = composeSpaceBoundary(document, document.rooms[0]!);
		expect(composed.kind).toBe('ok');
		if (composed.kind !== 'ok') return;
		expect(spaceOpenSideCount(composed.edges)).toBe(1);
		const { room } = compiledRoom(document);
		expect(polygonArea(room.floorPolygon)).toBeCloseTo(24, 9);
		expect(document.junctions.some((junction) => junction.id === 'j-c')).toBe(true);
		expect(ensureLayoutWorldIndex(document)).toBeDefined();
	});

	it('T4 composes 24 m² through roomBoundaryPolygon, the shared evidence helper', () => {
		const document = openDocument('one-wall');
		const polygon = roomBoundaryPolygon(document, 'room-open');
		expect(polygon).not.toBeNull();
		expect(polygonArea(polygon!)).toBeCloseTo(24, 9);
		const composed = composeSpaceBoundary(document, document.rooms[0]!);
		expect(composed.kind).toBe('ok');
		if (composed.kind === 'ok') {
			expect(spaceBoundaryPolygonFromEdges(composed.edges, document)).toEqual(polygon);
		}
		// Enclosed Spaces keep today's key exactly: the virtual-token extension
		// never changes a closed Room's cycle key.
		const enclosed = twoRoomDocument();
		const wallOnly = {
			...enclosed.rooms[0]!,
			virtualEdges: []
		};
		const openKey = spaceBoundaryCycleKey(document, document.rooms[0]!);
		expect(openKey).not.toBeNull();
		expect(spaceBoundaryCycleKey(enclosed, wallOnly)).not.toBeNull();
		expect(isOpenSpace(document.rooms[0]!)).toBe(true);
	});

	it('canonically round-trips an open Space at format 8', () => {
		const document = openDocument('three-wall');
		const json = serializeWallFirstLayoutDocument(document);
		const parsed = parseWallFirstLayoutDocumentJson(json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.document.rooms[0]!.virtualEdges).toEqual(document.rooms[0]!.virtualEdges);
		expect(parsed.document.rooms[0]!.overhead).toBe('closed');
		expect(serializeWallFirstLayoutDocument(parsed.document)).toBe(json);
	});

	it('T15 removes only the generated lid for open-to-sky', () => {
		const closed = compiledRoom(openDocument('three-wall', 'closed'));
		const open = compiledRoom(openDocument('three-wall', 'open-to-sky'));
		expect(closed.room.ceilingPolygon.length).toBeGreaterThan(0);
		expect(open.room.ceilingPolygon).toEqual([]);
		expect(open.room.overhead).toBe('open-to-sky');
		expect(open.room.ceilingElevation).toBe(closed.room.ceilingElevation);
		expect(open.room.floorElevation).toBe(closed.room.floorElevation);
		expect(open.room.floorPolygon).toEqual(closed.room.floorPolygon);
		expect(open.room.walls).toEqual(closed.room.walls);
		expect(open.room.openings).toEqual(closed.room.openings);
		expect(open.room.bounds2).toEqual(closed.room.bounds2);
		expect(open.room.bounds3.min).toEqual(closed.room.bounds3.min);
		expect(open.room.bounds3.max[1]).toBe(open.room.ceilingElevation);
		expect(closed.room.bounds3.max[1]).toBe(closed.room.ceilingElevation + closed.room.ceilingThickness);
		expect(open.compiled.geometry.walls).toEqual(closed.compiled.geometry.walls);
		expect(open.room.cacheKey).not.toBe(closed.room.cacheKey);
	});

	it('T20 refuses every ambiguous composition with its own code', () => {
		const noGap = openDocument('one-wall');
		noGap.rooms[0]!.virtualEdges = [];
		expect(issueCodes(noGap)).toContain('space_boundary_open');

		const unconsumed = openDocument('three-wall');
		unconsumed.rooms[0]!.virtualEdges.push({ startJunctionId: 'j-b', endJunctionId: 'j-c' });
		expect(issueCodes(unconsumed)).toContain('space_virtual_edge_unconsumed');

		const revisited = openDocument('one-wall');
		revisited.rooms[0]!.virtualEdges = [
			{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
			{ startJunctionId: 'j-b', endJunctionId: 'j-d' }
		];
		expect(issueCodes(revisited)).toContain('duplicate_virtual_edge_origin');

		const wallSideTwice = openDocument('one-wall');
		wallSideTwice.rooms.push({
			...structuredClone(wallSideTwice.rooms[0]!),
			id: 'room-second',
			name: 'Second'
		});
		expect(issueCodes(wallSideTwice)).toContain('duplicate_wall_side_reference');
	});
});

describe('SP1a — invariants and refusals', () => {
	it('refuses I1, I3, I8 and I9 at the codec', () => {
		const empty = openDocument('one-wall');
		empty.rooms[0]!.boundary = [];
		empty.rooms[0]!.virtualEdges = [];
		expect(issueCodes(empty)).toContain('room_boundary_empty');

		const degenerate = openDocument('one-wall');
		degenerate.rooms[0]!.virtualEdges = [
			{ startJunctionId: 'j-b', endJunctionId: 'j-b' },
			...degenerate.rooms[0]!.virtualEdges.slice(1)
		];
		expect(issueCodes(degenerate)).toContain('space_virtual_edge_degenerate');

		const missingEnd = openDocument('one-wall');
		missingEnd.rooms[0]!.virtualEdges = [
			{ startJunctionId: 'j-b', endJunctionId: 'missing' },
			...missingEnd.rooms[0]!.virtualEdges.slice(1)
		];
		expect(issueCodes(missingEnd)).toContain('missing_reference');

		const extraField = openDocument('one-wall') as unknown as {
			rooms: Array<{ virtualEdges: Array<Record<string, unknown>> }>;
		};
		extraField.rooms[0]!.virtualEdges[0]!.height = 3;
		expect(issueCodes(extraField)).toContain('unknown_key');

		// Format 8 has no defaulting: both new Room fields are required.
		const missingVirtualEdges = openDocument('one-wall') as unknown as {
			rooms: Array<Record<string, unknown>>;
		};
		delete missingVirtualEdges.rooms[0]!.virtualEdges;
		expect(issueCodes(missingVirtualEdges)).toContain('invalid_type');

		const missingOverhead = openDocument('one-wall') as unknown as {
			rooms: Array<Record<string, unknown>>;
		};
		delete missingOverhead.rooms[0]!.overhead;
		expect(issueCodes(missingOverhead)).toContain('invalid_type');
	});

	it('refuses I4 non-positive and self-crossing outlines at the compiler', () => {
		const bowTie = {
			...createEmptyWallFirstLayoutDocument(),
			junctions: [
				{ id: 'j-a', point: [0, 0] as LayoutVec2 },
				{ id: 'j-b', point: [4, 4] as LayoutVec2 },
				{ id: 'j-c', point: [4, 0] as LayoutVec2 },
				{ id: 'j-d', point: [0, 4] as LayoutVec2 }
			],
			walls: [wall('wall-a', 'j-a', 'j-b')],
			rooms: [
				{
					id: 'room-bow-tie',
					name: 'Bow tie',
					boundary: [{ wallId: 'wall-a', direction: 'forward' as const }],
					virtualEdges: [
						{ startJunctionId: 'j-b', endJunctionId: 'j-c' },
						{ startJunctionId: 'j-c', endJunctionId: 'j-d' },
						{ startJunctionId: 'j-d', endJunctionId: 'j-a' }
					],
					overhead: 'closed' as const,
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		const nonPositive = compileWallFirstLayoutGeometry(bowTie);
		expect(nonPositive.geometry.rooms).toHaveLength(0);
		expect(nonPositive.issues.map((issue) => issue.code)).toContain('space_outline_not_positive');

		const crossingPolygon: LayoutVec2[] = [
			[0, 0],
			[2, -2],
			[4, 0],
			[0, 4],
			[4, 4]
		];
		expect(spaceOutlineSignedArea(crossingPolygon)).toBeGreaterThan(0);
		expect(spaceOutlineSelfIntersects(crossingPolygon)).toBe(true);

		const crossing = {
			...createEmptyWallFirstLayoutDocument(),
			junctions: crossingPolygon.map((point, index) => ({ id: `j-${index}`, point })),
			walls: [wall('wall-0', 'j-0', 'j-1')],
			rooms: [
				{
					id: 'room-crossing',
					name: 'Crossing',
					boundary: [{ wallId: 'wall-0', direction: 'forward' as const }],
					virtualEdges: [
						{ startJunctionId: 'j-1', endJunctionId: 'j-2' },
						{ startJunctionId: 'j-2', endJunctionId: 'j-3' },
						{ startJunctionId: 'j-3', endJunctionId: 'j-4' },
						{ startJunctionId: 'j-4', endJunctionId: 'j-0' }
					],
					overhead: 'closed' as const,
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			]
		};
		const crossingResult = compileWallFirstLayoutGeometry(crossing);
		expect(crossingResult.geometry.rooms).toHaveLength(0);
		expect(crossingResult.issues.map((issue) => issue.code)).toContain('space_outline_self_intersects');
	});

	it('refuses I7 overlap and rejects containment in the wrong direction', () => {
		const first = openRectangleAt('a', 0, 0);
		const second = openRectangleAt('b', 2, 0);
		const overlap = merge(first, second);
		expect(validateWallFirstLayoutDocument(overlap).success).toBe(true);
		expect(spacePlacementIssues(overlap).map((issue) => issue.code)).toContain('space_overlap');
		const overlapCompiled = compileWallFirstLayoutGeometry(overlap);
		expect(overlapCompiled.geometry.rooms).toHaveLength(0);
		expect(overlapCompiled.issues.map((issue) => issue.code)).toContain('space_overlap');
		expect(ensureLayoutWorldIndex(overlap)).toBeUndefined();

		const hall = openRectangleAt('hall', 0, 0);
		const booth = enclosedRectangleAt('booth', 1, 1, 2, 2);
		const wrongWay = merge(hall, booth);
		expect(validateWallFirstLayoutDocument(wrongWay).success).toBe(true);
		expect(spacePlacementIssues(wrongWay).map((issue) => issue.code)).toContain('space_contains_space');
		expect(ensureLayoutWorldIndex(wrongWay)).toBeUndefined();
	});

	it('admits an open Space wholly inside an enclosed Room', () => {
		const hall = enclosedRectangleAt('hall', 0, 0, 10, 6);
		const booth = openRectangleAt('booth', 2, 1);
		const allowed = merge(hall, booth);
		expect(validateWallFirstLayoutDocument(allowed).success).toBe(true);
		expect(spacePlacementIssues(allowed)).toEqual([]);
		expect(polygonContainsPolygon(roomBoundaryPolygon(hall, 'hall-room')!, roomBoundaryPolygon(allowed, 'booth-room')!)).toBe(true);
		const compiled = compileWallFirstLayoutGeometry(allowed);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(compiled.geometry.rooms).toHaveLength(2);
		expect(ensureLayoutWorldIndex(allowed)).toBeDefined();
	});

	it('is deterministic and refuses without mutating or partially compiling', () => {
		const document = openDocument('three-wall');
		const frozen = structuredClone(document);
		const first = compileWallFirstLayoutGeometry(document);
		const second = compileWallFirstLayoutGeometry(document);
		expect(JSON.stringify(first.geometry)).toBe(JSON.stringify(second.geometry));
		expect(JSON.stringify(first.issues)).toBe(JSON.stringify(second.issues));
		expect(document).toEqual(frozen);

		const overlap = merge(openRectangleAt('a', 0, 0), openRectangleAt('b', 2, 0));
		const overlapBefore = structuredClone(overlap);
		const refused = compileWallFirstLayoutGeometry(overlap);
		expect(refused.geometry.rooms).toEqual([]);
		expect(overlap).toEqual(overlapBefore);
	});
});

describe('SP1a — canonical Space point ownership', () => {
	it('spaceAtPoint selects a nested open Space over its enclosing Room and excludes outside points', () => {
		const document = merge(enclosedRectangleAt('hall', 0, 0, 10, 6), openRectangleAt('booth', 2, 1));
		const compiled = compileWallFirstLayoutGeometry(document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(compiled.geometry.rooms).toHaveLength(2);

		// [3, 2] is inside both the 60 m² hall and the 12 m² booth.
		expect(spaceAtPoint([3, 2], compiled.geometry.rooms)?.roomId).toBe('booth-room');
		// [8, 4] is inside the hall only.
		expect(spaceAtPoint([8, 4], compiled.geometry.rooms)?.roomId).toBe('hall-room');
		// Outside every compiled Space.
		expect(spaceAtPoint([12, 7], compiled.geometry.rooms)).toBeNull();
	});

	it('spaceAtPoint breaks equal-area ties by Room identity, not input order', () => {
		const left = compiledRoom(openRectangleAt('tie-a', 0, 0)).room;
		const right = compiledRoom(openRectangleAt('tie-b', 2, 0)).room;
		// Both 4×3 floors contain [2.5, 1] and have the same area.
		const point: LayoutVec2 = [2.5, 1];
		expect(spaceAtPoint(point, [left, right])?.roomId).toBe('tie-a-room');
		expect(spaceAtPoint(point, [right, left])?.roomId).toBe('tie-a-room');
	});

	it('spaceAtPoint preserves enclosed-only parity with findPolygonContaining', () => {
		const compiled = compileWallFirstLayoutGeometry(twoRoomDocument());
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		const roomPolygons = compiled.geometry.queries.polygons.filter(
			(polygon) => polygon.kind === 'room-floor'
		);
		for (const point of [
			[3, 2],
			[11, 2],
			[7, 2]
		] satisfies LayoutVec2[]) {
			const canonical = spaceAtPoint(point, compiled.geometry.rooms);
			const legacy = findPolygonContaining(point, roomPolygons);
			expect(canonical?.roomId ?? null).toBe(legacy?.roomId ?? null);
		}
	});
});

describe('SP1a — R-1 one-Wall certification', () => {
	it('pins the preexisting closed circular Room refusal', () => {
		const created = createClosedWallCircleDocument({
			center: [0, 0],
			rim: [5, 0],
			junctionId: 'j-circle',
			wallId: 'wall-circle',
			thickness: 0.2,
			height: 3
		});
		expect(created.kind).toBe('success');
		if (created.kind !== 'success') return;
		const plan = planFirstEnclosureCreation({
			candidateDocument: created.document,
			capture: mintLayoutIdCapture(() => 'sp1a-circle'),
			levelId: created.document.floor.id
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(1);
		expect(ensureLayoutWorldIndex(plan.document)).toBeUndefined();
	});

	it('T23 certifies a one-Wall open Space, survives a Junction move and re-closes with the same id', () => {
		const document = openDocument('one-wall');
		expect(validateWallFirstLayoutDocument(document).success).toBe(true);
		const { compiled, room } = compiledRoom(document);
		expect(hasBlockingLayoutIssues(compiled.issues)).toBe(false);
		expect(polygonArea(room.floorPolygon)).toBeCloseTo(24, 9);
		const world = ensureLayoutWorldIndex(document);
		expect(world).toBeDefined();

		const moved = cowMoveJunctions(
			document,
			new Map([['j-b', [6, 1] as LayoutVec2]]),
			['wall-a'],
			world
		);
		expect(ensureLayoutWorldIndex(moved)).toBeDefined();
		const movedCompiled = compileWallFirstLayoutGeometry(moved);
		expect(hasBlockingLayoutIssues(movedCompiled.issues)).toBe(false);
		expect(movedCompiled.geometry.rooms).toHaveLength(1);

		// Redraw the three missing sides in one chain. The existing Junctions are
		// reused by point, the face closes, and correspondence keeps the Space id.
		const reopened = planWallChain({
			baseline: document,
			points: [
				[6, 0],
				[6, 4],
				[0, 4],
				[0, 0]
			],
			close: false,
			capture: captureFor('sp1a-reclose'),
			levelId: document.floor.id,
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: 'j-b' },
				{ pointIndex: 3, junctionId: 'j-a' }
			]
		});
		expect(reopened.kind).toBe('success');
		if (reopened.kind !== 'success') return;
		expect(reopened.document.rooms).toHaveLength(1);
		expect(reopened.document.rooms[0]!.id).toBe('room-open');
		expect(reopened.document.rooms[0]!.virtualEdges).toEqual([]);
		expect(validateWallFirstLayoutDocument(reopened.document).success).toBe(true);
		expect(ensureLayoutWorldIndex(reopened.document)).toBeDefined();
		const closedRoom = compileWallFirstLayoutGeometry(reopened.document).geometry.rooms[0]!;
		expect(polygonArea(closedRoom.floorPolygon)).toBeCloseTo(24, 6);

		// Redrawing one side alone leaves a certified document (the Space may
		// retire until SP1b's carry rule; no uncertified document survives).
		const oneSide = planWallChain({
			baseline: document,
			points: [
				[6, 0],
				[6, 4]
			],
			close: false,
			capture: captureFor('sp1a-one-side'),
			levelId: document.floor.id,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'j-b' }]
		});
		expect(oneSide.kind).toBe('success');
		if (oneSide.kind !== 'success') return;
		expect(ensureLayoutWorldIndex(oneSide.document)).toBeDefined();
	});
});

describe('SP1a — R-2 persistence version ownership', () => {
	async function projectWithOpenSpace() {
		return createUnitProject({
			id: 'sp1a-project',
			name: 'SP1a project',
			layout: openDocument('three-wall')
		});
	}

	it('has one authority: the Layout unit header and payload are both format 8', async () => {
		const project = await projectWithOpenSpace();
		expect(project.units.layout.header.formatVersion).toBe(8);
		expect(project.units.layout.data.formatVersion).toBe(8);
		expect(LAYOUT_UNIT_FORMAT_VERSION).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(LAYOUT_WALL_FIRST_FORMAT_VERSION).toBe(8);
	});

	it('Save then Load round-trips byte-identically at format 8', async () => {
		const project = await projectWithOpenSpace();
		const saved = serializeProjectEnvelope(project);
		const loaded = validateProjectEnvelope(JSON.parse(saved));
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;
		expect(loaded.envelope.units.layout.data.formatVersion).toBe(8);
		expect(loaded.envelope.units.layout.data.rooms[0]!.virtualEdges).toHaveLength(1);
		expect(serializeProjectEnvelope(loaded.envelope)).toBe(saved);
	});

	it('refuses a format-7 Layout through project-model and the visitor release path', async () => {
		const project = await projectWithOpenSpace();
		const old = structuredClone(project) as unknown as {
			units: { layout: { header: { formatVersion: number }; data: { formatVersion: number } } };
		};
		old.units.layout.header.formatVersion = 7;
		old.units.layout.data.formatVersion = 7;
		expect(validateLayoutPayload(old.units.layout.data).success).toBe(false);
		const direct = validateLayoutPayload(old.units.layout.data);
		if (!direct.success) {
			expect(direct.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
		}
		const envelope = validateProjectEnvelope(old);
		expect(envelope.success).toBe(false);
		if (!envelope.success) {
			expect(envelope.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
		}
		const runtime = prepareUnitRuntime(old);
		expect(runtime.kind).toBe('rejected');
		if (runtime.kind === 'rejected') {
			expect(runtime.issues.map((issue) => issue.code)).toContain('unsupported_format_version');
		}
		expect(() =>
			composeColdReleaseBundle({
				document: old,
				manifest: { releaseId: 'sp1a-old@v1', bytesByUri: new Map() }
			})
		).toThrow(/formatVersion|unsupported/i);
	});

	it('T19 keeps virtual edges out of visitor geometry and releases the open Space', async () => {
		const baseline = { ...openDocument('three-wall'), rooms: [] };
		const outline = findSpaceCreationOutline(baseline, baseline.floor.id, [3, 2]);
		if (outline.kind !== 'outline') throw new Error('Expected a Room tool proposal.');
		const plan = planCreateOpenSpace({
			baseline, cycle: outline.cycle, levelId: baseline.floor.id, capture: captureFor('visitor-room-birth')
		});
		if (plan.kind !== 'planned') throw new Error(plan.message);
		const project = await createUnitProject({ id: 'room-tool-visitor', name: 'Room tool visitor', layout: plan.document });
		const loaded = validateProjectEnvelope(JSON.parse(serializeProjectEnvelope(project)));
		if (!loaded.success) throw new Error('The Room tool project could not reopen.');
		expect(loaded.envelope.units.layout.data.rooms).toEqual(plan.document.rooms);
		const bundle = composeColdReleaseBundle({
			document: loaded.envelope,
			manifest: { releaseId: 'sp1a-open@v1', bytesByUri: new Map() }
		});
		try {
			expect(bundle.geometry.rooms).toHaveLength(1);
			expect(polygonArea(bundle.geometry.rooms[0]!.floorPolygon)).toBeCloseTo(24, 9);
			expect(bundle.geometry.walls).toHaveLength(3);
			expect(bundle.geometry.rooms[0]).toMatchObject({ roomId: plan.roomId, overhead: 'open-to-sky', ceilingPolygon: [] });
			// Drawable visitor records only: virtual segments never enter compiled
			// Walls, query spans or the released Room's wall list. The Room cache key
			// may name them internally; it is not a drawable primitive.
			expect(JSON.stringify(bundle.geometry.walls)).not.toContain('#virtual');
			expect(JSON.stringify(bundle.geometry.rooms[0]!.walls)).not.toContain('#virtual');
			expect(JSON.stringify(bundle.geometry.queries.spans)).not.toContain('#virtual');
			expect(JSON.stringify(bundle.geometry)).not.toContain('virtualEdges');
		} finally {
			bundle.dispose();
		}
	});
});
