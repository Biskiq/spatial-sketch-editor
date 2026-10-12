// The View preview's image pass: one small derivative render of a Camera pose, produced by the Stage's
// own renderer and builders (never a second renderer, Scene or Camera), cached by resolved pose + World
// generation + aspect, and drawn at most once per idle turn.
//
// Three laws hold it in place, and each one is asserted rather than assumed:
//   * it writes nothing. No source, history, selection or standpoint changes, and the live projection
//     is restored in the same synchronous turn that produced the image.
//   * it never moves live navigation. The pose is placed on a camera of the Stage's own, so an image can
//     be produced while the author's standpoint stays exactly where it was.
//   * it never competes with the frame the author is looking at: while a chained command, a flight, a
//     gesture or a visit is in progress, the pass waits; a failure leaves a named placeholder behind and
//     the live stage intact.
import { S, ctx } from './state.js';
import { realizeCapabilities, worldSignature } from './experience-scene.js';

// A small target at the Stage's own aspect, letterboxed into the Card's preview box: the picture keeps
// the frame the author is working in rather than a second, invented one.
const BOX_W = 176;
const BOX_H_MAX = 132;
const BOX_H_MIN = 92;
const LIMIT = 32;

const cache = new Map(); // key -> url
const tried = new Map(); // key -> failure reason, so one refusal is not retried every turn
const queue = [];
let drawn = 0;
let lastMs = 0;
let lastFail = '';
let peak = 0; // the most requests ever outstanding at once: the pass never accumulates a backlog

// Read-only: what the pass has drawn, what it still holds, how long the last draw took, what the last draw
// was projected as (normal-World reading or an authoring one) and the worst backlog it ever held. A
// bounded, neutral pass is a claim about exactly these numbers, so they are reported rather than inferred.
export const imageStats = () => ({
  drawn, cached: cache.size, queued: queue.length, peak, lastMs: Math.round(lastMs), lastFail,
  projection: ctx.stage?.lastSnapshot ? { ...ctx.stage.lastSnapshot } : null,
  // The World generation every held picture is keyed on: a World edit, Undo or Redo must move this, and
  // an axis reads it rather than inferring invalidation from a picture that cannot say which World it is.
  world: worldSignature(),
});
// Enough identity to tell a stale pass from a live one without exposing the page's objects.
export const imagePassAlive = () => !!ctx.stage && typeof ctx.stage.snapshotPose === 'function';

// A pose target is a plain triple in every authored source; a live snapshot may still hand back the
// Camera's own vector, so the key normalises it rather than assuming one representation.
const triple = (t) => (Array.isArray(t) ? t : [t?.x, t?.y, t?.z]);
function poseKey(pose, sig, w, h) {
  const t = triple(pose.target);
  return `${sig}|${w}x${h}|${t.map((n) => Number(n).toFixed(3)).join(',')}|${Number(pose.az).toFixed(4)},${Number(pose.el).toFixed(4)},${Number(pose.frameH).toFixed(3)},${Number(pose.flat || 0).toFixed(2)},${pose.mirror ? 'm' : '-'}`;
}

function box() {
  const aspect = ctx.stage?.w && ctx.stage?.h ? ctx.stage.w / ctx.stage.h : 16 / 9;
  const h = Math.max(BOX_H_MIN, Math.min(BOX_H_MAX, Math.round(BOX_W / Math.max(0.4, aspect))));
  return { w: BOX_W, h };
}

// What the Card asks, synchronously: a ready image, a pending one (the pass will draw it on the next
// idle turn and re-render), or a named reason why this View can have none.
export function imageFor(viewId) {
  const view = ctx.cameraSource?.views?.[viewId];
  if (!view?.pose?.target) return { state: 'unavailable', reason: 'This View has no resolvable Camera pose' };
  const { w, h } = box();
  const key = poseKey(view.pose, worldSignature(), w, h);
  if (cache.has(key)) return { state: 'ready', url: cache.get(key) };
  if (tried.has(key)) return { state: 'unavailable', reason: tried.get(key) };
  if (!queue.some((q) => q.key === key)) {
    queue.push({ key, pose: { ...view.pose, target: triple(view.pose.target) }, w, h });
    peak = Math.max(peak, queue.length);
  }
  return { state: 'pending' };
}

// One idle turn: at most one draw, and none while the author is doing something else. Called from the
// frame pass, so a produced image appears in the very next frame without any polling.
export function imageTurn() {
  if (!queue.length) return false;
  if (S.visitor || S.busy || S.expDrag || S.cameraDraft || !ctx.stage) return false;
  const job = queue.shift();
  const stage = ctx.stage;
  // The audition is an authoring projection of the Scene, and a View preview shows the authored World:
  // it is cleared for the draw and put straight back, so the author's own projection is untouched.
  const audition = S.expAudition;
  const t0 = performance.now();
  let url = null;
  try {
    if (audition) {
      S.expAudition = null;
      realizeCapabilities();
    }
    url = stage.snapshotPose(job.pose, job.w, job.h);
  } catch (e) {
    lastFail = e?.message || 'image pass failed';
  } finally {
    if (audition) {
      S.expAudition = audition;
      realizeCapabilities();
    }
  }
  lastMs = performance.now() - t0;
  if (!url) {
    lastFail = lastFail || 'the image pass could not draw this View';
    tried.set(job.key, lastFail);
    return false;
  }
  lastFail = '';
  drawn++;
  cache.set(job.key, url);
  while (cache.size > LIMIT) cache.delete(cache.keys().next().value);
  // The Card holds the answer already; this is what makes the picture appear.
  ctx.ui?.();
  return true;
}

export const pendingImageCount = () => queue.length;
