import { connectionPath, pathSeconds, stationProgress } from './camera-evaluation.js';
// Experience owns holds; Camera owns stations and path timing. Never copy station geometry here.
export function coordinateTiming(camera,seam) {
 return seam.beats.map(beat=>{
  const c=camera.connections[beat.connectionId],from=camera.views[c?.from],to=camera.views[c?.to];
  if(!c||!from||!to)return {...beat,at:null,reason:'Camera connection unresolved'};
  const path=connectionPath(c,from.pose,to.pose),progress=stationProgress(c,path,beat.stationId);
  if(progress===null)return {...beat,at:null,reason:'Camera station unresolved'};
  const holds=seam.beats.filter(other=>other.id!==beat.id&&other.connectionId===c.id&&other.kind==='hold').reduce((sum,other)=>{const t=stationProgress(c,path,other.stationId);return sum+(t!==null&&t<progress?other.seconds:0);},0);
  return {...beat,at:progress*pathSeconds(path,c.speed)+holds,reason:null};
 });
}
