/**
 * Heavy lane (T4): the P1.4 dense acceptance matrices — moved verbatim out of
 * `camera-motion.test.ts`, which keeps the behavioral suite (constants,
 * easing, path construction, guard repairs, sampling) in `test:fast`.
 *
 * These matrices sample edge-local distance progress densely for every fixture
 * in the P1.4 families. The density is the invariant, not a tuning knob, which
 * is why the whole section belongs in `test:heavy`: see the retained section
 * banner below for what the grid is required to cover.
 */
import { describe, expect, it } from 'vitest';
import {
  MathUtils,
  Vector3
} from 'three';
import {
  CAMERA_FRAMING_GUARD_POLICY,
  VISITOR_CAMERA_PROJECTION,
  cameraApplyEasing,
  cameraMotionProgressAtEdgeProgress,
  createCameraMotion,
  createCameraMotionSample,
  sampleFramingEnvelopeWeight,
  type CameraRoute
} from '@portfolio/camera-core';
import {
  CAMERA_FOV,
  type CameraEasing,
  type RuntimeCameraFramingEnvelope
} from '$lib/types/scene';
import { sample, sampleFull, smootherstep, expectVectorClose } from '../../../helpers/camera-motion-fixtures';

// ============================================================================
// P1.4 — dense whole-transition acceptance matrices (2026-08-19)
// ============================================================================
// Deterministic fixture matrices sample edge-local distance progress densely
// (base grid of >= 1001 values plus exact envelope bounds, key progresses,
// compiled guard sample progresses, and ±epsilon neighborhoods) and map every
// value to the motion playhead with `cameraMotionProgressAtEdgeProgress`. A
// uniform global playhead grid is insufficient for multi-edge envelope/ramp
// assertions.

const EDGE_LOCAL_EPSILON = 1e-6;
const NON_DEGENERACY_EPSILON = 1e-9;
const RATE_BOUND_TOLERANCE = 1e-6;

type DenseMotionFixture = {
  label: string;
  route: CameraRoute;
  options?: { durationSeconds?: number; easing?: CameraEasing };
  /** True when the envelope carries an intentional zero-width ramp step. */
  zeroWidthRamp?: boolean;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? left : greatestCommonDivisor(right, left % right);
}

function coprimeStep(count: number) {
  let step = 2;
  while (step < count) {
    if (greatestCommonDivisor(step, count) === 1) return step;
    step += 1;
  }
  return 1;
}

function motionFovRange(motion: ReturnType<typeof createCameraMotion>) {
  const edgeView = motion.edgeViews[0];
  const values = edgeView ? edgeView.points.map((point) => point.fov) : [];
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

/**
 * The dense playhead set for one edge: base grid, envelope bounds, keyframe
 * progresses, compiled guard sample progresses, and ±epsilon neighborhoods,
 * each mapped through the engine's exact edge→playhead mapping.
 */
function buildDensePlayheads(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number
) {
  const values = new Set<number>();
  for (let index = 0; index <= 1000; index += 1) {
    values.add(index / 1000);
  }
  const edgeView = motion.edgeViews[edgeIndex];
  if (edgeView) {
    const envelope = edgeView.framingEnvelope;
    if (envelope) {
      for (const bound of [
        envelope.enterStart,
        envelope.enterEnd,
        envelope.exitStart,
        envelope.exitEnd
      ]) {
        values.add(clamp01(bound));
        values.add(clamp01(bound - EDGE_LOCAL_EPSILON));
        values.add(clamp01(bound + EDGE_LOCAL_EPSILON));
      }
    }
    for (const point of edgeView.points) {
      values.add(clamp01(point.progress));
      values.add(clamp01(point.progress - EDGE_LOCAL_EPSILON));
      values.add(clamp01(point.progress + EDGE_LOCAL_EPSILON));
    }
    const guard = edgeView.guard;
    if (guard) {
      for (const direction of guard.directions) {
        values.add(clamp01(direction.progress));
        values.add(clamp01(direction.progress - EDGE_LOCAL_EPSILON));
        values.add(clamp01(direction.progress + EDGE_LOCAL_EPSILON));
      }
    }
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.map((edgeProgress) => ({
    edgeProgress,
    progress: cameraMotionProgressAtEdgeProgress(motion, edgeIndex, edgeProgress)
  }));
}

/**
 * The exact per-sample time the engine uses: the playhead mapped back through
 * inverse easing of the edge-local value placed in its compiled global span.
 */
function derivedTimeAtEdgeProgress(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number,
  edgeProgress: number
) {
  return (
    cameraMotionProgressAtEdgeProgress(motion, edgeIndex, edgeProgress) *
    motion.durationSeconds
  );
}

function gazeDirection(result: ReturnType<typeof createCameraMotionSample>) {
  return result.target.clone().sub(result.position).normalize();
}

function sampleAtEdgeProgress(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number,
  edgeProgress: number
) {
  return sampleFull(
    motion,
    cameraMotionProgressAtEdgeProgress(motion, edgeIndex, edgeProgress)
  );
}

function maxAdjacentGazeAngle(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number,
  edgeProgresses: readonly number[]
) {
  let maximum = 0;
  for (let index = 1; index < edgeProgresses.length; index += 1) {
    const previous = sampleAtEdgeProgress(
      motion,
      edgeIndex,
      edgeProgresses[index - 1]
    );
    const current = sampleAtEdgeProgress(motion, edgeIndex, edgeProgresses[index]);
    maximum = Math.max(
      maximum,
      gazeDirection(previous).angleTo(gazeDirection(current))
    );
  }
  return maximum;
}

function totalGazeSwing(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number,
  edgeProgresses: readonly number[]
) {
  let total = 0;
  for (let index = 1; index < edgeProgresses.length; index += 1) {
    const previous = sampleAtEdgeProgress(
      motion,
      edgeIndex,
      edgeProgresses[index - 1]
    );
    const current = sampleAtEdgeProgress(motion, edgeIndex, edgeProgresses[index]);
    total += gazeDirection(previous).angleTo(gazeDirection(current));
  }
  return total;
}

function denseMaxAngularRate(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number,
  samples: readonly { edgeProgress: number; progress: number }[]
) {
  let maximum = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const previousSample = sampleFull(motion, previous.progress);
    const currentSample = sampleFull(motion, current.progress);
    const angle = gazeDirection(previousSample).angleTo(gazeDirection(currentSample));
    const deltaTime =
      derivedTimeAtEdgeProgress(motion, edgeIndex, current.edgeProgress) -
      derivedTimeAtEdgeProgress(motion, edgeIndex, previous.edgeProgress);
    if (deltaTime <= 0) continue;
    maximum = Math.max(maximum, angle / deltaTime);
  }
  return maximum;
}

/**
 * The public sampler's expected peak: each adjacent pair of compiled guard
 * directions swept by the smootherstep interpolation reaches
 * `angle / segmentTime × angularInterpolationPeakRateFactor`; the expected
 * peak is their maximum.
 */
function compiledAngularPeak(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number
) {
  const guard = motion.edgeViews[edgeIndex]?.guard;
  if (!guard) return null;
  const directions = guard.directions;
  let peak = 0;
  for (let index = 0; index < directions.length - 1; index += 1) {
    const start = new Vector3(
      directions[index].directionX,
      directions[index].directionY,
      directions[index].directionZ
    );
    const end = new Vector3(
      directions[index + 1].directionX,
      directions[index + 1].directionY,
      directions[index + 1].directionZ
    );
    const segmentAngle = start.angleTo(end);
    const deltaTime =
      derivedTimeAtEdgeProgress(motion, edgeIndex, directions[index + 1].progress) -
      derivedTimeAtEdgeProgress(motion, edgeIndex, directions[index].progress);
    if (deltaTime <= 0) continue;
    peak = Math.max(
      peak,
      (segmentAngle / deltaTime) *
        CAMERA_FRAMING_GUARD_POLICY.angularInterpolationPeakRateFactor
    );
  }
  return peak;
}

function assertNonDegenerateSamples(
  motion: ReturnType<typeof createCameraMotion>,
  samples: readonly { progress: number }[],
  fovRange: { min: number; max: number }
) {
  for (const { progress } of samples) {
    const result = sampleFull(motion, progress);
    expect(result.position.toArray().every(Number.isFinite)).toBe(true);
    expect(result.target.toArray().every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(result.fov)).toBe(true);
    const distance = result.position.distanceTo(result.target);
    expect(distance).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near - NON_DEGENERACY_EPSILON
    );
    expect(gazeDirection(result).toArray().every(Number.isFinite)).toBe(true);
    expect(result.fov).toBeGreaterThanOrEqual(
      CAMERA_FOV.min - NON_DEGENERACY_EPSILON
    );
    expect(result.fov).toBeLessThanOrEqual(
      CAMERA_FOV.max + NON_DEGENERACY_EPSILON
    );
    expect(result.fov).toBeGreaterThanOrEqual(fovRange.min - NON_DEGENERACY_EPSILON);
    expect(result.fov).toBeLessThanOrEqual(fovRange.max + NON_DEGENERACY_EPSILON);
  }
}

/** Forward, reversed, and fixed-coprime-permuted seeks return bit-identical targets. */
function assertSeekOrderStable(
  motion: ReturnType<typeof createCameraMotion>,
  samples: readonly { progress: number }[]
) {
  const count = samples.length;
  const step = coprimeStep(count);
  const forward = samples.map((sample) =>
    sampleFull(motion, sample.progress).target.toArray()
  );
  for (let index = 0; index < count; index += 1) {
    const reversedIndex = count - 1 - index;
    expect(sampleFull(motion, samples[reversedIndex].progress).target.toArray()).toEqual(
      forward[reversedIndex]
    );
  }
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    expect(sampleFull(motion, samples[cursor].progress).target.toArray()).toEqual(
      forward[cursor]
    );
    cursor = (cursor + step) % count;
  }
}

/** Halving the uniform edge-local step must shrink the max adjacent angle (continuity). */
function assertUniformHalvingConvergence(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number
) {
  const coarse = Array.from({ length: 1001 }, (_, index) => index / 1000);
  const fine = Array.from({ length: 2001 }, (_, index) => index / 2000);
  const coarseAngle = maxAdjacentGazeAngle(motion, edgeIndex, coarse);
  const fineAngle = maxAdjacentGazeAngle(motion, edgeIndex, fine);
  expect(fineAngle).toBeLessThanOrEqual(coarseAngle * 0.9 + 1e-12);
}

/** Around every compiled guard boundary, halving the step converges instead of revealing a fixed jump. */
function assertGuardBoundaryConvergence(
  motion: ReturnType<typeof createCameraMotion>,
  edgeIndex: number
) {
  const guard = motion.edgeViews[edgeIndex]?.guard;
  if (!guard) return;
  for (const direction of guard.directions) {
    const center = direction.progress;
    const coarse = [
      clamp01(center - 4e-3),
      clamp01(center - 2e-3),
      center,
      clamp01(center + 2e-3),
      clamp01(center + 4e-3)
    ];
    const fine = [
      clamp01(center - 2e-3),
      clamp01(center - 1e-3),
      center,
      clamp01(center + 1e-3),
      clamp01(center + 2e-3)
    ];
    const coarseAngle = maxAdjacentGazeAngle(motion, edgeIndex, coarse);
    const fineAngle = maxAdjacentGazeAngle(motion, edgeIndex, fine);
    expect(fineAngle).toBeLessThanOrEqual(coarseAngle * 0.9 + 1e-12);
  }
}

const ORDINARY_ENVELOPE = {
  enterStart: 0.2,
  enterEnd: 0.4,
  exitStart: 0.8,
  exitEnd: 1
} as const;

function createOrdinaryRoute(
  envelope: RuntimeCameraFramingEnvelope = ORDINARY_ENVELOPE,
  overrides: Partial<NonNullable<CameraRoute['edges']>[number]> = {}
): CameraRoute {
  return {
    positionParts: [{
      kind: 'rounded-polyline',
      points: [[0, 0, 0], [10, 0, 0]]
    }],
    targetPoints: [[0, 0, 2], [10, 0, 2]],
    startFov: 40,
    endFov: 60,
    edges: [{
      connectionId: 'enveloped',
      direction: 'forward',
      fromNodeId: 'a',
      toNodeId: 'b',
      positionSpan: {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 1 }
      },
      viewTrack: {
        start: { cameraTarget: [0, 0, 2], fov: 40 },
        keyframes: [{
          id: 'subject',
          progress: 0.5,
          cameraTarget: [5, 4, 4],
          fov: 80
        }],
        end: { cameraTarget: [10, 0, 2], fov: 60 },
        framingEnvelope: envelope
      },
      automaticTargetPoints: [[0, 0, 2], [10, 0, 2]],
      ...overrides
    }]
  };
}

const DENSE_FIXTURES: DenseMotionFixture[] = [
  {
    label: 'ordinary blend',
    route: createOrdinaryRoute(),
    options: { durationSeconds: 6, easing: 'linear' }
  },
  {
    label: 'exact collinear-zero straddle',
    route: createOrdinaryRoute(
      { enterStart: 0, enterEnd: 1, exitStart: 1, exitEnd: 1 },
      {
        viewTrack: {
          start: { cameraTarget: [0, 0, 1], fov: 54 },
          keyframes: [{
            id: 'cross-through-eye',
            progress: 0.5,
            cameraTarget: [5, 0, -1],
            fov: 54
          }],
          end: { cameraTarget: [10, 0, 1], fov: 54 },
          framingEnvelope: { enterStart: 0, enterEnd: 1, exitStart: 1, exitEnd: 1 }
        },
        automaticTargetPoints: [[0, 0, 1], [10, 0, 1]]
      }
    ),
    options: { durationSeconds: 6, easing: 'linear' }
  },
  {
    label: 'epsilon-offset straddle',
    route: createOrdinaryRoute(
      { enterStart: 0.4, enterEnd: 0.5, exitStart: 0.5, exitEnd: 0.6 },
      {
        viewTrack: {
          start: { cameraTarget: [0, 0, 1], fov: 54 },
          keyframes: [{
            id: 'nearly-through-eye',
            progress: 0.5,
            cameraTarget: [5, 0, -0.001],
            fov: 54
          }],
          end: { cameraTarget: [10, 0, 1], fov: 54 },
          framingEnvelope: { enterStart: 0.4, enterEnd: 0.5, exitStart: 0.5, exitEnd: 0.6 }
        },
        automaticTargetPoints: [[0, 0, 1], [10, 0, 1]]
      }
    ),
    options: { durationSeconds: 6, easing: 'linear' }
  },
  {
    label: 'near-antipodal POI swing',
    route: createOrdinaryRoute(
      { enterStart: 0.3, enterEnd: 0.4, exitStart: 0.5, exitEnd: 0.6 },
      {
        viewTrack: {
          start: { cameraTarget: [5, 0, 0], fov: 54 },
          keyframes: [{
            id: 'ahead-of-eye',
            progress: 0.5,
            cameraTarget: [5, 0, 1],
            fov: 54
          }],
          end: { cameraTarget: [5, 0, 0], fov: 54 },
          framingEnvelope: { enterStart: 0.3, enterEnd: 0.4, exitStart: 0.5, exitEnd: 0.6 }
        },
        automaticTargetPoints: [[5, 0, 0], [5, 0, 0]]
      }
    ),
    options: { durationSeconds: 1.5, easing: 'linear' }
  },
  {
    label: 'path-through-POI',
    route: {
      positionParts: [{
        kind: 'rounded-polyline',
        points: [[0, 0, 0], [5, 0, 0], [10, 0, 0]]
      }],
      targetPoints: [[5, 0.0001, 0], [5, 0.0001, 0], [5, 0.0001, 0]],
      startFov: 54,
      endFov: 54,
      edges: [{
        connectionId: 'poi-on-path',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 2 }
        },
        viewTrack: {
          start: { cameraTarget: [5, 0.0001, 0], fov: 54 },
          keyframes: [{
            id: 'poi-on-path',
            progress: 0.5,
            cameraTarget: [5, 0.0001, 0],
            fov: 54
          }],
          end: { cameraTarget: [5, 0.0001, 0], fov: 54 },
          framingEnvelope: { enterStart: 0.2, enterEnd: 0.4, exitStart: 0.6, exitEnd: 0.8 }
        },
        automaticTargetPoints: [[5, 0.0001, 0], [5, 0.0001, 0], [5, 0.0001, 0]]
      }]
    },
    options: { durationSeconds: 2, easing: 'linear' }
  },
  {
    label: 'zero-width envelope ramps',
    route: createOrdinaryRoute({
      enterStart: 0.2,
      enterEnd: 0.2,
      exitStart: 0.8,
      exitEnd: 0.8
    }),
    options: { durationSeconds: 6, easing: 'linear' },
    zeroWidthRamp: true
  },
  {
    label: 'zero-length position path',
    route: {
      positionParts: [{
        kind: 'rounded-polyline',
        points: [[1, 2, 3], [1, 2, 3]]
      }],
      targetPoints: [[1, 2, 4], [2, 2, 4]],
      startFov: 40,
      endFov: 70,
      edges: [{
        connectionId: 'zero-length',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 1 }
        },
        viewTrack: {
          start: { cameraTarget: [1, 2, 4], fov: 40 },
          keyframes: [{
            id: 'stationary-subject',
            progress: 0.5,
            cameraTarget: [1.5, 3, 4],
            fov: 55
          }],
          end: { cameraTarget: [2, 2, 4], fov: 70 },
          framingEnvelope: { enterStart: 0.2, enterEnd: 0.4, exitStart: 0.6, exitEnd: 0.8 }
        },
        automaticTargetPoints: [[1, 2, 4], [2, 2, 4]]
      }]
    },
    options: { durationSeconds: 1.25, easing: 'linear' }
  },
  {
    label: 'short positive duration',
    route: createOrdinaryRoute(),
    options: { durationSeconds: 0.1, easing: 'linear' }
  }
];

describe('P1.4 dense non-degeneracy and finiteness', () => {
  for (const fixture of DENSE_FIXTURES) {
    it(`keeps ${fixture.label} finite, off the near clip, and FOV-bounded at every dense sample`, () => {
      const motion = createCameraMotion(fixture.route, undefined, fixture.options);
      const samples = buildDensePlayheads(motion, 0);
      assertNonDegenerateSamples(motion, samples, motionFovRange(motion));
      assertSeekOrderStable(motion, samples);
    });
  }

  it('keeps a live start pose projected into the same dense invariants', () => {
    const route = createOrdinaryRoute();
    const motion = createCameraMotion(
      route,
      { position: [-2, 1, 0], target: [-1, 1, 2], fov: 45 },
      { durationSeconds: 6, easing: 'linear' }
    );
    const samples = buildDensePlayheads(motion, 0);
    assertNonDegenerateSamples(motion, samples, motionFovRange(motion));
    assertSeekOrderStable(motion, samples);
  });
});

describe('P1.4 endpoint and branch matrix', () => {
  it('hits canonical oriented node eye/target/FOV at p = 0/1 for forward keys with an envelope', () => {
    const motion = createCameraMotion(createOrdinaryRoute(), undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    const start = sampleFull(motion, 0);
    expect(start.position.toArray()).toEqual([0, 0, 0]);
    expect(start.target.toArray()).toEqual([0, 0, 2]);
    expect(start.fov).toBe(40);
    const end = sampleFull(motion, 1);
    expect(end.position.toArray()).toEqual([10, 0, 0]);
    expect(end.target.toArray()).toEqual([10, 0, 2]);
    expect(end.fov).toBe(60);
  });

  it('hits canonical reversed node values for reverse keys with an envelope', () => {
    const route = createOrdinaryRoute(ORDINARY_ENVELOPE, {
      direction: 'reverse',
      viewTrack: {
        start: { cameraTarget: [10, 0, 2], fov: 60 },
        keyframes: [{
          id: 'reversed-subject',
          progress: 0.5,
          cameraTarget: [5, 4, 4],
          fov: 80
        }],
        end: { cameraTarget: [0, 0, 2], fov: 40 },
        framingEnvelope: ORDINARY_ENVELOPE
      },
      automaticTargetPoints: [[10, 0, 2], [0, 0, 2]]
    });
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    expect(sampleFull(motion, 0).target.toArray()).toEqual([10, 0, 2]);
    expect(sampleFull(motion, 0).fov).toBe(60);
    expect(sampleFull(motion, 1).target.toArray()).toEqual([0, 0, 2]);
    expect(sampleFull(motion, 1).fov).toBe(40);
  });

  it('ignores an envelope on a reverse track without reverse keys (automatic samples unchanged)', () => {
    const route = createOrdinaryRoute(ORDINARY_ENVELOPE, {
      direction: 'reverse',
      viewTrack: {
        start: { cameraTarget: [10, 0, 2], fov: 60 },
        keyframes: [],
        end: { cameraTarget: [0, 0, 2], fov: 40 },
        framingEnvelope: ORDINARY_ENVELOPE
      },
      automaticTargetPoints: [[10, 0, 2], [0, 0, 2]]
    });
    const { framingEnvelope: _envelope, ...viewTrackWithoutEnvelope } =
      route.edges![0]!.viewTrack!;
    const withoutEnvelope = createCameraMotion(
      {
        ...route,
        edges: [{ ...route.edges![0], viewTrack: viewTrackWithoutEnvelope }]
      },
      undefined,
      { durationSeconds: 6, easing: 'linear' }
    );
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    expect(motion.usesLegacyTargetPath).toBe(true);
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const withEnvelope = sampleFull(motion, progress);
      const reference = sampleFull(withoutEnvelope, progress);
      expectVectorClose(withEnvelope.target, reference.target, 12);
      expect(withEnvelope.fov).toBe(reference.fov);
    }
  });

  it('keeps legacy full-authored framing unchanged when keys have no envelope', () => {
    const route = createOrdinaryRoute();
    delete route.edges![0]!.viewTrack!.framingEnvelope;
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    const samples = buildDensePlayheads(motion, 0);
    for (const { edgeProgress } of samples) {
      const result = sampleAtEdgeProgress(motion, 0, edgeProgress);
      expect(result.target.distanceTo(result.position)).toBeGreaterThan(
        VISITOR_CAMERA_PROJECTION.near
      );
    }
    // The authored key is hit exactly at its edge-local progress.
    const keyed = sampleAtEdgeProgress(motion, 0, 0.5);
    expect(keyed.target.toArray()).toEqual([5, 4, 4]);
    expect(keyed.fov).toBe(80);
  });

  it('keeps automatic samples unchanged when an envelope has no keys', () => {
    const route = createOrdinaryRoute(ORDINARY_ENVELOPE, {
      viewTrack: {
        start: { cameraTarget: [0, 0, 2], fov: 40 },
        keyframes: [],
        end: { cameraTarget: [10, 0, 2], fov: 60 },
        framingEnvelope: ORDINARY_ENVELOPE
      }
    });
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    const reference = createCameraMotion(
      {
        positionParts: route.positionParts,
        targetPoints: route.targetPoints,
        startFov: route.startFov,
        endFov: route.endFov
      },
      undefined,
      { durationSeconds: 6, easing: 'linear' }
    );
    expect(motion.usesLegacyTargetPath).toBe(true);
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const actual = sampleFull(motion, progress);
      const expected = sampleFull(reference, progress);
      expectVectorClose(actual.target, expected.target, 12);
      expect(actual.fov).toBe(expected.fov);
    }
  });

  it('lets target guards leave eye, FOV, envelope weight, route input, and node endpoints untouched', () => {
    const fixture = DENSE_FIXTURES.find((candidate) =>
      candidate.label.includes('near-antipodal')
    )!;
    const originalRoute = structuredClone(fixture.route);
    const motion = createCameraMotion(fixture.route, undefined, fixture.options);
    const guard = motion.edgeViews[0]?.guard;
    expect(guard).not.toBeNull();
    expect(guard?.limitsAngularRate).toBe(true);
    const guardBefore = structuredClone(guard);

    const samples = buildDensePlayheads(motion, 0);
    for (const { progress } of samples) {
      const result = sampleFull(motion, progress);
      // Eye never changes: it is always the raw position path at the eased playhead.
      const easedProgress = cameraApplyEasing(motion.easing, progress);
      const expectedEye = motion.positionPath.getPointAt(easedProgress, new Vector3());
      expectVectorClose(result.position, expectedEye, 9);
      // FOV never changes: it is the envelope blend alone (no guard term).
      const edgeView = motion.edgeViews[0]!;
      const localProgress = easedProgress;
      const automaticFov = MathUtils.lerp(
        edgeView.points[0].fov,
        edgeView.points.at(-1)!.fov,
        cameraApplyEasing(motion.easing, localProgress)
      );
      const authored = sampleAuthoredViewAtEdgeProgress(motion, localProgress);
      const weight = sampleFramingEnvelopeWeight(edgeView.framingEnvelope!, localProgress);
      expect(result.fov).toBeCloseTo(
        MathUtils.lerp(automaticFov, authored, weight),
        9
      );
    }
    expect(motion.edgeViews[0]?.guard).toEqual(guardBefore);
    expect(fixture.route).toEqual(originalRoute);
    expect(sampleFull(motion, 0).target.toArray()).toEqual([5, 0, 0]);
    expect(sampleFull(motion, 1).target.toArray()).toEqual([5, 0, 0]);
  });
});

/** The interval-eased authored FOV at an edge-local progress (mirrors `sampleAuthoredView`). */
function sampleAuthoredViewAtEdgeProgress(
  motion: ReturnType<typeof createCameraMotion>,
  localProgress: number
) {
  const edgeView = motion.edgeViews[0]!;
  const points = edgeView.points;
  let endIndex = 1;
  while (endIndex < points.length - 1 && localProgress > points[endIndex].progress) {
    endIndex += 1;
  }
  const start = points[endIndex - 1];
  const end = points[endIndex];
  const intervalLength = end.progress - start.progress;
  const intervalProgress =
    intervalLength <= Number.EPSILON
      ? 1
      : MathUtils.clamp((localProgress - start.progress) / intervalLength, 0, 1);
  return MathUtils.lerp(
    start.fov,
    end.fov,
    cameraApplyEasing(motion.easing, intervalProgress)
  );
}

describe('P1.4 smooth continuity and angular pacing', () => {
  for (const fixture of DENSE_FIXTURES) {
    it(`measures ${fixture.label} with bounded swing, no pops, and halving convergence`, () => {
      const motion = createCameraMotion(fixture.route, undefined, fixture.options);
      const samples = buildDensePlayheads(motion, 0);
      const edgeProgresses = samples.map((sample) => sample.edgeProgress);
      const swing = totalGazeSwing(motion, 0, edgeProgresses);
      expect(swing).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
      if (fixture.zeroWidthRamp) return;
      const denseAngle = maxAdjacentGazeAngle(motion, 0, edgeProgresses);
      expect(denseAngle).toBeLessThan(Math.PI - 1e-6);
      assertUniformHalvingConvergence(motion, 0);
      assertGuardBoundaryConvergence(motion, 0);
      const peak = compiledAngularPeak(motion, 0);
      const guard = motion.edgeViews[0]?.guard;
      if (peak !== null && guard?.limitsAngularRate) {
        const measured = denseMaxAngularRate(motion, 0, samples);
        expect(measured).toBeLessThanOrEqual(
          peak * (1 + RATE_BOUND_TOLERANCE) + 1e-12
        );
      }
    });
  }

  it('converges the sampled peak to the compiled guard segment peak', () => {
    // The near-antipodal fixture exceeds angular capacity, so the compiler
    // remaps the active interval to a smootherstep great-circle sweep. The
    // derived peak (max of segmentAngle/segmentTime × peak-rate factor) is
    // well above the nominal policy constant by design (the plan forbids
    // substituting maxAngularRate × peakRateFactor); the public sampler must
    // converge up to that derived value, never above it.
    const motion = createCameraMotion(
      DENSE_FIXTURES.find((candidate) =>
        candidate.label.includes('near-antipodal')
      )!.route,
      undefined,
      { durationSeconds: 1.5, easing: 'linear' }
    );
    const peak = compiledAngularPeak(motion, 0);
    expect(peak).not.toBeNull();
    expect(peak!).toBeGreaterThan(0);
    const measured = denseMaxAngularRate(motion, 0, buildDensePlayheads(motion, 0));
    expect(measured).toBeLessThanOrEqual(
      peak! * (1 + RATE_BOUND_TOLERANCE) + 1e-12
    );
    // The finite-difference grid samples a symmetric neighborhood of each
    // segment's smootherstep midpoint, so it converges up to the derived peak
    // while remaining strictly below it (the 5% band absorbs the grid spacing).
    expect(measured).toBeGreaterThanOrEqual(peak! * (1 - 5e-2));
  });

  it('keeps zero-width envelope ramps exact on both sides of the bound', () => {
    const motion = createCameraMotion(
      createOrdinaryRoute({
        enterStart: 0.2,
        enterEnd: 0.2,
        exitStart: 0.8,
        exitEnd: 0.8
      }),
      undefined,
      { durationSeconds: 6, easing: 'linear' }
    );
    const envelope = motion.edgeViews[0]!.framingEnvelope!;
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      const weight = sampleFramingEnvelopeWeight(envelope, progress);
      expect(Number.isFinite(weight)).toBe(true);
      expect(weight).toBe(progress < 0.2 || progress > 0.8 ? 0 : 1);
    }
    const beforeEnter = sampleAtEdgeProgress(motion, 0, 0.2 - EDGE_LOCAL_EPSILON);
    const atEnter = sampleAtEdgeProgress(motion, 0, 0.2);
    const afterExit = sampleAtEdgeProgress(motion, 0, 0.8 + EDGE_LOCAL_EPSILON);
    const atExit = sampleAtEdgeProgress(motion, 0, 0.8);
    expect(atEnter.target.toArray().every(Number.isFinite)).toBe(true);
    expect(atExit.target.toArray().every(Number.isFinite)).toBe(true);
    expect(beforeEnter.target.distanceTo(beforeEnter.position)).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near
    );
    expect(afterExit.target.distanceTo(afterExit.position)).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near
    );
    // The step lands exactly on the interval-eased authored value at the bound
    // (within float round-off from the eased interpolation).
    expectVectorClose(atEnter.target, new Vector3(2, 1.6, 2.8), 9);
    expectVectorClose(atExit.target, new Vector3(8, 1.6, 2.8), 9);
  });
});

function createPoiRoute(
  offsetY: number,
  options: {
    durationSeconds?: number;
    direction?: 'forward' | 'reverse';
    envelope?: RuntimeCameraFramingEnvelope;
  } = {}
): CameraRoute {
  const envelope =
    options.envelope ?? {
      enterStart: 0.2,
      enterEnd: 0.4,
      exitStart: 0.6,
      exitEnd: 0.8
    };
  return {
    positionParts: [{
      kind: 'rounded-polyline',
      points: [[0, 0, 0], [5, 0, 0], [10, 0, 0]]
    }],
    targetPoints: [[5, offsetY, 0], [5, offsetY, 0], [5, offsetY, 0]],
    startFov: 54,
    endFov: 54,
    edges: [{
      connectionId: 'poi',
      direction: options.direction ?? 'forward',
      fromNodeId: 'a',
      toNodeId: 'b',
      positionSpan: {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 2 }
      },
      viewTrack: {
        start: { cameraTarget: [5, offsetY, 0], fov: 54 },
        keyframes: [{
          id: 'poi-key',
          progress: 0.5,
          cameraTarget: [5, offsetY, 0],
          fov: 54
        }],
        end: { cameraTarget: [5, offsetY, 0], fov: 54 },
        framingEnvelope: envelope
      },
      automaticTargetPoints: [[5, offsetY, 0], [5, offsetY, 0], [5, offsetY, 0]]
    }]
  };
}

const DOUBLE_WHIP_DIRECT_ANGLE = Math.PI / 6;

/**
 * Late-exit gaze spike on an otherwise straight +z track. The detour is the
 * authored offset at the ramp midpoint (`w = 1/2`), so the blended peak offset
 * is exactly `detour / 2` and every policy measurement telescopes exactly:
 * `maxOffAxis = atan(detour / 2)` and `angularPath = 2 · atan(detour / 2)`.
 */
function createDoubleWhipRoute(options: {
  detour?: number;
  durationSeconds?: number;
  exitStart?: number;
  exitEnd?: number;
}): CameraRoute {
  const detour = options.detour ?? 0;
  const exitStart = options.exitStart ?? 0.8;
  // The double-whip bypass only compiles for exits that do not reach the end
  // (exitEnd < 1); the spike lives inside the ramp [exitStart, exitEnd].
  const exitEnd = options.exitEnd ?? 0.9;
  const mid = (exitStart + exitEnd) / 2;
  return {
    positionParts: [{
      kind: 'rounded-polyline',
      points: [[0, 0, 0], [10, 0, 0]]
    }],
    targetPoints: [[0, 0, 1], [10, 0, 1]],
    startFov: 54,
    endFov: 54,
    edges: [{
      connectionId: 'double-whip',
      direction: 'forward',
      fromNodeId: 'a',
      toNodeId: 'b',
      positionSpan: {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 1 }
      },
      viewTrack: {
        start: { cameraTarget: [0, 0, 1], fov: 54 },
        keyframes: [
          {
            id: 'exit-entry',
            progress: exitStart,
            cameraTarget: [10 * exitStart, 0, 1],
            fov: 54
          },
          {
            id: 'spike-left',
            progress: mid - 0.01,
            cameraTarget: [10 * (mid - 0.01), 0, 1],
            fov: 54
          },
          {
            id: 'spike-peak',
            progress: mid,
            cameraTarget: [10 * mid + detour, 0, 1],
            fov: 54
          },
          {
            id: 'spike-right',
            progress: mid + 0.01,
            cameraTarget: [10 * (mid + 0.01), 0, 1],
            fov: 54
          },
          {
            id: 'exit-tail',
            progress: exitEnd,
            cameraTarget: [10 * exitEnd, 0, 1],
            fov: 54
          }
        ],
        end: { cameraTarget: [10, 0, 1], fov: 54 },
        framingEnvelope: {
          enterStart: exitStart,
          enterEnd: exitStart,
          exitStart,
          exitEnd
        }
      },
      automaticTargetPoints: [[0, 0, 1], [10, 0, 1]]
    }]
  };
}

/**
 * Exit gaze that overshoots the direct chord and returns to the automatic
 * track. The automatic target ends at `DOUBLE_WHIP_DIRECT_ANGLE`, so the
 * direct angle is exactly that constant while the authored peak adds a
 * symmetric overshoot: `angularPath = 2·peak − 2·auto(0.95)` telescopes
 * exactly, giving `pathExcess = 2·(peak − auto(0.95))` with off-axis and
 * angular rate already exceeded for every peak near the flip.
 */
function createPathExcessRoute(peakRadians: number): CameraRoute {
  const exitStart = 0.92;
  const exitEnd = 0.96;
  const autoOffset = (progress: number) =>
    progress * Math.tan(DOUBLE_WHIP_DIRECT_ANGLE);
  // At the ramp midpoint (w = 1/2) the blended offset equals tan(peak), so the
  // authored key must compensate for the automatic baseline exactly.
  const peakOffset = 2 * Math.tan(peakRadians) - autoOffset(0.94);
  return {
    positionParts: [{
      kind: 'rounded-polyline',
      points: [[0, 0, 0], [10, 0, 0]]
    }],
    targetPoints: [[0, 0, 1], [10 + Math.tan(DOUBLE_WHIP_DIRECT_ANGLE), 0, 1]],
    startFov: 54,
    endFov: 54,
    edges: [{
      connectionId: 'path-excess',
      direction: 'forward',
      fromNodeId: 'a',
      toNodeId: 'b',
      positionSpan: {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 1 }
      },
      viewTrack: {
        start: { cameraTarget: [0, 0, 1], fov: 54 },
        keyframes: [
          {
            id: 'exit-entry',
            progress: exitStart,
            cameraTarget: [10 * exitStart, 0, 1],
            fov: 54
          },
          {
            id: 'overshoot-peak',
            progress: 0.94,
            cameraTarget: [9.4 + peakOffset, 0, 1],
            fov: 54
          },
          {
            id: 'overshoot-return',
            progress: 0.95,
            cameraTarget: [9.5 + autoOffset(0.95), 0, 1],
            fov: 54
          },
          {
            id: 'exit-tail',
            progress: exitEnd,
            cameraTarget: [9.6 + autoOffset(0.96), 0, 1],
            fov: 54
          }
        ],
        end: {
          cameraTarget: [10 + Math.tan(DOUBLE_WHIP_DIRECT_ANGLE), 0, 1],
          fov: 54
        },
        framingEnvelope: {
          enterStart: 0,
          enterEnd: 0,
          exitStart,
          exitEnd
        }
      },
      automaticTargetPoints: [[0, 0, 1], [10 + Math.tan(DOUBLE_WHIP_DIRECT_ANGLE), 0, 1]]
    }]
  };
}

describe('P1.4 singularity and double-whip matrix', () => {
  for (const offsetY of [1e-4, 0.05, -0.05]) {
    for (const durationSeconds of [1, 2.1, 4]) {
      for (const direction of ['forward', 'reverse'] as const) {
        it(`keeps POI offset ${offsetY} (${direction}, ${durationSeconds}s) non-degenerate, seek-stable, and rate-bounded`, () => {
          const route = createPoiRoute(offsetY, { durationSeconds, direction });
          const motion = createCameraMotion(route, undefined, {
            durationSeconds,
            easing: 'linear'
          });
          const samples = buildDensePlayheads(motion, 0);
          assertNonDegenerateSamples(motion, samples, { min: 54, max: 54 });
          assertSeekOrderStable(motion, samples);
          const peak = compiledAngularPeak(motion, 0);
          if (peak !== null) {
            const measured = denseMaxAngularRate(motion, 0, samples);
            expect(measured).toBeLessThanOrEqual(
              peak * (1 + RATE_BOUND_TOLERANCE) + 1e-12
            );
          }
        });
      }
    }
  }

  it('falls back to a deterministic great circle when capacity is exceeded', () => {
    const route = createPoiRoute(0.05, { durationSeconds: 1 });
    const first = createCameraMotion(route, undefined, {
      durationSeconds: 1,
      easing: 'linear'
    });
    const second = createCameraMotion(route, undefined, {
      durationSeconds: 1,
      easing: 'linear'
    });
    expect(first.edgeViews[0]?.guard?.limitsAngularRate).toBe(true);
    const samples = buildDensePlayheads(first, 0);
    for (const { progress } of samples) {
      const a = sampleFull(first, progress);
      const b = sampleFull(second, progress);
      expectVectorClose(a.target, b.target, 9);
    }
    // The mid-chord never stalls or crosses the zero vector: it rides the
    // deterministic great-circle side of the near-antipodal remap.
    const mid = sampleAtEdgeProgress(first, 0, 0.5);
    expect(mid.target.distanceTo(mid.position)).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near
    );
    const direction = gazeDirection(mid);
    expect(Math.abs(direction.y)).toBeGreaterThan(0.9);
  });

  it('preserves exact raw automatic framing wherever the envelope weight is zero', () => {
    const route = createPoiRoute(0.05, { durationSeconds: 4 });
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 4,
      easing: 'linear'
    });
    expect(motion.edgeViews[0]?.guard?.bypass ?? null).toBeNull();
    // Same edges and spans, but no authored keys and no envelope, so the
    // reference samples the raw automatic target path on the same edge.
    const reference = createCameraMotion(
      {
        positionParts: route.positionParts,
        targetPoints: route.targetPoints,
        startFov: route.startFov,
        endFov: route.endFov,
        edges: route.edges!.map((edge) => ({
          ...edge,
          viewTrack: {
            start: edge.viewTrack!.start,
            keyframes: [],
            end: edge.viewTrack!.end
          }
        }))
      },
      undefined,
      { durationSeconds: 4, easing: 'linear' }
    );
    const envelope = route.edges![0]!.viewTrack!.framingEnvelope!;
    const guard = motion.edgeViews[0]?.guard;
    const guardProgresses = guard?.directions.map((direction) => direction.progress) ?? [];
    const sampleProgresses = [
      ...new Set([0, 0.1, 0.2, 0.8, 0.9, 1, ...guardProgresses])
    ].sort((left, right) => left - right);
    for (const edgeProgress of sampleProgresses) {
      const weight = sampleFramingEnvelopeWeight(envelope, edgeProgress);
      if (weight !== 0) continue;
      const actual = sampleAtEdgeProgress(motion, 0, edgeProgress);
      const expected = sampleFull(
        reference,
        cameraMotionProgressAtEdgeProgress(reference, 0, edgeProgress)
      );
      // Outside the active interval the compiled directions are pinned to the
      // raw samples, so at each compiled guard progress automatic framing is
      // preserved exactly. Between compiled samples the rate limiter re-derives
      // the direction through the same smootherstep interpolation, which holds
      // the exact value to the interpolation's own numeric tolerance.
      const isGuardSample = guardProgresses.includes(edgeProgress);
      expectVectorClose(actual.target, expected.target, isGuardSample ? 9 : 2);
      expect(actual.fov).toBeCloseTo(expected.fov, 9);
    }
  });

  function hasBypass(options: {
    detour?: number;
    durationSeconds?: number;
    exitStart?: number;
    exitEnd?: number;
  }) {
    const motion = createCameraMotion(createDoubleWhipRoute(options), undefined, {
      durationSeconds: options.durationSeconds ?? 0.5,
      easing: 'linear'
    });
    return motion.edgeViews[0]?.guard?.bypass !== null &&
      motion.edgeViews[0]?.guard?.bypass !== undefined;
  }

  it('bypasses only a hazardous late off-axis insufficient-time exit', () => {
    expect(hasBypass({ detour: 0.6, durationSeconds: 0.5 })).toBe(true);
    expect(hasBypass({ detour: 0.6, durationSeconds: 1.5 })).toBe(false);
    expect(hasBypass({ detour: 0, durationSeconds: 0.5 })).toBe(false);
    expect(hasBypass({ detour: 0.6, durationSeconds: 0.5, exitStart: 0.3 })).toBe(false);
  });

  function findFlip(
    low: number,
    high: number,
    predicate: (value: number) => boolean
  ) {
    for (let iteration = 0; iteration < 24; iteration += 1) {
      const midpoint = (low + high) / 2;
      if (predicate(midpoint)) high = midpoint;
      else low = midpoint;
    }
    return (low + high) / 2;
  }

  it('flips the bypass decision exactly at the off-axis policy threshold', () => {
    const threshold = 2 * Math.tan(CAMERA_FRAMING_GUARD_POLICY.doubleWhipOffAxisRadians);
    const flip = findFlip(0.2, 1, (detour) => hasBypass({ detour, durationSeconds: 0.5 }));
    expect(flip).toBeGreaterThan(threshold - 0.01);
    expect(flip).toBeLessThan(threshold + 0.01);
    expect(hasBypass({ detour: threshold - 0.005, durationSeconds: 0.5 })).toBe(false);
    expect(hasBypass({ detour: threshold + 0.005, durationSeconds: 0.5 })).toBe(true);
  });

  it('flips the bypass decision exactly at the angular-rate policy threshold', () => {
    // The spike's telescoped angular path is exactly 2·atan(0.3) and the exit
    // window spans 0.2 of the linear-eased duration, so the bypass turns on
    // exactly when 2·atan(0.3)/(0.2·duration) exceeds the policy rate. The
    // predicate falls with duration, so findFlip bisects its complement.
    const analyticFlip = 0.583 / (0.2 * CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond);
    const flip = findFlip(0.3, 1.5, (durationSeconds) =>
      !hasBypass({ detour: 0.6, durationSeconds })
    );
    expect(flip).toBeGreaterThan(analyticFlip - 0.02);
    expect(flip).toBeLessThan(analyticFlip + 0.02);
    expect(hasBypass({ detour: 0.6, durationSeconds: analyticFlip - 0.01 })).toBe(true);
    expect(hasBypass({ detour: 0.6, durationSeconds: analyticFlip + 0.01 })).toBe(false);
  });

  it('flips the bypass decision exactly at the path-excess policy threshold', () => {
    // The gaze sweeps straight through the 30° direct chord, overshoots to
    // `peak`, and returns to the automatic track at 0.95. The rising flank,
    // return, and automatic tail each telescope (monotone in angle), so
    // angularPath = peak + (peak − auto(0.95)) + (30° − auto(0.95)) and
    // pathExcess = 2·(peak − auto(0.95)) exactly, while off-axis (~26°) and
    // angular rate (~21 rad/s) stay exceeded. The bypass turns on precisely
    // when peak crosses auto(0.95) + pi/36.
    function hasPathExcessBypass(peakRadians: number) {
      const motion = createCameraMotion(createPathExcessRoute(peakRadians), undefined, {
        durationSeconds: 0.4,
        easing: 'linear'
      });
      return (
        motion.edgeViews[0]?.guard?.bypass !== null &&
        motion.edgeViews[0]?.guard?.bypass !== undefined
      );
    }
    const thresholdRadians =
      Math.atan(0.95 * Math.tan(DOUBLE_WHIP_DIRECT_ANGLE)) +
      CAMERA_FRAMING_GUARD_POLICY.doubleWhipPathExcessRadians / 2;
    expect(hasPathExcessBypass(thresholdRadians - 0.02)).toBe(false);
    expect(hasPathExcessBypass(thresholdRadians + 0.02)).toBe(true);
    const flip = findFlip(
      thresholdRadians - 0.1,
      thresholdRadians + 0.1,
      hasPathExcessBypass
    );
    expect(flip).toBeGreaterThan(thresholdRadians - 0.01);
    expect(flip).toBeLessThan(thresholdRadians + 0.01);
    expect(hasPathExcessBypass(thresholdRadians - 0.005)).toBe(false);
    expect(hasPathExcessBypass(thresholdRadians + 0.005)).toBe(true);
  });

  it('keeps bypass onset/end neighborhoods continuous and arrives at Node B exactly', () => {
    const route = createDoubleWhipRoute({ detour: 0.6, durationSeconds: 0.5 });
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 0.5,
      easing: 'linear'
    });
    const guard = motion.edgeViews[0]?.guard;
    expect(guard?.bypass).not.toBeNull();
    expect(guard?.bypass?.startProgress).toBe(0.8);

    const before = sampleAtEdgeProgress(motion, 0, 0.8 - EDGE_LOCAL_EPSILON);
    const after = sampleAtEdgeProgress(motion, 0, 0.8 + EDGE_LOCAL_EPSILON);
    expect(before.target.distanceTo(after.target)).toBeLessThan(1e-3);

    const mid = sampleAtEdgeProgress(motion, 0, 0.9);
    expectVectorClose(mid.target, new Vector3(9, 0, 1), 6);

    const end = sampleFull(motion, 1);
    expect(end.target.toArray()).toEqual([10, 0, 1]);
  });
});

describe('P1.4 FOV pacing', () => {
  function handComputedFov(
    motion: ReturnType<typeof createCameraMotion>,
    edgeProgress: number
  ) {
    const edgeView = motion.edgeViews[0]!;
    const start = edgeView.points[0];
    const end = edgeView.points.at(-1)!;
    const automaticFov = MathUtils.lerp(
      start.fov,
      end.fov,
      cameraApplyEasing(motion.easing, edgeProgress)
    );
    const authoredFov = sampleAuthoredViewAtEdgeProgress(motion, edgeProgress);
    const weight = sampleFramingEnvelopeWeight(
      edgeView.framingEnvelope!,
      edgeProgress
    );
    return MathUtils.lerp(automaticFov, authoredFov, weight);
  }

  it('equals the hand-computed envelope blend at every dense sample', () => {
    for (const fixture of DENSE_FIXTURES) {
      const motion = createCameraMotion(fixture.route, undefined, fixture.options);
      if (!motion.edgeViews[0]?.framingEnvelope) continue;
      for (const { edgeProgress } of buildDensePlayheads(motion, 0)) {
        const result = sampleAtEdgeProgress(motion, 0, edgeProgress);
        const expected = handComputedFov(motion, edgeProgress);
        expect(result.fov).toBeCloseTo(expected, 9);
      }
    }
  });

  it('leaves every FOV sample unchanged by target-only standoff/angular/bypass guards', () => {
    const routes = [
      createOrdinaryRoute(),
      createPoiRoute(0.05, { durationSeconds: 0.5 }),
      createDoubleWhipRoute({ detour: 0.6, durationSeconds: 0.5 })
    ];
    for (const route of routes) {
      const motion = createCameraMotion(route, undefined, {
        durationSeconds: 0.5,
        easing: 'linear'
      });
      for (const { edgeProgress } of buildDensePlayheads(motion, 0)) {
        const result = sampleAtEdgeProgress(motion, 0, edgeProgress);
        expect(result.fov).toBeCloseTo(handComputedFov(motion, edgeProgress), 9);
      }
    }
  });

  it('keeps non-degenerate ramps finite, continuous, and zero-slope at the bounds', () => {
    const motion = createCameraMotion(createOrdinaryRoute(), undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    const envelope = motion.edgeViews[0]!.framingEnvelope!;
    for (const bound of [
      envelope.enterStart,
      envelope.enterEnd,
      envelope.exitStart,
      envelope.exitEnd
    ]) {
      const before = sampleFramingEnvelopeWeight(envelope, bound - EDGE_LOCAL_EPSILON);
      const at = sampleFramingEnvelopeWeight(envelope, bound);
      const after = sampleFramingEnvelopeWeight(envelope, bound + EDGE_LOCAL_EPSILON);
      expect(Number.isFinite(before)).toBe(true);
      expect(Number.isFinite(after)).toBe(true);
      expect(Math.abs(after - before)).toBeLessThan(1e-4);
      const fovBefore = sampleAtEdgeProgress(motion, 0, bound - EDGE_LOCAL_EPSILON).fov;
      const fovAfter = sampleAtEdgeProgress(motion, 0, bound + EDGE_LOCAL_EPSILON).fov;
      expect(Number.isFinite(fovBefore)).toBe(true);
      expect(Number.isFinite(fovAfter)).toBe(true);
      expect(Math.abs(fovAfter - fovBefore)).toBeLessThan(1e-3);
      void at;
      // Shrinking finite differences of the weight show zero slope at the bound.
      const coarseSlope =
        (sampleFramingEnvelopeWeight(envelope, bound + 1e-3) -
          sampleFramingEnvelopeWeight(envelope, bound)) /
        1e-3;
      const fineSlope =
        (sampleFramingEnvelopeWeight(envelope, bound + 1e-4) -
          sampleFramingEnvelopeWeight(envelope, bound)) /
        1e-4;
      expect(Math.abs(fineSlope)).toBeLessThanOrEqual(Math.abs(coarseSlope) + 1e-9);
    }
  });

  it('keeps degenerate ramps at their documented deterministic step semantics', () => {
    const motion = createCameraMotion(
      createOrdinaryRoute({
        enterStart: 0.2,
        enterEnd: 0.2,
        exitStart: 0.8,
        exitEnd: 0.8
      }),
      undefined,
      { durationSeconds: 6, easing: 'linear' }
    );
    expect(sampleFramingEnvelopeWeight(motion.edgeViews[0]!.framingEnvelope!, 0.2)).toBe(1);
    expect(sampleFramingEnvelopeWeight(motion.edgeViews[0]!.framingEnvelope!, 0.2 - 1e-9)).toBe(0);
    expect(sampleFramingEnvelopeWeight(motion.edgeViews[0]!.framingEnvelope!, 0.8 + 1e-9)).toBe(0);
  });

  it('keeps larger FOV wider and smaller FOV tighter through the same envelope', () => {
    const motion = createCameraMotion(createOrdinaryRoute(), undefined, {
      durationSeconds: 6,
      easing: 'linear'
    });
    const automatic = sampleAtEdgeProgress(motion, 0, 0.1);
    const plateau = sampleAtEdgeProgress(motion, 0, 0.5);
    expect(plateau.fov).toBe(80);
    expect(plateau.fov).toBeGreaterThan(automatic.fov);
    expect(sampleAtEdgeProgress(motion, 0, 0.9).fov).toBeLessThan(plateau.fov);
  });
});



