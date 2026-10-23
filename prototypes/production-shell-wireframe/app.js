// Production-shell wireframe: mock state, one render pass per change, no framework.
// Every mechanism here is a prototype shortcut (snapshot Undo, mock Camera interpolation,
// bounding-box roofs, centroid lasso). See DESIGN-NOTE.md for what is being proposed.
import { icon } from './icons.js';
import * as SC from './scene.js';

const $ = (s, r = document) => r.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = (n) => Number(n).toFixed(2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let M = SC.seedModel();
M.tray = []; M.loose = [];
const H = { stack: [{ label: 'Open Boathouse gallery', m: clone(M) }], i: 0 };
let uid = 1;

const S = {
  lens: 'world', reading: '3d', elevFace: 'S', appearance: 'auto', projection: 'axo', az: 35,
  tool: 'select', inkTip: 'sketch', inkTop: 'studio-top', eraseMode: 'lasso', eraseFilter: { wall: true, opening: true, object: true, artwork: true, roof: false, room: true, import: true },
  sliceMode: 'vertical', measureMode: 'distance',
  sel: null, hover: null, place: 'room-gal', placeLocked: false,
  indexOpen: true, indexSheet: false, cardSheet: false, cardLook: false, cardDetails: false,
  sheet: { h: 0, raised: false }, focus: false, railOpen: true,
  instrument: null, viewPop: false, ctx: null, readChip: null, toast: null,
  placing: null, paint: null, slice: null, look: null, lift: false,
  meas: null, ink: null, marked: new Set(), lassoPoly: null,
  cams: {}, eye: { pos: [3.6, -4.5, 1.6], target: [6, 3, 1.5] },
  guideOpen: false, playing: false, t: 0, follow: false, lookThrough: null, preview: null,
  narrow: 'wide', width: 'fill', cmp: { dock: 'bottom', rail: 'left', edit: 'pad', toolColor: true },
  overhead: 'xray', editShape: null, journey: null, coachMin: false, overflow: false, findQ: '', search: '', exSearch: '',
};

// ---------------- helpers over the model ----------------
const ent = (id) => (id ? SC.find(M, id) : null);
const view = (id) => M.views.find((v) => v.id === id);
const pres = (id) => M.presentations.find((p) => p.id === id);
const guide = () => M.guides[0];
const datum = (id) => M.datums.find((d) => d.id === id);
const nearestDatum = (z, tol = 0.06) => M.datums.find((d) => Math.abs(d.z - z) < tol);
const kindLabel = { wall: 'Wall', opening: 'Opening', roof: 'Roof', object: 'Object', artwork: 'Artwork', room: 'Room', import: 'Imported model', view: 'View', presentation: 'Presentation', stop: 'Stop', edge: 'Transition' };
const kindIcon = { wall: 'wall', opening: 'opening', roof: 'roof', object: 'object', artwork: 'material', room: 'plan', import: 'import' };

function roomOf(e) {
  if (!e) return null;
  if (e.kind === 'room') return e;
  if (e.kind === 'wall') return M.rooms.find((r) => r.walls.includes(e.id) && SC.roomEnclosed(M, r));
  if (e.kind === 'opening' || e.kind === 'artwork') return roomOf(ent(e.host));
  if (e.kind === 'roof') return M.rooms.find((r) => (e.over || []).some((w) => r.walls.includes(w)));
  if (e.kind === 'object' || e.kind === 'import') return M.rooms.find((r) => SC.roomEnclosed(M, r) && SC.pointInPoly([e.x, e.y], r.poly));
  return null;
}
function wallRole(w) {
  const rs = M.rooms.filter((r) => r.walls.includes(w.id) && SC.roomEnclosed(M, r));
  if (rs.length >= 2) return `divides ${rs.map((r) => r.name).join(' | ')}`;
  if (rs.length === 1) return `bounds ${rs[0].name}`;
  return 'free-standing';
}
function usedIn(id) { return M.presentations.filter((p) => p.subject === id); }
function zRange(p) { const zs = p.pts.map((q) => q[2]); return [Math.min(...zs), Math.max(...zs)]; }
function focusBand() { const h = S.sheet.h; const above = M.datums.filter((d) => d.z > h + 0.05).sort((a, b) => a.z - b.z)[0]; return [h - 0.05, above ? above.z + 0.05 : h + 3]; }

// ---------------- history ----------------
function commit(label) { H.stack = H.stack.slice(0, H.i + 1); H.stack.push({ label, m: clone(M) }); H.i++; }
function amend(label) { H.stack[H.i] = { label, m: clone(M) }; }
function liveGesture() { return !!(D || S.ink || (S.instrument && S.instrument.kind === 'erase')); }
function undo() {
  if (liveGesture()) return toast('Undo waits: finish or cancel the live gesture first (Esc).', true);
  if (H.i === 0) return;
  const lbl = H.stack[H.i].label; H.i--; M = clone(H.stack[H.i].m); afterHistory(); toast(`Undid ${lbl}`);
}
function redo() { if (H.i >= H.stack.length - 1 || liveGesture()) return; H.i++; M = clone(H.stack[H.i].m); afterHistory(); toast(`Redid ${H.stack[H.i].label}`); }
function afterHistory() { if (S.sel && !ent(S.sel) && !expEnt(S.sel)) S.sel = null; S.readChip = null; render(); }

// ---------------- toast ----------------
let toastTimer;
function toast(msg, refusal = false, action) {
  S.toast = { msg, refusal, action }; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; renderFloat(); }, refusal ? 3800 : 2800);
  renderFloat();
}

// ---------------- cameras & mapping ----------------
let V = { x: 0, y: 0, w: 1, h: 1, k: 1, ox: 0, oy: 0 }, CAM = null, CENT = {}, RENDERED = { mode: '' };
function camKey() { return S.look ? `look-${S.look.kind}` : S.reading === 'elev' ? `elev-${S.elevFace}` : S.reading + (S.reading === '3d' ? S.projection : ''); }
function camState() { const k = camKey(); return S.cams[k] || (S.cams[k] = { z: 1, pan: [0, 0] }); }
function focal(lens) { return lens * 0.889; }
function followPose() { if (!(S.lens === 'experience' && S.guideOpen && S.follow)) return null; return evalGuide(S.t).pose; }
function currentCam() {
  if (S.lookThrough) { const v = view(S.lookThrough.id); return SC.camera('persp', { pos: S.lookThrough.pos, target: S.lookThrough.target, F: focal(v.lens) }); }
  const fp = followPose(); if (fp) return SC.camera('persp', { pos: fp.pos, target: fp.target, F: focal(26) });
  switch (S.reading) {
    case '3d': return S.projection === 'persp' ? SC.orbitPersp(S.az) : SC.camera('axo', { az: S.az });
    case 'plan': return SC.camera('plan');
    case 'elev': return SC.camera('elev', { face: S.elevFace });
    case 'eye': return SC.camera('persp', { pos: S.eye.pos, target: S.eye.target, F: focal(24) });
    case 'section': return sectionCam();
  }
}
function sectionCam() {
  const sl = S.slice; const d = SC.norm(SC.sub(sl.b, sl.a)); let n = [-d[1], d[0]]; if (sl.flip) n = [-n[0], -n[1]];
  return SC.camera('sect', { a: sl.a, d, n });
}
function isPersp(c) { return c && c.kind === 'persp'; }
function readingIsPaper() { return S.look ? true : ['plan', 'elev', 'section'].includes(S.reading); }
function ground() {
  if (S.lookThrough || followPose()) return 'mat';
  if (S.appearance === 'paper') return 'paper';
  if (S.appearance === 'shaded') return readingIsPaper() ? 'paper' : 'mat';
  return readingIsPaper() ? 'paper' : 'mat';
}
function palette() { const g = ground(); if (g === 'mat') return SC.PAL.mat; return S.appearance === 'shaded' ? SC.PAL.shadedPaper : SC.PAL.paper; }
function flatLines() { return ground() === 'paper' && S.appearance !== 'shaded'; }
function toVB(ev) { const r = $('#stage').getBoundingClientRect(); return [(ev.clientX - r.left - V.ox) / V.k + V.x, (ev.clientY - r.top - V.oy) / V.k + V.y]; }
function toPx(uv) { return [(uv[0] - V.x) * V.k + V.ox, (uv[1] - V.y) * V.k + V.oy]; }
function wpx(p) { const q = CAM.P(p); if (q[3]) return null; return toPx(q); }
function onPlane(ev, h = 0) { const [u, v] = toVB(ev); if (!CAM || !CAM.onPlane) return null; return CAM.onPlane(u, v, h); }
function snapPt(p, opts = {}) {
  if (!p) return p;
  // ends of walls first, then grid
  if (!opts.noEnds) for (const w of M.walls) for (const e of [w.a, w.b]) if (Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.35) return { p: [...e], why: 'end' };
  if (!S.snap) return { p };
  const g = 0.5; return { p: [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g], why: 'grid' };
}
S.snap = true; S.grid = true;

// ---------------- the whole render ----------------
function render() {
  renderFrame(); renderHead(); renderIndex(); renderStage(); renderRail(); renderCard(); renderLower(); renderFloat(); renderPreview(); renderCoach();
}
function renderFrame() {
  const fr = $('#frame'); const sizes = { fill: null, laptop: [1280, 800], narrow: [940, 760], tablet: [720, 900], phone: [390, 780] };
  const s = sizes[S.width]; fr.classList.toggle('sim', !!s);
  fr.style.width = s ? s[0] + 'px' : '100%'; fr.style.height = s ? Math.min(s[1], window.innerHeight - 50) + 'px' : '100%';
  const w = s ? s[0] : window.innerWidth; S.narrow = w <= 640 ? 'phone' : w <= 1000 ? 'mid' : 'wide';
  $('#app').dataset.lens = S.lens;
}

// ---------------- Head ----------------
function renderHead() {
  const can = H.i > 0, canR = H.i < H.stack.length - 1;
  const e = selEntity();
  const narrow = S.narrow !== 'wide';
  const place = M.rooms.find((r) => r.id === S.place);
  $('#head').innerHTML = `
    <button class="hbtn" data-act="appmenu" title="App menu: Settings, Keys, Hide side panels">${icon('menu')}</button>
    <span class="mark" aria-hidden="true">B</span>
    <span class="proj" title="Project">Boathouse gallery</span>
    <span class="sep"></span>
    <div class="seg" role="group" aria-label="Lens">
      <button aria-pressed="${S.lens === 'world'}" data-act="lens" data-v="world">World</button>
      <button aria-pressed="${S.lens === 'experience'}" data-act="lens" data-v="experience">Experience</button>
    </div>
    ${S.lens === 'experience' ? `<span class="exp">Experience <b>Opening night</b>${icon('chevronDown', 14)}</span>` : ''}
    ${narrow ? `<button class="hbtn" data-act="indexsheet" title="Location">${icon('indexPanel')}<span style="max-width:90px;overflow:hidden;text-overflow:ellipsis">${esc(S.lens === 'world' ? (place ? place.name : 'Project') : 'Presentations')}</span></button>` : ''}
    <span class="grow"></span>
    <button class="chip-id ${e ? 'sel' : ''}" data-act="cardsheet" ${e ? '' : 'disabled'} title="Selected identity — opens the Card">${e ? `${icon(e.icon || 'dot', 14)}<span>${esc(e.name)}</span>` : '<span class="quiet">Nothing selected</span>'}</button>
    <button class="hbtn" data-act="undo" ${can ? '' : 'disabled'} title="Undo ${esc(can ? H.stack[H.i].label : '')} (⌘Z)">${icon('undo')}<span class="verb">${can ? 'Undo ' + esc(H.stack[H.i].label) : ''}</span></button>
    <button class="hbtn" data-act="redo" ${canR ? '' : 'disabled'} title="Redo">${icon('redo')}</button>
    <span class="saved">${icon('check', 14)}<span>Saved</span></span>
    <button class="btn-preview" data-act="preview" title="Preview the visitor experience">${icon('preview', 16)}<span>Preview</span></button>`;
}

function selEntity() {
  if (!S.sel) return null;
  const x = ent(S.sel); if (x) return { ...x, icon: kindIcon[x.kind] };
  const y = expEnt(S.sel); return y;
}
function expEnt(id) {
  if (!id) return null;
  const v = view(id); if (v) return { ...v, kind: 'view', icon: 'camera' };
  const p = pres(id); if (p) return { ...p, kind: 'presentation', icon: 'layers' };
  const g = guide(); const si = g.stops.findIndex((s) => s.id === id);
  if (si >= 0) return { ...g.stops[si], kind: 'stop', idx: si, name: `Stop ${si + 1} · ${pres(g.stops[si].pres).name}`, icon: 'guide' };
  if (id.startsWith('edge-')) { const i = +id.slice(5); return { ...g.edges[i], kind: 'edge', idx: i, name: `Stop ${i + 1} → ${i + 2}`, icon: 'travel' }; }
  return null;
}

// ---------------- Index ----------------
function renderIndex() {
  const el = $('#index');
  const narrow = S.narrow !== 'wide';
  el.style.display = narrow ? 'none' : '';
  if (!narrow && !S.indexOpen) { el.className = 'index rail'; el.innerHTML = `<button class="iconbtn" data-act="indexopen" title="Show Index">${icon('indexPanel')}</button><button class="iconbtn" data-act="indexopen" title="Search">${icon('search')}</button>`; return; }
  el.className = 'index';
  el.innerHTML = indexBody();
  const sh = $('#isheet');
  if (narrow && S.indexSheet) { sh.innerHTML = `<div class="scrim" data-act="indexsheet"></div><div class="sheetov left">${indexBody()}</div>`; } else sh.innerHTML = '';
}
function indexBody() {
  const head = `<div class="ihead"><span class="t">${S.lens === 'world' ? 'Index' : 'Experience'}</span><button class="iconbtn" data-act="${S.narrow !== 'wide' ? 'indexsheet' : 'indexclose'}" title="Hide">${icon('chevronRight', 16)}</button></div>`;
  return head + (S.lens === 'world' ? worldIndex() : expIndex());
}
function irow(id, name, meta, ic, extra = '') {
  const sel = S.sel === id ? ' sel' : '';
  return `<button class="irow${sel}${extra}" data-act="sel" data-id="${id}" data-hover="${id}">${icon(ic, 16)}<span class="nm">${esc(name)}</span><span class="mt">${meta || ''}</span></button>`;
}
function worldIndex() {
  const q = S.search.trim().toLowerCase();
  let h = `<div class="crumbs"><button data-act="place" data-id="">Boathouse gallery</button>›<span>Ground 0.00</span>${S.place ? `›<b>${esc(M.rooms.find((r) => r.id === S.place)?.name || '')}</b>` : ''}</div>`;
  h += `<label class="isearch">${icon('search', 15)}<input id="isearch" placeholder="Search subjects" value="${esc(S.search)}"></label><div class="ilist">`;
  if (q) {
    const res = SC.entities(M).filter((e) => e.name.toLowerCase().includes(q));
    h += `<div class="igroup"><span>Subjects</span><span>${res.length}</span></div>`;
    h += res.map((e) => irow(e.id, e.name, kindLabel[e.kind], kindIcon[e.kind])).join('') || '<div class="irow quiet">No subject matches. Tools and actions are in Find (⌘K).</div>';
    h += `<button class="iaction" data-act="find" data-q="${esc(S.search)}">${icon('find', 15)} Find “${esc(S.search)}” in tools &amp; actions</button>`;
    return h + '</div>';
  }
  const e = ent(S.sel);
  const room = M.rooms.find((r) => r.id === S.place && SC.roomEnclosed(M, r));
  if (e && room && roomOf(e)?.id !== room.id && e.kind !== 'room') h += `<button class="irow recover" data-act="sel" data-id="${e.id}">${icon(kindIcon[e.kind], 16)}<span class="nm">Selected elsewhere: ${esc(e.name)}</span><span class="mt">${esc(roomOf(e)?.name || 'not in a room')}</span></button>`;
  h += `<div class="igroup"><span>Places</span></div>`;
  for (const r of M.rooms.filter((r) => SC.roomEnclosed(M, r))) h += `<button class="irow${S.place === r.id ? ' open' : ''}${S.sel === r.id ? ' sel' : ''}" data-act="place" data-id="${r.id}" data-hover="${r.id}">${icon('plan', 16)}<span class="nm">${esc(r.name)}</span><span class="mt">${SC.polyArea(r.poly).toFixed(0)} m²</span></button>`;
  if (room) {
    const walls = room.walls.map((id) => SC.wallById(M, id)).filter(Boolean);
    const ops = M.openings.filter((o) => room.walls.includes(o.host));
    const arts = M.artworks.filter((a) => room.walls.includes(a.host));
    const objs = [...M.objects, ...M.imports].filter((o) => SC.pointInPoly([o.x, o.y], room.poly));
    const roofs = M.roofs.filter((r) => (r.over || []).some((w) => room.walls.includes(w)));
    const grp = (t, list, fn) => (list.length ? `<div class="igroup"><span>${t}</span><span>${list.length}</span></div>` + list.map(fn).join('') : '');
    h += grp('Bounds', walls, (w) => irow(w.id, w.name, `${SC.wallLen(w).toFixed(1)} m`, 'wall'));
    h += grp('Openings on bounds', ops, (o) => irow(o.id, o.name, `${f2(o.w)} m`, 'opening'));
    h += grp('Attached here', arts, (a) => irow(a.id, a.name, 'on ' + (SC.wallById(M, a.host)?.name || '?'), 'material'));
    h += grp('Located here', objs, (o) => irow(o.id, o.name, M.imports.includes(o) ? 'import' : '', M.imports.includes(o) ? 'import' : 'object'));
    h += grp('Overhead', roofs, (r) => irow(r.id, r.name, r.kind, 'roof'));
  }
  const loose = M.walls.filter((w) => !M.rooms.some((r) => r.walls.includes(w.id) && SC.roomEnclosed(M, r)));
  if (loose.length) h += `<div class="igroup"><span>Not in a room</span><span>${loose.length}</span></div>` + loose.map((w) => irow(w.id, w.name, wallRole(w), 'wall')).join('');
  const freeRoofs = M.roofs.filter((r) => !(r.over || []).length);
  if (freeRoofs.length) h += `<div class="igroup"><span>Overhead elsewhere</span></div>` + freeRoofs.map((r) => irow(r.id, r.name, `at ${f2(r.eave)}`, 'roof')).join('');
  if (M.tray.length) h += `<div class="igroup"><span>Set aside</span><span>${M.tray.length}</span></div>` + M.tray.map((t, i) => `<div class="irow">${icon('layers', 16)}<span class="nm">${esc(t.name)}</span><button class="tbtn ghost" data-act="untray" data-i="${i}">Put back</button></div>`).join('');
  return h + '</div>';
}
function expIndex() {
  const g = guide(); const q = S.exSearch.toLowerCase();
  let h = `<label class="isearch">${icon('search', 15)}<input id="exsearch" placeholder="Search Presentations and Views" value="${esc(S.exSearch)}"></label><div class="ilist">`;
  h += `<div class="igroup"><span>Presentations</span><span>${M.presentations.length}</span></div>`;
  for (const p of M.presentations.filter((p) => !q || p.name.toLowerCase().includes(q))) {
    const selP = S.sel === p.id || p.views.includes(S.sel);
    h += `<button class="irow${S.sel === p.id ? ' sel' : ''}" data-act="sel" data-id="${p.id}"><span class="thumb">${thumbSvg(p.def, 54, 34)}</span><span class="nm">${esc(p.name)}<br><span class="mt">${p.views.length} view${p.views.length > 1 ? 's' : ''} · ◆ ${esc(view(p.def)?.name || 'unset')}</span></span></button>`;
    if (selP) for (const vid of p.views) h += `<button class="irow indent${S.sel === vid ? ' sel' : ''}" data-act="sel" data-id="${vid}">${icon('camera', 15)}<span class="nm">${esc(view(vid).name)}</span><span class="mt">${p.def === vid ? '◆ Default' : ''}</span></button>`;
  }
  h += `<button class="iaction" data-act="newpres">${icon('plus', 15)} New Presentation</button>`;
  h += `<div class="igroup"><span>Guides</span><span>1</span></div>`;
  h += `<button class="irow${S.guideOpen ? ' open' : ''}" data-act="guide">${icon('guide', 16)}<span class="nm">${esc(g.name)}</span><span class="mt">${g.stops.length} stops</span>${S.guideOpen ? '<span class="tag">Open</span>' : ''}</button>`;
  return h + '</div>';
}

// ---------------- Stage ----------------
function renderStage(xfade = false) {
  const st = $('#stage');
  st.dataset.tool = S.tool; st.dataset.ground = ground();
  st.dataset.look = S.lookThrough ? 'through' : followPose() ? 'follow' : '';
  st.style.setProperty('--sbg', palette().bg);
  CAM = currentCam();
  const W = st.clientWidth || 800, Hh = st.clientHeight || 600;
  let base;
  const mode = S.look && ['unroll', 'face'].includes(S.look.kind) ? 'unroll' : S.reading === 'plan' && !S.lookThrough && !followPose() ? 'plan' : 'solid';
  let res;
  const opts = stageOpts();
  if (mode === 'unroll') {
    res = SC.renderUnroll(M, S.look.walls, opts);
    base = [-1, -8.4, res.width + 1.4, 10];
    CAM = { kind: 'unroll', P: (p) => p };
  } else if (mode === 'plan') {
    res = SC.renderPlan(renderModel(), opts);
    base = SC.boundsOf(CAM);
  } else {
    res = SC.renderSolid(renderModel(), CAM, opts);
    if (isPersp(CAM)) { const w = 32; base = [-w / 2, (-w / 2) * (Hh / W), w, w * (Hh / W)]; } else base = SC.boundsOf(CAM);
  }
  CENT = res.centroids;
  const cs = camState();
  const cx = base[0] + base[2] / 2 + cs.pan[0], cy = base[1] + base[3] / 2 + cs.pan[1];
  const vw = base[2] / cs.z, vh = base[3] / cs.z;
  const k = Math.min(W / vw, Hh / vh);
  V = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh, k, ox: (W - vw * k) / 2, oy: (Hh - vh * k) / 2 };
  const svg = $('#world');
  svg.setAttribute('viewBox', `${V.x} ${V.y} ${V.w} ${V.h}`);
  const defs = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#cfd6db"/><line x1="0" y1="0" x2="0" y2="6" stroke="#8a98a0" stroke-width="2"/></pattern></defs>`;
  svg.innerHTML = defs + gridSvg(mode) + res.svg;
  if (xfade) { svg.classList.remove('xfade'); void svg.getBoundingClientRect(); svg.classList.add('xfade'); }
  RENDERED.mode = mode;
  renderOverlay();
  renderFurniture();
}
function renderModel() {
  if (S.slice && S.slice.horizontal) { const m = clone(M); const h = S.slice.h; m.walls.forEach((w) => (w.top = Math.min(w.top, h))); m.roofs = m.roofs.filter((r) => r.eave <= h); m.openings.forEach((o) => { if (o.sill + o.h > h) o.h = Math.max(0, h - o.sill); }); return m; }
  return M;
}
function stageOpts() {
  const sel = new Set(S.sel ? [S.sel] : []);
  const related = new Set();
  if (S.lens === 'experience' && S.sel) { const p = pres(S.sel) || M.presentations.find((p) => p.views.includes(S.sel)); if (p && p.subject) related.add(p.subject); }
  let ghost = null, hidden = null;
  if (S.focus && !S.look) { const [lo, hi] = focusBand(); const ps = SC.prims(M); const rng = {}; for (const p of ps) { const [a, b] = zRange(p); const r = rng[p.id] || (rng[p.id] = [Infinity, -Infinity]); r[0] = Math.min(r[0], a); r[1] = Math.max(r[1], b); } ghost = (id) => rng[id] && (rng[id][1] < lo || rng[id][0] > hi); }
  if (S.editShape) ghost = (id) => id !== S.editShape.id;
  if (S.slice && !S.slice.horizontal && S.reading !== 'plan') hidden = (id) => { const e = ent(id); if (!e) return false; const c = SC.entityPlanCentre(M, e); return SC.sliceSide(S.slice, c) * (S.slice.flip ? -1 : 1) < 0; };
  if (S.lens === 'experience' && !S.lookThrough && !followPose()) { const g0 = ghost; ghost = (id) => (g0 && g0(id)) || false; }
  const sheet = S.sheet.raised && S.lens === 'world' && !S.look && S.reading !== 'plan' ? { h: S.sheet.h, extent: [-1, -1, 19, 9] } : null;
  const xray = S.overhead === 'xray' && !S.lift && S.reading !== 'eye' && !S.lookThrough;
  return { pal: palette(), flat: flatLines(), sel, hover: S.hover, marked: S.marked, ghost, hidden, finishes: M.finishes, sheet, lift: S.lift, related, xray };
}
function gridSvg(mode) {
  if (!S.grid || S.lookThrough || followPose()) return '';
  if (mode === 'unroll') return '';
  let g = '';
  if (mode === 'plan' || (CAM.kind === 'axo') || isPersp(CAM)) {
    const h = mode === 'plan' ? 0 : 0;
    for (let x = -3; x <= 21; x++) { const a = CAM.P([x, -6, h]), b = CAM.P([x, 11, h]); if (a[3] || b[3]) continue; g += `<line class="${x % 5 === 0 ? 'maj' : ''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
    for (let y = -6; y <= 11; y++) { const a = CAM.P([-3, y, h]), b = CAM.P([21, y, h]); if (a[3] || b[3]) continue; g += `<line class="${y % 5 === 0 ? 'maj' : ''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
  } else {
    for (let z = 0; z <= 7; z++) { const a = CAM.P([-3, -6, z]), b = CAM.P([21, 11, z]); g += `<line class="${z === 0 ? 'maj' : ''}" x1="${Math.min(a[0], b[0]) - 5}" y1="${a[1]}" x2="${Math.max(a[0], b[0]) + 5}" y2="${a[1]}"/>`; }
  }
  return `<g class="gridlines">${g}</g>`;
}

// ---------------- overlay (screen px): handles, strokes, markers ----------------
function renderOverlay() {
  const o = $('#ovl'); let s = '';
  const e = ent(S.sel);
  if (e && RENDERED.mode === 'solid' && !S.lookThrough) s += selectionEcho(e.id);
  if (S.lens === 'world' && e && S.tool === 'select' && !S.lookThrough && RENDERED.mode !== 'unroll') s += handlesSvg(e);
  if (S.lens === 'world' && e && e.kind === 'artwork') s += spacingRibbons(e);
  if (S.ink && S.ink.pts.length) {
    const pts = S.ink.pts.map((p) => wpx([p[0], p[1], S.ink.h])).filter(Boolean);
    if (S.ink.cursor) { const c = wpx([...S.ink.cursor, S.ink.h]); if (c) pts.push(c); }
    s += `<polyline class="ink-live" points="${pts.map((p) => p.join(',')).join(' ')}"/>` + pts.map((p) => `<circle class="ink-pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('');
    if (S.ink.tag) s += tag(pts[pts.length - 1][0] + 12, pts[pts.length - 1][1] - 12, S.ink.tag);
  }
  if (S.ink && S.ink.opening) { const q = S.ink.opening.px; s += `<rect class="ink-live" x="${Math.min(q[0], q[2])}" y="${Math.min(q[1], q[3])}" width="${Math.abs(q[2] - q[0])}" height="${Math.abs(q[3] - q[1])}"/>`; s += tag(q[2] + 10, q[3] - 10, S.ink.opening.label); }
  if (S.slice && !S.slice.horizontal && S.reading !== 'section' && RENDERED.mode !== 'unroll') {
    const a = wpx([...S.slice.a, 0]), b = wpx([...S.slice.b, 0]);
    if (a && b) { s += `<line class="slice-l" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="slice-l2" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; s += tag(b[0] + 8, b[1] - 8, 'A'); }
  }
  if (D && D.kind === 'slice' && D.b) { const a = toPx(D.aPx), b = toPx(D.bPx); s += `<line class="slice-l" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line class="slice-l2" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
  if (S.lassoPoly && S.lassoPoly.length > 1) {
    const pts = S.lassoPoly.map(toPx).map((p) => p.join(',')).join(' ');
    s += S.eraseMode === 'scrub' ? `<polyline class="scrub" points="${pts}"/>` : `<polygon class="lasso" points="${pts}"/>`;
  }
  if (S.meas && S.meas.a) {
    const a = wpx([...S.meas.a, S.meas.h || 0]), b = wpx([...(S.meas.b || S.meas.cursor || S.meas.a), S.meas.h || 0]);
    if (a && b) { const d = Math.hypot(...SC.sub(S.meas.b || S.meas.cursor || S.meas.a, S.meas.a)); s += `<line class="meas" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="#fff"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#fff"/>` + tag((a[0] + b[0]) / 2 + 8, (a[1] + b[1]) / 2 - 8, `${f2(d)} m`); }
  }
  if (S.meas && S.meas.heightAt) { const m = S.meas.heightAt; s += tag(m.px[0] + 10, m.px[1], m.label); }
  if (S.placing && S.placing.ghost) { const g = S.placing.ghost; s += `<polygon class="ghostplace${g.bad ? ' bad' : ''}" points="${g.px.map((p) => p.join(',')).join(' ')}"/>`; if (g.label) s += tag(g.px[0][0], g.px[0][1] - 14, g.label, g.bad); }
  if (D && D.guide) s += D.guide;
  if (D && D.tag) s += tag(D.tag.x, D.tag.y, D.tag.text, D.tag.refuse);
  if (S.lens === 'experience' && !S.lookThrough && !followPose() && RENDERED.mode !== 'unroll') s += expOverlay();
  o.innerHTML = s;
}
// the selected identity's contour shows through whatever occludes it (thin, dashed, gold)
function selectionEcho(id) {
  return SC.prims(renderModel(), { lift: S.lift }).filter((p) => p.id === id && p.role !== 'floor').map((p) => { const q = p.pts.map(wpx); if (q.some((v) => !v)) return ''; return `<polygon points="${q.map((v) => v.join(',')).join(' ')}" fill="none" stroke="#d4ad45" stroke-width="1.2" stroke-dasharray="3 3" opacity=".9"/>`; }).join('');
}
function tag(x, y, text, refuse = false) {
  const w = String(text).length * 6.8 + 14;
  return `<g transform="translate(${x},${y})"><rect class="tagbox${refuse ? ' ref' : ''}" x="0" y="-15" width="${w}" height="20" rx="5"/><text class="tagtxt${refuse ? ' ref' : ''}" x="7" y="-1">${esc(text)}</text></g>`;
}
function knob(x, y, h, glyph, title) {
  return `<g class="hit" data-h="${h}"><title>${esc(title)}</title><circle class="h-knob" cx="${x}" cy="${y}" r="11"/>${glyph ? `<g transform="translate(${x - 7},${y - 7}) scale(.58)"><g class="h-glyph">${glyph}</g></g>` : ''}</g>`;
}
const G = {
  up: '<path d="M12 20V5M6 11l6-6 6 6"/>', rot: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>', move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  size: '<path d="M5 19L19 5M13 5h6v6M11 19H5v-6"/>', slide: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
};
function handlesSvg(e) {
  let s = '';
  if (e.kind === 'object' || e.kind === 'import') {
    const top = wpx([e.x, e.y, (e.z || 0) + e.h + 0.35]); const base = wpx([e.x, e.y, 0]);
    if (!top || !base) return '';
    const r = Math.max(e.w, e.d) / 2 + 0.45, ang = ((e.rot || 0) * Math.PI) / 180;
    const rp = wpx([e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r, 0.02]);
    // a floor ring shows the footprint the object can turn within (Tiny Glade-like, no axis gizmo)
    let ring = ''; for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; const p = wpx([e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 0.02]); if (p) ring += `${p[0]},${p[1]} `; }
    s += `<polyline class="h-ring" points="${ring}"/>`;
    s += knob(base[0], base[1], 'move', G.move, 'Drag to slide on its surface');
    if (rp) s += knob(rp[0], rp[1], 'rotate', G.rot, 'Drag to turn (15° detents, ⌥ free)');
    if (e.scalable) s += knob(top[0], top[1], 'size', G.size, 'Drag up/down to size (keeps proportions)');
  } else if (e.kind === 'wall') {
    const a = wpx([...e.a, e.base]), b = wpx([...e.b, e.base]);
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const t = RENDERED.mode === 'plan' ? null : wpx([...mid, e.top]);
    if (a) s += `<g class="hit" data-h="end-a"><title>Drag the end</title><circle class="h-dot" cx="${a[0]}" cy="${a[1]}" r="7"/></g>`;
    if (b) s += `<g class="hit" data-h="end-b"><title>Drag the end</title><circle class="h-dot" cx="${b[0]}" cy="${b[1]}" r="7"/></g>`;
    if (t) s += knob(t[0], t[1] - 2, 'top', G.up, 'Drag the top; snaps to named heights');
    const L = SC.wallLen(e), n = [-(e.b[1] - e.a[1]) / L, (e.b[0] - e.a[0]) / L];
    const off = RENDERED.mode === 'plan' ? 0.9 : 0.6; const m2 = wpx([mid[0] + n[0] * off, mid[1] + n[1] * off, RENDERED.mode === 'plan' ? 0 : e.top * 0.45]);
    if (m2) s += knob(m2[0], m2[1], 'push', G.slide, 'Drag to move the wall parallel');
  } else if (e.kind === 'roof' && RENDERED.mode !== 'plan') {
    const cx = (e.x0 + e.x1) / 2, cy = (e.y0 + e.y1) / 2;
    const p = e.poly ? wpx([...SC.centroid2(e.poly), e.ridge + (S.lift ? 2.6 : 0)]) : wpx([cx, cy, e.ridge + (S.lift ? 2.6 : 0)]);
    if (p) s += knob(p[0], p[1] - 14, 'ridge', G.up, e.kind === 'roof' && e.ridge > e.eave ? 'Drag the ridge: taller or flatter' : 'Drag the roof height');
  } else if ((e.kind === 'opening' || e.kind === 'artwork') && RENDERED.mode !== 'plan') {
    const w = SC.wallById(M, e.host); if (!w) return '';
    const p = SC.wallPoint(w, e.at); const z = e.kind === 'artwork' ? e.c : e.sill + e.h / 2;
    const q = wpx([...p, z]); if (q) s += knob(q[0], q[1], 'slide', G.slide, 'Slide along its wall');
  }
  return s;
}
function spacingRibbons(a) {
  // P2-style: spacing between neighbours on the same wall, shown while an artwork is selected
  const w = SC.wallById(M, a.host); if (!w || RENDERED.mode === 'plan') return '';
  const list = M.artworks.filter((x) => x.host === a.host).sort((p, q) => p.at - q.at);
  let s = '';
  for (let i = 0; i < list.length - 1; i++) {
    const p = list[i], q = list[i + 1]; const gap = q.at - q.w / 2 - (p.at + p.w / 2);
    const A = wpx([...SC.wallPoint(w, p.at + p.w / 2), 0.9]), B = wpx([...SC.wallPoint(w, q.at - q.w / 2), 0.9]);
    if (A && B) s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#d4ad45" stroke-width="2" stroke-dasharray="3 3"/>` + tag((A[0] + B[0]) / 2 - 20, (A[1] + B[1]) / 2 + 22, `${f2(gap)} m`);
  }
  return s;
}

// Experience markers: Views as leaf camera glyphs (gold when selected); Guide routes when open
function expOverlay() {
  let s = ''; const g = guide();
  const selPres = pres(S.sel) || M.presentations.find((p) => p.views.includes(S.sel));
  if (S.guideOpen) {
    g.edges.forEach((ed, i) => {
      const A = view(g.stops[i].views.at(-1)), B = view(g.stops[i + 1].views[0]);
      const pts = [A.pos, ...(ed.pts || []).map((p) => [p[0], p[1], 1.6]), B.pos].map(wpx).filter(Boolean);
      const cls = `route${ed.mode === 'cut' ? ' cut' : ''}${S.sel === 'edge-' + i ? ' sel' : ''}`;
      s += `<polyline class="${cls}" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
      if (S.sel === 'edge-' + i) (ed.pts || []).forEach((p, j) => { const q = wpx([p[0], p[1], 1.6]); if (q) s += `<circle class="pathpt" cx="${q[0]}" cy="${q[1]}" r="6" data-h="pp-${i}-${j}"/>`; });
    });
    const pose = evalGuide(S.t).pose; const q = wpx(pose.pos); if (q) s += `<circle class="puck" cx="${q[0]}" cy="${q[1]}" r="7"/>`;
  }
  for (const v of M.views) {
    const p = wpx(v.pos), t = wpx(v.target); if (!p || !t) continue;
    const ang = Math.atan2(t[1] - p[1], t[0] - p[0]); const L = 34, sp = 0.42;
    const a1 = [p[0] + Math.cos(ang - sp) * L, p[1] + Math.sin(ang - sp) * L], a2 = [p[0] + Math.cos(ang + sp) * L, p[1] + Math.sin(ang + sp) * L];
    const sel = S.sel === v.id || (selPres && selPres.def === v.id && S.sel === selPres.id);
    const show = sel || !selPres || selPres.views.includes(v.id) || S.guideOpen;
    if (!show) continue;
    s += `<g class="vm${sel ? ' sel' : ''}" data-v="${v.id}"><polygon class="fr" points="${p.join(',')} ${a1.join(',')} ${a2.join(',')}"/><circle class="body" cx="${p[0]}" cy="${p[1]}" r="${sel ? 8 : 6}"/><text x="${p[0] + 10}" y="${p[1] - 8}">${esc(v.name)}${M.presentations.some((pp) => pp.def === v.id) ? ' ◆' : ''}</text></g>`;
  }
  if (D && D.kind === 'newview' && D.cur) { const a = toPx(D.aPx), b = toPx(D.cur); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#d4ad45" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${a[0]}" cy="${a[1]}" r="7" class="puck"/>`; }
  return s;
}

// ---------------- stage furniture: View control, drafting words, pill, scale, zoom ----------------
const READINGS = [['3d', 'view3d', '3D', '1'], ['plan', 'plan', 'Plan', '2'], ['elev', 'elevation', 'Elevation', '3'], ['eye', 'person', 'Eye level', '4'], ['section', 'section', 'Section', '5']];
function readingName() {
  if (S.lookThrough) return 'Looking through';
  if (followPose()) return 'Following';
  if (S.look) return { unroll: 'Unroll', face: 'Face', lift: 'Lift' }[S.look.kind] || 'Look';
  const r = READINGS.find((x) => x[0] === S.reading); return r[2] + (S.reading === 'elev' ? ' ' + S.elevFace : '');
}
function renderFurniture() {
  const f = $('#furn'); const paper = readingIsPaper();
  const icn = S.look ? 'unroll' : READINGS.find((x) => x[0] === S.reading)[1];
  let h = `<div class="sf sf-tl"><button class="glass dk viewbtn" data-act="viewpop" aria-expanded="${S.viewPop}" title="Readings, appearance and projection">${icon(icn, 17)}<span>${readingName()}</span>${icon('chevronDown', 14)}</button>`;
  if (!S.lookThrough && !followPose()) h += `<span class="glass dk drafting">${paper ? `<button class="opt" data-act="scale" title="Scale detents and Fit all">1:100</button><span class="dot opt">·</span>` : ''}<button class="${S.grid ? '' : 'off'}" data-act="grid" title="Grid ${S.grid ? 'on' : 'off'}">Grid${S.grid ? '<span class="opt"> 1 m</span>' : ' off'}</button><span class="dot">·</span><button class="${S.snap ? '' : 'off'}" data-act="snap" title="Snap ${S.snap ? 'on' : 'off'}">Snap${S.snap ? '<span class="opt"> 0.5 m</span>' : ' off'}</button>${S.lens === 'world' ? `<span class="dot">·</span><button data-act="sheetpop" title="Sheet: the height the next point lands on (proposed 4th drafting word)">Sheet ${f2(S.sheet.h)}<span class="opt">${nearestDatum(S.sheet.h) ? ' ' + esc(nearestDatum(S.sheet.h).name) : ''}</span></button>` : ''}</span>`;
  if (S.lens === 'experience' && !S.lookThrough) h += `<button class="glass dk viewbtn" data-act="noop" title="Show: what Camera context is drawn (editor-only)">${icon('eye', 16)}<span>Show</span>${icon('chevronDown', 14)}</button>`;
  h += '</div>';
  if (S.viewPop) h += viewPopover();
  if (S.sheetPop) h += `<div class="pop" style="top:52px;left:220px;width:240px"><h6>Sheet — where the next point lands</h6>${[...M.datums].reverse().map((d) => `<button class="row" data-act="todatum" data-id="${d.id}" aria-pressed="${Math.abs(d.z - S.sheet.h) < 0.01}">${icon('sheet', 15)}${esc(d.name)}<span class="k mono">${d.z.toFixed(2)}</span></button>`).join('')}<hr><button class="row" data-act="focus" aria-pressed="${S.focus}">${icon('focusHeight', 15)}Focus height</button><button class="row" data-act="railopen">${icon('height', 15)}Show the heights rail</button></div>`;
  h += pillHtml();
  const scalePx = V.k * 5;
  h += `<div class="sf sf-bl">${CAM && CAM.kind !== 'persp' && CAM.kind !== 'axo' ? `<span class="scalebar" style="--w:${scalePx}px"><i></i>5 m</span>` : ''}<span>${CAM && CAM.kind === 'axo' ? `${icon('north', 14)} turned ${Math.round(S.az)}°` : ''} ${S.lens === 'world' && !S.lookThrough ? `· datum Ground 0.00` : ''}</span></div>`;
  h += `<div class="sf sf-br"><button class="glass dk" data-act="zoom" data-v="1.25" title="Zoom in">${icon('plus', 16)}</button><button class="glass dk" data-act="zoom" data-v="0.8" title="Zoom out">${icon('minus', 16)}</button><button class="glass dk" data-act="fit" title="Fit all (a Camera framing request)">${icon('fit', 16)}</button></div>`;
  f.innerHTML = h;
}
function viewPopover() {
  const r = S.reading;
  let h = `<div class="pop" style="top:52px;left:12px;width:280px"><h6>Reading</h6>`;
  for (const [k, ic, label, key] of READINGS) {
    const dis = k === 'section' && !S.slice;
    if (k === 'elev') h += `<div class="row" aria-pressed="${r === k && !S.look}"><button data-act="reading" data-v="elev" style="display:flex;gap:8px;align-items:center">${icon(ic, 16)}${label}</button><span class="sub">${['S', 'E', 'N', 'W'].map((fc) => `<button data-act="elevface" data-v="${fc}" aria-pressed="${r === 'elev' && S.elevFace === fc}">${fc}</button>`).join('')}</span></div>`;
    else h += `<button class="row" data-act="reading" data-v="${k}" aria-pressed="${r === k && !S.look}" ${dis ? 'disabled title="Draw a Slice first (K)"' : ''}>${icon(ic, 16)}${label}<span class="k kbd">${key}</span></button>`;
    if (k === 'section' && dis) h += `<div class="hint">Sections come from the Slice tool; Face, Unroll and Lift come from a selected subject's Look.</div>`;
  }
  h += `<hr><h6>Appearance</h6><div class="seg2">${[['auto', 'Auto'], ['paper', 'Paper'], ['shaded', 'Shaded']].map(([k, l]) => `<button data-act="appearance" data-v="${k}" aria-pressed="${S.appearance === k}">${l}</button>`).join('')}</div>`;
  h += `<div class="hint">${S.appearance === 'auto' ? 'Auto: Plan, elevations and sections settle onto vellum; 3D and eye level sit on the mat.' : S.appearance === 'paper' ? 'Paper everywhere: line drawing on vellum, even in 3D.' : 'Shaded: Plan and elevations keep shading; useful when judging finishes.'}</div>`;
  h += `<h6>Overhead</h6><div class="seg2">${[['xray', 'X-ray'], ['solid', 'Solid']].map(([k, l]) => `<button data-act="overhead" data-v="${k}" aria-pressed="${S.overhead === k}">${l}</button>`).join('')}</div>`;
  h += `<h6>Projection (3D)</h6><div class="seg2">${[['axo', 'Axonometric'], ['persp', 'Perspective']].map(([k, l]) => `<button data-act="projection" data-v="${k}" aria-pressed="${S.projection === k}">${l}</button>`).join('')}</div>`;
  h += `<h6>Turn</h6><div class="seg2"><button data-act="turn" data-v="-90">⟲ 90°</button><button data-act="turn" data-v="-15">−15°</button><button data-act="turn" data-v="15">+15°</button><button data-act="turn" data-v="90">⟳ 90°</button></div></div>`;
  return h;
}
function pillHtml() {
  if (S.lookThrough) { const v = view(S.lookThrough.id); return `<div class="pill gold">${icon('camera', 15)} Looking through <b>${esc(v.name)}</b> · drag to re-aim <button class="pri" data-act="lt-update">Update View</button><button data-act="lt-exit">Exit <span class="kbd">Esc</span></button></div>`; }
  if (followPose()) return `<div class="pill gold">${icon('camera', 15)} Following the Guide camera <button data-act="follow">Stop following</button></div>`;
  if (S.slice) return `<div class="pill slice">${icon('slice', 15)} ${S.slice.horizontal ? `Slice at ${f2(S.slice.h)}` : 'Slice A'} · temporary — building unchanged ${!S.slice.horizontal ? `<button data-act="slice-flip">Flip</button><button data-act="reading" data-v="section">Face the cut</button>` : ''}<button data-act="slice-clear">Put back <span class="kbd">Esc</span></button></div>`;
  if (S.lift) return `<div class="pill">${icon('lift', 15)} Lift · roofs raised 2.6 m (view only) <button data-act="lift">Put back <span class="kbd">Esc</span></button></div>`;
  if (S.focus) { const [lo, hi] = focusBand(); return `<div class="pill">${icon('focusHeight', 15)} Focus height ${f2(lo + 0.05)}–${f2(hi - 0.05)} · others ghosted <button data-act="focus">Put back</button></div>`; }
  if (S.placing) return `<div class="pill">${icon('assets', 15)} Placing <b>${esc(S.placing.name)}</b> · click to place, stays armed <button data-act="tool" data-v="select">Done <span class="kbd">Esc</span></button></div>`;
  if (S.paint) return `<div class="pill">${icon('paint', 15)} Paint <b>${esc(S.paint.name)}</b> · click a wall or floor <button data-act="tool" data-v="select">Done <span class="kbd">Esc</span></button></div>`;
  return '';
}

// ---------------- Height rail (P3 sheet) ----------------
const RAIL_MAX = 7.5;
function renderRail() {
  const el = $('#rail');
  const show = S.lens === 'world' && !S.lookThrough && S.narrow !== 'phone' && S.railOpen && !S.look && S.reading !== 'plan';
  if (!show) {
    el.innerHTML = '';
    return;
  }
  const right = S.cmp.rail === 'right' || S.cmp.dock === 'left';
  const y = (z) => `${(1 - z / RAIL_MAX) * 100}%`;
  const nd = nearestDatum(S.sheet.h, 0.01);
  let h = `<div class="hrail glass ${right ? 'right' : ''}"><div class="tt">${icon('height', 15)} Heights<span class="sp"></span><button class="iconbtn" data-act="railclose" title="Hide heights" style="width:22px;height:22px">${icon('close', 13)}</button></div><div class="scale" id="railscale"><div class="axis"></div>`;
  if (S.focus) { const [lo, hi] = focusBand(); h += `<div class="band" style="top:${y(Math.min(hi, RAIL_MAX))};bottom:${(lo / RAIL_MAX) * 100}%"></div>`; }
  for (const d of M.datums) h += `<div class="datum${Math.abs(d.z - S.sheet.h) < 0.01 ? ' near' : ''}${d.id === 'mezz' ? ' prop' : ''}" style="top:${y(d.z)}" data-act="todatum" data-id="${d.id}" title="Move the sheet to ${esc(d.name)}"><i></i><span class="n">${esc(d.name)}</span><span class="v">${d.z.toFixed(2)}</span></div>`;
  h += `<div class="handle${S.sheet.raised ? ' raised' : ''}" id="sheethandle" style="top:${y(S.sheet.h)}" title="Drag the sheet: it is the drawing plane and x-rays what is above">${icon('sheet', 13)}${f2(S.sheet.h)}</div></div>`;
  h += `<div class="acts"><button class="tbtn" data-act="focus" aria-pressed="${S.focus}" title="Ghost everything outside this height band">${icon('focusHeight', 14)} Focus height</button>${S.sheet.raised ? `<button class="tbtn" data-act="sheetaway">Put sheet away</button>` : ''}${!nd && S.sheet.h > 0 ? `<button class="tbtn" data-act="namedatum">+ Name ${f2(S.sheet.h)}</button>` : ''}</div></div>`;
  el.innerHTML = h;
}

// ---------------- Card ----------------
function renderCard() {
  const el = $('#card');
  const e = selEntity();
  const narrow = S.narrow !== 'wide';
  if (!e || S.preview || (narrow && !S.cardSheet) || (S.lookThrough && S.narrow === 'phone')) { el.innerHTML = ''; return; }
  const shift = (S.cmp.rail === 'right' || S.cmp.dock === 'left') && S.lens === 'world' && S.railOpen && !S.look && S.reading !== 'plan' && S.narrow === 'wide';
  el.innerHTML = `<section class="card${shift ? ' shift' : ''}" aria-label="Selected: ${esc(e.name)}">${S.lens === 'world' ? (ent(e.id) ? worldCard(e) : foreignCard(e)) : ent(e.id) ? subjectCard(e) : expCard(e)}</section>`;
}
function subjectCard(e) {
  // a World subject seen from Experience: identity, usage first, deliberate Present this
  const ui = usedIn(e.id);
  let h = cardHead(`${kindLabel[e.kind]} · World subject`, e.name);
  h += `<div class="sec"><h4>Used in Experience</h4>${ui.map((p) => `<div class="rel"><span>Presentation</span><button data-act="sel" data-id="${p.id}">${esc(p.name)}</button></div>`).join('') || '<div class="rel"><span>Not presented yet</span></div>'}</div>`;
  h += `<div class="verbs" style="border:0"><button class="tbtn pri" data-act="presentthis">${icon('layers', 14)} Present this</button><button class="tbtn" data-act="lens" data-v="world">Edit in World</button></div>`;
  return h;
}
function foreignCard(e) {
  // an Experience identity carried into World: kept selected, inert for World editing
  let h = cardHead(`${kindLabel[e.kind] || 'Experience'} · Experience identity`, e.name);
  h += `<div class="sec"><div class="rel"><span>World doesn't edit ${esc(kindLabel[e.kind] || 'this').toLowerCase()}s.</span></div>${e.kind === 'presentation' && e.subject ? `<div class="rel"><span>About</span><button data-act="sel" data-id="${e.subject}">${esc(ent(e.subject)?.name || 'missing')}</button></div>` : ''}</div><div class="verbs" style="border:0"><button class="tbtn" data-act="lens" data-v="experience">Open in Experience ↗</button></div>`;
  return h;
}
function cardHead(kicker, name) {
  return `<div class="ch"><span class="kick">${kicker}</span><button class="iconbtn" data-act="ctxcard" title="More actions for this subject">${icon('more', 16)}</button><button class="iconbtn" data-act="${S.narrow !== 'wide' ? 'cardsheet' : 'deselect'}" title="${S.narrow !== 'wide' ? 'Close' : 'Deselect'}">${icon('close', 16)}</button></div><h2 data-act="rename" title="Rename">${esc(name)}</h2>`;
}
function looksFor(e) {
  const L = [];
  if (e.kind === 'wall') L.push(['face', 'face', 'Face this wall', 'wall laid flat'], ['unroll', 'unroll', 'Unroll the room', roomOf(e) ? roomOf(e).name : ''], ['section', 'section', 'Section through here', '']);
  if (e.kind === 'room') L.push(['unroll', 'unroll', 'Unroll its walls', ''], ['focus', 'focusHeight', 'Focus this height', ''], ['section', 'section', 'Section through here', '']);
  if (e.kind === 'roof') L.push(['editshape', 'roof', 'Edit shape', 'Enter'], ['lift', 'lift', 'Lift it apart', 'hold L'], ['section', 'section', 'Section through here', '']);
  if (e.kind === 'opening') L.push(['facehost', 'face', 'Face its wall', ''], ['section', 'section', 'Section through here', '']);
  if (e.kind === 'artwork') L.push(['facehost', 'face', 'Face its wall', '']);
  if (e.kind === 'object') L.push(['section', 'section', 'Section through here', ''], ['eye', 'person', 'Look from here', 'eye level']);
  return L;
}
function worldCard(e) {
  let kick = '', facts = [], cond = '';
  if (e.kind === 'wall') { kick = `Wall · ${wallRole(e)}`; facts = [`${SC.wallLen(e).toFixed(2)} m long`, `${f2(e.top)} m${nearestDatum(e.top) ? ' · ' + nearestDatum(e.top).name : ''}`, `base ${nearestDatum(e.base)?.name || f2(e.base)}`]; }
  if (e.kind === 'opening') { kick = `Opening · in <a data-act="sel" data-id="${e.host}">${esc(SC.wallById(M, e.host)?.name || '?')}</a>`; facts = [`${f2(e.w)} × ${f2(e.h)} m`, e.arch ? 'round arch' : e.sill > 0 ? `sill ${f2(e.sill)}` : 'door', `at ${f2(e.at)} m`]; }
  if (e.kind === 'roof') { const span = (e.poly ? 4 : e.y1 - e.y0) / 2; const pitch = e.ridge > e.eave ? Math.round((Math.atan((e.ridge - e.eave) / span) * 180) / Math.PI) : 0; kick = `Roof · ${e.kind === 'roof' && e.ridge > e.eave ? 'gable' : 'flat'}${roomOf(e) ? ' over ' + esc(roomOf(e).name) : ''}`; facts = [`eave ${f2(e.eave)}`, `ridge ${f2(e.ridge)}`, `${pitch}° pitch`]; const lo = M.loose.find((l) => l.id === e.id); if (lo) cond = lo.msg; }
  if (e.kind === 'object') { kick = `Object · located in ${esc(roomOf(e)?.name || 'no room')}`; facts = [`${f2(e.w)} × ${f2(e.d)} × ${f2(e.h)} m`, `turned ${Math.round(e.rot || 0)}°`, `on ${roomOf(e) ? 'floor' : 'ground'}`]; }
  if (e.kind === 'artwork') { kick = `Artwork · on <a data-act="sel" data-id="${e.host}">${esc(SC.wallById(M, e.host)?.name || '?')}</a>`; facts = [`${f2(e.w)} × ${f2(e.h)} m`, `centre ${f2(e.c)} m`, `at ${f2(e.at)} m`]; }
  if (e.kind === 'room') { kick = `Room · derived from ${e.walls.length || 'no'} walls`; facts = [`${SC.polyArea(e.poly).toFixed(1)} m²`, e.z ? `floor ${f2(e.z)}` : 'floor Ground']; }
  if (e.kind === 'import') { kick = 'Imported model · fixed geometry'; facts = [`${f2(e.w)} × ${f2(e.d)} × ${f2(e.h)} m`, `${e.tris || '18k'} triangles`]; }
  const fin = M.finishes[e.id]; if (fin) facts.push(`finish ${fin.name}`);
  let h = cardHead(kick, e.name);
  h += `<div class="facts">${facts.map((t) => `<button class="fact" data-act="dims" title="Open Dimensions on this field">${esc(t)}</button>`).join('')}</div>`;
  if (cond) h += `<div class="cond">${icon('warning', 15)}<span>${esc(cond)}</span><button data-act="repair">Repair…</button></div>`;
  const looks = looksFor(e);
  h += `<div class="verbs">${looks.length ? `<button class="tbtn" data-act="cardlook" aria-pressed="${S.cardLook}">${icon('eye', 14)} Look ${icon('chevronDown', 12)}</button>` : ''}<button class="tbtn" data-act="carddetails" aria-pressed="${S.cardDetails}">Details</button></div>`;
  if (S.cardLook) h += `<div class="lookmenu" style="margin-top:8px">${looks.map(([k, ic, l, m]) => `<button data-act="look" data-v="${k}">${icon(ic, 15)}${l}<small>${esc(m)}</small></button>`).join('')}</div>`;
  if (S.cardDetails) h += detailsHtml(e);
  return h;
}
function detailsHtml(e) {
  const rel = [];
  if (e.kind === 'wall') {
    M.rooms.filter((r) => r.walls.includes(e.id) && SC.roomEnclosed(M, r)).forEach((r) => rel.push(['Bounds', r.name, r.id]));
    M.openings.filter((o) => o.host === e.id).forEach((o) => rel.push(['Hosts', o.name, o.id]));
    M.artworks.filter((a) => a.host === e.id).forEach((a) => rel.push(['Carries', a.name, a.id]));
    M.roofs.filter((r) => (r.over || []).includes(e.id)).forEach((r) => rel.push(['Supports', r.name, r.id]));
  }
  if (e.kind === 'roof') (e.over || []).forEach((w) => { const ww = SC.wallById(M, w); rel.push(['Rests on', ww ? ww.name : `${w} (missing)`, ww ? w : null]); });
  if (e.kind === 'room') e.walls.forEach((w) => rel.push(['Bounded by', SC.wallById(M, w).name, w]));
  let h = `<div class="sec"><h4>Relations</h4>${rel.map(([k, n, id]) => `<div class="rel"><span>${k}</span>${id ? `<button data-act="sel" data-id="${id}">${esc(n)}</button>` : `<span style="color:var(--refuse)">${esc(n)}</span>`}</div>`).join('') || '<div class="rel"><span>None</span></div>'}</div>`;
  const ui = usedIn(e.id);
  h += `<div class="sec"><h4>Used in Experience</h4>${ui.map((p) => `<div class="rel"><span>Presentation</span><button data-act="openexp" data-id="${p.id}">${esc(p.name)} ↗</button></div>`).join('') || '<div class="rel"><span>Not presented yet</span><button data-act="presentthis">Present this ↗</button></div>'}</div>`;
  h += `<div class="sec"><h4>Source <span class="quiet" style="font-weight:400">Technical</span></h4><div class="rel"><span>Owner</span><span>${e.kind === 'object' || e.kind === 'artwork' || e.kind === 'import' ? 'Scene' : 'Layout'}</span></div><div class="rel"><span>Identity</span><span class="mono">${e.id}</span></div></div>`;
  return h;
}
function expCard(e) {
  let h = '';
  const g = guide();
  if (e.kind === 'presentation') {
    h += cardHead(`Presentation${e.subject ? ` · about <a data-act="sel" data-id="${e.subject}">${esc(ent(e.subject)?.name || 'missing subject')}</a>` : ' · a standpoint'}`, e.name);
    h += `<div class="sec"><div class="thumbs">${e.views.map((vid) => `<div class="thumb${S.sel === vid ? ' sel' : ''}" data-act="sel" data-id="${vid}" title="Select; double-click to look through">${thumbSvg(vid, 140, 88)}<span class="lbl"><span>${esc(view(vid).name)}</span>${e.def === vid ? '<span class="def">◆</span>' : ''}</span></div>`).join('')}<button class="thumb add" data-act="capture">${icon('capture', 18)}Capture a View</button></div></div>`;
    h += `<div class="verbs" style="border:0;padding-top:0"><button class="tbtn pri" data-act="lookthrough" data-id="${e.def}">${icon('camera', 14)} Look through ◆ ${esc(view(e.def)?.name || '')}</button></div>`;
    const stops = g.stops.map((s, i) => [s, i]).filter(([s]) => s.pres === e.id);
    h += `<div class="sec"><h4>Used by</h4>${stops.map(([s, i]) => `<div class="rel"><span>${esc(g.name)}</span><button data-act="sel" data-id="${s.id}">Stop ${i + 1}</button></div>`).join('') || '<div class="rel"><span>No Guide uses it — it stands alone</span></div>'}</div>`;
  } else if (e.kind === 'view') {
    const p = M.presentations.find((p) => p.views.includes(e.id));
    h += cardHead(`View · in <a data-act="sel" data-id="${p.id}">${esc(p.name)}</a>`, e.name);
    h += `<div class="sec"><div class="bigthumb">${thumbSvg(e.id, 280, 175)}</div><div class="facts" style="padding:8px 0 0"><span class="fact">${e.lens} mm</span><span class="fact">eye ${f2(e.pos[2])} m</span><span class="fact">${p.def === e.id ? '◆ Default' : 'not default'}</span></div></div>`;
    h += `<div class="verbs"><button class="tbtn pri" data-act="lookthrough" data-id="${e.id}">${icon('camera', 14)} Look through</button>${p.def !== e.id ? `<button class="tbtn" data-act="makedef" data-id="${e.id}">◆ Make default</button>` : ''}</div>`;
    const uses = g.stops.map((s, i) => [s, i]).filter(([s]) => s.views.includes(e.id));
    h += `<div class="sec"><h4>Used by</h4>${uses.map(([s, i]) => `<div class="rel"><span>${esc(g.name)}</span><button data-act="sel" data-id="${s.id}">Stop ${i + 1}</button></div>`).join('') || '<div class="rel"><span>No Stop</span></div>'}<div class="rel"><span>Owner</span><span>Camera composition</span></div></div>`;
  } else if (e.kind === 'stop') {
    const p = pres(e.pres);
    h += cardHead(`Stop ${e.idx + 1} of ${g.stops.length} · visits <a data-act="sel" data-id="${p.id}">${esc(p.name)}</a>`, p.name);
    h += `<div class="sec"><h4>Included Views <span class="quiet" style="font-weight:400">this visit only</span></h4>${p.views.map((vid) => { const inc = e.views.includes(vid); return `<div class="rel" style="align-items:center"><span>${inc ? '✓' : '—'} ${esc(view(vid).name)}${p.def === vid ? ' ◆' : ''}</span>${inc ? `<span class="stepper"><button data-act="hold" data-v="-1">−</button><span>${e.hold}s</span><button data-act="hold" data-v="1">+</button></span>` : `<button data-act="include" data-id="${vid}">Include</button>`}</div>`; }).join('')}</div>`;
    const ed = g.edges[e.idx];
    h += `<div class="sec"><h4>Continues</h4><div class="rel"><span>${ed ? (ed.mode === 'cut' ? 'Cut' : `Travel ${ed.dur}s`) : 'End of Guide'}</span>${ed ? `<button data-act="sel" data-id="edge-${e.idx}">→ Stop ${e.idx + 2}</button>` : ''}</div></div>`;
    h += `<div class="verbs" style="border:0"><button class="tbtn" data-act="stopnav" data-v="-1" ${e.idx ? '' : 'disabled'}>‹ Stop ${e.idx}</button><button class="tbtn" data-act="stopnav" data-v="1" ${e.idx < g.stops.length - 1 ? '' : 'disabled'}>Stop ${e.idx + 2} ›</button></div>`;
  } else if (e.kind === 'edge') {
    h += cardHead(`Transition · ${esc(g.name)}`, e.name);
    h += `<div class="sec"><div class="seg2" style="display:flex;gap:4px">${['cut', 'travel'].map((m) => `<button class="tbtn" data-act="edgemode" data-v="${m}" aria-pressed="${e.mode === m}">${icon(m === 'cut' ? 'cut' : 'travel', 14)} ${m === 'cut' ? 'Cut' : 'Travel'}</button>`).join('')}</div>${e.mode === 'travel' ? `<div class="rel" style="margin-top:8px"><span>Duration</span><span class="stepper"><button data-act="edgedur" data-v="-1">−</button><span>${e.dur}s</span><button data-act="edgedur" data-v="1">+</button></span></div><div class="rel"><span>Path points</span><span>${(e.pts || []).length} authored · Path tool adds</span></div>` : '<div class="rel"><span>No Camera travel; existing path support is kept.</span></div>'}</div>`;
  }
  return h;
}

// thumbnails rendered from the same mock scene and View pose
const thumbCache = new Map();
function thumbSvg(vid, w, hgt) {
  const v = view(vid); if (!v) return '';
  const key = `${vid}|${H.i}|${v.pos}|${v.target}`;
  if (!thumbCache.has(key)) {
    const cam = SC.camera('persp', { pos: v.pos, target: v.target, F: focal(v.lens) });
    const r = SC.renderSolid(M, cam, { pal: SC.PAL.mat, finishes: M.finishes });
    thumbCache.set(key, r.svg);
  }
  return `<svg viewBox="-16 -10 32 20" preserveAspectRatio="xMidYMid slice" width="${w}" height="${hgt}"><rect x="-20" y="-14" width="40" height="28" fill="#1D3A33"/>${thumbCache.get(key)}</svg>`;
}

// ---------------- lower working edge ----------------
const WORLD_TOOLS = [
  ['select', 'select', 'Select', 'V', null], ['ink', 'ink', 'Ink', 'P', 'var(--t-ink)'], ['slice', 'slice', 'Slice', 'K', 'var(--t-slice)'],
  ['eraser', 'eraser', 'Eraser', 'E', 'var(--t-erase)'], ['measure', 'measure', 'Measure', 'M', null],
];
const EXP_TOOLS = [['select', 'select', 'Select', 'V'], ['view', 'camera', 'View', 'C'], ['path', 'path', 'Path', 'T'], ['measure', 'measure', 'Measure', 'M']];
function renderLower() {
  const low = $('#lower'), side = $('#side');
  if (S.preview) { low.innerHTML = ''; side.innerHTML = ''; return; }
  const dockH = dockHtml(), palH = paletteHtml(), instH = instrumentHtml();
  const sideMode = S.cmp.dock === 'left';
  if (sideMode) {
    low.innerHTML = `<div class="lower">${instH}</div>`;
    side.innerHTML = `<div style="position:absolute;left:12px;top:56px;z-index:9;display:flex;gap:6px;align-items:flex-start">${dockH.replace('class="dock"', 'class="dock" style="flex-direction:column"')}${palH ? palH.replace('class="palette"', 'class="palette" style="flex-direction:column;align-items:stretch;white-space:normal;max-width:220px"') : ''}</div>`;
  } else {
    const offset = !!(selEntity() && S.narrow === 'wide' && !S.instrument?.broad);
    low.innerHTML = `<div class="lower${offset ? ' offset' : ''}">${dockH}${palH}${instH}</div>`;
    side.innerHTML = S.editShape && S.cmp.edit === 'split' && ent(S.editShape.id) ? `<div class="splitpane"><div class="sh">${icon('section', 15)} Section · ${esc(ent(S.editShape.id).name)}<span style="flex:1"></span><span class="muted" style="font-size:11px">B · split Stage</span></div><div class="pad">${sectionPad(ent(S.editShape.id))}</div></div>` : '';
  }
  const lh = $('#lower .lower'); const st = $('#stage');
  requestAnimationFrame(() => st.style.setProperty('--lower', (sideMode ? 0 : (lh?.offsetHeight || 60)) + 'px'));
}
function toolBtn(id, ic, label, key, color, extra = '') {
  return `<button class="tool${extra}" data-act="tool" data-v="${id}" aria-pressed="${S.tool === id}" title="${label} (${key})">${icon(ic, 20)}<span class="lb">${label}</span>${key ? `<span class="kb">${key}</span>` : ''}${S.cmp.toolColor && color ? `<span class="sw" style="--c:${color}"></span>` : ''}</button>`;
}
function dockHtml() {
  if (S.lookThrough) return '';
  let h = '<div class="dock" role="toolbar" aria-label="Tools">';
  if (S.lens === 'world') {
    const phone = S.narrow === 'phone';
    const tools = phone ? WORLD_TOOLS.slice(0, 2) : WORLD_TOOLS;
    h += tools.map((t) => toolBtn(...t)).join('');
    if (phone) { const armedOver = ['slice', 'eraser', 'measure'].includes(S.tool); const t = WORLD_TOOLS.find((x) => x[0] === S.tool); h += armedOver ? toolBtn(...t) : `<button class="tool" data-act="overflow" aria-expanded="${S.overflow}" title="More tools">${icon('chevronUp', 20)}<span class="lb">More</span></button>`; }
    if (S.paint) h += `<button class="tool temp" data-act="tool" data-v="paint" aria-pressed="${S.tool === 'paint'}" title="Paint ${esc(S.paint.name)} — temporary, from the Library">${icon('paint', 20)}<span class="lb">${esc(S.paint.name)}</span><span class="sw" style="--c:${S.paint.color}"></span></button>`;
    h += `<span class="dsep"></span><button class="tool wide${S.instrument?.kind === 'assets' ? ' pri' : ''}" data-act="assets" aria-pressed="${S.instrument?.kind === 'assets'}" title="Library: objects, materials, lights and imports (A)">${icon('assets', 19)}<span class="lb">Library</span></button>`;
    if (!phone) h += `<button class="tool" data-act="find" title="Find tools, actions, readings and settings (⌘K)">${icon('find', 19)}<span class="lb">Find</span><span class="kb">⌘K</span></button>`;
  } else {
    h += EXP_TOOLS.map(([id, ic, l, k]) => toolBtn(id, ic, l, k, null, id === 'path' && !S.guideOpen ? '" disabled title="Open a Guide to edit its paths' : '')).join('');
    h += `<span class="dsep"></span><button class="tool wide pri" data-act="capture" title="Capture a View from what you see">${icon('capture', 19)}<span class="lb">Capture</span></button>`;
    h += `<button class="tool wide${S.guideOpen ? ' pri' : ''}" data-act="guide" title="Open the Guide">${icon('guide', 19)}<span class="lb">Guide</span></button>`;
  }
  return h + '</div>';
}
function paletteHtml() {
  if (S.lookThrough) return '';
  if (S.narrow === 'phone' && S.overflow && S.lens === 'world') return `<div class="palette">${WORLD_TOOLS.slice(2).map((t) => toolBtn(...t)).join('')}</div>`;
  const t = S.tool;
  const grp = (key, items) => `<span class="grp">${items.map(([v, l, ic]) => `<button data-act="opt" data-k="${key}" data-v="${v}" aria-pressed="${S[key] === v}">${ic ? icon(ic, 14) : ''}${l}</button>`).join('')}</span>`;
  if (t === 'ink') {
    const surf = S.inkSurface || surfaceName();
    const above = M.datums.filter((d) => d.z > S.sheet.h + 0.1);
    return `<div class="palette"><span class="surface ${surf.cls}" title="Working surface: where the next stroke lands">${icon(surf.ic, 14)} ${esc(surf.text)}</span>${grp('inkTip', [['sketch', 'Sketch', 'sketch'], ['line', 'Line', 'line'], ['box', 'Box', 'box'], ['round', 'Round', 'round']])}<span class="vs"></span><span class="lbl">Walls rise to</span><select data-role="inktop">${above.map((d) => `<option value="${d.id}" ${S.inkTop === d.id ? 'selected' : ''}>${esc(d.name)} ${d.z.toFixed(2)}</option>`).join('')}<option value="h24" ${S.inkTop === 'h24' ? 'selected' : ''}>+2.40 m</option></select><span class="hint">Tab: another reading · ⇧ straight</span></div>`;
  }
  if (t === 'slice') return `<div class="palette">${grp('sliceMode', [['vertical', 'Through', 'slice'], ['horizontal', 'At sheet height', 'focusHeight']])}<span class="hint">${S.sliceMode === 'vertical' ? 'Drag a line across the building · Esc puts it back' : `Click the Stage to cut at ${f2(S.sheet.h || 1.2)} m`}</span></div>`;
  if (t === 'eraser') {
    const f = S.eraseFilter;
    const chips = [['wall', 'Walls'], ['opening', 'Openings'], ['object', 'Objects'], ['artwork', 'Art'], ['roof', 'Roofs']].map(([k, l]) => `<button data-act="efilter" data-v="${k}" aria-pressed="${f[k]}">${l}</button>`).join('');
    return `<div class="palette">${grp('eraseMode', [['tap', 'Tap', 'tap'], ['scrub', 'Scrub', 'scrub'], ['lasso', 'Lasso', 'lasso']])}<span class="vs"></span><span class="lbl">Erases</span><span class="grp">${chips}</span>${S.marked.size ? `<span class="count">${S.marked.size} marked</span>` : ''}</div>`;
  }
  if (t === 'measure') return `<div class="palette">${grp('measureMode', [['distance', 'Distance', 'measure'], ['height', 'Height', 'height']])}<span class="hint">Temporary — not an authored dimension</span></div>`;
  if (t === 'view') return `<div class="palette"><span class="hint">Press where the camera stands, drag toward what it sees. Adds to ${esc((pres(S.sel) || M.presentations.find((p) => p.views.includes(S.sel)))?.name || 'a new Presentation')}.</span></div>`;
  if (t === 'path') return `<div class="palette"><span class="hint">${S.sel && S.sel.startsWith('edge-') ? 'Click the Stage to add a path point to the selected transition' : 'Select a transition in the Guide first'}</span></div>`;
  return '';
}
function surfaceName() {
  if (S.look && ['face', 'unroll'].includes(S.look.kind)) return { text: `On ${SC.wallById(M, S.look.walls[0])?.name || 'wall'} face`, cls: 'wall', ic: 'face' };
  if (S.sheet.raised && S.sheet.h > 0.01) return { text: `On sheet ${f2(S.sheet.h)}${nearestDatum(S.sheet.h) ? ' · ' + nearestDatum(S.sheet.h).name : ''}`, cls: 'sheet', ic: 'sheet' };
  return { text: 'On Ground 0.00 · walls → openings', cls: '', ic: 'plan' };
}

// ---------------- instruments ----------------
function instrumentHtml() {
  const I = S.instrument; if (!I) return S.lens === 'experience' && S.guideOpen ? guideHtml() : '';
  const head = (k, nm, tg, extra = '') => `<div class="ih"><span class="k">${k}</span><span class="nm">${nm}</span>${tg ? `<span class="tg">${tg}</span>` : ''}<span class="sp"></span>${extra}<button class="x" data-act="instclose" title="Close (Esc)">${icon('close', 16)}</button></div>`;
  let h = '';
  if (I.kind === 'dims') {
    const e = ent(S.sel); if (!e) return '';
    const fields = dimFields(e);
    h = `<div class="inst">${head('Dimensions', esc(e.name), 'every settled measure, one writer')}<div class="ib"><div class="fields">${fields.map((f) => `<label class="f">${f.label}<input class="num${I.refuse && I.refuse.k === f.k ? ' ref' : ''}" data-dim="${f.k}" value="${I.refuse && I.refuse.k === f.k ? I.refuse.v : f.v}" ${f.ro ? 'readonly title="Derived — change what it is derived from"' : ''}></label>`).join('')}</div>${I.refuse ? `<div class="refuse">${icon('warning', 15)}<span>${esc(I.refuse.msg)}</span>${I.refuse.fix ? `<button data-act="dimfix">${esc(I.refuse.fix.label)}</button>` : ''}</div>` : ''}<div class="muted" style="margin-top:8px">Enter commits one undo step · Esc restores · fields refuse in place, never clamp.</div></div></div>`;
  }
  if (I.kind === 'find') {
    h = `<div class="inst">${head('Find', 'Tools, actions, readings', S.sel ? `For ${esc(selEntity()?.name || '')}` : 'nothing selected')}<div class="ib"><input class="findin" id="findin" placeholder="Type a tool, action, reading or setting…" value="${esc(S.findQ)}"><div class="flist" id="flist">${findList()}</div><div class="muted" style="margin-top:6px">Find never lists subjects or moves the Camera. Subjects → Index search.</div></div></div>`;
  }
  if (I.kind === 'look') {
    const L = S.look; const nm = L.kind === 'unroll' ? `Unroll · ${esc(roomOf(ent(L.walls[0]))?.name || 'walls')}` : L.kind === 'face' ? `Face · ${esc(SC.wallById(M, L.walls[0])?.name)}` : 'Lift';
    h = `<div class="inst">${head('Look', nm, L.kind === 'lift' ? 'view-only displacement' : 'temporary reading · same source')}<div class="ib row"><div style="flex:1"><div class="muted">${L.kind === 'lift' ? 'Roofs are drawn lifted 2.6 m. Nothing moved.' : 'The wall is laid flat on vellum. Ink draws openings on it; Select still selects; heights are exact.'}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${L.kind !== 'lift' ? L.walls.map((w) => `<button class="ibtn" data-act="sel" data-id="${w}" aria-pressed="${S.sel === w}">${esc(SC.wallById(M, w)?.name || w)}</button>`).join('') : ''}</div></div><button class="ibtn light" data-act="putback">Put it back <span class="kbd" style="color:inherit;border-color:currentColor">Esc</span></button></div></div>`;
  }
  if (I.kind === 'editshape') h = editShapeHtml(head);
  if (I.kind === 'erase') h = eraseHtml(head);
  if (I.kind === 'assets') h = assetsHtml(head);
  if (I.kind === 'repair') {
    const e = ent(S.sel);
    h = `<div class="inst">${head('Repair', esc(e?.name || ''), 'a loose end — nothing is blocked')}<div class="ib"><div class="conseq"><div class="ln warn"><b>Problem</b><span>${esc(M.loose.find((l) => l.id === S.sel)?.msg || '')}</span></div></div><div style="display:flex;gap:6px;margin-top:10px"><button class="ibtn light" data-act="repairposts">Add 4 posts under the open edges</button><button class="ibtn" data-act="repairok">It's meant to be</button><button class="ibtn" data-act="sel" data-id="${S.sel}">Show the edges</button></div></div></div>`;
  }
  if (S.lens === 'experience' && S.guideOpen && I.kind !== 'find') h = guideHtml() + h;
  return h;
}
function dimFields(e) {
  if (e.kind === 'wall') return [{ k: 'len', label: 'Length (m)', v: SC.wallLen(e).toFixed(2) }, { k: 'top', label: `Top (m)${nearestDatum(e.top) ? ' · ' + nearestDatum(e.top).name : ''}`, v: f2(e.top) }, { k: 'base', label: 'Base (m)', v: f2(e.base) }, { k: 'th', label: 'Thickness (m)', v: '0.24' }];
  if (e.kind === 'object' || e.kind === 'import') return [{ k: 'x', label: 'East (m)', v: f2(e.x) }, { k: 'y', label: 'North (m)', v: f2(e.y) }, { k: 'rot', label: 'Turn (°)', v: Math.round(e.rot || 0) }, { k: 'h', label: 'Height (m)', v: f2(e.h), ro: !e.scalable }];
  if (e.kind === 'roof') return [{ k: 'eave', label: 'Eave (m)', v: f2(e.eave) }, { k: 'ridge', label: 'Ridge (m)', v: f2(e.ridge) }, { k: 'over', label: 'Overhang (m)', v: '0.40' }];
  if (e.kind === 'opening') return [{ k: 'w', label: 'Width (m)', v: f2(e.w) }, { k: 'h', label: 'Height (m)', v: f2(e.h) }, { k: 'sill', label: 'Sill (m)', v: f2(e.sill) }, { k: 'at', label: 'Along wall (m)', v: f2(e.at) }];
  if (e.kind === 'artwork') return [{ k: 'c', label: 'Centre height (m)', v: f2(e.c) }, { k: 'at', label: 'Along wall (m)', v: f2(e.at) }];
  if (e.kind === 'room') return [{ k: 'area', label: 'Area (m²)', v: SC.polyArea(e.poly).toFixed(1), ro: true }];
  return [];
}
function applyDim(k, val) {
  const e = ent(S.sel); const v = parseFloat(val); if (!e || Number.isNaN(v)) return;
  const raw = findRaw(e.id);
  if (e.kind === 'wall' && k === 'top') {
    const need = Math.max(0, ...M.openings.filter((o) => o.host === e.id).map((o) => o.sill + o.h + 0.05), ...M.artworks.filter((a) => a.host === e.id).map((a) => a.c + a.h / 2 + 0.05));
    if (v < need) { S.instrument.refuse = { k, v: val, msg: `${f2(v)} m is below what this wall hosts (needs ${f2(need)} m).`, fix: { label: `Use ${f2(need)}`, k, v: f2(need) } }; return renderLower(); }
    raw.top = v;
  } else if (e.kind === 'wall' && k === 'len') { const L = SC.wallLen(raw); const d = [(raw.b[0] - raw.a[0]) / L, (raw.b[1] - raw.a[1]) / L]; raw.b = [raw.a[0] + d[0] * v, raw.a[1] + d[1] * v]; }
  else if (k in raw) raw[k] = v;
  S.instrument.refuse = null; commit(`Set ${k} of ${e.name}`); render();
}
function findRaw(id) { for (const k of ['walls', 'openings', 'roofs', 'objects', 'artworks', 'rooms', 'imports']) { const x = M[k].find((e) => e.id === id); if (x) return x; } return null; }

const CAPS = [
  ['Tools', 'Select', 'tool:select', 'V'], ['Tools', 'Ink — draw architecture', 'tool:ink', 'P'], ['Tools', 'Ink · Box tip', 'tip:box', ''], ['Tools', 'Slice through', 'tool:slice', 'K'], ['Tools', 'Eraser · lasso', 'tool:eraser', 'E'], ['Tools', 'Measure', 'tool:measure', 'M'], ['Tools', 'Paint a material', 'assets:materials', ''],
  ['Readings', 'Plan', 'reading:plan', '2'], ['Readings', '3D', 'reading:3d', '1'], ['Readings', 'Elevation south', 'reading:elev', '3'], ['Readings', 'Eye level', 'reading:eye', '4'], ['Readings', 'Lift roofs apart', 'lift', 'L'], ['Readings', 'Focus height', 'focus', 'F'],
  ['Procedures', 'Divide room', 'proc:divide', ''], ['Procedures', 'Add a floor above', 'proc:floor', ''], ['Procedures', 'Cover rooms with a roof', 'proc:cover', ''], ['Procedures', 'Import a model…', 'assets:import', ''],
  ['Settings', 'Reduce motion', 'set:motion', ''], ['Settings', 'Grid size…', 'grid', ''], ['Settings', 'Keys', 'set:keys', '?'],
];
function findList() {
  const q = S.findQ.toLowerCase(); let h = '';
  const e = selEntity();
  if (e && ent(e.id)) { const scoped = scopedList(e).filter((x) => !q || x[0].toLowerCase().includes(q)); if (scoped.length) h += `<h6>For ${esc(e.name)}</h6>` + scoped.map(([l, a]) => `<button data-act="cap" data-v="${a}">${l}</button>`).join(''); }
  let grp = '';
  for (const [g, l, a, k] of CAPS) { if (q && !l.toLowerCase().includes(q) && !g.toLowerCase().includes(q)) continue; if (g !== grp) { h += `<h6>${g}</h6>`; grp = g; } h += `<button data-act="cap" data-v="${a}">${l}<small>${k}</small></button>`; }
  if (q) h += `<h6>Subjects</h6><button data-act="searchsubjects" data-q="${esc(S.findQ)}">Search subjects for “${esc(S.findQ)}” in the Index →</button>`;
  return h;
}
function scopedList(e) {
  // one fixed-order scoped list: Card ⋯, context menu and Find's "For …" group share it
  const L = [];
  L.push(['Dimensions…', 'dims']);
  for (const [k, , l] of looksFor(e)) L.push([`Look · ${l}`, 'look:' + k]);
  if (e.kind === 'object' || e.kind === 'artwork') L.push(['Duplicate', 'dup'], ['Replace from Library…', 'assets:objects']);
  if (e.kind === 'wall' || e.kind === 'room') L.push(['Paint a finish…', 'assets:materials']);
  if (e.kind === 'import') L.push(['Trace as underlay', 'noop']);
  L.push(['Bring into view', 'bring']);
  if (['object', 'artwork', 'wall', 'room'].includes(e.kind)) L.push(['Present this ↗ Experience', 'presentthis']);
  L.push(['Erase…', 'erase-sel']);
  return L;
}
function editShapeHtml(head) {
  const r = ent(S.editShape.id); if (!r) return '';
  const pad = sectionPad(r);
  const prev = S.editShape.preview ? `<div class="prev3d"><svg viewBox="${SC.boundsOf(SC.camera('axo', { az: S.az })).join(' ')}">${SC.renderSolid(M, SC.camera('axo', { az: S.az }), { pal: SC.PAL.mat, sel: new Set([r.id]), ghost: (id) => id !== r.id }).svg}</svg><div class="cap">Synchronized 3D · same roof</div></div>` : '';
  if (S.cmp.edit === 'split') return `<div class="inst" style="width:min(420px,100%)">${head('Edit shape', esc(r.name), 'section open on the left')}<div class="ib"><div style="display:flex;gap:6px;flex-wrap:wrap">${presetChips(r)}</div><div style="display:flex;gap:6px;margin-top:8px"><button class="ibtn" data-act="es-face">Face the section</button><button class="ibtn light" data-act="instclose">Done <span class="kbd" style="color:inherit">Enter</span></button></div></div></div>`;
  return `<div class="inst broad">${head('Edit shape', esc(r.name), 'section · the building stays in view', `<button class="ibtn" data-act="es-preview" aria-pressed="${!!S.editShape.preview}">${icon('view3d', 14)} 3D preview</button>`)}<div class="ib row"><div class="pad">${pad}</div>${prev}<div style="display:grid;gap:6px;width:170px"><div class="muted">Start from</div><div style="display:flex;gap:4px;flex-wrap:wrap">${presetChips(r)}</div><button class="ibtn" data-act="es-face">Face the section</button><button class="ibtn light" data-act="instclose">Done <span class="kbd" style="color:inherit;border-color:currentColor">Enter</span></button></div></div></div>`;
}
function presetChips(r) { return [['flat', 'Flat'], ['gable', 'Gable'], ['raked', 'Raked'], ['vault', 'Vault']].map(([k, l]) => `<button class="ibtn" data-act="es-preset" data-v="${k}" aria-pressed="${(r.ridge > r.eave ? (r.asym ? 'raked' : 'gable') : 'flat') === k}">${l}</button>`).join(''); }
function sectionPad(r) {
  // section across the span: y from y0..y1, z from 0..ridge; context (walls, person) drawn behind
  const y0 = r.poly ? 0 : r.y0, y1 = r.poly ? 6 : r.y1, ym = r.asym != null ? y0 + (y1 - y0) * r.asym : (y0 + y1) / 2;
  const vb = `${y0 - 1.2} ${-(r.ridge + 1.2)} ${y1 - y0 + 2.4} ${r.ridge + 1.8}`;
  let g = ''; for (let y = Math.ceil(y0 - 1); y <= y1 + 1; y++) g += `<line x1="${y}" y1="${-r.ridge - 2}" x2="${y}" y2="0.6"/>`; for (let z = 0; z <= r.ridge + 1; z++) g += `<line x1="${y0 - 2}" y1="${-z}" x2="${y1 + 2}" y2="${-z}"/>`;
  const walls = `<rect class="sctx" x="${y0 + 0.4 - 0.12}" y="${-r.eave}" width="0.24" height="${r.eave}"/><rect class="sctx" x="${y1 - 0.4 - 0.12}" y="${-r.eave}" width="0.24" height="${r.eave}"/><line class="sctx" x1="${y0 - 1}" y1="0" x2="${y1 + 1}" y2="0"/>`;
  const person = `<g class="person" transform="translate(${ym - 1.4},0)"><circle cx="0" cy="-1.6" r="0.13"/><line x1="0" y1="-1.47" x2="0" y2="-0.8"/><line x1="0" y1="-0.8" x2="-0.18" y2="0"/><line x1="0" y1="-0.8" x2="0.18" y2="0"/><line x1="-0.3" y1="-1.25" x2="0.3" y2="-1.25"/></g>`;
  const prof = `${y0},${-r.eave} ${ym},${-r.ridge} ${y1},${-r.eave}`;
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" id="espad"><g class="pg">${g}</g>${walls}${person}<text class="ctxt" x="${y0 - 1}" y="${-r.eave - 0.1}" font-size=".3">eave ${f2(r.eave)}</text><text class="ctxt" x="${ym + 0.2}" y="${-r.ridge - 0.2}" font-size=".3">ridge ${f2(r.ridge)}</text><polyline class="prof" points="${prof}"/><circle class="jt" cx="${y0}" cy="${-r.eave}" r="0.16"/><circle class="jt" cx="${y1}" cy="${-r.eave}" r="0.16"/><circle class="jt hot" data-h="es-ridge" cx="${ym}" cy="${-r.ridge}" r="0.22" style="pointer-events:all;cursor:grab"/></svg>`;
}
function eraseHtml(head) {
  const items = [...S.marked].map(ent).filter(Boolean);
  const by = {}; items.forEach((e) => (by[e.kind] = (by[e.kind] || []).concat(e)));
  const removedWalls = new Set(items.filter((e) => e.kind === 'wall').map((e) => e.id));
  const orphans = [...M.openings, ...M.artworks].filter((o) => removedWalls.has(o.host) && !S.marked.has(o.id));
  const rooms = M.rooms.filter((r) => SC.roomEnclosed(M, r) && r.walls.some((w) => removedWalls.has(w)));
  const roofs = M.roofs.filter((r) => !S.marked.has(r.id) && (r.over || []).some((w) => removedWalls.has(w)));
  const presHit = M.presentations.filter((p) => p.subject && S.marked.has(p.subject));
  const n = items.length;
  let c = `<div class="conseq">`;
  c += `<div class="ln"><b>Erases</b><span>${Object.entries(by).map(([k, l]) => `${l.length} ${kindLabel[k].toLowerCase()}${l.length > 1 ? 's' : ''}`).join(' · ') || 'nothing yet'}</span></div>`;
  if (orphans.length) c += `<div class="ln"><b>Sets aside</b><span>${orphans.map((o) => esc(o.name)).join(', ')} — hosted on erased walls; kept, not deleted <button class="ibtn" data-act="erase-orphans" style="height:22px">Erase them too</button></span></div>`;
  if (rooms.length) c += `<div class="ln"><b>Derived</b><span>${rooms.map((r) => esc(r.name)).join(', ')} stop${rooms.length > 1 ? '' : 's'} being enclosed (rooms follow walls)</span></div>`;
  if (roofs.length) c += `<div class="ln warn"><b>Loose end</b><span>${roofs.map((r) => esc(r.name)).join(', ')} loses support — stays put; repair offered after</span></div>`;
  if (presHit.length) c += `<div class="ln warn"><b>Elsewhere</b><span>${presHit.map((p) => esc(p.name)).join(', ')} (Experience) loses its subject — shown honestly, not re-pointed</span></div>`;
  c += `<div class="ln"><b>History</b><span>one undo step</span></div></div>`;
  return `<div class="inst">${head('Erase', `${n} thing${n === 1 ? '' : 's'}`, 'review before it happens', `<button class="ibtn" data-act="erase-cancel">Cancel</button><button class="ibtn danger" data-act="erase-apply" ${n ? '' : 'disabled'}>Erase ${n}</button>`)}<div class="ib">${c}<div class="muted" style="margin-top:8px">Adjust with the palette filters, or keep scrubbing/lassoing to add. Tap an item on Stage to drop it.</div></div></div>`;
}
const ASSETS = {
  objects: [['Oak bench', 'bench', 1.8, 0.5, 0.45], ['Plinth', 'sculpture', 0.6, 0.6, 1.0], ['Vitrine', 'object', 1.2, 0.6, 1.1], ['Grand piano', 'piano', 1.5, 2.0, 1.0], ['Lectern', 'object', 0.5, 0.4, 1.1], ['Low table', 'object', 1.0, 1.0, 0.4]],
  art: [['Framed print', 'artwork', 0.9, 0.05, 0.7], ['Large canvas', 'artwork', 1.8, 0.05, 1.2], ['Wall text panel', 'artwork', 0.6, 0.05, 0.9]],
  materials: [['Oak', '#b98f5a'], ['Limewash', '#ece6d6'], ['Slate', '#55626a'], ['Terrazzo', '#cfc7bb'], ['Forest paint', '#2f5a45'], ['Brick', '#a2543e']],
  lights: [['Track spot', 'light'], ['Wall washer', 'light'], ['Pendant', 'light']],
};
function assetsHtml(head) {
  const tab = S.instrument.tab || 'objects';
  const tabs = [['objects', 'Objects'], ['art', 'Art'], ['materials', 'Materials'], ['lights', 'Lights'], ['import', 'Import']].map(([k, l]) => `<button data-act="atab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'objects' || tab === 'art') body = `<div class="tiles">${ASSETS[tab].map(([n, k, w, d, hh], i) => `<button class="tile" data-act="pick" data-tab="${tab}" data-i="${i}" aria-pressed="${S.placing?.name === n}"><span class="art">${icon(k === 'artwork' ? 'material' : 'object', 22)}</span><span class="n">${n}</span><span class="m">${w}×${d}×${hh} m</span></button>`).join('')}${M.imports.length ? M.imports.map((im) => `<button class="tile" data-act="pickimport" data-id="${im.id}"><span class="art" style="background:url(#)">${icon('import', 22)}</span><span class="n">${esc(im.name)}</span><span class="m">imported · fixed</span></button>`).join('') : ''}</div>`;
  if (tab === 'materials') body = `<div class="tiles">${ASSETS.materials.map(([n, c], i) => `<button class="tile" data-act="pickmat" data-i="${i}" aria-pressed="${S.paint?.name === n}"><span class="art" style="background:${c}"></span><span class="n">${n}</span><span class="m">click a wall or floor</span></button>`).join('')}</div><div class="muted" style="margin-top:8px">Picking a material arms Paint as a temporary dock slot; it is not a permanent tool.</div>`;
  if (tab === 'lights') body = `<div class="tiles">${ASSETS.lights.map(([n]) => `<button class="tile" data-act="noop"><span class="art">${icon('light', 22)}</span><span class="n">${n}</span><span class="m">placement not in this wireframe</span></button>`).join('')}</div>`;
  if (tab === 'import') body = `<div class="drop">${icon('import', 26)}<div>Drop a .glb / .gltf anywhere on the Stage, or</div><div style="display:flex;gap:6px"><button class="ibtn light" data-act="mockimport">Use sample “Boat hull.glb”</button><button class="ibtn" data-act="noop">Choose file…</button></div><div class="muted">Imports arrive as fixed geometry: they can be placed, sliced, measured, presented and traced over — not reshaped.</div></div>${S.instrument.imported ? `<div class="conseq" style="margin-top:10px"><div class="ln"><b>Imported</b><span>Boat hull.glb · 2.4 MB · 18k triangles · 4.2 × 1.4 × 1.1 m</span></div><div class="ln"><b>Next</b><span><button class="ibtn light" data-act="pickimport" data-id="${S.instrument.imported}">Place it</button> <button class="ibtn" data-act="noop">Trace as underlay</button></span></div></div>` : ''}`;
  return `<div class="inst broad">${head('Library', '', '', `<span class="tabs">${tabs}</span>`)}<div class="ib">${body}</div></div>`;
}

// ---------------- Guide (Experience instrument) ----------------
function guideTimeline() {
  const g = guide(); const segs = []; let t = 0;
  g.stops.forEach((s, i) => { segs.push({ kind: 'hold', i, t0: t, t1: t + s.hold }); t += s.hold; const e = g.edges[i]; if (e) { const d = e.mode === 'cut' ? 0 : e.dur; segs.push({ kind: 'move', i, t0: t, t1: t + d, cut: e.mode === 'cut' }); t += d; } });
  return { segs, total: t };
}
function evalGuide(t) {
  const g = guide(); const { segs, total } = guideTimeline(); t = clamp(t, 0, total);
  const seg = segs.find((s) => t >= s.t0 && t <= s.t1 && s.t1 > s.t0) || segs[segs.length - 1];
  if (seg.kind === 'hold') { const v = view(g.stops[seg.i].views[0]); return { pose: { pos: v.pos, target: v.target }, stop: seg.i, total }; }
  const A = view(g.stops[seg.i].views.at(-1)), B = view(g.stops[seg.i + 1].views[0]);
  const pts = [A.pos, ...(g.edges[seg.i].pts || []).map((p) => [p[0], p[1], 1.6]), B.pos];
  const u = (t - seg.t0) / (seg.t1 - seg.t0); const lens = []; let L = 0;
  for (let k = 0; k < pts.length - 1; k++) { const l = SC.len(SC.sub(pts[k + 1], pts[k])); lens.push(l); L += l; }
  let d = u * L, k = 0; while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
  const a = d / (lens[k] || 1), pos = SC.add(pts[k], SC.mul(SC.sub(pts[k + 1], pts[k]), a));
  const target = SC.add(A.target, SC.mul(SC.sub(B.target, A.target), u));
  return { pose: { pos, target }, stop: seg.i, moving: seg.i, total };
}
function guideHtml() {
  const g = guide(); const { segs, total } = guideTimeline(); const cur = evalGuide(S.t);
  let stops = '';
  g.stops.forEach((s, i) => {
    const p = pres(s.pres);
    stops += `<button class="stopc${S.sel === s.id ? ' sel' : ''}${S.playing && cur.stop === i && !cur.moving ? ' play' : ''}" data-act="sel" data-id="${s.id}"><span class="th">${thumbSvg(s.views[0], 120, 56)}<span class="no">${i + 1}</span></span><span class="n">${esc(p.name)}</span><span class="m">${s.views.length} view · ${s.hold}s</span></button>`;
    const e = g.edges[i]; if (e) stops += `<span class="conn"><button class="${e.mode === 'cut' ? 'cut' : ''}${S.sel === 'edge-' + i ? ' sel' : ''}" data-act="sel" data-id="edge-${i}">${e.mode === 'cut' ? icon('cut', 12) + 'cut' : '↗ ' + e.dur + 's'}</button></span>`;
  });
  const bar = segs.map((s) => `<i class="${s.kind === 'hold' ? 'hold' : ''}" style="left:${(s.t0 / total) * 100}%;width:${((s.t1 - s.t0) / total) * 100}%"></i>`).join('');
  const mm = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  return `<div class="inst broad guide"><div class="ih"><span class="k">Guide</span><span class="nm">${esc(g.name)}</span><span class="tg">${g.stops.length} stops · ${mm(total)}</span><span class="sp"></span><button class="ibtn" data-act="follow" aria-pressed="${S.follow}">${icon('camera', 14)} Follow</button><button class="ibtn" data-act="addstop">${icon('plus', 14)} Stop</button><button class="x" data-act="guide" title="Close the Guide">${icon('close', 16)}</button></div><div class="stops">${stops}</div><div class="scrub"><button class="ibtn gold" data-act="play" title="Play / pause (Space)">${icon(S.playing ? 'pause' : 'play', 14)}</button><div class="bar" id="scrubbar">${bar}<b style="left:${(S.t / total) * 100}%"></b></div><span class="t">${mm(S.t)} / ${mm(total)}</span></div></div>`;
}
let raf = 0, lastT = 0;
function tick(ts) {
  if (!S.playing) return;
  const dt = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
  S.t += dt; const { total } = guideTimeline(); if (S.t >= total) { S.t = total; S.playing = false; }
  renderStage(); renderLower(); raf = requestAnimationFrame(tick);
}

// ---------------- floating: context menu, reading chip, toast ----------------
function renderFloat() {
  let h = '';
  if (S.ctx) {
    const e = ent(S.ctx.id);
    if (e) h += `<div class="ctx" style="left:${S.ctx.x}px;top:${S.ctx.y}px"><div class="hd"><small>${kindLabel[e.kind]}</small>${esc(e.name)}</div>${scopedList(e).map(([l, a]) => (a === 'erase-sel' ? '<hr>' : '') + `<button data-act="cap" data-v="${a}" class="${a === 'erase-sel' ? 'danger' : ''}">${l}${a === 'erase-sel' ? '<small>⌫</small>' : a === 'dims' ? '<small>D</small>' : ''}</button>`).join('')}</div>`;
    else h += `<div class="ctx" style="left:${S.ctx.x}px;top:${S.ctx.y}px"><div class="hd"><small>Stage</small>Here</div><button data-act="cap" data-v="reading:plan">Plan reading<small>2</small></button><button data-act="cap" data-v="reading:3d">3D reading<small>1</small></button><button data-act="cap" data-v="assets:objects">Place from Library…<small>A</small></button><button data-act="find">Find…<small>⌘K</small></button></div>`;
  }
  if (S.readChip) {
    const r = S.readChip; const cur = r.readings[r.idx];
    h += `<div class="readchip" style="left:${r.x}px;top:${r.y}px">Read as <b>${esc(cur.label)}</b><span class="quiet">${esc(cur.meta || '')}</span>${r.readings.map((x, i) => (i === r.idx ? '' : `<button class="alt" data-act="reread" data-i="${i}">${esc(x.label)}</button>`)).join('')}<span class="kbd">Tab</span></div>`;
  }
  if (S.toast) h += `<div class="toast${S.toast.refusal ? ' ref' : ''}">${S.toast.refusal ? icon('warning', 15) : ''}${esc(S.toast.msg)}${S.toast.action ? `<button data-act="${S.toast.action[1]}">${S.toast.action[0]}</button>` : ''}</div>`;
  $('#float').innerHTML = h;
}

// ---------------- Preview takeover ----------------
const CAPTIONS = { 'p-arrival': 'A boathouse turned gallery: one long room, a studio beyond.', 'p-north': 'Three harbour paintings hang where the boats once came in.', 'p-torso': 'A torso, carved from driftwood, stands alone in the light.', 'p-studio': 'The Pleyel piano waits in the studio.' };
function renderPreview() {
  const el = $('#previewhost');
  if (!S.preview) { el.innerHTML = ''; return; }
  const g = guide(); const i = S.preview.i; const s = g.stops[i]; const v = view(s.views[0]);
  const cam = SC.camera('persp', { pos: S.preview.pos || v.pos, target: S.preview.target || v.target, F: focal(v.lens) });
  const r = SC.renderSolid(M, cam, { pal: SC.PAL.mat, finishes: M.finishes });
  el.innerHTML = `<div class="preview"><svg viewBox="-16 -10 32 20" preserveAspectRatio="xMidYMid slice"><rect x="-40" y="-30" width="80" height="60" fill="#1D3A33"/>${r.svg}</svg><div class="vtop"><span class="ttl">Opening night</span><span style="display:flex;gap:8px"><span class="seg"><button aria-pressed="${S.preview.mode === 'guided'}" data-act="pvmode" data-v="guided">Guided</button><button aria-pressed="${S.preview.mode === 'explore'}" data-act="pvmode" data-v="explore">Explore</button></span></span></div>${S.preview.mode === 'guided' ? `<div class="cap">${esc(CAPTIONS[s.pres] || '')}</div>` : ''}<div class="vctl">${S.preview.mode === 'guided' ? `<button data-act="pvnav" data-v="-1">‹ Back</button><span class="dots">${g.stops.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span><button data-act="pvnav" data-v="1">Next ›</button>` : '<span style="color:#b9cbbf">Drag to look · arrow keys to walk (mock)</span>'}<button class="exit" data-act="pvexit">Exit Preview <span class="kbd" style="color:inherit;border-color:currentColor">Esc</span></button></div></div>`;
}

// ---------------- coach (wireframe journeys) ----------------
const JOURNEYS = [
  { id: 'draw', t: 'Draw architecture', setup() { reset(); S.reading = 'plan'; S.tool = 'ink'; S.inkTip = 'line'; }, steps: ['Ink is armed (black). Click points on the vellum east of the studio; click the first point again to close.', 'The chip reads the stroke as a Room. Press Tab (or click an alternative) to re-read it as Walls only or a Platform — same undo step.', 'Switch the View control to 3D (or press 1): the same walls, now on the mat.', 'Try the Box tip: drag corner to corner.'], why: 'Ink replaces PLATE’s Draw and Opening families with one pen whose reading depends on the surface it lands on.' },
  { id: 'open', t: 'Cut openings', setup() { reset(); S.reading = '3d'; S.tool = 'ink'; }, steps: ['Hover the South wall with Ink: the palette’s surface chip says strokes on a wall become openings.', 'Drag a rectangle on the wall face → an opening, sized by the drag.', 'Select the wall, Look ▾ → Face this wall. The wall lies flat on vellum; Ink draws precise openings there.', 'Esc puts it back.'], why: 'Subject-local working surface: the wall face is a drawing plane without a separate Opening tool.' },
  { id: 'roof', t: 'Vertical & roof editing', setup() { reset(); S.reading = '3d'; }, steps: ['Drag the Sheet handle on the Heights rail up to “Studio top”. It snaps to named heights; Ink arms itself (the sheet is paper).', 'Toggle Focus height to ghost everything outside the band.', 'Draw a closed shape over the studio → reads as a Canopy roof at 3.60. Tab → Deck.', 'Select the Gallery roof → drag its ridge knob, or Look ▾ → Edit shape for the section pad with the building behind. Toggle 3D preview.'], why: 'Retains P3’s sheet, named heights and Focus Height; tests whether the rail and Edit Shape fit PLATE’s instrument home.' },
  { id: 'erase', t: 'Bulk erase', setup() { reset(); S.reading = '3d'; S.tool = 'eraser'; S.eraseMode = 'lasso'; }, steps: ['Lasso the studio (drag a loop around it). Everything inside is marked red; nothing is gone yet.', 'The Erase instrument lists what goes, what is set aside (hosted art), derived rooms and loose ends.', 'Toggle palette filters (Objects off) — the marked set updates.', 'Erase N → one undo step. Undo in the Head restores everything.'], why: 'Exploratory mass deletion stays reviewable and honest about consequences without a modal dialog.' },
  { id: 'obj', t: 'Manipulate objects', setup() { reset(); S.reading = '3d'; S.sel = 'b-sculpt'; }, steps: ['The torso shows contextual handles only: slide (centre), turn (ring knob), size (top knob). No permanent gizmo.', 'Drag the body to slide it; the tag reads distances to the nearest wall.', 'Right-click it: the scoped list (same as Card ⋯ and Find “For …”).', 'Click a fact on the Card → Dimensions for typed precision.', 'Select “Two boats” on the north wall: P2-style spacing ribbons appear; drag to slide it along the wall.'], why: 'Tiny Glade-like direct handles; precision stays in the Card → Dimensions ladder.' },
  { id: 'import', t: 'Import & place', setup() { reset(); S.reading = '3d'; S.instrument = { kind: 'assets', tab: 'import', broad: true }; }, steps: ['The Library opens upward from the dock. Use sample “Boat hull.glb”.', 'Place it: a ghost follows the pointer on the floor; click to place. Stays armed until Esc.', 'Art tab → a print can only land on a wall face (it refuses on the floor, in words).', 'Materials tab → Oak arms Paint as a temporary dock slot.'], why: 'Asset entry sits next to the tools it feeds, without a permanent Paint tool.' },
  { id: 'exp', t: 'Experience capture & Preview', setup() { reset(); S.lens = 'experience'; S.reading = 'plan'; }, steps: ['Select “The north wall” in the Index: thumbnails, Default ◆, Look through.', 'Look through → drag to re-aim → Update View (gold) or Exit.', 'View tool (C): press-drag on the plan to place a new View.', 'Open the Guide (dock or Index). Play; turn on Follow; click a transition and switch Cut/Travel.', 'Preview (Head) → guided visitor walk; Exit returns exactly here.'], why: 'Conservatory’s Experience inside the same Head/Index/Stage/Card and the same dock home.' },
  { id: 'narrow', t: 'Narrow layouts', setup() { reset(); S.width = 'tablet'; S.sel = 'w-s1'; }, steps: ['Tablet width: Index and Card become sheets behind Head controls (location / selected identity).', 'Wireframe ▸ Width ▸ Phone: the dock keeps Select + Ink; Slice, Eraser and Measure fold into “More” (expands upward). The rail becomes a Sheet chip.', 'Open the Card from the identity chip; it docks above the dock.'], why: 'Stage stays dominant; nothing reflows the Stage or moves the Camera.' },
];
function reset() { M = SC.seedModel(); M.tray = []; M.loose = []; H.stack = [{ label: 'Open Boathouse gallery', m: clone(M) }]; H.i = 0; Object.assign(S, { lens: 'world', reading: '3d', tool: 'select', sel: null, instrument: null, look: null, slice: null, lift: false, focus: false, sheet: { h: 0, raised: false }, marked: new Set(), placing: null, paint: null, readChip: null, ink: null, meas: null, guideOpen: false, playing: false, t: 0, follow: false, lookThrough: null, preview: null, editShape: null, width: 'fill', cardLook: false, cardDetails: false, cams: {}, cardSheet: false, indexSheet: false, overflow: false, railOpen: true }); }
function renderCoach() {
  const el = $('#coach'); const j = JOURNEYS.find((x) => x.id === S.journey);
  if (!j) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="coach${S.coachMin ? ' min' : ''}"><h5><span>Journey · ${esc(j.t)}</span><span><span class="min" data-act="coachmin">${S.coachMin ? '▸' : '▾'}</span> <span class="min" data-act="coachclose">✕</span></span></h5><ol>${j.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><div class="why">${esc(j.why)}</div></div>`;
}

// ---------------- wireframe bar ----------------
function wfMenu(kind, anchor) {
  const m = $('#wfmenu'); if (m.dataset.kind === kind && m.style.display !== 'none') { m.style.display = 'none'; m.dataset.kind = ''; return; }
  m.dataset.kind = kind; m.style.display = 'block'; m.style.left = anchor.offsetLeft + 'px';
  if (kind === 'journeys') m.innerHTML = `<h6>Representative workflows</h6>${JOURNEYS.map((j) => `<button data-wf="journey" data-v="${j.id}" class="${S.journey === j.id ? 'on' : ''}">${j.t}</button>`).join('')}`;
  if (kind === 'compare') {
    const opt = (k, v, l) => `<button data-wf="cmp" data-k="${k}" data-v="${v}" class="${S.cmp[k] === v ? 'on' : ''}">${l}</button>`;
    m.innerHTML = `<h6>Tool home</h6>${opt('dock', 'bottom', 'A · Bottom dock, palettes expand upward (recommended)')}${opt('dock', 'left', 'B · PLATE-literal pointer rail on the Stage edge')}<h6>Heights rail</h6>${opt('rail', 'left', 'A · Stage-left, beside the Index (recommended)')}${opt('rail', 'right', 'B · Stage-right, P3 position (Card shifts)')}<h6>Edit shape</h6>${opt('edit', 'pad', 'A · Section pad in the instrument, building on Stage (recommended)')}${opt('edit', 'split', 'B · Split Stage: section left, 3D right')}<h6>Tool identity colour</h6>${opt('toolColor', true, 'On · black Ink / yellow Slice / red Eraser swatches')}${opt('toolColor', false, 'Off · PLATE roles only')}<div class="note">Compare switches change only presentation; state is kept.</div>`;
  }
  if (kind === 'width') m.innerHTML = `<h6>Simulated frame</h6>${[['fill', 'Fill window'], ['laptop', 'Laptop 1280 × 800'], ['narrow', 'Narrow desktop 940'], ['tablet', 'Tablet 720'], ['phone', 'Phone 390']].map(([k, l]) => `<button data-wf="width" data-v="${k}" class="${S.width === k ? 'on' : ''}">${l}</button>`).join('')}`;
  if (kind === 'about') m.innerHTML = `<div class="note" style="padding:6px 8px">Low-fidelity wireframe for owner review. Mock state, SVG scenes, snapshot Undo. Not a contract, not production, not PLATE. Read DESIGN-NOTE.md beside this file.<br><br>Keys: V Select · P Ink · K Slice · E Eraser · M Measure · A Library · ⌘K Find · 1–5 readings · L Lift · F Focus height · Tab re-read · Del erase · Esc unwinds · ⌘Z / ⇧⌘Z.</div>`;
}

// ---------------- actions ----------------
function setTool(t) {
  if (S.tool === 'eraser' && t !== 'eraser') { S.marked.clear(); if (S.instrument?.kind === 'erase') S.instrument = null; }
  S.tool = t; S.overflow = false; S.ink = null; S.meas = null; S.lassoPoly = null;
  if (t !== 'place') S.placing = null;
  if (t !== 'paint' && S.paint && t !== 'select') S.paint = null;
  if (t === 'select') { S.paint = null; S.placing = null; }
}
function selectId(id, opts = {}) {
  S.sel = id || null; S.cardLook = false; S.cardDetails = false; S.ctx = null;
  const e = ent(id);
  if (e && !S.placeLocked) { const r = roomOf(e); if (r) S.place = r.id; }
  if (S.instrument && S.instrument.kind === 'dims') S.instrument = null;
  if (S.narrow !== 'wide' && opts.openCard) S.cardSheet = true;
}
function startLook(kind, e) {
  e = e || ent(S.sel); if (!e) return;
  if (kind === 'unroll') { const r = e.kind === 'room' ? e : roomOf(e); if (!r) return toast('Unroll needs a room around this wall.', true); S.look = { kind: 'unroll', walls: r.walls.filter((w) => SC.wallById(M, w)) }; }
  else if (kind === 'face') S.look = { kind: 'face', walls: [e.id] };
  else if (kind === 'facehost') S.look = { kind: 'face', walls: [e.host] };
  else if (kind === 'lift') { S.lift = true; S.cardLook = false; return renderAll(true); }
  else if (kind === 'section') { const c = SC.entityPlanCentre(M, e); S.slice = { a: [c[0] - 12, c[1] - 0.01], b: [c[0] + 12, c[1]], flip: false }; S.reading = 'section'; S.cardLook = false; return renderAll(true); }
  else if (kind === 'editshape') return openEditShape(e.id);
  else if (kind === 'focus') { S.focus = true; S.sheet.h = e.z || 0; return renderAll(); }
  else if (kind === 'eye') { S.eye = { pos: [e.x - 2.5, e.y - 2.5, 1.6], target: [e.x, e.y, 0.9] }; S.reading = 'eye'; return renderAll(true); }
  S.instrument = { kind: 'look' }; S.cardLook = false; renderAll(true);
}
function putBack() { S.look = null; S.lift = false; if (S.instrument?.kind === 'look') S.instrument = null; renderAll(true); }
function openEditShape(id) { S.editShape = { id, preview: false }; S.instrument = { kind: 'editshape', broad: true }; S.cardLook = false; if (S.cmp.edit === 'split') S.reading = '3d'; renderAll(); }
function renderAll(x) { render(); if (x) renderStage(true); }

function eraseApply() {
  const ids = [...S.marked]; if (!ids.length) return;
  const removedWalls = new Set(ids.filter((id) => ent(id)?.kind === 'wall'));
  const set = new Set(ids); let aside = 0;
  for (const coll of ['openings', 'artworks']) M[coll] = M[coll].filter((o) => { if (set.has(o.id)) return false; if (removedWalls.has(o.host)) { M.tray.push({ ...o, coll }); aside++; return false; } return true; });
  for (const coll of ['walls', 'objects', 'roofs', 'imports']) M[coll] = M[coll].filter((o) => !set.has(o.id));
  M.rooms = M.rooms.filter((r) => !set.has(r.id));
  for (const r of M.roofs) if ((r.over || []).some((w) => removedWalls.has(w)) && !M.loose.some((l) => l.id === r.id)) M.loose.push({ id: r.id, msg: `${(r.over || []).filter((w) => removedWalls.has(w)).length} supporting wall(s) erased — roof edges are unsupported` });
  const n = ids.length; commit(`Erase ${n}`);
  S.marked.clear(); S.instrument = null; S.lassoPoly = null; if (S.sel && !ent(S.sel)) S.sel = null;
  toast(`Erased ${n}${aside ? ` · ${aside} set aside` : ''}`, false, ['Undo', 'undo']); render();
}
function markFromLasso() {
  if (!S.lassoPoly || S.lassoPoly.length < 3) return;
  S.marked = new Set(Object.entries(CENT).filter(([id, c]) => passFilter(id) && SC.pointInPoly(c, S.lassoPoly)).map(([id]) => id));
}
function passFilter(id) { const e = ent(id); if (!e) return false; const k = e.kind === 'import' ? 'object' : e.kind; if (k === 'room') return false; return !!S.eraseFilter[k]; }

// ink readings: what the stroke means depends on where it lands
function readingsFor(pts, closed, h) {
  const top = S.inkTop === 'h24' ? h + 2.4 : datum(S.inkTop)?.z ?? h + 3;
  const L = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) + (closed ? Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) : 0);
  const area = closed ? SC.polyArea(pts) : 0;
  if (h < 0.05) return closed ? [{ label: 'Room', meta: `${pts.length} walls · ${area.toFixed(1)} m²`, make: 'room', top }, { label: 'Walls only', make: 'walls', top }, { label: 'Raised platform', make: 'platform', meta: '0.45 m' }] : [{ label: pts.length > 2 ? 'Wall chain' : 'Wall', meta: `${L.toFixed(1)} m`, make: 'walls', top }, { label: 'Low wall', make: 'walls', top: 1.1, meta: '1.10 m' }];
  return closed ? [{ label: 'Canopy roof', meta: `at ${f2(h)} · ${area.toFixed(1)} m²`, make: 'canopy' }, { label: 'Deck', meta: `floor at ${f2(h)}`, make: 'deck' }, { label: 'Walls standing on the sheet', make: 'walls', top: h + 2.4, base: h }] : [{ label: 'Walls standing on the sheet', make: 'walls', top: h + 2.4, base: h }, { label: 'Edge rail', make: 'walls', top: h + 1.1, base: h }];
}
function applyReading(pts, closed, h, r) {
  const made = [];
  if (r.make === 'room' || r.make === 'walls') {
    const ids = []; const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const id = `w-${uid++}`; M.walls.push({ id, name: `Wall ${uid - 1}`, a: [...pts[i]], b: [...pts[(i + 1) % pts.length]], base: r.base ?? h, top: r.top }); ids.push(id); }
    made.push(...ids);
    if (r.make === 'room') { const id = `room-${uid++}`; M.rooms.push({ id, name: `Room ${M.rooms.length + 1}`, walls: ids, poly: pts.map((p) => [...p]), z: h }); made.unshift(id); }
  } else if (r.make === 'platform' || r.make === 'deck') { const id = `room-${uid++}`; M.rooms.push({ id, name: r.make === 'deck' ? `Deck at ${f2(h)}` : 'Platform', walls: [], poly: pts.map((p) => [...p]), z: r.make === 'deck' ? h : 0.45 }); made.push(id); }
  else if (r.make === 'canopy') { const id = `r-${uid++}`; M.roofs.push({ id, name: 'Canopy', kind: 'flat', poly: pts.map((p) => [...p]), eave: h, ridge: h, over: [] }); made.push(id); }
  return made[0];
}
function finishInk(pts, closed) {
  const h = S.sheet.raised ? S.sheet.h : 0;
  if (pts.length < 2) { S.ink = null; return render(); }
  const readings = readingsFor(pts, closed, h);
  const before = clone(M);
  const id = applyReading(pts, closed, h, readings[0]);
  commit(`Ink ${readings[0].label.toLowerCase()}`);
  S.sel = id; const end = wpx([...pts.at(-1), h]) || [200, 200];
  S.readChip = { pts, closed, h, readings, idx: 0, before, x: clamp(end[0] + 14, 8, $('#stage').clientWidth - 360), y: clamp(end[1] - 40, 50, $('#stage').clientHeight - 140) };
  S.ink = null; render();
}
function reread(i) {
  const r = S.readChip; if (!r) return; r.idx = i ?? (r.idx + 1) % r.readings.length;
  M = clone(r.before); const id = applyReading(r.pts, r.closed, r.h, r.readings[r.idx]);
  amend(`Ink ${r.readings[r.idx].label.toLowerCase()}`); S.sel = id; render();
}
function simplify(pts, eps = 0.3) {
  if (pts.length < 3) return pts;
  const d = (p, a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l; };
  let idx = -1, mx = 0; for (let i = 1; i < pts.length - 1; i++) { const v = d(pts[i], pts[0], pts.at(-1)); if (v > mx) { mx = v; idx = i; } }
  if (mx > eps) return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
  return [pts[0], pts.at(-1)];
}
function snapAngle(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return [a[0] + Math.cos(ang) * L, a[1] + Math.sin(ang) * L]; }

// wall parameter under the pointer (sampled; enough for a wireframe)
function wallHit(w, ev) {
  const [u, v] = toVB(ev); const L = SC.wallLen(w); let best = null;
  for (let i = 0; i <= 48; i++) for (let j = 0; j <= 24; j++) { const t = (L * i) / 48, z = w.base + ((w.top - w.base) * j) / 24; const q = CAM.P([...SC.wallPoint(w, t), z]); const dd = (q[0] - u) ** 2 + (q[1] - v) ** 2; if (!best || dd < best.d) best = { t, z, d: dd }; }
  return best;
}

// ---------------- pointer on the Stage ----------------
let D = null;
function stageDown(ev) {
  if (ev.target.closest('.sf, #card, #lower .lower > *, #side > div, .hrail, .rail-chip, .pop, .ctx, .readchip, .pill, .toast, .splitpane')) return;
  S.ctx = null; S.viewPop = false; S.sheetPop = false;
  const st = $('#stage'); st.setPointerCapture(ev.pointerId);
  const hit = ev.target.closest('[data-id]'); const hid = hit?.dataset.id; const hnd = ev.target.closest('[data-h]')?.dataset.h;
  const uv = toVB(ev);
  if (ev.button === 2) return; // context menu handled separately
  if (ev.button === 1 || ev.shiftKey && S.tool === 'select' && !hid || spaceDown) { D = { kind: 'pan', start: uv, pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY }; return; }
  if (S.lookThrough) { D = { kind: 'aim', sx: ev.clientX, sy: ev.clientY, t0: [...S.lookThrough.target], pos: S.lookThrough.pos }; return; }
  if (S.reading === 'eye' && S.tool === 'select' && !hid) { D = { kind: 'aimEye', sx: ev.clientX, sy: ev.clientY, t0: [...S.eye.target] }; return; }
  // Experience
  if (S.lens === 'experience') {
    const vm = ev.target.closest('.vm'); const pp = ev.target.closest('.pathpt');
    if (pp) { const [, i, j] = pp.dataset.h.split('-'); D = { kind: 'pathpt', i: +i, j: +j }; return; }
    if (S.tool === 'view') { const p = onPlane(ev, 0); if (!p) return toast('Place Views on Plan or 3D.', true); D = { kind: 'newview', a: p, aPx: uv }; return; }
    if (S.tool === 'path') { const id = S.sel; if (!id || !id.startsWith('edge-')) return toast('Select a transition in the Guide first.', true); const p = onPlane(ev, 0); if (!p) return; const e = guide().edges[+id.slice(5)]; if (e.mode === 'cut') return toast('A Cut has no travel path. Switch it to Travel.', true); (e.pts = e.pts || []).push(p); commit('Add path point'); return render(); }
    if (vm) { selectId(vm.dataset.v); if (ev.detail === 2) return lookThrough(vm.dataset.v); return render(); }
    if (hid && ent(hid)) { selectId(hid); return render(); }
    D = { kind: RENDERED.mode === 'plan' ? 'pan' : 'orbit', start: uv, pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY, az0: S.az, moved: false, clear: true }; return;
  }
  // World tools
  if (S.tool === 'select') {
    if (hnd) return startHandle(hnd, ev);
    if (hid && ev.detail === 2) { const e = ent(hid); if (e?.kind === 'roof') return openEditShape(hid); if (e?.kind === 'wall') { selectId(hid); return startLook('face', e); } if (e?.kind === 'room') { selectId(hid); return startLook('unroll', e); } }
    if (hid) {
      const e = ent(hid); const was = S.sel === hid; selectId(hid);
      if (e && ['object', 'import'].includes(e.kind) && RENDERED.mode !== 'unroll') D = { kind: 'move', id: hid, start: uv, moved: false, was };
      if (e && ['artwork', 'opening'].includes(e.kind) && RENDERED.mode === 'solid') D = { kind: 'slide', id: hid, h0: wallHit(SC.wallById(M, e.host), ev) };
      return render();
    }
    D = { kind: RENDERED.mode === 'plan' || RENDERED.mode === 'unroll' ? 'pan' : 'orbit', start: uv, pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY, az0: S.az, moved: false, clear: true };
    return;
  }
  if (S.tool === 'ink') return inkDown(ev, hid, uv);
  if (S.tool === 'slice') {
    if (S.sliceMode === 'horizontal') { S.slice = { horizontal: true, h: S.sheet.h || 1.2 }; return render(); }
    const p = onPlane(ev, 0); if (!p) return toast('Slice from Plan or 3D.', true); D = { kind: 'slice', a: p, aPx: uv }; return;
  }
  if (S.tool === 'eraser') {
    if (S.eraseMode === 'tap') { if (hid && passFilter(hid)) { S.marked = new Set([hid]); return eraseApply(); } return toast('Nothing erasable there for the current filters.', true); }
    if (S.marked.size && hid && S.marked.has(hid) && S.instrument?.kind === 'erase') { S.marked.delete(hid); return render(); }
    D = { kind: S.eraseMode }; S.lassoPoly = [uv]; if (S.eraseMode === 'scrub' && hid && passFilter(hid)) S.marked.add(hid); return renderOverlay();
  }
  if (S.tool === 'measure') {
    if (S.measureMode === 'height') { const e = ent(hid); if (!e) return; const top = e.top ?? (e.kind === 'roof' ? e.ridge : (e.z || 0) + (e.h || 0)); S.meas = { heightAt: { px: [ev.clientX - st.getBoundingClientRect().left, ev.clientY - st.getBoundingClientRect().top], label: `${f2(top)} m${nearestDatum(top) ? ' · ' + nearestDatum(top).name : ''}` } }; return renderOverlay(); }
    const p0 = onPlane(ev, 0); if (!p0) return; const p = snapPt(p0).p;
    if (!S.meas || S.meas.b || !S.meas.a) S.meas = { a: p }; else S.meas.b = p; return renderOverlay();
  }
  if (S.tool === 'place') return placeAt(ev, hid);
  if (S.tool === 'paint') { const e = ent(hid); if (!e || !['wall', 'room'].includes(e.kind)) return toast('Paint lands on a wall or a floor.', true); M.finishes[hid] = { name: S.paint.name, color: S.paint.color }; commit(`Paint ${e.name} ${S.paint.name}`); return render(); }
}
function inkDown(ev, hid, uv) {
  const e = ent(hid);
  if (RENDERED.mode === 'unroll') {
    // drawing on a wall laid flat: a rectangle becomes an opening in that wall's coordinates
    let u0 = 0, wall = null; for (const id of S.look.walls) { const w = SC.wallById(M, id); const L = SC.wallLen(w); if (uv[0] >= u0 && uv[0] <= u0 + L) { wall = w; break; } u0 += L + 0.6; }
    if (!wall) return; D = { kind: 'inkOpenFlat', wall, u0, a: uv }; return;
  }
  const nearEnd = e && e.kind === 'wall' && (() => { const p = onPlane(ev, 0); return p && [e.a, e.b].some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.7); })();
  if (e && e.kind === 'wall' && !S.sheet.raised && !S.ink && !nearEnd) {
    if (RENDERED.mode === 'plan') { const [u, v] = toVB(ev); const L = SC.wallLen(e); const t = clamp(((u - e.a[0]) * (e.b[0] - e.a[0]) + (-v - e.a[1]) * (e.b[1] - e.a[1])) / L, 0.6, L - 0.6); M.openings.push({ id: `o-${uid++}`, name: `Door ${uid - 1}`, host: e.id, at: t, w: 1.0, h: 2.2, sill: 0 }); commit('Ink door'); S.sel = M.openings.at(-1).id; toast('Read as a door in ' + e.name + ' · Dimensions for exact size'); return render(); }
    const h0 = wallHit(e, ev); const sr = $('#stage').getBoundingClientRect(); D = { kind: 'inkOpen', wall: e, a: h0, aPx: [ev.clientX - sr.left, ev.clientY - sr.top] }; return;
  }
  const h = S.sheet.raised ? S.sheet.h : 0; const p0 = onPlane(ev, h); if (!p0) return toast('Ink draws on Plan, 3D, eye level or a wall laid flat.', true);
  const p = snapPt(p0).p;
  if (S.inkTip === 'line') {
    if (!S.ink) S.ink = { pts: [p], h };
    else { const first = S.ink.pts[0]; const q = ev.shiftKey ? snapAngle(S.ink.pts.at(-1), p) : p; if (S.ink.pts.length > 2 && Math.hypot(q[0] - first[0], q[1] - first[1]) < 0.5) return finishInk(S.ink.pts, true); S.ink.pts.push(q); if (ev.detail === 2) return finishInk(S.ink.pts, false); }
    return renderOverlay();
  }
  if (S.inkTip === 'round') return toast('Round reads as one curved wall — not modelled in this wireframe.', true);
  D = { kind: S.inkTip === 'box' ? 'inkBox' : 'inkSketch', h, a: p }; S.ink = { pts: [p], h }; renderOverlay();
}
function placeAt(ev, hid) {
  const a = S.placing; const e = ent(hid);
  if (a.kind === 'artwork') {
    if (!e || e.kind !== 'wall') return toast('Artworks go on a wall face — hover a wall.', true);
    const t = RENDERED.mode === 'unroll' ? null : wallHit(e, ev); if (!t) return;
    const id = `a-${uid++}`; M.artworks.push({ id, name: a.name, host: e.id, at: clamp(t.t, a.w / 2, SC.wallLen(e) - a.w / 2), w: a.w, h: a.h, c: 1.6 }); commit(`Place ${a.name}`); S.sel = id; return render();
  }
  const p = onPlane(ev, 0); if (!p) return; const q = snapPt(p, { noEnds: true }).p;
  const id = a.importId ? `i-${uid++}` : `b-${uid++}`;
  const rec = { id, name: a.name, kind: a.kind, x: q[0], y: q[1], w: a.w, d: a.d, h: a.h, rot: 0, z: 0, scalable: a.kind === 'sculpture' };
  if (a.importId) { rec.tris = '18k'; M.imports.push(rec); } else M.objects.push(rec);
  commit(`Place ${a.name}`); S.sel = id; render();
}
function startHandle(h, ev) {
  const e = ent(S.sel); const uv = toVB(ev);
  if (h === 'es-ridge') { D = { kind: 'esRidge', id: e?.id || S.editShape.id, sy: ev.clientY }; return; }
  if (h === 'move') { D = { kind: 'move', id: e.id, start: uv }; return; }
  if (h === 'slide') { D = { kind: 'slide', id: e.id, h0: wallHit(SC.wallById(M, e.host), ev) }; return; }
  D = { kind: 'h-' + h, id: e.id, start: uv, sx: ev.clientX, sy: ev.clientY, orig: clone(findRaw(e.id)) };
}
function stageMove(ev) {
  const uv = toVB(ev);
  if (!D) {
    // hover feedback (cheap: only Stage)
    const hid = ev.target.closest?.('#world [data-id]')?.dataset.id || null;
    let changed = hid !== S.hover; S.hover = hid;
    if (S.tool === 'ink' && S.ink && S.inkTip === 'line') { const p = onPlane(ev, S.ink.h); if (p) { S.ink.cursor = ev.shiftKey ? snapAngle(S.ink.pts.at(-1), snapPt(p).p) : snapPt(p).p; const d = Math.hypot(...SC.sub(S.ink.cursor, S.ink.pts.at(-1))); S.ink.tag = `${f2(d)} m`; } renderOverlay(); }
    if (S.tool === 'ink' && !S.ink) { const e = ent(hid); const s = e && e.kind === 'wall' && !S.sheet.raised ? { text: `On ${e.name} face · stroke → opening`, cls: 'wall', ic: 'face' } : null; if (JSON.stringify(s) !== JSON.stringify(S.inkSurface || null)) { S.inkSurface = s; renderLower(); } }
    if (S.tool === 'measure' && S.meas && S.meas.a && !S.meas.b) { const p = onPlane(ev, 0); if (p) { S.meas.cursor = snapPt(p).p; renderOverlay(); } }
    if (S.tool === 'place' && S.placing) placeGhost(ev, hid);
    if (S.tool === 'eraser' && S.eraseMode === 'tap') { S.marked = hid && passFilter(hid) ? new Set([hid]) : new Set(); changed = true; }
    if (changed) { renderStage(); if (S.lens === 'world') document.querySelectorAll('.irow[data-hover]').forEach((r) => r.classList.toggle('hl', r.dataset.hover === hid)); }
    return;
  }
  const dx = ev.clientX - (D.sx ?? ev.clientX), dy = ev.clientY - (D.sy ?? ev.clientY);
  if (D.kind === 'pan') { const cs = camState(); cs.pan = [D.pan0[0] - dx / V.k, D.pan0[1] - dy / V.k]; D.moved = true; return renderStage(); }
  if (D.kind === 'orbit') { if (Math.abs(dx) > 3) D.moved = true; if (!D.moved) return; if (RENDERED.mode === 'solid' && S.reading === '3d') { S.az = D.az0 - dx * 0.35; renderStage(); } return; }
  if (D.kind === 'aim' || D.kind === 'aimEye') { const pos = D.kind === 'aim' ? S.lookThrough.pos : S.eye.pos; const d = SC.sub(D.t0, pos); const ang = -dx * 0.005; const c = Math.cos(ang), s = Math.sin(ang); const nt = SC.add(pos, [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2] - dy * 0.02]); if (D.kind === 'aim') { S.lookThrough.target = nt; S.lookThrough.dirty = true; } else S.eye.target = nt; return renderStage(); }
  if (D.kind === 'inkSketch') { const p = onPlane(ev, D.h); if (p) { const last = S.ink.pts.at(-1); if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.08) S.ink.pts.push(p); } return renderOverlay(); }
  if (D.kind === 'inkBox') { const p = onPlane(ev, D.h); if (!p) return; const b = snapPt(p, { noEnds: true }).p, a = D.a; S.ink.pts = [a, [b[0], a[1]], b, [a[0], b[1]]]; S.ink.tag = `${f2(Math.abs(b[0] - a[0]))} × ${f2(Math.abs(b[1] - a[1]))} m`; return renderOverlay(); }
  if (D.kind === 'inkOpen') { const b = wallHit(D.wall, ev); D.b = b; const r = $('#stage').getBoundingClientRect(); S.ink = { pts: [], opening: { px: [D.aPx[0], D.aPx[1], ev.clientX - r.left, ev.clientY - r.top], label: `${f2(Math.abs(b.t - D.a.t))} × ${f2(Math.abs(b.z - D.a.z))} m on ${D.wall.name}` } }; return renderOverlay(); }
  if (D.kind === 'inkOpenFlat') { D.b = uv; const a = toPx(D.a), b = toPx(uv); S.ink = { pts: [], opening: { px: [a[0], a[1], b[0], b[1]], label: `${f2(Math.abs(uv[0] - D.a[0]))} × ${f2(Math.abs(uv[1] - D.a[1]))} m` } }; return renderOverlay(); }
  if (D.kind === 'slice') { let p = onPlane(ev, 0); if (!p) return; if (S.snap) p = snapAngle(D.a, p); D.b = p; D.bPx = CAM.P([...p, 0]).slice(0, 2); D.aPx = CAM.P([...D.a, 0]).slice(0, 2); return renderOverlay(); }
  if (D.kind === 'lasso' || D.kind === 'scrub') { S.lassoPoly.push(uv); if (D.kind === 'scrub') { const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#world [data-id]'); if (el && passFilter(el.dataset.id)) S.marked.add(el.dataset.id); renderStage(); } else { markFromLasso(); renderStage(); } return; }
  if (D.kind === 'newview') { D.cur = uv; return renderOverlay(); }
  if (D.kind === 'pathpt') { const p = onPlane(ev, 0); if (p) { guide().edges[D.i].pts[D.j] = p; renderStage(); } return; }
  if (D.kind === 'move') {
    const e = findRaw(D.id); const p = onPlane(ev, 0), p0 = CAM.onPlane ? CAM.onPlane(D.start[0], D.start[1], 0) : null; if (!p || !p0) return;
    if (!D.orig) D.orig = clone(e); D.moved = true;
    const q = [D.orig.x + p[0] - p0[0], D.orig.y + p[1] - p0[1]]; const s = S.snap ? [Math.round(q[0] * 4) / 4, Math.round(q[1] * 4) / 4] : q;
    e.x = s[0]; e.y = s[1];
    // nearest wall distance as a read-at-the-gesture tag, with a guide line
    let best = null; for (const w of M.walls) { const L = SC.wallLen(w); const t = clamp(((e.x - w.a[0]) * (w.b[0] - w.a[0]) + (e.y - w.a[1]) * (w.b[1] - w.a[1])) / L, 0, L); const P = SC.wallPoint(w, t); const d = Math.hypot(P[0] - e.x, P[1] - e.y); if (!best || d < best.d) best = { d, P, w }; }
    const a = wpx([e.x, e.y, 0.02]), b = best && wpx([...best.P, 0.02]);
    D.guide = a && b ? `<line class="guide-l" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>` : '';
    D.tag = a ? { x: a[0] + 14, y: a[1] + 26, text: best ? `${f2(best.d)} m to ${best.w.name}` : `${f2(e.x)}, ${f2(e.y)}` } : null;
    return renderStage();
  }
  if (D.kind === 'slide') {
    const e = findRaw(D.id); const w = SC.wallById(M, e.host); if (!w) return; if (!D.orig) D.orig = clone(e);
    const hit = wallHit(w, ev), h0 = D.h0;
    D.moved = true; let at = D.orig.at + (hit.t - h0.t); if (S.snap) at = Math.round(at * 10) / 10;
    const L = SC.wallLen(w); const okA = at - e.w / 2 >= 0.1 && at + e.w / 2 <= L - 0.1;
    const others = (e.c != null ? M.artworks : M.openings).filter((o) => o.host === e.host && o.id !== e.id);
    const clash = others.find((o) => Math.abs(o.at - at) < (o.w + e.w) / 2 + 0.05);
    const px = wpx([...SC.wallPoint(w, clamp(at, 0, L)), e.c ?? e.sill + e.h]);
    if (!okA || clash) { D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: !okA ? `${f2(at)} m — past the wall end` : `overlaps ${clash.name}`, refuse: true } : null; return renderOverlay(); }
    e.at = at; D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: `${f2(at)} m along ${w.name}` } : null; return renderStage();
  }
  if (D.kind === 'h-rotate') { const e = findRaw(D.id); const c = wpx([e.x, e.y, 0]); const r = $('#stage').getBoundingClientRect(); const a = Math.atan2(ev.clientY - r.top - c[1], ev.clientX - r.left - c[0]); if (D.a0 == null) { D.a0 = a; } let rot = D.orig.rot - ((a - D.a0) * 180) / Math.PI * (CAM.kind === 'plan' ? 1 : 1); if (!ev.altKey) rot = Math.round(rot / 15) * 15; e.rot = ((rot % 360) + 360) % 360; D.moved = true; D.tag = { x: c[0] + 20, y: c[1] - 20, text: `${Math.round(e.rot)}°${ev.altKey ? ' free' : ''}` }; return renderStage(); }
  if (D.kind === 'h-size') { const e = findRaw(D.id); const k = clamp(1 - dy / 160, 0.4, 2.5); e.h = +(D.orig.h * k).toFixed(2); e.w = +(D.orig.w * k).toFixed(2); e.d = +(D.orig.d * k).toFixed(2); D.moved = true; const p = wpx([e.x, e.y, e.h]); D.tag = p ? { x: p[0] + 18, y: p[1], text: `${f2(e.h)} m tall · ×${k.toFixed(2)}` } : null; return renderStage(); }
  if (D.kind === 'h-top') {
    const w = findRaw(D.id); const sc = CAM.kind === 'axo' ? Math.cos((32 * Math.PI) / 180) : 1; let z = D.orig.top - dy / V.k / sc;
    const nd = M.datums.find((d) => Math.abs(d.z - z) < 0.15); if (nd && !ev.altKey) z = nd.z; else if (S.snap) z = Math.round(z * 20) / 20;
    const need = Math.max(0.5, ...M.openings.filter((o) => o.host === w.id).map((o) => o.sill + o.h + 0.05));
    const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; const p = wpx([...mid, Math.max(z, need)]);
    if (z < need) { D.tag = p ? { x: p[0] + 16, y: p[1], text: `${f2(z)} refused — ${M.openings.find((o) => o.host === w.id && o.sill + o.h + 0.05 > z)?.name || 'opening'} needs ${f2(need)}`, refuse: true } : null; return renderOverlay(); }
    w.top = +z.toFixed(2); D.moved = true; D.tag = p ? { x: p[0] + 16, y: p[1], text: `${f2(z)}${nd && !ev.altKey ? ' · ' + nd.name : ''}` } : null; return renderStage();
  }
  if (D.kind === 'h-end-a' || D.kind === 'h-end-b') { const w = findRaw(D.id); const p = onPlane(ev, w.base); if (!p) return; const q = snapPt(p).p; const key = D.kind.endsWith('a') ? 'a' : 'b'; w[key] = q; D.moved = true; const px = wpx([...q, 0]); D.tag = px ? { x: px[0] + 12, y: px[1] - 12, text: `${SC.wallLen(w).toFixed(2)} m` } : null; return renderStage(); }
  if (D.kind === 'h-push') { const w = findRaw(D.id); const p = onPlane(ev, 0), p0 = CAM.onPlane(D.start[0], D.start[1], 0); if (!p || !p0) return; const L = SC.wallLen(D.orig); const n = [-(D.orig.b[1] - D.orig.a[1]) / L, (D.orig.b[0] - D.orig.a[0]) / L]; let s = (p[0] - p0[0]) * n[0] + (p[1] - p0[1]) * n[1]; if (S.snap) s = Math.round(s * 10) / 10; w.a = [D.orig.a[0] + n[0] * s, D.orig.a[1] + n[1] * s]; w.b = [D.orig.b[0] + n[0] * s, D.orig.b[1] + n[1] * s]; D.moved = true; const px = wpx([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, 0]); D.tag = px ? { x: px[0] + 14, y: px[1] + 20, text: `moved ${f2(s)} m · connected walls would follow` } : null; return renderStage(); }
  if (D.kind === 'h-ridge' || D.kind === 'esRidge') {
    const r = findRaw(D.id); if (!D.orig) D.orig = clone(r); const k = D.kind === 'esRidge' ? 0.02 : 1 / V.k / Math.cos((32 * Math.PI) / 180);
    let z = D.orig.ridge - dy * k; if (r.ridge === r.eave && D.kind === 'h-ridge') { z = Math.max(1, z); r.eave = z; r.ridge = z; } else { z = Math.max(r.eave, z); const pitch = (Math.atan((z - r.eave) / ((r.y1 - r.y0) / 2)) * 180) / Math.PI; const det = [30, 45, 60].find((d) => Math.abs(d - pitch) < 2.5); if (det && !ev.altKey) z = r.eave + Math.tan((det * Math.PI) / 180) * ((r.y1 - r.y0) / 2); r.ridge = +z.toFixed(2); D.det = det; }
    D.moved = true; const p = wpx([(r.x0 + r.x1) / 2 || 0, (r.y0 + r.y1) / 2 || 0, r.ridge]);
    D.tag = p && D.kind === 'h-ridge' ? { x: p[0] + 18, y: p[1] - 14, text: `ridge ${f2(r.ridge)}${D.det ? ` · ${D.det}°` : ''}` } : null;
    if (D.kind === 'esRidge') { renderStage(); const pad = document.querySelector('.pad'); if (pad) pad.innerHTML = sectionPad(r); return; }
    return renderStage();
  }
}
function stageUp(ev) {
  const d = D; D = null; if (!d) return;
  if (d.kind === 'orbit' || d.kind === 'pan') { if (!d.moved && d.clear) { selectId(null); S.readChip = null; render(); } return; }
  if (d.kind === 'inkSketch') { let pts = simplify(S.ink.pts, 0.35).map((p) => snapPt(p).p); const closed = pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.9; if (closed) pts = pts.slice(0, -1); return finishInk(pts, closed); }
  if (d.kind === 'inkBox') { const pts = S.ink.pts; if (pts.length < 4 || SC.polyArea(pts) < 0.5) { S.ink = null; return render(); } return finishInk(pts, true); }
  if (d.kind === 'inkOpen' || d.kind === 'inkOpenFlat') {
    S.ink = null; let o;
    if (d.kind === 'inkOpen') { if (!d.b) return render(); const t0 = Math.min(d.a.t, d.b.t), t1 = Math.max(d.a.t, d.b.t), z0 = Math.min(d.a.z, d.b.z), z1 = Math.max(d.a.z, d.b.z); o = { host: d.wall.id, at: (t0 + t1) / 2, w: Math.max(0.6, t1 - t0), h: Math.max(0.6, z1 - z0), sill: z0 < 0.3 ? 0 : z0 }; }
    else { if (!d.b) return render(); const t0 = Math.min(d.a[0], d.b[0]) - d.u0, t1 = Math.max(d.a[0], d.b[0]) - d.u0, z1 = -Math.min(d.a[1], d.b[1]), z0 = -Math.max(d.a[1], d.b[1]); o = { host: d.wall.id, at: (t0 + t1) / 2, w: Math.max(0.4, t1 - t0), h: Math.max(0.4, z1 - Math.max(0, z0)), sill: z0 < 0.3 ? 0 : z0 }; }
    if (S.snap) { o.at = Math.round(o.at * 20) / 20; o.w = Math.round(o.w * 20) / 20; o.h = Math.round(o.h * 20) / 20; o.sill = Math.round(o.sill * 20) / 20; }
    const w = SC.wallById(M, o.host); if (o.sill + o.h > w.top - 0.05) return toast(`Refused: an opening ${f2(o.sill + o.h)} m tall doesn't fit under ${w.name}'s top (${f2(w.top)}).`, true), render();
    const kind = o.sill === 0 ? 'Door' : 'Window'; M.openings.push({ id: `o-${uid++}`, name: `${kind} ${uid - 1}`, ...o }); commit(`Ink ${kind.toLowerCase()}`); S.sel = M.openings.at(-1).id; toast(`Read as ${kind.toLowerCase()} ${f2(o.w)} × ${f2(o.h)} m in ${w.name}`); return render();
  }
  if (d.kind === 'slice') { if (d.b && Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) > 1) { const dir = SC.norm(SC.sub(d.b, d.a)); S.slice = { a: SC.sub(d.a, SC.mul(dir, 30)), b: SC.add(d.b, SC.mul(dir, 30)), flip: false }; } return render(); }
  if (d.kind === 'lasso' || d.kind === 'scrub') { if (d.kind === 'lasso') markFromLasso(); if (S.marked.size) S.instrument = { kind: 'erase' }; S.lassoPoly = d.kind === 'lasso' ? S.lassoPoly : null; return render(); }
  if (d.kind === 'newview') { const b = onPlane({ clientX: ev.clientX, clientY: ev.clientY }, 0); if (!b || Math.hypot(b[0] - d.a[0], b[1] - d.a[1]) < 0.5) return render(); const id = `v-${uid++}`; M.views.push({ id, name: `View ${uid - 1}`, pos: [...d.a, 1.6], target: [...b, 1.4], lens: 40 }); let p = pres(S.sel) || M.presentations.find((pp) => pp.views.includes(S.sel)); if (!p) { p = { id: `p-${uid++}`, name: 'Untitled presentation', views: [], def: id, subject: null }; M.presentations.push(p); } p.views.push(id); commit('Place View'); S.sel = id; return render(); }
  if (d.kind === 'pathpt') { commit('Move path point'); return render(); }
  if (d.kind.startsWith('h-') || d.kind === 'move' || d.kind === 'slide' || d.kind === 'esRidge') {
    if (d.moved) { const e = ent(d.id); commit(`${d.kind === 'h-rotate' ? 'Turn' : d.kind === 'h-top' ? 'Raise' : d.kind === 'h-size' ? 'Size' : d.kind.includes('ridge') || d.kind === 'esRidge' ? 'Reshape' : 'Move'} ${e?.name || ''}`); }
    return render();
  }
}
function placeGhost(ev, hid) {
  const a = S.placing; const e = ent(hid);
  if (a.kind === 'artwork') {
    if (e && e.kind === 'wall' && RENDERED.mode !== 'plan') { const t = wallHit(e, ev); const pts = [[t.t - a.w / 2, 1.6 - a.h / 2], [t.t + a.w / 2, 1.6 - a.h / 2], [t.t + a.w / 2, 1.6 + a.h / 2], [t.t - a.w / 2, 1.6 + a.h / 2]].map(([s, z]) => wpx([...SC.wallPoint(e, s), z])); S.placing.ghost = { px: pts, label: `on ${e.name}` }; }
    else { const r = $('#stage').getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top; S.placing.ghost = { px: [[x - 20, y - 14], [x + 20, y - 14], [x + 20, y + 14], [x - 20, y + 14]], bad: true, label: 'needs a wall face' }; }
    return renderOverlay();
  }
  const p = onPlane(ev, 0); if (!p) return; const q = snapPt(p, { noEnds: true }).p;
  const pts = [[-a.w / 2, -a.d / 2], [a.w / 2, -a.d / 2], [a.w / 2, a.d / 2], [-a.w / 2, a.d / 2]].map(([u, v]) => wpx([q[0] + u, q[1] + v, 0]));
  if (pts.some((x) => !x)) return;
  S.placing.ghost = { px: pts, label: roomOf({ kind: 'object', x: q[0], y: q[1] })?.name || 'outside' }; renderOverlay();
}
function lookThrough(id) { const v = view(id); S.lookThrough = { id, pos: [...v.pos], target: [...v.target], dirty: false }; S.sel = id; renderAll(true); }

// ---------------- click delegation for chrome ----------------
function onClick(ev) {
  const wf = ev.target.closest('[data-wf]');
  if (wf) {
    const k = wf.dataset.wf, v = wf.dataset.v;
    if (k === 'journey') { const j = JOURNEYS.find((x) => x.id === v); j.setup(); S.journey = v; S.coachMin = false; }
    if (k === 'cmp') { S.cmp[wf.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; }
    if (k === 'width') S.width = v;
    $('#wfmenu').style.display = 'none'; $('#wfmenu').dataset.kind = ''; render(); return;
  }
  const wb = ev.target.closest('[data-wfbar]'); if (wb) return wfMenu(wb.dataset.wfbar, wb);
  if (!ev.target.closest('#wfmenu')) { $('#wfmenu').style.display = 'none'; $('#wfmenu').dataset.kind = ''; }
  const b = ev.target.closest('[data-act]'); if (!b) { if (S.ctx && !ev.target.closest('.ctx')) { S.ctx = null; renderFloat(); } return; }
  if (b.closest('#stage') && b.closest('#world')) return;
  const a = b.dataset.act, v = b.dataset.v, id = b.dataset.id;
  if (S.ctx && !b.closest('.ctx')) S.ctx = null;
  const A = {
    noop() { toast('Not in this wireframe.'); },
    lens() { if (S.lens === v) return; parkWorld(); S.lens = v; S.tool = 'select'; S.instrument = null; S.readChip = null; },
    undo, redo,
    preview() { S.preview = { i: 0, mode: 'guided', from: { lens: S.lens, sel: S.sel, reading: S.reading } }; },
    pvexit() { S.preview = null; },
    pvnav() { S.preview.i = clamp(S.preview.i + +v, 0, guide().stops.length - 1); S.preview.pos = null; S.preview.target = null; },
    pvmode() { S.preview.mode = v; },
    appmenu() { toast('App menu: Settings (Reduce motion, Motion speed), Keys, Hide side panels.'); },
    indexclose() { S.indexOpen = false; }, indexopen() { S.indexOpen = true; }, indexsheet() { S.indexSheet = !S.indexSheet; },
    cardsheet() { S.cardSheet = !S.cardSheet; },
    sel() { if (id.startsWith('s') && guide().stops.some((s) => s.id === id)) { /* stop */ } selectId(id, { openCard: true }); if (S.narrow !== 'wide') S.indexSheet = false; if (ev.detail === 2 && view(id)) return lookThrough(id); },
    deselect() { selectId(null); },
    place() { S.place = id || null; S.placeLocked = !!id; },
    untray() { const t = M.tray.splice(+b.dataset.i, 1)[0]; const { coll, ...rest } = t; if (!SC.wallById(M, rest.host)) { M.tray.splice(+b.dataset.i, 0, t); return toast(`${rest.name}'s wall is gone — choose a new host (not in this wireframe).`, true); } M[coll].push(rest); commit(`Put back ${rest.name}`); },
    tool() { if (v === 'select' && S.tool === 'select') { S.paint = null; S.placing = null; } setTool(v); },
    overflow() { S.overflow = !S.overflow; },
    opt() { S[b.dataset.k] = v; if (b.dataset.k === 'eraseMode') { S.marked.clear(); S.lassoPoly = null; if (S.instrument?.kind === 'erase') S.instrument = null; } if (b.dataset.k === 'sliceMode') S.slice = null; },
    efilter() { S.eraseFilter[v] = !S.eraseFilter[v]; if (S.eraseMode === 'lasso' && S.lassoPoly) markFromLasso(); else S.marked = new Set([...S.marked].filter(passFilter)); if (!S.marked.size && S.instrument?.kind === 'erase') S.instrument = null; },
    viewpop() { S.viewPop = !S.viewPop; S.sheetPop = false; },
    sheetpop() { S.sheetPop = !S.sheetPop; S.viewPop = false; },
    reading() { if (v === 'section' && !S.slice) return; S.look = null; S.lift = false; if (S.instrument?.kind === 'look') S.instrument = null; S.reading = v; S.viewPop = false; S.lookThrough = null; return renderAll(true); },
    elevface() { ev.stopPropagation(); S.reading = 'elev'; S.elevFace = v; S.look = null; S.viewPop = false; return renderAll(true); },
    appearance() { S.appearance = v; return renderAll(true); }, projection() { S.projection = v; S.reading = '3d'; return renderAll(true); },
    turn() { S.az += +v; },
    overhead() { S.overhead = v; },
    grid() { S.grid = !S.grid; }, snap() { S.snap = !S.snap; }, scale() { toast('Scale detents 1:50 · 1:100 · 1:200 and Fit all (Camera framing requests).'); },
    zoom() { camState().z *= +v; }, fit() { const c = camState(); c.z = 1; c.pan = [0, 0]; },
    railclose() { S.railOpen = false; }, railopen() { S.railOpen = true; if (S.narrow === 'phone') toast('Phone: the heights rail opens as a sheet (not drawn in this wireframe).'); if (S.reading === 'plan') { S.reading = '3d'; } },
    todatum() { setSheet(datum(id).z); S.sheetPop = false; },
    focus() { S.focus = !S.focus; },
    sheetaway() { S.sheet = { h: 0, raised: false }; if (S.tool === 'ink' && !S.ink) setTool('select'); S.focus = false; },
    namedatum() { const n = `Height ${f2(S.sheet.h)}`; M.datums.push({ id: `d-${uid++}`, name: n, z: S.sheet.h }); M.datums.sort((p, q) => p.z - q.z); commit(`Name height ${n}`); toast(`Named “${n}” — Ink and handles now snap to it`); },
    cardlook() { S.cardLook = !S.cardLook; }, carddetails() { S.cardDetails = !S.cardDetails; },
    look() { return startLook(v); },
    putback() { return putBack(); }, lift() { S.lift = !S.lift; },
    dims() { S.instrument = { kind: 'dims' }; setTimeout(() => document.querySelector('.inst input.num:not([readonly])')?.focus(), 30); },
    dimfix() { const f = S.instrument.refuse.fix; applyDim(f.k, f.v); return; },
    repair() { S.instrument = { kind: 'repair' }; },
    repairposts() { M.loose = M.loose.filter((l) => l.id !== S.sel); const r = findRaw(S.sel); [[r.x0 + 0.4, r.y0 + 0.4], [r.x1 - 0.4, r.y0 + 0.4], [r.x1 - 0.4, r.y1 - 0.4], [r.x0 + 0.4, r.y1 - 0.4]].forEach((p, i) => M.objects.push({ id: `post-${uid++}`, name: `Post ${i + 1}`, kind: 'object', x: p[0], y: p[1], w: 0.25, d: 0.25, h: r.eave, rot: 0, z: 0 })); commit('Add 4 posts'); S.instrument = null; },
    repairok() { M.loose = M.loose.filter((l) => l.id !== S.sel); commit('Accept loose end'); S.instrument = null; },
    instclose() { closeInstrument(); },
    find() { S.instrument = { kind: 'find' }; S.findQ = b.dataset.q || ''; setTimeout(() => $('#findin')?.focus(), 20); },
    searchsubjects() { S.search = b.dataset.q; S.indexOpen = true; S.instrument = null; },
    cap() { S.ctx = null; return runCap(v); },
    ctxcard() { const r = b.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(); S.ctx = { id: S.sel, x: r.left - sr.left - 200, y: r.bottom - sr.top + 4 }; renderFloat(); return; },
    rename() {
      // the name is the Card's one writable fact: edit it in place
      const e = selEntity(); const raw = findRaw(e.id) || view(e.id) || pres(e.id); if (!raw) return;
      b.contentEditable = 'true'; b.focus(); document.getSelection().selectAllChildren(b);
      const done = (ok) => { b.removeEventListener('keydown', key); b.removeEventListener('blur', blur); const n = b.textContent.trim(); if (ok && n && n !== raw.name) { raw.name = n; commit(`Rename to ${n}`); } render(); };
      const key = (k) => { if (k.key === 'Enter') { k.preventDefault(); done(true); } if (k.key === 'Escape') { k.stopPropagation(); done(false); } };
      const blur = () => done(false);
      b.addEventListener('keydown', key); b.addEventListener('blur', blur); return null;
    },
    reread() { return reread(+b.dataset.i); },
    assets() { S.instrument = S.instrument?.kind === 'assets' ? null : { kind: 'assets', tab: 'objects', broad: true }; },
    atab() { S.instrument.tab = v; },
    pick() { const [n, k, w, d, hh] = ASSETS[b.dataset.tab][+b.dataset.i]; S.placing = { name: n, kind: k, w, d, h: hh }; S.tool = 'place'; S.instrument = null; },
    pickimport() { const im = M.imports.find((x) => x.id === id) || S.instrument?.pending; S.placing = { name: 'Boat hull', kind: 'import', w: 4.2, d: 1.4, h: 1.1, importId: true }; S.tool = 'place'; S.instrument = null; },
    pickmat() { const [n, c] = ASSETS.materials[+b.dataset.i]; S.paint = { name: n, color: c }; S.tool = 'paint'; S.instrument = null; },
    mockimport() { S.instrument.imported = 'pending'; toast('Imported Boat hull.glb — fixed geometry'); },
    'erase-apply': eraseApply,
    'erase-cancel'() { S.marked.clear(); S.instrument = null; S.lassoPoly = null; },
    'erase-orphans'() { const removedWalls = new Set([...S.marked].filter((x) => ent(x)?.kind === 'wall')); [...M.openings, ...M.artworks].filter((o) => removedWalls.has(o.host)).forEach((o) => S.marked.add(o.id)); },
    'slice-flip'() { S.slice.flip = !S.slice.flip; return renderAll(true); }, 'slice-clear'() { S.slice = null; if (S.reading === 'section') S.reading = '3d'; return renderAll(true); },
    'es-preview'() { S.editShape.preview = !S.editShape.preview; }, 'es-face'() { const r = ent(S.editShape.id); S.reading = 'elev'; S.elevFace = 'W'; toast('Facing the section (elevation W) — Camera request in production'); return renderAll(true); },
    'es-preset'() { const r = findRaw(S.editShape.id); if (v === 'flat') r.ridge = r.eave; if (v === 'gable') { r.ridge = r.eave + 2.4; delete r.asym; } if (v === 'raked') { r.ridge = r.eave + 1.8; r.asym = 0.15; } if (v === 'vault') { r.ridge = r.eave + 1.6; toast('Vault reads as a curved section — drawn as a gable in this wireframe.'); } commit(`Reshape ${r.name}`); },
    // Experience
    guide() { S.guideOpen = !S.guideOpen; if (!S.guideOpen) { S.playing = false; S.follow = false; if (S.sel && expEnt(S.sel) && ['stop', 'edge'].includes(expEnt(S.sel).kind)) S.sel = null; } },
    play() { S.playing = !S.playing; if (S.playing) { if (S.t >= guideTimeline().total) S.t = 0; lastT = 0; raf = requestAnimationFrame(tick); } },
    follow() { S.follow = !S.follow; return renderAll(true); },
    addstop() { const g = guide(); const p = pres(S.sel) || M.presentations[0]; g.stops.push({ id: `s${uid++}`, pres: p.id, views: [p.def], hold: 4 }); g.edges.push({ mode: 'travel', dur: 4 }); commit(`Add Stop · ${p.name}`); },
    lookthrough() { return lookThrough(id); },
    'lt-update'() { const v0 = view(S.lookThrough.id); v0.target = [...S.lookThrough.target]; commit(`Update View ${v0.name}`); S.lookThrough = null; toast(`Updated ${v0.name}`); return renderAll(true); },
    'lt-exit'() { S.lookThrough = null; return renderAll(true); },
    makedef() { const p = M.presentations.find((pp) => pp.views.includes(id)); p.def = id; commit(`Make ${view(id).name} default`); },
    capture() { return capture(); },
    newpres() { const p = { id: `p-${uid++}`, name: 'Untitled presentation', views: [], def: null, subject: null }; M.presentations.push(p); commit('New Presentation'); S.sel = p.id; toast('Empty Presentation — capture or place a View'); },
    hold() { const e = expEnt(S.sel); const s = guide().stops[e.idx]; s.hold = Math.max(1, s.hold + +v); commit('Change hold'); },
    include() { const e = expEnt(S.sel); guide().stops[e.idx].views.push(id); commit('Include View in Stop'); },
    stopnav() { const e = expEnt(S.sel); S.sel = guide().stops[e.idx + +v].id; },
    edgemode() { const e = expEnt(S.sel); guide().edges[e.idx].mode = v; commit(v === 'cut' ? 'Make Cut' : 'Make Travel'); },
    edgedur() { const e = expEnt(S.sel); const ed = guide().edges[e.idx]; ed.dur = Math.max(1, ed.dur + +v); commit('Change travel time'); },
    openexp() { parkWorld(); S.lens = 'experience'; S.sel = id; S.tool = 'select'; },
    presentthis() { return presentThis(); },
    coachmin() { S.coachMin = !S.coachMin; }, coachclose() { S.journey = null; },
  };
  const fn = A[a]; if (!fn) return;
  const r = fn(); if (r === undefined) render();
}
function presentThis() { const e = ent(S.sel); if (!e) return; const p = { id: `p-${uid++}`, name: e.name, views: [], def: null, subject: e.id }; M.presentations.push(p); commit(`Present ${e.name}`); parkWorld(); S.lens = 'experience'; S.sel = p.id; S.tool = 'select'; toast('Presentation created — capture a View of it'); render(); }
function parkWorld() { S.look = null; S.lift = false; S.slice = null; S.focus = false; S.instrument = null; S.ink = null; S.marked.clear(); S.editShape = null; S.lookThrough = null; S.placing = null; S.paint = null; S.playing = false; S.follow = false; if (S.reading === 'section') S.reading = '3d'; }
function closeInstrument() { const k = S.instrument?.kind; if (k === 'look') return putBack(); if (k === 'erase') { S.marked.clear(); S.lassoPoly = null; } if (k === 'editshape') S.editShape = null; S.instrument = null; }
function setSheet(z) {
  S.sheet.h = +z.toFixed(2); S.sheet.raised = z > 0.01;
  if (S.sheet.raised && S.tool === 'select') { setTool('ink'); toast(`Sheet at ${f2(z)}${nearestDatum(z) ? ' · ' + nearestDatum(z).name : ''} — Ink draws here`); }
  if (!S.sheet.raised && S.tool === 'ink') setTool('select');
}
function capture() {
  if (S.lens !== 'experience') return;
  const pose = S.lookThrough ? { pos: S.lookThrough.pos, target: S.lookThrough.target } : S.reading === 'eye' ? S.eye : null;
  if (!pose) { S.reading = 'eye'; toast('Compose at eye level (drag to look), then Capture.'); return renderAll(true); }
  const id = `v-${uid++}`; M.views.push({ id, name: `View ${uid - 1}`, pos: [...pose.pos], target: [...pose.target], lens: 40 });
  let p = pres(S.sel) || M.presentations.find((pp) => pp.views.includes(S.sel));
  if (!p) { p = { id: `p-${uid++}`, name: 'Untitled presentation', views: [], def: id, subject: null }; M.presentations.push(p); }
  p.views.push(id); if (!p.def) p.def = id; commit('Capture View'); S.sel = id; toast(`Captured into ${p.name}`); render();
}
function runCap(c) {
  const [k, v] = c.split(':');
  if (k === 'tool') setTool(v);
  else if (k === 'tip') { setTool('ink'); S.inkTip = v; }
  else if (k === 'reading') { S.reading = v; S.look = null; return renderAll(true); }
  else if (k === 'lift') S.lift = !S.lift;
  else if (k === 'focus') S.focus = !S.focus;
  else if (k === 'assets') { S.instrument = { kind: 'assets', tab: v, broad: true }; }
  else if (k === 'dims') S.instrument = { kind: 'dims' };
  else if (k === 'look') return startLook(v);
  else if (k === 'dup') { const e = findRaw(S.sel); const coll = M.objects.includes(e) ? 'objects' : 'artworks'; const n = { ...clone(e), id: `${e.id}-${uid++}`, name: e.name + ' copy' }; if (coll === 'objects') n.x += 1; else n.at += e.w + 0.4; M[coll].push(n); commit(`Duplicate ${e.name}`); S.sel = n.id; }
  else if (k === 'bring') { bringIntoView(S.sel); }
  else if (k === 'presentthis') return presentThis();
  else if (k === 'erase-sel') { S.tool = 'eraser'; S.marked = new Set([S.sel]); S.instrument = { kind: 'erase' }; }
  else if (k === 'proc') toast(`${{ divide: 'Divide room', floor: 'Add a floor above', cover: 'Cover rooms with a roof' }[v]} opens as an Instrument procedure (not in this wireframe).`);
  else if (k === 'grid') S.grid = !S.grid;
  else if (k === 'set') toast(v === 'keys' ? 'Keys: V P K E M A · ⌘K · 1–5 · L F · Tab · Del · Esc' : 'Reduce motion lives in App menu ▸ Settings.');
  if (S.instrument?.kind === 'find' && k !== 'assets' && k !== 'dims') S.instrument = null;
  render();
}
function bringIntoView(id) { const c = CENT[id]; if (!c) return; const cs = camState(); const cx = V.x + V.w / 2, cy = V.y + V.h / 2; cs.pan = [cs.pan[0] + c[0] - cx, cs.pan[1] + c[1] - cy]; renderStage(); }

// ---------------- keys ----------------
let spaceDown = false;
function onKey(ev) {
  if (ev.target.isContentEditable) return;
  if (ev.target.matches('input, select, textarea')) {
    if (ev.key === 'Escape') ev.target.blur();
    if (ev.key === 'Enter' && ev.target.dataset.dim) { applyDim(ev.target.dataset.dim, ev.target.value); }
    return;
  }
  const k = ev.key, mod = ev.metaKey || ev.ctrlKey;
  if (k === ' ') { if (S.lens === 'experience' && S.guideOpen) { ev.preventDefault(); $('[data-act="play"]')?.click(); } else spaceDown = true; return; }
  if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); return ev.shiftKey ? redo() : undo(); }
  if (mod && k.toLowerCase() === 'k') { ev.preventDefault(); S.instrument = { kind: 'find' }; S.findQ = ''; render(); setTimeout(() => $('#findin')?.focus(), 20); return; }
  if (k === 'Escape') return escape();
  if (k === 'Tab' && S.readChip) { ev.preventDefault(); return reread(); }
  if (k === 'Enter') { if (S.ink && S.inkTip === 'line') return finishInk(S.ink.pts, false); if (S.instrument?.kind === 'editshape') { closeInstrument(); return render(); } }
  if (S.preview) { if (k === 'ArrowRight') { S.preview.i = clamp(S.preview.i + 1, 0, guide().stops.length - 1); renderPreview(); } if (k === 'ArrowLeft') { S.preview.i = clamp(S.preview.i - 1, 0, guide().stops.length - 1); renderPreview(); } return; }
  if (mod) return;
  const tools = S.lens === 'world' ? { v: 'select', p: 'ink', k: 'slice', e: 'eraser', m: 'measure' } : { v: 'select', c: 'view', t: 'path', m: 'measure' };
  if (tools[k.toLowerCase()]) { setTool(tools[k.toLowerCase()]); return render(); }
  if (k === 'a' && S.lens === 'world') { S.instrument = S.instrument?.kind === 'assets' ? null : { kind: 'assets', tab: 'objects', broad: true }; return render(); }
  if ('12345'.includes(k) && k.length === 1) { const r = ['3d', 'plan', 'elev', 'eye', 'section'][+k - 1]; if (r === 'section' && !S.slice) return toast('Draw a Slice first (K).', true); S.reading = r; S.look = null; S.lookThrough = null; return renderAll(true); }
  if (k === 'l' && S.lens === 'world') { S.lift = !S.lift; return render(); }
  if (k === 'f' && S.lens === 'world') { S.focus = !S.focus; return render(); }
  if (k === 'd' && S.sel) { S.instrument = { kind: 'dims' }; return render(); }
  if ((k === 'Delete' || k === 'Backspace') && S.sel && ent(S.sel)) { S.tool = 'eraser'; S.marked = new Set([S.sel]); S.instrument = { kind: 'erase' }; return render(); }
  if (k === 'r' && S.sel && ent(S.sel)?.kind === 'object') { const e = findRaw(S.sel); e.rot = ((e.rot || 0) + 15) % 360; commit(`Turn ${e.name}`); return render(); }
}
function escape() {
  // unwind one applicable level at a time
  if (S.ctx) { S.ctx = null; return renderFloat(); }
  if (S.viewPop || S.sheetPop) { S.viewPop = false; S.sheetPop = false; return render(); }
  if (S.preview) { S.preview = null; return render(); }
  if (D) { D = null; M = clone(H.stack[H.i].m); S.ink = null; S.lassoPoly = null; return render(); }
  if (S.ink) { S.ink = null; return render(); }
  if (S.readChip) { S.readChip = null; return render(); }
  if (S.lookThrough) { S.lookThrough = null; return renderAll(true); }
  if (S.instrument && S.instrument.kind !== 'look') { closeInstrument(); return render(); }
  if (S.look || S.lift) return putBack();
  if (S.slice) { S.slice = null; if (S.reading === 'section') S.reading = '3d'; return renderAll(true); }
  if (S.focus) { S.focus = false; return render(); }
  if (S.follow) { S.follow = false; return renderAll(true); }
  if (S.tool !== 'select') { setTool('select'); return render(); }
  if (S.sel) { selectId(null); return render(); }
  if (S.guideOpen) { S.guideOpen = false; S.playing = false; return render(); }
  if (S.meas) { S.meas = null; return render(); }
}

// ---------------- boot ----------------
function boot() {
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });
  const st = $('#stage');
  st.addEventListener('pointerdown', stageDown);
  st.addEventListener('pointermove', stageMove);
  st.addEventListener('pointerup', stageUp);
  st.addEventListener('pointerleave', () => { if (!D && S.hover) { S.hover = null; renderStage(); } });
  st.addEventListener('contextmenu', (ev) => {
    ev.preventDefault(); if (S.lens !== 'world') return;
    const hid = ev.target.closest('#world [data-id]')?.dataset.id; const r = st.getBoundingClientRect();
    if (hid) { selectId(hid); }
    S.ctx = { id: hid || null, x: clamp(ev.clientX - r.left, 8, r.width - 250), y: clamp(ev.clientY - r.top, 8, r.height - 320) }; render();
  });
  st.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    if (S.reading === 'eye' && !S.lookThrough) { const f = SC.norm(SC.sub(S.eye.target, S.eye.pos)); const d = -ev.deltaY * 0.01; S.eye.pos = SC.add(S.eye.pos, [f[0] * d, f[1] * d, 0]); S.eye.target = SC.add(S.eye.target, [f[0] * d, f[1] * d, 0]); return renderStage(); }
    const cs = camState(); const before = toVB(ev); cs.z = clamp(cs.z * Math.exp(-ev.deltaY * 0.0015), 0.4, 8); renderStage(); const after = toVB(ev); cs.pan = [cs.pan[0] + before[0] - after[0], cs.pan[1] + before[1] - after[1]]; renderStage();
  }, { passive: false });
  // sheet handle drag
  document.addEventListener('pointerdown', (ev) => {
    const hdl = ev.target.closest('#sheethandle'); if (!hdl) return; ev.preventDefault();
    const move = (e) => { const r = $('#railscale').getBoundingClientRect(); let z = clamp((1 - (e.clientY - r.top) / r.height) * RAIL_MAX, 0, RAIL_MAX); const nd = M.datums.find((d) => Math.abs(d.z - z) < 0.2); if (nd && !e.altKey) z = nd.z; else z = Math.round(z * 20) / 20; S.sheet.h = z; S.sheet.raised = z > 0.01; renderRail(); renderStage(); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); setSheet(S.sheet.h); render(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
  // scrub bar
  document.addEventListener('pointerdown', (ev) => {
    const bar = ev.target.closest('#scrubbar'); if (!bar) return;
    const set = (e) => { const r = bar.getBoundingClientRect(); S.t = clamp((e.clientX - r.left) / r.width, 0, 1) * guideTimeline().total; S.playing = false; renderStage(); renderLower(); };
    set(ev); const up = () => { document.removeEventListener('pointermove', set); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', set); document.addEventListener('pointerup', up);
  });
  // edit-shape pad ridge drag (pad lives in the instrument)
  document.addEventListener('pointerdown', (ev) => {
    const j = ev.target.closest('#espad [data-h="es-ridge"]'); if (!j) return; ev.preventDefault();
    D = { kind: 'esRidge', id: S.editShape.id, sy: ev.clientY };
    const mv = (e) => stageMove(e); const up = (e) => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); stageUp(e); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'isearch') { S.search = ev.target.value; const pos = ev.target.selectionStart; renderIndex(); const i = $('#isearch'); i.focus(); i.setSelectionRange(pos, pos); }
    if (ev.target.id === 'exsearch') { S.exSearch = ev.target.value; const pos = ev.target.selectionStart; renderIndex(); const i = $('#exsearch'); i.focus(); i.setSelectionRange(pos, pos); }
    if (ev.target.id === 'findin') { S.findQ = ev.target.value; $('#flist').innerHTML = findList(); }
  });
  document.addEventListener('change', (ev) => { if (ev.target.dataset.role === 'inktop') { S.inkTop = ev.target.value; } });
  document.addEventListener('dblclick', (ev) => { const t = ev.target.closest('.thumb[data-id]'); if (t && view(t.dataset.id)) lookThrough(t.dataset.id); });
  new ResizeObserver(() => render()).observe($('#stage'));
  window.addEventListener('resize', () => render());
  render();
}
boot();
window.__wf = { S, get M() { return M; }, render, H };
