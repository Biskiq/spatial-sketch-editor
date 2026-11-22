/*
 * Simulated project state and the ONLY writers of the appearance study.
 *
 *   assign(targets, ref)          Paint strokes, Library "Apply", Card "Replace" — one writer
 *   editFinish(subject, ref, patch, reach)   Finish Card rows (In place / All / Just this)
 *   registerImport / insertFromLibrary / repair / rename / removeUnused
 *
 * Pickers, trays, libraries and cards never write; they choose a ref or a patch and call these.
 * Refs: 'cat:<id>' curated normal form · 'fin:<id>' project Finish · 'model:<id>' a model's own.
 * This is simulation — S8's real operations are E4 (inspectFinish, patch, modes) and D/F4.
 */
import { BY_ID, CATALOGUE } from '../shared/catalogue.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const listeners = new Set();
export const on = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const emit = (type, detail = {}) => listeners.forEach((fn) => fn(type, detail));

export const DEFAULT_PALETTE = [
  { id: 'chalk', name: 'Chalk', hex: '#ece7dc' },
  { id: 'sage', name: 'Sage', hex: '#9aa58c' },
  { id: 'clay', name: 'Clay', hex: '#b9775a' },
  { id: 'ink', name: 'Ink', hex: '#2f3a44' },
  { id: 'ochre', name: 'Ochre', hex: '#c9a14a' },
  { id: 'mist', name: 'Mist', hex: '#c7d0d4' }
];

/** Stand-in texture sets for imported/private Finishes (the prototype has no file IO). */
export const IMPORT_SETS = {
  'rough-oak': { set: 'wood-oak-planks', label: 'Rough Oak', tile: [1.2, 1.2] },
  'client-tile': { set: 'tile-ceramic-white', label: 'Client Tile', tile: [0.6, 0.6] }
};

// ---------------------------------------------------------------- projects
function seedProject(kind) {
  const p = { finishes: {}, assign: {}, palette: clone(DEFAULT_PALETTE), seq: 1, models: {} };
  const A = p.assign;
  for (const id of ['wall-n:a', 'wall-w:a', 'wall-e:a', 'wall-s:a', 'part:a', 'part:b']) A[id] = 'cat:plaster-painted';
  A['floor'] = 'cat:wood-oak-planks';
  A['sofa:fabric'] = 'cat:textile-linen';
  A['sofa:legs'] = 'cat:wood-walnut-veneer';
  A['table:top'] = 'cat:wood-walnut-veneer';
  A['table:legs'] = 'cat:metal-stainless-brushed';
  A['rug'] = 'cat:textile-carpet-loop';
  A['chair:seat'] = 'model:chair-seat';
  A['chair:frame'] = 'model:chair-frame';
  p.models = {
    'chair-seat': { name: 'Seat leather', set: 'leather-cognac', uvSets: [0] },
    'chair-frame': { name: 'Frame wood', set: 'wood-oak-veneer', uvSets: [0] }
  };
  if (kind === 'gallery') {
    for (const id of ['wall-n:a', 'wall-w:a', 'wall-e:a', 'wall-s:a', 'part:a', 'part:b']) A[id] = 'cat:concrete-smooth';
    A['floor'] = 'cat:stone-terrazzo';
    A['sofa:fabric'] = 'cat:leather-cognac';
    A['table:top'] = 'cat:stone-travertine';
  }
  return p;
}

const STORE = 'u-appearance-projects/1';
// A ?scene= preset (Tasks drawer links, board.html frames, review links) runs EPHEMERAL: fresh
// seeds, nothing read from or written to the viewer's saved state, so frames never clobber
// each other and every reviewer sees the same starting point.
export const EPHEMERAL = new URLSearchParams(location.search).has('scene');
function restore() { if (EPHEMERAL) return null; try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); return v && v.projects?.riverside ? v : null; } catch { return null; } }
const restored = restore();
const projects = restored?.projects || { riverside: seedProject('riverside'), gallery: seedProject('gallery') };
export const PROJECTS = { riverside: 'Riverside flat', gallery: 'Gallery studio' };
export const S = {
  projectId: restored?.projectId || 'riverside',
  p: projects[restored?.projectId || 'riverside'],
  restored: !!restored,
  history: [], future: [],
  preview: null,                     // { ref, patch } transient drag preview, never history
  prefs: { favColours: ['chalk', 'sage', 'clay', 'ink'], favMaterials: ['cat:wood-walnut-veneer', 'cat:plaster-painted', 'cat:wood-oak-planks', 'cat:concrete-smooth', 'cat:metal-brass-satin', 'cat:textile-linen'], recentColours: [], recentMaterials: [] },
  library: loadLibrary()
};

function loadLibrary() { if (EPHEMERAL) return []; try { return JSON.parse(localStorage.getItem('u-appearance-library') || '[]'); } catch { return []; } }
function saveLibrary() { if (EPHEMERAL) return; try { localStorage.setItem('u-appearance-library', JSON.stringify(S.library)); } catch { /* per-viewer convenience only */ } }

/** Cold reopen: project documents persist per viewer (simulation of a saved project). */
function persist() { if (EPHEMERAL) return; try { projects[S.projectId] = S.p; localStorage.setItem(STORE, JSON.stringify({ projectId: S.projectId, projects })); } catch { /* convenience only */ } }
listeners.add((type) => { if (type === 'change' || type === 'project') persist(); });
export function resetAll() { try { localStorage.removeItem(STORE); localStorage.removeItem('u-appearance-library'); } catch { /* ignore */ } location.search = ''; }
/** Erase paints the surface's default back (walls Painted Plaster, floor Oak, objects their seed). */
export function eraseRef(t) { return seedProject(S.projectId).assign[t]; }

export function switchProject(id) {
  projects[S.projectId] = S.p;
  S.projectId = id; S.p = projects[id]; S.history = []; S.future = []; S.preview = null;
  emit('project', { id });
}

// ---------------------------------------------------------------- history
let lastKeyCommit = { k: '', t: 0 };
function commit(label, mutate, coalesceKey = '') {
  const now = performance.now();
  const coalesce = coalesceKey && lastKeyCommit.k === coalesceKey && now - lastKeyCommit.t < 600 && S.history.length;
  if (!coalesce) S.history.push({ label, snap: clone(S.p) });
  S.future = [];
  mutate(S.p);
  lastKeyCommit = { k: coalesceKey, t: now };
  emit('change', { label });
}
export function undo() { const h = S.history.pop(); if (!h) return; S.future.push({ label: h.label, snap: clone(S.p) }); S.p = h.snap; projects[S.projectId] = S.p; emit('change', { label: 'Undo ' + h.label, undo: true }); }
export function redo() { const h = S.future.pop(); if (!h) return; S.history.push({ label: h.label, snap: clone(S.p) }); S.p = h.snap; projects[S.projectId] = S.p; emit('change', { label: 'Redo ' + h.label }); }

// ---------------------------------------------------------------- reading
export const kindOfRef = (ref) => ref.split(':')[0];
export function finishOf(ref) { return kindOfRef(ref) === 'fin' ? S.p.finishes[ref.slice(4)] : null; }
export function slotHex(id) { return S.p.palette.find((s) => s.id === id)?.hex; }

function baseLook(ref) {
  const [k, id] = [kindOfRef(ref), ref.slice(ref.indexOf(':') + 1)];
  if (k === 'cat') { const e = BY_ID[id]; return { set: id, tint: e.tint, rough: e.rough, metal: e.metal, normalScale: 1, tile: e.tile, rot: 0, colour: 'natural' }; }
  if (k === 'model') { const m = S.p.models[id]; const e = BY_ID[m.set]; return { set: m.set, tint: e.tint, rough: e.rough, metal: e.metal, normalScale: 1, tile: e.tile, rot: 0, colour: 'natural' }; }
  const f = S.p.finishes[id]; if (!f) return baseLook('cat:plaster-painted');
  const b = f.base.catalogue ? baseLook('cat:' + f.base.catalogue) : { ...baseLook('cat:' + IMPORT_SETS[f.base.set].set), tile: IMPORT_SETS[f.base.set].tile, tint: '#ffffff', rough: 1 };
  return b;
}

function baseFromBase(base) {
  return base.catalogue ? baseLook('cat:' + base.catalogue) : { ...baseLook('cat:' + IMPORT_SETS[base.set].set), tile: IMPORT_SETS[base.set].tile, tint: '#ffffff', rough: 1 };
}
function compose(b, ov) {
  const L = { ...b, ...stripUndef(ov) };
  if (ov.slot) { const hx = slotHex(ov.slot); if (hx) { if (L.colour === 'coat') L.coat = hx; else L.tint = hx; } }
  if (ov.tile !== undefined) L.tile = [ov.tile, ov.tile];
  if (ov.maps) { if (ov.maps.colour === null) L.colourOff = true; if (ov.maps.normal === null) L.normalOff = true; if (ov.maps.orm === null) L.ormOff = true; }
  delete L.slot; delete L.maps;
  return L;
}
/** Appearance of a recipe that is not (yet) a project Finish: a pending coat, a library item, an import draft. */
export function recipeLook(base, ov = {}) { return compose(baseFromBase(base), ov); }

/** Effective appearance of a ref, including a live preview patch. */
export function look(ref, withPreview = true) {
  const b = baseLook(ref);
  const f = finishOf(ref);
  let ov = f ? { ...f.ov } : {};
  if (withPreview && S.preview && S.preview.ref === ref) ov = { ...ov, ...S.preview.patch };
  const L = compose(b, ov);
  if (f && f.diag?.some((d) => d.channel === 'colour' && !d.fixed)) L.missingColour = true;
  return L;
}
const stripUndef = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== undefined && !['slot', 'maps', 'tile'].includes(k)));

export function nameOf(ref) {
  const k = kindOfRef(ref), id = ref.slice(ref.indexOf(':') + 1);
  if (k === 'cat') return BY_ID[id].label;
  if (k === 'model') return S.p.models[id]?.name || 'Model’s own';
  return S.p.finishes[id]?.name || 'Finish';
}
export function originOf(ref) {
  const k = kindOfRef(ref);
  if (k === 'cat') return 'curated';
  if (k === 'model') return 'model';
  return S.p.finishes[ref.slice(4)]?.origin || 'project';
}
export function usersOf(ref) { return Object.entries(S.p.assign).filter(([, r]) => r === ref).map(([t]) => t); }
export function hasMap(ref, ch) {
  const L = look(ref, false);
  const e = BY_ID[L.set];
  if (ch === 'colour') return e.colorMap && !L.colourOff;
  if (ch === 'normal') return !L.normalOff;
  return !L.ormOff;
}
export const isTextured = (ref) => { const L = look(ref, false); return BY_ID[L.set].colorMap && !L.colourOff; };
export const isMetal = (ref) => look(ref).metal >= 0.5;

/** Provenance of a value: base / override / disabled (E4 inspectFinish). */
export function provenance(ref, field) {
  const f = finishOf(ref); if (!f) return 'base';
  if (field === 'maps.colour' || field === 'maps.normal' || field === 'maps.orm') { const ch = field.split('.')[1]; return f.ov.maps && ch in f.ov.maps ? (f.ov.maps[ch] === null ? 'disabled' : 'override') : 'base'; }
  return field in f.ov ? 'override' : 'base';
}

// ---------------------------------------------------------------- writers
const stripUndef2 = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
const canon = (base, ov) => JSON.stringify([base, Object.keys(ov).sort().map((k) => [k, ov[k]])]);
function findFinish(base, ov) { const c = canon(base, ov); return Object.values(S.p.finishes).find((f) => canon(f.base, f.ov) === c); }
function newFinish(p, data) { const id = 'f' + p.seq++; p.finishes[id] = { id, origin: 'project', ...data }; return 'fin:' + id; }
function baseOfRef(ref) {
  const k = kindOfRef(ref);
  if (k === 'cat') return { catalogue: ref.slice(4) };
  if (k === 'model') return { catalogue: S.p.models[ref.slice(6)].set };
  return clone(S.p.finishes[ref.slice(4)].base);
}

/**
 * A colour pick applied with Paint keeps the target's relief and sheen and replaces its colour:
 * the derived Finish disables the colour map and follows the palette slot (or holds a literal).
 * Identical derived Finishes are reused (dedupe), so painting ten walls Sage makes one Finish.
 * NEW ENGINEERING: S8 has the pieces (disable a map, palette follower), not this composition.
 */
export function coatRefFor(currentRef, colour /* {slot}|{hex} */) {
  const base = baseOfRef(currentRef);
  const f = finishOf(currentRef);
  const ov = { ...(f ? clone(f.ov) : {}), colour: 'coat' };
  delete ov.tint; delete ov.slot; delete ov.coat;
  if (colour.slot) ov.slot = colour.slot; else ov.coat = colour.hex;
  if (BY_ID[base.catalogue || IMPORT_SETS[base.set]?.set]?.colorMap) ov.maps = { ...(ov.maps || {}), colour: null };
  const hit = findFinish(base, ov);
  if (hit) return 'fin:' + hit.id;
  return { pending: true, base, ov, name: `${colour.slot ? S.p.palette.find((s) => s.id === colour.slot).name : colour.hex} on ${nameOf(currentRef).replace(/^.* on /, '')}` };
}

/** THE assignment writer. `choice` is a ref, { coat: {slot}|{hex} } resolved per target, or fn(target) → ref (Erase). */
export function assign(targets, choice, label = 'Paint') {
  if (!targets.length) return;
  commit(label, (p) => {
    for (const t of targets) {
      let ref = typeof choice === 'function' ? choice(t) : choice;
      if (typeof choice === 'object') {
        const r = coatRefFor(p.assign[t], choice.coat);
        ref = typeof r === 'string' ? r : newFinish(p, { base: r.base, ov: r.ov, name: r.name, coat: true });
      }
      p.assign[t] = ref;
    }
  });
  emit('assigned', { targets, choice });
}

/**
 * Finish Card edits. reach: 'all' or 'this' (Just this → clone).
 * `reachUsers` is who 'all' means. An existing project Finish edits in place for every user (shared
 * editing across Layout and Scene is preserved). Materializing a curated/model ref names ONE kind of
 * user only (F4 refuses a compound Scene + Layout registration), so the caller passes same-kind users.
 */
export function editFinish(subject, ref, patch, reach, coalesceKey = '', reachUsers = null) {
  let out = ref;
  const label = 'Edit ' + nameOf(ref);
  const users = reachUsers || usersOf(ref);
  const effectiveReach = users.length <= 1 ? 'all' : reach;
  commit(label, (p) => {
    const k = kindOfRef(ref);
    if (k === 'fin' && effectiveReach === 'all' && !reachUsers) {
      const f = p.finishes[ref.slice(4)];
      Object.assign(f.ov, patch);
      for (const [key, v] of Object.entries(patch)) if (v === undefined) delete f.ov[key];
      return;
    }
    const base = baseOfRef(ref);
    const prev = finishOf(ref);
    const ov = { ...(prev ? clone(prev.ov) : {}), ...patch };
    for (const [key, v] of Object.entries(ov)) if (v === undefined) delete ov[key];
    const pristine = base.catalogue && !Object.keys(ov).length;
    let nref;
    if (pristine) nref = 'cat:' + base.catalogue;          // E review follow-up: a pristine clone is the curated normal form
    else {
      const hit = effectiveReach === 'this' ? null : findFinish(base, ov);
      nref = hit ? 'fin:' + hit.id : newFinish(p, { base, ov, name: prev ? (effectiveReach === 'this' ? prev.name + ' · 2' : prev.name) : nameOf(ref) + ' · custom', origin: prev?.origin === 'import' ? 'import' : prev?.origin === 'library-copy' ? 'library-copy' : 'project', libItem: prev?.libItem, maps: prev?.maps, importNotes: prev?.importNotes, coat: prev?.coat });
    }
    const targets = effectiveReach === 'all' ? (reachUsers || usersOf(ref)) : [subject];
    for (const t of targets) p.assign[t] = nref;
    out = nref;
  }, coalesceKey);
  emit('edited', { ref, out, patch, reach: effectiveReach });
  return out;
}

/** Transient drag preview (never history). `targets` limits it to the surfaces the edit will reach. */
export function setPreview(ref, patch, targets = null) { S.preview = patch ? { ref, patch, targets } : null; emit('preview', { ref }); }

export function rename(ref, name) {
  const n = name.trim(); if (n.length < 1 || n.length > 120 || kindOfRef(ref) !== 'fin') return false;
  commit('Rename', (p) => { p.finishes[ref.slice(4)].name = n; }); return true;
}
export function removeUnused(ref) {
  if (usersOf(ref).length || kindOfRef(ref) !== 'fin') return false;
  commit('Remove ' + nameOf(ref), (p) => { delete p.finishes[ref.slice(4)]; }); return true;
}
export function addPaletteSlot(hex, name) {
  const id = 's' + Date.now().toString(36);
  commit('Add palette colour', (p) => { p.palette.push({ id, name, hex }); });
  return id;
}
export function setSlot(id, hex) { commit('Change ' + S.p.palette.find((s) => s.id === id).name, (p) => { p.palette.find((s) => s.id === id).hex = hex; }, 'slot:' + id); }

/** E5: register an accepted draft on ONE kind of user (F4 refuses a compound Scene + Layout write). */
export function registerImport(draft, targets, kindOf) {
  const kinds = new Set(targets.map(kindOf));
  if (kinds.size > 1) return { refused: 'mixed-kinds' };
  let ref;
  commit('Import ' + draft.name, (p) => {
    ref = newFinish(p, { base: { set: draft.set }, ov: stripUndef2(draft.ov), name: draft.name, origin: 'import', maps: draft.maps, importNotes: draft.notes });
    for (const t of targets) p.assign[t] = ref;
  });
  emit('imported', { ref, targets });
  return { ref };
}

/** G: save produces zero project history; insert always makes a NEW independent Finish. */
export function saveToLibrary(ref) {
  const f = finishOf(ref); const L = look(ref, false);
  const flattened = f?.ov.slot ? [S.p.palette.find((s) => s.id === f.ov.slot)?.name] : [];
  const item = { id: 'lib' + Date.now().toString(36), name: nameOf(ref), base: baseOfRef(ref), ov: { ...(f ? clone(f.ov) : {}) }, savedFrom: PROJECTS[S.projectId], savedAt: new Date().toISOString().slice(0, 10), flattened };
  if (item.ov.slot) { if (item.ov.colour === 'coat') item.ov.coat = L.coat; else item.ov.tint = L.tint; delete item.ov.slot; }
  S.library.unshift(item); saveLibrary();
  emit('saved', { item });
  return item;
}
export function removeLibraryItem(id) { S.library = S.library.filter((i) => i.id !== id); saveLibrary(); emit('library'); }
/** Paint with a private-library item: insert a NEW independent Finish and assign it, one undo. */
export function applyLibraryItem(id, targets, label = 'Paint') {
  const item = S.library.find((i) => i.id === id); if (!item) return null;
  let ref;
  commit(label + ' ' + item.name, (p) => {
    ref = newFinish(p, { base: clone(item.base), ov: clone(item.ov), name: item.name, origin: 'library-copy', libItem: id });
    for (const t of targets) p.assign[t] = ref;
  });
  emit('inserted', { ref, item }); emit('assigned', { targets, choice: ref });
  return ref;
}
export function insertFromLibrary(id) {
  const item = S.library.find((i) => i.id === id); if (!item) return null;
  let ref;
  commit('Insert ' + item.name, (p) => { ref = newFinish(p, { base: clone(item.base), ov: clone(item.ov), name: item.name, origin: 'library-copy', libItem: id }); });
  emit('inserted', { ref, item });
  return ref;
}

// ---------------------------------------------------------------- repair scenario
export function seedRepair() {
  commit('Open “Client” project state', (p) => {
    p.finishes.ct = { id: 'ct', origin: 'import', name: 'Client Tile', base: { set: 'client-tile' }, ov: { tint: '#ffffff' }, maps: { colour: 'client-tile_basecolor.png', normal: 'client-tile_normal.png', orm: 'client-tile_orm.png' },
      diag: [{ id: 'missing', channel: 'colour', file: 'client-tile_basecolor.png', text: 'Colour image is missing on this machine' }] };
    p.assign['wall-w:a'] = 'fin:ct'; p.assign['part:b'] = 'fin:ct';
    p.finishes.co = { id: 'co', origin: 'import', name: 'Client Oak', base: { set: 'rough-oak' }, ov: { mapping: 'uv1' }, maps: { colour: 'client-oak_albedo.jpg', normal: 'client-oak_normal.png', orm: 'client-oak_orm.png' },
      diag: [{ id: 'uv1', channel: 'mapping', text: 'Mapping reads UV set 1; Lounge chair only has UV set 0' }] };
    p.assign['chair:frame'] = 'fin:co';
  });
}
export function repair(ref, diagId, action) {
  commit('Repair ' + nameOf(ref), (p) => {
    const f = p.finishes[ref.slice(4)]; const d = f.diag.find((x) => x.id === diagId);
    if (action === 'relink' || action === 'replace') d.fixed = action;
    if (action === 'off') { f.ov.maps = { ...(f.ov.maps || {}), colour: null }; f.ov.tint = '#e9e6df'; d.fixed = 'off'; }
    if (action === 'uv0') { f.ov.mapping = 'uv0'; d.fixed = 'uv0'; }
    if (action === 'surface') { f.ov.mapping = 'surface'; d.fixed = 'surface'; }
  });
}
export const openDiagnostics = (ref) => (finishOf(ref)?.diag || []).filter((d) => !d.fixed);
export const anyDiagnostics = () => Object.values(S.p.finishes).some((f) => (f.diag || []).some((d) => !d.fixed));

// ---------------------------------------------------------------- prefs (per viewer, outside project history)
export function pushRecent(kind, v) {
  const list = kind === 'colour' ? S.prefs.recentColours : S.prefs.recentMaterials;
  const i = list.findIndex((x) => JSON.stringify(x) === JSON.stringify(v)); if (i >= 0) list.splice(i, 1);
  list.unshift(v); list.length = Math.min(list.length, 8);
}
export function toggleFavourite(kind, v) {
  const list = kind === 'colour' ? S.prefs.favColours : S.prefs.favMaterials;
  const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v);
  emit('prefs');
}

export const CURATED_REFS = CATALOGUE.map((e) => 'cat:' + e.id);
