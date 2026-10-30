# R217.S25 — Experience shared homes: implementation plan

**Slice:** R217.S25 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T3 (Experience), T1 (shell homes) · **Specialist review:** T3: Experience authoring. T1 concerns are covered by the integrator's shell ownership · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C04b. **Class:** Core drift from the accepted wireframe. Fixes D24 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Experience uses the same Head, Index, Card and lower edge as World instead of a separate dashboard.

## 2. Dependencies

- R217.S20, R217.S21, R217.S22, R217.S23 and R217.S24
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Experience](../post-s10-convergence/target-specification.md#experience).

**Components:**

| Part | Where | Change |
| --- | --- | --- |
| Mount | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` L3743 block | The full-surface `ExperienceSurface` overlay goes |
| Locator | `apps/editor/src/lib/authoring/adapters/experience.adapter.ts` feeding `EditorIndex.svelte` | Presentations list, filter and empty-state create become Index groups |
| Selected facts and fields | `experience.adapter.ts` feeding `EditorCard.svelte` | Presentation and Stop facts, fields and actions use the Card contributions |
| Guide | An invoked panel in the route's `.lower-column` | Stops, order and Travel gaps; closed by default, and opened from the Index or Card |
| Capture and View | The lower edge, through the existing instrument host | The same commands from the controller |
| Preview and lens | `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` | Stay in the Head only; the surface's own Preview button goes |
| Retired | `apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte` | Deleted or reduced to presentational pieces the homes mount |

**Rules:**

- Capture, View, first-Guide intent, travel-gap behaviour, F4 history and isolated Preview are unchanged.
- Browser calibration owns panel size and row density.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- The S24 suites stay green; assertions change only where they named the removed container.
- No second lens picker or Preview entry.

## 5. Browser acceptance

- Capture, View, Guide, Preview and return in the shared homes.
- History and lens parking are unchanged.
- The Guide is closed by default.

## 6. Exclusions and stop conditions

- New Experience capability.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
