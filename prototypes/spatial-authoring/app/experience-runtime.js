// Native ESM adaptation of donor arm/begin/close, readiness and bounded stepping.
// Camera evaluation is delegated to the kernel beneath navigation; no renderer tween lives here.
import { copy, entryUse, resolveUse, stopEntry, resolveNext, getSeam, cueSeconds, narrationDuration, contributionIssues, activationScope, boundaryScope, supportedSignal, signalReaches, narrationPassages, viewStep } from './experience-model.js';
import { pathSeconds, evaluatePath, connectionPath, findConnection, stationProgress, viewPath, sameViewPose } from './camera-evaluation.js';
import { movementTiming } from './experience-coordination.js';
import { capability, createSceneCapabilities } from './experience-capabilities.js';
export const BREATHING=2;
const eventKey=(visit,id,signal)=>`${visit}|${id}|${signal}`;
export const signalEmitted=(r,ref)=>!!ref&&!!r.signals[eventKey(r.visit,ref.useId,ref.signal)];
export const projectedValue=(scene,r,sid,channel)=>r?.overrides[sid]?.[channel]?.value??scene.subjects[sid]?.properties[channel];
const note=(r,message)=>{r.log.push({time:r.time,message});r.log=r.log.slice(-60);};
// Remaining, not total: an Experience-scoped run carried into this Stop has already spent part of its
// authored duration, and completed work owes nothing. Visit-local work is always freshly armed here.
const carriedElapsed=(r,e)=>id=>{
 const u=e.uses[id];if(!u||activationScope(u)!==null)return 0;
 const a=r.activities[r.active[id]];if(!a||a.duration==null)return 0;
 // Work already spent — running, paused, complete or stopped by the visitor — is time this Stop no
 // longer owes; only work still owed contributes its full authored duration.
 return ['running','paused','complete','stopped'].includes(a.status)?Math.max(0,Math.min(a.duration,a.elapsed)):0;
};
export function createRuntime(e,c,pid,pose,scene=createSceneCapabilities()) {
 const r={time:0,serial:0,visit:0,visitCounter:0,presentationId:null,stopId:null,viewUseId:null,arrivedViewUseId:null,viewingSuppressed:false,cueFloor:-1,captions:true,pose:copy(pose),movement:null,queue:[],activities:{},active:{},overrides:{},signals:{},autoplay:false,exploring:false,history:[],bookmarks:[],log:[],elapsed:0,readiness:BREATHING,refusal:null};
 r.scene=copy(scene);armScope(r,e,c,scene,null);
 if(pid)enterPresentation(r,e,c,scene,pid);
 const u=entryUse(e,pid);if(u)requestView(r,e,c,u.id,'cut');
 return r;
}
export function requestView(r,e,c,id,speed='auto',path=null,seam=null,connectionId=null) {
 const resolved=resolveUse(e,c,id);if(!resolved){r.refusal='Framing removed — choose a View or explicitly keep viewpoint';return false;}
 if(r.movement){r.queue.push({id,speed,path,seam,connectionId});return true;}
 const route=path||viewPath(r.pose,resolved.view.pose);
 const timing=movementTiming(c,seam,route,speed,connectionId);
 r.movement={token:++r.serial,path:route,...timing,elapsed:0};r.viewUseId=id;r.refusal=null;
 if(!r.movement.duration){r.pose=evaluatePath(route,1);r.arrivedViewUseId=id;r.movement=null;}
 else r.movement.useId=id;
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
 for(const b of Object.values(r.activities)) {const u=e.uses[b.useId];if(b.status==='waiting'&&(b.visit===a.visit||u?.start.scope==='experience')&&u?.start.kind==='after'&&u.start.useId===a.useId&&u.start.signal===signal)begin(r,e,c,scene,b.token);}
 // Experience-scoped output belongs to the Experience, not to whichever visit is current: its captions
 // and View cues survive later Stop entries. Visit-local output is still dropped once its visit passed.
 if(activationScope(e.uses[a.useId])!==null&&a.visit!==r.visit)return;
 if(r.exploring||r.viewingSuppressed)return;
 for(const u of Object.values(e.uses))if(u.viewId&&u.cue?.useId===a.useId&&u.cue.signal===signal&&u.presentationId===r.presentationId&&cueSeconds(e,u.cue)>r.cueFloor)requestView(r,e,c,u.id,c.views[u.viewId]?.speed||'auto');
}
function complete(r,e,c,scene,token){const a=r.activities[token];if(!a||r.active[a.useId]!==token||a.status!=='running')return false;
 a.status='complete';const u=e.uses[a.useId],d=e.definitions[u?.definitionId];
 if(d?.kind==='control'&&capability(scene,d.subjectId,d.capabilityId)?.kind==='playback')put(r,d.subjectId,capability(scene,d.subjectId,d.capabilityId).channel,false,token);
 emit(r,e,c,scene,a,'complete');
 const retention=u.retention||u.end;
 if(retention?.kind==='complete'||(a.boundaryExpired&&retention?.kind==='visit'))removeOwned(r,token);
 note(r,'Completed '+(d?.name||a.useId));return true;
}
function makeRun(r,e,c,scene,u){
 const token=`visit-${r.visit}/run-${++r.serial}`;
 const unavailable=contributionIssues(e,c,scene,capability).some(i=>i.id===u.id);
 r.activities[token]={token,useId:u.id,visit:r.visit,scope:activationScope(u),status:unavailable?'unavailable':u.start.kind==='after'?'waiting':'armed',elapsed:0,duration:null,boundaryExpired:false};r.active[u.id]=token;return token;
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
 const incoming=Object.values(e.uses).filter(u=>{
  if(u.viewId||u.kind==='interaction'||u.start.kind==='station'||activationScope(u)!==pid)return false;
  const active=r.activities[r.active[u.id]];
  // Continue and Experience-bound results are carried invocations, not new entry triggers.
  return !active||!['running','paused','waiting','complete'].includes(active.status)||(active.status==='complete'&&(u.retention||u.end)?.kind!=='experience');
 });
 incoming.filter(u=>u.start.kind==='after').forEach(u=>makeRun(r,e,c,scene,u));
 incoming.filter(u=>u.start.kind!=='after').forEach(u=>begin(r,e,c,scene,makeRun(r,e,c,scene,u)));
}
export function interruption(e,scene,u){const d=e.definitions[u.definitionId],cap=d?.kind==='control'?capability(scene,d.subjectId,d.capabilityId):null;return u.interruption||(d?.kind==='narration'?'cancel':cap?.kind==='loop'?'continue':cap?.duration?'finish':'cancel');}
function closeVisit(r,e,scene,parked=new Set()){for(const a of Object.values(r.activities)){
 const u=e.uses[a.useId];if(!u)continue;
 // A detour parks its parent visit: those runs are suspended, not ended, while the bookmark exists.
 if(parked.has(a.visit))continue;
 if(a.status==='waiting'&&u.start.kind==='after'&&u.start.scope!=='experience'&&a.visit===r.visit){stopRun(r,e,a.token,'Visit left before dependency');continue;}
 const retention=u.retention||u.end,retentionExpired=retention?.kind==='visit'&&boundaryScope(u,retention)===r.presentationId;
 if(retentionExpired){a.boundaryExpired=true;if(a.status==='complete')removeOwned(r,a.token);}
 if(u.end.kind==='visit'&&boundaryScope(u)===r.presentationId&&['running','paused'].includes(a.status)&&interruption(e,scene,u)==='cancel')stopRun(r,e,a.token,'Visit ended');
}}
function enterPresentation(r,e,c,scene,pid){closeVisit(r,e,scene,new Set(r.bookmarks.map(b=>b.visit)));r.presentationId=pid;r.visit=++r.visitCounter;r.elapsed=0;r.queue=[];r.movement=null;r.viewingSuppressed=false;r.cueFloor=-1;r.signals={...r.signals};armScope(r,e,c,scene,pid);r.readiness=estimatePresentation(e,c,pid,r.pose,undefined,null,scene,{elapsed:carriedElapsed(r,e)});}
export function presentationPlan(e,c,pid,pose,entryId=entryUse(e,pid)?.id||null,entryMovement=null,scene=createSceneCapabilities(),policy={}){
 const issues=new Set(contributionIssues(e,c,scene,capability).map(i=>i.id)),cache=new Map();
 // Activation, not organization, determines eligible work. Recursive dependency costs share one
 // memoized signal calculation; hypothetical visitor offers and unavailable work have no invented cost.
 function startAt(id,seen=new Set()){
  if(cache.has(id))return cache.get(id);const u=e.uses[id];
  if(!u||u.viewId||u.kind==='interaction'||u.start.kind==='station'||issues.has(id)||seen.has(id))return null;
  if(activationScope(u)!==pid&&activationScope(u)!==null)return null;
  seen.add(id);let at=0;
  if(u.start.kind==='after'){
   const base=startAt(u.start.useId,seen),d=e.definitions[e.uses[u.start.useId]?.definitionId];
   const offset=d?.kind==='narration'?cueSeconds(e,u.start):u.start.signal==='complete'?capability(scene,d?.subjectId,d?.capabilityId)?.duration??0:null;
   at=base===null||offset===null?null:base+offset;
  }
  // Work already underway at this Stop keeps only its remaining time; completed work owes nothing.
  // `policy.elapsed` is the runtime's live read of carried (Experience-scoped) runs.
  if(at!==null)at-=(policy.elapsed?.(u.id)??0);
  cache.set(id,at);return at;
 }
 let narrationEnd=0,finiteEnd=0,persistentStart=0;
 for(const u of Object.values(e.uses)){
  const at=startAt(u.id);if(at===null)continue;const d=e.definitions[u.definitionId];
  if(d?.kind==='narration')narrationEnd=Math.max(narrationEnd,at+narrationDuration(d));
  else if(d?.kind==='control'){const cap=capability(scene,d.subjectId,d.capabilityId);if(!cap)continue;if(cap.kind==='loop')persistentStart=Math.max(persistentStart,at);else finiteEnd=Math.max(finiteEnd,at+(d.value===false?0:cap.duration||0));}
 }
 let cameraArrival=0,current=pose;const requests=[];if(entryId)requests.push({id:entryId,at:0});
 if(policy.cues!==false)for(const u of Object.values(e.uses))if(u.presentationId===pid&&u.viewId&&u.id!==entryId&&u.cue&&!issues.has(u.id)){
  // A cue whose authored moment already passed before this visit cannot fire; it never delays arrival.
  const local=cueSeconds(e,u.cue),at=startAt(u.cue.useId);if(local!==null&&at!==null&&at+local>=0&&local>(policy.cueFloor??-1))requests.push({id:u.id,at:at+local});
 }
 for(const req of requests.sort((a,b)=>a.at-b.at)){const v=resolveUse(e,c,req.id)?.view;if(!v)continue;cameraArrival=Math.max(req.at,cameraArrival)+(req.id===entryId&&entryMovement?entryMovement.duration:pathSeconds(viewPath(current,v.pose),v.speed||'auto'));current=v.pose;}
 return {readiness:Math.max(narrationEnd,finiteEnd,persistentStart,cameraArrival)+BREATHING,narrationEnd,finiteEnd,persistentStart,cameraArrival,requests};
}
export function estimatePresentation(...args){return presentationPlan(...args).readiness;}
function coordinationProblem(e,c,seam,connection,path) {
 for(const beat of seam.beats||[]) {
  if(beat.connectionId!==connection.id)continue;
  if(stationProgress(connection,path,beat.stationId)===null)return 'Camera station needs repair';
  if(beat.kind==='invoke'&&(!e.uses[beat.useId]||!e.definitions[e.uses[beat.useId].definitionId]))return 'Coordinated contribution needs repair';
 }
 return null;
}
export function gateState(e,c,r){
 const s=e.stops[r.stopId];if(!s)return {allowed:false,reason:'No Guide Stop'};
 const next=resolveNext(e,s.id);if(!next.id)return {allowed:false,reason:'End of Guide · explore freely'};
 if(next.missing)return {allowed:false,reason:'Next destination needs repair'};
 const entry=stopEntry(e,next.id);if(entry.missing||(entry.id&&!resolveUse(e,c,entry.id)))return {allowed:false,reason:'Required framing needs repair'};
 if(s.gate&&(!supportedSignal(e,r.scene||createSceneCapabilities(),s.gate)||!signalReaches(e,s.gate,s.presentationId)))return {allowed:false,reason:'Gate needs repair'};
 if(s.gate&&!signalEmitted(r,s.gate))return {allowed:false,reason:'Waiting for authored Gate'};
 const seam=getSeam(e,s.id,next.id),from=resolveUse(e,c,r.viewUseId),to=resolveUse(e,c,entry.id);
 if(seam.mode==='travel') {
  const connection=from&&to?findConnection(c,from.view.id,to.view.id):null;
  if(!connection)return {allowed:false,reason:'Travel gap from current View'};
  if(r.movement||!sameViewPose(r.pose,from.view.pose))return {allowed:false,reason:'Camera is not yet at the departure View · finish the current move or rejoin'};
  const problem=coordinationProblem(e,c,seam,connection,connectionPath(connection,from.view.pose,to.view.pose));
  if(problem)return {allowed:false,reason:problem};
 }
 return {allowed:true,reason:''};
}
function goStop(r,e,c,scene,id,record=true,ignoreTravel=false){
 const s=e.stops[id];if(!s||!e.presentations[s.presentationId]){r.refusal='Stop or Presentation missing';return false;}
 const entry=stopEntry(e,id),to=resolveUse(e,c,entry.id);if(entry.missing||(entry.id&&!to)){r.refusal='Framing removed — repair or explicitly keep viewpoint';return false;}
 const old=r.stopId,seam=old?getSeam(e,old,id):null,from=resolveUse(e,c,r.viewUseId);let path=null,speed='cut',connectionId=null;const origin=copy(r.pose);
 if(seam?.mode==='travel'&&!ignoreTravel){const conn=from&&to?findConnection(c,from.view.id,to.view.id):null;if(!conn){r.refusal='Travel gap from current View';return false;}if(r.movement||!sameViewPose(r.pose,from.view.pose)){r.refusal='Camera is not yet at the departure View · finish the current move or rejoin';return false;}path=connectionPath(conn,from.view.pose,to.view.pose);speed=conn.speed;connectionId=conn.id;const problem=coordinationProblem(e,c,seam,conn,path);if(problem){r.refusal=problem;return false;}}
 if(record&&old)r.history.push(old);
 enterPresentation(r,e,c,scene,s.presentationId);r.stopId=id;r.exploring=false;r.refusal=null;
 r.viewingSuppressed=!!entry.hold;r.cueFloor=entry.id?(cueSeconds(e,e.uses[entry.id]?.cue)??-1):-1;
 if(to)requestView(r,e,c,to.use.id,speed,path,seam,connectionId);else {r.viewUseId=null;r.arrivedViewUseId=null;}
 r.pacingFallback=s.pacing.kind==='signal'&&signalEmitted(r,s.pacing.ref);
 r.readiness=estimatePresentation(e,c,s.presentationId,origin,entry.id,{duration:r.movement?.duration||0},scene,{cues:!entry.hold,cueFloor:r.cueFloor,elapsed:carriedElapsed(r,e)});note(r,'Entered Stop '+id);return true;
}
export function startGuide(e,c,current,scene=createSceneCapabilities()){const r=copy(current);if(e.guide[0])goStop(r,e,c,scene,e.guide[0],false,true);return r;}
export function nextRuntime(e,c,current,scene=createSceneCapabilities()){const r=copy(current),gate=gateState(e,c,r);if(!gate.allowed){r.refusal=gate.reason;return r;}goStop(r,e,c,scene,resolveNext(e,r.stopId).id);return r;}
export function previousRuntime(e,c,current,scene=createSceneCapabilities()){const r=copy(current),id=r.history.pop();if(id)goStop(r,e,c,scene,id,false,true);return r;}
export function activateRuntime(e,c,current,uid,scene=createSceneCapabilities()){const r=copy(current),u=e.uses[uid];if(u?.kind==='interaction'&&(!u.availability||u.availability===r.presentationId))begin(r,e,c,scene,makeRun(r,e,c,scene,u),true);return r;}
export function stopActivityRuntime(e,current,token){const r=copy(current);stopRun(r,e,token,'Stopped by visitor');return r;}
export function exploreRuntime(current,pose=null){const r=copy(current);r.pose=copy(pose||r.pose);r.exploring=true;r.autoplay=false;r.movement=null;r.queue=[];return r;}
// Enabling Auto keeps the stop's own remaining-work clock. The elapsed time already spent at this
// Stop — including work overlapped by Camera movement — is never restarted by the toggle; only the
// pacing fallback is re-read from the runtime state.
export function autoRuntime(e,current){const r=copy(current);r.autoplay=!r.autoplay;const s=e.stops[r.stopId];r.pacingFallback=!!(s?.pacing.kind==='signal'&&signalEmitted(r,s.pacing.ref));return r;}
export function resumeGuide(e,c,current,pose=null){const r=copy(current);r.pose=copy(pose||r.pose);r.exploring=false;r.autoplay=false;r.elapsed=0;const entry=stopEntry(e,r.stopId);if(entry.id)requestView(r,e,c,entry.id);r.readiness=estimatePresentation(e,c,r.presentationId,r.pose,entry.id,null,r.scene,{elapsed:carriedElapsed(r,e)});return r;}
export function chooseRuntime(e,c,current,targetId,detour=false,scene=createSceneCapabilities()){
 const r=copy(current);if(detour){r.bookmarks.push({stopId:r.stopId,presentationId:r.presentationId,visit:r.visit,elapsed:r.elapsed,history:[...r.history],autoplay:r.autoplay,viewUseId:r.viewUseId});
  for(const a of Object.values(r.activities))if(a.visit===r.visit&&e.definitions[e.uses[a.useId]?.definitionId]?.kind==='narration'&&a.status==='running')a.status='paused';
  r.stopId=null;r.presentationId=null;r.visit=0;
 }
 goStop(r,e,c,scene,targetId,!detour,true);return r;
}
export function returnDetour(e,c,current,scene=createSceneCapabilities()){
 const r=copy(current),parked=new Set(r.bookmarks.map(b=>b.visit)),b=r.bookmarks.pop();if(!b)return r;closeVisit(r,e,scene,parked);
 Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});
 for(const a of Object.values(r.activities))if(a.visit===b.visit&&['paused','waiting'].includes(a.status)){r.active[a.useId]=a.token;if(a.status==='paused')a.status='running';}
 const entry=stopEntry(e,r.stopId);if(entry.id)requestView(r,e,c,entry.id);note(r,'Returned without duplicate entry');return r;
}
export function lookRuntime(e,c,current,uid,pose=null){const r=copy(current);if(r.exploring)r.pose=copy(pose||r.pose);r.exploring=false;r.autoplay=false;r.viewingSuppressed=false;r.movement=null;r.queue=[];requestView(r,e,c,uid,c.views[e.uses[uid]?.viewId]?.speed||'auto');return r;}
export function viewStepRuntime(e,c,current,delta){const id=viewStep(e,current.presentationId,current.viewUseId,delta);return id?lookRuntime(e,c,current,id):copy(current);}
export function tickRuntime(e,c,current,seconds,scene=createSceneCapabilities()){
 const r=copy(current);let remaining=Math.max(0,seconds);
 while(remaining>1e-9){const dt=Math.min(.25,remaining);remaining-=dt;r.time+=dt;r.elapsed+=dt;
  if(r.movement){const m=r.movement;m.elapsed=Math.min(m.duration,m.elapsed+dt);let held=0,progress=null;
   for(const h of m.holds||[]){if(m.elapsed>=h.at+h.seconds)held+=h.seconds;else if(m.elapsed>=h.at){progress=h.progress;break;}}
   for(const invocation of m.invokes||[]){if(!invocation.fired&&m.elapsed>=invocation.at){invocation.fired=true;const u=e.uses[invocation.useId];if(u)begin(r,e,c,scene,makeRun(r,e,c,scene,u));}}
   r.pose=evaluatePath(m.path,progress??(m.travelDuration?(m.elapsed-held)/m.travelDuration:1));if(m.elapsed>=m.duration-1e-9){r.arrivedViewUseId=m.useId;r.movement=null;}
  }
  for(const a of Object.values(r.activities).filter(a=>a.status==='running')){
   if(r.active[a.useId]!==a.token){stopRun(r,e,a.token,'Superseded run');continue;}
   const u=e.uses[a.useId],d=e.definitions[u?.definitionId];if(!u||!d)continue;const before=a.elapsed;a.elapsed+=dt;
   if(d.kind==='narration')for(const marker of d.markers){const at=marker.time??marker.fraction*narrationDuration(d);if((before<at||(at===0&&before===0))&&a.elapsed>=at&&cueSeconds(e,{useId:u.id,signal:`marker:${marker.id}`})!==null)emit(r,e,c,scene,a,`marker:${marker.id}`);}
   if(d.kind==='control'){const cap=capability(scene,d.subjectId,d.capabilityId);if(cap?.kind==='motion')put(r,d.subjectId,cap.channel,Number(a.startValue)+(Number(a.value)-Number(a.startValue))*Math.min(1,a.elapsed/(a.duration||1)),a.token);}
   if(a.duration!==null&&a.elapsed>=a.duration){a.elapsed=a.duration;complete(r,e,c,scene,a.token);}
  }
  if(!r.movement&&r.queue.length){const q=r.queue.shift();requestView(r,e,c,q.id,q.speed,q.path,q.seam,q.connectionId);}
  if(r.autoplay&&!r.exploring&&r.stopId){const s=e.stops[r.stopId];let ready=false;
   if(s?.pacing.kind==='dwell')ready=r.elapsed>=s.pacing.seconds;
   else if(s?.pacing.kind==='signal')ready=r.pacingFallback?r.elapsed>=BREATHING:signalEmitted(r,s.pacing.ref);
   else ready=r.elapsed>=r.readiness;
   // Camera evaluation stays authoritative: Auto never advances into or across a move still in flight.
   if(ready&&!r.movement&&gateState(e,c,r).allowed)goStop(r,e,c,scene,resolveNext(e,r.stopId).id);
  }
 }
 return r;
}
export function narrationCaption(e,r){
 // The live run of this visit, plus Experience-scoped output that outlives its own visit. Stale runs
 // no longer own their use and are never captioned.
 const live=a=>['running','paused'].includes(a.status)&&r.active[a.useId]===a.token&&(a.visit===r.visit||activationScope(e.uses[a.useId])===null);
 const a=Object.values(r.activities).find(a=>live(a)&&e.definitions[e.uses[a.useId]?.definitionId]?.kind==='narration');if(!a)return '';const d=e.definitions[e.uses[a.useId].definitionId];return narrationPassages(d).find(p=>a.elapsed>=p.start&&a.elapsed<p.end)?.text||'';
}
export function completeRun(e,c,current,token,scene=createSceneCapabilities()){const r=copy(current);complete(r,e,c,scene,token);return r;}
