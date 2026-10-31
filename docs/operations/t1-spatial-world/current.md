# T1 current work

PHASE: R217 Core Editor Stability.
ACTIVE: No implementation slice is active. R217.S16 shipped via PR #237; its acceptance record and recovery anchors are in `docs/roadmap/r217-core-editor-stability/r217.s16-openings-and-junction-hover/acceptance.md`.
NEXT: R217.S17 is next in the approved campaign, but has not started. Begin only through the T1 runbook after rechecking dependencies, scopes and the trusted base. R217.S11 retains integrated acceptance and its coarse-pointer, native-touch, Safari and integrated journeys.
BLOCKER: None for S16. Signed-out legacy-account recovery remains deferred by owner decision; existing IDs and ownership are retained and valid sessions can enroll local credentials.
BOUNDARIES: One active implementation slice at a time. Camera pose/clip/basis stays T1-owned in `packages/camera-core/src/viewport.ts`; Wall and Junction outcomes stay in Layout planners. S16 adds Plan Opening-over-host selection and Plan-only idle Junction hover/drag, with no 3D Junction hover.
CARRY: T1 maintenance retains the one-frame lowerColumnHeight observation; S06 TD-15 owns module-scoped Height hint repetition; S06 FO-1–FO-5 and T1 deferred-retirement rows remain in their records; S03 real-browser multi-touch capture ordering remains S11 manual-owed. S04 carries Opening swing representation gap and Shaded Plan restyle. S07 defers Wall height/thickness grips. S18 selection calibration, S19 grid clipping and S23 palette overhaul stay in their registered slices. S12–S16 carry no residual beyond S11 rows.
