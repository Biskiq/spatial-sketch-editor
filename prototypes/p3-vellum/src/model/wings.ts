// Roofs over compound plans (L, T, U, plus): the authored section is shared by a small set of roof wings, each spanning
// the short side of its rectangle at the same pitch. Pure: no state, no rendering. The decomposition is a candidate
// that must pass its own continuity validation before anything may use it — a rectangle cover plus max() is not, by
// itself, a continuous roof.
//
// This module imports only geometry and the section curve, so `overheadGeom` can import it without a cycle.
import { V2, dot, fromAngle, distToPolyEdge, pointInPoly, polyArea, clamp } from './geom2d';
import type { Overhead } from './types';
import { sampleProfile, profileH, profilePeak } from './profileCurve';
import type { PSample } from './profileCurve';

export interface Wing {
  index: number;
  /** the maximal rectangle of the plan this wing covers: [w0, w1, v0, v1] in the roof frame (w along dir, v along perp) */
  rect: [number, number, number, number];
  /**
   * Where this wing's heights are defined: its rectangle, extended (or trimmed) along its ridge to the ridge of the
   * roof it runs into. The surface is the upper envelope of every wing whose support contains the point; the support
   * never ends where this wing is the higher roof, so the envelope is continuous there.
   */
  support: [number, number, number, number];
  /** the axis the section spans: 'w' (the authored dir) or 'v' (perpendicular to it); the ridge runs the other way */
  span: 'w' | 'v';
  /** heights and hip scale by span / reference span, so every wing keeps the same pitch */
  scale: number;
  /** the two ends of this wing's ridge */
  ends: { lo: 'exposed' | 'joined'; hi: 'exposed' | 'joined' };
  /** hipped length at each exposed end, in metres along the ridge (0 when the end is a gable or joined) */
  hipLo: number;
  hipHi: number;
  area: number;
}

export interface CompoundState {
  kind: 'compound';
  wings: Wing[];
  primarySpan: number;
  /** the section's peak as a fraction of the span */
  peakU: number;
}

export type WingState = { kind: 'single' } | CompoundState | { kind: 'unsupported'; reason: string };

interface Ext { d: V2; e: V2; wmin: number; wmax: number; emin: number; emax: number }

/** The roof frame: the same extents `ohFrame` uses, without importing it (which would close a cycle). */
function extents(oh: Overhead): Ext {
  const d = fromAngle(oh.dir);
  const e: V2 = [-d[1], d[0]];
  let wmin = Infinity, wmax = -Infinity, emin = Infinity, emax = -Infinity;
  for (const p of oh.outline) {
    const w = dot(p, d), v = dot(p, e);
    wmin = Math.min(wmin, w);
    wmax = Math.max(wmax, w);
    emin = Math.min(emin, v);
    emax = Math.max(emax, v);
  }
  return { d, e, wmin, wmax, emin, emax };
}

const cache = new WeakMap<Overhead, { key: string; state: WingState }>();

function keyOf(oh: Overhead) {
  return `${oh.outline.join(';')}|${oh.dir}|${JSON.stringify(oh.profile)}|${oh.form}|${oh.hip ?? 0}|${oh.oneSpan}`;
}

export function roofWingsState(oh: Overhead): WingState {
  const key = keyOf(oh);
  const hit = cache.get(oh);
  if (hit && hit.key === key) return hit.state;
  const state = decompose(oh);
  cache.set(oh, { key, state });
  return state;
}

/** Convenience read: the qualified wings, or null. Null is not permission to replace a compound roof with one span. */
export function roofWings(oh: Overhead): Wing[] | null {
  const s = roofWingsState(oh);
  return s.kind === 'compound' ? s.wings : null;
}

const AXIS_TOL = (2 * Math.PI) / 180;
const MERGE = 0.02;
const MIN_CELL = 0.02;
const MIN_SHORT = 1.2;
const MAX_RECTS = 4;
const MAX_VERTS = 16;

function decompose(oh: Overhead): WingState {
  if (oh.oneSpan !== false) return { kind: 'single' };
  if (oh.form !== 'extrude') return { kind: 'unsupported', reason: 'only an extruded section can cover several wings' };
  if (oh.outline.length > MAX_VERTS) return { kind: 'unsupported', reason: `a ${oh.outline.length}-sided outline is too fine to cover with wings` };

  const ext = extents(oh);
  for (let i = 0; i < oh.outline.length; i++) {
    const a = oh.outline[i], b = oh.outline[(i + 1) % oh.outline.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    if (L < 1e-9) return { kind: 'unsupported', reason: 'the outline has a zero-length edge' };
    // the edge's direction must lie on one of the two frame axes (within 2°)
    const wx = Math.abs(dot([dx / L, dz / L], ext.d));
    const wy = Math.abs(dot([dx / L, dz / L], ext.e));
    const off = Math.min(Math.acos(Math.min(1, wx)), Math.acos(Math.min(1, wy)));
    if (off > AXIS_TOL) return { kind: 'unsupported', reason: 'an outline edge is more than 2° off the roof frame' };
  }

  const sectionProblem = qualifySection(oh);
  if (sectionProblem) return { kind: 'unsupported', reason: sectionProblem };

  const samples = sampleProfile(oh.profile);
  const pk = profilePeak(oh.profile);

  // ---- grid: the plan's own coordinates, merged where they nearly coincide
  const grid = (vals: number[]) => {
    const s = vals.slice().sort((a, b) => a - b);
    const out: number[] = [];
    for (const x of s) if (!out.length || x - out[out.length - 1] > MERGE) out.push(x);
    if (out.length > 1 && s[s.length - 1] - out[out.length - 1] > 1e-6) out[out.length - 1] = s[s.length - 1];
    return out;
  };
  const W = grid(oh.outline.map((p) => dot(p, ext.d)));
  const V = grid(oh.outline.map((p) => dot(p, ext.e)));
  if (W.length < 2 || V.length < 2) return { kind: 'unsupported', reason: 'the outline has no extent' };
  const nw = W.length - 1, nv = V.length - 1;
  const inside: boolean[][] = [];
  for (let i = 0; i < nw; i++) {
    inside.push([]);
    for (let j = 0; j < nv; j++) {
      if (W[i + 1] - W[i] < MIN_CELL || V[j + 1] - V[j] < MIN_CELL) inside[i].push(false);
      else inside[i].push(pointInPoly(inWorld(ext, (W[i] + W[i + 1]) / 2, (V[j] + V[j + 1]) / 2), oh.outline));
    }
  }
  const cellArea = (i: number, j: number) => (W[i + 1] - W[i]) * (V[j + 1] - V[j]);
  let covered = 0;
  for (let i = 0; i < nw; i++) for (let j = 0; j < nv; j++) if (inside[i][j]) covered += cellArea(i, j);
  const footArea = Math.abs(polyArea(oh.outline));
  if (Math.abs(covered - footArea) > 0.1 + 1e-4 * footArea)
    return { kind: 'unsupported', reason: 'the plan is not made of rectangles along the roof frame' };

  // ---- every maximal rectangle of inside cells
  type R = { i0: number; i1: number; j0: number; j1: number };
  const rects: R[] = [];
  for (let i0 = 0; i0 < nw; i0++)
    for (let i1 = i0; i1 < nw; i1++)
      for (let j0 = 0; j0 < nv; j0++)
        for (let j1 = j0; j1 < nv; j1++) {
          let ok = true;
          for (let i = i0; i <= i1 && ok; i++) for (let j = j0; j <= j1 && ok; j++) if (!inside[i][j]) ok = false;
          if (!ok) continue;
          const growL = i0 > 0 && range(inside, i0 - 1, i0 - 1, j0, j1);
          const growR = i1 + 1 < nw && range(inside, i1 + 1, i1 + 1, j0, j1);
          const growD = j0 > 0 && range(inside, i0, i1, j0 - 1, j0 - 1);
          const growU = j1 + 1 < nv && range(inside, i0, i1, j1 + 1, j1 + 1);
          if (growL || growR || growD || growU) continue;
          rects.push({ i0, i1, j0, j1 });
        }
  const box = (r: R): [number, number, number, number] => [W[r.i0], W[r.i1 + 1], V[r.j0], V[r.j1 + 1]];
  const areaOf = (r: R) => (W[r.i1 + 1] - W[r.i0]) * (V[r.j1 + 1] - V[r.j0]);
  rects.sort((a, b) => {
    const A = areaOf(b) - areaOf(a);
    if (Math.abs(A) > 1e-9) return A;
    const ba = box(a), bb = box(b);
    return ba[0] - bb[0] || ba[2] - bb[2] || ba[1] - bb[1] || ba[3] - bb[3];
  });

  // ---- cover: largest first, and only where it adds uncovered cells
  const used: boolean[][] = Array.from({ length: nw }, () => new Array(nv).fill(false));
  const chosen: R[] = [];
  for (const r of rects) {
    let adds = false;
    for (let i = r.i0; i <= r.i1 && !adds; i++) for (let j = r.j0; j <= r.j1 && !adds; j++) if (!used[i][j]) adds = true;
    if (!adds) continue;
    for (let i = r.i0; i <= r.i1; i++) for (let j = r.j0; j <= r.j1; j++) used[i][j] = true;
    chosen.push(r);
  }
  for (let i = 0; i < nw; i++) for (let j = 0; j < nv; j++) if (inside[i][j] && !used[i][j]) return { kind: 'unsupported', reason: 'part of the plan was not covered' };
  if (chosen.length < 2) return { kind: 'single' };

  // ---- wings cover the plan once. The primary keeps its maximal rectangle; every later rectangle contributes only
  // what is still unroofed, so a wing's ridge ends where the roof it runs into begins (a valley), rather than being
  // carried through that roof to the far façade.
  const roofed: boolean[][] = Array.from({ length: nw }, () => new Array(nv).fill(false));
  const pieces: { r: R; source: R }[] = [{ r: chosen[0], source: chosen[0] }];
  for (let i = chosen[0].i0; i <= chosen[0].i1; i++) for (let j = chosen[0].j0; j <= chosen[0].j1; j++) roofed[i][j] = true;
  for (const r of chosen.slice(1)) {
    const left: boolean[][] = Array.from({ length: nw }, () => new Array(nv).fill(false));
    for (let i = r.i0; i <= r.i1; i++)
      for (let j = r.j0; j <= r.j1; j++) {
        if (!roofed[i][j]) left[i][j] = true;
        roofed[i][j] = true;
      }
    for (const f of maximalOf(left, W, V, nw, nv)) pieces.push({ r: f, source: r });
  }
  if (pieces.length > MAX_RECTS) return { kind: 'unsupported', reason: `the plan needs ${pieces.length} wings; at most ${MAX_RECTS} are supported` };
  for (const p of pieces) {
    const b = box(p.r);
    if (Math.min(b[1] - b[0], b[3] - b[2]) < MIN_SHORT) return { kind: 'unsupported', reason: 'a wing would be narrower than 1.2 m' };
  }
  const sources = pieces.map((p) => box(p.source));

  // ---- each wing spans its short side, and shares one pitch
  const primaryBox = box(pieces[0].r);
  const primarySpan = Math.min(primaryBox[1] - primaryBox[0], primaryBox[3] - primaryBox[2]);
  const nearSquare = (b: number[]) => {
    const s = Math.min(b[1] - b[0], b[3] - b[2]), l = Math.max(b[1] - b[0], b[3] - b[2]);
    return l - s <= 0.05 * l;
  };
  const spanOf = (b: number[], isPrimary: boolean): 'w' | 'v' => {
    if (nearSquare(b)) return isPrimary ? (Math.abs(primaryBox[1] - primaryBox[0]) <= Math.abs(primaryBox[3] - primaryBox[2]) ? 'w' : 'v') : 'w';
    return b[1] - b[0] <= b[3] - b[2] ? 'w' : 'v';
  };
  const refSpan = Math.max(...pieces.map((p, i) => {
    const b = box(p.r);
    return spanOf(b, i === 0) === 'w' ? b[1] - b[0] : b[3] - b[2];
  }));
  const wings: Wing[] = pieces.map((p, index) => {
    const b = box(p.r);
    const span = spanOf(b, index === 0);
    const spanLen = span === 'w' ? b[1] - b[0] : b[3] - b[2];
    return {
      index, rect: b, support: b.slice() as [number, number, number, number], span,
      scale: spanLen / Math.max(refSpan, 1e-9), ends: { lo: 'exposed', hi: 'exposed' }, hipLo: 0, hipHi: 0,
      area: (b[1] - b[0]) * (b[3] - b[2]),
    };
  });

  // ---- ends: only a full ridge end lying on the outline is exposed (and may hip)
  for (const wg of wings) {
    const b = wg.rect;
    for (const end of ['lo', 'hi'] as const) {
      const r0 = wg.span === 'w' ? b[2] : b[0], r1 = wg.span === 'w' ? b[3] : b[1];
      const at = end === 'lo' ? r0 : r1;
      const s0 = wg.span === 'w' ? b[0] : b[2], s1 = wg.span === 'w' ? b[1] : b[3];
      let onEdge = true;
      for (let k = 0; k <= 4; k++) {
        const s = s0 + ((s1 - s0) * k) / 4;
        const q = inWorld(ext, wg.span === 'w' ? s : at, wg.span === 'w' ? at : s);
        if (distToPolyEdge(q, oh.outline) > 0.02) {
          onEdge = false;
          break;
        }
      }
      wg.ends[end] = onEdge ? 'exposed' : 'joined';
      const hipLen = Math.min(Math.max(0, oh.hip ?? 0) * wg.scale, (r1 - r0) / 2);
      if (onEdge) {
        if (end === 'lo') wg.hipLo = hipLen;
        else wg.hipHi = hipLen;
      }
    }
  }

  // ---- joins: a secondary wing's ridge runs into the highest-ranked roof it overlaps
  for (const S of wings) {
    if (S.index === 0) continue;
    let O: Wing | null = null, best = 0;
    for (const T of wings) {
      if (T.index >= S.index) continue;
      // overlap of the maximal rectangles the wings came from: a trimmed wing still overlaps the roof it runs into
      const ov = rectOverlap(sources[S.index], sources[T.index]);
      if (ov > best + 1e-9) {
        best = ov;
        O = T;
      }
    }
    if (!O) continue;
    if (O.span !== S.span) {
      // perpendicular ridges: a ridge end that dies inside another roof is brought to that roof's ridge line, where
      // the roof above it is at its highest, so the surface does not step down at the join
      const oSpan = O.support;
      const oSpanLen = O.span === 'w' ? oSpan[1] - oSpan[0] : oSpan[3] - oSpan[2];
      const ridgeCoord = (O.span === 'w' ? oSpan[0] : oSpan[2]) + pk.u * oSpanLen;
      const alongW = S.span === 'v'; // S's ridge runs along w
      const k = alongW ? 0 : 2;
      const internal: ('lo' | 'hi')[] = [];
      if (S.ends.lo === 'joined') internal.push('lo');
      if (S.ends.hi === 'joined') internal.push('hi');
      if (internal.length > 1) return { kind: 'unsupported', reason: 'a wing would end inside another roof at both ends' };
      if (internal.length === 1) {
        const end = internal[0];
        // the support may reach past the wing's own rectangle, into the roof it runs into: that is where its
        // planes cut the other roof, and where a valley line is found
        S.support[end === 'lo' ? k : k + 1] = ridgeCoord;
        if (end === 'lo') S.hipLo = 0;
        else S.hipHi = 0;
      }
    } else {
      // parallel ridges: nothing is trimmed; an end that dies inside another wing cannot hip
      for (const end of ['lo', 'hi'] as const) {
        if (S.ends[end] === 'joined') {
          if (end === 'lo') S.hipLo = 0;
          else S.hipHi = 0;
        }
      }
    }
  }

  const norm = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);
  for (const wg of wings) {
    const [s0, s1] = norm(wg.support[0], wg.support[1]);
    const [t0, t1] = norm(wg.support[2], wg.support[3]);
    wg.support = [s0, s1, t0, t1];
  }

  const problem = validate(oh, wings, ext, samples, pk.u);
  if (problem) return { kind: 'unsupported', reason: problem };
  return { kind: 'compound', wings, primarySpan: refSpan, peakU: pk.u };
}

/** Every maximal rectangle of a mask of cells, largest first with coordinate ties (deterministic). */
function maximalOf(mask: boolean[][], W: number[], V: number[], nw: number, nv: number) {
  type R = { i0: number; i1: number; j0: number; j1: number };
  const out: R[] = [];
  const box = (r: R) => [W[r.i0], W[r.i1 + 1], V[r.j0], V[r.j1 + 1]];
  const area = (r: R) => (W[r.i1 + 1] - W[r.i0]) * (V[r.j1 + 1] - V[r.j0]);
  for (let i0 = 0; i0 < nw; i0++)
    for (let i1 = i0; i1 < nw; i1++)
      for (let j0 = 0; j0 < nv; j0++)
        for (let j1 = j0; j1 < nv; j1++) {
          let ok = true;
          for (let i = i0; i <= i1 && ok; i++) for (let j = j0; j <= j1 && ok; j++) if (!mask[i][j]) ok = false;
          if (!ok) continue;
          if (range(mask, i0 - 1, i0 - 1, j0, j1) || range(mask, i1 + 1, i1 + 1, j0, j1) || range(mask, i0, i1, j0 - 1, j0 - 1) || range(mask, i0, i1, j1 + 1, j1 + 1)) continue;
          out.push({ i0, i1, j0, j1 });
        }
  out.sort((a, b) => {
    const A = area(b) - area(a);
    if (Math.abs(A) > 1e-9) return A;
    const ba = box(a), bb = box(b);
    return ba[0] - bb[0] || ba[2] - bb[2] || ba[1] - bb[1] || ba[3] - bb[3];
  });
  // greedy cover of the mask, so overlapping maximal rectangles are not all taken
  const seen: boolean[][] = Array.from({ length: nw }, () => new Array(nv).fill(false));
  const picked: R[] = [];
  for (const r of out) {
    let adds = false;
    for (let i = r.i0; i <= r.i1 && !adds; i++) for (let j = r.j0; j <= r.j1 && !adds; j++) if (!seen[i][j]) adds = true;
    if (!adds) continue;
    for (let i = r.i0; i <= r.i1; i++) for (let j = r.j0; j <= r.j1; j++) seen[i][j] = true;
    picked.push(r);
  }
  return picked;
}

function inWorld(ext: Ext, w: number, v: number): V2 {
  return [ext.d[0] * w + ext.e[0] * v, ext.d[1] * w + ext.e[1] * v];
}

function range(m: boolean[][], i0: number, i1: number, j0: number, j1: number) {
  if (!m.length || i0 < 0 || j0 < 0 || i1 >= m.length || j1 >= m[0].length) return false;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!m[i][j]) return false;
  return true;
}

function rectOverlap(a: number[], b: number[]) {
  const w = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  const v = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[2], b[2]));
  return w * v;
}

/** Does this wing's ridge end lie on the outline (so it can hip)? */
function onFootprint(oh: Overhead, ext: Ext, wg: Wing, at: number) {
  const s0 = wg.span === 'w' ? wg.rect[0] : wg.rect[2];
  const s1 = wg.span === 'w' ? wg.rect[1] : wg.rect[3];
  for (let k = 0; k <= 4; k++) {
    const s = s0 + ((s1 - s0) * k) / 4;
    const q = inWorld(ext, wg.span === 'w' ? s : at, wg.span === 'w' ? at : s);
    if (distToPolyEdge(q, oh.outline) > 0.02) return false;
  }
  return true;
}

/** The shared section must be one ridge with two falling sides, eave to eave, symmetric so a rotated wing reads alike. */
function qualifySection(oh: Overhead): string | null {
  const pts = oh.profile;
  if (pts.length < 3) return 'the section has no ridge';
  for (let i = 1; i < pts.length; i++)
    if (Math.abs(pts[i].u - pts[i - 1].u) < 1e-6 && Math.abs(pts[i].h - pts[i - 1].h) >= 0.05)
      return 'a section with a step is not a compound candidate yet';
  if (pts[0].h > 0.05 || pts[pts.length - 1].h > 0.05) return 'the section does not meet the eave at both ends';
  const pk = profilePeak(pts);
  if (pk.h <= 0.2) return 'the section is flat';
  if (pk.i0 === 0 || pk.i1 === pts.length - 1) return 'the section has no ridge inside the span';
  const S = sampleProfile(pts);
  for (let i = 1; i < S.length; i++) {
    const before = S[i].u <= pk.u + 1e-9;
    if (before && S[i].h < S[i - 1].h - 1e-6) return 'the section has more than one crown';
    if (!before && S[i].h > S[i - 1].h + 1e-6) return 'the section has more than one crown';
  }
  for (let i = 0; i < 50; i++) {
    const u = i / 50;
    if (Math.abs(profileH(S, u) - profileH(S, 1 - u)) > 0.02) return 'the section is not symmetric; a wing rotated to the other axis would read differently';
  }
  return null;
}

/**
 * The one place continuity is decided. Every support edge that lies inside the footprint must end where this wing is
 * already the lower roof, and every covered cell must have a wing over it.
 */
function validate(oh: Overhead, wings: Wing[], ext: Ext, samples: PSample[], peakU: number): string | null {
  const hOf = (wg: Wing, q: V2) => wingHeight(wg, samples, peakU, ext, q);
  for (const wg of wings) {
    const [s0, s1, t0, t1] = wg.support;
    const edges: { a: [number, number]; b: [number, number] }[] = [
      { a: [s0, t0], b: [s1, t0] }, { a: [s1, t0], b: [s1, t1] },
      { a: [s1, t1], b: [s0, t1] }, { a: [s0, t1], b: [s0, t0] },
    ];
    for (const e of edges) {
      const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
      const n = Math.max(1, Math.ceil(L / 0.1));
      for (let k = 0; k <= n; k++) {
        const w = e.a[0] + ((e.b[0] - e.a[0]) * k) / n;
        const v = e.a[1] + ((e.b[1] - e.a[1]) * k) / n;
        const q = inWorld(ext, w, v);
        if (distToPolyEdge(q, oh.outline) < 1e-3) continue; // on the roof's own edge: nothing to match
        if (!pointInPoly(q, oh.outline)) continue;
        let other = -Infinity;
        for (const T of wings) if (T !== wg && covers(T.support, w, v)) other = Math.max(other, hOf(T, q));
        if (other === -Infinity) return `a wing ends inside the plan with no roof to meet (wing ${wg.index} at ${w.toFixed(2)}, ${v.toFixed(2)})`;
        if (hOf(wg, q) > other + 1e-6)
          return `a wing would end in a step where it is the higher roof (wing ${wg.index} at ${w.toFixed(2)}, ${v.toFixed(2)}: ${hOf(wg, q).toFixed(2)} over ${other.toFixed(2)})`;
      }
    }
  }
  // every part of the plan has a roof over it
  const b = bboxOf(oh.outline);
  for (let x = b.min[0] + 0.017; x < b.max[0]; x += 0.06)
    for (let z = b.min[1] + 0.023; z < b.max[1]; z += 0.06) {
      const q: V2 = [x, z];
      if (!pointInPoly(q, oh.outline)) continue;
      const w = dot(q, ext.d), v = dot(q, ext.e);
      if (!wings.some((wg) => covers(wg.support, w, v))) return 'part of the plan has no wing over it';
    }
  return null;
}

function bboxOf(pts: V2[]) {
  let min: V2 = [Infinity, Infinity], max: V2 = [-Infinity, -Infinity];
  for (const p of pts) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1])];
  }
  return { min, max };
}

const covers = (r: number[], w: number, v: number) => w >= r[0] - 1e-9 && w <= r[1] + 1e-9 && v >= r[2] - 1e-9 && v <= r[3] + 1e-9;

/** Height above the eave of one wing at a plan point, on its support. */
export function wingHeight(wg: Wing, samples: PSample[], peakU: number, ext: { d: V2; e: V2 }, q: V2): number {
  const w = dot(q, ext.d), v = dot(q, ext.e);
  if (!covers(wg.support, w, v)) return -Infinity;
  const s = wg.span === 'w' ? w : v;
  const r = wg.span === 'w' ? v : w;
  const s0 = wg.span === 'w' ? wg.rect[0] : wg.rect[2];
  const s1 = wg.span === 'w' ? wg.rect[1] : wg.rect[3];
  const r0 = wg.span === 'w' ? wg.rect[2] : wg.rect[0];
  const r1 = wg.span === 'w' ? wg.rect[3] : wg.rect[1];
  const u = clamp((s - s0) / Math.max(s1 - s0, 1e-9), 0, 1);
  let h = profileH(samples, u) * wg.scale;
  if (wg.hipLo > 1e-6 && r < r0 + wg.hipLo) h = Math.min(h, profileH(samples, clamp((r - r0) / wg.hipLo, 0, 1) * peakU) * wg.scale);
  else if (wg.hipHi > 1e-6 && r > r1 - wg.hipHi) h = Math.min(h, profileH(samples, clamp((r1 - r) / wg.hipHi, 0, 1) * peakU) * wg.scale);
  return h;
}

// ---- Continuity across a resize ----
// A wall move re-fits the outline and the decomposition is re-derived. If that would choose a different massing, the
// candidate is refused with a reason; the caller keeps its last valid preview and the roof never jumps to a new set
// of wings inside one gesture. Retaining the gesture-start decomposition instead of refusing is only allowed when it
// still covers the new outline exactly, which a pure function can prove here.

export interface WingContinuity {
  state: WingState;
  /** true when the gesture-start decomposition still describes this outline */
  kept: boolean;
  reason: string;
}

const near = (a: number, b: number, tol = 0.08) => Math.abs(a - b) <= tol;

/**
 * Whether the two decompositions are the same roof, with `shift` (in the roof frame) removed first: moving the whole
 * roof is not a change of massing, so a translated roof keeps its structure instead of being refused as a jump.
 */
function sameMassing(a: Wing[], b: Wing[], shift: [number, number]): boolean {
  if (a.length !== b.length) return false;
  return a.every((w, i) => {
    const q = b[i];
    if (w.span !== q.span || w.ends.lo !== q.ends.lo || w.ends.hi !== q.ends.hi) return false;
    return w.rect.every((x, k) => near(x + (k < 2 ? shift[0] : shift[1]), q.rect[k]));
  });
}

/** The outline's translation between two revisions, read in the roof's own frame. */
function frameShift(prev: Overhead, next: Overhead): [number, number] | null {
  if (Math.abs(prev.dir - next.dir) > 1e-9) return null;
  const a = bboxOf(prev.outline), b = bboxOf(next.outline);
  const d = fromAngle(prev.dir), e: V2 = [-d[1], d[0]];
  const delta: V2 = [(b.min[0] + b.max[0]) / 2 - (a.min[0] + a.max[0]) / 2, (b.min[1] + b.max[1]) / 2 - (a.min[1] + a.max[1]) / 2];
  return [dot(delta, d), dot(delta, e)];
}

/**
 * The decomposition to show for `next`, given the one the gesture started from.
 *
 * Only the *same massing* (same rectangles, spans and joined/exposed ends, within 8 cm) is kept: the new state is
 * returned, computed for the new outline, so scales and hips are fresh. Anything else is refused with a reason, and
 * the caller keeps its last valid preview. The gesture-start decomposition is deliberately not reused as geometry:
 * its scales and hip lengths belong to the old outline, so replaying it on a new one would be a stale roof wearing a
 * continuous-looking shape. A massing change is an owner-visible decision (Settings), never a side effect of a wall drag.
 */
export function continuedWings(prev: Overhead, next: Overhead): WingContinuity {
  const before = roofWingsState(prev);
  const after = roofWingsState(next);
  if (after.kind === 'single') {
    // A plan that has become one rectangle genuinely has no wings left. But a one-span cover appearing under a
    // compound roof — the legacy path — is a massing change, never something a wall drag may slip into.
    if (before.kind === 'compound' && next.oneSpan !== false)
      return {
        state: { kind: 'unsupported', reason: 'this would cover the plan as one span, a different massing; confirm it in Settings' },
        kept: false,
        reason: 'this would cover the plan as one span, a different massing; confirm it in Settings',
      };
    return { state: after, kept: true, reason: '' };
  }
  if (after.kind === 'unsupported') return { state: after, kept: false, reason: after.reason };
  const shift = before.kind === 'compound' ? frameShift(prev, next) : null;
  if (before.kind === 'compound' && shift && sameMassing(before.wings, after.wings, shift)) return { state: after, kept: true, reason: '' };
  if (before.kind !== 'compound')
    return { state: after, kept: false, reason: 'this roof would need wings it did not have; confirm a grouped cover first' };
  return {
    state: { kind: 'unsupported', reason: 'these walls would give the roof a different massing, so the last valid roof is kept' },
    kept: false,
    reason: 'these walls would give the roof a different massing, so the last valid roof is kept',
  };
}
