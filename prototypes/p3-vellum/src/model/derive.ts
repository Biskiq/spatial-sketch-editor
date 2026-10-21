// Derived state: rooms as they stand, how tall each wall is along its length, and the loose ends.
import {
  V2, add, sub, mul, dist, norm, perp, bbox, bboxOverlap, pointInPoly, pointInPolyHoles, polyCentroid, closestOnSeg,
  pointAtS, distToPolyEdge, polyArea, fmtM, offsetPoly, lerp2, interiorPoint,
} from './geom2d';
import { P, intersection, union, mpolyArea } from './clip';
import { runGeom } from './runs';
import { levelArrangements, lvl, roomTop, stairSteps } from './settle';
import { ohUndersideAt, ohCovers, ohRidge, ohTopAt } from './overheadGeom';
import type { Project, Run, RoomSeed, Opening, Overhead, Deck, Stair, Element } from './types';
import { findEl, newId } from './types';

export interface DRoom {
  id: string;
  seed: RoomSeed;
  name: string;
  poly: V2[];
  holes: V2[][];
  area: number;
  level: number;
  floorY: number;
  topY: number;
  at: V2;
  coveredBy: string | null;
}

export interface WallSpan {
  s0: number;
  s1: number;
  b0: number;
  b1: number;
  t0: number;
  t1: number;
}

export interface DOpening {
  o: Opening;
  s: number;
  s0: number;
  s1: number;
  y0: number;
  y1: number;
  floor: number;
  fits: boolean;
  why: string;
}

export interface DWall {
  run: Run;
  L: number;
  spans: WallSpan[];
  extA: number;
  extB: number;
  pieces: { s0: number; s1: number; left: string | null; right: string | null }[];
  openings: DOpening[];
  maxTop: number;
}

export interface Fix {
  label: string;
  apply: (p: Project) => void;
  /** pencil preview geometry */
  pencilPosts?: { at: V2; y0: number; y1: number }[];
}

export interface Issue {
  key: string;
  kind: 'support' | 'clash' | 'steep' | 'fit' | 'headroom' | 'floating';
  text: string;
  ids: string[];
  at: [number, number, number];
  fixes: Fix[];
  acknowledged: boolean;
}

export interface Snap {
  y: number;
  label: string;
  kind: 'ground' | 'floor' | 'top' | 'deck' | 'eave' | 'ridge';
  ids: string[];
}

export interface Derived {
  rooms: DRoom[];
  roomById: Map<string, DRoom>;
  walls: Map<string, DWall>;
  issues: Issue[];
  snaps: Snap[];
  bounds: { min: V2; max: V2; top: number; empty: boolean };
  levels: number[];
}

const cache = new WeakMap<Project, Derived>();

export function overheadAbove(p: Project, pt: V2, minY: number): Overhead | null {
  let best: Overhead | null = null, by = Infinity;
  for (const oh of p.overheads) {
    if (!ohCovers(oh, pt)) continue;
    const u = ohUndersideAt(oh, pt);
    if (u > minY && u < by) {
      by = u;
      best = oh;
    }
  }
  return best;
}

/** The overhead a wall rises to: one that covers this point and belongs to a room the wall bounds. */
function overheadForWall(p: Project, pt: V2, rooms: DRoom[], minY: number): Overhead | null {
  let best: Overhead | null = null, by = Infinity;
  for (const oh of p.overheads) {
    if (!ohCovers(oh, pt)) continue;
    const mine = (oh.restsOn && rooms.some((r) => oh.restsOn!.includes(r.id))) || rooms.some((r) => ohCovers(oh, r.at));
    if (!mine) continue;
    const u = ohUndersideAt(oh, pt);
    if (u > minY && u < by) {
      by = u;
      best = oh;
    }
  }
  return best;
}

export function derive(p: Project): Derived {
  const c = cache.get(p);
  if (c) return c;
  const byLevel = levelArrangements(p);
  const rooms: DRoom[] = [];
  const roomById = new Map<string, DRoom>();
  for (const s of p.rooms) {
    if (s.dormant || s.poly.length < 3) continue;
    const ctr = polyCentroid(s.poly);
    const covered = p.overheads.find((oh) => ohCovers(oh, pointInPoly(ctr, s.poly) ? ctr : s.at) && ohUndersideAt(oh, s.at) > s.floorY + 0.5);
    const dr: DRoom = {
      id: s.id, seed: s, name: s.name, poly: s.poly, holes: s.holes, area: Math.abs(polyArea(s.poly)), level: s.level,
      floorY: s.floorY, topY: roomTop(s), at: s.at, coveredBy: covered?.id ?? null,
    };
    rooms.push(dr);
    roomById.set(s.id, dr);
  }

  // ---- walls
  const walls = new Map<string, DWall>();
  for (const r of p.runs) {
    const g = runGeom(r);
    const lv = byLevel.get(lvl(r.baseY));
    const rawPieces = lv?.arr.pieces.get(r.id) ?? [{ s0: 0, s1: g.L, left: -1, right: -1 }];
    const pieces = rawPieces.map((pc) => ({
      s0: pc.s0, s1: pc.s1,
      left: pc.left >= 0 ? lv!.faceSeed[pc.left] : null,
      right: pc.right >= 0 ? lv!.faceSeed[pc.right] : null,
    }));
    // fill gaps (s ranges with no piece, e.g. zero-length bits)
    const spans: WallSpan[] = [];
    let maxTop = -Infinity;
    for (const pc of pieces) {
      const rs = [pc.left, pc.right].filter((x): x is string => !!x).map((id) => roomById.get(id)).filter((x): x is DRoom => !!x);
      const uniq = [...new Map(rs.map((x) => [x.id, x])).values()];
      const ss = new Set<number>([pc.s0, pc.s1]);
      for (const sv of g.ps.s) if (sv > pc.s0 && sv < pc.s1) ss.add(sv);
      const roofy = p.overheads.length > 0 && r.top === null;
      if (roofy) for (let sv = pc.s0 + 0.5; sv < pc.s1; sv += 0.5) ss.add(sv);
      const sl = [...ss].sort((a, b) => a - b);
      const at = (sv: number) => {
        const pt = pointAtS(g.ps, sv).p;
        const base = r.baseY;
        let bottom: number, top: number;
        if (!uniq.length) {
          bottom = base;
          top = base + (r.top ?? 3);
        } else {
          const inside = pc.left === pc.right; // a free wall standing inside one room
          const exteriorSide = !pc.left || !pc.right;
          bottom = Math.min(...uniq.map((x) => x.floorY), exteriorSide && !inside ? lvl(r.baseY) : Infinity);
          if (r.top !== null) top = base + r.top;
          else {
            const maxFlat = Math.max(...uniq.map((x) => x.topY));
            const exterior = !pc.left || !pc.right;
            const follow = uniq.some((x) => x.seed.ceiling === 'follow');
            const oh = overheadForWall(p, pt, uniq, Math.max(...uniq.map((x) => x.floorY)) + 1.0);
            const u = oh ? ohUndersideAt(oh, pt) : null;
            if (u !== null && (exterior || follow) && u > maxFlat - 0.01) top = u;
            else top = maxFlat;
            if (u !== null && top > u) top = u;
          }
        }
        return { bottom, top };
      };
      let prev = at(sl[0]);
      for (let i = 0; i + 1 < sl.length; i++) {
        const nx = at(sl[i + 1]);
        spans.push({ s0: sl[i], s1: sl[i + 1], b0: prev.bottom, b1: nx.bottom, t0: prev.top, t1: nx.top });
        maxTop = Math.max(maxTop, prev.top, nx.top);
        prev = nx;
      }
    }
    spans.sort((a, b) => a.s0 - b.s0);
    // extend open ends that meet another wall so corners close
    let extA = 0, extB = 0;
    if (r.shape === 'path' && !r.closed) {
      const ends: [V2, 'A' | 'B'][] = [[r.pts[0], 'A'], [r.pts[r.pts.length - 1], 'B']];
      for (const [e, which] of ends) {
        const touching = (which === 'A' ? r.tieA : r.tieB) || p.runs.some((o) => o.id !== r.id && lvl(o.baseY) === lvl(r.baseY) && touches(o, e));
        if (touching) which === 'A' ? (extA = r.thick / 2) : (extB = r.thick / 2);
      }
    }
    walls.set(r.id, { run: r, L: g.L, spans, extA, extB, pieces, openings: [], maxTop });
  }
  // openings
  for (const o of p.openings) {
    const w = walls.get(o.run);
    if (!w) continue;
    const s = o.t * w.L;
    const pc = w.pieces.find((x) => s >= x.s0 && s <= x.s1);
    const floors = pc ? [pc.left, pc.right].map((id) => (id ? roomById.get(id)?.floorY : undefined)).filter((x): x is number => x !== undefined) : [];
    const floor = floors.length ? Math.max(...floors) : w.run.baseY;
    const d: DOpening = { o, s, s0: s - o.width / 2, s1: s + o.width / 2, y0: floor + o.sill, y1: floor + o.height, floor, fits: true, why: '' };
    const closedRun = w.run.shape === 'circle' || w.run.closed;
    if (!closedRun && (d.s0 < 0.05 || d.s1 > w.L - 0.05)) {
      d.fits = false;
      d.why = 'runs past the end of its wall';
    }
    if (closedRun && o.width > w.L * 0.9) {
      d.fits = false;
      d.why = 'is wider than its wall';
    }
    const topHere = wallTopAt(w, s);
    if (d.y1 > topHere - 0.05) {
      d.fits = false;
      d.why = 'is taller than its wall here';
    }
    w.openings.push(d);
  }
  for (const w of walls.values()) {
    const os = w.openings.sort((a, b) => a.s0 - b.s0);
    for (let i = 0; i + 1 < os.length; i++)
      if (os[i].s1 > os[i + 1].s0 - 0.08 && os[i].y1 > os[i + 1].y0 && os[i + 1].y1 > os[i].y0) {
        os[i + 1].fits = false;
        os[i + 1].why = `overlaps the ${os[i].o.name ?? 'opening'} next to it`;
      }
  }

  const issues = computeIssues(p, rooms, roomById, walls);
  const ack = new Set(p.acknowledged);
  for (const i of issues) i.acknowledged = ack.has(i.key);

  // ---- sheet snaps
  const snaps: Snap[] = [{ y: 0, label: 'Ground', kind: 'ground', ids: [] }];
  const addSnap = (y: number, label: string, kind: Snap['kind'], id: string) => {
    const ex = snaps.find((s) => Math.abs(s.y - y) < 0.05);
    if (ex) {
      if (!ex.ids.includes(id)) {
        ex.ids.push(id);
        if (ex.label.length < 34) ex.label += ` · ${label}`;
        else if (!ex.label.endsWith('…')) ex.label += ' …';
      }
    } else snaps.push({ y, label, kind, ids: [id] });
  };
  for (const r of rooms) {
    if (Math.abs(r.floorY - r.level) > 0.04) addSnap(r.floorY, `${r.name} floor`, 'floor', r.id);
    addSnap(r.topY, `${r.name} top`, 'top', r.id);
  }
  for (const d of p.decks) addSnap(d.y, d.name, 'deck', d.id);
  for (const oh of p.overheads) {
    addSnap(oh.baseY, `${oh.name} eave`, 'eave', oh.id);
    const rd = ohRidge(oh);
    if (rd - oh.baseY > 0.3) addSnap(rd, `${oh.name} ridge`, 'ridge', oh.id);
  }
  snaps.sort((a, b) => a.y - b.y);

  // ---- bounds
  const pts: V2[] = [];
  for (const r of p.runs) pts.push(...runGeom(r).ps.pts);
  for (const oh of p.overheads) pts.push(...oh.outline);
  for (const d of p.decks) pts.push(...d.outline);
  for (const s of p.stairs) pts.push(...s.path);
  for (const o of p.objs) pts.push(o.at);
  for (const q of p.posts) pts.push(q.at);
  const empty = pts.length === 0;
  const bb = empty ? { min: [-6, -6] as V2, max: [6, 6] as V2 } : bbox(pts);
  let top = 3;
  for (const w of walls.values()) top = Math.max(top, w.maxTop);
  for (const oh of p.overheads) top = Math.max(top, ohRidge(oh));
  for (const d of p.decks) top = Math.max(top, d.y + 1.1);

  const out: Derived = { rooms, roomById, walls, issues, snaps, bounds: { min: bb.min, max: bb.max, top, empty }, levels: [...byLevel.keys()] };
  cache.set(p, out);
  return out;
}

function touches(o: Run, e: V2) {
  const g = runGeom(o);
  for (let i = 0; i + 1 < g.ps.pts.length; i++) if (closestOnSeg(e, g.ps.pts[i], g.ps.pts[i + 1]).d < 0.03) return true;
  return false;
}

export function wallTopAt(w: DWall, s: number) {
  for (const sp of w.spans) if (s >= sp.s0 - 1e-6 && s <= sp.s1 + 1e-6) return sp.t0 + ((sp.t1 - sp.t0) * (s - sp.s0)) / Math.max(sp.s1 - sp.s0, 1e-9);
  return w.spans.length ? w.spans[w.spans.length - 1].t1 : w.run.baseY + 3;
}
export function wallBottomAt(w: DWall, s: number) {
  for (const sp of w.spans) if (s >= sp.s0 - 1e-6 && s <= sp.s1 + 1e-6) return sp.b0 + ((sp.b1 - sp.b0) * (s - sp.s0)) / Math.max(sp.s1 - sp.s0, 1e-9);
  return w.run.baseY;
}

/** Highest walkable surface under a point at or below `maxY`. */
export function floorUnder(p: Project, d: Derived, pt: V2, maxY = Infinity): { y: number; ref: import('./types').SurfaceRef; name: string } {
  let best = { y: 0, ref: { kind: 'ground', y: 0 } as import('./types').SurfaceRef, name: 'the ground' };
  for (const r of d.rooms) if (r.floorY <= maxY + 0.01 && r.floorY >= best.y - 1e-6 && pointInPolyHoles(pt, r.poly, r.holes)) best = { y: r.floorY, ref: { kind: 'room', id: r.id }, name: r.name };
  for (const dk of p.decks) if (dk.y <= maxY + 0.01 && dk.y >= best.y - 1e-6 && pointInPoly(pt, dk.outline) && !voidAt(p, pt, dk.y)) best = { y: dk.y, ref: { kind: 'deck', id: dk.id }, name: dk.name };
  return best;
}

export function voidAt(p: Project, pt: V2, y: number) {
  return p.voids.some((v) => y > v.fromY && y <= v.toY + 1e-6 && pointInPoly(pt, v.outline));
}

// ------------------------------------------------------------------ loose ends
function computeIssues(p: Project, rooms: DRoom[], roomById: Map<string, DRoom>, walls: Map<string, DWall>): Issue[] {
  const issues: Issue[] = [];
  // carriers: wall centrelines with their tops
  interface Carrier { a: V2; b: V2; top: number }
  const carriers: Carrier[] = [];
  for (const w of walls.values()) {
    const ps = runGeom(w.run).ps;
    for (let i = 0; i + 1 < ps.pts.length; i++) {
      const sm = (ps.s[i] + ps.s[i + 1]) / 2;
      carriers.push({ a: ps.pts[i], b: ps.pts[i + 1], top: wallTopAt(w, sm) });
    }
  }
  const carried = (pt: V2, y: number, reach: number) => {
    for (const c of carriers) if (c.top >= y - 0.7 && closestOnSeg(pt, c.a, c.b).d <= reach) return true;
    for (const q of p.posts) if (dist(q.at, pt) <= reach + 0.8) return true;
    return false;
  };
  const stretches = (outline: V2[], y: number, reach: number, minLen: number) => {
    const n = outline.length;
    const samples: { p: V2; ok: boolean; edge: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = outline[i], b = outline[(i + 1) % n];
      const L = dist(a, b);
      const k = Math.max(1, Math.ceil(L / 0.4));
      for (let j = 0; j < k; j++) {
        const q = lerp2(a, b, j / k);
        samples.push({ p: q, ok: carried(q, y, reach), edge: i });
      }
    }
    if (samples.every((s) => !s.ok)) return [samples.map((s) => s.p)];
    if (samples.every((s) => s.ok)) return [];
    // rotate to start at a supported sample
    const s0 = samples.findIndex((s) => s.ok);
    const rot = samples.slice(s0).concat(samples.slice(0, s0));
    const out: V2[][] = [];
    let cur: V2[] = [];
    for (const s of rot) {
      if (!s.ok) cur.push(s.p);
      else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out.filter((st) => {
      let L = 0;
      for (let i = 1; i < st.length; i++) L += dist(st[i - 1], st[i]);
      return L >= minLen;
    });
  };
  const postsAlong = (st: V2[], inside: V2[], spacing: number) => {
    let L = 0;
    const acc = [0];
    for (let i = 1; i < st.length; i++) acc.push((L += dist(st[i - 1], st[i])));
    const n = Math.max(1, Math.ceil(L / spacing));
    const out: V2[] = [];
    const ctr = polyCentroid(inside);
    for (let k = 0; k <= n; k++) {
      const target = (L * k) / n;
      let i = acc.findIndex((x) => x >= target);
      if (i < 0) i = acc.length - 1;
      const q = st[i];
      const toC = norm(sub(ctr, q));
      out.push(add(q, mul(toC, 0.35)));
    }
    return out;
  };
  const len = (st: V2[]) => st.reduce((a, q, i) => (i ? a + dist(st[i - 1], q) : 0), 0);

  for (const oh of p.overheads) {
    const sts = stretches(oh.outline, oh.baseY, 1.6, 1.2);
    sts.forEach((st, k) => {
      const posts = postsAlong(st, oh.outline, 3.6);
      const mid = st[Math.floor(st.length / 2)];
      const pencilPosts = posts.map((at) => ({ at, y0: floorUnder(p, { rooms } as Derived, at, oh.baseY).y, y1: ohUndersideAt(oh, at) }));
      const fixes: Fix[] = [
        {
          label: `Add ${posts.length} post${posts.length > 1 ? 's' : ''}`,
          pencilPosts,
          apply: (q) => {
            for (const at of posts) q.posts.push({ id: newId(q, 'q'), kind: 'post', at, size: 0.22, order: q.nextId });
          },
        },
      ];
      const under = rooms.filter((r) => r.level <= oh.baseY && intersection(P(r.poly), P(oh.outline)).length);
      if (under.length) {
        fixes.push({
          label: 'Shrink to its walls',
          apply: (q) => {
            const o = q.overheads.find((x) => x.id === oh.id);
            if (!o) return;
            const grown = union(...under.map((r) => P(offsetPoly(r.poly, 0.55).pts)));
            const cut = intersection(P(o.outline), grown);
            const biggest = cut.sort((a, b) => mpolyArea([b]) - mpolyArea([a]))[0];
            if (biggest) o.outline = biggest[0];
          },
        });
      }
      issues.push({
        key: `support:${oh.id}:${k}:${Math.round(len(st))}`, kind: 'support',
        text: `${oh.name} has nothing under ${fmtM(len(st))} of its edge.`,
        ids: [oh.id], at: [mid[0], ohTopAt(oh, mid) + 0.2, mid[1]], fixes, acknowledged: false,
      });
    });
  }
  for (const dk of p.decks) {
    if (dk.restsOn) continue;
    if (dk.bridge) continue;
    const sts = stretches(dk.outline, dk.y, 0.5, 3.0);
    sts.forEach((st, k) => {
      const posts = postsAlong(st, dk.outline, 3.2);
      const mid = st[Math.floor(st.length / 2)];
      const pencilPosts = posts.map((at) => ({ at, y0: floorUnder(p, { rooms } as Derived, at, dk.y - 0.5).y, y1: dk.y - dk.thick }));
      issues.push({
        key: `support:${dk.id}:${k}:${Math.round(len(st))}`, kind: 'support',
        text: `${dk.name} has nothing under ${fmtM(len(st))} of its edge.`,
        ids: [dk.id], at: [mid[0], dk.y + 0.2, mid[1]], acknowledged: false,
        fixes: [{
          label: `Add ${posts.length} post${posts.length > 1 ? 's' : ''}`, pencilPosts,
          apply: (q) => { for (const at of posts) q.posts.push({ id: newId(q, 'q'), kind: 'post', at, size: 0.2, order: q.nextId }); },
        }],
      });
    });
  }
  // roof vs ceiling
  for (const r of rooms) {
    const probes = [r.at, ...r.poly.filter((_, i) => i % Math.max(1, Math.floor(r.poly.length / 12)) === 0).map((q) => lerp2(q, r.at, 0.18))];
    let worst = 0, worstAt: V2 | null = null, oh: Overhead | null = null;
    for (const q of probes) {
      const o = overheadAbove(p, q, r.floorY + 0.3);
      if (!o) continue;
      const u = ohUndersideAt(o, q);
      const limit = r.seed.ceiling === 'flat' ? r.topY : r.floorY + 2.1;
      if (limit - u > worst + 0.02) {
        worst = limit - u;
        worstAt = q;
        oh = o;
      }
    }
    if (worst > 0.05 && worstAt && oh) {
      const o = oh;
      const flat = r.seed.ceiling === 'flat';
      issues.push({
        key: `clash:${r.id}:${o.id}`, kind: 'clash',
        text: flat ? `${o.name} dips ${fmtM(worst, 2)} into ${r.name}'s ceiling.` : `${o.name} comes down to ${fmtM(r.floorY + 2.1 - worst - r.floorY)} above ${r.name}'s floor.`,
        ids: [r.id, o.id], at: [worstAt[0], r.topY, worstAt[1]], acknowledged: false,
        fixes: [
          ...(flat ? [{ label: `Lower ${r.name}'s ceiling`, apply: (q: Project) => { const s = q.rooms.find((x) => x.id === r.id); if (s) { s.height = Math.max(2.1, s.height - worst - 0.05); s.customized = true; } } }] : []),
          { label: `Raise ${o.name}`, apply: (q: Project) => { const x = q.overheads.find((y) => y.id === o.id); if (x) { if (x.restsOn) x.restOffset += worst + 0.05; x.baseY += worst + 0.05; } } },
        ],
      });
    }
  }
  // stairs
  for (const st of p.stairs) {
    const L = polyLen(st.path);
    const rise = Math.abs(st.toY - st.fromY);
    if (rise < 0.05) continue;
    const mode = stairMode(st);
    const mid = st.path[Math.floor(st.path.length / 2)];
    if (mode === 'stair') {
      const n = stairSteps(st.fromY, st.toY);
      const tread = L / n;
      if (tread < 0.24) {
        const need = n * 0.28 - L;
        issues.push({
          key: `steep:${st.id}:${n}`, kind: 'steep',
          text: `${st.name} is steep (${Math.round(tread * 100)} cm treads). It needs about ${fmtM(need)} more run.`,
          ids: [st.id], at: [mid[0], (st.fromY + st.toY) / 2 + 0.5, mid[1]], acknowledged: false,
          fixes: [{ label: `Lengthen by ${fmtM(need)}`, apply: (q) => extendPath(q, st.id, need) }],
        });
      }
    } else if (rise / L > 1 / 10) {
      const need = rise * 12 - L;
      issues.push({
        key: `steep:${st.id}:ramp`, kind: 'steep', text: `${st.name} is a steep ramp (1:${(L / rise).toFixed(0)}).`,
        ids: [st.id], at: [mid[0], (st.fromY + st.toY) / 2 + 0.5, mid[1]], acknowledged: false,
        fixes: [
          { label: 'Make it a stair', apply: (q) => { const s = q.stairs.find((x) => x.id === st.id); if (s) s.mode = 'stair'; } },
          { label: `Lengthen by ${fmtM(need)}`, apply: (q) => extendPath(q, st.id, need) },
        ],
      });
    }
  }
  // openings that do not fit
  for (const w of walls.values())
    for (const d of w.openings) {
      if (d.fits) continue;
      const ps = runGeom(w.run).ps;
      const pt = pointAtS(ps, Math.max(0, Math.min(w.L, d.s))).p;
      const label = d.o.name ?? openingKind(d.o);
      const fixes: Fix[] = [];
      const closedRun = w.run.shape === 'circle' || w.run.closed;
      if (!closedRun && (d.s0 < 0.05 || d.s1 > w.L - 0.05) && d.o.width < w.L - 0.3)
        fixes.push({ label: 'Slide it to fit', apply: (q) => { const o = q.openings.find((x) => x.id === d.o.id); if (o) { const s = Math.min(Math.max(d.s, o.width / 2 + 0.1), w.L - o.width / 2 - 0.1); o.t = s / w.L; o.anchor = 'ratio'; } } });
      if (d.why.includes('taller')) {
        const room = wallTopAt(w, d.s) - d.floor - 0.1;
        fixes.push({ label: 'Lower it to fit', apply: (q) => { const o = q.openings.find((x) => x.id === d.o.id); if (o) { o.height = Math.max(o.sill + 0.4, room); o.rise = Math.min(o.rise, o.height - o.sill); } } });
      } else fixes.push({ label: 'Make it narrower', apply: (q) => { const o = q.openings.find((x) => x.id === d.o.id); if (o) o.width = Math.max(0.5, Math.min(o.width, w.L - 0.4)); } });
      fixes.push({
        label: 'Set it aside',
        apply: (q) => {
          const o = q.openings.find((x) => x.id === d.o.id);
          if (!o) return;
          q.openings = q.openings.filter((x) => x !== o);
          q.parked.push({ id: newId(q, 'k'), what: 'opening', label, reason: 'did not fit', data: o, at: Date.now() });
        },
      });
      issues.push({ key: `fit:${d.o.id}:${d.why}`, kind: 'fit', text: `The ${label} ${d.why}.`, ids: [d.o.id, w.run.id], at: [pt[0], d.y1 + 0.3, pt[1]], fixes, acknowledged: false });
    }
  // headroom under decks
  for (const dk of p.decks) {
    for (const r of rooms) {
      if (dk.y <= r.floorY + 0.3 || dk.y > r.topY + 0.05) continue;
      const head = dk.y - dk.thick - r.floorY;
      if (head >= 2.05) continue;
      const ov = intersection(P(dk.outline), P(r.poly, r.holes));
      if (mpolyArea(ov) < 0.5) continue;
      const at = interiorPoint(ov[0][0]);
      issues.push({
        key: `headroom:${dk.id}:${r.id}`, kind: 'headroom', text: `Only ${fmtM(head)} of headroom under ${dk.name} in ${r.name}.`,
        ids: [dk.id, r.id], at: [at[0], dk.y + 0.2, at[1]], acknowledged: false,
        fixes: [{ label: `Raise ${dk.name} to 2.4 m`, apply: (q) => { const x = q.decks.find((y) => y.id === dk.id); if (x) { x.y = r.floorY + 2.4 + x.thick; x.restsOn = null; } } }],
      });
    }
  }
  return issues;
}

function polyLen(pts: V2[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

export function stairMode(st: Stair): 'stair' | 'ramp' {
  if (st.mode !== 'auto') return st.mode;
  const L = polyLen(st.path);
  const rise = Math.abs(st.toY - st.fromY);
  return rise < 0.9 && L / Math.max(rise, 0.01) >= 8 ? 'ramp' : 'stair';
}

function extendPath(q: Project, id: string, by: number) {
  const s = q.stairs.find((x) => x.id === id);
  if (!s || s.path.length < 2) return;
  const a = s.path[0], b = s.path[1];
  const d = norm(sub(a, b));
  s.path[0] = add(a, mul(d, by));
}

export function openingKind(o: Opening) {
  if (o.shape === 'arch') return o.sill < 0.3 ? 'arch' : 'arched window';
  if (o.shape === 'round') return 'round window';
  if (o.shape === 'pointed') return 'pointed arch';
  return o.sill < 0.3 ? 'doorway' : 'window';
}

export function elementName(p: Project, id: string): string {
  const e = findEl(p, id) as Element | undefined;
  if (!e) return 'something';
  switch (e.kind) {
    case 'run': return e.name ?? (e.shape === 'circle' ? 'round wall' : e.bulge.some((b) => Math.abs(b) > 0.02) ? 'curved wall' : 'wall');
    case 'opening': return e.name ?? openingKind(e);
    case 'room': return e.name;
    case 'overhead': return e.name;
    case 'deck': return e.name;
    case 'void': return e.name;
    case 'stair': return e.name;
    case 'post': return 'post';
    case 'obj': return e.name;
  }
}

/**
 * The rooms that one accepted cover may spread over, starting from `roomId`: connected through a shared wall piece
 * at least 0.3 m long, on the same level, still unroofed, and with a top within 0.3 m of the *starting* room's top —
 * compared to the start, not the previous room, so a chain cannot drift. The starting room is always first and the
 * rest are ordered by name, so a preview and a commit name the same group.
 *
 * A room is only ever added if the group still unions into a single shape with no hole: a ring of rooms around a
 * courtyard stops before it closes, because one roof outline has no way to keep that courtyard open.
 */
export function coverGroup(d: Derived, roomId: string, maxTopDrift = 0.3): string[] {
  const start = d.roomById.get(roomId);
  if (!start) return [];
  const group = new Set<string>([roomId]);
  const queue = [roomId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const w of d.walls.values()) {
      for (const pc of w.pieces) {
        const a = pc.left, b = pc.right;
        if (!a || !b || (a !== id && b !== id)) continue;
        const other = a === id ? b : a;
        if (group.has(other)) continue;
        const o = d.roomById.get(other);
        if (!o) continue;
        if (Math.abs(o.level - start.level) > 1e-6) continue;
        if (o.coveredBy) continue;
        if (Math.abs(o.topY - start.topY) > maxTopDrift) continue;
        if (Math.abs(pc.s1 - pc.s0) < 0.3) continue;
        if (!oneShape([...group, other], d)) continue;
        group.add(other);
        queue.push(other);
      }
    }
  }
  const name = (id: string) => d.roomById.get(id)?.name ?? '';
  return [roomId, ...[...group].filter((x) => x !== roomId).sort((x, y) => name(x).localeCompare(name(y)))];
}

/** True when these rooms union into one outline with no courtyard in it. */
function oneShape(ids: string[], d: Derived): boolean {
  const polys = ids.map((id) => d.roomById.get(id)?.poly).filter((q): q is V2[] => !!q && q.length > 2);
  if (polys.length !== ids.length) return false;
  const u = union(...polys.map((q) => P(q)));
  return u.length === 1 && u[0].length === 1;
}
