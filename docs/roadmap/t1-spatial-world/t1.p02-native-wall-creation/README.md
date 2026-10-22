# T1.P02 — Native Wall creation

**Phase:** T1.P02 · **Status:** registered 2026-10-22. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits. S02–S04 stay `proposed` · **Track:** [T1](../README.md) ·
**Roadmap:** [gate register](../../README.md#gate-register) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md) · **Design:**
[shell draft](./shell-draft.md)

This phase is C1 of the convergence first wave. The
[batch E protocol](../../cross-track-execution.md#authorized-batch-e-2026-10-22) owns sequencing,
shared files and merge order, and the [coordination proposal](../../next-batch-2026-10-22.md) keeps
the gap findings behind it.

## Outcome

From an empty project or the starter, a creator draws straight Walls with deliberate Junction reuse,
closes an enclosure, divides a Room, adds and removes a Wall-hosted Opening and deletes a Wall.
Rooms and floors derive from canonical topology; the creator never chooses boundary or partition.
Undo/Redo and Save/reload keep identities; Plan and 3D agree; keyboard and numeric entry stay useful;
drawing meets the ratified [performance budgets](../../../reference/components/performance.md) on
reference hardware.

## What the code already has (verified at `f516e1ff`)

- `@portfolio/layout-core` already plans chains, segments, splits, crossings, subdivision, Wall
  deletion, first-enclosure creation and Opening create/delete. None is wired to the editor; the
  live Layout planners are the eight precision/plinth planners.
- Every allocator derives the next ID from the current document (`defaultChainAllocator`,
  `nodingAllocatorAdapter`, `nextLayoutPresetObjectId`, `nextWallFirstOpeningId`, the topology Room
  allocator), so delete or Undo re-mints an ID. The envelope has no counter, and the only persisted
  cursor lives in the undoable document.
- The authored Wall `role` is read or written in fourteen non-test modules (twelve in layout-core,
  two in the editor) and seventy-eight test files; nothing in project-model, render, representation,
  the visitor or the API reads it.
- A Layout drag runs the whole candidate finalization (validate, topology, faces, reconciliation,
  Openings, portals, compile) per pointer move; an accepted edit compiles again at install; Undo/Redo
  re-admits and recompiles.
- The Stage registers tasks through the adapter contract. Contributed tasks render as Index groups
  carrying a `family`; no pointer rail exists. Junctions are not selectable subjects, Stage input
  has no finish key, and the live-proposal Undo block names two gesture owners by hand.

## Drawing and enclosure policy (owner-accepted 2026-10-22)

The [architecture destination](../../../reference/architecture.md#product-convergence-destination)
leaves these to C1. The owner accepted this policy as written (batch E, E3,
[record](../../../reference/decisions/batch-e-authorization-2026-10-22.md)); every slice of this
phase implements it, and a change to it is a new owner decision:

1. **Every closed ring encloses.** A closed ring at the working level derives a Room. An
   intentionally non-enclosing ring is not supported in this phase.
2. **Roles follow geometry.** A Wall that closes no ring is free-standing. A Wall between two points of
   one Room's boundary divides it, using the landed reconciliation (split survivor by evidence order,
   one Room born). Deleting a Wall merges or opens Rooms through the same reconciliation.
3. **Connection is deliberate.** An endpoint connects only by landing on an existing Junction or on a
   Wall's interior, which splits that Wall there. Nearness never adopts a coordinate.
4. **Unsupported cases refuse in words, with a repair, and leave no partial source:** a crossing without
   a Junction, a collinear overlap, and a closed ring nested inside a Room without sharing a Junction
   with it. Nested courtyards and hole semantics wait for the closure/vertical cutover.
5. **Hosted consequences are disclosed.** Deleting a Wall deletes its Openings in the same undo step.
   Experience or Camera references to a deleted identity keep their retained ID with derived
   diagnostics; nothing is retargeted.

## Layout format 6

Format 6 is format 5 without the authored `role`; the compiler derives bounding, dividing and
free-standing Walls, and face extraction considers every Wall. Under the North Star's
[pre-baseline rule](../../../reference/north-star.md#release-and-source-baselines) there is no
migration, dual reader or negotiation: the number moves to 6, readers refuse anything else, and the
starter, fixtures and evidence JSON are regenerated. This settles the "migrate existing `partition`
Walls" question the architecture contract carried. As T1's first Layout schema cutover, format 6
also triggers the [legacy types/codec retirement row](../planning-evidence.md#17-legacy-layout-typescodec-retirement-row).

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1.P02.S01 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Layout identity and format cutover](./t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) | [record](./t1.p02.s01-layout-identity-and-format-cutover/acceptance.md) | owner-authorized 2026-10-22 as batch E ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E7); released from the hold; starts only after `T3.P03.S01` is merged on `main` |
| T1.P02.S02 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Draw, close, divide and delete](./t1.p02.s02-draw-close-divide-delete/implementation-plan.md) (outline) | [record](./t1.p02.s02-draw-close-divide-delete/acceptance.md) | not authorized — starts only from its own owner authorization after S01 is accepted |
| T1.P02.S03 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Opening family](./t1.p02.s03-opening-family/implementation-plan.md) (outline) | [record](./t1.p02.s03-opening-family/acceptance.md) | not authorized — starts only from its own owner authorization after S02 is accepted |
| T1.P02.S04 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t1.p02.s04-integrated-final-gate/implementation-plan.md) | [record](./t1.p02.s04-integrated-final-gate/acceptance.md) | not authorized — starts only from its own owner authorization after S01–S03 are accepted |

Every consumed gate is `accepted` and every required scope is `active` on `main` `f516e1ff`; each
slice rechecks them at its own trusted base through the runbook start step. No slice here provides a
gate. S02 and S03 carry outline plans: each writes its complete plan after its predecessor's
acceptance, for review with its own authorization. The S01 plan carries the format and identity
work, S02 the first creator-visible drawing, and S03 the Opening family.

```text
FINAL PHASE GATE: T1.P02.S04 → ./t1.p02.s04-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

**S02 performance obligations.** Record F3 drag (input-to-matching-preview, latest-input age,
final-preview completion, frames, long tasks), per-move evaluation, F4 commit and F8 Undo/Redo at S
and M, F2 open, F13 leak cycles and the Stage first-load delta. Deduplicate the install compile and
Undo/Redo re-admission first, proving equal output with a heavy-lane differential and a deterministic
compile-count oracle. If F3 still misses at M, run the bounded incremental or worker experiment inside
the one compiler; if that also misses at L, the "preview equals planner output" semantics becomes an
owner call inside S02.

## Dependencies and boundaries

- **Before implementation:** H0's `T3.P03.S01` merged (S01 changes F4 intent capture; S02 adds
  Layout planners under enforced scope). The policy above is accepted. Nothing waits on C2 or
  T3.P02.
- **Reference hardware:** hard performance rows are run and accepted on the designated reference
  machine, the owner's MacBook Air M2 with 16 GB ([batch E, E6 amendment](../../../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)). Laptop A
  stays the accessibility target the budgets describe.
- **T1 writes:** layout-core, the Layout unit in project-model, Layout adapters, the Stage host and
  shell, the starter gallery. Changes to shared F4 capture or the Head are reviewed by T3; the rail is
  family-driven so T2 and T3 contribute entries without editing it.
- **Excluded:** curved or circular drawing, levels, structures, datums, overheads, attachments, the
  face-frame query (next wave), compound acceptance of new cross-domain operations.
- **Architecture cycle:** the T1.P01 window is closed with the owner verdict still owed; this phase
  configures no window. S02 re-wires Junction commits, so its closeout records M4 as re-armed in the
  [mechanism register](../../../operations/architecture-cycle.md#mechanism-register).
