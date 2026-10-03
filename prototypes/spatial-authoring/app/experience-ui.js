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
    <div class="c-sec">Focus</div><div class="relation">${focus}</div><div class="c-sec">Show</div><p class="c-hint">Auto framing. Capture is explicit; the Set has no order.</p>`;
  }
  const t = thing(S.sel);
  return `<div class="c-head"><div class="c-k">${t ? 'From the World lens' : 'Experience'}</div><div class="c-t">${esc(t?.item.name || 'Meaning in this World')}</div></div><p class="c-hint">Create or open a Presentation explicitly. Selection alone never captures or moves Camera.</p><div class="c-acts">${button('exp-create',t ? 'Present this' : '+ Presentation')}</div>`;
}
export const foreignExperienceCard = () => {
  const r = resolveExperience(S.sel);
  return r ? `<div class="c-head"><div class="c-k">Foreign identity · not a World subject</div><div class="c-t">${esc(r.item.name || r.kind)}</div><div class="c-ref">${r.owner} · ${esc(r.item.id)}</div></div><p class="c-hint">Select a World subject to work on the building.</p>` : '';
};
