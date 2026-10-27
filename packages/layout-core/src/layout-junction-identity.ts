/**
 * Canonical coordinate identity for Layout Junctions.
 *
 * This is an identity tolerance, not a screen-space acquisition radius and
 * not a geometry/intersection tolerance. It only absorbs numerical noise
 * that cannot express a separate authored node; callers adopt the existing
 * Junction's stored coordinate when the predicate matches.
 */
import type { LayoutVec2 } from './layout-coordinates';
import { countWork } from './p2311-perf';

/** Maximum world-space distance at which two coordinates describe one Junction. */
export const JUNCTION_COINCIDENCE_EPSILON = 1e-9;

/** Whether two Layout coordinates describe the same canonical Junction. */
export function coincidesAsJunction(a: LayoutVec2, b: LayoutVec2): boolean {
	return Math.hypot(a[0] - b[0], a[1] - b[1]) <= JUNCTION_COINCIDENCE_EPSILON;
}

/**
 * Every Junction pair that could coincide, as index pairs in gate order
 * (first ascending, then second). T1.P02.S06 D.1 (H3).
 *
 * The `duplicate_junction_point` rule used to be an O(J²) loop over every pair.
 * Coincidence is a tolerance test, so a pair with a coordinate difference above
 * the epsilon on either axis cannot coincide: a sweep over the Junctions sorted
 * by X visits only the pairs whose X gap is within the epsilon and keeps those
 * whose Z gap is too. The surviving set is a SUPERSET of the coincident pairs
 * (the distance test implies both axis tests), so the rule, its first-wins order
 * and its message are unchanged — the caller still decides `coincidesAsJunction`
 * and the connected-component rule at each pair.
 *
 * Degenerate coordinates are the one case the sweep cannot prune exactly. A
 * `NaN` makes the sort comparator inconsistent, so a finite Junction that
 * coincides with an earlier one can be left behind a `NaN` and never visited —
 * the old exhaustive loop reported it. When any coordinate is non-finite the
 * sweep therefore enumerates every pair, which is the shipped behaviour at a cost
 * only a malformed document (a validated document has finite coordinates) pays.
 */
export function coincidentJunctionPairs(
	junctions: readonly { readonly point: LayoutVec2 }[]
): Array<[number, number]> {
	// Exhaustive only on the malformed path: J(J−1)/2 tuples, the loop this rule
	// shipped with. A validated document never reaches it.
	if (junctions.some((junction) => !Number.isFinite(junction.point[0]) || !Number.isFinite(junction.point[1]))) {
		const exhaustive: Array<[number, number]> = [];
		for (let first = 0; first < junctions.length; first += 1) {
			for (let second = first + 1; second < junctions.length; second += 1) exhaustive.push([first, second]);
		}
		countWork('index:junction-sweep-visits', (junctions.length * (junctions.length - 1)) / 2);
		countWork('index:junction-sweep-fallback', 1);
		return exhaustive;
	}
	const order = junctions.map((_, index) => index);
	order.sort(
		(a, b) => junctions[a]!.point[0] - junctions[b]!.point[0] || a - b
	);
	const pairs: Array<[number, number]> = [];
	let visited = 0;
	for (let first = 0; first < order.length; first += 1) {
		const baseIndex = order[first]!;
		const base = junctions[baseIndex]!.point;
		for (let next = first + 1; next < order.length; next += 1) {
			const otherIndex = order[next]!;
			const other = junctions[otherIndex]!.point;
			visited += 1;
			if (other[0] - base[0] > JUNCTION_COINCIDENCE_EPSILON) break;
			if (Math.abs(other[1] - base[1]) > JUNCTION_COINCIDENCE_EPSILON) continue;
			pairs.push(baseIndex < otherIndex ? [baseIndex, otherIndex] : [otherIndex, baseIndex]);
		}
	}
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	// I2 count oracle: the sweep's own visits, and the pairs it hands the rule.
	countWork('index:junction-sweep-visits', visited);
	return pairs;
}
