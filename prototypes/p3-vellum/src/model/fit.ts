// A roof fitted to its rooms: its outline is theirs, grown by the walls and an overhang, and settle redraws it
// whenever the walls move, so the roof follows the building. Giving the roof an outline of its own (pulling an edge
// or a corner past the walls) ends the fit; the roof then keeps exactly the outline it was given.
import { V2, polyArea, polyPerimeter, offsetPoly, ensureCCW } from './geom2d';
import { P, union, difference, mpolyArea } from './clip';

export const WALL_HALF = 0.12;

export function isRoundish(poly: V2[]) {
  const A = Math.abs(polyArea(poly));
  const Lp = polyPerimeter(poly);
  return poly.length > 16 && (4 * Math.PI * A) / (Lp * Lp) > 0.96;
}

/** The rooms' outline grown by half a wall and the overhang, minus taller rooms next door (their walls rise past). */
export function fittedOutline(rooms: V2[][], overhang: number, taller: V2[][] = []): V2[] | null {
  if (!rooms.length) return null;
  let out: V2[];
  if (rooms.length === 1 && isRoundish(rooms[0])) out = offsetPoly(ensureCCW(rooms[0]), WALL_HALF + overhang).pts;
  else {
    const grown = union(...rooms.map((r) => P(offsetPoly(ensureCCW(r), WALL_HALF + overhang).pts)));
    const big = grown.sort((a, b) => mpolyArea([b]) - mpolyArea([a]))[0];
    out = big ? big[0] : rooms[0];
  }
  if (taller.length) {
    const cut = difference(P(out), ...taller.map((r) => P(offsetPoly(ensureCCW(r), WALL_HALF).pts)));
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
