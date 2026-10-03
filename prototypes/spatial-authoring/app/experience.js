import { createSceneCapabilities, capability, capabilities, setSceneValue } from './experience-capabilities.js';
import { buildCapabilitySubjects, realizeCapabilities } from './experience-scene.js';
import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import * as R from './experience-runtime.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx, thing } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole, addStop, moveStop, resolveNext, editSeam, originCoverage, addConnection, addAnchor, resolveUse, viewReach, detachUse, editView, addBeat, connectionReach, addContribution, fresh, reuseView, lowerCamera, addInvocationBeat } from './experience-model.js';
export function initExperience() {
  ctx.sceneSource=createSceneCapabilities();
  ctx.experience = createExperience(); ctx.cameraSource = createCamera();
  S.experienceContext = { presentation: null, depth: 'ordinary', stop: null, seam: null };
}
export const resolveExperience = (id) => subject(ctx.experience, ctx.cameraSource, id);
export function command(label, edit) {
  if (S.visitor) return false;
  A.beginEdit();
  try { const result = edit(ctx.experience, ctx.cameraSource); A.commitEdit(label); ctx.ui(); return result; }
  catch (error) { A.cancelEdit(); throw error; }
}
export function present(focus = null) {
  const f = focus || (S.sel && !resolveExperience(S.sel) ? { kind: 'subjects', ids: [S.sel] } : { kind: 'environment' });
  const id = command('Create Presentation', e => addPresentation(e, f));
  openPresentation(id); return id;
}
export function openPresentation(id) {
  if (!ctx.experience.presentations[id]) return false;
  A.select(id); S.experienceContext.presentation = id; ctx.ui(); return true;
}
export function updatePresentation(id, key, value) {
  if (!['name','meaning','focus'].includes(key)) return false;
  return command(`Edit Presentation ${key}`, e => { const p = e.presentations[id]; if (!p) throw Error('Presentation removed'); p[key] = structuredClone(value); });
}
export function handleExperienceAction(el) {
  const action = el?.dataset?.act;
  if (!action?.startsWith('exp-')) return false;
  if (action === 'exp-create') present();
  if (action === 'exp-open') openPresentation(el.dataset.id);
  if (action === 'exp-add-guide') addToGuide(el.dataset.id||undefined);
  if (action === 'exp-guide') guideOverview();
  if (action === 'exp-stop') expandStop(el.dataset.id);
  if (action === 'exp-close') closeExperienceWork();
  if (action === 'exp-move-stop') moveOccurrence(el.dataset.id,Number(el.dataset.delta));
  if (action === 'exp-seam') openSeam(el.dataset.from,el.dataset.to);
  if (action === 'exp-cut') setSeamMode('cut');
  if (action === 'exp-travel') setSeamMode('travel');
  if (action === 'exp-connect') connectOrigin(el.dataset.id);
  if (action === 'exp-route') editRoute(el.dataset.id);
  if (action === 'exp-route-return') returnRouteReading();
  if (action === 'exp-hints') {preciseView(el.dataset.id);S.experienceContext.depth='hints';ctx.ui();}
  if (action === 'exp-hint') {const v=ctx.cameraSource.views[S.task?.target?.id];if(v)proposeFraming(el.dataset.key,Number(el.dataset.value));}
  if (action === 'exp-precise') preciseView(el.dataset.id);
  if (action === 'exp-posture') posture(el.dataset.posture);
  if (action === 'exp-grip') {if(S.task?.kind==='experience-camera')S.task.params.grip=el.dataset.grip;ctx.ui();}
  if (action === 'exp-scope-shared') acceptFraming('shared');
  if (action === 'exp-scope-local') acceptFraming('local');
  if (action === 'exp-scope-cancel') {S.expAsk=null;ctx.ui();}
  if (action === 'exp-coordinate') coordinate();
  if (action === 'exp-mark-station') command('Name Camera station',(e,c)=>{const r=c.connections[S.task.params.connection];r.markers.push({id:fresh(c,'marker'),name:'Mid-route station',progress:.5});});
  if (action === 'exp-invoke-beat') {const s=S.experienceContext.seam;command('Coordinate capability at station',(e,c)=>addInvocationBeat(e,c,s.from,s.to,S.task.params.connection,S.task.params.station,S.task.params.invokeUse));}
  if (action === 'exp-beat') beatAtStation(S.task?.params.station||'departure');
  if (action === 'exp-route-scope') acceptRoutePace();
  if (action === 'exp-narration') addNarration();
  if (action === 'exp-offer') beginOffer(el.dataset.kind||'behavior');
  if (action === 'exp-offer-accept') acceptOffer();
  if (action === 'exp-offer-cancel') {S.expOfferDraft=null;ctx.ui();}
  if (action === 'exp-marker') addMarker(el.dataset.id);
  if (action === 'exp-visitor') visitorCommand(el.dataset.command,el.dataset.id);
  if (action === 'exp-remove-stop') command('Remove Guide Stop',e=>{e.guide=e.guide.filter(id=>id!==el.dataset.id);delete e.stops[el.dataset.id];});
  if (action === 'exp-remove-contribution') command('Remove contribution',e=>delete e.uses[el.dataset.id]);
  if (action === 'exp-reset') resetExperience(false);
  if (action === 'exp-example') resetExperience(true);
  if (action === 'exp-presenter') presenterStep(Number(el.dataset.delta));
  if (action === 'exp-resume') resumeExperience();
  if (action === 'exp-dismiss-parked') {S.parkedByLens.experience=null;ctx.ui();}
  if (action === 'exp-capture') captureView();
  if (action === 'exp-auto') autoView();
  if (action === 'exp-role') changeRole(el.dataset.id,el.dataset.role);
  if (action === 'exp-preview') preview(el.dataset.id || undefined);
  if (action === 'exp-exit-preview') exitPreview();
  if (action === 'exp-region') { cancelProposal('invoke'); T.begin({kind:'experience-region',subject:S.sel,params:{first:null}}); A.setStatus('Choose two corners on the Stage to present a region'); }
  if (action === 'exp-environment') present({ kind: 'environment' });
  return true;
}
export function presentationValid(id) { const p = ctx.experience.presentations[id]; return !!p && validateFocus(p, id => !!A.worldOf(id)); }

export function captureView(pid=S.experienceContext.presentation) {
 return command('Capture Camera View', (e,c)=>{const id=addView(e,c,pid,nav.plainPose(),'Captured framing',entryUse(e,pid)?'choice':'entry');const v=c.views[e.uses[id].viewId];v.focusAt=e.presentations[pid].focus.kind==='subjects'?A.worldOf(e.presentations[pid].focus.ids[0]):null;return id;});
}
export function autoView(pid=S.experienceContext.presentation) {
 const p=ctx.experience.presentations[pid]; if(!p)return false;
 let target=[-2,1,0];
 if(p.focus.kind==='subjects') { const points=p.focus.ids.map(A.worldOf).filter(Boolean); if(points.length)target=points[0]; }
 if(p.focus.kind==='region')target=p.focus.min.map((n,i)=>(n+p.focus.max[i])/2);
 const fixtureSubject=p.focus.kind==='subjects'&&p.focus.ids.some(id=>ctx.sceneSource.subjects[id]);
 const pose={target,az:fixtureSubject?1.2:.7,el:.35,frameH:fixtureSubject?3:8,flat:0,mirror:false};
 return command('Add automatic framing',(e,c)=>{const id=addView(e,c,pid,pose,'Auto framing',entryUse(e,pid)?'choice':'entry'); c.views[e.uses[id].viewId].anchor='relative';c.views[e.uses[id].viewId].focusOffset=[0,0,0];return id;});
}
export function changeRole(id,role) { return command('Change View role',e=>setRole(e,id,role)); }
export function preview(pid=S.experienceContext.presentation) {
 if(S.visitor || !ctx.experience.presentations[pid]) return false;
 cancelProposal('preview');
 const token={lens:S.lens,sel:S.sel,context:structuredClone(S.experienceContext),origin:nav.captureOrigin('Preview return'),inspection:A.captureInspection(),expand:S.expand,sheet:{...S.sheet},browse:{...S.browse}};
 // Suspend authoring without writing source or passing through lens parking.
 T.park();
 nav.releaseHold();
 S.visitor={returnToken:token,source:structuredClone({experience:ctx.experience,camera:cameraSnapshot(),scene:ctx.sceneSource}),runtime:createRuntime(ctx.experience,cameraSnapshot(),pid,nav.plainPose(),ctx.sceneSource)};
 nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;
}
export async function exitPreview() {
 const v=S.visitor;if(!v)return false;
 S.visitor=null;S.visitorDrag=null;const t=v.returnToken;
 S.lens=t.lens;S.sel=t.sel;S.experienceContext=t.context;S.expand=t.expand;S.sheet=t.sheet;S.browse=t.browse;
 await A.restoreInspection(t.inspection);nav.restoreCapture(t.origin);ctx.ui();return true;
}
let runtimeAt=0;
export function visitorFrame(now) {
 if(!S.visitor) {runtimeAt=now;return;}
 const v=S.visitor,dt=Math.min(.25,Math.max(0,(now-runtimeAt)/1000));runtimeAt=now;
 v.runtime=tickRuntime(v.source.experience,v.source.camera,v.runtime,dt,v.source.scene);
 if(now-(v.uiAt||0)>160){v.uiAt=now;ctx.ui();}
 if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);
}

export function regionPoint(p) {
 if(S.task?.kind!=='experience-region') return false;
 if(!S.task.params.first) { S.task.params.first=[p.x,0,p.z];A.setStatus('Choose the opposite corner'); }
 else { const first=S.task.params.first,second=[p.x,3,p.z];T.end();present({kind:'region',min:first.map((n,i)=>Math.min(n,second[i])),max:first.map((n,i)=>Math.max(n,second[i]))}); }
 ctx.ui();return true;
}

export function addToGuide(pid=S.experienceContext.presentation) {return command('Add Presentation to Guide',e=>addStop(e,pid));}
export function guideOverview() {cancelProposal('invoke');S.experienceContext.depth='overview';S.experienceContext.stop=null;T.begin({kind:'experience-overview',subject:S.sel,params:{}});ctx.ui();}
export function expandStop(id) {
 const stop=ctx.experience.stops[id];if(!stop)return false;
 cancelProposal('invoke');A.select(id);S.experienceContext={...S.experienceContext,depth:'occurrence',stop:id,presentation:stop.presentationId,seam:null};
 T.begin({kind:'experience-occurrence',subject:id,target:{id},params:{stop:id}});ctx.ui();return true;
}
export function closeExperienceWork() {cancelProposal('task-end');T.end();S.experienceContext.depth='ordinary';S.experienceContext.stop=null;S.experienceContext.seam=null;ctx.ui();}
export function moveOccurrence(id,delta) {return command('Reorder Guide Stop',e=>moveStop(e,id,delta));}

export function openSeam(a,b) {
 if(resolveNext(ctx.experience,a).id!==b)return false;
 cancelProposal('invoke');S.experienceContext.depth='seam';S.experienceContext.seam={from:a,to:b};S.experienceContext.stop=null;
 T.begin({kind:'experience-seam',subject:S.sel,target:{id:b},params:{from:a,to:b,originUse:null,connection:null}});ctx.ui();return true;
}
export function setSeamMode(mode) {const {from,to}=S.experienceContext.seam;return command('Set Seam transition',e=>editSeam(e,from,to,{mode}));}
export function connectOrigin(uid) {
 const {from,to}=S.experienceContext.seam;
 const row=originCoverage(ctx.experience,ctx.cameraSource,from,to).find(r=>r.useId===uid);
 if(!row||row.missing){A.setStatus('Route needs a resolving origin and destination entry View','refuse');return false;}
 const id=command('Connect Camera Views',(e,c)=>addConnection(c,row.viewId,row.targetId));
 S.task.params.originUse=uid;S.task.params.connection=id;ctx.ui();return id;
}
export async function editRoute(id) {
 const route=ctx.cameraSource.connections[id];if(!route)return false;
 cancelProposal('invoke');
 const epoch=nav.travelEpoch();
 const origin=nav.captureOrigin('Return to Seam reading');
 S.experienceContext.depth='route';S.task.params.connection=id;S.task.params.routeReturn=origin;
 await nav.fly(A.planCam(),S.motion==='instant'?0:700);if(epoch!==nav.travelEpoch())return false;ctx.ui();return true;
}
export function returnRouteReading() {const o=S.task?.params.routeReturn;if(o)nav.restoreCapture(o);S.experienceContext.depth='seam';if(S.task)delete S.task.params.routeReturn;ctx.ui();}
export function routePoint(p) {
 if(S.experienceContext.depth!=='route'||!S.task?.params.connection)return false;
 command('Add Camera interior anchor',(e,c)=>addAnchor(c,S.task.params.connection,[p.x,1.5,p.z]));return true;
}
export function beginAnchorDrag(event) {
 const el=event.target.closest('[data-exp-anchor]');if(!el||S.visitor)return false;
 event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 A.beginEdit();S.expDrag={connection:el.dataset.connection,anchor:el.dataset.expAnchor};el.setPointerCapture(event.pointerId);return true;
}
export function moveAnchorDrag(p) {
 const d=S.expDrag;if(!d)return false;
 const a=ctx.cameraSource.connections[d.connection]?.anchors.find(a=>a.id===d.anchor);if(!a)return false;
 a.position=[p.x,a.position[1],p.z];ctx.ui();return true;
}
export function endAnchorDrag() {if(!S.expDrag)return false;S.expDrag=null;A.commitEdit('Move Camera interior anchor');ctx.ui();return true;}
onCancel(()=>{S.expDrag=null;},5,'Experience pointer');

export function preciseView(uid) {
 const resolved=resolveUse(ctx.experience,ctx.cameraSource,uid);if(!resolved)return false;
 cancelProposal('invoke');A.select(uid);S.experienceContext={...S.experienceContext,depth:'precision',presentation:resolved.use.presentationId};
 T.begin({kind:'experience-camera',subject:uid,target:{id:resolved.view.id},params:{useId:uid,posture:'outside',grip:'frameH'}});ctx.ui();return true;
}
export function posture(which) {
 if(S.task?.kind!=='experience-camera')return false;
 const v=ctx.cameraSource.views[S.task.target.id];if(!v)return false;
 S.task.params.posture=which;
 if(which==='through') {nav.releaseHold();nav.applyPose(v.pose);}
 if(which==='plan')nav.fly(A.planCam(),S.motion==='instant'?0:500);
 ctx.ui();return true;
}
export function proposeFraming(key,value) {
 const t=S.task;if(t?.kind!=='experience-camera')return false;
 const v=ctx.cameraSource.views[t.target.id];if(!v)return false;
 const n=Number(value);if(!Number.isFinite(n)){A.setStatus('Use a finite Camera value','refuse');return false;}
 let patch={[key]:n};if(['x','y','z'].includes(key)){const target=[...v.pose.target];target[['x','y','z'].indexOf(key)]=n;patch={target};}
 return proposePatch(patch);
}
export function proposePatch(patch) {
 const t=S.task,v=ctx.cameraSource.views[t?.target?.id];if(!v)return false;
 try{editView({views:{[v.id]:structuredClone(v)}},v.id,patch);}catch(error){S.expAsk=null;A.setStatus(error.message,'refuse');ctx.ui();return false;}
 const reach=viewReach(ctx.experience,v.id);
 S.expAsk={viewId:v.id,useId:t.params.useId,stopId:S.experienceContext.stop,patch,reach};
 if(reach.uses.length<=1&&reach.stops.length<=1)acceptFraming('shared');else ctx.ui();return true;
}
export function acceptFraming(scope) {
 const ask=S.expAsk;if(!ask)return false;
 const result=command(scope==='shared'?'Update shared Camera framing':'Detach and retarget local Camera framing',(e,c)=>{
  let vid=ask.viewId,uid=ask.useId;
  if(scope==='local'){uid=detachUse(e,c,uid,ask.stopId);vid=e.uses[uid].viewId;}
  editView(c,vid,ask.patch);return {uid,vid};
 });
 S.expAsk=null;
 if(S.task?.kind==='experience-camera'){S.task.target.id=result.vid;S.task.params.useId=result.uid;if(S.task.params.posture==='through')nav.applyPose(ctx.cameraSource.views[result.vid].pose);}
 ctx.ui();return result;
}
onCancel(()=>{S.expAsk=null;},12,'Experience scope proposal');

export function beginCameraDrag(event) {
 const el=event.target.closest('[data-exp-camera]');if(!el||S.task?.kind!=='experience-camera')return false;
 event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 const v=ctx.cameraSource.views[S.task.target.id];if(!v)return false;
 S.cameraDraft={pose:structuredClone(v.pose),base:structuredClone(v.pose),grip:S.task.params.grip,x:event.clientX,y:event.clientY};
 el.setPointerCapture(event.pointerId);return true;
}
export function moveCameraDrag(event,point) {
 const d=S.cameraDraft;if(!d)return false;
 if(['x','y','z'].includes(d.grip)&&point) {const index=['x','y','z'].indexOf(d.grip);d.pose.target[index]=d.grip==='y'?d.base.target[1]-(event.clientY-d.y)*.025:d.grip==='x'?point.x:point.z;}
 else if(d.grip==='frameH')d.pose.frameH=Math.max(.2,d.base.frameH+(event.clientX-d.x)*.04);
 else d.pose[d.grip]=d.base[d.grip]+(event.clientX-d.x)*.008;
 ctx.ui();return true;
}
export function endCameraDrag() {const d=S.cameraDraft;if(!d)return false;S.cameraDraft=null;proposePatch(d.pose);return true;}
onCancel(()=>{S.cameraDraft=null;},5,'Camera framing gesture');

export function coordinate() {
 const x=S.experienceContext,s=x.seam;if(!s)return false;
 const rows=originCoverage(ctx.experience,ctx.cameraSource,s.from,s.to);
 if(!S.task.params.connection)S.task.params.connection=rows.find(r=>r.connectionId)?.connectionId||null;
 if(!S.task.params.connection){A.setStatus('Connect a Camera route before coordinating its stations','refuse');return false;}
 x.depth='coordination';S.task.kind='experience-coordination';S.task.params.station='departure';ctx.ui();return true;
}
export function beatAtStation(stationId,seconds=1) {
 const {from,to}=S.experienceContext.seam;return command('Add station-bound Experience hold',(e,c)=>addBeat(e,c,from,to,S.task.params.connection,stationId,seconds));
}
export function routePace(speed) {
 const id=S.task?.params.connection;if(!id)return false;
 const affected=connectionReach(ctx.experience,ctx.cameraSource,id);
 S.expRouteAsk={id,speed,affected};if(affected.length<=1)return acceptRoutePace();ctx.ui();return true;
}
export function acceptRoutePace() {
 const ask=S.expRouteAsk;if(!ask)return false;
 command('Set Camera route pace',(e,c)=>{if(!c.connections[ask.id])throw Error('Route removed');c.connections[ask.id].speed=ask.speed;});S.expRouteAsk=null;ctx.ui();return true;
}
onCancel(()=>{S.expRouteAsk=null;},12,'Camera route pace proposal');

export function addNarration(pid=S.experienceContext.presentation) {
 return command('Add narration',e=>addContribution(e,pid,{kind:'narration',name:'Narration',text:e.presentations[pid]?.meaning||'An explanation of this place.',markers:[]},'narration'));
}
export function editDefinition(uid,key,value) {return command('Edit contribution',e=>{const d=e.definitions[e.uses[uid]?.definitionId];if(!d)throw Error('Contribution removed');d[key]=value;});}
export function addMarker(uid,label='Named phrase') {
 return command('Add narration phrase',e=>{const d=e.definitions[e.uses[uid]?.definitionId];if(d?.kind!=='narration')throw Error('Not narration');d.markers.push({id:fresh(e,'phrase'),label,fraction:.5});});
}
export function beginOffer(kind='behavior') {
 const p=ctx.experience.presentations[S.experienceContext.presentation];
 const subject=p?.focus.kind==='subjects'&&ctx.sceneSource.subjects[p.focus.ids[0]]?p.focus.ids[0]:'machine';
 S.expOfferDraft={kind,subjectId:subject,trigger:subject,capabilityId:capabilities(ctx.sceneSource,subject)[0]?.id,value:true};ctx.ui();
}
export function acceptOffer() {
 const draft=S.expOfferDraft;if(!draft)return false;const cap=capability(ctx.sceneSource,draft.subjectId,draft.capabilityId);if(!cap)return false;
 const value=cap.control==='range'?Number(draft.value):draft.value===true||draft.value==='true';
 if(cap.control==='range'&&(!Number.isFinite(value)||value<cap.min||value>cap.max)){A.setStatus(`Use a value between ${cap.min} and ${cap.max}`,'refuse');return false;}
 const id=command('Add '+draft.kind,e=>addContribution(e,S.experienceContext.presentation,{kind:'control',name:cap.label,subjectId:draft.subjectId,capabilityId:cap.id,value},draft.kind,draft.trigger));
 S.expOfferDraft=null;ctx.ui();return id;
}
export function changeOfferField(key,value){if(!S.expOfferDraft)return;S.expOfferDraft[key]=value;if(key==='subjectId'){const cap=capabilities(ctx.sceneSource,value)[0];S.expOfferDraft.capabilityId=cap?.id;S.expOfferDraft.value=cap?.control==='range'?cap.max:true;}ctx.ui();}
export function reuseFraming(pid,vid){return command('Reuse Camera View',(e,c)=>reuseView(e,c,pid,vid));}
export function visitorCommand(action,id=null){
 const v=S.visitor;if(!v)return false;const e=v.source.experience,c=v.source.camera,scene=v.source.scene,r=v.runtime;
 if(action==='next')v.runtime=R.nextRuntime(e,c,r,scene);
 if(action==='back')v.runtime=R.previousRuntime(e,c,r,scene);
 if(action==='start')v.runtime=R.startGuide(e,c,r,scene);
 if(action==='auto') {v.runtime.autoplay=!r.autoplay;v.runtime.elapsed=0;const s=e.stops[r.stopId];v.runtime.pacingFallback=s?.pacing.kind==='signal'&&R.signalEmitted(r,s.pacing.ref);}
 if(action==='activate')v.runtime=R.activateRuntime(e,c,r,id,scene);
 if(action==='stop')v.runtime=R.stopActivityRuntime(e,r,id);
 if(action==='explore')v.runtime=R.exploreRuntime(r,nav.plainPose());
 if(action==='rejoin')v.runtime=R.resumeGuide(e,c,r,nav.plainPose());
 if(action==='look')v.runtime=R.lookRuntime(e,c,r,id,nav.plainPose());
 if(action==='detour')v.runtime=R.chooseRuntime(e,c,r,id,true,scene);
 if(action==='return')v.runtime=R.returnDetour(e,c,r,scene);
 if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);ctx.ui();return true;
}
export function visitorPointer(event){
 const v=S.visitor;if(!v)return;
 if(v.runtime.exploring) {S.visitorDrag={x:event.clientX,y:event.clientY};return;}
 const hit=ctx.stage.pick(event.clientX,event.clientY),id=hit?.object?.userData?.id||hit?.id;
 const e=v.source.experience,u=Object.values(e.uses).find(u=>u.kind==='interaction'&&u.triggerSubjectId===id&&(!u.availability||u.availability===v.runtime.presentationId));if(u)visitorCommand('activate',u.id);
}
export function sourceCapability(sid,cid,value){
 const cap=capability(ctx.sceneSource,sid,cid);
 if(!cap?.sourceEditable||!Number.isFinite(value)||value<(cap.min??0)||value>(cap.max??1)){A.setStatus('Value outside supported Scene capability range','refuse');ctx.ui();return false;}
 return command('Edit Scene capability',()=>setSceneValue(ctx.sceneSource,sid,cid,value));
}
onCancel(()=>{S.expOfferDraft=null;},12,'Experience offer draft');

export function resetExperience(example=false) {
 if(S.visitor)exitPreview();cancelProposal('reset');T.park();initExperience();
 S.parked=null;S.parkedByLens={};S.undo=[];S.redo=[];S.sel=null;S.expand=false;S.task=null;
 if(example){
  const e=ctx.experience,c=ctx.cameraSource;
  const pid=addPresentation(e,{kind:'subjects',ids:['machine']},'Understand the drive');
  e.presentations[pid].meaning='The casing protects the rotor. See how power travels through the machine.';
  const base={target:[-10,1.2,1],az:1.2,el:.25,frameH:3,flat:0};
  const entry=addView(e,c,pid,base,'Machine overview','entry'),inside=addView(e,c,pid,{...base,frameH:1.8},'Inside','choice'),output=addView(e,c,pid,{...base,az:.9},'Output','choice');
  const n=addContribution(e,pid,{kind:'narration',name:'How the drive works',text:e.presentations[pid].meaning,duration:18,markers:[{id:'inside',label:'Look inside',fraction:1/3},{id:'output',label:'Follow output',fraction:2/3}]},'narration');
  e.uses[inside].cue={useId:n,signal:'marker:inside'};e.uses[output].cue={useId:n,signal:'marker:output'};
  const open=addContribution(e,pid,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});e.uses[open].end={kind:'experience'};
  const run=addContribution(e,pid,{kind:'control',name:'Run rotor',subjectId:'machine',capabilityId:'rotor',value:true});e.uses[run].start={kind:'after',useId:open,signal:'complete'};e.uses[run].end={kind:'experience'};
  const piano=addContribution(e,null,{kind:'control',name:'Play Piano',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');e.uses[piano].availability=null;
  const light=addContribution(e,null,{kind:'control',name:'Light from Switch',subjectId:'light',capabilityId:'intensity',value:3},'interaction','switch');e.uses[light].availability=null;
  const compare=addPresentation(e,{kind:'subjects',ids:['machine','mesh']},'Compare materials');reuseView(e,c,compare,e.uses[entry].viewId);setRole(e,e.presentations[compare].uses[0],'entry');
  const a=addStop(e,pid),b=addStop(e,compare);e.stops[a].choices.push({id:fresh(e,'choice'),label:'Compare materials detour',targetId:b,kind:'detour'});
  S.experienceContext.presentation=pid;S.sel=pid;
 }
 buildCapabilitySubjects();ctx.ui();return true;
}
export function presenterStep(delta) {S.experiencePresenter=Math.max(0,Math.min(3,(S.experiencePresenter||0)+delta));ctx.ui();return S.experiencePresenter;}

export function stepVisitor(seconds){const v=S.visitor;if(!v)return false;v.runtime=R.tickRuntime(v.source.experience,v.source.camera,v.runtime,seconds,v.source.scene);if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);ctx.ui();return true;}

export function cameraSnapshot(){const positions=Object.fromEntries(Object.values(ctx.cameraSource.views).flatMap(v=>(v.focus?.ids||[]).map(id=>[id,A.worldOf(id)])));return lowerCamera(ctx.cameraSource,positions);}

export function parkExperience() {
 const t=S.task,x=S.experienceContext;
 if(t?.kind.startsWith('experience-')) {
  const acceptedKeys=['useId','posture','grip','from','to','originUse','connection','station','invokeUse','stop'];
  S.parkedByLens.experience={lens:'experience',identity:t.subject,name:resolveExperience(t.subject)?.item.name||t.subject||'Guide',kind:t.kind,context:structuredClone(x),target:structuredClone(t.target),params:Object.fromEntries(acceptedKeys.filter(k=>k in t.params).map(k=>[k,structuredClone(t.params[k])]))};
 }
 cancelProposal('lens');T.park();S.experienceContext={...x,depth:'ordinary',stop:null,seam:null};ctx.ui();return S.parkedByLens.experience;
}
export function experienceParkedContext() {
 const p=S.parkedByLens.experience;if(!p)return null;
 const result={ok:false,reason:'',identity:p.identity,name:p.name,wrongLens:S.lens!=='experience'};
 if(p.identity&&!resolveExperience(p.identity)&&!thing(p.identity)){result.reason='Original identity removed';return result;}
 if(S.sel!==p.identity){result.reason='Select the original identity explicitly';result.fix='select';return result;}
 const x=p.context;
 if(x.presentation&&!ctx.experience.presentations[x.presentation]){result.reason='Presentation removed';return result;}
 if(x.stop&&!ctx.experience.stops[x.stop]){result.reason='Stop removed';return result;}
 if(x.seam&&resolveNext(ctx.experience,x.seam.from).id!==x.seam.to){result.reason='Seam bookends changed';return result;}
 if(p.params.useId){const use=resolveUse(ctx.experience,ctx.cameraSource,p.params.useId);if(!use||use.view.id!==p.target?.id){result.reason='Framing removed or rebound';return result;}}
 if(p.params.connection&&(!ctx.cameraSource.connections[p.params.connection]||(x.seam&&!originCoverage(ctx.experience,ctx.cameraSource,x.seam.from,x.seam.to).some(row=>row.connectionId===p.params.connection&&!row.missing)))){result.reason='Camera connection removed or rebound';return result;}
 if(p.params.station){const route=ctx.cameraSource.connections[p.params.connection];if(!route||!nav.stations(route).some(s=>s.id===p.params.station)){result.reason='Camera station removed';return result;}}
 result.ok=true;return result;
}
export function resumeExperience() {
 const p=S.parkedByLens.experience,v=experienceParkedContext();
 if(!p||!v?.ok||v.wrongLens){A.setStatus(v?.reason||'Experience work cannot resume here','refuse');return false;}
 cancelProposal('resume');S.experienceContext=structuredClone(p.context);
 T.begin({kind:p.kind,subject:p.identity,target:structuredClone(p.target),params:structuredClone(p.params)});
 // Surface reactivation is neutral even when the remembered posture was Through or Plan.
 S.parkedByLens.experience=null;ctx.ui();return true;
}
A.registerLensWork({park:parkExperience,resume:resumeExperience});

export function updateHold(id,seconds) {
 if(!Number.isFinite(seconds)||seconds<0){A.setStatus('Hold needs a finite nonnegative duration','refuse');return false;}
 const s=S.experienceContext.seam;if(!s)return false;
 return command('Edit Experience station hold',e=>{const beat=e.seams[`${s.from}>${s.to}`]?.beats.find(b=>b.id===id&&b.kind==='hold');if(!beat)throw Error('Hold removed');beat.seconds=seconds;});
}
