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

  it('samples a 10 cm all-smooth square to the declared 1 mm chord-error bound', () => {
    const outline = [
      { key: 1, u: 0, v: 0, smooth: true },
      { key: 2, u: 0.1, v: 0, smooth: true },
      { key: 3, u: 0.1, v: 0.1, smooth: true },
      { key: 4, u: 0, v: 0.1, smooth: true }
    ];
    expect(validateProfile(outline)).toEqual([]);

    const profile = evaluateProfile(outline);
    const segmentsPerCurve = 6;
    const toleranceMeters = 0.001;
    expect(profile.points.length / 2).toBe(outline.length * segmentsPerCurve);

    const hasPoint = (u: number, v: number): boolean => {
      for (let index = 0; index < profile.points.length; index += 2) {
        if (Math.abs(profile.points[index]! - u) < 1e-12 && Math.abs(profile.points[index + 1]! - v) < 1e-12) {
          return true;
        }
      }
      return false;
    };

    // Independently reconstruct each quadratic from its midpoint endpoints.
    // Its maximum deviation from a chord is attained at the subsegment
    // midpoint; requiring every expected sample in the evaluated ring proves
    // the evaluator used these six segments rather than only a similar count.
    for (let index = 0; index < outline.length; index += 1) {
      const previous = outline[(index + outline.length - 1) % outline.length]!;
      const anchor = outline[index]!;
      const next = outline[(index + 1) % outline.length]!;
      const start = { u: (previous.u + anchor.u) / 2, v: (previous.v + anchor.v) / 2 };
      const end = { u: (anchor.u + next.u) / 2, v: (anchor.v + next.v) / 2 };
      const curve = (t: number) => {
        const inverse = 1 - t;
        return {
          u: inverse * inverse * start.u + 2 * t * inverse * anchor.u + t * t * end.u,
          v: inverse * inverse * start.v + 2 * t * inverse * anchor.v + t * t * end.v
        };
      };

      for (let segment = 0; segment < segmentsPerCurve; segment += 1) {
        const from = curve(segment / segmentsPerCurve);
        const to = curve((segment + 1) / segmentsPerCurve);
        const curveMidpoint = curve((segment + 0.5) / segmentsPerCurve);
        const chordMidpoint = { u: (from.u + to.u) / 2, v: (from.v + to.v) / 2 };
        const chordError = Math.sqrt(
          (curveMidpoint.u - chordMidpoint.u) ** 2 + (curveMidpoint.v - chordMidpoint.v) ** 2
        );

        expect(hasPoint(from.u, from.v)).toBe(true);
        expect(chordError).toBeLessThanOrEqual(toleranceMeters);
      }
    }
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
