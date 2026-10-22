# T1.P02.S02 — Draw, close, divide and delete: outline plan

**Slice:** T1.P02.S02 · **Status:** proposed — **not authorized**; it starts only from its own owner
authorization after `T1.P02.S01` is accepted · **Phase:** [T1.P02](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md) · **Design:**
[shell draft](../shell-draft.md#draw-s02)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

This is an **outline** registered with the phase (batch E, E1). The complete plan is written after
S01's acceptance, from the tree S01 leaves, and is reviewed with this slice's own authorization.
Nothing here is implemented, authorized or evidenced.

## Outline scope

- **Planners on the Stage.** Wire layout-core's existing chain, split, crossing, subdivision, Wall
  deletion and first-enclosure planners as F4 Layout planners under the per-planner scope that
  `T3.P03.S01` enforces. They follow the phase's owner-accepted
  [drawing policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22) and S01's
  captured identity and explicit working level.
- **Draw, close, divide, delete.** A creator draws straight Walls with deliberate Junction reuse,
  closes an enclosure, divides a Room and deletes a Wall, with typed refusal and repair text for the
  unsupported cases. Junctions become selectable subjects, Stage input gains a finish key, and the
  live-proposal Undo block stops naming its gesture owners by hand.
- **Shell.** The first pointer rail, family-driven so T2 and T3 contribute entries without editing it,
  plus Card/instrument arbitration for the lower surface. The [shell draft](../shell-draft.md) is the
  starting design; browser review revises it before acceptance.
- **Performance.** Deduplicate the install compile and Undo/Redo re-admission first, proving equal
  output with a heavy-lane differential and a deterministic compile-count oracle. If F3 still misses
  at M, run the bounded incremental or worker experiment inside the one compiler; if that also misses
  at L, the "preview equals planner output" semantics becomes an owner call inside this slice.

## Outline acceptance

1. Empty project and starter: draw, close, divide and delete, with Undo/Redo, Save and reload keeping
   identities, and Plan and 3D agreeing.
2. Every unsupported case in the drawing policy refuses in words, with a repair, and leaves no partial
   source.
3. Hard performance rows, on the designated reference machine (MacBook Air M2, 16 GB; batch E, E6 amendment): F3 drag (input-to-matching-preview, latest-input age, final-preview completion,
   frames, long tasks), per-move evaluation, F4 commit and F8 Undo/Redo at S and M, F2 open, F13 leak
   cycles and the Stage first-load delta.
4. The closeout records M4 as re-armed in the
   [mechanism register](../../../../operations/architecture-cycle.md#mechanism-register), because
   this slice re-wires Junction commits.

Excluded: Openings (S03), curved or circular drawing, levels, structures, datums, overheads,
attachments and the face-frame query.
