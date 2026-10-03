import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperience, createCamera, addPresentation, subject, validateFocus } from '../app/experience-model.js';
test('explicit creation keeps independent domains and World identities', () => {
 const e=createExperience(), c=createCamera(); const before=structuredClone(c);
 const id=addPresentation(e,{kind:'subjects',ids:['gwin']});
 assert.equal(subject(e,c,id).owner,'Experience'); assert.deepEqual(e.presentations[id].focus.ids,['gwin']);
 assert.deepEqual(c,before); assert.deepEqual(e.guide,[]); assert.equal(validateFocus(e.presentations[id], x=>x==='gwin'),true);
 e.presentations[id].focus.ids=['removed']; assert.equal(validateFocus(e.presentations[id], x=>x==='gwin'),false);
});
import { addView, setRole, removeView, entryUse } from '../app/experience-model.js';
import { createRuntime, tickRuntime, requestView } from '../app/experience-runtime.js';
const pose={target:[0,1,0],az:.7,el:.3,frameH:8,flat:0};
test('Set is unordered, with explicit entry and no Guide or Camera connections',()=>{
 const e=createExperience(),c=createCamera(),p=addPresentation(e);const ids=[0,1,2].map(i=>addView(e,c,p,{...pose,target:[i,1,0]},`Framing ${i}`));
 assert.equal(entryUse(e,p),null);setRole(e,ids[1],'entry');assert.equal(entryUse(e,p).id,ids[1]);
 assert.deepEqual(e.guide,[]);assert.deepEqual(c.connections,{});
 const source=JSON.stringify({e,c});let r=createRuntime(e,c,p,pose); assert.equal(r.viewUseId,ids[1]);
 requestView(r,e,c,ids[2]);r=tickRuntime(e,c,r,10);assert.deepEqual(r.pose.target,[2,1,0]);assert.equal(JSON.stringify({e,c}),source);
 removeView(e,c,e.uses[ids[1]].viewId);assert.equal(requestView(r,e,c,ids[1]),false);assert.equal(e.uses[ids[1]].role,'entry');
});
test('no-View standalone Preview requires no Guide',()=>{const e=createExperience(),c=createCamera(),p=addPresentation(e);const r=createRuntime(e,c,p,pose);assert.deepEqual(r.pose,pose);assert.equal(r.stopId,null);});
import { addStop, moveStop, resolveNext, stopEntry } from '../app/experience-model.js';
test('repeated occurrences share framing, reorder only editorial order and resolve one Next',()=>{
 const e=createExperience(),c=createCamera(),p=addPresentation(e),u=addView(e,c,p,pose,'Entry','entry');
 const a=addStop(e,p),b=addStop(e,p);assert.notEqual(a,b);assert.equal(stopEntry(e,a).id,u);assert.equal(stopEntry(e,b).id,u);
 const camera=JSON.stringify(c);assert.equal(resolveNext(e,a).id,b);moveStop(e,b,-1);assert.equal(resolveNext(e,b).id,a);assert.equal(JSON.stringify(c),camera);
 delete e.uses[u];e.stops[a].entry={kind:'use',useId:u};assert.equal(stopEntry(e,a).missing,true);assert.notEqual(e.stops[a].entry.kind,'hold');
});
import { originCoverage, addConnection, addAnchor, editSeam } from '../app/experience-model.js';
import { connectionPath, pathSeconds, evaluatePath } from '../app/camera-evaluation.js';
test('directed Camera reach is per origin; Cut authors no edge; path estimates match execution',()=>{
 const e=createExperience(),c=createCamera(),p=addPresentation(e),q=addPresentation(e);
 const origins=[0,1,2].map(i=>addView(e,c,p,{...pose,target:[i,1,0]},`origin ${i}`,i?'choice':'entry'));
 const destination=addView(e,c,q,{...pose,target:[10,1,0]},'Entry','entry'),a=addStop(e,p),b=addStop(e,q);
 const target=e.uses[destination].viewId;origins.slice(0,2).forEach(uid=>addConnection(c,e.uses[uid].viewId,target));
 assert.equal(originCoverage(e,c,a,b).filter(r=>r.connectionId).length,2);
 editSeam(e,a,b,{mode:'cut'});assert.equal(Object.keys(c.connections).length,2);
 const id=addConnection(c,e.uses[origins[2]].viewId,target);addAnchor(c,id,[6,2,1]);
 assert.equal(originCoverage(e,c,a,b).filter(r=>r.connectionId).length,3);
 const path=connectionPath(c.connections[id],c.views[e.uses[origins[2]].viewId].pose,c.views[target].pose);
 assert.equal(c.connections[id].anchors.length,1);assert.equal(path.length,3);
 let r=createRuntime(e,c,p,pose);requestView(r,e,c,destination,'slow',path);const seconds=pathSeconds(path,'slow');r=tickRuntime(e,c,r,seconds);assert.deepEqual(r.pose,evaluatePath(path,1));assert.equal(r.movement,null);
});
import { viewReach, detachUse, editView } from '../app/experience-model.js';
test('Stop-only detachment retargets one occurrence atomically and shared reach names all affected uses',()=>{
 const e=createExperience(),c=createCamera(),p=addPresentation(e),uid=addView(e,c,p,pose,'Entry','entry'),a=addStop(e,p),b=addStop(e,p);
 const vid=e.uses[uid].viewId;assert.equal(viewReach(e,vid).stops.length,2);
 const before=structuredClone({e,c});const local=detachUse(e,c,uid,a);editView(c,e.uses[local].viewId,{frameH:4});
 assert.equal(stopEntry(e,a).id,local);assert.equal(stopEntry(e,b).id,uid);assert.equal(c.views[vid].pose.frameH,8);
 assert.equal(e.presentations[p].uses.length,1);// The shared View remains a choice in the unchanged Set of both Stops.
 assert.equal(viewReach(e,vid).stops.length,2);
 Object.assign(e,before.e);Object.assign(c,before.c);assert.equal(stopEntry(e,a).id,uid);
});
