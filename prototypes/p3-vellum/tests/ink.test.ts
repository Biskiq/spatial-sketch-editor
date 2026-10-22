import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import type { V2 } from '../src/model/geom2d';
import { dot, dist, distToPolyEdge, pointInPoly } from '../src/model/geom2d';
import { runTxn, opAddOverhead, opOverhead } from '../src/model/ops';
import { ohFrame, ohH, presetProfile, profileH, hipH, profilePeak } from '../src/model/overheadGeom';
import type { MPoly } from '../src/model/clip';
import { buildOverhead } from '../src/scene/build/overheads';
import { roofInk, type InkFacet } from '../src/scene/build/roofInk';
import { roofWingsState } from '../src/model/wings';

const RECT: V2[] = [[0, 0], [6, 0], [6, 10], [0, 10]];
const L: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 14], [0, 14]];
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

type Preset = Parameters<typeof presetProfile>[0];
function roof(outline: V2[], preset: Preset, extra: { hip?: number; span?: number; oneSpan?: boolean } = {}) {
  let p: Project = emptyProject();
  p = runTxn(p, opAddOverhead(outline, 3, {
    preset, form: preset === 'dome' ? 'revolve' : 'extrude',
    profile: presetProfile(preset, extra.span ?? 6), oneSpan: extra.oneSpan,
  })).after;
  if (extra.hip !== undefined) p = runTxn(p, opOverhead(p.overheads[0].id, { hip: extra.hip })).after;
  return p.overheads[0];
}

interface Seg { a: [number, number, number]; b: [number, number, number] }
const pairs = (ink: number[]): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i + 5 < ink.length; i += 6) out.push({ a: [ink[i], ink[i + 1], ink[i + 2]], b: [ink[i + 3], ink[i + 4], ink[i + 5]] });
  return out;
};
const plan = (q: [number, number, number] | [number, number]): V2 => [q[0], q[1]] as V2;
const midOf = (s: Seg): V2 => [(s.a[0] + s.b[0]) / 2, (s.a[2] + s.b[2]) / 2];
const vertical = (s: Seg) => Math.abs(s.a[0] - s.b[0]) < 1e-9 && Math.abs(s.a[2] - s.b[2]) < 1e-9 && Math.abs(s.a[1] - s.b[1]) > 1e-6;

/**
 * Ink is the boundaries between regions that mean different things. These fixtures hold it to that: the lines are
 * where a roof changes meaning (ridge, hip, step, edge), they follow the real surface (a curve is not chorded into a
 * stray mesh edge), and the roof's own triangle seams never appear.
 */
describe('ink from meaning', () => {
  it('draws only the ridge and the edges of a gable', () => {
    const oh = roof(RECT, 'gable');
    const f = ohFrame(oh);
    const wr = f.wmin + profilePeak(oh.profile).u * (f.wmax - f.wmin);
    const P = pairs(buildOverhead(oh, []).ink);
    expect(P.length).toBeGreaterThan(0);
    for (const s of P) {
      const m = midOf(s);
      const onOutline = distToPolyEdge(m, oh.outline) < 0.01;
      const onRidge = Math.abs(dot(m, f.d) - wr) < 1e-6;
      expect(onOutline || onRidge || vertical(s)).toBe(true);
    }
    // the ridge is drawn, once, on the surface
    const ridge = P.filter((s) => Math.abs(dot(midOf(s), f.d) - wr) < 1e-6 && !vertical(s));
    expect(ridge.length).toBeGreaterThan(0);
    for (const s of ridge) expect(s.a[1]).toBeCloseTo(3 + oh.thick + profilePeak(oh.profile).h, 6);
  });

  it('leaves a curved vault without interior lines', () => {
    const oh = roof(RECT, 'vault');
    const P = pairs(buildOverhead(oh, []).ink);
    expect(P.length).toBeGreaterThan(0); // its edge is still a line
    for (const s of P) {
      const inside = (q: [number, number, number]) => distToPolyEdge(plan([q[0], q[2]]), oh.outline) > 0.05;
      expect(inside(s.a) && inside(s.b)).toBe(false);
    }
  });

  it('draws the ridge and the hips of a hipped gable, where the two heights agree', () => {
    const oh = roof(RECT, 'gable', { hip: 3 });
    const f = ohFrame(oh);
    const wr = f.wmin + profilePeak(oh.profile).u * (f.wmax - f.wmin);
    const P = pairs(buildOverhead(oh, []).ink);
    let interior = 0;
    for (const s of P) {
      const m = midOf(s);
      if (distToPolyEdge(m, oh.outline) < 0.02 || vertical(s)) continue;
      interior++;
      const w = dot(m, f.d), v = dot(m, [-f.d[1], f.d[0]]);
      const u = (w - f.wmin) / (f.wmax - f.wmin);
      const cross = profileH(f.samples, Math.max(0, Math.min(1, u)));
      const end = hipH(f, v);
      expect(Math.abs(w - wr) < 1e-6 || Math.abs(cross - end) < 1e-5).toBe(true);
    }
    expect(interior).toBeGreaterThan(0);
  });

  it('draws a step at both of its heights', () => {
    const oh = roof(rect(0, 0, 8, 10), 'clerestory', { span: 8 });
    const f = ohFrame(oh);
    const stepW = f.wmin + 0.55 * (f.wmax - f.wmin);
    const lo = 3 + oh.thick + presetProfile('clerestory', 8)[1].h;
    const hi = 3 + oh.thick + presetProfile('clerestory', 8)[2].h;
    const P = pairs(buildOverhead(oh, []).ink);
    const step = P.filter((s) => {
      const m = midOf(s);
      return !vertical(s) && distToPolyEdge(m, oh.outline) > 0.02 && Math.abs(dot(m, f.d) - stepW) < 1e-6;
    });
    expect(step.length).toBeGreaterThan(1);
    expect(step.some((s) => Math.abs(s.a[1] - lo) < 1e-6)).toBe(true);
    expect(step.some((s) => Math.abs(s.a[1] - hi) < 1e-6)).toBe(true);
    // and nothing else is drawn inside the roof
    for (const s of P) {
      const m = midOf(s);
      if (distToPolyEdge(m, oh.outline) < 0.02 || vertical(s)) continue;
      expect(Math.abs(dot(m, f.d) - stepW)).toBeLessThan(1e-6);
    }
  });

  it('draws rings, never meridians, on a dome', () => {
    const oh = roof(rect(0, 0, 8, 8), 'dome', { span: 8 });
    const c = ohFrame(oh).center;
    const P = pairs(buildOverhead(oh, []).ink);
    expect(P.length).toBeGreaterThan(0);
    for (const s of P) {
      expect(Math.abs(s.a[1] - s.b[1])).toBeLessThan(1e-9);
      expect(Math.abs(dist([s.a[0], s.a[2]], c) - dist([s.b[0], s.b[2]], c))).toBeLessThan(0.01);
    }
  });

  it('follows a curved surface instead of chording it, with every line drawn once', () => {
    const oh = roof(RECT, 'vault', { hip: 2 });
    const P = pairs(buildOverhead(oh, []).ink);
    expect(P.length).toBeGreaterThan(0);
    for (const s of P) {
      for (const q of [s.a, s.b]) {
        const h = ohH(oh, plan([q[0], q[2]]));
        expect(Math.abs(q[1] - (3 + oh.thick + h)) < 0.035 || Math.abs(q[1] - (3 + h)) < 0.035).toBe(true);
      }
    }
    const seen = new Set<string>();
    for (const s of P) {
      const k = [s.a, s.b]
        .map((q) => q.map((x) => Math.round(x * 1e3)).join(','))
        .sort()
        .join('|');
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('covers a compound roof without a seam where two wings are coplanar', () => {
    const oh = roof(L, 'gable', { span: 6, oneSpan: false });
    expect(roofWingsState(oh).kind).toBe('compound');
    const P = pairs(buildOverhead(oh, []).ink);
    expect(P.length).toBeGreaterThan(0);
    for (const s of P) {
      for (const q of [s.a, s.b]) {
        const h = ohH(oh, plan([q[0], q[2]]));
        expect(Math.abs(q[1] - (3 + oh.thick + h)) < 0.035 || Math.abs(q[1] - (3 + h)) < 0.035).toBe(true);
      }
    }
  });
});

describe('roofInk', () => {
  const plane = (base: number) => (p: V2) => base + 0.1 * p[0] - 0.05 * p[1];
  const piece = (group: string, x0: number, z0: number, x1: number, z1: number, y: (p: V2) => number): InkFacet => ({
    group,
    poly: [[rect(x0, z0, x1, z1)]],
    y,
  });
  const br = { d: [1, 0] as V2, e: [0, 1] as V2, ws: [0, 4], vs: [0, 2] };
  const atSeam = (ink: number[], yMin: number) =>
    pairs(ink).filter((s) => Math.abs(s.a[0] - 2) < 1e-6 && Math.abs(s.b[0] - 2) < 1e-6 && Math.min(s.a[1], s.b[1]) > yMin);

  it('does not draw a seam between two groups that are one plane', () => {
    const foot: MPoly = [[rect(0, 0, 4, 2)]];
    const ink = roofInk([piece('a', 0, 0, 2, 2, plane(2)), piece('b', 2, 0, 4, 2, plane(2))], br, () => 1.75, foot, 0.25);
    expect(ink.length).toBeGreaterThan(0);
    expect(atSeam(ink, 1.9)).toHaveLength(0);
  });

  it('keeps both heights where two groups step', () => {
    const foot: MPoly = [[rect(0, 0, 4, 2)]];
    const lower = plane(2), upper = plane(2.5);
    const ink = roofInk([piece('a', 0, 0, 2, 2, lower), piece('b', 2, 0, 4, 2, upper)], br, () => 1.75, foot, 0.25);
    const seam = atSeam(ink, 1.9);
    expect(seam.length).toBeGreaterThan(0);
    const on = (y: (p: V2) => number) =>
      seam.filter((s) => [s.a, s.b].every((q) => Math.abs(q[1] - y([q[0], q[2]])) < 1e-9)).length;
    expect(on(lower)).toBe(4); // the lower part's edge at the step
    expect(on(upper)).toBe(4); // and the upper part's: a step keeps both its heights
  });

  it('outlines a hole and never chords across it', () => {
    const hole = rect(1.5, 0.7, 2.5, 1.3);
    const foot: MPoly = [[rect(0, 0, 4, 2), hole]];
    const ink = roofInk([piece('a', 0, 0, 4, 2, plane(2))], br, () => 1.75, foot, 0.25);
    const P = pairs(ink);
    expect(P.some((s) => distToPolyEdge(midOf(s), hole) < 0.01)).toBe(true);
    for (const s of P) {
      const m = midOf(s);
      expect(pointInPoly(m, hole) && distToPolyEdge(m, hole) > 0.01).toBe(false);
    }
  });
});
