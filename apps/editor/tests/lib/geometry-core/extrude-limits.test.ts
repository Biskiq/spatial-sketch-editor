import { describe, expect, it } from 'vitest';
import {
  evaluateProfile,
  extrudeProfile,
  type ProfileAnchor
} from '@portfolio/geometry-core';

const square: ProfileAnchor[] = [
  { key: 1, u: 0, v: 0, smooth: false },
  { key: 2, u: 1, v: 0, smooth: false },
  { key: 3, u: 1, v: 1, smooth: false },
  { key: 4, u: 0, v: 1, smooth: false }
];

const smallSquare: ProfileAnchor[] = square.map((anchor) => ({
  ...anchor,
  u: anchor.u * 0.01,
  v: anchor.v * 0.01
}));

const wideRectangle: ProfileAnchor[] = [
  { key: 1, u: 0, v: 0, smooth: false },
  { key: 2, u: 2, v: 0, smooth: false },
  { key: 3, u: 2, v: 1, smooth: false },
  { key: 4, u: 0, v: 1, smooth: false }
];

describe('native form extrusion limits', () => {
  const profile = evaluateProfile(square);

  it('refuses an extent outside 1 mm – 100 m', () => {
    expect(() =>
      extrudeProfile({ profile, extent: 0.0005, scale: [1, 1, 1], plane: 'plan' })
    ).toThrowError(/extent/);
    expect(() =>
      extrudeProfile({ profile, extent: 100.1, scale: [1, 1, 1], plane: 'plan' })
    ).toThrowError(/extent/);
  });

  it('refuses a scale factor outside 0.01 – 100', () => {
    expect(() =>
      extrudeProfile({ profile, extent: 1, scale: [0.009, 1, 1], plane: 'plan' })
    ).toThrowError(/scale/);
    expect(() =>
      extrudeProfile({ profile, extent: 1, scale: [1, 100.1, 1], plane: 'plan' })
    ).toThrowError(/scale/);
  });

  it('refuses a scaled dimension outside 1 mm – 100 m', () => {
    const tiny = evaluateProfile(smallSquare);
    expect(() =>
      extrudeProfile({ profile: tiny, extent: 1, scale: [0.01, 1, 1], plane: 'plan' })
    ).toThrowError(/width/);
    expect(() =>
      extrudeProfile({
        profile: evaluateProfile(wideRectangle),
        extent: 1,
        scale: [100, 1, 1],
        plane: 'plan'
      })
    ).toThrowError(/width/);
  });

  it('uses the profile minimum as elevation contact and the source extent as depth', () => {
    const negative: ProfileAnchor[] = square.map((anchor) => ({
      ...anchor,
      v: anchor.v - 1
    }));
    const mesh = extrudeProfile({
      profile: evaluateProfile(negative),
      extent: 0.5,
      scale: [1, 1, 2],
      plane: 'elevation'
    });
    expect(mesh.contactMinY).toBe(-1);
    expect(mesh.bounds.min[1]).toBe(-1);
    expect(mesh.bounds.max[2]).toBe(0.5 * 2);
    expect(mesh.footprint).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]);
  });
});
