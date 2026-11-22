/*
 * Library sheet — discovery for everything the tray does not hold. Sources: Curated catalogue,
 * This project, My library (private, cross-project), and dashed future sources (third-party,
 * Openings). One click selects and dismisses; Shift-click or the pin keeps it open.
 * The Library never writes either: it chooses, and actions.chooseFromLibrary calls the writer.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID, CATALOGUE, TAXONOMY } from '../shared/catalogue.js';
import * as T from './thumbs.js';
import { $, h, ic, seg, toast } from './ui-kit.js';
import * as A from './actions.js';
import { libThumb } from './ui-tray.js';

const FILTERS = [['textured', 'Textured'], ['plain', 'Plain colour'], ['metal', 'Metal'], ['matte', 'Matte'], ['glossy', 'Glossy'], ['used', 'Used here']];
let variantSel = { concrete: 'concrete-smooth' };

function entries() {
  const L = U.library; const q = L.q.trim().toLowerCase();
  let list = [];
  if (L.source === 'curated') {
    const seen = new Set();
    for (const e of CATALOGUE) {
      if (e.family === 'concrete') { if (seen.has('concrete')) continue; seen.add('concrete'); list.push({ kind: 'material', ref: 'cat:' + variantSel.concrete, e: BY_ID[variantSel.concrete], variants: ['concrete-smooth', 'concrete-polished'], name: 'Concrete' }); continue; }
      list.push({ kind: 'material', ref: 'cat:' + e.id, e, name: e.label });
    }
  } else if (L.source === 'project') {
    const refs = [...new Set([...Object.values(M.S.p.assign), ...Object.keys(M.S.p.finishes).map((id) => 'fin:' + id)])].filter((r) => !r.startsWith('cat:'));
    list = refs.map((r) => ({ kind: 'material', ref: r, e: BY_ID[M.look(r, false).set], name: M.nameOf(r), project: true }));
  } else if (L.source === 'mine') {
    list = M.S.library.map((it) => ({ kind: 'library', id: it.id, it, e: BY_ID[M.recipeLook(it.base, it.ov).set], name: it.name }));
  }
  return list.filter((x) => {
    const look = x.it ? M.recipeLook(x.it.base, x.it.ov) : M.look(x.ref, false);
    if (L.cat !== 'all' && x.e.cat !== L.cat) return false;
    if (q && !(`${x.name} ${x.e.label} ${x.e.sub || ''} ${TAXONOMY.find((c) => c.id === x.e.cat)?.label}`.toLowerCase().includes(q))) return false;
    const F = L.filters;
    if (F.has('textured') && !(x.e.colorMap && !look.colourOff)) return false;
    if (F.has('plain') && x.e.colorMap && !look.colourOff) return false;
    if (F.has('metal') && look.metal < 0.5) return false;
    if (F.has('matte') && look.rough < 0.7) return false;
    if (F.has('glossy') && look.rough > 0.55) return false;
    if (F.has('used') && !(x.ref && M.usersOf(x.ref).length)) return false;
    return true;
  });
}

export function renderLibrary() {
  const el = $('#lib');
  el.hidden = !U.library.open; if (el.hidden) { el.innerHTML = ''; return; }
  const L = U.library;
  const keepFocus = document.activeElement?.id === 'lib-q';
  el.innerHTML = '';
  const intentLine = L.intent === 'apply' && U.focus ? `Replace ${A.shortTarget(U.focus.target)}` : 'Pick for Paint';
  const q = h('input', { id: 'lib-q', type: 'search', placeholder: 'Search materials, colours, categories', value: L.q, 'aria-label': 'Search the Library', onInput: (e) => { U.library.q = e.target.value; setUi({}); } });
  el.append(h('div', { class: 'lb-h' },
    h('b', { style: { fontSize: '14px' } }, 'Library'), h('span', { class: 'tag' }, intentLine),
    h('div', { class: 'search' }, h('span', {}, ic('search', 16)), q),
    seg([['curated', 'Curated'], ['project', 'This project'], ['mine', `My library${M.S.library.length ? ' · ' + M.S.library.length : ''}`], ['sources', 'Sources'], ['openings', 'Openings']], L.source, (v) => setUi({ library: { source: v, expanded: null } })),
    h('button', { class: 'btn sm', title: 'Import an image set (PBR) as a project Finish', onClick: () => setUi({ library: { open: false }, importer: { open: true, targets: U.focus ? (U.card === 'subject' ? null : [U.focus.target]) : [] } }) }, ic('import', 14), 'Import…'),
    h('button', { class: 'ib', 'aria-pressed': String(L.keepOpen), title: 'Keep the Library open after choosing (or Shift-click a card)', 'aria-label': 'Keep open', onClick: () => setUi({ library: { keepOpen: !L.keepOpen } }) }, ic('place', 16)),
    h('button', { class: 'cp-x', 'aria-label': 'Close Library', onClick: () => setUi({ library: { open: false } }) }, '×')));
  const fl = h('div', { class: 'lb-f' });
  for (const [id, label] of FILTERS) fl.append(h('button', { class: 'fchip', 'aria-pressed': String(L.filters.has(id)), onClick: () => { const s = new Set(L.filters); s.has(id) ? s.delete(id) : s.add(id); setUi({ library: { filters: s } }); } }, label));
  fl.append(h('span', { class: 'note', style: { marginLeft: 'auto' } }, 'Click chooses and closes · Shift-click keeps open · ⤢ shows detail'));
  el.append(fl);

  const bodyEl = h('div', { class: 'lb-b' });
  const cats = h('div', { class: 'lb-cats', role: 'tablist', 'aria-label': 'Categories' });
  for (const c of [{ id: 'all', label: 'All' }, ...TAXONOMY]) cats.append(h('button', { class: 'ix' + (L.cat === c.id ? ' on' : ''), role: 'tab', 'aria-selected': String(L.cat === c.id), onClick: () => setUi({ library: { cat: c.id } }) }, h('span', { class: 'nm' }, c.label)));
  const grid = h('div', { class: 'lb-grid' });
  if (L.source === 'sources' || L.source === 'openings') grid.append(futureSource(L.source));
  else {
    const list = entries();
    if (!list.length) grid.append(h('div', { class: 'lb-empty' }, L.source === 'mine' ? 'Nothing saved yet. Use “Save to library” on any Finish Card — it travels to every project.' : 'No matches. Clear a filter or the search.'));
    for (const x of list) {
      const key = x.ref || x.id;
      grid.append(card(x));
      if (L.expanded === key || (L.expanded && x.variants?.includes(L.expanded.slice(4)))) grid.append(detail(x));
    }
  }
  bodyEl.append(cats, grid);
  el.append(bodyEl);
  if (keepFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

function card(x) {
  const key = x.ref || x.id;
  const look = x.it ? M.recipeLook(x.it.base, x.it.ov) : M.look(x.ref, false);
  const chosen = (U.pick.kind === 'material' && U.pick.ref === x.ref) || (U.pick.kind === 'library' && U.pick.id === x.id);
  const b = h('div', { class: 'mc' + (chosen ? ' on' : ''), role: 'button', tabindex: 0, 'data-fid': 'lib-' + key, title: `${x.name} — click to ${U.library.intent === 'apply' ? 'apply' : 'pick'}`,
    onClick: (e) => { if (e.target.closest('.xp,.vchips')) return; choose(x, e.shiftKey); },
    onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(x, e.shiftKey); } } });
  const th = h('div', { class: 'th', style: { backgroundImage: `url(${x.it ? libThumb(x.it, 256) : T.url(look, 'sample', 256)})` } });
  const meta = h('div', { class: 'mt' }, h('span', { class: 'mn' }, x.name), h('span', { class: 'ms' }, x.project ? `${A.originLabel(x.ref)} · ×${M.usersOf(x.ref).length}` : x.it ? `Saved from ${x.it.savedFrom}` : `${x.e.sub || ''} · ${look.tile[0]} m`));
  if (x.variants) {
    const v = h('div', { class: 'vchips' });
    for (const id of x.variants) v.append(h('span', { class: variantSel.concrete === id ? 'on' : '', role: 'button', tabindex: 0, title: `${BY_ID[id].label} · roughness ${BY_ID[id].rough}`, onClick: () => { variantSel.concrete = id; setUi({}); } }, BY_ID[id].rough < 0.7 ? 'Polished' : 'Matte'));
    meta.append(v);
  }
  b.append(th, meta, h('button', { class: 'xp', title: 'Detail', 'aria-label': 'Show detail for ' + x.name, onClick: (e) => { e.stopPropagation(); setUi({ library: { expanded: U.library.expanded === key ? null : key } }); } }, '⤢'));
  return b;
}

function choose(x, keep) {
  const choice = x.kind === 'library' ? { kind: 'library', id: x.id } : { kind: 'material', ref: x.ref };
  A.chooseFromLibrary(choice, keep);
  if (keep) toast(`${x.name} picked · Library stays open`);
}

function detail(x) {
  const look = x.it ? M.recipeLook(x.it.base, x.it.ov) : M.look(x.ref, false);
  const e = x.e;
  const big = x.it ? libThumb(x.it, 512) : T.url(look, 'sample', 512);
  const close = T.url(look, 'close', 256), sph = T.url(look, 'sphere', 256);
  const facts = h('dl', { class: 'facts' },
    h('dt', {}, 'Category'), h('dd', {}, TAXONOMY.find((c) => c.id === e.cat).label, e.sub ? ' · ' + e.sub : ''),
    h('dt', {}, 'Repeat'), h('dd', {}, `${look.tile[0]} m`),
    h('dt', {}, 'Sheen'), h('dd', {}, `roughness ${look.rough} · metal ${look.metal}`),
    h('dt', {}, 'Maps'), h('dd', {}, [e.colorMap && !look.colourOff ? 'colour' : null, 'normal', 'ORM'].filter(Boolean).join(' · ')),
    h('dt', {}, 'Source'), h('dd', {}, x.it ? `My library · saved ${x.it.savedAt} from ${x.it.savedFrom}` : x.project ? A.originLabel(x.ref) + ' in this project' : 'Curated · derived from retained CC0 sources (licence record in assets-source)'));
  const acts = h('div', { class: 'acts' },
    h('button', { class: 'btn pri', onClick: () => choose(x, false) }, U.library.intent === 'apply' && U.focus ? 'Apply to ' + A.shortTarget(U.focus.target) : 'Use for Paint'),
    U.focus && U.library.intent !== 'apply' ? h('button', { class: 'btn', onClick: () => { U.library.intent = 'apply'; choose(x, false); } }, 'Apply to selection') : null,
    x.ref ? h('button', { class: 'btn', onClick: () => { M.toggleFavourite('material', x.ref); setUi({}); } }, ic('star', 14), M.S.prefs.favMaterials.includes(x.ref) ? 'In tray' : 'Add to tray') : null,
    x.ref && x.project ? h('button', { class: 'btn', onClick: () => { const it = M.saveToLibrary(x.ref); toast(`Saved “${it.name}” to My library`); } }, 'Save to library') : null,
    x.it ? h('button', { class: 'btn ghost', onClick: () => { M.removeLibraryItem(x.id); setUi({ library: { expanded: null } }); } }, 'Remove from library') : null);
  const explain = x.it ? h('div', { class: 'okbox' }, h('b', {}, 'What travels'), h('div', {}, 'The recipe and its images, as one private item. Using it here makes a new, independent Finish in this project — edits never change the library item or the project it came from.'), x.it.flattened.length ? h('div', {}, `Palette colour ${x.it.flattened.join(', ')} was saved as its colour value; it no longer follows a palette.`) : null)
    : x.variants ? h('div', { class: 'note' }, 'Two presets of one image set that differ only in sheen. They read apart only under light, so they share a card and the variant chip says which you get. (Owner decision: keep as variants, or drop Polished per F.)') : null;
  return h('div', { class: 'detail' },
    h('div', { class: 'pics' }, h('div', { class: 'big', style: { backgroundImage: `url(${big})` }, role: 'img', 'aria-label': x.name + ' sample' }),
      h('div', { style: { backgroundImage: `url(${close})` } }, h('figcaption', {}, 'grazing ⅓')), h('div', { style: { backgroundImage: `url(${sph})` } }, h('figcaption', {}, 'shape · sheen'))),
    h('div', {}, h('h3', {}, x.name), facts, explain, acts));
}

function futureSource(kind) {
  if (kind === 'openings') return h('div', { class: 'lb-empty future', style: { borderRadius: '12px', textAlign: 'left' } }, h('div', { class: 'fut-k' }, 'Future · not a commitment'), h('h4', {}, 'Doors, windows and openings'), h('p', { class: 'note' }, 'Shares this Library’s search, categories and detail. Choosing one arms direct placement on a wall instead of Paint: the same “pick, then click the Stage” instrument, owned by Layout. Their frames take Finishes from the same pickers.'));
  return h('div', { class: 'lb-empty future', style: { borderRadius: '12px', textAlign: 'left' } }, h('div', { class: 'fut-k' }, 'Future · not a commitment'), h('h4', {}, 'Third-party sources'), h('p', { class: 'note' }, 'A source is a read-only shelf next to Curated: browse and preview here, and choosing one imports it through the same draft and checks as a file import (licence, channels, physical size) before it becomes a project Finish. Nothing streams live into a project.'));
}
