// Boot, input and the frame loop. Pointer gestures route to actions; nothing here decides
// domain meaning. Keyboard paths mirror every pointer path that matters to the journey.
import * as THREE from 'three';
import { S, P, D, emit } from './state.js';
import * as A from './actions.js';
import { Stage } from './stage.js';
import { Overlay, drawOverlay } from './overlay.js';
import * as UI from './ui.js';
import { compileLayout, valueOf, featureAt, iface, defOf, poseOf, checkHang, wallById, hangPose, NATIVE } from './model.js';
import { initScenario, toggleScenario, gotoStep, showState } from './scenario.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
if (q.get('approach') === 'bench') S.approach = 'bench';
if (q.get('motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) S.motion = 'reduced';
if (q.get('density') === 'compact') document.body.dataset.density = 'compact';

const cv = $('gl');
const stage = new Stage(cv);
A.bindStage(stage);
const ov = new Overlay($('ovSvg'), $('ovHtml'));
window.__c2 = { S, A, stage, D, P };

// ---------------------------------------------------------------- what the stage shows
let view = null;
let lastKey = '';
function syncKey() {
  const I = S.instr;
  const ik = I ? JSON.stringify({ k: I.kind, u: I.use, sh: I.show, c: I.choices, d: I.detach, cand: I.cand ? [I.cand.wall, I.cand.s, I.cand.h, I.cand.back, I.cand.chk?.ok] : null, off: I.off, dr: I.draft, def: I.def, pl: I.kind === 'preview' && S.motion === 'reduced' ? I.playing : null, e: I.expected, to: I.to, src: I.src, ph: I.phase }) : '';
  return [S.store.active, P().rev, ik, JSON.stringify(S.reach), S.reachScope, S.approach, S.motion, S.store.library.available].join('|');
}
function buildView() {
  const doc0 = D();
  const I = S.instr;
  let doc = doc0;
  const v = { doc, C: null, extra: null, ghosts: [], bench: null, hover: S.hoverTarget, review: null };
  if (I?.kind === 'review') {
    const cand = A.reviewCandidate();
    v.review = cand;
    if (I.show !== 'rev1') doc = cand;
    if (I.show === 'both') {
      const C0 = compileLayout(doc0.layout);
      for (const uid of A.usesOfDef(doc0, I.def).all) v.ghosts.push({ doc: doc0, uid, tone: 'view', C: C0 });
    }
  } else if (I?.kind === 'libreview') {
    doc = A.libCandidate(doc0, I.def, I.to);
  } else if (I?.kind === 'wallmove') {
    doc = { ...doc0, layout: { ...doc0.layout, backZ: Math.round((doc0.layout.backZ + I.off) * 100) / 100 } };
  }
  v.doc = doc;
  v.C = compileLayout(doc.layout);
  // hover previews: the candidate value on exactly the uses it would reach
  if (S.reach && S.reach.value !== undefined && doc.uses[S.reach.uid]) {
    const scope = S.reach.scope ?? (S.approach === 'contextual' ? S.reachScope : 'use');
    const R = A.reachOf(doc, S.reach.uid, S.reach.key, scope);
    v.extra = {};
    for (const id of R.changes) v.extra[id] = { [S.reach.key]: S.reach.value };
  }
  const intake = A.intakePreviewDoc();
  if (intake) v.ghosts.push({ doc: intake, uid: 'U-INTAKE', tone: 'guide', C: v.C });
  if (I?.kind === 'hang' && I.cand && !I.cand.back) {
    const w = wallById(v.C, I.cand.wall);
    if (w) v.ghosts.push({ doc, uid: I.use, pose: hangPose(w, I.cand.s, I.cand.h), tone: I.cand.chk.ok ? 'guide' : 'refuse', C: v.C });
  }
  if (I?.kind === 'preview' && I.playing && S.motion === 'reduced' && doc.uses[I.use]) {
    const f = featureAt(doc, doc.uses[I.use].def, I.key);
    v.ghosts.push({ doc, uid: I.use, tone: 'run', tilt: f.min, C: v.C }, { doc, uid: I.use, tone: 'run', tilt: f.max, C: v.C });
  }
  if (I?.kind === 'bench') {
    const vals = {};
    for (const f of iface(doc0, I.def).features) vals[f.key] = A.benchValue(doc0, I.def, f.key, I.draft);
    v.bench = { doc: doc0, defId: I.def, vals };
  }
  return v;
}
function posesFor(v) {
  const m = new Map();
  for (const uid of Object.keys(v.doc.uses)) m.set(uid, poseOf(v.doc, v.C, uid));
  if (S.drag?.poses) for (const [uid, p] of S.drag.poses) m.set(uid, p);
  return m;
}

// ---------------------------------------------------------------- tints (state language on the model)
const PAPER = '#F5F2E9';
const startsWith = (path, pre) => (pre ?? []).every((x, i) => path[i] === x);
const MOVES = ['p.arm', 'p.shade', 'p.diffuser', 'p.clip'];
function meshTint(m) {
  const u = m.userData.use;
  const path = m.userData.path ?? [];
  const s = S.sel;
  const I = S.instr;
  if (I?.kind === 'preview' && I.use === u && path.some((x) => MOVES.includes(x))) return { color: '#6B4FA0', k: 0.24 };
  if (s?.kind === 'use' && s.id === u && startsWith(path, s.path) && !S.multi.length) return { color: '#2F8CFF', k: s.path?.length ? 0.34 : 0.2 };
  if (S.multi.length && (S.multi.includes(u) || s?.id === u)) return { color: '#2F8CFF', k: 0.2 };
  if (s?.kind === 'group' && D().groups[s.id]?.members.includes(u)) return { color: '#2F8CFF', k: 0.12 };
  const hv = S.hoverTarget;
  if (hv?.kind === 'use' && hv.id === u && startsWith(path, hv.path)) return { color: '#FFFFFF', k: 0.12 };
  if (hv?.kind === 'group' && D().groups[hv.id]?.members.includes(u)) return { color: '#FFFFFF', k: 0.08 };
  if (S.mode === 'layout') return { color: PAPER, k: 0.5 };
  if (I?.kind === 'inspect' && I.use !== u) return { color: PAPER, k: 0.55 };
  if (I?.kind === 'preview' && I.use !== u) return { color: PAPER, k: 0.35 };
  if (S.ctx?.use && S.ctx.use !== u) return { color: PAPER, k: 0.5 };
  return null;
}
function archTint(m) {
  const w = m.userData.wall;
  if (!w) return null;
  const s = S.sel;
  if ((s?.kind === 'wall' && s.id === w) || (S.instr?.kind === 'wallmove' && S.instr.wall === w)) return { color: '#2F8CFF', k: 0.14 };
  if (S.tool === 'hang' && S.instr?.cand?.wall === w) return { color: S.instr.cand.chk?.ok && !S.instr.cand.back ? '#146D68' : '#9B3149', k: 0.13 };
  if (S.hoverTarget?.kind === 'wall' && S.hoverTarget.id === w) return { color: '#FFFFFF', k: 0.1 };
  return null;
}

// ---------------------------------------------------------------- pointer
const pickOpts = () => ({ uses: S.mode !== 'layout' && S.tool !== 'hang' });
function hoverTarget(hit) {
  if (!hit || S.instr?.kind === 'bench') return null;
  if (hit.wall || hit.opening) return S.tool === 'hang' ? null : { kind: 'wall', id: hit.wall };
  if (!hit.use || S.mode === 'layout') return null;
  const path = hit.path ?? [];
  const ctx = S.ctx;
  if (ctx?.use === hit.use) {
    const pre = ctx.path;
    const inside = pre.every((x, i) => path[i] === x);
    return { kind: 'use', id: hit.use, path: inside ? path.slice(0, pre.length + 1) : path.slice(0, Math.min(path.length, pre.length + 1)) };
  }
  const g = A.groupOf(hit.use);
  if (g && ctx?.group !== g) return { kind: 'group', id: g };
  return { kind: 'use', id: hit.use, path: [] };
}
function hoverAt(e) {
  if (S.tool === 'hang') {
    A.hangHover(stage.pick(e.clientX, e.clientY, { uses: false }));
    S.hoverTarget = null;
    cv.style.cursor = 'crosshair';
    return;
  }
  const hit = stage.pick(e.clientX, e.clientY, pickOpts());
  S.hoverTarget = hoverTarget(hit);
  const s = S.sel;
  const movable = hit?.use && S.mode === 'arrange' && !S.instr && ((s?.kind === 'use' && s.id === hit.use && !s.path?.length) || (s?.kind === 'group' && D().groups[s.id]?.members.includes(hit.use)));
  cv.style.cursor = movable ? 'grab' : S.hoverTarget ? 'pointer' : 'default';
}

let pd = null;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  cv.focus({ preventScroll: true });
  if (S.pop) { S.pop = null; emit('ui'); }
  const hit = stage.pick(e.clientX, e.clientY, pickOpts());
  pd = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, button: e.button, shift: e.shiftKey, alt: e.altKey, hit, moved: false, mode: null };
  try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
cv.addEventListener('pointermove', (e) => {
  if (!pd) { hoverAt(e); return; }
  const dx = e.clientX - pd.lx;
  const dy = e.clientY - pd.ly;
  pd.lx = e.clientX;
  pd.ly = e.clientY;
  if (!pd.moved && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 4) {
    pd.moved = true;
    pd.mode = decideDrag(pd);
    if (['move', 'group', 'along'].includes(pd.mode)) beginObjDrag(pd);
    document.body.classList.add('dragging');
  }
  if (!pd.moved) return;
  if (pd.mode === 'orbit') stage.orbit(dx, dy);
  else if (pd.mode === 'pan') stage.pan(dx, dy);
  else objDrag(pd, e);
});
function endPointer(e, cancelled) {
  if (!pd) return;
  const p = pd;
  pd = null;
  document.body.classList.remove('dragging');
  try { cv.releasePointerCapture(p.id); } catch { /* ignore */ }
  if (cancelled) { S.drag = null; return; }
  if (!p.moved) { clickAt(p); return; }
  if (['move', 'group', 'along'].includes(p.mode)) endObjDrag(p);
}
cv.addEventListener('pointerup', (e) => endPointer(e));
cv.addEventListener('pointercancel', (e) => endPointer(e, true));
cv.addEventListener('pointerleave', () => { if (!pd) { S.hoverTarget = null; if (S.tool === 'hang') A.hangHover(null); } });
cv.addEventListener('dblclick', (e) => {
  if (S.tool === 'hang' || S.mode === 'layout' || S.instr?.kind === 'bench' || S.instr?.kind === 'review' || S.instr?.kind === 'libreview') return;
  const hit = stage.pick(e.clientX, e.clientY, pickOpts());
  if (hit?.use) A.descend(hit, e);
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); stage.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

function decideDrag(p) {
  if (p.button === 2 || p.button === 1 || (p.button === 0 && p.shift && !p.hit?.use)) return 'pan';
  if (p.button !== 0) return 'orbit';
  if (S.instr || S.tool === 'hang' || S.mode !== 'arrange') return 'orbit';
  const h = p.hit;
  if (!h?.use) return 'orbit';
  const s = S.sel;
  const doc = D();
  if (s?.kind === 'group' && doc.groups[s.id]?.members.includes(h.use)) return 'group';
  if (s?.kind === 'use' && s.id === h.use && !S.multi.length) {
    if (s.path?.length) { A.flash('Parts keep their declared frames — select the whole object (Esc) to move it.', 'info', { x: p.x, y: p.y }); return 'orbit'; }
    const u = doc.uses[h.use];
    return u.attach && !u.attach.broken ? 'along' : 'move';
  }
  return 'orbit';
}
function beginObjDrag(p) {
  const doc = D();
  const C = compileLayout(doc.layout);
  if (p.mode === 'move') {
    const uid = S.sel.id;
    const pose = poseOf(doc, C, uid);
    const g = stage.rayPlaneY(p.x, p.y, pose.y) ?? new THREE.Vector3(pose.x, pose.y, pose.z);
    // who is resting on it now (they won't follow — resting is placement, not attachment)
    const dependents = Object.keys(doc.uses).filter((id) => {
      if (id === uid) return false;
      const q2 = poseOf(doc, C, id);
      return q2.y > 0.01 && !doc.uses[id].attach && stage.supportAt(q2.x, q2.z, id)?.use === uid;
    });
    p.drag = { uid, orig: pose, off: [pose.x - g.x, pose.z - g.z], dependents };
    S.drag = { kind: 'move', poses: new Map([[uid, { ...pose }]]), rest: null };
  } else if (p.mode === 'group') {
    const mem = doc.groups[S.sel.id].members.filter((m) => !(doc.uses[m].attach && !doc.uses[m].attach.broken));
    p.drag = { gid: S.sel.id, g0: stage.rayPlaneY(p.x, p.y, 0), orig: new Map(mem.map((m) => [m, poseOf(doc, C, m)])) };
    S.drag = { kind: 'group', poses: new Map(mem.map((m) => [m, { ...poseOf(doc, C, m) }])) };
  } else if (p.mode === 'along') {
    const uid = S.sel.id;
    const u = doc.uses[uid];
    const w = wallById(C, u.attach.host);
    const n3 = new THREE.Vector3(w.n[0], 0, w.n[1]);
    const face = new THREE.Vector3(w.a[0] + (w.n[0] * w.t) / 2, 0, w.a[1] + (w.n[1] * w.t) / 2);
    const hit = stage.rayPlane(p.x, p.y, n3, face);
    const s0 = hit ? (hit.x - w.a[0]) * w.tan[0] + (hit.z - w.a[1]) * w.tan[1] : u.attach.s;
    const h0 = hit ? hit.y : u.attach.h;
    p.drag = { uid, w, n3, face, ds: u.attach.s - s0, dh: u.attach.h - h0 };
    S.drag = { kind: 'along', host: w.id, poses: new Map([[uid, poseOf(doc, C, uid)]]), cand: { s: u.attach.s, h: u.attach.h, chk: { ok: true } } };
  }
}
function objDrag(p, e) {
  const doc = D();
  if (p.mode === 'move') {
    const d = p.drag;
    const g = stage.rayPlaneY(e.clientX, e.clientY, d.orig.y);
    if (!g) return;
    let x = g.x + d.off[0];
    let z = g.z + d.off[1];
    if (!e.altKey) { x = Math.round(x / 0.05) * 0.05; z = Math.round(z / 0.05) * 0.05; }
    const sup = stage.supportAt(x, z, d.uid);
    S.drag.poses.set(d.uid, { x, y: sup ? sup.y : 0, z, rotY: d.orig.rotY });
    S.drag.rest = sup?.use ?? null;
  } else if (p.mode === 'group') {
    const g = stage.rayPlaneY(e.clientX, e.clientY, 0);
    if (!g || !p.drag.g0) return;
    let dx = g.x - p.drag.g0.x;
    let dz = g.z - p.drag.g0.z;
    if (!e.altKey) { dx = Math.round(dx / 0.05) * 0.05; dz = Math.round(dz / 0.05) * 0.05; }
    p.drag.delta = [dx, 0, dz];
    for (const [m, o] of p.drag.orig) S.drag.poses.set(m, { ...o, x: o.x + dx, z: o.z + dz });
  } else if (p.mode === 'along') {
    const d = p.drag;
    const hit = stage.rayPlane(e.clientX, e.clientY, d.n3, d.face);
    if (!hit) return;
    let s = (hit.x - d.w.a[0]) * d.w.tan[0] + (hit.z - d.w.a[1]) * d.w.tan[1] + d.ds;
    let h = hit.y + d.dh;
    if (!e.altKey) { s = Math.round(s / 0.05) * 0.05; h = Math.round(h / 0.05) * 0.05; }
    const chk = checkHang(compileLayout(doc.layout), d.w.id, s, h, NATIVE['N-PLINTH'].mounts[0]);
    S.drag.cand = { s, h, chk };
    if (chk.ok) S.drag.poses.set(d.uid, hangPose(d.w, s, h));
  }
}
function endObjDrag(p) {
  const dr = S.drag;
  S.drag = null;
  if (!dr) return;
  const doc = D();
  if (p.mode === 'move') {
    const uid = p.drag.uid;
    const q2 = dr.poses.get(uid);
    if (Math.hypot(q2.x - p.drag.orig.x, q2.z - p.drag.orig.z) < 0.001 && Math.abs(q2.y - p.drag.orig.y) < 0.001) return;
    const rest = dr.rest ? doc.uses[dr.rest] : null;
    const u = doc.uses[uid];
    A.moveUse(uid, [q2.x, q2.y, q2.z], null, rest ? `Rest ${u.name} ${uid} on ${rest.name} ${rest.id} (placement only)` : `Move ${u.name} ${uid}`);
    if (rest) A.flash(`Resting on ${rest.name} — placement only, not attached. To keep them together, make them one definition.`, 'info');
    else if (p.drag.dependents.length) A.flash(`${p.drag.dependents.map((id) => doc.uses[id].name).join(', ')} stayed where it was: resting on something isn’t attachment.`, 'warn');
  } else if (p.mode === 'group') {
    if (p.drag.delta && (Math.abs(p.drag.delta[0]) > 0.001 || Math.abs(p.drag.delta[2]) > 0.001)) A.moveGroup(p.drag.gid, p.drag.delta);
  } else if (p.mode === 'along') {
    const c = dr.cand;
    if (!c.chk.ok) { A.flash(`${c.chk.reason} Released on an invalid spot — nothing changed.`, 'refuse'); return; }
    const u = doc.uses[p.drag.uid];
    if (Math.abs(c.s - u.attach.s) < 0.001 && Math.abs(c.h - u.attach.h) < 0.001) return;
    A.moveAlong(p.drag.uid, c.s, c.h);
  }
}
function clickAt(p) {
  if (p.button !== 0) return;
  const I = S.instr;
  if (S.tool === 'hang') {
    A.hangHover(stage.pick(p.x, p.y, { uses: false }));
    A.hangCommit();
    return;
  }
  if (I?.kind === 'bench' || I?.kind === 'review' || I?.kind === 'libreview' || I?.kind === 'intake') return;
  if (S.mode === 'layout') {
    const h = p.hit;
    if (h?.wall) A.select({ kind: 'wall', id: h.wall });
    else if (h?.opening) A.select({ kind: 'opening', id: h.opening });
    else A.select(null);
    return;
  }
  A.pickSelect(p.hit, { shiftKey: p.shift, altKey: p.alt, clientX: p.x, clientY: p.y });
}

// wall handle (Layout): one drag = one accepted Layout action
let wd = null;
const ovHtml = $('ovHtml');
ovHtml.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-drag="wall"]');
  if (!h) return;
  e.preventDefault();
  e.stopPropagation();
  if (S.instr?.kind !== 'wallmove') A.wallMoveStart('W-FJSK');
  const p0 = stage.rayPlaneY(e.clientX, e.clientY, 1.6);
  wd = { z0: p0 ? p0.z : 0, off0: S.instr?.off ?? 0 };
  try { h.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  document.body.classList.add('dragging');
});
ovHtml.addEventListener('pointermove', (e) => {
  if (!wd) return;
  const p = stage.rayPlaneY(e.clientX, e.clientY, 1.6);
  if (!p) return;
  let off = wd.off0 + (p.z - wd.z0);
  if (!e.altKey) off = Math.round(off / 0.05) * 0.05;
  A.wallMoveSet(off);
});
ovHtml.addEventListener('pointerup', () => {
  if (!wd) return;
  wd = null;
  document.body.classList.remove('dragging');
  A.wallMoveCommit();
});

// ---------------------------------------------------------------- frame loop
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  stage.resize();
  const I = S.instr;
  if (I?.kind === 'preview' && I.playing && S.motion !== 'reduced' && D().uses[I.use]) {
    const f = featureAt(D(), D().uses[I.use].def, I.key);
    const mid = (f.min + f.max) / 2;
    const amp = (f.max - f.min) / 2;
    if (I.t0 == null) { I.t0 = Math.asin(Math.max(-1, Math.min(1, (I.value - mid) / amp))); I.t = 0; }
    I.t += dt;
    I.value = mid + amp * Math.sin(I.t0 + I.t * 1.25);
    UI.render('instr');
  } else if (I?.kind === 'preview') I.t0 = null;
  const key = syncKey();
  if (key !== lastKey || !view) {
    view = buildView();
    stage.sync(view);
    lastKey = key;
  }
  view.hover = S.hoverTarget;
  const instant = S.motion === 'reduced' || !!S._instant;
  stage.frame(dt, {
    poses: posesFor(view),
    instant,
    tilt: (uid, k) => (I?.kind === 'preview' && I.use === uid && I.key === k ? I.value : valueOf(view.doc, uid, k, view.extra?.[uid]).value ?? 30),
    sep: (uid) => (I?.kind === 'inspect' && I.use === uid ? I.sep : 0),
    tint: meshTint,
    archTint,
    lampOn: () => true,
  });
  drawOverlay(ov, stage, view);
  UI.renderFlash();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- delegated UI events
const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const num = (v) => (v !== '' && v != null && /^-?\d/.test(String(v)) && !Number.isNaN(Number(v)) ? Number(v) : v);
const scopeNow = (uid) => (S.approach === 'contextual' && S.reachScope === 'def' && defOf(D(), D().uses[uid].def)?.kind === 'composition' ? 'def' : 'use');

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (S.pop && !e.target.closest('#pop') && !e.target.closest('[data-act="pop"]')) { S.pop = null; emit('ui'); }
  if (!b || b.disabled) return;
  const d = b.dataset;
  switch (d.act) {
    case 'pop': S.pop = S.pop === d.p ? null : d.p; emit('ui'); break;
    case 'find': UI.openFinder(); break;
    case 'offer-open': S.store.active === 'p1' ? A.openReview(d.def) : A.openLibReview(d.def); break;
    case 'undo': A.doUndo(); break;
    case 'redo': A.doRedo(); break;
    case 'mode': A.setMode(d.m); break;
    case 'frame': A.frameSel(); break;
    case 'view': A.viewPreset(d.v); break;
    case 'motion': A.setMotion(S.motion === 'reduced' ? 'full' : 'reduced'); break;
    case 'keys': S.sheet = { kind: 'keys' }; emit('ui'); break;
    case 'tool':
      if (d.t === 'hang') { if (S.tool === 'hang') A.cancelHang(); else A.startHang(); }
      else { A.cancelHang(true); S.tool = 'select'; emit('ui'); }
      break;
    case 'inspect': A.openInspect(d.uid || undefined); break;
    case 'inspect-close': A.closeInspect(); break;
    case 'preview':
      if (S.instr?.kind === 'preview' && (!d.uid || d.uid === S.instr.use)) A.closePreview();
      else A.openPreview(d.uid || undefined, d.comp || undefined);
      break;
    case 'navsel': A.select(J(d.sel)); break;
    case 'navtoggle': { const k = d.k; if (S.open.has(k)) S.open.delete(k); else S.open.add(k); emit('ui'); break; }
    case 'import': A.openImport(); break;
    case 'intake': A.startIntake(d.src); break;
    case 'intake-commit': A.commitIntake(); break;
    case 'intake-cancel': A.cancelIntake(); break;
    case 'add-plinth': A.addNative('N-PLINTH'); break;
    case 'add-bay': A.addBay(); break;
    case 'uselib': A.openUseFromLibrary(d.def); break;
    case 'uselib-go': A.useFromLibrary(S.sheet.defId, S.sheet.mode); break;
    case 'reach': A.setReachScope(d.s); break;
    case 'val': A.setValue(d.uid, d.key, num(d.v), scopeNow(d.uid)); break;
    case 'nudge': {
      const cur = valueOf(D(), d.uid, d.key).value;
      const f = featureAt(D(), D().uses[d.uid].def, d.key);
      const want = cur + Number(d.d);
      A.setValue(d.uid, d.key, f ? Math.max(f.min, Math.min(f.max, want)) : want, scopeNow(d.uid));
      break;
    }
    case 'revert': A.revertValue(d.uid, d.key); break;
    case 'promote': A.promoteValue(d.uid, d.key); break;
    case 'drop': A.dropOverride(d.uid, d.key); break;
    case 'goto-key': {
      const u = D().uses[d.uid];
      const f = featureAt(D(), u.def, d.key);
      const path = f ? f.path : d.key.split('/').slice(0, 1);
      A.select({ kind: 'use', id: d.uid, path: path.length ? path : [] });
      break;
    }
    case 'bench': A.openBench(d.def); break;
    case 'dup': A.duplicateUse(d.uid); break;
    case 'setdown': A.setDown(d.uid); break;
    case 'remove': A.removeUse(d.uid); break;
    case 'make': A.openMakeReusable(d.ids ? J(d.ids) : undefined); break;
    case 'make-go': A.makeReusable(S.sheet.ids, (S.sheet.name || '').trim() || 'Display light'); break;
    case 'group': A.groupUses(); break;
    case 'ungroup': A.ungroup(d.gid); break;
    case 'wallmove': A.wallMoveStart(d.wid); break;
    case 'wall-commit': A.wallMoveCommit(); break;
    case 'wall-cancel': A.wallMoveCancel(); break;
    case 'removewall': A.openRemoveWall(d.wid); break;
    case 'removewall-go': A.removeWall(S.sheet.wid, S.sheet.choice); break;
    case 'place': A.placeUse(d.def); break;
    case 'share': A.openShare(d.def); break;
    case 'share-go': A.share(S.sheet.defId); break;
    case 'publish': A.publishRevision(d.def); break;
    case 'review-recheck': A.recheckReview(); break;
    case 'review-accept': A.acceptReview(); break;
    case 'review-stay': A.stayOnRevision(); break;
    case 'review-cancel': A.cancelReview(); break;
    case 'review-show': A.reviewShow(d.m); break;
    case 'lib-accept': A.acceptLib(); break;
    case 'lib-stay': A.stayLib(); break;
    case 'lib-fork': A.forkLib(); break;
    case 'lib-cancel': A.cancelLibReview(); break;
    case 'bench-val': A.benchSet(d.key, num(d.v)); break;
    case 'bench-nudge': {
      const I = S.instr;
      const f = iface(D(), I.def).features.find((x) => x.key === d.key);
      const cur = A.benchValue(D(), I.def, d.key, I.draft);
      A.benchSet(d.key, Math.max(f.min, Math.min(f.max, cur + Number(d.d))));
      break;
    }
    case 'bench-discard': A.closeBench(true); break;
    case 'bench-apply': A.benchApply(); break;
    case 'pv-play': A.previewPlay(); if (S.instr) S.instr.t0 = null; emit('ui'); break;
    case 'pv-reset': A.previewReset(); break;
    case 'pv-keep': A.openKeepPose(); break;
    case 'pv-end': A.closePreview(); break;
    case 'keep-go': A.keepPose(S.sheet.scope); break;
    case 'hang-cancel': A.cancelHang(); break;
    case 'hang-commit': A.hangCommit(); break;
    case 'up': A.ascend(); break;
    case 'sheet-close': { const k = S.sheet?.kind; S.sheet = null; if (k === 'removewall') A.note('Nothing removed — the wall and its attachment are unchanged.'); emit('ui'); break; }
    case 'undo-to': A.undoTo(Number(d.n)); break;
    case 'summary-close': S.summary = null; emit('ui'); break;
    case 'project': A.switchProject(d.p); break;
    default: break;
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  const f = t.dataset?.field;
  if (!f) return;
  switch (f) {
    case 'rename': A.renameUse(t.dataset.uid, t.value); break;
    case 'rename-comp': A.renameComp(t.dataset.def, t.dataset.cid, t.value); break;
    case 'rename-def': A.renameDef(t.dataset.def, t.value); break;
    case 'val': {
      const v = parseFloat(t.value);
      if (!Number.isFinite(v)) { A.flash('Type a number.', 'refuse'); t.value = t.defaultValue; break; }
      A.setValue(t.dataset.uid, t.dataset.key, v, scopeNow(t.dataset.uid));
      break;
    }
    case 'place': A.setPlacement(t.dataset.uid, t.dataset.f, parseFloat(t.value)); break;
    case 'wall-off': A.wallMoveSet(parseFloat(t.value)); break;
    case 'hang-wall':
    case 'hang-s':
    case 'hang-h': {
      const wall = document.querySelector('[data-field="hang-wall"]')?.value;
      const s = Number(document.querySelector('[data-field="hang-s"]')?.value);
      const h = Number(document.querySelector('[data-field="hang-h"]')?.value);
      A.setHangCandidate(wall, s, h);
      break;
    }
    case 'intake-place': if (S.instr) { S.instr.place = t.checked; emit('ui'); } break;
    case 'detach': A.reviewDetach(t.dataset.uid, t.checked); break;
    case 'choice': A.reviewChoose(t.dataset.k, t.value); break;
    case 'keep-scope': S.sheet.scope = t.value; emit('ui'); break;
    case 'rw': S.sheet.choice = t.value; emit('ui'); break;
    case 'ul': S.sheet.mode = t.value; emit('ui'); break;
    case 'bench-val': A.benchSet(t.dataset.key, parseFloat(t.value)); break;
    default: break;
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  const f = t.dataset?.field;
  if (f === 'sep') A.setSep(parseFloat(t.value));
  else if (f === 'pv') A.previewSet(parseFloat(t.value));
  else if (f === 'make-name' && S.sheet) S.sheet.name = t.value;
});

// reach previews: hover or focus a value → see its value and reach before committing
const reachOfEl = (el) => J(el.dataset.hreach);
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('[data-hreach]');
  if (!el) return;
  const r = reachOfEl(el);
  if (r) A.previewReach(r.uid, r.key, r.scope, r.value);
});
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest?.('[data-hreach]');
  if (!el || el.contains(e.relatedTarget)) return;
  if (document.activeElement && document.activeElement.closest?.('[data-hreach]') && document.activeElement !== el) {
    const r = reachOfEl(document.activeElement.closest('[data-hreach]'));
    if (r) { A.previewReach(r.uid, r.key, r.scope, r.value); return; }
  }
  A.clearReach();
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('[data-hreach]');
  if (!el || !e.target.matches(':focus-visible')) return;
  const r = reachOfEl(el);
  if (r) A.previewReach(r.uid, r.key, r.scope, r.value);
});
document.addEventListener('focusout', (e) => {
  if (e.target.closest?.('[data-hreach]')) A.clearReach();
});

// ---------------------------------------------------------------- keyboard
function escape() {
  if (!$('finder').hidden) { UI.closeFinder(); return; }
  if (S.sheet) { const k = S.sheet.kind; S.sheet = null; if (k === 'removewall') A.note('Nothing removed — the wall and its attachment are unchanged.'); emit('ui'); return; }
  if (S.pop) { S.pop = null; emit('ui'); return; }
  const I = S.instr;
  if (I) {
    if (I.kind === 'inspect') A.closeInspect();
    else if (I.kind === 'preview') A.closePreview();
    else if (I.kind === 'hang') A.cancelHang();
    else if (I.kind === 'wallmove') A.wallMoveCancel();
    else if (I.kind === 'review') A.cancelReview();
    else if (I.kind === 'libreview') A.cancelLibReview();
    else if (I.kind === 'bench') { if (Object.keys(I.draft).length) A.flash('The draft has changes — Apply or Discard them.', 'warn'); else A.closeBench(); }
    else if (I.kind === 'intake') A.cancelIntake();
    return;
  }
  if (S.summary) { S.summary = null; emit('ui'); return; }
  if (S.mode === 'layout' && !S.sel) { A.setMode('arrange'); return; }
  A.ascend();
}
function descendKey() {
  const s = S.sel;
  const doc = D();
  if (s?.kind === 'group') { const m = doc.groups[s.id].members[0]; S.ctx = { group: s.id }; A.select({ kind: 'use', id: m, path: [] }); S.ctx = { group: s.id }; emit('sel'); return; }
  if (s?.kind !== 'use') return;
  const u = doc.uses[s.id];
  const d = defOf(doc, u.def);
  if (d.kind === 'flat' || d.kind === 'native') { A.flash(d.kind === 'flat' ? `${d.name} arrived flat — it has no parts to enter.` : `${d.name} has no parts.`, 'info'); return; }
  const I = iface(doc, u.def);
  const cur = s.path ?? [];
  const child = I.parts.find((p) => p.path.length === cur.length + 1 && startsWith(p.path, cur));
  if (!child) { A.flash('That is the deepest declared part here.', 'info'); return; }
  S.ctx = { use: s.id, path: cur };
  A.select({ kind: 'use', id: s.id, path: child.path });
}
function siblingKey(dir) {
  // Tab-like stepping among siblings at the current depth (keyboard selection in the Paper)
  const s = S.sel;
  const doc = D();
  if (s?.kind !== 'use') {
    const ids = doc.order.filter((id) => doc.uses[id]);
    if (ids.length) A.select({ kind: 'use', id: ids[0], path: [] });
    return;
  }
  if (!s.path?.length) {
    const ids = doc.order.filter((id) => doc.uses[id]);
    const i = ids.indexOf(s.id);
    A.select({ kind: 'use', id: ids[(i + dir + ids.length) % ids.length], path: [] });
    return;
  }
  const I = iface(doc, doc.uses[s.id].def);
  const pre = s.path.slice(0, -1);
  const sib = I.parts.filter((p) => p.path.length === s.path.length && startsWith(p.path, pre));
  const i = sib.findIndex((p) => p.path.join('/') === s.path.join('/'));
  A.select({ kind: 'use', id: s.id, path: sib[(i + dir + sib.length) % sib.length].path });
}
function arrowKeys(e) {
  e.preventDefault();
  const s = S.sel;
  const doc = D();
  const step = e.shiftKey ? 0.25 : 0.05;
  if (s?.kind === 'use' && !s.path?.length && S.mode === 'arrange' && !S.instr) {
    const u = doc.uses[s.id];
    if (u.attach && !u.attach.broken) {
      const ds = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dh = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
      A.moveAlong(s.id, u.attach.s + ds, u.attach.h + dh);
      return;
    }
    // camera-relative, snapped to the dominant world axis
    const az = stage.cam.az;
    const right = [Math.cos(az), -Math.sin(az)];
    const fwd = [-Math.sin(az), -Math.cos(az)];
    const snap = (v) => (Math.abs(v[0]) > Math.abs(v[1]) ? [Math.sign(v[0]), 0] : [0, Math.sign(v[1])]);
    const dir = e.key === 'ArrowLeft' ? snap(right).map((x) => -x) : e.key === 'ArrowRight' ? snap(right) : e.key === 'ArrowUp' ? snap(fwd) : snap(fwd).map((x) => -x);
    const C = compileLayout(doc.layout);
    const p = poseOf(doc, C, s.id);
    A.moveUse(s.id, [p.x + dir[0] * step, p.y, p.z + dir[1] * step], null, `Nudge ${u.name} ${s.id}`);
    return;
  }
  if (e.key === 'ArrowLeft') stage.orbit(-14, 0);
  else if (e.key === 'ArrowRight') stage.orbit(14, 0);
  else if (e.key === 'ArrowUp') stage.orbit(0, 10);
  else stage.orbit(0, -10);
}
function navKeys(e) {
  const rows = [...document.querySelectorAll('#nav [role=treeitem]')];
  const i = rows.indexOf(document.activeElement);
  if (i < 0) return false;
  const row = rows[i];
  const focus = (r) => { if (!r) return; rows.forEach((x) => { x.tabIndex = -1; }); r.tabIndex = 0; r.focus(); };
  const exp = row.getAttribute('aria-expanded');
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); focus(rows[i + 1]); return true;
    case 'ArrowUp': e.preventDefault(); focus(rows[i - 1]); return true;
    case 'Home': e.preventDefault(); focus(rows[0]); return true;
    case 'End': e.preventDefault(); focus(rows[rows.length - 1]); return true;
    case 'ArrowRight':
      e.preventDefault();
      if (exp === 'false') { S.open.add(row.dataset.row); emit('ui'); } else if (exp === 'true') focus(rows[i + 1]);
      return true;
    case 'ArrowLeft': {
      e.preventDefault();
      if (exp === 'true') { S.open.delete(row.dataset.row); emit('ui'); return true; }
      const lv = +row.getAttribute('aria-level');
      for (let j = i - 1; j >= 0; j--) if (+rows[j].getAttribute('aria-level') < lv) { focus(rows[j]); break; }
      return true;
    }
    case 'Enter':
    case ' ':
      e.preventDefault();
      row.click();
      return true;
    default: return false;
  }
}
function finderKeys(e) {
  const F = S.finder;
  if (!F) return;
  if (e.key === 'Tab') { e.preventDefault(); $('finderInput').focus(); return; }
  if (e.key === 'Escape') { e.preventDefault(); UI.closeFinder(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); F.i = Math.min(F.items.length - 1, F.i + 1); UI.renderFinderList(); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); F.i = Math.max(0, F.i - 1); UI.renderFinderList(); return; }
  if (e.key === 'Enter') { e.preventDefault(); pickFinder(F.items[F.i]); }
}
function pickFinder(x) {
  if (!x) return;
  UI.closeFinder();
  A.select(x.sel);
  A.frameSel();
  if (x.state === 'enclosed') A.flash(`${x.name} is enclosed — press I to inspect and see it.`, 'info');
}
$('finderInput').addEventListener('input', (e) => { S.finder.q = e.target.value; S.finder.i = 0; UI.renderFinderList(); });
$('finderList').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) pickFinder(S.finder.items[+li.dataset.i]); });
$('finder').addEventListener('mousedown', (e) => { if (e.target.id === 'finder') UI.closeFinder(); });

document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (!$('finder').hidden) { finderKeys(e); return; }
  if (e.key === 'Tab' && !$('sheet').hidden) {
    // A sheet is modal: Tab cycles inside it.
    const f = [...$('sheet').querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
    if (f.length) {
      const i = f.indexOf(document.activeElement);
      const n = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      e.preventDefault();
      f[n].focus();
      return;
    }
  }
  const typing = t.matches?.('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, select');
  if (typing) {
    if (e.key === 'Escape') { t.value = t.defaultValue; t.blur(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const f = t.dataset.field;
      t.blur();
      if (f === 'wall-off') A.wallMoveCommit();
      if (f === 'make-name' && S.sheet?.kind === 'make') A.makeReusable(S.sheet.ids, (S.sheet.name || '').trim() || 'Display light');
    }
    return;
  }
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key;
  if (mod && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) A.doRedo(); else A.doUndo(); return; }
  if (mod && k.toLowerCase() === 'y') { e.preventDefault(); A.doRedo(); return; }
  if (mod && k.toLowerCase() === 'd') { e.preventDefault(); if (S.sel?.kind === 'use') A.duplicateUse(S.sel.id); return; }
  if (mod && k.toLowerCase() === 'g') { e.preventDefault(); A.groupUses(); return; }
  if (mod && k.toLowerCase() === 'k') { e.preventDefault(); UI.openFinder(); return; }
  if (mod || e.altKey) return;
  if (k === 'Escape') { e.preventDefault(); escape(); return; }
  if (t.classList?.contains('wall-handle')) {
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (S.instr?.kind !== 'wallmove') A.wallMoveStart('W-FJSK');
      A.wallMoveSet((S.instr?.off ?? 0) + (k === 'ArrowUp' || k === 'ArrowRight' ? 0.05 : -0.05) * (e.shiftKey ? 5 : 1));
      return;
    }
    if (k === 'Enter') { e.preventDefault(); A.wallMoveCommit(); return; }
  }
  if (t.closest?.('#nav') && navKeys(e)) return;
  if (t.closest?.('.sheet') || t.closest?.('#scenario')) return;
  if (k === '/') { e.preventDefault(); UI.openFinder(); }
  else if (k === 'i' || k === 'I') { if (S.instr?.kind === 'inspect') A.closeInspect(); else A.openInspect(); }
  else if (k === 'p' || k === 'P') { if (S.instr?.kind === 'preview') A.closePreview(); else A.openPreview(); }
  else if (k === 'h' || k === 'H') { if (S.tool === 'hang') A.cancelHang(); else A.startHang(); }
  else if (k === 'v' || k === 'V') { A.cancelHang(true); S.tool = 'select'; emit('ui'); }
  else if (k === 'f' || k === 'F') A.frameSel();
  else if (k === 'j' || k === 'J') toggleScenario();
  else if (k === '?') { S.sheet = { kind: 'keys' }; emit('ui'); }
  else if (t === cv && (k === 'Delete' || k === 'Backspace') && S.sel?.kind === 'use' && !S.sel.path?.length) A.removeUse(S.sel.id);
  else if (t === cv && k === 'Enter') { e.preventDefault(); descendKey(); }
  else if (t === cv && (k === '[' || k === ']') && S.sel) { e.preventDefault(); siblingKey(k === '[' ? -1 : 1); }
  else if (t === cv && k.startsWith('Arrow')) arrowKeys(e);
});
window.addEventListener('blur', () => { if (pd) endPointer(null, true); });

// ---------------------------------------------------------------- boot
UI.render('all');
initScenario();
const step = parseInt(q.get('step') || '0', 10);
if (step) gotoStep(step, q.get('done') === '1');
if (q.get('state')) showState(q.get('state'));
if (q.get('scenario') === '0') { $('scenario').hidden = true; $('scToggle').hidden = false; }
requestAnimationFrame(loop);
