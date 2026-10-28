/// <reference path="./earcut.d.ts" />
/**
 * Profile source rules and canonical evaluation.
 *
 * A profile is a closed outline of 3–256 keyed anchors in a local `(u, v)`
 * plane. Straight anchors are profile points. Smooth anchors are control points
 * of a quadratic Bézier from the previous midpoint, through the anchor, to the
 * next midpoint, sampled with a deterministic count derived from chordal error.
 *
 * The evaluated ring is:
 *
 * - counter-clockwise in `(u, v)`, so the exact orientation at its
 *   lexicographically lowest point is positive;
 * - simple: no two non-adjacent segments touch or cross;
 * - triangulated by `earcut`, accepted only with `pointCount − 2` positively
 *   oriented triangles.
 *
 * Arithmetic is limited to `+ − × ÷`, `Math.sqrt`, comparisons, the admitted
 * `Math` rounding helpers and the exact predicate below. No trigonometric,
 * exponential or random function is part of a canonical path.
 */
import earcut from 'earcut';
import { GeometryCoreError } from './errors';
import { orient2dExact } from './predicates';

/** The canonical evaluation contract this module implements. */
export const GEOMETRY_CORE_EVALUATOR_VERSION = 1;

export const PROFILE_LIMITS = Object.freeze({
  minAnchors: 3,
  maxAnchors: 256,
  maxEvaluatedPoints: 4096,
  minControlEdgeMeters: 0.001,
  maxCoordinateMeters: 50,
  minExtentMeters: 0.001,
  maxExtentMeters: 100,
  minScale: 0.01,
  maxScale: 100,
  minScaledDimensionMeters: 0.001,
  maxScaledDimensionMeters: 100,
  minSmoothSegments: 2,
  maxSmoothSegments: 16
});

/** Chordal-error target for one smooth-anchor curve, in metres. */
const SMOOTH_CHORDAL_TOLERANCE_METERS = 0.001;

export type ProfileAnchor = {
  readonly key: number;
  readonly u: number;
  readonly v: number;
  readonly smooth: boolean;
};

export type ProfileIssueCode =
  | 'too-few-anchors'
  | 'too-many-anchors'
  | 'non-finite'
  | 'out-of-range'
  | 'duplicate-key'
  | 'edge-too-short'
  | 'collinear'
  | 'self-intersecting'
  | 'clockwise';

export type ProfileIssue = {
  readonly code: ProfileIssueCode;
  readonly anchorKeys: readonly number[];
};

export type ProfileBounds = {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
};

/**
 * One canonical profile result.
 *
 * `points` is a closed ring (the final point is never repeated). Point `i`
 * starts the segment that ends at point `i + 1`, and `pointEdgeKeys[i]` is the
 * outline edge key that owns it. Keys are positive safe integers, so the array
 * is `Float64Array`: a 32-bit store would silently truncate an admitted key.
 * `pointCreases[i] === 1` marks a straight
 * anchor, where side normals must crease; a smooth-anchor sample is shared so
 * ordinary vertex normals stay smooth along the curve.
 */
export type EvaluatedProfile = {
  readonly points: Float64Array;
  readonly pointEdgeKeys: Float64Array;
  readonly pointCreases: Uint8Array;
  readonly triangles: Uint32Array;
  readonly bounds: ProfileBounds;
};

type Curve = {
  readonly samples: Float64Array;
  readonly steps: number;
  readonly half: number;
};

type RingPoint = {
  readonly u: number;
  readonly v: number;
  readonly crease: boolean;
};

type Ring = {
  readonly points: Float64Array;
  readonly pointEdgeKeys: Float64Array;
  readonly pointCreases: Uint8Array;
  readonly bounds: ProfileBounds;
};

/**
 * Validate one outline at the two moments the product reads it: document
 * admission and planner acceptance.
 *
 * A valid result is empty. Every issue names the exact codec/planner reason and
 * the anchor keys a creator's refusal can disclose.
 */
export function validateProfile(
  anchors: readonly ProfileAnchor[]
): readonly ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  if (!Array.isArray(anchors) || anchors.length < PROFILE_LIMITS.minAnchors) {
    return [{ code: 'too-few-anchors', anchorKeys: keysOf(anchors) }];
  }
  if (anchors.length > PROFILE_LIMITS.maxAnchors) {
    return [{ code: 'too-many-anchors', anchorKeys: keysOf(anchors) }];
  }

  const seen = new Map<number, number>();
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    const keys = [anchor.key];
    if (
      !Number.isSafeInteger(anchor.key) ||
      anchor.key <= 0 ||
      typeof anchor.smooth !== 'boolean'
    ) {
      issues.push({ code: 'out-of-range', anchorKeys: keys });
      continue;
    }
    const previous = seen.get(anchor.key);
    if (previous !== undefined) {
      issues.push({
        code: 'duplicate-key',
        anchorKeys: [anchors[previous]!.key, anchor.key]
      });
    }
    seen.set(anchor.key, index);
    if (!Number.isFinite(anchor.u) || !Number.isFinite(anchor.v)) {
      issues.push({ code: 'non-finite', anchorKeys: keys });
      continue;
    }
    if (
      Math.abs(anchor.u) > PROFILE_LIMITS.maxCoordinateMeters ||
      Math.abs(anchor.v) > PROFILE_LIMITS.maxCoordinateMeters
    ) {
      issues.push({ code: 'out-of-range', anchorKeys: keys });
    }
  }
  if (issues.length > 0) return issues;

  for (let index = 0; index < anchors.length; index += 1) {
    const start = anchors[index]!;
    const end = anchors[(index + 1) % anchors.length]!;
    const dx = end.u - start.u;
    const dy = end.v - start.v;
    if (Math.sqrt(dx * dx + dy * dy) < PROFILE_LIMITS.minControlEdgeMeters) {
      issues.push({ code: 'edge-too-short', anchorKeys: [start.key, end.key] });
    }
  }
  if (issues.length > 0) return issues;

  for (let index = 0; index < anchors.length; index += 1) {
    const previous = anchors[(index + anchors.length - 1) % anchors.length]!;
    const current = anchors[index]!;
    const next = anchors[(index + 1) % anchors.length]!;
    if (
      orient2dExact(previous.u, previous.v, current.u, current.v, next.u, next.v) === 0
    ) {
      issues.push({
        code: 'collinear',
        anchorKeys: [previous.key, current.key, next.key]
      });
    }
  }
  if (issues.length > 0) return issues;

  const curves = anchors.map((anchor, index) =>
    anchor.smooth
      ? buildCurve(
          anchors[(index + anchors.length - 1) % anchors.length]!,
          anchor,
          anchors[(index + 1) % anchors.length]!
        )
      : null
  );
  const effective = effectivePoints(anchors, curves);
  const ring = buildRing(anchors, curves, effective);

  if (ring.points.length / 2 > PROFILE_LIMITS.maxEvaluatedPoints) {
    // Bounded by construction (256 anchors × 16 samples), kept as a guard if a
    // later admitted anchor count raises the control bound.
    issues.push({ code: 'too-many-anchors', anchorKeys: keysOf(anchors) });
    return issues;
  }
  for (let index = 0; index < ring.points.length / 2; index += 1) {
    const next = (index + 1) % (ring.points.length / 2);
    if (
      ring.points[index * 2] === ring.points[next * 2] &&
      ring.points[index * 2 + 1] === ring.points[next * 2 + 1]
    ) {
      issues.push({
        code: 'edge-too-short',
        anchorKeys: [ring.pointEdgeKeys[index]!, ring.pointEdgeKeys[next]!]
      });
      return issues;
    }
  }

  const intersection = findIntersection(ring);
  if (intersection !== null) {
    issues.push({ code: 'self-intersecting', anchorKeys: intersection });
    return issues;
  }

  const winding = ringWinding(ring);
  if (winding < 0) {
    issues.push({ code: 'clockwise', anchorKeys: keysOf(anchors) });
    return issues;
  }
  if (winding === 0) {
    issues.push({ code: 'collinear', anchorKeys: keysOf(anchors) });
    return issues;
  }

  const triangles = triangulate(ring.points);
  if (triangles === null) {
    issues.push({ code: 'self-intersecting', anchorKeys: keysOf(anchors) });
    return issues;
  }
  return issues;
}

/**
 * Reverse a clockwise outline into the canonical counter-clockwise ring order.
 * Keys, smooth flags and point order within the reversed direction are kept.
 * A profile already canonical, or one this helper cannot orient, is returned as
 * a fresh array without changing its order.
 */
export function canonicalizeWinding(
  anchors: readonly ProfileAnchor[]
): readonly ProfileAnchor[] {
  if (anchors.length < PROFILE_LIMITS.minAnchors) return [...anchors];
  const curves = anchors.map((anchor, index) =>
    anchor.smooth
      ? buildCurve(
          anchors[(index + anchors.length - 1) % anchors.length]!,
          anchor,
          anchors[(index + 1) % anchors.length]!
        )
      : null
  );
  const effective = effectivePoints(anchors, curves);
  const ring = buildRing(anchors, curves, effective);
  return ringWinding(ring) < 0 ? [...anchors].reverse() : [...anchors];
}

/**
 * Evaluate one valid outline. Invalid source refuses with a
 * `GeometryCoreError` carrying the same issues `validateProfile` reports; this
 * function never normalizes a defect into a body.
 */
export function evaluateProfile(anchors: readonly ProfileAnchor[]): EvaluatedProfile {
  const issues = validateProfile(anchors);
  if (issues.length > 0) {
    throw new GeometryCoreError(
      `Profile refuses: ${issues[0]!.code} (${issues[0]!.anchorKeys.join(', ')})`,
      issues
    );
  }
  const curves = anchors.map((anchor, index) =>
    anchor.smooth
      ? buildCurve(
          anchors[(index + anchors.length - 1) % anchors.length]!,
          anchor,
          anchors[(index + 1) % anchors.length]!
        )
      : null
  );
  const effective = effectivePoints(anchors, curves);
  const ring = buildRing(anchors, curves, effective);
  const triangles = triangulate(ring.points);
  if (triangles === null) {
    throw new GeometryCoreError('Profile triangulation refused.', [
      { code: 'self-intersecting', anchorKeys: keysOf(anchors) }
    ]);
  }
  return {
    points: ring.points,
    pointEdgeKeys: ring.pointEdgeKeys,
    pointCreases: ring.pointCreases,
    triangles,
    bounds: ring.bounds
  };
}

function keysOf(anchors: readonly ProfileAnchor[]): readonly number[] {
  return Array.isArray(anchors)
    ? anchors.map((anchor) => (typeof anchor?.key === 'number' ? anchor.key : 0))
    : [];
}

function buildCurve(
  previous: ProfileAnchor,
  anchor: ProfileAnchor,
  next: ProfileAnchor
): Curve {
  const startU = (previous.u + anchor.u) / 2;
  const startV = (previous.v + anchor.v) / 2;
  const endU = (anchor.u + next.u) / 2;
  const endV = (anchor.v + next.v) / 2;
  const deviationU = startU - 2 * anchor.u + endU;
  const deviationV = startV - 2 * anchor.v + endV;
  const deviation = Math.sqrt(
    (deviationU * deviationU + deviationV * deviationV) /
      (4 * SMOOTH_CHORDAL_TOLERANCE_METERS)
  );
  const requested = Number.isFinite(deviation) ? Math.ceil(deviation) : PROFILE_LIMITS.maxSmoothSegments;
  let steps = 2 * Math.ceil(requested / 2);
  if (!(steps >= PROFILE_LIMITS.minSmoothSegments)) {
    steps = PROFILE_LIMITS.minSmoothSegments;
  }
  if (steps > PROFILE_LIMITS.maxSmoothSegments) steps = PROFILE_LIMITS.maxSmoothSegments;
  const samples = new Float64Array((steps + 1) * 2);
  for (let sample = 0; sample <= steps; sample += 1) {
    const t = sample / steps;
    const inverse = 1 - t;
    samples[sample * 2] =
      inverse * inverse * startU + 2 * t * inverse * anchor.u + t * t * endU;
    samples[sample * 2 + 1] =
      inverse * inverse * startV + 2 * t * inverse * anchor.v + t * t * endV;
  }
  return { samples, steps, half: steps / 2 };
}

/** The point an outline segment starts or ends at for one anchor. */
function effectivePoints(
  anchors: readonly ProfileAnchor[],
  curves: readonly (Curve | null)[]
): Float64Array {
  const points = new Float64Array(anchors.length * 2);
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    const curve = curves[index];
    if (curve === null) {
      points[index * 2] = anchor.u;
      points[index * 2 + 1] = anchor.v;
    } else {
      points[index * 2] = curve.samples[curve.half * 2]!;
      points[index * 2 + 1] = curve.samples[curve.half * 2 + 1]!;
    }
  }
  return points;
}

function buildRing(
  anchors: readonly ProfileAnchor[],
  curves: readonly (Curve | null)[],
  effective: Float64Array
): Ring {
  const pointList: RingPoint[] = [];
  const incomingKeys: number[] = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const run = edgeRun(anchors, curves, effective, index);
    const key = anchors[index]!.key;
    // Every run starts at the previous run's end; only the first run contributes
    // that shared point to the ring.
    for (let entry = index === 0 ? 0 : 1; entry < run.length; entry += 1) {
      if (index === 0 && entry === 0) {
        pointList.push(run[entry]!);
        incomingKeys.push(0);
        continue;
      }
      pointList.push(run[entry]!);
      incomingKeys.push(key);
    }
  }

  // The final run ends at the first point by construction; store its edge key
  // (the closing segment) and drop the duplicate point.
  const closingKey = incomingKeys.pop()!;
  pointList.pop();

  const count = pointList.length;
  const points = new Float64Array(count * 2);
  const pointEdgeKeys = new Float64Array(count);
  const pointCreases = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) {
    const point = pointList[index]!;
    points[index * 2] = point.u;
    points[index * 2 + 1] = point.v;
    pointEdgeKeys[index] =
      index === count - 1 ? closingKey : incomingKeys[index + 1]!;
    pointCreases[index] = point.crease ? 1 : 0;
  }
  return {
    points,
    pointEdgeKeys,
    pointCreases,
    bounds: boundsOf(points)
  };
}

function edgeRun(
  anchors: readonly ProfileAnchor[],
  curves: readonly (Curve | null)[],
  effective: Float64Array,
  index: number
): readonly RingPoint[] {
  const count = anchors.length;
  const anchor = anchors[index]!;
  const next = anchors[(index + 1) % count]!;
  const nextIndex = (index + 1) % count;
  const run: RingPoint[] = [
    {
      u: effective[index * 2]!,
      v: effective[index * 2 + 1]!,
      crease: !anchor.smooth
    }
  ];

  if (anchor.smooth) {
    const curve = curves[index]!;
    for (let sample = curve.half + 1; sample <= curve.steps; sample += 1) {
      run.push({
        u: curve.samples[sample * 2]!,
        v: curve.samples[sample * 2 + 1]!,
        crease: false
      });
    }
  } else if (next.smooth) {
    run.push({ u: (anchor.u + next.u) / 2, v: (anchor.v + next.v) / 2, crease: false });
  } else {
    run.push({ u: next.u, v: next.v, crease: true });
  }

  if (next.smooth) {
    const curve = curves[nextIndex]!;
    for (let sample = 1; sample <= curve.half; sample += 1) {
      run.push({
        u: curve.samples[sample * 2]!,
        v: curve.samples[sample * 2 + 1]!,
        crease: false
      });
    }
  } else if (anchor.smooth) {
    run.push({ u: next.u, v: next.v, crease: true });
  }
  return run;
}

function boundsOf(points: Float64Array): ProfileBounds {
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let index = 0; index < points.length; index += 2) {
    const u = points[index]!;
    const v = points[index + 1]!;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return { minU, maxU, minV, maxV };
}

/** Exact orientation at the lexicographically lowest ring point. */
function ringWinding(ring: Ring): number {
  const count = ring.points.length / 2;
  let lowest = 0;
  for (let index = 1; index < count; index += 1) {
    const u = ring.points[index * 2]!;
    const v = ring.points[index * 2 + 1]!;
    const bestU = ring.points[lowest * 2]!;
    const bestV = ring.points[lowest * 2 + 1]!;
    if (u < bestU || (u === bestU && v < bestV)) lowest = index;
  }
  const previous = (lowest + count - 1) % count;
  const next = (lowest + 1) % count;
  return orient2dExact(
    ring.points[previous * 2]!,
    ring.points[previous * 2 + 1]!,
    ring.points[lowest * 2]!,
    ring.points[lowest * 2 + 1]!,
    ring.points[next * 2]!,
    ring.points[next * 2 + 1]!
  );
}

/**
 * Exact simplicity check with a bounded uniform-grid broad phase.
 *
 * Every candidate pair is decided by the same exact predicate; the grid only
 * limits how many pairs reach it. The worst admitted ring is 4,096 points.
 */
function findIntersection(ring: Ring): readonly number[] | null {
  const count = ring.points.length / 2;

  // Adjacent segments may meet only at their shared point.
  for (let index = 0; index < count; index += 1) {
    const previous = (index + count - 1) % count;
    const aU = ring.points[previous * 2]!;
    const aV = ring.points[previous * 2 + 1]!;
    const sharedU = ring.points[index * 2]!;
    const sharedV = ring.points[index * 2 + 1]!;
    const next = (index + 1) % count;
    const bU = ring.points[next * 2]!;
    const bV = ring.points[next * 2 + 1]!;
    if (orient2dExact(aU, aV, sharedU, sharedV, bU, bV) !== 0) continue;
    const dot = (aU - sharedU) * (bU - sharedU) + (aV - sharedV) * (bV - sharedV);
    if (dot > 0) {
      return [ring.pointEdgeKeys[previous]!, ring.pointEdgeKeys[index]!];
    }
  }

  const bounds = ring.bounds;
  const width = bounds.maxU - bounds.minU;
  const height = bounds.maxV - bounds.minV;
  const resolution = Math.max(
    1,
    Math.min(64, Math.ceil(Math.sqrt(count)))
  );
  const columns = resolution;
  const rows = resolution;
  const cellWidth = width === 0 ? 1 : width / columns;
  const cellHeight = height === 0 ? 1 : height / rows;
  const cells: number[][] = Array.from({ length: columns * rows }, () => []);

  const cellRange = (minX: number, maxX: number, minY: number, maxY: number) => {
    const startColumn = Math.max(
      0,
      Math.min(columns - 1, Math.floor((minX - bounds.minU) / cellWidth))
    );
    const endColumn = Math.max(
      0,
      Math.min(columns - 1, Math.floor((maxX - bounds.minU) / cellWidth))
    );
    const startRow = Math.max(
      0,
      Math.min(rows - 1, Math.floor((minY - bounds.minV) / cellHeight))
    );
    const endRow = Math.max(
      0,
      Math.min(rows - 1, Math.floor((maxY - bounds.minV) / cellHeight))
    );
    return { startColumn, endColumn, startRow, endRow };
  };

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const aU = ring.points[index * 2]!;
    const aV = ring.points[index * 2 + 1]!;
    const bU = ring.points[next * 2]!;
    const bV = ring.points[next * 2 + 1]!;
    const range = cellRange(
      Math.min(aU, bU),
      Math.max(aU, bU),
      Math.min(aV, bV),
      Math.max(aV, bV)
    );
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let column = range.startColumn; column <= range.endColumn; column += 1) {
        cells[row * columns + column]!.push(index);
      }
    }
  }

  const checked = new Set<number>();
  for (const cell of cells) {
    for (let first = 0; first < cell.length; first += 1) {
      for (let second = first + 1; second < cell.length; second += 1) {
        const i = cell[first]!;
        const j = cell[second]!;
        if (i > j) continue;
        if (j === i + 1 || (i === 0 && j === count - 1)) continue;
        const pair = i * count + j;
        if (checked.has(pair)) continue;
        checked.add(pair);
        if (segmentsIntersect(ring, i, j)) {
          return [ring.pointEdgeKeys[i]!, ring.pointEdgeKeys[j]!];
        }
      }
    }
  }
  return null;
}

function segmentsIntersect(ring: Ring, first: number, second: number): boolean {
  const aU = ring.points[first * 2]!;
  const aV = ring.points[first * 2 + 1]!;
  const bU = ring.points[((first + 1) % (ring.points.length / 2)) * 2]!;
  const bV = ring.points[((first + 1) % (ring.points.length / 2)) * 2 + 1]!;
  const cU = ring.points[second * 2]!;
  const cV = ring.points[second * 2 + 1]!;
  const dU = ring.points[((second + 1) % (ring.points.length / 2)) * 2]!;
  const dV = ring.points[((second + 1) % (ring.points.length / 2)) * 2 + 1]!;

  const firstC = orient2dExact(aU, aV, bU, bV, cU, cV);
  const firstD = orient2dExact(aU, aV, bU, bV, dU, dV);
  const secondA = orient2dExact(cU, cV, dU, dV, aU, aV);
  const secondB = orient2dExact(cU, cV, dU, dV, bU, bV);

  if (firstC === 0 && onSegment(cU, cV, aU, aV, bU, bV)) return true;
  if (firstD === 0 && onSegment(dU, dV, aU, aV, bU, bV)) return true;
  if (secondA === 0 && onSegment(aU, aV, cU, cV, dU, dV)) return true;
  if (secondB === 0 && onSegment(bU, bV, cU, cV, dU, dV)) return true;
  return (
    (firstC > 0) !== (firstD > 0) &&
    (secondA > 0) !== (secondB > 0) &&
    firstC !== 0 &&
    firstD !== 0 &&
    secondA !== 0 &&
    secondB !== 0
  );
}

function onSegment(
  u: number,
  v: number,
  aU: number,
  aV: number,
  bU: number,
  bV: number
): boolean {
  return (
    u >= Math.min(aU, bU) &&
    u <= Math.max(aU, bU) &&
    v >= Math.min(aV, bV) &&
    v <= Math.max(aV, bV)
  );
}

/**
 * `earcut` over the evaluated `(u, v)` points. Returns `null` unless the result
 * has exactly `pointCount − 2` non-degenerate, positively oriented triangles.
 */
function triangulate(points: Float64Array): Uint32Array | null {
  const count = points.length / 2;
  let raw: number[];
  try {
    raw = earcut(points, undefined, 2);
  } catch {
    return null;
  }
  if (raw.length !== (count - 2) * 3) return null;
  const triangles = new Uint32Array(raw.length);
  for (let index = 0; index < raw.length; index += 3) {
    const a = raw[index]!;
    const b = raw[index + 1]!;
    const c = raw[index + 2]!;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      !Number.isInteger(c) ||
      a < 0 ||
      b < 0 ||
      c < 0 ||
      a >= count ||
      b >= count ||
      c >= count ||
      a === b ||
      b === c ||
      a === c
    ) {
      return null;
    }
    const orientation = orient2dExact(
      points[a * 2]!,
      points[a * 2 + 1]!,
      points[b * 2]!,
      points[b * 2 + 1]!,
      points[c * 2]!,
      points[c * 2 + 1]!
    );
    // Earcut must return the ring's own counter-clockwise orientation. A
    // negative or zero triangle is not repaired here: the profile refuses as
    // self-intersecting, so every accepted body has one canonical triangulation.
    if (orientation <= 0) return null;
    triangles[index] = a;
    triangles[index + 1] = b;
    triangles[index + 2] = c;
  }
  return triangles;
}
