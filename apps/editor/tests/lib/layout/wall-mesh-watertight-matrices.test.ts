/**
 * Heavy lane (T4): the wall-mesh watertight matrices.
 *
 * Moved verbatim out of `wall-mesh-builder.test.ts`, which keeps the cheap
 * single-case representatives in `test:fast` (plain rectangle manifold,
 * L-shaped weld, lintel/reveal surfaces, UVs, winding guard, rejections,
 * pickRanges). Every `it` here sweeps a family of corner, arch and opening
 * profiles and asserts watertightness across the whole family — the matrix is
 * the invariant, so the section belongs in `test:heavy`. The `describe` title
 * is retained so the full test names are unchanged.
 */import { describe, expect, it } from 'vitest';
import { buildRoomWallMesh } from '$lib/layout/wall-mesh-builder';
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
		// Bridge faces are metadata-only: they must not leak into sectionToRange
		// (the reviewer's contract) nor create a second material group.
		expect(mesh.sectionToRange.length).toBe(4);
		expect(mesh.materialGroups.map((group) => group.surfaceKey)).toEqual(['side']);
		// Bridge geometry is still reachable through the shared wallRanges entry.
		expect(mesh.wallRanges.some((wall) => wall.ranges.length > 1)).toBe(true);
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
