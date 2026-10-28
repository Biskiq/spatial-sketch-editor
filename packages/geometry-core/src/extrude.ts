/**
 * Canonical extrusion of one evaluated profile into a closed form mesh.
 *
 * The result is source-independent output: positions are local metres, indices
 * form a closed outward-oriented 2-manifold, `regions` names the base cap, the
 * top cap and one side run per profile segment, and the result carries bounds,
 * an XZ footprint ring and the floor contact. Normals and UVs are render
 * derivatives computed outside this package.
 */
import { GeometryCoreError } from './errors';
import {
  PROFILE_LIMITS,
  type EvaluatedProfile
} from './profile';

export type FormBounds = {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
};

export type FormMesh = {
  /** Local metres, xyz triples. */
  readonly positions: Float64Array;
  /** Triangles into `positions`. */
  readonly indices: Uint32Array;
  /**
   * One region per triangle: `0` base cap, `1` top cap, `2 + segmentIndex` a
   * side. `segmentKeys[segmentIndex]` is the outline edge key it belongs to.
   */
  readonly regions: Uint32Array;
  /** One outline edge key per profile point; safe integers, never truncated. */
  readonly segmentKeys: Float64Array;
  readonly bounds: FormBounds;
  /** XZ footprint ring in local metres, counter-clockwise. */
  readonly footprint: readonly (readonly [number, number])[];
  /** Lowest local Y of the body. */
  readonly contactMinY: number;
};

export type ExtrudeFormInput = {
  readonly profile: EvaluatedProfile;
  readonly extent: number;
  readonly scale: readonly [number, number, number];
  readonly plane: 'plan' | 'elevation';
};

/** Extrude one valid profile. Invalid limits refuse; they are never clamped. */
export function extrudeProfile(input: ExtrudeFormInput): FormMesh {
  const { profile, extent, scale, plane } = input;
  if (plane !== 'plan' && plane !== 'elevation') {
    throw new GeometryCoreError(`Unknown form plane "${String(plane)}".`);
  }
  assertFiniteRange(extent, PROFILE_LIMITS.minExtentMeters, PROFILE_LIMITS.maxExtentMeters, 'extent');
  for (const factor of scale) {
    assertFiniteRange(factor, PROFILE_LIMITS.minScale, PROFILE_LIMITS.maxScale, 'scale');
  }
  const count = profile.points.length / 2;
  if (count < PROFILE_LIMITS.minAnchors) {
    throw new GeometryCoreError('An evaluated profile needs at least three points.');
  }

  const [scaleX, scaleY, scaleZ] = scale;
  const width = (profile.bounds.maxU - profile.bounds.minU) * scaleX;
  const depth = (profile.bounds.maxV - profile.bounds.minV) * scaleZ;
  const height =
    plane === 'plan'
      ? extent * scaleY
      : (profile.bounds.maxV - profile.bounds.minV) * scaleY;
  const thickness = plane === 'plan' ? depth : height;
  assertScaledDimension(width, 'width');
  if (plane === 'plan') {
    assertScaledDimension(height, 'height');
    assertScaledDimension(depth, 'depth');
  } else {
    assertScaledDimension(height, 'height');
    assertScaledDimension(extent * scaleZ, 'depth');
  }
  if (!Number.isFinite(thickness) || thickness <= 0) {
    throw new GeometryCoreError('The extruded body has no positive thickness.');
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const regions: number[] = [];

  // Cap vertices are separate from side vertices so ordinary vertex normals
  // stay flat on each cap and crease only where the source requires it.
  for (let index = 0; index < count; index += 1) {
    const u = profile.points[index * 2]!;
    const v = profile.points[index * 2 + 1]!;
    if (plane === 'plan') {
      positions.push(u * scaleX, 0, v * scaleZ);
    } else {
      positions.push(u * scaleX, v * scaleY, 0);
    }
  }
  const topStart = count;
  for (let index = 0; index < count; index += 1) {
    const u = profile.points[index * 2]!;
    const v = profile.points[index * 2 + 1]!;
    if (plane === 'plan') {
      positions.push(u * scaleX, extent * scaleY, v * scaleZ);
    } else {
      positions.push(u * scaleX, v * scaleY, extent * scaleZ);
    }
  }

  // Plan: a positively oriented profile triangle faces −Y at the base, so the
  // base keeps profile order and the top reverses it. Elevation: it faces +Z,
  // so the top keeps profile order and the base reverses it.
  const baseStart = 0;
  const topIndexStart = topStart;
  for (let triangle = 0; triangle < profile.triangles.length; triangle += 3) {
    const a = profile.triangles[triangle]!;
    const b = profile.triangles[triangle + 1]!;
    const c = profile.triangles[triangle + 2]!;
    if (plane === 'plan') {
      indices.push(a, b, c);
      regions.push(0);
      indices.push(topIndexStart + a, topIndexStart + c, topIndexStart + b);
      regions.push(1);
    } else {
      indices.push(a + baseStart, c + baseStart, b + baseStart);
      regions.push(0);
      indices.push(topIndexStart + a, topIndexStart + b, topIndexStart + c);
      regions.push(1);
    }
  }

  // Side vertices: shared along smooth-anchor samples, duplicated at straight
  // anchors so normals crease at corners and stay smooth along curves.
  const startBottom = new Uint32Array(count);
  const startTop = new Uint32Array(count);
  const endBottom = new Uint32Array(count);
  const endTop = new Uint32Array(count);
  for (let index = 0; index < count; index += 1) {
    const u = profile.points[index * 2]!;
    const v = profile.points[index * 2 + 1]!;
    const bottom =
      plane === 'plan'
        ? [u * scaleX, 0, v * scaleZ]
        : [u * scaleX, v * scaleY, 0];
    const top =
      plane === 'plan'
        ? [u * scaleX, extent * scaleY, v * scaleZ]
        : [u * scaleX, v * scaleY, extent * scaleZ];
    const crease = profile.pointCreases[index] === 1;
    const startBottomIndex = positions.length / 3;
    positions.push(...bottom);
    const startTopIndex = positions.length / 3;
    positions.push(...top);
    if (crease) {
      const endBottomIndex = positions.length / 3;
      positions.push(...bottom);
      const endTopIndex = positions.length / 3;
      positions.push(...top);
      startBottom[index] = startBottomIndex;
      startTop[index] = startTopIndex;
      endBottom[index] = endBottomIndex;
      endTop[index] = endTopIndex;
    } else {
      startBottom[index] = startBottomIndex;
      startTop[index] = startTopIndex;
      endBottom[index] = startBottomIndex;
      endTop[index] = startTopIndex;
    }
  }

  for (let segment = 0; segment < count; segment += 1) {
    const next = (segment + 1) % count;
    const bs = startBottom[segment]!;
    const ts = startTop[segment]!;
    const be = endBottom[next]!;
    const te = endTop[next]!;
    if (plane === 'plan') {
      indices.push(bs, ts, te);
      regions.push(2 + segment);
      indices.push(bs, te, be);
      regions.push(2 + segment);
    } else {
      indices.push(bs, be, te);
      regions.push(2 + segment);
      indices.push(bs, te, ts);
      regions.push(2 + segment);
    }
  }

  const volume = signedVolume(positions, indices);
  if (!Number.isFinite(volume) || volume === 0) {
    throw new GeometryCoreError('The extruded body has no positive signed volume.');
  }
  if (volume < 0) {
    for (let index = 0; index < indices.length; index += 3) {
      const swap = indices[index + 1]!;
      indices[index + 1] = indices[index + 2]!;
      indices[index + 2] = swap;
    }
  }

  const footprint =
    plane === 'plan'
      ? footprintOfPlan(profile, scaleX, scaleZ)
      : footprintOfElevation(profile, scaleX, extent, scaleZ);
  const contactMinY = plane === 'plan' ? 0 : profile.bounds.minV * scaleY;

  return {
    positions: new Float64Array(positions),
    indices: new Uint32Array(indices),
    regions: new Uint32Array(regions),
    segmentKeys: new Float64Array(profile.pointEdgeKeys),
    bounds: boundsOf(positions),
    footprint,
    contactMinY
  };
}

function footprintOfPlan(
  profile: EvaluatedProfile,
  scaleX: number,
  scaleZ: number
): readonly (readonly [number, number])[] {
  const points: (readonly [number, number])[] = [];
  for (let index = 0; index < profile.points.length; index += 2) {
    points.push([
      profile.points[index]! * scaleX,
      profile.points[index + 1]! * scaleZ
    ]);
  }
  return points;
}

function footprintOfElevation(
  profile: EvaluatedProfile,
  scaleX: number,
  extent: number,
  scaleZ: number
): readonly (readonly [number, number])[] {
  const minX = profile.bounds.minU * scaleX;
  const maxX = profile.bounds.maxU * scaleX;
  const maxZ = extent * scaleZ;
  return [
    [minX, 0],
    [maxX, 0],
    [maxX, maxZ],
    [minX, maxZ]
  ];
}

function boundsOf(positions: readonly number[]): FormBounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index]!;
    const y = positions[index + 1]!;
    const z = positions[index + 2]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** `Σ p0 · (p1 × p2) / 6` over the triangles. */
function signedVolume(positions: readonly number[], indices: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    const ax = positions[a]!;
    const ay = positions[a + 1]!;
    const az = positions[a + 2]!;
    const bx = positions[b]!;
    const by = positions[b + 1]!;
    const bz = positions[b + 2]!;
    const cx = positions[c]!;
    const cy = positions[c + 1]!;
    const cz = positions[c + 2]!;
    total +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return total / 6;
}

function assertFiniteRange(
  value: number,
  minimum: number,
  maximum: number,
  name: string
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new GeometryCoreError(
      `A form ${name} must be finite and within [${minimum}, ${maximum}] m; received ${value}.`
    );
  }
}

function assertScaledDimension(value: number, name: string): void {
  if (
    !Number.isFinite(value) ||
    value < PROFILE_LIMITS.minScaledDimensionMeters ||
    value > PROFILE_LIMITS.maxScaledDimensionMeters
  ) {
    throw new GeometryCoreError(
      `A scaled form ${name} must be within [${PROFILE_LIMITS.minScaledDimensionMeters}, ${PROFILE_LIMITS.maxScaledDimensionMeters}] m; received ${value}.`
    );
  }
}
