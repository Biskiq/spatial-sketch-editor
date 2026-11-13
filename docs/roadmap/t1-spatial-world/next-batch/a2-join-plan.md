# T1 A2 — Join Walls (`layout.wall-join`)

**Authority:** T1 next-batch roadmap rev 3, A2 (Tier 1), PR #290. Base `main` @ `06f0d0df`
(A1 split merged). **Revision 2**: tangency gate added, collision handler localised,
split-inverse assertions corrected.

## Goal

Join two compatible Walls by removing their degree-2 Junction, as **one intent over the
existing `planDissolveJunction`**. No new planner family, no new topology, no format change
(format 7 stays).

##Interaction

Extend the existing **Plan-only, fine-pointer, unselected-Junction drag**
(`updateIdleJunctionHover` → `layout-junction-hover` → `JunctionHoverGesture`), mirroring the
bend-point removal rule (`0.12 m` enter / `0.3 m` leave hysteresis):

- Removal zone = chord between the pair's two far endpoints; offered only when the joint has
  exactly two incident Walls (neither a self-loop).
- Entering arms removal: the mark reads **Remove joint** and previews the real dissolve
  candidate; leaving returns to the ordinary junction move (hysteresis: must leave once before
  arming).
- Release while armed accepts one captured `layout-wall-join` intent. A refused preview keeps its
  attempted chord on screen and refuses on release in words: nothing written, no history entry.
- Degree ≠ 2 joints keep the plain move and are never offered removal.
- **Eraser — not shipped, genuine integration dependency.** The Eraser resolves winners only
  through Plan fragments (`wall|opening|object|room-floor`) and dispatches to that subject's
  existing Card delete. A Junction has neither a Plan fragment nor a Card, so supporting it needs
  a fragment-less host-tool subject channel in `stage-facade.ts`/`stage-eraser.ts` — shared Stage
  contract, outside A2, colliding with the halted T2 surface. The PR states this and names the
  follow-up. A regression test pins that an Eraser press on a joint still resolves the incident
  **Wall**, so A2 never makes the Eraser ambiguous.

## Survivor identity

`planDissolveJunction` already decides, with no geometry input:

1. the Wall that **ends** at the Junction survives — the exact inverse of split (the start-side
   fragment kept the id);
2. if both or neither end there, the **lexicographically smaller Wall id** survives.

The joined Wall keeps the survivor's id, thickness, height, name (falling back to the other's)
and starts at the survivor's far endpoint; the other Wall and the Junction retire.
`reconcileRooms` rewrites boundaries, so the surviving Wall and every affected Room keep their
ids.

## Lineage

- **preserved** — survivor Wall; every Opening (id kept, `wallId`/`offset` rebased by exact arc
  length, world position unchanged); every Room naming either Wall.
- **retired** — the other Wall; the Junction.
- **created** — none. The demoted curve knot is not a ledger subject; its id is capture-derived
  and stated in words.

## Curved ID capture

`nextWallCurveKnotId` (`layout-wall-dissolve.ts`) counts occupancy — the `T1.P02.S01 §1`
hazard. Replace with `allocateCapturedId(new Set(all knot ids on both sides),
`${survivor.id}:knot`, capture)`, giving `{survivorId}:knot.{nonce}` (valid canonical charset).
**New local `try/catch` around that allocation** returning `captured_id_in_use`; the existing
catch only wraps Room reconciliation. All pre-existing knot ids are preserved.

## Tangency gate

"Corners are never joinable" needs the curved analogue of the existing straight-collinearity
refusal, in the same owner (no second survivor policy). Add `non_tangent_curved_pair` to
`DissolveSpecificRejectionCode` and gate inside the existing curve branch, after traversal
orientation: the survivor's last `handleIn` and the other's first `handleOut`, both relative to
the Junction, must be anti-parallel within noise (`|cross| ≤ 64·ε·|a||b|`, `dot < 0`); a
degenerate (zero-length) handle refuses as a cusp. Exact subdivision is preserved bit-for-bit,
so every split-produced joint passes; a real authored arc corner refuses.

Not changed: `planWallSplit`'s subdivision knot ids (adjacent A1 gap — reported, not fixed),
Junction topology, format 7, T2 surfaces, any Card action.

## Curved cases, exactly

**Supported:** two `cubic-chain` Walls, equal height/thickness, agreeing names, **tangent at the
joint**. Split at an existing knot rejoins to the identical cubic list; split inside a span
rejoins to its two subdivided spans plus one demoted knot, sample-identical — not byte-identical
— geometry.

**Refused:** non-tangent arcs (corner/cusp); mixed straight+curved; unequal height or thickness;
conflicting authored names; closed-Wall seam; degree ≠ 2; a Wall already spanning the joined
endpoints.

## Refusals

`wallJoinRefusalWords(code, message)` in `adapters/layout/refusals.ts`, falling back to
`wallRefusalWords`:

- `non_collinear_straight_pair` → "These Walls meet at a corner. Drag the joint onto the line
  between their ends to join them."
- `non_tangent_curved_pair` → "These curved Walls meet at a corner. Only a smooth continuation
  can join."
- `junction_degree_not_two` → "Three or more Walls meet here. A join needs exactly two Walls in
  a line."
- `incompatible_wall_pair` → height/thickness, mixed kinds and conflicting names each get a
  sentence (inspected from the message, the existing precedent).
- `degenerate_wall_pair`, `duplicate_joined_wall`, `room_identity_lost` /
  `room_reconciliation_rejected`, `captured_id_in_use` → own lines.

## Files

- `packages/layout-core/src/layout-wall-dissolve.ts` — capture-derived knot id + local catch;
  tangency gate + new rejection code; header doc.
- `packages/layout-core/src/layout-wall-centerline.ts` — doc comment only.
- `apps/editor/src/lib/authoring/adapters/layout/join-planners.ts` *(new)* —
  `LAYOUT_WALL_JOIN_KIND`, payload `{junctionId}`, capture + level, `planDissolveJunction`,
  lineage, `wallJoinIntent`.
- `apps/editor/src/lib/authoring/adapters/layout/refusals.ts` — `wallJoinRefusalWords`.
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` — `JunctionHoverGesture` gains
  `capture`/`removal`/`leftRemovalZone`/`joinPlan`; removal branch in move; join release path;
  mark reads **Remove joint**.
- `capabilities.json` — `layout.wall-join` after `layout.wall-split`.
- `docs/reference/design-system/spatial-instrument-grammar.md` — one sentence on the Wall row.
- Tests: `layout-dissolve-curves.test.ts`, new `layout-wall-join-adapter.test.ts`.

## Checks

Planner suite: rebuild the two hand-authored pair fixtures as exact tangent halves (so they
still prove byte-identical span concatenation), add "refuses an arc corner", keep both
split-inverse cases with their true assertions, add the capture test (same capture → same knot
id; two captures → two ids; occupancy never decides).

New adapter suite (A1's real facade + acceptance host): straight collinear pair in a Room —
drag → **Remove joint** → join; survivor per rule 1; Opening id and world position kept, offset
rebased; Room id kept; one history entry; Undo restores exact bytes; Redo replays ids; Save/Load
round trip. Curved pair built by *actually splitting* a curve (hence tangent) → identical cubic
list; curved corner refused with its own words. Refusals with words, no write, no history:
corner, unequal height, unequal thickness, mixed kind, Y-joint via intent. **Hysteresis**: leave
→ return to arm removal → leave again restores an ordinary Junction move, and a refused join
release never commits that move. Y-joint drag still moves and never offers removal. Eraser press
on a joint still names the Wall.

Commands: the two suites, `npm run check`, `npm run check:layout-core`, `npm run test:arch`,
`npm run test:fast`, `npm run build` (`test:heavy` + DB API deferred to CI per
`apps/editor/tests/README.md`).

## Risks

1. **Eraser-on-joint unshipped** — Stage contract gap, named, with the Wall-resolving regression
   pin.
2. Tangency is a **noise-only** tolerance (64 ε), so an authored corner refuses while an exact
   subdivision passes; a zero-length handle counts as a cusp.
3. The planner now refuses non-tangent curve pairs for every caller; the two P23 fixtures are
   rebuilt accordingly (their subject — exact span concatenation — is unchanged).
4. Curved split's subdivision knot ids remain occupancy-derived (out of scope).
5. Removal is offered only on an unselected joint in Plan with a fine pointer; a selected Wall's
   end mark still wins that press.
6. A join replaces the other Wall's finish/name (roadmap accepted risk #7); Undo reverses it.

Single PR, plan first, no merge, no T2 work.
