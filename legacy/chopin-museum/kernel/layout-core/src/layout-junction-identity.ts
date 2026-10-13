/**
 * Canonical coordinate identity for Layout Junctions.
 *
 * This is an identity tolerance, not a screen-space acquisition radius and
 * not a geometry/intersection tolerance. It only absorbs numerical noise
 * that cannot express a separate authored node; callers adopt the existing
 * Junction's stored coordinate when the predicate matches.
 */
import type { LayoutVec2 } from './layout-types';

/** Maximum world-space distance at which two coordinates describe one Junction. */
export const JUNCTION_COINCIDENCE_EPSILON = 1e-9;

/** Whether two Layout coordinates describe the same canonical Junction. */
export function coincidesAsJunction(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.hypot(a[0] - b[0], a[1] - b[1]) <= JUNCTION_COINCIDENCE_EPSILON;
}
