# R217.S23 — Ink palette and constrained widths: implementation plan

**Slice:** R217.S23 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 (host, Layout), T2 and T5 (their instruments) · **Specialist review:** T2 and T5: instruments in the shared host · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C03b. **Class:** Core drift from the accepted wireframe. Fixes D13, D14 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The Ink palette no longer covers the drawing, and the shell stays usable at 1280, 1180 and 820 px.

## 2. Dependencies

- R217.S14 and R217.S22
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Lower edge](../post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive).

**Components:**

| Part | Where | Change |
| --- | --- | --- |
| Instrument container | `apps/editor/src/lib/authoring/stage/shell/StageInstrumentHost.svelte` | Drops the `WORLD INSTRUMENT` panel treatment for one row above the dock, for every instrument it hosts |
| Ink content | `apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte` | Reading and mode as compact keys; Finish, Backtrack and Cancel in the row; typed X/Z and options disclose upward |
| Opening and Scene instruments | `apps/editor/src/lib/authoring/adapters/layout/LayoutOpeningPalette.svelte` and `apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte` | Must still fit the new container; content is not redesigned |
| Narrow Index | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` `@media (max-width: 1279px)` and `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte` | Starts collapsed below 1280 as session state. The `100vmax` shadow becomes an explicit scrim that ends at the dock's measured span |

**Rules:**

- Ink content is exactly Wall (Line, Box) and Opening, with typed X/Z, Finish, Backtrack and Cancel. Shape left Ink in S17A and lives in the Objects panel, whose full panel and compact row this slice must also fit.
- S23 presents controls and adds none. It may not bring back an upright sheet, Flip, alignment, depth, Create, or Shape in Ink; `objects-panel-guard.test.ts` fails if it does. It depends on S17A.
- Browser calibration owns icon choice and spacing.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Tests: `layout-drawing-adapter.test.ts`, `shape-reading-adapter.test.ts`, `stage-shell-composition.test.ts`.
- Every Ink mode and typed path is retained.
- The scrim stops above the dock.

## 5. Browser acceptance

- All four widths.
- Draw with the palette open and the drawing visible.
- The dock is usable behind an open Index.

## 6. Exclusions and stop conditions

- Experience.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
