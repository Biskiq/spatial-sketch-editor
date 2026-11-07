import { capability, cueSeconds, definition, positionView, resolvedDuration, solveView, usesIn, type Document, type Speed } from './model';
import { travelSeconds, viewPose, type CameraPose } from './camera';
/** Internal breathing allowance added to natural readiness. Never authored as an Encounter duration. */
export const BREATHING = 2;
/** Documented entry-pose assumption: estimates start from the room overview unless a real pose is supplied. */
export const ENTRY_POSE: CameraPose = { position: [13, 10, 17], target: [0, 1, 0] };
export type ViewRequest = { at: number; viewUseId: string };
export type PresentationPlan = { readiness: number; narrationEnd: number; cameraArrival: number; finiteEnd: number; persistentStart: number; requests: ViewRequest[]; entry: CameraPose };
type Measure = (from: CameraPose, to: CameraPose, viewUseId: string) => number;
/** Entry plus one request per View connected to a named phrase. Listing Views creates no order; a held viewpoint gets no requests. */
export function viewRequests(d: Document, encounterId: string, entryUseId: string | null, cues = true): ViewRequest[] {
  const requests: ViewRequest[] = []; if (entryUseId) requests.push({ at: 0, viewUseId: entryUseId });
  if (cues) for (const u of usesIn(d, encounterId)) if (u.kind === 'view' && u.id !== entryUseId && u.cue) { const at = cueSeconds(d, u.cue); if (at !== null) requests.push({ at, viewUseId: u.id }); }
  return requests.sort((a, b) => a.at - b.at);
}
function signalStart(d: Document, ref: { useId: string; signal: string }): number | null {
  const def = definition(d, ref.useId); if (!def) return null;
  if (def.kind === 'narration') return cueSeconds(d, ref);
  if (def.kind === 'control' && ref.signal === 'complete') return capability(d, def.subjectId, def.capabilityId)?.duration ?? 0;
  return null;
}
/** Evaluate one Camera movement at a time; a cue during travel begins when the current movement finishes. */
export function planPresentation(d: Document, opts: { encounterId: string; entryViewUseId: string | null; speed?: Speed | null; from?: CameraPose | null; measure?: Measure; cues?: boolean }): PresentationPlan {
  const entry = opts.from ?? ENTRY_POSE; const requests = viewRequests(d, opts.encounterId, opts.entryViewUseId, opts.cues !== false);
  let pose = entry, cameraArrival = 0;
  for (const request of requests) { const def = definition(d, request.viewUseId); if (def?.kind !== 'view') continue; const to = solveView(d, def); const fallback = (a: CameraPose, b: CameraPose) => travelSeconds(a, b, opts.speed ?? def.speed ?? 'auto'); const start = Math.max(request.at, cameraArrival); cameraArrival = start + (opts.measure ?? fallback)(pose, to, request.viewUseId); pose = to; }
  const narrations = usesIn(d, opts.encounterId).filter(u => u.kind === 'narration');
  const narrationEnd = narrations.reduce((max, u) => { const def = definition(d, u); return def?.kind === 'narration' ? Math.max(max, resolvedDuration(def)) : max; }, 0);
  let finiteEnd = 0, persistentStart = 0;
  for (const u of usesIn(d, opts.encounterId)) { const def = u.kind === 'behavior' ? definition(d, u) : undefined; if (def?.kind !== 'control') continue; const cap = capability(d, def.subjectId, def.capabilityId); if (!cap) continue;
    const start = u.start.kind === 'after' ? Math.max(0, signalStart(d, u.start) ?? 0) : 0;
    if (cap.kind === 'loop' || cap.duration == null) persistentStart = Math.max(persistentStart, start); else finiteEnd = Math.max(finiteEnd, start + cap.duration); }
  const work = Math.max(narrationEnd, cameraArrival, finiteEnd, persistentStart);
  return { readiness: work + BREATHING, narrationEnd, cameraArrival, finiteEnd, persistentStart, requests, entry };
}
export function positionPlan(d: Document, pid: string, from?: CameraPose | null, measure?: Measure): PresentationPlan | null {
  const p = d.experience.positions[pid]; if (!p) return null;
  return planPresentation(d, { encounterId: p.encounterId, entryViewUseId: positionView(d, p), cues: p.presentation !== 'hold', speed: p.travel, from, measure });
}
export { viewPose };
