// Walls are meshed "unrolled": the elevation of the wall in (s = along, y = up), with its openings as holes,
// is cut into strips at every bend and wrapped back onto the centreline — so curved walls and arched openings
// come out of the same code.
import { Geo, V3 } from './geo';
import type { DWall, DOpening } from '../../model/derive';
import { runGeom } from '../../model/runs';
import { V2, add, sub, mul, norm, perp, dot, pointAtS } from '../../model/geom2d';
import { difference, P } from '../../model/clip';
import * as THREE from 'three';

interface Station {
  s: number;
  p: V2;
  n: V2; // miter offset direction (scaled so faces stay parallel)
  t: V2;
}

export function holeOutline(d: DOpening): V2[] {
  const o = d.o;
  const s0 = d.s0, s1 = d.s1, sc = d.s, y0 = d.y0, y1 = d.y1, w = o.width;
  const out: V2[] = [];
  if (o.shape === 'round') {
    const r = w / 2, cy = y0 + r;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      out.push([sc + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  }
  out.push([s0, y0], [s1, y0]);
  if (o.shape === 'rect' || o.rise < 0.02) {
    out.push([s1, y1], [s0, y1]);
    return out;
  }
  const rise = Math.min(o.rise, y1 - y0 - 0.05);
  const spring = y1 - rise;
  out.push([s1, spring]);
  if (o.shape === 'arch') {
    const N = 20;
    for (let i = 1; i < N; i++) {
      const a = (i / N) * Math.PI;
      out.push([sc + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)]);
    }
  } else {
    // pointed: two arcs struck from the opposite springing points
    const N = 10;
    const k = rise / (0.866 * w);
    for (let i = 1; i <= N; i++) {
      const a = ((i / N) * Math.PI) / 3;
      out.push([s0 + w * Math.cos(a), spring + w * Math.sin(a) * k]);
    }
    for (let i = N - 1; i >= 1; i--) {
      const a = ((i / N) * Math.PI) / 3;
      out.push([s1 - w * Math.cos(a), spring + w * Math.sin(a) * k]);
    }
  }
  out.push([s0, spring]);
  return out;
}

export function buildWall(w: DWall): { solid: Geo; glass: Geo; frames: Geo } {
  const r = w.run;
  const g = runGeom(r);
  const ps = g.ps;
  const L = g.L;
  const half = r.thick / 2;
  const closed = r.shape === 'circle' || r.closed;
  const solid = new Geo(), glass = new Geo(), frames = new Geo();
  if (L < 0.05) return { solid, glass, frames };

  // ---- seam for closed walls: put it in the widest gap between openings
  let sOff = 0;
  if (closed && w.openings.length) {
    const os = w.openings.map((o) => [((o.s0 % L) + L) % L, ((o.s1 % L) + L) % L]).sort((a, b) => a[0] - b[0]);
    let bestGap = -1;
    for (let i = 0; i < os.length; i++) {
      const end = os[i][1];
      const nextStart = i + 1 < os.length ? os[i + 1][0] : os[0][0] + L;
      const gap = nextStart - end;
      if (gap > bestGap) {
        bestGap = gap;
        sOff = end + gap / 2;
      }
    }
  }
  const wrap = (s: number) => (closed ? ((s % L) + L) % L : s);

  // ---- stations along the centreline (with miter normals)
  const segN = (i: number) => perp(norm(sub(ps.pts[i + 1], ps.pts[i])));
  const nseg = ps.pts.length - 1;
  const stations: Station[] = [];
  const miter = (i: number): { n: V2 } => {
    // vertex i of the flattened polyline: offset along the bisector, lengthened so both faces stay parallel
    let a: V2, b: V2;
    if (closed) {
      a = segN((i - 1 + nseg) % nseg);
      b = segN(i % nseg);
    } else {
      a = segN(Math.max(0, i - 1));
      b = segN(Math.min(nseg - 1, i));
    }
    const m = norm(add(a, b));
    const c = Math.max(0.35, dot(m, b));
    return { n: mul(m, 1 / c) };
  };
  const stationAt = (sRaw: number): Station => {
    const s = wrap(sRaw);
    const q = pointAtS(ps, s);
    const i = q.i;
    const s0 = ps.s[i], s1 = ps.s[i + 1];
    const t = (s - s0) / Math.max(s1 - s0, 1e-9);
    const m0 = miter(i).n, m1 = miter(i + 1).n;
    return { s: sRaw, p: q.p, n: [m0[0] + (m1[0] - m0[0]) * t, m0[1] + (m1[1] - m0[1]) * t], t: q.tan };
  };
  // breakpoints
  const bp = new Set<number>();
  const s0 = closed ? sOff : -w.extA;
  const s1 = closed ? sOff + L : L + w.extB;
  bp.add(s0);
  bp.add(s1);
  const inRange = (s: number) => s > s0 + 1e-6 && s < s1 - 1e-6;
  for (const sv of ps.s) {
    for (const k of closed ? [sv, sv + L, sv - L] : [sv]) if (inRange(k)) bp.add(k);
  }
  for (const sp of w.spans) for (const sv of [sp.s0, sp.s1]) for (const k of closed ? [sv, sv + L, sv - L] : [sv]) if (inRange(k)) bp.add(k);
  // openings in unrolled coordinates
  const holes: { d: DOpening; ring: V2[]; lo: number; hi: number }[] = [];
  for (const d of w.openings) {
    let shift = 0;
    if (closed) {
      const c = d.s;
      while (c + shift < s0) shift += L;
      while (c + shift >= s1) shift -= L;
    }
    const ring = holeOutline(d).map((q) => [q[0] + shift, q[1]] as V2);
    const lo = Math.min(...ring.map((q) => q[0])), hi = Math.max(...ring.map((q) => q[0]));
    holes.push({ d, ring, lo, hi });
    for (const q of ring) if (inRange(q[0])) bp.add(q[0]);
  }
  const brk = [...bp].sort((a, b) => a - b);
  // extension stations (straight continuation past the ends)
  const stAt = (s: number): Station => {
    if (!closed && s < 0) {
      const st = stationAt(0);
      return { s, p: add(st.p, mul(st.t, s)), n: perp(st.t), t: st.t };
    }
    if (!closed && s > L) {
      const st = stationAt(L);
      return { s, p: add(st.p, mul(st.t, s - L)), n: perp(st.t), t: st.t };
    }
    return stationAt(s);
  };
  const spanAt = (s: number) => {
    const sv = closed ? wrap(s) : Math.max(0, Math.min(L, s));
    let best = w.spans[0];
    for (const sp of w.spans) if (sv >= sp.s0 - 1e-9 && sv <= sp.s1 + 1e-9) { best = sp; break; }
    return best;
  };
  const evalSpan = (sp: typeof w.spans[number] | undefined, s: number) => {
    if (!sp) return { b: r.baseY, t: r.baseY + 3 };
    const sv = closed ? wrap(s) : Math.max(0, Math.min(L, s));
    const k = (sv - sp.s0) / Math.max(sp.s1 - sp.s0, 1e-9);
    const kk = Math.max(0, Math.min(1, k));
    return { b: sp.b0 + (sp.b1 - sp.b0) * kk, t: sp.t0 + (sp.t1 - sp.t0) * kk };
  };
  const map = (st: Station, y: number, side: number): V3 => [st.p[0] + st.n[0] * half * side, y, st.p[1] + st.n[1] * half * side];
  const mapS = (s: number, y: number, side: number): V3 => map(stAt(s), y, side);

  let prevTop: number | null = null, prevBot: number | null = null;
  for (let i = 0; i + 1 < brk.length; i++) {
    const a = brk[i], b = brk[i + 1];
    if (b - a < 1e-6) continue;
    const mid = (a + b) / 2;
    // closed walls: wrap the mid for span lookup
    const sp = spanAt(mid);
    const A = evalSpan(sp, a + 1e-7), B = evalSpan(sp, b - 1e-7);
    const sa = stAt(a), sb = stAt(b);
    const na: V3 = [sa.n[0], 0, sa.n[1]];
    // step faces where the height jumps (rooms of different heights meet)
    if (prevTop !== null && Math.abs(prevTop - A.t) > 1e-3) {
      const lo = Math.min(prevTop, A.t), hi = Math.max(prevTop, A.t);
      const dir = prevTop > A.t ? 1 : -1;
      solid.quad(map(sa, lo, 1), map(sa, lo, -1), map(sa, hi, -1), map(sa, hi, 1), [sa.t[0] * dir, 0, sa.t[1] * dir]);
    }
    if (prevBot !== null && Math.abs(prevBot - A.b) > 1e-3) {
      const lo = Math.min(prevBot, A.b), hi = Math.max(prevBot, A.b);
      const dir = prevBot < A.b ? 1 : -1;
      solid.quad(map(sa, lo, 1), map(sa, lo, -1), map(sa, hi, -1), map(sa, hi, 1), [sa.t[0] * dir, 0, sa.t[1] * dir]);
    }
    prevTop = B.t;
    prevBot = B.b;
    const hs = holes.filter((h) => h.hi > a + 1e-6 && h.lo < b - 1e-6);
    if (!hs.length) {
      for (const side of [1, -1]) solid.quad(map(sa, A.b, side), map(sb, B.b, side), map(sb, B.t, side), map(sa, A.t, side), [na[0] * side, 0, na[2] * side]);
    } else {
      const strip: V2[] = [[a, A.b], [b, B.b], [b, B.t], [a, A.t]];
      const cut = difference(P(strip), ...hs.map((h) => P(h.ring)));
      for (const poly of cut) {
        const outer = poly[0].map((q) => new THREE.Vector2(q[0], q[1]));
        const hh = poly.slice(1).map((h) => h.map((q) => new THREE.Vector2(q[0], q[1])));
        const all = [...poly[0], ...poly.slice(1).flat()];
        let tris: number[][] = [];
        try {
          tris = THREE.ShapeUtils.triangulateShape(outer, hh);
        } catch {}
        for (const side of [1, -1]) {
          for (const t of tris) {
            const [p0, p1, p2] = t.map((k) => all[k]);
            solid.tri(mapS(p0[0], p0[1], side), mapS(p1[0], p1[1], side), mapS(p2[0], p2[1], side), [na[0] * side, 0, na[2] * side]);
          }
        }
      }
    }
    // top and bottom caps
    solid.quad(map(sa, A.t, 1), map(sb, B.t, 1), map(sb, B.t, -1), map(sa, A.t, -1), [0, 1, 0]);
    solid.quad(map(sa, A.b, 1), map(sb, B.b, 1), map(sb, B.b, -1), map(sa, A.b, -1), [0, -1, 0]);
  }
  // end caps
  if (!closed) {
    for (const [s, dir] of [[s0, -1], [s1, 1]] as [number, number][]) {
      const st = stAt(s);
      const v = evalSpan(spanAt(s), s);
      solid.quad(map(st, v.b, 1), map(st, v.b, -1), map(st, v.t, -1), map(st, v.t, 1), [st.t[0] * dir, 0, st.t[1] * dir]);
    }
  }
  // jambs: the reveals around each opening, following the wall's curve
  for (const h of holes) {
    const ring = h.ring;
    const n = ring.length;
    // ring is CCW in (s,y)? ensure inward normal computed per edge
    let area = 0;
    for (let i = 0; i < n; i++) area += ring[i][0] * ring[(i + 1) % n][1] - ring[(i + 1) % n][0] * ring[i][1];
    const ccw = area > 0;
    for (let i = 0; i < n; i++) {
      const p0 = ring[i], p1 = ring[(i + 1) % n];
      // subdivide at breakpoints so the reveal follows the curve
      const lo = Math.min(p0[0], p1[0]), hi = Math.max(p0[0], p1[0]);
      const cuts = brk.filter((x) => x > lo + 1e-6 && x < hi - 1e-6);
      const pts: V2[] = [p0];
      const dir = p1[0] >= p0[0] ? 1 : -1;
      for (const c of dir > 0 ? cuts : cuts.slice().reverse()) {
        const t = (c - p0[0]) / (p1[0] - p0[0]);
        pts.push([c, p0[1] + (p1[1] - p0[1]) * t]);
      }
      pts.push(p1);
      for (let k = 0; k + 1 < pts.length; k++) {
        const q0 = pts[k], q1 = pts[k + 1];
        const es = q1[0] - q0[0], ey = q1[1] - q0[1];
        // inward normal (towards the hole centre) in (s,y)
        let ns = -ey, ny = es;
        if (!ccw) {
          ns = -ns;
          ny = -ny;
        }
        const st = stAt((q0[0] + q1[0]) / 2);
        const hint: V3 = [st.t[0] * ns, ny, st.t[1] * ns];
        solid.quad(mapS(q0[0], q0[1], 1), mapS(q1[0], q1[1], 1), mapS(q1[0], q1[1], -1), mapS(q0[0], q0[1], -1), hint);
      }
    }
    // glazing for windows
    if (h.d.o.sill > 0.25) {
      const outer = ring.map((q) => new THREE.Vector2(q[0], q[1]));
      let tris: number[][] = [];
      try {
        tris = THREE.ShapeUtils.triangulateShape(outer, []);
      } catch {}
      for (const t of tris) {
        const [p0, p1, p2] = t.map((k) => ring[k]);
        glass.tri(mapS(p0[0], p0[1], 0), mapS(p1[0], p1[1], 0), mapS(p2[0], p2[1], 0));
      }
    }
  }
  return { solid, glass, frames };
}
