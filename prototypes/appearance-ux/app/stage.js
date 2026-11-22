/*
 * Stage stand-in: an axonometric SVG room whose faces are filled with renderer-made seamless
 * tiles, mapped in metres through an affine patternTransform. It is not the product renderer;
 * it exists so Paint, ghosts, reach highlights and repair states can be judged in context.
 */
import * as T from './thumbs.js';
import { S, look, usersOf, openDiagnostics, finishOf } from './model.js';

const ROOM = { w: 6, d: 5, h: 2.7 };
const C = [ROOM.w / 2, ROOM.d / 2];

// ---------------------------------------------------------------- targets
export const TARGETS = {
  'wall-n:a': { label: 'North wall', side: 'Living side', subject: 'wall-n', kind: 'layout', group: 'walls' },
  'wall-w:a': { label: 'West wall', side: 'Living side', subject: 'wall-w', kind: 'layout', group: 'walls' },
  'wall-e:a': { label: 'East wall', side: 'Living side', subject: 'wall-e', kind: 'layout', group: 'walls' },
  'wall-s:a': { label: 'South wall', side: 'Living side', subject: 'wall-s', kind: 'layout', group: 'walls' },
  'part:a': { label: 'Partition', side: 'Side A · dining', subject: 'part', kind: 'layout', group: 'walls' },
  'part:b': { label: 'Partition', side: 'Side B · lounge', subject: 'part', kind: 'layout', group: 'walls' },
  floor: { label: 'Floor', side: 'Living', subject: 'floor', kind: 'layout', group: 'floor' },
  'sofa:fabric': { label: 'Sofa', side: 'Upholstery', subject: 'sofa', kind: 'scene', group: 'sofa' },
  'sofa:legs': { label: 'Sofa', side: 'Legs', subject: 'sofa', kind: 'scene', group: 'sofa' },
  'table:top': { label: 'Coffee table', side: 'Top', subject: 'table', kind: 'scene', group: 'table' },
  'table:legs': { label: 'Coffee table', side: 'Legs', subject: 'table', kind: 'scene', group: 'table' },
  rug: { label: 'Rug', side: 'Pile', subject: 'rug', kind: 'scene', group: 'rug' },
  'chair:seat': { label: 'Lounge chair', side: 'Seat · model part', subject: 'chair', kind: 'scene', group: 'chair', model: true },
  'chair:frame': { label: 'Lounge chair', side: 'Frame · model part', subject: 'chair', kind: 'scene', group: 'chair', model: true }
};
export const SUBJECTS = {
  'wall-n': { label: 'North wall', kind: 'wall', targets: ['wall-n:a'] },
  'wall-w': { label: 'West wall', kind: 'wall', targets: ['wall-w:a'] },
  'wall-e': { label: 'East wall', kind: 'wall', targets: ['wall-e:a'] },
  'wall-s': { label: 'South wall', kind: 'wall', targets: ['wall-s:a'] },
  part: { label: 'Partition', kind: 'wall', targets: ['part:a', 'part:b'] },
  floor: { label: 'Floor · Living', kind: 'floor', targets: ['floor'] },
  sofa: { label: 'Sofa', kind: 'object', targets: ['sofa:fabric', 'sofa:legs'] },
  table: { label: 'Coffee table', kind: 'object', targets: ['table:top', 'table:legs'] },
  rug: { label: 'Rug', kind: 'object', targets: ['rug'] },
  chair: { label: 'Lounge chair', kind: 'model', targets: ['chair:seat', 'chair:frame'] }
};
export const kindOfTarget = (t) => TARGETS[t].kind;
/** Paint radius. Surface (and the future Brush) → the one surface; Space → every wall surface in the room, or every part of an object. */
export function scopeTargets(t, scope) {
  if (scope !== 'space') return [t];
  const g = TARGETS[t].group;
  if (g === 'walls') return Object.keys(TARGETS).filter((k) => TARGETS[k].group === 'walls');
  return SUBJECTS[TARGETS[t].subject].targets;
}

// ---------------------------------------------------------------- geometry
const faces = [];
function quad(target, pts, U, V, N, extra = {}) { faces.push({ target, pts, U, V, N, ...extra }); }
function box(target, [x0, x1], [y0, y1], [z0, z1], flat = false) {
  const id = faces.length;
  const g = { box: id, c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], flat };
  quad(target, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [1, 0, 0], [0, 0, 1], [0, 1, 0], g);
  quad(target, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [1, 0, 0], [0, 1, 0], [0, 0, 1], g);
  quad(target, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [0, 0, 1], [0, 1, 0], [1, 0, 0], g);
  quad(target, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [0, 0, 1], [0, 1, 0], [-1, 0, 0], g);
  quad(target, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [1, 0, 0], [0, 1, 0], [0, 0, -1], g);
}
(function build() {
  const { w, d, h } = ROOM;
  quad('floor', [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d]], [1, 0, 0], [0, 0, 1], [0, 1, 0], { layer: 0 });
  quad('wall-n:a', [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]], [1, 0, 0], [0, 1, 0], [0, 0, 1], { layer: 1, wall: true });
  quad('wall-s:a', [[0, 0, d], [w, 0, d], [w, h, d], [0, h, d]], [1, 0, 0], [0, 1, 0], [0, 0, -1], { layer: 1, wall: true });
  quad('wall-w:a', [[0, 0, 0], [0, 0, d], [0, h, d], [0, h, 0]], [0, 0, 1], [0, 1, 0], [1, 0, 0], { layer: 1, wall: true });
  quad('wall-e:a', [[w, 0, 0], [w, 0, d], [w, h, d], [w, h, 0]], [0, 0, 1], [0, 1, 0], [-1, 0, 0], { layer: 1, wall: true });
  const pz = 2.45, t = 0.06, px0 = 3.3;
  quad('part:a', [[px0, 0, pz + t], [w, 0, pz + t], [w, h, pz + t], [px0, h, pz + t]], [1, 0, 0], [0, 1, 0], [0, 0, 1], { layer: 2, c: [4.6, 1.3, pz + t] });
  quad('part:b', [[px0, 0, pz - t], [w, 0, pz - t], [w, h, pz - t], [px0, h, pz - t]], [1, 0, 0], [0, 1, 0], [0, 0, -1], { layer: 2, c: [4.6, 1.3, pz - t] });
  quad('part:a', [[px0, 0, pz - t], [px0, 0, pz + t], [px0, h, pz + t], [px0, h, pz - t]], [0, 0, 1], [0, 1, 0], [-1, 0, 0], { layer: 2, c: [px0, 1.3, pz] });
  quad('part:a', [[px0, h, pz - t], [w, h, pz - t], [w, h, pz + t], [px0, h, pz + t]], [1, 0, 0], [0, 0, 1], [0, 1, 0], { layer: 2, c: [4.6, h, pz] });
  // objects
  box('rug', [0.5, 3.1], [0, 0.015], [1.55, 3.45], true);
  box('sofa:fabric', [0.35, 2.65], [0.12, 0.44], [0.3, 1.25]);
  box('sofa:fabric', [0.35, 2.65], [0.44, 0.86], [0.3, 0.56]);
  box('sofa:fabric', [0.35, 0.58], [0.44, 0.64], [0.56, 1.25]);
  box('sofa:fabric', [2.42, 2.65], [0.44, 0.64], [0.56, 1.25]);
  for (const [x, z] of [[0.42, 0.36], [2.52, 0.36], [0.42, 1.13], [2.52, 1.13]]) box('sofa:legs', [x, x + 0.07], [0, 0.12], [z, z + 0.07]);
  for (const [x, z] of [[1.15, 1.95], [2.27, 1.95], [1.15, 2.67], [2.27, 2.67]]) box('table:legs', [x, x + 0.05], [0, 0.4], [z, z + 0.05]);
  box('table:top', [1.1, 2.37], [0.4, 0.45], [1.9, 2.77]);
  for (const [x, z] of [[4.1, 3.25], [4.86, 3.25], [4.1, 3.98], [4.86, 3.98]]) box('chair:frame', [x, x + 0.05], [0, 0.38], [z, z + 0.05]);
  box('chair:seat', [4.08, 4.93], [0.38, 0.47], [3.22, 4.05]);
  box('chair:seat', [4.08, 4.93], [0.47, 0.98], [3.95, 4.05]);
  box('chair:frame', [4.08, 4.93], [0.98, 1.02], [3.93, 4.07]);
})();

// ---------------------------------------------------------------- projection
let view = 0;              // quarter turns
export const setView = (r) => { view = ((r % 4) + 4) % 4; };
export const getView = () => view;
function rot([x, y, z]) {
  const dx = x - C[0], dz = z - C[1];
  const [rx, rz] = [[dx, dz], [-dz, dx], [-dx, -dz], [dz, -dx]][view];
  return [rx, y, rz];
}
const rotN = ([x, y, z]) => { const [rx, rz] = [[x, z], [-z, x], [-x, -z], [z, -x]][view]; return [rx, y, rz]; };
const SC = 100;
const P = (p) => { const [x, y, z] = rot(p); return [(x - z) * SC * 0.86, (x + z) * SC * 0.36 - y * SC * 0.86]; };
const depth = (p) => { const [x, , z] = rot(p); return x + z; };
const visible = (N) => { const [x, y, z] = rotN(N); return y > 0.5 || x > 0.01 || z > 0.01; };
const shadeOf = (N) => { const [x, y, z] = rotN(N); if (y > 0.5) return ['#fff', 0.04]; if (x > 0.5) return ['#000', 0.16]; if (z > 0.5) return ['#000', 0.05]; return ['#000', 0.1]; };

// ---------------------------------------------------------------- render
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const lookKey = (L) => T.key({ ...L, rot: 0 }, 'tile', 192);

/** The faced frame of a surface (Align on wall): its largest face, size in metres, and its axes. */
export function faceFrame(t) {
  const fs = faces.filter((f) => f.target === t);
  const dims = (f) => { const d = (a, b, ax) => Math.abs(ax.reduce((s, v, i) => s + v * (b[i] - a[i]), 0)); return [d(f.pts[0], f.pts[1], f.U) || d(f.pts[0], f.pts[3], f.U), d(f.pts[0], f.pts[3], f.V) || d(f.pts[0], f.pts[1], f.V)]; };
  const f = fs.map((f) => ({ f, wh: dims(f) })).sort((a, b) => b.wh[0] * b.wh[1] - a.wh[0] * a.wh[1])[0];
  return f ? { w: f.wh[0], h: f.wh[1], floor: TARGETS[t].group === 'floor' } : null;
}

export function createStage(svg, hooks) {
  const defs = el('defs'); svg.append(defs);
  const gFaces = el('g'); const gOver = el('g'); const gGhost = el('g', { 'pointer-events': 'none' }); const gTop = el('g', { 'pointer-events': 'none' });
  svg.append(gFaces, gGhost, gOver, gTop);
  defs.innerHTML = `<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(183,121,31,.18)"/><path d="M0 0v8" stroke="#b7791f" stroke-width="2.2" opacity=".75"/></pattern>`;
  const imgIds = new Map();
  let state = { hover: [], ghostLook: null, selected: null, users: [], usersMode: 'all', subjectTarget: null, scopeHover: [], draft: null };

  function imgFor(L) {
    const k = lookKey(L);
    if (imgIds.has(k)) return imgIds.get(k);
    const id = 'im' + imgIds.size;
    const im = el('image', { id, width: 1, height: 1, preserveAspectRatio: 'none', href: T.url({ ...L, rot: 0 }, 'tile', 192) });
    defs.append(im); imgIds.set(k, id);
    return id;
  }
  function patternFor(f, L, pid) {
    const tile = L.tile[0];
    const a = (L.rot || 0) * Math.PI / 180;
    const U = f.U.map((u, i) => Math.cos(a) * u + Math.sin(a) * f.V[i]);
    const V = f.V.map((v, i) => -Math.sin(a) * f.U[i] + Math.cos(a) * v);
    const off = L.offset || [0, 0];
    const O = f.pts[0].map((o, i) => o + f.U[i] * off[0] + f.V[i] * off[1]);   // offset → moves the pattern right / up
    const s0 = P(O), sU = P(O.map((o, i) => o + U[i] * tile)), sV = P(O.map((o, i) => o + V[i] * tile));
    const m = [sU[0] - s0[0], sU[1] - s0[1], -(sV[0] - s0[0]), -(sV[1] - s0[1]), s0[0], s0[1]];
    const pat = el('pattern', { id: pid, width: 1, height: 1, patternUnits: 'userSpaceOnUse', patternTransform: `matrix(${m.map((v) => v.toFixed(3)).join(',')})` });
    const use = el('use', { href: '#' + imgFor(L) }); pat.append(use);
    return pat;
  }

  let patSeq = 0;
  function render() {
    for (const p of defs.querySelectorAll('pattern.f')) p.remove();
    gFaces.innerHTML = '';
    const vis = faces.filter((f) => f.wall ? visible(f.N) && !nearWall(f) : visible(f.N));
    const order = vis.map((f) => ({ f, d: f.layer === 0 ? -1e9 : f.flat ? -1e9 + 1 : f.wall ? -1e8 + depth(centroid(f)) : depth(f.c || centroid(f)) }))
      .sort((a, b) => a.d - b.d || (a.f.N[1] - b.f.N[1]));
    for (const { f } of order) {
      const ref = S.p.assign[f.target];
      const L = look(ref, !S.preview?.targets || S.preview.targets.includes(f.target));
      const pid = 'p' + patSeq++;
      const pat = patternFor(f, L, pid); pat.classList.add('f'); defs.append(pat);
      const pts = f.pts.map(P).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
      const g = el('g', { 'data-t': f.target, class: 'face' });
      g.append(el('polygon', { points: pts, fill: `url(#${pid})` }));
      const [sc, so] = shadeOf(f.N);
      g.append(el('polygon', { points: pts, fill: sc, 'fill-opacity': so, stroke: 'rgba(18,38,29,.28)', 'stroke-width': f.wall ? 1 : 0.6 }));
      if (openDiagnostics(ref).length) g.append(el('polygon', { points: pts, fill: 'url(#hatch)' }));
      gFaces.append(g);
    }
    // near-wall footprints so the cut-away reads as a room
    for (const f of faces.filter((f) => f.wall && nearWall(f))) {
      const base = f.pts.filter((p) => p[1] === 0).map(P);
      gFaces.append(el('polyline', { points: base.map((p) => p.join(',')).join(' '), stroke: 'rgba(18,38,29,.5)', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }));
    }
    fit();
    overlays();
  }
  function centroid(f) { return f.pts.reduce((a, p) => a.map((v, i) => v + p[i] / f.pts.length), [0, 0, 0]); }
  function nearWall(f) { const [x, , z] = rotN(f.N); return x < -0.5 || z < -0.5; }
  function polysFor(target) { return [...gFaces.querySelectorAll(`g.face[data-t="${CSS.escape(target)}"] polygon:first-child`)]; }

  function overlays() {
    gOver.innerHTML = ''; gGhost.innerHTML = ''; gTop.innerHTML = '';
    // ghost (cobalt proposal)
    if (state.ghostLook && state.hover.length) {
      for (const t of state.hover) {
        const L = typeof state.ghostLook === 'function' ? state.ghostLook(t) : state.ghostLook;
        for (const f of faces.filter((f) => f.target === t && (f.wall ? visible(f.N) && !nearWall(f) : visible(f.N)))) {
          const pid = 'g' + patSeq++; const pat = patternFor(f, L, pid); pat.classList.add('f'); defs.append(pat);
          const pts = f.pts.map(P).map((p) => p.join(',')).join(' ');
          gGhost.append(el('polygon', { points: pts, fill: `url(#${pid})`, opacity: 0.92 }));
          const [sc, so] = shadeOf(f.N); gGhost.append(el('polygon', { points: pts, fill: sc, 'fill-opacity': so }));
        }
        for (const p of polysFor(t)) gTop.append(el('polygon', { points: p.getAttribute('points'), fill: 'none', stroke: '#2a62d6', 'stroke-width': 2.2, 'stroke-dasharray': '6 4' }));
      }
    } else for (const t of state.hover) for (const p of polysFor(t)) gTop.append(el('polygon', { points: p.getAttribute('points'), fill: 'rgba(111,138,62,.08)', stroke: '#6f8a3e', 'stroke-width': 1.6 }));
    // draft (Library › Customise…): a cobalt ghost on the surface it would be applied to — nothing written
    if (state.draft) for (const t of state.draft.targets) {
      for (const f of faces.filter((f) => f.target === t && (f.wall ? visible(f.N) && !nearWall(f) : visible(f.N)))) {
        const pid = 'd' + patSeq++; const pat = patternFor(f, state.draft.look, pid); pat.classList.add('f'); defs.append(pat);
        const pts = f.pts.map(P).map((p) => p.join(',')).join(' ');
        gGhost.append(el('polygon', { points: pts, fill: `url(#${pid})`, opacity: 0.95 }));
        const [sc, so] = shadeOf(f.N); gGhost.append(el('polygon', { points: pts, fill: sc, 'fill-opacity': so }));
      }
      for (const p of polysFor(t)) gTop.append(el('polygon', { points: p.getAttribute('points'), fill: 'none', stroke: '#2a62d6', 'stroke-width': 2.4, 'stroke-dasharray': '6 4' }));
    }
    // reach: cobalt = will change too (the other users of the edited Finish); gold = selected only
    for (const t of state.users) for (const p of polysFor(t)) gOver.append(el('polygon', { points: p.getAttribute('points'), fill: state.usersMode === 'all' ? 'rgba(42,98,214,.10)' : 'none', stroke: '#2a62d6', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }));
    if (state.selected) for (const t of state.selected) for (const p of polysFor(t)) gOver.append(el('polygon', { points: p.getAttribute('points'), fill: 'none', stroke: '#d9a521', 'stroke-width': 3, 'pointer-events': 'none' }));
  }

  let vb = null;
  function fit() {
    const bb = gFaces.getBBox(); const pad = 40;
    const box = [bb.x - pad, bb.y - pad * 1.6, bb.width + pad * 2, bb.height + pad * 2.6];
    if (!vb || vb.join() !== box.join()) { vb = box; svg.setAttribute('viewBox', box.map((v) => v.toFixed(0)).join(' ')); }
  }

  // ---------------- input
  let stroke = null, pressTimer = null;
  const targetAt = (ev) => ev.target.closest?.('g.face')?.dataset.t || null;
  svg.addEventListener('pointermove', (ev) => {
    const t = targetAt(ev);
    if (stroke) { if (t && !stroke.has(t)) { stroke.add(t); hooks.stroke?.([...stroke]); } return; }
    hooks.hover?.(t, ev);
  });
  svg.addEventListener('pointerleave', () => { if (!stroke) hooks.hover?.(null); });
  svg.addEventListener('pointerdown', (ev) => {
    const t = targetAt(ev);
    if (ev.button !== 0) return;
    if (!t) { hooks.empty?.(); return; }
    if (ev.altKey) { hooks.pick?.(t); return; }
    if (ev.pointerType !== 'mouse') pressTimer = setTimeout(() => { pressTimer = null; stroke = null; hooks.pick?.(t); }, 520);
    if (hooks.strokeStart?.(t)) { stroke = new Set([t]); svg.setPointerCapture?.(ev.pointerId); hooks.stroke?.([...stroke]); }
    else hooks.click?.(t, ev);
  });
  const end = () => { clearTimeout(pressTimer); if (stroke) { const s = [...stroke]; stroke = null; hooks.strokeEnd?.(s); } };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { clearTimeout(pressTimer); stroke = null; hooks.strokeCancel?.(); });
  // capture-based move (pointer captured on svg: find element under pointer)
  svg.addEventListener('pointermove', (ev) => {
    if (!stroke) return;
    clearTimeout(pressTimer);
    const elAt = document.elementFromPoint(ev.clientX, ev.clientY); const t = elAt?.closest?.('g.face')?.dataset.t;
    if (t && !stroke.has(t)) { stroke.add(t); hooks.stroke?.([...stroke]); }
  });

  return {
    render,
    set(patch) { state = { ...state, ...patch }; overlays(); },
    get strokeActive() { return !!stroke; },
    cancelStroke() { stroke = null; },
    /** screen rect of a target (for anchoring popovers) */
    rectOf(t) { const p = polysFor(t)[0]; return p ? p.getBoundingClientRect() : null; }
  };
}
