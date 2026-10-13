import { capability, capabilities, profileOptions, isRealized } from './experience-capabilities.js';
import { gateState, narrationCaption, presentationPlan } from './experience-runtime.js';
import { resolvedCamera, readingFor } from './navigation.js';
import { routeGeometry } from './camera-evaluation.js';
import { journeyClock, cueDestinations, cueName } from './experience-coordination.js';
import { originCoverage, getSeam, resolveNext, stopEntry, entryUse, viewReach, viewUseReach, contributionIssues, captureUses, primaryExplanation, isPrimaryExplanation, stopConditionIssues, activationScope, boundaryScope, narrationDuration, narrationPassages, eligibleViews, orderedViews, supportedSignal, invokableRefusal, gripLabels, choiceTarget, connectionReach } from './experience-model.js';
import { S, ctx, thing } from './state.js';
import { imageFor, imageForPose } from './experience-image.js';
import { resolveExperience, experienceParkedContext, retainedContributions, linkedDefinitionReach, pendingDescriptor, planCaptureSupport, rehearsalReading } from './experience.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(act,text,id='',role='action')=>`<button class="exp-action ${act.startsWith('exp-remove-')?'destructive':role}" data-act="${act}" data-id="${esc(id)}">${text}</button>`;
export function experienceIndex() {
  const e = ctx.experience;
  // PLATE §0.8.1: in the Camera Path and Journey postures the Index header becomes **Camera Path** with the
  // **Path | Journey** switch, and the *From* origins with their connected/gap status are listed here — the
  // origin choice is a locator decision, not a Card section. The Card keeps the item's own detail (Pace and
  // used by, or the selected path point), so neither home grows into the other.
  // §5.5: while the Path or Journey posture is open the Index shows only that home and does not append the
  // ordinary Index beneath it — the crumb is the way back, and the From list is the origin choice.
  const pathHome = cameraPathIndexHtml();
  if(pathHome)return pathHome;
  return `<div class="ix-head"><span class="ix-title">Experience</span></div><div class="ix-group">Presentations</div>`
  + Object.values(e.presentations).map(p => `<div class="ix-row${S.sel === p.id ? ' sel' : ''}"><button class="ix-go" data-act="exp-open" data-id="${p.id}"><span class="glyph pres"></span><span class="ix-name">${esc(p.name)}</span></button></div>`).join('')
  + (e.guide.length ? `<div class="ix-group">Guide</div><div class="ix-row"><button class="ix-go" data-act="exp-guide">${esc(e.name)} · ${e.guide.length} Stops</button></div>` : '')
  // C9.6: retained contributions whose organizational home was removed stay listed with a route to their
  // repair writer. The inventory never resurrects the removed Presentation or rehomes the instruction.
  + (retainedContributions().length?`<div class="ix-group">Retained contributions</div><div class="ix-note">Their home was removed; each stays repairable.</div>${retainedContributions().map(o=>`<div class="ix-row${S.sel===o.id?' sel':''}"><button class="ix-go" data-act="exp-select-orphan" data-id="${o.id}">${esc(o.name)} · repair</button></div>`).join('')}`:'')
  // The Scene's own subject list is retired here: every subject it listed is reached through the one
  // shared locator instead (`Browse World`, below), deduplicated by identity, which is the same list the
  // World lens searches and the same Select the Card, the Index and the beacon resolve. What stays here
  // is what the locator cannot be: the acts that create something, and the two logical subjects whose
  // presentation is not a flight to a Stage position.
  // Creation has one canonical action. Region and environment are focus operations on a Presentation
  // (reached from its own Card), so they are not siblings of `+ Present` any more — the Index creates
  // exactly one kind of thing and holds no editors.
  // A door's explanation is the door's own second line, not a sibling racing it for the row: the note lives
  // inside the button, which is the form `.ix-go .ix-note` is written for (the Records register row has
  // always done it this way). As a sibling the note kept its full nowrap width while `.ix-go`'s `min-width:
  // 0` let the button collapse to nothing, so the label painted across the explanation at 1440×900.
  // §5.3: the Index is a locator with no explanatory notes. It ends with one row of the two creation doors.
  + `<div class="ix-row ix-create"><button class="exp-action md" data-act="exp-create">+ Present</button><button class="exp-action md" data-act="find-world">Browse World</button></div>`;
}
// The Camera Path / Journey Index home: the posture switch, and the *From* origins of the selected edge
// with their real status. One row per origin; choosing one chooses the connection being edited, which is
// also the origin the Journey's clock is measured from. Nothing here writes source.
function cameraPathIndexHtml() {
 const x=S.experienceContext,e=ctx.experience;
 if(!['route','coordination'].includes(x.depth)||!x.seam)return '';
 // §5.5: this is the one per-origin home, so it renders for an edge Camera has no route for yet as well —
 // the From list is exactly where the author connects the first origin, so hiding it would leave explicit
 // per-origin work unreachable. Only the route-bound readings (the Journey clock, the current row) fall away.
 const c=resolvedCamera(),route=c.connections[S.task?.params?.connection];
 const rows=originCoverage(e,c,x.seam.from,x.seam.to),at=id=>e.guide.indexOf(id)+1;
 const journey=x.depth==='coordination',clock=journey&&route?journeyClock(c,e.seams[`${x.seam.from}>${x.seam.to}`],route.id):null;
 // §5.5: the switch is one `.exp-seg` at full width. The current segment is a pressed button with no verb;
 // the other is a real door. Both carry `data-posture` so a posture change hands keyboard focus back to the
 // same reading (§5.4) — the current one is matched again by its posture alone, since it has no `data-act`.
 const current=(label,posture)=>`<button type="button" aria-pressed="true" data-posture="${posture}">${label}</button>`;
 const switchHtml=`<div class="ix-posture" data-exp-posture-switch><div class="exp-seg" role="group" aria-label="Camera Path posture">${x.depth==='route'?`${current('Path','path')}<button type="button" data-act="exp-coordinate" data-posture="journey">Journey</button>`:`<button type="button" data-act="exp-route" data-id="${esc(route?.id||'')}" data-posture="path">Path</button>${current('Journey','journey')}`}</div></div>`;
 // The crumb replaces the retired `Guide edge` group: it names the edge and is the one way back to its Card.
 const crumb=`<button class="ix-crumb exp-action reference" data-act="exp-route-return" aria-label="Back to the Guide edge Card">‹ Stop ${at(x.seam.from)} → Stop ${at(x.seam.to)}</button>`;
 return `<div class="ix-head ix-path">${crumb}<span class="ix-title">Camera Path</span>${switchHtml}</div>`
  +(journey&&clock?`<div class="ix-group">Journey · ${esc(c.views[route.from]?.name||'Missing View')} → ${esc(c.views[route.to]?.name||'Missing View')}</div><p class="ix-fact" data-exp-journey-total>Total · ${clock.duration.toFixed(1)} s · ${clock.cues.length} Cue${clock.cues.length===1?'':'s'}${clock.reason?` · ${esc(clock.reason)}`:''}</p>`:'')
  +`<div class="ix-group">From · ${rows.length}</div>`
  +`<div data-path-from>${rows.map(r=>r.connectionId?`<div class="ix-row origin-row"${r.connectionId===route?.id?' aria-current="true"':''}><button class="ix-go" data-act="${journey?'exp-journey-origin':'exp-route'}" data-id="${esc(journey?r.viewId:r.connectionId)}" data-path-origin="${esc(r.viewId)}"><span>${esc(c.views[r.viewId]?.name||'Missing View')}</span><small>${r.connectionId===route?.id?'this route':'connected'}</small></button></div>`
   :r.missing?`<div class="ix-row origin-row"><span>${esc(c.views[r.viewId]?.name||'Missing View')}</span><small class="exp-gap" role="status">needs repair</small></div>`
   :r.viewId===r.targetId?`<div class="ix-row origin-row"><span>${esc(c.views[r.viewId]?.name||'Missing View')}</span><small>same View</small></div>`
   :`<div class="ix-row origin-row"><span>${esc(c.views[r.viewId]?.name||'Missing View')}</span><small>! gap</small>${button('exp-connect','Connect',r.useId)}</div>`).join('')||'<p class="ix-fact">No eligible origin on this Stop.</p>'}</div>`;
}
const reuseCount=id=>Object.values(ctx.experience.stops).filter(s=>s.presentationId===id).length;
const valueLabel=(cap,v)=>{if(!cap)return String(v);if(cap.control==='range')return String(Number(v));if(cap.kind==='playback')return v?'Playing':'Stopped';return v?'On':'Off';};
const auditioned=(s,cap)=>S.expAudition?.[s.id]?.[cap.channel]??s.properties[cap.channel];
const meaningHtml=p=>`<div class="c-sec">Name · intent · shared Presentation</div><label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label><label class="exp-label">Intent<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label><p class="c-hint">Intent is a summary for the author; only the explanation is heard.</p>`;
const nameHtml=p=>`<label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label>`;
const intentHtml=p=>`<label class="exp-label">Intent<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label><p class="c-hint">Intent is a summary for the author; only the explanation is heard.</p>`;
// The condition a captured Activity would be created or updated in: the named working Presentation,
// or explicitly Experience scope.
const captureScope=()=>ctx.experience.presentations[S.experienceContext.presentation]?S.experienceContext.presentation:null;
function experienceCardBody(){
 const r=resolveExperience(S.sel),e=ctx.experience,c=resolvedCamera(),x=S.experienceContext;
 // UX4: an edge selected is its own inspection, distinct from any Stop. The Stop and its edge are
 // never both on screen — selecting one clears the other — so Cut/Travel/coverage can never be read as
 // properties of a Stop.
 if(x.seam&&!x.stop){
  const from=x.seam.from,to=x.seam.to;
  // Revalidate on every read (§3.1): a pair whose destination no longer resolves is reported as stale,
  // never retargeted to a positional neighbour. The resolved edge is a real offer, not an automatic move.
  if(!e.stops[from]||!e.stops[to]||resolveNext(e,from).id!==to)return staleEdgeCard(x.seam);
  // UX5: the Camera Path posture replaces the edge reading — the Camera half of the edge is what is being
  // edited, and its *From* list, its points and its Pace belong in one Card rather than under the edge's
  // movement controls. The edge itself is read again by putting the Path away.
  if(x.depth==='route')return pathCard(x.seam);
  // UX6: the Journey posture reads the edge as time. The Card inspects one Cue — its occurrence, when it
  // happens, its pause and its actions — and the coordination strip becomes the projection it always
  // was, with the editing controls gathered on the Cue Card instead of beside the lanes.
  if(x.depth==='coordination')return cueCard(x.seam);
  return edgeCard(x.seam);
 }
 if(r?.kind==='Presentation'){
  const p=r.item;
  // Focus is a line, not a pair of verbs. It names the subject this Presentation is about, and that name
  // is selectable in the shell's ordinary grammar — the same click-a-name-to-select-it the locator, the
  // Index and the Stage use. Operating a subject belongs to that subject's own Card, so no Operate verb
  // is offered here; the name takes the author there.
  const focus=p.focus.kind==='subjects'?p.focus.ids.map(id=>`<button class="exp-action reference" data-act="pres-ref" data-exp-focus-subject="${esc(id)}" data-id="${esc(id)}">${esc(thing(id)?.item.name||ctx.sceneSource?.subjects?.[id]?.name||id)}</button>`).join(', '):esc(p.focus.kind==='region'?'a region on the Stage':p.focus.kind);
  const explanation=primaryExplanation(e,p.id),text=explanation?e.definitions[explanation.definitionId]?.text||'':'';
  const others=Object.values(e.uses).filter(u=>u.presentationId===p.id&&!u.viewId&&!isPrimaryExplanation(e,p.id,u));
  const def=entryUse(e,p.id),defView=def?c.views[def.viewId]:null;
  const reuse=reuseCount(p.id);
  return `<div class="c-head"><div class="c-k">Presentation</div><div class="c-t">${esc(p.name)}</div><div class="c-ref">In ${reuse} Stop${reuse===1?'':'s'} · ${p.uses.length} View${p.uses.length===1?'':'s'}</div></div>`
   + `<div class="exp-focus"><span class="exp-fact">Focus · ${focus}</span><details class="exp-more inline" data-exp-menu="focus"><summary>Change…</summary><div class="c-acts">${button('exp-focus-environment','This environment',p.id)}${button('exp-focus-region','A region on the Stage',p.id)}</div></details></div>`
   + `<div class="c-sec">Views · ${p.uses.length}${def?'':` · <span class="exp-gap" role="status">No Default</span>`}</div>${viewsList(p)}`
   // The Views section's own pair: what a View is made from and what accepts it. Recommended framing is
   // here rather than on a Stage toolbar, it arms the derived suggestions in this Card, and `+ Capture
   // view` is what accepts one — so the two belong together, and the primary write is the primary action.
   + `<div class="c-acts">${button('exp-capture','+ Capture view','','primary')}${button('exp-auto','Recommended framing…')}</div>`
   + framingTrayHtml(p)
   // Two operations of two other species, quiet rather than a wall of equal buttons: bringing the Views
   // into view is a Camera navigation aid, and adding this Presentation to the Guide is a structural
   // write. Four full-weight stacked buttons read as four co-primary actions; every act keeps its own
   // identity and stays where it can be reached, so recipes address them exactly as before.
   + `<div class="exp-summary">${button('exp-bring','Bring Views into view','','reference')}</div>`
   // §5.3: the Guide line is the creator flow's next step and reads as one: what the Presentation is used by,
   // then the default door that adds it. It is a default sm button, not a reference link.
   + `<div class="c-sec">Guide</div><div class="exp-guide-use"><span>${reuse?`In ${reuse} Stop${reuse===1?'':'s'}`:'Not in the Guide'}</span>${button('exp-add-guide','Add to Guide',p.id)}</div>`
   + `<details class="exp-more" data-exp-menu="reuse"><summary>Use an existing Camera View</summary><label class="exp-label">Use an existing Camera View<select data-exp-reuse="${p.id}"><option value="">Choose Camera View</option>${Object.values(c.views).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label><p class="c-hint">Reusing a View shares one Camera framing with every other use of it.</p></details>`
   + explanationHtml(p,text,explanation)
   + advancedSummary(others)
   + `<details class="exp-more" data-exp-menu="presentation"><summary>Presentation menu / Rename</summary>${nameHtml(p)}<div class="c-acts">${button('exp-advanced','Advanced authoring')}</div>${presentationActions(p)}</details>`
   + (S.expAdvanced?advancedHtml(p,others):'')
   + askHtml();
 }
 // UX4 · QA 4: the Stop Card reads in order — Presentation, Entry, Next, Movement — and the edge is a
  // separate inspection. Order, repeat and removal live in the Deck's Edit Guide; Pacing, Gate and
  // choices are deliberate depth under Stop detail. `Edit movement` is the one door to the edge.
 if(r?.kind==='Stop'){
  const s=r.item,at=e.guide.indexOf(s.id),p=e.presentations[s.presentationId],reuse=reuseCount(p?.id);
  return `<div class="c-head"><div class="c-k">Stop ${at+1}</div><div class="c-t">${esc(s.name||p?.name||'Missing Presentation')}</div><div class="c-ref" data-stop-reach>Presentation · ${p?`<button class="exp-action reference" data-act="exp-open" data-id="${p.id}">${esc(p.name)}</button>`:'Missing Presentation'} · in ${reuse} Stop${reuse===1?'':'s'}</div></div>`
   +stopDetails(s)
   +askHtml();
 }
 if(r?.kind==='View use'&&!r.item.viewId)return activityCard(r.item);
 if(r?.kind==='View use'||r?.kind==='Camera View'){
  const useId=r.kind==='View use'?r.item.id:null;
  const v=c.views[r.kind==='View use'?r.item.viewId:r.item.id],reach=v?viewReach(e,v.id):{uses:[],stops:[]},p=r.kind==='View use'?e.presentations[r.item.presentationId]:null;
  const name=(r.kind==='View use'?r.item.name:null)||v?.name||'Missing framing';
  const isDefault=r.kind==='View use'&&r.item.role==='entry';
  const consequence=r.kind==='View use'?viewUseReach(e,c,useId):null;
  const preview=r.kind==='View use'&&v?viewPreviewHtml(useId,v):'';
  // The Card shows the View, its faithful preview and its operations, then the owning Presentation as
  // context — never as a second editor of the same thing. An unset Default ('No Default yet'), a missing
  // referenced View ('repair required') and a use whose home Presentation was removed are three distinct
  // states, and the last one is named as what it is rather than read as a Camera-owned framing.
  const orphaned=r.kind==='View use'&&!!r.item.presentationId;
  const context=p?`Presentation · ${esc(p.name)}`:orphaned?'Removed home · retained for repair':'Camera-owned framing';
  const role=r.kind==='View use'?(isDefault?'★ Default':'Visitor choice'):'Camera-owned framing';
  return `<div class="c-head"><div class="c-k">View</div><div class="c-t">${esc(name)}</div><div class="c-ref">${context}<br>${role}</div></div>`
   + preview
   + viewOperationsHtml(r,v,useId)
   + (v?`<details class="exp-more"><summary>Precise Camera · properties</summary><div class="c-acts">${Object.entries(gripLabels).map(([g,label])=>button('exp-precise-property',label,useId||v.id).replace('data-id=',`data-grip="${g}" data-id=`)).join('')}</div><p class="c-hint">A property opens Precision with that grip active; one value is live at a time on its Stage tape.</p></details>`:'')
   + (v?`<details class="exp-more"><summary>Camera request preference · Movement</summary><label class="exp-label">Movement · Camera<select data-exp-view-speed="${useId||v.id}">${['cut','slow','auto','fast'].map(speed=>`<option ${speed===(v.speed||'auto')?'selected':''}>${speed}</option>`).join('')}</select></label></details>`:'')
   + (p?`<div class="c-sec">Owning Presentation</div><p class="exp-fact">${esc(p.name)} · ${reuseCount(p.id)} Guide occurrences · ${p.uses.length} Views</p>${button('exp-open','Open Presentation',p.id,'reference')}`:'')
   + (consequence?.retained?`<div class="c-acts">${button('exp-remove-contribution','Remove retained View use',useId)}</div>`:'')
   + (r.kind==='View use'?issuesHtml(useId):'')
   + askHtml();
 }
 const s=ctx.sceneSource.subjects[S.sel];
 if(s)return experienceSubjectCard(s);
 const t=thing(S.sel);
 if(S.sel&&!t)return `<div class="c-head"><div class="c-k">Unavailable selected identity</div><div class="c-t">Source no longer resolves</div></div><p class="c-hint">Select a resolving identity. Accepted work cannot silently retarget.</p>`;
 return `<div class="c-head"><div class="c-k">${t?'From the World lens':'Experience'}</div><div class="c-t">${esc(t?.item.name||'Meaning in this World')}</div></div><p class="c-hint">Create or open a Presentation explicitly.</p><div class="c-acts">${t?button('exp-create-this','Present this',t.item.id):button('exp-create','+ Present')}</div>`;
}
export function experienceCard(){const html=experienceCardBody().replaceAll(askHtml(),'');return html.replace('<div class="c-sec">',askHtml()+'<div class="c-sec">');}
export const foreignExperienceCard = () => {
  const r = resolveExperience(S.sel);
  return r ? `<div class="c-head"><div class="c-k">Foreign identity · not a World subject</div><div class="c-t">${esc(r.item.name || r.kind)}</div><div class="c-ref">${r.owner} · ${esc(r.item.id)}</div></div><p class="c-hint">Select a World subject to work on the building.</p>` : '';
};

// C9.6 presentation actions: removal discloses what it will leave behind and keeps every retained
// reference repairable. Identity, definitions, View uses and Camera Views are never destroyed with it.
function presentationActions(p){
 const e=ctx.experience,stops=Object.values(e.stops).filter(s=>s.presentationId===p.id),uses=Object.values(e.uses).filter(u=>u.presentationId===p.id);
 const cued=uses.filter(u=>u.cue).length,offers=uses.filter(u=>u.kind==='interaction').length;
 const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
 return `<details class="exp-more" data-exp-menu="remove"><summary>Presentation actions · remove</summary><p class="c-hint">Removing keeps every shared definition, View use and retained reference: ${plural(stops.length,'Stop')} leave the Guide; ${plural(uses.length,'retained reference')} stay repairable (${plural(cued,'cue')}, ${plural(offers,'offer')}). Camera Views are never deleted.</p>${button('exp-remove-presentation','Remove Presentation',p.id)}</details>`;
}
// C9.6 revise operations on one selected contribution. Copy gives a new identity, Make local detaches the
// definition, Link shares an existing definition, and Replace rebinds compatible descriptors. The writer
// never touches unrelated lifecycle, station activation or the other copies.
function reviseHtml(u,d){
 if(!d)return '';
 const e=ctx.experience,scene=ctx.sceneSource;
 const shared=Object.values(e.definitions).filter(x=>x.kind===d.kind&&x.id!==u.definitionId);
 // While a scoped replacement waits for acceptance, the controls render what the author is proposing: the
 // capability list follows the pending subject, so the second choice of one shared proposal stays possible.
 const proposed=pendingDescriptor(u.id,d);
 return `<details class="exp-more" data-exp-menu="revise"><summary>Revise · copy · link · replace</summary>`
  +`<label class="exp-label">Name<input data-exp-act-name="${u.id}" value="${esc(d.name||'')}"></label>`
  +`<div class="c-acts">${button('exp-duplicate-contribution','Duplicate',u.id)}${button('exp-make-local','Make this definition local',u.id)}</div>`
  +(shared.length?`<label class="exp-label">Link to a shared ${esc(d.kind)} definition<select data-exp-link-definition="${u.id}"><option value="">Choose a shared definition</option>${shared.map(x=>`<option value="${x.id}">${esc(x.name||x.id)}</option>`).join('')}</select></label>`:'')
  +(d.kind==='control'?`<div class="c-sec">Replace descriptor</div><label class="exp-label">Subject<select data-exp-rebind-subject="${u.id}"><option value="">Choose a subject</option>${Object.values(scene.subjects).map(s=>`<option value="${s.id}" ${proposed.subjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="exp-label">Capability<select data-exp-rebind-capability="${u.id}"><option value="">Choose a capability</option>${capabilities(scene,proposed.subjectId).filter(isRealized).map(c=>`<option value="${c.id}" ${proposed.capabilityId===c.id?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>`:'')
  +(u.kind==='interaction'?`<label class="exp-label">Activated by<select data-exp-rebind-trigger="${u.id}">${Object.values(scene.subjects).map(s=>`<option value="${s.id}" ${u.triggerSubjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><p class="c-hint">Activation and target stay distinct; an offer is never turned into automatic work.</p>`:'')
  +`<p class="c-hint">This use keeps its identity and home${u.kind==='interaction'?', its availability and activation':''}. Linked uses share one reusable definition.</p></details>`;
}
// The honest identity of a captured Activity: what it operates, with which value, where it belongs
// and how it starts. Raw use/definition vocabulary is never the required reading.
function activityCard(u){  const e=ctx.experience,d=e.definitions[u.definitionId],cap=d?.kind==='control'?capability(ctx.sceneSource,d.subjectId,d.capabilityId):null,p=e.presentations[u.presentationId];
 const subjectName=d?.kind==='control'?(ctx.sceneSource.subjects[d.subjectId]?.name||null):null;
 // The definition's linked reach is disclosed where the author reads the Activity: replacing a shared
 // descriptor is not an occurrence-local edit, and the Card must say so before the writer asks.
 const linked=u.definitionId?linkedDefinitionReach(u.definitionId):[];
 return `<div class="c-head"><div class="c-k">Activity · Experience</div><div class="c-t">${esc(d?.name||'Missing contribution')}</div><div class="c-ref">${esc(p?`In ${p.name}`:u.presentationId?'Removed home · retained for repair':'Experience scope')} · owner Experience · ${linked.length>1?`definition shared by ${linked.length} Activities`:'occurrence ×1'}</div></div>`
  +(d?`<div class="c-sec">Identity</div><p class="exp-fact">${d.kind==='control'?`Operates ${esc(subjectName||'Missing subject')} · ${esc(cap?.label||d.capabilityId)} · ${esc(valueLabel(cap,d.value))}`:esc(d.text||'')}<br>${u.kind==='interaction'?`Activated by ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'Missing activation')}`:'Automatic · not a visitor offer'}<br>${u.kind==='interaction'?`Availability · ${u.availability?esc(e.presentations[u.availability]?.name||'Missing Presentation'):'Experience-wide'}`:`Starts · ${u.start.kind==='visit'?'on Presentation entry':u.start.kind==='after'?'after a supported dependency':u.start.kind==='station'?`invoked at ${stationBindingLabel(u)}`:'with the Experience'} · Ends · ${u.end.kind==='visit'?'with the visit':'at Experience end'}`}</p>`:'<p class="c-hint">Repair required.</p>')
  +`<div class="c-acts">${d?.kind==='control'&&ctx.sceneSource.subjects[d.subjectId]?button('pres-ref','Operate '+esc(subjectName||'subject'),d.subjectId):''}${button('exp-remove-contribution','Remove',u.id)}</div>${d?.kind==='narration'?narrationDetail(u,d):''}${u.kind!=='interaction'?activityDetails(u):''}${reviseHtml(u,d)}${issuesHtml(u.id)}${askHtml()}`;
}
// A station-bound Activity is invoked by one authored Seam station; the label reads the Camera's own
// station name instead of copying route geometry into Experience.
function stationBindingLabel(u){
 const s=u.start;if(s.kind!=='station')return '';
 const e=ctx.experience,station=routeGeometry(resolvedCamera(),s.connectionId)?.stations.find(x=>x.id===s.stationId);
 const from=e.guide.indexOf(s.seam?.from),to=e.guide.indexOf(s.seam?.to);
 return `${esc(station?.label||'Missing station')} · Seam ${from<0?'—':from+1} → ${to<0?'—':to+1}${e.stops[s.seam?.to]?'':' · Repair required'}`;
}
// The selected World subject in Experience (UX3 · §3.7). The Card reads in the order QA 5 names:
// identity, `Present this`, the derived `Used in Experience` reach, then the subject's own two doors. No
// capability control is on screen at rest: `+ Add behavior` opens a chooser over the descriptors the
// provider already declares, and invoking one is what puts that operation's existing audition and capture
// writers on screen. Capture, update and ambiguity semantics are exactly the ones UX2 left in place, and
// an audition still writes no source and no history.
function experienceSubjectCard(s){
 const caps=capabilities(ctx.sceneSource,s.id);
 // §5.3: the kicker is the subject's own kind when the provider names one, else the honest default.
 const kind=s.kindLabel||s.kindName||null;
 return `<div class="c-head"><div class="c-k">${kind?esc(kind).toUpperCase():'SCENE OBJECT'}</div><div class="c-t">${esc(s.name)}</div></div>`
  +`<div class="c-acts">${button('exp-create-this','Present this',s.id,'primary')}</div>`
  +usedInExperienceHtml(s)
  +subjectWorkHtml(s,caps)
  +offerHtml()
  +(S.expCaptureAsk?captureAskHtml():'')
  +askHtml();
}
// The derived reach of one subject, read from existing references and read-only: the Presentations that
// focus it, the behaviors and offers that target or are triggered by it, and the Stops presenting any of
// those Presentations. A Stop counts whether its Presentation merely *focuses* the subject (Present → Add
// to Guide authors no behavior, so this is the common case) or reaches it through a behavior/offer homed
// there — reading the Stops from behaviour homes alone silently dropped the focus-only Stops. Each row
// opens its owner; none of them is a second editor, and none of them marks a Presentation as the current
// selection. The rows are compact and single-line: the section is a reference index, so it must not read
// as a second inspector weighting the Card.
function usedInExperienceHtml(s){
 const e=ctx.experience,sid=s.id;
 const focuses=Object.values(e.presentations).filter(p=>p.focus.kind==='subjects'&&p.focus.ids.includes(sid));
 const uses=Object.values(e.uses).filter(u=>{const d=e.definitions[u.definitionId];return (d?.kind==='control'&&d.subjectId===sid)||(u.kind==='interaction'&&u.triggerSubjectId===sid);});
 // Stops of the Presentations that focus this subject, unioned with the homes of the behaviours/offers
 // that reach it: a Presentation that focuses the subject and is in the Guide is a reference even when it
 // authors no behavior.
 const homes=[...new Set([...focuses.map(p=>p.id),...uses.map(u=>u.presentationId).filter(Boolean)])];
 const stops=Object.values(e.stops).filter(st=>homes.includes(st.presentationId));
 const row=(kind,id,act,label,note)=>`<div class="exp-used" data-exp-used="${kind}" data-id="${esc(id)}"><button class="exp-action reference" data-act="${act}" data-id="${esc(id)}">${label}</button><small>${note}</small></div>`;
 const rows=[
  ...focuses.map(p=>row('presentation',p.id,'exp-open',esc(p.name),`${p.uses.length} View${p.uses.length===1?'':'s'}`)),
  ...uses.map(u=>{const d=e.definitions[u.definitionId],home=e.presentations[u.presentationId];
   return row('contribution',u.id,'pres-ref',`${esc(d?.name||'Missing contribution')}`,`${u.kind==='interaction'?`offer · by ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'missing activation')}`:'behavior'} · ${esc(home?home.name:'removed home')}`);}),
  ...stops.map(st=>row('stop',st.id,'exp-stop',`Stop ${e.guide.indexOf(st.id)+1} · ${esc(st.name)}`,`Guide · ${esc(e.presentations[st.presentationId]?.name||'Missing Presentation')}`))];
 return `<div class="c-sec">Used in Experience · ${rows.length}</div><div class="exp-used-in" data-exp-used-in>${rows.join('')||'<p class="c-hint">Nothing in this Experience uses this subject yet.</p>'}</div>`;
}
// The subject's own doors, and the one operation behind them. `+ Visitor interaction` opens the existing
// offer draft with this subject as its target and activation, so the offer writers are the ones an
// Advanced-home offer already uses; `+ Add behavior` opens the chooser below.
function subjectWorkHtml(s,caps){
 const chooser=S.expChoose?.subject===s.id?S.expChoose:null;
 const invoked=S.expInvoked?.subject===s.id?caps.find(c=>c.id===S.expInvoked.capability):null;
 return `<div class="c-sec">Behavior · visitor interaction</div><div class="c-acts">${button('exp-add-behavior','+ Add behavior',s.id)}${button('exp-add-interaction','+ Visitor interaction',s.id)}</div>`
  +(chooser?chooserHtml(s,caps):'')
  +(invoked?capabilityWorkHtml(s,invoked):'');
}
// The chooser is a session choice over declared descriptors, not a second descriptor editor: what the
// provider declares is listed, a descriptor this Stage does not realize is reported rather than offered,
// and nothing here writes source or history.
function chooserHtml(s,caps){
 const rows=caps.map(cap=>{
  const unreal=cap.realized===false;
  return `<div class="exp-cap" data-exp-choice="${esc(cap.id)}"><div class="exp-fact"><b>${esc(cap.label)}</b> · ${esc(cap.kind)} · ${unreal?'not realized':cap.sourceEditable?'source-editable':'session only'}</div>`
   +(unreal?`<p class="c-hint" role="status">Declared by the provider · not realized by this Stage, so it cannot be invoked here.</p>`
    :`<div class="c-acts">${button('exp-choose-capability',`Configure ${esc(cap.label)}…`,s.id).replace('data-id=',`data-cap="${esc(cap.id)}" data-id=`)}</div>`)
   +`</div>`;}).join('');
 // Wording distinguishes choosing from authoring: this door opens a capability's audition/configuration,
 // and nothing is authored until a capture is accepted there. "Add X" read as if the button itself wrote
 // a behavior, which it never does.
 return `<div class="ask-rule" data-exp-chooser="${esc(s.id)}"><b>Add a behavior</b><p>What this subject declares. Choosing one opens its audition to configure — nothing is authored until you accept a capture there.</p>${rows||'<p class="c-hint">This subject declares no capabilities in the current profile.</p>'}${button('exp-choose-cancel','Cancel')}</div>`;
}
// One invoked operation: the ephemeral audition it is operated with, the value a capture would hold, and
// the one capture writer in the named working Presentation (or explicitly at Experience scope). This is
// the UX2 writer unchanged; what UX3 changed is when it appears — a capability control exists only once
// its own operation has been invoked. The unrealized branches stay as the provider-swap guard they always
// were: a replaced profile can leave an invoked id declared but no longer realized, and the row then reports
// that rather than operating a capability this Stage does not consume.
function capabilityWorkHtml(s,cap){
 const pid=captureScope(),p=pid?ctx.experience.presentations[pid]:null;
 const value=auditioned(s,cap),matches=captureUses(ctx.experience,pid,s.id,cap.id),held=matches.length===1?matches[0]:null;
 const scoped=matches.filter(u=>u.presentationId===pid).length;
 const unreal=cap.realized===false;
 const control=unreal?`<span class="exp-fact" role="status">Declared by the provider · not realized by this Stage</span>`:cap.control==='range'
  ?`<input type="number" min="${cap.min??0}" max="${cap.max??1}" step=".1" data-exp-audition="${cap.id}" data-id="${s.id}" value="${Number(value)}" aria-label="${esc(cap.label)} audition">`
  :`<div class="c-acts"><button class="exp-action" data-act="exp-audition" data-id="${s.id}" data-cap="${cap.id}" data-value="true" aria-pressed="${value===true}">${cap.kind==='state'?'On':'Play'}</button><button class="exp-action" data-act="exp-audition" data-id="${s.id}" data-cap="${cap.id}" data-value="false" aria-pressed="${value===false}">${cap.kind==='state'?'Off':'Stop'}</button></div>`;
 const capture=unreal?'':pid
  ?`<button class="exp-action ${held?'':'primary'}" data-act="exp-use" data-id="${s.id}" data-cap="${cap.id}">${held?(scoped?`Update captured ${esc(cap.label)}`:`Capture in ${esc(p.name)}`):`Use in ${esc(p.name)}`}</button>`
  :`<button class="exp-action primary" data-act="exp-use-scope" data-id="${s.id}" data-cap="${cap.id}">Use at Experience scope</button>`;
 return `<div class="exp-cap" data-exp-invoked="${esc(cap.id)}"><div class="exp-fact"><b>${esc(cap.label)}</b> · ${esc(cap.kind)} · ${unreal?'not realized':cap.sourceEditable?'source-editable':'session only'}<br>Audition · ${unreal?'reported unsupported':esc(valueLabel(cap,value))}${held?` · Captured${scoped?' in this Presentation':' (another Presentation)'}`:''}${matches.length>1?` · ${matches.length} captured uses — choose which to update`:''}</div><label class="exp-label">Try it ${control}</label><p class="c-hint">Temporary projection; source and history are untouched.</p><div class="c-acts">${capture}${matches.length>1?matches.map(u=>button('exp-capture-choice',`Update ${esc(ctx.experience.definitions[u.definitionId]?.name||'capture')}`,u.id)).join('')+button('exp-capture-new','Capture another'):''}${S.expAudition?.[s.id]?button('exp-audition-clear','Clear audition',s.id,'reference'):''}${button('exp-invoke-close','Close',s.id,'reference')}</div></div>`;
}
function captureAskHtml(){
 const ask=S.expCaptureAsk;
 if(!ask)return '';
 return `<div class="ask-rule"><b>Choose the capture to update</b><p>${ask.matches.length} captured uses match this operation. Updating one never changes the others.</p>${ask.matches.map(u=>button('exp-capture-choice',ctx.experience.definitions[ctx.experience.uses[u]?.definitionId]?.name||'This capture',u)).join('')}${button('exp-capture-new','Capture another')}${button('exp-capture-cancel','Cancel')}</div>`;
}

// ----- UX2: the Views list, the ordinary explanation entry, Advanced authoring and the rendered preview

// The Views list is the keyboard inventory of the same Views the Stage marks semi-spatially: unordered,
// exactly one Default, and no order cue anywhere. Each row selects its View use — the canonical
// identity — and writes nothing.
const viewName=(e,id)=>{const u=e.uses[id];return u?.name||resolvedCamera().views[u?.viewId]?.name||'Missing framing';};
export function viewsList(p){
 const e=ctx.experience,c=resolvedCamera();
 if(!p.uses.length)return `<p class="c-hint">No View yet · this Presentation uses the current viewpoint.</p>`;
 return `<div class="exp-views" data-exp-views aria-label="Views · unordered, one Default">${p.uses.map(id=>{
  const u=e.uses[id],v=c.views[u?.viewId],isDefault=u?.role==='entry';
  return `<div class="exp-view${S.sel===id?' selected':''}"><button class="exp-action reference" data-act="pres-ref" data-id="${id}" data-exp-view-use="${id}"><span class="exp-star">${isDefault?'★':''}</span>${esc(viewName(e,id))}<small>${isDefault?'Default':u?.stopId?'this Stop entry':v?.review?'review':'visitor choice'}${v?'':' · repair required'}</small></button></div>`;
 }).join('')}</div>`;
}
// One compact ordinary explanation entry, visible even when nothing is authored. It opens the existing
// focused writer; once content exists it reads as that writer's quiet summary, and the same door carries
// the one route to that explanation's own Activity — where its timing and named phrases are authored. The
// depth stays behind the writer's own disclosure rather than becoming a second inventory on the Card.
function explanationHtml(p,text,explanation){
 const open=S.expExplain===p.id;
 const summary=text?`Explanation · ${esc(text.length>58?text.slice(0,55)+'…':text)}`:'Add explanation';  return `<details class="exp-more" data-exp-explain="${p.id}"${open?' open':''}><summary>${open?'What the visitor hears in Preview':summary}</summary>`
  +`<label class="exp-label">What the visitor hears in Preview<textarea data-exp-primary data-id="${p.id}" placeholder="Write one sentence the visitor will hear.">${esc(text)}</textarea></label>`
  +`<div class="c-acts">${explanation?button('pres-ref','Explanation timing and phrases',explanation.id,'reference'):''}${button('exp-explain','Close explanation',p.id)}</div>`
  +`<p class="c-hint">The explanation is the one authored text a visitor hears; Intent is the author's own summary.</p></details>`;
}
// Narration, behaviors and offers are not ordinary fields. When any is authored it earns one quiet
// summary that opens the single Advanced authoring home.
function advancedSummary(others){
 if(!others.length)return '';
 const kinds=[...new Set(others.map(u=>ctx.experience.definitions[u.definitionId]?.kind||'missing'))];
 return `<div class="exp-summary"><button class="exp-action reference" data-act="exp-advanced" data-on="true">${others.length} ${kinds.every(k=>k==='narration')?'narration':kinds.length===1?kinds[0]:'narration, behaviors and offers'} · open Advanced authoring</button></div>`;
}
// The one Advanced authoring home: intent, narration and behaviors, View switching and the derived View
// suggestions. Opening it writes nothing and changes no exposure outside itself.
function advancedHtml(p,others){
 const e=ctx.experience;
 const switching=p.uses.map(id=>`<div class="exp-view-switch"><span>${esc(viewName(e,id))}</span>${cueSelect(id)}</div>`).join('');
 return `<details class="exp-more advanced" data-exp-advanced-home open><summary>Advanced authoring</summary>`
  +`<div class="c-sec">Intent · shared summary</div>${intentHtml(p)}`
  +`<div class="c-sec">Narration, behaviors and offers · ${others.length}</div><div class="c-acts">${button('exp-narration','Add narration')}${button('exp-offer','Add behavior or offer')}</div>${contributionsHtml(p.id)}${offerHtml()}`
  +`<div class="c-sec">View switching</div>${switching||'<p class="c-hint">A View cue is authored per View.</p>'}`
  +`<div class="c-sec">View suggestions · estimate</div>${suggestionsHtml(p)}`
  +`</details>`;
}
// The recommended-framing tray: the derived suggestion and its four variations, in the Views section that
// offers them. A variation re-derives Camera intent only; `+ Capture view` is what accepts a View, so
// nothing in this tray writes source or history.
export function framingTrayHtml(p){
 const d=S.derivedView?.presentation===p.id?S.derivedView:null;
 if(!d)return '';
 const picked=S.task?.kind==='experience-hints'?(S.task.params.hints||[]):[];
 return `<div class="exp-hints" data-exp-hints><p class="exp-fact" role="status" data-exp-hint-read>Recommended framing · ${esc(d.name||'derived')}${picked.length?' · '+esc(picked.join(', ')):' · no variation chosen yet'}</p>`
  +`${['Near','Far','Left','Right'].map(label=>button('exp-derived-hint',label).replace('data-id=',`data-hint="${esc(label)}" aria-pressed="${picked.includes(label)}" data-id=`)).join('')}`
  +`<p class="c-hint">Derived Camera intent, never an authored View: Capture is what accepts it.</p>`
  +`<div class="c-acts">${button('exp-close','Close recommendation')}</div></div>`;
}
// The rendered Camera preview: an image the Stage's own renderer produced from this View's resolved
// pose, with a named placeholder while it is being drawn and a named reason if it cannot be. Selecting
// the View has already moved no Camera.
function viewPreviewHtml(useId,v){
 const img=imageFor(v.id);
 const box=`<div class="exp-preview" data-exp-preview="${useId}">`;
 if(img.state==='ready')return `${box}<img src="${img.url}" alt="Rendered Camera preview of ${esc(viewName(ctx.experience,useId))}" data-exp-preview-image></div>`;
 if(img.state==='pending')return `${box}<p class="exp-fact" role="status" data-exp-preview-pending>Rendering this View…</p></div>`;
 return `${box}<p class="exp-fact" role="status">Camera preview unavailable · ${esc(img.reason)}</p></div>`;
}
// The View's own operations. Set as Default writes the entry role inside the owning Presentation alone;
// Remove from Presentation is the bounded local unlink, disclosed before it happens; Rename edits the
// name every use of this View reads.
function viewOperationsHtml(r,v,useId){
 if(r.kind!=='View use')return `<div class="c-acts">${v?button('exp-look','Look through',v.id):''}</div>`;
 const e=ctx.experience,u=r.item,isDefault=u.role==='entry',reach=viewUseReach(e,resolvedCamera(),useId);
 const retained=!e.presentations[u.presentationId];
 // §5.3: the removal is disclosed before it happens, and what it leaves behind is stated rather than left to
 // the author to work out — an unset Default is named here, exactly as the reading states it.
 const left=[reach?.default?'this is the Default View, so the Default is left unset':''].filter(Boolean).join('');
 // §5.3: the actions follow QA 3's order and read as equal-weight buttons. Set as Default in place is a
 // quiet reading rather than a second control once the use already is the Default.
 return `<div class="c-acts view-ops" data-exp-ops>`
  + (v?button('exp-look','Look through',useId):'')
  + (isDefault?`<p class="exp-fact" data-view-default>★ Default · every use of this Presentation enters here unless a Stop overrides it</p>`:button('exp-default','Set as Default',useId))
  + (v&&S.task?.kind!=='experience-camera'?button('exp-precise','Edit Camera',useId):'')
  + `<label class="exp-label">Rename<input data-exp-view-name="${useId}" value="${esc(u.name||v?.name||'')}"></label>`
  + (retained?'':button('exp-remove-view','Remove from Presentation',useId))
  + `</div>`
  + `<p class="c-hint" data-view-consequences>Remove unlinks this use only: the Camera framing is kept for every other use, and no replacement Default is chosen${left?' · '+esc(left):''}. A Stop that entered through it stays an explicit, repairable missing entry.</p>`;
}
// The derived View suggestions: an estimate and a free View order, both Camera/Experience intent that
// writes no entry, Stop or Camera edge.
function suggestionsHtml(p){const plan=presentationPlan(ctx.experience,resolvedCamera(),p.id,ctx.stage?{...ctx.stage.cam,target:ctx.stage.cam.target.toArray()}:null,undefined,null,ctx.sceneSource);return `${button('exp-view-order',p.viewOrder?'Free View choice':'Suggest a View order',p.id).replace('data-id=',`data-clear="${!!p.viewOrder}" data-id=`)}${p.viewOrder?orderedViews(ctx.experience,p.id).map(id=>`<p>${esc(viewName(ctx.experience,id))} ${button('exp-view-order-move','←',id).replace('data-id=','data-delta="-1" data-id=')}${button('exp-view-order-move','→',id).replace('data-id=','data-delta="1" data-id=')}</p>`).join(''):''}<p class="exp-fact">Estimated ${plan.readiness.toFixed(2)}s · current standpoint<br>Narration ${plan.narrationEnd.toFixed(2)}s · finite work ${plan.finiteEnd.toFixed(2)}s · persistent start ${plan.persistentStart.toFixed(2)}s · Camera ${plan.cameraArrival.toFixed(2)}s · +2s breathing.</p><p class="c-hint">Suggestions never change entry, Stops or Camera edges.</p>`;}
// The Stop Card's own projection of the *shared* Presentation's Views, unchanged by UX2: the Stop Card
// belongs to UX4, and this is the projection two accepted axes read (the schematic L2 Set and its spatial
// counterpart). The Presentation Card no longer uses it — its row's Set exposure is the Views list plus
// the Stage markers — so the retirement of this wording happens where the Stop Card is restructured.
export function renderExperienceSurfaces() {
 renderDeck();
 document.body.classList.toggle('visitor-preview',!!S.visitor);
 let el=document.querySelector('#visitorSurface');  if(!el){el=document.createElement('section');el.id='visitorSurface';el.dataset.home='preview';document.querySelector('#stage').append(el);}
 el.hidden=!S.visitor;
 const presenter=document.querySelector('#experienceExamples');
 if(presenter){
  // Explicit loaders are separate from the shared walkthrough. Preview exposes neither loaders nor
  // authoring controls; the Presenter controller keeps its read-only instructions available.
  const visiting=!!S.visitor;
  presenter.hidden=S.lens!=='experience'||visiting;
  for(const el of presenter.querySelectorAll('[data-authoring]'))el.hidden=visiting;
 }
 if(S.visitor) { const html=visitorHtml();if(el._html!==html){el.innerHTML=html;el._html=html;} }

}

// ----- UX4: one Guide home — the Guide Deck, the Stop and the edge --------------------------------
// The Guide is one bounded lane: a named chip per Stop, each followed by its own resolved
// continuation (the *edge*). An edge chip is a real hit target that selects the edge, whose own Card
// owns Cut/Travel, aggregate coverage and the Camera Path door. Peek, Overview-and-Expand, the L2 Set
// strip and the Seam triptych are retired: the lane is the same one Guide home in every posture, and a
// Stop or its edge — never both — is what the Card inspects. Connectors are drawn only where the
// resolved destination is the truly adjacent Guide position, so an explicit non-adjacent Next never
// reads as a straight line.
// §5.4: a rebuilt surface gives the keyboard back to the control the author used, and reveals a selection
// that changed since the last render. `focusKey` is read from the control that currently holds focus, and
// `restoreFocus` matches it again by its identity attributes — a posture segment loses its `data-act` once
// it is current, so a second match without `data-act` catches it. Focus is restored with preventScroll,
// so the reveal rule stays the only thing that scrolls.
function motionAllowed(){return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
export function captureFocusKey(home){
 const active=document.activeElement;
 if(!active||!home.contains(active))return null;
 const d=active.dataset;if(!d.act&&!d.posture)return null;
 return {act:d.act||'',id:d.id||'',from:d.from||'',to:d.to||'',anchor:d.anchor||'',delta:d.delta||'',posture:d.posture||''};
}
export function restoreFocusKey(home,key){
 if(!key)return;
 const query=(withAct)=>Object.entries(key).filter(([k,v])=>v&&(withAct||k!=='act')).map(([k,v])=>`[data-${k}="${CSS.escape(v)}"]`).join('')||null;
 const first=query(true),second=query(false);
 const next=(first&&home.querySelector(first))||(second&&home.querySelector(second))||home.querySelector('.gd-stop-card.selected .gd-stop');
 if(next)next.focus({preventScroll:true});
}
// §5.4: the selected chip is revealed just enough to sit 28 px clear of either end of its lane. Measuring is
// the point: a chip the author cannot see is not a selected chip.
function revealSelection(lane){
 if(!lane)return;
 const target=lane.querySelector('.gd-stop-card.selected')||lane.querySelector('.topo-point.selected')||lane.querySelector('.jd-cue.selected');
 if(!target)return;
 const l=lane.getBoundingClientRect(),t=target.getBoundingClientRect(),margin=28;
 if(t.left<l.left+margin)lane.scrollLeft-=(l.left+margin-t.left);
 else if(t.right>l.right-margin)lane.scrollLeft+=(t.right-(l.right-margin));
}
// §5.4: `scrolls` is added only when the lane still overflows with every chip at its 112 px floor, so chips
// shrink when shrinking is what avoids scrolling; the fades and the step buttons follow the real overflow.
function updateLaneState(el,lane){
 if(!lane)return;
 lane.classList.remove('scrolls');
 if(lane.scrollWidth>lane.clientWidth+1)lane.classList.add('scrolls');
 const scroll=lane.closest('.gd-scroll');if(!scroll)return;
 const before=lane.scrollLeft>1,after=lane.scrollLeft+lane.clientWidth<lane.scrollWidth-1;
 scroll.classList.toggle('more-before',before);
 scroll.classList.toggle('more-after',after);
 for(const step of scroll.querySelectorAll('[data-gd-step]'))step.disabled=Number(step.dataset.gdStep)<0?!before:!after;
}
// §5.4: the lane's own pointer conveniences, attached once when the Deck is created. None of them writes
// source, history or Camera intent, and the steps stay out of the Tab order — a focused chip scrolls clear
// of the fades through the lane's own `scroll-padding-inline`.
function wireGuideLane(el){
 el.addEventListener('click',event=>{
  const step=event.target.closest?.('[data-gd-step]');if(!step)return;
  const lane=el.querySelector('.gd-lane');if(!lane)return;
  lane.scrollBy({left:Number(step.dataset.gdStep)*(lane.clientWidth*.8),behavior:motionAllowed()?'smooth':'auto'});
 });
 el.addEventListener('scroll',event=>{const lane=el.querySelector('.gd-lane');if(lane&&event.target===lane)updateLaneState(el,lane);},true);
 el.addEventListener('wheel',event=>{
  const lane=el.querySelector('.gd-lane');if(!lane||lane.scrollWidth<=lane.clientWidth+1)return;
  if(Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
  lane.scrollLeft+=event.deltaY;event.preventDefault();
 },{passive:false});
 // An outside press closes the open Edit Guide menu; a press inside it is the author's own work.
 document.addEventListener('pointerdown',event=>{
  const menu=el.querySelector('[data-exp-guide-menu][open]');if(!menu||menu.contains(event.target))return;
  menu.open=false;S.expGuideMenu=false;ctx.ui();
 },true);
}
// §5.5: `+ Path point` is the one creation path and it lives on the Stage, beside the drawing it writes
// into. While it is armed it reads as the state it holds and a tape names the click it waits for.
function pathInstrumentHtml(){
 const armed=!!S.experienceContext.armed;
 return `<button class="exp-action md" data-act="exp-path-point" aria-pressed="${armed}">${armed?'Cancel point':'+ Path point'}</button>`
  +(armed?`<span class="tape exp-armed" role="status">Click the Stage to place the point · Esc cancels</span>`:'');
}
export function renderDeck(){
 let el=document.querySelector('#experienceDeck'),instrument=document.querySelector('#experienceInstrument'),pathInstrument=document.querySelector('#pathInstrument');const e=ctx.experience,x=S.experienceContext;
 const live=S.lens==='experience'&&!S.visitor;
 // One Stage instrument remains: Edit Camera's precision pass. The recommended-framing tray is not an
 // instrument any more — it lives in the Views section of the Presentation Card that asks for it.
 const cameraDepth=x.depth==='precision';
 if(cameraDepth&&live){if(!instrument){instrument=document.createElement('section');instrument.id='experienceInstrument';document.querySelector('#stage').append(instrument);}const html=precisionHtml();if(instrument._html!==html){instrument.innerHTML=html;instrument._html=html;}}else instrument?.remove();
 if(live&&x.depth==='route'){
  if(!pathInstrument){pathInstrument=document.createElement('section');pathInstrument.id='pathInstrument';pathInstrument.className='stage-instrument';document.querySelector('#stage').append(pathInstrument);}
  const html=pathInstrumentHtml();if(pathInstrument._html!==html){pathInstrument.innerHTML=html;pathInstrument._html=html;}
 } else pathInstrument?.remove();
 if(!live||!e.guide.length){el?.remove();document.body.classList.remove('guide-band');document.body.style.removeProperty('--guide-band-h');return;}
 if(!el){el=document.createElement('section');el.id='experienceDeck';el.dataset.home='deck';document.body.append(el);el._wired=true;wireGuideLane(el);}
 // The band opens for every Guide posture except the ordinary lane. The posture still names itself so an
 // assertion reads a posture rather than a depth class; the Stop/edge inspection is the Card's, so no
 // posture adds a second inspector.
 const depth=cameraDepth?'ordinary':x.depth,band=depth!=='ordinary';
 const home=band?document.body:document.querySelector('#stage');if(el.parentElement!==home)home.append(el);el.className=`exp-deck ${depth}`;el.dataset.deckPosture=depth;
 document.body.classList.toggle('guide-band',band);
 if(!band)document.body.style.removeProperty('--guide-band-h');
 // §5.2.7: a disclosure that holds a writer keeps its open state across a rebuild, and §5.4: the lane keeps
 // its scroll position, so a re-render never jumps the reading it just wrote through.
 const lane=el.querySelector('.gd-lane'),scrolled=lane?lane.scrollLeft:0;
 const menu=el.querySelector('[data-exp-guide-menu]');if(menu)S.expGuideMenu=menu.open;
 const key=[S.sel||'',x.seam?`${x.seam.from}>${x.seam.to}`:'',x.point?.anchorId||'',S.task?.params?.station||''].join('|');
 const moved=el._key!==key;el._key=key;
 const focusKey=captureFocusKey(el);
 const html=guideLane(e);
 if(el._html!==html){el.innerHTML=html;el._html=html;}
 const lane2=el.querySelector('.gd-lane');
 if(lane2)lane2.scrollLeft=scrolled;
 if(moved)revealSelection(lane2||lane);
 restoreFocusKey(el,focusKey);
 updateLaneState(el,lane2);
 // Measured after the band renders: the Card reserves the band's actual height, so its last controls can
 // scroll clear of the fixed band instead of hiding behind it.
 if(band)document.body.style.setProperty('--guide-band-h',`${Math.ceil(el.getBoundingClientRect().height)}px`);
}
// The one Guide lane. The band adds its own head (Edit Guide ordering and a Close); the ordinary posture
// keeps the same lane as a strip with the one door that opens the band. Nothing here is a second
// inspector: a Stop chip selects the Stop, an edge chip selects the edge.
function guideLane(e){const x=S.experienceContext,band=x.depth!=='ordinary';
 // One posture is visually dominant, and the Deck speaks that posture's language: the Guide's own lane in
 // the Guide postures, the straightened path topology in the Path posture, the time axis in the Journey.
 // The two Camera postures name their edge and their lane instead of repeating the Guide's Stop lane
 // beneath their own (PLATE §0.8.1).
 if(x.depth==='route')return `${pathHead(e)}${pathTopologyLane()}`;
 if(x.depth==='coordination')return `${journeyHead(e)}${journeyLane()}`;
 const stops=`${e.guide.length} Stop${e.guide.length===1?'':'s'}`;
 // §5.4: the lane is one non-wrapping row that scrolls inside itself, with edge fades and pointer steps.
 // The step buttons stay out of the Tab order: chips are what the keyboard traverses.
 const lane=`<div class="gd-scroll" data-gd-scroll><button class="gd-step" data-gd-step="-1" tabindex="-1" aria-label="Earlier Stops">‹</button><ol class="gd-lane" data-guide-lane>${e.guide.map((id,i)=>guideItem(e,id,i)).join('')}</ol><button class="gd-step" data-gd-step="1" tabindex="-1" aria-label="Later Stops">›</button></div>`;
 // QA 4's band: a name block that reads the Guide, then the lane of Stop chips in order, with `Edit Guide`
 // (the one ordering posture) and the way back out at the band's right. The ordinary posture keeps the
 // same lane as a quiet single-line strip whose kicker and title are the one door that opens the band.
 if(!band)return `<div class="deck-block compact"><button class="deck-open" data-act="exp-guide"><small class="deck-k">Guide</small><b class="deck-t">${esc(e.name)}</b></button><small class="deck-s">${stops}</small></div>${lane}`;
 return deckBlock({k:'Guide',t:esc(e.name),s:stops,ops:`${guideOrderHtml(e)}${button('exp-close','Done','','reference')}`})+lane;
}
// The Deck's own name block, in the boards' proportion: the posture's label, its title, a foot row (the
// Guide's count and the posture's own ops) and, for the Journey, a fourth row that holds the Rehearse ops.
// It is the band's first child, so its heading is what the posture is named by.
function deckBlock({k,t,s,foot,ops,opsRow=false}){
 const footHtml=foot??(s?`<small class="deck-s">${s}</small>`:'');
 return `<div class="deck-block"><small class="deck-k">${k}</small><b class="deck-t">${t}</b>`
  +(footHtml||(!opsRow&&ops)?`<div class="deck-foot">${footHtml}${!opsRow&&ops?`<div class="gd-ops">${ops}</div>`:''}</div>`:'')
  +(opsRow&&ops?`<div class="gd-ops">${ops}</div>`:'')
  +`</div>`;
}
// The Camera postures' own Deck blocks: the posture, the View pair that is the reading, and the Guide
// occurrence it is measured on. The Path | Journey switch is the Index header's (PLATE §0.8.1: the Index
// header becomes Camera Path with the switch), so no Deck repeats it.
function pathHead(e){const x=S.experienceContext,c=resolvedCamera(),at=id=>e.guide.indexOf(id)+1,route=c.connections[S.task?.params?.connection];return deckBlock({k:'Camera Path',t:`${esc(c.views[route?.from]?.name||'Missing View')} → ${esc(c.views[route?.to]?.name||'Missing View')}`,s:`Guide · Stop ${at(x.seam.from)} → Stop ${at(x.seam.to)}`});}
// §5.6: the Journey's name block is the posture, the pair it reads, a foot row that names the Guide edge (or
// the rehearse clock while one exists — the crumb still shows the edge), and a fourth row of its own for the
// Rehearse ops, so the ops never push the lane narrow.
function journeyHead(e){const x=S.experienceContext,c=resolvedCamera(),at=id=>e.guide.indexOf(id)+1,p=journeyProbe(),route=p?.clock.route;
 const reading=rehearsalReading();
 const foot=`<small class="deck-s">Guide · Stop ${at(x.seam.from)} → Stop ${at(x.seam.to)}</small>`
  +(reading?`<span data-exp-rehearse-time>${fmtClock(reading.t)} / ${fmtClock(reading.clock.duration)}</span>`:'');
 if(!route)return deckBlock({k:'Journey',t:'No supported Camera route',foot});
 return deckBlock({k:'Journey',t:`${esc(c.views[route.from]?.name||'Missing View')} → ${esc(c.views[route.to]?.name||'Missing View')}`,foot,ops:rehearseOps(),opsRow:true});
}
// UX5: the straightened path topology (PLATE §0.8.1 — "Straightened path topology, no time"). One shallow
// line of the route's own shape: the origin View, the authored points in their authored order, the
// destination View, and a connector between each neighbour. No times, no Stop cards, no second inspector;
// a point chip selects its point, and the Stage draws the same points in the same order.
function pathTopologyLane(){
 const x=S.experienceContext,c=resolvedCamera(),route=c.connections[S.task?.params?.connection];
 if(!route||!x.seam)return '';
 const end=(side,viewId)=>`<span class="topo-end" data-path-end="${side}"><i></i><small>${esc(c.views[viewId]?.name||'Missing View')}</small></span>`;
 // §5.5: no pace, no armed text and no ▸/▮ glyphs — the lane is the route's shape and the selection it
 // mirrors. A point chip selects the same point the Stage's own ring selects.
 const track=route.anchors.length
  ?`<ol class="topo-track" data-path-points>${route.anchors.map((a,i)=>`<li><button class="topo-point ${x.point?.anchorId===a.id?'selected':''}" data-act="exp-point-select" data-connection="${route.id}" data-anchor="${a.id}" aria-label="Path point ${i+1}"${x.point?.anchorId===a.id?' aria-current="true"':''}></button></li>`).join('')}</ol>`
  :`<ol class="topo-track" data-path-points="0"><li class="topo-empty">Direct path</li></ol>`;
 return `<div class="path-lane" data-path-lane="${route.id}">${end('origin',route.from)}${track}${end('destination',route.to)}</div>`;
}
// Edit Guide is the Deck's ordering context: order is the fallback continuation, and a Stop may repeat a
// Presentation. It writes through the same move/remove/attach writers the Stop Card used.
// §5.4: the ordering posture opens upward over the Stage and keeps its own open state across a rebuild. Each
// row is the occurrence and its name plus four xs controls; the selected Stop's row takes the current-context
// look. The menu closes on Esc, on an outside press, or after Remove.
function guideOrderHtml(e){
 const selected=S.experienceContext.seam?null:(S.sel||S.experienceContext.stop);
 const open=S.expGuideMenu?' open':'';
 return `<details class="exp-more gd-menu" data-exp-guide-menu${open}><summary>Edit Guide</summary><div class="gd-menu-pop">${e.guide.map((id,i)=>`<div class="gd-edit" data-edit-stop="${id}"${id===selected?' aria-current="true"':''}><span>${i+1} · ${esc(e.stops[id]?.name||'Missing Stop')}</span><div class="c-acts">${button('exp-move-stop','←',id).replace('data-id=','data-delta="-1" data-id=')}${button('exp-move-stop','→',id).replace('data-id=','data-delta="1" data-id=')}${button('exp-add-guide','Repeat',e.stops[id]?.presentationId)}${button('exp-remove-stop','Remove',id)}</div></div>`).join('')}</div></details>`;
}
function guideItem(e,id,i){
 const s=e.stops[id],p=e.presentations[s?.presentationId];
 // §5.2.5: one identity looks selected at a time. While an edge is the Card's identity the Stop chips
 // render unselected, so Cut/Travel can never be read as a property of a Stop.
 const selected=(S.sel===id||S.experienceContext.stop===id)&&!S.experienceContext.seam;
 // QA 4's chip, in the board's proportion: the occurrence number, then the Stop's own name, which defaults
 // to its Presentation's. The second line appears only when the Stop carries its own different name. Entry,
 // Next and pacing are the Card's reading of the selected Stop and ordering is `Edit Guide`'s, so six Stops
 // read as one shallow lane of named chips rather than six stacked mini-cards.
 const ownName=s?.name&&s.name!==p?.name;
 const label=s?.name||p?.name||'Missing Stop';
 // `compact` stays on the markup as the test hook it always was; the chip has no expanded branch any more.
 return `<li class="gd-item" data-stop="${id}"><article class="stop-card compact gd-stop-card ${selected?'selected':''}" data-stop="${id}">`
  +`<button class="peek-stop gd-stop" data-act="exp-stop" data-id="${id}" title="Stop ${i+1} · ${esc(label)}" aria-label="Stop ${i+1}: ${esc(label)}">`
  +`<span class="gd-num" aria-hidden="true">${i+1}</span>`
  +`<span class="gd-names"><b class="gd-name">${esc(label)}</b>${ownName?`<small class="gd-pres">Presentation · ${esc(p?.name||'Missing Presentation')}</small>`:''}</span>`
  +`</button></article>${edgeChip(e,id,i)}</li>`;
}
// The resolved continuation of one Stop, read from the model (never a positional neighbour): an explicit
// End, a needs-repair destination, or the destination itself — joined to the next chip only when that
// destination really is adjacent.
function edgeChip(e,from,i){
 const s=e.stops[from],next=resolveNext(e,from),sel=S.experienceContext.seam;
 if(!next.id||s?.next.kind==='end')return `<span class="gd-edge end" data-continuation="end">⊘ End</span>`;
 if(next.missing)return `<span class="gd-edge gap" role="status" data-continuation="repair">! Next needs repair</span>`;
 const j=e.guide.indexOf(next.id),adjacent=j===i+1,on=sel?.from===from&&sel?.to===next.id;
 // §5.4: one word, not a sentence — the order-default chip names its movement and takes the `travel`
 // class when it is Travel; an explicit non-adjacent Next names the destination it really resolves to,
 // which is what keeps it from reading as the positional neighbour beside it (QA 4).
 const movement=e.seams?.[`${from}>${next.id}`]?.mode==='travel'?'Travel':'Cut';
 return `<button class="gd-edge ${adjacent?`order ${movement.toLowerCase()}`:'explicit'} ${on?'selected':''}" data-act="exp-seam" data-from="${from}" data-to="${next.id}" data-continuation="${adjacent?'order':'explicit'}" aria-label="${adjacent?`${movement} edge`:'Next'} from Stop ${i+1} to Stop ${j+1} · ${esc(e.stops[next.id]?.name||'Missing Stop')}">${adjacent?movement:`⇥ Stop ${j+1}`}</button>`;
}
// A stale edge: one bookend left, or the destination no longer resolves. It never retargets — the author is
// told, and the resolved edge (if there still is one) is a deliberate offer.
function staleEdgeCard({from,to}){
 const e=ctx.experience,resolved=resolveNext(e,from);
 return `<div class="c-head"><div class="c-k">Guide edge · needs repair</div><div class="c-t">Stop ${e.guide.indexOf(from)+1} → ${e.stops[to]?e.guide.indexOf(to)+1:'—'}</div><div class="c-ref">Owner · Experience<br>This continuation no longer resolves: a Stop left the Guide or its Next changed.</div></div>`
  +`<p class="exp-gap" role="status">The edge is kept as a reported gap; nothing was retargeted to a neighbour.</p>`
  +`<div class="c-acts">${resolved.id?button('exp-seam','Open the resolved edge',from).replace('data-id=',`data-from="${from}" data-to="${resolved.id}" data-id=`):''}${button('exp-close','Close')}</div>`;
}
// ----- UX5: the Camera Path posture — the edge's Camera half in one home -----------------------------
// The Path Card is the Camera side of one Guide edge. *From* is the origins that can really reach this
// route, with their connected / gap status and their own door; the points are the authored interior path
// points in their authored order; the selected point is its own small identity with Remove, an evaluated
// Camera preview, Look through and the Guide edges the path reaches. Pace stays Camera's, as it always
// was, and `+ Path point` is the only creation path: it arms, a Stage click places the point, Escape and
// the same control cancel. Nothing here is a second manipulation system — the Stage's own ◆ chips stay
// the direct path, and every write goes through the one route proposal and its one Undo step.
function pathCard(seam){
 const e=ctx.experience,c=resolvedCamera(),x=S.experienceContext,t=S.task,route=c.connections[t?.params?.connection];
 const at=id=>e.guide.indexOf(id)+1;
 // §5.5: a Path opened on an edge Camera has no route for is not a gap — the Index's From list is where the
 // author connects one, so the Card says exactly that and stays the posture's own home. A route that *was*
 // being read and no longer resolves stays the separate repair reading it always was.
 if(!route)return t?.params?.connection
  ?`<div class="c-head"><div class="c-k">Camera Path · needs repair</div><div class="c-t">No resolving route</div></div><p class="exp-gap" role="status">The route this Path was reading no longer resolves.</p>`
  :`<div class="c-head"><div class="c-k">Camera Path</div><div class="c-t">No Camera route yet</div><div class="c-ref">Stop ${at(seam.from)} → Stop ${at(seam.to)}</div></div><p class="c-hint" data-path-empty>Connect an origin in the From list to author this edge's Camera route.</p><div class="c-acts">${button('exp-bring','Bring route into view','','reference')}</div>`;
 const geometry=routeGeometry(c,route.id),reaches=connectionReach(e,c,route.id);
 const point=x.point?.connectionId===route.id?route.anchors.find(a=>a.id===x.point.anchorId):null;
 // §5.5: a selected point is its own inspector, never a section under the path.
 if(point)return pathPointCard(route,point,geometry,reaches);
 // The *From* origins live in the Index home (PLATE §0.8.1): choosing an origin is a locator decision, and
 // the point chips live in the Deck lane and on the Stage. The Card is the item's own detail — Pace and the
 // Guide edges the route serves. No time appears in the Path posture, and there is no second creation path.
 return `<div class="c-head"><div class="c-k">Camera Path</div><div class="c-t">${esc(c.views[route.from]?.name||'Missing View')} → ${esc(c.views[route.to]?.name||'Missing View')}</div><div class="c-ref">Camera · used by ${reaches.length} Guide edge${reaches.length===1?'':'s'}</div></div>`
  +`<div class="exp-row"><span class="exp-row-k">Pace</span><select data-exp-pace aria-label="Camera route pace">${['slow','auto','fast'].map(speed=>`<option ${route.speed===speed?'selected':''}>${speed}</option>`).join('')}</select></div>`
  +`<div class="c-sec">Used by · ${reaches.length}</div>${reaches.map(r=>`<p class="exp-fact">Guide · Stop ${at(r.from)} → Stop ${at(r.to)}</p>`).join('')||'<p class="c-hint">No Guide edge uses this route.</p>'}`
  +(route.anchors.length?'':`<p class="c-hint" data-path-empty>No path points yet — use + Path point on the Stage.</p>`)
  +`<div class="c-acts">${button('exp-bring','Bring route into view','','reference')}</div>`
  +askHtml();
}
// §5.5: the selected point is its own inspector — where it is on the route, its one instruction, Remove,
// the evaluated Camera preview and the Guide edges the route serves. Its aim is the route's own evaluation
// and is read in the preview rather than as fields to edit; `Look through` is Camera's own framing
// operation, so no second one is introduced here.
function pathPointCard(route,point,geometry,reaches){
 const e=ctx.experience,c=resolvedCamera();
 const index=route.anchors.findIndex(a=>a.id===point.id),station=geometry?.stations.find(s=>s.id===point.id),pose=station?.pose||null;
 const img=pose?imageForPose(pose):{state:'unavailable',reason:'This path point has no resolvable Camera pose'};
 const preview=`<div class="exp-preview" data-exp-point-preview="${point.id}">`+(img.state==='ready'?`<img src="${img.url}" alt="Rendered Camera preview at path point ${index+1}" data-exp-preview-image>`:img.state==='pending'?'<p class="exp-fact" role="status">Rendering this point…</p>':`<p class="exp-fact" role="status">Camera preview unavailable · ${esc(img.reason)}</p>`)+'</div>';
 return `<div class="c-head"><div class="c-k">Path point · ${index+1} of ${route.anchors.length}</div><div class="c-t">${esc(c.views[route.from]?.name||'Missing View')} → ${esc(c.views[route.to]?.name||'Missing View')}</div></div>`
  +`<p class="exp-fact" data-point-read>Drag the point on the Stage to reshape the path.</p>`
  +`<div class="c-acts">${button('exp-point-remove','Remove point','','destructive')}</div>`
  +`<div class="c-sec">Camera at this point</div>${preview}`
  +(pose?`<div class="c-acts">${button('exp-look-point','Look through')}</div>`:'')
  +`<div class="c-sec">Used by · ${reaches.length}</div>${reaches.map(r=>`<p class="exp-fact">Guide · Stop ${e.guide.indexOf(r.from)+1} → Stop ${e.guide.indexOf(r.to)+1}</p>`).join('')||'<p class="c-hint">No Guide edge uses this route.</p>'}`
  +askHtml();
}
// ----- UX6: the Journey — the time Deck and the Cue Card ---------------------------------------------

// A clock reading is seconds the author can compare at a glance: m:ss.d, from zero.
const fmtClock = (t) => { const s=Math.max(0,Number(t)||0); return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}.${Math.floor((s%1)*10)}`; };
// The Journey's one reading: the selected edge, its seam and the clock of the currently selected origin's
// route. Every Journey surface reads this rather than re-deriving a time of its own.
const journeyProbe = () => {
 const x=S.experienceContext;if(!x.seam)return null;
 const seam=ctx.experience.seams[`${x.seam.from}>${x.seam.to}`];
 const clock=journeyClock(resolvedCamera(),seam,S.task?.params?.connection);
 return clock?{seam,clock}:null;
};
// §5.6: the time Deck. 0:00 → the derived total for the selected origin's nominal Journey, a ◆ on a tick at
// each Cue's own time with the Cue's name beneath it, and the Rehearse playhead. Marker positions are times
// rather than progress, because time is what this Deck says it maps. The whole axis is the scrub surface,
// so no second control repeats it, and with no Cue the axis shows only its ends.
function journeyLane(){
 const p=journeyProbe();
 if(!p)return `<div class="journey-deck" data-journey-deck><div class="jd-axis"><div class="jd-track" aria-hidden="true"></div></div></div>`;
 const {clock}=p,total=Math.max(.001,clock.duration),pct=t=>Math.max(1.5,Math.min(98.5,((t??0)/total)*100));
 const reading=rehearsalReading(),t=reading?reading.t:0,playing=!!reading?.playing;
 const route=clock.route,named=cue=>cueName(ctx.experience,route,cue);
 return `<div class="journey-deck" data-journey-deck><div class="jd-axis">`
  +`<div class="jd-track" aria-hidden="true"></div>`
  +`<div class="jd-cues">${clock.cues.map(cue=>`<button class="jd-cue ${S.task?.params?.station===cue.stationId?'selected':''}" style="left:${pct(cue.at)}%" data-act="exp-cue-select" data-id="${cue.stationId}" data-cue-at="${cue.at===null?'':cue.at.toFixed(2)}" aria-label="Cue ${esc(named(cue))} at ${fmtClock(cue.at)}"><span class="jd-diamond" aria-hidden="true">◆</span><small>${esc(named(cue))}</small></button>`).join('')}</div>`
  +`<span class="jd-playhead ${playing?'playing':''}" data-exp-playhead style="left:${pct(t)}%"></span>`
  +`<input type="range" class="jd-scrub ${playing?'playing':''}" min="0" max="${clock.duration.toFixed(2)}" step="0.05" value="${t.toFixed(2)}" data-exp-rehearse aria-label="Rehearse playhead">`
  +`<div class="jd-ends"><span class="jd-end">${fmtClock(0)}</span><span class="jd-end">${fmtClock(clock.duration)}</span></div>`
  +`</div></div>`;
}
// §5.6: Rehearse's three states live in the Journey name block's own ops row. `▶ Rehearse` and `❚❚ Pause` take
// the default weight, `■` is an icon-only sm button named for the keyboard, and `Look through` — Camera's own
// explicit exit from the rig — appears once a rehearsal exists to look through.
function rehearseOps(){
 const reading=rehearsalReading(),live=!!(reading&&S.rehearse&&S.rehearse.connectionId===reading.clock.connectionId);
 const stop=`<button class="exp-action sm" data-act="exp-rehearse-stop" data-id="" aria-label="Stop rehearsal" title="Stop rehearsal">■</button>`;
 if(live&&S.rehearse.playing)return `${button('exp-rehearse-pause','❚❚ Pause')}${stop}`;
 return `${button('exp-rehearse-play','▶ Rehearse')}`+(live?`${stop}${button('exp-rehearse-look','Look through','','reference')}`:'');
}
// §5.6: the Cue Card. A Cue is the (Guide edge, connection, station) triple: it reads its occurrence — when
// it happens, its pause and its actions — then offers its editing writers behind `Edit cue` and an atomic
// move. The Deck's ◆ markers and the Stage's chips are the inventory, so no Cue list is repeated here, and
// with no Cue selected the Card offers where the next one will be rather than editing one nobody chose.
function cueCard(pair){
 const e=ctx.experience,x=S.experienceContext,c=resolvedCamera(),p=journeyProbe();
 // The Card is handed the selected pair; the resolved seam carries the beats, so it is read here rather
 // than assumed from the pair the context keeps.
 const seam=e.seams[`${pair.from}>${pair.to}`]||pair;
 const at=id=>e.guide.indexOf(id)+1,name=id=>e.stops[id]?.name||'Missing Stop';
 if(!p)return `<div class="c-head"><div class="c-k">Journey · needs repair</div><div class="c-t">No supported Camera route</div><div class="c-ref">Owner · Experience<br>Guide edge · Stop ${at(pair.from)} → Stop ${at(pair.to)}</div></div><p class="exp-gap" role="status">This edge has no supported origin route, so it cannot be read as time yet.</p><div class="c-acts">${button('exp-close','Close')}</div>`;
 const {clock}=p,route=clock.route,params=S.task?.params||{};
 const edgeLine=`Stop ${at(pair.from)} → Stop ${at(pair.to)} · from ${esc(c.views[route.from]?.name||'Missing View')}`;
 // One Camera route can serve more than one Guide edge, and each edge has its own Cues: a shared route is
 // named rather than read as one shared pause or one shared selection.
 const shared=connectionReach(e,c,route.id).filter(r=>!(r.from===pair.from&&r.to===pair.to));
 const sharedLine=shared.length?`<p class="c-hint" data-shared-route>This Camera Path also serves ${shared.map(r=>`Stop ${at(r.from)} → Stop ${at(r.to)}`).join(', ')}; Cues here belong to Stop ${at(pair.from)} → Stop ${at(pair.to)} only.</p>`:'';
 const cue=clock.cues.find(k=>k.stationId===params.station)||null;
 // #5.6: entering the Journey selects no Cue. The add row offers only stations no Cue holds; with every
 // station holding one there is no free station to add to, and the Card says so.
 if(!cue){
  const free=cueDestinations(c,seam,route.id,null);
  return `<div class="c-head"><div class="c-k">Journey</div><div class="c-t">${esc(c.views[route.from]?.name||'Missing View')} → ${esc(c.views[route.to]?.name||'Missing View')}</div><div class="c-ref">${edgeLine}</div></div>`
   +`<p class="exp-fact">Camera ${clock.travelDuration.toFixed(1)} s + pauses ${clock.pause.toFixed(1)} s</p>`
   +(free.length?`<div class="exp-row"><span class="exp-row-k">Add a Cue at</span><select data-exp-station aria-label="Camera station">${free.map(s=>`<option value="${s.id}" ${s.id===params.station?'selected':''}>${esc(s.label)}</option>`).join('')}</select></div><div class="c-acts">${button('exp-beat','+ Cue','','primary')}</div>`
    :`<p class="exp-fact" data-no-free-station>Every station holds a Cue</p>`)
   +sharedLine
   +`<div class="c-acts">${button('exp-mark-station','Add mid-route station','','reference')}${button('exp-bring','Bring route into view','','reference')}</div>`
   +askHtml();
 }
 const cueLabel=cueName(e,route,cue);
 const pause=cue.holds.length===0?`No pause`
  :cue.holds.length===1?`${cue.holds[0].seconds} s`
  :`${cue.holds.length} holds · ${fmtClock(cue.pause)}`;
 // One line per action, in refusal ink when the target no longer carries the station trigger it would need.
 const actionLine=b=>{const d=e.definitions[e.uses[b.useId]?.definitionId],subject=d?.kind==='control'?ctx.sceneSource.subjects[d.subjectId]?.name:null;
  return `<p class="exp-fact" data-cue-action="${b.id}">${esc(d?.name||'Missing Activity')}${subject?` · ${esc(subject)}`:''}${stationBound(b)?'':` <span class="exp-refuse-text">· trigger elsewhere</span>`}</p>`;};
 return `<div class="c-head"><div class="c-k">Cue</div><div class="c-t">${esc(cueLabel)}</div><div class="c-ref">${edgeLine}${shared.length?` · the path also serves ${shared.map(r=>`Stop ${at(r.from)} → ${at(r.to)}`).join(', ')}`:''}</div></div>`
  +`<div class="exp-row"><span class="exp-row-k">At</span><span class="exp-fact" data-cue-at>${fmtClock(cue.at)}</span></div>`
  +`<div class="exp-row"><span class="exp-row-k">Pause</span><span class="exp-fact" data-cue-pause>${pause}</span></div>`
  +`<div class="exp-row"><span class="exp-row-k">Actions</span><span class="exp-fact" data-cue-actions>${cue.invokes.length}</span></div>`
  +(cue.invokes.length?cue.invokes.map(actionLine).join(''):'<p class="c-hint">No action here — this Cue only pauses.</p>')
  // §5.2.7: the writer keeps its open state across a rebuild; opening or closing it writes nothing.
  +`<details class="exp-more" data-exp-cue-edit><summary>Edit cue</summary>`
   +(cue.holds.length<=1?`<div class="exp-row"><span class="exp-row-k">Pause</span>${cue.holds.length?`<label class="exp-inline"><input type="number" min="0" step=".25" data-exp-hold="${cue.holds[0].id}" value="${cue.holds[0].seconds}" aria-label="Hold seconds">s</label>`:`<span class="exp-fact">No pause at this station</span>`}</div>`
    :`<details class="exp-more" data-exp-cue-holds><summary>Edit holds · ${cue.holds.length}</summary>${cue.holds.map(h=>`<label class="exp-label">Hold ${fmtClock(h.at)}<input type="number" min="0" step=".25" data-exp-hold="${h.id}" value="${h.seconds}" aria-label="Hold seconds">s</label>`).join('')}<p class="c-hint">Every hold stays its own authored pause; the total is a reading, never a field that consolidates them.</p></details>`)
   +`<div class="c-acts">${button('exp-beat','Add hold here')}</div>`
   +`<div class="exp-row"><span class="exp-row-k">Action</span><select data-exp-invoke-use aria-label="Choose Activity"><option value="">Choose Activity</option>${Object.values(e.uses).filter(invokable).map(u=>`<option value="${u.id}" ${params.invokeUse===u.id?'selected':''}>${esc(e.definitions[u.definitionId]?.name)}</option>`).join('')}</select></div>`
   +`<div class="c-acts">${button('exp-invoke-beat','Invoke here').replace('class=',(params.invokeUse?'':'disabled ')+'class=')}</div>`
   +`<p class="c-hint">A binding moves that Activity's trigger to this station; a visitor offer stays with its subject.</p>`
   +`<div class="exp-row"><span class="exp-row-k">Move to</span><select data-exp-cue-move aria-label="Move cue to station"><option value="">Choose a station</option>${cueDestinations(c,seam,route.id,cue.stationId).map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></div>`
   +`<p class="c-hint">Only stations this Cue can really take are offered: its own, and any station another Cue already holds, are not. A move rebinds every beat of this Cue and its Activity bindings as one Undo step.</p>`
   +`</details>`
  +sharedLine
  +`<div class="c-acts">${button('exp-cue-look','Look through')}</div>`
  +askHtml();
}
// §5.4: the edge's own Card. It owns the continuation's identity, Cut/Travel as one segmented pair, the
// aggregate origin coverage with its one explicit repair, and the one door to the Camera Path posture. The
// per-origin rows, the Pace writer and the Journey's reading all live in the postures' own homes, so nothing
// here duplicates them, and the edge is a separate inspection from any Stop.
export function edgeCard({from,to}){
 const e=ctx.experience,c=resolvedCamera(),seam=getSeam(e,from,to),rows=originCoverage(e,c,from,to);
 const supported=r=>!r.missing&&(!!r.connectionId||r.viewId===r.targetId);
 const reachable=rows.filter(supported).length,unprepared=rows.filter(r=>!r.connectionId&&!r.missing&&r.viewId!==r.targetId).length,unsupported=rows.filter(r=>r.missing).length;
 const connections=[...new Set(rows.map(r=>r.connectionId).filter(Boolean))];
 // §5.4: the door opens the departure Stop's own entry-View route where one exists, else the first route
 // that really reaches this edge; it is offered whenever at least one route exists.
 const departureView=e.uses[stopEntry(e,from).id]?.viewId;
 const active=c.connections[S.task?.params?.connection]||c.connections[connections.find(id=>c.connections[id].from===departureView)]||(connections.length?c.connections[connections[0]]:null);
 const at=id=>e.guide.indexOf(id)+1,name=id=>e.presentations[e.stops[id]?.presentationId]?.name||'Missing Presentation';
 const entryTo=stopEntry(e,to),entryName=c.views[e.uses[entryTo.id]?.viewId]?.name||(entryTo.hold?'the current viewpoint':'a missing entry');
 return `<div class="c-head"><div class="c-k">Guide edge</div><div class="c-t">${esc(name(from))} → ${esc(name(to))}</div><div class="c-ref">Stop ${at(from)} → Stop ${at(to)} · arrives at ${esc(entryName)}</div></div>`
  +`<div class="exp-seg" role="group" aria-label="Movement">${button('exp-cut','Cut').replace('data-id=',`aria-pressed="${seam.mode==='cut'}" data-id=`)}${button('exp-travel','Travel').replace('data-id=',`aria-pressed="${seam.mode==='travel'}" data-id=`)}</div>`
  +`<p class="exp-fact" data-edge-coverage>Reachable from ${reachable} of ${rows.length} Views</p>`
  +(stopEntry(e,from).hold?'<p class="c-hint">Departure entry held · there is no originating View to travel from.</p>':'')
  +(seam.mode==='cut'
   ?`<p class="exp-fact" data-edge-cut>The visit cuts straight to Stop ${at(to)+1}'s entry.</p>`
   :(unprepared?`<p class="exp-gap" role="status">Travel needs support for the new View — an unresolved origin stays an explicit Travel gap</p><div class="c-acts">${button('exp-prepare','Prepare missing routes')}</div>`:'')
    +(unsupported?'<p class="exp-gap" role="status">An origin or destination entry needs repair before Camera can support it</p>':'')
    +(!unprepared&&!unsupported?'<p class="c-hint">All origins supported · Camera owns the routes.</p>':'')
    +(active?`<p class="exp-fact">Travel · ${esc(c.views[active.from]?.name||'Unknown')} → ${esc(c.views[active.to]?.name||'Unknown')} · Camera owns the route</p>`:''))
  // §5.5: the Path posture is the edge's Camera half, and it is one door at any movement mode — the author
  // may ready the Camera before choosing Cut or Travel. Its *From* list is the only per-origin connect door,
  // so the door is offered whenever Camera has work here: a route to read, or an origin still to connect.
  // A fresh edge with no route at all would otherwise have no way to author its first origin.
  +(connections.length||unprepared?`<div class="c-acts">${button('exp-route','Edit Camera Path',(active||c.connections[connections[0]])?.id||'')}</div>`:'')
  +`<div class="c-acts">${button('exp-bring','Bring route into view','','reference')}</div>`
  +askHtml();
}
// The Precision Instrument keeps the reading, the postures and the current-context return. The property
// list is deliberate depth, not a floating dashboard: the drawing's own grips select the active property,
// the Camera Card names them all, and exactly one value is live on the Stage tape at a time.
export function precisionHtml(){
 const t=S.task,v=resolvedCamera().views[t?.target?.id];if(!v)return `<p>Camera View removed · Repair required</p>${button('exp-close','Close')}`;
 const reading=readingFor({...v,pose:S.cameraDraft?.pose||v.pose});t.params.posture=reading;
 return `<div class="camera-toolbar"><b>Precise Camera · ${esc(v.name)} · ${reading} · Authoring</b>${button('exp-camera-return','Put it back')}${button('exp-close','Close')}</div><div class="camera-postures">${['outside','through','plan'].map(p=>button('exp-posture',p==='through'?'Look through':p).replace('data-id=',`aria-pressed="${reading===p}" data-posture="${p}" data-id=`)).join('')}</div><p class="c-hint">Active property · ${esc(gripLabels[t.params.grip]||'none')} — select another grip on the drawing; the full list stays in the Camera Card.</p>`;
}

export function askHtml(){
 // UX2: a Plan reading never captures itself. The choice is explicit, and nothing is created before it:
 // composing in 3D, using the plan as the visitor's own View (offered only when the visitor's Camera
 // kernel would reproduce it), or cancelling.
 const plan=S.expPlanAsk;
 if(plan){const support=planCaptureSupport();return `<div class="ask-rule" data-plan-ask role="status"><b>Present from a Plan reading</b><p>Nothing is created until you choose how the visitor should meet this${plan.focus.kind==='subjects'?' subject':''}.</p>${button('exp-plan-compose','Compose in 3D','','primary')}${support.ok?button('exp-plan-view','Use the plan as the visitor View'):`<p class="exp-gap" data-plan-view-unavailable>${esc(support.reason)}</p>`}${button('exp-plan-cancel','Cancel')}</div>`;}
 const source=S.expSourceAsk,ask=S.expAsk,route=S.expRouteAsk,rebind=S.expRebindAsk;
 // P1 — a descriptor replacement on a linked definition is a shared edit: it discloses the real reach
 // and waits for an explicit local fork or shared acceptance before anything is written.
 if(rebind)return `<div class="ask-rule"><b>Experience · shared contribution edit</b><p>This replacement changes the definition shared by ${rebind.reach.length} linked Activities: ${rebind.reach.map(r=>esc(r.name)).join(', ')}.</p>${button('exp-rebind-shared','Update all linked Activities','','primary')}${button('exp-rebind-local','Only this Activity')}${button('exp-rebind-cancel','Cancel')}</div>`;
 if(source)return `<div class="ask-rule"><b>Experience · shared edit</b><p>${esc(source.label)} affects ${source.affected.map(s=>esc(s.name)).join(', ')}.</p>${button('exp-source-accept','Update all affected occurrences','','primary')}${button('exp-source-cancel','Cancel')}</div>`;
 if(route)return `<div class="ask-rule"><b>Camera · shared route edit</b><p>Reaches ${route.affected.map(s=>`Stop ${ctx.experience.guide.indexOf(s.from)+1} → ${ctx.experience.guide.indexOf(s.to)+1}`).join(', ')}.</p>${button('exp-route-scope','Update shared route','','primary')}${button('exp-route-cancel','Cancel')}</div>`;
 if(!ask)return '';
 return `<div class="ask-rule"><b>Camera · Update scope</b><p>Affects ${ask.reach.uses.map(u=>esc(u.name)).join(', ')}; Stops: ${ask.reach.stops.map(s=>esc(s.name)).join(', ')||'none'}</p>${button('exp-scope-shared','Update all affected uses','','primary')}${button('exp-scope-local',ask.stopId?'Only this Stop entry':'Detach this use')}${button('exp-scope-cancel','Cancel')}</div>`;
}
function presentationOptions(selected){return Object.values(ctx.experience.presentations).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');}
function signalLabel(ref){const e=ctx.experience,d=e.definitions[e.uses[ref?.useId]?.definitionId];return `${d?.name||'Missing Activity'} · ${ref?.signal==='complete'?'finished':d?.markers?.find(m=>`marker:${m.id}`===ref?.signal)?.label||'Missing phrase'}`;}
// The picker offers exactly what the model would accept: one authority, so a visitor offer or an
// unsupported capability is never presented as automatic station work.
function invokable(u){return invokableRefusal(ctx.experience,ctx.sceneSource,u)==='';}
// A beat whose target no longer carries the station trigger would run twice on the next traversal.
function stationBound(beat){
 const u=ctx.experience.uses[beat.useId],seam=S.experienceContext?.seam;
 return !!u&&u.start.kind==='station'&&u.start.seam?.from===seam?.from&&u.start.seam?.to===seam?.to&&u.start.stationId===beat.stationId;
}
function signalPicker(attribute,id,current,filter=()=>true){const refs=signalOptions().filter(filter);if(current&&!refs.some(r=>JSON.stringify(r)===JSON.stringify(current)))refs.push(current);return `<select ${attribute}="${id}"><option value="">None</option>${refs.map(ref=>`<option value="${esc(JSON.stringify(ref))}" ${JSON.stringify(ref)===JSON.stringify(current)?'selected':''}>${esc(signalLabel(ref))}</option>`).join('')}</select>`;}
// A routed repair notice: the message names the missing reference, and the compatible writers are offered
// where the retained instruction is selected — never in a separate permanent dashboard. Required work
// refuses locally; optional work disables honestly until it is repaired.
function repairControls(u){
 const e=ctx.experience,d=e.definitions[u.definitionId],scene=ctx.sceneSource,parts=[];
 if(u.viewId)parts.push(`<label class="exp-label">Repair framing<select data-exp-repair="${u.id}"><option value="">Choose a resolving Camera View</option>${Object.values(resolvedCamera().views).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label>`);
 // A retained View use whose home Presentation was removed can be rehomed into an existing Presentation —
 // never rehomed to Experience scope, where a View would have no meaning.
 if(u.viewId&&u.presentationId&&!e.presentations[u.presentationId])parts.push(`<label class="exp-label">Repair home<select data-exp-rehome="${u.id}"><option value="">Choose a Presentation</option>${Object.values(e.presentations).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`);
 else if(d?.kind==='control'){
  // A repair reads the same pending proposal as the Revise controls: the capability list follows the
  // subject the author has proposed, even before the shared acceptance writes it.
  const proposed=pendingDescriptor(u.id,d);
  parts.push(`<label class="exp-label">Repair subject<select data-exp-rebind-subject="${u.id}"><option value="">Choose a subject</option>${Object.values(scene.subjects).map(s=>`<option value="${s.id}" ${proposed.subjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`);
  parts.push(`<label class="exp-label">Repair capability<select data-exp-rebind-capability="${u.id}"><option value="">Choose a capability</option>${capabilities(scene,proposed.subjectId).filter(isRealized).map(c=>`<option value="${c.id}" ${proposed.capabilityId===c.id?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>`);
 }
 if(u.kind==='interaction'&&!scene.subjects[u.triggerSubjectId])parts.push(`<label class="exp-label">Repair activation subject<select data-exp-rebind-trigger="${u.id}"><option value="">Choose the activating subject</option>${Object.values(scene.subjects).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>`);
 if(u.availability&&!e.presentations[u.availability])parts.push(`<label class="exp-label">Repair availability<select data-exp-rebind-availability="${u.id}"><option value="">Experience-wide</option>${Object.values(e.presentations).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`);
 return parts.join('');
}
function issuesHtml(id){
 const issues=contributionIssues(ctx.experience,resolvedCamera(),ctx.sceneSource,capability).filter(i=>i.id===id);
 if(!issues.length)return '';
 const u=ctx.experience.uses[id];
 return `<div class="ask-rule" role="status"><b>Repair · the original instruction is retained</b>${issues.map(i=>`<p class="exp-gap">${esc(i.message)}</p>`).join('')}${u?repairControls(u):''}</div>`;
}
function activityDetails(u){
 // A station binding is authored from the Seam's coordination strip, never invented here: the option only
 // appears as the current binding, so the same Activity always has exactly one visible trigger.
 const scope=activationScope(u),end=boundaryScope(u),retention=u.retention||u.end;
 return `<details class="exp-more" data-exp-activity-details><summary>Activity relationships · optional</summary><label class="exp-label">Organized in<select data-exp-home="${u.id}"><option value="">Experience</option>${presentationOptions(u.presentationId)}</select></label><label class="exp-label">Starts<select data-exp-start="${u.id}">${[...[['visit','Presentation entry'],['experience','Experience start'],['after','After a supported signal']],...u.start.kind==='station'?[['station','Invoked at a Seam station']]:[]].map(([k,label])=>`<option value="${k}" ${u.start.kind===k?'selected':''}>${label}</option>`).join('')}</select></label>${u.start.kind==='station'?`<p class="exp-fact">Invoked by ${stationBindingLabel(u)}<br>The station is this Activity's only trigger; a visitor offer is never invoked by a traversal.</p>`:''}${['visit','after'].includes(u.start.kind)?`<label class="exp-label">Activation Presentation<select data-exp-start-presentation="${u.id}">${u.start.kind==='after'?`<option value="" ${scope===null?'selected':''}>Experience-wide listener</option>`:''}${presentationOptions(scope)}</select></label>`:''}${u.start.kind==='after'?`<label class="exp-label">Start signal${signalPicker('data-exp-after',u.id,{useId:u.start.useId,signal:u.start.signal},r=>r.useId!==u.id)}</label>`:''}<label class="exp-label">Running lifetime<select data-exp-boundary="${u.id}">${[['visit','Leave a Presentation'],['complete','This operation completes'],['experience','Stop or Experience end']].map(([k,label])=>`<option value="${k}" ${u.end.kind===k?'selected':''}>${label}</option>`).join('')}</select></label>${u.end.kind==='visit'?`<label class="exp-label">Lifetime Presentation<select data-exp-boundary-presentation="${u.id}">${presentationOptions(end)}</select></label>`:''}<label class="exp-label">Keep result until<select data-exp-retention="${u.id}">${[['default','Use running boundary'],['visit','Leave activation Presentation'],['complete','Operation completes'],['experience','Experience end']].map(([k,label])=>`<option value="${k}" ${(u.retention?.kind||'default')===k?'selected':''}>${label}</option>`).join('')}</select></label><label class="exp-label">On departure<select data-exp-interruption="${u.id}"><option value="">Adapter default</option>${['cancel','finish','continue'].map(k=>`<option ${u.interruption===k?'selected':''}>${k}</option>`).join('')}</select></label><p class="c-hint">Organization is a locator, never a start trigger. Lifetime, waiting scope and retained results are independent.</p></details>`;
}
function narrationDetail(u,d){return `<details class="exp-more" data-exp-narration-details><summary>Explanation timing · phrases</summary><label class="exp-label">Text<textarea data-exp-def="text" data-id="${u.id}">${esc(d.text)}</textarea></label><label class="exp-label">Duration seconds · optional<input type="number" min=".1" step=".5" data-exp-def="duration" data-id="${u.id}" value="${d.duration??''}" placeholder="${narrationDuration(d).toFixed(1)} inferred"></label><p class="c-hint">Explicit marker seconds never rescale after text or duration changes.</p>${narrationPassages(d).map(p=>button('exp-passage',`Name passage · ${esc(p.text)}`,u.id).replace('data-id=',`data-time="${p.start}" data-label="${esc(p.text)}" data-id=`)).join('')}${button('exp-marker','Add named phrase',u.id)}${d.markers.map(m=>`<label class="exp-label">Phrase label<input data-exp-marker-field="label" data-marker="${m.id}" data-id="${u.id}" value="${esc(m.label)}"></label><label class="exp-label">At seconds<input type="number" min="0" step=".5" data-exp-marker-field="time" data-marker="${m.id}" data-id="${u.id}" value="${m.time??m.fraction*narrationDuration(d)}"></label>${button('exp-marker-remove','Remove phrase',u.id).replace('data-id=',`data-marker="${m.id}" data-id=`)}`).join('')}</details>`;}
const signalOptions=()=>Object.values(ctx.experience.uses).flatMap(u=>{const d=ctx.experience.definitions[u.definitionId];if(d?.kind==='narration')return [{useId:u.id,signal:'complete'},...d.markers.map(m=>({useId:u.id,signal:`marker:${m.id}`}))];if(d?.kind==='control'&&capability(ctx.sceneSource,d.subjectId,d.capabilityId)?.kind!=='loop')return [{useId:u.id,signal:'complete'}];return [];}).filter(ref=>supportedSignal(ctx.experience,ctx.sceneSource,ref));
export function cueSelect(id) {
 const use=ctx.experience.uses[id];
 return `<label class="cue-select">Automatic View cue ${signalPicker('data-exp-cue',id,use.cue,ref=>ctx.experience.definitions[ctx.experience.uses[ref.useId]?.definitionId]?.kind==='narration')}</label>${issuesHtml(id)}`;
}
export function contributionsHtml(pid) {
 return Object.values(ctx.experience.uses).filter(u=>u.presentationId===pid&&!u.viewId&&!isPrimaryExplanation(ctx.experience,pid,u)).map(u=>{const d=ctx.experience.definitions[u.definitionId];if(!d)return '<p>Missing contribution — Repair required</p>';
 const cap=d.kind==='control'?capability(ctx.sceneSource,d.subjectId,d.capabilityId):null,subject=d.kind==='control'?ctx.sceneSource.subjects[d.subjectId]?.name:null;
 const identity=d.kind==='control'?`${esc(subject||'Missing subject')} · ${esc(cap?.label||d.capabilityId)} · ${esc(valueLabel(cap,d.value))}`:esc(d.text||'');
 const where=u.presentationId?`in ${esc(ctx.experience.presentations[u.presentationId]?.name||'Missing Presentation')}`:'at Experience scope';
 const activation=u.kind==='interaction'?`Activated by ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'Missing activation')}`:u.start.kind==='after'?'Starts after a supported dependency':u.start.kind==='station'?`Invoked by ${stationBindingLabel(u)}`:'Starts on Presentation entry';
 return `<div class="contribution"><button class="exp-action reference" data-act="pres-ref" data-id="${u.id}"><b>${esc(d.name||d.capabilityId)}</b> · ${identity}</button><p>${where} · ${activation}</p>${d.kind==='narration'?`<textarea data-exp-def="text" data-id="${u.id}">${esc(d.text)}</textarea>${button('exp-marker','Add named phrase',u.id)}<p>${d.markers.map(m=>esc(m.label)).join(', ')}</p>`:''}<details><summary>Start · boundary · interruption</summary><label>Interruption <select data-exp-interruption="${u.id}"><option value="">Type default</option>${['cancel','finish','continue'].map(v=>`<option ${u.interruption===v?'selected':''}>${v}</option>`).join('')}</select></label>${u.kind==='interaction'?`<label>Availability <select data-exp-availability="${u.id}"><option value="">Experience-wide</option>${Object.values(ctx.experience.presentations).map(p=>`<option value="${p.id}" ${u.availability===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}<label>Start after <select data-exp-after="${u.id}"><option value="">Visit entry</option>${signalOptions().filter(r=>r.useId!==u.id).map(r=>`<option value="${esc(JSON.stringify(r))}" ${u.start.kind==='after'&&JSON.stringify({useId:u.start.useId,signal:u.start.signal})===JSON.stringify(r)?'selected':''}>${esc(r.useId)} · ${esc(r.signal)}</option>`).join('')}</select></label></details>${button('exp-remove-contribution','Remove',u.id)}</div>`;}).join('');
}
export function offerHtml() {
 const draft=S.expOfferDraft;if(!draft)return '';
 const scene=ctx.sceneSource,cap=capability(scene,draft.subjectId,draft.capabilityId);
 const subjects=selected=>Object.values(scene.subjects).map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
 return `<div class="offer-draft" data-exp-offer-draft><b>Add behavior or offer</b><label>Kind <select data-exp-offer="kind"><option value="behavior">Behavior</option><option value="interaction" ${draft.kind==='interaction'?'selected':''}>Visitor offer</option></select></label><label>Target <select data-exp-offer="subjectId">${subjects(draft.subjectId)}</select></label><label>Capability <select data-exp-offer="capabilityId">${capabilities(scene,draft.subjectId).filter(isRealized).map(c=>`<option value="${c.id}" ${c.id===draft.capabilityId?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>${cap?.control==='range'?`<label>Value <input type="number" data-exp-offer="value" value="${Number(draft.value)}" min="${cap.min}" max="${cap.max}" step=".1"></label>`:`<label>Value <select data-exp-offer="value"><option value="true">On / Play</option><option value="false" ${draft.value==='false'?'selected':''}>Off / Stop</option></select></label>`}${draft.kind==='interaction'?`<label>Activation <select data-exp-offer="trigger">${subjects(draft.trigger)}</select></label><label>Availability <select data-exp-offer="availability"><option value="">Experience-wide</option>${Object.values(ctx.experience.presentations).map(p=>`<option value="${p.id}" ${draft.availability===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><p class="c-hint">Availability is independent of this Presentation's meaning. Experience-wide is the default.</p>`:''}<div class="c-acts">${button('exp-offer-accept','Add')}${button('exp-offer-cancel','Cancel')}</div></div>`;
}
// C9.6 repair: the choices this Stop actually authors, each read against the Stop it names. A destination
// that left with its Presentation is repairable or removable here — the one place the author reads that
// Stop — so Preview is never offered a continuation that cannot resolve.
function choicesHtml(e,s) {
 if(!s.choices.length)return '';
 return `<div class="c-sec">Authored choices · this Stop</div>`+s.choices.map(c=>{const t=choiceTarget(e,c);
  return `<div class="exp-fact" data-choice="${esc(c.id)}">${c.kind==='go'?'Go':'Detour'} · ${esc(c.label)}<br>${t.missing?`<span class="exp-gap" role="status">Missing Stop · repair required</span>`:`Destination · ${t.at<0?'':`Stop ${t.at+1} · `}${esc(t.name)}`}</div><div class="c-acts">${t.missing?`<label class="exp-label">Repair destination<select data-exp-choice-target="${c.id}" data-id="${s.id}"><option value="">Choose a resolving Stop</option>${Object.values(e.stops).filter(x=>x.id!==s.id).map(x=>`<option value="${x.id}">${(()=>{const at=e.guide.indexOf(x.id);return at<0?'':`Stop ${at+1} · `;})()}${esc(x.name)}</option>`).join('')}</select></label>`:''}${button('exp-choice-remove','Remove choice',s.id).replace('data-id=',`data-choice="${c.id}" data-id=`)}</div>`;
 }).join('');
}
// UX4 · QA 4: Entry and Next are the Stop's two ordinary reads; Pacing, Gate and the authored choices
// are deliberate depth under Stop detail. Ordering, repeating and removal are the Deck's Edit Guide.
// Detour/Go stay the run-time Stop resolution, distinct from the Stop's own Next edge.
export function stopDetails(s) {
 const e=ctx.experience,c=resolvedCamera(),p=e.presentations[s.presentationId];
 const entry=stopEntry(e,s.id),def=entryUse(e,s.presentationId),defView=def?c.views[def.viewId]:null;
 const entryValue=s.entry.kind==='use'?s.entry.useId:s.entry.kind,selected=value=>value===entryValue?'selected':'';
 const next=resolveNext(e,s.id),nextValue=s.next.kind==='target'?s.next.id:s.next.kind;
 const entryViewName=c.views[e.uses[entry.id]?.viewId]?.name||(entry.hold?'Keep current viewpoint':'Repair required');
 const destEntry=next.id?stopEntry(e,next.id):null,destViewName=destEntry?(c.views[e.uses[destEntry.id]?.viewId]?.name||(destEntry.hold?'Keep current viewpoint':'Repair required')):'—';
 const seam=next.id?getSeam(e,s.id,next.id):null;
 const gaps=next.id?originCoverage(e,c,s.id,next.id).filter(r=>!r.missing&&!r.connectionId&&r.viewId!==r.targetId).length:0;
 // QA 4's Movement line: the continuation's own reading in one place, before the one door to its edge.
 const movement=!next.id?'End of Guide'
  :next.missing?'Camera Path · needs repair'
  :`${seam.mode==='travel'?'Travel':'Cut'} · ${esc(entryViewName)} → ${esc(destViewName)}${seam.mode==='travel'?` · ${gaps?`Camera Path · ${gaps} gap`:'Camera Path ready'}`:''}`;
 const orderNext=e.guide[e.guide.indexOf(s.id)+1];
 return `<div class="exp-row" data-stop-entry><span class="exp-row-k">Entry</span><select data-exp-entry="${s.id}" aria-label="Entry policy"><option value="presentation" ${selected('presentation')}>Presentation Default${defView?` (${esc(defView.name)})`:''}</option><option value="hold" ${selected('hold')}>Keep current viewpoint</option>${[...new Set([...(p?.uses||[]),...(s.entry.kind==='use'?[s.entry.useId]:[])])].map(id=>`<option value="${esc(id)}" ${selected(id)}>${esc(e.uses[id]?.name||'Missing View use — Repair required')}</option>`).join('')}</select></div>`
  +`<div class="exp-row"><span class="exp-row-k">Next</span><select data-exp-next="${s.id}" aria-label="Next continuation"><option value="order" ${nextValue==='order'?'selected':''}>Guide order${orderNext?` (Stop ${e.guide.indexOf(orderNext)+1} · ${esc(e.stops[orderNext]?.name||'Missing Stop')})`:''}</option><option value="end" ${nextValue==='end'?'selected':''}>End</option>${[...new Set([...e.guide.filter(id=>id!==s.id),...(s.next.kind==='target'?[s.next.id]:[])])].map(id=>`<option value="${id}" ${nextValue===id?'selected':''}>Stop ${e.guide.indexOf(id)+1} · ${esc(e.stops[id]?.name||'Missing Stop — Repair required')}</option>`).join('')}</select></div>`
  +`<div class="exp-row"><span class="exp-row-k">Movement</span><span class="exp-fact" data-stop-movement>${movement}</span></div>`
  +stopConditionIssues(e,ctx.sceneSource,s.id,capability).map(i=>`<p class="exp-gap" role="status">${esc(i.message)} · original instruction retained</p>`).join('')
  +(next.id?`<div class="c-acts">${button('exp-seam','Edit movement',s.id).replace('data-id=',`data-from="${s.id}" data-to="${next.id}" data-id=`)}</div>`:'')
  +`<div class="stop-details"><details data-exp-stop-detail><summary>Stop detail</summary><label>Gate ${signalPicker('data-exp-gate',s.id,s.gate)}</label><label>Pacing <select data-exp-pacing="${s.id}">${['auto','dwell','signal'].map(k=>`<option ${s.pacing.kind===k?'selected':''}>${k}</option>`).join('')}</select></label>${s.pacing.kind==='dwell'?`<label>Dwell seconds<input type="number" min=".1" step=".5" data-exp-stop-number="dwell" data-id="${s.id}" value="${s.pacing.seconds}"></label>`:''}${s.pacing.kind==='signal'?`<label>Pacing signal${signalPicker('data-exp-pacing-signal',s.id,s.pacing.ref)}</label>`:''}<label>Detour <select data-exp-choice-kind="detour" data-id="${s.id}"><option value="">Add detour</option>${e.guide.filter(id=>id!==s.id).map(id=>`<option value="${id}">${esc(e.stops[id].name)}</option>`).join('')}</select></label><label>Go <select data-exp-choice-kind="go" data-id="${s.id}"><option value="">Add go</option>${e.guide.filter(id=>id!==s.id).map(id=>`<option value="${id}">${esc(e.stops[id].name)}</option>`).join('')}</select></label>${choicesHtml(e,s)}</details></div>`;
}
export function visitorHtml() {
 const {source,runtime:r}=S.visitor,e=source.experience,p=e.presentations[r.presentationId],gate=gateState(e,source.camera,r);
 const visitorButton=(command,text,id='')=>button('exp-visitor',text,id).replace('data-id=',`data-command="${command}" data-id=`);
 const subjectName=id=>source.scene.subjects[id]?.name;
 // An offer reads its own availability, its activation subject and the subject it operates: the
 // visitor sees what will happen before the click, never a bare Activity name.
 const offerLabel=u=>{const d=e.definitions[u.definitionId],trigger=subjectName(u.triggerSubjectId)||'Missing activation',target=subjectName(d?.subjectId);return `${esc(d?.name||'Unavailable')} · ${esc(trigger)}${target&&target!==trigger?` → ${esc(target)}`:''}`;};
 const interactions=Object.values(e.uses).filter(u=>u.kind==='interaction'&&(!u.availability||u.availability===r.presentationId));
 const choice=S.visitorChoice;
 const others=Object.values(e.presentations).filter(x=>x.id!==r.presentationId);
 const standalone=!r.stopId&&!!r.presentationId;
 return `<div class="visitor-title">${esc(p?.name||(r.exploring?'Exploring the World':'Experience'))}</div><p>${esc(p?.meaning)}</p><p class="visitor-caption" aria-live="polite">${r.captions?esc(narrationCaption(e,r)):''}</p>${visitorButton('captions',r.captions?'Hide captions':'Show captions')}<details class="visitor-transcript"><summary>Transcript</summary>${Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==='narration'&&(activationScope(u)===r.presentationId||activationScope(u)===null)).map(u=>`<p>${esc(e.definitions[u.definitionId].text)}</p>`).join('')}</details><div class="visitor-controls">${r.stopId?`${visitorButton('back','Back')}${visitorButton('next','Next').replace('class="exp-action action"',`class="exp-action action" ${gate.allowed?'':'disabled'}`)}${visitorButton('auto',r.autoplay?'Pause Auto':'Auto')}<span>${esc(gate.reason)}</span>`:e.guide.length?visitorButton('start','Start Guide'):''}${standalone&&!r.exploring?visitorButton('close','Close Presentation'):''}${visitorButton(r.exploring?'rejoin':'explore',r.exploring?'Rejoin':'Explore')}${r.bookmarks.length?visitorButton('return','Return from detour'):''}${button('exp-exit-preview','Exit Preview')}</div>${others.length?`<div class="visitor-presentations">${others.map(x=>visitorButton('open',`Open · ${esc(x.name)}`,x.id)).join('')}</div>`:''}<div>${eligibleViews(e,r.presentationId).map(id=>visitorButton('look',esc(e.uses[id].name),id)).join('')}${p?.viewOrder?visitorButton('previous-view','Previous View')+visitorButton('next-view','Next View'):''}</div>${choice?`<div class="visitor-choice" role="group" aria-label="Choose an offer"><b>${esc(subjectName(choice.triggerId)||'This subject')} offers ${choice.offers.length} interactions · choose one</b>${choice.offers.map(id=>visitorButton('activate',offerLabel(e.uses[id]),id)).join('')}${visitorButton('choice-cancel','Cancel')}</div>`:''}<div>${interactions.map(u=>visitorButton('activate',offerLabel(u),u.id).replace('class=',(contributionIssues(e,source.camera,source.scene,capability).some(i=>i.id===u.id)?'disabled ':'')+'class=')).join('')}</div><div>${Object.values(r.activities).filter(a=>a.status==='running').map(a=>visitorButton('stop','Stop '+esc(e.definitions[e.uses[a.useId]?.definitionId]?.name||a.useId),a.token)).join('')}</div>${e.stops[r.stopId]?.choices.map(c=>{const t=choiceTarget(e,c);return visitorButton(c.kind==='go'?'go':'detour',esc(c.label)+(t.missing?' · repair required':''),c.targetId).replace('class=',(t.missing?'disabled ':'')+'class=');}).join('')||''}${r.refusal?`<p role="status">${esc(r.refusal)}</p>`:''}`;
}
export function sceneCapabilityCard(id) {
 const scene=ctx.sceneSource,s=scene?.subjects[id];if(!s)return '';
 // C9.6 provider replacement: the selected World subject's declared profile is changed through the
 // adapter that owns it. The instance, position and geometry are kept; capability gain/loss is honest.
 return `<div class="c-sec">Provider profile · Scene source</div><label class="exp-label">Profile<select data-exp-profile="${id}">${profileOptions().map(pr=>`<option value="${pr}" ${pr===s.profile?'selected':''}>${pr}</option>`).join('')}</select></label><p class="c-hint">Replacing keeps this instance and its geometry; the adapter declares which capabilities are gained or lost.</p><div class="c-sec">Scene source capabilities</div>${capabilities(scene,id).filter(c=>c.sourceEditable).map(c=>`<label class="exp-label">${esc(c.label)} <input type="number" data-exp-scene="${c.id}" data-id="${id}" value="${s.properties[c.channel]}" min="${c.min??0}" max="${c.max??1}" step=".1"></label>`).join('')}<p class="c-hint">Scene source edits share history. Experience effects stay in visitor session state.</p>`;
}

export function experienceParkedHtml() {
 const p=S.parkedByLens.experience,v=experienceParkedContext();if(!p)return '';
 const controls=v.wrongLens?'Switch to Experience for explicit Resume':v.ok?button('exp-resume','Resume'):v.fix==='select'?button('pres-ref','Select original identity',p.identity):'';
 return `<div class="relation parked"><b>Parked · ${esc(p.name||p.kind)}</b><p>${esc(v.reason||'Inactive procedure; no Camera remembered')}</p>${controls}${button('exp-dismiss-parked','Dismiss')}</div>`;
}
