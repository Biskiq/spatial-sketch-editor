import { S, ctx, thing } from './state.js';
import { resolveExperience } from './experience.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (act, text, id = '') => `<button class="verb" data-act="${act}" data-id="${esc(id)}">${text}</button>`;
export function experienceIndex() {
  const e = ctx.experience;
  return `<div class="ix-head"><span class="ix-title">Experience</span><span class="ix-note">Meaning in the same World</span></div><div class="ix-group">Presentations</div>`
  + Object.values(e.presentations).map(p => `<div class="ix-row${S.sel === p.id ? ' sel' : ''}"><button class="ix-go" data-act="exp-open" data-id="${p.id}"><span class="glyph pres"></span><span class="ix-name">${esc(p.name)}</span></button></div>`).join('')
  + `<div class="c-acts">${button('exp-create','+ Presentation')}${button('exp-environment','Present environment')}${button('exp-region','Present region')}</div>`;
}
export function experienceCard() {
  const r = resolveExperience(S.sel);
  if (r?.kind === 'Presentation') {
    const p = r.item;
    const focus = p.focus.kind === 'subjects' ? p.focus.ids.map(id => `${thing(id)?.item.name || id} <button class="lnk" data-act="pres-ref" data-id="${esc(id)}">Select</button>`).join(', ') : esc(p.focus.kind);
    return `<div class="c-head"><div class="c-k">Presentation · Experience</div><div class="c-t">${esc(p.name)}</div><div class="c-ref">Owner · Experience · used by ${Object.values(ctx.experience.stops).filter(s=>s.presentationId===p.id).length} Stops</div></div>
    <div class="c-sec">Meaning</div><label class="exp-label">Name<input data-exp-field="name" data-id="${p.id}" value="${esc(p.name)}"></label><label class="exp-label">Meaning<textarea data-exp-field="meaning" data-id="${p.id}">${esc(p.meaning)}</textarea></label>
    <div class="c-sec">Focus</div><div class="relation">${focus}</div><div class="c-sec">Show</div><p class="c-hint">Auto framing. Capture is explicit; the Set has no order.</p>${setHtml(p)}<div class="c-acts">${button("exp-auto","Auto")}${button("exp-capture","Capture")}${button("exp-preview","Preview",p.id)}${button("exp-add-guide","Add to Guide",p.id)}</div>`;
  }
  if(r?.kind==='Stop') {
   const p=ctx.experience.presentations[r.item.presentationId];
   return `<div class="c-head"><div class="c-k">This Stop · Experience</div><div class="c-t">${esc(p?.name||'Missing Presentation')}</div><div class="c-ref">Occurrence ${ctx.experience.guide.indexOf(r.item.id)+1} · shared meaning</div></div><div class="c-acts">${button('exp-open','Open shared Presentation',p?.id)}${button('exp-stop','Expand this occurrence',r.item.id)}</div>${p?setHtml(p):'<p>Repair required</p>'}`;
  }
  if(r?.kind==='View use'  || r?.kind==='Camera View') {
   const v=r.kind==='View use'?ctx.cameraSource.views[r.item.viewId]:r.item;
   return `<div class="c-head"><div class="c-k">Camera View · Camera</div><div class="c-t">${esc(v?.name||'Missing framing')}</div></div><p class="c-hint">Framing belongs to Camera. Roles belong to the Presentation. ${v?'Capture and precise work are explicit.':'Repair required; missing framing is not Keep current viewpoint.'}</p>`;
  }
  const t = thing(S.sel);
  return `<div class="c-head"><div class="c-k">${t ? 'From the World lens' : 'Experience'}</div><div class="c-t">${esc(t?.item.name || 'Meaning in this World')}</div></div><p class="c-hint">Create or open a Presentation explicitly. Selection alone never captures or moves Camera.</p><div class="c-acts">${button('exp-create',t ? 'Present this' : '+ Presentation')}</div>`;
}
export const foreignExperienceCard = () => {
  const r = resolveExperience(S.sel);
  return r ? `<div class="c-head"><div class="c-k">Foreign identity · not a World subject</div><div class="c-t">${esc(r.item.name || r.kind)}</div><div class="c-ref">${r.owner} · ${esc(r.item.id)}</div></div><p class="c-hint">Select a World subject to work on the building.</p>` : '';
};

export function setHtml(p) {
 return `<div class="exp-set" aria-label="Unordered View Set">${p.uses.map(id=>{const u=ctx.experience.uses[id],v=ctx.cameraSource.views[u?.viewId];return `<div class="exp-view"><button class="lnk" data-act="pres-ref" data-id="${id}">○ ${esc(v?.name||'Missing View')}</button><span>${esc(u.role)}</span><div>${button('exp-role','Entry',id).replace('data-id=', 'data-role="entry" data-id=')}${button('exp-role','Visitor choice',id).replace('data-id=', 'data-role="choice" data-id=')}</div></div>`;}).join('')}</div>`;
}
export function renderExperienceSurfaces() {
 renderDeck();
 document.body.classList.toggle('visitor-preview',!!S.visitor);
 let el=document.querySelector('#visitorSurface');
 if(!el){el=document.createElement('section');el.id='visitorSurface';document.querySelector('#stage').append(el);}
 el.hidden=!S.visitor;
 if(S.visitor) { const p=S.visitor.source.experience.presentations[S.visitor.runtime.presentationId];const html=`<div class="visitor-title">${esc(p?.name)}</div><p>${esc(p?.meaning)}</p>${button('exp-exit-preview','Exit Preview')}`;if(el._html!==html){el.innerHTML=html;el._html=html;} }
}

export function renderDeck() {
 let el=document.querySelector('#experienceDeck');
 const e=ctx.experience,x=S.experienceContext;
 if(S.lens!=='experience'||S.visitor||!e.guide.length) {el?.remove();return;}
 if(!el){el=document.createElement('section');el.id='experienceDeck';document.querySelector('#stage').append(el);}
 let html='';el.className=`exp-deck ${x.depth}`;
 if(x.depth==='ordinary')html=`<span>Guide · ${e.guide.length} Stops</span>${button('exp-guide','Overview')}`;
 else html=`<div class="deck-head"><b>Guide Overview</b>${button('exp-close','Close')}</div><div class="stop-strip">${e.guide.map((id,i)=>{const s=e.stops[id],p=e.presentations[s.presentationId];return `<article class="stop-card ${x.stop===id?'expanded':''}"><small>STOP ${i+1}</small>${button('exp-stop',esc(p?.name||'Missing Presentation'),id)}${x.stop===id?`<p>${esc(p?.meaning)}</p>${setHtml(p)}${button('exp-move-stop','←',id).replace('data-id=','data-delta="-1" data-id=')}${button('exp-move-stop','→',id).replace('data-id=','data-delta="1" data-id=')}`:''}</article>`;}).join('')}</div>`;
 if(el._html!==html){el.innerHTML=html;el._html=html;}
}
