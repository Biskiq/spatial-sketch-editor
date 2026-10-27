# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01, S05 and S06 are shipped. No slice is active.
SLICE: S02 draw, close, divide and delete — **proposed, held, not authorized**. Its plan is
       complete but unreviewed. The performance-first halt is lifted now that S06 is accepted and
       merged, so the boundary is no longer the halt but S02's own requirements: an owner release,
       plan review, the T3 review of the shared Head/F4 shell allocation and the T2/T3
       contribution-compatibility review. S03 (outline) follows S02; S04 is the final gate.
ACC:   T1.P02.S06 performance foundation — **accepted AC-qualified 2026-10-27, merged as
       `6af62eb4`** (P1 merge commit of PR #190, `t1/p02-s06-bench-setup`); recovery anchor
       `e676a363` is reachable from `main` and tag `closed/T1.P02.S06` is pushed. Milestone gate
       passed 2026-10-26 (15/15 decision rows, 27 verdicts, full E5, 2,632.7 s on the designated M2,
       Chrome 156.0.8078.48, AC power);
       post-Bench-2 attribution and the T3/T2 shared-boundary review are recorded; the closeout stub
       carries the ratified disposition, budgets and follow-ons. Battery qualification, grid-XL
       timing and the sweep latency rows are assigned to S04.
NEXT:  No slice is released. The next authorization boundary is an owner release for S02; until it
       lands, the production hold and the [release list](../../roadmap/now.md) keep every inheritor
       stopped. No benchmark, attribution, E5 or review rerun is owed for S06.
BLOCKERS: none technical. S02–S04, the T2 final gate and T4 stay held pending their own releases.
       T3 **ownership** acknowledgement of the recorded shared-boundary review was not recorded
       before merge; the owner authorized the merge directly and the independent T3/T2 review itself
       passed. That acknowledgement is now a records-only item owned by T3, not a gate on T1 work.
CLAIMS: PR #190 released its `apps/editor/perf/**` claim on merge. Writer: the T1 S06 agent; the
       branch `t1/p02-s06-bench-setup` is merged and retired. No shared test helper under
       `apps/editor/tests/helpers/**` is edited.
CARRY: - Owned follow-ons in the S06 acceptance stub (none an obligation, none a budget): FO-1
         incremental pick-index maintenance and first-pick-after-edit; FO-2 whole-project compile
         materialisation, membership assembly and commit envelope; FO-3 small-project fixed overhead
         / S edit regression; FO-4 admitted-history cache byte budget (T3); FO-5 carry continuous
         pointer-pan CPU and pick-after-commit rows into future performance slices.
       - S01's F2 S/M open timings and S06's battery qualification stay assigned to S04 on the
         designated M2. L cold open (2.0 s Target) and L draw submission (2,500 Target) remain
         owner-visible misses, not hard-gate breaches.
       - Occupancy-derived curve-knot/interior-anchor allocators stay outside accepted intents; the
         first curve-authoring slice captures them before curved drawing ships.
       - Live deferred-retirement rows in the T1 track README: the Room-level wall mesh path
         (`VisitorLayoutShell` Room branch) and the Camera room-ownership branches
         (`isWorldPointInsideRoomXZ`).
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → S06 evidence: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md
        → contract: ../../reference/components/performance.md
        → next slice: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
