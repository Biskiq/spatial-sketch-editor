/**
 * P23.15 Task 3 — the Junction-aware standalone Wall mesh contract.
 *
 * The builder consumes **already-resolved** endpoint geometry; it never decides
 * whether a Junction is a miter, T, X, tangent continuation or terminal. Three
 * explicit branches, with no silent fallback:
 *
 * ```text
 * degree 1 / free end      → square terminal cap
 * connected + resolution   → consume the resolved corner + seam + bands
 * connected, no resolution → blocking issue, no mesh (fail closed)
 * ```
 *
 * These tests pin the branch behaviour and the mismatch cases the reconciled
 * plan added (thickness step, height step) rather than re-testing the Junction
 * solve itself (that lives in `layout-junction-resolution.test.ts`).
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type CompiledPhysicalWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';

function wall(
	id: string,
	startJunctionId: string,
	endJunctionId: string,
	options: Partial<Pick<LayoutWall, 'thickness' | 'height' | 'role'>> = {}
): LayoutWall {
	return {
		id,
		startJunctionId,
		endJunctionId,
		role: options.role ?? 'partition',
		thickness: options.thickness ?? 0.2,
		height: options.height ?? 3,
		centerline: { kind: 'line' }
	} as LayoutWall;
}

function document(junctions: Array<{ id: string; point: LayoutVec2 }>, walls: LayoutWall[]): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions,
		walls,
		rooms: [],
		openings: [],
		objects: []
	};
}

/** One Wall end from (0,0) bending by `degrees` at `J`, two equal Walls. */
function cornerDocument(degrees: number, options: { firstThickness?: number; secondThickness?: number } = {}) {
	const radians = (degrees * Math.PI) / 180;
	const end: LayoutVec2 = [4 * Math.cos(radians), 4 * Math.sin(radians)];
	return document(
		[
			{ id: 'ja', point: [-4, 0] },
			{ id: 'j', point: [0, 0] },
			{ id: 'jb', point: end }
		],
		[
			wall('w1', 'ja', 'j', { thickness: options.firstThickness ?? 0.2 }),
			wall('w2', 'j', 'jb', { thickness: options.secondThickness ?? 0.2 })
		]
	);
}

function build(documentValue: LayoutDocumentWallFirst, wallId: string) {
	const compilation = compileWallFirstLayoutGeometry(documentValue);
	const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === wallId)!;
	const ends = legJoinsByWall(compilation.geometry.junctions).get(wallId) ?? { start: null, end: null };
	return {
		compilation,
		compiled,
		ends,
		result: buildStandaloneWallMesh(compiled, 0, ends)
	};
}

function hasBridgeSurface(mesh: IndexedWallMesh): boolean {
	return mesh.pickRanges.some((range) => range.kind === 'wall' && range.surface === 'bridge');
}

function triangleAreaSum(mesh: IndexedWallMesh): number {
	let total = 0;
	for (let index = 0; index < mesh.indices.length; index += 3) {
		const a = mesh.indices[index]! * 3;
		const b = mesh.indices[index + 1]! * 3;
		const c = mesh.indices[index + 2]! * 3;
		const abx = mesh.positions[b]! - mesh.positions[a]!;
		const aby = mesh.positions[b + 1]! - mesh.positions[a + 1]!;
		const abz = mesh.positions[b + 2]! - mesh.positions[a + 2]!;
		const acx = mesh.positions[c]! - mesh.positions[a]!;
		const acy = mesh.positions[c + 1]! - mesh.positions[a + 1]!;
		const acz = mesh.positions[c + 2]! - mesh.positions[a + 2]!;
		const cx = aby * acz - abz * acy;
		const cy = abz * acx - abx * acz;
		const cz = abx * acy - aby * acx;
		total += 0.5 * Math.hypot(cx, cy, cz);
	}
	return total;
}

describe('P23.15 Task 3 — standalone Wall end contract', () => {
	it('builds a degree-1 terminal end as a square cap', () => {
		const built = build(cornerDocument(0), 'w1');
		// `ja` is degree 1: the compiled join exists and is terminal, so the
		// builder takes the square-cap branch rather than a miter.
		expect(built.ends.start?.kind).toBe('terminal');
		expect(built.ends.start?.corner).toBeNull();
		expect(built.result.issues).toEqual([]);
		expect(built.result.mesh).toBeDefined();
	});

	it('fails closed when a connected end has no resolved endpoint', () => {
		const built = build(cornerDocument(90), 'w1');
		const noResolution = buildStandaloneWallMesh(built.compiled, 0, null);
		expect(noResolution.mesh).toBeUndefined();
		expect(noResolution.issues.map((issue) => issue.code)).toEqual(['junction_resolution_missing']);
		expect(noResolution.issues[0]!.targetId).toBe('w1');

		// Only the *connected* end needs it: supplying just the start join for a
		// Wall whose end is connected still fails, and never square-caps.
		const partial = buildStandaloneWallMesh(built.compiled, 0, { start: built.ends.start, end: null });
		expect(partial.mesh).toBeUndefined();
		expect(partial.issues.map((issue) => issue.code)).toEqual(['junction_resolution_missing']);
	});

	it('consumes the resolved corner at 45°, 90° and 135°', () => {
		for (const degrees of [45, 90, 135]) {
			const built = build(cornerDocument(degrees), 'w1');
			expect(built.compilation.issues.filter((issue) => issue.severity !== 'warning'), `${degrees}°`).toEqual([]);
			expect(built.ends.end?.kind, `${degrees}°`).toBe('miter');
			expect(built.result.issues, `${degrees}°`).toEqual([]);
			expect(built.result.mesh, `${degrees}°`).toBeDefined();
			expect(triangleAreaSum(built.result.mesh!), `${degrees}°`).toBeGreaterThan(0);
		}
	});

	it('keeps every emitted vertex inside the compiled Wall bounds', () => {
		// Decision 12 — resolved miters can extend past the sampled band, so the
		// compile must have expanded the Wall's own bounds to cover them.
		const built = build(cornerDocument(35), 'w1');
		const mesh = built.result.mesh!;
		const bounds = built.compiled.bounds3;
		for (let index = 0; index < mesh.positions.length; index += 3) {
			expect(mesh.positions[index]!, `x @${index}`).toBeGreaterThanOrEqual(bounds.min[0] - 1e-6);
			expect(mesh.positions[index]!, `x @${index}`).toBeLessThanOrEqual(bounds.max[0] + 1e-6);
			expect(mesh.positions[index + 2]!, `z @${index}`).toBeGreaterThanOrEqual(bounds.min[2] - 1e-6);
			expect(mesh.positions[index + 2]!, `z @${index}`).toBeLessThanOrEqual(bounds.max[2] + 1e-6);
		}
	});

	it('closes the exposed thickness step of a straight continuation, with no buried cap', () => {
		const documentValue = document(
			[
				{ id: 'ja', point: [-4, 0] },
				{ id: 'j', point: [0, 0] },
				{ id: 'jb', point: [4, 0] }
			],
			[wall('w1', 'ja', 'j', { thickness: 0.2 }), wall('w2', 'j', 'jb', { thickness: 0.3 })]
		);
		const built = build(documentValue, 'w1');
		// Straight (collinear outward rays) ⇒ continuation, not a fold.
		expect(built.ends.end?.kind).toBe('suppressed');
		expect(built.result.issues).toEqual([]);
		const mesh = built.result.mesh!;
		expect(mesh).toBeDefined();
		// The step is real geometry: the thinner leg emits the exposed difference
		// surfaces of its neighbour's wider cross-section.
		expect(hasBridgeSurface(mesh)).toBe(true);

		// Only the lower-`wallId` leg emits it, so the step is painted once.
		const other = build(documentValue, 'w2');
		expect(hasBridgeSurface(other.result.mesh!)).toBe(false);
	});

	it('closes the exposed height step of a straight continuation', () => {
		const documentValue = document(
			[
				{ id: 'ja', point: [-4, 0] },
				{ id: 'j', point: [0, 0] },
				{ id: 'jb', point: [4, 0] }
			],
			[wall('w1', 'ja', 'j', { height: 1.2 }), wall('w2', 'j', 'jb', { height: 3 })]
		);
		const built = build(documentValue, 'w1');
		expect(built.ends.end?.kind).toBe('suppressed');
		expect(built.result.issues).toEqual([]);
		const mesh = built.result.mesh!;
		expect(hasBridgeSurface(mesh)).toBe(true);
		// The shorter leg emits the taller leg's cross-section above its own top,
		// so the mesh closes the step up to the taller Wall's height.
		expect(mesh.bounds.max[1]).toBeCloseTo(3, 9);
		// The taller leg keeps its full extent and stays a pure continuation.
		const taller = build(documentValue, 'w2');
		expect(taller.result.issues).toEqual([]);
		expect(taller.result.mesh!.bounds.max[1]).toBeCloseTo(3, 9);
	});

	it('emits nothing extra when a straight continuation has identical cross-sections', () => {
		// Acceptance A — a normal split inherits identical thickness/height/profile,
		// so the visible shell gains no geometry at the new Junction.
		const straight = document(
			[
				{ id: 'ja', point: [-4, 0] },
				{ id: 'jb', point: [4, 0] }
			],
			[wall('w1', 'ja', 'jb')]
		);
		const split = document(
			[
				{ id: 'ja', point: [-4, 0] },
				{ id: 'j', point: [0, 0] },
				{ id: 'jb', point: [4, 0] }
			],
			[wall('w1', 'ja', 'j'), wall('w2', 'j', 'jb')]
		);
		const unsplit = build(straight, 'w1');
		const left = build(split, 'w1');
		const right = build(split, 'w2');
		expect(left.result.issues).toEqual([]);
		expect(right.result.issues).toEqual([]);
		// No internal cap, no wedge: the two legs together cover exactly the
		// unsplit Wall's surface area.
		expect(hasBridgeSurface(left.result.mesh!)).toBe(false);
		expect(hasBridgeSurface(right.result.mesh!)).toBe(false);
		const splitArea = triangleAreaSum(left.result.mesh!) + triangleAreaSum(right.result.mesh!);
		expect(splitArea).toBeCloseTo(triangleAreaSum(unsplit.result.mesh!), 6);
		// Same visible shell extent: the two halves together span the unsplit Wall.
		expect(Math.min(left.result.mesh!.bounds.min[0], right.result.mesh!.bounds.min[0])).toBeCloseTo(
			unsplit.result.mesh!.bounds.min[0],
			9
		);
		expect(Math.max(left.result.mesh!.bounds.max[0], right.result.mesh!.bounds.max[0])).toBeCloseTo(
			unsplit.result.mesh!.bounds.max[0],
			9
		);
	});

	it('keeps a Wall that touches no Junction on the free-end path', () => {
		const compilation = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j1', point: [0, 0] },
					{ id: 'j2', point: [4, 0] }
				],
				[wall('w1', 'j1', 'j2')]
			)
		);
		const compiled: CompiledPhysicalWall = compilation.geometry.walls[0]!;
		// No Junction topology at all: `null` ends are legal, both ends are caps.
		const free = buildStandaloneWallMesh({ ...compiled, startJunctionId: undefined, endJunctionId: undefined }, 0, null);
		expect(free.issues).toEqual([]);
		expect(free.mesh).toBeDefined();
	});
});
