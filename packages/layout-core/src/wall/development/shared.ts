import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CurveSample } from '../../geometry/curve';
import { CURVE_ENDPOINT_EPSILON } from '../../geometry/curve';
import type { WallDevelopment, WallDevelopmentSourceSpan } from './types';
import { WALL_DEVELOPMENT_TOLERANCE } from './types';

export const DEVELOPMENT_EPSILON = 1e-9;

const TAU = Math.PI * 2;


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


export function insertAnchor(
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


export function spanIndicesForInterval(
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


export function firstPolylineSelfIntersection(
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


export function unwrapAngle(angle: number, previous: number): number {
  let result = angle;
  while (result - previous > Math.PI) result -= TAU;
  while (result - previous < -Math.PI) result += TAU;
  return result;
}


/** Wrap an angle into (−π, π], the shortest signed turn. */
export function wrapSignedAngle(angle: number): number {
  const wrapped = wrap(angle + Math.PI, TAU) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}


/** Move an angle by whole turns to the branch nearest a reference angle. */
export function nearestAngle(angle: number, reference: number): number {
  return angle + TAU * Math.round((reference - angle) / TAU);
}


export function wrap(value: number, length: number): number {
  if (!(length > 0)) return 0;
  const result = value % length;
  return result < 0 ? result + length : result;
}


export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


export function lerp(a: LayoutVec2, b: LayoutVec2, amount: number): LayoutVec2 {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}


export function normalizeVector(vector: LayoutVec2, fallback: LayoutVec2): LayoutVec2 {
  const magnitude = Math.hypot(vector[0], vector[1]);
  return magnitude > CURVE_ENDPOINT_EPSILON ? [vector[0] / magnitude, vector[1] / magnitude] : [...fallback];
}
