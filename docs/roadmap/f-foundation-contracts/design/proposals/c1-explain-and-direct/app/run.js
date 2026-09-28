// Preview run: isolated execution state over one accepted snapshot.
//
// A run owns its clock, its channel contributions, visitor inspection, conflicts
// and rejoin. It never writes the project: a held final pose is an owned
// contribution, a visitor's choice is run state, and Restart discards all of it.
// Camera poses come from camera.js; channel blends start from origins captured at
// the transition boundary (not from whatever was last drawn).

import { casingChannel } from './fixture.js';
import { schedule, shotAt, shotPose } from './derive.js';
import { prepare, orbitPose, orbitFrom, blendPose, travelPose, subjectBox } from './camera.js';
import { clamp, lerp, easeInOut, secs, metres } from './util.js';

const BLEND = 0.8; // s — reclaim/release blends, declared by the prototype's performance policy
let seq = 2;

export const CASINGS = ['pumpA.casing', 'pumpB.casing'];

export function createRun(P, expId, { reduced = false } = {}) {
  const R = {
    id: ++seq, expId, P, rev: P.rev,
    stops: P.exp.list[expId].stops.slice(),
    i: 0, t: 0, clock: 0,
    status: 'ready',
    waiting: false,
    reduced,
    ch: {},
    handoff: {},
    stopped: new Set(),
    visitor: { orbit: null, targets: {} },
    conflict: null,
    rejoin: null,
    entry: { from: null },
    lastPose: null,
    look: null,
    summary: null,
    pulse: null,
    label: null,
    log: [],
    fired: new Set(),
  };
  note(R, 'Run #' + R.id + ' prepared on revision ' + R.rev + ' — isolated from the editor and from every other run.', 'run');
  return R;
}

export const occNow = (R) => R.P.occ[R.stops[R.i]];

function note(R, text, kind = 'event') {
  R.log.unshift({ at: R.status === 'ready' ? '—' : 'Stop ' + (R.i + 1) + ' · ' + secs(R.t), text, kind });
  if (R.log.length > 40) R.log.pop();
  if (R.look) R.look.events.push(text);
}

// ---- transport ----

export function play(R) {
  if (R.status === 'ready') { R.status = 'playing'; goStop(R, 0, true); return; }
  if (R.status === 'paused') { R.status = 'playing'; note(R, 'Resumed.'); return; }
  if (R.status === 'ended') return;
}

export function pause(R) {
  if (R.status !== 'playing') return;
  R.status = 'paused';
  note(R, 'Paused. The tour’s camera, opening and words hold; the rotor keeps its own clock.', 'pause');
}

export function next(R) {
  if (R.status === 'looking' || R.status === 'rejoining') return;
  if (R.i >= R.stops.length - 1) { R.status = 'ended'; R.waiting = false; note(R, 'End of the tour.', 'run'); return; }
  if (R.status === 'ready' || R.status === 'paused' || R.status === 'ended') R.status = 'playing';
  goStop(R, R.i + 1);
}

export function prev(R) {
  if (R.status === 'looking' || R.status === 'rejoining') return;
  if (R.status !== 'playing') R.status = 'playing';
  goStop(R, Math.max(0, R.i - 1));
}

function goStop(R, i, first = false) {
  R.entry = { from: first ? null : R.lastPose };
  R.i = i;
  R.t = 0;
  R.waiting = false;
  R.fired = new Set();
  const occ = occNow(R);
  const arrive = occ.beats.find((b) => b.kind === 'shot');
  R.label = { text: R.P.camera.views[arrive?.view]?.name || occ.title, t0: R.clock, travel: arrive?.move === 'travel' };
  note(R, 'Stop ' + (i + 1) + ' · “' + occ.title + '” (occurrence ' + occ.id + ')', 'stop');
}

// ---- clocks ----

export function advance(R, dt) {
  if (R.status === 'playing' || R.status === 'looking' || R.status === 'rejoining') R.clock += dt;
  if (R.status === 'rejoining' && R.clock - R.rejoin.t0 >= R.rejoin.dur) { R.status = 'playing'; R.rejoin = null; }
  if (R.status !== 'playing' || R.waiting) return;
  const occ = occNow(R);
  const sch = schedule(R.P, occ);
  const t0 = R.t;
  R.t = Math.min(sch.length, R.t + dt);
  for (const it of sch.items) fire(R, occ, sch, it, t0);
  if (R.t >= sch.length - 1e-6) {
    if (occ.cont === 'auto') next(R);
    else { R.waiting = true; note(R, 'Waiting for the visitor (this Stop holds until “Next”).', 'hold'); }
  }
}

function fire(R, occ, sch, it, t0) {
  const b = it.beat;
  const startKey = b.id + '@start', endKey = b.id + '@end';
  if (!R.fired.has(startKey) && it.start <= R.t + 1e-6 && (it.start > t0 - 1e-6 || t0 === 0)) {
    R.fired.add(startKey);
    if (b.kind === 'shot' && it !== sch.shots[0]) {
      const say = sch.items.find((x) => x.beat.kind === 'say' && x.start < it.start && x.end > it.start);
      note(R, 'Cut to “' + (R.P.camera.views[b.view]?.name || '?') + '”' + (say ? ' — the words keep playing across it' : '') + '.', 'cut');
    }
    if (b.kind === 'shot' && it.gap) note(R, 'No Camera route for travel here — shown as a cut. Fix before publishing.', 'warn');
    if (b.kind === 'use' && !R.stopped.has(b.id)) {
      note(R, '“' + it.use.def.name + '” starts on ' + R.P.scene.inst[b.subject].name + (it.use.localSpeed ? ' at this use’s ×' + it.use.speed : '') + '.', 'use');
      if (R.reduced) R.pulse = { inst: b.subject, t0: R.clock, text: R.P.scene.inst[b.subject].name + ' casing opened' };
    }
  }
  if (b.kind === 'use' && !R.fired.has(endKey) && it.end <= R.t + 1e-6 && !R.stopped.has(b.id)) {
    R.fired.add(endKey);
    note(R, 'Opening reached its end and is held by the tour — an owned contribution, not a Scene edit.', 'hold');
  }
}

// ---- evaluation ----

function authored(R, occ, sch, c) {
  let v = 0, owner = { kind: 'baseline', key: 'baseline', label: 'Scene baseline' };
  for (const st of occ.states) {
    if (st.ch !== c || R.stopped.has(st.id)) continue;
    v = st.v; owner = { kind: 'state', key: st.id, label: 'Stop ' + (R.i + 1) + ' state “' + st.label + '”' };
  }
  for (const it of sch.items) {
    const b = it.beat;
    if (b.kind !== 'use' || casingChannel(b.subject) !== c || R.stopped.has(b.id) || R.t < it.start - 1e-6) continue;
    const p = it.dur > 0 ? clamp((R.t - it.start) / it.dur) : 1;
    v = R.reduced ? it.use.sep : it.use.sep * easeInOut(p);
    owner = { kind: 'use', key: b.id, p, label: '“' + it.use.def.name + '” · Stop ' + (R.i + 1), sep: it.use.sep };
  }
  return { v, owner };
}

function visitorValue(R, c) {
  const tg = R.visitor.targets[c];
  if (!tg) return R.ch[c]?.v ?? 0;
  const k = R.reduced ? 1 : clamp((R.clock - tg.t0) / BLEND);
  return lerp(tg.from, tg.to, easeInOut(k));
}

export function evaluate(R, world) {
  const occ = occNow(R);
  const sch = schedule(R.P, occ);
  const ch = {};
  const owners = {};
  for (const c of [...CASINGS, 'bay.cutaway']) {
    let tgt = authored(R, occ, sch, c);
    if (R.handoff[c] === 'visitor') tgt = { v: visitorValue(R, c), owner: { kind: 'visitor', key: 'visitor', label: 'You (visitor inspection)' } };
    const st = R.ch[c] || (R.ch[c] = { key: tgt.owner.key, v: tgt.v, blend: null });
    if (st.key !== tgt.owner.key) {
      st.blend = Math.abs(st.v - tgt.v) > 0.005 && !R.reduced ? { from: st.v, t0: R.clock } : null; // origin captured at the boundary
      st.key = tgt.owner.key;
    }
    let v = tgt.v;
    if (st.blend) {
      const k = clamp((R.clock - st.blend.t0) / BLEND);
      v = lerp(st.blend.from, tgt.v, easeInOut(k));
      if (k >= 1) st.blend = null;
    }
    st.v = v;
    ch[c] = v;
    owners[c] = { ...tgt.owner, blending: !!st.blend };
  }

  // Camera: tour shot, visitor free look, or the return between them — all via camera.js.
  const shot = R.status === 'ready' ? sch.shots[0] : shotAt(sch, R.t);
  let tour = R.lastPose;
  let travelling = false;
  if (shot) {
    const moving = shot.route && shot.dur > 0 && R.t < shot.end && R.status !== 'ready' && !R.reduced;
    if (!moving) tour = prepare(R.P, shot.beat.view, sch.ctx);
    else if (shot === sch.shots[0] && R.entry.from) tour = travelPose(shot.points, R.entry.from, prepare(R.P, shot.beat.view, sch.ctx), (R.t - shot.start) / shot.dur);
    else tour = shotPose(R.P, occ, sch, shot, R.t);
    travelling = moving;
  }
  let pose = tour;
  if (R.status === 'looking') pose = orbitPose(R.visitor.orbit);
  else if (R.status === 'rejoining') pose = R.rejoin.dur > 0 ? blendPose(R.rejoin.from, tour, clamp((R.clock - R.rejoin.t0) / R.rejoin.dur)) : tour;
  R.lastPose = pose;

  const sayIt = sch.items.find((i) => i.beat.kind === 'say');
  const say = sayIt ? { text: sayIt.beat.text, p: sayIt.dur > 0 ? clamp((R.t - sayIt.start) / sayIt.dur) : 1, active: R.t >= sayIt.start && R.t < sayIt.end, cutShort: !!sayIt.cutShort, start: sayIt.start, end: sayIt.end } : null;
  const pulse = R.pulse && R.clock - R.pulse.t0 < 1.6 ? { inst: R.pulse.inst, k: 0.5 + 0.5 * Math.sin((R.clock - R.pulse.t0) * 9), text: R.pulse.text } : null;
  return { ch, owners, pose, tour, shot, sch, occ, say, travelling, pulse, world };
}

// ---- visitor inspection, conflicts, rejoin ----

export function lookAround(R) {
  if (R.status !== 'playing' && R.status !== 'paused') return;
  const wasPlaying = R.status === 'playing';
  R.status = 'looking';
  const occ = occNow(R);
  const pivot = occ.subject ? subjectBox(R.P, occ.subject, 'whole', 0).center : R.lastPose.target;
  const pose = { ...R.lastPose, target: pivot };
  R.visitor.orbit = orbitFrom(pose, { guard: true });
  R.look = { t: R.t, clock: R.clock, wasPlaying, events: [], took: {}, stoppedHere: [] };
  note(R, 'You are looking around. The tour paused at ' + secs(R.t) + ' and keeps your place.', 'look');
}

export function orbitVisitor(R, dyaw, dpitch, dzoom = 0) {
  if (R.status !== 'looking') return;
  const o = R.visitor.orbit;
  o.yaw += dyaw;
  o.pitch = clamp(o.pitch + dpitch, -0.15, 1.2);
  o.dist = clamp(o.dist * (1 + dzoom), 1.2, 7.5);
}

export function currentOwner(R, c) {
  const occ = occNow(R);
  return authored(R, occ, schedule(R.P, occ), c).owner;
}

// op: 'open' | 'close'
export function requestCasing(R, inst, op) {
  if (R.status !== 'looking') return { refused: 'Look around first — the tour is showing this.' };
  const c = casingChannel(inst);
  if (R.handoff[c] === 'visitor') { setVisitor(R, c, op); return { ok: true }; }
  const owner = currentOwner(R, c);
  if (owner.kind === 'baseline') {
    R.handoff[c] = 'visitor';
    R.visitor.targets[c] = { from: R.ch[c]?.v ?? 0, to: R.ch[c]?.v ?? 0, t0: R.clock };
    setVisitor(R, c, op);
    return { ok: true };
  }
  R.conflict = { c, inst, op, owner, v: R.ch[c]?.v ?? 0 };
  note(R, 'Conflict: ' + owner.label + ' and your inspection both want ' + R.P.scene.inst[inst].name + '’s casing (exclusive control).', 'conflict');
  return { conflict: true };
}

function setVisitor(R, c, op) {
  const from = R.ch[c]?.v ?? 0;
  const to = op === 'close' ? 0 : op === 'open' ? 0.95 : from;
  R.visitor.targets[c] = { from, to, t0: R.clock };
  const inst = c.split('.')[0];
  if (R.look) R.look.took[c] = { from: R.look.took[c]?.from ?? from, to };
  note(R, 'You ' + (op === 'close' ? 'closed' : 'opened') + ' ' + R.P.scene.inst[inst].name + '’s casing (' + metres(from) + ' → ' + metres(to) + ').', 'visitor');
}

// choice: 'yield' | 'handoff' | 'stop'
export function resolveConflict(R, choice) {
  const k = R.conflict;
  if (!k) return;
  R.conflict = null;
  const name = R.P.scene.inst[k.inst].name;
  if (choice === 'yield') { note(R, 'You left ' + name + '’s casing to the tour. Nothing changed.', 'resolve'); if (R.look) R.look.yielded = true; return; }
  if (choice === 'handoff') {
    R.handoff[k.c] = 'visitor';
    R.visitor.targets[k.c] = { from: k.v, to: k.v, t0: R.clock };
    note(R, 'Handoff: the tour yields ' + name + '’s casing to you from ' + metres(k.v) + ' (captured origin). It takes it back when you rejoin.', 'resolve');
    setVisitor(R, k.c, k.op);
    return;
  }
  if (choice === 'stop') {
    R.stopped.add(k.owner.key);
    if (R.look) R.look.stoppedHere.push(k.owner.label);
    note(R, 'Stopped ' + k.owner.label + ' for this run. The casing returns to the Scene baseline (closed); Restart brings it back.', 'resolve');
  }
}

export function backToTour(R) {
  if (R.status !== 'looking') return;
  const L = R.look;
  const reclaimed = Object.keys(R.handoff).filter((c) => R.handoff[c] === 'visitor');
  const items = [];
  const spun = (R.clock - L.clock).toFixed(1);
  items.push({ k: 'continued', text: 'The rotor kept spinning — world activity on its own clock (' + spun + ' s while you looked).' });
  const occ = occNow(R);
  const sch = schedule(R.P, occ);
  const sayIt = sch.items.find((i) => i.beat.kind === 'say');
  if (sayIt) items.push({ k: 'paused', text: 'The words paused at ' + secs(Math.min(L.t, sayIt.end) - sayIt.start) + ' of ' + secs(sayIt.dur) + ' and resume there.' });
  items.push({ k: 'paused', text: 'The tour’s camera waited; it returns from where you were' + (R.reduced ? ' with a cut (reduced motion).' : ' along a short Camera return.') });
  for (const c of reclaimed) {
    const inst = c.split('.')[0];
    const own = currentOwner(R, c);
    const t = L.took[c];
    items.push({ k: 'rejoin', text: 'You held ' + R.P.scene.inst[inst].name + '’s casing' + (t ? ' (' + metres(t.from) + ' → ' + metres(t.to) + ')' : '') + '. ' + (own.kind === 'baseline' ? 'It returns to the Scene baseline.' : own.label + ' takes it back and blends from where you left it.') });
    delete R.handoff[c];
  }
  for (const s of L.stoppedHere) items.push({ k: 'stopped', text: s + ' stays stopped for the rest of this run.' });
  if (L.yielded && !reclaimed.length && !L.stoppedHere.length) items.push({ k: 'unchanged', text: 'You left the casing to the tour, so it is exactly as the tour had it.' });
  R.visitor.targets = {};
  R.rejoin = { from: R.lastPose, t0: R.clock, dur: R.reduced ? 0 : 1.1 };
  R.status = R.reduced ? 'playing' : 'rejoining';
  if (R.reduced) R.rejoin = null;
  R.summary = { items, at: R.clock };
  R.look = null;
  note(R, 'Back on the tour at ' + secs(R.t) + '.', 'rejoin');
}

export function restart(R, P) {
  const fresh = createRun(P, R.expId, { reduced: R.reduced });
  fresh.status = 'playing';
  goStop(fresh, 0, true);
  note(fresh, 'Fresh run: no choices, handoffs, stops or held poses carried over.', 'run');
  return fresh;
}

export function setReduced(R, on) { R.reduced = on; }

// Who controls what, for the creator's run panel.
export function ownership(R, out) {
  const P = R.P;
  const occ = out.occ;
  const rows = [];
  const cam = R.status === 'looking' ? { who: 'You — free look', state: 'visitor', note: 'Camera profile: free look (guarded to the bay)' }
    : R.status === 'rejoining' ? { who: 'Returning to the tour', state: 'rejoin', note: 'Camera return from your standpoint' }
    : { who: 'Tour — “' + (P.camera.views[out.shot?.beat.view]?.name || '—') + '”', state: R.status === 'playing' ? (out.travelling ? 'travelling' : 'running') : R.status, note: out.shot?.gap ? 'Travel has no route: shown as a cut' : out.shot?.beat.move === 'travel' ? 'Camera route' : 'Cut' };
  rows.push({ what: 'Camera', ...cam });
  for (const c of CASINGS) {
    const o = out.owners[c];
    const inst = c.split('.')[0];
    const stoppedHere = [...R.stopped].some((k) => occ.beats.some((b) => b.id === k && b.subject === inst) || occ.states.some((s) => s.id === k && s.ch === c));
    let state = o.kind === 'visitor' ? 'yours' : o.kind === 'use' ? (o.p >= 1 ? 'held' : R.status === 'playing' ? 'opening' : 'paused') : o.kind === 'state' ? 'held' : stoppedHere ? 'stopped' : 'baseline';
    if (o.blending) state = 'blending';
    rows.push({ what: P.scene.inst[inst].name + ' casing', who: stoppedHere && o.kind === 'baseline' ? 'Scene baseline (tour’s opening stopped)' : o.label, state, note: metres(out.ch[c]) + (o.kind === 'use' ? ' of ' + metres(o.sep) : '') });
  }
  const say = out.say;
  rows.push({ what: 'Words', who: 'Stop ' + (R.i + 1) + ' “' + occ.title + '”', state: !say ? 'none' : R.status === 'playing' && say.active ? 'speaking' : say.p >= 1 ? 'done' : R.status === 'ready' ? 'ready' : 'paused', note: say ? secs(Math.max(0, R.t - say.start)) + ' / ' + secs(say.end - say.start) : '' });
  rows.push({ what: 'Rotor spin', who: 'World — Scene ambient binding', state: R.reduced ? 'still' : 'always', note: R.reduced ? 'Shown still with a “running” label' : 'Own clock; tours never pause it' });
  const cutOwner = out.owners['bay.cutaway'];
  rows.push({ what: 'Bay representation', who: cutOwner.kind === 'baseline' ? 'Layout baseline' : cutOwner.label, state: cutOwner.kind === 'baseline' ? 'baseline' : 'held', note: out.ch['bay.cutaway'] > 0.01 ? 'Cutaway ' + Math.round(out.ch['bay.cutaway'] * 100) + '%' : 'Full building' });
  return rows;
}
