import { connectionPath, pathSeconds, stationProgress, evaluatePath, routeGeometry } from './camera-evaluation.js';
// Experience owns holds; Camera owns stations and path timing. Never copy station geometry here.
export function movementTiming(camera, seam, path, speed, connectionId = null) {
 const travelDuration = pathSeconds(path, speed);
 const connection = camera.connections[connectionId];
 const beats = seam?.mode === 'travel' && connection
  ? seam.beats.filter(beat => beat.connectionId === connectionId) : [];
 const located = beats.map(beat => ({...beat, progress: stationProgress(connection, path, beat.stationId)})).filter(beat => beat.progress !== null);
 const holds = located.filter(beat => beat.kind === 'hold').sort((a,b) => a.progress-b.progress);
 let accumulated = 0;
 for (const hold of holds) { hold.at = hold.progress*travelDuration+accumulated; accumulated += hold.seconds; }
 const invokes = located.filter(beat => beat.kind === 'invoke').map(beat => ({...beat,
  at: beat.progress*travelDuration+holds.filter(hold => hold.progress < beat.progress).reduce((sum,hold) => sum+hold.seconds,0), fired:false}));
 return {travelDuration, duration:travelDuration+accumulated, holds, invokes};
}
// UX6: the one time mapping. The Journey Deck, the Cue Card, Rehearse and the visitor runtime all read
// it, so a playhead cannot disagree with the visit it rehearses — Cue times, the total and the inverse
// (time → path progress) come from the same holds the run uses. A Cue is not an authored object: its
// identity is the (Guide edge, connection, station) triple, so one Camera route serving two edges shows
// two Cues, each with its own pause, even though the geometry underneath is shared.
export function journeyClock(camera, seam, connectionId, speedOverride = null) {
 const route = camera.connections[connectionId];
 const geometry = route ? routeGeometry(camera, connectionId) : null;
 if (!geometry) return null;
 // The nominal Journey is read with Travel in force, exactly as `coordinateTiming` reads a beat's time:
 // a Cut edge has a nominal length to rehearse even though the visit snaps through it, and the reading
 // says which of the two it is.
 const timing = movementTiming(camera, {...seam, mode:'travel'}, geometry.path, speedOverride || route.speed, connectionId);
 const active = seam?.mode === 'travel';
 const holds = [...timing.holds].sort((a, b) => a.at - b.at);
 const cues = [];
 for (const station of geometry.stations) {
  const members = (seam?.beats || []).filter(b => b.connectionId === connectionId && b.stationId === station.id);
  if (!members.length) continue;
  const cueHolds = members.filter(b => b.kind === 'hold')
   .map(b => ({ id: b.id, seconds: b.seconds, at: holds.find(h => h.id === b.id)?.at ?? null })).sort((a, b) => a.at - b.at);
  const cueInvokes = members.filter(b => b.kind === 'invoke')
   .map(b => ({ id: b.id, useId: b.useId, at: timing.invokes.find(i => i.id === b.id)?.at ?? null }));
  const times = [...cueHolds, ...cueInvokes].map(b => b.at).filter(v => v !== null);
  cues.push({ id: station.id, stationId: station.id, connectionId, label: stationLabel(route, station.id),
   progress: station.progress, pose: station.pose, observer: station.observer,
   at: times.length ? Math.min(...times) : null,
   pause: cueHolds.reduce((n, h) => n + h.seconds, 0), holds: cueHolds, invokes: cueInvokes,
   name: cueInvokes.length ? null : cueHolds.length ? 'Pause' : 'Cue' });
 }
 const duration = timing.duration;
 // The inverse of the holds mapping: inside a hold the path stands still while the clock runs on.
 const progressAt = (t) => {
  const time = Math.max(0, Math.min(duration, t));
  let paused = 0;
  for (const h of holds) {
   if (time >= h.at + h.seconds) paused += h.seconds;
   else if (time > h.at) return h.progress;
  }
  return timing.travelDuration ? Math.max(0, Math.min(1, (time - paused) / timing.travelDuration)) : 1;
 };
 return { connectionId, route, geometry, path: geometry.path, travelDuration: timing.travelDuration, duration,
  active, reason: active ? null : 'Inactive while the edge is Cut',
  cues, holds: timing.holds, invokes: timing.invokes, pause: holds.reduce((n, h) => n + h.seconds, 0),
  progressAt, poseAt: (t) => evaluatePath(geometry.path, progressAt(t)), observerAt: (t) => evaluatePath(geometry.path, progressAt(t)) };
}
// §3.4/§5.6: one station name for every reader. An authored path point reads as the point it is, a
// named mid-route marker keeps its own name, and `Anchor n` — a Camera field name — is never shown.
export function stationLabel(route, stationId) {
 if (stationId === 'departure') return 'Departure';
 if (stationId === 'arrival') return 'Arrival';
 const at = (route?.anchors || []).findIndex(a => a.id === stationId);
 if (at >= 0) return `Point ${at + 1}`;
 return route?.markers?.find(m => m.id === stationId)?.name || 'Station';
}
// §3.4/§5.6: one Cue name for the Deck, the Card and the Stage. A named mid-route station names the Cue;
// otherwise the first Activity it invokes does; otherwise the Cue reads as the pause it holds. Nothing here
// is persisted — the name is derived from what the author already authored.
export function cueName(experience, route, cue) {
 if (!cue) return '';
 const marker = route?.markers?.find(m => m.id === cue.stationId);
 if (marker?.name) return marker.name;
 const first = cue.invokes?.[0];
 const action = first ? experience?.definitions?.[experience?.uses?.[first.useId]?.definitionId]?.name : null;
 if (action) return action;
 const at = stationLabel(route, cue.stationId);
 return cue.holds?.length ? `Pause · ${at}` : `Cue at ${at}`;
}
// A Cue's member beats, by its identity — the one reader both the Card and the move operation use.
export function cueMembers(seam, connectionId, stationId) {
 return (seam?.beats || []).filter(b => b.connectionId === connectionId && b.stationId === stationId);
}
// The stations a Cue may move to: every authored station on its own connection except the one it already
// holds and any station another Cue already occupies. Nothing is offered that the writer would refuse.
export function cueDestinations(camera, seam, connectionId, stationId) {
 const geometry = routeGeometry(camera, connectionId);
 if (!geometry) return [];
 const occupied = new Set((seam?.beats || []).filter(b => b.connectionId === connectionId && b.stationId !== stationId).map(b => b.stationId));  const route = camera.connections[connectionId];
  return geometry.stations.filter(s => s.id !== stationId && !occupied.has(s.id)).map(s => ({ ...s, label: stationLabel(route, s.id) }));
}
export function coordinateTiming(camera,seam) {
 return seam.beats.map(beat=>{
  const c=camera.connections[beat.connectionId],from=camera.views[c?.from],to=camera.views[c?.to];
  if(!c||!from||!to)return {...beat,at:null,reason:'Camera connection unresolved'};
  const path=connectionPath(c,from.pose,to.pose),progress=stationProgress(c,path,beat.stationId);
  if(progress===null)return {...beat,at:null,reason:'Camera station unresolved'};
  const timing=movementTiming(camera,{...seam,mode:'travel'},path,c.speed,c.id);
  const at=[...timing.holds,...timing.invokes].find(b=>b.id===beat.id)?.at??null;
  return {...beat,at,reason:seam.mode==='travel'?null:'Inactive while Seam is Cut'};
 });
}
