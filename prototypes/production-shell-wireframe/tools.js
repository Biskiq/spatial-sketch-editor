// Tools: the dock, small vertical palettes above the armed tool, and what each tool does —
// Ink readings, Eraser marking and acceptance, Brush finishes, Edit shape (roof sections), Library.
import { icon } from './icons.js';
import * as SC from './scene.js';
import { $, S, M, R, UI, esc, f2, clamp, clone, ent, findRaw, collOf, kindLabel, roomOf, roomsOfWall, usedIn, heightMarks, markAt, levelAt, commit, amend, toast, wpx, uid, loadModel } from './core.js';

// ---------------- dock ----------------
export const WORLD_TOOLS = [
  ['select', 'select', 'Select', 'V', null], ['ink', 'ink', 'Ink', 'P', 'var(--t-ink)'], ['slice', 'slice', 'Slice', 'K', 'var(--t-slice)'],
  ['eraser', 'eraser', 'Eraser', 'E', 'var(--t-erase)'], ['brush', 'paint', 'Brush', 'B', 'var(--brush, #c98b6b)'], ['measure', 'measure', 'Measure', 'M', null],
];
const EXP_TOOLS = [['select', 'select', 'Select', 'V'], ['view', 'camera', 'Place a View', 'C'], ['path', 'path', 'Path', 'T']];
function toolBtn(id, ic, label, key, color, disabled = false) {
  const on = S.tool === id || (id === 'brush' && S.tool === 'brush');
  return `<span class="tslot">${on && !disabled ? paletteHtml(id) : ''}<button class="tool" data-act="tool" data-v="${id}" aria-pressed="${on}" ${disabled ? 'disabled' : ''} data-tip="${esc(label)}${key ? ` · ${key}` : ''}" aria-label="${esc(label)}">${icon(ic, 19)}${S.cmp.toolColor && color ? `<span class="sw" style="--c:${id === 'brush' ? S.brush.color : color}"></span>` : ''}</button></span>`;
}
export function dockHtml() {
  if (S.lookThrough) return '';
  let h = '<div class="dock" role="toolbar" aria-label="Tools">';
  if (S.lens === 'world') {
    h += WORLD_TOOLS.map((t) => toolBtn(...t)).join('');
    h += `<span class="dsep"></span><button class="tool lib${S.instrument?.kind === 'assets' ? ' on' : ''}" data-act="assets" aria-pressed="${S.instrument?.kind === 'assets'}" data-tip="Library · A">${icon('assets', 19)}</button>`;
  } else {
    h += EXP_TOOLS.map(([id, ic, l, k]) => toolBtn(id, ic, l, k, null, id === 'path' && !S.guideOpen)).join('');
    h += `<span class="dsep"></span><button class="tool wide pri" data-act="capture" data-tip="Capture what you see as a View">${icon('capture', 17)}<span>Capture</span></button><button class="tool wide${S.guideOpen ? ' on' : ''}" data-act="guide" aria-pressed="${S.guideOpen}" data-tip="Open the Guide">${icon('guide', 17)}<span>Guide</span></button>`;
  }
  return h + '</div>';
}

// ---------------- palettes: one icon column above the armed tool ----------------
function pbtn(act, k, v, ic, tip, on, extra = '') { return `<button data-act="${act}" ${k ? `data-k="${k}"` : ''} data-v="${v}" aria-pressed="${on}" data-tip="${esc(tip)}" aria-label="${esc(tip)}"${extra}>${icon(ic, 16)}</button>`; }
function paletteHtml(tool) {
  const col = (items, side = '') => `<div class="pcol">${items.join('')}</div>${side}`;
  const opt = (k, v, ic, tip) => pbtn('opt', k, v, ic, tip, S[k] === v);
  if (tool === 'ink') return col([`<button class="pmore" data-act="inkmore" data-tip="More pens (later: stair, arc, offset)">${icon('more', 14)}</button>`, opt('inkTip', 'round', 'round', 'Round'), opt('inkTip', 'box', 'box', 'Box'), opt('inkTip', 'line', 'line', 'Line · click points'), opt('inkTip', 'sketch', 'sketch', 'Sketch · freehand')]);
  if (tool === 'slice') return col([opt('sliceMode', 'height', 'focusHeight', 'Cut at the Sheet height'), opt('sliceMode', 'through', 'slice', 'Slice through · drag a line')]);
  if (tool === 'measure') return col([opt('measureMode', 'height', 'height', 'Height of a thing'), opt('measureMode', 'distance', 'measure', 'Distance')]);
  if (tool === 'eraser') {
    const filtered = Object.values(S.eraseFilter).some((v) => !v);
    const items = [opt('eraseMode', 'lasso', 'lasso', 'Lasso · loop around'), opt('eraseMode', 'scrub', 'scrub', 'Click or scrub')];
    if (S.cmp.eraser === 'filter') items.unshift(`<button data-act="efilteropen" aria-pressed="${S.eraseFilterOpen}" data-tip="Only erase some kinds" class="${filtered ? 'badge' : ''}">${icon('filter', 16)}</button>`);
    const fly = S.cmp.eraser === 'filter' && S.eraseFilterOpen ? `<div class="pfly" style="bottom:${(items.length - 1) * 36 + 4}px">${[['wall', 'wall', 'Walls'], ['opening', 'opening', 'Openings'], ['object', 'object', 'Objects'], ['artwork', 'material', 'Art'], ['roof', 'roof', 'Roofs']].map(([k, ic, l]) => pbtn('efilter', '', k, ic, l, S.eraseFilter[k])).join('')}</div>` : '';
    return col(items, fly);
  }
  if (tool === 'brush') {
    const b = S.brush;
    const items = [pbtn('brushscope', '', b.scope === 'face' ? 'room' : 'face', b.scope === 'face' ? 'face' : 'plan', b.scope === 'face' ? 'Paints one surface · click for whole room' : 'Paints the whole room · click for one surface', b.scope === 'room'), pbtn('opt', 'brushMode', 'pick', 'dropper', 'Pick up a finish from a surface', S.brushMode === 'pick'), `<button class="swatchbtn" data-act="brushpick" aria-expanded="${S.brushPick}" data-tip="${esc(b.name)} · ${b.type === 'material' ? 'material' : 'paint'}"><i style="background:${b.color}" class="${b.type}"></i></button>`];
    return col(items, S.brushPick ? brushPicker() : '');
  }
  if (tool === 'view') return '';
  return '';
}
const PAINTS = [['Chalk', '#efece4'], ['Clay', '#c98b6b'], ['Ochre', '#d1a447'], ['Sage', '#9db39a'], ['Forest', '#2f5a45'], ['Harbour', '#4f6f86'], ['Ink', '#2b2f33'], ['Rose', '#c9878f'], ['Sand', '#ddd0b3'], ['Slate grey', '#8b9399'], ['Brick red', '#a2543e'], ['White', '#fbfbf7']];
export const MATERIALS = [['Oak', '#b98f5a'], ['Limewash', '#ece6d6'], ['Slate', '#55626a'], ['Terrazzo', '#cfc7bb'], ['Brick', '#a2543e'], ['Zinc', '#9aa3a8']];
function brushPicker() {
  const b = S.brush;
  return `<div class="picker"><div class="ph">Paint</div><div class="sw12">${PAINTS.map(([n, c]) => `<button data-act="brushset" data-t="paint" data-n="${n}" data-c="${c}" aria-pressed="${b.type === 'paint' && b.name === n}" title="${n}" style="--c:${c}"></button>`).join('')}</div><div class="ph">Material</div><div class="mt6">${MATERIALS.map(([n, c]) => `<button data-act="brushset" data-t="material" data-n="${n}" data-c="${c}" aria-pressed="${b.type === 'material' && b.name === n}" title="${n}"><i style="--c:${c}"></i>${n}</button>`).join('')}</div><div class="pf">Paint is a colour. A material also carries texture and physical properties.</div></div>`;
}

// ---------------- Ink: the reading depends on the surface under the stroke ----------------
export function wallTopFor(h) { const up = heightMarks().filter((m) => m.kinds.has('level') && m.z > h + 0.3)[0]; return up ? up.z : h + 3; }
export function readingsFor(pts, closed, h) {
  const top = wallTopFor(h);
  const L = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) + (closed ? Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) : 0);
  const area = closed ? SC.polyArea(pts) : 0;
  const onFloor = !!markAt(h) && markAt(h).kinds.has('level');
  if (onFloor) return closed ? [{ label: 'Room', meta: `${area.toFixed(1)} m² · walls ${f2(top - h)} high`, make: 'room', top }, { label: 'Raised platform', make: 'platform', meta: '+0.45', z: h + 0.45 }, { label: 'Walls only', make: 'walls', top }] : [{ label: pts.length > 2 ? 'Wall chain' : 'Wall', meta: `${L.toFixed(1)} m`, make: 'walls', top, quiet: true }, { label: 'Low wall', make: 'walls', top: h + 1.1 }];
  return closed ? [{ label: 'Deck', meta: `at ${f2(h)} · ${area.toFixed(1)} m²`, make: 'platform', z: h }, { label: 'Canopy roof', meta: `at ${f2(h)}`, make: 'canopy' }, { label: 'Walls on this height', make: 'walls', top: h + 2.4, base: h }] : [{ label: 'Walls on this height', make: 'walls', top: h + 2.4, base: h }, { label: 'Edge rail', make: 'walls', top: h + 1.1, base: h }];
}
function applyReading(pts, closed, h, r) {
  const made = []; const lv = levelAt(h);
  if (r.make === 'room' || r.make === 'walls') {
    const ids = []; const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const id = uid('w'); M.walls.push({ id, name: `Wall ${id.slice(2)}`, a: [...pts[i]], b: [...pts[(i + 1) % pts.length]], base: r.base ?? h, top: r.top, level: lv?.id, structure: lv?.structure }); ids.push(id); }
    made.push(...ids);
    if (r.make === 'room') { const id = uid('room'); M.rooms.push({ id, name: `Room ${M.rooms.length + 1}`, type: 'room', walls: ids, poly: pts.map((p) => [...p]), z: h, level: lv?.id, structure: lv?.structure }); made.unshift(id); }
  } else if (r.make === 'platform') { const id = uid('room'); M.rooms.push({ id, name: h > 0.01 && !markAt(h)?.kinds.has('level') ? `Deck at ${f2(r.z)}` : 'Platform', type: 'platform', walls: [], poly: pts.map((p) => [...p]), z: r.z, level: lv?.id, structure: lv?.structure }); made.push(id); }
  else if (r.make === 'canopy') { const id = uid('r'); M.roofs.push({ id, name: 'Canopy', poly: pts.map((p) => [...p]), eave: h, over: [], structure: lv?.structure }); made.push(id); }
  return made[0];
}
export function finishInk(pts, closed) {
  const h = S.sheet.h;
  if (pts.length < 2) { S.ink = null; return UI.render(); }
  const readings = readingsFor(pts, closed, h);
  const before = clone(M);
  const id = applyReading(pts, closed, h, readings[0]);
  commit(`Ink ${readings[0].label.toLowerCase()}`);
  S.sel = id; const end = wpx([...pts.at(-1), h]) || [200, 200];
  // the interpretation chip appears only when the stroke could reasonably mean something else
  S.readChip = readings[0].quiet ? null : { pts, closed, h, readings, idx: 0, before, x: clamp(end[0] + 14, 8, $('#stage').clientWidth - 380), y: clamp(end[1] - 40, 50, $('#stage').clientHeight - 120) };
  S.ink = null; afterSurface(readings[0]); UI.render();
}
export function reread(i) {
  const r = S.readChip; if (!r) return; r.idx = i ?? (r.idx + 1) % r.readings.length;
  loadModel(r.before); const id = applyReading(r.pts, r.closed, r.h, r.readings[r.idx]);
  amend(`Ink ${r.readings[r.idx].label.toLowerCase()}`); S.sel = id; afterSurface(r.readings[r.idx]); UI.render();
}
/** First-use nudge: a new raised surface makes a good height checkpoint. Offered once. */
function afterSurface(r) {
  if (r.make !== 'platform' || S.hints.pin) { if (S.hint?.kind === 'pin' && r.make !== 'platform') S.hint = null; return; }
  const z = r.z; if (M.pins.some((p) => Math.abs(p.z - z) < 0.02)) return;
  S.hint = { kind: 'pin', z };
}
export function simplify(pts, eps = 0.3) {
  if (pts.length < 3) return pts;
  const d = (p, a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l; };
  let idx = -1, mx = 0; for (let i = 1; i < pts.length - 1; i++) { const v = d(pts[i], pts[0], pts.at(-1)); if (v > mx) { mx = v; idx = i; } }
  if (mx > eps) return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
  return [pts[0], pts.at(-1)];
}
export function circlePts(c, r, n = 20) { return Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i / n) * Math.PI * 2) * r, c[1] + Math.sin((i / n) * Math.PI * 2) * r]); }

// ---------------- Eraser: immediate when simple, one acceptance when bulk, review only when it matters ----------------
export function passFilter(id) {
  const e = ent(id); if (!e || e.kind === 'room') return false;
  const k = e.kind === 'import' ? 'object' : e.kind;
  if (S.cmp.eraser === 'filter' && !S.eraseFilter[k]) return false;
  if (S.eraseLock && S.eraseLock !== k) return false;
  return true;
}
export function consequences(ids) {
  const set = new Set(ids); const items = ids.map(ent).filter(Boolean);
  const walls = new Set(items.filter((e) => e.kind === 'wall').map((e) => e.id));
  const aside = [...M.openings, ...M.artworks].filter((o) => walls.has(o.host) && !set.has(o.id));
  const rooms = M.rooms.filter((r) => r.walls.length && SC.roomEnclosed(M, r) && r.walls.some((w) => walls.has(w)));
  const roofs = M.roofs.filter((r) => !set.has(r.id) && (r.over || []).some((w) => walls.has(w)));
  const riders = items.filter((e) => e.kind === 'object').flatMap((o) => ridersOf(o)).filter((x) => !set.has(x.id));
  const pres = M.presentations.filter((p) => p.subject && (set.has(p.subject) || rooms.some((r) => r.id === p.subject)));
  const by = {}; items.forEach((e) => { const k = e.kind === 'import' ? 'object' : e.kind; by[k] = (by[k] || 0) + 1; });
  return { items, by, aside, rooms, roofs, riders, pres };
}
export function needsReview(c) { return c.pres.length > 0 || (S.cmp.threshold === 'topology' && (c.aside.length || c.rooms.length || c.roofs.length || c.riders.length)); }
export function summary(c) {
  const bits = [];
  if (c.aside.length) bits.push(`${c.aside.length} hosted item${c.aside.length > 1 ? 's' : ''} set aside`);
  if (c.rooms.length) bits.push(`${c.rooms.length === 1 ? c.rooms[0].name + ' opens' : c.rooms.length + ' rooms open'}`);
  if (c.roofs.length) bits.push(`${c.roofs.length} roof${c.roofs.length > 1 ? 's' : ''} left unsupported`);
  if (c.riders.length) bits.push(`${c.riders.map((r) => r.name).join(', ')} settle${c.riders.length > 1 ? '' : 's'} down`);
  return bits;
}
/** Click erase: immediate and undoable, unless another domain depends on it. */
export function eraseNow(ids, at) {
  const c = consequences(ids);
  if (needsReview(c)) { S.confirm = { ids, x: at[0], y: at[1] }; return UI.render(); }
  eraseApply(ids);
}
/** Scrub / lasso release: small simple sets go at once; bulk previews in place with one acceptance. */
export function eraseRelease(at) {
  const ids = [...S.marked]; if (!ids.length) { S.lassoPoly = null; return UI.render(); }
  const c = consequences(ids);
  if (S.cmp.threshold === 'simple' && ids.length <= 3 && !needsReview(c)) { S.lassoPoly = null; return eraseApply(ids); }
  S.erase = { x: at[0], y: at[1], excl: new Set() }; UI.render();
}
export function eraseBarHtml() {
  const E = S.erase; if (!E) return '';
  const ids = [...S.marked]; const c = consequences(ids); const n = ids.length; const review = needsReview(c);
  const st = $('#stage'); const x = clamp(E.x + 16, 8, st.clientWidth - 340), y = clamp(E.y - 20, 56, st.clientHeight - 170);
  const kinds = Object.entries(c.by).map(([k, v]) => `${v} ${kindLabel[k].toLowerCase()}${v > 1 ? 's' : ''}`);
  const chips = S.cmp.eraser === 'context' ? `<div class="kchips">${Object.entries({ ...c.by, ...Object.fromEntries([...E.excl].map((k) => [k, 0])) }).map(([k, v]) => `<button data-act="eexcl" data-v="${k}" aria-pressed="${!E.excl.has(k)}" title="${E.excl.has(k) ? 'Include' : 'Leave out'} ${kindLabel[k].toLowerCase()}s">${icon({ wall: 'wall', opening: 'opening', object: 'object', artwork: 'material', roof: 'roof' }[k] || 'dot', 13)}${v || ''}</button>`).join('')}</div>` : `<div class="ksum">${kinds.join(' · ')}</div>`;
  const bits = summary(c);
  return `<div class="erasebar${review ? ' warn' : ''}" style="left:${x}px;top:${y}px">${chips}${bits.length ? `<div class="cq">${bits.map(esc).join(' · ')}</div>` : ''}${c.pres.length ? `<div class="cq x">${icon('warning', 13)} ${c.pres.map((p) => esc(p.name)).join(', ')} (Experience) would lose ${c.pres.length > 1 ? 'their subjects' : 'its subject'}</div>` : ''}<div class="eb"><button class="tbtn danger" data-act="erase-apply" ${n ? '' : 'disabled'}>Erase ${n}${review ? ' anyway' : ''} <span class="kbd">↵</span></button><button class="tbtn ghost" data-act="erase-cancel">Cancel</button><span class="quiet">keep stroking to add · ⌥ removes</span></div></div>`;
}
export function confirmHtml() {
  const C = S.confirm; if (!C) return ''; const c = consequences(C.ids); const e = c.items[0];
  const st = $('#stage'); const x = clamp(C.x + 14, 8, st.clientWidth - 300), y = clamp(C.y - 10, 56, st.clientHeight - 130);
  return `<div class="erasebar warn bubble" style="left:${x}px;top:${y}px"><div class="cq x">${icon('warning', 13)} ${c.pres.length ? `${esc(c.pres.map((p) => p.name).join(', '))} in Experience is about ${esc(e?.name || 'this')}` : summary(c).map(esc).join(' · ')}</div><div class="eb"><button class="tbtn danger" data-act="confirm-yes">Erase anyway</button><button class="tbtn ghost" data-act="confirm-no">Keep</button></div></div>`;
}
export function eraseApply(ids = [...S.marked]) {
  if (!ids.length) return;
  const c = consequences(ids); const set = new Set(ids); const walls = new Set(c.items.filter((e) => e.kind === 'wall').map((e) => e.id));
  for (const coll of ['openings', 'artworks']) M[coll] = M[coll].filter((o) => { if (set.has(o.id)) return false; if (walls.has(o.host)) { M.tray.push({ ...o, coll }); return false; } return true; });
  for (const r of c.riders) { const raw = findRaw(r.id); const sup = ids.map(findRaw).find((o) => o && ridersOf(o).some((x) => x.id === r.id)); if (raw && sup) raw.z = sup.z || 0; }
  for (const coll of ['walls', 'objects', 'roofs', 'imports']) M[coll] = M[coll].filter((o) => !set.has(o.id));
  for (const r of M.roofs) if ((r.over || []).some((w) => walls.has(w)) && !M.loose.some((l) => l.id === r.id)) M.loose.push({ id: r.id, msg: `${(r.over || []).filter((w) => walls.has(w)).length} supporting wall(s) erased — edges unsupported` });
  const n = ids.length; const name = n === 1 ? c.items[0]?.name : `${n} things`;
  commit(`Erase ${name}`);
  S.marked.clear(); S.erase = null; S.confirm = null; S.lassoPoly = null; S.eraseLock = null; if (S.sel && !ent(S.sel)) S.sel = null;
  const bits = summary(c); toast(`Erased ${name}${bits.length ? ' · ' + bits[0] : ''}`, false, ['Undo', 'undo']); UI.render();
}
export function markFromLasso() {
  if (!S.lassoPoly || S.lassoPoly.length < 3) return;
  const excl = S.erase?.excl || new Set();
  const inside = Object.entries(R.CENT).filter(([id, c]) => passFilter(id) && SC.pointInPoly(c, S.lassoPoly) && !excl.has(ent(id)?.kind)).map(([id]) => id);
  S.marked = new Set([...(S.lassoBase || []), ...inside]);
}

// ---------------- objects resting on objects ----------------
/** Things whose base sits on top of `o` within its footprint (a sculpture on a plinth). */
export function ridersOf(o) {
  const top = (o.z || 0) + o.h;
  return M.objects.filter((x) => x.id !== o.id && Math.abs((x.z || 0) - top) < 0.03 && Math.abs(x.x - o.x) < o.w / 2 + 0.01 && Math.abs(x.y - o.y) < o.d / 2 + 0.01);
}
export function carryRiders(o, oldH, newH) { for (const r of ridersOf({ ...o, h: oldH })) { const raw = findRaw(r.id); raw.z = (o.z || 0) + newH; carryRiders(raw, raw.h, raw.h); } }
/** Highest surface under (x, y) for an object of footprint w×d: a plinth, a platform, or the floor of its story. */
export function supportAt(x, y, self) {
  const lv = levelAt((self.z || 0) + 0.01) || levelAt(S.sheet.h); let best = { z: lv ? lv.z : 0, name: lv ? lv.name : 'ground' };
  for (const o of M.objects) { if (o.id === self.id || ridersOf(self).some((r) => r.id === o.id)) continue; const t = (o.z || 0) + o.h; if (t > best.z && t < best.z + 1.6 && Math.abs(x - o.x) < o.w / 2 && Math.abs(y - o.y) < o.d / 2 && self.w <= o.w + 0.3) best = { z: t, name: o.name }; }
  for (const r of M.rooms) if (r.type === 'platform' && r.z > best.z - 0.01 && r.z < best.z + 3 && SC.pointInPoly([x, y], r.poly)) best = { z: r.z, name: r.name };
  return best;
}
export function supportOf(e) { if (!e || e.kind !== 'object') return ''; const s = supportAt(e.x, e.y, e); return Math.abs(s.z - (e.z || 0)) < 0.03 && !M.levels.some((l) => l.name === s.name) ? s.name : ''; }

// ---------------- Brush ----------------
export function brushHit(id) {
  const e = ent(id); if (!e) return [];
  if (!['wall', 'room', 'object', 'roof'].includes(e.kind)) return [];
  if (S.brush.scope === 'room') { const r = e.kind === 'room' ? e : roomOf(e); if (r) return [r.id, ...r.walls.filter((w) => SC.wallById(M, w))]; }
  return [e.id];
}
export function brushApply(ids) { for (const id of ids) M.finishes[id] = { type: S.brush.type, name: S.brush.name, color: S.brush.color }; }

// ---------------- Edit shape: a roof's own section ----------------
export function openEditShape(id) {
  const r = ent(id); if (!r || r.kind !== 'roof') return;
  if (r.poly) return toast('A canopy is flat: set its height in the Card.', true);
  S.sel = id; S.editShape = { id, joint: null, expanded: false, pos: null };
  if (S.cmp.edit === 'object' && S.reading !== '3d') S.reading = '3d';
  UI.render();
}
export function closeEditShape() { S.editShape = null; UI.render(); }
const PRESETS = [['flat', 'Flat'], ['gable', 'Gable'], ['raked', 'Raked'], ['mansard', 'Mansard'], ['saw', 'Sawtooth']];
export function applyPreset(r, k) {
  const span = r.y1 - r.y0, e = SC.roofEave(r), t = Math.max(SC.roofTop(r), e + 1.2), H = t - e;
  const P = {
    flat: [[0, e], [span, e]], gable: [[0, e], [span / 2, e + Math.max(H, span * 0.35)], [span, e]], raked: [[0, e], [span * 0.25, e + H], [span, e]],
    mansard: [[0, e], [span * 0.15, e + H * 0.7], [span * 0.4, e + H], [span * 0.6, e + H], [span * 0.85, e + H * 0.7], [span, e]],
    saw: (() => { const n = Math.max(2, Math.round(span / 6)), w = span / n, p = [[0, e]]; for (let i = 0; i < n; i++) { p.push([w * i + w * 0.95, e + 2.2]); p.push([w * (i + 1), e]); } return p; })(),
  }[k];
  findRaw(r.id).prof = P.map(([s, z]) => [+s.toFixed(2), +z.toFixed(2)]); S.editShape.joint = null; commit(`Reshape ${r.name} · ${k}`);
}
/** Move joint i to (s, z) with the profile's constraints, snapping heights and pitch detents. */
export function moveJoint(raw, i, s, z, free) {
  const p = raw.prof; const last = p.length - 1;
  if (i === 0) s = 0; else if (i === last) s = raw.y1 - raw.y0; else s = clamp(s, p[i - 1][0], p[i + 1][0]);
  z = Math.max(0.3, z); let why = '';
  if (!free) {
    const m = heightMarks().find((m) => Math.abs(m.z - z) < 0.1); if (m) { z = m.z; why = m.labels[0]; }
    for (const [k, q] of p.entries()) if (k !== i && Math.abs(q[1] - z) < 0.06) { z = q[1]; why = why || 'level with a joint'; }
    if (i > 0) { const a = (Math.atan2(z - p[i - 1][1], s - p[i - 1][0] || 1e-3) * 180) / Math.PI; const det = [30, 45, 60].find((d) => Math.abs(Math.abs(a) - d) < 2); if (det && s - p[i - 1][0] > 0.2) { z = p[i - 1][1] + Math.sign(a) * Math.tan((det * Math.PI) / 180) * (s - p[i - 1][0]); why = `${det}°`; } }
    s = Math.round(s * 20) / 20;
  }
  p[i] = [+s.toFixed(2), +z.toFixed(2)];
  if (i === 0 || i === last) { /* eaves: the opposite eave stays where it is */ }
  return why;
}
export function padSvg(r, w, h, idp = 'espad') {
  const pr = SC.roofProf(r), span = r.y1 - r.y0, top = SC.roofTop(r), eave = SC.roofEave(r);
  const z0 = Math.max(0, eave - 2.2), padX = Math.max(0.8, span * 0.06);
  const vb = [-padX, -(top + 1), span + padX * 2, top + 1 - z0 + 0.3];
  let g = ''; for (let s = 0; s <= span; s += span > 16 ? 2 : 1) g += `<line x1="${s}" y1="${-(top + 1)}" x2="${s}" y2="${-z0}"/>`; for (let z = Math.ceil(z0); z <= top + 1; z++) g += `<line x1="${-padX}" y1="${-z}" x2="${span + padX}" y2="${-z}"/>`;
  const walls = `<line class="sctx" x1="0.3" y1="${-eave}" x2="0.3" y2="${-z0}"/><line class="sctx" x1="${span - 0.3}" y1="${-eave}" x2="${span - 0.3}" y2="${-z0}"/>`;
  const person = eave - z0 > 1.8 ? '' : '';
  const prof = pr.map(([s, z]) => `${s},${-z}`).join(' ');
  const sel = S.editShape?.joint;
  const adds = pr.slice(0, -1).map(([s, z], i) => `<circle class="jadd" data-pj="add-${i}" cx="${(s + pr[i + 1][0]) / 2}" cy="${-(z + pr[i + 1][1]) / 2}" r="${span * 0.012 + 0.08}"/>`).join('');
  const joints = pr.map(([s, z], i) => `<circle class="jt${sel === i ? ' hot' : ''}" data-pj="${i}" cx="${s}" cy="${-z}" r="${span * 0.016 + 0.12}"/>`).join('');
  const labels = sel != null && pr[sel] ? `<text class="ctxt" x="${pr[sel][0] + 0.2}" y="${-pr[sel][1] - 0.35}" font-size="${0.3 + span * 0.012}">${f2(pr[sel][1])}</text>` : `<text class="ctxt" x="0" y="${-eave + 0.45}" font-size="${0.3 + span * 0.012}">eave ${f2(eave)}</text>`;
  return `<svg id="${idp}" viewBox="${vb.join(' ')}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"><g class="pg">${g}</g>${walls}${person}<polygon class="prof" points="${prof} ${span},${-z0} 0,${-z0}"/><polyline class="profl" points="${prof}"/>${adds}${joints}${labels}</svg>`;
}
function presetRow(r) { const pr = SC.roofProf(r); const cur = SC.roofFlat(r) ? 'flat' : pr.length === 3 ? (Math.abs(pr[1][0] - (r.y1 - r.y0) / 2) < 0.1 ? 'gable' : 'raked') : pr.length === 6 ? 'mansard' : 'saw'; return `<div class="presets">${PRESETS.map(([k, l]) => `<button data-act="es-preset" data-v="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`; }
function jointFields(r) {
  const j = S.editShape.joint, pr = SC.roofProf(r);
  if (j == null || !pr[j]) return `<div class="dims"><label class="df"><span>Eave</span><input data-dim="eave" value="${f2(SC.roofEave(r))}"></label><label class="df"><span>Top</span><input data-dim="ridge" value="${f2(SC.roofTop(r))}"></label><label class="df" title="Joints"><span>Joints</span><input readonly value="${pr.length}"></label></div>`;
  const prev = pr[j - 1]; const pitch = prev ? Math.round((Math.atan2(pr[j][1] - prev[1], pr[j][0] - prev[0] || 1e-3) * 180) / Math.PI) : null;
  return `<div class="dims"><label class="df"><span>Joint ${j + 1} across</span><input data-joint="s" value="${f2(pr[j][0])}" ${j === 0 || j === pr.length - 1 ? 'readonly' : ''}></label><label class="df"><span>Height</span><input data-joint="z" value="${f2(pr[j][1])}"></label><label class="df" title="Slope from the previous joint"><span>Pitch°</span><input readonly value="${pitch ?? '—'}"></label></div>`;
}
/** The Card while a roof's section is being edited (all postures keep precision here). */
export function editShapeCard(r) {
  const mode = S.cmp.edit; let h = '';
  if (mode === 'card') h += `<div class="cpad">${padSvg(r, 392, 160)}</div>`;
  if (mode !== 'float') h += presetRow(r);
  h += jointFields(r);
  h += `<div class="cfoot"><span class="quiet">${mode === 'object' ? 'Drag joints on the roof · drag ＋ to add · ⌥-click removes' : 'Drag joints · drag ＋ to add · ⌥-click removes'}${S.tool === 'ink' ? ' · Ink draws a new profile' : ''}</span><span class="sp"></span><button class="tbtn pri" data-act="es-done">Done <span class="kbd">↵</span></button></div>`;
  return h;
}
/** Floating section editor (posture A): compact by default, expands for precision. */
export function editFloatHtml() {
  if (!S.editShape || S.cmp.edit !== 'float') return '';
  const r = ent(S.editShape.id); if (!r) return '';
  const st = $('#stage'), W = st.clientWidth, Hh = st.clientHeight; const big = S.editShape.expanded;
  const w = big ? Math.min(640, W - 40) : 320, h = big ? 250 : 140;
  let pos = S.editShape.pos;
  // default: lower-left of the stage, clear of the Card (top right), the Sheet and the dock; drag the header to move it
  const panelH = h + (big ? 130 : 76); // pad + header + presets (+ joint table)
  if (!pos) pos = [S.sheet.side === 'left' ? 64 : 16, Hh - panelH - 76];
  const x = clamp(pos[0], 8, W - w - 30), y = clamp(pos[1], 56, Hh - panelH - 76);
  let rows = '';
  if (big) rows = `<div class="jtable">${SC.roofProf(r).map(([s, z], i) => `<button data-act="es-joint" data-v="${i}" aria-pressed="${S.editShape.joint === i}"><b>${i + 1}</b> ${f2(s)} · ${f2(z)}</button>`).join('')}</div>`;
  return `<div class="esfloat${big ? ' big' : ''}" style="left:${x}px;top:${y}px;width:${w + 20}px"><div class="eh" data-drag="esfloat">${icon('section', 14)}<span>Section · ${esc(r.name)}</span><span class="sp"></span><button class="iconbtn sm" data-act="es-expand" title="${big ? 'Compact' : 'Expand for precision'}">${icon(big ? 'minimize' : 'expand', 14)}</button><button class="iconbtn sm" data-act="es-done" title="Done (Enter)">${icon('check', 14)}</button></div>${padSvg(r, w, h)}${presetRow(r)}${rows}</div>`;
}

// ---------------- Library (assets meet the tools they feed) ----------------
export const ASSETS = {
  objects: [['Bench', 'bench', 'extend', 1.8, 0.5, 0.45], ['Plinth', 'plinth', 'stretch', 0.6, 0.6, 1.0], ['Vitrine', 'vitrine', 'stretch', 1.2, 0.6, 1.1], ['Seated figure', 'sculpture', 'proportional', 0.5, 0.6, 0.9], ['Lectern', 'object', 'stretch', 0.5, 0.4, 1.1], ['Low table', 'table', 'extend', 1.0, 1.0, 0.4]],
  art: [['Framed print', 'artwork', '', 0.9, 0.05, 0.7], ['Large canvas', 'artwork', '', 1.8, 0.05, 1.2], ['Wall text', 'artwork', '', 0.6, 0.05, 0.9]],
};
export function assetsHtml() {
  const tab = S.instrument.tab || 'objects';
  const tabs = [['objects', 'Objects'], ['art', 'Art'], ['materials', 'Materials'], ['import', 'Import']].map(([k, l]) => `<button data-act="atab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'objects' || tab === 'art') body = `<div class="tiles">${ASSETS[tab].map(([n, k, fit, w, d, hh], i) => `<button class="tile" data-act="pick" data-tab="${tab}" data-i="${i}" aria-pressed="${S.placing?.name === n}" title="${n} · ${w}×${d}×${hh} m"><span class="art">${icon(k === 'artwork' ? 'material' : 'object', 20)}</span><span class="n">${n}</span></button>`).join('')}</div>`;
  if (tab === 'materials') body = `<div class="tiles">${MATERIALS.map(([n, c]) => `<button class="tile" data-act="brushset" data-t="material" data-n="${n}" data-c="${c}"><span class="art" style="background:${c}"></span><span class="n">${n}</span></button>`).join('')}</div><div class="muted">Picking a material loads the Brush.</div>`;
  if (tab === 'import') body = `<div class="drop">${icon('import', 22)}<div>Drop a .glb anywhere on the Stage</div><button class="ibtn light" data-act="mockimport">Use sample “Boat hull.glb”</button><div class="muted">Imports are fixed geometry: place, stretch, slice, present — not reshaped.</div></div>`;
  return `<div class="inst lib"><div class="ih"><span class="tabs">${tabs}</span><span class="sp"></span><button class="x" data-act="instclose" title="Close (Esc)">${icon('close', 15)}</button></div><div class="ib">${body}</div></div>`;
}
export function repairHtml() {
  const e = ent(S.sel); const lo = M.loose.find((l) => l.id === S.sel);
  return `<div class="inst"><div class="ih"><span class="k">Repair</span><span class="nm">${esc(e?.name || '')}</span><span class="sp"></span><button class="x" data-act="instclose">${icon('close', 15)}</button></div><div class="ib"><div class="muted">${esc(lo?.msg || '')}</div><div class="eb" style="margin-top:8px"><button class="ibtn light" data-act="repairposts">Add posts under the open edges</button><button class="ibtn" data-act="repairok">It's meant to be</button></div></div></div>`;
}
