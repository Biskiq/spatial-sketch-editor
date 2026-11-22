/*
 * Paint tray — the one quick-access instrument. It sits on the dock: favourites then recents for
 * the active tab, a radius (Brush · Surface · Space), and "More ⌃" to expand upward into the
 * palette (with palette editing) or the material grid. Brush is a future tool inside Paint: it
 * adds at most two rows (its tools, then the selected tool's options) and never becomes a dock
 * tool of its own. The tray never writes: picking arms Paint; Stage gestures commit through
 * actions.commitPaint.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID, CATALOGUE, TAXONOMY } from '../shared/catalogue.js';
import { $, h, ic, swatch, seg, pxFor } from './ui-kit.js';
import * as T from './thumbs.js';
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

const BRUSH_TOOLS = [['brush', 'Brush', 'brush'], ['erase', 'Erase', 'erase'], ['smudge', 'Smudge', 'displace'], ['clone', 'Clone', 'source'], ['stencil', 'Stencil', 'mask'], ['decal', 'Decal', 'place'], ['teach', 'Teach', 'nodes']];
const radiusLabel = (job, label) => h('span', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center' } }, ic(job, 14), label);

export function renderTray() {
  const el = $('#tray');
  el.hidden = U.tool !== 'paint';
  if (el.hidden) return;
  el.innerHTML = '';
  el.classList.toggle('open', U.trayOpen);
  const tabs = seg([['colours', 'Colours', 'Colour replaces the surface colour and keeps its relief (T)'], ['materials', 'Materials', 'A material replaces the whole Finish (T)']], U.trayTab, (v) => setUi({ trayTab: v }));
  const radius = seg([['brush', radiusLabel('brush', 'Brush'), 'Brush — paint part of a surface (future). B toggles Brush and Surface'], ['surface', radiusLabel('face', 'Surface'), 'One surface per click (B toggles Brush and Surface)'], ['space', radiusLabel('space', 'Space'), 'Every wall surface in the room, or every part of an object (S) · Shift-click does it once']], U.scope, (v) => setUi({ scope: v }));
  radius.classList.add('radius'); radius.setAttribute('aria-label', 'Paint radius');
  radius.firstChild.classList.add('fut-b');
  el.append(h('div', { class: 'tr-h' }, tabs, h('span', { class: 'grow' }), radius,
    h('button', { class: 'ib', 'aria-pressed': String(U.dropper), title: 'Sample a surface’s Finish (I) · Alt-click or long-press does it without this button', 'aria-label': 'Sample', onClick: () => setUi({ dropper: !U.dropper }) }, ic('dropper', 18))));

  // row 1 — the always-visible swatches: picked │ favourites │ recents │ more
  const row = h('div', { class: 'tr-row', role: 'listbox', 'aria-label': U.trayTab === 'colours' ? 'Favourite and recent colours' : 'Favourite and recent materials' });
  const items = trayRowItems();
  const size = matchMedia('(pointer:coarse)').matches ? 44 : 40;
  let sawRecent = false;
  // A pick made elsewhere (Library, wheel, dropper, a draft) that is not yet a recent leads the row
  const p = U.pick;
  const libIt = p.kind === 'library' ? M.S.library.find((x) => x.id === p.id) : null;
  if (p.kind && (p.kind !== 'library' || libIt) && (U.trayTab === 'colours') === (p.kind === 'colour') && !items.some(samePick)) {
    const name = A.pickName(p);
    const b = p.kind === 'library' || p.kind === 'recipe'
      ? h('button', { class: 'sw m', type: 'button', 'aria-pressed': 'true', title: `Picked · ${name}`, 'aria-label': `Picked · ${name}`, style: { width: size + 'px', height: size + 'px', backgroundImage: `url(${T.url(p.kind === 'recipe' ? M.recipeLook(p.base, p.ov) : M.recipeLook(libIt.base, libIt.ov), size <= 34 ? 'xs' : 'sample', pxFor(size))})` } })
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
    row.append(h('button', { class: 'btn sm', 'data-fid': 'tray-browse', onClick: () => A.openLibrary('pick', { kind: 'materials' }) }, ic('library', 15), 'Browse all'));
  }
  // star the current pick: outline when off, gold-filled when on
  const curKey = U.pick.kind === 'colour' ? (U.pick.slot || U.pick.hex) : U.pick.ref;
  const favList = U.pick.kind === 'colour' ? M.S.prefs.favColours : M.S.prefs.favMaterials;
  if (curKey && U.pick.kind !== 'library' && U.pick.kind !== 'recipe') {
    const on = favList.includes(curKey);
    row.append(h('button', { class: 'star' + (on ? ' on' : ''), title: on ? 'In favourites — click to remove' : 'Keep the current pick in favourites', 'aria-pressed': String(on), 'aria-label': 'Favourite current pick', 'data-fid': 'tray-star', onClick: () => M.toggleFavourite(U.pick.kind === 'colour' ? 'colour' : 'material', curKey) }, ic('star', 18)));
  }
  if (!U.trayOpen) row.append(h('button', { class: 'morep', 'aria-expanded': 'false', 'data-fid': 'tray-more', title: U.trayTab === 'colours' ? 'Palette, wheel and palette editing' : 'Every material in the project, My library and curated', onClick: () => setUi({ trayOpen: true }) }, 'More', h('span', { 'aria-hidden': 'true' }, '⌃')));
  el.append(row);

  // rows 2–3 — Brush (future): its tools, then the options of the selected tool. Never more than three rows.
  if (U.scope === 'brush') el.append(brushRows());

  if (U.trayOpen) el.append(h('div', { class: 'tr-xw' }, h('button', { class: 'ib collapse', 'aria-expanded': 'true', 'aria-label': 'Collapse tray', title: 'Collapse', 'data-fid': 'tray-collapse', onClick: () => setUi({ trayOpen: false }) }, '⌄'), U.trayTab === 'colours' ? expandedColours() : expandedMaterials()));
}

function brushRows() {
  const tools = h('div', { class: 'tr-tools', role: 'toolbar', 'aria-label': 'Brush tools (future)' });
  for (const [id, label, job] of BRUSH_TOOLS) tools.append(h('button', { class: 'tt-b', 'aria-pressed': String(U.brushTool === id), title: `${label}${id === 'erase' ? ' (E)' : ''} — future`, onClick: () => setUi({ brushTool: id }) }, ic(job, 16), h('span', {}, label)));
  tools.append(h('span', { class: 'tag fut push' }, 'future'));
  const opt = {
    brush: [['Size', '40 cm'], ['Soft', '60%'], ['Paints', 'Colour · Sheen · Relief']],
    erase: [['Size', '40 cm'], ['Soft', '60%'], ['Removes', 'strokes only · the Finish stays']],
    smudge: [['Size', '25 cm'], ['Strength', '40%']],
    clone: [['Size', '30 cm'], ['Source', 'Alt-click a point']],
    stencil: [['Shape', 'Height band · 0.9 m'], ['See why', 'dado below 0.9 m']],
    decal: [['Image', 'Choose…'], ['Size', 'real size']],
    teach: [['Teach', 'stroke on one wall → a rule for all'], ['Spreads to', 'All 5 using this Finish']]
  }[U.brushTool];
  const opts = h('div', { class: 'tr-opts' }, opt.map(([k, v]) => h('span', { class: 'opt' }, h('b', {}, k), h('span', {}, v))),
    h('span', { class: 'note-sm push' }, 'Strokes stay on this surface in its own metres and survive a Finish swap.'));
  return h('div', { class: 'tr-brush' }, tools, opts);
}

function expandedColours() {
  const x = h('div', { class: 'tr-x' });
  const pal = h('div', { class: 'tr-grid' });
  const edit = U.paletteEdit;
  for (const s of M.S.p.palette) {
    const followers = Object.values(M.S.p.finishes).filter((f) => f.ov.slot === s.id).reduce((n, f) => n + M.usersOf('fin:' + f.id).length, 0);
    const b = swatch({ kind: 'colour', slot: s.id }, 34, { pressed: !edit && U.pick.slot === s.id, cls: edit ? 'editing' : '',
      title: edit ? `Edit ${s.name} everywhere · ${followers} surface${followers === 1 ? '' : 's'} follow it` : `${s.name} · palette colour — surfaces painted with it follow later changes`,
      onClick: (e) => (edit ? setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: s.hex, title: `Palette · ${s.name}`, slotEdit: s.id } }) : A.arm({ kind: 'colour', slot: s.id })) });
    if (edit && followers) b.append(h('span', { class: 'n' }, String(followers)));
    pal.append(b);
  }
  pal.append(h('button', { class: 'sw c dashed', style: { width: '34px', height: '34px' }, title: 'Add a palette colour', 'aria-label': 'Add a palette colour', onClick: (e) => setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: A.pickHex(U.pick) || '#b5a58a', title: 'New palette colour', addSlot: true } }) }, ic('plus', 14)));
  x.append(h('div', {}, h('h5', {}, 'Project palette', h('button', { class: 'linkb', 'aria-pressed': String(edit), 'data-fid': 'pal-edit', title: 'Change a palette colour everywhere it is followed, as one undo', onClick: () => setUi({ paletteEdit: !edit }) }, edit ? 'Done editing' : 'Edit palette')), pal,
    edit ? h('p', { class: 'note-sm' }, 'Click a colour to change it everywhere; the number is how many surfaces follow it. One undo per change.') : null));
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
  x.append(h('button', { class: 'btn', style: { justifySelf: 'start' }, onClick: () => A.openLibrary('pick', { kind: 'materials' }) }, ic('library', 15), 'Open the Library — search, filters, detail'));
  return x;
}

export const libThumb = (it, px = 112, pres = 'sample') => T.url(M.recipeLook(it.base, it.ov), pres, px);
