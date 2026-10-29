# R217.S08 — Scene object marks: implementation plan

**Slice:** R217.S08 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T2 · **Reviewers:** T1 (mark layer,
host), T5 (shared Scene adapter files) · **Runbook:**
[T2 operations](../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Moves catalogue and primitive object manipulation onto the S07 mark layer, under the
[Scene transform contract](../../../reference/components/scene-content.md).

## Prerequisite

R217.S07 is accepted. Merges before S09, unless the claims record a swap.

## Scope

1. **Descriptors** for a selected object:
   - a move track on the floor;
   - a yaw ring;
   - **uniform** size through the scale point.

   No per-axis scale is added for catalogue models; the domain does not admit it.
2. **Progressive size.** Clicking or tapping the scale point reveals the size ray. The tag names the
   verb ("Size 1.10 · base stays"). The base stays on its support, and resting objects ride along
   per the existing support rule.
3. **Scene policy stays T2's.** Support occlusion, eligibility and refusal text are unchanged; the
   provider only reports them.
4. **Typing at the gesture and the Card** write the same fact with the same refusal.
5. Remove the Scene adapter's local knob drawing and drag state in the same PR. Duplicate and delete
   remain available from the Card's scoped list and the context menu.

## Not in scope

Form marks (S09), attachments, multi-select, Align/Distribute, and material or light editing.

## Shared-file claims

`scene.adapter.ts`, `SceneTransformInstrument.svelte` and the placement modules. T5 reviews
because it shares the adapter.

## Acceptance criteria

1. **Undo entries:** move, yaw and uniform size each make one F4 entry on a valid release and none on an invalid one.
2. **Support:** the base stays on its support, and a resting object follows its support's move.
3. **Same fact:** the mark, the typed value and the Card produce identical source and refusal.
4. **Coarse pointer:** the scale-point tap reveals size, and the tracks are reachable with 44 px targets.
5. **Regression:** Save and reload are byte-identical, and T2.P01 and T2.P02 journeys pass.
6. **No leftovers:** the adapter-local knob code is gone.

## Verification

Affected Scene adapter and planner contracts; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
