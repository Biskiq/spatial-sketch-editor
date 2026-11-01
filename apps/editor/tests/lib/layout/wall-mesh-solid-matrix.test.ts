/**
 * The emitted physical Walls of a Layout close into a solid.
 *
 * A Wall sharing a Junction is not closed alone: the corner plane is interior to
 * the union, so closure is asserted on the union of the Walls' meshes. A T-vertex
 * along a shared line is still closed, so every edge is first split at the vertices
 * lying on it. A branch that abuts a through Wall's face is sealed by that face,
 * which the fixtures that have one declare as `abutting`.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { assertWindingAgreesWithNormals, buildStandaloneWallMesh, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';

type V3 = [number, number, number];

function wall(id: string, a: string, b: string, overrides: Partial<LayoutWall> = {}): LayoutWall {
	return { id, startJunctionId: a, endJunctionId: b, thickness: 0.2, height: 3, centerline: { kind: 'line' }, ...overrides } as LayoutWall;
}

function layout(
	points: Record<string, LayoutVec2>,
	walls: LayoutWall[],
	openings: unknown[] = []
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 6,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings,
		objects: []
	} as unknown as LayoutDocumentWallFirst;
}

function meshes(document: LayoutDocumentWallFirst): IndexedWallMesh[] {
	const compiled = compileWallFirstLayoutGeometry(document);
	expect(compiled.issues ?? []).toEqual([]);
	const joins = legJoinsByWall(compiled.geometry.junctions);
	return compiled.geometry.walls.map((compiledWall) => {
		const built = buildStandaloneWallMesh(compiledWall, 0, joins.get(compiledWall.wallId) ?? null);
		expect(built.issues).toEqual([]);
		assertWindingAgreesWithNormals(built.mesh!);
		return built.mesh!;
	});
}

function triangles(all: readonly IndexedWallMesh[]): V3[][] {
	const out: V3[][] = [];
	for (const mesh of all) {
		const point = (index: number): V3 => [mesh.positions[index * 3]!, mesh.positions[index * 3 + 1]!, mesh.positions[index * 3 + 2]!];
		for (let t = 0; t < mesh.indices.length; t += 3) {
			out.push([point(mesh.indices[t]!), point(mesh.indices[t + 1]!), point(mesh.indices[t + 2]!)]);
		}
	}
	return out;
}

const GRID = 1e-5;
const keyOf = (p: V3): string => p.map((value) => Math.round(value / GRID)).join(',');

/** Directed edges left unmatched once every edge is split at the vertices on it. */
function openEdges(tris: readonly V3[][]): Array<[V3, V3]> {
	const vertices = new Map<string, V3>();
	for (const tri of tris) for (const p of tri) vertices.set(keyOf(p), p);
	const all = [...vertices.values()];
	const balance = new Map<string, { net: number; a: V3; b: V3 }>();
	for (const tri of tris) {
		for (let e = 0; e < 3; e += 1) {
			const a = tri[e]!;
			const b = tri[(e + 1) % 3]!;
			const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const lengthSq = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
			if (lengthSq < GRID ** 2) continue;
			const along = all
				.map((p) => {
					const v: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
					const t = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / lengthSq;
					const off = Math.hypot(v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]);
					return { p, t, off };
				})
				.filter((entry) => entry.off < 2 * GRID && entry.t > -1e-9 && entry.t < 1 + 1e-9)
				.sort((x, y) => x.t - y.t);
			for (let i = 1; i < along.length; i += 1) {
				const from = along[i - 1]!.p;
				const to = along[i]!.p;
				const ka = keyOf(from);
				const kb = keyOf(to);
				if (ka === kb) continue;
				const forward = ka < kb;
				const key = forward ? `${ka}|${kb}` : `${kb}|${ka}`;
				const entry = balance.get(key) ?? { net: 0, a: forward ? from : to, b: forward ? to : from };
				entry.net += forward ? 1 : -1;
				balance.set(key, entry);
			}
		}
	}
	return [...balance.values()].filter((entry) => entry.net !== 0).map((entry) => [entry.a, entry.b]);
}

/** ∮ n dA: zero for any closed surface, whatever its triangulation. */
function vectorArea(tris: readonly V3[][]): number {
	const sum: V3 = [0, 0, 0];
	for (const [a, b, c] of tris as [V3, V3, V3][]) {
		const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		sum[0] += (u[1] * v[2] - u[2] * v[1]) / 2;
		sum[1] += (u[2] * v[0] - u[0] * v[2]) / 2;
		sum[2] += (u[0] * v[1] - u[1] * v[0]) / 2;
	}
	return Math.hypot(...sum);
}

function signedVolume(tris: readonly V3[][]): number {
	let total = 0;
	for (const [a, b, c] of tris as [V3, V3, V3][]) {
		total += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
	}
	return total;
}

const square = { a: [0, 0], b: [5, 0], c: [5, 4], d: [0, 4] } satisfies Record<string, LayoutVec2>;
const rectangle = (bc: Partial<LayoutWall> = {}) => [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', bc), wall('w3', 'c', 'd'), wall('w4', 'd', 'a')];

const CLOSED: Array<[string, LayoutDocumentWallFirst]> = [
	['single Wall', layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')])],
	['single Wall at an angle', layout({ a: [1, 2], b: [4, 6] }, [wall('w1', 'a', 'b')])],
	['L corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['reversed L corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'b', 'a'), wall('w2', 'b', 'c')])],
	['L corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['L corner, heights differ the other way', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b', { height: 2 }), wall('w2', 'b', 'c')])],
	['closed rectangle', layout(square, rectangle())],
	['closed rectangle, one lower Wall', layout(square, rectangle({ height: 2 }))],
	['closed rectangle, one thicker Wall', layout(square, rectangle({ thickness: 0.4 }))],
	['straight continuation, heights differ', layout({ a: [0, 0], b: [3, 0], c: [6, 0] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['straight continuation, thicknesses differ', layout({ a: [0, 0], b: [3, 0], c: [6, 0] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { thickness: 0.4 })])],
	['60° corner', layout({ a: [0, 0], b: [5, 0], c: [3, 3.46] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['45° corner', layout({ a: [0, 0], b: [5, 0], c: [2, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['45° corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [2, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['reversed corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'b', 'a', { height: 2 }), wall('w2', 'b', 'c')])],
	['both ends at the corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'c', 'b')])],
	['120° corner', layout({ a: [0, 0], b: [5, 0], c: [7, 3.46] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
];

describe('physical Wall solids', () => {
	it.each(CLOSED)('%s is closed', (_name, document) => {
		const tris = triangles(meshes(document));
		expect(openEdges(tris)).toEqual([]);
		expect(vectorArea(tris)).toBeLessThan(1e-6);
	});

	it('a single Wall has its exact volume and an outward face on each end', () => {
		const [mesh] = meshes(layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')]));
		const tris = triangles([mesh!]);
		expect(Math.abs(signedVolume(tris))).toBeCloseTo(5 * 0.2 * 3, 6);
		for (const [x, sign] of [[0, -1], [5, 1]] as const) {
			const end = tris.filter((tri) => tri.every((p) => Math.abs(p[0] - x) < 1e-6));
			expect(end).toHaveLength(2);
			for (const [a, b, c] of end as [V3, V3, V3][]) {
				const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
				expect(Math.sign(nx)).toBe(sign);
			}
		}
	});

	it('an end Opening stays a void, and the Wall stays closed around it', () => {
		const document = layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
			{ id: 'o1', wallId: 'w1', kind: 'door', offset: 0, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		]);
		const compiled = compileWallFirstLayoutGeometry(document);
		const joins = legJoinsByWall(compiled.geometry.junctions).get('w1')!;
		const cap = joins.start!.surfaces!.filter((surface) => surface.kind === 'terminal-cap');
		expect(cap.flatMap((surface) => surface.bands)).toEqual([{ bottomY: 2, topY: 3 }]);
		const tris = triangles(meshes(document));
		expect(openEdges(tris)).toEqual([]);
	});

	it('a mid-Wall Opening keeps the Wall closed, with the cap welded to the side bands', () => {
		const tris = triangles(
			meshes(
				layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
					{ id: 'o1', wallId: 'w1', kind: 'window', offset: 2, width: 1, height: 1, sillHeight: 1, profile: 'rectangular' }
				])
			)
		);
		expect(openEdges(tris)).toEqual([]);
		expect(vectorArea(tris)).toBeLessThan(1e-6);
	});

	it.each([
		['T junction', {}],
		['T junction, taller branch', { height: 4 }]
	] as Array<[string, Partial<LayoutWall>]>)('%s only stays open where the branch abuts the through Wall', (_name, branch) => {
		const tris = triangles(
			meshes(layout({ a: [-3, 0], b: [0, 0], c: [3, 0], d: [0, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c'), wall('w3', 'b', 'd', branch)]))
		);
		for (const [a, b] of openEdges(tris)) {
			// The through Wall's face is z = ±0.1 here; a surviving edge lies on it.
			expect(Math.abs(a[2])).toBeCloseTo(0.1, 6);
			expect(Math.abs(b[2])).toBeCloseTo(0.1, 6);
		}
	});

	/**
	 * Limits that exist on `main` too (the report compares them). They are pinned so
	 * a change to them is seen; they are not the behaviour a fix should preserve.
	 */
	describe('known limits', () => {
		const corner = (degrees: number): LayoutDocumentWallFirst => {
			const r = (degrees * Math.PI) / 180;
			return layout({ a: [0, 0], b: [5, 0], c: [5 - 4 * Math.cos(r), 4 * Math.sin(r)] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')]);
		};
		const built = (document: LayoutDocumentWallFirst): IndexedWallMesh[] => {
			const compiled = compileWallFirstLayoutGeometry(document);
			const joins = legJoinsByWall(compiled.geometry.junctions);
			return compiled.geometry.walls.map((compiledWall) => buildStandaloneWallMesh(compiledWall, 0, joins.get(compiledWall.wallId) ?? null).mesh!);
		};

		it('a 30° mitre winds a triangle against its normal, though it closes', () => {
			const all = built(corner(30));
			expect(() => assertWindingAgreesWithNormals(all[0]!)).toThrow(/winds opposite/);
			expect(openEdges(triangles(all))).toEqual([]);
		});

		it.each([20, 12])('a %d° bevel stays open at the corner', (degrees) => {
			expect(openEdges(triangles(built(corner(degrees))))).toHaveLength(12);
		});

		it('an arched Opening at a free end leaves a gap between its spring and its height', () => {
			const tris = triangles(
				built(
					layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
						{ id: 'o1', wallId: 'w1', kind: 'door', offset: 0, width: 1, height: 2.2, sillHeight: 0, profile: 'rounded' }
					])
				)
			);
			const open = openEdges(tris);
			expect(open).toHaveLength(4);
			for (const [a, b] of open) {
				expect(a[0]).toBe(0);
				expect(b[0]).toBe(0);
				// Between the 1.7 m spring and the 2.2 m height.
				for (const y of [a[1], b[1]]) {
					expect(y).toBeGreaterThan(1.69);
					expect(y).toBeLessThan(2.21);
				}
			}
		});
	});
});
