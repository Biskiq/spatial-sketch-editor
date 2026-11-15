# T1 A5 — Duplicate any Room + overlap cue (`layout.room-duplicate`)

**Authority:** T1 next-batch roadmap rev 3, A5 (Tier 1), PR #306 (A4) and #313 (Wave 1
follow-up). Base `main` @ `f2025b3f`. Short plan, as the slice requires.

## Goal

One meaning for Duplicate regardless of neighbours: any Room duplicates as a **free island**
with new ids for every copied Wall, Junction, Opening, Room and associated object, and a Door
relation that leaves the copied enclosure is dropped with words. A derived Stage cue reads
**overlaps, not joined** on a coincident stretch between independent Wall groups. No weld, no
topology rewrite, no format change (format 7 stays).

## Duplicate: copy enclosure

- **Planner.** New `planDuplicateRoom` in `packages/layout-core/src/layout-duplicate.ts`,
  beside the retained `planDuplicateIsolatedRoom` (A4's certified isolated path, still used by
  tests and the connected-curve plan). Both share one clone/remap core, so their per-element
  copying cannot drift.
- **Scope.** `resolveRoomCopyEnclosure` in `layout-room-isolation.ts` resolves the Room's
  boundary Walls, their Junctions, hosted Openings and explicitly associated objects. Unlike
  the isolation scope it does **not** reject a Wall shared with another Room or a stationary
  Wall incident to a boundary Junction: the copy takes a private clone of the boundary and
  leaves the source architecture untouched.
- **Kept refusals.** Unknown/unresolved Room (`unknown_room`, `invalid_reference`), a
  read-only profile object (`profile_object_read_only`), non-finite delta (`invalid_value`),
  captured-id collision (`captured_id_in_use`), and every canonical candidate gate (codec,
  topology within one component, Opening set, portal relations, compile).
- **Dropped relations.** A hosted Opening with `connectsRoomIds` is copied as the same Door
  without the relation. The plan reports
  `droppedPortalRelations: [{ openingId, roomIds }]`, one entry per dropped relation. An
  Opening with no relation copies untouched.
- **Placement.** The adapter keeps A4's proposal: one task, the complete Room already proposed
  one clear metre past its own extent, unpressed motion translating it, one click committing
  one captured intent. Zero translation still refuses (`coincident_with_source`).

## Lineage

- **preserved** — every source Junction, Wall, Opening, Room and associated object, by id and
  by geometry. The source Room's shared Wall is not modified.
- **created** — one clone of each boundary Junction/Wall/Opening, one Room, one clone of each
  explicitly associated object. Every created id derives from its source id plus the captured
  nonce (`<sourceId>-copy.<nonce>`); the Room name is `<name> copy` (or the next free suffix).
- **dropped** — each copied `connectsRoomIds` relation. The Opening itself survives with a new
  id and no relation; the relation is not represented by an id of its own.

## Overlap cue: derived editor state

- **Query.** New `independentWallOverlaps` in
  `packages/layout-core/src/layout-wall-overlap.ts`: for every pair of Walls in different
  topology components (the existing Junction-identity components), find positive-length
  collinear centerline stretches using the canonical centerline samples. Same-component pairs
  are excluded by construction (their overlap already refuses). Returned stretches are
  document-order deterministic, in meters, and are never persisted, validated against or
  written to history.
- **Presentation.** The Layout binding contributes one Stage guide per overlapping pair:
  dashed `derivedSegments` along the coincident stretch and one label, **overlaps, not joined**,
  at the longest stretch's midpoint on the level datum. `StageGuideContribution.role` gains
  `'relation'` for derived, non-editable relation cues. The guide is recomputed from the
  accepted Layout document when the binding is rebuilt, so it clears the moment the overlap
  ends (a Room move, an erase or an Undo).
- **Never** a Card writer, a planner input, a refusal, a history entry, a persisted field or a
  visitor surface. It changes no connectivity: the doubled Walls stay separate ids and no
  Junction is adopted.

## Card and instrument words

- The Card's Duplicate detail states the copy counts and, when present, each dropped door
  relation: `Drops <Opening> to <Room>.` The live Duplicate instrument carries the same
  `Drops` fact before placement. Refusal wording for the retained isolated planner is
  unchanged; the non-isolated refusal is no longer reachable from the editor.
- The capability ledger row `layout.room-duplicate` is rewritten to the A5 contract.

## Scope boundaries

Not in this PR: weld or any automatic cleanup of doubled Walls; a topology or schema change;
format bump; changing Room move; per-source hide; a 3D cue; a live overlap preview while the
copy is still a proposal (the settled accepted document is the source of truth). The isolated
planner and `layout-room-move` policies are untouched.

## Files

- `packages/layout-core/src/layout-duplicate.ts` — shared clone core, `planDuplicateRoom`,
  `droppedPortalRelations` on the plan.
- `packages/layout-core/src/layout-room-isolation.ts` — `resolveRoomCopyEnclosure`.
- `packages/layout-core/src/layout-wall-overlap.ts` *(new)* — independent-Wall coincidence
  query.
- `packages/layout-core/src/index.ts` — export the new module.
- `apps/editor/src/lib/authoring/adapters/layout/room-duplicate-planners.ts` — general planner,
  lineage doc, dropped relations in the candidate.
- `apps/editor/src/lib/authoring/adapters/layout/room-gesture-session.ts` — enclosure scope,
  Dropped fact, unchanged proposal mechanics.
- `apps/editor/src/lib/authoring/adapters/layout/layout-contributions.ts` — Card detail and
  overlap guide contribution.
- `apps/editor/src/lib/authoring/adapters/layout/room-overlap-cue.ts` *(new)* — pure mapping
  from the core query to one Stage guide.
- `apps/editor/src/lib/authoring/adapters/layout/refusals.ts` — dropped-relation wording.
- `apps/editor/src/lib/authoring/stage/facade/adapter-contract.ts` — `'relation'` guide role.
- `capabilities.json`, `docs/reference/components/layout.md` — ledger and the enduring rule.

## Checks

- Core planner suite: shared-Wall Room copies its boundary including a private copy of the
  shared Wall; open Door copies without its relation and is reported; source is byte-identical
  where untouched; partition stub at a boundary Junction is not copied and does not refuse;
  profile object still refuses; captured ids deterministic; Undo/Redo through the adapter;
  Save/Load round trip.
- Core overlap suite: coincident straight pair in different components is one stretch with
  exact endpoints; same-component pair is not reported; touching-only and near-parallel pairs
  are not reported; a collinear cubic span against a straight Wall is reported; deterministic
  order; no document mutation.
- Adapter suite (the real facade and acceptance host): the shared-Wall Room offers Duplicate
  (no longer refuses); its detail names the dropped relation; one click commits one history
  entry; the copied Door has no `connectsRoomIds`; `facade.guides()` carries the
  **overlaps, not joined** cue after the copy is placed on another group's Wall; the cue clears
  after moving the copy clear; Undo/Redo restore the cue with the same ids.
- Commands: the affected suites, `npm run check`, `npm run check:layout-core`,
  `npm run test:arch`, `npm run test:fast`, `npm run build`; `test:heavy` and the DB API are
  certified by CI per `apps/editor/tests/README.md`. Focused browser QA of the creator journey.

## Risks

1. The cue's tolerance is a display tolerance (`1e-6 m`), not a topology rule; near-coincident
   Walls below it do not cue, and it never refuses anything.
2. Dropping a Door relation is a visible loss. The Card and instrument name each dropped
   relation before the click, and Undo reverses the whole copy.
3. A duplicated Room on another group's Wall is doubled geometry by design; this PR reports it
   and does not weld it.
4. The cue is Plan-only Stage state. A creator working in 3D sees it after returning to Plan.
5. The retained isolated planner keeps A4's stricter refusals for its own callers; the editor
   no longer uses it, so one Duplicate path exists in the product.
