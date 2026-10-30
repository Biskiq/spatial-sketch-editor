# R217.S16 — Openings and Junction hover: implementation plan

**Slice:** R217.S16 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C07b. Fixes D31, D35 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

An Opening can be selected and edited from Plan alone, without the Index. With a mouse, a corner can be edited without selecting anything first.

## 2. Dependencies

- R217.S15
- Owner decision O9
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Plan authoring](../post-s10-convergence/target-specification.md#plan-authoring) · [Hit priority](../post-s10-convergence/target-specification.md#hit-priority).

**Files:**

- `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts`
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (Opening branch)
- The spatial route's hover
- The Paper symbol code
- Tests: `plan-pick-index.test.ts`, `stage-paper-pick.test.ts`, `layout-wall-manipulation.test.ts`, `stage-host-tools.test.ts`

**Rules:**

- In Plan, an Opening within its aperture outranks its host for Select, using the Eraser's existing rule. Outside the aperture, the Wall wins. 3D picking is unchanged.
- A selected Opening's body drag slides it along its host. Offset uses `resolveOpeningDragSnap`.
- Door swing is drawn, closing S04's carried gap.
- With a mouse, hovering within 10 CSS px of any Junction reveals its point. Dragging that point moves the Junction and leaves selection alone.

**Contracts this slice updates at cutover:**

- The domain-ranking example in [the R217 README](../README.md#shared-stage-interaction-coordination-over-domain-policy), which still names a locked Wall → Opening priority, and the matching comments in `plan-pick-provider.ts` and `stage-host-tools.test.ts`.

## 4. Test cases

- A click in the aperture selects the Opening; a click on solid Wall selects the Wall.
- An Opening at a Wall's end.
- Hover reveals exactly one point.
- A coarse pointer never reveals on hover.
- Junction hover never outranks a selected subject's mark.

## 5. Browser acceptance

- Select, slide and resize an Opening from Plan only, never using the Index.
- Edit a corner with nothing selected.
- The door swing is readable.

## 6. Exclusions and stop conditions

- Head and sill rays.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
