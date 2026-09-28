// Presenter journeys — OUTSIDE the product. They drive the same actions and
// intents the UI uses, so every step is also a reproducible fixture state
// (?j=4.3 opens straight into it). This is not an authored Experience.

import { S, app } from './state.js';
import { store, accept, occByTitle } from './store.js';
import * as A from './actions.js';
import * as RUN from './run.js';
import { clamp, esc } from './util.js';

const P = () => store.P;
const occ = (title, exp = 'E-HOW') => occByTitle(P(), exp, title);
const viewByName = (name) => Object.values(P().camera.views).find((v) => v.name === name);
const beatOf = (o, pred) => o.beats.find(pred);
const must = (res) => { if (!res?.ok) throw new Error('Journey step refused: ' + JSON.stringify(res)); return res; };
const doc = (intent) => must(accept(intent, { expected: P().rev }));

const TEXT_A = 'Here the casing is opened 60 cm so you can see the impeller. It spins at 1,450 rpm and throws water outward into the spiral casing, which turns speed into pressure.';
const TEXT_B = 'Everything you saw in pump A also happens in pump B, by the east wall. Watch its casing open more slowly — the parts come apart in the same order.';
const TEXT_A2 = 'Back at pump A. Because both pumps share one design, a spare impeller fits either — so one pump keeps running while the other is opened.';
const TEXT_SVC = 'Open pump A fully and check the impeller vanes for wear before closing it again.';

export const JOURNEYS = [
  {
    id: '1', title: 'Inspect & capture',
    steps: [
      { t: 'One pump selected', b: 'Pump A is selected — session state. The viewport is your own camera. “How it works” has only an Introduction and an End so far.', go() { A.resetAll(); } },
      { t: 'Inspect the casing', b: 'Press <kbd>I</kbd> or double-click the pump. The casing opens <b>view only</b>: a dashed ghost shows where it really is, and the strip names the depth. Drag the Opening slider — still nothing is saved.', go() { A.startInspect('pumpA'); } },
      { t: 'Open the bay', b: '<kbd>B</kbd> lifts the roof and cuts the south wall — Layout evaluating a representation parameter, view only. <kbd>Esc</kbd> steps back one level.', go() { A.inspectBay(); } },
      { t: 'Return without saving', b: 'Return puts everything back. The toast confirms Pump A is closed and in place, and the revision has not moved. Inspection is a session, not an edit.', go() { A.endInspect(); } },
      { t: 'Capture: scope first', b: 'Inspect again and press <kbd>C</kbd>. The sheet lists what will be saved and where it goes (a Camera view; the casing state of a new Stop), and what never will: selection, the ghost, how you moved, the rotor.', go() { A.startInspect('pumpA'); A.openCapture(); } },
      { t: 'Captured as one step', b: 'One accepted result: a Camera view <em>and</em> a Stop, revision 15. The Head’s Undo names both; <kbd>⌘Z</kbd> removes both together and <kbd>⇧⌘Z</kbd> brings both back. Notice End now shows <b>✕</b>: it arrives by travel, and Camera has no route from the new view — the insertion revealed a consequence instead of inventing a path.', go() { S.capture.title = 'Inside pump A'; A.commitCapture(); } },
    ],
  },
  {
    id: '2', title: 'Build “How it works”',
    steps: [
      { t: 'Words for the visit', b: 'Stop 2 gets its words. The Stop is still a <b>still moment</b>: a view, one held state (casing open) and words — no timing.', go() { const o = occ('Inside pump A'); doc({ kind: 'editText', occ: o.id, text: TEXT_A, dur: 9 }); A.selectStop(o.id); S.drawer.lens = 'still'; } },
      { t: 'Compare with pump B', b: '“+ Add Stop” from a saved view is an Experience-only change. This Stop starts on pump A (still open) and is about pump B.', go() {
        const a = occ('Inside pump A');
        const v = viewByName('Pump A · open casing');
        const r = doc({ kind: 'addStopFromView', exp: 'E-HOW', after: a.id, view: v.id, subject: 'pumpB', title: 'Compare with pump B' });
        const o = P().occ[r.created.occ];
        doc({ kind: 'editText', occ: o.id, text: TEXT_B, dur: 10 });
        doc({ kind: 'addState', occ: o.id, ch: 'pumpA.casing', v: 0.6, label: 'Pump A casing open' });
        A.selectStop(o.id); S.drawer.lens = 'beats';
      } },
      { t: 'Back to pump A — a second visit', b: 'Same subject, <b>separate occurrence</b> with its own identity and words. The outline says visit 1 of 2 and visit 2 of 2; nothing was copied to fake the return.', go() {
        A.selectStop(occ('Compare with pump B').id);
        A.addStopFromView('V-4');
        const o = occ('Back to pump A');
        doc({ kind: 'editText', occ: o.id, text: TEXT_A2, dur: 9 });
        A.selectStop(o.id);
      } },
    ],
  },
  {
    id: '3', title: 'Reuse & timing',
    steps: [
      { t: 'Grow a state into timing', b: 'Stop 2’s still “Casing open” becomes a use of the reusable <b>“Open casing”</b> performance. The Stop is now timed; its beats appear: shot → use, with the words.', go() {
        const o = occ('Inside pump A');
        const st = o.states.find((s) => s.ch === 'pumpA.casing');
        const r = doc({ kind: 'animateState', occ: o.id, state: st.id, perf: 'P-OPEN' });
        A.selectStop(o.id); S.sel = { kind: 'beat', occ: o.id, id: r.created.beat }; S.drawer.lens = 'beats';
      } },
      { t: 'Cut to pump B while the words play', b: 'A cut inside the Stop at the cue “pump B”. A cut implies no spatial route. The words now run across the cut, so the beat asks you to decide what happens to them.', go() {
        const o = occ('Compare with pump B');
        const say = beatOf(o, (b) => b.kind === 'say');
        doc({ kind: 'addCue', occ: o.id, beat: say.id, name: 'pump B', t: 2.8 });
        const r = doc({ kind: 'addShot', occ: o.id, view: 'V-3', afterBeat: say.id });
        doc({ kind: 'setBeat', occ: o.id, beat: r.created.beat, patch: { rel: 'cue', cue: { beat: say.id, name: 'pump B' } }, label: 'Cut at “pump B”' });
        A.selectStop(o.id); S.sel = { kind: 'beat', occ: o.id, id: say.id }; S.drawer.lens = 'beats';
      } },
      { t: 'Keep speaking across the cut', b: 'The words belong to the Stop, not to a shot, so they continue. The rotor is <b>world activity</b>: shown in every lens, owned by none of them.', go() {
        const o = occ('Compare with pump B');
        const say = beatOf(o, (b) => b.kind === 'say');
        doc({ kind: 'setBeat', occ: o.id, beat: say.id, patch: { crossCut: 'continue' }, label: 'Keep the words playing across the cut in “Compare with pump B”' });
      } },
      { t: 'Reuse the opening on B, slower', b: 'The same definition, a second use. <b>×0.6 is local to this use</b> — the Inspector’s scope switch says so, and the definition still plays 2.4 s for everyone else.', go() {
        const o = occ('Compare with pump B');
        const shotB = beatOf(o, (b) => b.kind === 'shot' && b.view === 'V-3');
        const r = doc({ kind: 'addUse', occ: o.id, perf: 'P-OPEN', subject: 'pumpB', afterBeat: shotB.id });
        doc({ kind: 'setBeat', occ: o.id, beat: r.created.beat, patch: { speed: 0.6 }, label: 'Play “Open casing” at ×0.6 on Pump B (this use only)' });
        A.selectStop(o.id); S.sel = { kind: 'beat', occ: o.id, id: r.created.beat }; S.useScope = 'use'; S.drawer.lens = 'beats';
      } },
      { t: 'Travel needs a route', b: 'Switch that cut to <b>travel</b>: Camera has no route to the newly captured view, so the gap appears in the beat, on the Camera map and in Review. A cut would have been fine.', go() {
        const o = occ('Compare with pump B');
        const shotB = beatOf(o, (b) => b.kind === 'shot' && b.view === 'V-3');
        doc({ kind: 'setBeat', occ: o.id, beat: shotB.id, patch: { move: 'travel' }, label: 'Travel to “Pump B · side” in “Compare with pump B”' });
        const back = occ('Back to pump A');
        doc({ kind: 'setBeat', occ: back.id, beat: beatOf(back, (b) => b.kind === 'shot').id, patch: { move: 'travel' }, label: 'Travel into “Back to pump A”' });
        A.selectStop(o.id); S.sel = { kind: 'beat', occ: o.id, id: shotB.id };
      } },
      { t: 'The same beats on a clock', b: 'Back to a cut. The <b>Clock</b> lens shows the same beats on a Stop-local ruler: drag across a lane to see a moment, drag the end of Pump B’s bar to retime that use only. World activity runs past both edges.', go() {
        const o = occ('Compare with pump B');
        const shotB = beatOf(o, (b) => b.kind === 'shot' && b.view === 'V-3');
        doc({ kind: 'setBeat', occ: o.id, beat: shotB.id, patch: { move: 'cut' }, label: 'Cut to “Pump B · side” in “Compare with pump B”' });
        A.selectStop(o.id); S.drawer.lens = 'clock'; S.scrub = 3.6;
      } },
    ],
  },
  {
    id: '4', title: 'Preview, interrupt, rejoin',
    steps: [
      { t: 'Preview as a visitor', b: 'The frame is the visitor runtime — no selection, history or overlays. The run panel on the right is for you: who controls what, the run states, what happened.', go() { S.drawer.lens = 'beats'; A.startPreview('E-HOW'); A.runAct('play'); A.runAct('next'); A.runFor(1.4); } },
      { t: 'Pause — the world keeps running', b: 'Pause holds what the tour owns: its camera, the opening, the words. The rotor keeps spinning — world activity is not the tour’s to pause.', go() { A.runFor(0.8); A.runAct('pause'); } },
      { t: 'Look around and reach for the casing', b: 'Free look is a Camera profile. Asking to close Pump A’s casing conflicts with the tour’s opening (exclusive control). The visitor chooses: take it over, stop the opening, or leave it.', go() { A.runAct('look'); A.runFor(0.1); A.runAct('casing', { inst: 'pumpA', op: 'close' }); } },
      { t: 'Take it over', b: 'Handoff from the value the tour had reached (captured origin). The casing is now the visitor’s — run state, never a Scene edit.', go() { A.runAct('resolve', { choice: 'handoff' }); A.runFor(1.2); } },
      { t: 'Back to the tour', b: 'The camera returns from where the visitor was; the tour takes the casing back and blends from the visitor’s value; the words resume where they paused. “While you looked around” says what continued and what waited.', go() { A.runAct('back'); A.runFor(1.4); } },
      { t: 'Restart is a fresh run', b: 'A new run: no handoffs, stops or held poses carried over. The Source check still reads the Scene baseline — both casings closed — and the same revision.', go() { A.runAct('restart'); A.runFor(0.5); } },
    ],
  },
  {
    id: '5', title: 'A second Experience',
    steps: [
      { t: 'Reuse in Service check', b: 'Stop 2 reused in <b>Service check</b>: a new occurrence with the same view and the same performance — its own words and invocation. How it works is untouched.', go() {
        if (S.mode === 'preview') A.exitPreview();
        A.reuseStop(occ('Inside pump A').id, 'E-SVC');
        const o = occ('Inside pump A', 'E-SVC');
        A.selectStop(o.id); S.drawer.lens = 'beats';
      } },
      { t: 'Change only this invocation', b: 'Service check opens the casing fully (1.00 m) with different words. The use’s Inspector lists the other uses — How it works keeps its 0.60 m and ×0.6. Switch Experience tabs to see it unaffected.', go() {
        const o = occ('Inside pump A', 'E-SVC');
        const u = beatOf(o, (b) => b.kind === 'use');
        doc({ kind: 'setBeat', occ: o.id, beat: u.id, patch: { over: { separation: 1.0 } }, refresh: true, label: 'Open fully for service (this use only)' });
        doc({ kind: 'editText', occ: o.id, text: TEXT_SVC, dur: 7 });
        A.selectStop(o.id); S.sel = { kind: 'beat', occ: o.id, id: u.id }; S.useScope = 'use';
      } },
    ],
  },
  {
    id: '6', title: 'Revise and repair',
    steps: [
      { t: 'Move pump A — see the reach first', b: 'Typing a new position previews the move and lists every Stop, in both Experiences, that shows Pump A — before anything changes. Moving it is a Scene edit.', go() {
        if (S.mode === 'preview') A.exitPreview();
        S.exp = 'E-HOW'; S.stop = occ('Back to pump A').id; S.look = 'free';
        S.sel = { kind: 'subject', inst: 'pumpA' }; S.pendingMove = { inst: 'pumpA', pos: [-1.6, 0.3] }; S.panel = 'inspect';
      } },
      { t: 'Moved: follow vs locked', b: 'Stop 2’s view follows Pump A (subject-assisted). Stop 4’s <b>locked</b> shot no longer contains it: the reference resolves; the composition doesn’t. Review shows both frames side by side.', go() {
        S.pendingMove = null;
        doc({ kind: 'moveSubject', inst: 'pumpA', pos: [-1.6, 0.3] });
        A.selectStop(occ('Back to pump A').id); S.panel = 'review';
      } },
      { t: 'Change the shared opening', b: 'Editing the definition shows its reach before applying: two uses follow, Service check keeps its own 1.00 m, and Pump B’s use would pass through the east wall.', go() {
        S.panel = 'inspect'; S.sel = { kind: 'perf', id: 'P-OPEN' }; S.pendingPerf = { perf: 'P-OPEN', separation: 0.9 };
      } },
      { t: 'Review what it reached', b: 'Applied. Review lists the locked shot, Pump B’s collision, and Stop 2’s words — written for a 60 cm opening, now showing 90 cm. Every reference still resolves; the words need an editor.', go() {
        S.pendingPerf = null;
        doc({ kind: 'setPerf', perf: 'P-OPEN', patch: { separation: 0.9 } });
        S.panel = 'review';
      } },
      { t: 'Repair one use, keep the definition', b: '“Repair this use only” gives Pump B’s use its own 0.60 m. The shared definition stays 0.90 m for every other use. “Follow Pump A” repairs the locked shot in Camera.', go() {
        const o = occ('Compare with pump B');
        const u = beatOf(o, (b) => b.kind === 'use');
        A.repairUse(o.id, u.id);
        S.panel = 'review';
      } },
      { t: 'A capture that goes stale', b: 'While the capture sheet was open, another writer accepted a change. The capture is rejected whole — no Camera view, no Stop (check the outline and Camera views). Your choices are kept.', go() {
        S.panel = 'inspect'; S.sel = { kind: 'subject', inst: 'pumpB' };
        A.startInspect('pumpB'); A.openCapture(); S.capture.title = 'Pump B seal'; S.capture.viewName = 'Pump B · open casing';
        injectWriter();
        A.commitCapture();
      } },
      { t: 'Captured on the new revision', b: 'Capture again: re-planned against the current revision and accepted as one step on top of the other writer’s change. Undo would remove this view and Stop together.', go() { A.retryCapture(); } },
    ],
  },
];

const FLAT = JOURNEYS.flatMap((j) => j.steps.map((s, i) => ({ ...s, id: j.id + '.' + (i + 1), j: JOURNEYS.indexOf(j), s: i })));

export function injectWriter() {
  const end = occ('End') || occ('Wrap-up');
  const res = accept({ kind: 'renameStop', occ: end.id, title: end.title === 'End' ? 'Wrap-up' : 'End' }, { author: 'Review agent' });
  if (res.ok) A.toast('Another writer (Review agent) accepted: ' + res.label + ' — revision ' + res.rev + '.', 'session', 6000);
}

export async function jumpTo(id) {
  const idx = FLAT.findIndex((s) => s.id === id);
  if (idx < 0) return;
  app.shift = true;
  try {
    A.resetAll();
    for (let i = 0; i <= idx; i++) FLAT[i].go();
  } catch (e) { console.error(e); }
  app.shift = false;
  S.presenter.at = id;
  S.presenter.j = FLAT[idx].j;
  S.presenter.s = FLAT[idx].s;
  app.ui();
}

function stepNext(dir) {
  const cur = FLAT.findIndex((s) => s.j === S.presenter.j && s.s === S.presenter.s);
  const nxt = FLAT[cur + dir];
  if (!nxt) return;
  if (dir === 1 && S.presenter.at === FLAT[cur].id) {
    try { nxt.go(); S.presenter.at = nxt.id; } catch (e) { console.error(e); jumpTo(nxt.id); }
    S.presenter.j = nxt.j; S.presenter.s = nxt.s;
  } else jumpTo(nxt.id);
}

export function presenterAct(name, d) {
  switch (name) {
    case 'presenter': S.presenter.open = !S.presenter.open; return true;
    case 'j-close': S.presenter.open = false; return true;
    case 'j-tab': S.presenter.j = Number(d.j); S.presenter.s = 0; return true;
    case 'j-dot': S.presenter.s = Number(d.s); return true;
    case 'j-next': stepNext(1); return true;
    case 'j-prev': stepNext(-1); return true;
    case 'j-setup': jumpTo(JOURNEYS[S.presenter.j].id + '.' + (S.presenter.s + 1)); return true;
    case 'reset': A.resetAll(); S.presenter.at = null; A.toast('Fixture reset to revision 14.', 'session'); return true;
    case 'inject-writer': injectWriter(); return true;
    case 'inject-invalid': store.inject = { kind: 'invalid' }; A.toast('Presenter: the next capture will fail Camera validation.', 'session'); return true;
  }
  return false;
}

// The Presenter is a review tool that floats over the product, so it must not
// sit in the way: drag it by its header (double-click the header to dock it back
// bottom-left). The position is session state and survives toggling and re-renders.

let pdrag = null;

function clampPos(el, x, y) {
  return {
    x: clamp(x, 0, Math.max(0, window.innerWidth - el.offsetWidth)),
    y: clamp(y, 0, Math.max(0, window.innerHeight - el.offsetHeight)),
  };
}

function applyPresenterPos(el) {
  const pos = S.presenter.pos;
  if (!pos) { el.style.left = ''; el.style.top = ''; el.style.bottom = ''; return; }
  const c = clampPos(el, pos.x, pos.y);
  el.style.left = c.x + 'px';
  el.style.top = c.y + 'px';
  el.style.bottom = 'auto';
}

function setupPresenterDrag(el) {
  if (el.dataset.dragBound) return;
  el.dataset.dragBound = '1';
  el.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('.pr-head');
    if (!head || e.target.closest('button')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    pdrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (!pdrag) return;
    const c = clampPos(el, e.clientX - pdrag.dx, e.clientY - pdrag.dy);
    S.presenter.pos = c;
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.style.bottom = 'auto';
  });
  const end = (e) => {
    if (!pdrag) return;
    pdrag = null;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('.pr-head') && !e.target.closest('button')) { S.presenter.pos = null; applyPresenterPos(el); }
  });
  window.addEventListener('resize', () => { if (S.presenter.open && S.presenter.pos) applyPresenterPos(el); });
}

export function renderPresenter() {
  const el = document.getElementById('presenter');
  const tog = document.getElementById('pToggle');
  setupPresenterDrag(el);
  el.hidden = !S.presenter.open;
  tog.hidden = S.presenter.open || S.specimen === 'visitor';
  applyPresenterPos(el);
  if (!S.presenter.open) return;
  const j = JOURNEYS[S.presenter.j];
  const s = j.steps[S.presenter.s];
  const id = j.id + '.' + (S.presenter.s + 1);
  const here = S.presenter.at === id;
  el.innerHTML = `
    <div class="pr-head"><span class="pr-out">Presenter · outside the product <i class="pr-drag">drag to move</i></span><button class="pr-x" data-act="j-close" aria-label="Close presenter">×</button></div>
    <div class="pr-tabs" role="tablist">${JOURNEYS.map((x, i) => `<button role="tab" aria-selected="${i === S.presenter.j}" class="${i === S.presenter.j ? 'on' : ''}" data-act="j-tab" data-j="${i}">${x.id}<span>${esc(x.title)}</span></button>`).join('')}</div>
    <div class="pr-kicker">Journey ${j.id} · step ${S.presenter.s + 1} of ${j.steps.length} · <span class="mono">?j=${id}</span>${here ? ' · <b>you are here</b>' : ''}</div>
    <div class="pr-title">${esc(s.t)}</div>
    <div class="pr-body">${s.b}</div>
    <div class="pr-nav">
      <button class="pr-b" data-act="j-prev" aria-label="Previous step">‹</button>
      <div class="pr-dots">${j.steps.map((_, i) => `<button class="${i === S.presenter.s ? 'on' : ''}" data-act="j-dot" data-s="${i}" aria-label="Step ${i + 1}"></button>`).join('')}</div>
      <button class="pr-b" data-act="j-setup">${here ? 'Set up again' : 'Set up this state'}</button>
      <button class="pr-b next" data-act="j-next">Next ›</button>
    </div>
    <div class="pr-tools"><span>Simulate:</span><button data-act="inject-writer">Another writer edits</button><button data-act="inject-invalid">Next capture fails</button><button data-act="reset">Reset fixture</button></div>`;
}
