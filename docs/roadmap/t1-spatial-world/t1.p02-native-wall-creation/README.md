# T1.P02 — Native Wall creation: registration draft

**Status:** registration-ready draft, 2026-10-22 (C1). It is **not registered**: no row exists in the
[T1 phase register](../README.md#phase-register), and nothing here is a phase, slice, gate version,
authorization or release from the [production hold](../../README.md#production-implementation-hold).
Sequencing, shared files and the owner decisions live in the
[canonical batch](../../cross-track-execution.md#convergence-batch-and-next-planning-wave) and its
[coordination proposal](../../next-batch-2026-10-22.md). Routes: [T1](../README.md) ·
[runbook](../../../operations/t1-spatial-world/README.md) · [shell draft](./shell-draft.md).

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

## Drawing and enclosure policy (owner call before authorization)

The [architecture destination](../../../reference/architecture.md#product-convergence-destination)
leaves these to C1. Recommended policy, for the owner to accept or edit:

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

## Proposed slice register (applies on registration)

| Slice | Outcome | Tier and route | Plan |
| --- | --- | --- | --- |
| T1.P02.S01 | Format 6, captured non-reusing Layout identity, explicit working level, legacy retirement; no creator UI | `architecture-integration`, route S04 | [Launch plan](./t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) |
| T1.P02.S02 | Draw, close, divide and delete on the Stage; the first pointer rail; compile/admission deduplication and drag performance; Card/instrument arbitration | `architecture-integration`, route S04 | written after S01 acceptance |
| T1.P02.S03 | Opening family: place and remove a Wall-hosted Opening with host preference and refusal | `architecture-integration`, route S04 | written after S02 acceptance |
| T1.P02.S04 | Integrated final gate | `exhaustive` | written at registration |

All four would consume `F1.reference@1`, `F2.unit-envelope@1`, `F4.intent-acceptance@1` and
`T1.viewport-projection@1`, requiring `unit-resolution-v1`, `unit-envelope-v1`,
`unit-acceptance-v1`, `conditional-save-units-v1` and `viewport-projection-v1`. All are accepted
and active on `main` `f516e1ff`; each slice rechecks them at its trusted base. No slice provides a gate.

```text
PROPOSED FINAL PHASE GATE: T1.P02.S04 (exhaustive; empty → draw → close → divide → Opening → delete → Save → reload)
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
  Layout planners under enforced scope), plus the policy above accepted. Nothing waits on C2 or
  T3.P02.
- **T1 writes:** layout-core, the Layout unit in project-model, Layout adapters, the Stage host and
  shell, the starter gallery. Changes to shared F4 capture or the Head are reviewed by T3; the rail is
  family-driven so T2 and T3 contribute entries without editing it.
- **Excluded:** curved or circular drawing, levels, structures, datums, overheads, attachments, the
  face-frame query (next wave), compound acceptance of new cross-domain operations.
- **Architecture cycle:** the T1.P01 window is closed with the owner verdict still owed; this phase
  configures no window. S02 re-wires Junction commits, so its closeout records M4 as re-armed in the
  [mechanism register](../../../operations/architecture-cycle.md#mechanism-register).
