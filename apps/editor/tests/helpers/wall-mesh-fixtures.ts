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

/**
 * P23.15 — the **independent** union-coverage oracle.
 *
 * It exists so a Junction fixture can be checked against an expectation that does
 * not share the production algorithm at all: the walls are described as plain
 * axis-independent boxes (a straight centerline band plus a height interval) and
 * the emitted meshes are sampled by ray parity. `assertUnionCoverageAtJunction`
 * then only asserts where the answer is unambiguous — a point at least `margin`
 * inside some Wall's box must be inside the mesh union (a hole fails), and a
 * point at least `margin` away from every box must be outside it (a stray or
 * badly beveled surface fails). Near a boundary the two answers may legitimately
 * differ by a bevel, so those samples are skipped.
 *
 * This helper is never a production predicate: canonical compile acceptance uses
 * the analytic rules in `layout-junction-clearance.ts`.
 */
export type StraightWallBox = {
	start: [number, number];
	end: [number, number];
	thickness: number;
	height: number;
	/** Wall base elevation (metres); defaults to 0. */
	base?: number;
};

export type JunctionCoverageOptions = {
	center: [number, number];
	/** Plan half-extent of the sampled block around the Junction. */
	radius: number;
	step: number;
	/** Distance from any Wall box boundary at which a sample is decisive. */
	margin: number;
	/**
	 * How far past a Wall's own box the union may legitimately reach (a resolved
	 * miter/bevel extends beyond the sampled band). Used only for the "deep
	 * outside" half of the oracle; defaults to 0.
	 */
	extension?: number;
	heights: readonly number[];
	walls: readonly StraightWallBox[];
};

type Point3 = [number, number, number];

/** Signed lateral offset of `p` from the wall's centerline and its along-distance. */
function wallLocal(p: [number, number], wall: StraightWallBox): { lateral: number; along: number; length: number } {
	const dx = wall.end[0] - wall.start[0];
	const dz = wall.end[1] - wall.start[1];
	const length = Math.hypot(dx, dz) || 1;
	const ux = dx / length;
	const uz = dz / length;
	const px = p[0] - wall.start[0];
	const pz = p[1] - wall.start[1];
	return { lateral: px * -uz + pz * ux, along: px * ux + pz * uz, length };
}

/** Plan distance from `p` to the wall's box (0 when inside), grown by `extension`. */
function planDistanceToWall(
	p: [number, number],
	wall: StraightWallBox,
	extension = 0
): { lateral: number; along: number; distance: number } {
	const local = wallLocal(p, wall);
	const lateralExcess = Math.max(0, Math.abs(local.lateral) - wall.thickness / 2 - extension);
	const alongExcess = Math.max(0, -local.along - extension, local.along - local.length - extension);
	return { lateral: local.lateral, along: local.along, distance: Math.hypot(lateralExcess, alongExcess) };
}

function sign2(p: [number, number], a: [number, number], b: [number, number]): number {
	return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

/** Is the plan point strictly inside the triangle's XZ projection? */
function planInsideTriangle(x: number, z: number, a: Point3, b: Point3, c: Point3): boolean {
	const p: [number, number] = [x, z];
	const ab = sign2(p, [a[0], a[2]], [b[0], b[2]]);
	const bc = sign2(p, [b[0], b[2]], [c[0], c[2]]);
	const ca = sign2(p, [c[0], c[2]], [a[0], a[2]]);
	const epsilon = 1e-12;
	return (ab > epsilon && bc > epsilon && ca > epsilon) || (ab < -epsilon && bc < -epsilon && ca < -epsilon);
}

/** `y` of the triangle's plane at plan `(x, z)` — the triangle is assumed non-vertical. */
function planeYAt(x: number, z: number, a: Point3, b: Point3, c: Point3): number {
	const area = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
	const wa = (b[0] - x) * (c[2] - z) - (c[0] - x) * (b[2] - z);
	const wb = (c[0] - x) * (a[2] - z) - (a[0] - x) * (c[2] - z);
	const wc = (a[0] - x) * (b[2] - z) - (b[0] - x) * (a[2] - z);
	return (wa * a[1] + wb * b[1] + wc * c[1]) / area;
}

/**
 * Ray parity along +Y for ONE mesh. Each standalone Wall mesh is closed, so
 * parity is a valid solidity test for it; the test is deliberately per mesh —
 * at a T/X two Walls legitimately share a coincident top surface, which would
 * make a union-wide parity count wrongly report a solid region as empty.
 */
export function meshContains(mesh: IndexedWallMesh, point: Point3): boolean {
	let crossings = 0;
	for (let index = 0; index < mesh.indices.length; index += 3) {
		const read = (slot: number): Point3 => {
			const vertex = mesh.indices[index + slot]! * 3;
			return [mesh.positions[vertex]!, mesh.positions[vertex + 1]!, mesh.positions[vertex + 2]!];
		};
		const a = read(0);
		const b = read(1);
		const c = read(2);
		if (!planInsideTriangle(point[0], point[2], a, b, c)) continue;
		if (planeYAt(point[0], point[2], a, b, c) > point[1]) crossings += 1;
	}
	return crossings % 2 === 1;
}

/** Is the point inside at least one Wall body? */
export function anyMeshContains(meshes: readonly IndexedWallMesh[], point: Point3): boolean {
	return meshes.some((mesh) => meshContains(mesh, point));
}

/**
 * Sample a Junction block and assert the mesh union matches an independently
 * computed box union wherever the answer is unambiguous.
 */
export function assertUnionCoverageAtJunction(
	meshes: readonly IndexedWallMesh[],
	options: JunctionCoverageOptions
): { insideSamples: number; outsideSamples: number } {
	let insideSamples = 0;
	let outsideSamples = 0;
	const steps = Math.round((options.radius * 2) / options.step);
	for (let i = 0; i <= steps; i += 1) {
		for (let j = 0; j <= steps; j += 1) {
			// Offset the grid off the Junction's axes so a sample never lands exactly
			// on an edge, which neither classifier can answer.
			const x = options.center[0] - options.radius + i * options.step + options.step / 7;
			const z = options.center[1] - options.radius + j * options.step + options.step / 11;
			for (const y of options.heights) {
				const point: Point3 = [x, y, z];
				// Deep outside: the sample is at least `margin` from every Wall's box,
				// so the union is definitively empty there.
				const deepOutside = options.walls.every(
					(wall) => planDistanceToWall([x, z], wall, options.extension ?? 0).distance > options.margin
				);
				// Deep inside: some Wall's box contains the sample with `margin` to
				// spare on every side, so the union is definitively solid there.
				const deepInside = options.walls.some((wall) => {
					const local = wallLocal([x, z], wall);
					const lateralRoom = wall.thickness / 2 - Math.abs(local.lateral);
					const alongRoom = Math.min(local.along, local.length - local.along);
					const base = wall.base ?? 0;
					return (
						lateralRoom > options.margin &&
						alongRoom > options.margin &&
						y > base + options.margin &&
						y < base + wall.height - options.margin
					);
				});
				if (deepInside) {
					insideSamples += 1;
					expect(anyMeshContains(meshes, point), `hole at (${x.toFixed(3)}, ${y}, ${z.toFixed(3)}) inside the Wall union`).toBe(
						true
					);
				} else if (deepOutside) {
					outsideSamples += 1;
					expect(anyMeshContains(meshes, point), `stray surface at (${x.toFixed(3)}, ${y}, ${z.toFixed(3)}) outside every Wall`).toBe(
						false
					);
				}
			}
		}
	}
	return { insideSamples, outsideSamples };
}

/**
 * P23.15 — the **independent ownership/overlap oracle**.
 *
 * Union coverage alone cannot detect wrong ownership: a step painted by the
 * wrong Wall, or two Wall-owned bodies interpenetrating, cover exactly the same
 * area. This probe samples the Junction region against the independently
 * described Wall boxes and asserts:
 *
 * ```text
 * point deep inside some authored Wall box
 *   → exactly ONE emitted Wall mesh contains it
 * ```
 *
 * It shares no code with the production partition: the boxes are computed from
 * the document's junctions/thicknesses, and the solidity test is per-mesh ray
 * parity. Points near a box boundary are skipped, because a resolved miter,
 * trim or difference step may legitimately reach past the authored band there.
 */
export function assertWallOwnershipAtJunction(
	meshes: readonly IndexedWallMesh[],
	options: JunctionCoverageOptions
): { samples: number } {
	let samples = 0;
	const steps = Math.round((options.radius * 2) / options.step);
	for (let i = 0; i <= steps; i += 1) {
		for (let j = 0; j <= steps; j += 1) {
			const x = options.center[0] - options.radius + i * options.step + options.step / 5;
			const z = options.center[1] - options.radius + j * options.step + options.step / 13;
			for (const y of options.heights) {
				const deepInside = options.walls.some((wall) => {
					const local = wallLocal([x, z], wall);
					const lateralRoom = wall.thickness / 2 - Math.abs(local.lateral);
					const alongRoom = Math.min(local.along, local.length - local.along);
					const base = wall.base ?? 0;
					return (
						lateralRoom > options.margin &&
						alongRoom > options.margin &&
						y > base + options.margin &&
						y < base + wall.height - options.margin
					);
				});
				if (!deepInside) continue;
				samples += 1;
				const owners = meshes.filter((mesh) => meshContains(mesh, [x, y, z])).map((mesh) => mesh.roomId);
			expect(
					owners.length,
					`(${x.toFixed(3)}, ${y}, ${z.toFixed(3)}) owned by ${owners.join(' + ') || 'nothing'}`
				).toBe(1);
			}
		}
	}
	return { samples };
}

/** Every emitted vertex has a finite position inside the given bounds. */
export function assertVerticesWithinBounds(mesh: IndexedWallMesh, bounds: { min: readonly number[]; max: readonly number[] }): void {
	for (let index = 0; index < mesh.positions.length; index += 3) {
		for (const axis of [0, 1, 2] as const) {
			const value = mesh.positions[index + axis]!;
			expect(Number.isFinite(value), `vertex ${index / 3} axis ${axis}`).toBe(true);
			expect(value, `vertex ${index / 3} axis ${axis} min`).toBeGreaterThanOrEqual(bounds.min[axis]! - 1e-6);
			expect(value, `vertex ${index / 3} axis ${axis} max`).toBeLessThanOrEqual(bounds.max[axis]! + 1e-6);
		}
	}
}

/** Every emitted triangle has a non-degenerate area (no zero-span surface). */
export function assertNoDegenerateTriangles(mesh: IndexedWallMesh, minimumArea = 1e-12): void {
	for (let index = 0; index < mesh.indices.length; index += 3) {
		const read = (slot: number): Point3 => {
			const vertex = mesh.indices[index + slot]! * 3;
			return [mesh.positions[vertex]!, mesh.positions[vertex + 1]!, mesh.positions[vertex + 2]!];
		};
		const a = read(0);
		const b = read(1);
		const c = read(2);
		const ux = b[0] - a[0];
		const uy = b[1] - a[1];
		const uz = b[2] - a[2];
		const vx = c[0] - a[0];
		const vy = c[1] - a[1];
		const vz = c[2] - a[2];
		const cx = uy * vz - uz * vy;
		const cy = uz * vx - ux * vz;
		const cz = ux * vy - uy * vx;
		expect(0.5 * Math.hypot(cx, cy, cz), `triangle ${index / 3} area`).toBeGreaterThan(minimumArea);
	}
}

/** The union of two meshes is manifold (each geometric edge owned by 1 or 2 triangles). */
export function assertUnionManifoldWithBoundary(meshes: readonly IndexedWallMesh[]): void {
	const grid = 1e-4;
	const ids = new Map<string, number>();
	const edges = new Map<string, number>();
	const triangles: Array<[number, number, number]> = [];
	for (const mesh of meshes) {
		for (let index = 0; index < mesh.indices.length; index += 3) {
			const tri = [0, 1, 2].map((slot) => {
				const vertex = mesh.indices[index + slot]! * 3;
				const key = `${Math.round(mesh.positions[vertex]! / grid)},${Math.round(mesh.positions[vertex + 1]! / grid)},${Math.round(mesh.positions[vertex + 2]! / grid)}`;
				let value = ids.get(key);
				if (value === undefined) {
					value = ids.size;
					ids.set(key, value);
				}
				return value;
			}) as [number, number, number];
			triangles.push(tri);
			for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]] as const) {
				const edge = a < b ? `${a},${b}` : `${b},${a}`;
				edges.set(edge, (edges.get(edge) ?? 0) + 1);
			}
		}
	}
	for (const [edge, count] of edges) {
		expect(count, `union edge ${edge}`).toBeGreaterThanOrEqual(1);
		expect(count, `union edge ${edge}`).toBeLessThanOrEqual(2);
	}
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
