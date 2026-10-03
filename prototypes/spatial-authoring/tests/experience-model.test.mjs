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
