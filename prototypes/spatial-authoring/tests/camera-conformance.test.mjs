import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conformanceFixture} from '../app/conformance-fixture.js';
import {eye,routeGeometry,resolveCamera,evaluatePath,pathSeconds,framingInstrument,distance} from '../app/camera-evaluation.js';
import {addConnection,addAnchor,detachUse,originCoverage,stopEntry} from '../app/experience-model.js';
import {createRuntime,startGuide,nextRuntime,tickRuntime,gateState,requestView} from '../app/experience-runtime.js';
import {editSeam} from '../app/experience-model.js';
test('observer anchors, rendered samples, stations and evaluation describe the same nonzero route',()=>{
 const {experience:e,camera:c}=conformanceFixture(),a=e.guide[3],b=e.guide[4],from=e.uses[e.presentations[e.stops[a].presentationId].uses[1]].viewId,to=e.uses[stopEntry(e,b).id].viewId;
 const id=addConnection(c,from,to),anchor=addAnchor(c,id,[-8,1.5,2]),r=routeGeometry(c,id);
 const point=r.stations.find(s=>s.id===anchor);
 eye(point.pose).forEach((v,i)=>assert.ok(Math.abs(v-[-8,1.5,2][i])<1e-10));
 assert.deepEqual(r.samples[0].observer,eye(c.views[from].pose));assert.deepEqual(r.samples.at(-1).observer,eye(c.views[to].pose));assert.equal(r.seconds,pathSeconds(r.path,c.connections[id].speed));assert.deepEqual(evaluatePath(r.path,1),c.views[to].pose);
 assert.equal(c.connections[id].anchors.length,1);assert.ok(r.seconds>0);
});
test('detached occurrence entry remains a legitimate origin alongside shared choices',()=>{
 const {experience:e,camera:c}=conformanceFixture(),a=e.guide[3],b=e.guide[4],uid=stopEntry(e,a).id,local=detachUse(e,c,uid,a);
 const rows=originCoverage(e,c,a,b);assert.equal(rows.length,3);assert.ok(rows.some(r=>r.useId===local));assert.ok(!rows.some(r=>r.useId===uid));
});
test('one resolved Camera serves relative framing and fixed-framing review without source mutation',()=>{
 const {camera:c}=conformanceFixture(),v=Object.values(c.views)[0];v.anchor='relative';v.focusOffset=[1,0,0];const source=JSON.stringify(c),resolved=resolveCamera(c,{machine:[4,2,5],mesh:[0,0,0],piano:[0,0,0],switch:[0,0,0],light:[0,0,0]});assert.deepEqual(resolved.views[v.id].pose.target,[5,2,5]);assert.equal(JSON.stringify(c),source);
});
test('spatial frustum represents the same View framing at the actual viewport aspect',()=>{
 const {camera:c}=conformanceFixture(),p=Object.values(c.views)[0].pose;
 for(const aspect of [.98,1.46]){const rig=framingInstrument(p,aspect);assert.deepEqual(rig.observer,eye(p));assert.ok(Math.abs(distance(rig.corners[0],rig.corners[1])-p.frameH*aspect)<1e-10);assert.ok(Math.abs(distance(rig.corners[1],rig.corners[2])-p.frameH)<1e-10);}
});
test('Travel starts on the supported observer route only after reaching the actual departure View',()=>{
 const {experience:e,camera:c}=conformanceFixture(),a=e.guide[3],b=e.guide[4],u=e.uses[e.presentations[e.stops[a].presentationId].uses[1]],v=e.uses[stopEntry(e,b).id],id=addConnection(c,u.viewId,v.viewId);e.guide=[a,b];editSeam(e,a,b,{mode:'travel'});
 let r=createRuntime(e,c,e.stops[a].presentationId,c.views[u.viewId].pose);r=startGuide(e,c,r);requestView(r,e,c,u.id);
 assert.equal(gateState(e,c,r).allowed,false);assert.match(nextRuntime(e,c,r).refusal,/departure View/);
 r=tickRuntime(e,c,r,100);assert.equal(gateState(e,c,r).allowed,true);r=nextRuntime(e,c,r);
 const geometry=routeGeometry(c,id);assert.deepEqual(r.movement.path,geometry.path);assert.equal(r.movement.travelDuration,geometry.seconds);assert.deepEqual(r.pose,c.views[u.viewId].pose);
});
test('renderer, shell and Experience consumers have no independent Camera writers or interpolation',()=>{
 for(const file of ['main.js','actions.js','experience.js','stage.js']){
  const source=readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:stage|st\(\)|ctx\.stage)\.cam\.(?:az|el|frameH|flat|mirror)\s*(?:=|\+=|-=)/,file);
  assert.doesNotMatch(source,/S\.flatHold\s*=|routeReturn/,file);
 }
 for(const file of ['camera-evaluation.js','experience-runtime.js','experience-coordination.js'])assert.doesNotMatch(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),/from ['"]\.\/(?:state|tasks|actions|ui|stage|experience)\.js['"]/);
});
