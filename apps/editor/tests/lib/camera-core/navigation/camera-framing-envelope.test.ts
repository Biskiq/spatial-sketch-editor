/**
 * P1.3 framing envelope: authored target/FOV blending sampled at edge-local
 * distance progress, and the guard repairs that keep the blended gaze
 * continuous, inside the projection envelope and angular-rate bounded.
 *
 * Part of the former `camera-motion.test.ts`; the motion core stays there.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  CAMERA_FRAMING_GUARD_POLICY,
  VISITOR_CAMERA_PROJECTION,
  createCameraMotion,
  createCameraMotionSample,
  sampleCameraMotion,
  sampleFramingEnvelopeWeight,
  smootherstepRamp,
  type CameraRoute
} from '@portfolio/camera-core';
import { expectVectorClose, sampleFull } from '../../../helpers/camera-motion-fixtures';

describe('P1.3 framing envelope sampler and guards', () => {
  const envelope = {
    enterStart: 0.2,
    enterEnd: 0.4,
    exitStart: 0.8,
    exitEnd: 1
  } as const;

  function createEnvelopeRoute(
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

  it('samples rising, falling, plateau, and degenerate smootherstep ramps', () => {
    expect(smootherstepRamp(-1, 0.2, 0.4, true)).toBe(0);
    expect(smootherstepRamp(0.3, 0.2, 0.4, true)).toBeCloseTo(0.5, 12);
    expect(smootherstepRamp(1, 0.2, 0.4, true)).toBe(1);
    expect(smootherstepRamp(-1, 0.6, 0.8, false)).toBe(1);
    expect(smootherstepRamp(0.7, 0.6, 0.8, false)).toBeCloseTo(0.5, 12);
    expect(smootherstepRamp(1, 0.6, 0.8, false)).toBe(0);
    expect(smootherstepRamp(0.5, 0.5, 0.5, true)).toBe(1);
    expect(smootherstepRamp(0.5, 0.5, 0.5, false)).toBe(1);
    expect(smootherstepRamp(0.500001, 0.5, 0.5, false)).toBe(0);

    expect(sampleFramingEnvelopeWeight(envelope, 0)).toBe(0);
    expect(sampleFramingEnvelopeWeight(envelope, 0.3)).toBeCloseTo(0.5, 12);
    expect(sampleFramingEnvelopeWeight(envelope, 0.5)).toBe(1);
    expect(sampleFramingEnvelopeWeight(envelope, 0.9)).toBeCloseTo(0.5, 12);
    expect(sampleFramingEnvelopeWeight(envelope, 1)).toBe(0);
    const allEqual = {
      enterStart: 0.5,
      enterEnd: 0.5,
      exitStart: 0.5,
      exitEnd: 0.5
    };
    for (const progress of [0, 0.5, 0.500001, 1]) {
      const weight = sampleFramingEnvelopeWeight(allEqual, progress);
      expect(Number.isFinite(weight)).toBe(true);
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
    expect(sampleFramingEnvelopeWeight(allEqual, 0.5)).toBe(1);
  });

  it('blends automatic and authored target/FOV at edge-local distance progress', () => {
    const motion = createCameraMotion(createEnvelopeRoute(), undefined, {
      durationSeconds: 10,
      easing: 'linear'
    });
    const automatic = sampleFull(motion, 0.1);
    expectVectorClose(automatic.target, new Vector3(1, 0, 2), 12);
    expect(automatic.fov).toBe(42);

    const fractional = sampleFull(motion, 0.3);
    expectVectorClose(fractional.target, new Vector3(3, 1.2, 2.6), 10);
    expect(fractional.fov).toBeCloseTo(55, 10);

    const authored = sampleFull(motion, 0.5);
    expect(authored.target.toArray()).toEqual([5, 4, 4]);
    expect(authored.fov).toBe(80);
  });

  it('pins enveloped endpoints and preserves caller-owned vectors and inputs', () => {
    const route = createEnvelopeRoute();
    const original = structuredClone(route);
    const firstMotion = createCameraMotion(route, undefined, { easing: 'linear' });
    const secondMotion = createCameraMotion(route, undefined, { easing: 'linear' });
    const output = createCameraMotionSample();
    const position = output.position;
    const target = output.target;

    sampleCameraMotion(firstMotion, 0, output);
    expect(output.position.toArray()).toEqual([0, 0, 0]);
    expect(output.target.toArray()).toEqual([0, 0, 2]);
    expect(output.fov).toBe(40);
    sampleCameraMotion(firstMotion, 1, output);
    expect(output.position.toArray()).toEqual([10, 0, 0]);
    expect(output.target.toArray()).toEqual([10, 0, 2]);
    expect(output.fov).toBe(60);
    expect(output.position).toBe(position);
    expect(output.target).toBe(target);
    expect(route).toEqual(original);
    expect(firstMotion.edgeViews[0]).not.toBe(secondMotion.edgeViews[0]);
    expect(firstMotion.edgeViews[0]?.automaticTargetPath).not.toBe(
      secondMotion.edgeViews[0]?.automaticTargetPath
    );
  });

  it('uses the oriented envelope for reverse keys and ignores envelopes without keys', () => {
    const reversed = createCameraMotion(createEnvelopeRoute({
      direction: 'reverse'
    }), undefined, { durationSeconds: 10, easing: 'linear' });
    const reversedFractional = sampleFull(reversed, 0.3);
    expectVectorClose(
      reversedFractional.target,
      new Vector3(3, 1.2, 2.6),
      10
    );

    const withoutKeys = createCameraMotion(createEnvelopeRoute({
      viewTrack: {
        start: { cameraTarget: [0, 0, 2], fov: 40 },
        keyframes: [],
        end: { cameraTarget: [10, 0, 2], fov: 60 },
        framingEnvelope: envelope
      }
    }), undefined, { easing: 'linear' });
    expect(withoutKeys.usesLegacyTargetPath).toBe(true);
    expectVectorClose(
      sampleFull(withoutKeys, 0.3).target,
      new Vector3(3, 0, 2),
      12
    );
  });

  it('keeps a collinear-zero blend finite, continuous, and outside near clip', () => {
    const route = createEnvelopeRoute({
      viewTrack: {
        start: { cameraTarget: [0, 0, 1], fov: 54 },
        keyframes: [{
          id: 'cross-through-eye',
          progress: 0.5,
          cameraTarget: [5, 0, -1],
          fov: 54
        }],
        end: { cameraTarget: [10, 0, 1], fov: 54 },
        framingEnvelope: {
          enterStart: 0,
          enterEnd: 1,
          exitStart: 1,
          exitEnd: 1
        }
      },
      automaticTargetPoints: [[0, 0, 1], [10, 0, 1]]
    });
    const motion = createCameraMotion(route, undefined, { easing: 'linear' });
    const before = sampleFull(motion, 0.499);
    const center = sampleFull(motion, 0.5);
    const after = sampleFull(motion, 0.501);
    for (const result of [before, center, after]) {
      expect(result.target.toArray().every(Number.isFinite)).toBe(true);
      expect(result.target.distanceTo(result.position)).toBeGreaterThanOrEqual(
        VISITOR_CAMERA_PROJECTION.near - 1e-12
      );
    }
    expect(before.target.clone().sub(before.position).dot(
      after.target.clone().sub(after.position)
    )).toBeGreaterThan(0);
  });

  it('bounds POI angular rate deterministically for forward and random seeks', () => {
    const route = createEnvelopeRoute({
      viewTrack: {
        start: { cameraTarget: [5, 0, 0], fov: 54 },
        keyframes: [{
          id: 'fixed-poi',
          progress: 0.5,
          cameraTarget: [5, 0.001, 0],
          fov: 54
        }],
        end: { cameraTarget: [5, 0, 0], fov: 54 },
        framingEnvelope: {
          enterStart: 0,
          enterEnd: 0,
          exitStart: 1,
          exitEnd: 1
        }
      },
      automaticTargetPoints: [[5, 0, 0], [5, 0, 0]]
    });
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 2,
      easing: 'linear'
    });
    const progresses = Array.from({ length: 101 }, (_, index) => index / 100);
    const forward = new Map(
      progresses.map((progress) => [progress, sampleFull(motion, progress).target.toArray()])
    );
    const randomOrder = progresses.map(
      (_progress, index) => progresses[(index * 37) % progresses.length]
    );
    for (const progress of randomOrder) {
      expect(sampleFull(motion, progress).target.toArray()).toEqual(
        forward.get(progress)
      );
    }
    for (let index = 1; index < progresses.length; index += 1) {
      const previous = sampleFull(motion, progresses[index - 1]);
      const current = sampleFull(motion, progresses[index]);
      const angle = previous.target.clone().sub(previous.position).angleTo(
        current.target.clone().sub(current.position)
      );
      const rate = angle / (2 / 100);
      expect(rate).toBeLessThanOrEqual(
        CAMERA_FRAMING_GUARD_POLICY.maxAngularRateRadiansPerSecond * 1.1
      );
    }
  });

  it('bypasses only a hazardous late off-axis exit', () => {
    const hazardousRoute = createEnvelopeRoute({
      viewTrack: {
        start: { cameraTarget: [0, 0, 5], fov: 54 },
        keyframes: [{
          id: 'hold-subject',
          progress: 0.8,
          cameraTarget: [8, 0, 5],
          fov: 54
        }],
        end: { cameraTarget: [10, 0, 5], fov: 54 },
        framingEnvelope: {
          enterStart: 0,
          enterEnd: 0,
          exitStart: 0.8,
          exitEnd: 0.9
        }
      },
      automaticTargetPoints: [[0, 0, 5], [30, 0, -5], [10, 0, 5]]
    });
    const hazardous = createCameraMotion(hazardousRoute, undefined, {
      durationSeconds: 0.5,
      easing: 'linear'
    });
    const enoughTime = createCameraMotion(hazardousRoute, undefined, {
      durationSeconds: 10,
      easing: 'linear'
    });
    const aligned = createCameraMotion(createEnvelopeRoute({
      viewTrack: hazardousRoute.edges![0].viewTrack,
      automaticTargetPoints: [[0, 0, 5], [10, 0, 5]]
    }), undefined, { durationSeconds: 0.5, easing: 'linear' });

    expect(hazardous.edgeViews[0]?.guard?.bypass).not.toBeNull();
    expect(enoughTime.edgeViews[0]?.guard?.bypass ?? null).toBeNull();
    expect(aligned.edgeViews[0]?.guard?.bypass ?? null).toBeNull();
    expect(sampleFull(hazardous, 1).target.toArray()).toEqual([10, 0, 5]);
  });
});

describe('P1.3 guard repairs', () => {
  it('interpolates antipodal guard directions along a deterministic great circle', () => {
    // The automatic gaze holds a fixed point of interest (so the raw blended
    // gaze swings through ~180 deg inside the envelope), forcing the
    // over-capacity fallback onto an antipodal chord from +x to -x.
    const route: CameraRoute = {
      positionParts: [{
        kind: 'rounded-polyline',
        points: [[0, 0, 0], [5, 0, 0], [10, 0, 0]]
      }],
      targetPoints: [[5, 0, 0], [5, 0, 0], [5, 0, 0]],
      startFov: 54,
      endFov: 54,
      edges: [{
        connectionId: 'antipodal',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 2 }
        },
        viewTrack: {
          start: { cameraTarget: [5, 0, 0], fov: 54 },
          keyframes: [{
            id: 'ahead-of-eye',
            progress: 0.5,
            cameraTarget: [5, 0, 1],
            fov: 54
          }],
          end: { cameraTarget: [5, 0, 0], fov: 54 },
          framingEnvelope: {
            enterStart: 0.3,
            enterEnd: 0.4,
            exitStart: 0.5,
            exitEnd: 0.6
          }
        },
        automaticTargetPoints: [[5, 0, 0], [5, 0, 0]]
      }]
    };
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 1.5,
      easing: 'linear'
    });
    const guard = motion.edgeViews[0]?.guard;
    expect(guard).not.toBeNull();
    expect(guard?.limitsAngularRate).toBe(true);

    // Mid-chord the corrected gaze must ride the deterministic great circle
    // (through +z here), never the stall-then-flip of linear interpolation and
    // never collapsing the target onto the position.
    const center = sampleFull(motion, 0.45);
    const centerDirection = center.target.clone().sub(center.position);
    expect(centerDirection.length()).toBeGreaterThan(0);
    expect(centerDirection.normalize().z).toBeGreaterThan(0.9);
    expect(center.target.distanceTo(center.position)).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near - 1e-12
    );
    expect(center.target.toArray().every(Number.isFinite)).toBe(true);

    for (const progress of [10 / 24, 11 / 24, 12 / 24]) {
      const result = sampleFull(motion, progress);
      const direction = result.target.clone().sub(result.position).normalize();
      expect(direction.z).toBeGreaterThan(0.5);
      expect(direction.x).toBeLessThan(0.7);
    }

    const progresses = Array.from({ length: 101 }, (_, index) => index / 100);
    const forward = new Map(
      progresses.map((progress) => [
        progress,
        sampleFull(motion, progress).target.toArray()
      ])
    );
    const randomOrder = progresses.map(
      (_progress, index) => progresses[(index * 37) % progresses.length]
    );
    for (const progress of randomOrder) {
      expect(sampleFull(motion, progress).target.toArray()).toEqual(
        forward.get(progress)
      );
    }
    for (const progress of progresses) {
      const result = sampleFull(motion, progress);
      expect(result.target.distanceTo(result.position)).toBeGreaterThanOrEqual(
        VISITOR_CAMERA_PROJECTION.near - 1e-12
      );
    }
  });

  it('restricts over-capacity correction to the envelope-active interval', () => {
    // The automatic gaze turns sharply near the start of the edge while the
    // authored keys swing the gaze inside the envelope, so an over-capacity
    // fallback that remapped the full edge would visibly rewrite the automatic
    // framing outside the envelope.
    const route: CameraRoute = {
      positionParts: [{
        kind: 'rounded-polyline',
        points: [[0, 0, 0], [5, 0, 0], [10, 0, 0]]
      }],
      targetPoints: [[1.5, 0, 0.5], [1.5, 0, 0.5], [1.5, 0, 0.5]],
      startFov: 54,
      endFov: 54,
      edges: [{
        connectionId: 'pinned',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 2 }
        },
        viewTrack: {
          start: { cameraTarget: [1.5, 0, 0.5], fov: 54 },
          keyframes: [{
            id: 'swing-behind',
            progress: 0.55,
            cameraTarget: [5, 0, 5],
            fov: 54
          }],
          end: { cameraTarget: [1.5, 0, 0.5], fov: 54 },
          framingEnvelope: {
            enterStart: 0.4,
            enterEnd: 0.5,
            exitStart: 0.6,
            exitEnd: 0.7
          }
        },
        automaticTargetPoints: [[1.5, 0, 0.5], [1.5, 0, 0.5], [1.5, 0, 0.5]]
      }]
    };
    const guarded = createCameraMotion(route, undefined, {
      durationSeconds: 1.5,
      easing: 'linear'
    });
    const reference = createCameraMotion({
      positionParts: route.positionParts,
      targetPoints: route.targetPoints
    });
    const guard = guarded.edgeViews[0]?.guard;
    expect(guard).not.toBeNull();
    expect(guard?.limitsAngularRate).toBe(true);

    // Where the envelope weight is zero the guarded framing must equal the
    // unguarded automatic framing exactly (samples land on the base grid).
    for (let segment = 0; segment <= 24; segment += 1) {
      const progress = segment / 24;
      const weight = sampleFramingEnvelopeWeight(
        route.edges![0].viewTrack!.framingEnvelope!,
        progress
      );
      if (weight > 0) continue;
      const guardedSample = sampleFull(guarded, progress);
      const referenceSample = sampleFull(reference, progress);
      expectVectorClose(guardedSample.target, referenceSample.target, 6);
    }

    const interior = sampleFull(guarded, 0.55);
    expect(interior.target.distanceTo(interior.position)).toBeGreaterThanOrEqual(
      VISITOR_CAMERA_PROJECTION.near - 1e-12
    );

    const progresses = Array.from({ length: 101 }, (_, index) => index / 100);
    const forward = new Map(
      progresses.map((progress) => [
        progress,
        sampleFull(guarded, progress).target.toArray()
      ])
    );
    const randomOrder = progresses.map(
      (_progress, index) => progresses[(index * 37) % progresses.length]
    );
    for (const progress of randomOrder) {
      expect(sampleFull(guarded, progress).target.toArray()).toEqual(
        forward.get(progress)
      );
    }
  });
});
