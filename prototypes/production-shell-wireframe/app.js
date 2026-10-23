// Production-shell wireframe, round 2: render orchestration, pointer gestures, actions, keys.
// Mock state, one render pass per change, no framework. See DESIGN-NOTE.md.
import { icon } from './icons.js';
import * as SC from './scene.js';
import { denseModel } from './dense.js';
import { $, $$, S, M, H, R, UI, esc, f2, clamp, clone, ent, view, pres, guide, level, findRaw, collOf, kindLabel, roomOf, levelAt, heightMarks, markAt, commit, undo, redo, toast, toVB, toPx, wpx, onPlane, stagePx, snapPt, camState, dragOnPlane, loadModel, resetHistory, uid, bandAt } from './core.js';
import { renderStage, renderOverlay, renderSheet, sheetVisible, sheetMax, objFrame, roofSectionX, readingName } from './stage.js';
import { renderHead, renderIndex, renderCard, applyDim, appMenuHtml, findResults, scopeNow, looksFor, revealInIndex } from './chrome.js';
import * as T from './tools.js';
import * as X from './exp.js';
import { renderTour, TOURS, startTour } from './tour.js';

// ---------------- registry ----------------
Object.assign(UI, {
  render, renderFloat, renderStage, renderLower, renderCard, sheetVisible, selEntity, scopedList, parkWorld,
  expEnt: X.expEnt, evalGuide: X.evalGuide, expIndex: X.expIndex, expCard: X.expCard, expOverlay: X.expOverlay,
  editShapeCard: T.editShapeCard, carryRiders: T.carryRiders, supportOf: T.supportOf,
});

export function loadScenario(k) {
  S.scenario = k; S.toast = null; S.find = { q: '', open: false, idx: 0 }; loadModel(k === 'dense' ? denseModel() : SC.seedModel());
  // the mock data names a room's surface type and an object's visual type `kind`; entities use `kind` for the domain kind
  for (const r of M.rooms) if (r.kind) { r.type = r.kind; delete r.kind; }
  for (const o of M.objects) if (o.kind) { o.type = o.kind; delete o.kind; }
  resetHistory(k === 'dense' ? 'Open Harbour museum' : 'Open Boathouse gallery');
  Object.assign(S, { sel: null, scope: { st: null, lv: null, room: null }, facet: 'all', search: '', more: {}, sheet: { ...S.sheet, h: 0 }, focus: false, slice: null, look: null, lift: false, editShape: null, marked: new Set(), erase: null, confirm: null, readChip: null, ink: null, meas: null, placing: null, instrument: null, lookThrough: null, guideOpen: false, playing: false, t: 0, follow: false, preview: null, cams: {}, hint: null, sizeOpen: null, dimRefuse: null });
}

// ---------------- the whole render ----------------
export function render(xfade) {
  renderFrame(); renderHead(); renderIndex(); renderStage(xfade); renderCard(); renderLower(); renderFloat(); X.renderPreview(); renderTour();
}
const SIZES = { fill: null, laptop: [1440, 900], small: [1280, 800], ipadL: [1180, 820], ipadP: [820, 1180] };
function renderFrame() {
  const fr = $('#frame'); const s = SIZES[S.width]; fr.classList.toggle('sim', !!s);
  fr.style.width = s ? s[0] + 'px' : '100%'; fr.style.height = s ? Math.min(s[1], window.innerHeight - 40) + 'px' : '100%';
  const w = s ? s[0] : window.innerWidth; const mid = w <= 1100;
  if (mid && !S.mid) S.indexOpen = false; // overlay Index starts collapsed on iPad widths
  S.mid = mid;
  $('#app').dataset.lens = S.lens; $('#app').dataset.mid = S.mid;
}
export function selEntity() {
  if (!S.sel) return null;
  const x = ent(S.sel); if (x) return x;
  return X.expEnt(S.sel);
}
export function renderLower() {
  const low = $('#lower');
  if (S.preview) { low.innerHTML = ''; return; }
  let inst = '';
  if (S.instrument?.kind === 'assets') inst = T.assetsHtml();
  else if (S.instrument?.kind === 'repair') inst = T.repairHtml();
  if (S.lens === 'experience' && S.guideOpen) inst = X.guideHtml() + inst;
  low.innerHTML = `<div class="lower">${T.dockHtml()}${inst}</div>`;
  const lh = $('#lower .lower'); const st = $('#stage');
  // the open palette column rises above the dock; things that sit above the lower edge (toast, Card limit) clear it too
  requestAnimationFrame(() => { const top = Math.min(lh?.getBoundingClientRect().top ?? Infinity, ...[...low.querySelectorAll('.pcol, .picker')].map((n) => n.getBoundingClientRect().top)); const sb = st.getBoundingClientRect().bottom; st.style.setProperty('--lower', (Number.isFinite(top) ? Math.max(56, sb - top - 10) : 56) + 'px'); });
}
export function renderFloat() {
  let h = '';
  if (S.ctx) {
    const e = ent(S.ctx.id);
    if (e) h += `<div class="ctx" style="left:${S.ctx.x}px;top:${S.ctx.y}px"><div class="hd"><small>${kindLabel[e.kind]}</small>${esc(e.name)}</div>${scopedList(e).map(([l, a]) => (a === 'erase-sel' ? '<hr>' : '') + `<button data-act="cap" data-v="${a}" class="${a === 'erase-sel' ? 'danger' : ''}">${l}${a === 'erase-sel' ? '<small>⌫</small>' : ''}</button>`).join('')}</div>`;
    else h += `<div class="ctx" style="left:${S.ctx.x}px;top:${S.ctx.y}px"><button data-act="cap" data-v="reading:plan">2D<small>2</small></button><button data-act="cap" data-v="reading:3d">3D<small>1</small></button><button data-act="cap" data-v="assets:objects">Place from Library…<small>A</small></button></div>`;
  }
  if (S.readChip) {
    const r = S.readChip; const cur = r.readings[r.idx];
    h += `<div class="readchip" style="left:${r.x}px;top:${r.y}px"><b>${esc(cur.label)}</b>${cur.meta ? `<span class="quiet">${esc(cur.meta)}</span>` : ''}${r.readings.map((x, i) => (i === r.idx ? '' : `<button class="alt" data-act="reread" data-i="${i}">${esc(x.label)}</button>`)).join('')}<span class="kbd" title="Tab: next reading">⇥</span></div>`;
  }
  h += T.eraseBarHtml() + T.confirmHtml() + T.editFloatHtml() + appMenuHtml();
  if (S.toast) h += `<div class="toast${S.toast.refusal ? ' ref' : ''}">${S.toast.refusal ? icon('warning', 14) : ''}<span>${esc(S.toast.msg)}</span>${S.toast.action ? `<button data-act="${S.toast.action[1]}">${S.toast.action[0]}</button>` : ''}</div>`;
  $('#float').innerHTML = h;
}

/** One fixed-order scoped list: Card ⋯, the context menu and Find's "For …" group share it. */
export function scopedList(e) {
  const L = [];
  for (const [k, , l] of looksFor(e)) L.push([l.replace(/ \(.*\)$/, ''), 'look:' + k]);
  if (e.kind === 'object' || e.kind === 'artwork') L.push(['Duplicate', 'dup']);
  if (['wall', 'room', 'object', 'roof'].includes(e.kind)) L.push(['Paint…', 'tool:brush']);
  L.push(['Bring into view', 'bring']);
  L.push(['Present this in Experience', 'presentthis']);
  L.push(['Erase', 'erase-sel']);
  return L;
}

// ---------------- state transitions ----------------
export function setTool(t) {
  if (S.tool === 'eraser' && t !== 'eraser') { S.marked.clear(); S.erase = null; S.lassoPoly = null; }
  if (t !== S.tool) { S.palOpen = true; if (S.tool === 'ink') S.inkShape = false; } // arming opens the palette; the Shape intent ends with Ink
  S.tool = t; S.ink = null; S.meas = null; S.inkHint = null; S.eraseHint = null; S.brushPick = false; S.eraseFilterOpen = false;
  if (t !== 'place') S.placing = null;
  if (t !== 'brush') S.brushMode = null;
  if (t === 'eraser') S.sizeOpen = null;
}
export function selectId(id) {
  if (S.editShape && id !== S.editShape.id) { if (S.reading === 'rsect') S.reading = '3d'; S.editShape = null; }
  S.sel = id || null; S.cardMore = false; S.ctx = null; S.dimRefuse = null; S.sizeOpen = null;
  if (id) revealInIndex(id);
}
export function setSheet(z) { S.sheet.h = +(+z).toFixed(2); if (S.slice && S.slice.horizontal) S.slice.h = S.sheet.h; }
export function pinHeight(z = S.sheet.h) {
  if (M.pins.some((p) => Math.abs(p.z - z) < 0.02)) return;
  const m = markAt(z); M.pins.push({ id: uid('pin'), z: +z.toFixed(2), label: m ? m.labels[0] : `Height ${f2(z)}` }); commit(`Pin height ${f2(z)}`);
  S.hint = null; S.hints.pin = true; toast(`Pinned ${f2(z)} — it stays on the Sheet even when nothing is drawn there`);
}
function startLook(kind, e) {
  e = e || ent(S.sel); if (!e) return;
  if (kind === 'unroll') { const r = e.kind === 'room' ? e : roomOf(e); if (!r || !r.walls.length) return toast('Unroll needs a room around this wall.', true); S.look = { kind: 'unroll', walls: r.walls.filter((w) => SC.wallById(M, w)) }; }
  else if (kind === 'face') S.look = { kind: 'face', walls: [e.id] };
  else if (kind === 'facehost') S.look = { kind: 'face', walls: [e.host] };
  else if (kind === 'lift') { S.lift = !S.lift; return render(true); }
  else if (kind === 'section') { const c = SC.entityPlanCentre(M, e); const b = R.box; S.slice = { a: [b[0] - 0.5, c[1] - 0.01], b: [b[2] + 0.5, c[1]], z: 0, flip: false, depth: 6 }; S.reading = 'section'; return render(true); }
  else if (kind === 'editshape') return T.openEditShape(e.id);
  else if (kind === 'focus') { setSheet(e.z || 0); S.focus = true; return render(); }
  else if (kind === 'eye') { S.eye = { pos: [e.x - 2.5, e.y - 2.5, (levelAt(e.z || 0)?.z || 0) + 1.6], target: [e.x, e.y, (e.z || 0) + e.h / 2] }; S.reading = 'eye'; return render(true); }
  render(true);
}
function putBack() { S.look = null; S.lift = false; render(true); }
export function parkWorld() { S.look = null; S.lift = false; S.slice = null; S.focus = false; S.instrument = null; S.ink = null; S.marked.clear(); S.erase = null; S.editShape = null; S.lookThrough = null; S.placing = null; S.playing = false; S.follow = false; if (S.reading === 'section' || S.reading === 'rsect') S.reading = '3d'; }
function enterScope(k, id) {
  const sc = S.scope;
  if (k === 'project') S.scope = { st: null, lv: null, room: null };
  else if (k === 'st') S.scope = { st: id || null, lv: null, room: null };
  else if (k === 'lv') { const l = level(id); S.scope = { st: l.structure, lv: id, room: null }; setSheet(l.z); S.focus = M.levels.filter((x) => x.structure === l.structure).length > 1; }
  else if (k === 'room') { const r = ent(id); S.scope = { st: r.structure || sc.st, lv: r.level || sc.lv, room: id }; const l = level(r.level); if (l) setSheet(l.z); }
  if (k === 'project' || k === 'st') S.focus = false;
  S.sibs = null; S.more = {};
}
function frameEntity(id) { const c = R.CENT[id]; if (!c) return; const cs = camState(); const cx = R.V.x + R.V.w / 2, cy = R.V.y + R.V.h / 2; cs.pan = [cs.pan[0] + c[0] - cx, cs.pan[1] + c[1] - cy]; }
export function runCap(c) {
  const [k, v, w] = c.split(':');
  if (k === 'tool') setTool(v);
  else if (k === 'tip') { setTool('ink'); S.inkTip = v; }
  else if (k === 'slice') { setTool('slice'); S.sliceMode = v === 'height' ? 'height' : 'through'; }
  else if (k === 'erase') { setTool('eraser'); S.eraseMode = v; }
  else if (k === 'reading') { S.reading = v; S.look = null; S.lookThrough = null; S.find.open = false; return render(true); }
  else if (k === 'elev') { S.reading = 'elev'; S.elevFace = v; S.look = null; return render(true); }
  else if (k === 'lift') S.lift = !S.lift;
  else if (k === 'focus') S.focus = !S.focus;
  else if (k === 'assets') S.instrument = { kind: 'assets', tab: v };
  else if (k === 'look') return startLook(v);
  else if (k === 'dup') { const e = findRaw(S.sel); const coll = collOf(S.sel); const n = { ...clone(e), id: uid('b'), name: e.name + ' copy' }; if (coll === 'objects') n.x += 1; else n.at += e.w + 0.4; M[coll].push(n); commit(`Duplicate ${e.name}`); S.sel = n.id; }
  else if (k === 'bring') { frameEntity(S.sel); }
  else if (k === 'presentthis') return X.presentThis();
  else if (k === 'erase-sel') { const id = S.sel; const c = R.CENT[id]; T.eraseNow([id], c ? toPx(c) : [300, 300]); return; }
  else if (k === 'pin') pinHeight();
  else if (k === 'addlevel') { const st = M.structures[0]; const id = uid('lv'); M.levels.push({ id, name: `Level at ${f2(S.sheet.h)}`, structure: scopeNow().st || st.id, z: S.sheet.h }); commit('Add a Level'); toast('A Level is structure: rooms drawn at this height now belong to it.'); }
  else if (k === 'prefs') S.appMenu = true;
  else if (k === 'proc') toast(`${{ divide: 'Divide room', cover: 'Cover rooms with a roof' }[v]} would open as a procedure (not in this wireframe).`);
  else if (k === 'goto') { enterScope(v === 'structure' ? 'st' : v === 'level' ? 'lv' : 'room', w); if (v === 'room') { selectId(w); } S.indexOpen = true; render(); if (v === 'room') { frameEntity(w); renderStage(); } return; }
  else if (k === 'select') { selectId(v); render(); frameEntity(v); return render(); }
  else if (k === 'indexsearch') { S.search = c.slice(12); S.indexOpen = true; }
  render();
}

// ---------------- pointer on the Stage ----------------
let spaceDown = false, tickT;
const CHROME = '.sf, #card, #lower .lower > *, .hsheet, .pop, .ctx, .readchip, .pill, .toast, .erasebar, .esfloat, .tourcard, .peekarrow, .peekzone';
function stageDown(ev) {
  if (ev.target.closest(CHROME)) return;
  closePops();
  const st = $('#stage'); st.setPointerCapture(ev.pointerId);
  const hitEl = ev.target.closest('[data-id]'); const hid = hitEl?.dataset.id; const hnd = ev.target.closest('[data-h]')?.dataset.h;
  const uv = toVB(ev), px = stagePx(ev);
  if (ev.button === 2) return;
  if (ev.button === 1 || spaceDown || (ev.shiftKey && S.tool === 'select' && !hid && !hnd)) { R.D = { kind: 'pan', pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY }; return; }
  if (S.lookThrough) { R.D = { kind: 'aim', sx: ev.clientX, sy: ev.clientY, t0: [...S.lookThrough.target], pos: S.lookThrough.pos }; return; }
  if (S.reading === 'eye' && S.tool === 'select' && !hid) { R.D = { kind: 'aimEye', sx: ev.clientX, sy: ev.clientY, t0: [...S.eye.target] }; return; }
  if (S.lens === 'experience') return expDown(ev, hid, uv);
  if (hnd && hnd.startsWith('sl-')) return startHandle(hnd, ev);
  if (S.editShape && hnd && /^j(add)?-/.test(hnd)) return startHandle(hnd, ev);
  if (S.editShape && S.tool === 'ink' && !(S.cmp.section === 'inset' && S.editShape.view === 'section')) { R.D = { kind: 'inkSection', px: [px] }; S.ink = { pts: [px], px: true }; return; }
  if (S.tool === 'select') {
    if (hnd) return startHandle(hnd, ev);
    if (hid && ev.detail === 2) { const e = ent(hid); if (e?.kind === 'roof') return T.openEditShape(hid); if (e?.kind === 'wall') { selectId(hid); return startLook('face', e); } if (e?.kind === 'room' && e.walls.length) { selectId(hid); return startLook('unroll', e); } }
    if (hid) {
      const e = ent(hid); if (S.editShape && hid === S.editShape.id) return;
      selectId(hid);
      if (e && ['object', 'import'].includes(e.kind) && R.mode !== 'unroll') R.D = { kind: 'move', id: hid, start: uv, sx: ev.clientX, sy: ev.clientY };
      if (e && ['artwork', 'opening'].includes(e.kind) && R.mode === 'solid') R.D = { kind: 'slide', id: hid, h0: wallHit(SC.wallById(M, e.host), ev) };
      return render();
    }
    R.D = { kind: R.mode === 'plan' || R.mode === 'unroll' ? 'pan' : 'orbit', pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY, az0: S.az, clear: true };
    return;
  }
  if (S.tool === 'ink') return inkDown(ev, hid, uv);
  if (S.tool === 'slice') {
    if (S.sliceMode === 'height') { S.slice = { horizontal: true, h: S.sheet.h > 0.1 ? S.sheet.h : 1.2, depth: 3 }; if (S.sheet.h < 0.1) setSheet(1.2); return render(); }
    const z = R.mode === 'plan' ? 0 : S.sheet.h; const p = onPlane(ev, z); if (!p) return toast('Slice from 2D or 3D.', true); R.D = { kind: 'slice', a: snapPt(p, { noEnds: true }).p, z, prev: S.slice }; return;
  }
  if (S.tool === 'eraser') {
    if (ev.shiftKey && hid) S.eraseLock = ent(hid)?.kind === 'import' ? 'object' : ent(hid)?.kind;
    if (S.eraseMode === 'lasso') { S.lassoBase = S.erase ? [...S.marked] : []; R.D = { kind: 'lasso', alt: ev.altKey }; S.lassoPoly = [uv]; return renderOverlay(); }
    R.D = { kind: 'scrub', hid, px, moved: false, alt: ev.altKey, base: S.erase ? new Set(S.marked) : new Set(), last: [ev.clientX, ev.clientY], sx: ev.clientX, sy: ev.clientY }; S.lassoPoly = [uv];
    if (!S.erase) S.marked = new Set();
    return;
  }
  if (S.tool === 'brush') {
    if (S.brushMode === 'pick') { const f = M.finishes[hid]; if (!f) return toast('No finish there to pick up.', true); S.brush = { ...S.brush, type: f.type, name: f.name, color: f.color }; S.brushMode = null; toast(`Picked up ${f.name}`); return render(); }
    R.D = { kind: 'brush', ids: new Set() }; brushTouch(hid); return;
  }
  if (S.tool === 'measure') {
    if (S.measureMode === 'height') { const e = ent(hid); if (!e) return; const top = e.top ?? (e.kind === 'roof' ? SC.roofTop(e) : (e.z || 0) + (e.h || 0)); const m = markAt(top, 0.05); S.meas = { heightAt: { px, label: `${f2(top)} m${m ? ' · ' + m.labels[0] : ''}` } }; return renderOverlay(); }
    const p0 = onPlane(ev, S.sheet.h); if (!p0) return; const p = snapPt(p0).p;
    if (!S.meas || S.meas.b || !S.meas.a) S.meas = { a: p, h: S.sheet.h }; else S.meas.b = p; return renderOverlay();
  }
  if (S.tool === 'place') return placeAt(ev, hid);
}
function brushTouch(hid) {
  const ids = T.brushHit(hid); if (!ids.length) return;
  ids.forEach((id) => R.D.ids.add(id)); T.brushApply(ids); renderStage();
}
function expDown(ev, hid, uv) {
  const vm = ev.target.closest('.vm'); const pp = ev.target.closest('.pathpt');
  if (pp) { const [, i, j] = pp.dataset.h.split('-'); R.D = { kind: 'pathpt', i: +i, j: +j }; return; }
  if (S.tool === 'view') { const p = onPlane(ev, 0); if (!p) return toast('Place Views on 2D or 3D.', true); R.D = { kind: 'newview', a: p, aPx: uv }; return; }
  if (S.tool === 'path') { const id = S.sel; if (!id || !id.startsWith('edge-')) return toast('Select a transition in the Guide first.', true); const p = onPlane(ev, 0); if (!p) return; const e = guide().edges[+id.slice(5)]; if (e.mode === 'cut') return toast('A Cut has no travel path.', true); (e.pts = e.pts || []).push(p); commit('Add path point'); return render(); }
  if (vm) { selectId(vm.dataset.v); if (ev.detail === 2) return X.lookThrough(vm.dataset.v); return render(); }
  if (hid && ent(hid)) { selectId(hid); return render(); }
  R.D = { kind: R.mode === 'plan' ? 'pan' : 'orbit', pan0: [...camState().pan], sx: ev.clientX, sy: ev.clientY, az0: S.az, clear: true };
}
function inkDown(ev, hid, uv) {
  const e = ent(hid);
  if (R.mode === 'unroll') {
    let u0 = 0, wall = null; for (const id of S.look.walls) { const w = SC.wallById(M, id); const L = SC.wallLen(w); if (uv[0] >= u0 && uv[0] <= u0 + L) { wall = w; break; } u0 += L + 0.6; }
    if (!wall) return; R.D = { kind: 'inkOpenFlat', wall, u0, a: uv }; return;
  }
  if (e && e.kind === 'roof' && !e.poly) { selectId(hid); T.openEditShape(hid); toast('Ink draws this roof’s section — sketch the new profile across it.'); return; }
  const nearEnd = e && e.kind === 'wall' && (() => { const p = onPlane(ev, e.base); return p && [e.a, e.b].some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.7); })();
  if (e && e.kind === 'wall' && !S.ink && !nearEnd && Math.abs(e.base - S.sheet.h) < 0.05) {
    if (R.mode === 'plan') { const [u, v] = toVB(ev); const L = SC.wallLen(e); const t = clamp(((u - e.a[0]) * (e.b[0] - e.a[0]) + (-v - e.a[1]) * (e.b[1] - e.a[1])) / L, 0.6, L - 0.6); const id = uid('o'); M.openings.push({ id, name: `Door ${id.slice(2)}`, host: e.id, at: t, w: 1.0, h: 2.2, sill: e.base }); commit('Ink door'); S.sel = id; return render(); }
    R.D = { kind: 'inkOpen', wall: e, a: wallHit(e, ev), aPx: stagePx(ev), round: S.inkTip === 'round' }; return;
  }
  const h = S.sheet.h; const p0 = onPlane(ev, h); if (!p0) return toast('Ink draws on 2D, 3D, eye level or a wall laid flat.', true);
  const p = snapPt(p0).p;
  if (S.inkTip === 'line') {
    if (!S.ink) S.ink = { pts: [p], h };
    else { const first = S.ink.pts[0]; const q = ev.shiftKey ? snapAngle(S.ink.pts.at(-1), p) : p; if (S.ink.pts.length > 2 && Math.hypot(q[0] - first[0], q[1] - first[1]) < 0.5) return T.finishInk(S.ink.pts, true); S.ink.pts.push(q); if (ev.detail === 2) return T.finishInk(S.ink.pts, false); }
    return renderOverlay();
  }
  R.D = { kind: { box: 'inkBox', round: 'inkRound' }[S.inkTip] || 'inkSketch', h, a: p }; S.ink = { pts: [p], h }; renderOverlay();
}
/** Straight, following the gesture; with Snap on it settles onto 45° directions when it is close to one. */
function softAngle(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), k = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4); if (!S.snap || Math.abs(ang - k) > (5 * Math.PI) / 180) return b; return [a[0] + Math.cos(k) * L, a[1] + Math.sin(k) * L]; }
function snapAngle(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return [a[0] + Math.cos(ang) * L, a[1] + Math.sin(ang) * L]; }
function wallHit(w, ev) {
  const [u, v] = toVB(ev); const L = SC.wallLen(w); let best = null;
  for (let i = 0; i <= 48; i++) for (let j = 0; j <= 24; j++) { const t = (L * i) / 48, z = w.base + ((w.top - w.base) * j) / 24; const q = R.CAM.P([...SC.wallPoint(w, t), z]); const dd = (q[0] - u) ** 2 + (q[1] - v) ** 2; if (!best || dd < best.d) best = { t, z, d: dd }; }
  return best;
}
function placeAt(ev, hid) {
  const a = S.placing; const e = ent(hid);
  if (a.kind === 'artwork') {
    if (!e || e.kind !== 'wall') return toast('Art goes on a wall face — point at a wall.', true);
    const t = R.mode === 'unroll' ? null : wallHit(e, ev); if (!t) return;
    const id = uid('a'); M.artworks.push({ id, name: a.name, host: e.id, at: clamp(t.t, a.w / 2, SC.wallLen(e) - a.w / 2), w: a.w, h: a.h, c: e.base + 1.6 }); commit(`Place ${a.name}`); S.sel = id; return render();
  }
  const p = onPlane(ev, S.sheet.h); if (!p) return; const q = snapPt(p, { noEnds: true }).p;
  const id = uid('b'); const rec = { id, name: a.name, type: a.type, fit: a.fit, x: q[0], y: q[1], w: a.w, d: a.d, h: a.h, rot: 0, z: S.sheet.h, level: levelAt(S.sheet.h)?.id, imported: a.imported };
  rec.z = T.supportAt(rec.x, rec.y, rec).z; M.objects.push(rec); commit(`Place ${a.name}`); S.sel = id; render();
}
function startHandle(h, ev) {
  const e = ent(S.sel) || (S.editShape && ent(S.editShape.id)); const uv = toVB(ev);
  const base = { sx: ev.clientX, sy: ev.clientY, start: uv };
  if (h === 'sl-flip') { S.slice.flip = !S.slice.flip; return render(true); }
  if (['sl-move', 'sl-depth', 'sl-a', 'sl-b'].includes(h)) { R.D = { kind: h, ...base, p0: onPlane(ev, S.slice.z || 0), orig: clone(S.slice) }; return; }
  if (h.startsWith('jadd-') || h.startsWith('j-')) {
    const r = findRaw(S.editShape.id); let i = +h.split('-')[1];
    if (h.startsWith('jadd-')) { const a = r.prof[i], b = r.prof[i + 1]; r.prof.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i += 1; }
    else if (ev.altKey && i > 0 && i < r.prof.length - 1) { r.prof.splice(i, 1); commit(`Remove a joint of ${r.name}`); S.editShape.joint = null; return render(); }
    S.editShape.joint = i; R.D = { kind: 'joint', id: r.id, i, ...base, orig: [...r.prof[i]], ref: [roofSectionX(r), r.y0 + r.prof[i][0], r.prof[i][1] + (S.lift ? 2.6 : 0)], added: h.startsWith('jadd-') }; return render();
  }
  if (h === 'size' && S.cmp.handles === 'progressive') R.clickToOpen = e.id;
  R.D = { kind: 'h-' + h, id: e.id, ...base, orig: clone(findRaw(e.id)), riders: e.kind === 'object' ? T.ridersOf(e).map((r) => ({ id: r.id, o: clone(r) })) : [] };
}
/** Pixels per metre straight up at a world point — enough to turn a vertical drag into height. */
function pxPerMetreUp(p) { const a = wpx(p), b = wpx([p[0], p[1], p[2] + 1]); return a && b ? Math.max(4, a[1] - b[1]) : 30; }
function stageMove(ev) {
  const uv = toVB(ev); const D = R.D;
  if (!D) {
    const hid = ev.target.closest?.('#world [data-id]')?.dataset.id || null;
    let changed = hid !== S.hover; S.hover = hid;
    const hh = ev.target.closest?.('#ovl [data-h]')?.dataset.h || null;
    if (hh !== S.hh) { S.hh = hh; if (!changed) renderOverlay(); }
    if (S.tool === 'ink' && S.ink && S.inkTip === 'line') { const p = onPlane(ev, S.ink.h); if (p) { S.ink.cursor = ev.shiftKey ? snapAngle(S.ink.pts.at(-1), snapPt(p).p) : snapPt(p).p; S.ink.tag = `${f2(Math.hypot(...SC.sub(S.ink.cursor, S.ink.pts.at(-1))))} m`; } renderOverlay(); }
    if (S.tool === 'ink' && !S.ink) { const e = ent(hid); const px = stagePx(ev); const t = e && e.kind === 'wall' && Math.abs(e.base - S.sheet.h) < 0.05 ? (S.inkTip === 'round' ? '→ round opening in this wall' : '→ opening in this wall') : e && e.kind === 'roof' && !e.poly ? '→ draws its section' : null; const nh = t ? { x: px[0], y: px[1], text: t } : null; if ((nh && nh.text) !== (S.inkHint && S.inkHint.text) || nh) { S.inkHint = nh; renderOverlay(); } }
    if (S.tool === 'measure' && S.meas && S.meas.a && !S.meas.b) { const p = onPlane(ev, S.meas.h || 0); if (p) { S.meas.cursor = snapPt(p).p; renderOverlay(); } }
    if (S.tool === 'place' && S.placing) placeGhost(ev, hid);
    if (S.tool === 'eraser' && !S.erase && S.eraseMode === 'scrub') { const m = hid && T.passFilter(hid) ? new Set([hid]) : new Set(); if ([...m].join() !== [...S.marked].join()) { S.marked = m; changed = true; } }
    if (S.tool === 'eraser') { const e = ent(hid); const out = e && e.kind !== 'room' && !T.passFilter(hid); const px = stagePx(ev); const nh = out ? { x: px[0], y: px[1], text: `${kindLabel[e.kind]}s are filtered out` } : null; if ((nh && nh.text) !== (S.eraseHint && S.eraseHint.text) || nh) { S.eraseHint = nh; renderOverlay(); } }
    if (changed) { renderStage(); if (S.lens === 'world') $$('.irow[data-hover]').forEach((r) => r.classList.toggle('hl', r.dataset.hover === hid)); }
    return;
  }
  const dx = ev.clientX - (D.sx ?? ev.clientX), dy = ev.clientY - (D.sy ?? ev.clientY);
  if (D.kind === 'pan') { const cs = camState(); cs.pan = [D.pan0[0] - dx / R.V.k, D.pan0[1] - dy / R.V.k]; D.moved = true; return renderStage(); }
  if (D.kind === 'orbit') { if (Math.abs(dx) > 3) D.moved = true; if (!D.moved) return; if (R.mode === 'solid' && S.reading === '3d') { S.az = D.az0 - dx * 0.35; renderStage(); } return; }
  if (D.kind === 'aim' || D.kind === 'aimEye') { const pos = D.kind === 'aim' ? S.lookThrough.pos : S.eye.pos; const d = SC.sub(D.t0, pos); const ang = -dx * 0.005; const c = Math.cos(ang), s = Math.sin(ang); const nt = SC.add(pos, [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2] - dy * 0.02]); if (D.kind === 'aim') S.lookThrough.target = nt; else S.eye.target = nt; return renderStage(); }
  if (D.kind === 'inkSketch') { const p = onPlane(ev, D.h); if (p) { const last = S.ink.pts.at(-1); if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.08) S.ink.pts.push(p); } return renderOverlay(); }
  if (D.kind === 'inkSection') { S.ink.pts.push(stagePx(ev)); return renderOverlay(); }
  if (D.kind === 'inkBox') { const p = onPlane(ev, D.h); if (!p) return; const b = snapPt(p, { noEnds: true }).p, a = D.a; S.ink.pts = [a, [b[0], a[1]], b, [a[0], b[1]]]; S.ink.tag = `${f2(Math.abs(b[0] - a[0]))} × ${f2(Math.abs(b[1] - a[1]))} m`; return renderOverlay(); }
  if (D.kind === 'inkRound') { const p = onPlane(ev, D.h); if (!p) return; let r = Math.hypot(p[0] - D.a[0], p[1] - D.a[1]); if (S.snap) r = Math.max(0.5, Math.round(r * 4) / 4); S.ink.pts = T.circlePts(D.a, r); S.ink.tag = `⌀ ${f2(r * 2)} m`; return renderOverlay(); }
  if (D.kind === 'inkOpen') { const b = wallHit(D.wall, ev); D.b = b; const q = stagePx(ev); if (D.round) { const r = Math.max(0.2, Math.hypot(b.t - D.a.t, b.z - D.a.z)); S.ink = { pts: [], opening: { round: true, c: D.aPx, rpx: Math.hypot(q[0] - D.aPx[0], q[1] - D.aPx[1]), label: `⌀ ${f2(r * 2)} m · round opening` } }; } else S.ink = { pts: [], opening: { px: [D.aPx[0], D.aPx[1], q[0], q[1]], label: `${f2(Math.abs(b.t - D.a.t))} × ${f2(Math.abs(b.z - D.a.z))} m` } }; return renderOverlay(); }
  if (D.kind === 'inkOpenFlat') { D.b = uv; const a = toPx(D.a), b = toPx(uv); S.ink = { pts: [], opening: { px: [a[0], a[1], b[0], b[1]], label: `${f2(Math.abs(uv[0] - D.a[0]))} × ${f2(Math.abs(uv[1] - D.a[1]))} m` } }; return renderOverlay(); }
  if (D.kind === 'slice') {
    // a finite straight cut that follows the gesture's direction; the section previews live while it is drawn
    let p = onPlane(ev, D.z); if (!p) return; p = softAngle(D.a, p); D.b = p;
    if (Math.hypot(p[0] - D.a[0], p[1] - D.a[1]) > 0.6) S.slice = { a: [...D.a], b: p, z: D.z, flip: false, depth: D.prev?.depth || 4 };
    return renderStage();
  }
  if (D.kind === 'sl-a' || D.kind === 'sl-b') {
    let p = onPlane(ev, S.slice.z || 0); if (!p) return; const other = D.kind === 'sl-a' ? S.slice.b : S.slice.a; p = softAngle(other, p);
    if (Math.hypot(p[0] - other[0], p[1] - other[1]) < 0.6) return; S.slice[D.kind === 'sl-a' ? 'a' : 'b'] = p; D.moved = true; return renderStage();
  }
  if (D.kind === 'sl-move' || D.kind === 'sl-depth') {
    const p = onPlane(ev, D.orig.z || 0); if (!p || !D.p0) return; const n0 = (() => { const d = SC.norm(SC.sub(D.orig.b, D.orig.a)); let n = [-d[1], d[0]]; if (D.orig.flip) n = [-n[0], -n[1]]; return n; })();
    const s = (p[0] - D.p0[0]) * n0[0] + (p[1] - D.p0[1]) * n0[1];
    if (D.kind === 'sl-move') { const k = S.snap ? Math.round(s * 4) / 4 : s; S.slice.a = SC.add(D.orig.a, SC.mul(n0, k)); S.slice.b = SC.add(D.orig.b, SC.mul(n0, k)); }
    else S.slice.depth = Math.max(0.5, Math.round((D.orig.depth + s) * 4) / 4);
    return renderStage();
  }
  if (D.kind === 'lasso') { S.lassoPoly.push(uv); T.markFromLasso(); if (D.alt) S.marked = new Set((S.lassoBase || []).filter((id) => !S.marked.has(id) || !SC.pointInPoly(R.CENT[id] || [0, 0], S.lassoPoly))); return renderStage(); }
  if (D.kind === 'scrub') {
    if (Math.hypot(dx, dy) > 4) D.moved = true;
    S.lassoPoly.push(uv);
    if (!D.moved) return;
    if (D.hid && !D.started) { D.started = true; if (T.passFilter(D.hid)) (D.alt ? S.marked.delete(D.hid) : S.marked.add(D.hid)); }
    // sample the whole segment since the last move, so a fast stroke still catches what it crosses
    const [lx, ly] = D.last || [ev.clientX, ev.clientY]; const n = Math.max(1, Math.ceil(Math.hypot(ev.clientX - lx, ev.clientY - ly) / 5));
    for (let i = 1; i <= n; i++) {
      const id = document.elementFromPoint(lx + ((ev.clientX - lx) * i) / n, ly + ((ev.clientY - ly) * i) / n)?.closest('#world [data-id]')?.dataset.id;
      if (id && T.passFilter(id)) { if (D.alt) S.marked.delete(id); else S.marked.add(id); }
    }
    D.last = [ev.clientX, ev.clientY];
    return renderStage();
  }
  if (D.kind === 'brush') { const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#world [data-id]'); if (el && !D.ids.has(el.dataset.id)) brushTouch(el.dataset.id); return; }
  if (D.kind === 'newview') { D.cur = uv; return renderOverlay(); }
  if (D.kind === 'pathpt') { const p = onPlane(ev, 0); if (p) { guide().edges[D.i].pts[D.j] = p; renderStage(); } return; }
  if (D.kind === 'joint') {
    const r = findRaw(D.id); const [dyW, dzW] = dragOnPlane(D.ref, [0, 1, 0], [0, 0, 1], [dx, dy]);
    D.why = T.moveJoint(r, D.i, D.orig[0] + dyW, D.orig[1] + dzW, ev.altKey); D.moved = true;
    const q = wpx([roofSectionX(r), r.y0 + r.prof[D.i][0], r.prof[D.i][1]]);
    D.tag = q ? { x: q[0] + 14, y: q[1] - 14, text: `${f2(r.prof[D.i][1])} high${D.why ? ' · ' + D.why : ''}` } : null;
    renderStage(); return renderCard();
  }
  if (D.kind === 'move') {
    const e = findRaw(D.id); const lz = levelAt((e.z || 0) + 0.01)?.z || 0;
    const p = onPlane(ev, lz), p0 = R.CAM.onPlane ? R.CAM.onPlane(D.start[0], D.start[1], lz) : null; if (!p || !p0) return;
    if (!D.orig) { D.orig = clone(e); D.riders = T.ridersOf(e).map((r) => ({ id: r.id, o: clone(r) })); }
    D.moved = true;
    const q = [D.orig.x + p[0] - p0[0], D.orig.y + p[1] - p0[1]]; const s = S.snap ? [Math.round(q[0] * 4) / 4, Math.round(q[1] * 4) / 4] : q;
    e.x = s[0]; e.y = s[1]; const sup = T.supportAt(e.x, e.y, { ...e, z: D.orig.z }); e.z = sup.z;
    for (const r of D.riders) { const raw = findRaw(r.id); raw.x = r.o.x + e.x - D.orig.x; raw.y = r.o.y + e.y - D.orig.y; raw.z = r.o.z + e.z - D.orig.z; }
    let best = null; for (const w of M.walls) { if (Math.abs(w.base - lz) > 0.1) continue; const L = SC.wallLen(w); const t = clamp(((e.x - w.a[0]) * (w.b[0] - w.a[0]) + (e.y - w.a[1]) * (w.b[1] - w.a[1])) / L, 0, L); const P = SC.wallPoint(w, t); const d = Math.hypot(P[0] - e.x, P[1] - e.y); if (!best || d < best.d) best = { d, P, w }; }
    const a = wpx([e.x, e.y, e.z + 0.02]), b = best && wpx([...best.P, lz + 0.02]);
    D.guide = a && b ? `<line class="guide-l" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>` : '';
    D.tag = a ? { x: a[0] + 14, y: a[1] + 26, text: `${best ? f2(best.d) + ' m to wall' : ''}${Math.abs(sup.z - lz) > 0.02 ? ` · on ${sup.name}` : ''}` } : null;
    return renderStage();
  }
  if (D.kind === 'slide') {
    const e = findRaw(D.id); const w = SC.wallById(M, e.host); if (!w) return; if (!D.orig) D.orig = clone(e);
    const hit = wallHit(w, ev); D.moved = true; let at = D.orig.at + (hit.t - D.h0.t); if (S.snap) at = Math.round(at * 10) / 10;
    const L = SC.wallLen(w); const okA = at - e.w / 2 >= 0.1 && at + e.w / 2 <= L - 0.1;
    const others = (e.c != null ? M.artworks : M.openings).filter((o) => o.host === e.host && o.id !== e.id);
    const clash = others.find((o) => Math.abs(o.at - at) < (o.w + e.w) / 2 + 0.05);
    const px = wpx([...SC.wallPoint(w, clamp(at, 0, L)), e.c ?? e.sill + e.h]);
    if (!okA || clash) { D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: !okA ? 'past the wall end' : `overlaps ${clash.name}`, refuse: true } : null; return renderOverlay(); }
    e.at = at; D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: `${f2(at)} m along` } : null; return renderStage();
  }
  if (D.kind === 'h-rotate') { const e = findRaw(D.id); const c = wpx([e.x, e.y, e.z || 0]); const q = stagePx(ev); const a = Math.atan2(q[1] - c[1], q[0] - c[0]); if (D.a0 == null) D.a0 = a; let rot = D.orig.rot - ((a - D.a0) * 180) / Math.PI; if (!ev.altKey) rot = Math.round(rot / 15) * 15; e.rot = ((rot % 360) + 360) % 360; for (const r of D.riders) findRaw(r.id).rot = ((r.o.rot + e.rot - D.orig.rot) % 360 + 360) % 360; D.moved = true; D.tag = { x: c[0] + 20, y: c[1] - 20, text: `${Math.round(e.rot)}°${ev.altKey ? ' free' : ''}` }; return renderStage(); }
  if (D.kind === 'h-size') {
    if (Math.hypot(dx, dy) > 3) R.clickToOpen = null;
    const e = findRaw(D.id); const k = clamp(1 - dy / 160 + dx / 400, 0.3, 3); e.h = +(D.orig.h * k).toFixed(2); e.w = +(D.orig.w * k).toFixed(2); e.d = +(D.orig.d * k).toFixed(2);
    for (const r of D.riders) findRaw(r.id).z = (e.z || 0) + e.h; D.moved = true; const p = wpx([e.x, e.y, (e.z || 0) + e.h]);
    D.tag = p ? { x: p[0] + 18, y: p[1], text: `×${k.toFixed(2)} · ${f2(e.w)} × ${f2(e.d)} × ${f2(e.h)}` } : null; return renderStage();
  }
  if (/^h-[wd]-?$/.test(D.kind)) {
    const e = findRaw(D.id); const lz = D.orig.z || 0; const p = onPlane(ev, lz), p0 = R.CAM.onPlane(D.start[0], D.start[1], lz); if (!p || !p0) return;
    const { u, v } = objFrame(D.orig); const isW = D.kind.startsWith('h-w'), sg = D.kind.endsWith('-') ? -1 : 1, ax = isW ? u : v, key = isW ? 'w' : 'd';
    // the dragged face moves; the opposite face stays where it is
    let s = sg * ((p[0] - p0[0]) * ax[0] + (p[1] - p0[1]) * ax[1]); let nv = Math.max(0.1, D.orig[key] + s); if (S.snap) nv = Math.round(nv * 20) / 20; s = nv - D.orig[key];
    e[key] = nv; e.x = D.orig.x + (ax[0] * sg * s) / 2; e.y = D.orig.y + (ax[1] * sg * s) / 2; D.moved = true;
    const q = wpx([e.x, e.y, lz + e.h]); const verb = key === 'w' && e.fit === 'extend' ? 'extend' : 'stretch';
    D.tag = q ? { x: q[0] + 16, y: q[1] - 16, text: `${key === 'w' ? (e.fit === 'extend' ? 'length' : 'width') : 'depth'} ${f2(nv)} · ${verb}${verb === 'stretch' && e.fit !== 'stretch' ? ' (distorts)' : ''}` } : null; return renderStage();
  }
  if (D.kind === 'h-h') {
    const e = findRaw(D.id); const ppm = pxPerMetreUp([e.x, e.y, D.orig.z || 0]); let nh = Math.max(0.1, D.orig.h - dy / ppm);
    const top = (D.orig.z || 0) + nh; const m = heightMarks().find((mm) => Math.abs(mm.z - top) < 0.06); if (m && !ev.altKey) nh = m.z - (D.orig.z || 0); else if (S.snap) nh = Math.round(nh * 20) / 20;
    e.h = +nh.toFixed(2); for (const r of D.riders) findRaw(r.id).z = (e.z || 0) + e.h; D.moved = true;
    const q = wpx([e.x, e.y, (e.z || 0) + e.h]); D.tag = q ? { x: q[0] + 16, y: q[1] - 6, text: `height ${f2(e.h)} · base stays${e.fit === 'proportional' ? ' · stretch' : ''}${m && !ev.altKey ? ' · ' + m.labels[0] : ''}` } : null; return renderStage();
  }
  if (D.kind === 'h-top') {
    const w = findRaw(D.id); const ppm = pxPerMetreUp([...w.a, w.base]); let z = D.orig.top - dy / ppm;
    const m = heightMarks().find((mm) => Math.abs(mm.z - z) < 0.15); if (m && !ev.altKey) z = m.z; else if (S.snap) z = Math.round(z * 20) / 20;
    const need = Math.max(w.base + 0.5, ...M.openings.filter((o) => o.host === w.id).map((o) => o.sill + o.h + 0.05));
    const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; const p = wpx([...mid, Math.max(z, need)]);
    if (z < need) { D.tag = p ? { x: p[0] + 16, y: p[1], text: `refused — an opening needs ${f2(need - w.base)}`, refuse: true } : null; return renderOverlay(); }
    w.top = +z.toFixed(2); D.moved = true; D.tag = p ? { x: p[0] + 16, y: p[1], text: `${f2(z - w.base)} high${m && !ev.altKey ? ' · ' + m.labels[0] : ''}` } : null; return renderStage();
  }
  if (D.kind === 'h-end-a' || D.kind === 'h-end-b') { const w = findRaw(D.id); const p = onPlane(ev, w.base); if (!p) return; const q = snapPt(p).p; w[D.kind.endsWith('a') ? 'a' : 'b'] = q; D.moved = true; const px = wpx([...q, w.base]); D.tag = px ? { x: px[0] + 12, y: px[1] - 12, text: `${SC.wallLen(w).toFixed(2)} m` } : null; return renderStage(); }
  if (D.kind === 'h-push') { const w = findRaw(D.id); const p = onPlane(ev, w.base), p0 = R.CAM.onPlane(D.start[0], D.start[1], w.base); if (!p || !p0) return; const L = SC.wallLen(D.orig); const n = [-(D.orig.b[1] - D.orig.a[1]) / L, (D.orig.b[0] - D.orig.a[0]) / L]; let s = (p[0] - p0[0]) * n[0] + (p[1] - p0[1]) * n[1]; if (S.snap) s = Math.round(s * 10) / 10; w.a = [D.orig.a[0] + n[0] * s, D.orig.a[1] + n[1] * s]; w.b = [D.orig.b[0] + n[0] * s, D.orig.b[1] + n[1] * s]; D.moved = true; const px = wpx([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, w.base]); D.tag = px ? { x: px[0] + 14, y: px[1] + 20, text: `moved ${f2(s)} m` } : null; return renderStage(); }
  if (D.kind === 'h-th') {
    // the grip sits on the cap's centre line: moving away from the line on either side thickens, back towards it thins
    const w = findRaw(D.id); const z = R.mode === 'plan' ? w.base : w.top; const p = onPlane(ev, z), p0 = R.CAM.onPlane(D.start[0], D.start[1], z); if (!p || !p0) return;
    const L = SC.wallLen(D.orig), n = [-(D.orig.b[1] - D.orig.a[1]) / L, (D.orig.b[0] - D.orig.a[0]) / L]; const off = (q) => Math.abs((q[0] - D.orig.a[0]) * n[0] + (q[1] - D.orig.a[1]) * n[1]); const s = off(p) - off(p0);
    w.th = +clamp((D.orig.th ?? 0.24) + s, 0.08, 0.9).toFixed(2); if (S.snap) w.th = Math.round(w.th * 50) / 50; D.moved = true; // symmetric about the wall's line; gain 1 keeps a small quantity controllable
    const px = wpx([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2, w.top]); D.tag = px ? { x: px[0] + 16, y: px[1] - 10, text: `thick ${f2(w.th)}` } : null; return renderStage();
  }
  if (D.kind === 'h-eave') {
    const r = findRaw(D.id); const pc = SC.entityPlanCentre(M, ent(r.id)); const ppm = pxPerMetreUp([...pc, SC.roofEave(D.orig)]); let dz = -dy / ppm;
    if (r.poly) { let z = Math.max(0.3, (D.orig.eave ?? 3) + dz); const m = heightMarks().find((mm) => Math.abs(mm.z - z) < 0.08); if (m && !ev.altKey) z = m.z; else if (S.snap) z = Math.round(z * 20) / 20; r.eave = +z.toFixed(2); D.moved = true; const q = wpx([...pc, r.eave]); D.tag = q ? { x: q[0] + 16, y: q[1] - 12, text: `at ${f2(r.eave)}${m && !ev.altKey ? ' · ' + m.labels[0] : ''}` } : null; return renderStage(); }
    const pr = D.orig.prof || SC.roofProf(D.orig); const top = SC.roofTop(D.orig); const last = pr.length - 1;
    let ez = pr[0][1] + dz; const m = heightMarks().find((mm) => Math.abs(mm.z - ez) < 0.08); if (m && !ev.altKey) ez = m.z; else if (S.snap) ez = Math.round(ez * 20) / 20;
    ez = Math.min(ez, top - 0.1); dz = ez - pr[0][1];
    r.prof = pr.map(([s0, z], i) => [s0, +(i === 0 || i === last ? z + dz : z).toFixed(2)]); D.moved = true;
    const p = wpx([(r.x0 + r.x1) / 2, r.y0, SC.roofEave(r)]); D.tag = p ? { x: p[0] + 16, y: p[1] + 18, text: `eave ${f2(SC.roofEave(r))} · ridge stays${m && !ev.altKey ? ' · ' + m.labels[0] : ''}` } : null; return renderStage();
  }
  if (D.kind === 'h-pz') {
    const r = findRaw(D.id); const c = SC.centroid2(D.orig.poly); const ppm = pxPerMetreUp([...c, D.orig.z]); let z = Math.max(0.05, D.orig.z - dy / ppm);
    const m = heightMarks().find((mm) => mm.ids.every((id) => id !== r.id) && Math.abs(mm.z - z) < 0.06); if (m && !ev.altKey) z = m.z; else if (S.snap) z = Math.round(z * 20) / 20;
    r.z = +z.toFixed(2); D.moved = true; const p = wpx([...c, r.z]); D.tag = p ? { x: p[0] + 16, y: p[1] - 14, text: `surface at ${f2(r.z)}${m && !ev.altKey ? ' · ' + m.labels[0] : ''}` } : null; return renderStage();
  }
  if (D.kind.startsWith('h-pv-')) {
    const r = findRaw(D.id); const i = +D.kind.slice(5); const p = onPlane(ev, r.z); if (!p) return; const q = snapPt(p, { noEnds: true }).p; r.poly[i] = q; D.moved = true;
    const px = wpx([...q, r.z]); D.tag = px ? { x: px[0] + 12, y: px[1] - 12, text: `${SC.polyArea(r.poly).toFixed(1)} m²` } : null; return renderStage();
  }
  if (['h-ow-a', 'h-ow-b', 'h-oh', 'h-os'].includes(D.kind)) {
    const e = findRaw(D.id); const w = SC.wallById(M, e.host); if (!w) return; const hit = wallHit(w, ev); const L = SC.wallLen(w); const art = e.c != null; D.moved = true;
    const o = { ...e }; const snap = (x) => (S.snap ? Math.round(x * 20) / 20 : x);
    if (D.kind === 'h-ow-a' || D.kind === 'h-ow-b') { const t0 = D.orig.at - D.orig.w / 2, t1 = D.orig.at + D.orig.w / 2; let a = t0, b = t1; if (D.kind === 'h-ow-a') a = Math.min(snap(hit.t), t1 - 0.3); else b = Math.max(snap(hit.t), t0 + 0.3); o.at = (a + b) / 2; o.w = b - a; }
    if (D.kind === 'h-oh') { if (art) o.h = Math.max(0.2, snap(Math.abs(hit.z - e.c) * 2)); else o.h = Math.max(0.3, snap(hit.z - e.sill)); }
    if (D.kind === 'h-os') { const head = D.orig.sill + D.orig.h; o.sill = Math.max(w.base, Math.min(snap(hit.z), head - 0.3)); o.h = head - o.sill; }
    const others = (art ? M.artworks : M.openings).filter((x) => x.host === e.host && x.id !== e.id);
    const clash = others.find((x) => Math.abs(x.at - o.at) < (x.w + o.w) / 2 + 0.05);
    const px = wpx([...SC.wallPoint(w, clamp(o.at, 0, L)), art ? o.c + o.h / 2 : o.sill + o.h]);
    const bad = o.at - o.w / 2 < 0.1 || o.at + o.w / 2 > L - 0.1 ? 'past the wall end' : clash ? `overlaps ${clash.name}` : !art && o.sill + o.h > w.top - 0.05 ? `doesn't fit under ${w.name}'s top` : null;
    if (bad) { D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: bad, refuse: true } : null; return renderOverlay(); }
    Object.assign(e, { at: +o.at.toFixed(2), w: +o.w.toFixed(2), h: +o.h.toFixed(2), sill: o.sill != null ? +o.sill.toFixed(2) : e.sill });
    D.tag = px ? { x: px[0] + 14, y: px[1] - 10, text: D.kind === 'h-os' ? `sill ${f2(e.sill - w.base)}` : D.kind === 'h-oh' ? `height ${f2(e.h)}` : `width ${f2(e.w)}` } : null; return renderStage();
  }
  if (D.kind === 'h-ridge') {
    const r = findRaw(D.id); const pr = D.orig.prof || SC.roofProf(D.orig); const ppm = pxPerMetreUp([(r.x0 + r.x1) / 2, r.y0, SC.roofTop(D.orig)]); const dz = -dy / ppm;
    const flat = SC.roofFlat(D.orig); const isPeak = (i) => i > 0 && i < pr.length - 1 && pr[i][1] >= pr[i - 1][1] && pr[i][1] >= pr[i + 1][1];
    r.prof = pr.map(([s, z], i) => [s, +(flat || isPeak(i) ? Math.max(SC.roofEave(D.orig), z + dz) : z).toFixed(2)]);
    D.moved = true; const p = wpx([(r.x0 + r.x1) / 2, r.y0 + pr[pr.findIndex((q, i) => flat || isPeak(i))][0], SC.roofTop(r)]); D.tag = p ? { x: p[0] + 18, y: p[1] - 14, text: `top ${f2(SC.roofTop(r))}` } : null; return renderStage();
  }
}
function stageUp(ev) {
  const D = R.D; R.D = null; if (!D) return;
  if (D.kind === 'orbit' || D.kind === 'pan') { if (!D.moved && D.clear) { if (S.editShape) return; selectId(null); S.readChip = null; render(); } return; }
  if (D.kind === 'inkSketch') { let pts = T.simplify(S.ink.pts, 0.35).map((p) => snapPt(p).p); const closed = pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.9; if (closed) pts = pts.slice(0, -1); return T.finishInk(pts, closed); }
  if (D.kind === 'inkBox' || D.kind === 'inkRound') { const pts = S.ink.pts; if (pts.length < 4 || SC.polyArea(pts) < 0.5) { S.ink = null; return render(); } return T.finishInk(pts, true); }
  if (D.kind === 'inkSection') return finishSectionStroke(S.ink.pts);
  if (D.kind === 'inkOpen' || D.kind === 'inkOpenFlat') {
    S.ink = null; let o; if (!D.b) return render();
    if (D.kind === 'inkOpen' && D.round) { const r = Math.max(0.2, Math.hypot(D.b.t - D.a.t, D.b.z - D.a.z)); o = { host: D.wall.id, at: D.a.t, w: r * 2, h: r * 2, sill: Math.max(D.wall.base, D.a.z - r), round: true }; }
    else if (D.kind === 'inkOpen') { const t0 = Math.min(D.a.t, D.b.t), t1 = Math.max(D.a.t, D.b.t), z0 = Math.min(D.a.z, D.b.z), z1 = Math.max(D.a.z, D.b.z); o = { host: D.wall.id, at: (t0 + t1) / 2, w: Math.max(0.6, t1 - t0), h: Math.max(0.6, z1 - z0), sill: z0 - D.wall.base < 0.3 ? D.wall.base : z0 }; }
    else { const w = D.wall; const t0 = Math.min(D.a[0], D.b[0]) - D.u0, t1 = Math.max(D.a[0], D.b[0]) - D.u0, z1 = -Math.min(D.a[1], D.b[1]), z0 = -Math.max(D.a[1], D.b[1]); o = { host: w.id, at: (t0 + t1) / 2, w: Math.max(0.4, t1 - t0), h: Math.max(0.4, z1 - Math.max(0, z0)), sill: w.base + (z0 < 0.3 ? 0 : z0) }; }
    if (S.snap) for (const k of ['at', 'w', 'h', 'sill']) o[k] = Math.round(o[k] * 20) / 20;
    const w = SC.wallById(M, o.host); if (o.sill + o.h > w.top - 0.05) { toast(`Refused: ${f2(o.sill + o.h - w.base)} m doesn't fit under ${w.name}'s top.`, true); return render(); }
    const kind = o.round ? 'Round window' : o.sill - w.base < 0.01 ? 'Door' : 'Window'; const id = uid('o'); M.openings.push({ id, name: `${kind} ${id.slice(2)}`, ...o }); commit(`Ink ${kind.toLowerCase()}`); S.sel = id; return render();
  }
  if (D.kind === 'slice') { if (!D.b || Math.hypot(D.b[0] - D.a[0], D.b[1] - D.a[1]) < 0.6) S.slice = D.prev || null; return render(); }
  if (['sl-move', 'sl-depth', 'sl-a', 'sl-b'].includes(D.kind)) return render();
  if (D.kind === 'lasso') { T.markFromLasso(); return T.eraseRelease(stagePx(ev)); }
  if (D.kind === 'scrub') {
    S.lassoPoly = null;
    if (!D.moved) {
      if (S.erase) { if (D.hid) { if (S.marked.has(D.hid)) S.marked.delete(D.hid); else if (T.passFilter(D.hid)) S.marked.add(D.hid); } return render(); }
      if (D.hid && T.passFilter(D.hid)) { S.marked.clear(); return T.eraseNow([D.hid], stagePx(ev)); }
      S.marked.clear(); return render();
    }
    return T.eraseRelease(stagePx(ev));
  }
  if (D.kind === 'brush') { if (D.ids.size) commit(`Paint ${D.ids.size === 1 ? ent([...D.ids][0])?.name : D.ids.size + ' surfaces'} ${S.brush.name}`); return render(); }
  if (D.kind === 'newview') { const b = onPlane(ev, 0); if (!b || Math.hypot(b[0] - D.a[0], b[1] - D.a[1]) < 0.5) return render(); const id = uid('v'); M.views.push({ id, name: `View ${id.slice(2)}`, pos: [...D.a, 1.6], target: [...b, 1.4], lens: 40 }); let p = pres(S.sel) || M.presentations.find((pp) => pp.views.includes(S.sel)); if (!p) { p = { id: uid('p'), name: 'Untitled presentation', views: [], def: id, subject: null }; M.presentations.push(p); } p.views.push(id); commit('Place View'); S.sel = id; return render(); }
  if (D.kind === 'pathpt') { commit('Move path point'); return render(); }
  if (D.kind === 'joint') { const r = ent(D.id); if (D.moved || D.added) commit(`Reshape ${r.name}`); return render(); }
  if (D.kind === 'h-size' && !D.moved && R.clickToOpen) { S.sizeOpen = S.sizeOpen === D.id ? null : D.id; R.clickToOpen = null; return render(); }
  if (D.kind.startsWith('h-') || D.kind === 'move' || D.kind === 'slide') {
    if (D.moved && JSON.stringify(findRaw(D.id)) !== JSON.stringify(D.orig)) { const e = ent(D.id); commit(`${{ 'h-rotate': 'Turn', 'h-top': 'Raise', 'h-size': 'Scale', 'h-w': e?.fit === 'extend' ? 'Extend' : 'Stretch', 'h-w-': e?.fit === 'extend' ? 'Extend' : 'Stretch', 'h-d': 'Stretch', 'h-d-': 'Stretch', 'h-h': 'Raise', 'h-ridge': 'Reshape', 'h-eave': 'Set the eaves of', 'h-th': 'Thicken', 'h-pz': 'Raise', 'h-ow-a': 'Resize', 'h-ow-b': 'Resize', 'h-oh': 'Resize', 'h-os': 'Move the sill of' }[D.kind] || (D.kind.startsWith('h-pv-') ? 'Reshape' : null) || 'Move'} ${e?.name || ''}`); }
    return render();
  }
}
/** An Ink stroke drawn across a roof's section plane becomes its new profile. */
function finishSectionStroke(px, padMap) {
  S.ink = null;
  const r = findRaw(S.editShape.id); const span = r.y1 - r.y0; let pts;
  if (padMap) pts = px.map(padMap);
  else { const ref = [roofSectionX(r), r.y0, SC.roofEave(r)], o = wpx(ref); if (!o) return render(); pts = px.map((p) => { const [dy, dz] = dragOnPlane(ref, [0, 1, 0], [0, 0, 1], [p[0] - o[0], p[1] - o[1]]); return [dy, ref[2] + dz]; }); }
  pts = pts.filter(([s]) => s > -1 && s < span + 1).map(([s, z]) => [clamp(s, 0, span), Math.max(0.3, z)]).sort((a, b) => a[0] - b[0]);
  if (pts.length < 3) { toast('Draw across the section, from one eave to the other.', true); return render(); }
  let simp = T.simplify(pts, 0.25); simp[0][0] = 0; simp.at(-1)[0] = span;
  r.prof = simp.map(([s, z]) => [+s.toFixed(2), +z.toFixed(2)]); commit(`Draw a new section for ${r.name}`); S.editShape.joint = null; render();
}
function placeGhost(ev, hid) {
  const a = S.placing; const e = ent(hid);
  if (a.kind === 'artwork') {
    if (e && e.kind === 'wall' && R.mode !== 'plan') { const t = wallHit(e, ev); const c = e.base + 1.6; S.placing.ghost = { px: [[t.t - a.w / 2, c - a.h / 2], [t.t + a.w / 2, c - a.h / 2], [t.t + a.w / 2, c + a.h / 2], [t.t - a.w / 2, c + a.h / 2]].map(([s, z]) => wpx([...SC.wallPoint(e, s), z])), label: `on ${e.name}` }; }
    else { const [x, y] = stagePx(ev); S.placing.ghost = { px: [[x - 20, y - 14], [x + 20, y - 14], [x + 20, y + 14], [x - 20, y + 14]], bad: true, label: 'needs a wall face' }; }
    return renderOverlay();
  }
  const p = onPlane(ev, S.sheet.h); if (!p) return; const q = snapPt(p, { noEnds: true }).p;
  const pts = [[-a.w / 2, -a.d / 2], [a.w / 2, -a.d / 2], [a.w / 2, a.d / 2], [-a.w / 2, a.d / 2]].map(([u, v]) => wpx([q[0] + u, q[1] + v, S.sheet.h]));
  if (pts.some((x) => !x)) return;
  S.placing.ghost = { px: pts, label: roomOf({ kind: 'object', x: q[0], y: q[1], z: S.sheet.h })?.name || 'outside' }; renderOverlay();
}

// ---------------- clicks on chrome ----------------
function closePops() { S.ctx = null; S.viewMore = false; S.appMenu = false; S.find.open = false; S.brushPick = false; S.eraseFilterOpen = false; S.sibs = null; }
function onClick(ev) {
  if (!ev.target.isConnected) return; // an earlier listener (the tour card) already re-rendered what was clicked
  const wf = ev.target.closest('[data-wf]');
  if (wf) {
    const k = wf.dataset.wf, v = wf.dataset.v;
    if (k === 'tour') startTour(v);
    if (k === 'cmp') { if (wf.dataset.k === 'pen') S.inkShape = false; S.cmp[wf.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; if (wf.dataset.k === 'section' && S.editShape) { S.editShape.pos = null; T.setEditView(S.editShape.view); } }
    if (k === 'width') S.width = v;
    if (k === 'scenario') loadScenario(v);
    $('#wfmenu').style.display = 'none'; $('#wfmenu').dataset.kind = ''; render(); return;
  }
  const wb = ev.target.closest('[data-wfbar]'); if (wb) return wfMenu(wb.dataset.wfbar, wb);
  if (!ev.target.closest('#wfmenu')) { $('#wfmenu').style.display = 'none'; $('#wfmenu').dataset.kind = ''; }
  if (ev.target.closest('#tourlayer')) return;
  const b = ev.target.closest('[data-act]');
  if (!b) { if (!ev.target.closest('.pop, .picker, .pfly, #findbox, #findlist') && (S.ctx || S.viewMore || S.appMenu || S.find.open || S.brushPick || S.sibs)) { closePops(); render(); } return; }
  if (b.closest('#world')) return;
  const a = b.dataset.act, v = b.dataset.v, id = b.dataset.id;
  const keepPop = ['viewmore', 'appmenu', 'brushpick', 'efilteropen', 'sibs', 'pref-topdown', 'elevface', 'projection', 'overhead', 'efilter', 'efilterall', 'brushset', 'findrun', 'ctxcard'];
  if (!keepPop.includes(a)) closePops();
  const A = {
    noop() { toast('Not in this wireframe.'); },
    lens() { if (S.lens === v) return; parkWorld(); S.lens = v; S.tool = 'select'; S.readChip = null; },
    undo, redo,
    preview() { S.preview = { i: 0, mode: 'guided', device: 'desktop' }; },
    pvexit() { S.preview = null; }, pvnav() { S.preview.i = clamp(S.preview.i + +v, 0, guide().stops.length - 1); }, pvmode() { S.preview.mode = v; }, pvdev() { S.preview.device = v; },
    appmenu() { S.appMenu = !S.appMenu; }, 'pref-topdown'() { S.prefs.topDown = v; return render(true); }, keys() { toast('V P K E B M tools · A Library · 1 3D · 2 2D · 4 eye · [ ] turn · F focus · \\ Index · ⌘K Find · Del erase · Esc unwinds'); },
    indexclose() { S.indexOpen = false; if (S.cmp.collapse === 'peek' && !S.hints.peek) { S.hints.peek = true; toast('Index hidden · hover the left edge or press \\ to bring it back'); } },
    indexopen() { S.indexOpen = true; S.peek = false; }, indextoggle() { S.indexOpen = !S.indexOpen; },
    sel() { selectId(id); if (S.mid && ev.target.closest('.index.ov')) {} if (ev.detail === 2 && view(id)) return X.lookThrough(id); },
    deselect() { if (S.editShape) T.closeEditShape(); selectId(null); },
    scope() { enterScope(b.dataset.k, id); },
    sibs() { S.sibs = S.sibs === b.dataset.k ? null : b.dataset.k; },
    facet() { S.facet = v; S.more = {}; },
    more() { S.more[b.dataset.k] = (S.more[b.dataset.k] || 40) + 200; },
    untray() { const t = M.tray.splice(+b.dataset.i, 1)[0]; const { coll, ...rest } = t; if (!SC.wallById(M, rest.host)) { M.tray.splice(+b.dataset.i, 0, t); return toast(`${rest.name}'s wall is gone — it needs a new host.`, true); } M[coll].push(rest); commit(`Put back ${rest.name}`); },
    tool() { if (S.tool === v && v !== 'select') { S.palOpen = !S.palOpen; S.brushPick = false; S.eraseFilterOpen = false; return; } setTool(v); },
    palclose() { S.palOpen = false; S.brushPick = false; S.eraseFilterOpen = false; },
    inkshape() { S.inkShape = !S.inkShape; toast(S.inkShape ? 'Shape intent: strokes become ordinary profiles until you put Ink down' : 'Back to architecture: strokes read the surface they land on'); },
    efilterall() { for (const k of Object.keys(S.eraseFilter)) S.eraseFilter[k] = true; S.eraseFilterOpen = true; },
    opt() { S[b.dataset.k] = S[b.dataset.k] === v && b.dataset.k === 'brushMode' ? null : v; if (b.dataset.k === 'eraseMode') { S.marked.clear(); S.erase = null; S.lassoPoly = null; } if (b.dataset.k === 'sliceMode' && S.slice) S.slice = null; },
    inkmore() { toast('Room for more pens later (stair, arc, offset) — kept out of the ordinary column.'); },
    efilteropen() { S.eraseFilterOpen = !S.eraseFilterOpen; }, efilter() { S.eraseFilter[v] = !S.eraseFilter[v]; S.eraseFilterOpen = true; },
    eexcl() { const E = S.erase; if (E.excl.has(v)) { E.excl.delete(v); } else { E.excl.add(v); S.marked = new Set([...S.marked].filter((x) => (ent(x)?.kind === 'import' ? 'object' : ent(x)?.kind) !== v)); } if (S.lassoPoly) T.markFromLasso(); },
    brushpick() { S.brushPick = !S.brushPick; }, brushset() { S.brush = { ...S.brush, type: b.dataset.t, name: b.dataset.n, color: b.dataset.c }; S.brushPick = false; if (S.tool !== 'brush') setTool('brush'); if (S.instrument?.kind === 'assets') S.instrument = null; },
    brushscope() { S.brush.scope = v; },
    viewmore() { S.viewMore = !S.viewMore; },
    reading() { S.look = null; S.lift = false; S.reading = v; S.viewMore = false; S.lookThrough = null; return render(true); },
    esview() { return T.setEditView(v); },
    elevface() { S.reading = 'elev'; S.elevFace = v; S.look = null; S.viewMore = false; return render(true); },
    projection() { S.projection = v; S.reading = '3d'; return render(true); }, overhead() { S.overhead = v; },
    grid() { S.grid = !S.grid; }, snap() { S.snap = !S.snap; },
    zoom() { camState().z *= +v; }, fit() { const c = camState(); c.z = 1; c.pan = [0, 0]; },
    toheight() { setSheet(+v); S.tickFlash = +v; clearTimeout(tickT); tickT = setTimeout(() => { S.tickFlash = null; renderSheet(); }, 1600); }, pin() { pinHeight(v ? +v : S.sheet.h); }, hintx() { S.hint = null; S.hints.pin = true; },
    focus() { S.focus = !S.focus; }, sheetside() { S.sheet.side = S.sheet.side === 'right' ? 'left' : 'right'; },
    cardmore() { S.cardMore = !S.cardMore; },
    look() { return startLook(v); }, putback() { return putBack(); }, lift() { S.lift = !S.lift; },
    dimfix() { const f = S.dimRefuse.fix; return applyDim(f.k, f.v); },
    repair() { S.instrument = { kind: 'repair' }; },
    repairposts() { M.loose = M.loose.filter((l) => l.id !== S.sel); const r = findRaw(S.sel); const z = SC.roofEave(r); [[r.x0 + 0.4, r.y0 + 0.4], [r.x1 - 0.4, r.y0 + 0.4], [r.x1 - 0.4, r.y1 - 0.4], [r.x0 + 0.4, r.y1 - 0.4]].forEach((p, i) => M.objects.push({ id: uid('post'), name: `Post ${i + 1}`, type: 'column', fit: 'stretch', x: p[0], y: p[1], w: 0.25, d: 0.25, h: z, rot: 0, z: 0 })); commit('Add posts'); S.instrument = null; },
    repairok() { M.loose = M.loose.filter((l) => l.id !== S.sel); commit('Accept loose end'); S.instrument = null; },
    instclose() { S.instrument = null; },
    findrun() { return runFind(+b.dataset.i); },
    cap() { S.ctx = null; return runCap(v); },
    ctxcard() { const r = b.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(); S.ctx = { id: S.sel, x: r.left - sr.left - 200, y: r.bottom - sr.top + 4 }; return renderFloat(); },
    rename() {
      const e = selEntity(); const raw = findRaw(e.id) || view(e.id) || pres(e.id) || level(e.id); if (!raw) return;
      b.contentEditable = 'true'; b.focus(); document.getSelection().selectAllChildren(b);
      const done = (ok) => { b.removeEventListener('keydown', key); b.removeEventListener('blur', blur); const n = b.textContent.trim(); if (ok && n && n !== raw.name) { raw.name = n; commit(`Rename to ${n}`); } render(); };
      const key = (k) => { if (k.key === 'Enter') { k.preventDefault(); done(true); } if (k.key === 'Escape') { k.stopPropagation(); done(false); } };
      const blur = () => done(false); b.addEventListener('keydown', key); b.addEventListener('blur', blur); return null;
    },
    reread() { return T.reread(+b.dataset.i); },
    assets() { S.instrument = S.instrument?.kind === 'assets' ? null : { kind: 'assets', tab: 'objects' }; },
    atab() { S.instrument.tab = v; },
    pick() { const [n, type, fit, w, d, hh] = T.ASSETS[b.dataset.tab][+b.dataset.i]; S.placing = { name: n, kind: b.dataset.tab === 'art' ? 'artwork' : 'object', type, fit, w, d, h: hh }; S.tool = 'place'; S.instrument = null; },
    mockimport() { S.placing = { name: 'Boat hull', kind: 'object', type: 'import', fit: 'stretch', w: 4.2, d: 1.4, h: 1.1, imported: true }; S.tool = 'place'; S.instrument = null; toast('Boat hull.glb imported as fixed geometry — click to place'); },
    'erase-apply'() { return T.eraseApply(); },
    'erase-cancel'() { S.marked.clear(); S.erase = null; S.lassoPoly = null; S.eraseLock = null; },
    'confirm-yes'() { const ids = S.confirm.ids; S.confirm = null; return T.eraseApply(ids); }, 'confirm-no'() { S.confirm = null; S.marked.clear(); },
    'slice-flip'() { S.slice.flip = !S.slice.flip; return render(true); }, 'slice-clear'() { S.slice = null; if (S.reading === 'section') S.reading = '3d'; return render(true); },
    'es-done'() { return T.closeEditShape(); }, 'es-expand'() { S.editShape.expanded = !S.editShape.expanded; }, 'es-joint'() { S.editShape.joint = +v; },
    'es-preset'() { T.applyPreset(ent(S.editShape.id), v); },
    guide() { S.guideOpen = !S.guideOpen; if (!S.guideOpen) { S.playing = false; S.follow = false; } },
    play() { X.play(); }, follow() { S.follow = !S.follow; return render(true); },
    addstop() { const g = guide(); const p = pres(S.sel) || M.presentations[0]; g.stops.push({ id: uid('s'), pres: p.id, views: [p.def], hold: 4 }); g.edges.push({ mode: 'travel', dur: 4 }); commit(`Add Stop · ${p.name}`); },
    lookthrough() { return X.lookThrough(id); },
    'lt-update'() { const v0 = view(S.lookThrough.id); v0.target = [...S.lookThrough.target]; commit(`Update View ${v0.name}`); S.lookThrough = null; toast(`Updated ${v0.name}`); return render(true); },
    'lt-exit'() { S.lookThrough = null; return render(true); },
    makedef() { const p = M.presentations.find((pp) => pp.views.includes(id)); p.def = id; commit('Make default'); },
    capture() { return X.capture(); },
    newpres() { const p = { id: uid('p'), name: 'Untitled presentation', views: [], def: null, subject: null }; M.presentations.push(p); commit('New Presentation'); S.sel = p.id; },
    hold() { const e = X.expEnt(S.sel); const s = guide().stops[e.idx]; s.hold = Math.max(1, s.hold + +v); commit('Change hold'); },
    include() { const e = X.expEnt(S.sel); guide().stops[e.idx].views.push(id); commit('Include View'); },
    edgemode() { const e = X.expEnt(S.sel); guide().edges[e.idx].mode = v; commit(v === 'cut' ? 'Make Cut' : 'Make Travel'); },
    edgedur() { const e = X.expEnt(S.sel); const ed = guide().edges[e.idx]; ed.dur = Math.max(1, ed.dur + +v); commit('Change travel time'); },
    openexp() { parkWorld(); S.lens = 'experience'; S.sel = id; S.tool = 'select'; },
    presentthis() { return X.presentThis(); },
  };
  const fn = A[a]; if (!fn) return;
  const r = fn(); if (r === undefined) render();
}
function runFind(i) { const r = findResults()[i]; if (!r) return; S.find = { q: '', open: false, idx: 0 }; $('#findin')?.blur(); runCap(r.a); }

// ---------------- wireframe bar ----------------
function wfMenu(kind, anchor) {
  const m = $('#wfmenu'); if (m.dataset.kind === kind && m.style.display !== 'none') { m.style.display = 'none'; m.dataset.kind = ''; return; }
  m.dataset.kind = kind; m.style.display = 'block'; m.style.left = Math.min(anchor.offsetLeft, window.innerWidth - 380) + 'px';
  const opt = (k, v, l) => `<button data-wf="cmp" data-k="${k}" data-v="${v}" class="${S.cmp[k] === v ? 'on' : ''}">${l}</button>`;
  if (kind === 'tours') m.innerHTML = `<h6>Guided tours · step by step</h6>${TOURS.map((t) => `<button data-wf="tour" data-v="${t.id}" class="${S.tour?.id === t.id ? 'on' : ''}">${t.t}<small>${t.d}</small></button>`).join('')}`;
  if (kind === 'compare') m.innerHTML = `<div class="note">Round 2 open choices. The first option in each group is the recommendation.</div>`
    + `<h6>Object manipulation</h6>${opt('manip', 'rays', 'A · Axis rays out of the subject (Reference B, recommended)')}${opt('manip', 'dims', 'B · Dimension lines beside the edges (Reference A)')}${opt('manip', 'knobs', 'C · Round 1.1 knobs, for comparison')}`
    + `<h6>Width · depth · height</h6>${opt('handles', 'progressive', 'Progressive: click the scale point (recommended)')}${opt('handles', 'immediate', 'Immediate: always shown')}`
    + `<h6>Architecture handles</h6>${opt('arch', 'rays', 'A · The same rays and points as objects (recommended)')}${opt('arch', 'grips', 'B · Edge grips: drag the edge itself, arrows on hover')}`
    + `<h6>Roof Section 2D</h6>${opt('section', 'stage', 'A · Takes the Stage as a reading (recommended)')}${opt('section', 'inset', 'B · Inset editor over the 3D Stage')}`
    + `<h6>Collapsed Index</h6>${opt('collapse', 'crumb', 'A · Location chip in the Head (recommended)')}${opt('collapse', 'peek', 'B · Translucent edge arrow, tap the edge on touch')}`
    + `<h6>Collapsed palette</h6>${opt('palCue', 'caret', 'Faint caret on the armed tool (recommended)')}${opt('palCue', 'none', 'Nothing; click the tool again')}`
    + `<h6>Eraser kinds</h6>${opt('eraser', 'filter', 'A · Filter disclosure in the palette (owner choice)')}${opt('eraser', 'context', 'B · Kind chips in the acceptance bar')}`
    + `<h6>When erasing asks</h6>${opt('threshold', 'simple', 'Only across domains; ≤3 simple things go at once (recommended)')}${opt('threshold', 'topology', 'Also when hosts, rooms or roofs are affected')}`
    + `<h6>One Pen, ordinary shapes</h6>${opt('pen', 'context', 'A · Context first: "Shape" is one more reading (recommended)')}${opt('pen', 'intent', 'B · A temporary Shape intent in the Ink palette')}`
    + `<h6>Tool colour</h6>${opt('toolColor', true, 'On · small marks under tool icons')}${opt('toolColor', false, 'Off')}`;
  if (kind === 'scenario') m.innerHTML = `<h6>Project</h6><button data-wf="scenario" data-v="boathouse" class="${S.scenario === 'boathouse' ? 'on' : ''}">Boathouse gallery<small>2 rooms · ordinary</small></button><button data-wf="scenario" data-v="dense" class="${S.scenario === 'dense' ? 'on' : ''}">Harbour museum<small>3 structures · 5 Levels · 40 rooms · 104 walls (52 shared) · 275 objects</small></button>`;
  if (kind === 'width') m.innerHTML = `<h6>Simulated frame</h6>${[['fill', 'Fill window'], ['laptop', 'Laptop 1440'], ['small', 'Small laptop 1280 × 800'], ['ipadL', 'iPad landscape 1180 × 820'], ['ipadP', 'iPad portrait 820']].map(([k, l]) => `<button data-wf="width" data-v="${k}" class="${S.width === k ? 'on' : ''}">${l}</button>`).join('')}<div class="note">Phones are out of scope for the editor. Preview has its own Phone frame.</div>`;
  if (kind === 'about') m.innerHTML = `<div class="note" style="padding:6px 8px">Round 2 wireframe: the visual-language pass. Mock state, SVG scenes, snapshot Undo. Not a contract, not production, not PLATE. Read DESIGN-NOTE.md.</div>`;
}

// ---------------- keys ----------------
function onKey(ev) {
  if (ev.target.isContentEditable) return;
  const k = ev.key, mod = ev.metaKey || ev.ctrlKey;
  if (mod && k.toLowerCase() === 'k') { ev.preventDefault(); S.find.open = true; renderHead(); $('#findin')?.focus(); return; }
  if (ev.target.id === 'findin') {
    const n = findResults().length;
    if (k === 'ArrowDown') { ev.preventDefault(); S.find.idx = (S.find.idx + 1) % n; return renderHead(), refocusFind(); }
    if (k === 'ArrowUp') { ev.preventDefault(); S.find.idx = (S.find.idx - 1 + n) % n; return renderHead(), refocusFind(); }
    if (k === 'Enter') { ev.preventDefault(); return runFind(S.find.idx); }
    if (k === 'Escape') { S.find = { q: '', open: false, idx: 0 }; ev.target.blur(); return renderHead(); }
    return;
  }
  if (ev.target.matches('input, select, textarea')) {
    if (k === 'Escape') { S.dimRefuse = null; ev.target.blur(); render(); }
    if (k === 'Enter' && ev.target.dataset.dim) applyDim(ev.target.dataset.dim, ev.target.value);
    if (k === 'Enter' && ev.target.dataset.joint) { const r = findRaw(S.editShape.id); const j = S.editShape.joint; const val = parseFloat(ev.target.value); if (!Number.isNaN(val)) { const [s, z] = r.prof[j]; T.moveJoint(r, j, ev.target.dataset.joint === 's' ? val : s, ev.target.dataset.joint === 'z' ? val : z, true); commit(`Reshape ${r.name}`); render(); } }
    if (k === 'Enter' && ev.target.id === 'sheetin') { const z = parseFloat(ev.target.value); S.sheet.editing = false; if (!Number.isNaN(z)) setSheet(clamp(z, 0, sheetMax())); render(); }
    return;
  }
  if (k === ' ') { if (S.lens === 'experience' && S.guideOpen) { ev.preventDefault(); X.play(); render(); } else spaceDown = true; return; }
  if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); return ev.shiftKey ? redo() : undo(); }
  if (k === 'Escape') return escape();
  if (k === 'Tab' && S.readChip) { ev.preventDefault(); return T.reread(); }
  if (k === 'Enter') { if (S.ink && S.inkTip === 'line') return T.finishInk(S.ink.pts, false); if (S.erase) return T.eraseApply(); if (S.editShape) return T.closeEditShape(); if (S.sel && ent(S.sel)?.kind === 'roof') return T.openEditShape(S.sel); }
  if (S.preview) { if (k === 'ArrowRight') { S.preview.i = clamp(S.preview.i + 1, 0, guide().stops.length - 1); X.renderPreview(); } if (k === 'ArrowLeft') { S.preview.i = clamp(S.preview.i - 1, 0, guide().stops.length - 1); X.renderPreview(); } return; }
  if (mod) return;
  const tools = S.lens === 'world' ? { v: 'select', p: 'ink', k: 'slice', e: 'eraser', b: 'brush', m: 'measure' } : { v: 'select', c: 'view', t: 'path' };
  if (tools[k.toLowerCase()]) { setTool(tools[k.toLowerCase()]); return render(); }
  if (k === 'a' && S.lens === 'world') { S.instrument = S.instrument?.kind === 'assets' ? null : { kind: 'assets', tab: 'objects' }; return render(); }
  if (S.editShape && (k === '1' || k === '2')) return T.setEditView(k === '2' ? 'section' : '3d');
  if ('1245'.includes(k) && k.length === 1) { const r = { 1: '3d', 2: 'plan', 4: 'eye', 5: 'section' }[k]; if (r === 'section' && !S.slice) return toast('Slice first (K).', true); S.reading = r; S.look = null; S.lookThrough = null; return render(true); }
  if (k === '[' || k === ']') { S.az += k === '[' ? -15 : 15; return renderStage(); }
  if (k === '\\') { S.indexOpen = !S.indexOpen; return render(); }
  if (k === 'l' && S.lens === 'world') { S.lift = !S.lift; return render(); }
  if (k === 'f' && S.lens === 'world') { S.focus = !S.focus; return render(); }
  if (k === 's' && S.sel && ent(S.sel)?.kind === 'object') { S.sizeOpen = S.sizeOpen ? null : S.sel; return render(); }
  if ((k === 'Delete' || k === 'Backspace') && S.sel && ent(S.sel)) { const c = R.CENT[S.sel]; return T.eraseNow([S.sel], c ? toPx(c) : [300, 300]); }
  if (k === 'r' && S.sel && ent(S.sel)?.kind === 'object') { const e = findRaw(S.sel); e.rot = ((e.rot || 0) + 15) % 360; commit(`Turn ${e.name}`); return render(); }
}
function refocusFind() { const i = $('#findin'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
function escape() {
  if (S.ctx || S.viewMore || S.appMenu || S.brushPick || S.eraseFilterOpen || S.sibs) { closePops(); return render(); }
  if (S.preview) { S.preview = null; return render(); }
  if (S.confirm) { S.confirm = null; S.marked.clear(); return render(); }
  if (S.erase) { S.erase = null; S.marked.clear(); S.lassoPoly = null; return render(); }
  if (R.D) { R.D = null; loadModel(H.stack[H.i].m); S.ink = null; S.lassoPoly = null; return render(); }
  if (S.ink) { S.ink = null; return render(); }
  if (S.readChip) { S.readChip = null; return render(); }
  if (S.editShape) return T.closeEditShape();
  if (S.lookThrough) { S.lookThrough = null; return render(true); }
  if (S.instrument) { S.instrument = null; return render(); }
  if (S.look || S.lift) return putBack();
  if (S.slice) { S.slice = null; if (S.reading === 'section') S.reading = '3d'; return render(true); }
  if (S.focus) { S.focus = false; return render(); }
  if (S.tool !== 'select' && S.palOpen && document.querySelector('#lower .pcol')) { S.palOpen = false; return render(); }
  if (S.tool !== 'select') { setTool('select'); return render(); }
  if (S.sel) { selectId(null); return render(); }
  if (S.guideOpen) { S.guideOpen = false; S.playing = false; return render(); }
  if (S.meas) { S.meas = null; return render(); }
}

// ---------------- boot ----------------
function boot() {
  loadScenario('boathouse');
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });
  const st = $('#stage');
  st.addEventListener('pointerdown', stageDown);
  st.addEventListener('pointermove', stageMove);
  st.addEventListener('pointerup', stageUp);
  st.addEventListener('pointerleave', () => { if (!R.D && S.hover) { S.hover = null; if (S.tool === 'eraser' && !S.erase) S.marked.clear(); renderStage(); } });
  st.addEventListener('contextmenu', (ev) => {
    ev.preventDefault(); if (S.lens !== 'world') return;
    const hid = ev.target.closest('#world [data-id]')?.dataset.id; const r = st.getBoundingClientRect();
    if (hid) selectId(hid);
    S.ctx = { id: hid || null, x: clamp(ev.clientX - r.left, 8, r.width - 250), y: clamp(ev.clientY - r.top, 8, r.height - 300) }; render();
  });
  st.addEventListener('wheel', (ev) => {
    if (ev.target.closest('.esfloat, #card, .pop')) return;
    ev.preventDefault();
    if (S.reading === 'eye' && !S.lookThrough) { const f = SC.norm(SC.sub(S.eye.target, S.eye.pos)); const d = -ev.deltaY * 0.01; S.eye.pos = SC.add(S.eye.pos, [f[0] * d, f[1] * d, 0]); S.eye.target = SC.add(S.eye.target, [f[0] * d, f[1] * d, 0]); return renderStage(); }
    const cs = camState(); const before = toVB(ev); cs.z = clamp(cs.z * Math.exp(-ev.deltaY * 0.0015), 0.4, 12); renderStage(); const after = toVB(ev); cs.pan = [cs.pan[0] + before[0] - after[0], cs.pan[1] + before[1] - after[1]]; renderStage();
  }, { passive: false });
  // height Sheet knob: drag snaps to Levels, surfaces and pins; ⌥ for free heights
  document.addEventListener('pointerdown', (ev) => {
    const kn = ev.target.closest('#sheetknob'); if (!kn || ev.target.closest('.pinbtn, input')) return; ev.preventDefault();
    const tr = $('#sheettrack').getBoundingClientRect(); const zMax = sheetMax(); const marks = heightMarks();
    const move = (e) => { let z = clamp((1 - (e.clientY - tr.top) / tr.height) * zMax, 0, zMax); const pxTol = (10 / tr.height) * zMax; const m = marks.find((mm) => Math.abs(mm.z - z) < pxTol); if (m && !e.altKey) z = m.z; else z = Math.round(z * 20) / 20; S.sheet.drag = true; setSheet(z); renderSheet(); renderStage(); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); S.sheet.drag = false; render(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
  document.addEventListener('dblclick', (ev) => {
    if (ev.target.closest('#sheetknob')) { S.sheet.editing = true; renderSheet(); const i = $('#sheetin'); i.focus(); i.select(); i.addEventListener('blur', () => { S.sheet.editing = false; renderSheet(); }, { once: true }); return; }
    const t = ev.target.closest('.thumb[data-id]'); if (t && view(t.dataset.id)) X.lookThrough(t.dataset.id);
  });
  // scrub bar
  document.addEventListener('pointerdown', (ev) => {
    const bar = ev.target.closest('#scrubbar'); if (!bar) return;
    const set = (e) => { const r = bar.getBoundingClientRect(); S.t = clamp((e.clientX - r.left) / r.width, 0, 1) * X.guideTimeline().total; S.playing = false; renderStage(); renderLower(); };
    set(ev); const up = () => { document.removeEventListener('pointermove', set); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', set); document.addEventListener('pointerup', up);
  });
  // section pad (floating panel or Card posture): joints, ＋ to add, Ink to redraw
  document.addEventListener('pointerdown', (ev) => {
    const svg = ev.target.closest('#espad'); if (!svg || !S.editShape) return; ev.preventDefault(); ev.stopPropagation();
    const r = findRaw(S.editShape.id); const toPad = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, -q.y]; };
    if (S.tool === 'ink') {
      const pts = [toPad(ev)]; const mv = (e) => pts.push(toPad(e));
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); finishSectionStroke(pts, (p) => p); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); return;
    }
    const pj = ev.target.closest('[data-pj]')?.dataset.pj; if (pj == null) return;
    let i;
    if (pj.startsWith('add-')) { i = +pj.slice(4); const a = r.prof[i], b = r.prof[i + 1]; r.prof.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i += 1; }
    else { i = +pj; if (ev.altKey && i > 0 && i < r.prof.length - 1) { r.prof.splice(i, 1); commit(`Remove a joint of ${r.name}`); S.editShape.joint = null; return render(); } }
    S.editShape.joint = i; let moved = pj.startsWith('add-');
    const mv = (e) => { const [s, z] = toPad(e); T.moveJoint(r, i, s, z, e.altKey); moved = true; renderStage(); const host = svg.parentElement; const w = svg.getAttribute('width'), h = svg.getAttribute('height'); host.querySelector('#espad').outerHTML = T.padSvg(ent(r.id), w, h); };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (moved) commit(`Reshape ${r.name}`); render(); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }, true);
  // dragging the floating section editor by its header
  document.addEventListener('pointerdown', (ev) => {
    const h = ev.target.closest('[data-drag="esfloat"]'); if (!h || ev.target.closest('button')) return;
    const box = h.parentElement; const sr = $('#stage').getBoundingClientRect(); const ox = ev.clientX - box.offsetLeft, oy = ev.clientY - box.offsetTop;
    const mv = (e) => { S.editShape.pos = [e.clientX - ox, e.clientY - oy]; box.style.left = S.editShape.pos[0] + 'px'; box.style.top = S.editShape.pos[1] + 'px'; };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  });
  // Index peek (collapsed treatment B)
  document.addEventListener('pointermove', (ev) => {
    if (S.indexOpen || S.cmp.collapse !== 'peek') return;
    const sr = $('#stage').getBoundingClientRect(); const near = ev.clientX - sr.left < 18 && ev.clientY > sr.top && ev.clientY < sr.bottom;
    const onTab = ev.target.closest?.('.peekarrow');
    if ((near || onTab) !== S.peek) { S.peek = !!(near || onTab); renderIndex(); }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'isearch') { if (S.lens === 'world') S.search = ev.target.value; else S.exSearch = ev.target.value; const pos = ev.target.selectionStart; renderIndex(); const i = $('#isearch'); i.focus(); i.setSelectionRange(pos, pos); }
    if (ev.target.id === 'findin') { S.find.q = ev.target.value; S.find.open = true; S.find.idx = 0; $('#findlist').innerHTML = ''; renderHead(); refocusFind(); }
  });
  document.addEventListener('focusin', (ev) => { if (ev.target.id === 'findin' && !S.find.open) { S.find.open = true; renderHead(); refocusFind(); } });
  document.addEventListener('focusout', (ev) => { if (ev.target.id === 'findin' && S.find.open && !ev.relatedTarget?.closest('#findlist')) setTimeout(() => { if (document.activeElement?.id !== 'findin' && S.find.open) { S.find = { q: '', open: false, idx: 0 }; renderHead(); } }, 150); });
  new ResizeObserver(() => render()).observe($('#stage'));
  window.addEventListener('resize', () => render());
  render();
}
boot();
const atlasKey = new URLSearchParams(location.search).get('atlas');
if (atlasKey) import('./atlas.js').then((A) => A.applyAtlas(atlasKey));
window.__wf = { S, M, R, H, render, loadScenario, T, X };
