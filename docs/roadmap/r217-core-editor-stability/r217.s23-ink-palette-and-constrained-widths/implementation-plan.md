# R217.S23 — Ink palette and constrained widths: implementation plan

**Slice:** R217.S23 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T5 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C03b. Fixes D13, D14 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The Ink palette no longer covers the drawing, and the shell stays usable at 1280, 1180 and 820 px.

## 2. Dependencies

- R217.S14 and R217.S22
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Lower edge](../post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive).

**Files:**

- `apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageInstrumentHost.svelte`
- `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte`
- The spatial route

**Rules:**

- Compact icons and modes in a single row above the dock, keeping typed X/Z, Finish, Backtrack, Cancel, Wall Box and Shape Line, Box, Round and Sketch. Parameters that need room disclose upward.
- At constrained widths the Index starts collapsed and opens as a sheet with an explicit scrim that stops above the dock.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Every Ink mode and typed path is retained.
- The scrim stops above the dock.

## 5. Browser acceptance

- All four widths.
- Draw with the palette open and the drawing visible.
- The dock is usable behind an open Index.

## 6. Exclusions and stop conditions

- Experience.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
