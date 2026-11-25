import type { LayoutVec2 } from '../../geometry/coordinates';

/** Absolute station/geometry tolerance for the committed proof suite. */
export const WALL_DEVELOPMENT_TOLERANCE = 1e-6;

/** Inverse/round-trip tolerance for the algebraic station map. */
export const WALL_DEVELOPMENT_STATION_TOLERANCE = 1e-9;


export type WallDevelopmentRefusal = {
  refused: 'development_invalid_input';
  message: string;
};


/** One canonical chain span attributed in station space. */
export type WallDevelopmentSourceSpan = {
  index: number;
  startKnotId: string;
  endKnotId: string;
  startStation: number;
  endStation: number;
  arcLength: number;
};


/**
 * The prepared development. `s`/`theta`/`phi`/`ell`/`deltaS`/`points` are the
 * canonical samples the plan names; `correctedEll` is the chord correction that
 * makes `u = 1` an isometric straight sheet.
 */
export type WallDevelopment = {
  readonly wallId: string;
  readonly closed: boolean;
  readonly anchorStation: number;
  readonly cutStation: number | null;
  readonly length: number;
  readonly sampleCount: number;
  readonly s: Float64Array;
  readonly theta: Float64Array;
  readonly phi: Float64Array;
  readonly ell: Float64Array;
  readonly deltaS: Float64Array;
  readonly correctedEll: Float64Array;
  readonly points: Float64Array;
  readonly anchorIndex: number;
  readonly anchorPoint: LayoutVec2;
  readonly anchorDirection: number;
};


export type WallDevelopmentBuffers = {
  points: Float64Array;
  normals: Float64Array;
};


export type WallDevelopmentPoint = {
  point: LayoutVec2;
  normal: LayoutVec2;
  station: number;
};


export type WallDevelopmentFace = 'left' | 'right' | 'top' | 'bottom';


export type WallDevelopmentIssueCode =
  | 'span_length_sum_mismatch'
  | 'span_length_mismatch'
  | 'span_joint_gap'
  | 'non_monotone_station'
  | 'self_intersection'
  | 'inverted_face'
  | 'opening_station_mismatch'
  | 'mesh_station_gap';


/** A failure attributed to the source span that violated the contract. */
export type WallDevelopmentIssue = {
  code: WallDevelopmentIssueCode;
  message: string;
  spanIndex?: number;
  startKnotId?: string;
  endKnotId?: string;
  openingId?: string;
  station?: number;
};


export type WallDevelopmentOpeningInput = {
  openingId: string;
  offset: number;
  width: number;
};


export type WallDevelopmentOpeningFragment = {
  openingId: string;
  index: number;
  /** Canonical station interval, measured from the canonical seam. */
  stationStart: number;
  stationEnd: number;
  /** Displayed sheet interval after the closed-Wall cut is applied. */
  sheetStart: number;
  sheetEnd: number;
  spanIndices: readonly number[];
};


export type WallDevelopmentOpening = {
  openingId: string;
  stationStart: number;
  stationEnd: number;
  width: number;
  centerStation: number;
  centerSheet: number;
  spanIndices: readonly number[];
  fragments: readonly WallDevelopmentOpeningFragment[];
};


export type WallDevelopmentMeshVertex = {
  station: number;
  sheet: number;
  lateral: number;
  height: number;
  spanIndex: number;
};


export type WallDevelopmentMeshTriangle = {
  indices: readonly [number, number, number];
  face: WallDevelopmentFace;
  stationStart: number;
  stationEnd: number;
  sheetStart: number;
  sheetEnd: number;	spanIndex: number;
	startKnotId: string;
	endKnotId: string;
	/** A pick-only fill for an Opening void; never rendered or contoured. */
	void?: boolean;
};


export type WallDevelopmentMesh = {
  vertices: readonly WallDevelopmentMeshVertex[];
  triangles: readonly WallDevelopmentMeshTriangle[];
  stations: readonly {
    station: number;
    sheet: number;
    spanIndex: number;
  }[];
  trianglesByFace: Readonly<Record<WallDevelopmentFace, number>>;
  bounds: { min: [number, number, number]; max: [number, number, number] };
};


export type WallDevelopmentMeshHole = {
  readonly openingId: string;
  /** Displayed sheet interval, already cut at the closed-Wall display seam. */
  readonly sheetStart: number;
  readonly sheetEnd: number;
  readonly sillHeight: number;
  readonly headHeight: number;
  /**
   * The compiled Opening's top boundary in hole-local sheet/metres. The first
   * point is the left spring and the last the right spring; the apex is a real
   * vertex, not a rectangular approximation. Omitted for rectangular Openings.
   */
  readonly topBoundary?: readonly LayoutVec2[];
};


export type WallDevelopmentMeshOptions = {
  thickness: number;
  height: number;
  spans: readonly WallDevelopmentSourceSpan[];
  /** Real voids in the developed sheet; omitted leaves the original strip unchanged. */
  readonly openings?: readonly WallDevelopmentMeshHole[];
};


/**
 * A closed Wall's display is cut at `cutStation`, not at the canonical seam.
 * This buffer stores the cut-to-cut sample run (the cut point appears at both
 * ends), so a partial relax opens two wings from the pin and a flat strip has
 * the two free cut edges at opposite ends.
 */
export type WallDevelopmentSheetBuffers = {
  points: Float64Array;
  normals: Float64Array;
  /** Displayed sheet coordinate, 0 at the cut and `length` at its other copy. */
  sheet: Float64Array;
  /** Canonical station for each sheet sample. */
  stations: Float64Array;
  theta: Float64Array;
  phi: Float64Array;
  deltaS: Float64Array;
  correctedEll: Float64Array;
  anchorIndex: number;
};


/** One displayed sample in sheet order, with its canonical station. */
export type WallDevelopmentDisplaySample = {
  readonly point: LayoutVec2;
  readonly station: number;
  readonly sheet: number;
};


/** The inverse of the developed sheet: a point back to canonical station and face. */
export type WallDevelopmentInversePoint = {
  /** Displayed sheet coordinate, in metres from the display cut (closed) or anchor (open). */
  sheet: number;
  /** Canonical station, modulo L for a closed Wall. */
  station: number;
  /** Signed offset from the developed centerline, positive along its left normal. */
  lateral: number;
  face: 'left' | 'right';	spanIndex: number;
	startKnotId: string;
	endKnotId: string;
	/** A pick-only fill for an Opening void; never rendered or contoured. */
	void?: boolean;
};


/** A developed face frame: world bounds and the look direction that faces it. */
export type WallDevelopmentFaceFrame = {
  readonly bounds: {
    readonly min: [number, number, number];
    readonly max: [number, number, number];
  };
  /** Camera look direction (eye → face), in world X/Z. */
  readonly look: [number, number, number];
};


/** One canonical Opening band for identity lookup on the developed sheet. */
export type WallDevelopmentOpeningBand = {
  readonly openingId: string;
  readonly stationStart: number;
  readonly stationEnd: number;
  readonly sillHeight: number;
  readonly headHeight: number;
  /** Compiled arch/pointed top boundary in Opening-local metres. */
  readonly topBoundary?: readonly LayoutVec2[];
  /** Door openings carry a leaf on the developed sheet. */
  readonly kind?: 'door' | 'window';
};
