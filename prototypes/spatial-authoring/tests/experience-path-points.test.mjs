// UX5/§3.2 + UX6/§3.4. The one new behaviour this pass adds to the Camera Path is *where* an armed press
// inserts a point: into the nearest segment of the drawn path rather than at the end, so the path's own
// evaluation runs the observers in the order the author drew them. The second half asserts the one Cue and
// station naming the Deck, the Card and the Stage share — `Anchor n` is a Camera field name, never a label.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// The action layer reads the OS motion preference at import time; Node has no matchMedia.
globalThis.matchMedia ??= () => ({matches:false,addEventListener(){},removeEventListener(){}});
const M=await import('../app/experience-model.js');
const {S,ctx}=await import('../app/state.js');
const {routeGeometry}=await import('../app/camera-evaluation.js');
const {stationLabel,cueName,journeyClock}=await import('../app/experience-coordination.js');
const E=await import('../app/experience.js');
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
const near=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<1e-9);
// A minimal Stage adapter plus a real Camera reading: the writers under test are the action layer's own.
function fixture(){
 E.initExperience();
 const cam={target:{x:0,y:1,z:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}},az:.7,el:.3,frameH:8,flat:0,mirror:false};
 ctx.stage={items:new Map(),d:()=>({}),restyle(){},cam,camState:()=>({az:cam.az,el:cam.el,frameH:cam.frameH,flat:cam.flat,mirror:cam.mirror,target:{x:cam.target.x,y:cam.target.y,z:cam.target.z}})};
 const e=ctx.experience,c=ctx.cameraSource;
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 const from=M.addView(e,c,p,pose,'From','entry'),to=M.addView(e,c,q,pose,'To','entry');
 const a=M.addStop(e,p),b=M.addStop(e,q);
 const route=M.addConnection(c,e.uses[from].viewId,e.uses[to].viewId);
 return {e,c,p,q,a,b,route};
}
test('§3.2 an armed press inserts into the nearest segment and the observers run in path order',()=>{
 const {e,c,a,b,route}=fixture();
 const first=M.addAnchor(c,route,[0,1.5,0]),second=M.addAnchor(c,route,[10,1.5,0]);
 const beat=M.addBeat(e,c,a,b,route,first,2);
 E.openSeam(a,b);
 E.editRoute(route);
 S.experienceContext.armed=true;
 // Placed beside the departure end: the new point belongs before Point 1, not after Point 2.
 assert.notEqual(E.routePoint({x:-2,z:0}),false);
 assert.equal(S.experienceContext.armed,false);              // the press disarms with the write
 const anchors=c.connections[route].anchors;
 assert.equal(anchors.length,3);
 assert.equal(anchors[0].position[0],-2);
 assert.equal(anchors[1].id,first);
 assert.equal(anchors[2].id,second);
 // Authored work bound to a point keeps that point's identity: insertion re-keys nothing.
 assert.equal(e.seams[`${a}>${b}`].beats.find(x=>x.id===beat).stationId,first);
 // …and the route's own evaluation runs the observers in the drawn order, endpoints included.
 const observers=routeGeometry(c,route).observer;
 assert.ok(near(observers[1],[-2,1.5,0]));
 assert.ok(near(observers[2],anchors[1].position));
 assert.ok(near(observers[3],anchors[2].position));
});
test('§3.4/§5.6 one Cue and station name for the Deck, the Card and the Stage',()=>{
 const {e,c,p,a,b,route}=fixture();
 const anchor=M.addAnchor(c,route,[4,1.5,0]);
 const marker=M.fresh(c,'marker');
 c.connections[route].markers.push({id:marker,name:'Power station',progress:.6});
 // An authored point reads as the point it is; `Anchor n` is never shown.
 assert.equal(stationLabel(c.connections[route],anchor),'Point 1');
 assert.equal(stationLabel(c.connections[route],'departure'),'Departure');
 assert.equal(stationLabel(c.connections[route],'arrival'),'Arrival');
 assert.equal(stationLabel(c.connections[route],marker),'Power station');
 const work=M.addContribution(e,p,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:.4});
 const hold=M.addBeat(e,c,a,b,route,anchor,2);
 const invoke=M.addInvocationBeat(e,c,a,b,route,marker,work,ctx.sceneSource);
 const clocked=journeyClock(c,e.seams[`${a}>${b}`],route);
 const atAnchor=clocked.cues.find(k=>k.stationId===anchor),atMarker=clocked.cues.find(k=>k.stationId===marker);
 // A named mid-route station names its Cue; otherwise the first invoked Activity does; otherwise the Cue
 // reads as the pause it holds. Both Cues are on one route, so neither borrows the other's name.
 assert.equal(cueName(e,c.connections[route],atAnchor),'Pause · Point 1');
 assert.equal(cueName(e,c.connections[route],atMarker),'Power station');
 assert.equal(atAnchor.holds.length,1);
 assert.equal(atMarker.invokes.length,1);
 assert.equal(clocked.cues.length,2);
 assert.ok(hold&&invoke);
});
