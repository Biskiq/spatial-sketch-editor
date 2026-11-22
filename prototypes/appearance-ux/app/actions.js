/*
 * Shell actions shared by every surface (tray, Library, Card, Stage, keyboard).
 * They translate a gesture into ONE model writer call; none of them writes project state itself.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { TARGETS, SUBJECTS, scopeTargets } from './stage.js';
import { toast } from './ui-kit.js';

let stage = null;
export const bindStage = (s) => { stage = s; };
export const getStage = () => stage;

export const targetLabel = (t) => {
  const d = TARGETS[t]; const sub = SUBJECTS[d.subject];
  return sub.targets.length > 1 ? `${d.label} · ${d.side}` : d.label;
};
export const shortTarget = (t) => { const d = TARGETS[t]; return SUBJECTS[d.subject].targets.length > 1 ? `${d.label} (${d.side.split(' · ')[0]})` : d.label; };

export function pickName(pick) {
  if (!pick) return '';
  if (pick.kind === 'colour') return pick.slot ? M.S.p.palette.find((s) => s.id === pick.slot)?.name || 'Colour' : pick.hex;
  if (pick.kind === 'library') return M.S.library.find((i) => i.id === pick.id)?.name || 'Library item';
  return M.nameOf(pick.ref);
}
export function pickHex(pick) { return pick.kind === 'colour' ? (pick.slot ? M.slotHex(pick.slot) : pick.hex) : null; }

/** What a surface would look like after this pick (for the cobalt ghost). */
export function resultLook(t, pick = U.pick, tool = U.tool) {
  const cur = M.S.p.assign[t];
  if (tool === 'erase') return M.look(M.eraseRef(t));
  if (pick.kind === 'colour') {
    const r = M.coatRefFor(cur, pick.slot ? { slot: pick.slot } : { hex: pick.hex });
    return typeof r === 'string' ? M.look(r) : M.recipeLook(r.base, r.ov);
  }
  if (pick.kind === 'library') { const it = M.S.library.find((i) => i.id === pick.id); return M.recipeLook(it.base, it.ov); }
  return M.look(pick.ref);
}

/** One-line consequence of the gesture under the pointer (bar text). */
export function consequence(t) {
  const targets = scopeTargets(t, U.scope);
  const where = targets.length > 1 ? `${targets.length} ${TARGETS[t].group === 'walls' ? 'wall faces' : 'parts'}` : `<b>${shortTarget(t)}</b>`;
  const cur = M.S.p.assign[t];
  if (U.tool === 'erase') return `Click: reset ${where} to <b>${M.nameOf(M.eraseRef(t))}</b>`;
  if (U.pick.kind === 'colour') {
    const keeps = M.isTextured(cur) || M.look(cur, false).normalScale ? ` · keeps ${M.nameOf(cur).replace(/^.* on /, '')} relief and sheen` : '';
    return `Click: colour ${where} <b>${pickName(U.pick)}</b>${keeps} · drag paints several`;
  }
  return `Click: replace ${where} <b>${M.nameOf(cur)}</b> → <b>${pickName(U.pick)}</b> · drag paints several`;
}

export function arm(pick, { tool = 'paint', quiet = false } = {}) {
  setUi({ pick, tool, trayTab: pick.kind === 'colour' ? 'colours' : 'materials' }, 'arm');
  if (!quiet) setUi({ status: `Paint armed · ${pickName(pick)}` });
}

let shiftAtPress = false;
window.addEventListener('pointerdown', (e) => { shiftAtPress = e.shiftKey; }, true);

/** Commit a click or a whole drag stroke as one undo step. */
export function commitPaint(stroked) {
  const space = U.scope === 'space' || shiftAtPress;
  const targets = [...new Set(stroked.flatMap((t) => scopeTargets(t, space ? 'space' : 'face')))];
  if (!targets.length) return;
  const last = stroked[stroked.length - 1];
  if (U.tool === 'erase') {
    M.assign(targets, (t) => M.eraseRef(t), 'Erase');
  } else if (U.pick.kind === 'colour') {
    const c = U.pick.slot ? { slot: U.pick.slot } : { hex: U.pick.hex };
    M.assign(targets, { coat: c }, 'Paint ' + pickName(U.pick));
    M.pushRecent('colour', U.pick.slot || U.pick.hex);
  } else if (U.pick.kind === 'library') {
    const ref = M.applyLibraryItem(U.pick.id, targets);
    // the same pick keeps painting the copy it just made — one insert per pick, not per stroke
    U.pick = { kind: 'material', ref };
    M.pushRecent('material', ref);
  } else {
    M.assign(targets, U.pick.ref, 'Paint ' + pickName(U.pick));
    M.pushRecent('material', U.pick.ref);
  }
  setUi({ focus: { target: last }, card: 'finish', reach: M.S.p.assign[last].startsWith('fin:') ? 'all' : 'this', status: `${U.tool === 'erase' ? 'Reset' : 'Painted'} ${targets.length > 1 ? targets.length + ' surfaces' : shortTarget(last)} · Ctrl+Z undoes the stroke` });
}

/** Semantic dropper: picks the Finish (or the palette colour of a coat), never a pixel. */
export function sample(t) {
  const ref = M.S.p.assign[t]; const f = M.finishOf(ref);
  let pick;
  if (f?.coat && f.ov.slot) pick = { kind: 'colour', slot: f.ov.slot };
  else if (f?.coat && f.ov.coat) pick = { kind: 'colour', hex: f.ov.coat };
  else pick = { kind: 'material', ref };
  arm(pick, { quiet: true });
  setUi({ dropper: false, status: `Sampled ${pickName(pick)} from ${shortTarget(t)}` });
  toast(`Sampled ${pickName(pick)} from ${shortTarget(t)}`);
}

/** Who “All” reaches. A project Finish: every user. A curated or model ref materializes, so same kind only. */
export function reachUsersOf(t, ref = M.S.p.assign[t]) {
  const all = M.usersOf(ref);
  return ref.startsWith('fin:') ? all : all.filter((u) => TARGETS[u].kind === TARGETS[t].kind);
}
/** The one path from a Card row (or the colour picker) to model.editFinish. */
export function editAt(t, patch, key = '') {
  const ref = M.S.p.assign[t];
  const users = reachUsersOf(t, ref);
  return M.editFinish(t, ref, patch, users.length > 1 ? U.reach : 'all', key ? key + ':' + t : '', ref.startsWith('fin:') ? null : users);
}

export function focus(t, card = 'subject') {
  // a project Finish is a shared thing (default All); a curated material is a value (default This)
  const ref = (t && M.S.p.assign[t]) || '';
  setUi({ focus: t ? { target: t } : null, card, reach: ref.startsWith('fin:') ? 'all' : 'this' }, 'focus');
}

export function closeTransient() {
  if (U.picker) { setUi({ picker: null }); return true; }
  if (U.library.open) { setUi({ library: { open: false } }); return true; }
  if (U.inspector.open) { setUi({ inspector: { open: false } }); return true; }
  if (U.importer.open) { setUi({ importer: { open: false } }); return true; }
  if (U.tasksOpen || U.issuesOpen) { setUi({ tasksOpen: false, issuesOpen: false }); return true; }
  if (U.dropper) { setUi({ dropper: false }); return true; }
  if (U.trayOpen) { setUi({ trayOpen: false }); return true; }
  return false;
}

export function openLibrary(intent = 'pick', extra = {}) {
  setUi({ library: { open: true, intent, expanded: null, ...extra }, picker: null });
}

/** Choose from the Library: arm Paint, or apply straight to the focused surface (Replace). */
export function chooseFromLibrary(choice, keepOpen) {
  if (U.library.intent === 'apply' && U.focus) {
    const t = U.focus.target;
    if (choice.kind === 'library') M.applyLibraryItem(choice.id, [t], 'Replace');
    else M.assign([t], choice.ref, 'Replace with ' + M.nameOf(choice.ref));
    setUi({ card: 'finish', status: `Replaced ${shortTarget(t)}` });
  } else {
    arm(choice);
  }
  if (!keepOpen && !U.library.keepOpen) setUi({ library: { open: false } });
}

export function originLabel(ref) {
  const o = M.originOf(ref);
  return { curated: 'Curated', model: 'Model’s own', project: M.finishOf(ref)?.coat ? 'Colour on base' : 'Project Finish', import: 'Imported', 'library-copy': 'From my library' }[o] || o;
}
