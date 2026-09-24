import * as THREE from 'three';
import { wallLength, frameUnrolled, topAt, wrapD, planeY, frameAt, openingTopAt, springOf } from './model.js';

// Display state of a wall: { u: unroll 0..1, sA: anchor, lift: [x,z], y: vertical offset }.
export function wallSampler(w, state = {}) {
  const u = state.u || 0;
  const sA = state.sA ?? wallLength(w) / 2;
  const lift = state.lift || [0, 0];
  const ly = state.y || 0;
  const frameS = (s) => frameUnrolled(w, sA, wrapD(w, s - sA), u);
  const point = (f, o, y) => [f.x + f.nx * o + lift[0], y + ly, f.z + f.nz * o + lift[1]];
  return { u, sA, lift, frameS, point, L: wallLength(w) };
}

function wallBreaks(w, sA) {
  const L = wallLength(w);
  const breaks = new Set([0, L]);
  const step = w.kind === 'arc' ? 0.22 : L;
  for (let s = step; s < L - 1e-3; s += step) breaks.add(+s.toFixed(4));
  if (w.top.form === 'gable') breaks.add(+w.top.rs.toFixed(4));
  for (const o of w.openings) {
    const e0 = o.s - o.w / 2, e1 = o.s + o.w / 2;
    breaks.add(+e0.toFixed(4));
    breaks.add(+e1.toFixed(4));
    if (o.profile !== 'rect') for (let i = 1; i < 16; i++) breaks.add(+(e0 + (o.w * i) / 16).toFixed(4));
  }
  if (w.closed) breaks.add(+(((sA + L / 2) % L + L) % L).toFixed(4));
  return [...breaks].filter((s) => s >= 0 && s <= L).sort((a, b) => a - b);
}

// Solid intervals of a strip: bottom/top y at both ends, tracking whether the top is the wall top.
function stripIntervals(w, s0, s1) {
  const mid = (s0 + s1) / 2;
  let iv = [{ a0: 0, b0: 0, a1: topAt(w, s0), b1: topAt(w, s1), top: true }];
  const cover = w.openings.filter((o) => o.s - o.w / 2 < mid && mid < o.s + o.w / 2).sort((a, b) => a.sill - b.sill);
  for (const o of cover) {
    const hA = openingTopAt(o, s0), hB = openingTopAt(o, s1);
    const oHi = (hA + hB) / 2;
    const next = [];
    for (const I of iv) {
      const lo = (I.a0 + I.b0) / 2, hi = (I.a1 + I.b1) / 2;
      if (oHi <= lo || o.sill >= hi) { next.push(I); continue; }
      if (o.sill > lo) next.push({ a0: I.a0, b0: I.b0, a1: o.sill, b1: o.sill, top: false });
      if (oHi < hi) next.push({ a0: hA, b0: hB, a1: I.a1, b1: I.b1, top: I.top });
    }
    iv = next;
  }
  return iv;
}

export function buildWallGeometry(w, state = {}) {
  const S = wallSampler(w, state);
  const { L, sA, u } = S;
  const t = w.thick / 2;
  const bs = wallBreaks(w, sA);
  const tri = [];
  const lines = [];
  const quad = (a, b, c, d) => tri.push(...a, ...b, ...c, ...a, ...c, ...d);
  const seg = (a, b) => lines.push(...a, ...b);
  const P = (f, o, y) => S.point(f, o, y);

  for (let i = 0; i < bs.length - 1; i++) {
    const s0 = bs[i], s1 = bs[i + 1];
    if (s1 - s0 < 1e-4) continue;
    const mid = (s0 + s1) / 2;
    const dMid = wrapD(w, mid - sA);
    const d0 = dMid - (mid - s0), d1 = dMid + (s1 - mid);
    const A = frameUnrolled(w, sA, d0, u);
    const B = frameUnrolled(w, sA, d1, u);
    for (const I of stripIntervals(w, s0, s1)) {
      for (const o of [t, -t]) {
        quad(P(A, o, I.a0), P(B, o, I.b0), P(B, o, I.b1), P(A, o, I.a1));
        seg(P(A, o, I.a1), P(B, o, I.b1));
        seg(P(A, o, I.a0), P(B, o, I.b0));
      }
      quad(P(A, t, I.a1), P(B, t, I.b1), P(B, -t, I.b1), P(A, -t, I.a1));
      if (I.a0 > 0 || I.b0 > 0) quad(P(A, t, I.a0), P(B, t, I.b0), P(B, -t, I.b0), P(A, -t, I.a0));
    }
    for (const o of w.openings) {
      const e0 = o.s - o.w / 2, e1 = o.s + o.w / 2;
      const sp = springOf(o);
      if (Math.abs(s0 - e0) < 1e-3) {
        quad(P(A, t, o.sill), P(A, -t, o.sill), P(A, -t, sp), P(A, t, sp));
        for (const oo of [t, -t]) seg(P(A, oo, o.sill), P(A, oo, sp));
      }
      if (Math.abs(s1 - e1) < 1e-3) {
        quad(P(B, t, o.sill), P(B, -t, o.sill), P(B, -t, sp), P(B, t, sp));
        for (const oo of [t, -t]) seg(P(B, oo, o.sill), P(B, oo, sp));
      }
    }
    const h0 = topAt(w, s0), h1 = topAt(w, s1);
    if (!w.closed && i === 0) {
      quad(P(A, t, 0), P(A, -t, 0), P(A, -t, h0), P(A, t, h0));
      seg(P(A, t, 0), P(A, t, h0)); seg(P(A, -t, 0), P(A, -t, h0)); seg(P(A, t, h0), P(A, -t, h0));
    }
    if (!w.closed && i === bs.length - 2) {
      quad(P(B, t, 0), P(B, -t, 0), P(B, -t, h1), P(B, t, h1));
      seg(P(B, t, 0), P(B, t, h1)); seg(P(B, -t, 0), P(B, -t, h1)); seg(P(B, t, h1), P(B, -t, h1));
    }
    if (w.closed && u > 0.001 && Math.abs(Math.abs(d1) - L / 2) < 1e-3) {
      seg(P(B, t, 0), P(B, t, h1)); seg(P(B, -t, 0), P(B, -t, h1));
    }
    if (w.closed && u > 0.001 && Math.abs(Math.abs(d0) - L / 2) < 1e-3) {
      seg(P(A, t, 0), P(A, t, h0)); seg(P(A, -t, 0), P(A, -t, h0));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.computeVertexNormals();
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { mesh: g, lines: lg };
}

// Horizontal cut through every wall at height h (plan looks down onto it, Look up looks up at it).
export function horizontalCaps(museum, h, samplerFor) {
  const tri = [];
  const lines = [];
  for (const w of museum.walls) {
    const S = samplerFor(w);
    const t = w.thick / 2;
    const bs = wallBreaks(w, S.sA);
    const runs = [];
    let run = null;
    for (let i = 0; i < bs.length - 1; i++) {
      const s0 = bs[i], s1 = bs[i + 1];
      const mid = (s0 + s1) / 2;
      let solid = h < topAt(w, mid);
      for (const o of w.openings) {
        if (Math.abs(wrapD(w, mid - o.s)) < o.w / 2 && h > o.sill && h < openingTopAt(o, mid)) solid = false;
      }
      if (solid) {
        const A = S.frameS(s0), B = S.frameS(s1);
        const a1 = S.point(A, t, h), b1 = S.point(B, t, h), b2 = S.point(B, -t, h), a2 = S.point(A, -t, h);
        tri.push(...a1, ...b1, ...b2, ...a1, ...b2, ...a2);
        lines.push(...a1, ...b1, ...a2, ...b2);
        if (!run) { run = { A, s0 }; runs.push(run); }
        run.B = B;
      } else run = null;
    }
    for (const r of runs) {
      if (!(w.closed && runs.length === 1)) {
        lines.push(...S.point(r.A, t, h), ...S.point(r.A, -t, h), ...S.point(r.B, t, h), ...S.point(r.B, -t, h));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { mesh: g, lines: lg };
}

// ---------- slabs ----------

export function buildSlabGeometry(outline, holes, plane, thick, yOffset = 0) {
  const v2 = (p) => new THREE.Vector2(p[0], p[1]);
  const faces = THREE.ShapeUtils.triangulateShape(outline.map(v2), holes.map((h) => h.map(v2)));
  const all = [...outline, ...holes.flat()];
  const tri = [];
  const lines = [];
  const Y = (p, top) => planeY(plane, p[0], p[1]) + (top ? thick : 0) + yOffset;
  const V = (p, top) => [p[0], Y(p, top), p[1]];
  for (const f of faces) for (const top of [false, true]) for (const idx of f) tri.push(...V(all[idx], top));
  const ring = (pts) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      tri.push(...V(a, false), ...V(b, false), ...V(b, true), ...V(a, false), ...V(b, true), ...V(a, true));
      lines.push(...V(a, false), ...V(b, false), ...V(a, true), ...V(b, true));
    }
  };
  ring(outline);
  holes.forEach(ring);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g.computeVertexNormals();
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { mesh: g, lines: lg };
}

// ---------- artwork ----------

const paintCache = new Map();
export function paintTexture(kind) {
  if (paintCache.has(kind)) return paintCache.get(kind);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = (stops, x0 = 0, y0 = 0, x1 = 0, y1 = 256) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  };
  if (kind === 'harbor') {
    g.fillStyle = grad([[0, '#2b3a67'], [0.45, '#e2876a'], [0.62, '#f4c27a'], [0.63, '#1d2c44'], [1, '#0e1a2a']]);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#0b1320';
    for (let i = 0; i < 5; i++) g.fillRect(30 + i * 42, 118 - i * 3, 4, 44);
    g.fillStyle = 'rgba(244,194,122,.5)';
    for (let i = 0; i < 18; i++) g.fillRect(90 + Math.sin(i) * 20, 170 + i * 4, 40 - i, 2);
  } else if (kind === 'pears') {
    g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#8a5a3b'; g.fillRect(0, 190, 256, 66);
    [['#b7c24a', 70], ['#d6a23f', 128], ['#9fb24a', 186]].forEach(([col, x], i) => {
      g.fillStyle = col; g.beginPath(); g.ellipse(x, 160 - (i % 2) * 6, 28, 38, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x, 118 - (i % 2) * 6, 16, 20, 0, 0, 7); g.fill();
    });
  } else if (kind === 'kestrel') {
    g.fillStyle = grad([[0, '#cfd8dc'], [1, '#9aa7ad']]); g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#6b4a2f'; g.beginPath(); g.moveTo(128, 70); g.lineTo(60, 120); g.lineTo(128, 108); g.lineTo(196, 120); g.closePath(); g.fill();
    g.fillStyle = '#3c2a1b'; g.fillRect(122, 100, 12, 60);
  } else if (kind.startsWith('tide')) {
    const n = +kind.slice(4);
    g.fillStyle = ['#d8e6e3', '#cbdcd9', '#bfd2d0'][n - 1]; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#2f5d6b'; g.lineWidth = 6;
    for (let r = 0; r < 6; r++) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, 60 + r * 30 + Math.sin(x / (18 + n * 6) + r) * (6 + n * 4));
      g.stroke();
    }
  } else if (kind === 'marsh') {
    g.fillStyle = grad([[0, '#f3e6c6'], [0.5, '#e8d3a0'], [0.52, '#6f8a5c'], [1, '#3e5a3c']]); g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(160,200,210,.8)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(40 + i * 40, 170 + (i % 3) * 18, 26, 5, 0, 0, 7); g.fill(); }
    g.fillStyle = '#f8f1dc'; g.beginPath(); g.arc(190, 70, 22, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  paintCache.set(kind, tex);
  return tex;
}

export function placeArtwork(group, w, art, state) {
  const S = wallSampler(w, state);
  const f = S.frameS(art.s);
  const p = S.point(f, w.thick / 2 + 0.035, art.y);
  group.position.set(p[0], p[1], p[2]);
  group.rotation.set(0, Math.atan2(f.nx, f.nz), 0);
}

// ---------- vertical section caps ----------
// cut: { p: [x,z], d: [dx,dz] unit along the line }. Returns cap quads and per-wall crossing info.
export function sectionCaps(museum, cut) {
  const quads = [];
  const crossings = [];
  const [px, pz] = cut.p, [dx, dz] = cut.d;
  const along = (x, z) => (x - px) * dx + (z - pz) * dz;
  const P = (tv, y) => [px + dx * tv, y, pz + dz * tv];
  for (const w of museum.walls) {
    const hits = [];
    if (w.kind === 'line') {
      const L = wallLength(w);
      const f = frameAt(w, 0);
      const den = f.tx * dz - f.tz * dx;
      if (Math.abs(den) > 1e-6) {
        const s = ((px - w.a[0]) * dz - (pz - w.a[1]) * dx) / den;
        if (s >= 0 && s <= L) hits.push(s);
      }
    } else {
      const ox = px - w.cx, oz = pz - w.cz;
      const b = ox * dx + oz * dz, c = ox * ox + oz * oz - w.r * w.r;
      const disc = b * b - c;
      if (disc > 0) {
        for (const tv of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) {
          const x = px + dx * tv, z = pz + dz * tv;
          let a = Math.atan2(z - w.cz, x - w.cx) - w.a0;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          hits.push(a * w.r);
        }
      }
    }
    for (const s of hits) {
      const f = frameAt(w, s);
      const sinT = Math.abs(f.tx * dz - f.tz * dx);
      const half = Math.min(w.thick / 2 / Math.max(sinT, 0.2), 1.2);
      const tc = along(f.x, f.z);
      const top = topAt(w, s);
      let iv = [[0, top]];
      const crossed = w.openings.filter((o) => Math.abs(wrapD(w, s - o.s)) < o.w / 2);
      for (const o of crossed) {
        const oh = openingTopAt(o, s);
        const next = [];
        for (const [y0, y1] of iv) {
          if (oh <= y0 || o.sill >= y1) { next.push([y0, y1]); continue; }
          if (o.sill > y0) next.push([y0, o.sill]);
          if (oh < y1) next.push([oh, y1]);
        }
        iv = next;
      }
      for (const [y0, y1] of iv) quads.push({ owner: w.id, a: P(tc - half, y0), b: P(tc + half, y0), c: P(tc + half, y1), d: P(tc - half, y1) });
      crossings.push({ wall: w.id, s, top, tc, x: f.x, z: f.z, openings: crossed.map((o) => ({ id: o.id, sill: o.sill, head: openingTopAt(o, s) })) });
    }
  }
  const slabHits = (outline, holes, plane, thick, owner) => {
    const ts = [];
    for (const ring of [outline, ...holes]) {
      for (let i = 0; i < ring.length; i++) {
        const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length];
        const ex = x1 - x0, ez = z1 - z0;
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const tv = ((x0 - px) * ez - (z0 - pz) * ex) / den;
        const uv = ((x0 - px) * dz - (z0 - pz) * dx) / den;
        if (uv >= 0 && uv < 1) ts.push(tv);
      }
    }
    ts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < ts.length; i += 2) {
      const ta = ts[i], tb = ts[i + 1];
      const ya = planeY(plane, px + dx * ta, pz + dz * ta), yb = planeY(plane, px + dx * tb, pz + dz * tb);
      quads.push({ owner, a: P(ta, ya), b: P(tb, yb), c: P(tb, yb + thick), d: P(ta, ya + thick), slab: true, ta, tb, ya, yb });
    }
  };
  for (const c of museum.ceilings) slabHits(c.outline, c.holes.map((h) => h.pts), c.plane, c.thick, c.id);
  for (const f of museum.floors) slabHits(f.outline, [], { base: -0.12, gx: 0, gz: 0 }, 0.12, f.id);
  return { quads, crossings };
}
