/**
 * T1 V3b — the certified Wall strip agrees with the rendered Junction solid.
 *
 * The reference is the editor Wall mesh, an independent construction of each
 * Junction (bands split at both endpoint profiles, a wedge capped only where
 * both Walls are solid). For straight Walls under a shed every top face is
 * planar, so D = underside - top is affine on it and its extremes over the
 * rendered top surface lie exactly at that surface's vertices: no sampling, no
 * strip. The
 * mesh stores Float32 positions, so agreement is asserted to that precision
 * (about 1e-7 m here); the defects it guards are decimetres.
 */
import { describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	compiledWallStrip,
	regionUndersideAt,
	regionWallVerticalExtrema,
	REGION_WALL_RELATION_EPSILON,
	type RegionFormFacts
} from '@portfolio/layout-core/room';
import {
	legJoinsByWall,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '@portfolio/layout-core/wall';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';

function wall(id: string, a: string, b: string, height: number, top: LayoutWall['top'] = { kind: 'level' }): LayoutWall {
	return { id, startJunctionId: a, endJunctionId: b, thickness: 0.2, height, top, centerline: { kind: 'line' } } as LayoutWall;
}

function layout(points: Record<string, LayoutVec2>, walls: LayoutWall[]): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings: [],
		objects: [],
		regions: []
	} as unknown as LayoutDocumentWallFirst;
}

/** min/max of D over the upward-facing triangles of one Wall's rendered mesh. */
function meshReference(roof: RegionFormFacts, positions: ArrayLike<number>, indices: ArrayLike<number>) {
	let min = Infinity;
	let max = -Infinity;
	const at = (index: number): [number, number, number] => [positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!];
	for (let t = 0; t < indices.length; t += 3) {
		const [a, b, c] = [at(indices[t]!), at(indices[t + 1]!), at(indices[t + 2]!)];
		const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
		const length = Math.hypot(n[0]!, n[1]!, n[2]!);
		if (!(length > 0) || n[1]! / length <= 1e-3) continue; // upward, not vertical
		for (const [x, y, z] of [a, b, c]) {
			const clearance = regionUndersideAt(roof, [x, z]) - y;
			min = Math.min(min, clearance);
			max = Math.max(max, clearance);
		}
	}
	return { min, max };
}

/** Float32 position rounding over this scene's ~10 m extent, with margin. */
const FLOAT32_TOLERANCE = 1e-6;

const cases: Array<[string, Record<string, LayoutVec2>, LayoutWall[]]> = [
	['an acute bevel between unequal heights', { a: [0, 0], b: [8, 0], c: [1, 1.6] }, [wall('ab', 'a', 'b', 3), wall('bc', 'b', 'c', 2.4)]],
	['the same bevel, the lower Wall first', { a: [0, 0], b: [8, 0], c: [1, 1.6] }, [wall('ab', 'a', 'b', 2.4), wall('bc', 'b', 'c', 3)]],
	['a right-angle mitre between unequal heights', { a: [0, 0], b: [6, 0], c: [6, 5] }, [wall('ab', 'a', 'b', 3), wall('bc', 'b', 'c', 2.4)]],
	[
		'a gable apex inside the mitre reach',
		{ a: [0, 0], b: [6, 0], c: [6, 5] },
		[wall('ab', 'a', 'b', 2.4, { kind: 'gable', startRise: 0, endRise: 0, apexRise: 0.6, apexOffset: 5.95 }), wall('bc', 'b', 'c', 2.4)]
	],
	['a T between unequal heights', { a: [-4, 0], b: [0, 0], c: [4, 0], d: [0, 4] }, [wall('ab', 'a', 'b', 3), wall('bc', 'b', 'c', 3), wall('bd', 'b', 'd', 2.4)]]
];

describe('T1 V3b — certified strip against the rendered Junction solid', () => {
	const footprint: LayoutVec2[] = [[-6, -6], [12, -6], [12, 9], [-6, 9]];
	for (const azimuth of [Math.PI / 2, -0.6, 2.3]) {
		const roof: RegionFormFacts = { role: 'overhead', form: { kind: 'shed', rise: 1, azimuth }, footprint, datumY: 3.2, thickness: 0.3 };
		for (const [name, points, walls] of cases) {
			it(`${name}, shed azimuth ${azimuth.toFixed(2)}`, () => {
				const compiled = compileWallFirstLayoutGeometry(layout(points, walls));
				const joins = legJoinsByWall(compiled.geometry.junctions);
				let patches = 0;
				for (const compiledWall of compiled.geometry.walls) {
					const ends = joins.get(compiledWall.wallId);
					const built = buildStandaloneWallMesh(compiledWall, 0, ends ?? null, { assertWinding: true });
					expect(built.issues).toEqual([]);
					const pieces = compiledWallStrip(compiledWall, ends, 0);
					patches += pieces.filter((piece) => piece.kind === 'patch').length;
					const certified = regionWallVerticalExtrema(roof, pieces, compiledWall.wallId, REGION_WALL_RELATION_EPSILON);
					if (certified.kind !== 'certified') throw new Error(`${compiledWall.wallId}: ${JSON.stringify(certified)}`);
					const reference = meshReference(roof, built.mesh!.positions, built.mesh!.indices);
					expect(Math.abs(certified.contact.clearance - reference.min), `${compiledWall.wallId} contact`).toBeLessThanOrEqual(FLOAT32_TOLERANCE);
					expect(Math.abs(certified.gap.clearance - reference.max), `${compiledWall.wallId} gap`).toBeLessThanOrEqual(FLOAT32_TOLERANCE);
				}
				// The bevel's wedge is a Junction-owned patch; it must take part.
				if (name.includes('bevel')) expect(patches).toBeGreaterThan(0);
			});
		}
	}
});
