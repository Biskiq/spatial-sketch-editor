/**
 * Wall-mesh test toolkit — extracted by T4 so the watertight-matrix suite
 * (`wall-mesh-watertight-matrices.test.ts`) and the single-case suite
 * (`wall-mesh-builder.test.ts`) share one owner for the mesh assertions and
 * document builders instead of duplicating them across lanes.
 */
import { expect } from 'vitest';
import { compileLayoutGeometry } from '$lib/layout/layout-geometry';
import { type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';
import {
	g1DocumentWithRooms,
	g1LineRectangleDocument,
	g1LineSegments,
	g1RectangleRoom
} from '../lib/layout/__fixtures__/layout-g1-fixtures';
import type { CompiledRoom } from '$lib/layout/layout-geometry-types';

export function compileRoom(document: ReturnType<typeof g1LineRectangleDocument>): CompiledRoom {
	const geometry = compileLayoutGeometry(document).geometry;
	const room = geometry.rooms[0];
	if (!room) throw new Error('fixture compiled to no room');
	return room;
}

/** Assert every geometric edge (by quantized position) is shared by exactly `expected` triangles. */
export function assertEdgeMultiplicity(mesh: IndexedWallMesh, expected: number): void {
	const grid = 1e-4;
	const id = new Map<string, number>();
	let next = 0;
	function vid(index: number): number {
		const x = mesh.positions[index * 3]!;
		const y = mesh.positions[index * 3 + 1]!;
		const z = mesh.positions[index * 3 + 2]!;
		const key = `${Math.round(x / grid)},${Math.round(y / grid)},${Math.round(z / grid)}`;
		let value = id.get(key);
		if (value === undefined) {
			value = next++;
			id.set(key, value);
		}
		return value;
	}
	const edges = new Map<string, number>();
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const tri = [vid(mesh.indices[i]!), vid(mesh.indices[i + 1]!), vid(mesh.indices[i + 2]!)];
		for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]] as const) {
			const key = a < b ? `${a},${b}` : `${b},${a}`;
			edges.set(key, (edges.get(key) ?? 0) + 1);
		}
	}
	for (const [key, count] of edges) expect(count, `edge ${key}`).toBe(expected);
}

/** Assert every geometric edge is shared by exactly 1 or 2 triangles (manifold, possibly with boundary). */
export function assertManifoldWithBoundary(mesh: IndexedWallMesh): void {
	const grid = 1e-4;
	const id = new Map<string, number>();
	let next = 0;
	function vid(index: number): number {
		const x = mesh.positions[index * 3]!;
		const y = mesh.positions[index * 3 + 1]!;
		const z = mesh.positions[index * 3 + 2]!;
		const key = `${Math.round(x / grid)},${Math.round(y / grid)},${Math.round(z / grid)}`;
		let value = id.get(key);
		if (value === undefined) { value = next++; id.set(key, value); }
		return value;
	}
	const edges = new Map<string, number>();
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const tri = [vid(mesh.indices[i]!), vid(mesh.indices[i + 1]!), vid(mesh.indices[i + 2]!)!];
		for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]] as const) {
			const key = a < b ? `${a},${b}` : `${b},${a}`;
			edges.set(key, (edges.get(key) ?? 0) + 1);
		}
	}
	for (const [key, count] of edges) {
		expect(count, `edge ${key}`).toBeGreaterThanOrEqual(1);
		expect(count, `edge ${key}`).toBeLessThanOrEqual(2);
	}
}

/** Assert no vertex lies in the interior of a non-incident geometric edge (no T-junctions). */
export function assertNoTjunctions(mesh: IndexedWallMesh): void {
	const grid = 1e-4;
	const points: [number, number, number][] = [];
	const id = new Map<string, number>();
	function vid(index: number): number {
		const x = mesh.positions[index * 3]!;
		const y = mesh.positions[index * 3 + 1]!;
		const z = mesh.positions[index * 3 + 2]!;
		const key = `${Math.round(x / grid)},${Math.round(y / grid)},${Math.round(z / grid)}`;
		let value = id.get(key);
		if (value === undefined) { value = points.length; id.set(key, value); points.push([x, y, z]); }
		return value;
	}
	const edges = new Map<string, [number, number]>();
	for (let i = 0; i < mesh.indices.length; i += 3) {
		const tri = [vid(mesh.indices[i]!), vid(mesh.indices[i + 1]!), vid(mesh.indices[i + 2]!)!];
		for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]] as const) {
			const key = a < b ? `${a},${b}` : `${b},${a}`;
			if (!edges.has(key)) edges.set(key, [Math.min(a, b), Math.max(a, b)]);
		}
	}
	for (let v = 0; v < points.length; v += 1) {
		const p = points[v]!;
		for (const [a, b] of edges.values()) {
			if (a === v || b === v) continue;
			if (pointOnSegment(p, points[a]!, points[b]!)) {
				throw new Error(`T-junction: vertex ${v} (${p.join(',')}) lies on edge ${a}–${b}`);
			}
		}
	}
}

function pointOnSegment(p: [number, number, number], a: [number, number, number], b: [number, number, number]): boolean {
	const abx = b[0] - a[0];
	const aby = b[1] - a[1];
	const abz = b[2] - a[2];
	const len2 = abx * abx + aby * aby + abz * abz;
	if (len2 <= 1e-12) return false;
	const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / len2;
	if (t < -1e-3 || t > 1 + 1e-3) return false;
	const cx = a[0] + t * abx - p[0];
	const cy = a[1] + t * aby - p[1];
	const cz = a[2] + t * abz - p[2];
	const tol = 1e-3;
	return cx * cx + cy * cy + cz * cz <= tol * tol;
}

export function assertFinite(mesh: IndexedWallMesh): void {
	for (const value of mesh.positions) expect(Number.isFinite(value)).toBe(true);
	for (const value of mesh.normals) expect(Number.isFinite(value)).toBe(true);
	for (const value of mesh.uvs) expect(Number.isFinite(value)).toBe(true);
}

export function rhombusDocument(): ReturnType<typeof g1DocumentWithRooms> {
	const room = g1RectangleRoom('room-rhombus', 0, 0, 6, 4);
	room.boundary.segments = g1LineSegments(
		[
			[0, 0],
			[6, 0],
			[11.638, 2.052],
			[5.638, 2.052]
		],
		'room-rhombus:wall'
	);
	return g1DocumentWithRooms([room]);
}

export function notchDocument(): ReturnType<typeof g1DocumentWithRooms> {
	const room = g1RectangleRoom('room-notch', 0, 0, 6, 4);
	room.boundary.segments = g1LineSegments(
		[
			[0, 0],
			[6, 0],
			[6, 1],
			[4, 1.5],
			[4, 5],
			[0, 5]
		],
		'room-notch:wall'
	);
	return g1DocumentWithRooms([room]);
}
