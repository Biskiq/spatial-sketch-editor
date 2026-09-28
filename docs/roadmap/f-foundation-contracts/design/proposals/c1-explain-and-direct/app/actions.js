// Every user action lands here. Session actions change S; document actions become
// typed intents accepted by the store against an expected revision; run actions
// go to the preview runtime. The three never cross.

import { S, app } from './state.js';
import { store, accept, undo, redo, resetStore } from './store.js';
import * as D from './derive.js';
import * as CAM from './camera.js';
import * as RUN from './run.js';
import { casingChannel } from './fixture.js';
import { metres, times, clamp } from './util.js';

export const P = () => store.P;
const now = () => performance.now() / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

// ---- feedback ----

export function toast(text, kind = 'info', ms = 5200) {
  S.toast = { text, kind, until: now() + ms / 1000, id: Math.random() };
}

// ---- session camera ----

// The session camera as it stands now (not the last drawn frame).
export function currentPose() {
  if (S.mode === 'preview') return app.lastPose;
  if (S.camAnim) {
    const a = S.camAnim;
    const k = a.dur > 0 ? clamp((now() - a.t0) / a.dur) : 1;
    return CAM.blendPose(a.from, a.to, k);
  }
  if (S.look === 'shot' && S.stop && !S.inspect && P().occ[S.stop]) {
    const occ = P().occ[S.stop];
    const len = D.schedule(P(), occ).length;
    return D.evalStop(P(), occ, clamp(S.scrub ?? len, 0, len)).pose;
  }
  return CAM.orbitPose(S.orbit);
}

// ---- the whole-Experience ruler (the drawer's Whole lens) ----
// A session-level way to read and scrub an Experience in one motion: it seeks (Stop,
// local time) through the same pure evaluation the Clock lens and the visitor preview
// use, so it writes nothing and invents no second authority. Waiting moments are the
// visitor's gate: the ruler can hold at them (mimicking the run) or play through them.

export function tlAct(name, d = {}) {
  if (S.mode !== 'author') return;
  const tl = D.timeline(P(), S.exp);
  switch (name) {
    case 'play':
      if (S.track.g >= tl.total - 1e-6) S.track.g = 0; // playing from the end restarts
      S.track.playing = true;
      break;
    case 'pause': S.track.playing = false; break;
    case 'toggle': return tlAct(S.track.playing ? 'pause' : 'play');
    case 'hold': S.track.hold = !S.track.hold; break;
    case 'seek': S.track.playing = false; S.track.g = Math.max(0, Number(d.g) || 0); break;
    case 'step': return tlStep(Number(d.dir) || 1);
    default: return;
  }
  tlSync();
}

function tlStep(dir) {
  const tl = D.timeline(P(), S.exp);
  const at = D.timelineAt(tl, S.track.g);
  if (!at) return;
  S.track.playing = false;
  const i = tl.items.indexOf(at.item);
  if (dir < 0) S.track.g = at.t > 0.05 ? at.item.start : (tl.items[Math.max(0, i - 1)] ?? at.item).start;
  else S.track.g = (tl.items[i + 1] ?? null)?.start ?? tl.total;
  tlSync();
}

// Follow the ruler: name the Stop it lands in and seek it to that local time.
function tlSync() {
  const tl = D.timeline(P(), S.exp);
  const at = D.timelineAt(tl, S.track.g);
  if (!at) return;
  S.track.g = at.g;
  S.scrub = at.t;
  if (!S.inspect && S.look !== 'shot') S.look = 'shot';
  // The outline and Stop header follow the ruler, but only when the Stop changes:
  // the per-frame playhead handles everything else, so playing stays cheap.
  if (S.stop !== at.item.occ.id) { S.stop = at.item.occ.id; app.ui(); }
}

// Called from the frame loop while the ruler is playing.
export function tlTick(dt) {
  const st = S.track;
  if (!st.playing || S.mode !== 'author' || S.inspect) return;
  const tl = D.timeline(P(), S.exp);
  if (!tl.total) { st.playing = false; return; }
  const before = D.timelineAt(tl, st.g);
  const next = Math.min(tl.total, st.g + dt);
  const after = D.timelineAt(tl, next);
  if (before && after && after.item !== before.item && st.hold && before.item.waits) {
    st.g = after.item.start; // the waiting moment: exactly where the run stops for the visitor
    st.playing = false;
    toast('Held at the waiting moment of “' + before.item.occ.title + '”. The visitor decides when to go on — restart to play through with Hold off.', 'session');
  } else if (next >= tl.total) {
    st.g = tl.total;
    st.playing = false;
    toast(tl.total.toFixed(1) + ' s played across ' + tl.items.length + ' Stop' + (tl.items.length === 1 ? '' : 's') + '.', 'session');
  } else st.g = next;
  tlSync();
}

export const casual = (name) => name.replace(/^Pump/, 'pump');

export function followPose(viewId, occ) {
  const p = P();
  const v = p.camera.views[viewId];
  const params = CAM.assistedFrom(p, { eye: v.eye, target: v.target, fov: v.fov }, v.subject, 'whole', D.extentOf(p, occ)[v.subject] || 0, v.aim || null);
  const tmp = { ...p, camera: { ...p.camera, views: { ...p.camera.views, __f: { id: '__f', ...params } } } };
  return { params, pose: CAM.prepare(tmp, '__f', { extent: D.extentOf(p, occ) }) };
}

export function flyTo(pose, dur = 0.9, then) {
  const from = currentPose();
  const d = S.motion === 'reduced' || app.shift ? 0 : dur;
  S.camAnim = { from, to: pose, t0: now(), dur: d, then };
  if (d === 0) { S.orbit = CAM.orbitFrom(pose); S.camAnim = null; then?.(); }
}

export function sessionAnim(from, to, dur = 0.8) {
  return { from, to, t0: now(), dur: S.motion === 'reduced' || app.shift ? 0 : dur };
}
export function animValue(a) {
  if (!a) return 0;
  if (a.dur <= 0) return a.to;
  const k = clamp((now() - a.t0) / a.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  return a.from + (a.to - a.from) * e;
}

function leaveShot() {
  if (S.look === 'shot') { S.orbit = CAM.orbitFrom(currentPose()); S.look = 'free'; }
}

// ---- selection ----

export function selectStop(id, { look = true, keepScrub = false } = {}) {
  const occ = P().occ[id];
  if (!occ) return;
  S.exp = occ.exp;
  S.stop = id;
  S.sel = { kind: 'stop', id };
  if (!keepScrub) S.scrub = null;
  if (look) { S.look = 'shot'; S.camAnim = null; }
  S.panel = S.panel === 'review' ? 'review' : 'inspect';
}

export function validateSession() {
  const p = P();
  if (!p.exp.list[S.exp]) S.exp = p.exp.order[0];
  if (S.stop && (!p.occ[S.stop] || p.occ[S.stop].exp !== S.exp)) S.stop = null;
  const s = S.sel;
  if (!s) return;
  const gone =
    (s.kind === 'stop' && !p.occ[s.id]) ||
    ((s.kind === 'beat' || s.kind === 'state') && !p.occ[s.occ]) ||
    (s.kind === 'beat' && p.occ[s.occ] && !p.occ[s.occ].beats.some((b) => b.id === s.id)) ||
    (s.kind === 'state' && p.occ[s.occ] && !p.occ[s.occ].states.some((b) => b.id === s.id)) ||
    (s.kind === 'view' && !p.camera.views[s.id]);
  if (gone) S.sel = S.stop ? { kind: 'stop', id: S.stop } : null;
}

// ---- inspection (session) ----

const INSPECT_SEP = 0.6;

function inspectionPose(inst, sep) {
  const v = { framing: 'assisted', subject: inst, focus: 'casing', az: 50, el: 20, fov: 44, fill: 0.6 };
  const tmp = { ...P(), camera: { ...P().camera, views: { __i: { id: '__i', ...v } } } };
  return CAM.prepare(tmp, '__i', { extent: { [inst]: sep } });
}

export function startInspect(inst) {
  if (S.inspect || S.mode !== 'author') return;
  const origin = currentPose();
  S.inspect = { inst, level: 'casing', origin, originLook: S.look, originOrbit: S.orbit, sepA: sessionAnim(0, INSPECT_SEP, 0.9), cutA: null, closing: false };
  S.look = 'free';
  S.sel = { kind: 'subject', inst, comp: 'casing' };
  S.casingPose = inspectionPose(inst, INSPECT_SEP);
  flyTo(S.casingPose, 1.0);
}

export function inspectBay() {
  const I = S.inspect;
  if (!I || I.closing) return;
  if (I.level === 'bay') return closeBay();
  I.level = 'bay';
  I.cutA = sessionAnim(animValue(I.cutA), 1, 1.0);
  flyTo({ eye: [0.6, 8.4, 9.4], target: [0, 0.3, -0.9], fov: 40 }, 1.2);
}

function closeBay() {
  const I = S.inspect;
  I.level = 'casing';
  I.cutA = sessionAnim(animValue(I.cutA), 0, 0.9);
  flyTo(S.casingPose || inspectionPose(I.inst, INSPECT_SEP), 1.0);
}

export function inspectSep(v) {
  const I = S.inspect;
  if (!I) return;
  I.sepA = { from: v, to: v, t0: now(), dur: 0 };
}

export function endInspect({ silent = false } = {}) {
  const I = S.inspect;
  if (!I || I.closing) return;
  I.closing = true;
  I.sepA = sessionAnim(animValue(I.sepA), 0, 0.8);
  I.cutA = sessionAnim(animValue(I.cutA), 0, 0.8);
  const rev = P().rev;
  const name = P().scene.inst[I.inst].name;
  flyTo(I.origin, 1.0, () => {
    S.inspect = null;
    S.look = I.originLook;
    if (S.look === 'free') S.orbit = CAM.orbitFrom(I.origin);
    if (!silent) toast('Back where you were. Nothing was saved — ' + name + ' is closed and in place, the project is still at revision ' + rev + '.', 'session');
    app.ui();
  });
}

export function inspectBack() {
  const I = S.inspect;
  if (!I) return false;
  if (I.level === 'bay') closeBay(); else endInspect();
  return true;
}

// ---- capture (compound acceptance) ----

export function openCapture() {
  if (S.mode !== 'author') return;
  const p = P();
  const I = S.inspect;
  const inst = I?.inst || (S.sel?.kind === 'subject' ? S.sel.inst : null);
  const sep = I ? r2(animValue(I.sepA)) : 0;
  const cut = I ? animValue(I.cutA) : 0;
  const stops = p.exp.list[S.exp].stops;
  const after = S.stop && stops.includes(S.stop) ? S.stop : stops[0];
  const name = inst ? p.scene.inst[inst].name : 'Standpoint';
  S.capture = {
    expected: p.rev,
    status: 'open',
    pose: currentPose(),
    inst, sep, cut,
    framing: inst ? 'assisted' : 'locked',
    includeCasing: !!inst && sep > 0.02,
    includeCut: cut > 0.5,
    as: 'stop',
    exp: S.exp,
    after,
    title: inst ? 'Inside ' + casual(name) : 'New Stop',
    viewName: inst ? name + ' · open casing' : 'View from here',
    error: null,
  };
}

export function commitCapture() {
  const c = S.capture;
  if (!c) return;
  const p = P();
  let view;
  if (c.framing === 'assisted' && c.inst) view = { name: c.viewName, ...CAM.assistedFrom(p, c.pose, c.inst, 'casing', c.includeCasing ? c.sep : 0) };
  else view = { name: c.viewName, framing: 'locked', subject: c.inst, eye: [...c.pose.eye], target: [...c.pose.target], fov: c.pose.fov, ...(c.inst ? { aim: [...p.scene.inst[c.inst].pos] } : {}) };
  const states = [];
  if (c.includeCasing) states.push({ ch: casingChannel(c.inst), v: r2(c.sep), label: 'Casing open' });
  if (c.includeCut) states.push({ ch: 'bay.cutaway', v: 1, label: 'Bay cutaway' });
  const after = p.exp.list[c.exp].stops.includes(c.after) ? c.after : null;
  const res = accept({ kind: 'captureStop', exp: c.exp, after, view, states, title: c.title, subject: c.inst, makeStop: c.as === 'stop', text: '' }, { expected: c.expected });
  if (!res.ok) { c.status = 'refused'; c.error = res; return res; }
  S.capture = null;
  if (S.inspect) { S.inspect = null; }
  S.camAnim = null;
  if (res.created.occ) {
    selectStop(res.created.occ);
    const pos = D.position(P(), P().occ[res.created.occ]);
    toast('Added Stop ' + (pos.i + 1) + ' “' + c.title + '” and its Camera view “' + c.viewName + '” — one step, revision ' + res.rev + '. Undo removes both.', 'ok');
  } else {
    S.sel = { kind: 'view', id: res.created.view };
    toast('Saved Camera view “' + c.viewName + '” (Camera only).', 'ok');
  }
  return res;
}

export function retryCapture() {
  const c = S.capture;
  if (!c) return;
  c.expected = P().rev;
  c.status = 'open';
  c.error = null;
  return commitCapture();
}

// ---- document intents with feedback ----

export function doc(intent, okText) {
  const res = accept(intent, { expected: P().rev });
  if (!res.ok) { toast((res.errors || ['Refused'])[0], 'refusal', 6500); return res; }
  validateSession();
  if (okText !== false) toast(okText || res.label + ' — revision ' + res.rev + '.', 'ok');
  return res;
}

export function addStopFromView(viewId) {
  const p = P();
  const v = p.camera.views[viewId];
  const visits = v.subject ? D.stopsOf(p, S.exp).filter((o) => o.subject === v.subject).length : 0;
  const title = v.subject ? (visits ? 'Back to ' + casual(p.scene.inst[v.subject].name) : p.scene.inst[v.subject].name) : v.name;
  const after = S.stop && p.exp.list[S.exp].stops.includes(S.stop) ? S.stop : null;
  const res = doc({ kind: 'addStopFromView', exp: S.exp, after, view: viewId, title, move: 'cut' }, false);
  if (res.ok) {
    selectStop(res.created.occ);
    const occ = P().occ[res.created.occ];
    const vi = D.visitInfo(P(), occ);
    toast('Added Stop “' + title + '”' + (vi && vi.of > 1 ? ' — visit ' + vi.n + ' of ' + vi.of + ' to ' + P().scene.inst[occ.subject].name + ', its own occurrence ' + occ.id + ' with its own words.' : '.'), 'ok');
  }
}

export function reuseStop(occId, toExp) {
  const p = P();
  const target = p.exp.list[toExp];
  const res = doc({ kind: 'reuseStop', occ: occId, toExp, after: target.stops[target.stops.length - 1] }, false);
  if (res.ok) toast('Reused in ' + target.name + ' as a new occurrence (' + res.created.occ + ') — same view and performance, its own words and invocation. ' + D.expName(p, S.exp) + ' is unchanged.', 'ok', 7000);
  return res;
}

export function undoAct() {
  if (S.mode !== 'author') return;
  const e = undo();
  if (!e) return;
  validateSession();
  toast('Undone: ' + e.label + (e.domains.length > 1 ? ' — ' + e.domains.join(' + ') + ' together, one step.' : '.'), 'session');
}

export function redoAct() {
  if (S.mode !== 'author') return;
  const e = redo();
  if (!e) return;
  validateSession();
  if (e.created?.occ && P().occ[e.created.occ]) selectStop(e.created.occ);
  toast('Redone: ' + e.label + '.', 'session');
}

// ---- review actions ----

export function followView(viewId, occ) {
  const p = P();
  const v = p.camera.views[viewId];
  const { params } = followPose(viewId, occ);
  const users = D.viewUsers(p, viewId).length;
  return doc({ kind: 'setView', view: viewId, patch: { ...params, eye: null, target: null, aim: null }, label: 'Let “' + v.name + '” follow ' + p.scene.inst[v.subject].name + ' (Camera)' },
    '“' + v.name + '” now follows ' + p.scene.inst[v.subject].name + ' — a Camera change, reaching ' + users + (users === 1 ? ' Stop' : ' Stops') + ' that use this view.');
}

export function reaimView(viewId, occ) {
  const p = P();
  const v = p.camera.views[viewId];
  const { pose } = followPose(viewId, occ);
  return doc({ kind: 'setView', view: viewId, patch: { eye: pose.eye, target: pose.target, aim: [...p.scene.inst[v.subject].pos] }, label: 'Re-aim locked “' + v.name + '” at ' + p.scene.inst[v.subject].name + ' (Camera)' });
}

export function repairUse(occId, beatId) {
  const p = P();
  const occ = p.occ[occId];
  const beat = occ.beats.find((b) => b.id === beatId);
  const was = occ.basis.params[beatId];
  const clear = D.maxClearSep(p, beat.subject);
  const v = was !== undefined && was <= clear ? was : clear;
  const def = p.res.perfs[beat.perf];
  return doc({ kind: 'setBeat', occ: occId, beat: beatId, patch: { over: { separation: v } }, label: 'Use ' + metres(v) + ' for “' + def.name + '” on ' + p.scene.inst[beat.subject].name + ' in “' + occ.title + '” only' },
    'Repaired this use only: ' + metres(v) + ' here. The shared “' + def.name + '” still says ' + metres(def.params.separation) + ' for every other use.');
}

// ---- preview ----

export function startPreview(expId = S.exp) {
  if (S.inspect) { S.inspect = null; S.camAnim = null; }
  S.capture = null;
  S.menu = null;
  S.track.playing = false; // the ruler is authoring preview — the run takes over

  S.mode = 'preview';
  S.exp = expId;
  app.R = RUN.createRun(P(), expId, { reduced: S.motion === 'reduced' });
}

export function exitPreview() {
  if (S.mode !== 'preview') return;
  const id = app.R?.id;
  S.mode = 'author';
  app.R = null;
  toast('Run #' + id + ' discarded. Nothing it did was written — the project is still at revision ' + P().rev + '.', 'session');
}

export function runAct(name, d = {}) {
  const R = app.R;
  if (!R) return;
  switch (name) {
    case 'play': R.status === 'ended' ? (app.R = RUN.restart(R, P())) : RUN.play(R); break;
    case 'pause': RUN.pause(R); break;
    case 'toggle': R.status === 'playing' ? RUN.pause(R) : R.status === 'ended' ? (app.R = RUN.restart(R, P())) : RUN.play(R); break;
    case 'next': RUN.next(R); break;
    case 'prev': RUN.prev(R); break;
    case 'look': RUN.lookAround(R); break;
    case 'back': RUN.backToTour(R); break;
    case 'casing': RUN.requestCasing(R, d.inst, d.op); break;
    case 'resolve': RUN.resolveConflict(R, d.choice); break;
    case 'restart': app.R = RUN.restart(R, P()); break;
    case 'goto': {
      if (R.status === 'ready') RUN.play(R);
      while (R.i < d.i && R.status !== 'ended') RUN.next(R);
      break;
    }
  }
}

// Advance a run deterministically (presenter set-ups).
export function runFor(seconds, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) {
    RUN.advance(app.R, step);
    RUN.evaluate(app.R, S.world);
  }
}

export function setMotion(m) {
  S.motion = m;
  if (app.R) RUN.setReduced(app.R, m === 'reduced');
}

export function resetAll() {
  resetStore();
  Object.assign(S, {
    mode: 'author', exp: 'E-HOW', stop: null, sel: { kind: 'subject', inst: 'pumpA' }, look: 'free', inspect: null, capture: null,
    scrub: null, panel: 'inspect', menu: null, pendingMove: null, pendingPerf: null, camAnim: null, toast: null,
  });
  S.drawer = { open: true, lens: 'beats' };
  S.orbit = CAM.orbitFrom(START_POSE);
  app.R = null;
}

export const START_POSE = { eye: [0.75, 2.05, 3.25], target: [0.35, 0.55, -0.9], fov: 50 };

export { leaveShot, r2, casingChannel, times };
