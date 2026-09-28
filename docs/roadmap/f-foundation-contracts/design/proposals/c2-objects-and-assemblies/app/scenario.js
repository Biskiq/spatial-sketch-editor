// The presenter: the brief's six-step scenario with direct access to every important
// state. It is OUTSIDE the product — it drives the same actions a creator would.
import * as THREE from 'three';
import { S, P, D, emit, resetStore } from './state.js';
import * as A from './actions.js';
import { compileLayout, checkHang } from './model.js';
import { esc } from './ui.js';

const $ = (id) => document.getElementById(id);
const ids = { lamp: 'U-7K2F', relief: 'U-3R8T', plinth: 'U-P5L2', a: 'U-A4D1', b: 'U-B7Q2' };

function instant(fn) {
  const was = S._instant;
  S._instant = true;
  try { fn(); } finally { S._instant = was; }
}
function importNow(src, at) {
  A.startIntake(src);
  if (S.instr?.kind === 'intake') { S.instr.phase = 'ready'; if (at) S.instr.at = at; }
  A.commitIntake();
}

// Canonical completions, used to set up any step directly.
const DONE = {
  1: () => { importNow('lamp', [-1.1, 0, -0.7]); importNow('relief', [1.3, 0, -0.9]); },
  2: () => {
    A.addNative('N-PLINTH', [-1.9, 0, -1.72]);
    A.moveUse(ids.lamp, [-1.9, 0.72, -1.72], 0.25, 'Rest Desk light on the plinth (placement only)');
    A.makeReusable([ids.lamp, ids.plinth], 'Display light');
    A.duplicateUse(ids.a);
    A.setValue(ids.b, 'lamp/slot.finish', 'black', 'use');
    A.setValue(ids.b, 'lamp/a.tilt', 50, 'use');
    A.groupUses([ids.a, ids.relief]);
  },
  3: () => {
    A.openInspect(ids.a);
    A.setValue(ids.a, 'lamp/slot.glass', 'clear', 'use');
    A.closeInspect();
    S.summary = null;
  },
  4: () => {
    A.addBay();
    A.hangAt(ids.b, 'W-FJSK', 2.3, 1.0);
    A.wallMoveStart('W-FJSK');
    A.wallMoveSet(-0.5);
    A.wallMoveCommit();
    A.setMode('arrange');
  },
  5: () => {
    A.offerRevision('D-DK12', 2);
    A.openReview('D-DK12');
    A.reviewChoose(`${ids.a}|lamp/slot.glass`, 'drop');
    A.reviewChoose(`${ids.b}|lamp/a.tilt`, 'clamp');
    A.acceptReview();
  },
  6: () => {},
};

export const STEPS = [
  {
    n: 1, title: 'Import truthfully', kicker: 'Begin with one object — no room first',
    tasks: [
      { t: 'Import <b class="mono">desk-lamp.glb</b> and read what arrived', run: () => { A.startIntake('lamp'); } },
      { t: 'Add it to the project and place one use', run: () => { if (S.instr?.kind !== 'intake') A.startIntake('lamp'); S.instr.phase = 'ready'; S.instr.at = [-1.1, 0, -0.7]; A.commitIntake(); } },
      { t: 'Import <b class="mono">tide-relief.glb</b> — a flat model — and add it', run: () => { if (D().defs['D-TR05']) return; importNow('relief', [1.3, 0, -0.9]); } },
      { t: 'Double-click the relief: it can’t be entered', run: () => { A.select({ kind: 'use', id: ids.relief, path: [] }); A.descend({ use: ids.relief, path: [] }, null); } },
    ],
    notice: [
      'The card separates <b>Supported</b>, <b>Found, not active</b> and <b>Not supported</b>. The clip is kept but not bound — nothing plays because it was imported.',
      'Source and provenance are one disclosure away. Retention is labelled simulated.',
      'The flat relief is still useful as a whole object; its mesh names never become parts.',
    ],
  },
  {
    n: 2, title: 'Compose, place two uses', kicker: 'Definition, use, component, group',
    tasks: [
      { t: 'Add a plinth, then drag the lamp onto it — it <i>rests</i> there (placement, not attachment)', run: () => { A.addNative('N-PLINTH', [-1.9, 0, -1.72]); A.moveUse(ids.lamp, [-1.9, 0.72, -1.72], 0.25, 'Rest Desk light on the plinth (placement only)'); A.select({ kind: 'use', id: ids.lamp, path: [] }); A.select({ kind: 'use', id: ids.plinth, path: [] }, { add: true }); } },
      { t: 'With both selected (Shift-click), <b>Make reusable</b> “Display light”', run: () => { if (S._instant) A.makeReusable([ids.lamp, ids.plinth], 'Display light'); else A.openMakeReusable([ids.lamp, ids.plinth]); } },
      { t: 'Place another use <kbd>⌘D</kbd>', run: () => { A.duplicateUse(ids.a); } },
      { t: 'Pick the <b>second</b> light’s shade in the viewport; set Matte black for this use', run: () => { A.select({ kind: 'use', id: ids.b, path: ['lamp', 'p.shade'] }); A.setValue(ids.b, 'lamp/slot.finish', 'black', 'use'); A.frameSel(); } },
      { t: 'Select its Arm; set the tilt to 50° for this use', run: () => { A.select({ kind: 'use', id: ids.b, path: ['lamp', 'p.arm'] }); A.setValue(ids.b, 'lamp/a.tilt', 50, 'use'); } },
      { t: 'Group the first light with the relief — it only organizes', run: () => { A.groupUses([ids.a, ids.relief]); } },
    ],
    notice: [
      '<b>Make reusable</b> and <b>Group</b> are offered side by side with different consequences.',
      'Both lights are named “Display light”: the reference, the place and the viewport highlight keep them apart.',
      'Hover a finish before clicking: the viewport shows the value <i>and</i> which uses it would reach.',
    ],
  },
  {
    n: 3, title: 'Inspect, then edit on purpose', kicker: 'View-only separation vs accepted edits vs runtime preview',
    tasks: [
      { t: 'Inspect the first light <kbd>I</kbd> — parts separate, view only', run: () => { A.openInspect(ids.a); } },
      { t: 'Select the Diffuser (now visible); set Clear glass for this use', run: () => { if (S.instr?.kind !== 'inspect') A.openInspect(ids.a); A.select({ kind: 'use', id: ids.a, path: ['lamp', 'p.diffuser'] }); A.setValue(ids.a, 'lamp/slot.glass', 'clear', 'use'); } },
      { t: 'Come back <kbd>Esc</kbd> — read the return summary', run: () => { A.closeInspect(); } },
      { t: 'Try the articulation <kbd>P</kbd>, drag it, then end the preview', run: () => { A.openPreview(ids.a); A.previewSet(47); } },
    ],
    notice: [
      'The separation disappears on return; the glass change stays, listed with its own Undo.',
      'The preview arc shows the declared limits, the baseline and the running pose. Ending it writes nothing.',
      '<b>Keep this pose…</b> is the only way a previewed pose becomes authored — with a stated scope.',
    ],
  },
  {
    n: 4, title: 'Architecture enters; hang one light', kicker: 'Layout stays Layout. Proximity is not attachment.',
    tasks: [
      { t: 'Add the prepared bay (Layout)', run: () => { A.addBay(); } },
      { t: 'Try to hang the second light across the window', run: () => { A.startHang(ids.b); const C = compileLayout(D().layout); S.instr.cand = { wall: 'W-FJSK', s: 3.9, h: 1.0, chk: checkHang(C, 'W-FJSK', 3.9, 1.0, S.instr.mount) }; A.hangCommit(); emit('ui'); } },
      { t: 'Hang it on solid wall', run: () => { A.hangAt(ids.b, 'W-FJSK', 2.3, 1.0); } },
      { t: 'Layout mode: move the back wall 0.5 m back', run: () => { A.wallMoveStart('W-FJSK'); A.wallMoveSet(-0.5); A.wallMoveCommit(); } },
      { t: 'Try removing the back wall — then Cancel', run: () => { A.openRemoveWall('W-FJSK'); } },
    ],
    notice: [
      'Adding architecture re-parents nothing: objects stay world-local, and the Navigator lists Layout separately.',
      'The hung light follows the wall; the light merely near it stays. History records the wall move as <b>Layout</b> only.',
      'An invalid spot is refused next to the pointer with the fix; releasing there changes nothing.',
    ],
  },
  {
    n: 5, title: 'An offered revision', kicker: 'Linked, kept, not allowed, removed — before anything changes',
    tasks: [
      { t: 'Desk light rev 2 arrives (simulated re-export)', run: () => { A.offerRevision('D-DK12', 2); } },
      { t: 'Review it', run: () => { if (!A.offerOf('D-DK12')) A.offerRevision('D-DK12', 2); A.openReview('D-DK12'); } },
      { t: 'Choose repairs: remove the Diffuser setting; set the arm to 45°', run: () => { if (S.instr?.kind !== 'review') A.openReview('D-DK12'); A.reviewChoose(`${ids.a}|lamp/slot.glass`, 'drop'); A.reviewChoose(`${ids.b}|lamp/a.tilt`, 'clamp'); } },
      { t: '<i>Failure:</i> another writer renames a light, then Accept is refused', run: () => { if (S.instr?.kind !== 'review') A.openReview('D-DK12'); A.injectStale(); A.acceptReview(); } },
      { t: 'Re-check and accept — one action', run: () => { if (S.instr?.kind !== 'review') A.openReview('D-DK12'); A.recheckReview(); A.acceptReview(); } },
      { t: 'Undo — the whole update returns, and the offer with it', run: () => { A.doUndo(); } },
    ],
    notice: [
      'Shade → Hood stays <b>linked</b> by its declared id; a render mesh named <span class="mono">diffuser_ring</span> is shown and <b>not</b> linked.',
      'The finish override is kept; the 50° arm is <b>not allowed now</b>; the glass setting is <b>unresolved</b> — three different states, three different choices.',
      'Presentation references show <b>needs review</b> vs <b>unresolved</b>; accepting doesn’t edit them.',
    ],
  },
  {
    n: 6, title: 'Reuse in a second project', kicker: 'Accept, stay pinned, or fork',
    tasks: [
      { t: 'Share Display light to the Studio library', run: () => { if (S.store.active !== 'p1') A.switchProject('p1'); A.share('D-DL01'); } },
      { t: 'Open Harbour café; use it by reference with a retained copy', run: () => { A.switchProject('p2'); if (!D().defs['D-DL01'] && !Object.values(D().defs).some((d) => d.forkedFrom?.id === 'D-DL01')) A.useFromLibrary('D-DL01', 'retained'); } },
      { t: 'Back in Saltmarsh: make Oiled oak the plinth default; publish rev 2', run: () => { A.switchProject('p1'); A.setValue(ids.a, 'plinth/paint', 'oak', 'def'); A.publishRevision('D-DL01'); } },
      { t: 'In Harbour café: review rev 2 — Accept, Stay pinned, or Fork', run: () => { A.switchProject('p2'); A.openLibReview('D-DL01'); } },
      { t: '<i>Failure:</i> the library becomes unavailable', run: () => { A.setLibrary(false); } },
    ],
    notice: [
      'Harbour café changes only when someone there accepts. Undo returns to rev 1 and the offer comes back.',
      '“Stay pinned” and “Fork” differ: pinned keeps the identity and the offer; a fork is a new identity with no offers.',
      'With the library unavailable, the retained copy still renders; offers can’t be checked. Storage is simulated.',
    ],
  },
];

// Setup: fresh store, then complete every earlier step instantly.
export function setupStep(n) {
  instant(() => {
    resetStore();
    for (let i = 1; i < n; i++) DONE[i]();
    if (n === 6) { /* ready to share */ }
    S.summary = null;
    S.sheet = null;
    S.flash = null;
    A.select(null);
    if (n >= 5) S.open.add('arch');
  });
  const st = A.getStage();
  if (st) {
    if (n >= 4) st.lookAt(new THREE.Vector3(-0.6, 0.9, -1.2), 5.4, { az: 0.5, el: 0.42 });
    else st.lookAt(new THREE.Vector3(-0.3, 0.45, -0.9), 3.6, { az: 0.62, el: 0.4 });
  }
  emit('all');
}

let cur = 1;
let noticeOpen = false;
export function renderScenario() {
  const el = $('scenario');
  const s = STEPS[cur - 1];
  el.innerHTML = `
    <div class="sc-head"><span class="sc-outside">Presenter · not part of the product</span><button class="sc-x" data-sc="close" aria-label="Close presenter">×</button></div>
    <div class="sc-tabs" role="tablist">${STEPS.map((x) => `<button role="tab" aria-selected="${x.n === cur}" class="${x.n === cur ? 'on' : ''}" data-sc="tab" data-n="${x.n}">${x.n}</button>`).join('')}</div>
    <div class="sc-kicker">${esc(s.kicker)}</div>
    <div class="sc-title">${s.n}. ${esc(s.title)}</div>
    <div class="sc-setup"><button class="b sm" data-sc="setup" data-n="${s.n}">Set up step ${s.n}</button><span class="q">${s.n === 1 ? 'resets to an empty project' : `resets, then completes steps 1–${s.n - 1} instantly`}</span></div>
    <ol class="sc-tasks">${s.tasks.map((t, i) => `<li><div><span>${t.t}</span><button class="b xs" data-sc="run" data-i="${i}">Do it</button></div></li>`).join('')}</ol>
    <details class="sc-notice"${noticeOpen ? ' open' : ''}><summary class="sc-k">What to notice</summary><ul>${s.notice.map((x) => `<li>${x}</li>`).join('')}</ul></details>
    <div class="sc-foot">
      <div class="sc-row"><span class="sc-k">Compare</span><span class="st-seg" role="group" aria-label="How definition edits are offered"><button data-sc="approach" data-a="contextual" class="${S.approach === 'contextual' ? 'on' : ''}" aria-pressed="${S.approach === 'contextual'}">Contextual reach</button><button data-sc="approach" data-a="bench" class="${S.approach === 'bench' ? 'on' : ''}" aria-pressed="${S.approach === 'bench'}">Definition bench</button></span></div>
      <div class="sc-row"><button class="b xs ghost" data-sc="reset">Reset everything</button><button class="b xs ghost" data-sc="lib" data-v="${S.store.library.available ? 0 : 1}">${S.store.library.available ? 'Make library unavailable' : 'Make library available'}</button><a class="b xs ghost" href="rationale.html#journey">Journey map</a></div>
    </div>`;
}
export function initScenario() {
  const el = $('scenario');
  el.addEventListener('toggle', (e) => { if (e.target.classList?.contains('sc-notice')) noticeOpen = e.target.open; }, true);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sc]');
    if (!b) return;
    const k = b.dataset.sc;
    if (k === 'close') { el.hidden = true; $('scToggle').hidden = false; return; }
    if (k === 'tab') { cur = +b.dataset.n; renderScenario(); return; }
    if (k === 'setup') { setupStep(+b.dataset.n); renderScenario(); return; }
    if (k === 'run') {
      const t = STEPS[cur - 1].tasks[+b.dataset.i];
      S.sheet = null;
      try { t.run(); } catch (err) { console.error(err); A.flash('That task needs the earlier tasks first — use “Set up step”.', 'warn'); }
      emit('all');
      renderScenario();
      return;
    }
    if (k === 'approach') { A.setApproach(b.dataset.a); renderScenario(); return; }
    if (k === 'reset') { resetStore(); A.flash('Reset — an empty project.', 'info'); renderScenario(); return; }
    if (k === 'lib') { A.setLibrary(b.dataset.v === '1'); renderScenario(); }
  });
  $('scToggle').addEventListener('click', () => { el.hidden = false; $('scToggle').hidden = true; renderScenario(); });
  renderScenario();
}
export function toggleScenario() {
  const el = $('scenario');
  el.hidden = !el.hidden;
  $('scToggle').hidden = !el.hidden;
  if (!el.hidden) renderScenario();
}
export function gotoStep(n, complete) {
  cur = Math.max(1, Math.min(6, n));
  setupStep(cur);
  if (complete) instant(() => { STEPS[cur - 1].tasks.forEach((t) => { try { t.run(); } catch (e) { console.warn(e); } }); });
  renderScenario();
}
export const currentStep = () => cur;

// Named states for the specimens page (?state=…). Each is reached through the same actions.
export const STATES = {
  'intake-lamp': () => { setupStep(1); A.startIntake('lamp'); S.instr.phase = 'ready'; },
  'intake-relief': () => { setupStep(1); A.startIntake('relief'); S.instr.phase = 'ready'; },
  reach: () => { setupStep(3); A.select({ kind: 'use', id: ids.a, path: ['lamp', 'p.shade'] }); A.previewReach(ids.a, 'lamp/slot.finish', 'def', 'opal'); },
  inspect: () => { setupStep(3); A.openInspect(ids.a); A.select({ kind: 'use', id: ids.a, path: ['lamp', 'p.diffuser'] }); },
  preview: () => { setupStep(4); A.openPreview(ids.a); A.previewSet(47); },
  'hang-refused': () => { gotoStep(4); STEPS[3].tasks[0].run(); STEPS[3].tasks[1].run(); },
  'remove-wall': () => { setupStep(5); A.openRemoveWall('W-FJSK'); },
  review: () => { setupStep(5); A.offerRevision('D-DK12', 2); A.openReview('D-DK12'); },
  'review-stale': () => { setupStep(5); A.offerRevision('D-DK12', 2); A.openReview('D-DK12'); A.injectStale(); A.acceptReview(); },
  'update-cancelled': () => { setupStep(5); A.offerRevision('D-DK12', 2); A.openReview('D-DK12'); A.cancelReview(); A.select({ kind: 'def', id: 'D-DK12' }); },
  'lib-review': () => { gotoStep(6); instant(() => { STEPS[5].tasks.slice(0, 3).forEach((t) => t.run()); }); A.switchProject('p2'); A.openLibReview('D-DL01'); },
  'lib-unavailable': () => { gotoStep(6); instant(() => { STEPS[5].tasks.slice(0, 3).forEach((t) => t.run()); }); A.switchProject('p2'); A.setLibrary(false); A.select({ kind: 'use', id: 'U-HC11', path: [] }); },
  bench: () => { setupStep(3); A.setApproach('bench'); A.openBench('D-DL01'); A.benchSet('lamp/slot.finish', 'opal'); },
};
export function showState(name) {
  const f = STATES[name];
  if (!f) return false;
  try { f(); } catch (e) { console.warn(e); }
  emit('all');
  renderScenario();
  return true;
}
