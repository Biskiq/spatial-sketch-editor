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
