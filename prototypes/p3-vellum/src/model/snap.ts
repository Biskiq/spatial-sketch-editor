// Assisted drawing: where a point would rather be, and why. Snapping only moves a point and shows its reason as
// guides. It never creates a relationship: landing on a wall reports `touching`, and joining is offered separately
// (ops.offerJoin), so coinciding coordinates never become a tie by themselves.
import { V2, add, sub, mul, dot, cross, dist, norm, angleOf, fromAngle, closestOnSeg, round } from './geom2d';
import type { Project, Tie } from './types';
import { runGeom } from './runs';
import { lvl } from './settle';
import { elementName } from './derive';

export interface SnapCtx {
  /** height of the walls that count */
  level: number;
  /** capture distance in metres (from screen pixels) */
  tol: number;
  /** fixed neighbours: angles and lengths are measured from these */
  anchors?: V2[];
  /** the wall being edited: it is not snapped onto */
  exclude?: string;
  /** other corners of the thing being edited: they align, but are not snapped onto */
  own?: V2[];
  /** ⇧: 15° steps instead of 45° */
  fine?: boolean;
  /** ⌥: exactly as drawn */
  free?: boolean;
  /** snap onto wall ends and faces (default true) */
  walls?: boolean;
  /** consider walls at every height (outlines in the air line up with the walls below) */
  anyLevel?: boolean;
  /** last resort grid (m); 0 for none */
  grid?: number;
}

export interface Guide {
  a: V2;
  b: V2;
}

export interface SnapRes {
  p: V2;
  guides: Guide[];
  /** why it snapped, in words ("⊥ Gallery wall · 4.20 m") */
  label: string;
  /** the wall it landed on, if any: a position, not a join */
  touching: Tie | null;
  kind: 'free' | 'grid' | 'line' | 'cross' | 'wall' | 'corner';
}

interface Line {
  o: V2;
  d: V2;
  label: string;
  kind: 'angle' | 'align';
  /** where the guide starts */
  from: V2;
}

const WORLD45 = [0, 1, 2, 3].map((k) => (k * Math.PI) / 4);
const WORLD15 = Array.from({ length: 12 }, (_, k) => (k * Math.PI) / 12);

/** Line ∩ line, or null when (nearly) parallel. */
function cross2(a: Line, b: Line): V2 | null {
  const den = cross(a.d, b.d);
  if (Math.abs(den) < 1e-6) return null;
  const t = cross(sub(b.o, a.o), b.d) / den;
  return add(a.o, mul(a.d, t));
}

function proj(l: Line, p: V2): V2 {
  return add(l.o, mul(l.d, dot(sub(p, l.o), l.d)));
}

function lineDist(l: Line, p: V2) {
  return Math.abs(cross(l.d, sub(p, l.o)));
}

const deg = (a: number) => {
  let d = Math.round(((a * 180) / Math.PI) % 180);
  if (d < 0) d += 180;
  return d;
};

export function snapPoint(p: Project, at: V2, c: SnapCtx): SnapRes {
  const raw: SnapRes = { p: at, guides: [], label: '', touching: null, kind: 'free' };
  if (c.free) return raw;
  const tol = c.tol;
  const anchors = c.anchors ?? [];
  const runs = p.runs.filter((r) => r.id !== c.exclude && (c.anyLevel || Math.abs(lvl(r.baseY) - lvl(c.level)) < 0.04));
  const useWalls = c.walls !== false;
  const lenTxt = (q: V2) => (anchors.length ? ` · ${dist(anchors[0], q).toFixed(2)} m` : '');

  // 1 · wall ends and corners
  if (useWalls) {
    let best: SnapRes | null = null, bd = tol * 1.3;
    for (const r of runs) {
      if (r.shape !== 'path') continue;
      const g = runGeom(r);
      r.pts.forEach((q, i) => {
        const d = dist(q, at);
        if (d >= bd) return;
        bd = d;
        const end = !r.closed && (i === 0 || i === r.pts.length - 1);
        best = { p: q, guides: [], label: `${end ? 'on the end of' : 'on the corner of'} ${elementName(p, r.id)}${lenTxt(q)}`, touching: { host: r.id, t: g.L > 0 ? g.nodeS[i] / g.L : 0 }, kind: 'corner' };
      });
    }
    if (best) return best;
  }

  // 2 · candidate lines: angles from the anchors, and alignment with nearby corners
  const lines: Line[] = [];
  const wallDirs: { a: number; name: string }[] = [];
  for (const r of runs) {
    if (r.shape !== 'path') continue;
    for (let i = 0; i + 1 < r.pts.length + (r.closed ? 1 : 0); i++) {
      const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
      if ((r.bulge[i] ?? 0) !== 0 || dist(a, b) < 0.3) continue;
      if (closestOnSeg(at, a, b).d > 25) continue;
      wallDirs.push({ a: angleOf(sub(b, a)), name: elementName(p, r.id) });
    }
  }
  for (const o of anchors) {
    if (dist(o, at) < tol) continue;
    const seen: number[] = [];
    const add1 = (ang: number, label: string) => {
      const m = ((ang % Math.PI) + Math.PI) % Math.PI;
      if (seen.some((s) => Math.abs(s - m) < 0.009 || Math.abs(Math.abs(s - m) - Math.PI) < 0.009)) return;
      seen.push(m);
      lines.push({ o, d: fromAngle(m), label, kind: 'angle', from: o });
    };
    for (const w of wallDirs.slice(0, 24)) {
      add1(w.a, `∥ ${w.name}`);
      add1(w.a + Math.PI / 2, `⊥ ${w.name}`);
    }
    for (const a of c.fine ? WORLD15 : WORLD45) add1(a, `${deg(a)}°`);
  }
  const refs: V2[] = [...(c.own ?? []), ...anchors];
  for (const r of runs) if (r.shape === 'path') refs.push(...r.pts);
  let ax: Line | null = null, az: Line | null = null;
  for (const q of refs) {
    if (dist(q, at) < 1e-6 || dist(q, at) > 30) continue;
    const dx = Math.abs(q[0] - at[0]), dz = Math.abs(q[1] - at[1]);
    if (dx < tol * 0.8 && (!ax || dx < lineDist(ax, at))) ax = { o: q, d: [0, 1], label: 'in line', kind: 'align', from: q };
    if (dz < tol * 0.8 && (!az || dz < lineDist(az, at))) az = { o: q, d: [1, 0], label: 'in line', kind: 'align', from: q };
  }
  // a long line is captured by its angle (about 4°), a short one by distance; never stickier than 2 × tol
  const capture = (l: Line) => Math.min(Math.max(tol * 0.8, dist(l.o, at) * 0.07), tol * 2);
  const angleLines = lines.filter((l) => lineDist(l, at) < capture(l)).sort((a, b) => lineDist(a, at) / capture(a) - lineDist(b, at) / capture(b));
  const near = [...angleLines.slice(0, 4), ...(ax ? [ax] : []), ...(az ? [az] : [])];
  const guideOf = (l: Line, q: V2): Guide => {
    const d = dist(l.from, q);
    const dir = d > 1e-6 ? norm(sub(q, l.from)) : l.d;
    return { a: l.from, b: add(q, mul(dir, Math.min(1.5, 0.15 * d + 0.5))) };
  };

  // 3 · on a wall face: alone, or where a line crosses it
  if (useWalls) {
    let face: { q: V2; a: V2; b: V2; run: string; t: number } | null = null, fd = tol;
    for (const r of runs) {
      const g = runGeom(r);
      for (let i = 0; i + 1 < g.ps.pts.length; i++) {
        const cs = closestOnSeg(at, g.ps.pts[i], g.ps.pts[i + 1]);
        if (cs.d < fd) {
          fd = cs.d;
          const s = g.ps.s[i] + cs.t * (g.ps.s[i + 1] - g.ps.s[i]);
          face = { q: cs.q, a: g.ps.pts[i], b: g.ps.pts[i + 1], run: r.id, t: g.L > 0 ? s / g.L : 0 };
        }
      }
    }
    if (face) {
      const wl: Line = { o: face.a, d: norm(sub(face.b, face.a)), label: '', kind: 'align', from: face.a };
      let best: { q: V2; l: Line } | null = null;
      for (const l of near) {
        const x = cross2(l, wl);
        if (!x || dist(x, at) > (l.kind === 'angle' ? capture(l) : tol) * 1.2) continue;
        const cs = closestOnSeg(x, face.a, face.b);
        if (cs.d > 1e-3) continue;
        if (!best || dist(x, at) < dist(best.q, at)) best = { q: x, l };
      }
      const host = elementName(p, face.run);
      if (best) {
        const g = runGeom(runs.find((r) => r.id === face!.run)!);
        const t = (() => {
          let bs = 0, bd = Infinity;
          for (let i = 0; i + 1 < g.ps.pts.length; i++) {
            const cs = closestOnSeg(best!.q, g.ps.pts[i], g.ps.pts[i + 1]);
            if (cs.d < bd) (bd = cs.d), (bs = g.ps.s[i] + cs.t * (g.ps.s[i + 1] - g.ps.s[i]));
          }
          return g.L > 0 ? bs / g.L : 0;
        })();
        return { p: best.q, guides: [guideOf(best.l, best.q)], label: `${best.l.label} · on ${host}${lenTxt(best.q)}`, touching: { host: face.run, t }, kind: 'wall' };
      }
      return { p: face.q, guides: [], label: `on ${host}${lenTxt(face.q)}`, touching: { host: face.run, t: face.t }, kind: 'wall' };
    }
  }

  // 4 · where two lines cross (keeps a corner square to both neighbours, or square and in line)
  let cx: { q: V2; a: Line; b: Line } | null = null;
  for (let i = 0; i < near.length; i++)
    for (let j = i + 1; j < near.length; j++) {
      if (near[i].from === near[j].from && near[i].kind === 'angle' && near[j].kind === 'angle') continue;
      const x = cross2(near[i], near[j]);
      if (!x || dist(x, at) > Math.max(near[i].kind === 'angle' ? capture(near[i]) : tol, near[j].kind === 'angle' ? capture(near[j]) : tol) * 1.2) continue;
      if (!cx || dist(x, at) < dist(cx.q, at)) cx = { q: x, a: near[i], b: near[j] };
    }
  if (cx) {
    const lab = [cx.a, cx.b].map((l) => l.label).filter((x, k, arr) => arr.indexOf(x) === k).join(' · ');
    return { p: cx.q, guides: [guideOf(cx.a, cx.q), guideOf(cx.b, cx.q)], label: `${lab}${lenTxt(cx.q)}`, kind: 'cross', touching: null };
  }

  // 5 · along one line (an angle, with its length rounded) or in line with one corner
  const grid = c.grid ?? 0.05;
  const one = angleLines[0] ?? (ax && az ? null : ax ?? az);
  if (one) {
    let q = proj(one, at);
    if (one.kind === 'angle' && grid > 0) {
      const L = round(dot(sub(q, one.o), one.d), grid);
      q = add(one.o, mul(one.d, L));
    } else if (grid > 0) q = one.d[0] === 0 ? [q[0], round(q[1], grid)] : [round(q[0], grid), q[1]];
    return { p: q, guides: [guideOf(one, q)], label: `${one.label}${lenTxt(q)}`, kind: 'line', touching: null };
  }
  if (ax && az) {
    const q: V2 = [ax.o[0], az.o[1]];
    return { p: q, guides: [guideOf(ax, q), guideOf(az, q)], label: `in line${lenTxt(q)}`, kind: 'cross', touching: null };
  }

  // 6 · the grid
  if (grid > 0) return { p: [round(at[0], grid), round(at[1], grid)], guides: [], label: anchors.length ? lenTxt(at).slice(3) : '', kind: 'grid', touching: null };
  return raw;
}
