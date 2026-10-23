// Visual-language atlas states (wireframe chrome, not product). `index.html?atlas=<key>` opens the
// live wireframe in one scripted state, without the wireframe bar; atlas.html shows them side by side.
import { S, M, R, CMP0, camState, commit, findRaw, uid } from './core.js';
import * as T from './tools.js';
import { render, setTool, selectId, loadScenario, setSheet, runCap } from './app.js';

const base = (k = 'boathouse') => { loadScenario(k); Object.assign(S, { lens: 'world', reading: '3d', projection: 'axo', az: 35, tool: 'select', indexOpen: true, palOpen: true, inkShape: false, cmp: { ...CMP0 } }); };
/** Centre the Stage on an entity at a zoom factor (viewing state only). */
function zoomOn(id, z) {
  render(); const cs = camState(); cs.z = z; render();
  const c = R.CENT[id]; if (!c) return;
  cs.pan = [cs.pan[0] + c[0] - (R.V.x + R.V.w / 2), cs.pan[1] + c[1] - (R.V.y + R.V.h / 2)]; render();
}
const platform = () => { const id = 'room-deck'; M.rooms.push({ id, name: 'Reading deck', type: 'platform', walls: [], poly: [[13, 4.5], [17, 4.5], [17, 7.5], [13, 7.5]], z: 0.45, level: 'lv-g', structure: 'st-boat' }); return id; };

export const ATLAS = {
  rest: () => base(),
  'pal-open': () => { base(); setTool('ink'); S.inkTip = 'box'; },
  'pal-collapsed': () => { base(); setTool('ink'); S.inkTip = 'box'; S.palOpen = false; },
  'obj-rays': () => { base(); S.indexOpen = false; selectId('b-bench'); S.sizeOpen = 'b-bench'; zoomOn('b-bench', 3.4); S.hh = 'w'; },
  'obj-rays-closed': () => { base(); S.indexOpen = false; selectId('b-sculpt'); zoomOn('b-sculpt', 3.4); S.hh = 'size'; },
  'obj-dims': () => { base(); S.indexOpen = false; S.cmp.manip = 'dims'; selectId('b-bench'); S.sizeOpen = 'b-bench'; zoomOn('b-bench', 3.4); S.hh = 'h'; },
  'obj-knobs': () => { base(); S.indexOpen = false; S.cmp.manip = 'knobs'; selectId('b-bench'); S.sizeOpen = 'b-bench'; zoomOn('b-bench', 3.4); },
  'obj-small': () => { base('dense'); runCap('goto:level:lv-0'); S.indexOpen = false; const o = M.objects.find((x) => x.level === 'lv-0' && x.w < 0.8) || M.objects[0]; selectId(o.id); S.sizeOpen = o.id; zoomOn(o.id, 1.1); },
  'wall-rays': () => { base(); S.indexOpen = false; selectId('w-s2'); zoomOn('w-s2', 1.9); S.hh = 'top'; },
  'wall-grips': () => { base(); S.indexOpen = false; S.cmp.arch = 'grips'; selectId('w-s2'); zoomOn('w-s2', 1.9); S.hh = 'top'; },
  opening: () => { base(); S.indexOpen = false; selectId('o-win'); zoomOn('o-win', 2.2); S.hh = 'ow-b'; },
  platform: () => { base(); S.indexOpen = false; const id = platform(); commit('Platform'); selectId(id); zoomOn(id, 2.0); S.hh = 'pz'; },
  'roof-select': () => { base(); S.indexOpen = false; selectId('r-gal'); zoomOn('r-gal', 1.5); S.hh = 'eave'; },
  'roof-3d': () => { base(); S.indexOpen = false; T.openEditShape('r-gal'); S.editShape.joint = 1; zoomOn('r-gal', 1.4); },
  'roof-section': () => { base(); S.indexOpen = false; T.openEditShape('r-gal'); S.editShape.joint = 1; T.setEditView('section'); },
  'roof-inset': () => { base(); S.indexOpen = false; S.cmp.section = 'inset'; T.openEditShape('r-gal'); S.editShape.joint = 1; T.setEditView('section'); zoomOn('r-gal', 1.2); },
  slice: () => { base(); S.indexOpen = false; setTool('slice'); S.palOpen = false; S.slice = { a: [3, 3], b: [11, 3], z: 0, flip: false, depth: 2.5 }; S.hh = 'sl-depth'; zoomOn('room-gal', 1.3); },
  'slice-plan': () => { base(); S.indexOpen = false; S.reading = 'plan'; setTool('slice'); S.slice = { a: [3, 3], b: [11, 3], z: 0, flip: false, depth: 2.5 }; },
  'erase-filter': () => { base(); S.indexOpen = false; setTool('eraser'); S.eraseFilter.wall = false; S.eraseFilter.roof = false; S.eraseFilterOpen = true; S.eraseHint = { x: 560, y: 330, text: 'Walls are filtered out' }; },
  'erase-bulk': () => { base('dense'); S.indexOpen = false; setTool('eraser'); S.eraseMode = 'lasso'; S.reading = 'plan'; setSheet(4.5); const ids = M.objects.filter((o) => o.level === 'lv-1' && o.x < 18 && o.y < 12).map((o) => o.id); S.marked = new Set(ids); S.erase = { x: 420, y: 260, excl: new Set() }; },
  'index-open': () => { base('dense'); runCap('goto:level:lv-1'); S.facet = 'all'; },
  'index-chip': () => { base('dense'); runCap('goto:level:lv-1'); S.indexOpen = false; },
  'index-peek': () => { base('dense'); runCap('goto:level:lv-1'); S.cmp.collapse = 'peek'; S.indexOpen = false; S.peek = true; },
  'ipad-portrait': () => { base(); S.width = 'ipadP'; render(); S.indexOpen = true; selectId('b-bench'); },
  'ipad-landscape': () => { base(); S.width = 'ipadL'; render(); selectId('w-n1'); setTool('ink'); },
  'pen-chip': () => { base(); setTool('ink'); S.inkTip = 'box'; S.palOpen = false; T.finishInk([[2, 2], [4.5, 2], [4.5, 4], [2, 4]], true); },
  'pen-intent': () => { base(); S.cmp.pen = 'intent'; setTool('ink'); S.inkShape = true; },
  'pen-pulled': () => { base(); S.indexOpen = false; const id = uid('b'); M.objects.push({ id, name: 'Shape 1', type: 'profile', fit: 'stretch', x: 3.2, y: 3, w: 2.4, d: 1.6, h: 1.1, rot: 0, z: 0, level: 'lv-g', outline: [[-0.5, -0.5], [0.1, -0.5], [0.5, 0], [0.1, 0.5], [-0.5, 0.5]] }); commit('Shape'); selectId(id); S.sizeOpen = id; zoomOn(id, 2.4); S.hh = 'h'; },
};

export function applyAtlas(key) {
  document.body.classList.add('atlas');
  const f = ATLAS[key]; if (!f) return;
  f(); render();
  // some states only exist after a frame (hover tags read live geometry): draw once more
  requestAnimationFrame(() => render());
}
