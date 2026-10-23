// Mock spatial model and SVG readings for the production-shell wireframe.
// Nothing here is a format, evaluator or compiler: it is just enough geometry to make
// readings, selection, handles and erasing legible. Units are metres; z is up.

export function seedModel() {
  return {
    structures: [{ id: 'st-boat', name: 'Boathouse' }],
    levels: [{ id: 'lv-g', name: 'Ground', structure: 'st-boat', z: 0 }],
    pins: [{ id: 'pin-eave', z: 4.2, label: 'Gallery eave' }],
    walls: [
      { id: 'w-s1', name: 'South wall', a: [0, 0], b: [12, 0], base: 0, top: 4.2 },
      { id: 'w-d', name: 'Studio divider', a: [12, 0], b: [12, 6], base: 0, top: 4.2 },
      { id: 'w-n1', name: 'North wall', a: [12, 6], b: [0, 6], base: 0, top: 4.2 },
      { id: 'w-w', name: 'West wall', a: [0, 6], b: [0, 0], base: 0, top: 4.2 },
      { id: 'w-s2', name: 'Studio south wall', a: [12, 0], b: [18, 0], base: 0, top: 3.6 },
      { id: 'w-e', name: 'Studio east wall', a: [18, 0], b: [18, 8], base: 0, top: 3.6 },
      { id: 'w-n2', name: 'Studio north wall', a: [18, 8], b: [12, 8], base: 0, top: 3.6 },
      { id: 'w-r', name: 'Studio return wall', a: [12, 8], b: [12, 6], base: 0, top: 3.6 },
    ].map((w) => ({ ...w, level: 'lv-g', structure: 'st-boat' })),
    rooms: [
      { id: 'room-gal', name: 'Long gallery', walls: ['w-s1', 'w-d', 'w-n1', 'w-w'], poly: [[0, 0], [12, 0], [12, 6], [0, 6]], z: 0 },
      { id: 'room-stu', name: 'Studio', walls: ['w-s2', 'w-e', 'w-n2', 'w-r', 'w-d'], poly: [[12, 0], [18, 0], [18, 8], [12, 8]], z: 0 },
    ].map((r) => ({ ...r, kind: 'room', level: 'lv-g', structure: 'st-boat' })),
    openings: [
      { id: 'o-entry', name: 'Entry arch', host: 'w-s1', at: 3.2, w: 1.6, h: 2.8, sill: 0, arch: true },
      { id: 'o-pass', name: 'Studio passage', host: 'w-d', at: 3.0, w: 2.0, h: 2.6, sill: 0 },
      { id: 'o-win', name: 'East window', host: 'w-e', at: 4.0, w: 2.4, h: 1.4, sill: 1.0 },
      { id: 'o-clere', name: 'Clerestory', host: 'w-n1', at: 6, w: 6, h: 0.5, sill: 3.4 },
    ],
    roofs: [
      { id: 'r-gal', name: 'Gallery roof', x0: -0.4, x1: 12.4, y0: -0.4, y1: 6.4, prof: [[0, 4.2], [3.4, 6.6], [6.8, 4.2]], over: ['w-s1', 'w-n1', 'w-w', 'w-d'], structure: 'st-boat' },
      { id: 'r-stu', name: 'Studio roof', x0: 12, x1: 18, y0: 0, y1: 8, prof: [[0, 3.6], [8, 3.6]], over: ['w-s2', 'w-e', 'w-n2'], structure: 'st-boat' },
    ],
    objects: [
      { id: 'b-bench', name: 'Oak bench', kind: 'bench', fit: 'extend', x: 5, y: 2.6, w: 1.8, d: 0.5, h: 0.45, rot: 0, z: 0 },
      { id: 'b-sculpt', name: 'Torso', kind: 'sculpture', fit: 'proportional', x: 9, y: 3, w: 0.5, d: 0.5, h: 0.9, rot: 0, z: 1.0 },
      { id: 'b-plinth', name: 'Plinth', kind: 'plinth', fit: 'stretch', x: 9, y: 3, w: 0.6, d: 0.6, h: 1.0, rot: 0, z: 0 },
      { id: 'b-piano', name: 'Pleyel piano', kind: 'piano', fit: 'fixed', x: 15, y: 4.6, w: 1.5, d: 2.0, h: 1.0, rot: 20, z: 0 },
      { id: 'b-column', name: 'Doric column', kind: 'column', fit: 'stretch', imported: true, x: 13.2, y: 1.2, w: 0.5, d: 0.5, h: 3.0, rot: 0, z: 0 },
    ].map((o) => ({ ...o, level: 'lv-g' })),
    artworks: [
      { id: 'a-1', name: 'Harbour at dusk', host: 'w-n1', at: 2.6, w: 1.4, h: 1.0, c: 1.6 },
      { id: 'a-2', name: 'Two boats', host: 'w-n1', at: 4.6, w: 1.2, h: 0.9, c: 1.6 },
      { id: 'a-3', name: 'Net mender', host: 'w-n1', at: 9.4, w: 1.0, h: 1.3, c: 1.6 },
    ],
    imports: [],
    finishes: {},
    views: [
      { id: 'v-entry', name: 'Entry', pos: [3.2, -5.5, 1.6], target: [6, 3, 1.5], lens: 26 },
      { id: 'v-long', name: 'Long view', pos: [11.2, 5.2, 1.6], target: [1, 1.2, 1.5], lens: 24 },
      { id: 'v-bench', name: 'From the bench', pos: [6, 0.5, 1.5], target: [6, 6, 1.9], lens: 20 },
      { id: 'v-torso', name: 'Torso close', pos: [7.4, 1.6, 1.5], target: [9, 3, 1.4], lens: 32 },
      { id: 'v-piano', name: 'Piano', pos: [13.2, 1.2, 1.6], target: [15, 4.6, 0.9], lens: 26 },
    ],
    presentations: [
      { id: 'p-arrival', name: 'Arrival', views: ['v-entry', 'v-long'], def: 'v-entry', subject: null },
      { id: 'p-north', name: 'The north wall', views: ['v-bench'], def: 'v-bench', subject: 'w-n1' },
      { id: 'p-torso', name: 'Torso', views: ['v-torso'], def: 'v-torso', subject: 'b-sculpt' },
      { id: 'p-studio', name: 'The studio piano', views: ['v-piano'], def: 'v-piano', subject: 'b-piano' },
    ],
    guides: [
      {
        id: 'g-walk', name: 'Opening walk',
        stops: [
          { id: 's1', pres: 'p-arrival', views: ['v-entry'], hold: 4 },
          { id: 's2', pres: 'p-north', views: ['v-bench'], hold: 6 },
          { id: 's3', pres: 'p-torso', views: ['v-torso'], hold: 5 },
          { id: 's4', pres: 'p-studio', views: ['v-piano'], hold: 6 },
          { id: 's5', pres: 'p-arrival', views: ['v-long'], hold: 4 },
        ],
        edges: [{ mode: 'travel', dur: 5, pts: [[3.2, -1.2], [3.2, 0.8]] }, { mode: 'travel', dur: 4 }, { mode: 'travel', dur: 6, pts: [[11.2, 3], [12.8, 3]] }, { mode: 'cut', dur: 0 }],
      },
    ],
  };
}

/** Roof helpers: a rectangular roof is a section profile [s, z] swept along x; s runs across the span from y0. */
export function roofProf(r) { return r.prof || [[0, r.eave ?? 3], [(r.y1 - r.y0) || 1, r.eave ?? 3]]; }
export function roofEave(r) { const p = roofProf(r); return Math.min(p[0][1], p.at(-1)[1]); }
export function roofTop(r) { return Math.max(...roofProf(r).map((q) => q[1])); }
export function roofFlat(r) { const p = roofProf(r); return p.every((q) => Math.abs(q[1] - p[0][1]) < 0.01); }

// ---------- small vector helpers ----------
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const mul = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const len = (a) => Math.hypot(...a);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rad = (d) => (d * Math.PI) / 180;

export function wallById(m, id) { return m.walls.find((w) => w.id === id); }
export function wallLen(w) { return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); }
export function wallPoint(w, t) { const L = wallLen(w); return [w.a[0] + ((w.b[0] - w.a[0]) * t) / L, w.a[1] + ((w.b[1] - w.a[1]) * t) / L]; }

/** Every entity, flat, with a kind. */
export function entities(m) {
  return [
    ...m.walls.map((e) => ({ ...e, kind: 'wall' })),
    ...m.openings.map((e) => ({ ...e, kind: 'opening' })),
    ...m.roofs.map((e) => ({ ...e, kind: 'roof' })),
    ...m.objects.map((e) => ({ ...e, kind: 'object' })),
    ...m.artworks.map((e) => ({ ...e, kind: 'artwork' })),
    ...m.rooms.filter((r) => roomEnclosed(m, r)).map((e) => ({ ...e, kind: 'room' })),
    ...m.imports.map((e) => ({ ...e, kind: 'import' })),
  ];
}
export function find(m, id) { return entities(m).find((e) => e.id === id) || null; }
export function roomEnclosed(m, r) { return r.walls.every((id) => wallById(m, id)); }

// ---------- primitives ----------
export function footprint(o) {
  const c = Math.cos(rad(o.rot || 0)), s = Math.sin(rad(o.rot || 0));
  const hw = o.w / 2, hd = o.d / 2;
  // a profile keeps its drawn outline, normalised to -0.5..0.5 so width and depth still scale it
  const loc = o.outline ? o.outline.map(([u, v]) => [u * o.w, v * o.d]) : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  return loc.map(([u, v]) => [o.x + u * c - v * s, o.y + u * s + v * c]);
}
function boxPrims(id, kind, o) {
  const corners = footprint(o);
  const z0 = o.z || 0, z1 = z0 + o.h;
  const prims = [{ id, kind, role: 'top', pts: corners.map((p) => [...p, z1]) }];
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i], q = corners[(i + 1) % corners.length];
    prims.push({ id, kind, role: 'side', pts: [[...p, z0], [...q, z0], [...q, z1], [...p, z1]], n: [q[1] - p[1], p[0] - q[0], 0] });
  }
  return prims;
}

function openingOutline(w, o, inset = 0) {
  const L = wallLen(w);
  const d = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
  const nrm = [-d[1] * inset, d[0] * inset];
  const at = (t, z) => [w.a[0] + d[0] * t + nrm[0], w.a[1] + d[1] * t + nrm[1], z];
  const t0 = o.at - o.w / 2, t1 = o.at + o.w / 2, z0 = o.sill, z1 = o.sill + o.h;
  if (o.round) { const r = o.w / 2, zc = o.sill + o.h / 2; return Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return at(o.at + r * Math.cos(a), zc + (o.h / 2) * Math.sin(a)); }); }
  if (!o.arch) return [at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)];
  const r = o.w / 2, spring = z1 - r, pts = [at(t0, z0), at(t1, z0)];
  for (let k = 0; k <= 10; k++) { const a = (Math.PI * k) / 10; pts.push(at(o.at + r * Math.cos(a), spring + r * Math.sin(a))); }
  pts.push(at(t0, z0));
  return pts;
}

export function prims(m, opt = {}) {
  const out = [];
  const lift = opt.lift ? 2.6 : 0;
  for (const r of m.rooms) {
    if (r.type === 'platform') {
      // a raised horizontal surface: a slab, not a Level
      out.push({ id: r.id, kind: 'room', role: 'top', pts: r.poly.map((p) => [...p, r.z]), n: [0, 0, 1] });
      for (let i = 0; i < r.poly.length; i++) { const p = r.poly[i], q = r.poly[(i + 1) % r.poly.length]; out.push({ id: r.id, kind: 'room', role: 'side', pts: [[...p, r.z - 0.25], [...q, r.z - 0.25], [...q, r.z], [...p, r.z]], n: [q[1] - p[1], p[0] - q[0], 0] }); }
    } else if (roomEnclosed(m, r)) out.push({ id: r.id, kind: 'room', role: 'floor', pts: r.poly.map((p) => [...p, r.z + 0.001]), floor: true });
  }
  for (const w of m.walls) {
    out.push({ id: w.id, kind: 'wall', role: 'wall', pts: [[...w.a, w.base], [...w.b, w.base], [...w.b, w.top], [...w.a, w.top]], n: [w.b[1] - w.a[1], w.a[0] - w.b[0], 0] });
    { const L = wallLen(w), t = (w.th ?? 0.24) / 2, n = [-(w.b[1] - w.a[1]) / L * t, (w.b[0] - w.a[0]) / L * t]; out.push({ id: w.id, kind: 'wall', role: 'cap', pts: [[w.a[0] + n[0], w.a[1] + n[1], w.top], [w.b[0] + n[0], w.b[1] + n[1], w.top], [w.b[0] - n[0], w.b[1] - n[1], w.top], [w.a[0] - n[0], w.a[1] - n[1], w.top]], n: [0, 0, 1] }); }
    for (const o of m.openings.filter((o) => o.host === w.id)) out.push({ id: o.id, kind: 'opening', role: 'hole', host: w.id, pts: openingOutline(w, o) });
    for (const a of m.artworks.filter((a) => a.host === w.id)) {
      const L = wallLen(w), d = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L];
      const mid = wallPoint(w, a.at); let n = [-d[1], d[0]];
      const room = m.rooms.find((r) => r.walls.includes(w.id));
      if (room) { const c = centroid2(room.poly); if ((c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] < 0) n = [-n[0], -n[1]]; }
      const off = [n[0] * 0.06, n[1] * 0.06];
      const p = (t, z) => [w.a[0] + d[0] * t + off[0], w.a[1] + d[1] * t + off[1], z];
      out.push({ id: a.id, kind: 'artwork', role: 'art', host: w.id, pts: [p(a.at - a.w / 2, a.c - a.h / 2), p(a.at + a.w / 2, a.c - a.h / 2), p(a.at + a.w / 2, a.c + a.h / 2), p(a.at - a.w / 2, a.c + a.h / 2)] });
    }
  }
  for (const r of m.roofs) {
    const L = lift;
    if (r.poly) { out.push({ id: r.id, kind: 'roof', role: 'roof', pts: r.poly.map((p) => [p[0], p[1], (r.eave ?? roofEave(r)) + L]), n: [0, 0, 1] }); continue; }
    const pr = roofProf(r).map(([s, z]) => [r.y0 + s, z + L]);
    for (let k = 0; k < pr.length - 1; k++) {
      const [ya, za] = pr[k], [yb, zb] = pr[k + 1];
      out.push({ id: r.id, kind: 'roof', role: 'roof', seg: k, pts: [[r.x0, ya, za], [r.x1, ya, za], [r.x1, yb, zb], [r.x0, yb, zb]], n: [0, -(zb - za), yb - ya || 1e-3] });
    }
    const capArea = Math.abs(pr.reduce((s, p, i) => { const q = pr[(i + 1) % pr.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
    if (capArea > 0.02) for (const x of [r.x0, r.x1]) out.push({ id: r.id, kind: 'roof', role: 'gable', pts: pr.map(([y, z]) => [x, y, z]), n: [x === r.x0 ? -1 : 1, 0, 0] });
  }
  for (const o of m.objects) out.push(...boxPrims(o.id, 'object', o));
  for (const im of m.imports) out.push(...boxPrims(im.id, 'import', im));
  return out;
}

export function centroid2(poly) { const n = poly.length; return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]; }

// ---------- cameras ----------
// Every camera maps world [x,y,z] → [u, v, depth] with depth larger = nearer the viewer.
export function camera(kind, o = {}) {
  if (kind === 'axo') {
    const A = rad(o.az ?? 35), E = rad(o.el ?? 32), c = Math.cos(A), s = Math.sin(A), se = Math.sin(E), ce = Math.cos(E);
    return {
      kind, P: ([x, y, z]) => { const X = x * c - y * s, Y = x * s + y * c; return [X, -Y * se - z * ce, -Y * ce + z * se]; },
      // inverse onto plane z = h
      onPlane: (u, v, h) => { const X = u, Y = -(v + h * ce) / se; return [X * c + Y * s, -X * s + Y * c]; },
      ray: (u, v) => { const X = u, Y = -v / se; const p0 = [X * c + Y * s, -X * s + Y * c, 0]; const dW = [0, ce, se]; /* view dir toward camera in rotated space */ return { p0, dir: [dW[1] * s, dW[1] * c, dW[2]], ortho: true }; },
    };
  }
  if (kind === 'plan') return { kind, P: ([x, y, z]) => [x, -y, z], onPlane: (u, v) => [u, -v] };
  if (kind === 'elev') {
    const f = o.face || 'S';
    const map = { S: ([x, y, z]) => [x, -z, -y], N: ([x, y, z]) => [-x, -z, y], E: ([x, y, z]) => [y, -z, x], W: ([x, y, z]) => [-y, -z, -x] }[f];
    return { kind, face: f, P: map };
  }
  if (kind === 'sect') {
    const { a, d, n } = o; // looking toward +n
    return { kind, P: ([x, y, z]) => [(x - a[0]) * d[0] + (y - a[1]) * d[1], -z, -((x - a[0]) * n[0] + (y - a[1]) * n[1])] };
  }
  if (kind === 'persp') {
    const C = o.pos, f = norm(sub(o.target, C)), up = [0, 0, 1];
    const r = norm(cross(f, up)), u = cross(r, f), F = o.F ?? 10;
    return {
      kind, C, f, r, u, F,
      P: (p) => { const q = sub(p, C); const zc = Math.max(dot(q, f), 0.05); return [(dot(q, r) / zc) * F, (-dot(q, u) / zc) * F, -zc, dot(q, f) < 0.05]; },
      // clip a world polygon against the near plane, then project (keeps floors under the camera)
      clip: (pts) => {
        const cs = pts.map((p) => { const q = sub(p, C); return [dot(q, r), dot(q, u), dot(q, f)]; });
        const N = 0.12, out = [];
        for (let i = 0; i < cs.length; i++) {
          const a = cs[i], b = cs[(i + 1) % cs.length], ina = a[2] >= N, inb = b[2] >= N;
          if (ina) out.push(a);
          if (ina !== inb) { const t = (N - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N]); }
        }
        return out.map(([x, y, z]) => [(x / z) * F, (-y / z) * F, -z]);
      },
      onPlane: (U, V, h) => { const dir = norm(add(add(f, mul(r, U / F)), mul(u, -V / F))); if (Math.abs(dir[2]) < 1e-4) return null; const t = (h - C[2]) / dir[2]; if (t <= 0) return null; return [C[0] + dir[0] * t, C[1] + dir[1] * t]; },
    };
  }
  throw new Error(kind);
}

/** Orbit-style perspective camera used when the 3D reading asks for Perspective. */
export function orbitPersp(az, el = 30, dist = 30, target = [9, 4, 1.5]) {
  const A = rad(az), E = rad(el);
  const pos = [target[0] - Math.sin(A) * Math.cos(E) * dist, target[1] - Math.cos(A) * Math.cos(E) * dist, target[2] + Math.sin(E) * dist];
  return camera('persp', { pos, target, F: 22 });
}

// ---------- palettes ----------
export const PAL = {
  mat: { bg: '#1D3A33', floor: '#24443b', wall: [205, 211, 200], roof: [176, 186, 172], line: 'rgba(243,244,238,.75)', soft: 'rgba(243,244,238,.35)', obj: [221, 214, 196], art: '#b79a62', imp: [150, 160, 170], sel: '#d4ad45', selTint: 'rgba(212,173,69,.28)', hole: '#13241f', text: '#F3F4EE' },
  paper: { bg: '#e9ebe6', floor: '#f4f5f1', wall: [252, 252, 249], roof: [246, 247, 243], line: '#1b201c', soft: 'rgba(27,32,28,.35)', obj: [252, 252, 249], art: '#fff', imp: [236, 238, 240], sel: '#74560c', selTint: 'rgba(212,173,69,.22)', hole: '#e9ebe6', text: '#1b201c' },
  shadedPaper: { bg: '#e9ebe6', floor: '#dfe2dc', wall: [236, 237, 232], roof: [214, 218, 210], line: '#1b201c', soft: 'rgba(27,32,28,.35)', obj: [226, 222, 210], art: '#c8b48a', imp: [205, 210, 214], sel: '#74560c', selTint: 'rgba(212,173,69,.22)', hole: '#c9cec6', text: '#1b201c' },
};
const LIGHT = norm([-0.5, -0.8, 0.9]);
function shade(rgb, n, flat) {
  if (flat || !n) return `rgb(${rgb.join(',')})`;
  const k = 0.7 + 0.3 * Math.abs(dot(norm(n), LIGHT)); // two-sided: interiors read lit too
  return `rgb(${rgb.map((c) => Math.round(c * k)).join(',')})`;
}

// ---------- solid renderer (3D, elevations, section, eye) ----------
/**
 * opts: pal, flat (paper lines), sel, hover, marked:Set, ghost:fn(id)->bool, hidden:fn(id)->bool,
 *       finishes, sheet:{h, extent}, lift
 * Returns { svg, centroids:{id:[u,v]}, bounds }
 */
export function renderSolid(m, cam, opts) {
  const pal = opts.pal, ps = prims(m, { lift: opts.lift });
  const list = [];
  const cents = {};
  for (const p of ps) {
    if (opts.hidden && opts.hidden(p.id, p)) continue;
    const q = cam.clip ? cam.clip(p.pts) : p.pts.map(cam.P);
    if (q.length < 3 || q.some((v) => v[3])) continue;
    let depth = q.reduce((s, v) => s + v[2], 0) / q.length;
    // painter's order by story first (a floor slab covers the story below it), then depth
    const zmin = Math.min(...p.pts.map((v) => v[2])), stories = opts.stories || [0];
    let story = 0; stories.forEach((z, i) => { if (zmin >= z - 0.02) story = i; });
    const camZ = cam.kind === 'persp' ? cam.C[2] : Infinity;
    let key = stories[story] > camZ ? -story - 10 : story;
    if (p.kind === 'roof') key = camZ < 3.5 ? -100 : 100; // from above roofs read over everything; from eye level they sit behind
    if (p.floor) depth -= 1e4;
    if (p.role === 'hole' || p.role === 'art') depth += 0.02;
    list.push({ p, q, depth: key * 1e6 + depth });
    const c = cents[p.id] || (cents[p.id] = { u: 0, v: 0, n: 0 });
    for (const v of q) { c.u += v[0]; c.v += v[1]; c.n++; }
  }
  // hosted openings and art sort just in front of their own wall, whatever their height on it
  const wd = {}; for (const it of list) if (it.p.role === 'wall') wd[it.p.id] = it.depth;
  for (const it of list) if (it.p.host && wd[it.p.host] != null) it.depth = wd[it.p.host] + (it.p.role === 'art' ? 0.03 : 0.02);
  list.sort((a, b) => a.depth - b.depth);
  // perspective: cull faces facing away is unnecessary for low-fi; painter is enough
  let svg = '';
  for (const { p, q } of list) {
    const pts = q.map((v) => `${v[0].toFixed(3)},${v[1].toFixed(3)}`).join(' ');
    const cls = ['p', `p-${p.kind}`, `r-${p.role}`];
    if (opts.sel && opts.sel.has(p.id)) cls.push('is-sel');
    if (opts.hover === p.id) cls.push('is-hover');
    if (opts.marked && opts.marked.has(p.id)) cls.push('is-mark');
    if (opts.ghost && opts.ghost(p.id, p)) cls.push('is-ghost');
    else if (opts.dim && opts.dim(p.id)) cls.push('is-dim');
    if (opts.related && opts.related.has(p.id)) cls.push('is-related');
    if (opts.xray && p.kind === 'roof') cls.push('is-xray');
    if (opts.cut && opts.cut.has(p.id)) cls.push('is-cut');
    let fill;
    const fin = opts.finishes && opts.finishes[p.id];
    if (p.role === 'hole') fill = pal.hole;
    else if (p.role === 'floor') fill = fin ? fin.color : pal.floor;
    else if (p.kind === 'room') fill = fin ? fin.color : shade(pal.obj, p.role === 'top' ? [0, 0, 1] : p.n, opts.flat);
    else if (p.role === 'art') fill = pal.art;
    else if (p.kind === 'roof') fill = shade(pal.roof, p.n, opts.flat);
    else if (p.kind === 'object') fill = shade(pal.obj, p.role === 'top' ? [0, 0, 1] : p.n, opts.flat);
    else if (p.kind === 'import') fill = shade(pal.imp, p.role === 'top' ? [0, 0, 1] : p.n, opts.flat);
    else fill = fin ? fin.color : shade(pal.wall, p.n, opts.flat);
    const extra = p.kind === 'import' ? ' data-hatch="1"' : '';
    svg += `<polygon class="${cls.join(' ')}" data-id="${p.id}" points="${pts}" fill="${fill}"${extra}/>`;
  }
  if (opts.sheet) svg += sheetSvg(cam, opts.sheet);
  const centroids = {};
  for (const [id, c] of Object.entries(cents)) centroids[id] = [c.u / c.n, c.v / c.n];
  return { svg, centroids };
}

function sheetSvg(cam, sheet) {
  const [x0, y0, x1, y1] = sheet.extent;
  const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => cam.P([x, y, sheet.h]));
  if (q.some((v) => v[3])) return '';
  const pts = q.map((v) => `${v[0]},${v[1]}`).join(' ');
  let grid = '';
  for (let x = Math.ceil(x0); x <= x1; x += 1) { const a = cam.P([x, y0, sheet.h]), b = cam.P([x, y1, sheet.h]); grid += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
  for (let y = Math.ceil(y0); y <= y1; y += 1) { const a = cam.P([x0, y, sheet.h]), b = cam.P([x1, y, sheet.h]); grid += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
  return `<g class="sheet${sheet.outline ? ' outline' : ''}"><polygon points="${pts}"/>${sheet.outline ? '' : `<g class="sheet-grid">${grid}</g>`}</g>`;
}

// ---------- plan renderer ----------
export function renderPlan(m, opts) {
  const pal = opts.pal; let svg = '';
  const cls = (id, base) => {
    const c = [base];
    if (opts.sel && opts.sel.has(id)) c.push('is-sel');
    if (opts.hover === id) c.push('is-hover');
    if (opts.marked && opts.marked.has(id)) c.push('is-mark');
    if (opts.ghost && opts.ghost(id)) c.push('is-ghost');
    else if (opts.dim && opts.dim(id)) c.push('is-dim');
    if (opts.related && opts.related.has(id)) c.push('is-related');
    return c.join(' ');
  };
  const hidden = (id) => opts.hidden && opts.hidden(id);
  const centroids = {};
  let labels = ''; // room names paint last, over furniture
  for (const r of m.rooms) {
    if (!roomEnclosed(m, r) || hidden(r.id)) continue;
    const fin = opts.finishes && opts.finishes[r.id];
    svg += `<polygon class="${cls(r.id, r.type === 'platform' ? 'pl-room pl-plat' : 'pl-room')}" data-id="${r.id}" points="${r.poly.map((p) => `${p[0]},${-p[1]}`).join(' ')}" fill="${fin ? fin.color : pal.floor}"/>`;
    const c = centroid2(r.poly); centroids[r.id] = [c[0], -c[1]];
    const area = polyArea(r.poly).toFixed(1);
    if (opts.labels !== false) labels += `<text class="pl-label" x="${c[0]}" y="${-c[1] - 0.15}">${r.name}</text><text class="pl-meta" x="${c[0]}" y="${-c[1] + 0.45}">${area} m²</text>`;
  }
  for (const r of m.roofs) {
    if (hidden(r.id)) continue;
    if (r.poly) { svg += `<polygon class="${cls(r.id, 'pl-roof')}" data-id="${r.id}" points="${r.poly.map((p) => `${p[0]},${-p[1]}`).join(' ')}"/>`; const c = centroid2(r.poly); centroids[r.id] = [c[0], -c[1]]; continue; }
    svg += `<rect class="${cls(r.id, 'pl-roof')}" data-id="${r.id}" x="${r.x0}" y="${-r.y1}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}"/>`;
    const pr = roofProf(r); for (let k = 1; k < pr.length - 1; k++) if (pr[k][1] >= pr[k - 1][1] && pr[k][1] >= pr[k + 1][1]) { const ym = -(r.y0 + pr[k][0]); svg += `<line class="${cls(r.id, 'pl-ridge')}" x1="${r.x0}" y1="${ym}" x2="${r.x1}" y2="${ym}"/>`; }
    centroids[r.id] = [(r.x0 + r.x1) / 2, -(r.y0 + r.y1) / 2];
  }
  for (const w of m.walls) {
    if (hidden(w.id)) continue;
    const L = wallLen(w), ht = (w.th ?? 0.24) / 2, d = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], n = [-d[1] * ht, d[0] * ht];
    const ops = m.openings.filter((o) => o.host === w.id && o.sill - w.base < 1.2).sort((a, b) => a.at - b.at);
    let t = 0; const spans = [];
    for (const o of ops) { spans.push([t, o.at - o.w / 2]); t = o.at + o.w / 2; }
    spans.push([t, L]);
    const pt = (s) => [w.a[0] + d[0] * s, w.a[1] + d[1] * s];
    let poly = '';
    for (const [s0, s1] of spans) {
      if (s1 - s0 < 0.01) continue;
      const p0 = pt(s0), p1 = pt(s1);
      const q = [[p0[0] + n[0], p0[1] + n[1]], [p1[0] + n[0], p1[1] + n[1]], [p1[0] - n[0], p1[1] - n[1]], [p0[0] - n[0], p0[1] - n[1]]];
      poly += `<polygon points="${q.map((p) => `${p[0]},${-p[1]}`).join(' ')}"/>`;
    }
    svg += `<g class="${cls(w.id, 'pl-wall')}" data-id="${w.id}">${poly}<line class="pl-hit" x1="${w.a[0]}" y1="${-w.a[1]}" x2="${w.b[0]}" y2="${-w.b[1]}"/></g>`;
    const mid = pt(L / 2); centroids[w.id] = [mid[0], -mid[1]];
    for (const o of m.openings.filter((o) => o.host === w.id)) {
      if (hidden(o.id)) continue;
      const p0 = pt(o.at - o.w / 2), p1 = pt(o.at + o.w / 2), c = pt(o.at);
      centroids[o.id] = [c[0], -c[1]];
      const rs = o.sill - w.base;
      if (rs < 1.2 && !o.arch && rs < 0.01) {
        // swing
        const r = o.w, sw = [p0[0] + n[0] / ht * r * -1, p0[1] + n[1] / ht * r * -1];
        svg += `<g class="${cls(o.id, 'pl-open')}" data-id="${o.id}"><line x1="${p0[0]}" y1="${-p0[1]}" x2="${sw[0]}" y2="${-sw[1]}"/><path d="M ${sw[0]} ${-sw[1]} A ${r} ${r} 0 0 ${d[0] + d[1] > 0 ? 0 : 1} ${p1[0]} ${-p1[1]}"/><line class="pl-hit" x1="${p0[0]}" y1="${-p0[1]}" x2="${p1[0]}" y2="${-p1[1]}"/></g>`;
      } else if (rs < 1.2) {
        svg += `<g class="${cls(o.id, 'pl-open')}" data-id="${o.id}"><path d="M ${p0[0]} ${-p0[1]} Q ${c[0] - n[0] * 6} ${-(c[1] - n[1] * 6)} ${p1[0]} ${-p1[1]}"/><line class="pl-hit" x1="${p0[0]}" y1="${-p0[1]}" x2="${p1[0]}" y2="${-p1[1]}"/></g>`;
      } else {
        svg += `<g class="${cls(o.id, 'pl-open pl-high')}" data-id="${o.id}"><line x1="${p0[0] + n[0]}" y1="${-(p0[1] + n[1])}" x2="${p1[0] + n[0]}" y2="${-(p1[1] + n[1])}"/><line x1="${p0[0] - n[0]}" y1="${-(p0[1] - n[1])}" x2="${p1[0] - n[0]}" y2="${-(p1[1] - n[1])}"/><line class="pl-hit" x1="${p0[0]}" y1="${-p0[1]}" x2="${p1[0]}" y2="${-p1[1]}"/></g>`;
      }
    }
    for (const a of m.artworks.filter((a) => a.host === w.id)) {
      if (hidden(a.id)) continue;
      const room = m.rooms.find((r) => r.walls.includes(w.id));
      let nn = [-d[1], d[0]]; const mid2 = pt(a.at);
      if (room) { const c = centroid2(room.poly); if ((c[0] - mid2[0]) * nn[0] + (c[1] - mid2[1]) * nn[1] < 0) nn = [-nn[0], -nn[1]]; }
      const p0 = pt(a.at - a.w / 2), p1 = pt(a.at + a.w / 2), o = 0.22;
      svg += `<line class="${cls(a.id, 'pl-art')}" data-id="${a.id}" x1="${p0[0] + nn[0] * o}" y1="${-(p0[1] + nn[1] * o)}" x2="${p1[0] + nn[0] * o}" y2="${-(p1[1] + nn[1] * o)}"/>`;
      centroids[a.id] = [mid2[0] + nn[0] * o, -(mid2[1] + nn[1] * o)];
    }
  }
  for (const o of [...m.objects, ...m.imports]) {
    if (hidden(o.id)) continue;
    const q = footprint(o).map(([x, y]) => [x, -y]);
    svg += `<polygon class="${cls(o.id, m.imports.includes(o) ? 'pl-obj pl-import' : 'pl-obj')}" data-id="${o.id}" points="${q.map((p) => p.join(',')).join(' ')}"/>`;
    centroids[o.id] = [o.x, -o.y];
  }
  svg += labels;
  return { svg, centroids };
}

export function polyArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }

// ---------- unroll / face (a wall or a room's walls laid flat on vellum) ----------
export function renderUnroll(m, wallIds, opts) {
  let u = 0, svg = '', centroids = {}; const gap = 0.6;
  for (const id of wallIds) {
    const w = wallById(m, id); if (!w) continue;
    const L = wallLen(w);
    const sel = (x) => (opts.sel && opts.sel.has(x) ? ' is-sel' : '') + (opts.hover === x ? ' is-hover' : '') + (opts.marked && opts.marked.has(x) ? ' is-mark' : '');
    const B = w.base, T = w.top - B;
    svg += `<rect class="un-wall${sel(w.id)}" data-id="${w.id}" x="${u}" y="${-T}" width="${L}" height="${T}"/>`;
    let grid = '';
    for (let x = 1; x < L; x++) grid += `<line x1="${u + x}" y1="${-T}" x2="${u + x}" y2="0"/>`;
    for (let z = 1; z < T; z++) grid += `<line x1="${u}" y1="${-z}" x2="${u + L}" y2="${-z}"/>`;
    svg += `<g class="un-grid">${grid}</g>`;
    for (const o of m.openings.filter((o) => o.host === id)) {
      const pts = openingOutline({ a: [0, 0], b: [L, 0] }, o).map((p) => `${u + p[0]},${-(p[2] - B)}`).join(' ');
      svg += `<polygon class="un-open${sel(o.id)}" data-id="${o.id}" points="${pts}"/>`;
      centroids[o.id] = [u + o.at, -(o.sill - B + o.h / 2)];
    }
    for (const a of m.artworks.filter((a) => a.host === id)) {
      svg += `<rect class="un-art${sel(a.id)}" data-id="${a.id}" x="${u + a.at - a.w / 2}" y="${-(a.c - B + a.h / 2)}" width="${a.w}" height="${a.h}"/>`;
      centroids[a.id] = [u + a.at, -(a.c - B)];
    }
    svg += `<text class="un-label" x="${u + L / 2}" y="0.7">${w.name} · ${L.toFixed(2)} m</text>`;
    centroids[w.id] = [u + L / 2, -T / 2];
    u += L + gap;
  }
  svg = `<line class="un-datum" x1="-0.5" y1="0" x2="${u}" y2="0"/>` + svg;
  return { svg, centroids, width: u };
}

// ---------- extents / view boxes ----------
export const WORLD_BOX = [-1.5, -2, 19.5, 9.5, 0, 6.6];
/** Axis box around everything authored, padded: [x0, y0, x1, y1, z0, z1]. */
export function modelBox(m) {
  const xs = [], ys = [], zs = [0];
  for (const w of m.walls) { xs.push(w.a[0], w.b[0]); ys.push(w.a[1], w.b[1]); zs.push(w.top); }
  for (const r of m.roofs) { if (r.poly) r.poly.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }); else { xs.push(r.x0, r.x1); ys.push(r.y0, r.y1); zs.push(roofTop(r)); } }
  for (const o of [...m.objects, ...m.imports]) { xs.push(o.x); ys.push(o.y); }
  if (!xs.length) return WORLD_BOX;
  return [Math.min(...xs) - 1.5, Math.min(...ys) - 2, Math.max(...xs) + 1.5, Math.max(...ys) + 1.5, 0, Math.max(...zs)];
}
export function boundsOf(cam, box = WORLD_BOX) {
  const [x0, y0, x1, y1, z0, z1] = box; let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) { const [u, v] = cam.P([x, y, z]); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return [u0, v0, u1 - u0, v1 - v0];
}

export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Which side of the slice line (a→b, plan coords) a world point lies on. */
export function sliceSide(sl, p) { return Math.sign((sl.b[0] - sl.a[0]) * (p[1] - sl.a[1]) - (sl.b[1] - sl.a[1]) * (p[0] - sl.a[0])); }

export function entityPlanCentre(m, e) {
  if (!e) return [0, 0];
  if (e.kind === 'wall') return [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
  if (e.kind === 'opening' || e.kind === 'artwork') { const w = wallById(m, e.host); return w ? wallPoint(w, e.at) : [0, 0]; }
  if (e.kind === 'roof') return e.poly ? centroid2(e.poly) : [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2];
  if (e.kind === 'room') return centroid2(e.poly);
  return [e.x, e.y];
}
