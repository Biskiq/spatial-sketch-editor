// Reading a freehand stroke into architecture-shaped lines and arcs.
import {
  V2, dist, sub, add, mul, norm, cross, dot, angleOf, fromAngle, resample, rdpIdx, fitCircle, closestOnSeg,
  polylineLength, perp, lerp2, bbox, clamp, round, polyArea, polyCentroid,
} from './geom2d';

export interface StrokeFit {
  kind: 'open' | 'closed' | 'circle' | 'tap';
  pts: V2[];
  bulge: number[];
  closed: boolean;
  center: V2;
  radius: number;
  length: number;
  curved: boolean;
  corners: number;
}

export interface FitOpts {
  mpp: number; // metres per screen pixel (zoom-aware tolerances)
  dirs?: number[]; // existing wall directions to align with
  tidy?: boolean;
  forceOpen?: boolean;
  allowCircle?: boolean;
  /** The stroke as drawn on screen (px). A circle drawn in perspective is an ellipse on the ground; we read the intent on screen. */
  screen?: V2[];
}

/** Is this screen-space loop a circle as the hand meant it? */
function roundOnScreen(scr: V2[]): boolean {
  const pts = clean(scr);
  const L = polylineLength(pts);
  if (pts.length < 8 || L < 120) return false;
  const P = resample(pts, L / 90);
  const c = fitCircle(P);
  if (!c || c.r < 20 || c.rms / c.r > 0.09) return false;
  const gap = dist(P[0], P[P.length - 1]);
  if (gap > 0.6 * c.r) return false;
  let maxTurn = 0;
  for (let i = 4; i < P.length - 4; i++) maxTurn = Math.max(maxTurn, Math.abs(turnAt(P, i, 4, false)));
  return maxTurn < 0.95;
}

function clean(raw: V2[]): V2[] {
  const out: V2[] = [];
  for (const p of raw) if (!out.length || dist(out[out.length - 1], p) > 1e-3) out.push(p);
  return out;
}

function turnAt(P: V2[], i: number, w: number, closed: boolean): number {
  const n = P.length;
  const get = (k: number) => (closed ? P[((k % n) + n) % n] : P[clamp(k, 0, n - 1)]);
  const a = get(i - w), b = P[i], c = get(i + w);
  const d0 = norm(sub(b, a)), d1 = norm(sub(c, b));
  return Math.atan2(cross(d0, d1), dot(d0, d1));
}

interface SpanFit { a: V2; b: V2; bulge: number }

function fitSpan(P: V2[], i: number, j: number, tolS: number, tolA: number, depth: number, out: SpanFit[]) {
  const a = P[i], b = P[j];
  const L = dist(a, b);
  let md = 0, mi = i;
  for (let k = i + 1; k < j; k++) {
    const d = closestOnSeg(P[k], a, b).d;
    if (d > md) {
      md = d;
      mi = k;
    }
  }
  const tS = Math.max(tolS, 0.025 * L);
  if (md < tS || j - i < 3) {
    out.push({ a, b, bulge: 0 });
    return;
  }
  const span = P.slice(i, j + 1);
  const c = fitCircle(span);
  const tA = Math.max(tolA, 0.022 * L);
  if (c && c.rms < tA && L > 0.2) {
    const mid = P[(i + j) >> 1];
    const s = Math.sign(cross(sub(b, a), sub(mid, a))) || 1;
    const h = Math.sqrt(Math.max(0, c.r * c.r - (L * L) / 4));
    const cs = Math.sign(cross(sub(b, a), sub(c.c, a)));
    const sg = cs === s ? c.r + h : c.r - h;
    const bulge = clamp((s * sg) / (L / 2), -2.5, 2.5);
    // reject arcs that sweep too far (likely a corner the detector missed)
    if (Math.abs(bulge) < 2.4) {
      out.push({ a, b, bulge });
      return;
    }
  }
  if (depth > 0 && mi > i && mi < j) {
    fitSpan(P, i, mi, tolS, tolA, depth - 1, out);
    fitSpan(P, mi, j, tolS, tolA, depth - 1, out);
    return;
  }
  // fall back to straight pieces
  const idx = rdpIdx(span, tS).map((k) => k + i);
  for (let k = 0; k + 1 < idx.length; k++) out.push({ a: P[idx[k]], b: P[idx[k + 1]], bulge: 0 });
}

function lineX(p: V2, d: V2, q: V2, e: V2): V2 | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-6) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

function snapAngle(a: number, dirs: number[], tol: number): number | null {
  let best: number | null = null, bd = tol;
  for (const d of dirs) {
    for (let k = -2; k <= 2; k++) {
      const c = d + (k * Math.PI) / 2;
      let diff = Math.abs(((a - c + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (diff < bd) {
        bd = diff;
        best = c;
      }
    }
  }
  return best;
}

export function fitStroke(raw0: V2[], opts: FitOpts): StrokeFit {
  const raw = clean(raw0);
  const L = polylineLength(raw);
  const empty: StrokeFit = { kind: 'tap', pts: raw.slice(0, 1), bulge: [], closed: false, center: raw[0] ?? [0, 0], radius: 0, length: L, curved: false, corners: 0 };
  if (raw.length < 2 || L < 0.25) return empty;
  const tidy = opts.tidy !== false;
  const mpp = opts.mpp;
  const ds = clamp(L / 90, 0.04, 0.2);
  let P = resample(raw, ds);
  const gap = dist(P[0], P[P.length - 1]);
  const bb = bbox(P);
  const diag = dist(bb.min, bb.max);
  const closed = !opts.forceOpen && L > 2.2 && diag > 0.9 && gap < Math.max(0.5, 0.16 * L, 14 * mpp);
  if (closed) {
    if (gap > 1e-6) P = P.concat(resample([P[P.length - 1], P[0]], ds).slice(1, -1));
  }
  const w = Math.max(2, Math.round(0.35 / ds));
  // circle?
  if (closed && opts.allowCircle !== false) {
    const c = fitCircle(P);
    if (c && c.r > 0.5) {
      let maxTurn = 0;
      for (let i = 0; i < P.length; i += 2) maxTurn = Math.max(maxTurn, Math.abs(turnAt(P, i, w, true)));
      if (c.rms / c.r < (tidy ? 0.1 : 0.06) && maxTurn < 0.75) {
        const r = tidy ? Math.max(0.5, round(c.r, 0.05)) : c.r;
        return { kind: 'circle', pts: [], bulge: [], closed: true, center: c.c, radius: r, length: 2 * Math.PI * r, curved: true, corners: 0 };
      }
    }
    if (tidy && opts.screen && roundOnScreen(opts.screen)) {
      const r0 = Math.sqrt(Math.abs(polyArea(P)) / Math.PI);
      const r = Math.max(0.5, round(r0, 0.05));
      return { kind: 'circle', pts: [], bulge: [], closed: true, center: polyCentroid(P), radius: r, length: 2 * Math.PI * r, curved: true, corners: 0 };
    }
  }
  // corners
  const n = P.length;
  const isCorner: boolean[] = new Array(n).fill(false);
  const cornerTol = (38 * Math.PI) / 180;
  const turns = P.map((_, i) => (closed || (i >= w && i < n - w) ? turnAt(P, i, w, closed) : 0));
  // non-maximum suppression over a window
  for (let i = 0; i < n; i++) {
    const t = Math.abs(turns[i]);
    if (t < cornerTol) continue;
    let isMax = true;
    for (let k = -w; k <= w && isMax; k++) {
      if (k === 0) continue;
      const j = closed ? (i + k + n) % n : i + k;
      if (j < 0 || j >= n) continue;
      if (Math.abs(turns[j]) > t || (Math.abs(turns[j]) === t && j < i)) isMax = false;
    }
    if (isMax) isCorner[i] = true;
  }
  let corners = isCorner.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const tolS = Math.max(0.06, 4 * mpp);
  const tolA = Math.max(0.045, 3 * mpp);
  const spans: SpanFit[] = [];
  if (closed) {
    let Q = P;
    if (corners.length === 0) {
      // smooth blob: split into four smooth pieces
      const k = Math.floor(n / 4);
      corners = [0, k, 2 * k, 3 * k];
    } else {
      // rotate so the stroke starts at a corner
      const s0 = corners[0];
      Q = P.slice(s0).concat(P.slice(0, s0));
      corners = corners.map((c) => (c - s0 + n) % n).sort((a, b) => a - b);
    }
    const Qc = Q.concat([Q[0]]);
    const ks = [...corners, n];
    for (let i = 0; i + 1 < ks.length; i++) fitSpan(Qc, ks[i], ks[i + 1], tolS, tolA, 3, spans);
  } else {
    const ks = [0, ...corners.filter((c) => c > 1 && c < n - 2), n - 1];
    for (let i = 0; i + 1 < ks.length; i++) fitSpan(P, ks[i], ks[i + 1], tolS, tolA, 3, spans);
  }
  let pts: V2[] = spans.map((s) => s.a);
  if (!closed) pts.push(spans[spans.length - 1].b);
  let bulge = spans.map((s) => s.bulge);
  // merge nearly-collinear straight neighbours
  for (let i = bulge.length - 1; i > 0; i--) {
    if (bulge[i] !== 0 || bulge[i - 1] !== 0) continue;
    const a = pts[i - 1], b = pts[i], c = pts[(i + 1) % pts.length];
    const turn = Math.abs(Math.atan2(cross(sub(b, a), sub(c, b)), dot(sub(b, a), sub(c, b))));
    if (turn < (9 * Math.PI) / 180) {
      pts.splice(i, 1);
      bulge.splice(i, 1);
    }
  }
  if (tidy) ({ pts, bulge } = tidyUp(pts, bulge, closed, opts.dirs ?? []));
  const curved = bulge.some((b) => Math.abs(b) > 0.02);
  return { kind: closed ? 'closed' : 'open', pts, bulge, closed, center: [0, 0], radius: 0, length: L, curved, corners: corners.length };
}

/** Align straight sides to the room you are building in, and rebuild corners as line intersections. */
function tidyUp(pts: V2[], bulge: number[], closed: boolean, dirs0: number[]) {
  const nseg = bulge.length;
  const N = pts.length;
  const segA = (i: number) => pts[i], segB = (i: number) => pts[(i + 1) % N];
  // dominant straight direction joins the candidate set, so a skewed sketch squares up with itself
  let dom: number | null = null, domL = 0;
  for (let i = 0; i < nseg; i++) {
    if (bulge[i] !== 0) continue;
    const l = dist(segA(i), segB(i));
    if (l > domL) {
      domL = l;
      dom = angleOf(sub(segB(i), segA(i)));
    }
  }
  const dirs = [0, ...dirs0];
  const domSnap = dom !== null ? snapAngle(dom, dirs, (8 * Math.PI) / 180) : null;
  const ref = domSnap ?? dom;
  const cand = ref !== null ? [ref, ...dirs] : dirs;
  const lines: ({ p: V2; d: V2 } | null)[] = [];
  for (let i = 0; i < nseg; i++) {
    if (bulge[i] !== 0) {
      lines.push(null);
      continue;
    }
    const a = segA(i), b = segB(i);
    const ang = angleOf(sub(b, a));
    const sn = snapAngle(ang, cand, (9 * Math.PI) / 180);
    const d = sn !== null ? fromAngle(sn) : norm(sub(b, a));
    lines.push({ p: lerp2(a, b, 0.5), d });
  }
  const out = pts.slice();
  for (let k = 0; k < N; k++) {
    const prev = closed ? (k - 1 + nseg) % nseg : k - 1; // segment ending at node k
    const next = k < nseg ? k : -1; // segment starting at node k
    const lp = prev >= 0 ? lines[prev] : null;
    const ln = next >= 0 ? lines[next] : null;
    if (lp && ln) {
      const ang = Math.abs(cross(lp.d, ln.d));
      if (ang > Math.sin((12 * Math.PI) / 180)) {
        const x = lineX(lp.p, lp.d, ln.p, ln.d);
        if (x && dist(x, pts[k]) < 1.5) {
          out[k] = x;
          continue;
        }
      }
    }
    const l = lp ?? ln;
    if (l) {
      const t = dot(sub(pts[k], l.p), l.d);
      out[k] = add(l.p, mul(l.d, t));
    }
  }
  // arcs keep their apex: recompute bulge so sagitta stays the same after nodes moved
  const nb = bulge.map((b, i) => {
    if (b === 0) return 0;
    const a0 = pts[i], b0 = pts[(i + 1) % N];
    const sg = (b * dist(a0, b0)) / 2;
    const a1 = out[i], b1 = out[(i + 1) % N];
    return (2 * sg) / Math.max(dist(a1, b1), 1e-6);
  });
  return { pts: out, bulge: nb };
}

/** Shape of an opening drawn on a wall face, in (s, y) wall coordinates. */
export function readOpeningStroke(sy: V2[]): { s: number; width: number; sill: number; top: number; shape: 'rect' | 'arch' | 'round' | 'pointed'; rise: number } | null {
  const P = clean(sy);
  if (P.length < 4) return null;
  const b = bbox(P);
  const width = b.max[0] - b.min[0];
  const hgt = b.max[1] - b.min[1];
  if (width < 0.25 || hgt < 0.25) return null;
  const s = (b.min[0] + b.max[0]) / 2;
  const L = polylineLength(P);
  const closedish = dist(P[0], P[P.length - 1]) < Math.max(0.3, 0.2 * L);
  const c = fitCircle(P);
  if (closedish && c && c.rms / c.r < 0.12 && Math.abs(width - hgt) < 0.3 * Math.max(width, hgt)) {
    const d = (width + hgt) / 2;
    return { s, width: d, sill: c.c[1] - d / 2, top: c.c[1] + d / 2, shape: 'round', rise: d / 2 };
  }
  // look at the head: points in the top 40%
  const yTop = b.max[1];
  const head = P.filter((p) => p[1] > yTop - hgt * 0.45);
  const atEdge = (x: number) => {
    const near = head.filter((p) => Math.abs(p[0] - x) < width * 0.12);
    return near.length ? Math.min(...near.map((p) => p[1])) : yTop;
  };
  const shoulders = (atEdge(b.min[0]) + atEdge(b.max[0])) / 2;
  const drop = yTop - shoulders;
  let shape: 'rect' | 'arch' | 'pointed' = 'rect';
  let rise = 0;
  if (drop > Math.max(0.15, width * 0.18)) {
    // pointed if the apex is sharp
    const apexI = P.reduce((bi, p, i) => (p[1] > P[bi][1] ? i : bi), 0);
    const w = Math.max(2, Math.floor(P.length / 20));
    const a = P[Math.max(0, apexI - w)], q = P[Math.min(P.length - 1, apexI + w)];
    const turn = Math.abs(Math.atan2(cross(sub(P[apexI], a), sub(q, P[apexI])), dot(sub(P[apexI], a), sub(q, P[apexI]))));
    shape = turn > 1.0 ? 'pointed' : 'arch';
    rise = clamp(drop, 0.1, width);
  }
  return { s, width, sill: b.min[1], top: yTop, shape, rise };
}

/** Fit a drawn roof profile (u 0..1, h metres) into crease/smooth points. */
export function fitProfile(raw: V2[], spanM: number): { u: number; h: number; crease: boolean }[] {
  const P0 = clean(raw).map((p) => [clamp(p[0], 0, 1), Math.max(0, p[1])] as V2);
  if (P0.length < 2) return [{ u: 0, h: 0, crease: true }, { u: 1, h: 0, crease: true }];
  // work in metres for tolerances
  const M = P0.map((p) => [p[0] * spanM, p[1]] as V2);
  const P = resample(M, Math.max(0.05, spanM / 120));
  const idx = rdpIdx(P, Math.max(0.06, spanM * 0.012));
  const out: { u: number; h: number; crease: boolean }[] = [];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    let crease = true;
    if (k > 0 && k < idx.length - 1) {
      const a = P[idx[k - 1]], b = P[i], c = P[idx[k + 1]];
      const turn = Math.abs(Math.atan2(cross(sub(b, a), sub(c, b)), dot(sub(b, a), sub(c, b))));
      crease = turn > 0.6;
      // many small turns in a row read as a curve
      const segLen = Math.min(dist(a, b), dist(b, c));
      if (segLen < spanM * 0.12 && turn < 0.9) crease = false;
    }
    out.push({ u: clamp(P[i][0] / spanM, 0, 1), h: round(Math.max(0, P[i][1]), 0.05), crease });
  }
  // vertical steps: snap near-vertical moves into a true step
  for (let k = 1; k < out.length; k++) {
    const du = Math.abs(out[k].u - out[k - 1].u) * spanM;
    const dh = Math.abs(out[k].h - out[k - 1].h);
    if (dh > 0.3 && (du < 0.25 || (du < spanM * 0.05 && dh / Math.max(du, 1e-6) > 2.5))) {
      out[k].u = out[k - 1].u;
      out[k].crease = out[k - 1].crease = true;
    }
  }
  // monotone in u, spanning the full width
  for (let k = 1; k < out.length; k++) if (out[k].u < out[k - 1].u) out[k].u = out[k - 1].u;
  out[0].u = 0;
  out[out.length - 1].u = 1;
  // a hand that starts or ends just above the eave meant the eave
  for (const q of [out[0], out[out.length - 1]]) if (q.h < 0.35) q.h = 0;
  return out;
}
