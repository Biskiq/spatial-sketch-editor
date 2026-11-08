'use strict';
/*
 * World creation tools — Stage renderer.
 * Canvas 2D axonometric projection of the simulated world: terrain slab, ground layer
 * (floors, paths, shadows), depth-sorted items, night pass and glows, then the tool overlay.
 * A drawing device for the proposal, not a renderer design.
 *
 * Two profiles of the same world (Living Draft): Living is illustrated — sage and moss ground,
 * warm light, ink edges on what is built, a cut slab hatched like a section. Paper is the
 * same world as a technical drawing — parchment tones by value, flat light, stronger ink,
 * no hour. A profile is a way of looking, never saved into the world.
 */

const CAM = { az: -0.62, el: 0.92, scale: 21, tx: 0, ty: -1 };
const CAM_T = { ...CAM };
const VIEW = { cv: null, ctx: null, w: 1, h: 1, dpr: 1, cx: 0, cy: 0, dirty: true, plan: false };
/* Highlight state written by the tools: sel/hover ids and any extra id → mode overrides. */
const HL = { sel: null, hover: null, hoverMode: 'hover', extra: new Map(), paint: null };
let SUN = null;
let GLOWS = [];
let PROFILE = 'living';
function setProfile(p) { PROFILE = p === 'paper' ? 'paper' : 'living'; VIEW.dirty = true; }
const PAPER = () => PROFILE === 'paper';

const C = {
  paper: '#f5ecd9', ink: '#26231d', gold: '#d4ad45', goldDeep: '#a7801a', cobalt: '#2a62d6',
  erase: '#c8462f', refusal: '#7e2718', inspect: '#f2d000', soil: '#b39873', soilDeep: '#7c6448',
  floor: '#e2cfa8', glass: '#45574f', door: '#5a3f2a', opening: '#2f342e', frame: '#4a4136',
  turf: '#7f9150', forest: '#13261b',
};
/* Ink on what is built: the drafting line. Stronger on Paper, softer at night. */
const EDGE = () => (PAPER() ? 'rgba(38,35,29,.82)' : `rgba(38,35,29,${0.5 - 0.25 * (SUN ? SUN.night : 0)})`);
const EDGE_W = () => (PAPER() ? 1.05 : 0.85);
const MATS3 = { wood: '#a57b52', dark: '#4b4038', white: '#efede6', bronze: '#8f6b3a', fabric: '#7d8ea3', stone: '#aaa59a', leaf: '#5f8f5b', glass: '#d3e2e2' };
const SURFACE = { gravel: '#d8cdb7', stone: '#bfbab0', boards: '#b4946d' };

// ── colour helpers ────────────────────────────────────────────────────────────
const _rgb = new Map();
function rgbOf(hex) {
  let v = _rgb.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _rgb.set(hex, v); }
  return v;
}
/* Paper maps every colour to a parchment tone by its value, keeping a trace of its hue. */
const _paper = new Map();
function paperTone(hex) {
  let v = _paper.get(hex);
  if (!v) {
    const [r, g, b] = rgbOf(hex), L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    v = mixHex(hex, mixHex('#c4b593', '#fbf6ea', clamp((L - 0.18) / 0.74, 0, 1)), 0.86); _paper.set(hex, v);
  }
  return v;
}
function col(hex, f = 1, a = 1) {
  if (PROFILE === 'paper') hex = paperTone(hex);
  const [r, g, b] = rgbOf(hex);
  const R = Math.min(255, r * f) | 0, Gc = Math.min(255, g * f) | 0, B = Math.min(255, b * f) | 0;
  return a < 1 ? `rgba(${R},${Gc},${B},${a})` : `rgb(${R},${Gc},${B})`;
}
function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  const h = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return '#' + h(0) + h(1) + h(2);
}
const HL_TINT = { sel: ['#efcf63', 0.36], erase: ['#e0604c', 0.5], hover: ['#ffffff', 0.16], inspect: ['#f2dc5d', 0.42], ghost: ['#9fb8ec', 0.25], refuse: ['#c8462f', 0.45] };
const HL_LINE = { sel: [C.goldDeep, 2.2], erase: [C.erase, 2.2], hover: ['rgba(38,35,29,.6)', 1.25], inspect: ['#c9a400', 1.8], ghost: [C.cobalt, 1.4], refuse: [C.erase, 1.8] };
function hlOf(id) {
  if (id == null) return null;
  if (HL.extra.has(id)) return HL.extra.get(id);
  if (id === HL.sel) return 'sel';
  if (id === HL.hover) return HL.hoverMode;
  return null;
}
function tintFor(hex, hl) { const t = hl && HL_TINT[hl]; return t ? mixHex(hex, t[0], t[1]) : hex; }
/* Paint preview targets: { mat, t: [{ id, part: 'face'|'roof'|'floor', sub }] }. */
function paintOf(id, part, sub) {
  if (!HL.paint) return null;
  for (const t of HL.paint.t) if (t.id === id && t.part === part && (t.sub == null || t.sub === sub)) return MATERIALS[HL.paint.mat].color;
  return null;
}
/* The one orchestrated motion: what you just committed rises out of the ground. */
const RISE = new Map();
function riseK(id) {
  const t0 = RISE.get(id); if (t0 == null) return 1;
  const k = (performance.now() - t0) / 420;
  if (k >= 1) { RISE.delete(id); return 1; }
  VIEW.dirty = true;
  return 1 - Math.pow(1 - k, 3);
}
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }

// ── camera ────────────────────────────────────────────────────────────────────
let _ca = 1, _sa = 0, _ce = 0.6, _se = 0.8;
function camPrep() { _ca = Math.cos(CAM.az); _sa = Math.sin(CAM.az); _ce = Math.cos(CAM.el); _se = Math.sin(CAM.el); }
function P(x, y, z = 0) {
  const dx = x - CAM.tx, dy = y - CAM.ty;
  const rx = dx * _ca - dy * _sa, ry = dx * _sa + dy * _ca;
  return { x: VIEW.cx + rx * CAM.scale, y: VIEW.cy - (ry * _se + z * _ce) * CAM.scale, d: ry * _ce - z * _se };
}
function depthOf(x, y, z = 0) { const dx = x - CAM.tx, dy = y - CAM.ty; return (dx * _sa + dy * _ca) * _ce - z * _se; }
const viewDir = () => ({ x: _sa, y: _ca });
function facesViewer(n) { return n.x * _sa + n.y * _ca < 0; }
function unprojectAt(sx, sy, h) {
  const rx = (sx - VIEW.cx) / CAM.scale;
  const ry = ((VIEW.cy - sy) / CAM.scale - h * _ce) / Math.max(0.05, _se);
  return { x: rx * _ca + ry * _sa + CAM.tx, y: -rx * _sa + ry * _ca + CAM.ty };
}
function pickGround(sx, sy) {
  let h = 0, p = unprojectAt(sx, sy, 0);
  for (let k = 0; k < 7; k++) { h = hAt(p.x, p.y); p = unprojectAt(sx, sy, h); }
  return { x: p.x, y: p.y, z: hAt(p.x, p.y) };
}
function camInit(canvas) { VIEW.cv = canvas; VIEW.ctx = canvas.getContext('2d'); resizeStage(); }
function resizeStage() {
  const r = VIEW.cv.getBoundingClientRect();
  VIEW.dpr = Math.min(2, window.devicePixelRatio || 1);
  VIEW.w = Math.max(1, r.width); VIEW.h = Math.max(1, r.height);
  VIEW.cv.width = Math.round(VIEW.w * VIEW.dpr); VIEW.cv.height = Math.round(VIEW.h * VIEW.dpr);
  VIEW.cx = VIEW.w / 2; VIEW.cy = VIEW.h * 0.5;
  if (VIEW.needFrame) frameStage();
  VIEW.dirty = true;
}
/* Fit the seeded world to the Stage, leaving room for the lower working edge. */
function frameStage() {
  if (VIEW.w < 50 || VIEW.h < 50) { VIEW.needFrame = true; return; }
  VIEW.needFrame = false;
  const s = clamp(Math.min(VIEW.w / 52, (VIEW.h - 130) / 32), 8, 70);
  Object.assign(CAM, { scale: s, tx: 0, ty: -1 }); Object.assign(CAM_T, { scale: s, tx: 0, ty: -1 });
}
/* Ease the camera toward its targets. Returns true while still moving. */
function camStep() {
  let moving = false;
  for (const k of ['az', 'el', 'scale', 'tx', 'ty']) {
    const d = CAM_T[k] - CAM[k];
    if (Math.abs(d) > (k === 'scale' ? 0.02 : 0.0008)) { CAM[k] += d * 0.2; moving = true; } else CAM[k] = CAM_T[k];
  }
  return moving;
}
function setPlan(on) {
  VIEW.plan = on;
  if (on) { CAM_T.el = Math.PI / 2 - 0.0005; CAM_T.az = Math.round(CAM.az / (Math.PI / 2)) * (Math.PI / 2); }
  else { CAM_T.el = 0.92; CAM_T.az = CAM.az - 0.62 * (Math.abs(CAM.az % (Math.PI / 2)) < 0.01 ? 1 : 0); }
}

// ── sun ───────────────────────────────────────────────────────────────────────
function sunInfo(t) {
  const th = ((t - 6) / 12) * Math.PI, s = Math.sin(th);
  const elv = Math.max(0.1, (65 * Math.PI / 180) * Math.max(0, s));
  const day = clamp(s * 3.2 + 0.18, 0, 1);
  const hx = Math.cos(th), hy = -Math.max(0.25, Math.sin(Math.max(0.15, Math.min(Math.PI - 0.15, th))));
  const hl = Math.hypot(hx, hy);
  const h = { x: hx / hl, y: hy / hl };
  const v3 = { x: Math.cos(elv) * h.x, y: Math.cos(elv) * h.y, z: Math.sin(elv) };
  const warm = day > 0 ? clamp(1 - s * 2.6, 0, 1) : 0;
  return { t, th, elv, day, night: 1 - day, h, v3, warm, len: 1 / Math.tan(Math.max(0.16, elv)) };
}
function lam(n) {
  const d = n.x * SUN.v3.x + n.y * SUN.v3.y + (n.z || 0) * SUN.v3.z;
  return PROFILE === 'paper' ? 0.88 + 0.13 * Math.max(0, d) : 0.66 + 0.4 * Math.max(0, d);
}

// ── drawing helpers ───────────────────────────────────────────────────────────
function path3(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const s = P(pts[i].x, pts[i].y, pts[i].z || 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }
  ctx.closePath();
}
function fillPoly3(ctx, pts, fill, stroke, lw = 0.8) {
  path3(ctx, pts);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = stroke || fill; ctx.stroke();
}
function line3(ctx, pts, stroke, lw = 1, dash = null) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const s = P(pts[i].x, pts[i].y, pts[i].z || 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }
  ctx.setLineDash(dash || []); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]);
}
/** Ground-draped polyline (z offset above terrain). */
function drape(pts, dz = 0.04, step = 0.5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil(G.dist(pts[i], pts[i + 1]) / step));
    for (let k = 0; k < n; k++) { const p = G.lerp(pts[i], pts[i + 1], k / n); out.push({ x: p.x, y: p.y, z: hAt(p.x, p.y) + dz }); }
  }
  const l = pts[pts.length - 1]; out.push({ x: l.x, y: l.y, z: hAt(l.x, l.y) + dz });
  return out;
}
function drapeClosed(poly, dz = 0.04) { const d = drape(poly.concat([poly[0]]), dz); d.pop(); return d; }
function newellNormal(pts) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a.y - b.y) * ((a.z || 0) + (b.z || 0)); y += ((a.z || 0) - (b.z || 0)) * (a.x + b.x); z += (a.x - b.x) * (a.y + b.y);
  }
  const l = Math.hypot(x, y, z) || 1; let n = { x: x / l, y: y / l, z: z / l };
  if (n.z < 0) n = { x: -n.x, y: -n.y, z: -n.z };
  return n;
}
function centroid3(pts) { const s = pts.reduce((m, p) => ({ x: m.x + p.x, y: m.y + p.y, z: m.z + (p.z || 0) }), { x: 0, y: 0, z: 0 }); return { x: s.x / pts.length, y: s.y / pts.length, z: s.z / pts.length }; }

// ── terrain slab ──────────────────────────────────────────────────────────────
let PV = null, ORDER = null, ORDER_KEY = '';
function drawSlab(ctx) {
  const H = TER.HALF, bottom = -2.6, sides = [
    { n: { x: 0, y: -1 }, a: { x: -H, y: -H }, b: { x: H, y: -H } },
    { n: { x: 1, y: 0 }, a: { x: H, y: -H }, b: { x: H, y: H } },
    { n: { x: 0, y: 1 }, a: { x: H, y: H }, b: { x: -H, y: H } },
    { n: { x: -1, y: 0 }, a: { x: -H, y: H }, b: { x: -H, y: -H } },
  ];
  for (const s of sides) {
    if (!facesViewer(s.n)) continue;
    const top = []; for (let k = 0; k <= 40; k++) { const p = G.lerp(s.a, s.b, k / 40); top.push({ x: p.x, y: p.y, z: hAt(p.x, p.y) }); }
    const f = lam(s.n), body = top.concat([{ ...s.b, z: bottom }, { ...s.a, z: bottom }]);
    fillPoly3(ctx, body, col(C.soil, f));
    // the cut: hatched like a section, as the ground is drawn on a sheet
    ctx.save(); path3(ctx, body); ctx.clip();
    const pa = P(s.a.x, s.a.y, bottom), pb = P(s.b.x, s.b.y, bottom), x0 = Math.min(pa.x, pb.x) - 400, x1 = Math.max(pa.x, pb.x) + 40;
    const y1 = Math.max(pa.y, pb.y) + 10, step = PAPER() ? 6 : 7;
    ctx.beginPath(); for (let x = x0; x < x1; x += step) { ctx.moveTo(x, y1); ctx.lineTo(x + 400, y1 - 400); }
    ctx.strokeStyle = col(C.soilDeep, 1, PAPER() ? 0.5 : 0.32); ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
    const band = top.map((p) => ({ ...p, z: p.z - 0.35 }));
    fillPoly3(ctx, top.concat(band.slice().reverse()), col(C.turf, f));
    path3(ctx, body); ctx.strokeStyle = EDGE(); ctx.lineWidth = EDGE_W(); ctx.stroke();
  }
}

function terrainBase(i, j, z, paint) {
  if (paint) return MATERIALS[paint] ? MATERIALS[paint].color : '#a7bf87';
  const n = hash2(i, j);
  let c = mixHex('#b6c595', '#a9bc8a', n);
  if (z > 0) c = mixHex(c, '#d8d09e', clamp(z / 6, 0, 0.6));
  else if (z < 0) c = mixHex(c, '#8fa77c', clamp(-z / 3, 0, 0.6));
  return c;
}
function drawTerrain(ctx) {
  const t = world.terrain, V = TER.V, N = TER.N, h = t.h, H = TER.HALF;
  if (!PV) PV = new Float32Array(V * V * 2);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) { const p = P(i - H, j - H, h[vIdx(i, j)]); const k = vIdx(i, j) * 2; PV[k] = p.x; PV[k + 1] = p.y; }
  const key = CAM.az.toFixed(3) + ':' + CAM.el.toFixed(3);
  if (key !== ORDER_KEY) {
    ORDER = Array.from({ length: N * N }, (_, c) => c);
    const dd = new Float32Array(N * N);
    for (let c = 0; c < N * N; c++) { const i = c % N, j = (c / N) | 0; dd[c] = depthOf(i - H + 0.5, j - H + 0.5, 0); }
    ORDER.sort((a, b) => dd[b] - dd[a]); ORDER_KEY = key;
  }
  const sv = SUN.v3;
  ctx.lineJoin = 'round';
  for (const c of ORDER) {
    const i = c % N, j = (c / N) | 0;
    const k00 = vIdx(i, j), k10 = vIdx(i + 1, j), k01 = vIdx(i, j + 1), k11 = vIdx(i + 1, j + 1);
    const h00 = h[k00], h10 = h[k10], h01 = h[k01], h11 = h[k11];
    const dx = (h10 + h11 - h00 - h01) / 2, dy = (h01 + h11 - h00 - h10) / 2, nl = Math.hypot(dx, dy, 1);
    const dot = (-dx * sv.x - dy * sv.y + sv.z) / nl;
    const f = PROFILE === 'paper' ? clamp(1 + 0.45 * (dot - sv.z), 0.88, 1.06) : clamp(1 + 1.25 * (dot - sv.z), 0.62, 1.22);
    const z = (h00 + h10 + h01 + h11) / 4;
    const fill = col(terrainBase(i, j, z, t.paint[c]), f);
    ctx.beginPath();
    ctx.moveTo(PV[k00 * 2], PV[k00 * 2 + 1]); ctx.lineTo(PV[k10 * 2], PV[k10 * 2 + 1]);
    ctx.lineTo(PV[k11 * 2], PV[k11 * 2 + 1]); ctx.lineTo(PV[k01 * 2], PV[k01 * 2 + 1]); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = fill; ctx.lineWidth = 0.7; ctx.stroke();
    const wl = t.water[c];
    if (!isNaN(wl)) {
      const depth = clamp((wl - Math.min(h00, h10, h01, h11)) / 1.4, 0, 1);
      const x0 = i - H, y0 = j - H;
      path3(ctx, [{ x: x0, y: y0, z: wl }, { x: x0 + 1, y: y0, z: wl }, { x: x0 + 1, y: y0 + 1, z: wl }, { x: x0, y: y0 + 1, z: wl }]);
      const wc = col(mixHex('#b4d4cf', '#4f8696', depth), 0.96 + 0.08 * hash2(i + 3, j));
      ctx.fillStyle = wc; ctx.fill(); ctx.strokeStyle = wc; ctx.lineWidth = 0.7; ctx.stroke();
    }
  }
  // grid
  const a = VIEW.plan || PAPER() ? 1 : 0.6, paper = PAPER();
  ctx.lineWidth = 1;
  for (let k = 0; k <= N; k++) {
    const major = k % 5 === 0;
    ctx.strokeStyle = paper ? (major ? 'rgba(38,35,29,.24)' : 'rgba(38,35,29,.1)') : major ? `rgba(98,117,66,${0.34 * a})` : `rgba(127,145,80,${0.17 * a})`;
    ctx.beginPath();
    for (let m = 0; m <= N; m++) { const q = vIdx(k, m) * 2; m ? ctx.lineTo(PV[q], PV[q + 1]) : ctx.moveTo(PV[q], PV[q + 1]); }
    ctx.stroke(); ctx.beginPath();
    for (let m = 0; m <= N; m++) { const q = vIdx(m, k) * 2; m ? ctx.lineTo(PV[q], PV[q + 1]) : ctx.moveTo(PV[q], PV[q + 1]); }
    ctx.stroke();
  }
}

// ── ground layer: floors, paths ───────────────────────────────────────────────
function wallBase(wl) { return wl.base ?? 0; }
function roomBase(room) { const wl = world.walls.find((w) => w.id === room.wallIds[0]); return wl ? wallBase(wl) : 0; }
function roomTop(room) { let m = Infinity; for (const id of room.wallIds) { const wl = world.walls.find((w) => w.id === id); if (wl) m = Math.min(m, wallBase(wl) + wl.height); } return m; }

function pathRibbon(pa) {
  const S = G.resample(pa.pts, 0.35), L = [], R = [], Z = [], wet = [];
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    const n = G.left(G.norm(G.sub(b, a)));
    L.push(G.add(S[i], G.mul(n, pa.width / 2))); R.push(G.sub(S[i], G.mul(n, pa.width / 2)));
    Z.push(hAt(S[i].x, S[i].y)); wet.push(!isNaN(waterAt(S[i].x, S[i].y)));
  }
  return { S, L, R, Z, wet };
}
function drawPath(ctx, pa, opts = {}) {
  const rb = pathRibbon(pa), hl = opts.ghost ? 'ghost' : hlOf(pa.id);
  const base = SURFACE[pa.surface] || SURFACE.gravel;
  const fill = col(tintFor(base, hl), 1, opts.ghost ? 0.55 : 1);
  const edge = col(base, 0.72, opts.ghost ? 0.5 : 0.9);
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      const pts = run.map((i) => ({ ...rb.L[i], z: rb.Z[i] + 0.04 })).concat(run.slice().reverse().map((i) => ({ ...rb.R[i], z: rb.Z[i] + 0.04 })));
      path3(ctx, pts); ctx.fillStyle = fill; ctx.fill();
      line3(ctx, run.map((i) => ({ ...rb.L[i], z: rb.Z[i] + 0.04 })), edge, 1.2);
      line3(ctx, run.map((i) => ({ ...rb.R[i], z: rb.Z[i] + 0.04 })), edge, 1.2);
    }
    run = [];
  };
  for (let i = 0; i < rb.S.length; i++) { if (rb.wet[i]) flush(); else run.push(i); }
  flush();
  // texture and slope treatment
  for (let i = 0; i < rb.S.length - 1; i++) {
    if (rb.wet[i]) continue;
    const g = Math.abs(rb.Z[i + 1] - rb.Z[i]) / 0.35, steep = g > 0.28;
    const a = { ...rb.L[i], z: rb.Z[i] + 0.05 }, b = { ...rb.R[i], z: rb.Z[i] + 0.05 };
    if (steep && pa.slope === 'steps') line3(ctx, [a, b], 'rgba(70,58,42,.55)', 1.4);
    else if (steep && pa.slope === 'ramp') { line3(ctx, [a, { ...rb.L[i + 1], z: rb.Z[i + 1] + 0.45 }], 'rgba(90,80,64,.7)', 1.3); line3(ctx, [b, { ...rb.R[i + 1], z: rb.Z[i + 1] + 0.45 }], 'rgba(90,80,64,.7)', 1.3); }
    else if (pa.surface === 'boards' && i % 1 === 0) line3(ctx, [a, b], 'rgba(90,64,40,.35)', 0.8);
    else if (pa.surface === 'stone' && i % 2 === 0) line3(ctx, [a, b], 'rgba(255,255,255,.35)', 0.8);
  }
  if (hl && HL_LINE[hl] && !opts.ghost) {
    line3(ctx, rb.L.map((p, i) => ({ ...p, z: rb.Z[i] + 0.06 })), HL_LINE[hl][0], HL_LINE[hl][1]);
    line3(ctx, rb.R.map((p, i) => ({ ...p, z: rb.Z[i] + 0.06 })), HL_LINE[hl][0], HL_LINE[hl][1]);
  }
}
function drawFloors(ctx) {
  for (const r of world.rooms) {
    const poly = roomPoly(r); if (!poly) continue;
    const z = roomBase(r) + 0.03, hl = hlOf(r.id);
    const base = paintOf(r.id, 'floor') || (r.floor ? MATERIALS[r.floor].color : C.floor);
    fillPoly3(ctx, poly.map((p) => ({ ...p, z })), col(tintFor(base, hl), 1), col(base, 0.82), 1);
    // boards hint
    if (!r.floor) {
      const bb = poly.reduce((m, p) => ({ x0: Math.min(m.x0, p.x), x1: Math.max(m.x1, p.x), y0: Math.min(m.y0, p.y), y1: Math.max(m.y1, p.y) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
      ctx.save(); path3(ctx, poly.map((p) => ({ ...p, z }))); ctx.clip();
      for (let x = Math.ceil(bb.x0 * 2) / 2; x < bb.x1; x += 0.5) line3(ctx, [{ x, y: bb.y0, z }, { x, y: bb.y1, z }], 'rgba(120,96,64,.13)', 0.8);
      ctx.restore();
    }
  }
}

// ── shadows ───────────────────────────────────────────────────────────────────
function shadowPolys() {
  const out = [], off = G.mul(SUN.h, -SUN.len);
  const push = (pts2, z) => {
    const hull = G.hull(pts2); if (hull.length < 3) return;
    out.push(hull.map((p) => ({ x: p.x, y: p.y, z: z ?? hAt(p.x, p.y) + 0.05 })));
  };
  for (const wl of world.walls) {
    const pts = wallPts(wl), H = wl.height;
    for (let i = 0; i < pts.length - 1; i++) push([pts[i], pts[i + 1], G.add(pts[i + 1], G.mul(off, H)), G.add(pts[i], G.mul(off, H))]);
  }
  for (const b of world.buildings) {
    const f = footOf(b), H = bHeight(b) + (b.roof === 'flat' ? 0.3 : 1.6) + (b.base - groundRange(f).lo);
    push(f.concat(f.map((p) => G.add(p, G.mul(off, H)))));
  }
  for (const r of world.roofs) {
    const room = world.rooms.find((x) => x.id === r.roomId), poly = room && roomPoly(room); if (!poly) continue;
    const H = roomTop(room) - roomBase(room) + 1.4; push(poly.concat(poly.map((p) => G.add(p, G.mul(off, H)))));
  }
  for (const f of world.forms) { const H = f.base + f.h - groundRange(f.pts).lo; push(f.pts.concat(f.pts.map((p) => G.add(p, G.mul(off, H))))); }
  for (const o of world.objects) { const d = OBJECTS[o.item]; const r = Math.max(d.w, d.d) / 2; push(G.circlePoly(o, r * 0.8, 8).concat(G.circlePoly(G.add(o, G.mul(off, 0.8)), r * 0.7, 8))); }
  for (const p of world.plants) {
    if (p.kind === 'tree') push(G.circlePoly(G.add(p, G.mul(off, 2.4 * p.s)), 1.05 * p.s, 9));
    else if (p.kind === 'shrub') push(G.circlePoly(G.add(p, G.mul(off, 0.4 * p.s)), 0.5 * p.s, 7));
  }
  return out;
}
function drawShadows(ctx) {
  if (SUN.day < 0.05) return;
  ctx.beginPath();
  for (const poly of shadowPolys()) {
    const s = poly.map((p) => P(p.x, p.y, p.z));
    let a = 0; for (let i = 0; i < s.length; i++) { const p = s[i], q = s[(i + 1) % s.length]; a += p.x * q.y - q.x * p.y; }
    const pts = a < 0 ? s.slice().reverse() : s;
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  }
  ctx.fillStyle = PAPER() ? 'rgba(38,35,29,.07)' : `rgba(52,46,30,${0.16 * SUN.day})`; ctx.fill('nonzero');
}

// ── walls ─────────────────────────────────────────────────────────────────────
function subPoly(pts, s0, s1) {
  const out = [G.atLen(pts, s0).p]; let acc = 0;
  for (let i = 1; i < pts.length - 1; i++) { acc += G.dist(pts[i - 1], pts[i]); if (acc > s0 + 1e-6 && acc < s1 - 1e-6) out.push(pts[i]); }
  out.push(G.atLen(pts, s1).p);
  return out;
}
function isFullCut(o, wl) { return o.sill < 0.05 && o.sill + o.height >= wl.height - 0.05; }
function wallIntervals(wl, L, openings) {
  let iv = [[0, L]];
  for (const o of openings) {
    if (!isFullCut(o, wl)) continue;
    const a = o.s - o.width / 2, b = o.s + o.width / 2;
    iv = iv.flatMap(([x, y]) => (b <= x || a >= y) ? [[x, y]] : [[x, a], [b, y]].filter(([p, q]) => q - p > 0.03));
  }
  return iv;
}
/** Map wall-local (u along, v up, side ±1) to a world point on the face. */
function wallUV(pts, wl, u, v, side, extra = 0.012) {
  const at = G.atLen(pts, clamp(u, 0, G.polyLen(pts))), n = G.left(at.dir);
  return { x: at.p.x + n.x * side * (wl.thick / 2 + extra), y: at.p.y + n.y * side * (wl.thick / 2 + extra), z: wallBase(wl) + v };
}
function openingOutline(o, k = 10) {
  const w = o.width, s = o.s, sill = o.sill, top = Math.min(o.sill + o.height, 50);
  const K = OPENING_KINDS[o.kind] || {};
  if (K.round) { const r = w / 2, cy = sill + o.height / 2; return Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; return [s + r * Math.cos(a), cy + r * Math.sin(a)]; }); }
  const pts = [[s - w / 2, sill], [s + w / 2, sill]];
  if (K.arched) {
    const r = w / 2, spring = top - r;
    pts.push([s + w / 2, spring]);
    for (let i = 1; i < k; i++) { const a = (i / k) * Math.PI; pts.push([s + r * Math.cos(a), spring + r * Math.sin(a)]); }
    pts.push([s - w / 2, spring]);
  } else { pts.push([s + w / 2, top], [s - w / 2, top]); }
  return pts;
}
function drawWall(ctx, wl, opts = {}) {
  const pts = wallPts(wl), L = G.polyLen(pts), base = wallBase(wl), top = base + wl.height * (opts.ghost ? 1 : riseK(wl.id)), half = wl.thick / 2;
  const hl = opts.hl || hlOf(wl.id);
  const openings = opts.ghost ? [] : world.openings.filter((o) => o.hostKind === 'wall' && o.hostId === wl.id);
  const pieces = [];
  for (const [s0, s1] of wallIntervals(wl, L, openings)) {
    const sp = subPoly(pts, s0, s1);
    for (let i = 0; i < sp.length - 1; i++) {
      const p = sp[i], q = sp[i + 1], d = G.norm(G.sub(q, p)), n = G.left(d);
      const pL = G.add(p, G.mul(n, half)), qL = G.add(q, G.mul(n, half)), pR = G.sub(p, G.mul(n, half)), qR = G.sub(q, G.mul(n, half));
      const m = G.mid(p, q);
      pieces.push({ d: depthOf(m.x, m.y, base + wl.height / 2), draw() {
        const vis = facesViewer(n) ? 0 : 1, fn = vis ? G.mul(n, -1) : n;
        const [A, B] = vis ? [pR, qR] : [pL, qL];
        const mat = MATERIALS[wl.mat[vis]] ? MATERIALS[wl.mat[vis]].color : '#f1e6cf';
        const paintMat = paintOf(wl.id, 'face', vis) || mat;
        const face = col(tintFor(paintMat, hl), lam(fn) * 0.97);
        fillPoly3(ctx, [{ ...A, z: base - 0.25 }, { ...B, z: base - 0.25 }, { ...B, z: top }, { ...A, z: top }], face);
        line3(ctx, [{ ...A, z: base }, { ...B, z: base }], EDGE(), EDGE_W() * 0.8);
        const topC = col(tintFor(mixHex(mat, '#ffffff', 0.3), hl), 1.02);
        fillPoly3(ctx, [{ ...pL, z: top }, { ...qL, z: top }, { ...qR, z: top }, { ...pR, z: top }], topC, topC, 0.7);
        line3(ctx, [{ ...pL, z: top }, { ...qL, z: top }], EDGE(), EDGE_W());
        line3(ctx, [{ ...pR, z: top }, { ...qR, z: top }], EDGE(), EDGE_W());
      } });
    }
    // end caps
    for (const [s, sgn] of [[s0, -1], [s1, 1]]) {
      const at = G.atLen(pts, s), cn = G.mul(at.dir, sgn); if (!facesViewer(cn)) continue;
      const n = G.left(at.dir), a = G.add(at.p, G.mul(n, half)), b = G.sub(at.p, G.mul(n, half));
      pieces.push({ d: depthOf(at.p.x, at.p.y, base + wl.height / 2) - 0.01, draw() {
        fillPoly3(ctx, [{ ...a, z: base - 0.25 }, { ...b, z: base - 0.25 }, { ...b, z: top }, { ...a, z: top }], col(tintFor(MATERIALS[wl.mat[0]].color, hl), lam(cn) * 0.9), EDGE(), EDGE_W());
      } });
    }
  }
  pieces.sort((a, b) => b.d - a.d);
  for (const pc of pieces) pc.draw();
  // openings on the visible face
  for (const o of openings) {
    const at = G.atLen(pts, o.s), n = G.left(at.dir), side = facesViewer(n) ? 1 : -1;
    const ohl = hlOf(o.id), K = OPENING_KINDS[o.kind] || {};
    const outline = openingOutline(o).map(([u, v]) => wallUV(pts, wl, u, Math.min(v, wl.height), side));
    if (!isFullCut(o, wl)) {
      let fill = C.opening;
      if (wl.height * riseK(wl.id) < o.sill + o.height - 0.05) continue;
      if (o.kind === 'window' || o.kind === 'round') fill = SUN.night > 0.4 && roomsOfWall(wl.id).some((r) => world.lights.some((l) => l.roomId === r.id)) ? '#f3cf7f' : C.glass;
      if (K.blind) fill = mixHex(MATERIALS[wl.mat[side > 0 ? 0 : 1]].color, '#3a3328', 0.32);
      fillPoly3(ctx, outline, col(fill, 1), col(C.frame, 1, 0.7), 1.1);
      if (o.kind === 'window') line3(ctx, [wallUV(pts, wl, o.s, o.sill, side, 0.02), wallUV(pts, wl, o.s, o.sill + o.height, side, 0.02)], col('#e9e4d6', 1, 0.8), 1);
    }
    if (ohl && HL_LINE[ohl]) { path3(ctx, outline); ctx.lineWidth = HL_LINE[ohl][1]; ctx.strokeStyle = HL_LINE[ohl][0]; ctx.stroke(); }
  }
  // art and wall lights
  if (!opts.ghost) {
    for (const a of world.art) if (a.wallId === wl.id) drawArt(ctx, a, wl, pts);
    for (const l of world.lights) if (l.kind === 'wall' && l.wallId === wl.id) drawWallLight(ctx, l, wl, pts);
  }
  if (hl && HL_LINE[hl]) {
    const topLine = pts.map((p) => ({ ...p, z: top + 0.01 }));
    line3(ctx, topLine, HL_LINE[hl][0], HL_LINE[hl][1] + 0.6, hl === 'ghost' ? [6, 4] : null);
    if (hl !== 'ghost') line3(ctx, pts.map((p) => ({ ...p, z: base })), HL_LINE[hl][0], HL_LINE[hl][1] * 0.6);
  }
}
function drawArt(ctx, a, wl, pts) {
  const at = G.atLen(pts, a.s), n = G.mul(G.left(at.dir), a.side);
  if (!facesViewer(n)) return;
  const [w, h] = ART_SIZES[a.size], hl = hlOf(a.id), c = a.line;
  const R = (u0, u1, v0, v1, e) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => wallUV(pts, wl, a.s + u, v, a.side, e));
  fillPoly3(ctx, R(-w / 2, w / 2, c - h / 2, c + h / 2, 0.035), col(tintFor('#3d342a', hl)));
  fillPoly3(ctx, R(-w / 2 + 0.05, w / 2 - 0.05, c - h / 2 + 0.05, c + h / 2 - 0.05, 0.04), col('#f4f0e6'));
  fillPoly3(ctx, R(-w / 2 + 0.1, w / 2 - 0.1, c - h / 2 + 0.1, c + h / 2 - 0.1, 0.045), col(a.hue));
  fillPoly3(ctx, R(-w / 2 + 0.1, w / 2 - 0.1, c - h / 2 + 0.1, c - h / 6, 0.05), col(mixHex(a.hue, '#2b2b2b', 0.25)));
  if (hl && HL_LINE[hl]) { path3(ctx, R(-w / 2 - 0.03, w / 2 + 0.03, c - h / 2 - 0.03, c + h / 2 + 0.03, 0.05)); ctx.lineWidth = HL_LINE[hl][1]; ctx.strokeStyle = HL_LINE[hl][0]; ctx.stroke(); }
}
function artCentre(a) {
  const wl = world.walls.find((w) => w.id === a.wallId); if (!wl) return null;
  return wallUV(wallPts(wl), wl, a.s, a.line, a.side, 0.05);
}
function drawWallLight(ctx, l, wl, pts) {
  const at = G.atLen(pts, l.s), n = G.mul(G.left(at.dir), l.side);
  if (!facesViewer(n)) return;
  const hl = hlOf(l.id);
  const q = (u0, u1, v0, v1, e) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => wallUV(pts, wl, l.s + u, v, l.side, e));
  fillPoly3(ctx, q(-0.09, 0.09, 1.95, 2.25, 0.04), col(tintFor('#3d3a33', hl)));
  fillPoly3(ctx, q(-0.13, 0.13, 2.1, 2.3, 0.12), col(tintFor('#efe3c4', hl)));
  const c = wallUV(pts, wl, l.s, 2.2, l.side, 0.2);
  GLOWS.push({ p: c, r: 2.6, a: 0.9 });
}

// ── buildings and roofs ───────────────────────────────────────────────────────
function drawRoofFaces(ctx, faces, wallMat, roofMat, hl, ghost) {
  const sorted = faces.map((f) => ({ f, d: (() => { const c = centroid3(f.pts); return depthOf(c.x, c.y, c.z); })() })).sort((a, b) => b.d - a.d);
  for (const { f } of sorted) {
    const n = newellNormal(f.pts), base = f.part === 'gable' ? wallMat : roofMat;
    const tone = f.part === 'roofflat' ? mixHex(base, '#ffffff', 0.25) : base;
    fillPoly3(ctx, f.pts, col(tintFor(tone, hl), lam(n)), EDGE(), EDGE_W());
  }
  if (hl && HL_LINE[hl]) for (const { f } of sorted) { path3(ctx, f.pts); ctx.setLineDash(ghost ? [6, 4] : []); ctx.lineWidth = HL_LINE[hl][1] * 0.8; ctx.strokeStyle = HL_LINE[hl][0]; ctx.stroke(); ctx.setLineDash([]); }
}
function drawBuilding(ctx, b, opts = {}) {
  const foot = footOf(b), z0 = b.base, H = bHeight(b) * (opts.ghost ? 1 : riseK(b.id)), edges = bEdges(b), hl = opts.hl || hlOf(b.id);
  const lo = opts.lo ?? groundRange(foot).lo;
  const vis = edges.filter((e) => facesViewer(e.out)).sort((p, q) => { const a = G.mid(p.a, p.b), c = G.mid(q.a, q.b); return depthOf(c.x, c.y) - depthOf(a.x, a.y); });
  if (z0 - lo > 0.04) {
    for (const e of vis) fillPoly3(ctx, [{ ...e.a, z: lo - 0.2 }, { ...e.b, z: lo - 0.2 }, { ...e.b, z: z0 }, { ...e.a, z: z0 }], col(tintFor('#c2b69c', hl), lam(e.out)), EDGE(), EDGE_W() * 0.8);
  }
  const wins = opts.ghost ? [] : bWindows(b), doors = opts.ghost ? [] : world.openings.filter((o) => o.hostKind === 'building' && o.hostId === b.id);
  for (const e of vis) {
    const matKey = b.overrides[e.i] || b.mat, base = MATERIALS[matKey] ? MATERIALS[matKey].color : '#f1e6cf';
    const paintMat = paintOf(b.id, 'face', e.i) || base;
    const f = lam(e.out);
    fillPoly3(ctx, [{ ...e.a, z: z0 }, { ...e.b, z: z0 }, { ...e.b, z: z0 + H }, { ...e.a, z: z0 + H }], col(tintFor(paintMat, hl), f), EDGE(), EDGE_W());
    for (let k = 1; k < b.floors && k * STOREY < H; k++) line3(ctx, [{ ...e.a, z: z0 + k * STOREY }, { ...e.b, z: z0 + k * STOREY }], col(base, f * 0.82), 1.2);
    const onFace = (u, v, ex = 0.02) => ({ x: e.a.x + e.dir.x * u + e.out.x * ex, y: e.a.y + e.dir.y * u + e.out.y * ex, z: z0 + v });
    for (const w of wins) {
      if (w.edge !== e.i || (w.floor + 1) * STOREY > H + 0.01) continue;
      const v0 = w.floor * STOREY + w.sill, v1 = v0 + w.height, lit = SUN.night > 0.35 && hash2(b.id.length + w.s * 7, w.floor + e.i) > 0.3;
      fillPoly3(ctx, [onFace(w.s - w.width / 2, v0), onFace(w.s + w.width / 2, v0), onFace(w.s + w.width / 2, v1), onFace(w.s - w.width / 2, v1)], col(lit ? '#f3cf7f' : C.glass), col(C.frame, 1, 0.7), 1);
      line3(ctx, [onFace(w.s, v0, 0.03), onFace(w.s, v1, 0.03)], col('#e9e4d6', 1, 0.75), 0.9);
      if (lit) GLOWS.push({ p: onFace(w.s, (v0 + v1) / 2, 0.3), r: 1.4, a: 0.55 });
    }
    for (const o of doors) {
      if (o.edge !== e.i) continue;
      const v0 = o.floor * STOREY + o.sill, ohl = hlOf(o.id);
      const outline = openingOutline({ ...o, sill: v0 }).map(([u, v]) => onFace(u, v, 0.025));
      fillPoly3(ctx, outline, col(o.kind === 'door' ? C.door : o.kind === 'window' || o.kind === 'round' ? C.glass : C.opening), col(C.frame, 1, 0.8), 1.1);
      if (ohl && HL_LINE[ohl]) { path3(ctx, outline); ctx.lineWidth = HL_LINE[ohl][1]; ctx.strokeStyle = HL_LINE[ohl][0]; ctx.stroke(); }
    }
  }
  const roofMat = MATERIALS[b.roofMat] ? MATERIALS[b.roofMat].color : '#5d6a6c';
  const wallMat = MATERIALS[b.mat] ? MATERIALS[b.mat].color : '#f1e6cf';
  drawRoofFaces(ctx, roofFaces(foot, z0 + H, b.roof, b.pitch), wallMat, paintOf(b.id, 'roof') || roofMat, hl, opts.ghost);
  if (hl && HL_LINE[hl]) line3(ctx, foot.concat([foot[0]]).map((p) => ({ ...p, z: z0 + H })), HL_LINE[hl][0], HL_LINE[hl][1], opts.ghost ? [6, 4] : null);
}
function drawRoomRoof(ctx, r, opts = {}) {
  const room = world.rooms.find((x) => x.id === r.roomId); if (!room) return;
  let poly = roomPoly(room); if (!poly) return;
  if (G.area(poly) < 0) poly = poly.slice().reverse();
  const hl = opts.hl || hlOf(r.id);
  const mat = MATERIALS[r.mat || 'slate'].color;
  drawRoofFaces(ctx, roofFaces(poly, roomTop(room), r.style, PITCH[r.pitch] || PITCH.mid), '#f1e6cf', paintOf(r.id, 'roof') || mat, hl, opts.ghost);
}

// ── objects, stairs, lights, plants, bridges ──────────────────────────────────
function objBase(x, y) {
  let z = null;
  for (const r of world.rooms) { const poly = roomPoly(r); if (poly && G.inPoly({ x, y }, poly)) { z = roomBase(r) + 0.03; break; } }
  if (z == null) z = hAt(x, y);
  // things stand on the highest form under them
  const f = formAt(x, y); if (f) z = Math.max(z, f.base + f.h);
  return z;
}
function formAt(x, y, except) {
  let best = null;
  for (const f of world.forms) if (f.id !== except && G.inPoly({ x, y }, f.pts) && (!best || f.base + f.h > best.base + best.h)) best = f;
  return best;
}
/* A composed form: an extruded footprint. Faces are depth-sorted so outlines may be concave. */
function drawForm(ctx, f, opts = {}) {
  const hl = opts.hl || hlOf(f.id), H = Math.max(0.02, f.h * (opts.ghost ? 1 : riseK(f.id)));
  const color = paintOf(f.id, 'face') || (MATERIALS[f.mat] || MATERIALS.limewash).color;
  const pts = G.area(f.pts) < 0 ? f.pts.slice().reverse() : f.pts, z0 = f.base, z1 = f.base + H, faces = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], d = G.norm(G.sub(b, a)), out = { x: d.y, y: -d.x };
    if (!facesViewer(out)) continue;
    const m = G.mid(a, b); faces.push({ a, b, out, d: depthOf(m.x, m.y, (z0 + z1) / 2) });
  }
  faces.sort((p, q) => q.d - p.d);
  for (const fc of faces) {
    const c = col(tintFor(color, hl), lam(fc.out));
    fillPoly3(ctx, [{ ...fc.a, z: z0 }, { ...fc.b, z: z0 }, { ...fc.b, z: z1 }, { ...fc.a, z: z1 }], c, c, 0.6);
    line3(ctx, [{ ...fc.a, z: z0 }, { ...fc.b, z: z0 }], EDGE(), EDGE_W() * 0.8);
  }
  // silhouette verticals: where a visible side meets a hidden one
  if (pts.length <= 12) for (const fc of faces) for (const q of [fc.a, fc.b]) line3(ctx, [{ ...q, z: z0 }, { ...q, z: z1 }], EDGE(), EDGE_W() * 0.8);
  else for (const fc of faces) { const prevHidden = !faces.some((g) => g.b === fc.a), nextHidden = !faces.some((g) => g.a === fc.b); if (prevHidden) line3(ctx, [{ ...fc.a, z: z0 }, { ...fc.a, z: z1 }], EDGE(), EDGE_W()); if (nextHidden) line3(ctx, [{ ...fc.b, z: z0 }, { ...fc.b, z: z1 }], EDGE(), EDGE_W()); }
  fillPoly3(ctx, pts.map((p) => ({ ...p, z: z1 })), col(tintFor(color, hl), lam({ x: 0, y: 0, z: 1 }) * 1.04), EDGE(), EDGE_W());
  if (hl && HL_LINE[hl]) { path3(ctx, pts.map((p) => ({ ...p, z: z1 }))); ctx.setLineDash(hl === 'ghost' ? [5, 4] : []); ctx.lineWidth = HL_LINE[hl][1]; ctx.strokeStyle = HL_LINE[hl][0]; ctx.stroke(); ctx.setLineDash([]); }
}
function drawBox(ctx, corners2, z0, z1, color, hl) {
  const n = corners2.length;
  for (let i = 0; i < n; i++) {
    const a = corners2[i], b = corners2[(i + 1) % n], d = G.norm(G.sub(b, a)), out = { x: d.y, y: -d.x };
    if (!facesViewer(out)) continue;
    fillPoly3(ctx, [{ ...a, z: z0 }, { ...b, z: z0 }, { ...b, z: z1 }, { ...a, z: z1 }], col(tintFor(color, hl), lam(out)), BOX_EDGE(), 0.6);
  }
  fillPoly3(ctx, corners2.map((p) => ({ ...p, z: z1 })), col(tintFor(color, hl), lam({ x: 0, y: 0, z: 1 }) * 1.04), BOX_EDGE(), 0.6);
}
const BOX_EDGE = () => (PAPER() ? 'rgba(38,35,29,.7)' : 'rgba(38,35,29,.36)');
function rotPt(o, r, lx, ly) { return { x: o.x + lx * Math.cos(r) - ly * Math.sin(r), y: o.y + lx * Math.sin(r) + ly * Math.cos(r) }; }
function drawObject(ctx, o, opts = {}) {
  const def = OBJECTS[o.item], z = o.z ?? objBase(o.x, o.y), hl = opts.hl || hlOf(o.id);
  const parts = def.parts.slice().sort((p, q) => { const a = rotPt(o, o.r, (p[0] + p[2]) / 2, (p[1] + p[3]) / 2), b = rotPt(o, o.r, (q[0] + q[2]) / 2, (q[1] + q[3]) / 2); return depthOf(b.x, b.y, z + q[4]) - depthOf(a.x, a.y, z + p[4]); });
  for (const [x0, y0, x1, y1, z0, z1, m] of parts) {
    const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([lx, ly]) => rotPt(o, o.r, lx, ly));
    if (G.area(cs) < 0) cs.reverse();
    drawBox(ctx, cs, z + z0, z + z1, MATS3[m], hl);
  }
  if (def.blob) {
    const c = P(o.x, o.y, z + def.blob.z), r = def.blob.r * CAM.scale;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * (0.75 + 0.25 * _ce), 0, 0, Math.PI * 2);
    ctx.fillStyle = col(tintFor(MATS3[def.blob.c], hl), 1); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x - r * 0.3, c.y - r * 0.3, r * 0.45, r * 0.35, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
  }
  if (hl && HL_LINE[hl]) {
    const ring = G.circlePoly(o, Math.max(def.w, def.d) / 2 + 0.15, 20).map((p) => ({ ...p, z: z + 0.02 }));
    path3(ctx, ring); ctx.setLineDash(hl === 'ghost' ? [5, 4] : []); ctx.lineWidth = HL_LINE[hl][1]; ctx.strokeStyle = HL_LINE[hl][0]; ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawStair(ctx, st, opts = {}) {
  const hl = opts.hl || hlOf(st.id), d = G.norm(G.sub(st.b, st.a)), n = G.left(d), L = G.dist(st.a, st.b);
  const count = Math.max(2, Math.round((st.z1 - st.z0) / 0.17)), run = L / count, rise = (st.z1 - st.z0) / count, w = st.width / 2;
  const steps = [];
  for (let i = 0; i < count; i++) {
    const p0 = G.add(st.a, G.mul(d, i * run)), p1 = G.add(st.a, G.mul(d, (i + 1) * run));
    const cs = [G.add(p0, G.mul(n, -w)), G.add(p1, G.mul(n, -w)), G.add(p1, G.mul(n, w)), G.add(p0, G.mul(n, w))];
    const m = G.mid(p0, p1); steps.push({ cs: G.area(cs) < 0 ? cs.reverse() : cs, z: st.z0 + (i + 1) * rise, d: depthOf(m.x, m.y, st.z0 + i * rise) });
  }
  steps.sort((a, b) => b.d - a.d);
  for (const s of steps) drawBox(ctx, s.cs, st.z0 - 0.2, s.z, opts.refuse ? '#e7a196' : '#cfc6b4', hl);
}
function lightPos(l) {
  if (l.kind === 'wall') { const wl = world.walls.find((w) => w.id === l.wallId); return wl ? wallUV(wallPts(wl), wl, l.s, 2.2, l.side, 0.2) : null; }
  const z = objBase(l.x, l.y);
  if (l.kind === 'pendant') return { x: l.x, y: l.y, z: z + 2.25 };
  if (l.kind === 'lamp') return { x: l.x, y: l.y, z: z + 1.6 };
  return { x: l.x, y: l.y, z: z + 0.3 };
}
function drawLight(ctx, l, opts = {}) {
  const hl = opts.hl || hlOf(l.id), z = objBase(l.x, l.y), ink = col(tintFor('#2f302b', hl));
  if (l.kind === 'pendant') {
    const room = world.rooms.find((r) => r.id === l.roomId), ceil = room ? roomTop(room) : z + 3;
    line3(ctx, [{ x: l.x, y: l.y, z: ceil }, { x: l.x, y: l.y, z: z + 2.3 }], ink, 1);
    const c = P(l.x, l.y, z + 2.22), r = 0.22 * CAM.scale;
    ctx.beginPath(); ctx.moveTo(c.x - r, c.y + r * 0.35); ctx.lineTo(c.x - r * 0.35, c.y - r * 0.4); ctx.lineTo(c.x + r * 0.35, c.y - r * 0.4); ctx.lineTo(c.x + r, c.y + r * 0.35); ctx.closePath();
    ctx.fillStyle = col(tintFor('#ece2c8', hl)); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    GLOWS.push({ p: { x: l.x, y: l.y, z: z + 2.1 }, r: 4.2, a: 1 });
  } else if (l.kind === 'lamp') {
    line3(ctx, [{ x: l.x, y: l.y, z }, { x: l.x, y: l.y, z: z + 1.5 }], ink, 1.6);
    const c = P(l.x, l.y, z + 1.62), r = 0.2 * CAM.scale;
    ctx.beginPath(); ctx.moveTo(c.x - r, c.y + r * 0.5); ctx.lineTo(c.x - r * 0.6, c.y - r * 0.5); ctx.lineTo(c.x + r * 0.6, c.y - r * 0.5); ctx.lineTo(c.x + r, c.y + r * 0.5); ctx.closePath();
    ctx.fillStyle = col(tintFor('#efe3c4', hl)); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    GLOWS.push({ p: { x: l.x, y: l.y, z: z + 1.5 }, r: 3.2, a: 0.9 });
  } else if (l.kind === 'spot') {
    const cs = G.circlePoly(l, 0.14, 8); drawBox(ctx, cs, z, z + 0.12, '#3a3a35', hl);
    const tgt = spotTarget(l), head = { x: l.x, y: l.y, z: z + 0.3 };
    let dir = tgt ? G.norm(G.sub(tgt, l)) : { x: Math.cos(l.r || 0), y: Math.sin(l.r || 0) };
    line3(ctx, [{ x: l.x, y: l.y, z: z + 0.12 }, head], ink, 1.4);
    line3(ctx, [head, { x: head.x + dir.x * 0.3, y: head.y + dir.y * 0.3, z: head.z + 0.12 }], ink, 3);
    if (tgt) GLOWS.push({ cone: true, from: head, to: tgt, a: 1 });
    else GLOWS.push({ p: head, r: 2.2, a: 0.7 });
  }
  if (hl && HL_LINE[hl]) {
    const ring = G.circlePoly(l, 0.35, 16).map((p) => ({ ...p, z: z + 0.02 }));
    path3(ctx, ring); ctx.lineWidth = HL_LINE[hl][1]; ctx.strokeStyle = HL_LINE[hl][0]; ctx.stroke();
  }
}
function spotTarget(l) {
  if (l.aimAt) { const a = world.art.find((x) => x.id === l.aimAt); if (a) return artCentre(a); }
  if (l.aimPoint) return l.aimPoint;
  return null;
}
const PLANT_C = { tree: ['#5f8a55', '#6e9a5b', '#4f7d4f', '#7a9e57'], shrub: ['#6f9963', '#5d8b5c', '#86a565'], flower: ['#e7a3b5', '#f2d36b', '#f6f2e8', '#b9a3dd'], grass: ['#9cb66e', '#b0bf74'] };
function drawPlant(ctx, p, hl) {
  const z = hAt(p.x, p.y), s = p.s, cs = PLANT_C[p.kind], c = cs[Math.floor(p.v * cs.length) % cs.length];
  const sc = CAM.scale;
  if (p.kind === 'tree') {
    const b = P(p.x, p.y, z), t = P(p.x, p.y, z + 1.5 * s);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = '#6b5139'; ctx.lineWidth = Math.max(1.2, 0.2 * s * sc); ctx.stroke();
    const k = P(p.x, p.y, z + 2.5 * s), r = 1.1 * s * sc;
    const crown = PAPER() ? '#eee5cf' : c, ink = PAPER() ? 'rgba(38,35,29,.7)' : 'rgba(30,44,30,.32)';
    ctx.beginPath(); ctx.arc(k.x, k.y, r, 0, Math.PI * 2); ctx.fillStyle = col(tintFor(crown, hl), 0.92); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.stroke();
    if (p.v > 0.45) { ctx.beginPath(); ctx.arc(k.x + r * 0.35, k.y - r * 0.55, r * 0.62, 0, Math.PI * 2); ctx.fillStyle = col(tintFor(crown, hl), 0.98); ctx.fill(); ctx.stroke(); }
    const hp = P(p.x + SUN.h.x * 0.45 * s, p.y + SUN.h.y * 0.45 * s, z + 2.85 * s);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,250,220,${0.16 + 0.12 * SUN.day})`; ctx.fill();
  } else if (p.kind === 'shrub') {
    const k = P(p.x, p.y, z + 0.42 * s), r = 0.55 * s * sc;
    ctx.beginPath(); ctx.ellipse(k.x, k.y, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fillStyle = col(tintFor(PAPER() ? '#eee5cf' : c, hl), 0.95); ctx.fill(); ctx.strokeStyle = PAPER() ? 'rgba(38,35,29,.6)' : 'rgba(30,44,30,.26)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(k.x - r * 0.25, k.y - r * 0.3, r * 0.45, r * 0.32, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,250,220,.18)'; ctx.fill();
  } else if (p.kind === 'flower') {
    for (let i = 0; i < 4; i++) {
      const a = p.v * 6 + i * 1.7, q = P(p.x + Math.cos(a) * 0.22 * s, p.y + Math.sin(a) * 0.22 * s, z + 0.18);
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.2, 0.09 * sc), 0, Math.PI * 2); ctx.fillStyle = col(tintFor(cs[(Math.floor(p.v * 4) + i) % cs.length], hl)); ctx.fill();
    }
  } else {
    ctx.strokeStyle = col(tintFor(c, hl), 0.9); ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const a = p.v * 9 + i * 1.6, bx = p.x + Math.cos(a) * 0.15, by = p.y + Math.sin(a) * 0.15;
      const b = P(bx, by, z), t = P(bx + Math.cos(a) * 0.12, by + Math.sin(a) * 0.12, z + 0.55 * s);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x, (b.y + t.y) / 2, t.x, t.y); ctx.stroke();
    }
  }
}
function drawCrossing(ctx, pa, cr) {
  const a = cr.a, b = cr.b, d = G.norm(G.sub(b, a)), n = G.left(d), L = G.dist(a, b), w = pa.width / 2;
  if (cr.mode === 'stones') {
    const k = Math.max(2, Math.round(L / 0.8));
    for (let i = 1; i < k; i++) {
      const p = G.lerp(a, b, i / k), q = G.add(p, G.mul(n, (i % 2 ? 0.2 : -0.2))), wl = waterAt(q.x, q.y);
      const z = isNaN(wl) ? hAt(q.x, q.y) : wl;
      const s = P(q.x, q.y, z + 0.06), r = 0.28 * CAM.scale;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * (0.4 + 0.6 * _se), 0, 0, Math.PI * 2); ctx.fillStyle = col('#c9c2b3', 0.95); ctx.fill(); ctx.strokeStyle = col('#8e877a'); ctx.lineWidth = 0.8; ctx.stroke();
    }
    return;
  }
  if (cr.mode !== 'bridge') return;
  const za = hAt(a.x, a.y), zb = hAt(b.x, b.y), k = Math.max(4, Math.round(L / 0.5)), deck = [];
  for (let i = 0; i <= k; i++) { const t = i / k, p = G.lerp(a, b, t); deck.push({ p, z: za + (zb - za) * t + Math.sin(t * Math.PI) * Math.min(0.9, L * 0.12) + 0.08 }); }
  for (let i = 0; i < k; i++) {
    const p0 = deck[i], p1 = deck[i + 1];
    const cs = [G.add(p0.p, G.mul(n, -w)), G.add(p1.p, G.mul(n, -w)), G.add(p1.p, G.mul(n, w)), G.add(p0.p, G.mul(n, w))];
    fillPoly3(ctx, [{ ...cs[0], z: p0.z }, { ...cs[1], z: p1.z }, { ...cs[2], z: p1.z }, { ...cs[3], z: p0.z }], col('#a98563', lam({ x: 0, y: 0, z: 1 })), col('#6f5236'), 0.8);
  }
  for (const sg of [-1, 1]) line3(ctx, deck.map((q) => ({ ...G.add(q.p, G.mul(n, sg * w)), z: q.z + 0.75 })), col('#5e4630'), 1.4);
  for (const sg of [-1, 1]) for (let i = 0; i <= k; i += 2) { const q = deck[i], p = G.add(q.p, G.mul(n, sg * w)); line3(ctx, [{ ...p, z: q.z }, { ...p, z: q.z + 0.75 }], col('#5e4630'), 1); }
}

// ── items ────────────────────────────────────────────────────────────────────
function collectItems(items) {
  const wallDepth = new Map();
  for (const wl of world.walls) {
    const pts = wallPts(wl), m = G.atLen(pts, G.polyLen(pts) / 2).p, d = depthOf(m.x, m.y, wallBase(wl) + wl.height / 2);
    wallDepth.set(wl.id, d);
    items.push({ d, draw: (ctx) => drawWall(ctx, wl) });
  }
  for (const r of world.roofs) {
    const room = world.rooms.find((x) => x.id === r.roomId); if (!room) continue;
    const d = Math.min(...room.wallIds.map((id) => wallDepth.get(id) ?? 0)) - 0.02;
    items.push({ d, draw: (ctx) => drawRoomRoof(ctx, r) });
  }
  for (const b of world.buildings) { const c = G.centroid(footOf(b)); items.push({ d: depthOf(c.x, c.y, b.base + bHeight(b) / 2), draw: (ctx) => drawBuilding(ctx, b) }); }
  for (const f of world.forms) { const c = G.centroid(f.pts); items.push({ d: depthOf(c.x, c.y, f.base + f.h / 2), draw: (ctx) => drawForm(ctx, f) }); }
  for (const o of world.objects) { const z = objBase(o.x, o.y); items.push({ d: depthOf(o.x, o.y, z + 0.4), draw: (ctx) => drawObject(ctx, o) }); }
  for (const st of world.stairs) { const m = G.mid(st.a, st.b); items.push({ d: depthOf(m.x, m.y, (st.z0 + st.z1) / 2), draw: (ctx) => drawStair(ctx, st) }); }
  for (const l of world.lights) if (l.kind !== 'wall') items.push({ d: depthOf(l.x, l.y, 0.5), draw: (ctx) => drawLight(ctx, l) });
  for (const pa of world.paths) for (const cr of pa.crossings || []) { const m = G.mid(cr.a, cr.b); items.push({ d: depthOf(m.x, m.y, 0), draw: (ctx) => drawCrossing(ctx, pa, cr) }); }
  for (const p of world.plants) items.push({ d: depthOf(p.x, p.y, p.kind === 'tree' ? 1 : 0.2), draw: (ctx) => drawPlant(ctx, p, HL.extra.get(p) || null) });
}

// ── night and glows ──────────────────────────────────────────────────────────
function drawGlows(ctx) {
  const night = PAPER() ? 0 : SUN.night;
  if (night > 0.02) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = mixHex('#ffffff', '#2f3c66', night * 0.76);
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const g of GLOWS) {
    if (g.cone) {
      const a = P(g.from.x, g.from.y, g.from.z), b = P(g.to.x, g.to.y, g.to.z), r = 0.7 * CAM.scale;
      const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + (nx / nl) * r, b.y + (ny / nl) * r); ctx.lineTo(b.x - (nx / nl) * r, b.y - (ny / nl) * r); ctx.closePath();
      ctx.fillStyle = `rgba(255,214,150,${0.07 + 0.2 * night})`; ctx.fill();
      const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.5);
      gr.addColorStop(0, `rgba(255,222,160,${0.22 + 0.4 * night})`); gr.addColorStop(1, 'rgba(255,222,160,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (night < 0.05) continue;
    const s = P(g.p.x, g.p.y, g.p.z), r = g.r * CAM.scale;
    const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    gr.addColorStop(0, `rgba(255,196,120,${0.55 * g.a * night})`); gr.addColorStop(0.35, `rgba(255,170,90,${0.22 * g.a * night})`); gr.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function skyFill(ctx) {
  if (PAPER()) { ctx.fillStyle = '#f8f1e2'; ctx.fillRect(0, 0, VIEW.w, VIEW.h); return; }
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  const warm = SUN.warm * SUN.day;
  g.addColorStop(0, mixHex(mixHex('#efe6d0', '#f1c999', warm * 0.75), '#1d2740', SUN.night * 0.85));
  g.addColorStop(1, mixHex(mixHex(C.paper, '#f4dcc0', warm * 0.5), '#2a3550', SUN.night * 0.8));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}
/* Paper grain over the whole Stage, fixed to the screen like the sheet it is drawn on. */
let GRAIN = null;
function grainFill(ctx) {
  if (!GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'), im = g.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random(); im.data[i] = 92; im.data[i + 1] = 74; im.data[i + 2] = 44; im.data[i + 3] = v > 0.5 ? (v - 0.5) * 36 : 0; }
    g.putImageData(im, 0, 0); GRAIN = ctx.createPattern(c, 'repeat');
  }
  ctx.fillStyle = GRAIN; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

function render() {
  const ctx = VIEW.ctx; if (!ctx) return;
  camPrep(); SUN = sunInfo(PAPER() ? 11 : world.sun); GLOWS = []; // Paper has no hour: a drawing is lit from the upper left
  ctx.setTransform(VIEW.dpr, 0, 0, VIEW.dpr, 0, 0);
  skyFill(ctx);
  drawSlab(ctx);
  drawTerrain(ctx);
  drawFloors(ctx);
  for (const pa of world.paths) drawPath(ctx, pa);
  if (typeof previewGround === 'function') previewGround(ctx);
  drawShadows(ctx);
  const items = [];
  collectItems(items);
  if (typeof previewItems === 'function') previewItems(items);
  items.sort((a, b) => b.d - a.d);
  for (const it of items) { if (it.alpha != null) ctx.globalAlpha = it.alpha; it.draw(ctx); ctx.globalAlpha = 1; }
  drawGlows(ctx);
  grainFill(ctx);
  if (typeof drawOverlay === 'function') drawOverlay(ctx);
  VIEW.dirty = false;
}
