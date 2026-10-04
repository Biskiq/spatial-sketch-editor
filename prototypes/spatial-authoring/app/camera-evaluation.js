// Pure Camera kernel beneath navigation.js. Both estimates and visitor execution consume it.
export const RATES = { cut: 0, slow: 4, auto: 7, fast: 13 };
export const distance = (a,b) => Math.hypot(...a.map((n,i)=>n-b[i]));
export const fovFor=flat=>Math.exp(Math.log(40)+(Math.log(.9)-Math.log(40))*flat);
export function eye(p) {
 const d=p.frameH/(2*Math.tan(fovFor(p.flat||0)*Math.PI/360));
 return p.target.map((n,i)=>n+ d*[Math.cos(p.el)*Math.sin(p.az),Math.sin(p.el),Math.cos(p.el)*Math.cos(p.az)][i]);
}
export function interpolate(a,b,t) {
 const mix=(x,y)=>x+(y-x)*t;
 return { target:a.target.map((n,i)=>mix(n,b.target[i])), az:mix(a.az,b.az), el:mix(a.el,b.el), frameH:mix(a.frameH,b.frameH), flat:mix(a.flat??0,b.flat??0), mirror:t===1?!!b.mirror:!!a.mirror };
}
export function connectionPath(c, from, to) {
 // Endpoints are generated from View definitions; authored anchors are interior only.
 return [from,...c.anchors.map((a,i)=>{const p=interpolate(from,to,(i+1)/(c.anchors.length+1)),offset=eye(p).map((n,j)=>n-p.target[j]);return {...p,target:a.position.map((n,j)=>n-offset[j])};}),to];
}
export const pathLength = path => path.slice(1).reduce((n,p,i)=>n+Math.max(distance(eye(path[i]),eye(p)),distance(path[i].target,p.target)),0);
export const pathSeconds = (path,speed='auto') => RATES[speed]===0 ? 0 : pathLength(path)/RATES[speed];
export function evaluatePath(path, progress) {
 if(path.length===1) return structuredClone(path[0]);
 const lengths=path.slice(1).map((p,i)=>Math.max(distance(eye(path[i]),eye(p)),distance(path[i].target,p.target)));
 let remaining=lengths.reduce((a,b)=>a+b,0)*Math.min(1,Math.max(0,progress));
 for(let i=0;i<lengths.length;i++) { if(remaining<=lengths[i] || i===lengths.length-1) return interpolate(path[i],path[i+1],lengths[i]?remaining/lengths[i]:1); remaining-=lengths[i]; }
}
export function findConnection(camera, fromId, toId) {
 return Object.values(camera.connections).find(c=>c.from===fromId&&c.to===toId) || null;
}
export function stations(c) {
 return [{id:'departure',label:'Departure'},...c.anchors.map(a=>({id:a.id,label:a.name||'Anchor'})),...c.markers.map(m=>({id:m.id,label:m.name})),{id:'arrival',label:'Arrival'}];
}
export function stationProgress(c,path,id) {
 if(id==='departure') return 0; if(id==='arrival') return 1;
 const index=c.anchors.findIndex(a=>a.id===id);
 if(index>=0) { const total=pathLength(path); return total?pathLength(path.slice(0,index+2))/total:0; }
 return c.markers.find(m=>m.id===id)?.progress ?? null;
}

// Camera anchor positions are OBSERVER positions in project space. Targets are derived from
// interpolated aim/framing at that station; every renderer, handle and executor uses this path.
export function routeGeometry(camera,id) {
 const c=camera.connections[id],a=camera.views[c?.from],b=camera.views[c?.to];
 if(!c||!a||!b||a.unresolved||b.unresolved)return null;
 const path=connectionPath(c,a.pose,b.pose);
 return {id,path,seconds:pathSeconds(path,c.speed),observer:path.map(eye),targets:path.map(p=>p.target),
 samples:Array.from({length:41},(_,i)=>{const p=evaluatePath(path,i/40);return {progress:i/40,pose:p,observer:eye(p)};}),
 stations:stations(c).map(s=>{const progress=stationProgress(c,path,s.id),pose=evaluatePath(path,progress);return {...s,progress,pose,observer:eye(pose)};})};
}
export function resolveCamera(c,positions) {
 const derived=structuredClone(c);
 for(const v of Object.values(derived.views)) {
  if(v.focus?.kind!=='subjects')continue;
  const current=positions[v.focus.ids[0]];if(!current){v.unresolved=true;continue;}
  if(v.anchor==='relative')v.pose.target=current.map((n,i)=>n+(v.focusOffset?.[i]||0));
  else if(v.focusAt&&current.some((n,i)=>Math.abs(n-v.focusAt[i])>1e-6))v.review='World changed — review fixed framing';
 }
 return derived;
}
// Retained World motion profile: shortest azimuth, logarithmic frame, separate flatness clock.
export function worldInterpolate(a,b,t,tFlat=t) {
 let daz=b.az-a.az;while(daz>Math.PI)daz-=Math.PI*2;while(daz< -Math.PI)daz+=Math.PI*2;
 return {...interpolate(a,b,t),az:a.az+daz*t,frameH:Math.exp(Math.log(a.frameH)+(Math.log(b.frameH)-Math.log(a.frameH))*t),flat:(a.flat||0)+((b.flat||0)-(a.flat||0))*tFlat};
}
export function realization(p,aspect) {
 const fov=fovFor(p.flat),dist=p.frameH/(2*Math.tan(fov*Math.PI/360));
 return {eye:eye(p),target:p.target,up:p.el>1.55?[-Math.sin(p.az),0,-Math.cos(p.az)]:p.el< -1.55?[Math.sin(p.az),0,Math.cos(p.az)]:[0,1,0],fov,aspect,dist,near:Math.max(.1,dist-140),far:dist+260,mirror:!!p.mirror};
}
export const viewPath=(from,to)=>[structuredClone(from),structuredClone(to)];
export function sameViewPose(a,b,tolerance=.002){return !!a&&!!b&&['az','el','frameH','flat'].every(k=>Math.abs((a[k]||0)-(b[k]||0))<tolerance)&&!!a.mirror===!!b.mirror&&a.target.every((n,i)=>Math.abs(n-b.target[i])<tolerance);}
// Spatial Camera instrument, evaluated from the same View intent as renderer and visitor.
export function framingInstrument(p,aspect=1){
 const observer=eye(p),d=distance(observer,p.target),forward=p.target.map((n,i)=>(n-observer[i])/d),right=[Math.cos(p.az),0,-Math.sin(p.az)],up=[-Math.sin(p.el)*Math.sin(p.az),Math.cos(p.el),-Math.sin(p.el)*Math.cos(p.az)];
 const h=p.frameH/2,w=h*aspect;
 return {observer,corners:[[-1,1],[1,1],[1,-1],[-1,-1]].map(([x,y])=>p.target.map((n,i)=>n+right[i]*w*x+up[i]*h*y))};
}
