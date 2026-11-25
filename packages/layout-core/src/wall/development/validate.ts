import type { LayoutVec2 } from '../../geometry/coordinates';
import { FACE_NORMALS, cross } from './mesh';
import { DEVELOPMENT_EPSILON, firstPolylineSelfIntersection, spanForStation } from './shared';
import type { WallDevelopment, WallDevelopmentBuffers, WallDevelopmentIssue, WallDevelopmentMesh, WallDevelopmentOpening, WallDevelopmentSheetBuffers, WallDevelopmentSourceSpan } from './types';
import { WALL_DEVELOPMENT_TOLERANCE } from './types';

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
  thickness: number,
  sheet?: WallDevelopmentSheetBuffers
): { overlaps: false } | { overlaps: true; stations: [number, number] } {
  const half = Math.max(0, thickness) / 2;
  const lines: Array<{ points: LayoutVec2[]; stations: number[] }> = [
    { points: [], stations: [] },
    { points: [], stations: [] },
    { points: [], stations: [] }
  ];
  // A closed Wall is displayed cut-to-cut, so its live guard must walk the
  // sheet buffers; the canonical-order buffer has no second cut copy and would
  // report a false hook at the seam once the loop begins to open.
  const count = sheet === undefined ? development.sampleCount : sheet.sheet.length;
  for (let index = 0; index < count; index += 1) {
    const point: LayoutVec2 = sheet === undefined
      ? [buffers.points[index * 2]!, buffers.points[index * 2 + 1]!]
      : [sheet.points[index * 2]!, sheet.points[index * 2 + 1]!];
    const normal: LayoutVec2 = sheet === undefined
      ? [buffers.normals[index * 2]!, buffers.normals[index * 2 + 1]!]
      : [sheet.normals[index * 2]!, sheet.normals[index * 2 + 1]!];
    const station = sheet === undefined ? development.s[index]! : sheet.stations[index]!;
    lines[0]!.points.push(point);
    lines[0]!.stations.push(station);
    lines[1]!.points.push([point[0] + half * normal[0], point[1] + half * normal[1]]);
    lines[1]!.stations.push(station);
    lines[2]!.points.push([point[0] - half * normal[0], point[1] - half * normal[1]]);
    lines[2]!.stations.push(station);
  }
  for (const line of lines) {
    const hit = firstPolylineSelfIntersection(line.points, line.stations);
    if (hit) return { overlaps: true, stations: hit };
  }
  return { overlaps: false };
}
