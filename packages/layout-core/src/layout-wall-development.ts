/**
 * `layout-wall-development.ts` — the one development map for a Wall.
 *
 * C3 checkpoint 4. This module owns the data/geometry proof surface only; it
 * has no editor imports and no UI state. One mechanism serves every valid Wall:
 * straight, multi-Bézier, S-curve, inflection and closed self-connected chains.
 *
 * ## Reference surface (D10)
 *
 * The development is isometric along the **centerline**. Stations, Opening
 * offsets/widths and Wall length are centerline quantities. Wall faces at
 * signed offset `w` are *not* isometric: at `u = 1` both face polylines have the
 * centerline's developed length, so the inner face stretches and the outer face
 * shrinks. No code here labels a face length as true, and
 * {@link wallDevelopmentFaceLengths} reports the measured source lengths for
 * evidence only.
 *
 * ## Station mapping
 *
 * At `u = 1` a centerline station `s` sits `s - anchorStation` from the anchor
 * along the developed straight line. Open Walls use that coordinate directly
 * (`anchorStation` is normally 0). A closed Wall rotates the sheet so the
 * **display cut** is at the sheet ends: `sheet = wrap(s - cutStation, L)`.
 * `cutStation` is opposite the anchor (D11) and the canonical seam remains
 * station 0; the seam is a tick at `wrap(-cutStation, L)`, never a moved
 * Junction or a changed canonical station.
 *
 * ## Mesh attribution
 *
 * Every developed vertex and triangle carries the canonical station and the
 * source span (`startKnotId`/`endKnotId`). A validation issue from a bad span
 * or triangle therefore names the violating span, never a bare coordinate.
 */

import type { LayoutVec2 } from './layout-coordinates';
import { CURVE_ENDPOINT_EPSILON, type CurveSample } from './layout-geometry-curve';
import { countWork } from './p2311-perf';

/** Absolute station/geometry tolerance for the committed proof suite. */
export const WALL_DEVELOPMENT_TOLERANCE = 1e-6;
/** Inverse/round-trip tolerance for the algebraic station map. */
export const WALL_DEVELOPMENT_STATION_TOLERANCE = 1e-9;
const DEVELOPMENT_EPSILON = 1e-9;
const TAU = Math.PI * 2;

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
  sheetEnd: number;
  spanIndex: number;
  startKnotId: string;
  endKnotId: string;
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

export type WallDevelopmentMeshOptions = {
  thickness: number;
  height: number;
  spans: readonly WallDevelopmentSourceSpan[];
};

export function isWallDevelopmentRefusal(
  value: WallDevelopment | WallDevelopmentRefusal
): value is WallDevelopmentRefusal {
  return 'refused' in value;
}

/**
 * Prepare the development from the canonical samples. The anchor is inserted
 * into the sample list when it falls between samples, so every `u` walks the
 * same polyline the canonical sampler defined.
 */
export function prepareWallDevelopment(input: {
  wallId: string;
  samples: readonly CurveSample[];
  closed: boolean;
  anchorStation: number;
  cutStation?: number | null;
}): WallDevelopment | WallDevelopmentRefusal {
  if (input.samples.length < 2) {
    return { refused: 'development_invalid_input', message: 'A development needs at least two samples.' };
  }
  for (const sample of input.samples) {
    if (
      !sample.point.every(Number.isFinite) ||
      !sample.tangent.every(Number.isFinite) ||
      !sample.normal.every(Number.isFinite) ||
      !Number.isFinite(sample.distance)
    ) {
      return { refused: 'development_invalid_input', message: 'Development samples must be finite.' };
    }
  }
  for (let index = 1; index < input.samples.length; index += 1) {
    if (input.samples[index]!.distance < input.samples[index - 1]!.distance - DEVELOPMENT_EPSILON) {
      return {
        refused: 'development_invalid_input',
        message: `Sample stations must be monotone (index ${index}).`
      };
    }
  }
  const length = input.samples.at(-1)!.distance;
  if (!(length > CURVE_ENDPOINT_EPSILON)) {
    return { refused: 'development_invalid_input', message: 'A development needs positive length.' };
  }
  const anchorStation = input.closed
    ? wrap(input.anchorStation, length)
    : clamp(input.anchorStation, 0, length);
  const withAnchor = insertAnchor(input.samples, anchorStation);
  const anchorIndex = withAnchor.anchorIndex;
  const sampleCount = withAnchor.samples.length;
  const s = new Float64Array(sampleCount);
  const theta = new Float64Array(sampleCount);
  const phi = new Float64Array(sampleCount - 1);
  const ell = new Float64Array(sampleCount - 1);
  const deltaS = new Float64Array(sampleCount - 1);
  const correctedEll = new Float64Array(sampleCount - 1);
  const points = new Float64Array(sampleCount * 2);

  // Two passes: every tangent angle must be unwrapped before a span's chord
  // correction can read the angle at its far end. Reading `theta[i + 1]`
  // during the first pass would correct against an unset zero and make a
  // curved chain's chord lengths drift.
  let previousTheta = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = withAnchor.samples[index]!;
    s[index] = sample.distance;
    points[index * 2] = sample.point[0];
    points[index * 2 + 1] = sample.point[1];
    const rawTheta = Math.atan2(sample.tangent[1], sample.tangent[0]);
    theta[index] = index === 0 ? rawTheta : unwrapAngle(rawTheta, previousTheta);
    previousTheta = theta[index]!;
  }
  let previousPhi = 0;
  for (let index = 0; index < sampleCount - 1; index += 1) {
    const sample = withAnchor.samples[index]!;
    const next = withAnchor.samples[index + 1]!;
    const dx = next.point[0] - sample.point[0];
    const dz = next.point[1] - sample.point[1];
    const rawPhi = Math.atan2(dz, dx);
    phi[index] = index === 0 ? rawPhi : unwrapAngle(rawPhi, previousPhi);
    previousPhi = phi[index]!;
    ell[index] = Math.hypot(dx, dz);
    deltaS[index] = Math.max(0, next.distance - sample.distance);
    const halfTurn = (theta[index + 1]! - theta[index]!) / 2;
    correctedEll[index] =
      ell[index]! / (Math.abs(halfTurn) <= 1e-12 ? 1 : Math.sin(halfTurn) / halfTurn);
  }

  const cutStation =
    input.closed
      ? input.cutStation === undefined || input.cutStation === null
        ? wrap(anchorStation + length / 2, length)
        : wrap(input.cutStation, length)
      : null;
  return {
    wallId: input.wallId,
    closed: input.closed,
    anchorStation,
    cutStation,
    length,
    sampleCount,
    s,
    theta,
    phi,
    ell,
    deltaS,
    correctedEll,
    points,
    anchorIndex,
    anchorPoint: [
      withAnchor.samples[anchorIndex]!.point[0],
      withAnchor.samples[anchorIndex]!.point[1]
    ],
    anchorDirection: theta[anchorIndex]!
  };
}

/**
 * The plan's discrete relaxation. `u = 0` reproduces the canonical polyline;
 * `u = 1` is a straight sheet whose station advance is exact. No allocation
 * beyond the caller's buffers.
 */
export function evaluateWallDevelopment(
  development: WallDevelopment,
  u: number,
  out: WallDevelopmentBuffers
): void {
  const count = development.sampleCount;
  if (out.points.length !== count * 2 || out.normals.length !== count * 2) {
    throw new Error('evaluateWallDevelopment buffers must match development.sampleCount.');
  }
  countWork('unfold:development-sample', count);
  const amount = clamp(u, 0, 1);
  const anchor = development.anchorIndex;
  const thetaA = development.theta[anchor]!;
  const points = out.points;
  const normals = out.normals;
  points[anchor * 2] = development.anchorPoint[0];
  points[anchor * 2 + 1] = development.anchorPoint[1];

  const segmentLength = (index: number): number => {
    const halfTurn = (development.theta[index + 1]! - development.theta[index]!) / 2;
    const relaxedHalfTurn = (1 - amount) * halfTurn;
    const sinc =
      Math.abs(relaxedHalfTurn) <= 1e-12 ? 1 : Math.sin(relaxedHalfTurn) / relaxedHalfTurn;
    const correction =
      development.correctedEll[index]! > 0
        ? 1 + amount * (development.deltaS[index]! / development.correctedEll[index]! - 1)
        : 0;
    return development.correctedEll[index]! * sinc * correction;
  };

  for (let index = anchor; index < count - 1; index += 1) {
    const direction = thetaA + (1 - amount) * (development.phi[index]! - thetaA);
    const length = segmentLength(index);
    points[(index + 1) * 2] = points[index * 2]! + length * Math.cos(direction);
    points[(index + 1) * 2 + 1] = points[index * 2 + 1]! + length * Math.sin(direction);
  }
  for (let index = anchor - 1; index >= 0; index -= 1) {
    const direction = thetaA + (1 - amount) * (development.phi[index]! - thetaA);
    const length = segmentLength(index);
    points[index * 2] = points[(index + 1) * 2]! - length * Math.cos(direction);
    points[index * 2 + 1] = points[(index + 1) * 2 + 1]! - length * Math.sin(direction);
  }
  for (let index = 0; index < count; index += 1) {
    const angle = thetaA + (1 - amount) * (development.theta[index]! - thetaA) + Math.PI / 2;
    normals[index * 2] = Math.cos(angle);
    normals[index * 2 + 1] = Math.sin(angle);
  }
}

export function createWallDevelopmentBuffers(development: WallDevelopment): WallDevelopmentBuffers {
  return {
    points: new Float64Array(development.sampleCount * 2),
    normals: new Float64Array(development.sampleCount * 2)
  };
}

/** Map one canonical station through the developed sample polyline at `u`. */
export function developmentPointAtStation(
  development: WallDevelopment,
  u: number,
  station: number
): WallDevelopmentPoint {
  const buffers = createWallDevelopmentBuffers(development);
  evaluateWallDevelopment(development, u, buffers);
  return developmentPointAtStationFromBuffers(development, buffers, station);
}

export function developmentPointAtStationFromBuffers(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers,
  station: number
): WallDevelopmentPoint {
  const target = clamp(station, 0, development.length);
  let low = 0;
  let high = development.sampleCount - 1;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (development.s[middle]! <= target) low = middle;
    else high = middle;
  }
  const startStation = development.s[low]!;
  const endStation = development.s[high]!;
  const span = endStation - startStation;
  const amount = span > DEVELOPMENT_EPSILON ? (target - startStation) / span : 0;
  const startPoint: LayoutVec2 = [buffers.points[low * 2]!, buffers.points[low * 2 + 1]!];
  const endPoint: LayoutVec2 = [buffers.points[high * 2]!, buffers.points[high * 2 + 1]!];
  const startNormal: LayoutVec2 = [buffers.normals[low * 2]!, buffers.normals[low * 2 + 1]!];
  const endNormal: LayoutVec2 = [buffers.normals[high * 2]!, buffers.normals[high * 2 + 1]!];
  const normal = normalizeVector(lerp(startNormal, endNormal, amount), startNormal);
  return {
    point: lerp(startPoint, endPoint, amount),
    normal,
    station: target
  };
}

/**
 * At `u = 1`, the distance from the anchor to a station along the developed
 * straight line. For an open Wall anchored at 0 this is the requested `s`.
 */
export function developmentStationDistanceFromAnchor(
  development: WallDevelopment,
  station: number
): number {
  return station - development.anchorStation;
}

/**
 * Displayed sheet coordinate. Open Walls keep the anchor-relative station;
 * closed Walls rotate the sheet so the display cut is at 0/L (D11).
 */
export function developmentSheetCoordinate(
  development: WallDevelopment,
  station: number
): number {
  if (!development.closed || development.cutStation === null) {
    return station - development.anchorStation;
  }
  return wrap(station - development.cutStation, development.length);
}

export function developmentSheetToStation(
  development: WallDevelopment,
  sheet: number
): number {
  if (!development.closed || development.cutStation === null) {
    return sheet + development.anchorStation;
  }
  return wrap(sheet + development.cutStation, development.length);
}

/**
 * Map a compiled mesh's `(station, offset, height)` attribution through the
 * development at any `u`. The buffers are caller-owned; this is O(vertices)
 * and allocates nothing. `outNormals` receives the developed surface normal.
 */
export function mapAttributedVertices(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers,
  attribution: Float32Array | Float64Array,
  floorY: number,
  outPositions: Float32Array | Float64Array,
  outNormals: Float32Array | Float64Array
): void {
  if (attribution.length % 3 !== 0) {
    throw new Error('Attribution must hold three values per vertex.');
  }
  const vertexCount = attribution.length / 3;
  if (outPositions.length !== vertexCount * 3 || outNormals.length !== vertexCount * 3) {
    throw new Error('Mapped position and normal buffers must hold one XYZ per vertex.');
  }
  countWork('unfold:vertex-map', vertexCount);
  for (let index = 0; index < vertexCount; index += 1) {
    const station = attribution[index * 3]!;
    const lateral = attribution[index * 3 + 1]!;
    const height = attribution[index * 3 + 2]!;
    const mapped = developmentPointAtStationFromBuffers(development, buffers, station);
    outPositions[index * 3] = mapped.point[0] + mapped.normal[0] * lateral;
    outPositions[index * 3 + 1] = floorY + height;
    outPositions[index * 3 + 2] = mapped.point[1] + mapped.normal[1] * lateral;
    outNormals[index * 3] = mapped.normal[0];
    outNormals[index * 3 + 1] = 0;
    outNormals[index * 3 + 2] = mapped.normal[1];
  }
}

/** One displayed sample in sheet order, with its canonical station. */
export type WallDevelopmentDisplaySample = {
  readonly point: LayoutVec2;
  readonly station: number;
  readonly sheet: number;
};

/**
 * The developed centerline in **display order**.
 *
 * Open Walls keep canonical order with `sheet = s - anchor`. A closed Wall is
 * rotated so the display cut is at the sheet ends (D11); the seam remains an
 * interior tick and never splits a sample run. This is the one ordering the
 * inverse map, the face frame and sheet picking consume.
 */
export function developmentDisplaySamples(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers
): WallDevelopmentDisplaySample[] {
  const result: WallDevelopmentDisplaySample[] = [];
  const push = (index: number, station: number, sheet: number): void => {
    const previous = result.at(-1);
    if (previous !== undefined && Math.abs(previous.sheet - sheet) <= DEVELOPMENT_EPSILON) return;
    result.push({
      point: [buffers.points[index * 2]!, buffers.points[index * 2 + 1]!],
      station,
      sheet
    });
  };
  if (!development.closed || development.cutStation === null) {
    for (let index = 0; index < development.sampleCount; index += 1) {
      const station = development.s[index]!;
      push(index, station, station - development.anchorStation);
    }
    return result;
  }
  const cut = development.cutStation;
  const cutIndex = nearestSampleIndex(development, cut);
  push(cutIndex, cut, 0);
  for (let index = 0; index < development.sampleCount; index += 1) {
    const station = development.s[index]!;
    if (station > cut + DEVELOPMENT_EPSILON) push(index, station, station - cut);
  }
  for (let index = 0; index < development.sampleCount; index += 1) {
    const station = development.s[index]!;
    if (station < cut - DEVELOPMENT_EPSILON) {
      push(index, station, development.length - cut + station);
    }
  }
  push(cutIndex, cut, development.length);
  return result;
}

function nearestSampleIndex(development: WallDevelopment, station: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < development.sampleCount; index += 1) {
    const distance = Math.abs(development.s[index]! - station);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

/** The inverse of the developed sheet: a point back to canonical station and face. */
export type WallDevelopmentInversePoint = {
  /** Displayed sheet coordinate, in metres from the display cut (closed) or anchor (open). */
  sheet: number;
  /** Canonical station, modulo L for a closed Wall. */
  station: number;
  /** Signed offset from the developed centerline, positive along its left normal. */
  lateral: number;
  face: 'left' | 'right';
  spanIndex: number;
  startKnotId: string;
  endKnotId: string;
};

/**
 * Map a point in the developed sheet back to the canonical station, span and
 * Wall face. The map is the exact inverse of the displayed centerline's
 * piecewise-linear interpolation: segment projection gives the sheet
 * coordinate, the segment's endpoint stations interpolate to the canonical
 * station, and the signed lateral distance names the face. Outside the sheet
 * the nearest endpoint is returned with its own station, so a drag that leaves
 * the sheet still has a well-defined wall station rather than NaN.
 */
export function developmentInversePoint(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers,
  point: LayoutVec2,
  spans: readonly WallDevelopmentSourceSpan[] = []
): WallDevelopmentInversePoint | null {
  if (!point.every(Number.isFinite)) return null;
  const samples = developmentDisplaySamples(development, buffers);
  if (samples.length < 2) return null;
  let best: WallDevelopmentInversePoint | null = null;
  let bestDistance = Infinity;
  for (let index = 1; index < samples.length; index += 1) {
    const start = samples[index - 1]!;
    const end = samples[index]!;
    const dx = end.point[0] - start.point[0];
    const dz = end.point[1] - start.point[1];
    const length = Math.hypot(dx, dz);
    if (length <= DEVELOPMENT_EPSILON) continue;
    const along = ((point[0] - start.point[0]) * dx + (point[1] - start.point[1]) * dz) / (length * length);
    const t = clamp(along, 0, 1);
    const foot: LayoutVec2 = [start.point[0] + dx * t, start.point[1] + dz * t];
    const distance = Math.hypot(point[0] - foot[0], point[1] - foot[1]);
    if (distance >= bestDistance) continue;
    const sheet = start.sheet + (end.sheet - start.sheet) * t;
    const station = start.station + (end.station - start.station) * t;
    const lateral = ((point[0] - foot[0]) * -dz + (point[1] - foot[1]) * dx) / length;
    const canonicalStation = development.closed ? wrap(station, development.length) : station;
    const span = spanForStation(spans, canonicalStation, development.length, development.closed);
    bestDistance = distance;
    best = {
      sheet,
      station: canonicalStation,
      lateral,
      face: lateral >= 0 ? 'left' : 'right',
      spanIndex: span?.index ?? 0,
      startKnotId: span?.startKnotId ?? '',
      endKnotId: span?.endKnotId ?? ''
    };
  }
  return best;
}

/** A developed face frame: world bounds and the look direction that faces it. */
export type WallDevelopmentFaceFrame = {
  readonly bounds: {
    readonly min: [number, number, number];
    readonly max: [number, number, number];
  };
  /** Camera look direction (eye → face), in world X/Z. */
  readonly look: [number, number, number];
};

/**
 * The world frame that faces a developed Wall face at the current `u`.
 *
 * `side` is `1` for the left face (`+w`, whose exterior normal is the canonical
 * left normal) and `-1` for the right face. The look direction is the inward
 * direction from the eye to the surface, so camera-core can place the eye on
 * `−look` without the editor ever building a pose. The bounds include the
 * developed thickness and the Wall's full height above `floorY`.
 */
export function developmentFaceFrame(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers,
  side: 1 | -1,
  options: { readonly thickness: number; readonly height: number; readonly floorY?: number }
): WallDevelopmentFaceFrame | null {
  const samples = developmentDisplaySamples(development, buffers);
  if (samples.length < 2) return null;
  const half = Math.max(0, options.thickness) / 2;
  const floorY = options.floorY ?? 0;
  const min: [number, number, number] = [Infinity, floorY, Infinity];
  const max: [number, number, number] = [-Infinity, floorY + Math.max(0, options.height), -Infinity];
  for (const sample of samples) {
    min[0] = Math.min(min[0], sample.point[0] - half);
    max[0] = Math.max(max[0], sample.point[0] + half);
    min[2] = Math.min(min[2], sample.point[1] - half);
    max[2] = Math.max(max[2], sample.point[1] + half);
  }
  if (!(max[0] > min[0]) || !(max[2] > min[2])) return null;
  const anchor = development.anchorIndex;
  const nx = buffers.normals[anchor * 2]!;
  const nz = buffers.normals[anchor * 2 + 1]!;
  // The left face (side 1) is looked at from +N; its look direction is −N.
  return { bounds: { min, max }, look: [-side * nx, 0, -side * nz] };
}

/** One canonical Opening band for identity lookup on the developed sheet. */
export type WallDevelopmentOpeningBand = {
  readonly openingId: string;
  readonly stationStart: number;
  readonly stationEnd: number;
  readonly sillHeight: number;
  readonly headHeight: number;
};

/**
 * The Opening identity under a developed point, or `null` for solid Wall.
 * Bands use canonical stations; a closed Wall's interval may wrap the seam. A
 * seam-crossing Opening therefore remains one identity from either fragment.
 */
export function developmentOpeningIdentity(
  development: WallDevelopment,
  bands: readonly WallDevelopmentOpeningBand[],
  station: number,
  height: number
): string | null {
  const target = development.closed ? wrap(station, development.length) : station;
  for (const band of bands) {
    if (height < band.sillHeight - WALL_DEVELOPMENT_TOLERANCE) continue;
    if (height > band.headHeight + WALL_DEVELOPMENT_TOLERANCE) continue;
    const start = development.closed ? wrap(band.stationStart, development.length) : band.stationStart;
    const width = band.stationEnd - band.stationStart;
    if (!(width > 0)) continue;
    if (development.closed) {
      const offset = wrap(target - start, development.length);
      if (offset <= width + WALL_DEVELOPMENT_TOLERANCE) return band.openingId;
    } else if (
      target >= start - WALL_DEVELOPMENT_TOLERANCE &&
      target <= band.stationEnd + WALL_DEVELOPMENT_TOLERANCE
    ) {
      return band.openingId;
    }
  }
  return null;
}

/** Source face lengths, reported for evidence only (D10 — not isometric). */
export function wallDevelopmentFaceLengths(
  development: WallDevelopment,
  thickness: number
): { centerline: number; left: number; right: number } {
  const half = Math.max(0, thickness) / 2;
  let left = 0;
  let right = 0;
  // Offset each sample by its own canonical normal, exactly as the source
  // faces are defined. A curved Wall's two face lengths differ from the
  // centerline; these numbers are evidence, never station coordinates.
  const offsetPoint = (index: number, sign: 1 | -1): LayoutVec2 => {
    const angle = development.theta[index]! + Math.PI / 2;
    return [
      development.points[index * 2]! + sign * half * Math.cos(angle),
      development.points[index * 2 + 1]! + sign * half * Math.sin(angle)
    ];
  };
  for (let index = 0; index < development.sampleCount - 1; index += 1) {
    const left0 = offsetPoint(index, 1);
    const left1 = offsetPoint(index + 1, 1);
    const right0 = offsetPoint(index, -1);
    const right1 = offsetPoint(index + 1, -1);
    left += Math.hypot(left1[0] - left0[0], left1[1] - left0[1]);
    right += Math.hypot(right1[0] - right0[0], right1[1] - right0[1]);
  }
  return { centerline: development.length, left, right };
}

/** Split an Opening into displayed fragments at the display cut. */
export function developmentOpeningFragments(
  development: WallDevelopment,
  opening: WallDevelopmentOpeningInput,
  spans: readonly WallDevelopmentSourceSpan[] = []
): WallDevelopmentOpening {
  if (!(opening.width > 0) || !Number.isFinite(opening.width)) {
    return {
      openingId: opening.openingId,
      stationStart: 0,
      stationEnd: 0,
      width: Math.max(0, opening.width),
      centerStation: 0,
      centerSheet: 0,
      spanIndices: [],
      fragments: []
    };
  }
  const length = development.length;
  const start = development.closed
    ? wrap(opening.offset, length)
    : clamp(opening.offset, 0, Math.max(0, length - opening.width));
  const end = start + opening.width;
  // The display cut is the only discontinuity. The canonical seam is a tick
  // interior to the sheet, so an Opening crossing the seam stays ONE fragment;
  // only an Opening crossing the cut is split (D11).
  const sheetStart = developmentSheetCoordinate(development, start);
  const sheetEnd = sheetStart + opening.width;
  const fragments: WallDevelopmentOpeningFragment[] = [];
  const pushFragment = (a: number, b: number, from: number, to: number): void => {
    if (to - from <= DEVELOPMENT_EPSILON) return;
    fragments.push({
      openingId: opening.openingId,
      index: fragments.length,
      stationStart: a,
      stationEnd: b,
      sheetStart: from,
      sheetEnd: to,
      spanIndices: spanIndicesForInterval(spans, a, b, length, development.closed)
    });
  };
  if (!development.closed || development.cutStation === null || sheetEnd <= length + DEVELOPMENT_EPSILON) {
    pushFragment(start, end, sheetStart, Math.min(length, sheetEnd));
  } else {
    const firstStationSpan = length - sheetStart;
    pushFragment(start, start + firstStationSpan, sheetStart, length);
    pushFragment(start + firstStationSpan, end, 0, sheetEnd - length);
  }
  const centerStation = development.closed ? wrap(start + opening.width / 2, length) : start + opening.width / 2;
  return {
    openingId: opening.openingId,
    stationStart: start,
    stationEnd: end,
    width: opening.width,
    centerStation,
    centerSheet: developmentSheetCoordinate(development, centerStation),
    spanIndices: spanIndicesForInterval(spans, start, end, length, development.closed),
    fragments
  };
}

/**
 * Build the flat displayed strip. `u = 1` is the proof state; the mesh's
 * vertices are attributed to canonical stations and source spans, and every
 * triangle carries its Wall face. The strip is deliberately a display mesh,
 * not a claim that either Wall face is isometric.
 */
export function buildDevelopedWallMesh(
  development: WallDevelopment,
  options: WallDevelopmentMeshOptions
): WallDevelopmentMesh {
  const half = options.thickness / 2;
  const vertices: WallDevelopmentMeshVertex[] = [];
  const triangles: WallDevelopmentMeshTriangle[] = [];
  const stations: Array<{ station: number; sheet: number; spanIndex: number }> = [];
  const trianglesByFace: Record<WallDevelopmentFace, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  const ordered = orderedDevelopmentSamples(development);
  const bounds = {
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number]
  };

  const pushVertex = (station: number, sheet: number, lateral: number, height: number): number => {
    const span = spanForStation(options.spans, station, development.length, development.closed);
    const index = vertices.length;
    vertices.push({
      station,
      sheet,
      lateral,
      height,
      spanIndex: span?.index ?? 0
    });
    bounds.min[0] = Math.min(bounds.min[0], sheet);
    bounds.max[0] = Math.max(bounds.max[0], sheet);
    bounds.min[1] = Math.min(bounds.min[1], -half);
    bounds.max[1] = Math.max(bounds.max[1], half);
    bounds.min[2] = Math.min(bounds.min[2], 0);
    bounds.max[2] = Math.max(bounds.max[2], options.height);
    return index;
  };

  const pushTriangle = (
    a: number,
    b: number,
    c: number,
    face: WallDevelopmentFace,
    stationStart: number,
    stationEnd: number,
    sheetStart: number,
    sheetEnd: number
  ): void => {
    const span = spanForStation(
      options.spans,
      development.closed ? wrap((stationStart + stationEnd) / 2, development.length) : (stationStart + stationEnd) / 2,
      development.length,
      development.closed
    );
    const expected = FACE_NORMALS[face];
    const oriented = orientTriangle(vertices, a, b, c, expected);
    triangles.push({
      indices: oriented,
      face,
      stationStart,
      stationEnd,
      sheetStart,
      sheetEnd,
      spanIndex: span?.index ?? 0,
      startKnotId: span?.startKnotId ?? '',
      endKnotId: span?.endKnotId ?? ''
    });
    trianglesByFace[face] += 1;
  };

  for (const entry of ordered) {
    stations.push({
      station: entry.station,
      sheet: entry.sheet,
      spanIndex: spanForStation(options.spans, entry.station, development.length, development.closed)?.index ?? 0
    });
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    if (ordered[index]!.sheet - previous.sheet <= DEVELOPMENT_EPSILON) continue;
    const start = previous;
    const end = ordered[index]!;
    const lb0 = pushVertex(start.station, start.sheet, -half, 0);
    const lt0 = pushVertex(start.station, start.sheet, -half, options.height);
    const rb0 = pushVertex(start.station, start.sheet, half, 0);
    const rt0 = pushVertex(start.station, start.sheet, half, options.height);
    const lb1 = pushVertex(end.station, end.sheet, -half, 0);
    const lt1 = pushVertex(end.station, end.sheet, -half, options.height);
    const rb1 = pushVertex(end.station, end.sheet, half, 0);
    const rt1 = pushVertex(end.station, end.sheet, half, options.height);
    pushTriangle(lb0, lt0, lt1, 'left', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(lb0, lt1, lb1, 'left', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(rb0, rb1, rt1, 'right', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(rb0, rt1, rt0, 'right', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(lt0, rt0, rt1, 'top', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(lt0, rt1, lt1, 'top', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(lb0, lb1, rb1, 'bottom', start.station, end.station, start.sheet, end.sheet);
    pushTriangle(lb0, rb1, rb0, 'bottom', start.station, end.station, start.sheet, end.sheet);
  }

  return { vertices, triangles, stations, trianglesByFace, bounds };
}

/**
 * Validate the spine and the displayed strip. Every issue names the source span
 * (and knot ids) whenever the failure can be attributed to one.
 */
export function validateWallDevelopment(input: {
  development: WallDevelopment;
  spans?: readonly WallDevelopmentSourceSpan[];
  mesh?: WallDevelopmentMesh;
  openings?: readonly WallDevelopmentOpening[];
}): WallDevelopmentIssue[] {
  const { development } = input;
  const issues: WallDevelopmentIssue[] = [];
  const spans = input.spans ?? [];
  if (spans.length > 0) {
    let sum = 0;
    let previousEnd = -Infinity;
    for (const span of spans) {
      sum += span.arcLength;
      if (Math.abs(span.endStation - span.startStation - span.arcLength) > WALL_DEVELOPMENT_TOLERANCE) {
        issues.push({
          code: 'span_length_mismatch',
          message: `Span ${span.index} arc length ${span.arcLength} does not match its station interval ${span.startStation}..${span.endStation}.`,
          spanIndex: span.index,
          startKnotId: span.startKnotId,
          endKnotId: span.endKnotId,
          station: span.startStation
        });
      }
      if (Number.isFinite(previousEnd) && Math.abs(span.startStation - previousEnd) > WALL_DEVELOPMENT_TOLERANCE) {
        issues.push({
          code: 'span_joint_gap',
          message: `Span ${span.index} starts at ${span.startStation}, not at the previous span end ${previousEnd}.`,
          spanIndex: span.index,
          startKnotId: span.startKnotId,
          endKnotId: span.endKnotId,
          station: span.startStation
        });
      }
      previousEnd = span.endStation;
    }
    if (Math.abs(sum - development.length) > WALL_DEVELOPMENT_TOLERANCE) {
      const last = spans.at(-1)!;
      issues.push({
        code: 'span_length_sum_mismatch',
        message: `Span arc lengths sum to ${sum}, but the centerline length is ${development.length}.`,
        spanIndex: last.index,
        startKnotId: last.startKnotId,
        endKnotId: last.endKnotId,
        station: development.length
      });
    }
  }
  for (let index = 1; index < development.sampleCount; index += 1) {
    if (development.s[index]! < development.s[index - 1]! - WALL_DEVELOPMENT_TOLERANCE) {
      const span = spanForStation(spans, development.s[index]!, development.length, development.closed);
      issues.push({
        code: 'non_monotone_station',
        message: `Sample station ${development.s[index]} follows ${development.s[index - 1]}.`,
        spanIndex: span?.index,
        startKnotId: span?.startKnotId,
        endKnotId: span?.endKnotId,
        station: development.s[index]!
      });
    }
  }
  if (input.mesh) {
    issues.push(...validateDevelopedMesh(development, input.mesh));
  }
  for (const opening of input.openings ?? []) {
    const total = opening.fragments.reduce((sum, fragment) => sum + fragment.sheetEnd - fragment.sheetStart, 0);
    if (Math.abs(total - opening.width) > WALL_DEVELOPMENT_TOLERANCE) {
      issues.push({
        code: 'opening_station_mismatch',
        message: `Opening ${opening.openingId} fragments total ${total}, not its width ${opening.width}.`,
        openingId: opening.openingId,
        station: opening.centerStation
      });
    }
    for (const fragment of opening.fragments) {
      const canonicalLength = fragment.stationEnd - fragment.stationStart;
      const sheetLength = fragment.sheetEnd - fragment.sheetStart;
      if (Math.abs(canonicalLength - sheetLength) > WALL_DEVELOPMENT_TOLERANCE) {
        issues.push({
          code: 'opening_station_mismatch',
          message: `Opening ${opening.openingId} fragment ${fragment.index} maps ${canonicalLength} canonical metres to ${sheetLength} sheet metres.`,
          openingId: opening.openingId,
          station: fragment.stationStart
        });
      }
    }
  }
  return issues;
}

/** Validate one displayed strip independently, including reversed winding. */
export function validateDevelopedMesh(
  development: WallDevelopment,
  mesh: WallDevelopmentMesh
): WallDevelopmentIssue[] {
  const issues: WallDevelopmentIssue[] = [];
  for (let index = 1; index < mesh.stations.length; index += 1) {
    if (mesh.stations[index]!.sheet <= mesh.stations[index - 1]!.sheet + DEVELOPMENT_EPSILON) {
      const station = mesh.stations[index]!.station;
      const span = spanForStation([], station, development.length, development.closed);
      issues.push({
        code: 'non_monotone_station',
        message: `Developed sheet station ${mesh.stations[index]!.sheet} does not advance.`,
        station,
        spanIndex: span?.index
      });
    }
  }
  for (const triangle of mesh.triangles) {
    const [a, b, c] = triangle.indices;
    const va = mesh.vertices[a]!;
    const vb = mesh.vertices[b]!;
    const vc = mesh.vertices[c]!;
    const normal = cross(
      [vb.sheet - va.sheet, vb.lateral - va.lateral, vb.height - va.height],
      [vc.sheet - va.sheet, vc.lateral - va.lateral, vc.height - va.height]
    );
    const expected = FACE_NORMALS[triangle.face];
    const dot = normal[0] * expected[0] + normal[1] * expected[1] + normal[2] * expected[2];
    if (!(dot > DEVELOPMENT_EPSILON)) {
      issues.push({
        code: 'inverted_face',
        message: `Triangle on ${triangle.face} face is degenerate or wound against its face normal.`,
        spanIndex: triangle.spanIndex,
        startKnotId: triangle.startKnotId,
        endKnotId: triangle.endKnotId,
        station: triangle.stationStart
      });
    }
    if (triangle.sheetEnd <= triangle.sheetStart + DEVELOPMENT_EPSILON) {
      issues.push({
        code: 'mesh_station_gap',
        message: `Triangle on ${triangle.face} has no station advance.`,
        spanIndex: triangle.spanIndex,
        startKnotId: triangle.startKnotId,
        endKnotId: triangle.endKnotId,
        station: triangle.stationStart
      });
    }
  }
  return issues;
}

/**
 * First self-overlap between the developed centerline and its two offset
 * faces. This is the display strip's guard for `0 < u < 1`; `u = 0` is the
 * canonical valid state and `u = 1` is a straight band, so both return no
 * overlap. The station pair names the two developed pieces that meet.
 */
export function developmentOverlap(
  development: WallDevelopment,
  buffers: WallDevelopmentBuffers,
  thickness: number
): { overlaps: false } | { overlaps: true; stations: [number, number] } {
  const half = Math.max(0, thickness) / 2;
  const lines: Array<{ points: LayoutVec2[]; stations: number[] }> = [
    { points: [], stations: [] },
    { points: [], stations: [] },
    { points: [], stations: [] }
  ];
  for (let index = 0; index < development.sampleCount; index += 1) {
    const point: LayoutVec2 = [buffers.points[index * 2]!, buffers.points[index * 2 + 1]!];
    const normal: LayoutVec2 = [buffers.normals[index * 2]!, buffers.normals[index * 2 + 1]!];
    lines[0]!.points.push(point);
    lines[0]!.stations.push(development.s[index]!);
    lines[1]!.points.push([point[0] + half * normal[0], point[1] + half * normal[1]]);
    lines[1]!.stations.push(development.s[index]!);
    lines[2]!.points.push([point[0] - half * normal[0], point[1] - half * normal[1]]);
    lines[2]!.stations.push(development.s[index]!);
  }
  for (const line of lines) {
    const hit = firstPolylineSelfIntersection(line.points, line.stations);
    if (hit) return { overlaps: true, stations: hit };
  }
  return { overlaps: false };
}

/** The source span containing a station, modulo L for a closed Wall. */
export function spanForStation(
  spans: readonly WallDevelopmentSourceSpan[],
  station: number,
  length: number,
  closed: boolean
): WallDevelopmentSourceSpan | undefined {
  if (spans.length === 0) return undefined;
  const target = closed ? wrap(station, length) : clamp(station, 0, length);
  for (const span of spans) {
    if (target >= span.startStation - DEVELOPMENT_EPSILON && target < span.endStation - DEVELOPMENT_EPSILON) {
      return span;
    }
  }
  return spans.at(-1);
}

/** Required by the proof suite: source spans in display order, cut at the seam. */
export function orderedDevelopmentSamples(
  development: WallDevelopment
): Array<{ station: number; sheet: number }> {
  const result: Array<{ station: number; sheet: number }> = [];
  const push = (station: number, sheet: number): void => {
    const previous = result.at(-1);
    if (previous && Math.abs(previous.sheet - sheet) <= DEVELOPMENT_EPSILON) return;
    result.push({ station, sheet });
  };
  if (!development.closed || development.cutStation === null) {
    for (let index = 0; index < development.sampleCount; index += 1) {
      const station = development.s[index]!;
      push(station, station - development.anchorStation);
    }
    return result;
  }
  const cut = development.cutStation;
  push(cut, 0);
  for (let index = 0; index < development.sampleCount; index += 1) {
    const station = development.s[index]!;
    if (station > cut + DEVELOPMENT_EPSILON) {
      push(station, station - cut);
    }
  }
  for (let index = 0; index < development.sampleCount; index += 1) {
    const station = development.s[index]!;
    if (station < cut - DEVELOPMENT_EPSILON) {
      push(station, development.length - cut + station);
    }
  }
  push(cut, development.length);
  return result;
}

function insertAnchor(
  samples: readonly CurveSample[],
  station: number
): { samples: CurveSample[]; anchorIndex: number } {
  let low = 0;
  let high = samples.length - 1;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (samples[middle]!.distance <= station) low = middle;
    else high = middle;
  }
  if (Math.abs(samples[low]!.distance - station) <= DEVELOPMENT_EPSILON) {
    return { samples: [...samples], anchorIndex: low };
  }
  if (Math.abs(samples[high]!.distance - station) <= DEVELOPMENT_EPSILON) {
    return { samples: [...samples], anchorIndex: high };
  }
  const start = samples[low]!;
  const end = samples[high]!;
  const span = end.distance - start.distance;
  const amount = span > DEVELOPMENT_EPSILON ? (station - start.distance) / span : 0;
  const normal = normalizeVector(lerp(start.normal, end.normal, amount), start.normal);
  const tangent = normalizeVector(lerp(start.tangent, end.tangent, amount), start.tangent);
  const inserted: CurveSample = {
    point: lerp(start.point, end.point, amount),
    distance: station,
    tangent,
    normal,
    t: start.t + (end.t - start.t) * amount
  };
  const next = [...samples];
  next.splice(high, 0, inserted);
  return { samples: next, anchorIndex: high };
}

function spanIndicesForInterval(
  spans: readonly WallDevelopmentSourceSpan[],
  start: number,
  end: number,
  length: number,
  closed: boolean
): number[] {
  if (spans.length === 0) return [];
  const result: number[] = [];
  const visit = (a: number, b: number): void => {
    for (const span of spans) {
      if (b <= span.startStation + DEVELOPMENT_EPSILON || a >= span.endStation - DEVELOPMENT_EPSILON) continue;
      if (!result.includes(span.index)) result.push(span.index);
    }
  };
  if (closed && end > length + DEVELOPMENT_EPSILON) {
    visit(start, length);
    visit(0, end - length);
  } else {
    visit(start, Math.min(end, length));
  }
  return result.sort((a, b) => a - b);
}

function firstPolylineSelfIntersection(
  points: readonly LayoutVec2[],
  stations: readonly number[]
): [number, number] | null {
  const count = points.length - 1;
  if (count < 3) return null;
  const closedLoop =
    Math.hypot(
      points[0]![0] - points.at(-1)![0],
      points[0]![1] - points.at(-1)![1]
    ) <= WALL_DEVELOPMENT_TOLERANCE;
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 2; right < count; right += 1) {
      // Only a closed loop's first and last segments are neighbours; an open
      // polyline's ends are unrelated and must be tested.
      if (closedLoop && left === 0 && right === count - 1) continue;
      if (
        segmentsIntersect(
          points[left]!,
          points[left + 1]!,
          points[right]!,
          points[right + 1]!
        )
      ) {
        return [stations[left]!, stations[right]!];
      }
    }
  }
  return null;
}

function segmentsIntersect(a0: LayoutVec2, a1: LayoutVec2, b0: LayoutVec2, b1: LayoutVec2): boolean {
  const d1 = orientation(a0, a1, b0);
  const d2 = orientation(a0, a1, b1);
  const d3 = orientation(b0, b1, a0);
  const d4 = orientation(b0, b1, a1);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function orientation(a: LayoutVec2, b: LayoutVec2, c: LayoutVec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

const FACE_NORMALS: Record<WallDevelopmentFace, [number, number, number]> = {
  left: [0, -1, 0],
  right: [0, 1, 0],
  top: [0, 0, 1],
  bottom: [0, 0, -1]
};

function orientTriangle(
  vertices: readonly WallDevelopmentMeshVertex[],
  a: number,
  b: number,
  c: number,
  expected: readonly [number, number, number]
): [number, number, number] {
  const va = vertices[a]!;
  const vb = vertices[b]!;
  const vc = vertices[c]!;
  const normal = cross(
    [vb.sheet - va.sheet, vb.lateral - va.lateral, vb.height - va.height],
    [vc.sheet - va.sheet, vc.lateral - va.lateral, vc.height - va.height]
  );
  const dot = normal[0] * expected[0] + normal[1] * expected[1] + normal[2] * expected[2];
  return dot >= 0 ? [a, b, c] : [a, c, b];
}

function cross(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function unwrapAngle(angle: number, previous: number): number {
  let result = angle;
  while (result - previous > Math.PI) result -= TAU;
  while (result - previous < -Math.PI) result += TAU;
  return result;
}

function wrap(value: number, length: number): number {
  if (!(length > 0)) return 0;
  const result = value % length;
  return result < 0 ? result + length : result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: LayoutVec2, b: LayoutVec2, amount: number): LayoutVec2 {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function normalizeVector(vector: LayoutVec2, fallback: LayoutVec2): LayoutVec2 {
  const magnitude = Math.hypot(vector[0], vector[1]);
  return magnitude > CURVE_ENDPOINT_EPSILON ? [vector[0] / magnitude, vector[1] / magnitude] : [...fallback];
}
