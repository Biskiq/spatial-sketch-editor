import { describe, it, expect } from 'vitest';
import { emptyProject } from '../src/model/types';
import { runTxn, opAddOverhead } from '../src/model/ops';
import { maxRise, MAX_RISE, PEAK_MARGIN, SHOULDER_MARGIN, presetProfile, movePeak, profilePeak, pullShoulder, ensureShoulder, profileShoulder, profileSymmetric, sampleProfile, profileH } from '../src/model/overheadGeom';

const H = (pts: ReturnType<typeof presetProfile>, u: number) => profileH(sampleProfile(pts), u);

describe('sculpting a roof with a few big moves', () => {
  it('pulling the peak up scales the whole profile; ids, creases and positions keep', () => {
    const g = presetProfile('gable', 10);
    const pk = profilePeak(g);
    const m = movePeak(g, pk.u, pk.h * 1.5);
    expect(m.map((q) => q.id)).toEqual(g.map((q) => q.id));
    expect(m.map((q) => q.u)).toEqual(g.map((q) => q.u));
    expect(m.map((q) => q.crease)).toEqual(g.map((q) => q.crease));
    expect(profilePeak(m).h).toBeCloseTo(pk.h * 1.5, 9);
  });

  it('pulling the peak sideways leans it, carrying each slope along; the eaves stay', () => {
    const v = presetProfile('vault', 10);
    const m = movePeak(v, 0.7, profilePeak(v).h);
    expect(profilePeak(m).u).toBeCloseTo(0.7, 9);
    expect(m[0].u).toBe(0);
    expect(m[m.length - 1].u).toBe(1);
    expect(m.length).toBe(v.length);
    // the left slope's point keeps its share of the slope
    expect(m[1].u / 0.7).toBeCloseTo(v[1].u / 0.5, 9);
    for (let i = 1; i < m.length; i++) expect(m[i].u).toBeGreaterThanOrEqual(m[i - 1].u);
  });

  it('a step keeps vertical when the peak leans', () => {
    const c = presetProfile('clerestory', 10); // its peak is on the eave edge: it can only rise
    const m = movePeak(c, 0.3, profilePeak(c).h);
    expect(m.map((q) => q.u)).toEqual(c.map((q) => q.u));
  });

  it('a flat roof grows one sharp peak where it is pulled up', () => {
    const f = presetProfile('flat', 10);
    const m = movePeak(f, 0.5, 2);
    expect(m.length).toBe(3);
    expect(m[1]).toMatchObject({ u: 0.5, h: 2, crease: true });
    expect(m[0].id).toBe(f[0].id);
  });

  it('the shoulder sits at half height on each slope', () => {
    const g = presetProfile('gable', 10);
    const sl = profileShoulder(g, 'L')!, sr = profileShoulder(g, 'R')!;
    expect(sl.u).toBeCloseTo(0.25, 6);
    expect(sr.u).toBeCloseTo(0.75, 6);
    expect(sl.h).toBeCloseTo(profilePeak(g).h / 2, 6);
  });

  it('a straight slope gets one smooth point to bow, without changing shape', () => {
    const g = presetProfile('gable', 10);
    const e = ensureShoulder(ensureShoulder(g, 'L'), 'R');
    expect(e.length).toBe(5);
    expect(e.filter((q) => !q.crease).length).toBe(2);
    for (const u of [0.1, 0.25, 0.4, 0.6, 0.9]) expect(H(e, u)).toBeCloseTo(H(g, u), 6);
    expect(ensureShoulder(e, 'L')).toBe(e);
  });

  it('pulling a shoulder out makes the roof broader, in makes it pointier; symmetric stays symmetric', () => {
    const g = ensureShoulder(ensureShoulder(presetProfile('gable', 10), 'L'), 'R');
    const broad = pullShoulder(g, 'L', -0.12);
    const point = pullShoulder(g, 'L', +0.12);
    expect(H(broad, 0.25)).toBeGreaterThan(H(g, 0.25) + 0.1);
    expect(H(point, 0.25)).toBeLessThan(H(g, 0.25) - 0.1);
    expect(profileSymmetric(broad)).toBe(true);
    expect(profileSymmetric(point)).toBe(true);
    // only sideways: heights, ids and creases keep; the peak and eaves stay
    expect(broad.map((q) => q.h)).toEqual(g.map((q) => q.h));
    expect(broad.map((q) => q.id)).toEqual(g.map((q) => q.id));
    expect(profilePeak(broad).u).toBeCloseTo(0.5, 9);
    expect(broad[0].u).toBe(0);
    // the shoulder point follows the pen
    expect(broad[1].u).toBeCloseTo(g[1].u - 0.12, 6);
  });

  it('an asymmetric roof pulls one shoulder only', () => {
    const g = ensureShoulder(ensureShoulder(movePeak(presetProfile('gable', 10), 0.6, 3), 'L'), 'R');
    const m = pullShoulder(g, 'L', -0.1);
    expect(m[3].u).toBe(g[3].u);
  });
});

describe('sculpting stops short of the extremes', () => {
  it('a shoulder pulled all the way in or out keeps a quarter of the slope either side', () => {
    const g = ensureShoulder(ensureShoulder(presetProfile('gable', 10), 'L'), 'R');
    const pk = profilePeak(g);
    for (const du of [-5, 5]) {
      const m = pullShoulder(g, 'L', du);
      const inner = m.filter((q, i) => i > 0 && i < pk.i0);
      expect(inner.length).toBeGreaterThan(0);
      for (const q of inner) {
        expect(q.u).toBeGreaterThanOrEqual(SHOULDER_MARGIN * m[pk.i0].u - 1e-9);
        expect(q.u).toBeLessThanOrEqual((1 - SHOULDER_MARGIN) * m[pk.i0].u + 1e-9);
      }
      expect(profileSymmetric(m)).toBe(true);
    }
  });
  it('a leaning peak never stands a slope upright', () => {
    const g = presetProfile('gable', 10);
    for (const u of [0, 1]) {
      const p = profilePeak(movePeak(g, u, profilePeak(g).h)).u;
      expect(p).toBeGreaterThanOrEqual(PEAK_MARGIN - 1e-9);
      expect(p).toBeLessThanOrEqual(1 - PEAK_MARGIN + 1e-9);
    }
    expect(profilePeak(movePeak(presetProfile('flat', 10), 0.01, 2)).u).toBeCloseTo(PEAK_MARGIN);
  });
  it('a roof rises at most one and a half times its span', () => {
    const oh = runTxn(emptyProject(), opAddOverhead([[0, 0], [6, 0], [6, 10], [0, 10]], 3, { dir: 0 })).after.overheads[0];
    expect(maxRise(oh)).toBeCloseTo(MAX_RISE * 6);
  });
});
