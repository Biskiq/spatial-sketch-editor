import { describe, expect, it } from 'vitest';
import {
  canonicalizeWinding,
  evaluateProfile,
  extrudeProfile,
  formMeshDigest,
  validateProfile,
  type ProfileAnchor
} from '@portfolio/geometry-core';

const square: ProfileAnchor[] = [
  { key: 1, u: 0, v: 0, smooth: false },
  { key: 2, u: 1, v: 0, smooth: false },
  { key: 3, u: 1, v: 1, smooth: false },
  { key: 4, u: 0, v: 1, smooth: false }
];

describe('geometry core smoke', () => {
  it('evaluates a square into a triangulated ring', () => {
    expect(validateProfile(square)).toEqual([]);
    const profile = evaluateProfile(square);
    expect(profile.points.length).toBe(8);
    expect(profile.triangles.length).toBe(6);
    expect(profile.pointEdgeKeys.length).toBe(4);
  });

  it('extrudes a closed positive volume plan form', () => {
    const profile = evaluateProfile(square);
    const mesh = extrudeProfile({ profile, extent: 0.5, scale: [1, 1, 1], plane: 'plan' });
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.regions.length).toBe(mesh.indices.length / 3);
    expect(mesh.contactMinY).toBe(0);
    expect(mesh.bounds.min[1]).toBe(0);
    expect(mesh.bounds.max[1]).toBe(0.5);
    expect(formMeshDigest(mesh)).toMatch(/^gc1-[0-9a-f]{16}$/);
  });

  it('evaluates all-smooth and mixed outlines', () => {
    const smooth = square.map((anchor) => ({ ...anchor, smooth: true }));
    expect(validateProfile(smooth)).toEqual([]);
    const mixed = square.map((anchor, index) => ({ ...anchor, smooth: index % 2 === 1 }));
    expect(validateProfile(mixed)).toEqual([]);
  });

  it('canonicalizes clockwise winding', () => {
    const clockwise = [...square].reverse();
    expect(validateProfile(clockwise).map((issue) => issue.code)).toContain('clockwise');
    expect(validateProfile(canonicalizeWinding(clockwise))).toEqual([]);
  });

  it('refuses a bow tie as self-intersecting', () => {
    const bowTie: ProfileAnchor[] = [
      { key: 1, u: 0, v: 0, smooth: false },
      { key: 2, u: 2, v: 2, smooth: false },
      { key: 3, u: 2, v: 0, smooth: false },
      { key: 4, u: 0, v: 2, smooth: false }
    ];
    expect(validateProfile(bowTie).map((issue) => issue.code)).toContain('self-intersecting');
  });
});
