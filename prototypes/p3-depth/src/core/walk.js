// One walk.
//
// The authored truth of a stair is a walking line, a total rise, a width and what happens at a turn.
// Treads, risers, landings, winders, stringers, posts, handrails and infill are all derived.
// A rail is the walk offset sideways, raised by a height, with an explicit frame:
//   upright  - the infill's sides stay vertical (balusters, glass, a ribbon)
//   pitch    - the infill turns with the path (a moulded handrail's section)
// The handrail's height follows the walk's pitch line, never the stepped tread tops.

import { add, dist2, dot, mul, norm, perp, polyArea, sub, lerp2 } from './plan.js';

const UP = [0, 1, 0];

export function samplePath(spec) {
  const pts = [];
  const corners = [];
  if (spec.kind === 'helix') {
    const { cx, cy, r, turns, start = 0, dir = 1 } = spec.helix;
    const sweep = turns * Math.PI * 2;
    const n = Math.max(24, Math.ceil((Math.abs(sweep) * r) / 0.14));
    for (let i = 0; i <= n; i++) {
      const a = start + dir * sweep * (i / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  } else {
    for (const p of spec.points) pts.push([p[0], p[1]]);
    for (let i = 1; i < pts.length - 1; i++) corners.push(i);
  }
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist2(pts[i - 1], pts[i]));
  return { pts, s, length: s[s.length - 1], corners, cornerS: corners.map((i) => s[i]) };
}

function tangentAt(path, i) {
  const a = path.pts[Math.max(0, i - 1)], b = path.pts[Math.min(path.pts.length - 1, i + 1)];
  return norm(sub(b, a));
}

function pointAt(path, s) {
  const arr = path.s;
  if (s <= 0) return path.pts[0].slice();
  if (s >= path.length) return path.pts[path.pts.length - 1].slice();
  let i = 1;
  while (i < arr.length && arr[i] < s) i++;
  const k = (s - arr[i - 1]) / (arr[i] - arr[i - 1] || 1);
  return lerp2(path.pts[i - 1], path.pts[i], k);
}

function tangentAtS(path, s) {
  const p0 = pointAt(path, Math.max(0, s - 0.05));
  const p1 = pointAt(path, Math.min(path.length, s + 0.05));
  return norm(sub(p1, p0));
}

export function buildWalk(spec) {
  const width = spec.width ?? 1.15;
  const half = width / 2;
  const fromY = spec.fromY ?? 0;
  const toY = spec.toY ?? 3;
  const rise = toY - fromY;
  const path = samplePath(spec);
  const L = path.length;
  const turn = spec.turn || 'landing';
  const railH = spec.rail?.height ?? 0.95;
  const inset = 0.055;
  const thickness = 0.07;

  // ---- spans: runs and the platforms at turns
  const spans = [];
  const corners = path.corners.map((i) => ({ index: i, s: path.s[i], p: path.pts[i] }));
  let cursor = 0;
  for (const c of corners) {
    const tIn = tangentAt(path, c.index - 1);
    const tOut = tangentAt(path, c.index + 1);
    const nIn = perp(tIn), nOut = perp(tOut);
    if (c.s - cursor > 0.15) {
      spans.push({ kind: 'run', s0: cursor, s1: c.s, t: tIn, n: nIn, corner: c });
    }
    const depth = turn === 'landing' ? width : 0;
    spans.push({ kind: 'platform', s0: c.s, s1: c.s + depth, c, nIn, nOut, tIn, tOut, depth });
    cursor = c.s + depth;
  }
  if (L - cursor > 0.15) {
    const tEnd = tangentAtS(path, (cursor + L) / 2);
    spans.push({ kind: 'run', s0: cursor, s1: L, t: tEnd, n: perp(tEnd) });
  }

  const runs = spans.filter((s) => s.kind === 'run');
  const runLen = runs.reduce((n, r) => n + (r.s1 - r.s0), 0);
  const platforms = spans.filter((s) => s.kind === 'platform').length;
  const target = spec.targetRiser ?? 0.175;
  let treadTotal = Math.max(runs.length * 2, Math.round(rise / target) - platforms);

  // distribute treads over runs by length
  let assigned = 0;
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    const share = runLen > 0 ? (r.s1 - r.s0) / runLen : 1 / runs.length;
    r.count = Math.max(2, Math.round(treadTotal * share));
    assigned += r.count;
  }
  treadTotal = assigned;
  const riser = rise / (treadTotal + platforms);

  let y = fromY;
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    if (sp.kind === 'run') {
      const afterPlatform = i + 1 < spans.length && spans[i + 1].kind === 'platform';
      sp.y0 = y;
      sp.y1 = y + (sp.count + (afterPlatform ? 1 : 0)) * riser;
      sp.going = (sp.s1 - sp.s0) / sp.count;
      sp.treads = [];
      for (let k = 0; k < sp.count; k++) {
        const sa = sp.s0 + sp.going * k;
        const sb = sa + sp.going;
        const A = pointAt(path, sa), B = pointAt(path, sb);
        const nA = perp(tangentAtS(path, (sa + sb) / 2));
        sp.treads.push({
          sa, sb, A, B, nA,
          top: sp.y0 + riser * (k + 1),
          low: sp.y0 + riser * (k + 1) - thickness,
          going: sp.going,
        });
      }
      y = sp.y1;
    } else {
      sp.y = y;
      y = y;
    }
  }
  // a platform sits at its incoming run's top
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    if (sp.kind !== 'platform') continue;
    const prev = spans[i - 1];
    sp.y = prev ? prev.y1 : fromY;
  }

  // ---- profile line (the rail follows this)
  const lineY = (s) => {
    for (const sp of spans) {
      if (s < sp.s0 - 1e-9 || s > sp.s1 + 1e-9) continue;
      if (sp.kind === 'platform') return sp.y;
      const k = (s - sp.s0) / (sp.s1 - sp.s0 || 1);
      return sp.y0 + (sp.y1 - sp.y0) * Math.max(0, Math.min(1, k));
    }
    const last = spans[spans.length - 1];
    return last ? (last.y1 ?? last.y) : toY;
  };

  // ---- faces
  const faces = [];
  const face = (role, poly3, extra = {}) => faces.push({ role, poly3, ...extra });

  for (const sp of spans) {
    if (sp.kind === 'run') {
      for (const tr of sp.treads) {
        const a1 = add(tr.A, mul(tr.nA, half)), a2 = add(tr.A, mul(tr.nA, -half));
        const b1 = add(tr.B, mul(tr.nA, half)), b2 = add(tr.B, mul(tr.nA, -half));
        const yTop = tr.top, yLow = tr.low;
        face('tread', [[a1[0], yTop, a1[1]], [b1[0], yTop, b1[1]], [b2[0], yTop, b2[1]], [a2[0], yTop, a2[1]]], { index: sp.treads.indexOf(tr) });
        face('riser', [[a1[0], yLow, a1[1]], [b1[0], yLow, b1[1]], [b1[0], yTop, b1[1]], [a1[0], yTop, a1[1]]], { side: 1 });
        face('riser', [[a2[0], yLow, a2[1]], [b2[0], yLow, b2[1]], [b2[0], yTop, b2[1]], [a2[0], yTop, a2[1]]], { side: -1 });
        // nosing face (the riser under the front edge)
        face('riser', [[b1[0], yLow, b1[1]], [b1[0], yTop, b1[1]], [b2[0], yTop, b2[1]], [b2[0], yLow, b2[1]]], { front: true });
      }
      // stringers, stepped along the span: on a helix a single quad would be a
      // chord straight across the well instead of a band under the treads
      const s0 = sp.s0, s1 = sp.s1;
      const steps = Math.max(1, Math.ceil((s1 - s0) / 0.35));
      for (const side of [1, -1]) {
        for (let i = 0; i < steps; i++) {
          const sa = s0 + ((s1 - s0) * i) / steps;
          const sb = s0 + ((s1 - s0) * (i + 1)) / steps;
          const pa = pointAt(path, sa), pb = pointAt(path, sb);
          const qa = add(pa, mul(perp(tangentAtS(path, sa)), side * half));
          const qb = add(pb, mul(perp(tangentAtS(path, sb)), side * half));
          const ya = sp.y0 + ((sp.y1 - sp.y0) * i) / steps;
          const yb = sp.y0 + ((sp.y1 - sp.y0) * (i + 1)) / steps;
          face('stringer', [
            [qa[0], ya - 0.03, qa[1]], [qb[0], yb - 0.03, qb[1]],
            [qb[0], yb - 0.3, qb[1]], [qa[0], ya - 0.3, qa[1]],
          ], { side });
        }
      }
    } else {
      // platform: a landing rectangle, or two fanned winders
      const { c, nIn, nOut } = sp;
      const a1 = add(c.p, mul(nIn, half)), a2 = add(c.p, mul(nIn, -half));
      const b1 = turn === 'landing' ? add(a1, mul(nOut, width)) : add(c.p, mul(nOut, half));
      const b2 = turn === 'landing' ? add(a2, mul(nOut, width)) : add(c.p, mul(nOut, -half));
      const p3 = (p, yy) => [p[0], yy, p[1]];
      if (turn === 'landing') {
        face('platform', [p3(a1, sp.y), p3(b1, sp.y), p3(b2, sp.y), p3(a2, sp.y)]);
        face('riser', [p3(b1, sp.y - thickness), p3(b2, sp.y - thickness), p3(b2, sp.y), p3(b1, sp.y)]);
      } else {
        // the kite [a1 b1 b2 a2], split by the diagonal a1-b2: two winder treads, one riser apart
        face('platform', [p3(a1, sp.y - riser), p3(b2, sp.y - riser), p3(a2, sp.y - riser)], { winder: 1 });
        face('platform', [p3(a1, sp.y), p3(b1, sp.y), p3(b2, sp.y)], { winder: 2 });
        face('riser', [p3(a1, sp.y - riser), p3(b2, sp.y - riser), p3(b2, sp.y), p3(a1, sp.y)]);
      }
    }
  }

  // ---- rails
  const sides = spec.rail?.sides ?? [1, -1];
  const frame = spec.rail?.frame || 'upright';
  const infill = spec.rail?.infill || 'ribbon';
  const rails = [];
  const posts = [];
  const issues = [];

  for (const side of sides) {
    const pts = [];
    const push = (p, s) => {
      const last = pts[pts.length - 1];
      if (last && dist2(last.p, p) < 0.004) return;
      pts.push({ p, s, y: lineY(s) + railH });
    };
    for (const sp of spans) {
      if (sp.kind === 'run') {
        for (const tr of sp.treads) {
          const q = add(tr.A, mul(tr.nA, side * (half - inset)));
          push(q, tr.sa);
        }
        const e = pointAt(path, sp.s1);
        push(add(e, mul(sp.n, side * (half - inset))), sp.s1);
      } else {
        const { c, nIn, nOut } = sp;
        const p1 = add(c.p, mul(nIn, side * half));
        const p2 = turn === 'landing' ? add(p1, mul(nOut, width)) : add(c.p, mul(nOut, side * half));
        push([p1[0], p1[1]], c.s);
        push([p2[0], p2[1]], c.s + (turn === 'landing' ? width : 0));
      }
    }
    const endP = pointAt(path, L);
    push(add(endP, mul(perp(tangentAtS(path, L)), side * (half - inset))), L);

    // sweep a small rectangle along the rail path
    const railFaces = [];
    const p3 = pts.map((q) => [q.p[0], q.y, q.p[1]]);
    for (let i = 0; i < p3.length - 1; i++) {
      const a = p3[i], b = p3[i + 1];
      const t = norm3(sub3(b, a));
      if (!isFinite(t[0])) continue;
      const u = norm3(cross3(UP, t));
      const v = norm3(cross3(t, u));
      const hw = 0.035, hh = 0.045;
      const quad = (sgn) => {
        const o = mul3(u, sgn * hw * side);
        return [
          add3(add3(a, o), mul3(v, -hh)), add3(add3(b, o), mul3(v, -hh)),
          add3(add3(b, o), mul3(v, hh)), add3(add3(a, o), mul3(v, hh)),
        ];
      };
      railFaces.push(quad(1), quad(-1));
      railFaces.push([add3(a, mul3(v, hh)), add3(b, mul3(v, hh)), add3(b, mul3(v, -hh)), add3(a, mul3(v, -hh))]);
    }
    rails.push({ side, path: p3, points: pts, faces: railFaces });

    // infill: the band between the rail and the tread zone, paired at the same stations
    if (infill === 'balusters') {
      const bars = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1];
        const segLen = dist2(A.p, B.p);
        const n = Math.max(1, Math.round(segLen / 0.13));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const px = A.p[0] + (B.p[0] - A.p[0]) * t;
          const pz = A.p[1] + (B.p[1] - A.p[1]) * t;
          const yBase = lineY(A.s + (B.s - A.s) * t) + 0.13;
          const yTop = A.y + (B.y - A.y) * t - 0.05;
          if (yTop - yBase < 0.1) continue;
          const h = 0.014;
          const quad = (sx, sz) => [
            [px + sx - h, yBase, pz + sz], [px + sx + h, yBase, pz + sz],
            [px + sx + h, yTop, pz + sz], [px + sx - h, yTop, pz + sz],
          ];
          face('post', quad(0, -0.012));
          face('post', quad(0, 0.012));
          bars.push({ x: px, z: pz, yBase, yTop });
        }
      }
      posts.push(...bars);
    } else if (infill !== 'none') {
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1];
        const lowA = lineY(A.s) + 0.12, lowB = lineY(B.s) + 0.12;
        if (frame === 'upright') {
          const quad = [
            [A.p[0], lowA, A.p[1]], [B.p[0], lowB, B.p[1]],
            [B.p[0], B.y - 0.04, B.p[1]], [A.p[0], A.y - 0.04, A.p[1]],
          ];
          face(infill === 'glass' ? 'glass' : 'ribbon', quad, { side });
        } else {
          // pitch frame: the band tilts with the path, so its faces are not vertical
          const tA = norm(sub(B.p, A.p));
          const nA = perp(tA);
          const tilt = 0.10;
          const quad = [
            [A.p[0] + nA[0] * tilt * side, lowA, A.p[1] + nA[1] * tilt * side],
            [B.p[0] + nA[0] * tilt * side, lowB, B.p[1] + nA[1] * tilt * side],
            [B.p[0], B.y - 0.04, B.p[1]], [A.p[0], A.y - 0.04, A.p[1]],
          ];
          face('ribbon', quad, { side, tilted: true });
        }
      }
    }

    // posts at ends, corners, and between
    const postAt = (q) => {
      const yTop = q.y - 0.04, yBase = lineY(q.s) + 0.01;
      const s = 0.05;
      const x = q.p[0], z = q.p[1];
      faces.push({
        role: 'post',
        poly3: [[x - s, yBase, z - s], [x + s, yBase, z - s], [x + s, yTop, z - s], [x - s, yTop, z - s]],
      });
      faces.push({
        role: 'post',
        poly3: [[x - s, yBase, z + s], [x + s, yBase, z + s], [x + s, yTop, z + s], [x - s, yTop, z + s]],
      });
      posts.push({ x, z, yBase, yTop });
    };
    if (spec.rail?.posts !== false) {
      const stride = Math.max(2, Math.round(1.15 / Math.max(0.3, (L / Math.max(1, pts.length - 1)))));
      for (let i = 0; i < pts.length; i += stride) postAt(pts[i]);
      postAt(pts[pts.length - 1]);
    }
  }

  // ---- validation
  if (riser < 0.15 || riser > 0.2) {
    issues.push({
      code: 'riser',
      text: `The rise needs ${treadTotal + platforms} treads at ${(riser * 1000).toFixed(0)} mm each.`,
      fix: riser > 0.2 ? 'Add a tread: shorten the going or lengthen the walk.' : 'Remove a tread: lengthen the going or shorten the walk.',
    });
  }
  for (const r of runs) {
    if (r.going < 0.23) {
      issues.push({
        code: 'going',
        text: `Treads are ${(r.going * 100).toFixed(0)} cm at the walk line, under the 24 cm a foot wants.`,
        fix: 'Lengthen this run, or take the turn as a winder so the treads fan.',
      });
    }
  }
  if (spec.kind === 'helix') {
    const r = spec.helix.r;
    const walkGoing = runs[0] ? runs[0].going : 0;
    const innerGoing = walkGoing * Math.max(0, (r - half) / r);
    if (innerGoing < 0.06) {
      issues.push({
        code: 'well',
        text: `At the newel the treads are ${(innerGoing * 100).toFixed(0)} cm: the well is too tight for this width.`,
        fix: 'Widen the well, narrow the walk, or take fewer turns.',
      });
    }
  }
  if (railH < 0.85 || railH > 1.05) {
    issues.push({ code: 'rail', text: `A ${(railH * 100).toFixed(0)} cm rail is outside the usual 85–105 cm.`, fix: 'Set the rail height back into the usual band.' });
  }

  // ---- facts
  const railLen = rails.length ? rails[0].points.reduce((n, q, i, arr) => (i ? n + Math.hypot(dist2(arr[i - 1].p, q.p), q.y - arr[i - 1].y) : 0), 0) : 0;
  const bandArea = faces.filter((f) => f.role === 'ribbon' || f.role === 'glass').reduce((n, f) => n + area3(f.poly3), 0);
  const facts = {
    width, rise, riser, treads: treadTotal, platforms,
    going: runs.length ? runs[0].going : 0,
    walkLength: L,
    railLength: railLen,
    railHeight: railH,
    bandArea,
    posts: posts.length,
    turn,
    frame,
    infill,
    radius: spec.kind === 'helix' ? spec.helix.r : null,
    turns: spec.kind === 'helix' ? spec.helix.turns : null,
    innerGoing: spec.kind === 'helix' ? (runs[0]?.going ?? 0) * Math.max(0, (spec.helix.r - half) / spec.helix.r) : null,
  };

  return { faces, rails, posts, issues, facts, spans, path, lineY };
}

// tiny 3D helpers
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm3(a) { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function area3(poly) {
  let n = [0, 0, 0];
  for (let i = 1; i < poly.length - 1; i++) {
    const a = sub3(poly[i], poly[0]), b = sub3(poly[i + 1], poly[0]);
    const c = cross3(a, b);
    n = add3(n, c);
  }
  return len3(n) / 2;
}
