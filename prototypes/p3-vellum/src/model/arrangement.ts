// Rooms emerge from walls: a planar arrangement of wall centrelines, walked into faces.
import { V2, segIntersect, closestOnSeg, polyArea, pointInPoly, pointInPolyHoles, dist, sub, perp, norm, add, mul, lerp2 } from './geom2d';
import type { Run } from './types';
import { runGeom } from './runs';

export interface Face {
  poly: V2[];
  holes: V2[][];
  area: number;
}
export interface Piece {
  s0: number;
  s1: number;
  left: number; // face index or -1 (outside)
  right: number;
}
export interface Arrangement {
  faces: Face[];
  pieces: Map<string, Piece[]>;
}

interface Seg {
  run: string;
  a: V2;
  b: V2;
  sa: number;
  sb: number;
  minx: number;
  maxx: number;
  minz: number;
  maxz: number;
  splits: number[];
  idx: number; // index within run
  closed: boolean;
  n: number; // segments in run
}

const MIN_AREA = 0.3;

export function arrange(runs: Run[]): Arrangement {
  const segs: Seg[] = [];
  for (const r of runs) {
    const g = runGeom(r);
    const P = g.ps.pts;
    const n = P.length - 1;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[i + 1];
      if (dist(a, b) < 1e-6) continue;
      segs.push({
        run: r.id, a, b, sa: g.ps.s[i], sb: g.ps.s[i + 1],
        minx: Math.min(a[0], b[0]), maxx: Math.max(a[0], b[0]), minz: Math.min(a[1], b[1]), maxz: Math.max(a[1], b[1]),
        splits: [0, 1], idx: i, closed: g.ps.closed, n,
      });
    }
  }
  // sweep for intersections
  const order = segs.map((_, i) => i).sort((i, j) => segs[i].minx - segs[j].minx);
  const T = 2e-4;
  for (let oi = 0; oi < order.length; oi++) {
    const A = segs[order[oi]];
    for (let oj = oi + 1; oj < order.length; oj++) {
      const B = segs[order[oj]];
      if (B.minx > A.maxx + T) break;
      if (B.minz > A.maxz + T || A.minz > B.maxz + T) continue;
      if (A.run === B.run) {
        const d = Math.abs(A.idx - B.idx);
        if (d <= 1 || (A.closed && d === A.n - 1)) continue;
      }
      const x = segIntersect(A.a, A.b, B.a, B.b);
      if (x) {
        A.splits.push(x.t);
        B.splits.push(x.u);
        continue;
      }
      // near touches (T-junctions with float error, collinear contacts)
      for (const [S, Q] of [[A, B], [B, A]] as [Seg, Seg][]) {
        for (const [pt, tt] of [[S.a, 0], [S.b, 1]] as [V2, number][]) {
          const c = closestOnSeg(pt, Q.a, Q.b);
          if (c.d < T) {
            Q.splits.push(c.t);
            S.splits.push(tt);
          }
        }
      }
    }
  }
  // weld vertices
  const verts: V2[] = [];
  const grid = new Map<string, number[]>();
  const W = 1e-3;
  const vid = (p: V2) => {
    const gx = Math.floor(p[0] / W), gz = Math.floor(p[1] / W);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const l = grid.get(`${gx + dx},${gz + dz}`);
        if (l) for (const i of l) if (dist(verts[i], p) < W) return i;
      }
    verts.push(p);
    const k = `${gx},${gz}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(verts.length - 1);
    return verts.length - 1;
  };
  interface Edge { u: number; v: number; origins: { run: string; s0: number; s1: number; fwd: boolean }[]; alive: boolean }
  const edges: Edge[] = [];
  const ekey = new Map<string, number>();
  for (const S of segs) {
    const ts = [...new Set(S.splits.map((t) => Math.round(t * 1e7) / 1e7))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ts.length; i++) {
      const p0 = lerp2(S.a, S.b, ts[i]), p1 = lerp2(S.a, S.b, ts[i + 1]);
      const u = vid(p0), w = vid(p1);
      if (u === w) continue;
      const s0 = S.sa + (S.sb - S.sa) * ts[i], s1 = S.sa + (S.sb - S.sa) * ts[i + 1];
      const k = u < w ? `${u}|${w}` : `${w}|${u}`;
      const ex = ekey.get(k);
      const origin = { run: S.run, s0, s1, fwd: u < w };
      if (ex !== undefined) edges[ex].origins.push(origin);
      else {
        ekey.set(k, edges.length);
        edges.push({ u: Math.min(u, w), v: Math.max(u, w), origins: [origin], alive: true });
      }
    }
  }
  // prune dangling
  const adj: number[][] = verts.map(() => []);
  edges.forEach((e, i) => {
    adj[e.u].push(i);
    adj[e.v].push(i);
  });
  const deg = adj.map((l) => l.length);
  const stack = deg.map((d, i) => (d === 1 ? i : -1)).filter((i) => i >= 0);
  while (stack.length) {
    const x = stack.pop()!;
    for (const ei of adj[x]) {
      const e = edges[ei];
      if (!e.alive) continue;
      e.alive = false;
      deg[e.u]--;
      deg[e.v]--;
      const o = e.u === x ? e.v : e.u;
      if (deg[o] === 1) stack.push(o);
    }
  }
  // half-edges
  interface HE { from: number; to: number; edge: number; face: number; next: number }
  const hes: HE[] = [];
  const out: number[][] = verts.map(() => []);
  const heOf = new Map<number, number>();
  edges.forEach((e, i) => {
    if (!e.alive) return;
    heOf.set(i, hes.length);
    hes.push({ from: e.u, to: e.v, edge: i, face: -2, next: -1 });
    hes.push({ from: e.v, to: e.u, edge: i, face: -2, next: -1 });
    out[e.u].push(hes.length - 2);
    out[e.v].push(hes.length - 1);
  });
  const ang = (h: HE) => Math.atan2(verts[h.to][1] - verts[h.from][1], verts[h.to][0] - verts[h.from][0]);
  for (const l of out) l.sort((a, b) => ang(hes[a]) - ang(hes[b]));
  const pos = new Map<number, number>();
  out.forEach((l) => l.forEach((h, i) => pos.set(h, i)));
  const twin = (h: number) => (h % 2 === 0 ? h + 1 : h - 1);
  for (let h = 0; h < hes.length; h++) {
    const t = twin(h);
    const l = out[hes[h].to];
    const k = pos.get(t)!;
    hes[h].next = l[(k - 1 + l.length) % l.length];
  }
  // cycles
  const cycles: { hs: number[]; area: number; poly: V2[] }[] = [];
  for (let h = 0; h < hes.length; h++) {
    if (hes[h].face !== -2) continue;
    const hs: number[] = [];
    let c = h, guard = 0;
    while (hes[c].face === -2 && guard++ < 100000) {
      hes[c].face = cycles.length;
      hs.push(c);
      c = hes[c].next;
    }
    const poly = hs.map((x) => verts[hes[x].from]);
    cycles.push({ hs, area: polyArea(poly), poly });
  }
  const faces: Face[] = [];
  const cycleFace = new Map<number, number>();
  cycles.forEach((c, i) => {
    if (c.area > MIN_AREA) {
      cycleFace.set(i, faces.length);
      faces.push({ poly: c.poly, holes: [], area: c.area });
    }
  });
  // holes: negative cycles inside a bounded face
  cycles.forEach((c, i) => {
    if (c.area >= -MIN_AREA) {
      if (!cycleFace.has(i)) cycleFace.set(i, -1);
      return;
    }
    const h0 = hes[c.hs[0]];
    const a = verts[h0.from], b = verts[h0.to];
    const probe = add(lerp2(a, b, 0.5), mul(perp(norm(sub(b, a))), 2e-3));
    let best = -1, bestA = Infinity;
    faces.forEach((f, fi) => {
      if (f.area < bestA && f.area > -c.area && pointInPoly(probe, f.poly)) {
        best = fi;
        bestA = f.area;
      }
    });
    cycleFace.set(i, best);
    if (best >= 0) {
      faces[best].holes.push(c.poly.slice().reverse());
      faces[best].area += c.area;
    }
  });
  // pieces
  const pieces = new Map<string, Piece[]>();
  const push = (run: string, pc: Piece) => (pieces.get(run) ?? pieces.set(run, []).get(run)!).push(pc);
  const faceAt = (p: V2) => {
    let best = -1, bestA = Infinity;
    faces.forEach((f, fi) => {
      if (f.area < bestA && pointInPolyHoles(p, f.poly, f.holes)) {
        best = fi;
        bestA = f.area;
      }
    });
    return best;
  };
  edges.forEach((e, ei) => {
    let L: number, R: number;
    if (e.alive) {
      const hUV = heOf.get(ei)!;
      L = cycleFace.get(hes[hUV].face) ?? -1;
      R = cycleFace.get(hes[twin(hUV)].face) ?? -1;
    } else {
      L = R = faceAt(lerp2(verts[e.u], verts[e.v], 0.5));
    }
    for (const o of e.origins) {
      const s0 = Math.min(o.s0, o.s1), s1 = Math.max(o.s0, o.s1);
      // left of the run direction
      const runFwd = o.s1 > o.s0;
      const alongUV = o.fwd === runFwd;
      push(o.run, { s0, s1, left: alongUV ? L : R, right: alongUV ? R : L });
    }
  });
  for (const [k, l] of pieces) {
    l.sort((a, b) => a.s0 - b.s0);
    const merged: Piece[] = [];
    for (const p of l) {
      const m = merged[merged.length - 1];
      if (m && m.left === p.left && m.right === p.right && Math.abs(m.s1 - p.s0) < 1e-6) m.s1 = p.s1;
      else merged.push({ ...p });
    }
    pieces.set(k, merged);
  }
  return { faces, pieces };
}
