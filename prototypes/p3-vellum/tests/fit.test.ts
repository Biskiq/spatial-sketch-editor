import { describe, it, expect } from 'vitest';
import { emptyProject } from '../src/model/types';
import { runTxn, opAddRun, opCoverRooms, opMoveNode, opOverhead, opRoom, opAddFloorAbove } from '../src/model/ops';
import { polyArea, bbox } from '../src/model/geom2d';
import type { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const box = (pts: V2[]): StrokeFit => ({ kind: 'closed', pts, bulge: pts.map(() => 0), closed: true, center: [0, 0], radius: 0, length: 0, curved: false, corners: 4 });
const covered = () => {
  let p = runTxn(emptyProject(), opAddRun(box([[0, 0], [8, 0], [8, 6], [0, 6]]), { baseY: 0 })).after;
  p = runTxn(p, opCoverRooms([p.rooms[0].id], 'gable')).after;
  return p;
};

describe('a fitted roof follows its walls', () => {
  it('covering a room fits the roof to it, with an overhang', () => {
    const p = covered();
    const oh = p.overheads[0];
    expect(oh.fit?.rooms).toEqual([p.rooms[0].id]);
    const b = bbox(oh.outline);
    expect(b.max[0] - b.min[0]).toBeGreaterThan(8);
  });

  it('when the building grows, the roof grows with it', () => {
    let p = covered();
    const w = p.runs[0];
    const A0 = Math.abs(polyArea(p.overheads[0].outline));
    const r = runTxn(p, opMoveNode(w.id, 1, [11, 0], 'keep'));
    p = runTxn(r.after, opMoveNode(w.id, 2, [11, 6], 'keep')).after;
    const A1 = Math.abs(polyArea(p.overheads[0].outline));
    expect(A1).toBeGreaterThan(A0 + 15);
    expect(bbox(p.overheads[0].outline).max[0]).toBeGreaterThan(11);
    expect(r.notes.some((n) => /followed/.test(n.text))).toBe(true);
  });

  it('pulling an edge past the walls gives it an outline of its own (and says so)', () => {
    const p = covered();
    const oh = p.overheads[0];
    const out = oh.outline.map((q) => [q[0] < 4 ? q[0] - 3 : q[0], q[1]] as V2);
    const r = runTxn(p, opOverhead(oh.id, { outline: out }));
    expect(r.after.overheads[0].fit).toBeNull();
    expect(r.notes.some((n) => /own outline/.test(n.text))).toBe(true);
    // later wall moves leave it alone
    const moved = runTxn(r.after, opMoveNode(r.after.runs[0].id, 1, [11, 0], 'keep')).after;
    expect(moved.overheads[0].outline).toEqual(r.after.overheads[0].outline);
  });

  it('the overhang can change, and a lifted roof fits the storey it now sits on', () => {
    let p = covered();
    const oh = p.overheads[0];
    const A0 = Math.abs(polyArea(oh.outline));
    p = runTxn(p, opOverhead(oh.id, { fit: { ...oh.fit!, overhang: 1 } })).after;
    expect(Math.abs(polyArea(p.overheads[0].outline))).toBeGreaterThan(A0 + 5);
    p = runTxn(p, opRoom(p.rooms[0].id, { height: 3 })).after;
    const lifted = runTxn(p, opAddFloorAbove(p.rooms[0].id), { roof: 'lift' }).after;
    const up = lifted.rooms.find((r) => r.floorY > 1)!;
    expect(lifted.overheads[0].fit?.rooms).toEqual([up.id]);
  });
});
