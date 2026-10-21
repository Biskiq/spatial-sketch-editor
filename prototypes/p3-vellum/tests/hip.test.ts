import { describe, it, expect } from 'vitest';
import { emptyProject } from '../src/model/types';
import { runTxn, opAddOverhead, opOverhead } from '../src/model/ops';
import { ohH, ohFrame, presetProfile } from '../src/model/overheadGeom';
import { buildOverhead } from '../src/scene/build/overheads';

// a 6 m span (along x), 10 m ridge (along z)
const roof = (hip: number) => {
  let p = runTxn(emptyProject(), opAddOverhead([[0, 0], [6, 0], [6, 10], [0, 10]], 3, { dir: 0 })).after;
  const id = p.overheads[0].id;
  p = runTxn(p, opOverhead(id, { profile: presetProfile('gable', 6), hip })).after;
  return p.overheads[0];
};

describe('hipped ends', () => {
  it('a gable stays a gable at hip 0', () => {
    const oh = roof(0);
    const H = ohH(oh, [3, 5]);
    expect(ohH(oh, [3, 0])).toBeCloseTo(H, 6);
  });

  it('a hip slopes down to the end edge with the same shape as the sides', () => {
    const oh = roof(3);
    const H = ohH(oh, [3, 5]);
    expect(ohH(oh, [3, 0])).toBeCloseTo(0, 6);
    expect(ohH(oh, [3, 1.5])).toBeCloseTo(H / 2, 6);
    expect(ohH(oh, [3, 5])).toBeCloseTo(H, 6);
    // the hip line: equal heights where the end slope meets the side slope
    expect(ohH(oh, [1, 1])).toBeCloseTo(ohH(oh, [1, 5]) > 0 ? Math.min(ohH(oh, [1, 5]), ohH(oh, [3, 1])) : 0, 6);
  });

  it('all the way in, it is a pyramid; more is clamped', () => {
    const oh = roof(99);
    expect(ohFrame(oh).hip).toBeCloseTo(5, 6);
    expect(ohH(oh, [3, 5])).toBeGreaterThan(0);
    expect(ohH(oh, [3, 2.5])).toBeCloseTo(ohH(oh, [3, 5]) / 2, 6);
  });

  it('the roof surface covers the whole outline, hipped or not', () => {
    for (const h of [0, 2, 3, 99]) {
      const m = buildOverhead(roof(h), []);
      // projected area of the near-horizontal-ish top faces (skip the vertical fascia)
      let A = 0;
      const P = m.top.pos;
      for (let i = 0; i < P.length; i += 9) {
        const a = Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
        A += a;
      }
      expect(A).toBeCloseTo(60, 1);
    }
  });

  it('stays whole for an outline around the origin with a turned span (near-coincident edges)', () => {
    const oh = {
      id: 'h', kind: 'overhead', name: 'Roof', baseY: 3, dir: Math.PI / 2, form: 'extrude', thick: 0.25, restsOn: null, restOffset: 0, fit: null, hip: 2.5, order: 1,
      outline: [[-4.42, -3.42], [7.42, -3.42], [7.42, 3.42], [-4.42, 3.42]],
      profile: [{ u: 0, h: 0, crease: true, id: 'a' }, { u: 0.5, h: 2.6, crease: true, id: 'b' }, { u: 1, h: 0, crease: true, id: 'c' }],
    } as any;
    const P = buildOverhead(oh, []).top.pos;
    let A = 0;
    for (let i = 0; i < P.length; i += 9) A += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
    expect(A).toBeCloseTo(11.84 * 6.84, 1);
  });

  it('a curved, hipped roof stays whole and light', () => {
    const v = { ...roof(2), profile: presetProfile('vault', 6) };
    const m = buildOverhead(v, []);
    const P = m.top.pos;
    let A = 0;
    for (let i = 0; i < P.length; i += 9) A += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
    expect(A).toBeCloseTo(60, 1);
    expect(P.length / 9).toBeLessThan(6000);
  });
});
