/**
 * `layout-wall-curve-algebra.ts` — P23.11 exact cubic-chain primitives.
 *
 * The chain is `[startJunction, …knots, endJunction]` with exactly
 * `spans.length === knots.length + 1`, cubic `i` being
 * `(P[i], spans[i].handleOut, spans[i].handleIn, P[i + 1])`. Because the read
 * path consumes stored controls instead of re-deriving them, every operation
 * here is exact:
 *
 * - {@link subdivideWallCubicSpan} is de Casteljau — the two halves together
 *   are the original cubic, point for point;
 * - {@link resolveWallCurveSplit} is the ONE split-distance authority: it
 *   converts a physical arc distance into a span index, a parameter, a point,
 *   a resolved distance and the two fragment partitions. Junction placement,
 *   Opening rebasing, fragment metrics and diagnostics all consume that one
 *   result and never recompute a distance, a parameter or a range;
 * - {@link insertWallCurveKnot} is that same subdivision with the seam kept as
 *   an interior knot, so inserting a knot without moving it cannot change the
 *   sampled centerline;
 * - {@link deleteWallCurveKnot} merges the two adjacent cubics with no refit
 *   and never falls back to `line`.
 *
 * Two tolerances are explicit and deliberately separate:
 *
 * - {@link CURVE_ARC_LENGTH_TOLERANCE} bounds how faithfully a distance maps to
 *   a parameter (quadrature and bisection only — subdivision stays exact);
 * - {@link JUNCTION_COINCIDENCE_EPSILON} is the canonical **knot-identity**
 *   tolerance: a request resolving onto an existing knot promotes it instead of
 *   subdividing, and a request resolving onto an endpoint Junction rejects.
 *   A caller that already knows it hit a knot (a knot handle, a wall-split at a
 *   knot) uses {@link resolveWallCurveSplitAtKnot}, which needs no tolerance at
 *   all.
 */
import type { LayoutVec2 } from './layout-types';
import type { LayoutWallCubicSpan, LayoutWallCurveKnot } from './layout-wall-first-types';
import {
	CURVE_ARC_LENGTH_TOLERANCE,
	CURVE_ENDPOINT_EPSILON,
	cubicBezierArcLength,
	cubicBezierArcLengthAt,
	cubicBezierPoint,
	spansToCubics,
	type CubicBezierShape
} from './layout-geometry-curve';
import { JUNCTION_COINCIDENCE_EPSILON, coincidesAsJunction } from './layout-junction-identity';

/** Bisection cap for arc-length inversion (a guard, not a resolution). */
export const WALL_CURVE_SPLIT_MAX_BISECTIONS = 64;
/** Parameter width at which arc-length inversion stops refining. */
export const WALL_CURVE_SPLIT_PARAMETER_TOLERANCE = 1e-12;

/**
 * One stored cubic chain plus the endpoint positions its spans do not carry:
 * endpoint geometry is owned by the Junctions.
 */
export type WallCurveChain = {
	startPoint: LayoutVec2;
	endPoint: LayoutVec2;
	knots: readonly LayoutWallCurveKnot[];
	spans: readonly LayoutWallCubicSpan[];
};

/** Ordered chain vertices `start, …knots, end`. */
export function wallCurveChainPoints(chain: WallCurveChain): LayoutVec2[] {
	return [
		[chain.startPoint[0], chain.startPoint[1]] as LayoutVec2,
		...chain.knots.map((knot) => [knot.point[0], knot.point[1]] as LayoutVec2),
		[chain.endPoint[0], chain.endPoint[1]] as LayoutVec2
	];
}

/** The chain's cubics in canonical order (`spans.length` of them). */
export function wallCurveChainCubics(chain: WallCurveChain): CubicBezierShape[] {
	return spansToCubics(wallCurveChainPoints(chain), chain.spans);
}

/** Per-span arc lengths and their total — measured once, read by every consumer. */
function wallCurveArcLengths(chain: WallCurveChain): { lengths: number[]; total: number } {
	const lengths = wallCurveChainCubics(chain).map((cubic) => cubicBezierArcLength(cubic));
	return { lengths, total: lengths.reduce((sum, length) => sum + length, 0) };
}

/** True arc length of the whole chain, summed from its stored cubics. */
export function wallCurveChainLength(chain: WallCurveChain): number {
	return wallCurveArcLengths(chain).total;
}

/**
 * Exact arc distance of knot `index` from the chain start.
 *
 * Knot `k` is the second endpoint of span `k`, so its distance is the summed
 * arc length of spans `0..k` — no inversion, so a knot's own distance is exact
 * and needs no tolerance anywhere.
 */
export function wallCurveKnotDistanceAt(chain: WallCurveChain, index: number): number {
	return wallCurveArcLengths(chain)
		.lengths.slice(0, index + 1)
		.reduce((sum, length) => sum + length, 0);
}

/** Exact arc distance of the knot with this ID, or `undefined`. */
export function wallCurveKnotArcDistance(
	chain: WallCurveChain,
	knotId: string
): number | undefined {
	const index = chain.knots.findIndex((knot) => knot.id === knotId);
	return index < 0 ? undefined : wallCurveKnotDistanceAt(chain, index);
}

/**
 * de Casteljau subdivision of exactly one cubic span: `startPoint`/`endPoint`
 * are the span's own endpoints and `t` its local parameter. The two returned
 * spans walk `start → split` and `split → end` and together reproduce the
 * original cubic exactly.
 */
export function subdivideWallCubicSpan(
	span: LayoutWallCubicSpan,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	t: number
): { left: LayoutWallCubicSpan; right: LayoutWallCubicSpan; point: LayoutVec2 } {
	const amount = Math.min(1, Math.max(0, t));
	const first = lerp(startPoint, span.handleOut, amount);
	const middle = lerp(span.handleOut, span.handleIn, amount);
	const last = lerp(span.handleIn, endPoint, amount);
	const leftHandleIn = lerp(first, middle, amount);
	const rightHandleOut = lerp(middle, last, amount);
	const point = lerp(leftHandleIn, rightHandleOut, amount);
	return {
		left: { handleOut: first, handleIn: leftHandleIn },
		right: { handleOut: rightHandleOut, handleIn: last },
		point
	};
}

/** One fragment's interior knots, spans and resolved arc length. */
export type WallCurveFragment = {
	knots: LayoutWallCurveKnot[];
	spans: LayoutWallCubicSpan[];
	length: number;
};

/** The canonical resolved split: one span, one parameter, one point, one distance. */
export type ResolvedWallSplit = {
	/** Index of the cubic span containing the split. */
	spanIndex: number;
	/**
	 * Local parameter within that span. A promoted knot reports the boundary of
	 * the span that ends at it, i.e. `t === 1` on `spanIndex`.
	 */
	t: number;
	/** Point on the original curve at that parameter (or the promoted knot). */
	point: LayoutVec2;
	/** Resolved physical distance along the Wall from its canonical start. */
	distance: number;
	/** Set when the request resolved onto an existing interior knot (§2.7.2). */
	promotedKnotId?: string;
};

export type ResolvedWallSplitResult = ResolvedWallSplit & {
	totalLength: number;
	/** The partitions and metrics every consumer reads — the sole partition authority. */
	fragments: { a: WallCurveFragment; b: WallCurveFragment };
};

/** Why a split request cannot be resolved. */
export type WallSplitRejection =
	| 'degenerate_chain'
	| 'split_out_of_range'
	| 'split_at_endpoint';

export type WallSplitResolution =
	| { kind: 'resolved'; result: ResolvedWallSplitResult }
	| { kind: 'rejected'; code: WallSplitRejection; message: string };

function reject(code: WallSplitRejection, message: string): WallSplitResolution {
	return { kind: 'rejected', code, message };
}

/**
 * Partition the chain around one resolved split point.
 *
 * `knotIndex` selects the promoted-knot path (no subdivision, no near-zero
 * span); otherwise the split cuts span `spanIndex` at `t`.
 */
function partitionWallCurveChain(
	chain: WallCurveChain,
	totalLength: number,
	resolved: ResolvedWallSplit,
	knotIndex: number | undefined
): { a: WallCurveFragment; b: WallCurveFragment } {
	const { spanIndex, t, distance } = resolved;
	if (knotIndex !== undefined) {
		// The knot becomes Junction X: it leaves both interior knot arrays and
		// the existing spans are partitioned exactly around it.
		return {
			a: {
				knots: chain.knots.slice(0, knotIndex).map(cloneKnot),
				spans: chain.spans.slice(0, knotIndex + 1).map(cloneSpan),
				length: distance
			},
			b: {
				knots: chain.knots.slice(knotIndex + 1).map(cloneKnot),
				spans: chain.spans.slice(knotIndex + 1).map(cloneSpan),
				length: totalLength - distance
			}
		};
	}
	const points = wallCurveChainPoints(chain);
	const { left, right } = subdivideWallCubicSpan(
		chain.spans[spanIndex]!,
		points[spanIndex]!,
		points[spanIndex + 1]!,
		t
	);
	return {
		a: {
			knots: chain.knots.slice(0, spanIndex).map(cloneKnot),
			spans: [...chain.spans.slice(0, spanIndex).map(cloneSpan), left],
			length: distance
		},
		b: {
			knots: chain.knots.slice(spanIndex).map(cloneKnot),
			spans: [right, ...chain.spans.slice(spanIndex + 1).map(cloneSpan)],
			length: totalLength - distance
		}
	};
}

/**
 * Resolve a physical arc distance into the canonical split result.
 *
 * The containing span is bracketed from cumulative cubic arc lengths, then the
 * local parameter is refined by bisection against that span's own arc length.
 * `distance` is reported from the resolved parameter, so a consumer that reads
 * it always sees a value consistent with `point` and with `spanIndex`/`t` —
 * never an echo of the request.
 */
export function resolveWallCurveSplit(
	chain: WallCurveChain,
	distance: number
): WallSplitResolution {
	if (!wallCurveChainSatisfiesInvariant(chain) || chain.spans.length === 0) {
		return reject('degenerate_chain', 'Wall centerline has no cubic span to split.');
	}
	const cubics = wallCurveChainCubics(chain);
	const { lengths, total: totalLength } = wallCurveArcLengths(chain);
	if (!(totalLength > CURVE_ENDPOINT_EPSILON)) {
		return reject('degenerate_chain', 'Wall centerline has no effective length to split.');
	}
	if (!Number.isFinite(distance) || distance <= 0 || distance >= totalLength) {
		return reject(
			'split_out_of_range',
			`Split distance ${distance} is outside the open interval (0, ${totalLength}).`
		);
	}

	let cumulative = 0;
	let spanIndex = 0;
	while (spanIndex < lengths.length - 1 && cumulative + lengths[spanIndex]! < distance) {
		cumulative += lengths[spanIndex]!;
		spanIndex += 1;
	}
	const cubic = cubics[spanIndex]!;
	const spanLength = lengths[spanIndex]!;
	if (!(spanLength > CURVE_ENDPOINT_EPSILON)) {
		return reject('degenerate_chain', `Split span ${spanIndex} has no effective length.`);
	}
	const target = distance - cumulative;
	let low = 0;
	let high = 1;
	for (let iteration = 0; iteration < WALL_CURVE_SPLIT_MAX_BISECTIONS; iteration += 1) {
		const middle = (low + high) / 2;
		if (cubicBezierArcLengthAt(cubic, middle) < target) low = middle;
		else high = middle;
		if (high - low <= WALL_CURVE_SPLIT_PARAMETER_TOLERANCE) break;
	}
	const t = (low + high) / 2;
	const point = cubicBezierPoint(cubic, t);
	const resolvedDistance = cumulative + cubicBezierArcLengthAt(cubic, t);

	// Knot identity: a split landing on an existing knot promotes it rather than
	// subdividing; one landing on an endpoint Junction is not a split at all.
	const knotIndex = chain.knots.findIndex((knot) => coincidesAsJunction(knot.point, point));
	if (knotIndex >= 0) {
		const knot = chain.knots[knotIndex]!;
		const knotDistance = wallCurveKnotDistanceAt(chain, knotIndex);
		const resolved: ResolvedWallSplit = {
			spanIndex: knotIndex,
			t: 1,
			point: [knot.point[0], knot.point[1]] as LayoutVec2,
			distance: knotDistance,
			promotedKnotId: knot.id
		};
		return {
			kind: 'resolved',
			result: {
				...resolved,
				totalLength,
				fragments: partitionWallCurveChain(chain, totalLength, resolved, knotIndex)
			}
		};
	}
	if (
		coincidesAsJunction(point, chain.startPoint) ||
		coincidesAsJunction(point, chain.endPoint) ||
		!Number.isFinite(resolvedDistance)
	) {
		return reject(
			'split_at_endpoint',
			`Split distance ${distance} resolves onto an endpoint Junction.`
		);
	}

	const resolved: ResolvedWallSplit = { spanIndex, t, point, distance: resolvedDistance };
	return {
		kind: 'resolved',
		result: {
			...resolved,
			totalLength,
			fragments: partitionWallCurveChain(chain, totalLength, resolved, undefined)
		}
	};
}

/**
 * Resolve a split at an existing knot's exact arc distance: the same result
 * shape, with no tolerance and no inversion involved.
 */
export function resolveWallCurveSplitAtKnot(
	chain: WallCurveChain,
	knotId: string
): WallSplitResolution {
	const knotIndex = chain.knots.findIndex((knot) => knot.id === knotId);
	if (knotIndex < 0) {
		return reject('split_out_of_range', `Wall centerline has no knot '${knotId}'.`);
	}
	if (!wallCurveChainSatisfiesInvariant(chain) || chain.spans.length === 0) {
		return reject('degenerate_chain', 'Wall centerline has no cubic span to split.');
	}
	const knot = chain.knots[knotIndex]!;
	const { total: totalLength } = wallCurveArcLengths(chain);
	const resolved: ResolvedWallSplit = {
		distance: wallCurveKnotDistanceAt(chain, knotIndex),
		spanIndex: knotIndex,
		t: 1,
		point: [knot.point[0], knot.point[1]] as LayoutVec2,
		promotedKnotId: knot.id
	};
	return {
		kind: 'resolved',
		result: {
			...resolved,
			totalLength,
			fragments: partitionWallCurveChain(chain, totalLength, resolved, knotIndex)
		}
	};
}

/** Why an insertion or deletion could not be applied. */
export type WallCurveEditRejection = WallSplitRejection | 'knot_already_exists' | 'knot_not_found';

/**
 * Insert one bend point at a physical arc distance **without moving the curve**.
 *
 * The insertion is the resolved split with the seam kept as an interior knot,
 * so the two new cubics are the exact halves of the original span and every
 * other span is byte-identical: inserting a knot and leaving it alone cannot
 * change the sampled centerline.
 */
export function insertWallCurveKnot(
	chain: WallCurveChain,
	distance: number,
	knotId: string
):
	| { kind: 'inserted'; resolution: ResolvedWallSplitResult; knots: LayoutWallCurveKnot[]; spans: LayoutWallCubicSpan[]; knot: LayoutWallCurveKnot }
	| { kind: 'rejected'; code: WallCurveEditRejection; message: string } {
	const resolution = resolveWallCurveSplit(chain, distance);
	if (resolution.kind === 'rejected') return resolution;
	const {
		result: { fragments, point }
	} = resolution;
	if (resolution.result.promotedKnotId !== undefined) {
		return {
			kind: 'rejected',
			code: 'knot_already_exists',
			message: `A bend point already sits at the requested distance.`
		};
	}
	const knot: LayoutWallCurveKnot = { id: knotId, point: [point[0], point[1]] as LayoutVec2 };
	return {
		kind: 'inserted',
		resolution: resolution.result,
		knots: [...fragments.a.knots, knot, ...fragments.b.knots],
		spans: [...fragments.a.spans, ...fragments.b.spans],
		knot
	};
}

/**
 * Delete one bend point by merging its two adjacent cubics
 * (`(P[j], spans[j].handleOut, spans[j + 1].handleIn, P[j + 2])`).
 *
 * The merge is explicit — no refit and no re-derivation — and a chain is never
 * collapsed back to `line`, so a single surviving cubic still describes a
 * curve. A knot-less chain is therefore the natural result of deleting the
 * last bend point, not a straightening.
 */
export function deleteWallCurveKnot(
	chain: WallCurveChain,
	knotId: string
):
	| { kind: 'deleted'; knots: LayoutWallCurveKnot[]; spans: LayoutWallCubicSpan[] }
	| { kind: 'rejected'; code: WallCurveEditRejection; message: string } {
	const index = chain.knots.findIndex((knot) => knot.id === knotId);
	if (index < 0) {
		return {
			kind: 'rejected',
			code: 'knot_not_found',
			message: `Wall centerline has no knot '${knotId}'.`
		};
	}
	const before = chain.spans[index]!;
	const after = chain.spans[index + 1]!;
	const merged: LayoutWallCubicSpan = {
		handleOut: [before.handleOut[0], before.handleOut[1]] as LayoutVec2,
		handleIn: [after.handleIn[0], after.handleIn[1]] as LayoutVec2
	};
	return {
		kind: 'deleted',
		knots: [
			...chain.knots.slice(0, index).map(cloneKnot),
			...chain.knots.slice(index + 1).map(cloneKnot)
		],
		spans: [
			...chain.spans.slice(0, index).map(cloneSpan),
			merged,
			...chain.spans.slice(index + 2).map(cloneSpan)
		]
	};
}

/** Structural check used by tests and planners before persisting a chain. */
export function wallCurveChainSatisfiesInvariant(chain: {
	knots: readonly LayoutWallCurveKnot[];
	spans: readonly LayoutWallCubicSpan[];
}): boolean {
	return chain.knots.length + 1 === chain.spans.length;
}

function cloneKnot(knot: LayoutWallCurveKnot): LayoutWallCurveKnot {
	return { id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 };
}

function cloneSpan(span: LayoutWallCubicSpan): LayoutWallCubicSpan {
	return {
		handleOut: [span.handleOut[0], span.handleOut[1]] as LayoutVec2,
		handleIn: [span.handleIn[0], span.handleIn[1]] as LayoutVec2
	};
}

function lerp(a: LayoutVec2, b: LayoutVec2, amount: number): LayoutVec2 {
	return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}
