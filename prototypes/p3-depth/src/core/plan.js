// Planar helpers. The plan is (x, y); world is (x, height, y), so plan y maps to world z.
// Everything here is pure and dependency-free.

export const EPS = 1e-9;

export function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
export function mul(a, k) { return [a[0] * k, a[1] * k]; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
export function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
export function len(a) { return Math.hypot(a[0], a[1]); }
export function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l]; }
export function perp(a) { return [-a[1], a[0]]; }
export function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
export function dist2(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
export function same(a, b, e = 1e-6) { return Math.abs(a[0] - b[0]) < e && Math.abs(a[1] - b[1]) < e; }

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Counter-clockwise copy (positive area). */
export function ccw(poly) { return signedArea(poly) < 0 ? poly.slice().reverse() : poly.slice(); }
export function cw(poly) { return signedArea(poly) > 0 ? poly.slice().reverse() : poly.slice(); }

export function centroid(poly) {
  if (!poly.length) return [0, 0];
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-12) {
    const s = poly.reduce((q, p) => add(q, p), [0, 0]);
    return mul(s, 1 / poly.length);
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * f;
    cy += (p[1] + q[1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function bbox(polys, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polys) for (const p of poly) {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] || EPS) + a[0]) inside = !inside;
  }
  return inside;
}

export function pointInRegion(p, outline, holes = []) {
  if (!pointInPoly(p, outline)) return false;
  for (const h of holes) if (pointInPoly(p, h)) return false;
  return true;
}

export function pointInTriangle(p, a, b, c) {
  const d1 = cross(sub(b, a), sub(p, a));
  const d2 = cross(sub(c, b), sub(p, b));
  const d3 = cross(sub(a, c), sub(p, c));
  const neg = d1 < -1e-12 || d2 < -1e-12 || d3 < -1e-12;
  const pos = d1 > 1e-12 || d2 > 1e-12 || d3 > 1e-12;
  return !(neg && pos);
}

export function polyArea(poly) { return Math.abs(signedArea(poly)); }

export function polyLength(poly, closed = false) {
  let s = 0;
  for (let i = 0; i < poly.length - (closed ? 0 : 1); i++) s += dist2(poly[i], poly[(i + 1) % poly.length]);
  return s;
}

/** Perimeter parametrization: point and inward/outward normal at a plan vertex. */
export function edgeFrame(poly, i) {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  const t = norm(sub(b, a));
  return { a, b, t, n: perp(t), length: dist2(a, b) };
}

/** Is the polygon vertex i reflex (interior angle > 180°)? Poly must be CCW. */
export function isReflex(poly, i) {
  const n = poly.length;
  const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
  return cross(sub(b, a), sub(c, b)) < -1e-9;
}

export function vertexAngle(poly, i) {
  const n = poly.length;
  const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
  const u = norm(sub(a, b)), v = norm(sub(c, b));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
}

// ------------------------------------------------------------------ clipping

/** Keep the part of a convex polygon with n·x <= c. Returns [] when empty. */
export function clipConvex(poly, n, c) {
  const out = [];
  const d = poly.map((p) => dot(n, p) - c);
  if (d.every((v) => v > -1e-12)) return poly.slice();
  if (d.every((v) => v < 1e-12)) return [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const di = d[i], dj = d[j];
    if (di <= 0) out.push(poly[i]);
    if ((di < 0 && dj > 0) || (di > 0 && dj < 0)) {
      const t = di / (di - dj);
      out.push(lerp2(poly[i], poly[j], t));
    }
  }
  return dedupe(out);
}

export function dedupe(poly, e = 1e-9) {
  const out = [];
  for (const p of poly) {
    if (!out.length || dist2(out[out.length - 1], p) > e) out.push(p);
  }
  while (out.length > 1 && dist2(out[0], out[out.length - 1]) <= e) out.pop();
  return out;
}

/** Split a convex polygon by a line n·x = c into [<= c, >= c]. */
export function splitConvex(poly, n, c) {
  const lo = clipConvex(poly, n, c);
  const hi = clipConvex(poly, mul(n, -1), -c);
  return [lo, hi];
}

export function lineLine(a1, a2, b1, b2) {
  const r = sub(a2, a1), s = sub(b2, b1);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(b1, a1), s) / den;
  return add(a1, mul(r, t));
}

// ------------------------------------------------------------------ triangulation

function visibleBridge(outer, hole) {
  // bridge the hole's right-most vertex to a visible outer vertex
  let hi = 0;
  for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[hi][0]) hi = i;
  const m = hole[hi];
  let best = -1, bestD = Infinity;
  for (let i = 0; i < outer.length; i++) {
    const p = outer[i];
    const d = (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2;
    if (d >= bestD) continue;
    const a = m, b = p;
    let blocked = false;
    const test = (poly) => {
      for (let k = 0; k < poly.length; k++) {
        const q = poly[k], r = poly[(k + 1) % poly.length];
        if (same(q, a) || same(q, b) || same(r, a) || same(r, b)) continue;
        const x = lineLine(a, b, q, r);
        if (!x) continue;
        const onAB = dot(sub(x, a), sub(b, a)) > 1e-7 && dot(sub(x, b), sub(a, b)) > 1e-7;
        const t = dot(sub(x, q), sub(r, q)) / (len(sub(r, q)) ** 2 || 1);
        if (onAB && t > 1e-7 && t < 1 - 1e-7) { blocked = true; return; }
      }
    };
    test(outer); test(hole);
    if (blocked) continue;
    // midpoint must be inside the outer ring and outside the hole
    if (!pointInPoly(lerp2(a, b, 0.5), outer)) continue;
    best = i; bestD = d;
  }
  return best;
}

/** Triangulate a polygon with holes. Returns triangles as point triples. */
export function triangulate(outline, holes = []) {
  let poly = ccw(outline);
  const hs = holes.map((h) => cw(h)).filter((h) => h.length >= 3);
  for (const h of hs) {
    const i = visibleBridge(poly, h);
    if (i < 0) continue;
    const hi = h.reduce((b, p, k) => (p[0] > h[b][0] ? k : b), 0);
    const loop = [h[hi]];
    for (let k = 1; k <= h.length; k++) loop.push(h[(hi + k) % h.length]);
    poly = [...poly.slice(0, i + 1), ...loop, poly[i], ...poly.slice(i + 1)];
  }
  return earClip(poly);
}

function earClip(poly) {
  const pts = poly.slice();
  const idx = pts.map((_, i) => i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 20 * pts.length * pts.length) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i - 1 + idx.length) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (cross(sub(b, a), sub(c, b)) <= 1e-10) continue;
      let ok = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const p = pts[j];
        if (same(p, a) || same(p, b) || same(p, c)) continue;
        if (pointInTriangle(p, a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([a, b, c]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]]);
  else if (idx.length > 3) {
    for (let i = 1; i < idx.length - 1; i++) tris.push([pts[idx[0]], pts[idx[i]], pts[idx[i + 1]]]);
  }
  return tris.filter((t) => Math.abs(signedArea(t)) > 1e-10);
}

/** Deterministic pseudo-random for fixtures. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
