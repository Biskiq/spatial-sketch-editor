// Museum Editor — "Conservatory" (World + Experience shell). Design simulation, mock data.
import { Stage3D, Thumbs } from './stage3d.js';
import { Plan } from './plan.js';
import * as W from './world.js';
import { viewPose, buildTimeline, evaluate, pathKey, fmtTime, routeWarning, routeLength } from './camera.js';
import { openVisitor } from './visitor.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
let uid = 1; const nid = (p) => `${p}_${Date.now().toString(36)}${(uid++).toString(36)}`;

// ——— state ———
let doc = W.seedPopulated();
const ui = {
  domain: 'experience', selBy: {},
  stage: 'plan', index: 'full', drawer: false, device: 'desktop',
  sel: null, nav: [],
  expanded: new Set(),
  guide: false,          // the Guide authoring context is invoked (Index → Guide), never global chrome
  density: 'full',       // Guide instrument: 'full' (Stop cards + overview) | 'compact' (overview only)
  vis: { scope: 'all', markers: true, cones: true, paths: true, labels: true }, // editor visibility only
  ixq: '', vq: '', vfilter: 'all', outOpen: false,
  world: { tool: null, measure: [], details: false, room: 'salon' },
  look: null,            // { viewId, saved, modified }
  tool: null,            // { kind:'place', presId|null }
  play: { playing: false, t: 0, follow: false, saved: null, stopAt: null },
  visitor: null,
};
const undoStack = [], redoStack = [];
let gesture = false;

const app = $('#app'), frame = $('#frame');
const stageEl = $('#stage');
const stage3d = new Stage3D($('#three-host'));
const thumbs = new Thumbs(stage3d);
const plan = new Plan($('#plan-host'), {
  onPick: (p) => pickFromStage(p),
  onMoveView: (id, x, z, end) => { if (end) return endGesture(); live(() => { const v = doc.views[id]; v.pos[0] = x; v.pos[2] = z; }); },
  onAimView: (id, yaw, end) => { if (end) return endGesture(); live(() => { doc.views[id].yaw = yaw; }); },
  onMovePoint: (key, i, x, z, end) => { if (end) return endGesture(); live(() => { doc.paths[key].points[i] = [x, z]; }); },
  onInsertPoint: (key, x, z) => insertPoint(key, x, z),
  onPlace: (x, z, yaw) => placeView(x, z, yaw),
  onMeasure: (x, z) => { const m = ui.world.measure; if (m.length >= 2) m.length = 0; m.push([x, z]); renderDeck(); refreshStage(); },
  // Fit keeps the Card's side and the instrument's lower band clear, so neither ever forces a camera move.
  reserve: (w, h, aw) => aw > 980 ? { r: 324, b: 150 } : { r: 0, b: Math.round(h * 0.42) },
});

// ——— model helpers ———
const P = (id) => doc.presentations.find((p) => p.id === id);
const V = (id) => doc.views[id];
const stops = () => doc.guide.stops;
const stopIndex = (id) => stops().findIndex((s) => s.id === id);
const S = (id) => stops().find((s) => s.id === id);
const stopsUsing = (presId) => stops().map((s, i) => ({ s, i })).filter((x) => x.s.presId === presId);
const stopsShowing = (viewId) => stops().map((s, i) => ({ s, i, at: s.seq.findIndex((q) => q.viewId === viewId) })).filter((x) => x.at >= 0);
const thumb = (viewId) => (V(viewId) ? thumbs.get(V(viewId)) : '');
const transOf = (si) => {
  const st = stops()[si], nx = stops()[si + 1]; if (!st || !nx) return null;
  const from = st.seq[st.seq.length - 1].viewId, to = nx.seq[0].viewId;
  return { stop: st, next: nx, si, from, to, key: pathKey(from, to), mode: st.out.mode, duration: st.out.duration };
};
let tlCache = null;
const timeline = () => (tlCache ||= buildTimeline(doc));

// ——— mutation, undo, gestures ———
function snapshot() { undoStack.push(JSON.stringify(doc)); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; }
function commit(fn, msg) { snapshot(); fn(doc); changed(); if (msg) toast(msg); }
function live(fn) { if (!gesture) { snapshot(); gesture = true; } fn(doc); tlCache = null; refreshStage(); }
function endGesture() { gesture = false; changed(); }
function changed() { tlCache = null; validateSel(); render(); }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(doc)); doc = JSON.parse(undoStack.pop()); changed(); toast('Undone'); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(doc)); doc = JSON.parse(redoStack.pop()); changed(); toast('Redone'); }

function exists(s) {
  if (!s) return false;
  if (s.type === 'object') return !!W.objectById[s.id];
  if (s.type === 'pres') return !!P(s.id);
  if (s.type === 'view') return !!V(s.id);
  if (s.type === 'stop') return !!S(s.id);
  if (s.type === 'trans' || s.type === 'point') return !!S(s.stopId) && stopIndex(s.stopId) < stops().length - 1 && (s.type !== 'point' || !!doc.paths[s.key]?.points[s.i]);
  if (s.type === 'room') return !!W.roomById[s.id];
  if (s.type === 'wall' || s.type === 'opening') return !!W.boundById[s.id];
  return s.type === 'guide';
}
function validateSel() {
  if (ui.sel && !exists(ui.sel)) ui.sel = ui.sel.type === 'point' && exists({ ...ui.sel, type: 'trans' }) ? { type: 'trans', stopId: ui.sel.stopId } : null;
  ui.nav = ui.nav.filter(exists);
  if (ui.look && !V(ui.look.viewId)) exitLook();
}

// ——— selection & Back (navigation history — never Undo) ———
const sameSel = (a, b) => a && b && a.type === b.type && a.id === b.id && a.stopId === b.stopId && a.i === b.i;
const GUIDE_TYPES = new Set(['stop', 'trans', 'point', 'guide']);
function select(s, { push = true } = {}) {
  // Anything that belongs to the Guide invokes its authoring context; nothing else closes it.
  if (s && GUIDE_TYPES.has(s.type)) ui.guide = true;
  if (s && s.type === 'point') { /* point is a refinement of its transition: no history entry */ ui.sel = s; return render(); }
  if (sameSel(s, ui.sel)) return render();
  if (push && ui.sel && ui.sel.type !== 'point') { ui.nav.push(ui.sel); if (ui.nav.length > 40) ui.nav.shift(); }
  if (!s) ui.nav = [];
  ui.sel = s;
  // The outline follows the selection (one open Presentation), so long projects stay short.
  if (s?.type === 'pres') ui.expanded = new Set([s.id]);
  if (s?.type === 'view') ui.expanded = new Set([V(s.id).presId]);
  if (s?.type === 'object' || s?.type === 'room') ui.world.room = s.type === 'room' ? s.id : W.roomOf(W.objectById[s.id]);
  if (s?.type === 'wall' || s?.type === 'opening') ui.world.room = W.boundById[s.id].room;
  ui.drawer = false;
  render();
}
function back() { const s = ui.nav.pop(); ui.sel = s || null; if (s && GUIDE_TYPES.has(s.type)) ui.guide = true; render(); }
function openGuide() { ui.guide = true; select({ type: 'guide' }); }
function closeGuide() {
  if (ui.play.follow) stopFollow(false); pause(); ui.play.t = 0;
  ui.guide = false;
  if (ui.sel && GUIDE_TYPES.has(ui.sel.type)) ui.sel = null;
  ui.nav = ui.nav.filter((x) => !GUIDE_TYPES.has(x.type));
  render();
}
function setDomain(d) {
  if (d === ui.domain) return;
  if (ui.look) exitLook(); if (ui.play.follow) stopFollow(false); pause(); if (ui.tool) cancelTool(); ui.world.tool = null; plan.tool = null;
  // Shared canonical selection: a scene object stays selected across the lens switch; other selections are remembered per domain.
  const keep = ui.sel?.type === 'object' ? ui.sel : null;
  ui.selBy[ui.domain] = ui.sel; ui.domain = d;
  ui.sel = keep || ui.selBy[d] || null; ui.nav = []; ui.ixq = '';
  validateSel(); render();
}
function selLabel(s) {
  if (!s) return '';
  if (s.type === 'object') return W.objectById[s.id].name;
  if (s.type === 'pres') return P(s.id).name;
  if (s.type === 'view') return V(s.id).name;
  if (s.type === 'stop') return `Stop ${stopIndex(s.id) + 1}`;
  if (s.type === 'trans' || s.type === 'point') { const i = stopIndex(s.stopId); return `Stop ${i + 1} → ${i + 2}`; }
  if (s.type === 'guide') return doc.guide.name;
  if (s.type === 'room') return W.roomById[s.id].name;
  if (s.type === 'wall' || s.type === 'opening') return W.boundById[s.id].name;
  return '';
}

function pickFromStage(p) {
  if (ui.tool || ui.world.tool) return;
  if (!p) return select(null);
  if (ui.domain === 'world') { if (p.type === 'object') select({ type: 'object', id: p.id }); return; }
  if (p.type === 'route') {
    const si = stops().findIndex((_, i) => transOf(i)?.key === p.key);
    const cur = ui.sel && (ui.sel.type === 'trans' || ui.sel.type === 'point') && transOf(stopIndex(ui.sel.stopId))?.key === p.key;
    if (cur) return;
    if (si >= 0) return select({ type: 'trans', stopId: stops()[si].id });
    return;
  }
  if (p.type === 'point') {
    const stopId = (ui.sel && (ui.sel.type === 'trans' || ui.sel.type === 'point')) ? ui.sel.stopId : stops()[stops().findIndex((_, i) => transOf(i)?.key === p.key)]?.id;
    return select({ type: 'point', stopId, key: p.key, i: p.i });
  }
  select(p.type === 'view' ? { type: 'view', id: p.id } : { type: 'object', id: p.id });
}

// ——— authoring operations ———
function roomCenterFor(x, z) {
  for (const r of W.rooms) if (inPoly(x, z, r.poly)) { const xs = r.poly.map((p) => p[0]), zs = r.poly.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]; }
  return [20, 10];
}
function inPoly(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function frameObject(o) {
  let dx, dz;
  if (o.kind === 'painting') { dx = 0; dz = 1; } else {
    const [cx, cz] = roomCenterFor(o.x, o.z); dx = cx - o.x; dz = cz - o.z;
    const l = Math.hypot(dx, dz); if (l < 1.2) { dx = -0.75; dz = 0.66; } else { dx /= l; dz /= l; }
  }
  const size = Math.max(o.w, o.d, o.h * 0.8);
  const d = Math.max(2.2, size * 1.9);
  const cy = o.kind === 'painting' ? o.y : Math.min(1.3, o.h * 0.6);
  return W.aim([o.x + dx * d, 1.6, o.z + dz * d], [o.x, cy, o.z]);
}
function newView(presId, pose, name, lens = 'normal') {
  const pr = P(presId);
  const id = nid('v');
  const n = name || `View ${pr.viewIds.length + 1}`;
  const yaw = pose.yaw ?? Math.atan2(pose.dir[2], pose.dir[0]);
  const pitch = pose.pitch ?? Math.asin(pose.dir[1]);
  doc.views[id] = { id, presId, name: n, pos: [...pose.pos], yaw, pitch, lens };
  pr.viewIds.push(id); if (!pr.defaultViewId) pr.defaultViewId = id;
  return id;
}
function presentObject(objId) {
  const o = W.objectById[objId]; let vid, pid;
  commit((d) => {
    pid = nid('p');
    d.presentations.push({ id: pid, name: o.name, subject: o.id, viewIds: [], defaultViewId: null, explore: true });
    vid = newView(pid, frameObject(o), 'Framed view');
  }, `Presented “${o.name}” — first View framed on it`);
  ui.expanded.add(pid);
  select({ type: 'pres', id: pid });
}
function newPresentationFromStandpoint() {
  if (ui.stage === 'plan' && !ui.look) { startPlace(null); return; }
  const pose = stage3d.currentPose(); let pid;
  commit((d) => {
    pid = nid('p');
    d.presentations.push({ id: pid, name: 'Untitled presentation', subject: null, viewIds: [], defaultViewId: null, explore: true });
    newView(pid, pose, 'This standpoint', closestLens(pose.fov));
  }, 'New Presentation from this standpoint');
  select({ type: 'pres', id: pid });
  setTimeout(() => focusTitle(), 30);
}
const closestLens = (fov) => Object.entries(W.LENSES).sort((a, b) => Math.abs(a[1].fov - fov) - Math.abs(b[1].fov - fov))[0][0];
function captureView(presId) {
  if (ui.stage === 'plan' && !ui.look) { startPlace(presId); return; }
  const pose = stage3d.currentPose(); let vid;
  commit(() => { vid = newView(presId, pose, null, closestLens(pose.fov)); }, 'View captured from the Stage camera');
  select({ type: 'view', id: vid });
}
function startPlace(presId) { ui.tool = { kind: 'place', presId }; plan.tool = 'place'; render(); }
function cancelTool() { ui.tool = null; plan.tool = null; render(); }
function placeView(x, z, yaw) {
  const presId = ui.tool?.presId; cancelTool();
  let vid, pid = presId;
  commit((d) => {
    if (!pid) { pid = nid('p'); d.presentations.push({ id: pid, name: 'Untitled presentation', subject: null, viewIds: [], defaultViewId: null, explore: true }); }
    vid = newView(pid, { pos: [x, 1.6, z], yaw, pitch: -0.04 }, presId ? null : 'First view');
  }, presId ? 'View placed' : 'New Presentation with its first View');
  if (!presId) { select({ type: 'pres', id: pid }); setTimeout(() => focusTitle(), 30); }
  else select({ type: 'view', id: vid });
}
function removeView(id) {
  const v = V(id), pr = P(v.presId);
  if (pr.viewIds.length < 2) return toast('A Presentation keeps at least one View');
  commit((d) => {
    pr.viewIds = pr.viewIds.filter((x) => x !== id);
    if (pr.defaultViewId === id) pr.defaultViewId = pr.viewIds[0];
    for (const s of d.guide.stops) { s.seq = s.seq.filter((q) => q.viewId !== id); if (!s.seq.length && s.presId === pr.id) s.seq = [{ viewId: pr.defaultViewId, hold: 4 }]; }
    delete d.views[id];
  }, `Removed View “${v.name}”`);
}
function removePres(id) {
  const pr = P(id), n = stopsUsing(id).length;
  commit((d) => {
    for (const vid of pr.viewIds) delete d.views[vid];
    d.presentations = d.presentations.filter((p) => p.id !== id);
    d.guide.stops = d.guide.stops.filter((s) => s.presId !== id);
  }, `Removed “${pr.name}”${n ? ` and its ${n} Stop${n > 1 ? 's' : ''}` : ''}`);
}
function addStop(presId, at = stops().length) {
  const pr = P(presId); let sid;
  commit((d) => { sid = nid('s'); d.guide.stops.splice(at, 0, { id: sid, presId, seq: [{ viewId: pr.defaultViewId, hold: 4 }], out: { mode: 'travel', duration: 6 } }); }, `Stop added — starts at the Default View of “${pr.name}”`);
  ui.guide = true;
  select({ type: 'stop', id: sid });
}
function moveStop(from, to) {
  if (from === to) return;
  commit((d) => { const [s] = d.guide.stops.splice(from, 1); d.guide.stops.splice(to, 0, s); }, `Stop moved to position ${to + 1}`);
}
function moveSeq(stopId, from, to) {
  if (from === to) return;
  const si = stopIndex(stopId);
  const ends = to === 0 || from === 0 || to === S(stopId).seq.length - 1 || from === S(stopId).seq.length - 1;
  commit(() => { const s = S(stopId); const [q] = s.seq.splice(from, 1); s.seq.splice(to, 0, q); }, to === 0 ? 'New entry View for this Stop' : 'Guided View moved');
  // The Camera route is owned by the pair of Views it joins: a new entry/exit View means a different route.
  const fresh = [transOf(si - 1), transOf(si)].filter((t) => ends && t && t.mode === 'travel' && !doc.paths[t.key]?.points.length);
  if (fresh.length) toast(`Travel ${fresh.map((t) => `Stop ${t.si + 1} → ${t.si + 2}`).join(', ')} now joins different Views — it starts as a direct path`);
}
function movePresView(presId, from, to) {
  if (from === to) return;
  commit(() => { const pr = P(presId); const [q] = pr.viewIds.splice(from, 1); pr.viewIds.splice(to, 0, q); }, 'View order updated (free exploration order)');
}
function insertPoint(key, x, z) {
  commit((d) => {
    const [fromId, toId] = key.split('>'); const from = V(fromId), to = V(toId);
    const path = d.paths[key] ||= { points: [] };
    const cps = [[from.pos[0], from.pos[2]], ...path.points, [to.pos[0], to.pos[2]]];
    let best = 0, bd = 1e9;
    for (let i = 0; i < cps.length - 1; i++) { const dd = segDist(x, z, cps[i], cps[i + 1]); if (dd < bd) { bd = dd; best = i; } }
    path.points.splice(best, 0, [x, z]);
    ui.sel = { type: 'point', stopId: ui.sel.stopId, key, i: best };
  }, 'Path point added — drag to shape');
}
function segDist(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }

// ——— Look through / Exit View (explicit Camera operations) ———
function lookThrough(viewId) {
  if (ui.play.follow) stopFollow(false);
  if (ui.look) { ui.look.viewId = viewId; ui.look.modified = false; stage3d.tweenPose(stage3d.currentPose(), viewPose(V(viewId)), 700); return render(); }
  const saved = { stage: ui.stage, standpoint: stage3d.saveStandpoint() };
  ui.look = { viewId, saved, modified: false };
  setStage('3d', true);
  stage3d.tweenPose(stage3d.currentPose(), viewPose(V(viewId)), 750);
  render();
}
function exitLook() {
  const l = ui.look; if (!l) return; ui.look = null;
  if (l.saved.stage === 'plan') { stage3d.restoreStandpoint(l.saved.standpoint, false); setStage('plan', true); }
  else stage3d.restoreStandpoint(l.saved.standpoint, true);
  render();
}
function updateFromLook() {
  const l = ui.look; if (!l) return; const p = stage3d.currentPose();
  commit(() => { const v = V(l.viewId); v.pos = [...p.pos]; v.yaw = Math.atan2(p.dir[2], p.dir[0]); v.pitch = Math.asin(p.dir[1]); }, 'View updated from where you are looking');
  l.modified = false; render();
}
function setStage(m, internal = false) {
  if (!internal) { if (ui.look) exitLook(); if (ui.play.follow) stopFollow(); }
  if (m === 'plan' && ui.look && !internal) return;
  ui.stage = m; stageEl.dataset.mode = m;
  if (m === 'plan' && ui.tool && ui.tool.kind !== 'place') cancelTool();
  if (m === '3d' && ui.tool) cancelTool();
  stage3d.dirty = true; render();
}

// ——— playback (Play/Pause → Scrub → Follow) ———
let lastFrame = 0;
function play() {
  const tl = timeline(); if (!tl.total || !ui.guide || ui.domain !== "experience") return;
  if (ui.look) exitLook();
  if (ui.play.t >= tl.total - 0.01) ui.play.t = 0;
  ui.play.playing = true; lastFrame = performance.now(); requestAnimationFrame(playTick); renderDeckBar();
}
function pause() { ui.play.playing = false; ui.play.stopAt = null; renderDeckBar(); }
function playTick(now) {
  if (!ui.play.playing) return;
  const dt = (now - lastFrame) / 1000; lastFrame = now;
  const tl = timeline();
  ui.play.t = Math.min(tl.total, ui.play.t + dt);
  if (ui.play.stopAt != null && ui.play.t >= ui.play.stopAt) { ui.play.t = ui.play.stopAt; pause(); }
  if (ui.play.t >= tl.total) pause();
  applyPlayhead();
  if (ui.play.playing) requestAnimationFrame(playTick);
}
function scrubTo(t) { ui.play.t = Math.max(0, Math.min(timeline().total, t)); applyPlayhead(); }
function playFrom(t, stopAt = null) { ui.play.t = t; ui.play.stopAt = stopAt; play(); }
function startFollow() {
  if (ui.look) exitLook();
  ui.play.saved = { stage: ui.stage, standpoint: stage3d.saveStandpoint() };
  ui.play.follow = true; setStage('3d', true);
  const ev = evaluate(doc, timeline(), ui.play.t); if (ev) stage3d.tweenPose(stage3d.currentPose(), ev.pose, 500);
  render();
}
function stopFollow(doRender = true) {
  const s = ui.play.saved; ui.play.follow = false; ui.play.saved = null;
  if (s) { if (s.stage === 'plan') { stage3d.restoreStandpoint(s.standpoint, false); setStage('plan', true); } else stage3d.restoreStandpoint(s.standpoint, true); }
  if (doRender) render();
}
function applyPlayhead() {
  const tl = timeline(); const ev = evaluate(doc, tl, ui.play.t);
  if (ui.play.follow && ev && !stage3d.anim) stage3d.setPose(ev.pose);
  refreshStage();
  updatePlayheadDom();
}

// ——— rendering ———
const deckShown = () => (ui.domain === 'experience' ? ui.guide : ui.world.tool === 'measure');
function render() {
  app.dataset.index = ui.index; app.dataset.drawer = ui.drawer ? 'open' : 'closed';
  app.dataset.domain = ui.domain; app.dataset.deck = deckShown() ? 'open' : 'closed';
  frame.dataset.device = ui.device;
  stageEl.dataset.mode = ui.stage; stageEl.dataset.card = ui.sel ? 'open' : 'closed';
  renderHead(); renderIndex(); renderCard(); renderDeck(); renderStageChrome(); refreshStage();
}

function renderHead() {
  const ex = ui.domain === 'experience';
  $('#head').innerHTML = `
    <button class="hbtn index-toggle" data-act="drawer" aria-label="Show index">${icon('panel')}</button>
    <div class="brand"><svg class="mark"><use href="#i-mark"/></svg><div class="brand-name"><small>Museum Editor</small><b>Salon Chopin</b></div></div>
    <span class="head-sep"></span>
    <div class="ws" role="group" aria-label="Domain"><button aria-pressed="${!ex}" data-act="domain" data-d="world">${icon('world')}World</button><button aria-pressed="${ex}" data-act="domain" data-d="experience">${icon('guide')}Experience</button></div>
    <span class="head-sep"></span>
    <span class="hist"><button class="hbtn" data-act="undo" ${undoStack.length ? '' : 'disabled'} title="Undo (Ctrl+Z)">${icon('undo')}</button><button class="hbtn" data-act="redo" ${redoStack.length ? '' : 'disabled'} title="Redo (Ctrl+Shift+Z)">${icon('redo')}</button></span>
    <span class="grow"></span>
    <button class="proto" data-act="proto-menu" title="Prototype controls (not product UI)"><span class="lbl">Prototype ▾</span><span class="sm-only">⋯</span></button>
    <button class="btn-preview" data-act="preview" title="Preview as a visitor">${icon('play', 'sm')}<span class="lbl">Preview</span></button>`;
}

function useDot(viewId) {
  const n = stopsShowing(viewId);
  return n.length ? `<i class="use in-guide" title="In ${n.map((x) => 'Stop ' + (x.i + 1)).join(', ')}"></i>` : `<i class="use free" title="Free exploration only"></i>`;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const stopList = (nums) => (nums.length > 3 ? `Stops ${nums.slice(0, 3).join(', ')} +${nums.length - 3}` : `Stop${nums.length > 1 ? 's' : ''} ${nums.join(', ')}`);
const IX_VIEWS = 8; // Views listed under an open Presentation before handing over to the Card

function renderIndex() {
  const el = $('#index');
  const keepFocus = document.activeElement?.id === 'ix-q';
  if (ui.domain === 'world') renderWorldIndex(el);
  else if (ui.index === 'rail') {
    el.innerHTML = `<div class="ix-rail">
      <button class="rail-btn" data-act="index-full" title="Expand index">${icon('panel')}</button>
      <span class="rail-sep"></span>
      <button class="rail-btn${ui.guide ? ' is-on' : ''}" data-act="open-guide" title="${esc(doc.guide.name)}">${icon('guide')}</button>
      <span class="rail-sep"></span>
      ${doc.presentations.map((p) => `<button class="rail-pres${ui.sel?.type === 'pres' && ui.sel.id === p.id ? ' is-selected' : ''}" data-act="sel-pres" data-id="${p.id}" title="${esc(p.name)}" style="background-image:url(${thumb(p.defaultViewId)})"></button>`).join('')}
      <button class="rail-btn" data-act="new-pres" title="New Presentation from this standpoint">${icon('plus')}</button>
    </div>`;
  } else renderExperienceIndex(el);
  if (keepFocus) { const q = $('#ix-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
}

function renderExperienceIndex(el) {
  const sel = ui.sel, q = ui.ixq.trim().toLowerCase();
  const list = doc.presentations.filter((p) => !q || p.name.toLowerCase().includes(q) || p.viewIds.some((v) => V(v).name.toLowerCase().includes(q)));
  const pres = list.map((p) => {
    const open = ui.expanded.has(p.id) || (q && p.viewIds.some((v) => V(v).name.toLowerCase().includes(q)));
    const isSel = sel?.type === 'pres' && sel.id === p.id;
    const inStops = stopsUsing(p.id).map((x) => x.i + 1);
    let views = '';
    if (open) {
      const ids = q ? p.viewIds.filter((v) => V(v).name.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : p.viewIds;
      const shown = ids.slice(0, IX_VIEWS);
      if (sel?.type === 'view' && ids.includes(sel.id) && !shown.includes(sel.id)) shown.push(sel.id);
      views = `<ul class="ix-views">${shown.map((vid) => {
        const v = V(vid); const vs = sel?.type === 'view' && sel.id === vid;
        return `<li><button class="ix-view${vs ? ' is-selected' : ''}" data-act="sel-view" data-id="${vid}">${useDot(vid)}<span class="nm">${esc(v.name)}</span>${p.defaultViewId === vid ? `<span class="def" title="Default View">${icon('diamond', 'sm')}</span>` : ''}</button></li>`;
      }).join('')}${ids.length > shown.length ? `<li><button class="ix-more" data-act="sel-pres" data-id="${p.id}">+ ${ids.length - shown.length} more — see all in the Card</button></li>` : ''}</ul>`;
    }
    return `<div class="ix-pres${isSel ? ' is-selected' : ''}${open ? ' is-open' : ''}" draggable="true" data-pres-drag="${p.id}">
      <button class="ix-twist" data-act="toggle-expand" data-id="${p.id}" aria-expanded="${!!open}" aria-label="${open ? 'Hide' : 'Show'} Views">${icon('down', 'sm')}</button>
      <button class="ix-row" data-act="sel-pres" data-id="${p.id}">
        <span class="ix-thumb" style="background-image:url(${thumb(p.defaultViewId)})"></span>
        <span class="ix-txt"><span class="ix-name">${esc(p.name)}</span><span class="ix-meta">${plural(p.viewIds.length, 'View')} · ${inStops.length ? `<b>${stopList(inStops)}</b>` : '<span class="fr">free</span>'}</span></span>
      </button></div>${views}`;
  }).join('');
  const tl = timeline();
  const many = doc.presentations.length >= 8;
  el.innerHTML = `
    <div class="ix-head"><span class="ix-title">Experience</span><button class="icon-btn" data-act="index-rail" title="Collapse index">${icon('back', 'sm')}</button></div>
    <div class="ix-scroll">
      <section class="ix-sec">
        <div class="ix-sec-head"><span>Guides</span></div>
        <button class="ix-guide${ui.guide ? ' is-open' : ''}${sel?.type === 'guide' ? ' is-selected' : ''}" data-act="open-guide" aria-pressed="${ui.guide}"><span class="ix-gico">${icon('guide')}</span><span><b>${esc(doc.guide.name)}</b><small>${stops().length ? `${plural(stops().length, 'stop')} · ${fmtTime(tl.total)}` : 'No stops yet'}</small></span>${ui.guide ? '<span class="ix-state">Open</span>' : ''}</button>
      </section>
      <section class="ix-sec">
        <div class="ix-sec-head"><span>Presentations <span class="ix-count">${doc.presentations.length || ''}</span></span><button class="ix-add" data-act="new-pres" title="Present this standpoint">${icon('plus', 'sm')}<span>New</span></button></div>
        ${many || q ? `<label class="ix-search">${icon('search')}<input id="ix-q" type="search" placeholder="Find a Presentation or View" value="${esc(ui.ixq)}" aria-label="Find a Presentation or View"></label>` : ''}
        ${pres || (q ? `<div class="ix-none">Nothing matches “${esc(ui.ixq)}”.</div>` : `<div class="ix-empty"><b>Nothing presented yet.</b><br>Select an object on the Stage and choose <em>Present this</em> — or use <em>New</em> to present a standpoint.</div>`)}
      </section>
    </div>
    <div class="ix-foot"><span><i class="use in-guide"></i>on the tour</span><span><i class="use free"></i>free exploration only</span><span>${icon('diamond', 'sm')}Default</span></div>`;
}

// World Context Index: where am I, what is around, how do I reach elsewhere (same anatomy as Experience).
const KIND_ICON = { piano: 'object', statue: 'object', painting: 'picture', vitrine: 'frame', bench: 'object', plinth: 'object' };
function renderWorldIndex(el) {
  const room = W.roomById[ui.world.room], q = ui.ixq.trim().toLowerCase(), sel = ui.sel;
  const row = (type, id, ic, name, meta = '') => `<button class="ix-wrow${sel?.type === type && sel.id === id ? ' is-selected' : ''}" data-act="sel-w" data-type="${type}" data-id="${id}">${icon(ic, 'sm')}<span>${esc(name)}</span>${meta ? `<small>${meta}</small>` : ''}</button>`;
  let body;
  if (q) {
    const objs = W.objects.filter((o) => o.name.toLowerCase().includes(q));
    const rms = Object.values(W.roomById).filter((r) => r.name.toLowerCase().includes(q));
    body = `<section class="ix-sec"><div class="ix-sec-head"><span>Results</span></div>${[...rms.map((r) => row('room', r.id, 'room', r.name, 'Room')), ...objs.map((o) => row('object', o.id, KIND_ICON[o.kind], o.name, W.roomById[W.roomOf(o)].name))].join('') || `<div class="ix-none">Nothing matches “${esc(ui.ixq)}”.</div>`}</section>`;
  } else {
    const b = W.boundsOf(room.id);
    body = `
      <div class="ix-path"><span>${icon('world', 'sm')}${esc(W.WING)}</span><button class="ix-here${sel?.type === 'room' && sel.id === room.id ? ' is-selected' : ''}" data-act="sel-w" data-type="room" data-id="${room.id}">${icon('room', 'sm')}<b>${esc(room.name)}</b></button></div>
      <section class="ix-sec"><div class="ix-sec-head"><span>Bounds</span></div>${b.filter((x) => x.kind === 'wall').map((x) => row('wall', x.id, 'wall', x.name, x.shared ? 'shared' : '')).join('')}</section>
      <section class="ix-sec"><div class="ix-sec-head"><span>Openings on bounds</span></div>${b.filter((x) => x.kind === 'opening').map((x) => row('opening', x.id, 'door', x.name)).join('')}</section>
      <section class="ix-sec"><div class="ix-sec-head"><span>Located here</span></div>${W.objects.filter((o) => W.roomOf(o) === room.id).map((o) => row('object', o.id, KIND_ICON[o.kind], o.name)).join('')}</section>`;
  }
  el.innerHTML = `
    <div class="ix-head"><span class="ix-title">World</span><button class="icon-btn" data-act="browse" title="Browse rooms">${icon('room', 'sm')}</button></div>
    <label class="ix-search">${icon('search')}<input id="ix-q" type="search" placeholder="Search the museum" value="${esc(ui.ixq)}" aria-label="Search the museum"></label>
    <div class="ix-scroll">${body}</div>`;
}

// ——— Card ———
function cardShell({ kicker, title, renameKind, renameId, body, actions = '', more = '' }) {
  const prev = ui.nav[ui.nav.length - 1];
  return `
    <div class="c-top">
      ${prev ? `<button class="c-back" data-act="back" title="Back to ${esc(selLabel(prev))}">${icon('back', 'sm')}<span>${esc(selLabel(prev))}</span></button>` : '<span></span>'}
      <span class="c-top-r">${more ? `<button class="icon-btn" data-act="menu" data-menu="${more}" aria-label="More actions">${icon('more')}</button>` : ''}<button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></span>
    </div>
    <div class="c-id">
      <div class="c-kicker">${kicker}</div>
      ${renameKind ? `<input class="c-title" value="${esc(title)}" data-rename="${renameKind}" data-id="${renameId || ''}" aria-label="Name" spellcheck="false">` : `<div class="c-title static">${esc(title)}</div>`}
    </div>
    ${actions ? `<div class="c-actions">${actions}</div>` : ''}
    <div class="c-scroll">${body}</div>`;
}

function renderCard() {
  const el = $('#card'); const s = ui.sel;
  const keep = document.activeElement?.id === 'v-q';
  const scroll = el.querySelector('.c-scroll')?.scrollTop || 0, same = el.dataset.key === JSON.stringify(s);
  if (!s) { el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; return; }
  el.hidden = false;
  el.dataset.type = s.type; el.dataset.key = JSON.stringify(s);
  el.innerHTML = ({ object: ui.domain === 'world' ? cardWorldObject : cardObject, pres: cardPres, view: cardView, stop: cardStop, trans: cardTrans, point: cardTrans, guide: cardGuide, room: cardRoom, wall: cardBound, opening: cardBound })[s.type](s);
  if (same) { const sc = el.querySelector('.c-scroll'); if (sc) sc.scrollTop = scroll; }
  applyViewFilter();
  if (keep) { const q = $('#v-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
}

function cardObject(s) {
  const o = W.objectById[s.id];
  const pres = doc.presentations.filter((p) => p.subject === o.id);
  return cardShell({
    kicker: `Scene object · <button class="kick-link" data-act="to-world">Open in World</button>`,
    title: o.name,
    actions: `<button class="btn primary wide" data-act="present" data-id="${o.id}">${icon('frame')}Present this</button>`,
    body: `<p class="c-note">Creates a Presentation with a first View framed on the ${esc(o.name.toLowerCase())}. You can add more Views afterwards.</p>
      ${pres.length ? `<div class="c-sec"><h3>Already presented in</h3>${pres.map((p) => `<button class="link-row" data-act="sel-pres" data-id="${p.id}"><span class="lr-thumb" style="background-image:url(${thumb(p.defaultViewId)})"></span><span>${esc(p.name)}</span>${icon('next', 'sm')}</button>`).join('')}</div>` : ''}
      <div class="c-meta">Placed in ${esc(W.roomById[W.roomOf(o)].name)} · ${o.w.toFixed(1)} × ${o.d.toFixed(1)} m</div>`,
  });
}

const VIEW_DENSE = 8, VIEW_FILTER = 12;
function cardPres(s) {
  const p = P(s.id);
  const used = stopsUsing(p.id);
  const lookMode = ui.stage === 'plan' && !ui.look;
  const subj = p.subject && W.objectById[p.subject];
  const n = p.viewIds.length, dense = n > VIEW_DENSE, filt = n > VIEW_FILTER;
  const views = p.viewIds.map((vid, i) => {
    const v = V(vid);
    return `<div class="vtile" data-sort-index="${i}" data-key="${vid}" data-name="${esc(v.name.toLowerCase())}" data-tour="${stopsShowing(vid).length ? 1 : 0}" tabindex="0" role="button" data-act="sel-view" data-id="${vid}" aria-label="${esc(v.name)}${p.defaultViewId === vid ? ', Default View' : ''}" title="${esc(v.name)}">
      <span class="vt-img" style="background-image:url(${thumb(vid)})">${p.defaultViewId === vid ? `<span class="vt-def" title="Default View">${icon('diamond', 'sm')}<b>Default</b></span>` : ''}</span>
      <span class="vt-name">${useDot(vid)}${esc(v.name)}</span></div>`;
  }).join('');
  return cardShell({
    kicker: `Presentation${subj ? ` · about <button class="kick-link" data-act="sel-object" data-id="${subj.id}">${esc(subj.name)}</button>` : ''}`,
    title: p.name, renameKind: 'pres', renameId: p.id, more: `pres:${p.id}`,
    actions: `<button class="btn primary" data-act="capture" data-id="${p.id}">${icon(lookMode ? 'place' : 'camera')}${lookMode ? 'Place a View' : 'Capture View'}</button>
      <button class="btn" data-act="add-stop" data-id="${p.id}">${icon('plus', 'sm')}Add to Guide</button>`,
    body: `
      <div class="c-sec"><div class="c-sec-head"><h3>Views<span class="n">${n}</span></h3><span class="hint" id="v-hint">${n > 1 ? 'drag to reorder' : ''}</span></div>
        ${filt ? `<div class="c-filter-row"><label class="c-filter">${icon('search')}<input id="v-q" type="search" placeholder="Filter ${n} Views" value="${esc(ui.vq)}" aria-label="Filter Views"></label>
          <button class="chip-f" data-act="vfilter" data-f="tour" aria-pressed="${ui.vfilter === 'tour'}" title="Only Views on the tour">On tour</button><button class="chip-f" data-act="vfilter" data-f="free" aria-pressed="${ui.vfilter === 'free'}" title="Only Views no Stop uses">Free</button></div>` : ''}
        <div class="vgrid${dense ? ' dense' : ''}" data-sort-group="pviews" data-pres="${p.id}">${views}</div>
        <p class="c-foot-note" id="v-note">${lookMode ? 'Place a View: click the plan where the camera stands, drag toward what it sees.' : 'Capture View records exactly what the Stage camera sees.'}</p>
      </div>
      <div class="c-sec"><h3>Visitors reach it</h3>
        <div class="reach">
          <div class="reach-row">${icon('guide', 'sm')}<span>${used.length ? `On the tour at ${used.slice(0, 6).map((x) => `<button class="stop-chip" data-act="sel-stop" data-id="${x.s.id}">Stop ${x.i + 1}</button>`).join(' ')}${used.length > 6 ? ` +${used.length - 6}` : ''}` : 'Not on the tour'}</span></div>
          <label class="reach-row toggle"><input type="checkbox" data-act="explore" data-id="${p.id}" ${p.explore ? 'checked' : ''}><span class="sw"></span><span>Open in free exploration <small>${n > 1 ? `All ${n} Views; opens at the Default` : 'Its View is listed for visitors'}</small></span></label>
        </div>
      </div>`,
  });
}
// Filtering hides tiles in place (no re-render), so typing never loses focus; reordering needs the full list.
function applyViewFilter() {
  const g = document.querySelector('.vgrid[data-sort-group="pviews"]'); if (!g) return;
  const q = ui.vq.trim().toLowerCase(), f = ui.vfilter; let shown = 0;
  const filtering = !!$('#v-q') && (q || f !== 'all');
  g.querySelectorAll('.vtile').forEach((t) => {
    const hide = filtering && ((q && !t.dataset.name.includes(q)) || (f === 'tour' && t.dataset.tour !== '1') || (f === 'free' && t.dataset.tour === '1'));
    t.classList.toggle('is-hidden', hide); if (!hide) shown++;
  });
  g.dataset.sortGroup = filtering ? 'pviews-off' : 'pviews';
  const h = $('#v-hint'); if (h) h.textContent = filtering ? `${shown} shown · clear the filter to reorder` : 'drag to reorder';
}

function cardView(s) {
  const v = V(s.id), p = P(v.presId);
  const isDef = p.defaultViewId === v.id;
  const looking = ui.look?.viewId === v.id;
  const shows = stopsShowing(v.id);
  const hk = v.pos[1] > 3.2 ? null : W.heightKey(v.pos[1]);
  return cardShell({
    kicker: `View · in <button class="kick-link" data-act="sel-pres" data-id="${p.id}">${esc(p.name)}</button>`,
    title: v.name, renameKind: 'view', renameId: v.id, more: `view:${v.id}`,
    actions: looking
      ? `<button class="btn primary" data-act="exit-look">${icon('exit')}Exit View</button>${ui.look.modified ? `<button class="btn gold" data-act="update-look">${icon('check', 'sm')}Update View</button>` : ''}`
      : `<button class="btn primary" data-act="look" data-id="${v.id}">${icon('eye')}Look through</button>
         ${isDef ? `<span class="badge def">${icon('diamond', 'sm')}Default View</span>` : `<button class="btn" data-act="set-default" data-id="${v.id}">${icon('diamond', 'sm')}Make default</button>`}`,
    body: `
      <div class="hero" style="background-image:url(${thumb(v.id)})"><span class="hero-tag">${esc(W.LENSES[v.lens].label)} · ${hk ? W.HEIGHTS[hk].label : 'Aerial'}</span></div>
      ${looking ? `<p class="c-note strong">Drag on the Stage to re-aim, scroll to step forward or back. ${ui.look.modified ? 'Update View keeps it; Exit View discards.' : ''}</p>` : ''}
      <div class="c-sec"><h3>Framing</h3>
        <div class="field"><span class="f-lbl">Lens</span><div class="seg sm" role="group">${Object.entries(W.LENSES).map(([k, l]) => `<button aria-pressed="${v.lens === k}" data-act="lens" data-id="${v.id}" data-k="${k}">${l.label}</button>`).join('')}</div></div>
        <div class="field"><span class="f-lbl">Eye height</span><div class="seg sm" role="group">${Object.entries(W.HEIGHTS).map(([k, l]) => `<button aria-pressed="${hk === k}" data-act="height" data-id="${v.id}" data-k="${k}">${l.label}</button>`).join('')}</div></div>
        <p class="c-foot-note">${ui.stage === 'plan' ? 'On the plan: drag the marker to move it, its round handle to aim.' : 'Look through to re-aim it by hand.'}</p>
      </div>
      <div class="c-sec"><h3>Where visitors see it</h3>
        <div class="reach">
          ${shows.length ? shows.slice(0, 6).map((x) => `<button class="link-row" data-act="sel-stop" data-id="${x.s.id}"><span class="num">${x.i + 1}</span><span>Stop ${x.i + 1}${x.at === 0 ? ' · <em>entry</em>' : ` · ${ordinal(x.at + 1)} view`}</span>${icon('next', 'sm')}</button>`).join('') + (shows.length > 6 ? `<div class="reach-row">and ${shows.length - 6} more Stops</div>` : '') : `<div class="reach-row">${icon('guide', 'sm')}<span>Not in any Stop</span></div>`}
          <div class="reach-row">${icon('compass', 'sm')}<span>${p.explore ? 'Free exploration' + (isDef ? ' · opens here' : '') : 'Hidden from free exploration'}</span></div>
        </div>
      </div>`,
  });
}
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function stepper(act, attrs, value, label) {
  return `<span class="stepper" aria-label="${label}"><button data-act="${act}" ${attrs} data-d="-1" aria-label="Shorter">${icon('minus', 'sm')}</button><b>${value}</b><button data-act="${act}" ${attrs} data-d="1" aria-label="Longer">${icon('plus', 'sm')}</button></span>`;
}

const OUT_OPEN = 4; // "Not in this Stop" starts collapsed beyond this many Views
function cardStop(s) {
  const st = S(s.id), si = stopIndex(s.id), p = P(st.presId), tr = transOf(si);
  const tl = timeline(); const span = tl.stops[si];
  const seqIds = st.seq.map((q) => q.viewId);
  const out = p.viewIds.filter((v) => !seqIds.includes(v));
  const earlier = stops().slice(0, si).some((x) => x.presId === p.id);
  const shots = st.seq.map((q, i) => {
    const v = V(q.viewId);
    return `<li class="shot" data-sort-index="${i}" data-key="${v.id}" tabindex="0" aria-label="${i + 1}. ${esc(v.name)}, ${q.hold} seconds">
      <span class="grip" aria-hidden="true">${icon('grip', 'sm')}</span>
      <span class="shot-n">${i + 1}</span>
      <span class="shot-thumb" style="background-image:url(${thumb(v.id)})"></span>
      <span class="shot-main"><span class="shot-name"><button class="name-btn" data-act="sel-view" data-id="${v.id}">${esc(v.name)}</button>${p.defaultViewId === v.id ? `<span class="def" title="Presentation's Default View">${icon('diamond', 'sm')}</span>` : ''}${i === 0 ? '<em class="tag entry">Entry</em>' : ''}</span>
        <span class="shot-meta"><span class="hold-lbl">Hold</span>${stepper('hold', `data-stop="${st.id}" data-i="${i}"`, q.hold + 's', 'Hold')}</span></span>
      <button class="icon-btn shot-x" data-act="seq-remove" data-stop="${st.id}" data-i="${i}" ${st.seq.length < 2 ? 'disabled title="A Stop shows at least one View"' : 'title="Leave out of this Stop"'} aria-label="Leave out">${icon('close', 'sm')}</button>
    </li>`;
  }).join('');
  const outOpen = out.length <= OUT_OPEN || ui.outOpen;
  const outs = out.map((vid) => `<li class="shot is-out"><span class="shot-thumb" style="background-image:url(${thumb(vid)})"></span><span class="shot-name"><button class="name-btn" data-act="sel-view" data-id="${vid}">${esc(V(vid).name)}</button>${p.defaultViewId === vid ? `<span class="def" title="Presentation's Default View">${icon('diamond', 'sm')}</span>` : ''}</span><button class="btn xs" data-act="seq-add" data-stop="${st.id}" data-id="${vid}">${icon('plus', 'sm')}Include</button></li>`).join('');
  let after;
  if (tr) {
    const warn = tr.mode === 'travel' && routeWarning(V(tr.from), V(tr.to), doc.paths[tr.key]);
    after = `<div class="after">
      <div class="after-next"><span class="an-lbl">Visitor presses <b>Next</b></span>${icon('arrow', 'sm')}<button class="stop-link" data-act="sel-stop" data-id="${tr.next.id}"><span class="num">${si + 2}</span>${esc(P(tr.next.presId).name)}</button></div>
      <div class="field"><span class="f-lbl">Transition</span><div class="seg" role="group"><button aria-pressed="${tr.mode === 'cut'}" data-act="trans-mode" data-stop="${st.id}" data-mode="cut">${icon('cut', 'sm')}Cut</button><button aria-pressed="${tr.mode === 'travel'}" data-act="trans-mode" data-stop="${st.id}" data-mode="travel">${icon('travel', 'sm')}Travel</button></div></div>
      ${tr.mode === 'travel' ? `<div class="field"><span class="f-lbl">Duration</span>${stepper('trans-dur', `data-stop="${st.id}"`, tr.duration + 's', 'Travel duration')}</div>
      <button class="link-row" data-act="sel-trans" data-stop="${st.id}">${icon('travel', 'sm')}<span>Camera path · ${plural(doc.paths[tr.key]?.points.length || 0, 'point')}${warn ? ' · <b class="warn">crosses a wall</b>' : ''}</span>${icon('next', 'sm')}</button>` : `<p class="c-foot-note">The camera jumps straight to “${esc(V(tr.to).name)}”.</p>`}
    </div>`;
  } else after = `<p class="c-note">Last Stop. The tour ends here; visitors can keep exploring freely.</p>`;
  const n = stops().length;
  return cardShell({
    kicker: `<span class="c-kick-row"><span>Stop ${si + 1} of ${n} · ${esc(doc.guide.name)}</span><span class="stop-nav"><button class="icon-btn" data-act="stop-step" data-d="-1" ${si ? '' : 'disabled'} aria-label="Previous Stop" title="Previous Stop">${icon('back', 'sm')}</button><button class="icon-btn" data-act="stop-step" data-d="1" ${si < n - 1 ? '' : 'disabled'} aria-label="Next Stop" title="Next Stop">${icon('next', 'sm')}</button></span></span>`,
    title: '', more: `stop:${st.id}`,
    body: `
      <button class="visits" data-act="sel-pres" data-id="${p.id}" title="Open the Presentation">
        <span class="visits-thumb" style="background-image:url(${thumb(seqIds[0])})"><span class="num lg">${si + 1}</span></span>
        <span class="visits-txt"><small>Visits${earlier ? ' again' : ''}</small><b>${esc(p.name)}</b><span class="open">Open Presentation ${icon('open', 'sm')}</span></span>
      </button>
      <div class="c-sec"><div class="c-sec-head"><h3>Guided views<span class="n">${st.seq.length}</span></h3><span class="hint">${fmtTime(span.t1 - span.t0)} · drag to reorder</span></div>
        <ol class="shots" data-sort-group="seq" data-stop="${st.id}" data-axis="y">${shots}</ol>
        ${out.length ? `${out.length > OUT_OPEN ? `<button class="disc" data-act="out-toggle" aria-expanded="${outOpen}">${icon('down', 'sm')}Not in this Stop · ${out.length} <span>— still found when exploring freely</span></button>` : `<div class="c-sub">Not in this Stop <span>— visitors still find them when exploring freely</span></div>`}
          ${outOpen ? `<div class="shots-out"><ul class="shots">${outs}</ul></div>` : ''}` : ''}
        <p class="c-foot-note">${icon('diamond', 'sm')} marks the Presentation’s Default View. Reordering here changes only this Stop.</p>
      </div>
      <div class="c-sec"><h3>After this Stop</h3>${after}</div>
      <div class="c-sec row-end"><button class="btn ghost" data-act="play-from" data-t="${span.t0}">${icon('play', 'sm')}Play from this Stop</button></div>`,
  }).replace('<div class="c-id">', '<div class="c-id compact">');
}

function cardTrans(s) {
  const si = stopIndex(s.stopId), tr = transOf(si);
  const from = V(tr.from), to = V(tr.to);
  const path = doc.paths[tr.key];
  const warn = tr.mode === 'travel' && routeWarning(from, to, path);
  const shared = stops().map((_, i) => transOf(i)).filter((t) => t && t.key === tr.key && t.si !== si && t.mode === 'travel');
  const tl = timeline(); const span = tl.stops[si];
  const ptSel = s.type === 'point' ? s.i : null;
  return cardShell({
    kicker: `Transition · ${esc(doc.guide.name)}`,
    title: `Stop ${si + 1} → Stop ${si + 2}`,
    actions: `<div class="seg wide" role="group"><button aria-pressed="${tr.mode === 'cut'}" data-act="trans-mode" data-stop="${tr.stop.id}" data-mode="cut">${icon('cut', 'sm')}Cut</button><button aria-pressed="${tr.mode === 'travel'}" data-act="trans-mode" data-stop="${tr.stop.id}" data-mode="travel">${icon('travel', 'sm')}Travel</button></div>`,
    body: `
      <div class="ends">
        <button class="end" data-act="sel-stop" data-id="${tr.stop.id}"><span class="end-img" style="background-image:url(${thumb(from.id)})"><span class="num">${si + 1}</span></span><small>leaves from</small><b>${esc(from.name)}</b></button>
        <span class="ends-mid">${icon(tr.mode === 'cut' ? 'cut' : 'travel')}<small>${tr.mode === 'cut' ? 'cut' : tr.duration + 's'}</small></span>
        <button class="end" data-act="sel-stop" data-id="${tr.next.id}"><span class="end-img" style="background-image:url(${thumb(to.id)})"><span class="num">${si + 2}</span></span><small>arrives at</small><b>${esc(to.name)}</b></button>
      </div>
      ${tr.mode === 'travel' ? `
      <div class="c-sec"><h3>Movement</h3>
        <div class="field"><span class="f-lbl">Duration</span>${stepper('trans-dur', `data-stop="${tr.stop.id}"`, tr.duration + 's', 'Travel duration')}</div>
        <div class="field"><span class="f-lbl">Path</span><span class="f-val">${plural(path?.points.length || 0, 'point')} · ${routeLength(from, to, path).toFixed(1)} m</span></div>
        ${warn ? `<div class="alert">${icon('warn', 'sm')}<span>The path passes through a wall. Click the path on the plan to add a point, then drag it through the doorway.</span></div>` : ''}
        ${ptSel != null ? `<div class="pt-sel"><span><b>Point ${ptSel + 1}</b> selected</span><button class="btn xs danger-ghost" data-act="remove-point" data-key="${tr.key}" data-i="${ptSel}">${icon('trash', 'sm')}Remove point</button></div>` : ''}
        <p class="c-foot-note">${ui.stage === 'plan' ? 'Drag points to reshape. Click the path to add a point.' : 'Switch to Plan to reshape the path.'}${shared.length ? ` This path is also used by ${shared.map((t) => `Stop ${t.si + 1} → ${t.si + 2}`).join(', ')}.` : ''}</p>
        ${path?.points.length ? `<button class="btn xs ghost" data-act="reset-route" data-key="${tr.key}">Straighten path</button>` : ''}
      </div>` : `<p class="c-note">Cut: the camera changes instantly. No path or timing to author.</p>`}
      <div class="c-sec row-end"><button class="btn" data-act="play-trans" data-t0="${Math.max(span.t0, span.t1 - 2)}" data-t1="${Math.min(tl.total, span.tEnd + 2)}">${icon('play', 'sm')}Preview this move</button></div>`,
  });
}

function cardGuide() {
  const tl = timeline();
  const free = doc.presentations.filter((p) => p.explore);
  const allViews = Object.keys(doc.views).length;
  const inGuide = new Set(stops().flatMap((s) => s.seq.map((q) => q.viewId))).size;
  return cardShell({
    kicker: 'Guide', title: doc.guide.name, renameKind: 'guide',
    actions: `<button class="btn" data-act="add-stop-menu">${icon('plus', 'sm')}Add stop</button>${stops().length ? `<button class="btn ghost" data-act="play-from" data-t="0">${icon('play', 'sm')}Play from the start</button>` : ''}`,
    body: `
      <div class="c-sec"><h3>One museum, two ways in</h3>
        <div class="modes">
          <button class="mode-card" data-act="preview-guided">${icon('guide')}<b>Guided tour</b><span>${plural(stops().length, 'stop')} · ${fmtTime(tl.total)} of camera time. Views play on their own; visitors press <em>Next</em> between Stops.</span></button>
          <button class="mode-card" data-act="preview-free">${icon('compass')}<b>Free exploration</b><span>${plural(free.length, 'Presentation')} · ${plural(allViews, 'View')}. ${allViews - inGuide} View${allViews - inGuide === 1 ? ' is' : 's are'} only found this way.</span></button>
        </div>
        <p class="c-foot-note">Both use the same Presentations and Views. The Guide only decides an order through them.</p>
      </div>
      <div class="c-sec"><h3>Build the tour</h3><p class="c-note">Drag a Presentation from the index onto the Guide, or use <em>Add stop</em>. Drag Stops to reorder — onto the overview bar to move them far. The order you see is the order visitors get.</p></div>`,
  });
}

// ——— World Cards: same anatomy, World facts (identity → place → Details) ———
function objectPose(o) { return { ...frameObject(o), lens: 'normal' }; }
function details(rows) {
  return `<button class="disc" data-act="w-details" aria-expanded="${ui.world.details}">${icon('down', 'sm')}Details</button>
    ${ui.world.details ? `<div class="w-details">${rows.map(([k, v]) => `<div class="field"><span class="f-lbl">${k}</span><span class="f-val">${v}</span></div>`).join('')}</div>` : ''}`;
}
function cardWorldObject(s) {
  const o = W.objectById[s.id], room = W.roomById[W.roomOf(o)];
  const pres = doc.presentations.filter((p) => p.subject === o.id);
  return cardShell({
    kicker: `Placed object · <button class="kick-link" data-act="sel-w" data-type="room" data-id="${room.id}">${esc(room.name)}</button>`,
    title: o.name,
    actions: `<button class="btn" data-act="measure">${icon('ruler', 'sm')}Measure</button>`,
    body: `<div class="hero" style="background-image:url(${thumbs.get(objectPose(o))})"><span class="hero-tag">${esc(room.name)}</span></div>
      <div class="c-sec">${details([['Size', `${o.w.toFixed(2)} × ${o.d.toFixed(2)} × ${o.h.toFixed(2)} m`], ['Position', `${o.x.toFixed(1)}, ${o.z.toFixed(1)} m`], ['Facing', `${Math.round(((o.yaw || 0) * 180 / Math.PI + 360) % 360)}°`], ['Source', o.kind[0].toUpperCase() + o.kind.slice(1) + ' · placed instance']])}</div>
      <div class="c-sec"><h3>In Experience</h3>
        ${pres.length ? pres.map((p) => `<button class="link-row" data-act="to-exp-pres" data-id="${p.id}"><span class="lr-thumb" style="background-image:url(${thumb(p.defaultViewId)})"></span><span>${esc(p.name)} <small class="lr-sub">Presentation</small></span>${icon('next', 'sm')}</button>`).join('') : `<p class="c-note">Not presented yet. In Experience, select it and choose <em>Present this</em>.</p>`}
      </div>`,
  });
}
function cardRoom(s) {
  const r = W.roomById[s.id]; const xs = r.poly.map((p) => p[0]), zs = r.poly.map((p) => p[1]);
  const area = Math.abs(r.poly.reduce((a, [x, z], i) => { const [x2, z2] = r.poly[(i + 1) % r.poly.length]; return a + x * z2 - x2 * z; }, 0) / 2);
  const objs = W.objects.filter((o) => W.roomOf(o) === r.id);
  return cardShell({
    kicker: `Room · ${esc(W.WING)}`, title: r.name,
    actions: `<button class="btn" data-act="measure">${icon('ruler', 'sm')}Measure</button>`,
    body: `<div class="c-sec">${details([['Floor area', `${area.toFixed(0)} m²`], ['Extent', `${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} × ${(Math.max(...zs) - Math.min(...zs)).toFixed(1)} m`], ['Ceiling', `${W.WALL_H.toFixed(1)} m`]])}</div>
      <div class="c-sec"><h3>Located here<span class="n">${objs.length}</span></h3>${objs.map((o) => `<button class="link-row" data-act="sel-w" data-type="object" data-id="${o.id}">${icon(KIND_ICON[o.kind], 'sm')}<span>${esc(o.name)}</span>${icon('next', 'sm')}</button>`).join('')}</div>`,
  });
}
function cardBound(s) {
  const b = W.boundById[s.id], room = W.roomById[b.room];
  const len = b.segs.reduce((a, [ax, az, bx, bz]) => a + Math.hypot(bx - ax, bz - az), 0);
  return cardShell({
    kicker: `${b.kind === 'wall' ? 'Wall' : 'Opening'} · <button class="kick-link" data-act="sel-w" data-type="room" data-id="${room.id}">${esc(room.name)}</button>`, title: b.name,
    actions: `<button class="btn" data-act="measure">${icon('ruler', 'sm')}Measure</button>`,
    body: `<div class="c-sec">${details(b.kind === 'wall' ? [['Length', `${len.toFixed(1)} m`], ['Height', `${W.WALL_H.toFixed(1)} m`], ['Thickness', `${(W.WALL_T * 100).toFixed(0)} cm`], ['Bounds', b.shared ? `${room.name} and ${W.roomById[b.shared].name}` : room.name]] : [['Width', `${(b.width || len).toFixed(1)} m`], ['Kind', 'Passage, no door'], ['Connects', b.shared ? `${room.name} ↔ ${W.roomById[b.shared].name}` : room.name]])}</div>
      <p class="c-foot-note">Wall and opening editing belongs to the World tools; this prototype shows their shared Card and Index grammar only.</p>`,
  });
}

// ——— Instrument: Guide (Experience) or Measure (World) ———
let deckScroll = 0, lastRevealed = null;
function renderDeck() {
  const el = $('#deck');
  if (!deckShown()) { el.hidden = true; el.innerHTML = ''; app.style.setProperty('--deck-h', '0px'); return; }
  el.hidden = false;
  if (ui.domain === 'world') return renderMeasure(el);
  const sc = $('#deck-tiles'); if (sc) deckScroll = sc.scrollLeft;
  const tl = timeline(); const S_ = stops();
  el.dataset.density = ui.density;
  const tiles = S_.map((st, i) => {
    const p = P(st.presId); const span = tl.stops[i];
    const isSel = ui.sel?.type === 'stop' && ui.sel.id === st.id;
    const again = S_.slice(0, i).some((x) => x.presId === st.presId);
    const segs = st.seq.map((q) => `<i style="flex:${q.hold}"></i>`).join('');
    let tile = `<div class="stop-tile${isSel ? ' is-selected' : ''}" data-sort-index="${i}" data-key="${st.id}" data-act="sel-stop" data-id="${st.id}" tabindex="0" role="button" aria-label="Stop ${i + 1}, ${esc(p.name)}, ${plural(st.seq.length, 'view')}">
      <span class="st-thumb" style="background-image:url(${thumb(st.seq[0].viewId)})"><span class="num">${i + 1}</span></span>
      <span class="st-body"><b>${esc(p.name)}</b><small>${again ? '<em>again</em> · ' : ''}${plural(st.seq.length, 'view')} · ${fmtTime(span.t1 - span.t0)}</small><span class="st-segs">${segs}</span></span>
      ${isSel ? `<button class="st-more icon-btn" data-act="menu" data-menu="stop:${st.id}" aria-label="Stop actions">${icon('more', 'sm')}</button>` : ''}
    </div>`;
    if (i < S_.length - 1) {
      const tr = transOf(i);
      const tsel = (ui.sel?.type === 'trans' || ui.sel?.type === 'point') && ui.sel.stopId === st.id;
      const warn = tr.mode === 'travel' && routeWarning(V(tr.from), V(tr.to), doc.paths[tr.key]);
      tile += `<button class="link ${tr.mode}${tsel ? ' is-selected' : ''}${warn ? ' is-warn' : ''}" data-act="sel-trans" data-stop="${st.id}" title="Next → ${tr.mode === 'cut' ? 'Cut' : 'Travel ' + tr.duration + 's'}${warn ? ' · crosses a wall' : ''} — select to edit" aria-label="Transition ${i + 1} to ${i + 2}">
        <span class="lk-mode">${icon(tr.mode === 'cut' ? 'cut' : 'travel', 'sm')}${tr.mode === 'cut' ? '' : tr.duration + 's'}</span></button>`;
    }
    return tile;
  }).join('');
  const tot = tl.total || 1;
  const ov = S_.map((st, i) => {
    const sp = tl.stops[i];
    const isSel = (ui.sel?.type === 'stop' && ui.sel.id === st.id);
    return `<span class="ov-seg${isSel ? ' is-sel' : ''}" data-i="${i}" style="left:${sp.t0 / tot * 100}%;width:${(sp.t1 - sp.t0) / tot * 100}%" title="Stop ${i + 1} · ${esc(P(st.presId).name)}">${i + 1}</span>`
      + (i < S_.length - 1 ? `<span class="ov-trans ${st.out.mode}" style="left:${sp.t1 / tot * 100}%;width:${(sp.tEnd - sp.t1) / tot * 100}%"></span>` : '');
  }).join('');
  el.innerHTML = `
    <div class="deck-bar">
      <div class="dk-id">${icon('guide')}<span><small>Guide</small><button class="deck-name" data-act="sel-guide" title="Guide settings">${esc(doc.guide.name)}</button></span></div>
      <span class="deck-meta">${plural(S_.length, 'stop')}</span>
      <span class="dk-sep"></span>
      <div class="transport" id="transport"></div>
      <span class="grow"></span>
      <button class="btn dk-btn" data-act="add-stop-menu" ${doc.presentations.length ? '' : 'disabled title="Create a Presentation first"'}>${icon('plus', 'sm')}<span class="lbl">Add stop</span></button>
      ${S_.length ? `<button class="icon-btn dk dk-density" data-act="density" aria-pressed="${ui.density === 'compact'}" title="${ui.density === 'full' ? 'Compact: overview only' : 'Show Stop cards'}" aria-label="${ui.density === 'full' ? 'Compact Guide' : 'Expand Guide'}">${icon('down', 'sm')}</button>` : ''}
      <button class="icon-btn dk" data-act="close-guide" title="Close the Guide (Esc)" aria-label="Close the Guide">${icon('close', 'sm')}</button>
    </div>
    ${S_.length ? `<div class="deck-tiles" id="deck-tiles"><div class="deck-row" data-sort-group="stops" id="deck-row">${tiles}<div class="deck-drop-end" data-drop-end></div></div></div>
      <div class="deck-ov"><div class="ov-track" id="ov-track" aria-label="Guide timeline — drag to scrub">${ov}<span class="ov-window" id="ov-window"></span><span class="ov-caret" id="ov-caret"></span><span class="ov-head" id="ov-head"></span></div></div>`
    : `<div class="deck-empty" data-drop-end id="deck-row">${icon('guide')}<span><b>The Guide is empty.</b> Drag a Presentation here from the index, or use <em>Add stop</em>. Each Stop starts at that Presentation’s Default View.</span></div>`}`;
  renderDeckBar();
  const nsc = $('#deck-tiles');
  if (nsc) {
    nsc.scrollLeft = deckScroll;
    nsc.addEventListener('scroll', updateOverviewWindow, { passive: true });
    const key = ui.sel?.type === 'stop' ? ui.sel.id : (ui.sel?.type === 'trans' || ui.sel?.type === 'point') ? ui.sel.stopId : null;
    if (key && key !== lastRevealed) revealStop(stopIndex(key));
    lastRevealed = key;
  }
  requestAnimationFrame(() => { fitOverviewLabels(); updateOverviewWindow(); updatePlayheadDom(); });
  app.style.setProperty('--deck-h', el.offsetHeight + 'px');
}
function revealStop(i, smooth = false) {
  const sc = $('#deck-tiles'), t = document.querySelectorAll('#deck-row .stop-tile')[i]; if (!sc || !t) return;
  const l = t.offsetLeft - 16, r = t.offsetLeft + t.offsetWidth + 60;
  let x = sc.scrollLeft;
  if (l < sc.scrollLeft) x = l; else if (r > sc.scrollLeft + sc.clientWidth) x = r - sc.clientWidth;
  if (x !== sc.scrollLeft) { if (smooth) sc.scrollTo({ left: x, behavior: 'smooth' }); else sc.scrollLeft = x; }
}
function fitOverviewLabels() { document.querySelectorAll('.ov-seg').forEach((e) => { if (e.offsetWidth < (e.textContent.length > 1 ? 15 : 10)) e.textContent = ''; }); }
// The bracket on the overview shows which part of the Guide the Stop cards currently show.
function updateOverviewWindow() {
  const sc = $('#deck-tiles'), w = $('#ov-window'); if (!sc || !w) return;
  const tiles = [...document.querySelectorAll('#deck-row .stop-tile')]; if (!tiles.length) return;
  const a = sc.scrollLeft, b = a + sc.clientWidth;
  const vis = tiles.map((t, i) => (t.offsetLeft + t.offsetWidth * 0.5 > a && t.offsetLeft + t.offsetWidth * 0.5 < b ? i : -1)).filter((i) => i >= 0);
  const tl = timeline(), tot = tl.total || 1;
  document.querySelectorAll('.ov-seg').forEach((e) => e.classList.toggle('in-view', vis.includes(+e.dataset.i)));
  const all = vis.length === tiles.length;
  w.style.display = vis.length && !all ? '' : 'none';
  if (vis.length) { const f = tl.stops[vis[0]], l = tl.stops[vis[vis.length - 1]]; w.style.left = `calc(${f.t0 / tot * 100}% - 3px)`; w.style.width = `calc(${(l.t1 - f.t0) / tot * 100}% + 6px)`; }
}
function renderDeckBar() {
  const tr = $('#transport'); if (!tr) return;
  const tl = timeline(); const playing = ui.play.playing;
  tr.innerHTML = tl.total ? `
    <button class="tp-play" data-act="play" aria-label="${playing ? 'Pause' : 'Play'}" title="${playing ? 'Pause' : 'Play'} (Space)">${icon(playing ? 'pause' : 'play')}</button>
    <span class="tp-time"><b id="tp-now">${fmtTime(ui.play.t)}</b><span> / ${fmtTime(tl.total)}</span></span>
    <button class="tp-follow" data-act="follow" aria-pressed="${ui.play.follow}" title="See through the moving camera; turning it off returns you to where you were">${icon('follow', 'sm')}<span class="lbl">Follow camera</span></button>` : '';
}
function renderMeasure(el) {
  const m = ui.world.measure; const d = m.length === 2 ? Math.hypot(m[1][0] - m[0][0], m[1][1] - m[0][1]) : null;
  el.dataset.density = 'full';
  el.innerHTML = `
    <div class="deck-bar">
      <div class="dk-id">${icon('ruler')}<span><small>Instrument</small><span class="deck-name">Measure</span></span></div>
      <span class="dk-sep"></span>
      ${d != null ? `<span class="inst-read">${d.toFixed(2)}<small>m</small></span>` : `<span class="deck-meta">${m.length ? 'Click the second point' : 'Click two points on the plan'}</span>`}
      <span class="grow"></span>
      ${m.length ? `<button class="btn dk-btn" data-act="measure-clear">Clear</button>` : ''}
      <button class="btn dk-btn" data-act="measure-done">${icon('check', 'sm')}Done</button>
    </div>`;
  app.style.setProperty('--deck-h', el.offsetHeight + 'px');
}
function updatePlayheadDom() {
  const now = $('#tp-now'); if (now) now.textContent = fmtTime(ui.play.t);
  const head = $('#ov-head'); if (!head) return;
  const tl = timeline(), tot = tl.total || 1;
  head.style.left = (ui.play.t / tot * 100) + '%';
  const live = ui.play.playing || ui.play.t > 0;
  head.classList.toggle('is-idle', !live);
  const ev = evaluate(doc, tl, ui.play.t);
  document.querySelectorAll('.ov-seg').forEach((e) => { const i = +e.dataset.i; e.classList.toggle('is-played', live && tl.stops[i].t1 <= ui.play.t + 1e-6); });
  document.querySelectorAll('#deck-row .stop-tile').forEach((e, i) => e.classList.toggle('is-playing', !!ev && live && ev.si === i && ev.seg.kind !== 'travel'));
  document.querySelectorAll('#deck-row .link').forEach((e) => e.classList.toggle('is-playing', !!ev && ui.play.playing && ev.seg.kind === 'travel' && e.dataset.stop === stops()[ev.si]?.id));
  if (ui.play.playing && ev && ev.si !== updatePlayheadDom.si) { updatePlayheadDom.si = ev.si; revealStop(ev.si, true); }
}

// ——— Stage chrome & emphasis ———
function renderStageChrome() {
  const el = $('#stage-chrome');
  let pill = '';
  if (ui.look) {
    const v = V(ui.look.viewId);
    pill = `<div class="mode-pill gold"><span class="mp-dot"></span><span>Looking through <b>${esc(v.name)}</b>${ui.look.modified ? ' · <em>moved</em>' : ''}</span>${ui.look.modified ? `<button class="mp-btn gold" data-act="update-look">Update View</button>` : ''}<button class="mp-btn" data-act="exit-look">${icon('exit', 'sm')}Exit View <kbd>Esc</kbd></button></div>`;
  } else if (ui.play.follow) {
    const ev = evaluate(doc, timeline(), ui.play.t);
    pill = `<div class="mode-pill gold"><span class="mp-dot live"></span><span>Following the camera${ev ? (ev.seg.kind === 'travel' ? ` · travelling to Stop ${ev.si + 2}` : ` · Stop ${ev.si + 1}`) : ''}</span><button class="mp-btn" data-act="follow">${icon('exit', 'sm')}Stop following <kbd>Esc</kbd></button></div>`;
  } else if (ui.tool?.kind === 'place') {
    pill = `<div class="mode-pill leaf"><span>${icon('place', 'sm')} ${ui.tool.presId ? 'Place a View' : 'New Presentation'} — <b>press where the camera stands, drag toward what it sees</b></span><button class="mp-btn" data-act="cancel-tool">Cancel <kbd>Esc</kbd></button></div>`;
  } else if (ui.world.tool === 'measure') {
    pill = `<div class="mode-pill leaf"><span>${icon('ruler', 'sm')} Measure — <b>click two points on the plan</b></span><button class="mp-btn" data-act="measure-done">Done <kbd>Esc</kbd></button></div>`;
  }
  const lockToggle = !!(ui.look || ui.play.follow);
  const empty = ui.domain === 'experience' && !doc.presentations.length && !ui.tool && !ui.sel;
  const hidden = visHiddenCount();
  el.innerHTML = `
    <div class="stage-tl">
      <div class="seg on-stage" role="group" aria-label="Stage reading">
        <button aria-pressed="${ui.stage === 'plan'}" data-act="stage" data-m="plan" ${lockToggle ? 'title="Returns to Plan and exits the camera"' : ''}>${icon('plan', 'sm')}Plan</button>
        <button aria-pressed="${ui.stage === '3d'}" data-act="stage" data-m="3d">${icon('cube', 'sm')}3D</button>
      </div>
      ${ui.domain === 'experience' && !lockToggle && doc.presentations.length ? `<span class="tool-grp"><button class="tool-btn" data-act="vis" aria-haspopup="dialog" aria-expanded="false" title="What the Stage shows (editor only — visitors never see this)">${icon('layers', 'sm')}<span class="lbl">Show</span>${hidden ? `<span class="count">${hidden} off</span>` : ''}</button></span>` : ''}
      ${ui.stage === 'plan' && !lockToggle ? `<span class="tool-grp"><button class="icon-btn" data-act="zoom" data-f="0.8" aria-label="Zoom out">${icon('minus', 'sm')}</button><button class="icon-btn" data-act="fit" aria-label="Fit plan" title="Fit plan">${icon('fit', 'sm')}</button><button class="icon-btn" data-act="zoom" data-f="1.25" aria-label="Zoom in">${icon('plus', 'sm')}</button><span class="scale"><i></i><span>${scaleLabel()}</span></span></span>` : ''}
      ${ui.domain === 'world' && ui.stage === 'plan' && !ui.world.tool ? `<span class="tool-grp"><button class="tool-btn" data-act="measure">${icon('ruler', 'sm')}<span class="lbl">Measure</span></button></span>` : ''}
    </div>
    ${pill ? `<div class="stage-tc">${pill}</div>` : ''}
    ${empty ? `<div class="stage-coach"><b>Start your experience</b><span>Click an object — the piano, a painting, the Muse — and choose <em>Present this</em>. Or press <em>New</em> in the index to present any standpoint.</span></div>` : ''}
    ${ui.stage === '3d' && !lockToggle ? `<span class="nav-hint">Drag to orbit · Shift-drag to pan · Scroll to zoom</span>` : ''}`;
  stageEl.classList.toggle('is-through', !!(ui.look || ui.play.follow));
  stageEl.classList.toggle('is-looking', !!ui.look);
}
function scaleLabel() { const m = Math.round(80 / plan.cam.ppm); return `${m || 1} m`; }
function visHiddenCount() { const v = ui.vis; return [!v.markers, !v.cones, ui.guide && !v.paths, !v.labels, ui.guide && v.scope === 'focus'].filter(Boolean).length; }

// Visibility popover: editor-only emphasis of Camera markers, frustums, paths and labels.
function openVis(anchor) {
  const draw = () => {
    const v = ui.vis, G = ui.guide;
    const row = (k, label, sub, ic, dis) => `<button class="vis-row" role="menuitemcheckbox" aria-checked="${v[k]}" data-vact="${k}" ${dis ? 'disabled' : ''}><span class="chk">${icon('check', 'sm')}</span><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${icon(ic, 'sm')}</button>`;
    return `<div class="vis-pop" role="dialog" aria-label="Show on Stage">
      <h4>Show on Stage <small>editor only</small></h4>
      ${G ? `<div class="seg wide sm" role="group" aria-label="Guide scope"><button aria-pressed="${v.scope === 'all'}" data-vact="scope" data-v="all">Whole Guide</button><button aria-pressed="${v.scope === 'focus'}" data-vact="scope" data-v="focus">Selection only</button></div>` : ''}
      ${row('markers', 'Camera markers', 'Views outside the selection', 'camera')}
      ${row('cones', 'View frustums', 'What each View sees', 'eye')}
      ${row('paths', 'Camera paths', G ? 'Travel and Cut links' : 'Open a Guide to see its paths', 'travel', !G)}
      ${row('labels', 'Labels', 'View names and Stop numbers', 'frame')}
      <p class="vis-note">The selection always stays visible. ${G ? '<b>Selection only</b> hides other Stops’ Views and paths.' : 'Paths belong to a Guide; the Stage stays quiet without one.'}</p>
    </div>`;
  };
  const layer = $('#menu-layer'); const r = anchor.getBoundingClientRect();
  layer.innerHTML = draw(); layer.classList.add('open'); anchor.setAttribute('aria-expanded', 'true');
  const pos = () => { const m = layer.firstChild; m.style.left = Math.min(window.innerWidth - m.offsetWidth - 8, r.left) + 'px'; m.style.top = (r.bottom + 6) + 'px'; };
  pos();
  visRedraw = () => { layer.innerHTML = draw(); pos(); renderStageChrome(); $('#stage-chrome [data-act="vis"]')?.setAttribute('aria-expanded', 'true'); refreshStage(); };
  menuHandlers = {};
}
let visRedraw = null;

// What each View marker looks like now: 'sel' | 'strong' | 'normal' | 'dim' | 'hidden'.
function viewStates(e) {
  const m = new Map(), G = e.guide, vis = ui.vis, focus = G && vis.scope === 'focus';
  const seq = e.stopSeq ? new Set(e.stopSeq) : null;
  const ends = e.transEnds ? new Set(e.transEnds) : null;
  const inGuide = G ? new Set(stops().flatMap((s) => s.seq.map((q) => q.viewId))) : null;
  for (const v of Object.values(doc.views)) {
    let st;
    if (v.id === e.viewId) st = 'sel';
    else if (seq) st = seq.has(v.id) ? 'strong' : focus ? 'hidden' : 'dim';
    else if (ends) st = ends.has(v.id) ? 'strong' : focus ? 'hidden' : 'dim';
    else if (e.presId) st = v.presId === e.presId ? 'strong' : focus ? 'hidden' : 'dim';
    else if (G) st = inGuide.has(v.id) ? 'normal' : 'dim';
    else st = 'normal';
    if (!vis.markers && st !== 'sel' && st !== 'strong') st = 'hidden';
    m.set(v.id, st);
  }
  return m;
}
function emphasis() {
  const s = ui.sel, G = ui.domain === 'experience' && ui.guide, vis = ui.vis;
  const e = { routes: [], guide: G, world: ui.domain === 'world' };
  if (e.world) {
    if (s?.type === 'object') e.objectId = s.id;
    if (s?.type === 'room') e.roomId = s.id;
    if (s?.type === 'wall' || s?.type === 'opening') e.bound = W.boundById[s.id];
    if (ui.world.tool === 'measure') e.measure = ui.world.measure;
    return e;
  }
  let selSi = -1, near = new Set();
  if (s?.type === 'object') e.objectId = s.id;
  else if (s?.type === 'pres') { e.presId = s.id; e.subjectId = P(s.id).subject; }
  else if (s?.type === 'view') { e.presId = V(s.id).presId; e.viewId = s.id; }
  else if (s?.type === 'stop') { const st = S(s.id), si = stopIndex(s.id); e.presId = st.presId; e.stopSeq = st.seq.map((q) => q.viewId); near = new Set([si - 1, si]); }
  else if (s?.type === 'trans' || s?.type === 'point') { selSi = stopIndex(s.stopId); const t = transOf(selSi); e.transEnds = [t.from, t.to]; if (s.type === 'point') e.pointSel = { key: s.key, i: s.i }; }
  if (G) {
    const focusSet = selSi >= 0 ? new Set([selSi]) : near.size ? near : null;
    stops().forEach((_, i) => {
      const t = transOf(i); if (!t) return;
      const selected = i === selSi, isNear = near.has(i);
      if (!selected) { if (!vis.paths) return; if (vis.scope === 'focus' && focusSet && !focusSet.has(i)) return; }
      e.routes.push({ from: t.from, to: t.to, mode: t.mode, selected, near: isNear, faint: !selected && !isNear && !!focusSet, warn: t.mode === 'travel' && routeWarning(V(t.from), V(t.to), doc.paths[t.key]) });
    });
    // Whole-Guide reading: Stop numbers on each Stop's entry View.
    if (vis.labels && !e.stopSeq && !e.transEnds && !e.presId) {
      e.stopTags = new Map(); stops().forEach((st, i) => { const id = st.seq[0].viewId; e.stopTags.set(id, [...(e.stopTags.get(id) || []), i + 1]); });
    }
    if (ui.play.playing || ui.play.t > 0) { const ev = evaluate(doc, timeline(), ui.play.t); if (ev && !ui.play.follow) e.puck = ev.pose; }
  }
  e.views = viewStates(e);
  // Names label the working set only while it stays readable; past a dozen, hover names a marker.
  const strong = [...e.views.values()].filter((v) => v === 'strong').length;
  e.cones = vis.cones; e.labels = vis.labels && strong <= 12;
  e.fewViews = e.views.size <= 24; // context frustums only while they stay legible; markers remain
  return e;
}
function refreshStage() {
  const e = emphasis();
  plan.render(doc, e);
  stage3d.updateHelpers(doc, e);
  stage3d.setPuck(e.puck && !ui.look && !ui.play.follow ? e.puck : null);
  stage3d.helpers.visible = !(ui.look || ui.play.follow);
  const sc = document.querySelector('.scale span'); if (sc) sc.textContent = scaleLabel();
  const si = document.querySelector('.scale i'); if (si) si.style.width = Math.round(80 / plan.cam.ppm || 1) * plan.cam.ppm + 'px';
}
stage3d.onRender = () => {
  const host = $('#stage-labels'); if (ui.stage !== '3d' || ui.look || ui.play.follow) { host.innerHTML = ''; return; }
  let h = '';
  const s = ui.sel;
  const lbl = (pos, text, cls = 'sel') => { const p = stage3d.project(pos); if (!p.behind) h += `<span class="lbl3d ${cls}" style="left:${p.x}px;top:${p.y}px">${text}</span>`; };
  if (s?.type === 'view') { const v = V(s.id); lbl([v.pos[0], v.pos[1] + 0.35, v.pos[2]], esc(v.name)); }
  if (s?.type === 'object') { const o = W.objectById[s.id]; lbl([o.x, (o.y || 0) + o.h + 0.3, o.z], esc(o.name)); }
  if (s?.type === 'stop' && ui.vis.labels) S(s.id).seq.forEach((q, i) => { const v = V(q.viewId); lbl([v.pos[0], v.pos[1] + 0.35, v.pos[2]], `<i>${i + 1}</i>${esc(v.name)}`, 'seq'); });
  host.innerHTML = h;
};

// ——— menus & toasts ———
function openMenu(anchor, items) {
  const layer = $('#menu-layer');
  const r = anchor.getBoundingClientRect();
  layer.innerHTML = `<div class="menu" role="menu">${items.map((it) => it === '-' ? '<hr>' : it.head ? `<div class="menu-head">${it.head}</div>` : `<button role="menuitem" class="${it.danger ? 'danger' : ''}${it.on ? ' is-on' : ''}" data-mact="${it.act}" ${it.disabled ? 'disabled' : ''}>${it.icon ? icon(it.icon, 'sm') : '<i class="sp"></i>'}<span>${it.label}</span>${it.hint ? `<small>${it.hint}</small>` : ''}</button>`).join('')}</div>`;
  const m = layer.firstChild; layer.classList.add('open');
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(window.innerWidth - mw - 8, Math.max(8, r.right - mw)), y = r.bottom + 6;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  menuHandlers = Object.fromEntries(items.filter((i) => i.act).map((i) => [i.act, i.run]));
  m.querySelector('button:not(:disabled)')?.focus();
}
let menuHandlers = {};
function closeMenu() { const l = $('#menu-layer'); l.classList.remove('open'); l.innerHTML = ''; if (visRedraw) { visRedraw = null; renderStageChrome(); } }
$('#menu-layer').addEventListener('click', (e) => {
  const vb = e.target.closest('[data-vact]');
  if (vb) { const k = vb.dataset.vact; if (k === 'scope') ui.vis.scope = vb.dataset.v; else ui.vis[k] = !ui.vis[k]; visRedraw && visRedraw(); return; }
  const b = e.target.closest('[data-mact]'); if (!b) { if (e.target.id === 'menu-layer') closeMenu(); return; }
  const fn = menuHandlers[b.dataset.mact]; closeMenu(); fn && fn();
});
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function focusTitle() { const i = document.querySelector('.c-title[data-rename]'); if (i) { i.focus(); i.select(); } }

function moreMenu(anchor, spec) {
  const [kind, id] = spec.split(':');
  if (kind === 'pres') {
    const n = stopsUsing(id).length;
    openMenu(anchor, [
      { act: 'r', label: 'Rename', icon: 'frame', run: focusTitle },
      { act: 'g', label: 'Add to Guide', icon: 'plus', run: () => addStop(id) },
      '-',
      { act: 'x', label: 'Remove Presentation', hint: n ? `and its ${n} Stop${n > 1 ? 's' : ''}` : '', icon: 'trash', danger: true, run: () => removePres(id) },
    ]);
  } else if (kind === 'view') {
    const v = V(id), p = P(v.presId);
    openMenu(anchor, [
      { act: 'r', label: 'Rename', icon: 'frame', run: focusTitle },
      { act: 'd', label: 'Make default', icon: 'diamond', disabled: p.defaultViewId === id, run: () => setDefault(id) },
      '-',
      { act: 'x', label: 'Remove View', icon: 'trash', danger: true, disabled: p.viewIds.length < 2, hint: p.viewIds.length < 2 ? 'last View' : '', run: () => removeView(id) },
    ]);
  } else if (kind === 'stop') {
    const i = stopIndex(id);
    openMenu(anchor, [
      { act: 'o', label: 'Open Presentation', icon: 'open', run: () => select({ type: 'pres', id: S(id).presId }) },
      { act: 'e', label: 'Move earlier', icon: 'back', disabled: i === 0, hint: 'Alt ←', run: () => moveStop(i, i - 1) },
      { act: 'l', label: 'Move later', icon: 'next', disabled: i === stops().length - 1, hint: 'Alt →', run: () => moveStop(i, i + 1) },
      ...(stops().length > 6 ? [
        { act: 'f', label: 'Move to the start', icon: 'first', disabled: i === 0, run: () => moveStop(i, 0) },
        { act: 'z', label: 'Move to the end', icon: 'last', disabled: i === stops().length - 1, run: () => moveStop(i, stops().length - 1) }] : []),
      '-',
      { act: 'x', label: 'Remove Stop', icon: 'trash', danger: true, hint: 'Presentation stays', run: () => { commit((d) => { d.guide.stops.splice(i, 1); }, `Stop ${i + 1} removed — “${P(S(id).presId).name}” is still in the outline`); } },
    ]);
  }
}
function addStopMenu(anchor) {
  openMenu(anchor, [{ head: 'Add a Stop that visits…' }, ...doc.presentations.map((p) => ({ act: p.id, label: esc(p.name), icon: 'frame', hint: stopsUsing(p.id).length ? 'again' : '', run: () => addStop(p.id) }))]);
}
const SCENARIOS = {
  empty: 'Start from an empty experience', populated: 'Salon tour — 5 Stops',
  stops15: 'Long Guide — 15 Stops', stops30: 'Long Guide — 30 Stops',
  views20: 'Large Presentation — 20 Views', views50: 'Large Presentation — 50 Views', pres40: 'Many Presentations — 40',
};
let scenario = 'populated';
function protoMenu(anchor) {
  openMenu(anchor, [
    { head: 'Prototype controls — not product UI' },
    ...['empty', 'populated'].map((k) => ({ act: k, label: SCENARIOS[k], icon: scenario === k ? 'check' : k === 'empty' ? 'plus' : 'guide', on: scenario === k, run: () => loadScenario(k) })),
    { head: 'Stress content' },
    ...['stops15', 'stops30', 'views20', 'views50', 'pres40'].map((k) => ({ act: k, label: SCENARIOS[k], on: scenario === k, icon: scenario === k ? 'check' : null, run: () => loadScenario(k) })),
    '-',
    { head: 'Simulate width' },
    ...['desktop', 'tablet', 'phone'].map((d) => ({ act: d, label: d[0].toUpperCase() + d.slice(1), on: ui.device === d, icon: ui.device === d ? 'check' : null, run: () => { ui.device = d; if (d === 'phone') ui.density = 'compact'; render(); setTimeout(() => { plan.fit(); refreshStage(); }, 60); } })),
  ]);
}
function loadScenario(k) {
  if (ui.look) exitLook(); if (ui.play.follow) stopFollow(false);
  scenario = k;
  doc = k === 'empty' ? W.seedEmpty() : k === 'populated' ? W.seedPopulated() : W.seedStress(k);
  undoStack.length = 0; redoStack.length = 0; ui.sel = null; ui.nav = []; ui.play.t = 0; ui.play.playing = false;
  ui.vq = ''; ui.vfilter = 'all'; ui.ixq = ''; ui.outOpen = false; ui.expanded = new Set(); ui.domain = 'experience'; ui.selBy = {};
  ui.stage = k === 'empty' ? '3d' : 'plan';
  ui.guide = k === 'stops15' || k === 'stops30';
  if (k === 'empty') { stage3d.mode = 'orbit'; stage3d.orbit = { ...stage3d.orbit, target: stage3d.orbit.target.clone().set(19, 0, 10.5), r: 24, theta: Math.PI / 2 + 0.35, phi: 0.95 }; stage3d.applyCamera(); }
  changed();
  if (k === 'views20' || k === 'views50') select({ type: 'pres', id: 'p_piano' });
  if (ui.guide) select({ type: 'stop', id: stops()[Math.floor(stops().length / 2)].id });
  toast(k === 'empty' ? 'Empty experience — same museum, nothing presented yet' : `${SCENARIOS[k]} loaded`);
}
function setDefault(id) { const v = V(id); commit(() => { P(v.presId).defaultViewId = id; }, `“${v.name}” is now the Default View`); }

function openPreview(mode) {
  if (ui.look) exitLook(); if (ui.play.follow) stopFollow(false); pause();
  $('#visitor').dataset.device = ui.device;
  ui.visitor = openVisitor({ doc, stage3d, thumbs, mode, startStop: ui.sel?.type === 'stop' ? stopIndex(ui.sel.id) : 0, onExit: () => { ui.visitor = null; frame.hidden = false; render(); } });
  frame.hidden = true;
}

// ——— events ———
document.addEventListener('click', (e) => {
  if (suppressClick) { suppressClick = false; return; }
  const b = e.target.closest('[data-act]'); if (!b || b.closest('#menu-layer') || b.closest('#visitor')) return;
  if (b.tagName === 'INPUT') return;
  const a = b.dataset.act, id = b.dataset.id;
  const H = {
    undo, redo,
    domain: () => setDomain(b.dataset.d),
    'open-guide': () => (ui.guide && ui.sel?.type === 'guide' ? closeGuide() : openGuide()),
    'close-guide': closeGuide,
    density: () => { ui.density = ui.density === 'full' ? 'compact' : 'full'; renderDeck(); },
    vis: () => openVis(b),
    vfilter: () => { ui.vfilter = ui.vfilter === b.dataset.f ? 'all' : b.dataset.f; renderCard(); },
    'out-toggle': () => { ui.outOpen = !ui.outOpen; renderCard(); },
    'stop-step': () => { const i = stopIndex(ui.sel.id) + +b.dataset.d; if (stops()[i]) select({ type: 'stop', id: stops()[i].id }); },
    'sel-w': () => select({ type: b.dataset.type, id }),
    browse: () => openMenu(b, [{ head: 'Rooms in this wing' }, ...Object.values(W.roomById).map((r) => ({ act: r.id, label: r.name, icon: 'room', on: ui.world.room === r.id, run: () => select({ type: 'room', id: r.id }) }))]),
    'w-details': () => { ui.world.details = !ui.world.details; renderCard(); },
    'to-world': () => setDomain('world'),
    'to-exp-pres': () => { setDomain('experience'); select({ type: 'pres', id }); },
    measure: () => { if (ui.stage !== 'plan') setStage('plan'); ui.world.tool = 'measure'; ui.world.measure = []; plan.tool = 'measure'; render(); },
    'measure-clear': () => { ui.world.measure = []; render(); },
    'measure-done': () => { ui.world.tool = null; ui.world.measure = []; plan.tool = null; render(); },
    preview: () => openPreview(null), 'preview-guided': () => openPreview('guided'), 'preview-free': () => openPreview('free'),
    'proto-menu': () => protoMenu(b),
    drawer: () => { ui.drawer = !ui.drawer; render(); },
    'index-rail': () => { ui.index = 'rail'; render(); }, 'index-full': () => { ui.index = 'full'; render(); },
    'new-pres': newPresentationFromStandpoint,
    'toggle-expand': () => { ui.expanded.has(id) ? ui.expanded.delete(id) : ui.expanded.add(id); render(); },
    'sel-pres': () => select({ type: 'pres', id }), 'sel-view': () => select({ type: 'view', id }), 'sel-object': () => select({ type: 'object', id }),
    'sel-stop': () => select({ type: 'stop', id }), 'sel-trans': () => select({ type: 'trans', stopId: b.dataset.stop }), 'sel-guide': () => select({ type: 'guide' }),
    back, close: () => select(null),
    menu: () => moreMenu(b, b.dataset.menu),
    present: () => presentObject(id), capture: () => captureView(id), 'add-stop': () => addStop(id), 'add-stop-menu': () => addStopMenu(b),
    look: () => lookThrough(id), 'exit-look': exitLook, 'update-look': updateFromLook,
    'set-default': () => setDefault(id),
    lens: () => commit(() => { V(id).lens = b.dataset.k; if (ui.look?.viewId === id) stage3d.setPose({ ...stage3d.currentPose(), fov: W.LENSES[b.dataset.k].fov }); }, `Lens: ${W.LENSES[b.dataset.k].label}`),
    height: () => commit(() => { V(id).pos[1] = W.HEIGHTS[b.dataset.k].y; if (ui.look?.viewId === id) stage3d.setPose(viewPose(V(id))); }, `Eye height: ${W.HEIGHTS[b.dataset.k].label}`),
    'seq-remove': () => commit(() => { S(b.dataset.stop).seq.splice(+b.dataset.i, 1); }, 'Left out of this Stop — still in the Presentation'),
    'seq-add': () => commit(() => { S(b.dataset.stop).seq.push({ viewId: id, hold: 3 }); }, 'Included in this Stop'),
    hold: () => commit(() => { const q = S(b.dataset.stop).seq[+b.dataset.i]; q.hold = Math.max(1, Math.min(30, q.hold + +b.dataset.d)); }),
    'trans-mode': () => commit(() => { S(b.dataset.stop).out.mode = b.dataset.mode; }, b.dataset.mode === 'cut' ? 'Cut — instant change' : 'Travel — the camera moves along a path'),
    'trans-dur': () => commit(() => { const o = S(b.dataset.stop).out; o.duration = Math.max(2, Math.min(30, o.duration + +b.dataset.d)); }),
    'remove-point': () => commit(() => { doc.paths[b.dataset.key].points.splice(+b.dataset.i, 1); ui.sel = { type: 'trans', stopId: ui.sel.stopId }; }, 'Point removed'),
    'reset-route': () => commit(() => { doc.paths[b.dataset.key].points = []; }, 'Path straightened'),
    'play-from': () => playFrom(+b.dataset.t),
    'play-trans': () => playFrom(+b.dataset.t0, +b.dataset.t1),
    play: () => (ui.play.playing ? pause() : play()),
    follow: () => (ui.play.follow ? stopFollow() : startFollow()),
    stage: () => setStage(b.dataset.m),
    zoom: () => { plan.zoomStep(+b.dataset.f); refreshStage(); }, fit: () => { plan.fit(); refreshStage(); },
    'cancel-tool': cancelTool,
  };
  if (H[a]) { e.preventDefault(); H[a](); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'ix-q') { ui.ixq = e.target.value; renderIndex(); }
  if (e.target.id === 'v-q') { ui.vq = e.target.value; applyViewFilter(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.rename) {
    const val = t.value.trim(); if (!val) { render(); return; }
    const k = t.dataset.rename, id = t.dataset.id;
    commit(() => { if (k === 'pres') P(id).name = val; else if (k === 'view') V(id).name = val; else doc.guide.name = val; }, 'Renamed');
  } else if (t.dataset.act === 'explore') {
    commit(() => { P(t.dataset.id).explore = t.checked; }, t.checked ? 'Open in free exploration' : 'Hidden from free exploration');
  }
});
document.addEventListener('keydown', (e) => {
  if (ui.visitor) return;
  const inField = e.target.matches('input[type="text"], input:not([type]), textarea');
  if (inField) { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') render(); e.target.blur(); } return; }
  if (e.key === 'Escape') {
    if ($('#menu-layer').classList.contains('open')) return closeMenu();
    if (ui.tool) return cancelTool();
    if (ui.world.tool) { ui.world.tool = null; ui.world.measure = []; plan.tool = null; return render(); }
    if (ui.look) return exitLook();
    if (ui.play.follow) return stopFollow();
    if (ui.drawer) { ui.drawer = false; return render(); }
    if (ui.sel) return select(null);
    if (ui.guide && ui.domain === 'experience') return closeGuide();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); return ui.play.playing ? pause() : play(); }
  if (e.altKey && /Arrow(Left|Right|Up|Down)/.test(e.key)) {
    const it = e.target.closest('[data-sort-index]'); const g = it?.closest('[data-sort-group]'); if (!it || !g) return;
    e.preventDefault();
    const from = +it.dataset.sortIndex, d = /Left|Up/.test(e.key) ? -1 : 1, to = from + d;
    const n = g.querySelectorAll(':scope > [data-sort-index]').length; if (to < 0 || to >= n) return;
    const key = it.dataset.key; doReorder(g, from, to);
    requestAnimationFrame(() => document.querySelector(`[data-sort-group="${g.dataset.sortGroup}"] [data-key="${key}"]`)?.focus());
  }
  if ((e.key === 'Enter') && e.target.matches('[data-sort-index][data-act]')) { e.target.click(); }
  // Arrow keys walk the Guide: focus moves Stop to Stop and selects it.
  if (!e.altKey && /Arrow(Left|Right)/.test(e.key) && e.target.matches('.stop-tile')) {
    e.preventDefault(); const i = +e.target.dataset.sortIndex + (e.key === 'ArrowLeft' ? -1 : 1); const st = stops()[i];
    if (st) { select({ type: 'stop', id: st.id }); requestAnimationFrame(() => document.querySelector(`.stop-tile[data-key="${st.id}"]`)?.focus()); }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel?.type === 'point') {
    commit(() => { doc.paths[ui.sel.key].points.splice(ui.sel.i, 1); ui.sel = { type: 'trans', stopId: ui.sel.stopId }; }, 'Point removed');
  }
});

// Pointer-drag reordering, shared by Stops, guided Views and Presentation Views.
let sortS = null, suppressClick = false;
function doReorder(g, from, to) {
  const k = g.dataset.sortGroup;
  if (k === 'stops') moveStop(from, to); else if (k === 'seq') moveSeq(g.dataset.stop, from, to); else if (k === 'pviews') movePresView(g.dataset.pres, from, to);
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const it = e.target.closest('[data-sort-index]'); if (!it) return;
  const ctl = e.target.closest('button, input, .stepper');
  if (ctl && ctl !== it && !e.target.closest('.grip')) return;
  const g = it.closest('[data-sort-group]'); if (!g) return;
  sortS = { it, g, x: e.clientX, y: e.clientY, from: +it.dataset.sortIndex, to: +it.dataset.sortIndex, active: false, axis: g.dataset.axis || 'x', sc: g.id === 'deck-row' ? $('#deck-tiles') : null };
  if (sortS.sc) sortS.sc0 = sortS.sc.scrollLeft;
});
// Long Guides: dragging a Stop card over the overview bar drops it anywhere in the sequence.
function overviewDrop(e) {
  const tr = $('#ov-track'); if (!tr) return null; const r = tr.getBoundingClientRect();
  if (e.clientY < r.top - 14 || e.clientY > r.bottom + 14 || e.clientX < r.left - 10 || e.clientX > r.right + 10) return null;
  const tl = timeline(), t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * tl.total;
  let at = tl.stops.findIndex((sp) => t < (sp.t0 + sp.t1) / 2); if (at < 0) at = tl.stops.length;
  const x = at < tl.stops.length ? tl.stops[at].t0 : tl.total;
  return { at, pct: x / (tl.total || 1) * 100 };
}
window.addEventListener('pointermove', (e) => {
  if (!sortS) return;
  const dx = e.clientX - sortS.x, dy = e.clientY - sortS.y;
  if (!sortS.active && Math.hypot(dx, dy) < 6) return;
  if (!sortS.active) { sortS.active = true; sortS.it.classList.add('dragging'); sortS.g.classList.add('sorting'); document.body.classList.add('is-sorting'); }
  const vertical = sortS.axis === 'y' || sortS.g.classList.contains('vgrid');
  if (sortS.sc) {
    // Auto-scroll the Stop cards near either edge; over the overview, show where it would land.
    const r = sortS.sc.getBoundingClientRect();
    if (e.clientY > r.top - 20 && e.clientY < r.bottom) { if (e.clientX < r.left + 50) sortS.sc.scrollLeft -= 14; else if (e.clientX > r.right - 50) sortS.sc.scrollLeft += 14; }
    const od = overviewDrop(e), caret = $('#ov-caret');
    sortS.ov = od;
    if (caret) { caret.classList.toggle('on', !!od); if (od) caret.style.left = od.pct + '%'; }
    const sdx = dx + (sortS.sc.scrollLeft - sortS.sc0);
    sortS.it.style.transform = od ? `translate(${sdx}px, ${dy}px) scale(.9)` : `translateX(${sdx}px)`;
    if (od) { sortS.to = od.at > sortS.from ? od.at - 1 : od.at; sortS.g.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); return; }
  } else
  sortS.it.style.transform = sortS.g.classList.contains('vgrid') ? `translate(${dx}px,${dy}px)` : vertical ? `translateY(${dy}px)` : `translateX(${dx}px)`;
  const items = [...sortS.g.querySelectorAll(':scope > [data-sort-index]')];
  let to = sortS.from;
  items.forEach((el, i) => {
    if (el === sortS.it) return; const r = el.getBoundingClientRect();
    const c = vertical && !sortS.g.classList.contains('vgrid') ? r.top + r.height / 2 : r.left + r.width / 2;
    const p = vertical && !sortS.g.classList.contains('vgrid') ? e.clientY : e.clientX;
    const sameRow = !sortS.g.classList.contains('vgrid') || (e.clientY > r.top && e.clientY < r.bottom);
    if (!sameRow) return;
    if (i < sortS.from && p < c) to = Math.min(to, i);
    if (i > sortS.from && p > c) to = Math.max(to, i);
  });
  if (sortS.g.classList.contains('vgrid')) {
    const hit = items.find((el) => { if (el === sortS.it) return false; const r = el.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; });
    to = hit ? +hit.dataset.sortIndex : sortS.from;
  }
  sortS.to = to;
  items.forEach((el, i) => { el.classList.toggle('drop-before', i === to && to < sortS.from); el.classList.toggle('drop-after', i === to && to > sortS.from); });
});
window.addEventListener('pointerup', () => {
  if (!sortS) return; const s = sortS; sortS = null;
  if (!s.active) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  document.body.classList.remove('is-sorting');
  s.it.style.transform = ''; s.it.classList.remove('dragging'); s.g.classList.remove('sorting'); $('#ov-caret')?.classList.remove('on');
  doReorder(s.g, s.from, s.to);
  if (s.from === s.to) render();
});

// Drag a Presentation from the outline onto the Guide.
document.addEventListener('dragstart', (e) => {
  const r = e.target.closest?.('[data-pres-drag]'); if (!r) return;
  e.dataTransfer.setData('text/x-pres', r.dataset.presDrag); e.dataTransfer.effectAllowed = 'copy';
  document.body.classList.add('is-dragging-pres');
  if (ui.domain === 'experience' && !ui.guide) { ui.guide = true; render(); }
});
document.addEventListener('dragend', () => { document.body.classList.remove('is-dragging-pres'); document.querySelectorAll('.drop-caret').forEach((x) => x.classList.remove('drop-caret')); });
function dropIndex(e) {
  const od = overviewDrop(e); if (od) return od.at;
  const tiles = [...document.querySelectorAll('#deck-row .stop-tile')];
  for (let i = 0; i < tiles.length; i++) { const r = tiles[i].getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) return i; }
  return tiles.length;
}
$('#deck').addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('text/x-pres')) return; e.preventDefault();
  const i = dropIndex(e); const tiles = [...document.querySelectorAll('#deck-row .stop-tile')];
  document.querySelectorAll('.drop-caret').forEach((x) => x.classList.remove('drop-caret'));
  (tiles[i] || document.querySelector('[data-drop-end]'))?.classList.add('drop-caret');
});
$('#deck').addEventListener('drop', (e) => {
  const id = e.dataTransfer.getData('text/x-pres'); if (!id) return; e.preventDefault();
  document.body.classList.remove('is-dragging-pres');
  addStop(id, dropIndex(e));
});

// Overview: press or drag to scrub; on release the Stop cards scroll to that moment.
let scrubbing = false;
const ovT = (e) => { const r = $('#ov-track').getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * timeline().total; };
$('#deck').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#ov-track')) return;
  scrubbing = true; pause(); scrubTo(ovT(e)); e.preventDefault();
});
window.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(ovT(e)); });
window.addEventListener('pointerup', () => {
  if (!scrubbing) return; scrubbing = false;
  const ev = evaluate(doc, timeline(), ui.play.t); if (ev) revealStop(ev.si, true);
});
new ResizeObserver(() => app.style.setProperty('--deck-h', ($('#deck').hidden ? 0 : $('#deck').offsetHeight) + 'px')).observe($('#deck'));

// 3D Stage pointer: orbit/pan/zoom, or re-aim while looking through.
(() => {
  const host = $('#three-host'); let d = null;
  host.addEventListener('contextmenu', (e) => e.preventDefault());
  host.addEventListener('pointerdown', (e) => { host.setPointerCapture(e.pointerId); d = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, shift: e.shiftKey, moved: false }; });
  host.addEventListener('pointermove', (e) => {
    if (!d) return; const dx = e.clientX - d.lx, dy = e.clientY - d.ly; d.lx = e.clientX; d.ly = e.clientY;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) d.moved = true; if (!d.moved) return;
    if (ui.play.follow) return;
    if (ui.look) { stage3d.lookBy(-dx, -dy); if (!ui.look.modified) { ui.look.modified = true; renderCard(); renderStageChrome(); } return; }
    if (d.btn === 2 || d.shift) stage3d.panBy(dx, dy); else stage3d.orbitBy(dx, dy);
  });
  host.addEventListener('pointerup', (e) => {
    if (d && !d.moved && !ui.look && !ui.play.follow) pickFromStage(stage3d.pick(e.clientX, e.clientY));
    d = null;
  });
  host.addEventListener('wheel', (e) => {
    e.preventDefault(); if (ui.play.follow) return;
    if (ui.look) { stage3d.dollyBy(-e.deltaY * 0.004); if (!ui.look.modified) { ui.look.modified = true; renderCard(); renderStageChrome(); } return; }
    stage3d.zoomBy(Math.exp(e.deltaY * 0.0012));
  }, { passive: false });
})();

window.__xp = { get doc() { return doc; }, ui, select, play, pause, scrubTo, lookThrough, exitLook, startFollow, stopFollow, setStage, loadScenario, openPreview, timeline, plan, stage3d };
render();
requestAnimationFrame(() => { plan.fit(); refreshStage(); });
