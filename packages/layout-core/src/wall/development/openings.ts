import type { LayoutVec2 } from '../../geometry/coordinates';
import { DEVELOPMENT_EPSILON, clamp, spanIndicesForInterval, wrap } from './shared';
import { developmentSheetCoordinate } from './sheet';
import type { WallDevelopment, WallDevelopmentOpening, WallDevelopmentOpeningBand, WallDevelopmentOpeningFragment, WallDevelopmentOpeningInput, WallDevelopmentSourceSpan } from './types';
import { WALL_DEVELOPMENT_TOLERANCE } from './types';

/** The Opening's compiled top elevation at a local station offset. */
export function developmentOpeningTopAt(
  band: WallDevelopmentOpeningBand,
  localStation: number
): number {
  if (band.topBoundary === undefined || band.topBoundary.length === 0) return band.headHeight;
  const width = band.stationEnd - band.stationStart;
  const local = Math.min(width, Math.max(0, localStation));
  const points = band.topBoundary;
  if (local <= points[0]![0]! + WALL_DEVELOPMENT_TOLERANCE) {
    return band.sillHeight + points[0]![1]!;
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (local > current[0]! + WALL_DEVELOPMENT_TOLERANCE) continue;
    const span = current[0]! - previous[0]!;
    const amount = span > WALL_DEVELOPMENT_TOLERANCE ? (local - previous[0]!) / span : 0;
    return band.sillHeight + previous[1]! + (current[1]! - previous[1]!) * amount;
  }
  return band.sillHeight + points.at(-1)![1]!;
}


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
    const start = development.closed ? wrap(band.stationStart, development.length) : band.stationStart;
    const width = band.stationEnd - band.stationStart;
    if (!(width > 0)) continue;
    if (development.closed) {
      const offset = wrap(target - start, development.length);
      if (offset > width + WALL_DEVELOPMENT_TOLERANCE) continue;
      if (height <= developmentOpeningTopAt(band, offset) + WALL_DEVELOPMENT_TOLERANCE) return band.openingId;
    } else if (
      target >= start - WALL_DEVELOPMENT_TOLERANCE &&
      target <= band.stationEnd + WALL_DEVELOPMENT_TOLERANCE &&
      height <= developmentOpeningTopAt(band, target - start) + WALL_DEVELOPMENT_TOLERANCE
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
  // only an Opening crossing the cut is split.
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
