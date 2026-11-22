/*
 * Library — an asset library, not a material picker. A kind rail (Materials with categories
 * nested · Objects · Openings · Plants and Lights, future), sources (All · Curated · This project ·
 * My library · Sources, future), search and filters, and a master–detail side pane with a live
 * preview. Curated and imported items are raw materials ("Veneer · 0.5 m"); project and My library
 * items are Finishes ("from Oak Veneer · 3 changes"). Click chooses for the context the Library was
 * opened in; Shift-click keeps it open. Customise… opens the Card as a draft: nothing is written.
 * The Library never writes itself: actions.chooseFromLibrary calls the writer.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID, CATALOGUE, TAXONOMY } from '../shared/catalogue.js';
import * as T from './thumbs.js';
import { $, h, ic, seg, toast } from './ui-kit.js';
import * as A from './actions.js';
import * as F from './finish.js';

const FILTERS = [['fav', '★ Favourites'], ['textured', 'Textured'], ['plain', 'Plain colour'], ['metal', 'Metal'], ['matte', 'Matte'], ['glossy', 'Glossy'], ['used', 'Used here']];
const KINDS = [['materials', 'Materials', 'finish'], ['objects', 'Objects', 'object'], ['openings', 'Openings', 'door'], ['plants', 'Plants · Lights', 'sun']];
const SOURCES = [['all', 'All'], ['curated', 'Curated'], ['project', 'This project'], ['mine', 'My library'], ['sources', 'Sources']];
const LIGHTS = { studio: {}, grazing: { grazing: true }, world: { lightTurn: 0.62, exposure: 0.95, key: 0.95, bg: '#dfe2e3' } };
let variantSel = { concrete: 'concrete-smooth' };

// ------------------------------------------------------------------ entries
function curatedEntries() {
  const out = []; const seen = new Set();
  for (const e of CATALOGUE) {
    if (e.family === 'concrete') { if (seen.has('concrete')) continue; seen.add('concrete'); const v = BY_ID[variantSel.concrete]; out.push({ src: 'curated', key: 'cat:' + v.id, ref: 'cat:' + v.id, e: v, name: 'Concrete', variants: ['concrete-smooth', 'concrete-polished'], look: M.look('cat:' + v.id, false), base: { catalogue: v.id }, ov: {} }); continue; }
    out.push({ src: 'curated', key: 'cat:' + e.id, ref: 'cat:' + e.id, e, name: e.label, look: M.look('cat:' + e.id, false), base: { catalogue: e.id }, ov: {} });
  }
  return out;
}
function projectEntries() {
  const used = [...new Set(Object.values(M.S.p.assign))].filter((r) => !r.startsWith('cat:'));
  const unused = Object.keys(M.S.p.finishes).map((id) => 'fin:' + id).filter((r) => !used.includes(r));
  return [...used, ...unused].map((r) => {
    const f = M.finishOf(r); const base = M.rawBaseOf(r);
    return { src: 'project', key: r, ref: r, e: BY_ID[M.look(r, false).set], name: M.nameOf(r), look: M.look(r, false), base, ov: f ? f.ov : {}, orig: M.originalOv(r), mat: M.materialOf(r), users: M.usersOf(r), f };
  });
}
function mineEntries() {
  return M.S.library.map((it) => ({ src: 'mine', key: it.id, id: it.id, it, e: BY_ID[M.recipeLook(it.base, it.ov).set], name: it.name, look: M.recipeLook(it.base, it.ov), base: it.base, ov: it.ov, orig: {}, mat: M.materialOfBase(it.base) }));
}
function entries() {
  const L = U.library; const q = L.q.trim().toLowerCase();
  const groups = L.source === 'all' ? [['This project', projectEntries()], ['My library', mineEntries()], ['Curated', curatedEntries()]]
    : [[null, L.source === 'curated' ? curatedEntries() : L.source === 'project' ? projectEntries() : mineEntries()]];
  const keep = (x) => {
    const look = x.look, Fs = L.filters;
    if (L.cat !== 'all' && x.e.cat !== L.cat) return false;
    if (q && !(`${x.name} ${x.e.label} ${x.e.sub || ''} ${TAXONOMY.find((c) => c.id === x.e.cat)?.label}`.toLowerCase().includes(q))) return false;
    if (Fs.has('fav') && !(x.ref && M.S.prefs.favMaterials.includes(x.ref))) return false;
    if (Fs.has('textured') && !(x.e.colorMap && !look.colourOff)) return false;
    if (Fs.has('plain') && x.e.colorMap && !look.colourOff) return false;
    if (Fs.has('metal') && look.metal < 0.5) return false;
    if (Fs.has('matte') && F.effR(look) < 0.7) return false;
    if (Fs.has('glossy') && F.effR(look) > 0.55) return false;
    if (Fs.has('used') && !(x.ref && M.usersOf(x.ref).length)) return false;
    return true;
  };
  return groups.map(([g, list]) => [g, list.filter(keep)]);
}
const changesOf = (x) => (x.src === 'curated' ? 0 : F.changedGroups({ ov: x.ov, origOv: x.orig || {} }).length);
const subOf = (x) => {
  if (x.src === 'curated') return `${x.e.sub || TAXONOMY.find((c) => c.id === x.e.cat)?.label} · ${fmtM(x.look.tile[0])}`;
  const n = changesOf(x);
  if (x.src === 'project' && x.f?.origin === 'import' && !n) return `Imported · ${fmtM(x.look.tile[0])}`;
  if (x.src === 'project' && M.kindOfRef(x.ref) === 'model') return 'Model’s own';
  return `from ${x.mat.label}${n ? ` · ${n} change${n === 1 ? '' : 's'}` : ''}`;
};
const fmtM = (m) => (+m.toFixed(3)).toString() + ' m';

// ------------------------------------------------------------------ render
export function renderLibrary() {
  const el = $('#lib');
  el.hidden = !U.library.open; if (el.hidden) { el.innerHTML = ''; return; }
  const L = U.library;
  const keepFocus = document.activeElement?.id === 'lib-q';
  const keepScroll = el.querySelector('.lb-grid')?.scrollTop || 0;
  el.innerHTML = '';
  el.classList.toggle('with-detail', !!L.detail);
  // the source switch folds into a dropdown when the Library itself is narrow (not the window)
  const narrow = el.getBoundingClientRect().width < 760;
  const q = h('input', { id: 'lib-q', type: 'search', placeholder: L.kind === 'materials' ? 'Search materials and finishes' : 'Search', value: L.q, 'aria-label': 'Search the Library', onInput: (e) => { U.library.q = e.target.value; setUi({}); } });
  const src = narrow
    ? h('select', { class: 'fld sel', 'aria-label': 'Source', 'data-fid': 'lib-src', onChange: (e) => setUi({ library: { source: e.target.value, detail: null } }) }, SOURCES.map(([v, l]) => h('option', { value: v, selected: v === L.source || undefined }, l + (v === 'sources' ? ' · future' : ''))))
    : seg(SOURCES.map(([v, l]) => [v, v === 'mine' && M.S.library.length ? `${l} · ${M.S.library.length}` : l, v === 'sources' ? 'Third-party shelves — future' : undefined]), L.source, (v) => setUi({ library: { source: v, detail: null } }));
  if (!narrow) src.lastChild.classList.add('fut-b');
  el.append(h('div', { class: 'lb-h' },
    h('b', { class: 'lb-t' }, 'Library'),
    h('div', { class: 'search' }, h('span', {}, ic('search', 16)), q),
    src,
    h('button', { class: 'btn sm', 'data-fid': 'lib-import', title: 'Import an image set (PBR) as a project Finish', onClick: () => setUi({ library: { open: false }, importer: { open: true, targets: U.focus ? (U.card === 'subject' ? null : [U.focus.target]) : [] } }) }, ic('import', 14), 'Import…'),
    h('button', { class: 'cp-x lb-x', 'aria-label': 'Close Library', title: 'Close (Esc · L)', onClick: () => setUi({ library: { open: false } }) }, '×')));
  const fl = h('div', { class: 'lb-f' }, h('span', { class: 'ctx' }, contextLine()));
  if (L.kind === 'materials') for (const [id, label] of FILTERS) fl.append(h('button', { class: 'fchip', 'aria-pressed': String(L.filters.has(id)), onClick: () => { const s = new Set(L.filters); s.has(id) ? s.delete(id) : s.add(id); setUi({ library: { filters: s } }); } }, label));
  fl.append(h('span', { class: 'note-sm push' }, 'Shift-click keeps it open'));
  el.append(fl);

  const rail = h('nav', { class: 'lb-rail', 'aria-label': 'Kinds' });
  for (const [k, label, icon] of KINDS) {
    const future = k !== 'materials';
    rail.append(h('button', { class: 'ix' + (L.kind === k ? ' on' : '') + (future ? ' fut' : ''), title: future ? `${label} — ${k === 'objects' ? 'Furnish' : 'future'}` : undefined, 'aria-current': L.kind === k ? 'true' : undefined, onClick: () => setUi({ library: { kind: k, detail: null } }) }, ic(icon, 15), h('span', { class: 'nm' }, label), future ? h('span', { class: 'sub' }, k === 'objects' ? 'Furnish' : 'future') : null));
    if (k === 'materials' && L.kind === 'materials') for (const c of [{ id: 'all', label: 'All materials' }, ...TAXONOMY]) rail.append(h('button', { class: 'ix sub2' + (L.cat === c.id ? ' on' : ''), onClick: () => setUi({ library: { cat: c.id } }) }, h('span', { class: 'nm' }, c.label)));
  }
  const grid = h('div', { class: 'lb-grid' });
  if (L.kind !== 'materials') grid.append(futureKind(L.kind));
  else if (L.source === 'sources') grid.append(futureSource());
  else {
    const gs = entries(); let any = false;
    for (const [g, list] of gs) {
      if (!list.length) continue; any = true;
      if (g) grid.append(h('h6', { class: 'lb-g' }, g, h('span', {}, String(list.length))));
      for (const x of list) grid.append(card(x));
    }
    if (!any) grid.append(h('div', { class: 'lb-empty' }, L.source === 'mine' ? 'Nothing saved yet. Save to My library from any Finish Card — it travels to every project.' : 'No matches. Clear a filter or the search.'));
  }
  const body = h('div', { class: 'lb-b' }, rail, grid);
  if (L.detail) { const x = findEntry(L.detail); if (x) body.append(detail(x)); }
  el.append(body);
  grid.scrollTop = keepScroll;
  if (keepFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function contextLine() {
  const L = U.library; const fm = F.finishModel();
  if (L.intent === 'swap' && fm) return h('span', {}, 'Swap the material of ', h('b', {}, fm.name), ' — keeps its colour and sheen');
  if (L.intent === 'apply' && U.focus) return h('span', {}, 'Replace ', h('b', {}, A.shortTarget(U.focus.target)));
  if (U.tool === 'paint') return h('span', {}, 'Pick for Paint');
  return h('span', {}, 'Browse');
}

function findEntry(key) {
  for (const [, list] of entries()) { const x = list.find((y) => y.key === key); if (x) return x; }
  return [...curatedEntries(), ...projectEntries(), ...mineEntries()].find((y) => y.key === key) || null;
}

function card(x) {
  const fav = x.ref && M.S.prefs.favMaterials.includes(x.ref);
  const chosen = (U.pick.kind === 'material' && U.pick.ref === x.ref) || (U.pick.kind === 'library' && U.pick.id === x.id);
  const n = changesOf(x);
  const b = h('div', { class: 'mc' + (chosen ? ' on' : '') + (U.library.detail === x.key ? ' open' : ''), role: 'button', tabindex: 0, 'data-fid': 'lib-' + x.key, title: `${x.name} — ${verb(x)}`,
    onClick: (e) => { if (e.target.closest('.xp,.vchips,.star,.users')) return; choose(x, e.shiftKey); },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(x, e.shiftKey); } },
    onPointerenter: () => x.users?.length && A.getStage()?.set({ users: x.users, usersMode: 'all' }),
    onPointerleave: () => x.users?.length && A.getStage()?.set({ users: [] }) });
  const th = h('div', { class: 'th', style: { backgroundImage: `url(${T.url(x.look, 'sample', 256)})` } });
  const meta = h('div', { class: 'mt' }, h('span', { class: 'mn' }, x.name, n ? h('i', { class: 'edm', title: `Edited · ${n} change${n === 1 ? '' : 's'} from ${x.mat.label}` }) : null), h('span', { class: 'ms' }, subOf(x)));
  if (x.users) meta.append(h('button', { class: 'users linkb', title: x.users.length ? 'Select every surface using it' : 'Unused', disabled: !x.users.length || undefined, onClick: (e) => { e.stopPropagation(); selectUsers(x); } }, x.users.length ? `Used by ${x.users.length} · select` : 'Unused'));
  if (x.variants) {
    const v = h('div', { class: 'vchips' });
    for (const id of x.variants) v.append(h('span', { class: variantSel.concrete === id ? 'on' : '', role: 'button', tabindex: 0, title: `${BY_ID[id].label} · roughness ${BY_ID[id].rough}`, onClick: () => { variantSel.concrete = id; setUi({}); } }, BY_ID[id].rough < 0.7 ? 'Polished' : 'Matte'));
    meta.append(v);
  }
  b.append(th, meta,
    x.ref ? h('button', { class: 'star sm' + (fav ? ' on' : ''), 'aria-pressed': String(fav), title: fav ? 'In your tray — click to remove' : 'Keep in your tray', 'aria-label': 'Favourite ' + x.name, onClick: (e) => { e.stopPropagation(); M.toggleFavourite('material', x.ref); setUi({}); } }, ic('star', 14)) : null,
    h('button', { class: 'xp', title: 'Detail', 'aria-label': 'Show detail for ' + x.name, onClick: (e) => { e.stopPropagation(); setUi({ library: { detail: U.library.detail === x.key ? null : x.key } }); } }, '⤢'));
  return b;
}

function verb(x) {
  const L = U.library;
  if (L.intent === 'swap') return 'swap to this material';
  if (L.intent === 'apply' && U.focus) return 'apply to ' + A.shortTarget(U.focus.target);
  if (x.src === 'project' && U.tool !== 'paint') return 'select every surface using it';
  return 'pick for Paint';
}

const choiceOf = (x) => (x.src === 'mine' ? { kind: 'library', id: x.id } : { kind: 'material', ref: x.ref });
function choose(x, keep) {
  const L = U.library;
  if (L.intent === 'swap') { A.swapTo(x.base, x.name); if (!keep) setUi({ library: { open: false } }); return; }
  if (x.src === 'project' && L.intent !== 'apply' && U.tool !== 'paint') { selectUsers(x); return; }
  A.chooseFromLibrary(choiceOf(x), keep);
  if (keep) toast(`${x.name} · Library stays open`);
}
function selectUsers(x) {
  if (!x.users?.length) return;
  setUi({ library: { open: false } });
  A.focus(x.users[0], 'finish'); setUi({ selectAll: true, reach: 'all', status: `${x.users.length} surface${x.users.length === 1 ? '' : 's'} use ${x.name}` });
}
function customise(x) {
  const t = U.focus?.target || null;
  setUi({ library: { open: false }, editor: { open: false }, draft: { base: x.base, ov: { ...x.ov }, name: x.name, named: x.src !== 'curated' && (x.src === 'mine' || !!x.f?.named), target: t, src: x.key, preview: null },
    status: t ? `Draft from ${x.name} · previewing on ${A.shortTarget(t)} · nothing is written` : `Draft from ${x.name} · click a surface to preview` });
}

// ------------------------------------------------------------------ detail side pane
function detail(x) {
  const L = U.library;
  const c = h('canvas', { width: 480, height: 480 });
  requestAnimationFrame(() => { try { T.paint(x.look, L.geom, c, { ...LIGHTS[L.light], lightTurn: (LIGHTS[L.light].lightTurn || 0) + L.turn, ...(L.geom === 'sample' ? { window: x.e.frame.w * 1.4 } : {}) }); } catch { /* loading */ } });
  const fav = x.ref && M.S.prefs.favMaterials.includes(x.ref);
  const r = F.effR(x.look); const st = F.stepAt(r);
  const n = changesOf(x);
  const facts = h('dl', { class: 'facts' },
    h('dt', {}, x.src === 'curated' ? 'Material' : 'From'), h('dd', {}, x.src === 'curated' ? `${TAXONOMY.find((cc) => cc.id === x.e.cat).label}${x.e.sub ? ' · ' + x.e.sub : ''}` : `${x.mat.label}${n ? ` · ${n} change${n === 1 ? '' : 's'}` : ''}`),
    h('dt', {}, 'Real size'), h('dd', {}, fmtM(x.look.tile[0])),
    h('dt', {}, 'Sheen'), h('dd', {}, `${st ? st[1] : 'Custom'} · r ${r.toFixed(2)}${x.look.metal >= 0.5 ? ' · metal' : ''}`),
    h('dt', {}, 'Maps'), h('dd', {}, [x.e.colorMap && !x.look.colourOff ? 'colour' : null, x.look.normalOff ? null : 'relief', x.look.ormOff ? null : 'sheen'].filter(Boolean).join(' · ') || 'none'),
    h('dt', {}, 'Source'), h('dd', {}, x.src === 'mine' ? `My library · saved ${x.it.savedAt} from ${x.it.savedFrom}` : x.src === 'project' ? `${A.originLabel(x.ref)} in this project` : 'Curated · CC0 source'),
    x.users ? [h('dt', {}, 'Used by'), h('dd', {}, x.users.length ? x.users.map(A.shortTarget).join(', ') : 'nothing')] : null);
  const primary = L.intent === 'swap' ? ['Swap to this', () => choose(x, false)]
    : L.intent === 'apply' && U.focus ? ['Apply to ' + A.shortTarget(U.focus.target), () => choose(x, false)]
      : ['Use for Paint', () => { A.arm(choiceOf(x)); setUi({ library: { open: false } }); }];
  const acts = h('div', { class: 'acts' },
    h('button', { class: 'btn pri', 'data-fid': 'lbd-primary', onClick: primary[1] }, primary[0]),
    L.intent !== 'swap' && L.intent === 'apply' ? h('button', { class: 'btn', onClick: () => { A.arm(choiceOf(x)); setUi({ library: { open: false } }); } }, 'Use for Paint') : null,
    L.intent !== 'swap' && L.intent !== 'apply' && U.focus ? h('button', { class: 'btn', onClick: () => { U.library.intent = 'apply'; choose(x, false); } }, 'Apply to ' + A.shortTarget(U.focus.target)) : null,
    h('button', { class: 'btn', 'data-fid': 'lbd-customise', title: 'Adjust it on the Card first — nothing is written until you apply', onClick: () => customise(x) }, 'Customise…'),
    x.users?.length ? h('button', { class: 'btn ghost', onClick: () => selectUsers(x) }, `Select all ${x.users.length}`) : null,
    x.src === 'project' && x.f ? h('button', { class: 'btn ghost', onClick: () => { const it = M.saveToLibrary(x.ref); toast(`Saved “${it.name}” to My library`); } }, 'Save to My library') : null,
    x.src === 'mine' ? h('button', { class: 'btn ghost', onClick: () => { M.removeLibraryItem(x.id); setUi({ library: { detail: null } }); } }, 'Remove from My library') : null);
  const explain = x.src === 'mine' ? h('div', { class: 'okbox' }, h('b', {}, 'What travels'), h('div', {}, 'The recipe and its images, as one private item. Using it here makes a new, independent Finish in this project.'), x.it.flattened?.length ? h('div', {}, `Palette colour ${x.it.flattened.join(', ')} was saved as its colour value.`) : null)
    : x.variants ? h('div', { class: 'note-sm' }, 'Two presets of one image set that differ only in sheen; the chip says which you get.') : null;
  return h('aside', { class: 'lb-d', 'aria-label': 'Detail' },
    h('div', { class: 'lbd-h' }, h('div', { class: 'tt' }, h('div', { class: 'k' }, x.src === 'curated' ? 'Material' : 'Finish'), h('h3', {}, x.name)),
      x.ref ? h('button', { class: 'star' + (fav ? ' on' : ''), 'aria-pressed': String(fav), 'aria-label': 'Favourite', title: fav ? 'In your tray' : 'Keep in your tray', onClick: () => { M.toggleFavourite('material', x.ref); setUi({}); } }, ic('star', 16)) : null,
      h('button', { class: 'cp-x', 'aria-label': 'Close detail', onClick: () => setUi({ library: { detail: null } }) }, '×')),
    h('div', { class: 'view' }, c),
    h('div', { class: 'lbd-c' }, seg([['sphere', 'Sphere'], ['sample', 'Flat'], ['tile', 'Tile']], L.geom, (v) => setUi({ library: { geom: v } }), 'mseg'),
      seg([['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'World']], L.light, (v) => setUi({ library: { light: v } }), 'mseg'),
      h('button', { class: 'stepb', 'aria-label': 'Turn the light', title: 'Turn the light', onClick: () => setUi({ library: { turn: L.turn >= 1.2 ? -1.2 : +(L.turn + 0.4).toFixed(1) } }) }, '↻')),
    facts, explain, acts);
}

// ------------------------------------------------------------------ future kinds and sources
function futureKind(kind) {
  const copy = {
    objects: ['Objects', 'Furnish opens the Library here. Sofas, tables, lamps: the same search, sources, favourites and detail pane; choosing one arms placement on the Stage instead of Paint. Their parts take Finishes from the same Card.', ['Sofa', 'Coffee table', 'Lounge chair', 'Rug', 'Pendant', 'Shelf']],
    openings: ['Doors, windows and openings', 'Choosing one arms placement on a wall: the same “pick, then click the Stage” instrument, owned by Layout. Frames and leaves take Finishes from the same Card.', ['Door', 'Double door', 'Window', 'Opening', 'Skylight']],
    plants: ['Plants and lights', 'A later shelf. Lights use Sky’s sun for daylight and their own fittings for artificial light.', ['Fig', 'Olive', 'Pendant light', 'Wall light']]
  }[kind];
  return h('div', { class: 'lb-future' }, h('div', { class: 'fut-k' }, kind === 'objects' ? 'Same Library · placement is outside this study' : 'Future · not a commitment'), h('h4', {}, copy[0]), h('p', { class: 'note' }, copy[1]),
    h('div', { class: 'ghosts' }, copy[2].map((n) => h('div', { class: 'gcard' }, h('span', { class: 'gth' }, ic(kind === 'openings' ? 'door' : kind === 'plants' ? 'sun' : 'object', 22)), h('span', {}, n)))));
}
function futureSource() {
  return h('div', { class: 'lb-future' }, h('div', { class: 'fut-k' }, 'Future · not a commitment'), h('h4', {}, 'Third-party sources'), h('p', { class: 'note' }, 'A source is a read-only shelf next to Curated: browse and preview here; choosing one imports it through the same draft and checks as a file import (licence, channels, real size) before it becomes a project Finish. Nothing streams live into a project.'));
}
