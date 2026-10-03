import { S, ctx } from './state.js';
import { eye, connectionPath } from './camera-evaluation.js';
const escape=v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function drawExperience() {
 if(S.lens!=='experience'||S.visitor)return;
 const e=ctx.experience,c=ctx.cameraSource,x=S.experienceContext;
 if(x.depth==='overview') {
  e.guide.forEach((id,i)=>{const s=e.stops[id],u=e.presentations[s.presentationId]?.uses.map(uid=>e.uses[uid]).find(u=>u?.role==='entry'),v=c.views[u?.viewId];if(!v)return;const at=ctx.stage.project(v.pose.target);if(!at.behind)ctx.ov.chip(`stop-${id}`,at.x,at.y,String(i+1),'tape exp-stop-pin',{'data-act':'exp-stop','data-id':id,tag:'button',pri:90});});return;
 }
 const p=e.presentations[x.presentation];if(!p)return;
 for(const id of p.uses) {
  const u=e.uses[id],v=c.views[u?.viewId];if(!v)continue;
  const at=ctx.stage.project(eye(v.pose));if(at.behind)continue;
  ctx.ov.chip(`view-${id}`,at.x,at.y,`○ ${escape(v.name)} · ${escape(u.role)}`,'tape exp-view-pin',{'data-act':'pres-ref','data-id':id,tag:'button',pri:75});
 }
}
