import * as THREE from 'three';
import { S, ctx, W, C, thing } from './state.js';
import {
  wallLength, frameAt, topAt, topPoints, openingTopAt, springOf, ceilingAtWall, fmt,
  centroid, planeY, A_JN, A_JS, modS, byId, FLOOR_Y,
} from './model.js';
import { lidRelations, knifeCut, lookWord, memberOf, viewKind, lerp, worldOf, whereIs, sideOfCamera, rad } from './actions.js';

const st = () => ctx.stage;
const P = (x, y, z) => st().project([x, y, z]);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const UP = [0, 1, 0];

export function drawAll() {
  const ov = ctx.ov;
  ov.begin();
  S.gated = [];
  const s = S.session;
  if (s?.kind === 'face') drawFace(s);
  else if (s?.kind === 'section') drawSection(s);
  else if (s?.kind === 'lift') drawLift(s);
  else if (s?.kind === 'lookup') drawLookup(s);
  else if (viewKind() === 'plan' && st().cam.flat > 0.85) drawPlan();
  else drawIdle();
  if (S.knife) drawKnife();
  if (S.beacon) drawBeacon();
  if (S.refusal) drawRefusal();
  ov.end();
}

// ---------------------------------------------------------------- the legibility gate
// A handle is offered wherever its own axis reads on screen — in Plan, in 3D, on a curve at any
// wrap — and withheld where that axis runs too close to the line of sight to drag honestly
// (a height seen from above, a width at the edge of a round wall). The number stays typeable.

const MIN_FORESHORTEN = 0.34; // cos 70°
const MIN_PX_PER_M = 14;

export function legible(world, axis) {
  const m = st().camera.matrixWorld.elements;
  const r = [m[0], m[1], m[2]];
  const a = P(...world);
  if (a.behind) return false;
  const b = P(world[0] + axis[0] * 0.1, world[1] + axis[1] * 0.1, world[2] + axis[2] * 0.1);
  const c = P(world[0] + r[0] * 0.1, world[1] + r[1] * 0.1, world[2] + r[2] * 0.1);
  const la = Math.hypot(b.x - a.x, b.y - a.y), lr = Math.hypot(c.x - a.x, c.y - a.y);
  return la >= MIN_FORESHORTEN * lr && la * 10 >= MIN_PX_PER_M;
}

function handleIf(key, spec, cls, axis) {
  if (!legible(spec.world, axis)) { S.gated.push(spec.aria || key); return false; }
  const p = P(...spec.world);
  ctx.ov.handle(key, p.x, p.y, spec, cls);
  return true;
}

// ---------------------------------------------------------------- a wall surface, as displayed
// side +1 is the room side, −1 outside, 0 the centreline (Plan). Works at any unroll.

function kit(w, side, around, extra = 0) {
  const Sm = st().sampler(w.id);
  const off = side * (w.thick / 2 + extra);
  const near = (x) => nearestS(w, x, around);
  const fr = (x) => Sm.frameS(near(x));
  return {
    w, side, around, off, near,
    world: (x, y) => Sm.point(fr(x), off, y),
    sp: (x, y) => st().project(Sm.point(fr(x), off, y)),
    normal: (x) => { const f = fr(x); return [f.nx, f.nz]; },
    tangent: (x) => { const f = fr(x); return [f.tx, 0, f.tz]; },
  };
}

function nearestS(w, s, around) {
  if (!w.closed) return s;
  const L = wallLength(w);
  let v = s;
  while (v - around > L / 2) v -= L;
  while (v - around < -L / 2) v += L;
  return v;
}

// ---------------------------------------------------------------- facing a wall

function sheetRange(s) {
  const w = s.wall, L = wallLength(w);
  if (w.kind === 'line') return { list: (n) => Array.from({ length: n + 1 }, (_, i) => (i / n) * L), lo: 0, hi: L };
  const range = lerp((Math.PI * w.r) / 2 * 0.96, L / 2, s.u);
  return {
    list: (n) => Array.from({ length: n + 1 }, (_, i) => s.sA - range + (2 * range * i) / n),
    lo: s.sA - range, hi: s.sA + range,
  };
}

// The unroll is isometric: distance along the drawn wall equals distance along the real wall
// at every curvature. The numbers are therefore always measured; only the picture foreshortens.
export const wrapDegrees = (s) => Math.round(360 * (1 - s.u));

function drawFace(s) {
  const ov = ctx.ov;
  const w = s.wall;
  const L = wallLength(w);
  const K = kit(w, s.side, s.sA);
  const sp = K.sp;
  const settled = st().cam.flat > 0.9;
  const editable = !s.unfolding && !S.busy;
  const R = sheetRange(s);
  const samples = R.list(w.kind === 'arc' ? 120 : 2);
  const seesFloor = Math.abs(st().cam.el) > rad(6);

  // as built: while the wall is off its footprint, the real wall stays drawn where it stands
  if (s.u > 0.01 && seesFloor) {
    drawHomeGhost(w);
    if (s.u < 0.985) {
      for (const o of w.openings) {
        const f = frameAt(w, o.s);
        const a = P(f.x + f.nx * K.off, 0.01, f.z + f.nz * K.off);
        ov.line(`reg-${o.id}`, a, sp(o.s, o.sill), 'reg-line');
        ov.chip(`regdot-${o.id}`, a.x, a.y, '', 'reg-dot');
      }
    }
  }

  // floor datum: straight on a settled sheet, following the wall's curve otherwise
  const dL = sp(R.lo + (w.closed ? 0.02 : 0), 0), dR = sp(R.hi - (w.closed ? 0.02 : 0), 0);
  if (settled) {
    ov.line('datum', { x: dL.x - 30, y: dL.y }, { x: dR.x + 30, y: dR.y }, 'datum');
    ov.chip('datum-k', dL.x - 34, dL.y, `floor <b>+${fmt(FLOOR_Y)}</b>`, 'datum-tag left-of');
  } else if (editable) {
    ov.path('datum', samples.map((sv) => sp(sv, 0)), 'datum');
  }

  if (editable) drawCeilingRuns(s, samples, sp, settled);

  const topPts = samples.map((sv) => sp(sv, topAt(w, modS(w, sv))));
  ov.path('top-line', topPts, S.sel === w.id ? 'top-line sel' : 'top-line');
  if (editable) drawTopHandles(s, K, R);

  for (const o of w.openings) {
    const sv = nearestS(w, o.s, s.sA);
    if (sv < R.lo || sv > R.hi) continue;
    drawOpening(o, K, { outline: true, label: true, editable, profile: true, dims: 'full' });
  }

  if (w.id === 'rotunda' && editable) {
    for (const [k, ang, name] of [['A', A_JS, 'South wall meets here'], ['B', A_JN, 'North wall meets here']]) {
      const sv = nearestS(w, ang * w.r, s.sA);
      if (sv < R.lo || sv > R.hi) continue;
      const p = sp(sv, topAt(w, modS(w, sv)));
      ov.line(`jn-${k}`, sp(sv, 0), p, 'junction');
      ov.chip(`jnl-${k}`, p.x, p.y - 16, k, 'label letter');
      if (settled) ov.chip(`jnt-${k}`, p.x, p.y - 34, name, 'note quiet above');
    }
    if (s.u > 0.05) {
      for (const sign of [-1, 1]) {
        const p = sp(s.sA + (sign * L) / 2 - sign * 0.01, topAt(w, modS(w, s.sA + L / 2)));
        ov.chip(`seam-${sign}`, p.x, p.y - 16, 'S', 'label letter seam');
      }
    }
  }

  // overall length: only where the picture can carry it — a straight wall or a flat sheet.
  // On a curve the dimension would span less picture than wall, so the length lives in the strip.
  const flatSheet = w.kind === 'line' || s.u > 0.985;
  if (settled && flatSheet && editable) {
    const a = sp(R.lo, 0), b = sp(R.hi, 0);
    const y = Math.max(a.y, b.y) + 30;
    ov.line('len-dim', { x: a.x, y }, { x: b.x, y }, 'dim');
    ov.line('len-t0', { x: a.x, y: y - 5 }, { x: a.x, y: y + 5 }, 'dim');
    ov.line('len-t1', { x: b.x, y: y - 5 }, { x: b.x, y: y + 5 }, 'dim');
    ov.chip('len-k', (a.x + b.x) / 2, y, w.kind === 'line' ? `${fmt(L)} m` : `${fmt(L)} m around · laid flat`, 'tape big', { pri: 70 });
  }

  if (settled) {
    const foot = sp(R.lo + (w.closed ? 1.4 : 0.9), 0);
    const head = sp(R.lo + (w.closed ? 1.4 : 0.9), 1.75);
    const hpx = foot.y - head.y;
    if (hpx > 16) figure(foot, hpx);
  }
}

// The wall as built, drawn in dashed slate on its real footprint whenever it has been moved for the view.
function drawHomeGhost(w) {
  const ov = ctx.ov;
  const L = wallLength(w);
  const n = 72;
  const base = [], top = [];
  for (let i = 0; i <= n; i++) {
    const sv = (i / n) * L;
    const f = frameAt(w, sv);
    base.push(P(f.x, 0.01, f.z));
    top.push(P(f.x, topAt(w, sv), f.z));
  }
  ov.path('home-base', base, 'home-ghost');
  ov.path('home-top', top, 'home-ghost');
  let best = 0, by = -Infinity;
  for (let i = 0; i < 8; i++) {
    const sv = (i / 8) * L;
    const f = frameAt(w, sv);
    const a = P(f.x, 0.01, f.z), b = P(f.x, topAt(w, sv), f.z);
    ov.line(`home-v${i}`, a, b, 'home-ghost');
    if (a.y > by) { by = a.y; best = i; }
  }
  const f = frameAt(w, (best / 8) * L);
  const q = P(f.x, 0.01, f.z);
  ov.chip('home-k', q.x, q.y + 14, `${esc(w.name)} as built`, 'note quiet', { pri: 40 });
}

function figure(foot, hpx) {
  const ov = ctx.ov;
  const k = hpx / 1.75;
  const x = foot.x, y = foot.y;
  const pts = [
    [0, 0], [0.1, 0], [0.13, 0.85], [0.16, 0.85], [0.2, 1.42], [0.26, 1.02], [0.3, 1.04], [0.22, 1.5], [0.12, 1.52],
    [0.12, 1.56], [0.18, 1.62], [0.12, 1.75], [0.02, 1.75], [-0.04, 1.62], [0.02, 1.56], [0.02, 1.52], [-0.08, 1.5], [-0.16, 1.04], [-0.12, 1.02], [-0.06, 1.42], [-0.02, 0.85], [0.02, 0.85],
  ].map(([a, b]) => ({ x: x + a * k, y: y - b * k }));
  ov.path('figure', pts, 'figure', true);
}

function drawCeilingRuns(s, samples, sp, labels) {
  const ov = ctx.ov;
  const w = s.wall;
  for (const side of [s.side, -s.side]) {
    const front = side === s.side;
    const runs = [];
    let cur = null;
    for (const sv of samples) {
      const hit = ceilingAtWall(ctx.museum, w, modS(w, sv), side);
      if (hit && (!cur || cur.c !== hit.ceiling)) { cur = { c: hit.ceiling, pts: [] }; runs.push(cur); }
      if (!hit) { cur = null; continue; }
      cur.pts.push({ sv, y: hit.y });
    }
    runs.forEach((r, i) => {
      if (r.pts.length < 2) return;
      const pts = r.pts.map((p) => sp(p.sv, p.y));
      ov.path(`ceil-${side}-${i}`, pts, front ? 'ceil-front' : 'ceil-back');
      const m = pts[Math.floor(pts.length * (front ? 0.18 : 0.5))];
      if (!labels) return;
      const txt = front ? `${esc(r.c.name)} <b>${fmt(r.pts[0].y)}</b>` : `${esc(r.c.name)} <b>${fmt(r.pts[0].y)}</b> · other side`;
      ov.chip(`ceilk-${side}-${i}`, m.x, m.y + (front ? -14 : 14), txt, front ? 'note sky-note' : 'note quiet', { pri: front ? 45 : 22 });
      if (front) {
        const gap = r.pts.filter((p) => p.y > topAt(w, modS(w, p.sv)) + 0.02);
        if (gap.length > 1) {
          const up = gap.map((p) => sp(p.sv, p.y));
          const dn = gap.map((p) => sp(p.sv, topAt(w, modS(w, p.sv)))).reverse();
          ov.path(`gap-${i}`, [...up, ...dn], 'gap-fill', true);
          const g = gap[Math.floor(gap.length / 2)];
          const amount = g.y - topAt(w, modS(w, g.sv));
          const gp = sp(g.sv, (g.y + topAt(w, modS(w, g.sv))) / 2);
          ov.chip(`gapk-${i}`, gp.x, gp.y, `${Math.round(amount * 100)} cm gap to the ceiling`, 'tape warn');
        }
      }
    });
  }
}

function drawTopHandles(s, K, R) {
  const ov = ctx.ov;
  const w = s.wall;
  const L = wallLength(w);
  for (const tp of topPoints(w)) {
    let sv;
    if (tp.s == null) sv = w.kind === 'line' ? L * 0.82 : s.sA + 1.6;
    else sv = w.closed ? nearestS(w, tp.s, s.sA) : tp.s;
    if (w.closed && tp.key === 'h1') continue;
    if (sv < R.lo - 0.01 || sv > R.hi + 0.01) continue;
    const y = topAt(w, modS(w, sv));
    const p = K.sp(sv, y);
    const name = tp.key === 'rh' ? 'ridge' : tp.key === 'h' ? 'top' : w.closed ? 'low point' : tp.key === 'h0' ? 'start' : 'end';
    handleIf(`top-${tp.key}`, {
      type: tp.key === 'rh' ? 'ridge' : 'top', wall: w.id, key: tp.key, world: K.world(sv, y), normal: K.normal(sv), s0: sv, off: K.off,
      aria: `${w.name} ${name} height`,
    }, 'handle top', UP);
    ov.chip(`topk-${tp.key}`, p.x, p.y - 22, `<span class="k">${name}</span>${fmt(y)}`, 'tape edit above', {
      'data-edit': JSON.stringify({ type: 'top', wall: w.id, key: tp.key }),
    });
  }
}

export function openingOutline(o, spf, n = 20) {
  const pts = [];
  const e0 = o.s - o.w / 2, e1 = o.s + o.w / 2;
  pts.push(spf(e0, o.sill));
  for (let i = 0; i <= n; i++) {
    const sv = e0 + (o.w * i) / n;
    pts.push(spf(sv, openingTopAt(o, sv)));
  }
  pts.push(spf(e1, o.sill));
  return pts;
}

// One opening kit for every view. `dims`: 'full' (facing: dimension lines), 'compact' (3D: numbers
// by their handles), 'plan' (from above: width along the wall; heights typed, since their axis is edge-on).
function drawOpening(o, K, opts) {
  const ov = ctx.ov;
  const w = K.w;
  const selected = S.sel === o.id;
  const spo = K.sp;
  if (opts.outline) {
    ov.path(`op-${o.id}`, openingOutline(o, spo), selected ? 'op-outline sel hit' : S.hover === o.id ? 'op-outline hov hit' : 'op-outline hit', true, { 'data-sel': o.id });
  }
  if (!opts.editable) return;
  const top = spo(o.s, o.head);
  if (!selected) {
    if (opts.label) ov.chip(`opn-${o.id}`, top.x, top.y - 12, esc(o.name), 'label ink quiet-label above', { pri: 30 });
    return;
  }
  const e0 = o.s - o.w / 2, e1 = o.s + o.w / 2;
  const sp0 = springOf(o);
  const midY = opts.dims === 'plan' ? opts.y : (o.sill + sp0) / 2;
  const base = { id: o.id, wall: w.id, off: K.off };
  const edit = (key) => ({ 'data-edit': JSON.stringify({ type: 'op', id: o.id, key }) });
  const along = (kk, x0, x1, y, n = 14) => Array.from({ length: n + 1 }, (_, i) => kk.sp(x0 + ((x1 - x0) * i) / n, y));

  // no view decides which handles exist — the gate does: from above, sill and head are edge-on and drop out
  handleIf('h-head', { ...base, type: 'op-head', world: K.world(o.s, o.head), normal: K.normal(o.s), aria: `${o.name} head` }, 'handle h', UP);
  handleIf('h-sill', { ...base, type: 'op-sill', world: K.world(o.s, o.sill), normal: K.normal(o.s), aria: `${o.name} sill` }, 'handle h', UP);
  handleIf('h-jl', { ...base, type: 'op-jamb', side: -1, world: K.world(e0, midY), s0: K.near(e0), aria: `${o.name} left jamb` }, 'handle v', K.tangent(e0));
  handleIf('h-jr', { ...base, type: 'op-jamb', side: 1, world: K.world(e1, midY), s0: K.near(e1), aria: `${o.name} right jamb` }, 'handle v', K.tangent(e1));
  const MK = opts.dims === 'plan' ? opts.dimKit : K;
  handleIf('h-move', { ...base, off: MK.off, type: 'op-move', world: MK.world(o.s, midY), s0: K.near(o.s), aria: `Move ${o.name} along the wall` }, 'handle move', K.tangent(o.s));

  if (opts.dims === 'plan') {
    const D = opts.dimKit;
    const line = along(D, e0, e1, opts.y);
    ov.path('w-dim', line, 'dim');
    ov.line('w-t0', D.sp(e0, opts.y), K.sp(e0, opts.y), 'dim');
    ov.line('w-t1', D.sp(e1, opts.y), K.sp(e1, opts.y), 'dim');
    // the three numbers stack away from the wall, on whichever side of it is open paper
    const q = opts.tapeKit.sp(o.s, opts.y), c = K.sp(o.s, opts.y);
    const dy = q.y >= c.y ? 22 : -22;
    ov.chip('w-k', q.x, q.y, `<span class="k">width</span>${fmt(o.w)}`, 'tape edit', edit('w'));
    ov.chip('pl-sill', q.x, q.y + dy, `<span class="k">sill</span>${fmt(o.sill)}`, 'tape edit', { ...edit('sill'), pri: 86 });
    ov.chip('pl-head', q.x, q.y + 2 * dy, `<span class="k">head</span>${fmt(o.head)}`, 'tape edit', { ...edit('head'), pri: 86 });
    return;
  }

  if (opts.dims === 'compact') {
    const hd = K.sp(o.s, o.head), sl = K.sp(o.s, o.sill);
    ov.chip('c-head', hd.x, hd.y - 12, `<span class="k">head</span>${fmt(o.head)}`, 'tape edit above', edit('head'));
    if (o.sill > 0.001) ov.chip('c-sill', sl.x, sl.y + 20, `<span class="k">sill</span>${fmt(o.sill)}`, 'tape edit', edit('sill'));
    const wl = K.sp(e1, midY), wr = K.sp(e0, midY);
    const right = wl.x >= wr.x;
    ov.chip('c-w', wl.x + (right ? 18 : -18), wl.y, `<span class="k">width</span>${fmt(o.w)}`, right ? 'tape edit left' : 'tape edit right-of', edit('w'));
    return;
  }

  // full: dimension lines anchored on the displayed wall — they follow the curve at any wrap
  const wy = o.sill > 0.3 ? Math.max(0.12, o.sill - 0.3) : o.head + 0.3;
  const wline = along(K, e0, e1, wy);
  ov.path('w-dim', wline, 'dim');
  const wm = wline[Math.floor(wline.length / 2)];
  ov.chip('w-k', wm.x, wm.y, `<span class="k">width</span>${fmt(o.w)}`, 'tape edit', edit('w'));
  if (opts.profile && o.profile !== 'rect') {
    handleIf('h-rise', { ...base, type: 'op-rise', world: K.world(e1, sp0), normal: K.normal(e1), aria: `${o.name} arch rise` }, 'handle spring', UP);
    const ra = spo(e1 + 0.3, sp0), rb = spo(e1 + 0.3, o.head);
    ov.line('rise-dim', ra, rb, 'dim');
    ov.chip('rise-k', ra.x + 6, (ra.y + rb.y) / 2, `<span class="k">rise</span>${fmt(o.rise)}`, 'tape edit left', edit('rise'));
    ov.path('spring-line', along(K, e0 - 0.1, e1 + 0.1, sp0, 8), 'spring');
  }
  if (o.sill > 0.001) {
    const a = spo(e0 - 0.35, 0), b = spo(e0 - 0.35, o.sill);
    ov.line('sill-dim', a, b, 'dim');
    ov.chip('sill-k', a.x - 6, (a.y + b.y) / 2, `<span class="k">sill</span>${fmt(o.sill)}`, 'tape edit right-of', edit('sill'));
  }
  const ha = spo(e0 - 0.95, 0), hb = spo(e0 - 0.95, o.head);
  ov.line('head-dim', ha, hb, 'dim');
  ov.chip('head-k', hb.x - 6, hb.y, `<span class="k">head</span>${fmt(o.head)}`, 'tape edit right-of', edit('head'));
}

// ---------------------------------------------------------------- opened along a line
// Label budget: the cut shows every source's identity quietly, but only the selection speaks at
// full strength and only the selection's derived facts (wall above, reason for absence) are drawn.

function drawSection(s) {
  const ov = ctx.ov;
  const faceOn = st().cam.flat >= 0.85;
  const { crossings, quads } = s.caps;
  const done = new Set();
  let floorTag = null;
  const sel = S.sel;
  const selT = thing(sel);
  for (const c of crossings) {
    const w = W(c.wall);
    const top = P(c.x, c.top, c.z);
    const key = `${c.wall}-${c.s.toFixed(2)}`;
    const isSel = sel === c.wall;
    if (faceOn) {
      ov.chip(`sx-top-${key}`, top.x, top.y - 12, isSel ? `${esc(w.name)} <b>${fmt(c.top)}</b>` : `${w.ref} <b>${fmt(c.top)}</b>`, isSel ? 'tape above' : 'ref above', { 'data-sel': c.wall, pri: isSel ? 90 : 26 });
    }
    if (w.top.form === 'constant' && isSel) {
      handleIf(`sx-toph-${key}`, { type: 'top', wall: w.id, key: 'h', world: [c.x, c.top, c.z], aria: `${w.name} top` }, 'handle top', UP);
    }
    const base = P(c.x, 0, c.z);
    if (!floorTag || base.x < floorTag.x) floorTag = base;
    for (const o of c.openings) {
      const th = thing(o.id);
      const hd = P(c.x, o.head, c.z), sl = P(c.x, o.sill, c.z);
      const osel = sel === o.id;
      ov.path(`sx-void-${o.id}-${key}`, [{ x: sl.x - 7, y: sl.y }, { x: hd.x - 7, y: hd.y }, { x: hd.x + 7, y: hd.y }, { x: sl.x + 7, y: sl.y }], osel ? 'void sel hit' : 'void hit', true, { 'data-sel': o.id });
      if (done.has(o.id)) continue;
      done.add(o.id);
      if (faceOn) {
        if (osel) ov.chip(`sx-opk-${o.id}`, hd.x + 16, hd.y + 13, `${esc(th.item.name)} · <span class="k">head</span>${fmt(o.head)}`, 'tape edit left', { 'data-edit': JSON.stringify({ type: 'op', id: o.id, key: 'head' }), pri: 95 });
        else ov.chip(`sx-opk-${o.id}`, hd.x + 10, hd.y + 10, th.item.ref, 'ref tiny-right', { 'data-sel': o.id, pri: 20 });
        const above = c.top - o.head;
        if (above > 0.05 && (osel || isSel)) {
          const ap = P(c.x, (c.top + o.head) / 2, c.z);
          const leftHalf = ap.x < st().w / 2;
          ov.chip(`sx-above-${o.id}`, ap.x + (leftHalf ? 16 : -16), ap.y, `${fmt(above)} of wall above`, leftHalf ? 'tape quiet left' : 'tape quiet right-of', { pri: 64 });
        }
      }
      if (osel) {
        handleIf(`sx-hh-${o.id}`, { type: 'op-head', id: o.id, world: [c.x, o.head, c.z], aria: `${th.item.name} head` }, 'handle h', UP);
        if (th.item.kind === 'window') handleIf(`sx-hs-${o.id}`, { type: 'op-sill', id: o.id, world: [c.x, o.sill, c.z], aria: `${th.item.name} sill` }, 'handle h', UP);
      }
    }
  }
  if (!faceOn) return;
  if (floorTag) ov.chip('sx-floor', floorTag.x + 10, floorTag.y + 12, `floor <b>+${fmt(FLOOR_Y)}</b>`, 'datum-tag');

  const ceilY = {};
  const longest = new Map();
  for (const q of quads) {
    if (!q.slab || !byId(ctx.museum.ceilings, q.owner)) continue;
    const len = Math.abs(q.tb - q.ta);
    if (!longest.has(q.owner) || len > longest.get(q.owner).len) longest.set(q.owner, { q, len });
  }
  for (const [owner, { q }] of longest) {
    const c = byId(ctx.museum.ceilings, owner);
    const m = P(q.a[0] + (q.b[0] - q.a[0]) * 0.3, q.a[1], q.a[2] + (q.b[2] - q.a[2]) * 0.3);
    const tag = c.rel === 'suspended' ? ' · suspended' : '';
    const isSel = sel === c.id;
    ov.chip(`sx-c-${owner}`, m.x, m.y + 13, isSel ? `${esc(c.name)} <b>${fmt(q.ya)}</b>${tag}` : `${c.ref} <b>${fmt(q.ya)}</b>${tag}`, isSel ? 'note' : 'ref', { 'data-sel': c.id, pri: isSel ? 90 : 28 });
    ceilY[c.id] = q.ya;
  }
  if (ceilY.rotc != null && ceilY.longc != null && (!sel || selT?.kind === 'ceilings')) {
    const top = P(s.home.target.x, 7.4, s.home.target.z);
    ov.chip('sx-rel', top.x, top.y, `The Rotunda ceiling sits <b>${fmt(ceilY.rotc - ceilY.longc)}</b> above the Long Gallery ceiling`, 'relnote', { pri: 40 });
  }

  // a selection the cut does not show still has a place on the drawing, with its reason
  if (sel) {
    const m = memberOf(sel);
    if (m.state === 'beyond' || m.state === 'away') {
      const p = worldOf(sel);
      if (m.state === 'away') { const [nx, nz] = s.cut.n; p[0] -= nx * 7 * s.part; p[2] -= nz * 7 * s.part; }
      const q = P(...p);
      const revealed = S.reveal && (S.reveal === sel || (selT.kind === 'openings' && S.reveal === selT.wall.id));
      ov.chip('sx-loc', q.x, q.y, '', revealed ? 'locator on' : 'locator');
      ov.chip('sx-lock', q.x, q.y + 22, `${esc(selT.item.name)} · ${revealed ? 'shown through, at its true place' : esc(m.reason)}`, 'tape locator-k', { pri: 96 });
    }
  }
}

// ---------------------------------------------------------------- lifted lid

function drawLift(s) {
  const ov = ctx.ov;
  const c = C(s.ceilId);
  const lift = st().d(c.id).y;
  if (lift > 0.05) {
    const ring = [...c.outline, c.outline[0]].map(([x, z]) => P(x, planeY(c.plane, x, z), z));
    ov.path('lid-home', ring, 'home-ghost');
    const [ax, az] = c.outline.reduce((a, p) => (P(p[0], 0, p[1]).y > P(a[0], 0, a[1]).y ? p : a), c.outline[0]);
    const q = P(ax, planeY(c.plane, ax, az), az);
    ov.chip('lid-home-k', q.x, q.y + 14, `as built · ${fmt(c.plane.base)}`, 'note quiet', { pri: 36 });
  }
  const rels = lidRelations(c);
  rels.forEach((r) => {
    const cls = r.status === 'gap' ? 'tether gap' : r.status === 'intended' ? 'tether sky' : 'tether';
    r.samples.forEach((p, i) => {
      if (i % 2) return;
      ov.line(`teth-${r.wall.id}-${i}`, P(p.x, p.top, p.z), P(p.x, p.cy + lift, p.z), cls);
    });
    if (r.status === 'gap') {
      const up = r.samples.map((p) => P(p.x, p.cy + lift, p.z));
      ov.path(`lidgap-${r.wall.id}`, up, 'lid-gap');
    }
    const m = r.samples[Math.floor(r.samples.length / 2)];
    const q = P(m.x, (m.top + m.cy + lift) / 2 + 0.3, m.z);
    let txt, cls2, attrs = { 'data-sel': r.wall.id };
    if (r.status === 'gap') { txt = `${esc(r.wall.name)} · ${Math.round(r.gap * 100)} cm gap`; cls2 = 'tape warn click'; attrs = { 'data-gap': r.wall.id }; }
    else if (r.status === 'intended') { txt = `${esc(r.wall.name)} · gap kept open`; cls2 = 'tape sky'; }
    else if (r.above > 0.05) { txt = `${esc(r.wall.name)} · meets, rises ${fmt(r.above)} above`; cls2 = 'tape quiet'; }
    else { txt = `${esc(r.wall.name)} · meets`; cls2 = 'tape quiet'; }
    const e = ov.chip(`relk-${r.wall.id}`, q.x, q.y, txt, cls2, attrs);
    if (S.popover?.wall === r.wall.id) S.popover.anchor = { x: q.x, y: q.y };
    e.dataset.anchor = '1';
  });
  for (const h of c.holes) {
    const [x, z] = centroid(h.pts);
    const q = P(x, planeY(c.plane, x, z) + lift + c.thick + 0.05, z);
    ov.chip(`hole-${h.id}`, q.x, q.y, `${esc(h.name)} · open on purpose`, 'tape sky');
  }
  if (s.lift < 0.95) return;
  const b = c.outline.reduce((a, p) => (p[0] < a[0] ? p : a), c.outline[0]);
  const hx = b[0] + 0.6, hz = c.outline.reduce((a, p) => a + p[1], 0) / c.outline.length;
  const hy = planeY(c.plane, hx, hz) + lift;
  handleIf('lid-h', { type: 'ceil-h', id: c.id, world: [hx, hy, hz], aria: `${c.name} height`, label: `<span class="k">height</span>${fmt(c.plane.base)}` }, 'handle-chip', UP);
}

// ---------------------------------------------------------------- looking up

function drawLookup(s) {
  const ov = ctx.ov;
  if (st().cam.flat < 0.85) return;
  for (const c of ctx.museum.ceilings) {
    const [x, z] = c.id === 'longc' ? [-9.6, -2.2] : c.id === 'soffit' ? [-12.2, 1.9] : centroid(c.outline);
    const y = planeY(c.plane, x, z);
    const q = P(x, y, z);
    const sel = S.sel === c.id;
    ov.chip(`lu-${c.id}`, q.x, q.y, `<span class="lu-n">${esc(c.name)}</span><span class="lu-rel">${c.rel === 'closure' ? 'closes the room' : 'suspended'}${c.form === 'shed' ? ' · sloped' : ''}</span>`, sel ? 'lu-card sel' : 'lu-card', { 'data-sel': c.id, pri: sel ? 90 : 60 });
    ov.chip(`luh-${c.id}`, q.x, q.y + 30, `<span class="k">underside</span>${fmt(c.plane.base)}`, 'tape edit', { 'data-edit': JSON.stringify({ type: 'ceil', id: c.id, key: 'base' }) });
    for (const h of c.holes) {
      const [hx, hz] = centroid(h.pts);
      const hq = P(hx, y, hz);
      ov.chip(`luhole-${h.id}`, hq.x, hq.y, `${esc(h.name)} · open`, 'tape sky');
    }
    for (const r of lidRelations(c)) {
      if (r.status === 'meets') continue;
      const pts = r.samples.map((p) => P(p.x, p.cy, p.z));
      ov.path(`lug-${c.id}-${r.wall.id}`, pts, r.status === 'gap' ? 'contact gap' : 'contact sky');
      const m = pts[Math.floor(pts.length / 2)];
      ov.chip(`lugk-${c.id}-${r.wall.id}`, m.x, m.y + 16, r.status === 'gap' ? `${Math.round(r.gap * 100)} cm gap above the ${esc(r.wall.name)}` : `gap above the ${esc(r.wall.name)} · kept open`, r.status === 'gap' ? 'tape warn' : 'tape sky');
    }
  }
  const cam = st().cam;
  const o = { x: st().w - 70, y: st().h - 86 };
  const c0 = P(cam.target.x, cam.target.y, cam.target.z);
  const ex = P(cam.target.x + 1, cam.target.y, cam.target.z);
  const nz = P(cam.target.x, cam.target.y, cam.target.z - 1);
  const norm = (a) => { const l = Math.hypot(a.x - c0.x, a.y - c0.y) || 1; return { x: (a.x - c0.x) / l, y: (a.y - c0.y) / l }; };
  const e = norm(ex), n = norm(nz);
  ov.line('cmp-n', o, { x: o.x + n.x * 30, y: o.y + n.y * 30 }, 'compass');
  ov.line('cmp-e', o, { x: o.x + e.x * 30, y: o.y + e.y * 30 }, 'compass e');
  ov.chip('cmp-nk', o.x + n.x * 42, o.y + n.y * 42, 'N', 'label letter');
  ov.chip('cmp-ek', o.x + e.x * 42, o.y + e.y * 42, 'E', 'label letter seam');
  ov.chip('cmp-k', o.x, o.y + 46, cam.mirror ? 'mirrored to match Plan' : 'as seen from below', 'note quiet');
}

// ---------------------------------------------------------------- plan
// Plan is the camera tipped down, so authoring in Plan is the same kit seen from above: position and
// width along the wall get handles; sill and head are edge-on here, so they are typed.

function drawPlan() {
  const ov = ctx.ov;
  for (const g of ctx.museum.galleries) {
    const [x, z] = g.id === 'long' ? [-6.5, 1.8] : [7.2, 1.6];
    const q = P(x, 0.02, z);
    const c = ctx.museum.ceilings.find((cc) => cc.gallery === g.id && cc.rel === 'closure');
    ov.chip(`pl-${g.id}`, q.x, q.y, `<span class="rn">${esc(g.name)}</span><span class="rr">${g.ref} · ceiling ${c ? fmt(c.plane.base) : '—'}</span>`, 'room-label', { pri: 30 });
  }
  if (S.recentCut && !S.knife) {
    const k = S.recentCut;
    const a = P(k.p0[0], 0.02, k.p0[1]), b = P(k.p1[0], 0.02, k.p1[1]);
    ov.line('pl-cut', a, b, 'recent-cut');
    const m = mid(a, b);
    const tip = P((k.p0[0] + k.p1[0]) / 2 + k.n[0] * 1.6, 0.02, (k.p0[1] + k.p1[1]) / 2 + k.n[1] * 1.6);
    ov.line('pl-cut-arrow', m, tip, 'recent-arrow');
    ov.chip('pl-cut-k', b.x + 8, b.y, 'Reopen this cut', 'chip-act', { tag: 'button', 'data-act': 'reopen-cut' });
  }
  const t = thing(S.sel);
  if (t?.kind === 'walls') {
    const w = t.item;
    const f0 = frameAt(w, 0), f1 = frameAt(w, wallLength(w));
    if (w.kind === 'line') {
      const off = 0.9;
      const a = P(f0.x - f0.nx * off, 0.02, f0.z - f0.nz * off), b = P(f1.x - f1.nx * off, 0.02, f1.z - f1.nz * off);
      ov.line('pl-wdim', a, b, 'dim');
      ov.chip('pl-wk', (a.x + b.x) / 2, (a.y + b.y) / 2, `${fmt(wallLength(w))} m · top ${fmt(topAt(w, 0))}`, 'tape');
    } else {
      const q = P(w.cx, 0.02, w.cz + w.r + 0.9);
      ov.chip('pl-wk', q.x, q.y, `${fmt(wallLength(w))} m around · top ${fmt(topAt(w, 0))}`, 'tape');
    }
  }
  if (t?.kind === 'openings') {
    const w = t.wall, o = t.item;
    drawOpening(o, kit(w, 0, o.s), { editable: !S.busy, dims: 'plan', y: 1.2, dimKit: kit(w, -1, o.s, 0.6), tapeKit: kit(w, -1, o.s, 2.4) });
  }
}

// ---------------------------------------------------------------- ordinary 3D

function drawIdle() {
  const ov = ctx.ov;
  const t = thing(S.sel);
  if (!t || S.busy) return;
  if (t.kind === 'openings') {
    const w = t.wall, o = t.item;
    const side = sideOfCamera(w, o.s);
    const K = kit(w, side, o.s, 0.01);
    drawOpening(o, K, { outline: true, editable: true, profile: false, dims: 'compact' });
    if (w.kind === 'arc') dogEar(w, o.s, side);
  } else if (t.kind === 'walls') {
    const w = t.item;
    const L = wallLength(w);
    let sv = L / 2;
    if (w.kind === 'arc') {
      const p = st().camera.position;
      sv = modS(w, (Math.atan2(p.z - w.cz, p.x - w.cx) - w.a0) * w.r);
    }
    const side = sideOfCamera(w, sv);
    const K = kit(w, side, sv);
    const y = topAt(w, sv);
    const q = K.sp(sv, y);
    if (w.top.form === 'constant') {
      handleIf('i-top', { type: 'top', wall: w.id, key: 'h', world: K.world(sv, y), normal: K.normal(sv), aria: `${w.name} height` }, 'handle top', UP);
    }
    ov.chip('i-topk', q.x, q.y - 22, `<span class="k">top</span>${fmt(y)}`, 'tape edit above', w.top.form === 'constant' ? { 'data-edit': JSON.stringify({ type: 'top', wall: w.id, key: 'h' }) } : {});
    if (w.kind === 'arc') dogEar(w, sv + 1.2, side);
  } else if (t.kind === 'ceilings') {
    const c = t.item;
    const cp = st().camera.position;
    let best = c.outline[0], bd = Infinity;
    for (const p of c.outline) { const d = Math.hypot(p[0] - cp.x, p[1] - cp.z); if (d < bd) { bd = d; best = p; } }
    const [cx, cz] = centroid(c.outline);
    const x = best[0] + (cx - best[0]) * 0.08, z = best[1] + (cz - best[1]) * 0.08;
    const q = P(x, planeY(c.plane, x, z) + c.thick, z);
    if (!q.behind) ov.chip('lidtab', q.x, q.y, '<span class="lt-grip"></span>Lift', 'lidtab', { tag: 'button', 'data-lid': c.id, 'aria-label': `Drag up to lift the ${c.name}`, pri: 99 });
  }
}

// D's dog-ear: the corner you pull to unroll a curved wall, from where you stand.
function dogEar(w, sv, side) {
  const K = kit(w, side, sv, 0.02);
  const q = K.sp(sv, topAt(w, modS(w, sv)));
  if (q.behind) return;
  ctx.ov.chip('dogear', q.x, q.y, '<span class="de-fold"></span><span class="de-tip">Pull to unroll · <b>O</b></span>', 'dogear', { tag: 'button', 'data-peel': w.id, 'data-s': modS(w, sv).toFixed(3), 'aria-label': `Pull to unroll the ${w.name}`, pri: 99 });
}

// ---------------------------------------------------------------- the knife

function drawKnife() {
  const ov = ctx.ov;
  const k = S.knife;
  if (!k.p0 || !k.p1) {
    if (S.pointer) ov.chip('kn-hint', S.pointer.x + 16, S.pointer.y + 18, 'Press and drag a line through the museum', 'note tiny-right');
    return;
  }
  const cut = knifeCut();
  const y = 0.03;
  const a = P(k.p0[0], y, k.p0[1]), b = P(k.p1[0], y, k.p1[1]);
  const [nx, nz] = cut.n, D = cut.depth;
  const band = [
    P(k.p0[0], y, k.p0[1]), P(k.p1[0], y, k.p1[1]),
    P(k.p1[0] + nx * D, y, k.p1[1] + nz * D), P(k.p0[0] + nx * D, y, k.p0[1] + nz * D),
  ];
  ov.path('kn-band', band, 'depth-band', true);
  ov.line('kn-line', a, b, 'knife-line');
  const mx = (k.p0[0] + k.p1[0]) / 2, mz = (k.p0[1] + k.p1[1]) / 2;
  const m = P(mx, y, mz);
  const tip = P(mx + nx * 2.2, y, mz + nz * 2.2);
  ov.line('kn-arrow', m, tip, 'knife-arrow');
  const far = P(mx + nx * D, y, mz + nz * D);
  ov.chip('kn-depth', far.x, far.y, `depth <b>${fmt(D)}</b>`, 'tape quiet');
  if (k.stage === 'aim') {
    // B's exploratory preview, kept: slide the line and the preview follows, before anything opens
    const sx = mx + cut.d[0] * cut.span * 0.3, sz = mz + cut.d[1] * cut.span * 0.3;
    ov.handle('kn-slide', ...xy(P(sx, y, sz)), { type: 'knife-slide', view: true, world: [sx, y, sz], aria: 'Slide the line to compare cuts' }, 'handle slide');
    ov.handle('kn-e0', a.x, a.y, { type: 'knife-end', end: 0, view: true, world: [k.p0[0], y, k.p0[1]], aria: 'Move this end of the line' }, 'handle spring');
    ov.handle('kn-e1', b.x, b.y, { type: 'knife-end', end: 1, view: true, world: [k.p1[0], y, k.p1[1]], aria: 'Move this end of the line' }, 'handle spring');
  }
  const walls = new Set(), ops = new Set();
  const nc = S.knifeCaps;
  if (nc) for (const c of nc.crossings) { walls.add(c.wall); c.openings.forEach((o) => ops.add(o.id)); }
  const txt = `${lookWord(cut)} · crosses ${walls.size} wall${walls.size === 1 ? '' : 's'}${ops.size ? `, ${ops.size} opening${ops.size === 1 ? '' : 's'}` : ''}`;
  const leftward = b.x > st().w - 240;
  ov.chip('kn-info', b.x + (leftward ? -14 : 14), b.y + (leftward ? 22 : 0), txt, leftward ? 'note tiny-right flip' : 'note tiny-right', { pri: 70 });
}
const xy = (p) => [p.x, p.y];

// ---------------------------------------------------------------- where is it?

function drawBeacon() {
  const id = S.beacon;
  const t = thing(id);
  if (!t) return;
  const r = whereIs(id);
  const p = worldOf(id);
  if (!p) return;
  const s = S.session;
  if (r.state === 'away' && s?.kind === 'section') { const [nx, nz] = s.cut.n; p[0] -= nx * 7 * s.part; p[2] -= nz * 7 * s.part; }
  let q = P(...p);
  const W0 = st().w, H0 = st().h;
  const off = q.behind || q.x < 20 || q.y < 20 || q.x > W0 - 20 || q.y > H0 - 20;
  if (q.behind) q = { x: W0 / 2, y: H0 - 40 };
  q = { x: Math.max(30, Math.min(W0 - 30, q.x)), y: Math.max(30, Math.min(H0 - 30, q.y)) };
  ctx.ov.chip('beacon', q.x, q.y, '<span class="core"></span>', off ? 'beacon edge' : 'beacon', { pri: 1000 });
  const txt = r.state === 'visible' ? `${esc(t.item.name)} · here` : `${esc(t.item.name)} · ${esc(r.reason || r.state)}`;
  ctx.ov.chip('beacon-k', q.x, q.y + 38, txt, r.state === 'visible' ? 'tape' : 'tape locator-k', { pri: 97 });
}

function drawRefusal() {
  const r = S.refusal;
  if (!r.at) return;
  ctx.ov.chip('refusal', r.at.x, r.at.y - 40, esc(r.msg), 'note warn above', { pri: 99 });
}

export { THREE };
