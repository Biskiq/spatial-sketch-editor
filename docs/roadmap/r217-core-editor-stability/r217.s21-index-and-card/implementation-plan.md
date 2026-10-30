# R217.S21 — Index and Card: implementation plan

**Slice:** R217.S21 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2, T3, T5 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C02. Fixes D06, D07, D08, D09, D10 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Index rows are compact with human names, and the Card states each fact once, with destructive styling only on destructive actions.

## 2. Dependencies

- R217.S20
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Index and Card](../post-s10-convergence/target-specification.md#index-and-card).

**Files:**

- `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte`
- `apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte`
- `apps/editor/src/lib/authoring/stage/stage-facade.ts` (card types)
- Adapter contributions
- Tests: `scene-object-card.test.ts`, `editor-card-confirmation.test.ts`, `layout-card-fields-lifetime.test.ts`

**Rules:**

- Labels are the authored name, then a session-stable `Kind n` by sorted identity. Full identity stays available to assistive technology, and generated names are never serialized.
- Card facts gain an optional `fieldId`, and a fact with a writer for that field is not repeated.
- Card actions gain optional `group`. Only `destructive: true` gets destructive styling.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

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

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
