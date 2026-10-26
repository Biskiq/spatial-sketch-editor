import { createCamera, pickLine, project, unproject, rayPlane } from './render/camera.js';
import { draw } from './render/ink.js';
import { pointInPoly } from './core/plan.js';
import * as Scenes from './scenes/index.js';
import { LINE_NAME } from './scenes/faces.js';
import { updateSheet } from './ui/sheet.js';

// One table describes each demo: its authored state, the builder that turns that
// state into geometry + card, the reducer its chips call, the handles it draws
// and the optional gestures only it understands. Everything else in this file is
// the sheet: it looks a handle up by kind and never reads a demo's state.
const TABS = [
  {
    id: 'roof',
    label: 'One roof',
    create: Scenes.roofState,
    build: Scenes.roofScene,
    chip: Scenes.applyRoofChip,
    handles: Scenes.roofHandles,
    select: Scenes.selectEave,
    camera: { yaw: -0.66, pitch: 0.62, dist: 27, target: [5.4, 3.0, 4.6] },
  },
  {
    id: 'dormer',
    label: 'Dormer',
    create: Scenes.dormerState,
    build: Scenes.dormerScene,
    chip: Scenes.applyDormerChip,
    handles: Scenes.dormerHandles,
    place: Scenes.addDormerAt,
    camera: { yaw: -2.42, pitch: 0.42, dist: 25, target: [6.3, 3.0, 3.5] },
  },
  {
    id: 'walk',
    label: 'Walk & rail',
    create: Scenes.walkState,
    build: Scenes.walkScene,
    chip: Scenes.applyWalkChip,
    handles: Scenes.walkHandles,
    camera: { yaw: -0.84, pitch: 0.48, dist: 15, target: [0.2, 1.7, 0.2] },
  },
  {
    id: 'corpus',
    label: 'Corpus',
    create: Scenes.corpusState,
    build: Scenes.corpusScene,
    camera: { yaw: -0.7, pitch: 0.5, dist: 36, target: [5.6, 2.0, 4.6] },
  },
];

const canvas = document.getElementById('paper');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
let lastScene = null;

const cams = Object.fromEntries(TABS.map((t) => [t.id, createCamera(t.camera)]));
const camStart = JSON.parse(JSON.stringify(cams));

// state.tab picks a demo; each demo owns its own slice under its id.
const state = {
  tab: 'roof',
  ...Object.fromEntries(TABS.map((t) => [t.id, t.create()])),
  drag: null,
};

const tab = () => TABS.find((t) => t.id === state.tab);
const demos = () => state[state.tab];
const cam = () => cams[state.tab];
// a scene draws only handles its own table answers for
const handlerFor = (handle) => tab().handles[handle.kind];

// ------------------------------------------------------------------ sizing

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  W = r.width;
  H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

// ------------------------------------------------------------------ render

function render() {
  lastScene = tab().build(demos());
  draw(ctx, W, H, cam(), lastScene);
  updateSheet(lastScene.ui, { onChip, onRow });
}

function onChip(id) {
  const t = tab();
  if (t.chip) t.chip(demos(), id);
  render();
}

function onRow(id) {
  state.corpus.sel = id;
  render();
}

// ------------------------------------------------------------------ tabs

function setTab(id) {
  state.tab = id;
  for (const b of document.querySelectorAll('#tabs button')) {
    b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false');
  }
  render();
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  for (const t of TABS) {
    const b = document.createElement('button');
    b.textContent = t.label;
    b.dataset.tab = t.id;
    b.setAttribute('aria-selected', t.id === state.tab ? 'true' : 'false');
    b.addEventListener('click', () => setTab(t.id));
    nav.append(b);
  }
}

// ------------------------------------------------------------------ pointer

const local = (e) => {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

function nearestHandle(mx, my) {
  if (!lastScene) return null;
  let best = null;
  for (const d of lastScene.dots || []) {
    if (!d.handle) continue;
    const p = project(d.p, cam(), W, H);
    const dist = Math.hypot(p.x - mx, p.y - my);
    if (dist < 14 && (!best || dist < best.dist)) best = { dist, handle: d.handle, dot: d };
  }
  return best;
}

canvas.addEventListener('pointerdown', (e) => {
  const [mx, my] = local(e);
  canvas.setPointerCapture(e.pointerId);
  const h = nearestHandle(mx, my);
  if (h) {
    // the handle's owner grabs its base value and any selection a grab implies
    state.drag = {
      kind: 'handle', handle: h.handle, start: [mx, my], cam: { ...cam() },
      base: handlerFor(h.handle).begin(demos(), h.handle),
    };
    render();
    return;
  }
  state.drag = { kind: 'orbit', start: [mx, my], cam: { ...cam() }, moved: false };
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  const [mx, my] = local(e);
  if (state.drag) {
    const dx = mx - state.drag.start[0];
    const dy = my - state.drag.start[1];
    if (state.drag.kind === 'orbit') {
      if (Math.abs(dx) + Math.abs(dy) > 3) state.drag.moved = true;
      const c = cam();
      c.yaw = state.drag.cam.yaw - dx * 0.008;
      c.pitch = Math.max(0.08, Math.min(1.38, state.drag.cam.pitch + dy * 0.006));
      render();
      return;
    }
    handlerFor(state.drag.handle).drag(demos(), state.drag.handle, { dx, dy }, state.drag.base);
    render();
    return;
  }
  hover(mx, my);
});

canvas.addEventListener('pointerup', (e) => {
  const [mx, my] = local(e);
  const drag = state.drag;
  state.drag = null;
  canvas.classList.remove('dragging');
  if (drag && drag.kind === 'orbit' && !drag.moved) onPaperClick(mx, my);
});

// A click on the paper means what the demo says it means: place on a slope if it
// has a placement, otherwise select the line that was clicked.
function onPaperClick(mx, my) {
  const t = tab();
  if (!lastScene) return;
  if (t.place && placeOnSlope((plan) => t.place(demos(), plan), mx, my)) {
    render();
    return;
  }
  const line = pickLine(lastScene, cam(), W, H, mx, my, 10);
  if (line && line.id && t.select) {
    t.select(demos(), line.id);
    render();
  }
}

// A slope is a roof face, and every roof face here is a height field over its plan
// polygon. So the honest placement is: cross the ray with each slope, keep the hit
// that is inside that slope's plan, and take the nearest. Picking by projected
// centroid is what used to send a click to a far patch.
function placeOnSlope(place, mx, my) {
  const ray = unproject(mx, my, cam(), W, H);
  let best = null;
  for (const f of lastScene.faces || []) {
    if (f.kind !== 'roof') continue; // walls and cheeks are never a slope
    const hit = rayPlane(ray, f.poly3[0], f.poly3[1], f.poly3[2]);
    if (!hit) continue;
    const plan = f.poly3.map((p) => [p[0], p[2]]);
    if (!pointInPoly([hit[0], hit[2]], plan)) continue;
    const d = (hit[0] - ray.origin[0]) ** 2 + (hit[1] - ray.origin[1]) ** 2 + (hit[2] - ray.origin[2]) ** 2;
    if (!best || d < best.d) best = { d, hit };
  }
  if (!best) return false;
  place([best.hit[0], best.hit[2]]);
  return true;
}

function hover(mx, my) {
  const tip = document.getElementById('tip');
  if (!lastScene) return;
  const line = pickLine(lastScene, cam(), W, H, mx, my, 7);
  const h = nearestHandle(mx, my);
  canvas.classList.toggle('pointing', !!tab().place && !h);
  const show = (html) => {
    tip.hidden = false;
    tip.innerHTML = html;
    tip.style.left = `${mx}px`;
    tip.style.top = `${my}px`;
  };
  if (h) {
    show(handlerFor(h.handle).tip);
    return;
  }
  if (line && LINE_NAME[line.kind]) {
    show(`<b>${LINE_NAME[line.kind]}</b>${line.length ? ` · ${line.length.toFixed(1)} m` : ''}`);
    return;
  }
  tip.hidden = true;
}

canvas.addEventListener('pointerleave', () => {
  document.getElementById('tip').hidden = true;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const c = cam();
  c.dist = Math.max(7, Math.min(70, c.dist * (1 + e.deltaY * 0.0012)));
  render();
}, { passive: false });

// ------------------------------------------------------------------ keys and boot

window.addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= TABS.length) setTab(TABS[n - 1].id);
  if (e.key === 'r' || e.key === 'R') resetCamera();
});

document.getElementById('reset').addEventListener('click', resetCamera);
function resetCamera() {
  cams[state.tab] = JSON.parse(JSON.stringify(camStart[state.tab]));
  render();
}

buildTabs();
window.addEventListener('resize', resize);
resize();

// a small hook for design notes and probing
window.__p3 = {
  state,
  cams,
  get scene() { return lastScene; },
  project: (p) => project(p, cam(), W, H),
};
