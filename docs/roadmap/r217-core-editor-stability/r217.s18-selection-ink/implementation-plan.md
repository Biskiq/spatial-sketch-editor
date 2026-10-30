# R217.S18 — Selection ink: implementation plan

**Slice:** R217.S18 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T5 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C10. Fixes D22 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Selected geometry reads clearly in both readings, with a fill on the actual subject, including Scene subjects on Paper.

## 2. Dependencies

- R217.S17
- Owner decision O1
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Selection](../post-s10-convergence/target-specification.md#selection).

**Files:**

- `apps/editor/src/lib/authoring/stage/paper-marks.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte`
- Tests: `paper-marks.test.ts`

**Rules:**

- Apply the specification's selection table: Paper .22 with a `#74560c` edge, 3D .28 depth-tested.
- Reuse the polygons `plan-scene-footprint.ts` owns. Paper fills sit under cut ink and are never a hit source.
- Hover stays neutral and untinted.

**Contracts this slice updates at cutover:**

- S07's selection values wherever PLATE or the grammar states them, per O1. S07's acceptance record stays as history.

## 4. Test cases

- Fill and contour per subject.
- Concave and tilted forms.
- An Opening is never filled as its Wall.
- A model with no footprint is contour-only.
- Hover is untinted.

## 5. Browser acceptance

- Each subject in both readings.
- Overlaps, light walls on the dark mat, and hidden subjects.

## 6. Exclusions and stop conditions

- Pick changes.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
