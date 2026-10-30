# R217.S19 — 3D ground clipping: implementation plan

**Slice:** R217.S19 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 (viewport and grid) · **Specialist review:** T3: Camera evaluation · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C09a. **Class:** Core regression. Fixes D21, D28 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

The ground and grid run to the visible edges of the 3D view at every orbit and zoom, with no straight cut and no line explosion.

## 2. Dependencies

- R217.S12 and R217.S13
- R217.S17, for `StageCanvas.svelte` order
- Owner decision O4
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [3D ground clipping](../post-s10-convergence/target-specification.md#3d-ground-clipping).

**Decisions settled here:**

- Implement the specified reach, far and near formulas, the exact frustum footprint and the 6,000-line budget, then run the checkpoint below before any other polish.
- `displayGroundYMeters` is an optional session input, defaulting to `null`. It never enters scene bounds or fit.

**Files:**

- `packages/camera-core/src/viewport.ts`
- `apps/editor/src/lib/authoring/stage/camera-session.ts`
- `apps/editor/src/lib/authoring/stage/stage-grid.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`
- Tests: `camera-viewport-evaluation.test.ts`, `stage-grid.test.ts`

**Rules:**

- The mat centres on the quantised target, with half-extent at least 1.5 × reach and a polygon offset.

**Contracts this slice updates at cutover:**

- None. The new input field is optional, so `T1.viewport-projection@1` keeps its version.

## 3a. Experimental checkpoint

Run this once, on the implementation branch, before asking for review. Extend the audit's [sweep](../post-s10-convergence/evidence/candidate-grid-sweep-probe.ts.txt) to the real wiring: 4 viewports, 7 elevations (5 to 89°), 7 azimuths, 6 zooms and 2 targets. Keep the sweep as a test.

| # | Measure | Pass |
| --- | --- | --- |
| 1 | Ground samples inside clip range but outside grid coverage | 0 |
| 2 | Gap between clipped ground and horizon, at 900 px height, target-plane height 5 m or more | At most 12 CSS px |
| 3 | Same gap at extreme zoom-in, below 5 m | At most 40 CSS px |
| 4 | Lines drawn, any pose | At most 6,000, with major lines never dropped |
| 5 | 24-bit depth resolution at the target distance | At most 1 mm |
| 6 | `displayGroundYMeters: null` | Identical to today's evaluation |
| 7 | Browser, 1440 × 900: overhead, 45°, 15°, 5° and horizon in frame | No straight cut, moiré band or close-up fighting; orbit observably smooth |

The earlier probe measured 0 on row 1, 27 px on row 2 without the eye-height term, 359 px on row 3 and 11,138 lines on row 4, so rows 2, 3 and 4 are the real test.

**Recording.** Rows 1–6 are numerical and row 7 is visual. The acceptance record states each row's measured value and result, on the final revision, along with any value measured before a fallback. Rows 1–6 are measured from geometry and clip range, so a fade or any other appearance change can't make them pass.

**Fallbacks, taken in order and only for the named row. Rerun every row after each one:**

1. **Row 7 fails at the horizon:** add O4's accepted fade to the mat near the horizon. This can only resolve row 7. A fade may also soften a band while row 2 or 3 is failing, but those rows stay failed.
2. **Row 4 fails:** shrink the minor rectangle around the target, then draw major lines only beyond it. Row 4 passes only on its re-measured count.
3. **Row 5 fails, or row 7 still fails:** cap reach at the largest value that passes those rows. Ship the near-plane fix and exact footprint, and record the remaining band in the acceptance record and drift register.

Rows 1 and 6 have no fallback. A failure there is a defect to fix in this slice.

**Outcomes, one of which the acceptance record states:**

| Outcome | Condition | What happens next |
| --- | --- | --- |
| **Passed** | Rows 1–7 pass with no fallback | Normal review and merge |
| **Passed with visual fallback** | Rows 1–6 pass, and row 7 passes only with the fade | Normal review and merge, with before and after captures recorded |
| **Numerical failure** | Any of rows 1–6 still fails on the final revision, whatever it looks like | **Owner checkpoint**, with measured values and captures. The slice doesn't merge until the owner rules |
| **Reach capped** | Fallback 3 was used | **Owner checkpoint**, with captures. The slice doesn't merge until the owner rules |

Never use an infinite grid, disabled depth tests, a moved Camera or widened semantic bounds. Timing is not a criterion.

## 4. Test cases

- Ground samples classified sky, behind, near or far, across the sweep, through actual Stage wiring.
- Portrait and landscape, translated targets, datum changes and horizon crossing.
- Every checkpoint row that can be asserted deterministically.

## 5. Browser acceptance

- Checkpoint row 7, with captures attached to the acceptance record.
- Check whether D29 reproduces.

## 6. Exclusions and stop conditions

- Semantic fit.
- An infinite grid.
- Timing gates.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
