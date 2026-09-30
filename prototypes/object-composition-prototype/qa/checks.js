// Run in the prototype's browser console:
// await (await import('./qa/checks.js')).runChecks()
// Destructive only to the in-memory fixture; returns to an empty project afterwards.
import { S, P, D, emit, resetStore } from '../app/state.js';
import * as A from '../app/actions.js';
import { STATES, STEPS, setupStep, showState } from '../app/scenario.js';
import { compileLayout, poseOf, resolveRef, featureAt } from '../app/model.js';

const a = 'U-A4D1', b = 'U-B7Q2';
const json = (x) => JSON.stringify(x);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(json(actual) === json(expected), message);
const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export async function runChecks() {
  const results = [];
  const motion = S.motion, approach = S.approach;
  S.motion = 'reduced';
  S._instant = true;
  const test = async (name, run) => {
    try { await run(); await tick(); results.push({ name, ok: true }); }
    catch (error) { results.push({ name, ok: false, error: error.message }); }
  };
  try {
    for (const step of STEPS) await test(`Presenter step ${step.n}`, () => {
      setupStep(step.n);
      step.tasks.forEach((t) => t.run());
      assert(Number.isFinite(P().rev), 'Fixture revision is invalid');
    });
    for (const [name, setup] of Object.entries(STATES)) await test(`Direct state: ${name}`, () => {
      setup();
      emit('all');
      assert(document.querySelector('#insp').textContent.trim(), 'Inspector is empty');
    });
    await test('Import cancellation accepts nothing; flat asset has no semantic parts', () => {
      setupStep(1);
      const before = json(D());
      A.startIntake('lamp'); A.cancelIntake();
      equal(json(D()), before, 'Cancelled intake changed the project');
      equal(P().undo.length, 0, 'Cancelled intake created history');
      A.startIntake('relief'); A.commitIntake();
      equal(A.iface(D(), 'D-TR05').parts.length, 0, 'Render meshes became semantic parts');
      assert(!S.instr, 'Import started playback');
    });
    await test('Shared reach preserves the second use override, and writes nothing on hover', () => {
      showState('reach');
      equal(S.reach.scope, 'def', 'Reach scope is wrong');
      equal(S.reach.value, 'opal', 'Reach finish is wrong');
      const before = json(D());
      equal(A.reachOf(D(), a, 'lamp/slot.finish', 'def').keeps, [b], 'Override should be retained');
      A.clearReach();
      equal(json(D()), before, 'Hover mutated source');
      A.setValue(a, 'lamp/slot.finish', 'opal', 'def');
      equal(A.valueOf(D(), a, 'lamp/slot.finish').value, 'opal', 'Shared default did not apply');
      equal(A.valueOf(D(), b, 'lamp/slot.finish').value, 'black', 'Shared edit overwrote local finish');
      A.doUndo(); equal(json(D()), before, 'Shared edit did not undo coherently');
    });
    await test('Inspection clears only separation; preview/reset never writes baseline', () => {
      setupStep(3); A.openInspect(a);
      A.setValue(a, 'lamp/slot.glass', 'clear', 'use'); A.closeInspect();
      assert(!S.instr, 'Inspection did not close');
      equal(A.valueOf(D(), a, 'lamp/slot.glass').value, 'clear', 'Accepted edit disappeared');
      const before = json(D()), history = P().undo.length;
      A.openPreview(a); A.previewSet(47); A.previewReset(); A.closePreview();
      equal(json(D()), before, 'Preview wrote to source');
      equal(P().undo.length, history, 'Preview created document history');
    });
    await test('Invalid attachment refuses atomically; host motion carries only attachment', () => {
      setupStep(4); A.addBay();
      const before = json(D()), history = P().undo.length;
      A.hangAt(b, 'W-FJSK', 3.9, 1);
      equal(json(D()), before, 'Refused hang half-applied');
      equal(P().undo.length, history, 'Refused hang created history');
      A.cancelHang();
      A.hangAt(b, 'W-FJSK', 2.3, 1);
      const ca = poseOf(D(), compileLayout(D().layout), a);
      const cb = poseOf(D(), compileLayout(D().layout), b);
      A.wallMoveStart('W-FJSK'); A.wallMoveSet(-0.5); A.wallMoveCommit();
      equal(poseOf(D(), compileLayout(D().layout), a), ca, 'Nearby object followed wall');
      equal(poseOf(D(), compileLayout(D().layout), b).z, cb.z - 0.5, 'Attached object did not follow');
    });
    await test('Removing a host preserves repair state; one Undo restores both domains', () => {
      setupStep(5); const before = json(D()), history = P().undo.length;
      A.removeWall('W-FJSK', 'repair');
      assert(D().uses[b].attach.broken, 'Removed host was silently resolved');
      equal(P().undo.length, history + 1, 'Host removal split history');
      A.doUndo(); equal(json(D()), before, 'Host removal did not restore both domains');
    });
    await test('Repair choices stay editable before acceptance', () => {
      showState('review'); A.reviewChoose(`${a}|lamp/slot.glass`, 'drop');
      const choice = document.querySelector(`input[data-k="${a}|lamp/slot.glass"][value="keep"]`);
      assert(choice, 'Changing a repair removed its controls');
      choice.click();
      equal(S.instr.choices[`${a}|lamp/slot.glass`], 'keep', 'Could not reverse repair choice');
    });
    await test('Stale acceptance preserves the other writer; recheck and Undo are coherent', () => {
      showState('review');
      A.reviewChoose(`${a}|lamp/slot.glass`, 'drop'); A.reviewChoose(`${b}|lamp/a.tilt`, 'clamp');
      A.injectStale(); const before = json(D()), history = P().undo.length;
      A.acceptReview();
      assert(S.instr.stale, 'Stale revision was accepted');
      equal(json(D()), before, 'Stale acceptance mutated source');
      A.recheckReview(); A.acceptReview();
      equal(P().undo.length, history + 1, 'Revision was not one accepted action');
      equal(D().defs['D-DK12'].lock, 2, 'Revision lock did not advance');
      equal(A.valueOf(D(), b, 'lamp/slot.finish').value, 'black', 'Compatible finish was lost');
      equal(A.valueOf(D(), b, 'lamp/a.tilt').value, 45, 'Clamp was not applied');
      equal(resolveRef(D(), D().refs['R-CV31']).status, 'review', 'Renamed shade reference should need review');
      equal(resolveRef(D(), D().refs['R-EX07']).status, 'removed', 'Removed part was silently retargeted');
      A.doUndo(); equal(json(D()), before, 'Undo lost the other writer or part of the revision');
      assert(A.offerOf('D-DK12'), 'Undo lost the revision offer');
    });
    await test('Revision cancel and stay preserve the project; detach preserves the old part', () => {
      showState('review'); const before = json(D()); A.cancelReview();
      equal(json(D()), before, 'Cancel changed source');
      A.openReview('D-DK12'); A.stayOnRevision();
      equal(json(D()), before, 'Stay changed source');
      A.openReview('D-DK12'); A.reviewDetach(a, true); A.acceptReview();
      assert(D().uses[a].def !== D().uses[b].def, 'Detach retained shared identity');
      assert(featureAt(D(), D().uses[a].def, 'lamp/slot.glass'), 'Detached component lost old capability');
    });
    await test('A direct imported use can detach during revision', () => {
      setupStep(2); A.offerRevision(); A.openReview(); A.reviewDetach('U-7K2F', true); A.acceptReview();
      const def = D().defs[D().uses['U-7K2F'].def];
      assert(def.id !== 'D-DK12' && def.lock === 1, 'Imported-use detach failed');
    });
    await test('Repeated source uses get distinct component identities when composed', () => {
      setupStep(2); A.duplicateUse('U-7K2F');
      const second = Object.keys(D().uses).find((uid) => uid !== 'U-7K2F' && D().uses[uid].def === 'D-DK12');
      assert(second, 'Second imported use was not placed');
      const uid = A.makeReusable(['U-7K2F', second], 'Pair');
      const comps = D().defs[D().uses[uid].def].comps;
      equal(new Set(comps.map((c) => c.id)).size, 2, 'Two lamps share component identity');
    });
    await test('Library acceptance affects only second project and supports Undo', () => {
      showState('lib-review'); const p1 = json(S.store.projects.p1.doc), before = json(D());
      A.acceptLib(); equal(D().defs['D-DL01'].lib.rev, 2, 'Second project did not accept');
      equal(json(S.store.projects.p1.doc), p1, 'Second project acceptance changed first');
      A.doUndo(); equal(json(D()), before, 'Library acceptance did not undo');
      assert(A.libOffer(D(), 'D-DL01'), 'Library offer disappeared after Undo');
    });
    await test('Library pin, fork and outage retain distinct outcomes', () => {
      showState('lib-review'); const before = json(D()); A.stayLib();
      equal(json(D()), before, 'Pin changed document');
      A.openLibReview('D-DL01'); A.forkLib();
      const def = D().defs[D().uses['U-HC11'].def];
      assert(def.id !== 'D-DL01' && !def.lib && def.forkedFrom, 'Fork did not create independent identity');
      showState('lib-unavailable');
      assert(D().defs['D-DL01'].retained, 'Unavailable fixture has no retained copy');
      const retained = json(D()); A.openLibReview('D-DL01');
      equal(json(D()), retained, 'Outage mutated retained data');
      assert(!S.instr, 'Unavailable library opened a new offer');
    });
    await test('Bench discard is temporary; Apply batches values into one Undo', () => {
      setupStep(3); const before = json(D()), history = P().undo.length;
      A.openBench('D-DL01'); A.benchSet('lamp/slot.finish', 'opal'); A.closeBench(true);
      equal(json(D()), before, 'Discard wrote source');
      A.openBench('D-DL01'); A.benchSet('lamp/slot.finish', 'opal'); A.benchSet('plinth/paint', 'oak'); A.benchApply();
      equal(P().undo.length, history + 1, 'Bench values were not accepted together');
      equal(A.valueOf(D(), b, 'lamp/slot.finish').value, 'black', 'Bench overwrote local override');
      A.doUndo(); equal(json(D()), before, 'Bench Undo left partial edit');
    });
  } finally {
    resetStore(); S._instant = false; S.motion = motion; S.approach = approach; emit('all');
  }
  return { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}
