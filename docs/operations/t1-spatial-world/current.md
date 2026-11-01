# T1 current work

PHASE: R217 Core Editor Stability.
ACTIVE: R217.S19 3D ground clipping, on `codex/r217-s19-ground-clipping` from `main` `1032c09c` (S18 merged as `dc341786`, anchors PR #243). No parallel implementation work. R217.S18 Selection ink is closed and merged; its anchors are in its acceptance record. R217.S17 and S17A are shipped.
RESUME: no checkpoint is active.
NEXT: owner ruling on R217.S19's §3a checkpoint (Numerical failure: rows 2, 4 and 5; measured values, decisions owed and captures in the S19 acceptance record). After the ruling: adjust and re-measure on the branch, then independent review and routine closeout. S11 remains the final integration check after S25, not an earlier merge gate.
BLOCKER: R217.S19 owner checkpoint: §3a rows 2 (horizon band 14–15 px > 12), 4 (5 m/25 m levels alone exceed 6,000 lines) and 5 (floored near for a target far from the content) fail with the specified formulas; the slice does not merge until the owner rules. S11 still owes the integrated journeys plus the manual coarse-pointer, native-touch and Safari rows; its schedule is unchanged.
BOUNDARIES: One active implementation slice at a time. Camera pose/clip/basis stays T1-owned in `packages/camera-core/src/viewport.ts`; Wall and Junction outcomes stay in Layout planners. S17's landed Scene/form manipulation follows the approved upright planner boundary; no non-upright planner support was added.
CARRY: S18 pinch-point case falls back to raw Paper polygons (T1, `paper-fill-geometry.ts`). S17A residuals: built-in catalogue models are offered only in projects holding their asset resource, because nothing yet introduces that resource; Find-only Place plinth is unreviewed against Objects; `ink-readings-v1` has no contributor.
