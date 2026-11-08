'use strict';
/*
 * World creation tools — simulated world.
 * A mock project with Layout-like, Scene-like and Landscape-like collections, a terrain
 * height field, consequence planners and snapshot history. None of this is a production
 * mechanism or format: snapshot Undo, heuristic geometry and the derived-Room shortcut
 * (a Room exists only for a closed Walls gesture) are demonstration devices.
 */

// ── geometry ──────────────────────────────────────────────────────────────────
const G = {
  v: (x, y) => ({ x, y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  norm(a) { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  left: (d) => ({ x: -d.y, y: d.x }),
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  mid: (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
  near: (a, b, e = 1e-3) => Math.abs(a.x - b.x) < e && Math.abs(a.y - b.y) < e,

  /** Circular arc from a to b with signed sagitta s (positive bulges to the left of a→b). */
  arcPoints(a, b, s, step = 0.45) {
    const c = G.dist(a, b);
    if (!s || Math.abs(s) < 0.02 || c < 1e-6) return [a, b];
    const R = (c * c / 4 + s * s) / (2 * s);
    const n = G.left(G.norm(G.sub(b, a)));
    const m = G.mid(a, b);
    const ctr = G.add(m, G.mul(n, s - R));
    const th0 = Math.atan2(a.y - ctr.y, a.x - ctr.x);
    const sweep = -4 * Math.atan(2 * s / c);
    const arcLen = Math.abs(R * sweep);
    const k = Math.max(2, Math.ceil(arcLen / step));
    const r = Math.abs(R);
    const pts = [];
    for (let i = 0; i <= k; i++) {
      const th = th0 + sweep * (i / k);
      pts.push({ x: ctr.x + r * Math.cos(th), y: ctr.y + r * Math.sin(th) });
    }
    pts[0] = { ...a }; pts[k] = { ...b };
    return pts;
  },
  circlePoly(c, r, n = 32) {
    const pts = [];
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }); }
    return pts;
  },
  area(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; } return s / 2; },
  centroid(poly) {
    let x = 0, y = 0, a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], k = p.x * q.y - q.x * p.y;
      a += k; x += (p.x + q.x) * k; y += (p.y + q.y) * k;
    }
    if (Math.abs(a) < 1e-9) { const s = poly.reduce((m, p) => ({ x: m.x + p.x, y: m.y + p.y }), { x: 0, y: 0 }); return { x: s.x / poly.length, y: s.y / poly.length }; }
    return { x: x / (3 * a), y: y / (3 * a) };
  },
  inPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  },
  segX(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u, p: G.lerp(p1, p2, t) };
  },
  distSeg(p, a, b) {
    const ab = G.sub(b, a), l2 = G.dot(ab, ab) || 1e-9;
    const t = Math.max(0, Math.min(1, G.dot(G.sub(p, a), ab) / l2));
    const q = G.lerp(a, b, t);
    return { d: G.dist(p, q), t, p: q };
  },
  distPoly(p, pts) {
    let best = { d: Infinity, i: 0, t: 0, p };
    for (let i = 0; i < pts.length - 1; i++) { const r = G.distSeg(p, pts[i], pts[i + 1]); if (r.d < best.d) best = { ...r, i }; }
    return best;
  },
  polyLen(pts) { let s = 0; for (let i = 0; i < pts.length - 1; i++) s += G.dist(pts[i], pts[i + 1]); return s; },
  atLen(pts, s) {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = G.dist(pts[i], pts[i + 1]);
      if (acc + l >= s || i === pts.length - 2) {
        const t = l ? Math.max(0, Math.min(1, (s - acc) / l)) : 0;
        return { p: G.lerp(pts[i], pts[i + 1], t), dir: G.norm(G.sub(pts[i + 1], pts[i])), i };
      }
      acc += l;
    }
    return { p: pts[0], dir: { x: 1, y: 0 }, i: 0 };
  },
  resample(pts, step) {
    const L = G.polyLen(pts); if (L < 1e-6) return pts.slice();
    const n = Math.max(1, Math.round(L / step)), out = [];
    for (let i = 0; i <= n; i++) out.push(G.atLen(pts, (i / n) * L).p);
    return out;
  },
  hull(points) {
    const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  },
  offsetPoly(poly, d) {
    // Miter offset of a CCW polygon outward by d (adequate for the prototype's convex-ish shapes).
    const n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
      const n1 = G.norm({ x: b.y - a.y, y: -(b.x - a.x) });
      const n2 = G.norm({ x: c.y - b.y, y: -(c.x - b.x) });
      const m = G.norm(G.add(n1, n2));
      const k = d / Math.max(0.35, G.dot(m, n1));
      out.push(G.add(b, G.mul(m, k)));
    }
    return out;
  },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);

// ── terrain ───────────────────────────────────────────────────────────────────
const TER = { N: 40, HALF: 20, V: 41 };
const vIdx = (i, j) => j * TER.V + i;
const cIdx = (i, j) => j * TER.N + i;

function newWorld() {
  return {
    rev: 1, counters: {},
    terrain: { h: new Float32Array(TER.V * TER.V), paint: new Array(TER.N * TER.N).fill(null), water: new Float32Array(TER.N * TER.N).fill(NaN) },
    walls: [], rooms: [], openings: [], roofs: [], buildings: [], stairs: [],
    objects: [], art: [], lights: [], paths: [], plants: [],
    sun: 15.5,
  };
}
let world = newWorld();

const KIND_LABEL = { wall: 'Wall', room: 'Room', opening: 'Opening', roof: 'Roof', building: 'Building', stair: 'Stair', object: 'Object', art: 'Artwork', light: 'Light', path: 'Path' };
function nid(w, kind, label) {
  w.counters.id = (w.counters.id || 0) + 1;
  const key = label || KIND_LABEL[kind] || kind;
  w.counters[key] = (w.counters[key] || 0) + 1;
  return { id: kind[0] + w.counters.id, name: `${key} ${w.counters[key]}` };
}

function hAt(x, y, w = world) {
  const fx = clamp(x + TER.HALF, 0, TER.N - 1e-4), fy = clamp(y + TER.HALF, 0, TER.N - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, h = w.terrain.h;
  const a = h[vIdx(i, j)], b = h[vIdx(i + 1, j)], c = h[vIdx(i, j + 1)], d = h[vIdx(i + 1, j + 1)];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function cellAt(x, y) {
  const i = Math.floor(x + TER.HALF), j = Math.floor(y + TER.HALF);
  if (i < 0 || j < 0 || i >= TER.N || j >= TER.N) return -1;
  return cIdx(i, j);
}
function waterAt(x, y, w = world) { const c = cellAt(x, y); if (c < 0) return NaN; const s = w.terrain.water[c]; return s; }
const inWorkspace = (p) => Math.abs(p.x) <= TER.HALF && Math.abs(p.y) <= TER.HALF;

// ── derived Layout ──────────────────────────────────────────────────────────────
function wallPts(wl) { return G.arcPoints(wl.a, wl.b, wl.bulge || 0); }
function wallLen(wl) { return G.polyLen(wallPts(wl)); }
function byId(w, id) {
  for (const k of ['walls', 'rooms', 'openings', 'roofs', 'buildings', 'stairs', 'objects', 'art', 'lights', 'paths']) {
    const f = w[k].find((e) => e.id === id); if (f) return { kind: k, item: f };
  }
  return null;
}
function nameOf(id, w = world) { const r = byId(w, id); return r ? r.item.name : id; }

function roomPoly(room, w = world) {
  let out = null;
  for (const wid of room.wallIds) {
    const wl = w.walls.find((x) => x.id === wid); if (!wl) return null;
    let pts = wallPts(wl);
    if (!out) { out = pts.slice(); continue; }
    const end = out[out.length - 1];
    if (G.near(pts[0], end, 0.02)) out.push(...pts.slice(1));
    else if (G.near(pts[pts.length - 1], end, 0.02)) out.push(...pts.slice().reverse().slice(1));
    else if (out.length === pts.length && G.near(pts[0], out[0], 0.02)) { out.reverse(); out.push(...pts.slice(1)); }
    else if (G.near(pts[pts.length - 1], out[0], 0.02)) { out.reverse(); out.push(...pts.slice().reverse().slice(1)); }
    else return null;
  }
  if (out && out.length > 2 && G.near(out[0], out[out.length - 1], 0.02)) out.pop();
  return out;
}
function roomsOfWall(wid, w = world) { return w.rooms.filter((r) => r.wallIds.includes(wid)); }

/** Outward unit normal of a room wall at its middle, or null for a free wall. */
function wallOutward(wl, w = world) {
  const rooms = roomsOfWall(wl.id, w); if (!rooms.length) return null;
  const pts = wallPts(wl), m = G.atLen(pts, G.polyLen(pts) / 2), n = G.left(m.dir);
  const poly = roomPoly(rooms[0], w); if (!poly) return null;
  return G.inPoly(G.add(m.p, G.mul(n, 0.3)), poly) ? G.mul(n, -1) : n;
}

// ── procedural building ───────────────────────────────────────────────────────
const STOREY = 3.0;
const PITCH = { low: 0.36, mid: 0.7, steep: 1.19 };
function footOf(b) { return b.shape === 'circle' ? G.circlePoly(b.c, b.r, 28) : b.pts; }
function bHeight(b) { return b.floors * STOREY; }
function bEdges(b) {
  const f = footOf(b);
  return f.map((a, i) => { const c = f[(i + 1) % f.length]; const d = G.norm(G.sub(c, a)); return { i, a, b: c, len: G.dist(a, c), dir: d, out: { x: d.y, y: -d.x } }; });
}
function groundRange(poly, w = world) {
  let lo = Infinity, hi = -Infinity;
  const c = G.centroid(poly), samples = poly.concat([c]);
  for (let i = 0; i < poly.length; i++) samples.push(G.mid(poly[i], c));
  for (const p of samples) { const h = hAt(p.x, p.y, w); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return { lo, hi };
}
/** Generated windows: a rhythm along each edge, skipping explicit openings. */
function bWindows(b, w = world) {
  if (b.windows === 'none') return [];
  const out = [], edges = bEdges(b), spacing = b.windows === 'regular' ? 2.4 : 4.6;
  const explicit = w.openings.filter((o) => o.hostKind === 'building' && o.hostId === b.id);
  const blocked = (e, s, f, half) => explicit.some((o) => o.edge === e && o.floor === f && Math.abs(o.s - s) < half + o.width / 2 + 0.3);
  if (b.shape === 'circle') {
    const every = b.windows === 'regular' ? 2 : 4;
    edges.forEach((e, k) => {
      if (k % every) return;
      for (let f = 0; f < b.floors; f++) if (!blocked(k, e.len / 2, f, 0.4)) out.push({ edge: k, s: e.len / 2, floor: f, width: Math.min(0.85, e.len * 0.7), height: 1.25, sill: 0.9 });
    });
    return out;
  }
  edges.forEach((e, k) => {
    const n = Math.floor((e.len - 1.0) / spacing); if (n < 1) return;
    const start = (e.len - (n - 1) * spacing) / 2;
    for (let i = 0; i < n; i++) {
      const s = start + i * spacing;
      for (let f = 0; f < b.floors; f++) if (!blocked(k, s, f, 0.6)) out.push({ edge: k, s, floor: f, width: 1.0, height: 1.3, sill: 0.9 });
    }
  });
  return out;
}

/** Roof faces over a CCW footprint. Each face: { pts:[{x,y,z}], part:'roof'|'gable' }. */
function roofFaces(poly, z0, style, pitch, ov = 0.25) {
  const P = (p, z) => ({ x: p.x, y: p.y, z });
  const faces = [];
  if (style === 'flat') {
    const e = G.offsetPoly(poly, 0.12);
    faces.push({ pts: e.map((p) => P(p, z0 + 0.25)), part: 'roofflat' });
    return faces;
  }
  if ((style === 'gable' || style === 'hip') && poly.length === 4) {
    const q = G.offsetPoly(poly, ov);
    let [p0, p1, p2, p3] = q;
    if (G.dist(p0, p1) < G.dist(p1, p2)) [p0, p1, p2, p3] = [p1, p2, p3, p0];
    const long = G.dist(p0, p1), short = G.dist(p1, p2);
    const rise = pitch * short / 2;
    let rA = G.mid(p3, p0), rB = G.mid(p1, p2);
    if (style === 'hip') {
      const d = G.norm(G.sub(rB, rA)), k = Math.min(short / 2, long / 2 - 0.01);
      rA = G.add(rA, G.mul(d, k)); rB = G.sub(rB, G.mul(d, k));
    }
    const zt = z0 + rise;
    faces.push({ pts: [P(p0, z0), P(p1, z0), P(rB, zt), P(rA, zt)], part: 'roof' });
    faces.push({ pts: [P(p2, z0), P(p3, z0), P(rA, zt), P(rB, zt)], part: 'roof' });
    const endPart = style === 'gable' ? 'gable' : 'roof';
    faces.push({ pts: [P(p1, z0), P(p2, z0), P(rB, zt)], part: endPart });
    faces.push({ pts: [P(p3, z0), P(p0, z0), P(rA, zt)], part: endPart });
    return faces;
  }
  const c = G.centroid(poly);
  const rad = poly.reduce((m, p) => m + G.dist(p, c), 0) / poly.length;
  const q = G.offsetPoly(poly, ov);
  if (style === 'dome') {
    const rings = 4, R = rad + ov;
    let prev = q.map((p) => P(p, z0));
    for (let k = 1; k <= rings; k++) {
      const phi = (k / rings) * (Math.PI / 2) * 0.92;
      const s = Math.cos(phi), z = z0 + R * Math.sin(phi) * 0.95;
      const ring = q.map((p) => P(G.add(c, G.mul(G.sub(p, c), s)), z));
      for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; faces.push({ pts: [prev[i], prev[j], ring[j], ring[i]], part: 'roof' }); }
      prev = ring;
    }
    faces.push({ pts: prev.slice(), part: 'roof' });
    return faces;
  }
  const apex = P(c, z0 + pitch * rad * (style === 'cone' ? 1.25 : 1));
  for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; faces.push({ pts: [P(q[i], z0), P(q[j], z0), apex], part: 'roof' }); }
  return faces;
}

// ── objects ───────────────────────────────────────────────────────────────────
const OBJECTS = {
  bench: { w: 1.6, d: 0.45, parts: [[-0.8, -0.22, 0.8, 0.22, 0.38, 0.46, 'wood'], [-0.74, -0.18, -0.62, 0.18, 0, 0.38, 'dark'], [0.62, -0.18, 0.74, 0.18, 0, 0.38, 'dark']] },
  table: { w: 1.4, d: 0.8, parts: [[-0.7, -0.4, 0.7, 0.4, 0.7, 0.76, 'wood'], [-0.64, -0.34, -0.58, -0.28, 0, 0.7, 'dark'], [0.58, -0.34, 0.64, -0.28, 0, 0.7, 'dark'], [-0.64, 0.28, -0.58, 0.34, 0, 0.7, 'dark'], [0.58, 0.28, 0.64, 0.34, 0, 0.7, 'dark']] },
  chair: { w: 0.5, d: 0.5, parts: [[-0.23, -0.23, 0.23, 0.23, 0.42, 0.47, 'wood'], [-0.23, 0.18, 0.23, 0.23, 0.47, 0.92, 'wood'], [-0.2, -0.2, -0.16, -0.16, 0, 0.42, 'dark'], [0.16, -0.2, 0.2, -0.16, 0, 0.42, 'dark']] },
  plinth: { w: 0.6, d: 0.6, parts: [[-0.3, -0.3, 0.3, 0.3, 0, 1.0, 'white']], blob: { z: 1.27, r: 0.27, c: 'bronze' } },
  sofa: { w: 2.0, d: 0.9, parts: [[-1, -0.45, 1, 0.45, 0, 0.42, 'fabric'], [-1, 0.22, 1, 0.45, 0.42, 0.82, 'fabric'], [-1, -0.45, -0.82, 0.45, 0.42, 0.62, 'fabric'], [0.82, -0.45, 1, 0.45, 0.42, 0.62, 'fabric']] },
  planter: { w: 0.7, d: 0.7, parts: [[-0.35, -0.35, 0.35, 0.35, 0, 0.5, 'stone']], blob: { z: 0.95, r: 0.48, c: 'leaf' } },
};
const OBJ_LABEL = { bench: 'Bench', table: 'Table', chair: 'Chair', plinth: 'Plinth', sofa: 'Sofa', planter: 'Planter' };

const OPENING_KINDS = {
  door: { width: 0.9, height: 2.1, sill: 0, label: 'Door' },
  window: { width: 1.2, height: 1.2, sill: 0.9, label: 'Window' },
  arch: { width: 1.4, height: 2.4, sill: 0, label: 'Arch', arched: true },
  round: { width: 0.8, height: 0.8, sill: 1.4, label: 'Round window', round: true },
  niche: { width: 0.8, height: 1.3, sill: 0.6, label: 'Niche', arched: true, blind: true },
  wide: { width: 2.4, height: 2.4, sill: 0, label: 'Wide opening' },
  doorway: { width: 1.2, height: 2.2, sill: 0, label: 'Doorway' },
  gate: { width: 1.4, height: 9, sill: 0, label: 'Gate' },
};

const ART_SIZES = { s: [0.5, 0.6], m: [0.8, 1.0], l: [1.4, 1.2] };
const ART_HUES = ['#c9a27a', '#7f9bb3', '#b97a6a', '#8fa682', '#d8c48a', '#6d6f8f', '#c58fa0', '#9fb7b0'];

// ── mutations (each one is what an accepted typed intent would do) ──────────────
function addWallChain(w, pts, bulges, closed, opts = {}) {
  const made = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (G.dist(a, b) < 0.05) continue;
    const { id, name } = nid(w, 'wall');
    const wl = { id, name, a: { ...a }, b: { ...b }, bulge: (bulges && bulges[i]) || 0, height: opts.height || 3, thick: 0.2, base: opts.base ?? 0, mat: [opts.mat || 'limewash', opts.mat || 'limewash'] };
    w.walls.push(wl); made.push(wl);
  }
  let room = null;
  if (closed && made.length >= 2) {
    const { id, name } = nid(w, 'room');
    room = { id, name, wallIds: made.map((x) => x.id), floor: null };
    w.rooms.push(room);
  }
  return { walls: made, room };
}
function addBuilding(w, spec) {
  const { id, name } = nid(w, 'building');
  const b = { id, name, shape: spec.shape, pts: spec.pts ? spec.pts.map((p) => ({ ...p })) : null, c: spec.c ? { ...spec.c } : null, r: spec.r || 0,
    floors: spec.floors || 2, roof: spec.roof || 'gable', pitch: spec.pitch || PITCH.mid, windows: spec.windows || 'regular',
    base: spec.base ?? 0, mat: spec.mat || 'limewash', roofMat: spec.roofMat || 'slate', overrides: {}, style: 'Cottage' };
  if (b.shape !== 'circle' && G.area(b.pts) < 0) b.pts.reverse();
  if (b.shape === 'circle' && b.roof !== 'flat') b.roof = 'cone';
  w.buildings.push(b);
  return b;
}
function addOpening(w, spec) {
  const k = OPENING_KINDS[spec.kind];
  const { id, name } = nid(w, 'opening', k.label);
  const o = { id, name, hostKind: spec.hostKind, hostId: spec.hostId, edge: spec.edge ?? null, floor: spec.floor ?? 0, s: spec.s, kind: spec.kind,
    width: spec.width ?? k.width, height: spec.height ?? k.height, sill: spec.sill ?? k.sill, origin: spec.origin || null };
  w.openings.push(o); return o;
}

/* Ground. Brush falloff is a smoothstep; the stroke's start height is the flatten reference. */
function brushTerrain(w, mode, c, radius, amt, ref) {
  const h = w.terrain.h;
  const i0 = Math.max(0, Math.floor(c.x + TER.HALF - radius)), i1 = Math.min(TER.N, Math.ceil(c.x + TER.HALF + radius));
  const j0 = Math.max(0, Math.floor(c.y + TER.HALF - radius)), j1 = Math.min(TER.N, Math.ceil(c.y + TER.HALF + radius));
  const copy = mode === 'smooth' ? h.slice() : null;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i - TER.HALF, y = j - TER.HALF, d = Math.hypot(x - c.x, y - c.y);
    if (d > radius) continue;
    const t = 1 - d / radius, f = t * t * (3 - 2 * t), k = vIdx(i, j);
    if (mode === 'raise') h[k] += amt * f;
    else if (mode === 'lower') h[k] -= amt * f;
    else if (mode === 'flatten') h[k] += (ref - h[k]) * Math.min(1, f * 0.35);
    else if (mode === 'smooth') {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < TER.V && jj < TER.V) { s += copy[vIdx(ii, jj)]; n++; } }
      h[k] += (s / n - h[k]) * f * 0.5;
    }
    h[k] = clamp(h[k], -4, 7);
  }
  clearDryWater(w);
}
function terraceTerrain(w, poly, height) {
  const h = w.terrain.h;
  for (let j = 0; j < TER.V; j++) for (let i = 0; i < TER.V; i++) {
    const p = { x: i - TER.HALF, y: j - TER.HALF };
    if (G.inPoly(p, poly)) h[vIdx(i, j)] = height;
  }
  clearDryWater(w);
}
function clearDryWater(w) {
  const t = w.terrain;
  for (let j = 0; j < TER.N; j++) for (let i = 0; i < TER.N; i++) {
    const c = cIdx(i, j); if (isNaN(t.water[c])) continue;
    const lo = Math.min(t.h[vIdx(i, j)], t.h[vIdx(i + 1, j)], t.h[vIdx(i, j + 1)], t.h[vIdx(i + 1, j + 1)]);
    if (lo > t.water[c] - 0.05) t.water[c] = NaN;
  }
}
function footprintBlocked(w, p, margin = 0.3) {
  for (const b of w.buildings) { const f = footOf(b); if (G.inPoly(p, f) || G.distPoly(p, f.concat([f[0]])).d < margin) return b; }
  return null;
}
function paintWater(w, c, radius, surface, depth) {
  const t = w.terrain; let kept = null;
  for (let j = 0; j < TER.N; j++) for (let i = 0; i < TER.N; i++) {
    const x = i - TER.HALF + 0.5, y = j - TER.HALF + 0.5;
    if (Math.hypot(x - c.x, y - c.y) > radius) continue;
    const blocked = footprintBlocked(w, { x, y }, 0.8); if (blocked) { kept = blocked; continue; }
    t.water[cIdx(i, j)] = surface;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const k = vIdx(i + di, j + dj), edge = Math.hypot(i + di - TER.HALF - c.x, j + dj - TER.HALF - c.y) > radius - 0.6;
      t.h[k] = Math.min(t.h[k], surface - (edge ? 0.25 : depth));
    }
  }
  return kept;
}

/* Plants. The scatter rule is applied once, here, at painting time. */
function plantAllowed(w, p) {
  if (!inWorkspace(p)) return false;
  if (!isNaN(waterAt(p.x, p.y, w))) return false;
  if (footprintBlocked(w, p, 0.4)) return false;
  for (const pa of w.paths) if (G.distPoly(p, pa.pts).d < pa.width / 2 + 0.25) return false;
  for (const wl of w.walls) if (G.distPoly(p, wallPts(wl)).d < 0.45) return false;
  for (const r of w.rooms) { const poly = roomPoly(r, w); if (poly && G.inPoly(p, poly)) return false; }
  return true;
}

// ── consequence planners ──────────────────────────────────────────────────────
let cseq = 0;
const cid = () => 'c' + (++cseq);

/** Every place a polyline crosses a wall or a building edge. */
function crossingsOf(w, pts) {
  const out = [];
  for (const wl of w.walls) {
    const wp = wallPts(wl);
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < wp.length - 1; k++) {
      const x = G.segX(pts[i], pts[i + 1], wp[k], wp[k + 1]);
      if (!x) continue;
      let s = 0; for (let q = 0; q < k; q++) s += G.dist(wp[q], wp[q + 1]); s += G.dist(wp[k], x.p);
      out.push({ host: 'wall', id: wl.id, s, at: x.p, low: wl.height <= 1.5, pathI: i + x.t });
    }
  }
  for (const b of w.buildings) for (const e of bEdges(b)) for (let i = 0; i < pts.length - 1; i++) {
    const x = G.segX(pts[i], pts[i + 1], e.a, e.b);
    if (x) out.push({ host: 'building', id: b.id, edge: e.i, s: x.u * e.len, at: x.p, edgeLen: e.len, pathI: i + x.t });
  }
  return out;
}
function openingCovers(w, host, id, edge, s) {
  return w.openings.find((o) => o.hostId === id && (host !== 'building' || (o.edge === edge && o.floor === 0)) && Math.abs(o.s - s) < o.width / 2 + 0.2 && o.sill < 0.3);
}

function planPath(w, pts, width) {
  const cons = [];
  for (const x of crossingsOf(w, pts)) {
    if (openingCovers(w, x.host, x.id, x.edge, x.s)) {
      cons.push({ id: cid(), type: 'uses', info: true, at: x.at, label: `Through ${nameOf(openingCovers(w, x.host, x.id, x.edge, x.s).id, w)}`, icon: 'doorway' });
      continue;
    }
    if (x.host === 'wall') {
      const kind = x.low ? 'gate' : 'doorway';
      cons.push({ id: cid(), type: 'opening', host: 'wall', hostId: x.id, s: x.s, kind, width: clamp(width + (x.low ? 0.2 : -0.2), 0.9, 2.2), at: x.at, accepted: true,
        label: `${x.low ? 'Gate' : 'Doorway'} in ${nameOf(x.id, w)}`, icon: 'doorway' });
    } else {
      cons.push({ id: cid(), type: 'opening', host: 'building', hostId: x.id, edge: x.edge, s: clamp(x.s, 0.8, x.edgeLen - 0.8), kind: 'door', width: 1.0, at: x.at, accepted: true,
        label: `Door into ${nameOf(x.id, w)}`, icon: 'doorway' });
    }
  }
  // Slope → steps or ramp
  const S = G.resample(pts, 0.5);
  let steepest = null, rise = 0;
  for (let i = 0; i < S.length - 1; i++) {
    const dz = Math.abs(hAt(S[i + 1].x, S[i + 1].y, w) - hAt(S[i].x, S[i].y, w));
    const g = dz / 0.5;
    if (g > 0.28) { rise += dz; if (!steepest || g > steepest.g) steepest = { g, at: G.mid(S[i], S[i + 1]) }; }
  }
  if (steepest) {
    const n = Math.max(2, Math.round(rise / 0.16));
    cons.push({ id: cid(), type: 'slope', at: steepest.at, options: ['steps', 'ramp'], choice: 'steps', count: n,
      labels: { steps: `${n} steps`, ramp: `Ramp 1:${Math.max(1, Math.round(1 / steepest.g))}` }, icon: 'steps' });
  }
  // Water → bridge, stones or nothing
  let run = null; const runs = [];
  S.forEach((p, i) => { const wet = !isNaN(waterAt(p.x, p.y, w)); if (wet && !run) run = { i0: i, i1: i }; else if (wet) run.i1 = i; else if (run) { runs.push(run); run = null; } });
  if (run) runs.push(run);
  for (const r of runs) {
    const a = S[Math.max(0, r.i0 - 1)], b = S[Math.min(S.length - 1, r.i1 + 1)];
    cons.push({ id: cid(), type: 'water', a, b, at: G.mid(S[r.i0], S[r.i1]), options: ['bridge', 'stones', 'none'], choice: 'bridge',
      labels: { bridge: 'Bridge', stones: 'Stepping stones', none: 'Wade through' }, icon: 'bridge' });
  }
  // Plants in the way
  const hit = w.plants.filter((p) => G.distPoly(p, pts).d < width / 2 + 0.3);
  if (hit.length) {
    const c = G.centroid(hit.slice(0, 40));
    cons.push({ id: cid(), type: 'clear', at: c, count: hit.length, accepted: true, label: `Clears ${hit.length} plant${hit.length > 1 ? 's' : ''}`, icon: 'clear' });
  }
  return cons;
}

function applyPath(w, spec, cons) {
  const { id, name } = nid(w, 'path');
  const path = { id, name, pts: spec.pts.map((p) => ({ ...p })), width: spec.width, surface: spec.surface, slope: 'steps', crossings: [] };
  for (const c of cons) {
    if (c.type === 'opening' && c.accepted) {
      const o = addOpening(w, { hostKind: c.host, hostId: c.hostId, edge: c.edge, s: c.s, kind: c.kind, width: c.width, origin: name });
      c.made = o.id;
    } else if (c.type === 'slope') path.slope = c.choice;
    else if (c.type === 'water') path.crossings.push({ a: c.a, b: c.b, mode: c.choice });
    else if (c.type === 'clear' && c.accepted) w.plants = w.plants.filter((p) => G.distPoly(p, path.pts).d >= path.width / 2 + 0.3);
  }
  w.paths.push(path);
  return path;
}

function planWalls(w, pts, bulges, closed) {
  const refused = [], cons = [];
  const n = closed ? pts.length : pts.length - 1;
  const segPts = [];
  for (let i = 0; i < n; i++) segPts.push(G.arcPoints(pts[i], pts[(i + 1) % pts.length], (bulges && bulges[i]) || 0));
  segPts.forEach((sp, i) => {
    for (const b of w.buildings) {
      const f = footOf(b), fc = f.concat([f[0]]);
      const crosses = sp.some((p) => G.inPoly(p, f)) || sp.some((p, k) => k < sp.length - 1 && fc.some((q, m) => m < fc.length - 1 && G.segX(p, sp[k + 1], q, fc[m + 1])));
      if (crosses) { refused.push({ i, reason: `Crosses ${b.name}` }); break; }
    }
  });
  for (const pa of w.paths) {
    segPts.forEach((sp, i) => {
      for (let k = 0; k < sp.length - 1; k++) for (let m = 0; m < pa.pts.length - 1; m++) {
        const x = G.segX(sp[k], sp[k + 1], pa.pts[m], pa.pts[m + 1]);
        if (x) {
          let s = 0; for (let q = 0; q < k; q++) s += G.dist(sp[q], sp[q + 1]); s += G.dist(sp[k], x.p);
          cons.push({ id: cid(), type: 'wallOpening', seg: i, s, at: x.p, accepted: true, label: `Doorway for ${pa.name}`, icon: 'doorway', width: clamp(pa.width - 0.2, 0.9, 2) });
        }
      }
    });
  }
  if (closed && pts.length >= 2) {
    const poly = segPts.flatMap((sp) => sp.slice(0, -1));
    const a = Math.abs(G.area(poly));
    cons.push({ id: cid(), type: 'room', info: true, at: G.centroid(poly), label: `Encloses Room ${(w.counters.Room || 0) + 1} · ${fmt(a, 1)} m²`, icon: 'room' });
  }
  return { refused, cons };
}

function planBuilding(w, foot) {
  const cons = []; let refused = null;
  for (const b of w.buildings) {
    const f = footOf(b);
    if (foot.some((p) => G.inPoly(p, f)) || f.some((p) => G.inPoly(p, foot))) { refused = `Overlaps ${b.name}`; break; }
  }
  if (!refused) for (const wl of w.walls) {
    const wp = wallPts(wl), fc = foot.concat([foot[0]]);
    if (wp.some((p) => G.inPoly(p, foot)) || wp.some((p, k) => k < wp.length - 1 && fc.some((q, m) => m < fc.length - 1 && G.segX(p, wp[k + 1], q, fc[m + 1])))) { refused = `Crosses ${wl.name}`; break; }
  }
  if (refused) return { refused, cons };
  const g = groundRange(foot, w);
  if (g.hi - g.lo > 0.15) {
    cons.push({ id: cid(), type: 'ground', at: G.centroid(foot), options: ['plinth', 'level'], choice: 'plinth', icon: 'plinth',
      labels: { plinth: `Plinth ${fmt(g.hi - g.lo, 1)} m`, level: 'Level the ground' }, lo: g.lo, hi: g.hi });
  }
  const tmp = { shape: 'poly', pts: G.area(foot) < 0 ? foot.slice().reverse() : foot };
  for (const pa of w.paths) {
    const edges = tmp.pts.map((a, i) => ({ i, a, b: tmp.pts[(i + 1) % tmp.pts.length] }));
    for (const e of edges) for (let m = 0; m < pa.pts.length - 1; m++) {
      const x = G.segX(e.a, e.b, pa.pts[m], pa.pts[m + 1]);
      if (x) { const L = G.dist(e.a, e.b); cons.push({ id: cid(), type: 'bdoor', edge: e.i, s: clamp(x.t * L, 0.8, L - 0.8), at: x.p, accepted: true, label: `Door for ${pa.name}`, icon: 'doorway' }); }
    }
  }
  const hit = w.plants.filter((p) => G.inPoly(p, foot) || G.distPoly(p, foot.concat([foot[0]])).d < 0.4);
  if (hit.length) cons.push({ id: cid(), type: 'clear', at: G.centroid(foot), count: hit.length, accepted: true, label: `Clears ${hit.length} plant${hit.length > 1 ? 's' : ''}`, icon: 'clear', foot });
  return { refused: null, cons };
}

// ── history (snapshot, demonstration only) ───────────────────────────────────
const HIST = { undo: [], redo: [] };
function commit(label, mutate, intent) {
  const before = structuredClone(world);
  const result = mutate(world);
  world.rev++;
  HIST.undo.push({ label, before, intent, mutate });
  if (HIST.undo.length > 60) HIST.undo.shift();
  HIST.redo = [];
  return result;
}
/** Re-plan the newest step with changed consequence choices. Still one undo step. */
function amendLast(label, mutate, intent) {
  const top = HIST.undo[HIST.undo.length - 1]; if (!top) return null;
  world = structuredClone(top.before);
  const result = mutate(world);
  world.rev = top.before.rev + 1;
  top.label = label; top.intent = intent; top.mutate = mutate;
  return result;
}
/* A brush stroke edits the world live; the step is recorded when the stroke ends. */
let LIVE = null;
function liveBegin() { LIVE = structuredClone(world); }
function liveEnd(label, intent) {
  if (!LIVE) return;
  HIST.undo.push({ label, before: LIVE, intent }); HIST.redo = [];
  if (HIST.undo.length > 60) HIST.undo.shift();
  world.rev++; LIVE = null;
}
function liveCancel() { if (LIVE) { world = LIVE; LIVE = null; } }
function undo() {
  const e = HIST.undo.pop(); if (!e) return null;
  HIST.redo.push({ label: e.label, after: world, before: e.before, intent: e.intent });
  world = structuredClone(e.before);
  return e;
}
function redo() {
  const e = HIST.redo.pop(); if (!e) return null;
  HIST.undo.push({ label: e.label, before: structuredClone(world), intent: e.intent });
  world = e.after;
  return e;
}
