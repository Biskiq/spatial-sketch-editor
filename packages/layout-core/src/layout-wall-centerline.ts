/**
 * `layout-wall-centerline.ts` — P23.11 canonical Wall-centerline helpers.
 *
 * One seam between the canonical Wall representation and the curve kernel:
 * every consumer that needs Wall centerline geometry (compiler, topology,
 * Opening sets, planners) reads it through this module or the sampled output
 * of {@link wallCenterlineSegment}. Curve evaluation is never duplicated.
 *
 * P23.11 stores the curve as an explicit **cubic chain**: bend points plus one
 * control pair per cubic span. The read path never re-derives a control, so a
 * split is an exact cubical subdivision and a rigid move is an exact
 * translation. `deriveChainSpans` (write path) is the only place the smoothness
 * rule runs.
 *
 * Deep-clone helpers exist because candidate planners must never share knot
 * arrays, span arrays or points with the baseline document.
 */
import type { LayoutVec2 } from './layout-types';
import type {
	LayoutWall,
	LayoutWallCenterline,
	LayoutWallCubicSpan,
	LayoutWallCurveKnot
} from './layout-wall-first-types';
import {
	projectPointToSampledSegment,
	sampleSegment,
	spansToCubics,
	type CubicBezierShape,
	type SampledSegment
} from './layout-geometry-curve';
import { coincidesAsJunction, JUNCTION_COINCIDENCE_EPSILON } from './layout-junction-identity';

/** Deep-copy one bend point: same stable ID, an independent point array. */
export function cloneWallCurveKnot(knot: LayoutWallCurveKnot): LayoutWallCurveKnot {
	return { id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 };
}

/** Deep-copy one cubic span: both controls become independent arrays. */
export function cloneWallCubicSpan(span: LayoutWallCubicSpan): LayoutWallCubicSpan {
	return {
		handleOut: [span.handleOut[0], span.handleOut[1]] as LayoutVec2,
		handleIn: [span.handleIn[0], span.handleIn[1]] as LayoutVec2
	};
}

/** Deep-copy one canonical centerline (knots and spans cloned point-wise). */
export function cloneWallCenterline(centerline: LayoutWallCenterline): LayoutWallCenterline {
	if (centerline.kind === 'line') return { kind: 'line' };
	return {
		kind: 'cubic-chain',
		knots: centerline.knots.map(cloneWallCurveKnot),
		spans: centerline.spans.map(cloneWallCubicSpan)
	};
}

/**
 * Build one canonical cubic chain from already-resolved knots and spans.
 * Deep-copies its input so a candidate can never alias the baseline. The
 * `spans.length === knots.length + 1` invariant is the caller's to uphold —
 * every construction path derives spans from the same point list.
 */
export function wallCubicChain(
	knots: readonly LayoutWallCurveKnot[],
	spans: readonly LayoutWallCubicSpan[]
): LayoutWallCenterline {
	return {
		kind: 'cubic-chain',
		knots: knots.map(cloneWallCurveKnot),
		spans: spans.map(cloneWallCubicSpan)
	};
}

/**
 * Deep-copy one canonical centerline with every bend point and every span
 * control translated by `delta` (document X/Z, meters).
 *
 * A rigid copy of a Wall must move its bend points with its endpoint Junctions —
 * a knot left at the source position no longer describes the same curve and can
 * swing the chain across neighbouring Walls. Moving a Newtonian control point
 * without its knot would change the shape, so the two move together. Flat
 * `line` centerlines carry no absolute data.
 */
export function translateWallCenterline(
	centerline: LayoutWallCenterline,
	delta: LayoutVec2
): LayoutWallCenterline {
	if (centerline.kind === 'line') return { kind: 'line' };
	const shift = (point: LayoutVec2): LayoutVec2 => [
		point[0] + delta[0],
		point[1] + delta[1]
	];
	return {
		kind: 'cubic-chain',
		knots: centerline.knots.map((knot) => ({ id: knot.id, point: shift(knot.point) })),
		spans: centerline.spans.map((span) => ({
			handleOut: shift(span.handleOut),
			handleIn: shift(span.handleIn)
		}))
	};
}

/**
 * Deterministic bend-point ID: `{wallId}:knot:{n}` for the first free `n`.
 *
 * Stable across a split because the fragments derive their IDs from their own
 * canonical Wall ID, and never derived from time, randomness or array order.
 */
export function nextWallCurveKnotId(
	wallId: string,
	existing: readonly LayoutWallCurveKnot[]
): string {
	const used = new Set(existing.map((knot) => knot.id));
	let index = existing.length + 1;
	while (used.has(`${wallId}:knot:${index}`)) index += 1;
	return `${wallId}:knot:${index}`;
}

/**
 * Which way a consumer walks a Wall: `forward` follows
 * `startJunctionId → endJunctionId`, `reverse` walks it back.
 *
 * Every adapter entry point takes the Wall's endpoints in **canonical** order
 * (`startJunctionId` point, then `endJunctionId` point) whatever the traversal;
 * this flag alone selects the walk direction, so the two can never disagree.
 */
export type WallCenterlineTraversal = 'forward' | 'reverse';

/** The traversal-ordered endpoints of a Wall walk. */
function traversalEnds(
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): [LayoutVec2, LayoutVec2] {
	return traversal === 'reverse'
		? [[...endPoint] as LayoutVec2, [...startPoint] as LayoutVec2]
		: [[...startPoint] as LayoutVec2, [...endPoint] as LayoutVec2];
}

/** The canonical Wall centerline mapped onto the curve kernel's input shapes. */
export type WallCenterlineSegment =
	| { id: string; kind: 'line'; start: LayoutVec2; end: LayoutVec2 }
	| { id: string; kind: 'cubic-chain'; cubics: CubicBezierShape[] };

/** Ascending chain vertices `start … end`, in traversal order. */
function traversalPoints(
	centerline: LayoutWallCenterline,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): LayoutVec2[] {
	if (centerline.kind === 'line') return traversalEnds(startPoint, endPoint, traversal);
	// Read path borrows knot order from the single orientation owner below and
	// copies only the point arrays it returns — no span work, no knot-object
	// clones. (`spansToCubics` clones everything it consumes, so the borrowed
	// order can never alias the baseline.)
	const knots = orientedKnotRefs(centerline, traversal);
	const ends = traversalEnds(startPoint, endPoint, traversal);
	return [ends[0], ...knots.map((knot) => [...knot.point] as LayoutVec2), ends[1]];
}

/**
 * Single owner of reverse-orientation handle semantics: the control leaving a
 * span's first point in reverse is the stored control arriving at it, and vice
 * versa. Returns a read-only view borrowing the stored coordinate arrays (no
 * deep copy) — callers that persist a chain must clone (see
 * {@link orientedWallChainKnotsAndSpans} / `wallCubicChain`). Every reverse
 * consumer goes through {@link orientedSpanViews} below.
 */
function mirrorSpanView(span: LayoutWallCubicSpan): LayoutWallCubicSpan {
	return { handleOut: span.handleIn, handleIn: span.handleOut };
}

/**
 * Stored knots in traversal order, borrowed (reverse = reversed reference
 * order). Single owner of knot-order logic: {@link traversalPoints} reads
 * through it, {@link orientedWallChainKnotsAndSpans} clones through it.
 */
function orientedKnotRefs(
	centerline: LayoutWallCenterline,
	traversal: WallCenterlineTraversal
): readonly LayoutWallCurveKnot[] {
	if (centerline.kind === 'line') return [];
	return traversal === 'reverse' ? [...centerline.knots].reverse() : centerline.knots;
}

/**
 * Stored spans in traversal order as read-only views (reverse = mirrored in
 * reversed span order, borrowing the stored coordinate arrays). Single owner
 * of span-order logic: {@link wallCenterlineCubics} reads through it,
 * {@link orientedWallChainKnotsAndSpans} clones through it.
 */
function orientedSpanViews(
	centerline: LayoutWallCenterline,
	traversal: WallCenterlineTraversal
): readonly LayoutWallCubicSpan[] {
	if (centerline.kind === 'line') return [];
	if (traversal !== 'reverse') return centerline.spans;
	return centerline.spans.map(mirrorSpanView).reverse();
}

/**
 * Stored knots and spans in traversal order (P23 Junction-dissolve join seam).
 *
 * Owned-clone wrapper over the traversal views above for planners that
 * persist a joined chain (dissolve clones again through `wallCubicChain`, so
 * the candidate can never alias the baseline). Forward returns deep clones in
 * stored order; reverse returns the knots in reversed order with every span
 * mirrored (`handleOut ↔ handleIn`) in reversed span order — the same
 * transform {@link wallCenterlineCubics} applies to cubics. A `line`
 * centerline carries no chain data and yields empty arrays. Read paths
 * (`traversalPoints`, `wallCenterlineCubics`) consume the views directly and
 * never pay this cloning cost.
 */
export function orientedWallChainKnotsAndSpans(
	centerline: LayoutWallCenterline,
	traversal: WallCenterlineTraversal
): { knots: LayoutWallCurveKnot[]; spans: LayoutWallCubicSpan[] } {
	if (centerline.kind === 'line') return { knots: [], spans: [] };
	return {
		knots: orientedKnotRefs(centerline, traversal).map(cloneWallCurveKnot),
		spans: orientedSpanViews(centerline, traversal).map(cloneWallCubicSpan)
	};
}

/**
 * The chain's cubic list in traversal order. A reverse walk mirrors each cubic
 * (`start ↔ end`, `handleOut ↔ handleIn`) instead of only swapping endpoints —
 * swapping endpoints while keeping span order would trace a different curve.
 *
 * `startPoint`/`endPoint` are the canonical endpoints; `traversal` decides the
 * direction of the returned list (`reverse` starts at `endPoint`).
 */
export function wallCenterlineCubics(
	centerline: LayoutWallCenterline,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): CubicBezierShape[] {
	if (centerline.kind === 'line') return [];
	// Stored spans are authored `startJunction → endJunction`, so the forward
	// chain is always built from the canonical endpoints. `traversal` alone
	// selects the walk direction — feeding it swapped endpoints would pair each
	// span with the wrong knot order.
	// Forward cubic `i` is `points[i] → points[i + 1]` paired with `spans[i]`.
	// Each direction builds only its own cubics through the single orientation
	// owner (views borrow; `spansToCubics` clones everything it consumes).
	if (traversal === 'reverse') {
		return spansToCubics(
			traversalPoints(centerline, startPoint, endPoint, 'reverse'),
			orientedSpanViews(centerline, 'reverse')
		);
	}
	return spansToCubics(
		traversalPoints(centerline, startPoint, endPoint, 'forward'),
		orientedSpanViews(centerline, 'forward')
	);
}

/**
 * Chain vertices in traversal order (line: just the endpoints). `reverse`
 * starts at `endPoint`, which is the canonical `endJunctionId` position.
 */
export function wallCenterlinePoints(
	centerline: LayoutWallCenterline,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): LayoutVec2[] {
	return traversalPoints(centerline, startPoint, endPoint, traversal);
}

/**
 * Map the canonical Wall representation onto the existing curve kernel.
 *
 * Returns the segment shape `sampleSegment()` consumes: a `line` between the
 * resolved endpoint Junctions, or a `cubic-chain` carrying the Wall's explicit
 * cubics. This is the ONE adapter — no compiler/topology/Opening code builds
 * Wall curve segments by hand.
 *
 * `startPoint`/`endPoint` are the Wall's **canonical** endpoint positions
 * (`startJunctionId`, `endJunctionId`) whatever the traversal, and the returned
 * segment always walks from the traversal start to the traversal end.
 * `traversal` is required rather than defaulted: a reverse walk that forgot it
 * would silently trace a different curve, which is exactly the class of bug
 * this seam exists to prevent.
 */
export function wallCenterlineSegment(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): WallCenterlineSegment {
	if (wall.centerline.kind === 'line') {
		const [from, to] = traversalEnds(startPoint, endPoint, traversal);
		return { id: wall.id, kind: 'line', start: from, end: to };
	}
	return {
		id: wall.id,
		kind: 'cubic-chain',
		cubics: wallCenterlineCubics(wall.centerline, startPoint, endPoint, traversal)
	};
}

/**
 * Sample a Wall's canonical centerline through the single curve evaluator.
 * `undefined` when the endpoints are unresolved or sampling rejects.
 */
export function wallCenterlineSamples(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	traversal: WallCenterlineTraversal
): SampledSegment | undefined {
	try {
		return sampleSegment(wallCenterlineSegment(wall, startPoint, endPoint, traversal));
	} catch {
		return undefined;
	}
}

/**
 * Whether `point` sits on the Wall's canonical centerline — a strict-interior
 * station of its span, or one of its two endpoint stations.
 *
 * This is the one predicate behind "this point belongs to that Wall", used by
 * the wall-span declaration on both sides of the seam (the editor's click rule
 * and the chain planner's declared-host validation). It reuses the canonical
 * geometry authority rather than inventing one: the chord projection for a
 * `line` centerline, the sampled projection for a `cubic-chain`, and
 * `JUNCTION_COINCIDENCE_EPSILON` — the single identity tolerance — for the
 * comparison. No additional distance threshold is introduced.
 */
export function wallCenterlineCarriesPoint(
	wall: Pick<LayoutWall, 'id' | 'centerline'>,
	startPoint: LayoutVec2,
	endPoint: LayoutVec2,
	point: LayoutVec2
): boolean {
	if (coincidesAsJunction(point, startPoint) || coincidesAsJunction(point, endPoint)) return true;
	if (wall.centerline.kind === 'line') {
		const dx = endPoint[0] - startPoint[0];
		const dz = endPoint[1] - startPoint[1];
		const squared = dx * dx + dz * dz;
		if (!(squared > 0)) return false;
		const t = ((point[0] - startPoint[0]) * dx + (point[1] - startPoint[1]) * dz) / squared;
		if (!(t > 0 && t < 1)) return false;
		return coincidesAsJunction([startPoint[0] + dx * t, startPoint[1] + dz * t], point);
	}
	const sampled = wallCenterlineSamples(wall, startPoint, endPoint, 'forward');
	if (!sampled) return false;
	return projectPointToSampledSegment(point, sampled).distanceToPath <= JUNCTION_COINCIDENCE_EPSILON;
}
