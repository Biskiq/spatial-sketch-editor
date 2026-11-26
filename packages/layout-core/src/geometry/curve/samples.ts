import type { LayoutVec2 } from '../coordinates';
import { p2311Measure } from '../../kernel/work-observer';
import {
	adaptiveParameters,
	assertFiniteSamplingInput,
	autoBezierAnchorPoints,
	autoBezierDerivativeAt,
	autoBezierPointAt,
	compileAutoBezierAnchors,
	cubicBezierArcLength,
	cubicBezierArcLengthBetween,
	cubicBezierPoint,
	fallbackTangent,
	lineParameters,
	tangentFromSamples,
} from './bezier';
import type {
	CubicBezierShape,
	CurveDistanceResult,
	CurveSample,
	CurvedSampleableSegment,
	SampleableSegment,
	SampledSegment,
} from './contracts';
import {
	CURVE_ENDPOINT_EPSILON,
	CURVE_FLATNESS_TOLERANCE,
	CURVE_MAX_SAMPLE_SPAN,
	LayoutGeometrySamplingError,
	MAX_CURVE_SAMPLES_PER_SEGMENT,
} from './contracts';
import { clamp01, distance, lerp, normalize } from './intersections';

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
			...segment.cubics.map((cubic) => [...cubic.end] as LayoutVec2),
		];
	}
	return [segment.start, ...segment.interiorAnchors.map((anchor) => anchor.point), segment.end];
}

/**
 * The cubic list of a non-straight segment: stored spans for the canonical
 * chain, the derived spline for a legacy `auto-bezier` anchor list. The single
 * place either shape becomes cubics.
 */
export function curvedCubics(segment: CurvedSampleableSegment): CubicBezierShape[] {
	return segment.kind === 'cubic-chain'
		? segment.cubics
		: compileAutoBezierAnchors(autoBezierAnchorPoints(segment));
}

export function segmentPointAt(segment: SampleableSegment, t: number): LayoutVec2 {
	if (segment.kind === 'line') {
		const amount = clamp01(t);
		return [
			segment.start[0] + (segment.end[0] - segment.start[0]) * amount,
			segment.start[1] + (segment.end[1] - segment.start[1]) * amount,
		];
	}
	return autoBezierPointAt(segment, t);
}

export function segmentTangentAt(segment: SampleableSegment, t: number): LayoutVec2 {
	if (segment.kind === 'line')
		return normalize(
			[segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]],
			[1, 0],
		);
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
	} = {},
): SampledSegment {
	return p2311Measure('curve-sampling', () => sampleSegmentUnmeasured(segment, options));
}

function sampleSegmentUnmeasured(
	segment: SampleableSegment,
	options: {
		flatnessTolerance?: number;
		maxSampleSpan?: number;
		maxDepth?: number;
		maxSamples?: number;
	} = {},
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
			segment,
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
					`Segment requires more than ${maxSamples} curve samples.`,
				);
			}
			const globalT = cubics.length <= 1 ? localT : (cubicIndex + localT) / cubics.length;
			const point = cubicBezierPoint(cubic, localT);
			if (!point.every(Number.isFinite)) {
				throw new LayoutGeometrySamplingError(
					'sampling_output_invalid',
					'Segment sampling produced a non-finite point.',
				);
			}
			pointsWithT.push({ point, t: globalT });
		}
	}
	if (pointsWithT.length === 0) {
		const vertices = segmentVertexPoints(segment);
		pointsWithT.push(
			{ point: [...vertices[0]!] as LayoutVec2, t: 0 },
			{ point: [...vertices.at(-1)!] as LayoutVec2, t: 1 },
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

export function pointAtDistance(
	sampled: SampledSegment,
	distanceAlong: number,
): CurveDistanceResult {
	const samples = sampled.samples;
	if (samples.length === 0)
		return { point: [0, 0], distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 };
	if (samples.length === 1 || sampled.length <= CURVE_ENDPOINT_EPSILON)
		return { ...samples[0]!, point: [...samples[0]!.point] };
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
		t: start.t + (end.t - start.t) * amount,
	};
}

/** Points along a compiled sample range [start, end] including exact clipped endpoints. */
export function samplePolylineInRange(
	samples: readonly CurveSample[],
	startDistance: number,
	endDistance: number,
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

export function pointAlongSamples(
	samples: readonly CurveSample[],
	distanceAlong: number,
): LayoutVec2 {
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
		start.point[1] + (end.point[1] - start.point[1]) * amount,
	];
}

export function projectPointToSampledSegment(
	point: LayoutVec2,
	sampled: SampledSegment,
): CurveDistanceResult & { distanceToPath: number } {
	let best: (CurveDistanceResult & { distanceToPath: number }) | null = null;
	for (let index = 1; index < sampled.samples.length; index += 1) {
		const start = sampled.samples[index - 1]!;
		const end = sampled.samples[index]!;
		const dx = end.point[0] - start.point[0];
		const dz = end.point[1] - start.point[1];
		const squared = dx * dx + dz * dz;
		const rawT =
			squared > 0
				? ((point[0] - start.point[0]) * dx + (point[1] - start.point[1]) * dz) / squared
				: 0;
		const amount = Math.min(1, Math.max(0, rawT));
		const projected = [start.point[0] + dx * amount, start.point[1] + dz * amount] as LayoutVec2;
		const tangent = normalize(lerp(start.tangent, end.tangent, amount), start.tangent);
		const candidate = {
			point: projected,
			distance: start.distance + (end.distance - start.distance) * amount,
			tangent,
			normal: [-tangent[1], tangent[0]] as LayoutVec2,
			t: start.t + (end.t - start.t) * amount,
			distanceToPath: distance(point, projected),
		};
		if (!best || candidate.distanceToPath < best.distanceToPath) best = candidate;
	}
	return (
		best ?? {
			...pointAtDistance(sampled, 0),
			distanceToPath: distance(point, sampled.samples[0]?.point ?? [0, 0]),
		}
	);
}

/**
 * The ONE authored Wall-distance metric.
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
	cubics: readonly CubicBezierShape[],
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
		if (
			currentIndex >= 0 &&
			(index < currentIndex || (index === currentIndex && local < currentLocal))
		) {
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
	cubics?: readonly CubicBezierShape[],
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
			t: entry.t,
		};
	});
	return { segmentId, length, samples };
}
