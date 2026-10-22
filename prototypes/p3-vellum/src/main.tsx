import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import './ui/styles.css';
import * as THREE from 'three';
import { render } from 'preact';
import { store } from './store';
import { Stage } from './scene/stage';
import { Overlays } from './scene/overlays';
import { Interact } from './scene/interact';
import { Player } from './story/player';
import { preparedBoathouse, loadGLB, attachImport, detachImport } from './import/importer';
import { emptyProject } from './model/types';
import { app } from './ui/ctx';
import { App } from './ui/App';

const root = document.getElementById('app')!;
root.innerHTML = '';
const shell = document.createElement('div');
shell.className = 'app';
const stageEl = document.createElement('div');
stageEl.className = 'stage';
const uiEl = document.createElement('div');
shell.append(stageEl, uiEl);
root.append(shell);

const stage = new Stage(stageEl);
const ov = new Overlays(stage);
const ix = new Interact(stage, ov);
const player = new Player(stage);

// ------------------------------------------------------------------ imported architecture
// File imports live in memory for this visit; the prepared boathouse is regenerated from code.
const loaded = new Map<string, THREE.Group>();
let importKey = '';

function frameImport() {
  const o = stage.importObject;
  if (!o) return ix.frameAll();
  const b = new THREE.Box3().setFromObject(o);
  stage.ctl.frame([b.min.x, b.min.z], [b.max.x, b.max.z], b.max.y);
}

function syncImport() {
  const im = store.project.imported;
  const key = im ? `${im.key}|${im.display}|${store.project.palette}` : '';
  if (key === importKey) return;
  importKey = key;
  if (!im) return detachImport(stage);
  let g = loaded.get(im.key);
  if (!g && im.source === 'prepared') {
    g = preparedBoathouse();
    loaded.set(im.key, g);
  }
  if (!g) {
    detachImport(stage);
    store.toast(`“${im.name}” came from a file — files aren’t kept between visits. Drop it again to see it.`);
    return;
  }
  attachImport(stage, g, im.display);
  store.emit();
}
store.subscribe(syncImport);

app.stage = stage;
app.ov = ov;
app.ix = ix;
app.player = player;
app.importFile = async (f: File) => {
  try {
    const g = await loadGLB(f);
    const key = `file:${f.name}:${f.size}`;
    loaded.set(key, g);
    store.commit(`Imported ${f.name}`, (p) => {
      p.imported = { name: g.name, source: 'file', key, scale: g.scale.x, offset: [0, 0], display: 'solid' };
    });
    store.set({ start: false, selection: 'import' });
    requestAnimationFrame(frameImport);
  } catch (e) {
    console.error(e);
    store.toast(`Couldn’t read ${f.name} — is it a .glb or a self-contained .gltf?`);
  }
};
app.openPrepared = () => {
  const p = emptyProject('Boathouse, reworked');
  p.imported = { name: 'Old boathouse (imported)', source: 'prepared', key: 'boathouse', scale: 1, offset: [0, 0], display: 'solid' };
  store.load(p);
  store.select('import');
  requestAnimationFrame(frameImport);
};
app.exportJSON = () => {
  const p = store.project;
  const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.name.replace(/[^\w\- ]+/g, '').trim() || 'vellum'}.vellum.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// ------------------------------------------------------------------ start
if (store.restore()) {
  store.set({ start: false });
  requestAnimationFrame(() => (store.project.runs.length ? ix.frameAll() : store.project.imported ? frameImport() : null));
} else store.set({ start: true });
syncImport();

render(<App />, uiEl);

// dev-only frame-time readout (the 16 ms budget while reshaping)
if (import.meta.env.DEV) {
  (window as any).__app = app;
  import('./dev/testkit').then((m) => ((window as any).__t = m.testkit));
  const fps = document.createElement('div');
  fps.className = 'fps';
  shell.append(fps);
  let acc = 0;
  stage.onFrame.push((dt) => {
    acc += dt;
    if (acc > 0.5) {
      acc = 0;
      fps.textContent = `${Math.round(stage.fps)} fps · dev${ix.lastInput ? ` · ${ix.lastInput}` : ''}${ix.trace ? ' · ● rec' : ''}`;
    }
  });
}
