import type { Carrier, DocumentEvaluation, Form, FormEvaluation, LabDocument, NumericMesh, RoleAddress, Vec2, Vec3 } from "../model/types";
import { roleKey } from "../model/types";
import { GeometryRefusal, refuse } from "./errors";
import { MeshBuilder, canonicalPlanarRoleData, inspectMesh, planarRoleData, triangulateBoundary } from "./mesh";
import { add3, cross3, distance3, dot3, finite3, length3, mapFrame, normalize3, scale3, sub3, validateFrame } from "./math";
import { prepareProfile } from "./profile";

export { inspectMesh } from "./mesh";

const EMPTY_MESH: NumericMesh = { positions: [], indices: [], triangleRoleKeys: [] };
const MAX_PROFILE_VERTICES = 4096;

function capPartKey(end: "start" | "end"): string {
  return JSON.stringify(["native-form-cap", end]);
}

function emptyFormEvaluation(formId: string, reason: { code: string; message: string }): FormEvaluation {
  return { formId, valid: false, reason, mesh: { positions: [], indices: [], triangleRoleKeys: [] }, roles: [] };
}

function buildExtrusion(form: Form, builder: MeshBuilder): void {
  const operation = form.operation;
  if (operation.kind !== "extrude") return;
  if (!Number.isFinite(operation.height) || operation.height <= 0) {
    refuse("extrude-height", "Extrusion height must be a positive distance in metres.");
  }
  if (!validateFrame(form.frame)) refuse("form-frame", "The form frame must be finite, orthonormal and right-handed.");
  const profile = prepareProfile(form.profile, form.rounding);
  if (profile.points.length > MAX_PROFILE_VERTICES) refuse("profile-limit", "The profile exceeds the evaluator's vertex limit.");
  const profilePartKeys = new Set(profile.edges.map((edge) => edge.partKey));
  if (profilePartKeys.has(capPartKey("start")) || profilePartKeys.has(capPartKey("end"))) {
    refuse("role-key-collision", "An authored profile segment collides with a reserved extrusion cap address.");
  }

  const baseVertices = profile.points.map((point) => builder.addVertex(mapFrame(form.frame, point[0], point[1])));
  const endVertices = profile.points.map((point) => builder.addVertex(mapFrame(form.frame, point[0], point[1], operation.height)));
  const count = profile.points.length;
  const areaSign = Math.sign(profile.signedArea);

  const startAddress: RoleAddress = { formId: form.id, partKey: capPartKey("start") };
  const endAddress: RoleAddress = { formId: form.id, partKey: capPartKey("end") };
  const startBoundary = profile.points.map((point): Vec2 => [-point[0], point[1]]);
  const startRegion = localBounds(startBoundary);
  const endRegion = localBounds(profile.points);
  const startFrame = {
    origin: form.frame.origin,
    u: scale3(form.frame.u, -1),
    v: form.frame.v,
    normal: scale3(form.frame.normal, -1),
  };
  const endFrame = form.frame;
  const startRole = builder.addRole({ address: startAddress, label: "Start cap", kind: "cap", frame: startFrame, region: startRegion, boundary: startBoundary });
  const endOrigin = mapFrame(form.frame, 0, 0, operation.height);
  const endRole = builder.addRole({
    address: endAddress,
    label: "End cap",
    kind: "cap",
    frame: { ...endFrame, origin: endOrigin },
    region: endRegion,
    boundary: profile.points,
  });

  const capTriangles = triangulateBoundary(profile.points);
  for (const triangle of capTriangles) {
    const [a, b, c] = triangle.map((index) => index) as [number, number, number];
    builder.addTriangle(baseVertices[a]!, baseVertices[b]!, baseVertices[c]!, startRole, scale3(form.frame.normal, -1));
    builder.addTriangle(endVertices[a]!, endVertices[b]!, endVertices[c]!, endRole, form.frame.normal);
  }

  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    const edge = profile.edges[i]!;
    const address: RoleAddress = { formId: form.id, partKey: edge.partKey };
    const p0 = mapFrame(form.frame, profile.points[i]![0], profile.points[i]![1]);
    const p1 = mapFrame(form.frame, profile.points[next]![0], profile.points[next]![1]);
    const q0 = mapFrame(form.frame, profile.points[i]![0], profile.points[i]![1], operation.height);
    const q1 = mapFrame(form.frame, profile.points[next]![0], profile.points[next]![1], operation.height);
    const quad = [baseVertices[i]!, baseVertices[next]!, endVertices[next]!, endVertices[i]!];
    const desiredNormal = scale3(cross3(sub3(p1, p0), form.frame.normal), areaSign);
    const plane = edge.kind === "segment" ? planarRoleData([p0, p1, q1, q0], desiredNormal) : undefined;
    const sideRole = builder.addRole({ address, label: edge.label, kind: "face", ...(plane ?? {}) });
    addQuad(builder, quad, sideRole, desiredNormal);
  }
}

function buildRevolve(form: Form, builder: MeshBuilder): void {
  const operation = form.operation;
  if (operation.kind !== "revolve") return;
  if (!Number.isFinite(operation.angleDegrees) || operation.angleDegrees === 0 || Math.abs(operation.angleDegrees) > 360) {
    refuse("revolve-angle", "A revolve angle must be non-zero and no larger than one full turn.");
  }
  if (!validateFrame(form.frame)) refuse("form-frame", "The form frame must be finite, orthonormal and right-handed.");
  const profile = prepareProfile(form.profile, form.rounding);
  if (profile.points.length > MAX_PROFILE_VERTICES) refuse("profile-limit", "The profile exceeds the evaluator's vertex limit.");
  const radiusEpsilon = Math.max(1e-10, profile.scale * 1e-10);
  for (const point of profile.points) {
    if (point[0] < -radiusEpsilon) refuse("revolve-negative-radius", "A revolve section must stay on or to one side of its axis.");
    if (Math.abs(point[0]) <= radiusEpsilon) point[0] = 0;
  }

  // Match the model allocator's full-turn threshold so cap lifetimes and output stay aligned.
  const full = Math.abs(operation.angleDegrees) >= 360 - 1e-6;
  const capKeys = form.revolveCapLifetimeKeys;
  if (full && capKeys !== null) refuse("revolve-cap-state", "A full revolve has no end-cap lifetime keys.");
  if (!full && (!capKeys || !capKeys.start || !capKeys.end || capKeys.start === capKeys.end)) {
    refuse("revolve-cap-keys", "A partial revolve needs two distinct authored end-cap lifetime keys.");
  }
  if (!full && capKeys && profile.edges.some((edge) => edge.partKey === capKeys.start || edge.partKey === capKeys.end)) {
    refuse("role-key-collision", "A revolve cap lifetime key collides with an authored profile segment.");
  }
  const radians = operation.angleDegrees * Math.PI / 180;
  const angleSign = Math.sign(radians);
  const steps = Math.max(4, Math.ceil(96 * Math.abs(radians) / (Math.PI * 2)));
  const ringCount = full ? steps : steps + 1;
  if (profile.points.length * steps > 600_000) refuse("geometry-limit", "This revolve would exceed the evaluator's mesh limit.");

  const ringVertices: number[][] = profile.points.map((point) => {
    const radius = point[0];
    const indices: number[] = [];
    let axisIndex: number | undefined;
    for (let i = 0; i < ringCount; i += 1) {
      if (radius === 0 && axisIndex !== undefined) {
        indices.push(axisIndex);
        continue;
      }
      const angle = radians * (i / steps);
      const radial = radialAt(form.frame.u, form.frame.normal, angle);
      const position = add3(add3(form.frame.origin, scale3(radial, radius)), scale3(form.frame.v, point[1]));
      const index = builder.addVertex(position);
      if (radius === 0) axisIndex = index;
      indices.push(index);
    }
    return indices;
  });

  const areaSign = Math.sign(profile.signedArea);
  for (let edgeIndex = 0; edgeIndex < profile.points.length; edgeIndex += 1) {
    const nextProfile = (edgeIndex + 1) % profile.points.length;
    const p0 = profile.points[edgeIndex]!;
    const p1 = profile.points[nextProfile]!;
    const dr = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    if (Math.abs(p0[0]) <= radiusEpsilon && Math.abs(p1[0]) <= radiusEpsilon) continue;
    const edge = profile.edges[edgeIndex]!;
    const sideRole = builder.addRole({
      address: { formId: form.id, partKey: edge.partKey },
      label: edge.label,
      kind: "face",
    });
    for (let step = 0; step < steps; step += 1) {
      const nextRing = full ? (step + 1) % ringCount : step + 1;
      const midAngle = radians * ((step + 0.5) / steps);
      const radial = radialAt(form.frame.u, form.frame.normal, midAngle);
      const expectedNormal = scale3(add3(scale3(radial, dy), scale3(form.frame.v, -dr)), areaSign);
      const a = ringVertices[edgeIndex]![step]!;
      const b = ringVertices[nextProfile]![step]!;
      const c = ringVertices[nextProfile]![nextRing]!;
      const d = ringVertices[edgeIndex]![nextRing]!;
      builder.addTriangle(a, b, c, sideRole, expectedNormal);
      builder.addTriangle(a, c, d, sideRole, expectedNormal);
    }
  }

  if (!full && capKeys) {
    const capTriangles = triangulateBoundary(profile.points);
    const startAngle = 0;
    const endAngle = radians;
    const startNormal = scale3(form.frame.normal, angleSign);
    const endRadial = radialAt(form.frame.u, form.frame.normal, endAngle);
    const endPlaneNormal = normalize3(cross3(endRadial, form.frame.v));
    const endNormal = scale3(endPlaneNormal, -angleSign);
    const startRole = addRevolveCap(builder, form.id, capKeys.start, "Start cap", form, startAngle, startNormal, profile.points);
    const endRole = addRevolveCap(builder, form.id, capKeys.end, "End cap", form, endAngle, endNormal, profile.points);
    for (const triangle of capTriangles) {
      const [a, b, c] = triangle;
      builder.addTriangle(ringVertices[a]![0]!, ringVertices[b]![0]!, ringVertices[c]![0]!, startRole, startNormal);
      const endRingIndex = ringCount - 1;
      builder.addTriangle(ringVertices[a]![endRingIndex]!, ringVertices[b]![endRingIndex]!, ringVertices[c]![endRingIndex]!, endRole, endNormal);
    }
  }
}

function radialAt(u: Vec3, normal: Vec3, angle: number): Vec3 {
  return add3(scale3(u, Math.cos(angle)), scale3(normal, -Math.sin(angle)));
}

function addRevolveCap(
  builder: MeshBuilder,
  formId: string,
  partKey: string,
  label: string,
  form: Form,
  angle: number,
  expectedNormal: Vec3,
  profilePoints: Vec2[],
): string {
  const radial = radialAt(form.frame.u, form.frame.normal, angle);
  const frameV = form.frame.v;
  const baseNormal = normalize3(cross3(radial, frameV));
  const flipRadial = dot3(baseNormal, expectedNormal) < 0;
  const frameU = flipRadial ? scale3(radial, -1) : radial;
  const frame = { origin: form.frame.origin, u: frameU, v: frameV, normal: normalize3(cross3(frameU, frameV)) };
  const boundary = profilePoints.map(([radius, height]): Vec2 => [flipRadial ? -radius : radius, height]);
  const address = { formId, partKey };
  return builder.addRole({ address, label, kind: "cap", frame, region: localBounds(boundary), boundary });
}

function buildSweep(form: Form, builder: MeshBuilder): void {
  const operation = form.operation;
  if (operation.kind !== "sweep") return;
  if (!validateFrame(form.frame)) refuse("form-frame", "The form frame must be finite, orthonormal and right-handed.");
  const profile = prepareProfile(form.profile, form.rounding);
  if (profile.points.length > MAX_PROFILE_VERTICES) refuse("profile-limit", "The profile exceeds the evaluator's vertex limit.");
  const carrier = operation.carrier;
  const { points, segmentKeys, anchorIndex, segmentTangents, nodeTangents, scale } = validateCarrier(carrier);
  if (points.length * profile.points.length > 300_000) refuse("geometry-limit", "This sweep would exceed the evaluator's mesh limit.");
  const anchor = carrier.frameAnchor;
  const anchorTangent = nodeTangents[anchorIndex]!;
  const anchorAlignment = dot3(anchor.normal, anchorTangent);
  if (Math.abs(anchorAlignment) < 0.95) {
    refuse("sweep-frame-anchor", "The section frame normal must be close to the carrier tangent at its fixed anchor point.");
  }
  const anchorSign = Math.sign(anchorAlignment);
  const anchorPoint = points[anchorIndex]!;
  if (distance3(anchor.origin, anchorPoint) > Math.max(1e-6, scale * 1e-6)) {
    refuse("sweep-frame-origin", "The frame anchor origin must coincide with its authored carrier point.");
  }

  const isPlanar = points.every((point) => Math.abs(dot3(sub3(point, points[0]!), anchor.v)) <= Math.max(1e-8, scale * 1e-8));
  const turnAngles = nodeTurns(segmentTangents);
  const profileReach = Math.max(...profile.points.map((point) => Math.hypot(point[0], point[1])));
  for (let i = 1; i < points.length - 1; i += 1) {
    const turn = turnAngles[i]!;
    if (turn <= 1e-8) continue;
    const adjacentLength = Math.min(distance3(points[i - 1]!, points[i]!), distance3(points[i]!, points[i + 1]!));
    const curvatureRadius = adjacentLength / (2 * Math.sin(turn / 2));
    if (curvatureRadius <= profileReach * 1.01) {
      refuse("sweep-curvature", "The profile is too wide for this carrier bend; reduce its reach or soften the carrier path.");
    }
    if (!isPlanar && turn > Math.PI / 12) {
      refuse("sweep-spatial-bend", "Non-planar carriers support smooth sampled bends only; sharp spatial corners are refused.");
    }
  }

  assertCarrierClearance(points, profileReach, scale);
  const nodeFrames = isPlanar
    ? planarSweepFrames(points, segmentTangents, anchor, anchorSign, anchorIndex)
    : spatialSweepFrames(points, nodeTangents, anchor, anchorSign, anchorIndex);

  const rings: number[][] = [];
  const ringWorldPoints: Vec3[][] = [];
  for (let i = 0; i < points.length; i += 1) {
    const frame = nodeFrames[i]!;
    rings.push([]);
    ringWorldPoints.push([]);
    for (const point of profile.points) {
      const localX = point[0] * frame.miterScale;
      const world = add3(add3(points[i]!, scale3(frame.u, localX)), scale3(frame.v, point[1]));
      ringWorldPoints[i]!.push(world);
      rings[i]!.push(builder.addVertex(world));
    }
  }

  const areaSign = Math.sign(profile.signedArea);
  for (let carrierIndex = 0; carrierIndex < points.length - 1; carrierIndex += 1) {
    const carrierSegmentKey = segmentKeys[carrierIndex]!;
    const carrierDirection = sub3(points[carrierIndex + 1]!, points[carrierIndex]!);
    for (let profileIndex = 0; profileIndex < profile.points.length; profileIndex += 1) {
      const nextProfile = (profileIndex + 1) % profile.points.length;
      const profileEdge = profile.edges[profileIndex]!;
      const partKey = JSON.stringify(["sweep-side", profileEdge.partKey, carrierSegmentKey]);
      const address = { formId: form.id, partKey };
      const p0 = ringWorldPoints[carrierIndex]![profileIndex]!;
      const p1 = ringWorldPoints[carrierIndex]![nextProfile]!;
      const q1 = ringWorldPoints[carrierIndex + 1]![nextProfile]!;
      const q0 = ringWorldPoints[carrierIndex + 1]![profileIndex]!;
      const desiredNormal = scale3(cross3(sub3(p1, p0), carrierDirection), areaSign * anchorSign);
      const plane = profileEdge.kind === "segment"
        ? canonicalPlanarRoleData([p0, p1, q1, q0], desiredNormal)
        : undefined;
      const label = `${profileEdge.label} along ${carrierSegmentKey}`;
      const sideRole = builder.addRole({ address, label, kind: "face", ...(plane ?? {}) });
      addQuad(builder, [rings[carrierIndex]![profileIndex]!, rings[carrierIndex]![nextProfile]!, rings[carrierIndex + 1]![nextProfile]!, rings[carrierIndex + 1]![profileIndex]!], sideRole, desiredNormal);
    }
  }

  const capTriangles = triangulateBoundary(profile.points);
  for (const endpointIndex of [0, points.length - 1]) {
    const isStart = endpointIndex === 0;
    const carrierPoint = carrier.points[endpointIndex]!;
    const frame = nodeFrames[endpointIndex]!;
    const outward = scale3(segmentDirectionAtEndpoint(segmentTangents, isStart), isStart ? -1 : 1);
    const frameNormal = normalize3(cross3(frame.u, frame.v));
    const flipU = dot3(frameNormal, outward) < 0;
    const capFrameU = flipU ? scale3(frame.u, -1) : frame.u;
    const capFrame = { origin: points[endpointIndex]!, u: capFrameU, v: frame.v, normal: normalize3(cross3(capFrameU, frame.v)) };
    const boundary = profile.points.map(([x, y]): Vec2 => [flipU ? -x : x, y]);
    const partKey = JSON.stringify(["sweep-cap", carrierPoint.id]);
    const capRole = builder.addRole({
      address: { formId: form.id, partKey },
      label: isStart ? "Carrier start cap" : "Carrier end cap",
      kind: "cap",
      frame: capFrame,
      region: localBounds(boundary),
      boundary,
    });
    for (const triangle of capTriangles) {
      const [a, b, c] = triangle;
      builder.addTriangle(rings[endpointIndex]![a]!, rings[endpointIndex]![b]!, rings[endpointIndex]![c]!, capRole, outward);
    }
  }
}

interface CarrierData {
  points: Vec3[];
  segmentKeys: string[];
  anchorIndex: number;
  segmentTangents: Vec3[];
  nodeTangents: Vec3[];
  scale: number;
}

function validateCarrier(carrier: Carrier): CarrierData {
  if (!carrier || !Array.isArray(carrier.points) || !Array.isArray(carrier.segments) || carrier.points.length < 2) {
    refuse("sweep-carrier", "A sweep needs an open carrier with at least two keyed points.");
  }
  if (carrier.points.length > 1024) refuse("sweep-carrier-limit", "The sweep carrier is limited to 1,024 keyed points.");
  if (!validateFrame(carrier.frameAnchor)) refuse("sweep-frame-anchor", "The carrier's frame anchor must be finite, orthonormal and right-handed.");
  if (carrier.segments.length !== carrier.points.length - 1) refuse("sweep-carrier-topology", "Carrier segments must connect each adjacent pair of path points.");
  const pointIds = new Set<string>();
  const points: Vec3[] = [];
  for (const point of carrier.points) {
    if (!point || !point.id || pointIds.has(point.id) || !Array.isArray(point.position) || !finite3(point.position)) {
      refuse("sweep-carrier-point", "Carrier point keys must be unique and positions must be finite.");
    }
    pointIds.add(point.id);
    points.push([...point.position] as Vec3);
  }
  const segmentIds = new Set<string>();
  const segmentByPair = new Map<string, string>();
  for (const segment of carrier.segments) {
    if (!segment || !segment.id || segmentIds.has(segment.id) || !pointIds.has(segment.from) || !pointIds.has(segment.to) || segment.from === segment.to) {
      refuse("sweep-carrier-segment", "Carrier segment keys and endpoints must be unique and valid.");
    }
    const pair = JSON.stringify([segment.from, segment.to].sort());
    if (segmentByPair.has(pair)) refuse("sweep-carrier-segment", "Carrier has duplicate segments between the same points.");
    segmentIds.add(segment.id);
    segmentByPair.set(pair, segment.id);
  }
  const segmentKeys: string[] = [];
  const segmentTangents: Vec3[] = [];
  let pathLength = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = carrier.points[i]!.id;
    const to = carrier.points[i + 1]!.id;
    const key = segmentByPair.get(JSON.stringify([from, to].sort()));
    if (!key) refuse("sweep-carrier-topology", "Carrier segments do not match the authored path order.");
    segmentKeys.push(key);
    const delta = sub3(points[i + 1]!, points[i]!);
    const length = length3(delta);
    if (length <= 1e-9) refuse("sweep-zero-segment", "Carrier segments must have positive length.");
    pathLength += length;
    segmentTangents.push(scale3(delta, 1 / length));
  }
  const nodeTangents: Vec3[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0) nodeTangents.push(segmentTangents[0]!);
    else if (i === points.length - 1) nodeTangents.push(segmentTangents[segmentTangents.length - 1]!);
    else {
      const sum = add3(segmentTangents[i - 1]!, segmentTangents[i]!);
      if (length3(sum) <= 1e-8) refuse("sweep-reversal", "A carrier cannot reverse direction at a shared point.");
      nodeTangents.push(normalize3(sum));
    }
  }
  const anchorIndex = carrier.points.findIndex((point) => point.id === carrier.frameAnchorPointId);
  if (anchorIndex < 0) refuse("sweep-frame-anchor", "The frame anchor point key must name a point on the carrier.");
  const scale = Math.max(1, pathLength, ...points.map((point) => distance3(point, points[0]!)));
  return { points, segmentKeys, anchorIndex, segmentTangents, nodeTangents, scale };
}

interface SweepFrame {
  u: Vec3;
  v: Vec3;
  miterScale: number;
}

function nodeTurns(segmentTangents: Vec3[]): number[] {
  const turns = [0];
  for (let i = 1; i < segmentTangents.length; i += 1) {
    const dot = Math.max(-1, Math.min(1, dot3(segmentTangents[i - 1]!, segmentTangents[i]!)));
    turns.push(Math.acos(dot));
  }
  turns.push(0);
  return turns;
}

function planarSweepFrames(
  points: Vec3[],
  segmentTangents: Vec3[],
  anchor: Carrier["frameAnchor"],
  anchorSign: number,
  anchorIndex: number,
): SweepFrame[] {
  const v = anchor.v;
  const frames: SweepFrame[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0 || i === points.length - 1) {
      const tangent = segmentTangents[i === 0 ? 0 : segmentTangents.length - 1]!;
      const normal = scale3(tangent, anchorSign);
      const u = normalize3(cross3(v, normal));
      frames.push({ u, v, miterScale: 1 });
      continue;
    }
    const previousNormal = scale3(segmentTangents[i - 1]!, anchorSign);
    const nextNormal = scale3(segmentTangents[i]!, anchorSign);
    const previousU = normalize3(cross3(v, previousNormal));
    const nextU = normalize3(cross3(v, nextNormal));
    const miter = normalize3(add3(previousU, nextU));
    const denominator = dot3(miter, previousU);
    if (!Number.isFinite(denominator) || denominator <= 0) refuse("sweep-reversal", "This carrier corner has no finite miter join.");
    const miterScale = 1 / denominator;
    if (miterScale > 4) refuse("sweep-miter-limit", "This carrier corner would create an excessive miter; use a gentler corner.");
    frames.push({ u: miter, v, miterScale });
    if (i === anchorIndex && dot3(miter, anchor.u) < 0.99) {
      refuse("sweep-frame-anchor", "The fixed section frame does not match the carrier's mitered tangent at its anchor.");
    }
  }
  return frames;
}

function spatialSweepFrames(
  points: Vec3[],
  nodeTangents: Vec3[],
  anchor: Carrier["frameAnchor"],
  anchorSign: number,
  anchorIndex: number,
): SweepFrame[] {
  const uAxes: Vec3[] = Array(points.length);
  uAxes[anchorIndex] = anchor.u;
  for (let i = anchorIndex; i < points.length - 1; i += 1) {
    uAxes[i + 1] = doubleReflect(uAxes[i]!, points[i]!, points[i + 1]!, nodeTangents[i]!, nodeTangents[i + 1]!);
  }
  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    uAxes[i] = doubleReflect(uAxes[i + 1]!, points[i + 1]!, points[i]!, nodeTangents[i + 1]!, nodeTangents[i]!);
  }
  return points.map((_point, index) => {
    const canonicalNormal = scale3(nodeTangents[index]!, anchorSign);
    const u = normalize3(sub3(uAxes[index]!, scale3(nodeTangents[index]!, dot3(uAxes[index]!, nodeTangents[index]!))));
    const v = normalize3(cross3(canonicalNormal, u));
    return { u, v, miterScale: 1 };
  });
}

function doubleReflect(u: Vec3, from: Vec3, to: Vec3, tangentFrom: Vec3, tangentTo: Vec3): Vec3 {
  const displacement = sub3(to, from);
  const firstLengthSquared = dot3(displacement, displacement);
  if (firstLengthSquared <= 1e-18) refuse("sweep-zero-segment", "Carrier points must be separated to transport the section frame.");
  const reflect = (vector: Vec3, axis: Vec3, denominator: number): Vec3 => sub3(vector, scale3(axis, 2 * dot3(axis, vector) / denominator));
  const reflectedU = reflect(u, displacement, firstLengthSquared);
  const reflectedTangent = reflect(tangentFrom, displacement, firstLengthSquared);
  const second = sub3(tangentTo, reflectedTangent);
  const secondLengthSquared = dot3(second, second);
  if (secondLengthSquared <= 1e-18) return normalize3(sub3(reflectedU, scale3(tangentTo, dot3(reflectedU, tangentTo))));
  const result = reflect(reflectedU, second, secondLengthSquared);
  return normalize3(sub3(result, scale3(tangentTo, dot3(result, tangentTo))));
}

function segmentDirectionAtEndpoint(segmentTangents: Vec3[], isStart: boolean): Vec3 {
  return segmentTangents[isStart ? 0 : segmentTangents.length - 1]!;
}

function assertCarrierClearance(points: Vec3[], profileReach: number, scale: number): void {
  const tolerance = Math.max(1e-8, scale * 1e-8);
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 2; j < points.length - 1; j += 1) {
      const distance = segmentDistance(points[i]!, points[i + 1]!, points[j]!, points[j + 1]!);
      if (distance <= tolerance) refuse("sweep-carrier-crossing", "The carrier crosses or touches itself.");
      if (j > i + 2 && profileReach > tolerance && distance <= 2 * profileReach) {
        refuse("sweep-carrier-clearance", "The carrier passes too close to itself for this profile; reduce the profile or separate the path.");
      }
    }
  }
}

function segmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = sub3(q1, p1);
  const d2 = sub3(q2, p2);
  const r = sub3(p1, p2);
  const a = dot3(d1, d1);
  const e = dot3(d2, d2);
  const f = dot3(d2, r);
  let s = 0;
  let t = 0;
  if (a <= 1e-18 && e <= 1e-18) return distance3(p1, p2);
  if (a <= 1e-18) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = dot3(d1, r);
    if (e <= 1e-18) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = dot3(d1, d2);
      const denominator = a * e - b * b;
      if (denominator !== 0) s = Math.max(0, Math.min(1, (b * f - c * e) / denominator));
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }
  return distance3(add3(p1, scale3(d1, s)), add3(p2, scale3(d2, t)));
}

function addQuad(builder: MeshBuilder, quad: number[], roleKeyValue: string, desiredNormal: Vec3): void {
  builder.addTriangle(quad[0]!, quad[1]!, quad[2]!, roleKeyValue, desiredNormal);
  builder.addTriangle(quad[0]!, quad[2]!, quad[3]!, roleKeyValue, desiredNormal);
}

function localBounds(points: Vec2[]): { min: Vec2; max: Vec2 } {
  const min: Vec2 = [Infinity, Infinity];
  const max: Vec2 = [-Infinity, -Infinity];
  for (const [x, y] of points) {
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
  }
  return { min, max };
}

function assertClosedSolid(mesh: NumericMesh): void {
  const inspection = inspectMesh(mesh);
  if (!inspection.finitePositions || !inspection.validIndices || !inspection.roleCountMatchesTriangles) {
    refuse("mesh-invalid", "The evaluator produced invalid numeric mesh data.");
  }
  if (inspection.triangleCount === 0 || inspection.degenerateTriangleCount > 0) {
    refuse("mesh-degenerate", "The generated form contains no usable solid or has degenerate triangles.");
  }
  if (inspection.boundaryEdgeCount > 0 || inspection.nonManifoldEdgeCount > 0 || inspection.orientationConflictCount > 0) {
    refuse("mesh-not-closed", "The generated surface is not a closed, consistently oriented solid.");
  }
  const vertexCount = mesh.positions.length / 3;
  const origin: Vec3 = [mesh.positions[0]!, mesh.positions[1]!, mesh.positions[2]!];
  let sixVolume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const read = (index: number): Vec3 => [
      mesh.positions[index * 3]! - origin[0],
      mesh.positions[index * 3 + 1]! - origin[1],
      mesh.positions[index * 3 + 2]! - origin[2],
    ];
    const a = read(mesh.indices[i]!);
    const b = read(mesh.indices[i + 1]!);
    const c = read(mesh.indices[i + 2]!);
    sixVolume += dot3(a, cross3(b, c));
  }
  const points: Vec3[] = [];
  for (let i = 0; i < vertexCount; i += 1) {
    points.push([mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!]);
  }
  let diameter = 0;
  for (const point of points) diameter = Math.max(diameter, length3(sub3(point, origin)));
  if (!Number.isFinite(sixVolume) || sixVolume <= Math.max(1e-30, diameter ** 3 * 1e-12)) {
    refuse("mesh-zero-volume", "The generated form has no positive enclosed volume.");
  }
}

/** Evaluate one authored form. The `document` argument is reserved for host-aware expansion. */
export function evaluateForm(form: Form, document: LabDocument): FormEvaluation {
  void document;
  const formId = typeof form?.id === "string" ? form.id : "";
  if (!formId) return emptyFormEvaluation(formId, { code: "form-id", message: "A form needs a non-empty authored ID." });
  try {
    if (!form.profile || !form.rounding || !form.operation) refuse("form-incomplete", "The form is missing its profile, operation or rounding policy.");
    if (!validateFrame(form.frame)) refuse("form-frame", "The form frame must be finite, orthonormal and right-handed.");
    const builder = new MeshBuilder(roleKey);
    if (form.operation.kind === "extrude") buildExtrusion(form, builder);
    else if (form.operation.kind === "revolve") buildRevolve(form, builder);
    else if (form.operation.kind === "sweep") buildSweep(form, builder);
    else refuse("operation-kind", "This form operation is not supported.");
    const { mesh, roles } = builder.finish();
    assertClosedSolid(mesh);
    return { formId, valid: true, mesh, roles };
  } catch (error) {
    const refusal = error instanceof GeometryRefusal
      ? { code: error.code, message: error.message }
      : { code: "geometry-internal", message: "The form could not be evaluated safely." };
    return emptyFormEvaluation(formId, refusal);
  }
}

/** Evaluate all forms through the same form evaluator used by preview and commit. */
export function evaluateDocument(document: LabDocument): DocumentEvaluation {
  if (!document || document.formatVersion !== 1 || !Array.isArray(document.forms)) {
    const reason = { code: "document-format", message: "The document is not a supported Native Form Lab document." };
    return { valid: false, reason, mesh: { ...EMPTY_MESH }, roles: [], forms: {} };
  }
  const ids = new Set<string>();
  for (const form of document.forms) {
    if (!form || typeof form.id !== "string" || !form.id || ids.has(form.id)) {
      const reason = { code: "duplicate-form-id", message: "Form IDs must be non-empty and unique within the document." };
      return { valid: false, reason, mesh: { ...EMPTY_MESH }, roles: [], forms: {} };
    }
    ids.add(form.id);
  }
  const formEvaluations: Record<string, FormEvaluation> = {};
  const positions: number[] = [];
  const indices: number[] = [];
  const triangleRoleKeys: string[] = [];
  const roles: FormEvaluation["roles"] = [];
  let reason: DocumentEvaluation["reason"];
  for (const form of document.forms) {
    const result = evaluateForm(form, document);
    formEvaluations[form.id] = result;
    if (!result.valid && !reason) reason = result.reason;
    const offset = positions.length / 3;
    positions.push(...result.mesh.positions);
    indices.push(...result.mesh.indices.map((index) => index + offset));
    triangleRoleKeys.push(...result.mesh.triangleRoleKeys);
    roles.push(...result.roles);
  }
  return {
    valid: !reason,
    ...(reason ? { reason } : {}),
    mesh: { positions, indices, triangleRoleKeys },
    roles: roles.sort((a, b) => a.key.localeCompare(b.key)),
    forms: formEvaluations,
  };
}
