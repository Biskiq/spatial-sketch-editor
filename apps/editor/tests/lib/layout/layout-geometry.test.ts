import { describe, expect, it } from 'vitest';
import { compileLayoutGeometrySource, compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { geometryId } from '@portfolio/layout-core';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import type { CompilerRoomSource, CompilerSource, LayoutDocumentWallFirst, LayoutVec2 } from '@portfolio/layout-core';
import {
	g1AutoBezierDocument,
	g1DocumentWithRooms,
	g1ElevatedFloorDocument,
	g1InvalidGeometryDocument,
	g1LineRectangleDocument,
	g1LShapedDocument,
	g1MultipleOpeningsDocument,
	g1ObjectMatrixDocument,
	g1ProfileMatrixDocument,
	g1RoomPolygon
} from './__fixtures__/layout-g1-fixtures';
import { normalizeForParity } from './__fixtures__/layout-g1-normalize';

/**
 * T1.P02.S05 — this suite used to drive the retired legacy document adapter
 * (`compileLayoutGeometry`). Every case now authors a canonical wall-first
 * document and compiles through the one surviving entry,
 * `compileWallFirstLayoutGeometry`; the expectations are re-expressed against
 * canonical physical Walls (`geometry.walls`) and topology-derived Rooms
 * (`geometry.rooms`), never against a Room-owned wall list.
 *
 * Two primitives cannot exist in a format-6 document at all — several Floors and
 * a zero-Floor payload — because the format carries exactly one Floor. Their
 * behaviour lives one level down in the compiler source, so they are asserted
 * there (`compileLayoutGeometrySource`) rather than deleted.
 */
describe('compileWallFirstLayoutGeometry', () => {
	it('compiles a line rectangle with ordered polygon, densified walls, sections, and bounds', () => {
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1LineRectangleDocument());
		expect(issues).toEqual([]);
		const room = geometry.rooms[0]!;
		expect(room.roomId).toBe('room-rectangle');
		expect(room.floorPolygon).toHaveLength(4);
		expect(room.floorElevation).toBe(0);
		// The Room ceiling is derived from its boundary Wall heights (3 m).
		expect(room.ceilingElevation).toBe(3);
		expect(room.walls).toEqual([]);
		expect(geometry.walls.map((wall) => wall.wallId)).toEqual([
			'room-rectangle:wall:0',
			'room-rectangle:wall:1',
			'room-rectangle:wall:2',
			'room-rectangle:wall:3'
		]);
		for (const wall of geometry.walls) {
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
		const { geometry } = compileWallFirstLayoutGeometry(g1LShapedDocument());
		const room = geometry.rooms[0]!;
		expect(room.floorPolygon).toHaveLength(6);
		expect(geometry.walls.map((wall) => wall.wallId)).toEqual([
			'room-l:wall:0',
			'room-l:wall:1',
			'room-l:wall:2',
			'room-l:wall:3',
			'room-l:wall:4',
			'room-l:wall:5'
		]);
	});

	it('samples a curved Wall adaptively with monotonic distances and unit frames', () => {
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1AutoBezierDocument());
		expect(issues).toEqual([]);
		const bezierWall = geometry.walls.find((wall) => wall.wallId === 'room-rectangle:wall:0')!;
		expect(bezierWall.samples.length).toBeGreaterThan(2);
		for (let index = 1; index < bezierWall.samples.length; index += 1) {
			expect(bezierWall.samples[index]!.distance).toBeGreaterThan(bezierWall.samples[index - 1]!.distance);
			expect(bezierWall.samples[index]!.distance - bezierWall.samples[index - 1]!.distance).toBeLessThanOrEqual(0.25 + 1e-6);
		}
		expect(bezierWall.length).toBeGreaterThan(6);
	});

	it('splits multiple openings into ordered sill/lintel/side sections without issues', () => {
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1MultipleOpeningsDocument());
		expect(issues).toEqual([]);
		const wall = geometry.walls.find((candidate) => candidate.wallId === 'room-openings:wall:0')!;
		expect(wall.openings.map((opening) => opening.openingId)).toEqual(['door-1', 'window-1']);
		expect(wall.sections.some((section) => section.kind === 'lintel')).toBe(true);
		expect(wall.sections.some((section) => section.kind === 'side' && section.openingId === 'window-1')).toBe(true);
		expect(wall.solidSpans.length).toBeGreaterThan(0);
	});

	it('derives all three opening elevation profiles and resolved solid-span bottoms', () => {
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1ProfileMatrixDocument());
		expect(issues).toEqual([]);
		const wall = geometry.walls.find((candidate) => candidate.wallId === 'room-profiles:wall:0')!;
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
		const { geometry } = compileWallFirstLayoutGeometry(g1ElevatedFloorDocument());
		const room = geometry.rooms[0]!;
		expect(room.floorElevation).toBe(2.5);
		// The datum plus the 4 m boundary Wall height.
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
		const { geometry, issues } = compileWallFirstLayoutGeometry(document);
		expect(issues.some((issue) => issue.code === 'object_invalid' && issue.targetId === 'obj-bad')).toBe(true);
		expect(geometry.objects.map((object) => object.objectId)).not.toContain('obj-bad');
		expect(geometry.objects.map((object) => object.objectId)).toContain('obj-box');
	});

	it('compiles object descriptors with stored transforms, footprints, and readonly profile', () => {
		const { geometry } = compileWallFirstLayoutGeometry(g1ObjectMatrixDocument());
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
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1InvalidGeometryDocument());
		expect(geometry.rooms.map((room) => room.roomId)).toEqual(['room-good']);
		expect(issues.some((issue) => issue.code === 'disconnected_boundary')).toBe(true);
		expect(issues.some((issue) => issue.code === 'self_intersection')).toBe(true);
	});

	// PR #115 (§7.2 A′): "compiles the canonical Chopin project with stable order".
	// Every expectation in that case named Chopin Rooms, Chopin elevations and a
	// Chopin Opening id, so it is a frozen-product golden and now belongs to the
	// external frozen project's own suite. Its kernel half — that a document's
	// room order is the compiled order with no blocking issues — is covered above
	// by the G1 fixtures with the same expectations.

	it('is deterministic and does not mutate a deep-frozen document', () => {
		const document = g1AutoBezierDocument();
		const frozen = Object.freeze(JSON.parse(JSON.stringify(document)));
		const first = compileWallFirstLayoutGeometry(frozen as never);
		const second = compileWallFirstLayoutGeometry(frozen as never);
		expect(normalizeForParity(first)).toEqual(normalizeForParity(second));
		expect(second.issues).toEqual([]);
	});

	it('rejects pathological finite line lengths with structured sampling issues', () => {
		const points: LayoutVec2[] = [
			[0, 0],
			[1e15, 0],
			[1e15, 1],
			[0, 1]
		];
		const document = g1DocumentWithRooms([g1RoomPolygon('room-huge', points)]);

		const result = compileWallFirstLayoutGeometry(document);
		expect(result.geometry.rooms).toEqual([]);
		expect(result.issues.some((issue) => issue.code === 'sampling_budget_exceeded')).toBe(true);
	});

	it('rejects finite coordinates whose derived line length overflows', () => {
		const points: LayoutVec2[] = [
			[1e308, 0],
			[-1e308, 0],
			[-1e308, 1],
			[1e308, 1]
		];
		const document = g1DocumentWithRooms([g1RoomPolygon('room-overflow', points)]);

		const result = compileWallFirstLayoutGeometry(document);
		expect(result.geometry.rooms).toEqual([]);
		expect(result.issues.some((issue) => issue.code === 'sampling_length_invalid')).toBe(true);
	});

	it('emits identities and complete point-query metadata', () => {
		const { geometry, issues } = compileWallFirstLayoutGeometry(g1AutoBezierDocument());
		expect(issues).toEqual([]);
		const entities = [
			...geometry.floors,
			...geometry.rooms,
			...geometry.walls,
			...geometry.walls.flatMap((wall) => wall.openings),
			...geometry.objects
		];
		for (const entity of entities) {
			expect(entity.id.length).toBeGreaterThan(0);
			expect(entity.cacheKey.length).toBeGreaterThan(0);
		}
		expect(geometry.queries.points.length).toBeGreaterThan(0);
		for (const point of geometry.queries.points) {
			expect(['vertex', 'interior-anchor']).toContain(point.kind);
			expect(point.sourceId.length).toBeGreaterThan(0);
			// Wall-first points belong to a canonical physical Wall, never a faked Room.
			expect(point.roomId).toBeUndefined();
			expect(point.segmentId).toBe(point.wallKey);
			expect(point.aabb.min).toEqual(point.point);
			expect(point.aabb.max).toEqual(point.point);
		}
	});

	// P23 review round 2 / B1 retired the room-qualified legacy wall identity: a
	// format-6 Wall is document-global and exists once, so "two Rooms with the
	// same segment name" can no longer describe two walls. The surviving
	// invariant — one representation per Wall, with a document-global `wallKey`
	// — is asserted by "emits each wall-first Wall once" below.

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
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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
		// Exactly one query representation: no fake room ownership, one wallKey,
		// and no span collapsed into another — span identity stays unique, which
		// the retired room-qualified case also pinned before its name depended on
		// two Rooms owning a same-named segment.
		for (const span of wallASpans) expect(span.roomId).toBeUndefined();
		expect(new Set(wallASpans.map((span) => span.wallKey))).toEqual(new Set(['wall-a']));
		expect(new Set(wallASpans.map((span) => span.id)).size).toBe(wallASpans.length);
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
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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
				{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-b', startJunctionId: 'j-b', endJunctionId: 'j-c', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-c', startJunctionId: 'j-c', endJunctionId: 'j-d', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const},
				{ id: 'wall-d', startJunctionId: 'j-d', endJunctionId: 'j-a', thickness: 0.2, height: 3, centerline: { kind: 'line' } as const}
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
});

/**
 * The shared compile core, exercised at its own seam for the two inputs a
 * format-6 document can never produce: several Floors, and no Floor at all.
 * These are the successor of the legacy adapter's multi-floor/empty-document
 * cases (P23 review round 1 / B1, "empty-floors parity"); the defect they
 * detect is unchanged — a per-Floor loop that drops a Floor or materializes a
 * placeholder for an absent one.
 */
describe('compileLayoutGeometrySource floor loop', () => {
	function lineRectangleRoom(id: string, x: number, z: number, width: number, depth: number): CompilerRoomSource {
		const corners: LayoutVec2[] = [
			[x, z],
			[x + width, z],
			[x + width, z + depth],
			[x, z + depth]
		];
		return {
			room: { id, wallThickness: 0.16, floorThickness: 0.1, ceilingThickness: 0.1 },
			boundary: {
				closed: true,
				segments: corners.map((start, index) => ({
					id: `${id}:wall:${index}`,
					kind: 'line' as const,
					start,
					end: corners[(index + 1) % corners.length]!
				}))
			},
			openings: []
		};
	}

	function selfIntersectingRoom(id: string, x: number, z: number): CompilerRoomSource {
		const segment = (index: number, start: LayoutVec2, end: LayoutVec2) => ({
			id: `${id}:wall:${index}`,
			kind: 'line' as const,
			start,
			end
		});
		return {
			room: { id, wallThickness: 0.16, floorThickness: 0.1, ceilingThickness: 0.1 },
			boundary: {
				closed: true,
				segments: [
					segment(0, [x, z], [x + 6, z]),
					segment(1, [x + 6, z], [x, z + 3]),
					segment(2, [x, z + 3], [x + 6, z + 3]),
					segment(3, [x + 6, z + 3], [x, z])
				]
			},
			openings: []
		};
	}

	it('compiles every floor with its own elevation frame (B1 regression)', () => {
		const source: CompilerSource = {
			floors: [
				{ floor: { id: 'floor-ground', elevation: 0, height: 3 }, rooms: [lineRectangleRoom('room-ground', 0, 0, 4, 4)] },
				{ floor: { id: 'floor-upper', elevation: 3.2, height: 2.8 }, rooms: [lineRectangleRoom('room-upper', 10, 0, 3, 3)] }
			],
			objects: []
		};

		const { geometry, issues } = compileLayoutGeometrySource(source);
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

	it('keeps issue paths floor-indexed when a later floor has a bad room (B1)', () => {
		const source: CompilerSource = {
			floors: [
				{ floor: { id: 'floor-ground', elevation: 0, height: 3 }, rooms: [lineRectangleRoom('room-ground', 0, 0, 4, 4)] },
				{
					floor: { id: 'floor-upper', elevation: 3.2, height: 2.8 },
					rooms: [lineRectangleRoom('room-upper', 10, 0, 3, 3), selfIntersectingRoom('room-broken', 20, 0)]
				}
			],
			objects: []
		};

		const { issues } = compileLayoutGeometrySource(source);
		expect(issues.length).toBeGreaterThan(0);
		for (const issue of issues) {
			expect(issue.path.startsWith('floors[1].rooms[1]')).toBe(true);
		}
	});

	// Review round 1 nit: an empty-floors payload must compile to zero floors —
	// no placeholder floor materialized.
	it('compiles an empty-floor payload to zero floors (pre-cutover parity)', () => {
		const { geometry, issues } = compileLayoutGeometrySource({ floors: [], objects: [] });
		expect(issues).toEqual([]);
		expect(geometry.floors).toEqual([]);
		expect(geometry.rooms).toEqual([]);
		expect(geometry.bounds).toBeNull();
	});
});
