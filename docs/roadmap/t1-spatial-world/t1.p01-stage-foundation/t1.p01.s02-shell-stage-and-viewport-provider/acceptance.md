# T1.P01.S02 — acceptance record (closed)

AUTHORITY: NONE

delivered
The read-only Stage and viewport provider landed in PR #128. It boots stored current-format sources, starter projects and explicit source JSON through one persistent Canvas and one viewport evaluation. The host has no write path. Plan representation supplies membership, Reveal, Index and hit eligibility; the owner-approved S02 contract does not include Plan-cut drawing.

acceptance
Accepted and shipped 2026-10-17 by owner-override for T1.P01.S02 at implementation revision 567a17e7a36b3fd89eb1b8737efb68bc7e9c1ae5.

owner ruling — per-slice, per-revision override
On 2026-10-17, the owner authorized accepting and closing this slice while waiving (1) the complete merge-gate rerun on then-current main and (2) the S06 architecture-integration proof as prerequisites to S02 acceptance. This override applies only to T1.P01.S02 at revision 567a17e7a36b3fd89eb1b8737efb68bc7e9c1ae5. It does not claim that the current-main gate ran. S06's integrated result remains owed to S06. T1.viewport-projection@1 remains ratified, and no consumer readiness is claimed.

review record
The full acceptance record at the recovery anchor documents four independent architecture-review rounds. Findings 2–9 were fixed with regression coverage; finding 1 was narrowed by the owner's 2026-10-16 decision to the reduced S02 visual contract, with Plan-cut drawing left unassigned. This closeout introduced documentation changes only and did not reopen product review.

verification evidence
Declared tier: architecture-integration. The recorded runs were measured on the merged tree based on main revision 942833770a2dbc5ba91050b091b8f98e047f352e, not the current main. The owner override above waives the current-main rerun as an S02 acceptance prerequisite.

- npm test: 151 files / 1,957 tests passed.
- npm run test:arch: 20 files / 161 tests passed.
- npm run test:fast: 123 files / 1,678 tests passed.
- npm run test:heavy: 8 files / 118 tests passed.
- npm run check: 0 errors, 0 warnings; npm run build completed.
- Layout, project-model, camera-core and API checks were clean; API tests passed 39/39 with no skips and no DATABASE_URL.
- Browser evidence covered starter boot, one Canvas, the Plan/3D switch, representative 3D and Plan picking, and upper-Wall picking. The recorded limitations remain: no full keyboard/screen-reader pass, no browser re-observation of real multi-pointer capture, no cloud-backed replacement observation, and no preview frames. State, route and regression suites cover the corresponding claims; the limitations are not reported as observed passes.

capability outcome
The slice is shipped under owner-override. The T1.viewport-projection@1 gate remains ratified pending S06's integrated result; no capability acceptance record is issued here and no consumer may claim readiness from this slice alone.

residuals
1. S06's integrated result remains owed; it is the route for viewport consumer readiness.
2. Plan-cut drawing remains unassigned; the phase owner assigns it when planning a later shell slice.
No other open review finding or unowned shim was recorded.

entry points
implementation: packages/camera-core/src/viewport.ts; packages/layout-core/src/layout-plan-representation.ts; apps/editor/src/lib/authoring/stage/; apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
validation: apps/editor/tests/lib/authoring/stage-facade.test.ts; apps/editor/tests/lib/authoring/stage-consumer-probes.test.ts; apps/editor/tests/lib/authoring/stage-shell-composition.test.ts
regressions: apps/editor/tests/lib/authoring/stage-input.test.ts; apps/editor/tests/lib/authoring/stage-session.test.ts; apps/editor/tests/lib/authoring/editor-host-no-write.test.ts

reference reconciliation
Existing live reference claims now distinguish the post-#115 read-only Stage from the removed editable shell, and the current Plan reading from a Plan-cut renderer. No new reference destination was created. No source or test files changed in closeout.

recovery
git show 567a17e7a36b3fd89eb1b8737efb68bc7e9c1ae5:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/acceptance.md

CLOSEOUT PRESERVATION — T1.P01.S02 (2026-10-17)
prose compacted: 2 stubs at their own paths
reference promotions: 0; existing reference claims reconciled in place
renderable evidence archived: 0 files / 0 bytes
evidence stubs / manifests: 0
transient artifacts removed: 0
historical anchors: plan 8ec0c5f15126190863d1f6db2220e2487bf7d7f6; acceptance 567a17e7a36b3fd89eb1b8737efb68bc7e9c1ae5; closed/T1.P01.S02 targets 567a17e7a36b3fd89eb1b8737efb68bc7e9c1ae5 (local only — not pushed)
new live → archive prose links: 0
manual-owed verification rows: 0 plan-owned manual rows; browser limitations above are disclosed and not claimed as passes
remaining deferred items: 2 (S06 integrated result; Plan-cut drawing assignment)
permanent stubs added: 2
