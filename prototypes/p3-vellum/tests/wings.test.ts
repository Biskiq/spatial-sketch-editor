import { describe, it, expect } from 'vitest';
import { emptyProject, Project, Overhead } from '../src/model/types';
import { runTxn, opAddRun, opAddOverhead, opOverhead, opMoveNode, opCoverRooms } from '../src/model/ops';
import { fittedOutline } from '../src/model/fit';
import { presetProfile, ohH, ohSpan, ohRidge, ohFrame } from '../src/model/overheadGeom';
import { roofWingsState, roofWings, continuedWings } from '../src/model/wings';
import { V2, bbox, pointInPoly, polyArea, distToPolyEdge, fromAngle } from '../src/model/geom2d';
import { derive } from '../src/model/derive';
import type { StrokeFit } from '../src/model/strokes';
import { buildOverhead } from '../src/scene/build/overheads';

const poly = (pts: V2[], closed = true): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** L: a 10 × 6 room with a 4 × 8 wing on its long north wall. */
const L = { A: [0, 0, 10, 6] as const, B: [6, 6, 10, 14] as const };
/** T: an 11 × 5 bar with a 4 × 7 stem. */
const T = { A: [0, 0, 11, 5] as const, B: [3.5, 5, 7.5, 12] as const };
/** U: an 11 × 5 bar with two 4 × 6 arms. */
const U = { A: [0, 0, 11, 5] as const, B: [0, 5, 4, 11] as const, C: [7, 5, 11, 11] as const };
/** Plus: two crossing bars. */
const PLUS = { A: [0, 2, 12, 7] as const, B: [4, 0, 9, 12] as const };

function outlineOf(rects: readonly (readonly [number, number, number, number])[], overhang = 0.45): V2[] {
  const ol = fittedOutline(rects.map((r) => rect(r[0], r[1], r[2], r[3])), overhang);
  if (!ol) throw new Error('no outline');
  return ol;
}

function roofOn(outline: V2[], o: { preset?: 'gable' | 'vault'; hip?: number; dir?: number; baseY?: number } = {}): Project {
  // a section must already qualify before its span can be read, so start from a gable on a guessed span and then
  // rebuild the profile on the span the decomposition actually gives the shared section
  const guess = Math.min(...extentAlong(outline));
  let p = runTxn(emptyProject(), opAddOverhead(outline, o.baseY ?? 3, { dir: o.dir, oneSpan: false, profile: presetProfile('gable', guess) })).after;
  const oh = p.overheads[0];
  const st = roofWingsState(oh);
  const span = st.kind === 'compound' ? st.primarySpan : ohSpan(oh);
  p = runTxn(p, opOverhead(oh.id, { profile: presetProfile(o.preset ?? 'gable', span), hip: o.hip ?? 0 })).after;
  return p;
}

function extentAlong(outline: V2[]): [number, number] {
  const d = fromAngle(spanDirOf(outline));
  let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
  for (const p of outline) {
    const w = p[0] * d[0] + p[1] * d[1], v = -p[0] * d[1] + p[1] * d[0];
    lo = Math.min(lo, w); hi = Math.max(hi, w); lo2 = Math.min(lo2, v); hi2 = Math.max(hi2, v);
  }
  return [hi - lo, hi2 - lo2];
}

const spanDirOf = (outline: V2[]) => {
  let best = 0, bl = -1;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > bl) { bl = L; best = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  return best + Math.PI / 2;
};

const oh0 = (p: Project): Overhead => p.overheads[0];

/** The projected top area from the mesh, the same method hip.test.ts uses. */
function meshArea(oh: Overhead) {
  const P = buildOverhead(oh, []).top.pos;
  let A = 0;
  for (let i = 0; i < P.length; i += 9)
    A += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
  return A;
}

describe('Phase 0 · compound roof feasibility', () => {
  it('decomposes an L into two perpendicular wings, each on the fitted outline', () => {
    const p = roofOn(outlineOf([L.A, L.B]));
    const st = roofWingsState(oh0(p));
    expect(st.kind).toBe('compound');
    if (st.kind !== 'compound') return;
    expect(st.wings.length).toBe(2);
    expect(new Set(st.wings.map((w) => w.span)).size).toBe(2);
    // every eave edge parallel to a wing's ridge sits at height 0
    const oh = oh0(p);
    const f = ohFrame(oh);
    const e = [-f.d[1], f.d[0]] as V2;
    for (const wg of st.wings) {
      const [w0, w1, v0, v1] = wg.rect;
      const pts: V2[] = wg.span === 'w'
        ? [[w0, v0], [w0, v1], [w1, v0], [w1, v1]]
        : [[w0, v0], [w1, v0], [w0, v1], [w1, v1]];
      for (const [w, v] of pts) {
        const q: V2 = [f.d[0] * w + e[0] * v, f.d[1] * w + e[1] * v];
        const onFoot = oh.outline.some((_, i) => {
          const a = oh.outline[i], b = oh.outline[(i + 1) % oh.outline.length];
          const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / Math.max(1e-9, (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
          return Math.hypot(a[0] + (b[0] - a[0]) * t - q[0], a[1] + (b[1] - a[1]) * t - q[1]) < 0.02;
        });
        if (onFoot) expect(ohH(oh, q)).toBeLessThan(0.01);
      }
    }
  });

  it('T, U and plus plans decompose into 2, 3 and 3 wings (the plus cross wing is split where it meets the bar)', () => {
    const counts = [T, U, PLUS].map((plan) => {
      const p = roofOn(outlineOf(Object.values(plan) as any));
      const st = roofWingsState(oh0(p));
      return st.kind === 'compound' ? st.wings.length : -1;
    });
    expect(counts).toEqual([2, 3, 3]);
  });

  it('the mesh covers the outline once and agrees with the height evaluator at joins and valleys', () => {
    for (const plan of [L, T, U, PLUS]) {
      const p = roofOn(outlineOf(Object.values(plan) as any));
      const oh = oh0(p);
      const m = buildOverhead(oh, []);
      const foot = Math.abs(polyArea(oh.outline));
      expect(meshArea(oh)).toBeCloseTo(foot, 1);
      const probe = meshProbe(m);
      let worst = 0;
      const b = bbox(oh.outline);
      for (let x = b.min[0] + 0.137; x < b.max[0]; x += 0.31)
        for (let z = b.min[1] + 0.211; z < b.max[1]; z += 0.29) {
          const q: V2 = [x, z];
          if (!pointInPoly(q, oh.outline)) continue;
          const y = probe(x, z);
          if (y === null) continue;
          worst = Math.max(worst, Math.abs(y - (oh.baseY + oh.thick + ohH(oh, q))));
        }
      expect(worst).toBeLessThan(0.005);
    }
  });
});

/** A height-sampling view of a mesh's top faces: the tallest top face over each plan point. */
function meshProbe(m: ReturnType<typeof buildOverhead>) {
  const P = m.top.pos;
  const tris: { a: V2; b: V2; c: V2; ya: number; yb: number; yc: number }[] = [];
  for (let i = 0; i < P.length; i += 9) {
    const a: V2 = [P[i], P[i + 2]], b: V2 = [P[i + 3], P[i + 5]], c: V2 = [P[i + 6], P[i + 8]];
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
    if (area2 < 1e-9) continue;
    tris.push({ a, b, c, ya: P[i + 1], yb: P[i + 4], yc: P[i + 7] });
  }
  return (x: number, z: number): number | null => {
    let best: number | null = null;
    for (const t of tris) {
      const d = (t.b[0] - t.a[0]) * (t.c[1] - t.a[1]) - (t.c[0] - t.a[0]) * (t.b[1] - t.a[1]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((t.b[0] - x) * (t.c[1] - z) - (t.c[0] - x) * (t.b[1] - z)) / d;
      const l2 = ((t.c[0] - x) * (t.a[1] - z) - (t.a[0] - x) * (t.c[1] - z)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
      const y = l1 * t.ya + l2 * t.yb + l3 * t.yc;
      if (best === null || y > best) best = y;
    }
    return best;
  };
}

describe('Phase 0 · fitted outline, hips, slopes and resize', () => {
  const planOf = (overhang: number, wing = 4) => outlineOf([L.A, [6, 6, 6 + wing, 14] as const], overhang);

  it('stays compound, continuous and eave-true at every fitted overhang', () => {
    for (const overhang of [0.3, 0.45, 0.6, 0.9]) {
      const p = roofOn(planOf(overhang));
      const oh = oh0(p);
      const st = roofWingsState(oh);
      expect(st.kind).toBe('compound');
      expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
      const probe = meshProbe(buildOverhead(oh, []));
      for (const q of eavePoints(oh)) expect(ohH(oh, q)).toBeLessThan(0.005);
      for (const q of eavePoints(oh, 0.02)) {
        if (ohH(oh, q) >= 0.02) {
          const s2 = roofWingsState(oh);
          throw new Error(`overhang ${overhang}: ${ohH(oh, q)} at ${q} of ${JSON.stringify(oh.outline)} wings ${JSON.stringify(s2)}
profile ${JSON.stringify(oh.profile)}`);
        }
        expect(probe(q[0], q[1])!).toBeCloseTo(oh.baseY + oh.thick, 1);
      }
    }
  });

  it('hips the exposed ends of each wing and never the joined ones', () => {
    for (const hip of [1, 2, 3.5]) {
      const p = roofOn(planOf(0.45), { hip });
      const oh = oh0(p);
      const st = roofWingsState(oh);
      if (st.kind !== 'compound') throw new Error(st.kind === 'unsupported' ? st.reason : 'single span');
      const joined = st.wings.flatMap((w) => [w.ends.lo, w.ends.hi].filter((e) => e === 'joined'));
      expect(joined.length).toBeGreaterThan(0);
      for (const w of st.wings) {
        if (w.ends.lo === 'joined') expect(w.hipLo).toBe(0);
        if (w.ends.hi === 'joined') expect(w.hipHi).toBe(0);
      }
      expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
      const probe = meshProbe(buildOverhead(oh, []));
      const b = bbox(oh.outline);
      let worst = 0;
      for (let x = b.min[0] + 0.13; x < b.max[0]; x += 0.37)
        for (let z = b.min[1] + 0.19; z < b.max[1]; z += 0.33) {
          const q: V2 = [x, z];
          if (!pointInPoly(q, oh.outline)) continue;
          const y = probe(x, z);
          if (y !== null) worst = Math.max(worst, Math.abs(y - (oh.baseY + oh.thick + ohH(oh, q))));
        }
      expect(worst).toBeLessThan(0.005);
    }
  });

  it('keeps wings at the same pitch when their widths are unequal', () => {
    for (const [a, c] of [[4, 4], [3, 5], [5, 3]] as const) {
      const ol = outlineOf([U.A, [0, 5, a, 11] as const, [11 - c, 5, 11, 11] as const]);
      const p = roofOn(ol);
      const st = roofWingsState(oh0(p));
      if (st.kind !== 'compound') throw new Error(st.kind === 'unsupported' ? st.reason : 'single span');
      // one section, scaled by span: every wing's pitch, ridge height / span, is the same
      const slopes = st.wings.map((w) => {
        const span = w.span === 'w' ? w.rect[1] - w.rect[0] : w.rect[3] - w.rect[2];
        const mid = w.span === 'w'
          ? [(w.rect[0] + w.rect[1]) / 2, (w.rect[2] + w.rect[3]) / 2]
          : [(w.rect[0] + w.rect[1]) / 2, (w.rect[2] + w.rect[3]) / 2];
        const q: V2 = [mid[0], mid[1]];
        return { span, h: ohH(oh0(p), q) };
      });
      const f = ohFrame(oh0(p));
      void f;
      for (let i = 1; i < slopes.length; i++) expect(slopes[i].h / slopes[i].span).toBeCloseTo(slopes[0].h / slopes[0].span, 5);
      expect(meshArea(oh0(p))).toBeCloseTo(Math.abs(polyArea(oh0(p).outline)), 1);
    }
  });

  it('is unchanged by a reversed or cycled outline, and by the ridge orientation', () => {
    const ol = planOf(0.45);
    const a = roofOn(ol);
    const b = roofOn(ol.slice().reverse());
    const c = roofOn([...ol.slice(2), ...ol.slice(0, 2)]);
    const sig = (p: Project) => {
      const st = roofWingsState(oh0(p));
      if (st.kind !== 'compound') return st.kind;
      return JSON.stringify(st.wings.map((w) => [w.rect.map((x) => Math.round(x * 1000)), w.span, Math.round(w.scale * 1e6)]));
    };
    expect(sig(b)).toBe(sig(a));
    expect(sig(c)).toBe(sig(a));
    // turning the ridge 90° gives the other decomposition, still continuous
    const turned = roofOn(ol, { dir: ohFrame(oh0(a)).d[1] === 0 ? Math.PI / 2 : 0 });
    expect(roofWingsState(oh0(turned)).kind).toBe('compound');
    expect(meshArea(oh0(turned))).toBeCloseTo(Math.abs(polyArea(oh0(turned).outline)), 1);
  });

  it('keeps a fuller (bowed) section continuous', () => {
    const p0 = roofOn(outlineOf([L.A, L.B]));
    const oh = oh0(p0);
    const prof = oh.profile;
    // bow both slopes, the way a Hold shoulder pull does
    const bowed = [{ ...prof[0], h: 0 }, { ...prof[1], u: 0.3, h: prof[1].h * 0.62, crease: false }, { ...prof[1], u: 0.7, h: prof[1].h * 0.62, crease: false }, { ...prof[2], u: 1, h: 0 }];
    const p = runTxn(p0, opOverhead(oh.id, { profile: bowed })).after;
    const st = roofWingsState(oh0(p));
    expect(st.kind).toBe('compound');
    const m = buildOverhead(oh0(p), []);
    expect(meshArea(oh0(p))).toBeCloseTo(Math.abs(polyArea(oh0(p).outline)), 1);
    const probe = meshProbe(m);
    const b = bbox(oh0(p).outline);
    let worst = 0;
    for (let x = b.min[0] + 0.11; x < b.max[0]; x += 0.29)
      for (let z = b.min[1] + 0.17; z < b.max[1]; z += 0.27) {
        const q: V2 = [x, z];
        if (!pointInPoly(q, oh0(p).outline)) continue;
        const y = probe(x, z);
        if (y !== null) worst = Math.max(worst, Math.abs(y - (oh0(p).baseY + oh0(p).thick + ohH(oh0(p), q))));
      }
    expect(worst).toBeLessThan(0.005);
  });

  it('follows a resized wing without ever covering it twice', () => {
    let p = runTxn(emptyProject(), opAddRun(poly(rect(0, 0, 10, 6)), { baseY: 0 })).after;
    p = runTxn(p, opAddRun(poly([[10, 6], [10, 14], [6, 14], [6, 6]], false), { baseY: 0 })).after;
    expect(Object.keys((p as any).runs).length).toBe(2);
    const d = derive(p);
    expect(d.rooms.length).toBe(2);
    p = runTxn(p, opCoverRooms(d.rooms.map((r) => r.id), 'gable')).after;
    const ohId = p.overheads[0].id;
    const primary = (() => {
      const st = roofWingsState({ ...p.overheads[0], oneSpan: false } as Overhead);
      return st.kind === 'compound' ? st.primarySpan : ohSpan(p.overheads[0]);
    })();
    p = runTxn(p, opOverhead(ohId, { oneSpan: false, profile: presetProfile('gable', primary) })).after;
    expect(roofWingsState(p.overheads[0]).kind).toBe('compound');

    // grow the wing wider and longer: the fitted outline follows, and the decomposition stays continuous
    const wingRun = p.runs[1];
    p = runTxn(p, opMoveNode(wingRun.id, 1, [10, 16], 'keep')).after;
    p = runTxn(p, opMoveNode(wingRun.id, 2, [5, 16], 'keep')).after;
    p = runTxn(p, opMoveNode(wingRun.id, 3, [5, 6], 'keep')).after;
    const oh = p.overheads[0];
    const st = roofWingsState(oh);
    if (st.kind !== 'compound') throw new Error(`after resize: ${st.kind} ${st.kind === 'unsupported' ? st.reason : ''} outline ${JSON.stringify(oh.outline)}`);
    expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
    // the wider wing still shares the section's pitch
    const widths = st.wings.map((w) => (w.span === 'w' ? w.rect[1] - w.rect[0] : w.rect[3] - w.rect[2]));
    for (let i = 1; i < st.wings.length; i++) expect(st.wings[i].scale).toBeCloseTo(widths[i] / widths[0], 6);
    // changing the overhang keeps it fitting, with the eaves still at 0
    p = runTxn(p, opOverhead(oh.id, { fit: { ...oh.fit!, overhang: 0.8 } })).after;
    const oh2 = p.overheads[0];
    expect(roofWingsState(oh2).kind).toBe('compound');
    for (const q of eavePoints(oh2)) expect(ohH(oh2, q)).toBeLessThan(0.01);
    // and the old single-span choice survives a reload unchanged
    const old = { ...oh2, oneSpan: undefined } as Overhead;
    expect(roofWingsState(old).kind).toBe('single');
    expect(meshArea(old)).toBeCloseTo(Math.abs(polyArea(old.outline)), 1);
  });
});

/** Points a centimetre inside every wing's eave edges (the edges parallel to that wing's ridge). */
function eavePoints(oh: Overhead, inset = 0): V2[] {
  const st = roofWingsState(oh);
  if (st.kind !== 'compound') return [];
  const f = ohFrame(oh);
  const d = f.d, e: V2 = [-d[1], d[0]];
  const out: V2[] = [];
  for (const wg of st.wings) {
    const [w0, w1, v0, v1] = wg.rect;
    const spanW = wg.span === 'w';
    const s0 = spanW ? w0 : v0, s1 = spanW ? w1 : v1;
    const r0 = spanW ? v0 : w0, r1 = spanW ? v1 : w1;
    for (const [s, inward] of [[s0, 1], [s1, -1]] as const) {
      for (let k = 1; k <= 7; k++) {
        const r = r0 + ((r1 - r0) * k) / 8;
        const w = spanW ? s + inward * inset : r;
        const v = spanW ? r : s + inward * inset;
        const q: V2 = [d[0] * w + e[0] * v, d[1] * w + e[1] * v];
        // only where that eave is the roof's own edge; inside another wing the edge is buried
        if (distToPolyEdge(q, oh.outline) < Math.max(0.02, inset + 0.01)) out.push(q);
      }
    }
  }
  return out;
}

describe('Phase 0 · what the candidate refuses, and why', () => {
  it('refuses plans and sections outside the qualified set with a plain reason', () => {
    // a plan with an edge that is neither of the frame's two directions (a slanted wing)
    const slanted: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 10], [4.6, 9.2], [4.6, 6], [0, 6]];
    const comb = outlineOf([
      [0, 0, 10, 2],
      [0, 2, 1.4, 8],
      [2.6, 2, 4, 8],
      [5.2, 2, 6.6, 8],
      [7.8, 2, 9.2, 8],
    ]);
    const cases: { outline: V2[]; profile?: Parameters<typeof presetProfile>[0]; label: RegExp }[] = [
      { outline: slanted, label: /2°/ },
      { outline: comb, label: /wings/ },
      { outline: outlineOf([L.A, L.B]), profile: 'clerestory', label: /step|compound/ },
    ];
    for (const c of cases) {
      let p = runTxn(emptyProject(), opAddOverhead(c.outline, 3, { oneSpan: false, profile: presetProfile(c.profile ?? 'gable', 6) })).after;
      const st = roofWingsState(p.overheads[0]);
      expect(st.kind).toBe('unsupported');
      if (st.kind === 'unsupported') expect(st.reason).toMatch(c.label);
    }
    // an asymmetric section (a saltbox) is not yet a compound candidate
    const ol = outlineOf([L.A, L.B]);
    let p = runTxn(emptyProject(), opAddOverhead(ol, 3, { oneSpan: false, profile: presetProfile('gable', 6) })).after;
    const asym = p.overheads[0].profile.map((q, i) => (i === 1 ? { ...q, u: 0.32 } : q));
    p = runTxn(p, opOverhead(p.overheads[0].id, { profile: asym })).after;
    const st = roofWingsState(p.overheads[0]);
    expect(st.kind).toBe('unsupported');
    if (st.kind === 'unsupported') expect(st.reason).toMatch(/symmetric/);
  });

  it('refuses a wing wider than the roof it runs into rather than closing a cliff with a seam', () => {
    // a long narrow main block (20 × 4) with a 5 m wide, 8 m deep wing running into it at right angles: the wing's
    // scaled peak is above the roof it joins, so the join has no continuous end
    const ol = outlineOf([[0, 0, 20, 4], [7, 4, 12, 12]]);
    const p = roofOn(ol);
    const st = roofWingsState(oh0(p));
    if (st.kind !== 'unsupported') throw new Error(JSON.stringify(st));
    expect(st.reason).toMatch(/higher roof/);
  });

  it('keeps a wall move under the tolerance continuous, then keeps the last valid roof and explains the rest', () => {
    // the wing keeps its east wall flush with the block and grows inward, so every step is still a clean L
    const at = (wingWidth: number) => roofOn(outlineOf([L.A, [6 - (wingWidth - 4), 6, 10, 14]]));
    const start = at(4);
    const prev = oh0(start);
    expect(roofWingsState(prev).kind).toBe('compound');

    // a 3 cm wall move is the same massing, recomputed for the new outline (fresh scales, never a replayed shape)
    const small = at(4.03);
    const kept = continuedWings(prev, oh0(small));
    expect(kept.kept).toBe(true);
    expect(kept.reason).toBe('');
    expect(kept.state.kind).toBe('compound');
    const ohSmall = oh0(small);
    expect(meshArea(ohSmall)).toBeCloseTo(Math.abs(polyArea(ohSmall.outline)), 1);
    for (const q of eavePoints(ohSmall)) expect(ohH(ohSmall, q)).toBeLessThan(0.01);

    // every wider wing is a different massing: refused, with a reason, and the preview keeps the last valid roof
    const primaries = new Set<number>();
    let refused = 0;
    for (const w of [4.5, 5, 5.5, 6, 7, 8, 12]) {
      const next = at(w);
      const nst = roofWingsState(oh0(next));
      if (nst.kind !== 'compound') continue; // 9 and 11 would leave a sliver wing; their own reason is tested above
      expect(nst.kind).toBe('compound');
      primaries.add(Math.round(nst.primarySpan * 100));
      const c = continuedWings(prev, oh0(next));
      expect(c.kept).toBe(false);
      expect(c.reason).toMatch(/different massing/);
      expect(c.state.kind).toBe('unsupported');
      if (c.state.kind === 'unsupported') expect(c.state.reason).toBe(c.reason);
      // the caller keeps the gesture-start preview: never the new outline wearing the old shape
      expect(prev.outline).not.toEqual(oh0(next).outline);
      refused++;
    }
    // the sweep really does cross a primary-wing transition, not merely bigger wings
    expect(primaries.size).toBeGreaterThan(1);
    expect(refused).toBeGreaterThan(0);
    // and the retained roof still covers exactly its own outline
    expect(meshArea(prev)).toBeCloseTo(Math.abs(polyArea(prev.outline)), 1);
  });

  it('records when a fitted outline change would choose another massing (the primary can flip)', () => {
    const at = (overhang: number) => {
      const p = roofOn(outlineOf([L.A, L.B], overhang));
      const st = roofWingsState(oh0(p));
      if (st.kind !== 'compound') return null;
      const p0 = st.wings[0].rect;
      return { primary: p0, span: st.primarySpan };
    };
    const a = at(0.45);
    const b = at(0.9);
    expect(a && b).toBeTruthy();
    // both are valid roofs, but the same plan grew a different primary wing
    expect(a!.primary).not.toEqual(b!.primary);
  });
});
