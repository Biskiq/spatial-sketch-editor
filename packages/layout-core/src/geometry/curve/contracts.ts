import type { LayoutVec2 } from '../coordinates';
import type { DraftSegment } from '../path';

export const CURVE_ENDPOINT_EPSILON = 1e-6;

export const CURVE_FLATNESS_TOLERANCE = 0.01;

export const CURVE_MAX_SAMPLE_SPAN = 0.25;

export const CURVE_SELF_INTERSECTION_TOLERANCE = 1e-4;

/**
 * Absolute arc-length tolerance in metres for cubic quadrature and
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
 * The canonical Wall adapter's transient segment shape: explicit
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
