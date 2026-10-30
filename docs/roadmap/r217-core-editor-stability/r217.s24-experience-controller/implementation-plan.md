# R217.S24 — Experience controller: implementation plan

**Slice:** R217.S24 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T3 ·
**Reviewers:** T1 · **Runbook:**
[T3 operations](../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C04a. Fixes Prepares D24 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Experience commands move into a controller beside their surface, so R217.S25 can change where they appear without touching what they do. Nothing visible changes.

## 2. Dependencies

- No earlier slice.
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Experience](../post-s10-convergence/target-specification.md#experience).

**Files:**

- `apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte`
- A new controller beside it

**Rules:**

- Extraction only, with no visible change.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- Existing Experience suites pass unchanged.

## 5. Browser acceptance

- World↔Experience, Capture, View, Guide, Preview and return match before and after.

## 6. Exclusions and stop conditions

- Any visible change.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
