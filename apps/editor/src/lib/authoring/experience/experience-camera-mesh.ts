/** The camera mesh and the small vector/screen helpers it shares with the marks. */
/** Stage-local CSS pixels. */
export type StagePoint = readonly [number, number];
export type CameraFaceShade = 'light' | 'side' | 'barrel' | 'cap' | 'ink';
export type V3 = readonly [number, number, number];
/** A mesh-local point: (forward, right, up) in metres, already scaled. */
export type LocalPoint = readonly [number, number, number];

export type MeshFace = {
	readonly ids: readonly number[];
	readonly shade: CameraFaceShade;
};

export type CameraMesh = {
	readonly points: readonly LocalPoint[];
	/** Body faces, each wound counter-clockwise seen from outside. */
	readonly faces: readonly MeshFace[];
	/** The lens glass disc, wound outward like the body faces. */
	readonly glass: MeshFace;
	readonly glint: LocalPoint;
	readonly lensTip: LocalPoint;
};

/**
 * The Detailed camera, built once. Dimensions follow the design sheet's `full`
 * style (body, viewfinder hump, shutter button, eight-to-ten-sided lens barrel with
 * glass), scaled so the whole camera is about 0.37 m from the back of the body to
 * the lens tip.
 */
export const CAMERA_LENGTH_SCALE = 1.15;
export const BARREL_SIDES = 10;
export const BARREL_START = 0.07;
export const BARREL_END = 0.22;
export const BARREL_RADIUS = 0.09;
export const GLASS_FRACTION = 0.62;

export function buildCameraMesh(): CameraMesh {
	const s = CAMERA_LENGTH_SCALE;
	const points: LocalPoint[] = [];
	const faces: MeshFace[] = [];
	const at = (a: number, b: number, c: number): number => {
		points.push([a * s, b * s, c * s]);
		return points.length - 1;
	};
	const orient = (ids: readonly number[], outward: V3): readonly number[] => {
		const normal = newell(ids.map((index) => points[index]!));
		return dot3(normal, outward) < 0 ? [...ids].reverse() : ids;
	};
	const shadeOf = (normal: V3): CameraFaceShade => (normal[0] > 0 || normal[2] > 0 ? 'light' : 'side');
	const box = (
		a0: number, a1: number, b0: number, b1: number, c0: number, c1: number,
		shade: (normal: V3) => CameraFaceShade
	): void => {
		const v = [
			at(a0, b0, c0), at(a1, b0, c0), at(a1, b1, c0), at(a0, b1, c0),
			at(a0, b0, c1), at(a1, b0, c1), at(a1, b1, c1), at(a0, b1, c1)
		];
		const quads: readonly [readonly number[], V3][] = [
			[[0, 1, 2, 3], [0, 0, -1]],
			[[4, 5, 6, 7], [0, 0, 1]],
			[[0, 1, 5, 4], [0, -1, 0]],
			[[3, 2, 6, 7], [0, 1, 0]],
			[[0, 3, 7, 4], [-1, 0, 0]],
			[[1, 2, 6, 5], [1, 0, 0]]
		];
		for (const [quad, normal] of quads) {
			faces.push({ ids: orient(quad.map((index) => v[index]!), normal), shade: shade(normal) });
		}
	};

	box(-0.1, 0.07, -0.18, 0.18, -0.12, 0.12, shadeOf);
	box(-0.07, 0.05, -0.06, 0.06, 0.12, 0.19, shadeOf);
	box(-0.03, 0.04, 0.1, 0.15, 0.12, 0.15, () => 'ink');

	const ring = (a: number, radius: number, scale = 1): number[] =>
		Array.from({ length: BARREL_SIDES }, (_, index) => {
			const t = (index / BARREL_SIDES) * Math.PI * 2;
			return at(a, Math.cos(t) * radius * scale, Math.sin(t) * radius * scale);
		});
	const near = ring(BARREL_START, BARREL_RADIUS);
	const far = ring(BARREL_END, BARREL_RADIUS);
	for (let index = 0; index < BARREL_SIDES; index += 1) {
		const next = (index + 1) % BARREL_SIDES;
		const t = ((index + 0.5) / BARREL_SIDES) * Math.PI * 2;
		const normal: V3 = [0, Math.cos(t), Math.sin(t)];
		faces.push({
			ids: orient([near[index]!, near[next]!, far[next]!, far[index]!], normal),
			shade: 'barrel'
		});
	}
	faces.push({ ids: orient(far, [1, 0, 0]), shade: 'cap' });

	const glassRing = ring(BARREL_END + 0.001, BARREL_RADIUS, GLASS_FRACTION);
	const glass: MeshFace = { ids: orient(glassRing, [1, 0, 0]), shade: 'cap' };

	return {
		points,
		faces,
		glass,
		glint: [(BARREL_END + 0.002) * s, -BARREL_RADIUS * 0.25 * s, BARREL_RADIUS * 0.3 * s],
		lensTip: [BARREL_END * s, 0, 0]
	};
}

/** Built once at module scope; only the per-View transform changes. */
export const CAMERA_MESH = buildCameraMesh();
export const CAMERA_LENS_OFFSET_METRES = CAMERA_MESH.lensTip[0];

export function dot3(a: V3, b: V3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a: V3, b: V3): V3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function unit3(a: V3): V3 | null {
	const length = Math.hypot(a[0], a[1], a[2]);
	return length < 1e-9 ? null : [a[0] / length, a[1] / length, a[2] / length];
}

/** Newell's method: the polygon normal, right-handed for counter-clockwise winding. */
export function newell(points: readonly LocalPoint[]): V3 {
	let x = 0;
	let y = 0;
	let z = 0;
	for (let index = 0; index < points.length; index += 1) {
		const p = points[index]!;
		const q = points[(index + 1) % points.length]!;
		x += (p[1] - q[1]) * (p[2] + q[2]);
		y += (p[2] - q[2]) * (p[0] + q[0]);
		z += (p[0] - q[0]) * (p[1] + q[1]);
	}
	return [x, y, z];
}

/** Twice the signed area of a screen polygon, in pixel space (y down). */
export function signedArea(points: readonly StagePoint[]): number {
	let sum = 0;
	for (let index = 0; index < points.length; index += 1) {
		const p = points[index]!;
		const q = points[(index + 1) % points.length]!;
		sum += p[0] * q[1] - q[0] * p[1];
	}
	return sum;
}

/** Monotone-chain convex hull, counter-clockwise in screen space. */
export function convexHull(points: readonly StagePoint[]): StagePoint[] {
	const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (sorted.length < 3) return sorted;
	const cross = (o: StagePoint, a: StagePoint, b: StagePoint): number =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: StagePoint[] = [];
	for (const point of sorted) {
		while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
		lower.push(point);
	}
	const upper: StagePoint[] = [];
	for (let index = sorted.length - 1; index >= 0; index -= 1) {
		const point = sorted[index]!;
		while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
		upper.push(point);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

