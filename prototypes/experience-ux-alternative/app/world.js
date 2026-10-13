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
