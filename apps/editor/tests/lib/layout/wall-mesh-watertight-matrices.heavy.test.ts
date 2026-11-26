/**
 * Heavy lane: the wall-mesh watertight matrices.
 *
 * Every `it` sweeps a family of corner, arch and opening profiles and asserts
 * watertightness across the whole family — the matrix is the invariant, so the
 * section belongs in `test:heavy`. `wall-mesh.test.ts` keeps the cheap
 * single-case representatives.
 */import { describe, expect, it } from 'vitest';
import { buildRoomWallMesh } from '$lib/layout/wall-mesh-room';
import {
	g1DocumentWithRooms,
	g1LShapedDocument,
	g1LineRectangleDocument,
	g1MultipleOpeningsDocument,
	g1Opening,
	g1ProfileMatrixDocument,
	g1RectangleRoom
} from './__fixtures__/layout-g1-fixtures';
import {
	compileRoom,
	assertEdgeMultiplicity,
	assertManifoldWithBoundary,
	assertNoTjunctions,
	assertFinite,
	rhombusDocument,
	notchDocument
} from '../../helpers/wall-mesh-fixtures';

describe('buildRoomWallMesh', () => {
	it('builds a watertight 2-manifold with boundary around opening fixtures (no T-junctions)', () => {
		for (const document of [g1LineRectangleDocument(), g1LShapedDocument(), g1MultipleOpeningsDocument(), g1ProfileMatrixDocument()]) {
			const room = compileRoom(document);
			const mesh = buildRoomWallMesh(room).mesh!;
			assertManifoldWithBoundary(mesh);
			assertNoTjunctions(mesh);
		}
	});

	it('builds watertight beveled corners past the miter limit (forced bevel)', () => {
		// A 90° corner's miter apex sits at thickness/2 · √2 ≈ 0.113; miterLimit 1
		// forces every corner into the bevel path. The bridge must close the wedge
		// (front chamfer + caps) while every wall stays on its own offset line.
		const room = compileRoom(g1DocumentWithRooms([g1RectangleRoom('room-bev', 0, 0, 6, 4)]));
		const result = buildRoomWallMesh(room, { miterLimit: 1, assertWinding: true });
		expect(result.issues).toEqual([]);
		const mesh = result.mesh!;
		assertFinite(mesh);
		assertEdgeMultiplicity(mesh, 2);
		// S5a partitions each outward face by stable Wall side; bridge faces join
		// those material groups but stay metadata-only in sectionToRange.
		expect(mesh.materialGroups.map(({ surfaceKey, paintSide }) => [surfaceKey, paintSide ?? null])).toEqual([
			['side', null], ['side', 'left'], ['side', 'right']
		]);
		let groupCursor = 0;
		for (const group of mesh.materialGroups) {
			expect(group.start).toBe(groupCursor);
			expect(group.count).toBeGreaterThan(0);
			expect(group.count % 3).toBe(0);
			groupCursor += group.count;
		}
		expect(groupCursor).toBe(mesh.indices.length);

		expect(mesh.sectionToRange).toHaveLength(12);
		expect(mesh.sectionToRange.every((range) => range.kind === 'side')).toBe(true);
		expect(mesh.sectionToRange.filter((range) => range.paintSide === undefined)).toHaveLength(4);
		expect(mesh.sectionToRange.filter((range) => range.paintSide === 'left')).toHaveLength(4);
		expect(mesh.sectionToRange.filter((range) => range.paintSide === 'right')).toHaveLength(4);

		// Every emitted triangle, including bridge geometry, has exactly one
		// contiguous owner. This protects the index-range partition independently
		// of material grouping.
		let pickCursor = 0;
		for (const range of mesh.pickRanges) {
			expect(range.start).toBe(pickCursor);
			expect(range.count).toBeGreaterThan(0);
			expect(range.count % 3).toBe(0);
			pickCursor += range.count;
		}
		expect(pickCursor).toBe(mesh.indices.length);

		const bridges = mesh.pickRanges.filter((range) => range.kind === 'wall' && range.surface === 'bridge');
		expect(bridges).toHaveLength(8);
		// Each bridge range is reachable from its authored owner and shared with
		// the adjacent wall's wallRanges entry (the pick owner remains singular).
		const cornerOwners: Array<[[number, number], string, string]> = [
			[[0, 0], 'room-bev:wall:0', 'room-bev:wall:3'],
			[[6, 0], 'room-bev:wall:1', 'room-bev:wall:0'],
			[[6, 4], 'room-bev:wall:2', 'room-bev:wall:1'],
			[[0, 4], 'room-bev:wall:3', 'room-bev:wall:2']
		];
		for (const [[cx, cz], ownerSegment, neighborSegment] of cornerOwners) {
			const atCorner = bridges.filter((range) => {
				let x = 0;
				let z = 0;
				const triangleCount = range.count / 3;
				for (let i = range.start; i < range.start + range.count; i += 3) {
					for (let j = i; j < i + 3; j += 1) {
						const index = mesh.indices[j]!;
						x += mesh.positions[index * 3]!;
						z += mesh.positions[index * 3 + 2]!;
					}
				}
				x /= triangleCount * 3;
				z /= triangleCount * 3;
				return Math.hypot(x - cx, z - cz) <= 0.15;
			});
			expect(atCorner.length).toBe(2);
			expect(new Set(atCorner.map((range) => range.segmentId))).toEqual(new Set([ownerSegment]));
			const ownerRanges = mesh.wallRanges.find((wall) => wall.segmentId === ownerSegment)!.ranges;
			const neighborRanges = mesh.wallRanges.find((wall) => wall.segmentId === neighborSegment)!.ranges;
			for (const bridge of atCorner) {
				expect(ownerRanges).toContainEqual({ start: bridge.start, count: bridge.count });
				expect(neighborRanges).toContainEqual({ start: bridge.start, count: bridge.count });
			}
		}
	});

	it('bevels acute and concave (reflex) corners watertight', () => {
		// Rhombus: acute ~63° corners (long miter apexes) — beveled at limit 1.
		// Notch: a V-notch with a reflex corner whose outer apex is long — beveled.
		for (const document of [rhombusDocument(), notchDocument()]) {
			const room = compileRoom(document);
			const result = buildRoomWallMesh(room, { miterLimit: 1, assertWinding: true });
			expect(result.issues).toEqual([]);
			const mesh = result.mesh!;
			assertFinite(mesh);
			assertEdgeMultiplicity(mesh, 2);
		}
	});

	it('welds endpoint door openings at mitered and beveled corners', () => {
		// Door at offset 0 (the wall's start) and a second door meeting the same
		// corner from the adjacent wall (both-open). Both the mitered and the
		// beveled (miterLimit 1) variants must be edge-clean manifolds.
		const single = g1DocumentWithRooms([
			g1RectangleRoom('room-d0', 0, 0, 6, 4, [g1Opening('door-0', 'room-d0:wall:0', 'door', 0, 0.9, 2.1, 0)])
		]);
		const both = g1DocumentWithRooms([
			g1RectangleRoom('room-vb', 0, 0, 6, 4, [
				g1Opening('door-a', 'room-vb:wall:0', 'door', 5.1, 0.9, 2.1, 0),
				g1Opening('door-b', 'room-vb:wall:1', 'door', 0, 0.9, 2.1, 0)
			])
		]);
		for (const [document, options] of [
			[single, undefined],
			[single, { miterLimit: 1 }],
			[both, { miterLimit: 1 }]
		] as const) {
			const room = compileRoom(document);
			const result = buildRoomWallMesh(room, { assertWinding: true, ...options });
			expect(result.issues).toEqual([]);
			const mesh = result.mesh!;
			assertFinite(mesh);
			assertEdgeMultiplicity(mesh, 2);
		}
	});

	it('closes sloped arch undersides at band crossings (profile matrix is fully watertight)', () => {
		const room = compileRoom(g1ProfileMatrixDocument());
		const result = buildRoomWallMesh(room, { assertWinding: true });
		expect(result.issues).toEqual([]);
		const mesh = result.mesh!;
		assertFinite(mesh);
		// Arch/band intersections + triangle collapse: every geometric edge is
		// shared by exactly two triangles, even with a floor-level door and
		// rounded/pointed windows whose arches cross the room breakpoints.
		assertEdgeMultiplicity(mesh, 2);
	});

	it('merges a both-open miter corner into one void (no interior jamb)', () => {
		// Two equal doors meeting at a shared miter corner form a single L-shaped
		// void: both corner jambs are interior and must be suppressed, leaving a
		// watertight manifold where every edge is owned by exactly two triangles.
		const room = compileRoom(g1DocumentWithRooms([
			g1RectangleRoom('room-vb', 0, 0, 6, 4, [
				g1Opening('door-a', 'room-vb:wall:0', 'door', 5.1, 0.9, 2.1, 0),
				g1Opening('door-b', 'room-vb:wall:1', 'door', 0, 0.9, 2.1, 0)
			])
		]));
		const result = buildRoomWallMesh(room, { assertWinding: true });
		expect(result.issues).toEqual([]);
		const mesh = result.mesh!;
		assertFinite(mesh);
		assertEdgeMultiplicity(mesh, 2);
	});

	it('closes mismatched both-open miter corners with a profile-difference reveal', () => {
		// Different door heights at the shared corner: the taller door's void
		// exposes the shorter door's lintel end over the mismatched band, which
		// must be closed by a reveal cap (not a full interior jamb).
		const room = compileRoom(g1DocumentWithRooms([
			g1RectangleRoom('room-mm', 0, 0, 6, 4, [
				g1Opening('door-a', 'room-mm:wall:0', 'door', 5.1, 0.9, 2.1, 0),
				g1Opening('door-b', 'room-mm:wall:1', 'door', 0, 0.9, 2.4, 0)
			])
		]));
		const result = buildRoomWallMesh(room, { assertWinding: true });
		expect(result.issues).toEqual([]);
		const mesh = result.mesh!;
		assertFinite(mesh);
		assertEdgeMultiplicity(mesh, 2);
	});

	it('keeps arched corner openings watertight (miter and bevel)', () => {
		const document = g1DocumentWithRooms([
			g1RectangleRoom('room-arch', 0, 0, 6, 4, [
				g1Opening('arch-0', 'room-arch:wall:0', 'door', 0, 1.4, 2.4, 0, 'rounded')
			])
		]);
		for (const options of [undefined, { miterLimit: 1 }] as const) {
			const room = compileRoom(document);
			const result = buildRoomWallMesh(room, { assertWinding: true, ...options });
			expect(result.issues).toEqual([]);
			const mesh = result.mesh!;
			assertFinite(mesh);
			assertEdgeMultiplicity(mesh, 2);
		}
	});
});
