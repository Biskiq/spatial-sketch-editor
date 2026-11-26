import type { LayoutVec2 } from '../coordinates';
import type { DraftSegment, LayoutInteriorAnchor } from '../path';
import { coincidesAsJunction } from '../../wall/junction-identity';
import type {
	AutoBezierSegment,
	CubicBezierShape,
	CubicSpanControls,
	CurvedSampleableSegment,
	LegacyBezierSegment,
	SampleableSegment,
} from './contracts';
import {
	CURVE_ARC_LENGTH_MAX_DEPTH,
	CURVE_ARC_LENGTH_TOLERANCE,
	CURVE_ENDPOINT_EPSILON,
	LAYOUT_AUTO_BEZIER_ALPHA,
	LayoutGeometrySamplingError,
} from './contracts';
import {
	add,
	addScaled,
	clamp01,
	clonePoint,
	distance,
	distanceToLine,
	divide,
	length,
	lerp,
	normalize,
	scale,
	subtract,
} from './intersections';
import { curvedCubics, segmentTangentAt, segmentVertexPoints } from './samples';

export function autoBezierAnchorPoints(segment: AutoBezierSegment): LayoutVec2[] {
	return [segment.start, ...segment.interiorAnchors.map((anchor) => anchor.point), segment.end];
}

/**
 * The one canonical smoothness rule, on the **write** path only.
 *
 * Derives one control pair per cubic span from the ordered point sequence:
 * endpoints get a one-sided tangent, interior points blend both neighbours
 * centripetally (`LAYOUT_AUTO_BEZIER_ALPHA`). {@link spansToCubics} turns the
 * result back into cubic geometry.
 *
 * The read path never calls this. A canonical Wall persists the derived spans,
 * so evaluation, subdivision and translation all consume stored controls
 * exactly — that is what makes an exact split possible. Callers here are the
 * planners that author or move a bend point.
 */
export function deriveChainSpans(points: readonly LayoutVec2[]): CubicSpanControls[] {
	if (points.length === 0) return [];
	if (points.length === 1) {
		const point = clonePoint(points[0]!);
		return [{ handleOut: clonePoint(point), handleIn: clonePoint(point) }];
	}
	if (points.length === 2 && !coincidesAsJunction(points[0]!, points[1]!)) {
		const start = clonePoint(points[0]!);
		const end = clonePoint(points[1]!);
		return [{ handleOut: lerp(start, end, 1 / 3), handleIn: lerp(start, end, 2 / 3) }];
	}

	const tangents = points.map((_point, index) => createAutomaticTangent(points, index));
	const spans: CubicSpanControls[] = [];
	for (let index = 0; index < points.length - 1; index += 1) {
		spans.push(
			spanControlsFromTangents(
				points[index]!,
				points[index + 1]!,
				tangents[index]!,
				tangents[index + 1]!,
			),
		);
	}
	return spans;
}

/**
 * Turn one interval's two endpoint tangents into the stored control pair — the
 * single place the canonical smoothness rule becomes a cubic span. Both the
 * whole-chain write path and the single-span local reshape read it, so a local
 * move cannot drift from a full re-derivation.
 */
function spanControlsFromTangents(
	start: LayoutVec2,
	end: LayoutVec2,
	startTangent: LayoutVec2,
	endTangent: LayoutVec2,
): CubicSpanControls {
	const interval = centripetalInterval(start, end);
	if (interval === 0) return { handleOut: clonePoint(start), handleIn: clonePoint(end) };
	return {
		handleOut: addScaled(start, startTangent, interval / 3),
		handleIn: addScaled(end, endTangent, -interval / 3),
	};
}

/**
 * The canonical smoothness rule for exactly one span: the control pair
 * span `index` would receive on the whole-chain write path.
 *
 * Exported so a local bend-point move can reshape only the spans touching the
 * moved knot without re-deriving the rest of the chain. A persisted chain's
 * untouched spans may come from an exact de Casteljau subdivision or an
 * identity-preserving knot insertion, whose controls are **not** what the
 * smoothness rule would produce from their remaining points — re-deriving them
 * would silently refit geometry the author never touched.
 */
export function deriveCubicSpanControls(
	points: readonly LayoutVec2[],
	index: number,
): CubicSpanControls {
	return spanControlsFromTangents(
		points[index]!,
		points[index + 1]!,
		createAutomaticTangent(points, index),
		createAutomaticTangent(points, index + 1),
	);
}

/**
 * Pair each span with the points it spans: cubic `i` runs
 * `points[i] → points[i + 1]`, so `spans.length` is `points.length - 1`.
 */
export function spansToCubics(
	points: readonly LayoutVec2[],
	spans: readonly CubicSpanControls[],
): CubicBezierShape[] {
	return spans.map((span, index) => ({
		start: clonePoint(points[index]!),
		handleOut: clonePoint(span.handleOut),
		handleIn: clonePoint(span.handleIn),
		end: clonePoint(points[index + 1]!),
	}));
}

export function compileAutoBezierAnchors(points: readonly LayoutVec2[]): CubicBezierShape[] {
	return spansToCubics(points, deriveChainSpans(points));
}

export function legacyBezierToAutoBezier(segment: LegacyBezierSegment): AutoBezierSegment {
	const mid = evaluateCubicBezierPoint(
		{
			start: segment.start,
			handleOut: segment.handleOut,
			handleIn: segment.handleIn,
			end: segment.end,
		},
		0.5,
	);
	return {
		id: segment.id,
		kind: 'auto-bezier',
		start: clonePoint(segment.start),
		end: clonePoint(segment.end),
		interiorAnchors: [{ id: nextInteriorAnchorId(segment.id, []), point: mid }],
	};
}

/**
 * Deterministic interior-anchor ID: `{segmentId}:anchor:{n}` for the first free
 * `n`.
 *
 * Deliberately NOT capture-derived, and unreachable: its
 * only call site is `legacyBezierToAutoBezier`, which has no caller anywhere in
 * `packages/` or `apps/` (it is not on any adapter path). No accepted intent
 * allocates an interior anchor, so nothing can replay one. A curve-authoring
 * slice that makes legacy auto-bezier documents editable must capture this id
 * first, for the same occupancy-re-mint reason as `nextWallCurveKnotId`.
 */
export function nextInteriorAnchorId(
	segmentId: string,
	existing: readonly LayoutInteriorAnchor[],
): string {
	const used = new Set(existing.map((anchor) => anchor.id));
	let index = existing.length + 1;
	while (used.has(`${segmentId}:anchor:${index}`)) index += 1;
	return `${segmentId}:anchor:${index}`;
}

export function cubicBezierPoint(segment: CubicBezierShape, t: number): LayoutVec2 {
	const u = 1 - clamp01(t);
	const tt = clamp01(t);
	if (Math.abs(segment.start[0]) > 1e6 || Math.abs(segment.start[1]) > 1e6) {
		const ox = segment.start[0];
		const oz = segment.start[1];
		const d1x = segment.handleOut[0] - ox;
		const d1z = segment.handleOut[1] - oz;
		const d2x = segment.handleIn[0] - ox;
		const d2z = segment.handleIn[1] - oz;
		const d3x = segment.end[0] - ox;
		const d3z = segment.end[1] - oz;
		const w1 = 3 * u * u * tt;
		const w2 = 3 * u * tt * tt;
		const w3 = tt * tt * tt;
		return [ox + (w1 * d1x + w2 * d2x + w3 * d3x), oz + (w1 * d1z + w2 * d2z + w3 * d3z)];
	}
	return [
		u * u * u * segment.start[0] +
			3 * u * u * tt * segment.handleOut[0] +
			3 * u * tt * tt * segment.handleIn[0] +
			tt * tt * tt * segment.end[0],
		u * u * u * segment.start[1] +
			3 * u * u * tt * segment.handleOut[1] +
			3 * u * tt * tt * segment.handleIn[1] +
			tt * tt * tt * segment.end[1],
	];
}

/** 16-point Gauss-Legendre abscissae on [-1, 1]. */
const GAUSS_LEGENDRE_ABSCISSAE = [
	-0.09501250983763744, 0.09501250983763744, -0.2816035507792589, 0.2816035507792589,
	-0.4580167776572274, 0.4580167776572274, -0.6178762444026438, 0.6178762444026438,
	-0.755404408355003, 0.755404408355003, -0.8656312023878318, 0.8656312023878318,
	-0.9445750230732326, 0.9445750230732326, -0.9894009349916499, 0.9894009349916499,
];

/** 16-point Gauss-Legendre weights, paired with the abscissae above. */
const GAUSS_LEGENDRE_WEIGHTS = [
	0.1894506104550685, 0.1894506104550685, 0.1826034150449236, 0.1826034150449236,
	0.16915651939500254, 0.16915651939500254, 0.14959598881657673, 0.14959598881657673,
	0.12462897125553387, 0.12462897125553387, 0.09515851168249278, 0.09515851168249278,
	0.06225352393864789, 0.06225352393864789, 0.027152459411754096, 0.027152459411754096,
];

/** Cubic speed (|dP/dt|) — the integrand of arc length. */
function cubicBezierSpeed(segment: CubicBezierShape, t: number): number {
	const derivative = cubicBezierDerivative(segment, t);
	return Math.hypot(derivative[0], derivative[1]);
}

/** One 16-point Gauss-Legendre panel of the cubic's speed over `[t0, t1]`. */
function gaussSpeedPanel(segment: CubicBezierShape, t0: number, t1: number): number {
	const half = (t1 - t0) / 2;
	const middle = (t0 + t1) / 2;
	let sum = 0;
	for (let index = 0; index < GAUSS_LEGENDRE_ABSCISSAE.length; index += 1) {
		sum +=
			GAUSS_LEGENDRE_WEIGHTS[index]! *
			cubicBezierSpeed(segment, middle + half * GAUSS_LEGENDRE_ABSCISSAE[index]!);
	}
	return sum * half;
}

function adaptiveArcLength(
	segment: CubicBezierShape,
	t0: number,
	t1: number,
	whole: number,
	tolerance: number,
	depth: number,
): number {
	const middle = (t0 + t1) / 2;
	const left = gaussSpeedPanel(segment, t0, middle);
	const right = gaussSpeedPanel(segment, middle, t1);
	const refined = left + right;
	if (depth >= CURVE_ARC_LENGTH_MAX_DEPTH || Math.abs(refined - whole) <= tolerance) return refined;
	return (
		adaptiveArcLength(segment, t0, middle, left, tolerance / 2, depth + 1) +
		adaptiveArcLength(segment, middle, t1, right, tolerance / 2, depth + 1)
	);
}

/**
 * True arc length of one cubic between two parameters. The canonical Wall
 * chain stores explicit cubics, so chain length, arc-length inversion and
 * fragment metrics all measure real geometry here rather than a chord or a
 * flattened polyline.
 */
export function cubicBezierArcLengthBetween(
	segment: CubicBezierShape,
	t0 = 0,
	t1 = 1,
	tolerance = CURVE_ARC_LENGTH_TOLERANCE,
): number {
	const from = Math.min(t0, t1);
	const to = Math.max(t0, t1);
	if (!(to > from)) return 0;
	const whole = gaussSpeedPanel(segment, from, to);
	if (!Number.isFinite(whole)) return 0;
	return adaptiveArcLength(segment, from, to, whole, tolerance, 0);
}

/** Arc length of one cubic from its start (parameter 0) to `t`. */
export function cubicBezierArcLengthAt(
	segment: CubicBezierShape,
	t: number,
	tolerance = CURVE_ARC_LENGTH_TOLERANCE,
): number {
	return cubicBezierArcLengthBetween(segment, 0, clamp01(t), tolerance);
}

/** Total arc length of one cubic (parameters 0 → 1). */
export function cubicBezierArcLength(
	segment: CubicBezierShape,
	tolerance = CURVE_ARC_LENGTH_TOLERANCE,
): number {
	return cubicBezierArcLengthBetween(segment, 0, 1, tolerance);
}

export function cubicBezierDerivative(segment: CubicBezierShape, t: number): LayoutVec2 {
	const u = 1 - clamp01(t);
	const tt = clamp01(t);
	return [
		3 * u * u * (segment.handleOut[0] - segment.start[0]) +
			6 * u * tt * (segment.handleIn[0] - segment.handleOut[0]) +
			3 * tt * tt * (segment.end[0] - segment.handleIn[0]),
		3 * u * u * (segment.handleOut[1] - segment.start[1]) +
			6 * u * tt * (segment.handleIn[1] - segment.handleOut[1]) +
			3 * tt * tt * (segment.end[1] - segment.handleIn[1]),
	];
}

export function autoBezierPointAt(segment: CurvedSampleableSegment, t: number): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubic(segment, t);
	return cubicBezierPoint(cubic, localT);
}

export function autoBezierDerivativeAt(segment: CurvedSampleableSegment, t: number): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubic(segment, t);
	return cubicBezierDerivative(cubic, localT);
}

function resolveAutoBezierCubic(
	segment: CurvedSampleableSegment,
	t: number,
): { cubic: CubicBezierShape; localT: number } {
	const cubics = curvedCubics(segment);
	if (cubics.length === 0) {
		const vertices = segmentVertexPoints(segment);
		const start = vertices[0] ?? ([0, 0] as LayoutVec2);
		const end = vertices.at(-1) ?? start;
		return {
			cubic: {
				start: [...start] as LayoutVec2,
				handleOut: [...start] as LayoutVec2,
				handleIn: [...end] as LayoutVec2,
				end: [...end] as LayoutVec2,
			},
			localT: clamp01(t),
		};
	}
	return resolveAutoBezierCubicFromCubics(cubics, t);
}

/**
 * Same resolver as {@link resolveAutoBezierCubic} against an already-compiled
 * cubic list — G3 quick-win #6: tangent evaluation no longer recompiles the
 * spline per sample (O(N·A) → O(A + N)). Callers pass a non-empty list
 * (compile output of a valid segment always is).
 */
function resolveAutoBezierCubicFromCubics(
	cubics: readonly CubicBezierShape[],
	t: number,
): { cubic: CubicBezierShape; localT: number } {
	if (cubics.length === 1) return { cubic: cubics[0]!, localT: clamp01(t) };
	const clamped = clamp01(t);
	const scaled = clamped * cubics.length;
	const index = Math.min(cubics.length - 1, Math.floor(scaled));
	const localT = index === cubics.length - 1 ? scaled - index : Math.min(1, scaled - index);
	return { cubic: cubics[index]!, localT };
}

function autoBezierDerivativeAtFromCubics(
	cubics: readonly CubicBezierShape[],
	t: number,
): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubicFromCubics(cubics, t);
	return cubicBezierDerivative(cubic, localT);
}

export function lineParameters(
	segment: Extract<DraftSegment, { kind: 'line' }>,
	maxSampleSpan: number,
	maxSamples: number,
): number[] {
	const dx = segment.end[0] - segment.start[0];
	const dz = segment.end[1] - segment.start[1];
	const length = Math.hypot(dx, dz);
	if (!Number.isFinite(length)) {
		throw new LayoutGeometrySamplingError(
			'sampling_length_invalid',
			'Segment derived length must be finite.',
		);
	}
	if (length <= CURVE_ENDPOINT_EPSILON) return [0, 1];
	const steps = Math.max(1, Math.ceil(length / Math.max(maxSampleSpan, CURVE_ENDPOINT_EPSILON)));
	if (!Number.isSafeInteger(steps) || steps + 1 > maxSamples) {
		throw new LayoutGeometrySamplingError(
			'sampling_budget_exceeded',
			`Segment requires more than ${maxSamples} curve samples.`,
		);
	}
	const parameters: number[] = [];
	for (let index = 0; index <= steps; index += 1) parameters.push(index / steps);
	return parameters;
}

export function assertFiniteSamplingInput(segment: SampleableSegment): void {
	const points = segmentVertexPoints(segment);
	if (!points.every((point) => point.every(Number.isFinite))) {
		throw new LayoutGeometrySamplingError(
			'sampling_output_invalid',
			'Segment points must be finite before sampling.',
		);
	}
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1]!;
		const current = points[index]!;
		const dx = current[0] - previous[0];
		const dz = current[1] - previous[1];
		if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(Math.hypot(dx, dz))) {
			throw new LayoutGeometrySamplingError(
				'sampling_length_invalid',
				'Segment derived length must be finite.',
			);
		}
	}
}

export function adaptiveParameters(
	segment: CubicBezierShape,
	flatnessTolerance: number,
	maxSampleSpan: number,
	maxDepth: number,
): number[] {
	const result: number[] = [0];
	function visit(t0: number, t1: number, depth: number): void {
		const p0 = cubicBezierPoint(segment, t0);
		const p1 = cubicBezierPoint(segment, t1);
		const tm = (t0 + t1) / 2;
		const pm = cubicBezierPoint(segment, tm);
		const flatness = distanceToLine(pm, p0, p1);
		const chord = distance(p0, p1);
		if (depth < maxDepth && (flatness > flatnessTolerance || chord > maxSampleSpan)) {
			visit(t0, tm, depth + 1);
			visit(tm, t1, depth + 1);
			return;
		}
		result.push(t1);
	}
	visit(0, 1, 0);
	return [...new Set(result)].sort((a, b) => a - b);
}

export function tangentFromSamples(
	points: readonly LayoutVec2[],
	index: number,
	segment: SampleableSegment,
	t: number,
	cubics?: readonly CubicBezierShape[],
): LayoutVec2 {
	const tangent =
		cubics && cubics.length > 0 && segment.kind !== 'line'
			? normalize(autoBezierDerivativeAtFromCubics(cubics, t), fallbackTangent(segment))
			: segmentTangentAt(segment, t);
	if (length(tangent) > CURVE_ENDPOINT_EPSILON) return tangent;
	if (index > 0) return normalize(subtract(points[index]!, points[index - 1]!), [1, 0]);
	return index + 1 < points.length
		? normalize(subtract(points[index + 1]!, points[index]!), [1, 0])
		: [1, 0];
}

export function fallbackTangent(segment: CurvedSampleableSegment): LayoutVec2 {
	const vertices = segmentVertexPoints(segment);
	if (vertices.length < 2) return [1, 0];
	return normalize(subtract(vertices.at(-1)!, vertices[0]!), [1, 0]);
}

function evaluateCubicBezierPoint(segment: CubicBezierShape, t: number): LayoutVec2 {
	const tt = Math.min(1, Math.max(0, t));
	const u = 1 - tt;
	return [
		u * u * u * segment.start[0] +
			3 * u * u * tt * segment.handleOut[0] +
			3 * u * tt * tt * segment.handleIn[0] +
			tt * tt * tt * segment.end[0],
		u * u * u * segment.start[1] +
			3 * u * u * tt * segment.handleOut[1] +
			3 * u * tt * tt * segment.handleIn[1] +
			tt * tt * tt * segment.end[1],
	];
}

function createAutomaticTangent(points: readonly LayoutVec2[], index: number): LayoutVec2 {
	const point = points[index]!;
	const previous = nearestDistinctPoint(points, index, -1);
	const next = nearestDistinctPoint(points, index, 1);

	if (!previous && !next) return [0, 0];

	if (!previous) {
		const interval = centripetalInterval(point, next!);
		return divide(subtract(next!, point), interval);
	}

	if (!next) {
		const interval = centripetalInterval(previous, point);
		return divide(subtract(point, previous), interval);
	}

	const previousInterval = centripetalInterval(previous, point);
	const nextInterval = centripetalInterval(point, next);
	const incoming = scale(subtract(point, previous), nextInterval / previousInterval);
	const outgoing = scale(subtract(next, point), previousInterval / nextInterval);
	return divide(add(incoming, outgoing), previousInterval + nextInterval);
}

function nearestDistinctPoint(
	points: readonly LayoutVec2[],
	index: number,
	direction: -1 | 1,
): LayoutVec2 | null {
	const point = points[index]!;
	for (
		let candidateIndex = index + direction;
		candidateIndex >= 0 && candidateIndex < points.length;
		candidateIndex += direction
	) {
		const candidate = points[candidateIndex]!;
		if (!coincidesAsJunction(candidate, point)) return candidate;
	}
	return null;
}

function centripetalInterval(from: LayoutVec2, to: LayoutVec2): number {
	return Math.pow(distance(from, to), LAYOUT_AUTO_BEZIER_ALPHA);
}
