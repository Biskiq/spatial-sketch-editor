# T1.P02.S01 — Layout identity and format cutover: implementation plan

**Slice:** T1.P02.S01 · **Status:** approved — owner-authorized 2026-10-22 as batch E (E7,
[record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md)) and released from the
hold; starts only after `T3.P03.S01` is merged on `main`; not implemented · **Phase:**
[T1.P02](../README.md) · [slice register](../README.md#slice-register) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

Starts from a base where `T3.P03.S01` has merged; the phase's
[drawing policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22) is
owner-accepted. It ships no creator-visible drawing; it makes every later drawing operation safe to
persist.

## 1. Captured, non-reusing Layout identity

Implements the ratified F.1/F.4 destination (non-reused identity; allocation captured before
evaluation, no occupancy fallback) for every Layout identity a planner can mint.

- The accepted operation captures one fresh opaque nonce as an explicit intent input, minted outside
  the undoable document. Every Layout allocator the operation reaches derives IDs from that nonce
  plus its existing seed (chain Junctions and Walls, noding fragments, Openings, Room births, preset
  objects). The occupancy allocators remain only as the refusal check that a captured ID is unused.
- Redo replays the captured IDs. A new edit after Undo receives a new nonce, so it cannot recycle an
  identity from the undone branch. Reload needs no counter, because nothing is derived from the
  document's occupancy.
- The live plinth path (`nextLayoutPresetObjectId` through the plinth planner) moves to the same
  capture. Template boot of the starter keeps its fixed template IDs; nonce IDs cannot collide with
  them.
- New and changed planner entry points take the working level (`floor.id`) as an explicit
  parameter rather than reading the document's floor implicitly. `floor.id` stays stable and `height`
  stays the only Wall-top writer.

## 2. Format 6: derived Wall role

- The Layout format moves 5 → 6 by removing `role` from the Wall shape and codec keys
  (`packages/layout-core/src/layout-wall-first-types.ts`, `packages/layout-core/src/layout-wall-first-codec.ts`);
  the Layout unit version admitted by project-model follows.
- The compiler derives bounding, dividing and free-standing Walls from face membership. Face
  extraction and portals consider every Wall; the precision Room gates accept any bounding Wall.
- Chain, noding, dissolve and duplicate stop writing or copying `role`. The role planners
  (`planWallRoleChange`, `planPartitionToBoundaryRoomBirth`) and their tests are retired, not left as
  unreachable shims. The read-only Card fact shows the derived role.
- Readers refuse format 5 and every other version. No migration, dual reader or negotiation:
  pre-baseline data is disposable. The starter gallery, the seventy-eight affected test files, the
  curved-correspondence fixture and the recorded evidence JSON are regenerated or updated. A fixture
  that encoded a deliberate `partition` keeps its test intent by reconstructing the geometry it was
  testing, never by restoring the field.
- The API validates Layout units through the shared package, so API and editor deploy together;
  the strict refusal covers skew.

## 3. Legacy Layout type retirement

Format 6 is T1's first Layout schema cutover, which is the retirement condition for layout-core's
legacy floors/rooms types, `layout-codec`, `layout-room-frame` and the legacy
`compileLayoutGeometry` adapter. Move the definitions wall-first modules still import into wall-first
owners and delete the legacy modules. If that separation proves larger than this slice, stop and
report so it becomes its own slice before S02; do not carry it past the phase.

## Acceptance

1. **Identity guards.** Delete then recreate a Wall, Opening and Room-birthing chain: no identity of
   the deleted subject is reused. Undo, then a different edit: no ID from the undone branch reappears.
   Redo reproduces the captured IDs exactly. Save, reload, edit: no collision with saved IDs.
   Byte-identical recreation still receives a new ID. The plinth path passes the same guards.
2. **Derived roles.** Kernel fixtures that were all-`boundary` compile to identical geometry, faces,
   Rooms and portals before and after, through a heavy-lane differential. Former-`partition` cases
   are rewritten as geometry, and their derived outcomes match the ratified Wall-role destination.
3. **Strict format.** A format-5 or unknown-version Layout unit refuses in the editor, the API Save
   path and every other reader using the shared Layout validation, with the existing typed
   diagnostics; JSON download recovery still works.
4. **Kernel invariants.** The Junction, noding, Room reconciliation, compiler, curve and precision
   suites stay green after their fixtures move to format 6, with no weakened assertion.
5. **No behavior change for creators.** Existing precision, manipulation, plinth, Scene placement,
   Save and Undo/Redo journeys behave as before; the shared F2 open flow (F2) is recorded at S and M
   against the H0 baseline. Its hard rows are accepted on, or calibrated against, the Reference A
   machine named under batch E decision E6; until then the record is pre-flight.

Verification: affected fast and heavy contracts, the arch lane, `npm run check`, and `npm run check:api`
with the DB-backed `npm run test:api` at zero skips, because the API admits Layout units. The complete
repository gate runs before merge.
