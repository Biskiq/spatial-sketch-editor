// Floors, plinths, ceilings, decks with rails, stairs, posts, light shafts, things, and scale figures.
import * as THREE from 'three';
import { Geo, V3 } from './geo';
import type { Project, Deck, Stair, Obj, Post, Void } from '../../model/types';
import type { Derived, DRoom } from '../../model/derive';
import { overheadAbove, floorUnder, stairMode, wallTopAt } from '../../model/derive';
import { V2, add, sub, mul, norm, perp, dist, lerp2, pointInPoly, closestOnSeg, polyArea, bbox } from '../../model/geom2d';
import { P, difference, intersection, MPoly } from '../../model/clip';
import { runGeom, pointAtT } from '../../model/runs';
import { ohUndersideAt, ohTopAt, ohCovers } from '../../model/overheadGeom';
import { stairSteps } from '../../model/settle';

export function voidHolesAt(p: Project, y: number): V2[][] {
  return p.voids.filter((v) => y > v.fromY && y <= v.toY + 1e-6).map((v) => v.outline);
}

export function buildFloor(p: Project, d: Derived, r: DRoom): Geo | null {
  const g = new Geo();
  const level = r.level;
  // an upper room standing on a deck uses the deck as its floor
  if (level > 0.05 && Math.abs(r.floorY - level) < 0.05 && p.decks.some((dk) => Math.abs(dk.y - level) < 0.06 && pointInPoly(r.at, dk.outline))) return null;
  let m: MPoly = P(r.poly, r.holes);
  const hs = voidHolesAt(p, r.floorY - 0.02);
  if (hs.length) m = difference(m, ...hs.map((h) => P(h)));
  if (r.floorY > level + 0.05) g.prismM(m, level, r.floorY);
  else g.prismM(m, r.floorY - 0.14, r.floorY);
  return g;
}

export function buildCeiling(p: Project, d: Derived, r: DRoom): Geo | null {
  if (r.seed.ceiling !== 'flat' || !r.coveredBy) return null;
  const y = r.topY;
  let m: MPoly = P(r.poly, r.holes);
  const cutters = [
    ...voidHolesAt(p, y + 0.01),
    ...p.decks.filter((dk) => Math.abs(dk.y - y) < 0.08 || (dk.y > y - 0.05 && dk.y - dk.thick < y + 0.05)).map((dk) => dk.outline),
  ];
  if (cutters.length) m = difference(m, ...cutters.map((h) => P(h)));
  if (!m.length) return null;
  const g = new Geo();
  g.prismM(m, y, y + 0.07);
  return g;
}

export function buildTable(p: Project, d: Derived): { board: Geo; grid: THREE.BufferGeometry } {
  const b = d.bounds;
  const pad = 14;
  const x0 = Math.min(-18, b.min[0] - pad), x1 = Math.max(18, b.max[0] + pad);
  const z0 = Math.min(-14, b.min[1] - pad), z1 = Math.max(14, b.max[1] + pad);
  const outer: V2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const sunk = d.rooms.filter((r) => r.level < 0.05 && r.floorY < -0.05);
  let m: MPoly = P(outer);
  if (sunk.length) m = difference(m, ...sunk.map((r) => P(r.poly)));
  const bottom = Math.min(-0.5, ...sunk.map((r) => r.floorY - 0.3));
  const board = new Geo();
  board.prismM(m, bottom, -0.012);
  // pit floors are the rooms' own floors; grid on the board
  const pts: number[] = [];
  const gx0 = Math.ceil(x0 + 1), gx1 = Math.floor(x1 - 1), gz0 = Math.ceil(z0 + 1), gz1 = Math.floor(z1 - 1);
  for (let x = gx0; x <= gx1; x++) pts.push(x, -0.008, gz0, x, -0.008, gz1);
  for (let z = gz0; z <= gz1; z++) pts.push(gx0, -0.008, z, gx1, -0.008, z);
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return { board, grid };
}

export function buildDeck(p: Project, d: Derived, dk: Deck): { slab: Geo; rails: Geo; railLines: number[] } {
  const slab = new Geo(), rails = new Geo();
  const railLines: number[] = [];
  let m: MPoly = P(dk.outline);
  const hs = voidHolesAt(p, dk.y - 0.01);
  if (hs.length) m = difference(m, ...hs.map((h) => P(h)));
  slab.prismM(m, dk.y - dk.thick, dk.y);
  // rails where the edge is open
  const carriers: { a: V2; b: V2 }[] = [];
  for (const w of d.walls.values()) {
    const ps = runGeom(w.run).ps;
    for (let i = 0; i + 1 < ps.pts.length; i++) {
      const sm = (ps.s[i] + ps.s[i + 1]) / 2;
      if (wallTopAt(w, sm) > dk.y + 0.6 && w.run.baseY < dk.y) carriers.push({ a: ps.pts[i], b: ps.pts[i + 1] });
    }
  }
  const stairEnds = p.stairs.flatMap((s) => [
    { at: s.path[0], y: s.fromY },
    { at: s.path[s.path.length - 1], y: s.toY },
  ]).filter((e) => Math.abs(e.y - dk.y) < 0.1);
  const open = (q: V2, outward: V2) => {
    for (const c of carriers) if (closestOnSeg(q, c.a, c.b).d < 0.32) return false;
    const probe = add(q, mul(outward, 0.25));
    for (const o of p.decks) if (o.id !== dk.id && Math.abs(o.y - dk.y) < 0.1 && pointInPoly(probe, o.outline)) return false;
    for (const r of d.rooms) if (Math.abs(r.floorY - dk.y) < 0.1 && pointInPoly(probe, r.poly)) return false;
    for (const e of stairEnds) if (dist(e.at, q) < 0.9) return false;
    return true;
  };
  const H = 1.0;
  for (const poly of m)
    poly.forEach((ring, ri) => {
      const ccw = polyArea(ring) > 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const L = dist(a, b);
        const n = Math.max(1, Math.ceil(L / 0.5));
        let dir = norm(sub(b, a));
        let out: V2 = [dir[1], -dir[0]];
        if (!ccw) out = mul(out, -1);
        for (let k = 0; k < n; k++) {
          const p0 = lerp2(a, b, k / n), p1 = lerp2(a, b, (k + 1) / n);
          const mid = lerp2(p0, p1, 0.5);
          if (!open(mid, out)) continue;
          const i0 = add(p0, mul(out, -0.05)), i1 = add(p1, mul(out, -0.05));
          rails.quad([i0[0], dk.y, i0[1]], [i1[0], dk.y, i1[1]], [i1[0], dk.y + H, i1[1]], [i0[0], dk.y + H, i0[1]]);
          railLines.push(i0[0], dk.y + H, i0[1], i1[0], dk.y + H, i1[1]);
        }
      }
    });
  return { slab, rails, railLines };
}

export function buildStair(st: Stair): { solid: Geo; lines: number[] } {
  const g = new Geo();
  const lines: number[] = [];
  const path = st.path;
  if (path.length < 2) return { solid: g, lines };
  const acc = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + dist(path[i - 1], path[i]));
  const L = acc[acc.length - 1];
  if (L < 0.2) return { solid: g, lines };
  const at = (s: number): { p: V2; t: V2 } => {
    let i = acc.findIndex((x) => x >= s);
    if (i <= 0) i = 1;
    const k = (s - acc[i - 1]) / Math.max(acc[i] - acc[i - 1], 1e-9);
    return { p: lerp2(path[i - 1], path[i], Math.max(0, Math.min(1, k))), t: norm(sub(path[i], path[i - 1])) };
  };
  const w = st.width / 2;
  const y0 = st.fromY, y1 = st.toY;
  const mode = stairMode(st);
  if (mode === 'stair') {
    const n = stairSteps(y0, y1);
    const riser = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const sa = (L * i) / n, sb = (L * (i + 1)) / n;
      const A = at(sa), Bq = at(sb);
      const yt = y0 + riser * (i + 1);
      const yb = Math.min(yt, y0 + riser * i) - 0.24;
      const na = perp(A.t), nb = perp(Bq.t);
      const ring: V2[] = [add(A.p, mul(na, w)), add(A.p, mul(na, -w)), add(Bq.p, mul(nb, -w)), add(Bq.p, mul(nb, w))];
      const cw = polyArea(ring) < 0 ? ring.slice().reverse() : ring;
      g.prismM([[cw]], Math.max(Math.min(y0, y1) - 0.01, yb), yt);
    }
  } else {
    const n = Math.max(4, Math.ceil(L / 0.4));
    for (let i = 0; i < n; i++) {
      const A = at((L * i) / n), Bq = at((L * (i + 1)) / n);
      const ya = y0 + ((y1 - y0) * i) / n, yb = y0 + ((y1 - y0) * (i + 1)) / n;
      const na = perp(A.t), nb = perp(Bq.t);
      const l0 = add(A.p, mul(na, w)), r0 = add(A.p, mul(na, -w)), l1 = add(Bq.p, mul(nb, w)), r1 = add(Bq.p, mul(nb, -w));
      g.quad([l0[0], ya, l0[1]], [r0[0], ya, r0[1]], [r1[0], yb, r1[1]], [l1[0], yb, l1[1]], [0, 1, 0]);
      g.quad([l0[0], ya - 0.18, l0[1]], [r0[0], ya - 0.18, r0[1]], [r1[0], yb - 0.18, r1[1]], [l1[0], yb - 0.18, l1[1]], [0, -1, 0]);
      g.quad([l0[0], ya - 0.18, l0[1]], [l1[0], yb - 0.18, l1[1]], [l1[0], yb, l1[1]], [l0[0], ya, l0[1]], [na[0], 0, na[1]]);
      g.quad([r0[0], ya - 0.18, r0[1]], [r1[0], yb - 0.18, r1[1]], [r1[0], yb, r1[1]], [r0[0], ya, r0[1]], [-na[0], 0, -na[1]]);
    }
  }
  // handrails
  const n = Math.max(4, Math.ceil(L / 0.4));
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const A = at((L * i) / n), Bq = at((L * (i + 1)) / n);
      const ya = y0 + ((y1 - y0) * i) / n + 0.9, yb = y0 + ((y1 - y0) * (i + 1)) / n + 0.9;
      const a = add(A.p, mul(perp(A.t), side * (w - 0.05))), b = add(Bq.p, mul(perp(Bq.t), side * (w - 0.05)));
      lines.push(a[0], ya, a[1], b[0], yb, b[1]);
    }
  }
  return { solid: g, lines };
}

export function postSpan(p: Project, d: Derived, q: Post): { y0: number; y1: number } {
  const f = floorUnder(p, d, q.at, 1e9);
  // floor under: the lowest sensible surface below whatever it carries
  const oh = overheadAbove(p, q.at, 0.5);
  const deckAbove = p.decks.filter((dk) => pointInPoly(q.at, dk.outline)).sort((a, b) => a.y - b.y)[0];
  let y1 = oh ? ohUndersideAt(oh, q.at) : 3;
  if (deckAbove && deckAbove.y - deckAbove.thick < y1) y1 = deckAbove.y - deckAbove.thick;
  const base = floorUnder(p, d, q.at, y1 - 0.5);
  return { y0: base.y, y1 };
}

export function buildPost(p: Project, d: Derived, q: Post): Geo {
  const g = new Geo();
  const { y0, y1 } = postSpan(p, d, q);
  g.box(q.at[0], (y0 + y1) / 2, q.at[1], q.size, Math.max(0.2, y1 - y0), q.size);
  return g;
}

export function buildShaft(p: Project, v: Void): { geo: Geo; top: number; bottom: number } | null {
  // light falls through a void that reaches the sky
  const roof = p.overheads.filter((oh) => v.toY >= oh.baseY - 0.01 && v.outline.some((q) => ohCovers(oh, q)));
  if (!roof.length && v.toY < 50) return null;
  const top = roof.length ? Math.max(...roof.map((oh) => Math.max(...v.outline.map((q) => ohTopAt(oh, q))))) : v.fromY + 8;
  const bottom = v.fromY;
  const g = new Geo();
  const ring = v.outline;
  g.skirt(ring, bottom, top, true);
  g.flat([ring], bottom + 0.02, true);
  return { geo: g, top, bottom };
}

// ---------------------------------------------------------------- things
const personShape = (() => {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-0.13, 0], [-0.1, 0.78], [-0.2, 0.8], [-0.24, 1.38], [-0.13, 1.45], [-0.08, 1.48], [-0.1, 1.6], [-0.06, 1.69], [0, 1.71],
    [0.06, 1.69], [0.1, 1.6], [0.08, 1.48], [0.13, 1.45], [0.24, 1.38], [0.2, 0.8], [0.1, 0.78], [0.13, 0], [0.03, 0], [0, 0.72], [-0.03, 0],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts.slice(1)) s.lineTo(q[0], q[1]);
  s.closePath();
  return s;
})();

export function personGeometry(): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(personShape, { depth: 0.012, bevelEnabled: false });
  g.translate(0, 0, -0.006);
  return g;
}

export function objGeometries(type: Obj['type']): { geo: THREE.BufferGeometry; mat: 'obj' | 'objDark' | 'canvas' | 'leaf' }[] {
  switch (type) {
    case 'sculpture': {
      const base = new THREE.BoxGeometry(0.7, 0.5, 0.7);
      base.translate(0, 0.25, 0);
      const knot = new THREE.TorusKnotGeometry(0.34, 0.1, 120, 14, 2, 3);
      knot.translate(0, 1.0, 0);
      return [{ geo: base, mat: 'obj' }, { geo: knot, mat: 'objDark' }];
    }
    case 'plinth': {
      const base = new THREE.BoxGeometry(0.55, 1.0, 0.55);
      base.translate(0, 0.5, 0);
      const vase = new THREE.LatheGeometry([0, 0.12, 0.17, 0.12, 0.07, 0.1, 0].map((r, i) => new THREE.Vector2(r, i * 0.07)), 28);
      vase.translate(0, 1.0, 0);
      return [{ geo: base, mat: 'obj' }, { geo: vase, mat: 'objDark' }];
    }
    case 'bench': {
      const g = new THREE.BoxGeometry(1.7, 0.45, 0.45);
      g.translate(0, 0.225, 0);
      return [{ geo: g, mat: 'obj' }];
    }
    case 'frame': {
      const f = new THREE.BoxGeometry(1.0, 1.25, 0.05);
      const c = new THREE.PlaneGeometry(0.82, 1.06);
      c.translate(0, 0, 0.027);
      return [{ geo: f, mat: 'objDark' }, { geo: c, mat: 'canvas' }];
    }
    case 'tree': {
      const t = new THREE.CylinderGeometry(0.07, 0.1, 1.6, 8);
      t.translate(0, 0.8, 0);
      const c = new THREE.IcosahedronGeometry(1.0, 1);
      c.scale(1, 1.15, 1);
      c.translate(0, 2.3, 0);
      return [{ geo: t, mat: 'objDark' }, { geo: c, mat: 'leaf' }];
    }
    case 'person':
      return [{ geo: personGeometry(), mat: 'obj' }];
    case 'screen': {
      const pole = new THREE.BoxGeometry(0.08, 1.1, 0.08);
      pole.translate(0, 0.55, 0);
      const sc = new THREE.BoxGeometry(1.3, 0.78, 0.06);
      sc.translate(0, 1.45, 0);
      const ft = new THREE.BoxGeometry(0.6, 0.04, 0.4);
      ft.translate(0, 0.02, 0);
      return [{ geo: pole, mat: 'objDark' }, { geo: sc, mat: 'objDark' }, { geo: ft, mat: 'objDark' }];
    }
  }
}

/** Where a thing sits in the world. */
export function objPlacement(p: Project, d: Derived, o: Obj): { pos: V3; rot: number } {
  if (o.on.kind === 'wall') {
    const on = o.on;
    const r = p.runs.find((x) => x.id === on.run);
    if (r) {
      const g = runGeom(r);
      const q = pointAtT(r, on.t);
      const i = Math.max(0, g.ps.pts.findIndex((_, k) => k + 1 < g.ps.pts.length && g.ps.s[k + 1] >= on.t * g.L));
      const tan = norm(sub(g.ps.pts[Math.min(i + 1, g.ps.pts.length - 1)], g.ps.pts[i]));
      const n = perp(tan);
      const off = mul(n, on.side * (r.thick / 2 + 0.03));
      return { pos: [q[0] + off[0], on.y, q[1] + off[1]], rot: Math.atan2(n[0] * on.side, n[1] * on.side) };
    }
  }
  let y = 0;
  if (o.on.kind === 'room') y = d.roomById.get(o.on.id)?.floorY ?? 0;
  else if (o.on.kind === 'deck') {
    const id = o.on.id;
    y = p.decks.find((x) => x.id === id)?.y ?? 0;
  } else y = o.on.y;
  return { pos: [o.at[0], y, o.at[1]], rot: o.rot };
}
