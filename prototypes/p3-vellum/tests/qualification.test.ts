// What an offer may claim: the group cover, the deck and its supports, the stair, and the exact candidate a click
// commits. Each of these used to answer a different question at the chip, in the preview and at the commit.
import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import {
  runTxn, opAddRun, opRoom, opCoverRooms, coverCheck, opAddOverhead, opAddDeck, opAddMezzanine, opAddStairTo,
} from '../src/model/ops';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { buildOverhead } from '../src/scene/build/overheads';
import { mezzanineOffer, stairPlansFor, stairCandidates, deckTopFor } from '../src/model/offers';
import { presetProfile } from '../src/model/overheadGeom';
import { V2, dist, sub } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const poly = (pts: V2[], closed = true): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const doOp = (p: Project, op: any) => runTxn(p, op).after;

/** A 10 × 6 room with a 4 × 8 wing: the L every compound question is asked on. */
function L(wallTop = 3): Project {
  let p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, 10, 6)), { baseY: 0 }));
  p = doOp(p, opAddRun(poly([[10, 6], [10, 14], [6, 14], [6, 6]], false), { baseY: 0 }));
  for (const r of derive(p).rooms) p = doOp(p, opRoom(r.id, { height: wallTop }));
  return p;
}
const ids = (p: Project) => derive(p).rooms.map((r) => r.id);
const room10x6 = (height: number) => {
  const p = doOp(emptyProject(), opAddRun(poly(rect(0, 0, 10, 6)), { baseY: 0 }));
  return doOp(p, opRoom(derive(p).rooms[0].id, { height }));
};

function distToPath(q: V2, path: V2[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], b = path[i + 1], ab = sub(b, a);
    const l2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / l2));
    best = Math.min(best, dist(q, [a[0] + ab[0] * t, a[1] + ab[1] * t]));
  }
  return best;
}

describe('a preset the group cannot carry is refused before it is drawn', () => {
  it('answers the chip, the preview and the commit the same way, and leaves nothing behind', () => {
    const p = L();
    const r = ids(p);
    // a stepped section cannot be shared by the wings of an L: the chip must not be offered, and a commit must not land
    const bad = coverCheck(p, r, 'clerestory', { wings: true });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/step|asymmetr/i);
    expect(bad.overhead).toBeNull();
    // the same rooms can still share a gable, so the refusal is the section, not the group
    expect(coverCheck(p, r, 'gable', { wings: true }).ok).toBe(true);
    // and a flat section is one surface with or without wings, so it is never refused for wanting wings
    const flat = coverCheck(p, r, 'flat', { wings: true });
    expect(flat.ok).toBe(true);
    expect(flat.overhead!.oneSpan).toBeUndefined();

    const before = JSON.stringify(p);
    const t = runTxn(p, opCoverRooms(r, 'clerestory', { wings: true }));
    expect(t.after.overheads.length).toBe(0);
    expect(t.after.nextId).toBe(p.nextId); // the refused draft spent no id
    expect(JSON.stringify(t.after)).toBe(before);
    expect(t.notes.some((n) => /cannot cover/i.test(n.text))).toBe(true);

    const ok = runTxn(p, opCoverRooms(r, 'gable', { wings: true }));
    expect(ok.after.overheads.length).toBe(1);
    expect(roofWingsState(ok.after.overheads[0]).kind).toBe('compound');
  });

  it('reports a wing roof that cannot be divided instead of quietly stretching it into one span', () => {
    const p = L();
    const r = ids(p);
    // the shape an imported file could carry: a wing roof whose section stopped fitting its wings
    const shell = coverCheck(p, r, 'gable', { wings: true }).overhead!;
    expect(shell.oneSpan).toBe(false);
    const legacy = { ...shell, profile: presetProfile('clerestory', 12) };
    expect(roofWingsState(legacy).kind).toBe('unsupported');
    // nothing is drawn, so no stretched surface can be mistaken for this roof
    expect(buildOverhead(legacy, []).top.pos.length).toBe(0);
    // and the app says why
    const q: Project = { ...p, overheads: [legacy] };
    const issue = derive(q).issues.find((i) => i.key === `wings:${legacy.id}`);
    expect(issue).toBeTruthy();
    expect(issue!.text).toMatch(/no surface|cannot be carried/i);
  });
});

describe('a mezzanine is offered with supports its stair can use', () => {
  it('keeps every post out of the offered stair, and keeps the stair after the commit', () => {
    let p = room10x6(5.2);
    p = doOp(p, opCoverRooms(ids(p), 'flat'));
    const roomId = derive(p).rooms[0].id;
    const cand = mezzanineOffer(p, roomId).candidates[0];
    expect(cand.posts.length).toBeGreaterThan(0);
    for (const q of cand.posts) expect(distToPath(q, cand.stair.path)).toBeGreaterThan(cand.stair.width / 2);

    const made = doOp(p, opAddMezzanine(roomId, cand));
    const deck = made.decks[0];
    expect(made.posts.length).toBe(cand.posts.length);
    expect(stairCandidates(made, deck.id).some((s) => s.id === cand.stair.id)).toBe(true);
    expect(derive(made).issues.filter((i) => i.kind === 'support' && i.ids.includes(deck.id))).toEqual([]);
  });
});

describe('stair headroom is read through ceilings and across the full width', () => {
  const ring = rect(1, 1, 4, 4);

  it('refuses a run whose top is under a flat ceiling', () => {
    // ceiling at 3.0 m over a deck at 2.7 m: the middle of the run is fine, its top is not
    let p = room10x6(3.0);
    p = doOp(p, opAddOverhead(rect(-0.2, -0.2, 10.2, 6.2), 5.2, { preset: 'flat' }));
    expect(stairPlansFor(p, ring, deckTopFor(0), 0)).toEqual([]);

    // the same deck under a ceiling high enough: the offer exists, so the refusal above is the ceiling
    let q = room10x6(5.2);
    q = doOp(q, opCoverRooms(ids(q), 'flat'));
    expect(stairPlansFor(q, ring, deckTopFor(0), 0).length).toBeGreaterThan(0);
  });

  it('refuses a run that clears on its centre line but not over its width', () => {
    let p = room10x6(5.2);
    p = doOp(p, opCoverRooms(ids(p), 'flat'));
    const ring = rect(0.2, 0.2, 3.5, 5.8);
    const plans = stairPlansFor(p, ring, 2.7, 0);
    expect(plans.length).toBeGreaterThan(0);
    const pl = plans[0];
    // a low strip alongside this run's centre line: nothing is over the line itself, but the stair's own width
    // passes under it. The plan is refused; the others may stand.
    const a = pl.path[0], b = pl.path[1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: V2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const n: V2 = [-d[1], d[0]];
    const at = (s: number, off: number): V2 => [a[0] + d[0] * s + n[0] * off, a[1] + d[1] * s + n[1] * off];
    const strip = [at(0.2, 0.3), at(len - 0.2, 0.3), at(len - 0.2, 0.9), at(0.2, 0.9)];
    const blocked = doOp(p, opAddOverhead(strip, 1.95, { preset: 'flat' }));
    expect(stairPlansFor(blocked, ring, 2.7, 0).some((s) => s.id === pl.id)).toBe(false);
  });
});

describe('a click commits the candidate it previewed, not whatever now shares its id', () => {
  it('refuses a loft whose outline moved since it was offered', () => {
    let p = room10x6(5.2);
    p = doOp(p, opCoverRooms(ids(p), 'flat'));
    const roomId = derive(p).rooms[0].id;
    const cand = mezzanineOffer(p, roomId).candidates[0];
    const doctored = { ...cand, outline: cand.outline.map(([x, z]) => [x + 0.2, z] as V2) };
    const t = runTxn(p, opAddMezzanine(roomId, doctored));
    expect(t.after.decks.length).toBe(0);
    expect(t.notes.some((n) => /moved since it was offered/i.test(n.text))).toBe(true);
  });

  it('refuses a stair previewed against a deck that has since moved, instead of committing a different path', () => {
    const base = () => {
      let p = room10x6(5.2);
      return doOp(p, opCoverRooms(ids(p), 'flat'));
    };
    const old = doOp(base(), opAddDeck(rect(0.2, 0.2, 3.5, 5.8), 2.7));
    const plan = stairCandidates(old, old.decks[0].id)[0];
    expect(plan).toBeTruthy();
    // the deck slides 20 cm: the same edge and position still give a plan with the same id, at another place
    const moved = doOp(base(), opAddDeck(rect(0.4, 0.2, 3.7, 5.8), 2.7));
    const t = runTxn(moved, opAddStairTo(moved.decks[0].id, plan));
    expect(t.after.stairs.length).toBe(0);
    expect(t.notes.some((n) => /moved since it was offered/i.test(n.text))).toBe(true);
    // a fresh preview of the moved deck is committed exactly
    const fresh = stairCandidates(moved, moved.decks[0].id)[0];
    const made = runTxn(moved, opAddStairTo(moved.decks[0].id, fresh));
    expect(made.after.stairs[0].path).toEqual(fresh.path);
  });
});
