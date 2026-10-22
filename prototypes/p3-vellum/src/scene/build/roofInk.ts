// Ink from meaning: the lines a roof has because its regions mean different things, not because two triangles met.
//
// A group is a piece of roof surface with one meaning: (wing, surface, part). Every boundary between groups is a real
// line — a ridge, a hip, a valley, a crease, a step, or the roof's own edge. Boundaries *inside* a group are cell
// seams and cancel out (each is an edge of two facets of the same group); a join between two wings that is coplanar is
// not a line merely because the wing changed.
import { V2, dist, dot, distToPolyEdge, lerp2, pointInPoly } from '../../model/geom2d';
import type { MPoly } from '../../model/clip';
import type { Overhead } from '../../model/types';
import { readSection } from '../../model/section';

export type V3 = [number, number, number];

/** One planar piece of the top surface, tagged with what it means. */
export interface InkFacet {
  group: string;
  poly: MPoly;
  /** the piece's own height function: a curved group has many planes, never one representative plane */
  y: (p: V2) => number;
}

/** The plan axes and the lines the roof already breaks along, so ink never cuts a crease into a chord. */
export interface InkBreaks {
  d: V2;
  e: V2;
  ws: number[];
  vs: number[];
}

const MIN_SEG = 0.01; // 1 cm: anything shorter is a tessellation crumb, not a line
const STEP = 0.5; // m: longest unsupported run along a boundary (a curved group is followed, not chorded)
const FLAT_TOL = 0.005; // m
const FLAT_DEG = 2;
const KEY = 1e5; // 0.01 mm: clipper output agrees far more closely than this, so shared edges cancel reliably

/**
 * The section part a plan position belongs to, as an index into `readSection(oh.profile).joints`. Two pieces of roof
 * on the same part of the same wing mean the same thing; across a joint they do not.
 */
export function partIndexOf(oh: Overhead, u: number): number {
  const js = readSection(oh.profile).joints;
  if (js.length < 2) return 0;
  for (let i = 0; i + 1 < js.length; i++) {
    const a = js[i].u, b = js[i + 1].u;
    if (u >= a - 1e-9 && u <= b + 1e-9) {
      // a vertical step repeats an id-position: its lower and upper sides are different parts
      if (Math.abs(u - a) < 1e-9 && i > 0) continue;
      return i;
    }
  }
  return js.length - 2;
}

interface Seg {
  a: V3;
  b: V3;
}

interface Edge {
  a: V2;
  b: V2;
  facet: InkFacet;
  key: string;
}

/** Semantic ink for an extruded roof: every group boundary, plus the fascia's bottom edge and its turned corners. */
export function roofInk(facets: InkFacet[], breaks: InkBreaks, bottom: (p: V2) => number, foot: MPoly, thick: number): number[] {
  const segs: Seg[] = [];
  const idx = new FacetIndex(facets);
  const groups = new Map<string, InkFacet[]>();
  for (const f of facets) {
    const g = groups.get(f.group);
    if (g) g.push(f);
    else groups.set(f.group, [f]);
  }
  for (const [, fs] of groups) {
    if (!fs.length) continue;
    for (const e of boundaries(fs)) {
      const pts = [e.a, ...splitEdge(e.a, e.b, breaks), e.b];
      for (let i = 0; i + 1 < pts.length; i++) emit(pts[i], pts[i + 1], e.facet, idx, segs);
    }
  }
  // the roof's edge: the underside of the fascia, and a short vertical wherever the outline turns a real corner
  for (const poly of foot) {
    for (const ring of poly) {
      if (ring.length < 2) continue;
      const pts: V2[] = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        pts.push(a, ...splitEdge(a, b, breaks));
      }
      pts.push(ring[0]);
      for (let i = 0; i + 1 < pts.length; i++) {
        const y0 = bottom(pts[i]), y1 = bottom(pts[i + 1]);
        segs.push({ a: [pts[i][0], y0, pts[i][1]], b: [pts[i + 1][0], y1, pts[i + 1][1]] });
      }
      for (let i = 0; i < ring.length; i++) {
        const a = ring[(i - 1 + ring.length) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
        if (!turns(a, b, c)) continue;
        const y0 = bottom(b);
        segs.push({ a: [b[0], y0, b[1]], b: [b[0], y0 + thick, b[1]] });
      }
    }
  }
  return dedupe(segs);
}

/**
 * A group's boundary: the edges of its facets that no other facet of the same group shares. Cells, rows and envelope
 * pieces inside a group tile each other, so their shared edges cancel exactly; what is left is where the meaning
 * changes. This is what a union of the group would give, at a fraction of the cost on a compound roof.
 */
function boundaries(fs: InkFacet[]): Edge[] {
  const count = new Map<string, number>();
  const edges: Edge[] = [];
  for (const f of fs)
    for (const poly of f.poly)
      for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          if (dist(a, b) < 1e-9) continue;
          const ka = pkey(a), kb = pkey(b);
          const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          count.set(key, (count.get(key) ?? 0) + 1);
          edges.push({ a, b, facet: f, key });
        }
      }
  return edges.filter((e) => count.get(e.key) === 1);
}

const pkey = (q: V2) => `${Math.round(q[0] * KEY)},${Math.round(q[1] * KEY)}`;

/** Lift one fragment with the facet it belongs to (planar, so the endpoints are exact), unless it is not a line. */
function emit(a: V2, b: V2, f: InkFacet, idx: FacetIndex, out: Seg[]) {
  if (dist(a, b) < 1e-4) return;
  const m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (notALine(m, a, b, f, idx)) return;
  out.push({ a: [a[0], f.y(a), a[1]], b: [b[0], f.y(b), b[1]] });
}

/**
 * A join between two wings that is genuinely continuous — the same height and the same plane on both sides — is not
 * ink. A tangent join (same height, different slope) is a crease and stays; a step keeps both its heights. And an edge
 * whose both sides are the same group is an interior seam that failed to cancel, never a line.
 */
function notALine(mid: V2, x: V2, y: V2, f: InkFacet, idx: FacetIndex): boolean {
  const dx = y[0] - x[0], dz = y[1] - x[1];
  const L = Math.hypot(dx, dz);
  if (L < 1e-9) return false;
  const nx = dz / L, nz = -dx / L;
  const off = 0.04;
  const f1 = idx.at([mid[0] + nx * off, mid[1] + nz * off]);
  const f2 = idx.at([mid[0] - nx * off, mid[1] - nz * off]);
  if (f1 && f2 && f1.group === f.group && f2.group === f.group) return true;
  if (!f1 || !f2 || f1.group === f2.group) return false;
  const ya = f.y(mid);
  if (Math.abs(f1.y(mid) - ya) > FLAT_TOL || Math.abs(f2.y(mid) - ya) > FLAT_TOL) return false;
  const n1 = normalAt(f1.y, mid), n2 = normalAt(f2.y, mid);
  return n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] > Math.cos((FLAT_DEG * Math.PI) / 180);
}

/** Interior points on a→b where a break line or the 0.5 m rule falls, in order. */
function splitEdge(a: V2, b: V2, breaks: InkBreaks): V2[] {
  const cuts: [number, V2][] = [];
  const add = (t: number) => {
    if (t > 1e-6 && t < 1 - 1e-6) cuts.push([t, lerp2(a, b, t)]);
  };
  const wa = dot(a, breaks.d), wb = dot(b, breaks.d);
  if (Math.abs(wb - wa) > 1e-9) for (const w of breaks.ws) add((w - wa) / (wb - wa));
  const va = dot(a, breaks.e), vb = dot(b, breaks.e);
  if (Math.abs(vb - va) > 1e-9) for (const v of breaks.vs) add((v - va) / (vb - va));
  const n = Math.max(1, Math.ceil(dist(a, b) / STEP));
  for (let k = 1; k < n; k++) add(k / n);
  cuts.sort((x, y) => x[0] - y[0]);
  const out: V2[] = [];
  for (const [, p] of cuts) if (!out.length || dist(out[out.length - 1], p) > 1e-5) out.push(p);
  return out;
}

function normalAt(y: (p: V2) => number, p: V2): V3 {
  const e = 0.05;
  const gx = (y([p[0] + e, p[1]]) - y([p[0] - e, p[1]])) / (2 * e);
  const gz = (y([p[0], p[1] + e]) - y([p[0], p[1] - e])) / (2 * e);
  const n: V3 = [-gx, 1, -gz];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** The same line found from both sides is one line; shorter than 1 cm is not a line at all. */
function dedupe(segs: Seg[]): number[] {
  const key = (p: V3) => `${Math.round(p[0] * 1e3)},${Math.round(p[1] * 1e3)},${Math.round(p[2] * 1e3)}`;
  const seen = new Set<string>();
  const out: number[] = [];
  for (const s of segs) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
    if (len < MIN_SEG) continue;
    const ka = key(s.a), kb = key(s.b);
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2]);
  }
  return out;
}

/** Whether the outline turns a real corner at b: a shallower bend than 20° is a smooth edge, not a vertical. */
function turns(a: V2, b: V2, c: V2): boolean {
  const ux = b[0] - a[0], uz = b[1] - a[1];
  const vx = c[0] - b[0], vz = c[1] - b[1];
  const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
  if (lu < 1e-6 || lv < 1e-6) return false;
  const cos = (ux * vx + uz * vz) / (lu * lv);
  return cos < Math.cos((20 * Math.PI) / 180);
}

/**
 * A one-metre plan grid over the facets, so asking "which piece of roof is here?" stays cheap on a compound roof
 * with thousands of pieces. A piece too large to insert per cell is also kept in a short global list.
 */
class FacetIndex {
  private cells = new Map<string, InkFacet[]>();
  private big: InkFacet[] = [];

  constructor(fs: InkFacet[], private size = 1) {
    for (const f of fs) {
      for (const poly of f.poly) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const q of ring) {
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
          z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]);
        }
        const i0 = Math.floor(x0 / size), i1 = Math.floor(x1 / size);
        const j0 = Math.floor(z0 / size), j1 = Math.floor(z1 / size);
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 256) {
          this.big.push(f);
          continue;
        }
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const k = `${i},${j}`;
            const list = this.cells.get(k);
            if (list) list.push(f);
            else this.cells.set(k, [f]);
          }
      }
    }
  }

  at(p: V2): InkFacet | null {
    const list = this.cells.get(`${Math.floor(p[0] / this.size)},${Math.floor(p[1] / this.size)}`);
    if (list) for (const f of list) if (covers(f, p)) return f;
    for (const f of this.big) if (covers(f, p)) return f;
    return null;
  }
}

/** A boundary point lies ON a facet's ring, where a plain ray cast is ambiguous: read it as inside. */
function covers(f: InkFacet, p: V2): boolean {
  for (const poly of f.poly) {
    const ring = poly[0];
    if (ring && ring.length >= 3 && (pointInPoly(p, ring) || distToPolyEdge(p, ring) < 1e-6)) return true;
  }
  return false;
}
