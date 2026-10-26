import { describe, expect, it } from 'vitest';
import type { Frame } from '../src/model/types';
import { constrainWorldPointToAxis, isAxisLockCompatible } from '../src/drafting/constraints';

const ground: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 0, -1],
  normal: [0, 1, 0],
};

const tilt = Math.PI / 12;
const tilted: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, Math.sin(tilt), -Math.cos(tilt)],
  normal: [0, Math.cos(tilt), Math.sin(tilt)],
};

describe('draft axis constraints', () => {
  it('allows a ground-plane X lock and snaps distance from the previous point', () => {
    expect(isAxisLockCompatible(ground, 'x', 'plane')).toBe(true);
    expect(constrainWorldPointToAxis(ground, [0.05, 0, 0], [0.28, 0, -0.7], 'x', 'plane', 0.1)).toEqual({
      compatible: true,
      point: [0.25, 0, 0],
    });
  });

  it('refuses global Y on a 15-degree tilted plane but allows local V', () => {
    expect(isAxisLockCompatible(tilted, 'y', 'plane')).toBe(false);
    expect(constrainWorldPointToAxis(tilted, [0, 0, 0], [0, 1, 0], 'y', 'plane')).toEqual({ compatible: false, point: null });
    expect(isAxisLockCompatible(tilted, 'v', 'plane')).toBe(true);
  });

  it('allows global X carrier movement in 3D regardless of the section plane', () => {
    const section: Frame = { origin: [0, 0, 0], u: [0, 0, -1], v: [0, 1, 0], normal: [1, 0, 0] };
    expect(isAxisLockCompatible(section, 'x', 'plane')).toBe(false);
    expect(isAxisLockCompatible(section, 'x', 'space')).toBe(true);
    expect(constrainWorldPointToAxis(section, [0, 0, 0], [2, 1, -1], 'x', 'space', 0.25)).toEqual({
      compatible: true,
      point: [2, 0, 0],
    });
  });
});
