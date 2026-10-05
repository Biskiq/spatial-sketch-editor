// Regression coverage for the MP2 review blockers:
//   P1 selecting another Stop must end the old route writer;
//   P2 a primary explanation keeps its binding when its organizational home moves;
//   P3 Experience-scoped narration output survives later visits without breaking Gate protection;
//   P4 Auto derives from remaining Experience work and live Camera movement;
//   P5 impossible signal scopes are repairable, unavailable work instead of endless waiting.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// The action layer's animation clock reads the OS motion preference at import time; Node has no
// matchMedia. Every application module is imported dynamically so the shim is installed first.
globalThis.matchMedia ??= () => ({matches:false,addEventListener(){},removeEventListener(){}});
const M=await import('../app/experience-model.js');
const R=await import('../app/experience-runtime.js');
const {createSceneCapabilities,capability}=await import('../app/experience-capabilities.js');
const {S,ctx}=await import('../app/state.js');
const nav=await import('../app/navigation.js');
const T=await import('../app/tasks.js');
const E=await import('../app/experience.js');
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
function fixture(){const e=M.createExperience(),c=M.createCamera(),scene=createSceneCapabilities();M.clearExperience(e);const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});const a=M.addStop(e,p),b=M.addStop(e,q);return {e,c,scene,p,q,a,b};}
const run=f=>R.startGuide(f.e,f.c,R.createRuntime(f.e,f.c,null,pose,f.scene),f.scene);
const tick=(f,r,t)=>R.tickRuntime(f.e,f.c,r,t,f.scene);
const next=(f,r)=>R.nextRuntime(f.e,f.c,r,f.scene);
const control=(f,sid,cid,value,pid=f.p)=>M.addContribution(f.e,pid,{kind:'control',name:cid,subjectId:sid,capabilityId:cid,value});
const narration=(f,duration=10,pid=f.p)=>M.addContribution(f.e,pid,{kind:'narration',name:'Explanation',text:'First passage. Later passage. Final passage.',duration,markers:[]},'narration');
// Experience-scoped narration with one named phrase at 2s, used by the cue/scope cases.
const addContrib=(f,pid)=>M.addContribution(f.e,pid,{kind:'narration',name:'Intro',text:'Welcome. The rotor turns.',duration:10,markers:[{id:'turn',label:'Turn',time:2}]},'narration');
// A minimal Stage adapter plus a real Camera reading: selection touches the real action layer, while
// the assertion is about the writer context and the preserved viewpoint, never about rendering.
function liveFixture(){
 E.initExperience();
 const cam={target:{x:0,y:1,z:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}},az:.7,el:.3,frameH:8,flat:0,mirror:false};
 ctx.stage={items:new Map(),d:()=>({}),restyle(){},cam,camState:()=>({az:cam.az,el:cam.el,frameH:cam.frameH,flat:cam.flat,mirror:cam.mirror,target:{x:cam.target.x,y:cam.target.y,z:cam.target.z}})};
 const e=ctx.experience,c=ctx.cameraSource;
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 const from=M.addView(e,c,p,pose,'From','entry'),to=M.addView(e,c,q,pose,'To','entry');
 const a=M.addStop(e,p),b=M.addStop(e,q);
 const route=M.addConnection(c,e.uses[from].viewId,e.uses[to].viewId);
 return {e,c,p,q,a,b,route,cam};
}
test('P1 selecting another Stop ends the route writer; later Stage clicks cannot touch the old route',()=>{
 const {c,a,b,route,cam}=liveFixture();
 E.openSeam(a,b);
 S.task.params.connection=route;S.experienceContext.depth='route';
 const anchors=c.connections[route].anchors.length;
 nav.beginReturn('Return to Seam reading');
 cam.az=1.2; // the route writer framed the route away from the captured reading
 E.selectStop(b);
 assert.equal(S.experienceContext.depth,'overview');
 assert.equal(S.experienceContext.seam,null);
 assert.equal(S.experienceContext.stop,null);
 assert.equal(S.experienceContext.presentation,ctx.experience.stops[b].presentationId);
 assert.equal(S.task.kind,'experience-overview');
 assert.equal(nav.plainPose().az,1.2); // viewpoint preserved: the writer never restores its capture
 assert.equal(E.routePoint({x:3,z:4}),false);
 assert.equal(c.connections[route].anchors.length,anchors);
 // Even a writer-shaped context never edits an old route once the task has moved on.
 S.experienceContext={...S.experienceContext,depth:'route',seam:{from:a,to:b}};
 T.begin({kind:'experience-overview',subject:b,params:{connection:route}});
 assert.equal(E.routePoint({x:5,z:6}),false);
 assert.equal(c.connections[route].anchors.length,anchors);
});
test('P2 a primary explanation keeps its binding when its organizational home moves',()=>{
 const f=fixture();
 const first=M.setPrimaryExplanation(f.e,f.p,'The casing protects the rotor.');
 assert.equal(first.created,true);
 const useId=first.id;
 f.e.uses[useId].presentationId=f.q; // regrouping writes only the organizational home
 assert.equal(M.presentationUses(f.e,f.p).length,0);
 assert.equal(M.primaryExplanation(f.e,f.p)?.id,useId);
 assert.equal(M.primaryExplanation(f.e,f.q),null);
 const again=M.setPrimaryExplanation(f.e,f.p,'The casing protects the moving rotor.');
 assert.equal(again.id,useId);assert.equal(again.created,false);
 assert.equal(f.e.definitions[f.e.uses[useId].definitionId].text,'The casing protects the moving rotor.');
 assert.equal(Object.values(f.e.uses).filter(u=>f.e.definitions[u.definitionId]?.kind==='narration').length,1);
 assert.equal(f.e.uses[useId].presentationId,f.q); // organizational home is untouched by the edit
 assert.equal(M.isPrimaryExplanation(f.e,f.p,f.e.uses[useId]),true);
 assert.equal(M.isPrimaryExplanation(f.e,f.q,f.e.uses[useId]),false);
});
test('P3 Experience-start narration keeps captions and View cues through a later visit',()=>{
 const f=fixture();
 const n=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome. The rotor turns.',duration:10,markers:[{id:'turn',label:'Turn',time:2}]},'narration');
 M.addView(f.e,f.c,f.p,pose,'Entry','entry');
 const cue=M.addView(f.e,f.c,f.p,{...pose,target:[7,1,0]},'Turn view');
 f.e.uses[cue].cue={useId:n,signal:'marker:turn'};
 let r=run(f);
 assert.equal(r.stopId,f.a);
 assert.ok(r.visit>0);
 r=tick(f,r,2.1);
 assert.equal(r.activities[r.active[n]].visit,0);
 assert.match(R.narrationCaption(f.e,r),/Welcome/);
 assert.equal(r.viewUseId,cue);
});
test('P3 an Experience-scoped signal never satisfies a later visit Gate and the instruction stays repairable',()=>{
 const f=fixture();
 const n=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome to the hall.',duration:4,markers:[]},'narration');
 f.e.stops[f.a].gate={useId:n,signal:'complete'};
 const issues=M.stopConditionIssues(f.e,f.scene,f.a);
 assert.ok(issues.some(i=>i.condition==='Gate'&&/scope/i.test(i.message)));
 let r=run(f);
 r=tick(f,r,4.1);
 assert.equal(r.activities[r.active[n]].status,'complete');
 assert.equal(r.signals[`0|${n}|complete`],true); // the emit is real, keyed to its own visit
 assert.equal(R.signalEmitted(r,{useId:n,signal:'complete'}),false);
 const gate=R.gateState(f.e,f.c,r);
 assert.equal(gate.allowed,false);
 assert.match(gate.reason,/repair/i);
});
test('P4 completed Experience work adds no wait to a later empty Stop; unfinished work counts its remainder',()=>{
 const f=fixture();
 const n=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome. Watch the rotor.',duration:30,markers:[]},'narration');
 let r=R.createRuntime(f.e,f.c,null,pose,f.scene);
 r=tick(f,r,30);
 assert.equal(r.activities[r.active[n]].status,'complete');
 r=R.startGuide(f.e,f.c,r,f.scene);
 assert.ok(r.readiness<=2+1e-9,`completed work still delays Auto: ${r.readiness}`);
 r.autoplay=true;r=tick(f,r,2.1);
 assert.equal(r.stopId,f.b);
 const g=fixture();
 const gn=M.addContribution(g.e,null,{kind:'narration',name:'Intro',text:'Welcome. Watch the rotor.',duration:30,markers:[]},'narration');
 let gr=R.createRuntime(g.e,g.c,null,pose,g.scene);gr=R.tickRuntime(g.e,g.c,gr,20,g.scene);
 gr=R.startGuide(g.e,g.c,gr,g.scene);
 assert.ok(Math.abs(gr.readiness-12)<1e-6,`remaining work misread: ${gr.readiness}`);
 gr.autoplay=true;gr=tick(g,gr,11.9);assert.equal(gr.stopId,g.a);
 gr=tick(g,gr,.2);assert.equal(gr.stopId,g.b);
});
test('P4 Auto waits for a live Camera move instead of interrupting it',()=>{
 const f=fixture();
 const far=M.addView(f.e,f.c,f.p,{...pose,target:[45,1,0]},'Far');
 let r=run(f);
 assert.equal(r.stopId,f.a);
 r=R.lookRuntime(f.e,f.c,r,far);
 const duration=r.movement.duration;
 assert.ok(duration>3.5,`expected a long move, got ${duration}`);
 r.autoplay=true;
 r=tick(f,r,3.5);
 assert.equal(r.stopId,f.a);assert.ok(r.movement);
 r=tick(f,r,duration);
 assert.equal(r.movement,null);
 r=tick(f,r,.2);
 assert.equal(r.stopId,f.b);
});
test('P4 enabling Auto keeps the Stop remaining-work clock',()=>{
 const f=fixture();
 narration(f,10);
 let r=run(f);r=tick(f,r,4);
 const readiness=r.readiness;
 r=R.autoRuntime(f.e,r);
 assert.equal(r.autoplay,true);
 assert.equal(r.elapsed,4);
 assert.equal(r.readiness,readiness);
 r=tick(f,r,7.9);assert.equal(r.stopId,f.a);
 r=tick(f,r,.2);assert.equal(r.stopId,f.b);
});
test('P5 a visit-local dependency in another scope is repairable unavailable work, never an endless wait',()=>{
 const f=fixture();
 const n=narration(f,10);
 const id=control(f,'machine','rotor',true,f.q);
 f.e.uses[id].start={kind:'after',useId:n,signal:'complete',scope:'visit',presentationId:f.q};
 const issue=M.contributionIssues(f.e,f.c,f.scene,capability).find(i=>i.id===id);
 assert.match(issue.message,/scope/i);
 let r=run(f);
 assert.equal(r.active[id],undefined);
 r=next(f,r);
 assert.equal(r.activities[r.active[id]].status,'unavailable');
 r=tick(f,r,20);
 assert.equal(r.activities[r.active[id]].status,'unavailable');
 assert.equal(f.e.uses[id].start.useId,n); // the impossible instruction is retained for repair
 const g=fixture();const gn=narration(g,10);const gid=control(g,'machine','rotor',true,g.p);
 g.e.uses[gid].start={kind:'after',useId:gn,signal:'complete',scope:'visit',presentationId:g.p};
 assert.equal(M.contributionIssues(g.e,g.c,g.scene,capability).find(i=>i.id===gid),undefined);
 const gr=run(g);
 assert.equal(gr.activities[gr.active[gid]].status,'waiting');
});
test('P5 a View cue that can never fire is repairable and never delays the plan',()=>{
 const f=fixture();
 const n=narration(f,10);
 const wrong=M.addView(f.e,f.c,f.q,{...pose,target:[6,1,0]},'Wrong cue');
 f.e.uses[wrong].cue={useId:n,signal:'complete'};
 assert.ok(M.contributionIssues(f.e,f.c,f.scene,capability).some(i=>i.id===wrong&&/scope/i.test(i.message)));
 assert.deepEqual(R.presentationPlan(f.e,f.c,f.q,pose,null,null,f.scene).requests,[]);
 const right=M.addView(f.e,f.c,f.q,{...pose,target:[7,1,0]},'Right cue');
 const local=M.addContribution(f.e,f.q,{kind:'narration',name:'Local',text:'Local explanation.',duration:5,markers:[]},'narration');
 f.e.uses[right].cue={useId:local,signal:'complete'};
 const plan=R.presentationPlan(f.e,f.c,f.q,pose,null,null,f.scene);
 assert.ok(plan.requests.some(req=>req.id===right&&req.at===5));
});
test('P1 a station invocation replaces the Activity trigger: it never runs on entry and runs exactly once at the station',()=>{
 const f=fixture();
 const u=M.addView(f.e,f.c,f.p,pose,'From','entry'),v=M.addView(f.e,f.c,f.q,{...pose,target:[10,1,0]},'To','entry');
 const route=M.addConnection(f.c,f.e.uses[u].viewId,f.e.uses[v].viewId);
 const work=control(f,'light','intensity',4,null); // armed at Experience start before the binding
 M.editSeam(f.e,f.a,f.b,{mode:'travel'});
 const beat=M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'departure',work,f.scene);
 const seam=f.e.seams[`${f.a}>${f.b}`];
 assert.equal(f.e.uses[work].start.kind,'station');
 assert.deepEqual(f.e.uses[work].start.seam,{from:f.a,to:f.b});
 assert.equal(M.activationScope(f.e.uses[work]),f.q); // the destination visit is where it runs
 assert.equal(M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'departure',work,f.scene),beat); // idempotent
 assert.equal(seam.beats.filter(b=>b.useId===work).length,1);
 // One Activity is invoked by one station only; the second binding is refused, not layered on top.
 const other=M.addStop(f.e,f.p);
 M.editSeam(f.e,f.b,other,{});
 assert.throws(()=>M.addInvocationBeat(f.e,f.c,f.b,other,route,'departure',work,f.scene),/another|capture/i);
 // Entry amortization: the run exists once, at the station, and never again on the next tick.
 let r=run(f);
 assert.equal(r.stopId,f.a);
 assert.equal(r.active[work],undefined); // no entry trigger survives the binding
 assert.equal(R.projectedValue(f.scene,r,'light','intensity'),2);
 assert.equal(R.presentationPlan(f.e,f.c,f.p,pose,null,null,f.scene).requests.length,0); // not counted on entry
 r=next(f,r);
 const duration=r.movement.duration;
 assert.ok(duration>0);
 r=tick(f,r,duration);
 const token=r.active[work];
 assert.equal(typeof token,'string'); // invoked once by the traversed station
 assert.equal(r.movement,null);
 assert.equal(R.projectedValue(f.scene,r,'light','intensity'),4);
 r=tick(f,r,1);
 assert.equal(r.active[work],token); // and never again on the next tick
 assert.equal(Object.values(r.activities).filter(a=>a.useId===work).length,1);
 // Moving the trigger away in the Card leaves the beat behind: travelling must refuse locally rather
 // than run the work twice, and invoking here again restores the binding instead of adding a beat.
 f.e.uses[work].start={kind:'visit',presentationId:f.q}; // the Card's own writer
 assert.equal(M.contributionIssues(f.e,f.c,f.scene,capability).some(i=>i.id===work),false);
 const stale=R.startGuide(f.e,f.c,R.createRuntime(f.e,f.c,null,pose,f.scene),f.scene);
 const refused=R.nextRuntime(f.e,f.c,stale,f.scene);
 assert.equal(refused.stopId,f.a);
 assert.match(refused.refusal,/triggered elsewhere/i);
 assert.equal(M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'departure',work,f.scene),beat); // repair, not a duplicate
 assert.equal(seam.beats.filter(b=>b.useId===work).length,1);
 assert.equal(f.e.uses[work].start.kind,'station');
 assert.equal(R.nextRuntime(f.e,f.c,stale,f.scene).stopId,f.b);
});
test('P1 station invocation targets automatic work only: a visitor offer is never traversal work',()=>{
 const f=fixture();
 const u=M.addView(f.e,f.c,f.p,pose,'From','entry'),v=M.addView(f.e,f.c,f.q,{...pose,target:[10,1,0]},'To','entry');
 const route=M.addConnection(f.c,f.e.uses[u].viewId,f.e.uses[v].viewId);
 M.editSeam(f.e,f.a,f.b,{mode:'travel'});
 const offer=control(f,'piano','music',true,f.q);f.e.uses[offer].kind='interaction';
 // The same rule gates the model and the coordination picker: one authority, no surface-only filter.
 assert.match(M.invokableRefusal(f.e,f.scene,f.e.uses[offer]),/offer/i);
 assert.throws(()=>M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'departure',offer,f.scene),/offer/i);
 assert.equal(f.e.seams[`${f.a}>${f.b}`]?.beats?.length||0,0); // a refused binding authors nothing
 assert.equal(f.e.uses[offer].start.kind,'visit');            // and never moves the offer's own trigger
 const narration=addContrib(f,f.q);
 assert.equal(M.invokableRefusal(f.e,f.scene,f.e.uses[narration]),'');
 assert.equal(M.invokableRefusal(f.e,f.scene,f.e.uses[u]),'A Camera View is not an Activity');
 const unsupported=control(f,'machine','rotor',true,f.q);f.e.definitions[f.e.uses[unsupported].definitionId].capabilityId='gone';
 assert.match(M.invokableRefusal(f.e,f.scene,f.e.uses[unsupported]),/unavailable/i);
 assert.throws(()=>M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'departure',unsupported,f.scene),/unavailable/i);
 const id=M.addInvocationBeat(f.e,f.c,f.a,f.b,route,'arrival',narration,f.scene);
 assert.equal(f.e.seams[`${f.a}>${f.b}`].beats.find(b=>b.id===id).stationId,'arrival');
 // The invoked narration runs inside the destination visit and is captioned there, never earlier.
 let r=run(f);
 assert.equal(r.active[narration],undefined);
 r=next(f,r);
 const duration=r.movement.duration;
 r=tick(f,r,duration+1);
 assert.equal(r.activities[r.active[narration]].visit,r.visit);
 assert.match(R.narrationCaption(f.e,r),/Welcome|rotor/); // plan and transcript agree about the run
});
test('P3 a View cue driven by Experience-wide output is legitimate work, never an impossible scope',()=>{
 const f=fixture();
 const n=addContrib(f,null);
 M.addView(f.e,f.c,f.p,pose,'Entry','entry'); // a held entry viewpoint would suppress every cue
 const cue=M.addView(f.e,f.c,f.p,{...pose,target:[7,1,0]},'Turn view');
 f.e.uses[cue].cue={useId:n,signal:'marker:turn'};
 assert.equal(M.contributionIssues(f.e,f.c,f.scene,capability).some(i=>i.id===cue),false);
 const plan=R.presentationPlan(f.e,f.c,f.p,pose,null,null,f.scene);
 assert.ok(plan.requests.some(req=>req.id===cue&&req.at===2),JSON.stringify(plan.requests));
 // The Gate/pacing question is answered by the strict predicate instead: a later visit can never wait
 // for output that may already have finished.
 assert.equal(M.signalCanCuePresentation(f.e,{useId:n,signal:'marker:turn'},f.q),true);
 assert.equal(M.signalCanDriveVisitCondition(f.e,{useId:n,signal:'marker:turn'},f.q),false);
 f.e.stops[f.b].gate={useId:n,signal:'marker:turn'};
 assert.ok(M.stopConditionIssues(f.e,f.scene,f.b).some(i=>i.condition==='Gate'&&/scope/i.test(i.message)));
 let r=run(f);
 r=tick(f,r,2.1);
 assert.equal(r.viewUseId,cue); // runtime and plan agree about the same cue
});
test('P4 a stopped carried run and its disarmed dependents owe the next Stop no wait',()=>{
 const f=fixture();
 const n=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome. Watch the rotor.',duration:30,markers:[]},'narration');
 const rotor=M.addContribution(f.e,null,{kind:'control',name:'Rotor',subjectId:'machine',capabilityId:'rotor',value:true});
 f.e.uses[rotor].start={kind:'after',useId:n,signal:'complete',scope:'experience'};
 let r=R.createRuntime(f.e,f.c,null,pose,f.scene);
 r=tick(f,r,4);
 r=R.stopActivityRuntime(f.e,r,r.active[n]);
 assert.equal(r.activities[r.active[n]].status,'stopped');
 r=R.startGuide(f.e,f.c,r,f.scene);
 assert.ok(r.readiness<=2+1e-9,`stopped work still delays Auto: ${r.readiness}`);
 assert.equal(r.activities[r.active[rotor]].status,'stopped'); // disarmed with its dependency
 r.autoplay=true;r=tick(f,r,2.1);
 assert.equal(r.stopId,f.b);
});
test('P4 a carried dependency counts the remaining work once, never its own elapsed twice',()=>{
 const f=fixture();
 const n=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome. Watch the rotor.',duration:10,markers:[{id:'turn',label:'Turn',time:2}]},'narration');
 const music=M.addContribution(f.e,null,{kind:'control',name:'Music',subjectId:'piano',capabilityId:'music',value:true}); // 12s
 f.e.uses[music].start={kind:'after',useId:n,signal:'marker:turn',scope:'experience'};
 let r=R.createRuntime(f.e,f.c,null,pose,f.scene);
 r=tick(f,r,4); // the marker fired 2s ago; the playback is 2s in and finishes 10s from now
 assert.equal(r.activities[r.active[n]].elapsed,4);
 assert.equal(r.activities[r.active[music]].elapsed,2);
 r=R.startGuide(f.e,f.c,r,f.scene);
 assert.ok(Math.abs(r.readiness-12)<1e-6,`carried dependency misread: ${r.readiness}`);
 r.autoplay=true;r=tick(f,r,11.9);assert.equal(r.stopId,f.a);
 r=tick(f,r,.2);assert.equal(r.stopId,f.b);
});
test('P5 Gate and pacing scope mismatches are repairable Stop conditions; compatible refs still release them',()=>{
 const f=fixture();
 const intro=M.addContribution(f.e,null,{kind:'narration',name:'Intro',text:'Welcome to the hall.',duration:4,markers:[]},'narration');
 const local=narration(f,10);
 f.e.stops[f.a].gate={useId:intro,signal:'complete'};
 f.e.stops[f.b].pacing={kind:'signal',ref:{useId:intro,signal:'complete'}};
 assert.ok(M.stopConditionIssues(f.e,f.scene,f.a).some(i=>i.condition==='Gate'&&/scope/i.test(i.message)));
 assert.ok(M.stopConditionIssues(f.e,f.scene,f.b).some(i=>i.condition==='Pacing signal'&&/scope/i.test(i.message)));
 let r=run(f);
 assert.equal(R.gateState(f.e,f.c,r).allowed,false);
 assert.match(R.gateState(f.e,f.c,r).reason,/repair/i);
 f.e.stops[f.a].gate={useId:local,signal:'complete'};
 f.e.stops[f.b].pacing={kind:'auto'};
 assert.deepEqual(M.stopConditionIssues(f.e,f.scene,f.a),[]);
 assert.deepEqual(M.stopConditionIssues(f.e,f.scene,f.b),[]);
});
