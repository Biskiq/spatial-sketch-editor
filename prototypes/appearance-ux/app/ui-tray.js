/*
 * Paint tray — the one quick-access instrument. It sits on the dock, shows favourites then recents
 * for the active tab, expands upward to the palette + wheel (Colours) or the material grid
 * (Materials), and hands off to the Library for everything else. It never writes: picking arms
 * Paint; Stage gestures commit through actions.commitPaint → model.assign.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID, CATALOGUE, TAXONOMY } from '../shared/catalogue.js';
import { $, h, ic, swatch, seg, toast, pxFor } from './ui-kit.js';
import * as A from './actions.js';

const colourItem = (v) => (v.startsWith('#') ? { kind: 'colour', hex: v } : { kind: 'colour', slot: v });
const matItem = (ref) => ({ kind: 'material', ref });
const validColour = (v) => v.startsWith('#') || M.S.p.palette.some((s) => s.id === v);
const validRef = (r) => r.startsWith('cat:') ? !!BY_ID[r.slice(4)] : r.startsWith('fin:') ? !!M.S.p.finishes[r.slice(4)] : r.startsWith('model:');

/** Items of the always-visible row, in key order (1–9). */
export function trayRowItems() {
  if (U.trayTab === 'colours') {
    const fav = M.S.prefs.favColours.filter(validColour);
    const rec = M.S.prefs.recentColours.filter((v) => validColour(v) && !fav.includes(v)).slice(0, 5);
    return [...fav.map((v) => ({ ...colourItem(v), fav: true })), ...rec.map(colourItem)];
  }
  const fav = M.S.prefs.favMaterials.filter(validRef);
  const rec = M.S.prefs.recentMaterials.filter((r) => validRef(r) && !fav.includes(r)).slice(0, 5);
  return [...fav.map((r) => ({ ...matItem(r), fav: true })), ...rec.map(matItem)];
}
export function pickFromItem(it) {
  if (it.kind === 'colour') A.arm(it.slot ? { kind: 'colour', slot: it.slot } : { kind: 'colour', hex: it.hex });
  else if (it.kind === 'library') A.arm({ kind: 'library', id: it.id });
  else A.arm({ kind: 'material', ref: it.ref });
}
const samePick = (it) => {
  const p = U.pick;
  if (it.kind !== (p.kind === 'library' ? 'library' : p.kind)) return false;
  if (it.kind === 'colour') return (it.slot && it.slot === p.slot) || (it.hex && it.hex === p.hex);
  if (it.kind === 'library') return it.id === p.id;
  return it.ref === p.ref;
};

export function renderTray() {
  const el = $('#tray');
  el.hidden = U.tool !== 'paint';
  if (el.hidden) return;
  el.innerHTML = '';
  const tabs = seg([['colours', 'Colours', 'Colour replaces the surface colour and keeps its relief (T)'], ['materials', 'Materials', 'A material replaces the whole Finish (T)']], U.trayTab, (v) => setUi({ trayTab: v }));
  const scope = seg([['face', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, ic('face', 14), 'Face')], ['space', h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, ic('space', 14), 'Space')]], U.scope, (v) => setUi({ scope: v }));
  scope.title = 'Face paints one surface; Space paints every wall face (or every part of an object). S toggles, Shift-click does it once.';
  el.append(h('div', { class: 'tr-h' }, tabs, h('span', { class: 'grow' }), scope,
    h('button', { class: 'ib', 'aria-pressed': String(U.dropper), title: 'Sample a surface’s Finish (I) · Alt-click or long-press does it without this button', 'aria-label': 'Sample', onClick: () => setUi({ dropper: !U.dropper }) }, ic('dropper', 18)),
    h('button', { class: 'ib', 'aria-expanded': String(U.trayOpen), title: U.trayOpen ? 'Collapse' : 'Expand (palette and wheel, or all materials)', 'aria-label': U.trayOpen ? 'Collapse tray' : 'Expand tray', onClick: () => setUi({ trayOpen: !U.trayOpen }) }, h('span', { style: { display: 'inline-grid', transform: U.trayOpen ? 'rotate(90deg)' : 'rotate(-90deg)' } }, ic('back', 16)))));

  // the always-visible row: favourites │ recents │ more
  const row = h('div', { class: 'tr-row', role: 'listbox', 'aria-label': U.trayTab === 'colours' ? 'Favourite and recent colours' : 'Favourite and recent materials' });
  const items = trayRowItems();
  const size = matchMedia('(pointer:coarse)').matches ? 44 : 40;
  let sawRecent = false;
  // A pick made elsewhere (Library, wheel, dropper) that is not yet a recent
  // leads the row, so what is armed is always visible where it is used.
  const p = U.pick;
  const libIt = p.kind === 'library' ? M.S.library.find((x) => x.id === p.id) : null;
  if (p.kind && (p.kind !== 'library' || libIt) && (U.trayTab === 'colours') === (p.kind === 'colour') && !items.some(samePick)) {
    const name = A.pickName(p);
    const b = p.kind === 'library'
      ? h('button', { class: 'sw m', type: 'button', 'aria-pressed': 'true', title: `Picked · ${name}`, 'aria-label': `Picked · ${name}`, style: { width: size + 'px', height: size + 'px', backgroundImage: `url(${libThumb(libIt, pxFor(size), size <= 34 ? 'xs' : 'sample')})` } })
      : swatch(p.kind === 'colour' ? p : { kind: 'material', ref: p.ref }, size, { pressed: true, title: `Picked · ${name}` });
    b.dataset.fid = 'tray-picked';
    row.append(b, h('span', { class: 'lab' }, 'picked'), h('span', { class: 'sep' }));
  }
  items.forEach((it, i) => {
    if (!it.fav && !sawRecent) { sawRecent = true; row.append(h('span', { class: 'sep' }), h('span', { class: 'lab' }, 'recent')); }
    const b = swatch(it, size, { pressed: samePick(it), onClick: () => pickFromItem(it), title: `${i < 9 ? i + 1 + ' · ' : ''}${A.pickName(it.kind === 'colour' ? it : { kind: 'material', ref: it.ref })}` });
    b.dataset.fid = 'tray-' + i;
    if (i < 9) b.append(h('span', { class: 'n' }, String(i + 1)));
    row.append(b);
  });
  if (!items.length) row.append(h('span', { class: 'note' }, 'Star colours or materials to keep them here.'));
  row.append(h('span', { class: 'sep' }));
  if (U.trayTab === 'colours') {
    row.append(h('button', { class: 'sw c dashed', style: { width: size + 'px', height: size + 'px' }, title: 'Any colour — wheel', 'aria-label': 'Any colour', 'data-fid': 'tray-wheel', onClick: (e) => setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: A.pickHex(U.pick) || '#9aa58c', title: 'Paint colour', forPaint: true } }) }, ic('plus', 16)));
  } else {
    row.append(h('button', { class: 'btn sm', 'data-fid': 'tray-browse', onClick: () => A.openLibrary('pick') }, ic('library', 15), 'Browse all'));
  }
  // star the current pick
  const curKey = U.pick.kind === 'colour' ? (U.pick.slot || U.pick.hex) : U.pick.ref;
  const favList = U.pick.kind === 'colour' ? M.S.prefs.favColours : M.S.prefs.favMaterials;
  if (curKey && U.pick.kind !== 'library') row.append(h('button', { class: 'ib', title: favList.includes(curKey) ? 'Remove the current pick from favourites' : 'Keep the current pick in favourites', 'aria-pressed': String(favList.includes(curKey)), 'aria-label': 'Favourite current pick', onClick: () => M.toggleFavourite(U.pick.kind === 'colour' ? 'colour' : 'material', curKey) }, ic('star', 16)));
  el.append(row);

  if (U.trayOpen) el.append(U.trayTab === 'colours' ? expandedColours() : expandedMaterials());
}

function expandedColours() {
  const x = h('div', { class: 'tr-x' });
  const pal = h('div', { class: 'tr-grid' });
  for (const s of M.S.p.palette) pal.append(swatch({ kind: 'colour', slot: s.id }, 34, { pressed: U.pick.slot === s.id, title: `${s.name} · palette colour — surfaces painted with it follow later changes`, onClick: () => A.arm({ kind: 'colour', slot: s.id }) }));
  pal.append(h('button', { class: 'sw c dashed', style: { width: '34px', height: '34px' }, title: 'Add a palette colour', 'aria-label': 'Add a palette colour', onClick: (e) => setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: A.pickHex(U.pick) || '#b5a58a', title: 'New palette colour', addSlot: true } }) }, ic('plus', 14)));
  x.append(h('div', {}, h('h5', {}, 'Project palette', h('span', {}, 'followed · edit from the Index')), pal));
  x.append(h('div', {}, h('h5', {}, 'Colour vs material'), h('p', { class: 'note', style: { margin: 0 } }, 'Circles colour a surface and keep its relief and sheen (walnut stays grained; plaster stays plaster). Rounded squares replace the whole Finish.')));
  return x;
}

function expandedMaterials() {
  const x = h('div', { class: 'tr-x' });
  const inProject = [...new Set(Object.values(M.S.p.assign))].filter((r) => !r.startsWith('cat:') && !M.finishOf(r)?.coat);
  if (inProject.length) {
    const g = h('div', { class: 'tr-grid' });
    for (const r of inProject) g.append(swatch(matItem(r), 40, { pressed: U.pick.ref === r, onClick: () => A.arm({ kind: 'material', ref: r }) }));
    x.append(h('div', {}, h('h5', {}, 'This project'), g));
  }
  if (M.S.library.length) {
    const g = h('div', { class: 'tr-grid' });
    for (const it of M.S.library.slice(0, 8)) {
      const b = swatch({ kind: 'material', ref: 'cat:plaster-painted' }, 40, { pressed: U.pick.kind === 'library' && U.pick.id === it.id, title: `${it.name} · my library — painting inserts an independent copy`, onClick: () => A.arm({ kind: 'library', id: it.id }) });
      b.style.backgroundImage = `url(${libThumb(it, 112)})`;
      g.append(b);
    }
    x.append(h('div', {}, h('h5', {}, 'My library'), g));
  }
  for (const c of TAXONOMY) {
    const g = h('div', { class: 'tr-grid' });
    for (const e of CATALOGUE.filter((e) => e.cat === c.id && !e.variantOf)) g.append(swatch(matItem('cat:' + e.id), 40, { pressed: U.pick.ref === 'cat:' + e.id, onClick: () => A.arm({ kind: 'material', ref: 'cat:' + e.id }) }));
    x.append(h('div', {}, h('h5', {}, c.label), g));
  }
  x.append(h('button', { class: 'btn', style: { justifySelf: 'start' }, onClick: () => A.openLibrary('pick') }, ic('library', 15), 'Open the Library — search, filters, detail'));
  return x;
}

import * as T from './thumbs.js';
export const libThumb = (it, px = 112, pres = 'sample') => T.url(M.recipeLook(it.base, it.ov), pres, px);
