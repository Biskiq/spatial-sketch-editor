# T1 current work

PHASE: R217 Core Editor Stability.
ACTIVE: R217.S19 3D ground clipping, on `codex/r217-s19-ground-clipping` from `main` `1032c09c`, implemented under the owner's 2026-10-31 ruling (plan §3b) and verified at `2096f940`. No parallel implementation work. R217.S18 Selection ink is closed and merged; its anchors are in its acceptance record. R217.S17 and S17A are shipped.
RESUME: no checkpoint is active.
NEXT: routine closeout of R217.S19 from its acceptance record (merge commit, then post-merge anchors), then start R217.S20 Roles and head from `main` through the runbook start step. S11 remains the final integration check after S25, not an earlier merge gate.
BLOCKER: None for S19. S11 still owes the integrated journeys plus the manual coarse-pointer, native-touch and Safari rows; its schedule is unchanged.
BOUNDARIES: One active implementation slice at a time. Camera pose/clip/basis stays T1-owned in `packages/camera-core/src/viewport.ts`; Wall and Junction outcomes stay in Layout planners. S17's landed Scene/form manipulation follows the approved upright planner boundary; no non-upright planner support was added.
CARRY: S18 pinch-point case falls back to raw Paper polygons (T1, `paper-fill-geometry.ts`). S17A residuals: built-in catalogue models are offered only in projects holding their asset resource, because nothing yet introduces that resource; Find-only Place plinth is unreviewed against Objects; `ink-readings-v1` has no contributor. S19 residual: for a target far from the content, near stays on the scene-sphere floor (row 5; a content-depth near is proposed separately).
