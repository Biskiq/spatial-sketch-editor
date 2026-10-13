/**
 * `layout-robust-orientation.ts` — the one Museum X/Z robust orientation
 * adapter (P23.8 / H3 §4).
 *
 * Wraps `robust-predicates`' adaptive `orient2d` (Shewchuk expansion
 * arithmetic) behind a single renderer-neutral seam. Upstream documents its
 * API in a y-down screen convention; Museum topology operates in world X/Z
 * math, so the adapter negates the upstream result.
 *
 * Contract (locked by `layout-orient-xz.test.ts`):
 *
 * ```text
 * orientXZ(a, b, c) >  0  →  c is left of the directed line a→b
 * orientXZ(a, b, c) <  0  →  c is right of the directed line a→b
 * orientXZ(a, b, c) === 0 →  a, b, c are exactly collinear
 * ```
 *
 * Rules:
 * - callers never import `robust-predicates` directly (H3 §4.4);
 * - no epsilon is ever applied to the result — the sign *is* the answer and
 *   is exact for the given doubles;
 * - only `orient2d` is used; `orient2dfast` and the in/3D predicates are not
 *   part of Museum topology (H3 §4.4).
 *
 * Dependency provenance (H3 §3): `mourner/robust-predicates@3.0.3`,
 * Unlicense / public-domain dedication; `orient2d` only.
 */
import { orient2d } from 'robust-predicates';
import type { LayoutVec2 } from './layout-types';

export function orientXZ(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
	// Museum standard: positive => c is left of directed a→b in X/Z. The
	// upstream predicate is y-down, hence the negation.
	const sign = -orient2d(a[0], a[1], b[0], b[1], c[0], c[1]);
	// Negation maps exact zero to IEEE -0; normalize so callers can compare
	// against `0` with Object.is-style equality (Vitest `toBe`).
	return sign === 0 ? 0 : sign;
}
