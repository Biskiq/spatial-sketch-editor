/**
 * Phase 3.7 easing library and authored motion duration + easing override.
 *
 * `cameraApplyEasing`/`cameraInverseEasing` are the endpoint-pinned, invertible
 * easing pair the motion sampler uses; `createCameraMotion` derives a duration
 * from path length unless an authored override supplies one. Part of the former
 * `camera-motion.test.ts`; the motion core stays there.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMERA_MOTION_TIMING,
  cameraApplyEasing,
  cameraInverseEasing,
  createCameraMotion,
  resolveCameraMotionDuration,
  type CameraRoute
} from '@portfolio/camera-core';
import { type CameraEasing } from '$lib/types/scene';

describe('Phase 3.7 easing library', () => {
  const easings: CameraEasing[] = [
    'linear',
    'smoothstep',
    'smootherstep',
    'ease-in',
    'ease-out',
    'ease-in-out'
  ];

  it('keeps every easing pinned at the endpoints', () => {
    for (const easing of easings) {
      expect(cameraApplyEasing(easing, 0)).toBe(0);
      expect(cameraApplyEasing(easing, 1)).toBe(1);
      expect(cameraInverseEasing(easing, 0)).toBe(0);
      expect(cameraInverseEasing(easing, 1)).toBe(1);
    }
  });

  it('matches a hand-rolled sample for every easing', () => {
    expect(cameraApplyEasing('linear', 0.4)).toBeCloseTo(0.4, 12);
    expect(cameraApplyEasing('ease-in', 0.4)).toBeCloseTo(0.16, 12);
    expect(cameraApplyEasing('ease-out', 0.4)).toBeCloseTo(0.64, 12);
    expect(cameraApplyEasing('smoothstep', 0.4)).toBeCloseTo(0.352, 12);
    expect(cameraApplyEasing('ease-in-out', 0.4)).toBeCloseTo(0.352, 12);
    expect(cameraApplyEasing('smootherstep', 0.4)).toBeCloseTo(0.31744, 12);
  });

  it('inverts round-trip deterministically', () => {
    for (const easing of easings) {
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        const eased = cameraApplyEasing(easing, t);
        expect(cameraInverseEasing(easing, eased)).toBeCloseTo(t, 6);
      }
    }
  });
});

describe('Phase 3.7 authored motion duration + easing', () => {
  const route: CameraRoute = {
    positionParts: [{ kind: 'auto-bezier', anchors: [[0, 0, 0], [10, 0, 0], [20, 0, 0]] }],
    targetPoints: [[0, 0, -1], [0, 0, -1], [0, 0, -1]],
    startFov: 54,
    endFov: 54
  };

  it('returns the rate-derived duration under the clamp by default', () => {
    const motion = createCameraMotion(route);
    expect(motion.durationSeconds).toBeGreaterThan(CAMERA_MOTION_TIMING.minDurationSeconds - 1e-6);
    expect(motion.durationSeconds).toBeLessThan(CAMERA_MOTION_TIMING.maxDurationSeconds + 1e-6);
    expect(motion.easing).toBe('smootherstep');
  });

  it('honors an authored override for duration + easing without clamping', () => {
    const motion = createCameraMotion(route, undefined, {
      durationSeconds: 7.5,
      easing: 'ease-in'
    });
    expect(motion.durationSeconds).toBe(7.5);
    expect(motion.easing).toBe('ease-in');
  });

  it('lets resolveCameraMotionDuration fall back without an override', () => {
    expect(resolveCameraMotionDuration(undefined, 0, 1)).toBe(0);
    const override = resolveCameraMotionDuration(9, 30, 3);
    expect(override).toBe(9);
  });
});
