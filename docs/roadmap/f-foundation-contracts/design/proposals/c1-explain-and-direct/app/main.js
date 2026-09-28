// Boot, frame loop, pointer/keyboard input and the action dispatcher.

import { S, app } from './state.js';
import { store, onChange } from './store.js';
import * as D from './derive.js';
import * as CAM from './camera.js';
import * as RUN from './run.js';
import * as A from './actions.js';
import { createStage } from './stage.js';
import { renderAll } from './ui.js';
import { frameUI, renderMap } from './ui-frame.js';
import { JOURNEYS, jumpTo, presenterAct } from './journeys.js';
import { clamp, metres, times } from './util.js';

const $ = (id) => document.getElementById(id);
const P = () => store.P;
const params = new URLSearchParams(location.search);

// ---- boot ----

app.stage = createStage($('gl'), $('thumbs'));
app.stage.syncProject(P());
app.showMap = true;
S.orbit = CAM.orbitFrom(A.START_POSE);
S.sel = { kind: 'subject', inst: 'pumpA' };
if (matchMedia('(prefers-reduced-motion: reduce)').matches) S.motion = 'reduced';
if (params.get('motion') === 'reduced') S.motion = 'reduced';

onChange(() => { app.stage.syncProject(P()); });

let uiQueued = false;
app.ui = () => {
  if (uiQueued) return;
  uiQueued = true;
  queueMicrotask(() => { uiQueued = false; renderAll(); renderMap(); });
};

// ---- evaluation for the authoring viewport ----

function authorEval() {
  const p = P();
  const occ = S.stop ? p.occ[S.stop] : null;
  let out = { ch: { 'pumpA.casing': 0, 'pumpB.casing': 0, 'bay.cutaway': 0 }, owners: {}, occ: null, pose: null };
  if (occ) {
    const sch = D.schedule(p, occ);
    const t = clamp(S.scrub ?? sch.length, 0, sch.length);
    const e = D.evalStop(p, occ, t, { reduced: false });
    out = { ...e, occ };
  }
  if (S.inspect) {
    const I = S.inspect;
    out = { ...out, ch: { 'pumpA.casing': 0, 'pumpB.casing': 0, 'bay.cutaway': A.animValue(I.cutA) }, owners: {} };
    out.ch[I.inst + '.casing'] = A.animValue(I.sepA);
  }
  let pose;
  const now = performance.now() / 1000;
  if (S.camAnim) {
    const k = S.camAnim.dur > 0 ? clamp((now - S.camAnim.t0) / S.camAnim.dur) : 1;
    pose = CAM.blendPose(S.camAnim.from, S.camAnim.to, k);
    if (k >= 1) { const a = S.camAnim; S.camAnim = null; S.orbit = CAM.orbitFrom(a.to); a.then?.(); }
  } else if (S.look === 'shot' && out.pose && !S.inspect) pose = out.pose;
  else pose = CAM.orbitPose(S.orbit);
  return { out, pose };
}

// ---- frame loop ----

let last = performance.now();
const phase = { pumpA: 0, pumpB: 0.9 };
function frame(nowMs) {
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  S.world.t += dt;
  const still = S.motion === 'reduced';
  if (!still) { phase.pumpA += dt * 3.2; phase.pumpB += dt * 3.2; }

  let out, pose;
  if (S.mode === 'preview' && app.R) {
    const prevStatus = app.R.status + app.R.i + (app.R.conflict ? 'c' : '') + app.R.waiting;
    RUN.advance(app.R, dt);
    out = RUN.evaluate(app.R, S.world);
    pose = out.pose;
    const nowStatus = app.R.status + app.R.i + (app.R.conflict ? 'c' : '') + app.R.waiting;
    if (nowStatus !== prevStatus) app.ui();
  } else { A.tlTick(dt); ({ out, pose } = authorEval()); }

  const st = app.stage;
  st.setChannels(out.ch);
  st.setRotor(phase, still);
  if (S.mode === 'preview') {
    st.setGhosts({});
    st.setRoofGhost(null);
    st.setSelection(null);
    st.setHover(null);
    st.setMoveGhost(null, null);
    st.setPulse(out.pulse?.inst, out.pulse ? out.pulse.k * 0.55 : 0);
  } else {
    const ghosts = {};
    if (S.inspect) ghosts[S.inspect.inst] = 'session';
    else for (const c of ['pumpA.casing', 'pumpB.casing']) if (out.owners?.[c]) ghosts[c.split('.')[0]] = 'authored';
    st.setGhosts(ghosts);
    st.setRoofGhost(S.inspect ? 'session' : out.owners?.['bay.cutaway'] ? 'authored' : null);
    const sel = S.sel?.kind === 'subject' ? { inst: S.sel.inst, comp: S.sel.comp } : S.sel?.kind === 'beat' ? beatSubject() : null;
    st.setSelection(sel);
    st.setHover(S.hover && (!sel || S.hover.inst !== sel.inst || S.hover.comp !== sel.comp) ? S.hover : null);
    st.setMoveGhost(S.pendingMove?.inst, S.pendingMove?.pos);
    st.setPulse(null, 0);
  }
  st.setPose(pose);
  app.lastPose = pose;
  st.render();
  frameUI(out, pose);
  if (S.toast && performance.now() / 1000 > S.toast.until) { S.toast = null; app.ui(); }
  requestAnimationFrame(frame);
}

function beatSubject() {
  const occ = P().occ[S.sel.occ];
  const b = occ?.beats.find((x) => x.id === S.sel.id);
  return b?.kind === 'use' ? { inst: b.subject, comp: 'casing' } : null;
}

// ---- pointer input on the Paper ----

const canvas = $('gl');
let drag = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, shift: e.shiftKey, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) { hoverAt(e); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
  if (!drag.moved) return;
  if (S.mode === 'preview') { if (app.R?.status === 'looking') RUN.orbitVisitor(app.R, -dx * 0.006, dy * 0.005); return; }
  if (S.camAnim) return;
  if (S.look === 'shot') { A.leaveShot(); app.ui(); }
  const o = S.orbit;
  if (drag.button === 2 || drag.shift) {
    const k = o.dist * 0.0016;
    const right = [Math.cos(o.yaw), 0, -Math.sin(o.yaw)];
    o.pivot[0] -= right[0] * dx * k; o.pivot[2] -= right[2] * dx * k; o.pivot[1] = clamp(o.pivot[1] + dy * k, 0, 4);
  } else {
    o.yaw -= dx * 0.006;
    o.pitch = clamp(o.pitch + dy * 0.005, -0.2, 1.45);
  }
});
canvas.addEventListener('pointerup', (e) => {
  const d = drag;
  drag = null;
  if (!d || d.moved) return;
  clickAt(e);
});
canvas.addEventListener('dblclick', (e) => {
  if (S.mode !== 'author') return;
  const hit = pickAt(e);
  if (hit?.inst) { A.startInspect(hit.inst); app.ui(); }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (S.mode === 'preview') { if (app.R?.status === 'looking') RUN.orbitVisitor(app.R, 0, 0, Math.sign(e.deltaY) * 0.08); return; }
  if (S.camAnim) return;
  if (S.look === 'shot') { A.leaveShot(); app.ui(); }
  S.orbit.dist = clamp(S.orbit.dist * (1 + Math.sign(e.deltaY) * 0.08), 0.8, 30);
}, { passive: false });

function pickAt(e) {
  const r = canvas.getBoundingClientRect();
  return app.stage.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function hoverAt(e) {
  if (S.mode !== 'author') return;
  const hit = pickAt(e);
  const h = hit?.inst ? { inst: hit.inst, comp: hit.comp } : null;
  canvas.style.cursor = h ? 'pointer' : 'grab';
  if (JSON.stringify(h) !== JSON.stringify(S.hover)) S.hover = h;
}

function clickAt(e) {
  const hit = pickAt(e);
  if (S.mode === 'preview') {
    if (app.R?.status === 'looking' && hit?.inst && (hit.comp === 'casing')) {
      const c = hit.inst + '.casing';
      const v = app.R.ch[c]?.v ?? 0;
      RUN.requestCasing(app.R, hit.inst, v > 0.3 ? 'close' : 'open');
      app.ui();
    }
    return;
  }
  if (S.capture) return;
  if (hit?.inst) S.sel = { kind: 'subject', inst: hit.inst, comp: hit.comp === 'pipework' ? 'pipework' : hit.comp };
  else if (!S.inspect) S.sel = S.stop ? { kind: 'stop', id: S.stop } : null;
  S.panel = 'inspect';
  app.ui();
}

// ---- drawer scrubbing and retiming ----

let scrub = null;
document.addEventListener('pointerdown', (e) => {
  // The Whole lens's ruler: dragging anywhere on it scrubs the whole Experience.
  const tk = e.target.closest('[data-track]');
  if (tk && S.mode === 'author') {
    e.preventDefault();
    scrub = { kind: 'track', track: tk, len: Number(tk.dataset.len) || 0 };
    trackTo(e);
    return;
  }
  const rt = e.target.closest('[data-retime]');
  if (rt && S.mode === 'author') {
    e.preventDefault();
    const track = rt.closest('.c-track');
    const occ = P().occ[rt.dataset.occ];
    const beat = occ.beats.find((b) => b.id === rt.dataset.retime);
    scrub = { kind: 'retime', track, occ: occ.id, beat: beat.id, start: Number(rt.dataset.start), base: Number(rt.dataset.base), len: Number(rt.dataset.len), speed: beat.speed ?? 1, was: beat.speed ?? 1 };
    return;
  }
  const tr = e.target.closest('[data-scrub]');
  if (tr && S.mode === 'author' && !e.target.closest('[data-act]')) {
    scrub = { kind: 'scrub', track: tr, len: Number(tr.dataset.len), occ: tr.dataset.scrub };
    scrubTo(e);
  }
});
document.addEventListener('pointermove', (e) => {
  if (!scrub) return;
  if (scrub.kind === 'scrub') scrubTo(e);
  else if (scrub.kind === 'track') trackTo(e);
  else {
    const r = scrub.track.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const t = clamp(((e.clientX - r.left) / r.width) * scrub.len, scrub.start + 0.3, scrub.len);
    scrub.speed = clamp(scrub.base / (t - scrub.start), 0.25, 3);
    const bar = scrub.track.querySelector(`[data-retime="${scrub.beat}"]`)?.parentElement;
    if (bar) { bar.style.width = (((t - scrub.start) / scrub.len) * 100).toFixed(2) + '%'; bar.dataset.tip = times(scrub.was) + ' → ' + times(scrub.speed) + ' · this use only · definition ' + scrub.base + ' s unchanged'; bar.classList.add('dragging'); }
  }
});
document.addEventListener('pointerup', () => {
  const s = scrub;
  scrub = null;
  if (!s) return;
  if (s.kind === 'retime') {
    const v = Math.round(s.speed * 20) / 20;
    if (Math.abs(v - s.was) > 0.001) {
      const occ = P().occ[s.occ];
      const beat = occ.beats.find((b) => b.id === s.beat);
      A.doc({ kind: 'setBeat', occ: s.occ, beat: s.beat, patch: { speed: v }, label: 'Retime “' + P().res.perfs[beat.perf].name + '” on ' + P().scene.inst[beat.subject].name + ' to ' + times(v) + ' (this use only)' });
    }
    app.ui();
  } else if (s.kind === 'track') app.ui();
});
function trackTo(e) {
  const r = scrub.track.getBoundingClientRect();
  if (!(r.width > 0) || !Number.isFinite(e.clientX)) return;
  A.tlAct('seek', { g: clamp(((e.clientX - r.left) / r.width) * scrub.len, 0, scrub.len) });
}
function scrubTo(e) {
  const r = scrub.track.getBoundingClientRect();
  const occ = P().occ[scrub.occ];
  const len = D.schedule(P(), occ).length;
  if (!(r.width > 0) || !Number.isFinite(e.clientX)) return;
  S.scrub = clamp(((e.clientX - r.left) / r.width) * scrub.len, 0, len);
  if (S.look !== 'shot') { S.look = 'shot'; app.ui(); }
}

// ---- action dispatch ----

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') return;
  act(el.dataset.act, el.dataset, el);
});

function openMenu(kind, anchor, extra = {}) { S.menu = { kind, anchor, ...extra }; }

export function act(name, d = {}, el) {
  const p = P();
  const occOf = () => p.occ[d.occ];
  switch (name) {
    case 'noop': break;
    // head
    case 'exp': { S.exp = d.id; const first = p.exp.list[d.id].stops[0]; if (first) A.selectStop(first); S.panel = S.panel === 'review' ? 'review' : 'inspect'; break; }
    case 'undo': A.undoAct(); break;
    case 'redo': A.redoAct(); break;
    case 'review': S.panel = S.panel === 'review' ? 'inspect' : 'review'; break;
    case 'preview': A.startPreview(); break;
    case 'exit-preview': A.exitPreview(); break;
    // outline
    case 'stop': A.selectStop(d.id); if (S.panel === 'review' && el?.closest('.dcard')) S.panel = 'inspect'; if (el?.closest('#insp .dcard')) S.panel = 'inspect'; break;
    case 'subject': S.sel = { kind: 'subject', inst: d.inst }; S.panel = 'inspect'; break;
    case 'perf': S.sel = { kind: 'perf', id: d.id }; S.panel = 'inspect'; break;
    case 'view': S.sel = { kind: 'view', id: d.id }; S.panel = 'inspect'; break;
    case 'bay': S.sel = { kind: 'bay' }; S.panel = 'inspect'; break;
    case 'add-stop': openMenu('add-stop', '.add-stop'); break;
    case 'add-stop-view': S.menu = null; A.addStopFromView(d.view); break;
    // view bar / paper
    case 'look': if (d.v === 'shot' && S.stop) { S.look = 'shot'; S.camAnim = null; } else if (d.v === 'free') A.leaveShot(); break;
    case 'moment': S.scrub = null; break;
    case 'cammap': app.showMap = !app.showMap; break;
    case 'keys': S.help = !S.help; break;
    case 'inspect-sel': if (S.sel?.kind === 'subject') A.startInspect(S.sel.inst); break;
    case 'inspect': A.startInspect(d.inst); break;
    case 'inspect-bay': A.inspectBay(); break;
    case 'inspect-back': A.inspectBack(); break;
    case 'inspect-return': A.endInspect(); break;
    // capture
    case 'capture': S.menu = null; A.openCapture(); setTimeout(() => document.querySelector('[data-fk="cap-commit"]')?.focus(), 0); break;
    case 'cap-set': S.capture[d.k] = d.v; break;
    case 'capture-commit': A.commitCapture(); break;
    case 'capture-retry': A.retryCapture(); break;
    case 'capture-cancel': S.capture = null; break;
    // drawer
    case 'drawer': S.drawer.open = !S.drawer.open; setTimeout(() => app.stage.resize(), 0); break;
    // Opening the Whole lens lands the ruler on the Stop you were reading, so the
    // big-picture view starts where your attention already is.
    case 'lens': {
      S.drawer.open = true;
      if (d.v === 'whole' && S.drawer.lens !== 'whole') {
        S.drawer.lens = 'whole';
        const tl = D.timeline(p, S.exp);
        const i = tl.items.findIndex((it) => it.occ.id === S.stop);
        A.tlAct('seek', { g: tl.items[Math.max(0, i)]?.start ?? 0 });
      } else {
        S.drawer.lens = d.v;
        if (d.v !== 'whole') S.track.playing = false;
      }
      break;
    }
    // The Whole lens's transport.
    case 'tl-toggle': A.tlAct('toggle'); break;
    case 'tl-step': A.tlAct('step', { dir: Number(d.dir) || 1 }); break;
    case 'tl-hold': A.tlAct('hold'); break;
    case 'tl-reset': A.tlAct('seek', { g: 0 }); break;
    case 'tl-seek': A.tlAct('seek', { g: Number(d.g) || 0 }); break;
    case 'beat': S.sel = { kind: 'beat', occ: d.occ, id: d.id }; S.stop = d.occ; S.panel = 'inspect'; { const it = D.schedule(p, occOf()).items.find((i) => i.beat.id === d.id); if (it) S.scrub = it.beat.kind === 'use' ? it.end : Math.min(it.start + 0.05, D.schedule(p, occOf()).length); S.look = 'shot'; } break;
    case 'state': S.sel = { kind: 'state', occ: d.occ, id: d.id }; S.stop = d.occ; S.panel = 'inspect'; break;
    case 'beat-move': A.doc({ kind: 'setBeat', occ: d.occ, beat: d.id, patch: { move: d.v }, label: (d.v === 'travel' ? 'Travel to' : 'Cut to') + ' “' + D.viewName(p, occOf().beats.find((b) => b.id === d.id).view) + '” in “' + occOf().title + '”' }); break;
    case 'beat-remove': A.doc({ kind: 'removeBeat', occ: d.occ, beat: d.id }); S.sel = { kind: 'stop', id: d.occ }; break;
    case 'cross': A.doc({ kind: 'setBeat', occ: d.occ, beat: d.id, patch: { crossCut: d.v }, label: (d.v === 'continue' ? 'Keep the words playing across the cut' : 'Stop the words at the cut') + ' in “' + occOf().title + '”' }); break;
    case 'animate': { const r = A.doc({ kind: 'animateState', occ: d.occ, state: d.id, perf: 'P-OPEN' }, false); if (r.ok) { S.sel = { kind: 'beat', occ: d.occ, id: r.created.beat }; S.drawer.lens = 'beats'; S.drawer.open = true; S.scrub = null; A.toast('“Casing open” is now a use of the reusable “Open casing”. The Stop is timed — its beats are below.', 'ok'); } break; }
    case 'state-remove': A.doc({ kind: 'removeState', occ: d.occ, state: d.id }); S.sel = { kind: 'stop', id: d.occ }; break;
    case 'add-shot-menu': openMenu('add-shot', '#addShotBtn', { occ: d.occ, up: true }); break;
    case 'add-use-menu': openMenu('add-use', '#addUseBtn', { occ: d.occ, up: true }); break;
    case 'add-shot': { S.menu = null; const r = A.doc({ kind: 'addShot', occ: d.occ, view: d.view }); if (r.ok) S.sel = { kind: 'beat', occ: d.occ, id: r.created.beat }; break; }
    case 'add-use': { S.menu = null; const r = A.doc({ kind: 'addUse', occ: d.occ, perf: d.perf, subject: d.inst }); if (r.ok) S.sel = { kind: 'beat', occ: d.occ, id: r.created.beat }; break; }
    case 'menu-close': S.menu = null; break;
    // inspector
    case 'cont': A.doc({ kind: 'setCont', occ: d.occ, cont: d.v }); break;
    case 'stop-move': A.doc({ kind: 'moveStop', occ: d.occ, dir: Number(d.dir) }); break;
    case 'stop-remove': { const r = A.doc({ kind: 'removeStop', occ: d.occ }); if (r.ok) { S.stop = null; S.sel = null; } break; }
    case 'reuse': A.reuseStop(d.occ, d.exp); break;
    case 'framing': {
      const v = p.camera.views[d.view];
      if (d.v === v.framing) break;
      if (d.v === 'assisted') A.followView(d.view, p.occ[d.occ]);
      else { const pose = CAM.prepare(p, d.view, D.schedule(p, p.occ[d.occ]).ctx); A.doc({ kind: 'setView', view: d.view, patch: { framing: 'locked', eye: pose.eye, target: pose.target, aim: [...p.scene.inst[v.subject].pos] }, label: 'Lock “' + v.name + '” at its current composition (Camera)' }); }
      break;
    }
    case 'scope': S.useScope = d.v; break;
    case 'speed': { const occ = occOf(); const b = occ.beats.find((x) => x.id === d.id); const v = Number(d.v); A.doc({ kind: 'setBeat', occ: d.occ, beat: d.id, patch: { speed: v }, label: 'Play “' + p.res.perfs[b.perf].name + '” at ' + times(v) + ' on ' + p.scene.inst[b.subject].name + ' (this use only)' }); break; }
    case 'sep-own': S.sepEdit = S.sepEdit === d.id ? null : d.id; break;
    case 'sep-own-apply': { const occ = occOf(); const b = occ.beats.find((x) => x.id === d.id); const v = Number(S.sepDraft ?? D.useInfo(p, b).sep); S.sepEdit = null; S.sepDraft = null; A.doc({ kind: 'setBeat', occ: d.occ, beat: d.id, patch: { over: { separation: v } }, refresh: true, label: 'Open ' + p.scene.inst[b.subject].name + '’s casing ' + metres(v) + ' in “' + occ.title + '” (this use only)' }); break; }
    case 'sep-clear': { const occ = occOf(); const b = occ.beats.find((x) => x.id === d.id); A.doc({ kind: 'setBeat', occ: d.occ, beat: d.id, patch: { over: { separation: null } }, refresh: true, label: 'Use the shared separation for ' + p.scene.inst[b.subject].name + ' in “' + occ.title + '”' }); break; }
    case 'def-apply': { const pend = S.pendingPerf; S.pendingPerf = null; if (pend) A.doc({ kind: 'setPerf', perf: pend.perf, patch: { separation: pend.separation } }, 'Changed the shared “' + p.res.perfs[pend.perf].name + '” to ' + metres(pend.separation) + '. Review shows what it reached.'); break; }
    case 'def-cancel': S.pendingPerf = null; break;
    case 'move-apply': { const m = S.pendingMove; S.pendingMove = null; if (m) A.doc({ kind: 'moveSubject', inst: m.inst, pos: m.pos }, 'Moved ' + p.scene.inst[m.inst].name + ' (Scene). Subject-assisted shots followed it; open Review for what didn’t.'); break; }
    case 'move-cancel': S.pendingMove = null; break;
    case 'add-route': A.doc({ kind: 'addRoute', a: d.a, b: d.b, via: [] }, 'Camera now has a route between those views — travel resolves.'); break;
    // review
    case 'diag-open': S.panel = 'review'; setTimeout(() => document.getElementById('dg-' + d.id)?.scrollIntoView({ block: 'center' }), 30); break;
    case 'diag-follow': A.followView(d.view, p.occ[d.occ]); break;
    case 'diag-reaim': A.reaimView(d.view, p.occ[d.occ]); break;
    case 'diag-keep': A.doc({ kind: 'ack', occ: d.occ, key: d.key, label: 'Keep the locked shot in “' + p.occ[d.occ].title + '” as authored' }); break;
    case 'diag-repair': A.repairUse(d.occ, d.id); break;
    case 'diag-reviewed': A.doc({ kind: 'markReviewed', occ: d.occ }); break;
    // preview
    case 'run': A.runAct(d.v); break;
    case 'run-goto': A.runAct('goto', { i: Number(d.i) }); break;
    case 'run-back': A.runAct('back'); break;
    case 'run-casing': A.runAct('casing', { inst: d.inst, op: d.op }); break;
    case 'run-resolve': A.runAct('resolve', { choice: d.v }); break;
    // status / presenter
    case 'motion': A.setMotion(d.v); break;
    case 'toast-x': S.toast = null; break;
    default: if (!presenterAct(name, d)) console.warn('unhandled action', name);
  }
  app.ui();
}
app.act = act;

// ---- fields ----

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.field;
  if (!f) return;
  const v = e.target.value;
  if (f === 'inspect-sep') { A.inspectSep(Number(v)); const o = e.target.nextElementSibling; if (o) o.textContent = metres(Number(v)); }
  if (f === 'use-sep') { S.sepDraft = Number(v); const o = e.target.nextElementSibling; if (o) o.textContent = metres(Number(v)); }
  if (f === 'cap-title' && S.capture) S.capture.title = v;
  if (f === 'cap-viewName' && S.capture) S.capture.viewName = v;
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const f = t.dataset?.field;
  if (!f) return;
  const p = P();
  const v = t.value;
  switch (f) {
    case 'title': if (v.trim() && v !== p.occ[t.dataset.occ].title) A.doc({ kind: 'renameStop', occ: t.dataset.occ, title: v.trim() }); break;
    case 'text': if (v !== D.sayOf(p.occ[t.dataset.occ])?.text) A.doc({ kind: 'editText', occ: t.dataset.occ, text: v, dur: Math.max(4, Math.round(v.split(/\s+/).length / 2.6)) }); break;
    case 'beat-rel': {
      const occ = p.occ[t.dataset.occ];
      const b = occ.beats.find((x) => x.id === t.dataset.id);
      if (v === 'then' || v === 'with') A.doc({ kind: 'setBeat', occ: occ.id, beat: b.id, patch: { rel: v, cue: null }, label: 'Start a beat ' + (v === 'with' ? 'with' : 'after') + ' the previous one in “' + occ.title + '”' });
      else if (v === 'newcue') {
        const say = occ.beats.slice(0, occ.beats.indexOf(b)).reverse().find((x) => x.kind === 'say');
        const name = b.kind === 'shot' && p.camera.views[b.view]?.subject ? p.scene.inst[p.camera.views[b.view].subject].name.toLowerCase() : 'here';
        const tcue = Math.round(say.dur * 0.3 * 10) / 10;
        A.doc({ kind: 'addCue', occ: occ.id, beat: say.id, name, t: tcue }, false);
        A.doc({ kind: 'setBeat', occ: occ.id, beat: b.id, patch: { rel: 'cue', cue: { beat: say.id, name } }, label: 'Cut at “' + name + '” in the words of “' + occ.title + '”' });
      } else { const [, beat, name] = v.split(':'); A.doc({ kind: 'setBeat', occ: occ.id, beat: b.id, patch: { rel: 'cue', cue: { beat, name } }, label: 'Start at “' + name + '” in the words of “' + occ.title + '”' }); }
      break;
    }
    case 'def-sep': { const n = clamp(Number(v), 0, 1); S.pendingPerf = Math.abs(n - p.res.perfs[t.dataset.perf].params.separation) > 1e-3 ? { perf: t.dataset.perf, separation: n } : null; break; }
    case 'move-x': case 'move-z': {
      const inst = p.scene.inst[t.dataset.inst];
      const cur = S.pendingMove?.inst === inst.id ? S.pendingMove.pos : inst.pos;
      const pos = f === 'move-x' ? [Number(v), cur[1]] : [cur[0], Number(v)];
      S.pendingMove = { inst: inst.id, pos };
      break;
    }
    case 'cap-casing': S.capture.includeCasing = t.checked; break;
    case 'cap-cut': S.capture.includeCut = t.checked; break;
    case 'cap-after': S.capture.after = v; break;
    default: return;
  }
  app.ui();
});

// ---- keyboard ----

document.addEventListener('keydown', (e) => {
  app.shift = e.shiftKey;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? A.redoAct() : A.undoAct(); app.ui(); return; }
  if (e.key === 'Escape') {
    if (typing) { document.activeElement.blur(); return; }
    if (S.help) S.help = false;
    else if (S.menu) S.menu = null;
    else if (app.R?.conflict) A.runAct('resolve', { choice: 'yield' });
    else if (S.capture) S.capture = null;
    else if (S.mode === 'preview' && app.R?.status === 'looking') A.runAct('back');
    else if (S.mode === 'preview') A.exitPreview();
    else if (S.pendingMove) S.pendingMove = null;
    else if (S.pendingPerf) S.pendingPerf = null;
    else if (S.inspect) A.inspectBack();
    else if (S.panel === 'review') S.panel = 'inspect';
    app.ui();
    return;
  }
  if (typing) {
    if (e.key === 'Enter' && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    return;
  }
  if (e.key === 'Enter' && S.capture && S.capture.status === 'open' && !e.target.closest('button')) { A.commitCapture(); app.ui(); return; }
  if (S.mode === 'preview') {
    const R = app.R;
    const k = e.key.toLowerCase();
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); A.runAct('toggle'); }
    else if (e.key === 'ArrowRight' && R.status !== 'looking') A.runAct('next');
    else if (e.key === 'ArrowLeft' && R.status !== 'looking') A.runAct('prev');
    else if (R.status === 'looking' && e.key.startsWith('Arrow')) { e.preventDefault(); RUN.orbitVisitor(R, e.key === 'ArrowLeft' ? 0.12 : e.key === 'ArrowRight' ? -0.12 : 0, e.key === 'ArrowUp' ? 0.08 : e.key === 'ArrowDown' ? -0.08 : 0); }
    else if (R.status === 'looking' && (k === '+' || k === '=' || k === '-')) RUN.orbitVisitor(R, 0, 0, k === '-' ? 0.1 : -0.1);
    else if (k === 'l') A.runAct(R.status === 'looking' ? 'back' : 'look');
    else if (k === 'r') A.runAct('restart');
    else if (k === 'j') S.presenter.open = !S.presenter.open;
    else if (k === '?') S.help = !S.help;
    else return;
    app.ui();
    return;
  }
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const row = e.target.closest?.('.stop-row');
    if (!row) return;
    e.preventDefault();
    const occ = P().occ[row.dataset.id];
    if (e.altKey) { A.doc({ kind: 'moveStop', occ: occ.id, dir: e.key === 'ArrowUp' ? -1 : 1 }); }
    else {
      const list = P().exp.list[S.exp].stops;
      const i = list.indexOf(occ.id) + (e.key === 'ArrowUp' ? -1 : 1);
      if (i >= 0 && i < list.length) A.selectStop(list[i]);
    }
    app.ui();
    setTimeout(() => document.querySelector(`.stop-row[data-id="${S.stop}"]`)?.focus(), 0);
    return;
  }
  if (e.target.closest?.('button, a') && (e.key === 'Enter' || e.key === ' ')) return;
  if (k === ' ' && !S.capture && S.drawer.open && S.drawer.lens === 'whole') { e.preventDefault(); A.tlAct('toggle'); app.ui(); return; }
  if (k === 'i' && S.sel?.kind === 'subject') A.startInspect(S.sel.inst);
  else if (k === 'b' && S.inspect) A.inspectBay();
  else if (k === 'c' && !S.capture) { A.openCapture(); setTimeout(() => document.querySelector('[data-fk="cap-commit"]')?.focus(), 0); }
  else if (k === 'p') A.startPreview();
  else if (k === '1' && S.stop && !S.inspect) { S.look = 'shot'; S.camAnim = null; }
  else if (k === '2') A.leaveShot();
  else if (k === 'j') S.presenter.open = !S.presenter.open;
  else if (k === '?') S.help = !S.help;
  else if (e.key === 'Enter' && e.target.closest?.('.stop-row')) A.selectStop(e.target.closest('.stop-row').dataset.id);
  else return;
  app.ui();
});
document.addEventListener('keyup', (e) => { app.shift = e.shiftKey; });

// ---- layout ----

const ro = new ResizeObserver(() => app.stage.resize());
ro.observe($('stage'));
window.addEventListener('resize', () => app.stage.resize());

// ---- specimen modes & deep links ----

window.__c1 = { S, app, store, A, D, RUN, JOURNEYS, jumpTo, act };

if (params.get('visitor')) {
  document.body.classList.add('specimen-visitor');
  S.specimen = 'visitor';
}
app.stage.resize();
const j = params.get('j');
if (j) jumpTo(j).then(() => { if (params.get('visitor') && S.mode !== 'preview') { A.startPreview(); } app.ui(); });
else if (params.get('visitor')) { jumpTo('3.6').then(() => { A.startPreview(); app.ui(); }); }
else app.ui();
requestAnimationFrame(frame);
