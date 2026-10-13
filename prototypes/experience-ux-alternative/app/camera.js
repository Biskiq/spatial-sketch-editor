// The one Camera evaluator of this prototype. Editor playback, Follow, Look through,
// thumbnails and both visitor modes all ask this module for a pose — nothing else
// interpolates poses or field of view. (Prototype stand-in for the Camera authority.)
import { LENSES, crossesWall } from './world.js';

export const GLIDE = 1.6; // seconds between two Views inside one Stop

export function viewPose(v) {
  const c = Math.cos(v.pitch);
  return { pos: [...v.pos], dir: [Math.cos(v.yaw) * c, Math.sin(v.pitch), Math.sin(v.yaw) * c], fov: LENSES[v.lens].fov };
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function nlerp(a, b, t) { return norm(lerp3(a, b, t)); }

export function blendPose(a, b, t) {
  const s = smooth(Math.min(1, Math.max(0, t)));
  return { pos: lerp3(a.pos, b.pos, s), dir: nlerp(a.dir, b.dir, s), fov: lerp(a.fov, b.fov, s) };
}

export const pathKey = (fromId, toId) => `${fromId}>${toId}`;

// Planar control polyline: from-View position, authored points, to-View position.
export function controlPoints(from, to, path) {
  return [[from.pos[0], from.pos[2]], ...((path && path.points) || []), [to.pos[0], to.pos[2]]];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1].map((i) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

// Dense planar samples of the route (used by both the Plan drawing and the evaluator).
export function sampleRoute(cps, perSeg = 24) {
  if (cps.length === 2) return [cps[0], cps[1]];
  const out = [];
  for (let i = 0; i < cps.length - 1; i++) {
    const p0 = cps[Math.max(0, i - 1)], p1 = cps[i], p2 = cps[i + 1], p3 = cps[Math.min(cps.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) out.push(catmull(p0, p1, p2, p3, k / perSeg));
  }
  out.push(cps[cps.length - 1]);
  return out;
}

const routeCache = new Map();
function route(from, to, path) {
  const cps = controlPoints(from, to, path);
  const key = JSON.stringify(cps);
  let r = routeCache.get(key);
  if (!r) {
    const pts = sampleRoute(cps, 32);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    r = { pts, cum, len: cum[cum.length - 1] };
    if (routeCache.size > 200) routeCache.clear();
    routeCache.set(key, r);
  }
  return r;
}

function at(r, d) {
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.pts[i - 1], b = r.pts[i];
  const span = r.cum[i] - r.cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - r.cum[i - 1]) / span));
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
}

export function travelPose(from, to, path, t) {
  const r = route(from, to, path);
  const s = smooth(Math.min(1, Math.max(0, t)));
  const [x, z, heading] = at(r, s * r.len);
  const a = viewPose(from), b = viewPose(to);
  const y = lerp(a.pos[1], b.pos[1], s);
  const tangent = [Math.cos(heading), -0.04, Math.sin(heading)];
  const inW = smooth(Math.min(1, t / 0.3)), outW = smooth(Math.max(0, (t - 0.7) / 0.3));
  let dir = nlerp(a.dir, tangent, inW);
  dir = nlerp(dir, b.dir, outW);
  return { pos: [x, y, z], dir, fov: lerp(a.fov, b.fov, s) };
}

export function routeLength(from, to, path) { return route(from, to, path).len; }

export function routeWarning(from, to, path) {
  const cps = controlPoints(from, to, path);
  for (let i = 0; i < cps.length - 1; i++) if (crossesWall(cps[i], cps[i + 1])) return true;
  return false;
}

// ——— Guide timeline ———
// Each Stop contributes its guided Views (hold + glide between them); each
// transition contributes Travel time or an instant Cut. Visitors additionally
// wait for "Next stop" at every Stop end — the timeline marks those moments.
export function buildTimeline(doc) {
  const segs = [], stops = [];
  let t = 0;
  const S = doc.guide.stops;
  S.forEach((stop, si) => {
    const t0 = t;
    stop.seq.forEach((item, vi) => {
      if (vi > 0) { segs.push({ kind: 'glide', si, from: stop.seq[vi - 1].viewId, to: item.viewId, t0: t, dur: GLIDE }); t += GLIDE; }
      segs.push({ kind: 'hold', si, vi, viewId: item.viewId, t0: t, dur: item.hold }); t += item.hold;
    });
    const t1 = t;
    let trans = null;
    if (si < S.length - 1) {
      const next = S[si + 1];
      const from = stop.seq[stop.seq.length - 1].viewId, to = next.seq[0].viewId;
      const dur = stop.out.mode === 'travel' ? stop.out.duration : 0;
      trans = { kind: stop.out.mode, si, from, to, t0: t, dur };
      segs.push(trans); t += dur;
    }
    stops.push({ t0, t1, tEnd: t });
  });
  return { segs, stops, total: t };
}

export function evaluate(doc, tl, t) {
  if (!tl.segs.length) return null;
  t = Math.min(Math.max(0, t), tl.total);
  let seg = tl.segs[tl.segs.length - 1];
  for (const s of tl.segs) { if (t < s.t0 + s.dur || (s.dur === 0 && t <= s.t0)) { seg = s; break; } }
  const V = doc.views;
  const u = seg.dur ? (t - seg.t0) / seg.dur : 1;
  let pose;
  if (seg.kind === 'hold') pose = viewPose(V[seg.viewId]);
  else if (seg.kind === 'glide') pose = blendPose(viewPose(V[seg.from]), viewPose(V[seg.to]), u);
  else if (seg.kind === 'travel') pose = travelPose(V[seg.from], V[seg.to], doc.paths[pathKey(seg.from, seg.to)], u);
  else pose = viewPose(V[seg.to]);
  return { pose, seg, si: seg.si };
}

export function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
