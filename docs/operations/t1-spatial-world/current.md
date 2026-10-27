# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01 and S05 are shipped.
SLICE: T1.P02.S06 performance foundation — **in-progress, not accepted, not merged**. Released
       2026-10-24; candidate frozen at `d89554b1` on PR #190 (`t1/p02-s06-bench-setup`, `main`
       merged at `d7600576`). Evidence is complete:
       - **Milestone gate (2026-10-26):** 15/15 decision rows (27 verdicts) pass, full E5, 2,632.7 s
         on the designated M2, Chrome 156.0.8078.48, N1 1920×1080 at DPR 1, **AC power** (the
         contract's designated-machine condition is battery: a recorded deviation, not certified).
       - **Post-Bench-2 attribution (2026-10-27, `9df3f668`):** continuous pan −51 % main-thread task
         per move at L (−24 % at S), repeat pick −28 %, late-order pick −69 %, first pick +31 ms at L
         (index build moved into the click), local edit unchanged at L (+7.5 ms at S, small sample),
         and the first pick after a commit rebuilds the index and fragments. Eliminated work is
         distinguished from deferred work throughout.
       - **T3/T2 shared-boundary review (2026-10-27):** Plan retention, compiler-delta certificate,
         Stage admission, capture/codec sharing, visitor isolation and shared rendering all pass
         implementation review; no blocking defect; five preconditions/limits recorded.
NEXT:  Owner ratification of the proposed **AC-qualified disposition with battery qualification
       deferred** in the acceptance record. On ratification: routine `slice-closeout` (phase status
       `shipped`, acceptance stub + Git anchor, this baton, documentation gate), then merge PR #190.
       No benchmark, attribution, E5 or review rerun is owed, and closeout changes no product code.
BLOCKERS: the owner disposition above, and T3 **ownership** acknowledgement of the recorded review
       (a sign-off, not more work). S02 stays halted until S06 is accepted **and** merged.
CLAIMS: PR #190 owns `apps/editor/perf/**` until merge. Writer: the T1 S06 agent, branch
       `t1/p02-s06-bench-setup`. Every owner-run pass on the M2 holds the machine-wide perf lock.
       No shared test helper under `apps/editor/tests/helpers/**` is edited.
CARRY: - S06 attribution follow-ons, owned and bounded in the acceptance record: FO-1 incremental
         pick-index maintenance and first-pick-after-edit; FO-2 whole-project compile
         materialisation, membership assembly and commit envelope; FO-3 small-project fixed
         overhead / S edit regression; FO-4 admitted-history cache byte budget (T3); FO-5 carry
         continuous pointer-pan CPU and pick-after-commit rows into future performance slices.
         None is an S06 obligation and none creates a budget.
       - S02 (draw, close, divide and delete) after S06 acceptance and merge, then its own owner
         authorization, plan review, T3 review of the shared Head/F4 shell allocation and the
         T2/T3 contribution-compatibility review. Then S03 (outline) and S04 (final gate).
         Order: S06 → S02 → S03 → S04.
       - S01's F2 S/M open timings stay assigned to S04 on the designated M2. Battery
         qualification of the S06 rows is proposed to the same integrated gate.
       - Occupancy-derived curve-knot/interior-anchor allocators stay outside accepted intents; the
         first curve-authoring slice captures them before curved drawing ships.
       - Live deferred-retirement rows in the T1 track README: the Room-level wall mesh path
         (`VisitorLayoutShell` Room branch) and the Camera room-ownership branches
         (`isWorldPointInsideRoomXZ`).
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → acceptance:
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md#reconciliation-follow-ons-and-closeout-readiness-2026-10-27
        → review:
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/review-handoff.md#t3-shared-boundary-review-2026-10-27-independent-agent
        → plan:
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
