import { describe, it, expect } from 'vitest';
import { emptyProject, type Project, type SurfaceRef } from '../src/model/types';
import { runTxn, opAddRun } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { readStroke, type ReadCtx } from '../src/model/readings';
import { boxShape, roundShape, tipFit, BOX_MIN_SIDE, ROUND_MIN_RADIUS } from '../src/model/penTips';
import type { StrokeFit } from '../src/model/strokes';
import { V2 } from '../src/model/geom2d';

const poly = (pts: V2[], closed = true): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: Array.from({ length: closed ? pts.length : pts.length - 1 }, () => 0),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const doOp = (p: Project, op: any) => runTxn(p, op).after;

function ctx(p: Project, fit: StrokeFit, shape?: 'box' | 'round'): ReadCtx {
  return {
    p, d: derive(p),
    plane: { y: 0, onSheet: false, surface: { kind: 'ground', y: 0 } as SurfaceRef, surfaceName: 'the ground' },
    fit, rawFit: fit, plan: fit.pts, magA: null, magB: null, wallFace: null, stairTo: null, onRoof: null, sheetSnap: null, shape,
  };
}

describe('pen tips · the shape two points make', () => {
  it('boxes corner to corner on 0.05 m steps, and refuses a side under 0.6 m', () => {
    const b = boxShape([0, 0], [4.23, 3.61], { frame: 0 })!;
    expect(b.w).toBeCloseTo(4.25, 9);
    expect(b.d).toBeCloseTo(3.6, 9);
    expect(b.corners.length).toBe(4);
    const fit = tipFit(b);
    expect(fit.kind).toBe('closed');
    expect(fit.length).toBeCloseTo(2 * (4.25 + 3.6), 6);
    expect(boxShape([0, 0], [4, 0.3], { frame: 0 })).toBeNull();
    expect(boxShape([0, 0], [BOX_MIN_SIDE - 0.01, 3], { frame: 0 })).toBeNull();
  });

  it('holds the frame the gesture froze, and ⇧ makes the longer side square', () => {
    const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
    const q: V2 = [5 * c - 3 * s, 5 * s + 3 * c];
    const b = boxShape([0, 0], q, { frame: Math.PI / 4 })!;
    expect(b.w).toBeCloseTo(5, 6);
    expect(b.d).toBeCloseTo(3, 6);
    const sq = boxShape([0, 0], [4, 2], { frame: 0, square: true })!;
    expect(sq.w).toBeCloseTo(4, 9);
    expect(sq.d).toBeCloseTo(4, 9);
    // ⌥ keeps the hand's own measurement
    const fine = boxShape([0, 0], [4.23, 3.61], { frame: 0, fine: true })!;
    expect(fine.w).toBeCloseTo(4.23, 9);
  });

  it('rounds a circle out from the press, with the same minimum and fine escape', () => {
    const c = roundShape([2, 2], [2, 4.53])!;
    expect(c.radius).toBeCloseTo(2.55, 9);
    expect(tipFit(c).kind).toBe('circle');
    expect(roundShape([2, 2], [2, 2 + ROUND_MIN_RADIUS - 0.01])).toBeNull();
    expect(roundShape([2, 2], [2, 4.53], { fine: true })!.radius).toBeCloseTo(2.53, 9);
  });
});

describe('pen tips · what the shape is read as', () => {
  it('a box is a Room first, with Platform among its readings', () => {
    const fit = tipFit(boxShape([0, 0], [6, 4], { frame: 0 })!);
    const readings = readStroke(ctx(emptyProject(), fit, 'box'));
    expect(readings[0].id).toBe('room');
    const platform = readings.find((r) => r.id === 'plinth')!;
    expect(platform.label).toBe('Platform');
    expect(platform.detail).toContain('0.6 m up');
  });

  it('a box against a wall is a room beside it, with only three new sides', () => {
    let p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, 10, 6)), { baseY: 0 }));
    expect(derive(p).rooms.length).toBe(1);
    const box = boxShape([2, 0], [6, -4], { frame: 0 })!;
    const fit = tipFit(box);
    const readings = readStroke(ctx(p, fit, 'box'));
    expect(readings[0].id).toBe('room-beside');
    expect(readings[0].label).toBe('Room beside Room 1');
    p = doOp(p, readings[0].op);
    // two rooms, and no doubled wall: the host plus one open run of three sides
    expect(derive(p).rooms.length).toBe(2);
    expect(p.runs.length).toBe(2);
    const added = p.runs[p.runs.length - 1];
    expect(added.closed).toBe(false);
    expect(added.pts.length).toBe(4);
    expect(added.tieA).toBeNull();
    expect(added.tieB).toBeNull();
    expect(runTxn(p, readings[0].op).decisions.some((d) => d.text.includes('touch'))).toBe(true);
  });

  it('a box away from any wall still reads Room, not Room beside', () => {
    const fit = tipFit(boxShape([0, 0], [6, 4], { frame: 0 })!);
    const readings = readStroke(ctx(emptyProject(), fit, 'box'));
    expect(readings.some((r) => r.id === 'room-beside')).toBe(false);
    expect(readings[0].id).toBe('room');
  });

  it('a round tip is one round wall', () => {
    const fit = tipFit(roundShape([3, 2], [5.5, 2])!);
    const readings = readStroke(ctx(emptyProject(), fit, 'round'));
    expect(readings[0].id).toBe('round-room');
    expect(readings.some((r) => r.id === 'round-plinth')).toBe(true);
  });
});
