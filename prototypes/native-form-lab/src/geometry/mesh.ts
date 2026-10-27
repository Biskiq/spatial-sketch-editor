import { ShapeUtils, Vector2 } from "three";
import type { Bounds2, Bounds3, Frame, GeneratedRole, NumericMesh, RoleAddress, RoleKind, Vec2, Vec3 } from "../model/types";
import { refuse } from "./errors";
import { area2, bounds2, cross2, cross3, dot3, length3, normalize3, scale3, sub3 } from "./math";

export interface RoleDraft {
  address: RoleAddress;
  label: string;
  kind: RoleKind;
  frame?: Frame;
  region?: Bounds2;
  boundary?: Vec2[];
}

export interface MeshInspection {
  finitePositions: boolean;
  validIndices: boolean;
  roleCountMatchesTriangles: boolean;
  triangleCount: number;
  degenerateTriangleCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  orientationConflictCount: number;
}

interface MutableRole extends GeneratedRole {
  min: Vec3;
  max: Vec3;
  hasTriangles: boolean;
}

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly indices: number[] = [];
  readonly triangleRoleKeys: string[] = [];
  private readonly roleByKey = new Map<string, MutableRole>();
  private readonly roleKeyFn: (address: RoleAddress) => string;

  constructor(roleKeyFn: (address: RoleAddress) => string) {
    this.roleKeyFn = roleKeyFn;
  }

  addVertex(position: Vec3): number {
    if (!position.every(Number.isFinite)) refuse("geometry-non-finite", "Evaluation produced a non-finite vertex.");
    const index = this.positions.length / 3;
    this.positions.push(position[0], position[1], position[2]);
    return index;
  }

  addRole(draft: RoleDraft): string {
    const key = this.roleKeyFn(draft.address);
    const prior = this.roleByKey.get(key);
    if (prior) {
      if (prior.address.formId !== draft.address.formId || prior.address.partKey !== draft.address.partKey) {
        refuse("role-key-collision", "Two authored parts produced the same semantic role address.");
      }
      if (prior.kind !== draft.kind || prior.label !== draft.label) {
        refuse("role-key-collision", "Two different generated surface roles share one semantic address.");
      }
      return key;
    }
    this.roleByKey.set(key, {
      key,
      address: draft.address,
      label: draft.label,
      kind: draft.kind,
      ...(draft.frame ? { frame: draft.frame } : {}),
      ...(draft.region ? { region: draft.region } : {}),
      ...(draft.boundary ? { boundary: draft.boundary.map((point) => [...point] as Vec2) } : {}),
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
      hasTriangles: false,
    });
    return key;
  }

  addTriangle(a: number, b: number, c: number, roleKey: string, expectedNormal?: Vec3): void {
    if (a === b || b === c || c === a) return;
    const pa = this.vertex(a);
    const pb = this.vertex(b);
    const pc = this.vertex(c);
    let normal = cross3(sub3(pb, pa), sub3(pc, pa));
    const normalLength = length3(normal);
    if (!Number.isFinite(normalLength) || normalLength <= 1e-14) return;
    if (expectedNormal) {
      const agreement = dot3(normal, expectedNormal);
      if (Math.abs(agreement) <= 1e-18) return;
      if (agreement < 0) {
        [b, c] = [c, b];
        normal = scale3(normal, -1);
      }
    }
    const role = this.roleByKey.get(roleKey);
    if (!role) refuse("role-missing", "A generated triangle has no semantic source role.");
    this.indices.push(a, b, c);
    this.triangleRoleKeys.push(roleKey);
    for (const index of [a, b, c]) {
      const point = this.vertex(index);
      role.min = [Math.min(role.min[0], point[0]), Math.min(role.min[1], point[1]), Math.min(role.min[2], point[2])];
      role.max = [Math.max(role.max[0], point[0]), Math.max(role.max[1], point[1]), Math.max(role.max[2], point[2])];
    }
    role.hasTriangles = true;
  }

  finish(): { mesh: NumericMesh; roles: GeneratedRole[] } {
    const roles = [...this.roleByKey.values()]
      .filter((role) => role.hasTriangles)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((role): GeneratedRole => ({
        key: role.key,
        address: role.address,
        label: role.label,
        kind: role.kind,
        ...(role.frame ? { frame: role.frame } : {}),
        ...(role.region ? { region: role.region } : {}),
        ...(role.boundary ? { boundary: role.boundary } : {}),
        bounds: { min: role.min, max: role.max },
      }));
    return {
      mesh: { positions: this.positions, indices: this.indices, triangleRoleKeys: this.triangleRoleKeys },
      roles,
    };
  }

  private vertex(index: number): Vec3 {
    const offset = index * 3;
    if (!Number.isInteger(index) || index < 0 || offset + 2 >= this.positions.length) {
      refuse("geometry-index", "Evaluation produced an invalid mesh index.");
    }
    return [this.positions[offset]!, this.positions[offset + 1]!, this.positions[offset + 2]!];
  }
}

/** Ear clipping plus explicit boundary-edge subdivision for collinear authored points. */
export function triangulateBoundary(points: Vec2[]): number[][] {
  if (points.length < 3) refuse("cap-profile", "A cap needs at least three boundary points.");
  const extent = bounds2(points);
  const scale = Math.max(1, Math.hypot(extent.max[0] - extent.min[0], extent.max[1] - extent.min[1]));
  const epsilon = scale * 1e-10;
  const areaEpsilon = scale * scale * 1e-12;
  const simplified: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const previous = points[(i + points.length - 1) % points.length]!;
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    const incoming = [current[0] - previous[0], current[1] - previous[1]] as Vec2;
    const outgoing = [next[0] - current[0], next[1] - current[1]] as Vec2;
    const turn = cross2(incoming, outgoing);
    if (Math.abs(turn) <= areaEpsilon && incoming[0] * outgoing[0] + incoming[1] * outgoing[1] >= 0) continue;
    simplified.push(i);
  }
  if (simplified.length < 3) refuse("cap-profile", "The cap boundary has fewer than three distinct corners.");
  const simplifiedPoints = simplified.map((index) => points[index]!);
  if (Math.abs(area2(simplifiedPoints)) <= areaEpsilon) refuse("cap-profile", "The cap boundary encloses no area.");
  const contour = simplifiedPoints.map((point) => new Vector2(point[0], point[1]));
  let faces = ShapeUtils.triangulateShape(contour, []);
  if (!faces.length) refuse("cap-triangulation", "The cap contour could not be triangulated.");
  let triangles = faces.map((face) => face.map((index) => simplified[index]!) as [number, number, number]);

  for (let edgeIndex = 0; edgeIndex < simplified.length; edgeIndex += 1) {
    const start = simplified[edgeIndex]!;
    const end = simplified[(edgeIndex + 1) % simplified.length]!;
    const chain: number[] = [start];
    let cursor = (start + 1) % points.length;
    while (cursor !== end && chain.length <= points.length) {
      chain.push(cursor);
      cursor = (cursor + 1) % points.length;
    }
    if (cursor !== end) refuse("cap-boundary", "The cap boundary order is inconsistent.");
    chain.push(end);
    if (chain.length <= 2) continue;

    let found = false;
    const replacement: [number, number, number][] = [];
    const retained: [number, number, number][] = [];
    for (const triangle of triangles) {
      const directed = directedTriangleEdge(triangle, start, end);
      if (!directed) {
        retained.push(triangle);
        continue;
      }
      found = true;
      const third = triangle.find((index) => index !== start && index !== end)!;
      const [from, to] = directed;
      for (let i = 0; i < chain.length - 1; i += 1) {
        const a = from === start ? chain[i]! : chain[chain.length - 1 - i]!;
        const b = from === start ? chain[i + 1]! : chain[chain.length - 2 - i]!;
        replacement.push([a, b, third]);
      }
    }
    if (!found) refuse("cap-boundary", "The triangulated cap did not retain a boundary edge.");
    triangles = retained.concat(replacement);
  }

  for (const triangle of triangles) {
    const [a, b, c] = triangle.map((index) => points[index]!) as [Vec2, Vec2, Vec2];
    if (Math.abs(cross2([b[0] - a[0], b[1] - a[1]], [c[0] - a[0], c[1] - a[1]])) <= areaEpsilon) {
      refuse("cap-triangulation", "Cap triangulation produced a degenerate triangle.");
    }
  }
  return triangles;
}

function directedTriangleEdge(triangle: [number, number, number], start: number, end: number): [number, number] | null {
  for (let i = 0; i < 3; i += 1) {
    const a = triangle[i]!;
    const b = triangle[(i + 1) % 3]!;
    if ((a === start && b === end) || (a === end && b === start)) return [a, b];
  }
  return null;
}

export function boundsForPoints(points: Vec3[]): Bounds3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    min[2] = Math.min(min[2], point[2]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
    max[2] = Math.max(max[2], point[2]);
  }
  return { min, max };
}

export function planarRoleData(points: Vec3[], desiredNormal: Vec3): { frame: Frame; region: Bounds2; boundary: Vec2[] } | undefined {
  if (points.length < 3) return undefined;
  const normal = normalize3(desiredNormal);
  if (length3(normal) < 0.99) return undefined;
  let edge = sub3(points[1]!, points[0]!);
  if (length3(edge) <= 1e-10) {
    edge = points.slice(2).map((point) => sub3(point, points[0]!)).sort((a, b) => length3(b) - length3(a))[0] ?? [0, 0, 0];
  }
  const u = normalize3(sub3(edge, scale3(normal, dot3(edge, normal))));
  if (length3(u) < 0.99) return undefined;
  const v = normalize3(cross3(normal, u));
  const origin = points[0]!;
  const tolerance = Math.max(1e-9, Math.max(...points.map((point) => length3(sub3(point, origin)))) * 1e-8);
  for (const point of points) {
    if (Math.abs(dot3(sub3(point, origin), normal)) > tolerance) return undefined;
  }
  const boundary = points.map((point): Vec2 => [dot3(sub3(point, origin), u), dot3(sub3(point, origin), v)]);
  const region = bounds2(boundary);
  return { frame: { origin, u, v, normal }, region, boundary };
}

/** Planar role frame with a vertex order independent of carrier traversal direction. */
export function canonicalPlanarRoleData(points: Vec3[], desiredNormal: Vec3): { frame: Frame; region: Bounds2; boundary: Vec2[] } | undefined {
  if (points.length < 3) return undefined;
  const normal = normalize3(desiredNormal);
  if (length3(normal) < 0.99) return undefined;
  const compare = (a: Vec3, b: Vec3): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const ordered = points.slice().sort(compare);
  const origin = ordered[0]!;
  const farthest = ordered.slice(1).sort((a, b) => length3(sub3(b, origin)) - length3(sub3(a, origin)) || compare(a, b))[0];
  if (!farthest) return undefined;
  const edge = sub3(farthest, origin);
  const u = normalize3(sub3(edge, scale3(normal, dot3(edge, normal))));
  if (length3(u) < 0.99) return undefined;
  const v = normalize3(cross3(normal, u));
  const tolerance = Math.max(1e-9, Math.max(...points.map((point) => length3(sub3(point, origin)))) * 1e-8);
  for (const point of points) {
    if (Math.abs(dot3(sub3(point, origin), normal)) > tolerance) return undefined;
  }
  const local = points.map((point): Vec2 => [dot3(sub3(point, origin), u), dot3(sub3(point, origin), v)]);
  const center: Vec2 = [local.reduce((sum, point) => sum + point[0], 0) / local.length, local.reduce((sum, point) => sum + point[1], 0) / local.length];
  const boundary = local.slice().sort((a, b) => Math.atan2(a[1] - center[1], a[0] - center[0]) - Math.atan2(b[1] - center[1], b[0] - center[0]));
  return { frame: { origin, u, v, normal }, region: bounds2(boundary), boundary };
}

export function inspectMesh(mesh: NumericMesh): MeshInspection {
  const finitePositions = mesh.positions.every(Number.isFinite) && mesh.positions.length % 3 === 0;
  const triangleCount = Math.floor(mesh.indices.length / 3);
  let validIndices = mesh.indices.length % 3 === 0;
  let degenerateTriangleCount = 0;
  const edges = new Map<string, { count: number; orientation: number }>();
  const boundsMin: Vec3 = [Infinity, Infinity, Infinity];
  const boundsMax: Vec3 = [-Infinity, -Infinity, -Infinity];
  if (finitePositions) {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      boundsMin[0] = Math.min(boundsMin[0], mesh.positions[i]!);
      boundsMin[1] = Math.min(boundsMin[1], mesh.positions[i + 1]!);
      boundsMin[2] = Math.min(boundsMin[2], mesh.positions[i + 2]!);
      boundsMax[0] = Math.max(boundsMax[0], mesh.positions[i]!);
      boundsMax[1] = Math.max(boundsMax[1], mesh.positions[i + 1]!);
      boundsMax[2] = Math.max(boundsMax[2], mesh.positions[i + 2]!);
    }
  }
  const scale = finitePositions ? Math.max(1, length3(sub3(boundsMax, boundsMin))) : 1;
  const areaThreshold = Math.max(1e-28, scale * scale * 1e-20);
  const addEdge = (a: number, b: number): void => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const key = `${min}:${max}`;
    const current = edges.get(key) ?? { count: 0, orientation: 0 };
    current.count += 1;
    current.orientation += a < b ? 1 : -1;
    edges.set(key, current);
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i]!;
    const b = mesh.indices[i + 1]!;
    const c = mesh.indices[i + 2]!;
    if ([a, b, c].some((index) => !Number.isInteger(index) || index < 0 || index * 3 + 2 >= mesh.positions.length)) {
      validIndices = false;
      continue;
    }
    const point = (index: number): Vec3 => [mesh.positions[index * 3]!, mesh.positions[index * 3 + 1]!, mesh.positions[index * 3 + 2]!];
    const normal = cross3(sub3(point(b), point(a)), sub3(point(c), point(a)));
    if (length3(normal) <= areaThreshold) degenerateTriangleCount += 1;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }
  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  let orientationConflictCount = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1) boundaryEdgeCount += 1;
    else if (edge.count !== 2) nonManifoldEdgeCount += 1;
    else if (edge.orientation !== 0) orientationConflictCount += 1;
  }
  return {
    finitePositions,
    validIndices,
    roleCountMatchesTriangles: mesh.triangleRoleKeys.length === triangleCount,
    triangleCount,
    degenerateTriangleCount,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    orientationConflictCount,
  };
}
