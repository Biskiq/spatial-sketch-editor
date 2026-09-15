import { describe, expect, it } from 'vitest';
import { chopinProject } from '$lib/content/chopin-project';
import { compileLayoutGeometry, compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import { geometryId } from '$lib/layout/layout-geometry-types';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
import type { LayoutDocument } from '$lib/layout/layout-types';
import {
	g1AutoBezierDocument,
	g1DocumentWithRooms,
	g1ElevatedFloorDocument,
	g1LineSegments,
	g1InvalidGeometryDocument,
	g1LineRectangleDocument,
	g1LShapedDocument,
	g1MultipleOpeningsDocument,
	g1ObjectMatrixDocument,
	g1ProfileMatrixDocument,
	g1RectangleRoom
} from './__fixtures__/layout-g1-fixtures';
import { normalizeForParity } from './__fixtures__/layout-g1-normalize';

describe('compileLayoutGeometry', () => {
	it('compiles a line rectangle with ordered polygon, densified lines, sections, and bounds', () => {
		const { geometry, issues } = compileLayoutGeometry(g1LineRectangleDocument());
		expect(issues).toEqual([]);
		const room = geometry.rooms[0]!;
		expect(room.roomId).toBe('room-rectangle');
		expect(room.floorPolygon).toHaveLength(4);
		expect(room.floorElevation).toBe(0);
		expect(room.ceilingElevation).toBe(3);
		expect(room.walls).toHaveLength(4);
		for (const wall of room.walls) {
			// 0.25 m max sample span densifies the 6 m and 4 m edges.
			expect(wall.samples.length).toBeGreaterThan(1);
			for (const sample of wall.samples) {
				expect(Number.isFinite(sample.point[0])).toBe(true);
				expect(Number.isFinite(sample.point[1])).toBe(true);
				expect(Math.hypot(sample.tangent[0], sample.tangent[1])).toBeCloseTo(1, 9);
				expect(Math.hypot(sample.normal[0], sample.normal[1])).toBeCloseTo(1, 9);
			}
			expect(wall.sections.some((section) => section.kind === 'side')).toBe(true);
		}
		expect(geometry.bounds).not.toBeNull();
	});

	it('keeps L-shaped room polygon order and line density', () => {
		const { geometry } = compileLayoutGeometry(g1LShapedDocument());
		const room = geometry.rooms[0]!;
		expect(room.floorPolygon).toHaveLength(6);
		expect(room.walls.map((wall) => wall.segmentId)).toEqual([
			'room-l:wall:0',
			'room-l:wall:1',
			'room-l:wall:2',
			'room-l:wall:3',
			'room-l:wall:4',
			'room-l:wall:5'
		]);
	});

	it('samples auto-bezier adaptively with monotonic distances and unit frames', () => {
		const { geometry, issues } = compileLayoutGeometry(g1AutoBezierDocument());
		expect(issues).toEqual([]);
		const bezierWall = geometry.rooms[0]!.walls[0]!;
		expect(bezierWall.samples.length).toBeGreaterThan(2);
		for (let index = 1; index < bezierWall.samples.length; index += 1) {
			expect(bezierWall.samples[index]!.distance).toBeGreaterThan(bezierWall.samples[index - 1]!.distance);
			expect(bezierWall.samples[index]!.distance - bezierWall.samples[index - 1]!.distance).toBeLessThanOrEqual(0.25 + 1e-6);
		}
		expect(bezierWall.length).toBeGreaterThan(6);
	});

	it('splits multiple openings into ordered sill/lintel/side sections without issues', () => {
		const { geometry, issues } = compileLayoutGeometry(g1MultipleOpeningsDocument());
		expect(issues).toEqual([]);
		const wall = geometry.rooms[0]!.walls.find((candidate) => candidate.segmentId === 'room-openings:wall:0')!;
		expect(wall.openings.map((opening) => opening.openingId)).toEqual(['door-1', 'window-1']);
		expect(wall.sections.some((section) => section.kind === 'lintel')).toBe(true);
		expect(wall.sections.some((section) => section.kind === 'side' && section.openingId === 'window-1')).toBe(true);
		expect(wall.solidSpans.length).toBeGreaterThan(0);
	});

	it('derives all three opening elevation profiles and resolved solid-span bottoms', () => {
		const { geometry, issues } = compileLayoutGeometry(g1ProfileMatrixDocument());
		expect(issues).toEqual([]);
		const wall = geometry.rooms[0]!.walls[0]!;
		const profiles = wall.openings.map((opening) => [opening.openingId, opening.profile] as const);
		expect(profiles).toEqual([
			['rect', 'rectangular'],
			['rounded', 'rounded'],
			['pointed', 'pointed']
		]);
		expect(wall.openings[1]!.profileShape).toBeDefined();
		expect(wall.openings[2]!.profileShape).toBeDefined();
		const lintelSpans = wall.solidSpans.filter((span) => wall.sections[span.sectionIndex]!.kind === 'lintel');
		expect(lintelSpans.length).toBeGreaterThan(0);
	});

	it('preserves elevated floor Y extents', () => {
		const { geometry } = compileLayoutGeometry(g1ElevatedFloorDocument());
		const room = geometry.rooms[0]!;
		expect(room.floorElevation).toBe(2.5);
		expect(room.ceilingElevation).toBe(6.5);
		expect(geometry.bounds!.min[1]).toBeCloseTo(2.5 - room.floorThickness, 9);
		expect(geometry.bounds!.max[1]).toBeCloseTo(6.5 + room.ceilingThickness, 9);
	});

	it('emits an object-targeted issue and omits invalid objects', () => {
		const document = g1ObjectMatrixDocument();
		document.objects.push({
			id: 'obj-bad',
			kind: 'box',
			position: [1, 0.5, 1],
			rotation: [0, 0, 0],
			dimensions: [0, 1, 1],
			roomId: 'room-objects'
		});
		const { geometry, issues } = compileLayoutGeometry(document);
		expect(issues.some((issue) => issue.code === 'object_invalid' && issue.targetId === 'obj-bad')).toBe(true);
		expect(geometry.objects.map((object) => object.objectId)).not.toContain('obj-bad');
		expect(geometry.objects.map((object) => object.objectId)).toContain('obj-box');
	});

	it('compiles object descriptors with stored transforms, footprints, and readonly profile', () => {
		const { geometry } = compileLayoutGeometry(g1ObjectMatrixDocument());
		expect(geometry.objects.map((object) => object.objectId)).toEqual([
			'obj-box',
			'obj-plane',
			'obj-cylinder',
			'obj-sphere',
			'obj-profile'
		]);
		const sphere = geometry.objects.find((object) => object.objectId === 'obj-sphere')!;
		expect(sphere.dimensions).toEqual([1.2, 0.8, 1.2]);
		expect(sphere.planFootprint.length).toBeGreaterThan(2);
		const profile = geometry.objects.find((object) => object.objectId === 'obj-profile')!;
		expect(profile.readonly).toBe(true);
	});

	it('returns structured issues and still compiles the valid room', () => {
		const { geometry, issues } = compileLayoutGeometry(g1InvalidGeometryDocument());
		expect(geometry.rooms.map((room) => room.roomId)).toEqual(['room-good']);
		expect(issues.some((issue) => issue.code === 'disconnected_boundary')).toBe(true);
		expect(issues.some((issue) => issue.code === 'self_intersection')).toBe(true);
	});

	it('compiles the canonical Chopin project with stable order and no blocking issues', () => {
		const { geometry, issues } = compileLayoutGeometry(chopinProject.layout);
		expect(issues).toEqual([]);
		expect(geometry.rooms.map((room) => room.roomId)).toEqual([
			'entrance',
			'poland',
			'departure',
			'paris',
			'workshop',
			'music-chamber',
			'legacy'
		]);
		expect(geometry.rooms.every((room) => room.floorElevation === 0 && room.ceilingElevation === 4.2)).toBe(true);
		const entrance = geometry.rooms[0]!;
		const doorWall = entrance.walls.find((wall) => wall.segmentId === 'room:entrance:wall:pos-x')!;
		expect(doorWall.sections.some((section) => section.kind === 'side')).toBe(true);
		expect(doorWall.sections.some((section) => section.kind === 'lintel')).toBe(true);
		expect(doorWall.openings.some((opening) => opening.openingId === 'opening:entrance:entrance-from-legacy')).toBe(true);
	});

	it('is deterministic and does not mutate a deep-frozen document', () => {
		const document = g1AutoBezierDocument();
		const frozen = Object.freeze(JSON.parse(JSON.stringify(document)));
		const first = compileLayoutGeometry(frozen as never);
		const second = compileLayoutGeometry(frozen as never);
		expect(normalizeForParity(first)).toEqual(normalizeForParity(second));
		expect(second.issues).toEqual([]);
	});

	it('rejects pathological finite line lengths with structured sampling issues', () => {
		const document = g1LineRectangleDocument();
		const room = document.floors[0]!.rooms[0]!;
		room.boundary.segments = [
			{ id: 'huge:0', kind: 'line', start: [0, 0], end: [1e15, 0] },
			{ id: 'huge:1', kind: 'line', start: [1e15, 0], end: [1e15, 1] },
			{ id: 'huge:2', kind: 'line', start: [1e15, 1], end: [0, 1] },
			{ id: 'huge:3', kind: 'line', start: [0, 1], end: [0, 0] }
		];

		const result = compileLayoutGeometry(document);
		expect(result.geometry.rooms).toEqual([]);
		expect(result.issues.some((issue) => issue.code === 'sampling_budget_exceeded')).toBe(true);
	});

	it('rejects finite coordinates whose derived line length overflows', () => {
		const document = g1LineRectangleDocument();
		const room = document.floors[0]!.rooms[0]!;
		room.boundary.segments = [
			{ id: 'overflow:0', kind: 'line', start: [1e308, 0], end: [-1e308, 0] },
			{ id: 'overflow:1', kind: 'line', start: [-1e308, 0], end: [-1e308, 1] },
			{ id: 'overflow:2', kind: 'line', start: [-1e308, 1], end: [1e308, 1] },
			{ id: 'overflow:3', kind: 'line', start: [1e308, 1], end: [1e308, 0] }
		];

		const result = compileLayoutGeometry(document);
		expect(result.geometry.rooms).toEqual([]);
		expect(result.issues.some((issue) => issue.code === 'sampling_length_invalid')).toBe(true);
	});

	it('emits identities and complete point-query metadata', () => {
		const { geometry, issues } = compileLayoutGeometry(g1AutoBezierDocument());
		expect(issues).toEqual([]);
		const entities = [
			...geometry.floors,
			...geometry.rooms,
			...geometry.rooms.flatMap((room) => room.walls),
			...geometry.rooms.flatMap((room) => room.openings),
			...geometry.objects
		];
		for (const entity of entities) {
			expect(entity.id.length).toBeGreaterThan(0);
			expect(entity.cacheKey.length).toBeGreaterThan(0);
		}
		for (const point of geometry.queries.points) {
			expect(['vertex', 'interior-anchor']).toContain(point.kind);
			expect(point.sourceId.length).toBeGreaterThan(0);
			expect(point.roomId).toBe('room-rectangle');
			expect(point.aabb.min).toEqual(point.point);
			expect(point.aabb.max).toEqual(point.point);
		}
	});

	it('qualifies same-named wall query records by room', () => {
		const document = g1LineRectangleDocument();
		const first = document.floors[0]!.rooms[0]!;
		const second = structuredClone(first);
		second.id = 'room-second';
		second.name = 'Second';
		second.boundary.segments = second.boundary.segments.map((segment) => ({
			...segment,
			start: [segment.start[0] + 20, segment.start[1]],
			end: [segment.end[0] + 20, segment.end[1]]
		}));
		second.boundary.segments[0]!.id = first.boundary.segments[0]!.id;
		document.floors[0]!.rooms.push(second);

		const { geometry, issues } = compileLayoutGeometry(document);
		expect(issues).toEqual([]);
		const sharedId = first.boundary.segments[0]!.id;
		const spans = geometry.queries.spans.filter(
			(span) => span.kind === 'wall' && span.segmentId === sharedId
		);
		expect(new Set(spans.map((span) => span.roomId))).toEqual(
			new Set(['room-rectangle', 'room-second'])
		);
		expect(new Set(spans.map((span) => span.id)).size).toBe(spans.length);
		// P23.2 review round 2 / B1: legacy wall identity is room-qualified —
		// same-named segments of different rooms carry distinct wallKeys so
		// snap/align consumers never merge them into one fake wall. The key
		// is the length-prefixed tuple (delimiter joining would collide
		// because `:` is legal inside ids).
		const floorId = document.floors[0]!.id;
		expect(new Set(spans.map((span) => span.wallKey))).toEqual(
			new Set([
				geometryId([floorId, 'room-rectangle', sharedId]),
				geometryId([floorId, 'room-second', sharedId])
			])
		);
	});

	// P23.9 canonical physical Walls: every document Wall compiles exactly
	// once (wall-start frame, document-global ID, no fake roomId), so a wall
	// shared by two Rooms has one physical/query representation, not one per
	// incident Room. Rooms keep floor polygons + floor/ceiling semantics only.
	it('emits each wall-first Wall once with no per-Room wall duplication', () => {
		const document: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j-a', point: [0, 0] },
				{ id: 'j-b', point: [6, 0] },
				{ id: 'j-c', point: [6, 4] },
				{ id: 'j-d', point: [0, 4] }
			],
			walls: [
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
			],
			rooms: [
				{
					id: 'room-main',
					name: 'Main Room',
					boundary: [
						{ wallId: 'wall-a', direction: 'forward' },
						{ wallId: 'wall-b', direction: 'forward' },
						{ wallId: 'wall-c', direction: 'forward' },
						{ wallId: 'wall-d', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				},
				{
					id: 'room-second',
					name: 'Second Room',
					// Shares wall-a reversed — the same physical wall.
					boundary: [
						{ wallId: 'wall-a', direction: 'reverse' },
						{ wallId: 'wall-d', direction: 'reverse' },
						{ wallId: 'wall-c', direction: 'reverse' },
						{ wallId: 'wall-b', direction: 'reverse' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [],
			objects: []
		};
		const { geometry } = compileWallFirstLayoutGeometry(document);
		// One canonical wall per document Wall, unique IDs covering all four.
		expect(geometry.walls.map((wall) => wall.wallId).sort()).toEqual(['wall-a', 'wall-b', 'wall-c', 'wall-d']);
		// Rooms keep identity + floor semantics with empty wall detail.
		for (const room of geometry.rooms) {
			expect(room.walls).toEqual([]);
			expect(room.openings).toEqual([]);
			expect(room.floorPolygon).toHaveLength(4);
		}
		const wallASpans = geometry.queries.spans.filter(
			(span) => span.kind === 'wall' && span.segmentId === 'wall-a'
		);
		expect(wallASpans.length).toBeGreaterThan(0);
		// Exactly one query representation: no fake room ownership, one wallKey.
		for (const span of wallASpans) expect(span.roomId).toBeUndefined();
		expect(new Set(wallASpans.map((span) => span.wallKey))).toEqual(new Set(['wall-a']));
	});

	it('roomless physical Walls expand floor bounds and floor/document query AABBs', () => {
		const document: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j-a', point: [0, 0] },
				{ id: 'j-b', point: [4, 0] }
			],
			walls: [
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
			],
			rooms: [],
			openings: [],
			objects: []
		};
		const { geometry } = compileWallFirstLayoutGeometry(document);
		expect(geometry.walls).toHaveLength(1);
		const wall = geometry.walls[0]!;
		// Top-level bounds include the wall.
		expect(geometry.bounds).not.toBeNull();
		// The aggregate floor record includes the wall (previously null/stale
		// for roomless documents: the shared core only sees Rooms + objects).
		expect(geometry.floors).toHaveLength(1);
		const compiledFloor = geometry.floors[0]!;
		expect(compiledFloor.bounds3).not.toBeNull();
		for (const axis of [0, 1, 2] as const) {
			expect(compiledFloor.bounds3!.min[axis]).toBeLessThanOrEqual(wall.bounds3.min[axis]);
			expect(compiledFloor.bounds3!.max[axis]).toBeGreaterThanOrEqual(wall.bounds3.max[axis]);
			expect(geometry.bounds!.min[axis]).toBeLessThanOrEqual(wall.bounds3.min[axis]);
			expect(geometry.bounds!.max[axis]).toBeGreaterThanOrEqual(wall.bounds3.max[axis]);
		}
		// Aggregate query AABBs exist and span the wall footprint — exactly
		// one each (recomputed, never a stale duplicate).
		const floorAabbs = geometry.queries.aabbs.filter((aabb) => aabb.kind === 'floor');
		const documentAabbs = geometry.queries.aabbs.filter((aabb) => aabb.kind === 'document');
		expect(floorAabbs).toHaveLength(1);
		expect(documentAabbs).toHaveLength(1);
		expect(floorAabbs[0]!.sourceId).toBe('floor-1');
		for (const aabb of [floorAabbs[0]!, documentAabbs[0]!]) {
			expect(aabb.aabb.min[0]).toBeLessThanOrEqual(0);
			expect(aabb.aabb.max[0]).toBeGreaterThanOrEqual(4);
		}
	});

	// P23.6I D7 (review closeout): a Room whose boundary cannot resolve never
	// acquires an invented ceiling — the shared core skips it with a blocking
	// `room_ceiling_undefined` issue instead of compiling a fake zero-height
	// Room at the floor elevation.
	it('skips a wall-first Room with no resolvable boundary instead of inventing a zero-height ceiling', () => {
		const document: LayoutDocumentWallFirst = {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: [
				{ id: 'j-a', point: [0, 0] },
				{ id: 'j-b', point: [4, 0] },
				{ id: 'j-c', point: [4, 3] },
				{ id: 'j-d', point: [0, 3] }
			],
			walls: [
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
			],
			rooms: [
				{
					id: 'room-ok',
					name: 'Ok Room',
					boundary: [
						{ wallId: 'wall-a', direction: 'forward' },
						{ wallId: 'wall-b', direction: 'forward' },
						{ wallId: 'wall-c', direction: 'forward' },
						{ wallId: 'wall-d', direction: 'forward' }
					],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				},
				{
					id: 'room-broken',
					name: 'Broken Room',
					boundary: [{ wallId: 'wall-missing', direction: 'forward' }],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				},
				{
					id: 'room-empty',
					name: 'Empty Room',
					boundary: [],
					floorThickness: 0.1,
					ceilingThickness: 0.1
				}
			],
			openings: [],
			objects: []
		};
		const { geometry, issues } = compileWallFirstLayoutGeometry(document);
		// Only the resolvable Room compiles, with its derived ceiling.
		expect(geometry.rooms.map((room) => room.roomId).sort()).toEqual(['room-ok']);
		expect(geometry.rooms[0]!.ceilingElevation).toBe(3);
		// No fabricated zero-height ceiling anywhere.
		for (const room of geometry.rooms) {
			expect(room.ceilingElevation).toBeGreaterThan(0);
		}
		// Both malformed Rooms block by name.
		const ceilingIssues = issues.filter((issue) => issue.code === 'room_ceiling_undefined');
		expect(ceilingIssues.map((issue) => issue.targetId).sort()).toEqual(['room-broken', 'room-empty']);
		for (const issue of ceilingIssues) expect(issue.severity).not.toBe('warning');
	});

	// P23 review round 1 / B1: the compiler cutover briefly compiled only
	// floors[0]; multi-floor legacy documents must compile every floor with
	// its own elevation frame.
	it('compiles every floor of a multi-floor legacy document (B1 regression)', () => {
		const document = g1DocumentWithRooms([g1RectangleRoom('room-ground', 0, 0, 4, 4)]);
		document.floors.push({
			id: 'floor-upper',
			name: 'Upper Floor',
			elevation: 3.2,
			height: 2.8,
			rooms: [g1RectangleRoom('room-upper', 10, 0, 3, 3)]
		});

		const { geometry, issues } = compileLayoutGeometry(document);
		expect(issues).toEqual([]);

		expect(geometry.floors).toHaveLength(2);
		expect(geometry.floors.map((floor) => floor.floorId)).toEqual(['floor-ground', 'floor-upper']);

		const ground = geometry.rooms.find((room) => room.roomId === 'room-ground')!;
		const upper = geometry.rooms.find((room) => room.roomId === 'room-upper')!;
		expect(ground.floorElevation).toBe(0);
		expect(ground.ceilingElevation).toBe(3);
		expect(upper.floorElevation).toBe(3.2);
		expect(upper.ceilingElevation).toBe(6);

		const floorAabbs = geometry.queries.aabbs.filter((aabb) => aabb.kind === 'floor');
		expect(floorAabbs.map((aabb) => aabb.sourceId)).toEqual(['floor-ground', 'floor-upper']);

		// Document bounds span both floors.
		expect(geometry.bounds).not.toBeNull();
		expect(geometry.bounds!.max[1]).toBeCloseTo(6.1, 9);
	});

	it('keeps legacy issue paths floor-indexed when a later floor has a bad room (B1)', () => {
		const document = g1DocumentWithRooms([g1RectangleRoom('room-ground', 0, 0, 4, 4)]);
		document.floors.push({
			id: 'floor-upper',
			name: 'Upper Floor',
			elevation: 3.2,
			height: 2.8,
			rooms: [g1RectangleRoom('room-upper', 10, 0, 3, 3)]
		});
		const broken = g1RectangleRoom('room-broken', 20, 0, 3, 3);
		// Self-intersecting boundary: the closing edge crosses the first edge.
		broken.boundary.segments = g1LineSegments(
			[
				[20, 0],
				[26, 0],
				[20, 3],
				[26, 3]
			],
			'room-broken:wall'
		);
		document.floors[1]!.rooms.push(broken);

		const { issues } = compileLayoutGeometry(document);
		expect(issues.length).toBeGreaterThan(0);
		for (const issue of issues) {
			expect(issue.path.startsWith('floors[1].rooms[1]')).toBe(true);
		}
	});

	// Review round 1 nit: an empty-floors document must compile to zero
	// floors — exactly what the pre-cutover per-floor loop produced — with
	// no placeholder floor materialized.
	it('compiles an empty-floors document to zero floors (pre-cutover parity)', () => {
		const empty: LayoutDocument = { units: 'meters', floors: [], objects: [] };
		const { geometry, issues } = compileLayoutGeometry(empty);
		expect(issues).toEqual([]);
		expect(geometry.floors).toEqual([]);
		expect(geometry.rooms).toEqual([]);
		expect(geometry.bounds).toBeNull();
	});
});
