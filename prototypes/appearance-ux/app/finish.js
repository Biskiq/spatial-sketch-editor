/*
 * The Finish being edited, whichever surface holds it — a surface on the Stage, or a Library
 * draft that is not written yet. Card and Material editor both read this one adapter, so the
 * quick Card and the exact editor can never disagree, and a draft edits exactly like a Finish.
 *
 *   Material = raw captured images (colour / relief / sheen maps), real size and source. Never edited.
 *   Finish   = material + treatment (colour, sheen, pattern). Applied to surfaces; savable.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID } from '../shared/catalogue.js';
import { TARGETS } from './stage.js';
import * as T from './thumbs.js';
import * as A from './actions.js';

// ------------------------------------------------------------------ treatment vocabulary
/** Three sheen steps on the Card, in effective roughness (factor × scan). The editor is exact. */
export const STEPS = [['matte', 'Matte', 0.9], ['satin', 'Satin', 0.55], ['gloss', 'Gloss', 0.2]];
export const scanOf = (L) => (L.ormOff ? 1 : T.scanRough(L.set));
export const effR = (L) => Math.min(1, L.rough * scanOf(L));
export const factorFor = (L, r) => +Math.min(1, r / scanOf(L)).toFixed(3);
export const stepAt = (r) => STEPS.find(([, , v]) => Math.abs(v - r) < 0.04) || null;
export const nearestStep = (r) => STEPS.reduce((a, b) => (Math.abs(b[2] - r) < Math.abs(a[2] - r) ? b : a));
/** A step a captured map can't reach (the factor is at most 1: never rougher than captured). */
export const reachable = (L, r) => r <= scanOf(L) + 0.03;

/** Colour treatment follows the material: wood and stone take a stain; plaster, concrete and plain take paint. */
export function colourKind(set) {
  const e = BY_ID[set];
  if (!e.colorMap) return 'plain';
  return ['wood', 'stone', 'masonry', 'leather', 'textile'].includes(e.cat) ? 'stain' : 'paint';
}
export function modeOf(L, ov) {
  if (L.colourOff || L.colour === 'coat') return 'paint';
  if (L.colour === 'tint') return 'stain';
  if (colourKind(L.set) === 'plain' && ('tint' in ov || 'slot' in ov)) return 'paint';
  return 'natural';
}
export const mapsWith = (ov, ch, v) => { const m = { ...(ov.maps || {}) }; if (v === undefined) delete m[ch]; else m[ch] = v; return Object.keys(m).length ? m : undefined; };
/** The colour a Finish shows now: a palette slot (linked) or a literal hex. */
export function colourOf(L, ov) { if (ov.slot) return { slot: ov.slot }; const m = modeOf(L, ov); return { hex: m === 'paint' && L.colour === 'coat' ? (L.coat || L.tint) : L.tint }; }
export function colourPatch(L, ov, mode, c) {
  const pick = c.slot ? { slot: c.slot, tint: undefined, coat: undefined } : { slot: undefined };
  if (mode === 'natural') return { colour: undefined, tint: undefined, coat: undefined, slot: undefined, maps: mapsWith(ov, 'colour', undefined) };
  if (colourKind(L.set) === 'plain') return { colour: undefined, coat: undefined, ...pick, ...(c.slot ? {} : { tint: c.hex }) };
  if (mode === 'stain') return { colour: 'tint', coat: undefined, ...pick, ...(c.slot ? {} : { tint: c.hex }), maps: mapsWith(ov, 'colour', undefined) };
  return { colour: 'coat', tint: undefined, ...pick, ...(c.slot ? {} : { coat: c.hex }), maps: mapsWith(ov, 'colour', null) };
}
const slotName = (id) => M.S.p.palette.find((s) => s.id === id)?.name;
export function colourWords(L, ov) {
  const m = modeOf(L, ov); if (m === 'natural') return '';
  const c = colourOf(L, ov); const word = colourKind(L.set) === 'plain' ? '' : m === 'stain' ? ' stain' : ' paint';
  return (c.slot ? slotName(c.slot) || 'Palette' : c.hex) + word;
}

/** Changed-from-original, grouped the way the creator thinks (a gold dot per group). */
export const GROUPS = {
  colour: { label: 'Colour', keys: ['colour', 'tint', 'coat', 'slot'], map: 'colour' },
  sheen: { label: 'Sheen', keys: ['rough'], map: 'orm' },
  metal: { label: 'Metal', keys: ['metal'] },
  relief: { label: 'Relief', keys: ['normalScale'], map: 'normal' },
  pattern: { label: 'Pattern', keys: ['tile', 'rot', 'offset'] },
  mapping: { label: 'Mapping', keys: ['mapping'] }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function changed(fm, g) {
  const G = GROUPS[g]; const o = fm.origOv;
  return G.keys.some((k) => !same(fm.ov[k], o[k])) || (G.map ? !same(fm.ov.maps?.[G.map], o.maps?.[G.map]) : false);
}
export const changedGroups = (fm) => Object.keys(GROUPS).filter((g) => changed(fm, g));
export function resetPatch(fm, g) {
  const G = GROUPS[g]; const o = fm.origOv; const patch = {};
  for (const k of G.keys) patch[k] = o[k];
  if (G.map) patch.maps = mapsWith(fm.ov, G.map, o.maps?.[G.map]);
  return patch;
}
export function resetAllPatch(fm) { return Object.assign({}, ...changedGroups(fm).map((g) => resetPatch(fm, g))); }

/** "Material · treatment" — e.g. "Oak Veneer · Sage stain · Satin". */
export function nameRecipe(base, ov) {
  const mat = M.materialOfBase(base);
  const L = M.recipeLook(base, ov);
  const parts = [mat.label];
  const cw = colourWords(L, ov); if (cw) parts.push(cw);
  if ('rough' in ov) { const r = effR(L); const st = stepAt(r); parts.push(st ? st[1] : 'Custom sheen'); }
  return parts.join(' · ');
}
M.setNamer(nameRecipe);

// ------------------------------------------------------------------ the adapter
export function finishModel() {
  if (U.draft) return draftModel();
  if (!U.focus) return null;
  return surfaceModel(U.focus.target);
}

function surfaceModel(t) {
  const ref = M.S.p.assign[t]; const f = M.finishOf(ref);
  const users = A.reachUsersOf(t, ref); const n = users.length;
  const otherKind = M.usersOf(ref).filter((u) => !users.includes(u));
  const reach = n > 1 ? U.reach : 'all';
  const mat = M.materialOf(ref);
  const kind = M.kindOfRef(ref);
  const origin = kind === 'cat' ? 'Curated material' : kind === 'model' ? 'Model’s own' : f.origin === 'import' ? 'Imported Finish' : f.origin === 'library-copy' ? 'From My library' : 'Project Finish';
  const meta = kind === 'cat' ? 'Curated material · your first change makes a Finish'
    : kind === 'model' ? `Model’s own · ${mat.label}`
      : f.origin === 'import' ? `Imported Finish · ${Object.values(f.maps || {}).filter(Boolean).length || 3} image files`
        : `${origin} · from ${mat.label}`;
  return {
    kind: 'surface', t, ref, f, L: M.look(ref), O: M.originalLook(ref), ov: f ? f.ov : {}, origOv: M.originalOv(ref), mat,
    name: M.nameOf(ref), canRename: !!f, origin, meta, users, n, reach, otherKind,
    targets: () => (reach === 'all' ? users : [t]),
    edit: (patch, key) => A.editAt(t, patch, key),
    preview: (patch) => M.setPreview(ref, patch, reach === 'all' ? users : [t]),
    endPreview: () => M.setPreview(null),
    rename: (name) => M.rename(ref, name)
  };
}

const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
function draftModel() {
  const D = U.draft;
  const ov = D.ov; const L = M.recipeLook(D.base, { ...ov, ...(D.preview || {}) });
  const mat = M.materialOfBase(D.base);
  return {
    kind: 'draft', t: D.target, ref: null, f: null, L, O: M.recipeLook(D.base, {}), ov, origOv: {}, mat,
    name: D.named ? D.name : nameRecipe(D.base, ov), canRename: true, origin: 'Draft', meta: `Draft · from ${mat.label} · nothing is written yet`,
    users: D.target ? [D.target] : [], n: 1, reach: 'all', otherKind: [], targets: () => (D.target ? [D.target] : []),
    edit: (patch) => setUi({ draft: { ov: strip({ ...ov, ...patch }), preview: null } }),
    preview: (patch) => { D.preview = patch; A.getStage()?.set({ draft: draftGhost() }); },
    endPreview: () => { D.preview = null; },
    rename: (name) => { const n = name.trim(); if (!n || n.length > 120) return false; setUi({ draft: { name: n, named: true } }); return true; }
  };
}
/** Stage ghost for a draft: cobalt, on the surface it would be applied to. */
export function draftGhost() {
  const D = U.draft; if (!D || !D.target) return null;
  return { targets: [D.target], look: M.recipeLook(D.base, { ...D.ov, ...(D.preview || {}) }) };
}

/** Swap keeps the treatment (colour and sheen step) and resets the pattern to the new material's real size. */
export function swapPatch(fm, newBase) {
  const nL = M.recipeLook(newBase, {}); const keep = {};
  const mode = modeOf(fm.L, fm.ov);
  if (mode !== 'natural') {
    const c = colourOf(fm.L, fm.ov);
    const newMode = colourKind(nL.set) === 'plain' ? 'paint' : mode;
    Object.assign(keep, colourPatch(nL, {}, newMode, c));
  }
  if (changed(fm, 'sheen')) keep.rough = factorFor(nL, effR(fm.L));
  if (changed(fm, 'metal')) keep.metal = fm.ov.metal;
  return strip(keep);
}
export const isLayout = (t) => t && TARGETS[t]?.kind === 'layout';
