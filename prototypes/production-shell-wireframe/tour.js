// Guided tours (wireframe chrome, not product): one step at a time, the relevant control
// spotlighted, Prev / Next, an optional "Show me" demonstration, and a check that lights Next
// when the step has actually been done.
import { $, S, M, R, H, esc, ent, findRaw, toPx, commit, undo, uid, CMP0 } from './core.js';
import * as SC from './scene.js';
import * as T from './tools.js';
import * as X from './exp.js';
import { render, setTool, selectId, loadScenario, setSheet, pinHeight, runCap } from './app.js';

const world = (id, pad = 34) => () => { const c = R.CENT[id]; if (!c) return null; const p = toPx(c), r = $('#stage').getBoundingClientRect(); return { x: r.left + p[0] - pad, y: r.top + p[1] - pad, w: pad * 2, h: pad * 2 }; };
const worldPt = (p, pad = 40) => () => { const q = R.CAM && R.CAM.P(p); if (!q || q[3]) return null; const s = toPx(q), r = $('#stage').getBoundingClientRect(); return { x: r.left + s[0] - pad, y: r.top + s[1] - pad, w: pad * 2, h: pad * 2 }; };
const tool = (t) => `.dock [data-act="tool"][data-v="${t}"]`;
const pal = (k, v) => `.pcol [data-k="${k}"][data-v="${v}"]`;
const handle = (h) => `#ovl [data-h="${h}"]`;
const fresh = (k = 'boathouse') => { loadScenario(k); Object.assign(S, { lens: 'world', reading: '3d', projection: 'axo', az: 35, tool: 'select', indexOpen: true, palOpen: true, inkShape: false, cmp: { ...CMP0 } }); for (const x of Object.keys(S.eraseFilter)) S.eraseFilter[x] = true; };
let base = {};

export const TOURS = [
  {
    id: 'sketch', t: 'Sketch, then pin a height', d: 'Ink pens, interpretation, the Sheet', setup() { fresh(); base.rooms = M.rooms.length; },
    steps: [
      { el: tool('ink'), title: 'Arm Ink', text: 'Ink is the one drawing pen. Its meaning comes from the surface the stroke lands on.', done: () => S.tool === 'ink', demo: () => setTool('ink') },
      { el: pal('inkTip', 'box'), title: 'Pick the Box pen', text: 'The palette is a small column right above the tool: Sketch, Line, Box, Round. Picking one keeps the palette open.', done: () => S.inkTip === 'box', demo: () => (S.inkTip = 'box') },
      { el: tool('ink'), title: 'Collapse the palette', text: 'Click Ink again (or the small chevron, or Esc). The tool stays armed with Box remembered; a faint caret says the palette is there.', done: () => S.tool === 'ink' && !S.palOpen, demo: () => (S.palOpen = false) },
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
      { el: '.index:not(.gone)', title: 'A dense project', text: '3 structures, 5 Levels, 40 rooms, 52 shared walls, 275 objects. The Index shows one scope at a time instead of every group at once.' },
      { el: '.ilist .irow:first-child', title: 'Go into the Main hall', text: 'Click a structure to go in. The breadcrumb above keeps the way back.', done: () => S.scope.st === 'st-main', demo: () => { S.scope = { st: 'st-main', lv: null, room: null }; } },
      { el: '.ilist', title: 'Go into the First floor', text: 'Entering a Level moves the Sheet to its floor and ghosts the other stories on the Stage.', done: () => S.scope.lv === 'lv-1', demo: () => runCap('goto:level:lv-1') },
      { el: '.facets', title: 'Show only objects on this floor', text: 'Facets flatten the scope: every object on First floor, with its room as context.', done: () => S.facet === 'object', demo: () => (S.facet = 'object') },
      { el: '.crumbs .sib', title: 'Jump to a sibling', text: 'Each breadcrumb segment switches siblings directly — another Level, another room — without climbing back up.', done: () => !!S.sibs, demo: () => (S.sibs = 'lv') },
      { el: '.ihead .iconbtn', title: 'Hide the Index', text: 'Collapsed, it disappears completely. No strip is left behind.', done: () => !S.indexOpen, demo: () => { S.sibs = null; S.indexOpen = false; } },
      { el: '.locchip', title: 'Your location stays in the Head', text: 'The chip tells you where you are and brings the Index back (or press \\).', done: () => S.indexOpen, demo: () => (S.indexOpen = true) },
      { el: '#findbox', title: 'Find from the Head', text: 'Type “gallery 12”. Places say Go to (navigation); things say Select (selection) — two different verbs, never merged.', done: () => S.find.q.length > 2, demo: () => { S.find = { q: 'gallery 12', open: true, idx: 0 }; } },
      { el: '#wfbar-compare', title: 'Compare the edge arrow', text: 'Compare ▸ Collapsed Index B leaves no chip: a translucent arrow appears at the left edge on hover or focus, and on touch a tap on the edge opens the Index.', done: () => S.cmp.collapse === 'peek', demo: () => { S.find.open = false; S.cmp.collapse = 'peek'; S.indexOpen = false; S.peek = true; } },
    ],
  },
  {
    id: 'objects', t: 'Arrange objects directly', d: 'Handles, support, Card precision', setup() { fresh(); },
    steps: [
      { el: world('b-bench'), title: 'Select the oak bench', text: 'Gold says what is selected. Thin white dashes say what you can change: the floor ring turns it, the cross slides it, the small corner point scales it.', done: () => S.sel === 'b-bench', demo: () => selectId('b-bench') },
      { el: handle('size'), title: 'Reveal width, depth and height', text: 'Click (don’t drag) the scale point: dashed rays leave each face and the top. Press S for the same. Hover a ray to read its value.', done: () => S.sizeOpen === 'b-bench', demo: () => (S.sizeOpen = 'b-bench') },
      { el: handle('w'), title: 'Lengthen the bench', text: 'Drag a width ray: that face moves, the other stays. A bench is parametric, so it extends and its legs keep their size.', done: () => findRaw('b-bench').w > 1.85, demo: () => { const b = findRaw('b-bench'); b.w = 2.6; b.x += 0.4; commit('Extend Oak bench'); } },
      { el: world('b-plinth'), title: 'Raise the plinth', text: 'Select the plinth, reveal its handles and drag the height arrow up. The base stays on the floor and the torso rides on top.', done: () => findRaw('b-plinth').h > 1.05, demo: () => { selectId('b-plinth'); S.sizeOpen = 'b-plinth'; T.carryRiders(findRaw('b-plinth'), 1.0, 1.3); findRaw('b-plinth').h = 1.3; commit('Raise Plinth'); } },
      { el: world('b-sculpt'), title: 'Scale the torso in proportion', text: 'A sculpture keeps its proportions with the corner point. Its width and height arrows still work — nothing is locked by category.', done: () => Math.abs(findRaw('b-sculpt').h - 0.9) > 0.05, demo: () => { selectId('b-sculpt'); const t = findRaw('b-sculpt'); t.w *= 1.25; t.d *= 1.25; t.h *= 1.25; commit('Scale Torso'); } },
      { el: world('b-column'), title: 'Stretch an imported column', text: 'An imported Doric column stretches freely in height. Ordinary stretching is not semantic extension; the tag says which one you’re doing.', done: () => findRaw('b-column').h > 3.05, demo: () => { selectId('b-column'); findRaw('b-column').h = 4.2; commit('Raise Doric column'); } },
      { el: '#card .dims', title: 'Precise values in the Card', text: 'The Card is the one writer for these dimensions. Type a value, Enter commits; refusals stay in the field.', demo: () => {} },
      { el: '#wfbar-compare', title: 'Compare dimension lines', text: 'Compare ▸ Object manipulation B draws Reference A’s dimension lines beside the edges instead of rays out of the faces.', done: () => S.cmp.manip === 'dims', demo: () => { selectId('b-bench'); S.sizeOpen = 'b-bench'; S.cmp.manip = 'dims'; } },
    ],
  },
  {
    id: 'roof', t: 'Shape a roof', d: 'Edit its section without losing the building', setup() { fresh(); },
    steps: [
      { el: world('r-gal', 50), title: 'Select the gallery roof', text: 'Click the roof (X-ray overhead lets you see the room below it).', done: () => S.sel === 'r-gal', demo: () => selectId('r-gal') },
      { el: '#card [data-v="editshape"]', title: 'Edit its section', text: 'Or double-click the roof, or press Enter. The section is drawn on the roof itself, in the right local plane.', done: () => !!S.editShape, demo: () => T.openEditShape('r-gal') },
      { el: handle('j-1'), title: 'Drag the ridge joint', text: 'The 3D roof changes as you drag. Heights snap to the Sheet, pitch to 30°, 45°, 60° (⌥ for free).', done: () => Math.abs(findRaw('r-gal').prof[1][1] - 6.6) > 0.05, demo: () => { T.moveJoint(findRaw('r-gal'), 1, 3.4, 7.4, true); commit('Reshape Gallery roof'); } },
      { el: '#card .presets', title: 'Start from a preset', text: 'Mansard adds joints; drag any ＋ on the section to add your own, ⌥-click a joint to remove it.', done: () => findRaw('r-gal').prof.length > 3, demo: () => T.applyPreset(ent('r-gal'), 'mansard') },
      { el: '.vseg.es [data-v="section"]', title: 'Focus the Section in 2D', text: 'The 2D | 3D control becomes 3D | Section while you edit (or press 2). The same Camera turns to look along the ridge: the roof’s own section, with the building cut behind it.', done: () => S.editShape?.view === 'section', demo: () => T.setEditView('section') },
      { el: handle('j-0'), title: 'Set the eave precisely', text: 'Drag the eave joint, or type its height in the Card. It is the same profile and the same history as in 3D.', done: () => Math.abs(findRaw('r-gal').prof[0][1] - 4.2) > 0.05, demo: () => { T.moveJoint(findRaw('r-gal'), 0, 0, 3.8, true); commit('Reshape Gallery roof'); } },
      { el: '.vseg.es [data-v="3d"]', title: 'Back to 3D', text: 'Press 1 or click 3D: you are still editing, on the roof, where you left off.', done: () => S.editShape?.view === '3d', demo: () => T.setEditView('3d') },
      { el: '#wfbar-compare', title: 'Compare the inset', text: 'Compare ▸ Roof Section 2D B keeps the 3D Stage and opens the Section in a dark inset editor instead.', done: () => S.cmp.section === 'inset', demo: () => { S.cmp.section = 'inset'; T.setEditView('section'); } },
      { el: '#stage', title: 'A long profile', text: 'The dense museum’s workshop has a 24 m sawtooth roof. Try single teeth in 3D, then press 2 for the Section.', setup() { const c = { ...S.cmp }; fresh('dense'); S.cmp = { ...c }; S.reading = '3d'; T.openEditShape('r-ws'); } },
    ],
  },
  {
    id: 'slice', t: 'Slice and look inside', d: 'Live section, depth, side, Put back', setup() { fresh(); },
    steps: [
      { el: tool('slice'), title: 'Arm Slice', text: 'Slicing is drawn like a line, but it only changes how you look. Nothing in the building is edited.', done: () => S.tool === 'slice', demo: () => setTool('slice') },
      { el: worldPt([9, 3, 0], 80), title: 'Draw a cut across the gallery', text: 'Drag a straight line, like a Pen line: it starts and ends where you do, and the section previews live while you draw.', done: () => !!S.slice && !S.slice.horizontal, demo: () => { S.slice = { a: [3, 3], b: [11, 3], z: 0, flip: false, depth: 4 }; } },
      { el: handle('sl-depth'), title: 'Set the inspection depth', text: 'The yellow volume is how far the inspection reaches. Drag its depth ray: what lies beyond is ghosted.', done: () => S.slice && S.slice.depth !== 4, demo: () => (S.slice.depth = 2.5) },
      { el: handle('sl-b'), title: 'Redraw an end', text: 'Drag a white end point to lengthen or turn the cut. Drag the line itself to move it.', done: () => S.slice && Math.abs(S.slice.b[0] - 11) > 0.2, demo: () => (S.slice.b = [17, 3]) },
      { el: '.pill.slice [data-act="slice-flip"]', title: 'Keep the other side', text: 'Flip looks into the other half.', done: () => S.slice?.flip, demo: () => (S.slice.flip = true) },
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
      { el: '.pcol [data-act="efilteropen"]', title: 'Limit what it takes', text: 'Filters live behind one funnel in the palette, not in long strips. Open it and leave Walls out.', done: () => !S.eraseFilter.wall, demo: () => { S.eraseFilterOpen = true; S.eraseFilter.wall = false; } },
      { el: tool('eraser'), title: 'An active filter stays visible', text: 'A red dot on the funnel and on the Eraser itself. Over a wall, the cursor says walls are filtered out. Turn Walls back on.', done: () => S.eraseFilter.wall, demo: () => { S.eraseFilter.wall = true; } },
      { el: pal('eraseMode', 'lasso'), title: 'Lasso a whole floor', text: 'Switch to Lasso. Now in the dense museum, loop around part of a floor: everything inside is marked red.', setup() { const c = { ...S.cmp }; fresh('dense'); S.cmp = { ...c }; setTool('eraser'); S.eraseMode = 'lasso'; S.reading = 'plan'; setSheet(4.5); }, done: () => !!S.erase, demo: () => { const ids = M.objects.filter((o) => o.level === 'lv-1' && o.x < 18 && o.y < 12).map((o) => o.id).concat(M.walls.filter((w) => w.level === 'lv-1' && w.a[0] < 18 && w.a[1] < 12 && w.b[0] <= 18 && w.b[1] <= 12).map((w) => w.id).slice(0, 6)); S.marked = new Set(ids); S.erase = { x: 420, y: 260, excl: new Set() }; } },
      { el: '.erasebar', title: 'Accept once', text: 'One bar, near your gesture: what goes, what is set aside, which rooms open. Erase (Enter) or Cancel.', done: () => !S.erase, demo: () => T.eraseApply() },
    ],
  },
  {
    id: 'arch', t: 'Walls, openings and platforms', d: 'The same language on architecture', setup() { fresh(); },
    steps: [
      { el: world('w-n1', 50), title: 'Select the north wall', text: 'White points at its ends, a ray off its top, a two-way arrow across its base and a short one on its cap for thickness.', done: () => S.sel === 'w-n1', demo: () => selectId('w-n1') },
      { el: handle('top'), title: 'Raise it', text: 'Drag the top ray. It snaps to heights on the Sheet, and refuses to drop below what the wall hosts.', done: () => findRaw('w-n1').top > 4.25, demo: () => { findRaw('w-n1').top = 4.8; commit('Raise North wall'); } },
      { el: handle('th'), title: 'Thicken it', text: 'Drag across the cap. The plan and the 3D cap follow; the Card has the number.', done: () => (findRaw('w-n1').th ?? 0.24) > 0.3, demo: () => { findRaw('w-n1').th = 0.4; commit('Thicken North wall'); } },
      { el: world('o-win', 40), title: 'Select the east window', text: 'Hosted things move in relation to their wall: a faint track runs the length of the host.', done: () => S.sel === 'o-win', demo: () => selectId('o-win') },
      { el: handle('ow-b'), title: 'Widen it', text: 'Drag a side ray. It refuses past the wall end or into a neighbour, and says why.', done: () => findRaw('o-win').w > 2.45, demo: () => { const o = findRaw('o-win'); o.w = 3; o.at += 0.3; commit('Resize East window'); } },
      { el: tool('ink'), title: 'Draw a round window', text: 'Arm Ink, pick Round, and draw a circle on the studio’s south wall: one Pen, and the wall makes it an opening.', done: () => M.openings.some((o) => o.round), demo: () => { setTool('ink'); S.inkTip = 'round'; const id = uid('o'); M.openings.push({ id, name: 'Round window', host: 'w-s2', at: 3, w: 1.2, h: 1.2, sill: 1.2, round: true }); commit('Ink round window'); selectId(id); } },
      { el: '#wfbar-compare', title: 'Compare edge grips', text: 'Compare ▸ Architecture handles B makes the edges themselves the handles, with arrows only on hover.', done: () => S.cmp.arch === 'grips', demo: () => { setTool('select'); selectId('w-n1'); S.cmp.arch = 'grips'; } },
    ],
  },
  {
    id: 'pen', t: 'One Pen, ordinary shapes', d: 'Shape as a reading, Pull, the Shape intent', setup() { fresh(); base.n = M.objects.length; },
    steps: [
      { el: tool('ink'), title: 'Arm Ink with the Box pen', text: 'The same Pen that draws rooms.', done: () => S.tool === 'ink' && S.inkTip === 'box', demo: () => { setTool('ink'); S.inkTip = 'box'; } },
      { el: worldPt([3, 3, 0], 60), title: 'Draw a box inside the gallery', text: 'On the floor it reads as a Room first, as before.', done: () => !!S.readChip, demo: () => T.finishInk([[2, 2], [4, 2], [4, 4], [2, 4]], true) },
      { el: '.readchip', title: 'Read it as a Shape', text: 'Shape is always one more reading for a closed stroke: an ordinary profile, not architecture.', done: () => M.objects.some((o) => o.type === 'profile'), demo: () => { const i = S.readChip?.readings.findIndex((r) => r.make === 'shape'); if (i >= 0) T.reread(i); } },
      { el: () => { const o = M.objects.find((x) => x.type === 'profile'); return o ? world(o.id, 40)() : null; }, title: 'Pull it up', text: 'Select it, click the scale point, and drag the height ray. The profile stays editable; Taper and Revolve would join here later.', done: () => M.objects.some((o) => o.type === 'profile' && o.h > 0.5), demo: () => { setTool('select'); const o = M.objects.find((x) => x.type === 'profile'); selectId(o.id); S.sizeOpen = o.id; o.h = 1.2; commit(`Raise ${o.name}`); } },
      { el: '#wfbar-compare', title: 'Compare a Shape intent', text: 'Compare ▸ One Pen B adds a Shape toggle to the Ink palette. While it is on, closed strokes become shapes without asking.', done: () => S.cmp.pen === 'intent', demo: () => { S.cmp.pen = 'intent'; setTool('ink'); } },
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
