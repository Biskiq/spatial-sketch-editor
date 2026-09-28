// The prototype's single Camera authority.
//
// Every pose that reaches the renderer comes from this module: prepared views
// (locked or subject-assisted framing), route resolution and travel, the editor's
// session orbit, the visitor's free-look profile and the rejoin return. Nothing
// else in the prototype interpolates eye/target/FOV. The math is a stand-in for
// canonical Camera preparation/evaluation, not a proposal for its algorithm.

import * as THREE from 'three';
import { BAY, PX2 } from './fixture.js';
import { clamp, lerp, lerp3, smooth, smoother, rad, deg, sub3, add3, scale3, len3, norm3, dist3 } from './util.js';

export const ASPECT = 16 / 10;

// Projection for the viewport a frame is shown in. Framing is authored and checked at ASPECT;
// narrower screens (a phone held upright) widen the vertical FOV so the frame's width survives,
// down to a square core and within a sane limit. Camera-owned, so every profile gets the same answer.
export function projectedFov(fov, aspect) {
  const ref = Math.min(ASPECT, 1.2);
  if (!(aspect > 0) || aspect >= ref) return fov;
  const t = Math.tan((fov * Math.PI) / 360) * (ref / aspect);
  return Math.min((Math.atan(t) * 360) / Math.PI, 96);
}

export function rotY(v, degrees) {
  const r = rad(degrees || 0), c = Math.cos(r), s = Math.sin(r);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export function toWorld(inst, p) {
  const q = rotY(p, inst.rot);
  return [inst.pos[0] + q[0], q[1], inst.pos[1] + q[2]];
}

// Local bounds of a subject as Camera sees it, including the displayed cover
// separation (the extent the Stop declares, not the frame-by-frame value).
export function localBox(focus = 'whole', sep = 0) {
  const b = focus === 'casing' ? PX2.casingBounds : PX2.bounds;
  const min = [...b.min], max = [...b.max];
  max[0] = Math.max(max[0], PX2.coverSpan[1] + sep);
  return { min, max };
}

export function subjectBox(P, instId, focus = 'whole', sep = 0, posOverride = null) {
  const src = P.scene.inst[instId];
  const inst = posOverride ? { ...src, pos: posOverride } : src;
  const { min, max } = localBox(focus, sep);
  const corners = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push(toWorld(inst, [x, y, z]));
  const center = toWorld(inst, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
  const radius = 0.5 * len3(sub3(max, min));
  return { inst, min, max, corners, center, radius };
}

function dirFrom(az, el) {
  const a = rad(az), e = rad(el);
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}

// Profile guard for tour and visitor poses: stay inside the bay.
export function guard(eye) {
  return [
    clamp(eye[0], BAY.x0 + 0.25, BAY.x1 - 0.25),
    clamp(eye[1], 0.35, BAY.h - 0.22),
    clamp(eye[2], BAY.z0 + 0.25, BAY.z1 - 0.25),
  ];
}

// Prepare a view against an explicit context: { extent: { [inst]: separation } }.
export function prepare(P, viewId, ctx = {}) {
  const v = P.camera.views[viewId];
  if (!v) return null;
  if (v.framing === 'locked') return { eye: [...v.eye], target: [...v.target], fov: v.fov, framing: 'locked' };
  const sep = ctx.extent?.[v.subject] ?? 0;
  const box = subjectBox(P, v.subject, v.focus, sep);
  const dir = rotY(dirFrom(v.az, v.el), box.inst.rot);
  const d = box.radius / Math.sin(rad(v.fov) / 2) / v.fill;
  const raw = add3(box.center, scale3(dir, d));
  const eye = guard(raw);
  return { eye, target: box.center, fov: v.fov, framing: 'assisted', guarded: dist3(raw, eye) > 0.02 };
}

// Turn the current standpoint into subject-assisted framing parameters.
export function assistedFrom(P, pose, instId, focus, sep, posOverride = null) {
  const box = subjectBox(P, instId, focus, sep, posOverride);
  const rel = sub3(pose.eye, box.center);
  const d = Math.max(0.2, len3(rel));
  const dl = rotY(norm3(rel), -(box.inst.rot || 0));
  return {
    framing: 'assisted', subject: instId, focus,
    az: deg(Math.atan2(dl[2], dl[0])),
    el: deg(Math.asin(clamp(dl[1], -1, 1))),
    fov: pose.fov,
    fill: clamp(box.radius / Math.sin(rad(pose.fov) / 2) / d, 0.25, 1.4),
  };
}

// How much of a subject a pose actually contains (0–1). Sampled, not exact.
const _cam = new THREE.PerspectiveCamera(50, ASPECT, 0.05, 200);
const _v = new THREE.Vector3();
export function coverage(pose, P, instId, focus = 'whole', sep = 0) {
  _cam.fov = pose.fov; _cam.aspect = ASPECT; _cam.updateProjectionMatrix();
  _cam.position.set(...pose.eye); _cam.lookAt(...pose.target); _cam.updateMatrixWorld();
  const inst = P.scene.inst[instId];
  const { min, max } = localBox(focus, sep);
  let inside = 0, n = 0;
  const N = 5;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const p = toWorld(inst, [lerp(min[0], max[0], i / (N - 1)), lerp(min[1], max[1], j / (N - 1)), lerp(min[2], max[2], k / (N - 1))]);
    _v.set(p[0], p[1], p[2]).project(_cam);
    n++;
    if (_v.z < 1 && _v.z > -1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1) inside++;
  }
  return inside / n;
}

// ---- routes (Camera connectivity) ----

export function findRoute(P, from, to) {
  if (!from || !to) return { ok: false, noOrigin: true };
  if (from === to) return { ok: true, same: true, legs: [], views: [from] };
  const routes = Object.values(P.camera.routes);
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const r of routes) {
      const next = r.a === cur ? r.b : r.b === cur ? r.a : null;
      if (next && !(next in prev) && P.camera.views[next]) { prev[next] = { view: cur, route: r }; queue.push(next); }
    }
  }
  if (!(to in prev)) return { ok: false, gap: true, from, to };
  const legs = [];
  for (let at = to; prev[at]; at = prev[at].view) legs.unshift({ route: prev[at].route.id, a: prev[at].view, b: at });
  return { ok: true, legs, views: [from, ...legs.map((l) => l.b)] };
}

export function routePoints(P, route, ctx = {}) {
  if (!route?.ok) return [];
  const first = prepare(P, route.views[0], ctx);
  const pts = [first.eye];
  for (const leg of route.legs) {
    const r = P.camera.routes[leg.route];
    const via = r.a === leg.a ? r.via : [...r.via].reverse();
    pts.push(...via.map((p) => [...p]));
    pts.push(prepare(P, leg.b, ctx).eye);
  }
  return pts;
}

export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist3(pts[i - 1], pts[i]);
  return L;
}

export const travelDuration = (len) => clamp(len / 1.7, 1.6, 4.8);

function along(pts, u) {
  const L = polyLength(pts);
  if (L <= 1e-6) return [...pts[pts.length - 1]];
  let d = clamp(u) * L;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist3(pts[i - 1], pts[i]);
    if (d <= seg || i === pts.length - 1) return lerp3(pts[i - 1], pts[i], seg > 0 ? clamp(d / seg) : 1);
    d -= seg;
  }
  return [...pts[pts.length - 1]];
}

// Travel along a resolved route. The endpoints are the prepared poses; the path
// follows Camera's authored waypoints. A cut never comes through here.
export function travelPose(pts, a, b, p) {
  const e = smoother(p);
  const path = pts.length >= 2 ? [a.eye, ...pts.slice(1, -1), b.eye] : [a.eye, b.eye];
  return { eye: along(path, e), target: lerp3(a.target, b.target, smooth(p)), fov: lerp(a.fov, b.fov, e) };
}

// ---- profiles: session orbit (editor), free look (visitor), return ----

export function orbitPose(o) {
  const cp = Math.cos(o.pitch);
  const eye = [o.pivot[0] + o.dist * cp * Math.sin(o.yaw), o.pivot[1] + o.dist * Math.sin(o.pitch), o.pivot[2] + o.dist * cp * Math.cos(o.yaw)];
  return { eye: o.guard ? guard(eye) : eye, target: [...o.pivot], fov: o.fov };
}

export function orbitFrom(pose, extra = {}) {
  const rel = sub3(pose.eye, pose.target);
  const dist = Math.max(0.3, len3(rel));
  return { pivot: [...pose.target], dist, yaw: Math.atan2(rel[0], rel[2]), pitch: Math.asin(clamp(rel[1] / dist, -1, 1)), fov: pose.fov, ...extra };
}

export function blendPose(a, b, t) {
  const e = smoother(t);
  return { eye: lerp3(a.eye, b.eye, e), target: lerp3(a.target, b.target, e), fov: lerp(a.fov, b.fov, e) };
}

export function describeView(v) {
  if (!v) return 'missing view';
  return v.framing === 'locked' ? 'Locked shot' : 'Follows ' + (v.subject === 'pumpA' ? 'Pump A' : v.subject === 'pumpB' ? 'Pump B' : 'its subject');
}
