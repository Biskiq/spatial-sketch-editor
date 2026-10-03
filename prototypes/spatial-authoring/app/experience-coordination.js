import { connectionPath, pathSeconds, stationProgress } from './camera-evaluation.js';
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
