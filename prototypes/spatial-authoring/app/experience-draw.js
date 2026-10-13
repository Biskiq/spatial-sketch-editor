// Projections of resolved Camera output. Selection and editorial context stay canonical.
import { originCoverage,stopEntry,resolveUse,getSeam,gripLabels } from './experience-model.js';
import { S,ctx } from './state.js';
import { resolvedCamera,readingFor,framingInstrument,focusPoint } from './navigation.js';
import { eye,routeGeometry } from './camera-evaluation.js';
import { journeyClock, cueName } from './experience-coordination.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const project=p=>ctx.stage.project(p),ov=()=>ctx.ov;
function safe(at){const deck=document.querySelector('#experienceDeck'),bottom=deck?deck.getBoundingClientRect().top-document.querySelector('#stage').getBoundingClientRect().top:ctx.stage.h-16;return {x:Math.max(68,Math.min(ctx.stage.w-85,at.x)),y:Math.max(90,Math.min(bottom-35,at.y))};}
// §5.4: one pin group per resolved entry View. Stops that resolve to the same View share one chip, and
// each Stop keeps its own numbered button and its own `data-act="exp-stop"`, so distinct access is kept
// while a repeated Presentation stops fanning out leaders across the Stage.
function stopPinGroup(row){
 const {at,trueAt,stops}=row;
 if(Math.hypot(at.x-trueAt.x,at.y-trueAt.y)>5&&!trueAt.behind)ov().line('leader-'+row.id,trueAt,at,'exp-leader');
 ov().chip('stop-group-'+row.id,at.x,at.y,stops.map(s=>`<button class="exp-stop-pin ${S.sel===s.id?'selected':''}" data-act="exp-stop" data-id="${esc(s.id)}" aria-label="Stop ${s.index}">${s.index}</button>`).join('<span class="exp-stop-sep" aria-hidden="true">·</span>'),'tape exp-stop-group',{'data-exp-stop-group':esc(row.id),tag:'span',pri:98});
}
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
 // §5.2.6: a chip names the thing it is, with no role sub-line and no ○/◁ prefix. An endpoint is a filled
 // Camera chip — the edge's two ends are Camera infrastructure, not two more named Views.
 ov().chip('view-'+id,at.x,at.y,esc(view.name),'tape exp-view-pin '+(end?'endpoint ':'')+(S.sel===id?'selected':''),{'data-act':'pres-ref','data-id':id,'data-exp-view':view.id,'data-endpoint':end||'',tag:'button','aria-label':`${esc(view.name)}${end?` · ${end==='destination'?'arrives here':'departs here'}`:''}`,pri:97});
}
export function drawExperience(){
 if(S.lens!=='experience'||S.visitor)return;
 const e=ctx.experience,c=resolvedCamera(),x=S.experienceContext;
 if(x.seam&&['seam','route','coordination'].includes(x.depth)){drawSeam(e,c,x);return;}
 if(x.depth==='overview'){
  // §5.4: while an edge is the Card's identity the Stage keeps the edge reading — its origin and
  // destination entry Views only, with no pins — so Cut/Travel can never be read as a property of a Stop.
  if(x.seam){drawSeam(e,c,{...x,depth:'seam'});return;}
  const groups=new Map();
  e.guide.forEach((id,i)=>{
   const entry=stopEntry(e,id),view=resolveUse(e,c,entry.id)?.view;
   if(!view)return;
   if(!groups.has(entry.id))groups.set(entry.id,{id:entry.id,view,position:view.pose.target,stops:[]});
   groups.get(entry.id).stops.push({id,index:i+1});
  });
  layout([...groups.values()]).forEach(stopPinGroup);return;
 }
 if(x.depth==='precision'){drawPrecision(c);return;}
 const p=e.presentations[x.presentation];if(!p)return;
 // §5.3: a Presentation's constellation and its ◇ focus mark are drawn only while the canonical selection
 // is that Presentation, one of its View uses, or — in ordinary depth — one of its Stops. With a Scene
 // subject selected the Stage shows World geometry and that subject's own selection, so no Presentation
 // looks selected (QA 5).
 const ownsSelection=S.sel===p.id||e.uses[S.sel]?.presentationId===p.id||(x.depth==='ordinary'&&e.stops[S.sel]?.presentationId===p.id);
 if(!ownsSelection)return;
 drawViews(e,c,p,x);
 if(S.derivedView?.presentation===p.id){const at=safe(project(eye(S.derivedView.pose)));ov().chip('derived-view',at.x,at.y,'◌ Recommended framing · Capture to keep','tape exp-derived',{'data-derived-view':true,tag:'span',pri:96});}
}
// ----- UX2: Views on the Stage -------------------------------------------------
// Views are unordered, and the Stage says so. Each View is a compact named marker placed
// *semi-spatially around the Presentation's focus*: its bearing and side are preserved in the current
// Stage orientation, its distance is compressed onto a short ring, and no number, sequence or inter-View
// line appears — so nothing here claims a metric position or an order. The Default carries a restrained
// ★ and its name. A marker is still a real hit target and selects its own View use, the same canonical
// identity the Views list selects.
//
// The aim is the *marker's own direction*: a View-direction glyph drawn with its marker, oriented by
// where that View looks in the same published basis its bearing is read in. It is not the View's
// standpoint — projecting the eye and joining it here with a leader drew a screen length between two
// different readings (a metric location and a compressed schematic one), which is exactly the metric
// claim the constellation may not make, and at three Views the leaders and stacked glyphs were the
// clutter they read as. Aim stays shown; position stays unclaimed.
const VIEW_RING_MIN=92,VIEW_RING_MAX=230,VIEW_MIN_ARC=104,VIEW_MIN_DY=27;
// The screen bearing of a world direction, in the Camera's own published basis: the semi-spatial
// placement asks only where a View stands *around the focus*, never how far away it is, so it reads the
// orientation the Stage is drawn in rather than a projected position (which is undefined for a View the
// author is already standing in).
function screenBearing(dir,az,el){
 const sx=dir[0]*Math.cos(az)-dir[2]*Math.sin(az);
 const sy=-(-dir[0]*Math.sin(el)*Math.sin(az)+dir[1]*Math.cos(el)-dir[2]*Math.sin(el)*Math.cos(az));
 return Math.abs(sx)<1e-6&&Math.abs(sy)<1e-6?0:Math.atan2(sy,sx);
}
function ringPosition(item,at){return {x:at.x+Math.cos(item.angle)*item.radius,y:at.y+Math.sin(item.angle)*item.radius};}
// Deterministic crowding: markers keep their own bearing and are pushed apart along the ring by equal
// steps until every pair is separated, so the same Views always stack the same way. Markers that the
// stage edge then pulls together are separated vertically, and each remains its own real hit target.
function placeViews(items,at,bounds){
 const n=items.length;if(!n)return [];
 const placed=items.map(item=>{const scale=Math.max(0,Math.min(1,item.len/420));const radius=Math.min(VIEW_RING_MAX,Math.max(VIEW_RING_MIN,VIEW_RING_MIN+Math.max(0,n-1)*22+scale*26));return {...item,angle:item.bearing,radius};});
 for(let pass=0;pass<30;pass++){
  let moved=false;
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
   const a=ringPosition(placed[i],at),b=ringPosition(placed[j],at),d=Math.hypot(a.x-b.x,a.y-b.y);
   if(d>=VIEW_MIN_ARC||d===0)continue;
   const push=(VIEW_MIN_ARC-d)/Math.max(1,placed[i].radius)+0.02;
   placed[i].angle-=push/2;placed[j].angle+=push/2;moved=true;
  }
  if(!moved)break;
 }
 const out=placed.map(item=>({item,at:safe(ringPosition(item,at))}));
 for(let pass=0;pass<40;pass++){
  let moved=false;
  for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
   const a=out[i].at,b=out[j].at;
   if(Math.abs(a.x-b.x)>=VIEW_MIN_ARC||Math.abs(a.y-b.y)>=VIEW_MIN_DY)continue;
   const step=(VIEW_MIN_DY-Math.abs(a.y-b.y))/2+1;
   const down=b.y>=a.y?1:-1;
   b.y=Math.max(bounds.top,Math.min(bounds.bottom,b.y+down*step));
   a.y=Math.max(bounds.top,Math.min(bounds.bottom,a.y-down*step));
   moved=true;
  }
  if(!moved)break;
 }
 return out;
}
function stageBounds(){
 const stageEl=document.querySelector('#stage'),deck=document.querySelector('#experienceDeck'),top=90;
 const stageRect=stageEl?.getBoundingClientRect();
 const bottom=deck&&stageRect?deck.getBoundingClientRect().top-stageRect.top-35:ctx.stage.h-35;
 return {top,bottom:Math.max(top+40,bottom)};
}
function drawViews(e,c,p,x){
 const bounds=stageBounds();
 // The focus is read twice on purpose: its *world* point is what each View stands around, and its
 // projected point is only where the ring is drawn. The bearing is a comparison between two world
 // positions, so it stays defined when the focus itself is hidden or off-stage.
 const focusWorld=focusPoint(p)||[-2,1,0];
 const focusAt=safe(project(focusWorld));
 const {az,el}=ctx.stage.cam;
 const bearingTo=pose=>{const e2=eye(pose),dir=[e2[0]-focusWorld[0],e2[1]-focusWorld[1],e2[2]-focusWorld[2]];return {bearing:screenBearing(dir,az,el),len:Math.hypot(dir[0],dir[1],dir[2])||1};};
 const rows=p.uses.flatMap(id=>{const use=e.uses[id],view=c.views[use?.viewId];if(!view)return[];return [{id,use,view,...bearingTo(view.pose)}];});
 if(x.stop){const uid=stopEntry(e,x.stop).id;if(!rows.some(r=>r.id===uid)){const view=c.views[e.uses[uid]?.viewId];if(view)rows.push({id:uid,use:{id:uid,role:'this Stop entry',name:e.uses[uid]?.name},view,...bearingTo(view.pose)});}}
 placeViews(rows,focusAt,bounds).forEach(({item,at})=>{
  const def=item.use.role==='entry';
  // Which way this View looks, read as a screen bearing in the Camera's own published basis — the same
  // basis its bearing around the focus is placed in, so the glyph and the marker agree about 'that way'.
  // Every View has an aim, including the one the author is standing in, so no viewpoint needs a fallback.
  const observer=eye(item.view.pose),aim=[item.view.pose.target[0]-observer[0],item.view.pose.target[1]-observer[1],item.view.pose.target[2]-observer[2]];
  const aimAngle=screenBearing(aim,az,el),apex={x:at.x,y:at.y+28};
  const a={x:apex.x+Math.cos(aimAngle-.5)*20,y:apex.y+Math.sin(aimAngle-.5)*20},b={x:apex.x+Math.cos(aimAngle+.5)*20,y:apex.y+Math.sin(aimAngle+.5)*20};
  // Just under its own marker, and its centre stays clear of the identity plate for every aim direction,
  // so the direction is a rendered fact beside the name rather than part of the name.
  ov().path('view-glyph-'+item.id,[apex,a,b],'exp-view-glyph',true,{'data-view-direction':item.view.id});
  ov().chip('view-'+item.id,at.x,at.y,`${def?'★ ':''}${esc(item.use.name||item.view.name)}`,'tape exp-view-pin '+(S.sel===item.id?'selected':''),{'data-act':'pres-ref','data-id':item.id,'data-exp-view':item.view.id,'data-view-default':def?'true':'',tag:'button','aria-label':`${item.use.name||item.view.name}${def?' · Default View':''}`,pri:97});
 });
 // The focus mark is the point the markers are placed around: a place, not a Camera target.
 ov().chip('view-focus',focusAt.x,focusAt.y,'◇ focus','tape exp-focus-mark',{'data-exp-focus':true,tag:'span',pri:96});
}
function drawSeam(e,c,x){
 const seam=getSeam(e,x.seam.from,x.seam.to),rows=originCoverage(e,c,x.seam.from,x.seam.to),items=[];
 for(const row of rows){const view=c.views[row.viewId];if(view)items.push({id:row.useId,view,position:eye(view.pose),row});}
 const destination=rows[0]?.targetId,v=c.views[destination],uid=stopEntry(e,x.seam.to).id;
 if(v)items.push({id:uid,view:v,position:eye(v.pose),end:'destination'});
 // A same-View origin is Camera's own zero-distance evaluation, never a missing edge: only an origin
 // that genuinely needs a connection (or needs repair) is drawn as a Travel gap.
 layout(items).forEach(item=>{marker(item,{end:item.end||'origin'});if(item.row&&!item.row.connectionId&&item.row.viewId!==item.row.targetId&&seam.mode==='travel')ov().chip('gap-'+item.id,item.at.x,item.at.y+26,'! gap · no Camera connection','tape exp-gap',{'data-exp-gap':item.id,tag:'span',pri:99});});
 // §5.4: the edge *reading* keeps its own drawing — the two resolved ends, plus the Travel routes and their
 // gaps while the edge is Travel — with no Stop pins. §5.5/§5.6: the Path and Journey postures draw the
 // Camera half whenever they are open, chosen by the **posture** rather than by the visitor's current
 // transition, so a Cut edge still has a route to read, edit and coordinate: Camera authoring is never
 // suppressed by a transition the author has not chosen Travel for yet.
 const posture=x.depth==='coordination'?'coordination':x.depth==='route'?'path':null;
 if(!posture&&seam.mode!=='travel')return;
 const ids=[...new Set(rows.map(r=>r.connectionId).filter(Boolean))];
 for(const id of ids){
  const route=c.connections[id];if(S.expDrag?.connection===id){const a=route.anchors.find(a=>a.id===S.expDrag.anchor);if(a)a.position=[...S.expDrag.position];}const geometry=routeGeometry(c,id);if(!geometry)continue;
  const selected=id===S.task?.params.connection;
  // §5.5/§5.6: the posture's own route is the drawn path — 2 px in the Path, a quiet 1.5 px at 60 % in the
  // Journey. Every other origin's route stays context: 1 px at 35 %, no points and not hit-eligible. The
  // derived samples are no longer dotted: the grammar says an evaluated sample is not a marked thing.
  const lane=posture||'path';
  const classes=['exp-route-path',selected?(lane==='coordination'?'journey':''):'context'].filter(Boolean).join(' ');
  ov().path('route-'+id,geometry.samples.map(s=>project(s.observer)),classes,false,{'data-exp-route':id});
  // §5.5: an authored point is a 14 px Camera ring, never a ◆ chip. It is the handle the author places in
  // the Path; in the Journey a point is a station a Cue sits on, so no handle is drawn and a press on the
  // drawing lands on the drawing (QA 2).
  if(lane==='path')for(const a of route.anchors){
   const at=project(S.expDrag?.anchor===a.id?S.expDrag.position:a.position);if(at.behind)continue;
   const number=route.anchors.indexOf(a)+1,current=x.point?.anchorId===a.id;
   ov().chip('anchor-'+a.id,at.x,at.y,'','tape exp-anchor '+(current?'selected':''),{'data-exp-anchor':a.id,'data-connection':id,tag:'button',pri:1000,'aria-label':`Path point ${number}`});
  }
  // §5.6: a Cue chip appears only at stations that really hold a Cue, reads `◆ <Cue name>` with no seconds
  // and no hold text, and is the same Cue identity the Deck marker and the Card select.
  if(lane==='coordination'&&selected){
   const clock=journeyClock(c,seam,id);
   for(const cue of clock?.cues||[]){
    const station=geometry.stations.find(s=>s.id===cue.stationId);if(!station)continue;
    const at=project(station.observer),active=S.task?.params?.station===cue.stationId,name=cueName(e,route,cue);
    ov().chip(`station-${id}-${cue.stationId}`,at.x,at.y-22,`◆ ${esc(name)}`,'tape exp-station '+(active?'active':''),{'data-act':'exp-cue-select','data-id':cue.stationId,'data-exp-station-label':cue.stationId,tag:'button',pri:1000,'aria-label':`Cue ${esc(name)}`});
   }
  }
  // §5.6: the rehearsal rig is the View-marker's own frustum glyph plus a 10 px Camera dot at the pose the
  // clock evaluates. It is a reading on the Stage, not a Camera move: the author's standpoint is untouched,
  // no invocation runs and no source is written.
  if(x.depth==='coordination'&&S.rehearse&&selected){
   const clock=journeyClock(c,seam,S.rehearse.connectionId);
   if(clock&&clock.connectionId===id){
    const pose=clock.poseAt(S.rehearse.t),observer=eye(pose),rig=project(observer),target=project(pose.target);
    if(!rig.behind){
     const angle=Math.atan2(target.y-rig.y,target.x-rig.x),head={x:rig.x,y:rig.y-26};
     ov().path('journey-rig-glyph',[head,{x:head.x+Math.cos(angle-.5)*20,y:head.y+Math.sin(angle-.5)*20},{x:head.x+Math.cos(angle+.5)*20,y:head.y+Math.sin(angle+.5)*20}],'exp-view-glyph',true,{'data-exp-rig-glyph':''});
     ov().chip('journey-rig',rig.x,rig.y,'',`tape exp-rig ${S.rehearse.playing?'playing':''}`,{'data-exp-rig':'','data-exp-rig-playing':S.rehearse.playing?'true':'false',tag:'span',pri:1001,'aria-label':'Rehearsal playhead'});
    }
   }
  }
 }
}
// A grip the author cannot hit is not a supported grip, and a grip on top of another takes the tap meant
// for it. The world-anchored grips (target X/Y/Z) must stay on the thing they move, so the grips whose
// gesture reads pointer movement instead of the chip's own position take the nearest clear seat.
function seats(anchors){
 const fixed=['x','y','z'].filter(k=>anchors[k]).map(k=>anchors[k]);
 const moves=['frameH','az','el'].filter(k=>anchors[k]);
 const offsets=[[0,0],[0,-24],[-26,0],[26,0],[0,-48],[-26,-24],[26,-24],[0,-72],[-52,0],[52,0],[0,24]];
 for(const key of moves){
  const home=anchors[key];let seat=home;
  for(const o of offsets){const at={x:home.x+o[0],y:home.y+o[1]};
   if(at.x<70||at.y<92)continue;
   const rest=[...fixed,...moves.filter(k=>k!==key).map(k=>anchors[k])];
   if(rest.some(q=>Math.hypot(q.x-at.x,q.y-at.y)<25))continue;
   seat=at;break;
  }
  anchors[key]=seat;fixed.push(seat);
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
 seats(anchors);
 for(const [key,at] of Object.entries(anchors)){const active=key===grip;ov().chip('precise-grip-'+key,at.x,at.y,active?'●':'○','tape exp-camera-grip '+(active?'active':''),{'data-grip':key,...(active?{'data-exp-camera':v.id}:{'data-act':'exp-grip'}),tag:'button',pri:1000,'aria-label':gripLabels[key]});}
 const at=anchors[grip],value=['x','y','z'].includes(grip)?p.target[['x','y','z'].indexOf(grip)]:p[grip];
 if(at)ov().chip('camera-active-tape',Math.max(75,Math.min(ctx.stage.w-110,at.x-65)),at.y+30,`<label class="numeric-tape">${gripLabels[grip]} <input type="number" step=".1" data-exp-precision="${grip}" value="${Number(value.toFixed(3))}" aria-label="${gripLabels[grip]}"></label>`,'exp-active-tape',{'data-active-tape':grip,tag:'div',pri:1000});
}
