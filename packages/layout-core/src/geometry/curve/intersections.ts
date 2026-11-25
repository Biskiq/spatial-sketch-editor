import type { LayoutVec2 } from '../coordinates';
import type { CurveSample } from './contracts';
import { CURVE_ENDPOINT_EPSILON, CURVE_SELF_INTERSECTION_TOLERANCE } from './contracts';

/**
 * A sampled segment's tolerance-expanded axis-aligned bounding box. The
 * expansion is the predicate's own `tolerance`, which is what makes the broad
 * phase below conservative: every pair the exact predicate can accept has
 * overlapping expanded boxes (a proper crossing meets inside both boxes, and
 * the endpoint branches require per-axis proximity within `tolerance`).
 */
type SegmentBox = { minX: number; maxX: number; minY: number; maxY: number };


function segmentBoxes(points: readonly LayoutVec2[], tolerance: number): SegmentBox[] {
	const boxes: SegmentBox[] = [];
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1]!;
		const end = points[index]!;
		boxes.push({
			minX: Math.min(start[0], end[0]) - tolerance,
			maxX: Math.max(start[0], end[0]) + tolerance,
			minY: Math.min(start[1], end[1]) - tolerance,
			maxY: Math.max(start[1], end[1]) + tolerance
		});
	}
	return boxes;
}


/**
 * The one **candidate-pair sweep** behind both polyline predicates.
 *
 * The exact predicates are pairwise over sampled segments, so a long curve
 * (`~4k` samples for a deep bow) makes the naive double loop quadratic and
 * dominates a Bend gesture's crossing validation. This sweeps the segments in
 * ascending lower-X order with an active list, and calls `visit` only for pairs
 * whose tolerance-expanded boxes overlap in both axes. Box overlap is a
 * *superset* of the pairs the predicate can accept, so pruning can only remove
 * pairs that would have been rejected anyway: the answer — and therefore the
 * crossing classification, rejection and issue — is identical.
 *
 * `visit` receives an unordered pair, and stops the sweep by returning `true`.
 */
function sweepSegmentPairs(
	boxes: readonly SegmentBox[],
	visit: (first: number, second: number) => boolean
): boolean {
	const order = boxes.map((_box, index) => index);
	// Ascending lower X: `sort` is specified stable, so equal spans keep index
	// order and the candidate sequence stays deterministic between runs.
	order.sort((a, b) => boxes[a]!.minX - boxes[b]!.minX);
	const active: number[] = [];
	for (const index of order) {
		const box = boxes[index]!;
		let kept = 0;
		for (let read = 0; read < active.length; read += 1) {
			const candidate = active[read]!;
			if (boxes[candidate]!.maxX >= box.minX) active[kept++] = candidate;
		}
		active.length = kept;
		for (const candidate of active) {
			const other = boxes[candidate]!;
			if (other.minY > box.maxY || other.maxY < box.minY) continue;
			if (visit(candidate, index)) return true;
		}
		active.push(index);
	}
	return false;
}


export function sampledPolylineIntersects(
	first: readonly CurveSample[],
	second: readonly CurveSample[],
	tolerance = CURVE_SELF_INTERSECTION_TOLERANCE,
	ignoreSharedEndpoint?: LayoutVec2,
	/** A second legitimate join, for a closed boundary with exactly two curves. */
	ignoreOtherSharedEndpoint?: LayoutVec2
): boolean {
	const firstSegments = first.length - 1;
	const secondSegments = second.length - 1;
	if (firstSegments <= 0 || secondSegments <= 0) return false;
	// Aliased input is the one shape the sweep cannot express (it would pair a
	// segment with itself); no caller passes one, so it keeps the literal
	// every-pair loop rather than silently changing its answer.
	if (first === second) return aliasedPolylineIntersects(first, tolerance, ignoreSharedEndpoint);
	const firstPoints = first.map((sample) => sample.point);
	const secondPoints = second.map((sample) => sample.point);
	const boxes = [...segmentBoxes(firstPoints, tolerance), ...segmentBoxes(secondPoints, tolerance)];
	return sweepSegmentPairs(boxes, (left, right) => {
		const leftIsFirst = left < firstSegments;
		// The canonical loop pairs every first-polyline segment with every
		// second-polyline segment, and nothing else.
		if (leftIsFirst === right < firstSegments) return false;
		const firstIndex = leftIsFirst ? left : right;
		const secondIndex = (leftIsFirst ? right : left) - firstSegments;
		const firstStart = firstPoints[firstIndex]!;
		const firstEnd = firstPoints[firstIndex + 1]!;
		const secondStart = secondPoints[secondIndex]!;
		const secondEnd = secondPoints[secondIndex + 1]!;
		if (ignoreSharedEndpoint && ((pointsWithinTolerance(firstEnd, ignoreSharedEndpoint, tolerance) && pointsWithinTolerance(secondStart, ignoreSharedEndpoint, tolerance)) || (pointsWithinTolerance(firstStart, ignoreSharedEndpoint, tolerance) && pointsWithinTolerance(secondEnd, ignoreSharedEndpoint, tolerance)))) return false;
		if (ignoreOtherSharedEndpoint && ((pointsWithinTolerance(firstEnd, ignoreOtherSharedEndpoint, tolerance) && pointsWithinTolerance(secondStart, ignoreOtherSharedEndpoint, tolerance)) || (pointsWithinTolerance(firstStart, ignoreOtherSharedEndpoint, tolerance) && pointsWithinTolerance(secondEnd, ignoreOtherSharedEndpoint, tolerance)))) return false;
		return polylineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd, tolerance);
	});
}


/** The literal every-pair loop, kept only for aliased `sampledPolylineIntersects`. */
function aliasedPolylineIntersects(
	samples: readonly CurveSample[],
	tolerance: number,
	ignoreSharedEndpoint?: LayoutVec2
): boolean {
	for (let firstIndex = 1; firstIndex < samples.length; firstIndex += 1) {
		for (let secondIndex = 1; secondIndex < samples.length; secondIndex += 1) {
			const firstStart = samples[firstIndex - 1]!.point;
			const firstEnd = samples[firstIndex]!.point;
			const secondStart = samples[secondIndex - 1]!.point;
			const secondEnd = samples[secondIndex]!.point;
			if (ignoreSharedEndpoint && ((pointsWithinTolerance(firstEnd, ignoreSharedEndpoint, tolerance) && pointsWithinTolerance(secondStart, ignoreSharedEndpoint, tolerance)) || (pointsWithinTolerance(firstStart, ignoreSharedEndpoint, tolerance) && pointsWithinTolerance(secondEnd, ignoreSharedEndpoint, tolerance)))) continue;
			if (polylineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd, tolerance)) return true;
		}
	}
	return false;
}


export function sampledPolylineSelfIntersects(
	samples: readonly CurveSample[],
	tolerance = CURVE_SELF_INTERSECTION_TOLERANCE
): boolean {
	// Segments 0..n-2; a segment is never paired with its immediate neighbour
	// (they share an endpoint by construction) and the (first, last) pair is the
	// closed-loop return the canonical loop always skipped.
	const segmentCount = samples.length - 1;
	if (segmentCount < 3) return false;
	const points = samples.map((sample) => sample.point);
	const boxes = segmentBoxes(points, tolerance);
	return sweepSegmentPairs(boxes, (left, right) => {
		const low = Math.min(left, right);
		const high = Math.max(left, right);
		if (high - low < 2) return false;
		if (low === 0 && high === segmentCount - 1) return false;
		return polylineSegmentsIntersect(points[low]!, points[low + 1]!, points[high]!, points[high + 1]!, tolerance);
	});
}


function polylineSegmentsIntersect(a0: LayoutVec2, a1: LayoutVec2, b0: LayoutVec2, b1: LayoutVec2, distanceTolerance: number): boolean {
	const lenA = Math.max(distance(a0, a1), CURVE_ENDPOINT_EPSILON);
	const lenB = Math.max(distance(b0, b1), CURVE_ENDPOINT_EPSILON);
	const orientTolA = distanceTolerance * lenA;
	const orientTolB = distanceTolerance * lenB;
	const firstStart = orientation(a0, a1, b0);
	const firstEnd = orientation(a0, a1, b1);
	const secondStart = orientation(b0, b1, a0);
	const secondEnd = orientation(b0, b1, a1);
	const crosses =
		((firstStart > orientTolA && firstEnd < -orientTolA) || (firstStart < -orientTolA && firstEnd > orientTolA)) &&
		((secondStart > orientTolB && secondEnd < -orientTolB) || (secondStart < -orientTolB && secondEnd > orientTolB));
	if (crosses) return true;
	return (
		(Math.abs(firstStart) <= orientTolA && onSegmentWithTolerance(a0, a1, b0, distanceTolerance)) ||
		(Math.abs(firstEnd) <= orientTolA && onSegmentWithTolerance(a0, a1, b1, distanceTolerance)) ||
		(Math.abs(secondStart) <= orientTolB && onSegmentWithTolerance(b0, b1, a0, distanceTolerance)) ||
		(Math.abs(secondEnd) <= orientTolB && onSegmentWithTolerance(b0, b1, a1, distanceTolerance))
	);
}


function orientation(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
	return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}


function onSegmentWithTolerance(a: LayoutVec2, b: LayoutVec2, point: LayoutVec2, tolerance: number): boolean {
	return point[0] >= Math.min(a[0], b[0]) - tolerance && point[0] <= Math.max(a[0], b[0]) + tolerance && point[1] >= Math.min(a[1], b[1]) - tolerance && point[1] <= Math.max(a[1], b[1]) + tolerance;
}


function pointsWithinTolerance(a: LayoutVec2, b: LayoutVec2, tolerance: number): boolean {
	return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}


export function clonePoint(point: LayoutVec2): LayoutVec2 {
	return [point[0], point[1]];
}


export function normalize(vector: LayoutVec2, fallback: LayoutVec2): LayoutVec2 {
	const magnitude = length(vector);
	return magnitude > CURVE_ENDPOINT_EPSILON ? [vector[0] / magnitude, vector[1] / magnitude] : [...fallback];
}


export function lerp(a: LayoutVec2, b: LayoutVec2, amount: number): LayoutVec2 {
	return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}


export function subtract(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] - b[0], a[1] - b[1]];
}


export function add(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] + b[0], a[1] + b[1]];
}


export function scale(vector: LayoutVec2, amount: number): LayoutVec2 {
	return [vector[0] * amount, vector[1] * amount];
}


export function addScaled(point: LayoutVec2, direction: LayoutVec2, amount: number): LayoutVec2 {
	return [point[0] + direction[0] * amount, point[1] + direction[1] * amount];
}


export function divide(vector: LayoutVec2, divisor: number): LayoutVec2 {
	if (divisor === 0) return [0, 0];
	return [vector[0] / divisor, vector[1] / divisor];
}


export function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}


export function length(vector: LayoutVec2): number {
	return Math.hypot(vector[0], vector[1]);
}


export function distanceToLine(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const span = distance(start, end);
	if (span <= CURVE_ENDPOINT_EPSILON) return distance(point, start);
	return Math.abs((end[0] - start[0]) * (start[1] - point[1]) - (start[0] - point[0]) * (end[1] - start[1])) / span;
}


export function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
