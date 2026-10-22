// A roof fitted to its rooms: its outline is theirs, grown by the walls and an overhang, and settle redraws it
// whenever the walls move, so the roof follows the building. Giving the roof an outline of its own (pulling an edge
// or a corner past the walls) ends the fit; the roof then keeps exactly the outline it was given.
import { V2, polyArea, polyPerimeter, offsetPoly, ensureCCW, dist, dot, sub, polyCentroid } from './geom2d';
import { P, union, difference, mpolyArea } from './clip';

const FAR = 50; // m: how far a cut reaches into the room next door

export const WALL_HALF = 0.12;

export function isRoundish(poly: V2[]) {
  const A = Math.abs(polyArea(poly));
  const Lp = polyPerimeter(poly);
  return poly.length > 16 && (4 * Math.PI * A) / (Lp * Lp) > 0.96;
}

/**
 * Whether a room next door reaches this eave, so a roof over its neighbour has to stop at their shared wall instead of
 * overhanging into it. A taller room always does; a room on the same storey does too, because the eave would otherwise
 * run across its floor at the height of its own walls. Only a room whose walls stop below the eave (a lower storey next
 * door) leaves the overhang free to pass above it.
 */
export function reachesEave(room: { floorY: number; topY: number }, baseY: number): boolean {
  return room.floorY < baseY && room.topY >= baseY - 0.05;
}

/**
 * A room's sides: consecutive edges that run in one direction, merged. A wall is shared by a side, not by whichever
 * vertex happens to sit where the room next door starts, so the cut has one straight eave to land on.
 */
function sidesOf(poly: V2[]): { a: V2; b: V2; u: V2; n: V2; len: number }[] {
  const pts = poly.map((q) => q);
  const n = pts.length;
  const dirs: { u: V2; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const L = dist(a, b);
    if (L < 1e-6) continue;
    dirs.push({ u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], i });
  }
  if (!dirs.length) return [];
  const same = (p: V2, q: V2) => Math.abs(p[0] * q[1] - p[1] * q[0]) < 0.02 && dot(p, q) > 0;
  const out: { a: V2; b: V2; u: V2; n: V2; len: number }[] = [];
  let start = dirs[0].i, prev = dirs[0];
  for (let k = 1; k <= dirs.length; k++) {
    const cur = dirs[k % dirs.length];
    const turns = k === dirs.length || !same(prev.u, cur.u);
    if (!turns) { prev = cur; continue; }
    const a = pts[start], b = pts[(prev.i + 1) % n];
    const L = dist(a, b);
    if (L > 0.2) out.push({ a, b, u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n: [(a[1] - b[1]) / L, (b[0] - a[0]) / L], len: L });
    start = cur.i;
    prev = cur;
  }
  return out;
}

/**
 * The half of the plan a shared wall cuts away: along a covered room's side that a blocking room shares, the roof ends
 * on that wall instead of overhanging across it. The cut runs the whole side, not just the shared stretch, so a party
 * wall that reaches only part of the way still leaves one straight eave rather than a notch the section cannot carry.
 */
function sharedWallCuts(rooms: V2[][], blocking: V2[][], overhang: number): ReturnType<typeof P>[] {
  const cuts: ReturnType<typeof P>[] = [];
  const ext = WALL_HALF + overhang + 0.05; // past the corners, to take the overhang that wrapped round them
  for (const room0 of rooms) {
    for (const side of sidesOf(ensureCCW(room0))) {
      const { a, b, u, n, len } = side;
      let cut = 0;
      for (const other of blocking) {
        for (let j = 0; j < other.length && !cut; j++) {
          const c = other[j], d = other[(j + 1) % other.length];
          if (dist(c, d) < 0.05) continue;
          if (Math.abs(dot(sub(c, a), n)) > 0.06 || Math.abs(dot(sub(d, a), n)) > 0.06) continue;
          const sc = dot(sub(c, a), u), sd = dot(sub(d, a), u);
          const lo = Math.max(0, Math.min(sc, sd)), hi = Math.min(len, Math.max(sc, sd));
          // Only a side the neighbour runs the whole way along ends the overhang. A side shared part of the way would
          // need a jog the section cannot carry without stopping in mid-air, so there the roof keeps its eave (and the
          // fit's own note says the neighbour's walls are inside it). This is the honest limit of the rule.
          if (lo > 0.2 || hi < len - 0.2) continue;
          cut = Math.sign(dot(sub(polyCentroid(other), a), n));
        }
      }
      if (!cut) continue;
      const from: V2 = [a[0] - u[0] * ext, a[1] - u[1] * ext];
      const to: V2 = [b[0] + u[0] * ext, b[1] + u[1] * ext];
      const out: V2 = [n[0] * cut * FAR, n[1] * cut * FAR];
      cuts.push(P([from, to, [to[0] + out[0], to[1] + out[1]], [from[0] + out[0], from[1] + out[1]]]));
    }
  }
  return cuts;
}

/** The rooms' outline grown by half a wall and the overhang, stopping on the walls of the rooms next door that reach the eave. */
export function fittedOutline(rooms: V2[][], overhang: number, blocking: V2[][] = []): V2[] | null {
  if (!rooms.length) return null;
  let out: V2[];
  if (rooms.length === 1 && isRoundish(rooms[0])) out = offsetPoly(ensureCCW(rooms[0]), WALL_HALF + overhang).pts;
  else {
    const grown = union(...rooms.map((r) => P(offsetPoly(ensureCCW(r), WALL_HALF + overhang).pts)));
    const big = grown.sort((a, b) => mpolyArea([b]) - mpolyArea([a]))[0];
    out = big ? big[0] : rooms[0];
  }
  if (blocking.length) {
    // the cut only touches the side of the wall the room next door stands on, so the roof keeps its own floor
    const cut = difference(P(out), ...sharedWallCuts(rooms, blocking, overhang));
    const big = cut.sort((a, b) => mpolyArea([b]) - mpolyArea([a]))[0];
    if (big) out = big[0];
  }
  return out.length >= 3 ? ensureCCW(out) : null;
}

/** How far a drawn outline reaches past the rooms it covers, as an overhang (m), rounded. */
export function overhangOf(outline: V2[], rooms: V2[][]): number {
  const A = Math.abs(polyArea(outline));
  const Ar = rooms.reduce((s, r) => s + Math.abs(polyArea(r)), 0);
  const L = rooms.reduce((s, r) => s + polyPerimeter(r), 0);
  const o = L > 0 ? (A - Ar) / L - WALL_HALF : 0;
  return Math.round(Math.max(0, Math.min(1.5, o)) * 20) / 20;
}
