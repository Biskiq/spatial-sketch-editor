// Edit Shape's one entry and exit. Session state only: no authored change, no history step.
import { store } from '../store';
import { ohSection } from '../model/overheadGeom';
import { app } from './ctx';

let focusBefore: HTMLElement | null = null;
let facedFor: string | null = null;

export function enterShaping(id: string) {
  if (!store.project.overheads.some((o) => o.id === id)) return;
  if (store.ui.shaping === id) return;
  focusBefore = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  facedFor = null;
  store.set({ shaping: id, selection: id, menu: null, tool: 'select', placeType: null });
}

export function exitShaping(opts: { focus?: boolean } = {}) {
  if (!store.ui.shaping) return;
  store.setPreview(null);
  store.set({ shaping: null, seeThrough: false, menu: null });
  const el = focusBefore;
  focusBefore = null;
  if (opts.focus !== false && el && el.isConnected) el.focus();
}

export function toggleSeeThrough() {
  if (!store.ui.shaping) return;
  store.set({ seeThrough: !store.ui.seeThrough });
}

/** Face the section across the roof, from whichever side the camera is already on. */
export function faceSection() {
  const id = store.ui.shaping;
  if (!id) return;
  const oh = store.project.overheads.find((o) => o.id === id);
  if (!oh || !app.stage) return;
  const ctl = app.stage.ctl;
  if (facedFor !== id) {
    store.pushView('face the section');
    facedFor = id;
  }
  const d = ohSection(oh).tan;
  let e: [number, number] = [-d[1], d[0]];
  const camX = app.stage.camera.position.x - ctl.target.x;
  const camZ = app.stage.camera.position.z - ctl.target.z;
  if (e[0] * camX + e[1] * camZ < 0) e = [-e[0], -e[1]];
  ctl.glideTo(Math.atan2(e[0], e[1]), 1.18);
}
