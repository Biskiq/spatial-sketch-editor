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
