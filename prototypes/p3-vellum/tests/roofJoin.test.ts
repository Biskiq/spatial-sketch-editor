// Joining two roofs: explicit, narrow, and exactly what the preview showed. Two compatible gables become one wing
// roof whose valley comes from the proven decomposition; everything else is refused with the reason.
import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import { runTxn, opAddRun, opRoom, opCoverRooms, opAddOverhead, opOverhead } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { presetProfile, ohSpan } from '../src/model/overheadGeom';
import { joinCheck, joinNeighbours, opJoinRoofs, gablePitch } from '../src/model/roofJoin';
import type { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';
import { rect, probeRoof, cornerRise, overlapDisagreement } from './support/roofProbe';

const line = (pts: V2[], closed: boolean): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const doOp = (p: Project, op: any) => runTxn(p, op).after;

/** Two rooms, each covered on its own with a gable ("Only A", then "Only B"): the usual way two roofs meet. */
function twoCovered(main: V2[], wing: V2[]): Project {
  let p = doOp(emptyProject(), opAddRun(line(main, true), { baseY: 0 }));
  p = doOp(p, opAddRun(line(wing, false), { baseY: 0 }));
  for (const r of derive(p).rooms) p = doOp(p, opRoom(r.id, { height: 3 }));
  for (const r of derive(p).rooms) p = doOp(p, opCoverRooms([r.id], 'gable'));
  return p;
}
const L = () => twoCovered(rect(0, 0, 10, 6), [[10, 6], [10, 14], [6, 14], [6, 6]]);
const T = () => twoCovered(rect(0, 0, 11, 5), [[7.5, 5], [7.5, 12], [3.5, 12], [3.5, 5]]);

/** Two free gables drawn with the pen (no rooms), each spanning its short side. */
function twoDrawn(a: V2[], da: number, b: V2[], db: number, pb?: (span: number) => any): Project {
  let p = doOp(emptyProject(), opAddOverhead(a, 3, { dir: da, preset: 'gable' }));
  p = doOp(p, opAddOverhead(b, 3, { dir: db, preset: 'gable' }));
  if (pb) p = doOp(p, opOverhead(p.overheads[1].id, { profile: pb(ohSpan(p.overheads[1])) }));
  return p;
}
const cross = () => twoDrawn(rect(0, 2, 12, 7), Math.PI / 2, rect(4, 0, 9, 12), 0);

function expectJoined(before: Project) {
  const [a, b] = before.overheads;
  const check = joinCheck(before, a.id, b.id);
  expect(check.reason).toBe('');
  expect(check.ok).toBe(true);
  const t = runTxn(before, opJoinRoofs(a.id, b.id, check.merged));
  const after = t.after;
  // one roof, A's identity, B absorbed
  expect(after.overheads.length).toBe(1);
  const m = after.overheads[0];
  expect(m.id).toBe(a.id);
  expect(m.name).toBe(a.name);
  expect(m.dir).toBe(a.dir);
  expect(m.thick).toBe(a.thick);
  expect(m.hip).toBe(a.hip);
  // the preview was the commit
  expect(m).toEqual(check.merged);
  // the same pitch, now one surface with clean valleys
  expect(gablePitch(m)).toBeCloseTo(gablePitch(a), 1);
  expect(roofWingsState(m).kind).toBe('compound');
  const pr = probeRoof(m);
  expect(pr.gaps).toBe(0);
  expect(pr.double).toBe(0);
  expect(pr.maxErr).toBeLessThan(0.005);
  expect(cornerRise(m)).toBeLessThan(0.01);
  expect(derive(after).issues.filter((i) => /^(cliff|wings):/.test(i.key))).toEqual([]);
  return { m, t };
}

describe('two compatible gables join into one wing roof', () => {
  it('an L of two rooms covered separately', () => {
    const p = L();
    const [a, b] = p.overheads;
    // the baseline the join removes: where they overlap, the two tops disagree by a metre or more
    const before = overlapDisagreement(a, b);
    expect(before.disagree).toBeGreaterThan(before.n / 2);
    expect(before.maxDiff).toBeGreaterThan(1);
    const { m } = expectJoined(p);
    // both rooms' relationships carry over
    expect(new Set(m.restsOn)).toEqual(new Set([...a.restsOn!, ...b.restsOn!]));
    expect(new Set(m.fit!.rooms)).toEqual(new Set([...a.fit!.rooms, ...b.fit!.rooms]));
    expect(m.fit!.overhang).toBe(a.fit!.overhang);
    // and the rooms are covered by the one roof
    expect(new Set(derive(runTxn(p, opJoinRoofs(a.id, b.id)).after).rooms.map((r) => r.coveredBy))).toEqual(new Set([a.id]));
  });

  it('a T whose wing only touches the main roof', () => expectJoined(T()));

  it('two drawn gables crossing in a plus', () => expectJoined(cross()));

  it('two drawn gables end to end make one longer gable with the same span', () => {
    const p = twoDrawn(rect(0, 0, 10, 5), Math.PI / 2, rect(10, 0, 18, 5), Math.PI / 2);
    const [a, b] = p.overheads;
    const c = joinCheck(p, a.id, b.id);
    expect(c.ok).toBe(true);
    expect(roofWingsState(c.merged!).kind).toBe('single');
    expect(ohSpan(c.merged!)).toBeCloseTo(ohSpan(a), 6);
    expect(gablePitch(c.merged!)).toBeCloseTo(gablePitch(a), 1);
  });

  it('is one transaction: the project before it is untouched, so one Undo restores both roofs', () => {
    const p = L();
    const frozen = JSON.stringify(p);
    const t = runTxn(p, opJoinRoofs(p.overheads[0].id, p.overheads[1].id));
    expect(JSON.stringify(p)).toBe(frozen);
    expect(t.after.overheads.length).toBe(1);
  });

  it('offers the join only with roofs that meet', () => {
    const p = L();
    expect(joinNeighbours(p, p.overheads[0].id).map((o) => o.id)).toEqual([p.overheads[1].id]);
    const far = twoDrawn(rect(0, 0, 10, 5), Math.PI / 2, rect(20, 0, 28, 5), Math.PI / 2);
    expect(joinNeighbours(far, far.overheads[0].id)).toEqual([]);
  });
});

describe('anything else is refused, with the reason, and changes nothing', () => {
  const refusal = (p: Project, why: RegExp) => {
    const [a, b] = p.overheads;
    const c = joinCheck(p, a.id, b.id);
    expect(c.ok).toBe(false);
    expect(c.merged).toBeNull();
    expect(c.reason).toMatch(why);
    const t = runTxn(p, opJoinRoofs(a.id, b.id));
    expect(t.after.overheads.length).toBe(2);
    expect(t.after.overheads).toEqual(p.overheads);
    expect(t.notes.some((n) => /Nothing changed/.test(n.text))).toBe(true);
  };

  it('a gable and a vault', () => refusal(twoDrawn(rect(0, 2, 12, 7), Math.PI / 2, rect(4, 0, 9, 12), 0, (s) => presetProfile('vault', s)), /only two gables.*vault/));
  it('different pitches', () => refusal(twoDrawn(rect(0, 2, 12, 7), Math.PI / 2, rect(4, 0, 9, 12), 0, (s) => presetProfile('gable', s).map((q) => ({ ...q, h: q.h * 1.6 }))), /pitches differ/));
  it('different eaves', () => {
    let p = twoDrawn(rect(0, 2, 12, 7), Math.PI / 2, rect(4, 0, 9, 12), 0);
    p = doOp(p, opOverhead(p.overheads[1].id, { baseY: 3.4 }));
    refusal(p, /eaves are at different heights/);
  });
  it('roofs that do not meet', () => refusal(twoDrawn(rect(0, 0, 10, 5), Math.PI / 2, rect(20, 0, 28, 5), Math.PI / 2), /don't meet/));
  it('side by side, which would make one wider roof', () => refusal(twoDrawn(rect(0, 0, 10, 5), Math.PI / 2, rect(0, 5, 10, 10), Math.PI / 2), /wider roof/));
  it('one fitted to its rooms, the other drawn free', () => {
    const p = L();
    const q = doOp(p, opOverhead(p.overheads[1].id, { fit: null }));
    refusal(q, /follows its walls/);
  });
  it('a pair that would enclose a courtyard', () => {
    const u: V2[] = [[0, 0], [11, 0], [11, 11], [7, 11], [7, 5], [4, 5], [4, 11], [0, 11]];
    let p = doOp(emptyProject(), opAddOverhead(u, 3, { dir: Math.PI / 2, preset: 'gable', oneSpan: 'auto' }));
    p = doOp(p, opAddOverhead(rect(0, 11, 11, 15), 3, { dir: Math.PI / 2, preset: 'gable' }));
    p = doOp(p, opOverhead(p.overheads[1].id, { profile: p.overheads[0].profile }));
    refusal(p, /courtyard/);
  });
});

describe('a stale offer is never committed', () => {
  it('a roof that changed after the preview refuses with "hover the offer again"', () => {
    const p = cross();
    const [a, b] = p.overheads;
    const shown = joinCheck(p, a.id, b.id).merged!;
    const moved = doOp(p, opOverhead(b.id, { outline: rect(4, 0, 9, 13) }));
    const t = runTxn(moved, opJoinRoofs(a.id, b.id, shown));
    expect(t.after.overheads.length).toBe(2);
    expect(t.notes.some((n) => /hover the offer again/.test(n.text))).toBe(true);
    // a fresh preview of the moved roof commits exactly
    const fresh = joinCheck(moved, a.id, b.id);
    expect(fresh.ok).toBe(true);
    expect(runTxn(moved, opJoinRoofs(a.id, b.id, fresh.merged)).after.overheads[0]).toEqual(fresh.merged);
  });
});
