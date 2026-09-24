import * as THREE from 'three';
import { S, ctx, W, C, thing } from './state.js';
import { createMuseum, fmt, wallLength, frameAt, modS, openingTopAt, bbox } from './model.js';
import { Stage, ease } from './stage.js';
import { Overlay } from './overlay.js';
import { tickTweens, run, dur } from './anim.js';
import * as A from './actions.js';
import { drawAll } from './draw.js';
import { requestUI, renderUI, updateTilt, updateWhere, updateStripLive, fieldValue, applyField, applySeg, mapInv } from './ui.js';
import { sectionCaps } from './geometry.js';
import { initJourneys, JOURNEYS } from './journeys.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const stageEl = $('#stage');

ctx.museum = createMuseum();
const stage = new Stage(canvas, ctx.museum);
ctx.stage = stage;
ctx.ov = new Overlay($('#ovSvg'), $('#ovHtml'));
ctx.ui = requestUI;

// ---------------------------------------------------------------- frame

const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);
const dirOf = (az, el) => new V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
const angleTo = (c, home) => A.deg(dirOf(c.az, c.el).angleTo(dirOf(home.az, home.el)));
const detent = (home, c) => 1 - A.smooth(2.5, 20, angleTo(c, home));

function frameState() {
  const c = stage.cam;
  const s = S.session;
  const freeFlat = A.smooth(70, 88.5, A.deg(c.el));
  let flat = freeFlat;
  let planF = freeFlat;
  const clips = [];
  let hCap = null;
  if (s) {
    const det = detent(s.home, c);
    flat = A.lerp(freeFlat, det * (s.flatWanted ?? 1), s.settle);
    planF = freeFlat * (1 - s.settle);
    if (s.kind === 'face') clips.push(s.clip);
    if (s.kind === 'section') clips.push(s.planes.keep, s.planes.depthKeep);
    if (s.kind === 'lookup') {
      clips.push(new THREE.Plane(UP.clone(), -s.h));
      if (s.h > 0.03) hCap = s.h;
    }
  }
  stage.capV.visible = s?.kind === 'section';
  const k = S.knife;
  if (k?.p1 && !s) {
    const inPlace = planF < 0.5;
    if (k.dirty || k.inPlace !== inPlace) {
      const cut = A.knifeCut();
      S.knifeCaps = sectionCaps(ctx.museum, cut);
      k.planes = A.cutPlanes(cut);
      stage.setSectionCaps(S.knifeCaps.quads);
      if (inPlace) stage.buildAway('preview', k.planes.nearKeep, { opacity: 0.1, lineOpacity: 0.4 });
      else stage.clearAway('preview');
      k.dirty = false;
      k.inPlace = inPlace;
    }
    if (inPlace) { clips.push(k.planes.keep, k.planes.depthKeep); stage.capV.visible = true; }
  }
  if (planF > 0.01) {
    const h = A.lerp(9.5, 1.2, ease(planF));
    clips.push(new THREE.Plane(DOWN.clone(), h));
    hCap = h;
  }
  c.flat = flat;
  stage.paper = flat;
  // clipped and set-aside geometry would cast shadows that no longer match what is drawn
  stage.shadowsOff = planF > 0.02 || (s && s.kind !== 'lift') || !!(k?.p1);
  stage.setClips(clips);
  if (stage.capsDirty) { stage.capHAt = null; stage.capsDirty = false; }
  stage.setHorizontalCaps(hCap);
  stage.capH.visible = hCap != null;
}

function peekInset() {
  const box = $('#peek');
  const k = S.knife;
  if (!k?.p1 || S.session || !k.planes) { box.hidden = true; return null; }
  box.hidden = false;
  const r = box.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  const rect = { x: r.left - cr.left + 1, y: r.top - cr.top + 24, w: r.width - 2, h: r.height - 25 };
  const cut = A.knifeCut();
  const home = A.sectionHome(cut);
  const aMain = stage.w / stage.h, aIn = rect.w / rect.h;
  const cam = { ...home, target: home.target.clone(), frameH: Math.max(9.2, (home.frameH * aMain) / aIn), flat: 1, mirror: false };
  $('#peekLabel').textContent = `What this cut shows · ${A.lookWord(cut)} · depth ${fmt(cut.depth)} m`;
  return {
    cam, rect,
    prep: () => {
      const prev = stage.clips;
      const hv = stage.capH.visible, vv = stage.capV.visible, pp = stage.paper;
      stage.setClips([k.planes.keep, k.planes.depthKeep]);
      stage.capH.visible = false;
      stage.capV.visible = true;
      stage.paper = 1;
      stage.applyPaper();
      return () => { stage.setClips(prev); stage.capH.visible = hv; stage.capV.visible = vv; stage.paper = pp; stage.applyPaper(); };
    },
  };
}

// "To scale" is a property of the picture, per screen axis — distinct from the numbers, which are
// always measured on the model. A round wall seen square is to scale in height only, so it gets a
// vertical scale bar and no horizontal one.
function truthBar() {
  const on = stage.cam.flat > 0.97 && !(S.session?.kind === 'lift');
  stageEl.classList.toggle('true-measure', on);
  if (!on) return;
  const s = S.session;
  const curved = s?.kind === 'face' && s.wall.kind === 'arc' && s.u < 0.985;
  stageEl.classList.toggle('scale-h-off', curved);
  const ppm = stage.h / stage.cam.frameH;
  const nice = [0.5, 1, 2, 5, 10].find((m) => m * ppm > 70) || 10;
  const px = `${(nice * ppm).toFixed(0)}px`;
  $('#scaleBar').style.width = px;
  $('#scaleVBar').style.height = px;
  $('#scaleK').textContent = `${nice} m`;
  $('#scaleVK').textContent = `${nice} m`;
  const what = !s ? 'Plan · to scale · cut at 1.20' : s.kind === 'face' ? (curved ? 'Heights to scale · the curve foreshortens widths' : 'Elevation · to scale') : s.kind === 'section' ? 'Section · to scale' : 'Looking up · to scale';
  $('#truthK').textContent = what;
}

let lastRestyle = 0;
let lastErr = '';
function frame(now) {
  requestAnimationFrame(frame);
  try {
    tickTweens(now);
    frameState();
    if (now - lastRestyle > 90) { stage.restyle(); lastRestyle = now; }
    const inset = peekInset();
    stage.render(inset);
    drawAll();
    updateTilt();
    updateWhere();
    updateStripLive();
    truthBar();
    if (S.status && now - S.status.t > 6000 && !S.status.cleared) { S.status.cleared = true; requestUI(); }
  } catch (e) {
    if (e.message !== lastErr) { lastErr = e.message; console.error(e); }
  }
}

// ---------------------------------------------------------------- pointer

const cr = () => canvas.getBoundingClientRect();
const groundAt = (e) => stage.rayPlane(e.clientX, e.clientY, new THREE.Plane(UP.clone(), 0));

function sOnWall(w, x, z) {
  if (w.kind === 'line') {
    const f = frameAt(w, 0);
    return (x - w.a[0]) * f.tx + (z - w.a[1]) * f.tz;
  }
  return modS(w, (Math.atan2(z - w.cz, x - w.cx) - w.a0) * w.r);
}

function resolveHit(hit) {
  if (!hit) return null;
  const { id, kind } = hit.object.userData;
  if (kind === 'wall' || (kind === 'cap' && W(id))) {
    const w = W(id);
    if (!w) return id;
    const ds = stage.d(id);
    if (ds.u > 0.01) return id;
    const s = sOnWall(w, hit.point.x, hit.point.z);
    for (const o of w.openings) {
      const d = Math.abs(((s - o.s + wallLength(w) / 2) % wallLength(w) + wallLength(w)) % wallLength(w) - wallLength(w) / 2);
      if (d < o.w / 2 + 0.25 && hit.point.y > o.sill - 0.25 && hit.point.y < openingTopAt(o, s) + 0.35) return o.id;
    }
    return id;
  }
  if (kind === 'floor' || (kind === 'cap' && !thing(id))) return null;
  return id;
}

let drag = null;
let hoverQueued = false;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  S.popover = null;
  if (S.knife && e.button === 0 && !e.altKey) {
    const g = groundAt(e);
    if (!g) return;
    S.knife.p0 = [g.x, g.z];
    S.knife.p1 = null;
    S.knife.stage = 'draw';
    drag = { kind: 'knife', x: e.clientX, y: e.clientY };
    return;
  }
  const flatView = stage.cam.flat > 0.85 && !(S.session?.kind === 'lift');
  let mode = 'orbit';
  if (e.button === 2 || e.altKey) mode = flatView ? 'orbit' : 'pan';
  else if (e.shiftKey && !flatView) mode = 'pan';
  else if (flatView) mode = 'pan';
  drag = { kind: 'cam', mode, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false };
});

canvas.addEventListener('pointermove', (e) => {
  S.pointer = { x: e.clientX - cr().left, y: e.clientY - cr().top };
  if (drag?.kind === 'knife') {
    const g = groundAt(e);
    if (!g) return;
    const k = S.knife;
    const first = !k.p1;
    k.p1 = [g.x, g.z];
    if (first || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 30) k.side = A.defaultSide(k.p0, k.p1);
    k.dirty = true;
    requestUI();
    return;
  }
  if (drag?.kind === 'cam') {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4) drag.moved = true;
    if (!drag.moved || S.busy) return;
    const c = stage.cam;
    if (drag.mode === 'orbit') {
      c.az -= dx * 0.006;
      const lo = S.session?.kind === 'lookup' ? -Math.PI / 2 + 1e-4 : S.session ? -0.2 : 0.06;
      c.el = Math.max(lo, Math.min(Math.PI / 2, c.el + dy * 0.005));
    } else {
      const wpp = stage.worldPerPx();
      const m = stage.camera.matrixWorld.elements;
      const right = new V3(m[0], m[1], m[2]), up = new V3(m[4], m[5], m[6]);
      c.target.addScaledVector(right, -dx * wpp * (stage.cam.mirror ? -1 : 1)).addScaledVector(up, dy * wpp);
    }
    return;
  }
  if (!hoverQueued) {
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (drag || S.knife) return;
      A.setHover(resolveHit(stage.pick(e.clientX, e.clientY)));
      canvas.style.cursor = S.hover ? 'pointer' : '';
    });
  }
});

canvas.addEventListener('pointerup', (e) => {
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.kind === 'knife') {
    const k = S.knife;
    if (!k.p1 || Math.hypot(k.p1[0] - k.p0[0], k.p1[1] - k.p0[1]) < 1) {
      k.p0 = k.p1 = null;
      A.setStatus('Drag a longer line through the museum', 'info');
    } else k.stage = 'aim';
    requestUI();
    return;
  }
  if (!d.moved) {
    const id = resolveHit(stage.pick(e.clientX, e.clientY));
    A.select(thing(id) ? id : null);
    return;
  }
  if (d.mode === 'orbit') settleAfterOrbit();
  requestUI();
});

canvas.addEventListener('dblclick', (e) => {
  const id = resolveHit(stage.pick(e.clientX, e.clientY));
  const t = thing(id);
  if (!t) return;
  A.select(id);
  if (t.kind === 'ceilings') A.lift(id);
  else A.face(id);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (S.busy) return;
  const c = stage.cam;
  const f = Math.exp(e.deltaY * 0.0012);
  const dir = new V3();
  stage.camera.getWorldDirection(dir);
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(dir.clone().negate(), c.target);
  const p = stage.rayPlane(e.clientX, e.clientY, pl);
  c.frameH = Math.max(2.5, Math.min(120, c.frameH * f));
  if (p) c.target.lerp(p, 1 - f);
  clearTimeout(wheelT);
  wheelT = setTimeout(requestUI, 160);
}, { passive: false });
let wheelT = 0;

function settleAfterOrbit() {
  const s = S.session, c = stage.cam;
  if (s) {
    if (angleTo(c, s.home) < 14) run(() => A.fly({ ...stage.camState(), az: s.home.az, el: s.home.el }, dur('settle', 420)));
    return;
  }
  const el = A.deg(c.el);
  if (el > 79 && el < 89.99) run(async () => { await A.fly({ ...stage.camState(), el: Math.PI / 2, az: Math.round(c.az / (Math.PI / 2)) * (Math.PI / 2) }, dur('settle', 420)); A.pushTrail('Plan'); });
  else if (el <= 79) { S.last3D = stage.camState(); if (S.trail[S.trailPos]?.kind === 'plan') A.pushTrail('3D'); }
}

// ---------------------------------------------------------------- handles on the drawing

let hdrag = null;
let direct = null;
ctx.ov.html.addEventListener('pointerdown', (e) => {
  // D's direct openings: pull the dog-ear to unroll, lift the tab to raise the lid — from where you stand
  const peel = e.target.closest('[data-peel]');
  const lid = e.target.closest('[data-lid]');
  if ((peel || lid) && e.button === 0) {
    e.preventDefault();
    e.stopPropagation();
    const sess = peel ? A.beginPeel(peel.dataset.peel, +peel.dataset.s) : A.beginLid(lid.dataset.lid);
    if (!sess) return;
    direct = { kind: peel ? 'peel' : 'lid', x0: e.clientX, y0: e.clientY, moved: false };
    document.body.classList.add('dragging');
    return;
  }
  const h = e.target.closest('[data-h]');
  if (!h) return;
  const spec = ctx.ov.specs.get(h.dataset.h);
  if (!spec) return;
  e.preventDefault();
  e.stopPropagation();
  h.setPointerCapture(e.pointerId);
  const dir = new V3();
  stage.camera.getWorldDirection(dir);
  const world = new V3(...spec.world);
  // vertical drags happen in the wall's own face plane at the handle, so heights stay exact in
  // perspective; fall back to a screen-parallel plane when the face is nearly edge-on
  let normal = dir.clone().negate();
  if (spec.normal) {
    const n = new V3(spec.normal[0], 0, spec.normal[1]);
    if (Math.abs(n.dot(dir)) > 0.25) normal = n;
  }
  if (spec.view) {
    const g = groundAt(e);
    hdrag = { spec, el: h, g0: g, k0: { p0: [...S.knife.p0], p1: [...S.knife.p1] } };
    document.body.classList.add('dragging');
    return;
  }
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world);
  const start = stage.rayPlane(e.clientX, e.clientY, plane) || world;
  hdrag = { spec, plane, start, base: baseValues(spec), el: h };
  document.body.classList.add('dragging');
  A.beginEdit();
});

window.addEventListener('pointermove', (e) => {
  if (!direct) return;
  const dx = e.clientX - direct.x0, dy = e.clientY - direct.y0;
  if (Math.hypot(dx, dy) > 3) direct.moved = true;
  if (direct.kind === 'peel') A.peelTo(Math.hypot(dx, dy) / 260);
  else A.lidTo(-dy / 170);
});
window.addEventListener('pointerup', () => {
  if (!direct) return;
  const d = direct;
  direct = null;
  document.body.classList.remove('dragging');
  if (!d.moved) {
    // a click is D's one-press open: the whole motion, in one beat
    const id = S.session?.kind === 'lift' ? S.session.ceilId : null;
    if (d.kind === 'peel') { A.endPeel(); A.unfold(); }
    else { A.endLid(); A.lift(id); }
    return;
  }
  if (d.kind === 'peel') A.endPeel();
  else A.endLid();
});

// Along-wall drags: the nearest point on the displayed wall (curved, part-unrolled or flat) to the
// pointer, found in screen space. Because the unroll is isometric, the arc length it moved is the
// true distance along the real wall.
function sAlongPointer(spec, e) {
  const w = W(spec.wall);
  const Sm = stage.sampler(w.id);
  const y = spec.world[1];
  const off = spec.off ?? w.thick / 2;
  const px = e.clientX - cr().left, py = e.clientY - cr().top;
  const dist = (s) => { const q = stage.project(Sm.point(Sm.frameS(s), off, y)); return (q.x - px) ** 2 + (q.y - py) ** 2; };
  let best = spec.s0, bd = dist(best);
  for (let s = spec.s0 - 8; s <= spec.s0 + 8; s += 0.05) { const d = dist(s); if (d < bd) { bd = d; best = s; } }
  for (let s = best - 0.05; s <= best + 0.05; s += 0.005) { const d = dist(s); if (d < bd) { bd = d; best = s; } }
  return best;
}

function baseValues(spec) {
  if (spec.type.startsWith('op')) return { ...thing(spec.id).item };
  if (spec.type === 'top' || spec.type === 'ridge') return { ...W(spec.wall).top };
  if (spec.type === 'ceil-h') return { ...C(spec.id).plane };
  return {};
}

window.addEventListener('pointermove', (e) => {
  if (!hdrag) return;
  if (hdrag.spec.view) { dragKnifeGrip(e); return; }
  const { spec, plane, start, base: b } = hdrag;
  const P = stage.rayPlane(e.clientX, e.clientY, plane);
  if (!P) return;
  const dy = P.y - start.y;
  const dt = spec.s0 != null ? sAlongPointer(spec, e) - spec.s0 : 0;
  const q = e.altKey ? 0.01 : 0.05;
  const sn = (v) => Math.round(v / q) * q;
  let err = null;
  let label = '';
  const name = spec.id ? thing(spec.id).item.name : W(spec.wall).name;
  switch (spec.type) {
    case 'op-head': err = A.applyOpening(spec.id, { head: sn(b.head + dy) }); label = `${name} head`; break;
    case 'op-sill': err = A.applyOpening(spec.id, { sill: sn(b.sill + dy) }); label = `${name} sill`; break;
    case 'op-rise': err = A.applyOpening(spec.id, { rise: sn(b.rise - dy) }); label = `${name} arch rise`; break;
    case 'op-jamb': {
      const w = sn(b.w + spec.side * dt);
      err = A.applyOpening(spec.id, { w, s: b.s + (spec.side * (w - b.w)) / 2 });
      label = `${name} width`;
      break;
    }
    case 'op-move': err = A.applyOpening(spec.id, { s: b.s + sn(dt) }); label = `${name} position`; break;
    case 'top': {
      const top = { ...b };
      top[spec.key] = sn(b[spec.key] + dy);
      if (W(spec.wall).closed && spec.key === 'h0') top.h1 = top.h0;
      err = A.applyWallTop(spec.wall, top);
      label = `${name} ${spec.key === 'h' ? 'height' : 'end height'}`;
      break;
    }
    case 'ridge': {
      const w = W(spec.wall);
      const top = { ...b, rh: sn(b.rh + dy) };
      top.rs = w.closed ? modS(w, b.rs + sn(dt)) : b.rs + sn(dt);
      err = A.applyWallTop(spec.wall, top);
      label = `${name} ridge`;
      break;
    }
    case 'ceil-h': err = A.applyCeiling(spec.id, { plane: { ...b, base: sn(b.base + dy) } }); label = `${C(spec.id).name} height`; break;
  }
  hdrag.label = label;
  S.refusal = err ? { msg: err, at: { x: e.clientX - cr().left, y: e.clientY - cr().top } } : null;
  hdrag.el.classList.toggle('refused', !!err);
  requestUI();
});

// The drawn line's grips are view state: sliding or turning it re-previews the cut and writes nothing.
function dragKnifeGrip(e) {
  const k = S.knife;
  const g = groundAt(e);
  if (!k || !g || !hdrag.g0) return;
  const { spec, k0 } = hdrag;
  if (spec.type === 'knife-slide') {
    const cut = A.knifeCut();
    const d = (g.x - hdrag.g0.x) * cut.n[0] + (g.z - hdrag.g0.z) * cut.n[1];
    k.p0 = [k0.p0[0] + cut.n[0] * d, k0.p0[1] + cut.n[1] * d];
    k.p1 = [k0.p1[0] + cut.n[0] * d, k0.p1[1] + cut.n[1] * d];
  } else if (spec.end === 0) k.p0 = [g.x, g.z];
  else k.p1 = [g.x, g.z];
  k.dirty = true;
  requestUI();
}

window.addEventListener('pointerup', () => {
  if (!hdrag) return;
  hdrag.el.classList.remove('refused');
  document.body.classList.remove('dragging');
  if (hdrag.spec.view) { hdrag = null; A.setStatus('Line moved — the preview follows; nothing opens until you say so', 'view'); return; }
  if (S.refusal) {
    A.cancelEdit();
    A.setStatus(`Refused — ${S.refusal.msg}. Nothing changed.`, 'refuse');
    S.refusal = null;
  } else A.commitEdit(hdrag.label);
  hdrag = null;
  requestUI();
});

// ---------------------------------------------------------------- typed values

const typein = $('#typein');
const typeinInput = $('#typeinInput');
let typeSpec = null;

function openTypein(el, spec) {
  const r = el.getBoundingClientRect(), s = stageEl.getBoundingClientRect();
  typein.style.left = `${r.left + r.width / 2 - s.left}px`;
  typein.style.top = `${r.top + r.height / 2 - s.top}px`;
  typein.hidden = false;
  typein.classList.remove('bad');
  $('#typeinErr').textContent = '';
  typeSpec = spec;
  typeinInput.value = fmt(fieldValue(spec));
  typeinInput.focus();
  typeinInput.select();
}

function closeTypein() { typein.hidden = true; typeSpec = null; }

typeinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.stopPropagation(); closeTypein(); return; }
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const err = applyField(typeSpec, parseFloat(typeinInput.value));
    if (err) { typein.classList.add('bad'); $('#typeinErr').textContent = err; return; }
    const spec = typeSpec;
    closeTypein();
    if (e.key === 'Tab') {
      const all = [...document.querySelectorAll('#ovHtml [data-edit]')];
      const i = all.findIndex((x) => x.dataset.edit === JSON.stringify(spec));
      const next = all[(i + (e.shiftKey ? all.length - 1 : 1)) % all.length];
      if (next) requestAnimationFrame(() => openTypein(next, JSON.parse(next.dataset.edit)));
    }
  }
});
typeinInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== typeinInput) closeTypein(); }, 120));

// Inspector fields: the same edit path as handles and tapes
document.addEventListener('keydown', (e) => {
  const f = e.target.closest?.('[data-field]');
  if (!f) return;
  if (e.key === 'Enter') { e.preventDefault(); commitField(f); }
  if (e.key === 'Escape') { e.stopPropagation(); S.fieldErr = null; f.value = fmt(fieldValue(JSON.parse(f.dataset.field))); f.blur(); }
}, true);
document.addEventListener('change', (e) => {
  const f = e.target.closest?.('[data-field]');
  if (f) commitField(f);
  if (e.target.dataset?.scrub === 'unroll') {
    A.setStatus('Curvature is a view setting — lengths along the wall never change, and Undo is untouched', 'view');
    A.pushTrail();
    e.target.blur();
  }
});
function commitField(f) {
  const spec = JSON.parse(f.dataset.field);
  if (spec.type === 'ro') return;
  const v = parseFloat(f.value);
  if (Math.abs(v - fieldValue(spec)) < 1e-6) return;
  const err = applyField(spec, v);
  S.fieldErr = err ? { key: f.dataset.field, msg: err } : null;
  requestUI();
}
document.addEventListener('input', (e) => {
  if (e.target.dataset?.scrub === 'unroll') A.scrubUnroll(parseFloat(e.target.value));
});

// ---------------------------------------------------------------- clicks

document.addEventListener('click', (e) => {
  const t = e.target;
  const edit = t.closest('[data-edit]');
  if (edit && !t.closest('[data-h]')) { openTypein(edit, JSON.parse(edit.dataset.edit)); return; }
  const gap = t.closest('[data-gap]');
  if (gap) {
    const s = S.session;
    const r = gap.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    S.popover = { wall: gap.dataset.gap, ceil: s.ceilId, anchor: { x: r.left + r.width / 2 - sr.left, y: r.bottom - sr.top } };
    A.select(gap.dataset.gap);
    S.popover = { wall: gap.dataset.gap, ceil: s.ceilId, anchor: { x: r.left + r.width / 2 - sr.left, y: r.bottom - sr.top - 18 } };
    requestUI();
    return;
  }
  const opt = t.closest('[data-opt]');
  if (opt) {
    const p = S.popover;
    A.commitOption(p.opts[+opt.dataset.opt]);
    return;
  }
  const seg = t.closest('[data-seg]');
  if (seg) { applySeg(JSON.parse(seg.dataset.seg)); requestUI(); return; }
  const stop = t.closest('[data-unroll]');
  if (stop) { A.unrollTo(+stop.dataset.unroll); return; }
  const trail = t.closest('[data-trail]');
  if (trail) { A.gotoTrail(+trail.dataset.trail); return; }
  const mo = t.closest('[data-motion]');
  if (mo) { S.motion = mo.dataset.motion; A.setStatus(motionText(), 'view'); return; }
  const tool = t.closest('[data-tool]');
  if (tool) { pickTool(tool.dataset.tool); return; }
  const act = t.closest('[data-act]');
  if (act) { doAct(act.dataset.act, act); return; }
  const sel = t.closest('[data-sel]');
  if (sel) { A.select(sel.dataset.sel); return; }
});

document.addEventListener('mouseover', (e) => {
  const opt = e.target.closest?.('[data-opt]');
  if (opt && S.popover?.opts) { const o = S.popover.opts[+opt.dataset.opt]; if (o && S.previewing !== o.id) { S.previewing = o.id; A.previewOption(o); } }
  const sel = e.target.closest?.('#ovSvg [data-sel], #ovHtml [data-sel]');
  if (sel) A.setHover(sel.dataset.sel);
});
document.addEventListener('mouseout', (e) => {
  const opt = e.target.closest?.('[data-opt]');
  if (opt && !e.relatedTarget?.closest?.('[data-opt]')) { S.previewing = null; A.unpreview(); }
});

function motionText() {
  return {
    adaptive: 'Motion adapts — the first times you see a move it plays slowly, then gets brisk',
    teach: 'Motion always plays at teaching speed',
    brisk: 'Motion is brisk',
    instant: 'Motion is instant — every change of view jumps',
  }[S.motion];
}

function pickTool(tool) {
  if (tool === 'select') { if (S.knife) A.cancelKnife(true); S.tool = 'select'; requestUI(); return; }
  if (tool === 'knife') { A.startKnife(); return; }
  A.setStatus('Drawing walls, openings and ceiling footprints works as it does today in Plan — outside this prototype', 'info');
}

function doAct(a, el) {
  const s = S.session;
  switch (a) {
    case 'close': A.closeSession(); break;
    case 'face': A.face(S.sel); break;
    case 'unfold': A.unfold(); break;
    case 'fold': A.fold(); break;
    case 'square': A.squareUp(); break;
    case 'stepback': A.stepBack(); break;
    case 'lift': A.lift(S.sel); break;
    case 'lift-rel': A.lift(el.dataset.id); break;
    case 'lookup': A.lookUp(s?.ceilId || (thing(S.sel)?.kind === 'ceilings' ? S.sel : null)); break;
    case 'mirror': A.toggleMirror(); requestUI(); break;
    case 'knife': A.startKnife(); break;
    case 'knife-open': A.commitKnife(); break;
    case 'knife-flip': A.flipKnife(); break;
    case 'knife-cancel': A.cancelKnife(); break;
    case 'depth-': A.setDepth((s?.cut.depth ?? S.knife?.depth ?? 6) - 0.5); break;
    case 'depth+': A.setDepth((s?.cut.depth ?? S.knife?.depth ?? 6) + 0.5); break;
    case 'reveal': A.toggleReveal(S.sel); requestUI(); break;
    case 'plan': A.goPlan(); break;
    case '3d': A.go3D(); break;
    case 'reopen-cut': if (S.recentCut) A.openSection(S.recentCut); break;
    case 'undo': A.undo(); break;
    case 'redo': A.redo(); break;
    case 'help': $('#help').hidden = !$('#help').hidden; break;
    case 'home': A.resetView(); break;
    case 'close-all': A.closeAll(); break;
    case 'crumb': A.backTo(+el.dataset.depth); break;
    case 'side-in': A.setSide(1); break;
    case 'side-out': A.setSide(-1); break;
    case 'include': A.includeIt(S.sel); break;
    case 'gohost': A.goToHost(S.sel); break;
    case 'lookat': A.lookAt(S.sel); break;
    case 'faceit': A.face(S.sel); break;
    case 'find': openFinder(); break;
    case 'summary-undo': A.undoSummary(); break;
    case 'summary-keep': S.summary = null; requestUI(); break;
    case 'beacon-off': S.beacon = null; requestUI(); break;
  }
}

// ---------------------------------------------------------------- find anything
// D's finder, answering through the same resolver as the Inspector: every result carries its
// membership and why it may not be visible from here.

const finder = $('#finder'), finderInput = $('#finderInput');
function openFinder(q = '') {
  finder.hidden = false;
  finderInput.value = q;
  renderFinder();
  finderInput.focus();
}
function closeFinder() { finder.hidden = true; }
function finderItems() {
  const m = ctx.museum;
  const g = (id) => m.galleries.find((x) => x.id === id)?.name || '';
  const out = [];
  for (const w of m.walls) {
    out.push({ id: w.id, n: w.name, k: w.kind === 'arc' ? 'Curved wall' : 'Wall', g: g(w.gallery), ref: w.ref });
    for (const o of w.openings) out.push({ id: o.id, n: o.name, k: o.kind === 'door' ? 'Door' : 'Window', g: `in ${w.name}`, ref: o.ref });
  }
  for (const c of m.ceilings) out.push({ id: c.id, n: c.name, k: 'Ceiling region', g: g(c.gallery), ref: c.ref });
  for (const a of m.art) out.push({ id: a.id, n: a.name, k: 'Artwork · Scene', g: a.by, ref: '' });
  for (const o of m.objects) out.push({ id: o.id, n: o.name, k: 'Object · Scene', g: o.by, ref: '' });
  return out;
}
const WHERE_TAG = { visible: 'in view', off: 'out of frame', behind: 'hidden behind', beyond: 'beyond depth', away: 'opened away', aside: 'set aside', cut: 'cut', flat: 'laid flat', opened: 'unrolled', facing: 'facing', lifted: 'lifted' };
function renderFinder() {
  const q = finderInput.value.trim().toLowerCase();
  const items = finderItems().filter((i) => !q || `${i.n} ${i.k} ${i.g} ${i.ref}`.toLowerCase().includes(q)).slice(0, 9);
  $('#finderList').innerHTML = items.map((i, k) => {
    const r = A.whereIs(i.id);
    const tag = WHERE_TAG[r.state] || '';
    return `<li class="${k ? '' : 'on'}" data-find="${i.id}"><span class="fn">${i.n}</span><span class="fk">${i.k}${i.ref ? ' · ' + i.ref : ''} · ${i.g}</span>${tag ? `<span class="state ${r.state === 'visible' || r.state === 'cut' ? 'ok' : 'away'}">${tag}</span>` : ''}</li>`;
  }).join('') || '<li class="empty">Nothing by that name in this museum</li>';
}
function pickFinder(id) {
  closeFinder();
  A.select(id);
  S.beacon = id;
  const r = A.whereIs(id);
  A.setStatus(r.state === 'visible' ? `${thing(id).item.name} is in view — the beacon marks it` : `${thing(id).item.name}: ${r.reason}. The Inspector says what you can do`, 'view');
}
finderInput.addEventListener('input', renderFinder);
finderInput.addEventListener('keydown', (e) => {
  const lis = [...document.querySelectorAll('#finderList li[data-find]')];
  const i = lis.findIndex((l) => l.classList.contains('on'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const j = (i + (e.key === 'ArrowDown' ? 1 : lis.length - 1)) % lis.length;
    lis.forEach((l, k) => l.classList.toggle('on', k === j));
  }
  if (e.key === 'Enter' && lis[Math.max(0, i)]) pickFinder(lis[Math.max(0, i)].dataset.find);
  if (e.key === 'Escape') { e.stopPropagation(); closeFinder(); }
});
$('#finderList').addEventListener('click', (e) => { const li = e.target.closest('[data-find]'); if (li) pickFinder(li.dataset.find); });
finder.addEventListener('pointerdown', (e) => { if (e.target === finder) closeFinder(); });

// slide an open cut along its normal by dragging its line on the locator — the one place its axis reads
document.addEventListener('pointerdown', (e) => {
  const line = e.target.closest?.('[data-cut-line]');
  if (!line || S.session?.kind !== 'section') return;
  e.preventDefault();
  e.stopPropagation();
  const svg = $('#whereSvg');
  const at = (ev) => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return mapInv(((ev.clientX - r.left) / r.width) * vb.width, ((ev.clientY - r.top) / r.height) * vb.height);
  };
  const off = (ev) => { const c = S.session.cut, [x, z] = at(ev); return (x - c.p[0]) * c.n[0] + (z - c.p[1]) * c.n[1]; };
  const grab = off(e);
  const move = (ev) => { const d = off(ev) - grab; if (Math.abs(d) > 0.02) A.slideCut(d); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); A.pushTrail(); A.setStatus('Cut moved — the section re-derived from the model; a view change, not in Undo', 'view'); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}, true);

// drag the depth number sideways, or the far edge of the band on the map
document.addEventListener('pointerdown', (e) => {
  const dn = e.target.closest?.('[data-drag="depth"]');
  const edge = e.target.closest?.('[data-depth-edge]');
  if (!dn && !edge) return;
  e.preventDefault();
  const cut0 = S.session?.kind === 'section' ? S.session.cut : A.knifeCut();
  if (!cut0) return;
  const d0 = cut0.depth, x0 = e.clientX;
  const svg = $('#whereSvg');
  const move = (ev) => {
    if (dn) { A.setDepth(d0 + (ev.clientX - x0) * 0.04); return; }
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const [x, z] = mapInv(((ev.clientX - r.left) / r.width) * vb.width, ((ev.clientY - r.top) / r.height) * vb.height);
    const cut = S.session?.kind === 'section' ? S.session.cut : A.knifeCut();
    A.setDepth((x - cut.p[0]) * cut.n[0] + (z - cut.p[1]) * cut.n[1]);
  };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); A.setStatus(`Depth ${fmt((S.session?.cut ?? A.knifeCut()).depth)} m — a view change, not an edit`, 'view'); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}, true);

// the bead between Plan and 3D: one camera, tilted by hand
$('#tilt').addEventListener('pointerdown', (e) => {
  if (S.session || S.busy) return;
  const track = $('#tiltTrack').getBoundingClientRect();
  const setFrom = (x) => {
    const t = 1 - Math.max(0, Math.min(1, (x - track.left) / track.width));
    stage.cam.el = A.rad(20 + 70 * t);
  };
  setFrom(e.clientX);
  const move = (ev) => setFrom(ev.clientX);
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); settleAfterOrbit(); requestUI(); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') S.shift = true;
  if (e.target.matches?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo(); return; }
  if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); openFinder(); return; }
  if (e.metaKey || e.ctrlKey) return;
  switch (k) {
    case 'escape':
      if (S.popover) { A.unpreview(); S.popover = null; requestUI(); }
      else if (!$('#help').hidden) $('#help').hidden = true;
      else if (S.beacon) { S.beacon = null; requestUI(); }
      else if (S.knife) A.cancelKnife();
      else if (S.session) (e.shiftKey ? A.closeAll() : A.closeSession());
      else A.select(null);
      break;
    case '/': e.preventDefault(); openFinder(); break;
    case 's': if (S.session?.kind === 'face') A.squareUp(); break;
    case '1': A.goPlan(); break;
    case '2': A.go3D(); break;
    case 'f': A.face(S.sel); break;
    case 'o': openSelected(); break;
    case 'u': A.lookUp(S.session?.ceilId || (thing(S.sel)?.kind === 'ceilings' ? S.sel : null)); break;
    case 'k': A.startKnife(); break;
    case 'm': A.toggleMirror(); requestUI(); break;
    case 'enter': if (S.knife) A.commitKnife(); break;
    case 'tab': if (S.knife) { e.preventDefault(); A.flipKnife(); } break;
    case '[': A.trailStep(-1); break;
    case ']': A.trailStep(1); break;
    case '?': case 'h': $('#help').hidden = !$('#help').hidden; break;
    case 'j': $('#journeys').classList.toggle('open'); break;
  }
});
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') S.shift = false; });
window.addEventListener('blur', () => { S.shift = false; });

function openSelected() {
  const t = thing(S.sel);
  if (!t) { A.startKnife(); return; }
  if (t.kind === 'ceilings') { A.lift(S.sel); return; }
  const w = t.kind === 'walls' ? t.item : t.kind === 'openings' ? t.wall : t.kind === 'art' ? W(t.item.wall) : null;
  if (!w) return;
  if (w.kind === 'arc') A.unfold();
  else A.face(S.sel);
}

// ---------------------------------------------------------------- boot

function resize() { stage.resize(); }
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(stageEl);

function boot() {
  resize();
  const c = A.home3D();
  Object.assign(stage.cam, { target: c.target, az: c.az, el: c.el, frameH: c.frameH, flat: 0 });
  S.last3D = stage.camState();
  A.pushTrail('3D');
  renderUI();
  initJourneys();
  const q = new URLSearchParams(location.search);
  if (q.get('motion')) S.motion = q.get('motion');
  if (q.get('shot')) document.body.classList.add('shot');
  requestAnimationFrame(frame);
  window.__me = { S, ctx, A, JOURNEYS };
}
boot();
