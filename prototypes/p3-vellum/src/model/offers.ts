// Offers: an automatic mezzanine or stair is only offered when a candidate actually qualifies. Pure and
// deterministic — the same project revision gives the same candidates in the same order, so a preview, a click and
// an amended reading all use one set. These are fit heuristics for the prototype, not construction-code claims.
//
// Phase 0 decisions (proven in tests/offers.test.ts):
//   · the offer is qualified from the real overhead surface, sampled over the *whole* footprint, including roof
//     breaks and corners: a gable's peak is not evidence for its eaves;
//   · 4.80 m is a floor-to-roof bound that rejects early, never a proof;
//   · a stair must reach the deck edge with its full width and land on a floor, not merely on "ground somewhere".
import { V2, add, mul, sub, norm, perp, lerp2, dist, pointInPolyHoles, polyArea, bbox, rdpIdx, segIntersect, polyCentroid, interiorPoint } from './geom2d';
import type { Project, Overhead, SurfaceRef } from './types';
import { P, difference, intersection, mpolyArea, type MPoly } from './clip';
import { derive } from './derive';
import { ohCovers, ohUndersideAt, ohFrame } from './overheadGeom';
import { runGeom } from './runs';

export const DECK_THICK = 0.3;
export const MIN_BELOW = 2.4; // clear height under the slab
export const MIN_ABOVE = 2.1; // clear height over the deck
export const MIN_AREA = 5.0; // m² of connected usable floor
export const MIN_SIDE = 2.0; // m, the shorter side of the usable rectangle
export const MIN_NECK = 1.2; // m, the widest square that must fit inside the usable area
export const STAIR_WIDTH = 1.3;
export const STAIR_SLOPE = 1.6; // run per metre of rise
const STEP = 0.3; // plan sampling step, m

export interface StairPlan {
  id: string;
  path: V2[];
  from: SurfaceRef;
  to: SurfaceRef;
  fromY: number;
  toY: number;
  width: number;
  landing: V2;
}

export interface MezzCandidate {
  id: string;
  roomId: string;
  outline: V2[];
  y: number;
  thick: number;
  depth: number;
  below: number;
  above: number;
  area: number;
  stair: StairPlan;
}

export interface MezzCheck {
  candidates: MezzCandidate[];
  why: string;
}

export const deckTopFor = (floorY: number) => Math.round((floorY + MIN_BELOW + DECK_THICK) * 100) / 100;

// ------------------------------------------------------------------ sampling the real surfaces
function overheadsAbove(p: Project, at: V2): Overhead[] {
  return p.overheads.filter((oh) => ohCovers(oh, at));
}

/** The lowest overhead clearly above `y`, or null under open sky. */
export function lowestOverheadAbove(p: Project, at: V2, y: number): Overhead | null {
  let best: Overhead | null = null;
  let by = Infinity;
  for (const oh of overheadsAbove(p, at)) {
    const u = ohUndersideAt(oh, at);
    if (u <= y + 0.02 || u >= by) continue;
    best = oh;
    by = u;
  }
  return best;
}

/** The overhead that forms the ceiling over `at` at or above `y` (the covering roof, not a canopy below it). */
export function overheadAt(p: Project, at: V2, y: number): Overhead | null {
  return lowestOverheadAbove(p, at, y);
}

function planSamples(outline: V2[], step = STEP): V2[] {
  const { min, max } = bbox(outline);
  const out: V2[] = [];
  for (let x = min[0] + step / 2; x <= max[0]; x += step)
    for (let z = min[1] + step / 2; z <= max[1]; z += step) {
      const q: V2 = [x, z];
      if (pointInPolyHoles(q, outline)) out.push(q);
    }
  for (const q of outline) out.push(q);
  return out;
}

function clearanceOver(p: Project, outline: V2[], y: number, ceilingY: number | null): number {
  let min = Infinity;
  for (const q of planSamples(outline)) {
    const oh = lowestOverheadAbove(p, q, y);
    const top = oh ? Math.min(ohUndersideAt(oh, q), ceilingY ?? Infinity) : ceilingY ?? Infinity;
    min = Math.min(min, top - y);
  }
  return min;
}

// ------------------------------------------------------------------ footprint helpers
function strip(room: V2[], axis: V2, end: 0 | 1, depth: number): V2[] {
  const n = perp(axis);
  let sMin = Infinity, sMax = -Infinity, tMin = Infinity, tMax = -Infinity;
  for (const q of room) {
    const s = q[0] * axis[0] + q[1] * axis[1];
    const t = q[0] * n[0] + q[1] * n[1];
    sMin = Math.min(sMin, s); sMax = Math.max(sMax, s);
    tMin = Math.min(tMin, t); tMax = Math.max(tMax, t);
  }
  const s0 = end === 0 ? sMin - 0.05 : sMax - depth;
  const s1 = end === 0 ? sMin + depth : sMax + 0.05;
  const at = (s: number, t: number): V2 => add(mul(axis, s), mul(n, t));
  return [at(s0, tMin - 0.05), at(s1, tMin - 0.05), at(s1, tMax + 0.05), at(s0, tMax + 0.05)];
}

function biggest(m: MPoly): MPoly {
  let best: MPoly = [];
  let a = 0;
  for (const poly of m) {
    const k = Math.abs(polyArea(poly[0])) - poly.slice(1).reduce((s, h) => s + Math.abs(polyArea(h)), 0);
    if (k > a) { a = k; best = [poly]; }
  }
  return best;
}

function simplify(ring: V2[]): V2[] {
  if (ring.length < 5) return ring;
  const idx = rdpIdx([...ring, ring[0]], 0.02).filter((k) => k < ring.length);
  return idx.length >= 3 ? idx.map((k) => ring[k]) : ring;
}

function footprintIn(p: Project, room: V2[], holes: V2[][], region: V2[], y: number, floorY: number): MPoly {
  let m = intersection(P(room, holes), P(region));
  const cuts: MPoly[] = [];
  for (const v of p.voids) {
    if (v.toY < floorY + 0.1 || v.fromY > y + MIN_ABOVE) continue;
    cuts.push(P(v.outline));
  }
  for (const d of p.decks) {
    const lo = d.y - d.thick, hi = d.y;
    if (hi < floorY + 0.1 || lo > y + MIN_ABOVE) continue;
    cuts.push(P(d.outline));
  }
  if (cuts.length) m = difference(m, ...cuts);
  const big = biggest(m);
  if (!big.length || big[0].length > 1) return []; // a footprint with a hole is not a deck outline this can express
  const ring = simplify(big[0][0]);
  return ring.length >= 3 ? [[ring]] : [];
}

function footprintOf(p: Project, room: V2[], holes: V2[][], axis: V2, end: 0 | 1, depth: number, y: number, floorY: number): MPoly {
  return footprintIn(p, room, holes, strip(room, axis, end, depth), y, floorY);
}

/** Lattice step and headroom margin for the clear-floor scan, m. */
const CLEAR_STEP = 0.25;
const CLEAR_MARGIN = 0.12;

/**
 * Floor rectangles with `MIN_ABOVE` of clear height over a deck at `y`, in a room's own axis frame.
 *
 * The end strips below only try the room's two ends at full width, so a roof whose clear floor sits in the middle
 * (a steep gable's ridge band, with hips cutting the ends) was rejected as having no headroom at all. This scan finds
 * the rectangular lofts that actually fit, maximal ones first, and the ordinary qualification still decides.
 */
function clearRectsFor(
  p: Project,
  room: { poly: V2[]; holes: V2[][] },
  axis: V2,
  y: number,
  floorY: number,
  ceilingY: number | null,
): V2[][] {
  const n = perp(axis);
  let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (const q of room.poly) {
    const s = q[0] * axis[0] + q[1] * axis[1], t = q[0] * n[0] + q[1] * n[1];
    s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t);
  }
  const ns = Math.max(1, Math.round((s1 - s0) / CLEAR_STEP));
  const nt = Math.max(1, Math.round((t1 - t0) / CLEAR_STEP));
  const ds = (s1 - s0) / ns, dt = (t1 - t0) / nt;
  const blocked = (q: V2, y: number): boolean => {
    for (const v of p.voids)
      if (!(v.toY < floorY + 0.1 || v.fromY > y + MIN_ABOVE) && pointInPolyHoles(q, v.outline)) return true;
    for (const d of p.decks)
      if (!(d.y < floorY + 0.1 || d.y - d.thick > y + MIN_ABOVE) && pointInPolyHoles(q, d.outline)) return true;
    return false;
  };
  const clear = (i: number, j: number): boolean => {
    const q = add(mul(axis, s0 + (i + 0.5) * ds), mul(n, t0 + (j + 0.5) * dt));
    if (!pointInPolyHoles(q, room.poly) || blocked(q, y)) return false;
    const oh = lowestOverheadAbove(p, q, y);
    const top = oh ? Math.min(ohUndersideAt(oh, q), ceilingY ?? Infinity) : ceilingY ?? Infinity;
    // a margin, so a rectangle cut on this lattice still clears at its own edges (the offer re-samples them)
    return top - y >= MIN_ABOVE + CLEAR_MARGIN - 1e-6;
  };
  const heights = new Array<number>(ns).fill(0);
  const found: { s0: number; s1: number; t0: number; t1: number; area: number }[] = [];
  const seen = new Set<string>();
  for (let j = 0; j < nt; j++) {
    for (let i = 0; i < ns; i++) heights[i] = clear(i, j) ? heights[i] + 1 : 0;
    const stack: number[] = [];
    for (let i = 0; i <= ns; i++) {
      const h = i === ns ? 0 : heights[i];
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const k = stack.pop()!;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const w = i - left, hh = heights[k];
        if (!hh || !w) continue;
        const key = `${left}:${i}:${j - hh + 1}:${j + 1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ s0: left, s1: i, t0: j - hh + 1, t1: j + 1, area: w * hh });
      }
      stack.push(i);
    }
  }
  // metre-sized, generous enough to be worth testing, biggest first
  return found
    .filter((r) => r.area * ds * dt >= MIN_AREA)
    .sort((a, b) => b.area - a.area || a.t0 - b.t0 || a.s0 - b.s0)
    .slice(0, 10)
    .map((r) => {
      // half a cell inside the clear cells, so the rectangle's boundary is clear too
      const at = (s: number, t: number): V2 => add(mul(axis, s0 + s * ds), mul(n, t0 + t * dt));
      const a = r.s0 + 0.5, b = r.s1 - 0.5, c = r.t0 + 0.5, d = r.t1 - 0.5;
      return [at(a, c), at(b, c), at(b, d), at(a, d)];
    });
}

/** A `len`-long band at one end of a clear rectangle, keeping its full cross extent; null when nothing is left. */
function bandAt(rect: V2[], axis: V2, end: 0 | 1, len: number): V2[] | null {
  const n = perp(axis);
  let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
  for (const q of rect) {
    const s = q[0] * axis[0] + q[1] * axis[1], t = q[0] * n[0] + q[1] * n[1];
    s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t);
  }
  const w = Math.min(len, s1 - s0);
  if (s1 - s0 - w < 0.5) return null; // a band as long as the clear length leaves nowhere for the stair to come from
  const a = end === 0 ? s0 : s1 - w;
  const at = (s: number, t: number): V2 => add(mul(axis, s), mul(n, t));
  return [at(a, t0), at(a + w, t0), at(a + w, t1), at(a, t1)];
}

/** Connected usable cells, with the 2.0×2.5 m and no-neck tests. */
function usable(ring: V2[]): { area: number; ok: boolean } {
  const { min, max } = bbox(ring);
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / STEP));
  const nz = Math.max(1, Math.ceil((max[1] - min[1]) / STEP));
  const inside = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const q: V2 = [min[0] + (i + 0.5) * STEP, min[1] + (j + 0.5) * STEP];
      if (pointInPolyHoles(q, ring)) inside[i * nz + j] = 1;
    }
  const seen = new Uint8Array(nx * nz);
  let best = 0;
  let bestCells: V2[] = [];
  const cell = (i: number, j: number): V2 => [min[0] + (i + 0.5) * STEP, min[1] + (j + 0.5) * STEP];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const s = i * nz + j;
      if (!inside[s] || seen[s]) continue;
      const stack = [s];
      seen[s] = 1;
      const cells: V2[] = [];
      while (stack.length) {
        const k = stack.pop()!;
        const ci = Math.floor(k / nz), cj = k % nz;
        cells.push(cell(ci, cj));
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const ii = ci + di, jj = cj + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const kk = ii * nz + jj;
          if (inside[kk] && !seen[kk]) { seen[kk] = 1; stack.push(kk); }
        }
      }
      const area = cells.length * STEP * STEP;
      if (area > best) { best = area; bestCells = cells; }
    }
  if (!bestCells.length) return { area: 0, ok: false };
  const bb = bbox(bestCells);
  const w = bb.max[0] - bb.min[0] + STEP, d = bb.max[1] - bb.min[1] + STEP;
  const square = Math.ceil(MIN_NECK / STEP);
  let wide = false;
  for (const q of bestCells) {
    let all = true;
    for (let i = 0; i < square && all; i++)
      for (let j = 0; j < square && all; j++) {
        const s: V2 = [q[0] + i * STEP, q[1] + j * STEP];
        if (!pointInPolyHoles(s, ring)) all = false;
      }
    if (all) { wide = true; break; }
  }
  return { area: best, ok: best >= MIN_AREA && Math.min(w, d) >= MIN_SIDE && wide };
}

// ------------------------------------------------------------------ stairs
function wallSegments(p: Project, y0: number, y1: number): V2[][] {
  const out: V2[][] = [];
  for (const r of p.runs) {
    if (r.baseY > y1 + 0.05 || r.baseY + (r.top ?? 3) < y0 - 0.05) continue;
    const g = runGeom(r).ps;
    for (let i = 0; i + 1 < g.pts.length; i++) out.push([g.pts[i], g.pts[i + 1]]);
  }
  return out;
}

function swept(path: V2[], width: number): V2[] {
  const left: V2[] = [], right: V2[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const n = norm(perp(sub(b, a)));
    left.push(add(path[i], mul(n, width / 2)));
    right.push(add(path[i], mul(n, -width / 2)));
  }
  return [...left, ...right.reverse()];
}

function crossesWall(path: V2[], walls: V2[][]): boolean {
  for (const [a, b] of walls)
    for (let i = 0; i + 1 < path.length; i++) {
      const hit = segIntersect(path[i], path[i + 1], a, b);
      // the wall the stair leaves from is allowed: its foot is the deck edge
      if (hit && dist(hit.p, path[path.length - 1]) >= 0.45) return true;
    }
  return false;
}

/**
 * Stair plans onto a deck from the floor below: a straight run `rise · 1.6` long that reaches the deck edge with
 * full width, lands on a real floor and has clear headroom the whole way.
 */
export function stairPlansFor(p: Project, outline: V2[], deckY: number, floorY: number, excludeDeck?: string): StairPlan[] {
  const d = derive(p);
  const rise = deckY - floorY;
  if (rise < 0.6) return [];
  const L = Math.max(1.2, rise * STAIR_SLOPE);
  const plans: StairPlan[] = [];
  const walls = wallSegments(p, floorY + 0.1, deckY);
  const inside = (q: V2) => pointInPolyHoles(q, outline);
  const edges = outline.map((a, i) => [a, outline[(i + 1) % outline.length]] as [V2, V2]);
  for (let e = 0; e < edges.length; e++) {
    const [a, b] = edges[e];
    const long = dist(a, b);
    if (long < STAIR_WIDTH + 0.8) continue;
    const mid = lerp2(a, b, 0.5);
    let n = norm(perp(sub(b, a)));
    if (inside(add(mid, mul(n, 0.2)))) n = mul(n, -1);
    for (const t of [0.5, 0.28, 0.72]) {
      const edge = lerp2(a, b, t);
      const top = add(edge, mul(n, -0.35)); // the top tread sits on the deck
      const bottom = add(top, mul(n, L));
      const path = [bottom, top];
      const land = d.rooms.find((r) => pointInPolyHoles(bottom, r.poly, r.holes) && Math.abs(r.floorY - floorY) < 0.15);
      if (!land) continue;
      const plan: StairPlan = {
        id: `stair:${e}:${t.toFixed(2)}`,
        path,
        from: { kind: 'room', id: land.id },
        to: { kind: 'deck', id: excludeDeck ?? '' },
        fromY: floorY,
        toY: deckY,
        width: STAIR_WIDTH,
        landing: bottom,
      };
      const foot = swept(path, STAIR_WIDTH);
      // support: the whole sweep stands over the lower floor, not merely the bottom point
      if (!foot.every((q) => pointInPolyHoles(q, land.poly, land.holes))) continue;
      // walls, voids, other slabs
      if (crossesWall(path, walls)) continue;
      if (p.voids.some((v) => v.toY > floorY && v.fromY < deckY && overlap(foot, v.outline))) continue;
      if (p.decks.some((k) => k.id !== excludeDeck && k.y - k.thick < deckY && k.y > floorY && overlap(foot, k.outline))) continue;
      // headroom over the run
      let clear = true;
      for (let i = 0; i <= 10 && clear; i++) {
        const q = lerp2(bottom, top, i / 10);
        const y = floorY + (rise * i) / 10;
        const oh = lowestOverheadAbove(p, q, y);
        if (oh && ohUndersideAt(oh, q) - y < 2.0) clear = false;
        // the run must not climb through the slab it serves
        if (i < 8 && y < deckY - 0.4 && pointInPolyHoles(q, outline)) clear = false;
      }
      if (!clear) continue;
      // the top reaches the deck, and the run is straight
      if (!inside(top) || dist(polyCentroid(outline), top) < 0.1) continue;
      plans.push(plan);
    }
  }
  return plans.slice(0, 3);
}

function overlap(a: V2[], b: V2[]): boolean {
  return mpolyArea(intersection(P(a), P(b))) > 0.05;
}

// ------------------------------------------------------------------ the mezzanine offer
function axesOf(room: V2[], ridgeDir: number | null): V2[] {
  const out: V2[] = [];
  const push = (a: V2) => {
    const q = norm(a);
    if (!out.some((o) => Math.abs(o[0] * q[1] - o[1] * q[0]) < 0.02 && o[0] * q[0] + o[1] * q[1] > 0)) out.push(q);
  };
  let longest: [V2, number] = [[1, 0], 0];
  for (let i = 0; i < room.length; i++) {
    const a = room[i], b = room[(i + 1) % room.length];
    const L = dist(a, b);
    if (L > longest[1]) longest = [sub(b, a), L];
  }
  push(longest[0]);
  if (ridgeDir !== null) push([Math.cos(ridgeDir), Math.sin(ridgeDir)]);
  if (out.length < 2) push(perp(out[0]));
  return out.slice(0, 2);
}

/**
 * Qualified mezzanine candidates for one room. Empty when none qualifies; `mezzanineOffer` carries the reason.
 */
export function mezzanineOffer(p: Project, roomId: string): MezzCheck {
  const d = derive(p);
  const room = d.rooms.find((r) => r.id === roomId);
  if (!room) return { candidates: [], why: 'That room is not there any more.' };
  const seed = p.rooms.find((r) => r.id === roomId)!;
  if (room.coveredBy == null) return { candidates: [], why: 'Needs a roof over it before a mezzanine makes sense.' };
  const ceilingY = seed.ceiling === 'flat' ? room.topY : null;
  const oh = p.overheads.find((o) => o.id === room.coveredBy) ?? null;
  const f = oh ? ohFrame(oh) : null;
  const ridgeDir = oh && oh.form === 'extrude' && !oh.oneSpan && f ? Math.atan2(f.d[1], f.d[0]) + Math.PI / 2 : null;
  const axes = axesOf(room.poly, ridgeDir);
  const baseY = deckTopFor(room.floorY);
  const heights = [baseY, baseY + 0.3];
  const L = Math.max(...axes.map((a) => {
    let mn = Infinity, mx = -Infinity;
    for (const q of room.poly) { const s = q[0] * a[0] + q[1] * a[1]; mn = Math.min(mn, s); mx = Math.max(mx, s); }
    return mx - mn;
  }));
  const depths = [...new Set([Math.max(2.5, 0.35 * L), Math.min(0.5 * L, Math.max(2.5, 0.35 * L) + 1.5)].map((x) => Math.round(x * 100) / 100))];
  const out: MezzCandidate[] = [];
  /** One qualified loft at `y`; every rejection leaves the project untouched and says nothing. */
  const qualified = (ring: V2[], y: number, id: string) => {
    if (Math.abs(polyArea(ring)) < MIN_AREA) return;
    const u = usable(ring);
    if (!u.ok) return;
    const below = Math.round((y - DECK_THICK - room.floorY) * 1000) / 1000;
    if (below < MIN_BELOW - 1e-6) return;
    const above = clearanceOver(p, ring, y, ceilingY);
    if (!Number.isFinite(above) || above < MIN_ABOVE - 1e-6) return;
    const stairs = stairPlansFor(p, ring, y, room.floorY);
    if (!stairs.length) return;
    if (out.some((c) => c.id === id)) return;
    const ext = axes.map((a) => {
      let mn = Infinity, mx = -Infinity;
      for (const q of ring) { const s = q[0] * a[0] + q[1] * a[1]; mn = Math.min(mn, s); mx = Math.max(mx, s); }
      return mx - mn;
    });
    const depth = Math.round(Math.min(...ext) * 100) / 100;
    out.push({ id, roomId, outline: ring, y, thick: DECK_THICK, depth, below, above: Math.round(above * 1000) / 1000, area: Math.round(u.area * 10) / 10, stair: stairs[0] });
  };
  for (let ai = 0; ai < axes.length; ai++) {
    const axis = axes[ai];
    for (const end of [0, 1] as const) {
      for (const depth of depths) {
        for (const y of heights) {
          const fp = footprintOf(p, room.poly, room.holes, axis, end, depth, y, room.floorY);
          if (!fp.length) continue;
          qualified(fp[0][0], y, `mezz:${roomId}:${ai}:${end}:${depth}:${y}`);
        }
      }
    }
    // and the lofts the end strips cannot see: the clear floor found anywhere in the room, and bands taken from
    // its ends so a stair can still approach along the loft (a band spanning the whole clear length has no
    // approach at either end, which is how the cottage's ridge band was being missed)
    for (const y of heights) {
      for (const rect of clearRectsFor(p, room, axis, y, room.floorY, ceilingY).slice(0, 2)) {
        const bands = [rect];
        for (const end of [0, 1] as const)
          for (const len of [3.0, 4.0, 5.0, 6.0]) {
            const b = bandAt(rect, axis, end, len);
            if (b) bands.push(b);
          }
        for (const region of bands) {
          const fp = footprintIn(p, room.poly, room.holes, region, y, room.floorY);
          if (!fp.length) continue;
          const ring = fp[0][0];
          const c = ring.reduce((a, q) => add(a, q), [0, 0] as V2);
          qualified(ring, y, `mezz:${roomId}:q${ai}:${y}:${Math.round((c[0] / ring.length) * 2)}:${Math.round((c[1] / ring.length) * 2)}`);
        }
      }
    }
  }
  // stable order: most useful first, never by insertion accident
  out.sort((a, b) => b.area - a.area || b.above - a.above || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen: MezzCandidate[] = [];
  for (const c of out) {
    if (seen.some((k) => mpolyArea(intersection(P(k.outline), P(c.outline))) > 0.7 * mpolyArea(P(c.outline)))) continue;
    seen.push(c);
    if (seen.length === 3) break;
  }
  if (!seen.length) return { candidates: [], why: 'Needs more headroom over a usable floor area.' };
  return { candidates: seen, why: '' };
}

export function mezzanineCandidates(p: Project, roomId: string): MezzCandidate[] {
  return mezzanineOffer(p, roomId).candidates;
}

/** Stair offers onto an existing deck, in a stable order. */
export function stairCandidates(p: Project, deckId: string): StairPlan[] {
  const deck = p.decks.find((x) => x.id === deckId);
  if (!deck) return [];
  const d = derive(p);
  const at = interiorPoint(deck.outline);
  const under = d.rooms.filter((r) => pointInPolyHoles(at, r.poly, r.holes)).sort((a, b) => b.floorY - a.floorY);
  const floorY = under.length ? under[0].floorY : null;
  if (floorY === null) return [];
  return stairPlansFor(p, deck.outline, deck.y, floorY, deck.id).map((s) => ({ ...s, to: { kind: 'deck', id: deck.id } }));
}
