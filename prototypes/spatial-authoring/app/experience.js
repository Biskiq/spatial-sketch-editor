import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole, addStop, moveStop, resolveNext, editSeam, originCoverage, addConnection, addAnchor, resolveUse, viewReach, detachUse, editView } from './experience-model.js';
export function initExperience() {
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
  const existing = Object.values(ctx.experience.presentations).find(p => JSON.stringify(p.focus) === JSON.stringify(f));
  const id = existing?.id || command('Create Presentation', e => addPresentation(e, f));
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
 return command('Capture Camera View', (e,c)=>addView(e,c,pid,nav.plainPose(),'Captured framing',entryUse(e,pid)?'choice':'entry'));
}
export function autoView(pid=S.experienceContext.presentation) {
 const p=ctx.experience.presentations[pid]; if(!p)return false;
 let target=[-2,1,0];
 if(p.focus.kind==='subjects') { const points=p.focus.ids.map(A.worldOf).filter(Boolean); if(points.length)target=points[0]; }
 if(p.focus.kind==='region')target=p.focus.min.map((n,i)=>(n+p.focus.max[i])/2);
 const pose={target,az:.7,el:.35,frameH:8,flat:0,mirror:false};
 return command('Add automatic framing',(e,c)=>{const id=addView(e,c,pid,pose,'Auto framing',entryUse(e,pid)?'choice':'entry'); c.views[e.uses[id].viewId].anchor='relative';return id;});
}
export function changeRole(id,role) { return command('Change View role',e=>setRole(e,id,role)); }
export function preview(pid=S.experienceContext.presentation) {
 if(S.visitor || !ctx.experience.presentations[pid]) return false;
 cancelProposal('preview');
 const token={lens:S.lens,sel:S.sel,context:structuredClone(S.experienceContext),origin:nav.captureOrigin('Preview return'),task:S.task,session:S.session,expand:S.expand,sheet:{...S.sheet},browse:{...S.browse}};
 // Suspend authoring without writing source or passing through lens parking.
 T.park();
 S.visitor={returnToken:token,source:structuredClone({experience:ctx.experience,camera:ctx.cameraSource}),runtime:createRuntime(ctx.experience,ctx.cameraSource,pid,nav.plainPose())};
 nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;
}
export function exitPreview() {
 const v=S.visitor;if(!v)return false;
 S.visitor=null;const t=v.returnToken;
 S.lens=t.lens;S.sel=t.sel;S.experienceContext=t.context;S.expand=t.expand;S.sheet=t.sheet;S.browse=t.browse;
 nav.restoreCapture(t.origin);ctx.ui();return true;
}
let runtimeAt=0;
export function visitorFrame(now) {
 if(!S.visitor) {runtimeAt=now;return;}
 const v=S.visitor,dt=Math.min(.25,Math.max(0,(now-runtimeAt)/1000));runtimeAt=now;
 v.runtime=tickRuntime(v.source.experience,v.source.camera,v.runtime,dt);
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
 const origin=nav.captureOrigin('Return to Seam reading');
 S.experienceContext.depth='route';S.task.params.connection=id;S.task.params.routeReturn=origin;
 await nav.fly(A.planCam(),S.motion==='instant'?0:700);ctx.ui();return true;
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

