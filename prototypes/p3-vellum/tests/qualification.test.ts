// What an offer may claim: the group cover, the deck and its supports, the stair, and the exact candidate a click
// commits. Each of these used to answer a different question at the chip, in the preview and at the commit.
import { describe, it, expect } from 'vitest';
import { emptyProject, Project } from '../src/model/types';
import {
  runTxn, opAddRun, opRoom, opCoverRooms, coverCheck, opAddOverhead, opAddDeck, opAddMezzanine, opAddStairTo, opAddPost, opOverhead,
} from '../src/model/ops';
import { derive } from '../src/model/derive';
import { roofWingsState } from '../src/model/wings';
import { buildOverhead } from '../src/scene/build/overheads';
import { mezzanineOffer, stairPlansFor, stairCandidates, deckTopFor } from '../src/model/offers';
import { presetProfile, ohHasSurface, ohRidge, ohSpan, ohCovers, ohH } from '../src/model/overheadGeom';
import { roofZoneAt } from '../src/model/roofZones';
import type { Overhead } from '../src/model/types';
import { V2, dist, sub, polyArea, bbox, pointInPoly, distToPolyEdge, fromAngle } from '../src/model/geom2d';
import type { StrokeFit } from '../src/model/strokes';

const poly = (pts: V2[], closed = true): StrokeFit => ({
  kind: closed ? 'closed' : 'open', pts, bulge: pts.map(() => 0).slice(0, closed ? pts.length : pts.length - 1),
  closed, center: [0, 0], radius: 0, length: 0, curved: false, corners: 0,
});
const rect = (x0: number, z0: number, x1: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const doOp = (p: Project, op: any) => runTxn(p, op).after;

/** The projected top area from the mesh, the same method the wings tests use. */
function meshArea(oh: Overhead) {
  const P = buildOverhead(oh, []).top.pos;
  let A = 0;
  for (let i = 0; i < P.length; i += 9)
    A += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
  return A;
}

/** Top-surface height from the rendered triangles, for checking the mesh against the shared evaluator. */
function meshProbe(oh: Overhead) {
  const P = buildOverhead(oh, []).top.pos;
  const tris = [] as { a: V2; b: V2; c: V2; ya: number; yb: number; yc: number }[];
  for (let i = 0; i < P.length; i += 9) {
    const a: V2 = [P[i], P[i + 2]], b: V2 = [P[i + 3], P[i + 5]], c: V2 = [P[i + 6], P[i + 8]];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-9) continue;
    tris.push({ a, b, c, ya: P[i + 1], yb: P[i + 4], yc: P[i + 7] });
  }
  return (q: V2): number | null => {
    let best: number | null = null;
    for (const t of tris) {
      const d = (t.b[0] - t.a[0]) * (t.c[1] - t.a[1]) - (t.c[0] - t.a[0]) * (t.b[1] - t.a[1]);
      const l1 = ((t.b[0] - q[0]) * (t.c[1] - q[1]) - (t.c[0] - q[0]) * (t.b[1] - q[1])) / d;
      const l2 = ((t.c[0] - q[0]) * (t.a[1] - q[1]) - (t.a[0] - q[0]) * (t.c[1] - q[1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
      const y = l1 * t.ya + l2 * t.yb + l3 * t.yc;
      if (best === null || y > best) best = y;
    }
    return best;
  };
}

function eaveSamples(oh: Overhead): V2[] {
  const st = roofWingsState(oh);
  if (st.kind !== 'compound') return [];
  const d = fromAngle(oh.dir), e: V2 = [-d[1], d[0]];
  const out: V2[] = [];
  for (const wing of st.wings) {
    const [w0, w1, v0, v1] = wing.rect;
    const spanW = wing.span === 'w';
    const s0 = spanW ? w0 : v0, s1 = spanW ? w1 : v1;
    const r0 = spanW ? v0 : w0, r1 = spanW ? v1 : w1;
    for (const [s, inward] of [[s0, 1], [s1, -1]] as const) for (let k = 1; k <= 7; k++) {
      const r = r0 + ((r1 - r0) * k) / 8;
      const w = spanW ? s + inward * 0.005 : r;
      const v = spanW ? r : s + inward * 0.005;
      const q: V2 = [d[0] * w + e[0] * v, d[1] * w + e[1] * v];
      if (distToPolyEdge(q, oh.outline) < 0.02) out.push(q);
    }
  }
  return out;
}

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
    const bad = coverCheck(p, r, 'clerestory');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/step|asymmetr/i);
    expect(bad.overhead).toBeNull();
    // the same rooms can still share a gable, so the refusal is the section, not the group
    expect(coverCheck(p, r, 'gable').ok).toBe(true);
    // Flat is a valid grouped cover too; its explicit coverage choice must survive a later pitch edit.
    const flat = coverCheck(p, r, 'flat');
    expect(flat.ok).toBe(true);
    expect(flat.overhead!.oneSpan).toBe(false);

    const before = JSON.stringify(p);
    const t = runTxn(p, opCoverRooms(r, 'clerestory'));
    expect(t.after.overheads.length).toBe(0);
    expect(t.after.nextId).toBe(p.nextId); // the refused draft spent no id
    expect(JSON.stringify(t.after)).toBe(before);
    expect(t.notes.some((n) => /cannot cover/i.test(n.text))).toBe(true);

    const ok = runTxn(p, opCoverRooms(r, 'gable'));
    expect(ok.after.overheads.length).toBe(1);
    expect(roofWingsState(ok.after.overheads[0]).kind).toBe('compound');
  });

  it('reports a wing roof that cannot be divided instead of quietly stretching it into one span', () => {
    const p = L();
    const r = ids(p);
    // the shape an imported file could carry: a wing roof whose section stopped fitting its wings
    const shell = coverCheck(p, r, 'gable').overhead!;
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

  it('keeps a grouped flat cover compound when raised, with a continuous mesh and true eaves', () => {
    let p = L();
    const roomIds = ids(p);
    p = doOp(p, opCoverRooms(roomIds, 'flat'));
    let oh = p.overheads[0];
    expect(oh.oneSpan).toBe(false);
    expect(roofWingsState(oh).kind).toBe('compound');
    expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
    for (const q of eaveSamples(oh)) expect(ohH(oh, q)).toBeLessThan(0.01);

    const st = roofWingsState(oh);
    if (st.kind !== 'compound') throw new Error('flat grouped cover did not qualify');
    p = doOp(p, opOverhead(oh.id, { profile: presetProfile('gable', st.primarySpan) }));
    oh = p.overheads[0];
    expect(oh.oneSpan).toBe(false);
    expect(roofWingsState(oh).kind).toBe('compound');
    expect(meshArea(oh)).toBeCloseTo(Math.abs(polyArea(oh.outline)), 1);
    for (const q of eaveSamples(oh)) expect(ohH(oh, q)).toBeLessThan(0.01);

    const probe = meshProbe(oh), b = bbox(oh.outline);
    let samples = 0;
    for (let x = b.min[0] + 0.19; x < b.max[0]; x += 0.37) for (let z = b.min[1] + 0.23; z < b.max[1]; z += 0.31) {
      const q: V2 = [x, z];
      if (!pointInPoly(q, oh.outline)) continue;
      const y = probe(q);
      if (y === null) continue;
      samples++;
      expect(y).toBeCloseTo(oh.baseY + oh.thick + ohH(oh, q), 2);
    }
    expect(samples).toBeGreaterThan(20);

    // The explicit choice is authored data. An old save without it remains a single-span roof.
    const reloaded = JSON.parse(JSON.stringify(p)) as Project;
    expect(reloaded.overheads[0].oneSpan).toBe(false);
    expect(roofWingsState(reloaded.overheads[0]).kind).toBe('compound');
    const legacy = { ...reloaded.overheads[0], oneSpan: undefined } as Overhead;
    expect(roofWingsState(legacy).kind).toBe('single');
  });

  it('qualifies a revolved mesh before choosing its mesher', () => {
    const p = L();
    const shell = coverCheck(p, ids(p), 'gable').overhead!;
    const unsupported = { ...shell, form: 'revolve' } as Overhead;
    expect(ohHasSurface(unsupported)).toBe(false);
    expect(buildOverhead(unsupported, []).top.pos.length).toBe(0);

    const round = doOp(emptyProject(), opAddOverhead(rect(0, 0, 8, 8), 3, {
      form: 'revolve', profile: presetProfile('dome', 8),
    })).overheads[0];
    expect(ohHasSurface(round)).toBe(true);
    expect(buildOverhead(round, []).top.pos.length).toBeGreaterThan(0);
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

describe('a click also commits the supports it previewed', () => {
  it('refuses a loft whose posts or stair changed since it was offered, and commits the fresh one exactly', () => {
    let p = room10x6(5.2);
    p = doOp(p, opCoverRooms(ids(p), 'flat'));
    const roomId = derive(p).rooms[0].id;
    const cand = mezzanineOffer(p, roomId).candidates[0];
    expect(cand.posts.length).toBeGreaterThan(0);

    // a post dropped on the offered stair moves the qualified layout, but not the loft's id, outline or height
    const blocked = cand.stair.path[Math.floor(cand.stair.path.length / 2)];
    const moved = doOp(p, opAddPost(blocked));
    const fresh = mezzanineOffer(moved, roomId).candidates.find((c) => c.id === cand.id);
    expect(fresh).toBeTruthy();
    expect(fresh!.outline).toEqual(cand.outline);
    expect(fresh!.y).toBeCloseTo(cand.y, 6);
    expect(fresh!.posts).not.toEqual(cand.posts);

    const t = runTxn(moved, opAddMezzanine(roomId, cand));
    expect(t.after.decks.length).toBe(0);
    expect(t.after.posts.length).toBe(1); // only the post that was added by hand
    expect(t.notes.some((n) => /supports changed since it was offered/i.test(n.text))).toBe(true);

    // a fresh preview of the same loft commits exactly, supports included
    const made = runTxn(moved, opAddMezzanine(roomId, fresh!));
    expect(made.after.decks.length).toBe(1);
    expect(made.after.posts.filter((q) => q.id !== moved.posts[0].id).map((q) => q.at)).toEqual(fresh!.posts);
  });
});

describe('a roof with no surface has no heights', () => {
  /** The L with both rooms open to the roof, covered as one gable, then given a section the wings cannot carry. */
  function broken(follow = true, wallTop = 3) {
    let p = L(wallTop);
    const roomIds = derive(p).rooms.map((r) => r.id);
    for (const id of roomIds) p = doOp(p, opRoom(id, follow ? {} : { ceiling: 'flat' as const }));
    p = doOp(p, opCoverRooms(roomIds, 'gable'));
    const before = p.overheads[0];
    p = doOp(p, opOverhead(before.id, { profile: presetProfile('raked', ohSpan(before)) }));
    return { p, oh: p.overheads[0], roomIds };
  }

  it('falls back to the walls, keeps the rooms claimed, and refuses every offer', () => {
    const { p, oh, roomIds } = broken();
    expect(roofWingsState(oh).kind).toBe('unsupported');
    expect(ohHasSurface(oh)).toBe(false);
    expect(buildOverhead(oh, []).top.pos.length).toBe(0);

    const d = derive(p);
    // every wall falls back to its own top, not to the 4.90 m single-span underside
    for (const w of d.walls.values()) expect(w.maxTop).toBeLessThanOrEqual(3.01);
    // the eave is the only height the roof can claim, so there is no peak and no ridge snap
    expect(ohRidge(oh)).toBeCloseTo(oh.baseY + oh.thick, 6);
    expect(d.snaps.filter((s) => s.kind === 'ridge' && s.ids.includes(oh.id))).toEqual([]);
    // ownership is not height: the rooms are still this roof's, so a second roof is never offered over it
    for (const id of roomIds) expect(d.rooms.find((r) => r.id === id)!.coveredBy).toBe(oh.id);
    // and nothing is measured against a surface that is not drawn
    expect(ohCovers(oh, [5, 5])).toBe(false);
    for (const id of roomIds) {
      const check = mezzanineOffer(p, id);
      expect(check.candidates).toEqual([]);
      expect(check.why).toMatch(/no surface/);
    }
    expect(roofZoneAt(oh, [5, 5], { ridge: 0.2, end: 0.2, eave: 0.2 })).toBeNull();
  });

  it('does not let a flat ceiling stand in for the missing roof', () => {
    const { p, oh, roomIds } = broken(false, 5);
    for (const id of roomIds) {
      expect(derive(p).rooms.find((r) => r.id === id)!.coveredBy).toBe(oh.id);
      const check = mezzanineOffer(p, id);
      expect(check.candidates).toEqual([]);
      expect(check.why).toMatch(/no surface/);
    }
  });

  it('says so when an edit removes the surface, and offers only repairs a trial proves', () => {
    let p = L(3);
    const roomIds = derive(p).rooms.map((r) => r.id);
    p = doOp(p, opCoverRooms(roomIds, 'gable'));
    const oh = p.overheads[0];
    const t = runTxn(p, opOverhead(oh.id, { profile: presetProfile('raked', ohSpan(oh)) }));
    const note = t.notes.find((n) => /no surface/.test(n.text));
    expect(note).toBeTruthy();
    expect(note!.text).toMatch(/repairs that work/);

    const issue = derive(t.after).issues.find((i) => i.key === `wings:${oh.id}`)!;
    const gable = issue.fixes.find((f) => f.label === 'Make it a gable');
    // one span over this L would stop 2.9 m up at the inner eave, so it is not a repair here
    expect(gable).toBeTruthy();
    expect(issue.fixes.find((f) => f.label === 'Cover as one span')).toBeUndefined();

    const q = structuredClone(t.after);
    gable!.apply(q);
    expect(roofWingsState(q.overheads[0]).kind).toBe('compound');
    expect(meshArea(q.overheads[0])).toBeCloseTo(Math.abs(polyArea(q.overheads[0].outline)), 1);
  });

  it('offers a flat section when the plan itself is the reason and one span would stop in mid-air', () => {
    // an edge 3° off the frame cannot be carried by a gable however the section is drawn
    const slanted: V2[] = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 10], [4.6, 9.2], [4.6, 6], [0, 6]];
    const p = doOp(emptyProject(), opAddOverhead(slanted, 3, { oneSpan: false, profile: presetProfile('gable', 6) }));
    const oh = p.overheads[0];
    expect(ohHasSurface(oh)).toBe(false);
    const issue = derive(p).issues.find((i) => i.key === `wings:${oh.id}`)!;
    expect(issue.fixes.map((f) => f.label)).toEqual(['Make it flat']);
    const q = structuredClone(p);
    issue.fixes[0].apply(q);
    expect(ohHasSurface(q.overheads[0])).toBe(true);
    expect(derive(q).issues.some((i) => i.key.startsWith('cliff:') || i.key.startsWith('wings:'))).toBe(false);
  });
});
