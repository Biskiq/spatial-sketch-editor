// Native ESM adaptation of donor arm/begin/close, readiness and bounded stepping.
// Camera evaluation is delegated to the kernel beneath navigation; no renderer tween lives here.
import { copy, entryUse, resolveUse, stopEntry, resolveNext, getSeam, cueSeconds, narrationDuration, contributionIssues } from './experience-model.js';
import { pathSeconds, evaluatePath, connectionPath, findConnection, stationProgress } from './camera-evaluation.js';
import { capability, createSceneCapabilities } from './experience-capabilities.js';
export const BREATHING=2;
const eventKey=(visit,id,signal)=>`${visit}|${id}|${signal}`;
export const signalEmitted=(r,ref)=>!!r.signals[eventKey(r.visit,ref.useId,ref.signal)];
export const projectedValue=(scene,r,sid,channel)=>r?.overrides[sid]?.[channel]?.value??scene.subjects[sid]?.properties[channel];
const note=(r,message)=>{r.log.push({time:r.time,message});r.log=r.log.slice(-60);};
export function createRuntime(e,c,pid,pose,scene=createSceneCapabilities()) {
 const r={time:0,serial:0,visit:0,visitCounter:0,presentationId:null,stopId:null,viewUseId:null,pose:copy(pose),movement:null,queue:[],activities:{},active:{},overrides:{},signals:{},autoplay:false,exploring:false,history:[],bookmarks:[],log:[],elapsed:0,readiness:BREATHING,refusal:null};
 armScope(r,e,c,scene,null);
 enterPresentation(r,e,c,scene,pid);
 const u=entryUse(e,pid);if(u)requestView(r,e,c,u.id,'cut');
 return r;
}
export function requestView(r,e,c,id,speed='auto',path=null,seam=null) {
 const resolved=resolveUse(e,c,id);if(!resolved){r.refusal='Framing removed — choose a View or explicitly keep viewpoint';return false;}
 if(r.movement){r.queue.push({id,speed,path,seam});return true;}
 const route=path||[copy(r.pose),copy(resolved.view.pose)],base=pathSeconds(route,speed);
 const holds=(seam?.beats||[]).filter(b=>b.kind==='hold').map(b=>{const conn=c.connections[b.connectionId];const progress=conn?stationProgress(conn,route,b.stationId):null;return progress===null?null:{progress,seconds:b.seconds,id:b.id};}).filter(Boolean).sort((a,b)=>a.progress-b.progress);
 let accumulated=0;for(const h of holds){h.at=h.progress*base+accumulated;accumulated+=h.seconds;}
 const invokes=(seam?.beats||[]).filter(b=>b.kind==='invoke').map(b=>{const conn=c.connections[b.connectionId],progress=conn?stationProgress(conn,route,b.stationId):null;return progress===null?null:{useId:b.useId,at:progress*base+holds.filter(h=>h.progress<progress).reduce((sum,h)=>sum+h.seconds,0),fired:false};}).filter(Boolean);
 r.movement={token:++r.serial,path:route,duration:base+accumulated,travelDuration:base,holds,invokes,elapsed:0};r.viewUseId=id;r.refusal=null;
 if(!r.movement.duration){r.pose=evaluatePath(route,1);r.movement=null;}
 return true;
}
function removeOwned(r,token){for(const channels of Object.values(r.overrides))for(const [key,patch] of Object.entries(channels))if(patch.owner===token)delete channels[key];}
function stopRun(r,e,token,reason){const a=r.activities[token];if(!a)return;a.status='stopped';a.reason=reason;removeOwned(r,token);
 for(const b of Object.values(r.activities))if(b.status==='waiting'&&b.visit===a.visit&&e.uses[b.useId]?.start.useId===a.useId)stopRun(r,e,b.token,'Dependency disarmed');
}
function put(r,sid,channel,value,token){r.overrides[sid]??={};r.overrides[sid][channel]={value,owner:token};}
function emit(r,e,c,scene,a,signal){
 // Completion ownership follows its originating visit/run. A stale run cannot signal a later visit.
 if(r.active[a.useId]!==a.token)return;
 r.signals[eventKey(a.visit,a.useId,signal)]=true;
 for(const b of Object.values(r.activities)) {const u=e.uses[b.useId];if(b.status==='waiting'&&b.visit===a.visit&&u?.start.kind==='after'&&u.start.useId===a.useId&&u.start.signal===signal)begin(r,e,c,scene,b.token);}
 if(a.visit!==r.visit||r.exploring)return;
 for(const u of Object.values(e.uses))if(u.viewId&&u.cue?.useId===a.useId&&u.cue.signal===signal&&u.presentationId===r.presentationId)requestView(r,e,c,u.id);
}
function complete(r,e,c,scene,token){const a=r.activities[token];if(!a||r.active[a.useId]!==token||a.status!=='running')return false;
 a.status='complete';const u=e.uses[a.useId],d=e.definitions[u?.definitionId];
 if(d?.kind==='control'&&capability(scene,d.subjectId,d.capabilityId)?.kind==='playback')put(r,d.subjectId,capability(scene,d.subjectId,d.capabilityId).channel,false,token);
 emit(r,e,c,scene,a,'complete');note(r,'Completed '+(d?.name||a.useId));return true;
}
function makeRun(r,e,c,scene,u){
 const token=`visit-${r.visit}/run-${++r.serial}`;
 const unavailable=contributionIssues(e,c,scene,capability).some(i=>i.id===u.id);
 r.activities[token]={token,useId:u.id,visit:r.visit,status:unavailable?'unavailable':u.start.kind==='after'?'waiting':'armed',elapsed:0,duration:null};r.active[u.id]=token;return token;
}
function begin(r,e,c,scene,token,interaction=false){
 const a=r.activities[token],u=e.uses[a?.useId],d=e.definitions[u?.definitionId];if(!a||!u||!d||a.status==='unavailable')return false;
 for(const key of Object.keys(r.signals))if(key.startsWith(`${a.visit}|${u.id}|`))delete r.signals[key];
 a.status='running';
 if(d.kind==='narration')a.duration=narrationDuration(d);
 if(d.kind==='control'){
  const cap=capability(scene,d.subjectId,d.capabilityId);if(!cap){a.status='unavailable';return false;}
  if(cap.control==='range'&&(!Number.isFinite(d.value)||d.value<cap.min||d.value>cap.max)){a.status='unavailable';a.reason='Unsupported capability value';return false;}
  const prior=r.overrides[d.subjectId]?.[cap.channel];
  if(prior&&prior.owner!==token){if(cap.replace==='replace')stopRun(r,e,prior.owner,'Declared channel replacement');else{a.status='unavailable';a.reason='Channel occupied';return false;}}
  const current=projectedValue(scene,r,d.subjectId,cap.channel),value=interaction&&u.toggle?!current:d.value;
  a.startValue=current;a.value=value;a.duration=cap.kind==='loop'?null:cap.duration??0;
  if(value===false&&(cap.kind==='loop'||cap.kind==='playback'))a.duration=0;
  if(cap.kind==='motion'&&current===value)a.duration=0;
  put(r,d.subjectId,cap.channel,cap.kind==='motion'&&a.duration?current:value,token);
 }
 note(r,'Started '+(d.name||u.id));if(a.duration===0)complete(r,e,c,scene,token);return true;
}
function armScope(r,e,c,scene,pid){
 const incoming=Object.values(e.uses).filter(u=>!u.viewId&&u.kind!=='interaction'&&u.presentationId===pid);
 incoming.filter(u=>u.start.kind==='after').forEach(u=>makeRun(r,e,c,scene,u));
 incoming.filter(u=>u.start.kind!=='after').forEach(u=>begin(r,e,c,scene,makeRun(r,e,c,scene,u)));
}
export function interruption(e,scene,u){const d=e.definitions[u.definitionId],cap=d?.kind==='control'?capability(scene,d.subjectId,d.capabilityId):null;return u.interruption||(d?.kind==='narration'?'cancel':cap?.kind==='loop'?'continue':cap?.duration?'finish':'cancel');}
function closeVisit(r,e,scene){for(const a of Object.values(r.activities)){const u=e.uses[a.useId];if(a.visit!==r.visit||u?.presentationId===null)continue;
 if(a.status==='waiting')stopRun(r,e,a.token,'Visit left before dependency');
 else if(u.end.kind==='visit'){if(a.status==='complete')removeOwned(r,a.token);else if(['running','paused'].includes(a.status)&&interruption(e,scene,u)==='cancel')stopRun(r,e,a.token,'Visit ended');}
}}
function enterPresentation(r,e,c,scene,pid){closeVisit(r,e,scene);r.presentationId=pid;r.visit=++r.visitCounter;r.elapsed=0;r.queue=[];r.movement=null;r.signals={...r.signals};armScope(r,e,c,scene,pid);r.readiness=estimatePresentation(e,c,pid,r.pose);}
export function estimatePresentation(e,c,pid,pose,entryId=entryUse(e,pid)?.id||null){
 let cameraArrival=0,current=pose;const requests=[];if(entryId)requests.push({id:entryId,at:0});
 for(const u of Object.values(e.uses))if(u.presentationId===pid&&u.viewId&&u.cue){const at=cueSeconds(e,u.cue);if(at!==null)requests.push({id:u.id,at});}
 for(const req of requests.sort((a,b)=>a.at-b.at)){const v=resolveUse(e,c,req.id)?.view;if(!v)continue;cameraArrival=Math.max(req.at,cameraArrival)+pathSeconds([current,v.pose],'auto');current=v.pose;}
 const contributions=Object.values(e.uses).filter(u=>u.presentationId===pid&&!u.viewId&&u.kind!=='interaction');
 let end=0;const scene=createSceneCapabilities();for(const u of contributions){const d=e.definitions[u.definitionId];if(d?.kind==='narration')end=Math.max(end,narrationDuration(d));if(d?.kind==='control'){const cap=capability(scene,d.subjectId,d.capabilityId);const at=u.start.kind==='after'?(cueSeconds(e,u.start)??capability(scene,e.definitions[e.uses[u.start.useId]?.definitionId]?.subjectId,e.definitions[e.uses[u.start.useId]?.definitionId]?.capabilityId)?.duration??0):0;end=Math.max(end,at+(cap?.duration||0));}}
 return Math.max(end,cameraArrival)+BREATHING;
}
export function gateState(e,c,r){
 const s=e.stops[r.stopId];if(!s)return {allowed:false,reason:'No Guide Stop'};
 const next=resolveNext(e,s.id);if(!next.id)return {allowed:false,reason:'End of Guide · explore freely'};
 if(next.missing)return {allowed:false,reason:'Next destination needs repair'};
 const entry=stopEntry(e,next.id);if(entry.missing||(entry.id&&!resolveUse(e,c,entry.id)))return {allowed:false,reason:'Required framing needs repair'};
 if(s.gate&&!e.uses[s.gate.useId])return {allowed:false,reason:'Gate needs repair'};
 if(s.gate&&!signalEmitted(r,s.gate))return {allowed:false,reason:'Waiting for authored Gate'};
 const seam=getSeam(e,s.id,next.id),from=resolveUse(e,c,r.viewUseId),to=resolveUse(e,c,entry.id);
 if(seam.mode==='travel'&&(!from||!to||!findConnection(c,from.view.id,to.view.id)))return {allowed:false,reason:'Travel gap from current View'};
 return {allowed:true,reason:''};
}
function goStop(r,e,c,scene,id,record=true,ignoreTravel=false){
 const s=e.stops[id];if(!s||!e.presentations[s.presentationId]){r.refusal='Stop or Presentation missing';return false;}
 const entry=stopEntry(e,id),to=resolveUse(e,c,entry.id);if(entry.missing||(entry.id&&!to)){r.refusal='Framing removed — repair or explicitly keep viewpoint';return false;}
 const old=r.stopId,seam=old?getSeam(e,old,id):null,from=resolveUse(e,c,r.viewUseId);let path=null,speed='cut';
 if(seam?.mode==='travel'&&!ignoreTravel){const conn=from&&to?findConnection(c,from.view.id,to.view.id):null;if(!conn){r.refusal='Travel gap from current View';return false;}path=connectionPath(conn,r.pose,to.view.pose);speed=conn.speed;}
 if(record&&old)r.history.push(old);
 enterPresentation(r,e,c,scene,s.presentationId);r.stopId=id;r.exploring=false;r.refusal=null;
 if(to)requestView(r,e,c,to.use.id,speed,path,seam);else r.viewUseId=null;
 r.pacingFallback=s.pacing.kind==='signal'&&signalEmitted(r,s.pacing.ref);
 r.readiness=Math.max(r.readiness,(r.movement?.duration||0)+BREATHING);note(r,'Entered Stop '+id);return true;
}
export function startGuide(e,c,current,scene=createSceneCapabilities()){const r=copy(current);if(e.guide[0])goStop(r,e,c,scene,e.guide[0],false,true);return r;}
export function nextRuntime(e,c,current,scene=createSceneCapabilities()){const r=copy(current),gate=gateState(e,c,r);if(!gate.allowed){r.refusal=gate.reason;return r;}goStop(r,e,c,scene,resolveNext(e,r.stopId).id);return r;}
export function previousRuntime(e,c,current,scene=createSceneCapabilities()){const r=copy(current),id=r.history.pop();if(id)goStop(r,e,c,scene,id,false,true);return r;}
export function activateRuntime(e,c,current,uid,scene=createSceneCapabilities()){const r=copy(current),u=e.uses[uid];if(u?.kind==='interaction'&&(!u.availability||u.availability===r.presentationId))begin(r,e,c,scene,makeRun(r,e,c,scene,u),true);return r;}
export function stopActivityRuntime(e,current,token){const r=copy(current);stopRun(r,e,token,'Stopped by visitor');return r;}
export function exploreRuntime(current,pose=null){const r=copy(current);r.pose=copy(pose||r.pose);r.exploring=true;r.autoplay=false;r.movement=null;r.queue=[];return r;}
export function resumeGuide(e,c,current,pose=null){const r=copy(current);r.pose=copy(pose||r.pose);r.exploring=false;r.autoplay=false;r.elapsed=0;const entry=stopEntry(e,r.stopId);if(entry.id)requestView(r,e,c,entry.id);r.readiness=estimatePresentation(e,c,r.presentationId,r.pose,entry.id);return r;}
export function chooseRuntime(e,c,current,targetId,detour=false,scene=createSceneCapabilities()){
 const r=copy(current);if(detour){r.bookmarks.push({stopId:r.stopId,presentationId:r.presentationId,visit:r.visit,elapsed:r.elapsed,history:[...r.history],autoplay:r.autoplay,viewUseId:r.viewUseId});
  for(const a of Object.values(r.activities))if(a.visit===r.visit&&e.definitions[e.uses[a.useId]?.definitionId]?.kind==='narration'&&a.status==='running')a.status='paused';
  r.stopId=null;r.presentationId=null;r.visit=0;
 }
 goStop(r,e,c,scene,targetId,!detour,true);return r;
}
export function returnDetour(e,c,current,scene=createSceneCapabilities()){
 const r=copy(current),b=r.bookmarks.pop();if(!b)return r;closeVisit(r,e,scene);
 Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});
 for(const a of Object.values(r.activities))if(a.visit===b.visit&&a.status==='paused')a.status='running';
 const entry=stopEntry(e,r.stopId);if(entry.id)requestView(r,e,c,entry.id);note(r,'Returned without duplicate entry');return r;
}
export function lookRuntime(e,c,current,uid,pose=null){const r=copy(current);if(r.exploring)r.pose=copy(pose||r.pose);r.exploring=false;r.autoplay=false;requestView(r,e,c,uid);return r;}
export function tickRuntime(e,c,current,seconds,scene=createSceneCapabilities()){
 const r=copy(current);let remaining=Math.max(0,seconds);
 while(remaining>1e-9){const dt=Math.min(.25,remaining);remaining-=dt;r.time+=dt;r.elapsed+=dt;
  if(r.movement){const m=r.movement;m.elapsed=Math.min(m.duration,m.elapsed+dt);let held=0,progress=null;
   for(const h of m.holds||[]){if(m.elapsed>=h.at+h.seconds)held+=h.seconds;else if(m.elapsed>=h.at){progress=h.progress;break;}}
   for(const invocation of m.invokes||[]){if(!invocation.fired&&m.elapsed>=invocation.at){invocation.fired=true;const u=e.uses[invocation.useId];if(u)begin(r,e,c,scene,makeRun(r,e,c,scene,u));}}
   r.pose=evaluatePath(m.path,progress??(m.travelDuration?(m.elapsed-held)/m.travelDuration:1));if(m.elapsed>=m.duration-1e-9)r.movement=null;
  }
  for(const a of Object.values(r.activities).filter(a=>a.status==='running')){
   if(r.active[a.useId]!==a.token){stopRun(r,e,a.token,'Superseded run');continue;}
   const u=e.uses[a.useId],d=e.definitions[u?.definitionId];if(!u||!d)continue;const before=a.elapsed;a.elapsed+=dt;
   if(d.kind==='narration')for(const marker of d.markers){const at=marker.fraction*narrationDuration(d);if(before<at&&a.elapsed>=at)emit(r,e,c,scene,a,`marker:${marker.id}`);}
   if(d.kind==='control'){const cap=capability(scene,d.subjectId,d.capabilityId);if(cap?.kind==='motion')put(r,d.subjectId,cap.channel,Number(a.startValue)+(Number(a.value)-Number(a.startValue))*Math.min(1,a.elapsed/(a.duration||1)),a.token);}
   if(a.duration!==null&&a.elapsed>=a.duration){a.elapsed=a.duration;complete(r,e,c,scene,a.token);}
  }
  if(!r.movement&&r.queue.length){const q=r.queue.shift();requestView(r,e,c,q.id,q.speed,q.path,q.seam);}
  if(r.autoplay&&!r.exploring&&r.stopId){const s=e.stops[r.stopId];let ready=false;
   if(s?.pacing.kind==='dwell')ready=r.elapsed>=s.pacing.seconds;
   else if(s?.pacing.kind==='signal')ready=r.pacingFallback?r.elapsed>=BREATHING:signalEmitted(r,s.pacing.ref);
   else ready=r.elapsed>=r.readiness;
   if(ready&&gateState(e,c,r).allowed)goStop(r,e,c,scene,resolveNext(e,r.stopId).id);
  }
 }
 return r;
}
export function narrationCaption(e,r){const a=Object.values(r.activities).find(a=>a.status==='running'&&a.visit===r.visit&&e.definitions[e.uses[a.useId]?.definitionId]?.kind==='narration');if(!a)return '';const d=e.definitions[e.uses[a.useId].definitionId],words=d.text.trim().split(/\s+/),at=Math.floor(a.elapsed/narrationDuration(d)*words.length);return words.slice(Math.max(0,at-4),Math.min(words.length,at+7)).join(' ');}
export function completeRun(e,c,current,token,scene=createSceneCapabilities()){const r=copy(current);complete(r,e,c,scene,token);return r;}
