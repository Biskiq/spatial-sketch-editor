import type { LayoutVec2 } from '../../geometry/coordinates';
import { DEVELOPMENT_EPSILON, clamp, spanForStation, wrap } from './shared';
import type { WallDevelopment, WallDevelopmentBuffers, WallDevelopmentDisplaySample, WallDevelopmentFaceFrame, WallDevelopmentInversePoint, WallDevelopmentSourceSpan } from './types';

/**
 * The developed centerline in **display order**.
 *
 * Open Walls keep canonical order with `sheet = s - anchor`. A closed Wall is
 * rotated so the display cut is at the sheet ends; the seam remains an
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
