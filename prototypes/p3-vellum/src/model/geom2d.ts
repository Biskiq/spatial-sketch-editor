// Plan geometry. A plan point is [x, z] in metres (three.js x and z; y is up).
export type V2 = [number, number];

export const EPS = 1e-9;

export const v = (x: number, z: number): V2 => [x, z];
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];
export const len = (a: V2) => Math.hypot(a[0], a[1]);
export const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const norm = (a: V2): V2 => {
  const l = len(a);
  return l < EPS ? [0, 0] : [a[0] / l, a[1] / l];
};
/** Left normal of a direction (rotate +90° in the x–z math frame). */
export const perp = (a: V2): V2 => [-a[1], a[0]];
export const angleOf = (a: V2) => Math.atan2(a[1], a[0]);
export const fromAngle = (t: number): V2 => [Math.cos(t), Math.sin(t)];
export const rot = (p: V2, ang: number, c: V2 = [0, 0]): V2 => {
  const s = Math.sin(ang), co = Math.cos(ang);
  const x = p[0] - c[0], z = p[1] - c[1];
  return [c[0] + x * co - z * s, c[1] + x * s + z * co];
};
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const near = (a: V2, b: V2, tol = 1e-6) => dist(a, b) <= tol;
export const round = (x: number, step: number) => Math.round(x / step) * step;

export function polyArea(poly: V2[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function polyCentroid(poly: V2[]): V2 {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c;
    cx += (p[0] + q[0]) * c;
    cz += (p[1] + q[1]) * c;
  }
  if (Math.abs(a) < EPS) {
    const s = poly.reduce((acc, p) => add(acc, p), [0, 0] as V2);
    return mul(s, 1 / Math.max(1, poly.length));
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInPoly(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] + EPS) + a[0]) inside = !inside;
  }
  return inside;
}

export function pointInPolyHoles(p: V2, poly: V2[], holes: V2[][] = []): boolean {
  if (!pointInPoly(p, poly)) return false;
  for (const h of holes) if (pointInPoly(p, h)) return false;
  return true;
}

export function bbox(pts: V2[]): { min: V2; max: V2 } {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < z0) z0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > z1) z1 = p[1];
  }
  return { min: [x0, z0], max: [x1, z1] };
}

export function bboxOverlap(a: { min: V2; max: V2 }, b: { min: V2; max: V2 }, pad = 0) {
  return a.min[0] - pad <= b.max[0] && b.min[0] - pad <= a.max[0] && a.min[1] - pad <= b.max[1] && b.min[1] - pad <= a.max[1];
}

/** Closest point on segment ab to p. */
export function closestOnSeg(p: V2, a: V2, b: V2): { q: V2; t: number; d: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < EPS ? 0 : clamp(dot(sub(p, a), ab) / l2, 0, 1);
  const q = add(a, mul(ab, t));
  return { q, t, d: dist(p, q) };
}

/** Proper or touching intersection of segments ab and cd. Returns params along each. */
export function segIntersect(a: V2, b: V2, c: V2, d: V2, eps = 1e-9): { t: number; u: number; p: V2 } | null {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < eps) return null;
  const ca = sub(c, a);
  const t = cross(ca, s) / den;
  const u = cross(ca, r) / den;
  const tol = 1e-7;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
  return { t: clamp(t, 0, 1), u: clamp(u, 0, 1), p: add(a, mul(r, clamp(t, 0, 1))) };
}

// ---------- Arcs by bulge ----------
// A segment a→b with bulge k bows to the LEFT of a→b by sagitta k·|ab|/2. k=±1 is a half circle.

export function arcInfo(a: V2, b: V2, k: number) {
  const c = sub(b, a);
  const L = len(c);
  const n = mul(perp(c), 1 / Math.max(L, EPS));
  const sg = (k * L) / 2;
  const mid = add(lerp2(a, b, 0.5), mul(n, sg));
  const r = (L * L / 4 + sg * sg) / (2 * Math.abs(sg) + EPS);
  const center = sub(mid, mul(n, Math.sign(sg) * r));
  const a0 = angleOf(sub(a, center));
  const sweep = -4 * Math.atan(k);
  return { center, r, a0, sweep, mid, length: Math.abs(sweep) * r };
}

/** Points along a→b (inclusive of a, exclusive of b) following the bulge. */
export function flattenSeg(a: V2, b: V2, k: number, maxLen = 0.3): V2[] {
  if (Math.abs(k) < 1e-4) return [a];
  const { center, r, a0, sweep } = arcInfo(a, b, k);
  const arcLen = Math.abs(sweep) * r;
  const n = Math.max(2, Math.ceil(arcLen / maxLen), Math.ceil(Math.abs(sweep) / (Math.PI / 20)));
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (sweep * i) / n;
    out.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)]);
  }
  return out;
}

export function segLength(a: V2, b: V2, k: number) {
  if (Math.abs(k) < 1e-4) return dist(a, b);
  return arcInfo(a, b, k).length;
}

/** Bulge for an arc through a, b with apex offset `sg` to the left. */
export const bulgeFromSagitta = (a: V2, b: V2, sg: number) => (2 * sg) / Math.max(dist(a, b), EPS);

// ---------- Polylines ----------
export interface PolyS {
  pts: V2[];
  s: number[]; // cumulative arclength at each point
  closed: boolean;
  L: number;
}

export function polyS(pts: V2[], closed: boolean): PolyS {
  const P = closed ? [...pts, pts[0]] : pts.slice();
  const s = [0];
  for (let i = 1; i < P.length; i++) s.push(s[i - 1] + dist(P[i - 1], P[i]));
  return { pts: P, s, closed, L: s[s.length - 1] };
}

export function pointAtS(ps: PolyS, sv: number): { p: V2; tan: V2; i: number } {
  const { pts, s } = ps;
  if (ps.closed) sv = ((sv % ps.L) + ps.L) % ps.L;
  else sv = clamp(sv, 0, ps.L);
  let lo = 0, hi = s.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (s[m] <= sv) lo = m;
    else hi = m;
  }
  const seg = s[hi] - s[lo];
  const t = seg < EPS ? 0 : (sv - s[lo]) / seg;
  return { p: lerp2(pts[lo], pts[hi], t), tan: norm(sub(pts[hi], pts[lo])), i: lo };
}

export function closestOnPoly(ps: PolyS, p: V2): { s: number; d: number; q: V2; tan: V2 } {
  let best = { s: 0, d: Infinity, q: ps.pts[0], tan: [1, 0] as V2 };
  for (let i = 0; i < ps.pts.length - 1; i++) {
    const c = closestOnSeg(p, ps.pts[i], ps.pts[i + 1]);
    if (c.d < best.d) best = { s: ps.s[i] + c.t * (ps.s[i + 1] - ps.s[i]), d: c.d, q: c.q, tan: norm(sub(ps.pts[i + 1], ps.pts[i])) };
  }
  return best;
}

export function polylineLength(pts: V2[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

/** Ramer–Douglas–Peucker; returns indices kept. */
export function rdpIdx(pts: V2[], tol: number): number[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let md = -1, mi = -1;
    for (let k = i + 1; k < j; k++) {
      const d = closestOnSeg(pts[k], pts[i], pts[j]).d;
      if (d > md) {
        md = d;
        mi = k;
      }
    }
    if (md > tol && mi > 0) {
      keep[mi] = 1;
      stack.push([i, mi], [mi, j]);
    }
  }
  const out: number[] = [];
  keep.forEach((k, i) => k && out.push(i));
  return out;
}

/** Algebraic (Kåsa) circle fit. */
export function fitCircle(pts: V2[]): { c: V2; r: number; rms: number } | null {
  const n = pts.length;
  if (n < 3) return null;
  let mx = 0, mz = 0;
  for (const p of pts) {
    mx += p[0];
    mz += p[1];
  }
  mx /= n;
  mz /= n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) {
    const u = p[0] - mx, w = p[1] - mz;
    suu += u * u;
    svv += w * w;
    suv += u * w;
    suuu += u * u * u;
    svvv += w * w * w;
    suvv += u * w * w;
    svuu += w * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + svuu);
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (b2 * suu - b1 * suv) / det;
  const c: V2 = [uc + mx, vc + mz];
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let e = 0;
  for (const p of pts) e += (dist(p, c) - r) ** 2;
  return { c, r, rms: Math.sqrt(e / n) };
}

export function resample(pts: V2[], step: number): V2[] {
  if (pts.length < 2) return pts.slice();
  const out: V2[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step) {
      const t = (step - acc) / d;
      const q = lerp2(a, b, t);
      out.push(q);
      a = q;
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.3) out.push(last);
  return out;
}

/** Inward/outward offset of a simple polygon with miter, bevelled at sharp corners. d>0 grows a CCW polygon. */
export function offsetPoly(poly: V2[], d: number, miterLimit = 2.2): { pts: V2[]; bevelled: number } {
  const ccw = polyArea(poly) > 0;
  const sgn = ccw ? -1 : 1; // left normal points inward for CCW
  const n = poly.length;
  const out: V2[] = [];
  let bevelled = 0;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n];
    const e0 = norm(sub(p1, p0)), e1 = norm(sub(p2, p1));
    const n0 = mul(perp(e0), sgn * d), n1 = mul(perp(e1), sgn * d);
    const bis = add(n0, n1);
    const bl = len(bis);
    if (bl < EPS) {
      out.push(add(p1, n0));
      continue;
    }
    const cosHalf = bl / (2 * Math.abs(d) + EPS);
    const m = Math.abs(d) / Math.max(cosHalf, EPS);
    const turn = cross(e0, e1) * (ccw ? 1 : -1);
    const outward = d > 0 ? turn > 0 : turn < 0;
    if (m / Math.abs(d) > miterLimit && outward) {
      out.push(add(p1, n0), add(p1, n1));
      bevelled++;
    } else {
      out.push(add(p1, mul(norm(bis), m)));
    }
  }
  return { pts: out, bevelled };
}

export function ensureCCW(poly: V2[]): V2[] {
  return polyArea(poly) < 0 ? poly.slice().reverse() : poly;
}

/** A point guaranteed to be strictly inside a polygon (with holes), preferring the centroid. */
export function interiorPoint(poly: V2[], holes: V2[][] = []): V2 {
  const c = polyCentroid(poly);
  if (pointInPolyHoles(c, poly, holes)) return c;
  const b = bbox(poly);
  // scan lines for the widest inside run
  let best: V2 = poly[0], bestW = -1;
  for (let k = 1; k < 12; k++) {
    const z = b.min[1] + ((b.max[1] - b.min[1]) * k) / 12;
    const xs: number[] = [];
    const rings = [poly, ...holes];
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const a = r[i], q = r[(i + 1) % r.length];
        if (a[1] > z !== q[1] > z) xs.push(a[0] + ((z - a[1]) * (q[0] - a[0])) / (q[1] - a[1]));
      }
    xs.sort((x, y) => x - y);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (w > bestW) {
        bestW = w;
        best = [(xs[i] + xs[i + 1]) / 2, z];
      }
    }
  }
  return best;
}

export function polyPerimeter(poly: V2[]) {
  let L = 0;
  for (let i = 0; i < poly.length; i++) L += dist(poly[i], poly[(i + 1) % poly.length]);
  return L;
}

/** Distance from p to the boundary of a closed polygon. */
export function distToPolyEdge(p: V2, poly: V2[]) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, closestOnSeg(p, poly[i], poly[(i + 1) % poly.length]).d);
  return d;
}

export function circlePoly(c: V2, r: number, n = 48): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]);
  }
  return out;
}

export function fmtM(x: number, digits = 1) {
  return `${x.toFixed(digits)} m`;
}

/** Heights in people: a person is ~1.7 m. */
export function inPeople(h: number): string {
  const p = h / 1.7;
  if (p < 0.8) return 'below head height';
  const q = Math.round(p * 2) / 2;
  const whole = Math.floor(q);
  const half = q - whole >= 0.5;
  const word = `${whole}${half ? '½' : ''}`;
  const approx = Math.abs(p - q) > 0.08 ? 'about ' : '';
  return `${approx}${word} ${q <= 1 ? 'person' : 'people'} tall`;
}
