import * as THREE from 'three';
import { S, ctx, W, C, thing, clone, recordFault, labelOf } from './state.js';
import { createMuseum, fmt, wallLength, frameAt, modS, openingTopAt, bbox } from './model.js';
import { Stage, ease } from './stage.js';
import { Overlay } from './overlay.js';
import { tickTweens, run, dur } from './anim.js';
import * as A from './actions.js';
import * as nav from './navigation.js';
import * as T from './tasks.js';
import * as E from './experience.js';
import { onCancel, cancelProposal } from './cancel.js';
import { drawAll } from './draw.js';
import { requestUI, renderUI, updateTilt, updateWhere, updateStripLive, fieldValue, applyField, applySeg, mapInv, renderBrowse, browseShown, recordOf, placeNameOf } from './ui.js';
import { sectionCaps } from './geometry.js';
import { initJourneys, JOURNEYS } from './journeys.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);
const canvas = $('#gl');
const stageEl = $('#stage');

ctx.museum = createMuseum();
E.initExperience();
const stage = new Stage(canvas, ctx.museum);
ctx.stage = stage;
ctx.ov = new Overlay($('#ovSvg'), $('#ovHtml'));
ctx.ui = requestUI;

// ---------------------------------------------------------------- frame

const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);
const dirOf = (az, el) => new V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
const angleTo = (c, home) => A.deg(dirOf(c.az, c.el).angleTo(dirOf(home.az, home.el)));
// How far off the session's square home the view may wander before the paper is withdrawn. The
// band was 2.5° - 20°, which is inside the range of an ordinary pan: a small turn repainted the
// whole frame from vellum to mat. 4° - 30° keeps the paper while you inspect the wall off-square,
// and leaves the withdrawal itself to the rate limit below.
const detent = (home, c) => 1 - A.smooth(4, 30, angleTo(c, home));

// The mat <-> paper swap repaints the entire frame, and its target hangs on the camera's own angle
// (the session detent above, or the tilt into Plan). Following that target frame by frame swapped
// the ground across ~180 counts of luminance in ~200 ms — the flicker. The value is therefore
// rate-limited: a steady pose still lands on its exact value (the step clamps, so nothing is left
// half-way at rest), but no pan, orbit or fly can repaint the ground faster than PAPER_SLEW_MS.
const PAPER_SLEW_MS = 420;
// A dropped frame must not turn the rate limit into a jump, so one step is capped at a tenth of the
// sweep. On a machine running below ~25 fps the swap simply takes proportionally longer.
const PAPER_SLEW_STEP_MS = 42;
let paperShown = 0;
let paperAt = 0;
function slewPaper(target, now) {
  const dt = Math.min(PAPER_SLEW_STEP_MS, Math.max(0, now - (paperAt || now)));
  paperAt = now;
  const step = dt / PAPER_SLEW_MS;
  const d = target - paperShown;
  paperShown = Math.abs(d) <= step ? target : paperShown + Math.sign(d) * step;
  return paperShown;
}

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
  // A parked reading holds the flatness it was rendered with: the derived formula must not dolly
  // the eye just because the reading stopped being open. Explicit spatial input releases it.
  const held = nav.hold();
  if (held != null) { flat = held; planF = held; }
  if (planF > 0.01) {
    const h = A.lerp(9.5, 1.2, ease(planF));
    clips.push(new THREE.Plane(DOWN.clone(), h));
    hCap = h;
  }
  c.flat = flat;
  stage.paper = slewPaper(flat, performance.now());
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
function frame(now) { requestAnimationFrame(frame); frameOnce(now); }

// One pass of the frame work, callable on demand. The animation loop uses it, and so does the QA
// surface: a backgrounded tab stops requestAnimationFrame, so an assertion about what is drawn must
// be able to ask for a frame instead of waiting for one.
function frameOnce(now) {
  try {
    tickTweens(now);
    E.visitorFrame(now);
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
    return true;
  } catch (e) {
    if (e.message !== lastErr) { lastErr = e.message; recordFault('frame', e); console.error(e); }
    return false;
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
  if (S.visitor) { E.visitorPointer?.(e); return; }
  if(S.experienceContext.depth === 'route' && e.button===0 && !e.altKey) { const p=groundAt(e); if(p)E.routePoint(p); return; }
  if(S.task?.kind === 'experience-region') { const p=groundAt(e); if(p)E.regionPoint(p); return; }
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
    // Explicit spatial input: the standpoint is being re-derived by hand, so any parked hold ends.
    nav.releaseHold();
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
  nav.releaseHold();
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
  if(E.beginCameraDrag(e)||E.beginAnchorDrag(e))return;
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
  h.classList.add('manipulating');
  S.activeEdit = activeEditFor(spec);
  document.body.classList.add('dragging');
  A.beginEdit();
});

// The one value this gesture owns — used by the overlay to emphasise that measurement and no other.
function activeEditFor(spec) {
  switch (spec.type) {
    case 'op-head': return { kind: 'op', id: spec.id, key: 'head' };
    case 'op-sill': return { kind: 'op', id: spec.id, key: 'sill' };
    case 'op-rise': return { kind: 'op', id: spec.id, key: 'rise' };
    case 'op-jamb': return { kind: 'op', id: spec.id, key: 'w' };
    case 'ridge': return { kind: 'top', wall: spec.wall, key: 'rh' };
    case 'top': return { kind: 'top', wall: spec.wall, key: spec.key };
    case 'ceil-h': return { kind: 'ceil', id: spec.id, key: 'base' };
    default: return null;
  }
}

function clearActiveEdit() {
  if (hdrag?.el) { hdrag.el.classList.remove('manipulating'); hdrag.el.classList.remove('refused'); }
  S.activeEdit = null;
}
// Lost capture, pointercancel and Esc are the same policy: whatever was being written is dropped,
// nothing is accepted, and no trailing pointerup/change/blur can commit it afterwards.
window.addEventListener('pointercancel', () => { cancelProposal('pointercancel'); requestUI(); });
window.addEventListener('lostpointercapture', () => { if (hdrag || direct || typeSpec) cancelProposal('lost-capture'); requestUI(); });

// This module holds the pointer writers, so it registers how to drop them. Order 10: the writer
// stops before the candidate snapshot it was written against is rolled back (actions.js, order 60).
onCancel(() => {
  if (direct) { direct = null; document.body.classList.remove('dragging'); }
  if (hdrag) { clearActiveEdit(); hdrag = null; document.body.classList.remove('dragging'); }
  if (typeSpec) closeTypein();
  S.refusal = null;
  S.fieldErr = null;
}, 10, 'pointer-writer');

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
  clearActiveEdit();
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
  S.activeEdit = { kind: spec.type, id: spec.id, wall: spec.wall, key: spec.key };
  typeinInput.value = fmt(fieldValue(spec));
  typeinInput.focus();
  typeinInput.select();
}

function closeTypein() { typein.hidden = true; typeSpec = null; S.activeEdit = null; requestUI(); }

typeinInput.addEventListener('keydown', (e) => {
  // A draft that is no longer in hand cannot be committed by a late key: the writer was dropped (Esc,
  // pointercancel, a lens change), so the key has nothing to write and says so by doing nothing.
  if (!typeSpec) { if (e.key === 'Escape' || e.key === 'Enter') e.stopPropagation(); return; }
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
  // No acceptance through blur: a field commits on Enter (or the drawing's own Tab), never because
  // focus moved on. Leaving a half-typed value behind is the thing this prevents.
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
    S.popover = { wall: gap.dataset.gap, ceil: s.ceilId, opts: A.gapOptions(gap.dataset.gap, s.ceilId), anchor: { x: r.left + r.width / 2 - sr.left, y: r.bottom - sr.top - 18 } };
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
  const act = t.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    // A subject's own verbs are capabilities, not shell commands: the row or the Card names the
    // subject it belongs to, and the seam routes it. Nothing here depends on what is selected.
    if (a.startsWith('look-')) { closeFinder(); T.invoke(a.slice(5), { id: act.dataset.id ?? S.sel }); return; }
    doAct(a, act);
    return;
  }
  // Every Select in the shell reaches the same facade with the same announcement: the Index, a Card
  // relation, a result row. Browsing itself never gets here.
  const sel = t.closest('[data-sel]');
  if (sel) { selectFrom(sel.dataset.sel); return; }
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
// Keyboard focus previews the same frozen correction as hover, and leaving it cancels the preview.
document.addEventListener('focusin', (e) => {
  const opt = e.target.closest?.('[data-opt]');
  if (opt && S.popover?.opts) A.previewOption(S.popover.opts[+opt.dataset.opt]);
});
document.addEventListener('focusout', (e) => {
  if (e.target.closest?.('[data-opt]')) A.unpreview();
});

function motionText() {
  return {
    adaptive: 'Motion adapts — the first times you see a move it plays slowly, then gets brisk',
    teach: 'Motion always plays at teaching speed',
    brisk: 'Motion is brisk',
    instant: 'Motion is instant — every change of view jumps',
  }[S.motion];
}

// A listing is a lookup surface: as soon as a verb acts on the world — or a result is chosen — it gets
// out of the way. Disclosure and context stay exactly where they are.
const WORLD_ACT = new Set(['sel', 'open-loc', 'lookat', 'include', 'reveal', 'faceit', 'gohost', 'lookup', 'face', 'unfold', 'fold', 'lift', 'lift-rel', 'square', 'stepback', 'crumb', 'close', 'close-all', 'plan', '3d', 'home', 'knife', 'knife-open', 'measure', 'precision', 'reopen-cut', 'side-in', 'side-out', 'undo', 'redo', 'summary-undo', 'summary-keep']);

function doAct(a, el) {
  const s = S.session;
  if (S.visitor && !a?.startsWith('exp-')) return;
  if (WORLD_ACT.has(a)) closeFinder();
  if (E.handleExperienceAction(el)) { requestUI(); return; }
  switch (a) {
    // Back leaves the reading when there is one; with nothing open it only drops unaccepted work,
    // so the same control is never a dead end.
    case 'close':
      // Work in hand that is not the reading's own surface is put away first; the reading underneath
      // is exactly as it was, and only then is there a reading to leave.
      if (S.task && s && S.task.kind !== s.kind) { cancelProposal('close'); A.endTaskInHand(); requestUI(); }
      else if (s) A.closeSession();
      else { cancelProposal('close'); A.endTaskInHand(); requestUI(); }
      break;
    case 'face': A.face(S.sel); break;
    case 'unfold': A.unfold(); break;
    case 'fold': A.fold(); break;
    case 'square': A.squareUp(); break;
    case 'stepback': A.stepBack(); break;
    case 'lift': A.lift(S.sel); break;
    case 'lift-rel': A.lift(el.dataset.id); break;
    case 'lookup': A.lookUp(s?.ceilId || (thing(S.sel)?.kind === 'ceilings' ? S.sel : null)); break;
    case 'mirror': A.toggleMirror(); requestUI(); break;
    // Precision: the numbers of the work in hand, reached without a pointer. It belongs to the task,
    // so it cannot outlive the work it belongs to.
    case 'precision': A.setPrecision(!S.task?.precision); break;
    case 'measure': A.dimensionTask(el?.dataset?.id ?? S.sel); break;
    case 'knife': A.startKnife(); break;
    case 'knife-open': A.commitKnife(); break;
    case 'knife-flip': A.flipKnife(); break;
    case 'knife-cancel': A.cancelKnife(); break;
    case 'depth-': A.setDepth((s?.cut.depth ?? S.knife?.depth ?? 6) - 0.5); break;
    case 'depth+': A.setDepth((s?.cut.depth ?? S.knife?.depth ?? 6) + 0.5); break;
    // ----- Browse and Details -------------------------------------------------
    // Select is the canonical identity and nothing else: the view, the reading and the work in hand
    // are as they were. Every other verb below names its own target, so none of them depends on what
    // happens to be selected — that is what makes them independently exercisable.
    case 'sel': selectFrom(el.dataset.id); break;
    case 'open-loc': A.openLocation(el.dataset.id); break;
    case 'place': focusPlace(el.dataset.id); break;
    case 'ctx': setContext(el.dataset.ctx || null); break;
    case 'more': S.browse.page += 1; requestUI(); break;
    case 'less': S.browse.page = 0; requestUI(); break;
    case 'expand':
      S.expand = !S.expand;
      A.setStatus(S.expand
        ? 'Details expanded — each relation is named and acts on its own target. The selection and the view are unchanged'
        : 'Details collapsed — disclosure only: the subject, the view and the work in hand are as they were', 'view');
      break;
    case 'focus': focusRelation(el.dataset.id, el.dataset.focus || 'wall-top'); break;
    // ----- Repair: an unresolved reference -----
    // The wall is picked explicitly; the station and height are declared; acceptance is one validated
    // edit; leaving it unresolved writes nothing. None of these depends on the selection.
    case 'repair-pick': A.pickRepairWall(el.dataset.id); break;
    case 'repair-accept': A.acceptRepair(); break;
    case 'repair-leave': A.leaveRepair(); break;
    case 'reveal': A.toggleReveal(el.dataset.id ?? S.sel); requestUI(); break;
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
    case 'include': A.includeIt(el.dataset.id ?? S.sel); break;
    case 'gohost': A.goToHost(el.dataset.id ?? S.sel); break;
    case 'lookat': A.lookAt(el.dataset.id ?? S.sel); break;
    case 'faceit': A.face(el.dataset.id ?? S.sel); break;
    case 'grid':
      S.wallDrafting = !S.wallDrafting;
      A.syncSheets();
      A.setStatus(S.wallDrafting
        ? 'Wall grid on: drafting paper on the wall you are working on'
        : 'Wall grid off: walls show their real material — a displaced wall keeps its dashed footprint', 'view');
      requestUI();
      break;
    case 'motion':
      S.reduceMotion = !S.reduceMotion;
      applyMotionPref();
      A.setStatus(S.reduceMotion
        ? 'Reduced motion: every view move is now an instant change'
        : 'Reduced motion off: moves play at the speed chosen in Motion', 'view');
      requestUI();
      break;
    case 'find': searchRequest(); break;
    // ----- the narrow shell's sheets -----------------------------------------------------------
    // The Index and the Card over the stage, at the widths where the shell has no columns for them.
    // A sheet is a disclosure: it changes what is shown, moves focus into itself, and leaves the
    // reading, the work in hand and the Camera exactly as they were.
    case 'sheet-index': toggleSheet('index'); break;
    case 'sheet-card': toggleSheet('card'); break;
    // ----- the lens, and the parked work the crossing leaves behind -----
    // The bridge is a read-only fixture: its two explicit selections are the only things it offers, and
    // it shares this one selection slot with the World. Resume is offered only on the parked identity,
    // with the World lens in hand, and never automatically.
    case 'lens': closeFinder(); A.switchLens(el.dataset.lens); break;
    case 'resume': A.resumeParked(); break;
    case 'parked-off': A.dismissParked(); break;
    case 'pres-sel': case 'pres-ref': closeFinder(); A.selectBridge(el.dataset.id); break;
    case 'summary-undo': A.undoSummary(); break;
    case 'summary-keep': S.summary = null; requestUI(); break;
    case 'beacon-off': S.beacon = null; requestUI(); break;
  }
}

// ---------------------------------------------------------------- find anything
// Search answers through the same resolver as the Card, the Index and the beacon, and it is context:
// typing, paging and moving the place context write nothing, select nothing and leave the Camera
// alone. Choosing a result is an explicit Select — with a beacon where the subject really is, or the
// register's own reason where it has no Stage location — and every other verb on a row names the
// record it belongs to, so no verb here depends on what happens to be selected.

const finder = $('#finder'), finderInput = $('#finderInput');

// Search is World work — a reading of the museum's subjects and records. It is not available from
// inside the read-only bridge, and the refusal names the reason instead of opening an empty list.
function searchRequest(q = '') {
  if (S.lens !== 'world') {
    A.setStatus('Search is World work — the Experience lens is a read-only continuity fixture. Switch back to the World lens to search the museum', 'refuse');
    return;
  }
  openFinder(q);
}

function openFinder(q = '') {
  // One surface in front at a time. A listing is a search over the whole museum, so it takes the place
  // of a sheet rather than stacking with it — and the sheet's toggle is cleared, not left claiming open.
  closeSheets(false);
  finder.hidden = false;
  S.browse.q = q;
  finderInput.value = q;
  S.browse.at = null;
  renderBrowse();
  finderInput.focus();
}
// ---------------------------------------------------------------- the narrow shell's sheets
// Two panels over the stage: the Index and the Card. They exist for the widths where the shell has no
// columns for them, they are opened from the Head, and they are the lightest possible thing — a
// disclosure that moves focus into itself and restores it to the control that opened it.

function sheetEl(which) { return which === 'index' ? $('#index') : $('#card'); }

function focusFirst(el) {
  if (!el) return;
  const f = el.querySelector('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
  if (f) f.focus();
  else { el.tabIndex = -1; el.focus(); }
}

function applySheets() {
  document.body.classList.toggle('sheet-index', !!S.sheet.index);
  document.body.classList.toggle('sheet-card', !!S.sheet.card);
}

function toggleSheet(which) {
  const on = !S.sheet[which];
  S.sheet = { index: false, card: false, [which]: on };
  applySheets();
  if (on) focusFirst(sheetEl(which));
  A.setStatus(on
    ? `The ${which === 'index' ? 'Index' : 'Card'} is open over the stage — the reading, the work in hand and the Camera are unchanged`
    : 'Sheet closed — the reading and the work in hand are exactly as they were', 'view');
  requestUI();
  if (!on) $(`[data-act="sheet-${which}"]`)?.focus?.();
}

function closeSheets(returnFocus) {
  const which = S.sheet.index ? 'index' : S.sheet.card ? 'card' : null;
  S.sheet = { index: false, card: false };
  applySheets();
  if (which && returnFocus) $(`[data-act="sheet-${which}"]`)?.focus?.();
  return !!which;
}

function closeFinder() {
  // Focus goes back to the control that opened it, so a keyboard user is not left at the top of the
  // document by a listing they just asked to close.
  const back = !finder.hidden && finder.contains(document.activeElement);
  if (!finder.hidden) { finder.hidden = true; S.browse.at = null; }
  // A hidden field must not keep the keyboard: after a result is picked, Esc belongs to the view
  // again (clear the beacon, then step out of the reading), not to a dialog that is already closed.
  if (document.activeElement === finderInput) finderInput.blur();
  if (back) $('[data-act="find"]')?.focus?.();
}
function pickFinder(id) {
  closeFinder();
  selectFrom(id);
}

// One Select for every entry point: the Index, a Card relation, a result row, a keyboard choice. The
// identity changes and nothing else does; the beacon says where the subject is, and a record without
// Stage geometry says where it really lives instead of being marked on a drawing it is not in.
function selectFrom(id) {
  if (!id) return;
  A.select(id);
  const rec = recordOf(id);
  if (rec) {
    A.setStatus(`Selected the ${rec.name} — a record with no Stage location, kept in the ${rec.where}. Nothing opens, and the view does not move`, 'view');
    return;
  }
  S.beacon = id;
  const r = A.whereIs(id);
  A.setStatus(r.state === 'visible' || r.state === 'cut'
    ? `${labelOf(id)} is in view — the beacon marks it. Nothing opened, the view unchanged`
    : `${labelOf(id)}: ${r.reason}. The Card says what you can do about it`, 'view');
}

// Focus and context. A place (or the register) is the context the Index shows; a relation is the
// local point the next work will be about. Neither is the selection, and neither moves the view.
function focusPlace(id) {
  if (!id) return;
  const on = S.browse.focus?.kind === 'place' && S.browse.focus.id === id;
  S.browse.focus = on ? null : { kind: 'place', id };
  resetBrowse();
  A.setStatus(on
    ? 'Back to the whole museum in the Index — the selection and the view are unchanged'
    : `The ${placeNameOf(id)} focused as context — the Index shows what is there. The selection does not change`, 'view');
}
function setContext(c) {
  const f = S.browse.focus;
  const on = !c ? !f || f.kind === 'rel'
    : c === 'records' ? f?.kind === 'records'
      : f?.kind === 'place' && f.id === c;
  S.browse.focus = !c || on ? null : c === 'records' ? { kind: 'records' } : { kind: 'place', id: c };
  resetBrowse();
  const now = S.browse.focus;
  A.setStatus(now?.kind === 'records'
    ? 'Browsing the records register — context only: these have no Stage location, and the selection does not change'
    : now ? `Browsing ${placeNameOf(now.id)} — context only. The selection and the view are unchanged`
      : 'Browsing the whole museum — context only', 'view');
}
function resetBrowse() { S.browse.page = 0; S.browse.at = null; requestUI(); }
function focusRelation(id, what) {
  const label = `${labelOf(id)} ${what === 'wall-top' ? 'top' : what}`;
  S.browse.focus = { kind: 'rel', at: id, what, label };
  // Work that is about one local point takes the focus with it, but only when the focused thing is its
  // own target or subject: an unrelated invocation is never rewritten by naming a relation elsewhere.
  // A measurement is about the whole subject, so it keeps its own focus — the relation stays context
  // for the next work rather than pretending the numbers have narrowed.
  const t = S.task;
  if (t && t.kind !== 'dims' && (t.target?.id === id || t.subject === id)) T.setFocus({ kind: what, id, label });
  A.setStatus(`Focused the ${label} — local context for the next work. The selection and the view are unchanged`, 'view');
}

function moveBrowse(d) {
  const shown = browseShown();
  if (!shown.length) return;
  const i = shown.findIndex((r) => r.id === S.browse.at);
  const j = i < 0 ? (d > 0 ? 0 : shown.length - 1) : Math.max(0, Math.min(shown.length - 1, i + d));
  S.browse.at = shown[j]?.id ?? null;
  requestUI();
}

finderInput.addEventListener('input', () => { S.browse.q = finderInput.value; resetBrowse(); });
finderInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveBrowse(e.key === 'ArrowDown' ? 1 : -1); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const id = S.browse.at || browseShown()[0]?.id;
    if (!id) return;
    if (e.shiftKey && !recordOf(id)) { closeFinder(); A.openLocation(id); return; }
    pickFinder(id);
  }
  if (e.key === 'Escape') { e.stopPropagation(); closeFinder(); }
});
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
    nav.releaseHold();
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
  if (S.visitor) { if (e.key === 'Escape') E.exitPreview(); return; }
  if (e.key === 'Shift') S.shift = true;
  if (e.target.matches?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo(); return; }
  if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); searchRequest(); return; }
  if (e.metaKey || e.ctrlKey) return;
  switch (k) {
    case 'escape': {
      // The one policy first: an unaccepted writer, draft, preview or aim is dropped before any
      // reading is touched. Shift-Esc is still a direct whole-chain return, after that cancel.
      const held = S.pending || S.preview || S.popover || typeSpec || hdrag || direct || S.knife;
      if (held) cancelProposal('esc');
      if (e.shiftKey) { closeSheets(false); if (S.session) A.closeAll(); requestUI(); break; }
      if (held) { requestUI(); break; }
      if (!$('#help').hidden) $('#help').hidden = true;
      else if (S.beacon) { S.beacon = null; requestUI(); }
      // A sheet is the surface in front: Esc closes it before anything about the reading changes, and
      // closing it touches nothing else — no ghost reading, no Instrument lost behind it.
      else if (S.sheet.index || S.sheet.card) { closeSheets(true); requestUI(); }
      // Precision sits between the writer and the reading: it is a state of the work in hand, so it is
      // left before any spatial return, and leaving it changes nothing else.
      else if (S.task?.precision) A.setPrecision(false);
      // In-place work has no reading to return through: it is put away in one step, and whatever
      // reading was underneath it comes back with its own Instrument. Nothing is authored, moved or
      // selected differently by leaving it.
      else if (S.task && (!S.session || S.task.kind !== S.session.kind)) { cancelProposal('esc'); A.endTaskInHand(); requestUI(); }
      else if (S.session) A.closeSession();
      else if (S.task) { cancelProposal('esc'); A.endTaskInHand(); requestUI(); }
      break;
    }
    case '/': e.preventDefault(); searchRequest(); break;
    case 's': if (S.session?.kind === 'face') A.squareUp(); break;
    case '1': A.goPlan(); break;
    case '2': A.go3D(); break;
    // The line, defined by keys. With an aim in hand the arrows slide and turn it, − and = set the
    // depth, and the first key seeds a line to move: the same command set the drag ends in. Shift
    // takes a larger step. None of these opens anything.
    case 'arrowleft': case 'arrowright': {
      if (!S.knife) break;
      e.preventDefault();
      A.slideKnife((k === 'arrowleft' ? -1 : 1) * (e.shiftKey ? 2 : 0.5));
      break;
    }
    case 'arrowup': case 'arrowdown': {
      if (!S.knife) break;
      e.preventDefault();
      A.turnKnife((k === 'arrowup' ? 1 : -1) * (e.shiftKey ? 30 : 7.5));
      break;
    }
    case '-': case '_': if (S.knife) { e.preventDefault(); A.depthKnife(-0.5); } break;
    case '=': case '+': if (S.knife) { e.preventDefault(); A.depthKnife(0.5); } break;
    case 'f': A.face(S.sel); break;
    case 'o': openSelected(); break;
    case 'u': A.lookUp(S.session?.ceilId || (thing(S.sel)?.kind === 'ceilings' ? S.sel : null)); break;
    case 'k': A.startKnife(); break;
    case 'm': A.toggleMirror(); requestUI(); break;
    case 'p': if (S.task) A.setPrecision(!S.task.precision); break;
    case 'g': doAct('grid'); break;
    case 'enter':
      // Enter opens the drawn line, or accepts the declared candidate. A field keeps its own Enter: the
      // window handler never sees a key that belongs to an input.
      if (S.knife) A.commitKnife();
      else if (S.task?.kind === 'repair' && S.task.params.wall) A.acceptRepair();
      break;
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
  if (!t) {
    const rec = S.sel ? recordOf(S.sel) : null;
    if (rec) { A.setStatus(`${rec.name} is a record with no Stage location — there is nothing here to open, and nothing to fly to`, 'info'); return; }
    A.startKnife();
    return;
  }
  if (t.kind === 'ceilings') { A.lift(S.sel); return; }
  const w = t.kind === 'walls' ? t.item : t.kind === 'openings' ? t.wall : t.kind === 'art' ? W(t.item.wall) : null;
  if (!w) return;
  if (w.kind === 'arc') A.unfold();
  else A.face(S.sel);
}

// ---------------------------------------------------------------- QA observation
// The prototype's own acceptance harness reads this surface: source values, canonical selection,
// reading/session parameters, the realized Camera (eye, up, FOV and framing as rendered, not the
// request), and every command or page fault. It observes; it never writes. See qa/README.md.

function realizedCamera() {
  const cam = stage.camera;
  const fov = cam.fov;
  const tgt = stage.cam.target;
  const dist = cam.position.distanceTo(tgt);
  return {
    eye: [cam.position.x, cam.position.y, cam.position.z],
    up: [cam.up.x, cam.up.y, cam.up.z],
    target: [tgt.x, tgt.y, tgt.z],
    dir: (() => { const d = new V3(); cam.getWorldDirection(d); return [d.x, d.y, d.z]; })(),
    fov, dist, frameH: 2 * dist * Math.tan((fov * Math.PI) / 360), mirror: !!stage.cam.mirror, aspect: cam.aspect,
  };
}

const round3 = (v) => Math.round(v * 1000) / 1000;
const roundVec = (a) => a.map(round3);

function sessionShape(s = S.session) {
  if (!s) return null;
  return {
    kind: s.kind, id: s.id, wallId: s.wallId ?? null, focusId: s.focusId ?? null, focusName: s.focusName ?? null,
    opening: s.opening ?? null, ceilId: s.ceilId ?? null, side: s.side ?? null,
    u: s.u != null ? round3(s.u) : null, part: s.part != null ? round3(s.part) : null, lift: s.lift != null ? round3(s.lift) : null,
    cut: s.cut ? { p0: [...s.cut.p0], p1: [...s.cut.p1], side: s.cut.side, depth: s.cut.depth, n: s.cut.n.map(round3) } : null,
    parent: s.parent ? { kind: s.parent.kind, label: s.parent.label } : null,
    origin: s.origin ? { label: s.origin.label } : null,
  };
}

// A stable digest of the fixture's source values: the same accepted model must hash the same in
// every stage, so any silent change to source data shows up as a diff, not a screenshot.
function museumHash(m) {
  const s = JSON.stringify(m);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const QA = {
  state() {
    return {
      view: A.viewLabel(), kind: A.viewKind(), sel: S.sel, hover: S.hover,
      // the stage rect the realized Camera was rendered against: the fit, and therefore the realized
      // eye, distance and frame height, are functions of it. Recorded so a shell change that resizes
      // the stage is a named fact in a diff, never a silent reinterpretation of the numbers.
      stage: (() => { const r = stageEl.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
      undo: S.undo.length, redo: S.redo.length, lastUndo: S.undo[S.undo.length - 1]?.label ?? null,
      reveal: S.reveal, knife: S.knife ? { stage: S.knife.stage, hasLine: !!S.knife.p1, depth: S.knife.depth, side: S.knife.side } : null,
      session: sessionShape(), crumbs: A.crumbs().map((c) => c.label), trail: S.trail.map((e) => e.label), trailPos: S.trailPos,
      task: S.task ? { kind: S.task.kind, subject: S.task.subject, target: S.task.target, focus: S.task.focus, depth: S.task.depth, instrument: !!S.task.instrument } : null,
      browse: { q: S.browse.q, focus: S.browse.focus ? { ...S.browse.focus } : null, page: S.browse.page, at: S.browse.at },
      expand: !!S.expand,
      // The declared candidate, as the drawing has it: a preview is never an accepted source, so QA can
      // read what is drawn without reading the model.
      preview: ctx.stage.previewPlace ? { ...ctx.stage.previewPlace } : null,
      taskTitle: T.describe()?.title ?? null,
      lens: S.lens, flatHold: nav.hold(), sheet: { ...S.sheet }, reduced: reducedMotion(), osReduced: !!S.osReduced,
      // Parked work, as a record and as a verdict: an inactive record is not a hidden session, so QA
      // reads both what it holds and whether Resume would accept it, plus the two ways it can be wrong.
      parked: (() => {
        const p = S.parked;
        if (!p) return null;
        const v = A.parkedContext();
        return { name: p.name, identity: p.identity, chain: p.chain.map((c) => c.kind), canceled: p.canceled, ok: !!v?.ok, reason: v?.reason || '', fix: v?.fix || null };
      })(),
      cam: { az: round3(stage.cam.az), el: round3(stage.cam.el), frameH: round3(stage.cam.frameH), flat: round3(stage.cam.flat), mirror: !!stage.cam.mirror, target: roundVec([stage.cam.target.x, stage.cam.target.y, stage.cam.target.z]) },
      realized: (() => { const r = realizedCamera(); return { ...r, eye: roundVec(r.eye), up: roundVec(r.up), target: roundVec(r.target), dir: roundVec(r.dir), fov: round3(r.fov), dist: round3(r.dist), frameH: round3(r.frameH) }; })(),
      faults: S.faults.length,
    };
  },
  /* the three questions an A–F checkpoint asks, independently of any screen */
  reading() { return A.viewLabel(); },
  realized() { return realizedCamera(); },
  museum() { return clone(ctx.museum); },
  hash() { return museumHash(ctx.museum); },
  faultList() { return S.faults.slice(); },
  clearFaults() { S.faults.length = 0; return true; },
  async idle() { while (S.busy) await new Promise((r) => setTimeout(r, 30)); return true; },
  /* draw one frame now and settle the pending UI batch, so an assertion about what is on screen does
     not depend on the tab being visible */
  async render() {
    frameOnce(performance.now());
    renderUI();
    await new Promise((r) => setTimeout(r, 0));
    frameOnce(performance.now());
    return true;
  },
  settleFor(ms) { return new Promise((r) => setTimeout(r, ms)); },
};

// ---------------------------------------------------------------- boot

// The sheet breakpoint, in one place per side: the CSS draws the sheets at this width and this line
// keeps the state honest across a resize. A sheet that outlives its width would leave a toggle saying
// "open" over a panel that is a column again, so the state is cleared rather than hidden.
const SHEET_MAX_W = 1060;
function resize() {
  stage.resize();
  if (window.innerWidth > SHEET_MAX_W && (S.sheet.index || S.sheet.card)) {
    S.sheet = { index: false, card: false };
    applySheets();
    requestUI();
  }
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(stageEl);

// Whether anything travels on screen: the editor's own Reduce-motion choice, or the machine's
// preference — which is followed live, so changing the OS setting acts without a reload. The chosen
// Motion speed is a separate thing and is untouched by either.
const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
function reducedMotion() { return !!S.reduceMotion || !!S.osReduced || osMotion.matches; }
function applyMotionPref() {
  document.body.classList.toggle('reduce-motion', reducedMotion());
  renderUI();
}
osMotion.addEventListener('change', (e) => { S.osReduced = e.matches; applyMotionPref(); });

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
  if (q.get('grid') != null) S.wallDrafting = q.get('grid') !== '0';
  if (q.get('reduced') != null) S.reduceMotion = q.get('reduced') !== '0';
  S.osReduced = osMotion.matches;
  applyMotionPref();
  if (q.get('shot')) document.body.classList.add('shot');
  // Capability dispatch: the shell asks the task seam, which routes to these operations. Parking
  // uses the neutral teardown so no lens change ever animates back to an origin pose.
  T.setDispatch({
    face: (o) => A.face(o?.id ?? S.sel),
    unroll: (o) => A.unfold(o?.id),
    section: () => A.startKnife(),
    lift: (o) => A.lift(o?.id ?? S.sel),
    lookup: (o) => A.lookUp(o?.id ?? S.sel),
    dims: (o) => A.dimensionTask(o?.id ?? S.sel),
    repair: (o) => A.repairTask(o?.id ?? S.sel),
    plan: () => A.goPlan(),
    three: () => A.go3D(),
  });
  T.setNeutralize(() => A.parkReading());
  requestAnimationFrame(frame);
  window.__me = { E, S, ctx, A, JOURNEYS, nav, tasks: T, qa: QA };
  window.__me.ready = true;
  document.body.dataset.ready = '1';
  window.addEventListener('error', (e) => recordFault('page', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => recordFault('promise', e.reason));
}
boot();

document.addEventListener('change', event => { const el = event.target; if (el.dataset.expField) E.updatePresentation(el.dataset.id, el.dataset.expField, el.value); });

window.addEventListener('pointermove',e=>{if(S.cameraDraft)E.moveCameraDrag(e,groundAt(e));if(S.expDrag){const p=groundAt(e);if(p)E.moveAnchorDrag(p);}});
window.addEventListener('pointerup',()=>{E.endCameraDrag();E.endAnchorDrag();});

document.addEventListener('change',event=>{const el=event.target;if(el.dataset.expPrecision)E.proposeFraming(el.dataset.expPrecision,el.value);});

