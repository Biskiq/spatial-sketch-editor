/**
 * C1–C3 checkpoint 6 — measured unfold, scrub, pick and Save/Load cost.
 *
 * Run from `apps/editor` with:
 *   npx vite-node perf/expressive-walls-measure.ts
 *
 * This measures the acceptance-relevant geometry work on the two required
 * fixtures: the canonical 16-span closed circle and the six-knot multi-Bézier
 * chain. Entry builds the display once; scrub evaluates the same display with a
 * new u; pick walks the developed triangles. Save/Load measures the canonical
 * codec plus the compile the reopened document needs. There is no browser,
 * network or wall-clock sampling here: each row is a synchronous CPU sample.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  compileWallFirstLayoutGeometry,
  createClosedWallCircleDocument,
  createEmptyWallFirstLayoutDocument,
  deriveChainSpans,
  LAYOUT_WALL_FIRST_FORMAT_VERSION,
  parseWallFirstLayoutDocumentJson,
  serializeWallFirstLayoutDocument,
  wallCubicChain,
  type LayoutDocumentWallFirst,
  type LayoutVec2,
  type LayoutWall,
  type LayoutWallCubicSpan,
  type LayoutWallCurveKnot,
} from "@portfolio/layout-core";

import { createWallUnfoldState } from "../src/lib/layout/wall-unfold";
import {
  buildWallUnfoldDisplay,
  evaluateWallUnfoldDisplay,
  pickWallUnfold,
} from "../src/lib/layout/wall-unfold-pick";

const ENTRY = {
  pose: {
    target: [0, 1.5, 0] as [number, number, number],
    azimuthRadians: 0.4,
    elevationRadians: 0.3,
    targetPlaneHeightMeters: 12,
  },
  reading: "3d" as const,
};

type Fixture = {
  readonly label: string;
  readonly document: LayoutDocumentWallFirst;
  readonly wallId: string;
};

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
  return points.map((point, index) => ({
    id: `wall-a:knot:${index + 1}`,
    point: [point[0], point[1]] as LayoutVec2,
  }));
}

function chainOf(
  start: LayoutVec2,
  end: LayoutVec2,
  interior: LayoutVec2[],
  spans?: LayoutWallCubicSpan[],
): LayoutWall["centerline"] {
  return wallCubicChain(
    knotsOf(...interior),
    spans ?? deriveChainSpans([start, ...interior, end]),
  );
}

function documentOf(
  centerline: LayoutWall["centerline"],
  start: LayoutVec2,
  end: LayoutVec2,
): LayoutDocumentWallFirst {
  const document = createEmptyWallFirstLayoutDocument();
  document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
  document.junctions = [
    { id: "j-a", point: [start[0], start[1]] },
    { id: "j-b", point: [end[0], end[1]] },
  ];
  document.walls = [
    {
      id: "wall-a",
      startJunctionId: "j-a",
      endJunctionId: "j-b",
      thickness: 0.2,
      height: 3,
      centerline,
    } as LayoutWall,
  ];
  return document;
}

function multiBezierFixture(): Fixture {
  const points: LayoutVec2[] = [
    [0, 0],
    [2, 1.5],
    [4, -1],
    [6, 1],
    [8, -1],
    [10, 1.2],
    [12, 0],
  ];
  return {
    label: "multi-bezier-6-knot",
    document: documentOf(
      chainOf(points[0]!, points.at(-1)!, points.slice(1, -1)),
      points[0]!,
      points.at(-1)!,
    ),
    wallId: "wall-a",
  };
}

function closedCircleFixture(): Fixture {
  const created = createClosedWallCircleDocument({
    center: [0, 0],
    rim: [5, 0],
    junctionId: "j-circle",
    wallId: "wall-circle",
    thickness: 0.2,
    height: 3,
  });
  if (created.kind !== "success")
    throw new Error(JSON.stringify(created.rejection));
  return {
    label: "closed-16-span-circle-r5",
    document: created.document,
    wallId: "wall-circle",
  };
}

type Stats = {
  readonly samples: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
};

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
  return {
    samples: samples.length,
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    medianMs: at(0.5),
    p95Ms: at(0.95),
    minMs: sorted[0]!,
    maxMs: sorted.at(-1)!,
  };
}

function measure(iterations: number, work: (index: number) => void): Stats {
  for (let index = 0; index < Math.min(5, iterations); index += 1) work(index);
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    work(index);
    samples.push(performance.now() - start);
  }
  return stats(samples);
}

function compiledWall(fixture: Fixture) {
  const compilation = compileWallFirstLayoutGeometry(fixture.document);
  const wall = compilation.geometry.walls.find(
    (candidate) => candidate.wallId === fixture.wallId,
  );
  if (wall === undefined)
    throw new Error(`${fixture.label} did not compile a Wall`);
  return wall;
}

function measureFixture(fixture: Fixture) {
  const wall = compiledWall(fixture);
  const state = createWallUnfoldState({
    wall,
    anchorStation: 0,
    entry: ENTRY,
    u: 1,
  });
  const display = buildWallUnfoldDisplay(wall, state);
  if (display === null) throw new Error(`${fixture.label} refused to develop`);

  const entry = measure(20, () => {
    const built = buildWallUnfoldDisplay(wall, state);
    if (built === null) throw new Error(`${fixture.label} refused to develop`);
  });
  const scrub = measure(500, (index) => {
    evaluateWallUnfoldDisplay(display, {
      ...state,
      u: ((index % 100) + 1) / 100,
    });
  });

  const triangle = display.mesh.triangles.find(
    (candidate) => candidate.face === "right" || candidate.face === "left",
  );
  if (triangle === undefined)
    throw new Error(`${fixture.label} has no pickable face`);
  let x = 0;
  let y = 0;
  let z = 0;
  for (const index of triangle.indices) {
    x += display.positions[index * 3]! / 3;
    y += display.positions[index * 3 + 1]! / 3;
    z += display.positions[index * 3 + 2]! / 3;
  }
  const pick = measure(500, () => {
    const hit = pickWallUnfold(display, {
      origin: [x, y + 5, z],
      direction: [0, -1, 0],
    });
    if (hit === null) throw new Error(`${fixture.label} pick missed`);
  });

  return {
    label: fixture.label,
    wallLengthMeters: wall.length,
    samples: wall.samples.length,
    displayVertices: display.mesh.vertices.length,
    displayTriangles: display.mesh.triangles.length,
    entryBuild: entry,
    scrubEvaluate: scrub,
    inversePick: pick,
  };
}

function measureSaveLoad(fixture: Fixture) {
  const canonical = serializeWallFirstLayoutDocument(fixture.document);
  const bytes = Buffer.byteLength(canonical, "utf8");
  const roundTrip = measure(40, () => {
    const parsed = parseWallFirstLayoutDocumentJson(canonical);
    if (!parsed.success)
      throw new Error(`${fixture.label} did not parse after Save`);
    compileWallFirstLayoutGeometry(parsed.document);
  });
  return { label: fixture.label, bytes, roundTrip };
}

const fixtures = [closedCircleFixture(), multiBezierFixture()];
const report = {
  kind: "expressive-walls-checkpoint-6-measurement",
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim(),
  generatedAt: new Date().toISOString(),
  method:
    "Synchronous CPU samples in Node via vite-node. entryBuild rebuilds prepare+buffers+mesh; scrubEvaluate re-maps the existing display at u=1..100%; inversePick casts one ray from above a developed face centroid; roundTrip serializes, parses and compiles the canonical source. Times are wall-clock performance.now() around each operation.",
  fixtures: fixtures.map(measureFixture),
  saveLoad: fixtures.map(measureSaveLoad),
};

const resultsDir = process.env.PERF_RESULTS_DIR;
const output = JSON.stringify(report, null, 2);
if (resultsDir !== undefined) {
  mkdirSync(resultsDir, { recursive: true });
  const path = resolve(resultsDir, "expressive-walls-measurement.json");
  writeFileSync(path, output);
  console.log(path);
}
console.log(output);
