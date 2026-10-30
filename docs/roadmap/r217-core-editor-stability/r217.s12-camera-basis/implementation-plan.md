# R217.S12 — Camera basis: implementation plan

**Slice:** R217.S12 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 (viewport) · **Specialist review:** T3: Camera and Experience framing · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C08. **Class:** Core regression. Fixes D23 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Flipping between 3D and Plan no longer turns the drawing upside down. A Wall on the left of the screen stays on the left through the whole transition.

## 2. Dependencies

- Owner decision O3
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Camera basis](../post-s10-convergence/target-specification.md#camera-basis).

**Decisions settled here:**

- The change is one sign in `upForReading('plan', azimuth)`, which becomes `[-sin a, 0, -cos a]`. At azimuth 0, Plan reads right +X, up −Z.
- No Plan-specific basis is added and no consumer is compensated. `viewScreenBasis`, pan and marks inherit the new value.
- Any test or capture that pinned the old orientation is corrected in this slice and named in the PR.

**Files:**

- `packages/camera-core/src/viewport.ts`
- `apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts`

**Rules:**

- Target, target-plane scale, nearest-quarter-turn snapping, remembered elevation and detented azimuth stay as they are.

**Contracts this slice updates at cutover:**

- None. `T1.viewport-projection@1` does not fix a Plan screen-up, so O3 needs no new gate version.

## 4. Test cases

- Signed screen-axis continuity on every transition frame, for elevations 5, 45 and 88° and azimuths 0, 44, 46, 90, 179, 225 and 315°.
- Reversal mid-transition, repeated fast switching and reduced motion.
- Quarter-turn ties.
- 20 settled cycles with no target or scale drift.

## 5. Browser acceptance

- Flip at several azimuths; a Wall on screen-left stays there.
- Pan and marks track the pointer in Plan.
- Selection, tool and source are unchanged by a flip.

## 6. Exclusions and stop conditions

- North-up Plan.
- Restoring an earlier arbitrary azimuth.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
