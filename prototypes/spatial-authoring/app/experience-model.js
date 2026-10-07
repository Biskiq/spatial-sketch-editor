// Prototype-local authored domains. These are not production document interfaces.
import { capability, isRealized } from './experience-capabilities.js';
export const copy = (v) => structuredClone(v);
export function createExperience() {
  return { name: 'Saltmarsh Experience', serial: 0, presentations: { 'pres-highlights': { id: 'pres-highlights', name: 'Saltmarsh Highlights', meaning: '', focus: { kind: 'subjects', ids: ['gwin'] }, uses: [] } }, uses: {}, stops: {}, guide: [], seams: {}, definitions: {} };
}
export const createCamera = () => ({ serial: 0, views: {}, connections: {} });
export const fresh = (domain, prefix) => `${prefix}-${++domain.serial}`;
export function subject(domain, camera, id) {
  if (domain.presentations[id]) return { kind: 'Presentation', item: domain.presentations[id], owner: 'Experience' };
  if (domain.uses[id]) return { kind: 'View use', item: domain.uses[id], owner: 'Experience' };
  if (camera.views[id]) return { kind: 'Camera View', item: camera.views[id], owner: 'Camera' };
  if (domain.stops[id]) return { kind: 'Stop', item: domain.stops[id], owner: 'Experience' };
  return null;
}
export function addPresentation(e, focus = { kind: 'environment' }, name = 'Untitled Presentation') {
  const id = fresh(e, 'presentation');
  e.presentations[id] = { id, name, meaning: '', focus: copy(focus), uses: [] };
  return id;
}
export function validateFocus(p, resolves) {
  return p.focus.kind !== 'subjects' || p.focus.ids.every(resolves);
}
export function addView(e,c,pid,pose,name='Suggested framing',role='choice') {
 const p=e.presentations[pid]; if(!p) throw Error('Presentation missing');
 const viewId=fresh(c,'view'); c.views[viewId]={id:viewId,name,pose:copy(pose),focus:copy(p.focus),anchor:'fixed',revision:0};
 const id=fresh(e,'use'); e.uses[id]={id,name,presentationId:pid,viewId,role,cue:null}; p.uses.push(id);
 return id;
}
export function entryUse(e,pid) { const p=e.presentations[pid]; return p?.uses.map(id=>e.uses[id]).find(u=>u?.role==='entry') || null; }
export function setRole(e,id,role) {
 const u=e.uses[id]; if(!u) throw Error('Use removed');
 if(u.stopId)throw Error('Stop entry roles belong to this occurrence');
 // A retained View use whose home Presentation was removed has nowhere to record a role: this is an
 // explicit refusal the author can read, never a dereference of the missing home.
 const p=e.presentations[u.presentationId];if(!p)throw Error('Presentation removed');
 if(role==='entry') for(const other of p.uses) if(e.uses[other]?.role==='entry') e.uses[other].role='choice';
 u.role=role;
}
export function removeView(e,c,id) {
 // Never convert a missing entry to intentional hold. References remain repairable.
 delete c.views[id];
}
export function resolveUse(e,c,id) { const u=e.uses[id]; return u&&c.views[u.viewId]&&!c.views[u.viewId].unresolved ? {use:u,view:c.views[u.viewId]}:null; }
export function addStop(e,pid) {
 if(!e.presentations[pid])throw Error('Presentation removed');
 const id=fresh(e,'stop');e.stops[id]={id,presentationId:pid,name:e.presentations[pid].name,entry:{kind:'presentation'},next:{kind:'order'},pacing:{kind:'auto'},gate:null,choices:[]};e.guide.push(id);return id;
}
export function resolveNext(e,id) {
 const s=e.stops[id];if(!s)return {id:null,missing:true};
 const next=s.next.kind==='end'?null:s.next.kind==='target'?s.next.id:e.guide[e.guide.indexOf(id)+1]||null;
 return {id:next,missing:!!next&&!e.stops[next]};
}
export function stopEntry(e,id) {
 const s=e.stops[id];if(!s)return {id:null,missing:true};
 if(s.entry.kind==='hold')return {id:null,hold:true,missing:false};
 const uid=s.entry.kind==='use'?s.entry.useId:entryUse(e,s.presentationId)?.id;
 return {id:uid||null,hold:!uid&&s.entry.kind==='presentation',missing:s.entry.kind==='use'&&!e.uses[uid]};
}
export function moveStop(e,id,delta) { const i=e.guide.indexOf(id),j=i+delta;if(i<0||j<0||j>=e.guide.length)return false;[e.guide[i],e.guide[j]]=[e.guide[j],e.guide[i]];return true; }
export function removeStop(e,id) { e.guide=e.guide.filter(x=>x!==id);delete e.stops[id]; }
export const seamKey = (a,b)=>`${a}>${b}`;
export function getSeam(e,a,b) { return e.seams[seamKey(a,b)] || {from:a,to:b,mode:'cut',speed:'auto',beats:[]}; }
export function editSeam(e,a,b,patch) {
 if(!e.stops[a]||!e.stops[b]||resolveNext(e,a).id!==b)throw Error('Seam bookends no longer adjacent');
 const key=seamKey(a,b); e.seams[key]={...getSeam(e,a,b),...copy(patch)};return e.seams[key];
}
export function originCoverage(e,c,a,b) {
 const from=e.stops[a],dest=stopEntry(e,b),target=resolveUse(e,c,dest.id);
 // Every eligible Presentation View is a legitimate origin, because the visitor can deliberately select
 // any of them (the visitor's View controls and viewStep read this same `eligibleViews` set). A Stop that
 // enters through another View does not remove the Presentation's own entry from the Set, and excluding
 // it would report all origins supported while selecting that entry disabled Next with a Travel gap. The
 // Stop's private entry is a View too, and joins the set where it is not already one of the Presentation's.
 const ids=[...eligibleViews(e,from?.presentationId),stopEntry(e,a).id].filter(Boolean);
 const origins=[...new Set(ids)].map(id=>e.uses[id]).filter(u=>u?.viewId);
 return origins.map(u=>({useId:u.id,viewId:u.viewId,targetId:target?.view.id||null,connectionId:Object.values(c.connections).find(k=>k.from===u.viewId&&k.to===target?.view.id)?.id||null,missing:!c.views[u.viewId]||!!c.views[u.viewId].unresolved||!target}));
}
// N1 — one explicit Travel preparation transaction. Experience supplies the eligible origin Views and
// the destination entry; Camera creates only the missing direct connections and reuses every existing
// one untouched, so a shared route/pace is never silently rewritten. Two origins are already supported
// without an edge: the same View (Camera's own zero-distance evaluation, never a fabricated edge) and
// an unresolved origin or entry, which stays a reported gap for repair. Nothing else creates
// connectivity: adding or selecting a View and Previewing all leave the Camera graph alone.
export function prepareTravelSupport(e,c,a,b) {
 const prepared=[],reused=[],direct=[],gaps=[];
 for(const row of originCoverage(e,c,a,b)){
  if(row.missing){gaps.push({useId:row.useId,viewId:row.viewId,reason:'Origin or destination entry needs repair'});continue;}
  if(row.viewId===row.targetId){direct.push({useId:row.useId,viewId:row.viewId});continue;}
  if(row.connectionId){reused.push({useId:row.useId,connectionId:row.connectionId});continue;}
  prepared.push({useId:row.useId,viewId:row.viewId,connectionId:addConnection(c,row.viewId,row.targetId)});
 }
 return {prepared,reused,direct,gaps};
}
export function addConnection(c,from,to) {
 if(!c.views[from]||!c.views[to])throw Error('Camera endpoints unresolved');
 const old=Object.values(c.connections).find(k=>k.from===from&&k.to===to);if(old)return old.id;
 const id=fresh(c,'connection');c.connections[id]={id,from,to,anchors:[],markers:[],speed:'auto'};return id;
}
export function addAnchor(c,id,position) {
 const route=c.connections[id];if(!route)throw Error('Connection removed');
 const aid=fresh(c,'anchor');route.anchors.push({id:aid,name:`Anchor ${route.anchors.length+1}`,position:[...position]});return aid;
}
export function viewReach(e,viewId) {
 const uses=Object.values(e.uses).filter(u=>u.viewId===viewId);
 const stops=Object.values(e.stops).filter(s=>uses.some(u=>stopEntry(e,s.id).id===u.id || (e.presentations[s.presentationId]?.uses.includes(u.id))));
 return {uses:uses.map(u=>({id:u.id,name:e.presentations[u.presentationId]?.name||u.name})),stops:stops.map(s=>({id:s.id,name:s.name}))};
}
export function detachUse(e,c,uid,stopId=null) {
 const src=resolveUse(e,c,uid);if(!src)throw Error('Framing removed');
 const vid=fresh(c,'view');c.views[vid]={...copy(src.view),id:vid,name:`${src.view.name} · local`};
 if(stopId) {
  if(!e.stops[stopId] || e.stops[stopId].presentationId!==src.use.presentationId)throw Error('Stop and View use no longer match');
  const id=fresh(e,'use');e.uses[id]={...copy(src.use),id,viewId:vid,role:'stop-entry',stopId};e.stops[stopId].entry={kind:'use',useId:id};return id;
 }
 e.uses[uid].viewId=vid;return uid;
}
export function editView(c,id,patch) {
 const v=c.views[id];if(!v)throw Error('View removed');
 const pose={...v.pose,...copy(patch)};
 if(!pose.target?.every(Number.isFinite)||![pose.az,pose.el,pose.frameH].every(Number.isFinite)||pose.frameH<=.1)throw Error('Invalid Camera framing');
 v.pose=pose;v.anchor='fixed';v.revision++;
}
// The six Camera View properties a Precision grip can address: one authority for the drawing, the
// Camera Card's deliberate property list and the Precision task, so a property cannot be invented in
// one home and silently missing in another.
export const gripLabels={frameH:'Frame height',az:'Aim horizontally',el:'Aim vertically',x:'Target X',y:'Target height',z:'Target Z'};
export function addBeat(e,c,a,b,connectionId,stationId,hold=1) {
 const route=c.connections[connectionId];if(!route)throw Error('Connection missing');
 const valid=['departure',...route.anchors.map(a=>a.id),...route.markers.map(m=>m.id),'arrival'];
 if(!valid.includes(stationId))throw Error('Generated samples are not authored Camera stations');
 const seam=editSeam(e,a,b,{}),id=fresh(e,'beat');seam.beats.push({id,connectionId,stationId,kind:'hold',seconds:Math.max(0,hold)});return id;
}
export function connectionReach(e,c,id) {
 return Object.entries(e.seams).filter(([,s])=>originCoverage(e,c,s.from,s.to).some(r=>r.connectionId===id)).map(([key,s])=>({key,from:s.from,to:s.to}));
}
export function addContribution(e,pid,definition,kind='behavior',trigger=null) {
 if(pid&&!e.presentations[pid])throw Error('Presentation removed');
 const did=fresh(e,'definition'),id=fresh(e,'contribution');e.definitions[did]={...copy(definition),id:did};
 e.uses[id]={id,kind,definitionId:did,presentationId:pid,triggerSubjectId:trigger||definition.subjectId||null,start:pid?{kind:'visit',presentationId:pid}:{kind:'experience'},end:pid?{kind:'visit',presentationId:pid}:{kind:'experience'},interruption:null,availability:pid,toggle:false};
 return id;
}
// Experience Reset clears only Experience-authored content. The Experience serial is kept: the rest of
// the session (aggregate Undo history, parked work) still refers to the replaced identities, so a fresh
// empty Experience must never reissue one of them. Camera has its own identity serial and is never
// touched here.
export function clearExperience(e) {
 e.presentations={};e.uses={};e.stops={};e.guide=[];e.seams={};e.definitions={};
 return e;
}
const nonViewUses=(e,pid)=>Object.values(e.uses).filter(u=>u.presentationId===pid&&!u.viewId);
export const presentationUses=(e,pid)=>nonViewUses(e,pid);
// The binding is to the Presentation whose field edits it, never to the use's organizational home.
// `primaryFor` is written when the binding is created; regrouping moves `presentationId` only, so an
// author editing A still updates the original use after its home has moved to B. A fixture that sets
// `primary` alone (no binding field) is read through its home.
const explained=(u,pid)=>!u.viewId&&u.primary&&(u.primaryFor??u.presentationId)===pid;
export function primaryExplanation(e,pid) {
 return Object.values(e.uses).find(u=>explained(u,pid)&&e.definitions[u.definitionId]?.kind==='narration')||null;
}
// Used by the Card to keep a bound explanation out of the "additional contributions" list even when
// its organizational home is elsewhere, so it stays reachable and editable exactly once.
export const isPrimaryExplanation=(e,pid,u)=>!!u&&u===primaryExplanation(e,pid);
// The ordinary creator path: the first non-empty accepted text creates one narration use; every later
// edit updates that same use, so the explanation never becomes two independently editable authorities.
export function setPrimaryExplanation(e,pid,text) {
 if(!e.presentations[pid])throw Error('Presentation missing');
 const current=String(text??'');
 const u=primaryExplanation(e,pid);
 if(u){const d=e.definitions[u.definitionId];if(!d)throw Error('Explanation definition missing');d.text=current;return{id:u.id,created:false};}
 if(!current.trim())return null;
 const id=addContribution(e,pid,{kind:'narration',name:'Explanation',text:current,markers:[]},'narration');
 e.uses[id].primary=true;e.uses[id].primaryFor=pid;
 return {id,created:true};
}
// Captured capability uses are matched by subject, capability, presentation scope and kind: a visitor
// offer is never a captured Activity, and the first enumerated match is never mutated for another.
export function captureUses(e,pid,sid,cid) {
 return nonViewUses(e,pid).filter(u=>{
  const d=e.definitions[u.definitionId];
  return u.kind!=='interaction'&&d?.kind==='control'&&d.subjectId===sid&&d.capabilityId===cid;
 });
}
// Capture another is an explicit create: the ambiguity choice is about which existing identity to
// update, so the create action it offers must never be refused by that same ambiguity.
export function captureNew(e,pid,sid,cid,value,name='') {
 const id=addContribution(e,pid,{kind:'control',name:name||cid,subjectId:sid,capabilityId:cid,value},'behavior');
 return {id,created:true};
}
export function captureCapability(e,pid,sid,cid,value,name='') {
 const matches=captureUses(e,pid,sid,cid);
 if(matches.length>1)return{ambiguous:matches.map(u=>u.id)};
 if(matches.length===1){const d=e.definitions[matches[0].definitionId];d.value=value;if(name)d.name=name;return{id:matches[0].id,updated:true};}
 return captureNew(e,pid,sid,cid,value,name);
}
export function narrationDuration(d) {return d.duration ?? Math.max(1,d.text.trim().split(/\s+/).filter(Boolean).length/2.5);}
export function cueSeconds(e,cue) {
 const u=e.uses[cue?.useId],d=e.definitions[u?.definitionId];if(d?.kind!=='narration')return null;
 if(cue.signal==='complete')return narrationDuration(d);
 const m=d.markers.find(m=>`marker:${m.id}`===cue.signal);const at=m?(m.time??m.fraction*narrationDuration(d)):null;return Number.isFinite(at)&&at>=0&&at<=narrationDuration(d)?at:null;
}
export function activationScope(u) {const s=u?.start;if(!s)return u?.presentationId??null;return s.kind==='after'?(s.scope==='experience'?null:s.presentationId??u.presentationId):s.kind==='experience'?null:s.presentationId??u.presentationId;}
export function boundaryScope(u,boundary=u.end) {return boundary?.kind==='visit'?(boundary.presentationId??activationScope(u)):null;}
export function supportedSignal(e,scene,ref) {
 const u=e.uses[ref?.useId],d=e.definitions[u?.definitionId];if(!u||u.viewId||!d)return false;
 if(d.kind==='narration')return ref.signal==='complete'||cueSeconds(e,ref)!==null;
 const cap=d.kind==='control'&&capability(scene,d.subjectId,d.capabilityId);return !!cap&&cap.kind!=='loop'&&ref.signal==='complete';
}
export function eligibleViews(e,pid) {return (e.presentations[pid]?.uses||[]).filter(id=>e.uses[id]?.viewId&&!e.uses[id].stopId);}
export function orderedViews(e,pid) {const all=eligibleViews(e,pid);return [...new Set([...(e.presentations[pid]?.viewOrder||[]).filter(id=>all.includes(id)),...all])];}
export function viewStep(e,pid,current,delta) {const ids=orderedViews(e,pid);return ids[ids.indexOf(current)+delta]||null;}
export function narrationPassages(d) {
 const sentences=d.text.trim().match(/[^.!?]+[.!?]*(?:\s+|$)/g)||[];const total=sentences.reduce((n,s)=>n+s.trim().split(/\s+/).length,0)||1;let at=0;
 return sentences.map(text=>{const start=at;at+=text.trim().split(/\s+/).length/total*narrationDuration(d);return {text:text.trim(),start,end:at};});
}
// Two different questions are asked about a reference, and one predicate cannot answer both.
// `signalCanDriveVisitCondition` is the strict one: Gate and pacing advance the Stop they are authored
// on, so the signal has to be emitted inside that same visit. A visit-local contribution emits in its
// own activation visit, a station-bound one is invoked inside the visit it lands in, and a visitor offer
// emits in the visit where it is available — but Experience-start completion may have happened before
// the visit and can never release a later Stop.
// `signalCanCuePresentation` is the live-output question: `emit` deliberately lets Experience-scoped
// narration cue the View of whatever Presentation is current, so a cue whose source is Experience-wide
// is legitimate and must not be reported as an impossible scope. References that can never satisfy
// their instruction are reported as repairable and kept as unavailable work instead of waiting forever.
export function signalCanDriveVisitCondition(e,ref,pid){
 const u=e.uses[ref?.useId];if(!u)return false;
 if(u.kind==='interaction')return !u.availability||u.availability===pid;
 return activationScope(u)===pid;
}
export function signalCanCuePresentation(e,ref,pid){
 const u=e.uses[ref?.useId];if(!u)return false;
 if(u.kind==='interaction')return !u.availability||u.availability===pid;
 const scope=activationScope(u);return scope===pid||scope===null;
}
function dependencyInScope(e,u){return u.start.scope==='experience'||signalCanDriveVisitCondition(e,u.start,activationScope(u));}
function cueInScope(e,u){return signalCanCuePresentation(e,u.cue,u.presentationId);}
// The authored moment of a signal inside its own run: a narration's completion or one of its named
// phrases, or a finite capability's completion. null means this contribution cannot produce the signal
// at all (a persistent loop never completes), so the reference can never be satisfied.
export function signalPosition(e,scene,u,signal){
 const d=e?.definitions[u?.definitionId];if(!d)return null;
 if(d.kind==='narration')return signal==='complete'?narrationDuration(d):cueSeconds(e,{useId:u.id,signal});
 if(d.kind==='control'&&signal==='complete'){const cap=scene&&capability(scene,d.subjectId,d.capabilityId);return cap&&cap.kind!=='loop'?cap.duration??0:null;}
 return null;
}
// The authored length of one run. `undefined` is not work a plan can measure; `null` is persistent work
// that never reaches a finite completion, so only its start can be placed.
export function workDuration(e,scene,u){
 const d=e?.definitions[u?.definitionId];if(!d)return undefined;
 if(d.kind==='narration')return narrationDuration(d);
 if(d.kind==='control'){const cap=scene&&capability(scene,d.subjectId,d.capabilityId);if(!cap)return undefined;return cap.kind==='loop'?null:d.value===false?0:cap.duration||0;}
 return undefined;
}
// Gate and pacing instructions are evaluated inside the Stop's own Presentation visit: a reference in
// another scope can never release them. Kept as an explicit repair issue, never silently dropped.
export function stopConditionIssues(e,scene,id,resolveCapability=capability){
 const s=e.stops[id];if(!s)return [];
 const issues=[],check=(ref,label)=>{
  if(!ref)return;
  if(!supportedSignal(e,scene,ref)){issues.push({id,condition:label,message:`${label} needs repair`});return;}
  if(!signalCanDriveVisitCondition(e,ref,s.presentationId))issues.push({id,condition:label,message:`${label} signal is outside this activation scope`});
 };
 check(s.gate,'Gate');
 if(s.pacing.kind==='signal')check(s.pacing.ref,'Pacing signal');
 return issues;
}
export function contributionIssues(e,c,scene,resolveCapability=capability) {
 const issues=[];
 for(const u of Object.values(e.uses)) {
  if(u.viewId) {if(!c.views[u.viewId])issues.push({id:u.id,message:'Framing removed; repair or explicitly keep viewpoint'});if(u.presentationId&&!e.presentations[u.presentationId])issues.push({id:u.id,message:'Home Presentation removed; rehome or remove this retained View use'});if(u.cue&&!supportedSignal(e,scene,u.cue))issues.push({id:u.id,message:'View cue needs repair'});else if(u.cue&&!cueInScope(e,u))issues.push({id:u.id,message:'View cue signal is outside this activation scope'});continue;}
  const d=e.definitions[u.definitionId];if(!d){issues.push({id:u.id,message:'Definition missing'});continue;}
  if(d.kind==='control'&&!resolveCapability(scene,d.subjectId,d.capabilityId))issues.push({id:u.id,message:'Subject or capability unavailable'});
  if(u.kind==='interaction'&&!scene.subjects[u.triggerSubjectId])issues.push({id:u.id,message:'Activation subject missing'});
  if(u.availability&&!e.presentations[u.availability])issues.push({id:u.id,message:'Availability Presentation missing'});
  const scope=activationScope(u);if(scope&&!e.presentations[scope])issues.push({id:u.id,message:'Activation Presentation missing'});
  // A station invocation is one authored trigger: its Seam must still exist and still be adjacent, or the
  // Activity can never be invoked anywhere. The route and its station are validated where they are read
  // (Camera travel), never copied into Experience.
  if(u.start.kind==='station'){const seam=u.start.seam;
   if(!seam||!e.stops[seam.from]||!e.stops[seam.to])issues.push({id:u.id,message:'Station invocation needs repair'});
   else if(resolveNext(e,seam.from).id!==seam.to)issues.push({id:u.id,message:'Station invocation Seam needs repair'});}
  if(u.start.kind==='after'&&!supportedSignal(e,scene,u.start))issues.push({id:u.id,message:'Start signal needs repair'});
  else if(u.start.kind==='after'&&!dependencyInScope(e,u))issues.push({id:u.id,message:'Start dependency signal is outside this activation scope'});
  for(const b of [u.end,u.retention])if(b?.kind==='visit'&&(!boundaryScope(u,b)||!e.presentations[boundaryScope(u,b)]))issues.push({id:u.id,message:'Boundary Presentation missing'});
  const seen=new Set([u.id]);let dependency=u;
  while(dependency?.start.kind==='after'){if(seen.has(dependency.start.useId)){issues.push({id:u.id,message:'Dependency cycle'});break;}seen.add(dependency.start.useId);dependency=e.uses[dependency.start.useId];if(!dependency)issues.push({id:u.id,message:'Start dependency missing'});}
 }
 return issues;
}
export function reuseView(e,c,pid,vid){if(!c.views[vid]||!e.presentations[pid])throw Error('Reuse target unresolved');const id=fresh(e,'use');e.uses[id]={id,kind:'view',name:c.views[vid].name,presentationId:pid,viewId:vid,role:'choice',cue:null};e.presentations[pid].uses.push(id);return id;}
export { resolveCamera as lowerCamera } from './camera-evaluation.js';
// One authority for what a station may invoke: automatic work whose signal this Scene can actually
// produce. The model refuses anything else and the coordination picker offers exactly the same set, so
// the contract and the surface can never disagree about what a traversal is allowed to start.
// The return value is the refusal the author would read; '' means the use is invokable.
export function invokableRefusal(e,scene,u){
 if(!u)return 'Choose a supported capability or narration contribution';
 const d=e?.definitions[u.definitionId];
 if(u.viewId)return 'A Camera View is not an Activity';
 if(!d)return 'Choose a supported capability or narration contribution';
 if(u.kind==='interaction')return 'A visitor offer is activated by its subject; bind a separate Activity to invoke automatically';
 if(d.kind==='narration')return '';
 if(d.kind!=='control')return 'Unsupported invocation target';
 const cap=scene&&capability(scene,d.subjectId,d.capabilityId);
 if(scene&&!cap)return 'Capability is unavailable in this Scene';
 if(cap&&!isRealized(cap))return 'Capability is declared by the provider but not realized by this Stage';
 return '';
}
// A station invocation is the Activity's trigger, never a second one. Binding an existing use to a
// station replaces its entry/Experience/dependency activation, so the same work can never run on entry
// and again at the station; an author who wants both captures a separate Activity. Only supported
// automatic work can be invoked — a visitor offer belongs to its subject and is never traversal work —
// and one Activity is invoked by one station, so a transition executes it exactly once. Invoking an
// Activity whose beat already exists re-asserts the binding rather than adding a second beat, which is
// also the repair after the author moves the trigger elsewhere in the Card.
// ----- C9.6 revision and repair (J8) -------------------------------------
// Bounded, real operations through identity-safe writers. Nothing here clones the graph, forks a
// Presentation, silently promotes retained content or converts a missing framing into an intentional
// hold; every operation keeps reusable definitions, stable ids and repairable references.

// Rename a Presentation in place: identity and every shared Stop/View use are untouched.
export function renamePresentation(e,pid,name) {
 const p=e.presentations[pid];if(!p)throw Error('Presentation removed');
 p.name=String(name??'');return p.name;
}
// Remove a Presentation and its own Guide occurrences. Its contributions, View uses and shared
// definitions are deliberately retained: a later reader can still repair or remove them through their
// selected-item writer, and nothing is silently rehomed or promoted to an Experience-start trigger.
// Camera Views are never deleted — an unreferenced View is not Experience garbage.
export function removePresentation(e,pid) {
 if(!e.presentations[pid])return null;
 const stops=Object.values(e.stops).filter(s=>s.presentationId===pid).map(s=>s.id);
 const uses=Object.values(e.uses).filter(u=>u.presentationId===pid).map(u=>u.id);
 delete e.presentations[pid];
 for(const id of stops){e.guide=e.guide.filter(x=>x!==id);delete e.stops[id];}
 // Authored choices survive the removal: a labelled detour/go whose target left with this Presentation
 // keeps its label and its now-unresolved target, so it reads as a repairable reference rather than
 // disappearing. A pre-existing broken choice unrelated to this removal is never purged either — only
 // explicit Next targets are left dangling, because they were always meant to be repairable.
 for(const [key,seam] of Object.entries(e.seams))if(!e.stops[seam.from]||!e.stops[seam.to])delete e.seams[key];
 return {stops,uses};
}
// Remove one contribution use. A View use is unlinked locally; the Camera View is never deleted, and a
// Stop that entered through it keeps an explicit, repairable missing entry rather than a hold.
export function removeContribution(e,id) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 if(u.viewId){const p=e.presentations[u.presentationId];if(p)p.uses=p.uses.filter(x=>x!==id);}
 // A Stop that entered through this use keeps its explicit reference, so it reads as a repairable
 // missing entry rather than being silently rewritten to a hold or another View.
 delete e.uses[id];
 return {id,viewId:u.viewId||null,definitionId:u.definitionId||null};
}
// Duplicate a use as a new identity, optionally rehomed. A View duplicate shares the Camera View (Camera
// is never cloned); a contribution duplicate gets its own definition copy, so editing one never mutates
// the other. This is an explicit copy, never a fork of the whole Presentation.
export function duplicateContribution(e,id,pid=undefined) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 const home=pid===undefined?u.presentationId:pid;
 const nid=fresh(e,'contribution');
 if(u.viewId){e.uses[nid]={...copy(u),id:nid,stopId:null,role:u.role==='entry'?'choice':u.role};
  if(home&&e.presentations[home])e.presentations[home].uses.push(nid);}
 else{
  const did=fresh(e,'definition'),d=e.definitions[u.definitionId]?{...copy(e.definitions[u.definitionId]),id:did}:null;
  if(d)e.definitions[did]=d;
  e.uses[nid]={...copy(u),id:nid,presentationId:home,definitionId:did,primary:false,primaryFor:undefined};
 }
 return nid;
}
// Make this use's shared definition local: the use keeps its identity and values, but it now owns a copy
// and later edits no longer reach other uses.
export function makeDefinitionLocal(e,id) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 const d=e.definitions[u.definitionId];if(!d)throw Error('Definition missing');
 const did=fresh(e,'definition');e.definitions[did]={...copy(d),id:did};
 u.definitionId=did;return did;
}
// Link this use to an existing shared definition, so the same reusable truth drives both uses.
export function linkDefinition(e,id,definitionId) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 if(!e.definitions[definitionId])throw Error('Target definition missing');
 u.definitionId=definitionId;return definitionId;
}
// Rename the shared definition a use reads. Reach is whichever uses link to it.
export function renameContribution(e,id,name) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 const d=e.definitions[u.definitionId];if(!d)throw Error('Definition missing');
 d.name=String(name??'');return d.name;
}
// The value a declared capability's own domain can hold. A replacement keeps the authored value where the
// new descriptor supports it and adapts it where it does not, so a repaired Activity is never left
// carrying a value Preview can only report as unsupported. A range domain takes the nearest supported
// number (its maximum for a formerly-on toggle); the boolean domains take the truth of the old value.
export function compatibleValue(cap,value) {
 if(!cap)return value;
 if(cap.control==='range'){const min=cap.min??0,max=cap.max??1,n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):max;}
 return !(value===false||value===0||value==null);
}
// Rebind a contribution to a compatible descriptor/target, preserving its identity, home, activation and
// boundary. Trigger and target stay distinct: an offer's activation subject is never silently changed by
// rebinding the subject it operates. A descriptor replacement validates the value it keeps, because the
// definition a linked Activity reads must hold work this Stage can actually run.
export function rebindContribution(e,id,patch,scene=null) {
 const u=e.uses[id];if(!u)throw Error('Contribution removed');
 const d=e.definitions[u.definitionId];if(!d)throw Error('Definition missing');
 const replacing=patch.subjectId!==undefined||patch.capabilityId!==undefined;
 if(patch.subjectId!==undefined)d.subjectId=patch.subjectId;
 if(patch.capabilityId!==undefined)d.capabilityId=patch.capabilityId;
 if(patch.value!==undefined)d.value=copy(patch.value);
 if(patch.triggerSubjectId!==undefined)u.triggerSubjectId=patch.triggerSubjectId||null;
 if(patch.availability!==undefined)u.availability=patch.availability||null;
 if(replacing&&d.kind==='control'&&scene){const cap=capability(scene,d.subjectId,d.capabilityId);if(cap)d.value=compatibleValue(cap,d.value);}
 return u;
}
// An authored choice names the Stop it continues to. Its destination is read as a real reference: a target
// that left with its Presentation is reported as an unresolved destination rather than as a valid one.
export function choiceTarget(e,choice) {
 const s=choice&&e.stops[choice.targetId];
 return s?{missing:false,id:s.id,name:s.name,at:e.guide.indexOf(s.id)}:{missing:true,id:choice?.targetId||null,name:null,at:-1};
}
// Point one authored choice at another existing Stop: the choice, its label and its kind are untouched.
export function repointChoice(e,stopId,choiceId,targetId) {
 const s=e.stops[stopId];if(!s)throw Error('Stop removed');
 const c=s.choices.find(c=>c.id===choiceId);if(!c)throw Error('Choice removed');
 if(!e.stops[targetId])throw Error('Choose an existing Stop as the destination');
 c.targetId=targetId;return c;
}
// Remove exactly one authored choice. Nothing else on the Stop is touched.
export function removeChoice(e,stopId,choiceId) {
 const s=e.stops[stopId];if(!s)throw Error('Stop removed');
 const at=s.choices.findIndex(c=>c.id===choiceId);if(at<0)throw Error('Choice removed');
 return s.choices.splice(at,1)[0];
}
// Retained contributions whose organizational home no longer resolves: the Experience-level inventory the
// plan requires, so a repair writer is reachable without opening (or resurrecting) the removed home.
export function orphanContributions(e) {
 return Object.values(e.uses).filter(u=>u.presentationId&&!e.presentations[u.presentationId])
  .map(u=>({id:u.id,kind:u.kind,viewId:u.viewId||null,removedHome:u.presentationId,name:e.definitions[u.definitionId]?.name||u.name||u.id}));
}
// Definition reach by linked use, independent of organizational home. The primary-explanation binding is
// included even after regrouping, because reach follows the definition, not the home.
export function definitionReachByUse(e,definitionId) {
 return Object.values(e.uses).filter(u=>u.definitionId===definitionId).map(u=>({id:u.id,name:u.name||e.definitions[definitionId]?.name||u.id,home:u.presentationId?e.presentations[u.presentationId]?.name||'Missing Presentation':'Experience scope'}));
}

export function addInvocationBeat(e,c,a,b,connectionId,stationId,useId,scene=null) {
 const u=e.uses[useId],refusal=invokableRefusal(e,scene,u);
 if(refusal)throw Error(refusal);
 const seam=getSeam(e,a,b),prior=seam.beats.find(x=>x.kind==='invoke'&&x.useId===useId&&x.connectionId===connectionId&&x.stationId===stationId);
 const bound=u.start.kind==='station'&&u.start.seam?.from===a&&u.start.seam?.to===b&&u.start.connectionId===connectionId&&u.start.stationId===stationId;
 if(u.start.kind==='station'&&!bound)throw Error('Already invoked by another Seam station; capture a separate Activity for this one');
 let id=prior?.id;
 if(!id){id=addBeat(e,c,a,b,connectionId,stationId,0);const beat=e.seams[seamKey(a,b)].beats.find(x=>x.id===id);beat.kind='invoke';beat.useId=useId;delete beat.seconds;}
 // The destination visit is the only place this run exists: its output, captions and boundary all read
 // from that visit, exactly as the invocation itself does.
 u.start={kind:'station',seam:{from:a,to:b},connectionId,stationId,presentationId:e.stops[b]?.presentationId??u.presentationId};
 return id;
}
