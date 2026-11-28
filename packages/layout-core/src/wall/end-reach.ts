/**
 * `end-reach.ts` — where a Wall face cross-section lies inside an untrimmed
 * end's corner reach.
 *
 * At a mitre (or bevel) end the face's resolved corner sits `half * cot(θ/2)`
 * along the Wall from the end station. A cross-section at a distance before
 * that projection (a top knot or curve sample inside the reach) would place its
 * offset point beyond the corner and fold the face. Such a section ends at the
 * resolved corner instead, so the end cell narrows to a triangle and the face
 * still covers exactly the Wall body. One rule shared by the Layout strip that
 * certifies relations and the editor mesh that renders the Wall.
 */
import type { LayoutVec2 } from '../geometry/coordinates';
import { LAYOUT_GEOMETRY_EPSILON } from '../geometry/openings';

type ReachSample = {
	readonly point: LayoutVec2;
	readonly tangent: LayoutVec2;
	readonly distance: number;
};

/**
 * The resolved corner a face section at `distance` must take, or `null` when
 * the section keeps its own offset point. `startCorner`/`endCorner` are the
 * face's own corner points at untrimmed ends; pass `null` for a trimmed or
 * free end.
 */
export function wallEndReachPoint(
	samples: readonly ReachSample[],
	distance: number,
	startCorner: LayoutVec2 | null,
	endCorner: LayoutVec2 | null,
): LayoutVec2 | null {
	const first = samples[0];
	const last = samples.at(-1);
	if (!first || !last) return null;
	if (startCorner && distance < along(startCorner, first) - LAYOUT_GEOMETRY_EPSILON)
		return startCorner;
	if (endCorner && distance > last.distance + along(endCorner, last) + LAYOUT_GEOMETRY_EPSILON)
		return endCorner;
	return null;
}

function along(point: LayoutVec2, origin: ReachSample): number {
	return (
		(point[0] - origin.point[0]) * origin.tangent[0] +
		(point[1] - origin.point[1]) * origin.tangent[1]
	);
}
