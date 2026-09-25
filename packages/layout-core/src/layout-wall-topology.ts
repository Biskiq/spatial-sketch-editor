/**
 * `layout-wall-topology.ts` — P23.8 typed straight-wall intersection
 * classifier (H3 §8) plus the topology diagnostics vocabulary.
 *
 * One renderer-neutral classifier over the `orientXZ` adapter. It answers
 * the semantic question the legacy boolean helper could not (H3 §2):
 *
 * ```text
 * none | shared explicit junction | endpoint-on-interior (T)
 * | proper crossing (X) | collinear endpoint touch | collinear overlap
 * | numerically unstable
 * ```
 *
 * Classification rules (H3 §8):
 * 1. an explicit shared Junction ID wins first — that is a topological
 *    endpoint touch, classified before any orientation math;
 * 2. four robust orientation signs decide proper/T/collinear classes;
 * 3. proper-crossing coordinates use ordinary double line intersection after
 *    robust classification, validated finite + inside both envelopes —
 *    otherwise `unstable`, never a nearest-endpoint snap;
 * 4. no distance tolerance ever decides an orientation sign; proximity only
 *    feeds the separate near-coincident *diagnostic*.
 */
import type { LayoutVec2 } from './layout-types';
import {
	CURVE_SELF_INTERSECTION_TOLERANCE,
	sampledPolylineIntersects,
	sampledPolylineSelfIntersects,
	type CurveSample
} from './layout-geometry-curve';
import { orientXZ } from './layout-robust-orientation';

/** Typed intersection classification between two straight wall segments. */
export type WallIntersectionKind =
	| 'none'
	| 'shared-explicit-junction'
	| 'endpoint-on-interior'
	| 'proper-crossing'
	| 'collinear-endpoint-touch'
	| 'collinear-overlap'
	| 'invalid';

export type WallIntersection =
	| { kind: 'none' }
	| { kind: 'shared-explicit-junction'; junctionId: string; point: LayoutVec2 }
	| {
			kind: 'endpoint-on-interior';
			/** Wall whose endpoint lies on the other wall. */
			endpointWallId: string;
			/** Wall hosting the T. */
			interiorWallId: string;
			point: LayoutVec2;
	  }
	| { kind: 'proper-crossing'; point: LayoutVec2 }
	| { kind: 'collinear-endpoint-touch'; point: LayoutVec2 }
	| { kind: 'collinear-overlap'; start: LayoutVec2; end: LayoutVec2 }
	| { kind: 'invalid'; reason: string };

/** A resolved input segment: endpoints + authored identity for classification. */
export type TopologySegment = {
	id: string;
	start: LayoutVec2;
	end: LayoutVec2;
};

/**
 * P23.11 — a resolved input Wall for curve-level classification: authored
 * identity, endpoint Junction IDs and the **canonical forward** sampled
 * centerline (canonical order, i.e. `startJunctionId → endJunctionId`).
 */
export type SampledTopologyWall = {
	id: string;
	startJunctionId: string;
	endJunctionId: string;
	samples: readonly CurveSample[];
};

/**
 * P23.11 — does one Wall's sampled centerline cross itself?
 *
 * The chord-level classifier cannot see this: a bowed Wall whose endpoints are
 * far apart still sweeps back through its own path. Direction-independent, so
 * the canonical sample order is always sufficient.
 */
export function sampledWallSelfIntersects(wall: SampledTopologyWall): boolean {
	return sampledPolylineSelfIntersects(wall.samples, CURVE_SELF_INTERSECTION_TOLERANCE);
}

/**
 * P23.11 — do two Walls' sampled centerlines cross?
 *
 * `classifyWallIntersection` is exact for straight Walls but blind to curvature:
 * two Walls whose endpoint chords miss each other can still cross where they
 * bow, and one curved Wall can cross a straight host its chord never reaches.
 * This is the curve-level companion, reusing the curve kernel's own polyline
 * predicate rather than a second intersection recipe.
 *
 * When the Walls share an explicit Junction, contact **there** is legal graph
 * connectivity: both polylines necessarily touch at that point. The shared
 * traversal is oriented so the shared Junction is `a`'s end and `b`'s start —
 * the one configuration the kernel's `ignoreSharedEndpoint` seam recognises —
 * and every other crossing along either curve still rejects.
 */
/**
 * P23B.4 M-2a — conservative broad phase over Wall-pair swept extents.
 *
 * True means the pair MIGHT interact and must reach the narrow-phase predicate;
 * false means the tolerance-expanded sample boxes are disjoint, in which case no
 * segment pair the sweep could visit overlaps either (segment boxes nest inside
 * the Wall box expanded by the same tolerance), so the predicate would reject.
 * Pruning therefore only removes pairs that would have been rejected anyway:
 * the candidate set stays a SUPERSET of every pair the narrow phase rejects
 * (OR-9), and the predicate, verdict, reporting and first-wins order are
 * untouched. Degenerate (point) boxes are handled by the same overlap test —
 * never by a special case that could widen the prune.
 */
export function sampledWallExtentsOverlap(
	a: Pick<SampledTopologyWall, 'samples'>,
	b: Pick<SampledTopologyWall, 'samples'>,
	tolerance: number = CURVE_SELF_INTERSECTION_TOLERANCE
): boolean {
	let aMinX = Infinity;
	let aMinZ = Infinity;
	let aMaxX = -Infinity;
	let aMaxZ = -Infinity;
	for (const sample of a.samples) {
		const x = sample.point[0];
		const z = sample.point[1];
		if (x < aMinX) aMinX = x;
		if (z < aMinZ) aMinZ = z;
		if (x > aMaxX) aMaxX = x;
		if (z > aMaxZ) aMaxZ = z;
	}
	let bMinX = Infinity;
	let bMinZ = Infinity;
	let bMaxX = -Infinity;
	let bMaxZ = -Infinity;
	for (const sample of b.samples) {
		const x = sample.point[0];
		const z = sample.point[1];
		if (x < bMinX) bMinX = x;
		if (z < bMinZ) bMinZ = z;
		if (x > bMaxX) bMaxX = x;
		if (z > bMaxZ) bMaxZ = z;
	}
	return (
		aMinX - tolerance <= bMaxX + tolerance &&
		bMinX - tolerance <= aMaxX + tolerance &&
		aMinZ - tolerance <= bMaxZ + tolerance &&
		bMinZ - tolerance <= aMaxZ + tolerance
	);
}

export function sampledWallsCross(
	a: SampledTopologyWall,
	b: SampledTopologyWall,
	sharedJunctionId?: string
): boolean {
	if (sharedJunctionId === undefined) {
		return sampledPolylineIntersects(a.samples, b.samples, CURVE_SELF_INTERSECTION_TOLERANCE);
	}
	const reverseFirst = a.endJunctionId !== sharedJunctionId;
	const reverseSecond = b.startJunctionId !== sharedJunctionId;
	const first = reverseFirst ? [...a.samples].reverse() : a.samples;
	const second = reverseSecond ? [...b.samples].reverse() : b.samples;
	// `first` now ends at the shared Junction and `second` starts there; that
	// point is the only sample pair the predicate is allowed to ignore.
	const sharedPoint = first.at(-1)?.point;
	if (!sharedPoint) return false;
	return sampledPolylineIntersects(first, second, CURVE_SELF_INTERSECTION_TOLERANCE, sharedPoint);
}

/**
 * Classify the relationship of two segments. `sharedJunctionIds` carries the
 * Junction IDs already shared by the two authored walls (empty when the walls
 * do not meet at an explicit junction). Classification never merges distinct
 * junction IDs merely because coordinates are close.
 */
export function classifyWallIntersection(
	a: TopologySegment,
	b: TopologySegment,
	sharedJunctionIds: readonly string[] = []
): WallIntersection {
	// Rule 1: explicit shared junction wins before orientation math.
	if (sharedJunctionIds.length > 0) {
		const point = a.start[0] === b.start[0] && a.start[1] === b.start[1] ? a.start
			: a.start[0] === b.end[0] && a.start[1] === b.end[1] ? a.start
			: a.end[0] === b.start[0] && a.end[1] === b.start[1] ? a.end
			: a.end[0] === b.end[0] && a.end[1] === b.end[1] ? a.end
			: undefined;
		if (point !== undefined) {
			return {
				kind: 'shared-explicit-junction',
				junctionId: sharedJunctionIds[0]!,
				point: [point[0], point[1]]
			};
		}
	}

	const oa1 = orientXZ(a.start, a.end, b.start);
	const oa2 = orientXZ(a.start, a.end, b.end);
	const ob1 = orientXZ(b.start, b.end, a.start);
	const ob2 = orientXZ(b.start, b.end, a.end);

	const aCollinear = oa1 === 0 && oa2 === 0;
	const bCollinear = ob1 === 0 && ob2 === 0;

	if (aCollinear || bCollinear) {
		// At least one segment is fully collinear with the other's supporting
		// line — which already places all four endpoints on one common line
		// (the converse holds too, except for a vacuously-collinear degenerate
		// zero-length segment, which the interval logic classifies leniently).
		return classifyCollinear(a, b);
	}

	// Proper crossing: strictly opposite signs on both segments. A zero sign
	// is not a side — it marks a degenerate touch that rules 4–5 own below
	// (H3 §8 rule 3: "opposite signs", not "different signs").
	if (oa1 * oa2 < 0 && ob1 * ob2 < 0) {
		const point = lineIntersection(a, b);
		if (point === undefined || !withinEnvelope(a, point) || !withinEnvelope(b, point)) {
			return { kind: 'invalid', reason: 'intersection_numeric_unstable' };
		}
		return { kind: 'proper-crossing', point };
	}

	// Endpoint-on-interior (T): exactly one endpoint is robustly collinear
	// with the other segment and strictly inside its span (bounds check via
	// projection onto the host segment's dominant axis).
	const t = endpointOnInterior(a, b);
	if (t) {
		return {
			kind: 'endpoint-on-interior',
			endpointWallId: t.endpointWallId,
			interiorWallId: t.interiorWallId,
			point: t.point
		};
	}
	const tReverse = endpointOnInterior(b, a);
	if (tReverse) {
		// `endpointOnInterior(p, q)` already answers "endpoint of p on q": the
		// reverse call's roles are correct as returned (endpoint = b, host = a).
		return {
			kind: 'endpoint-on-interior',
			endpointWallId: tReverse.endpointWallId,
			interiorWallId: tReverse.interiorWallId,
			point: tReverse.point
		};
	}

	return { kind: 'none' };
}

/** Endpoint of `p` collinear with segment `q` and inside its bounds? */
function endpointOnInterior(
	p: TopologySegment,
	q: TopologySegment
): { endpointWallId: string; interiorWallId: string; point: LayoutVec2 } | undefined {
	const endpoints: Array<[LayoutVec2, 'start' | 'end']> = [
		[p.start, 'start'],
		[p.end, 'end']
	];
	for (const [point] of endpoints) {
		const sideStart = orientXZ(q.start, q.end, point);
		if (sideStart !== 0) continue;
		if (!strictlyWithinBounds(q, point)) continue;
		return { endpointWallId: p.id, interiorWallId: q.id, point: [point[0], point[1]] };
	}
	return undefined;
}

/**
 * Collinear classification via interval projection on the dominant axis
 * (H3 §8 rule 5). Reached only when the orientation bar has proven all four
 * endpoints share one supporting line, so the interval endpoints are
 * recovered by lerping along `a` — exact for axis-aligned walls and correct
 * for diagonals (review round 1 / B2: a perpendicular-coordinate equality
 * check misread diagonally collinear segments as numerically unstable,
 * because the perpendicular coordinate of a diagonal line varies along it).
 */
function classifyCollinear(a: TopologySegment, b: TopologySegment): WallIntersection {
	// Project onto the dominant axis of the shared direction.
	const dir: LayoutVec2 = [a.end[0] - a.start[0], a.end[1] - a.start[1]];
	const axis = Math.abs(dir[0]) >= Math.abs(dir[1]) ? 0 : 1;
	const aMin = Math.min(a.start[axis], a.end[axis]);
	const aMax = Math.max(a.start[axis], a.end[axis]);
	const bMin = Math.min(b.start[axis], b.end[axis]);
	const bMax = Math.max(b.start[axis], b.end[axis]);

	// Disjoint collinear spans.
	if (bMax < aMin || bMin > aMax) {
		return { kind: 'none' };
	}

	const overlapStart = Math.max(aMin, bMin);
	const overlapEnd = Math.min(aMax, bMax);

	// Recover an interval endpoint as the point on `a` at the given
	// dominant-axis coordinate. `span === 0` only for a degenerate
	// zero-length segment; return its start.
	const pointAt = (coordinate: number): LayoutVec2 => {
		const span = a.end[axis] - a.start[axis];
		if (span === 0) return [a.start[0], a.start[1]];
		const t = (coordinate - a.start[axis]) / span;
		return [
			a.start[0] + t * (a.end[0] - a.start[0]),
			a.start[1] + t * (a.end[1] - a.start[1])
		];
	};

	if (overlapStart === overlapEnd) {
		// Touching at exactly one point of the shared line.
		return { kind: 'collinear-endpoint-touch', point: pointAt(overlapStart) };
	}

	return {
		kind: 'collinear-overlap',
		start: pointAt(overlapStart),
		end: pointAt(overlapEnd)
	};
}

/** Ordinary double line intersection of the two supporting lines. */
function lineIntersection(a: TopologySegment, b: TopologySegment): LayoutVec2 | undefined {
	const d1x = a.end[0] - a.start[0];
	const d1y = a.end[1] - a.start[1];
	const d2x = b.end[0] - b.start[0];
	const d2y = b.end[1] - b.start[1];
	const denominator = d1x * d2y - d1y * d2x;
	if (denominator === 0) return undefined;
	const t =
		((b.start[0] - a.start[0]) * d2y - (b.start[1] - a.start[1]) * d2x) / denominator;
	if (!Number.isFinite(t)) return undefined;
	return [a.start[0] + t * d1x, a.start[1] + t * d1y];
}

/** Point lies within the segment's bounding envelope (inclusive). */
function withinEnvelope(segment: TopologySegment, point: LayoutVec2): boolean {
	return (
		point[0] >= Math.min(segment.start[0], segment.end[0]) &&
		point[0] <= Math.max(segment.start[0], segment.end[0]) &&
		point[1] >= Math.min(segment.start[1], segment.end[1]) &&
		point[1] <= Math.max(segment.start[1], segment.end[1])
	);
}

/** Point lies strictly inside the segment's span, excluding both endpoints. */
function strictlyWithinBounds(segment: TopologySegment, point: LayoutVec2): boolean {
	if (!withinEnvelope(segment, point)) return false;
	const atStart = point[0] === segment.start[0] && point[1] === segment.start[1];
	const atEnd = point[0] === segment.end[0] && point[1] === segment.end[1];
	return !atStart && !atEnd;
}
