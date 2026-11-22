/*
 * Shell: head, index, bar, dock, Stage wiring, keyboard, tasks and presets.
 * Recommended direction — Tray Paint (Brush · Surface · Space) + Library asset sheet + the Finish
 * Card that widens into the Material editor (see index.html).
 */
import * as M from './model.js';
import { U, setUi, onUi } from './ui-state.js';
import { createStage, TARGETS, SUBJECTS, scopeTargets, setView, getView } from './stage.js';
import * as T from './thumbs.js';
import { CATALOGUE } from '../shared/catalogue.js';
import { $, h, ic, swatch, toast } from './ui-kit.js';
import * as A from './actions.js';
import { renderTray, trayRowItems, pickFromItem } from './ui-tray.js';
import { renderLibrary } from './ui-library.js';
import { renderCard, cardSelection } from './ui-card.js';
import { renderImporter, renderPicker } from './ui-panels.js';
import { renderAlign } from './ui-align.js';
import * as F from './finish.js';

const qs = new URLSearchParams(location.search);

// ------------------------------------------------------------------ head
function renderHead() {
  const el = $('#head'); el.innerHTML = '';
  const proj = h('button', { class: 'proj', 'aria-haspopup': 'menu', title: 'Switch project (transfer task)', onClick: (e) => projectMenu(e.currentTarget) }, M.PROJECTS[M.S.projectId], ic('more', 14));
  const issues = M.anyDiagnostics() ? h('button', { class: 'hb issues', onClick: () => setUi({ issuesOpen: !U.issuesOpen, tasksOpen: false }), 'aria-pressed': String(U.issuesOpen), title: 'Appearance issues' }, ic('warn', 15), h('span', { class: 'lbl' }, `${countIssues()} to repair`)) : null;
  el.append(...[
    h('button', { class: 'hb idxb', 'aria-pressed': String(U.indexOpen), title: 'Index', onClick: () => setUi({ indexOpen: !U.indexOpen }) }, ic('layers', 16)),
    h('span', { class: 'brand' }, 'Biskiq'), proj,
    h('span', { class: 'status' }, U.status || 'Appearance study · simulated project, real S8 texture bytes'),
    M.EPHEMERAL ? h('a', { class: 'tag fut', href: location.pathname, title: 'Task presets start fresh and are never saved. Click to open your saved prototype instead.', style: { textDecoration: 'none' } }, 'Preset · not saved') : null,
    issues,
    h('button', { class: 'hb', disabled: !M.S.history.length, title: `Undo ${M.S.history.at(-1)?.label || ''} (Ctrl+Z)`, onClick: M.undo }, ic('undo', 16), h('span', { class: 'lbl' }, 'Undo')),
    h('button', { class: 'hb', disabled: !M.S.future.length, title: 'Redo (Ctrl+Shift+Z)', onClick: M.redo }, h('span', { style: { display: 'inline-grid', transform: 'scaleX(-1)' } }, ic('undo', 16))),
    h('button', { class: 'hb', 'aria-pressed': String(U.tasksOpen), onClick: () => setUi({ tasksOpen: !U.tasksOpen, issuesOpen: false }) }, ic('check', 16), h('span', { class: 'lbl' }, 'Tasks'))
  ].filter(Boolean));
}
const countIssues = () => Object.values(M.S.p.finishes).reduce((n, f) => n + (f.diag || []).filter((d) => !d.fixed).length, 0);

function projectMenu(anchor) {
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu', style: { left: r.left + 'px', top: r.bottom + 4 + 'px', position: 'fixed' } });
  for (const [id, name] of Object.entries(M.PROJECTS)) m.append(h('button', { role: 'menuitem', onClick: () => { close(); if (id !== M.S.projectId) { M.switchProject(id); setUi({ focus: null, status: `${name} · nothing here links to the other project` }); toast(`Opened ${name}. Finishes are per project; only your library travels.`); } } }, id === M.S.projectId ? ic('check', 14) : h('span', { style: { width: '14px' } }), name));
  m.append(h('hr'), h('button', { role: 'menuitem', onClick: () => { close(); M.resetAll(); } }, ic('undo', 14), 'Reset prototype (clears saved state)'));
  const close = () => { m.remove(); document.removeEventListener('pointerdown', off, true); };
  const off = (e) => { if (!m.contains(e.target)) close(); };
  document.body.append(m); setTimeout(() => document.addEventListener('pointerdown', off, true)); m.querySelector('button').focus();
}

// ------------------------------------------------------------------ index
// Hierarchy only: subjects and their parts, nested. A small swatch ends each row; Finish names
// live on the Card and in Library › This project. Gold marks the selection, nothing else.
function renderIndex() {
  const el = $('#index'); el.innerHTML = '';
  const sel = new Set(cardSelection().selected || []);
  const subjectOn = (sid) => U.focus && U.card === 'subject' && TARGETS[U.focus.target].subject === sid;
  el.append(h('h6', {}, 'Index', h('span', {}, 'Riverside · Living')));
  const groups = [['Walls', ['wall-n', 'wall-w', 'wall-e', 'wall-s', 'part']], ['Floors', ['floor']], ['Objects', ['sofa', 'table', 'rug', 'chair']]];
  const end = (t) => [M.openDiagnostics(M.S.p.assign[t]).length ? h('i', { class: 'warnd', title: 'Needs repair' }) : null, h('span', { class: 'isw', style: { backgroundImage: `url(${T.url(M.look(M.S.p.assign[t]), 'xs', 64)})` }, title: M.nameOf(M.S.p.assign[t]) })];
  const hover = (ts) => ({ onPointerenter: () => A.getStage()?.set({ hover: ts, ghostLook: null }), onPointerleave: () => A.getStage()?.set({ hover: [] }) });
  for (const [g, subs] of groups) {
    el.append(h('div', { class: 'ixg' }, g));
    for (const sid of subs) {
      const S = SUBJECTS[sid];
      if (S.targets.length === 1) {
        const t = S.targets[0];
        el.append(h('button', { class: 'ix' + (sel.has(t) ? ' on' : ''), 'data-fid': 'ix-' + t, onClick: () => { A.focus(t, 'finish'); setUi({ indexOpen: false }); }, ...hover([t]) },
          h('span', { class: 'ind' }), ic(S.kind === 'floor' ? 'floor' : S.kind === 'wall' ? 'wall' : 'object', 14), h('span', { class: 'nm' }, S.label), ...end(t)));
        continue;
      }
      el.append(h('button', { class: 'ix' + (subjectOn(sid) ? ' on' : ''), 'data-fid': 'ix-' + sid, 'aria-expanded': 'true', onClick: () => { A.focus(S.targets[0], 'subject'); setUi({ indexOpen: false }); }, ...hover(S.targets) },
        h('span', { class: 'ind' }, '▾'), ic(S.kind === 'wall' ? 'wall' : 'object', 14), h('span', { class: 'nm' }, S.label), S.kind === 'model' ? h('span', { class: 'sub' }, 'model') : null));
      for (const t of S.targets) {
        el.append(h('button', { class: 'ix kid' + (sel.has(t) && !subjectOn(sid) ? ' on' : ''), 'data-fid': 'ix-' + t, onClick: () => { A.focus(t, 'finish'); setUi({ indexOpen: false }); }, ...hover([t]) },
          h('span', { class: 'nm' }, TARGETS[t].side.split(' · ')[0]), ...end(t)));
      }
    }
  }
  el.append(h('p', { class: 'note-sm', style: { margin: '14px 6px 0' } }, 'Finishes in use: Library › This project. Palette: Paint › More.'));
}

// ------------------------------------------------------------------ bar
let barMsg = '';
function renderBar() {
  const el = $('#bar'); el.innerHTML = '';
  const tool = { select: 'Select', paint: 'Paint', erase: 'Erase' }[U.tool];
  const hint = U.dropper ? 'Click a surface to sample its Finish · Esc cancels'
    : U.draft ? 'Draft · click a surface to preview it there · nothing is written until Apply'
    : U.tool === 'select' ? 'Click a surface · Esc or an empty click deselects · B paints'
      : 'Hover to preview · click or drag · Alt-click samples · Shift paints the whole Space';
  el.append(h('span', { class: 'tool' }, U.dropper ? 'Sample' : tool), h('span', { class: 'div' }), h('span', { class: 'msg', html: barMsg || hint }), h('span', { class: 'div' }),
    h('button', { class: 'vb', title: 'Turn view left ([)', 'aria-label': 'Turn view left', onClick: () => turn(-1) }, ic('undo', 16)),
    h('button', { class: 'vb', title: 'Turn view right (])', 'aria-label': 'Turn view right', onClick: () => turn(1) }, h('span', { style: { display: 'inline-grid', transform: 'scaleX(-1)' } }, ic('undo', 16))));
}
function turn(d) { setView(getView() + d); stage.render(); }

// ------------------------------------------------------------------ dock
function renderDock() {
  const el = $('#dock'); el.innerHTML = '';
  const key = (job, label, kbd, pressed, onClick, extra = {}) => h('button', { class: 'dk' + (extra.dim ? ' dim' : ''), 'aria-pressed': pressed === null ? undefined : String(pressed), title: extra.title || `${label}${kbd ? ' (' + kbd + ')' : ''}`, onClick }, ic(job, 20), h('span', {}, label), kbd ? h('span', { class: 'lk' }, kbd) : null, extra.live || null);
  const live = h('i', { class: 'live ' + (U.pick.kind === 'colour' ? 'c' : 'm') });
  if (U.pick.kind === 'colour') live.style.background = A.pickHex(U.pick);
  else live.style.backgroundImage = `url(${T.url(A.resultLook('floor', U.pick, 'paint'), 'xs', 64)})`;
  const other = (job, label) => key(job, label, '', null, () => toast(`${label} is outside this study`), { dim: true, title: `${label} — outside this study` });
  el.append(
    key('select', 'Select', 'V', U.tool === 'select', () => setTool('select')), h('span', { class: 'div' }),
    other('build', 'Build'), other('form', 'Form'), other('landscape', 'Landscape'),
    key('furnish', 'Furnish', '', U.library.open && U.library.kind === 'objects', () => (U.library.open && U.library.kind === 'objects' ? setUi({ library: { open: false } }) : A.openLibrary('pick', { kind: 'objects' })), { title: 'Furnish — opens the Library on Objects (placement is outside this study)' }), h('span', { class: 'div' }),
    key('paint', 'Paint', 'B', U.tool === 'paint', () => setTool(U.tool === 'paint' ? 'select' : 'paint'), { live }),
    key('erase', 'Erase', 'E', U.tool === 'erase', () => setTool(U.tool === 'erase' ? 'select' : 'erase')), h('span', { class: 'div' }),
    key('library', 'Library', 'L', U.library.open, toggleLibrary)
  );
}
function toggleLibrary() { U.library.open ? setUi({ library: { open: false } }) : A.openLibrary(U.focus && U.tool === 'select' ? 'apply' : 'pick'); }
function setTool(tool) { setUi({ tool, dropper: false, trayOpen: tool === 'paint' ? U.trayOpen : false, status: tool === 'paint' ? `Paint armed · ${A.pickName(U.pick)}` : '' }); }

// ------------------------------------------------------------------ drawer: tasks + issues
const TASKS = [
  { id: 'walnut', title: '1 · Walnut wall, then a sheen change', who: 'Everyday creator',
    steps: ['B arms Paint; open Materials (T) — or Browse all › Wood', 'Pick Walnut Veneer; hover the North wall to see the cobalt ghost', 'Click the wall — the Card follows it', 'Sheen › Satin (the dot marks the original step)', 'Ctrl+Z once: the sheen goes, the walnut stays'] },
  { id: 'artist', title: '2 · Correct a gloss/ORM set, compare, re-scale one', who: 'Material artist',
    steps: ['Import (Tasks › Set up) — Gloss and ORM.G both claim roughness: choose one', 'Acknowledge the +Y normal test, set 1.2 m real size', 'Register on the three selected wall surfaces (Layout kind)', 'Card › Edit material… › Grazing light, Compare with original, View › Relief', 'Partition · Side A › This side › Pattern 0.6 m exact (or Align on wall…)'] },
  { id: 'transfer', title: '3 · Move it to another project', who: 'Material artist',
    steps: ['On the Rough Oak Card: Save to My library (no project history)', 'Head › switch to Gallery studio', 'L › My library › Rough Oak ⤢: read “what travels”', 'Use for Paint, or Customise… to adjust it first (nothing is written)', 'The new Finish is independent — edits never reach Riverside'] },
  { id: 'repair', title: '4 · Repair a missing image and a model mismatch', who: 'Anyone reopening a project',
    steps: ['Set up opens the “client” state: amber hatch on two walls and the chair frame', 'Head › 2 to repair lists each issue with its surfaces', 'Client Tile: Relink, Replace, or Use colour instead', 'Client Oak on the chair: Use UV set 0 or Surface mapping', 'Hatch clears; Undo restores the issue exactly'] }
];
const CHECKS = ['Library draft: L › any material ⤢ › Customise… — cobalt ghost on the selected surface; click another surface to move it; Apply is one undo', 'Align on wall: Card › Pattern › Align on wall… — ruler, repeat grid, offset and rotation handles', 'Brush (future): Paint › Brush shows its tools and options rows; E picks its eraser', 'Cold reopen: in app.html without ?scene (presets are never saved), edit, then reload — Finishes, names and palette return; thumbnails regenerate from recipes', 'Cancel: Esc mid-drag drops the stroke; Esc closes the top surface first', 'Keyboard: B, T, 1–9, Enter on Stage focus, Tab through Card rows, arrows on sliders (bursts coalesce)', 'Coarse pointer: long-press samples; 44 px targets; drag paints', 'Narrow: open board.html for 820 × 1180 iPad portrait'];

function renderDrawer() {
  const el = $('#drawer');
  el.hidden = !(U.tasksOpen || U.issuesOpen); if (el.hidden) return;
  el.innerHTML = '';
  el.append(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('h2', {}, U.tasksOpen ? 'Validation tasks' : 'Appearance issues'), h('button', { class: 'cp-x', 'aria-label': 'Close', onClick: () => setUi({ tasksOpen: false, issuesOpen: false }) }, '×')));
  if (U.issuesOpen) {
    for (const f of Object.values(M.S.p.finishes)) for (const d of (f.diag || [])) {
      const ref = 'fin:' + f.id, users = M.usersOf(ref);
      el.append(h('div', { class: 'diag' + (d.fixed ? ' fixed' : '') }, h('b', {}, ic(d.fixed ? 'check' : 'warn', 14), f.name), h('div', {}, d.fixed ? `Repaired (${d.fixed})` : d.text), h('div', { class: 'note-sm' }, users.map(A.shortTarget).join(', ') || 'No users'),
        !d.fixed && users[0] ? h('div', { class: 'acts' }, h('button', { class: 'btn sm', onClick: () => { A.focus(users[0], 'finish'); setUi({ issuesOpen: false }); } }, 'Open its Card')) : null));
    }
    return;
  }
  el.append(h('p', { class: 'note' }, 'The four journeys from the brief. “Set up” loads a start state; everything stays undoable. Presets: ?scene=walnut|artist|transfer|repair.'));
  for (const t of TASKS) {
    el.append(h('div', { class: 'task' }, h('h4', {}, h('span', {}, t.title), h('a', { class: 'btn sm pri', href: '?scene=' + t.id, title: 'Starts this task from a fresh project (not saved)' }, 'Set up')), h('div', { class: 'note-sm' }, t.who), h('ol', {}, t.steps.map((s) => h('li', {}, s)))));
  }
  el.append(h('h3', {}, 'Also covered'), h('ul', { class: 'note' }, CHECKS.map((c) => h('li', {}, c))));
}

// ------------------------------------------------------------------ presets
function setup(id) {
  setUi({ tasksOpen: false, issuesOpen: false, focus: null, library: { open: false }, editor: { open: false }, draft: null, align: null, importer: { open: false }, picker: null });
  if (id === 'walnut') { if (M.S.projectId !== 'riverside') M.switchProject('riverside'); setUi({ tool: 'paint', trayTab: 'materials', pick: { kind: 'material', ref: 'cat:wood-walnut-veneer' }, status: 'Task 1 · Walnut is picked — click the North wall' }); }
  if (id === 'artist') { if (M.S.projectId !== 'riverside') M.switchProject('riverside'); setUi({ tool: 'select', importer: { open: true, targets: ['wall-n:a', 'wall-w:a', 'part:a'] }, status: 'Task 2 · Import with three wall faces selected' }); }
  if (id === 'transfer') {
    if (M.S.projectId !== 'riverside') M.switchProject('riverside');
    let ref = Object.values(M.S.p.finishes).find((f) => f.origin === 'import');
    if (!ref) { M.registerImport({ name: 'Rough Oak', set: 'rough-oak', ov: { rough: 0.8, tile: 1.2 }, maps: { colour: 'RoughOak_Color.jpg', normal: 'RoughOak_Normal.png', orm: 'RoughOak_ORM.png' } }, ['wall-n:a', 'wall-w:a', 'part:a'], (t) => TARGETS[t].kind); ref = Object.values(M.S.p.finishes).find((f) => f.origin === 'import'); }
    A.focus(M.usersOf('fin:' + ref.id)[0], 'finish'); setUi({ status: 'Task 3 · Save to library from the Card foot, then switch project' });
  }
  if (id === 'repair') { if (M.S.projectId !== 'riverside') M.switchProject('riverside'); M.seedRepair(); setUi({ issuesOpen: true, status: 'Task 4 · Two Finishes need repair on open' }); }
}

// ------------------------------------------------------------------ render loop
let stage;
let raf = 0, stageDirty = false;
function schedule(stageToo = true) { stageDirty = stageDirty || stageToo; if (!raf) raf = requestAnimationFrame(flush); }
function flush() {
  raf = 0;
  const fid = document.activeElement?.dataset?.fid;
  document.body.className = `t-${U.tool}${U.dropper ? ' dropper' : ''}${U.indexOpen ? ' idx-open' : ''}${U.focus || U.draft ? '' : ' nocard'}${U.editor.open && (U.focus || U.draft) ? ' editing' : ''}${U.align ? ' aligning' : ''}${U.scope === 'brush' && U.tool === 'paint' ? ' brushing' : ''}`;
  renderHead(); renderIndex(); renderBar(); renderDock(); renderTray(); renderCard(); renderLibrary(); renderImporter(); renderPicker(); renderDrawer(); renderAlign();
  const trayEl = $('#tray');
  document.documentElement.style.setProperty('--tray-h', trayEl.hidden ? '0px' : trayEl.offsetHeight + 8 + 'px');
  // narrow: a sheet (Library) or the expanded tray folds the Card to its identity row (Light & Sky rule)
  const narrow = innerWidth <= 860;
  document.body.classList.toggle('fold', narrow && (U.library.open || U.trayOpen));
  $('#scrim').hidden = !(U.importer.open || (narrow && U.library.open));
  if (stageDirty) { stage.render(); stageDirty = false; }
  syncStage();
  if (fid) document.querySelector(`[data-fid="${CSS.escape(fid)}"]`)?.focus();
}
export function syncStage() {
  const s = cardSelection();
  stage.set({ selected: s.selected, users: s.users, usersMode: s.usersMode, draft: F.draftGhost() });
}

// ------------------------------------------------------------------ boot
async function boot() {
  await T.preload(CATALOGUE);
  stage = createStage($('#stage'), {
    hover(t) {
      if (!t) { barMsg = ''; stage.set({ hover: [] }); renderBar(); return; }
      if (U.draft && !U.dropper) { barMsg = `Click: preview the draft on <b>${A.shortTarget(t)}</b> · nothing is written`; stage.set({ hover: [t], ghostLook: null }); renderBar(); return; }
      if (U.tool === 'paint' && U.scope === 'brush') { barMsg = 'Brush is a future tool — strokes would land on part of this surface · B returns to Surface'; stage.set({ hover: [t], ghostLook: null }); renderBar(); return; }
      if (U.dropper || U.tool === 'select') { barMsg = U.dropper ? `Click: sample <b>${M.nameOf(M.S.p.assign[t])}</b> from ${A.shortTarget(t)}` : `<b>${A.shortTarget(t)}</b> · ${M.nameOf(M.S.p.assign[t])}`; stage.set({ hover: [t], ghostLook: null }); }
      else { barMsg = A.consequence(t); stage.set({ hover: scopeTargets(t, U.scope), ghostLook: (x) => A.resultLook(x) }); }
      renderBar();
    },
    empty() { if (U.tool === 'select' && !U.dropper && !U.draft) A.focus(null); },
    pick(t) { A.sample(t); },
    strokeStart(t) {
      if (U.dropper) { A.sample(t); return false; }
      if (U.draft) return false;
      if (U.tool === 'paint' && U.scope === 'brush') { toast('Brush is a future tool · B returns to Surface'); return false; }
      return U.tool === 'paint' || U.tool === 'erase';
    },
    stroke(list) { stage.set({ hover: [...new Set(list.flatMap((t) => scopeTargets(t, U.scope)))], ghostLook: (x) => A.resultLook(x) }); },
    strokeEnd(list) { stage.set({ hover: [] }); A.commitPaint(list); },
    strokeCancel() { stage.set({ hover: [] }); },
    click(t) {
      if (U.dropper) return;
      if (U.draft) { setUi({ draft: { target: t }, status: `Draft previewing on ${A.shortTarget(t)} · nothing is written` }); return; }
      if (U.tool === 'paint' && U.scope === 'brush') return;
      A.focus(t, SUBJECTS[TARGETS[t].subject].targets.length > 1 ? 'subject' : 'finish');
    }
  });
  A.bindStage(stage);
  M.on((type) => { if (type === 'preview') { stage.render(); renderCardThumbOnly(); } else schedule(true); });
  onUi((why) => schedule(why === 'arm' || why === 'tool' || why.includes('tool')));
  window.addEventListener('resize', () => schedule(false));
  window.addEventListener('keydown', onKey);
  // URL presets for board.html and reviewers
  const scene = qs.get('scene'); if (scene) setup(scene);
  if (qs.get('tool')) setUi({ tool: qs.get('tool') });
  if (qs.get('tab')) setUi({ trayTab: qs.get('tab') });
  if (qs.get('tray') === 'open') setUi({ trayOpen: true });
  if (qs.get('focus') && TARGETS[qs.get('focus')]) A.focus(qs.get('focus'), qs.get('card') || 'finish');
  if (qs.get('scope')) setUi({ scope: qs.get('scope') });
  if (qs.get('brushTool')) setUi({ brushTool: qs.get('brushTool') });
  if (qs.get('lib')) A.openLibrary(qs.get('intent') || 'pick', { source: qs.get('lib'), kind: qs.get('kind') || 'materials', detail: qs.get('detail') || null });
  if (qs.get('edit') && TARGETS[qs.get('edit')]) { A.focus(qs.get('edit'), 'finish'); setUi({ editor: { open: true, ...(qs.get('compare') ? { compare: true } : {}), ...(qs.get('light') ? { light: qs.get('light') } : {}) } }); }
  if (qs.get('align') && TARGETS[qs.get('align')]) { A.focus(qs.get('align'), 'finish'); setUi({ align: { target: qs.get('align') } }); }
  if (qs.get('draft')) { const id = qs.get('draft'); setUi({ draft: { base: { catalogue: id }, ov: {}, name: '', named: false, target: U.focus?.target || null, src: 'cat:' + id, preview: null } }); }
  if (qs.get('selectAll')) setUi({ selectAll: true, reach: 'all' });
  if (qs.get('view')) setView(+qs.get('view'));
  if (M.S.restored && !scene) toast('Reopened your saved prototype state · head › project › Reset clears it');
  schedule(true);
}
function renderCardThumbOnly() {
  const k = document.querySelector('#card .kind.img'); const fm = F.finishModel(); if (!k || !fm) return;
  k.style.backgroundImage = `url(${T.url(fm.L, 'xs', 64)})`;
}

// ------------------------------------------------------------------ keyboard
function onKey(e) {
  const inField = e.target.matches?.('input[type=text],input[type=search],input:not([type]),textarea,.fld');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); e.shiftKey ? M.redo() : M.undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); M.redo(); return; }
  if (e.key === 'Escape') {
    if (stage.strokeActive) { stage.cancelStroke(); stage.set({ hover: [] }); setUi({ status: 'Stroke cancelled · nothing written' }); return; }
    if (inField) return;
    if (A.closeTransient()) return;
    if (U.focus) { A.focus(null); return; }
    if (U.tool !== 'select') { setTool('select'); return; }
    return;
  }
  if (inField || mod || e.altKey) return;
  const k = e.key.toLowerCase();
  // B arms Paint; inside Paint it toggles Brush and Surface. E inside Brush is Brush's own eraser.
  if (k === 'b') { if (U.tool !== 'paint') setTool('paint'); else setUi({ scope: U.scope === 'brush' ? 'surface' : 'brush' }); }
  else if (k === 'e') { if (U.tool === 'paint' && U.scope === 'brush') setUi({ brushTool: U.brushTool === 'erase' ? 'brush' : 'erase' }); else setTool(U.tool === 'erase' ? 'select' : 'erase'); }
  else if (k === 'v') setTool('select');
  else if (k === 'l') toggleLibrary();
  else if (k === 'i') setUi({ dropper: !U.dropper });
  else if (k === 't' && U.tool === 'paint') setUi({ trayTab: U.trayTab === 'colours' ? 'materials' : 'colours' });
  else if (k === 's' && U.tool === 'paint') setUi({ scope: U.scope === 'space' ? 'surface' : 'space' });
  else if (k === '[') turn(-1);
  else if (k === ']') turn(1);
  else if (/^[1-9]$/.test(k) && U.tool === 'paint') { const it = trayRowItems()[+k - 1]; if (it) pickFromItem(it); }
  else return;
  e.preventDefault();
}

boot();
