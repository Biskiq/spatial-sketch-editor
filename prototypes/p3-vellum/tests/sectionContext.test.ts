import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import { runTxn, opAddRun, opRoom, opCoverRooms, opAddOverhead, opAddDeck } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { sectionContext, MIN_HEADROOM } from '../src/model/sectionContext';
import type { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const poly = (pts: V2[]): StrokeFit => ({
  kind: 'closed', pts, bulge: pts.map(() => 0), closed: true, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const doOp = (p: Project, op: any) => runTxn(p, op).after;

function room(w: number, d: number, height: number, ceiling: 'flat' | 'follow' = 'flat') {
  let p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, w, d)), { baseY: 0 }));
  const r = derive(p).rooms[0];
  if (!r) throw new Error('the walls did not make a room');
  p = doOp(p, opRoom(r.id, { height, ceiling }));
  p = doOp(p, opCoverRooms([r.id], 'gable'));
  return { p, room: r.id, oh: p.overheads[0] };
}

describe('the section context', () => {
  it('draws a room’s walls, floor, flat ceiling and one person under a gable', () => {
    const { p, oh } = room(6, 4, 3);
    const ctx = sectionContext(p, derive(p), oh);
    expect(ctx.lines.filter((l) => l.kind === 'wall')).toHaveLength(2);
    expect(ctx.lines.filter((l) => l.kind === 'floor')).toHaveLength(1);
    expect(ctx.lines.filter((l) => l.kind === 'ceiling')).toHaveLength(1);
    expect(ctx.people).toHaveLength(1);
    const ceiling = ctx.lines.find((l) => l.kind === 'ceiling')!;
    expect(ceiling.pts[0][1]).toBeCloseTo(3, 6);
    expect(ctx.people[0].y).toBeCloseTo(0, 6);
  });

  it('hatches a low band above a deck under a 2.6 m eave', () => {
    let { p, oh } = room(6, 4, 2.6, 'follow');
    p = doOp(p, opAddDeck(rect(1, 1, 5, 3), 2.4, { name: 'Loft' }));
    oh = p.overheads[0];
    const ctx = sectionContext(p, derive(p), oh);
    // the room has no flat ceiling, so the roof itself is the obstruction above the loft
    expect(ctx.lines.some((l) => l.kind === 'ceiling')).toBe(false);
    const band = ctx.headroom.find((b) => Math.abs(b.y - 2.4) < 1e-6);
    expect(band).toBeTruthy();
    expect(band!.clear).toBeLessThan(MIN_HEADROOM);
    expect(band!.clear).toBeGreaterThan(0);
    expect(band!.x1 - band!.x0).toBeGreaterThan(0.5);
  });

  it('draws the parts of a room the roof does not cover in faint pencil', () => {
    // a 10 × 10 room with a flat roof over an L: the section through the middle leaves the missing quadrant
    let p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, 10, 10)), { baseY: 0 }));
    const r = derive(p).rooms[0];
    p = doOp(p, opRoom(r.id, { height: 3 }));
    const L: V2[] = [[0, 0], [10, 0], [10, 10], [8, 10], [8, 4], [0, 4]];
    p = doOp(p, opAddOverhead(L, 3, { preset: 'flat', dir: Math.PI / 2 }));
    const oh = p.overheads[0];
    const ctx = sectionContext(p, derive(p), oh);
    expect(ctx.lines.some((l) => l.kind === 'floor' && l.faint)).toBe(true);
  });
});
