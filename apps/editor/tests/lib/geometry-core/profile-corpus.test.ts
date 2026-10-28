import { describe, expect, it } from 'vitest';
import {
  canonicalizeWinding,
  evaluateProfile,
  extrudeProfile,
  formMeshDigest,
  validateProfile,
  type FormMesh
} from '@portfolio/geometry-core';
import { INVALID_PROFILES, VALID_FORMS } from './__fixtures__/corpus';
import { GOLDEN_DIGESTS } from './__fixtures__/goldens';

describe('native form profile corpus', () => {
  it('contains the plan’s minimum corpus breadth', () => {
    expect(VALID_FORMS.length).toBeGreaterThanOrEqual(40);
    expect(INVALID_PROFILES.length).toBeGreaterThanOrEqual(25);
  });

  for (const source of VALID_FORMS) {
    describe(source.name, () => {
      it('evaluates to a closed, outward-oriented 2-manifold', () => {
        const profile = evaluateProfile(source.outline);
        const mesh = extrudeProfile({
          profile,
          extent: source.extent,
          scale: source.scale,
          plane: source.plane
        });
        assertClosedOutwardMesh(mesh);
        expectEulerCharacteristic(mesh);
        expect(testRegions(mesh, profile.pointEdgeKeys.length)).toBe(true);
        expectConsistentFootprint(source, profile, mesh);
      });

      it('repeats bit-identically and matches its pinned golden', () => {
        const profile = evaluateProfile(source.outline);
        const mesh = extrudeProfile({
          profile,
          extent: source.extent,
          scale: source.scale,
          plane: source.plane
        });
        const repeated = extrudeProfile({
          profile: evaluateProfile(source.outline),
          extent: source.extent,
          scale: source.scale,
          plane: source.plane
        });
        const digest = formMeshDigest(mesh);
        expect(formMeshDigest(repeated)).toBe(digest);
        expect(GOLDEN_DIGESTS[source.name], `golden for ${source.name}`).toBe(digest);
      });
    });
  }

  it('canonicalizes a clockwise ring to the same accepted body', () => {
    const clockwise = [...VALID_FORMS[0]!.outline].reverse();
    expect(validateProfile(clockwise).map((issue) => issue.code)).toContain('clockwise');
    const canonical = canonicalizeWinding(clockwise);
    expect(validateProfile(canonical)).toEqual([]);
    const expected = extrudeProfile({
      profile: evaluateProfile(VALID_FORMS[0]!.outline),
      extent: VALID_FORMS[0]!.extent,
      scale: VALID_FORMS[0]!.scale,
      plane: VALID_FORMS[0]!.plane
    });
    const actual = extrudeProfile({
      profile: evaluateProfile(canonical),
      extent: VALID_FORMS[0]!.extent,
      scale: VALID_FORMS[0]!.scale,
      plane: VALID_FORMS[0]!.plane
    });
    expect(formMeshDigest(actual)).toBe(formMeshDigest(expected));
  });

  for (const source of INVALID_PROFILES) {
    it(`refuses ${source.name} with ${source.expected}`, () => {
      const issues = validateProfile(source.outline);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.map((issue) => issue.code)).toContain(source.expected);
      expect(() => evaluateProfile(source.outline)).toThrowError();
    });
  }
});

function positionKey(mesh: FormMesh, vertex: number): string {
  return `${mesh.positions[vertex * 3]}|${mesh.positions[vertex * 3 + 1]}|${mesh.positions[vertex * 3 + 2]}`;
}

function signedVolume(mesh: FormMesh): number {
  let total = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = mesh.indices[index]! * 3;
    const b = mesh.indices[index + 1]! * 3;
    const c = mesh.indices[index + 2]! * 3;
    total += mesh.positions[a]! * (mesh.positions[b + 1]! * mesh.positions[c + 2]! - mesh.positions[b + 2]! * mesh.positions[c + 1]!) +
      mesh.positions[a + 1]! * (mesh.positions[b + 2]! * mesh.positions[c]! - mesh.positions[b]! * mesh.positions[c + 2]!) +
      mesh.positions[a + 2]! * (mesh.positions[b]! * mesh.positions[c + 1]! - mesh.positions[b + 1]! * mesh.positions[c]!);
  }
  return total / 6;
}

function assertClosedOutwardMesh(mesh: FormMesh): void {
  // A closed mesh can still be inward: the signed volume is what separates the
  // two, and the kernel's contract is a positive body.
  expect(signedVolume(mesh)).toBeGreaterThan(0);
  const edges = new Map<string, number>();
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = mesh.indices[index]!;
    const b = mesh.indices[index + 1]!;
    const c = mesh.indices[index + 2]!;
    const area = triangleOrientation(mesh, a, b, c);
    expect(area, `triangle ${index / 3} is degenerate`).not.toBe(0);
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a]
    ] as const) {
      const key = `${positionKey(mesh, from)}>${positionKey(mesh, to)}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of edges) {
    const [from, to] = key.split('>');
    const reverse = `${to}>${from}`;
    expect(edges.get(reverse), `edge ${key} has no opposite partner`).toBe(count);
  }
}

function expectEulerCharacteristic(mesh: FormMesh): void {
  const vertices = new Set<string>();
  for (let vertex = 0; vertex < mesh.positions.length / 3; vertex += 1) {
    vertices.add(positionKey(mesh, vertex));
  }
  const faces = mesh.indices.length / 3;
  const edges = mesh.indices.length / 2;
  expect(vertices.size - edges + faces).toBe(2);
}

function testRegions(mesh: FormMesh, segmentCount: number): boolean {
  const regions = new Set(mesh.regions);
  if (!regions.has(0) || !regions.has(1)) return false;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    if (!regions.has(2 + segment)) return false;
  }
  expect(mesh.segmentKeys.length).toBe(segmentCount);
  return true;
}

function expectConsistentFootprint(
  source: (typeof VALID_FORMS)[number],
  profile: ReturnType<typeof evaluateProfile>,
  mesh: FormMesh
): void {
  const [scaleX, scaleY, scaleZ] = source.scale;
  if (source.plane === 'plan') {
    expect(mesh.contactMinY).toBe(0);
    expect(mesh.bounds.min[1]).toBe(0);
    expect(mesh.bounds.max[1]).toBe(source.extent * scaleY);
    expect(mesh.footprint.length).toBe(profile.points.length / 2);
    for (let index = 0; index < mesh.footprint.length; index += 1) {
      expect(mesh.footprint[index]![0]).toBe(profile.points[index * 2]! * scaleX);
      expect(mesh.footprint[index]![1]).toBe(profile.points[index * 2 + 1]! * scaleZ);
    }
  } else {
    expect(mesh.contactMinY).toBe(mesh.bounds.min[1]);
    expect(mesh.contactMinY).toBe(profile.bounds.minV * scaleY);
    expect(mesh.bounds.min[2]).toBe(0);
    expect(mesh.bounds.max[2]).toBe(source.extent * scaleZ);
    expect(mesh.footprint).toEqual([
      [profile.bounds.minU * scaleX, 0],
      [profile.bounds.maxU * scaleX, 0],
      [profile.bounds.maxU * scaleX, source.extent * scaleZ],
      [profile.bounds.minU * scaleX, source.extent * scaleZ]
    ]);
  }
}

function triangleOrientation(mesh: FormMesh, a: number, b: number, c: number): number {
  const ax = mesh.positions[a * 3]!;
  const ay = mesh.positions[a * 3 + 1]!;
  const az = mesh.positions[a * 3 + 2]!;
  const bx = mesh.positions[b * 3]!;
  const by = mesh.positions[b * 3 + 1]!;
  const bz = mesh.positions[b * 3 + 2]!;
  const cx = mesh.positions[c * 3]!;
  const cy = mesh.positions[c * 3 + 1]!;
  const cz = mesh.positions[c * 3 + 2]!;
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  return (
    (uy * vz - uz * vy) ** 2 +
    (uz * vx - ux * vz) ** 2 +
    (ux * vy - uy * vx) ** 2
  );
}
