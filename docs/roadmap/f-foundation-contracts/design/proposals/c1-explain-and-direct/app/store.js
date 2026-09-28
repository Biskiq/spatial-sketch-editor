// Accepted source and its history — a simulation of F.4 compound acceptance.
//
// Every document change is a typed, serializable intent accepted against ONE
// expected revision: plan on a draft → validate across the affected domains →
// accept all of it (one revision, one Undo result) or none of it. Temporary
// inspection, selection, capture drafts and preview runs never come through here.
//
// Prototype shortcut (do not copy): history is whole-project JSON snapshots.

import { freshProject } from './fixture.js';
import { clone, metres, times } from './util.js';
import { basisOf, stopsOf, useInfo } from './derive.js';

export const store = {
  P: freshProject(),
  undo: [],
  redo: [],
  inject: null, // presenter-only: { kind: 'invalid' } makes the next capture fail validation
  listeners: new Set(),
};

const emit = () => { for (const f of store.listeners) f(); };
export const onChange = (f) => store.listeners.add(f);

export function resetStore() {
  store.P = freshProject();
  store.undo = [];
  store.redo = [];
  store.inject = null;
  emit();
}

export function accept(intent, { expected, author = 'You' } = {}) {
  const P = store.P;
  if (expected !== undefined && expected !== P.rev) {
    const since = store.undo.filter((e) => e.rev > expected);
    return { ok: false, reason: 'stale', expected, current: P.rev, since: since.map((e) => ({ label: e.label, author: e.author })) };
  }
  const plan = PLANNERS[intent.kind];
  if (!plan) throw new Error('No planner for ' + intent.kind);
  const draft = clone(P);
  const alloc = (prefix) => prefix + '-' + draft.nextId++;
  const out = plan(draft, intent, alloc);
  if (!out || out.error) return { ok: false, reason: 'invalid', errors: [out?.error || 'Planner refused the intent'] };
  const errors = validate(draft);
  if (errors.length) return { ok: false, reason: 'invalid', errors };
  draft.rev = P.rev + 1;
  store.undo.push({ label: out.label, domains: out.domains, before: P, after: draft, rev: draft.rev, author, kind: intent.kind, created: out.created || null });
  store.redo = [];
  store.P = draft;
  emit();
  return { ok: true, rev: draft.rev, ...out };
}

export function undo() {
  const e = store.undo.pop();
  if (!e) return null;
  const restored = clone(e.before);
  restored.rev = store.P.rev + 1;
  restored.nextId = Math.max(restored.nextId, store.P.nextId); // identities are never re-issued
  store.redo.push(e);
  store.P = restored;
  emit();
  return e;
}

export function redo() {
  const e = store.redo.pop();
  if (!e) return null;
  const restored = clone(e.after);
  restored.rev = store.P.rev + 1;
  restored.nextId = Math.max(restored.nextId, store.P.nextId);
  store.undo.push({ ...e, rev: restored.rev });
  store.P = restored;
  emit();
  return e;
}

// ---- cross-domain validation (F.4 step 4) ----

function validate(P) {
  const errs = [];
  const seen = new Set();
  for (const expId of P.exp.order) {
    const exp = P.exp.list[expId];
    if (!exp) { errs.push('Experience ' + expId + ' is missing'); continue; }
    for (const id of exp.stops) {
      if (!P.occ[id]) errs.push('Stop ' + id + ' is listed but does not exist');
      if (seen.has(id)) errs.push('Occurrence ' + id + ' appears twice — occurrences are never shared');
      seen.add(id);
    }
  }
  for (const o of Object.values(P.occ)) {
    if (!seen.has(o.id)) continue;
    if (!o.beats.some((b) => b.kind === 'shot')) errs.push('Stop “' + o.title + '” has no shot');
    for (const b of o.beats) {
      if (b.kind === 'shot' && !P.camera.views[b.view]) errs.push('Stop “' + o.title + '” refers to a missing Camera view');
      if (b.kind === 'use' && !P.res.perfs[b.perf]) errs.push('Stop “' + o.title + '” uses a missing performance');
      if (b.kind === 'use' && !P.scene.inst[b.subject]) errs.push('Stop “' + o.title + '” binds a missing subject');
    }
  }
  for (const r of Object.values(P.camera.routes)) if (!P.camera.views[r.a] || !P.camera.views[r.b]) errs.push('Route ' + r.id + ' has a missing end');
  return errs;
}

// ---- planners: one deterministic function of (expected revision, intent) ----

const occOf = (P, id) => P.occ[id];
const beatOf = (occ, id) => occ.beats.find((b) => b.id === id);
const refresh = (P, occ) => { occ.basis = basisOf(P, occ); };

function insertAfter(list, id, afterId) {
  const i = afterId ? list.indexOf(afterId) : list.length - 1;
  list.splice(i + 1, 0, id);
}

const PLANNERS = {
  // Capture: Camera view + (optionally) its Stop, as ONE accepted result.
  captureStop(P, it, alloc) {
    if (store.inject?.kind === 'invalid') {
      store.inject = null;
      return { error: 'Camera refused the view: the standpoint is inside wall W-E (Layout). No part of this capture was applied.' };
    }
    const vid = alloc('V');
    P.camera.views[vid] = { id: vid, ...clone(it.view) };
    if (!it.makeStop) return { label: 'Save Camera view “' + it.view.name + '”', domains: ['Camera'], created: { view: vid } };
    const oid = alloc('OCC');
    const occ = {
      id: oid, exp: it.exp, title: it.title, subject: it.subject || null, cont: 'hold',
      beats: [
        { id: alloc('B'), kind: 'shot', view: vid, move: 'cut', rel: 'start' },
        { id: alloc('B'), kind: 'say', rel: 'with', dur: it.dur || 8, cues: [], text: it.text || '' },
      ],
      states: (it.states || []).map((s) => ({ id: alloc('S'), ...s })),
      basis: { params: {}, pos: {} }, ack: {},
    };
    P.occ[oid] = occ;
    insertAfter(P.exp.list[it.exp].stops, oid, it.after);
    refresh(P, occ);
    return { label: 'Add Stop “' + it.title + '” with its Camera view', domains: ['Camera', 'Experience'], created: { view: vid, occ: oid } };
  },

  addStopFromView(P, it, alloc) {
    const v = P.camera.views[it.view];
    if (!v) return { error: 'That view no longer exists' };
    const oid = alloc('OCC');
    const occ = {
      id: oid, exp: it.exp, title: it.title, subject: it.subject !== undefined ? it.subject : v.subject || null, cont: 'hold',
      beats: [
        { id: alloc('B'), kind: 'shot', view: it.view, move: it.move || 'cut', rel: 'start' },
        { id: alloc('B'), kind: 'say', rel: 'then', dur: it.dur || 7, cues: [], text: it.text || '' },
      ],
      states: [], basis: { params: {}, pos: {} }, ack: {},
    };
    P.occ[oid] = occ;
    insertAfter(P.exp.list[it.exp].stops, oid, it.after);
    refresh(P, occ);
    return { label: 'Add Stop “' + it.title + '”', domains: ['Experience'], created: { occ: oid } };
  },

  removeStop(P, it) {
    const occ = occOf(P, it.occ);
    const list = P.exp.list[occ.exp].stops;
    list.splice(list.indexOf(occ.id), 1);
    delete P.occ[occ.id];
    return { label: 'Remove Stop “' + occ.title + '”', domains: ['Experience'] };
  },

  moveStop(P, it) {
    const occ = occOf(P, it.occ);
    const list = P.exp.list[occ.exp].stops;
    const i = list.indexOf(occ.id), j = i + it.dir;
    if (j < 0 || j >= list.length) return { error: 'Already at the ' + (it.dir < 0 ? 'start' : 'end') };
    list.splice(i, 1);
    list.splice(j, 0, occ.id);
    return { label: 'Move Stop “' + occ.title + '” ' + (it.dir < 0 ? 'earlier' : 'later'), domains: ['Experience'] };
  },

  renameStop(P, it) {
    const occ = occOf(P, it.occ);
    const was = occ.title;
    occ.title = it.title;
    return { label: 'Rename Stop “' + was + '” → “' + it.title + '”', domains: ['Experience'] };
  },

  editText(P, it) {
    const occ = occOf(P, it.occ);
    const say = occ.beats.find((b) => b.kind === 'say');
    say.text = it.text;
    if (it.dur) say.dur = it.dur;
    refresh(P, occ);
    return { label: 'Edit the words of “' + occ.title + '”', domains: ['Experience'] };
  },

  setCont(P, it) {
    const occ = occOf(P, it.occ);
    occ.cont = it.cont;
    return { label: (it.cont === 'hold' ? 'Wait for the visitor' : 'Continue after the words') + ' at “' + occ.title + '”', domains: ['Experience'] };
  },

  // Grow a still state into timed behaviour: the state becomes a use of a reusable performance.
  animateState(P, it, alloc) {
    const occ = occOf(P, it.occ);
    const st = occ.states.find((s) => s.id === it.state);
    const def = P.res.perfs[it.perf];
    if (!st || !def) return { error: 'Nothing to animate' };
    occ.states = occ.states.filter((s) => s !== st);
    const inst = st.ch.split('.')[0];
    const beat = { id: alloc('B'), kind: 'use', perf: def.id, subject: inst, speed: 1, over: {}, rel: 'then' };
    if (Math.abs(st.v - def.params.separation) > 1e-3) beat.over.separation = st.v;
    const shotIdx = occ.beats.findIndex((b) => b.kind === 'shot');
    occ.beats.splice(shotIdx + 1, 0, beat);
    const say = occ.beats.find((b) => b.kind === 'say');
    if (say && occ.beats.indexOf(say) === shotIdx + 2) say.rel = 'with';
    refresh(P, occ);
    return { label: 'Animate “' + st.label + '” with “' + def.name + '”', domains: ['Experience'], created: { beat: beat.id } };
  },

  addState(P, it, alloc) {
    const occ = occOf(P, it.occ);
    occ.states.push({ id: alloc('S'), ch: it.ch, v: it.v, label: it.label });
    refresh(P, occ);
    return { label: 'Hold “' + it.label + '” at “' + occ.title + '”', domains: ['Experience'] };
  },

  removeState(P, it) {
    const occ = occOf(P, it.occ);
    const st = occ.states.find((s) => s.id === it.state);
    occ.states = occ.states.filter((s) => s.id !== it.state);
    refresh(P, occ);
    return { label: 'Remove “' + (st?.label || 'state') + '” from “' + occ.title + '”', domains: ['Experience'] };
  },

  addUse(P, it, alloc) {
    const occ = occOf(P, it.occ);
    const def = P.res.perfs[it.perf];
    const beat = { id: alloc('B'), kind: 'use', perf: it.perf, subject: it.subject, speed: it.speed ?? 1, over: it.over || {}, rel: it.rel || 'then' };
    const at = it.afterBeat ? occ.beats.findIndex((b) => b.id === it.afterBeat) + 1 : occ.beats.length;
    occ.beats.splice(at, 0, beat);
    refresh(P, occ);
    return { label: 'Use “' + def.name + '” on ' + P.scene.inst[it.subject].name + ' in “' + occ.title + '”' + (beat.speed !== 1 ? ' at ' + times(beat.speed) : ''), domains: ['Experience'], created: { beat: beat.id } };
  },

  // A cut inside a Stop: no spatial route is implied.
  addShot(P, it, alloc) {
    const occ = occOf(P, it.occ);
    const beat = { id: alloc('B'), kind: 'shot', view: it.view, move: 'cut', rel: it.rel || 'then' };
    if (it.cue) beat.cue = it.cue;
    const at = it.afterBeat ? occ.beats.findIndex((b) => b.id === it.afterBeat) + 1 : occ.beats.length;
    occ.beats.splice(at, 0, beat);
    refresh(P, occ);
    return { label: 'Cut to “' + P.camera.views[it.view].name + '” in “' + occ.title + '”', domains: ['Experience'], created: { beat: beat.id } };
  },

  addCue(P, it) {
    const occ = occOf(P, it.occ);
    const b = beatOf(occ, it.beat);
    b.cues = [...(b.cues || []).filter((c) => c.name !== it.name), { name: it.name, t: it.t }];
    return { label: 'Mark “' + it.name + '” in the words of “' + occ.title + '”', domains: ['Experience'] };
  },

  setBeat(P, it) {
    const occ = occOf(P, it.occ);
    const b = beatOf(occ, it.beat);
    if (!b) return { error: 'That beat no longer exists' };
    for (const [k, v] of Object.entries(it.patch)) {
      if (k === 'over') b.over = { ...(b.over || {}), ...v };
      else if (v === null) delete b[k];
      else b[k] = v;
    }
    if (b.over) for (const k of Object.keys(b.over)) if (b.over[k] === null) delete b.over[k];
    if (it.refresh) refresh(P, occ);
    return { label: it.label || 'Change a beat in “' + occ.title + '”', domains: ['Experience'] };
  },

  removeBeat(P, it) {
    const occ = occOf(P, it.occ);
    const b = beatOf(occ, it.beat);
    if (b?.kind === 'shot' && occ.beats.filter((x) => x.kind === 'shot').length === 1) return { error: 'A Stop needs at least one shot' };
    occ.beats = occ.beats.filter((x) => x.id !== it.beat);
    for (const x of occ.beats) if (x.cue?.beat === it.beat) { delete x.cue; x.rel = 'then'; }
    refresh(P, occ);
    return { label: 'Remove a beat from “' + occ.title + '”', domains: ['Experience'] };
  },

  // Camera-owned edits.
  setView(P, it) {
    const v = P.camera.views[it.view];
    if (!v) return { error: 'That view no longer exists' };
    for (const k of ['eye', 'target', 'aim', 'az', 'el', 'fill', 'focus']) if (it.patch[k] === null) delete v[k];
    Object.assign(v, Object.fromEntries(Object.entries(it.patch).filter(([, x]) => x !== null)));
    return { label: it.label || 'Change Camera view “' + v.name + '”', domains: ['Camera'] };
  },

  addRoute(P, it, alloc) {
    const id = alloc('R');
    P.camera.routes[id] = { id, a: it.a, b: it.b, via: it.via || [] };
    return { label: 'Add Camera route “' + P.camera.views[it.a].name + '” ↔ “' + P.camera.views[it.b].name + '”', domains: ['Camera'] };
  },

  // Resource-owned edit: the shared definition, reaching every use that doesn't override it.
  setPerf(P, it) {
    const def = P.res.perfs[it.perf];
    if (it.patch.separation !== undefined) def.params.separation = it.patch.separation;
    if (it.patch.duration !== undefined) def.duration = it.patch.duration;
    def.rev += 1;
    return { label: 'Change shared “' + def.name + '”: ' + (it.patch.separation !== undefined ? 'separation ' + metres(it.patch.separation) : 'duration ' + it.patch.duration + ' s'), domains: ['Resource'] };
  },

  // Scene-owned edit: the world every Experience shows.
  moveSubject(P, it) {
    const inst = P.scene.inst[it.inst];
    inst.pos = [...it.pos];
    return { label: 'Move ' + inst.name + ' (Scene)', domains: ['Scene'] };
  },

  // Reuse an occurrence's bindings in another Experience: a NEW occurrence, same view/performance.
  reuseStop(P, it, alloc) {
    const src = occOf(P, it.occ);
    const oid = alloc('OCC');
    const beats = src.beats.map((b) => {
      const nb = { ...clone(b), id: alloc('B') };
      if (nb.kind === 'use') { nb.speed = 1; nb.over = {}; }
      if (nb.cue) { delete nb.cue; nb.rel = 'then'; }
      return nb;
    });
    const occ = { id: oid, exp: it.toExp, title: src.title, subject: src.subject, cont: 'hold', beats, states: clone(src.states), basis: { params: {}, pos: {} }, ack: {}, reusedFrom: src.id };
    P.occ[oid] = occ;
    insertAfter(P.exp.list[it.toExp].stops, oid, it.after);
    refresh(P, occ);
    return { label: 'Reuse “' + src.title + '” in ' + P.exp.list[it.toExp].name, domains: ['Experience'], created: { occ: oid } };
  },

  markReviewed(P, it) {
    const occ = occOf(P, it.occ);
    refresh(P, occ);
    return { label: 'Mark “' + occ.title + '” reviewed', domains: ['Experience'] };
  },

  ack(P, it) {
    const occ = occOf(P, it.occ);
    occ.ack[it.key] = true;
    return { label: it.label || 'Keep as authored', domains: ['Experience'] };
  },
};

// Convenience used by the presenter: find an occurrence by title within an Experience.
export function occByTitle(P, expId, title) {
  return stopsOf(P, expId).find((o) => o.title === title) || null;
}

export function describeUse(P, beat) {
  const u = useInfo(P, beat);
  return u.def.name + ' · ' + P.scene.inst[beat.subject].name + (u.localSpeed ? ' · ' + times(u.speed) : '') + (u.localSep ? ' · ' + metres(u.sep) : '');
}
