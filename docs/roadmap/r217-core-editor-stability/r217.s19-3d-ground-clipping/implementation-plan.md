# R217.S19 — 3D ground clipping: implementation plan

**Slice:** R217.S19 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T3 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C09a. Fixes D21, D28 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The ground and grid run to the visible edges of the 3D view at every orbit and zoom, with no straight cut and no line explosion.

## 2. Dependencies

- R217.S12 and R217.S13
- Owner decision O4
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [3D ground clipping](../post-s10-convergence/target-specification.md#3d-ground-clipping).

**Files:**

- `packages/camera-core/src/viewport.ts`
- `apps/editor/src/lib/authoring/stage/camera-session.ts`
- `apps/editor/src/lib/authoring/stage/stage-grid.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`
- Tests: `camera-viewport-evaluation.test.ts`, `stage-grid.test.ts`

**Rules:**

- Add the optional session field `displayGroundYMeters`, defaulting to `null`. It never enters scene bounds or fit.
- Apply the specified reach, far and near formulas, and replace the four corner rays with the exact frustum footprint.
- Budget: at most 6,000 lines, major lines never dropped.
- If the horizon band reads badly in the browser, use O4's fade alternative.

**Contracts this slice updates at cutover:**

- None. The new input field is optional, so `T1.viewport-projection@1` keeps its version.

## 4. Test cases

- Ground samples inside coverage and clip range, classified sky, behind, near or far, across elevations 5, 15, 45, 75 and 89°, azimuth quadrants and diagonals, portrait and landscape, translated targets, zoom extremes, datum changes and horizon crossing, through actual Stage wiring.
- Line count at most 6,000 with major lines intact.
- `displayGroundYMeters: null` matches today's evaluation exactly.

## 5. Browser acceptance

- Orbit and zoom from overhead to shallow with the horizon in frame.
- No straight cut, no moiré band, no fighting close up, and observably smooth.
- The eye-height reach term, the budget and a horizon-in-frame view have never been run, so this is their first test. Check whether D29 reproduces.

## 6. Exclusions and stop conditions

- Semantic fit.
- An infinite grid.
- Timing gates.

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
