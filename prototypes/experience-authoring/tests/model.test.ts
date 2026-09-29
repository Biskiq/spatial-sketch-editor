import { describe, expect, it } from 'vitest';
import { emptyDocument, exampleDocument } from '../src/fixture';
import { addEncounter, addNarration, addToGuide, addView, captureControl, copyUse, definition, editDefinition, entryViewUse, movePosition, narrationDuration, narrationPassages, removePosition, removeUse, resolveNext, resolvedDuration, solveView, validate, type ViewDefinition } from '../src/model';
import { travelSeconds } from '../src/camera';
import { planPresentation, positionPlan } from '../src/presentation';
import { activateRuntime, autoplayRuntime, chooseRuntime, createRuntime, exploreRuntime, gateState, nextRuntime, openEncounterRuntime, previousRuntime, projectedValue, resumeGuide, returnDetour, stopActivityRuntime, tickRuntime } from '../src/runtime';
const controlUse = (d: ReturnType<typeof exampleDocument>, capId: string, kind = 'behavior') => Object.values(d.experience.uses).find(u => u.kind === kind && definition(d, u)?.kind === 'control' && (definition(d, u) as { capabilityId: string }).capabilityId === capId)!;
describe('identity and structural revision', () => {
  it('loads an example with independent navigation uses and a shared view definition', () => {
    const d = exampleDocument(); expect(validate(d)).toEqual([]);
    const main = d.experience.routes[0].ids; const a = d.experience.uses[d.experience.positions[main[0]].viewUseId!], b = d.experience.uses[d.experience.positions[main[1]].viewUseId!];
    expect(a.id).not.toBe(b.id); expect(a.encounterId).not.toBe(b.encounterId); expect(a.definitionId).toBe(b.definitionId); expect(main).toHaveLength(2);
  });
  it('detaches only one use, and shared edits preserve connection identities', () => {
    const d = exampleDocument(), main = d.experience.routes[0].ids; const a = d.experience.uses[d.experience.positions[main[0]].viewUseId!], b = d.experience.uses[d.experience.positions[main[1]].viewUseId!]; const beforeLinks = structuredClone(d.experience.positions);
    editDefinition(d, a.id, true, { name: 'Shared overview' }); expect(definition(d, b)?.name).toBe('Shared overview');
    editDefinition(d, b.id, false, { name: 'Local overview', distance: 2 }); expect(a.definitionId).not.toBe(b.definitionId); expect(definition(d, a)?.name).toBe('Shared overview'); expect(d.experience.positions).toEqual(beforeLinks);
  });
  it('removes a view or Guide position without deleting the explanation', () => {
    const d = exampleDocument(); const main = [...d.experience.routes[0].ids]; const uid = d.experience.positions[main[1]].viewUseId!; const encounter = d.experience.positions[main[1]].encounterId; const count = Object.keys(d.experience.uses).length;
    removeUse(d, uid); expect(d.experience.positions[main[1]].viewUseId).toBeNull(); expect(d.experience.encounters[encounter]).toBeDefined(); expect(Object.keys(d.experience.uses)).toHaveLength(count - 1);
    removePosition(d, main[1]); expect(resolveNext(d, main[0]).id).toBeNull(); expect(d.experience.encounters[encounter]).toBeDefined();
  });
  it('reorders default connections while retaining named choice destinations', () => {
    const d = exampleDocument(); const main = [...d.experience.routes[0].ids]; const choices = structuredClone(d.experience.positions[main[1]].choices);
    movePosition(d, main[1], -1); expect(resolveNext(d, main[1]).id).toBe(main[0]); expect(d.experience.positions[main[1]].choices).toEqual(choices);
  });
  it('checkpoint-only editing makes a private use and leaves connections intact', () => {
    const d = exampleDocument(); const main = [...d.experience.routes[0].ids]; const first = d.experience.positions[main[0]], second = d.experience.positions[main[1]];
    const shared = d.experience.uses[first.viewUseId!].definitionId, next = structuredClone(first.next), choices = structuredClone(second.choices);
    const fresh = copyUse(d, second.viewUseId!, second.encounterId, false); second.viewUseId = fresh;
    expect(d.experience.uses[fresh].definitionId).not.toBe(shared); expect(d.experience.uses[first.viewUseId!].definitionId).toBe(shared); expect(definition(d, fresh)?.name).toBe(definition(d, first.viewUseId)?.name);
    expect(d.experience.positions[main[0]].next).toEqual(next); expect(d.experience.positions[main[1]].choices).toEqual(choices);
  });
  it('removing an encounter preserves its contributions for repair', () => {
    const d = exampleDocument(); const pid = d.experience.routes[0].ids[0]; const eid = d.experience.positions[pid].encounterId; const before = Object.keys(d.experience.uses).length;
    delete d.experience.encounters[eid]; Object.values(d.experience.uses).forEach(u => { if (u.encounterId === eid) u.encounterId = null; });
    expect(Object.keys(d.experience.uses)).toHaveLength(before); expect(validate(d).some(i => i.kind === 'position' && i.id === pid)).toBe(true);
  });
  it('reports a missing availability encounter for local repair', () => {
    const d = emptyDocument(); const uid = captureControl(d, 'piano', 'music', true, null, true); d.experience.uses[uid].availability = 'encounter-missing';
    expect(validate(d).some(i => i.id === uid && /Availability encounter removed/.test(i.message))).toBe(true);
  });
  it('adds one Encounter position by default and resolves Next from route order', () => {
    const d = emptyDocument(); const a = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); addView(d, a); addView(d, a);
    const p = addToGuide(d, a); expect(p).toHaveLength(1); expect(resolveNext(d, p[0]).id).toBeNull();
    const b = addEncounter(d, { kind: 'subjects', ids: ['piano'] }); const q = addToGuide(d, b); expect(resolveNext(d, p[0]).id).toBe(q[0]);
  });
  it('adds a repeated checkpoint as a distinct occurrence of the same use', () => {
    const d = exampleDocument(); const first = d.experience.positions[d.experience.routes[0].ids[0]]; const uid = first.viewUseId!; const count = Object.keys(d.experience.uses).length;
    const added = addToGuide(d, first.encounterId, 'main', [uid]); expect(added[0]).not.toBe(first.id); expect(d.experience.positions[added[0]].viewUseId).toBe(uid); expect(d.experience.positions[first.id].viewUseId).toBe(uid); expect(Object.keys(d.experience.uses)).toHaveLength(count);
  });
  it('honours an explicit Next target independently of route order', () => {
    const d = exampleDocument(); const main = [...d.experience.routes[0].ids]; d.experience.positions[main[0]].next = { kind: 'target', positionId: main[1] };
    expect(resolveNext(d, main[0])).toEqual({ id: main[1], explicit: true, missing: false }); movePosition(d, main[1], -1); expect(resolveNext(d, main[0]).id).toBe(main[1]);
  });
  it('regrouping and duplication preserve explicit behavior boundaries', () => {
    const d = exampleDocument(), u = controlUse(d, 'rotor'); const start = structuredClone(u.start), end = structuredClone(u.end); const b = d.experience.positions[d.experience.routes[0].ids[1]].encounterId;
    u.encounterId = b; const copied = copyUse(d, u.id, null, true); expect(d.experience.uses[copied].start).toEqual(start); expect(d.experience.uses[copied].end).toEqual(end);
  });
  it('supports environment and region intentions without a prescribed view', () => {
    const d = emptyDocument(); const ambient = addEncounter(d, { kind: 'environment' }, 'Night', false); expect(Object.values(d.experience.uses)).toHaveLength(0);
    const positions = addToGuide(d, ambient); expect(d.experience.positions[positions[0]].viewUseId).toBeNull();
    const region = addEncounter(d, { kind: 'region', min: [-2, 0, -2], max: [2, 3, 2] }); expect(d.experience.encounters[region].focus.kind).toBe('region');
  });
  it('keeps captured framing fixed and automatic framing subject-relative', () => {
    const d = emptyDocument(), e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); const auto = Object.values(d.experience.uses)[0]; const fixedId = addView(d, e, { position: [4, 5, 8], target: [-3, 1, -1] }); const fixed = definition(d, fixedId) as ViewDefinition;
    const initialAuto = solveView(d, definition(d, auto) as ViewDefinition); d.world.subjects.machine.position[0] += 2; d.world.revision++;
    expect(solveView(d, definition(d, auto) as ViewDefinition).target[0]).toBe(initialAuto.target[0] + 2); expect(solveView(d, fixed).position).toEqual([4, 5, 8]); expect(validate(d).some(i => i.id === fixedId && i.severity === 'warning')).toBe(true);
    fixed.distance = 2; expect(solveView(d, fixed).position[0]).toBe(11);
  });
});
describe('independent visitor execution', () => {
  it('never mutates authored documents', () => {
    const d = exampleDocument(), before = structuredClone(d); let r = tickRuntime(d, createRuntime(d), 2); r = nextRuntime(d, r); r = tickRuntime(d, r, 3); r = activateRuntime(d, r, controlUse(d, 'music', 'interaction').id); r = nextRuntime(d, nextRuntime(d, r)); tickRuntime(d, r, 8); expect(d).toEqual(before);
  });
  it('spans three Views with one narration inside a single position', () => {
    const d = exampleDocument(); const uid = Object.values(d.experience.uses).find(u => u.kind === 'narration')!.id;
    let r = createRuntime(d); const position = r.positionId, entry = r.camera!.token;
    r = tickRuntime(d, r, 7); expect(r.positionId).toBe(position); expect(r.camera!.token).toBeGreaterThan(entry); expect(r.activities[uid].status).toBe('running');
    const second = r.camera!.token; r = tickRuntime(d, r, 6); expect(r.positionId).toBe(position); expect(r.camera!.token).toBeGreaterThan(second); expect(r.activities[uid].elapsed).toBeGreaterThan(12);
  });
  it('allows early Next while narration and Camera travel are active', () => {
    const d = exampleDocument(); let r = tickRuntime(d, createRuntime(d), .5); expect(gateState(d, r).allowed).toBe(true);
    r = nextRuntime(d, r); expect(r.positionId).toBe(d.experience.routes[0].ids[1]); expect(r.time).toBe(.5);
  });
  it('starts after completion, and carries a rotor beyond camera and encounter departure', () => {
    const d = exampleDocument(); let r = createRuntime(d); const run = controlUse(d, 'rotor'); expect(r.activities[run.id].status).toBe('waiting'); r = tickRuntime(d, r, 1.6); expect(r.activities[run.id].status).toBe('running'); expect(r.activities[run.id].elapsed).toBeLessThan(.3);
    r = nextRuntime(d, nextRuntime(d, nextRuntime(d, r))); expect(projectedValue(d, r, 'machine', 'running')).toBe(true); expect(r.activities[run.id].status).toBe('running');
  });
  it('disarms a visit-scoped dependent on departure while a started finite sibling can finish', () => {
    const d = exampleDocument(), open = controlUse(d, 'casing'); const first = d.experience.positions[d.experience.routes[0].ids[0]]; open.end = { kind: 'encounter', encounterId: first.encounterId };
    let r = createRuntime(d); expect(gateState(d, r).allowed).toBe(true); r = nextRuntime(d, r); const run = controlUse(d, 'rotor'); expect(r.activities[run.id].status).toBe('stopped'); expect(r.activities[run.id].reason).toBe('Disarmed when the visit ended'); expect(r.activities[open.id].status).toBe('running');
    r = tickRuntime(d, r, 2); expect(r.activities[run.id].status).toBe('stopped'); expect(r.activities[open.id].status).toBe('complete');
  });
  it('does not undo visitor Stop on subsequent view changes', () => {
    const d = exampleDocument(); let r = tickRuntime(d, createRuntime(d), 1.6); r = activateRuntime(d, r, controlUse(d, 'rotor', 'interaction').id); expect(projectedValue(d, r, 'machine', 'running')).toBe(false);
    r = nextRuntime(d, nextRuntime(d, r)); expect(projectedValue(d, r, 'machine', 'running')).toBe(false); expect(r.activities[controlUse(d, 'rotor').id].reason).toBe('Replaced by a new command');
  });
  it('pauses explanation for a detour, keeps behavior alive, and resumes without duplicate entry', () => {
    const d = exampleDocument(); let r = tickRuntime(d, createRuntime(d), 3); r = nextRuntime(d, r); const source = r.positionId!, p = d.experience.positions[source]; const narrator = Object.values(d.experience.uses).find(u => u.kind === 'narration' && u.encounterId === p.encounterId)!; const opened = controlUse(d, 'casing'); const elapsed = r.activities[narrator.id].elapsed;
    r = chooseRuntime(d, r, p.choices[0].targetId, true); expect(r.activities[narrator.id].status).toBe('paused'); r = tickRuntime(d, r, 2); expect(projectedValue(d, r, 'machine', 'running')).toBe(true);
    r = returnDetour(d, r); expect(r.positionId).toBe(source); expect(r.activities[narrator.id].elapsed).toBe(elapsed); expect(r.activities[narrator.id].status).toBe('running'); expect(r.activities[opened.id].elapsed).toBe(1.5); expect(projectedValue(d, r, 'wall', 'unfolded')).toBe(false);
  });
  it('lets piano interaction execute without a Guide or Encounter', () => {
    const d = emptyDocument(); const uid = captureControl(d, 'piano', 'music', true, null, true); let r = createRuntime(d); r = activateRuntime(d, r, uid);
    expect(r.positionId).toBeNull(); expect(r.encounterId).toBeNull(); expect(projectedValue(d, r, 'piano', 'playing')).toBe(true); expect(r.camera).toBeNull(); r = tickRuntime(d, r, 13); expect(projectedValue(d, r, 'piano', 'playing')).toBe(false);
  });
  it('releases Camera and autoplay for exploration until guidance is resumed', () => {
    const d = exampleDocument(); let r = createRuntime(d, true); r = nextRuntime(d, r); const current = r.positionId; r = tickRuntime(d, r, 7); expect(r.positionId).toBe(current);
    r = exploreRuntime(r); expect(r.camera).toBeNull(); r = tickRuntime(d, r, 12); expect(r.positionId).toBe(current); expect(r.camera).toBeNull();
    r = resumeGuide(d, r); expect(r.autoplay).toBe(false); expect(r.camera).not.toBeNull();
  });
  it('advances autoplay from remaining work after a rejoin', () => {
    const d = exampleDocument(); const extra = addEncounter(d, { kind: 'subjects', ids: ['piano'] }); addToGuide(d, extra); const target = d.experience.routes[0].ids[2];
    let r = createRuntime(d, true); r = nextRuntime(d, r); r = resumeGuide(d, r); r = autoplayRuntime(d, r, true); r = tickRuntime(d, r, 30); expect(r.positionId).toBe(target);
  });
  it('gates only when deliberately authored', () => {
    const d = exampleDocument(); const first = d.experience.positions[d.experience.routes[0].ids[0]]; const open = controlUse(d, 'casing'); first.gate = { useId: open.id, signal: 'complete' }; let r = createRuntime(d); expect(gateState(d, r).allowed).toBe(false); expect(nextRuntime(d, r).positionId).toBe(first.id); r = tickRuntime(d, r, 1.6); expect(gateState(d, r).allowed).toBe(true);
  });
  it('retains unavailable behavior and reports its local repair after asset replacement', () => {
    const d = exampleDocument(); d.world.subjects.machine.profileId = 'machine-replacement'; const rotor = controlUse(d, 'rotor'); const count = Object.keys(d.experience.uses).length;
    expect(validate(d).some(i => i.id === rotor.id && /capability unavailable/.test(i.message))).toBe(true); const r = createRuntime(d); expect(r.activities[rotor.id].status).toBe('unavailable'); expect(Object.keys(d.experience.uses)).toHaveLength(count); expect(gateState(d, r).allowed).toBe(true);
  });
  it('rejects cyclic dependencies rather than hanging', () => {
    const d = emptyDocument(); const a = captureControl(d, 'mesh', 'visibility', true, null), b = captureControl(d, 'mesh', 'emphasis', true, null); d.experience.uses[a].start = { kind: 'after', useId: b, signal: 'complete', encounterId: null }; d.experience.uses[b].start = { kind: 'after', useId: a, signal: 'complete', encounterId: null }; expect(validate(d).some(i => /Dependency cycle/.test(i.message))).toBe(true); expect(createRuntime(d).activities[a].status).toBe('unavailable');
  });
});
describe('visitor agency and interruption', () => {
  const useFor = (d: ReturnType<typeof exampleDocument>, matches: (u: { kind: string }, def: Record<string, unknown>) => boolean) => Object.values(d.experience.uses).find(u => { const def = definition(d, u) as unknown as Record<string, unknown>; return matches(u, def); })!;
  it('activates a cross-subject interaction that retains its result and leaves framing alone', () => {
    const d = exampleDocument(); const beam = useFor(d, (u, def) => u.kind === 'interaction' && def.subjectId === 'light'); expect(beam.triggerSubjectId).toBe('switch');
    let r = createRuntime(d); const position = r.positionId; r = exploreRuntime(r); r = activateRuntime(d, r, beam.id);
    expect(r.activities[beam.id].status).toBe('complete'); expect(projectedValue(d, r, 'light', 'intensity')).toBe(3); expect(r.positionId).toBe(position); expect(r.camera).toBeNull();
    r = tickRuntime(d, r, 5); expect(projectedValue(d, r, 'light', 'intensity')).toBe(3);
  });
  it('disarms unstarted visit work and releases a local result at its boundary', () => {
    const d = exampleDocument(); const run = controlUse(d, 'rotor'); const glow = useFor(d, (u, def) => u.kind === 'behavior' && def.capabilityId === 'emphasis');
    let r = createRuntime(d); expect(projectedValue(d, r, 'machine', 'highlight')).toBe(true);
    r = nextRuntime(d, r); expect(r.activities[run.id].status).toBe('stopped'); expect(r.activities[run.id].reason).toBe('Disarmed when the visit ended'); expect(projectedValue(d, r, 'machine', 'running')).toBe(false); expect(projectedValue(d, r, 'machine', 'highlight')).toBe(false); expect(glow.id).toBeTruthy();
  });
  it('continues a started persistent rotor while stopping local narration on departure', () => {
    const d = exampleDocument(); const run = controlUse(d, 'rotor'); const narration = Object.values(d.experience.uses).find(u => u.kind === 'narration')!;
    let r = tickRuntime(d, createRuntime(d), 1.6); expect(r.activities[run.id].status).toBe('running'); r = nextRuntime(d, r);
    expect(r.activities[run.id].status).toBe('running'); expect(projectedValue(d, r, 'machine', 'running')).toBe(true); expect(r.activities[narration.id].status).toBe('stopped');
  });
  it('does not undo a visitor Stop through later view changes', () => {
    const d = exampleDocument(); const run = controlUse(d, 'rotor'); let r = tickRuntime(d, createRuntime(d), 1.6); expect(r.activities[run.id].status).toBe('running');
    r = stopActivityRuntime(d, r, run.id); expect(r.activities[run.id].status).toBe('stopped'); expect(projectedValue(d, r, 'machine', 'running')).toBe(false);
    r = nextRuntime(d, r); expect(projectedValue(d, r, 'machine', 'running')).toBe(false);
  });
  it('does not let a past visit satisfy a new Gate', () => {
    const d = exampleDocument(); const first = d.experience.positions[d.experience.routes[0].ids[0]]; const narration = Object.values(d.experience.uses).find(u => u.kind === 'narration')!; first.gate = { useId: narration.id, signal: 'complete' };
    let r = tickRuntime(d, createRuntime(d), 19); expect(gateState(d, r).allowed).toBe(true); r = nextRuntime(d, r); expect(r.visits).toBe(2); r = previousRuntime(d, r);
    expect(r.positionId).toBe(first.id); expect(gateState(d, r).allowed).toBe(false); r = tickRuntime(d, r, 19); expect(gateState(d, r).allowed).toBe(true);
  });
  it('frames a checkpoint while the narration playhead continues', () => {
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); const first = Object.values(d.experience.uses).find(u => u.encounterId === e)!.id; const second = addView(d, e); const nid = addNarration(d, e); const def = definition(d, nid)!; if (def.kind === 'narration') { def.text = 'A short explanation for the drive.'; def.duration = 20; }
    const [p1, p2] = addToGuide(d, e, 'main', [first, second]); let r = tickRuntime(d, createRuntime(d), 3); const elapsed = r.activities[nid].elapsed, token = r.camera!.token;
    expect(elapsed).toBeGreaterThan(2); r = nextRuntime(d, r);
    expect(r.positionId).toBe(p2); expect(r.activities[nid].elapsed).toBe(elapsed); expect(r.activities[nid].status).toBe('running'); expect(r.camera!.token).toBeGreaterThan(token); expect(p1).not.toBe(p2);
  });
  it('resumes the parent visit and its satisfied Gate after a detour', () => {
    const d = exampleDocument(); const first = d.experience.positions[d.experience.routes[0].ids[0]]; const open = controlUse(d, 'casing');
    first.gate = { useId: open.id, signal: 'complete' }; const detourPos = d.experience.routes.find(r => r.id === 'optional')!.ids[0]; first.choices.push({ id: 'detour-1', label: 'Detour', kind: 'detour', targetId: detourPos });
    let r = tickRuntime(d, createRuntime(d), 1.6); expect(gateState(d, r).allowed).toBe(true); r = chooseRuntime(d, r, detourPos, true); expect(r.bookmarks).toHaveLength(1);
    r = returnDetour(d, r); expect(r.positionId).toBe(first.id); expect(gateState(d, r).allowed).toBe(true);
  });
  it('retains a parent completion that happens while a detour is open', () => {
    const d = exampleDocument(); const first = d.experience.positions[d.experience.routes[0].ids[0]]; const open = controlUse(d, 'casing');
    first.gate = { useId: open.id, signal: 'complete' }; const detourPos = d.experience.routes.find(r => r.id === 'optional')!.ids[0]; first.choices.push({ id: 'detour-1', label: 'Detour', kind: 'detour', targetId: detourPos });
    let r = tickRuntime(d, createRuntime(d), .5); expect(r.activities[open.id].status).toBe('running'); expect(gateState(d, r).allowed).toBe(false);
    r = chooseRuntime(d, r, detourPos, true); expect(r.activities[open.id].status).toBe('running');
    r = tickRuntime(d, r, 2); expect(r.activities[open.id].status).toBe('complete');
    r = returnDetour(d, r); expect(r.positionId).toBe(first.id); expect(gateState(d, r).allowed).toBe(true);
  });
  it('cancels abandoned Camera work when navigating to a held viewpoint', () => {
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); const entry = Object.values(d.experience.uses).find(u => u.encounterId === e)!.id; const entryDef = definition(d, entry) as ViewDefinition;
    entryDef.automatic = false; entryDef.anchor = 'fixed'; entryDef.position = [40, 10, 40]; entryDef.target = [-3, 1.4, -1]; entryDef.speed = 'slow';
    const second = addView(d, e, { position: [-3, 2.6, 3.1], target: [-3, 1.4, -1] }, 'Second'); const nid = addNarration(d, e); const def = definition(d, nid)!; if (def.kind === 'narration') { def.duration = 30; def.markers = [{ id: 'm', label: 'M', time: 1 }]; }
    d.experience.uses[second].cue = { useId: nid, signal: 'marker:m' };
    const [, held] = addToGuide(d, e, 'main', [entry, second]); d.experience.positions[held].presentation = 'hold';
    let r = tickRuntime(d, createRuntime(d, false, { position: [12, 10, 16], target: [0, 1, 0] }), 2); expect(r.queue).toHaveLength(1); expect(r.movement).not.toBeNull();
    r = nextRuntime(d, r); expect(r.positionId).toBe(held); expect(r.camera).toBeNull(); expect(r.movement).toBeNull(); expect(r.queue).toHaveLength(0); expect(r.pose!.position[0]).toBeLessThan(20);
  });
  it('resets the checkpoint cue cutoff when a different Encounter opens', () => {
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); addView(d, e); const second = addView(d, e); const late = addView(d, e); const nid = addNarration(d, e); const def = definition(d, nid)!;
    if (def.kind === 'narration') { def.duration = 18; def.markers = [{ id: 'm12', label: 'Twelve', time: 12 }]; } d.experience.uses[second].cue = { useId: nid, signal: 'marker:m12' }; d.experience.uses[late].cue = { useId: nid, signal: 'marker:m12' };
    addToGuide(d, e, 'main', [late]);
    const f = addEncounter(d, { kind: 'subjects', ids: ['piano'] }); addView(d, f); const fSecond = addView(d, f); const fn = addNarration(d, f); const fdef = definition(d, fn)!;
    if (fdef.kind === 'narration') { fdef.duration = 12; fdef.markers = [{ id: 'm2', label: 'Two', time: 2 }]; } d.experience.uses[fSecond].cue = { useId: fn, signal: 'marker:m2' };
    let r = tickRuntime(d, createRuntime(d), 1); expect(r.cueFloor).toBe(12);
    r = openEncounterRuntime(d, r, f); expect(r.cueFloor).toBe(0); const token = r.camera!.token;
    r = tickRuntime(d, r, 3); expect(r.camera!.token).toBeGreaterThan(token);
  });
  it('queues a presentation cue behind a movement already in flight', () => {
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); const entry = Object.values(d.experience.uses).find(u => u.encounterId === e)!.id; const entryDef = definition(d, entry) as ViewDefinition;
    entryDef.automatic = false; entryDef.anchor = 'fixed'; entryDef.position = [40, 10, 40]; entryDef.target = [-3, 1.4, -1]; entryDef.speed = 'slow';
    const second = addView(d, e, { position: [-3, 2.6, 3.1], target: [-3, 1.4, -1] }, 'Second'); const nid = addNarration(d, e); const def = definition(d, nid)!; if (def.kind === 'narration') { def.duration = 30; def.markers = [{ id: 'm', label: 'M', time: 1 }]; }
    d.experience.uses[second].cue = { useId: nid, signal: 'marker:m' }; addToGuide(d, e);
    let r = tickRuntime(d, createRuntime(d, false, { position: [12, 10, 16], target: [0, 1, 0] }), 2);
    expect(r.camera!.token).toBe(1); expect(r.camera!.position).toEqual(entryDef.position); expect(r.queue).toHaveLength(1);
    r = tickRuntime(d, r, 20); expect(r.camera!.token).toBe(2); expect(r.camera!.position).toEqual(solveView(d, definition(d, second) as ViewDefinition).position);
  });
  it('keeps the viewpoint and ignores presentation cues while a position holds it', () => {
    const d = exampleDocument(); const pid = d.experience.routes[0].ids[0]; d.experience.positions[pid].presentation = 'hold';
    const r = tickRuntime(d, createRuntime(d), 7); expect(r.positionId).toBe(pid); expect(r.camera).toBeNull(); expect(r.queue).toHaveLength(0);
  });
  it('does not pull an early checkpoint back to a cue it precedes', () => {
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); addView(d, e); const second = addView(d, e); const late = addView(d, e); const nid = addNarration(d, e); const def = definition(d, nid)!;
    if (def.kind === 'narration') { def.duration = 18; def.markers = [{ id: 'm6', label: 'Six', time: 6 }, { id: 'm12', label: 'Twelve', time: 12 }]; }
    d.experience.uses[second].cue = { useId: nid, signal: 'marker:m6' }; d.experience.uses[late].cue = { useId: nid, signal: 'marker:m12' };
    const [position] = addToGuide(d, e, 'main', [late]); let r = tickRuntime(d, createRuntime(d), 7);
    expect(r.positionId).toBe(position); expect(r.camera!.token).toBe(1); r = tickRuntime(d, r, 6); expect(r.camera!.token).toBe(2);
  });
  it('keeps fixed-step updates equivalent for a larger elapsed input', () => {
    const d = exampleDocument(); const one = tickRuntime(d, createRuntime(d), 4); let many = createRuntime(d); for (let i = 0; i < 80; i++) many = tickRuntime(d, many, .05);
    expect(many.time).toBeCloseTo(one.time, 5); expect(many.camera!.token).toBe(one.camera!.token); expect(Object.keys(many.emitted).sort()).toEqual(Object.keys(one.emitted).sort());
    expect(Object.keys(one.activities).map(k => `${k}:${one.activities[k].status}`).sort()).toEqual(Object.keys(many.activities).map(k => `${k}:${many.activities[k].status}`).sort());
  });
});
describe('presentation planning and Camera evaluation', () => {
  const cueFixture = () => { const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }, 'Explanation');
    const entry = Object.values(d.experience.uses).find(u => u.encounterId === e)!.id; const second = addView(d, e), third = addView(d, e); const nid = addNarration(d, e); const def = definition(d, nid)!;
    if (def.kind === 'narration') { def.duration = 18; def.markers = [{ id: 'm1', label: 'One', time: 6 }, { id: 'm2', label: 'Two', time: 12 }]; }
    d.experience.uses[second].cue = { useId: nid, signal: 'marker:m1' }; d.experience.uses[third].cue = { useId: nid, signal: 'marker:m2' }; return { d, e, entry };
  };
  it('evaluates one movement at a time and matches the documented numeric oracle', () => {
    const { d, e, entry } = cueFixture(); const steps = (values: number[]) => { const queue = [...values]; return () => queue.shift()!; };
    const slower = planPresentation(d, { encounterId: e, entryViewUseId: entry, measure: steps([2, 3, 4]) });
    expect(slower.narrationEnd).toBe(18); expect(slower.cameraArrival).toBe(16); expect(slower.readiness).toBe(20);
    const crawl = planPresentation(d, { encounterId: e, entryViewUseId: entry, measure: steps([2, 6, 8]) });
    expect(crawl.cameraArrival).toBe(20); expect(crawl.readiness).toBe(22);
  });
  it('presents the Encounter entry View when the position says Present this Encounter', () => {
    const d = exampleDocument(); const pid = d.experience.routes[0].ids[0]; const p = d.experience.positions[pid]; p.presentation = 'encounter'; p.viewUseId = null;
    expect(positionPlan(d, pid)!.requests[0].viewUseId).toBe(entryViewUse(d, p.encounterId)); expect(createRuntime(d).camera).not.toBeNull();
  });
  it('uses finite work and a scheduled persistent start without an infinite end', () => {
    const d = exampleDocument(); const pid = d.experience.routes[0].ids[0]; const position = d.experience.positions[pid];
    const plan = planPresentation(d, { encounterId: position.encounterId, entryViewUseId: position.viewUseId });
    expect(plan.narrationEnd).toBe(18); expect(plan.finiteEnd).toBe(1.5); expect(plan.persistentStart).toBe(1.5); expect(plan.readiness).toBe(20);
    expect(planPresentation(d, { encounterId: position.encounterId, entryViewUseId: position.viewUseId, speed: 'cut' }).readiness).toBe(20);
  });
  it('derives Camera travel from the greater displacement and the documented rate', () => {
    const from = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    const to = { position: [7, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    expect(travelSeconds(from, to, 'cut')).toBe(0); expect(travelSeconds(from, to, 'auto')).toBeCloseTo(1); expect(travelSeconds(from, to, 'slow')).toBeCloseTo(1.75);
  });
  it('derives narration duration and caption passages from the text', () => {
    const text = 'One two three four five. Six seven eight.';
    expect(narrationDuration(text)).toBeCloseTo(8 / 2.6);
    const passages = narrationPassages(text); expect(passages).toHaveLength(2); expect(passages[0].start).toBe(0); expect(passages[1].start).toBeCloseTo(passages[0].end); expect(passages.at(-1)!.end).toBeCloseTo(narrationDuration(text));
    const d = emptyDocument(); const e = addEncounter(d, { kind: 'subjects', ids: ['machine'] }); const nid = addNarration(d, e); expect(resolvedDuration(definition(d, nid) as never)).toBe(1);
  });
});
