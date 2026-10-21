// Wall-run geometry: flattening, arclength, ties.
import { V2, PolyS, polyS, flattenSeg, pointAtS, closestOnPoly, dist, add, mul, sub, segLength, circlePoly } from './geom2d';
import type { Project, Run, Tie } from './types';

export interface RunGeom {
  ps: PolyS; // flattened centreline
  /** arclength at each original node (paths) */
  nodeS: number[];
  L: number;
}

const cache = new WeakMap<Run, { key: string; g: RunGeom }>();

function runKey(r: Run) {
  return r.shape === 'circle' ? `c${r.center}|${r.radius}` : `p${r.pts.join(';')}|${r.bulge.join(',')}|${r.closed}`;
}

export function runGeom(r: Run): RunGeom {
  const key = runKey(r);
  const c = cache.get(r);
  if (c && c.key === key) return c.g;
  let g: RunGeom;
  if (r.shape === 'circle') {
    const n = Math.max(40, Math.min(160, Math.ceil((2 * Math.PI * r.radius) / 0.25)));
    const pts = circlePoly(r.center, r.radius, n);
    const ps = polyS(pts, true);
    g = { ps, nodeS: [0], L: ps.L };
  } else {
    const out: V2[] = [];
    const nodeS: number[] = [];
    const nseg = r.closed ? r.pts.length : r.pts.length - 1;
    let acc = 0;
    for (let i = 0; i < nseg; i++) {
      const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
      nodeS.push(acc);
      const f = flattenSeg(a, b, r.bulge[i] ?? 0);
      for (const p of f) out.push(p);
      acc += segLength(a, b, r.bulge[i] ?? 0);
    }
    if (!r.closed) {
      out.push(r.pts[r.pts.length - 1]);
      nodeS.push(acc);
    }
    const ps = polyS(out, r.closed);
    // rescale node s to flattened arclength
    const k = acc > 0 ? ps.L / acc : 1;
    g = { ps, nodeS: nodeS.map((s) => s * k), L: ps.L };
  }
  cache.set(r, { key, g });
  return g;
}

export function pointAtT(r: Run, t: number): V2 {
  const g = runGeom(r);
  return pointAtS(g.ps, t * g.L).p;
}

export function tangentAtS(r: Run, s: number): V2 {
  return pointAtS(runGeom(r).ps, s).tan;
}

export function closestOnRun(r: Run, p: V2) {
  const g = runGeom(r);
  const c = closestOnPoly(g.ps, p);
  return { ...c, t: g.L > 0 ? c.s / g.L : 0 };
}

export function runEnds(r: Run): [V2, V2] | null {
  if (r.shape === 'circle' || r.closed) return null;
  return [r.pts[0], r.pts[r.pts.length - 1]];
}

/** Apply ties: move tied ends onto their hosts. Missing hosts drop the tie. Returns ids of runs that moved. */
export function resolveTies(p: Project): { moved: string[]; dropped: { run: string; host: string }[] } {
  const byId = new Map(p.runs.map((r) => [r.id, r]));
  const moved = new Set<string>();
  const dropped: { run: string; host: string }[] = [];
  for (let pass = 0; pass < 3; pass++) {
    for (const r of p.runs) {
      if (r.shape === 'circle' || r.closed) continue;
      for (const end of ['tieA', 'tieB'] as const) {
        const tie = r[end] as Tie | null;
        if (!tie) continue;
        const host = byId.get(tie.host);
        if (!host || host.id === r.id) {
          if (pass === 0) dropped.push({ run: r.id, host: tie.host });
          r[end] = null;
          continue;
        }
        const q = pointAtT(host, tie.t);
        const idx = end === 'tieA' ? 0 : r.pts.length - 1;
        if (dist(q, r.pts[idx]) > 1e-6) {
          r.pts[idx] = q;
          moved.add(r.id);
        }
      }
    }
  }
  return { moved: [...moved], dropped };
}

export function translateRun(r: Run, d: V2) {
  if (r.shape === 'circle') r.center = add(r.center, d);
  r.pts = r.pts.map((q) => add(q, d));
}

export function scaleRun(r: Run, k: number, o: V2) {
  const f = (q: V2) => add(o, mul(sub(q, o), k));
  if (r.shape === 'circle') {
    r.center = f(r.center);
    r.radius *= k;
  }
  r.pts = r.pts.map(f);
}

export function runLabel(r: Run) {
  if (r.name) return r.name;
  if (r.shape === 'circle') return 'round wall';
  if (r.bulge.some((b) => Math.abs(b) > 0.02)) return 'curved wall';
  return 'wall';
}
