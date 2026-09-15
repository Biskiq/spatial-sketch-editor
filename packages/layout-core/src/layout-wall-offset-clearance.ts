/**
 * `layout-wall-offset-clearance.ts` — P23.11 shared finite-thickness Wall
 * clearance predicate (Issue #6).
 *
 * A Wall renders as a solid of finite `thickness`, i.e. its centerline swept
 * with ±`thickness/2` offsets. Two failures follow from the geometry alone,
 * and neither is visible from the centerline:
 *
 * - `fold` — a bend tighter than half the thickness makes an offset polyline
 *   cross itself, so the front or back face turns inside out;
 * - `neck` — the Wall passes closer than its own thickness to itself, so the
 *   two offset regions overlap.
 *
 * Before P23.11 this rule lived only inside the two renderer mesh builders, so
 * a curved Wall could pass commit validation and then produce a broken solid
 * with no canonical error — the exact defect Issue #6 describes.
 *
 * ONE pure implementation now serves all three consumers: canonical compile
 * acceptance, the editor mesh builder and the museum mesh builder. It reads
 * compiled samples only — no renderer, no Three.js, no editor or museum state
 * — so an accepted document cannot be rejected at render time for a reason
 * the acceptance path could have seen and did not.
 */
import {
	LAYOUT_GEOMETRY_EPSILON
} from './layout-geometry-openings';
import { sampledPolylineSelfIntersects, type CurveSample } from './layout-geometry-curve';
import type { LayoutVec2 } from './layout-types';

/** Which way a finite-thickness Wall fails to clear itself. */
export type WallOffsetClearanceFailure = 'fold' | 'neck';

/**
 * Issue codes owned by this predicate. Both mesh builders and the canonical
 * compiler emit these verbatim, so an accepted document and a rendered one
 * speak the same vocabulary.
 */
export const WALL_OFFSET_FOLD_CODE = 'wall_offset_fold' as const;
export const WALL_OFFSET_OVERLAP_CODE = 'wall_offset_overlap' as const;
export const WALL_CLEARANCE_INSUFFICIENT_CODE = 'wall_clearance_insufficient' as const;

/** Human-facing messages, shared so core and both renderers explain it alike. */
export const WALL_OFFSET_FOLD_MESSAGE =
	'Wall offset folds or self-intersects (curve radius smaller than half the wall thickness).' as const;
export const WALL_OFFSET_OVERLAP_MESSAGE =
	'Wall passes closer than its thickness to itself (narrow neck); offset regions overlap.' as const;

/** Offset one sample polyline laterally by `half` along its own normals. */
export function offsetCurveSamples(
	samples: readonly CurveSample[],
	half: number
): CurveSample[] {
	return samples.map((sample) => ({
		point: [
			sample.point[0] + half * sample.normal[0],
			sample.point[1] + half * sample.normal[1]
		] as LayoutVec2,
		distance: sample.distance,
		tangent: sample.tangent,
		normal: sample.normal,
		t: sample.t
	}));
}

/** Minimum distance between two 2D segments (standard clamped closest pair). */
export function polylineSegmentDistance(
	a0: LayoutVec2,
	a1: LayoutVec2,
	b0: LayoutVec2,
	b1: LayoutVec2
): number {
	const d0 = [a1[0] - a0[0], a1[1] - a0[1]];
	const d1 = [b1[0] - b0[0], b1[1] - b0[1]];
	const r = [a0[0] - b0[0], a0[1] - b0[1]];
	const a = d0[0]! * d0[0]! + d0[1]! * d0[1]!;
	const e = d1[0]! * d1[0]! + d1[1]! * d1[1]!;
	const f = d1[0]! * r[0]! + d1[1]! * r[1]!;
	let s = 0;
	let t = 0;
	if (a <= LAYOUT_GEOMETRY_EPSILON && e <= LAYOUT_GEOMETRY_EPSILON) {
		return Math.hypot(r[0]!, r[1]!);
	}
	if (a <= LAYOUT_GEOMETRY_EPSILON) {
		t = clamp(f / e, 0, 1);
	} else {
		const c = d0[0]! * r[0]! + d0[1]! * r[1]!;
		if (e <= LAYOUT_GEOMETRY_EPSILON) {
			s = clamp(-c / a, 0, 1);
		} else {
			const b = d0[0]! * d1[0]! + d0[1]! * d1[1]!;
			const denom = a * e - b * b;
			s = denom > LAYOUT_GEOMETRY_EPSILON ? clamp((b * f - c * e) / denom, 0, 1) : 0;
			t = (b * s + f) / e;
			if (t < 0) {
				t = 0;
				s = clamp(-c / a, 0, 1);
			} else if (t > 1) {
				t = 1;
				s = clamp((b - c) / a, 0, 1);
			}
		}
	}
	const closestA = [a0[0] + d0[0]! * s, a0[1] + d0[1]! * s];
	const closestB = [b0[0] + d1[0]! * t, b0[1] + d1[1]! * t];
	return Math.hypot(closestA[0]! - closestB[0]!, closestA[1]! - closestB[1]!);
}

/** Minimum distance between two sampled polylines. */
export function minPolylineDistance(
	first: readonly CurveSample[],
	second: readonly CurveSample[]
): number {
	let best = Infinity;
	for (let index = 1; index < first.length; index += 1) {
		for (let other = 1; other < second.length; other += 1) {
			best = Math.min(
				best,
				polylineSegmentDistance(
					first[index - 1]!.point,
					first[index]!.point,
					second[other - 1]!.point,
					second[other]!.point
				)
			);
		}
	}
	return best;
}

/**
 * Does one Wall's centerline pass closer than its own `thickness` to itself?
 *
 * A self-overlap only happens when the Wall folds *back on itself*: two
 * non-adjacent portions are geometrically close (< thickness) and their
 * tangents oppose (dot < 0). Same-direction chords of a smooth or straight
 * run are the Wall's own continuous body, never a narrow neck — which is why a
 * straight Wall can never fail this test.
 */
export function polylineSelfClearance(
	samples: readonly CurveSample[],
	thickness: number
): boolean {
	for (let index = 0; index < samples.length - 1; index += 1) {
		const tangentA = samples[index]!.tangent;
		for (let other = index + 2; other < samples.length - 1; other += 1) {
			const tangentB = samples[other]!.tangent;
			const dot = tangentA[0] * tangentB[0] + tangentA[1] * tangentB[1];
			if (dot >= 0) continue;
			const spacing = polylineSegmentDistance(
				samples[index]!.point,
				samples[index + 1]!.point,
				samples[other]!.point,
				samples[other + 1]!.point
			);
			if (spacing < thickness - LAYOUT_GEOMETRY_EPSILON) return true;
		}
	}
	return false;
}

/**
 * The one per-Wall clearance decision: `undefined` when the Wall's finite
 * thickness clears itself, otherwise which way it fails.
 *
 * Callers that already know a Wall is straight may skip this (a straight
 * centerline offsets to two parallel polylines with identical tangents, so
 * neither branch can fire); the predicate itself stays total so a caller that
 * does call it is never wrong.
 */
export function wallOffsetClearanceFailure(
	samples: readonly CurveSample[],
	thickness: number
): WallOffsetClearanceFailure | undefined {
	if (!Number.isFinite(thickness) || thickness <= 0) return undefined;
	if (samples.length < 2) return undefined;
	const half = thickness / 2;
	if (
		sampledPolylineSelfIntersects(offsetCurveSamples(samples, half)) ||
		sampledPolylineSelfIntersects(offsetCurveSamples(samples, -half))
	) {
		return 'fold';
	}
	if (polylineSelfClearance(samples, thickness)) return 'neck';
	return undefined;
}

/** Do two Walls pass closer than their combined half-thicknesses? */
export function wallPairClearanceOverlap(
	first: { samples: readonly CurveSample[]; thickness: number },
	second: { samples: readonly CurveSample[]; thickness: number }
): boolean {
	return (
		minPolylineDistance(first.samples, second.samples) <
		first.thickness / 2 + second.thickness / 2
	);
}

function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
