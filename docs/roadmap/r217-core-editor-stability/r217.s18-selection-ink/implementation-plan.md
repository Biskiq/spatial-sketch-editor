# R217.S18 — Selection ink: implementation plan

**Slice:** R217.S18 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T2 and T5: footprint reuse · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C10. **Class:** Core regression. Fixes D22 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Selected geometry reads clearly in both readings, with a fill on the actual subject, including Scene subjects on Paper.

## 2. Dependencies

- R217.S17
- Owner decision O1
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Selection](../post-s10-convergence/target-specification.md#selection).

**Decisions settled here:**

- Opacity moves from 0.18 to 0.22 in `paper-marks.ts` and 0.28 in `StageSelectionLayer.svelte`, with the `#74560c` Paper edge.
- Scene fills read the polygons `paper-plan.ts` already retains from `plan-scene-footprint.ts`. No new footprint code is written.
- PLATE and the grammar name no 0.18 value, so no contract text changes. S07's acceptance record stays as history.

**Files:**

- `apps/editor/src/lib/authoring/stage/paper-marks.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte`
- Tests: `paper-marks.test.ts`

**Rules:**

- Paper fills sit under cut ink and are never a hit source.
- Hover stays neutral and untinted.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Fill and contour per subject.
- Concave and tilted forms.
- An Opening is never filled as its Wall.
- A model with no footprint is contour-only.
- Hover is untinted.

## 5. Browser acceptance

- Each subject in both readings, on the *mixed* fixture.
- Overlaps, light walls on the dark mat, and hidden subjects.

## 6. Exclusions and stop conditions

- Pick changes.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
