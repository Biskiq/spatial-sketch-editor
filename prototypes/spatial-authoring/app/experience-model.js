// Prototype-local authored domains. These are not production document interfaces.
export const copy = (v) => structuredClone(v);
export function createExperience() {
  return { serial: 0, presentations: { 'pres-highlights': { id: 'pres-highlights', name: 'Saltmarsh Highlights', meaning: '', focus: { kind: 'subjects', ids: ['gwin'] }, uses: [] } }, uses: {}, stops: {}, guide: [], seams: {}, definitions: {} };
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
 if(role==='entry') for(const other of e.presentations[u.presentationId].uses) if(e.uses[other]?.role==='entry') e.uses[other].role='choice';
 u.role=role;
}
export function removeView(e,c,id) {
 // Never convert a missing entry to intentional hold. References remain repairable.
 delete c.views[id];
}
export function resolveUse(e,c,id) { const u=e.uses[id]; return u&&c.views[u.viewId] ? {use:u,view:c.views[u.viewId]}:null; }
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
 return {id:uid||null,hold:!uid&&s.entry.kind==='presentation',missing:!!uid&&!e.uses[uid]};
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
 const origins=e.presentations[from?.presentationId]?.uses.map(id=>e.uses[id]).filter(Boolean)||[];
 return origins.map(u=>({useId:u.id,viewId:u.viewId,targetId:target?.view.id||null,connectionId:Object.values(c.connections).find(k=>k.from===u.viewId&&k.to===target?.view.id)?.id||null,missing:!c.views[u.viewId]||!target}));
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
 e.uses[id]={id,kind,definitionId:did,presentationId:pid,triggerSubjectId:trigger||definition.subjectId||null,start:{kind:pid?'visit':'experience'},end:{kind:pid?'visit':'experience'},interruption:null,availability:pid,toggle:false};
 return id;
}
export function narrationDuration(d) {return d.duration ?? Math.max(1,d.text.trim().split(/\s+/).filter(Boolean).length/2.5);}
export function cueSeconds(e,cue) {
 const u=e.uses[cue?.useId],d=e.definitions[u?.definitionId];if(d?.kind!=='narration')return null;
 if(cue.signal==='complete')return narrationDuration(d);
 const m=d.markers.find(m=>`marker:${m.id}`===cue.signal);return m?m.fraction*narrationDuration(d):null;
}
export function contributionIssues(e,c,scene,capability) {
 const issues=[];
 for(const u of Object.values(e.uses)) {
  if(u.viewId) {if(!c.views[u.viewId])issues.push({id:u.id,message:'Framing removed; repair or explicitly keep viewpoint'});continue;}
  const d=e.definitions[u.definitionId];if(!d){issues.push({id:u.id,message:'Definition missing'});continue;}
  if(d.kind==='control'&&!capability(scene,d.subjectId,d.capabilityId))issues.push({id:u.id,message:'Subject or capability unavailable'});
  if(u.kind==='interaction'&&!scene.subjects[u.triggerSubjectId])issues.push({id:u.id,message:'Activation subject missing'});
  const seen=new Set([u.id]);let dependency=u;
  while(dependency?.start.kind==='after'){if(seen.has(dependency.start.useId)){issues.push({id:u.id,message:'Dependency cycle'});break;}seen.add(dependency.start.useId);dependency=e.uses[dependency.start.useId];if(!dependency)issues.push({id:u.id,message:'Start dependency missing'});}
 }
 return issues;
}
export function reuseView(e,c,pid,vid){if(!c.views[vid]||!e.presentations[pid])throw Error('Reuse target unresolved');const id=fresh(e,'use');e.uses[id]={id,kind:'view',name:c.views[vid].name,presentationId:pid,viewId:vid,role:'choice',cue:null};e.presentations[pid].uses.push(id);return id;}
export function lowerCamera(c,positions) {
 const derived=copy(c);
 for(const v of Object.values(derived.views)) {
  if(v.focus?.kind!=='subjects')continue;
  const current=positions[v.focus.ids[0]];if(!current){v.unresolved=true;continue;}
  if(v.anchor==='relative')v.pose.target=current.map((n,i)=>n+(v.focusOffset?.[i]||0));
  else if(v.focusAt&&current.some((n,i)=>Math.abs(n-v.focusAt[i])>1e-6))v.review='World changed — review fixed framing';
 }
 return derived;
}
export function addInvocationBeat(e,c,a,b,connectionId,stationId,useId) {
 const u=e.uses[useId];if(!u||u.viewId)throw Error('Choose a supported capability or narration contribution');
 const id=addBeat(e,c,a,b,connectionId,stationId,0),beat=e.seams[seamKey(a,b)].beats.find(b=>b.id===id);beat.kind='invoke';beat.useId=useId;return id;
}
