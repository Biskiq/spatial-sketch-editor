/**
 * camera-motion test fixtures — extracted by T4 so the dense acceptance-matrix
 * suite (see `camera-motion-dense-sweeps.test.ts`) and the behavioral suite
 * (`camera-motion.test.ts`) share one owner for the sampling helpers instead
 * of duplicating them across lanes.
 */
import { expect } from 'vitest';
import { Vector3 } from 'three';
import { createCameraMotion, createCameraMotionSample, sampleCameraMotion } from '@portfolio/camera-core';

export function sample(motion: ReturnType<typeof createCameraMotion>, progress: number) {
  const output = createCameraMotionSample();
  sampleCameraMotion(motion, progress, output);
  return {
    position: output.position.toArray(),
    target: output.target.toArray()
  };
}

export function sampleFull(
  motion: ReturnType<typeof createCameraMotion>,
  progress: number
) {
  const output = createCameraMotionSample();
  sampleCameraMotion(motion, progress, output);
  return output;
}

export function smootherstep(progress: number) {
  return progress ** 3 * (progress * (progress * 6 - 15) + 10);
}

export function inverseSmootherstep(target: number) {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (smootherstep(midpoint) < target) low = midpoint;
    else high = midpoint;
  }
  return (low + high) / 2;
}

export function expectVectorClose(actual: Vector3, expected: Vector3, precision = 8) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

