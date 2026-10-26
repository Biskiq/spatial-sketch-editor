import type { Frame, Vec2, Vec3 } from "../model/types";

export const EPS = 1e-10;

export const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale2 = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const dot2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross2 = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const length2 = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const normalize2 = (a: Vec2): Vec2 => {
  const length = length2(a);
  return length > EPS ? [a[0] / length, a[1] / length] : [0, 0];
};

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize3 = (a: Vec3): Vec3 => {
  const length = length3(a);
  return length > EPS ? [a[0] / length, a[1] / length, a[2] / length] : [0, 0, 0];
};
export const distance3 = (a: Vec3, b: Vec3): number => length3(sub3(a, b));
export const finite2 = (a: Vec2): boolean => Number.isFinite(a[0]) && Number.isFinite(a[1]);
export const finite3 = (a: Vec3): boolean => Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);

export function mapFrame(frame: Frame, x: number, y: number, normalOffset = 0): Vec3 {
  return add3(
    add3(add3(frame.origin, scale3(frame.u, x)), scale3(frame.v, y)),
    scale3(frame.normal, normalOffset),
  );
}

export function validateFrame(frame: Frame): boolean {
  if (!frame || !finite3(frame.origin) || !finite3(frame.u) || !finite3(frame.v) || !finite3(frame.normal)) return false;
  const tolerance = 1e-6;
  return Math.abs(length3(frame.u) - 1) <= tolerance
    && Math.abs(length3(frame.v) - 1) <= tolerance
    && Math.abs(length3(frame.normal) - 1) <= tolerance
    && Math.abs(dot3(frame.u, frame.v)) <= tolerance
    && Math.abs(dot3(frame.u, frame.normal)) <= tolerance
    && Math.abs(dot3(frame.v, frame.normal)) <= tolerance
    && distance3(cross3(frame.u, frame.v), frame.normal) <= tolerance;
}

export function frameFromAxes(origin: Vec3, u: Vec3, v: Vec3): Frame {
  const uUnit = normalize3(u);
  const vOrthogonal = sub3(v, scale3(uUnit, dot3(v, uUnit)));
  const vUnit = normalize3(vOrthogonal);
  return { origin, u: uUnit, v: vUnit, normal: normalize3(cross3(uUnit, vUnit)) };
}

export function rotateAroundAxis(vector: Vec3, axis: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return add3(
    add3(scale3(vector, c), scale3(cross3(axis, vector), s)),
    scale3(axis, dot3(axis, vector) * (1 - c)),
  );
}

export function bounds2(points: Vec2[]): { min: Vec2; max: Vec2 } {
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

export function area2(points: Vec2[]): number {
  if (points.length < 3) return 0;
  const origin = points[0]!;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const sourceA = points[i]!;
    const sourceB = points[(i + 1) % points.length]!;
    const a: Vec2 = [sourceA[0] - origin[0], sourceA[1] - origin[1]];
    const b: Vec2 = [sourceB[0] - origin[0], sourceB[1] - origin[1]];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}
