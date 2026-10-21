// Roofs on creative footprints: the plan decides wings or one span, through every route that makes a roof. An L
// covered as one room, as two rooms, or drawn with the pen is the same roof; a section its wings can't carry is
// refused with the reason, never placed as a single span that stops in mid-air at an inner eave.
import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import { runTxn, opAddRun, opRoom, opCoverRooms, coverCheck, opAddOverhead, opOverhead } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { presetProfile, ohSpan, type ProfilePreset } from '../src/model/overheadGeom';
import { spanCliff, chooseSpan } from '../src/model/roofSpan';
import { readStroke, type ReadCtx } from '../src/model/readings';
import { offsetPoly, ensureCCW, type V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';
import { FOOTPRINTS, rect, probeRoof, cornerRise } from './support/roofProbe';

const closed = (pts: V2[]): StrokeFit => ({
  kind: 'closed', pts, bulge: pts.map(() => 0), closed: true, center: [0, 0], radius: 0, length: 0, curved: false, corners: pts.length,
});
const doOp = (p: Project, op: any) => runTxn(p, op).after;

/** One room on this outline, 3 m tall. */
function oneRoom(outline: V2[]): { p: Project; id: string } {
  let p = doOp(emptyProject(), opAddRun(closed(outline), { baseY: 0 }));
  const id = derive(p).rooms[0].id;
  p = doOp(p, opRoom(id, { height: 3 }));
  return { p, id };
}

const roofIssues = (p: Project) => derive(p).issues.filter((i) => /^(cliff|wings):/.test(i.key));

function expectClean(p: Project) {
  const oh = p.overheads[0];
  expect(roofWingsState(oh).kind).toBe('compound');
  const pr = probeRoof(oh);
  expect(pr.samples).toBeGreaterThan(200);
  expect(pr.gaps).toBe(0);
  expect(pr.double).toBe(0);
  expect(pr.maxErr).toBeLessThan(0.005);
  expect(cornerRise(oh)).toBeLessThan(0.01); // every eave level: no cliff anywhere on the outline
  expect(roofIssues(p)).toEqual([]);
}

describe('one room on a creative footprint is covered with wings', () => {
  for (const [name, outline] of Object.entries(FOOTPRINTS)) {
    for (const preset of ['flat', 'gable', 'vault'] as ProfilePreset[]) {
      it(`${name}, ${preset}: the chip is live and the roof is exact`, () => {
        const { p, id } = oneRoom(outline);
        const check = coverCheck(p, [id], preset);
        expect(check.ok).toBe(true);
        expect(check.overhead!.oneSpan).toBe(false);
        expectClean(doOp(p, opCoverRooms([id], preset)));
      });
    }
    it(`${name}, hipped gable: the hip carries across the wings`, () => {
      const { p, id } = oneRoom(outline);
      let q = doOp(p, opCoverRooms([id], 'gable'));
      q = doOp(q, opOverhead(q.overheads[0].id, { hip: 2 }));
      expectClean(q);
    });
  }

  it('an L covered as one room and as two rooms is the same roof', () => {
    const one = oneRoom(FOOTPRINTS.L);
    const a = doOp(one.p, opCoverRooms([one.id], 'gable')).overheads[0];
    let two = doOp(emptyProject(), opAddRun(closed(rect(0, 0, 10, 6)), { baseY: 0 }));
    two = doOp(two, opAddRun({ ...closed([[10, 6], [10, 14], [6, 14], [6, 6]]), kind: 'open', closed: false, bulge: [0, 0, 0] }, { baseY: 0 }));
    for (const r of derive(two).rooms) two = doOp(two, opRoom(r.id, { height: 3 }));
    const b = doOp(two, opCoverRooms(derive(two).rooms.map((r) => r.id), 'gable')).overheads[0];
    const sa = roofWingsState(a), sb = roofWingsState(b);
    if (sa.kind !== 'compound' || sb.kind !== 'compound') throw new Error('both should be compound');
    expect(sb.wings.length).toBe(sa.wings.length);
    expect(sb.primarySpan).toBeCloseTo(sa.primarySpan, 2);
  });
});

describe('a section the wings cannot carry is refused, not stretched', () => {
  for (const preset of ['raked', 'clerestory'] as ProfilePreset[]) {
    it(`${preset} over one L room: the chip says why and the commit places nothing`, () => {
      const { p, id } = oneRoom(FOOTPRINTS.L);
      const check = coverCheck(p, [id], preset);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/inner eave/);
      const t = runTxn(p, opCoverRooms([id], preset));
      expect(t.after.overheads.length).toBe(0);
      expect(t.after.nextId).toBe(p.nextId);
      expect(t.notes.some((n) => /Nothing was placed/.test(n.text))).toBe(true);
    });
  }

  it('an L whose edge is 3° off can take no wings: a flat cover is still fine, a gable is refused', () => {
    const slanted: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 10], [4.6, 9.2], [4.6, 6], [0, 6]];
    const { p, id } = oneRoom(slanted);
    expect(coverCheck(p, [id], 'flat').ok).toBe(true);
    expect(coverCheck(p, [id], 'flat').overhead!.oneSpan).toBeUndefined();
    const gable = coverCheck(p, [id], 'gable');
    expect(gable.ok).toBe(false);
    expect(gable.reason).toMatch(/off the roof frame/);
  });
});

describe('intentional slopes are not cliffs', () => {
  it('a shed over a rectangle stands tall at its high eave, and that is not reported', () => {
    const { p, id } = oneRoom(rect(0, 0, 8, 5));
    const q = doOp(p, opCoverRooms([id], 'raked'));
    const oh = q.overheads[0];
    expect(oh.oneSpan).toBeUndefined();
    expect(cornerRise(oh)).toBeGreaterThan(1); // the high eave really is high
    expect(spanCliff(oh)).toBeNull();
    expect(roofIssues(q)).toEqual([]);
  });

  it('a gable over a rectangle has end triangles, and those are not reported', () => {
    const { p, id } = oneRoom(rect(0, 0, 8, 5));
    const q = doOp(p, opCoverRooms([id], 'gable'));
    expect(spanCliff(q.overheads[0])).toBeNull();
    expect(roofIssues(q)).toEqual([]);
  });

  it('a convex but non-rectangular plan keeps one span', () => {
    const hex: V2[] = [[0, 2], [3, 0], [7, 0], [10, 2], [7, 4], [3, 4]];
    const { p, id } = oneRoom(hex);
    const c = coverCheck(p, [id], 'gable');
    expect(c.ok).toBe(true);
    expect(c.overhead!.oneSpan).toBeUndefined();
  });
});

describe('a single span that stops in mid-air is reported, with the repair that works', () => {
  it('an older single-span gable over an L gets "Give it wings", which clears it', () => {
    const outline = ensureCCW(offsetPoly(ensureCCW(FOOTPRINTS.L), 0.57).pts);
    const p = doOp(emptyProject(), opAddOverhead(outline, 3, { preset: 'gable' }));
    const oh = p.overheads[0];
    const cliff = spanCliff(oh);
    expect(cliff).not.toBeNull();
    expect(cliff!.h).toBeGreaterThan(1);
    const issue = derive(p).issues.find((i) => i.key === `cliff:${oh.id}`)!;
    expect(issue.text).toMatch(/inner eave/);
    expect(issue.fixes.map((f) => f.label)).toEqual(['Give it wings']);
    const q = structuredClone(p);
    issue.fixes[0].apply(q);
    expect(roofWingsState(q.overheads[0]).kind).toBe('compound');
    expect(roofIssues(q)).toEqual([]);
  });

  it('a plan the wings cannot take is reported without a false repair', () => {
    const slanted: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 10], [4.6, 9.2], [4.6, 6], [0, 6]];
    const p = doOp(emptyProject(), opAddOverhead(slanted, 3, { preset: 'gable' }));
    const issue = derive(p).issues.find((i) => i.key.startsWith('cliff:'))!;
    expect(issue.fixes).toEqual([]);
    expect(issue.text).toMatch(/wings can't carry/);
    expect(chooseSpan(p.overheads[0]).ok).toBe(false);
  });

  it('opAddOverhead with auto refuses what a cover would refuse', () => {
    const outline = ensureCCW(offsetPoly(ensureCCW(FOOTPRINTS.L), 0.57).pts);
    const t = runTxn(emptyProject(), opAddOverhead(outline, 3, { preset: 'raked', oneSpan: 'auto' }));
    expect(t.after.overheads.length).toBe(0);
    expect(t.notes[0].text).toMatch(/inner eave/);
    const ok = runTxn(emptyProject(), opAddOverhead(outline, 3, { preset: 'gable', oneSpan: 'auto' })).after;
    expect(ok.overheads[0].oneSpan).toBe(false);
    expect(probeRoof(ok.overheads[0]).gaps).toBe(0);
  });
});

describe('the pen: a roof drawn over an L is a wing roof', () => {
  it('the roof reading over one L room places wings, and raising it stays exact', () => {
    const { p } = oneRoom(FOOTPRINTS.L);
    const d = derive(p);
    const drawn = ensureCCW(offsetPoly(ensureCCW(FOOTPRINTS.L), 0.5).pts);
    const ctx: ReadCtx = {
      p, d, plane: { y: 3, onSheet: true, surface: null, surfaceName: '' }, fit: closed(drawn), rawFit: closed(drawn), plan: drawn,
      magA: null, magB: null, wallFace: null, stairTo: null, onRoof: null, sheetSnap: { y: 3, label: 'Room 1 top', kind: 'top', ids: [d.rooms[0].id] },
    };
    const roof = readStroke(ctx).find((r) => r.id === 'roof');
    expect(roof).toBeTruthy();
    let q = doOp(p, roof!.op);
    const oh = q.overheads[0];
    expect(oh.oneSpan).toBe(false);
    q = doOp(q, opOverhead(oh.id, { profile: presetProfile('gable', ohSpan(oh)) }));
    expectClean(q);
  });
});
