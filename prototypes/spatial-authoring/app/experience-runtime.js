import { copy, entryUse, resolveUse } from './experience-model.js';
import { pathSeconds, evaluatePath } from './camera-evaluation.js';
// Runtime is isolated session state. It requests Camera evaluation; it authors nothing.
export function createRuntime(e,c,pid,pose) {
 const r={time:0,serial:0,visit:1,presentationId:pid,stopId:null,viewUseId:null,pose:copy(pose),movement:null,activities:{},overrides:{},signals:{},autoplay:false,exploring:false,history:[],bookmarks:[],log:[]};
 const u=entryUse(e,pid); if(u) requestView(r,e,c,u.id,'cut');
 return r;
}
export function requestView(r,e,c,id,speed='auto',path=null) {
 const resolved=resolveUse(e,c,id); if(!resolved) { r.refusal='Framing removed — choose a View or explicitly keep viewpoint';return false; }
 const route=path || [copy(r.pose),copy(resolved.view.pose)];
 const duration=pathSeconds(route,speed);
 r.movement={token:++r.serial,path:route,duration,elapsed:0}; r.viewUseId=id;
 if(!duration) { r.pose=evaluatePath(route,1); r.movement=null; }
 return true;
}
export function tickRuntime(e,c,current,seconds) {
 const r=copy(current); let remaining=Math.max(0,seconds);
 while(remaining>1e-9) { const dt=Math.min(.25,remaining); remaining-=dt; r.time+=dt;
  if(r.movement) { const m=r.movement; m.elapsed=Math.min(m.duration,m.elapsed+dt); r.pose=evaluatePath(m.path,m.duration?m.elapsed/m.duration:1); if(m.elapsed>=m.duration)r.movement=null; }
 }
 return r;
}
