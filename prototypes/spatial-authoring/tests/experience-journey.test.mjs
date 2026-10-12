// UX6 · Journey. The Deck, the Cue Card and Rehearse must read the same clock the visit runs on — this is
// the unit test the plan asks for (one mapping function shared by both), plus the atomic Cue move, which is
// the one new write the slice introduces.
import {test} from 'node:test';import assert from 'node:assert/strict';
import * as M from '../app/experience-model.js';
import {journeyClock,movementTiming,coordinateTiming,cueDestinations,cueMembers} from '../app/experience-coordination.js';
import {routeGeometry} from '../app/camera-evaluation.js';
const pose=(target,az=.7)=>({target,az,el:.3,frameH:8,flat:0});
function fixture(){
 const e=M.createExperience(),c=M.createCamera();
 const p=M.addPresentation(e,{kind:'environment'}),q=M.addPresentation(e,{kind:'environment'});
 const ua=M.addView(e,c,p,pose([0,1,0]),'Entry','entry'),ub=M.addView(e,c,q,pose([12,1,0]),'Out');
 const a=e.uses[ua].viewId,b=e.uses[ub].viewId;
 const sa=M.addStop(e,p),sb=M.addStop(e,q);
 const id=M.addConnection(c,a,b);
 // The Journey is read on an edge whose author chose Travel, which is the state the posture is read in.
 M.editSeam(e,sa,sb,{mode:'travel'});
 const first=M.addAnchor(c,id,[4,1.5,1]),second=M.addAnchor(c,id,[8,1.5,1]);
 return {e,c,p,q,sa,sb,id,first,second};
}
const seamOf=f=>f.e.seams[`${f.sa}>${f.sb}`];

test('UX6 a Cue is the (edge, connection, station) triple: one clock for the Deck, the Card and the visit',()=>{
 const f=fixture(),hold=M.addBeat(f.e,f.c,f.sa,f.sb,f.id,f.first,2);
 const seam=seamOf(f),route=f.c.connections[f.id],geometry=routeGeometry(f.c,f.id);
 const clock=journeyClock(f.c,seam,f.id);
 const direct=movementTiming(f.c,seam,geometry.path,route.speed,f.id);
 // The Deck's total is the same total the visit runs on: Camera travel plus the authored pauses.
 assert.equal(clock.travelDuration,direct.travelDuration);
 assert.equal(clock.duration,direct.duration);
 assert.ok(Math.abs(clock.duration-(clock.travelDuration+clock.pause))<1e-9);
 const cue=clock.cues.find(k=>k.stationId===f.first);
 assert.equal(cue.at,direct.holds.find(h=>h.id===hold).at);
 assert.equal(cue.pause,2);
 assert.equal(cue.holds.length,1);
 // …and the same time the runtime's own per-beat reader reports for that beat.
 assert.equal(coordinateTiming(f.c,seam).find(b=>b.id===hold).at,cue.at);
 // A station with no authored beat is not a Cue, so a shared route shows one Cue per authored station.
 assert.equal(clock.cues.length,1);
 assert.equal(cueMembers(seam,f.id,f.second).length,0);
});

test('UX6 the playhead is the inverse of the holds mapping, and holds the path still',()=>{
 const f=fixture(),hold=M.addBeat(f.e,f.c,f.sa,f.sb,f.id,f.first,2);
 const clock=journeyClock(f.c,seamOf(f),f.id);
 const cue=clock.cues.find(k=>k.stationId===f.first);
 assert.equal(clock.progressAt(0),0);
 assert.equal(clock.progressAt(clock.duration),1);
 // Inside the pause the progress is the station's own progress, not a time-driven drift past it.
 assert.equal(clock.progressAt(cue.at+1),cue.progress);
 // …and once the pause has run out the playhead moves on again: the pause adds time, not progress.
 assert.ok(clock.progressAt(cue.at+2+1e-6)>cue.progress);
 assert.equal(clock.poseAt(0).target.length,3);
});

test('UX6 moving a Cue rebinds every beat and its Activity binding as one step, or refuses',()=>{
 const f=fixture();
 const use=M.addContribution(f.e,f.p,{kind:'narration',name:'Explain',text:'A pause with words.',markers:[]},'narration');
 const hold=M.addBeat(f.e,f.c,f.sa,f.sb,f.id,f.first,1);
 const invoke=M.addInvocationBeat(f.e,f.c,f.sa,f.sb,f.id,f.first,use,null);
 assert.deepEqual(cueMembers(seamOf(f),f.id,f.first).map(b=>b.id),[hold,invoke]);
 // Only stations the Cue can really take are offered: not its own, not an occupied one.
 M.addBeat(f.e,f.c,f.sa,f.sb,f.id,f.second,1);
 assert.deepEqual(cueDestinations(f.c,seamOf(f),f.id,f.first).map(s=>s.id),['departure','arrival']);
 const moved=M.moveCue(f.e,f.c,f.sa,f.sb,f.id,f.first,'arrival');
 assert.deepEqual(moved.beats.sort(),[hold,invoke].sort());
 assert.deepEqual(cueMembers(seamOf(f),f.id,'arrival').map(b=>b.id).sort(),[hold,invoke].sort());
 assert.equal(f.e.uses[use].start.stationId,'arrival');
 assert.equal(f.e.uses[use].start.connectionId,f.id);
 // An occupied destination refuses without mutating, and so does a station that was never authored.
 const before=JSON.stringify(f.e);
 assert.throws(()=>M.moveCue(f.e,f.c,f.sa,f.sb,f.id,'arrival',f.second),/already holds a Cue/);
 assert.throws(()=>M.moveCue(f.e,f.c,f.sa,f.sb,f.id,f.second,'generated-sample'),/authored Camera station/);
 assert.throws(()=>M.moveCue(f.e,f.c,f.sa,f.sb,f.id,'arrival','arrival'),/already the Cue/);
 assert.equal(JSON.stringify(f.e),before);
 // A generated endpoint is a real station: moving onto a free departure is a legitimate move, not a repair.
 assert.equal(M.moveCue(f.e,f.c,f.sa,f.sb,f.id,'arrival','departure').stationId,'departure');
 assert.equal(f.e.uses[use].start.stationId,'departure');
});

test('UX6 two edges sharing one Camera route keep distinct Cues and distinct pauses',()=>{
 const f=fixture();
 const third=M.addPresentation(f.e,{kind:'environment'}),sc=M.addStop(f.e,third);
 const second=M.addStop(f.e,f.q);
 f.e.stops[sc].next={kind:'order'};
 const holdA=M.addBeat(f.e,f.c,f.sa,f.sb,f.id,f.first,3);
 const holdB=M.addBeat(f.e,f.c,f.sb,sc,f.id,f.first,1);
 assert.equal(f.e.seams[`${f.sa}>${f.sb}`].beats.length,1);
 assert.equal(f.e.seams[`${f.sb}>${sc}`].beats.length,1);
 const a=journeyClock(f.c,f.e.seams[`${f.sa}>${f.sb}`],f.id),b=journeyClock(f.c,f.e.seams[`${f.sb}>${sc}`],f.id);
 assert.equal(a.cues.find(k=>k.stationId===f.first).pause,3);
 assert.equal(b.cues.find(k=>k.stationId===f.first).pause,1);
 assert.notEqual(a.cues[0].id+':'+a.cues[0].pause,b.cues[0].id+':'+b.cues[0].pause);
 assert.ok(holdA!==holdB);
});
