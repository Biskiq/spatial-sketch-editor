import type { DraftSegment, LayoutInteriorAnchor, LayoutVec2 } from './layout-types';
import { coincidesAsJunction } from './layout-junction-identity';

export const CURVE_ENDPOINT_EPSILON = 1e-6;
export const CURVE_FLATNESS_TOLERANCE = 0.01;
export const CURVE_MAX_SAMPLE_SPAN = 0.25;
export const CURVE_SELF_INTERSECTION_TOLERANCE = 1e-4;
/**
 * P23.11 — absolute arc-length tolerance in metres for cubic quadrature and
 * arc-length inversion. It bounds only how faithfully a physical distance maps
 * to a curve parameter; de Casteljau subdivision at the resolved parameter
 * stays exact. A cubic's speed is smooth, so 16-point Gauss converges on one
 * panel for every Wall-scale span this kernel sees; the adaptive split exists
 * for pathological control polygons only.
 */
export const CURVE_ARC_LENGTH_TOLERANCE = 1e-6;
/** Recursion cap for {@link cubicBezierArcLength} (a guard, not a resolution). */
export const CURVE_ARC_LENGTH_MAX_DEPTH = 12;
export const LAYOUT_AUTO_BEZIER_ALPHA = 0.5;
export const MAX_CURVE_SAMPLES_PER_SEGMENT = 100_000;

export class LayoutGeometrySamplingError extends Error {
	constructor(
		public readonly code: 'sampling_length_invalid' | 'sampling_budget_exceeded' | 'sampling_output_invalid',
		message: string
	) {
		super(message);
		this.name = 'LayoutGeometrySamplingError';
	}
}

export type AutoBezierSegment = Extract<DraftSegment, { kind: 'auto-bezier' }>;

export type CubicBezierShape = {
	start: LayoutVec2;
	handleOut: LayoutVec2;
	handleIn: LayoutVec2;
	end: LayoutVec2;
};

/**
 * Control pair for exactly one cubic span: `handleOut` leaves the span's first
 * point and `handleIn` arrives at its second point, so one span is one cubic.
 * Structurally identical to the canonical `LayoutWallCubicSpan`, kept general
 * here so the curve kernel never depends on the canonical Wall schema.
 */
export type CubicSpanControls = {
	handleOut: LayoutVec2;
	handleIn: LayoutVec2;
};

/**
 * P23.11 — the canonical Wall adapter's transient segment shape: explicit
 * cubic spans already resolved against the Wall's endpoint Junctions. Never
 * persisted and never a `DraftSegment`: it carries derived geometry, not
 * authored control points.
 */
export type CubicChainSegment = {
	id: string;
	kind: 'cubic-chain';
	cubics: CubicBezierShape[];
};

/** One non-straight segment shape the sampler understands. */
export type CurvedSampleableSegment = AutoBezierSegment | CubicChainSegment;

/** Every segment shape the one sampler understands. */
export type SampleableSegment =
	| Extract<DraftSegment, { kind: 'line' }>
	| CurvedSampleableSegment;

export type LegacyBezierSegment = {
	id: string;
	kind: 'bezier';
	start: LayoutVec2;
	handleOut: LayoutVec2;
	handleIn: LayoutVec2;
	end: LayoutVec2;
};

export type CurveSample = {
	point: LayoutVec2;
	distance: number;
	tangent: LayoutVec2;
	normal: LayoutVec2;
	t: number;
};

export type CurveDistanceResult = {
	point: LayoutVec2;
	distance: number;
	tangent: LayoutVec2;
	normal: LayoutVec2;
	t: number;
};

export type SampledSegment = {
	segmentId: string;
	length: number;
	samples: CurveSample[];
};

export function autoBezierAnchorPoints(segment: AutoBezierSegment): LayoutVec2[] {
	return [segment.start, ...segment.interiorAnchors.map((anchor) => anchor.point), segment.end];
}

/**
 * P23.11 — the one canonical smoothness rule, on the **write** path only.
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
			spanControlsFromTangents(points[index]!, points[index + 1]!, tangents[index]!, tangents[index + 1]!)
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
	endTangent: LayoutVec2
): CubicSpanControls {
	const interval = centripetalInterval(start, end);
	if (interval === 0) return { handleOut: clonePoint(start), handleIn: clonePoint(end) };
	return {
		handleOut: addScaled(start, startTangent, interval / 3),
		handleIn: addScaled(end, endTangent, -interval / 3)
	};
}

/**
 * P23.11 — the canonical smoothness rule for exactly one span: the control pair
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
	index: number
): CubicSpanControls {
	return spanControlsFromTangents(
		points[index]!,
		points[index + 1]!,
		createAutomaticTangent(points, index),
		createAutomaticTangent(points, index + 1)
	);
}

/**
 * Pair each span with the points it spans: cubic `i` runs
 * `points[i] → points[i + 1]`, so `spans.length` is `points.length - 1`.
 */
export function spansToCubics(
	points: readonly LayoutVec2[],
	spans: readonly CubicSpanControls[]
): CubicBezierShape[] {
	return spans.map((span, index) => ({
		start: clonePoint(points[index]!),
		handleOut: clonePoint(span.handleOut),
		handleIn: clonePoint(span.handleIn),
		end: clonePoint(points[index + 1]!)
	}));
}

export function compileAutoBezierAnchors(points: readonly LayoutVec2[]): CubicBezierShape[] {
	return spansToCubics(points, deriveChainSpans(points));
}

export function legacyBezierToAutoBezier(segment: LegacyBezierSegment): AutoBezierSegment {
	const mid = evaluateCubicBezierPoint(
		{ start: segment.start, handleOut: segment.handleOut, handleIn: segment.handleIn, end: segment.end },
		0.5
	);
	return {
		id: segment.id,
		kind: 'auto-bezier',
		start: clonePoint(segment.start),
		end: clonePoint(segment.end),
		interiorAnchors: [{ id: nextInteriorAnchorId(segment.id, []), point: mid }]
	};
}

export function nextInteriorAnchorId(segmentId: string, existing: readonly LayoutInteriorAnchor[]): string {
	const used = new Set(existing.map((anchor) => anchor.id));
	let index = existing.length + 1;
	while (used.has(`${segmentId}:anchor:${index}`)) index += 1;
	return `${segmentId}:anchor:${index}`;
}

export function cubicBezierPoint(segment: CubicBezierShape, t: number): LayoutVec2 {
	const u = 1 - clamp01(t);
	const tt = clamp01(t);
	return [
		u * u * u * segment.start[0] + 3 * u * u * tt * segment.handleOut[0] + 3 * u * tt * tt * segment.handleIn[0] + tt * tt * tt * segment.end[0],
		u * u * u * segment.start[1] + 3 * u * u * tt * segment.handleOut[1] + 3 * u * tt * tt * segment.handleIn[1] + tt * tt * tt * segment.end[1]
	];
}

/** 16-point Gauss-Legendre abscissae on [-1, 1]. */
const GAUSS_LEGENDRE_ABSCISSAE = [
	-0.09501250983763744, 0.09501250983763744, -0.2816035507792589, 0.2816035507792589,
	-0.4580167776572274, 0.4580167776572274, -0.6178762444026438, 0.6178762444026438,
	-0.755404408355003, 0.755404408355003, -0.8656312023878318, 0.8656312023878318,
	-0.9445750230732326, 0.9445750230732326, -0.9894009349916499, 0.9894009349916499
];
/** 16-point Gauss-Legendre weights, paired with the abscissae above. */
const GAUSS_LEGENDRE_WEIGHTS = [
	0.1894506104550685, 0.1894506104550685, 0.1826034150449236, 0.1826034150449236,
	0.16915651939500254, 0.16915651939500254, 0.14959598881657673, 0.14959598881657673,
	0.12462897125553387, 0.12462897125553387, 0.09515851168249278, 0.09515851168249278,
	0.06225352393864789, 0.06225352393864789, 0.027152459411754096, 0.027152459411754096
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
	depth: number
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
	tolerance = CURVE_ARC_LENGTH_TOLERANCE
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
	tolerance = CURVE_ARC_LENGTH_TOLERANCE
): number {
	return cubicBezierArcLengthBetween(segment, 0, clamp01(t), tolerance);
}

/** Total arc length of one cubic (parameters 0 → 1). */
export function cubicBezierArcLength(
	segment: CubicBezierShape,
	tolerance = CURVE_ARC_LENGTH_TOLERANCE
): number {
	return cubicBezierArcLengthBetween(segment, 0, 1, tolerance);
}

export function cubicBezierDerivative(segment: CubicBezierShape, t: number): LayoutVec2 {
	const u = 1 - clamp01(t);
	const tt = clamp01(t);
	return [
		3 * u * u * (segment.handleOut[0] - segment.start[0]) + 6 * u * tt * (segment.handleIn[0] - segment.handleOut[0]) + 3 * tt * tt * (segment.end[0] - segment.handleIn[0]),
		3 * u * u * (segment.handleOut[1] - segment.start[1]) + 6 * u * tt * (segment.handleIn[1] - segment.handleOut[1]) + 3 * tt * tt * (segment.end[1] - segment.handleIn[1])
	];
}

/**
 * Ordered chain vertices of any sampleable segment, `start … end` inclusive.
 * One helper so every consumer of the adapter output (face polygons, room
 * frames, validation outlines) reads the chain through the same seam.
 */
export function segmentVertexPoints(segment: SampleableSegment): LayoutVec2[] {
	if (segment.kind === 'line') {
		return [[...segment.start] as LayoutVec2, [...segment.end] as LayoutVec2];
	}
	if (segment.kind === 'cubic-chain') {
		return [
			[...segment.cubics[0]!.start] as LayoutVec2,
			...segment.cubics.map((cubic) => [...cubic.end] as LayoutVec2)
		];
	}
	return [segment.start, ...segment.interiorAnchors.map((anchor) => anchor.point), segment.end];
}

/**
 * The cubic list of a non-straight segment: stored spans for the canonical
 * chain, the derived spline for a legacy `auto-bezier` anchor list. The single
 * place either shape becomes cubics.
 */
function curvedCubics(segment: CurvedSampleableSegment): CubicBezierShape[] {
	return segment.kind === 'cubic-chain'
		? segment.cubics
		: compileAutoBezierAnchors(autoBezierAnchorPoints(segment));
}

export function segmentPointAt(segment: SampleableSegment, t: number): LayoutVec2 {
	if (segment.kind === 'line') {
		const amount = clamp01(t);
		return [
			segment.start[0] + (segment.end[0] - segment.start[0]) * amount,
			segment.start[1] + (segment.end[1] - segment.start[1]) * amount
		];
	}
	return autoBezierPointAt(segment, t);
}

export function segmentTangentAt(segment: SampleableSegment, t: number): LayoutVec2 {
	if (segment.kind === 'line') return normalize([segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]], [1, 0]);
	return normalize(autoBezierDerivativeAt(segment, t), fallbackTangent(segment));
}

export function segmentLength(segment: SampleableSegment): number {
	return sampleSegment(segment).length;
}

export function sampleSegment(
	segment: SampleableSegment,
	options: {
		flatnessTolerance?: number;
		maxSampleSpan?: number;
		maxDepth?: number;
		maxSamples?: number;
	} = {}
): SampledSegment {
	const flatnessTolerance = options.flatnessTolerance ?? CURVE_FLATNESS_TOLERANCE;
	const maxSampleSpan = options.maxSampleSpan ?? CURVE_MAX_SAMPLE_SPAN;
	const maxDepth = options.maxDepth ?? 12;
	const maxSamples = options.maxSamples ?? MAX_CURVE_SAMPLES_PER_SEGMENT;
	assertFiniteSamplingInput(segment);
	if (segment.kind === 'line') {
		const parameters = lineParameters(segment, maxSampleSpan, maxSamples);
		return buildSampledSegment(
			segment.id,
			parameters.map((t) => ({ point: segmentPointAt(segment, t), t })),
			segment
		);
	}

	const cubics = curvedCubics(segment);
	const pointsWithT: { point: LayoutVec2; t: number }[] = [];
	for (const [cubicIndex, cubic] of cubics.entries()) {
		const localParameters = adaptiveParameters(cubic, flatnessTolerance, maxSampleSpan, maxDepth);
		for (const [parameterIndex, localT] of localParameters.entries()) {
			if (cubicIndex > 0 && parameterIndex === 0) continue;
			if (pointsWithT.length >= maxSamples) {
				throw new LayoutGeometrySamplingError(
					'sampling_budget_exceeded',
					`Segment requires more than ${maxSamples} curve samples.`
				);
			}
			const globalT = cubics.length <= 1 ? localT : (cubicIndex + localT) / cubics.length;
			const point = cubicBezierPoint(cubic, localT);
			if (!point.every(Number.isFinite)) {
				throw new LayoutGeometrySamplingError(
					'sampling_output_invalid',
					'Segment sampling produced a non-finite point.'
				);
			}
			pointsWithT.push({ point, t: globalT });
		}
	}
	if (pointsWithT.length === 0) {
		const vertices = segmentVertexPoints(segment);
		pointsWithT.push(
			{ point: [...vertices[0]!] as LayoutVec2, t: 0 },
			{ point: [...vertices.at(-1)!] as LayoutVec2, t: 1 }
		);
	}
	return buildSampledSegment(segment.id, pointsWithT, segment, cubics);
}

/**
 * Binary search over monotonically increasing sample distances: the first
 * sample index (never below 1) whose distance is >= threshold, or
 * `samples.length` when none qualifies. Shared by `pointAtDistance` and
 * `pointAlongSamples` (G3 quick-win #5 — linear scan → O(log n)).
 */
function firstSampleIndexAtOrAfter(samples: readonly CurveSample[], threshold: number): number {
	let low = 1;
	let high = samples.length - 1;
	let result = samples.length;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (samples[middle]!.distance >= threshold) {
			result = middle;
			high = middle - 1;
		} else {
			low = middle + 1;
		}
	}
	return result;
}

export function pointAtDistance(sampled: SampledSegment, distanceAlong: number): CurveDistanceResult {
	const samples = sampled.samples;
	if (samples.length === 0) return { point: [0, 0], distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 };
	if (samples.length === 1 || sampled.length <= CURVE_ENDPOINT_EPSILON) return { ...samples[0]!, point: [...samples[0]!.point] };
	const target = Math.min(sampled.length, Math.max(0, distanceAlong));
	const endIndex = Math.min(samples.length - 1, firstSampleIndexAtOrAfter(samples, target));
	const start = samples[endIndex - 1]!;
	const end = samples[endIndex]!;
	const span = end.distance - start.distance;
	const amount = span > CURVE_ENDPOINT_EPSILON ? (target - start.distance) / span : 0;
	const tangent = normalize(lerp(start.tangent, end.tangent, amount), start.tangent);
	return {
		point: lerp(start.point, end.point, amount),
		distance: target,
		tangent,
		normal: [-tangent[1], tangent[0]],
		t: start.t + (end.t - start.t) * amount
	};
}

/** Points along a compiled sample range [start, end] including exact clipped endpoints. */
export function samplePolylineInRange(
	samples: readonly CurveSample[],
	startDistance: number,
	endDistance: number
): LayoutVec2[] {
	if (samples.length === 0 || endDistance <= startDistance + 1e-6) return [];
	const points: LayoutVec2[] = [pointAlongSamples(samples, startDistance)];
	for (const sample of samples) {
		if (sample.distance > startDistance + 1e-6 && sample.distance < endDistance - 1e-6) {
			points.push([...sample.point] as LayoutVec2);
		}
	}
	points.push(pointAlongSamples(samples, endDistance));
	return points;
}

export function pointAlongSamples(samples: readonly CurveSample[], distanceAlong: number): LayoutVec2 {
	if (samples.length === 0) return [0, 0];
	if (samples.length === 1) return [...samples[0]!.point] as LayoutVec2;
	const target = Math.min(samples.at(-1)!.distance, Math.max(0, distanceAlong));
	const endIndex = firstSampleIndexAtOrAfter(samples, target - 1e-9);
	if (endIndex >= samples.length) return [...samples.at(-1)!.point] as LayoutVec2;
	const start = samples[endIndex - 1]!;
	const end = samples[endIndex]!;
	const span = end.distance - start.distance;
	const amount = span > 1e-9 ? (target - start.distance) / span : 0;
	return [
		start.point[0] + (end.point[0] - start.point[0]) * amount,
		start.point[1] + (end.point[1] - start.point[1]) * amount
	];
}

export function projectPointToSampledSegment(point: LayoutVec2, sampled: SampledSegment): CurveDistanceResult & { distanceToPath: number } {
	let best: CurveDistanceResult & { distanceToPath: number } | null = null;
	for (let index = 1; index < sampled.samples.length; index += 1) {
		const start = sampled.samples[index - 1]!;
		const end = sampled.samples[index]!;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const squared = dx * dx + dz * dz;
		const rawT = squared > 0 ? ((point[0] - start.point[0]) * dx + (point[1] - start.point[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, rawT));
		const projected = [start.point[0] + dx * amount, start.point[1] + dz * amount] as LayoutVec2;
		const tangent = normalize(lerp(start.tangent, end.tangent, amount), start.tangent);
		const candidate = {
			point: projected,
			distance: start.distance + (end.distance - start.distance) * amount,
			tangent,
			normal: [-tangent[1], tangent[0]] as LayoutVec2,
			t: start.t + (end.t - start.t) * amount,
			distanceToPath: distance(point, projected)
		};
		if (!best || candidate.distanceToPath < best.distanceToPath) best = candidate;
	}
	return best ?? { ...pointAtDistance(sampled, 0), distanceToPath: distance(point, sampled.samples[0]?.point ?? [0, 0]) };
}

export function sampledPolylineIntersects(
	first: readonly CurveSample[],
	second: readonly CurveSample[],
	tolerance = CURVE_SELF_INTERSECTION_TOLERANCE,
	ignoreSharedEndpoint?: LayoutVec2
): boolean {
	for (let firstIndex = 1; firstIndex < first.length; firstIndex += 1) {
		for (let secondIndex = 1; secondIndex < second.length; secondIndex += 1) {
			const firstStart = first[firstIndex - 1]!.point;
			const firstEnd = first[firstIndex]!.point;
			const secondStart = second[secondIndex - 1]!.point;
			const secondEnd = second[secondIndex]!.point;
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
	for (let firstIndex = 0; firstIndex < samples.length - 1; firstIndex += 1) {
		for (let secondIndex = firstIndex + 2; secondIndex < samples.length - 1; secondIndex += 1) {
			if (firstIndex === 0 && secondIndex === samples.length - 2) continue;
			if (polylineSegmentsIntersect(samples[firstIndex]!.point, samples[firstIndex + 1]!.point, samples[secondIndex]!.point, samples[secondIndex + 1]!.point, tolerance)) return true;
		}
	}
	return false;
}

/**
 * P23.11 — the ONE authored Wall-distance metric.
 *
 * A sample's `distance` is the **true cubic arc length** from the segment start
 * to that sample's parameter, not the cumulative chord of the sampled polyline.
 * The two differ by the sampler's own flatness error, which is large enough to
 * misplace an authored meter: the editor's Wall hits and the Openings they
 * place expose these distances, and the exact cubic split resolves a distance
 * into a subdivision parameter. Measuring one surface in chord-summed metres
 * and interpreting it as true arc (or vice versa) is what made a bend land
 * slightly off the grabbed point, an Opening-edge split misclassify as a
 * straddle and a rebased Opening drift.
 *
 * Straight segments and straight cubics are unaffected: their arc length IS
 * their chord, so line segments keep the exact chord accumulation below and a
 * collinear chain reports its chord to quadrature tolerance.
 */
function trueArcSampleDistances(
	pointsWithT: readonly { point: LayoutVec2; t: number }[],
	cubics: readonly CubicBezierShape[]
): number[] {
	const distances: number[] = [];
	let running = 0;
	let currentIndex = -1;
	let currentLocal = 0;
	for (const entry of pointsWithT) {
		const scaled = clamp01(entry.t) * cubics.length;
		let index = Math.min(cubics.length - 1, Math.floor(scaled));
		let local = clamp01(scaled - index);
		// Guard against global-parameter rounding at a cubic boundary, so a
		// walk can never step backwards inside one cubic.
		if (currentIndex >= 0 && (index < currentIndex || (index === currentIndex && local < currentLocal))) {
			index = currentIndex;
			local = currentLocal;
		}
		if (currentIndex < 0) {
			running += cubicBezierArcLengthBetween(cubics[0]!, 0, local);
		} else if (index === currentIndex) {
			running += cubicBezierArcLengthBetween(cubics[index]!, currentLocal, local);
		} else {
			running += cubicBezierArcLengthBetween(cubics[currentIndex]!, currentLocal, 1);
			for (let skipped = currentIndex + 1; skipped < index; skipped += 1) {
				running += cubicBezierArcLength(cubics[skipped]!);
			}
			running += cubicBezierArcLengthBetween(cubics[index]!, 0, local);
		}
		currentIndex = index;
		currentLocal = local;
		distances.push(running);
	}
	return distances;
}

function buildSampledSegment(
	segmentId: string,
	pointsWithT: readonly { point: LayoutVec2; t: number }[],
	segment: SampleableSegment,
	cubics?: readonly CubicBezierShape[]
): SampledSegment {
	const points = pointsWithT.map((entry) => entry.point);
	let distances: number[];
	// Only the canonical cubic-chain segment adopts the true-arc metric. The
	// legacy Room-owned `auto-bezier` shape keeps its chord accumulation, so
	// legacy golden output stays byte-identical.
	if (cubics && cubics.length > 0 && segment.kind === 'cubic-chain') {
		distances = trueArcSampleDistances(pointsWithT, cubics);
	} else {
		distances = [0];
		for (let index = 1; index < points.length; index += 1) {
			distances.push(distances[index - 1]! + distance(points[index - 1]!, points[index]!));
		}
	}
	const length = distances.at(-1) ?? 0;
	const samples = pointsWithT.map((entry, index) => {
		const tangent = tangentFromSamples(points, index, segment, entry.t, cubics);
		return {
			point: [...entry.point] as LayoutVec2,
			distance: distances[index]!,
			tangent,
			normal: [-tangent[1], tangent[0]] as LayoutVec2,
			t: entry.t
		};
	});
	return { segmentId, length, samples };
}

function autoBezierPointAt(segment: CurvedSampleableSegment, t: number): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubic(segment, t);
	return cubicBezierPoint(cubic, localT);
}

function autoBezierDerivativeAt(segment: CurvedSampleableSegment, t: number): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubic(segment, t);
	return cubicBezierDerivative(cubic, localT);
}

function resolveAutoBezierCubic(
	segment: CurvedSampleableSegment,
	t: number
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
				end: [...end] as LayoutVec2
			},
			localT: clamp01(t)
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
	t: number
): { cubic: CubicBezierShape; localT: number } {
	if (cubics.length === 1) return { cubic: cubics[0]!, localT: clamp01(t) };
	const clamped = clamp01(t);
	const scaled = clamped * cubics.length;
	const index = Math.min(cubics.length - 1, Math.floor(scaled));
	const localT = index === cubics.length - 1 ? scaled - index : Math.min(1, scaled - index);
	return { cubic: cubics[index]!, localT };
}

function autoBezierDerivativeAtFromCubics(cubics: readonly CubicBezierShape[], t: number): LayoutVec2 {
	const { cubic, localT } = resolveAutoBezierCubicFromCubics(cubics, t);
	return cubicBezierDerivative(cubic, localT);
}

function lineParameters(
	segment: Extract<DraftSegment, { kind: 'line' }>,
	maxSampleSpan: number,
	maxSamples: number
): number[] {
	const dx = segment.end[0] - segment.start[0];
	const dz = segment.end[1] - segment.start[1];
	const length = Math.hypot(dx, dz);
	if (!Number.isFinite(length)) {
		throw new LayoutGeometrySamplingError(
			'sampling_length_invalid',
			'Segment derived length must be finite.'
		);
	}
	if (length <= CURVE_ENDPOINT_EPSILON) return [0, 1];
	const steps = Math.max(1, Math.ceil(length / Math.max(maxSampleSpan, CURVE_ENDPOINT_EPSILON)));
	if (!Number.isSafeInteger(steps) || steps + 1 > maxSamples) {
		throw new LayoutGeometrySamplingError(
			'sampling_budget_exceeded',
			`Segment requires more than ${maxSamples} curve samples.`
		);
	}
	const parameters: number[] = [];
	for (let index = 0; index <= steps; index += 1) parameters.push(index / steps);
	return parameters;
}

function assertFiniteSamplingInput(segment: SampleableSegment): void {
	const points = segmentVertexPoints(segment);
	if (!points.every((point) => point.every(Number.isFinite))) {
		throw new LayoutGeometrySamplingError(
			'sampling_output_invalid',
			'Segment points must be finite before sampling.'
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
				'Segment derived length must be finite.'
			);
		}
	}
}

function adaptiveParameters(
	segment: CubicBezierShape,
	flatnessTolerance: number,
	maxSampleSpan: number,
	maxDepth: number
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

function tangentFromSamples(
	points: readonly LayoutVec2[],
	index: number,
	segment: SampleableSegment,
	t: number,
	cubics?: readonly CubicBezierShape[]
): LayoutVec2 {
	const tangent =
		cubics && cubics.length > 0 && segment.kind !== 'line'
			? normalize(autoBezierDerivativeAtFromCubics(cubics, t), fallbackTangent(segment))
			: segmentTangentAt(segment, t);
	if (length(tangent) > CURVE_ENDPOINT_EPSILON) return tangent;
	if (index > 0) return normalize(subtract(points[index]!, points[index - 1]!), [1, 0]);
	return index + 1 < points.length ? normalize(subtract(points[index + 1]!, points[index]!), [1, 0]) : [1, 0];
}

function fallbackTangent(segment: CurvedSampleableSegment): LayoutVec2 {
	const vertices = segmentVertexPoints(segment);
	if (vertices.length < 2) return [1, 0];
	return normalize(subtract(vertices.at(-1)!, vertices[0]!), [1, 0]);
}

function evaluateCubicBezierPoint(segment: CubicBezierShape, t: number): LayoutVec2 {
	const tt = Math.min(1, Math.max(0, t));
	const u = 1 - tt;
	return [
		u * u * u * segment.start[0] + 3 * u * u * tt * segment.handleOut[0] + 3 * u * tt * tt * segment.handleIn[0] + tt * tt * tt * segment.end[0],
		u * u * u * segment.start[1] + 3 * u * u * tt * segment.handleOut[1] + 3 * u * tt * tt * segment.handleIn[1] + tt * tt * tt * segment.end[1]
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
	direction: -1 | 1
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

function clonePoint(point: LayoutVec2): LayoutVec2 {
	return [point[0], point[1]];
}

function normalize(vector: LayoutVec2, fallback: LayoutVec2): LayoutVec2 {
	const magnitude = length(vector);
	return magnitude > CURVE_ENDPOINT_EPSILON ? [vector[0] / magnitude, vector[1] / magnitude] : [...fallback];
}

function lerp(a: LayoutVec2, b: LayoutVec2, amount: number): LayoutVec2 {
	return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function subtract(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] - b[0], a[1] - b[1]];
}

function add(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] + b[0], a[1] + b[1]];
}

function scale(vector: LayoutVec2, amount: number): LayoutVec2 {
	return [vector[0] * amount, vector[1] * amount];
}

function addScaled(point: LayoutVec2, direction: LayoutVec2, amount: number): LayoutVec2 {
	return [point[0] + direction[0] * amount, point[1] + direction[1] * amount];
}

function divide(vector: LayoutVec2, divisor: number): LayoutVec2 {
	if (divisor === 0) return [0, 0];
	return [vector[0] / divisor, vector[1] / divisor];
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function length(vector: LayoutVec2): number {
	return Math.hypot(vector[0], vector[1]);
}

function distanceToLine(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): number {
	const span = distance(start, end);
	if (span <= CURVE_ENDPOINT_EPSILON) return distance(point, start);
	return Math.abs((end[0] - start[0]) * (start[1] - point[1]) - (start[0] - point[0]) * (end[1] - start[1])) / span;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}
