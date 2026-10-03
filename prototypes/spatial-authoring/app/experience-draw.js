import { S, ctx } from './state.js';
import { eye, connectionPath } from './camera-evaluation.js';
const escape=v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function drawExperience() {
 if(S.lens!=='experience'||S.visitor)return;
 const e=ctx.experience,c=ctx.cameraSource,x=S.experienceContext;
 const p=e.presentations[x.presentation];if(!p)return;
 for(const id of p.uses) {
  const u=e.uses[id],v=c.views[u?.viewId];if(!v)continue;
  const at=ctx.stage.project(eye(v.pose));if(at.behind)continue;
  ctx.ov.chip(`view-${id}`,at.x,at.y,`○ ${escape(v.name)} · ${escape(u.role)}`,'tape exp-view-pin',{'data-act':'pres-ref','data-id':id,tag:'button',pri:75});
 }
}
