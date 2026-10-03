import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole } from './experience-model.js';
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

