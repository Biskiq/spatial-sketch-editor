// Saltmarsh Museum: the one architectural model every standpoint reads.
// World axes: x = east, y = up (above the floor datum), z = south (north is -z). Metres.
// Heights in the model are measured from the floor datum; the datum itself sits at
// world elevation FLOOR_Y, which is shown wherever a world value is useful.

export const FLOOR_Y = 0.15;
export const ROT = { cx: 5.5, cz: 0, r: 5.5 };
export const GALLERY_HALF = 3.5;
export const XJ = ROT.cx - Math.sqrt(ROT.r ** 2 - GALLERY_HALF ** 2);
const A_OFF = Math.atan2(GALLERY_HALF, ROT.cx - XJ);
export const A_JN = Math.PI + A_OFF;
export const A_JS = Math.PI - A_OFF;
const R = ROT.r;
const TAU = Math.PI * 2;

export function createMuseum() {
  return {
    name: 'Saltmarsh Museum',
    galleries: [
      { id: 'long', name: 'Long Gallery', ref: 'R-LONG' },
      { id: 'rotunda', name: 'Rotunda', ref: 'R-ROT' },
    ],
    walls: [
      {
        id: 'north', ref: 'W-N', name: 'North wall', gallery: 'long', kind: 'line',
        a: [-15, -GALLERY_HALF], b: [XJ, -GALLERY_HALF], thick: 0.25,
        top: { form: 'constant', h: 4.0 }, openings: [],
      },
      {
        id: 'south', ref: 'W-S', name: 'South wall', gallery: 'long', kind: 'line',
        a: [XJ, GALLERY_HALF], b: [-15, GALLERY_HALF], thick: 0.25,
        top: { form: 'constant', h: 4.2 },
        openings: [
          { id: 'clere', ref: 'O-CL', name: 'Clerestory', kind: 'window', s: 9.0, w: 3.2, sill: 2.9, head: 3.7, profile: 'rect', rise: 0 },
        ],
      },
      {
        id: 'west', ref: 'W-W', name: 'West wall', gallery: 'long', kind: 'line',
        a: [-15, GALLERY_HALF], b: [-15, -GALLERY_HALF], thick: 0.25,
        top: { form: 'constant', h: 4.2 },
        openings: [{ id: 'entrance', ref: 'O-EN', name: 'Entrance', kind: 'door', s: 3.3, w: 1.8, sill: 0, head: 2.8, profile: 'rect', rise: 0 }],
      },
      {
        id: 'rotunda', ref: 'W-ROT', name: 'Rotunda wall', gallery: 'rotunda', kind: 'arc',
        cx: ROT.cx, cz: ROT.cz, r: R, a0: 0, sweep: TAU, closed: true, thick: 0.3,
        top: { form: 'constant', h: 6.0 },
        openings: [
          { id: 'gdoor', ref: 'O-GD', name: 'Gallery door', kind: 'door', s: R * Math.PI, w: 2.0, sill: 0, head: 2.8, profile: 'rect', rise: 0 },
          { id: 'gwin', ref: 'O-GW', name: 'Garden window', kind: 'window', s: R * Math.PI * 0.25, w: 1.6, sill: 0.9, head: 3.4, profile: 'round', rise: 0.8 },
          { id: 'mwin', ref: 'O-MW', name: 'Moon window', kind: 'window', s: R * Math.PI * 1.75, w: 1.2, sill: 3.6, head: 4.8, profile: 'pointed', rise: 0.6 },
        ],
      },
    ],
    ceilings: [
      {
        id: 'longc', ref: 'C-LONG', name: 'Long Gallery ceiling', gallery: 'long', rel: 'closure', form: 'flat',
        plane: { base: 4.2, gx: 0, gz: 0 }, thick: 0.15,
        outline: longGalleryOutline(),
        holes: [{ id: 'slot', name: 'Light slot', intentional: true, pts: rect(-12, -0.45, -3, 0.45) }],
        intended: [],
      },
      {
        id: 'soffit', ref: 'C-ENT', name: 'Entrance soffit', gallery: 'long', rel: 'suspended', form: 'flat',
        plane: { base: 3.2, gx: 0, gz: 0 }, thick: 0.1,
        outline: rect(-14.87, -3.37, -9.5, 3.37),
        holes: [],
        intended: [],
      },
      {
        id: 'rotc', ref: 'C-ROT', name: 'Rotunda ceiling', gallery: 'rotunda', rel: 'closure', form: 'flat',
        plane: { base: 6.0, gx: 0, gz: 0 }, thick: 0.18,
        outline: circlePts(ROT.cx, ROT.cz, R, 96),
        holes: [{ id: 'oculus', name: 'Oculus', intentional: true, pts: circlePts(ROT.cx, ROT.cz, 1.0, 40).reverse() }],
        intended: [],
      },
    ],
    floors: [
      { id: 'longf', outline: longGalleryOutline() },
      { id: 'rotf', outline: circlePts(ROT.cx, ROT.cz, R, 96) },
    ],
    art: [
      { id: 'harbor', name: 'Harbor at Dusk', by: 'Maren Okafor', wall: 'north', s: 7.6, y: 1.6, w: 2.8, h: 1.7, paint: 'harbor' },
      { id: 'pears', name: 'Three Pears', by: 'Ida Voss', wall: 'south', s: 4.4, y: 1.45, w: 1.1, h: 1.3, paint: 'pears' },
      { id: 'kestrel', name: 'Kestrel, Winter', by: 'Tomas Reyes', wall: 'south', s: 14.2, y: 1.5, w: 1.6, h: 2.0, paint: 'kestrel' },
      { id: 'tide1', name: 'Tide Study I', by: 'Ana Lund', wall: 'rotunda', s: R * Math.PI * 0.5 - 1.5, y: 1.5, w: 1.0, h: 1.3, paint: 'tide1' },
      { id: 'tide2', name: 'Tide Study II', by: 'Ana Lund', wall: 'rotunda', s: R * Math.PI * 0.5, y: 1.5, w: 1.0, h: 1.3, paint: 'tide2' },
      { id: 'tide3', name: 'Tide Study III', by: 'Ana Lund', wall: 'rotunda', s: R * Math.PI * 0.5 + 1.5, y: 1.5, w: 1.0, h: 1.3, paint: 'tide3' },
      { id: 'marsh', name: 'Salt Marsh, Morning', by: 'Maren Okafor', wall: 'rotunda', s: R * Math.PI * 1.5, y: 1.9, w: 3.6, h: 2.2, paint: 'marsh' },
    ],
    objects: [
      { id: 'vessel', name: 'Blue Vessel', by: 'Studio Hale', kind: 'sculpture', x: ROT.cx, z: ROT.cz },
      { id: 'bench', name: 'Oak bench', by: '', kind: 'bench', x: -7.5, z: 0.6 },
    ],
  };
}

function rect(x0, z0, x1, z1) {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

export function circlePts(cx, cz, r, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

function longGalleryOutline() {
  const pts = [[-15, -GALLERY_HALF], [XJ, -GALLERY_HALF]];
  const n = 24;
  for (let i = 1; i < n; i++) {
    const a = A_JN - (i / n) * (A_JN - A_JS);
    pts.push([ROT.cx + R * Math.cos(a), ROT.cz + R * Math.sin(a)]);
  }
  pts.push([XJ, GALLERY_HALF], [-15, GALLERY_HALF]);
  return pts;
}

// ---------- geometry helpers shared by the builder, overlays and interaction ----------

export const planeY = (p, x, z) => p.base + p.gx * x + p.gz * z;

export function wallLength(w) {
  if (w.kind === 'line') return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  return w.r * Math.abs(w.sweep);
}

export function frameAt(w, s) {
  if (w.kind === 'line') {
    const L = wallLength(w);
    const tx = (w.b[0] - w.a[0]) / L, tz = (w.b[1] - w.a[1]) / L;
    return { x: w.a[0] + tx * s, z: w.a[1] + tz * s, tx, tz, nx: -tz, nz: tx };
  }
  const a = w.a0 + s / w.r;
  const tx = -Math.sin(a), tz = Math.cos(a);
  return { x: w.cx + w.r * Math.cos(a), z: w.cz + w.r * Math.sin(a), tx, tz, nx: -tz, nz: tx };
}

// Frame at signed distance d from anchor sA with the wall unrolled by u (0 as built, 1 flat).
export function frameUnrolled(w, sA, d, u) {
  const A = frameAt(w, sA);
  if (w.kind === 'line' || u >= 0.9999) {
    if (w.kind === 'line') return frameAt(w, sA + d);
    return { x: A.x + A.tx * d, z: A.z + A.tz * d, tx: A.tx, tz: A.tz, nx: A.nx, nz: A.nz };
  }
  const k = (1 - u) / w.r;
  const c = Math.cos(k * d), sn = Math.sin(k * d);
  const px = A.x + A.tx * (sn / k) + A.nx * ((1 - c) / k);
  const pz = A.z + A.tz * (sn / k) + A.nz * ((1 - c) / k);
  const tx = A.tx * c + A.nx * sn, tz = A.tz * c + A.nz * sn;
  return { x: px, z: pz, tx, tz, nx: -tz, nz: tx };
}

export function wrapD(w, d) {
  if (!w.closed) return d;
  const L = wallLength(w);
  while (d > L / 2) d -= L;
  while (d < -L / 2) d += L;
  return d;
}

export const modS = (w, s) => { const L = wallLength(w); return ((s % L) + L) % L; };

// Piecewise-linear wall top: constant, slope, or gable, by distance along the wall.
export function topAt(w, s) {
  const p = w.top;
  if (p.form === 'constant') return p.h;
  const L = wallLength(w);
  if (p.form === 'slope') return p.h0 + (p.h1 - p.h0) * (s / L);
  if (s <= p.rs) return p.h0 + (p.rh - p.h0) * (s / p.rs);
  return p.rh + (p.h1 - p.rh) * ((s - p.rs) / (L - p.rs));
}

export function maxTop(w) {
  const p = w.top;
  if (p.form === 'constant') return p.h;
  if (p.form === 'slope') return Math.max(p.h0, p.h1);
  return Math.max(p.h0, p.h1, p.rh);
}

export function minTop(w) {
  const p = w.top;
  if (p.form === 'constant') return p.h;
  return Math.min(p.h0, p.h1);
}

export function topPoints(w) {
  const p = w.top, L = wallLength(w);
  if (p.form === 'constant') return [{ key: 'h', s: null, h: p.h }];
  if (p.form === 'slope') return [{ key: 'h0', s: 0, h: p.h0 }, { key: 'h1', s: L, h: p.h1 }];
  return [{ key: 'h0', s: 0, h: p.h0 }, { key: 'rh', s: p.rs, h: p.rh }, { key: 'h1', s: L, h: p.h1 }];
}

// Opening outline: head is the overall top; rise lifts the arch above the spring line.
export function archHeight(o, x) {
  if (o.profile === 'rect' || !o.rise) return 0;
  const hw = o.w / 2;
  const u = Math.min(1, Math.abs(x) / hw);
  if (o.profile === 'round') return o.rise * Math.sqrt(Math.max(0, 1 - u * u));
  const Rr = o.w;
  const hRaw = Math.sqrt(Math.max(0, Rr * Rr - (Math.abs(x) + hw) ** 2));
  return hRaw * (o.rise / (0.8660254 * o.w));
}

export const springOf = (o) => o.head - (o.profile === 'rect' ? 0 : o.rise);
export function openingTopAt(o, s) {
  return springOf(o) + archHeight(o, s - o.s);
}

export function ceilingAtPoint(museum, x, z, pred = (c) => c.rel === 'closure') {
  for (const c of museum.ceilings) {
    if (!pred(c)) continue;
    if (pointInPoly(x, z, c.outline) && !c.holes.some((h) => pointInPoly(x, z, h.pts))) return { ceiling: c, y: planeY(c.plane, x, z) };
  }
  return null;
}

// Ceiling that a wall's chosen face meets at s (side +1 = interior normal side).
export function ceilingAtWall(museum, w, s, side = 1) {
  const f = frameAt(w, s);
  const off = side * (w.thick / 2 + 0.06);
  const px = f.x + f.nx * off, pz = f.z + f.nz * off;
  for (const c of museum.ceilings) {
    if (c.rel !== 'closure') continue;
    if (pointInPoly(px, pz, c.outline)) return { ceiling: c, y: planeY(c.plane, f.x, f.z) };
  }
  return null;
}

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export const byId = (list, id) => list.find((o) => o.id === id);

export function findThing(museum, id) {
  for (const key of ['walls', 'ceilings', 'art', 'objects']) {
    const hit = byId(museum[key], id);
    if (hit) return { kind: key, item: hit };
  }
  for (const w of museum.walls) {
    const o = byId(w.openings, id);
    if (o) return { kind: 'openings', item: o, wall: w };
  }
  return null;
}

export function fmt(v) {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export function centroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}

export function bbox(pts) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

// ---------- validation: proposals are refused with a reason, never repaired ----------

export function validateOpening(w, o) {
  if (o.w < 0.4) return `${o.name} must be at least 0.40 wide`;
  if (o.sill < 0) return `${o.name} sill cannot go below the floor`;
  if (o.head - o.sill < 0.4) return `${o.name} needs at least 0.40 between sill and head`;
  if (o.profile !== 'rect' && (o.rise < 0.05 || o.rise > o.head - o.sill - 0.2)) return `Arch rise must stay between 0.05 and ${fmt(o.head - o.sill - 0.2)}`;
  const L = wallLength(w);
  if (!w.closed && (o.s - o.w / 2 < 0.15 || o.s + o.w / 2 > L - 0.15)) return `${o.name} would run past the end of ${w.name}`;
  for (const other of w.openings) {
    if (other.id === o.id) continue;
    const gap = Math.abs(wrapD(w, other.s - o.s)) - (other.w + o.w) / 2;
    if (gap < 0.1) return `${o.name} would overlap ${other.name}`;
  }
  for (const s of [o.s - o.w / 2, o.s, o.s + o.w / 2]) {
    const top = topAt(w, modS(w, s));
    const oy = openingTopAt(o, s);
    if (oy > top - 0.1) return `Head would cross the wall top (${fmt(top)}) — lower it or raise the wall`;
  }
  return null;
}

export function validateWall(w) {
  const p = w.top, L = wallLength(w);
  const hs = p.form === 'constant' ? [p.h] : p.form === 'slope' ? [p.h0, p.h1] : [p.h0, p.h1, p.rh];
  if (hs.some((h) => h < 2.2)) return 'Wall tops stay at least 2.20 above the floor';
  if (hs.some((h) => h > 12)) return 'Wall tops stay under 12.00';
  if (p.form === 'gable') {
    if (p.rs <= 0.3 || p.rs >= L - 0.3) return 'The ridge must sit between the two ends — move it inward or choose Slope';
    if (p.rh <= Math.max(p.h0, p.h1) + 0.02) return 'The ridge must be higher than both ends — raise it or choose Slope';
    if (w.closed && Math.abs(p.h0 - p.h1) > 1e-6) return 'A closed wall meets itself at the seam, so both ends share one height';
  }
  for (const o of w.openings) {
    for (const s of [o.s - o.w / 2, o.s, o.s + o.w / 2]) {
      if (openingTopAt(o, s) > topAt(w, modS(w, s)) - 0.1) return `The top would cut into ${o.name} — keep it above ${fmt(o.head + 0.1)}`;
    }
  }
  return null;
}

export function validateCeiling(c) {
  const b = c.plane.base;
  if (b < 2.2) return 'Ceilings stay at least 2.20 above the floor';
  if (b > 12) return 'Ceilings stay under 12.00';
  if (Math.abs(c.plane.gx) > 0.4 || Math.abs(c.plane.gz) > 0.4) return 'Slopes steeper than 40% are outside this ceiling vocabulary';
  return null;
}
