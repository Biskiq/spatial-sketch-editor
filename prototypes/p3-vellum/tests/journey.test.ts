import { describe, it, expect } from 'vitest';
import { emptyProject, Project, Overhead } from '../src/model/types';
import { runTxn, opAddRun, opRoom, opCoverRooms, opOverhead, opAddMezzanine, opAddStairTo } from '../src/model/ops';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { presetProfile, ensureShoulder, pullShoulder, profileSymmetric, ohH, ohUndersideAt } from '../src/model/overheadGeom';
import { hipStops } from '../src/model/detents';
import { mezzanineOffer, stairPlansFor, lowestOverheadAbove, DECK_THICK, MIN_ABOVE, MIN_BELOW, deckTopFor } from '../src/model/offers';
import { buildOverhead } from '../src/scene/build/overheads';
import { V2, bbox, pointInPoly, polyArea } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const poly = (pts: V2[], closed = true): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const doOp = (p: Project, op: any, ch: any = {}) => runTxn(p, op, ch).after;

/**
 * The §11.3 cottage, made with the model operations the gestures commit: a 10 × 6 room with a 4 × 8 wing, both the
 * same height, covered in one accepted step, the ridge dragged up to 45° over the 6 m room, a ridge end taken to the
 * even-hip detent, the slopes made fuller (a real bow, not a straight line), and the roof drawn out to a 0.6 m
 * overhang. `wallTop` is the one thing the mezzanine step cannot invent for itself.
 */
function cottage(wallTop = 3) {
  let p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, 10, 6)), { baseY: 0 }));
  p = doOp(p, opAddRun(poly([[10, 6], [10, 14], [6, 14], [6, 6]], false), { baseY: 0 }));
  const d = derive(p);
  if (d.rooms.length !== 2) throw new Error(`expected two rooms, got ${d.rooms.length}`);
  for (const r of d.rooms) p = doOp(p, opRoom(r.id, { height: wallTop }));
  // one cover for both rooms; turning wings on is part of that accepted step, not a second Undo
  p = doOp(p, opCoverRooms(derive(p).rooms.map((r) => r.id), 'gable', { wings: true }));
  const oh = p.overheads[0];

  const steep = presetProfile('gable', 6).map((q, i) => (i === 1 ? { ...q, h: 3 } : q)); // 45° over the 6 m room
  p = doOp(p, opOverhead(oh.id, { profile: steep }));

  const even = hipStops(oh).find((s) => s.key === 'hip:even');
  if (!even) throw new Error('no even hip stop on a symmetric 45° gable');
  p = doOp(p, opOverhead(oh.id, { hip: even.at }));

  let prof = ensureShoulder(ensureShoulder(p.overheads[0].profile, 'L'), 'R');
  prof = pullShoulder(prof, 'L', -0.06);
  p = doOp(p, opOverhead(oh.id, { profile: prof }));

  const q = p.overheads[0];
  p = doOp(p, opOverhead(q.id, { fit: { ...q.fit!, overhang: 0.6 } }));
  const rooms = derive(p).rooms;
  return { p, block: rooms[0].id, wing: rooms[1].id, evenHip: even.at };
}

const oh0 = (p: Project): Overhead => p.overheads[0];

/** Projected top area from the mesh, the measure hip.test.ts and wings.test.ts use. */
function meshArea(oh: Overhead) {
  const P = buildOverhead(oh, []).top.pos;
  let A = 0;
  for (let i = 0; i < P.length; i += 9)
    A += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
  return A;
}

/** Clear height over a deck at `deckY`, capped by a flat ceiling the way the offer reads it. */
function clearAt(p: Project, q: V2, deckY: number, ceilingY: number | null) {
  const oh = lowestOverheadAbove(p, q, deckY);
  const top = oh ? Math.min(ohUndersideAt(oh, q), ceilingY ?? Infinity) : ceilingY ?? Infinity;
  return top - deckY;
}

describe('Phase 0 · the §11.3 cottage, made the way the plan says it is made', () => {
  it('is one continuous compound roof after hips, fullness and the longer overhang', () => {
    const { p, evenHip } = cottage();
    const oh = oh0(p);
    const st = roofWingsState(oh);
    if (st.kind !== 'compound') throw new Error(`cottage roof: ${st.kind} ${st.kind === 'unsupported' ? st.reason : ''}`);
    expect(st.wings.length).toBe(2);
    // spans are read on the roof's own outline: 6 m and 4 m of room plus 0.12 m of slab half-thickness and 0.6 m of
    // overhang on each edge
    const spans = st.wings.map((w) => (w.span === 'w' ? w.rect[1] - w.rect[0] : w.rect[3] - w.rect[2])).sort((a, b) => a - b);
    expect(spans[0]).toBeCloseTo(4 + 1.44, 6);
    expect(spans[1]).toBeCloseTo(6 + 1.44, 6);
    // the mesh covers the outline exactly once: hips and valleys have no cliffs or seams
    expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
    expect(oh.hip).toBeCloseTo(evenHip, 6);
    expect(oh.fit!.overhang).toBeCloseTo(0.6, 6);
    expect(Math.max(...oh.profile.map((q) => q.h))).toBeCloseTo(3, 6);
    expect(profileSymmetric(oh.profile)).toBe(true);
    expect(oh.profile.some((q) => !q.crease)).toBe(true);
  });

  it('qualifies a mezzanine and its stair together in the room made tall enough for one', () => {
    const { p, block, wing } = cottage(5);
    expect(roofWingsState(oh0(p)).kind).toBe('compound');
    const room = derive(p).rooms.find((r) => r.id === block)!;
    const wingRoom = derive(p).rooms.find((r) => r.id === wing)!;

    // the arithmetic the wall top has to meet, and it is the caveat: 2.40 below + 0.30 slab + 2.10 above = 4.80 m
    expect(MIN_BELOW + DECK_THICK + MIN_ABOVE).toBeCloseTo(4.8, 6);
    expect(room.topY).toBeCloseTo(5, 6);

    const offer = mezzanineOffer(p, block);
    expect(offer.why).toBe('');
    expect(offer.candidates.length).toBeGreaterThan(0);
    const cand = offer.candidates[0];
    expect(cand.y).toBeCloseTo(deckTopFor(room.floorY), 6);
    expect(cand.below).toBeGreaterThanOrEqual(MIN_BELOW - 1e-6);
    expect(cand.above).toBeGreaterThanOrEqual(MIN_ABOVE - 1e-6);
    // it comes with its own stair, not as a promise of a second decision
    expect(cand.stair.from.kind).toBe('room');
    expect(cand.stair.fromY).toBeCloseTo(room.floorY, 6);
    expect(cand.stair.toY).toBeCloseTo(cand.y, 6);
    expect(cand.stair.width).toBeCloseTo(1.3, 6);
    expect(pointInPoly(cand.stair.landing, room.poly)).toBe(true);
    const run = Math.hypot(cand.stair.path[1][0] - cand.stair.path[0][0], cand.stair.path[1][1] - cand.stair.path[0][1]);
    expect(run).toBeGreaterThanOrEqual((cand.y - room.floorY) * 1.6 - 0.45);
    // and mezzanineOffer itself returns the same project it was given
    expect(p.decks.length).toBe(0);
    expect(p.stairs.length).toBe(0);

    // one step makes the deck (with the posts its own support rule asks for) and the stair, and the candidate's
    // own stair is what gets built
    let made = doOp(p, opAddMezzanine(block, cand));
    const deck = made.decks[0];
    expect(deck.y).toBeCloseTo(cand.y, 6);
    expect(deck.thick).toBeCloseTo(DECK_THICK, 6);
    expect(derive(made).issues.filter((i) => i.kind === 'support' && i.ids.includes(deck.id))).toEqual([]);
    made = doOp(made, opAddStairTo(deck.id, cand.stair));
    expect(made.stairs.length).toBe(1);
    expect(made.stairs[0].toY).toBeCloseTo(deck.y, 6);
    expect(made.stairs[0].from.kind).toBe('room');
    expect(derive(made).issues.filter((i) => i.kind === 'support' && i.ids.includes(deck.id))).toEqual([]);
    // the wing room, under the same roof, is offered its own loft from its own surface
    expect(wingRoom.coveredBy).toBe(oh0(p).id);
    expect(mezzanineOffer(p, wing).why).toBe('');
    expect(mezzanineOffer(p, wing).candidates.length).toBeGreaterThan(0);
  });

  it('offers nothing in the 3 m cottage, and the recorded reason is its ceiling, not a broken roof', () => {
    const { p, block } = cottage();
    const offer = mezzanineOffer(p, block);
    expect(offer.candidates).toEqual([]);
    expect(offer.why).toMatch(/headroom/);

    const room = derive(p).rooms.find((r) => r.id === block)!;
    const deckY = deckTopFor(room.floorY);
    expect(deckY).toBeCloseTo(2.7, 6);
    // the room's flat ceiling at its wall top is 3.0, so the space over a 2.7 m deck is 0.3 m everywhere: no band,
    // hand-placed or offered, can clear 2.1 m. The roof above rises to 6 m at the ridge and cannot help.
    expect(room.topY).toBeCloseTo(3, 6);
    const { min, max } = bbox(room.poly);
    let best = 0;
    for (let x = min[0] + 0.2; x < max[0]; x += 0.4)
      for (let z = min[1] + 0.2; z < max[1]; z += 0.4) {
        const q: V2 = [x, z];
        if (pointInPoly(q, room.poly)) best = Math.max(best, clearAt(p, q, deckY, room.topY));
      }
    expect(best).toBeLessThan(MIN_ABOVE);
    expect(best).toBeCloseTo(0.3, 6);
    // and with nowhere clearing, no hand-placed deck outline can be served either
    const band: V2[] = [[3.2, 1.8], [6.8, 1.8], [6.8, 4.2], [3.2, 4.2]];
    expect(stairPlansFor(p, band, deckY, room.floorY)).toEqual([]);
  });
});
