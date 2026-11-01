# T1 current work

PHASE: R217 Core Editor Stability.
ACTIVE: none. R217.S18 Selection ink is accepted at `f92e1211` and closed on its implementation branch `codex/r217-s18-selection-ink` (based on `bf48c9da`); its merge and post-merge anchors are recorded in its acceptance record. R217.S17 and S17A are shipped.
RESUME: no checkpoint is active.
NEXT: after the S18 merge commit is on `main` and its anchors are verified, start R217.S19 3D ground clipping from `main` through the runbook start step, under the campaign release. S11 remains the final integration check after S25, not an earlier merge gate.
BLOCKER: None for S18. S11 still owes the integrated journeys plus the manual coarse-pointer, native-touch and Safari rows; its schedule is unchanged.
BOUNDARIES: One active implementation slice at a time. Camera pose/clip/basis stays T1-owned in `packages/camera-core/src/viewport.ts`; Wall and Junction outcomes stay in Layout planners. S17's landed Scene/form manipulation follows the approved upright planner boundary; no non-upright planner support was added.
CARRY: S18 pinch-point case falls back to raw Paper polygons (T1, `paper-fill-geometry.ts`). S17A residuals: built-in catalogue models are offered only in projects holding their asset resource, because nothing yet introduces that resource; Find-only Place plinth is unreviewed against Objects; `ink-readings-v1` has no contributor.
