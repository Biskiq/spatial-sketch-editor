// Stage: the world drawing, screen overlays (handles, slice, erase marks, on-object section),
// stage furniture (2D | 3D, readings disclosure) and the compact height Sheet.
import { icon } from './icons.js';
import * as SC from './scene.js';
import * as MN from './manip.js';
import { $, S, M, R, H, UI, esc, f2, clamp, clone, ent, view, pres, guide, roomOf, findRaw, currentCam, camState, isPersp, ground, palette, flatLines, toPx, wpx, followPose, heightMarks, markAt, markName, stories, bandAt, sliceFrame, kindLabel, level } from './core.js';

// ---------------- the world ----------------
export function renderStage(xfade = false) {
  const st = $('#stage');
  st.dataset.tool = S.tool; st.dataset.ground = ground();
  st.dataset.look = S.lookThrough ? 'through' : followPose() ? 'follow' : '';
  st.style.setProperty('--sbg', palette().bg);
  R.box = SC.modelBox(M);
  R.CAM = currentCam();
  const W = st.clientWidth || 800, Hh = st.clientHeight || 600;
  const mode = S.look && ['unroll', 'face'].includes(S.look.kind) ? 'unroll' : S.reading === 'plan' && !S.lookThrough && !followPose() ? 'plan' : 'solid';
  const opts = stageOpts(mode);
  let res, base;
  if (mode === 'unroll') { res = SC.renderUnroll(M, S.look.walls, opts); base = [-1, -6.4, res.width + 1.4, 8]; R.CAM = { kind: 'unroll', P: (p) => p }; }
  else if (mode === 'plan') { res = SC.renderPlan(renderModel(), opts); base = SC.boundsOf(R.CAM, R.box); }
  else {
    res = SC.renderSolid(renderModel(), R.CAM, opts);
    if (isPersp(R.CAM) && (S.reading === 'eye' || S.lookThrough || followPose())) { const w = 32; base = [-w / 2, (-w / 2) * (Hh / W), w, w * (Hh / W)]; }
    else if (S.reading === 'rsect' && S.editShape) { const r = ent(S.editShape.id); const span = r.y1 - r.y0, top = SC.roofTop(r), z0 = Math.max(0, SC.roofEave(r) - 3.2); base = [-span * 0.25, -(top + 1.6), span * 1.5, top + 1.6 - z0 + 0.6]; }
    else base = SC.boundsOf(R.CAM, R.box);
  }
  R.CENT = res.centroids;
  const cs = camState();
  const cx = base[0] + base[2] / 2 + cs.pan[0], cy = base[1] + base[3] / 2 + cs.pan[1];
  const vw = base[2] / cs.z, vh = base[3] / cs.z, k = Math.min(W / vw, Hh / vh);
  R.V = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh, k, ox: (W - vw * k) / 2, oy: (Hh - vh * k) / 2 };
  const svg = $('#world');
  svg.setAttribute('viewBox', `${R.V.x} ${R.V.y} ${R.V.w} ${R.V.h}`);
  const defs = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#cfd6db"/><line x1="0" y1="0" x2="0" y2="6" stroke="#8a98a0" stroke-width="2"/></pattern></defs>`;
  svg.innerHTML = defs + gridSvg(mode) + res.svg;
  if (xfade) { svg.classList.remove('xfade'); void svg.getBoundingClientRect(); svg.classList.add('xfade'); }
  R.mode = mode;
  renderOverlay(); renderFurniture(); renderSheet();
}

/** A horizontal Slice is a temporary reading: the drawn model is clipped, the source is untouched. */
export function renderModel() {
  if (S.slice && S.slice.horizontal) {
    const m = clone(M); const h = S.slice.h;
    m.walls = m.walls.filter((w) => w.base < h); m.walls.forEach((w) => (w.top = Math.min(w.top, h)));
    m.roofs = m.roofs.filter((r) => SC.roofTop(r) <= h); m.openings.forEach((o) => { if (o.sill + o.h > h) o.h = Math.max(0, h - o.sill); });
    m.objects = m.objects.filter((o) => (o.z || 0) < h); m.rooms = m.rooms.filter((r) => r.z < h);
    return m;
  }
  return M;
}

let zCache = { key: '', rng: {} };
function zRanges() {
  const key = `${H.i}|${S.scenario}|${R.D ? 'd' : ''}`;
  if (zCache.key === key && !R.D) return zCache.rng;
  const rng = {};
  for (const p of SC.prims(M)) { const zs = p.pts.map((q) => q[2]); const r = rng[p.id] || (rng[p.id] = [Infinity, -Infinity]); r[0] = Math.min(r[0], ...zs); r[1] = Math.max(r[1], ...zs); }
  zCache = { key, rng }; return rng;
}
export function stageOpts(mode) {
  const sel = new Set(S.sel ? [S.sel] : []);
  const related = new Set();
  if (S.lens === 'experience' && S.sel) { const p = pres(S.sel) || M.presentations.find((pp) => pp.views.includes(S.sel)); if (p && p.subject) related.add(p.subject); }
  const map = new Map(SC.entities(M).map((e) => [e.id, e]));
  const rng = zRanges();
  const ghosts = [];
  // Plan is drawn at the Sheet height: the story containing it; what is above is left out, below is ghosted
  let hidden = null;
  const [lo, hi] = bandAt(S.sheet.h);
  if (mode === 'plan' && stories().length > 1) hidden = (id) => rng[id] && rng[id][0] > hi + 0.01;
  if (mode === 'plan' && stories().length > 1) ghosts.push((id) => rng[id] && rng[id][1] <= lo + 0.06 && rng[id][0] < lo - 0.05);
  if (S.focus && !S.look) ghosts.push((id) => rng[id] && (rng[id][1] < lo + 0.15 || rng[id][0] > hi - 0.15)); // touching the band is not being in it
  if (S.slice && !S.slice.horizontal && mode !== 'plan') {
    // a drawn slice is finite: it opens the building only along the stretch that was drawn
    const { d, n } = sliceFrame(); const a = S.slice.a, L = Math.hypot(S.slice.b[0] - a[0], S.slice.b[1] - a[1]);
    const rel = (id) => { let e = map.get(id); if (!e) return null; if ((e.kind === 'artwork' || e.kind === 'opening') && map.get(e.host)) e = map.get(e.host); /* hosted things follow their wall */ const c = SC.entityPlanCentre(M, e); const v = [c[0] - a[0], c[1] - a[1]]; return { off: v[0] * n[0] + v[1] * n[1], along: v[0] * d[0] + v[1] * d[1] }; };
    const inside = (q) => q && q.along > -0.3 && q.along < L + 0.3;
    hidden = (id) => { const q = rel(id); return inside(q) && q.off < -0.02; };
    ghosts.push((id) => { const q = rel(id); return inside(q) && q.off > S.slice.depth; });
  }
  if (S.reading === 'rsect' && S.editShape) { const r = ent(S.editShape.id); const X = roofSectionX(r); hidden = (id) => { if (id === r.id) return false; const e = map.get(id); if (!e) return false; const c = SC.entityPlanCentre(M, (e.kind === 'artwork' || e.kind === 'opening') && map.get(e.host) ? map.get(e.host) : e); return c[0] < X - 0.05; }; }
  if (S.slice && S.slice.horizontal) ghosts.push((id) => rng[id] && rng[id][1] < S.slice.h - S.slice.depth);
  const ghost = ghosts.length ? (id) => ghosts.some((g) => g(id)) : null;
  const dim = S.editShape ? (id) => id !== S.editShape.id : null;
  const cut = nearCut(mode);
  const xray = S.overhead === 'xray' && !S.lift && S.reading !== 'eye' && !S.lookThrough && !S.editShape;
  return { pal: palette(), flat: flatLines(), sel, hover: S.hover, marked: S.marked, ghost, dim, hidden, finishes: M.finishes, sheet: sheetPlane(), lift: S.lift, related, xray, cut, stories: stories(), labels: M.rooms.length < 20 };
}
// 3D cutaway: working inside a room, the walls on the camera side go see-through and click-through (viewing state only)
function nearCut(mode) {
  if (!R.CAM || !R.CAM.P || (R.CAM.kind !== 'axo' && R.CAM.kind !== 'persp') || S.reading === 'eye' || S.lookThrough || S.lift) return null;
  const e = S.sel && ent(S.sel);
  let room = e && e.kind !== 'wall' ? roomOf(e) : null;
  if (!room && S.scope.room) room = S.scope.room;
  room = room && ent(room.id || room);
  if (!room || !room.walls || room.type === 'platform') return null;
  const c = SC.entityPlanCentre(M, room); const z = (room.z || 0) + 1.5; const dc = R.CAM.P([c[0], c[1], z])[2];
  const cut = new Set();
  for (const wid of room.walls) {
    if (wid === S.sel || (e && e.host === wid)) continue; // never cut away the selection or the wall it is hosted on
    const w = ent(wid); if (!w) continue;
    const m = SC.entityPlanCentre(M, w);
    if (R.CAM.P([m[0], m[1], z])[2] > dc + 0.05) {
      cut.add(wid);
      for (const o of [...M.openings, ...M.artworks]) if (o.host === wid && o.id !== S.sel) cut.add(o.id);
    }
  }
  return cut.size ? cut : null;
}
function sheetPlane() {
  if (S.lens !== 'world' || S.look || S.reading === 'plan' || S.sheet.h < 0.01) return null;
  if (!(S.sheet.drag || S.tool === 'ink' || S.focus)) return null;
  const b = R.box; return { h: S.sheet.h, extent: [b[0] + 0.5, b[1] + 1, b[2] - 0.5, b[3] - 0.5], outline: S.focus };
}
function gridSvg(mode) {
  if (!S.grid || S.lookThrough || followPose() || mode === 'unroll') return '';
  const b = R.box; let g = ''; const C = R.CAM;
  if (mode === 'plan' || C.kind === 'axo' || isPersp(C)) {
    const step = b[2] - b[0] > 40 ? 2 : 1, z = mode === 'plan' ? 0 : 0;
    for (let x = Math.floor(b[0]); x <= b[2]; x += step) { const p = C.P([x, b[1], z]), q = C.P([x, b[3], z]); if (p[3] || q[3]) continue; g += `<line class="${x % 10 === 0 ? 'maj' : ''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }
    for (let y = Math.floor(b[1]); y <= b[3]; y += step) { const p = C.P([b[0], y, z]), q = C.P([b[2], y, z]); if (p[3] || q[3]) continue; g += `<line class="${y % 10 === 0 ? 'maj' : ''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }
  } else {
    for (let z = 0; z <= b[5] + 1; z++) { const p = C.P([b[0], b[1], z]), q = C.P([b[2], b[3], z]); g += `<line class="${z === 0 ? 'maj' : ''}" x1="${Math.min(p[0], q[0]) - 5}" y1="${p[1]}" x2="${Math.max(p[0], q[0]) + 5}" y2="${p[1]}"/>`; }
  }
  return `<g class="gridlines">${g}</g>`;
}

// ---------------- overlay (screen px) ----------------
export function renderOverlay() {
  const o = $('#ovl'); let s = '';
  const e = ent(S.sel), D = R.D;
  if (e && R.mode === 'solid' && !S.lookThrough) s += selectionEcho(e.id);
  if (S.lens === 'world' && e && S.tool === 'select' && !S.lookThrough && R.mode !== 'unroll' && !S.editShape) s += handlesSvg(e);
  if (S.lens === 'world' && e && e.kind === 'artwork' && S.tool === 'select') s += spacingRibbons(e);
  if (S.editShape && R.mode === 'solid') s += onObjectSection();
  if (S.ink && S.ink.pts.length) {
    const pts = S.ink.pts.map((p) => (S.ink.px ? p : wpx([p[0], p[1], S.ink.h]))).filter(Boolean);
    if (S.ink.cursor) { const c = wpx([...S.ink.cursor, S.ink.h]); if (c) pts.push(c); }
    s += `<polyline class="ink-live" points="${pts.map((p) => p.join(',')).join(' ')}"/>` + (S.ink.px || S.inkTip !== 'line' ? '' : pts.map((p) => `<circle class="ink-pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join(''));
    if (S.ink.tag && pts.length) s += tag(pts.at(-1)[0] + 12, pts.at(-1)[1] - 12, S.ink.tag);
  }
  if (S.ink && S.ink.opening && S.ink.opening.round) { const o = S.ink.opening; s += `<circle class="ink-live" cx="${o.c[0]}" cy="${o.c[1]}" r="${o.rpx}"/>` + tag(o.c[0] + o.rpx + 8, o.c[1], o.label); }
  else if (S.ink && S.ink.opening) { const q = S.ink.opening.px; s += `<rect class="ink-live" x="${Math.min(q[0], q[2])}" y="${Math.min(q[1], q[3])}" width="${Math.abs(q[2] - q[0])}" height="${Math.abs(q[3] - q[1])}"/>`; s += tag(q[2] + 10, q[3] - 10, S.ink.opening.label); }
  if (S.inkHint && S.tool === 'ink' && !S.ink) s += tag(S.inkHint.x + 14, S.inkHint.y + 22, S.inkHint.text);
  if (S.eraseHint && S.tool === 'eraser') s += tag(S.eraseHint.x + 14, S.eraseHint.y + 22, S.eraseHint.text);
  if (S.slice && !S.slice.horizontal && S.reading !== 'section' && R.mode !== 'unroll') s += sliceWidgets();
  if (S.lassoPoly && S.lassoPoly.length > 1) {
    const pts = S.lassoPoly.map(toPx).map((p) => p.join(',')).join(' ');
    s += D && D.kind === 'scrub' || (!D && S.eraseMode === 'scrub') ? `<polyline class="scrub" points="${pts}"/>` : `<polygon class="lasso" points="${pts}"/>`;
  }
  if (S.meas && S.meas.a) {
    const a = wpx([...S.meas.a, S.meas.h || 0]), b = wpx([...(S.meas.b || S.meas.cursor || S.meas.a), S.meas.h || 0]);
    if (a && b) { const d = Math.hypot(...SC.sub(S.meas.b || S.meas.cursor || S.meas.a, S.meas.a)); s += `<line class="meas" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="#fff"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#fff"/>` + tag((a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2 - 8, `${f2(d)} m`); }
  }
  if (S.meas && S.meas.heightAt) { const m = S.meas.heightAt; s += tag(m.px[0] + 10, m.px[1], m.label); }
  if (S.placing && S.placing.ghost) { const g = S.placing.ghost; s += `<polygon class="ghostplace${g.bad ? ' bad' : ''}" points="${g.px.map((p) => p.join(',')).join(' ')}"/>`; if (g.label) s += tag(g.px[0][0], g.px[0][1] - 14, g.label, g.bad); }
  if (D && D.guide) s += D.guide;
  if (D && D.tag) s += tag(D.tag.x, D.tag.y, D.tag.text, D.tag.refuse);
  if (S.lens === 'experience' && !S.lookThrough && !followPose() && R.mode !== 'unroll') s += UI.expOverlay();
  o.innerHTML = s;
}
function selectionEcho(id) {
  return SC.prims(renderModel(), { lift: S.lift }).filter((p) => p.id === id && p.role !== 'floor').map((p) => { const q = p.pts.map(wpx); if (q.some((v) => !v)) return ''; return `<polygon points="${q.map((v) => v.join(',')).join(' ')}" fill="none" stroke="#d4ad45" stroke-width="1.2" stroke-dasharray="3 3" opacity=".9"/>`; }).join('');
}
export function tag(x, y, text, refuse = false) {
  const w = String(text).length * 6.6 + 14;
  return `<g transform="translate(${x},${y})" class="tagg"><rect class="tagbox${refuse ? ' ref' : ''}" x="0" y="-15" width="${w}" height="20" rx="5"/><text class="tagtxt${refuse ? ' ref' : ''}" x="7" y="-1">${esc(text)}</text></g>`;
}
function knob(x, y, h, glyph, title, cls = '') {
  return `<g class="hit ${cls}" data-h="${h}"><title>${esc(title)}</title><circle class="h-knob" cx="${x}" cy="${y}" r="${cls.includes('sm') ? 8 : 10}"/>${glyph ? `<g transform="translate(${x - 6.5},${y - 6.5}) scale(.54)"><g class="h-glyph">${glyph}</g></g>` : ''}</g>`;
}
const G = {
  up: '<path d="M12 20V5M6 11l6-6 6 6"/>', rot: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>', move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  size: '<path d="M5 19L19 5M13 5h6v6M11 19H5v-6"/>', slide: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>', flip: '<path d="M12 4v16M7 15l5 5 5-5"/>', depth: '<path d="M4 12h16M14 6l6 6-6 6"/><path d="M4 6v12"/>',
};
export const objFrame = MN.objFrame;
/** Round 2 manipulation language (manip.js); C keeps the round 1.1 knobs for comparison. */
function handlesSvg(e) {
  if (S.cmp.manip !== 'knobs') {
    if (e.kind === 'object' || e.kind === 'import') return S.cmp.manip === 'dims' ? MN.objectDims(e) : MN.objectRays(e);
    if (e.kind === 'wall') return MN.wallHandles(e);
    if (e.kind === 'roof') return MN.roofHandles(e);
    if (e.kind === 'room' && e.type === 'platform') return MN.platformHandles(e);
    if (e.kind === 'opening' || e.kind === 'artwork') return MN.hostedHandles(e);
    return '';
  }
  return knobsSvg(e);
}
function knobsSvg(e) {
  let s = '';
  if (e.kind === 'object' || e.kind === 'import') {
    const z0 = e.z || 0, z1 = z0 + e.h, { u, v } = MN.objFrame(e);
    const at = (du, dv, z) => wpx([e.x + u[0] * du + v[0] * dv, e.y + u[1] * du + v[1] * dv, z]);
    const base = at(0, 0, z0); if (!base) return '';
    const r = Math.max(e.w, e.d) / 2 + 0.45;
    let ring = ''; for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; const p = wpx([e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, z0 + 0.02]); if (p) ring += `${p[0]},${p[1]} `; }
    s += `<polyline class="h-ring" points="${ring}"/>`;
    const rp = at(r, 0, z0 + 0.02);
    s += knob(base[0], base[1], 'move', G.move, 'Drag to slide; it settles on the surface beneath');
    if (rp) s += knob(rp[0], rp[1], 'rotate', G.rot, 'Turn about its vertical axis (15° detents, ⌥ free)');
    const open = S.cmp.handles === 'immediate' || S.sizeOpen === e.id;
    const c = at(e.w / 2, e.d / 2, z1); if (c) s += knob(c[0], c[1], 'size', G.size, open ? 'Scale in proportion (base stays put)' : 'Scale in proportion · click for width, depth and height handles');
    if (open) {
      const pw = at(e.w / 2 + 0.25, 0, z0 + e.h / 2), pd = at(0, e.d / 2 + 0.25, z0 + e.h / 2), ph = at(0, 0, z1 + 0.3);
      const wl = e.fit === 'extend' ? 'Extend the width (parametric: legs keep their size)' : 'Stretch the width';
      if (pw) s += knob(pw[0], pw[1], 'w', '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>', wl, 'axis sm');
      if (pd) s += knob(pd[0], pd[1], 'd', '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>', 'Stretch the depth', 'axis sm');
      if (ph) s += knob(ph[0], ph[1], 'h', G.up, 'Raise the top; the base stays on its support', 'axis sm');
    }
  } else if (e.kind === 'wall') {
    const a = wpx([...e.a, e.base]), b = wpx([...e.b, e.base]);
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const t = R.mode === 'plan' ? null : wpx([...mid, e.top]);
    if (a) s += `<g class="hit" data-h="end-a"><title>Drag the end</title><circle class="h-dot" cx="${a[0]}" cy="${a[1]}" r="7"/></g>`;
    if (b) s += `<g class="hit" data-h="end-b"><title>Drag the end</title><circle class="h-dot" cx="${b[0]}" cy="${b[1]}" r="7"/></g>`;
    if (t) s += knob(t[0], t[1] - 2, 'top', G.up, 'Drag the top; snaps to heights on the Sheet');
    const L = SC.wallLen(e), n = [-(e.b[1] - e.a[1]) / L, (e.b[0] - e.a[0]) / L];
    const off = R.mode === 'plan' ? 0.9 : 0.6; const m2 = wpx([mid[0] + n[0] * off, mid[1] + n[1] * off, R.mode === 'plan' ? e.base : e.base + (e.top - e.base) * 0.45]);
    if (m2) s += knob(m2[0], m2[1], 'push', G.slide, 'Drag to move the wall parallel');
  } else if (e.kind === 'roof' && R.mode !== 'plan' && !e.poly) {
    const pr = SC.roofProf(e), top = Math.max(...pr.map((q) => q[1])), k = pr.findIndex((q) => q[1] === top);
    const p = wpx([(e.x0 + e.x1) / 2, e.y0 + pr[k][0], top + (S.lift ? 2.6 : 0)]);
    if (p) s += knob(p[0], p[1] - 14, 'ridge', G.up, SC.roofFlat(e) ? 'Drag the roof height · double-click to edit its section' : 'Drag the ridge · double-click to edit its section');
  } else if ((e.kind === 'opening' || e.kind === 'artwork') && R.mode !== 'plan') {
    const w = SC.wallById(M, e.host); if (!w) return '';
    const p = SC.wallPoint(w, e.at); const z = e.kind === 'artwork' ? e.c : e.sill + e.h / 2;
    const q = wpx([...p, z]); if (q) s += knob(q[0], q[1], 'slide', G.slide, 'Slide along its wall');
  }
  return s;
}
function spacingRibbons(a) {
  const w = SC.wallById(M, a.host); if (!w || R.mode === 'plan') return '';
  const list = M.artworks.filter((x) => x.host === a.host).sort((p, q) => p.at - q.at); let s = '';
  for (let i = 0; i < list.length - 1; i++) {
    const p = list[i], q = list[i + 1]; const gap = q.at - q.w / 2 - (p.at + p.w / 2);
    const A = wpx([...SC.wallPoint(w, p.at + p.w / 2), a.c - 0.7]), B = wpx([...SC.wallPoint(w, q.at - q.w / 2), a.c - 0.7]);
    if (A && B) s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#d4ad45" stroke-width="2" stroke-dasharray="3 3"/>` + tag((A[0] + B[0]) / 2 - 20, (A[1] + B[1]) / 2 + 22, `${f2(gap)} m`);
  }
  return s;
}
// Slice: a finite straight cut drawn like a Pen line, its inspection volume in translucent yellow,
// white end points to re-draw it, the line itself to move it, and a depth ray to change how far it looks
function sliceWidgets() {
  const sl = S.slice; const { d, n } = sliceFrame(); const plan = R.mode === 'plan';
  const z = plan ? 0 : sl.z ?? 0, zTop = Math.max(z + 1, R.box[5] + 0.4);
  const A = [...sl.a, z], B = [...sl.b, z], nD = SC.mul(n, sl.depth);
  const P = (p) => wpx(p), q = (p) => p.map((v) => v.toFixed(1)).join(',');
  const a = P(A), b = P(B); if (!a || !b) return '';
  const far = (p) => [p[0] + nD[0], p[1] + nD[1], p[2]];
  let s = '';
  if (!plan) {
    const quad = (pts, cls) => { const Q = pts.map(P); return Q.some((x) => !x) ? '' : `<polygon class="${cls}" points="${Q.map(q).join(' ')}"/>`; };
    const up = (p) => [p[0], p[1], zTop];
    s += quad([far(A), far(B), up(far(B)), up(far(A))], 'sl-vol far');
    s += quad([A, far(A), up(far(A)), up(A)], 'sl-vol side') + quad([B, far(B), up(far(B)), up(B)], 'sl-vol side');
    s += quad([up(A), up(B), up(far(B)), up(far(A))], 'sl-vol top');
    s += quad([A, B, up(B), up(A)], 'sl-plane');
  } else {
    const Q = [A, B, far(B), far(A)].map(P); if (Q.every(Boolean)) s += `<polygon class="sl-vol top" points="${Q.map(q).join(' ')}"/>`;
  }
  // the cut line itself is the move grip
  const mv = S.hh === 'sl-move' || R.D?.kind === 'sl-move';
  s += `<g class="hit mh${mv ? ' hov' : ''}" data-h="sl-move"><title>Drag the line to move the cut</title><line class="gd-h solid" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="sl-line" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="hzl" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/></g>`;
  for (const [h, p] of [['sl-a', a], ['sl-b', b]]) s += `<g class="hit mh${S.hh === h || R.D?.kind === h ? ' hov' : ''}" data-h="${h}"><title>Drag the end to redraw the cut</title><circle class="ap-h" cx="${p[0]}" cy="${p[1]}" r="6.4"/><circle class="ap" cx="${p[0]}" cy="${p[1]}" r="4.8"/><circle class="hz" cx="${p[0]}" cy="${p[1]}" r="12"/></g>`;
  const mid = [(sl.a[0] + sl.b[0]) / 2, (sl.a[1] + sl.b[1]) / 2, z];
  const m = P(mid), mf = P(far(mid));
  if (m && mf) {
    const dir = [mf[0] - m[0], mf[1] - m[1]], L = Math.hypot(...dir) || 1, u = [dir[0] / L, dir[1] / L], nn = [-u[1], u[0]];
    const hd = `M${q([mf[0] - u[0] * 6 + nn[0] * 4, mf[1] - u[1] * 6 + nn[1] * 4])} L${q(mf)} L${q([mf[0] - u[0] * 6 - nn[0] * 4, mf[1] - u[1] * 6 - nn[1] * 4])}`;
    const on = S.hh === 'sl-depth' || R.D?.kind === 'sl-depth';
    s += `<g class="hit mh${on ? ' hov' : ''}" data-h="sl-depth"><title>Inspection depth ${f2(sl.depth)} m · drag</title><line class="gd-h" x1="${m[0]}" y1="${m[1]}" x2="${mf[0]}" y2="${mf[1]}"/><line class="gd" x1="${m[0]}" y1="${m[1]}" x2="${mf[0]}" y2="${mf[1]}"/><path class="ah-h" d="${hd}"/><path class="ah" d="${hd}"/><circle class="hz" cx="${mf[0]}" cy="${mf[1]}" r="13"/></g>`;
    if (on || (R.D && ['sl-depth'].includes(R.D.kind))) s += tag(mf[0] + 12, mf[1] - 8, `Depth ${f2(sl.depth)} m`);
  }
  if (R.D && R.D.kind === 'slice') s += tag(b[0] + 12, b[1] - 10, `${f2(Math.hypot(sl.b[0] - sl.a[0], sl.b[1] - sl.a[1]))} m · live section`);
  else if (R.D && ['sl-a', 'sl-b', 'sl-move'].includes(R.D.kind)) s += tag(b[0] + 12, b[1] - 10, 'live section');
  return s;
}
// Edit shape, on the object: the roof's own section plane, its profile and joints in 3D
export function roofSectionX(r) { return S.editShape?.x ?? (r.x0 + r.x1) / 2; }
function onObjectSection() {
  const r = ent(S.editShape.id); if (!r || r.poly) return '';
  const x = roofSectionX(r), pr = SC.roofProf(r), L = S.lift ? 2.6 : 0, flat = S.reading === 'rsect';
  const zTop = Math.max(...pr.map((q) => q[1])) + 0.6;
  const corners = [[r.y0 - 0.4, 0], [r.y1 + 0.4, 0], [r.y1 + 0.4, zTop], [r.y0 - 0.4, zTop]].map(([y, z]) => wpx([x, y, z + L]));
  if (corners.some((c) => !c)) return '';
  // in 3D the section plane is drawn on the roof; in Section 2D the reading itself is the plane
  let s = flat ? '' : `<polygon class="sec-plane" points="${corners.map((c) => c.join(',')).join(' ')}"/>`;
  const P = pr.map(([sv, z]) => wpx([x, r.y0 + sv, z + L]));
  s += `<polyline class="sec-prof-h" points="${P.map((p) => p.join(',')).join(' ')}"/><polyline class="sec-prof" points="${P.map((p) => p.join(',')).join(' ')}"/>`;
  const j = S.editShape.joint;
  if (j != null && P[j]) {
    // the active joint shows its height and its place across the span as two quiet guides
    const base = wpx([x, r.y0 + pr[j][0], Math.max(0, SC.roofEave(r) - (flat ? 1.5 : 0.01)) + L]), side = wpx([x, r.y0 - 0.4, pr[j][1] + L]);
    if (base) s += `<line class="gd faint" x1="${P[j][0]}" y1="${P[j][1]}" x2="${base[0]}" y2="${base[1]}"/>`;
    if (side && flat) s += `<line class="gd faint" x1="${P[j][0]}" y1="${P[j][1]}" x2="${side[0]}" y2="${side[1]}"/>`;
  }
  for (let i = 0; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; const h = `jadd-${i}`; s += `<g class="hit mh${S.hh === h ? ' hov' : ''}" data-h="${h}"><title>Drag to add a joint here</title><circle class="j-add" cx="${m[0]}" cy="${m[1]}" r="3"/><circle class="hz" cx="${m[0]}" cy="${m[1]}" r="10"/></g>`; }
  P.forEach((p, i) => { const h = `j-${i}`; const on = j === i; s += `<g class="hit mh${S.hh === h ? ' hov' : ''}${on ? ' act' : ''}" data-h="${h}"><title>Drag the joint · ⌥-click removes it</title><circle class="ap-h" cx="${p[0]}" cy="${p[1]}" r="${on ? 7.2 : 6}"/><circle class="ap${on ? ' on' : ''}" cx="${p[0]}" cy="${p[1]}" r="${on ? 5.6 : 4.4}"/><circle class="hz" cx="${p[0]}" cy="${p[1]}" r="12"/></g>`; });
  if (!flat) { const cap = wpx([x, r.y0 - 0.4, zTop + L]); if (cap) s += tag(cap[0] - 10, cap[1] - 8, `Section of ${r.name}`); }
  if (R.D && R.D.tag) {} else if (j != null && P[j]) { const q = pr[j], p = P[j]; s += tag(p[0] + 12, p[1] - 12, `${f2(q[0])} across · ${f2(q[1])} high`); }
  return s;
}

// ---------------- furniture: 2D | 3D, readings disclosure, drafting words, pill, zoom ----------------
export function readingName() {
  if (S.lookThrough) return 'Looking through';
  if (followPose()) return 'Following';
  if (S.look) return { unroll: 'Unrolled', face: 'Facing a wall' }[S.look.kind] || 'Look';
  return { '3d': '3D', plan: '2D', elev: `Elevation ${S.elevFace}`, eye: 'Eye level', section: 'Section' }[S.reading];
}
export function renderFurniture() {
  const f = $('#furn'); const paper = ground() === 'paper';
  let h = '';
  if (!S.lookThrough && !followPose()) {
    const prim = S.reading === 'plan' ? 'plan' : S.reading === '3d' ? '3d' : null;
    if (S.editShape) { const v = S.editShape.view; h += `<div class="sf sf-tl"><div class="vseg glass dk es" role="group" aria-label="Edit shape reading"><button data-act="esview" data-v="3d" aria-pressed="${v === '3d'}" title="Edit on the roof in 3D (1)">3D</button><button data-act="esview" data-v="section" aria-pressed="${v === 'section'}" title="Focused roof Section 2D (2)">${icon('section', 14)}Section</button></div>`; }
    else h += `<div class="sf sf-tl"><div class="vseg glass dk" role="group" aria-label="Reading"><button data-act="reading" data-v="plan" aria-pressed="${prim === 'plan' && !S.look}" title="2D (2)">2D</button><button data-act="reading" data-v="3d" aria-pressed="${prim === '3d' && !S.look}" title="3D (1)">3D</button><button class="more${!prim || S.look ? ' on' : ''}" data-act="viewmore" aria-expanded="${S.viewMore}" title="Other readings and camera options">${!prim || S.look ? `<span>${esc(readingName())}</span>` : ''}${icon('chevronDown', 13)}</button></div>`;
    h += `<span class="drafting glass dk"><button class="${S.grid ? '' : 'off'}" data-act="grid" title="Grid ${S.grid ? 'on' : 'off'} · 1 m">Grid</button><button class="${S.snap ? '' : 'off'}" data-act="snap" title="Snap ${S.snap ? 'on' : 'off'} · 0.5 m">Snap</button></span></div>`;
  }
  if (S.viewMore) h += viewMore();
  h += pillHtml();
  const scalePx = R.V.k * 5;
  h += `<div class="sf sf-bl">${R.CAM && R.CAM.kind !== 'persp' && R.CAM.kind !== 'axo' && paper ? `<span class="scalebar" style="--w:${scalePx}px"><i></i>5 m</span>` : ''}${R.CAM && R.CAM.kind === 'axo' ? `<span title="Drag empty Stage to turn · [ and ] turn 15°">${icon('north', 14)}</span>` : ''}</div>`;
  h += `<div class="sf sf-br ${S.sheet.side === 'right' && sheetVisible() ? 'shift' : ''}"><button class="glass dk" data-act="zoom" data-v="1.25" title="Zoom in">${icon('plus', 15)}</button><button class="glass dk" data-act="zoom" data-v="0.8" title="Zoom out">${icon('minus', 15)}</button><button class="glass dk" data-act="fit" title="Fit all">${icon('fit', 15)}</button></div>`;
  f.innerHTML = h;
}
function viewMore() {
  const r = S.reading;
  let h = `<div class="pop vmore" style="top:50px;left:12px"><button class="row" data-act="reading" data-v="eye" aria-pressed="${r === 'eye'}">${icon('person', 15)}Eye level<span class="k kbd">4</span></button>`;
  h += `<div class="row" aria-pressed="${r === 'elev'}">${icon('elevation', 15)}Elevation<span class="sub">${['S', 'E', 'N', 'W'].map((fc) => `<button data-act="elevface" data-v="${fc}" aria-pressed="${r === 'elev' && S.elevFace === fc}">${fc}</button>`).join('')}</span></div>`;
  if (S.slice && !S.slice.horizontal) h += `<button class="row" data-act="reading" data-v="section" aria-pressed="${r === 'section'}">${icon('section', 15)}Face the cut<span class="k kbd">5</span></button>`;
  h += `<hr><div class="row2"><span>Projection</span><span class="seg2">${[['axo', 'Axo'], ['persp', 'Persp']].map(([k, l]) => `<button data-act="projection" data-v="${k}" aria-pressed="${S.projection === k}">${l}</button>`).join('')}</span></div>`;
  h += `<div class="row2"><span>Roofs from above</span><span class="seg2">${[['xray', 'X-ray'], ['solid', 'Solid']].map(([k, l]) => `<button data-act="overhead" data-v="${k}" aria-pressed="${S.overhead === k}">${l}</button>`).join('')}</span></div>`;
  h += `<div class="foot">Paper or shaded top-down views: ☰ ▸ Viewing</div></div>`;
  return h;
}
function pillHtml() {
  if (S.lookThrough) { const v = view(S.lookThrough.id); return `<div class="pill gold">${icon('camera', 14)} Looking through <b>${esc(v.name)}</b> <button class="pri" data-act="lt-update">Update View</button><button data-act="lt-exit">Exit</button></div>`; }
  if (followPose()) return `<div class="pill gold">${icon('camera', 14)} Following the Guide <button data-act="follow">Stop</button></div>`;
  if (S.slice) return `<div class="pill slice">${icon('slice', 14)} ${S.slice.horizontal ? `Cut at ${f2(S.slice.h)}` : 'Section'} · depth ${f2(S.slice.depth)} m${!S.slice.horizontal ? `<button data-act="slice-flip" title="Keep the other side">Flip</button>${S.reading === 'section' ? '' : '<button data-act="reading" data-v="section">Face</button>'}` : ''}<button data-act="slice-clear">Put back</button></div>`;
  if (S.look) return `<div class="pill">${icon(S.look.kind === 'face' ? 'face' : 'unroll', 14)} ${esc(S.look.kind === 'face' ? SC.wallById(M, S.look.walls[0])?.name || '' : 'Room unrolled')} <button data-act="putback">Put back</button></div>`;
  if (S.lift) return `<div class="pill">${icon('lift', 14)} Roofs lifted (view only) <button data-act="lift">Put back</button></div>`;
  if (S.placing) return `<div class="pill">${icon('assets', 14)} Placing <b>${esc(S.placing.name)}</b> <button data-act="tool" data-v="select">Done</button></div>`;
  return '';
}

// ---------------- height Sheet: a compact vertical slider ----------------
export function sheetVisible() { return S.lens === 'world' && !S.lookThrough && !S.look && S.reading !== 'eye' && !S.preview; }
export function sheetMax() { return Math.max(5, Math.ceil(R.box[5] + 1)); }
export function renderSheet() {
  const el = $('#rail');
  if (!sheetVisible()) { el.innerHTML = ''; return; }
  const zMax = sheetMax(), y = (z) => `${(1 - z / zMax) * 100}%`;
  const marks = heightMarks(), here = markAt(S.sheet.h);
  const [lo, hi] = bandAt(S.sheet.h);
  let h = `<div class="hsheet ${S.sheet.side}" role="group" aria-label="Height Sheet"><div class="track" id="sheettrack"><i class="axis"></i>`;
  if (S.focus) h += `<i class="band" style="top:${y(Math.min(hi, zMax))};bottom:${(lo / zMax) * 100}%"></i>`;
  if (S.slice && S.slice.horizontal) h += `<i class="cut" style="top:${y(S.slice.h)}"></i>`;
  for (const m of marks) {
    const k = m.kinds.has('level') ? 'level' : m.kinds.has('pin') ? 'pin' : 'surface';
    const what = [m.kinds.has('level') ? 'Level' : '', m.kinds.has('surface') ? 'surface' : '', m.kinds.has('pin') ? 'pinned' : ''].filter(Boolean).join(' · ');
    const nm = m.labels.slice(0, 2).join(', ') + (m.labels.length > 2 ? ` +${m.labels.length - 2}` : '');
    h += `<button class="tick ${k}${m.kinds.has('pin') && k !== 'pin' ? ' pinned' : ''}${Math.abs(m.z - S.sheet.h) < 0.02 ? ' here' : ''}${S.tickFlash != null && Math.abs(m.z - S.tickFlash) < 0.02 ? ' flash' : ''}" style="top:${y(m.z)}" data-act="toheight" data-v="${m.z}" aria-label="${esc(nm)} ${f2(m.z)}"><i></i><span class="lb"><b>${f2(m.z)}</b> ${esc(nm)}<small>${what}</small></span></button>`;
  }
  const canPin = S.sheet.h > 0.01 && !(here && (here.kinds.has('pin') || here.kinds.has('level')));
  h += `<div class="knob${S.sheet.drag ? ' drag' : ''}" id="sheetknob" style="top:${y(S.sheet.h)}" tabindex="0" title="Working height · drag, or double-click to type">${S.sheet.editing ? `<input id="sheetin" value="${f2(S.sheet.h)}">` : f2(S.sheet.h)}${canPin ? `<button class="pinbtn" data-act="pin" title="Pin ${f2(S.sheet.h)} as a height checkpoint">${icon('pin', 12)}</button>` : ''}${S.sheet.drag && here ? `<span class="snapname">${esc(markName(here))}</span>` : ''}</div>`;
  if (S.hint && S.hint.kind === 'pin') h += `<div class="hintb" style="top:${y(S.hint.z)}">Pin ${f2(S.hint.z)} for later? <button data-act="pin" data-v="${S.hint.z}">Pin</button><button data-act="hintx" title="Don't suggest again">${icon('close', 11)}</button></div>`;
  h += `</div><div class="foot"><button data-act="focus" aria-pressed="${S.focus}" title="Focus this height: ghost other stories (F)">${icon('focusHeight', 14)}</button><button data-act="sheetside" title="Dock on the ${S.sheet.side === 'right' ? 'left' : 'right'}">${icon('swap', 14)}</button></div></div>`;
  el.innerHTML = h;
}
