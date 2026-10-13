// Museum Editor — Experience (independent alternative). Design simulation, mock data.
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
  stage: 'plan', index: 'full', drawer: false, deck: 'open', device: 'desktop',
  sel: null, nav: [],
  expanded: new Set(['p_piano']),
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
  return s.type === 'guide';
}
function validateSel() {
  if (ui.sel && !exists(ui.sel)) ui.sel = ui.sel.type === 'point' && exists({ ...ui.sel, type: 'trans' }) ? { type: 'trans', stopId: ui.sel.stopId } : null;
  ui.nav = ui.nav.filter(exists);
  if (ui.look && !V(ui.look.viewId)) exitLook();
}

// ——— selection & Back (navigation history — never Undo) ———
const sameSel = (a, b) => a && b && a.type === b.type && a.id === b.id && a.stopId === b.stopId && a.i === b.i;
function select(s, { push = true } = {}) {
  if (s && s.type === 'point') { /* point is a refinement of its transition: no history entry */ ui.sel = s; return render(); }
  if (sameSel(s, ui.sel)) return;
  if (push && ui.sel && ui.sel.type !== 'point') { ui.nav.push(ui.sel); if (ui.nav.length > 40) ui.nav.shift(); }
  if (!s) ui.nav = [];
  ui.sel = s;
  if (s?.type === 'pres') ui.expanded.add(s.id);
  if (s?.type === 'view') ui.expanded.add(V(s.id).presId);
  ui.drawer = false;
  render();
}
function back() { const s = ui.nav.pop(); ui.sel = s || null; render(); }
function selLabel(s) {
  if (!s) return '';
  if (s.type === 'object') return W.objectById[s.id].name;
  if (s.type === 'pres') return P(s.id).name;
  if (s.type === 'view') return V(s.id).name;
  if (s.type === 'stop') return `Stop ${stopIndex(s.id) + 1}`;
  if (s.type === 'trans' || s.type === 'point') { const i = stopIndex(s.stopId); return `Stop ${i + 1} → ${i + 2}`; }
  if (s.type === 'guide') return doc.guide.name;
  return '';
}

function pickFromStage(p) {
  if (ui.tool) return;
  if (!p) return select(null);
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
  ui.deck = 'open';
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
  const tl = timeline(); if (!tl.total) return;
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
function render() {
  app.dataset.index = ui.index; app.dataset.drawer = ui.drawer ? 'open' : 'closed';
  frame.dataset.device = ui.device;
  stageEl.dataset.mode = ui.stage; stageEl.dataset.card = ui.sel ? 'open' : 'closed';
  renderHead(); renderIndex(); renderCard(); renderDeck(); renderStageChrome(); refreshStage();
}

function renderHead() {
  $('#head').innerHTML = `
    <button class="hbtn index-toggle" data-act="drawer" aria-label="Show outline">${icon('panel')}</button>
    <div class="brand"><svg class="mark"><use href="#i-mark"/></svg><div class="brand-name"><small>Museum Editor</small><b>Salon Chopin</b></div></div>
    <span class="head-sep"></span>
    <div class="ws" role="group" aria-label="Workspace"><button disabled title="World authoring is outside this Experience study">World</button><button aria-pressed="true">Experience</button></div>
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

function renderIndex() {
  const el = $('#index');
  if (ui.index === 'rail') {
    el.innerHTML = `<div class="ix-rail">
      <button class="rail-btn" data-act="index-full" title="Expand outline">${icon('panel')}</button>
      <span class="rail-sep"></span>
      ${doc.presentations.map((p) => `<button class="rail-pres${ui.sel?.type === 'pres' && ui.sel.id === p.id ? ' is-selected' : ''}" data-act="sel-pres" data-id="${p.id}" title="${esc(p.name)}" style="background-image:url(${thumb(p.defaultViewId)})"></button>`).join('')}
      <button class="rail-btn" data-act="new-pres" title="New Presentation from this standpoint">${icon('plus')}</button>
      <span class="rail-sep"></span>
      <button class="rail-btn${ui.sel?.type === 'guide' ? ' is-on' : ''}" data-act="sel-guide" title="${esc(doc.guide.name)}">${icon('guide')}</button>
    </div>`;
    return;
  }
  const sel = ui.sel;
  const pres = doc.presentations.map((p, pi) => {
    const open = ui.expanded.has(p.id);
    const isSel = sel?.type === 'pres' && sel.id === p.id;
    const inStops = stopsUsing(p.id).map((x) => x.i + 1);
    const views = open ? `<ul class="ix-views">${p.viewIds.map((vid) => {
      const v = V(vid); const vs = sel?.type === 'view' && sel.id === vid;
      return `<li><button class="ix-view${vs ? ' is-selected' : ''}" data-act="sel-view" data-id="${vid}">${useDot(vid)}<span class="nm">${esc(v.name)}</span>${p.defaultViewId === vid ? `<span class="def" title="Default View">${icon('diamond', 'sm')}</span>` : ''}</button></li>`;
    }).join('')}</ul>` : '';
    return `<div class="ix-pres${isSel ? ' is-selected' : ''}${open ? ' is-open' : ''}" draggable="true" data-pres-drag="${p.id}">
      <button class="ix-twist" data-act="toggle-expand" data-id="${p.id}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} Views">${icon('down', 'sm')}</button>
      <button class="ix-row" data-act="sel-pres" data-id="${p.id}">
        <span class="ix-thumb" style="background-image:url(${thumb(p.defaultViewId)})"></span>
        <span class="ix-name">${esc(p.name)}</span>
        ${inStops.length ? `<span class="ix-stops" title="Used by Stop ${inStops.join(', ')}">${inStops.map((n) => `<i>${n}</i>`).join('')}</span>` : `<span class="ix-free" title="Not in the Guide — free exploration">free</span>`}
      </button></div>${views}`;
  }).join('');
  const tl = timeline();
  el.innerHTML = `
    <div class="ix-head"><span class="ix-title">Experience</span><button class="icon-btn" data-act="index-rail" title="Collapse outline">${icon('back', 'sm')}</button></div>
    <div class="ix-scroll">
      <section class="ix-sec">
        <div class="ix-sec-head"><span>Presentations</span><button class="ix-add" data-act="new-pres" title="Present this standpoint">${icon('plus', 'sm')}<span>New</span></button></div>
        ${pres || `<div class="ix-empty"><b>Nothing presented yet.</b><br>Select an object on the Stage and choose <em>Present this</em> — or use <em>New</em> to present a standpoint.</div>`}
      </section>
      <section class="ix-sec">
        <div class="ix-sec-head"><span>Guide</span></div>
        <button class="ix-guide${sel?.type === 'guide' ? ' is-selected' : ''}" data-act="sel-guide">${icon('guide')}<span><b>${esc(doc.guide.name)}</b><small>${stops().length ? `${stops().length} stops · ${fmtTime(tl.total)}` : 'No stops yet'}</small></span></button>
      </section>
    </div>
    <div class="ix-foot"><span><i class="use in-guide"></i>in the Guide</span><span><i class="use free"></i>free exploration only</span><span>${icon('diamond', 'sm')}Default</span></div>`;
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
  if (!s) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.dataset.type = s.type;
  el.innerHTML = ({ object: cardObject, pres: cardPres, view: cardView, stop: cardStop, trans: cardTrans, point: cardTrans, guide: cardGuide })[s.type](s);
}

function cardObject(s) {
  const o = W.objectById[s.id];
  const pres = doc.presentations.filter((p) => p.subject === o.id);
  return cardShell({
    kicker: 'Scene object',
    title: o.name,
    actions: `<button class="btn primary wide" data-act="present" data-id="${o.id}">${icon('frame')}Present this</button>`,
    body: `<p class="c-note">Creates a Presentation with a first View framed on the ${esc(o.name.toLowerCase())}. You can add more Views afterwards.</p>
      ${pres.length ? `<div class="c-sec"><h3>Already presented in</h3>${pres.map((p) => `<button class="link-row" data-act="sel-pres" data-id="${p.id}"><span class="lr-thumb" style="background-image:url(${thumb(p.defaultViewId)})"></span><span>${esc(p.name)}</span>${icon('next', 'sm')}</button>`).join('')}</div>` : ''}
      <div class="c-meta">Placed in the World workspace · ${o.w.toFixed(1)} × ${o.d.toFixed(1)} m</div>`,
  });
}

function cardPres(s) {
  const p = P(s.id);
  const used = stopsUsing(p.id);
  const lookMode = ui.stage === 'plan' && !ui.look;
  const subj = p.subject && W.objectById[p.subject];
  const views = p.viewIds.map((vid, i) => {
    const v = V(vid);
    return `<div class="vtile" data-sort-index="${i}" data-key="${vid}" tabindex="0" role="button" data-act="sel-view" data-id="${vid}" aria-label="${esc(v.name)}${p.defaultViewId === vid ? ', Default View' : ''}">
      <span class="vt-img" style="background-image:url(${thumb(vid)})">${p.defaultViewId === vid ? `<span class="vt-def" title="Default View">${icon('diamond', 'sm')}Default</span>` : ''}</span>
      <span class="vt-name">${useDot(vid)}${esc(v.name)}</span></div>`;
  }).join('');
  return cardShell({
    kicker: `Presentation${subj ? ` · about <button class="kick-link" data-act="sel-object" data-id="${subj.id}">${esc(subj.name)}</button>` : ''}`,
    title: p.name, renameKind: 'pres', renameId: p.id, more: `pres:${p.id}`,
    actions: `<button class="btn primary" data-act="capture" data-id="${p.id}">${icon(lookMode ? 'place' : 'camera')}${lookMode ? 'Place a View' : 'Capture View'}</button>
      <button class="btn" data-act="add-stop" data-id="${p.id}">${icon('plus', 'sm')}Add to Guide</button>`,
    body: `
      <div class="c-sec"><div class="c-sec-head"><h3>Views</h3><span class="hint">${p.viewIds.length} · drag to reorder</span></div>
        <div class="vgrid" data-sort-group="pviews" data-pres="${p.id}">${views}</div>
        <p class="c-foot-note">${lookMode ? 'Place a View: click the plan where the camera stands, drag toward what it sees.' : 'Capture View records exactly what the Stage camera sees.'}</p>
      </div>
      <div class="c-sec"><h3>Visitors reach it</h3>
        <div class="reach">
          <div class="reach-row">${icon('guide', 'sm')}<span>${used.length ? `On the tour at ${used.map((x) => `<button class="stop-chip" data-act="sel-stop" data-id="${x.s.id}">Stop ${x.i + 1}</button>`).join(' ')}` : 'Not on the tour'}</span></div>
          <label class="reach-row toggle"><input type="checkbox" data-act="explore" data-id="${p.id}" ${p.explore ? 'checked' : ''}><span class="sw"></span><span>Open in free exploration <small>${p.viewIds.length > 1 ? `All ${p.viewIds.length} Views; opens at the Default` : 'Its View is listed for visitors'}</small></span></label>
        </div>
      </div>`,
  });
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
          ${shows.length ? shows.map((x) => `<button class="link-row" data-act="sel-stop" data-id="${x.s.id}"><span class="num">${x.i + 1}</span><span>Stop ${x.i + 1}${x.at === 0 ? ' · <em>entry</em>' : ` · ${ordinal(x.at + 1)} view`}</span>${icon('next', 'sm')}</button>`).join('') : `<div class="reach-row">${icon('guide', 'sm')}<span>Not in any Stop</span></div>`}
          <div class="reach-row">${icon('compass', 'sm')}<span>${p.explore ? 'Free exploration' + (isDef ? ' · opens here' : '') : 'Hidden from free exploration'}</span></div>
        </div>
      </div>`,
  });
}
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function stepper(act, attrs, value, label) {
  return `<span class="stepper" aria-label="${label}"><button data-act="${act}" ${attrs} data-d="-1" aria-label="Shorter">${icon('minus', 'sm')}</button><b>${value}</b><button data-act="${act}" ${attrs} data-d="1" aria-label="Longer">${icon('plus', 'sm')}</button></span>`;
}

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
  const outs = out.map((vid) => `<li class="shot is-out"><span class="shot-thumb" style="background-image:url(${thumb(vid)})"></span><span class="shot-name"><button class="name-btn" data-act="sel-view" data-id="${vid}">${esc(V(vid).name)}</button>${p.defaultViewId === vid ? `<span class="def" title="Presentation's Default View">${icon('diamond', 'sm')}</span>` : ''}</span><button class="btn xs" data-act="seq-add" data-stop="${st.id}" data-id="${vid}">${icon('plus', 'sm')}Include</button></li>`).join('');
  let after;
  if (tr) {
    const warn = tr.mode === 'travel' && routeWarning(V(tr.from), V(tr.to), doc.paths[tr.key]);
    after = `<div class="after">
      <div class="after-next"><span class="an-lbl">Visitor presses <b>Next</b></span>${icon('arrow', 'sm')}<button class="stop-link" data-act="sel-stop" data-id="${tr.next.id}"><span class="num">${si + 2}</span>${esc(P(tr.next.presId).name)}</button></div>
      <div class="field"><span class="f-lbl">Transition</span><div class="seg" role="group"><button aria-pressed="${tr.mode === 'cut'}" data-act="trans-mode" data-stop="${st.id}" data-mode="cut">${icon('cut', 'sm')}Cut</button><button aria-pressed="${tr.mode === 'travel'}" data-act="trans-mode" data-stop="${st.id}" data-mode="travel">${icon('travel', 'sm')}Travel</button></div></div>
      ${tr.mode === 'travel' ? `<div class="field"><span class="f-lbl">Duration</span>${stepper('trans-dur', `data-stop="${st.id}"`, tr.duration + 's', 'Travel duration')}</div>
      <button class="link-row" data-act="sel-trans" data-stop="${st.id}">${icon('travel', 'sm')}<span>Camera path · ${(doc.paths[tr.key]?.points.length || 0)} point${(doc.paths[tr.key]?.points.length || 0) === 1 ? '' : 's'}${warn ? ' · <b class="warn">crosses a wall</b>' : ''}</span>${icon('next', 'sm')}</button>` : `<p class="c-foot-note">The camera jumps straight to “${esc(V(tr.to).name)}”.</p>`}
    </div>`;
  } else after = `<p class="c-note">Last Stop. The tour ends here; visitors can keep exploring freely.</p>`;
  return cardShell({
    kicker: `Stop ${si + 1} of ${stops().length} · ${esc(doc.guide.name)}`,
    title: '', more: `stop:${st.id}`,
    body: `
      <button class="visits" data-act="sel-pres" data-id="${p.id}" title="Open the Presentation">
        <span class="visits-thumb" style="background-image:url(${thumb(seqIds[0])})"><span class="num lg">${si + 1}</span></span>
        <span class="visits-txt"><small>Visits${earlier ? ' again' : ''}</small><b>${esc(p.name)}</b><span class="open">Open Presentation ${icon('open', 'sm')}</span></span>
      </button>
      <div class="c-sec"><div class="c-sec-head"><h3>Guided views</h3><span class="hint">${fmtTime(span.t1 - span.t0)} · drag to reorder</span></div>
        <ol class="shots" data-sort-group="seq" data-stop="${st.id}" data-axis="y">${shots}</ol>
        ${outs ? `<div class="shots-out"><div class="c-sub">Not in this Stop <span>— visitors still find them when exploring freely</span></div><ul class="shots">${outs}</ul></div>` : ''}
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
    kicker: 'Transition',
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
        <div class="field"><span class="f-lbl">Path</span><span class="f-val">${path?.points.length || 0} point${(path?.points.length || 0) === 1 ? '' : 's'} · ${routeLength(from, to, path).toFixed(1)} m</span></div>
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
    actions: `<button class="btn" data-act="add-stop-menu">${icon('plus', 'sm')}Add stop</button>`,
    body: `
      <div class="c-sec"><h3>One museum, two ways in</h3>
        <div class="modes">
          <button class="mode-card" data-act="preview-guided">${icon('guide')}<b>Guided tour</b><span>${stops().length} stops · ${fmtTime(tl.total)} of camera time. Views play on their own; visitors press <em>Next</em> between Stops.</span></button>
          <button class="mode-card" data-act="preview-free">${icon('compass')}<b>Free exploration</b><span>${free.length} Presentations · ${allViews} Views. ${allViews - inGuide} View${allViews - inGuide === 1 ? ' is' : 's are'} only found this way.</span></button>
        </div>
        <p class="c-foot-note">Both use the same Presentations and Views. The Guide only decides an order through them.</p>
      </div>
      <div class="c-sec"><h3>Build the tour</h3><p class="c-note">Drag a Presentation from the outline onto the Guide, or use <em>Add stop</em>. Drag Stops to reorder. The order you see is the order visitors get.</p></div>`,
  });
}

// ——— Deck (Guide) ———
function renderDeck() {
  const el = $('#deck'); const tl = timeline();
  el.dataset.state = ui.deck;
  const S_ = stops();
  const tiles = S_.map((st, i) => {
    const p = P(st.presId); const span = tl.stops[i];
    const isSel = ui.sel?.type === 'stop' && ui.sel.id === st.id;
    const again = S_.slice(0, i).some((x) => x.presId === st.presId);
    const dur = span.t1 - span.t0;
    const segs = st.seq.map((q) => `<i style="flex:${q.hold}"></i>`).join('');
    let tile = `<div class="stop-tile${isSel ? ' is-selected' : ''}" data-sort-index="${i}" data-key="${st.id}" data-act="sel-stop" data-id="${st.id}" data-t0="${span.t0}" data-t1="${span.t1}" tabindex="0" role="button" aria-label="Stop ${i + 1}, ${esc(p.name)}, ${st.seq.length} views">
      <span class="st-thumb" style="background-image:url(${thumb(st.seq[0].viewId)})"><span class="num">${i + 1}</span></span>
      <span class="st-body"><b>${esc(p.name)}</b><small>${again ? '<em>again</em> · ' : ''}${st.seq.length} view${st.seq.length > 1 ? 's' : ''} · ${fmtTime(dur)}</small><span class="st-segs">${segs}</span></span>
      ${isSel ? `<button class="st-more icon-btn" data-act="menu" data-menu="stop:${st.id}" aria-label="Stop actions">${icon('more', 'sm')}</button>` : ''}
    </div>`;
    if (i < S_.length - 1) {
      const tr = transOf(i);
      const tsel = (ui.sel?.type === 'trans' || ui.sel?.type === 'point') && ui.sel.stopId === st.id;
      const warn = tr.mode === 'travel' && routeWarning(V(tr.from), V(tr.to), doc.paths[tr.key]);
      tile += `<button class="link ${tr.mode}${tsel ? ' is-selected' : ''}${warn ? ' is-warn' : ''}" data-act="sel-trans" data-stop="${st.id}" data-t0="${span.t1}" data-t1="${span.tEnd}" title="${tr.mode === 'cut' ? 'Cut' : 'Travel ' + tr.duration + 's'} — select to edit">
        <span class="lk-next">Next</span><span class="lk-mode">${icon(tr.mode === 'cut' ? 'cut' : 'travel', 'sm')}${tr.mode === 'cut' ? 'Cut' : tr.duration + 's'}</span></button>`;
    }
    return tile;
  }).join('');
  const playing = ui.play.playing;
  el.innerHTML = `
    <div class="deck-bar">
      <button class="icon-btn dk" data-act="deck-toggle" aria-expanded="${ui.deck === 'open'}" aria-label="${ui.deck === 'open' ? 'Collapse' : 'Expand'} Guide">${icon('down', 'sm')}</button>
      <div class="deck-title"><span class="kicker">Guide</span><button class="deck-name" data-act="sel-guide">${esc(doc.guide.name)}</button><span class="deck-meta">${S_.length} stop${S_.length === 1 ? '' : 's'}</span></div>
      <div class="transport" id="transport"></div>
      ${ui.deck === 'closed' ? `<div class="deck-mini">${S_.map((st, i) => `<button class="mini-dot${ui.sel?.type === 'stop' && ui.sel.id === st.id ? ' is-selected' : ''}" data-act="sel-stop" data-id="${st.id}" title="Stop ${i + 1} · ${esc(P(st.presId).name)}">${i + 1}</button>`).join('<i class="mini-link"></i>')}</div>` : ''}
      <span class="grow"></span>
      <button class="btn dk-btn" data-act="add-stop-menu" ${doc.presentations.length ? '' : 'disabled title="Create a Presentation first"'}>${icon('plus', 'sm')}<span class="lbl">Add stop</span></button>
    </div>
    ${ui.deck === 'open' ? `<div class="deck-scroll" id="deck-scroll"><div class="deck-lane" id="deck-lane">
      ${S_.length ? `<div class="deck-row" data-sort-group="stops" id="deck-row">${tiles}<div class="deck-drop-end" data-drop-end></div></div>
      <div class="deck-rail" id="deck-rail"><span class="rail-track"></span><span class="rail-fill" id="rail-fill"></span></div>
      <div class="playhead" id="playhead"><span class="ph-knob"></span></div>` : `<div class="deck-empty" data-drop-end id="deck-row">${icon('guide')}<span><b>The Guide is empty.</b> Drag a Presentation here from the outline, or use <em>Add stop</em>. Each Stop starts at that Presentation’s Default View.</span></div>`}
    </div></div>` : ''}`;
  renderDeckBar();
  requestAnimationFrame(updatePlayheadDom);
}
function renderDeckBar() {
  const tr = $('#transport'); if (!tr) return;
  const tl = timeline(); const playing = ui.play.playing;
  tr.innerHTML = tl.total ? `
    <button class="tp-play" data-act="play" aria-label="${playing ? 'Pause' : 'Play'}">${icon(playing ? 'pause' : 'play')}</button>
    <span class="tp-time"><b id="tp-now">${fmtTime(ui.play.t)}</b><span> / ${fmtTime(tl.total)}</span></span>
    <button class="tp-follow" data-act="follow" aria-pressed="${ui.play.follow}" title="See through the moving camera; turning it off returns you to where you were">${icon('follow', 'sm')}<span class="lbl">Follow camera</span></button>` : '';
}
function tToX(t) {
  const lane = $('#deck-lane'); if (!lane) return null;
  const els = [...lane.querySelectorAll('[data-t0]')];
  for (const e of els) {
    const t0 = +e.dataset.t0, t1 = +e.dataset.t1;
    if (t >= t0 && t <= t1 + 1e-6) {
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5;
      if (t1 === t0 && e.classList.contains('stop-tile')) continue;
      return e.offsetLeft + 8 + u * (e.offsetWidth - 16);
    }
  }
  const last = els[els.length - 1]; return last ? last.offsetLeft + last.offsetWidth - 8 : 0;
}
function xToT(x) {
  const lane = $('#deck-lane'); if (!lane) return 0;
  const els = [...lane.querySelectorAll('[data-t0]')];
  for (const e of els) {
    if (x <= e.offsetLeft + e.offsetWidth) {
      const t0 = +e.dataset.t0, t1 = +e.dataset.t1;
      const u = Math.max(0, Math.min(1, (x - e.offsetLeft - 8) / (e.offsetWidth - 16)));
      return t0 + u * (t1 - t0);
    }
  }
  return timeline().total;
}
function updatePlayheadDom() {
  const now = $('#tp-now'); if (now) now.textContent = fmtTime(ui.play.t);
  const ph = $('#playhead'), fill = $('#rail-fill'); if (!ph) return;
  const x = tToX(ui.play.t); if (x == null) return;
  ph.style.transform = `translateX(${x}px)`; fill.style.width = x + 'px';
  ph.classList.toggle('is-live', ui.play.playing || ui.play.t > 0);
  const ev = evaluate(doc, timeline(), ui.play.t);
  document.querySelectorAll('.stop-tile').forEach((e, i) => e.classList.toggle('is-playing', !!ev && (ui.play.playing || ui.play.t > 0) && ev.si === i && ev.seg.kind !== 'travel'));
  document.querySelectorAll('.deck-row .link').forEach((e) => e.classList.toggle('is-playing', !!ev && ui.play.playing && ev.seg.kind === 'travel' && e.dataset.stop === stops()[ev.si]?.id));
  if (ui.play.playing) { const sc = $('#deck-scroll'); if (sc && (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 40)) sc.scrollLeft = x - sc.clientWidth / 2; }
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
  }
  const lockToggle = !!(ui.look || ui.play.follow);
  const empty = !doc.presentations.length && !ui.tool && !ui.sel;
  el.innerHTML = `
    <div class="stage-tl">
      <div class="seg on-stage" role="group" aria-label="Stage view">
        <button aria-pressed="${ui.stage === 'plan'}" data-act="stage" data-m="plan" ${lockToggle ? 'title="Returns to Plan and exits the camera"' : ''}>${icon('plan', 'sm')}Plan</button>
        <button aria-pressed="${ui.stage === '3d'}" data-act="stage" data-m="3d">${icon('cube', 'sm')}3D</button>
      </div>
    </div>
    ${pill ? `<div class="stage-tc">${pill}</div>` : ''}
    ${empty ? `<div class="stage-coach"><b>Start your experience</b><span>Click an object — the piano, a painting, the Muse — and choose <em>Present this</em>. Or press <em>New</em> in the outline to present any standpoint.</span></div>` : ''}
    <div class="stage-br">
      ${ui.stage === 'plan' && !lockToggle ? `<div class="zoom"><button class="icon-btn" data-act="zoom" data-f="0.8" aria-label="Zoom out">${icon('minus', 'sm')}</button><button class="icon-btn" data-act="fit" aria-label="Fit plan">${icon('fit', 'sm')}</button><button class="icon-btn" data-act="zoom" data-f="1.25" aria-label="Zoom in">${icon('plus', 'sm')}</button></div><div class="scale"><i></i><span>${scaleLabel()}</span></div>` : ''}
      ${ui.stage === '3d' && !lockToggle ? `<span class="nav-hint">Drag to orbit · Shift-drag to pan · Scroll to zoom</span>` : ''}
    </div>`;
  if (ui.look || ui.play.follow) stageEl.classList.add('is-through'); else stageEl.classList.remove('is-through');
}
function scaleLabel() { const m = Math.round(80 / plan.cam.ppm); const el = document.querySelector('.scale i'); return `${m || 1} m`; }

function emphasis() {
  const e = { routes: [] }; const s = ui.sel;
  const allRoutes = (selIdx = -1, faint = true) => stops().forEach((_, i) => { const t = transOf(i); if (t) e.routes.push({ from: t.from, to: t.to, mode: t.mode, selected: i === selIdx, warn: t.mode === 'travel' && routeWarning(V(t.from), V(t.to), doc.paths[t.key]), faint }); });
  if (s?.type === 'object') e.objectId = s.id;
  else if (s?.type === 'pres') { e.presId = s.id; e.subjectId = P(s.id).subject; }
  else if (s?.type === 'view') { e.presId = V(s.id).presId; e.viewId = s.id; }
  else if (s?.type === 'stop') {
    const st = S(s.id), si = stopIndex(s.id); e.presId = st.presId; e.stopSeq = st.seq.map((q) => q.viewId);
    [si - 1, si].forEach((i) => { const t = transOf(i); if (t) e.routes.push({ from: t.from, to: t.to, mode: t.mode, selected: false }); });
  } else if (s?.type === 'trans' || s?.type === 'point') {
    const si = stopIndex(s.stopId); const t = transOf(si);
    e.routes.push({ from: t.from, to: t.to, mode: t.mode, selected: true, warn: t.mode === 'travel' && routeWarning(V(t.from), V(t.to), doc.paths[t.key]) });
    if (s.type === 'point') e.pointSel = { key: s.key, i: s.i };
  } else if (s?.type === 'guide' || (!s && ui.deck === 'open')) allRoutes();
  if (ui.play.playing || ui.play.t > 0) {
    if (!(ui.sel?.type === 'trans' || ui.sel?.type === 'point') && !e.routes.length) allRoutes();
    const ev = evaluate(doc, timeline(), ui.play.t); if (ev && !ui.play.follow) e.puck = ev.pose;
  }
  return e;
}
function refreshStage() {
  const e = emphasis();
  plan.render(doc, e);
  stage3d.updateHelpers(doc, { presId: e.presId, viewId: e.viewId, routes: e.routes, objectId: e.objectId || e.subjectId });
  stage3d.setPuck(e.puck && !ui.look && !ui.play.follow ? e.puck : null);
  if (ui.look || ui.play.follow) { stage3d.helpers.visible = false; } else stage3d.helpers.visible = true;
  const sc = document.querySelector('.scale span'); if (sc) sc.textContent = scaleLabel();
  const si = document.querySelector('.scale i'); if (si) si.style.width = Math.round(80 / plan.cam.ppm || 1) * plan.cam.ppm + 'px';
}
stage3d.onRender = () => {
  const host = $('#stage-labels'); if (ui.stage !== '3d' || ui.look || ui.play.follow) { host.innerHTML = ''; return; }
  let h = '';
  const s = ui.sel;
  if (s?.type === 'view') { const v = V(s.id); const p = stage3d.project([v.pos[0], v.pos[1] + 0.35, v.pos[2]]); if (!p.behind) h += `<span class="lbl3d sel" style="left:${p.x}px;top:${p.y}px">${esc(v.name)}</span>`; }
  if (s?.type === 'object') { const o = W.objectById[s.id]; const p = stage3d.project([o.x, (o.y || 0) + o.h + 0.3, o.z]); if (!p.behind) h += `<span class="lbl3d sel" style="left:${p.x}px;top:${p.y}px">${esc(o.name)}</span>`; }
  if (s?.type === 'stop') S(s.id).seq.forEach((q, i) => { const v = V(q.viewId); const p = stage3d.project([v.pos[0], v.pos[1] + 0.35, v.pos[2]]); if (!p.behind) h += `<span class="lbl3d seq" style="left:${p.x}px;top:${p.y}px"><i>${i + 1}</i>${esc(v.name)}</span>`; });
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
function closeMenu() { const l = $('#menu-layer'); l.classList.remove('open'); l.innerHTML = ''; }
$('#menu-layer').addEventListener('click', (e) => {
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
      '-',
      { act: 'x', label: 'Remove Stop', icon: 'trash', danger: true, hint: 'Presentation stays', run: () => { commit((d) => { d.guide.stops.splice(i, 1); }, `Stop ${i + 1} removed — “${P(S(id).presId).name}” is still in the outline`); } },
    ]);
  }
}
function addStopMenu(anchor) {
  openMenu(anchor, [{ head: 'Add a Stop that visits…' }, ...doc.presentations.map((p) => ({ act: p.id, label: esc(p.name), icon: 'frame', hint: stopsUsing(p.id).length ? 'again' : '', run: () => addStop(p.id) }))]);
}
function protoMenu(anchor) {
  openMenu(anchor, [
    { head: 'Prototype controls — not product UI' },
    { act: 'e', label: 'Start from an empty experience', icon: 'plus', run: () => loadScenario('empty') },
    { act: 'p', label: 'Load the Salon tour', icon: 'guide', run: () => loadScenario('populated') },
    '-',
    { head: 'Simulate width' },
    ...['desktop', 'tablet', 'phone'].map((d) => ({ act: d, label: d[0].toUpperCase() + d.slice(1), on: ui.device === d, icon: ui.device === d ? 'check' : null, run: () => { ui.device = d; if (d === 'phone') ui.deck = 'closed'; render(); setTimeout(() => { plan.fit(); }, 60); } })),
  ]);
}
function loadScenario(k) {
  if (ui.look) exitLook(); if (ui.play.follow) stopFollow(false);
  doc = k === 'empty' ? W.seedEmpty() : W.seedPopulated();
  undoStack.length = 0; redoStack.length = 0; ui.sel = null; ui.nav = []; ui.play.t = 0; ui.play.playing = false;
  ui.stage = k === 'empty' ? '3d' : 'plan';
  if (k === 'empty') { stage3d.mode = 'orbit'; stage3d.orbit = { ...stage3d.orbit, target: stage3d.orbit.target.clone().set(19, 0, 10.5), r: 24, theta: Math.PI / 2 + 0.35, phi: 0.95 }; stage3d.applyCamera(); }
  changed(); toast(k === 'empty' ? 'Empty experience — same museum, nothing presented yet' : 'Salon tour loaded');
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
    'deck-toggle': () => { ui.deck = ui.deck === 'open' ? 'closed' : 'open'; render(); },
    play: () => (ui.play.playing ? pause() : play()),
    follow: () => (ui.play.follow ? stopFollow() : startFollow()),
    stage: () => setStage(b.dataset.m),
    zoom: () => { plan.zoomStep(+b.dataset.f); refreshStage(); }, fit: () => { plan.fit(); refreshStage(); },
    'cancel-tool': cancelTool,
  };
  if (H[a]) { e.preventDefault(); H[a](); }
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
    if (ui.look) return exitLook();
    if (ui.play.follow) return stopFollow();
    if (ui.drawer) { ui.drawer = false; return render(); }
    if (ui.sel) return select(null);
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
  sortS = { it, g, x: e.clientX, y: e.clientY, from: +it.dataset.sortIndex, to: +it.dataset.sortIndex, active: false, axis: g.dataset.axis || 'x' };
});
window.addEventListener('pointermove', (e) => {
  if (!sortS) return;
  const dx = e.clientX - sortS.x, dy = e.clientY - sortS.y;
  if (!sortS.active && Math.hypot(dx, dy) < 6) return;
  if (!sortS.active) { sortS.active = true; sortS.it.classList.add('dragging'); sortS.g.classList.add('sorting'); document.body.classList.add('is-sorting'); }
  const vertical = sortS.axis === 'y' || sortS.g.classList.contains('vgrid');
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
  s.it.style.transform = ''; s.it.classList.remove('dragging'); s.g.classList.remove('sorting');
  doReorder(s.g, s.from, s.to);
  if (s.from === s.to) render();
});

// Drag a Presentation from the outline onto the Guide.
document.addEventListener('dragstart', (e) => {
  const r = e.target.closest?.('[data-pres-drag]'); if (!r) return;
  e.dataTransfer.setData('text/x-pres', r.dataset.presDrag); e.dataTransfer.effectAllowed = 'copy';
  document.body.classList.add('is-dragging-pres');
  if (ui.deck !== 'open') { ui.deck = 'open'; renderDeck(); }
});
document.addEventListener('dragend', () => { document.body.classList.remove('is-dragging-pres'); document.querySelectorAll('.drop-caret').forEach((x) => x.classList.remove('drop-caret')); });
function dropIndex(e) {
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

// Scrub rail.
let scrubbing = false;
$('#deck').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#deck-rail, #playhead')) return;
  scrubbing = true; pause(); const lane = $('#deck-lane').getBoundingClientRect();
  scrubTo(xToT(e.clientX - lane.left)); e.preventDefault();
});
window.addEventListener('pointermove', (e) => { if (!scrubbing) return; const lane = $('#deck-lane').getBoundingClientRect(); scrubTo(xToT(e.clientX - lane.left)); });
window.addEventListener('pointerup', () => { scrubbing = false; });

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
