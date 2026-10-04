import * as THREE from 'three';
import { S, ctx, W, C, thing, clone } from './state.js';
import { tween, dur, saw, narrate, run } from './anim.js';
import * as nav from './navigation.js';
import { buildCapabilitySubjects } from './experience-scene.js';
import * as T from './tasks.js';
import { onCancel, cancelProposal } from './cancel.js';
import {
  frameAt, wallLength, maxTop, topAt, bbox, planeY, fmt, pointInPoly, modS, springOf, centroid,
  validateOpening, validateWall, validateCeiling, validateArtPlacement, byId,
} from './model.js';
import { sectionCaps } from './geometry.js';
import { metadataOf } from './fixtures.js';
import { ease } from './stage.js';

const V3 = THREE.Vector3;
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const st = () => ctx.stage;

// A reference the fixture itself leaves unresolved. Nothing anywhere may upgrade this into a host: the
// last-seen locator is drawn, never read; a name or a nearby wall is never an answer.
const unresolvedArt = (t) => (t?.kind === 'art' && !W(t.item.wall)
  ? { why: 'its wall reference is unresolved', note: 'the marker is where it was last seen, not where it hangs' }
  : null);
export const isUnresolved = (id) => !!unresolvedArt(thing(id));
const MUSEUM_BOX = { x0: -15.4, x1: 11.3, z0: -5.9, z1: 5.9 };

// ---------------------------------------------------------------- standpoints

export const home3D = () => ({ target: new V3(-2.5, 1.2, 0.3), az: 0.72, el: 0.6, frameH: 25, flat: 0 });
export const planCam = () => ({ target: new V3(-2, 0, 0), az: 0, el: Math.PI / 2, frameH: st().fitFrame(13.8, 6.2, 1.18), flat: 1 });

export function viewKind() {
  if (S.session) return S.session.kind;
  return deg(st().cam.el) > 80 ? 'plan' : '3d';
}

export function viewLabel(s = S.session) {
  if (!s) return viewKind() === 'plan' ? 'Plan' : '3D';
  if (s.kind === 'face') {
    const from = s.side === -1 ? ' from outside' : '';
    if (s.u > 0.985) return `${s.wall.name} laid flat${from}`;
    if (s.u > 0.015) return `${s.wall.name} at ${Math.round(360 * (1 - s.u))}°${from}`;
    return `Facing ${s.focusName}${from}`;
  }
  if (s.kind === 'section') return `Opened along a line · ${lookWord(s.cut)}`;
  if (s.kind === 'lift') return `${C(s.ceilId).name} lifted`;
  if (s.kind === 'lookup') return `Looking up · ${C(s.ceilId).name}`;
  return '';
}

// The camera travels on one eased curve. `arc` lifts the eye mid-flight so the floor is seen
// on the way — a single beat that explains the move instead of a stop-and-go sequence.
export function camAt(a, b, e, arc = 0) { nav.camAt(a, b, e, arc); }

// Movement is asked of the navigation seam, which owns releasing any parked hold.
export const fly = (to, ms, arc = 0) => nav.fly(to, ms, arc);

// ---------------------------------------------------------------- recipes: what an open state is, exactly

// Everything needed to stand here again: which open state, its parameters, the camera, and what it
// was opened from. Used by the view trail and by Esc, so "back" and "history" restore identically.
function recipeOf(s = S.session) {
  const cam = st().camState();
  if (!s) return { kind: viewKind(), cam, hold: nav.hold(), label: viewLabel(null) };
  const r = { kind: s.kind, subject: s.subject ?? null, cam, label: viewLabel(s), parent: s.parent || null };
  if (s.kind === 'face') Object.assign(r, { id: s.focusId, wallId: s.wallId, opening: s.opening ?? null, u: s.u, side: s.side });
  if (s.kind === 'section') Object.assign(r, { cut: { ...s.cut }, reveal: S.reveal });
  if (s.kind === 'lift' || s.kind === 'lookup') Object.assign(r, { id: s.ceilId, mirror: st().cam.mirror });
  return r;
}

export function crumbs() {
  const out = [];
  let p = S.session?.parent;
  while (p) { out.unshift(p); p = p.parent; }
  return out;
}

// ---------------------------------------------------------------- trail (view history, never Undo)

// The navigation seam stores the trail; this layer supplies the complete reading recipe.
export function pushTrail(label) { nav.pushTrail(label, recipeOf()); }

// Re-enter a recipe exactly: same open state, same parameters, same camera, same nesting.
async function enterRecipe(e) {
  if (e.kind === 'plan' || e.kind === '3d') {
    if (S.session) await exitSessionInner(e.cam);
    else await fly(e.cam, dur('trail', 800));
    nav.restoreOriginHold(e);
    return;
  }
  const opts = { arrive: e.cam, subject: e.subject, parent: e.parent ?? null, label: e.label, restore: true };
  if (e.kind === 'face') await faceInner(e.subject ?? e.id, { ...opts, side: e.side, u: e.u });
  else if (e.kind === 'section') {
    await openSectionInner(e.cut, opts);
    if (e.reveal) toggleReveal(e.reveal, true);
  } else if (e.kind === 'lift') await liftInner(e.id, opts);
  else if (e.kind === 'lookup') await lookUpInner(e.id, { ...opts, mirror: e.mirror });
}

export const gotoTrail = (i) => run(async () => {
  // Trail transport is World work: its standpoints are World readings' recipes, and the Experience
  // writes no entries of its own. The control stays in the footer, but from the other lens it refuses.
  if (worldOnly()) return;
  const e = S.trail[i];
  if (!e) return;
  await nav.gotoTrail(i);
  setStatus(`Back to “${e.label}” exactly as you left it — a view change, so Undo is untouched`, 'view');
});

export const trailStep = (d) => {
  const i = S.trailPos + d;
  if (i >= 0 && i < S.trail.length) gotoTrail(i);
};

// ---------------------------------------------------------------- status

export function setStatus(text, kind = 'info') {
  S.status = { text, kind, t: performance.now() };
  ctx.ui();
}

// ---------------------------------------------------------------- selection

export function select(id) {
  if (id !== S.sel) cancelProposal('selection');
  const sd = st();
  if (S.sel && sd.items.has(S.sel)) sd.d(S.sel).hl = null;
  S.sel = id;
  if (id && sd.items.has(id)) sd.d(id).hl = 'sel';
  S.popover = null;
  if (S.beacon && S.beacon !== id) S.beacon = null;
  sd.restyle();
  ctx.ui();
}

export function setHover(id) {
  if (S.hover === id) return;
  const sd = st();
  if (S.hover && S.hover !== S.sel && sd.items.has(S.hover)) sd.d(S.hover).hl = null;
  S.hover = id;
  if (id && id !== S.sel && sd.items.has(id)) sd.d(id).hl = 'hover';
  sd.restyle();
}

// ---------------------------------------------------------------- sessions

const KIND = {};

// One lifecycle for every open state. Opening a different kind from inside one nests it (Esc steps
// back out to where you were); opening the same kind replaces it (hopping wall to wall).
async function openSession(sess, home, { label, narr, base = 1100, via = null, arrive = null, parent, onTween = null, arc = 0, restore = false, neutral = false } = {}) {
  cancelProposal('invoke');
  if (S.knife) cancelKnife(true);
  let origin, undoFrom;
  const epoch=nav.travelEpoch();
  const a0 = st().camState();
  const invocationOrigin = nav.captureOrigin(viewLabel(null));
  if(!neutral)nav.releaseHold();
  if (S.session) {
    const old = S.session;
    origin = old.origin;
    undoFrom = old.undoFrom;
    if (parent === undefined) parent = old.kind !== sess.kind ? recipeOf(old) : old.parent;
    const u0 = old.kind === 'face' ? old.u : 0;
    if(!neutral) await tween(dur('switch', u0 > 0.01 ? 700 : 420), (t) => {
      const e = ease(t);
      if (u0 > 0.01) applyUnroll(old, u0 * (1 - e));
      KIND[old.kind].apply(old, 1 - e);
    });
    if(epoch!==nav.travelEpoch())return;
    KIND[old.kind].teardown(old);
    S.session = null;
  } else {
    origin = invocationOrigin;
    undoFrom = S.undo.length;
    if (viewKind() === '3d') S.last3D = a0;
    parent = parent ?? null;
  }
  S.reveal = null;
  S.popover = null;
  S.summary = null;
  Object.assign(sess, { origin, undoFrom, parent, id: ++S.sid, home, settle: 0 });
  KIND[sess.kind].setup(sess);
  S.session = sess;
  ctx.ui();
  if(neutral) {
    KIND[sess.kind].apply(sess,1);onTween?.(1);
    narrate(null);pushTrail(label);return;
  }
  narrate(narr, sess.kind);
  const a = st().camState();
  const to = arrive || home;
  if (via && !restore) {
    await tween(dur(sess.kind, base * 0.45), (t) => {
      const e = ease(t);
      nav.lerpCam(a, via, e);
      KIND[sess.kind].apply(sess, 0.4 * e);
    });
    const b = st().camState();
    await tween(dur(sess.kind, base * 0.75), (t) => {
      const e = ease(t);
      nav.lerpCam(b, to, e);
      KIND[sess.kind].apply(sess, 0.4 + 0.6 * e);
    });
  } else {
    await tween(dur(restore ? 'trail' : sess.kind, restore ? 800 : base), (t) => {
      const e = ease(t);
      camAt(a, to, e, arc);
      KIND[sess.kind].apply(sess, e);
      onTween?.(e);
    });
  }
  if(epoch!==nav.travelEpoch())return;
  if (to.mirror != null) nav.setCam({mirror:to.mirror});
  saw(sess.kind);
  narrate(null);
  pushTrail(label);
}

// Close everything and return to the standpoint the first open state began from.
export async function exitSessionInner(toCam) {
  cancelProposal('return');
  const sess = S.session;
  const epoch=nav.travelEpoch();
  if (!sess) return;
  const to = toCam || nav.originPose(sess.origin);
  narrate(`Putting it back and returning to <b>${sess.origin.label}</b>.`, 'close');
  S.reveal = null;
  S.popover = null;
  const a = st().camState();
  const mirror = st().cam.mirror;
  const u0 = sess.kind === 'face' ? sess.u : 0;
  await tween(dur('close', u0 > 0.01 ? 1150 : 950), (t) => {
    const e = ease(t);
    camAt(a, to, e, u0 > 0.3 ? rad(14) : 0);
    if (mirror && e > 0.5) nav.setCam({mirror:false});
    if (u0 > 0.01) applyUnroll(sess, u0 * (1 - e));
    KIND[sess.kind].apply(sess, 1 - e);
  });
  if(epoch!==nav.travelEpoch())return;
  KIND[sess.kind].teardown(sess);
  S.session = null;
  T.end();
  nav.setCam({mirror:false});
  nav.restoreOriginHold(toCam ? null : sess.origin);
  saw('close');
  narrate(null);
  summarize(sess);
  pushTrail();
}

// The operation layer owns how a recipe is entered; the navigation seam owns the record.
nav.setEnterRecipe((e) => enterRecipe(e));
nav.setReadingLabel(() => viewLabel());

// Esc: one level out — back into the open state this one was opened from, exactly as it was.
export async function backInner() {
  cancelProposal('return');
  const s = S.session;
  if (!s) return;
  if (!s.parent) { await exitSessionInner(); return; }
  S.navTrail = true;
  try { await enterRecipe(s.parent); } finally { S.navTrail = false; }
  pushTrail();
}

export const closeSession = () => run(() => backInner());
export const closeAll = () => run(() => exitSessionInner());
// A breadcrumb: -1 is where the chain began (close everything); 0.. are the open states it passed through.
export const backTo = (depth) => run(async () => {
  const target = crumbs()[depth];
  if (depth < 0 || !target) return exitSessionInner();
  S.navTrail = true;
  try { await enterRecipe(target); } finally { S.navTrail = false; }
  pushTrail();
});

// On returning to where the chain began: the view is restored, and the building changes made while
// it was open are named — they stay unless you say otherwise. Makes "view state" and "edit" visibly different.
function summarize(sess) {
  const made = S.undo.slice(sess.undoFrom);
  if (!made.length) { S.summary = null; return; }
  S.summary = { from: sess.undoFrom, labels: made.map((m) => m.label), what: viewLabel(sess), t: performance.now() };
}

export function undoSummary() {
  const sm = S.summary;
  if (!sm) return;
  while (S.undo.length > sm.from) undo(true);
  S.summary = null;
  setStatus(`Undid ${sm.labels.length} change${sm.labels.length > 1 ? 's' : ''} made in “${sm.what}” — the view stayed where it is`, 'edit');
}

// ----- face: stand square to a wall, from either side -----

function resolveFace(id) {
  const t = thing(id);
  if (!t) return null;
  if (t.kind === 'openings') return { wall: t.wall, sA: t.item.s, focusId: id, focusName: t.item.name, opening: t.item.id };
  if (t.kind === 'walls') {
    const w = t.item;
    const sA = w.kind === 'arc' ? arcSNearCamera(w) : wallLength(w) / 2;
    return { wall: w, sA, focusId: id, focusName: w.name };
  }
  if (t.kind === 'art') {
    const w = W(t.item.wall);
    // No host, no walk: an unresolved reference is never faced by guessing a wall for it.
    if (!w) return null;
    return { wall: w, sA: t.item.s, focusId: w.id, focusName: `${t.item.name} on the ${w.name}` };
  }
  return null;
}

function arcSNearCamera(w) {
  const p = st().camera.position;
  const a = Math.atan2(p.z - w.cz, p.x - w.cx);
  return modS(w, (a - w.a0) * w.r);
}

// +1: the room side (the wall's normal, where its gallery is). −1: outside.
export function sideOfCamera(w, s) {
  const f = frameAt(w, s);
  const p = st().camera.position;
  return (p.x - f.x) * f.nx + (p.z - f.z) * f.nz >= 0 ? 1 : -1;
}

export function faceHome(s) {
  const w = s.wall;
  const f = frameAt(w, s.sA);
  const sd = s.side || 1;
  const az = Math.atan2(f.nx * sd, f.nz * sd);
  const H = maxTop(w);
  let tx = f.x, tz = f.z, hw = w.r ? w.r * 1.02 : 4;
  if (w.kind === 'line') {
    const m = frameAt(w, wallLength(w) / 2);
    tx = m.x; tz = m.z; hw = wallLength(w) / 2 + 0.7;
  }
  return { target: new V3(tx, H / 2 + 0.25, tz), az, el: 0, frameH: st().fitFrame(hw, H / 2 + 1.0, 1.1), flat: 1 };
}

function flatHome(s) {
  const w = s.wall;
  const h = faceHome(s);
  const hw = s.opening ? 4.6 : wallLength(w) / 2 + 1.2;
  return { ...h, target: h.target.clone(), frameH: st().fitFrame(hw, maxTop(w) / 2 + 1.4, 1.06) };
}

function faceClip(s) {
  const w = s.wall;
  const f = frameAt(w, s.sA);
  const sd = s.side || 1;
  const Fx = f.x + (f.nx * sd * w.thick) / 2, Fz = f.z + (f.nz * sd * w.thick) / 2;
  const depth = w.kind === 'arc' && sd === 1 ? w.r : 2.6;
  return new THREE.Plane(new V3(-f.nx * sd, 0, -f.nz * sd), sd * (f.nx * Fx + f.nz * Fz) + depth);
}

KIND.face = {
  setup(s) {
    const w = s.wall;
    s.wallId = w.id;
    s.side = s.side || 1;
    s.u = 0;
    const sd = st();
    for (const [id, it] of sd.items) {
      const keep = id === w.id || (it.kind === 'art' && it.data.wall === w.id) || it.kind === 'floor';
      sd.d(id).mode = keep ? 'normal' : 'ghost';
    }
    const ds = sd.d(w.id);
    ds.sA = s.sA; ds.u = 0;
    sd.refreshWall(w.id);
    s.clip = faceClip(s);
    sd.restyle();
  },
  apply(s, p) {
    s.settle = p;
    syncSheet(s.wallId);
  },
  teardown(s) {
    const sd = st();
    for (const id of sd.items.keys()) sd.d(id).mode = 'normal';
    const ds = sd.d(s.wallId);
    s.settle = 0;
    ds.u = 0; ds.sA = null; ds.sheet = false;
    sd.refreshWall(s.wallId);
    if (S.sel) sd.d(S.sel).hl = 'sel';
    sd.restyle();
  },
};

async function faceInner(id, opts = {}) {
  const r = resolveFace(id);
  if (!r) {
    const t = thing(id);
    const u = unresolvedArt(t);
    setStatus(u
      ? `${t.item.name}: ${u.why} — name the wall it belongs on with Repair, from its Card`
      : 'Select a wall, an opening or an artwork to face it', 'info');
    return;
  }
  const cur = S.session;
  const side = opts.side || 1;
  if (!opts.restore && cur?.kind === 'face' && cur.wallId === r.wall.id && cur.side === side) {
    if (Math.abs(cur.sA - r.sA) < 0.01 || cur.u > 0.5) {
      // The work asked for is the work already open: the task seam is brought back to the reading in
      // hand instead of being left pointing at whatever came before.
      resumeReadingTask();
      setStatus(`Already facing the ${r.wall.name}`, 'info');
      return;
    }
  }
  // The subject is what the user asked about; the wall is the technical target. An artwork on the
  // Rotunda wall keeps the artwork as its subject while the wall is the target.
  const sess = { kind: 'face', ...r, side, subject: opts.subject ?? id };
  // The focus is the local point the work is about — the opening you walked to, or the wall's own top.
  // It is what Precision offers numbers for, and it never becomes an identity.
  T.begin({
    kind: 'face', subject: sess.subject, target: { kind: 'wall', id: r.wall.id, label: r.wall.name },
    focus: r.opening ? { kind: 'opening', id: r.opening, label: `${r.focusName} in the ${r.wall.name}` } : { kind: 'wall-top', id: r.wall.id, label: `${r.wall.name} top` },
    params: { side },
  });
  const u = opts.u ?? 0;
  const home = faceHome(sess);
  const inRoom = byId(ctx.museum.galleries, r.wall.gallery).name;
  const narr = side === -1
    ? `Walking round to the outside of the <b>${r.wall.name}</b>. Left and right swap — you are on the other side of the same wall.`
    : r.wall.kind === 'arc'
      ? `Walking to the <b>${r.focusName}</b> and turning to face it from inside the ${inRoom}. When the view is square the mat becomes paper — the picture is now to scale in height.`
      : `Walking to the <b>${r.focusName}</b> and standing square to it. Everything in front is set aside, not removed.`;
  await openSession(sess, home, {
    ...opts, label: opts.label || `Facing ${r.focusName}${side === -1 ? ' from outside' : ''}`, narr, base: 1250,
    onTween: u > 0.001 ? (e) => applyUnroll(sess, u * e) : null,
  });
  if (u > 0.5) sess.home = flatHome(sess);
}

// Every way into spatial work goes through worldOnly(): while Experience is the lens in
// hand, World work is refused locally and by name, so crossing can never leave a half-invocation or a
// hidden task behind. See the lens section at the end of this file.
export const face = (id = S.sel, opts) => run(() => (worldOnly() ? null : faceInner(id, opts)));

// Inside / Outside: walk round the wall. The anchor stays put; the camera swings through 180°.
export const setSide = (side) => run(async () => {
  const s = S.session;
  if (s?.kind !== 'face' || s.side === side) return;
  s.side = side;
  s.clip = faceClip(s);
  const flat = s.u > 0.5;
  s.home = flat ? flatHome(s) : faceHome(s);
  const to = { ...st().camState(), az: s.home.az, target: s.home.target.clone(), el: s.home.el, frameH: st().cam.frameH, flat: s.home.flat };
  narrate(side === -1 ? 'Walking round to the outside. The window you were looking at is now on the other hand.' : 'Back inside the room.', 'side');
  await fly(to, dur('side', 900), rad(8));
  saw('side');
  narrate(null);
  pushTrail();
});

// ----- unfold: a curved wall laid flat around the anchor -----

// The paper-sheet material answers one question: is this wall being shown as a drawing? It is on
// for the settled subject of a face session — straight or curved, squared or tilted back to 3D, so
// no wall changes surface because of its kind or because the representation moved — and for any
// wall off its footprint, so an unrolled wall can never be mistaken for an authored change of
// shape. The curvature slider therefore never recolours a wall it is asked to roll.
export function sheetWanted(id) {
  if (!S.wallDrafting) return false; // Wall grid off: work on the wall's real material
  const s = S.session;
  const settled = s?.kind === 'face' && s.wallId === id && (s.settle ?? 0) > 0.5;
  return !!(settled || st().d(id).u > 0.01);
}

function syncSheet(id) {
  const sd = st(), ds = sd.d(id);
  const on = sheetWanted(id);
  if (ds.sheet !== on) { ds.sheet = on; sd.restyle(); }
}

// Re-decide every wall at once: used when the Wall grid control changes, since it is not tied to
// any one wall's gesture.
export function syncSheets() {
  for (const id of st().items.keys()) syncSheet(id);
}

export function applyUnroll(s, u) {
  s.u = u;
  const ds = st().d(s.wallId);
  ds.u = u;
  st().refreshWall(s.wallId);
  syncSheet(s.wallId);
}

// One beat: the wall unrolls while the camera travels, lifting slightly mid-flight so the
// floor footprint is in view at the moment the wall leaves it.
export async function unfoldInner(s) {
  const w = s.wall;
  if (w.kind !== 'arc') { setStatus(`The ${w.name} is straight, so its face is already to scale`, 'info'); return; }
  const to = flatHome(s);
  const u0 = s.u;
  s.unfolding = true;
  narrate(`Unrolling the <b>${w.name}</b> around the <b>${s.focusName}</b>. It never stretches: a metre along the curve stays a metre on the sheet. The dashed ring is the wall as built.`, 'unfold');
  const a = st().camState();
  await tween(dur('unfold', 1500), (t) => {
    const e = ease(t);
    applyUnroll(s, u0 + (1 - u0) * e);
    camAt(a, to, e, rad(20));
    KIND.face.apply(s, 1);
  });
  s.unfolding = false;
  s.home = to;
  saw('unfold');
  narrate(null);
  pushTrail(`${w.name} laid flat`);
}

// `id` is the subject asking to unroll — a Card or an Index row names its own subject, so the verb
// never depends on what happens to be selected. An open face session is only reused when it is
// already about that subject, target or focus; otherwise the walk starts from where you are.
const faceCovers = (s, id) => !!s && (!id || id === s.wallId || id === s.subject || id === s.focusId);

export const unfold = (id = S.sel) => run(async () => {
  if (worldOnly()) return;
  const s = S.session;
  if (s?.kind === 'face' && faceCovers(s, id)) {
    if (s.u > 0.99) return;
    await unfoldInner(s);
    return;
  }
  // from anywhere: walk, face and unroll in a single motion
  const r = resolveFace(id);
  if (!r) return;
  if (r.wall.kind !== 'arc') { await faceInner(id); return; }
  const sess = { kind: 'face', ...r, side: 1, subject: id ?? r.focusId };
  T.begin({
    kind: 'face', subject: sess.subject, target: { kind: 'wall', id: r.wall.id, label: r.wall.name },
    focus: r.opening ? { kind: 'opening', id: r.opening, label: `${r.focusName} in the ${r.wall.name}` } : { kind: 'wall-top', id: r.wall.id, label: `${r.wall.name} top` },
    params: { side: 1 },
  });
  const to = flatHome(sess);
  sess.unfolding = true;
  await openSession(sess, to, {
    label: `${r.wall.name} laid flat`,
    narr: `Unrolling the <b>${r.wall.name}</b> around the <b>${r.focusName}</b> as you walk to it. Lengths along the curve are kept; the dashed ring on the floor is the wall as built.`,
    base: 1600, arc: rad(22), onTween: (e) => applyUnroll(sess, e),
  });
  sess.unfolding = false;
  sess.home = to;
});

export const fold = () => run(async () => {
  const s = S.session;
  if (!s || s.kind !== 'face' || s.u < 0.01) return;
  const to = faceHome(s);
  const a = st().camState();
  const u0 = s.u;
  s.unfolding = true;
  await tween(dur('fold', 1100), (t) => { const e = ease(t); applyUnroll(s, u0 * (1 - e)); camAt(a, to, e, rad(14)); });
  s.unfolding = false;
  s.home = to;
  saw('fold');
  pushTrail();
});

export function scrubUnroll(u) {
  const s = S.session;
  if (!s || s.kind !== 'face' || s.wall.kind !== 'arc') return;
  applyUnroll(s, u);
}

// Curvature is a view you can stop anywhere and edit in: 0 = the round building, 1 = the flat sheet.
// Only the wall moves; the camera stays where you put it.
export const unrollTo = (u) => run(async () => {
  let s = S.session;
  if (!s || s.kind !== 'face') {
    await faceInner(S.sel);
    s = S.session;
  }
  if (!s || s.kind !== 'face' || s.wall.kind !== 'arc') return;
  const u0 = s.u;
  await tween(dur('curvature', 750), (t) => applyUnroll(s, u0 + (u - u0) * ease(t)));
  if (u > 0.5) s.home = flatHome(s);
  pushTrail();
});

// ----- peel: D's direct gesture, now stoppable anywhere -----
// Drag the dog-ear on a selected curved wall and the wall unrolls under your hand, in place, from
// where you stand. Let go and it stays at that curvature — an editable view, not a step on the way.

export function beginPeel(wallId, sA) {
  if (S.busy || S.session || S.knife) return null;
  const w = W(wallId);
  const side = sideOfCamera(w, sA);
  const r = resolveFace(S.sel && thing(S.sel)?.wall?.id === wallId ? S.sel : wallId) || {};
  const subject = r.opening ? S.sel : wallId;
  const sess = { kind: 'face', wall: w, sA, focusId: r.focusId || wallId, focusName: r.focusName || w.name, opening: r.opening, side, peeled: true, subject };
  T.begin({
    kind: 'face', subject, target: { kind: 'wall', id: wallId, label: w.name },
    focus: r.opening ? { kind: 'opening', id: r.opening, label: `${r.focusName} in the ${w.name}` } : { kind: 'wall-top', id: wallId, label: `${w.name} top` },
    params: { side, directly: true },
  });
  Object.assign(sess, { origin: nav.captureOrigin(viewLabel(null)), undoFrom: S.undo.length, parent: null, id: ++S.sid, settle: 1 });
  nav.releaseHold();
  if (viewKind() === '3d') S.last3D = st().camState();
  KIND.face.setup(sess);
  sess.home = faceHome(sess);
  S.session = sess;
  S.summary = null;
  syncSheet(w.id);
  ctx.ui();
  return sess;
}

export function peelTo(u) {
  const s = S.session;
  if (s?.kind !== 'face') return;
  applyUnroll(s, Math.max(0, Math.min(1, u)));
}

export function endPeel() {
  const s = S.session;
  if (s?.kind !== 'face') return;
  if (s.u < 0.04) {
    KIND.face.teardown(s);
    S.session = null;
    T.end();
    ctx.ui();
    return;
  }
  for (const d of [0.5, 0.75, 1]) if (Math.abs(s.u - d) < 0.035) applyUnroll(s, d);
  if (s.u > 0.5) s.home = flatHome(s);
  saw('peel');
  pushTrail();
  setStatus(`${viewLabel(s)} — stop anywhere; handles stay live. Square up to read it to scale, Esc rolls it back`, 'view');
}

export const squareUp = () => run(async () => {
  const s = S.session;
  if (s?.kind !== 'face') return;
  const w = s.wall;
  const base = s.u > 0.5 ? flatHome(s) : faceHome(s);
  const frameH = w.kind === 'arc' ? st().fitFrame(lerp(w.r * 1.02, s.opening ? 4.6 : wallLength(w) / 2 + 1.2, s.u), maxTop(w) / 2 + 1.3, 1.08) : base.frameH;
  const home = { ...base, target: base.target.clone(), frameH };
  s.home = home;
  await fly(home, dur('settle', 650));
  pushTrail();
});

export const stepBack = () => run(async () => {
  const s = S.session;
  if (s?.kind !== 'face') return;
  const w = s.wall;
  const Sm = st().sampler(w.id);
  const p = Sm.point(Sm.frameS(s.sA), 0, 1.9);
  const t = w.kind === 'arc' ? new V3(p[0], p[1], p[2]) : faceHome(s).target.clone();
  if (w.kind !== 'arc') t.y = 1.6;
  const frameH = w.kind === 'arc' ? st().fitFrame(lerp(w.r * 1.6, 6.5, s.u), 3.9, 1.05) : faceHome(s).frameH * 1.2;
  const to = { target: t, az: s.home.az + 0.62, el: 0.36, frameH, flat: 0 };
  narrate('Stepping back into 3D. The wall keeps its curvature and the handles you can still read stay live — the numbers are measured on the wall, not on the screen.', 'stepback');
  await fly(to, dur('stepback', 750));
  saw('stepback');
  pushTrail();
});

// ----- section: open the museum along a drawn line -----

export function makeCut(p0, p1, side, depth) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  const span = Math.hypot(dx, dz) || 1;
  const d = [dx / span, dz / span];
  const perp = [-d[1], d[0]];
  return { p: p0, p0, p1, d, n: [perp[0] * side, perp[1] * side], side, depth, span };
}

export function cutPlanes(cut) {
  const [nx, nz] = cut.n;
  const k = nx * cut.p[0] + nz * cut.p[1];
  const N = new V3(nx, 0, nz);
  return {
    keep: new THREE.Plane(N.clone(), -k),
    nearKeep: new THREE.Plane(N.clone().negate(), k),
    depthKeep: new THREE.Plane(N.clone().negate(), k + cut.depth),
    beyond: new THREE.Plane(N.clone(), -(k + cut.depth)),
  };
}

export function lookWord(cut) {
  const [nx, nz] = cut.n;
  const a = (Math.atan2(nx, -nz) * 180) / Math.PI;
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return 'looking ' + dirs[((Math.round(a / 45) % 8) + 8) % 8];
}

export function sectionHome(cut) {
  const [nx, nz] = cut.n;
  const az = Math.atan2(-nx, -nz);
  const corners = [[MUSEUM_BOX.x0, MUSEUM_BOX.z0], [MUSEUM_BOX.x1, MUSEUM_BOX.z0], [MUSEUM_BOX.x1, MUSEUM_BOX.z1], [MUSEUM_BOX.x0, MUSEUM_BOX.z1]];
  const ts = corners.map(([x, z]) => (x - cut.p[0]) * cut.d[0] + (z - cut.p[1]) * cut.d[1]);
  const lo = Math.max(0, Math.min(...ts)), hi = Math.min(cut.span, Math.max(...ts));
  const tm = hi > lo ? (lo + hi) / 2 : cut.span / 2;
  const half = hi > lo ? (hi - lo) / 2 : cut.span / 2;
  const cx = cut.p[0] + cut.d[0] * tm, cz = cut.p[1] + cut.d[1] * tm;
  return { target: new V3(cx, 3.2, cz), az, el: 0, frameH: st().fitFrame(half + 0.6, 4.1, 1.08), flat: 1 };
}

KIND.section = {
  setup(s) {
    s.planes = cutPlanes(s.cut);
    const sd = st();
    sd.buildAway('near', s.planes.nearKeep, { opacity: 0.12, lineOpacity: 0.45 });
    sd.buildAway('beyond', s.planes.beyond, { opacity: 0.0, lineOpacity: 0.2, linesOnly: true });
    s.caps = sectionCaps(ctx.museum, s.cut);
    sd.setSectionCaps(s.caps.quads);
    s.part = 0;
    S.tool = 'select';
  },
  apply(s, p) {
    s.settle = p;
    s.part = p;
    const [nx, nz] = s.cut.n;
    st().setAway('near', new V3(-nx * 7 * p, 0, -nz * 7 * p), 1 - 0.72 * p);
  },
  teardown(s) {
    const sd = st();
    sd.clearAway('near');
    sd.clearAway('beyond');
    sd.setSectionCaps(null);
    S.recentCut = { ...s.cut };
  },
};

export function refreshSection() {
  const s = S.session;
  if (!s || s.kind !== 'section') return;
  s.planes = cutPlanes(s.cut);
  s.caps = sectionCaps(ctx.museum, s.cut);
  st().setSectionCaps(s.caps.quads);
  const reveal = S.reveal;
  if (reveal) st().revealIn('beyond', reveal, false);
  st().buildAway('beyond', s.planes.beyond, { opacity: 0.0, lineOpacity: 0.2, linesOnly: true });
  st().buildAway('near', s.planes.nearKeep, { opacity: 0.12, lineOpacity: 0.45 });
  KIND.section.apply(s, s.part);
  if (reveal) st().revealIn(memberOf(reveal).state === 'away' ? 'near' : 'beyond', reveal, true);
}

async function openSectionInner(cut, opts = {}) {
  // A location-based cut with nothing selected records the explicit absence: no fabricated identity.
  const subject = opts.subject !== undefined ? opts.subject : S.sel;
  const sess = { kind: 'section', cut: { ...cut }, subject };
  T.begin({
    kind: 'section', subject, target: { kind: 'cut', label: lookWord(cut) },
    focus: { kind: 'cut', label: `the cut, ${lookWord(cut)}` },
    params: { depth: cut.depth, side: cut.side },
  });
  const home = sectionHome(sess.cut);
  const narr = `Parting the museum along your line. The near half slides toward you; the camera turns to face the cut, ${lookWord(cut)}. Ink marks everything the line passes through.`;
  await openSession(sess, home, { ...opts, label: opts.label || `Opened along a line · ${lookWord(cut)}`, narr, base: 1600 });
}

export const openSection = (cut) => run(() => (worldOnly() ? null : openSectionInner(cut)));

export function setDepth(v) {
  const s = S.session;
  const val = Math.max(0.5, Math.min(24, Math.round(v * 10) / 10));
  if (s?.kind === 'section') {
    if (S.reveal) { st().revealIn('beyond', S.reveal, false); st().revealIn('near', S.reveal, false); S.reveal = null; }
    s.cut.depth = val;
    refreshSection();
  } else if (S.knife) {
    S.knife.depth = val;
    S.knife.dirty = true;
  }
  ctx.ui();
}

// Slide the cut along its own normal. Its axis is along the line of sight in the section, so the
// control lives where that axis reads: the plan (the drawn line, or the locator).
export function slideCut(delta) {
  const s = S.session;
  if (s?.kind !== 'section') return;
  const cut = s.cut;
  const [nx, nz] = cut.n;
  cut.p0 = [cut.p0[0] + nx * delta, cut.p0[1] + nz * delta];
  cut.p1 = [cut.p1[0] + nx * delta, cut.p1[1] + nz * delta];
  cut.p = cut.p0;
  if (S.reveal) { st().revealIn('beyond', S.reveal, false); st().revealIn('near', S.reveal, false); S.reveal = null; }
  refreshSection();
  ctx.ui();
}

// Membership: evaluated once per cut and read by the drawing, the Navigator, the Inspector and Find.
export function memberOf(id) {
  const s = S.session;
  const t = thing(id);
  if (!t) return { state: 'none' };
  // An unresolved reference is not in any reading, any cut or any side: it has no place yet, and saying
  // otherwise would be the host guess this fixture exists to catch.
  const u = unresolvedArt(t);
  if (u) return { state: 'unresolved', reason: `${u.why} — ${u.note}` };
  if (!s) return { state: 'in' };
  if (s.kind === 'face') {
    const w = s.wall;
    if (id === w.id) return { state: s.u > 0.985 ? 'flat' : s.u > 0.015 ? 'opened' : 'facing' };
    if (t.kind === 'openings' && t.wall.id === w.id) return { state: 'in' };
    if (t.kind === 'art' && t.item.wall === w.id) return { state: 'in' };
    return { state: 'aside', reason: `set aside while you face the ${w.name}` };
  }
  if (s.kind === 'lift') return { state: id === s.ceilId ? 'lifted' : 'in' };
  if (s.kind !== 'section') return { state: 'in' };
  const [nx, nz] = s.cut.n;
  const dist = (x, z) => (x - s.cut.p[0]) * nx + (z - s.cut.p[1]) * nz;
  let ds = [];
  if (t.kind === 'walls') {
    const w = t.item, L = wallLength(w);
    for (let i = 0; i <= 40; i++) { const f = frameAt(w, (i / 40) * L); ds.push(dist(f.x, f.z)); }
  } else if (t.kind === 'openings') {
    const f = frameAt(t.wall, t.item.s);
    for (const o of [-t.item.w / 2, 0, t.item.w / 2]) ds.push(dist(f.x + f.tx * o, f.z + f.tz * o));
  } else if (t.kind === 'ceilings') ds = t.item.outline.map(([x, z]) => dist(x, z));
  else if (t.kind === 'art') {
    const f = frameAt(W(t.item.wall), t.item.s);
    for (const o of [-t.item.w / 2, t.item.w / 2]) ds.push(dist(f.x + f.tx * o, f.z + f.tz * o));
  } else ds.push(dist(t.item.x, t.item.z));
  const lo = Math.min(...ds), hi = Math.max(...ds);
  const D = s.cut.depth;
  if (lo < 0 && hi > 0) return { state: 'cut', lo, hi };
  if (hi < 0) return { state: 'away', reason: 'on the half that parted toward you', lo, hi };
  if (lo > D) return { state: 'beyond', reason: `${fmt(lo - D)} m beyond the ${fmt(D)} m depth`, lo, hi, need: Math.ceil((hi + 0.2) * 10) / 10 };
  return { state: 'in', lo, hi };
}

export function toggleReveal(id = S.sel, force) {
  if (worldOnly()) return;
  const m = memberOf(id);
  const t = thing(id);
  const srcId = t?.kind === 'openings' ? t.wall.id : id;
  const key = m.state === 'away' ? 'near' : 'beyond';
  if (S.reveal) {
    st().revealIn('near', S.reveal, false);
    st().revealIn('beyond', S.reveal, false);
    const was = S.reveal;
    S.reveal = null;
    if (was === srcId && !force) { setStatus('Reveal closed — the depth and the cut are as you left them', 'view'); return; }
  }
  if (m.state !== 'away' && m.state !== 'beyond') return;
  S.reveal = srcId;
  st().revealIn(key, srcId, true);
  if (!force) setStatus(`Showing the ${t.item.name} through, at its true place. Depth unchanged; nothing added to Undo`, 'view');
}

// B's recovery, kept: reach just far enough to include it — a view change with a number on it.
export function includeIt(id = S.sel) {
  if (worldOnly()) return;
  const m = memberOf(id);
  if (m.state !== 'beyond') return;
  const from = S.session.cut.depth;
  setDepth(m.need);
  pushTrail();
  setStatus(`Depth ${fmt(from)} → ${fmt(m.need)} m to include the ${thing(id).item.name} — a view change, not in Undo`, 'view');
}

// … or go to the wall that hosts it. It nests, so Esc comes straight back to this cut and depth.
export const goToHost = (id = S.sel) => run(async () => {
  if (worldOnly()) return;
  const t = thing(id);
  if (!t) return;
  if (t.kind === 'walls' || t.kind === 'openings' || t.kind === 'art') await faceInner(id);
  else if (t.kind === 'ceilings') await liftInner(id);
  else setStatus(`${t.item.name} is staged content — look at it in 3D, edit it in Arrange`, 'info');
});

// Open the place that holds a record: the same specialist reading an Index row or a Card verb would
// invoke, on the named record rather than on the selection. A record with no Stage geometry has no
// place to open, and says where it really lives instead of flying somewhere plausible.
export const openLocation = (id = S.sel) => run(async () => {
  if (worldOnly()) return;
  const t = thing(id);
  if (!t) {
    const r = metadataOf(id);
    setStatus(r
      ? `The ${r.name} is a record with no Stage location — kept in the ${r.where}, so there is nothing here to open`
      : 'Select a wall, an opening, a ceiling or an artwork to open its location', 'info');
    return;
  }
  if (unresolvedArt(t)) { await faceInner(id); return; }
  if (t.kind === 'ceilings') await liftInner(id);
  else if (t.kind === 'objects') setStatus(`${t.item.name} is staged content — no specialist depth in this prototype. Select it, or bring it into view`, 'info');
  else await faceInner(id);
});

// ----- where is it? one resolver for Find, the Inspector and the beacon -----

export function worldOf(id) {
  const t = thing(id);
  if (!t) return null;
  // Where it *is*: an unresolved reference has nowhere yet. Its last-seen locator is drawn by the
  // Stage, and returning it here would let membership, the beacon and Look treat a display position as
  // a real one.
  if (unresolvedArt(t)) return null;
  if (t.kind === 'art') { const w = W(t.item.wall); const f = frameAt(w, t.item.s); const o = w.thick / 2 + 0.06; return [f.x + f.nx * o, t.item.y, f.z + f.nz * o]; }
  if (t.kind === 'openings') { const f = frameAt(t.wall, t.item.s); return [f.x, (t.item.sill + t.item.head) / 2, f.z]; }
  if (t.kind === 'walls') { const w = t.item; const f = frameAt(w, w.kind === 'arc' ? arcSNearCamera(w) : wallLength(w) / 2); return [f.x, maxTop(w) * 0.6, f.z]; }
  if (t.kind === 'ceilings') { const [x, z] = centroid(t.item.outline); return [x, planeY(t.item.plane, x, z), z]; }
  if (t.kind === 'objects') return [t.item.x, 1.2, t.item.z];
  return null;
}

export function whereIs(id) {
  const t = thing(id);
  if (!t) return { state: 'none' };
  const m = memberOf(id);
  if (m.state === 'unresolved' || m.state === 'beyond' || m.state === 'away' || m.state === 'aside') return m;
  const p = worldOf(id);
  if (!p) return { ...m, state: 'unresolved', reason: 'it has no place in this museum yet' };
  const q = st().project(p);
  const pad = 20;
  if (q.behind || q.x < pad || q.y < pad || q.x > st().w - pad || q.y > st().h - pad) return { ...m, state: 'off', reason: 'outside the frame from where you stand' };
  const host = t.kind === 'openings' ? t.wall.id : null;
  const occ = st().occluder(new V3(...p), (d) => d.id !== id && d.id !== host);
  if (occ) {
    const o = thing(occ);
    return { ...m, state: 'behind', reason: `behind the ${o ? o.item.name : 'architecture'} from here`, occ };
  }
  return { ...m, state: m.state === 'in' ? 'visible' : m.state };
}

export const lookAt = (id = S.sel) => run(async () => {
  const t = thing(id);
  const pos = worldOf(id);
  if (!t || !pos) {
    const u = unresolvedArt(t);
    setStatus(u ? `There is nothing to bring into view — ${t.item.name}: ${u.why}` : 'Nothing to bring into view', 'info');
    return;
  }
  const p = new V3(...pos);
  let az = st().cam.az;
  if (t.kind === 'art' || t.kind === 'openings') {
    const w = t.kind === 'art' ? W(t.item.wall) : t.wall;
    const f = frameAt(w, t.item.s);
    az = Math.atan2(f.nx, f.nz);
  }
  if (S.session) await exitSessionInner({ target: p, az, el: 0.42, frameH: 11, flat: 0 });
  else await fly({ target: p, az, el: 0.42, frameH: 11, flat: 0 }, dur('lookat', 900));
  pushTrail(`Looking at ${t.item.name}`);
});

// ----- knife: draw the line, see the cut before committing -----

export function startKnife() {
  if (worldOnly()) return null;
  run(async () => {
    if (S.session) await exitSessionInner();
    S.tool = 'knife';
    S.knife = { stage: 'draw', p0: null, p1: null, side: 1, depth: 6, dirty: true };
    narrate('Draw a line through the museum. You will see what it reveals before anything opens — then slide it to compare.', 'knife');
    ctx.ui();
  });
}

export function defaultSide(p0, p1) {
  const cut = makeCut(p0, p1, 1, 6);
  if (viewKind() === 'plan') {
    if (Math.abs(cut.n[1]) > 0.3) return cut.n[1] < 0 ? 1 : -1;
    return cut.n[0] > 0 ? 1 : -1;
  }
  const cp = st().camera.position;
  const toCam = (cp.x - p0[0]) * cut.n[0] + (cp.z - p0[1]) * cut.n[1];
  return toCam > 0 ? -1 : 1;
}

export function knifeCut() {
  const k = S.knife;
  if (!k?.p0 || !k.p1) return null;
  return makeCut(k.p0, k.p1, k.side, k.depth);
}

export function flipKnife() {
  if (S.knife?.p1) { S.knife.side *= -1; S.knife.dirty = true; ctx.ui(); }
}

export function cancelKnife(quiet) {
  S.knife = null;
  S.tool = 'select';
  st().clearAway('preview');
  st().setSectionCaps(null);
  narrate(null);
  if (!quiet) setStatus('Line cleared — nothing was opened', 'view');
  ctx.ui();
}

export function commitKnife() {
  const cut = knifeCut();
  if (!cut) return;
  if (cut.span < 1) { setStatus('Draw a longer line — at least a metre', 'info'); return; }
  st().clearAway('preview');
  S.knife = null;
  return openSection(cut);
}

export function presetKnife(p0, p1, side, depth = 6) {
  S.tool = 'knife';
  S.knife = { stage: 'aim', p0, p1, side, depth, dirty: true };
  ctx.ui();
}

// ----- the same line, defined by keys ------------------------------------
// A line is a line whether it was dragged or typed: the same two points, the same side, the same depth,
// and the same later commands (slide, flip, open). With nothing drawn yet the first key seeds a line
// across the museum — a starting position the editor then moves, not a guess at what they meant.
export function knifeLine() {
  const k = S.knife;
  if (!k) return null;
  if (!k.p1) {
    const p0 = [-17, 0.25], p1 = [13, 0.25];
    Object.assign(k, { p0, p1, side: defaultSide(p0, p1), stage: 'aim', dirty: true });
    setStatus('Line drawn from the keyboard — ← → slide it, ↑ ↓ turn it, − = set the depth, Tab looks the other way, ↵ opens it, Esc drops it', 'view');
    ctx.ui();
  }
  return knifeCut();
}

// Slide the whole line along its own normal: the cut moves through the building, nothing opens.
export function slideKnife(d) {
  const k = S.knife;
  const cut = knifeLine();
  if (!cut) return null;
  k.p0 = [k.p0[0] + cut.n[0] * d, k.p0[1] + cut.n[1] * d];
  k.p1 = [k.p1[0] + cut.n[0] * d, k.p1[1] + cut.n[1] * d];
  k.dirty = true;
  setStatus(`Line slid ${fmt(Math.abs(d))} m — a view reading; nothing has opened`, 'view');
  ctx.ui();
  return knifeCut();
}

// Turn it about its own midpoint: the same centre, a different way through the museum.
export function turnKnife(deg) {
  const k = S.knife;
  if (!knifeLine()) return null;
  const r = rad(deg);
  const mx = (k.p0[0] + k.p1[0]) / 2, mz = (k.p0[1] + k.p1[1]) / 2;
  const rot = ([x, z]) => [
    mx + (x - mx) * Math.cos(r) - (z - mz) * Math.sin(r),
    mz + (x - mx) * Math.sin(r) + (z - mz) * Math.cos(r),
  ];
  k.p0 = rot(k.p0);
  k.p1 = rot(k.p1);
  k.dirty = true;
  setStatus(`Line turned ${Math.abs(deg)}° about its centre — the width it crosses is unchanged`, 'view');
  ctx.ui();
  return knifeCut();
}

// How far in the picture reaches. A view setting with a number on it, like the Instrument's depth
// control in an open section: half-metre steps, and the same rule for the keys as for the drag.
export function depthKnife(d) {
  const k = S.knife;
  if (!k) return null;
  k.depth = Math.max(0.5, Math.min(30, Math.round((k.depth + d) * 2) / 2));
  k.dirty = true;
  setStatus(`Depth ${fmt(k.depth)} m — how far the picture reaches. A view setting, not an edit`, 'view');
  ctx.ui();
  return k.depth;
}

// ----- lift: raise a ceiling like a lid -----

KIND.lift = {
  setup(s) {
    const sd = st();
    for (const c of ctx.museum.ceilings) if (c.id !== s.ceilId) sd.d(c.id).mode = 'ghost';
    sd.d(s.ceilId).lifted = true;
    s.flatWanted = 0;
    sd.restyle();
  },
  apply(s, p) {
    s.settle = p;
    st().d(s.ceilId).y = 2.6 * p;
    st().refreshCeiling(s.ceilId);
    s.lift = p;
  },
  teardown(s) {
    const sd = st();
    const ds = sd.d(s.ceilId);
    ds.y = 0; ds.lifted = false;
    for (const c of ctx.museum.ceilings) sd.d(c.id).mode = 'normal';
    sd.refreshCeiling(s.ceilId);
    sd.clearGroup(sd.fx);
    sd.restyle();
  },
};

function liftHome(c) {
  const b = bbox(c.outline);
  return { target: new V3(b.cx, 3.4, b.cz), az: 0.6, el: 0.74, frameH: st().fitFrame(Math.max(b.w, b.d) / 2 * 0.95, 5, 1.2), flat: 0 };
}

async function liftInner(id, opts = {}) {
  const c = C(id);
  if (!c) return;
  const sess = { kind: 'lift', ceilId: id, subject: opts.subject ?? id };
  T.begin({ kind: 'lift', subject: sess.subject, target: { kind: 'ceiling', id, label: c.name }, focus: { kind: 'underside', id, label: `${c.name} underside` } });
  const narr = `Lifting the <b>${c.name}</b> off its walls. Every wall it rests on is tethered and named — gaps show in coral, openings meant to be open in green. The dashed outline is where it really is.`;
  await openSession(sess, liftHome(c), { ...opts, label: opts.label || `${c.name} lifted`, narr, base: 1200 });
}

export const lift = (id = S.sel) => run(() => (worldOnly() ? null : liftInner(id)));

// ----- in place: the measurement task -----
// The numbers of a subject, in place: nothing opens, nothing moves, no reading is entered. What is
// reported is what the fixture really carries — a wall's length, height and thickness, an opening's
// width, sill and head, a ceiling's underside and footprint — and each value keeps the one validated
// edit path the Card uses. Invoking it again on the same subject puts it away.
export function dimensionTask(id = S.sel) {
  if (worldOnly()) return null;
  const t = thing(id);
  if (!t || !T.capabilities(id).includes('dims')) return null;
  if (S.task?.kind === 'dims' && S.task.subject === id) { endTaskInHand(); return null; }
  T.begin({ kind: 'dims', subject: id, target: { kind: t.kind, id, label: t.item.name }, focus: { kind: 'measure', id, label: t.item.name } });
  setStatus(`Measuring the ${t.item.name} — read-only where the fixture has no authored value, and editable where it does`, 'info');
  ctx.ui();
  return S.task;
}

// ----- repair: a reference the fixture leaves unresolved -----
// The panel's `wall` is explicitly null. Repair is its own work: it opens no reading and moves nothing,
// it records the wall the editor explicitly picks and the station and height they declare, it draws the
// declared candidate where it would hang, and it writes exactly one source edit on acceptance. Leaving
// it unresolved writes nothing at all. Nothing here is inferred — not from the last-seen locator, not
// from the nearest wall, not from a name: the only input that can resolve a reference is a chosen wall
// plus values that pass the fixture's own validation.
const artOf = (id) => ctx.museum.art.find((x) => x.id === id) || null;
const round2 = (v) => Math.round(v * 20) / 20;

function drawRepairPreview() {
  const t = S.task;
  if (t?.kind !== 'repair') return null;
  if (!t.params.wall) { ctx.stage.clearArtPreview(); return null; }
  return ctx.stage.setArtPreview({ art: t.subject, wall: t.params.wall, s: t.params.s, y: t.params.y });
}

export function repairTask(id = S.sel) {
  if (worldOnly()) return null;
  const t = thing(id);
  if (!t || !T.capabilities(id).includes('repair')) return null;
  if (S.task?.kind === 'repair' && S.task.subject === id) { endTaskInHand(); return null; }
  T.begin({
    kind: 'repair', subject: id,
    target: { kind: 'reference', id, label: `${t.item.name} · wall reference` },
    focus: { kind: 'reference', id, label: 'the unresolved wall reference' },
    params: { wall: null, s: round2(t.item.s || 0), y: t.item.y },
  });
  setStatus(`${t.item.name} has no wall reference. Pick the wall it belongs on — the candidate is drawn, and nothing is written until you accept`, 'info');
  ctx.ui();
  return S.task;
}

// An explicit pick, checked against the fixture's own walls. The station defaults to the middle of the
// wall that was chosen and the height to the panel's own stored value: both declared, both visible, and
// neither of them read from the last-seen marker.
export function pickRepairWall(wallId) {
  const t = S.task;
  if (t?.kind !== 'repair') return 'No repair is in hand';
  const w = W(wallId);
  if (!w) return 'That is not a wall in this museum — pick one of the walls offered';
  t.params = { ...t.params, wall: w.id, s: round2(wallLength(w) / 2) };
  drawRepairPreview();
  // The declared default is the middle of the wall, and it is checked like any other declared value:
  // when the fixture refuses it, that is said out loud rather than nudged into something it likes.
  const err = validateArtPlacement(w, artOf(t.subject), t.params);
  setStatus(err
    ? `Candidate: the ${w.name}. The middle of the wall would not take it — ${err}. Declare a station that clears it; nothing is written yet`
    : `Candidate: the ${w.name}, station ${fmt(t.params.s)} along it and centre height ${fmt(t.params.y)}. Drawn where it would hang; nothing written`,
    err ? 'refuse' : 'view');
  ctx.ui();
  return null;
}

// The declared values go through the same one cast as every other number, and are refused in place with
// the fixture's reason: a refusal leaves the declaration and the preview exactly as they were.
export function declareRepair(key, value) {
  const t = S.task;
  if (t?.kind !== 'repair') return 'No repair is in hand';
  if (!Number.isFinite(value)) return 'Type a number in metres';
  const a = artOf(t.subject);
  const w = W(t.params.wall);
  if (!w) return 'Choose a wall first';
  const next = { ...t.params, [key]: key === 's' ? round2(value) : Math.round(value * 100) / 100 };
  const err = validateArtPlacement(w, a, next);
  if (err) return err;
  t.params = next;
  drawRepairPreview();
  setStatus(`${key === 's' ? 'Station' : 'Centre height'} ${fmt(t.params[key])} — declared and drawn, not yet written`, 'view');
  ctx.ui();
  return null;
}

// Acceptance: one validated source edit, one Undo entry, and the work ends because the reference it was
// about is resolved. A refusal changes nothing and leaves the candidate standing.
export function acceptRepair() {
  const t = S.task;
  if (t?.kind !== 'repair') return 'No repair is in hand';
  const a = artOf(t.subject);
  const w = W(t.params.wall);
  const err = editOnce(`Repaired the wall reference of the ${a.name}`, () => applyArtPlacement(a.id, { wall: t.params.wall, s: t.params.s, y: t.params.y }));
  if (err) { setStatus(`Refused — ${err}. Nothing changed.`, 'refuse'); ctx.ui(); return err; }
  endTaskInHand();
  setStatus(`The ${a.name} now hangs on the ${w.name} — one Undo entry puts the reference back`, 'edit');
  ctx.ui();
  return null;
}

// The other honest ending, and the only one Esc needs: the reference stays exactly as the fixture has it.
export function leaveRepair() {
  const t = S.task;
  if (t?.kind !== 'repair') return false;
  const a = artOf(t.subject);
  endTaskInHand();
  setStatus(`${a ? a.name : 'The reference'} stays unresolved — nothing was written, and the marker is still where it was last seen`, 'info');
  ctx.ui();
  return true;
}

// The reading in hand always has its task. Dismissing overlay work (an in-place measurement, later a
// repair) returns the seam to the reading underneath it, and an invocation that finds the reading
// already open records its work rather than leaving the task stale. The reading itself is untouched:
// nothing is re-entered, nothing moves, no history is written.
export function resumeReadingTask() {
  const s = S.session;
  if (!s) return null;
  if (S.task && S.task.kind === s.kind) return S.task;
  if (s.kind === 'face') {
    T.begin({
      kind: 'face', subject: s.subject ?? s.focusId, target: { kind: 'wall', id: s.wallId, label: s.wall.name },
      focus: s.opening ? { kind: 'opening', id: s.opening, label: `${s.focusName} in the ${s.wall.name}` } : { kind: 'wall-top', id: s.wallId, label: `${s.wall.name} top` },
      params: { side: s.side, resumed: true },
    });
  } else if (s.kind === 'section') {
    T.begin({
      kind: 'section', subject: s.subject ?? null, target: { kind: 'cut', label: lookWord(s.cut) },
      focus: { kind: 'cut', label: `the cut, ${lookWord(s.cut)}` }, params: { depth: s.cut.depth, side: s.cut.side, resumed: true },
    });
  } else if (s.kind === 'lift' || s.kind === 'lookup') {
    const name = C(s.ceilId)?.name || s.ceilId;
    T.begin({
      kind: s.kind, subject: s.subject ?? s.ceilId, target: { kind: 'ceiling', id: s.ceilId, label: name },
      focus: { kind: 'underside', id: s.ceilId, label: `${name} underside` }, params: { resumed: true },
    });
  }
  ctx.ui();
  return S.task;
}

// Putting away work that is not the reading's own surface: the reading underneath comes back with its
// own task, so the Instrument that reappears is never a surface without a task behind it.
export function endTaskInHand() {
  cancelProposal('task-end');
  T.end();
  // Unaccepted work does not outlive the work it belonged to: a declared candidate is taken off the
  // drawing here, on every exit path, whether the work was left unresolved or something replaced it.
  ctx.stage?.clearArtPreview();
  resumeReadingTask();
  ctx.ui();
}

// Precision belongs to the active task, so it is entered and left through the seam; exiting restores
// the task surface with nothing else changed.
export function setPrecision(on) {
  if (!S.task) return false;
  const next = T.setPrecision(on);
  setStatus(next
    ? 'Precision: the numbers of this work, reached by keyboard — no handle has to be legible to type a value'
    : 'Precision off: back to the drawing', 'view');
  ctx.ui();
  return next;
}

// D's lid tab: drag the lid up from where you stand. Past a third it finishes lifting; less and it drops back.
export function beginLid(id) {
  if (S.busy || S.session || S.knife) return null;
  const sess = { kind: 'lift', ceilId: id, direct: true, subject: S.sel ?? id };
  T.begin({ kind: 'lift', subject: sess.subject, target: { kind: 'ceiling', id, label: C(id)?.name || id }, focus: { kind: 'underside', id, label: `${C(id)?.name || id} underside` } });
  Object.assign(sess, { origin: nav.captureOrigin(viewLabel(null)), undoFrom: S.undo.length, parent: null, id: ++S.sid });
  nav.releaseHold();
  if (viewKind() === '3d') S.last3D = st().camState();
  KIND.lift.setup(sess);
  sess.home = st().camState();
  S.session = sess;
  S.summary = null;
  ctx.ui();
  return sess;
}
export function lidTo(p) {
  const s = S.session;
  if (s?.kind === 'lift') KIND.lift.apply(s, Math.max(0, Math.min(1, p)));
}
export const endLid = () => run(async () => {
  const s = S.session;
  if (s?.kind !== 'lift') return;
  const p0 = s.lift || 0;
  if (p0 < 0.3) {
    await tween(dur('lid', 300), (t) => KIND.lift.apply(s, p0 * (1 - ease(t))));
    KIND.lift.teardown(s);
    S.session = null;
    T.end();
    ctx.ui();
    return;
  }
  await tween(dur('lid', 380), (t) => KIND.lift.apply(s, p0 + (1 - p0) * ease(t)));
  pushTrail(`${C(s.ceilId).name} lifted`);
});

export function lidRelations(c) {
  const out = [];
  if (c.rel !== 'closure') return out;
  for (const w of ctx.museum.walls) {
    const L = wallLength(w);
    const n = Math.max(6, Math.ceil(L / 0.5));
    const samples = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * L;
      const f = frameAt(w, s);
      for (const side of [1, -1]) {
        const off = side * (w.thick / 2 + 0.08);
        const px = f.x + f.nx * off, pz = f.z + f.nz * off;
        if (pointInPoly(px, pz, c.outline) && !c.holes.some((h) => pointInPoly(px, pz, h.pts))) {
          samples.push({ s, x: f.x, z: f.z, top: topAt(w, s), cy: planeY(c.plane, f.x, f.z) });
          break;
        }
      }
    }
    if (samples.length < 3) continue;
    const gaps = samples.map((p) => p.cy - p.top);
    const maxGap = Math.max(...gaps), minGap = Math.min(...gaps);
    let status = 'meets';
    if (maxGap > 0.02) status = c.intended.includes(w.id) ? 'intended' : 'gap';
    out.push({ wall: w, status, gap: maxGap, above: -minGap, samples });
  }
  return out;
}

export function gapOptions(wallId, ceilId) {
  const w = W(wallId), c = C(ceilId);
  const rel = lidRelations(c).find((r) => r.wall.id === wallId);
  if (!rel) return [];
  const cy = Math.max(...rel.samples.map((p) => p.cy));
  const top = minTopOf(rel);
  const others = lidRelations(c).filter((r) => r.wall.id !== wallId && r.status === 'meets' && Math.min(...r.samples.map((p) => p.top)) < planeY(c.plane, 0, 0) + 0.5);
  return [
    { id: 'raise', t: `Raise the ${w.name} to meet it`, s: `top ${fmt(top)} → ${fmt(cy)}`, label: `Raise ${w.name}`, apply: () => applyWallTop(wallId, { form: 'constant', h: cy }) },
    { id: 'lower', t: `Lower the ceiling to ${fmt(top)}`, s: others.length ? `${others.map((r) => r.wall.name).join(' and ')} would then stand ${fmt(cy - top)} above it` : 'every wall still meets it', label: `Lower ${c.name}`, apply: () => applyCeiling(ceilId, { plane: { ...c.plane, base: top } }) },
    { id: 'keep', t: 'Keep the gap — it is meant to be open', s: 'draws it in green and stops the warning', label: `Mark gap above ${w.name} as intended`, intent: true, apply: () => { C(ceilId).intended.push(wallId); return null; } },
  ];
}
const minTopOf = (rel) => Math.min(...rel.samples.map((p) => p.top));

export function previewOption(opt) {
  if (!S.preview) S.preview = clone(ctx.museum);
  restoreQuiet(clone(S.preview));
  opt.apply();
}
export function unpreview() {
  if (!S.preview) return;
  restoreQuiet(S.preview);
  S.preview = null;
}
export function commitOption(opt) {
  unpreview();
  beginEdit();
  const err = opt.apply();
  if (err) { cancelEdit(); setStatus(err, 'refuse'); return; }
  S.popover = null;
  commitEdit(opt.label);
}

// ----- look up: the same model seen from below -----

KIND.lookup = {
  setup(s) {
    s.cutH = 1.6;
    s.h = -0.6;
    const sd = st();
    sd.d(s.ceilId).solid = true;
  },
  apply(s, p) {
    s.settle = p;
    s.h = lerp(-0.6, s.cutH, smooth(0.42, 0.8, p));
    st().groundOn = p < 0.45;
  },
  teardown(s) {
    st().groundOn = true;
    st().d(s.ceilId).solid = false;
    st().setHorizontalCaps(null);
    nav.setCam({mirror:false});
  },
};

export function ceilingForSelection() {
  const t = thing(S.sel);
  if (!t) return 'longc';
  if (t.kind === 'ceilings') return t.item.id;
  const g = t.item.gallery || (t.wall && t.wall.gallery) || (t.kind === 'art' && W(t.item.wall)?.gallery);
  return g === 'rotunda' ? 'rotc' : 'longc';
}

async function lookUpInner(id, opts = {}) {
  const c = C(id);
  if (!c) return;
  const b = bbox(c.outline);
  const home = { target: new V3(b.cx, 3, b.cz), az: Math.PI, el: -Math.PI / 2 + 1e-4, frameH: st().fitFrame(b.w / 2 + 0.8, b.d / 2 + 0.8, 1.14), flat: 1 };
  const via = { target: new V3(b.cx, 1.4, b.cz), az: Math.PI, el: 0.34, frameH: st().fitFrame(b.w / 2 + 0.8, 3.4, 1.1), flat: 0 };
  const sess = { kind: 'lookup', ceilId: id, subject: opts.subject ?? id };
  T.begin({ kind: 'lookup', subject: sess.subject, target: { kind: 'ceiling', id, label: c.name }, focus: { kind: 'underside', id, label: `${c.name} underside` } });
  const narr = `Settling the lid, then sinking below the floor to look straight up. Everything under <b>1.60</b> above the floor is sliced away, so the ceiling reads like a plan seen from underneath. East is on your left — you are looking up, not down.`;
  const arrive = opts.arrive ? { ...opts.arrive, mirror: opts.mirror ?? false } : null;
  await openSession(sess, home, { ...opts, arrive, label: opts.label || `Looking up · ${c.name}`, narr, base: 1900, via });
}

export const lookUp = (id) => run(() => (worldOnly() ? null : lookUpInner(id || ceilingForSelection())));

export function toggleMirror() {
  if (S.session?.kind !== 'lookup') return;
  nav.setCam({mirror:!st().cam.mirror});
  setStatus(st().cam.mirror ? 'Mirrored to match Plan — east is on the right, as in Plan' : 'As seen from below — east is on your left', 'view');
}

// ----- durable views -----

export const goPlan = () => run(async () => {
  if (S.knife && !S.knife.p1) cancelKnife(true);
  if (S.session) await exitSessionInner(planCam());
  else if (viewKind() !== 'plan') {
    S.last3D = st().camState();
    narrate('Tilting down into <b>Plan</b>: the same model from straight above, cut at <b>1.20</b> above the floor. Nothing was redrawn — and the selection’s handles came with you.', 'plan');
    await fly(planCam(), dur('plan', 1150));
    saw('plan');
  }
  pushTrail('Plan');
});

export const go3D = () => run(async () => {
  const to = S.last3D || home3D();
  to.flat = 0;
  if (S.session) await exitSessionInner(to);
  else if (viewKind() !== '3d') {
    narrate('Tilting back up into <b>3D</b>. The plan cut rises out of the building as perspective returns.', '3d');
    await fly(to, dur('3d', 1050));
    saw('3d');
  }
  pushTrail('3D');
});

export const resetView = () => run(async () => {
  if (S.session) await exitSessionInner(home3D());
  else await fly(home3D(), dur('3d', 900));
  pushTrail('3D');
});

// ---------------------------------------------------------------- edits (the only things Undo knows)

export function beginEdit() { if (!S.pending) { S.pending = clone(ctx.museum); S.pendingDomains = domainSnapshot(); } }
export const domainSnapshot = () => ({ experience: clone(ctx.experience), cameraSource: clone(ctx.cameraSource), sceneSource: clone(ctx.sceneSource) });

export function commitEdit(label) {
  if (!S.pending) return;
  if (JSON.stringify(S.pending) === JSON.stringify(ctx.museum) && JSON.stringify(S.pendingDomains) === JSON.stringify(domainSnapshot())) { S.pending = null; return; }
  S.undo.push({ label, before: S.pending, domains: S.pendingDomains, sel: S.sel });
  S.redo = [];
  S.pending = null;
  if (!S.session) S.summary = null;
  setStatus(`${label} · added to Undo`, 'edit');
}

export function cancelEdit() {
  if (!S.pending) return;
  restoreQuiet(S.pending, S.pendingDomains);
  S.pending = null;
}

export function restoreQuiet(m, domains) {
  if (domains) { ctx.experience = clone(domains.experience); ctx.cameraSource = clone(domains.cameraSource); ctx.sceneSource = clone(domains.sceneSource); }
  ctx.museum = m;
  st().setMuseum(m);
  buildCapabilitySubjects();
  const s = S.session;
  if (s?.kind === 'face') { s.wall = W(s.wallId); }
  if (s?.kind === 'section') refreshSection();
  st().capsDirty = true;
  ctx.ui();
}

export function undo(quiet) {
  const e = S.undo.pop();
  if (!e) { setStatus('Nothing to undo', 'info'); return; }
  S.redo.push({ label: e.label, before: clone(ctx.museum), domains: domainSnapshot(), sel: S.sel });
  restoreQuiet(e.before, e.domains);
  select(e.sel);
  if (!quiet && S.summary) S.summary = null;
  if (!quiet) setStatus(`Undid “${e.label}” — your view stayed where it is`, 'edit');
}

export function redo() {
  const e = S.redo.pop();
  if (!e) { setStatus('Nothing to redo', 'info'); return; }
  S.undo.push({ label: e.label, before: clone(ctx.museum), domains: domainSnapshot(), sel: S.sel });
  restoreQuiet(e.before, e.domains);
  select(e.sel);
  setStatus(`Redid “${e.label}”`, 'edit');
}

function afterWall(id) {
  st().refreshWall(id);
  st().capsDirty = true;
  if (S.session?.kind === 'section') refreshSection();
}

// A wall-attached artwork's reference, through the one validated edit path: the wall the editor chose,
// the declared station and height, all checked by the fixture before anything is written.
export function applyArtPlacement(id, place) {
  const a = artOf(id);
  if (!a) return 'Not an artwork';
  const w = W(place.wall);
  const err = validateArtPlacement(w, a, place);
  if (err) return err;
  a.wall = w.id;
  a.s = w.closed ? modS(w, place.s ?? 0) : place.s;
  a.y = place.y;
  afterWall(w.id);
  return null;
}

export function applyOpening(id, patch) {
  const t = thing(id);
  if (!t || t.kind !== 'openings') return 'Not an opening';
  const cand = { ...t.item, ...patch };
  if (t.wall.closed && cand.s != null) cand.s = modS(t.wall, cand.s);
  const err = validateOpening(t.wall, cand);
  if (err) return err;
  Object.assign(t.item, patch, cand.s != null ? { s: cand.s } : {});
  afterWall(t.wall.id);
  return null;
}

export function applyWallTop(id, top) {
  const w = W(id);
  const cand = { ...w, top: { ...top } };
  const err = validateWall(cand);
  if (err) return err;
  w.top = { ...top };
  afterWall(id);
  return null;
}

export function applyCeiling(id, patch) {
  const c = C(id);
  const cand = { ...c, ...patch, plane: { ...c.plane, ...(patch.plane || {}) } };
  const err = validateCeiling(cand);
  if (err) return err;
  Object.assign(c, patch, { plane: cand.plane });
  st().refreshCeiling(id);
  if (S.session?.kind === 'section') refreshSection();
  return null;
}

export function editOnce(label, fn) {
  beginEdit();
  const err = fn();
  if (err) { cancelEdit(); setStatus(err, 'refuse'); return err; }
  commitEdit(label);
  return null;
}

export function setTopForm(id, form) {
  const w = W(id);
  const p = w.top, L = wallLength(w);
  const h = p.form === 'constant' ? p.h : Math.min(p.h0, p.h1);
  if (form === p.form) return null;
  if (form === 'slope' && w.closed) {
    setStatus('A closed wall meets itself at the seam, so a slope would leave a step. Choose Gable to make one side rise.', 'refuse');
    return 'refused';
  }
  let top;
  if (form === 'constant') top = { form, h: p.form === 'constant' ? p.h : Math.max(p.h0, p.h1) };
  else if (form === 'slope') top = { form, h0: h, h1: h + 0.8 };
  else top = { form, h0: h, h1: h, rs: w.closed ? modS(w, (S.session?.sA ?? L / 4) + L / 2) : L / 2, rh: h + 1.0 };
  return editOnce(`${w.name} top → ${form === 'constant' ? 'Constant' : form === 'slope' ? 'Slope' : 'Gable'}`, () => applyWallTop(id, top));
}

export function setProfile(id, profile) {
  const t = thing(id);
  const o = t.item;
  if (o.profile === profile) return null;
  const rise = profile === 'rect' ? 0 : o.rise || Math.min(o.w / 2, o.head - o.sill - 0.4);
  return editOnce(`${o.name} profile → ${profile === 'rect' ? 'Square' : profile === 'round' ? 'Round' : 'Pointed'}`, () => applyOpening(id, { profile, rise }));
}

export function springLine(o) { return springOf(o); }

// ---------------------------------------------------------------- cancellation owners
// Everything unaccepted a spatial operation can be holding. Registered with the one policy in
// cancel.js, which calls them in order: previewed consequences first, then the aim, then the
// candidate snapshot the gesture or the draft was written against.
onCancel(() => {
  if (S.preview) { restoreQuiet(S.preview); S.preview = null; }
  S.previewing = null;
  S.popover = null;
}, 30, 'gap-preview');

onCancel(() => {
  if (!S.knife) return;
  S.knife = null;
  S.tool = 'select';
  st().clearAway('preview');
  st().setSectionCaps(null);
}, 40, 'knife-aim');

onCancel(() => {
  if (!S.pending) return;
  restoreQuiet(S.pending, S.pendingDomains);
  S.pending = null;
}, 60, 'candidate-edit');

// ---------------------------------------------------------------- neutral teardown
// Drop the reading without animating anywhere and without restoring an origin pose: temporary
// geometry, clips, ghosts, the mirrored reading and the aim all go; source, canonical selection and
// the realized standpoint stay. The caller holds the realized pose first (tasks.park does), so a
// deactivated reading cannot silently dolly the camera.
export function parkReading() {
  const mirror=st().cam.mirror;
  cancelProposal('park');
  const s = S.session;
  if (s) { KIND[s.kind].teardown(s); S.session = null; }
  S.knife = null;
  S.tool = 'select';
  S.reveal = null;
  S.popover = null;
  S.previewing = null;
  S.summary = null;
  S.refusal = null;
  st().clearAway('preview');
  st().setSectionCaps(null);
  // A declared candidate is a proposal: like the aim and the ghost, it comes off the drawing when the
  // reading that held it is dropped. Nothing here restores a pose.
  st().clearArtPreview();
  nav.setCam({mirror});
  T.end();
  ctx.ui();
}

// Esc, in the order the plan sets: the writer or proposal first (cancel.js owns that), then Precision,
// then the spatial reading through its canonical return. Nothing here replaces the selection.

// ---------------------------------------------------------------- lens: parking World work, resuming it explicitly
// Both lenses share one selection, Camera and source history. Invoked work parks inactive and
// returns only by explicit revalidated Resume; Experience registers its procedures at this seam.

export const lens = () => S.lens;
export const lensIs = (which) => S.lens === which;

// The refusal that keeps World work in its owning lens: no World work can be invoked from inside it, so no half
// invocation, hidden reading or unaccepted proposal can exist while another lens is the document.
function worldOnly() {
  if (S.lens === 'world') return false;
  setStatus('That is World work — switch back to the World lens, then invoke it', 'refuse');
  ctx.ui();
  return true;
}

// One open reading, recorded as its resolving target and its parameters. No Camera: a reading is always
// re-entered from where the Camera actually stands when Resume is asked for.
function recordReading(s) {
  const r = { kind: s.kind, subject: s.subject ?? null };
  const face = s.kind === 'face' ? resolveFace(s.subject ?? s.id ?? s.focusId) : null;
  if (s.kind === 'face') Object.assign(r, {
    wallId: s.wallId ?? face?.wall.id, opening: s.opening ?? face?.opening ?? null,
    focusId: s.focusId ?? face?.focusId, focusName: s.focusName ?? face?.focusName,
    side: s.side ?? 1, u: s.u ?? 0,
  });
  if (s.kind === 'section') Object.assign(r, { cut: { ...s.cut }, reveal: 'reveal' in s ? s.reveal : S.reveal ?? null });
  if (s.kind === 'lift' || s.kind === 'lookup') Object.assign(r, { ceilId: s.ceilId ?? s.id, mirror: s.mirror ?? !!st().cam.mirror });
  return r;
}

const nameOfId = (id) => thing(id)?.item?.name || null;

// Park: cancel what is unaccepted, freeze the realized standpoint, record the original identity and the
// resolving targets, then drop the reading without animating anywhere. Source, canonical selection and
// history are untouched, and no unaccepted proposal is ever part of the record.
export function parkWorldWork() {
  const s = S.session, t = S.task, k = S.knife;
  const overlay = t && (!s || t.kind !== s.kind) ? { kind: t.kind, subject: t.subject ?? null, precision: !!t.precision } : null;
  const canceled = [];
  if (k) canceled.push(k.p1 ? 'line-aim' : 'line');
  if (S.pending) canceled.push('candidate');
  const chain = [];
  for (let reading = s; reading; reading = reading.parent) chain.unshift(recordReading(reading));
  if (overlay) chain.push(overlay);
  if (!chain.length) {
    // A knife aim, a live candidate and an uncommitted draft are proposals, and proposals are never
    // parked: they are canceled, and an earlier record is not thrown away by a crossing that had
    // nothing restorable in hand. A remembered listing has no record to ride in, so it goes too.
    cancelProposal('lens');
    S.browseMemory=null;
    return S.parked;
  }
  const identity = s ? s.subject ?? null : overlay?.subject ?? null;
  // Browse context is not work: it rides in the record so an explicit Resume can put the listing back
  // where it was. It is never a chain, a selection or a Camera, and a crossing with nothing to park
  // attaches it to no record at all.
  const rememberedBrowse=S.parked?.browse ?? S.browseMemory ?? null;
  S.browseMemory=null;
  S.parked = {
    browse:rememberedBrowse,
    lens: 'world', at: performance.now(),
    identity, name: nameOfId(identity),
    chain,
    canceled,
  };
  T.park(); // holds the realized pose, cancels every proposal, and tears the reading down neutrally
  ctx.ui();
  return S.parked;
}

// Is the parked work still about what it says it is? Revalidated against the fixture's current accepted
// model, and every failure is a local explanation: never a name match, never a nearby wall, never a
// substituted host, never a restored proposal.
function validateStep(c, identityThing) {
  if (c.kind === 'face') {
    const w = c.wallId ? W(c.wallId) : null;
    if (!w) return 'the wall it was about is not in this museum any more';
    if (c.opening && !w.openings.some((o) => o.id === c.opening)) return `the ${c.focusName || 'opening'} is no longer an opening in the ${w.name}`;
    if (identityThing?.kind === 'art' && identityThing.item.wall !== w.id) return `the ${identityThing.item.name} no longer hangs on the ${w.name} — the relationship changed, so the parked reading would be about a subject it is not`;
    if (!(c.u >= 0 && c.u <= 1) || (c.side !== 1 && c.side !== -1)) return 'the reading parameters are no longer valid';
    return null;
  }
  if (c.kind === 'section') {
    const cut = c.cut, point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
    if (!cut || !Number.isFinite(cut.depth) || cut.depth < 0.5 || cut.depth > 30 ||
        !point(cut.p0) || !point(cut.p1) || ![-1, 1].includes(cut.side) ||
        Math.hypot(cut.p1[0] - cut.p0[0], cut.p1[1] - cut.p0[1]) < 0.1) return 'the cut it was about is no longer a valid reading';
    if (!ctx.museum.walls.length) return 'there is no architecture left to open';
    return null;
  }
  if (c.kind === 'lift' || c.kind === 'lookup') {
    return C(c.ceilId) ? null : 'the ceiling it was about is not in this museum any more';
  }
  if (c.kind === 'dims') {
    return identityThing && T.capabilities(c.subject).includes('dims') ? null : 'there are no measurements to take on it any more';
  }
  if (c.kind === 'repair') {
    if (!identityThing) return 'the artwork it was about is not in this museum any more';
    return identityThing.item.wall ? 'its wall reference is resolved now — there is nothing left to repair' : null;
  }
  return 'the parked work is no longer a kind this prototype can enter';
}

// What Resume would do, and why it cannot: read by the Card, the presenter and QA, never a hidden
// decision. `fix` names the one explicit act that would make it available again.
export function parkedContext() {
  const p = S.parked;
  if (!p) return null;
  const out = { ok: false, identity: p.identity, name: p.name, selection: S.sel, chain: p.chain.map((c) => c.kind), canceled: [...p.canceled], reason: '', fix: null, wrongLens: S.lens !== 'world' };
  const t = p.identity ? thing(p.identity) : null;
  if (p.identity && !t) { out.reason = `${p.name || p.identity} is not in this museum any more`; return out; }
  if (p.identity && S.sel !== p.identity) {
    out.reason = S.sel
      ? `${nameOfId(S.sel) || 'something else'} is selected now — the parked work is about the ${p.name || p.identity}`
      : `nothing is selected now — the parked work is about the ${p.name || p.identity}`;
    out.fix = 'select';
    return out;
  }
  if (!p.identity && S.sel) { out.reason = 'this location task began without a selected subject — start a fresh Section in the current context'; return out; }
  for (const c of p.chain) {
    const subject = c.subject ? thing(c.subject) : null;
    if (c.subject && !subject) { out.reason = 'a subject in the parked chain is no longer in this museum'; return out; }
    const bad = validateStep(c, subject);
    if (bad) { out.reason = bad; return out; }
  }
  out.ok = true;
  return out;
}

// Re-enter one recorded step. Readings are re-derived by the operation itself (no `arrive`, so no
// recorded Camera), their validated parameters reapplied, and the return context starts here: the
// pre-crossing root is never reused. Overlay work is re-invoked fresh, because a picked wall or a
// declared candidate was a proposal, and proposals are never parked.
async function reenter(step, first, neutral=false) {
  const opts = { restore: true, neutral, ...(first ? { parent: null } : {}) };
  if (step.kind === 'face') { await faceInner(step.subject ?? step.focusId, { ...opts, side: step.side, u: step.u }); return; }
  if (step.kind === 'section') {
    const { p0, p1, side, depth } = step.cut;
    await openSectionInner(makeCut(p0, p1, side, depth), { ...opts, subject: step.subject });
    if (step.reveal) toggleReveal(step.reveal, true);
    return;
  }
  if (step.kind === 'lift') { await liftInner(step.ceilId, { ...opts, subject: step.subject }); return; }
  if (step.kind === 'lookup') { await lookUpInner(step.ceilId, { ...opts, subject: step.subject }); if(!neutral) nav.setCam({mirror:!!step.mirror}); return; }
  if (step.kind === 'dims') { dimensionTask(step.subject); if (step.precision) T.setPrecision(true); return; }
  if (step.kind === 'repair') { repairTask(step.subject); if (step.precision) T.setPrecision(true); }
}

// Explicit Resume: the record is consumed, the reading is rebuilt from the current standpoint, and the
// source-summary cursor restarts (openSession records undoFrom now), so returning names only what this
// invocation changed.
export const resumeParked = () => run(async () => {
  if(S.lens==='experience')return lensWork.resume?.();
  const p = S.parked, v = parkedContext();
  if (!p || !v) { setStatus('Nothing is parked — there is no work to resume', 'info'); return null; }
  if (v.wrongLens) {
    setStatus('Resume is World work — switch back to the World lens, where the parked work belongs', 'refuse');
    ctx.ui();
    return null;
  }
  if (!v.ok) {
    setStatus(`Resume is not available — ${v.reason}. Start the work fresh instead of restoring a guess`, 'refuse');
    ctx.ui();
    return null;
  }
  S.parked = null;
  await nav.neutralInvocation(async()=>{for(let i=0;i<p.chain.length;i++)await reenter(p.chain[i],i===0,true);});
  if(p.browse&&browseResume)browseResume(p.browse);
  setStatus(`Resumed the work on the ${p.name || 'subject'} — a fresh invocation from where you stand: Put it back returns here, not to where it was parked`, 'view');
  ctx.ui();
  return p;
});

// The other honest ending: the record is dropped without restoring anything and without writing.
export function dismissParked() {
  if (!S.parked) return false;
  const name = S.parked.name || 'The parked work';
  S.parked = null;
  setStatus(`${name} is no longer parked — nothing was restored and nothing was written`, 'info');
  ctx.ui();
  return true;
}

// The lens button itself. Crossing lenses parks; crossing back is ordinary — no Instrument, no
// reading, no writer, no restored Search context and no Camera restoration. The parked record waits for
// an explicit Resume and is never applied by the toggle.
let lensWork={};
export function registerLensWork(work){lensWork=work;}
export function switchLens(which) {
 if(which===S.lens||!['world','experience'].includes(which))return S.lens;
 if(S.visitor){setStatus('Finish Preview before changing lens — the visitor is executing an isolated session, and this one is not a lens to cross into','refuse');ctx.ui();return S.lens;}
 if(S.lens==='world')parkWorldWork();else lensWork.park?.();
 cancelProposal('lens');S.lens=which;
 setStatus(`The ${which==='world'?'World':'Experience'} lens — ordinary context. Invoked work remains parked and inactive; selection and Camera carry unchanged.`, 'view');
 ctx.ui();return S.lens;
}

export function captureInspection() {return {recipe:S.session?recipeOf():null,task:S.task?clone(S.task):null,reveal:S.reveal};}
export const restoreInspection = inspection => run(async()=>{
 if(!inspection)return;
 if(inspection.recipe)await enterRecipe(inspection.recipe);
 if(inspection.task)S.task=clone(inspection.task);
 S.reveal=inspection.reveal;ctx.ui();
});

const labelName = (id) => thing(id)?.item?.name || id;

let browseResume=null;
export function registerBrowseResume(fn){browseResume=fn;}
// The listing a crossing is leaving: remembered beside the parked record, never inside its chain,
// and applied only by an explicit Resume. Returning is ordinary — the toggle restores no listing.
export function rememberBrowse(context) { S.browseMemory=clone(context); return true; }

nav.setWorldPositionResolver(worldOf);
