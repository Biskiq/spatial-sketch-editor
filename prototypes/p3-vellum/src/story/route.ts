// The visitor's walk: a plan path whose height comes from the surfaces underneath — so it climbs stairs,
// stays under a mezzanine, and crosses a bridge.
import type { Project } from '../model/types';
import { derive } from '../model/derive';
import { V2, dist, pointInPoly, pointInPolyHoles, closestOnSeg, lerp2 } from '../model/geom2d';

/** Candidate walking heights at a plan point. */
export function surfacesAt(p: Project, q: V2): number[] {
  const d = derive(p);
  const out: number[] = [0];
  for (const r of d.rooms) if (pointInPolyHoles(q, r.poly, r.holes)) out.push(r.floorY);
  for (const dk of p.decks) if (pointInPoly(q, dk.outline) && !p.voids.some((v) => dk.y > v.fromY && dk.y <= v.toY && pointInPoly(q, v.outline))) out.push(dk.y);
  for (const st of p.stairs) {
    const path = st.path;
    let acc = 0, total = 0;
    for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
    for (let i = 1; i < path.length; i++) {
      const c = closestOnSeg(q, path[i - 1], path[i]);
      const segL = dist(path[i - 1], path[i]);
      if (c.d < st.width / 2 + 0.05) {
        const s = acc + c.t * segL;
        out.push(st.fromY + ((st.toY - st.fromY) * s) / Math.max(total, 1e-6));
      }
      acc += segL;
    }
  }
  return out;
}

export function routeHeights(p: Project, route: V2[], startY = 0): number[] {
  if (!route.length) return [];
  const out: number[] = [];
  let y = startY;
  // walk in small steps so stairs are followed continuously
  for (let i = 0; i < route.length; i++) {
    const a = i ? route[i - 1] : route[0], b = route[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / 0.25));
    for (let k = 1; k <= n; k++) {
      const q = lerp2(a, b, k / n);
      const c = surfacesAt(p, q);
      // the surface nearest the current height within a step; otherwise drop to the nearest below
      let best = y, bd = Infinity;
      for (const h of c) {
        const dd = Math.abs(h - y);
        if (dd < 0.45 && dd < bd) {
          bd = dd;
          best = h;
        }
      }
      if (bd === Infinity) {
        const below = c.filter((h) => h <= y + 0.01).sort((u, v) => v - u)[0];
        best = below ?? Math.min(...c);
      }
      y = best;
    }
    out.push(y);
  }
  return out;
}
