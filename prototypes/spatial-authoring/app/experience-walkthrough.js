// Scripted product actions for the shared Presenter. These are ordinary editor commands, not another
// navigation graph, evaluator, selection or history. Next opts into the current task; Skip never calls it.
import { S, ctx } from './state.js';
import * as A from './actions.js';
import * as E from './experience.js';
import * as nav from './navigation.js';
import { capabilities, isRealized } from './experience-capabilities.js';
import { entryUse, primaryExplanation, addInvocationBeat, fresh } from './experience-model.js';

export async function runExperienceStep(code, { current = () => true, lens = A.switchLens } = {}) {
  if (S.visitor || !current()) return false;
  const requireCurrent = () => { if (!current()) throw Error('Walkthrough cancelled'); };
  const pause = async ms => { await new Promise(resolve => setTimeout(resolve, ms)); requireCurrent(); };
  const wait = async (done, limit = 30000) => {
    const start = performance.now();
    while (!done()) {
      requireCurrent();
      if (performance.now() - start > limit) throw Error('The product outcome is still pending; continue or try it yourself');
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    requireCurrent();
  };
  const visit = async (begin, act = null, finishNarration = false) => {
    requireCurrent();
    if (!begin()) throw Error('Preview is unavailable for this content');
    const owned = S.visitor;
    const settled = () => S.visitor !== owned || !owned.runtime.movement;
    try {
      await wait(settled);
      if (S.visitor !== owned) throw Error('Preview was closed');
      if (act) await act(owned);
      await wait(settled);
      if (finishNarration) await wait(() => S.visitor !== owned || Object.values(owned.runtime.activities).every(a => {
        const u = owned.source.experience.uses[a.useId], d = owned.source.experience.definitions[u?.definitionId];
        return d?.kind !== 'narration' || a.status !== 'running';
      }));
      // Leave a visible product result before restoring the author's exact Preview return.
      await pause(300);
    } finally {
      if (S.visitor === owned) await E.exitPreview();
    }
  };
  const presentation = (sid = null) => {
    requireCurrent();
    const e = ctx.experience, selected = e.presentations[S.experienceContext.presentation];
    const p = (selected && (!sid || selected.focus.ids?.includes(sid)) ? selected : null)
      || (sid ? Object.values(e.presentations).find(p => p.focus.ids?.includes(sid)) : e.presentations[e.stops[e.guide[0]]?.presentationId]);
    if (p) { E.openPresentation(p.id); return p.id; }
    A.select(sid || 'machine');
    return E.present({ kind: 'subjects', ids: [sid || 'machine'] });
  };
  const frame = pid => {
    if (!entryUse(ctx.experience, pid)) { E.autoView(pid); E.captureView(pid); }
    return entryUse(ctx.experience, pid)?.id;
  };
  const explain = pid => {
    const primary = primaryExplanation(ctx.experience, pid);
    if (ctx.experience.definitions[primary?.definitionId]?.text.trim()) return;
    const p = ctx.experience.presentations[pid], sid = p.focus.ids?.[0];
    const text = p.meaning || (sid === 'machine' ? 'The casing protects the rotor.' : sid === 'piano' ? 'Listen to the piano.' : `A closer look at ${p.name}.`);
    E.explainPresentation(pid, text);
  };
  const capture = (pid, sid, cid, value) => {
    E.openPresentation(pid); A.select(sid);
    if (!E.auditionCapability(sid, cid, value)) throw Error('This subject cannot demonstrate that capability');
    const result = E.useCapability(sid, cid) || (S.expCaptureAsk && E.captureAnother());
    if (!result) throw Error('Capability capture needs a resolving subject');
    E.openPresentation(pid);
    return result.id;
  };
  const pair = () => {
    const e = ctx.experience;
    if (!e.guide.length) { const pid = presentation(); explain(pid); frame(pid); E.addToGuide(pid); }
    let at = e.guide.findIndex((id, i) => e.guide[i + 1] && e.stops[id].presentationId !== e.stops[e.guide[i + 1]].presentationId);
    if (at < 0) {
      const first = e.presentations[e.stops[e.guide[e.guide.length - 1]].presentationId];
      const sid = first.focus.ids?.includes('piano') ? 'machine' : 'piano';
      A.select(sid); const pid = E.present({ kind: 'subjects', ids: [sid] }); explain(pid); frame(pid); E.addToGuide(pid);
      at = e.guide.length - 2;
    }
    const a = e.guide[at], b = e.guide[at + 1];
    frame(e.stops[a].presentationId); frame(e.stops[b].presentationId);
    return { a, b, pid: e.stops[a].presentationId };
  };
  const travel = () => {
    const p = pair(); E.openSeam(p.a, p.b); E.setSeamMode('travel');
    const row = Object.values(ctx.cameraSource.connections).find(r => r.from === ctx.experience.uses[entryUse(ctx.experience, p.pid)?.id]?.viewId
      && r.to === ctx.experience.uses[entryUse(ctx.experience, ctx.experience.stops[p.b].presentationId)?.id]?.viewId);
    if (!row) throw Error('Camera route support needs repair');
    return { ...p, route: row.id };
  };
  const guideVisit = async (act, finishNarration = false) => visit(() => E.previewGuide(), act, finishNarration);

  switch (code) {
    case 'Q1': {
      const sid = S.sel && !E.resolveExperience(S.sel) && A.worldOf(S.sel) ? S.sel : 'machine';
      A.select(sid); E.present({ kind: 'subjects', ids: [sid] }); break;
    }
    case 'Q2': {
      const pid = presentation(); explain(pid); E.autoView(pid); E.captureView(pid); break;
    }
    case 'Q3': {
      let pid = presentation(), sid = ctx.experience.presentations[pid].focus.ids?.[0];
      let cap = capabilities(ctx.sceneSource, sid).find(isRealized);
      if (!cap) { pid = presentation('machine'); sid = 'machine'; explain(pid); frame(pid); cap = capabilities(ctx.sceneSource, sid).find(isRealized); }
      capture(pid, sid, cap.id, cap.control === 'range' ? cap.max : true); break;
    }
    case 'Q4': {
      const pid = presentation(); explain(pid); frame(pid);
      await visit(() => E.preview(pid), null, true); break;
    }
    case 'Q5': {
      const pid = presentation(), existing = ctx.experience.guide.find(id => ctx.experience.stops[id].presentationId === pid);
      frame(pid); E.selectStop(existing || E.addToGuide(pid)); break;
    }
    case 'Q6': { pair(); break; }
    case 'Q7': {
      pair(); await guideVisit(async () => { E.visitorCommand('next'); }); break;
    }
    case 'Q8': {
      pair(); await guideVisit(async () => {
        E.visitorCommand('explore');
        E.visitorPointer({ clientX: 10, clientY: 10 });
        E.visitorMove({ clientX: 50, clientY: 30 }); E.visitorRelease();
        E.visitorCommand('rejoin');
      }); break;
    }
    case 'A1': {
      const pid = presentation(); frame(pid); E.autoView(pid); E.captureView(pid);
      await visit(() => E.preview(pid), async () => E.visitorCommand('next-view')); break;
    }
    case 'A2': {
      const pid = presentation('machine'); frame(pid);
      const open = capture(pid, 'machine', 'casing', 1), rotor = capture(pid, 'machine', 'rotor', true);
      E.updateActivity(open, 'end', { kind: 'experience' }); E.updateActivity(rotor, 'end', { kind: 'experience' });
      E.updateActivity(rotor, 'start', { kind: 'after', useId: open, signal: 'complete', scope: 'visit', presentationId: pid });
      await visit(() => E.preview(pid), async owned => {
        await wait(() => S.visitor !== owned || owned.runtime.activities[owned.runtime.active[rotor]]?.status === 'running');
        if (S.visitor !== owned) throw Error('Preview was closed');
        E.visitorCommand('stop', owned.runtime.active[rotor]);
      }); break;
    }
    case 'A3': {
      const { pid } = pair(); E.openPresentation(pid);
      const first = frame(pid); E.autoView(pid); const later = E.captureView(pid);
      E.updateStop(ctx.experience.guide[0], 'entry', { kind: 'presentation' });
      const atView = E.addToGuide(pid), hold = E.addToGuide(pid);
      E.updateStop(atView, 'entry', { kind: 'use', useId: later }); E.updateStop(hold, 'entry', { kind: 'hold' });
      if (!first) throw Error('Entry framing needs repair');
      await guideVisit(async owned => {
        while (owned.runtime.stopId !== hold) {
          requireCurrent(); E.visitorCommand('next'); await wait(() => S.visitor !== owned || !owned.runtime.movement);
          if (S.visitor !== owned) throw Error('Preview was closed');
        }
        await wait(() => owned.runtime.entries.some(x => x.kind === 'hold' && x.ran));
      }); break;
    }
    case 'A4': {
      travel(); await guideVisit(async () => E.visitorCommand('next')); break;
    }
    case 'A5': {
      const { route } = travel(); await E.editRoute(route); requireCurrent();
      E.routePace('slow'); if (S.expRouteAsk) E.acceptRoutePace(); E.returnRouteReading(); break;
    }
    case 'A6': {
      const { a, b, pid, route } = travel(); E.openPresentation(pid);
      const use = capture(pid, 'light', 'intensity', 3);
      E.openSeam(a, b); S.task.params.connection = route; E.coordinate();
      E.handleExperienceAction({ dataset: { act: 'exp-station-focus', id: 'departure' } });
      const hold = E.beatAtStation('departure', 1);
      E.updateHold(hold, 1.5);
      E.command('Invoke Activity at Camera station', (e, c) => addInvocationBeat(e, c, a, b, route, 'departure', use, ctx.sceneSource));
      await guideVisit(async () => E.visitorCommand('next')); break;
    }
    case 'A7': {
      presentation(); E.beginOffer('interaction', 'light'); E.changeOfferField('trigger', 'switch');
      E.changeOfferField('value', 3); const offer = E.acceptOffer();
      await visit(() => E.previewExperience(), async () => { E.visitorCommand('explore'); E.visitorCommand('activate', offer); }); break;
    }
    case 'A8': {
      const { a, b } = pair();
      const choice = E.command('Add detour choice', e => { const id = fresh(e, 'choice'); e.stops[a].choices.push({ id, label: 'Walkthrough detour', targetId: b, kind: 'detour' }); return id; });
      await guideVisit(async owned => {
        E.visitorCommand('detour', choice); await wait(() => S.visitor !== owned || !owned.runtime.movement);
        if (S.visitor !== owned) throw Error('Preview was closed'); E.visitorCommand('return');
      }); break;
    }
    case 'A9': {
      const { pid, b } = pair(), uid = frame(pid), vid = ctx.experience.uses[uid].viewId;
      E.reuseFraming(ctx.experience.stops[b].presentationId, vid);
      E.preciseView(uid); E.preciseProperty(uid, 'frameH');
      const value = ctx.cameraSource.views[vid].pose.frameH * .9;
      E.proposeFraming('frameH', value); E.handleExperienceAction({ dataset: { act: 'exp-scope-cancel' } });
      E.proposeFraming('frameH', value); E.acceptFraming('local'); A.undo();
      nav.putBack(); E.closeExperienceWork(); break;
    }
    case 'A10': {
      const pid = presentation('machine');
      const rotor = capture(pid, 'machine', 'rotor', true);
      lens('world'); A.select('machine'); E.replaceProfileCommand('machine', 'machineBase');
      await pause(300);
      lens('experience'); E.openPresentation(pid); A.select(rotor);
      E.rebindContributionCommand(rotor, { capabilityId: 'casing' });
      if (S.expRebindAsk) E.acceptRebind('local'); break;
    }
    default: throw Error('This topic has no task demonstration; continue with the instructions');
  }
  requireCurrent(); return true;
}
