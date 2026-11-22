/*
 * Material editor: the same Finish as the Card, widened (about 560 px; a bottom sheet on iPad
 * portrait). It replaces the view-only Inspect. Left: a live preview you can turn, compare and
 * probe. Right: the RAW MATERIAL (captured maps, never edited in place) and the EXACT FINISH
 * (every value the Card rounds to steps). A gold dot marks each changed group; click it to reset.
 * Done shrinks back to the Card. Layers are a future seam and only shown as a placeholder.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { TARGETS } from './stage.js';
import * as T from './thumbs.js';
import { $, h, ic, seg, range, validHex, normHex } from './ui-kit.js';
import * as A from './actions.js';
import * as F from './finish.js';
import { cardHead } from './ui-card.js';

const LIGHTS = { studio: {}, grazing: { grazing: true }, world: { lightTurn: 0.62, exposure: 0.95, key: 0.95, bg: '#dfe2e3' } };
const VIEWS = [['lit', 'Lit'], ['colour', 'Colour'], ['normal', 'Relief'], ['roughness', 'Roughness'], ['metal', 'Metal'], ['occlusion', 'Occlusion']];
const MAPS = [['colour', 'Colour', 'colour', { shade: 'unlit' }], ['normal', 'Relief', 'relief', { solo: 'normal' }], ['orm', 'Sheen · occlusion', 'sheen', { solo: 'roughness' }]];

export function editorPanel(fm) {
  const E = U.editor;
  const head = cardHead(fm, { back: false });
  // ‹ Finish replaces the back arrow; the reach chip says who changes
  head.prepend(h('button', { class: 'back wideback', title: 'Back to the Card (Done)', 'aria-label': 'Back to the Finish Card', 'data-fid': 'ed-back', onClick: done }, ic('back', 16), h('span', {}, 'Finish')));
  head.querySelector('.tt').after(reachChip(fm));

  const grid = h('div', { class: 'ed' }, previewCol(fm, E), h('div', { class: 'ed-r', 'data-scroll': 'ed' }, rawSection(fm, E), exactSection(fm), layersSection(fm)));
  const n = F.changedGroups(fm).length;
  const foot = h('div', { class: 'foot' },
    h('span', { class: 'edn' }, n ? `${n} change${n === 1 ? '' : 's'} from original` : 'Same as the original material'),
    n ? h('button', { 'data-fid': 'ed-reset-all', title: 'Back to the raw material, one undo', onClick: () => fm.edit(F.resetAllPatch(fm)) }, 'Reset all') : null,
    h('button', { class: 'btn sm pri push', 'data-fid': 'ed-done', onClick: done }, 'Done'));
  return h('div', { class: 'card wide' + (fm.kind === 'draft' ? ' draft' : '') }, head, grid, foot);
}
const done = () => setUi({ editor: { open: false } });

function reachChip(fm) {
  if (fm.kind === 'draft') return h('span', { class: 'rchip', title: 'Nothing is written until you apply' }, 'Draft');
  const all = fm.reach === 'all' && fm.n > 1;
  return h('button', { class: 'rchip' + (all ? ' all' : ''), title: fm.n > 1 ? 'Who changes — switch on the Card' : 'Only this surface uses it', onClick: () => fm.n > 1 && setUi({ reach: all ? 'this' : 'all' }) },
    all ? `Applies to All ${fm.n}` : `Applies to ${A.shortTarget(fm.t || '') || 'this'}`);
}

// ------------------------------------------------------------------ preview
function previewCol(fm, E) {
  const c = h('canvas', { width: 520, height: 520 });
  const probe = h('div', { class: 'probe' }, 'hover to probe');
  const view = h('div', { class: 'view' }, c, probe, E.compare ? h('div', { class: 'cmp' }, h('span', {}, 'Original'), h('span', {}, 'Now')) : null);
  const pres = E.geom;
  const over = () => ({ ...LIGHTS[E.light], lightTurn: (LIGHTS[E.light].lightTurn || 0) + E.turn, ...(E.display === 'lit' ? {} : E.display === 'colour' ? { shade: 'unlit' } : { solo: E.display }), ...(pres === 'sample' ? { window: fm.mat.e.frame.w * 1.4 } : {}) });
  requestAnimationFrame(() => {
    try {
      T.paint(fm.L, pres, c, over());
      if (E.compare) {
        const tmp = document.createElement('canvas'); tmp.width = c.width; tmp.height = c.height;
        T.paint(fm.O, pres, tmp, over());
        const x = c.getContext('2d'); x.drawImage(tmp, 0, 0, c.width / 2, c.height, 0, 0, c.width / 2, c.height);
        x.fillStyle = '#fff'; x.fillRect(c.width / 2 - 1, 0, 2, c.height);
      }
    } catch { /* textures loading */ }
  });
  c.addEventListener('pointermove', (e) => {
    const b = c.getBoundingClientRect(); const x = Math.floor((e.clientX - b.left) / b.width * c.width), y = Math.floor((e.clientY - b.top) / b.height * c.height);
    const d = c.getContext('2d').getImageData(x, y, 1, 1).data; const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
    const Y = 0.2126 * lin(d[0]) + 0.7152 * lin(d[1]) + 0.0722 * lin(d[2]); const Ls = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
    const m = pres === 'sample' ? `  ${(((x / c.width) - 0.5) * fm.mat.e.frame.w * 1.4).toFixed(2)} m` : '';
    probe.textContent = `${hex}  L* ${Ls.toFixed(0)}${m}`;
  });
  c.addEventListener('pointerleave', () => { probe.textContent = 'hover to probe'; });
  const viewSel = h('select', { class: 'fld sel', 'aria-label': 'View', 'data-fid': 'ed-view', onChange: (e) => setUi({ editor: { display: e.target.value } }) },
    VIEWS.map(([v, l]) => h('option', { value: v, selected: v === E.display || undefined }, l)));
  return h('div', { class: 'ed-l' }, view,
    h('div', { class: 'edrow' }, h('span', { class: 'el' }, 'Shape'), seg([['sphere', 'Sphere'], ['sample', 'Flat'], ['tile', 'Tile']], E.geom, (v) => setUi({ editor: { geom: v } }), 'mseg')),
    h('div', { class: 'edrow' }, h('span', { class: 'el' }, 'Light'), seg([['studio', 'Studio'], ['grazing', 'Grazing'], ['world', 'This World']], E.light, (v) => setUi({ editor: { light: v } }), 'mseg'),
      h('button', { class: 'stepb', title: 'Turn the light', 'aria-label': 'Turn the light', 'data-fid': 'ed-turn', onClick: () => setUi({ editor: { turn: E.turn >= 1.2 ? -1.2 : +(E.turn + 0.4).toFixed(1) } }) }, '↻')),
    h('div', { class: 'edrow' }, h('span', { class: 'el' }, 'View'), viewSel),
    h('label', { class: 'chk edrow' }, h('button', { class: 'switch', role: 'switch', 'aria-checked': String(E.compare), 'data-fid': 'ed-compare', 'aria-label': 'Compare with original', onClick: () => setUi({ editor: { compare: !E.compare } }) }), 'Compare with original'),
    h('div', { class: 'note-sm' }, E.light === 'world' ? 'Approximates this project’s Sky sun.' : E.light === 'grazing' ? 'Low light across the surface: relief and scale errors show first.' : 'Even softbox and strip: colour and sheen read.'));
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

// ------------------------------------------------------------------ raw material
function rawSection(fm, E) {
  const s = h('section', { class: 'eds' }, h('h6', {}, 'Raw material', h('span', { class: 'hint' }, fm.mat.label)));
  const raw = { ...fm.O, colour: 'natural', colourOff: false, normalOff: false, ormOff: false };
  for (const [ch, label, group, solo] of MAPS) {
    if (ch === 'colour' && !fm.mat.e.colorMap) { s.append(h('div', { class: 'maprow off' }, h('span', { class: 'mth none' }, '—'), h('span', { class: 'mn' }, label, h('span', { class: 'ms' }, 'no colour image · plain material')))); continue; }
    const on = !(fm.ov.maps && fm.ov.maps[ch] === null);
    const file = fm.mat.files?.[ch] || (fm.kind === 'surface' && M.finishOf(fm.ref)?.maps?.[ch]) || `${fm.mat.e.set}/${ch === 'colour' ? 'color' : ch}.webp`;
    const viewing = E.display === ({ colour: 'colour', normal: 'normal', orm: 'roughness' })[ch];
    s.append(h('div', { class: 'maprow' + (on ? '' : ' off') },
      h('span', { class: 'mth', style: { backgroundImage: `url(${T.url(raw, 'tile', 64, solo, 'raw')})` } }),
      h('span', { class: 'mn' }, label, h('span', { class: 'ms mono' }, file)),
      h('button', { class: 'linkb', 'aria-pressed': String(viewing), 'data-fid': 'map-view-' + ch, title: 'Show this map in the preview', onClick: () => setUi({ editor: { display: viewing ? 'lit' : ({ colour: 'colour', normal: 'normal', orm: 'roughness' })[ch] } }) }, viewing ? 'Lit' : 'View'),
      h('button', { class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': `Use the ${label.toLowerCase()} map`, 'data-fid': 'map-' + ch,
        title: on ? (ch === 'colour' ? 'Turn off: the surface takes a plain colour' : ch === 'normal' ? 'Turn off: flat, no relief' : 'Turn off: one sheen value everywhere') : 'Use the captured map',
        onClick: () => fm.edit({ maps: F.mapsWith(fm.ov, ch, on ? null : (fm.origOv.maps && ch in fm.origOv.maps ? fm.origOv.maps[ch] : undefined)) }, 'map-' + ch) })));
  }
  s.append(h('div', { class: 'note-sm' }, `Captured at ${fmtM(fm.mat.tile)} · ${fm.mat.licence}${fm.mat.source === 'Curated' ? ' · curated' : ''}`));
  return s;
}

// ------------------------------------------------------------------ exact finish
function exactSection(fm) {
  const { L, ov } = fm;
  const s = h('section', { class: 'eds' }, h('h6', {}, 'Exact finish'));

  // Colour
  const kind = F.colourKind(L.set), mode = F.modeOf(L, ov), cur = F.colourOf(L, ov);
  const modes = kind === 'plain' ? [['natural', 'Natural'], ['paint', 'Painted']] : [['natural', 'Natural'], ['stain', 'Stained'], ['paint', 'Painted']];
  const def = kind === 'plain' ? 'paint' : kind;
  const hex = cur.slot ? M.slotHex(cur.slot) : cur.hex;
  const hexF = h('input', { class: 'fld', value: mode === 'natural' ? '' : hex, placeholder: 'material’s own', 'aria-label': 'Colour hex', 'data-fid': 'ed-hex', disabled: mode === 'natural' || undefined,
    onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.stopPropagation(); e.target.value = hex; e.target.blur(); } },
    onChange: (e) => { if (!validHex(e.target.value)) { e.target.classList.add('bad'); return; } fm.edit(F.colourPatch(L, ov, mode, { hex: normHex(e.target.value) }), 'colour'); } });
  const chip = h('button', { class: 'pchip' + (mode === 'natural' ? ' add' : ''), style: mode === 'natural' ? {} : { background: hex }, 'aria-label': 'Choose a colour', title: 'Colour wheel and palette', 'data-fid': 'ed-wheel',
    onClick: (e) => setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: hex || '#9aa58c', title: 'Finish colour', onColour: (c, final) => { const f2 = F.finishModel(); if (!f2) return; const m2 = F.modeOf(f2.L, f2.ov); const p = F.colourPatch(f2.L, f2.ov, m2 === 'natural' ? def : m2, c); if (!final) { f2.preview(p); return; } f2.endPreview(); f2.edit(p, 'colour'); } } }) }, mode === 'natural' ? ic('plus', 12) : '');
  const link = mode === 'natural' ? null : cur.slot
    ? h('span', { class: 'note-sm' }, `${M.S.p.palette.find((p) => p.id === cur.slot)?.name} · follows the palette `, h('button', { class: 'linkb', 'data-fid': 'ed-unlink', onClick: () => fm.edit(F.colourPatch(L, ov, mode, { hex }), 'colour') }, 'Unlink'))
    : h('span', { class: 'note-sm' }, 'Not linked to the palette');
  s.append(field(fm, 'colour', 'Colour', seg(modes, mode, (v) => fm.edit(F.colourPatch(L, ov, v, v === 'natural' ? {} : (cur.slot || cur.hex ? cur : { slot: M.S.p.palette[0].id })), 'colour'), 'mseg'),
    h('div', { class: 'fldrow' }, chip, hexF), link));

  // Sheen: exact, as effective roughness on the captured scan
  const scan = F.scanOf(L), r = F.effR(L), r0 = F.effR(fm.O);
  const min = +Math.max(0, 1 - Math.min(1, scan)).toFixed(3);
  const ticks = F.STEPS.map(([, l, v]) => [1 - v, l, F.stepAt(r)?.[1] === l]).filter(([v]) => v >= min);
  const rv = h('span', { class: 'rv mono' }, `r ${r.toFixed(2)}${L.ormOff ? '' : ` · ×${L.rough.toFixed(2)} on scan`}`);
  s.append(field(fm, 'sheen', 'Sheen', range({ min, max: 1, step: 0.01, value: 1 - r, label: 'Sheen', mark: 1 - r0, ticks,
    onInput: (v) => { rv.textContent = `r ${(1 - v).toFixed(2)}`; fm.preview({ rough: F.factorFor(L, 1 - v) }); },
    onChange: (v) => { fm.endPreview(); fm.edit({ rough: F.factorFor(L, 1 - v) }, 'rough'); } }), rv,
    scan < 0.97 && !L.ormOff ? h('div', { class: 'note-sm' }, `Captured at r ${scan.toFixed(2)} — a Finish is never rougher than its capture.`) : null));

  // Metal
  const mv = h('span', { class: 'rv mono' }, L.metal.toFixed(2));
  s.append(field(fm, 'metal', 'Metal', range({ min: 0, max: 1, step: 0.01, value: L.metal, label: 'Metal', mark: fm.O.metal,
    onInput: (v) => { mv.textContent = v.toFixed(2); fm.preview({ metal: v }); }, onChange: (v) => { fm.endPreview(); fm.edit({ metal: v }, 'metal'); } }), mv));

  // Relief
  const nv = h('span', { class: 'rv mono' }, L.normalOff ? 'map off' : `×${(L.normalScale ?? 1).toFixed(2)}`);
  s.append(field(fm, 'relief', 'Relief', range({ min: 0, max: 2, step: 0.05, value: L.normalScale ?? 1, label: 'Relief strength', mark: fm.O.normalScale ?? 1, disabled: L.normalOff,
    onInput: (v) => { nv.textContent = `×${v.toFixed(2)}`; fm.preview({ normalScale: v }); }, onChange: (v) => { fm.endPreview(); fm.edit({ normalScale: v }, 'relief'); } }), nv));

  // Pattern: exact metres, any angle, offset
  const off = L.offset || [0, 0];
  const num = (val, label, fid, unit, commit, ok = () => true) => h('label', { class: 'numf' }, h('span', {}, label), h('input', { class: 'fld', value: String(val), inputmode: 'decimal', 'aria-label': label, 'data-fid': fid,
    onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.stopPropagation(); e.target.value = String(val); e.target.blur(); } },
    onChange: (e) => { const v = parseFloat(e.target.value); if (!Number.isFinite(v) || !ok(v)) { e.target.classList.add('bad'); return; } commit(v); } }), h('em', {}, unit));
  s.append(field(fm, 'pattern', 'Pattern',
    h('div', { class: 'nums' },
      num(+L.tile[0].toFixed(3), 'Size', 'ed-tile', 'm', (v) => fm.edit({ tile: v }, 'tile'), (v) => v >= 0.02 && v <= 20),
      num(+(L.rot || 0).toFixed(1), 'Angle', 'ed-rot', '°', (v) => fm.edit({ rot: ((v % 360) + 360) % 360 || undefined }, 'rot')),
      num(+off[0].toFixed(3), 'Offset →', 'ed-ox', 'm', (v) => fm.edit({ offset: v || off[1] ? [v, off[1]] : undefined }, 'offset')),
      num(+off[1].toFixed(3), 'Offset ↑', 'ed-oy', 'm', (v) => fm.edit({ offset: v || off[0] ? [off[0], v] : undefined }, 'offset'))),
    h('div', { class: 'note-sm' }, `Real size ${fmtM(fm.O.tile[0])}`, fm.kind === 'surface' && F.isLayout(fm.t) ? [' · ', h('button', { class: 'linkb', 'data-fid': 'ed-align', onClick: () => setUi({ align: { target: fm.t }, editor: { open: false } }) }, TARGETS[fm.t].group === 'floor' ? 'Align on floor…' : 'Align on wall…')] : null)));

  // Mapping
  const model = fm.kind === 'surface' && TARGETS[fm.t]?.model;
  s.append(field(fm, 'mapping', 'Mapping', model
    ? seg([['uv0', 'UV set 0'], ['uv1', 'UV set 1'], ['surface', 'Metres']], L.mapping || 'uv0', (v) => fm.edit({ mapping: v === 'uv0' && !('mapping' in fm.origOv) ? undefined : v }, 'mapping'), 'mseg')
    : h('span', { class: 'rv' }, 'Metres on the surface · same size everywhere')));
  return s;
}

/** One exact field: label, gold dot when changed from the original (click resets that field). */
function field(fm, g, label, ...kids) {
  const ch = F.changed(fm, g);
  return h('div', { class: 'edf' + (ch ? ' changed' : '') },
    h('div', { class: 'efl' }, h('span', {}, label), ch ? h('button', { class: 'chg', 'aria-label': `${label} changed — reset to original`, title: `Changed from the original — click to reset ${label.toLowerCase()}`, 'data-fid': 'reset-' + g, onClick: () => fm.edit(F.resetPatch(fm, g)) }) : null),
    h('div', { class: 'efv' }, ...kids));
}

// ------------------------------------------------------------------ layers (future seam)
function layersSection(fm) {
  const s = h('section', { class: 'eds' }, h('h6', {}, 'Layers', h('span', { class: 'tag fut' }, 'future')));
  s.append(h('div', { class: 'layer' }, h('span', { class: 'mth', style: { backgroundImage: `url(${T.url(fm.L, 'xs', 64)})` } }), h('span', { class: 'mn' }, 'Base', h('span', { class: 'ms' }, 'this Finish — everything above'))));
  const add = h('details', { class: 'addl' }, h('summary', { 'aria-disabled': 'true', title: 'Layers are a future step' }, ic('plus', 12), 'Add layer'),
    h('ul', {}, [['Two-tone · paint over', 'Finish layer · a second treatment in a band'], ['Wear', 'Finish layer · taught on one wall, evaluated on each'], ['Dirt', 'Finish layer · gathers near the floor'], ['Grout', 'Finish layer · tile and masonry joints'], ['Painted strokes', 'Surface layer · stays on this surface; survives a swap']]
      .map(([n, d]) => h('li', {}, h('b', {}, n), h('span', {}, d)))));
  s.append(add);
  return s;
}

const fmtM = (m) => (m >= 1 ? (+m.toFixed(2)).toString() : (+m.toFixed(3)).toString()) + ' m';
export const editorOpen = () => U.editor.open && !!$('#card.wide');
