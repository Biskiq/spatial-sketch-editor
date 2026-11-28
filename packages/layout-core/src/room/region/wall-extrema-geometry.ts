/**
 * `wall-extrema-geometry.ts` — the plan geometry, strip-cell frame and floating-point error model
 * behind `wall-extrema.ts`.
 *
 * Every candidate is computed in a **local frame** anchored at the Region
 * footprint, so rounding scales with the Layout's dimensions (bounded by the
 * 1000 m dimension limit), never with world position: `fl(x - anchor)` rounds
 * relative to the difference, not to `x`. Each computed point carries a bound
 * on its own error:
 *
 * ```text
 * base   = 8 u L                 rounding of one computed plan point, L = local extent
 * along  = 2 base / sin θ        position error of a crossing along its segment
 * δt     = 2 base / |Δq|         parameter error of a ridge crossing (q-span Δq)
 * ```
 *
 * with `u = 2^-53`. A crossing of two segments that stay within the membership
 * tolerance of each other over their overlap (`sin θ · min length ≤ tol`) is no
 * separate candidate: that stretch is inside the inclusive footprint, so the
 * extremum reads through its endpoints, which are candidates already.
 */
import type { LayoutVec2 } from '../../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../../geometry/openings';
import type { WallStripCell } from './wall-strip';

/** Unit roundoff of IEEE-754 binary64. */
export const UNIT_ROUNDOFF = 2 ** -53;

export type Segment = { readonly a: LayoutVec2; readonly b: LayoutVec2 };
export type Line = { readonly normal: LayoutVec2; readonly offset: number };

/** A crossing parameter on a segment and its error bound (metres along it). */
export type Crossing = { readonly t: number; readonly along: number };

/**
 * Parameter on `segment` where it meets `other`, with its along-segment error,
 * or `null` when they miss or stay within `tolerance` of each other (above).
 */
export function segmentCrossing(
	segment: Segment,
	other: Segment,
	base: number,
	tolerance: number,
): Crossing | null {
	const r: LayoutVec2 = [segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]];
	const s: LayoutVec2 = [other.b[0] - other.a[0], other.b[1] - other.a[1]];
	const lengthR = Math.hypot(r[0], r[1]);
	const lengthS = Math.hypot(s[0], s[1]);
	const denominator = cross(r, s);
	if (!(lengthR > 0 && lengthS > 0)) return null;
	if (Math.abs(denominator) <= tolerance * Math.max(lengthR, lengthS)) return null;
	const difference: LayoutVec2 = [other.a[0] - segment.a[0], other.a[1] - segment.a[1]];
	const t = cross(difference, s) / denominator;
	const w = cross(difference, r) / denominator;
	if (t < 0 || t > 1 || w < 0 || w > 1) return null;
	const sine = Math.abs(denominator) / (lengthR * lengthS);
	return { t, along: (2 * base) / sine };
}

/** A ridge crossing parameter on a segment and its parameter error. */
export type LineCrossing = { readonly t: number; readonly dt: number };

/** Parameter on `segment` where it meets the infinite `line`, or `null`. */
export function lineCrossing(segment: Segment, line: Line, base: number): LineCrossing | null {
	const da = dot(line.normal, segment.a) - line.offset;
	const db = dot(line.normal, segment.b) - line.offset;
	if (da === db) return null;
	const t = da / (da - db);
	if (!(t >= 0 && t <= 1)) return null;
	return { t, dt: Math.min(1, (2 * base) / Math.abs(da - db)) };
}

/**
 * Real roots of `a x² + b x + c = 0` in a cancellation-safe form. A leading
 * coefficient negligible against the others degrades to the linear root; an
 * identically zero polynomial has no isolated stationary point.
 */
export function quadraticRoots(a: number, b: number, c: number): number[] {
	const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
	if (!(scale > 0)) return [];
	if (Math.abs(a) <= 1e-14 * scale) return Math.abs(b) > 0 ? [-c / b] : [];
	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		if (discriminant >= -1e-14 * b * b) return [-b / (2 * a)];
		return [];
	}
	const root = Math.sqrt(discriminant);
	const q = -0.5 * (b + (b >= 0 ? root : -root));
	const roots = [q / a];
	if (q !== 0) roots.push(c / q);
	return roots;
}

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

export function boundsOf(points: readonly LayoutVec2[], pad: number): Box {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of points) {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}
	return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

export function boxesOverlap(left: Box, right: Box): boolean {
	return (
		left.minX <= right.maxX &&
		right.minX <= left.maxX &&
		left.minZ <= right.maxZ &&
		right.minZ <= left.maxZ
	);
}

export function pointInBox(point: LayoutVec2, box: Box): boolean {
	return (
		point[0] >= box.minX && point[0] <= box.maxX && point[1] >= box.minZ && point[1] <= box.maxZ
	);
}

export function lerp(a: LayoutVec2, b: LayoutVec2, t: number): LayoutVec2 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function dot(left: LayoutVec2 | readonly [number, number], right: LayoutVec2): number {
	return left[0] * right[0] + left[1] * right[1];
}

export function cross(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}

// --- strip cells -----------------------------------------------------------

export type CellFrame = {
	readonly cell: WallStripCell;
	readonly dF: LayoutVec2;
	readonly ea: LayoutVec2;
	readonly dE: LayoutVec2;
};

export function cellFrame(cell: WallStripCell): CellFrame {
	const ea: LayoutVec2 = [cell.ba[0] - cell.fa[0], cell.ba[1] - cell.fa[1]];
	const eb: LayoutVec2 = [cell.bb[0] - cell.fb[0], cell.bb[1] - cell.fb[1]];
	return {
		cell,
		dF: [cell.fb[0] - cell.fa[0], cell.fb[1] - cell.fa[1]],
		ea,
		dE: [eb[0] - ea[0], eb[1] - ea[1]],
	};
}

export function cellPoint(frame: CellFrame, u: number, v: number): LayoutVec2 {
	const { cell, dF, ea, dE } = frame;
	return [
		cell.fa[0] + u * dF[0] + v * (ea[0] + u * dE[0]),
		cell.fa[1] + u * dF[1] + v * (ea[1] + u * dE[1]),
	];
}

/** `∂X/∂u`, `∂X/∂v` and the Jacobian at `(u, v)`. */
export function jacobianAt(frame: CellFrame, u: number, v: number) {
	const xu: LayoutVec2 = [frame.dF[0] + v * frame.dE[0], frame.dF[1] + v * frame.dE[1]];
	const xv: LayoutVec2 = [frame.ea[0] + u * frame.dE[0], frame.ea[1] + u * frame.dE[1]];
	return { xu, xv, jacobian: cross(xu, xv) };
}

/** Station error from a plan error `error` at `(u, v)`: `|δu| <= |δp| |X_v| / |J|`. */
export function stationError(frame: CellFrame, u: number, v: number, error: number): number {
	const { xv, jacobian } = jacobianAt(frame, u, v);
	const bound = (error * Math.hypot(xv[0], xv[1])) / Math.abs(jacobian);
	return bound < 1 ? bound : 1;
}

/**
 * The Jacobian `cross(∂X/∂u, ∂X/∂v)` is affine in `(u, v)` (its `uv` term is
 * `cross(dE, dE) = 0`), so one strict sign at the four corners is one sign
 * over the whole cell: the cell is an injective, unfolded quad. A corner whose
 * Jacobian is within rounding of zero (`|J| <= 8 u |X_u| |X_v|`) cannot fix
 * that sign, so the cell is treated as degenerate.
 */
export function cellUnfolded(frame: CellFrame): boolean {
	let sign = 0;
	for (const [u, v] of [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	] as const) {
		const { xu, xv, jacobian } = jacobianAt(frame, u, v);
		const lengthU = Math.hypot(xu[0], xu[1]);
		// A face collapsed to one point (a cross-section ending at a mitre
		// corner) makes the cell a triangle: its Jacobian vanishes only at that
		// corner, and the map stays one-to-one everywhere else.
		if (lengthU <= LAYOUT_GEOMETRY_EPSILON) continue;
		if (Math.abs(jacobian) <= 8 * UNIT_ROUNDOFF * lengthU * Math.hypot(xv[0], xv[1])) return false;
		const current = jacobian > 0 ? 1 : -1;
		if (sign !== 0 && current !== sign) return false;
		sign = current;
	}
	return sign !== 0;
}
