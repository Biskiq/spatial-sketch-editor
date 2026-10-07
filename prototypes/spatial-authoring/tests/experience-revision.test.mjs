// C9.6 (useful revision and repair, J8) coverage, written against behavior rather than shape:
//   * rename / remove Presentation keep stable identity and preserve reusable definitions;
//   * removePresentation deletes only Experience-authored content and its own Stops, retains Camera Views
//     and dangling references as honest repair cases, and never promotes retained work to Experience start;
//   * remove / duplicate / make-local / link / rename / rebind are real identity-safe writers, so editing
//     one copy never mutates another and a linked definition is genuinely shared;
//   * the retained-contribution inventory lists a removed organizational home without resurrecting it;
//   * provider profile replacement gains and loses declared capabilities while keeping the instance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/experience-model.js';
import {createSceneCapabilities,capabilities,replaceProfile,profileOptions} from '../app/experience-capabilities.js';
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
const scene=()=>createSceneCapabilities();

test('C9.6 rename Presentation keeps identity and shared use',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']},'Old name');
 const u=M.addView(e,c,p,pose,'Entry','entry'),a=M.addStop(e,p);
 assert.equal(M.renamePresentation(e,p,'The drive'),'The drive');
 assert.equal(e.presentations[p].name,'The drive');
 assert.equal(e.presentations[p].id,p);               // stable identity
 assert.equal(M.stopEntry(e,a).id,u);                 // shared use untouched
 assert.equal(e.guide[0],a);
});

test('C9.6 removePresentation keeps definitions, Camera Views and dangling references repairable',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']}),q=M.addPresentation(e,{kind:'subjects',ids:['piano']});
 const v=M.addView(e,c,p,pose,'Entry','entry'),vq=M.addView(e,c,q,{...pose,target:[9,1,0]},'Q','entry');
 const n=M.addContribution(e,p,{kind:'narration',name:'Explanation',text:'Hello there.',markers:[]},'narration');
 const a=M.addStop(e,p),b=M.addStop(e,q);
 const definitionBefore=e.uses[n].definitionId;
 // A labelled choice whose target belongs to the removed Presentation is authored content: removing the
 // Presentation must retain it with its unresolved target rather than deleting the binding. A pre-existing
 // broken choice unrelated to this removal must not be purged either.
 e.stops[b].choices.push({id:'choice-to-a',label:'Detour to A',targetId:a,kind:'detour'});
 e.stops[b].choices.push({id:'choice-broken',label:'Old broken',targetId:'stop-nowhere',kind:'detour'});
 const report=M.removePresentation(e,p);
 assert.deepEqual(report.stops,[a]);
 assert.equal(e.presentations[p],undefined);
 assert.equal(e.stops[a],undefined);
 assert.deepEqual(e.guide,[b]);                        // only its own occurrence left the Guide
 assert.equal(e.definitions[definitionBefore].text,'Hello there.');  // shared definition retained
 assert.equal(e.uses[n].definitionId,definitionBefore);             // retained use, not rehomed
 assert.equal(e.uses[n].presentationId,p);                          // dangling home preserved, not promoted
 assert.equal(e.uses[n].start.kind,'visit');                        // never silently Experience-start
 assert.equal(e.uses[v].presentationId,p);
 assert.ok(c.views[e.uses[v].viewId]);                              // Camera truth retained
 assert.equal(c.views[vq] ? true : c.views[e.uses[vq].viewId] !== undefined,true);
 // The retained contribution is reported as an unresolved organizational binding and reachable by use
 // (the retained View use is orphaned the same way: nothing is destroyed with its home).
 assert.deepEqual(M.orphanContributions(e).map(o=>o.id).sort(),[n,v].sort());
 assert.ok(M.orphanContributions(e).some(o=>o.id===n&&o.removedHome===p));
 assert.ok(M.contributionIssues(e,c,scene(),()=>null).some(i=>i.id===n));
 // An explicit Next target left dangling stays repairable rather than guessed.
 e.stops[b].next={kind:'target',id:a};
 assert.equal(M.resolveNext(e,b).missing,true);
 // The authored choice survives the removal with its label and its now-unresolved target, and a
 // pre-existing broken choice unrelated to this removal is never purged either.
 assert.deepEqual(e.stops[b].choices.filter(ch=>ch.id==='choice-to-a').map(ch=>({label:ch.label,targetId:ch.targetId,missing:!e.stops[ch.targetId]})),[{label:'Detour to A',targetId:a,missing:true}]);
 assert.ok(e.stops[b].choices.some(ch=>ch.id==='choice-broken'));
});

test('C9.6 removeContribution unlinks a View use locally and leaves the Camera View intact',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const v=M.addView(e,c,p,pose,'Entry','entry'),a=M.addStop(e,p);
 const local=M.detachUse(e,c,v,a);                      // the Stop enters through its own private use
 const localView=e.uses[local].viewId,sharedView=e.uses[v].viewId;
 M.removeContribution(e,local);
 assert.equal(e.uses[local],undefined);
 assert.ok(c.views[localView]);                          // the local Camera View is not deleted
 assert.equal(e.stops[a].entry.kind,'use');             // the explicit reference is retained
 assert.equal(M.stopEntry(e,a).missing,true);           // and reads as a repairable missing entry
 assert.equal(M.stopEntry(e,a).hold,false);             // never converted to an intentional hold
 M.removeContribution(e,v);
 assert.ok(c.views[sharedView]);                         // the shared Camera View is not deleted either
 assert.equal(e.presentations[p].uses.includes(v),false);
});

test('C9.6 duplicate makes an independent identity and definition; a View duplicate shares Camera',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const n=M.addContribution(e,p,{kind:'narration',name:'Explanation',text:'One.',markers:[]},'narration');
 const copy=M.duplicateContribution(e,n);
 assert.notEqual(copy,n);
 assert.notEqual(e.uses[copy].definitionId,e.uses[n].definitionId);
 e.definitions[e.uses[copy].definitionId].text='Two.';
 assert.equal(e.definitions[e.uses[n].definitionId].text,'One.');     // editing the copy never mutates the original
 assert.equal(M.primaryExplanation(e,p),null);                          // a duplicate is never a second primary
 const v=M.addView(e,c,p,pose,'Entry','entry');
 const vc=M.duplicateContribution(e,v);
 assert.equal(c.views[e.uses[vc].viewId],c.views[e.uses[v].viewId]);    // one Camera View, two Experience uses
 assert.equal(e.presentations[p].uses.filter(id=>id===vc).length,1);
 assert.equal(Object.keys(c.views).length,1);
});

test('C9.6 make-local detaches a shared definition; link shares it again',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const p=M.addPresentation(e,{kind:'subjects',ids:['machine']});
 const a=M.addContribution(e,p,{kind:'narration',name:'Shared',text:'Shared text.',markers:[]},'narration');
 const b=M.duplicateContribution(e,a);
 M.linkDefinition(e,b,e.uses[a].definitionId);                          // b reads the shared definition
 assert.equal(e.uses[a].definitionId,e.uses[b].definitionId);
 e.definitions[e.uses[a].definitionId].text='Edited shared.';
 assert.equal(e.definitions[e.uses[b].definitionId].text,'Edited shared.');
 const local=M.makeDefinitionLocal(e,b);
 assert.notEqual(local,e.uses[a].definitionId);
 e.definitions[local].text='Only b.';
 assert.equal(e.definitions[e.uses[a].definitionId].text,'Edited shared.');
 assert.deepEqual(M.definitionReachByUse(e,e.uses[a].definitionId).map(r=>r.id),[a]);
 assert.deepEqual(M.definitionReachByUse(e,local).map(r=>r.id),[b]);
});

test('C9.6 rename and rebind repair a contribution while keeping trigger and target distinct',()=>{
 const e=M.createExperience(),c=M.createCamera();
 M.clearExperience(e);
 const light=M.addContribution(e,null,{kind:'control',name:'Light from Switch',subjectId:'light',capabilityId:'intensity',value:3},'interaction','switch');
 M.renameContribution(e,light,'Brighten the room');
 assert.equal(e.definitions[e.uses[light].definitionId].name,'Brighten the room');
 M.rebindContribution(e,light,{subjectId:'mesh',capabilityId:'emphasis',value:true});
 assert.equal(e.definitions[e.uses[light].definitionId].subjectId,'mesh'); // the operated subject changes
 assert.equal(e.uses[light].triggerSubjectId,'switch');                     // the activation subject is untouched
 assert.equal(e.uses[light].kind,'interaction');                            // and it never becomes automatic work
 M.rebindContribution(e,light,{triggerSubjectId:'piano'});
 assert.equal(e.uses[light].triggerSubjectId,'piano');
});

test('C9.6 provider profile replacement gains and loses declared capabilities with the instance kept',()=>{
 const s=scene();
 assert.deepEqual(capabilities(s,'machine').filter(c=>c.id==='rotor').length,1);
 replaceProfile(s,'machine','machineBase');
 assert.equal(s.subjects.machine.profile,'machineBase');
 assert.equal(capabilities(s,'machine').some(c=>c.id==='rotor'),false);      // capability lost
 assert.equal(capabilities(s,'machine').some(c=>c.id==='casing'),true);      // the rest survives
 assert.equal(s.subjects.machine.id,'machine');                             // the instance is unchanged
 assert.equal(s.subjects.machine.x,-10);
 replaceProfile(s,'mesh','meshAnnotated');
 assert.equal(capabilities(s,'mesh').some(c=>c.id==='annotate'),true);       // capability gained
 assert.ok(profileOptions().includes('machineBase'));
 assert.throws(()=>replaceProfile(s,'machine','not-a-profile'),/profile/i);
});
