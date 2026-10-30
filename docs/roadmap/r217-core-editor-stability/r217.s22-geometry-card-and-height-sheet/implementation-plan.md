# R217.S22 — Geometry, Card and Height Sheet: implementation plan

**Slice:** R217.S22 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T3: layout changes never move the Camera · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C03a. **Class:** Core regression and drift. Fixes D11, D12, D36, D42 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The shell measures its real lanes, the Card never covers what is being edited, and the Height Sheet is a thin line with a knob.

## 2. Dependencies

- R217.S20 and R217.S21
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Lower edge](../post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive).

**Components:**

| Part | Where | Change |
| --- | --- | --- |
| Lane geometry | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | Extends the `lowerColumnHeight` observer to Index, Card, Sheet lane and dock, published as variables on `.stage-frame`. `.reserved-height` goes |
| Card during a gesture | `apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte` | New prop, true while `session.gesture()` is a non-navigation lease: fades and takes no pointer events. No auto-expand on commit. No position change on refusal |
| Height Sheet | `apps/editor/src/lib/authoring/stage/shell/StageHeightSheet.svelte` | Line, knob and semantic ticks; value on focus, drag and touch |
| Pin hint | `StageHeightSheet.svelte` | Shows on first pin use, clears by itself, and resolves TD-15's repetition residual |
| Empty click | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` `onClick` | Plain `Nothing selectable there.` goes. The excluded-subjects variant stays, because it explains something |

**Rules:**

- Heights, pins, found tops, side swap and keyboard input are preserved.
- Layout changes never submit a Camera intent.
- Browser calibration owns sizes, fade timing and lane spacing.

**Contracts this slice updates at cutover:**

- TD-15 in `docs/operations/tech-debt/README.md` is closed if the hint residual is resolved.

## 4. Test cases

- Tests: `stage-shell-composition.test.ts`, `stage-height-sheet.test.ts`.
- No Camera movement on a layout change.
- The Card takes no pointer events during a gesture, holds through a refusal and never expands on commit.
- Sheet keyboard, pins and found tops are unchanged.

## 5. Browser acceptance

- Edit a subject under the Card at 1440 and 1180.
- Pin, drag and key a height.
- Nothing overlaps.

## 6. Exclusions and stop conditions

- The Ink palette and narrow sheets, which are R217.S23.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
