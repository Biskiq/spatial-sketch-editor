/*
 * View state of the prototype shell. Nothing here is project truth: it is which tool is armed,
 * what is picked, what is open. Project writes go through model.js only.
 */
const subs = new Set();
export const onUi = (fn) => (subs.add(fn), () => subs.delete(fn));

export const U = {
  tool: 'select',                              // select | paint | erase
  pick: { kind: 'colour', slot: 'sage' },      // {kind:'colour', slot|hex} | {kind:'material', ref} | {kind:'library', id} | {kind:'recipe', base, ov, name}
  scope: 'surface',                            // Paint radius: brush (future) | surface | space
  brushTool: 'brush',                          // inside Brush (future): brush | erase
  dropper: false,                              // one-shot semantic sample
  trayTab: 'colours',                          // colours | materials
  trayOpen: false,                             // expanded palette / material grid
  paletteEdit: false,                          // tray: clicking a palette colour edits it everywhere
  focus: null,                                 // { target } — the selected surface
  card: 'finish',                              // finish | subject (an object or wall with several parts)
  reach: 'all',                                // all | this (Finish writes)
  selectAll: false,                            // ⋯ › Select all using this Finish
  editor: { open: false, geom: 'sphere', light: 'studio', display: 'lit', compare: false, turn: 0 },
  draft: null,                                 // Library › Customise…: { base, ov, name, named, target, src } — nothing written
  align: null,                                 // { target } — Align on wall: the faced surface, straight on
  library: { open: false, q: '', kind: 'materials', cat: 'all', source: 'all', filters: new Set(), detail: null, intent: 'pick', geom: 'sphere', light: 'studio', turn: 0 },
  importer: { open: false },
  picker: null,                                // { anchor, hex, title, onColour | forPaint | slotEdit | addSlot }
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
