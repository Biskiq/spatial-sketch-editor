export type Vec3 = [number, number, number];
export type Value = boolean | number | string;
/** Documented Camera travel presets. `cut` takes zero time; the rest are units per second. */
export type Speed = 'cut' | 'slow' | 'auto' | 'fast';
export const SPEED_RATES: Record<Speed, number> = { cut: 0, slow: 4, auto: 7, fast: 13 };
export const SPEEDS: Speed[] = ['cut', 'slow', 'auto', 'fast'];
export const speedLabel = (speed: Speed) => speed === 'auto' ? 'Auto' : speed[0].toUpperCase() + speed.slice(1);
export type Focus = { kind: 'subjects'; ids: string[] } | { kind: 'region'; min: Vec3; max: Vec3 } | { kind: 'view'; position: Vec3; target: Vec3 } | { kind: 'environment' };
export type Subject = { id: string; name: string; shape: string; position: Vec3; profileId: string; properties: Record<string, Value> };
export type Capability = { id: string; label: string; channel: string; kind: 'state' | 'motion' | 'loop' | 'playback'; control: 'toggle' | 'range' | 'buttons'; min?: number; max?: number; step?: number; actions?: { label: string; value: Value }[]; duration?: number; signals: string[]; sourceEditable: boolean };
export type Profile = { id: string; label: string; capabilities: Capability[] };
export type ViewDefinition = { id: string; kind: 'view'; name: string; focus: Focus; anchor: 'relative' | 'fixed'; automatic: boolean; position: Vec3; target: Vec3; offset: Vec3; distance: number; revision: number; speed: Speed };
export type NarrationDefinition = { id: string; kind: 'narration'; name: string; text: string; duration?: number; markers: { id: string; label: string; time: number }[] };
export type Passage = { text: string; start: number; end: number };
export type ControlDefinition = { id: string; kind: 'control'; name: string; subjectId: string; capabilityId: string; value: Value };
export type Definition = ViewDefinition | NarrationDefinition | ControlDefinition;
export type Start = { kind: 'encounter'; encounterId: string } | { kind: 'experience' } | { kind: 'after'; useId: string; signal: string; encounterId: string | null };
export type End = { kind: 'encounter'; encounterId: string } | { kind: 'experience' } | { kind: 'complete' };
export type Interruption = 'cancel' | 'finish' | 'continue';
export type Use = { id: string; kind: 'view' | 'narration' | 'behavior' | 'interaction'; definitionId: string; encounterId: string | null; start: Start; end: End; triggerSubjectId?: string; availability?: string | null; toggle?: boolean; cue?: SignalRef | null; interruption?: Interruption };
/** Type-based interruption default; an authored override is the only policy picker 4.1 needs. */
export function interruption(d: Document, u: Use): Interruption { if (u.interruption) return u.interruption;
  const def = definition(d, u); if (def?.kind === 'narration') return 'cancel';
  if (def?.kind === 'control') { const cap = capability(d, def.subjectId, def.capabilityId); if (cap?.kind === 'loop') return 'continue'; if (cap?.duration) return 'finish'; }
  return 'cancel'; }
export type Encounter = { id: string; name: string; purpose: string; focus: Focus };
export type SignalRef = { useId: string; signal: string };
export type Next = { kind: 'order' } | { kind: 'target'; positionId: string } | { kind: 'end' };
/** How a position presents: run the Encounter's viewing relationships, start from a particular View, or hold the current viewpoint. */
export type Presentation = 'encounter' | 'view' | 'hold';
export type Pacing = { kind: 'auto' } | { kind: 'dwell'; seconds: number } | { kind: 'signal'; ref: SignalRef };
export type Position = { id: string; encounterId: string; viewUseId: string | null; routeId: string; presentation: Presentation; next: Next; pacing: Pacing; travel: Speed | null; gate: SignalRef | null; choices: { id: string; label: string; kind: 'go' | 'detour'; targetId: string }[] };
export function entryViewUse(d: Document, encounterId: string): string | null { return Object.values(d.experience.uses).find(u => u.encounterId === encounterId && u.kind === 'view')?.id ?? null; }
/** The View this position presents on entry, or null when it holds the current viewpoint. */
export function positionView(d: Document, p: Position): string | null { return p.presentation === 'view' ? p.viewUseId : p.presentation === 'encounter' ? entryViewUse(d, p.encounterId) : null; }
export type ResolvedNext = { id: string | null; explicit: boolean; missing: boolean };
export type Document = { counter: number; world: { revision: number; subjects: Record<string, Subject>; profiles: Record<string, Profile> }; experience: { name: string; encounters: Record<string, Encounter>; definitions: Record<string, Definition>; uses: Record<string, Use>; positions: Record<string, Position>; routes: { id: string; name: string; ids: string[] }[] } };
export type Issue = { severity: 'error' | 'warning'; kind: 'use' | 'position' | 'encounter'; id: string; message: string };
export function id(d: Document, prefix: string) { return `${prefix}-${++d.counter}`; }
export function change(d: Document, fn: (draft: Document) => void): Document { const next = structuredClone(d); fn(next); return next; }
export function definition(d: Document, u: Use | string | null | undefined): Definition | undefined { const use = typeof u === 'string' ? d.experience.uses[u] : u; return use ? d.experience.definitions[use.definitionId] : undefined; }
export function capability(d: Document, subjectId: string, capId: string) { const s = d.world.subjects[subjectId]; return s && d.world.profiles[s.profileId]?.capabilities.find(c => c.id === capId); }
export function useName(d: Document, useId: string) { return definition(d, useId)?.name ?? 'Missing contribution'; }
export function encounterName(d: Document, eid: string | null | undefined) { return eid ? d.experience.encounters[eid]?.name ?? 'Missing encounter' : 'Experience'; }
export function usesIn(d: Document, eid: string | null) { return Object.values(d.experience.uses).filter(u => u.encounterId === eid); }
export function linkedCount(d: Document, defId: string) { return Object.values(d.experience.uses).filter(u => u.definitionId === defId).length; }
/** Simulated reading policy: fixed words-per-second, no audio. A duration override is optional. */
export const READING_WORDS_PER_SECOND = 2.6;
export function narrationDuration(text: string): number { const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0; return Math.max(1, words / READING_WORDS_PER_SECOND); }
export function resolvedDuration(def: NarrationDefinition): number { return def.duration && def.duration > 0 ? def.duration : narrationDuration(def.text); }
export function narrationPassages(text: string): Passage[] {
  const parts = text.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean); if (!parts.length) return [];
  const words = parts.map(part => part.split(/\s+/).filter(Boolean).length || 1); const total = words.reduce((sum, n) => sum + n, 0); const duration = narrationDuration(text);
  let at = 0; return parts.map((part, index) => { const span = duration * words[index] / total; const passage = { text: part, start: at, end: at + span }; at += span; return passage; });
}
/** Seconds at which a supported narration signal occurs, or null when it cannot be resolved. */
export function cueSeconds(d: Document, ref: SignalRef): number | null {
  const def = definition(d, ref.useId); if (def?.kind !== 'narration') return null;
  if (ref.signal === 'complete') return resolvedDuration(def);
  if (ref.signal.startsWith('marker:')) { const marker = def.markers.find(m => `marker:${m.id}` === ref.signal); return marker ? marker.time : null; }
  return null;
}
export function focusLabel(d: Document, focus: Focus) { return focus.kind === 'subjects' ? focus.ids.map(s => d.world.subjects[s]?.name ?? 'Missing subject').join(' + ') : focus.kind === 'region' ? 'Spatial region' : focus.kind === 'environment' ? 'Room environment' : 'Current viewpoint'; }
export function focusCenter(d: Document, f: Focus): Vec3 {
  if (f.kind === 'view') return f.target;
  if (f.kind === 'region') return f.min.map((n, i) => (n + f.max[i]) / 2) as Vec3;
  if (f.kind === 'environment') return [0, 1, 0];
  const subjects = f.ids.map(i => d.world.subjects[i]).filter(Boolean);
  if (!subjects.length) return [0, 1, 0];
  return [0, 1, 2].map(axis => subjects.reduce((sum, s) => sum + s.position[axis] + (axis === 1 ? 1.4 : 0), 0) / subjects.length) as Vec3;
}
export function automaticCamera(d: Document, focus: Focus) {
  const target = focusCenter(d, focus);
  let distance = focus.kind === 'environment' ? 14 : 7;
  if (focus.kind === 'subjects') { const ss = focus.ids.map(i => d.world.subjects[i]).filter(Boolean); distance = Math.max(6, ...ss.map(s => Math.hypot(s.position[0] - target[0], s.position[2] - target[2]) * 2 + (s.shape === 'wall' ? 9 : 5))); }
  if (focus.kind === 'region') distance = Math.max(5, Math.hypot(focus.max[0] - focus.min[0], focus.max[2] - focus.min[2]) * 1.3);
  return { position: [target[0] + distance * .65, target[1] + distance * .5, target[2] + distance] as Vec3, target };
}
export function solveView(d: Document, v: ViewDefinition) {
  const target = v.anchor === 'fixed' ? v.target : focusCenter(d, v.focus);
  if (v.automatic) { const auto = automaticCamera(d, v.focus); return { target: auto.target, position: auto.position.map((n, i) => auto.target[i] + (n - auto.target[i]) * v.distance) as Vec3 }; }
  return { target, position: v.anchor === 'fixed' ? target.map((n, i) => n + (v.position[i] - n) * v.distance) as Vec3 : target.map((n, i) => n + v.offset[i] * v.distance) as Vec3 };
}
export function addView(d: Document, eid: string, camera?: { position: Vec3; target: Vec3 }, name?: string) {
  const e = d.experience.encounters[eid]; const c = camera ?? automaticCamera(d, e.focus); const defId = id(d, 'def'); const useId = id(d, 'use');
  d.experience.definitions[defId] = { id: defId, kind: 'view', name: name ?? `View ${usesIn(d, eid).filter(u => u.kind === 'view').length + 1}`, focus: structuredClone(e.focus), anchor: camera ? 'fixed' : 'relative', automatic: !camera, position: c.position, target: c.target, offset: c.position.map((n, i) => n - c.target[i]) as Vec3, distance: 1, revision: d.world.revision, speed: 'auto' as Speed };
  d.experience.uses[useId] = { id: useId, kind: 'view', definitionId: defId, encounterId: eid, start: { kind: 'encounter', encounterId: eid }, end: { kind: 'encounter', encounterId: eid } };
  return useId;
}
export function addEncounter(d: Document, focus: Focus, name?: string, withView = true) {
  const eid = id(d, 'encounter'); d.experience.encounters[eid] = { id: eid, name: name ?? `Introduce ${focusLabel(d, focus)}`, purpose: '', focus: structuredClone(focus) }; if (withView) addView(d, eid, focus.kind === 'view' ? { position: focus.position, target: focus.target } : undefined); return eid;
}
export function addNarration(d: Document, eid: string) {
  const defId = id(d, 'def'); const useId = id(d, 'use');
  d.experience.definitions[defId] = { id: defId, kind: 'narration', name: 'Explanation', text: '', markers: [] };
  d.experience.uses[useId] = { id: useId, kind: 'narration', definitionId: defId, encounterId: eid, start: { kind: 'encounter', encounterId: eid }, end: { kind: 'encounter', encounterId: eid } }; return useId;
}
export function captureControl(d: Document, subjectId: string, capId: string, value: Value, eid: string | null, visitor = false) {
  const c = capability(d, subjectId, capId); if (!c) return '';
  const defId = id(d, 'def'); const useId = id(d, 'use');
  d.experience.definitions[defId] = { id: defId, kind: 'control', name: `${c.label} · ${d.world.subjects[subjectId].name}`, subjectId, capabilityId: capId, value };
  d.experience.uses[useId] = { id: useId, kind: visitor ? 'interaction' : 'behavior', definitionId: defId, encounterId: visitor ? null : eid, start: eid && !visitor ? { kind: 'encounter', encounterId: eid } : { kind: 'experience' }, end: visitor ? { kind: 'complete' } : eid ? { kind: 'encounter', encounterId: eid } : { kind: 'experience' }, ...(visitor ? { triggerSubjectId: subjectId, availability: null, toggle: c.control === 'toggle' } : {}) }; return useId;
}
export function editDefinition(d: Document, useId: string, shared: boolean, patch: Partial<Definition>) {
  const use = d.experience.uses[useId]; const def = definition(d, use); if (!def) return;
  if (!shared && linkedCount(d, def.id) > 1) { const fresh = id(d, 'def'); d.experience.definitions[fresh] = { ...structuredClone(def), id: fresh }; use.definitionId = fresh; }
  Object.assign(d.experience.definitions[use.definitionId], patch);
}
export function copyUse(d: Document, uid: string, eid: string | null, linked = false) {
  const old = d.experience.uses[uid]; const def = definition(d, old); if (!def) return '';
  const newId = id(d, 'use'); const copied = structuredClone(old); copied.id = newId; copied.encounterId = eid;
  if (!linked) { const did = id(d, 'def'); d.experience.definitions[did] = { ...structuredClone(def), id: did }; copied.definitionId = did; }
  // Duplication preserves authored boundaries; a newly reused view only has a new organizing home.
  d.experience.uses[newId] = copied; return newId;
}
/** The one resolver for a position's next destination. Route order is the default authority; an explicit target or end overrides it. */
export function resolveNext(d: Document, pid: string): ResolvedNext {
  const p = d.experience.positions[pid]; if (!p) return { id: null, explicit: false, missing: false };
  if (p.next.kind === 'end') return { id: null, explicit: true, missing: false };
  if (p.next.kind === 'target') return { id: p.next.positionId, explicit: true, missing: !d.experience.positions[p.next.positionId] };
  const route = d.experience.routes.find(r => r.id === p.routeId); const at = route ? route.ids.indexOf(pid) : -1;
  return { id: route && at >= 0 ? route.ids[at + 1] ?? null : null, explicit: false, missing: false };
}
/** Default: one position presenting the Encounter. Selected checkpoints are an explicit, separate action; occurrences are distinct positions and never clone a view use. */
export function addToGuide(d: Document, eid: string, routeId = 'main', selectedViews?: string[]) {
  let route = d.experience.routes.find(r => r.id === routeId); if (!route) { route = { id: routeId, name: routeId === 'main' ? 'Guide' : encounterName(d, eid), ids: [] }; d.experience.routes.push(route); }
  const views = usesIn(d, eid).filter(u => u.kind === 'view');
  const picks = selectedViews?.length ? selectedViews.filter(uid => !!d.experience.uses[uid]) : [views[0]?.id ?? null];
  const results: string[] = [];
  for (const uid of picks) { const pid = id(d, 'position'); d.experience.positions[pid] = { id: pid, encounterId: eid, viewUseId: uid, routeId, presentation: uid ? 'view' : 'hold', next: { kind: 'order' }, pacing: { kind: 'auto' }, travel: null, gate: null, choices: [] }; route.ids.push(pid); results.push(pid); }
  return results;
}
export function positionName(d: Document, pid: string | null | undefined) { const p = pid ? d.experience.positions[pid] : undefined; if (!p) return 'Missing position'; const view = positionView(d, p); return `${encounterName(d, p.encounterId)} / ${view ? useName(d, view) : 'Keep current viewpoint'}`; }
export function removeUse(d: Document, uid: string) { delete d.experience.uses[uid]; Object.values(d.experience.positions).forEach(p => { if (p.viewUseId === uid) { p.viewUseId = null; p.presentation = 'hold'; } }); }
export function removePosition(d: Document, pid: string) { const p = d.experience.positions[pid]; if (!p) return; const route = d.experience.routes.find(r => r.id === p.routeId); if (route) route.ids = route.ids.filter(i => i !== pid); delete d.experience.positions[pid]; }
export function movePosition(d: Document, pid: string, delta: number) { const p = d.experience.positions[pid]; const r = d.experience.routes.find(r => r.id === p.routeId); if (!r) return; const i = r.ids.indexOf(pid), j = i + delta; if (j < 0 || j >= r.ids.length) return; [r.ids[i], r.ids[j]] = [r.ids[j], r.ids[i]]; }
export function signals(d: Document, uid: string): string[] { const u = d.experience.uses[uid], def = definition(d, u); if (!def) return [];  if (def.kind === 'narration') { const span = resolvedDuration(def); return ['complete', ...def.markers.filter(m => m.time > 0 && m.time <= span).map(m => `marker:${m.id}`)]; } if (def.kind === 'control') return capability(d, def.subjectId, def.capabilityId)?.signals ?? []; return []; }
export function signalLabel(d: Document, ref: SignalRef) { const def = definition(d, ref.useId); return `${useName(d, ref.useId)} · ${ref.signal === 'complete' ? 'finished' : def?.kind === 'narration' ? def.markers.find(m => `marker:${m.id}` === ref.signal)?.label ?? 'Missing marker' : ref.signal}`; }
export function allSignals(d: Document) { return Object.values(d.experience.uses).flatMap(u => signals(d, u.id).map(signal => ({ useId: u.id, signal }))); }
export function validate(d: Document): Issue[] {
  const issues: Issue[] = []; const push = (kind: Issue['kind'], itemId: string, message: string, severity: Issue['severity'] = 'error') => issues.push({ kind, id: itemId, message, severity });
  const validSignal = (ref: SignalRef) => signals(d, ref.useId).includes(ref.signal);
  for (const u of Object.values(d.experience.uses)) { const def = definition(d, u); if (!def) { push('use', u.id, 'Definition is missing. Replace or remove this contribution.'); continue; }
    if (def.kind === 'control') { if (!d.world.subjects[def.subjectId]) push('use', u.id, 'Subject is missing. Rebind this contribution.'); else if (!capability(d, def.subjectId, def.capabilityId)) push('use', u.id, `${def.name}: capability unavailable. Choose a supported control.`); }
    if (def.kind === 'narration' && def.markers.some(m => m.time <= 0 || m.time > resolvedDuration(def))) push('use', u.id, 'Narration marker is outside its duration. Revise the marker or duration.');
    if (u.cue && !validSignal(u.cue)) push('use', u.id, 'View cue unavailable. Choose a supported phrase or remove it.');
    if (def.kind === 'view') { if (def.focus.kind === 'subjects' && def.focus.ids.some(i => !d.world.subjects[i])) push('use', u.id, `${def.name}: framing target missing.`); else if (def.anchor === 'fixed' && def.revision < d.world.revision) push('use', u.id, `${def.name}: world changed; review fixed framing.`, 'warning'); }
    if (u.start.kind === 'encounter' && !d.experience.encounters[u.start.encounterId]) push('use', u.id, 'Start encounter removed. Choose a new start.');
    if (u.start.kind === 'after' && !validSignal({ useId: u.start.useId, signal: u.start.signal })) push('use', u.id, 'Start signal unavailable. Choose a new dependency.');
    if (u.start.kind === 'after' && u.start.encounterId && !d.experience.encounters[u.start.encounterId]) push('use', u.id, 'Activation encounter removed. Choose a new start.');
    if (u.end.kind === 'encounter' && !d.experience.encounters[u.end.encounterId]) push('use', u.id, 'End encounter removed. Choose a new boundary.');
    if (u.kind === 'interaction' && !d.world.subjects[u.triggerSubjectId ?? '']) push('use', u.id, 'Activation target missing. Choose a subject.');
    if (u.kind === 'interaction' && u.availability && !d.experience.encounters[u.availability]) push('use', u.id, 'Availability encounter removed. Choose Throughout the Experience or another Encounter.');
    const seen = new Set([u.id]); let at: Use | undefined = u; while (at?.start.kind === 'after') { const dependencyId: string = at.start.useId; if (seen.has(dependencyId)) { push('use', u.id, 'Dependency cycle. Choose a different start.'); break; } seen.add(dependencyId); at = d.experience.uses[dependencyId]; }
  }
  for (const p of Object.values(d.experience.positions)) { if (!d.experience.encounters[p.encounterId]) push('position', p.id, 'Encounter removed. Replace this position’s encounter.'); if (p.presentation === 'view' && (!p.viewUseId || !d.experience.uses[p.viewUseId])) push('position', p.id, 'Framing removed. Choose a View or Keep current viewpoint.'); if (resolveNext(d, p.id).missing) push('position', p.id, 'Next destination removed. Choose a replacement.'); if (p.gate && !validSignal(p.gate)) push('position', p.id, 'Required signal unavailable. Repair or remove this gate.'); if (p.pacing.kind === 'signal' && !validSignal(p.pacing.ref)) push('position', p.id, 'Autoplay signal unavailable. Choose new pacing.'); p.choices.forEach(c => { if (!d.experience.positions[c.targetId]) push('position', p.id, `Choice “${c.label}” has a missing destination.`); }); }
  return issues;
}
