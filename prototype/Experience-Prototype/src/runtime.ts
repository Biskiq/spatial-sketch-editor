import { capability, cueSeconds, definition, encounterName, interruption, positionName, positionView, resolvedDuration, resolveNext, solveView, useName, validate, type Document, type Position, type SignalRef, type Speed, type Use, type Value, type Vec3 } from './model';
import { lerpPose, smoothstep, travelSeconds, type CameraPose } from './camera';
import { BREATHING, positionPlan } from './presentation';
export type Activity = { useId: string; status: 'waiting' | 'running' | 'paused' | 'complete' | 'stopped' | 'unavailable'; elapsed: number; duration: number | null; startValue?: Value; value?: Value; reason?: string };
type VisitScope = { emitted: Record<string, boolean>; emittedVisit: Record<string, number>; visits: number };
type QueuedRequest = { useId: string; speed: Speed | null };
type Bookmark = { positionId: string | null; encounterId: string | null; history: string[]; narrationIds: string[]; autoplay: boolean } & VisitScope;
export type Movement = { token: number; from: CameraPose; to: CameraPose; speed: Speed; elapsed: number; duration: number };
export type Runtime = { time: number; encounterId: string | null; positionId: string | null; history: string[]; bookmarks: Bookmark[]; activities: Record<string, Activity>; overrides: Record<string, Record<string, { value: Value; owner: string }>>; emitted: Record<string, boolean>; log: { time: number; message: string }[]; autoplay: boolean; exploring: boolean; positionElapsed: number; pacingFallback: boolean; emittedVisit: Record<string, number>; camera: { token: number; position: Vec3; target: Vec3 } | null; movement: Movement | null; queue: QueuedRequest[]; cueFloor: number; pose: CameraPose | null; cameraCounter: number; autoRemaining: number; visits: number };
const key = (ref: SignalRef) => `${ref.useId}|${ref.signal}`;
const note = (r: Runtime, message: string) => { r.log.push({ time: r.time, message }); r.log = r.log.slice(-60); };
export function projectedValue(d: Document, r: Runtime | null, sid: string, channel: string): Value { return r?.overrides[sid]?.[channel]?.value ?? d.world.subjects[sid]?.properties[channel] ?? false; }
/** A signal only counts when it was emitted during the current visit, so a past visit cannot satisfy a new Gate. */
export function signalEmitted(r: Runtime, ref: SignalRef): boolean { const k = key(ref); return !!r.emitted[k] && (r.emittedVisit[k] ?? r.visits) === r.visits; }
function removeOwned(r: Runtime, uid: string) { for (const channels of Object.values(r.overrides)) for (const [channel, patch] of Object.entries(channels)) if (patch.owner === uid) delete channels[channel]; }
function stop(r: Runtime, uid: string, reason: string, d?: Document) { const a = r.activities[uid]; const unfinished = a && ['running', 'waiting', 'paused'].includes(a.status); if (a) { a.status = 'stopped'; a.reason = reason; } removeOwned(r, uid); if (d && unfinished) for (const use of Object.values(d.experience.uses)) if (use.start.kind === 'after' && use.start.useId === uid && r.activities[use.id]?.status === 'waiting') stop(r, use.id, 'Start dependency ended before completion', d); }
function invalidUse(d: Document, uid: string) { return validate(d).some(i => i.kind === 'use' && i.id === uid && i.severity === 'error'); }
function put(r: Runtime, sid: string, channel: string, value: Value, owner: string) { r.overrides[sid] ??= {}; r.overrides[sid][channel] = { value, owner }; }
function emit(r: Runtime, d: Document, uid: string, signal: string) {
  r.emitted[key({ useId: uid, signal })] = true; r.emittedVisit[key({ useId: uid, signal })] = r.visits;
  for (const u of Object.values(d.experience.uses)) if (u.start.kind === 'after' && u.start.useId === uid && u.start.signal === signal && r.activities[u.id]?.status === 'waiting') begin(r, d, u);
}
function complete(r: Runtime, d: Document, uid: string) {
  const a = r.activities[uid], u = d.experience.uses[uid]; if (!a || !u) return; a.status = 'complete';
  const def = definition(d, u); if (def?.kind === 'control') { const cap = capability(d, def.subjectId, def.capabilityId); if (cap?.kind === 'playback') put(r, def.subjectId, cap.channel, false, uid); }
  emit(r, d, uid, 'complete'); if (def?.kind === 'narration') fireCue(r, d, { useId: uid, signal: 'complete' });
  // Finishing a finite operation must not erase its result; the declared boundary or a newer command releases it.
  note(r, `${useName(d, uid)} finished`);
}
function begin(r: Runtime, d: Document, u: Use, interaction = false) {
  if (u.kind === 'view') return;
  if (invalidUse(d, u.id)) { r.activities[u.id] = { useId: u.id, status: 'unavailable', elapsed: 0, duration: null, reason: 'Repair required' }; return; }
  const existing = r.activities[u.id]; if (!interaction && existing && ['running', 'paused'].includes(existing.status)) return;
  for (const k of Object.keys(r.emitted)) if (k.startsWith(`${u.id}|`)) delete r.emitted[k];
  const def = definition(d, u); if (!def) return;
  const a: Activity = { useId: u.id, status: 'running', elapsed: 0, duration: null }; r.activities[u.id] = a;    if (def.kind === 'narration') a.duration = Math.max(.1, resolvedDuration(def));
  if (def.kind === 'control') {
    const cap = capability(d, def.subjectId, def.capabilityId)!; const current = projectedValue(d, r, def.subjectId, cap.channel);
    const resolved = interaction && u.toggle ? !current : def.value;
    a.startValue = current; a.value = resolved;
    const priorOwner = r.overrides[def.subjectId]?.[cap.channel]?.owner; if (priorOwner && priorOwner !== u.id) { stop(r, priorOwner, 'Replaced by a new command', d); note(r, `${def.name} replaces an earlier command`); }
    a.duration = cap.kind === 'loop' ? null : cap.duration ?? 0;
    if ((cap.kind === 'loop' || cap.kind === 'playback') && resolved === false) a.duration = 0;
    if (cap.kind === 'motion' && current === resolved) a.duration = 0;
    put(r, def.subjectId, cap.channel, cap.kind === 'motion' && typeof resolved === 'number' && a.duration !== 0 ? current : resolved, u.id);
  }
  note(r, `${useName(d, u.id)} started${interaction ? ' by visitor' : ''}`);
  if (a.duration === 0) complete(r, d, u.id);
}
function arm(r: Runtime, d: Document, u: Use) {
  if (u.kind === 'view' || u.kind === 'interaction') return;
  const existing = r.activities[u.id]; if (existing && ['running', 'paused', 'waiting'].includes(existing.status)) return;
  if (u.start.kind === 'after') r.activities[u.id] = { useId: u.id, status: invalidUse(d, u.id) ? 'unavailable' : 'waiting', duration: null, elapsed: 0 };
  else begin(r, d, u);
}
function closeEncounter(r: Runtime, d: Document, eid: string | null) {
  if (!eid) return;
  for (const u of Object.values(d.experience.uses)) { const a = r.activities[u.id]; if (!a) continue;
    const scoped = (u.start.kind === 'encounter' && u.start.encounterId === eid) || (u.start.kind === 'after' && u.start.encounterId === eid);
    if (a.status === 'waiting' && scoped) { stop(r, u.id, 'Disarmed when the visit ended', d); continue; }
    if (!(u.end.kind === 'encounter' && u.end.encounterId === eid)) continue;
    if (a.status === 'complete') removeOwned(r, u.id);
    else if (['running', 'paused'].includes(a.status) && interruption(d, u) === 'cancel') stop(r, u.id, 'Encounter closed', d); }
  note(r, `Moved on from ${encounterName(d, eid)}`);
}
function enterEncounter(r: Runtime, d: Document, eid: string) {
  if (r.encounterId === eid) return;
  closeEncounter(r, d, r.encounterId); r.encounterId = eid; r.visits++;
  // Arm dependencies before state operations can report immediate completion.
  const incoming = Object.values(d.experience.uses).filter(u => u.start.kind === 'encounter' ? u.start.encounterId === eid : u.start.kind === 'after' && u.start.encounterId === eid);
  incoming.filter(u => u.start.kind === 'after').forEach(u => arm(r, d, u)); incoming.filter(u => u.start.kind !== 'after').forEach(u => arm(r, d, u));
  note(r, `Opened ${encounterName(d, eid)}`);
}
/** Interpolated pose while a movement is in flight, otherwise the destination pose. */
export function cameraPose(r: Runtime): CameraPose | null {
  if (!r.camera) return null;
  if (r.movement && r.movement.duration > 0 && r.movement.elapsed < r.movement.duration) return lerpPose(r.movement.from, r.movement.to, smoothstep(r.movement.elapsed / r.movement.duration));
  return { position: r.camera.position, target: r.camera.target };
}
/** Freeze the Camera where it currently is and drop any queued or in-flight work a navigation no longer wants. */
function holdViewpoint(r: Runtime) { r.pose = cameraPose(r) ?? r.pose; r.camera = null; r.movement = null; r.queue = []; }
/** Start a movement from the interpolated current pose. */
function startMovement(r: Runtime, d: Document, uid: string, speedOverride?: Speed | null) {
  const def = definition(d, uid); if (def?.kind !== 'view') return;
  const to = solveView(d, def); const speed = speedOverride ?? def.speed ?? 'auto'; const from = cameraPose(r) ?? r.pose ?? to; const duration = travelSeconds(from, to, speed);
  r.camera = { token: ++r.cameraCounter, ...to };
  r.movement = duration > 0 ? { token: r.cameraCounter, from, to, speed, elapsed: 0, duration } : null;
}
/** Explicit navigation interrupts the current movement; a presentation cue queues behind one already in flight so movements stay sequential. */
function requestCamera(r: Runtime, d: Document, uid: string | null, speedOverride?: Speed | null, interrupt = true) {
  if (!uid || definition(d, uid)?.kind !== 'view') return;
  if (interrupt) { r.queue = []; startMovement(r, d, uid, speedOverride); return; }
  if (r.movement) { r.queue.push({ useId: uid, speed: speedOverride ?? null }); return; }
  startMovement(r, d, uid, speedOverride);
}
/** Seconds at or after which the current position expects presentation cues, so an early checkpoint never pulls the Camera backward. */
function cueFloorFor(d: Document, p: Position): number { if (p.presentation === 'hold') return 0; const view = positionView(d, p); const use = view ? d.experience.uses[view] : undefined; const at = use?.cue ? cueSeconds(d, use.cue) : null; return at ?? 0; }
function fireCue(r: Runtime, d: Document, ref: SignalRef) {
  if (r.exploring) return; if (r.positionId && d.experience.positions[r.positionId]?.presentation === 'hold') return;
  const at = cueSeconds(d, ref); if (at !== null && at < r.cueFloor - 1e-9) return;
  const source = d.experience.uses[ref.useId];
  for (const u of Object.values(d.experience.uses)) if (u.kind === 'view' && u.cue && u.cue.useId === ref.useId && u.cue.signal === ref.signal && u.encounterId === source?.encounterId) requestCamera(r, d, u.id, null, false);
}
/** Remaining supported work for a visit: the estimate minus narration already heard, plus a rejoin allowance. */
function positionRemaining(r: Runtime, d: Document, pid: string) {
  const plan = positionPlan(d, pid, cameraPose(r) ?? r.pose); const p = d.experience.positions[pid]; if (!plan || !p) return BREATHING;
  const progressed = Object.values(d.experience.uses).reduce((max, u) => u.encounterId === p.encounterId && u.kind === 'narration' ? Math.max(max, r.activities[u.id]?.elapsed ?? 0) : max, 0);
  return Math.max(BREATHING, plan.readiness - progressed);
}
function go(r: Runtime, d: Document, pid: string, record = true) {
  const p = d.experience.positions[pid]; if (!p || !d.experience.encounters[p.encounterId]) return;
  if (record && r.positionId) r.history.push(r.positionId);
  enterEncounter(r, d, p.encounterId); r.positionId = pid; r.positionElapsed = 0; r.exploring = false;
  r.pacingFallback = p.pacing.kind === 'signal' && signalEmitted(r, p.pacing.ref); const view = positionView(d, p); if (view) requestCamera(r, d, view, p.travel, true); else holdViewpoint(r); r.cueFloor = cueFloorFor(d, p);
  r.autoRemaining = positionRemaining(r, d, pid);
  note(r, `Guide: ${positionName(d, pid)}`);
}
export function createRuntime(d: Document, autoplay = false, pose: CameraPose | null = null): Runtime {
  const r: Runtime = { time: 0, encounterId: null, positionId: null, history: [], bookmarks: [], activities: {}, overrides: {}, emitted: {}, emittedVisit: {}, log: [], autoplay, exploring: false, positionElapsed: 0, pacingFallback: false, camera: null, movement: null, queue: [], cueFloor: 0, pose, cameraCounter: 0, autoRemaining: BREATHING, visits: 0 };
  Object.values(d.experience.uses).filter(u => u.start.kind === 'after' && !u.start.encounterId).forEach(u => arm(r, d, u));
  Object.values(d.experience.uses).filter(u => u.start.kind === 'experience').forEach(u => arm(r, d, u));
  const first = d.experience.routes.find(route => route.id === 'main')?.ids[0]; if (first) go(r, d, first, false); else { r.exploring = true; note(r, 'Exploratory Experience: activate subjects or open an encounter'); }
  return r;
}
export function gateState(d: Document, r: Runtime): { allowed: boolean; reason: string } {
  const p = r.positionId ? d.experience.positions[r.positionId] : null;
  if (!p) return { allowed: false, reason: 'No Guide position' };
  const next = resolveNext(d, p.id);
  if (!next.id) return { allowed: false, reason: r.bookmarks.length ? 'Return to guide' : 'End of guide · explore freely' };
  if (next.missing || !d.experience.encounters[d.experience.positions[next.id]!.encounterId]) return { allowed: false, reason: 'Next destination needs repair' };
  if (p.gate && !signalEmitted(r, p.gate)) return { allowed: false, reason: 'Waiting for the authored condition' };
  if (validate(d).some(i => i.kind === 'position' && i.id === p.id && i.severity === 'error' && /Required|Encounter removed/.test(i.message))) return { allowed: false, reason: 'Required condition or encounter needs repair' };
  return { allowed: true, reason: '' };
}
export function nextRuntime(d: Document, current: Runtime) { const r = structuredClone(current); const p = r.positionId ? d.experience.positions[r.positionId] : null; const next = p ? resolveNext(d, p.id) : null; if (gateState(d, r).allowed && next?.id) go(r, d, next.id); return r; }
export function returnDetour(d: Document, current: Runtime) {
  const r = structuredClone(current); const b = r.bookmarks.pop(); if (!b) return r;
  closeEncounter(r, d, r.encounterId); r.encounterId = b.encounterId; r.positionId = b.positionId; r.history = b.history; r.autoplay = b.autoplay; r.exploring = false; r.positionElapsed = 0;
  // A detour resumes the same parent visit, so its completion records and signal scope come back with it. Persistent parent work
  // keeps running while the detour is open, so completions recorded meanwhile are merged back into that originating visit too.
  const emitted = { ...b.emitted }, emittedVisit = { ...b.emittedVisit };
  for (const k of Object.keys(r.emitted)) if (d.experience.uses[k.slice(0, k.indexOf('|'))]?.encounterId === b.encounterId) { emitted[k] = true; emittedVisit[k] = b.visits; }
  r.emitted = emitted; r.emittedVisit = emittedVisit; r.visits = b.visits;
  b.narrationIds.forEach(uid => { if (r.activities[uid]?.status === 'paused') r.activities[uid].status = 'running'; });
  const p = b.positionId ? d.experience.positions[b.positionId] : null; if (p) { const view = positionView(d, p); if (view) requestCamera(r, d, view, p.travel, true); r.pacingFallback = p.pacing.kind === 'signal' && signalEmitted(r, p.pacing.ref); r.cueFloor = cueFloorFor(d, p); r.autoRemaining = positionRemaining(r, d, p.id); }
  note(r, 'Rejoined the saved guide position without replaying entry behavior'); return r;
}
export function previousRuntime(d: Document, current: Runtime) {
  const r = structuredClone(current); const last = r.history.at(-1);
  if (r.bookmarks.length && (!last || d.experience.positions[last]?.routeId !== d.experience.positions[r.positionId ?? '']?.routeId)) return returnDetour(d, r);
  const pid = r.history.pop(); if (pid) go(r, d, pid, false); return r;
}
export function chooseRuntime(d: Document, current: Runtime, targetId: string, detour: boolean) {
  const r = structuredClone(current); if (!d.experience.positions[targetId]) return r;
  if (detour) { const narrationIds = Object.values(r.activities).filter(a => a.status === 'running' && d.experience.uses[a.useId]?.kind === 'narration').map(a => a.useId); r.bookmarks.push({ positionId: r.positionId, encounterId: r.encounterId, history: [...r.history], narrationIds, autoplay: r.autoplay, emitted: { ...r.emitted }, emittedVisit: { ...r.emittedVisit }, visits: r.visits }); narrationIds.forEach(uid => { r.activities[uid].status = 'paused'; }); r.encounterId = null; go(r, d, targetId, false); note(r, 'Detour opened; parent explanation paused'); }
  else { for (const b of r.bookmarks) closeEncounter(r, d, b.encounterId); r.bookmarks = []; go(r, d, targetId); }
  return r;
}
export function exploreRuntime(current: Runtime) { const r = structuredClone(current); r.exploring = true; r.autoplay = false; r.camera = null; r.movement = null; r.queue = []; note(r, 'Free exploration · activities keep their authored boundaries'); return r; }
export function resumeGuide(d: Document, current: Runtime, pose: CameraPose | null = null) { const r = structuredClone(current); r.exploring = false; r.autoplay = false; r.positionElapsed = 0; r.pose = pose ?? r.pose;  const p = r.positionId ? d.experience.positions[r.positionId] : null; if (p) { const view = positionView(d, p); if (view) requestCamera(r, d, view, p.travel, true); r.cueFloor = cueFloorFor(d, p); r.autoRemaining = positionRemaining(r, d, p.id); } note(r, 'Returned to guidance; autoplay remains paused'); return r; }
export function autoplayRuntime(d: Document, current: Runtime, enabled: boolean) { const r = structuredClone(current); r.autoplay = enabled; r.positionElapsed = 0; const p = r.positionId ? d.experience.positions[r.positionId] : null;  r.pacingFallback = !!(p?.pacing.kind === 'signal' && signalEmitted(r, p.pacing.ref)); if (p) r.autoRemaining = positionRemaining(r, d, p.id); return r; }
export function stopActivityRuntime(d: Document, current: Runtime, uid: string) { const r = structuredClone(current); stop(r, uid, 'Stopped by visitor', d); note(r, `${useName(d, uid)} stopped by visitor`); return r; }
export function activateRuntime(d: Document, current: Runtime, uid: string) { const r = structuredClone(current); const u = d.experience.uses[uid]; if (u?.kind === 'interaction' && (!u.availability || u.availability === r.encounterId)) begin(r, d, u, true); return r; }
export function openEncounterRuntime(d: Document, current: Runtime, eid: string) {
  const r = structuredClone(current); if (!d.experience.encounters[eid]) return r;
  if (r.positionId) { const narrationIds = Object.values(r.activities).filter(a => a.status === 'running' && d.experience.uses[a.useId]?.kind === 'narration').map(a => a.useId); r.bookmarks.push({ positionId: r.positionId, encounterId: r.encounterId, history: [...r.history], narrationIds, autoplay: r.autoplay, emitted: { ...r.emitted }, emittedVisit: { ...r.emittedVisit }, visits: r.visits }); narrationIds.forEach(uid => { r.activities[uid].status = 'paused'; }); r.encounterId = null; }
  enterEncounter(r, d, eid); r.positionId = null; r.autoplay = false; r.exploring = false; r.cueFloor = 0; const view = Object.values(d.experience.uses).find(u => u.encounterId === eid && u.kind === 'view'); if (view) requestCamera(r, d, view.id, null, true); else holdViewpoint(r); return r;
}
export function closeRuntimeEncounter(d: Document, current: Runtime) { const r = structuredClone(current); closeEncounter(r, d, r.encounterId); r.encounterId = null; r.positionId = null; r.exploring = true; r.autoplay = false; holdViewpoint(r); return r; }
export function lookRuntime(d: Document, current: Runtime, uid: string) { const r = structuredClone(current); const u = d.experience.uses[uid]; if (u?.kind === 'view' && u.encounterId === r.encounterId && !r.positionId) { r.exploring = false; requestCamera(r, d, uid); note(r, `View suggestion: ${useName(d, uid)}`); } return r; }
/** Bounded fixed simulation steps: a larger elapsed input is split so cues and arrivals are neither missed nor duplicated. */
const MAX_STEP = .25;
export function tickRuntime(d: Document, current: Runtime, seconds: number): Runtime {
  let r = structuredClone(current); let remaining = Math.max(0, seconds);
  while (remaining > 1e-9) { const step = Math.min(MAX_STEP, remaining); r = stepRuntime(d, r, step); remaining -= step; }
  return r;
}
function stepRuntime(d: Document, r: Runtime, seconds: number): Runtime {
  r.time += seconds;
  if (r.movement) { r.movement.elapsed = Math.min(r.movement.duration, r.movement.elapsed + seconds); if (r.movement.elapsed >= r.movement.duration) r.movement = null; }
  const runningAtStart = Object.values(r.activities).filter(a => a.status === 'running').map(a => a.useId);
  for (const uid of runningAtStart) { const a = r.activities[uid]; if (a.status !== 'running') continue; const u = d.experience.uses[uid], def = definition(d, u); if (!u || !def) continue; const before = a.elapsed; a.elapsed += seconds;
    if (def.kind === 'narration') for (const m of def.markers) if (before < m.time && a.elapsed >= m.time) { emit(r, d, uid, `marker:${m.id}`); fireCue(r, d, { useId: uid, signal: `marker:${m.id}` }); note(r, `Narration marker: ${m.label}`); }
    if (def.kind === 'control') { const c = capability(d, def.subjectId, def.capabilityId); if (c?.kind === 'motion' && typeof a.value === 'number' && typeof a.startValue === 'number') put(r, def.subjectId, c.channel, a.startValue + (a.value - a.startValue) * Math.min(1, a.elapsed / Math.max(.001, a.duration ?? 1)), uid); }
    if (a.duration !== null && a.elapsed >= a.duration) { a.elapsed = a.duration; complete(r, d, uid); }
  }
  if (r.autoplay && !r.exploring && r.positionId) { r.positionElapsed += seconds; const p = d.experience.positions[r.positionId]; if (p) { const next = resolveNext(d, p.id); let ready: boolean;
    if (p.pacing.kind === 'dwell') ready = r.positionElapsed >= p.pacing.seconds;
    else if (p.pacing.kind === 'signal') ready = r.pacingFallback ? r.positionElapsed >= BREATHING : signalEmitted(r, p.pacing.ref);
    else { r.autoRemaining -= seconds; ready = r.autoRemaining <= 0; }
    if (ready && gateState(d, r).allowed && next.id) go(r, d, next.id); } }
  if (!r.movement && r.queue.length) { const next = r.queue.shift()!; startMovement(r, d, next.useId, next.speed); }
  return r;
}
export function runtimeInteractions(d: Document, r: Runtime) { return Object.values(d.experience.uses).filter(u => u.kind === 'interaction' && (!u.availability || u.availability === r.encounterId) && !invalidUse(d, u.id)); }
