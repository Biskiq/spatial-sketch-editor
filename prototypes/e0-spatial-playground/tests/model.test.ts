import { describe, expect, it } from 'vitest';
import { arrange, createBand, deleteGuide, detach, moveGuidePoint, setGuide, setPiecePose } from '../src/model/commands';
import { bandOutline, briefChecks, evaluate, guideError, sampleGuide } from '../src/model/evaluate';
import { parse, serialize } from '../src/model/file';
import { freshFixture } from '../src/model/fixture';
import { TOL } from '../src/model/geometry';
import { Session } from '../src/model/session';
import type { E0Document, GuidePoint } from '../src/model/types';

const gp = (coords: [number, number][]): GuidePoint[] => coords.map(([x, z], i) => ({ id: `gp-${i + 1}`, x, z }));
const ok = <T>(r: T | { refused: string }): T => {
  if (r && typeof r === 'object' && 'refused' in r) throw new Error(r.refused);
  return r as T;
};
const withGuide = (coords: [number, number][], doc = freshFixture()) => ok(setGuide(doc, coords, 'Display guide'));
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(TOL);

describe('band geometry (hand-calculated)', () => {
  it('straight band is a w × L rectangle around the guide', () => {
    const r = bandOutline(gp([[-1, 0], [1, 0]]), 0.2);
    if ('error' in r) throw new Error(r.error);
    // Left normal of +X is +Z.
    expect(r.outline).toEqual([[-1, 0.1], [1, 0.1], [1, -0.1], [-1, -0.1]]);
  });

  it('right-angle corner uses a miter of √2 half-widths', () => {
    // (0,0) → (2,0) → (2,2): tangent +X then +Z; turning toward the right side (−Z normal side).
    const r = bandOutline(gp([[0, 0], [2, 0], [2, 2]]), 0.2);
    if ('error' in r) throw new Error(r.error);
    const [l0, l1, l2, r2, r1, r0] = r.outline;
    expect(l0).toEqual([0, 0.1]);
    close(l1[0], 1.9); close(l1[1], 0.1); // inner corner
    close(l2[0], 1.9); close(l2[1], 2);
    close(r2[0], 2.1); close(r2[1], 2);
    close(r1[0], 2.1); close(r1[1], -0.1); // outer corner
    expect(r0).toEqual([0, -0.1]);
    close(Math.hypot(r1[0] - 2, r1[1]), 0.1 * Math.SQRT2);
  });

  it('refuses zero-length, reversing and self-crossing guides with a remedy', () => {
    expect(guideError(gp([[0, 0], [0, 0.001], [1, 0]]))).toMatch(/coincide.*Move them apart/);
    expect(guideError(gp([[0, 0], [1, 0], [0.5, 0]]))).toMatch(/reverses/);
    expect(guideError(gp([[0, 0], [2, 0], [2, 1], [1, -1]]))).toMatch(/crosses itself/);
  });

  it('refuses a miter beyond four half-widths and suggests widening or narrowing', () => {
    // ~165° turn: miter ratio 1/cos(82.5°) ≈ 7.7.
    const t = (165 * Math.PI) / 180;
    const r = bandOutline(gp([[0, 0], [1, 0], [1 + Math.cos(t), Math.sin(t)]]), 0.2);
    expect('error' in r && r.error).toMatch(/too sharp.*Widen the corner angle or narrow the band/);
    // A 120° turn (ratio 2) is fine.
    const t2 = (120 * Math.PI) / 180;
    expect('outline' in bandOutline(gp([[0, 0], [1, 0], [1 + Math.cos(t2), Math.sin(t2)]]), 0.2)).toBe(true);
  });

  it('refuses overlapping offsets on short segments and nonpositive dimensions', () => {
    const r = bandOutline(gp([[0, 0], [1, 0], [1, 0.1], [0, 0.1]]), 0.2);
    expect('error' in r && r.error).toMatch(/fold over|overlap/);
    expect('error' in bandOutline(gp([[0, 0], [1, 0]]), 0)).toBe(true);
    const doc = createBand(withGuide([[-1, 0], [1, 0]]), 0.2, -1);
    expect(evaluate(doc).errors[0].message).toMatch(/height must be a positive/);
  });
});

describe('arrangement', () => {
  it('places slots at a, (a+L−b)/2, L−b offset by d along (−tz, tx)', () => {
    let doc = withGuide([[-2, 0], [2, 0]]);
    doc = arrange(doc, { startMargin: 0.5, endMargin: 1, sideOffset: 0.5, order: ['piece-main', 'piece-b', 'piece-c'], follow: true });
    const ev = evaluate(doc);
    expect(ev.errors).toEqual([]);
    const poses = ev.slots!;
    // L = 4: s = 0.5, 1.75, 3 → x = −1.5, −0.25, 1; offset +0.5 in Z.
    [[-1.5, 0.5], [-0.25, 0.5], [1, 0.5]].forEach(([x, z], i) => {
      close(poses[i].x, x);
      close(poses[i].z, z);
      close(poses[i].yaw, 0);
    });
  });

  it('uses the outgoing tangent at an exact corner', () => {
    const points = gp([[0, 0], [1, 0], [1, 1]]);
    const s = sampleGuide(points, 1);
    expect(s.at).toEqual([1, 0]);
    expect(s.tangent).toEqual([0, 1]);
    // Corner slot: L = 2, a = b = 0 → middle slot at s = 1, offset along (−1, 0).
    const doc = arrange(withGuide([[0, 0], [1, 0], [1, 1]]), { startMargin: 0, endMargin: 0, sideOffset: 0.5, order: ['piece-main', 'piece-b', 'piece-c'], follow: true });
    const mid = evaluate(doc).slots![1];
    close(mid.x, 0.5);
    close(mid.z, 0);
    close(mid.yaw, -Math.PI / 2);
  });

  it('refuses margins that do not fit the guide', () => {
    const doc = arrange(withGuide([[0, 0], [1, 0]]), { startMargin: 0.6, endMargin: 0.6, sideOffset: 0, order: ['piece-main', 'piece-b', 'piece-c'], follow: true });
    expect(evaluate(doc).errors[0]).toMatchObject({ target: 'arrangement' });
  });

  it('without Follow guide accepts free poses only', () => {
    const doc = arrange(withGuide([[-2, 0], [2, 0]]), { startMargin: 0, endMargin: 0, sideOffset: 0, order: ['piece-b', 'piece-main', 'piece-c'], follow: false });
    expect(doc.arrangement).toBeNull();
    expect(doc.pieces.find((p) => p.id === 'piece-main')!.pose).toMatchObject({ x: 0, z: 0 });
    expect(doc.pieces.find((p) => p.id === 'piece-b')!.pose).toMatchObject({ x: -2, z: 0 });
  });
});

describe('shared revision', () => {
  const composed = () => {
    let doc = createBand(withGuide([[-2, 0], [0, 1], [2, 0]]));
    doc = arrange(doc, { startMargin: 0.3, endMargin: 0.3, sideOffset: 0.5, order: ['piece-b', 'piece-main', 'piece-c'], follow: true });
    return doc;
  };

  it('editing the guide reshapes the band and following pieces but not a detached piece', () => {
    let doc = composed();
    doc = detach(doc, 'piece-main');
    const before = evaluate(doc);
    const mainBefore = before.pieces.find((p) => p.id === 'piece-main')!.pose;
    const revised = moveGuidePoint(doc, 'gp-2', 0.5, -1.5);
    const after = evaluate(revised);
    expect(after.errors).toEqual([]);
    expect(after.pieces.find((p) => p.id === 'piece-main')!.pose).toEqual(mainBefore);
    expect(after.pieces.find((p) => p.id === 'piece-b')!.pose).not.toEqual(before.pieces.find((p) => p.id === 'piece-b')!.pose);
    expect(after.bandOutline).not.toEqual(before.bandOutline);
  });

  it('detach captures the evaluated pose and leaves other slots unchanged', () => {
    const doc = composed();
    const ev = evaluate(doc);
    const next = setPiecePose(doc, 'piece-c', { x: 2.5 });
    const ev2 = evaluate(next);
    expect(ev2.pieces.find((p) => p.id === 'piece-c')).toMatchObject({ following: false, pose: { ...ev.pieces[2].pose, x: 2.5 } });
    expect(ev2.pieces.find((p) => p.id === 'piece-b')!.pose).toEqual(ev.pieces.find((p) => p.id === 'piece-b')!.pose);
    expect(ev2.pieces.find((p) => p.id === 'piece-main')!.pose).toEqual(ev.pieces.find((p) => p.id === 'piece-main')!.pose);
  });

  it('refuses deleting or replacing an in-use guide without dropping work', () => {
    const doc = composed();
    expect(deleteGuide(doc)).toMatchObject({ refused: expect.stringMatching(/display edge and the arrangement/) });
    expect(setGuide(doc, [[0, 0], [1, 0]], 'x')).toMatchObject({ refused: expect.any(String) });
    expect(doc.guide).not.toBeNull();
  });

  it('checks arrival clearance and retained main pose', () => {
    const doc = composed();
    const ev = evaluate(doc);
    const mainPose = ev.pieces.find((p) => p.id === 'piece-main')!.pose;
    const checks = briefChecks({ ...doc, entrance: 'east' }, ev, mainPose);
    expect(checks.find((c) => c.label === 'Arrival area clear')!.ok).toBe(false); // band reaches x = 2
    expect(checks.find((c) => c.label.startsWith('Main piece'))!.ok).toBe(true);
  });
});

describe('session: preview, commit, cancel and history', () => {
  it('preview and commit use the same evaluation; rejected drafts leave history unchanged', () => {
    const s = new Session(withGuide([[0, 0], [1, 0], [1, 1]]));
    const good = moveGuidePoint(s.doc, 'gp-3', 1.5, 1);
    expect(s.preview(good, 'move')!.error).toBeNull();
    expect(s.commitDraft()).toBe(true);
    expect(evaluate(s.doc)).toEqual(evaluate(good));
    const bad = moveGuidePoint(s.doc, 'gp-3', 0.5, 0); // reverses onto segment 1
    expect(s.preview(bad, 'move')!.error).toMatch(/reverses|crosses/);
    expect(s.commitDraft()).toBe(false);
    expect(s.draft).not.toBeNull(); // still editable
    expect(s.history.past.length).toBe(1);
    s.cancel();
    expect(s.doc).toBe(s.history.present);
  });

  it('undo then a new edit clears redo', () => {
    const s = new Session(freshFixture());
    s.apply(setPiecePose(s.doc, 'piece-b', { x: 0.5 }), 'move');
    s.apply(setPiecePose(s.doc, 'piece-b', { x: 0.7 }), 'move');
    s.undo();
    expect(s.canRedo).toBe(true);
    expect(s.doc.pieces[1].pose.x).toBe(0.5);
    s.apply(setPiecePose(s.doc, 'piece-c', { x: 2 }), 'move');
    expect(s.canRedo).toBe(false);
    s.undo();
    s.undo();
    expect(s.doc).toEqual(freshFixture());
  });

  it('a pointer-up after Undo/Open cannot commit an obsolete draft', () => {
    const s = new Session(freshFixture());
    const epoch = s.epoch;
    s.preview(setPiecePose(s.doc, 'piece-b', { x: 2 }), 'drag', epoch);
    s.undo(); // interrupts the gesture
    expect(s.commitDraft(epoch)).toBe(false);
    expect(s.preview(setPiecePose(s.doc, 'piece-b', { x: 2 }), 'drag', epoch)).toBeNull();
    expect(s.history.past.length).toBe(0);
    s.replace(freshFixture());
    expect(s.commitDraft(epoch)).toBe(false);
  });
});

describe('JSON file', () => {
  const composed = (): E0Document => {
    let doc = createBand(withGuide([[-2, 0], [0, 1], [2, 0]]), 0.25, 0.35);
    doc = arrange(doc, { startMargin: 0.3, endMargin: 0.4, sideOffset: -0.5, order: ['piece-c', 'piece-main', 'piece-b'], follow: true });
    doc = setPiecePose(doc, 'piece-main', { yaw: 0.4 });
    return { ...doc, entrance: 'east', notes: 'Open, rhythmic.' };
  };

  it('round-trips source, IDs and following, regenerating the same result', () => {
    const doc = composed();
    const r = parse(serialize(doc));
    if ('error' in r) throw new Error(r.error);
    expect(r.doc).toEqual(doc);
    expect(evaluate(r.doc)).toEqual(evaluate(doc));
    expect(r.doc.arrangement!.members.find((m) => m.pieceId === 'piece-main')!.following).toBe(false);
    // Still editable after reopening.
    expect(evaluate(moveGuidePoint(r.doc, 'gp-2', 0, 1.5)).errors).toEqual([]);
  });

  it('rejects malformed, unknown-version, missing-ID and invalid-geometry files without mutation', () => {
    const s = new Session(composed());
    const before = serialize(s.doc);
    const good = JSON.parse(serialize(composed()));
    const bad = [
      '{not json',
      JSON.stringify({ ...good, version: 'e0-playground/99' }),
      JSON.stringify({ ...good, band: { ...good.band, guideId: 'guide-x' } }),
      JSON.stringify({ ...good, arrangement: { ...good.arrangement, members: good.arrangement.members.map((m: object, i: number) => (i === 0 ? { ...m, pieceId: 'ghost' } : m)) } }),
      JSON.stringify({ ...good, guide: { ...good.guide, points: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 1, z: 0 }, { id: 'c', x: 0, z: 0 }] } }),
      JSON.stringify({ ...good, pieces: good.pieces.slice(0, 2) }),
    ];
    for (const text of bad) {
      const r = parse(text);
      expect(r).toHaveProperty('error');
      expect((r as { error: string }).error).toMatch(/unchanged/);
    }
    expect(serialize(s.doc)).toBe(before);
  });

  it('writes no generated or session state', () => {
    const json = JSON.parse(serialize(composed()));
    expect(Object.keys(json).sort()).toEqual(['arrangement', 'band', 'entrance', 'guide', 'notes', 'pieces', 'version']);
    expect(JSON.stringify(json)).not.toMatch(/outline|slots|selection|history|context/);
  });
});
