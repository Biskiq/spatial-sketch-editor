# T1 current work

PHASE: R217 Core Editor Stability.
ACTIVE: No implementation slice is active. R217.S17A (Objects entry point, datum placement) is the latest shipped slice.
RESUME: no checkpoint is active.
NEXT: R217.S18 is approved and next in the shared-file order; start it only under the campaign release and the normal runbook. S11 remains the final integration check after S25, not an earlier merge gate.
BLOCKER: None for S17. S11 still owes the integrated journeys plus the manual coarse-pointer, native-touch and Safari rows; its schedule is unchanged.
BOUNDARIES: One active implementation slice at a time. Camera pose/clip/basis stays T1-owned in `packages/camera-core/src/viewport.ts`; Wall and Junction outcomes stay in Layout planners. S17's landed Scene/form manipulation follows the approved upright planner boundary; no non-upright planner support was added.
CARRY: S17A residuals: built-in catalogue models are offered only in projects holding their asset resource, because nothing yet introduces that resource; Find-only Place plinth is unreviewed against Objects; `ink-readings-v1` has no contributor.
