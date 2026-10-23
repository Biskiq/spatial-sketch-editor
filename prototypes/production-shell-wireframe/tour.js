// Guided tours (wireframe chrome, not product): one step at a time, the relevant control
// spotlighted, Prev / Next, an optional "Show me" demonstration, and a check that lights Next
// when the step has actually been done.
import { $, S, M, R, H, esc, ent, findRaw, toPx, commit, undo, uid } from './core.js';
import * as SC from './scene.js';
import * as T from './tools.js';
import * as X from './exp.js';
import { render, setTool, selectId, loadScenario, setSheet, pinHeight, runCap } from './app.js';

const world = (id, pad = 34) => () => { const c = R.CENT[id]; if (!c) return null; const p = toPx(c), r = $('#stage').getBoundingClientRect(); return { x: r.left + p[0] - pad, y: r.top + p[1] - pad, w: pad * 2, h: pad * 2 }; };
const worldPt = (p, pad = 40) => () => { const q = R.CAM && R.CAM.P(p); if (!q || q[3]) return null; const s = toPx(q), r = $('#stage').getBoundingClientRect(); return { x: r.left + s[0] - pad, y: r.top + s[1] - pad, w: pad * 2, h: pad * 2 }; };
const tool = (t) => `.dock [data-act="tool"][data-v="${t}"]`;
const pal = (k, v) => `.pcol [data-k="${k}"][data-v="${v}"]`;
const handle = (h) => `#ovl [data-h="${h}"]`;
const fresh = (k = 'boathouse') => { loadScenario(k); Object.assign(S, { lens: 'world', reading: '3d', projection: 'axo', az: 35, tool: 'select', indexOpen: true, cmp: { ...S.cmp, index: 'scope', collapse: 'crumb', eraser: 'context', threshold: 'simple', edit: 'object', handles: 'progressive' } }); };
let base = {};

export const TOURS = [
  {
    id: 'sketch', t: 'Sketch, then pin a height', d: 'Ink pens, interpretation, the Sheet', setup() { fresh(); base.rooms = M.rooms.length; },
    steps: [
      { el: tool('ink'), title: 'Arm Ink', text: 'Ink is the one drawing pen. Its meaning comes from the surface the stroke lands on.', done: () => S.tool === 'ink', demo: () => setTool('ink') },
      { el: pal('inkTip', 'box'), title: 'Pick the Box pen', text: 'The palette is a small column right above the tool: Sketch, Line, Box, Round. No instructions to read.', done: () => S.inkTip === 'box', demo: () => (S.inkTip = 'box') },
      { el: worldPt([22, 3, 0], 70), title: 'Drag a box east of the studio', text: 'Corner to corner on the ground. It is read as a Room — walls rise to the next Level up.', done: () => M.rooms.length > base.rooms, demo: () => T.finishInk([[20, 1], [24, 1], [24, 5], [20, 5]], true) },
      { el: '.readchip', title: 'Re-read it as a platform', text: 'The chip appears only because a closed shape is ambiguous. Pick “Raised platform” (or press Tab).', done: () => M.rooms.some((r) => r.type === 'platform'), demo: () => { const i = S.readChip?.readings.findIndex((r) => r.make === 'platform'); if (i >= 0) T.reread(i); } },
      { el: '.hintb', title: 'Pin its height — once', text: 'A new raised surface makes a useful checkpoint. The hint is offered once, never as a dialog.', done: () => M.pins.some((p) => Math.abs(p.z - 0.45) < 0.02), demo: () => pinHeight(0.45) },
      { el: '#sheettrack', title: 'Read the Sheet', text: 'Long ticks are structural Levels, short ticks found surfaces, round heads your pins. Hover one for its name; drag the knob to 0.45.', done: () => Math.abs(S.sheet.h - 0.45) < 0.02, demo: () => setSheet(0.45) },
      { el: worldPt([22, 3, 0.45], 70), title: 'Draw on the platform', text: 'With the Sheet at 0.45, Sketch a line along the platform: walls stand on it, not on the ground.', done: () => M.walls.some((w) => Math.abs(w.base - 0.45) < 0.02), demo: () => { S.inkTip = 'line'; T.finishInk([[20.5, 4.5], [23.5, 4.5]], false); } },
    ],
  },
  {
    id: 'navigate', t: 'Find your way in a big building', d: 'Index models, collapse, Find', setup() { fresh('dense'); },
    steps: [
      { el: '.index', title: 'A dense project', text: '3 structures, 5 Levels, 40 rooms, 52 shared walls, 275 objects. The Index shows one scope at a time instead of every group at once.' },
      { el: '.ilist .irow:first-child', title: 'Go into the Main hall', text: 'Click a structure to go in. The breadcrumb above keeps the way back.', done: () => S.scope.st === 'st-main', demo: () => { S.scope = { st: 'st-main', lv: null, room: null }; } },
      { el: '.ilist', title: 'Go into the First floor', text: 'Entering a Level moves the Sheet to its floor and ghosts the other stories on the Stage.', done: () => S.scope.lv === 'lv-1', demo: () => runCap('goto:level:lv-1') },
      { el: '.facets', title: 'Show only objects on this floor', text: 'Facets flatten the scope: every object on First floor, with its room as context.', done: () => S.facet === 'object', demo: () => (S.facet = 'object') },
      { el: '.crumbs .sib', title: 'Jump to a sibling', text: 'Each breadcrumb segment switches siblings directly — another Level, another room — without climbing back up.', done: () => !!S.sibs, demo: () => (S.sibs = 'lv') },
      { el: '.ihead .iconbtn', title: 'Hide the Index', text: 'Collapsed, it disappears completely. No strip is left behind.', done: () => !S.indexOpen, demo: () => { S.sibs = null; S.indexOpen = false; } },
      { el: '.locchip', title: 'Your location stays in the Head', text: 'The crumb tells you where you are and brings the Index back (or press \\). Compare ▸ Collapsed Index shows the edge-peek alternative.', done: () => S.indexOpen, demo: () => (S.indexOpen = true) },
      { el: '#findbox', title: 'Find from the Head', text: 'Type “gallery 12”. Places say Go to (navigation); things say Select (selection) — two different verbs, never merged.', done: () => S.find.q.length > 2, demo: () => { S.find = { q: 'gallery 12', open: true, idx: 0 }; } },
      { el: '#wfbar-compare', title: 'Compare the outline tree', text: 'Wireframe ▸ Compare ▸ Index model B shows the same building as an expandable tree, capped and lazy.', done: () => S.cmp.index === 'tree', demo: () => { S.find.open = false; S.cmp.index = 'tree'; S.tree = new Set(['t:st-main', 't:lv-1']); } },
    ],
  },
  {
    id: 'objects', t: 'Arrange objects directly', d: 'Handles, support, Card precision', setup() { fresh(); },
    steps: [
      { el: world('b-bench'), title: 'Select the oak bench', text: 'Selection shows only a few handles: slide, turn on the floor ring, and scale.', done: () => S.sel === 'b-bench', demo: () => selectId('b-bench') },
      { el: handle('size'), title: 'Reveal the dimension handles', text: 'Click (don’t drag) the scale knob: width, depth and height arrows appear. Press S for the same.', done: () => S.sizeOpen === 'b-bench', demo: () => (S.sizeOpen = 'b-bench') },
      { el: handle('w'), title: 'Lengthen the bench', text: 'Drag the width arrow. A bench is parametric: it extends, its legs keep their size. The tag says “extend”.', done: () => findRaw('b-bench').w > 1.85, demo: () => { const b = findRaw('b-bench'); b.w = 2.6; b.x += 0.4; commit('Extend Oak bench'); } },
      { el: world('b-plinth'), title: 'Raise the plinth', text: 'Select the plinth, reveal its handles and drag the height arrow up. The base stays on the floor and the torso rides on top.', done: () => findRaw('b-plinth').h > 1.05, demo: () => { selectId('b-plinth'); S.sizeOpen = 'b-plinth'; T.carryRiders(findRaw('b-plinth'), 1.0, 1.3); findRaw('b-plinth').h = 1.3; commit('Raise Plinth'); } },
      { el: world('b-sculpt'), title: 'Scale the torso in proportion', text: 'A sculpture keeps its proportions with the corner knob. Its width and height arrows still work — nothing is locked by category.', done: () => Math.abs(findRaw('b-sculpt').h - 0.9) > 0.05, demo: () => { selectId('b-sculpt'); const t = findRaw('b-sculpt'); t.w *= 1.25; t.d *= 1.25; t.h *= 1.25; commit('Scale Torso'); } },
      { el: world('b-column'), title: 'Stretch an imported column', text: 'An imported Doric column stretches freely in height. Ordinary stretching is not semantic extension; the tag says which one you’re doing.', done: () => findRaw('b-column').h > 3.05, demo: () => { selectId('b-column'); findRaw('b-column').h = 4.2; commit('Raise Doric column'); } },
      { el: '#card .dims', title: 'Precise values in the Card', text: 'The Card is the one writer for these dimensions. Type a value, Enter commits; refusals stay in the field.', demo: () => {} },
    ],
  },
  {
    id: 'roof', t: 'Shape a roof', d: 'Edit its section without losing the building', setup() { fresh(); },
    steps: [
      { el: world('r-gal', 50), title: 'Select the gallery roof', text: 'Click the roof (X-ray overhead lets you see the room below it).', done: () => S.sel === 'r-gal', demo: () => selectId('r-gal') },
      { el: '#card [data-v="editshape"]', title: 'Edit its section', text: 'Or double-click the roof, or press Enter. The section is drawn on the roof itself, in the right local plane.', done: () => !!S.editShape, demo: () => T.openEditShape('r-gal') },
      { el: handle('j-1'), title: 'Drag the ridge joint', text: 'The 3D roof changes as you drag. Heights snap to the Sheet, pitch to 30°, 45°, 60° (⌥ for free).', done: () => Math.abs(findRaw('r-gal').prof[1][1] - 6.6) > 0.05, demo: () => { T.moveJoint(findRaw('r-gal'), 1, 3.4, 7.4, true); commit('Reshape Gallery roof'); } },
      { el: '#card .presets', title: 'Start from a preset', text: 'Mansard adds joints; drag any ＋ on the section to add your own, ⌥-click a joint to remove it.', done: () => findRaw('r-gal').prof.length > 3, demo: () => T.applyPreset(ent('r-gal'), 'mansard') },
      { el: '#wfbar-compare', title: 'Compare the other postures', text: 'Compare ▸ Edit shape: a floating section editor that expands for precision, or the Card editing posture. The Stage keeps the building either way.', done: () => S.cmp.edit !== 'object', demo: () => { S.cmp.edit = 'float'; if (S.editShape) S.editShape.pos = null; } },
      { el: '#stage', title: 'A long profile', text: 'The dense museum’s workshop has a 24 m sawtooth roof — try dragging single teeth, here and in the floating editor.', setup() { const c = { ...S.cmp }; fresh('dense'); S.cmp = { ...c }; S.reading = '3d'; T.openEditShape('r-ws'); } },
    ],
  },
  {
    id: 'slice', t: 'Slice and look inside', d: 'Live section, depth, side, Put back', setup() { fresh(); },
    steps: [
      { el: tool('slice'), title: 'Arm Slice', text: 'Slicing is drawn like a line, but it only changes how you look. Nothing in the building is edited.', done: () => S.tool === 'slice', demo: () => setTool('slice') },
      { el: worldPt([9, 3, 0], 80), title: 'Drag across the gallery', text: 'The cut previews live while you draw it.', done: () => !!S.slice && !S.slice.horizontal, demo: () => { S.slice = { a: [-30, 3.01], b: [40, 3], mid: [9, 3], flip: false, depth: 6 }; } },
      { el: handle('sl-depth'), title: 'Limit the inspection depth', text: 'Drag the depth arrow: what lies beyond it is ghosted.', done: () => S.slice && S.slice.depth !== 6, demo: () => (S.slice.depth = 2.5) },
      { el: handle('sl-flip'), title: 'Keep the other side', text: 'Click the arrow to flip which half you look into.', done: () => S.slice?.flip, demo: () => (S.slice.flip = true) },
      { el: '.pill.slice', title: 'Face the cut', text: 'A true section drawing, from the same Camera. Then Put back (or Esc) — the building was never touched.', done: () => !S.slice, demo: () => { S.slice = null; S.reading = '3d'; } },
    ],
  },
  {
    id: 'erase', t: 'Erase without fear', d: 'Immediate, bulk, and the rare review', setup() { fresh(); },
    steps: [
      { el: tool('eraser'), title: 'Arm the Eraser', text: 'Ready immediately: click erases one thing, scrubbing marks several. No filters to set first.', done: () => S.tool === 'eraser', demo: () => setTool('eraser') },
      { el: world('b-column'), title: 'Click the column', text: 'Gone at once — no dialog. The toast and ⌘Z bring it back.', done: () => !findRaw('b-column'), demo: () => T.eraseNow(['b-column'], [400, 300]) },
      { el: '.toast button, .head [data-act="undo"]', title: 'Undo it', text: 'Undo is one step for any erase, simple or bulk.', done: () => !!findRaw('b-column'), demo: () => undo() },
      { el: world('b-sculpt'), title: 'Click the torso', text: 'The torso is the subject of an Experience Presentation. Only cross-domain consequences like this interrupt.', done: () => !!S.confirm, demo: () => T.eraseNow(['b-sculpt'], [400, 300]) },
      { el: '.erasebar.bubble', title: 'Keep it', text: 'A small bubble next to the thing — not a modal. Keep.', done: () => !S.confirm, demo: () => { S.confirm = null; } },
      { el: pal('eraseMode', 'lasso'), title: 'Lasso a whole floor', text: 'Switch to Lasso. Now in the dense museum, loop around part of a floor: everything inside is marked red.', setup() { const c = { ...S.cmp }; fresh('dense'); S.cmp = { ...c }; setTool('eraser'); S.eraseMode = 'lasso'; S.reading = 'plan'; setSheet(4.5); }, done: () => !!S.erase, demo: () => { const ids = M.objects.filter((o) => o.level === 'lv-1' && o.x < 18 && o.y < 12).map((o) => o.id).concat(M.walls.filter((w) => w.level === 'lv-1' && w.a[0] < 18 && w.a[1] < 12 && w.b[0] <= 18 && w.b[1] <= 12).map((w) => w.id).slice(0, 6)); S.marked = new Set(ids); S.erase = { x: 420, y: 260, excl: new Set() }; } },
      { el: '.erasebar', title: 'Accept once', text: 'One bar, near your gesture: what goes, what is set aside, which rooms open. Click a kind chip to leave it out, then Erase (Enter).', done: () => !S.erase, demo: () => T.eraseApply() },
    ],
  },
  {
    id: 'paint', t: 'Paint and finish', d: 'Colour, material, scope, pick up', setup() { fresh(); },
    steps: [
      { el: tool('brush'), title: 'Arm the Brush', text: 'A permanent basic instrument, next to the Eraser.', done: () => S.tool === 'brush', demo: () => setTool('brush') },
      { el: '.swatchbtn', title: 'Load a colour or a material', text: 'Paint is just a colour; a material also carries texture and physical properties. The Brush carries one at a time.', done: () => S.brush.name !== 'Clay', demo: () => { S.brush = { ...S.brush, type: 'material', name: 'Limewash', color: '#ece6d6' }; } },
      { el: world('w-n1', 60), title: 'Brush across walls and floor', text: 'Click or drag across surfaces — each one you touch takes the finish, in one undo step.', done: () => Object.keys(M.finishes).length > 0, demo: () => { T.brushApply(['w-n1', 'room-gal']); commit('Paint 2 surfaces'); } },
      { el: '.pcol [data-act="brushscope"]', title: 'Whole-room scope', text: 'Switch to whole-room scope: one click finishes every wall of a room.', done: () => S.brush.scope === 'room', demo: () => (S.brush.scope = 'room') },
      { el: pal('brushMode', 'pick'), title: 'Pick up a finish', text: 'The dropper loads whatever a surface already has.', done: () => S.brushMode === 'pick', demo: () => (S.brushMode = 'pick') },
    ],
  },
  {
    id: 'exp', t: 'Author an Experience', d: 'Presentations, Look through, Guide, Preview', setup() { fresh(); },
    steps: [
      { el: '.head .seg', title: 'Switch to Experience', text: 'Same Head, Index, Stage and Card; only the tools and the task change.', done: () => S.lens === 'experience', demo: () => { S.lens = 'experience'; S.tool = 'select'; } },
      { el: '.index .ilist', title: 'Select “Torso”', text: 'A Presentation about a World subject, with its Views.', done: () => S.sel === 'p-torso', demo: () => selectId('p-torso') },
      { el: '#card .tbtn.pri', title: 'Look through its View', text: 'The Stage becomes the camera, framed in gold. Drag to re-aim.', done: () => !!S.lookThrough, demo: () => X.lookThrough('v-torso') },
      { el: '.pill.gold', title: 'Update or exit', text: 'Update View writes the new aim; Exit leaves it as it was.', done: () => !S.lookThrough, demo: () => { S.lookThrough = null; } },
      { el: '.dock [data-act="guide"]', title: 'Open the Guide', text: 'Stops and transitions above the dock. Play, scrub, Follow.', done: () => S.guideOpen, demo: () => (S.guideOpen = true) },
      { el: '.btn-preview', title: 'Preview it', text: 'The visitor view takes over. Try the Phone frame — visitors may be on phones even though the editor is not.', done: () => S.preview?.device === 'phone', demo: () => { S.preview = { i: 0, mode: 'guided', device: 'phone' }; } },
      { el: '.preview .exit', title: 'Exit Preview', text: 'Back exactly where you were.', done: () => !S.preview, demo: () => { S.preview = null; } },
    ],
  },
];

export function startTour(id) { const t = TOURS.find((x) => x.id === id); base = {}; t.setup(); S.tour = { id, i: 0 }; enter(); }
function enter() { const t = TOURS.find((x) => x.id === S.tour.id); const st = t.steps[S.tour.i]; st.setup?.(); render(); }
function go(d) { const t = TOURS.find((x) => x.id === S.tour.id); const i = S.tour.i + d; if (i < 0) return; if (i >= t.steps.length) { S.tour = null; return render(); } S.tour.i = i; enter(); }
function rectOf(el) {
  if (typeof el === 'function') return el();
  const n = document.querySelector(el); if (!n) return null; const r = n.getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: r.left, y: r.top, w: r.width, h: r.height };
}
export function renderTour() {
  const host = $('#tourlayer'); if (!S.tour) { host.innerHTML = ''; return; }
  const t = TOURS.find((x) => x.id === S.tour.id); const st = t.steps[S.tour.i];
  const r = rectOf(st.el); const ok = st.done ? !!st.done() : false; const n = t.steps.length;
  const pad = 6; let ring = '';
  if (r) ring = `<div class="tring${ok ? ' ok' : ''}" style="left:${r.x - pad}px;top:${r.y - pad}px;width:${r.w + pad * 2}px;height:${r.h + pad * 2}px"></div>`;
  const W = 300, Hc = 170, vw = window.innerWidth, vh = window.innerHeight;
  let x = 16, y = vh - Hc - 16;
  if (r) { x = r.x + r.w + 18; y = r.y; if (x + W > vw - 12) x = r.x - W - 18; if (x < 12) { x = clamp(r.x, 12, vw - W - 12); y = r.y + r.h + 16 > vh - Hc ? r.y - Hc - 16 : r.y + r.h + 16; } y = clamp(y, 40, vh - Hc - 12); }
  host.innerHTML = `${ring}<div class="tourcard" style="left:${x}px;top:${y}px;width:${W}px"><div class="tk"><span>${esc(t.t)}</span><span>${S.tour.i + 1} / ${n}</span><button data-tour="close" title="End the tour">✕</button></div><h5>${ok ? '✓ ' : ''}${esc(st.title)}</h5><p>${esc(st.text)}</p><div class="tdots">${t.steps.map((_, k) => `<i class="${k < S.tour.i ? 'past' : k === S.tour.i ? 'on' : ''}"></i>`).join('')}</div><div class="tb"><button data-tour="prev" ${S.tour.i ? '' : 'disabled'}>‹ Prev</button>${st.demo && !ok ? `<button data-tour="demo">Show me</button>` : ''}<span class="sp"></span><button data-tour="next" class="${ok || !st.done ? 'go' : ''}">${S.tour.i === n - 1 ? 'Finish' : 'Next ›'}</button></div>${!r && st.el && !ok ? '<div class="tmiss">(The highlighted control isn’t on screen yet — try “Show me”.)</div>' : ''}</div>`;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tour]'); if (!b) return;
  const k = b.dataset.tour; const t = TOURS.find((x) => x.id === S.tour.id); const st = t.steps[S.tour.i];
  if (k === 'close') { S.tour = null; render(); }
  if (k === 'prev') go(-1);
  if (k === 'next') go(1);
  if (k === 'demo') { st.demo(); render(); }
});
window.addEventListener('resize', () => renderTour());
