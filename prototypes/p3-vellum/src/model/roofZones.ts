// Hold zones: what a pointer over a roof is pointing at, in metres. Pure; the caller converts pixels to metres and
// resolves ties against the visible projected surface. Phase 2 model only — nothing here edits the roof.
//
// Two rules keep a zone honest: a zone is only offered where that meaning exists (a shed's high edge is not a ridge,
// a butterfly's two high edges are not one central ridge), and a compound roof classifies in the frame of the wing
// that is actually visible at that point.
import { V2, dot, distToPolyEdge, polyArea, clamp, add, mul } from './geom2d';
import type { Overhead } from './types';
import { ohFrame, ohTopAt, ohU, hipH, profileH } from './overheadGeom';
import { profilePeak, sampleProfile } from './profileCurve';
import { roofWingsState, wingHeight, type Wing } from './wings';
import { P, intersection, type MPoly } from './clip';

export type RoofZone =
  | { kind: 'ridge'; wing: number }
  | { kind: 'ridgeEnd'; end: 'A' | 'B'; wing: number }
  | { kind: 'endFace'; end: 'A' | 'B'; wing: number }
  | { kind: 'slope'; side: 'L' | 'R'; wing: number; locked: boolean }
  | { kind: 'eave'; edge: number }
  | { kind: 'flatTop' }
  | { kind: 'apex' };

/** Metres; the caller derives them from pixels through `mpp` so a zone feels the same at any zoom. */
export interface ZoneTol {
  ridge: number;
  end: number;
  eave: number;
}

export const ZONE_TIPS: Record<RoofZone['kind'], string> = {
  ridge: 'Drag up or down: taller or flatter',
  apex: 'Drag up or down: taller or flatter',
  ridgeEnd: 'Drag along the ridge: hip both ends',
  endFace: 'Push in to hip both ends',
  slope: 'Push or pull: fuller or pointier',
  eave: 'Push or pull this edge',
  flatTop: 'Pull up to give it a peak',
};

export function zoneTip(oh: Overhead, z: RoofZone): string {
  if (z.kind === 'eave') return oh.fit ? 'Drag out for more overhang' : 'Push or pull this edge';
  if (z.kind === 'slope' && z.locked) return 'Double-click to edit this shape';
  return ZONE_TIPS[z.kind];
}

export function levelSection(oh: Overhead): boolean {
  const s = sampleProfile(oh.profile);
  const h0 = s[0]?.h ?? 0;
  return s.every((q) => Math.abs(q.h - h0) < 0.05);
}

/** A slope is editable in Hold only when its side of the section is one continuous run. */
function sideEditable(oh: Overhead, side: 'L' | 'R'): boolean {
  const f = ohFrame(oh);
  const pk = profilePeak(oh.profile);
  const from = side === 'L' ? 0 : pk.i1;
  const to = side === 'L' ? pk.i0 : oh.profile.length - 1;
  if (to <= from) return true;
  // a step anywhere on this side is a Shape job: Hold's sideways pull cannot keep it vertical
  for (let i = from + 1; i <= to; i++) if (Math.abs(oh.profile[i].u - oh.profile[i - 1].u) < 1e-6) return false;
  void f;
  const samples = sampleProfile(oh.profile).filter((s) => isOnSide(pk, s.u, side, oh.profile));
  let sign = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].h - samples[i - 1].h;
    if (Math.abs(d) < 1e-9) continue;
    const k = d > 0 ? 1 : -1;
    if (sign && k !== sign) return false;
    sign = k;
  }
  return true;
}

const isOnSide = (pk: { i0: number; i1: number }, u: number, side: 'L' | 'R', prof?: { u: number }[]) =>
  side === 'L' ? u <= (prof?.[pk.i0]?.u ?? 0.5) + 1e-9 : u >= (prof?.[pk.i1]?.u ?? 0.5) - 1e-9;

function peakOf(oh: Overhead) {
  const pk = profilePeak(oh.profile);
  const n = oh.profile.length;
  return { ...pk, interiorRidge: pk.i0 > 0 && pk.i1 < n - 1, atEnd: pk.i0 === 0 || pk.i1 === n - 1 };
}

export function roofZoneAt(oh: Overhead, q: V2, tol: ZoneTol): RoofZone | null {
  const f = ohFrame(oh);
  const st = roofWingsState(oh);
  if (st.kind === 'compound') return compoundZone(oh, q, tol, st);
  if (oh.form === 'revolve') {
    if (levelSection(oh)) return distToPolyEdge(q, oh.outline) < tol.eave ? { kind: 'eave', edge: nearestEdge(oh, q) } : { kind: 'flatTop' };
    if (Math.hypot(q[0] - f.center[0], q[1] - f.center[1]) < tol.end) return { kind: 'apex' };
    if (distToPolyEdge(q, oh.outline) < tol.eave) return { kind: 'eave', edge: nearestEdge(oh, q) };
    return { kind: 'slope', side: 'L', wing: 0, locked: !sideEditable(oh, 'L') };
  }
  const d = f.d;
  const ea: V2 = [-d[1], d[0]];
  const pk = peakOf(oh);
  const w = dot(q, d);
  const v = dot(q, ea);
  const wr = f.wmin + pk.u * (f.wmax - f.wmin);
  const vA = f.emin + f.hip;
  const vB = f.emax - f.hip;
  const canEnd = oh.form === 'extrude' && pk.interiorRidge;

  if (levelSection(oh)) return distToPolyEdge(q, oh.outline) < tol.eave ? { kind: 'eave', edge: nearestEdge(oh, q) } : { kind: 'flatTop' };
  if (canEnd && f.hip > 0) {
    if (Math.hypot(w - wr, v - vA) < tol.end) return { kind: 'ridgeEnd', end: 'A', wing: 0 };
    if (Math.hypot(w - wr, v - vB) < tol.end) return { kind: 'ridgeEnd', end: 'B', wing: 0 };
  }
  if (pk.interiorRidge) {
    const lo = pk.i0 < pk.i1 ? f.wmin + oh.profile[pk.i0].u * (f.wmax - f.wmin) : wr;
    const hi = pk.i0 < pk.i1 ? f.wmin + oh.profile[pk.i1].u * (f.wmax - f.wmin) : wr;
    for (const end of ['A', 'B'] as const) {
      const vv = end === 'A' ? vA : vB;
      if (Math.hypot(w - (end === 'A' ? lo : hi), v - vv) < tol.end) return { kind: 'ridgeEnd', end, wing: 0 };
    }
    if (w > lo - tol.ridge && w < hi + tol.ridge && v > vA - tol.ridge && v < vB + tol.ridge) return { kind: 'ridge', wing: 0 };
  }
  if (distToPolyEdge(q, oh.outline) < tol.eave) return { kind: 'eave', edge: nearestEdge(oh, q) };
  if (f.hip > 0 && hipH(f, v) < profileH(f.samples, ohU(oh, q)) - 1e-6)
    return { kind: 'endFace', end: v < (f.emin + f.emax) / 2 ? 'A' : 'B', wing: 0 };
  const side: 'L' | 'R' = w < wr ? 'L' : 'R';
  return { kind: 'slope', side, wing: 0, locked: !sideEditable(oh, side) };
}

interface WingGeom {
  wing: Wing;
  s0: number;
  s1: number;
  r0: number;
  r1: number;
  sPk: number;
  scale: number;
}

function wingGeom(w: Wing, peakU: number): WingGeom {
  const spanW = w.span === 'w';
  const s0 = spanW ? w.rect[0] : w.rect[2];
  const s1 = spanW ? w.rect[1] : w.rect[3];
  const r0 = spanW ? w.rect[2] : w.rect[0];
  const r1 = spanW ? w.rect[3] : w.rect[1];
  return { wing: w, s0, s1, r0, r1, sPk: s0 + peakU * (s1 - s0), scale: w.scale };
}

const covers = (r: number[], w: number, v: number) => w >= r[0] - 1e-9 && w <= r[1] + 1e-9 && v >= r[2] - 1e-9 && v <= r[3] + 1e-9;

function compoundZone(oh: Overhead, q: V2, tol: ZoneTol, st: { wings: Wing[]; peakU: number }): RoofZone | null {
  const f = ohFrame(oh);
  const d = f.d;
  const ea: V2 = [-d[1], d[0]];
  const w = dot(q, d);
  const v = dot(q, ea);
  const samples = sampleProfile(oh.profile);
  // keep the wing's own index: the visible wing is the highest one covering this point, and its index names it
  const visible = st.wings
    .map((wg, i) => ({ wg, i, h: covers(wg.rect, w, v) ? wingHeight(wg, samples, st.peakU, { d, e: ea }, q) : -Infinity }))
    .filter((o) => Number.isFinite(o.h))
    .sort((a, b) => b.h - a.h || a.i - b.i)[0];
  const at = visible ? wingGeom(visible.wg, st.peakU) : null;
  if (!visible || !at) {
    if (distToPolyEdge(q, oh.outline) < tol.eave) return { kind: 'eave', edge: nearestEdge(oh, q) };
    return { kind: 'flatTop' };
  }
  const s = visible.wg.span === 'w' ? w : v;
  const r = visible.wg.span === 'w' ? v : w;
  const local = (m: number) => m / Math.max(at.scale, 1e-6);
  const pk = peakOf(oh);
  const index = visible.i;

  if (levelSection(oh)) return distToPolyEdge(q, oh.outline) < tol.eave ? { kind: 'eave', edge: nearestEdge(oh, q) } : { kind: 'flatTop' };
  if (pk.interiorRidge) {
    const lo = at.r0 + visible.wg.hipLo;
    const hi = at.r1 - visible.wg.hipHi;
    if (visible.wg.ends.lo === 'exposed' && Math.hypot(s - at.sPk, r - lo) < tol.end) return { kind: 'ridgeEnd', end: 'A', wing: index };
    if (visible.wg.ends.hi === 'exposed' && Math.hypot(s - at.sPk, r - hi) < tol.end) return { kind: 'ridgeEnd', end: 'B', wing: index };
    if (Math.abs(s - at.sPk) < local(tol.ridge) && r > lo - tol.ridge && r < hi + tol.ridge) return { kind: 'ridge', wing: index };
  }
  if (distToPolyEdge(q, oh.outline) < tol.eave) return { kind: 'eave', edge: nearestEdge(oh, q) };
  if (visible.wg.hipLo > 1e-6 && r < at.r0 + visible.wg.hipLo) return { kind: 'endFace', end: 'A', wing: index };
  if (visible.wg.hipHi > 1e-6 && r > at.r1 - visible.wg.hipHi) return { kind: 'endFace', end: 'B', wing: index };
  const side: 'L' | 'R' = s < at.sPk ? 'L' : 'R';
  return { kind: 'slope', side, wing: index, locked: !sideEditable(oh, side) };
}

function nearestEdge(oh: Overhead, q: V2): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < oh.outline.length; i++) {
    const a = oh.outline[i], b = oh.outline[(i + 1) % oh.outline.length];
    const d = segDist(q, a, b);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const segDist = (p: V2, a: V2, b: V2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / Math.max(dx * dx + dz * dz, 1e-9), 0, 1);
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
};

export interface ZoneGeometry {
  /** polylines in world x,z with y already lifted above the roof surface */
  lines: [number, number, number][][];
  ring?: [number, number, number];
}

export function zoneGeometry(oh: Overhead, z: RoofZone): ZoneGeometry {
  const f = ohFrame(oh);
  const d = f.d;
  const ea: V2 = [-d[1], d[0]];
  const lift = 0.03;
  const y = (q: V2) => ohTopAt(oh, q) + lift;
  const st = roofWingsState(oh);
  const pk = peakOf(oh);
  const wr = f.wmin + pk.u * (f.wmax - f.wmin);
  const vA = f.emin + f.hip;
  const vB = f.emax - f.hip;
  const at = (wv: number, vv: number): V2 => add(mul(d, wv), mul(ea, vv));
  const line = (pts: V2[]): [number, number, number][] => pts.map((q) => [q[0], y(q), q[1]] as [number, number, number]);

  if (z.kind === 'eave') {
    const a = oh.outline[z.edge], b = oh.outline[(z.edge + 1) % oh.outline.length];
    return { lines: [line(draped(a, b, oh))] };
  }
  if (z.kind === 'flatTop') return { lines: [line([...oh.outline, oh.outline[0]])] };
  if (z.kind === 'apex') return { lines: [], ring: [f.center[0], y(f.center), f.center[1]] };

  if (st.kind === 'compound') {
    const wg = st.wings[Math.min(z.wing, st.wings.length - 1)];
    const at2 = wingGeom(wg, st.peakU);
    const lo = at2.r0 + wg.hipLo;
    const hi = at2.r1 - wg.hipHi;
    const ridge = (a: number, b: number) => (wg.span === 'w' ? [at(at2.sPk, a), at(at2.sPk, b)] : [at(a, at2.sPk), at(b, at2.sPk)]);
    const box = wingRect(wg, at);
    if (z.kind === 'ridge') return { lines: [line(ridge(lo, hi))] };
    if (z.kind === 'ridgeEnd') {
      const r = z.end === 'A' ? lo : hi;
      const p = wg.span === 'w' ? at(at2.sPk, r) : at(r, at2.sPk);
      return { lines: [line(ridge(lo, hi))], ring: [p[0], y(p), p[1]] };
    }
    if (z.kind === 'slope') {
      const axis = wg.span === 'w' ? 'w' : 'v';
      return { lines: boundaries(halfPlane(oh, axis, z.side === 'L' ? 'less' : 'more', at2.sPk), oh, box) };
    }
    if (z.kind === 'endFace') {
      const r = z.end === 'A' ? at2.r0 + wg.hipLo : at2.r1 - wg.hipHi;
      const axis = wg.span === 'w' ? 'v' : 'w';
      return { lines: boundaries(halfPlane(oh, axis, z.end === 'A' ? 'less' : 'more', r), oh, box) };
    }
  }

  if (z.kind === 'ridge') return { lines: [line([at(wr, vA), at(wr, vB)])] };
  if (z.kind === 'ridgeEnd') {
    const v = z.end === 'A' ? vA : vB;
    const p = at(wr, v);
    return { lines: [line([at(wr, vA), at(wr, vB)])], ring: [p[0], y(p), p[1]] };
  }
  if (z.kind === 'slope') {
    const region = halfPlane(oh, 'w', z.side === 'L' ? 'less' : 'more', wr);
    return { lines: boundaries(region, oh) };
  }
  if (z.kind === 'endFace') {
    const v = z.end === 'A' ? vA : vB;
    const region = halfPlane(oh, 'v', z.end === 'A' ? 'less' : 'more', v);
    return { lines: boundaries(region, oh) };
  }
  return { lines: [] };
}

function halfPlane(oh: Overhead, axis: 'w' | 'v', side: 'less' | 'more', at: number): MPoly {
  const f = ohFrame(oh);
  const d = f.d;
  const ea: V2 = [-d[1], d[0]];
  const big = Math.max(f.wmax - f.wmin, f.emax - f.emin) * 4 + 20;
  const pts: V2[] = [];
  const push = (wv: number, vv: number) => pts.push(add(mul(d, wv), mul(ea, vv)));
  if (axis === 'w') {
    if (side === 'less') { push(at - big, -big); push(at, -big); push(at, big); push(at - big, big); }
    else { push(at, -big); push(at + big, -big); push(at + big, big); push(at, big); }
  } else {
    if (side === 'less') { push(-big, at - big); push(big, at - big); push(big, at); push(-big, at); }
    else { push(-big, at); push(big, at); push(big, at + big); push(-big, at + big); }
  }
  return P(pts);
}

function wingRect(wg: Wing, at: (w: number, v: number) => V2): V2[] {
  const [w0, w1, v0, v1] = wg.rect;
  return [at(w0, v0), at(w1, v0), at(w1, v1), at(w0, v1)];
}

function boundaries(region: MPoly, oh: Overhead, clip?: V2[]): [number, number, number][][] {
  const cut = intersection(clip ? intersection(P(oh.outline), P(clip)) : P(oh.outline), region);
  const out: [number, number, number][][] = [];
  for (const poly of cut) {
    const ring = poly[0];
    if (!ring || ring.length < 3 || Math.abs(polyArea(ring)) < 1e-4) continue;
    const pts = [...ring, ring[0]];
    const dense: V2[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
      for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    dense.push(ring[0]);
    out.push(dense.map((q) => [q[0], ohTopAt(oh, q) + 0.03, q[1]] as [number, number, number]));
  }
  return out;
}

function draped(a: V2, b: V2, oh: Overhead): V2[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return out;
}
