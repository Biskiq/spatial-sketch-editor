import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import { runTxn, opAddRun, opAddRunTouching, opMoveNode, opMoveRun } from '../src/model/ops';
import { snapPoint } from '../src/model/snap';
import { derive } from '../src/model/derive';
import { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const poly = (pts: V2[], closed = true): StrokeFit => ({ kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1), closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0 });
const room = (): Project => runTxn(emptyProject(), opAddRun(poly([[0, 0], [8, 0], [8, 6], [0, 6]]), { baseY: 0 })).after;
const ctx = { level: 0, tol: 0.3 };

describe('snapping moves points, and says why', () => {
  it('prefers a corner over the face it sits on', () => {
    const s = snapPoint(room(), [8.1, 0.15], ctx);
    expect(s.kind).toBe('corner');
    expect(s.p).toEqual([8, 0]);
    expect(s.touching?.host).toBeTruthy();
  });
  it('lands on a wall face and reports it as touching', () => {
    const s = snapPoint(room(), [4.2, 0.2], ctx);
    expect(s.kind).toBe('wall');
    expect(s.p[1]).toBeCloseTo(0, 6);
    expect(s.touching).not.toBeNull();
  });
  it('squares a line to a wall and meets the wall where the square line crosses it', () => {
    // from inside the room, heading roughly at the bottom wall
    const s = snapPoint(room(), [3.13, 0.18], { ...ctx, anchors: [[3, 4]] });
    expect(s.kind).toBe('wall');
    expect(s.p[0]).toBeCloseTo(3, 6);
    expect(s.p[1]).toBeCloseTo(0, 6);
    expect(s.guides.length).toBe(1);
  });
  it('keeps a free corner square to both neighbours', () => {
    const p = emptyProject();
    const s = snapPoint(p, [5.1, 3.15], { ...ctx, anchors: [[0, 3], [5, 0]] });
    expect(s.kind).toBe('cross');
    expect(s.p[0]).toBeCloseTo(5, 6);
    expect(s.p[1]).toBeCloseTo(3, 6);
    expect(s.guides.length).toBe(2);
  });
  it('rounds length along an angle line, not the coordinates', () => {
    const s = snapPoint(emptyProject(), [2.537, 2.6], { ...ctx, anchors: [[0, 0]] });
    expect(s.kind).toBe('line');
    expect(s.p[0]).toBeCloseTo(s.p[1], 6);
    expect(Math.hypot(s.p[0], s.p[1]) / 0.05).toBeCloseTo(Math.round(Math.hypot(s.p[0], s.p[1]) / 0.05), 6);
  });
  it('lines up with a corner it is not attached to', () => {
    const s = snapPoint(room(), [12.4, 6.12], { ...ctx, walls: true });
    expect(s.p[1]).toBeCloseTo(6, 6);
    expect(s.guides.length).toBe(1);
  });
  it('⌥ leaves the point exactly as drawn', () => {
    const at: V2 = [8.1, 0.15];
    expect(snapPoint(room(), at, { ...ctx, free: true }).p).toEqual(at);
  });
  it('only walls at the same height count', () => {
    const p = runTxn(emptyProject(), opAddRun(poly([[0, 0], [8, 0], [8, 6], [0, 6]]), { baseY: 3 })).after;
    expect(snapPoint(p, [8.1, 0.15], ctx).kind).not.toBe('corner');
  });
});

describe('touching is not joining', () => {
  const host = () => room().runs[0];
  it('a new wall that lands on another only touches it until the creator joins it', () => {
    const p = room();
    const h = host();
    const op = opAddRunTouching(poly([[4, 0], [4, 6]], false), { baseY: 0 }, { host: h.id, t: 0.1 }, { host: h.id, t: 0.6 });
    const plain = runTxn(p, op);
    const w = plain.after.runs.find((r) => r.id !== h.id)!;
    expect(w.tieA).toBeNull();
    expect(w.tieB).toBeNull();
    const dec = plain.decisions.find((d) => d.key === 'join')!;
    expect(dec.chosen).toBe('touch');
    // the room is still divided: rooms come from geometry, not from ties
    expect(derive(plain.after).rooms.length).toBe(2);
    const joined = runTxn(p, op, { join: 'join' });
    const wj = joined.after.runs.find((r) => r.id !== h.id)!;
    expect(wj.tieA?.host).toBe(h.id);
    expect(wj.tieB?.host).toBe(h.id);
  });
  it('dragging an end onto a wall offers a join and writes no tie by itself', () => {
    let p = runTxn(emptyProject(), opAddRun(poly([[0, 0], [8, 0]], false), { baseY: 0 })).after;
    p = runTxn(p, opAddRun(poly([[4, 3], [4, 1]], false), { baseY: 0 })).after;
    const [a, b] = p.runs;
    const r = runTxn(p, opMoveNode(b.id, 1, [4, 0], 'keep', { host: a.id, t: 0.5 }));
    expect(r.after.runs.find((x) => x.id === b.id)!.tieB).toBeNull();
    expect(r.decisions.map((d) => d.key)).toContain('join');
  });
  it('moving a wall that another only touched asks before bringing it along', () => {
    let p = runTxn(emptyProject(), opAddRun(poly([[0, 0], [8, 0]], false), { baseY: 0 })).after;
    p = runTxn(p, opAddRun(poly([[4, 3], [4, 0]], false), { baseY: 0 })).after;
    const [a, b] = p.runs;
    const moved = runTxn(p, opMoveRun(a.id, [0, -1]));
    expect(moved.after.runs.find((x) => x.id === b.id)!.pts[1]).toEqual([4, 0]);
    expect(moved.decisions.find((d) => d.key === 'bring')?.chosen).toBe('leave');
    const brought = runTxn(p, opMoveRun(a.id, [0, -1]), { bring: 'bring' });
    const bb = brought.after.runs.find((x) => x.id === b.id)!;
    expect(bb.pts[1][1]).toBeCloseTo(-1, 6);
    expect(bb.tieB?.host).toBe(a.id);
  });
});
