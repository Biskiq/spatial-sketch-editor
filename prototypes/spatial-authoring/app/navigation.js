// The one owner of the prototype's standpoint: the requested camera, its realization, movement,
// and the view history. Shell, tasks and the presenter all ask this seam; none of them keeps a pose
// of its own, and none of them restores one behind its back.
//
// Two things live here that used to be spread across callers:
//
//   * the REALIZED pose. Flatness is derived from what is open and where the camera is looking, so
//     FOV and eye distance change when a reading is dropped even if az/el/target/frameH do not. A
//     reading that parks holds the realized flatness until explicit spatial input arrives, so
//     deactivating it cannot silently dolly the camera.
//   * the trail. Entries are complete reading recipes supplied by the spatial operations; this seam
//     stores them, guards re-entry, and asks the operation layer to enter one.
import * as THREE from 'three';
import { S, ctx } from './state.js';
import { tween } from './anim.js';

const st = () => ctx.stage;
const V3 = THREE.Vector3;

export const camState = () => st().camState();

export function setCam(c) {
  const cam = st().cam;
  if (c.target) cam.target.copy(c.target);
  if (c.az != null) cam.az = c.az;
  if (c.el != null) cam.el = c.el;
  if (c.frameH != null) cam.frameH = c.frameH;
  if (c.flat != null) cam.flat = c.flat;
  if (c.mirror != null) cam.mirror = c.mirror;
}

export function lerpCam(a, b, e, tFlat) { st().lerpCam(a, b, e, tFlat); }

// The camera travels on one eased curve. `arc` lifts the eye mid-flight so the floor is seen on the
// way: a single beat that explains the move instead of a stop-and-go sequence.
export function camAt(a, b, e, arc = 0) {
  st().lerpCam(a, b, e);
  if (arc) st().cam.el += Math.sin(Math.PI * e) * arc;
}

export async function fly(to, ms, arc = 0) {
  // An explicit move is the moment the standpoint is re-derived: any parked hold is released.
  releaseHold();
  const a = camState();
  await tween(ms, (t) => camAt(a, to, ease(t), arc));
  if (to.mirror != null) st().cam.mirror = to.mirror;
}

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ----- what is actually rendered -----------------------------------------

// Read from the camera the renderer used, not from the request: eye, up, direction, FOV and the
// world height the frame covers at the target. This is the distinction parking and resizing keep.
export function realized() {
  const cam = st().camera;
  const tgt = st().cam.target;
  const dist = cam.position.distanceTo(tgt);
  const fov = cam.fov;
  return {
    eye: [cam.position.x, cam.position.y, cam.position.z],
    up: [cam.up.x, cam.up.y, cam.up.z],
    target: [tgt.x, tgt.y, tgt.z],
    dir: (() => { const d = new V3(); cam.getWorldDirection(d); return [d.x, d.y, d.z]; })(),
    fov, dist, frameH: 2 * dist * Math.tan((fov * Math.PI) / 360), mirror: !!st().cam.mirror,
  };
}

// Freeze the realized flatness: the picture must not change because a reading stopped being open.
export function holdRealized() {
  S.flatHold = st().cam.flat;
  return S.flatHold;
}
export const hold = () => (S.flatHold == null ? null : S.flatHold);
export function releaseHold() { S.flatHold = null; }
// A new invocation can start at a neutral, parked realization. Its explicit return must preserve
// that realization as well as the requested pose; this belongs to navigation, never parked tasks.
export function captureOrigin(label) { return { cam: camState(), label, hold: hold() }; }
export function restoreOriginHold(origin) { S.flatHold = origin?.hold ?? null; }

// ----- the view history -------------------------------------------------

// Entries are reading recipes built by the spatial operations (complete: open kind, parameters and
// the standpoint to arrive at). The trail owns their storage and position, nothing else.
export function pushTrail(label, recipe) {
  if (S.navTrail) return;
  const entry = { ...(recipe || {}), label: label || recipe?.label || readingLabel() };
  const t = S.trail.slice(0, S.trailPos + 1);
  const last = t[t.length - 1];
  if (last && last.label === entry.label) t[t.length - 1] = entry;
  else t.push(entry);
  S.trail = t.slice(-12);
  S.trailPos = S.trail.length - 1;
  ctx.ui();
}

let enterRecipe = null;
// The operation layer registers how a recipe is re-entered; it owns the spatial know-how, this seam
// owns the record and the guarding flag.
export function setEnterRecipe(fn) { enterRecipe = fn; }

export function trail() { return S.trail; }
export function trailPos() { return S.trailPos; }

export async function gotoTrail(i) {
  const e = S.trail[i];
  if (!e || !enterRecipe) return;
  S.navTrail = true;
  try { await enterRecipe(e); } finally { S.navTrail = false; }
  S.trailPos = i;
}

export function backTo(depth, crumbs) {
  const target = crumbs[depth];
  if (depth < 0 || !target) return null;
  S.navTrail = true;
  return enterRecipe(target).finally(() => { S.navTrail = false; });
}

let readingLabel = () => '';
export function setReadingLabel(fn) { readingLabel = fn; }

// Camera's shared prototype evaluation kernel; authored sources contain no generated endpoints.
export { pathSeconds, evaluatePath, connectionPath, findConnection, stations, stationProgress } from './camera-evaluation.js';
export function plainPose() {
 const p=camState(); return {...p,target:[p.target.x,p.target.y,p.target.z]};
}
export function applyPose(p) { setCam({...p,target:new V3(...p.target)}); }
export function restoreCapture(token) { setCam(token.cam); restoreOriginHold(token); }
