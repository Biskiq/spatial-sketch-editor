import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import type { V2 } from '../src/model/geom2d';
import { runTxn, opAddRun, opRoom, opCoverRooms, opAddDeck, opAddVoid, opOverhead } from '../src/model/ops';
import { presetProfile } from '../src/model/overheadGeom';
import { derive } from '../src/model/derive';
import { mezzanineOffer, mezzanineCandidates, stairCandidates, MIN_ABOVE, MIN_AREA, DECK_THICK } from '../src/model/offers';
import type { StrokeFit } from '../src/model/strokes';
import { pointInPolyHoles, dist, polyArea } from '../src/model/geom2d';
import { P, intersection, mpolyArea } from '../src/model/clip';

const poly = (pts: V2[], closed = true): StrokeFit => ({ kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1), closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0 });
const rect = (w: number, d: number): V2[] => [[0, 0], [w, 0], [w, d], [0, d]];
const doOp = (p: Project, op: any) => runTxn(p, op).after;

/** A rectangular room of a given ceiling height on the ground. */
function room(w: number, d: number, height: number): Project {
  let p = doOp(emptyProject(), opAddRun(poly(rect(w, d)), { baseY: 0 }));
  return doOp(p, opRoom(derive(p).rooms[0].id, { height }));
}
const roomId = (p: Project) => derive(p).rooms[0].id;
const covered = (p: Project, preset: 'flat' | 'gable' | 'vault', room = roomId(p)) => doOp(p, opCoverRooms([room], preset));

describe('mezzanine offers', () => {
  it('qualifies a usable mezzanine under a high flat roof, with every clearance read from the roof', () => {
    const p = covered(room(10, 6, 5.2), 'flat');
    const { candidates, why } = mezzanineOffer(p, roomId(p));
    expect(why).toBe('');
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.below).toBeGreaterThanOrEqual(2.4 - 1e-6);
      expect(c.above).toBeGreaterThanOrEqual(MIN_ABOVE - 1e-6);
      expect(c.area).toBeGreaterThanOrEqual(MIN_AREA);
      expect(c.y - DECK_THICK - derive(p).rooms[0].floorY).toBeCloseTo(c.below, 6);
      expect(c.stair).toBeTruthy();
      expect(c.stair.width).toBeCloseTo(1.3, 6);
    }
  });

  it('refuses a low room and says why instead of offering a failing action', () => {
    const p = covered(room(10, 6, 3.0), 'flat');
    const { candidates, why } = mezzanineOffer(p, roomId(p));
    expect(candidates).toEqual([]);
    expect(why.toLowerCase()).toContain('headroom');
  });

  it('never takes a gable’s peak as proof: the eaves decide', () => {
    const low = covered(room(8, 6, 3.2), 'gable');
    expect(mezzanineCandidates(low, roomId(low))).toEqual([]);
    const tall = covered(room(8, 6, 5.2), 'gable');
    const cs = mezzanineCandidates(tall, roomId(tall));
    expect(cs.length).toBeGreaterThan(0);
    // the roof rises towards the ridge, so clearance above must be measured, not assumed from the peak
    expect(Math.min(...cs.map((c) => c.above))).toBeGreaterThanOrEqual(MIN_ABOVE - 1e-6);
  });

  it('is deterministic: the same revision gives the same candidates in the same order', () => {
    const p = covered(room(10, 6, 5.2), 'flat');
    const a = mezzanineCandidates(p, roomId(p));
    const b = mezzanineCandidates(p, roomId(p));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.outline)).toEqual(b.map((c) => c.outline));
    expect(a.length).toBeLessThanOrEqual(3);
  });

  it('keeps a void and an existing slab out of the footprint', () => {
    let p = covered(room(10, 6, 5.2), 'flat');
    const r = roomId(p);
    p = doOp(p, opAddVoid([[4.5, 2.4], [6, 2.4], [6, 3.6], [4.5, 3.6]], 0, 99));
    const cs = mezzanineCandidates(p, r);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) expect(mpolyArea(intersection(P(c.outline), P([[4.5, 2.4], [6, 2.4], [6, 3.6], [4.5, 3.6]])))).toBeLessThan(0.05);
  });

  it('finds a loft in the clear middle of a steep roof, not only full-width strips at the room ends', () => {
    // 8 × 6 m, 3.2 m to the wall top, open to the roof, with a 3.0 m gable rise: the eaves leave 0.5 m over a
    // 2.70 m deck and only the ridge band clears 2.10 m, so an end strip (which reaches the eave) can never qualify
    let p = room(8, 6, 3.2);
    p = doOp(p, opRoom(roomId(p), { ceiling: 'follow' }));
    p = doOp(p, opCoverRooms([roomId(p)], 'gable'));
    const oh = p.overheads[0];
    p = doOp(p, opOverhead(oh.id, { profile: presetProfile('gable', 6).map((q, i) => (i === 1 ? { ...q, h: 3.0 } : q)) }));

    const { candidates, why } = mezzanineOffer(p, roomId(p));
    expect(why).toBe('');
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.above).toBeGreaterThanOrEqual(MIN_ABOVE - 1e-6);
      expect(c.below).toBeGreaterThanOrEqual(2.4 - 1e-6);
      expect(c.stair.fromY).toBeCloseTo(0, 6);
      expect(c.stair.toY).toBeCloseTo(c.y, 6);
      // it sits where the section is tall: every footprint point is clear, and the plan is inside the room
      for (const q of c.outline) expect(pointInPolyHoles(q, derive(p).rooms[0].poly)).toBe(true);
    }
    // the old grammar could only try strips that reached a low eave; the chosen loft stays clear of both eaves
    const chosen = candidates[0];
    const zs = chosen.outline.map((q) => q[1]);
    expect(Math.min(...zs)).toBeGreaterThan(0.6);
    expect(Math.max(...zs)).toBeLessThan(5.4);
  });

  it('does not offer through a deck already filling the room', () => {
    let p = covered(room(10, 6, 5.2), 'flat');
    p = doOp(p, opAddDeck(rect(10, 6), 2.7, { name: 'Existing deck' }));
    expect(mezzanineCandidates(p, roomId(p))).toEqual([]);
  });

  it('previews equal the committed outline: one candidate carries its own stair and never moves anything', () => {
    const p = covered(room(10, 6, 5.2), 'flat');
    const before = JSON.stringify(p);
    const cs = mezzanineCandidates(p, roomId(p));
    expect(JSON.stringify(p)).toBe(before);
    const c = cs[0];
    expect(Math.abs(polyArea(c.outline))).toBeGreaterThan(MIN_AREA);
    for (const q of c.outline) expect(pointInPolyHoles(q, derive(p).rooms[0].poly) || dist(q, derive(p).rooms[0].at) < 8).toBe(true);
  });
});

describe('stair offers', () => {
  it('reaches the deck edge with full width, lands on the floor and stays clear', () => {
    let p = covered(room(10, 6, 5.2), 'flat');
    p = doOp(p, opAddDeck([[0, 0], [3.5, 0], [3.5, 6], [0, 6]], 2.7, { name: 'Loft' }));
    const deck = p.decks[0];
    const plans = stairCandidates(p, deck.id);
    expect(plans.length).toBeGreaterThan(0);
    const d = derive(p);
    for (const s of plans) {
      expect(s.width).toBeCloseTo(1.3, 6);
      expect(s.fromY).toBeCloseTo(0, 6);
      expect(s.toY).toBeCloseTo(2.7, 6);
      const run = s.path.reduce((a, q, i) => (i ? a + dist(s.path[i - 1], q) : 0), 0);
      expect(run).toBeGreaterThanOrEqual(2.7 * 1.6 - 0.45);
      expect(pointInPolyHoles(s.path[s.path.length - 1], deck.outline)).toBe(true);
      const land = d.rooms.find((r) => r.id === (s.from as { id: string }).id)!;
      expect(pointInPolyHoles(s.landing, land.poly, land.holes)).toBe(true);
      expect(Math.abs(land.floorY - s.fromY)).toBeLessThan(0.15);
    }
  });

  it('is deterministic and rejects a walled-off approach', () => {
    let p = covered(room(10, 6, 5.2), 'flat');
    p = doOp(p, opAddDeck([[0, 0], [3.5, 0], [3.5, 6], [0, 6]], 2.7, { name: 'Loft' }));
    const a = stairCandidates(p, p.decks[0].id);
    expect(a.length).toBeGreaterThan(0);
    expect(stairCandidates(p, p.decks[0].id).map((s) => s.id)).toEqual(a.map((s) => s.id));
    // a wall across the remaining floor cuts every approach
    let q = doOp(p, opAddRun(poly([[6, 0], [6, 6]], false), { baseY: 0 }));
    q = doOp(q, opAddRun(poly([[10, 0], [6, 0]], false), { baseY: 0 }));
    q = doOp(q, opAddRun(poly([[6, 6], [10, 6]], false), { baseY: 0 }));
    q = doOp(q, opAddRun(poly([[10, 6], [10, 0]], false), { baseY: 0 }));
    expect(stairCandidates(q, q.decks[0].id)).toEqual([]);
  });

  it('offers nothing for a deck at floor level', () => {
    let p = room(8, 6, 3.0);
    p = doOp(p, opAddDeck(rect(8, 6), 0.1, { name: 'Step' }));
    expect(stairCandidates(p, p.decks[0].id)).toEqual([]);
  });
});
