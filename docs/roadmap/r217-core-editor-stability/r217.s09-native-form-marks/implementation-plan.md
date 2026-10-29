# R217.S09 — Native form marks: implementation plan

**Slice:** R217.S09 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T5 · **Reviewers:** T2 (Scene adapter
files), T1 (mark layer) · **Runbook:**
[T5 operations](../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Moves native form depth and per-axis sizing onto the S07 mark layer, under the T5.P01 native form
policy.

## Prerequisite

R217.S08 is merged, because both edit the Scene adapter.

## Scope

1. **Descriptors** for a selected form:
   - a depth ray along the profile normal;
   - width, depth and height rays through the scale point, which is per axis for forms;
   - the move track and yaw ring shared with S08's object descriptors.
2. **Measurement.** The closest-approach measurement in
   `apps/editor/src/lib/authoring/adapters/scene/shape/ray.ts` stays T5's gesture arithmetic, used by
   the descriptor's planner. The host does not reimplement it.
3. **Refusals and bounds** stay the form policy's (extent 1 mm–100 m, scale [0.01, 100]), shown at
   the mark and the Card.
4. Remove the form-local knob drawing and drag state in the same PR.

## Not in scope

Object Focus, outline editing, sections, shaping and anchors (T5.P02).

## Acceptance criteria

1. **Undo entries:** depth and each axis make one F4 entry on a valid release and none on an invalid one.
2. **Plan and 3D:** the form's footprint symbol in Plan updates with its 3D evaluation from the same source.
3. **Same fact:** mark, typed value and Card agree on source and refusal.
4. **Coarse pointer:** per-axis rays are reachable and disambiguated by the form provider.
5. **Regression:** Save, reload, My Objects insert and T5.P01 journeys pass.
6. **No leftovers:** the form-local knob code is gone.

## Verification

Affected form, Scene adapter and `geometry-core` contracts; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
