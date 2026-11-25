import type { Iv } from '../../geometry/binary64-interval';
import { ivAdd, ivMul, ivSub, nextDown, nextUp } from '../../geometry/binary64-interval';
import type { UnitCubicScalar } from '../round-template';
import { TEMPLATE_HANDLE_K, TEMPLATE_STEP, UNIT_TEMPLATE_SCALARS } from '../round-template';
import type { LayoutVec2 } from '../../geometry/coordinates';
import { WALL_CURVE_SPLIT_PARAMETER_TOLERANCE } from '../../wall/curve-algebra';
import { CLOSED_WALL_CIRCLE_SPAN_COUNT } from '../../wall/types';

export const TWO_PI = Math.PI * 2;

export const TEMPLATE_SPAN_COUNT = CLOSED_WALL_CIRCLE_SPAN_COUNT;

export const MIN_RADIUS_THICKNESS_SLACK = 1e-6;


export const IV_ZERO: Iv = { lo: 0, hi: 0 };

export const IV_ONE: Iv = { lo: 1, hi: 1 };


export function ivPoint(x: number): Iv {
	return { lo: x, hi: x };
}


export function ivDiv(a: Iv, b: Iv): Iv | null {
	if (b.lo <= 0 && b.hi >= 0) return null;
	const q1 = a.lo / b.lo;
	const q2 = a.lo / b.hi;
	const q3 = a.hi / b.lo;
	const q4 = a.hi / b.hi;
	return {
		lo: nextDown(Math.min(q1, q2, q3, q4)),
		hi: nextUp(Math.max(q1, q2, q3, q4))
	};
}


export function ivSqrt(a: Iv): Iv {
	return {
		lo: a.lo <= 0 ? 0 : nextDown(Math.sqrt(a.lo)),
		hi: a.hi <= 0 ? 0 : nextUp(Math.sqrt(a.hi))
	};
}


export function ivClamp(a: Iv, min: number, max: number): Iv {
	const lo = Math.max(min, Math.min(max, a.lo));
	const hi = Math.max(min, Math.min(max, a.hi));
	return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}


export function ivOverlaps(a: Iv, b: Iv): boolean {
	return a.lo <= b.hi && b.lo <= a.hi;
}


export function ivIntersect(a: Iv, b: Iv): Iv | null {
	const lo = Math.max(a.lo, b.lo);
	const hi = Math.min(a.hi, b.hi);
	return lo <= hi ? { lo, hi } : null;
}


function ivHull(a: Iv, b: Iv): Iv {
	return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
}


export function ivMid(a: Iv): number {
	return a.lo + (a.hi - a.lo) * 0.5;
}


/**
 * Outward-rounded linear interpolation `(1 - t) * a + t * b` for `t ⊆ [0, 1]`.
 *
 * Evaluating at the two endpoints of `t` and taking their hull avoids the
 * interval-dependency inflation of `t` appearing in both `(1 - t)` and `t`.
 */
function ivLerp(a: Iv, b: Iv, t: Iv): Iv {
	const evalAt = (s: number): Iv => {
		if (s === 0) return a;
		if (s === 1) return b;
		const oneMinus = ivSub(IV_ONE, ivPoint(s));
		return ivAdd(ivMul(oneMinus, a), ivMul(ivPoint(s), b));
	};
	if (t.lo === t.hi) return evalAt(t.lo);
	return ivHull(evalAt(t.lo), evalAt(t.hi));
}


// ---------------------------------------------------------------------------
// Canonical 16-span unit circle template in seam-aligned coordinates
// ---------------------------------------------------------------------------

export type UnitCubicIv = readonly [
	readonly [Iv, Iv],
	readonly [Iv, Iv],
	readonly [Iv, Iv],
	readonly [Iv, Iv]
];


function trigIv(fn: (x: number) => number, angle: number): Iv {
	const value = fn(angle);
	// Elementary libm trig in binary64 is accurate to <= 1 ULP; 2 ULPs outward
	// conservatively encloses the exact real trigonometric value.
	return ivClamp({ lo: nextDown(nextDown(value)), hi: nextUp(nextUp(value)) }, -1, 1);
}


const TEMPLATE_HANDLE_K_IV: Iv = {
	lo: nextDown(nextDown(TEMPLATE_HANDLE_K)),
	hi: nextUp(nextUp(TEMPLATE_HANDLE_K))
};


export const UNIT_TEMPLATE_INTERVALS: readonly UnitCubicIv[] = Array.from(
	{ length: TEMPLATE_SPAN_COUNT },
	(_, index) => {
		const a0 = index * TEMPLATE_STEP;
		const a1 = (index + 1) * TEMPLATE_STEP;
		const c0 = index === 0 ? IV_ONE : trigIv(Math.cos, a0);
		const s0 = index === 0 ? IV_ZERO : trigIv(Math.sin, a0);
		const c1 = index === TEMPLATE_SPAN_COUNT - 1 ? IV_ONE : trigIv(Math.cos, a1);
		const s1 = index === TEMPLATE_SPAN_COUNT - 1 ? IV_ZERO : trigIv(Math.sin, a1);
		const p0 = [c0, s0] as const;
		const p1 = [
			ivSub(c0, ivMul(TEMPLATE_HANDLE_K_IV, s0)),
			ivAdd(s0, ivMul(TEMPLATE_HANDLE_K_IV, c0))
		] as const;
		const p2 = [
			ivAdd(c1, ivMul(TEMPLATE_HANDLE_K_IV, s1)),
			ivSub(s1, ivMul(TEMPLATE_HANDLE_K_IV, c1))
		] as const;
		const p3 = [c1, s1] as const;
		return [p0, p1, p2, p3] as const;
	}
);


/**
 * Evaluate the polar angle of unit template span 0 at parameter `t ∈ [0, 1]`.
 *
 * Strictly monotonically increasing from `0` at `t = 0` to `TEMPLATE_STEP` at
 * `t = 1`.
 */
function unitSpan0PolarAngle(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return TEMPLATE_STEP;
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_SCALARS[0]!;
	const u = 1 - t;
	const u2 = u * u;
	const t2 = t * t;
	const x = u2 * u * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t2 * t * p3[0];
	const z = u2 * u * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t2 * t * p3[1];
	return Math.atan2(z, x);
}


/**
 * Invert a local polar angle `deltaPhi ∈ [0, TEMPLATE_STEP]` on unit template
 * span 0 via monotone bisection, stopping at
 * `WALL_CURVE_SPLIT_PARAMETER_TOLERANCE`.
 */
export function invertLocalPolarAngle(deltaPhi: number, tolerance = WALL_CURVE_SPLIT_PARAMETER_TOLERANCE): Iv {
	if (deltaPhi <= 0) return IV_ZERO;
	if (deltaPhi >= TEMPLATE_STEP) return IV_ONE;
	let lo = 0;
	let hi = 1;
	for (let iter = 0; iter < 64; iter += 1) {
		if (hi - lo <= tolerance) break;
		const mid = lo + (hi - lo) * 0.5;
		if (mid === lo || mid === hi) break;
		if (unitSpan0PolarAngle(mid) < deltaPhi) lo = mid;
		else hi = mid;
	}
	return { lo, hi };
}


/**
 * Invert a seam-aligned polar angle `phi` (possibly slightly outside `[0, 2π]`
 * due to interval padding) into a global template station in `[0, 16]`.
 */
export function invertGlobalPolarAngleLower(phi: number): number {
	if (phi <= 0) return 0;
	if (phi >= TWO_PI) return TEMPLATE_SPAN_COUNT;
	const span = Math.min(TEMPLATE_SPAN_COUNT - 1, Math.floor(phi / TEMPLATE_STEP));
	const local = invertLocalPolarAngle(phi - span * TEMPLATE_STEP);
	return span + local.lo;
}


export function invertGlobalPolarAngleUpper(phi: number): number {
	if (phi <= 0) return 0;
	if (phi >= TWO_PI) return TEMPLATE_SPAN_COUNT;
	const span = Math.min(TEMPLATE_SPAN_COUNT - 1, Math.floor(phi / TEMPLATE_STEP));
	const local = invertLocalPolarAngle(phi - span * TEMPLATE_STEP);
	return span + local.hi;
}


/**
 * Compute the exact outward-rounded polar angle interval of a 2D interval box
 * `(ax, az)` that does not contain the origin, unwrapped into `[0, 2π]` around
 * the reference angle `hintAngle`.
 */
export function polarAngleInterval(ax: Iv, az: Iv, hintAngle: number): Iv | null {
	if (ax.lo <= 0 && ax.hi >= 0 && az.lo <= 0 && az.hi >= 0) return null;
	const corners: readonly [number, number][] = [
		[ax.lo, az.lo],
		[ax.lo, az.hi],
		[ax.hi, az.lo],
		[ax.hi, az.hi]
	];
	let minAngle = Infinity;
	let maxAngle = -Infinity;
	for (const [x, z] of corners) {
		let angle = Math.atan2(z, x);
		// Unwrap near `hintAngle` so the 4 corners stay in one continuous branch.
		while (angle - hintAngle > Math.PI) angle -= TWO_PI;
		while (angle - hintAngle < -Math.PI) angle += TWO_PI;
		if (angle < minAngle) minAngle = angle;
		if (angle > maxAngle) maxAngle = angle;
	}
	// Pad by 2 ULPs for `atan2` rounding.
	return {
		lo: nextDown(nextDown(minAngle)),
		hi: nextUp(nextUp(maxAngle))
	};
}


/** Blossom `B(a, b, c)` of one coordinate of a cubic Bézier curve (interval). */
function blossom1dIv(q0: Iv, q1: Iv, q2: Iv, q3: Iv, a: Iv, b: Iv, c: Iv): Iv {
	const l10 = ivLerp(q0, q1, a);
	const l11 = ivLerp(q1, q2, a);
	const l12 = ivLerp(q2, q3, a);
	const l20 = ivLerp(l10, l11, b);
	const l21 = ivLerp(l11, l12, b);
	return ivLerp(l20, l21, c);
}


/**
 * Outward-rounded de Casteljau subspan control points of unit template span
 * `spanIndex` over parameter interval `[u, v]` (`0 <= u <= v <= 1`).
 */
export function templateSubspanUnitIv(spanIndex: number, u: Iv, v: Iv): UnitCubicIv {
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_INTERVALS[spanIndex]!;
	if (u.lo === 0 && u.hi === 0 && v.lo === 1 && v.hi === 1) {
		return [p0, p1, p2, p3];
	}
	const evalPair = (a: Iv, b: Iv, c: Iv): readonly [Iv, Iv] => [
		blossom1dIv(p0[0], p1[0], p2[0], p3[0], a, b, c),
		blossom1dIv(p0[1], p1[1], p2[1], p3[1], a, b, c)
	];
	return [
		evalPair(u, u, u),
		evalPair(u, u, v),
		evalPair(u, v, v),
		evalPair(v, v, v)
	];
}


/** Scalar blossom `B(a, b, c)` for deterministic template writing. */
function blossom1dScalar(q0: number, q1: number, q2: number, q3: number, a: number, b: number, c: number): number {
	const lerp = (x: number, y: number, t: number) => (1 - t) * x + t * y;
	const l10 = lerp(q0, q1, a);
	const l11 = lerp(q1, q2, a);
	const l12 = lerp(q2, q3, a);
	const l20 = lerp(l10, l11, b);
	const l21 = lerp(l11, l12, b);
	return lerp(l20, l21, c);
}


export function templateSubspanUnitScalar(spanIndex: number, u: number, v: number): UnitCubicScalar {
	const [p0, p1, p2, p3] = UNIT_TEMPLATE_SCALARS[spanIndex]!;
	if (u === 0 && v === 1) return [p0, p1, p2, p3];
	const evalPt = (a: number, b: number, c: number): LayoutVec2 => [
		blossom1dScalar(p0[0], p1[0], p2[0], p3[0], a, b, c),
		blossom1dScalar(p0[1], p1[1], p2[1], p3[1], a, b, c)
	];
	return [evalPt(u, u, u), evalPt(u, u, v), evalPt(u, v, v), evalPt(v, v, v)];
}


/** Rotate and scale a seam-aligned unit interval point `(qx, qz)` to centre-local. */
export function unitToLocalIv(
	qx: Iv,
	qz: Iv,
	radiusIv: Iv,
	ux: Iv,
	uz: Iv
): readonly [Iv, Iv] {
	const rx = ivSub(ivMul(qx, ux), ivMul(qz, uz));
	const rz = ivAdd(ivMul(qx, uz), ivMul(qz, ux));
	return [ivMul(radiusIv, rx), ivMul(radiusIv, rz)];
}


/** Trig range on an unwrapped phase bracket, including interior extrema. */
export function phaseDirection(phase: Iv, reference: LayoutVec2): readonly [Iv, Iv] {
	const range = (fn: (x: number) => number, peak: number): Iv => {
		const ends = ivHull(trigIv(fn, phase.lo), trigIv(fn, phase.hi));
		const includes = (offset: number): boolean => {
			const first = offset + Math.ceil((phase.lo - offset) / TWO_PI) * TWO_PI;
			return first <= phase.hi;
		};
		return { lo: includes(peak + Math.PI) ? -1 : ends.lo, hi: includes(peak) ? 1 : ends.hi };
	};
	if (phase.lo === 0 && phase.hi === 0) return [ivPoint(reference[0]), ivPoint(reference[1])];
	return unitToLocalIv(range(Math.cos, 0), range(Math.sin, Math.PI / 2), IV_ONE, ivPoint(reference[0]), ivPoint(reference[1]));
}
