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

## 3b. Amendment — 2026-10-31

The owner directed this amendment on 2026-10-31 after reviewing the first checkpoint, in which rows 2,
4 and 5 failed with the formulas above, and after reporting two visible defects: a dark disc on the
mat and a grid that vanished and changed between zoom levels. It supersedes the conflicting parts of
§3 and §3a. The [acceptance record](./acceptance.md) keeps the first checkpoint's values.

**Causes.**

- **Disc.** The mat's polygon offset, added in this slice, left a dark disc around the target.
- **Grid behaviour.** S13 faded each level by its spacing at the target, applied to the whole
  lattice. A perspective mat therefore faded together everywhere. Between 5 and 10 px per 5 m it
  drew only a fading 5 m level, because 25 m appeared only after 5 m had gone.
- **Row 2.** At the 54° reference FOV, `64 × eyeHeight` leaves a 13–15 px band.
- **Row 4.** Line geometry over a horizon-deep footprint exceeds 6,000 lines with majors alone.

**Amended scope.**

- **Mat grid per pixel.** The mat's grid is a shader on one finite quad that shares the mat's
  transform. Each pixel applies the 16 → 8 CSS px fade from its own projected spacing, so near ground
  shows 1 m, mid-distance 5 m and far 25 m, and the grid fades to plain mat before the horizon. The
  25 m level cross-fades in as 5 m fades out (`25 m weight × (1 − 5 m weight)`). Lines stay anchored to
  world zero. Paper keeps its line grid: it is orthographic, so its spacing is uniform.
- **No line footprint or budget on the mat.** The exact-footprint rule and the 6,000-line budget no
  longer apply to it, and row 4 is replaced by "the mat grid is one quad at constant cost". This
  is a finite grid on the finite mat, not an infinite grid.
- **Mat depth.** The mat draws first (`renderOrder −1`) and writes no depth, with no polygon offset.
  Every wall, floor and object draws over it; the grid quad depth-tests against real geometry only.
- **Reach.** `reach = max(24 × extent, 96 × eyeHeight)`. Rows 2 and 3 keep their limits.
- **Row 5.** It is measured for poses where the target-centred scene sphere does not reach the eye.
  Otherwise near stays the scene-sphere floor, unchanged from today, and is recorded as a residual. A
  near plane derived from content bounds would add bounds to Camera state and is proposed separately.
- **Files.** Add `shell/StageMatGround.svelte` and `shell/stage-mat-grid.ts`. `StageGrid.svelte` and
  `stage-grid-scene.ts` become Paper-only.
- **Contract.** The shell + visual-system contract's grid paragraph is updated in the same PR.

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
