// Mock museum — the "Salon Chopin" wing. World coordinates in metres:
// x → east, z → south (plan down), y ↑. Plan and 3D are drawn from this one source.

export const WALL_H = 4.2;
export const WALL_T = 0.24;

const C = { x: 7, z: 10 };           // Rotunda centre
const R = 5.4;                       // octagon circumradius
const oct = Array.from({ length: 8 }, (_, k) => {
  const a = (Math.PI / 8) + k * (Math.PI / 4);
  return [C.x + R * Math.cos(a), C.z + R * Math.sin(a)];
});

// Octagon sides; east (k=7→0) and west (k=3→4) sides carry openings.
function octWalls() {
  const segs = [];
  for (let k = 0; k < 8; k++) {
    const a = oct[k], b = oct[(k + 1) % 8];
    const isEast = k === 7, isWest = k === 3;
    if (isEast || isWest) {
      const x = a[0];
      const zLo = Math.min(a[1], b[1]), zHi = Math.max(a[1], b[1]);
      segs.push([x, zLo, x, 8.6], [x, 11.4, x, zHi]);
    } else segs.push([a[0], a[1], b[0], b[1]]);
  }
  return segs;
}
const ex = oct[0][0]; // east face x

export const walls = [
  ...octWalls(),
  // corridor rotunda → salon
  [ex, 8.6, 14, 8.6], [ex, 11.4, 14, 11.4],
  // salon 14..26 × 2..18
  [14, 2, 26, 2], [14, 18, 26, 18],
  [14, 2, 14, 8.6], [14, 11.4, 14, 18],
  [26, 2, 26, 8.6], [26, 11.4, 26, 18],
  // gallery 26..38 × 5..15
  [26, 5, 38, 5], [26, 15, 38, 15], [38, 5, 38, 15],
];

export const rooms = [
  { id: 'rotunda', name: 'Rotunda', poly: oct, floor: '#d9d4c8', label: [7, 13.4] },
  { id: 'corridor', name: '', poly: [[ex, 8.6], [14, 8.6], [14, 11.4], [ex, 11.4]], floor: '#d9d4c8' },
  { id: 'salon', name: 'Chopin Salon', poly: [[14, 2], [26, 2], [26, 18], [14, 18]], floor: '#9a7652', label: [20, 17.1] },
  { id: 'gallery', name: 'Portrait Gallery', poly: [[26, 5], [38, 5], [38, 15], [26, 15]], floor: '#cfcabd', label: [32, 14.3] },
];

// Scene objects (what can be "presented").
export const objects = [
  { id: 'muse', name: 'The Muse', kind: 'statue', x: 7, z: 10, w: 1.1, d: 1.1, h: 2.3, yaw: 0 },
  { id: 'piano', name: 'Pleyel grand piano', kind: 'piano', x: 19.6, z: 10.5, w: 2.3, d: 1.5, h: 1.0, yaw: 0 },
  { id: 'portrait', name: 'Portrait of Chopin', kind: 'painting', x: 20, z: 2.14, w: 1.6, d: 0.08, h: 2.0, yaw: Math.PI / 2, art: 'portrait', y: 2.1 },
  { id: 'vitrineA', name: 'Nocturne manuscript', kind: 'vitrine', x: 16.6, z: 15.6, w: 1.2, d: 0.8, h: 1.2, yaw: 0 },
  { id: 'vitrineB', name: 'Letters to George Sand', kind: 'vitrine', x: 23.4, z: 15.6, w: 1.2, d: 0.8, h: 1.2, yaw: 0 },
  { id: 'bench', name: 'Salon bench', kind: 'bench', x: 17.4, z: 5.4, w: 1.8, d: 0.5, h: 0.45, yaw: 0 },
  { id: 'sand', name: 'George Sand, 1838', kind: 'painting', x: 29, z: 5.14, w: 1.3, d: 0.08, h: 1.7, yaw: Math.PI / 2, art: 'sand', y: 1.9 },
  { id: 'valldemossa', name: 'Valldemossa', kind: 'painting', x: 32.2, z: 5.14, w: 1.9, d: 0.08, h: 1.3, yaw: Math.PI / 2, art: 'landscape', y: 1.8 },
  { id: 'nohant', name: 'Garden at Nohant', kind: 'painting', x: 35.4, z: 5.14, w: 1.5, d: 0.08, h: 1.2, yaw: Math.PI / 2, art: 'garden', y: 1.8 },
  { id: 'hand', name: 'Cast of the hand', kind: 'plinth', x: 32, z: 11.4, w: 0.7, d: 0.7, h: 1.05, yaw: 0 },
];

export const objectById = Object.fromEntries(objects.map((o) => [o.id, o]));
export const roomById = Object.fromEntries(rooms.filter((r) => r.name).map((r) => [r.id, r]));
export const roomOf = (o) => (o.x < 12 ? 'rotunda' : o.x < 26 ? 'salon' : 'gallery');
export const WING = 'Salon Chopin wing · Level 0';

// Named bounds and openings for the World Context Index (representative, read-only here).
export const bounds = [
  { id: 'w_oct', kind: 'wall', room: 'rotunda', name: 'Octagon wall', segs: octWalls() },
  { id: 'o_rot_w', kind: 'opening', room: 'rotunda', name: 'West arch', segs: [[oct[3][0], 8.6, oct[3][0], 11.4]], width: 2.8 },
  { id: 'o_rot_e', kind: 'opening', room: 'rotunda', name: 'Passage to the salon', segs: [[ex, 8.6, ex, 11.4]], width: 2.8 },
  { id: 'w_sal_n', kind: 'wall', room: 'salon', name: 'North wall', segs: [[14, 2, 26, 2]] },
  { id: 'w_sal_s', kind: 'wall', room: 'salon', name: 'South wall', segs: [[14, 18, 26, 18]] },
  { id: 'w_sal_w', kind: 'wall', room: 'salon', name: 'Rotunda side', segs: [[14, 2, 14, 8.6], [14, 11.4, 14, 18]] },
  { id: 'w_sal_e', kind: 'wall', room: 'salon', name: 'Gallery side', segs: [[26, 2, 26, 8.6], [26, 11.4, 26, 18]], shared: 'gallery' },
  { id: 'o_sal_w', kind: 'opening', room: 'salon', name: 'Passage from the Rotunda', segs: [[14, 8.6, 14, 11.4]], width: 2.8 },
  { id: 'o_sal_e', kind: 'opening', room: 'salon', name: 'Gallery doorway', segs: [[26, 8.6, 26, 11.4]], width: 2.8, shared: 'gallery' },
  { id: 'w_gal_n', kind: 'wall', room: 'gallery', name: 'Picture wall', segs: [[26, 5, 38, 5]] },
  { id: 'w_gal_s', kind: 'wall', room: 'gallery', name: 'South wall', segs: [[26, 15, 38, 15]] },
  { id: 'w_gal_e', kind: 'wall', room: 'gallery', name: 'End wall', segs: [[38, 5, 38, 15]] },
];
export const boundById = Object.fromEntries(bounds.map((b) => [b.id, b]));
export const boundsOf = (roomId) => bounds.filter((b) => b.room === roomId || b.shared === roomId);

// ——— helpers ———
export function aim(pos, target) {
  const dx = target[0] - pos[0], dy = target[1] - pos[1], dz = target[2] - pos[2];
  const yaw = Math.atan2(dz, dx);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { pos, yaw, pitch };
}

export const LENSES = { wide: { label: 'Wide', fov: 72 }, normal: { label: 'Normal', fov: 52 }, close: { label: 'Close', fov: 32 } };
export const HEIGHTS = { seated: { label: 'Seated', y: 1.15 }, standing: { label: 'Standing', y: 1.6 }, raised: { label: 'Raised', y: 2.5 } };

export function heightKey(y) {
  let best = 'standing', d = 9;
  for (const [k, v] of Object.entries(HEIGHTS)) { const e = Math.abs(v.y - y); if (e < d) { d = e; best = k; } }
  return best;
}

function view(id, presId, name, pos, target, lens = 'normal') {
  const a = aim(pos, target);
  return { id, presId, name, pos: [...a.pos], yaw: a.yaw, pitch: a.pitch, lens };
}

// ——— authored Experience seed (mock) ———
export function seedPopulated() {
  const views = [
    view('v_arrival', 'p_rotunda', 'Arrival', [2.4, 1.6, 10], [12, 1.7, 10], 'wide'),
    view('v_muse', 'p_rotunda', 'The Muse, close', [9.4, 1.4, 11.8], [7, 1.5, 10], 'close'),
    view('v_toward', 'p_rotunda', 'Toward the salon', [9.4, 1.6, 10], [19, 1.4, 10.4], 'normal'),
    view('v_piano_over', 'p_piano', 'Piano overview', [15.8, 2.4, 14.2], [19.6, 0.9, 10.5], 'normal'),
    view('v_lid', 'p_piano', 'Under the lid', [21.9, 2.15, 8.7], [19.9, 1.0, 10.3], 'normal'),
    view('v_keys', 'p_piano', 'Keyboard detail', [17.3, 1.45, 11.7], [18.5, 0.85, 10.6], 'close'),
    view('v_seat', 'p_piano', "Pianist's seat", [17.2, 1.2, 10.5], [21.5, 1.1, 10.4], 'normal'),
    view('v_nocturne', 'p_manuscripts', 'Nocturne draft', [16.6, 1.55, 13.9], [16.6, 0.95, 15.6], 'close'),
    view('v_letters', 'p_manuscripts', 'Letters to Sand', [23.4, 1.55, 13.9], [23.4, 0.95, 15.6], 'close'),
    view('v_portrait', 'p_portrait', 'Portrait, face to face', [20, 1.6, 5.6], [20, 2.0, 2.1], 'normal'),
    view('v_longwall', 'p_gallery', 'The long wall', [32.2, 1.6, 13.6], [32.2, 1.8, 5], 'wide'),
    view('v_sand', 'p_gallery', 'George Sand', [29, 1.6, 7.8], [29, 1.85, 5], 'normal'),
    view('v_hand', 'p_gallery', 'The hand', [33.3, 1.3, 12.9], [32, 1.05, 11.4], 'close'),
  ];
  const presentations = [
    { id: 'p_rotunda', name: 'Rotunda welcome', subject: null, viewIds: ['v_arrival', 'v_muse', 'v_toward'], defaultViewId: 'v_arrival', explore: true },
    { id: 'p_piano', name: 'The Pleyel piano', subject: 'piano', viewIds: ['v_piano_over', 'v_lid', 'v_keys', 'v_seat'], defaultViewId: 'v_piano_over', explore: true },
    { id: 'p_manuscripts', name: 'Manuscripts', subject: 'vitrineA', viewIds: ['v_nocturne', 'v_letters'], defaultViewId: 'v_nocturne', explore: true },
    { id: 'p_portrait', name: 'Portrait of Chopin', subject: 'portrait', viewIds: ['v_portrait'], defaultViewId: 'v_portrait', explore: true },
    { id: 'p_gallery', name: 'Portrait gallery', subject: null, viewIds: ['v_longwall', 'v_sand', 'v_hand'], defaultViewId: 'v_longwall', explore: true },
  ];
  const stops = [
    { id: 's1', presId: 'p_rotunda', seq: [{ viewId: 'v_arrival', hold: 4 }, { viewId: 'v_toward', hold: 3 }], out: { mode: 'travel', duration: 7 } },
    { id: 's2', presId: 'p_piano', seq: [{ viewId: 'v_piano_over', hold: 4 }, { viewId: 'v_lid', hold: 3 }, { viewId: 'v_keys', hold: 3 }], out: { mode: 'cut', duration: 6 } },
    { id: 's3', presId: 'p_manuscripts', seq: [{ viewId: 'v_nocturne', hold: 5 }], out: { mode: 'travel', duration: 8 } },
    { id: 's4', presId: 'p_gallery', seq: [{ viewId: 'v_longwall', hold: 4 }, { viewId: 'v_hand', hold: 3 }], out: { mode: 'travel', duration: 8 } },
    { id: 's5', presId: 'p_piano', seq: [{ viewId: 'v_seat', hold: 6 }], out: { mode: 'cut', duration: 6 } },
  ];
  // Camera paths are owned by the Camera, keyed by the pair of Views they join.
  const paths = {
    'v_toward>v_piano_over': { points: [[12.6, 10.1], [14.4, 10.6], [15.4, 12.6]] },
    'v_nocturne>v_longwall': { points: [[18.6, 12.8], [24.2, 10.4], [27.6, 10.2], [31, 12.4]] },
    'v_hand>v_seat': { points: [[28.4, 10.4], [24.6, 10.0], [21.6, 12.7], [18.4, 12.3]] },
  };
  return { views: Object.fromEntries(views.map((v) => [v.id, v])), presentations, guide: { name: 'Salon tour', stops }, paths };
}

export function seedEmpty() {
  return { views: {}, presentations: [], guide: { name: 'Guide', stops: [] }, paths: {} };
}

// Segment-vs-wall test, used to warn when a Travel passes through architecture.
export function crossesWall(a, b) {
  for (const w of walls) if (segInt(a[0], a[1], b[0], b[1], w[0], w[1], w[2], w[3])) return true;
  return false;
}
function segInt(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 0.001 && t < 0.999 && u > 0 && u < 1;
}

// ——— stress scenarios (prototype review only) ———
// Deterministic generators that add many Views, Stops or Presentations to the Salon seed,
// so the Index, Cards and Guide can be judged at 15–30 Stops, 20–50 Views and ~40 Presentations.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const ROOM_BOX = { rotunda: [3.2, 6.4, 10.8, 13.6], salon: [14.8, 2.8, 25.2, 17.2], gallery: [26.8, 5.8, 37.2, 14.2] };
const ANGLES = ['Low angle', 'From the door', 'Over the shoulder', 'Side light', 'Close detail', 'Wide context', 'Corner', 'Eye to eye', 'Raking light', 'Reflection', 'Profile', 'From behind', 'Through the arch', 'High corner', 'Seated view', 'Hands', 'Texture', 'Silhouette'];
function aroundObject(r, o, i) {
  const box = ROOM_BOX[roomOf(o)];
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2, d = 1.8 + r() * 3.4;
    let x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    if (o.kind === 'painting') { x = o.x + (r() - 0.5) * 4; z = o.z + 1.6 + r() * 4.5; }
    if (x > box[0] && x < box[2] && z > box[1] && z < box[3]) {
      const y = [1.15, 1.6, 1.6, 2.5][Math.floor(r() * 4)];
      const ty = o.kind === 'painting' ? o.y : Math.min(1.2, o.h * 0.6);
      return { pos: [x, y, z], target: [o.x, ty, o.z], lens: ['wide', 'normal', 'normal', 'close'][(i + Math.floor(r() * 4)) % 4] };
    }
  }
  return { pos: [o.x + 2, 1.6, o.z + 2], target: [o.x, 1, o.z], lens: 'normal' };
}
export function seedStress(kind) {
  const d = seedPopulated(); const r = rng(kind.length * 7919 + 17);
  const addViews = (pres, o, n, prefix = '') => {
    for (let i = 0; i < n; i++) {
      const p = aroundObject(r, o, i); const id = `${pres.id}_g${i}`;
      d.views[id] = view(id, pres.id, `${prefix}${ANGLES[i % ANGLES.length]}${i >= ANGLES.length ? ' ' + (Math.floor(i / ANGLES.length) + 1) : ''}`, p.pos, p.target, p.lens);
      pres.viewIds.push(id);
    }
  };
  if (kind === 'views20' || kind === 'views50') {
    const pres = d.presentations.find((p) => p.id === 'p_piano');
    addViews(pres, objectById.piano, kind === 'views20' ? 16 : 46);
    d.guide.stops[1].seq.push({ viewId: pres.viewIds[6], hold: 3 }, { viewId: pres.viewIds[9], hold: 3 });
  }
  if (kind === 'stops15' || kind === 'stops30' || kind === 'pres40') {
    // More Presentations, one per remaining object, each with a few Views.
    for (const o of objects) {
      if (d.presentations.some((p) => p.subject === o.id) || o.id === 'muse') continue;
      const pres = { id: `p_${o.id}`, name: o.name, subject: o.id, viewIds: [], defaultViewId: null, explore: true };
      d.presentations.push(pres); addViews(pres, o, 2 + Math.floor(r() * 3)); pres.defaultViewId = pres.viewIds[0];
    }
  }
  if (kind === 'pres40') {
    const themes = ['Morning light', 'Evening light', 'Restoration', 'Provenance', 'For children', 'Accessible route', 'Music room', 'Letters', 'Sketches', 'The 1838 winter', 'Hidden details', 'Materials', 'Craft', 'Sound', 'Composer’s hands', 'Pupils', 'Salons of Paris', 'Mallorca', 'Nohant summers', 'Last concerts', 'Portrait studies', 'Frames', 'Floor and ceiling', 'Doorways', 'Benches', 'The long view', 'Light study', 'Scale', 'Close looking', 'Curator’s pick', 'Before and after'];
    let k = 0;
    while (d.presentations.length < 40) {
      const o = objects[k % objects.length]; const id = `p_t${k}`;
      const pres = { id, name: themes[k % themes.length], subject: k % 3 ? o.id : null, viewIds: [], defaultViewId: null, explore: k % 5 !== 3 };
      d.presentations.push(pres); addViews(pres, o, 1 + Math.floor(r() * 4)); pres.defaultViewId = pres.viewIds[0]; k++;
    }
  }
  if (kind === 'stops15' || kind === 'stops30') {
    const n = kind === 'stops15' ? 15 : 30; const pres = d.presentations;
    const base = d.guide.stops.slice(0, 4); d.guide.stops = [...base];
    let i = 0;
    while (d.guide.stops.length < n) {
      const p = pres[(i * 3 + 4) % pres.length]; i++;
      const pick = p.viewIds.filter((_, j) => j === 0 || r() > 0.55).slice(0, 3);
      d.guide.stops.push({ id: `s_x${i}`, presId: p.id, seq: pick.map((v) => ({ viewId: v, hold: 3 + Math.floor(r() * 3) })), out: r() > 0.35 ? { mode: 'travel', duration: 5 + Math.floor(r() * 5) } : { mode: 'cut', duration: 6 } });
    }
    // Travels between rooms are routed through the doorways, as a creator would shape them.
    const RI = { rotunda: 0, salon: 1, gallery: 2 }, DOORS = [[[11.6, 10], [14.6, 10]], [[25.4, 10], [26.6, 10]]];
    const ri = (v) => (v.pos[0] < 12.2 ? 0 : v.pos[0] < 26 ? 1 : 2);
    d.guide.stops.forEach((st, k) => {
      const nx = d.guide.stops[k + 1]; if (!nx || st.out.mode !== 'travel') return;
      const a = d.views[st.seq[st.seq.length - 1].viewId], b = d.views[nx.seq[0].viewId], key = `${a.id}>${b.id}`;
      if (d.paths[key]) return;
      const ia = ri(a), ib = ri(b); if (ia === ib) return;
      const pts = []; if (ia < ib) for (let q = ia; q < ib; q++) pts.push(...DOORS[q]); else for (let q = ia - 1; q >= ib; q--) pts.push(...[...DOORS[q]].reverse());
      d.paths[key] = { points: pts.map(([x, z]) => [x, z + (r() - 0.5) * 1.2]) };
    });
    d.guide.name = `Salon tour — long edit`;
  }
  return d;
}
