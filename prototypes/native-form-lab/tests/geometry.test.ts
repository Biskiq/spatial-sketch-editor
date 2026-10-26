import { describe, expect, it } from "vitest";
import { evaluateDocument, evaluateForm, inspectMesh } from "../src/geometry";
import { createLabDocument, createProfile, roleKey, type Carrier, type Form, type Frame, type FormOperation, type Vec2, type Vec3 } from "../src/model/types";

const footprintFrame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 0, -1],
  normal: [0, 1, 0],
};

const radialFrame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
};

function makeForm(
  id: string,
  points: Vec2[],
  operation: FormOperation,
  frame: Frame = footprintFrame,
  rounding: Form["rounding"] = { radius: 0, policy: "none" },
): Form {
  const partial = operation.kind === "revolve" && Math.abs(operation.angleDegrees) < 360;
  return {
    id,
    name: id,
    profile: createProfile(points, `${id}:profile`),
    frame: structuredClone(frame),
    operation,
    rounding,
    revolveCapLifetimeKeys: partial ? { start: `${id}:revolve-cap:start:1`, end: `${id}:revolve-cap:end:1` } : null,
  };
}

function documentWith(form: Form) {
  const document = createLabDocument();
  document.forms.push(form);
  return document;
}

function expectClosed(result: ReturnType<typeof evaluateForm>): void {
  expect(result.valid, result.reason?.message).toBe(true);
  const inspection = inspectMesh(result.mesh);
  expect(inspection.finitePositions).toBe(true);
  expect(inspection.validIndices).toBe(true);
  expect(inspection.roleCountMatchesTriangles).toBe(true);
  expect(inspection.triangleCount).toBeGreaterThan(0);
  expect(inspection.degenerateTriangleCount).toBe(0);
  expect(inspection.boundaryEdgeCount).toBe(0);
  expect(inspection.nonManifoldEdgeCount).toBe(0);
  expect(inspection.orientationConflictCount).toBe(0);
}

function bounds(mesh: { positions: number[] }): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], mesh.positions[i + axis]!);
      max[axis] = Math.max(max[axis], mesh.positions[i + axis]!);
    }
  }
  return { min, max };
}

function signedVolume(mesh: { positions: number[]; indices: number[] }): number {
  const origin: Vec3 = [mesh.positions[0]!, mesh.positions[1]!, mesh.positions[2]!];
  let sum = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const point = (index: number): Vec3 => [
      mesh.positions[index * 3]! - origin[0],
      mesh.positions[index * 3 + 1]! - origin[1],
      mesh.positions[index * 3 + 2]! - origin[2],
    ];
    const a = point(mesh.indices[i]!);
    const b = point(mesh.indices[i + 1]!);
    const c = point(mesh.indices[i + 2]!);
    sum += a[0] * (b[1] * c[2] - b[2] * c[1])
      + a[1] * (b[2] * c[0] - b[0] * c[2])
      + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return sum / 6;
}

function sectionAreaAndCentroidRadius(points: Vec2[]): { area: number; centroidRadius: number } {
  let twiceArea = 0;
  let sixAreaRadius = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const cross = a[0] * b[1] - b[0] * a[1];
    twiceArea += cross;
    sixAreaRadius += (a[0] + b[0]) * cross;
  }
  return { area: Math.abs(twiceArea / 2), centroidRadius: sixAreaRadius / (3 * twiceArea) };
}

function sweepCarrier(points: Vec3[], ids = points.map((_point, index) => `path:${index}`)): Carrier {
  const firstTangent = normalize3(sub3(points[1]!, points[0]!));
  const v: Vec3 = [0, 1, 0];
  const u = normalize3(cross3(v, firstTangent));
  const normal = normalize3(cross3(u, v));
  return {
    id: "trim-carrier",
    points: points.map((position, index) => ({ id: ids[index]!, position })),
    segments: points.slice(0, -1).map((_point, index) => ({ id: `carrier-segment:${index}`, from: ids[index]!, to: ids[index + 1]! })),
    frameAnchorPointId: ids[0]!,
    frameAnchor: { origin: points[0]!, u, v, normal },
  };
}

function normalize3(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function reverseCarrier(carrier: Carrier): Carrier {
  return {
    ...structuredClone(carrier),
    points: [...carrier.points].reverse(),
    segments: [...carrier.segments].reverse().map((segment) => ({ ...segment, from: segment.to, to: segment.from })),
  };
}

describe("Native Form Lab geometry", () => {
  it("extrudes a keyed pedestal footprint with an inserted collinear point into a closed, analytic solid", () => {
    const form = makeForm("pedestal", [[-1, -1], [0, -1], [1, -1], [1, 1], [-1, 1]], { kind: "extrude", height: 0.8 });
    const result = evaluateForm(form, documentWith(form));
    expectClosed(result);
    expect(signedVolume(result.mesh)).toBeCloseTo(4 * 0.8, 8);
    expect(bounds(result.mesh)).toEqual({ min: [-1, 0, -1], max: [1, 0.8, 1] });
    const segmentKeys = new Set(form.profile.segments.map((segment) => segment.id));
    expect(result.roles.filter((role) => segmentKeys.has(role.address.partKey))).toHaveLength(5);
    expect(result.roles.filter((role) => role.kind === "cap").every((role) => role.frame && role.region && role.boundary)).toBe(true);
    const bottomSplitRoles = form.profile.segments.slice(0, 2).map((segment) => roleKey({ formId: form.id, partKey: segment.id }));
    expect(bottomSplitRoles.every((key) => result.mesh.triangleRoleKeys.includes(key))).toBe(true);
  });

  it("rounds explicit convex corners while retaining inserted straight-segment lineage and cap conformity", () => {
    const radius = 0.15;
    const form = makeForm(
      "rounded-pedestal",
      [[-1, -1], [0, -1], [1, -1], [1, 1], [-1, 1]],
      { kind: "extrude", height: 0.5 },
      footprintFrame,
      { radius, policy: "profile-corners" },
    );
    const result = evaluateForm(form, documentWith(form));
    expectClosed(result);
    const footprintArea = 4 - (4 - Math.PI) * radius * radius;
    expect(signedVolume(result.mesh)).toBeCloseTo(footprintArea * 0.5, 2);
    expect(result.roles.some((role) => role.address.partKey === form.profile.segments[0]!.id)).toBe(true);
    expect(result.roles.some((role) => role.address.partKey === form.profile.segments[1]!.id)).toBe(true);
    expect(result.roles.filter((role) => role.address.partKey.startsWith('["profile-corner"')).length).toBe(4);
  });

  it("revolves a decorative radial section with deterministic segment role addresses", () => {
    const section: Vec2[] = [[0.25, 0], [0.45, 0], [0.55, 0.15], [0.45, 0.3], [0.55, 0.45], [0.4, 0.6], [0.25, 0.6]];
    const form = makeForm("turned-form", section, { kind: "revolve", angleDegrees: 360 }, radialFrame);
    const first = evaluateForm(form, documentWith(form));
    const second = evaluateForm(form, documentWith(form));
    expectClosed(first);
    expect(first.mesh).toEqual(second.mesh);
    expect(first.roles.map((role) => role.key)).toEqual(second.roles.map((role) => role.key));
    expect(first.roles.filter((role) => role.kind === "cap")).toHaveLength(0);
    const { area, centroidRadius } = sectionAreaAndCentroidRadius(section);
    expect(signedVolume(first.mesh)).toBeCloseTo(2 * Math.PI * area * centroidRadius, 2);
    expect(bounds(first.mesh).max[0]).toBeCloseTo(0.55, 8);
    expect(bounds(first.mesh).max[1]).toBeCloseTo(0.6, 8);
    expect(new Set(first.roles.map((role) => role.address.partKey))).toEqual(new Set(form.profile.segments.map((segment) => segment.id)));
  });

  it("welds full-revolve axis poles and closes partial turns with authored cap keys", () => {
    const cylinderSection: Vec2[] = [[0, 0], [0.6, 0], [0.6, 1], [0, 1]];
    const fullForm = makeForm("full-cylinder", cylinderSection, { kind: "revolve", angleDegrees: 360 }, radialFrame);
    const full = evaluateForm(fullForm, documentWith(fullForm));
    expectClosed(full);
    expect(signedVolume(full.mesh)).toBeCloseTo(Math.PI * 0.6 * 0.6, 2);
    expect(bounds(full.mesh).max[0]).toBeCloseTo(0.6, 8);
    expect(bounds(full.mesh).min[2]).toBeCloseTo(-0.6, 8);

    const partialForm = makeForm("quarter-cylinder", cylinderSection, { kind: "revolve", angleDegrees: 90 }, radialFrame);
    const partial = evaluateForm(partialForm, documentWith(partialForm));
    expectClosed(partial);
    expect(signedVolume(partial.mesh)).toBeCloseTo(Math.PI * 0.6 * 0.6 / 4, 2);
    expect(partial.roles.filter((role) => role.kind === "cap").map((role) => role.address.partKey).sort())
      .toEqual([partialForm.revolveCapLifetimeKeys!.end, partialForm.revolveCapLifetimeKeys!.start].sort());
    expect(partial.roles.filter((role) => role.kind === "cap").every((role) => role.frame && role.region && role.boundary)).toBe(true);
  });

  it("sweeps upright trim around a mitered corner and a sampled curved carrier", () => {
    const profile = [[-0.1, -0.08], [0.1, -0.08], [0.1, 0.08], [-0.1, 0.08]] as Vec2[];
    const cornerCarrier = sweepCarrier([[0, 0, 0], [1.5, 0, 0], [1.5, 0, 1.5]]);
    const cornerForm = makeForm("corner-molding", profile, { kind: "sweep", carrier: cornerCarrier }, radialFrame);
    const corner = evaluateForm(cornerForm, documentWith(cornerForm));
    expectClosed(corner);
    expect(corner.roles.filter((role) => role.kind === "cap")).toHaveLength(2);
    expect(corner.roles.some((role) => role.frame && role.region && role.boundary && role.kind === "face")).toBe(true);

    const curvedCarrier = sweepCarrier([[0, 0, 0], [0.8, 0, 0.05], [1.6, 0, 0.2], [2.35, 0, 0.45], [3.05, 0, 0.8]]);
    const curvedForm = makeForm("curved-molding", profile, { kind: "sweep", carrier: curvedCarrier }, radialFrame);
    const curved = evaluateForm(curvedForm, documentWith(curvedForm));
    expectClosed(curved);
    expect(curved.roles.filter((role) => role.kind === "cap")).toHaveLength(2);
  });

  it("keeps sweep role addresses and physical frames stable when the keyed carrier is reversed", () => {
    const profile = [[-0.1, -0.05], [0.1, -0.05], [0.1, 0.05], [-0.1, 0.05]] as Vec2[];
    const carrier = sweepCarrier([[0, 0, 0], [1, 0, 0], [1, 0, 1], [2, 0, 1]], ["anchor", "bend", "curve-a", "end"]);
    const form = makeForm("reversible-molding", profile, { kind: "sweep", carrier }, radialFrame);
    const reversed = structuredClone(form);
    reversed.operation = { kind: "sweep", carrier: reverseCarrier(carrier) };
    const forwardResult = evaluateForm(form, documentWith(form));
    const reverseResult = evaluateForm(reversed, documentWith(reversed));
    expectClosed(forwardResult);
    expectClosed(reverseResult);
    expect(reverseResult.roles.map((role) => role.key)).toEqual(forwardResult.roles.map((role) => role.key));
    for (let axis = 0; axis < 3; axis += 1) {
      expect(bounds(reverseResult.mesh).min[axis]).toBeCloseTo(bounds(forwardResult.mesh).min[axis]!, 8);
      expect(bounds(reverseResult.mesh).max[axis]).toBeCloseTo(bounds(forwardResult.mesh).max[axis]!, 8);
    }
    const forwardFrames = new Map(forwardResult.roles.map((role) => [role.key, role.frame]));
    for (const role of reverseResult.roles) {
      const expected = forwardFrames.get(role.key);
      expect(Boolean(role.frame)).toBe(Boolean(expected));
      if (role.frame && expected) {
        for (const axis of ["origin", "u", "v", "normal"] as const) {
          for (let component = 0; component < 3; component += 1) {
            expect(role.frame[axis][component]).toBeCloseTo(expected[axis][component], 8);
          }
        }
      }
    }
  });

  it("transports a section along a smooth non-planar carrier from its fixed frame anchor", () => {
    const profile = [[-0.08, -0.04], [0.08, -0.04], [0.08, 0.04], [-0.08, 0.04]] as Vec2[];
    const carrier = sweepCarrier([[0, 0, 0], [1, 0, 0], [2, 0.02, 0.05], [3, 0.05, 0.15], [4, 0.09, 0.3]]);
    const form = makeForm("spatial-molding", profile, { kind: "sweep", carrier }, radialFrame);
    const result = evaluateForm(form, documentWith(form));
    expectClosed(result);
    const reversed = structuredClone(form);
    reversed.operation = { kind: "sweep", carrier: reverseCarrier(carrier) };
    const reverseResult = evaluateForm(reversed, documentWith(reversed));
    expectClosed(reverseResult);
    expect(reverseResult.roles.map((role) => role.key)).toEqual(result.roles.map((role) => role.key));
    for (let axis = 0; axis < 3; axis += 1) {
      expect(bounds(reverseResult.mesh).min[axis]).toBeCloseTo(bounds(result.mesh).min[axis]!, 8);
      expect(bounds(reverseResult.mesh).max[axis]).toBeCloseTo(bounds(result.mesh).max[axis]!, 8);
    }
  });

  it("refuses zero-size, self-crossing and impossible bend inputs with clear codes", () => {
    const base = makeForm("invalid", [[-1, -1], [1, -1], [1, 1], [-1, 1]], { kind: "extrude", height: 0 });
    expect(evaluateForm(base, documentWith(base)).reason?.code).toBe("extrude-height");

    const crossing = makeForm("crossing", [[-1, -1], [1, 1], [-1, 1], [1, -1]], { kind: "extrude", height: 1 });
    expect(evaluateForm(crossing, documentWith(crossing)).reason?.code).toBe("profile-self-intersection");

    const profile = [[-0.1, -0.05], [0.1, -0.05], [0.1, 0.05], [-0.1, 0.05]] as Vec2[];
    const impossible = sweepCarrier([[0, 0, 0], [1, 0, 0], [0.05, 0, 0.1]]);
    const bend = makeForm("tight-bend", profile, { kind: "sweep", carrier: impossible }, radialFrame);
    expect(evaluateForm(bend, documentWith(bend)).reason?.code).toBe("sweep-miter-limit");

    const crossingCarrier = sweepCarrier([[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2], [0, 0, 0]]);
    const crossingForm = makeForm("crossed-carrier", profile, { kind: "sweep", carrier: crossingCarrier }, radialFrame);
    expect(evaluateForm(crossingForm, documentWith(crossingForm)).reason?.code).toBe("sweep-carrier-crossing");
  });

  it("retains role addresses across repeated evaluation and contour start-point rotation", () => {
    const form = makeForm("identity", [[-1, -1], [1, -1], [1, 1], [-1, 1]], { kind: "extrude", height: 0.75 });
    const first = evaluateForm(form, documentWith(form));
    const rotated = structuredClone(form);
    rotated.profile = { ...rotated.profile, points: [...rotated.profile.points.slice(2), ...rotated.profile.points.slice(0, 2)] };
    const rotatedResult = evaluateForm(rotated, documentWith(rotated));
    expectClosed(first);
    expectClosed(rotatedResult);
    expect(first.roles.map((role) => role.key)).toEqual(rotatedResult.roles.map((role) => role.key));
    expect(first.roles.map((role) => role.address.partKey)).toContain(form.profile.segments[0]!.id);
    expect(evaluateDocument(documentWith(form)).roles.map((role) => role.key)).toEqual(first.roles.map((role) => role.key));
  });
});
