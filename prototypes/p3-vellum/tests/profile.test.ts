import { describe, it, expect } from 'vitest';
import { presetProfile, moveProfilePoint, bendProfile, insertProfilePoint, removeProfilePoint, setCrease, sampleProfile, profileH, withIds } from '../src/model/overheadGeom';
import { fitProfile } from '../src/model/strokes';
import { emptyProject } from '../src/model/types';
import { runTxn, opAddOverhead, opOverhead } from '../src/model/ops';

const H = (pts: ReturnType<typeof presetProfile>, u: number) => profileH(sampleProfile(pts), u);

describe('one authored roof profile', () => {
  it('every point has a stable identity, from presets, drawings and old saves', () => {
    for (const k of ['flat', 'gable', 'vault', 'clerestory', 'sawtooth'] as const) {
      const pr = presetProfile(k, 10);
      expect(new Set(pr.map((q) => q.id)).size).toBe(pr.length);
    }
    const drawn = fitProfile([[0, 0], [0.5, 3], [1, 0]], 10);
    expect(drawn.every((q) => q.id)).toBe(true);
    const old = withIds([{ u: 0, h: 0, crease: true }, { u: 1, h: 0, crease: true, id: 'keep' }]);
    expect(old[1].id).toBe('keep');
    expect(old[0].id).toBeTruthy();
  });

  it('moving a point keeps every identity, and only that point moves', () => {
    const g = presetProfile('gable', 10);
    const m = moveProfilePoint(g, g[1].id!, 0.4, 3.2);
    expect(m.map((q) => q.id)).toEqual(g.map((q) => q.id));
    expect(m[1]).toMatchObject({ u: 0.4, h: 3.2 });
    expect(m[0]).toEqual(g[0]);
    expect(m[2]).toEqual(g[2]);
  });

  it('a point cannot pass its neighbours, the ends stay at the eave edges, heights stay above the eave', () => {
    const g = presetProfile('gable', 10);
    expect(moveProfilePoint(g, g[1].id!, 1.5, 2)[1].u).toBe(1);
    expect(moveProfilePoint(g, g[0].id!, 0.3, 1)[0].u).toBe(0);
    expect(moveProfilePoint(g, g[1].id!, 0.5, -3)[1].h).toBe(0);
  });

  it('the two points of a step move together, so it stays vertical', () => {
    const c = presetProfile('clerestory', 10);
    const m = moveProfilePoint(c, c[1].id!, 0.4, c[1].h);
    expect(m[1].u).toBeCloseTo(0.4, 9);
    expect(m[2].u).toBeCloseTo(0.4, 9);
  });

  it('bending the curve moves its points, adds none, and the curve under the pen follows exactly', () => {
    const v = presetProfile('vault', 10);
    const u = 0.32;
    const before = H(v, u);
    const b = bendProfile(v, u, 0.8);
    expect(b.length).toBe(v.length);
    expect(b.map((q) => q.id)).toEqual(v.map((q) => q.id));
    expect(b.map((q) => q.u)).toEqual(v.map((q) => q.u));
    expect(H(b, u)).toBeCloseTo(before + 0.8, 3);
    // the eave ends never move
    expect(b[0].h).toBe(0);
    expect(b[b.length - 1].h).toBe(0);
    // smooth fall-off: the near point moves more than the far one
    expect(b[1].h - v[1].h).toBeGreaterThan(b[3].h - v[3].h);
  });

  it('bending stops at creases and keeps them sharp', () => {
    const pr = withIds([
      { u: 0, h: 0, crease: true },
      { u: 0.2, h: 1, crease: false },
      { u: 0.4, h: 1.5, crease: true },
      { u: 0.7, h: 1.2, crease: false },
      { u: 1, h: 0, crease: true },
    ]);
    const b = bendProfile(pr, 0.15, 0.5);
    expect(b[3].h).toBe(pr[3].h); // beyond the crease: untouched
    expect(b.map((q) => q.crease)).toEqual(pr.map((q) => q.crease));
    expect(H(b, 0.15)).toBeCloseTo(H(pr, 0.15) + 0.5, 3);
  });

  it('bending keeps steps vertical', () => {
    const c = presetProfile('clerestory', 10);
    const b = bendProfile(c, 0.8, 0.4);
    expect(b[1].u).toBe(b[2].u);
    expect(b.map((q) => q.u)).toEqual(c.map((q) => q.u));
  });

  it('adding a point is explicit, lands on the curve, and leaves a straight run straight', () => {
    const g = presetProfile('gable', 10);
    const { profile, id } = insertProfilePoint(g, 0.25);
    expect(profile.length).toBe(4);
    const q = profile.find((x) => x.id === id)!;
    expect(q.h).toBeCloseTo(H(g, 0.25), 6);
    for (const u of [0.1, 0.2, 0.3, 0.45, 0.7]) expect(H(profile, u)).toBeCloseTo(H(g, u), 3);
  });

  it('removing a point keeps the eave ends', () => {
    const g = presetProfile('gable', 10);
    expect(removeProfilePoint(g, g[1].id!).length).toBe(2);
    expect(removeProfilePoint(g, g[0].id!)).toBe(g);
    expect(setCrease(g, g[1].id!, false)[1].crease).toBe(false);
  });

  it('an edit is one transaction on the overhead and keeps the identities through it', () => {
    let p = runTxn(emptyProject(), opAddOverhead([[0, 0], [10, 0], [10, 6], [0, 6]], 3, {})).after;
    const oh = p.overheads[0];
    const ids = oh.profile.map((q) => q.id);
    expect(ids.every(Boolean)).toBe(true);
    const bent = bendProfile(presetProfile('gable', 10).map((q, i) => ({ ...q, id: ids[i] ?? q.id })), 0.3, 0.5);
    p = runTxn(p, opOverhead(oh.id, { profile: bent })).after;
    expect(p.overheads[0].profile.map((q) => q.id)).toEqual(bent.map((q) => q.id));
  });
});
