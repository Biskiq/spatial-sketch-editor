# R217.S25 — Experience shared homes: implementation plan

**Slice:** R217.S25 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T3 ·
**Reviewers:** T1 · **Runbook:**
[T3 operations](../../../operations/t3-experience/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C04b. Fixes D24 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Experience uses the same Head, Index, Card and lower edge as World instead of a separate dashboard.

## 2. Dependencies

- R217.S20, R217.S21, R217.S22, R217.S23 and R217.S24
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Experience](../post-s10-convergence/target-specification.md#experience).

**Files:**

- Experience presentation
- The spatial route

**Rules:**

- Lens in the Head, locator in the Index, selected facts in the Card, and an invoked Guide on the lower edge, closed by default.
- Capture, View, first-Guide intent, travel-gap behaviour, F4 history and isolated Preview are unchanged.

**Contracts this slice updates at cutover:**

- None.

## 4. Test cases

- No second lens picker or Preview entry.
- Existing suites pass unchanged.

## 5. Browser acceptance

- Capture, View, Guide, Preview and return in the shared homes.
- History and lens parking are unchanged.
- The Guide is closed by default.

## 6. Exclusions and stop conditions

- New Experience capability.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
