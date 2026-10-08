import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/experience-model.js';
import * as R from '../app/experience-runtime.js';
import {createSceneCapabilities} from '../app/experience-capabilities.js';
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
function fixture(){const e=M.createExperience(),c=M.createCamera(),scene=createSceneCapabilities();M.clearExperience(e);const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});const a=M.addStop(e,p),b=M.addStop(e,q);return {e,c,scene,p,q,a,b};}
const run=f=>R.startGuide(f.e,f.c,R.createRuntime(f.e,f.c,null,pose,f.scene),f.scene);
const tick=(f,r,t)=>R.tickRuntime(f.e,f.c,r,t,f.scene);
const next=(f,r)=>R.nextRuntime(f.e,f.c,r,f.scene);
const control=(f,sid,cid,value,pid=f.p)=>M.addContribution(f.e,pid,{kind:'control',name:cid,subjectId:sid,capabilityId:cid,value});
const narration=(f,duration=10)=>M.addContribution(f.e,f.p,{kind:'narration',name:'Explanation',text:'First passage. Later passage. Final passage.',duration,markers:[]},'narration');
test('organization is independent of explicit activation and boundary',()=>{
 const f=fixture(),id=control(f,'light','intensity',3);f.e.uses[id].presentationId=f.q;
 let r=run(f);assert.equal(R.projectedValue(f.scene,r,'light','intensity'),3);
 r=next(f,r);assert.equal(R.projectedValue(f.scene,r,'light','intensity'),2);
 assert.equal(Object.values(r.activities).filter(a=>a.useId===id).length,1);
});
test('Finish after local departure releases its expired local result only after completion',()=>{
 const f=fixture(),id=control(f,'machine','casing',1);let r=tick(f,run(f),.5);const token=r.active[id];
 r=next(f,r);assert.equal(r.activities[token].status,'running');assert.ok(R.projectedValue(f.scene,r,'machine','open')>0);
 r=tick(f,r,1);assert.equal(r.activities[token].status,'complete');assert.equal(R.projectedValue(f.scene,r,'machine','open'),0);
});
test('Experience result retention survives Finish; waiting visit dependency cannot resurrect',()=>{
 const f=fixture(),open=control(f,'machine','casing',1),rotor=control(f,'machine','rotor',true);
 f.e.uses[open].retention={kind:'experience'};f.e.uses[rotor].start={kind:'after',useId:open,signal:'complete',scope:'visit',presentationId:f.p};f.e.uses[rotor].end={kind:'experience'};
 let r=run(f);const waiting=r.active[rotor];r=next(f,r);r=tick(f,r,2);
 assert.equal(R.projectedValue(f.scene,r,'machine','open'),1);assert.equal(r.activities[waiting].status,'stopped');assert.equal(R.projectedValue(f.scene,r,'machine','running'),false);
});
test('Experience-wide dependency remains armed across departure and starts once',()=>{
 const f=fixture(),open=control(f,'machine','casing',1),rotor=control(f,'machine','rotor',true);
 f.e.uses[open].retention={kind:'experience'};f.e.uses[rotor].start={kind:'after',useId:open,signal:'complete',scope:'experience',presentationId:null};f.e.uses[rotor].end={kind:'experience'};
 let r=run(f);const token=r.active[rotor];r=next(f,r);r=tick(f,r,2);
 assert.equal(r.activities[token].status,'running');assert.equal(R.projectedValue(f.scene,r,'machine','running'),true);
});
test('carried persistent run survives fresh repeated Stops without reissue while narration restarts',()=>{
 const f=fixture(),loop=control(f,'machine','rotor',true),n=narration(f);f.e.uses[loop].end={kind:'experience'};M.addStop(f.e,f.p);
 let r=run(f);const token=r.active[loop],oldNarration=r.active[n],visit=r.visit;r=next(f,r);r=next(f,r);
 assert.equal(r.active[loop],token);assert.notEqual(r.active[n],oldNarration);assert.notEqual(r.visit,visit);assert.equal(r.activities[r.active[n]].elapsed,0);
});
test('stale replacement cannot remove a newer owned result or signal a later visit',()=>{
 const f=fixture(),open=control(f,'machine','casing',1),replacement=control(f,'machine','casing',.2,f.q);
 let r=run(f);const stale=r.active[open];r=next(f,r);const current=r.active[replacement];r=R.completeRun(f.e,f.c,r,stale,f.scene);r=tick(f,r,2);
 assert.equal(r.overrides.machine.open.owner,current);assert.equal(R.projectedValue(f.scene,r,'machine','open'),.2);assert.equal(R.signalEmitted(r,{useId:open,signal:'complete'}),false);
});
test('explicit marker seconds survive explanation edits; invalid cues disable only affected work',()=>{
 const f=fixture(),n=narration(f),d=f.e.definitions[f.e.uses[n].definitionId];d.markers=[{id:'later',label:'Later passage',time:6}];
 const u=M.addView(f.e,f.c,f.p,{...pose,target:[4,1,0]},'Later');f.e.uses[u].cue={useId:n,signal:'marker:later'};
 assert.equal(M.cueSeconds(f.e,f.e.uses[u].cue),6);d.text='A revised explanation.';assert.equal(M.cueSeconds(f.e,f.e.uses[u].cue),6);
 d.duration=4;assert.equal(M.cueSeconds(f.e,f.e.uses[u].cue),null);assert.ok(M.contributionIssues(f.e,f.c,f.scene).some(i=>i.id===u&&/cue/i.test(i.message)));
 const id=control(f,'machine','rotor',true);f.e.uses[id].start={kind:'after',scope:'visit',presentationId:f.p,useId:n,signal:'marker:missing'};
 const r=run(f);assert.equal(r.activities[r.active[id]].status,'unavailable');assert.equal(R.projectedValue(f.scene,r,'machine','running'),false);
});
test('hold suppresses entry and all automatic cues but keeps narration/capabilities; explicit choice resumes',()=>{
 const f=fixture(),n=narration(f,4),entry=M.addView(f.e,f.c,f.p,{...pose,target:[2,1,0]},'Entry','entry'),cue=M.addView(f.e,f.c,f.p,{...pose,target:[8,1,0]},'Later');
 f.e.definitions[f.e.uses[n].definitionId].markers=[{id:'later',label:'Later',time:2}];f.e.uses[cue].cue={useId:n,signal:'marker:later'};f.e.stops[f.a].entry={kind:'hold'};
 let r=tick(f,run(f),2.5);assert.deepEqual(r.pose,pose);assert.equal(r.viewUseId,null);assert.equal(r.activities[r.active[n]].elapsed,2.5);
 r=R.lookRuntime(f.e,f.c,r,entry);assert.equal(r.viewUseId,entry);assert.equal(r.viewingSuppressed,false);
});
test('later entry suppresses earlier cue requests without seeking narration',()=>{
 const f=fixture(),n=narration(f,10);f.e.definitions[f.e.uses[n].definitionId].markers=[{id:'early',label:'Early',time:2},{id:'late',label:'Late',time:6},{id:'future',label:'Future',time:8}];
 const views=['early','late','future'].map((id,i)=>{const u=M.addView(f.e,f.c,f.p,{...pose,target:[i*4+2,1,0]},id);f.e.uses[u].cue={useId:n,signal:`marker:${id}`};return u;});f.e.stops[f.a].entry={kind:'use',useId:views[1]};
 let r=run(f);assert.equal(r.activities[r.active[n]].elapsed,0);r=tick(f,r,6.5);assert.equal(r.viewUseId,views[1]);r=tick(f,r,1.5);assert.equal(r.viewUseId,views[2]);
});
test('manual choice redirects current Camera evaluation without restarting visit; requested and arrived differ',()=>{
 const f=fixture(),n=narration(f),u=M.addView(f.e,f.c,f.p,{...pose,target:[25,1,0]},'Far'),v=M.addView(f.e,f.c,f.p,{...pose,target:[-10,1,0]},'Other');
 let r=run(f),visit=r.visit,token=r.active[n];r=R.lookRuntime(f.e,f.c,r,u);r=tick(f,r,.25);const live=structuredClone(r.pose);r=R.lookRuntime(f.e,f.c,r,v);
 assert.deepEqual(r.movement.path[0],live);assert.equal(r.viewUseId,v);assert.notEqual(r.arrivedViewUseId,v);assert.equal(r.queue.length,0);assert.equal(r.visit,visit);assert.equal(r.active[n],token);
});
test('Auto resolves current adapter work and activation, excluding hypothetical offers and organizational home',()=>{
 const f=fixture(),id=control(f,'machine','casing',1);f.e.uses[id].presentationId=f.q;const n=narration(f,4),loop=control(f,'machine','rotor',true);
 f.e.uses[loop].start={kind:'after',useId:n,signal:'complete',scope:'visit',presentationId:f.p};
 M.addContribution(f.e,f.p,{kind:'control',subjectId:'piano',capabilityId:'music',value:true},'interaction');
 assert.equal(R.estimatePresentation(f.e,f.c,f.p,pose,null,null,f.scene),6);
 f.scene.subjects.machine.profile='mesh';assert.equal(R.estimatePresentation(f.e,f.c,f.p,pose,null,null,f.scene),6);
 f.e.definitions[f.e.uses[n].definitionId].duration=1;assert.equal(R.estimatePresentation(f.e,f.c,f.p,pose,null,null,f.scene),3);
});
test('completion lifetime releases at completion; explicit Experience retention keeps state output',()=>{
 const f=fixture(),id=control(f,'light','intensity',4);f.e.uses[id].end={kind:'complete'};f.e.uses[id].retention={kind:'complete'};
 assert.equal(R.projectedValue(f.scene,run(f),'light','intensity'),2);f.e.uses[id].retention={kind:'experience'};assert.equal(R.projectedValue(f.scene,run(f),'light','intensity'),4);
});
test('a result boundary can name a later Presentation independently of its activation visit',()=>{
 const f=fixture(),id=control(f,'light','intensity',3);f.e.uses[id].retention={kind:'visit',presentationId:f.q};M.addStop(f.e,f.p);
 let r=run(f);r=next(f,r);assert.equal(R.projectedValue(f.scene,r,'light','intensity'),3);
 // Use a different third moment so a new activation does not mask the old cleanup.
 const third=M.addPresentation(f.e);f.e.stops[f.e.guide[2]].presentationId=third;
 r=next(f,r);assert.equal(R.projectedValue(f.scene,r,'light','intensity'),2);
});
test('zero-second phrase fires once on the session clock and honors Hold',()=>{
 const f=fixture(),n=narration(f),d=f.e.definitions[f.e.uses[n].definitionId];d.markers=[{id:'first',label:'First',time:0}];
 const id=control(f,'light','intensity',3);f.e.uses[id].start={kind:'after',scope:'visit',presentationId:f.p,useId:n,signal:'marker:first'};
 let r=tick(f,run(f),.1);assert.equal(R.projectedValue(f.scene,r,'light','intensity'),3);const token=r.active[id];r=tick(f,r,.1);assert.equal(r.active[id],token);
 const v=M.addView(f.e,f.c,f.p,{...pose,target:[4,1,0]},'First');f.e.uses[v].cue={useId:n,signal:'marker:first'};f.e.stops[f.a].entry={kind:'hold'};
 r=tick(f,run(f),.1);assert.deepEqual(r.pose,pose);assert.equal(r.viewUseId,null);
});
test('unsupported pacing signal does not silently fall back to Auto',()=>{
 const f=fixture();f.e.stops[f.a].pacing={kind:'signal',ref:{useId:'removed',signal:'complete'}};
 let r=run(f);r.autoplay=true;r=tick(f,r,20);assert.equal(r.stopId,f.a);
});
