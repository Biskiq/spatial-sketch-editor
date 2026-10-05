// C9.4 (Camera default Travel and live invocation) and C9.5 (visitor participation and agency)
// regression coverage, written against behavior rather than shape:
//   * explicit Travel preparation is the only thing that creates Camera connectivity, in one
//     transaction, and it prepares every legitimate origin while reusing authored routes;
//   * Travel executes the authored Camera route from the visitor's live pose (no departure Gate, no
//     second tween, no hidden Cut) and fires only the traversed connection's beats, exactly once;
//   * Cut executes no route beats, and missing support stays an explicit local refusal;
//   * a same-View Seam is zero-distance only while the visitor is actually standing there, and is a
//     Camera framing invocation from the live pose anywhere else;
//   * interaction stays a visitor offer, click is distinguishable from drag, several offers open an
//     explicit choice, availability is authored explicitly (Experience-wide by default), and a
//     world-only session needs no Presentation, Stop or Guide;
//   * rejoin and detour Return resume the playhead: remaining work is the part not yet spent, cues
//     whose signal already fired are skipped while future cues are kept, and the parent's own
//     remaining work is restored rather than the detour's reading;
//   * standalone open/close/rejoin and one bounded detour only read authored documents.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// The action layer's animation clock reads the OS motion preference at import time; Node has no
// matchMedia. Every application module is imported dynamically so the shim is installed first.
globalThis.matchMedia ??= () => ({matches:false,addEventListener(){},removeEventListener(){}});
// Exit Preview restores through the one command seam, whose caption update looks up #caption. The
// harness supplies the lookup; the assertions are about documents, history and selection, not pixels.
globalThis.document ??= {getElementById:()=>null};
const M=await import('../app/experience-model.js');
const R=await import('../app/experience-runtime.js');
const {createSceneCapabilities}=await import('../app/experience-capabilities.js');
const {S,ctx}=await import('../app/state.js');
const nav=await import('../app/navigation.js');
const E=await import('../app/experience.js');
const UI=await import('../app/experience-ui.js');
const {sameViewPose}=await import('../app/camera-evaluation.js');
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
const view=(e,c,pid,p,name,role)=>M.addView(e,c,pid,p,name,role);
const stopView=id=>id;
function fixture(){
 const e=M.createExperience(),c=M.createCamera(),scene=createSceneCapabilities();M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']}),r=M.addPresentation(e,{kind:'subjects',ids:['light']});
 const from=view(e,c,p,pose,'From','entry'),other=view(e,c,p,{...pose,target:[-12,1,0]},'Other','choice');
 const to=view(e,c,q,{...pose,target:[10,1,0]},'To','entry'),last=view(e,c,r,{...pose,target:[20,1,0]},'Last','entry');
 const a=M.addStop(e,p),b=M.addStop(e,q),d=M.addStop(e,r);
 return {e,c,scene,p,q,r,a,b,d,from,other,to,last};
}
const control=(f,sid,cid,value,pid=f.q)=>M.addContribution(f.e,pid,{kind:'control',name:cid,subjectId:sid,capabilityId:cid,value});
// A visitor offer: activation belongs to its trigger subject, never to the visit entry. `target` lets a
// case give two offers the same trigger a distinguishable effect.
const offer=(f,sid,cid,value,pid=null,target=sid)=>M.addContribution(f.e,pid,{kind:'control',name:cid,subjectId:target,capabilityId:cid,value},'interaction',sid);
const run=f=>R.startGuide(f.e,f.c,R.createRuntime(f.e,f.c,null,pose,f.scene),f.scene);
const tick=(f,r,t)=>R.tickRuntime(f.e,f.c,r,t,f.scene);
// A three-like vector and a Stage adapter complete enough for the real action layer: Preview parks the
// realized standpoint, applies the visitor pose and orbits on a drag, so Camera and its realization are
// genuinely read here rather than faked. The assertions are about source documents and runtime state.
const vec=(x=0,y=0,z=0)=>({x,y,z,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;},clone(){return vec(this.x,this.y,this.z);},toArray(){return [this.x,this.y,this.z];},distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}});
function liveFixture(){
 E.initExperience();  // The museum is the identity/Undo backing store main.js installs at boot: an empty one keeps
  // commitEdit live (so an "aggregate transaction" is observable) while every subject resolves through
  // the Scene capability source, exactly as the World does.
  ctx.museum={walls:[],ceilings:[],art:[],objects:[],galleries:[]};
 const cam={target:vec(0,1,0),az:.7,el:.3,frameH:8,flat:0,mirror:false};
 const camera={position:vec(0,1,10),up:vec(0,1,0),fov:45,getWorldDirection(d){d.x=0;d.y=0;d.z=-1;return d;}};
 const stage={items:new Map(),d:()=>({}),restyle(){},w:1280,h:720,cam,camera,pick:()=>stage.pickResult,camState:()=>({az:cam.az,el:cam.el,frameH:cam.frameH,flat:cam.flat,mirror:cam.mirror,target:{x:cam.target.x,y:cam.target.y,z:cam.target.z}})};
 ctx.stage=stage;
 const e=ctx.experience,c=ctx.cameraSource;
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 const from=view(e,c,p,pose,'From','entry'),other=view(e,c,p,{...pose,target:[-12,1,0]},'Other','choice');
 const to=view(e,c,q,{...pose,target:[10,1,0]},'To','entry');
 const a=M.addStop(e,p),b=M.addStop(e,q);
 return {e,c,stage,p,q,a,b,from,other,to};
}
const useId=(e,u)=>e.uses[u].viewId;

test('C9.4 preparation creates only missing scoped routes, reuses the rest, and is idempotent',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const first=M.prepareTravelSupport(e,c,a,b);
 assert.equal(first.prepared.length,2);assert.equal(first.reused.length,0);assert.equal(first.gaps.length,0);
 assert.deepEqual(first.prepared.map(x=>x.viewId).sort(),[useId(e,f.from),useId(e,f.other)].sort());
 assert.equal(Object.keys(c.connections).length,2);
 const second=M.prepareTravelSupport(e,c,a,b);
 assert.equal(second.prepared.length,0);assert.equal(second.reused.length,2);
 assert.equal(Object.keys(c.connections).length,2);
 // A new legitimate origin is not prepared silently; the explicit action covers exactly it.
 view(e,c,f.p,{...pose,target:[6,1,0]},'Extra','choice');
 assert.equal(Object.keys(c.connections).length,2);
 const third=M.prepareTravelSupport(e,c,a,b);
 assert.equal(third.prepared.length,1);assert.equal(third.reused.length,2);
 assert.equal(Object.keys(c.connections).length,3);
 // An unresolved origin or entry stays a reported gap and fabricates no edge.
 e.stops[b].entry={kind:'use',useId:'deleted-use'};
 const gap=M.prepareTravelSupport(e,c,a,b);
 assert.equal(gap.prepared.length,0);assert.equal(gap.gaps.length,3);assert.equal(Object.keys(c.connections).length,3);
});

test('C9.4 Travel selection is one aggregate Undo; Cut and View addition create no connectivity',()=>{
 const f=liveFixture(),{e,c,a,b}=f;
 assert.equal(E.openSeam(a,b),true);
 E.setSeamMode('cut');
 assert.equal(Object.keys(c.connections).length,0);
 const undo=S.undo.length;
 assert.equal(E.setSeamMode('travel')!==false,true);
 assert.equal(Object.keys(c.connections).length,2);
 assert.equal(S.undo.length,undo+1);                             // both routes in one authored edit
 assert.match(S.status.text,/Prepared 2 Camera routes/);
 // Re-asserting Travel reuses both routes: one coherent transaction, no duplicate edges, no history.
 assert.notEqual(E.setSeamMode('travel'),false);
 assert.equal(Object.keys(c.connections).length,2);
 assert.equal(S.undo.length,undo+1);
 assert.match(S.status.text,/reused 2 existing/);
 // Adding a View is ordinary framing work: it creates no route and the Seam reports the real gap.
 view(e,c,f.p,{...pose,target:[6,1,0]},'Extra','choice');
 assert.equal(Object.keys(c.connections).length,2);
 const seam=UI.seamHtml({from:a,to:b});
 assert.match(seam,/Travel needs support for the new View/);
 assert.match(seam,/exp-prepare/);
 assert.ok(E.prepareSeamSupport());
 assert.equal(Object.keys(c.connections).length,3);
 assert.match(S.status.text,/Prepared 1 Camera route/);
 assert.match(UI.seamHtml({from:a,to:b}),/All origins supported/);
});

test('C9.4 Cut executes no Travel route beats or flight; Travel runs them once at the traversed station',()=>{
 const f=fixture(),{e,c,a,b,d}=f;
 const route=M.addConnection(c,useId(e,f.from),useId(e,f.to));
 M.editSeam(e,a,b,{mode:'cut'});
 // Baseline: this same Cut before any route work is authored on the Seam.
 const base=R.nextRuntime(e,c,run(f),f.scene);
 assert.equal(base.stopId,b);assert.equal(base.movement,null);
 M.addBeat(e,c,a,b,route,'arrival',2);
 const work=control(f,'light','intensity',4,f.q);
 M.addInvocationBeat(e,c,a,b,route,'departure',work,f.scene);
 M.addConnection(c,useId(e,f.to),useId(e,f.last));
 let r=run(f);
 assert.equal(R.gateState(e,c,r).allowed,true);
 r=R.nextRuntime(e,c,r,f.scene);
 assert.equal(r.stopId,b);assert.equal(r.movement,null);
 assert.ok(sameViewPose(r.pose,c.views[useId(e,f.to)].pose));
 assert.equal(r.active[work],undefined);
 assert.equal(r.readiness,base.readiness);          // authored route work never costs a Cut anything
 tick(f,r,20);
 assert.equal(r.active[work],undefined);assert.equal(r.movement,null);
 assert.equal(e.stops[b].presentationId,f.q);
 // The same Seam as Travel executes the authored route and its station work exactly once.
 M.editSeam(e,a,b,{mode:'travel'});
 let t=run(f);
 t=R.nextRuntime(e,c,t,f.scene);
 // The traversed connection is Camera's authored directed route: its station beat is the only
 // invocation the move carries, and it belongs to this connection.
 assert.deepEqual(t.movement.invokes.map(x=>x.useId),[work]);
 assert.equal(t.movement.invokes[0].connectionId,route);
 assert.ok(Math.abs(t.movement.duration-(t.movement.travelDuration+2))<1e-9);
 t=tick(f,t,.01);                                    // the departure station stands at the move's start
 const token=t.active[work];
 assert.equal(typeof token,'string');
 t=tick(f,t,t.movement.duration+1);
 assert.equal(t.movement,null);
 assert.ok(sameViewPose(t.pose,c.views[useId(e,f.to)].pose));
 assert.equal(t.active[work],token);
});

test('C9.4 early Next from the live pose traverses only the supported redirected route',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const routeA=M.addConnection(c,useId(e,f.from),useId(e,f.to));
 const routeB=M.addConnection(c,useId(e,f.other),useId(e,f.to));
 const workA=control(f,'light','intensity',4,f.q),workB=control(f,'machine','casing',1,f.q);
 M.addInvocationBeat(e,c,a,b,routeA,'departure',workA,f.scene);
 M.addInvocationBeat(e,c,a,b,routeB,'departure',workB,f.scene);
 M.editSeam(e,a,b,{mode:'travel'});
 let r=run(f);
 // The visitor redirects to a supported View and Next arrives while that move is still in flight.
 assert.equal(R.requestView(r,e,c,f.other,'auto'),true);
 assert.ok(r.movement);
 r=tick(f,r,.2);
 const live=structuredClone(r.pose);
 assert.ok(r.movement);
 const next=R.nextRuntime(e,c,r,f.scene);
 assert.equal(next.stopId,b);assert.equal(next.refusal,null);
 assert.deepEqual(next.movement.path[0],live);
 assert.deepEqual(next.movement.path.at(-1),c.views[useId(e,f.to)].pose);
 assert.deepEqual(next.movement.invokes.map(x=>x.useId),[workB]);   // only the traversed route's station
 assert.equal(next.queue.length,0);
 const started=tick(f,next,.01);                       // the departure station stands at the move's start
 const token=started.active[workB];
 assert.equal(typeof token,'string');
 assert.equal(started.active[workA],undefined);        // the abandoned route's station never runs
 const done=tick(f,started,started.movement.duration+1);
 assert.equal(done.movement,null);
 assert.equal(done.active[workB],token);              // and the traversed one runs exactly once
 assert.ok(sameViewPose(done.pose,c.views[useId(e,f.to)].pose));
});

test('C9.4 same-View travel is Camera zero-distance, never a fabricated edge',()=>{
 const f=fixture(),{e,c,a}=f;
 const reuse=M.reuseView(e,c,f.q,useId(e,f.from));      // the dest entry is the same Camera View
 M.setRole(e,reuse,'entry');
 M.editSeam(e,a,f.b,{mode:'travel'});
 assert.equal(Object.keys(c.connections).length,0);
 const report=M.prepareTravelSupport(e,c,a,f.b);
 assert.equal(report.direct.length,1);                  // the same-View origin needs no edge
 assert.equal(report.prepared.length,1);                // the redirect origin still gets its own route
 assert.equal(Object.keys(c.connections).length,1);
 assert.ok(!Object.values(c.connections).some(x=>x.from===useId(e,f.from)&&x.to===useId(e,f.from)));
 const r=R.nextRuntime(e,c,run(f),f.scene);
 assert.equal(r.stopId,f.b);assert.equal(r.movement,null);
 assert.ok(sameViewPose(r.pose,c.views[useId(e,f.from)].pose));
});

test('C9.4 readiness and Auto count the route and its holds exactly once',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const route=M.addConnection(c,useId(e,f.from),useId(e,f.to));
 M.addBeat(e,c,a,b,route,'arrival',2);
 M.editSeam(e,a,b,{mode:'travel'});
 let r=run(f);
 assert.equal(R.gateState(e,c,r).allowed,true);
 r=R.nextRuntime(e,c,r,f.scene);
 const expected=r.movement.travelDuration+2;
 assert.ok(Math.abs(r.readiness-(R.BREATHING+expected))<1e-9);
 r.autoplay=true;
 r=tick(f,r,expected+R.BREATHING-.05);
 assert.equal(r.stopId,b);                            // the route cost is not paid twice
 r=tick(f,r,.1);
 assert.equal(r.stopId,f.d);
});

test('C9.4 rejoin restores viewing intent from the live pose without re-running route stations',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const route=M.addConnection(c,useId(e,f.from),useId(e,f.to));
 const work=control(f,'light','intensity',4,f.q);
 M.addInvocationBeat(e,c,a,b,route,'departure',work,f.scene);
 M.editSeam(e,a,b,{mode:'travel'});
 let r=run(f);
 r=R.nextRuntime(e,c,r,f.scene);
 r=tick(f,r,r.movement.duration+1);
 const token=r.active[work],visit=r.visit;
 r=R.exploreRuntime(r,{...pose,target:[3,1,3]});
 const rejoined=R.resumeGuide(e,c,r,{...pose,target:[4,1,4]});
 assert.equal(rejoined.exploring,false);assert.equal(rejoined.autoplay,false);
 assert.equal(rejoined.visit,visit);
 assert.equal(rejoined.active[work],token);           // a rejoin is not a traversal
 assert.deepEqual(rejoined.movement.path[0].target,[4,1,4]);
 assert.ok(sameViewPose(rejoined.movement.path.at(-1),c.views[useId(e,f.to)].pose));
});

test('C9.5 offers are never automatic work and availability stays explicit',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const music=offer(f,'piano','music',true);
 e.uses[music].availability=f.q;
 M.editSeam(e,a,b,{});
 let r=run(f);
 assert.equal(r.active[music],undefined);
 r=tick(f,r,30);
 assert.equal(r.active[music],undefined);
 assert.equal(R.projectedValue(f.scene,r,'piano','playing'),false);
 // Available in another Presentation: activation refuses locally instead of executing it here.
 assert.equal(r.presentationId,e.stops[a].presentationId);
 r=R.activateRuntime(e,c,r,music,f.scene);
 assert.equal(r.active[music],undefined);
 e.uses[music].availability=e.stops[a].presentationId;
 r=R.activateRuntime(e,c,r,music,f.scene);
 assert.equal(typeof r.active[music],'string');
 const stopped=R.stopActivityRuntime(e,r,r.active[music]);
 assert.equal(R.projectedValue(f.scene,stopped,'piano','playing'),false);
});

test('C9.5 a click activates, a drag never does, and several offers open an explicit choice',async()=>{
 const f=liveFixture(),{e,p}=f;
 // Two offers on one trigger subject: playing the piano, and highlighting the imported mesh.
 const play=offer(f,'piano','music',true);
 const highlight=offer(f,'piano','emphasis',true,null,'mesh');
 assert.equal(E.preview(p),true);
 const r=()=>S.visitor.runtime;
 f.stage.pickResult={object:{userData:{id:'piano'}}};
 E.visitorPointer({clientX:100,clientY:100});
 E.visitorMove({clientX:104,clientY:102});            // a real click, inside the slop
 E.visitorRelease();
 assert.ok(S.visitorChoice);
 assert.deepEqual([...S.visitorChoice.offers].sort(),[play,highlight].sort());
 assert.equal(r().active[play],undefined);            // never the silently first of several
 assert.equal(r().active[highlight],undefined);
 E.visitorCommand('choice-cancel');
 assert.equal(S.visitorChoice,null);
 E.visitorPointer({clientX:100,clientY:100});
 E.visitorMove({clientX:180,clientY:150});            // a drag
 E.visitorRelease();
 assert.equal(S.visitorChoice,null);
 assert.equal(r().active[play],undefined);
 assert.equal(r().active[highlight],undefined);
 E.visitorPointer({clientX:100,clientY:100});
 E.visitorRelease();
 assert.ok(S.visitorChoice);
 E.visitorCommand('activate',highlight);
 assert.equal(S.visitorChoice,null);
 assert.equal(typeof r().active[highlight],'string');
 assert.equal(r().active[play],undefined);
 // Exactly the chosen offer ran: the mesh is highlighted and the piano was never silently played.
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'mesh','highlight'),true);
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'piano','playing'),false);
 // Exploration keeps the same distinction: a click activates, a drag orbits without activating.
 E.visitorCommand('stop',r().active[highlight]);
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'mesh','highlight'),false);   // the run released its effect
 E.visitorCommand('explore');
 const before=r().pose.az;
 f.stage.pickResult={object:{userData:{id:'piano'}}};
 E.visitorPointer({clientX:200,clientY:200});
 E.visitorMove({clientX:280,clientY:240});
 E.visitorRelease();
 assert.equal(S.visitorChoice,null);                                                    // a drag is not a click
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'mesh','highlight'),false);    // and it activates nothing
 assert.notEqual(r().pose.az,before);
 E.visitorPointer({clientX:200,clientY:200});
 E.visitorRelease();
 assert.ok(S.visitorChoice);
 E.visitorCommand('activate',highlight);
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'mesh','highlight'),true);
 E.visitorCommand('choice-cancel');
 // Leave the session the way a visitor does, so no Preview state leaks into another case.
 await E.exitPreview();
 assert.equal(S.visitor,null);
});

test('C9.5 open/close/rejoin and one bounded detour never write authored documents',()=>{
 const f=liveFixture(),{e,c,a,b}=f;
 const third=M.addPresentation(e,{kind:'subjects',ids:['light']});
 const thirdEntry=view(e,c,third,{...pose,target:[7,1,7]},'Third','entry');
 const thirdStop=M.addStop(e,third);
 e.stops[a].choices.push({id:'choice-go',label:'Go to the piano',targetId:b,kind:'go'});
 const source=JSON.stringify({e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource,undo:S.undo.length});
 let r=run(f);
 assert.equal(r.stopId,a);
 // Opening another Presentation from a Guide parks exactly one bounded return bookmark.
 const opened=R.openPresentationRuntime(e,c,r,third,f.scene);
 assert.equal(opened.bookmarks.length,1);
 assert.equal(opened.bookmarks[0].stopId,a);
 assert.equal(opened.stopId,null);assert.equal(opened.presentationId,third);
 assert.ok(sameViewPose(opened.pose,c.views[useId(e,thirdEntry)].pose));
 // While a bounded bookmark is armed, opening another available Presentation only switches this
 // standalone view: the parked parent and its single return bookmark are untouched, and no second
 // detour is created.
 const twice=R.openPresentationRuntime(e,c,opened,f.p,f.scene);
 assert.equal(twice.bookmarks.length,1);
 assert.equal(twice.bookmarks[0].stopId,a);
 assert.equal(twice.presentationId,f.p);
 assert.equal(twice.refusal,null);
 // Closing returns to exploration, and Rejoin restores the standalone viewing intent from the pose.
 const closed=R.closePresentationRuntime(opened);
 assert.equal(closed.exploring,true);assert.equal(closed.presentationId,third);
 const rejoined=R.resumeGuide(e,c,closed,{...pose,target:[2,1,2]});
 assert.equal(rejoined.exploring,false);assert.equal(rejoined.autoplay,false);
 assert.deepEqual(rejoined.movement.path[0].target,[2,1,2]);
 assert.ok(sameViewPose(rejoined.movement.path.at(-1),c.views[useId(e,thirdEntry)].pose));
 // Return from the parked parent restores the Stop, and a go choice abandons it instead.
 const back=R.returnDetour(e,c,rejoined,f.scene);
 assert.equal(back.stopId,a);assert.equal(back.bookmarks.length,0);
 const detour=R.chooseRuntime(e,c,run(f),thirdStop,true,f.scene);
 assert.equal(detour.bookmarks.length,1);assert.equal(detour.stopId,thirdStop);
 const go=R.chooseRuntime(e,c,detour,b,false,f.scene);
 assert.equal(go.bookmarks.length,0);assert.equal(go.stopId,b);
 assert.equal(JSON.stringify({e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource,undo:S.undo.length}),source);
});

test('C9.5 a full visitor session leaves authored documents, history and selection untouched',async()=>{
 const f=liveFixture(),{e,c,a,b}=f;
 const piano=offer(f,'piano','music',true);
 const fourth=M.addPresentation(e,{kind:'subjects',ids:['light']});
 view(e,c,fourth,{...pose,target:[5,1,5]},'Fourth','entry');
 const route=M.addConnection(c,useId(e,f.from),useId(e,f.to));
 M.editSeam(e,a,b,{mode:'travel'});
 const snapshot=JSON.stringify({e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource,undo:S.undo.length,sel:S.sel});
 assert.equal(E.preview(f.p),true);
 E.visitorCommand('activate',piano);
 E.visitorCommand('look',f.other);
 E.visitorCommand('explore');
 E.visitorCommand('rejoin');
 E.visitorCommand('open',fourth);
 E.visitorCommand('close');
 E.visitorCommand('captions');
 E.visitorCommand('next');
 E.visitorCommand('back');
 assert.equal(JSON.stringify({e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource,undo:S.undo.length,sel:S.sel}),snapshot);
 await E.exitPreview();
 assert.equal(JSON.stringify({e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource,undo:S.undo.length,sel:S.sel}),snapshot);
 assert.equal(c.connections[route].anchors.length,0);
});

test('C9.4 same-View Travel from a moved live pose flies from there, never a snap or an edge',()=>{
 const f=fixture(),{e,c,a}=f;
 const reuse=M.reuseView(e,c,f.q,useId(e,f.from));      // the destination entry is the same Camera View
 M.setRole(e,reuse,'entry');
 M.editSeam(e,a,f.b,{mode:'travel'});
 const edges=Object.keys(c.connections).length;
 const standing=run(f);
 assert.equal(R.nextRuntime(e,c,standing,f.scene).movement,null);   // standing at the View: zero distance
 // The visitor walks away, then reclaims guidance: the same Seam can no longer be zero distance.
 const moved={...pose,target:[21,1,0],az:-1.2};
 const wandered=R.exploreRuntime(run(f),moved);
 const next=R.nextRuntime(e,c,wandered,f.scene);
 assert.equal(next.stopId,f.b);assert.equal(next.refusal,null);
 assert.ok(next.movement);                                          // a real Camera invocation
 assert.deepEqual(next.movement.path[0],moved);                     // from the actual live pose
 assert.ok(next.movement.travelDuration>0);
 assert.deepEqual(next.movement.path.at(-1),c.views[useId(e,f.from)].pose);
 assert.deepEqual(next.movement.invokes,[]);                        // no authored route work: there is no connection
 assert.equal(Object.keys(c.connections).length,edges);             // and no edge was fabricated for it
});

test('C9.5 rejoin never rebuilds completed work',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const local=M.addContribution(e,f.q,{kind:'narration',name:'Local',text:'Walkthrough.',duration:10,markers:[]},'narration');
 M.editSeam(e,a,b,{});
 let r=run(f);
 r=R.nextRuntime(e,c,r,f.scene);
 assert.equal(r.presentationId,f.q);
 r=tick(f,r,12);                                     // the visit-local run completed
 assert.equal(r.movement,null);
 const token=r.active[local];
 // Rejoin from the Stop's own entry View, so the framing flight is zero and the reading is about work.
 const entryPose=c.views[useId(e,f.to)].pose;
 const rejoined=R.resumeGuide(e,c,R.exploreRuntime(r,entryPose),entryPose);
 assert.equal(rejoined.readiness,R.BREATHING);        // completed work owes nothing again
 assert.equal(rejoined.active[local],token);          // the same run, never a second one
 assert.equal(rejoined.movement,null);
});

test('C9.5 rejoin skips a cue whose signal already fired',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const local=M.addContribution(e,f.q,{kind:'narration',name:'Local',text:'Walkthrough.',duration:10,markers:[]},'narration');
 const finalView=view(e,c,f.q,{...pose,target:[3,1,3]},'Final','choice');
 e.uses[finalView].cue={useId:local,signal:'complete'};
 M.editSeam(e,a,b,{});
 let r=run(f);
 r=R.nextRuntime(e,c,r,f.scene);
 r=tick(f,r,12);                                     // completed, so its completion cue already fired
 assert.equal(R.signalEmitted(r,{useId:local,signal:'complete'}),true);
 assert.equal(r.movement,null);
 const entryPose=c.views[useId(e,f.to)].pose;
 const rejoined=R.resumeGuide(e,c,R.exploreRuntime(r,entryPose),entryPose);
 assert.equal(rejoined.readiness,R.BREATHING);        // and a cue that happened is not owed a Camera move
 assert.equal(rejoined.movement,null);
});

test('C9.5 rejoin keeps a future cue and only skips the cues that already fired',()=>{
 const f=fixture(),{e,c,a,b}=f;
 const local=M.addContribution(e,f.q,{kind:'narration',name:'Local',text:'Walkthrough.',duration:10,markers:[{id:'late',label:'Late',time:9}]},'narration');
 const lateView=view(e,c,f.q,{...pose,target:[40,1,0]},'Late','choice');
 e.uses[lateView].cue={useId:local,signal:'marker:late'};
 M.editSeam(e,a,b,{});
 let r=run(f);
 r=R.nextRuntime(e,c,r,f.scene);
 r=tick(f,r,4);                                      // 4 of 10 spent; the cue is still ahead of the playhead
 assert.equal(R.signalEmitted(r,{useId:local,signal:'marker:late'}),false);
 const entryPose=c.views[useId(e,f.to)].pose;
 const rejoined=R.resumeGuide(e,c,R.exploreRuntime(r,entryPose),entryPose);
 assert.ok(rejoined.readiness>R.BREATHING+6-1e-9);                   // the remaining run, plus the future cue
 assert.equal(R.signalEmitted(rejoined,{useId:local,signal:'marker:late'}),false);
 const done=tick(f,rejoined,7);
 assert.equal(R.signalEmitted(done,{useId:local,signal:'marker:late'}),true);      // and it still fires
});

test('C9.5 Return from one detour restores the parent remaining work, not the detour reading',()=>{
 const f=liveFixture(),{e,c,a}=f;
 const local=M.addContribution(e,f.p,{kind:'narration',name:'Parent',text:'Parent walkthrough.',duration:10,markers:[]},'narration');
 const third=M.addPresentation(e,{kind:'subjects',ids:['light']});
 view(e,c,third,{...pose,target:[7,1,7]},'Third','entry');
 const thirdStop=M.addStop(e,third);
 M.addContribution(e,third,{kind:'narration',name:'Detour',text:'Detour walkthrough.',duration:40,markers:[]},'narration');
 let r=run(f);
 assert.equal(r.presentationId,f.p);
 r=tick(f,r,4);                                      // 4 of the parent's 10 seconds are spent
 const floor=r.cueFloor;
 const detour=R.chooseRuntime(e,c,r,thirdStop,true,f.scene);
 assert.ok(detour.readiness>R.BREATHING+30);         // the detour's own much longer work
 const back=R.returnDetour(e,c,detour,f.scene);
 assert.equal(back.stopId,a);assert.equal(back.presentationId,f.p);
 assert.equal(back.cueFloor,floor);                  // the parent's own cue floor comes back with it
 assert.equal(typeof back.active[local],'string');   // and its run resumes rather than restarting
 assert.ok(Math.abs(back.readiness-(R.BREATHING+6))<1e-9);         // 6 of the parent's 10 seconds remain
});

test('C9.5 offer authoring defaults to Experience-wide and writes its availability in one edit',()=>{
 const f=liveFixture();
 S.experienceContext.presentation=f.p;
 E.beginOffer('interaction','piano');
 assert.equal(S.expOfferDraft.availability,null);    // Experience-wide is the authoring default
 const undo=S.undo.length;
 const wide=E.acceptOffer();
 assert.equal(typeof wide,'string');
 assert.equal(ctx.experience.uses[wide].availability,null);
 assert.equal(ctx.experience.uses[wide].presentationId,f.p);      // its home is still the Presentation
 assert.equal(S.undo.length,undo+1);
 // An explicit contextual choice is authored through the same draft, still one ordinary edit.
 E.beginOffer('interaction','piano');
 E.changeOfferField('availability',f.q);
 const undo2=S.undo.length;
 const contextual=E.acceptOffer();
 assert.equal(ctx.experience.uses[contextual].availability,f.q);
 assert.equal(ctx.experience.uses[contextual].presentationId,f.p);
 assert.equal(S.undo.length,undo2+1);
 // The ordinary writer switches an existing offer back to Experience-wide.
 E.updateActivity(contextual,'availability',null);
 assert.equal(ctx.experience.uses[contextual].availability,null);
});

test('C9.5 Preview Experience starts a world-only session with no Presentation, Stop or Guide',async()=>{
 liveFixture();
 const e=ctx.experience;
 for(const id of Object.keys(e.presentations))delete e.presentations[id];
 e.stops={};e.guide=[];
 const music=M.addContribution(e,null,{kind:'control',name:'Play piano',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');
 assert.equal(e.uses[music].availability,null);
 assert.equal(Object.keys(e.presentations).length,0);
 assert.equal(Object.keys(e.stops).length,0);assert.equal(e.guide.length,0);
 assert.equal(E.previewExperience(),true);
 const r=()=>S.visitor.runtime;
 assert.equal(r().presentationId,null);assert.equal(r().stopId,null);
 assert.equal(E.visitorCommand('activate',music),true);
 assert.equal(R.projectedValue(S.visitor.source.scene,r(),'piano','playing'),true);
 await E.exitPreview();
 // Nothing to visit without Experience-wide participation: the entry refuses rather than pretending.
 const p=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 e.uses[music].availability=p;
 assert.equal(E.previewExperience(),false);
 assert.equal(E.preview(p),true);                    // the Presentation entry still works
 await E.exitPreview();
});

test('C9.5 rejoin restores a held viewing intent, so no cue the remainder excluded can run',()=>{
 const f=fixture(),{e,c,a}=f;
 const local=M.addContribution(e,f.p,{kind:'narration',name:'Local',text:'Walkthrough.',duration:40,markers:[{id:'late',label:'Late',time:20}]},'narration');
 e.uses[f.other].cue={useId:local,signal:'marker:late'};
 e.stops[a].entry={kind:'hold'};                      // this Stop holds the viewpoint explicitly
 let r=run(f);
 assert.equal(r.viewingSuppressed,true);              // so no automatic viewing at entry
 r=R.lookRuntime(e,c,r,f.other);                      // the visitor deliberately chooses a View mid-visit
 assert.equal(r.viewingSuppressed,false);             // which resumes automatic viewing while it lasts
 r=R.resumeGuide(e,c,R.exploreRuntime(r),null);
 assert.equal(r.viewingSuppressed,true);              // Rejoin restores the Stop's held intent
 const plan=R.presentationPlan(e,c,r.presentationId,r.pose,null,r.movement,f.scene,{cues:false,cueFloor:r.cueFloor,skipCue:cue=>R.signalEmitted(r,cue),carried:()=>undefined});
 assert.equal(plan.requests.some(x=>x.id===f.other),false);   // so the remainder counts no cue move
 let moved=null;
 for(let i=0;i<200;i++){const before=r;r=R.tickRuntime(e,c,r,.25,f.scene);if(!before.movement&&r.movement)moved=r.movement.useId;}
 assert.equal(moved,null);                            // and the runtime can never perform one
});
