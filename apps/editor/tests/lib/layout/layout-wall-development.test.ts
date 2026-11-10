/**
 * C3 checkpoint 4 — the general Wall-unfolding proof suite.
 *
 * Every geometry named by the owner is exercised through the ONE development
 * map in `layout-wall-development.ts`: straight, multi-Bézier, S-curve,
 * inflection chain and closed circle. The assertions are measured, not
 * statements of intent: u = 0 reproduces the canonical samples, u = 1 places a
 * station `s` exactly `s - anchor` along the developed line, span lengths sum
 * to the centerline, the developed strip has no inversion, and Openings map by
 * the same station system (with the closed display cut splitting only the cut).
 *
 * The final face-length assertion is deliberately an inequality: D10 claims
 * the centerline only. The outer and inner source faces of a circle measure
 * longer and shorter than the centerline, so no code here may call both faces
 * isometric.
 */
import { describe, expect, it } from 'vitest';

import {
  buildDevelopedWallMesh,
  compileWallFirstLayoutGeometry,
  createClosedWallCircleDocument,
  createEmptyWallFirstLayoutDocument,
  cubicBezierArcLength,
  deriveChainSpans,
  developmentOpeningFragments,
  developmentOverlap,
  developmentPointAtStationFromBuffers,
  developmentSheetCoordinate,
  developmentSheetToStation,
  developmentStationDistanceFromAnchor,
  evaluateWallDevelopment,
  LAYOUT_WALL_FIRST_FORMAT_VERSION,
  mapAttributedVertices,
  mintLayoutIdCapture,
  planCreateWallFirstOpening,
  pointAtDistance,
  prepareWallDevelopment,
  setWorkObserver,
  type CurveSample,
  validateDevelopedMesh,
  validateWallDevelopment,
  wallCenterlineCubics,
  wallCenterlineSamples,
  wallCubicChain,
  wallDevelopmentFaceLengths,
  createWallDevelopmentBuffers,
  createWallDevelopmentSheetBuffers,
  evaluateWallDevelopmentSheet,
  type LayoutDocumentWallFirst,
  type LayoutVec2,
  type LayoutWall,
  type LayoutWallCubicSpan,
  type LayoutWallCurveKnot,
  type WallDevelopment,
  type WallDevelopmentSourceSpan
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

type Fixture = {
  label: string;
  document: LayoutDocumentWallFirst;
  wallId: string;
  closed: boolean;
  thickness: number;
  height: number;
  /** Anchors the table's start/middle/end cases. */
  anchors: number[];
  hasPositiveAndNegativeCurvature?: boolean;
};

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
  return points.map((point, index) => ({
    id: `wall-a:knot:${index + 1}`,
    point: [point[0], point[1]] as LayoutVec2
  }));
}

function chainOf(
  start: LayoutVec2,
  end: LayoutVec2,
  interior: LayoutVec2[],
  spans?: LayoutWallCubicSpan[]
): LayoutWall['centerline'] {
  return wallCubicChain(knotsOf(...interior), spans ?? deriveChainSpans([start, ...interior, end]));
}

function documentOf(centerline: LayoutWall['centerline'], start: LayoutVec2, end: LayoutVec2): LayoutDocumentWallFirst {
  const document = createEmptyWallFirstLayoutDocument();
  document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
  document.junctions = [
    { id: 'j-a', point: [start[0], start[1]] },
    { id: 'j-b', point: [end[0], end[1]] }
  ];
  document.walls = [
    {
      id: 'wall-a',
      startJunctionId: 'j-a',
      endJunctionId: 'j-b',
      thickness: 0.2,
      height: 3,
      centerline
    } as LayoutWall
  ];
  return document;
}

function straightFixture(): Fixture {
  return {
    label: 'straight one-span Wall',
    document: documentOf({ kind: 'line' }, [0, 0], [6, 0]),
    wallId: 'wall-a',
    closed: false,
    thickness: 0.2,
    height: 3,
    anchors: [0, 3, 6]
  };
}

function multiFixture(): Fixture {
  const points: LayoutVec2[] = [
    [0, 0],
    [2, 1.5],
    [4, -1],
    [6, 1],
    [8, -1],
    [10, 1.2],
    [12, 0]
  ];
  return {
    label: 'six-knot mixed-curvature chain',
    document: documentOf(chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)), points[0]!, points.at(-1)!),
    wallId: 'wall-a',
    closed: false,
    thickness: 0.3,
    height: 3,
    anchors: [0, 6, 12],
    hasPositiveAndNegativeCurvature: true
  };
}

function sCurveFixture(): Fixture {
  const points: LayoutVec2[] = [
    [0, 0],
    [1.5, 2.5],
    [4.5, -2.5],
    [6, 0]
  ];
  return {
    label: 'S-curve with an inflection',
    document: documentOf(chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)), points[0]!, points.at(-1)!),
    wallId: 'wall-a',
    closed: false,
    thickness: 0.25,
    height: 3,
    anchors: [0, 3, 6],
    hasPositiveAndNegativeCurvature: true
  };
}

function inflectionFixture(): Fixture {
  // One explicitly authored cubic with an S-shaped control polygon. A single
  // span is still a legal canonical chain, and its curvature changes sign.
  const span: LayoutWallCubicSpan = {
    handleOut: [1.5, 3],
    handleIn: [4.5, -3]
  };
  return {
    label: 'single-cubic inflection',
    document: documentOf(wallCubicChain([], [span]), [0, 0], [6, 0]),
    wallId: 'wall-a',
    closed: false,
    thickness: 0.2,
    height: 3,
    anchors: [0, 3, 6],
    hasPositiveAndNegativeCurvature: true
  };
}

function circleFixture(): Fixture {
  const created = createClosedWallCircleDocument({
    center: [0, 0],
    rim: [5, 0],
    junctionId: 'j-circle',
    wallId: 'wall-circle',
    thickness: 0.2,
    height: 3
  });
  if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
  return {
    label: 'closed 16-span circle r=5',
    document: created.document,
    wallId: 'wall-circle',
    closed: true,
    thickness: 0.2,
    height: 3,
    anchors: [0, Math.PI * 5, Math.PI * 10]
  };
}

function allFixtures(): Fixture[] {
  return [straightFixture(), multiFixture(), sCurveFixture(), inflectionFixture(), circleFixture()];
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
  return document.walls.find((wall) => wall.id === wallId)!;
}

function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): LayoutVec2 {
  return document.junctions.find((junction) => junction.id === junctionId)!.point;
}

function spansOf(
  document: LayoutDocumentWallFirst,
  wall: LayoutWall,
  development: WallDevelopment
): WallDevelopmentSourceSpan[] {
  const start = junctionPoint(document, wall.startJunctionId);
  const end = junctionPoint(document, wall.endJunctionId);
  if (wall.centerline.kind === 'line') {
    return [
      {
        index: 0,
        startKnotId: wall.startJunctionId,
        endKnotId: wall.endJunctionId,
        startStation: 0,
        endStation: development.length,
        arcLength: development.length
      }
    ];
  }
  const centerline = wall.centerline;
  const cubics = wallCenterlineCubics(centerline, start, end, 'forward');
  let station = 0;
  return cubics.map((cubic, index) => {
    const arcLength = cubicBezierArcLength(cubic);
    const span: WallDevelopmentSourceSpan = {
      index,
      startKnotId: index === 0 ? wall.startJunctionId : centerline.knots[index - 1]!.id,
      endKnotId: index === cubics.length - 1 ? wall.endJunctionId : centerline.knots[index]!.id,
      startStation: station,
      endStation: station + arcLength,
      arcLength
    };
    station += arcLength;
    return span;
  });
}

function prepareFixture(fixture: Fixture, anchorStation = fixture.anchors[0]!, cutStation?: number) {
  const wall = wallOf(fixture.document, fixture.wallId);
  const start = junctionPoint(fixture.document, wall.startJunctionId);
  const end = junctionPoint(fixture.document, wall.endJunctionId);
  const sampled = wallCenterlineSamples(wall, start, end, 'forward');
  if (!sampled) throw new Error(`Could not sample ${fixture.label}`);
  const prepared = prepareWallDevelopment({
    wallId: wall.id,
    samples: sampled.samples,
    closed: fixture.closed,
    anchorStation,
    ...(cutStation === undefined ? {} : { cutStation })
  });
  if ('refused' in prepared) throw new Error(`${fixture.label}: ${prepared.message}`);
  return {
    wall,
    sampled,
    development: prepared,
    spans: spansOf(fixture.document, wall, prepared)
  };
}

function buffersAt(development: WallDevelopment, u: number) {
  const buffers = createWallDevelopmentBuffers(development);
  evaluateWallDevelopment(development, u, buffers);
  return buffers;
}

function pointAt(
  development: WallDevelopment,
  buffers: ReturnType<typeof buffersAt>,
  station: number
): LayoutVec2 {
  return developmentPointAtStationFromBuffers(development, buffers, station).point;
}

function wrap(value: number, length: number): number {
  const result = value % length;
  return result < 0 ? result + length : result;
}

function distance(a: LayoutVec2, b: LayoutVec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe('C3 checkpoint 4 — general Wall development proof', () => {
  it.each(allFixtures().map((fixture) => [fixture.label, fixture] as const))(
    'maps canonical stations and reproduces the source geometry: %s',
    (_label, fixture) => {
      for (const anchor of fixture.anchors) {
        const { development, sampled, spans } = prepareFixture(fixture, anchor);
        expect(validateWallDevelopment({ development, spans })).toEqual([]);

        // u = 0 is the canonical state: every evaluated sample equals the
        // sampler's point, within the committed 1e-9 m proof tolerance.
        const zero = buffersAt(development, 0);
        let maxZeroError = 0;
        let maxZeroIndex = 0;
        for (let index = 0; index < development.sampleCount; index += 1) {
          const point: LayoutVec2 = [zero.points[index * 2]!, zero.points[index * 2 + 1]!];
          // The preparation may insert the anchor into the sample list, so
          // compare by canonical station rather than by array index.
          const canonical = pointAtDistance(sampled, development.s[index]!).point;
          const error = distance(point, canonical);
          if (error > maxZeroError) {
            maxZeroError = error;
            maxZeroIndex = index;
          }
        }
        expect(maxZeroError).toBeLessThan(1e-9);

        // u = 1 is the straight sheet: station s is exactly s - anchor from
        // the anchor, and there is no perpendicular residual.
        const one = buffersAt(development, 1);
        const direction: LayoutVec2 = [
          Math.cos(development.anchorDirection),
          Math.sin(development.anchorDirection)
        ];
        const normal: LayoutVec2 = [-direction[1], direction[0]];
        let maxStationError = 0;
        let maxPerpendicularError = 0;
        for (const station of development.s) {
          const point = pointAt(development, one, station);
          const dx = point[0] - development.anchorPoint[0];
          const dz = point[1] - development.anchorPoint[1];
          const along = dx * direction[0] + dz * direction[1];
          const across = dx * normal[0] + dz * normal[1];
          maxStationError = Math.max(
            maxStationError,
            Math.abs(along - developmentStationDistanceFromAnchor(development, station))
          );
          maxPerpendicularError = Math.max(maxPerpendicularError, Math.abs(across));
        }
        expect(maxStationError).toBeLessThan(1e-9);
        expect(maxPerpendicularError).toBeLessThan(1e-9);

        // The sheet coordinate and its inverse preserve the canonical station.
        let maxRoundTrip = 0;
        for (const station of development.s) {
          const sheet = developmentSheetCoordinate(development, station);
          const back = developmentSheetToStation(development, sheet);
          const expected = fixture.closed ? wrap(station, development.length) : station;
          const actual = fixture.closed ? wrap(back, development.length) : back;
          maxRoundTrip = Math.max(maxRoundTrip, Math.abs(actual - expected));
        }
        expect(maxRoundTrip).toBeLessThan(1e-9);

        // The display cut is opposite the anchor, and the canonical seam is a
        // tick on the sheet, never a moved or renumbered Junction.
        if (fixture.closed) {
          expect(development.cutStation).not.toBeNull();
          expect(
            Math.abs(
              wrap(development.cutStation! - development.anchorStation, development.length) -
                development.length / 2
            )
          ).toBeLessThan(1e-9);
          const seamSheet = developmentSheetCoordinate(development, 0);
          expect(Math.abs(seamSheet - wrap(-development.cutStation!, development.length))).toBeLessThan(1e-9);
        } else {
          expect(development.cutStation).toBeNull();
        }
      }
    }
  );

  it('measures span sums, monotone joints and every developed face attribution', () => {
    for (const fixture of allFixtures()) {
      const { development, spans } = prepareFixture(fixture);
      const sum = spans.reduce((total, span) => total + span.arcLength, 0);
      expect(Math.abs(sum - development.length)).toBeLessThan(1e-6);
      for (let index = 0; index < spans.length; index += 1) {
        const span = spans[index]!;
        expect(span.endStation - span.startStation).toBeCloseTo(span.arcLength, 9);
        if (index > 0) expect(span.startStation).toBeCloseTo(spans[index - 1]!.endStation, 9);
      }
      for (let index = 1; index < development.sampleCount; index += 1) {
        expect(development.s[index]!).toBeGreaterThanOrEqual(development.s[index - 1]! - 1e-12);
      }

      const mesh = buildDevelopedWallMesh(development, {
        thickness: fixture.thickness,
        height: fixture.height,
        spans
      });
      expect(mesh.triangles.length).toBeGreaterThan(0);
      expect(validateDevelopedMesh(development, mesh)).toEqual([]);
      expect(mesh.trianglesByFace.left).toBeGreaterThan(0);
      expect(mesh.trianglesByFace.right).toBeGreaterThan(0);
      expect(mesh.trianglesByFace.top).toBeGreaterThan(0);
      expect(mesh.trianglesByFace.bottom).toBeGreaterThan(0);

      const half = fixture.thickness / 2 + 1e-6;
      for (const vertex of mesh.vertices) {
        expect(Math.abs(vertex.lateral)).toBeLessThanOrEqual(half);
        expect(vertex.height).toBeGreaterThanOrEqual(-1e-9);
        expect(vertex.height).toBeLessThanOrEqual(fixture.height + 1e-9);
        expect(vertex.spanIndex).toBeGreaterThanOrEqual(0);
        expect(vertex.spanIndex).toBeLessThan(spans.length);
      }
      for (const triangle of mesh.triangles) {
        const span = spans[triangle.spanIndex]!;
        expect(triangle.startKnotId).toBe(span.startKnotId);
        expect(triangle.endKnotId).toBe(span.endKnotId);
        expect(triangle.sheetEnd).toBeGreaterThan(triangle.sheetStart);
      }

      // A deliberately reversed triangle must be reported against the span it
      // belongs to, not as a bare coordinate.
      const broken = {
        ...mesh,
        triangles: mesh.triangles.map((triangle, index) =>
          index === 0
            ? {
                ...triangle,
                indices: [triangle.indices[0], triangle.indices[2], triangle.indices[1]] as [
                  number,
                  number,
                  number
                ]
              }
            : triangle
        )
      };
      const brokenIssues = validateDevelopedMesh(development, broken);
      expect(
        brokenIssues.some(
          (issue) =>
            issue.code === 'inverted_face' &&
            issue.spanIndex === mesh.triangles[0]!.spanIndex &&
            issue.startKnotId === mesh.triangles[0]!.startKnotId
        )
      ).toBe(true);

      // A bad span length is attributed to that span's index and knots.
      const badSpans = spans.map((span, index) =>
        index === 0 ? { ...span, arcLength: span.arcLength + 0.01 } : span
      );
      const spanIssues = validateWallDevelopment({ development, spans: badSpans });
      expect(
        spanIssues.some(
          (issue) =>
            issue.code === 'span_length_mismatch' &&
            issue.spanIndex === 0 &&
            issue.startKnotId === spans[0]!.startKnotId
        )
      ).toBe(true);
    }
  });

  it('maps builder attribution back to canonical compiled positions at u = 0', () => {
    for (const fixture of allFixtures()) {
      const compilation = compileWallFirstLayoutGeometry(fixture.document);
      const compiled = compilation.geometry.walls.find((wall) => wall.wallId === fixture.wallId)!;
      // Isolated display build: free ends are square caps, so no Junction
      // resolution is needed. Interior sections, jambs, sills and reveals are
      // the same emitted faces the retained mesh uses.
      const isolated = {
        ...compiled,
        startJunctionId: undefined,
        endJunctionId: undefined
      };
      const built = buildStandaloneWallMesh(isolated, 0, null, { attribution: true });
      expect(built.issues).toEqual([]);
      const mesh = built.mesh!;
      expect(mesh.attribution).toBeDefined();
      expect(mesh.attributionExact).toBeDefined();
      expect(mesh.attributionSourcePositions).toBeDefined();
      const attribution = mesh.attributionExact!;
      const sourcePositions = mesh.attributionSourcePositions!;
      expect(mesh.attribution!.length).toBe(mesh.positions.length);
      expect(attribution.length).toBe(mesh.positions.length);
      expect(sourcePositions.length).toBe(mesh.positions.length);

      const prepared = prepareWallDevelopment({
        wallId: compiled.wallId,
        samples: compiled.samples,
        closed: fixture.closed,
        anchorStation: 0
      });
      if ('refused' in prepared) throw new Error(prepared.message);
      const buffers = buffersAt(prepared, 0);
      const mappedPositions = new Float64Array(attribution.length);
      const mappedNormals = new Float64Array(attribution.length);
      mapAttributedVertices(prepared, buffers, attribution, 0, mappedPositions, mappedNormals);

      const half = fixture.thickness / 2 + 1e-6;
      let maxPositionError = 0;
      for (let vertex = 0; vertex < attribution.length / 3; vertex += 1) {
        const s = attribution[vertex * 3]!;
        const w = attribution[vertex * 3 + 1]!;
        const y = attribution[vertex * 3 + 2]!;
        expect(Number.isFinite(s)).toBe(true);
        expect(Number.isFinite(w)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(-1e-6);
        expect(s).toBeLessThanOrEqual(prepared.length + 1e-6);
        expect(Math.abs(w)).toBeLessThanOrEqual(half);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeLessThanOrEqual(fixture.height + 1e-6);
        maxPositionError = Math.max(
          maxPositionError,
          Math.hypot(
            mappedPositions[vertex * 3]! - sourcePositions[vertex * 3]!,
            mappedPositions[vertex * 3 + 1]! - sourcePositions[vertex * 3 + 1]!,
            mappedPositions[vertex * 3 + 2]! - sourcePositions[vertex * 3 + 2]!
          )
        );
      }
      expect(maxPositionError).toBeLessThan(1e-9);
    }
  });

  it('proves curvature changes sign on the inflection fixtures and not on the straight Wall', () => {
    for (const fixture of allFixtures()) {
      const { development } = prepareFixture(fixture);
      const turns: number[] = [];
      for (let index = 0; index < development.sampleCount - 1; index += 1) {
        turns.push(development.theta[index + 1]! - development.theta[index]!);
      }
      const positive = turns.some((turn) => turn > 1e-6);
      const negative = turns.some((turn) => turn < -1e-6);
      if (fixture.label === 'straight one-span Wall') {
        expect(positive || negative).toBe(false);
      }
      if (fixture.hasPositiveAndNegativeCurvature) {
        expect(positive).toBe(true);
        expect(negative).toBe(true);
      }
    }
  });

  it('proves the fold lemma: relaxing curvature never reduces the minimum offset ratio', () => {
    for (const fixture of allFixtures()) {
      const { development } = prepareFixture(fixture);
      const half = fixture.thickness / 2;
      const minRatio = (u: number): number => {
        let minimum = Infinity;
        for (let index = 0; index < development.sampleCount - 1; index += 1) {
          const ds = development.deltaS[index]!;
          if (ds <= 0) continue;
          const curvature = Math.abs(development.theta[index + 1]! - development.theta[index]!) / ds;
          minimum = Math.min(minimum, 1 - half * curvature * (1 - u));
        }
        return minimum;
      };
      const baseline = minRatio(0);
      expect(baseline).toBeGreaterThan(0);
      for (const u of [0.25, 0.5, 0.75, 1]) {
        expect(minRatio(u)).toBeGreaterThanOrEqual(baseline - 1e-12);
      }
    }
  });

  it('counts O(n + V) development and vertex-map work', () => {
    const fixture = multiFixture();
    const { development } = prepareFixture(fixture);
    const mesh = buildDevelopedWallMesh(development, {
      thickness: fixture.thickness,
      height: fixture.height,
      spans: prepareFixture(fixture).spans
    });
    const exactAttribution = new Float64Array(mesh.vertices.length * 3);
    for (let index = 0; index < mesh.vertices.length; index += 1) {
      const vertex = mesh.vertices[index]!;
      exactAttribution[index * 3] = vertex.station;
      exactAttribution[index * 3 + 1] = vertex.lateral;
      exactAttribution[index * 3 + 2] = vertex.height;
    }
    const buffers = createWallDevelopmentBuffers(development);
    const positions = new Float64Array(exactAttribution.length);
    const normals = new Float64Array(exactAttribution.length);
    const counts: Record<string, number> = {};
    const previous = setWorkObserver({
      span() {},
      count(name, amount) {
        counts[name] = (counts[name] ?? 0) + amount;
      }
    });
    try {
      evaluateWallDevelopment(development, 0.5, buffers);
      mapAttributedVertices(development, buffers, exactAttribution, 0, positions, normals);
    } finally {
      setWorkObserver(previous);
    }
    expect(counts['unfold:development-sample']).toBe(development.sampleCount);
    expect(counts['unfold:vertex-map']).toBe(mesh.vertices.length);
  });

  it('measures face lengths without claiming both Wall faces are isometric (D10)', () => {
    for (const fixture of allFixtures()) {
      const { development } = prepareFixture(fixture);
      const lengths = wallDevelopmentFaceLengths(development, fixture.thickness);
      expect(Number.isFinite(lengths.left)).toBe(true);
      expect(Number.isFinite(lengths.right)).toBe(true);
      expect(lengths.left).toBeGreaterThan(0);
      expect(lengths.right).toBeGreaterThan(0);
      if (fixture.closed) {
        expect(Math.abs(lengths.left - lengths.centerline)).toBeGreaterThan(1e-4);
        expect(Math.abs(lengths.right - lengths.centerline)).toBeGreaterThan(1e-4);
      }
    }
  });

  it('reports an overlap on a self-crossing invalid hook, with the stations that meet', () => {
    const points: LayoutVec2[] = [
      [0, 0],
      [4, 4],
      [0, 4],
      [4, 0]
    ];
    const samples: CurveSample[] = [];
    let station = 0;
    for (let index = 0; index < points.length; index += 1) {
      if (index > 0) station += distance(points[index - 1]!, points[index]!);
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const dx = next[0] - previous[0];
      const dz = next[1] - previous[1];
      const magnitude = Math.hypot(dx, dz) || 1;
      const tangent: LayoutVec2 = [dx / magnitude, dz / magnitude];
      samples.push({
        point: [...points[index]!] as LayoutVec2,
        distance: station,
        tangent,
        normal: [-tangent[1], tangent[0]],
        t: index / (points.length - 1)
      });
    }
    const prepared = prepareWallDevelopment({
      wallId: 'invalid-hook',
      samples,
      closed: false,
      anchorStation: 0
    });
    if ('refused' in prepared) throw new Error(prepared.message);
    const overlap = developmentOverlap(prepared, buffersAt(prepared, 0), 0.2);
    expect(overlap.overlaps).toBe(true);
    if (overlap.overlaps) {
      expect(overlap.stations[0]).not.toBe(overlap.stations[1]);
    }
  });

  it('reports no overlap for every valid fixture and keeps the u=0/1 endpoints canonical', () => {
    for (const fixture of allFixtures()) {
      const { development } = prepareFixture(fixture);
      const sheet = fixture.closed ? createWallDevelopmentSheetBuffers(development) : null;
      for (const u of [0, 0.25, 0.5, 0.75, 1]) {
        const buffers = buffersAt(development, u);
        if (sheet !== null) evaluateWallDevelopmentSheet(development, u, sheet);
        const overlap = developmentOverlap(
          development,
          buffers,
          fixture.thickness,
          sheet ?? undefined
        );
        expect(overlap.overlaps).toBe(false);
      }
    }
  });
});

describe('C3 checkpoint 4 — one signed-arc development at intermediate amounts', () => {
  const amounts = [0.3, 0.4, 0.64, 0.8] as const;

  function signedWrap(value: number): number {
    const turn = Math.PI * 2;
    const wrapped = ((value + Math.PI) % turn + turn) % turn - Math.PI;
    return wrapped === -Math.PI ? Math.PI : wrapped;
  }

  function sheetPoint(sheet: ReturnType<typeof createWallDevelopmentSheetBuffers>, index: number): LayoutVec2 {
    return [sheet.points[index * 2]!, sheet.points[index * 2 + 1]!];
  }

  it('opens a closed circle into the analytic signed arc, both wings at once', () => {
    const radius = 5;
    // Exact circular samples isolate this map from the cubic approximation the
    // circle document uses, so the analytic signed arc is the reference itself.
    const samples: CurveSample[] = [];
    const sampleCount = 96;
    for (let index = 0; index <= sampleCount; index += 1) {
      const angle = (index / sampleCount) * Math.PI * 2;
      const tangent: LayoutVec2 = [-Math.sin(angle), Math.cos(angle)];
      samples.push({
        point: [radius * Math.cos(angle), radius * Math.sin(angle)],
        distance: radius * angle,
        tangent,
        normal: [-tangent[1], tangent[0]],
        t: index / sampleCount
      });
    }
    const prepared = prepareWallDevelopment({
      wallId: 'signed-arc-circle',
      samples,
      closed: true,
      anchorStation: 0
    });
    if ('refused' in prepared) throw new Error(prepared.message);
    const development = prepared;
    const length = development.length;
    expect(length).toBeCloseTo(2 * Math.PI * radius, 9);
    const sheet = createWallDevelopmentSheetBuffers(development);
    const anchorSheet = developmentSheetCoordinate(development, development.anchorStation);
    expect(anchorSheet).toBeCloseTo(length / 2, 9);

    // Read the canonical curvature from the development itself; its sign owns
    // which way the developed arc bends, so the reference is orientation-free.
    const anchor = development.anchorIndex;
    const previous = Math.max(0, anchor - 1);
    const next = Math.min(development.sampleCount - 1, anchor + 1);
    const curvature =
      (development.theta[next]! - development.theta[previous]!) /
      (development.s[next]! - development.s[previous]!);
    expect(Math.abs(Math.abs(curvature) - 1 / radius)).toBeLessThan(1e-9);
    const tangent: [number, number] = [
      Math.cos(development.anchorDirection),
      Math.sin(development.anchorDirection)
    ];
    const normal: [number, number] = [-tangent[1], tangent[0]];

    for (const u of [0, ...amounts, 1]) {
      evaluateWallDevelopmentSheet(development, u, sheet);
      const k = (1 - u) * curvature;
      let maxPointError = 0;
      let maxNormalError = 0;
      for (let index = 0; index < sheet.sheet.length; index += 1) {
        // The sheet opens toward positive sheet coordinate: d = sheet − pin.
        const d = sheet.sheet[index]! - anchorSheet;
        const along = k === 0 ? d : Math.sin(k * d) / k;
        const inward = k === 0 ? 0 : (1 - Math.cos(k * d)) / k;
        const expected: LayoutVec2 = [
          development.anchorPoint[0] + tangent[0] * along + normal[0] * inward,
          development.anchorPoint[1] + tangent[1] * along + normal[1] * inward
        ];
        maxPointError = Math.max(maxPointError, distance(sheetPoint(sheet, index), expected));
        const angle = development.anchorDirection + k * d + Math.PI / 2;
        maxNormalError = Math.max(
          maxNormalError,
          Math.hypot(
            sheet.normals[index * 2]! - Math.cos(angle),
            sheet.normals[index * 2 + 1]! - Math.sin(angle)
          )
        );
      }
      expect(maxPointError).toBeLessThan(1e-9);
      expect(maxNormalError).toBeLessThan(1e-9);

      // The two cut copies are the free edges. They coincide only at the
      // canonical state; at every partial amount they sit symmetrically on
      // opposite sides of the pin, and at Flat they are exactly L apart.
      const first = sheetPoint(sheet, 0);
      const last = sheetPoint(sheet, sheet.sheet.length - 1);
      const firstFromPin: LayoutVec2 = [first[0] - development.anchorPoint[0], first[1] - development.anchorPoint[1]];
      const lastFromPin: LayoutVec2 = [last[0] - development.anchorPoint[0], last[1] - development.anchorPoint[1]];
      expect(firstFromPin[0] * tangent[0] + firstFromPin[1] * tangent[1]).toBeCloseTo(
        -lastFromPin[0] * tangent[0] - lastFromPin[1] * tangent[1],
        9
      );
      expect(firstFromPin[0] * normal[0] + firstFromPin[1] * normal[1]).toBeCloseTo(
        lastFromPin[0] * normal[0] + lastFromPin[1] * normal[1],
        9
      );
      if (u === 0) {
        expect(distance(first, last)).toBeLessThan(1e-9);
      } else if (u === 1) {
        expect(distance(first, last)).toBeCloseTo(length, 9);
        expect(
          Math.abs((last[0] - first[0]) * normal[0] + (last[1] - first[1]) * normal[1])
        ).toBeLessThan(1e-9);
      }
    }

    // The normal-derived tangent is one monotone signed turn from one free
    // edge to the other. No wing winds past the pin or gains an extra turn.
    for (const u of amounts) {
      evaluateWallDevelopmentSheet(development, u, sheet);
      let previousAngle = -Infinity;
      for (let index = 0; index < sheet.sheet.length; index += 1) {
        const angle = Math.atan2(-sheet.normals[index * 2]!, sheet.normals[index * 2 + 1]!);
        const relative = signedWrap(angle - development.anchorDirection);
        expect(relative).toBeGreaterThanOrEqual(previousAngle - 1e-9);
        previousAngle = relative;
      }
      expect(Math.abs(signedWrap(previousAngle - (1 - u) * Math.PI))).toBeLessThan(1e-9);
      expect(
        Math.abs(
          signedWrap(
            Math.atan2(-sheet.normals[0]!, sheet.normals[1]!) -
              development.anchorDirection +
              (1 - u) * Math.PI
          )
        )
      ).toBeLessThan(1e-9);
    }
  });

  it('relaxes every bend of a multi-Bézier Wall simultaneously and keeps the developed tangent field', () => {
    const fixture = multiFixture();
    const compiledLength = compileWallFirstLayoutGeometry(fixture.document).geometry.walls[0]!.length;
    const endpointChord = distance([0, 0], [12, 0]);
    expect(compiledLength).toBeGreaterThan(endpointChord + 0.1);

    for (const anchor of [0, 6]) {
      const { development } = prepareFixture(fixture, anchor);
      const thetaA = development.anchorDirection;
      for (const u of [0, ...amounts, 1]) {
        const buffers = buffersAt(development, u);
        const developed: LayoutVec2[] = [];
        for (let index = 0; index < development.sampleCount; index += 1) {
          developed.push([buffers.points[index * 2]!, buffers.points[index * 2 + 1]!]);
        }
        for (let index = 0; index < development.sampleCount; index += 1) {
          const canonicalDeviation = development.theta[index]! - thetaA;
          const expectedDeviation = (1 - u) * canonicalDeviation;
          // Normals are the left normal of the developed tangent field; they
          // are never a separately blended canonical normal.
          expect(buffers.normals[index * 2]!).toBeCloseTo(-Math.sin(thetaA + expectedDeviation), 9);
          expect(buffers.normals[index * 2 + 1]!).toBeCloseTo(Math.cos(thetaA + expectedDeviation), 9);
          // No artificial rotation or overshoot: the deviation only shrinks.
          expect(Math.abs(expectedDeviation)).toBeLessThanOrEqual(Math.abs(canonicalDeviation) + 1e-12);
        }
        // The displayed centerline's own chord directions keep exactly the
        // canonical chord-to-tangent relationship: any discretization error is
        // the source curve's, never an extra rotation introduced by Unroll.
        for (let index = 0; index < developed.length - 1; index += 1) {
          const dx = developed[index + 1]![0] - developed[index]![0];
          const dz = developed[index + 1]![1] - developed[index]![1];
          if (Math.hypot(dx, dz) < 1e-6) continue;
          const chord = Math.atan2(dz, dx);
          const canonicalMid = (development.theta[index]! + development.theta[index + 1]!) / 2 - thetaA;
          const baseline = Math.abs(signedWrap(development.phi[index]! - thetaA - canonicalMid));
          const expected = (1 - u) * canonicalMid;
          expect(Math.abs(signedWrap(chord - thetaA - expected))).toBeLessThanOrEqual(baseline + 1e-9);
        }
        if (u === 1) {
          const direction: LayoutVec2 = [Math.cos(thetaA), Math.sin(thetaA)];
          const start = developed[0]!;
          const end = developed.at(-1)!;
          expect(distance(start, end)).toBeCloseTo(development.length, 9);
          expect(
            Math.abs((end[0] - start[0]) * direction[1] - (end[1] - start[1]) * direction[0])
          ).toBeLessThan(1e-9);
          // The sheet is the actual Wall length, not the original endpoint
          // separation: the compiled length already exceeds that chord.
          expect(development.length).toBeCloseTo(compiledLength, 6);
        }
      }
    }
  });
});

describe('C3 checkpoint 4 — Opening stations in the developed frame', () => {
  function withOpening(
    document: LayoutDocumentWallFirst,
    wallId: string,
    offset: number,
    width: number
  ): LayoutDocumentWallFirst {
    const placed = planCreateWallFirstOpening(
      document,
      { wallId, kind: 'window', offset, width, height: 1.2, sillHeight: 1 },
      mintLayoutIdCapture(() => `c3-opening-${document.openings.length}`),
      document.floor.id
    );
    if (placed.kind !== 'success') throw new Error(JSON.stringify(placed.rejection));
    return placed.document;
  }

  it('maps an Opening on a curved open host by its canonical stations', () => {
    const fixture = sCurveFixture();
    const wall = wallOf(fixture.document, fixture.wallId);
    const length = compileWallFirstLayoutGeometry(fixture.document).geometry.walls[0]!.length;
    const document = withOpening(fixture.document, wall.id, length * 0.35, 1.1);
    const opening = document.openings[0]!;
    const { development, spans } = prepareFixture({ ...fixture, document });
    const mapped = developmentOpeningFragments(
      development,
      { openingId: opening.id, offset: opening.offset, width: opening.width },
      spans
    );
    expect(mapped.fragments).toHaveLength(1);
    expect(mapped.fragments[0]!.sheetStart).toBeCloseTo(opening.offset, 9);
    expect(mapped.fragments[0]!.sheetEnd).toBeCloseTo(opening.offset + opening.width, 9);
    expect(mapped.centerStation).toBeCloseTo(opening.offset + opening.width / 2, 9);
    expect(mapped.spanIndices.length).toBeGreaterThan(0);
    expect(
      validateWallDevelopment({ development, spans, openings: [mapped] })
    ).toEqual([]);
  });

  it('attributes jamb, sill and lintel vertices on a curved host at u = 0', () => {
    const fixture = sCurveFixture();
    const length = compileWallFirstLayoutGeometry(fixture.document).geometry.walls[0]!.length;
    const document = withOpening(fixture.document, fixture.wallId, length * 0.35, 1.1);
    const compilation = compileWallFirstLayoutGeometry(document);
    const compiled = compilation.geometry.walls.find((wall) => wall.wallId === fixture.wallId)!;
    const isolated = { ...compiled, startJunctionId: undefined, endJunctionId: undefined };
    const built = buildStandaloneWallMesh(isolated, 0, null, { attribution: true });
    expect(built.issues).toEqual([]);
    const mesh = built.mesh!;
    expect(mesh.pickRanges.some((range) => range.kind === 'opening' && range.surface === 'jamb')).toBe(true);
    expect(mesh.pickRanges.some((range) => range.kind === 'opening' && range.surface === 'sill')).toBe(true);
    expect(mesh.pickRanges.some((range) => range.kind === 'opening' && range.surface === 'lintel')).toBe(true);

    const prepared = prepareWallDevelopment({
      wallId: compiled.wallId,
      samples: compiled.samples,
      closed: false,
      anchorStation: 0
    });
    if ('refused' in prepared) throw new Error(prepared.message);
    const buffers = buffersAt(prepared, 0);
    const attribution = mesh.attributionExact!;
    const sourcePositions = mesh.attributionSourcePositions!;
    const mappedPositions = new Float64Array(attribution.length);
    const mappedNormals = new Float64Array(attribution.length);
    mapAttributedVertices(prepared, buffers, attribution, 0, mappedPositions, mappedNormals);

    const opening = document.openings[0]!;
    const openingEdges = [opening.offset, opening.offset + opening.width];
    expect(
      [...attribution].some((value, index) =>
        index % 3 === 0 && openingEdges.some((edge) => Math.abs(value - edge) < 1e-6)
      )
    ).toBe(true);
    const half = fixture.thickness / 2 + 1e-6;
    let maxPositionError = 0;
    for (let vertex = 0; vertex < attribution.length / 3; vertex += 1) {
      const w = attribution[vertex * 3 + 1]!;
      const y = attribution[vertex * 3 + 2]!;
      expect(Math.abs(w)).toBeLessThanOrEqual(half);
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(fixture.height + 1e-6);
      maxPositionError = Math.max(
        maxPositionError,
        Math.hypot(
          mappedPositions[vertex * 3]! - sourcePositions[vertex * 3]!,
          mappedPositions[vertex * 3 + 1]! - sourcePositions[vertex * 3 + 1]!,
          mappedPositions[vertex * 3 + 2]! - sourcePositions[vertex * 3 + 2]!
        )
      );
    }
    expect(maxPositionError).toBeLessThan(1e-9);
  });

  it('keeps a seam-crossing Opening whole and splits only an Opening at the display cut (D11)', () => {
    const fixture = circleFixture();
    const baseLength = compileWallFirstLayoutGeometry(fixture.document).geometry.walls[0]!.length;
    const cutStation = wrap(baseLength / 2, baseLength);
    const seamOpening = withOpening(fixture.document, fixture.wallId, baseLength - 0.2, 0.4);
    const withBoth = withOpening(seamOpening, fixture.wallId, cutStation - 0.2, 0.4);
    const openings = withBoth.openings;
    const seam = openings.find((opening) => Math.abs(opening.offset - (baseLength - 0.2)) < 1e-6)!;
    const atCut = openings.find((opening) => Math.abs(opening.offset - (cutStation - 0.2)) < 1e-6)!;
    const { development, spans } = prepareFixture({ ...fixture, document: withBoth });

    const seamMapped = developmentOpeningFragments(
      development,
      { openingId: seam.id, offset: seam.offset, width: seam.width },
      spans
    );
    const cutMapped = developmentOpeningFragments(
      development,
      { openingId: atCut.id, offset: atCut.offset, width: atCut.width },
      spans
    );

    // The seam is a tick at L/2; the opening crossing it remains one fragment.
    expect(seamMapped.fragments).toHaveLength(1);
    expect(seamMapped.fragments[0]!.sheetStart).toBeCloseTo(baseLength / 2 - 0.2, 9);
    expect(seamMapped.fragments[0]!.sheetEnd).toBeCloseTo(baseLength / 2 + 0.2, 9);
    expect(seamMapped.centerSheet).toBeCloseTo(baseLength / 2, 9);

    // The display cut at sheet 0/L splits the cut-crossing Opening into two.
    expect(cutMapped.fragments).toHaveLength(2);
    const cutWidth = cutMapped.fragments.reduce(
      (total, fragment) => total + (fragment.sheetEnd - fragment.sheetStart),
      0
    );
    expect(cutWidth).toBeCloseTo(atCut.width, 9);
    expect(cutMapped.fragments[0]!.sheetEnd).toBeCloseTo(baseLength, 9);
    expect(cutMapped.fragments[1]!.sheetStart).toBeCloseTo(0, 9);
    expect(cutMapped.fragments[0]!.openingId).toBe(atCut.id);
    expect(cutMapped.fragments[1]!.openingId).toBe(atCut.id);

    // Both Openings: three displayed fragments, each retaining its own id.
    expect([...seamMapped.fragments, ...cutMapped.fragments]).toHaveLength(3);
    expect(
      validateWallDevelopment({
        development,
        spans,
        openings: [seamMapped, cutMapped]
      })
    ).toEqual([]);
  });
});
