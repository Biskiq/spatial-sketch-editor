// Projections of resolved Camera output. Selection and editorial context stay canonical.
import { originCoverage,stopEntry,resolveUse,getSeam } from './experience-model.js';
import { S,ctx } from './state.js';
import { resolvedCamera,readingFor,framingInstrument } from './navigation.js';
import { eye,routeGeometry } from './camera-evaluation.js';
import { gripLabels } from './experience-ui.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const project=p=>ctx.stage.project(p),ov=()=>ctx.ov;
function safe(at){const deck=document.querySelector('#experienceDeck'),bottom=deck?deck.getBoundingClientRect().top-document.querySelector('#stage').getBoundingClientRect().top:ctx.stage.h-16;return {x:Math.max(68,Math.min(ctx.stage.w-85,at.x)),y:Math.max(90,Math.min(bottom-35,at.y))};}
// Offset labels/pins preserve their true projected position through leaders. Every hit is unique.
function layout(rows){
 const placed=[],bottom=safe({x:0,y:1e6}).y;
 return rows.map(row=>{
  const trueAt=project(row.position),pin=row.number!=null,at=safe(pin?trueAt:{x:trueAt.x,y:trueAt.y+40}),lower=bottom-(pin?0:25),spacing=pin?38:64;
  at.y=Math.min(lower,at.y);let n=0;
  while(placed.some(p=>Math.abs(p.x-at.x)<115&&Math.abs(p.y-at.y)<spacing-2)&&n++<30){at.y+=spacing;if(at.y>lower){at.y=110;at.x=Math.min(ctx.stage.w-85,at.x+125);}}
  placed.push(at);return {...row,at,trueAt};
 });
}
function marker(row,{number=null,end=null}={}){
 const {at,trueAt,id,view,use}=row;
 if(Math.hypot(at.x-trueAt.x,at.y-trueAt.y)>5&&!trueAt.behind)ov().line('leader-'+id,trueAt,at,'exp-leader');
 if(number!==null){ov().chip('stop-'+id,at.x,at.y,String(number),'tape exp-stop-pin '+(S.sel===id?'selected':''),{'data-act':'exp-stop','data-id':id,'aria-label':`Stop ${number}`,tag:'button',pri:98});return;}
 const target=project(view.pose.target),angle=Math.atan2(target.y-trueAt.y,target.x-trueAt.x),a={x:trueAt.x+Math.cos(angle-.5)*30,y:trueAt.y+Math.sin(angle-.5)*30},b={x:trueAt.x+Math.cos(angle+.5)*30,y:trueAt.y+Math.sin(angle+.5)*30};
 if(!trueAt.behind){ov().path('view-glyph-'+id,[trueAt,a,b],'exp-view-glyph',true,{'data-view-direction':view.id});ov().path('view-origin-'+id,[{x:trueAt.x-3,y:trueAt.y-3},{x:trueAt.x+3,y:trueAt.y-3},{x:trueAt.x+3,y:trueAt.y+3},{x:trueAt.x-3,y:trueAt.y+3}],'exp-view-origin',true);if(!end)ov().line('focus-'+id,trueAt,target,'exp-focus-ray');}
 ov().chip('view-'+id,at.x,at.y,`${end==='destination'?'◉':'◁'} ${esc(view.name)} <small>${esc(end||use?.role||'Camera')}</small>`,'tape exp-view-pin '+(S.sel===id?'selected':''),{'data-act':'pres-ref','data-id':id,'data-exp-view':view.id,'data-endpoint':end||'',tag:'button',pri:97});
}
export function drawExperience(){
 if(S.lens!=='experience'||S.visitor)return;
 const e=ctx.experience,c=resolvedCamera(),x=S.experienceContext;
 if(x.seam&&['seam','route','coordination'].includes(x.depth)){drawSeam(e,c,x);return;}
 if(x.depth==='overview'){
  layout(e.guide.flatMap((id,i)=>{const v=resolveUse(e,c,stopEntry(e,id).id)?.view;return v?[{id,view:v,position:v.pose.target,number:i+1}]:[];})).forEach(row=>marker(row,{number:row.number}));return;
 }
 if(x.depth==='precision'){drawPrecision(c);return;}
 const p=e.presentations[x.presentation];if(!p)return;
 const rows=p.uses.flatMap(id=>{const use=e.uses[id],view=c.views[use?.viewId];return view?[{id,use,view,position:eye(view.pose)}]:[];});
 if(x.stop){const uid=stopEntry(e,x.stop).id,view=c.views[e.uses[uid]?.viewId];if(view&&!rows.some(r=>r.id===uid))rows.push({id:uid,use:{role:'this Stop entry'},view,position:eye(view.pose)});}
 layout(rows).forEach(row=>marker(row));
 if(S.derivedView?.presentation===p.id){const at=safe(project(eye(S.derivedView.pose)));ov().chip('derived-view',at.x,at.y,'◌ Auto · derived, Capture to keep','tape exp-derived',{'data-derived-view':true,tag:'span',pri:96});}
}
function drawSeam(e,c,x){
 const seam=getSeam(e,x.seam.from,x.seam.to),rows=originCoverage(e,c,x.seam.from,x.seam.to),items=[];
 for(const row of rows){const view=c.views[row.viewId];if(view)items.push({id:row.useId,view,position:eye(view.pose),row});}
 const destination=rows[0]?.targetId,v=c.views[destination],uid=stopEntry(e,x.seam.to).id;
 if(v)items.push({id:uid,view:v,position:eye(v.pose),end:'destination'});
 layout(items).forEach(item=>{marker(item,{end:item.end||'origin'});if(item.row&&!item.row.connectionId&&seam.mode==='travel')ov().chip('gap-'+item.id,item.at.x,item.at.y+26,'! gap · no Camera connection','tape exp-gap',{'data-exp-gap':item.id,tag:'span',pri:99});});
 if(seam.mode!=='travel')return;
 const ids=[...new Set(rows.map(r=>r.connectionId).filter(Boolean))];
 for(const id of ids){
  const route=c.connections[id];if(S.expDrag?.connection===id){const a=route.anchors.find(a=>a.id===S.expDrag.anchor);if(a)a.position=[...S.expDrag.position];}const geometry=routeGeometry(c,id);if(!geometry)continue;
  const selected=id===S.task?.params.connection;
  ov().path('route-'+id,geometry.samples.map(s=>project(s.observer)),'exp-route-path '+(selected?'working':''),false,{'data-exp-route':id});
  for(const a of route.anchors){const at=project(S.expDrag?.anchor===a.id?S.expDrag.position:a.position);if(!at.behind)ov().chip('anchor-'+a.id,at.x,at.y,'◆','tape exp-anchor '+(selected?'working':''),{'data-exp-anchor':a.id,'data-connection':id,tag:'button',pri:1000,'aria-label':`${a.name} · Camera observer anchor`});}
  geometry.samples.filter((s,i)=>i%5===0&&i>0&&i<40).forEach((s,i)=>{const at=project(s.observer);ov().text(`sample-${id}-${i}`,at.x,at.y,'·','exp-sample');});
  if((x.depth==='coordination'||seam.beats.length)&&selected){
   for(const station of geometry.stations){const at=project(station.observer),beats=seam.beats.filter(b=>b.connectionId===id&&b.stationId===station.id),active=S.task.params.station===station.id;
    ov().chip(`station-${id}-${station.id}`,at.x,at.y-22,`${station.id==='departure'||station.id==='arrival'?'○':'◇'} ${esc(station.label)}${beats.length?' · '+beats.map(b=>b.kind==='hold'?b.seconds+'s hold':'beat').join(', '):''}`,'tape exp-station '+(active?'active':''),{'data-act':'exp-station-focus','data-id':station.id,'data-exp-station-label':station.id,tag:'button',pri:1000});
   }
  }
 }
}
function drawPrecision(c){
 const t=S.task,v=c.views[t?.target?.id];if(!v)return;
 const p=S.cameraDraft?.pose||v.pose,reading=readingFor({...v,pose:p}),grip=t.params.grip;
 let anchors={};
 if(reading==='through'){
  const w=ctx.stage.w,h=ctx.stage.h,l=45,r=w-45,top=100,b=h-90,cx=w/2,cy=(top+b)/2;
  ov().path('frame-gate',[{x:l,y:top},{x:r,y:top},{x:r,y:b},{x:l,y:b}],'exp-frame-gate',true,{'data-frame-gate':true});
  const target=project(p.target),observer=eye(p),level=project([observer[0]-Math.sin(p.az)*1000,observer[1],observer[2]-Math.cos(p.az)*1000]);
  if(level.y>top&&level.y<b)ov().line('horizon',{x:l,y:level.y},{x:r,y:level.y},'exp-horizon');
  ov().path('target-cross',[{x:target.x-12,y:target.y},{x:target.x+12,y:target.y}],'exp-target');ov().line('target-cross-y',{x:target.x,y:target.y-12},{x:target.x,y:target.y+12},'exp-target');
  anchors={frameH:{x:r,y:cy},az:{x:cx,y:b},el:{x:cx,y:top},x:{x:cx-65,y:cy},y:{x:cx,y:cy-65},z:{x:cx+65,y:cy}};
 }else{
  const rig=framingInstrument(p),observer=project(rig.observer),target=project(p.target),corners=rig.corners.map(project);
  ov().path('frustum',corners,'exp-frustum',true,{'data-camera-frustum':v.id});corners.forEach((point,i)=>ov().line('frustum-ray-'+i,observer,point,'exp-frustum-ray'));
  ov().line('observer-aim',observer,target,'exp-focus-ray');
  ov().chip('observer',observer.x,observer.y+28,'◉ Observer','tape exp-view-pin',{'data-exp-observer':v.id,tag:'span',pri:1000});
  anchors={frameH:corners[1],az:{x:observer.x+40,y:observer.y},el:{x:observer.x,y:observer.y-40},x:{x:target.x+45,y:target.y},y:{x:target.x,y:target.y-45},z:{x:target.x-45,y:target.y}};
 }
 for(const [key,at] of Object.entries(anchors)){const active=key===grip;ov().chip('precise-grip-'+key,at.x,at.y,active?'●':'○','tape exp-camera-grip '+(active?'active':''),{'data-grip':key,...(active?{'data-exp-camera':v.id}:{'data-act':'exp-grip'}),tag:'button',pri:1000,'aria-label':gripLabels[key]});}
 const at=anchors[grip],value=['x','y','z'].includes(grip)?p.target[['x','y','z'].indexOf(grip)]:p[grip];
 if(at)ov().chip('camera-active-tape',Math.max(75,Math.min(ctx.stage.w-110,at.x-65)),at.y+30,`<label class="numeric-tape">${gripLabels[grip]} <input type="number" step=".1" data-exp-precision="${grip}" value="${Number(value.toFixed(3))}" aria-label="${gripLabels[grip]}"></label>`,'exp-active-tape',{'data-active-tape':grip,tag:'div',pri:1000});
}
