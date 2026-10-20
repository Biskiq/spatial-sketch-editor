// Prepared samples. They are built with the same native operations the pen uses, so every part is editable.
import { emptyProject, Project, Moment } from '../model/types';
import type { StrokeFit } from '../model/strokes';
import { runTxn, Op, opAddRun, opAddOpening, opRoom, opCoverRooms, opAddOverhead, opAddDeck, opAddVoid, opAddStair, opAddObj, opAddPost, bridgeOutline, opOverhead } from '../model/ops';
import { V2, circlePoly } from '../model/geom2d';
import { closestOnRun, pointAtT, runGeom } from '../model/runs';
import { seedAt } from '../model/settle';
import { derive } from '../model/derive';
import { presetProfile } from '../model/overheadGeom';

class B {
  p: Project;
  constructor(name: string) {
    this.p = emptyProject(name);
  }
  do(op: Op) {
    this.p = runTxn(this.p, op).after;
    return this;
  }
  last<K extends 'runs' | 'overheads' | 'decks' | 'voids' | 'stairs' | 'objs' | 'openings'>(k: K): Project[K][number] {
    const a = this.p[k] as any[];
    return a[a.length - 1];
  }
  path(pts: V2[], bulge: number[] = [], o: { closed?: boolean; base?: number; top?: number | null; tieA?: [string, V2] | null; tieB?: [string, V2] | null; name?: string; thick?: number } = {}) {
    const closed = !!o.closed;
    const nseg = closed ? pts.length : pts.length - 1;
    const b = Array.from({ length: nseg }, (_, i) => bulge[i] ?? 0);
    const tie = (t: [string, V2] | null | undefined) => {
      if (!t) return null;
      const host = this.p.runs.find((r) => r.id === t[0])!;
      return { host: host.id, t: closestOnRun(host, t[1]).t };
    };
    const tieA = tie(o.tieA), tieB = tie(o.tieB);
    const P = pts.slice();
    if (tieA) P[0] = pointAtT(this.p.runs.find((r) => r.id === tieA.host)!, tieA.t);
    if (tieB) P[P.length - 1] = pointAtT(this.p.runs.find((r) => r.id === tieB.host)!, tieB.t);
    const fit: StrokeFit = { kind: closed ? 'closed' : 'open', pts: P, bulge: b, closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0 };
    this.do(opAddRun(fit, { baseY: o.base ?? 0, top: o.top ?? null, tieA, tieB, name: o.name, thick: o.thick }));
    return this.last('runs').id;
  }
  circle(c: V2, r: number, base = 0, name?: string) {
    const fit: StrokeFit = { kind: 'circle', pts: [], bulge: [], closed: true, center: c, radius: r, length: 0, curved: true, corners: 0 };
    this.do(opAddRun(fit, { baseY: base, name }));
    return this.last('runs').id;
  }
  room(at: V2, props: { name?: string; floorY?: number; height?: number; ceiling?: 'flat' | 'follow' }, level = 0) {
    const s = seedAt(this.p, at, level);
    if (!s) throw new Error(`no room at ${at}`);
    this.do(opRoom(s.id, props));
    return s.id;
  }
  opening(run: string, at: V2, spec: any) {
    const r = this.p.runs.find((x) => x.id === run)!;
    const c = closestOnRun(r, at);
    this.do(opAddOpening(run, c.s, spec));
    return this.last('openings').id;
  }
  frameOn(run: string, at: V2, y: number, side: 1 | -1) {
    const r = this.p.runs.find((x) => x.id === run)!;
    const c = closestOnRun(r, at);
    this.do(opAddObj('frame', at, { kind: 'wall', run, t: c.t, y, side }));
  }
  moments(ms: Partial<Moment>[]) {
    this.p.story.moments = ms.map((m, i) => ({ id: `t${900 + i}`, t: 0, caption: '', look: null, reveal: 'none', dwell: 4, ...m }));
  }
  done(): Project {
    this.p.acknowledged = derive(this.p).issues.filter((i) => i.kind === 'support' && i.text.includes('Bridge')).map((i) => i.key);
    return this.p;
  }
}

// ------------------------------------------------------------------ 1. A small pavilion (photographer)
export function pavilion(): Project {
  const b = new B('A small pavilion');
  const C: V2 = [7, 0], R = 3.2;
  const reading = b.circle(C, R, 0, 'Reading room wall');
  const at = (deg: number): V2 => [C[0] + R * Math.cos((deg * Math.PI) / 180), C[1] + R * Math.sin((deg * Math.PI) / 180)];
  // the long curved gallery wall: from the west end, bowing north, landing on the round room
  const gallery = b.path([[-10, -1.4], at(212)], [-0.32], { tieB: [reading, at(212)], name: 'Gallery wall' });
  const west = b.path([[-10, 2.2], [-10, -1.4]], [], { tieB: [gallery, [-10, -1.4]] });
  const south = b.path([[-10, 2.2], at(146)], [], { tieA: [west, [-10, 2.2]], tieB: [reading, at(146)], name: 'Street wall' });
  b.room([-4, 0.2], { name: 'Gallery', height: 3.6 });
  b.room(C, { name: 'Reading room', height: 4.8 });
  b.opening(reading, at(180), { shape: 'arch', width: 1.8, height: 3.1, sill: 0, rise: 0.9 });
  b.opening(south, [-6.5, 2.2], { shape: 'rect', width: 1.2, height: 2.4, sill: 0 });
  b.opening(south, [-1.5, 2.2], { shape: 'rect', width: 3.2, height: 1.4, sill: 1.0 });
  b.opening(reading, at(40), { shape: 'round', width: 1.1, height: 3.4, sill: 2.3 });
  b.opening(reading, at(320), { shape: 'rect', width: 0.7, height: 3.6, sill: 0.6 });
  // photographs along the curve
  const g = b.p.runs.find((r) => r.id === gallery)!;
  for (const t of [0.18, 0.36, 0.54, 0.72]) {
    const q = pointAtT(g, t);
    b.do(opAddObj('frame', q, { kind: 'wall', run: gallery, t, y: 1.55, side: -1 }));
  }
  b.do(opAddObj('bench', [-3.5, 0.9], { kind: 'room', id: seedAt(b.p, [-4, 0.2])!.id }, 0.12));
  // overheads
  const d = derive(b.p);
  const gal = d.rooms.find((r) => r.name === 'Gallery')!;
  const rr = d.rooms.find((r) => r.name === 'Reading room')!;
  b.do(opCoverRooms([gal.id], 'flat'));
  b.do(opCoverRooms([rr.id], 'dome'));
  b.do(opAddVoid(circlePoly(C, 0.75, 24), 4.8 - 0.06, 999, 'Oculus'));
  b.do(opAddObj('plinth', [C[0] + 0.2, C[1] + 0.3], { kind: 'room', id: rr.id }));
  // an entrance canopy, reaching past the building
  b.do(opAddOverhead([[-8.2, 2.34], [-3.6, 2.34], [-3.6, 6.4], [-8.2, 6.4]], 3.0, { name: 'Entrance canopy', preset: 'flat' }));
  b.do(opAddPost([-7.9, 6.1]));
  b.do(opAddPost([-3.9, 6.1]));
  b.do(opAddObj('tree', [-1.5, 6.8], { kind: 'ground', y: 0 }));
  b.p.story.route = [[-6.5, 9], [-6.5, 4], [-6.5, 1.0], [-4, 0.2], [0, 0.0], [3.0, 0.0], [5.6, 0.2], [6.6, 0.4]];
  b.p.story.routeStartY = 0;
  b.moments([
    { t: 0.0, caption: 'A small pavilion for one photographer’s series: a long gallery, and a round room at the end of it.', reveal: 'lift', look: [-1, 1, 0], dwell: 5 },
    { t: 0.24, caption: 'You come in under the canopy, out of the street.', look: [-6.5, 2.2, 1.6], dwell: 3.5 },
    { t: 0.5, caption: 'One long wall bends with you, the pictures along it.', look: [-2, 1.6, -3.4], dwell: 4 },
    { t: 0.82, caption: 'Through the arch…', look: [3.8, 2, 0], dwell: 3 },
    { t: 1.0, caption: '…a round room, lit from a single opening above.', reveal: 'light', look: [7, 6, 0], dwell: 5 },
  ]);
  return b.done();
}

// ------------------------------------------------------------------ 2. Galleries under a raked clerestory roof (exhibition designer)
export function galleries(): Project {
  const b = new B('Galleries under a raked roof');
  const outer = b.path([[-12, -6], [12, -6], [12, 6], [-12, 6]], [], { closed: true, name: 'Outer wall' });
  const d1 = b.path([[-4, -6], [-4, 6]], [], { tieA: [outer, [-4, -6]], tieB: [outer, [-4, 6]] });
  const d2 = b.path([[4, -6], [4, 6]], [], { tieA: [outer, [4, -6]], tieB: [outer, [4, 6]] });
  const W = b.room([-8, 0], { name: 'West gallery', height: 4.0 });
  const M = b.room([0, 0], { name: 'Middle gallery', height: 4.0 });
  const E = b.room([8, 0], { name: 'East gallery', height: 4.0 });
  b.opening(d1, [-4, 0], { shape: 'rect', width: 2.0, height: 2.8, sill: 0 });
  b.opening(d2, [4, 0], { shape: 'rect', width: 2.0, height: 2.8, sill: 0 });
  b.opening(outer, [0, 6], { shape: 'rect', width: 2.4, height: 2.8, sill: 0 });
  for (const x of [-10, -6, 6, 10]) b.frameOn(outer, [x, -6], 1.7, 1);
  for (const [x, z] of [[-8, -1.5], [-8, 2], [0, -2.5]] as V2[]) b.do(opAddObj('plinth', [x, z], { kind: 'room', id: seedAt(b.p, [x, z])!.id }));
  b.do(opAddObj('bench', [0, 1.5], { kind: 'room', id: M }));
  b.do(opAddObj('sculpture', [8, 0], { kind: 'room', id: E }));
  b.do(opCoverRooms([W, M, E], 'clerestory'));
  const roof = b.last('overheads');
  b.do(opOverhead(roof.id, { name: 'Clerestory roof', dir: -Math.PI / 2, profile: presetProfile('clerestory', 13) }));
  // a skylight over the east gallery: light into one room only
  b.do(opAddVoid([[6.6, -1.4], [9.4, -1.4], [9.4, 1.4], [6.6, 1.4]], 4.0 - 0.06, 999, 'Skylight'));
  b.p.story.route = [[0, 11], [0, 7], [0, 2], [-2, 0.5], [-6, 0.5], [-8.5, 0], [-6, -0.5], [2, -0.5], [6, 0], [7.4, 0]];
  b.moments([
    { t: 0.0, caption: 'Three calm rooms in a row. All the drama is overhead.', reveal: 'lift', look: [0, 2, 0], dwell: 5 },
    { t: 0.3, caption: 'Inside, the ceilings stay quiet and flat…', look: [0, 4, -3], dwell: 3.5 },
    { t: 0.55, caption: '…while the roof above them rakes up to a band of north light.', reveal: 'slice', look: [-8, 4.5, -2], dwell: 5 },
    { t: 1.0, caption: 'One room gets light from directly above.', reveal: 'light', look: [8, 3, 0], dwell: 5 },
  ]);
  return b.done();
}

// ------------------------------------------------------------------ 3. Two wings and a bridge (educator)
export function twoWings(): Project {
  const b = new B('Two wings and a bridge');
  // the old wing: raised on a plinth, tall storeys
  const ow = b.path([[-18, -5], [-6, -5], [-6, 5], [-18, 5]], [], { closed: true, name: 'Old wing wall', thick: 0.4 });
  const od = b.path([[-12, -5], [-12, 5]], [], { tieA: [ow, [-12, -5]], tieB: [ow, [-12, 5]], thick: 0.3 });
  const hall = b.room([-9, 0], { name: 'Old hall', floorY: 0.9, height: 5.4 });
  const lib = b.room([-15, 0], { name: 'Library', floorY: 0.9, height: 5.4 });
  b.opening(od, [-12, 0], { shape: 'arch', width: 1.8, height: 3.2, sill: 0, rise: 0.9 });
  b.opening(ow, [-9, 5], { shape: 'rect', width: 1.6, height: 3.0, sill: 0 });
  for (const x of [-16.5, -13.5]) b.opening(ow, [x, 5], { shape: 'arch', width: 1.4, height: 4.2, sill: 1.1, rise: 0.7 });
  for (const x of [-16.5, -13.5, -10.5, -7.5]) b.opening(ow, [x, -5], { shape: 'arch', width: 1.4, height: 4.2, sill: 1.1, rise: 0.7 });
  // a gallery inside the tall hall, at the bridge's height
  b.do(opAddDeck([[-11.8, -4.8], [-6.2, -4.8], [-6.2, -1.8], [-11.8, -1.8]], 3.4, { name: 'Hall gallery' }));
  const hallGallery = b.last('decks').id;
  b.do(opAddStair([[-11.2, 2.4], [-11.2, -1.5]], { kind: 'room', id: hall }, { kind: 'deck', id: hallGallery }, 0.9, 3.4, 'stair'));
  b.do(opAddPost([-11.5, -2.1]));
  b.do(opAddPost([-8.9, -2.1]));
  b.do(opAddPost([-6.5, -2.1]));
  b.opening(ow, [-6, -3.3], { shape: 'rect', width: 1.6, height: 4.8, sill: 2.5 });
  // front steps up onto the plinth
  b.do(opAddStair([[-9, 8.2], [-9, 5.3]], { kind: 'ground', y: 0 }, { kind: 'room', id: hall }, 0, 0.9, 'stair'));
  // the new wing: at grade, lower storeys
  const nw = b.path([[4, -6], [16, -6], [16, 6], [4, 6]], [], { closed: true, name: 'New wing wall' });
  const nd = b.path([[10, -6], [10, 6]], [], { tieA: [nw, [10, -6]], tieB: [nw, [10, 6]] });
  const studio = b.room([7, 0], { name: 'Studio', height: 3.4 });
  const cafe = b.room([13, 0], { name: 'Café', height: 3.4 });
  b.opening(nd, [10, 2], { shape: 'rect', width: 1.4, height: 2.3, sill: 0 });
  b.opening(nw, [13, 6], { shape: 'rect', width: 3.6, height: 2.4, sill: 0 });
  b.opening(nw, [7, 6], { shape: 'rect', width: 4.0, height: 1.8, sill: 0.8 });
  b.do(opAddDeck([[4, -6], [16, -6], [16, 6], [4, 6]], 3.4, { name: 'New upper floor', restsOn: studio }));
  const upper = b.last('decks').id;
  const uw = b.path([[4.2, -5.8], [15.8, -5.8], [15.8, 5.8], [4.2, 5.8]], [], { closed: true, base: 3.4, name: 'Upper walls' });
  b.room([10, 0], { name: 'Classroom', height: 3.0 }, 3.4);
  b.opening(uw, [4.2, -3.3], { shape: 'rect', width: 1.6, height: 2.3, sill: 0 });
  b.opening(uw, [10, 5.8], { shape: 'rect', width: 6, height: 1.6, sill: 0.9 });
  b.do(opAddStair([[14.6, 2.6], [14.6, -5.2]], { kind: 'room', id: cafe }, { kind: 'deck', id: upper }, 0, 3.4, 'stair'));
  b.do(opAddVoid([[13.8, 2.0], [15.5, 2.0], [15.5, -5.4], [13.8, -5.4]], 0.01, 3.45, 'Stair opening'));
  // the bridge between the wings
  b.do(opAddDeck(bridgeOutline([[-6, -3.3], [4.2, -3.3]], 2.2), 3.4, { bridge: true, name: 'Bridge' }));
  // roofs
  const d = derive(b.p);
  b.do(opCoverRooms([hall, lib], 'gable'));
  b.do(opOverhead(b.last('overheads').id, { name: 'Old wing roof', dir: Math.PI / 2 }));
  const cls = d.rooms.find((r) => r.name === 'Classroom')!;
  b.do(opCoverRooms([cls.id], 'flat'));
  b.do(opAddObj('screen', [-15, -2], { kind: 'room', id: lib }));
  b.do(opAddObj('bench', [7, 2], { kind: 'room', id: studio }));
  b.p.story.route = [[-9, 11], [-9, 8.2], [-9, 5.3], [-9, 1.5], [-11.2, 2.4], [-11.2, -1.5], [-10, -3.3], [-6, -3.3], [0, -3.3], [4.2, -3.3], [8, -2]];
  b.moments([
    { t: 0.0, caption: 'Two wings that do not share a floor: an old one on a plinth, a new one at grade.', reveal: 'lift', look: [-1, 3, 0], dwell: 5 },
    { t: 0.24, caption: 'Up onto the plinth: the old hall is tall — more than three people high.', look: [-9, 3, 0], dwell: 4 },
    { t: 0.52, caption: 'A gallery inside the hall is the only way across.', reveal: 'cut', look: [-8, 3.4, -3.3], dwell: 4 },
    { t: 0.78, caption: 'The bridge lands on the new wing’s upper floor — same height, different building.', reveal: 'slice', look: [4, 3.4, -3.3], dwell: 5 },
  ]);
  return b.done();
}

// ------------------------------------------------------------------ 4. Compression and release (artist)
export function compression(): Project {
  const b = new B('Compression and release');
  const hallW = b.path([[-2, -5], [8, -5], [8, 5], [-2, 5]], [], { closed: true, name: 'Hall wall' });
  const cn = b.path([[-14, -1.2], [-2, -1.2]], [], { tieB: [hallW, [-2, -1.2]] });
  const cs = b.path([[-14, 1.2], [-2, 1.2]], [], { tieB: [hallW, [-2, 1.2]] });
  const cw = b.path([[-14, -1.2], [-14, 1.2]], [], { tieA: [cn, [-14, -1.2]], tieB: [cs, [-14, 1.2]] });
  const corridor = b.room([-8, 0], { name: 'Approach', height: 2.3 });
  const hall = b.room([3, 0], { name: 'The hall', height: 9.0 });
  b.opening(cw, [-14, 0], { shape: 'rect', width: 1.1, height: 2.1, sill: 0 });
  b.opening(hallW, [-2, 0], { shape: 'rect', width: 1.4, height: 2.1, sill: 0 });
  b.do(opAddDeck([[-1.8, -4.8], [7.8, -4.8], [7.8, -1.4], [-1.8, -1.4]], 4.4, { name: 'Mezzanine' }));
  const mezz = b.last('decks').id;
  b.do(opAddStair([[3.2, 4.3], [7.1, 4.3], [7.1, -1.1]], { kind: 'room', id: hall }, { kind: 'deck', id: mezz }, 0, 4.4, 'stair'));
  const d = derive(b.p);
  b.do(opCoverRooms([hall], 'flat'));
  b.do(opCoverRooms([corridor], 'flat'));
  // a lightwell falling past the mezzanine to one sculpture
  b.do(opAddVoid([[2.0, -2.6], [4.4, -2.6], [4.4, -0.2], [2.0, -0.2]], 0.01, 999, 'Lightwell'));
  b.do(opAddObj('sculpture', [3.2, -1.4], { kind: 'room', id: hall }));
  for (const x of [-1.4, 1.6, 4.8, 7.4]) b.do(opAddPost([x, -1.75]));
  b.p.story.route = [[-17, 0], [-14, 0], [-8, 0], [-2.6, 0], [0.5, 0.6], [2.2, 3.4], [3.2, 4.3], [7.1, 4.3], [7.1, -1.1], [5.0, -2.8], [4.7, -3.4]];
  b.moments([
    { t: 0.0, caption: 'Compression, then release.', reveal: 'lift', look: [-3, 2, 0], dwell: 4.5 },
    { t: 0.16, caption: 'A low approach — barely above your head.', reveal: 'cut', look: [-6, 2.2, 0], dwell: 4 },
    { t: 0.42, caption: 'Then the hall opens up, nine metres tall.', look: [3, 6, -1], dwell: 4 },
    { t: 0.55, caption: 'Light falls past the mezzanine to a single sculpture.', reveal: 'light', look: [3.2, 1, -1.4], dwell: 5 },
    { t: 1.0, caption: 'From above, the sculpture is the whole room.', look: [3.2, 0.5, -1.4], dwell: 5 },
  ]);
  return b.done();
}

export const SAMPLES: { id: string; title: string; who: string; blurb: string; make: () => Project }[] = [
  { id: 'pavilion', title: 'A small pavilion', who: 'a photographer', blurb: 'One long curved wall, a round reading room, an arch between, a canopy out front.', make: pavilion },
  { id: 'galleries', title: 'Galleries under a raked roof', who: 'an exhibition designer', blurb: 'Calm orthogonal rooms; a clerestory roof above flat ceilings; one skylight.', make: galleries },
  { id: 'wings', title: 'Two wings and a bridge', who: 'an educator', blurb: 'An old wing on a plinth with tall storeys, a new wing at grade, joined at one height.', make: twoWings },
  { id: 'compression', title: 'Compression and release', who: 'an artist', blurb: 'A low approach, a tall hall, a mezzanine, a lightwell onto one sculpture.', make: compression },
];
