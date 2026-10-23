// Dense mock project for stress-testing the shell wireframe: several structures, levels, 40 rooms, shared walls, hundreds of objects.
// Mock data only — not a format.

// mulberry32: small seeded PRNG so every call yields identical data.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const X = [0, 9, 18, 27, 36];
const Y = [0, 6, 12, 18];
const LEVELS = [
  { id: 'lv-0', name: 'Ground floor', z: 0, short: 'G', rooms: ['Entrance hall', 'Shop', 'Café', 'Cloakroom', 'Gallery 1', 'Gallery 2', 'Gallery 3', 'Education room', 'Gallery 4', 'Gallery 5', 'Gallery 6', 'Stair hall'] },
  { id: 'lv-1', name: 'First floor', z: 4.5, short: '1', rooms: ['Gallery 7', 'Gallery 8', 'Gallery 9', 'Gallery 10', 'Print room', 'Gallery 11', 'Gallery 12', 'Library', 'Gallery 13', 'Gallery 14', 'Gallery 15', 'Stair hall 1'] },
  { id: 'lv-2', name: 'Second floor', z: 9, short: '2', rooms: ['Gallery 16', 'Gallery 17', 'Gallery 18', 'Gallery 19', 'Studio north', 'Studio south', 'Archive', 'Gallery 20', 'Gallery 21', 'Conservation', 'Office', 'Stair hall 2'] },
];
const KINDS = {
  bench: { fit: 'extend', w: 1.8, d: 0.5, h: 0.45, name: 'Bench' },
  plinth: { fit: 'stretch', w: 0.6, d: 0.6, h: 1.0, name: 'Plinth' },
  sculpture: { fit: 'proportional', w: 0.6, d: 0.6, h: 1.4 },
  vitrine: { fit: 'stretch', w: 1.2, d: 0.6, h: 1.1, name: 'Vitrine' },
  table: { fit: 'extend', w: 1.2, d: 0.8, h: 0.75, name: 'Table' },
};
const GALLERY_KINDS = ['bench', 'plinth', 'sculpture', 'vitrine'];
const WORKSHOP_KINDS = ['table', 'plinth', 'vitrine'];
const SCULPTURES = ['Torso', 'Head of a girl', 'Seated figure', 'Horse', 'Bather', 'Dancer'];
const TITLES = [
  'Harbour at Dusk', 'Still Life with Pears', 'The Reading Girl', 'Winter Light', 'Orchard in May',
  'Portrait of a Clerk', 'River Bend', 'The Ferry', 'Interior in Blue', 'Market Morning',
  'Two Sisters', 'Storm over the Lake', 'Study in Ochre', 'The Musicians', 'Fishing Boats',
  'Quiet Street', 'Harvest Table', 'Woman with a Fan', 'Hills after Rain', 'Lemons on a Cloth',
  'The Night Garden', 'Morning Mist', 'Girl by the Window', 'Barges at Low Tide', 'The Chess Players',
  'Autumn Fields', 'Vase of Irises', 'Old Mill Road', 'Sleeping Dog', 'Carnival Evening',
];
const LETTERS = 'abcdefghij';

export function denseModel() {
  const rnd = mulberry32(20261023);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const out = {
    structures: [
      { id: 'st-main', name: 'Main hall' },
      { id: 'st-pav', name: 'Garden pavilion' },
      { id: 'st-ws', name: 'Workshop' },
    ],
    levels: [
      ...LEVELS.map((l) => ({ id: l.id, name: l.name, structure: 'st-main', z: l.z })),
      { id: 'lv-pav', name: 'Pavilion floor', structure: 'st-pav', z: 0 },
      { id: 'lv-ws', name: 'Workshop floor', structure: 'st-ws', z: 0 },
    ],
    pins: [{ id: 'pin-1', z: 1.2, label: 'Plinth tops' }],
    walls: [], rooms: [], openings: [], roofs: [], objects: [], artworks: [],
    imports: [], finishes: {}, views: [], presentations: [], guides: [],
  };
  const wallById = new Map();
  const exterior = new Set();
  const len = (w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const addWall = (w, ext) => {
    out.walls.push(w);
    wallById.set(w.id, w);
    if (ext) exterior.add(w.id);
  };
  // rel is the sill relative to the wall base; stored as absolute height.
  const addOpening = (host, name, w, h, rel) => {
    const wl = wallById.get(host);
    out.openings.push({ id: `op-${host}`, name, host, at: len(wl) / 2, w, h, sill: wl.base + rel, arch: false });
  };
  const titleUse = new Map();
  let artN = 0;
  const addArt = (host, at, w, h, c) => {
    if (out.openings.some((o) => o.host === host && Math.abs(at - o.at) < (w + o.w) / 2 + 0.1)) return;
    const t = TITLES[artN++ % TITLES.length];
    const n = (titleUse.get(t) || 0) + 1;
    titleUse.set(t, n);
    out.artworks.push({ id: `a-${out.artworks.length + 1}`, name: n > 1 ? `${t} ${n}` : t, host, at, w, h, c });
  };
  let objN = 0;
  const furnish = ({ label, level, z, box: [x0, x1, y0, y1], n, kinds, gallery }) => {
    for (let idx = 0; idx < n; idx++) {
      let kind = pick(kinds);
      if (kind === 'sculpture' && !gallery) kind = 'table';
      const x = between(x0, x1);
      const y = between(y0, y1);
      const rot = pick([0, 90]);
      const k = KINDS[kind];
      const base = kind === 'sculpture' ? pick(SCULPTURES) : k.name;
      out.objects.push({ id: `b-${++objN}`, name: `${base} · ${label} ${LETTERS[idx]}`, kind, fit: k.fit, x, y, w: k.w, d: k.d, h: k.h, rot, z, level });
    }
  };
  const plain = (id, name, a, b, level, structure, top, ext = true) =>
    addWall({ id, name, a, b, base: 0, top, level, structure }, ext);

  // Main hall: three levels on a 36 x 18 grid.
  LEVELS.forEach((lv, li) => {
    const num = (i, j) => `${li}.${String(j * 4 + i + 1).padStart(2, '0')}`;
    const hid = (j, i) => `w-${li}-h-${j}-${i}`;
    const vid = (i, j) => `w-${li}-v-${i}-${j}`;
    const made = [];
    const mk = (id, name, a, b, ext) => {
      const w = { id, name, a, b, base: lv.z, top: lv.z + 4.5, level: lv.id, structure: 'st-main' };
      addWall(w, ext);
      made.push(w);
    };
    for (let j = 0; j <= 3; j++) {
      for (let i = 0; i <= 3; i++) {
        const ext = j === 0 || j === 3;
        const name = ext ? `${lv.short} ${j === 0 ? 'south' : 'north'} wall ${i + 1}` : `${lv.short} wall ${num(i, j - 1)}–${num(i, j)}`;
        mk(hid(j, i), name, [X[i], Y[j]], [X[i + 1], Y[j]], ext);
      }
    }
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 2; j++) {
        const ext = i === 0 || i === 4;
        const name = ext ? `${lv.short} ${i === 0 ? 'west' : 'east'} wall ${j + 1}` : `${lv.short} wall ${num(i - 1, j)}–${num(i, j)}`;
        mk(vid(i, j), name, [X[i], Y[j]], [X[i], Y[j + 1]], ext);
      }
    }
    made.forEach((w) => {
      if (!exterior.has(w.id)) addOpening(w.id, `Door · ${w.name}`, 1.6, 2.6, 0);
      else if (li === 0 && w.id === hid(0, 0)) addOpening(w.id, 'Main entrance', 2.4, 3.0, 0);
      else addOpening(w.id, `Window · ${w.name}`, 2.0, 1.6, 1.0);
    });
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 4; i++) {
        const k = j * 4 + i;
        const name = lv.rooms[k];
        const gallery = name.startsWith('Gallery');
        out.rooms.push({
          id: `room-${li}-${k + 1}`, name,
          walls: [hid(j, i), hid(j + 1, i), vid(i, j), vid(i + 1, j)],
          poly: [[X[i], Y[j]], [X[i + 1], Y[j]], [X[i + 1], Y[j + 1]], [X[i], Y[j + 1]]],
          z: lv.z, level: lv.id, structure: 'st-main', kind: 'room',
        });
        if (gallery) {
          [1.6, 6.4, 7.8].forEach((at) => addArt(hid(j + 1, i), at, 1.2, 0.9, lv.z + 1.6));
          [1.0, 5.0].forEach((at) => addArt(vid(i + 1, j), at, 1.0, 1.2, lv.z + 1.6));
        }
        furnish({ label: num(i, j), level: lv.id, z: lv.z, box: [X[i] + 1, X[i + 1] - 1, Y[j] + 1, Y[j + 1] - 1], n: 7, kinds: GALLERY_KINDS, gallery });
      }
    }
  });
  out.roofs.push({
    id: 'r-main', name: 'Main hall roof', x0: -0.3, x1: 36.3, y0: -0.3, y1: 18.3,
    prof: [[0, 13.5], [18.6, 13.5]],
    over: out.walls.filter((w) => w.level === 'lv-2' && exterior.has(w.id)).map((w) => w.id),
    structure: 'st-main',
  });

  // Garden pavilion: one level, two rooms split by a shared divider.
  plain('w-pav-s-1', 'Pavilion south wall 1', [42, 0], [48, 0], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-s-2', 'Pavilion south wall 2', [48, 0], [54, 0], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-n-1', 'Pavilion north wall 1', [42, 8], [48, 8], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-n-2', 'Pavilion north wall 2', [48, 8], [54, 8], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-w', 'Pavilion west wall', [42, 0], [42, 8], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-e', 'Pavilion east wall', [54, 0], [54, 8], 'lv-pav', 'st-pav', 4.0);
  plain('w-pav-div', 'Pavilion divider', [48, 0], [48, 8], 'lv-pav', 'st-pav', 4.0, false);
  out.rooms.push(
    { id: 'room-pav-w', name: 'Pavilion west', walls: ['w-pav-s-1', 'w-pav-n-1', 'w-pav-w', 'w-pav-div'], poly: [[42, 0], [48, 0], [48, 8], [42, 8]], z: 0, level: 'lv-pav', structure: 'st-pav', kind: 'room' },
    { id: 'room-pav-e', name: 'Pavilion east', walls: ['w-pav-s-2', 'w-pav-n-2', 'w-pav-div', 'w-pav-e'], poly: [[48, 0], [54, 0], [54, 8], [48, 8]], z: 0, level: 'lv-pav', structure: 'st-pav', kind: 'room' },
  );
  addOpening('w-pav-div', 'Pavilion divider door', 1.6, 2.4, 0);
  addOpening('w-pav-s-1', 'Pavilion west door', 1.8, 2.6, 0);
  furnish({ label: 'Pavilion west', level: 'lv-pav', z: 0, box: [43, 47, 1, 7], n: 6, kinds: GALLERY_KINDS, gallery: true });
  furnish({ label: 'Pavilion east', level: 'lv-pav', z: 0, box: [49, 53, 1, 7], n: 6, kinds: GALLERY_KINDS, gallery: true });
  out.objects.push({ id: 'b-column', name: 'Doric column', kind: 'column', fit: 'stretch', x: 45, y: 6.5, w: 0.6, d: 0.6, h: 3.2, rot: 0, z: 0, level: 'lv-pav' });
  out.roofs.push({
    id: 'r-pav', name: 'Pavilion roof', x0: 41.7, x1: 54.3, y0: -0.3, y1: 8.3,
    prof: [[0, 4.0], [4.3, 6.6], [8.6, 4.0]],
    over: ['w-pav-s-1', 'w-pav-s-2', 'w-pav-n-1', 'w-pav-n-2'],
    structure: 'st-pav',
  });

  // Workshop: one room, a raised platform (not a level), and a sawtooth roof.
  plain('w-ws-s', 'Workshop south wall', [42, 12], [54, 12], 'lv-ws', 'st-ws', 4.0);
  plain('w-ws-n', 'Workshop north wall', [42, 36], [54, 36], 'lv-ws', 'st-ws', 4.0);
  plain('w-ws-w', 'Workshop west wall', [42, 12], [42, 36], 'lv-ws', 'st-ws', 4.0);
  plain('w-ws-e', 'Workshop east wall', [54, 12], [54, 36], 'lv-ws', 'st-ws', 4.0);
  out.rooms.push(
    { id: 'room-ws', name: 'Workshop', walls: ['w-ws-s', 'w-ws-n', 'w-ws-w', 'w-ws-e'], poly: [[42, 12], [54, 12], [54, 36], [42, 36]], z: 0, level: 'lv-ws', structure: 'st-ws', kind: 'room' },
    { id: 'room-ws-plat', name: 'Work platform', kind: 'platform', walls: [], poly: [[43, 14], [47, 14], [47, 34], [43, 34]], z: 2.4, level: 'lv-ws', structure: 'st-ws' },
  );
  addOpening('w-ws-s', 'Workshop door', 3.0, 3.2, 0);
  furnish({ label: 'Workshop', level: 'lv-ws', z: 0, box: [48, 53, 13, 35], n: 10, kinds: WORKSHOP_KINDS, gallery: false });
  out.roofs.push({
    id: 'r-ws', name: 'Workshop sawtooth roof', x0: 41.7, x1: 54.3, y0: 12, y1: 36,
    prof: [[0, 4.0], [5.8, 6.2], [6, 4.0], [11.8, 6.2], [12, 4.0], [17.8, 6.2], [18, 4.0], [23.8, 6.2], [24, 4.0]],
    over: ['w-ws-s', 'w-ws-n', 'w-ws-w', 'w-ws-e'],
    structure: 'st-ws',
  });

  // Experience: views, presentations and one guided tour.
  const sculpt = out.objects.find((o) => o.kind === 'sculpture');
  out.views = [
    { id: 'v-entry', name: 'Entrance', pos: [4.5, -4, 1.6], target: [4.5, 6, 1.5], lens: 26 },
    { id: 'v-g1', name: 'Gallery 1', pos: [1.5, 7.5, 1.6], target: [8, 11, 1.5], lens: 24 },
    { id: 'v-pav', name: 'Pavilion', pos: [48, -5, 1.6], target: [48, 4, 1.8], lens: 26 },
  ];
  out.presentations = [
    { id: 'p-entry', name: 'Arrival', views: ['v-entry'], def: 'v-entry', subject: null },
    { id: 'p-sculpt', name: sculpt.name, views: ['v-g1'], def: 'v-g1', subject: sculpt.id },
    { id: 'p-pav', name: 'The pavilion', views: ['v-pav'], def: 'v-pav', subject: 'room-pav-w' },
  ];
  out.guides = [{
    id: 'g-tour', name: 'Highlights',
    stops: [
      { id: 's1', pres: 'p-entry', views: ['v-entry'], hold: 4 },
      { id: 's2', pres: 'p-sculpt', views: ['v-g1'], hold: 5 },
      { id: 's3', pres: 'p-pav', views: ['v-pav'], hold: 5 },
    ],
    edges: [{ mode: 'travel', dur: 5 }, { mode: 'cut', dur: 0 }],
  }];
  return out;
}
