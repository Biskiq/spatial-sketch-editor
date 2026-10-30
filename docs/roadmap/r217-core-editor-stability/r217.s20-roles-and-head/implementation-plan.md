# R217.S20 — Roles and Head: implementation plan

**Slice:** R217.S20 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T3 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C01. Fixes D01, D02, D03, D04, D25, D26 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The Head is one compact row in the wireframe's order, shell text and colour follow one set of roles, and every utility has a quiet permanent home.

## 2. Dependencies

- R217.S13
- Owner decision O5
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Shell](../post-s10-convergence/target-specification.md#shell) · [Head](../post-s10-convergence/target-specification.md#head).

**Files:**

- A new scoped shell stylesheet
- `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`
- The spatial route
- Tests: `head-find.test.ts`, `head-save.test.ts`, `head-save-journey.test.ts`

**Rules:**

- The ☰ menu leaves. Viewing preferences return in the Stage's ⚙, and project lifecycle and source go under the project name.
- Every displaced capability also gets a Find entry in the same PR.
- `Technical details` and `Open source JSON` leave the ordinary surface.
- Eligibility and refusal semantics are unchanged; the words move into an accessible disclosure.

**Contracts this slice updates at cutover:**

- PLATE's references to the app menu, and the shaded-Plan scope ruling in [the R217 README](../README.md#scope-rulings), per O5.

## 4. Test cases

- Find reaches each former menu capability.
- A refusal is announced accessibly.
- The ⚙ holds no drafting value.

## 5. Browser acceptance

- Empty, dirty and refused states.
- Keyboard only.
- Coarse sizes.
- One row at all four widths.

## 6. Exclusions and stop conditions

- Index and Card content, which are R217.S21.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
