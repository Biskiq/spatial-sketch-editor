/**
 * PR #247 probe — is an emitted physical Wall a closed solid?
 * Not a product test: it runs only through ./vitest.probe.config.ts and records a
 * fact table. It reports; it does not assert the desired outcome, so it stays green
 * on the defect it demonstrates.
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	legJoinsByWall,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh, assertWindingAgreesWithNormals, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';


type Edge = { a: string; b: string; count: number; directed: number };

function wall(id: string, a: string, b: string, o: Partial<LayoutWall> = {}): LayoutWall {
	return { id, startJunctionId: a, endJunctionId: b, thickness: 0.2, height: 3, centerline: { kind: 'line' }, ...o } as LayoutWall;
}
function doc(junctions: Array<{ id: string; point: LayoutVec2 }>, walls: LayoutWall[], openings: unknown[] = []): LayoutDocumentWallFirst {
	return { units: 'meters', formatVersion: 6, floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 }, junctions, walls, rooms: [], openings, objects: [] } as unknown as LayoutDocumentWallFirst;
}
const key = (m: IndexedWallMesh, i: number) => {
	const g = 1e-4;
	return `${Math.round(m.positions[i * 3]! / g)},${Math.round(m.positions[i * 3 + 1]! / g)},${Math.round(m.positions[i * 3 + 2]! / g)}`;
};
function edgesInto(m: IndexedWallMesh, map: Map<string, Edge>): void {
	for (let t = 0; t < m.indices.length; t += 3) {
		const v = [key(m, m.indices[t]!), key(m, m.indices[t + 1]!), key(m, m.indices[t + 2]!)];
		for (let e = 0; e < 3; e += 1) {
			const a = v[e]!;
			const b = v[(e + 1) % 3]!;
			if (a === b) continue;
			const [lo, hi] = a < b ? [a, b] : [b, a];
			const k = `${lo}|${hi}`;
			const entry = map.get(k) ?? { a: lo, b: hi, count: 0, directed: 0 };
			entry.count += 1;
			entry.directed += a < b ? 1 : -1;
			map.set(k, entry);
		}
	}
}
function report(map: Map<string, Edge>) {
	const edges = [...map.values()];
	const boundary = edges.filter((e) => e.count === 1);
	const nonManifold = edges.filter((e) => e.count > 2);
	const inconsistent = edges.filter((e) => e.count === 2 && e.directed !== 0);
	return { edges: edges.length, boundary: boundary.length, nonManifold: nonManifold.length, inconsistentWinding: inconsistent.length, boundaryEdges: boundary };
}
/** Signed volume by the divergence theorem; a closed outward solid equals L×T×H. */
function signedVolume(m: IndexedWallMesh): number {
	let total = 0;
	for (let t = 0; t < m.indices.length; t += 3) {
		const [a, b, c] = [m.indices[t]! * 3, m.indices[t + 1]! * 3, m.indices[t + 2]! * 3];
		const p = (i: number) => [m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!] as const;
		const [A, B, C] = [p(a), p(b), p(c)];
		total += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
	}
	return total;
}
/**
 * ∮ n dA over the union. A closed surface sums to zero whatever its triangulation, so this
 * tells a real hole from a T-vertex seam that edge incidence alone reports as boundary.
 */
function addVectorArea(m: IndexedWallMesh, sum: [number, number, number]): void {
	for (let t = 0; t < m.indices.length; t += 3) {
		const [a, b, c] = [m.indices[t]! * 3, m.indices[t + 1]! * 3, m.indices[t + 2]! * 3];
		const ux = m.positions[b]! - m.positions[a]!, uy = m.positions[b + 1]! - m.positions[a + 1]!, uz = m.positions[b + 2]! - m.positions[a + 2]!;
		const vx = m.positions[c]! - m.positions[a]!, vy = m.positions[c + 1]! - m.positions[a + 1]!, vz = m.positions[c + 2]! - m.positions[a + 2]!;
		sum[0] += (uy * vz - uz * vy) / 2;
		sum[1] += (uz * vx - ux * vz) / 2;
		sum[2] += (ux * vy - uy * vx) / 2;
	}
}
/** Triangles whose stored outward normal faces each side of a +X Wall. */
function facing(m: IndexedWallMesh) {
	const counts: Record<string, number> = { '+x': 0, '-x': 0, '+y': 0, '-y': 0, '+z': 0, '-z': 0 };
	for (let t = 0; t < m.indices.length; t += 3) {
		const [a, b, c] = [m.indices[t]! * 3, m.indices[t + 1]! * 3, m.indices[t + 2]! * 3];
		const ux = m.positions[b]! - m.positions[a]!, uy = m.positions[b + 1]! - m.positions[a + 1]!, uz = m.positions[b + 2]! - m.positions[a + 2]!;
		const vx = m.positions[c]! - m.positions[a]!, vy = m.positions[c + 1]! - m.positions[a + 1]!, vz = m.positions[c + 2]! - m.positions[a + 2]!;
		const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx] as const;
		const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
		counts[`${n[axis]! > 0 ? '+' : '-'}${'xyz'[axis]}`]! += 1;
	}
	return counts;
}

const J = (id: string, x: number, z: number) => ({ id, point: [x, z] as LayoutVec2 });
const cases: Array<[string, LayoutDocumentWallFirst]> = [
	['single wall, 5 m', doc([J('a', 0, 0), J('b', 5, 0)], [wall('w', 'a', 'b')])],
	['L corner (2 walls, 2 terminals)', doc([J('a', -4, 0), J('j', 0, 0), J('b', 0, 4)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b')])],
	['closed rectangle (0 terminals)', doc([J('a', 0, 0), J('b', 5, 0), J('c', 5, 4), J('d', 0, 4)], [wall('w1', 'a', 'b'), wall('w2', 'b', 'c'), wall('w3', 'c', 'd'), wall('w4', 'd', 'a')])],
	['T junction (3 terminals)', doc([J('a', -4, 0), J('j', 0, 0), J('b', 4, 0), J('c', 0, 4)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b'), wall('w3', 'j', 'c')])],
	['straight continuation, thicknesses differ', doc([J('a', -4, 0), J('j', 0, 0), J('b', 4, 0)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b', { thickness: 0.4 })])],
	['L corner, heights differ', doc([J('a', -4, 0), J('j', 0, 0), J('b', 0, 4)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b', { height: 2 })])],
	['closed rectangle, one lower wall', doc([J('a', 0, 0), J('b', 5, 0), J('c', 5, 4), J('d', 0, 4)], [wall('w1', 'a', 'b', { height: 2 }), wall('w2', 'b', 'c'), wall('w3', 'c', 'd'), wall('w4', 'd', 'a')])],
	['closed rectangle, one thicker wall', doc([J('a', 0, 0), J('b', 5, 0), J('c', 5, 4), J('d', 0, 4)], [wall('w1', 'a', 'b', { thickness: 0.4 }), wall('w2', 'b', 'c'), wall('w3', 'c', 'd'), wall('w4', 'd', 'a')])],
	['straight continuation, heights differ', doc([J('a', -4, 0), J('j', 0, 0), J('b', 4, 0)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b', { height: 2 })])],
	['T junction, taller branch', doc([J('a', -4, 0), J('j', 0, 0), J('b', 4, 0), J('c', 0, 4)], [wall('w1', 'a', 'j'), wall('w2', 'j', 'b'), wall('w3', 'j', 'c', { height: 4 })])]
];

it('records solid facts for each fixture', () => {
	const rows: unknown[] = [];
	for (const [name, document] of cases) {
		const compilation = compileWallFirstLayoutGeometry(document);
		const blocking = compilation.issues.filter((i: { severity?: string }) => i.severity !== 'warning').map((i: { code: string }) => i.code);
		const joins = legJoinsByWall(compilation.geometry.junctions);
		const union = new Map<string, Edge>();
		const vectorArea: [number, number, number] = [0, 0, 0];
		const walls: unknown[] = [];
		for (const compiled of compilation.geometry.walls ?? []) {
			const ends = joins.get(compiled.wallId) ?? { start: null, end: null };
			const built = buildStandaloneWallMesh(compiled, 0, ends, { classifySurface: () => 'wall' });
			if (!built.mesh) { walls.push({ wallId: compiled.wallId, issues: built.issues.map((i) => i.code) }); continue; }
			let windingAgrees = true;
			try { assertWindingAgreesWithNormals(built.mesh); } catch { windingAgrees = false; }
			const own = new Map<string, Edge>();
			edgesInto(built.mesh, own);
			edgesInto(built.mesh, union);
			addVectorArea(built.mesh, vectorArea);
			const r = report(own);
			walls.push({
				wallId: compiled.wallId,
				startJoin: ends.start?.kind ?? null,
				endJoin: ends.end?.kind ?? null,
				triangles: built.mesh.indices.length / 3,
				boundaryEdges: r.boundary,
				nonManifold: r.nonManifold,
				windingAgrees,
				signedVolume: Number(signedVolume(built.mesh).toFixed(6)),
				nominalVolume: Number((compiled.thickness * compiled.height * (compiled.samples.at(-1)!.distance ?? 0)).toFixed(6)),
				facing: facing(built.mesh)
			});
		}
		const u = report(union);
		rows.push({
			name, compileIssues: blocking, walls,
			union: { edges: u.edges, boundaryEdges: u.boundary, nonManifold: u.nonManifold, inconsistentWinding: u.inconsistentWinding, watertight: u.boundary === 0 && u.nonManifold === 0, vectorAreaResidual: Number(Math.hypot(...vectorArea).toFixed(6)) },
			unionBoundary: u.boundaryEdges.slice(0, 12).map((e) => `${e.a} — ${e.b}`)
		});
	}
	const out = process.env.PROBE_OUT;
	const text = JSON.stringify(rows, null, 2);
	if (out) writeFileSync(out, `${text}\n`);
	console.log(text);
});
