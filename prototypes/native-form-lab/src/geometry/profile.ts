import type { Profile, Rounding, Vec2 } from "../model/types";
import { GeometryRefusal, refuse } from "./errors";
import { area2, bounds2, cross2, dot2, length2, normalize2, sub2 } from "./math";

export interface ProfileEdge {
  /** Authored profile segment key, or a stable authored point-derived corner key. */
  partKey: string;
  label: string;
  kind: "segment" | "rounded-corner";
}

export interface PreparedProfile {
  points: Vec2[];
  /** Edge i joins points[i] to points[(i + 1) % points.length]. */
  edges: ProfileEdge[];
  signedArea: number;
  scale: number;
}

interface CornerArc {
  points: Vec2[];
  partKey: string;
}

function profileScale(points: Vec2[]): number {
  const { min, max } = bounds2(points);
  return Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1]));
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return cross2(sub2(b, a), sub2(c, a));
}

function onSegment(a: Vec2, b: Vec2, p: Vec2, epsilon: number): boolean {
  return Math.abs(orient(a, b, p)) <= epsilon
    && p[0] >= Math.min(a[0], b[0]) - epsilon
    && p[0] <= Math.max(a[0], b[0]) + epsilon
    && p[1] >= Math.min(a[1], b[1]) - epsilon
    && p[1] <= Math.max(a[1], b[1]) + epsilon;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2, linearEpsilon: number, orientationEpsilon: number): boolean {
  const abC = orient(a, b, c);
  const abD = orient(a, b, d);
  const cdA = orient(c, d, a);
  const cdB = orient(c, d, b);
  const sign = (value: number): number => value > orientationEpsilon ? 1 : value < -orientationEpsilon ? -1 : 0;
  const s1 = sign(abC);
  const s2 = sign(abD);
  const s3 = sign(cdA);
  const s4 = sign(cdB);
  if (s1 * s2 < 0 && s3 * s4 < 0) return true;
  return (s1 === 0 && onSegment(a, b, c, linearEpsilon))
    || (s2 === 0 && onSegment(a, b, d, linearEpsilon))
    || (s3 === 0 && onSegment(c, d, a, linearEpsilon))
    || (s4 === 0 && onSegment(c, d, b, linearEpsilon));
}

function assertSimplePolygon(points: Vec2[], messagePrefix: string): number {
  if (points.length < 3) refuse("profile-too-small", "A closed profile needs at least three points.");
  const scale = profileScale(points);
  const epsilon = scale * 1e-10;
  const areaEpsilon = scale * scale * 1e-12;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (length2(sub2(b, a)) <= epsilon) {
      refuse("profile-zero-edge", `${messagePrefix} contains a zero-length edge.`);
    }
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === points.length - 1);
      if (adjacent) continue;
      const c = points[j]!;
      const d = points[(j + 1) % points.length]!;
      if (segmentsIntersect(a, b, c, d, epsilon, epsilon * scale)) {
        refuse("profile-self-intersection", `${messagePrefix} crosses itself; edit the contour before evaluating it.`);
      }
    }
  }
  const signedArea = area2(points);
  if (!Number.isFinite(signedArea) || Math.abs(signedArea) <= areaEpsilon) {
    refuse("profile-zero-area", `${messagePrefix} encloses no usable area.`);
  }
  return signedArea;
}

function orderedSegmentKeys(profile: Profile): string[] {
  if (profile.closed !== true || !Array.isArray(profile.points) || !Array.isArray(profile.segments)) {
    refuse("profile-invalid", "The form needs one closed, keyed profile contour.");
  }
  const points = profile.points;
  const segments = profile.segments;
  if (points.length < 3 || segments.length !== points.length) {
    refuse("profile-topology", "The profile needs one keyed segment between each adjacent pair of points.");
  }
  const pointIds = new Set<string>();
  for (const point of points) {
    if (!point || typeof point.id !== "string" || point.id.length === 0 || pointIds.has(point.id)) {
      refuse("profile-point-key", "Profile point keys must be non-empty and unique.");
    }
    if (!Array.isArray(point.position) || point.position.length !== 2 || !point.position.every(Number.isFinite)) {
      refuse("profile-coordinate", "Profile points must have finite metre coordinates.");
    }
    pointIds.add(point.id);
  }
  const segmentIds = new Set<string>();
  const byEndpoints = new Map<string, string>();
  for (const segment of segments) {
    if (!segment || typeof segment.id !== "string" || segment.id.length === 0 || segmentIds.has(segment.id)) {
      refuse("profile-segment-key", "Profile segment keys must be non-empty and unique.");
    }
    if (!pointIds.has(segment.from) || !pointIds.has(segment.to) || segment.from === segment.to) {
      refuse("profile-segment-endpoints", `Profile segment ${segment.id} must connect two existing points.`);
    }
    const pair = JSON.stringify([segment.from, segment.to].sort());
    if (byEndpoints.has(pair)) refuse("profile-segment-duplicate", "The profile has more than one segment between the same points.");
    byEndpoints.set(pair, segment.id);
    segmentIds.add(segment.id);
  }
  const ordered: string[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const from = points[i]!.id;
    const to = points[(i + 1) % points.length]!.id;
    const key = byEndpoints.get(JSON.stringify([from, to].sort()));
    if (!key) refuse("profile-segment-endpoints", "Profile segments do not follow the authored contour order.");
    ordered.push(key);
  }
  return ordered;
}

function cornerKey(pointId: string): string {
  return JSON.stringify(["profile-corner", pointId]);
}

export function prepareProfile(profile: Profile, rounding: Rounding): PreparedProfile {
  if (!Array.isArray(profile?.points) || profile.points.length > 256) {
    refuse("profile-limit", "The single-contour evaluator supports up to 256 authored profile points.");
  }
  const segmentKeys = orderedSegmentKeys(profile);
  const points = profile.points.map((point) => [...point.position] as Vec2);
  assertSimplePolygon(points, "The profile");

  // Corner role identity is based on the point key, not its contour index.
  const pointIds = profile.points.map((point) => point.id);
  const profileWithPointKeys = roundProfile(points, segmentKeys, rounding, pointIds);
  return profileWithPointKeys;
}

function roundProfile(points: Vec2[], segmentKeys: string[], rounding: Rounding, pointIds: string[]): PreparedProfile {
  if (!rounding || (rounding.policy !== "none" && rounding.policy !== "profile-corners")) {
    refuse("rounding-policy", "Choose either no profile rounding or explicit profile-corner rounding.");
  }
  if (!Number.isFinite(rounding.radius) || rounding.radius < 0) {
    refuse("rounding-radius", "The profile-corner radius must be a finite, non-negative distance in metres.");
  }
  const originalArea = assertSimplePolygon(points, "The profile");
  const scale = profileScale(points);
  const linearEpsilon = scale * 1e-10;
  const arcs: CornerArc[] = points.map((point, i) => ({ points: [point], partKey: cornerKey(pointIds[i]!) }));
  const cutIn = Array(points.length).fill(0) as number[];
  const cutOut = Array(points.length).fill(0) as number[];

  if (rounding.policy === "profile-corners" && rounding.radius <= linearEpsilon) {
    refuse("rounding-radius", "Profile-corner rounding needs a positive radius; choose no rounding to keep sharp corners.");
  }
  if (rounding.policy === "profile-corners") {
    for (let i = 0; i < points.length; i += 1) {
      const previous = points[(i + points.length - 1) % points.length]!;
      const current = points[i]!;
      const next = points[(i + 1) % points.length]!;
      const incoming = normalize2(sub2(current, previous));
      const outgoing = normalize2(sub2(next, current));
      const turn = Math.atan2(cross2(incoming, outgoing), dot2(incoming, outgoing));
      if (Math.abs(Math.PI - Math.abs(turn)) <= 1e-7) {
        refuse("rounding-cusp", "A near-reversing profile corner cannot be rounded safely.");
      }
      if (Math.abs(turn) <= 1e-7) continue;
      if (Math.sign(turn) !== Math.sign(originalArea)) {
        refuse("rounding-concave-corner", "This evaluator rounds convex profile corners only; disable rounding or simplify the concave profile.");
      }
      const distance = rounding.radius * Math.tan(Math.abs(turn) / 2);
      if (!Number.isFinite(distance) || distance <= linearEpsilon) continue;
      cutIn[i] = distance;
      cutOut[i] = distance;
      const start = sub2(current, [incoming[0] * distance, incoming[1] * distance]);
      const end = [current[0] + outgoing[0] * distance, current[1] + outgoing[1] * distance] as Vec2;
      const turnSign = Math.sign(turn);
      const left: Vec2 = [-incoming[1], incoming[0]];
      const center = [start[0] + left[0] * turnSign * rounding.radius, start[1] + left[1] * turnSign * rounding.radius] as Vec2;
      const radial = sub2(start, center);
      const subdivisions = Math.max(1, Math.ceil(Math.abs(turn) / (Math.PI / 12)));
      const pointsOnArc: Vec2[] = [];
      for (let step = 0; step <= subdivisions; step += 1) {
        const angle = turn * (step / subdivisions);
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        pointsOnArc.push([
          center[0] + radial[0] * c - radial[1] * s,
          center[1] + radial[0] * s + radial[1] * c,
        ]);
      }
      pointsOnArc[pointsOnArc.length - 1] = end;
      arcs[i] = { points: pointsOnArc, partKey: cornerKey(pointIds[i]!) };
    }

    for (let i = 0; i < points.length; i += 1) {
      const next = (i + 1) % points.length;
      const edgeLength = length2(sub2(points[next]!, points[i]!));
      if (cutOut[i]! + cutIn[next]! >= edgeLength - linearEpsilon) {
        refuse("rounding-overlap", "Adjacent profile-corner radii overlap; reduce the radius.");
      }
    }
  }

  const outputPoints: Vec2[] = [];
  const outputEdges: ProfileEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const arc = arcs[i]!;
    if (i === 0) outputPoints.push(arc.points[0]!);
    for (let j = 1; j < arc.points.length; j += 1) {
      outputEdges.push({ partKey: arc.partKey, label: `Rounded corner ${pointIds[i]}`, kind: "rounded-corner" });
      outputPoints.push(arc.points[j]!);
    }
    outputEdges.push({ partKey: segmentKeys[i]!, label: `Profile segment ${segmentKeys[i]}`, kind: "segment" });
    if (i < points.length - 1) outputPoints.push(arcs[i + 1]!.points[0]!);
  }

  if (outputPoints.length !== outputEdges.length) {
    refuse("profile-internal", "The rounded profile could not preserve its contour boundary.");
  }
  const roundedArea = assertSimplePolygon(outputPoints, "The rounded profile");
  if (Math.sign(roundedArea) !== Math.sign(originalArea)) {
    refuse("rounding-self-intersection", "Profile-corner rounding changes the contour orientation; reduce the radius.");
  }
  return { points: outputPoints, edges: outputEdges, signedArea: roundedArea, scale };
}
