// Overheads: a drawn profile carried across a drawn outline (or spun around a round one).
import { Geo, V3 } from './geo';
import type { Overhead } from '../../model/types';
import { ohFrame, profileH, PSample, hipH, ohH, profilePeak } from '../../model/overheadGeom';
import { V2, add, mul, dot, perp, dist, pointInPoly, polyArea, lerp2, bbox, segIntersect, distToPolyEdge } from '../../model/geom2d';
import { P, intersection, difference, MPoly } from '../../model/clip';
import { roofWingsState, type CompoundState, type Wing } from '../../model/wings';

export interface OverheadMesh {
  top: Geo; // roof surface + fascia
  under: Geo; // underside
  glass: Geo; // clerestory / lantern glazing and skylight caps
}

function subdivideRing(ring: V2[], d: V2, ws: number[]): V2[] {
  const out: V2[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    out.push(a);
    const wa = dot(a, d), wb = dot(b, d);
    if (Math.abs(wb - wa) < 1e-9) continue;
    const lo = Math.min(wa, wb), hi = Math.max(wa, wb);
    const cuts = ws.filter((w) => w > lo + 1e-6 && w < hi - 1e-6).sort((x, y) => (wb > wa ? x - y : y - x));
    for (const w of cuts) out.push(lerp2(a, b, (w - wa) / (wb - wa)));
  }
  return out;
}

export function buildOverhead(oh: Overhead, holes: V2[][]): OverheadMesh {
  if (oh.form === 'revolve') return buildRevolve(oh, holes);
  const st = roofWingsState(oh);
  if (st.kind === 'compound') return buildCompound(oh, holes, st);
  // A wing roof whose section cannot be carried across its wings has no surface. Stretching it across the outline as
  // one span would draw a different roof under this one's name; the gap is deliberate, and `derive` reports why.
  if (oh.oneSpan === false && st.kind === 'unsupported') return { top: new Geo(), under: new Geo(), glass: new Geo() };
  return buildSingle(oh, holes);
}

function buildSingle(oh: Overhead, holes: V2[][]): OverheadMesh {
  const top = new Geo(), under = new Geo(), glass = new Geo();
  const f = ohFrame(oh);
  const d = f.d, e = perp(d);
  const W = Math.max(f.wmax - f.wmin, 1e-6);
  const S = f.samples;
  const ws = S.map((s) => f.wmin + s.u * W);
  let foot: MPoly = P(oh.outline);
  if (holes.length) foot = difference(foot, ...holes.map((h) => P(h)));
  const B = 1e3;
  const hip = f.hip;
  const hAt = (p: V2) => {
    const u = (dot(p, d) - f.wmin) / W;
    const h = profileH(S, Math.max(0, Math.min(1, u)));
    return hip > 0 ? Math.min(h, hipH(f, dot(p, e))) : h;
  };
  // hipped ends: breaks along the ridge where the end slope's samples fall (both ends), the middle stays one piece
  const vs: number[] = [];
  if (hip > 0) {
    for (const s of S) {
      if (s.u > f.hipU + 1e-9) break;
      const t = f.hipU > 0 ? s.u / f.hipU : 1;
      vs.push(f.emin + t * hip, f.emax - t * hip);
    }
    vs.sort((a, b) => a - b);
  }
  const vBreaks = hip > 0 ? [-B, ...vs, B] : [-B, B];
  // cell corners in plan, rounded to a micron: the clipper rejects near-coincident edges (and the piece is lost)
  const um = (x: number) => Math.round(x * 1e6) / 1e6;
  const at = (w: number, v: number): V2 => {
    const q = add(mul(d, w), mul(e, v));
    return [um(q[0]), um(q[1])];
  };
  const piecesOf = footPieces(foot);
  // on a hip's end slope the height depends only on the position along the ridge, so a row of such cells across
  // neighbouring strips is one plane: it is gathered here and laid as one piece
  const gRows = new Map<number, { w0: number; w1: number; v0: number; v1: number; g0: number; g1: number }>();
  const layG = (j: number) => {
    const g = gRows.get(j);
    if (!g) return;
    gRows.delete(j);
    const pieces = piecesOf([at(g.w0, g.v0), at(g.w1, g.v0), at(g.w1, g.v1), at(g.w0, g.v1)]);
    if (!pieces.length) return;
    const y = (p: V2) => oh.baseY + oh.thick + g.g0 + ((g.g1 - g.g0) * (dot(p, e) - g.v0)) / (g.v1 - g.v0);
    top.flatM(pieces, y, true);
    under.flatM(pieces, (p) => y(p) - oh.thick, false);
  };
  // surfaces, planar within each cell (exact for the polyline profile): a cell takes the lower of the cross slope
  // and the end slope, and where they cross inside it, it is cut along the hip line into two flat pieces
  for (let i = 0; i + 1 < S.length; i++) {
    const w0 = ws[i], w1 = ws[i + 1];
    if (w1 - w0 < 1e-5) continue;
    const h0 = S[i].h, h1 = S[i + 1].h;
    const F = (w: number) => h0 + ((h1 - h0) * (w - w0)) / (w1 - w0);
    const yF = (p: V2) => oh.baseY + oh.thick + F(dot(p, d));
    let pending: { kind: 'F'; v0: number; v1: number } | null = null;
    const flush = () => {
      if (!pending) return;
      const pieces = piecesOf([at(w0, pending.v0), at(w1, pending.v0), at(w1, pending.v1), at(w0, pending.v1)]);
      if (pieces.length) {
        top.flatM(pieces, yF, true);
        under.flatM(pieces, (p) => yF(p) - oh.thick, false);
      }
      pending = null;
    };
    for (let j = 0; j + 1 < vBreaks.length; j++) {
      const v0 = vBreaks[j], v1 = vBreaks[j + 1];
      if (v1 - v0 < 1e-5) continue;
      const vm = (v0 + v1) / 2;
      const inHip = hip > 0 && Math.min(vm - f.emin, f.emax - vm) < hip - 1e-6;
      const g0 = inHip ? hipH(f, Math.max(v0, f.emin)) : Infinity, g1 = inHip ? hipH(f, Math.min(v1, f.emax)) : Infinity;
      const G = (v: number) => g0 + ((g1 - g0) * (v - v0)) / (v1 - v0);
      const cell: [number, number][] = [[w0, v0], [w1, v0], [w1, v1], [w0, v1]];
      const parts: { poly: [number, number][]; y: (w: number, v: number) => number; g?: boolean }[] = [];
      if (!inHip || v0 < -B / 2 || v1 > B / 2) parts.push({ poly: cell, y: (w) => F(w) });
      else {
        const diff = (q: [number, number]) => F(q[0]) - G(q[1]);
        const ds = cell.map(diff);
        if (ds.every((x) => x <= 1e-9)) parts.push({ poly: cell, y: (w) => F(w) });
        else if (ds.every((x) => x >= -1e-9)) parts.push({ poly: cell, y: (_w, v) => G(v), g: true });
        else {
          parts.push({ poly: clipHalf(cell, diff, -1), y: (w) => F(w) });
          parts.push({ poly: clipHalf(cell, diff, 1), y: (_w, v) => G(v), g: true });
        }
      }
      // a run of cells all on the cross slope is one plane: merge it with the cell before (fewer pieces, fewer clips)
      if (parts.length === 1 && parts[0].poly === cell && pending && pending.kind === 'F' && !inHipG(parts[0])) {
        pending.v1 = v1;
        continue;
      }
      flush();
      if (parts.length === 1 && parts[0].poly === cell && inHipG(parts[0])) {
        const g = gRows.get(j);
        if (g && Math.abs(g.w1 - w0) < 1e-7) g.w1 = w1;
        else {
          layG(j);
          gRows.set(j, { w0, w1, v0, v1, g0, g1 });
        }
        continue;
      }
      // a row whose run of end-slope cells stops here is laid now
      layG(j);
      if (parts.length === 1 && parts[0].poly === cell && !inHipG(parts[0])) {
        pending = { kind: 'F', v0, v1 };
        continue;
      }
      for (const part of parts) {
        if (part.poly.length < 3) continue;
        const pieces = piecesOf(part.poly.map(([w, v]) => at(w, v)));
        if (!pieces.length) continue;
        const yTop = (p: V2) => oh.baseY + oh.thick + part.y(dot(p, d), dot(p, e));
        top.flatM(pieces, yTop, true);
        under.flatM(pieces, (p) => yTop(p) - oh.thick, false);
      }
    }
    flush();
  }
  for (const j of [...gRows.keys()]) layG(j);
  // fascia around the outline and around skylight holes, following the profile
  const yT = (p: V2) => oh.baseY + oh.thick + hAt(p);
  for (const poly of foot)
    poly.forEach((ring, ri) => {
      const sub = hip > 0 ? subdivideRing(subdivideRing(ring, d, ws), e, vs) : subdivideRing(ring, d, ws);
      top.skirt(sub, (p) => yT(p) - oh.thick, yT, ri === 0);
    });
  // vertical steps → glazing (a clerestory), with short fascia on each side
  for (let i = 0; i + 1 < S.length; i++) {
    if (Math.abs(ws[i + 1] - ws[i]) > 1e-5 || Math.abs(S[i + 1].h - S[i].h) < 0.05) continue;
    const w = ws[i];
    const lo = Math.min(S[i].h, S[i + 1].h) + oh.thick, hi = Math.max(S[i].h, S[i + 1].h) + oh.thick;
    const chords = chordsAt(foot, d, e, w);
    const towardHigh = S[i + 1].h > S[i].h ? 1 : -1; // high side lies at larger w
    for (const [a, b] of chords) {
      const L = dist(a, b);
      const n = Math.max(1, Math.round(L / 1.4));
      for (let k = 0; k < n; k++) {
        const p0 = lerp2(a, b, k / n), p1 = lerp2(a, b, (k + 1) / n);
        glass.quad([p0[0], oh.baseY + lo, p0[1]], [p1[0], oh.baseY + lo, p1[1]], [p1[0], oh.baseY + hi - oh.thick, p1[1]], [p0[0], oh.baseY + hi - oh.thick, p0[1]]);
      }
      const nrm: V3 = [-d[0] * towardHigh, 0, -d[1] * towardHigh];
      top.quad([a[0], oh.baseY + hi - oh.thick, a[1]], [b[0], oh.baseY + hi - oh.thick, b[1]], [b[0], oh.baseY + hi, b[1]], [a[0], oh.baseY + hi, a[1]], nrm);
      top.quad([a[0], oh.baseY + lo - oh.thick, a[1]], [b[0], oh.baseY + lo - oh.thick, b[1]], [b[0], oh.baseY + lo, b[1]], [a[0], oh.baseY + lo, a[1]], [-nrm[0], 0, -nrm[2]]);
    }
  }
  // skylight caps
  for (const h of holes) {
    const hy = Math.max(...h.map((p) => yT(p))) + 0.04;
    glass.flat([h], hy, true);
  }
  return { top, under, glass };
}

function chordsAt(foot: MPoly, d: V2, e: V2, w: number): [V2, V2][] {
  const hits: number[] = [];
  for (const poly of foot)
    for (const ring of poly)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const wa = dot(a, d), wb = dot(b, d);
        if ((wa - w) * (wb - w) < 0) {
          const t = (w - wa) / (wb - wa);
          hits.push(dot(lerp2(a, b, t), e));
        }
      }
  hits.sort((x, y) => x - y);
  const out: [V2, V2][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) out.push([add(mul(d, w), mul(e, hits[i])), add(mul(d, w), mul(e, hits[i + 1]))]);
  return out;
}

function buildRevolve(oh: Overhead, holes: V2[][]): OverheadMesh {
  const top = new Geo(), under = new Geo(), glass = new Geo();
  const f = ohFrame(oh);
  const c = f.center, R = f.R;
  // half profile: rim (u=0) to centre (u=0.5)
  const half: PSample[] = f.samples.filter((s) => s.u <= 0.5 + 1e-9);
  if (!half.length || half[half.length - 1].u < 0.5 - 1e-6) half.push({ u: 0.5, h: profileH(f.samples, 0.5) });
  const N = 72;
  // oculus: a hole around the centre
  let rHole = 0;
  for (const h of holes) if (pointInPoly(c, h)) rHole = Math.max(rHole, Math.max(...h.map((p) => dist(p, c))));
  const ring = (r: number, y: number): V3[] => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    return [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)] as V3;
  });
  const rs = half.map((s) => ({ r: R * (1 - 2 * s.u), h: s.h + oh.thick }));
  const hAtR = (r: number) => {
    for (let i = 0; i + 1 < rs.length; i++) {
      const a = rs[i], b = rs[i + 1];
      if (r <= a.r + 1e-9 && r >= b.r - 1e-9) return a.r - b.r < 1e-9 ? Math.max(a.h, b.h) : a.h + ((b.h - a.h) * (a.r - r)) / (a.r - b.r);
    }
    return rs[rs.length - 1].h;
  };
  const list = rs.filter((x) => x.r >= rHole - 1e-6);
  if (rHole > 0) list.push({ r: rHole, h: hAtR(rHole) });
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i], b = list[i + 1];
    if (Math.abs(a.r - b.r) < 1e-6) {
      // vertical step → a glazed lantern ring
      if (Math.abs(a.h - b.h) > 0.05) {
        const lo = Math.min(a.h, b.h), hi = Math.max(a.h, b.h);
        const r0 = ring(a.r, oh.baseY + lo), r1 = ring(a.r, oh.baseY + hi - oh.thick);
        for (let k = 0; k < N; k++) glass.quad(r0[k], r0[(k + 1) % N], r1[(k + 1) % N], r1[k]);
      }
      continue;
    }
    const ta = ring(a.r, oh.baseY + a.h), tb = ring(b.r, oh.baseY + b.h);
    const ua = ring(a.r, oh.baseY + a.h - oh.thick), ub = ring(b.r, oh.baseY + b.h - oh.thick);
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      if (b.r < 1e-6) {
        top.tri(ta[k], ta[k1], tb[k], [0, 1, 0]);
        under.tri(ua[k], ua[k1], ub[k], [0, -1, 0]);
      } else {
        top.quad(ta[k], ta[k1], tb[k1], tb[k], [0, 1, 0]);
        under.quad(ua[k], ua[k1], ub[k1], ub[k], [0, -1, 0]);
      }
    }
  }
  // rim fascia
  const rt = ring(R, oh.baseY + rs[0].h), ru = ring(R, oh.baseY + rs[0].h - oh.thick);
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    const a = (k + 0.5) / N * Math.PI * 2;
    top.quad(ru[k], ru[k1], rt[k1], rt[k], [Math.cos(a), 0, Math.sin(a)]);
  }
  if (rHole > 0) {
    const hy = oh.baseY + hAtR(rHole);
    const it = ring(rHole, hy), iu = ring(rHole, hy - oh.thick);
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const a = (k + 0.5) / N * Math.PI * 2;
      top.quad(iu[k], iu[k1], it[k1], it[k], [-Math.cos(a), 0, -Math.sin(a)]);
    }
    glass.flat([Array.from({ length: 32 }, (_, i) => [c[0] + rHole * Math.cos((i / 32) * Math.PI * 2), c[1] + rHole * Math.sin((i / 32) * Math.PI * 2)] as V2)], hy + 0.05, true);
  }
  return { top, under, glass };
}

/** The part of a convex (w, v) cell where sign(fn) matches `side` (−1: fn ≤ 0, +1: fn ≥ 0); fn is linear in the cell. */
function clipHalf(cell: [number, number][], fn: (q: [number, number]) => number, side: -1 | 1): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < cell.length; i++) {
    const a = cell[i], b = cell[(i + 1) % cell.length];
    const fa = fn(a) * side, fb = fn(b) * side;
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  // a hip line through a corner repeats that corner: drop the repeats, or the piece degenerates
  return out.filter((q, i) => {
    const r = out[(i + out.length - 1) % out.length];
    return out.length < 2 || Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-7;
  });
}

const inHipG = (part: { g?: boolean }) => !!part.g;

/**
 * Clip a convex piece to the roof's footprint, quickly: outside the footprint's bounds it is nothing, and well inside
 * a simple footprint (no edge crossing it) it is itself. Only pieces on the outline go through the clipper.
 */
function footPieces(foot: MPoly) {
  const ring = foot.length === 1 && foot[0].length === 1 ? foot[0][0] : null;
  const fb = bbox(foot.flatMap((poly) => poly[0]));
  const EPS = 1e-6;
  return (poly: V2[]): MPoly => {
    const pb = bbox(poly);
    if (pb.max[0] < fb.min[0] - EPS || pb.min[0] > fb.max[0] + EPS || pb.max[1] < fb.min[1] - EPS || pb.min[1] > fb.max[1] + EPS) return [];
    if (ring) {
      const inside = poly.every((q) => pointInPoly(q, ring) && distToPolyEdge(q, ring) > EPS);
      if (inside && !ring.some((q) => pointInPoly(q, poly)) && !crosses(ring, poly)) return [[poly]];
    }
    return intersection(foot, P(poly));
  };
}

function crosses(a: V2[], b: V2[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) if (segIntersect(p, q, b[j], b[(j + 1) % b.length])) return true;
  }
  return false;
}

// ------------------------------------------------------------------ compound roofs: wings and valleys
// The surface is the upper envelope of the wings' supports. Every grid break makes each wing's cross slope, and each
// hipped end slope, a single plane inside a cell; the envelope then partitions each cell into pieces that are emitted
// as flat facets. Nothing here decides whether a roof is continuous: wings.ts validated that before we got here.
interface Plane {
  a: number;
  bw: number;
  bv: number;
}

const planeAt = (pl: Plane, w: number, v: number) => pl.a + pl.bw * w + pl.bv * v;

function buildCompound(oh: Overhead, holes: V2[][], st: CompoundState): OverheadMesh {
  const top = new Geo(), under = new Geo(), glass = new Geo();
  const f = ohFrame(oh);
  const d = f.d, e: V2 = [-d[1], d[0]];
  const S = f.samples;
  const pkU = profilePeak(oh.profile).u;
  const at = (w: number, v: number): V2 => [d[0] * w + e[0] * v, d[1] * w + e[1] * v];

  // ---- breaks: every wing's rectangles and samples, so each cell is planar for every candidate
  const W: number[] = [f.wmin, f.wmax], V: number[] = [f.emin, f.emax];
  for (const wg of st.wings) {
    const [w0, w1, v0, v1] = wg.rect, [sw0, sw1, sv0, sv1] = wg.support;
    W.push(w0, w1, sw0, sw1);
    V.push(v0, v1, sv0, sv1);
    const spanLen = wg.span === 'w' ? w1 - w0 : v1 - v0;
    for (const s of S) (wg.span === 'w' ? W : V).push((wg.span === 'w' ? w0 : v0) + s.u * spanLen);
    const r0 = wg.span === 'w' ? v0 : w0, r1 = wg.span === 'w' ? v1 : w1;
    const along = wg.span === 'w' ? V : W;
    if (wg.hipLo > 1e-6) {
      along.push(r0 + wg.hipLo);
      for (const s of S) if (s.u <= pkU + 1e-9) along.push(r0 + (s.u / pkU) * wg.hipLo);
    }
    if (wg.hipHi > 1e-6) {
      along.push(r1 - wg.hipHi);
      for (const s of S) if (s.u <= pkU + 1e-9) along.push(r1 - (s.u / pkU) * wg.hipHi);
    }
  }
  const ws = mergeBreaks(W, f.wmin, f.wmax), vs = mergeBreaks(V, f.emin, f.emax);

  let foot: MPoly = P(oh.outline);
  if (holes.length) foot = difference(foot, ...holes.map((h) => P(h)));

  for (let i = 0; i + 1 < ws.length; i++) {
    const w0 = ws[i], w1 = ws[i + 1];
    if (w1 - w0 < 1e-6) continue;
    for (let j = 0; j + 1 < vs.length; j++) {
      const v0 = vs[j], v1 = vs[j + 1];
      if (v1 - v0 < 1e-6) continue;
      const wm = (w0 + w1) / 2, vm = (v0 + v1) / 2;
      if (!pointInPoly(at(wm, vm), oh.outline)) continue;
      const cell: V2[] = [[w0, v0], [w1, v0], [w1, v1], [w0, v1]];
      // candidates whose support covers the cell, each cut into the regions where one of its planes is the lowest
      interface Piece { plane: Plane; domain: V2[] }
      const pieces: Piece[] = [];
      for (const wg of st.wings) {
        if (wm < wg.support[0] - 1e-9 || wm > wg.support[1] + 1e-9 || vm < wg.support[2] - 1e-9 || vm > wg.support[3] + 1e-9) continue;
        const planes: Plane[] = [];
        const cross = crossPlane(wg, S, w0, w1, v0, v1);
        if (!cross) continue;
        planes.push(cross);
        const spanW = wg.span === 'w';
        const cl = spanW ? v0 : w0, ch = spanW ? v1 : w1;
        const lo = hipPlane(wg, S, pkU, 'lo', cl, ch);
        const hi = hipPlane(wg, S, pkU, 'hi', cl, ch);
        if (lo) planes.push(lo);
        if (hi) planes.push(hi);
        for (let p = 0; p < planes.length; p++) {
          let poly = cell;
          for (let q = 0; q < planes.length && poly.length >= 3; q++) {
            if (q === p) continue;
            const diff = diffPlane(planes[q], planes[p]);
            poly = clipHalfPlane(poly, (pt) => planeAt(diff, pt[0], pt[1]));
          }
          if (poly.length >= 3) pieces.push({ plane: planes[p], domain: poly });
        }
      }
      if (!pieces.length) continue;
      // upper envelope: each piece keeps the region where no other is above it; ties go to the earlier piece
      for (let a = 0; a < pieces.length; a++) {
        let region: MPoly = [[pieces[a].domain.map(([w, v]) => at(w, v))]];
        for (let b = 0; b < pieces.length && region.length; b++) {
          if (a === b) continue;
          const diff = diffPlane(pieces[b].plane, pieces[a].plane);
          const keep = clipHalfPlane(pieces[b].domain, (pt) => planeAt(diff, pt[0], pt[1]) + (b < a ? 1e-9 : -1e-9));
          if (keep.length < 3) continue;
          region = difference(region, [[keep.map(([w, v]) => at(w, v))]]);
        }
        if (!region.length) continue;
        const clipped = intersection(region, foot);
        for (const m of clipped) {
          if (!m.length) continue;
          const yTop = (p: V2) => oh.baseY + oh.thick + planeAt(pieces[a].plane, dot(p, d), dot(p, e));
          top.flatM([m], yTop, true);
          under.flatM([m], (p) => yTop(p) - oh.thick, false);
        }
      }
    }
  }

  // fascia around the outline and around skylight holes, following the compound surface
  const yT = (p: V2) => oh.baseY + oh.thick + ohH(oh, p);
  for (const poly of foot)
    poly.forEach((ring, ri) => {
      const sub = subdivideRing(subdivideRing(ring, d, ws), e, vs);
      top.skirt(sub, (p) => yT(p) - oh.thick, yT, ri === 0);
    });
  for (const h of holes) {
    if (!h.length) continue;
    const hy = Math.max(...h.map((p) => yT(p))) + 0.04;
    glass.flat([h], hy, true);
  }
  return { top, under, glass };
}

/** The cell's cross slope as one plane; null when the cell is outside the wing's span. */
function crossPlane(wg: Wing, S: PSample[], w0: number, w1: number, v0: number, v1: number): Plane | null {
  const spanW = wg.span === 'w';
  const s0 = spanW ? wg.rect[0] : wg.rect[2];
  const s1 = spanW ? wg.rect[1] : wg.rect[3];
  const span = s1 - s0;
  const cl = spanW ? w0 : v0, ch = spanW ? w1 : v1;
  const uLo = (cl - s0) / Math.max(span, 1e-9), uHi = (ch - s0) / Math.max(span, 1e-9);
  if (uHi < -1e-9 || uLo > 1 + 1e-9) return null;
  for (let k = 0; k + 1 < S.length; k++) {
    const a = S[k], b = S[k + 1];
    if (a.u <= uLo + 1e-9 && b.u >= uHi - 1e-9) {
      const du = b.u - a.u;
      if (du < 1e-12) return { a: a.h * wg.scale, bw: 0, bv: 0 };
      const c = (wg.scale * (b.h - a.h)) / du / span;
      const base = wg.scale * a.h - c * (s0 + a.u * span);
      return spanW ? { a: base, bw: c, bv: 0 } : { a: base, bw: 0, bv: c };
    }
  }
  return null;
}

/** A hipped end slope as one plane across the cell; null when the cell is outside that end's hip. */
function hipPlane(wg: Wing, S: PSample[], pkU: number, end: 'lo' | 'hi', cl: number, ch: number): Plane | null {
  const hip = end === 'lo' ? wg.hipLo : wg.hipHi;
  if (hip < 1e-9) return null;
  const spanW = wg.span === 'w';
  const r0 = spanW ? wg.rect[2] : wg.rect[0];
  const r1 = spanW ? wg.rect[3] : wg.rect[1];
  const xa = end === 'lo' ? (cl - r0) / hip : (r1 - ch) / hip;
  const xb = end === 'lo' ? (ch - r0) / hip : (r1 - cl) / hip;
  if (xb < -1e-9 || xa > 1 + 1e-9) return null;
  const x0 = Math.max(0, xa), x1 = Math.min(1, xb);
  for (let k = 0; k + 1 < S.length; k++) {
    const xk = S[k].u / Math.max(pkU, 1e-9), xk1 = S[k + 1].u / Math.max(pkU, 1e-9);
    if (xk > 1 + 1e-9) break;
    if (xk <= x0 + 1e-9 && xk1 >= x1 - 1e-9) {
      const dhdx = (S[k + 1].h - S[k].h) / Math.max(xk1 - xk, 1e-9);
      const a = wg.scale * S[k].h + wg.scale * dhdx * ((end === 'lo' ? -r0 : r1) / hip - xk);
      const cr = ((end === 'lo' ? 1 : -1) * wg.scale * dhdx) / hip;
      return spanW ? { a, bw: 0, bv: cr } : { a, bw: cr, bv: 0 };
    }
  }
  return null;
}

const diffPlane = (a: Plane, b: Plane): Plane => ({ a: a.a - b.a, bw: a.bw - b.bw, bv: a.bv - b.bv });

/** Keep the part of a convex ring where fn ≥ 0 (or ≤ 0 when `keepBelow`). */
function clipHalfPlane(ring: V2[], fn: (q: V2) => number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const fa = fn(a), fb = fn(b);
    if (fa >= -1e-12) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out.filter((q, i) => {
    const r = out[(i + out.length - 1) % out.length];
    return out.length < 2 || Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-9;
  });
}

/** Sorted unique breaks inside the extent; near-coincident values merge so cells never become slivers. */
function mergeBreaks(vals: number[], lo: number, hi: number): number[] {
  const s = vals.filter((x) => Number.isFinite(x) && x >= lo - 1e-7 && x <= hi + 1e-7).sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of s) if (!out.length || x - out[out.length - 1] > 1e-5) out.push(x);
  return out;
}
