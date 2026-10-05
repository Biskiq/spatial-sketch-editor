// Prototype-local authored domains. These are not production document interfaces.
import { capability } from './experience-capabilities.js';
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
 if(role==='entry') for(const other of e.presentations[u.presentationId].uses) if(e.uses[other]?.role==='entry') e.uses[other].role='choice';
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
 const entry=stopEntry(e,a).id;
 const ids=[...(e.presentations[from?.presentationId]?.uses||[]).filter(id=>id===entry||e.uses[id]?.role==='choice'||e.uses[id]?.cue),entry].filter(Boolean);
 const origins=[...new Set(ids)].map(id=>e.uses[id]).filter(u=>u?.viewId);
 return origins.map(u=>({useId:u.id,viewId:u.viewId,targetId:target?.view.id||null,connectionId:Object.values(c.connections).find(k=>k.from===u.viewId&&k.to===target?.view.id)?.id||null,missing:!c.views[u.viewId]||!!c.views[u.viewId].unresolved||!target}));
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
export function primaryExplanation(e,pid) {
 return nonViewUses(e,pid).find(u=>u.primary&&e.definitions[u.definitionId]?.kind==='narration')||null;
}
// The ordinary creator path: the first non-empty accepted text creates one narration use; every later
// edit updates that same use, so the explanation never becomes two independently editable authorities.
export function setPrimaryExplanation(e,pid,text) {
 if(!e.presentations[pid])throw Error('Presentation missing');
 const current=String(text??'');
 const u=primaryExplanation(e,pid);
 if(u){const d=e.definitions[u.definitionId];if(!d)throw Error('Explanation definition missing');d.text=current;return{id:u.id,created:false};}
 if(!current.trim())return null;
 const id=addContribution(e,pid,{kind:'narration',name:'Explanation',text:current,markers:[]},'narration');
 e.uses[id].primary=true;
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
export function contributionIssues(e,c,scene,resolveCapability=capability) {
 const issues=[];
 for(const u of Object.values(e.uses)) {
  if(u.viewId) {if(!c.views[u.viewId])issues.push({id:u.id,message:'Framing removed; repair or explicitly keep viewpoint'});if(u.cue&&!supportedSignal(e,scene,u.cue))issues.push({id:u.id,message:'View cue needs repair'});continue;}
  const d=e.definitions[u.definitionId];if(!d){issues.push({id:u.id,message:'Definition missing'});continue;}
  if(d.kind==='control'&&!resolveCapability(scene,d.subjectId,d.capabilityId))issues.push({id:u.id,message:'Subject or capability unavailable'});
  if(u.kind==='interaction'&&!scene.subjects[u.triggerSubjectId])issues.push({id:u.id,message:'Activation subject missing'});
  if(u.availability&&!e.presentations[u.availability])issues.push({id:u.id,message:'Availability Presentation missing'});
  const scope=activationScope(u);if(scope&&!e.presentations[scope])issues.push({id:u.id,message:'Activation Presentation missing'});
  if(u.start.kind==='after'&&!supportedSignal(e,scene,u.start))issues.push({id:u.id,message:'Start signal needs repair'});
  for(const b of [u.end,u.retention])if(b?.kind==='visit'&&(!boundaryScope(u,b)||!e.presentations[boundaryScope(u,b)]))issues.push({id:u.id,message:'Boundary Presentation missing'});
  const seen=new Set([u.id]);let dependency=u;
  while(dependency?.start.kind==='after'){if(seen.has(dependency.start.useId)){issues.push({id:u.id,message:'Dependency cycle'});break;}seen.add(dependency.start.useId);dependency=e.uses[dependency.start.useId];if(!dependency)issues.push({id:u.id,message:'Start dependency missing'});}
 }
 return issues;
}
export function reuseView(e,c,pid,vid){if(!c.views[vid]||!e.presentations[pid])throw Error('Reuse target unresolved');const id=fresh(e,'use');e.uses[id]={id,kind:'view',name:c.views[vid].name,presentationId:pid,viewId:vid,role:'choice',cue:null};e.presentations[pid].uses.push(id);return id;}
export { resolveCamera as lowerCamera } from './camera-evaluation.js';
export function addInvocationBeat(e,c,a,b,connectionId,stationId,useId) {
 const u=e.uses[useId];if(!u||u.viewId)throw Error('Choose a supported capability or narration contribution');
 const id=addBeat(e,c,a,b,connectionId,stationId,0),beat=e.seams[seamKey(a,b)].beats.find(b=>b.id===id);beat.kind='invoke';beat.useId=useId;return id;
}
