// The C9.6–C9.9 review round's repairs, written against behaviour rather than shape:
//   * a merged rebind proposal stays behind the shared-edit Ask, and the Card reads the pending subject;
//   * replacing a descriptor keeps only a value the new capability can hold, and a repair is credited
//     only once the retained instruction resolves again;
//   * a choice whose destination left is repaired/removed locally, and a visit refuses it before parking;
//   * a declared-but-unrealized capability is refused by every writer that could run it;
//   * focusing a Hold addresses that Hold's own station, once;
//   * a quickstart topic is credited by every outcome its own instruction authors, not by any write, and
//     a Presentation's framing is the author's only when they accepted it here;
//   * a Guide visit opens its ledger with the Stop it actually entered, arrives only where the Camera does,
//     and its own session records the entry policies it ran and the carried runs the visitor stopped;
//   * the capability-sequence and entry-policy topics read those runtime outcomes rather than configuration.
// Entry outcomes also survive batched stepping and diagnostic-journal eviction; Return resumes a visit
// without inventing a new entry policy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// The action layer reads the OS motion preference at import time; Node has no matchMedia.
globalThis.matchMedia ??= () => ({matches:false,addEventListener(){},removeEventListener(){}});
// Leaving a visit restores through the one command seam, whose caption update looks up #caption. The
// harness supplies the lookup; the assertions are about documents, history and selection, not pixels.
globalThis.document ??= {getElementById:()=>null};
const M=await import('../app/experience-model.js');
const R=await import('../app/experience-runtime.js');
const {capability,replaceProfile}=await import('../app/experience-capabilities.js');
const {createMuseum}=await import('../app/model.js');
const {S,ctx}=await import('../app/state.js');
const THREE=await import('three');
const E=await import('../app/experience.js');
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
// A minimal Stage adapter: the assertions are about authored documents and their writers, never rendering.
function liveFixture(){
 E.initExperience();
 S.visitor=null;S.expAudition=null;S.expRebindAsk=null;S.expOfferDraft=null;S.expCaptureAsk=null;
 E.reviewSource('none');
 ctx.museum=createMuseum();
 const cam={target:{x:0,y:1,z:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}},az:.7,el:.3,frameH:8,flat:0,mirror:false};
 const camera=new THREE.PerspectiveCamera(48,1.6,.1,200);camera.position.set(0,8,14);camera.lookAt(new THREE.Vector3(0,1,0));
 ctx.stage={items:new Map(),d:()=>({}),restyle(){},w:1440,h:900,camera,cam,camState:()=>({az:cam.az,el:cam.el,frameH:cam.frameH,flat:cam.flat,mirror:cam.mirror,target:{x:cam.target.x,y:cam.target.y,z:cam.target.z}})};
 return {e:ctx.experience,c:ctx.cameraSource,scene:ctx.sceneSource};
}
const definitionOf=(e,id)=>e.definitions[e.uses[id].definitionId];

test('a merged rebind proposal waits for the shared-edit acceptance and the Card reads it',()=>{
 const {e}=liveFixture();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 // Two offers reading one definition: the reach the Ask must disclose.
 const first=M.addContribution(e,null,{kind:'control',name:'Listen inside',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');
 const twin=M.duplicateContribution(e,first);
 M.linkDefinition(e,twin,definitionOf(e,first).id);
 assert.equal(definitionOf(e,first).subjectId,'piano');
 assert.equal(E.rebindContributionCommand(first,{subjectId:'light'})!==false,true);
 const ask=S.expRebindAsk;
 assert.equal(ask.reach.length,2);
 assert.equal(ask.patch.subjectId,'light');
 assert.equal(definitionOf(e,first).subjectId,'piano');          // nothing written yet
 // The next change is the offer's own activation, which touches no definition field by itself. The whole
 // merged proposal still reaches a linked definition, so it is disclosed and not silently written.
 assert.equal(E.rebindContributionCommand(first,{triggerSubjectId:'switch'})!==false,true);
 assert.equal(definitionOf(e,first).subjectId,'piano');
 assert.equal(e.uses[first].triggerSubjectId,'piano');
 assert.equal(S.expRebindAsk.patch.subjectId,'light');           // the pending edit is still carried
 assert.equal(S.expRebindAsk.patch.triggerSubjectId,'switch');
 // The Card's controls render the proposal, so the second choice can still be made in this scope decision.
 assert.deepEqual(E.pendingDescriptor(first,definitionOf(e,first)),{subjectId:'light',capabilityId:'music'});
 assert.equal(E.acceptRebind('shared')!==false,true);
 assert.equal(definitionOf(e,first).subjectId,'light');
 assert.equal(e.uses[first].triggerSubjectId,'switch');
 assert.equal(e.uses[twin].definitionId,e.uses[first].definitionId);
 assert.equal(S.expRebindAsk,null);
});

test('a descriptor replacement adapts the value it keeps and credits repair only once it resolves',()=>{
 const {e,scene}=liveFixture();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const run=M.addContribution(e,p,{kind:'control',name:'Run rotor',subjectId:'machine',capabilityId:'rotor',value:true});
 assert.equal(E.replaceProfileCommand('machine','machineBase')!==false,true);
 assert.equal(E.review().loss.lost.includes('rotor'),true);
 assert.equal(E.rebindContributionCommand(run,{capabilityId:'casing'})!==false,true);
 const repaired=definitionOf(e,run);
 assert.equal(repaired.capabilityId,'casing');
 assert.equal(repaired.value,1);                                  // a toggle's "on" in a 0..1 range domain
 assert.equal(E.review().repair.id,run);
 assert.equal(E.review().repair.restored,true);
 // A replacement that leaves the descriptor unresolved is real authoring, but never a credited repair.
 const other=M.addContribution(e,p,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:0});
 const credited=JSON.stringify(E.review().repair);
 assert.equal(E.rebindContributionCommand(other,{capabilityId:'music'})!==false,true);
 assert.equal(definitionOf(e,other).capabilityId,'music');
 assert.equal(JSON.stringify(E.review().repair),credited);
 assert.equal(!!capability(scene,'machine','music'),false);
});

test('an unrealized capability is refused by every writer that could run it',()=>{
 const {e,c,scene}=liveFixture();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['mesh']});
 assert.equal(replaceProfile(scene,'mesh','meshAnnotated'),'meshAnnotated');
 assert.equal(capability(scene,'mesh','annotate').realized,false);
 // Offer creation opens on a capability this Stage realizes, and refuses the declared-but-unrealized one.
 E.beginOffer('interaction','mesh');
 assert.equal(S.expOfferDraft.capabilityId,'emphasis');
 S.expOfferDraft.capabilityId='annotate';
 const authored=Object.keys(e.uses).length;
 assert.equal(E.acceptOffer(),false);
 assert.equal(Object.keys(e.uses).length,authored);
 // Capture and rebind refuse it too, so no authored descriptor can name it.
 assert.equal(E.useCapability('mesh','annotate'),false);
 const highlight=M.addContribution(e,p,{kind:'control',name:'Highlight',subjectId:'mesh',capabilityId:'emphasis',value:true});
 assert.equal(E.rebindContributionCommand(highlight,{capabilityId:'annotate'}),false);
 assert.equal(definitionOf(e,highlight).capabilityId,'emphasis');
 // A retained binding is never run: a station may not invoke it, and the runtime reports it unavailable
 // instead of completing work this Stage cannot realize.
 const annotated=M.addContribution(e,p,{kind:'control',name:'Annotate',subjectId:'mesh',capabilityId:'annotate',value:true});
 assert.match(M.invokableRefusal(e,scene,e.uses[annotated]),/not realized/);
 const r=R.createRuntime(e,c,p,pose,scene);
 const activity=r.activities[r.active[annotated]];
 assert.equal(activity.status,'unavailable');
 assert.equal(activity.reason,'Capability not realized by this Stage');
});

test('a retained choice is repaired and removed locally, and a visit refuses it before parking',()=>{
 const {e,c,scene}=liveFixture();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const q=M.addPresentation(e,{kind:'environment'},'Detour moment');
 const narration=M.addContribution(e,p,{kind:'narration',name:'Explanation',text:'One. Two.',duration:10},'narration');
 const a=M.addStop(e,p),b=M.addStop(e,q),spare=M.addStop(e,p);
 const choice={id:'choice-1',label:'See the detour',targetId:b,kind:'detour'};
 e.stops[a].choices.push(choice);
 let r=R.startGuide(e,c,R.createRuntime(e,c,null,pose,scene),scene);
 assert.equal(r.stopId,a);
 assert.equal(r.activities[r.active[narration]].status,'running');
 // The destination leaves with its Presentation: Preview refuses it before parking the parent, so the
 // visitor keeps their Stop, their run and their bookmark list.
 M.removePresentation(e,q);
 const refused=R.chooseRuntime(e,c,r,b,true,scene);
 assert.equal(refused.stopId,a);
 assert.equal(refused.bookmarks.length,0);
 assert.equal(refused.activities[refused.active[narration]].status,'running');
 assert.match(refused.refusal,/repair/);
 assert.equal(M.choiceTarget(e,choice).missing,true);
 // The authored choice itself is repaired in place, then removed — each one committed transaction.
 const writes=S.expReview.writes;
 assert.equal(E.choiceRepointCommand(a,choice.id,spare)!==false,true);
 assert.deepEqual(M.choiceTarget(e,e.stops[a].choices[0]),{missing:false,id:spare,name:e.stops[spare].name,at:e.guide.indexOf(spare)});
 assert.equal(E.review().writes,writes+1);
 assert.equal(E.choiceRemoveCommand(a,choice.id)!==false,true);
 assert.equal(e.stops[a].choices.length,0);
 assert.equal(E.review().writes,writes+2);
});

test('focusing a Hold addresses that Hold own station, exactly once',()=>{
 const {e,c}=liveFixture();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const q=M.addPresentation(e,{kind:'subjects',ids:['mesh']});
 const from=M.addView(e,c,p,pose,'From','entry'),to=M.addView(e,c,q,pose,'To','entry');
 const a=M.addStop(e,p),b=M.addStop(e,q);
 const route=M.addConnection(c,e.uses[from].viewId,e.uses[to].viewId);
 const anchor=M.addAnchor(c,route,[5,1,0]);
 const marker=M.fresh(c,'marker');
 c.connections[route].markers.push({id:marker,name:'Power station',progress:.5});
 M.editSeam(e,a,b,{mode:'travel'});
 const hold=M.addBeat(e,c,a,b,route,anchor,2);
 // The author had selected the invocation's station a moment earlier; focusing the Hold moves the whole
 // coordination reading onto that Hold's own station.
 S.experienceContext.seam={from:a,to:b};
 S.task={kind:'experience-coordination',subject:a,params:{connection:route,station:marker}};
 assert.equal(E.focusHoldBeat(hold),true);
 assert.equal(S.task.params.beat,hold);
 assert.equal(S.task.params.station,anchor);
 assert.equal(E.review().coordination.eventFocused,true);
 // A focus that already matches its own beat is not new work, so it rerenders nothing and records nothing.
 E.review({coordination:null});
 assert.equal(E.focusHoldBeat(hold),false);
 assert.equal(E.review().coordination,null);
 assert.equal(E.focusHoldBeat('beat-missing'),false);
});

const step=(title)=>E.presenterSteps().find(s=>s.title.startsWith(title));
const credit=(title)=>E.presenterCredit(step(title)).credited;

test('the standalone walkthrough topic requires a standalone Preview, not a Guide visit',async()=>{
 liveFixture();const loaded=E.loadExample();
 E.explainPresentation(loaded.presentation,'The casing protects the rotor.');
 E.previewGuide();E.stepVisitor(6);await E.exitPreview();
 assert.ok(E.review().visit.narration>=1&&E.review().visit.framing&&E.review().visit.controls>=1);
 assert.equal(credit('Q4'),false);
 E.preview(loaded.presentation);E.stepVisitor(6);await E.exitPreview();
 assert.equal(credit('Q4'),true);
});

test('the second-Presentation walkthrough topic cannot be earned with repeated Stops of one moment',()=>{
 const {e}=liveFixture();
 const first=E.present({kind:'subjects',ids:['machine']});
 E.addToGuide(first);const secondStop=E.addToGuide(first);
 assert.equal(e.guide.length,2);
 assert.equal(credit('Q6'),false);
 const second=E.present({kind:'subjects',ids:['piano']});
 E.updateStop(secondStop,'presentationId',second);
 assert.equal(credit('Q6'),true);
});

test('a quickstart topic names every outcome its instruction produces, not any one of them',()=>{
 const {e}=liveFixture();
 const loaded=E.loadExample();
 const main=loaded.presentation;
 const q2=step('Q2');
 assert.equal(E.presenterCredit(q2).seen,true);                  // the loaded example has both outcomes on screen
 assert.equal(E.presenterCredit(q2).credited,false);             // but neither was authored here
 // An unrelated authored edit is real work — counted, and Undoable — and still does not complete this topic.
 assert.equal(E.renamePresentationById(main,'Renamed example')!==false,true);
 assert.equal(E.presenterSource().writes,1);
 assert.equal(e.presentations[main].name,'Renamed example');
 assert.equal(E.presenterCredit(q2).credited,false);
 // The explanation is one of the two outcomes the instruction authors; on its own it is not the topic.
 assert.equal(E.explainPresentation(main,'The casing protects the rotor.')!==false,true);
 assert.equal(E.presenterCredit(q2).credited,false);
 assert.equal(E.presenterCredit(q2).seen,true);
 assert.equal(E.presenterCredit(q2).seen,true);
 // The framing outcome the same instruction names — an explicit Capture — is what completes it here.
 assert.equal(E.captureView(main)!==false,true);
 assert.equal(E.presenterCredit(q2).credited,true);
 assert.equal(E.presenterSource().writes,3);
 // Both halves are read from the moment the aid is on: framing accepted elsewhere is not its framing.
 E.present({kind:'environment'});
 assert.equal(E.presenterCredit(q2).seen,false);
 // An advanced topic may be reviewed on explicitly loaded content, and says so.
 assert.equal(E.presenterCredit({family:'A',title:'A synthetic',done:()=>true}).credited,true);
 // A quickstart topic naming no authored outcome is credited only by real authorship in this session.
 assert.equal(E.presenterCredit({family:'Q',title:'Q synthetic',authored:['capture'],done:()=>true}).credited,false);
});

test('the framing a topic asks for belongs to the moment it was accepted in, through either authored door',()=>{
 const {e,c}=liveFixture();
 const loaded=E.loadExample();
 // Two moments, each explained here: the loaded one is framed by the loader, the author's own has no
 // framing at all until this session accepts one. Only the moment on screen is what the topic assesses.
 const first=loaded.presentation;
 E.explainPresentation(first,'The casing protects the rotor.');
 const second=E.present({kind:'subjects',ids:['piano']});
 E.explainPresentation(second,'Listen to the piano.');
 const q2=step('Q2');
 assert.equal(E.presenterCredit(q2).credited,false);           // no framing has been accepted here at all
 assert.equal(E.captureView(second)!==false,true);             // the instruction's own door, on this moment
 assert.equal(E.presenterCredit(q2).credited,true);
 // It stays that moment's: the loaded moment is explained here and its framing came with the document, and
 // neither one is a framing this session accepted on it.
 assert.equal(E.openPresentation(first),true);
 assert.equal(E.presenterCredit(q2).seen,true);
 assert.equal(E.presenterCredit(q2).credited,false);
 // Reusing an existing Camera View is the author's other door for accepting a framing, and it counts the same.
 const shared=M.addView(e,c,second,{...pose,target:[6,1,0]},'Shared framing','choice');
 assert.equal(E.reuseFraming(first,e.uses[shared].viewId)!==false,true);
 assert.equal(E.presenterCredit(q2).credited,true);
});

test('a Guide visit opens its ledger with the Stop it entered and arrives where the Camera does',()=>{
 const {e}=liveFixture();
 E.loadExample();
 const first=e.guide[0],second=e.guide[1];
 assert.equal(E.previewGuide(),true);
 assert.deepEqual(E.review().visitor.stops,[first]);
 assert.equal(E.presenterCredit(step('A4')).credited,false);      // configured routes are not a journey
 assert.equal(E.visitorCommand('next'),true);
 assert.deepEqual(E.review().visitor.stops,[first,second]);
 // The Stop is entered while the Camera is still flying: entering it is not the arrival, and no journey is
 // credited from the request. Only the Camera's own arrival at the destination entry View completes it.
 assert.equal(E.review().visitor.traversed.from,first);
 assert.equal(E.review().visitor.traversed.to,second);
 assert.equal(E.review().visitor.traversed.arrived,false);
 assert.equal(E.review().visitor.travelArrivals,0);
 assert.equal(E.presenterCredit(step('Q7')).seen,false);
 assert.equal(E.presenterCredit(step('A4')).credited,false);
 E.stepVisitor(6);
 assert.equal(E.review().visitor.traversed.arrived,true);
 assert.equal(E.review().visitor.traversed.travel,true);          // the Seam's own route produced it
 assert.equal(E.review().visitor.travelArrivals,1);
 assert.equal(E.presenterCredit(step('Q7')).seen,true);
 assert.equal(E.presenterCredit(step('Q7')).credited,false);      // the loaded example's Guide is not authored here
 assert.equal(E.presenterCredit(step('A4')).credited,true);
});

test('the capability-sequence topic needs the handover and the carried run the visitor stopped',async()=>{
 const {e}=liveFixture();
 E.loadExample();
 const rotor=Object.values(e.uses).find(u=>e.definitions[u.definitionId]?.capabilityId==='rotor');
 const live=()=>S.visitor.runtime.active[rotor.id]&&S.visitor.runtime.activities[S.visitor.runtime.active[rotor.id]].status;
 assert.equal(credit('A2'),false);
 assert.equal(E.previewGuide(),true);
 E.stepVisitor(6);                                                // the casing completes and hands over
 assert.equal(live(),'running');
 assert.equal(credit('A2'),false);
 await E.exitPreview();
 // The visit really finished a capability and handed over to its dependent — and the topic still is not
 // earned, because nothing carried was stopped by the visitor.
 assert.ok(E.review().visit.completed>=1);                       // a finite capability ran to its end
 assert.equal(E.review().visit.handoffs,1);                      // and its one dependent really began
 assert.equal(credit('A2'),false);
 assert.equal(E.previewGuide(),true);
 E.stepVisitor(6);
 assert.equal(E.visitorCommand('stop',S.visitor.runtime.active[rotor.id]),true);
 assert.equal(live(),'stopped');
 assert.equal(E.review().visitor.stopped.length,1);
 assert.equal(E.review().visitor.stopped[0].carried,true);        // its authored lifetime is the Experience
 await E.exitPreview();
 const handoff=E.review().visit.handoffRuns[0];
 assert.equal(handoff.fromUseId,rotor.start.useId);
 assert.equal(handoff.toUseId,rotor.id);
 assert.equal(handoff.toRun,E.review().visitor.stopped[0].token);
 assert.equal(credit('A2'),true);
});

test('a capability handover plus an unrelated carried Stop never completes the sequence',async()=>{
 const {e}=liveFixture();E.loadExample();
 const pid=e.stops[e.guide[0]].presentationId;
 const piano=M.addContribution(e,pid,{kind:'control',name:'Unrelated carried music',subjectId:'piano',capabilityId:'music',value:true});
 e.uses[piano].end={kind:'experience'};
 E.previewGuide();E.stepVisitor(6);
 assert.equal(S.visitor.runtime.activities[S.visitor.runtime.active[piano]].status,'running');
 E.visitorCommand('stop',S.visitor.runtime.active[piano]);await E.exitPreview();
 assert.equal(E.review().visit.handoffs,1);
 assert.ok(E.review().visit.completed>=1);
 assert.equal(E.review().visitor.stopped[0].carried,true);
 assert.equal(E.review().visitor.stopped[0].useId,piano);
 assert.notEqual(E.review().visit.handoffRuns[0].toUseId,piano);
 assert.equal(credit('A2'),false);
});

test('the sequence Stop must match the dependent run, even when the use identity matches',async()=>{
 const {e}=liveFixture();E.loadExample();
 const rotor=Object.values(e.uses).find(u=>e.definitions[u.definitionId]?.capabilityId==='rotor');
 E.previewGuide();E.stepVisitor(6);
 E.visitorCommand('stop',S.visitor.runtime.active[rotor.id]);await E.exitPreview();
 assert.equal(credit('A2'),true);
 // A retained Stop from another run of this same use cannot borrow the observed handover.
 E.review().visitor.stopped[0].token='another-visit/run';
 assert.equal(credit('A2'),false);
});

test('a capability sequence counts a handover only when the dependent really began',async()=>{
 const {e}=liveFixture();
 E.loadExample();
 assert.equal(credit('A2'),false);
 assert.equal(E.previewGuide(),true);
 // Leaving the Stop before its finite operation completes disarms the dependent: it is stopped as a
 // dependency the visit left behind, which is not a run that ever began, however the operation ends.
 assert.equal(E.visitorCommand('next'),true);
 E.stepVisitor(6);
 await E.exitPreview();
 assert.ok(E.review().visit.completed>=1);                       // the finite operation still ran to its end
 assert.equal(E.review().visit.handoffs,0);                      // and nothing dependent ever began
 assert.equal(credit('A2'),false);
});

test('an explanation finishing is not a capability completion handover',async()=>{
 const {e}=liveFixture();E.loadExample();
 const first=e.stops[e.guide[0]].presentationId;
 const telling=M.primaryExplanation(e,first);
 const rotor=Object.values(e.uses).find(u=>e.definitions[u.definitionId]?.capabilityId==='rotor');
 e.uses[rotor.id].start={...rotor.start,useId:telling.id,signal:'complete'};
 E.previewGuide();E.stepVisitor(20);
 assert.equal(S.visitor.runtime.activities[S.visitor.runtime.active[rotor.id]].status,'running');
 E.visitorCommand('stop',S.visitor.runtime.active[rotor.id]);await E.exitPreview();
 assert.ok(E.review().visit.completed>=1);
 assert.equal(E.review().visitor.stopped[0].carried,true);
 assert.equal(E.review().visit.handoffs,0);
 assert.equal(credit('A2'),false);
});

test('a Travel arrival survives the destination starting its own cue',()=>{
 const {e,c}=liveFixture();
 const machine=M.addPresentation(e,{kind:'subjects',ids:['machine']},'Machine');
 const entry=M.addView(e,c,machine,pose,'Machine entry','entry');
 const piano=M.addPresentation(e,{kind:'subjects',ids:['piano']},'Piano');
 M.addView(e,c,piano,{...pose,target:[12,1,0]},'Piano entry','entry');
 const other=M.addView(e,c,piano,{...pose,target:[16,1,0]},'Piano close-up','choice');
 // The destination's own explanation cues another View the moment it completes, so the Camera is asked
 // for a second movement in the same tick the Travel finished in.
 const telling=M.addContribution(e,piano,{kind:'narration',name:'Explanation',text:'Listen.',duration:1,markers:[]},'narration');
 e.uses[other].cue={useId:telling,signal:'complete'};
 const a=M.addStop(e,machine),b=M.addStop(e,piano);
 assert.ok(entry);
 M.prepareTravelSupport(e,c,a,b);
 M.editSeam(e,a,b,{mode:'travel'});
 assert.equal(E.previewGuide(),true);
 assert.equal(E.presenterCredit(step('A4')).credited,false);     // a configured route is not a journey
 assert.equal(E.visitorCommand('next'),true);
 E.stepVisitor(6);
 // The destination's cue really did take the Camera on afterwards, so the single last-arrival slot no longer
 // names the Travel: the arrival has to have been kept where the Camera made it.
 assert.equal(S.visitor.runtime.arrivedViewUseId,other);
 assert.equal(E.review().visitor.traversed.to,b);
 assert.equal(E.review().visitor.traversed.travel,true);         // the Seam's own route carried it
 assert.equal(E.review().visitor.traversed.arrived,true);        // and the Camera's own completion is read
 assert.equal(E.review().visitor.travelArrivals,1);
 assert.equal(E.presenterCredit(step('Q7')).seen,true);
 assert.equal(E.presenterCredit(step('A4')).credited,true);
});

test('a Stop reached by Auto is as real as one reached by Next',()=>{
 for(const seconds of [1,8]){
 const {e,c,scene}=liveFixture();
 const first=M.addPresentation(e,{kind:'subjects',ids:['machine']},'First');
 M.addView(e,c,first,pose,'First entry','entry');
 const second=M.addPresentation(e,{kind:'subjects',ids:['machine']},'Second');
 M.addView(e,c,second,{...pose,target:[10,1,0]},'Second entry','entry');
 const laterView=M.addView(e,c,second,{...pose,target:[14,1,0]},'Second later','choice');
 const third=M.addPresentation(e,{kind:'subjects',ids:['machine']},'Third');
 M.addView(e,c,third,{...pose,target:[20,1,0]},'Third entry','entry');
 M.addContribution(e,third,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});
 const a=M.addStop(e,first),b=M.addStop(e,second),h=M.addStop(e,third);
 e.stops[b].entry={kind:'use',useId:laterView};
 e.stops[h].entry={kind:'hold'};
 scene;
 assert.equal(E.previewGuide(),true);
 // Auto, not Next: the visit advances through the runtime's own tick, and every Stop it really entered —
 // and every entry policy it really ran — is read from there.
 assert.equal(E.visitorCommand('auto'),true);
 for(let i=0;i<8/seconds;i++)E.stepVisitor(seconds);
 assert.equal(E.review().visitor.at,h);
 assert.deepEqual(E.review().visitor.stops,[a,b,h]);
 assert.deepEqual(E.review().visitor.entries.map(x=>[x.kind,x.arrived,x.ran]),[['presentation',true,false],['use',true,false],['hold',true,true]]);
 assert.equal(E.review().visitor.traversed.from,b);
 assert.equal(E.review().visitor.traversed.to,h);
 assert.equal(credit('A3'),true);
 }
});

test('entry arrival survives more cues than the Camera diagnostic journal retains',()=>{
 const {e,c}=liveFixture();
 const first=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 M.addView(e,c,first,pose,'First entry','entry');
 const second=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 const target=M.addView(e,c,second,{...pose,target:[12,1,0]},'Destination entry','entry');
 const telling=M.addContribution(e,second,{kind:'narration',name:'Explanation',text:'Listen.',duration:1,markers:[]},'narration');
 for(let i=0;i<10;i++){
  const id=M.addView(e,c,second,{...pose,target:[13+i,1,0]},'Cued View '+i,'choice');
  c.views[e.uses[id].viewId].speed='cut';
  e.uses[id].cue={useId:telling,signal:'complete'};
 }
 const a=M.addStop(e,first),b=M.addStop(e,second);
 M.prepareTravelSupport(e,c,a,b);M.editSeam(e,a,b,{mode:'travel'});
 E.previewGuide();E.visitorCommand('next');E.stepVisitor(10);
 assert.equal(S.visitor.runtime.arrivals.some(x=>x.useId===target),false);
 assert.equal(S.visitor.runtime.travelArrivals,1);
 assert.equal(E.review().visitor.traversed.arrived,true);
 assert.equal(E.review().visitor.entries.find(x=>x.stopId===b).arrived,true);
 assert.equal(E.presenterCredit(step('Q7')).seen,true);
});

test('Return resumes its Stop without inventing another entry policy',()=>{
 const {e}=liveFixture();E.loadExample();E.previewGuide();
 const parent=e.guide[0],detour=e.stops[parent].choices[0].targetId;
 E.visitorCommand('detour',detour);E.stepVisitor(1);
 const entries=structuredClone(E.review().visitor.entries);
 E.visitorCommand('return');E.stepVisitor(6);
 assert.equal(S.visitor.runtime.stopId,parent);
 assert.deepEqual(E.review().visitor.entries,entries);
});

test('the Stop entry-policy topic reads the entries a visit ran, never the policies an author configured',()=>{
 const {e,c,scene}=liveFixture();
 const first=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 M.addView(e,c,first,pose,'Presentation entry','entry');
 const second=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 M.addView(e,c,second,{...pose,target:[10,1,0]},'Later entry','entry');
 const laterView=M.addView(e,c,second,{...pose,target:[14,1,0]},'Another View','choice');
 const third=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 M.addView(e,c,third,{...pose,target:[20,1,0]},'Held reading','entry');
 M.addContribution(e,third,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});
 const a=M.addStop(e,first),b=M.addStop(e,second),h=M.addStop(e,third);
 e.stops[b].entry={kind:'use',useId:laterView};                   // a specific later View of its own moment
 e.stops[h].entry={kind:'hold'};                                  // an explicit hold over running content
 scene;                                                            // the Scene source the runtime reads
 assert.equal(credit('A3'),false);                                // configured policies are not entries
 assert.equal(E.previewGuide(),true);
 assert.equal(E.review().visitor.entries.length,1);
 E.stepVisitor(1);
 assert.equal(E.visitorCommand('next'),true);
 E.stepVisitor(3);
 assert.equal(E.visitorCommand('next'),true);
 E.stepVisitor(.5);
 assert.deepEqual(E.review().visitor.entries.map(x=>[x.kind,x.arrived,x.ran]),[['presentation',true,false],['use',true,false],['hold',true,true]]);
 assert.equal(E.review().visitor.entries[1].later,true);
 assert.equal(credit('A3'),true);
 // Back to the Stop that holds the viewpoint: the same three policies are compared again, and a hold whose
 // Stop nobody entered is never counted.
 assert.equal(E.visitorCommand('back'),true);
 E.stepVisitor(1);
 assert.equal(credit('A3'),true);
 assert.equal(E.review().visitor.entries.filter(x=>x.kind==='hold').length,1);
});
