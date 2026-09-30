// Store (projects, simulated library) + session state + the one acceptance path.
// Prototype-only: undo is whole-document snapshots. F.4 fixes the acceptance boundary
// (one expected revision → one atomic result → one undo), not this history mechanism.
import { clone, emptyDoc, cafeDoc } from './model.js';

export function freshStore() {
  return {
    active: 'p1',
    projects: {
      p1: { id: 'p1', doc: emptyDoc('Saltmarsh lamp study'), rev: 11, undo: [], redo: [], log: [] },
      p2: { id: 'p2', doc: cafeDoc(), rev: 4, undo: [], redo: [], log: [] },
    },
    // Simulated library storage: immutable published revisions, per resource identity.
    library: { name: 'Studio library', available: true, items: {} },
  };
}

// Session: never saved, never undone.
export const S = {
  store: freshStore(),
  sel: null, // { kind: 'use'|'group'|'wall'|'opening'|'def'|'ref', id, path? }
  multi: [], // extra use ids (shift-selection)
  ctx: null, // entered selection context: { use, path } | { group }
  hover: null,
  open: new Set(), // navigator disclosure
  mode: 'arrange', // 'arrange' | 'layout'
  tool: 'select', // 'select' | 'hang'
  approach: 'contextual', // how definition edits are offered: 'contextual' | 'bench'
  motion: 'full', // 'full' | 'reduced'
  density: 'regular',
  instr: null, // contextual instrument (intake, inspect, preview, bench, review, hang, wallmove)
  reach: null, // { key, scope, value } — what an edit would touch, shown before it happens
  reachScope: 'use', // contextual approach: the reach an edit will use
  summary: null, // return summary after an instrument closes
  sheet: null, // modal sheet
  pop: null, // popover (history, projects)
  finder: null,
  flash: null, // transient note { text, tone, x, y, t }
  drag: null,
  dirtyUI: true,
};

export const P = () => S.store.projects[S.store.active];
export const D = () => P().doc;

const listeners = new Set();
export const on = (fn) => listeners.add(fn);
export function emit(what = 'all') {
  S.dirtyUI = true;
  if (what === 'doc' || what === 'all') prune();
  for (const fn of listeners) fn(what);
}

// Session state never outlives the thing it points at (selection is session state).
function prune() {
  const doc = S.store && P().doc;
  if (!doc) return;
  S.multi = S.multi.filter((id) => doc.uses[id]);
  if (S.sel?.kind === 'use' && !doc.uses[S.sel.id]) { S.sel = null; S.ctx = null; }
  if (S.sel?.kind === 'group' && !doc.groups?.[S.sel.id]) S.sel = null;
  if (S.sel?.kind === 'def' && !doc.defs[S.sel.id]) S.sel = null;
  if (S.hover?.use && !doc.uses[S.hover.use]) S.hover = null;
  if (S.instr?.use && !doc.uses[S.instr.use]) S.instr = null;
  if (S.instr?.def && !doc.defs[S.instr.def]) S.instr = null;
}

// One logical accepted action → one candidate → one validation → one history entry.
// mutate(candidate) may return { refuse: 'reason' } to leave the project untouched.
export function accept(label, domains, mutate, opts = {}) {
  const p = P();
  if (opts.expectedRev != null && opts.expectedRev !== p.rev) {
    return { ok: false, stale: true, reason: `Prepared against rev ${opts.expectedRev}; the project is now rev ${p.rev}.` };
  }
  const cand = clone(p.doc);
  const r = mutate(cand);
  if (r && r.refuse) return { ok: false, reason: r.refuse };
  if (JSON.stringify(cand) === JSON.stringify(p.doc)) return { ok: true, noop: true };
  p.undo.push({ label, domains, before: p.doc, after: cand, rev: p.rev + 1, meta: opts.meta ?? null });
  if (p.undo.length > 80) p.undo.shift();
  p.redo = [];
  p.doc = cand;
  p.rev += 1;
  emit('doc');
  return { ok: true };
}

export function undo() {
  const p = P();
  const e = p.undo.pop();
  if (!e) return null;
  p.redo.push(e);
  p.doc = e.before;
  p.rev += 1;
  emit('doc');
  return e;
}
export function redo() {
  const p = P();
  const e = p.redo.pop();
  if (!e) return null;
  p.undo.push(e);
  p.doc = e.after;
  p.rev += 1;
  emit('doc');
  return e;
}

// Another writer (simulated agent/collaborator). Applied to the history snapshots too so
// this prototype's snapshot undo does not silently revert someone else's accepted work.
export function externalEdit(who, label, mutate) {
  const p = P();
  mutate(p.doc);
  for (const e of [...p.undo, ...p.redo]) { mutate(e.before); mutate(e.after); }
  p.rev += 1;
  p.log.push({ who, label, rev: p.rev });
  emit('doc');
}

export function resetStore() {
  S.store = freshStore();
  S.sel = null; S.multi = []; S.ctx = null; S.hover = null; S.open = new Set();
  S.mode = 'arrange'; S.tool = 'select'; S.instr = null; S.reach = null; S.reachScope = 'use';
  S.summary = null; S.sheet = null; S.pop = null; S.finder = null; S.flash = null; S.drag = null;
  emit('all');
}
