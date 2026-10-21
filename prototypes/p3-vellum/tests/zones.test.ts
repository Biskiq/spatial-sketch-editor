import { describe, it, expect } from 'vitest';
import { emptyProject, Project, Overhead, ProfilePt } from '../src/model/types';
import type { V2 } from '../src/model/geom2d';
import { runTxn, opAddOverhead, opOverhead } from '../src/model/ops';
import { presetProfile, ohTopAt, ohFrame, ridgeDirections, nextRidgeDir, ohSpan } from '../src/model/overheadGeom';
import { roofZoneAt, zoneGeometry, zoneTip, ZONE_TIPS, type ZoneTol } from '../src/model/roofZones';
import { detent, mergeStops, reachable, pitchStops, hipStops, straighteningStop, OVERHANG_STOPS, gestureStartStop } from '../src/model/detents';
import { roofWingsState } from '../src/model/wings';

const TOL: ZoneTol = { ridge: 0.4, end: 0.5, eave: 0.35 };
const RECT: V2[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
const L: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]];
/** The same L with its wing on the right: this one decomposes into perpendicular wings with a joined ridge end. */
const L2: V2[] = [[0, 0], [10, 0], [10, 14], [6, 14], [6, 6], [0, 6]];

function roofWith(outline: V2[], preset: 'flat' | 'gable' | 'raked' | 'vault' | 'butterfly' | 'dome' | 'clerestory', extra: { hip?: number; form?: 'extrude' | 'revolve'; oneSpan?: boolean; span?: number } = {}) {
  let p: Project = emptyProject();
  p = runTxn(p, opAddOverhead(outline, 3, { preset: preset === 'dome' ? 'dome' : preset, form: extra.form ?? (preset === 'dome' ? 'revolve' : 'extrude'), profile: presetProfile(preset === 'dome' ? 'dome' : preset, extra.span ?? 6), oneSpan: extra.oneSpan })).after;
  const oh = p.overheads[0];
  if (extra.hip !== undefined) p = runTxn(p, opOverhead(oh.id, { hip: extra.hip })).after;
  return { p, oh: p.overheads[0] };
}

const kind = (oh: Overhead, q: V2, tol = TOL) => roofZoneAt(oh, q, tol);

describe('Hold zones on one span', () => {
  it('finds the ridge, the slopes, the ends and the eaves of a gable', () => {
    const { oh } = roofWith(RECT, 'gable', { hip: 1.5 });
    expect(kind(oh, [5, 3])).toEqual({ kind: 'ridge', wing: 0 });
    expect(kind(oh, [2.5, 3])).toEqual({ kind: 'ridge', wing: 0 });
    expect(kind(oh, [2, 1.2])).toMatchObject({ kind: 'slope', side: 'L' });
    expect(kind(oh, [8, 4.8])).toMatchObject({ kind: 'slope', side: 'R' });
    // the ridge runs along x, so its ends are where it meets the short ends, 1.5 m in from each
    expect(kind(oh, [8.5, 3])).toEqual({ kind: 'ridgeEnd', end: 'A', wing: 0 });
    expect(kind(oh, [1.5, 3])).toEqual({ kind: 'ridgeEnd', end: 'B', wing: 0 });
    expect(kind(oh, [0.1, 3])).toMatchObject({ kind: 'eave' });
    expect(kind(oh, [5, 5.9])).toMatchObject({ kind: 'eave' });
  });

  it('names the hip faces of a hipped gable and keeps the hip ends off the ridge', () => {
    const { oh } = roofWith(RECT, 'gable', { hip: 1.5 });
    expect(kind(oh, [9.2, 2.6])?.kind).toBe('endFace');
    expect(kind(oh, [2.6, 0.2])?.kind).toBe('eave');
  });

  it('does not offer a ridge where the shape has none', () => {
    const flat = roofWith(RECT, 'flat').oh;
    expect(kind(flat, [5, 3])).toEqual({ kind: 'flatTop' });
    expect(kind(flat, [0.1, 3])).toMatchObject({ kind: 'eave' });
    const shed = roofWith(RECT, 'raked').oh;
    expect(kind(shed, [9.9, 3])).not.toMatchObject({ kind: 'ridge' });
    expect(kind(shed, [5, 3])).toMatchObject({ kind: 'slope' });
    // a butterfly's two high edges are not one central ridge
    const fly = roofWith(RECT, 'butterfly').oh;
    expect(kind(fly, [5, 3])).not.toMatchObject({ kind: 'ridge' });
    expect(kind(fly, [0.2, 3])).not.toMatchObject({ kind: 'ridge' });
  });

  it('offers the smooth crown of a vault as a ridge', () => {
    const vault = roofWith(RECT, 'vault').oh;
    expect(kind(vault, [5, 3])).toMatchObject({ kind: 'ridge' });
  });

  it('classifies a dome by apex, slope and eave', () => {
    const dome = roofWith([[0, 0], [8, 0], [8, 8], [0, 8]], 'dome').oh;
    expect(kind(dome, [4, 4])).toEqual({ kind: 'apex' });
    expect(kind(dome, [2.5, 4])).toMatchObject({ kind: 'slope' });
    expect(kind(dome, [0.05, 4])).toMatchObject({ kind: 'eave' });
  });

  it('locks a slope with a step and leaves a continuous side unlocked', () => {
    const cler = roofWith(RECT, 'clerestory').oh;
    const z = kind(cler, [8, 1.2]);
    expect(z).toMatchObject({ kind: 'slope' });
    if (z?.kind === 'slope') expect(z.locked).toBe(true);
    const gable = roofWith(RECT, 'gable').oh;
    const g = kind(gable, [2, 1.2]);
    if (g?.kind !== 'slope') throw new Error(JSON.stringify(g));
    expect(g.locked).toBe(false);
  });

  it('gives every zone a plain tip', () => {
    expect(ZONE_TIPS.ridge).toContain('taller');
    const g = roofWith(RECT, 'gable').oh;
    expect(zoneTip(g, { kind: 'slope', side: 'L', wing: 0, locked: true })).toContain('Double-click');
    expect(zoneTip(g, { kind: 'eave', edge: 0 })).toContain('edge');
    const fitted = { ...g, fit: { rooms: ['r'], overhang: 0.45 } } as Overhead;
    expect(zoneTip(fitted, { kind: 'eave', edge: 0 })).toContain('overhang');
  });
});

describe('Hold zones on a compound roof', () => {
  it('classifies every point in the frame of the wing that owns it', () => {
    const { oh } = roofWith(L, 'gable', { oneSpan: false, span: 10 });
    const st = roofWingsState(oh);
    if (st.kind !== 'compound') throw new Error(st.kind);
    // each wing's own ridge midpoint is a ridge of that wing
    for (let i = 0; i < st.wings.length; i++) {
      const wg = st.wings[i];
      const [w0, w1, v0, v1] = wg.rect;
      const sw = wg.span === 'w';
      const s = (sw ? w0 : v0) + st.peakU * ((sw ? w1 : v1) - (sw ? w0 : v0));
      const r = ((sw ? v0 : w0) + (sw ? v1 : w1)) / 2;
      const f = ohFrame(oh);
      const ea: V2 = [-f.d[1], f.d[0]];
      const q: V2 = [f.d[0] * (sw ? s : r) + ea[0] * (sw ? r : s), f.d[1] * (sw ? s : r) + ea[1] * (sw ? r : s)];
      const z = roofZoneAt(oh, q, { ridge: 0.3, end: 0.4, eave: 0.2 });
      expect(z).toMatchObject({ kind: 'ridge' });
      if (z?.kind === 'ridge') expect(z.wing).toBe(i);
    }
  });

  it('never offers a ridgeEnd at a joined end, and does at an exposed one', () => {
    const { oh } = roofWith(L2, 'gable', { oneSpan: false, span: 10, hip: 1.2 });
    const st = roofWingsState(oh);
    if (st.kind !== 'compound') throw new Error(st.kind);
    const f = ohFrame(oh);
    const ea: V2 = [-f.d[1], f.d[0]];
    const world = (w: number, v: number): V2 => [f.d[0] * w + ea[0] * v, f.d[1] * w + ea[1] * v];
    let exposed = 0, joined = 0;
    for (const wg of st.wings) {
      const [w0, w1, v0, v1] = wg.rect;
      const sw = wg.span === 'w';
      const s = (sw ? w0 : v0) + st.peakU * ((sw ? w1 : v1) - (sw ? w0 : v0));
      for (const end of ['lo', 'hi'] as const) {
        const r = end === 'lo' ? (sw ? v0 : w0) + wg.hipLo : (sw ? v1 : w1) - wg.hipHi;
        const q = world(sw ? s : r, sw ? r : s);
        const z = roofZoneAt(oh, q, { ridge: 0.2, end: 0.3, eave: 0.05 });
        if (wg.ends[end] === 'exposed') { exposed++; expect(z?.kind).toBe('ridgeEnd'); }
        else { joined++; expect(z?.kind).not.toBe('ridgeEnd'); }
      }
    }
    expect(exposed).toBeGreaterThan(0);
    expect(joined).toBeGreaterThan(0);
  });

  it('draws geometry where the zone is, lifted above the surface', () => {
    const { oh } = roofWith(L2, 'gable', { oneSpan: false, span: 10 });
    const z = kind(oh, [8, 10]);
    const geo = zoneGeometry(oh, z!);
    expect(geo.lines.length).toBeGreaterThan(0);
    for (const line of geo.lines)
      for (const [x, y, zz] of line) {
        expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zz)).toBe(true);
        expect(y).toBeGreaterThan(oh.baseY);
      }
  });
});

describe('zone geometry', () => {
  const gable = () => roofWith(RECT, 'gable', { hip: 1.5 }).oh;

  it('drapes the ridge above the roof surface and spans its hip-to-hip length', () => {
    const oh = gable();
    const geo = zoneGeometry(oh, { kind: 'ridge', wing: 0 });
    expect(geo.lines).toHaveLength(1);
    const line = geo.lines[0];
    expect(line.length).toBe(2);
    for (const [x, y, z] of line) expect(y).toBeCloseTo(ohTopAt(oh, [x, z]) + 0.03, 6);
    const [a, b] = line;
    expect(a[0]).toBeCloseTo(8.5, 6);
    expect(b[0]).toBeCloseTo(1.5, 6);
    expect(a[2]).toBeCloseTo(3, 6);
    expect(b[2]).toBeCloseTo(3, 6);
  });

  it('returns the outline for a flat top and a ring for an apex, including an elevated flat roof', () => {
    const flat = roofWith(RECT, 'flat').oh;
    const geo = zoneGeometry(flat, { kind: 'flatTop' });
    expect(geo.lines[0]).toHaveLength(RECT.length + 1);
    for (const [, y] of geo.lines[0]) expect(y).toBeCloseTo(flat.baseY + flat.thick + 0.03, 6);
    const elevated = { ...flat, profile: flat.profile.map((p) => ({ ...p, h: 1.2 })) } as Overhead;
    expect(kind(elevated, [5, 3])).toEqual({ kind: 'flatTop' });
    const dome = roofWith([[0, 0], [8, 0], [8, 8], [0, 8]], 'dome').oh;
    const apex = zoneGeometry(dome, { kind: 'apex' });
    expect(apex.ring).toBeTruthy();
    expect(apex.ring![1]).toBeGreaterThan(dome.baseY + 1);
  });

  it('clips a slope to the outline and an eave to its edge', () => {
    const oh = gable();
    const s = zoneGeometry(oh, { kind: 'slope', side: 'L', wing: 0, locked: false });
    expect(s.lines.length).toBeGreaterThan(0);
    for (const line of s.lines) for (const [x, , z] of line) expect(x).toBeGreaterThanOrEqual(-0.01 - 1e-9), expect(z).toBeGreaterThanOrEqual(-0.01 - 1e-9);
    const e = zoneGeometry(oh, { kind: 'eave', edge: 0 });
    expect(e.lines[0].length).toBeGreaterThan(2);
    for (const [, y] of e.lines[0]) expect(y).toBeCloseTo(oh.baseY + oh.thick + 0.03, 6);
  });
});

describe('detents', () => {
  it('snaps inside the radius, not outside, and not at all when free', () => {
    const stops = [gestureStartStop(2)];
    expect(detent(2.03, stops, 0.05).v).toBe(2);
    expect(detent(2.2, stops, 0.05).v).toBe(2.2);
    expect(detent(2.03, stops, 0.05, true).v).toBe(2.03);
    expect(detent(2.03, stops, 0.05).label).toBe('as it was');
  });

  it('merges coincident stops and picks the nearest, deterministically', () => {
    const merged = mergeStops([{ at: 1, label: 'a' }, { at: 1, label: 'b' }, { at: 2, label: 'c' }]);
    expect(merged.map((s) => s.label)).toEqual(['a', 'c']);
    const tie = detent(1.5, [{ at: 1, label: 'a' }, { at: 2, label: 'b' }], 0.6);
    expect(tie.label).toBe('a');
    expect(detent(1.7, [{ at: 1, label: 'a' }, { at: 2, label: 'b' }], 0.6).label).toBe('b');
  });

  it('holds the active stop until the pointer leaves 1.5× the radius', () => {
    const stops = [{ at: 0, label: 'a' }, { at: 0.2, label: 'b' }];
    const held = detent(0.06, stops, 0.05, false, 0);
    expect(held.v).toBe(0);
    const free = detent(0.09, stops, 0.05, false, 0);
    expect(free.v).toBe(0.09);
    expect(free.active).toBeUndefined();
  });

  it('drops stops a limit makes unreachable', () => {
    expect(reachable([{ at: -1, label: 'x' }, { at: 0, label: 'y' }, { at: 5, label: 'z' }], 0, 3).map((s) => s.label)).toEqual(['y']);
  });

  it('offers pitch stops on the longer run', () => {
    const { oh } = roofWith(RECT, 'gable');
    const span = ohSpan(oh);
    const stops = pitchStops({ ...oh, profile: [{ ...oh.profile[0], u: 0.3 }, oh.profile[1], oh.profile[2]] } as Overhead);
    expect(stops.find((s) => s.label === '45° pitch')!.at).toBeCloseTo(0.5 * span, 6);
  });

  it('offers hip stops that a gable can reach', () => {
    const { oh } = roofWith(RECT, 'gable');
    const stops = hipStops(oh);
    const labels = stops.map((s) => s.label);
    expect(labels[0]).toBe('gable ends');
    expect(labels).toContain('ends meet');
    expect(labels).toContain('even hip');
    expect(stops.find((s) => s.label === 'even hip')!.at).toBeCloseTo(ohSpan(oh) / 2, 6);
    for (const s of stops) expect(s.at).toBeGreaterThanOrEqual(0);
    expect(hipStops(roofWith(RECT, 'raked').oh).map((s) => s.label)).not.toContain('even hip');
  });

  it('has overhang stops the fitted control can land on', () => {
    expect(OVERHANG_STOPS.map((s) => s.at)).toEqual([0, 0.3, 0.45, 0.6]);
  });

  it('labels a bowed side’s straightening displacement, and offers none for a straight side', () => {
    const bowed: ProfilePt[] = [
      { u: 0, h: 0, crease: true, id: 'a' },
      { u: 0.25, h: 1.4, crease: false, id: 'b' },
      { u: 0.5, h: 2, crease: true, id: 'c' },
      { u: 0.75, h: 1.4, crease: false, id: 'd' },
      { u: 1, h: 0, crease: true, id: 'e' },
    ];
    const left = straighteningStop(bowed, 'L', 8);
    expect(left).toHaveLength(1);
    expect(left[0].label).toBe('straight');
    expect(left[0].at).toBeGreaterThan(0.2);
    expect(straighteningStop(presetProfile('gable', 8), 'L', 8)).toEqual([]);
  });
});

describe('turning the ridge', () => {
  it('lists span directions from the outline edges, longest first', () => {
    const { oh } = roofWith(RECT, 'gable');
    const dirs = ridgeDirections(oh);
    expect(dirs).toHaveLength(2);
    expect(Math.abs(dirs[0] - dirs[1])).toBeCloseTo(Math.PI / 2, 3);
  });

  it('turns to the other direction in one step and keeps the authored heights', () => {
    const { p, oh } = roofWith(RECT, 'gable');
    const next = nextRidgeDir(oh);
    expect(next).not.toBeNull();
    const before = oh.profile.map((q) => q.h);
    const after = runTxn(p, opOverhead(oh.id, { dir: next! })).after.overheads[0];
    expect(after.dir).toBeCloseTo(next!, 9);
    expect(after.profile.map((q) => q.h)).toEqual(before);
    // the old ridge line (z = 3) is no longer a ridge; the new one runs along x = 5
    expect(roofZoneAt(after, [2, 3], TOL)?.kind).not.toBe('ridge');
    expect(roofZoneAt(after, [5, 3], { ridge: 0.4, end: 0.6, eave: 0.35 })).toMatchObject({ kind: 'ridge' });
  });

  it('offers no turn for a flat or round roof', () => {
    expect(nextRidgeDir(roofWith(RECT, 'flat').oh)).toBeNull();
    expect(nextRidgeDir(roofWith([[0, 0], [8, 0], [8, 8], [0, 8]], 'dome').oh)).toBeNull();
  });
});
