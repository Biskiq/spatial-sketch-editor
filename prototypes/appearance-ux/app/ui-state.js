/*
 * View state of the prototype shell. Nothing here is project truth: it is which tool is armed,
 * what is picked, what is open. Project writes go through model.js only.
 */
const subs = new Set();
export const onUi = (fn) => (subs.add(fn), () => subs.delete(fn));

export const U = {
  tool: 'select',                              // select | paint | erase
  pick: { kind: 'colour', slot: 'sage' },      // {kind:'colour', slot|hex} | {kind:'material', ref} | {kind:'library', id}
  scope: 'face',                               // face | space
  dropper: false,                              // one-shot semantic sample
  trayTab: 'colours',                          // colours | materials
  trayOpen: false,                             // expanded wheel / grid
  focus: null,                                 // { target } — the surface the Card is about
  card: 'subject',                             // subject | finish
  reach: 'all',                                // all | this (Finish Card writes)
  hoverReach: false,
  library: { open: false, q: '', cat: 'all', source: 'curated', filters: new Set(), expanded: null, keepOpen: false, intent: 'pick' },
  inspector: { open: false, target: null, geom: 'sphere', light: 'studio', display: 'lit', compare: false, turn: 0 },
  importer: { open: false },
  picker: null,                                // { anchor, hex, onPick, title }
  indexOpen: false,
  tasksOpen: false,
  issuesOpen: false,
  status: ''
};

export function setUi(patch, why = '') {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set) && U[k] && typeof U[k] === 'object' && !(U[k] instanceof Set) && k !== 'pick' && k !== 'focus' && k !== 'picker') U[k] = { ...U[k], ...v };
    else U[k] = v;
  }
  subs.forEach((fn) => fn(why || Object.keys(patch).join(',')));
}
