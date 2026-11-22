/*
 * Cards. Subject Card = what was clicked (a wall with two sides, a floor, an object and its parts,
 * a model with its own Finishes). Finish Card = the appearance of one surface, edited in context.
 * Every row writes through model.editFinish with the reach chosen BEFORE the edit (gold outlines
 * on the Stage show who changes), replacing the post-hoc “All / Just this” question.
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { BY_ID } from '../shared/catalogue.js';
import { TARGETS, SUBJECTS } from './stage.js';
import * as T from './thumbs.js';
import { $, h, ic, swatch, seg, range, toast, SHEEN, sheenName, validHex, normHex } from './ui-kit.js';
import * as A from './actions.js';

let renaming = false, openAcc = null, menuEl = null;

export function cardSelection() {
  if (!U.focus) return { selected: null, users: [], usersMode: 'all' };
  const t = U.focus.target;
  if (U.card === 'subject') return { selected: SUBJECTS[TARGETS[t].subject].targets, users: [], usersMode: 'all' };
  const users = A.reachUsersOf(t).filter((x) => x !== t);
  return { selected: [t], users, usersMode: users.length ? U.reach : 'all' };
}

export function renderCard() {
  const el = $('#card');
  if (!U.focus) { el.hidden = true; el.innerHTML = ''; renaming = false; return; }
  el.hidden = false; el.innerHTML = '';
  el.append(U.card === 'finish' ? finishCard(U.focus.target) : subjectCard(U.focus.target));
}

// ------------------------------------------------------------------ subject
function subjectCard(t) {
  const sid = TARGETS[t].subject, S = SUBJECTS[sid];
  const kindIcon = { wall: 'wall', floor: 'floor', object: 'object', model: 'object' }[S.kind];
  const domain = TARGETS[t].kind === 'layout' ? 'Layout' : 'Scene';
  const body = h('div', { class: 'body' });
  const intro = {
    wall: S.targets.length > 1 ? 'Each side is its own surface with its own Finish.' : 'Paint the visible side, or choose Space to paint every wall face.',
    floor: 'The floor of this level. Patterns follow the room in metres.',
    object: 'Each part keeps its own Finish. Paint a part, or Space to paint every part.',
    model: 'Parts arrive with the model’s own Finishes. Painting a part overrides it; Restore brings the original back.'
  }[S.kind];
  body.append(h('p', { class: 'note', style: { margin: '0 0 6px' } }, intro));
  for (const tt of S.targets) {
    const ref = M.S.p.assign[tt];
    const seed = M.eraseRef(tt);
    const restore = S.kind === 'model' && ref !== seed ? h('button', { class: 'linkb', onClick: () => M.assign([tt], seed, 'Restore model’s own') }, 'Restore model’s own') : null;
    const sw = swatch({ kind: 'material', ref }, 40, { title: 'Edit this Finish', onClick: () => A.focus(tt, 'finish') });
    body.append(h('div', { class: 'prow' + (tt === t ? ' on' : '') }, sw,
      h('div', { class: 'pm' }, h('div', { class: 'pn' }, TARGETS[tt].side), h('div', { class: 'ps' }, M.nameOf(ref), ' · ', A.originLabel(ref)), restore, M.openDiagnostics(ref).length ? h('div', { class: 'ps', style: { color: 'var(--amber)' } }, 'Needs repair') : null),
      h('button', { class: 'go', 'data-fid': 'edit-' + tt, onClick: () => A.focus(tt, 'finish') }, 'Edit ›')));
  }
  const foot = h('div', { class: 'foot' },
    h('button', { onClick: () => setUi({ tool: 'paint' }) }, 'Paint (B)'),
    h('button', { onClick: () => A.openLibrary('apply') }, 'Replace…'),
    h('button', { class: 'push', onClick: () => setUi({ inspector: { open: true, target: t } }) }, 'Inspect'));
  return h('div', { class: 'card' },
    h('div', { class: 'ch' }, h('span', { class: 'kind' }, ic(kindIcon, 18)), h('div', { class: 'tt' }, h('div', { class: 'k' }, `${S.kind} · ${domain}`), h('div', { class: 't' }, S.label)),
      h('button', { class: 'cp-x', 'aria-label': 'Close', onClick: () => A.focus(null) }, '×')),
    body, foot);
}

// ------------------------------------------------------------------ finish
const mapsWith = (f, ch, v) => { const m = { ...(f?.ov.maps || {}) }; if (v === undefined) delete m[ch]; else m[ch] = v; return Object.keys(m).length ? m : undefined; };

function finishCard(t) {
  const ref = M.S.p.assign[t]; const L = M.look(ref); const f = M.finishOf(ref);
  const allUsers = M.usersOf(ref), users = A.reachUsersOf(t, ref), n = users.length;
  const otherKind = allUsers.filter((u) => !users.includes(u));
  const base = BY_ID[L.set]; const textured = base.colorMap;
  const reach = n > 1 ? U.reach : 'all';
  const edit = (patch, key) => A.editAt(t, patch, key);
  const preview = (patch) => M.setPreview(ref, patch, reach === 'all' ? users : [t]);
  const prov = (field) => M.provenance(ref, field);

  // ---- head
  const title = renaming && f
    ? h('input', { class: 'fld', value: f.name, 'aria-label': 'Finish name', 'data-fid': 'rename', maxlength: 120, onKeydown: (e) => { if (e.key === 'Enter') { if (M.rename(ref, e.target.value)) { renaming = false; setUi({}); } else e.target.classList.add('bad'); } if (e.key === 'Escape') { e.stopPropagation(); renaming = false; setUi({}); } }, onBlur: () => { renaming = false; setUi({}); } })
    : h('div', { class: 't', role: f ? 'button' : undefined, tabindex: f ? 0 : undefined, title: f ? 'Rename (Enter)' : 'Curated names stay fixed — your first edit makes a project Finish you can rename', onClick: () => { if (f) { renaming = true; setUi({}); setTimeout(() => $('#card input.fld')?.select()); } }, onKeydown: (e) => { if (e.key === 'Enter' && f) { renaming = true; setUi({}); setTimeout(() => $('#card input.fld')?.select()); } } }, M.nameOf(ref));
  const kind = h('span', { class: 'kind img', style: { backgroundImage: `url(${T.url(L, 'xs', 64)})` } });
  const head = h('div', { class: 'ch' },
    h('button', { class: 'back', title: `Back to ${SUBJECTS[TARGETS[t].subject].label}`, 'aria-label': 'Back', onClick: () => setUi({ card: 'subject' }) }, ic('back', 16)),
    kind, h('div', { class: 'tt' }, h('div', { class: 'k' }, 'Finish · ', A.originLabel(ref)), title),
    h('button', { class: 'cp-x', 'aria-label': 'Close', onClick: () => A.focus(null) }, '×'));

  const body = h('div', { class: 'body' });
  body.append(h('div', { class: 'note-sm', style: { margin: '-4px 0 6px' } }, A.targetLabel(t)));

  // ---- diagnostics first: a broken Finish is repaired before it is tuned
  for (const d of M.openDiagnostics(ref)) body.append(diagStrip(ref, d));

  // ---- reach (chosen before the edit, previewed in gold)
  if (n > 1) {
    const sideWord = TARGETS[t].group === 'walls' ? (SUBJECTS[TARGETS[t].subject].targets.length > 1 ? 'side' : 'wall') : TARGETS[t].kind === 'layout' ? 'surface' : 'part';
    body.append(h('div', { class: 'cr' },
      h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('shared', 14), 'Changes apply to')),
      h('div', { class: 'reach', style: { marginTop: '4px' } }, seg([['this', `This ${sideWord}`, 'Only this surface; it gets its own copy on the first change'], ['all', `All ${n}`, 'Every surface using this Finish']], reach, (v) => setUi({ reach: v }))),
      h('div', { class: 'note-sm' }, reach === 'all' ? `Gold outlines on the Stage: the ${n} surfaces that change.` : 'Only this surface changes. Dashed outlines keep the current Finish.'),
      otherKindNote(otherKind, ref)));
  } else {
    body.append(h('div', { class: 'note-sm', style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '0 0 6px' } }, ic('single', 13), ref.startsWith('cat:') ? 'Curated — your first change makes a project Finish; the original stays in the catalogue.' : 'Only this surface uses it.'));
    if (otherKind.length) body.append(otherKindNote(otherKind, ref));
  }

  // ---- colour
  const colourMode = L.colourOff && L.colour !== 'coat' ? 'coat' : (L.colour || 'natural');
  const colourNow = colourMode === 'coat' ? (L.coat || L.tint) : L.tint;
  const slotName = f?.ov.slot ? M.S.p.palette.find((s) => s.id === f.ov.slot)?.name : null;
  const chip = h('button', { class: 'colchip', 'data-fid': 'colchip', onClick: (e) => setUi({ picker: { anchor: e.currentTarget.getBoundingClientRect(), hex: colourNow, title: colourMode === 'tint' ? 'Tint' : 'Colour', forFinish: { t, mode: colourMode === 'natural' ? 'tint' : colourMode } } }) }, h('i', { style: { background: colourNow } }), slotName ? `${slotName} · follows palette` : colourNow);
  const cr = h('div', { class: 'cr' }, h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('colour', 14), 'Colour'), h('span', { class: 'rv' }, textured ? { natural: 'Natural', tint: 'Tinted image', coat: 'Flat colour' }[colourMode] : 'Base colour')));
  if (textured) {
    cr.append(h('div', { style: { marginTop: '4px' } }, seg([
      ['natural', 'Natural', 'The material’s own colour'],
      ['tint', 'Tint', 'Multiply the image by a colour — grain and pattern stay'],
      ['coat', 'Colour', 'Replace the image with a flat colour — relief and sheen stay']
    ], colourMode, (v) => {
      if (v === 'natural') edit({ colour: undefined, tint: undefined, coat: undefined, slot: undefined, maps: mapsWith(f, 'colour', undefined) });
      if (v === 'tint') edit({ colour: 'tint', tint: colourMode === 'coat' ? colourNow : '#d9c9ad', coat: undefined, maps: mapsWith(f, 'colour', undefined) });
      if (v === 'coat') edit({ colour: 'coat', coat: colourNow === '#ffffff' ? '#cfc6b6' : colourNow, tint: undefined, maps: mapsWith(f, 'colour', null) });
    })));
    if (colourMode !== 'natural') cr.append(h('div', { style: { marginTop: '6px' } }, chip));
  } else cr.append(h('div', { style: { marginTop: '4px' } }, chip));
  body.append(cr);

  // ---- sheen (+ metal)
  // The recipe stores a roughness FACTOR on the scanned map. The slider speaks
  // in the result the creator sees (sheen of factor × scan); detents snap to
  // named sheens, plus "As scanned" (factor 1) when a roughness map is on.
  const mapped = !L.ormOff, scanR = mapped ? T.scanRough(L.set) : 1;
  const eff = (factor) => Math.min(1, factor * scanR);
  const toFactor = (s) => +Math.min(1, (1 - s) / scanR).toFixed(3);
  const sheenOf = (factor) => +(1 - eff(factor)).toFixed(2);
  const minSheen = +(1 - scanR).toFixed(2);
  const detents = [...(mapped ? [[minSheen, 'As scanned']] : []), ...SHEEN.filter(([v]) => v > minSheen + 0.06 || !mapped)];
  const label = (factor) => (mapped && Math.abs(factor - 1) < 0.005 ? 'As scanned' : sheenName(eff(factor))) + ` <em>r ${eff(factor).toFixed(2)}${mapped ? ' · ×' + factor.toFixed(2) : ''}</em>`;
  const rough = L.rough, sheen = sheenOf(rough);
  const rv = h('span', { class: 'rv', html: label(rough) });
  const metal = L.metal >= 0.5;
  const sheenRow = h('div', { class: 'cr' }, h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('sheen', 14), 'Sheen'), rv));
  const near = detents.reduce((a, b) => (Math.abs(b[0] - sheen) < Math.abs(a[0] - sheen) ? b : a));
  const snap = (v) => { const d = detents.find(([x]) => Math.abs(x - v) < 0.025); return d ? d[0] : Math.max(v, minSheen); };
  const sr = range({ min: 0, max: 1, step: 0.01, value: sheen, label: 'Sheen', pinned: prov('rough') === 'override',
    ticks: detents.map(([v, name], i) => [v, i && v - detents[i - 1][0] < 0.16 ? '·' : name === 'Semi-gloss' ? 'Semi' : name === 'As scanned' ? 'Scan' : name, near[0] === v]),
    onInput: (v) => {
      v = snap(v); const ri = sr.querySelector('input'); ri.value = v; ri.style.setProperty('--p', v * 100 + '%');
      rv.innerHTML = label(toFactor(v)); preview({ rough: toFactor(v) });
    },
    onChange: (v) => { v = snap(v); M.setPreview(null); edit({ rough: toFactor(v) }, 'rough'); } });
  sr.querySelector('input').dataset.fid = 'sheen';
  sheenRow.append(sr, h('div', { class: 'cr-top', style: { marginTop: '4px' } }, h('span', { class: 'lb' }, ic('metal', 14), 'Metal'), h('span', { class: 'rv' }, h('button', { class: 'switch', role: 'switch', 'aria-checked': String(metal), 'aria-label': 'Metal', 'data-fid': 'metal', onClick: () => edit({ metal: metal ? 0 : 1 }) }))));
  body.append(sheenRow);

  // ---- pattern (scale + direction)
  if (textured || !L.normalOff) {
    const tile = L.tile[0]; const lo = Math.log10(0.1), hi = Math.log10(8);
    const curatedTile = base.tile[0];
    const prv = h('span', { class: 'rv', html: `${tile.toFixed(2)} m <em>repeat</em>` });
    const pr = h('div', { class: 'cr' }, h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('scale', 14), 'Pattern'), prv));
    const sc = range({ min: lo, max: hi, step: 0.005, value: Math.log10(tile), label: 'Pattern scale', pinned: prov('tile') === 'override',
      ticks: [[Math.log10(curatedTile), 'curated', Math.abs(curatedTile - tile) < 0.01]],
      onInput: (v) => { const m = +(10 ** v).toFixed(2); prv.innerHTML = `${m.toFixed(2)} m <em>repeat</em>`; preview({ tile: m }); },
      onChange: (v) => { M.setPreview(null); edit({ tile: +(10 ** v).toFixed(2) }, 'tile'); } });
    sc.querySelector('input').dataset.fid = 'scale';
    pr.append(sc, h('div', { class: 'cr-top', style: { marginTop: '2px' } }, h('span', { class: 'lb' }, ic('direction', 14), 'Direction'), h('span', { class: 'rv' }, seg([[0, '0°'], [45, '45°'], [90, '90°']], L.rot || 0, (v) => edit({ rot: v || undefined }), 'mseg'))));
    body.append(pr);
  }

  // ---- relief
  const rr = h('div', { class: 'cr' });
  if (L.normalOff) rr.append(h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('relief', 14), 'Relief'), h('span', { class: 'rv' }, 'map off · ', h('button', { class: 'linkb', onClick: () => edit({ maps: mapsWith(f, 'normal', undefined) }) }, 'Turn on'))));
  else {
    const ns = L.normalScale ?? 1;
    const nrv = h('span', { class: 'rv', html: `${ns.toFixed(2)}×` });
    const nr = range({ min: 0, max: 2, step: 0.05, value: ns, label: 'Relief strength', pinned: prov('normalScale') === 'override', ticks: [[1, '1×', Math.abs(ns - 1) < 0.01]],
      onInput: (v) => { nrv.textContent = v.toFixed(2) + '×'; preview({ normalScale: v }); },
      onChange: (v) => { M.setPreview(null); edit({ normalScale: v === 1 ? undefined : v }, 'relief'); } });
    nr.querySelector('input').dataset.fid = 'relief';
    rr.append(h('div', { class: 'cr-top' }, h('span', { class: 'lb' }, ic('relief', 14), 'Relief'), nrv), nr);
  }
  body.append(rr);

  // ---- origin line
  const origin = originText(ref, f);
  if (origin) body.append(h('p', { class: 'note-sm', style: { margin: '8px 0 4px' } }, origin));

  // ---- more (one open at a time)
  body.append(acc('maps', 'Maps & channels', mapsSummary(ref, L), () => mapsBody(t, ref, L, f, edit)));
  body.append(acc('mapping', 'Mapping', TARGETS[t].kind === 'layout' ? 'world metres' : (L.mapping || 'uv0').toUpperCase().replace('SURFACE', 'surface'), () => mappingBody(t, ref, L, edit)));
  body.append(acc('exact', 'Exact values', `${L.ormOff ? 'r' : 'r×'} ${L.rough.toFixed(2)} · m ${L.metal.toFixed(2)}`, () => exactBody(t, ref, L, edit)));
  body.append(acc('users', `Used by ${n}`, users.slice(0, 2).map(A.shortTarget).join(', ') + (n > 2 ? '…' : ''), () => usersBody(t, ref, users)));
  body.append(acc('recipe', 'Recipe', f ? `${Object.keys(f.ov).length} change${Object.keys(f.ov).length === 1 ? '' : 's'}` : 'as curated', () => recipeBody(t, ref, f, edit)));

  const foot = h('div', { class: 'foot' },
    h('button', { 'data-fid': 'inspect', onClick: () => setUi({ inspector: { open: true, target: t } }) }, 'Inspect'),
    h('button', { 'data-fid': 'save', title: 'A private copy for any project; nothing in this project changes', onClick: () => { const it = M.saveToLibrary(ref); toast(`Saved “${it.name}” to My library${it.flattened.length ? ` · ${it.flattened[0]} saved as its colour` : ''} · no project change`); } }, 'Save to library'),
    h('button', { class: 'push', 'aria-label': 'More actions', 'aria-haspopup': 'menu', 'data-fid': 'more', onClick: (e) => moreMenu(e.currentTarget, t, ref, f, n) }, '⋯'));
  return h('div', { class: 'card' }, head, body, foot);
}

function otherKindNote(others, ref) {
  if (!others.length) return null;
  const kind = TARGETS[others[0]].kind === 'scene' ? 'objects' : 'walls and floors';
  return h('div', { class: 'note-sm', style: { marginTop: '4px' } }, `${others.map(A.shortTarget).join(', ')} (${kind}) keep ${M.nameOf(ref)}. To share your change with them, paint them with the new Finish afterwards — one registration names one kind.`);
}

function originText(ref, f) {
  if (!f) return ref.startsWith('model:') ? 'Arrived with the model. Edits make a project Finish; Restore returns to this.' : null;
  if (f.origin === 'library-copy') { const it = M.S.library.find((i) => i.id === f.libItem); return `Independent copy of “${it?.name || f.name}” from your library${it ? ` (saved from ${it.savedFrom})` : ''}. Changes stay in this project and never reach the library item.`; }
  if (f.origin === 'import') return `Imported into this project from ${f.maps ? Object.values(f.maps).filter(Boolean).length : 3} image files. Shared by every surface that uses it.`;
  if (f.coat) return `${f.ov.slot ? 'A palette colour' : 'A colour'} on ${M.nameOf('cat:' + (f.base.catalogue || 'plaster-painted'))}: the image is off, relief and sheen stay.`;
  return null;
}

function diagStrip(ref, d) {
  const acts = d.channel === 'colour'
    ? [['Relink…', () => { M.repair(ref, d.id, 'relink'); toast(`Relinked ${d.file} from ~/Downloads (simulated)`); }], ['Replace image…', () => { M.repair(ref, d.id, 'replace'); toast('Replaced with client-tile_basecolor_v2.png (simulated)'); }], ['Use colour instead', () => M.repair(ref, d.id, 'off')]]
    : [['Use UV set 0', () => M.repair(ref, d.id, 'uv0')], ['Surface mapping', () => M.repair(ref, d.id, 'surface')]];
  return h('div', { class: 'diag', role: 'alert' }, h('b', {}, ic('warn', 14), d.channel === 'colour' ? 'Missing image' : 'Incompatible mapping'), h('div', {}, d.text), d.file ? h('div', { class: 'mono', style: { fontSize: '11px' } }, d.file) : null,
    h('div', { class: 'acts' }, acts.map(([l, fn], i) => h('button', { class: 'btn sm' + (i === 0 ? ' pri' : ''), onClick: fn }, l))),
    h('div', { class: 'note-sm', style: { color: '#6b4a0a' } }, 'Surfaces keep an amber hatch until repaired. Every repair is one undo.'));
}

function acc(id, label, summary, bodyFn) {
  const open = openAcc === id;
  const w = h('div', { class: 'acc' }, h('button', { 'aria-expanded': String(open), 'data-fid': 'acc-' + id, onClick: () => { openAcc = open ? null : id; setUi({}); } }, h('b', {}, label), h('span', {}, summary, ' ', open ? '▾' : '▸')));
  if (open) w.append(h('div', { class: 'ab' }, bodyFn()));
  return w;
}

function mapsSummary(ref, L) {
  const off = ['colour', 'normal', 'orm'].filter((c) => !M.hasMap(ref, c)).length;
  const total = BY_ID[L.set].colorMap ? 3 : 2;
  return `${total - Math.min(off, total)} on${off ? ` · ${off} off` : ''}`;
}
function mapsBody(t, ref, L, f, edit) {
  const out = [];
  const chans = [['colour', 'Colour', 'base colour image'], ['normal', 'Normal', 'relief · +Y'], ['orm', 'ORM', 'R occlusion · G roughness · B metal']];
  for (const [ch, label, sub] of chans) {
    if (ch === 'colour' && !BY_ID[L.set].colorMap) { out.push(h('div', { class: 'r' }, h('label', {}, label), h('span', { class: 'note-sm' }, 'none — base colour only'))); continue; }
    const p = M.provenance(ref, 'maps.' + ch);
    const on = M.hasMap(ref, ch);
    const file = f?.maps?.[ch];
    out.push(h('div', { class: 'r' }, h('label', {}, label),
      h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', minWidth: 0 } },
        h('button', { class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': label + ' map', onClick: () => edit({ maps: mapsWith(f, ch, on ? null : undefined), ...(ch === 'colour' && on ? { colour: 'coat', coat: L.tint === '#ffffff' ? '#d6cfc2' : L.tint } : {}) }) }),
        h('span', { class: 'prov ' + p }, p), h('span', { class: 'note-sm', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: file || sub }, file || sub),
        h('button', { class: 'linkb', style: { marginLeft: 'auto' }, onClick: () => setUi({ inspector: { open: true, target: t, display: { colour: 'colour', normal: 'normal', orm: 'roughness' }[ch] } }) }, 'Solo'))));
  }
  if (f?.importNotes) out.push(h('div', { class: 'note-sm' }, f.importNotes));
  out.push(h('div', { class: 'later' }, 'Later: replace one image, add a height map (displacement), layered masks — see the decision sheet’s future map.'));
  return out;
}
function mappingBody(t, ref, L, edit) {
  if (TARGETS[t].kind === 'layout') return [h('div', { class: 'note-sm' }, 'Walls and floors map in world metres, so patterns line up across faces and sides. Scale and direction live on the Pattern row.'), h('div', { class: 'later' }, 'Later: offset and per-face alignment handles on the Stage.')];
  const cur = L.mapping || 'uv0';
  return [h('div', { class: 'r' }, h('label', {}, 'Coordinates'), seg([['uv0', 'UV 0'], ['uv1', 'UV 1'], ['surface', 'Surface']], cur, (v) => edit({ mapping: v === 'uv0' ? undefined : v }), 'mseg')),
    h('div', { class: 'note-sm' }, 'Models bring their own UV sets. Surface mapping ignores them and projects in metres — useful for models without good UVs.')];
}
function fieldRow(label, value, parse, commit, unit = '') {
  const inp = h('input', { class: 'fld', value, 'aria-label': label, 'data-fid': 'x-' + label });
  const err = h('div', { class: 'err' });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = parse(inp.value); if (v === null) { inp.classList.add('bad'); err.textContent = 'Not a valid value'; return; } commit(v); }
    if (e.key === 'Escape') { e.stopPropagation(); inp.value = value; inp.classList.remove('bad'); err.textContent = ''; inp.blur(); }
  });
  inp.addEventListener('blur', () => { inp.value = value; inp.classList.remove('bad'); err.textContent = ''; });   // blur writes nothing
  return h('div', { class: 'r' }, h('label', {}, label), h('div', {}, h('div', { class: 'fldrow' }, inp, unit ? h('span', { class: 'unit' }, unit) : null), err));
}
function exactBody(t, ref, L, edit) {
  const num = (lo, hi) => (s) => { const v = parseFloat(s); return Number.isFinite(v) && v >= lo && v <= hi ? +v.toFixed(3) : null; };
  return [
    fieldRow(L.ormOff ? 'Roughness' : 'Roughness ×', L.rough.toFixed(2), num(0, 1), (v) => edit({ rough: v })),
    fieldRow('Metalness', L.metal.toFixed(2), num(0, 1), (v) => edit({ metal: v })),
    fieldRow('Repeat', L.tile[0].toFixed(2), num(0.05, 20), (v) => edit({ tile: v }), 'm'),
    fieldRow('Rotation', String(L.rot || 0), num(-360, 360), (v) => edit({ rot: v || undefined }), '°'),
    fieldRow(L.colour === 'coat' || L.colourOff ? 'Colour' : 'Tint', (L.colour === 'coat' ? L.coat : L.tint) || '#ffffff', (s) => (validHex(s) ? normHex(s) : null), (v) => edit(L.colour === 'coat' || L.colourOff ? { coat: v, slot: undefined } : { tint: v, slot: undefined })),
    h('div', { class: 'note-sm' }, (L.ormOff ? '' : 'Roughness × and Metalness are factors on the scanned map. ') + 'Enter commits · Esc restores · leaving the field writes nothing.'),
    h('div', { class: 'later' }, 'Opacity — later: the S8 recipe is opaque; glass needs a transmission recipe.')
  ];
}
function usersBody(t, ref, users) {
  const out = users.map((u) => h('button', { class: 'ix' + (u === t ? ' on' : ''), onClick: () => A.focus(u, 'finish'), onPointerenter: () => A.getStage()?.set({ hover: [u], ghostLook: null }), onPointerleave: () => A.getStage()?.set({ hover: [] }) }, h('span', { class: 'ind' }, u === t ? '●' : ''), h('span', { class: 'nm' }, A.targetLabel(u)), h('span', { class: 'sub' }, TARGETS[u].kind)));
  if (users.length > 1 && !ref.startsWith('cat:')) out.push(h('button', { class: 'btn sm', style: { justifySelf: 'start' }, onClick: () => { M.editFinish(t, ref, {}, 'this'); toast('This surface now has its own copy'); } }, ic('single', 14), 'Give this surface its own copy'));
  const kinds = new Set(users.map((u) => TARGETS[u].kind));
  if (kinds.size > 1) out.push(h('div', { class: 'note-sm' }, 'Shared by Layout surfaces and Scene objects: one Finish, edited once.'));
  return out;
}
function recipeBody(t, ref, f, edit) {
  const baseName = f ? (f.base.catalogue ? BY_ID[f.base.catalogue].label + ' · curated' : 'Imported image set') : M.nameOf(ref);
  const out = [h('div', { class: 'r' }, h('label', {}, 'Base'), h('span', {}, baseName))];
  if (f) for (const [k, v] of Object.entries(f.ov)) out.push(h('div', { class: 'r' }, h('label', {}, k), h('span', { class: 'mono', style: { fontSize: '11px' } }, typeof v === 'object' ? JSON.stringify(v) : String(v), ' ', h('span', { class: 'prov ' + (v === null ? 'disabled' : 'override') }, v === null ? 'disabled' : 'override'))));
  out.push(h('div', { class: 'note-sm' }, 'pbr-metallic-roughness/v1 · values not listed come from the base.'));
  if (f && f.base.catalogue && Object.keys(f.ov).length) out.push(h('button', { class: 'btn sm', style: { justifySelf: 'start' }, onClick: () => edit(Object.fromEntries(Object.keys(f.ov).map((k) => [k, undefined]))) }, 'Reset to curated'));
  return out;
}

function moreMenu(anchor, t, ref, f, n) {
  menuEl?.remove();
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu', style: { position: 'fixed', right: innerWidth - r.right + 'px', bottom: innerHeight - r.top + 6 + 'px' } });
  const item = (label, fn, disabled, title) => h('button', { role: 'menuitem', disabled: disabled || undefined, title, onClick: () => { close(); fn(); } }, label);
  m.append(
    item('Rename…', () => { renaming = true; setUi({}); setTimeout(() => $('#card input.fld')?.select()); }, !f, 'Curated names stay fixed'),
    item('Replace with…', () => A.openLibrary('apply')),
    item('Give this surface its own copy', () => M.editFinish(t, ref, {}, 'this'), n < 2 || ref.startsWith('cat:')),
    item('Paint with this', () => A.arm({ kind: 'material', ref })),
    h('hr'),
    item('Remove unused', () => M.removeUnused(ref), true, 'Only unused Finishes can be removed — this one has users'));
  const close = () => { m.remove(); menuEl = null; document.removeEventListener('pointerdown', off, true); };
  const off = (e) => { if (!m.contains(e.target)) close(); };
  document.body.append(m); menuEl = m; setTimeout(() => document.addEventListener('pointerdown', off, true));
  m.querySelector('button:not([disabled])')?.focus();
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } });
}
