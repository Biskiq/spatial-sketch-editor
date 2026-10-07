// The C9.6–C9.9 review round's repairs, written against behaviour rather than shape:
//   * a merged rebind proposal stays behind the shared-edit Ask, and the Card reads the pending subject;
//   * replacing a descriptor keeps only a value the new capability can hold, and a repair is credited
//     only once the retained instruction resolves again;
//   * a choice whose destination left is repaired/removed locally, and a visit refuses it before parking;
//   * a declared-but-unrealized capability is refused by every writer that could run it;
//   * focusing a Hold addresses that Hold's own station, once;
//   * a quickstart topic is credited by the outcomes its own instruction authors, not by any write;
//   * a Guide visit opens its ledger with the Stop it actually entered.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// The action layer reads the OS motion preference at import time; Node has no matchMedia.
globalThis.matchMedia ??= () => ({matches:false,addEventListener(){},removeEventListener(){}});
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

test('a quickstart topic is credited by its own authored outcome, never by any write',()=>{
 const {e}=liveFixture();
 const loaded=E.loadExample();
 const main=loaded.presentation;
 const step=(title)=>E.presenterSteps().find(s=>s.title.startsWith(title));
 const q2=step('Q2');
 assert.equal(E.presenterCredit(q2).seen,true);                  // the loaded example satisfies the predicate
 assert.equal(E.presenterCredit(q2).credited,false);             // but its explanation came from the loader
 // An unrelated authored edit is real work — counted, and Undoable — and still does not complete this topic.
 assert.equal(E.renamePresentationById(main,'Renamed example')!==false,true);
 assert.equal(E.presenterSource().writes,1);
 assert.equal(e.presentations[main].name,'Renamed example');
 assert.equal(E.presenterCredit(q2).credited,false);
 // Writing the outcome this topic is about is what credits it.
 assert.equal(E.explainPresentation(main,'The casing protects the rotor.')!==false,true);
 assert.equal(E.presenterCredit(q2).credited,true);
 assert.equal(E.presenterSource().writes,2);
 // An advanced topic may be reviewed on explicitly loaded content, and says so.
 assert.equal(E.presenterCredit({family:'A',title:'A synthetic',done:()=>true}).credited,true);
 // A quickstart topic naming no authored outcome is credited only by real authorship in this session.
 assert.equal(E.presenterCredit({family:'Q',title:'Q synthetic',authored:['capture'],done:()=>true}).credited,false);
});

test('a Guide visit opens its ledger with the Stop it actually entered',()=>{
 const {e}=liveFixture();
 E.loadExample();
 const first=e.guide[0],second=e.guide[1];
 assert.equal(E.previewGuide(),true);
 assert.deepEqual(E.review().visitor.stops,[first]);
 assert.equal(E.visitorCommand('next'),true);
 assert.deepEqual(E.review().visitor.stops,[first,second]);
 assert.deepEqual(E.review().visitor.traversed,{from:first,to:second,arrived:true});
});
