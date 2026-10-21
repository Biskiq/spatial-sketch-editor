import { describe, it, expect } from 'vitest';
import { fitStroke } from '../src/model/strokes';
import { emptyProject, Project } from '../src/model/types';
import { runTxn, opAddRun, opRemove, opRoom, opAddOpening, opBend, opAddDeck, opCoverRooms, opMoveNode } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { arrange } from '../src/model/arrangement';
import { V2 } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';
import { pointAtT, closestOnRun } from '../src/model/runs';

const jitter = (pts: V2[], a = 0.03) => pts.map((p, i) => [p[0] + Math.sin(i * 12.9898) * a, p[1] + Math.cos(i * 78.233) * a] as V2);
const line = (a: V2, b: V2, n = 40): V2[] => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
const poly = (pts: V2[], closed = true): StrokeFit => ({ kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1), closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0 });

function apply(p: Project, op: any) {
  return runTxn(p, op);
}

describe('stroke reading', () => {
  it('reads a wobbly line as one straight wall', () => {
    const f = fitStroke(jitter(line([0, 0], [8, 0.2])), { mpp: 0.02 });
    expect(f.kind).toBe('open');
    expect(f.pts.length).toBe(2);
    expect(Math.abs(f.pts[1][1] - f.pts[0][1])).toBeLessThan(0.05); // squared to the grid
  });
  it('reads a circle as one round wall', () => {
    const pts: V2[] = Array.from({ length: 80 }, (_, i) => [3 + 2.5 * Math.cos((i / 79) * Math.PI * 2), 1 + 2.5 * Math.sin((i / 79) * Math.PI * 2)]);
    const f = fitStroke(jitter(pts, 0.05), { mpp: 0.02 });
    expect(f.kind).toBe('circle');
    expect(f.radius).toBeGreaterThan(2.3);
    expect(f.radius).toBeLessThan(2.7);
  });
  it('reads a rough rectangle as four square corners', () => {
    const raw = [...line([0, 0], [6, 0.3]), ...line([6, 0.3], [6.2, 4]), ...line([6.2, 4], [0.1, 4.1]), ...line([0.1, 4.1], [0, 0.1])];
    const f = fitStroke(jitter(raw, 0.04), { mpp: 0.02 });
    expect(f.kind).toBe('closed');
    expect(f.pts.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % 4];
      const ang = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0])) % (Math.PI / 2);
      expect(Math.min(ang, Math.PI / 2 - ang)).toBeLessThan(0.02);
    }
  });
  it('reads a bow as one curved segment', () => {
    const pts: V2[] = Array.from({ length: 60 }, (_, i) => {
      const t = Math.PI * (0.15 + 0.7 * (i / 59));
      return [6 * Math.cos(t), 6 * Math.sin(t) - 3];
    });
    const f = fitStroke(jitter(pts, 0.02), { mpp: 0.02 });
    expect(f.kind).toBe('open');
    expect(f.pts.length).toBe(2);
    expect(Math.abs(f.bulge[0])).toBeGreaterThan(0.3);
  });
});

describe('rooms emerge and remember', () => {
  const square = poly([[0, 0], [8, 0], [8, 6], [0, 6]]);
  it('a closed loop makes one room', () => {
    const { after } = apply(emptyProject(), opAddRun(square, { baseY: 0 }));
    const d = derive(after);
    expect(d.rooms.length).toBe(1);
    expect(d.rooms[0].area).toBeCloseTo(48, 0);
  });
  it('dividing then removing the divider restores the original room and its settings', () => {
    let p = apply(emptyProject(), opAddRun(square, { baseY: 0 })).after;
    const gallery = p.rooms[0].id;
    p = apply(p, opRoom(gallery, { name: 'Gallery', height: 4.2 })).after;
    const host = p.runs[0];
    const tA = closestOnRun(host, [4, 0]).t, tB = closestOnRun(host, [4, 6]).t;
    const div = poly([pointAtT(host, tA), pointAtT(host, tB)], false);
    const r1 = apply(p, opAddRun(div, { baseY: 0, tieA: { host: host.id, t: tA }, tieB: { host: host.id, t: tB } }));
    p = r1.after;
    let d = derive(p);
    expect(d.rooms.length).toBe(2);
    const child = d.rooms.find((r) => r.id !== gallery)!;
    expect(child.seed.inheritedFrom).toBe(gallery);
    expect(child.seed.height).toBe(4.2);
    expect(r1.notes.some((n) => n.text.includes('divided'))).toBe(true);
    const divId = p.runs[1].id;
    const r2 = apply(p, opRemove([divId]));
    p = r2.after;
    d = derive(p);
    expect(d.rooms.length).toBe(1);
    expect(d.rooms[0].id).toBe(gallery);
    expect(d.rooms[0].seed.name).toBe('Gallery');
    expect(d.rooms[0].seed.height).toBe(4.2);
  });
  it('a customised half is set aside (not lost) when the rooms merge', () => {
    let p = apply(emptyProject(), opAddRun(square, { baseY: 0 })).after;
    const host = p.runs[0];
    const tA = closestOnRun(host, [4, 0]).t, tB = closestOnRun(host, [4, 6]).t;
    p = apply(p, opAddRun(poly([pointAtT(host, tA), pointAtT(host, tB)], false), { baseY: 0, tieA: { host: host.id, t: tA }, tieB: { host: host.id, t: tB } })).after;
    const child = p.rooms.find((r) => r.inheritedFrom)!;
    p = apply(p, opRoom(child.id, { name: 'Study', height: 2.6 })).after;
    p = apply(p, opRemove([p.runs[1].id])).after;
    expect(p.parked.some((k) => k.what === 'room' && k.label.includes('Study'))).toBe(true);
    expect(p.rooms.find((r) => r.id === child.id)?.dormant).toBe(true);
  });
  it('T-junction onto a round wall makes two rooms', () => {
    let p = apply(emptyProject(), opAddRun({ kind: 'circle', pts: [], bulge: [], closed: true, center: [0, 0], radius: 3, length: 0, curved: true, corners: 0 }, { baseY: 0 })).after;
    const host = p.runs[0];
    const tA = closestOnRun(host, [-3, 0]).t, tB = closestOnRun(host, [3, 0]).t;
    p = apply(p, opAddRun(poly([pointAtT(host, tA), pointAtT(host, tB)], false), { baseY: 0, tieA: { host: host.id, t: tA }, tieB: { host: host.id, t: tB } })).after;
    expect(derive(p).rooms.length).toBe(2);
  });
  it('a dangling wall does not break the room', () => {
    const a = arrange([
      { id: 'a', kind: 'run', shape: 'path', pts: [[0, 0], [5, 0], [5, 5], [0, 5]], bulge: [0, 0, 0, 0], closed: true, center: [0, 0], radius: 0, baseY: 0, thick: 0.2, top: null, tieA: null, tieB: null, order: 1 },
      { id: 'b', kind: 'run', shape: 'path', pts: [[2.5, 0], [2.5, 3]], bulge: [0], closed: false, center: [0, 0], radius: 0, baseY: 0, thick: 0.2, top: null, tieA: null, tieB: null, order: 2 },
    ]);
    expect(a.faces.length).toBe(1);
    const pb = a.pieces.get('b')!;
    expect(pb.every((x) => x.left === 0 && x.right === 0)).toBe(true);
  });
});

describe('honest revision', () => {
  const square = poly([[0, 0], [8, 0], [8, 6], [0, 6]]);
  it('openings ride along a reshaped curved wall', () => {
    let p = apply(emptyProject(), opAddRun(poly([[0, 0], [10, 0]], false), { baseY: 0 })).after;
    const w = p.runs[0].id;
    p = apply(p, opAddOpening(w, 5, { shape: 'arch', width: 1.6, height: 2.8, sill: 0, rise: 0.8 })).after;
    p = apply(p, opBend(w, 0, 0.5)).after;
    const d = derive(p);
    const o = d.walls.get(w)!.openings[0];
    expect(o.s / d.walls.get(w)!.L).toBeCloseTo(0.5, 3);
    expect(o.fits).toBe(true);
  });
  it('removing a wall a roof rests on raises a loose end and deletes nothing else', () => {
    let p = apply(emptyProject(), opAddRun(poly([[0, 0], [8, 0], [8, 6]], false), { baseY: 0 })).after;
    const host = p.runs[0];
    p = apply(p, opAddRun(poly([[8, 6], [0, 6], [0, 0]], false), { baseY: 0, tieA: { host: host.id, t: 1 }, tieB: { host: host.id, t: 0 } })).after;
    const room = derive(p).rooms[0];
    p = apply(p, opCoverRooms([room.id], 'gable')).after;
    expect(p.overheads.length).toBe(1);
    const second = p.runs[1].id;
    const before = derive(p).issues.length;
    const res = apply(p, opRemove([second]));
    const d = derive(res.after);
    expect(res.after.overheads.length).toBe(1);
    expect(d.issues.filter((i) => i.kind === 'support').length).toBeGreaterThan(before);
    expect(res.after.runs.length).toBe(1);
  });
  it('raising a ceiling carries a tied floor above, or keeps it when asked', () => {
    let p = apply(emptyProject(), opAddRun(square, { baseY: 0 })).after;
    const room = p.rooms[0].id;
    p = apply(p, opAddDeck([[0, 0], [8, 0], [8, 3], [0, 3]], 3, { restsOn: room })).after;
    const carry = apply(p, opRoom(room, { height: 3.6 }));
    expect(carry.after.decks[0].y).toBeCloseTo(3.6);
    expect(carry.decisions.length).toBe(1);
    const keep = runTxn(p, opRoom(room, { height: 3.6 }), { [carry.decisions[0].key]: 'keep' });
    expect(keep.after.decks[0].y).toBeCloseTo(3);
  });
  it('moving a tied wall end along its host keeps the tie', () => {
    let p = apply(emptyProject(), opAddRun(square, { baseY: 0 })).after;
    const host = p.runs[0];
    const tA = closestOnRun(host, [4, 0]).t, tB = closestOnRun(host, [4, 6]).t;
    p = apply(p, opAddRun(poly([pointAtT(host, tA), pointAtT(host, tB)], false), { baseY: 0, tieA: { host: host.id, t: tA }, tieB: { host: host.id, t: tB } })).after;
    const div = p.runs[1];
    p = apply(p, opMoveNode(div.id, 0, [5.2, 0.1], 'keep')).after;
    expect(p.runs[1].tieA).not.toBeNull();
    expect(derive(p).rooms.length).toBe(2);
  });
});
