import { describe, it, expect } from 'vitest';
import { emptyProject } from '../src/model/types';
import { runTxn, opAddRun, opAddFloorAbove, opRoom, opCoverRooms } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { lvl } from '../src/model/settle';
import type { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const box = (pts: V2[]): StrokeFit => ({ kind: 'closed', pts, bulge: pts.map(() => 0), closed: true, center: [0, 0], radius: 0, length: 0, curved: false, corners: 4 });
const oneRoom = () => {
  let p = runTxn(emptyProject(), opAddRun(box([[0, 0], [8, 0], [8, 6], [0, 6]]), { baseY: 0 })).after;
  p = runTxn(p, opRoom(p.rooms[0].id, { height: 3.2 })).after;
  return p;
};

describe('a floor above, from ordinary parts', () => {
  it('adds a slab at the room top, walls on it and a room of the same height — one step, nothing tied', () => {
    const p = oneRoom();
    const r = runTxn(p, opAddFloorAbove(p.rooms[0].id));
    const q = r.after;
    expect(q.decks.length).toBe(1);
    expect(q.decks[0].y).toBeCloseTo(3.2, 6);
    expect(q.decks[0].restsOn).toBeNull();
    const up = q.runs.find((w) => lvl(w.baseY) === lvl(3.2))!;
    expect(up).toBeTruthy();
    expect(up.tieA).toBeNull();
    const rooms = derive(q).rooms;
    expect(rooms.length).toBe(2);
    const upper = rooms.find((x) => x.floorY > 1)!;
    expect(upper.name).toBe('Room 1 upstairs');
    expect(upper.topY - upper.floorY).toBeCloseTo(3.2, 6);
    expect(r.select).toBe(up.id);
    expect(r.decisions.length).toBe(0);
  });

  it('a roof in the way stays put unless lifting it is chosen in the same step', () => {
    let p = oneRoom();
    p = runTxn(p, opCoverRooms([p.rooms[0].id], 'gable')).after;
    const oh0 = p.overheads[0];
    const plain = runTxn(p, opAddFloorAbove(p.rooms[0].id));
    expect(plain.after.overheads[0].baseY).toBe(oh0.baseY);
    expect(plain.decisions.find((d) => d.key === 'roof')?.chosen).toBe('leave');
    const lifted = runTxn(p, opAddFloorAbove(p.rooms[0].id), { roof: 'lift' });
    expect(lifted.after.overheads[0].baseY).toBeCloseTo(oh0.baseY + 3.2, 6);
    expect(lifted.after.overheads.length).toBe(1);
  });

  it('stacks again on the new storey', () => {
    let p = runTxn(oneRoom(), opAddFloorAbove(oneRoom().rooms[0].id)).after;
    const upper = derive(p).rooms.find((x) => x.floorY > 1)!;
    p = runTxn(p, opAddFloorAbove(upper.id)).after;
    expect(derive(p).rooms.map((x) => Math.round(x.floorY * 10) / 10).sort()).toEqual([0, 3.2, 6.4]);
  });
});
