import { conformanceFixture } from './conformance-fixture.js';
import { createSceneCapabilities, capability, capabilities, setSceneValue } from './experience-capabilities.js';
import { buildCapabilitySubjects, realizeCapabilities } from './experience-scene.js';
import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import * as R from './experience-runtime.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx, thing } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole, addStop, moveStop, resolveNext, editSeam, stopEntry, originCoverage, addConnection, addAnchor, resolveUse, viewReach, detachUse, editView, addBeat, connectionReach, addContribution, fresh, reuseView, lowerCamera, addInvocationBeat, clearExperience, setPrimaryExplanation, primaryExplanation, captureUses, captureCapability, captureNew, presentationUses, narrationDuration, narrationPassages, eligibleViews } from './experience-model.js';
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
  const label = f.kind === 'subjects' && f.ids.length === 1 ? thing(f.ids[0])?.item?.name : null;
  const id = command('Create Presentation', e => addPresentation(e, f, label || 'Untitled Presentation'));
  // A fresh subject-focused moment suggests Camera framing immediately: derived intent, never an
  // authored View, and Capture is what accepts it.
  const derived = nav.deriveFraming(ctx.experience.presentations[id]);
  if (derived) S.derivedView = { presentation: id, ...derived };
  openPresentation(id); return id;
}
export function openPresentation(id) {
  if (!ctx.experience.presentations[id]) return false;
  A.select(id); S.experienceContext.presentation = id; ctx.ui(); return true;
}
const definitionReach=(e,id)=>Object.values(e.uses).filter(u=>u.definitionId===id).flatMap(u=>{const stops=Object.values(e.stops).filter(s=>s.presentationId===u.presentationId);return stops.length?stops.map(s=>({id:u.id+'@'+s.id,name:`${e.definitions[id]?.name} · Stop ${e.guide.indexOf(s.id)+1}`})):[{id:u.id,name:e.presentations[u.presentationId]?.name||'Experience-wide interaction'}];});
const presentationReach=(e,id)=>Object.values(e.stops).filter(s=>s.presentationId===id).map(s=>({id:s.id,name:`Stop ${e.guide.indexOf(s.id)+1} · ${s.name}`}));
function sourceProposal(label,kind,id,key,value){
 const pid=kind==='definition'?ctx.experience.uses[id]?.definitionId:kind==='presentation'?id:ctx.experience.uses[id]?.presentationId;if(!pid)return false;
 const affected=kind==='definition'?definitionReach(ctx.experience,pid):presentationReach(ctx.experience,pid);S.expSourceAsk={label,kind,id,key,value:structuredClone(value),pid,affected};
 if(affected.length<=1)return acceptSource();ctx.ui();return true;
}
export function updatePresentation(id,key,value){if(!['name','meaning','focus'].includes(key))return false;return sourceProposal(`Edit Presentation ${key}`,'presentation',id,key,value);}
export function acceptSource(){
 const ask=S.expSourceAsk;if(!ask)return false;const affected=ask.kind==='definition'?definitionReach(ctx.experience,ask.pid):presentationReach(ctx.experience,ask.pid);
 if(JSON.stringify(affected)!==JSON.stringify(ask.affected)){ask.affected=affected;ctx.ui();return false;}
 const result=command(ask.label,e=>{if(ask.kind==='definition'){const u=e.uses[ask.id],d=e.definitions[ask.pid];if(!d||u?.definitionId!==ask.pid)throw Error('Contribution removed or rebound');d[ask.key]=ask.key==='markers'?ask.value.map(m=>m.id?m:{...m,id:fresh(e,'phrase')}):ask.value;}else if(ask.kind==='presentation'){const p=e.presentations[ask.id];if(!p)throw Error('Presentation removed');p[ask.key]=ask.value;}else{const u=e.uses[ask.id];if(!u||u.presentationId!==ask.pid)throw Error('View use removed or rebound');if(ask.key==='role')setRole(e,ask.id,ask.value);else u[ask.key]=ask.value;}});S.expSourceAsk=null;ctx.ui();return result;
}
onCancel(()=>{S.expSourceAsk=null;},12,'Shared Experience proposal');
export const updateUse=(id,key,value)=>sourceProposal('Edit shared View '+key,'use',id,key,value);
export function handleExperienceAction(el) {
  const action = el?.dataset?.act;
  if (!action?.startsWith('exp-')) return false;
  if(S.visitor&&!['exp-visitor','exp-exit-preview'].includes(action))return true;
  if (action === 'exp-create') present();
  if (action === 'exp-open') openPresentation(el.dataset.id);
  if (action === 'exp-add-guide') addToGuide(el.dataset.id||undefined);
  if (action === 'exp-guide') guideOverview();
  if (action === 'exp-stop') selectStop(el.dataset.id);
  if (action === 'exp-expand-stop') expandStop(el.dataset.id);
  if (action === 'exp-preview-guide') previewGuide();
  if (action === 'exp-view-order') suggestViews(el.dataset.id,el.dataset.clear==='true');
  if (action === 'exp-view-order-move') moveSuggestedView(el.dataset.id,Number(el.dataset.delta));
  if (action === 'exp-close') closeExperienceWork();
  if (action === 'exp-move-stop') moveOccurrence(el.dataset.id,Number(el.dataset.delta));
  if (action === 'exp-seam') openSeam(el.dataset.from,el.dataset.to);
  if (action === 'exp-cut') setSeamMode('cut');
  if (action === 'exp-travel') setSeamMode('travel');
  if (action === 'exp-connect') connectOrigin(el.dataset.id);
  if (action === 'exp-route') editRoute(el.dataset.id);
  if (action === 'exp-route-return') returnRouteReading();
  if(action==='exp-hints'&&autoView()){S.experienceContext.depth='hints';ctx.ui();}
  if (action === 'exp-hint') {const v=ctx.cameraSource.views[S.task?.target?.id];if(v)proposeFraming(el.dataset.key,Number(el.dataset.value));}
  if (action === 'exp-precise') preciseView(el.dataset.id);
  if (action === 'exp-posture') posture(el.dataset.posture);
  if (action === 'exp-grip') {if(S.task?.kind==='experience-camera')S.task.params.grip=el.dataset.grip;ctx.ui();}
  if (action === 'exp-scope-shared') acceptFraming('shared');
  if (action === 'exp-scope-local') acceptFraming('local');
  if (action === 'exp-scope-cancel') {S.expAsk=null;ctx.ui();}
  if(action==='exp-station-focus'){if(S.task)S.task.params.station=el.dataset.id;ctx.ui();}
  if(action==='exp-route-choice'){if(S.task){S.task.params.connection=el.dataset.id;S.task.params.station='departure';}coordinate();}
  if (action === 'exp-coordinate') coordinate();
  if (action === 'exp-mark-station') command('Name Camera station',(e,c)=>{const r=c.connections[S.task.params.connection];r.markers.push({id:fresh(c,'marker'),name:'Mid-route station',progress:.5});});
  // Binding a station moves that Activity's trigger onto the chosen Camera station, so a refused target
  // is an ordinary refusal the author can read — never a page fault and never a silent second trigger.
  if (action === 'exp-invoke-beat') {const s=S.experienceContext.seam;try{command('Invoke Activity at Camera station',(e,c)=>addInvocationBeat(e,c,s.from,s.to,S.task.params.connection,S.task.params.station,S.task.params.invokeUse,ctx.sceneSource));}catch(error){A.setStatus(error.message,'refuse');ctx.ui();}}
  if (action === 'exp-beat') beatAtStation(S.task?.params.station||'departure');
  if (action === 'exp-route-scope') acceptRoutePace();
  if (action === 'exp-narration') addNarration();
  if (action === 'exp-offer') beginOffer(el.dataset.kind||'behavior',el.dataset.id||null);
  if (action === 'exp-offer-accept') acceptOffer();
  if (action === 'exp-offer-cancel') {S.expOfferDraft=null;ctx.ui();}
  if (action === 'exp-audition') auditionCapability(el.dataset.id,el.dataset.cap,el.dataset.value==='true');
  if (action === 'exp-audition-clear') clearAudition(el.dataset.id);
  if (action === 'exp-use') useCapability(el.dataset.id,el.dataset.cap);
  if (action === 'exp-use-scope') useCapability(el.dataset.id,el.dataset.cap,'experience');
  if (action === 'exp-capture-choice') chooseCaptureUse(el.dataset.id);
  if (action === 'exp-capture-new') captureAnother();
  if (action === 'exp-capture-cancel') cancelCaptureAsk();
  if (action === 'exp-marker') addMarker(el.dataset.id);
  if (action === 'exp-marker-remove') removeMarker(el.dataset.id,el.dataset.marker);
  if (action === 'exp-passage') addMarker(el.dataset.id,el.dataset.label,Number(el.dataset.time));
  if (action === 'exp-visitor') visitorCommand(el.dataset.command,el.dataset.id);
  if (action === 'exp-remove-stop') command('Remove Guide Stop',e=>{e.guide=e.guide.filter(id=>id!==el.dataset.id);delete e.stops[el.dataset.id];});
  if (action === 'exp-remove-contribution') command('Remove contribution',e=>delete e.uses[el.dataset.id]);
  if (action === 'exp-reset') resetExperience();
  if (action === 'exp-conformance') loadConformance();
  if (action === 'exp-example') loadExample();
  if (action === 'exp-presenter') presenterStep(Number(el.dataset.delta));
  if (action === 'exp-resume') resumeExperience();
  if (action === 'exp-dismiss-parked') {S.parkedByLens.experience=null;ctx.ui();}
  if (action === 'exp-capture') captureView();
  if (action === 'exp-auto') autoView();
  if (action === 'exp-role') changeRole(el.dataset.id,el.dataset.role);
  if(action==='exp-derived-hint')derivedHint(el.dataset.hint);
  if(action==='exp-bring')bringIntoView();
  if(action==='exp-source-accept')acceptSource();
  if(action==='exp-source-cancel'){S.expSourceAsk=null;ctx.ui();}
  if(action==='exp-camera-return'){nav.putBack();if(S.task)S.task.params.posture=nav.readingFor(cameraSnapshot().views[S.task.target.id]);ctx.ui();}
  if(action==='exp-route-cancel'){S.expRouteAsk=null;ctx.ui();}
  if (action === 'exp-preview') preview(el.dataset.id || undefined);
  if (action === 'exp-exit-preview') exitPreview();
  if (action === 'exp-region') { cancelProposal('invoke'); T.begin({kind:'experience-region',subject:S.sel,params:{first:null}}); A.setStatus('Choose two corners on the Stage to present a region'); }
  if (action === 'exp-environment') present({ kind: 'environment' });
  return true;
}
export function presentationValid(id) { const p = ctx.experience.presentations[id]; return !!p && validateFocus(p, id => !!A.worldOf(id)); }

export function captureView(pid=S.experienceContext.presentation){
 const p=ctx.experience.presentations[pid];if(!p)return false;
 const derived=S.derivedView?.presentation===pid?nav.deriveFraming(p,S.task?.params.hints||[]):null;
 const result=command('Capture Camera View',(e,c)=>{const id=addView(e,c,pid,derived?.pose||nav.plainPose(),derived?.name||(entryUse(e,pid)?'Captured perspective':'Entry framing'),entryUse(e,pid)?'choice':'entry');const v=c.views[e.uses[id].viewId];v.focusAt=e.presentations[pid].focus.kind==='subjects'?A.worldOf(e.presentations[pid].focus.ids[0]):null;return id;});S.derivedView=null;if(S.task?.kind==='experience-hints'){T.end();S.experienceContext.depth='ordinary';}ctx.ui();return result;
}
export function autoView(pid=S.experienceContext.presentation){
 const p=ctx.experience.presentations[pid];if(!p)return false;const derived=nav.deriveFraming(p);if(!derived){A.setStatus('Focus unresolved · repair before framing','refuse');return false;}
 cancelProposal('invoke');T.begin({kind:'experience-hints',subject:S.sel,target:{id:pid},params:{hints:[]}});S.derivedView={presentation:pid,...derived};ctx.ui();return true;
}
export function derivedHint(label){if(!S.derivedView)autoView();if(!S.task||!S.derivedView)return false;S.task.params.hints.push(label);const p=ctx.experience.presentations[S.derivedView.presentation];S.derivedView={presentation:p.id,...nav.deriveFraming(p,S.task.params.hints)};ctx.ui();return true;}
export function bringIntoView(){const c=cameraSnapshot(),e=ctx.experience,x=S.experienceContext;let points=[];
 if(x.seam){for(const row of originCoverage(e,c,x.seam.from,x.seam.to)){for(const id of [row.viewId,row.targetId])if(c.views[id])points.push(nav.eye(c.views[id].pose),c.views[id].pose.target);const r=nav.routeGeometry(c,row.connectionId);if(r)points.push(...r.samples.map(s=>s.observer));}}
 else if(x.depth==='overview'){points=e.guide.map(id=>resolveUse(e,c,stopEntry(e,id).id)?.view?.pose.target).filter(Boolean);}
 else{const p=e.presentations[x.presentation];points=(p?.uses||[]).flatMap(id=>{const v=c.views[e.uses[id]?.viewId];return v?[nav.eye(v.pose),v.pose.target]:[];});if(S.derivedView)points.push(nav.eye(S.derivedView.pose),S.derivedView.pose.target);if(!points.length&&p?.focus.kind==='subjects')points=p.focus.ids.map(A.worldOf).filter(Boolean);}
 return nav.framePoints(points,{plan:nav.plainPose().el>1.4||!!x.seam});
}
export const changeRole=(id,role)=>updateUse(id,'role',role);
export function preview(pid=S.experienceContext.presentation,guide=false) {
 if(S.visitor || (!guide&&!ctx.experience.presentations[pid]) || (guide&&!ctx.experience.guide.length)) return false;
 cancelProposal('preview');
 const token={lens:S.lens,sel:S.sel,context:structuredClone(S.experienceContext),origin:nav.captureOrigin('Preview return'),inspection:A.captureInspection(),expand:S.expand,sheet:{...S.sheet},browse:{...S.browse}};
 // Suspend authoring without writing source or passing through lens parking. Auditions are cleared
 // before entry: the visit sees authored source, never an authoring projection.
 T.park();
 nav.releaseHold();
 S.expAudition=null;
 S.visitor={returnToken:token,source:structuredClone({experience:ctx.experience,camera:cameraSnapshot(),scene:ctx.sceneSource}),runtime:createRuntime(ctx.experience,cameraSnapshot(),guide?null:pid,nav.plainPose(),ctx.sceneSource)};
 if(guide)S.visitor.runtime=R.startGuide(S.visitor.source.experience,S.visitor.source.camera,S.visitor.runtime,S.visitor.source.scene);
 nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;
}
export async function exitPreview() {
 const v=S.visitor;if(!v)return false;
 S.visitor=null;S.visitorDrag=null;const t=v.returnToken;
 S.lens=t.lens;S.sel=t.sel;S.experienceContext=t.context;S.expand=t.expand;S.sheet=t.sheet;S.browse=t.browse;
 await A.restoreInspection(t.inspection);nav.restoreCapture(t.origin);
 if(S.task?.kind==='experience-hints'){const p=ctx.experience.presentations[S.task.target.id];S.derivedView=p?{presentation:p.id,...nav.deriveFraming(p,S.task.params.hints)}:null;}
 S.expReview.previews=(S.expReview?.previews||0)+1;
 ctx.ui();return true;
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

export function previewGuide(){return preview(null,true);}
export function selectStop(id){
 const stop=ctx.experience.stops[id];if(!stop)return false;
 cancelProposal('selection');A.select(id);
 const x=S.experienceContext;
 // Selecting a Stop ends any writer or procedure that belonged to the previous context: an old route
 // writer must not stay armed behind the new selection. Peek is awareness, not disclosure, so the
 // context normalizes to the same Peek-level reading; the realized viewpoint is preserved.
 const procedure=['occurrence','seam','route','coordination','precision','hints'].includes(x.depth);
 if(procedure){S.derivedView=null;T.end();}
 const depth=procedure?'overview':x.depth;
 S.experienceContext={...x,depth,stop:null,presentation:stop.presentationId,seam:null};
 if(depth==='overview')T.begin({kind:'experience-overview',subject:id,params:{}});
 ctx.ui();return true;
}
export function suggestViews(pid,clear=false){return command(clear?'Free View choice':'Suggest a View order',e=>{const p=e.presentations[pid];if(!p)throw Error('Presentation removed');if(clear)delete p.viewOrder;else p.viewOrder=eligibleViews(e,pid);});}
export function moveSuggestedView(uid,delta){return command('Reorder suggested Views',e=>{const p=e.presentations[e.uses[uid]?.presentationId],ids=p?.viewOrder;if(!ids)return;const at=ids.indexOf(uid),to=at+delta;if(at>=0&&to>=0&&to<ids.length)[ids[at],ids[to]]=[ids[to],ids[at]];});}
export function addToGuide(pid=S.experienceContext.presentation) {return command('Add Presentation to Guide',e=>addStop(e,pid));}
export function guideOverview() {cancelProposal('invoke');S.experienceContext.depth='overview';S.experienceContext.stop=null;T.begin({kind:'experience-overview',subject:S.sel,params:{}});ctx.ui();}
export function expandStop(id) {
 const stop=ctx.experience.stops[id];if(!stop)return false;
 cancelProposal('invoke');A.select(id);S.experienceContext={...S.experienceContext,depth:'occurrence',stop:id,presentation:stop.presentationId,seam:null};
 T.begin({kind:'experience-occurrence',subject:id,target:{id},params:{stop:id}});ctx.ui();return true;
}
export function closeExperienceWork() {cancelProposal('task-end');S.derivedView=null;T.end();S.experienceContext.depth='ordinary';S.experienceContext.stop=null;S.experienceContext.seam=null;ctx.ui();}
export function moveOccurrence(id,delta) {return command('Reorder Guide Stop',e=>moveStop(e,id,delta));}

export function openSeam(a,b) {
 if(resolveNext(ctx.experience,a).id!==b)return false;
 cancelProposal('invoke');S.experienceContext.depth='seam';S.experienceContext.seam={from:a,to:b};S.experienceContext.stop=null;
 T.begin({kind:'experience-seam',subject:S.sel,target:{id:b},params:{from:a,to:b,originUse:null,connection:null}});if(ctx.experience.seams[`${a}>${b}`]?.beats.length)coordinate();ctx.ui();return true;
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
 nav.beginReturn('Return to Seam reading');
 S.experienceContext.depth='route';S.task.params.connection=id;
 await bringIntoView();if(epoch!==nav.travelEpoch())return false;ctx.ui();return true;
}
export function returnRouteReading(){nav.putBack();S.experienceContext.depth='seam';ctx.ui();}
function routeProposal(id,patch,label){
 const route=ctx.cameraSource.connections[id];if(!route)return false;
 // A proposal is only ever made by the writer the context currently holds: a stale route selection
 // cannot be edited through a later gesture, while a drawn reachable route stays editable.
 if(!['experience-seam','experience-coordination'].includes(S.task?.kind)||!S.task?.params?.connection)return false;
 const affected=connectionReach(ctx.experience,ctx.cameraSource,id);S.expRouteAsk={id,patch,label,affected};
 if(affected.length<=1)return acceptRoutePace();ctx.ui();return true;
}
export function routePoint(p){
 const x=S.experienceContext,t=S.task,id=t?.params?.connection;
 if(!['route','coordination'].includes(x.depth)||!x.seam||!id)return false;
 if(!['experience-seam','experience-coordination'].includes(t.kind))return false;
 if(!ctx.cameraSource.connections[id])return false;
 const position=[p.x,1.5,p.z];
 return routeProposal(id,{addAnchor:position},'Add Camera interior anchor');
}
export function beginAnchorDrag(event){
 const el=event.target.closest('[data-exp-anchor]');if(!el||S.visitor)return false;event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 const a=ctx.cameraSource.connections[el.dataset.connection]?.anchors.find(a=>a.id===el.dataset.expAnchor);if(!a)return false;
 S.expDrag={connection:el.dataset.connection,anchor:a.id,position:[...a.position],base:[...a.position],moved:false};S.anchorFocus={connection:el.dataset.connection,anchor:a.id};el.setPointerCapture(event.pointerId);return true;
}
export function moveAnchorDrag(p){const d=S.expDrag;if(!d)return false;d.position=[p.x,d.base[1],p.z];d.moved=d.position.some((n,i)=>Math.abs(n-d.base[i])>.01);ctx.ui();return true;}
export function endAnchorDrag(){const d=S.expDrag;if(!d)return false;S.expDrag=null;if(d.moved)routeProposal(d.connection,{anchor:d.anchor,position:d.position},'Move Camera interior anchor');ctx.ui();return true;}
export function nudgeAnchor(id,anchor,dx,dz){const a=ctx.cameraSource.connections[id]?.anchors.find(a=>a.id===anchor);if(!a)return false;return routeProposal(id,{anchor,position:[a.position[0]+dx,a.position[1],a.position[2]+dz]},'Move Camera interior anchor');}
onCancel(()=>{S.expDrag=null;},5,'Experience pointer');

export function preciseView(uid) {
 const resolved=resolveUse(ctx.experience,ctx.cameraSource,uid);if(!resolved)return false;
 cancelProposal('invoke');A.select(uid);S.experienceContext={...S.experienceContext,depth:'precision',presentation:resolved.use.presentationId};
 nav.beginReturn('Before precise Camera');
 T.begin({kind:'experience-camera',subject:uid,target:{id:resolved.view.id},params:{useId:uid,posture:'outside',grip:'frameH'}});ctx.ui();return true;
}
export async function posture(which){
 if(S.task?.kind!=='experience-camera')return false;const v=cameraSnapshot().views[S.task.target.id];if(!v)return false;
 cancelProposal('posture');
 if(which==='through')nav.lookThrough(v.pose);
 else if(which==='plan')await nav.framePoints([nav.eye(v.pose),v.pose.target],{plan:true,captureReturn:false});
 else if(which==='outside')await nav.framePoints([nav.eye(v.pose),v.pose.target,...nav.framingInstrument(v.pose).corners],{captureReturn:false});
 if(S.task?.kind==='experience-camera')S.task.params.posture=nav.readingFor(v);ctx.ui();return true;
}
export function proposeFraming(key,value) {
 const t=S.task;if(t?.kind!=='experience-camera')return false;
 const v=cameraSnapshot().views[t.target.id];if(!v)return false;
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
 const reach=viewReach(ctx.experience,ask.viewId);if(JSON.stringify(reach)!==JSON.stringify(ask.reach)){ask.reach=reach;ctx.ui();return false;}
 const result=command(scope==='shared'?'Update shared Camera framing':'Detach and retarget local Camera framing',(e,c)=>{
  const resolved=resolveUse(e,c,ask.useId);if(!resolved||resolved.view.id!==ask.viewId)throw Error('Framing removed or rebound');
  let vid=ask.viewId,uid=ask.useId;
  if(scope==='local'){uid=detachUse(e,c,uid,ask.stopId);vid=e.uses[uid].viewId;}
  editView(c,vid,ask.patch);return {uid,vid};
 });
 S.expAsk=null;
 if(S.task?.kind==='experience-camera'){S.task.target.id=result.vid;S.task.params.useId=result.uid;if(S.sel===ask.useId&&result.uid!==ask.useId){S.sel=result.uid;S.task.subject=result.uid;}if(S.task.params.posture==='through')nav.lookThrough(cameraSnapshot().views[result.vid].pose);}
 ctx.ui();return result;
}
onCancel(()=>{S.expAsk=null;},12,'Experience scope proposal');
onCancel(reason=>{if(['preview','lens','reset','task-end','invoke'].includes(reason))S.derivedView=null;},13,'Derived framing suspension');

export function beginCameraDrag(event) {
 const el=event.target.closest('[data-exp-camera]');if(!el||S.task?.kind!=='experience-camera')return false;
 event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 const v=cameraSnapshot().views[S.task.target.id];if(!v)return false;
 S.cameraDraft={pose:structuredClone(v.pose),base:structuredClone(v.pose),grip:S.task.params.grip,origin:nav.captureOrigin('Before Camera gesture'),through:nav.readingFor(v)==='through',x:event.clientX,y:event.clientY};
 el.setPointerCapture(event.pointerId);return true;
}
export function moveCameraDrag(event,point) {
 const d=S.cameraDraft;if(!d)return false;
 if(['x','y','z'].includes(d.grip)&&point) {const index=['x','y','z'].indexOf(d.grip);d.pose.target[index]=d.grip==='y'?d.base.target[1]-(event.clientY-d.y)*.025:d.grip==='x'?point.x:point.z;}
 else if(d.grip==='frameH')d.pose.frameH=Math.max(.2,d.base.frameH+(event.clientY-d.y)*.04);
 else d.pose[d.grip]=d.base[d.grip]+(d.grip==='el'?-(event.clientY-d.y):(event.clientX-d.x))*.008;
 if(d.through)nav.applyPose(d.pose);ctx.ui();return true;
}
export function endCameraDrag() {const d=S.cameraDraft;if(!d)return false;nav.restoreCapture(d.origin);S.cameraDraft=null;proposePatch(d.pose);return true;}
onCancel(()=>{if(S.cameraDraft?.origin)nav.restoreCapture(S.cameraDraft.origin);S.cameraDraft=null;},5,'Camera framing gesture');

export function coordinate(){
 const x=S.experienceContext,s=x.seam;if(!s||!S.task)return false;
 const seam=ctx.experience.seams[`${s.from}>${s.to}`];if(!seam||seam.mode!=='travel'){A.setStatus('Coordinate needs Travel on a supported Camera route','refuse');return false;}
 const ids=[...new Set(originCoverage(ctx.experience,cameraSnapshot(),s.from,s.to).filter(r=>!r.missing).map(r=>r.connectionId).filter(Boolean))];
 if(S.task.params.connection&&!ids.includes(S.task.params.connection))S.task.params.connection=null;
 if(!S.task.params.connection){const used=[...new Set(seam.beats.map(b=>b.connectionId).filter(id=>ids.includes(id)))];if(used.length===1)S.task.params.connection=used[0];else if(ids.length===1)S.task.params.connection=ids[0];else {x.depth='coordination';S.task.kind='experience-coordination';S.task.params.chooseRoute=true;ctx.ui();return true;}}
 if(!S.task.params.connection){A.setStatus('Connect a Camera route before coordinating','refuse');return false;}
 x.depth='coordination';S.task.kind='experience-coordination';S.task.params.chooseRoute=false;
 const route=ctx.cameraSource.connections[S.task.params.connection];if(!nav.stations(route).some(s=>s.id===S.task.params.station))S.task.params.station='departure';ctx.ui();return true;
}
export function beatAtStation(stationId,seconds=1) {
 const {from,to}=S.experienceContext.seam;return command('Add station-bound Experience hold',(e,c)=>addBeat(e,c,from,to,S.task.params.connection,stationId,seconds));
}
export function routePace(speed){const id=S.task?.params.connection;if(!id||!['slow','auto','fast'].includes(speed))return false;return routeProposal(id,{speed},'Set Camera route pace');}
export function acceptRoutePace(){
 const ask=S.expRouteAsk;if(!ask)return false;const affected=connectionReach(ctx.experience,ctx.cameraSource,ask.id);
 if(JSON.stringify(affected)!==JSON.stringify(ask.affected)){ask.affected=affected;ctx.ui();return false;}
 command(ask.label,(e,c)=>{const route=c.connections[ask.id];if(!route)throw Error('Route removed');if(ask.patch.speed)route.speed=ask.patch.speed;if(ask.patch.addAnchor)addAnchor(c,ask.id,ask.patch.addAnchor);if(ask.patch.anchor){const a=route.anchors.find(a=>a.id===ask.patch.anchor);if(!a)throw Error('Anchor removed');a.position=[...ask.patch.position];}});S.expRouteAsk=null;ctx.ui();return true;
}
onCancel(()=>{S.expRouteAsk=null;},12,'Camera route pace proposal');

export function addNarration(pid=S.experienceContext.presentation) {
 return command('Add narration',e=>addContribution(e,pid,{kind:'narration',name:'Narration',text:e.presentations[pid]?.meaning||'An explanation of this place.',markers:[]},'narration'));
}
export const editDefinition=(uid,key,value)=>sourceProposal('Edit shared contribution','definition',uid,key,value);
export function addMarker(uid,label='Named phrase',time=null) {
 const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;
 return sourceProposal('Add shared narration phrase','definition',uid,'markers',[...d.markers,{label,time:time??narrationDuration(d)/2}]);
}
export function removeMarker(uid,id){const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;return sourceProposal('Remove narration phrase','definition',uid,'markers',d.markers.filter(m=>m.id!==id));}
export function updateMarker(uid,id,key,value){const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;if(key==='time'&&(!Number.isFinite(value)||value<0))return false;return sourceProposal('Edit narration phrase','definition',uid,'markers',d.markers.map(m=>m.id===id?{...m,[key]:value}:m));}
export function updateActivity(uid,key,value){return command('Edit Activity '+key,e=>{const u=e.uses[uid];if(!u||u.viewId)throw Error('Activity removed');u[key]=structuredClone(value);});}
export function updateStop(id,key,value){return command('Edit this Stop '+key,e=>{const s=e.stops[id];if(!s)throw Error('Stop removed');s[key]=structuredClone(value);});}
export function updateViewSpeed(uid,speed){if(!['cut','slow','auto','fast'].includes(speed))return false;return command('Set Camera View movement',(e,c)=>{const v=c.views[e.uses[uid]?.viewId||uid];if(!v)throw Error('View removed');v.speed=speed;});}export function beginOffer(kind='behavior', subjectId=null) {
  const p=ctx.experience.presentations[S.experienceContext.presentation];
  const subject=subjectId&&ctx.sceneSource.subjects[subjectId]?subjectId:p?.focus.kind==='subjects'&&ctx.sceneSource.subjects[p.focus.ids[0]]?p.focus.ids[0]:'machine';
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

// ----- subject-local capability auditions and capture ---------------------

// The audition projects a supported value on the real Stage without touching Scene source, Experience
// source or Undo. It is the donor's "operate the subject" step, kept distinct from authored Activity.
export function auditionedValue(sid,cap){
  const s=ctx.sceneSource.subjects[sid];if(!s)return null;
  const held=S.expAudition?.[sid]?.[cap.channel];return held===undefined?s.properties[cap.channel]:held;
}
export function auditionCapability(sid,cid,value,quiet=false){
  const scene=ctx.sceneSource,cap=capability(scene,sid,cid),s=scene.subjects[sid];
  if(!cap||!s)return false;
  const v=cap.control==='range'?Number(value):(value===true||value==='true');
  if(cap.control==='range'&&(!Number.isFinite(v)||v<cap.min||v>cap.max)){A.setStatus(`Use a value between ${cap.min} and ${cap.max}`,'refuse');ctx.ui();return false;}
  (S.expAudition??={})[sid]??={};S.expAudition[sid][cap.channel]=v;
  if(!quiet){S.expReview.auditions=(S.expReview?.auditions||0)+1;A.setStatus(`${cap.label} · audition only — source and history untouched`,'view');ctx.ui();}
  return true;
}
export function clearAudition(sid){if(!S.expAudition||!(sid in S.expAudition))return false;delete S.expAudition[sid];ctx.ui();return true;}
export function explainPresentation(pid,text){return command('Edit explanation',e=>setPrimaryExplanation(e,pid,text));}
// Use in Experience: one uniquely matching captured use is updated in place; no match captures a new
// Activity; several matches require a choice and never mutate the first enumerated one. Ambiguity is
// decided before any command, so a refused choice never leaves an empty history step behind.
export function useCapability(sid,cid,scope='presentation'){
  const cap=capability(ctx.sceneSource,sid,cid);if(!cap)return false;
  const pid=scope==='experience'?null:S.experienceContext.presentation;
  if(scope!=='experience'&&!pid){A.setStatus('Open a Presentation first, or capture explicitly at Experience scope','refuse');ctx.ui();return false;}
  const value=auditionedValue(sid,cap);
  const matches=captureUses(ctx.experience,pid,sid,cid);
  if(matches.length>1){S.expCaptureAsk={sid,cid,pid,value,matches:matches.map(u=>u.id)};ctx.ui();return false;}
  const result=command(`${cap.label} · ${scope==='experience'?'use at Experience scope':'use in this Presentation'}`,e=>captureCapability(e,pid,sid,cid,value,cap.label));
  S.expCaptureAsk=null;ctx.ui();return result;
}
export function chooseCaptureUse(uid){
  const ask=S.expCaptureAsk;if(!ask||!ask.matches.includes(uid))return false;
  const cap=capability(ctx.sceneSource,ask.sid,ask.cid);
  const result=command('Update captured '+((cap?.label)||'capability'),e=>{const u=e.uses[uid];if(!u||!ask.matches.includes(uid))throw Error('Captured use changed');const d=e.definitions[u.definitionId];if(!d)throw Error('Captured definition missing');d.value=ask.value;return{id:uid,updated:true};});
  S.expCaptureAsk=null;ctx.ui();return result;
}
export function captureAnother(){
 const ask=S.expCaptureAsk;if(!ask)return false;
 const cap=capability(ctx.sceneSource,ask.sid,ask.cid);
 // Choosing "another" must never be refused by the ambiguity it is escaping: this is an explicit
 // create, distinct from the update-a-match path every other capture decision takes.
 const result=command('Capture another '+((cap?.label)||'use'),e=>captureNew(e,ask.pid,ask.sid,ask.cid,ask.value,cap?.label||ask.cid));
 S.expCaptureAsk=null;ctx.ui();return result;
}
export function cancelCaptureAsk(){if(!S.expCaptureAsk)return false;S.expCaptureAsk=null;ctx.ui();return true;}
export function reuseFraming(pid,vid){return command('Reuse Camera View',(e,c)=>reuseView(e,c,pid,vid));}
export function visitorCommand(action,id=null){
 const v=S.visitor;if(!v)return false;const e=v.source.experience,c=v.source.camera,scene=v.source.scene,r=v.runtime;
 if(action==='next')v.runtime=R.nextRuntime(e,c,r,scene);
 if(action==='back')v.runtime=R.previousRuntime(e,c,r,scene);
 if(action==='start')v.runtime=R.startGuide(e,c,r,scene);
 if(action==='auto') v.runtime=R.autoRuntime(e,r);
 if(action==='activate')v.runtime=R.activateRuntime(e,c,r,id,scene);
 if(action==='stop')v.runtime=R.stopActivityRuntime(e,r,id);
 if(action==='explore')v.runtime=R.exploreRuntime(r,nav.plainPose());
 if(action==='rejoin')v.runtime=R.resumeGuide(e,c,r,nav.plainPose());
 if(action==='look')v.runtime=R.lookRuntime(e,c,r,id,nav.plainPose());
 if(action==='next-view'||action==='previous-view')v.runtime=R.viewStepRuntime(e,c,r,action==='next-view'?1:-1);
 if(action==='captions')v.runtime.captions=!r.captions;
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
onCancel(reason=>{
 if(!['esc','lens','preview','reset','task-end','invoke','selection'].includes(reason))return;
 S.expAudition=null;
 // The ambiguity choice holds the same session work as the audition: dropping the audition must also
 // drop the stale choice, so a value the user walked away from can never be accepted later.
 S.expCaptureAsk=null;
},9,'Experience audition and capture proposal');
// Session transients every Experience reset or load clears: context, auditions, drafts and the
// review observations. It never touches selection, Camera or World truth — those are settled by the
// caller against the retained domains.
function clearExperienceTransients(){
 S.experienceContext={presentation:null,depth:'ordinary',stop:null,seam:null};
 S.derivedView=null;S.expAudition=null;S.expOfferDraft=null;S.expCaptureAsk=null;S.expAsk=null;S.expSourceAsk=null;S.expRouteAsk=null;
 S.expReview={auditions:0,previews:0};S.parkedByLens.experience=null;T.end();
}
// Remove only the context that no longer resolves: a World subject or a retained Camera View stays
// selected, an Experience identity does not survive its own removal.
function settleExperienceSelection(){
 if(S.sel&&!resolveExperience(S.sel)&&!thing(S.sel))A.select(null);
}
// Reset Experience replaces only Experience-authored content with a genuinely empty Experience. Scene,
// Camera (including unreferenced Views) and the aggregate Undo history are preserved, and the reset is
// one ordinary Undoable edit; Undo restores it without restoring a viewpoint.
export function resetExperience() {
 if(S.visitor)return false;
 cancelProposal('reset');T.park();nav.discardReturn();clearExperienceTransients();
 const result=command('Reset Experience',e=>{clearExperience(e);return true;});
 settleExperienceSelection();ctx.ui();return result;
}
// Load Example / Load Conformance explicitly replace Experience fixture content and add Camera fixture
// artifacts through Camera operations: fresh identities from the retained serials, no deletion of
// existing Camera truth, no history wipe. One aggregate command holds the whole load, so Undo leaves
// the independent domains exactly as they were before it. A labelled load is the one place that rebuilds
// deterministic Experience identities: the whole domain is replaced by the fixture, never merged with it.
function loadExperienceFixture(label,build,openMain=false){
 if(S.visitor)return false;
 cancelProposal('reset');T.park();nav.discardReturn();clearExperienceTransients();
 // A labelled rebuild reissues deterministic fixture identities (the Experience serial resets), so an
 // Experience-owned selection would silently point at whatever the fixture names the same way. It is
 // invalidated before the rebuild; World and Camera identities are not Experience-owned and survive,
 // and Load Example's explicit main Presentation is selected only after the build.
 if(resolveExperience(S.sel)?.owner==='Experience')A.select(null);
 const result=command(label,(e,c)=>{clearExperience(e);e.serial=0;return build(e,c);});
 // Which identity the author was on is settled against the retained World/Camera domains, never adopted
 // from the loader. Load Example lands on the example's main Presentation because it is loaded to be
 // edited; the conformance fixture is explicit content only and never selects or opens work.
 settleExperienceSelection();
 if(openMain&&result?.presentation&&ctx.experience.presentations[result.presentation]){S.experienceContext.presentation=result.presentation;A.select(result.presentation);}
 ctx.ui();return result;
}
export function loadExample(){return loadExperienceFixture('Load Example',buildExampleFixture,true);}
export function loadConformance(){return loadExperienceFixture('Load Conformance fixture',(e,c)=>conformanceFixture(e,c));}
function buildExampleFixture(e,c){
 const pid=addPresentation(e,{kind:'subjects',ids:['machine']},'Understand the drive');
 e.presentations[pid].meaning='The casing protects the rotor. See how power travels through the machine.';
 const base={target:[-10,1.2,1],az:1.2,el:.25,frameH:3,flat:0};
 const entry=addView(e,c,pid,base,'Machine overview','entry'),inside=addView(e,c,pid,{...base,frameH:1.8},'Inside','choice'),output=addView(e,c,pid,{...base,az:.9},'Output','choice');
 const n=addContribution(e,pid,{kind:'narration',name:'Explanation',text:e.presentations[pid].meaning,duration:18,markers:[{id:'inside',label:'Look inside',time:6},{id:'output',label:'Follow output',time:12}]},'narration');
 e.uses[n].primary=true;e.uses[n].primaryFor=pid;
 e.uses[inside].cue={useId:n,signal:'marker:inside'};e.uses[output].cue={useId:n,signal:'marker:output'};
 const open=addContribution(e,pid,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});e.uses[open].end={kind:'experience'};e.uses[open].retention={kind:'experience'};
 const run=addContribution(e,pid,{kind:'control',name:'Run rotor',subjectId:'machine',capabilityId:'rotor',value:true});e.uses[run].start={kind:'after',useId:open,signal:'complete',scope:'visit',presentationId:pid};e.uses[run].end={kind:'experience'};
 const piano=addContribution(e,null,{kind:'control',name:'Play Piano',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');e.uses[piano].availability=null;
 const light=addContribution(e,null,{kind:'control',name:'Light from Switch',subjectId:'light',capabilityId:'intensity',value:3},'interaction','switch');e.uses[light].availability=null;
 const compare=addPresentation(e,{kind:'subjects',ids:['machine','mesh']},'Compare materials');reuseView(e,c,compare,e.uses[entry].viewId);setRole(e,e.presentations[compare].uses[0],'entry');
 const a=addStop(e,pid),b=addStop(e,compare);e.stops[a].choices.push({id:fresh(e,'choice'),label:'Compare materials detour',targetId:b,kind:'detour'});
 return {presentation:pid};
}
// The quickstart instructions observe the real product outcomes rather than trusting a button press:
// Q1 subject + Presentation, Q2 explanation + accepted framing, Q3 operated and captured capability,
// Q4 a completed no-Guide Preview. Back/Next change only which instruction is shown.
export function quickstart(){
 const e=ctx.experience;
 const working=()=>e.presentations[S.experienceContext.presentation]||Object.values(e.presentations).find(p=>p.focus.kind==='subjects')||null;
 const primary=pid=>primaryExplanation(e,pid);
 const captured=()=>Object.values(e.uses).find(u=>!u.viewId&&u.presentationId&&u.kind!=='interaction'&&e.definitions[u.definitionId]?.kind==='control')||null;
 return [
  {title:'Subject and Presentation',instruction:'Select a real World subject in the Index, then Present this. One Presentation, no Guide.',
   done:()=>Object.values(e.presentations).some(p=>p.focus.kind==='subjects')&&e.guide.length===0,
   observed:()=>{const p=working();return p?`${p.name} · focus ${p.focus.kind==='subjects'?p.focus.ids.join(', '):p.focus.kind}`:'No Presentation yet';}},
  {title:'Explanation and framing',instruction:'Write the explanation in the Presentation Card, then Capture the suggested framing.',
   done:()=>{const p=working();if(!p)return false;const u=primary(p.id);return !!(u&&e.definitions[u.definitionId]?.text.trim())&&p.uses.some(id=>e.uses[id]?.viewId);},
   observed:()=>{const p=working();if(!p)return 'Waiting for a Presentation';const u=primary(p.id),text=u?e.definitions[u.definitionId]?.text.trim():'';return `${text?`“${text.slice(0,48)}${text.length>48?'…':''}”`:'No explanation'} · ${p.uses.filter(id=>e.uses[id]?.viewId).length} View(s)`;}},
  {title:'Operate and Use',instruction:'Select the subject again, operate a capability, then Use in this Presentation.',
   done:()=>!!captured()&&(S.expReview?.auditions||0)>0,
   observed:()=>{const u=captured();const d=u&&e.definitions[u.definitionId],tries=S.expReview?.auditions||0;return `${d?`${d.name||d.capabilityId} captured${u.presentationId?` in ${e.presentations[u.presentationId]?.name||'a Presentation'}`:''}`:'No captured capability yet'}${tries?` · ${tries} audition${tries===1?'':'s'}`:''}`;}},
  {title:'Preview without a Guide',instruction:'Preview the Presentation; the explanation, framing and capability run in a private visit. Exit returns exactly.',
   done:()=>!!S.expReview?.previews,
   observed:()=>S.expReview?.previews?`Preview completed ${S.expReview.previews}× and returned`:'No completed Preview yet'},
 ];
}
export function presenterStep(delta) {const steps=quickstart();S.experiencePresenter=Math.max(0,Math.min(steps.length-1,(S.experiencePresenter||0)+delta));ctx.ui();return S.experiencePresenter;}

export function stepVisitor(seconds){const v=S.visitor;if(!v)return false;v.runtime=R.tickRuntime(v.source.experience,v.source.camera,v.runtime,seconds,v.source.scene);if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);ctx.ui();return true;}

export const cameraSnapshot=()=>nav.resolvedCamera();

export function parkExperience() {
 const t=S.task,x=S.experienceContext;
 if(t?.kind.startsWith('experience-')) {
  const acceptedKeys=['useId','posture','grip','from','to','originUse','connection','station','invokeUse','stop','hints'];
  S.parkedByLens.experience={lens:'experience',identity:t.subject,name:resolveExperience(t.subject)?.item.name||t.subject||'Guide',kind:t.kind,context:structuredClone(x),target:structuredClone(t.target),params:Object.fromEntries(acceptedKeys.filter(k=>k in t.params).map(k=>[k,structuredClone(t.params[k])]))};
 }
 cancelProposal('lens');T.park();nav.discardReturn();S.derivedView=null;S.experienceContext={...x,depth:'ordinary',stop:null,seam:null};ctx.ui();return S.parkedByLens.experience;
}
export function experienceParkedContext() {
 const p=S.parkedByLens.experience;if(!p)return null;
 const result={ok:false,reason:'',identity:p.identity,name:p.name,wrongLens:S.lens!=='experience'};
 if(p.identity&&!resolveExperience(p.identity)&&!thing(p.identity)){result.reason='Original identity removed';return result;}
 if(S.sel!==p.identity){result.reason='Select the original identity explicitly';result.fix='select';return result;}
 const x=p.context;
 if(x.presentation&&!ctx.experience.presentations[x.presentation]){result.reason='Presentation removed';return result;}
 if(x.presentation&&!presentationValid(x.presentation)){result.reason='Focus binding unresolved';return result;}
 if(x.stop&&!ctx.experience.stops[x.stop]){result.reason='Stop removed';return result;}
 if(x.seam&&resolveNext(ctx.experience,x.seam.from).id!==x.seam.to){result.reason='Seam bookends changed';return result;}
 if(p.params.useId){const use=resolveUse(ctx.experience,ctx.cameraSource,p.params.useId);if(!use||use.view.id!==p.target?.id){result.reason='Framing removed or rebound';return result;}}
 if(p.params.connection&&(!ctx.cameraSource.connections[p.params.connection]||(x.seam&&!originCoverage(ctx.experience,ctx.cameraSource,x.seam.from,x.seam.to).some(row=>row.connectionId===p.params.connection&&!row.missing)))){result.reason='Camera connection removed or rebound';return result;}
 if(p.params.station){const route=ctx.cameraSource.connections[p.params.connection];if(!route||!nav.stations(route).some(s=>s.id===p.params.station)){result.reason='Camera station removed';return result;}}
 result.ok=true;return result;
}
export async function resumeExperience() {
 const p=S.parkedByLens.experience,v=experienceParkedContext();
 if(!p||!v?.ok||v.wrongLens){A.setStatus(v?.reason||'Experience work cannot resume here','refuse');return false;}
 cancelProposal('resume');await nav.neutralInvocation(()=>{S.experienceContext=structuredClone(p.context);
 T.begin({kind:p.kind,subject:p.identity,target:structuredClone(p.target),params:structuredClone(p.params)});
 if(['route','coordination','precision'].includes(p.context.depth))nav.beginReturn('Current reading');
 if(p.kind==='experience-hints')S.derivedView={presentation:p.target.id,...nav.deriveFraming(ctx.experience.presentations[p.target.id],p.params.hints)};
 if(p.kind==='experience-camera')S.task.params.posture=nav.readingFor(cameraSnapshot().views[p.target.id]);});
 // Surface reactivation is neutral even when the remembered posture was Through or Plan.
 S.parkedByLens.experience=null;ctx.ui();return true;
}
A.registerLensWork({park:parkExperience,resume:resumeExperience});

export function updateHold(id,seconds) {
 if(!Number.isFinite(seconds)||seconds<0){A.setStatus('Hold needs a finite nonnegative duration','refuse');return false;}
 const s=S.experienceContext.seam;if(!s)return false;
 return command('Edit Experience station hold',e=>{const beat=e.seams[`${s.from}>${s.to}`]?.beats.find(b=>b.id===id&&b.kind==='hold');if(!beat)throw Error('Hold removed');beat.seconds=seconds;});
}


