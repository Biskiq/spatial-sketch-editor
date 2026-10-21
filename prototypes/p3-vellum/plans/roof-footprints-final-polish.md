# Roofs on creative footprints — final P3 polish scope

Status: proposal for owner review, 2026-10-21. Prototype-only. It records findings for production planning
(T1 / RR-2) but is not production authority. Measured against the working tree on top of `45b8ab8c`, which includes
the uncommitted F1–F4 and Hold work (17 files, 204 tests green).

## 1. What is actually janky (measured, not assumed)

The audit used the uncommitted `tests/roof-polish-review-temp.test.ts` plus a scratch probe. It samples each mesh's
top surface on a 0.5 m grid and compares it with the height evaluator.

**The compound (wing) roof is already correct where it is used.** Fitted outlines at a 0.45 m overhang:

| Footprint | flat | gable | hip | vault | dome (extruded) | raked | clerestory |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L 10×6 + 4×8 | ✓ | ✓ | ✓ | ✓ | ✓ | refused | refused |
| L with an unequal wing (3 m) | ✓ | ✓ | ✓ | ✓ | ✓ | refused | refused |
| T | ✓ | ✓ | ✓ | ✓ | ✓ | refused | refused |
| U (3 wings) | ✓ | ✓ | ✓ | ✓ | ✓ | refused | refused |
| cross / plus (3 wings) | ✓ | ✓ | ✓ | ✓ | ✓ | refused | refused |

✓ = compound, with 0 gaps, 0 double surfaces and 0.000 m mesh-vs-evaluator error over 430–560 samples. Refused =
the wings return a reason ("the section has no ridge", "a section with a step is not a compound candidate yet"), and
F1/F2 now make that state visible and repairable.

**The jank comes from three routes that never reach the wings:**

1. **A single L-, T- or U-shaped room is covered as one span.** `Inspector` passes `wings: targets.length > 1`, so
   covering one L-shaped room gives `oneSpan: undefined`, which is single span. Measured eave heights at the outline
   corners: `0.00 0.00 0.00 2.88 2.88 0.00`, i.e. **2.88 m cliffs** at the inner corner. This is the original
   L-plan bug, still live on the most common route.
2. **A roof drawn with the pen is always single span.** `readings.ts` (the roof and canopy readings, lines ~271 and
   ~282) calls `opAddOverhead` without `oneSpan`, so a freehand L roof gets the same cliffs.
3. **Two roofs placed next to each other pass through each other.** Two crossing gables: 496 of 529 overlap samples
   disagree, by up to 2.38 m. An L built from two roofs: 247 of 266 disagree, by up to 1.82 m. Only `support:` issues
   are reported; nothing says the roofs collide or offers to join them. A T wing that only *touches* the main roof's
   eave stands its gable end 1.6 m above that eave, with nothing to meet.

Roughly, the wing machinery is done and it is not wired to the routes people actually use.

## 2. Challenging the brief

- **"Different roof types should work across footprints."** Symmetric sections already work across L, T, U and plus
  plans; that is the case worth demonstrating. Stepped and one-sided sections (raked, clerestory, sawtooth, saltbox)
  over wings are not a geometry gap but an *authoring ambiguity*: which way does each wing's shed slope, and how does a
  clerestory step turn a corner? Any automatic answer is a guess that is hard to repair, which goes against the
  "unpredictable shapes" rule. Keep them refused with their reason; the repairs (*Make it a gable*, *Cover as one
  span*) already exist. **Do not add presets or per-wing sections in P3.**
- **"Placing two roof sections together should recognise joins."** A general join solver between arbitrary roofs —
  intersecting two different sections, deriving valleys, trimming each — is a roof engine. The compound mesher is an
  upper envelope of *planes* over grid cells; it cannot intersect a vault with a gable from different eaves. The
  smaller, more predictable move is **recognise, then merge**: when two roofs could be one wing roof, offer to make them
  one, and let the proven decomposition produce the joins. When they cannot, say so and offer the one change that
  would make them joinable, rather than inventing a seam.
- **Merge is the better interaction anyway.** One roof means one card, one Hold, one Edit Shape and one undo step for
  the pitch of the whole house. Two roofs that merely look joined would need the joint kept in sync on every later
  edit.

## 3. Recommended scope (S1 + S2; S3 only if S1 and S2 land quickly)

### S1 — every non-rectangular cover gets wings when they qualify (smallest, highest value)

- **Rule (one function).** `autoSpan(oh): boolean | undefined` in `wings.ts`. Return `undefined` (single span) when
  the outline is one rectangle along its frame, or for a revolve. Otherwise return `false` (wings), but only if
  `roofWingsState({ ...oh, oneSpan: false })` is `compound`. Otherwise the caller refuses with that reason.
- **Routes.**
  - `coverRoof`/`coverCheck` call it for any room count, so `Inspector` stops passing `wings: targets.length > 1`.
    The chip is disabled with the reason, as the group cover already does.
  - The pen roof readings in `readings.ts` call it too. When it refuses, the reading is still offered single span,
    but its detail says *"one span — its wings can't carry a {family}"*, so the cliff is never a surprise.
- **Drift and legacy.** In `derive`, add a red-pencil issue `cliff:{id}` for a single-span extrude roof whose
  `ohH` at any outline vertex is above 0.1 m: *"{name} rises {h} at its eave — its plan is not one span."* Fix:
  *Give it wings*, offered only if the trial is `compound`. This catches fitted outlines that grow from a rectangle
  into an L through `settle`, and older saved files.
- **Tests** (new `tests/footprints.test.ts`, built from the temp audit — see §5):
  - covering one L, T, U or plus room with each symmetric preset gives `compound` and eave height ≤ 0.01 at every
    outline vertex;
  - a raked chip on the same room is disabled, and committing it places nothing;
  - a pen-drawn L roof gives `compound`;
  - a rectangle-to-L fitted outline raises `cliff:` and its fix clears it.

### S2 — recognise two roofs that could be one, and merge them

- **Qualify** (`roofJoin(a, b): { ok, reason, merged }` in a new `src/model/roofJoin.ts`). All of these must hold:
  - both roofs are extrude and both have a surface;
  - the outlines overlap, or share a boundary at least 0.3 m long (this covers the T that only touches);
  - `|a.baseY − b.baseY| ≤ 0.05` and `|a.thick − b.thick| ≤ 0.02`;
  - the frames are parallel or perpendicular within 2°;
  - the union outline is one ring with no hole;
  - the sections are the same family (`roofName` from `section.ts`).
  
  The merged roof keeps **the larger roof's id, name, profile and dir**, `oneSpan: false`, the union of `restsOn`
  and of `fit.rooms`, and `hip` as the larger roof's. It qualifies only if `roofWingsState(merged)` is `compound`.
  One answer for the chip, the preview and the commit (the `coverCheck` pattern).
- **Where it shows** (recognition at the moment of placing is the interaction the brief asks for):
  1. **At placement.** When a pen-drawn roof reading overlaps or touches a roof it can join, the first reading is
     *"Roof joined to {A}"* (the merged roof), with the separate roof as the Tab alternative. One undo step.
  2. **On the roof card.** *Join with {A}* chip, with a hover preview of the merged roof.
  3. **As an issue for overlaps that already exist.** `collide:{a}:{b}` — *"{B} runs through {A}"*:
     - fix *Join into one roof* when `roofJoin` qualifies;
     - otherwise fix *Join with {A}'s section* when the only failure is the section family (it adopts A's profile,
       then must qualify);
     - otherwise no join fix, and the text gives the reason (different eave, off-axis, a hole). Plain *Acknowledge*
       stays available.
- **Commit.** `opJoinRoofs(aId, bId)` rewrites A, removes B and redirects `restsOn`/`fit`. Stale-candidate guard as
  in `opAddMezzanine`: the merged outline must equal the previewed one.
- **Tests** (`tests/roofJoin.test.ts`):
  - crossing gables, the two-roof L and the touching T each qualify, and the merged mesh passes the footprint probe
    (0 gaps, 0 double surfaces, error < 5 mm, eaves at 0);
  - a gable plus a vault gets *Join with {A}'s section*;
  - different eaves (3.0 / 3.6) give no join fix and say why;
  - a ring of four roofs around a court (a hole) is refused;
  - one undo step restores both roofs exactly;
  - the stale outline is refused.

### S3 (optional) — split back

*Separate this wing* on a compound roof's card reverses S2 for one wing: the merged roof keeps the rest, and the wing
becomes its own single-span roof, flagged by `collide:` until rejoined or moved. Only if S1 and S2 are done in
budget; otherwise defer.

### Demonstration for P3 closeout

1. Galleries sample, or an L room. Cover it with a gable: one roof, valleys clean, no cliffs. Switch to hip and vault.
2. Draw a T with two pen roofs. The second offers *Roof joined to Roof 1*; Tab shows the separate roof; accept.
3. Place a vault next to a gable. The issue offers *Join with Roof 1's section*.
4. Raked over the L: the chip is disabled with the reason; the repairs exist.

Screenshots for each, plus the `npm test` count.

## 4. Deferred — explicit boundaries (carry to T1 / RR-2)

| Deferred | Why not P3 | Production direction |
| --- | --- | --- |
| Stepped or one-sided sections over wings (raked, clerestory, sawtooth, saltbox) | an authoring ambiguity, not a mesh bug; a guess is unrepairable | an explicit per-wing section and a slope-direction choice, with join rules per family pair |
| Joining roofs at different eaves or of different families | needs true surface–surface intersection, beyond the planar envelope | height-field upper envelope over an exact planar arrangement (curved sections as fine planar facets), with valley/abutment classification |
| Off-axis wings (>2°), curved or freehand plans, more than 4 rectangles | the decomposition is rectilinear by design | straight-skeleton hip roofs for arbitrary polygons; keep wings as the predictable rectilinear case |
| Courtyards and holes in a cover | `coverOutline` keeps the largest ring (known gap, plan §8.7) | rings with holes through the cover pipeline; inner-ring eaves |
| Lean-to / abutment against a taller wall | needs wall–roof flashing semantics | a roof edge that terminates on a wall face, as a Layout relation |
| Dormers, roof openings beyond skylights | new massing type | a separate feature on top of the envelope |
| `continuedWings` wired to wall drags | F4's structural guard is the precondition; the drag lifecycle is Phase 2+ | keep the "structure, not size" rule as a production invariant |

## 5. Reusable algorithms and tests (worth porting, in priority order)

All are pure TypeScript with no three.js in the model. The production port goes through the one architectural
compiler (AGENTS rule 6); it must not import the prototype.

1. **Rectilinear wing decomposition** (`wings.ts` `decompose`): an axis-aligned grid from the outline's own
   coordinates → cell occupancy → maximal rectangles → greedy cover (≤ 4) → thin-wing check → primary choice →
   validation that every inner support edge ends where it is the lower roof. Returns a reason on refusal, never wrong
   geometry. This is the core worth keeping.
2. **Planar upper-envelope mesher** (`scene/build/overheads.ts` `buildCompound`, `clipHalfPlane`, `diffPlane`): per
   cell, each support is one plane; pieces are clipped by pairwise plane differences so each keeps the region where
   it is highest. Exact valleys and hips with no boolean mesh ops. Generalises to any set of planar height fields.
3. **Mesh-vs-evaluator probe** (`hits` in the temp audit): barycentric vertical ray tests over the top surface,
   reporting gaps, double surfaces and the maximum error against the evaluator. A cheap, renderer-free geometry
   oracle. **Promote it** from `tests/roof-polish-review-temp.test.ts` into `tests/support/roofProbe.ts` with
   assertions, and drop the `/tmp` JSON write.
4. **One-answer qualification** (`coverCheck`, and `roofJoin` from S2): chip, preview and commit call one pure
   function returning `{ ok, reason, candidate }`; the op refuses stale candidates by exact geometry comparison. A
   pattern, not a module, and the most important one to keep.
5. **Section reading** (`section.ts`): joints/parts, family classification and preset tolerance `max(0.12, 0.035·span)`.
6. **Structural continuity** (`continuedWings` after F4): match wings by overlap and compare structure, not size.
7. **Test fixtures**: the footprint set (L, unequal L, T, U, plus) and the two-roof pairs (crossing, L butt, T touch)
   in §1, as the shared regression set for any production roof work.

## 6. Size and order

S1 ≈ 0.5–1 day, S2 ≈ 1.5–2 days, S3 ≈ 0.5 day, and demo plus screenshots ≈ 0.5 day. Land S1 first: it removes the
measured cliffs on the most common route, and S2's merged roofs reuse its rule. This work comes after the in-flight
F1–F4 and Hold changes are committed, and touches `ops.ts`, `readings.ts`, `derive.ts` and `Inspector.tsx`, which
those changes also edit.
