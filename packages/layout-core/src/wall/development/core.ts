import type { CurveSample } from '../../geometry/curve';
import { CURVE_ENDPOINT_EPSILON } from '../../geometry/curve';
import { countWork } from '../../kernel/work-observer';
import { DEVELOPMENT_EPSILON, clamp, insertAnchor, nearestAngle, unwrapAngle, wrap, wrapSignedAngle } from './shared';
import type { WallDevelopment, WallDevelopmentBuffers, WallDevelopmentRefusal } from './types';

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
  const thetaA = development.anchorDirection;
  const points = out.points;
  const normals = out.normals;
  points[anchor * 2] = development.anchorPoint[0];
  points[anchor * 2 + 1] = development.anchorPoint[1];

  // Signed tangent deviation from the anchor tangent. On an open Wall this is
  // the ordinary unwrapped difference. On a closed Wall each sample is wrapped
  // into (−π, π], so both halves of the loop leave the pin the short way and
  // neither wing can accumulate a spurious full turn.
  const deviationAt = (index: number): number => {
    const delta = development.theta[index]! - thetaA;
    return development.closed ? wrapSignedAngle(delta) : delta;
  };
  const segmentTurn = (index: number): number => {
    const delta = deviationAt(index + 1) - deviationAt(index);
    return development.closed ? nearestAngle(delta, 0) : delta;
  };
  const chordDeviation = (index: number): number =>
    nearestAngle(
      development.phi[index]! - thetaA,
      (deviationAt(index) + deviationAt(index + 1)) / 2
    );
  const segmentLength = (index: number): number => {
    const halfTurn = segmentTurn(index) / 2;
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
    // The signed arc's chord turns only half as far as its tangent: the
    // deviation is scaled by (1 − u) and the length by sinc of that same
    // relaxed turn. Both wings therefore follow one continuous development.
    const direction = thetaA + (1 - amount) * chordDeviation(index);
    const length = segmentLength(index);
    points[(index + 1) * 2] = points[index * 2]! + length * Math.cos(direction);
    points[(index + 1) * 2 + 1] = points[index * 2 + 1]! + length * Math.sin(direction);
  }
  for (let index = anchor - 1; index >= 0; index -= 1) {
    const direction = thetaA + (1 - amount) * chordDeviation(index);
    const length = segmentLength(index);
    points[index * 2] = points[(index + 1) * 2]! - length * Math.cos(direction);
    points[index * 2 + 1] = points[(index + 1) * 2 + 1]! - length * Math.sin(direction);
  }
  for (let index = 0; index < count; index += 1) {
    // Normals come from the developed tangent itself, never from a separately
    // blended canonical table, so they stay perpendicular to this centerline.
    const angle = thetaA + (1 - amount) * deviationAt(index) + Math.PI / 2;
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
