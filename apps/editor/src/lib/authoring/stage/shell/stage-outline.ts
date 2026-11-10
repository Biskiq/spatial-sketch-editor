/**
 * The fat-line outline of a selected, hovered or erased subject.
 *
 * A Wall mesh is built in short spans, so `EdgesGeometry` returns a straight edge
 * as many end-to-end pieces, and each piece of a fat line draws its own cap. The
 * line straddles the edge of the mesh, so the neighbouring face's depth buries half
 * of it and only the caps show through, as a tick at every joint. Merging straight
 * runs removes those joints, and the depth bias lifts the whole line clear of the
 * face it sits on. A curved edge keeps its joints and relies on the bias.
 */

/** Pulls a line toward the eye by far less than a surface in front of it. */
export const OUTLINE_DEPTH_BIAS = {
	polygonOffset: true,
	polygonOffsetFactor: -4,
	polygonOffsetUnits: -16
} as const;

/** `EdgesGeometry`'s own welding precision. */
const WELD = 1e4;
/** About 0.08°: tighter than the bend between the spans of any visibly curved Wall. */
const STRAIGHT_COSINE = 1 - 1e-6;

type Point = readonly [number, number, number];

/**
 * Prototype stencil silhouette depth, in metres. The shell is expanded per axis
 * so the outline keeps a roughly constant width on a thin, curved Wall instead
 * of becoming a wide wedge at the Wall's longest axis.
 */
export const WALL_SILHOUETTE_METRES = 0.024;

export type WallSilhouetteExtent = readonly [number, number, number];

/**
 * Local expansion for an inverted-hull silhouette. Scaling about the mesh's own
 * centre expands apertures with the shell, so a selected Wall's door and window
 * holes stay open rather than filling with gold.
 */
export function wallSilhouetteHullScale(
	extent: WallSilhouetteExtent,
	width = WALL_SILHOUETTE_METRES
): [number, number, number] {
	const grow = Math.max(width, 1e-4) * 2;
	return [
		1 + grow / Math.max(extent[0], 1e-4),
		1 + grow / Math.max(extent[1], 1e-4),
		1 + grow / Math.max(extent[2], 1e-4)
	];
}

function directionBetween(from: Point, to: Point): Point | null {
	const x = to[0] - from[0];
	const y = to[1] - from[1];
	const z = to[2] - from[2];
	const length = Math.hypot(x, y, z);
	return length === 0 ? null : [x / length, y / length, z / length];
}

function dot(a: Point, b: Point): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Joins end-to-end collinear segments of a `[ax, ay, az, bx, by, bz, ...]` list
 * into one segment each. Corners, branches and curves are left as they are, and
 * every point the input covered is still covered.
 */
export function mergeStraightEdgeRuns(positions: ArrayLike<number>): Float32Array {
	const count = Math.floor(positions.length / 6);
	const point = (segment: number, end: 0 | 1): Point => {
		const at = segment * 6 + end * 3;
		return [positions[at]!, positions[at + 1]!, positions[at + 2]!];
	};
	const keyOf = (p: Point): string => p.map((value) => Math.round(value * WELD)).join(',');
	const incident = new Map<string, number[]>();
	for (let segment = 0; segment < count; segment += 1) {
		for (const end of [0, 1] as const) {
			const key = keyOf(point(segment, end));
			const list = incident.get(key);
			if (list === undefined) incident.set(key, [segment]);
			else list.push(segment);
		}
	}
	const used = new Uint8Array(count);
	const farEnd = (segment: number, near: Point): Point => {
		const start = point(segment, 0);
		return keyOf(start) === keyOf(near) ? point(segment, 1) : start;
	};
	/** Walks from `tip` along `direction` while an unused segment continues the line. */
	const extend = (tip: Point, direction: Point): Point => {
		let current = tip;
		for (;;) {
			const next = (incident.get(keyOf(current)) ?? []).find((segment) => {
				if (used[segment] === 1) return false;
				const step = directionBetween(current, farEnd(segment, current));
				return step !== null && dot(step, direction) >= STRAIGHT_COSINE;
			});
			if (next === undefined) return current;
			used[next] = 1;
			current = farEnd(next, current);
		}
	};
	const merged: number[] = [];
	for (let segment = 0; segment < count; segment += 1) {
		if (used[segment] === 1) continue;
		used[segment] = 1;
		const start = point(segment, 0);
		const end = point(segment, 1);
		const direction = directionBetween(start, end);
		if (direction === null) continue;
		const reverse: Point = [-direction[0], -direction[1], -direction[2]];
		merged.push(...extend(start, reverse), ...extend(end, direction));
	}
	return new Float32Array(merged);
}

/**
 * Split a segment list into the longest end-to-end chains that pass through
 * ordinary (degree-two) vertices. A fat line drawn from a chain has no cap at
 * an internal tessellation joint, so a curved Wall's sampled spans read as one
 * continuous silhouette instead of a row of ticks.
 *
 * A branch or a real end stops the chain. Closed rings come back as one chain
 * whose first and last point coincide.
 */
export function contourPolylines(positions: ArrayLike<number>): Float32Array[] {
	const count = Math.floor(positions.length / 6);
	const pointOf = (segment: number, end: 0 | 1): Point => {
		const at = segment * 6 + end * 3;
		return [positions[at]!, positions[at + 1]!, positions[at + 2]!];
	};
	const keyOf = (p: Point): string => p.map((value) => Math.round(value * WELD)).join(',');
	const incident = new Map<string, number[]>();
	for (let segment = 0; segment < count; segment += 1) {
		for (const end of [0, 1] as const) {
			const key = keyOf(pointOf(segment, end));
			const list = incident.get(key);
			if (list === undefined) incident.set(key, [segment]);
			else list.push(segment);
		}
	}
	const otherEnd = (segment: number, near: Point): Point => {
		const start = pointOf(segment, 0);
		return keyOf(start) === keyOf(near) ? pointOf(segment, 1) : start;
	};
	const used = new Uint8Array(count);
	const out: Float32Array[] = [];
	for (let seed = 0; seed < count; seed += 1) {
		if (used[seed] === 1) continue;
		used[seed] = 1;
		const a = pointOf(seed, 0);
		const b = pointOf(seed, 1);
		const startKey = keyOf(a);
		const chain: Point[] = [a, b];
		let current = b;
		for (;;) {
			if (keyOf(current) === startKey) break;
			const around = incident.get(keyOf(current)) ?? [];
			if (around.length !== 2) break;
			const next = around.find((segment) => used[segment] === 0);
			if (next === undefined) break;
			used[next] = 1;
			current = otherEnd(next, current);
			chain.push(current);
		}
		const before: Point[] = [];
		current = a;
		for (;;) {
			const around = incident.get(keyOf(current)) ?? [];
			if (around.length !== 2) break;
			const next = around.find((segment) => used[segment] === 0);
			if (next === undefined) break;
			used[next] = 1;
			current = otherEnd(next, current);
			before.push(current);
		}
		before.reverse();
		const points = [...before, ...chain];
		if (points.length < 2) continue;
		out.push(new Float32Array(points.flat()));
	}
	return out;
}

/**
 * View-dependent identity silhouette of the renderer's triangles, in world space.
 * Coplanar seams and front/front creases carry no identity ink. Opposite coincident
 * faces cancel (the internal caps of joined render spans). Real aperture rims and
 * outer boundaries survive; the normal depth buffer hides their occluded parts.
 * This is paint over rendered triangles, never an architectural reconstruction.
 */
type TriangleEdge = { a: Point; b: Point; normals: Point[] };

function collectTriangleEdges(triangles: ArrayLike<number>): Map<string, TriangleEdge> {
	const keyOf = (p: Point) => p.map(v => Math.round(v * WELD)).join(',');
	const edges = new Map<string, TriangleEdge>();
	for (let at = 0; at + 8 < triangles.length; at += 9) {
		const a: Point = [triangles[at]!, triangles[at + 1]!, triangles[at + 2]!];
		const b: Point = [triangles[at + 3]!, triangles[at + 4]!, triangles[at + 5]!];
		const c: Point = [triangles[at + 6]!, triangles[at + 7]!, triangles[at + 8]!];
		const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const cross: Point = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
		const normal = directionBetween([0, 0, 0], cross);
		if (!normal) continue;
		for (const [from, to] of [[a, b], [b, c], [c, a]] as const) {
			const key = [keyOf(from), keyOf(to)].sort().join('|');
			let edge = edges.get(key);
			if (!edge) { edge = { a: from, b: to, normals: [] }; edges.set(key, edge); }
			const opposite = edge.normals.findIndex(n => dot(n, normal) < -STRAIGHT_COSINE);
			if (opposite >= 0) edge.normals.splice(opposite, 1);
			else edge.normals.push(normal);
		}
	}
	return edges;
}

function edgeFacing(edge: TriangleEdge, eye: Point): number[] {
	const view: Point = [
		eye[0] - (edge.a[0] + edge.b[0]) / 2,
		eye[1] - (edge.a[1] + edge.b[1]) / 2,
		eye[2] - (edge.a[2] + edge.b[2]) / 2
	];
	return edge.normals.map(n => dot(n, view));
}

export function visibleIdentityContour(triangles: ArrayLike<number>, eye: Point): Float32Array {
	const segments: number[] = [];
	for (const edge of collectTriangleEdges(triangles).values()) {
		const facing = edgeFacing(edge, eye);
		if (facing.some(v => v > 1e-8) && (facing.length === 1 || facing.some(v => v <= 1e-8))) {
			segments.push(...edge.a, ...edge.b);
		}
	}
	return mergeStraightEdgeRuns(segments);
}

/**
 * Camera-facing rims and sharp section edges. The inverted-hull stencil hides
 * every edge inside its mask, including the top annulus and an aperture reveal.
 * This pass keeps boundary edges and creases sharper than 60 degrees while
 * dropping the shallow facet seams of a curved Wall. The renderer depth-tests
 * the resulting line, so a rim on the far side cannot leak through the body.
 */
export const RIM_CREASE_COSINE = 0.5;

export function visibleRimContour(triangles: ArrayLike<number>, eye: Point): Float32Array {
	const segments: number[] = [];
	for (const edge of collectTriangleEdges(triangles).values()) {
		const facing = edgeFacing(edge, eye);
		if (!facing.some(v => v > 1e-8)) continue;
		if (edge.normals.length > 1) {
			let sharp = false;
			for (let i = 0; i < edge.normals.length && !sharp; i += 1) {
				for (let j = i + 1; j < edge.normals.length; j += 1) {
					if (dot(edge.normals[i]!, edge.normals[j]!) < RIM_CREASE_COSINE) {
						sharp = true;
						break;
					}
				}
			}
			if (!sharp) continue;
		}
		segments.push(...edge.a, ...edge.b);
	}
	return mergeStraightEdgeRuns(segments);
}
