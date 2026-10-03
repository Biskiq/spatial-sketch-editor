import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import { S, ctx } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus } from './experience-model.js';
export function initExperience() {
  ctx.experience = createExperience(); ctx.cameraSource = createCamera();
  S.experienceContext = { presentation: null, depth: 'ordinary', stop: null, seam: null };
}
export const resolveExperience = (id) => subject(ctx.experience, ctx.cameraSource, id);
export function command(label, edit) {
  if (S.visitor) return false;
  A.beginEdit();
  try { const result = edit(ctx.experience, ctx.cameraSource); A.commitEdit(label); ctx.ui(); return result; }
  catch (error) { A.cancelEdit(); throw error; }
}
export function present(focus = null) {
  const f = focus || (S.sel && !resolveExperience(S.sel) ? { kind: 'subjects', ids: [S.sel] } : { kind: 'environment' });
  const existing = Object.values(ctx.experience.presentations).find(p => JSON.stringify(p.focus) === JSON.stringify(f));
  const id = existing?.id || command('Create Presentation', e => addPresentation(e, f));
  openPresentation(id); return id;
}
export function openPresentation(id) {
  if (!ctx.experience.presentations[id]) return false;
  A.select(id); S.experienceContext.presentation = id; ctx.ui(); return true;
}
export function updatePresentation(id, key, value) {
  if (!['name','meaning','focus'].includes(key)) return false;
  return command(`Edit Presentation ${key}`, e => { const p = e.presentations[id]; if (!p) throw Error('Presentation removed'); p[key] = structuredClone(value); });
}
export function handleExperienceAction(el) {
  const action = el?.dataset?.act;
  if (!action?.startsWith('exp-')) return false;
  if (action === 'exp-create') present();
  if (action === 'exp-open') openPresentation(el.dataset.id);
  if (action === 'exp-environment') present({ kind: 'environment' });
  return true;
}
export function presentationValid(id) { const p = ctx.experience.presentations[id]; return !!p && validateFocus(p, id => !!A.worldOf(id)); }

