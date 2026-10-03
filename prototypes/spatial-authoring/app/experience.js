import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole, addStop, moveStop, resolveNext, editSeam, originCoverage, addConnection, addAnchor } from './experience-model.js';
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
