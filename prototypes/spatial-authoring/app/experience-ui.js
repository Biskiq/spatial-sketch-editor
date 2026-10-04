import { capability, capabilities } from './experience-capabilities.js';
import { gateState, narrationCaption } from './experience-runtime.js';
import { resolvedCamera, readingFor } from './navigation.js';
import { eye, routeGeometry } from './camera-evaluation.js';
import { stations } from './camera-evaluation.js';
import { coordinateTiming, movementTiming } from './experience-coordination.js';
import { originCoverage, getSeam, resolveNext, stopEntry, viewReach, contributionIssues, captureUses, primaryExplanation } from './experience-model.js';
import { S, ctx, thing } from './state.js';
import { resolveExperience, experienceParkedContext, quickstart } from './experience.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(act,text,id='',role='action')=>`<button class="exp-action ${act.startsWith('exp-remove-')?'destructive':role}" data-act="${act}" data-id="${esc(id)}">${text}</button>`;
export function experienceIndex() {
  const e = ctx.experience;
  return `<div class="ix-head"><span class="ix-title">Experience</span><span class="ix-note">Meaning in the same World</span></div><div class="ix-group">Presentations</div>`
  + Object.values(e.presentations).map(p => `<div class="ix-row${S.sel === p.id ? ' sel' : ''}"><button class="ix-go" data-act="exp-open" data-id="${p.id}"><span class="glyph pres"></span><span class="ix-name">${esc(p.name)}</span></button></div>`).join('')
  + (e.guide.length ? `<div class="ix-group">Guide</div><div class="ix-row"><button class="ix-go" data-act="exp-guide">${esc(e.name)} · ${e.guide.length} Stops</button></div>` : '')
  + `<div class="ix-group">Scene subjects</div><div class="ix-note">Select an existing identity; presenting it is explicit.</div>${Object.values(ctx.sceneSource.subjects).map(s=>`<div class="ix-row"><button class="ix-go" data-act="pres-ref" data-id="${s.id}">${esc(s.name)}</button></div>`).join('')}<div class="c-acts">${button('exp-create','+ Presentation')}${button('exp-environment','Present environment')}${button('exp-region','Present region')}</div>`;
}
const reuseCount=id=>Object.values(ctx.experience.stops).filter(s=>s.presentationId===id).length;
const valueLabel=(cap,v)=>{if(!cap)return String(v);if(cap.control==='range')return String(Number(v));if(cap.kind==='playback')return v?'Playing':'Stopped';return v?'On':'Off';};
const auditioned=(s,cap)=>S.expAudition?.[s.id]?.[cap.channel]??s.properties[cap.channel];
const meaningHtml=p=>`<div class="c-sec">Name · intent · shared Presentation</div><label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label><label class="exp-label">Intent<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label><p class="c-hint">Intent is a summary for the author; only the explanation is heard.</p>`;
const nameHtml=p=>`<label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label>`;
const intentHtml=p=>`<label class="exp-label">Intent<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label><p class="c-hint">Intent is a summary for the author; only the explanation is heard.</p>`;
// The condition a captured Activity would be created or updated in: the named working Presentation,
// or explicitly Experience scope.
const captureScope=()=>S.experienceContext.presentation;
function experienceCardBody(){
 const r=resolveExperience(S.sel),e=ctx.experience,c=resolvedCamera();
 if(r?.kind==='Presentation'){
  const p=r.item,focus=p.focus.kind==='subjects'?p.focus.ids.map(id=>`${esc(thing(id)?.item.name||id)} ${button('pres-ref','Select',id,'reference')}`).join(', '):esc(p.focus.kind);
  const explanation=primaryExplanation(e,p.id),text=explanation?e.definitions[explanation.definitionId]?.text||'':'';
  const others=Object.values(e.uses).filter(u=>u.presentationId===p.id&&!u.viewId&&!u.primary).length;
  const subjectId=p.focus.kind==='subjects'?p.focus.ids[0]:null;
  return `<div class="c-head"><div class="c-k">Presentation · Experience</div><div class="c-t">${esc(p.name)}</div><div class="c-ref">${reuseCount(p.id)} Guide occurrences · ${p.uses.length} Views</div></div>${nameHtml(p)}<label class="exp-label">What the visitor hears in Preview<textarea data-exp-primary data-id="${p.id}" placeholder="Write one sentence the visitor will hear.">${esc(text)}</textarea></label><div class="c-sec">Focus</div><div class="exp-focus">${focus}${subjectId?`<br>${button('pres-ref','Operate '+esc(thing(subjectId)?.item.name||subjectId),subjectId,'reference').replace('data-id=',`data-operate="${subjectId}" data-id=`)}`:''}</div><div class="c-sec">Show · unordered Set</div>${setHtml(p)}<div class="c-acts">${button('exp-auto','Auto')}${button('exp-hints','Hints')}${button('exp-capture','Capture','', 'primary')}${button('exp-bring','Bring into view')}${button('exp-add-guide','Add to Guide',p.id)}</div><details class="exp-more"><summary>Reuse a Camera View</summary><select data-exp-reuse="${p.id}"><option value="">Choose Camera View</option>${Object.values(c.views).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></details><details class="exp-more"><summary>Intent · shared summary</summary>${intentHtml(p)}</details><details class="exp-more"><summary>Additional contributions · ${others}</summary>${button('exp-narration','Add narration')}${contributionsHtml(p.id)}</details><details class="exp-more"><summary>Advanced · add behavior or offer</summary><div class="c-acts">${button('exp-offer','Add behavior or offer')}</div>${offerHtml()}</details>${askHtml()}`;
 }
 if(r?.kind==='Stop'){
  const p=e.presentations[r.item.presentationId],entry=stopEntry(e,r.item.id),view=c.views[e.uses[entry.id]?.viewId];
  return `<div class="c-head"><div class="c-k">This Stop · ${e.guide.indexOf(r.item.id)+1}</div><div class="c-t">${esc(p?.name||'Missing Presentation')}</div><div class="c-ref">Owner · Experience · occurrence ×1<br>Entry, Next, Pacing and Gate affect this Stop.<br>Meaning and Set affect all ${reuseCount(p?.id)} Stops.</div></div><div class="c-sec">This occurrence</div><div class="exp-fact">Entry · ${esc(view?.name||(entry.hold?'Keep current viewpoint':'Repair required'))}</div>${stopDetails(r.item)}${coordinationDetail()}<div class="c-sec">Shared Presentation · ${reuseCount(p?.id)} occurrences</div>${p?`<p class="exp-fact">${esc(p.meaning)}</p>${setHtml(p)}<details class="exp-more"><summary>Edit shared Meaning</summary>${meaningHtml(p)}</details>${button('exp-open','Open shared Presentation',p.id,'reference')}`:'Repair required'}${askHtml()}`;
 }
 if(r?.kind==='View use'&&!r.item.viewId)return activityCard(r.item);
 if(r?.kind==='View use'||r?.kind==='Camera View'){
  const v=c.views[r.kind==='View use'?r.item.viewId:r.item.id],reach=v?viewReach(e,v.id):{uses:[],stops:[]},p=e.presentations[r.item.presentationId];
  return `<div class="c-head"><div class="c-k">${r.kind} · ${r.owner}</div><div class="c-t">${esc(v?.name||'Missing framing')}</div><div class="c-ref">Owner · Experience role / Camera framing<br>${p?'In '+esc(p.name)+(r.item.stopId?' · this Stop entry':' · shared Presentation Set')+'<br>':''}Reach · ${reach.uses.length} uses · ${reach.stops.length} Stops</div></div><div class="c-sec">Camera framing</div><p class="exp-fact">${esc(v?.anchor||'Unresolved')} · Perspective${v?.review?'<br>'+esc(v.review):''}</p><div class="c-acts">${r.kind==='View use'&&v?button('exp-precise','Precise Camera',r.item.id):''}${button('exp-bring','Bring into view')}</div>${r.kind==='View use'&&!r.item.stopId?`<div class="c-sec">Current use · Experience</div><p class="exp-fact">${esc(r.item.role)}</p><div class="c-acts">${button('exp-role','Entry',r.item.id).replace('data-id=','data-role="entry" data-id=')}${button('exp-role','Visitor choice',r.item.id).replace('data-id=','data-role="choice" data-id=')}</div>${cueSelect(r.item.id)}`:''}${askHtml()}`;
 }
 const s=ctx.sceneSource.subjects[S.sel];
 if(s)return experienceSubjectCard(s);
 const t=thing(S.sel);
 if(S.sel&&!t)return `<div class="c-head"><div class="c-k">Unavailable selected identity</div><div class="c-t">Source no longer resolves</div></div><p class="c-hint">Select a resolving identity. Accepted work cannot silently retarget.</p>`;
 return `<div class="c-head"><div class="c-k">${t?'From the World lens':'Experience'}</div><div class="c-t">${esc(t?.item.name||'Meaning in this World')}</div></div><p class="c-hint">Create or open a Presentation explicitly.</p><div class="c-acts">${button('exp-create',t?'Present this':'+ Presentation')}</div>`;
}
export function experienceCard(){const html=experienceCardBody().replaceAll(askHtml(),'');return html.replace('<div class="c-sec">',askHtml()+'<div class="c-sec">');}
export const foreignExperienceCard = () => {
  const r = resolveExperience(S.sel);
  return r ? `<div class="c-head"><div class="c-k">Foreign identity · not a World subject</div><div class="c-t">${esc(r.item.name || r.kind)}</div><div class="c-ref">${r.owner} · ${esc(r.item.id)}</div></div><p class="c-hint">Select a World subject to work on the building.</p>` : '';
};

// The honest identity of a captured Activity: what it operates, with which value, where it belongs
// and how it starts. Raw use/definition vocabulary is never the required reading.
function activityCard(u){
 const e=ctx.experience,d=e.definitions[u.definitionId],cap=d?.kind==='control'?capability(ctx.sceneSource,d.subjectId,d.capabilityId):null,p=e.presentations[u.presentationId];
 const subjectName=d?.kind==='control'?(ctx.sceneSource.subjects[d.subjectId]?.name||null):null;
 return `<div class="c-head"><div class="c-k">Activity · Experience</div><div class="c-t">${esc(d?.name||'Missing contribution')}</div><div class="c-ref">${esc(p?`In ${p.name}`:'Experience scope')} · owner Experience · occurrence ×1</div></div>`
  +(d?`<div class="c-sec">Identity</div><p class="exp-fact">${d.kind==='control'?`Operates ${esc(subjectName||'Missing subject')} · ${esc(cap?.label||d.capabilityId)} · ${esc(valueLabel(cap,d.value))}`:esc(d.text||'')}<br>${u.kind==='interaction'?`Activated by ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'Missing activation')}`:'Automatic · not a visitor offer'}<br>${u.kind==='interaction'?`Availability · ${u.availability?esc(e.presentations[u.availability]?.name||'Missing Presentation'):'Experience-wide'}`:`Starts · ${u.start.kind==='visit'?'on Presentation entry':u.start.kind==='after'?'after a supported dependency':'with the Experience'} · Ends · ${u.end.kind==='visit'?'with the visit':'at Experience end'}`}</p>`:'<p class="c-hint">Repair required.</p>')
  +`<div class="c-acts">${d?.kind==='control'?button('pres-ref','Operate '+(subjectName||'subject'),d.subjectId):''}${button('exp-remove-contribution','Remove',u.id)}</div>${askHtml()}`;
}
// The selected World subject in Experience: subject-local descriptor controls operate an ephemeral
// audition; Use in Experience captures it as an Activity in the named working Presentation (or
// explicitly at Experience scope) and updates a uniquely matching capture instead of duplicating it.
function experienceSubjectCard(s){
 const caps=capabilities(ctx.sceneSource,s.id),pid=captureScope(),p=pid?ctx.experience.presentations[pid]:null;
 const rows=caps.map(cap=>{
  const value=auditioned(s,cap),matches=captureUses(ctx.experience,pid,s.id,cap.id),held=matches.length===1?matches[0]:null;
  const scoped=matches.filter(u=>u.presentationId===pid).length;
  const control=cap.control==='range'
   ?`<input type="number" min="${cap.min??0}" max="${cap.max??1}" step=".1" data-exp-audition="${cap.id}" data-id="${s.id}" value="${Number(value)}" aria-label="${esc(cap.label)} audition">`
   :`<div class="c-acts"><button class="exp-action" data-act="exp-audition" data-id="${s.id}" data-cap="${cap.id}" data-value="true" aria-pressed="${value===true}">${cap.kind==='state'?'On':'Play'}</button><button class="exp-action" data-act="exp-audition" data-id="${s.id}" data-cap="${cap.id}" data-value="false" aria-pressed="${value===false}">${cap.kind==='state'?'Off':'Stop'}</button></div>`;
  const capture=pid
   ?`<button class="exp-action ${held?'':'primary'}" data-act="exp-use" data-id="${s.id}" data-cap="${cap.id}">${held?(scoped?`Update captured ${esc(cap.label)}`:`Capture in ${esc(p.name)}`):`Use in ${esc(p.name)}`}</button>`
   :`<button class="exp-action primary" data-act="exp-use-scope" data-id="${s.id}" data-cap="${cap.id}">Use at Experience scope</button>`;
  return `<div class="exp-cap"><div class="exp-fact"><b>${esc(cap.label)}</b> · ${esc(cap.kind)} · ${cap.sourceEditable?'source-editable':'session only'}<br>Audition · ${esc(valueLabel(cap,value))}${held?` · Captured${scoped?' in this Presentation':' (another Presentation)'}`:''}${matches.length>1?` · ${matches.length} captured uses — choose which to update`:''}</div><label class="exp-label">Try it ${control}</label><p class="c-hint">Temporary projection; source and history are untouched.</p><div class="c-acts">${capture}${matches.length>1?matches.map(u=>button('exp-capture-choice',`Update ${esc(ctx.experience.definitions[u.definitionId]?.name||'capture')}`,u.id)).join('')+button('exp-capture-new','Capture another'):''}</div></div>`;
 }).join('');
 const offers=button('exp-offer','Let visitors activate…',s.id).replace('data-id=',`data-kind="interaction" data-id=`);
 return `<div class="c-head"><div class="c-k">From the World lens</div><div class="c-t">${esc(s.name)}</div><div class="c-ref">Scene · ${esc(s.id)}<br>Selection stays this subject; the Presentation is named explicitly.</div></div>`
  +(caps.length?`<div class="c-sec">Capabilities · operate, then Use</div>${rows}`:'<p class="c-hint">This subject declares no capabilities in the current profile.</p>')
  +`<div class="c-sec">Presentation</div><div class="c-acts">${button('exp-create','Present this')}${offers}${S.expAudition?.[s.id]?button('exp-audition-clear','Clear audition',s.id):''}</div>${offerHtml()}${S.expCaptureAsk?captureAskHtml():''}${askHtml()}`;
}
function captureAskHtml(){
 const ask=S.expCaptureAsk;
 if(!ask)return '';
 return `<div class="ask-rule"><b>Choose the capture to update</b><p>${ask.matches.length} captured uses match this operation. Updating one never changes the others.</p>${ask.matches.map(u=>button('exp-capture-choice',ctx.experience.definitions[ctx.experience.uses[u]?.definitionId]?.name||'This capture',u)).join('')}${button('exp-capture-new','Capture another')}${button('exp-capture-cancel','Cancel')}</div>`;
}

function coordinationDetail(){
 const x=S.experienceContext,t=S.task,e=ctx.experience,c=resolvedCamera();
 if(!x.seam||t?.kind!=='experience-coordination'||!t.params.connection)return '';
 const seam=getSeam(e,x.seam.from,x.seam.to),route=c.connections[t.params.connection];
 const station=route&&routeGeometry(c,route.id)?.stations.find(s=>s.id===t.params.station);
 const beats=seam.beats.filter(b=>b.connectionId===route?.id&&b.stationId===station?.id);
 if(!beats.length)return '';
 const destination=e.guide.indexOf(seam.to)+1;
 return `<div class="c-sec">Local coordination · task focus</div><div class="exp-fact" data-coordination-detail><b>At ${esc(station.label)}</b><br>Owner · Experience · Seam into Stop ${destination}<br>Reach · this transition ×1${beats.map(b=>`<p>${b.kind==='hold'?`Hold · ${b.seconds}s`:esc(e.definitions[e.uses[b.useId]?.definitionId]?.name||'Contribution needs repair')} · ${esc(station.label)}</p>`).join('')}</div>`;
}

export function setHtml(p){return `<div class="exp-set" aria-label="Unordered View Set">${p.uses.map(id=>{const u=ctx.experience.uses[id],v=resolvedCamera().views[u?.viewId];return `<div class="exp-view">${button('pres-ref',`◁ ${esc(v?.name||'Missing View')}`,id,'reference')}<span>${esc(u.role)}${v?.review?' · review':''}</span></div>`;}).join('')||'<p class="c-hint">Auto suggests a framing. Capture adds it to this Set.</p>'}</div>`;}
export function constellation(p){
 const c=resolvedCamera(),rows=p.uses.map(id=>({id,use:ctx.experience.uses[id],v:c.views[ctx.experience.uses[id]?.viewId]})).filter(r=>r.v),pts=rows.map(r=>eye(r.v.pose)),focus=rows[0]?.v.pose.target||[0,0,0];
 const extent=Math.max(1,...pts.map(p=>Math.hypot(p[0]-focus[0],p[2]-focus[2]))),at=p=>({x:100+(p[0]-focus[0])/extent*65,y:64+(p[2]-focus[2])/extent*42});
 return `<div class="set-constellation" aria-label="Schematic unordered View Set"><svg viewBox="0 0 200 128" aria-hidden="true">${rows.map((r,i)=>{const p=at(pts[i]);return `<path class="set-ray" d="M${p.x},${p.y}L100,64"/>`;}).join('')}<circle cx="100" cy="64" r="3" class="set-focus"/></svg>${rows.map((r,i)=>{const p=at(pts[i]);return `<button class="set-node ${S.sel===r.id?'selected':''}" style="left:${p.x/2}%;top:${p.y/1.28}%" data-act="pres-ref" data-id="${r.id}">◁ ${esc(r.v.name)}<small>${esc(r.use.role)}</small></button>`;}).join('')}</div>`;
}
export function renderExperienceSurfaces() {
 renderDeck();
 document.body.classList.toggle('visitor-preview',!!S.visitor);
 let el=document.querySelector('#visitorSurface');
 if(!el){el=document.createElement('section');el.id='visitorSurface';document.querySelector('#stage').append(el);}
 el.hidden=!S.visitor;
 const presenter=document.querySelector('#experienceExamples');
 if(presenter){
  presenter.hidden=S.lens!=='experience'||!!S.visitor;
  const steps=quickstart(),i=Math.max(0,Math.min(steps.length-1,S.experiencePresenter||0));
  const step=presenter.querySelector('[data-example-step]');
  if(step)step.textContent=`${i+1}/${steps.length} · ${steps[i].title}`;
  const instruction=presenter.querySelector('[data-example-instruction]');
  if(instruction)instruction.textContent=steps[i].instruction;
  const observed=presenter.querySelector('[data-example-observed]');
  if(observed){const done=steps[i].done();observed.textContent=`Observed · ${steps[i].observed()}${done?' · outcome seen':''}`;observed.dataset.done=String(done);}
 }
 if(S.visitor) { const html=visitorHtml();if(el._html!==html){el.innerHTML=html;el._html=html;} }

}

export function renderDeck(){
 let el=document.querySelector('#experienceDeck'),instrument=document.querySelector('#experienceInstrument');const e=ctx.experience,x=S.experienceContext;
 const cameraDepth=['hints','precision'].includes(x.depth);
 if(cameraDepth&&S.lens==='experience'&&!S.visitor){if(!instrument){instrument=document.createElement('section');instrument.id='experienceInstrument';document.querySelector('#stage').append(instrument);}const html=x.depth==='precision'?precisionHtml():hintsHtml();if(instrument._html!==html){instrument.innerHTML=html;instrument._html=html;}}else instrument?.remove();
 if(S.lens!=='experience'||S.visitor||!e.guide.length){el?.remove();document.body.classList.remove('guide-band');return;}
 if(!el){el=document.createElement('section');el.id='experienceDeck';document.body.append(el);}
 const depth=cameraDepth?'ordinary':x.depth;const home=depth==='ordinary'?document.querySelector('#stage'):document.body;if(el.parentElement!==home)home.append(el);el.className=`exp-deck ${depth}`;
 // The non-ordinary Guide band is fixed over the bottom of the viewport. It declares itself on the body
 // so the Card insets its own content and nothing in it becomes permanently unreachable behind the band.
 document.body.classList.toggle('guide-band',depth!=='ordinary');let html;
 if(depth==='ordinary')html=`<span>Guide · ${e.guide.length} Stops</span><div class="peek-occurrences">${e.guide.map((id,i)=>`<button class="peek-stop ${S.sel===id?'selected':''}" data-act="exp-stop" data-id="${id}" aria-label="Stop ${i+1}: ${esc(e.stops[id].name)}">${S.sel===id?'◉':'○'} ${i+1}</button>`).join('')}</div>${button('exp-guide','Overview')}`;
 else html=`<div class="deck-head"><b>Guide overview · ${e.guide.length} occurrences</b>${button('exp-close','Peek')}</div><div class="stop-strip">${e.guide.map((id,i)=>occurrenceHtml(id,i)).join('')}</div>`;
 if(x.seam&&['seam','route','coordination'].includes(depth))html=seamHtml(x.seam);
 if(el._html!==html){el.innerHTML=html;el._html=html;}
}
function subjectThumbnail(p){
 const subject=ctx.sceneSource.subjects[p?.focus.ids?.[0]],item=ctx.stage?.items.get(subject?.id),material=item?.mesh.userData.baseMat||item?.mesh.material;
 if(!subject||!material?.color)return `<div class="stop-thumbnail" aria-label="${esc(p?.focus.kind)} focus">◇</div>`;
 const color='#'+material.color.getHexString(),wide=subject.profile==='piano',short=subject.profile==='switch';
 return `<svg class="stop-thumbnail" viewBox="0 0 64 56" role="img" aria-label="${esc(subject.name)} · schematic thumbnail"><path d="M8,${short?32:16}l${wide?38:28},-8 12,8v24l-12,8L8,40Z" fill="${color}" stroke="currentColor"/><path d="M8,${short?32:16}l${wide?38:28},8 12,-8M${wide?46:36},24v24" fill="none" stroke="currentColor"/></svg>`;
}

function occurrenceHtml(id,i){
 const e=ctx.experience,x=S.experienceContext,s=e.stops[id],p=e.presentations[s.presentationId],current=Math.max(0,e.guide.indexOf(x.stop||S.sel)),entry=stopEntry(e,id),v=resolvedCamera().views[e.uses[entry.id]?.viewId],expanded=x.stop===id;
 return `${i?`<button class="seam-link" data-act="exp-seam" data-from="${e.guide[i-1]}" data-to="${id}" aria-label="Seam ${i} to ${i+1}">›</button>`:''}<article data-stop="${id}" class="stop-card ${expanded?'expanded':Math.abs(i-current)<=1?'density-summary':'compact'} ${S.sel===id?'selected':''}"><small>STOP ${i+1}</small>${button('exp-stop',esc(p?.name||'Missing Presentation'),id,'reference')}${expanded?`<div class="occurrence-content"><div><p>${esc(p?.meaning)}</p><small>This Stop entry · ${esc(v?.name||(entry.hold?'Hold viewpoint':'Repair required'))}</small><p class="scope-note">Shared Presentation · ${reuseCount(p?.id)} occurrences</p>${button('exp-move-stop','←',id).replace('data-id=','data-delta="-1" data-id=')}${button('exp-move-stop','→',id).replace('data-id=','data-delta="1" data-id=')}</div>${p?constellation(p):''}</div>`:Math.abs(i-current)<=1?`${subjectThumbnail(p)}<p class="stop-summary">${esc(p?.meaning)}</p><small>Entry · ${esc(v?.name||(entry.hold?'Hold viewpoint':'Repair required'))}</small>`:''}</article>`;
}
export function seamHtml({from,to}){
 const e=ctx.experience,c=resolvedCamera(),seam=getSeam(e,from,to),rows=originCoverage(e,c,from,to),reachable=rows.filter(r=>r.connectionId&&!r.missing).length,active=c.connections[S.task?.params.connection];
 const name=id=>e.presentations[e.stops[id]?.presentationId]?.name||'Missing Presentation';
 return `<div class="deck-head"><b>Seam ${e.guide.indexOf(from)+1} → ${e.guide.indexOf(to)+1} · ${seam.mode}</b><div>${button('exp-bring','Bring route into view')}${button('exp-close','Peek')}</div></div><div class="seam-unrelated">${e.guide.filter(id=>id!==from&&id!==to).map(id=>button('exp-stop',`○ ${e.guide.indexOf(id)+1}`,id,'reference')).join('')}</div><div class="seam-bookends"><article><small>FROM STOP ${e.guide.indexOf(from)+1}</small><h3>${esc(name(from))}</h3>${rows.map(r=>`<div class="origin-row"><span>${esc(c.views[r.viewId]?.name||'Missing View')} · ${r.connectionId?'✓ reach':'! gap'}</span>${button(r.connectionId?'exp-route':'exp-connect',r.connectionId?'Edit route':'Connect',r.connectionId||r.useId)}</div>`).join('')}</article><article class="seam-instrument"><b>Reachable from ${reachable} of ${rows.length} Views</b><div class="c-acts">${button('exp-travel','Travel').replace('data-id=',`aria-pressed="${seam.mode==='travel'}" data-id=`)}${button('exp-cut','Cut').replace('data-id=',`aria-pressed="${seam.mode==='cut'}" data-id=`)}${button('exp-coordinate','Coordinate')}</div>${stopEntry(e,from).hold?'<p>Departure entry held · choose a View before Travel</p>':''}<p>${seam.mode==='travel'&&reachable<rows.length?'Travel gap · unresolved origin refuses locally':seam.mode==='cut'?'Cut · no Camera traversal':'All origins supported'}</p>${active?`<p class="seam-route-summary">Route · ${esc(c.views[active.from]?.name)} → ${esc(c.views[active.to]?.name)} · shared Camera</p><label>Pace · Camera <select data-exp-pace>${['slow','auto','fast'].map(speed=>`<option ${active.speed===speed?'selected':''}>${speed}</option>`).join('')}</select></label>`:''}${S.experienceContext.depth==='route'?`<p>Stage click adds an observer anchor; drag ◆ or use arrow keys.</p>${button('exp-route-return','Put it back')}`:''}${S.experienceContext.depth==='coordination'||seam.beats.length?coordinationHtml(seam):''}</article><article><small>TO STOP ${e.guide.indexOf(to)+1}</small><h3>${esc(name(to))}</h3><p>Entry · ${esc(c.views[e.uses[stopEntry(e,to).id]?.viewId]?.name||(stopEntry(e,to).hold?'Keep current viewpoint':'Missing entry · repair'))}</p></article></div>${askHtml()}`;
}
export const gripLabels={frameH:'Frame height',az:'Aim horizontally',el:'Aim vertically',x:'Target X',y:'Target height',z:'Target Z'};
export function precisionHtml(){
 const t=S.task,v=resolvedCamera().views[t?.target?.id];if(!v)return `<p>Camera View removed · Repair required</p>${button('exp-close','Close')}`;
 const reading=readingFor({...v,pose:S.cameraDraft?.pose||v.pose});t.params.posture=reading;
 return `<div class="camera-toolbar"><b>Precise Camera · ${esc(v.name)} · ${reading} · Authoring</b>${button('exp-camera-return','Put it back')}${button('exp-close','Close')}</div><div class="camera-postures">${['outside','through','plan'].map(p=>button('exp-posture',p==='through'?'Look through':p).replace('data-id=',`aria-pressed="${reading===p}" data-posture="${p}" data-id=`)).join('')}</div><div class="camera-grips">${Object.entries(gripLabels).map(([g,label])=>button('exp-grip',label).replace('data-id=',`aria-pressed="${t.params.grip===g}" data-grip="${g}" data-id=`)).join('')}</div>`;
}
export function hintsHtml(){return `<div class="camera-toolbar"><b>Framing Hints · derived intent</b>${button('exp-close','Close')}</div><p>Choose a suggestion, then Capture to author a View.</p>${['Near','Far','Left','Right'].map(label=>button('exp-derived-hint',label).replace('data-id=',`data-hint="${label}" data-id=`)).join('')}${button('exp-capture','Capture','', 'primary')}`;}
export function coordinationHtml(seam){
 const camera=resolvedCamera(),route=camera.connections[S.task?.params.connection],geometry=route&&routeGeometry(camera,route.id),timing=coordinateTiming(camera,seam),s=S.experienceContext.seam,ids=[...new Set(originCoverage(ctx.experience,camera,s.from,s.to).map(r=>r.connectionId).filter(Boolean))];
 if(!geometry)return `<div class="coordination-strip"><b>Choose the Camera route to coordinate</b>${ids.map(id=>button('exp-route-choice',esc(camera.views[camera.connections[id].from]?.name),id)).join('')}</div>`;
 const stations=geometry.stations,clock=movementTiming(camera,seam,geometry.path,route.speed,route.id);
 const percent=seconds=>5+seconds/Math.max(.001,clock.duration)*90;
 const stationTime=station=>station.progress*clock.travelDuration+clock.holds.filter(h=>h.progress<station.progress).reduce((n,h)=>n+h.seconds,0);
 return `<div class="coordination-strip"><div class="deck-head"><b>Local coordination · ${esc(camera.views[route.from]?.name)} → ${esc(camera.views[route.to]?.name)} · ${geometry.seconds.toFixed(2)}s travel · ${clock.duration.toFixed(2)}s with holds</b><select data-exp-station aria-label="Camera station">${stations.map(s=>`<option value="${s.id}" ${s.id===S.task.params.station?'selected':''}>${esc(s.label)}</option>`).join('')}</select></div><div class="station-projection"><span>Route</span><div class="station-lane">${stations.map(s=>`<button style="left:${percent(stationTime(s))}%" class="station-tick ${S.task.params.station===s.id?'active':''}" data-act="exp-station-focus" data-id="${s.id}" data-station-counterpart="${s.id}" title="${esc(s.label)}">${s.id==='departure'||s.id==='arrival'?'●':'◆'}<small>${esc(s.label)}</small></button>`).join('')}</div><span>Beats</span><div class="temporal-lane">${timing.filter(b=>b.connectionId===route.id&&b.kind==='invoke').map(b=>`<button style="left:${percent(b.at??0)}%" data-act="exp-station-focus" data-id="${b.stationId}" class="coord-beat ${S.task.params.station===b.stationId?'active':''}">● ${esc(ctx.experience.definitions[ctx.experience.uses[b.useId]?.definitionId]?.name||'Repair')}<small>${b.at===null?'Repair':b.at.toFixed(2)+'s'}</small></button>`).join('')}</div><span>Holds</span><div class="temporal-lane">${timing.filter(b=>b.connectionId===route.id&&b.kind==='hold').map(b=>`<label class="coord-hold" style="left:${percent(b.at??0)}%" data-beat="${b.id}">${b.at===null?'Repair':b.at.toFixed(2)+'s'} · <input type="number" min="0" step=".25" data-exp-hold="${b.id}" value="${b.seconds}" aria-label="Hold seconds">s</label><span class="hold-duration" style="left:${percent(b.at??0)}%;width:${b.seconds/Math.max(.001,clock.duration)*90}%" data-hold-duration="${b.id}" aria-label="${b.seconds}s hold at ${esc(stations.find(s=>s.id===b.stationId)?.label||'unresolved station')}"></span>`).join('')}</div></div><div class="coord-actions">${button('exp-beat','Hold here')}${button('exp-mark-station','Name mid-route station')}<select data-exp-invoke-use><option value="">Choose contribution</option>${Object.values(ctx.experience.uses).filter(u=>!u.viewId).map(u=>`<option value="${u.id}" ${S.task.params.invokeUse===u.id?'selected':''}>${esc(ctx.experience.definitions[u.definitionId]?.name)}</option>`).join('')}</select>${button('exp-invoke-beat','Invoke here').replace('class=',(S.task.params.invokeUse?'':'disabled ')+'class=')}<small>Path geometry stays on Stage.</small></div>${timing.filter(b=>b.at===null||b.reason).map(b=>`<p class="exp-gap">${esc(b.reason||'Station needs repair')}</p>`).join('')}</div>`;
}
export function askHtml(){
 const source=S.expSourceAsk,ask=S.expAsk,route=S.expRouteAsk;
 if(source)return `<div class="ask-rule"><b>Experience · shared edit</b><p>${esc(source.label)} affects ${source.affected.map(s=>esc(s.name)).join(', ')}.</p>${button('exp-source-accept','Update all affected occurrences','','primary')}${button('exp-source-cancel','Cancel')}</div>`;
 if(route)return `<div class="ask-rule"><b>Camera · shared route edit</b><p>Reaches ${route.affected.map(s=>`Stop ${ctx.experience.guide.indexOf(s.from)+1} → ${ctx.experience.guide.indexOf(s.to)+1}`).join(', ')}.</p>${button('exp-route-scope','Update shared route','','primary')}${button('exp-route-cancel','Cancel')}</div>`;
 if(!ask)return '';
 return `<div class="ask-rule"><b>Camera · Update scope</b><p>Affects ${ask.reach.uses.map(u=>esc(u.name)).join(', ')}; Stops: ${ask.reach.stops.map(s=>esc(s.name)).join(', ')||'none'}</p>${button('exp-scope-shared','Update all affected uses','','primary')}${button('exp-scope-local',ask.stopId?'Only this Stop entry':'Detach this use')}${button('exp-scope-cancel','Cancel')}</div>`;
}
const signalOptions=()=>Object.values(ctx.experience.uses).flatMap(u=>{const d=ctx.experience.definitions[u.definitionId];if(d?.kind==='narration')return [{useId:u.id,signal:'complete'},...d.markers.map(m=>({useId:u.id,signal:`marker:${m.id}`}))];if(d?.kind==='control'&&capability(ctx.sceneSource,d.subjectId,d.capabilityId)?.kind!=='loop')return [{useId:u.id,signal:'complete'}];return [];});
export function cueSelect(id) {
 const use=ctx.experience.uses[id];
 return `<label class="cue-select">Cue <select data-exp-cue="${id}"><option value="">No cue</option>${signalOptions().filter(ref=>ctx.experience.definitions[ctx.experience.uses[ref.useId]?.definitionId]?.kind==='narration').map(ref=>`<option value="${esc(JSON.stringify(ref))}" ${JSON.stringify(use.cue)===JSON.stringify(ref)?'selected':''}>${esc(ref.signal)}</option>`).join('')}</select></label>`;
}
export function contributionsHtml(pid) {
 return Object.values(ctx.experience.uses).filter(u=>u.presentationId===pid&&!u.viewId&&!u.primary).map(u=>{const d=ctx.experience.definitions[u.definitionId];if(!d)return '<p>Missing contribution — Repair required</p>';
 const cap=d.kind==='control'?capability(ctx.sceneSource,d.subjectId,d.capabilityId):null,subject=d.kind==='control'?ctx.sceneSource.subjects[d.subjectId]?.name:null;
 const identity=d.kind==='control'?`${esc(subject||'Missing subject')} · ${esc(cap?.label||d.capabilityId)} · ${esc(valueLabel(cap,d.value))}`:esc(d.text||'');
 const where=u.presentationId?`in ${esc(ctx.experience.presentations[u.presentationId]?.name||'Missing Presentation')}`:'at Experience scope';
 const activation=u.kind==='interaction'?`Activated by ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'Missing activation')}`:u.start.kind==='after'?'Starts after a supported dependency':'Starts on Presentation entry';
 return `<div class="contribution"><button class="exp-action reference" data-act="pres-ref" data-id="${u.id}"><b>${esc(d.name||d.capabilityId)}</b> · ${identity}</button><p>${where} · ${activation}</p>${d.kind==='narration'?`<textarea data-exp-def="text" data-id="${u.id}">${esc(d.text)}</textarea>${button('exp-marker','Add named phrase',u.id)}<p>${d.markers.map(m=>esc(m.label)).join(', ')}</p>`:''}<details><summary>Start · boundary · interruption</summary><label>Interruption <select data-exp-interruption="${u.id}"><option value="">Type default</option>${['cancel','finish','continue'].map(v=>`<option ${u.interruption===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Start after <select data-exp-after="${u.id}"><option value="">Visit entry</option>${signalOptions().filter(r=>r.useId!==u.id).map(r=>`<option value="${esc(JSON.stringify(r))}" ${u.start.kind==='after'&&JSON.stringify({useId:u.start.useId,signal:u.start.signal})===JSON.stringify(r)?'selected':''}>${esc(r.useId)} · ${esc(r.signal)}</option>`).join('')}</select></label></details>${button('exp-remove-contribution','Remove',u.id)}</div>`;}).join('');
}
export function offerHtml() {
 const draft=S.expOfferDraft;if(!draft)return '';
 const scene=ctx.sceneSource,cap=capability(scene,draft.subjectId,draft.capabilityId);
 const subjects=selected=>Object.values(scene.subjects).map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
 return `<div class="offer-draft"><b>Add behavior or offer</b><label>Kind <select data-exp-offer="kind"><option value="behavior">Behavior</option><option value="interaction" ${draft.kind==='interaction'?'selected':''}>Visitor offer</option></select></label><label>Target <select data-exp-offer="subjectId">${subjects(draft.subjectId)}</select></label><label>Capability <select data-exp-offer="capabilityId">${capabilities(scene,draft.subjectId).map(c=>`<option value="${c.id}" ${c.id===draft.capabilityId?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>${cap?.control==='range'?`<label>Value <input type="number" data-exp-offer="value" value="${Number(draft.value)}" min="${cap.min}" max="${cap.max}" step=".1"></label>`:`<label>Value <select data-exp-offer="value"><option value="true">On / Play</option><option value="false" ${draft.value==='false'?'selected':''}>Off / Stop</option></select></label>`}${draft.kind==='interaction'?`<label>Activation <select data-exp-offer="trigger">${subjects(draft.trigger)}</select></label>`:''}<div class="c-acts">${button('exp-offer-accept','Add')}${button('exp-offer-cancel','Cancel')}</div></div>`;
}
export function stopDetails(s) {
 const e=ctx.experience,p=e.presentations[s.presentationId];
 const entry=s.entry.kind==='use'?s.entry.useId:s.entry.kind;
 const selected=value=>value===entry?'selected':'';
 const next=s.next.kind==='target'?s.next.id:s.next.kind;
 return `<details class="stop-details"><summary>This Stop · Entry · Next · Pacing · Gate</summary><label>Entry <select data-exp-entry="${s.id}"><option value="presentation" ${selected('presentation')}>Presentation Entry</option><option value="hold" ${selected('hold')}>Keep current viewpoint (explicit)</option>${[...new Set([...(p?.uses||[]),...(s.entry.kind==='use'?[s.entry.useId]:[])])].map(id=>`<option value="${esc(id)}" ${selected(id)}>${esc(e.uses[id]?.name||'Missing View use — Repair required')}</option>`).join('')}</select></label><label>Next <select data-exp-next="${s.id}"><option value="order" ${next==='order'?'selected':''}>Guide order</option><option value="end" ${next==='end'?'selected':''}>End</option>${[...new Set([...e.guide.filter(id=>id!==s.id),...(s.next.kind==='target'?[s.next.id]:[])])].map(id=>`<option value="${id}" ${next===id?'selected':''}>${esc(e.stops[id]?.name||'Missing Stop — Repair required')}</option>`).join('')}</select></label><label>Gate <select data-exp-gate="${s.id}"><option value="">None</option>${signalOptions().map(ref=>`<option value="${esc(JSON.stringify(ref))}" ${JSON.stringify(s.gate)===JSON.stringify(ref)?'selected':''}>${esc(ref.useId)} · ${esc(ref.signal)}</option>`).join('')}</select></label><label>Pacing <select data-exp-pacing="${s.id}"><option value="auto" ${s.pacing.kind==='auto'?'selected':''}>Auto</option><option value="dwell" ${s.pacing.kind==='dwell'?'selected':''}>Dwell 5s</option></select></label><label>Detour <select data-exp-detour="${s.id}"><option value="">Add choice</option>${e.guide.filter(id=>id!==s.id).map(id=>`<option value="${id}">${esc(e.stops[id].name)}</option>`).join('')}</select></label>${button('exp-remove-stop','Remove Stop',s.id)}</details>`;
}
export function visitorHtml() {
 const {source,runtime:r}=S.visitor,e=source.experience,p=e.presentations[r.presentationId],gate=gateState(e,source.camera,r);
 const visitorButton=(command,text,id='')=>button('exp-visitor',text,id).replace('data-id=',`data-command="${command}" data-id=`);
 const interactions=Object.values(e.uses).filter(u=>u.kind==='interaction'&&(!u.availability||u.availability===r.presentationId));
 return `<div class="visitor-title">${esc(p?.name)}</div><p>${esc(p?.meaning)}</p><p class="visitor-caption" aria-live="polite">${esc(narrationCaption(e,r))}</p><div class="visitor-controls">${r.stopId?`${visitorButton('back','Back')}${visitorButton('next','Next').replace('class="exp-action action"',`class="exp-action action" ${gate.allowed?'':'disabled'}`)}${visitorButton('auto',r.autoplay?'Pause Auto':'Auto')}<span>${esc(gate.reason)}</span>`:e.guide.length?visitorButton('start','Start Guide'):''}${visitorButton(r.exploring?'rejoin':'explore',r.exploring?'Rejoin':'Explore')}${r.bookmarks.length?visitorButton('return','Return from detour'):''}${button('exp-exit-preview','Exit Preview')}</div><div>${p?.uses.filter(id=>e.uses[id]?.role==='choice').map(id=>visitorButton('look',esc(e.uses[id].name),id)).join('')||''}</div><div>${interactions.map(u=>visitorButton('activate',esc(e.definitions[u.definitionId]?.name||'Unavailable')+' · '+esc(source.scene.subjects[u.triggerSubjectId]?.name||'Missing activation'),u.id).replace('class=',(contributionIssues(e,source.camera,source.scene,capability).some(i=>i.id===u.id)?'disabled ':'')+'class=')).join('')}</div><div>${Object.values(r.activities).filter(a=>a.status==='running').map(a=>visitorButton('stop','Stop '+esc(e.definitions[e.uses[a.useId]?.definitionId]?.name||a.useId),a.token)).join('')}</div>${e.stops[r.stopId]?.choices.map(choice=>visitorButton('detour',esc(choice.label),choice.targetId)).join('')||''}${r.refusal?`<p role="status">${esc(r.refusal)}</p>`:''}`;
}
export function sceneCapabilityCard(id) {
 const scene=ctx.sceneSource,s=scene?.subjects[id];if(!s)return '';
 return `<div class="c-sec">Scene source capabilities</div>${capabilities(scene,id).filter(c=>c.sourceEditable).map(c=>`<label class="exp-label">${esc(c.label)} <input type="number" data-exp-scene="${c.id}" data-id="${id}" value="${s.properties[c.channel]}" min="${c.min??0}" max="${c.max??1}" step=".1"></label>`).join('')}<p class="c-hint">Scene source edits share history. Experience effects stay in visitor session state.</p>`;
}

export function experienceParkedHtml() {
 const p=S.parkedByLens.experience,v=experienceParkedContext();if(!p)return '';
 const controls=v.wrongLens?'Switch to Experience for explicit Resume':v.ok?button('exp-resume','Resume'):v.fix==='select'?button('pres-ref','Select original identity',p.identity):'';
 return `<div class="relation parked"><b>Parked · ${esc(p.name||p.kind)}</b><p>${esc(v.reason||'Inactive procedure; no Camera remembered')}</p>${controls}${button('exp-dismiss-parked','Dismiss')}</div>`;
}
