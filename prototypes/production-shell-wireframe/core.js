// Shared state for the production-shell wireframe (round 2).
// One mutable model object M (replaced in place on Undo / scenario change), one UI state S,
// render-time scratch R. Every mechanism is a prototype shortcut; see DESIGN-NOTE.md.
import * as SC from './scene.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const f2 = (n) => Number(n).toFixed(2);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** UI registry: modules register their render functions here so core never imports them. */
export const UI = {};
export const render = (...a) => UI.render(...a);

// ---------------- model ----------------
export const M = {};
export function loadModel(m) { for (const k of Object.keys(M)) delete M[k]; Object.assign(M, clone(m)); M.tray = M.tray || []; M.loose = M.loose || []; }
export const H = { stack: [], i: 0 };
let uidN = 100;
export const uid = (p) => `${p}-${uidN++}`;

// ---------------- UI state ----------------
export const S = {
  scenario: 'boathouse',
  lens: 'world', reading: '3d', elevFace: 'S', projection: 'axo', az: 35, overhead: 'xray',
  prefs: { topDown: 'paper' }, // application viewing preference: top-down readings settle onto paper, or keep shaded 3D
  tool: 'select', inkTip: 'sketch', sliceMode: 'through', measureMode: 'distance', eraseMode: 'scrub',
  eraseFilter: { wall: true, opening: true, object: true, artwork: true, roof: true }, eraseFilterOpen: false, palOpen: true, inkShape: false,
  brush: { type: 'paint', name: 'Clay', color: '#c98b6b', scope: 'face' }, brushPick: false,
  sel: null, hover: null, scope: { st: null, lv: null, room: null }, facet: 'all', tree: new Set(), search: '', more: {},
  indexOpen: true, indexOverlay: false, peek: false, cardMore: false,
  sheet: { h: 0, side: 'right', editing: false }, focus: false, hints: {}, hint: null,
  instrument: null, viewMore: false, appMenu: false, ctx: null, readChip: null, toast: null,
  placing: null, slice: null, look: null, lift: false, meas: null, ink: null,
  marked: new Set(), lassoPoly: null, erase: null, confirm: null,
  editShape: null, sizeOpen: null, hh: null, tickFlash: null,
  cams: {}, eye: { pos: [3.6, -4.5, 1.6], target: [6, 3, 1.5] },
  guideOpen: false, playing: false, t: 0, follow: false, lookThrough: null, preview: null,
  width: 'fill', mid: false,
  cmp: null, // set below from CMP0
  find: { q: '', open: false, idx: 0 },
  tour: null, snap: true, grid: true,
};

/** Round 2 defaults for the open choices (Wireframe ▸ Compare); the first option of each is the recommendation. */
export const CMP0 = { collapse: 'crumb', eraser: 'filter', threshold: 'simple', section: 'stage', manip: 'rays', handles: 'progressive', arch: 'rays', palCue: 'caret', pen: 'context', toolColor: true };
S.cmp = { ...CMP0 };

// ---------------- render scratch ----------------
export const R = { V: { x: 0, y: 0, w: 1, h: 1, k: 1, ox: 0, oy: 0 }, CAM: null, CENT: {}, mode: '', D: null, box: SC.WORLD_BOX };

// ---------------- lookup ----------------
export const ent = (id) => (id ? SC.find(M, id) : null);
export const view = (id) => M.views.find((v) => v.id === id);
export const pres = (id) => M.presentations.find((p) => p.id === id);
export const guide = () => M.guides[0];
export const level = (id) => M.levels.find((l) => l.id === id);
export const structure = (id) => M.structures.find((s) => s.id === id);
export const kindLabel = { wall: 'Wall', opening: 'Opening', roof: 'Roof', object: 'Object', artwork: 'Artwork', room: 'Room', import: 'Imported model', view: 'View', presentation: 'Presentation', stop: 'Stop', edge: 'Transition', level: 'Level', structure: 'Structure' };
export const kindIcon = { wall: 'wall', opening: 'opening', roof: 'roof', object: 'object', artwork: 'material', room: 'plan', import: 'import', level: 'layers', structure: 'elevation' };
export function findRaw(id) { for (const k of ['walls', 'openings', 'roofs', 'objects', 'artworks', 'rooms', 'imports']) { const x = M[k].find((e) => e.id === id); if (x) return x; } return null; }
export function collOf(id) { for (const k of ['walls', 'openings', 'roofs', 'objects', 'artworks', 'rooms', 'imports']) if (M[k].some((e) => e.id === id)) return k; return null; }

export function roomsOfWall(wid) { return M.rooms.filter((r) => r.walls.includes(wid) && SC.roomEnclosed(M, r)); }
export function roomOf(e) {
  if (!e) return null;
  if (e.kind === 'room') return e;
  if (e.kind === 'wall') return roomsOfWall(e.id)[0] || null;
  if (e.kind === 'opening' || e.kind === 'artwork') return roomOf(ent(e.host));
  if (e.kind === 'roof') return M.rooms.find((r) => (e.over || []).some((w) => r.walls.includes(w))) || null;
  if (e.kind === 'object' || e.kind === 'import') {
    const rs = M.rooms.filter((r) => r.type !== 'platform' && SC.roomEnclosed(M, r) && SC.pointInPoly([e.x, e.y], r.poly) && r.z <= (e.z || 0) + 0.05);
    return rs.sort((a, b) => b.z - a.z)[0] || null;
  }
  return null;
}
export function levelOf(e) {
  if (!e) return null;
  if (e.level) return level(e.level);
  if (e.kind === 'opening' || e.kind === 'artwork') return levelOf(ent(e.host));
  if (e.kind === 'roof') { const w = ent((e.over || [])[0]); return w ? levelOf(w) : null; }
  const r = roomOf(e); return r ? level(r.level) : null;
}
export function structureOf(e) { if (!e) return null; if (e.structure) return structure(e.structure); const l = levelOf(e); return l ? structure(l.structure) : null; }
export function wallRole(w) {
  const rs = roomsOfWall(w.id);
  if (rs.length >= 2) return `shared · ${rs.map((r) => r.name).join(' | ')}`;
  if (rs.length === 1) return `bounds ${rs[0].name}`;
  return 'free-standing';
}
export function usedIn(id) { return M.presentations.filter((p) => p.subject === id); }

// ---------------- heights: Levels, surfaces and pinned checkpoints ----------------
/** Snap candidates for the height Sheet. Levels are authored structure; surfaces are found; pins are the author's checkpoints. */
export function heightMarks() {
  const marks = [];
  const add = (z, kind, label, id) => {
    let m = marks.find((x) => Math.abs(x.z - z) < 0.02);
    if (!m) { m = { z, kinds: new Set(), labels: [], ids: [] }; marks.push(m); }
    m.kinds.add(kind); if (label && !m.labels.includes(label)) m.labels.push(label); if (id) m.ids.push(id);
  };
  for (const l of M.levels) add(l.z, 'level', `${l.name}${M.structures.length > 1 ? ' · ' + (structure(l.structure)?.name || '') : ''}`, l.id);
  for (const r of M.rooms) if (r.type === 'platform' || (r.z > 0.01 && !M.levels.some((l) => Math.abs(l.z - r.z) < 0.02))) add(r.z, 'surface', r.name, r.id);
  for (const r of M.roofs) if (r.poly || SC.roofFlat(r)) add(r.poly ? r.eave : SC.roofTop(r), 'surface', r.name, r.id);
  for (const p of M.pins) add(p.z, 'pin', p.label || 'Pinned height', p.id);
  return marks.sort((a, b) => a.z - b.z);
}
export function markAt(z, tol = 0.02) { return heightMarks().find((m) => Math.abs(m.z - z) < tol) || null; }
export function markName(m) { return m ? m.labels[0] : ''; }
export function stories() { const zs = [...new Set(M.levels.map((l) => l.z))].sort((a, b) => a - b); return zs.length ? zs : [0]; }
export function levelAt(z) { return [...M.levels].filter((l) => l.z <= z + 0.02).sort((a, b) => b.z - a.z)[0] || null; }
export function bandAt(h) { const above = heightMarks().filter((m) => m.kinds.has('level') && m.z > h + 0.05)[0]; return [h - 0.05, above ? above.z - 0.01 : h + 4.5]; }

// ---------------- history ----------------
export function resetHistory(label) { H.stack = [{ label, m: clone(M) }]; H.i = 0; }
export function commit(label) { H.stack = H.stack.slice(0, H.i + 1); H.stack.push({ label, m: clone(M) }); H.i++; }
export function amend(label) { H.stack[H.i] = { label, m: clone(M) }; }
export function liveGesture() { return !!(R.D || S.ink); }
export function undo() {
  if (liveGesture()) return toast('Undo waits: finish or cancel the gesture first (Esc).', true);
  if (H.i === 0) return;
  const lbl = H.stack[H.i].label; H.i--; loadModel(H.stack[H.i].m); afterHistory(); toast(`Undid ${lbl}`);
}
export function redo() { if (H.i >= H.stack.length - 1 || liveGesture()) return; H.i++; loadModel(H.stack[H.i].m); afterHistory(); toast(`Redid ${H.stack[H.i].label}`); }
function afterHistory() { if (S.sel && !ent(S.sel) && !UI.expEnt?.(S.sel)) S.sel = null; S.readChip = null; S.erase = null; S.marked.clear(); render(); }

// ---------------- toast ----------------
let toastTimer;
export function toast(msg, refusal = false, action) {
  S.toast = { msg, refusal, action }; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; UI.renderFloat(); }, refusal ? 3800 : action ? 4200 : 2600);
  UI.renderFloat?.();
}

// ---------------- cameras & mapping ----------------
export function camKey() { return S.look ? `look-${S.look.kind}` : S.reading === 'elev' ? `elev-${S.elevFace}` : S.reading === 'rsect' ? `rsect-${S.editShape?.id}` : S.reading + (S.reading === '3d' ? S.projection : ''); }
export function camState() { const k = camKey() + S.scenario; return S.cams[k] || (S.cams[k] = { z: 1, pan: [0, 0] }); }
export const focal = (lens) => lens * 0.889;
export function followPose() { if (!(S.lens === 'experience' && S.guideOpen && S.follow)) return null; return UI.evalGuide(S.t).pose; }
export function currentCam() {
  if (S.lookThrough) { const v = view(S.lookThrough.id); return SC.camera('persp', { pos: S.lookThrough.pos, target: S.lookThrough.target, F: focal(v.lens) }); }
  const fp = followPose(); if (fp) return SC.camera('persp', { pos: fp.pos, target: fp.target, F: focal(26) });
  const b = R.box, ctr = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 1.5], span = Math.max(b[2] - b[0], b[3] - b[1]);
  switch (S.reading) {
    case '3d': return S.projection === 'persp' ? SC.orbitPersp(S.az, 30, span * 1.5, ctr) : SC.camera('axo', { az: S.az });
    case 'plan': return SC.camera('plan');
    case 'elev': return SC.camera('elev', { face: S.elevFace });
    case 'eye': return SC.camera('persp', { pos: S.eye.pos, target: S.eye.target, F: focal(24) });
    case 'section': return sectionCam();
    case 'rsect': return roofSectionCam();
  }
  return SC.camera('axo', { az: S.az });
}
export function sliceFrame(sl = S.slice) { const d = SC.norm(SC.sub(sl.b, sl.a)); let n = [-d[1], d[0]]; if (sl.flip) n = [-n[0], -n[1]]; return { d, n }; }
/** Focused roof Section 2D: the same Camera, looking along the roof's ridge at its own section plane. */
function roofSectionCam() { const r = ent(S.editShape?.id); if (!r) return SC.camera('axo', { az: S.az }); const x = S.editShape.x ?? (r.x0 + r.x1) / 2; return SC.camera('sect', { a: [x, r.y0], d: [0, 1], n: [1, 0] }); }
function sectionCam() { const { d, n } = sliceFrame(); return SC.camera('sect', { a: S.slice.a, d, n }); }
export const isPersp = (c) => c && c.kind === 'persp';
/** Paper vs mat is a viewing preference applied per reading; it never changes the reading or the source. */
export function readingIsTopDownOrFlat() { return S.look ? true : ['plan', 'elev', 'section', 'rsect'].includes(S.reading); }
export function ground() {
  if (S.lookThrough || followPose()) return 'mat';
  if (S.look) return 'paper';
  if (readingIsTopDownOrFlat()) return S.prefs.topDown === 'paper' ? 'paper' : 'mat';
  return 'mat';
}
export function palette() { return ground() === 'mat' ? SC.PAL.mat : SC.PAL.paper; }
export const flatLines = () => ground() === 'paper';
export function toVB(ev) { const r = $('#stage').getBoundingClientRect(); const V = R.V; return [(ev.clientX - r.left - V.ox) / V.k + V.x, (ev.clientY - r.top - V.oy) / V.k + V.y]; }
export function toPx(uv) { const V = R.V; return [(uv[0] - V.x) * V.k + V.ox, (uv[1] - V.y) * V.k + V.oy]; }
export function wpx(p) { const q = R.CAM.P(p); if (q[3]) return null; return toPx(q); }
export function stagePx(ev) { const r = $('#stage').getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
export function onPlane(ev, h = 0) { const [u, v] = toVB(ev); if (!R.CAM || !R.CAM.onPlane) return null; return R.CAM.onPlane(u, v, h); }
export function snapPt(p, opts = {}) {
  if (!p) return p;
  if (!opts.noEnds) for (const w of M.walls) for (const e of [w.a, w.b]) if (Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.35) return { p: [...e], why: 'end' };
  if (!S.snap) return { p };
  const g = 0.5; return { p: [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g], why: 'grid' };
}
/** Solve a small screen-space drag for a point constrained to a world plane through `p` spanned by axes a1, a2. */
export function dragOnPlane(p, a1, a2, dpx) {
  const k = 0.01, P0 = wpx(p), P1 = wpx(SC.add(p, SC.mul(a1, k))), P2 = wpx(SC.add(p, SC.mul(a2, k)));
  if (!P0 || !P1 || !P2) return [0, 0];
  const j = [[(P1[0] - P0[0]) / k, (P2[0] - P0[0]) / k], [(P1[1] - P0[1]) / k, (P2[1] - P0[1]) / k]];
  const det = j[0][0] * j[1][1] - j[0][1] * j[1][0]; if (Math.abs(det) < 1e-6) return [0, 0];
  return [(dpx[0] * j[1][1] - dpx[1] * j[0][1]) / det, (j[0][0] * dpx[1] - j[1][0] * dpx[0]) / det];
}

/** Whether the frame currently being shown is a constrained (iPad / small laptop) width. */
export function frameWidth() { const sizes = { fill: null, laptop: 1440, small: 1280, ipadL: 1180, ipadP: 820 }; return sizes[S.width] || window.innerWidth; }
