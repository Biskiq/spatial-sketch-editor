# R217.S21 — Index and Card: implementation plan

**Slice:** R217.S21 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 (shell), T2 and T5 (their facts) · **Specialist review:** T2 and T5: Card contributions. T3: lens effects · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C02. **Class:** Core drift from the accepted wireframe. Fixes D06, D07, D08, D09, D10 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Index rows are compact with human names, and the Card states each fact once, with destructive styling only on destructive actions.

## 2. Dependencies

- R217.S20
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Index and Card](../post-s10-convergence/target-specification.md#index-and-card).

**Components:**

| Part | Where | Change |
| --- | --- | --- |
| Index rows | `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte` | One compact line per subject at the role's Index width. Select stays the row. Open location, Bring into view and Reveal move into a disclosure on the row |
| Labels | A small pure helper beside `EditorIndex.svelte` | Authored name, else a session-stable `Kind n` by sorted identity. Full identity stays in the accessible name. Never serialized |
| Card types | `apps/editor/src/lib/authoring/stage/stage-facade.ts` | `StageCardFact` gains optional `fieldId`, `StageCardAction` gains optional `group`, and the writer's `StageInstrumentContent` gains optional `fieldIds`, the fields it edits |
| Card rendering | `apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte` | Drops a fact whose `fieldId` has a writer or is carried by the header (`name`, `kind`). Styles only `destructive: true` as destructive. A `secondary` action sits in More |
| Layout facts | `apps/editor/src/lib/authoring/adapters/layout/precision.ts` `layoutFacts` (read by `layout.adapter.ts` `cardFacts`) | Sets `fieldId`. The route composes `Stream`, `Eligible`, `Revealed` and `Domain`, which move under Technical details |
| Scene and form facts | `apps/editor/src/lib/authoring/adapters/scene.adapter.ts` `cardFacts` | Same rule, and Duplicate loses its destructive class |
| Context chip | `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` input from the route | Fed by real canonical location: a Layout-located selection shows its floor's authored name; a Scene reference (`project-root`) names no location, so no chip |

**Rules:**

- No operation is removed, only disclosed.
- Browser calibration owns row height and disclosure placement.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Tests: `scene-object-card.test.ts`, `editor-card-confirmation.test.ts`, `layout-card-fields-lifetime.test.ts`.
- Long and repeated names.
- Each fact appears once.
- Duplicate is not styled as destructive.
- Generated names never reach a save.

## 5. Browser acceptance

- Select and frame stay distinct.
- Each action is reachable by keyboard.

## 6. Exclusions and stop conditions

- The Height Sheet.
- Card behaviour during a gesture, which is R217.S22.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
