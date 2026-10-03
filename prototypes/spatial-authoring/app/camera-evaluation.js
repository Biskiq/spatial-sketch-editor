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
 return [from,...c.anchors.map(a=>({ ...interpolate(from,to,.5), target:[...a.position] })),to];
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
