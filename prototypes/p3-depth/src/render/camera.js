// Where a 3D point lands on the sheet: the camera, projection, the near plane,
// and screen-space picking.
//
// No DOM, no canvas, no palette, so geometry can be inspected and projected in
// Node — and a different painter can consume the same camera.
//
// project and unproject are built from the same basis so a click lands where the
// pixel is; the earlier version had them disagree, which put the eye under the
// roof and sent ray hits to the wrong place.

export function createCamera(init = {}) {
  return {
    yaw: init.yaw ?? -0.62,
    pitch: init.pitch ?? 0.62,
    dist: init.dist ?? 26,
    target: init.target ?? [0, 2.2, 0],
    f: init.f ?? null,
  };
}

export const NEAR = 0.65;

// The eye sits `dist` from the target, `pitch` above the horizon, looking at the
// target.
export function cameraFrame(cam) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dir = [sy * cp, sp, cy * cp]; // eye - target, normalized
  const eye = [
    cam.target[0] + dir[0] * cam.dist,
    cam.target[1] + dir[1] * cam.dist,
    cam.target[2] + dir[2] * cam.dist,
  ];
  const right = [cy, 0, -sy];
  const fwd = [-dir[0], -dir[1], -dir[2]];
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];
  return { eye, right, up, fwd };
}

// camera space: x right, y up, depth forward
export function toCam(p, cam) {
  const { eye, right, up, fwd } = cameraFrame(cam);
  const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  return [dot3(d, right), dot3(d, up), dot3(d, fwd)];
}

export function projectCam(c, cam, W, H) {
  const f = cam.f ?? Math.min(W, H) * 1.25;
  const d = Math.max(0.05, c[2]);
  return { x: W / 2 + (f * c[0]) / d, y: H / 2 - (f * c[1]) / d, depth: c[2] };
}

export function project(p, cam, W, H) {
  return projectCam(toCam(p, cam), cam, W, H);
}

export function unproject(sx, sy, cam, W, H) {
  const f = cam.f ?? Math.min(W, H) * 1.25;
  const { eye, right, up, fwd } = cameraFrame(cam);
  const a = (sx - W / 2) / f;
  const b = -(sy - H / 2) / f;
  const dir = norm3([
    right[0] * a + up[0] * b + fwd[0],
    right[1] * a + up[1] * b + fwd[1],
    right[2] * a + up[2] * b + fwd[2],
  ]);
  return { origin: eye, dir };
}

export function rayPlane(ray, p0, p1, p2) {
  const e1 = sub3(p1, p0), e2 = sub3(p2, p0);
  const n = cross3(e1, e2);
  const den = dot3(n, ray.dir);
  if (Math.abs(den) < 1e-9) return null;
  const t = dot3(n, sub3(p0, ray.origin)) / den;
  if (t < 0) return null;
  return add3(ray.origin, mul3(ray.dir, t));
}

// Clip a segment against the near plane so it can never sweep across the paper.
export function clipSeg(a, b) {
  const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
  if (!ain && !bin) return null;
  if (ain && bin) return [a, b];
  const t = (NEAR - a[2]) / (b[2] - a[2]);
  const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
  return ain ? [a, m] : [m, b];
}

// Sutherland-Hodgman against depth >= NEAR, in camera space.
export function clipPoly(cs) {
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

// ------------------------------------------------------------------ picking

export function pick(scene, cam, W, H, mx, my) {
  let best = null;
  for (const f of scene.faces || []) {
    const pts = f.poly3.map((p) => project(p, cam, W, H));
    if (pts.some((p) => p.depth <= 0.4)) continue;
    if (!pointInPoly2([mx, my], pts)) continue;
    const depth = pts.reduce((a, p) => a + p.depth, 0) / pts.length;
    if (!best || depth < best.depth) best = { depth, face: f };
  }
  return best ? best.face : null;
}

export function pickLine(scene, cam, W, H, mx, my, radius = 8) {
  let best = null;
  for (const l of scene.lines || []) {
    const a = project(l.a3, cam, W, H), b = project(l.b3, cam, W, H);
    if (a.depth <= 0.4 || b.depth <= 0.4) continue;
    const d = pointSegDist([mx, my], [a.x, a.y], [b.x, b.y]);
    if (d < radius && (!best || d < best.d)) best = { d, line: l };
  }
  return best ? best.line : null;
}

function pointInPoly2(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p[1]) !== (b.y > p[1]) && p[0] < ((b.x - a.x) * (p[1] - a.y)) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

function pointSegDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

// ------------------------------------------------------------------ 3-vectors

// The small vocabulary camera and painter share.
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function mul3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
