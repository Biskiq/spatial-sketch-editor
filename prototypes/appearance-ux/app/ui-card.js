/*
 * The Card is the Finish: quick operations with intelligent defaults, in the context of the
 * selected surface. Exact values live in the Material editor (ui-editor.js), which widens the
 * same Card. Both read finish.js, so a Library draft edits exactly like a Finish on a surface.
 *
 *   header   thumbnail · name (wraps, click to rename) · ✕
 *   meta     what it is and what it comes from
 *   reach    "On North wall · only here" | "Shared by 5 [This wall | All 5]" (cobalt on the Stage)
 *   rows     Material (Swap ›) · Colour (mode + palette) · Sheen (3 steps) · Pattern (real size)
 *   footer   ★ · Save to My library · Edit material… · ⋯
 */
import * as M from './model.js';
import { U, setUi } from './ui-state.js';
import { TARGETS, SUBJECTS } from './stage.js';
import * as T from './thumbs.js';
import { $, h, ic, swatch, seg, toast } from './ui-kit.js';
import * as A from './actions.js';
import * as F from './finish.js';
import { editorPanel } from './ui-editor.js';

let renaming = false, menuEl = null;
const FUTURE_ROWS = new URLSearchParams(location.search).get('future') === '1';

export function cardSelection() {
  if (U.draft) return { selected: U.draft.target ? [U.draft.target] : null, users: [], usersMode: 'all' };
  if (!U.focus) return { selected: null, users: [], usersMode: 'all' };
  const t = U.focus.target;
  if (U.card === 'subject') return { selected: SUBJECTS[TARGETS[t].subject].targets, users: [], usersMode: 'all' };
  const all = A.reachUsersOf(t);
  if (U.selectAll) return { selected: all, users: [], usersMode: 'all' };
  // cobalt = will change: other users only when the edit reaches them
  const users = U.reach === 'all' ? all.filter((x) => x !== t) : [];
  return { selected: [t], users, usersMode: 'all' };
}

export function renderCard() {
  const el = $('#card');
  const fm = F.finishModel();
  const subject = !U.draft && U.focus && U.card === 'subject';
  if (!fm && !subject) { el.hidden = true; el.innerHTML = ''; el.classList.remove('wide'); renaming = false; return; }
  // keep scroll positions across re-renders (a re-render never jumps the Card back to the top)
  const keep = {}; el.querySelectorAll('[data-scroll]').forEach((n) => { keep[n.dataset.scroll] = n.scrollTop; });
  el.hidden = false; el.innerHTML = '';
  const wide = !subject && U.editor.open;
  el.classList.toggle('wide', wide);
  document.body.classList.toggle('editing', wide);
  el.append(subject ? subjectCard(U.focus.target) : wide ? editorPanel(fm) : finishCard(fm));
  el.querySelectorAll('[data-scroll]').forEach((n) => { if (keep[n.dataset.scroll] != null) n.scrollTop = keep[n.dataset.scroll]; });
}

// ------------------------------------------------------------------ subject: an object or wall with parts
function subjectCard(t) {
  const sid = TARGETS[t].subject, S = SUBJECTS[sid];
  const kindIcon = { wall: 'wall', floor: 'floor', object: 'object', model: 'object' }[S.kind];
  const domain = TARGETS[t].kind === 'layout' ? 'Layout' : 'Scene';
  const body = h('div', { class: 'body', 'data-scroll': 'subject' });
  body.append(h('p', { class: 'note-sm', style: { margin: '0 0 4px' } }, {
    wall: 'Each side is its own surface with its own Finish.',
    object: 'Each part has its own Finish.',
    model: 'Parts arrive with the model’s own Finishes; a change overrides it, Restore brings it back.'
  }[S.kind] || ''));
  for (const tt of S.targets) {
    const ref = M.S.p.assign[tt]; const seed = M.eraseRef(tt);
    const restore = S.kind === 'model' && ref !== seed ? h('button', { class: 'linkb', onClick: (e) => { e.stopPropagation(); M.assign([tt], seed, 'Restore model’s own'); } }, 'Restore') : null;
    body.append(h('button', { class: 'prow', 'data-fid': 'part-' + tt, onClick: () => A.focus(tt, 'finish'), onPointerenter: () => A.getStage()?.set({ hover: [tt], ghostLook: null }), onPointerleave: () => A.getStage()?.set({ hover: [] }) },
      swatch({ kind: 'material', ref }, 32, { title: M.nameOf(ref) }),
      h('span', { class: 'pm' }, h('span', { class: 'pn' }, TARGETS[tt].side), h('span', { class: 'ps' }, M.nameOf(ref)), M.openDiagnostics(ref).length ? h('span', { class: 'ps', style: { color: 'var(--amber)' } }, 'Needs repair') : null),
      restore, h('span', { class: 'go', 'aria-hidden': 'true' }, '›')));
  }
  return h('div', { class: 'card' },
    h('div', { class: 'ch' }, h('span', { class: 'kind' }, ic(kindIcon, 18)), h('div', { class: 'tt' }, h('div', { class: 'k' }, `${S.kind === 'model' ? 'model' : S.kind} · ${domain}`), h('div', { class: 't2' }, S.label)),
      h('button', { class: 'cp-x', 'aria-label': 'Deselect', title: 'Deselect (Esc)', onClick: () => A.focus(null) }, '×')),
    body);
}

// ------------------------------------------------------------------ the Finish Card
export function cardHead(fm, { back = true } = {}) {
  const t = fm.t;
  const multi = fm.kind === 'surface' && SUBJECTS[TARGETS[t].subject].targets.length > 1;
  const startRename = () => { if (!fm.canRename) return; renaming = true; setUi({}); setTimeout(() => $('#card input.rn')?.select()); };
  const title = renaming && fm.canRename
    ? h('input', { class: 'fld rn', value: fm.name, 'aria-label': 'Finish name', 'data-fid': 'rename', maxlength: 120,
      onKeydown: (e) => { if (e.key === 'Enter') { if (fm.rename(e.target.value)) { renaming = false; setUi({}); } else e.target.classList.add('bad'); } if (e.key === 'Escape') { e.stopPropagation(); renaming = false; setUi({}); } },
      onBlur: () => { renaming = false; setUi({}); } })
    : h('div', { class: 't2', role: fm.canRename ? 'button' : undefined, tabindex: fm.canRename ? 0 : undefined, 'data-fid': 'name',
      title: fm.canRename ? 'Rename (Enter)' : 'Curated names stay fixed — your first change makes a Finish you can rename',
      onClick: startRename, onKeydown: (e) => { if (e.key === 'Enter') startRename(); } }, fm.name);
  return h('div', { class: 'ch' },
    back && multi ? h('button', { class: 'back', title: `Back to ${SUBJECTS[TARGETS[t].subject].label}`, 'aria-label': 'Back to ' + SUBJECTS[TARGETS[t].subject].label, onClick: () => setUi({ card: 'subject', editor: { open: false } }) }, ic('back', 16)) : null,
    h('span', { class: 'kind img', style: { backgroundImage: `url(${T.url(fm.L, 'xs', 64)})` } }),
    h('div', { class: 'tt' }, title),
    h('button', { class: 'cp-x', 'aria-label': fm.kind === 'draft' ? 'Cancel draft' : 'Deselect', title: fm.kind === 'draft' ? 'Cancel — nothing is written' : 'Deselect (Esc)', onClick: () => (fm.kind === 'draft' ? setUi({ draft: null, editor: { open: false } }) : A.focus(null)) }, '×'));
}

function finishCard(fm) {
  const { L, ov } = fm;
  const body = h('div', { class: 'body', 'data-scroll': 'card' });
  body.append(h('div', { class: 'meta' }, fm.meta));
  if (fm.kind === 'surface') for (const d of M.openDiagnostics(fm.ref)) body.append(diagStrip(fm.ref, d));
  body.append(reachLine(fm));

  // ---- Material (raw) · Swap keeps the treatment
  const raw = h('span', { class: 'sw m', style: { width: '22px', height: '22px', backgroundImage: `url(${T.url(fm.O, 'xs', 64)})` }, 'aria-hidden': 'true' });
  body.append(row('Material', 'finish',
    h('div', { class: 'v' }, raw, h('span', { class: 'mn' }, fm.mat.label, h('span', { class: 'ms' }, `${fm.mat.sub ? fm.mat.sub + ' · ' : ''}${fm.mat.source}`)),
      h('button', { class: 'linkb push', 'data-fid': 'swap', title: 'Choose another material — keeps this colour and sheen', onClick: () => A.openLibrary('swap', { kind: 'materials' }) }, 'Swap ›'))));

  // ---- Colour: mode follows the material; palette first
  const kind = F.colourKind(L.set);
  const mode = F.modeOf(L, ov);
  const cur = F.colourOf(L, ov);
  const def = kind === 'plain' ? 'paint' : kind;
  const fallback = () => (cur.slot || (mode !== 'natural' && cur.hex) ? cur : { slot: M.S.p.palette.find((s) => s.id === 'sage') ? 'sage' : M.S.p.palette[0].id });
  const modes = kind === 'plain' ? [['natural', 'Natural', 'The material’s own colour'], ['paint', 'Painted', 'A colour on this material']]
    : [['natural', 'Natural', 'The material’s own colour'], ['stain', 'Stained', 'Tints the image — grain and pattern stay'], ['paint', 'Painted', 'A coat of colour — relief and sheen stay']];
  const chips = h('div', { class: 'pchips' });
  for (const s of M.S.p.palette) chips.append(h('button', { class: 'pchip', style: { background: s.hex }, 'aria-pressed': String(mode !== 'natural' && cur.slot === s.id), title: `${s.name} · follows the palette`, 'aria-label': s.name, 'data-fid': 'pc-' + s.id,
    onClick: () => fm.edit(F.colourPatch(L, ov, mode === 'natural' ? def : mode, { slot: s.id }), 'colour') }));
  const custom = mode !== 'natural' && !cur.slot;
  chips.append(h('button', { class: 'pchip add' + (custom ? ' lit' : ''), style: custom ? { background: cur.hex } : {}, 'aria-pressed': String(custom), title: custom ? `${cur.hex} · not linked to the palette` : 'Any colour', 'aria-label': 'Any colour', 'data-fid': 'pc-any',
    onClick: (e) => openPicker(e.currentTarget, mode === 'natural' ? def : mode, cur) }, custom ? '' : ic('plus', 12)));
  const cv = mode === 'natural' ? 'Original' : cur.slot ? `${M.S.p.palette.find((s) => s.id === cur.slot)?.name} · palette` : cur.hex;
  body.append(row('Colour', 'colour',
    h('div', { class: 'v' }, seg(modes, mode, (v) => fm.edit(F.colourPatch(L, ov, v, v === 'natural' ? {} : fallback()), 'colour'), 'mseg'), h('span', { class: 'rv' }, cv)),
    mode !== 'natural' || true ? h('div', { class: 'v full' }, chips) : null));

  // ---- Sheen: three steps; the original's step carries a dot; between steps reads Custom
  const r = F.effR(L), r0 = F.effR(fm.O);
  // the dot sits on the nearest step the capture can reach (never on a disabled step)
  const st = F.stepAt(r); const reach = F.STEPS.filter(([, , v]) => F.reachable(L, v));
  const o = (reach.length ? reach : F.STEPS).reduce((a, b) => (Math.abs(b[2] - r0) < Math.abs(a[2] - r0) ? b : a));
  const sheenChanged = F.changed(fm, 'sheen');
  const sb = h('div', { class: 'mseg', role: 'group', 'aria-label': 'Sheen' });
  for (const [id, label, v] of F.STEPS) {
    const ok = F.reachable(L, v);
    sb.append(h('button', { type: 'button', 'aria-pressed': String(!!st && st[0] === id && (sheenChanged || Math.abs(r - v) < 0.04)), disabled: !ok || undefined, 'data-fid': 'sheen-' + id,
      title: ok ? `${label}${o[0] === id ? ' · nearest to the original' : ''}` : `${fm.mat.label} is captured at r ${F.scanOf(L).toFixed(2)} — it can’t be made rougher than captured`,
      onClick: () => { const back = o[0] === id && !('rough' in fm.origOv) && Math.abs(F.factorFor(L, v) - fm.O.rough) < 0.01; fm.edit(back ? F.resetPatch(fm, 'sheen') : { rough: F.factorFor(L, v) }, 'rough'); } },
    label, o[0] === id ? h('i', { class: 'od', title: 'Original' }) : null));
  }
  const sv = !sheenChanged ? 'Original' : st ? st[1] : `Custom · r ${r.toFixed(2)}`;
  body.append(row('Sheen', 'sheen', h('div', { class: 'v' }, sb, h('span', { class: 'rv' }, sv))));

  // ---- Pattern: real size first; ½× / 2× steps; quarter turns; align on walls and floors
  const textured = (fm.mat.e.colorMap && !L.colourOff) || !L.normalOff;
  if (textured) {
    const real = fm.O.tile[0], tile = L.tile[0], rot = ((L.rot || 0) % 360 + 360) % 360;
    const k = Math.log2(tile / real); const exact = Math.abs(k - Math.round(k)) < 0.01;
    const ratio = exact ? ({ '-3': '⅛', '-2': '¼', '-1': '½', 1: '2', 2: '4', 3: '8' }[Math.round(k)]) : null;
    const pv = exact && Math.round(k) === 0 ? `Real size ${fmtM(real)}` : `${fmtM(tile)}${ratio ? ` · ${ratio}× real` : ''}`;
    const setK = (nk) => { nk = Math.max(-3, Math.min(3, nk)); fm.edit(nk === 0 && !('tile' in fm.origOv) ? { tile: undefined } : { tile: +(real * 2 ** nk).toFixed(3) }, 'tile'); };
    const pr = row('Pattern', 'pattern', h('div', { class: 'v' }, h('span', { class: 'pv' }, pv, rot ? h('em', {}, ` · ${rot}°`) : null),
      h('span', { class: 'push', style: { display: 'inline-flex', gap: '4px' } },
        h('button', { class: 'stepb', title: 'Smaller pattern (½×)', 'aria-label': 'Smaller pattern', 'data-fid': 'pat-minus', onClick: () => setK(exact ? Math.round(k) - 1 : Math.floor(k)) }, '−'),
        h('button', { class: 'stepb', title: 'Larger pattern (2×)', 'aria-label': 'Larger pattern', 'data-fid': 'pat-plus', onClick: () => setK(exact ? Math.round(k) + 1 : Math.ceil(k)) }, '+'),
        h('button', { class: 'stepb wide', title: 'Turn the pattern 90°', 'aria-label': 'Turn the pattern 90 degrees', 'data-fid': 'pat-rot', onClick: () => { const n = (rot + 90) % 360; fm.edit({ rot: n || ('rot' in fm.origOv ? 0 : undefined) }, 'rot'); } }, '↻ 90°'))));
    if (fm.kind === 'surface' && F.isLayout(fm.t)) pr.append(h('div', { class: 'v full' }, h('button', { class: 'linkb', 'data-fid': 'align', title: 'Face this surface straight on: ruler, repeat grid, offset and rotation handles', onClick: () => setUi({ align: { target: fm.t }, editor: { open: false } }) }, TARGETS[fm.t].group === 'floor' ? 'Align on floor…' : 'Align on wall…')));
    body.append(pr);
  }

  // ---- future rows (only when present; ?future=1 shows how they would read)
  if (FUTURE_ROWS && fm.kind === 'surface') {
    body.append(h('div', { class: 'fr future-row' }, h('span', { class: 'lb' }, ic('layers', 14), 'Layers'), h('div', { class: 'v' }, h('button', { class: 'linkb', onClick: () => setUi({ editor: { open: true } }) }, '+2 layers · Wear, Two-tone ›'), h('span', { class: 'tag fut' }, 'future'))));
    if (F.isLayout(fm.t)) body.append(h('div', { class: 'fr future-row' }, h('span', { class: 'lb' }, ic('brush', 14), 'Strokes'), h('div', { class: 'v' }, h('span', {}, `Painted on this ${TARGETS[fm.t].group === 'floor' ? 'floor' : 'wall'} · 3 strokes`), h('span', { class: 'tag fut' }, 'future'))));
  }

  if (fm.kind === 'draft') body.append(h('div', { class: 'fr' }, h('span', { class: 'lb' }), h('div', { class: 'v' }, h('button', { class: 'linkb', 'data-fid': 'edit-material', onClick: () => setUi({ editor: { open: true } }) }, 'Edit material…'))));

  return h('div', { class: 'card' + (fm.kind === 'draft' ? ' draft' : '') }, cardHead(fm), body, fm.kind === 'draft' ? draftFoot(fm) : surfaceFoot(fm));
}

const fmtM = (m) => (m >= 1 ? m.toFixed(m % 1 ? 2 : 1) : m.toFixed(2).replace(/0$/, '')) + ' m';

function row(label, icon, ...kids) {
  return h('div', { class: 'fr' }, h('span', { class: 'lb' }, ic(icon, 14), label), ...kids);
}

function reachLine(fm) {
  if (fm.kind === 'draft') return h('div', { class: 'reachl' }, ic('single', 13), fm.t ? h('span', {}, 'Previewing on ', h('b', {}, A.shortTarget(fm.t)), ' · cobalt on the Stage') : h('span', {}, 'Click a surface to preview it there'));
  const t = fm.t;
  if (fm.n <= 1) return h('div', { class: 'reachl' }, ic('single', 13), h('span', {}, 'On ', h('b', {}, A.shortTarget(t)), ' · only here'), otherKindNote(fm));
  const sideWord = TARGETS[t].group === 'walls' ? (SUBJECTS[TARGETS[t].subject].targets.length > 1 ? 'side' : 'wall') : TARGETS[t].kind === 'layout' ? 'surface' : 'part';
  return h('div', { class: 'reachl' }, ic('shared', 13), h('span', {}, 'Shared by ', h('b', {}, String(fm.n))),
    h('span', { class: 'push' }, seg([['this', `This ${sideWord}`, 'Only this surface; it gets its own copy on the first change'], ['all', `All ${fm.n}`, 'Every surface using this Finish — cobalt on the Stage']], fm.reach, (v) => setUi({ reach: v }), 'mseg')),
    otherKindNote(fm));
}
function otherKindNote(fm) {
  if (!fm.otherKind?.length) return null;
  const kind = TARGETS[fm.otherKind[0]].kind === 'scene' ? 'objects' : 'walls and floors';
  return h('div', { class: 'note-sm', style: { flexBasis: '100%' } }, `${fm.otherKind.map(A.shortTarget).join(', ')} (${kind}) keep it — one registration names one kind.`);
}

function openPicker(anchor, mode, cur) {
  setUi({ picker: { anchor: anchor.getBoundingClientRect(), hex: cur.hex || M.slotHex(cur.slot) || '#9aa58c', title: mode === 'stain' ? 'Stain colour' : 'Paint colour',
    onColour: (c, final) => {
      const fm = F.finishModel(); if (!fm) return;
      const patch = F.colourPatch(fm.L, fm.ov, F.modeOf(fm.L, fm.ov) === 'natural' ? mode : F.modeOf(fm.L, fm.ov), c);
      if (!final) { fm.preview(patch); return; }
      fm.endPreview(); fm.edit(patch, 'colour');
    } } });
}

function surfaceFoot(fm) {
  const fav = M.S.prefs.favMaterials.includes(fm.ref);
  return h('div', { class: 'foot' },
    h('button', { class: 'star' + (fav ? ' on' : ''), 'aria-pressed': String(fav), title: fav ? 'In your tray favourites — click to remove' : 'Keep in your tray favourites', 'aria-label': 'Favourite', 'data-fid': 'fav', onClick: () => M.toggleFavourite('material', fm.ref) }, ic('star', 16)),
    h('button', { 'data-fid': 'save', title: 'A private copy for any project; nothing in this project changes', onClick: () => { const it = M.saveToLibrary(fm.ref); toast(`Saved “${it.name}” to My library${it.flattened.length ? ` · ${it.flattened[0]} saved as its colour` : ''} · no project change`); } }, 'Save to My library'),
    h('button', { 'data-fid': 'edit-material', title: 'Exact values, maps, mapping — the same Finish, widened', onClick: () => setUi({ editor: { open: true } }) }, 'Edit material…'),
    h('button', { class: 'push', 'aria-label': 'More actions', 'aria-haspopup': 'menu', 'data-fid': 'more', onClick: (e) => moreMenu(e.currentTarget, fm) }, '⋯'));
}

function draftFoot(fm) {
  const D = U.draft;
  return h('div', { class: 'foot two' },
    h('div', { class: 'fr2' },
      h('button', { class: 'btn sm pri', disabled: !D.target || undefined, 'data-fid': 'draft-apply', title: D.target ? 'One undo step' : 'Click a surface first', onClick: () => {
        const ref = M.assignRecipe([D.target], D.base, D.ov, D.name, D.named, 'Apply');
        setUi({ draft: null, editor: { open: false }, focus: { target: D.target }, card: 'finish', reach: 'this', status: `Applied ${M.nameOf(ref)} to ${A.shortTarget(D.target)} · one undo` });
      } }, D.target ? 'Apply to ' + A.shortTarget(D.target) : 'Apply to…'),
      h('button', { class: 'btn sm', 'data-fid': 'draft-paint', onClick: () => { A.arm({ kind: 'recipe', base: D.base, ov: D.ov, name: fm.name }); setUi({ draft: null, editor: { open: false } }); } }, 'Use for Paint')),
    h('div', { class: 'fr2' },
      h('button', { 'data-fid': 'draft-save', onClick: () => { const it = M.saveRecipeToLibrary(D.base, D.ov, fm.name); toast(`Saved “${it.name}” to My library · no project change`); } }, 'Save to My library'),
      h('button', { class: 'push', 'data-fid': 'draft-cancel', onClick: () => setUi({ draft: null, editor: { open: false }, status: 'Draft cancelled · nothing written' }) }, 'Cancel')));
}

function diagStrip(ref, d) {
  const acts = d.channel === 'colour'
    ? [['Relink…', () => { M.repair(ref, d.id, 'relink'); toast(`Relinked ${d.file} from ~/Downloads (simulated)`); }], ['Replace image…', () => { M.repair(ref, d.id, 'replace'); toast('Replaced with client-tile_basecolor_v2.png (simulated)'); }], ['Use colour instead', () => M.repair(ref, d.id, 'off')]]
    : [['Use UV set 0', () => M.repair(ref, d.id, 'uv0')], ['Surface mapping', () => M.repair(ref, d.id, 'surface')]];
  return h('div', { class: 'diag', role: 'alert' }, h('b', {}, ic('warn', 14), d.channel === 'colour' ? 'Missing image' : 'Incompatible mapping'), h('div', {}, d.text), d.file ? h('div', { class: 'mono', style: { fontSize: '11px', overflowWrap: 'anywhere' } }, d.file) : null,
    h('div', { class: 'acts' }, acts.map(([l, fn], i) => h('button', { class: 'btn sm' + (i === 0 ? ' pri' : ''), onClick: fn }, l))),
    h('div', { class: 'note-sm', style: { color: '#6b4a0a' } }, 'Surfaces keep an amber hatch until repaired. Every repair is one undo.'));
}

function moreMenu(anchor, fm) {
  menuEl?.remove();
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu', style: { position: 'fixed', right: innerWidth - r.right + 'px', bottom: innerHeight - r.top + 6 + 'px' } });
  const item = (label, fn, disabled, title) => h('button', { role: 'menuitem', disabled: disabled || undefined, title, onClick: () => { close(); fn(); } }, label);
  const n = M.usersOf(fm.ref).length;
  const changes = F.changedGroups(fm);
  m.append(
    item('Rename…', () => { renaming = true; setUi({}); setTimeout(() => $('#card input.rn')?.select()); }, !fm.canRename, 'Curated names stay fixed'),
    item(`Select all using this Finish${n > 1 ? ` (${n})` : ''}`, () => setUi({ selectAll: true, reach: 'all' }), n < 2),
    item('Give this surface its own copy', () => { M.editFinish(fm.t, fm.ref, {}, 'this'); toast('This surface now has its own copy'); }, n < 2 || !fm.ref.startsWith('fin:')),
    item(changes.length ? `Reset to original (${changes.length})` : 'Reset to original', () => fm.edit(F.resetAllPatch(fm)), !changes.length, 'Nothing changed from the material'),
    h('hr'),
    item('Remove unused', () => M.removeUnused(fm.ref), true, 'Only unused Finishes can be removed — this one has users'));
  const close = () => { m.remove(); menuEl = null; document.removeEventListener('pointerdown', off, true); };
  const off = (e) => { if (!m.contains(e.target)) close(); };
  document.body.append(m); menuEl = m; setTimeout(() => document.addEventListener('pointerdown', off, true));
  m.querySelector('button:not([disabled])')?.focus();
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus(); } });
}
