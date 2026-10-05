import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conformanceFixture} from '../app/conformance-fixture.js';
import {eye,routeGeometry,resolveCamera,evaluatePath,pathSeconds,framingInstrument,distance,liveConnectionPath} from '../app/camera-evaluation.js';
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
// C9.4 successor proof for the replaced C8 departure-wait restriction. The protected truths are kept:
// one Camera evaluator owns the path, the authored source is frozen, and the visitor ends at the real
// destination View; the departure is no longer a Gate and no second tween regains it.
test('Travel invokes the anchored Camera route from the live pose: early Next is no Gate and no second tween',()=>{
 const {experience:e,camera:c}=conformanceFixture(),a=e.guide[3],b=e.guide[4],pid=e.stops[a].presentationId,u=e.uses[e.presentations[pid].uses[1]],v=e.uses[stopEntry(e,b).id];
 const id=addConnection(c,u.viewId,v.viewId),anchor=addAnchor(c,id,[-8,1.5,2]);
 e.guide=[a,b];editSeam(e,a,b,{mode:'travel'});
 const source=JSON.stringify(c);
 // The visitor is still flying towards the departure View when Next is pressed.
 let r=startGuide(e,c,createRuntime(e,c,pid,c.views[u.viewId].pose));
 assert.equal(requestView(r,e,c,u.id,'auto'),true);assert.ok(r.movement);
 r=tickRuntime(e,c,r,Math.min(.25,r.movement.duration/2));
 const live=structuredClone(r.pose);assert.ok(r.movement);assert.notDeepEqual(live,c.views[u.viewId].pose);
 // Early Next starts the supported route here, from the actual pose: no departure wait, no hidden Cut.
 assert.equal(gateState(e,c,r).allowed,true);
 r=nextRuntime(e,c,r);
 assert.equal(r.stopId,b);assert.equal(r.refusal,null);
 assert.deepEqual(r.movement.path[0],live);
 assert.deepEqual(r.movement.path.at(-1),c.views[v.viewId].pose);
 assert.equal(r.movement.path.length,3);
 // The interior point is the authored observer anchor, evaluated by the same Camera kernel.
 const station=routeGeometry(c,id).stations.find(s=>s.id===anchor);
 eye(liveConnectionPath(c.connections[id],c.views[v.viewId].pose,live)[1]).forEach((n,i)=>assert.ok(Math.abs(n-station.observer[i])<1e-9));
 assert.equal(r.movement.travelDuration,pathSeconds(liveConnectionPath(c.connections[id],c.views[v.viewId].pose,live),c.connections[id].speed));
 assert.equal(JSON.stringify(c),source);
 r=tickRuntime(e,c,r,r.movement.duration);
 assert.equal(r.movement,null);assert.deepEqual(r.pose,c.views[v.viewId].pose);
 assert.equal(c.connections[id].anchors.length,1);
 // Deliberately missing support stays an explicit local refusal: no implicit edge, Cut or fake route.
 const g=conformanceFixture(),ga=g.experience.guide[3],gb=g.experience.guide[4];
 g.experience.guide=[ga,gb];editSeam(g.experience,ga,gb,{mode:'travel'});
 const gr=startGuide(g.experience,g.camera,createRuntime(g.experience,g.camera,g.experience.stops[ga].presentationId,{...c.views[u.viewId].pose,target:[4,1,4]}));
 assert.equal(gateState(g.experience,g.camera,gr).allowed,false);
 assert.match(gateState(g.experience,g.camera,gr).reason,/Travel gap/);
 const refused=nextRuntime(g.experience,g.camera,gr);
 assert.equal(refused.stopId,ga);assert.match(refused.refusal,/Travel gap/);
 assert.deepEqual(Object.keys(g.camera.connections),[]);
});
test('renderer, shell and Experience consumers have no independent Camera writers or interpolation',()=>{
 for(const file of ['main.js','actions.js','experience.js','stage.js']){
  const source=readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:stage|st\(\)|ctx\.stage)\.cam\.(?:az|el|frameH|flat|mirror)\s*(?:=|\+=|-=)/,file);
  assert.doesNotMatch(source,/S\.flatHold\s*=|routeReturn/,file);
 }
 for(const file of ['camera-evaluation.js','experience-runtime.js','experience-coordination.js'])assert.doesNotMatch(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),/from ['"]\.\/(?:state|tasks|actions|ui|stage|experience)\.js['"]/);
});
