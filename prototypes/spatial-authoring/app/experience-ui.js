import { capability, capabilities } from './experience-capabilities.js';
import { gateState, narrationCaption } from './experience-runtime.js';
import { stations } from './camera-evaluation.js';
import { coordinateTiming } from './experience-coordination.js';
import { originCoverage, getSeam, resolveNext, stopEntry, viewReach, contributionIssues } from './experience-model.js';
import { S, ctx, thing } from './state.js';
import { resolveExperience, experienceParkedContext } from './experience.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (act, text, id = '') => `<button class="verb" data-act="${act}" data-id="${esc(id)}">${text}</button>`;
export function experienceIndex() {
  const e = ctx.experience;
  return `<div class="ix-head"><span class="ix-title">Experience</span><span class="ix-note">Meaning in the same World</span></div><div class="ix-group">Presentations</div>`
  + Object.values(e.presentations).map(p => `<div class="ix-row${S.sel === p.id ? ' sel' : ''}"><button class="ix-go" data-act="exp-open" data-id="${p.id}"><span class="glyph pres"></span><span class="ix-name">${esc(p.name)}</span></button></div>`).join('')
  + `<div class="ix-group">Scene subjects</div><div class="ix-note">Select an existing identity; presenting it is explicit.</div>${Object.values(ctx.sceneSource.subjects).map(s=>`<div class="ix-row"><button class="ix-go" data-act="pres-ref" data-id="${s.id}">${esc(s.name)}</button></div>`).join('')}<div class="c-acts">${button('exp-create','+ Presentation')}${button('exp-environment','Present environment')}${button('exp-region','Present region')}</div>`;
}
export function experienceCard() {
  const r = resolveExperience(S.sel);
  if (r?.kind === 'Presentation') {
    const p = r.item;
    const focus = p.focus.kind === 'subjects' ? p.focus.ids.map(id => `${esc(thing(id)?.item.name || id)} <button class="lnk" data-act="pres-ref" data-id="${esc(id)}">Select</button>`).join(', ') : esc(p.focus.kind);
    return `<div class="c-head"><div class="c-k">Presentation · Experience</div><div class="c-t">${esc(p.name)}</div><div class="c-ref">Owner · Experience · used by ${Object.values(ctx.experience.stops).filter(s=>s.presentationId===p.id).length} Stops</div></div>
    <div class="c-sec">Meaning</div><label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label><label class="exp-label">Meaning<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label>
    <div class="c-sec">Focus</div><div class="relation">${focus}</div><div class="c-sec">Show</div><p class="c-hint">Auto framing. Capture is explicit; the Set has no order.</p>${setHtml(p)}<div class="c-acts">${button("exp-auto","Auto")}${button("exp-capture","Capture")}${button("exp-preview","Preview",p.id)}${button("exp-add-guide","Add to Guide",p.id)}</div><label class="exp-label">Reuse View <select data-exp-reuse="${p.id}"><option value="">Choose existing Camera View</option>${Object.values(ctx.cameraSource.views).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label><div class="c-sec">Contributions</div><div class="c-acts">${button('exp-narration','Add narration')}${button('exp-offer','+ Add behavior or offer')}</div>${contributionsHtml(p.id)}${offerHtml()}`;
  }
  if(r?.kind==='Stop') {
   const p=ctx.experience.presentations[r.item.presentationId];
   return `<div class="c-head"><div class="c-k">This Stop · Experience</div><div class="c-t">${esc(p?.name||'Missing Presentation')}</div><div class="c-ref">Owner · Experience · occurrence ${ctx.experience.guide.indexOf(r.item.id)+1}<br>Reach · Entry, Next, Pacing and Gate affect this Stop; Meaning and Set affect all ${Object.values(ctx.experience.stops).filter(s=>s.presentationId===p?.id).length} Stops using this Presentation</div></div><div class="c-acts">${button('exp-open','Open shared Presentation',p?.id)}${button('exp-stop','Expand this occurrence',r.item.id)}</div>${p?setHtml(p):'<p>Repair required</p>'}${stopDetails(r.item)}`;
  }
  if(r?.kind==='View use'  || r?.kind==='Camera View') {
   const v=r.kind==='View use'?ctx.cameraSource.views[r.item.viewId]:r.item;
   const reach=v?viewReach(ctx.experience,v.id):{uses:[],stops:[]};
   const p=r.kind==='View use'?ctx.experience.presentations[r.item.presentationId]:null;
   return `<div class="c-head"><div class="c-k">${r.kind==='View use'?'View use · Experience':'Camera View · Camera'}</div><div class="c-t">${esc(v?.name||'Missing framing')}</div><div class="c-ref">Owner · ${r.kind==='View use'?'Experience role / Camera framing':'Camera framing'}<br>${p?'In '+esc(p.name)+(r.item.stopId?' · this Stop entry':' · shared Presentation Set')+'<br>':''}Reach · ${reach.uses.length} uses · ${reach.stops.length} Stops<br>${reach.uses.map(u=>esc(u.name)).join(', ')}</div></div><p class="c-hint">Framing belongs to Camera. Roles belong to the Presentation. ${v?'Capture and precise work are explicit.':'Repair required; missing framing is not Keep current viewpoint.'}</p>${r.kind==='View use'&&v?button('exp-precise','Precise Camera',r.item.id):''}${askHtml()}`;
  }
  const t = thing(S.sel);
  return `<div class="c-head"><div class="c-k">${t ? 'From the World lens' : 'Experience'}</div><div class="c-t">${esc(t?.item.name || 'Meaning in this World')}</div></div><p class="c-hint">Create or open a Presentation explicitly. Selection alone never captures or moves Camera.</p><div class="c-acts">${button('exp-create',t ? 'Present this' : '+ Presentation')}</div>`;
}
export const foreignExperienceCard = () => {
  const r = resolveExperience(S.sel);
  return r ? `<div class="c-head"><div class="c-k">Foreign identity · not a World subject</div><div class="c-t">${esc(r.item.name || r.kind)}</div><div class="c-ref">${r.owner} · ${esc(r.item.id)}</div></div><p class="c-hint">Select a World subject to work on the building.</p>` : '';
};

export function setHtml(p) {
 return `<div class="exp-set" aria-label="Unordered View Set">${p.uses.map(id=>{const u=ctx.experience.uses[id],v=ctx.cameraSource.views[u?.viewId];return `<div class="exp-view"><button class="lnk" data-act="pres-ref" data-id="${id}">○ ${esc(v?.name||'Missing View')}</button><span>${esc(u.role)}</span>${button('exp-hints','Hints',id)}${button('exp-precise','Precise',id)}${cueSelect(id)}${!v?`<select data-exp-repair="${id}"><option value="">Choose replacement View</option>${Object.values(ctx.cameraSource.views).map(v=>`<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select>`:''}<div>${button('exp-role','Entry',id).replace('data-id=', 'data-role="entry" data-id=')}${button('exp-role','Visitor choice',id).replace('data-id=', 'data-role="choice" data-id=')}</div></div>`;}).join('')}</div>`;
}
export function renderExperienceSurfaces() {
 renderDeck();
 document.body.classList.toggle('visitor-preview',!!S.visitor);
 let el=document.querySelector('#visitorSurface');
 if(!el){el=document.createElement('section');el.id='visitorSurface';document.querySelector('#stage').append(el);}
 el.hidden=!S.visitor;
 const presenter=document.querySelector('#experienceExamples');
 if(presenter){presenter.hidden=S.lens!=='experience'||!!S.visitor;const step=presenter.querySelector('[data-example-step]');step.textContent=['Ordinary Presentation','Unordered Set','Guide and Seams','Visitor execution'][S.experiencePresenter||0];}
 if(S.visitor) { const html=visitorHtml();if(el._html!==html){el.innerHTML=html;el._html=html;} }

}

export function renderDeck() {
 let el=document.querySelector('#experienceDeck');
 const e=ctx.experience,x=S.experienceContext;
 if(S.lens!=='experience'||S.visitor||(!e.guide.length&&!['precision','hints'].includes(x.depth))) {el?.remove();return;}
 if(!el){el=document.createElement('section');el.id='experienceDeck';document.querySelector('#stage').append(el);}
 let html='';el.className=`exp-deck ${x.depth}`;
 if(x.depth==='ordinary')html=`<span>Guide · ${e.guide.length} Stops</span>${button('exp-guide','Overview')}`;
 else html=`<div class="deck-head"><b>Guide Overview</b>${button('exp-close','Close')}</div><div class="stop-strip">${e.guide.map((id,i)=>{const s=e.stops[id],p=e.presentations[s.presentationId];return `${i?`<button class="seam-link" data-act="exp-seam" data-from="${e.guide[i-1]}" data-to="${id}">Seam</button>`:''}<article class="stop-card ${x.stop===id?'expanded':Math.abs(i-Math.max(0,e.guide.indexOf(x.stop)))<=1?'density-summary':'compact'}"><small>STOP ${i+1}</small>${button('exp-stop',esc(p?.name||'Missing Presentation'),id)}${x.stop!==id&&Math.abs(i-Math.max(0,e.guide.indexOf(x.stop)))<=1?`<p class="stop-summary">${esc(p?.meaning||'Open to compose this occurrence')}</p>`:''}${x.stop===id?`<p>${esc(p?.meaning)}</p>${p?setHtml(p):'<p>Presentation removed — Repair required</p>'}${button('exp-move-stop','←',id).replace('data-id=','data-delta="-1" data-id=')}${button('exp-move-stop','→',id).replace('data-id=','data-delta="1" data-id=')}`:''}</article>`;}).join('')}</div>`;
 if(x.depth==='hints')html=hintsHtml();
 if(x.depth==='precision')html=precisionHtml();
 if(x.seam&&['seam','route','coordination'].includes(x.depth))html=seamHtml(x.seam);
 if(el._html!==html){el.innerHTML=html;el._html=html;}
}

export function seamHtml({from,to}) {
 const e=ctx.experience,c=ctx.cameraSource,seam=getSeam(e,from,to),rows=originCoverage(e,c,from,to);
 const name=id=>e.presentations[e.stops[id]?.presentationId]?.name||'Missing Presentation';
 const compact=S.experienceContext.depth==='coordination'||seam.beats.length>0;
 const reachable=rows.filter(r=>r.connectionId&&!r.missing).length;
 return `<div class="deck-head"><b>Seam · ${esc(seam.mode)} · Experience / Camera</b>${button('exp-close','Close')}</div><div class="seam-bookends"><article><small>FROM STOP ${e.guide.indexOf(from)+1}</small><h3>${esc(name(from))}</h3>${compact?`<p>${rows.length} possible origins</p>`:rows.map(r=>`<div class="origin-row">${esc(c.views[r.viewId]?.name||'Missing View')} · ${r.connectionId?'✓':'GAP'} ${button(r.connectionId?'exp-route':'exp-connect',r.connectionId?'Edit route':'Connect',r.connectionId||r.useId)}</div>`).join('')}</article><article class="seam-instrument"><p>Reachable from ${reachable} of ${rows.length} Views</p>${button('exp-cut','Cut')}${button('exp-travel','Travel')}${button('exp-coordinate','Coordinate')}<p>${seam.mode==='travel'&&reachable<rows.length?'Travel refused for unresolved origins':'Cut authors no Camera edge'}</p>${S.experienceContext.depth==='route'?`${button('exp-route-return','Return to Seam reading')}<p>Click Stage to add an interior anchor; drag its diamond.</p>`:''}</article><article><small>TO STOP ${e.guide.indexOf(to)+1}</small><h3>${esc(name(to))}</h3><p>Entry · ${esc(c.views[e.uses[stopEntry(e,to).id]?.viewId]?.name||(stopEntry(e,to).hold?'Keep current viewpoint':'Missing entry — Repair required'))}</p></article></div>${S.experienceContext.depth==='coordination'||seam.beats.length?coordinationHtml(seam):''}`;
}

export function precisionHtml() {
 const t=S.task,v=ctx.cameraSource.views[t?.target?.id];if(!v)return `<div class="deck-head"><p>Camera View removed — Repair required</p>${button('exp-close','Close')}</div>`;
 const grip=t.params.grip,key=grip,value=['x','y','z'].includes(key)?v.pose.target[['x','y','z'].indexOf(key)]:v.pose[key],reach=viewReach(ctx.experience,v.id),ask=S.expAsk;
 return `<div class="deck-head"><b>Precise Camera · ${esc(v.name)} · ${esc(t.params.posture)} · Authoring</b>${button('exp-close','Close')}</div><div class="precision-camera">${['outside','through','plan'].map(p=>button('exp-posture',p).replace('data-id=','data-posture="'+p+'" data-id=')).join('')}<div>${['frameH','az','el','x','y','z'].map(g=>button('exp-grip',g).replace('data-id=','data-grip="'+g+'" data-id=')).join('')}</div><label class="numeric-tape">${esc(grip)} <input type="number" step="0.1" data-exp-precision="${esc(grip)}" value="${value}"></label><p>Owner · Camera · ${reach.uses.length} uses · ${reach.stops.length} Stops</p></div>`;
}

export function hintsHtml() {
 const t=S.task,v=ctx.cameraSource.views[t?.target?.id];if(!v)return '<p>Missing framing</p>';
 const hint=(label,key,value)=>button('exp-hint',label).replace('data-id=',`data-key="${key}" data-value="${value}" data-id=`);
 return `<div class="deck-head"><b>Framing Hints · ${esc(v.name)}</b>${button('exp-close','Close')}</div>${hint('Near','frameH',4)}${hint('Far','frameH',12)}${hint('Left','az',v.pose.az-.5)}${hint('Right','az',v.pose.az+.5)}${hint('Eye height','el',.2)}${button('exp-precise','Precise',t.params.useId)}`;
}

export function coordinationHtml(seam) {
 const c=ctx.cameraSource.connections[S.task?.params.connection],timing=coordinateTiming(ctx.cameraSource,seam);
 const options=c?stations(c):[];
 return `<div class="coordination-strip"><b>Local coordination · Experience beats / Camera stations</b>${c?`<label>Station <select data-exp-station>${options.map(s=>`<option value="${s.id}" ${s.id===S.task.params.station?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><label>Pace <select data-exp-pace>${['slow','auto','fast'].map(s=>`<option ${s===c.speed?'selected':''}>${s}</option>`).join('')}</select></label>${button('exp-beat','Hold here')}${button('exp-mark-station','Name mid-route station')}<select data-exp-invoke-use><option value="">Choose contribution</option>${Object.values(ctx.experience.uses).filter(u=>!u.viewId).map(u=>`<option value="${u.id}" ${S.task.params.invokeUse===u.id?'selected':''}>${esc(ctx.experience.definitions[u.definitionId]?.name)}</option>`).join('')}</select>${button('exp-invoke-beat','Invoke here').replace('class=',(S.task.params.invokeUse?'':'disabled ')+'class=')}`:'Choose a resolving Camera route'}<div class="beat-strip">${timing.map(b=>`<div class="beat" data-station="${b.stationId}">${esc(b.stationId)} · ${b.at===null?'Repair':b.at.toFixed(2)+' s'} · ${b.kind==='hold'?`hold <input type="number" min="0" step="0.25" data-exp-hold="${b.id}" value="${b.seconds}" aria-label="Hold at ${esc(b.stationId)} in seconds"> s`:'invoke '+esc(b.useId)}${b.reason?' · '+esc(b.reason):''}</div>`).join('')}</div><p>Geometry on Stage. ${c?button('exp-route','Edit route on Stage',c.id):''}</p>${S.expRouteAsk?`<div class="ask-rule">Shared route reaches ${S.expRouteAsk.affected.map(s=>esc(s.key)).join(', ')} ${button('exp-route-scope','Update shared route')}</div>`:''}</div>`;
}

export function askHtml() {
 const ask=S.expAsk;if(!ask)return '';
 return `<div class="ask-rule"><b>Camera · Update scope</b><p>Affects ${ask.reach.uses.map(u=>esc(u.name)).join(', ')}; Stops: ${ask.reach.stops.map(s=>esc(s.name)).join(', ')||'none'}</p>${button('exp-scope-shared','Update all affected uses')}${button('exp-scope-local',ask.stopId?'Only this Stop entry':'Detach this use')}${button('exp-scope-cancel','Cancel')}</div>`;
}

const signalOptions=()=>Object.values(ctx.experience.uses).flatMap(u=>{const d=ctx.experience.definitions[u.definitionId];if(d?.kind==='narration')return [{useId:u.id,signal:'complete'},...d.markers.map(m=>({useId:u.id,signal:`marker:${m.id}`}))];if(d?.kind==='control'&&capability(ctx.sceneSource,d.subjectId,d.capabilityId)?.kind!=='loop')return [{useId:u.id,signal:'complete'}];return [];});
export function cueSelect(id) {
 const use=ctx.experience.uses[id];
 return `<label class="cue-select">Cue <select data-exp-cue="${id}"><option value="">No cue</option>${signalOptions().filter(ref=>ctx.experience.definitions[ctx.experience.uses[ref.useId]?.definitionId]?.kind==='narration').map(ref=>`<option value="${esc(JSON.stringify(ref))}" ${JSON.stringify(use.cue)===JSON.stringify(ref)?'selected':''}>${esc(ref.signal)}</option>`).join('')}</select></label>`;
}
export function contributionsHtml(pid) {
 return Object.values(ctx.experience.uses).filter(u=>u.presentationId===pid&&!u.viewId).map(u=>{const d=ctx.experience.definitions[u.definitionId];if(!d)return '<p>Missing contribution — Repair required</p>';
 return `<div class="contribution"><b>${esc(d.name)} · ${esc(u.kind)}</b>${d.kind==='narration'?`<textarea data-exp-def="text" data-id="${u.id}">${esc(d.text)}</textarea>${button('exp-marker','Add named phrase',u.id)}<p>${d.markers.map(m=>esc(m.label)).join(', ')}</p>`:`<p>Target · ${esc(ctx.sceneSource.subjects[d.subjectId]?.name||'Missing subject')} · ${esc(d.capabilityId)} · ${esc(d.value)}</p><p>Activation · ${esc(ctx.sceneSource.subjects[u.triggerSubjectId]?.name||'No trigger')}</p>`}<details><summary>Start · boundary · interruption</summary><label>Interruption <select data-exp-interruption="${u.id}"><option value="">Type default</option>${['cancel','finish','continue'].map(v=>`<option ${u.interruption===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Start after <select data-exp-after="${u.id}"><option value="">Visit entry</option>${signalOptions().filter(r=>r.useId!==u.id).map(r=>`<option value="${esc(JSON.stringify(r))}" ${u.start.kind==='after'&&JSON.stringify({useId:u.start.useId,signal:u.start.signal})===JSON.stringify(r)?'selected':''}>${esc(r.useId)} · ${esc(r.signal)}</option>`).join('')}</select></label></details>${button('exp-remove-contribution','Remove',u.id)}</div>`;}).join('');
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
 return `<div class="visitor-title">${esc(p?.name)}</div><p>${esc(p?.meaning)}</p><p class="visitor-caption" aria-live="polite">${esc(narrationCaption(e,r))}</p><div class="visitor-controls">${r.stopId?`${visitorButton('back','Back')}${visitorButton('next','Next').replace('class="verb"',`class="verb" ${gate.allowed?'':'disabled'}`)}${visitorButton('auto',r.autoplay?'Pause Auto':'Auto')}<span>${esc(gate.reason)}</span>`:e.guide.length?visitorButton('start','Start Guide'):''}${visitorButton(r.exploring?'rejoin':'explore',r.exploring?'Rejoin':'Explore')}${r.bookmarks.length?visitorButton('return','Return from detour'):''}${button('exp-exit-preview','Exit Preview')}</div><div>${p?.uses.filter(id=>e.uses[id]?.role==='choice').map(id=>visitorButton('look',esc(e.uses[id].name),id)).join('')||''}</div><div>${interactions.map(u=>visitorButton('activate',esc(e.definitions[u.definitionId]?.name||'Unavailable')+' · '+esc(source.scene.subjects[u.triggerSubjectId]?.name||'Missing activation'),u.id).replace('class=',(contributionIssues(e,source.camera,source.scene,capability).some(i=>i.id===u.id)?'disabled ':'')+'class=')).join('')}</div><div>${Object.values(r.activities).filter(a=>a.status==='running').map(a=>visitorButton('stop','Stop '+esc(e.definitions[e.uses[a.useId]?.definitionId]?.name||a.useId),a.token)).join('')}</div>${e.stops[r.stopId]?.choices.map(choice=>visitorButton('detour',esc(choice.label),choice.targetId)).join('')||''}${r.refusal?`<p role="status">${esc(r.refusal)}</p>`:''}`;
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
