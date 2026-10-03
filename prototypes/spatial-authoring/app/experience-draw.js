import { originCoverage } from './experience-model.js';
import { S, ctx } from './state.js';
import { eye, connectionPath } from './camera-evaluation.js';
const escape=v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function drawExperience() {
 if(S.lens!=='experience'||S.visitor)return;
 const e=ctx.experience,c=ctx.cameraSource,x=S.experienceContext;
 if(x.seam && ['seam','route','coordination'].includes(x.depth)) {
  for(const row of originCoverage(e,c,x.seam.from,x.seam.to)) {
   const route=c.connections[row.connectionId];if(!route)continue;
   const path=connectionPath(route,c.views[route.from].pose,c.views[route.to].pose);
   ctx.ov.path(`route-${route.id}`,path.map(p=>ctx.stage.project(p.target)),'exp-route-path');
   route.anchors.forEach(a=>{const at=ctx.stage.project(a.position);if(!at.behind)ctx.ov.chip(`anchor-${a.id}`,at.x,at.y,'◆','tape exp-anchor',{'data-exp-anchor':a.id,'data-connection':route.id,tag:'button',pri:99});});
   // Generated endpoints and samples are visual data, never authored grips.
  }
  return;
 }
 if(x.depth==='overview') {
  e.guide.forEach((id,i)=>{const s=e.stops[id],u=e.presentations[s.presentationId]?.uses.map(uid=>e.uses[uid]).find(u=>u?.role==='entry'),v=c.views[u?.viewId];if(!v)return;const at=ctx.stage.project(v.pose.target);if(!at.behind)ctx.ov.chip(`stop-${id}`,at.x,at.y,String(i+1),'tape exp-stop-pin',{'data-act':'exp-stop','data-id':id,tag:'button',pri:90});});return;
 }
 if(x.depth==='precision') {
  const view=c.views[S.task?.target?.id];if(!view)return;
  const pose=S.cameraDraft?.pose||view.pose;
  const position=['x','y','z'].includes(S.task.params.grip)?pose.target:eye(pose),at=ctx.stage.project(position);
  if(!at.behind)ctx.ov.chip('camera-grip',at.x,at.y,`◇ ${S.task.params.grip}`,'tape exp-anchor',{'data-exp-camera':view.id,tag:'button',pri:99});
  return;
 }
 const p=e.presentations[x.presentation];if(!p)return;
 for(const id of p.uses) {
  const u=e.uses[id],v=c.views[u?.viewId];if(!v)continue;
  const at=ctx.stage.project(eye(v.pose));if(at.behind)continue;
  ctx.ov.chip(`view-${id}`,at.x,at.y,`○ ${escape(v.name)} · ${escape(u.role)}`,'tape exp-view-pin',{'data-act':'pres-ref','data-id':id,tag:'button',pri:75});
 }
}
