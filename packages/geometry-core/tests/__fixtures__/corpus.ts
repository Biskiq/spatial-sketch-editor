/**
 * The T5.P01.S01 profile corpus.
 *
 * Valid sources exercise convex, concave, comb, U/L, all-smooth, mixed,
 * minimum-edge, near-limit coordinate and extent, both planes and non-uniform
 * scale. Invalid sources pin one refusal reason each (with a few ambiguous
 * degenerate shapes that are only required to refuse).
 *
 * Test-owned fixtures stay readable at the call site; the golden digests they
 * pin live in `goldens.ts`.
 *
 * Regular rings are pinned unit-circle literals in `regular-ring-units.json`,
 * never `Math.cos`/`Math.sin`. ECMAScript does not specify transcendental
 * results bit-exactly, and V8's differ between arm64 and x64, so a runtime trig
 * ring would make the bit-exact goldens a property of the runner's CPU rather
 * than of the kernel. `regular()` refuses a count with no pinned table instead
 * of falling back to trig.
 */
import type { ProfileAnchor } from '@portfolio/geometry-core';
import ringUnits from './regular-ring-units.json';

export type ValidFormSource = {
  readonly name: string;
  readonly plane: 'plan' | 'elevation';
  readonly extent: number;
  readonly scale: readonly [number, number, number];
  readonly outline: readonly ProfileAnchor[];
};

export type InvalidProfileSource = {
  readonly name: string;
  readonly expected: string;
  readonly outline: readonly ProfileAnchor[];
};

function anchor(key: number, u: number, v: number, smooth = false): ProfileAnchor {
  return { key, u, v, smooth };
}

function ring(points: readonly (readonly [number, number])[], smooth = false): ProfileAnchor[] {
  return points.map(([u, v], index) => anchor(index + 1, u, v, smooth));
}

// JSON widens every pair to `number[]`; a validating reader would be more code
// than the pinned table it checks, and a malformed pair fails the corpus test
// that consumes it rather than passing silently.
const UNIT_RINGS = ringUnits as unknown as Readonly<
  Record<string, readonly (readonly [number, number])[]>
>;

function unitRing(count: number): readonly (readonly [number, number])[] {
  const units = UNIT_RINGS[String(count)];
  if (units === undefined) {
    throw new Error(
      `No pinned unit ring for ${count} anchors. Add shortest round-trip literals to ` +
        'regular-ring-units.json; a runtime trigonometric ring is not deterministic across platforms.'
    );
  }
  return units;
}

function regular(count: number, radius: number, smooth = false): ProfileAnchor[] {
  return ring(
    unitRing(count).map(([u, v]) => [u * radius, v * radius] as const),
    smooth
  );
}

function alternating(count: number, radius: number): ProfileAnchor[] {
  return regular(count, radius).map((entry, index) => ({
    ...entry,
    smooth: index % 3 === 0
  }));
}

const square = ring([
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
]);

const smoothSquare = square.map((entry) => ({ ...entry, smooth: true }));
const mixedSquare = square.map((entry, index) => ({ ...entry, smooth: index % 2 === 1 }));

const lShape = ring([
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2]
]);

const uShape = ring([
  [0, 0],
  [3, 0],
  [3, 2],
  [2, 2],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2]
]);

const comb = ring([
  [0, 0],
  [5, 0],
  [5, 2],
  [4, 2],
  [4, 1],
  [3, 1],
  [3, 2],
  [2, 2],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2]
]);

const plus = ring([
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 1],
  [3, 2],
  [2, 2],
  [2, 3],
  [1, 3],
  [1, 2],
  [0, 2],
  [0, 1],
  [1, 1]
]);

const star = ring(
  unitRing(10).map(([u, v], index) => {
    const radius = index % 2 === 0 ? 1 : 0.45;
    return [u * radius, v * radius] as const;
  })
);

const trapezoid = ring([
  [0, 0],
  [3, 0],
  [2, 2],
  [1, 2]
]);

const stepped = ring([
  [0, 0],
  [3, 0],
  [3, 0.4],
  [2, 0.4],
  [2, 0.8],
  [1, 0.8],
  [1, 1.2],
  [0, 1.2]
]);

const keyGapped: ProfileAnchor[] = [
  anchor(10, 0, 0),
  anchor(20, 1, 0),
  anchor(30, 1, 1),
  anchor(40, 0, 1)
];

const offsetSquare = ring([
  [5.5, -3.25],
  [6.5, -3.25],
  [6.5, -2.25],
  [5.5, -2.25]
]);

const minimumSquare = ring([
  [0, 0],
  [0.001, 0],
  [0.001, 0.001],
  [0, 0.001]
]);

const minimumTriangle = ring([
  [0, 0],
  [0.001, 0],
  [0, 0.001]
]);

const nearLimitSquare = ring([
  [-49.9, -49.9],
  [49.9, -49.9],
  [49.9, 49.9],
  [-49.9, 49.9]
]);

const narrowSliver = ring([
  [0, 0],
  [0.001, 0],
  [0.001, 1],
  [0, 1]
]);

const triangle = ring([
  [0, 0],
  [2, 0],
  [0.5, 1.5]
]);

const smoothTriangle = triangle.map((entry) => ({ ...entry, smooth: true }));
const oneSmoothTriangle = triangle.map((entry, index) => ({
  ...entry,
  smooth: index === 1
}));

export const VALID_FORMS: readonly ValidFormSource[] = [
  { name: 'square-plan', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: square },
  { name: 'square-elevation', plane: 'elevation', extent: 1, scale: [1, 1, 1], outline: square },
  { name: 'square-non-uniform', plane: 'plan', extent: 2, scale: [2, 0.5, 3], outline: square },
  { name: 'rectangle-plan', plane: 'plan', extent: 0.25, scale: [1, 1, 1], outline: ring([[0, 0], [3, 0], [3, 1.5], [0, 1.5]]) },
  { name: 'rectangle-elevation', plane: 'elevation', extent: 0.4, scale: [1, 1, 1], outline: ring([[0, 0], [3, 0], [3, 1.5], [0, 1.5]]) },
  { name: 'triangle-plan', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: triangle },
  { name: 'triangle-elevation', plane: 'elevation', extent: 0.5, scale: [1, 1, 1], outline: triangle },
  { name: 'pentagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(5, 2) },
  { name: 'hexagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(6, 2) },
  { name: 'octagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(8, 2) },
  { name: 'dodecagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(12, 2) },
  { name: 'hexadecagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(16, 2) },
  { name: 'polygon-32', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(32, 2) },
  { name: 'polygon-64', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(64, 2) },
  { name: 'polygon-128', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(128, 2) },
  { name: 'polygon-256', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(256, 2) },
  { name: 'l-shape', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: lShape },
  { name: 'u-shape', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: uShape },
  { name: 'comb', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: comb },
  { name: 'comb-elevation', plane: 'elevation', extent: 0.3, scale: [1, 1, 1], outline: comb },
  { name: 'plus', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: plus },
  { name: 'star-5', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: star },
  { name: 'trapezoid', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: trapezoid },
  { name: 'stepped', plane: 'plan', extent: 0.5, scale: [1, 1, 1], outline: stepped },
  { name: 'smooth-square', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: smoothSquare },
  { name: 'smooth-square-elevation', plane: 'elevation', extent: 0.5, scale: [1, 1, 1], outline: smoothSquare },
  { name: 'smooth-triangle', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: smoothTriangle },
  { name: 'one-smooth-triangle', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: oneSmoothTriangle },
  { name: 'smooth-pentagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(5, 2, true) },
  { name: 'smooth-octagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(8, 2, true) },
  { name: 'smooth-16', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(16, 2, true) },
  { name: 'smooth-64', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(64, 2, true) },
  { name: 'smooth-256-maximum-ring', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: regular(256, 40, true) },
  { name: 'mixed-square', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: mixedSquare },
  { name: 'mixed-dodecagon', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: alternating(12, 2) },
  { name: 'mixed-64', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: alternating(64, 2) },
  { name: 'key-gapped', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: keyGapped },
  { name: 'offset-square', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: offsetSquare },
  { name: 'minimum-edge-square', plane: 'plan', extent: 0.001, scale: [1, 1, 1], outline: minimumSquare },
  { name: 'minimum-edge-triangle', plane: 'plan', extent: 0.001, scale: [1, 1, 1], outline: minimumTriangle },
  { name: 'near-limit-square', plane: 'plan', extent: 0.1, scale: [1, 1, 1], outline: nearLimitSquare },
  { name: 'narrow-sliver', plane: 'plan', extent: 1, scale: [1, 1, 1], outline: narrowSliver },
  { name: 'extent-minimum', plane: 'plan', extent: 0.001, scale: [1, 1, 1], outline: square },
  { name: 'extent-maximum', plane: 'plan', extent: 100, scale: [1, 1, 1], outline: square },
  { name: 'scale-minimum', plane: 'plan', extent: 100, scale: [0.01, 0.01, 0.01], outline: square },
  { name: 'scale-maximum', plane: 'plan', extent: 0.001, scale: [100, 100, 100], outline: minimumSquare },
  { name: 'non-uniform-elevation', plane: 'elevation', extent: 0.8, scale: [1.5, 0.75, 2.5], outline: lShape },
  { name: 'curved-rectangle-elevation', plane: 'elevation', extent: 0.2, scale: [1, 1, 1], outline: ring([[0, 0], [4, 0], [4, 1], [0, 1]]).map((entry, index) => ({ ...entry, smooth: index === 1 || index === 3 })) }
];

export const INVALID_PROFILES: readonly InvalidProfileSource[] = [
  {
    name: 'too-few-empty',
    expected: 'too-few-anchors',
    outline: []
  },
  {
    name: 'too-few-single',
    expected: 'too-few-anchors',
    outline: [anchor(1, 0, 0)]
  },
  {
    name: 'too-few',
    expected: 'too-few-anchors',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0)]
  },
  {
    name: 'too-many',
    expected: 'too-many-anchors',
    // The anchor count is refused before any coordinate is read; these values
    // exist only to make the outline concrete, without a trig ring.
    outline: Array.from({ length: 257 }, (_, index) =>
      anchor(index + 1, (index % 17) * 0.25, Math.floor(index / 17) * 0.25)
    )
  },
  {
    name: 'non-finite-u',
    expected: 'non-finite',
    outline: [anchor(1, 0, 0), anchor(2, Number.NaN, 0), anchor(3, 0, 1)]
  },
  {
    name: 'non-finite-v',
    expected: 'non-finite',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 0, Number.POSITIVE_INFINITY)]
  },
  {
    name: 'non-finite-key',
    expected: 'out-of-range',
    outline: [anchor(Number.NaN, 0, 0), anchor(2, 1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'out-of-range-negative-coordinate',
    expected: 'out-of-range',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 0, -50.1)]
  },
  {
    name: 'out-of-range-coordinate',
    expected: 'out-of-range',
    outline: [anchor(1, 0, 0), anchor(2, 50.1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'out-of-range-key',
    expected: 'out-of-range',
    outline: [anchor(0, 0, 0), anchor(2, 1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'non-integer-key',
    expected: 'out-of-range',
    outline: [anchor(1.5, 0, 0), anchor(2, 1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'unsafe-key',
    expected: 'out-of-range',
    outline: [anchor(Number.MAX_SAFE_INTEGER + 2, 0, 0), anchor(2, 1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'duplicate-key',
    expected: 'duplicate-key',
    outline: [anchor(1, 0, 0), anchor(1, 1, 0), anchor(3, 0, 1)]
  },
  {
    name: 'edge-too-short',
    expected: 'edge-too-short',
    outline: [anchor(1, 0, 0), anchor(2, 0.0005, 0), anchor(3, 0.0005, 0.001), anchor(4, 0, 0.001)]
  },
  {
    name: 'duplicate-coordinate',
    expected: 'edge-too-short',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 1, 1), anchor(4, 1, 1)]
  },
  {
    name: 'collinear-anchor',
    expected: 'collinear',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 2, 0), anchor(4, 2, 2)]
  },
  {
    name: 'collinear-run',
    expected: 'collinear',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 2, 0), anchor(4, 3, 0), anchor(5, 3, 2)]
  },
  {
    name: 'all-collinear',
    expected: 'collinear',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 2, 0)]
  },
  {
    name: 'bow-tie',
    expected: 'self-intersecting',
    outline: [anchor(1, 0, 0), anchor(2, 2, 2), anchor(3, 2, 0), anchor(4, 0, 2)]
  },
  {
    name: 'touching-vertex-edge',
    expected: 'self-intersecting',
    outline: [anchor(1, 0, 0), anchor(2, 3, 0), anchor(3, 3, 2), anchor(4, 1.5, 0), anchor(5, 0, 2)]
  },
  {
    name: 'crossing-5',
    expected: 'self-intersecting',
    outline: [anchor(1, 0, 0), anchor(2, 3, 0), anchor(3, 1, 2), anchor(4, -1, 2), anchor(5, 2, -1)]
  },
  {
    name: 'clockwise',
    expected: 'clockwise',
    outline: [...square].reverse()
  },
  {
    name: 'clockwise-triangle',
    expected: 'clockwise',
    outline: [...triangle].reverse()
  },
  {
    name: 'smooth-flag-invalid',
    expected: 'out-of-range',
    outline: [
      anchor(1, 0, 0),
      anchor(2, 1, 0),
      { key: 3, u: 0, v: 1, smooth: 0 as unknown as boolean }
    ]
  },
  {
    name: 'zero-area-square',
    expected: 'collinear',
    outline: [anchor(1, 0, 0), anchor(2, 1, 0), anchor(3, 2, 0), anchor(4, 0, 1)]
  },
  {
    name: 'crossing-horizontal',
    expected: 'self-intersecting',
    outline: [anchor(1, 0, 0), anchor(2, 3, 0), anchor(3, 0, 2), anchor(4, 3, 2)]
  },
  {
    name: 'pentagram',
    expected: 'self-intersecting',
    outline: (() => {
      const vertices = regular(5, 2);
      return [0, 2, 4, 1, 3].map((index, key) => ({
        ...vertices[index]!,
        key: key + 1
      }));
    })()
  }
];
