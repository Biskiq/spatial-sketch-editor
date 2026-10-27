import type { Vec2 } from './types';

/** Positional tolerance for the metre-scale fixture: 0.1 mm. */
export const TOL = 1e-4;
/** Shortest accepted guide segment. */
export const MIN_SEGMENT = 0.01;
/** Miter joins longer than this many half-widths are refused. */
export const MITER_LIMIT = 4;

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
export const len = (a: Vec2) => Math.hypot(a[0], a[1]);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l > 0 ? [a[0] / l, a[1] / l] : [0, 0];
};
/** Left normal of a floor tangent (tx, tz): (−tz, tx). */
export const leftNormal = (t: Vec2): Vec2 => [-t[1], t[0]];

/** Closed-segment intersection including touching and collinear overlap. */
export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2, eps = 1e-9): boolean {
  const d1 = cross(sub(q2, q1), sub(p1, q1));
  const d2 = cross(sub(q2, q1), sub(p2, q1));
  const d3 = cross(sub(p2, p1), sub(q1, p1));
  const d4 = cross(sub(p2, p1), sub(q2, p1));
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
  const onSeg = (a: Vec2, b: Vec2, p: Vec2) =>
    Math.min(a[0], b[0]) - eps <= p[0] && p[0] <= Math.max(a[0], b[0]) + eps &&
    Math.min(a[1], b[1]) - eps <= p[1] && p[1] <= Math.max(a[1], b[1]) + eps;
  if (Math.abs(d1) <= eps && onSeg(q1, q2, p1)) return true;
  if (Math.abs(d2) <= eps && onSeg(q1, q2, p2)) return true;
  if (Math.abs(d3) <= eps && onSeg(p1, p2, q1)) return true;
  if (Math.abs(d4) <= eps && onSeg(p1, p2, q2)) return true;
  return false;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** True when two simple polygons overlap with positive area or touch. */
export function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

/** Index pairs of non-adjacent closed-polygon edges that intersect. */
export function polygonSelfIntersection(poly: Vec2[]): [number, number] | null {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return [i, j];
    }
  }
  return null;
}
