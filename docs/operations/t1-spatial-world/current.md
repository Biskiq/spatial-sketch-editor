# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01, S02, S05 and S06 are shipped and S03 is
       released.
SLICE: S03 Opening family — **implementation complete, awaiting owner acceptance and merge**
       (../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md). The complete plan and its
       pre-build plan review are recorded 2026-10-27; implementation is committed on
       `t1/p02-s03-opening-family` at `985cd214` from trusted base `98449a44` (PR #199 `a674eedb`
       is an ancestor), and the branch is pushed for review. S02 draw, close, divide and delete shipped
       `owner-override` on PR #201 (P1 merge `ce159a1e`; anchor `36c18db9` and tag
       `closed/T1.P02.S02` verified reachable; product/harness revision `64b9435d`)
       (../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/acceptance.md),
       with its formal performance family deferred to S04 and the Stage route's 456.0 KiB br
       recorded against the ≤400 KiB hard budget as an explicit known miss. M4 is re-armed. S04 is
       the final gate.
ACC:   T1.P02.S03 Opening family — **implementation evidence recorded at `985cd214`, not accepted**
       (../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/acceptance.md).
       Gate: `check` 0/0, `arch` 22/180, `full` 216/2,674, `build` and `camera-core`/`layout-core`/
       `project-model` checks clean; branded-Chrome browser 15/15 and S02 preservation 28/28. Three
       independent Codex review rounds (gpt-6.1-sol, high effort) reproduced eleven defects; all are
       repaired and re-reviewed with no unresolved finding. The Stage route is **426.6 KiB br**
       against the ≤425 KiB hard row (1.6 KiB over) — an owner acceptance decision, not a pass. No
       formal performance row is claimed.
       T1.P02.S02 draw/close/divide/delete — **accepted (`owner-override`) and shipped 2026-10-27**
       (PR #201; P1 merge `ce159a1e`; anchor `36c18db9` and tag `closed/T1.P02.S02` verified
       reachable from `main`). Browser 28/28 in Chromium and 28/28 in branded Chrome; automated
       gate `check`, `arch` 22/180, `full` 214/2,653, `build` and the four package checks passed at
       `64b9435d`. No performance row is a pass.
       T1.P02.S06 performance foundation — **accepted AC-qualified 2026-10-27, merged as
       `6af62eb4`** (P1 merge commit of PR #190, `t1/p02-s06-bench-setup`); recovery anchor
       `e676a363` is reachable from `main` and tag `closed/T1.P02.S06` is pushed. Milestone gate
       passed 2026-10-26 (15/15 decision rows, 27 verdicts, full E5, 2,632.7 s on the designated M2,
       Chrome 156.0.8078.48, AC power); battery qualification, grid-XL timing and the sweep latency
       rows are assigned to S04.
NEXT:  Owner review of the S03 implementation PR, its acceptance ruling on the 426.6 KiB br Stage
       route, and the P1 merge that preserves the `985cd214` record. Formal F4/F8 Opening create/delete
       S/M rows remain unrun and are owed to S04, never recorded as passes. S04 is the final gate and
       carries: S02's deferred formal performance family, the S02 456.0 KiB br miss and this slice's
       426.6 KiB br miss, S01's F2 S/M timings, S06's battery qualification and grid-XL/sweep rows,
       and integrated S03 proof once it ships. No other T1 slice is released: S04 needs its own
       release, and the [release list](../../roadmap/now.md) is the only permission list.
BLOCKERS: None technical. S03 waits on the batch PR #199 merge and its own plan review; S04 remains
       held pending its own release, and S04 cannot accept while the deferred performance family or
       the Stage hard-budget miss is unaddressed. T3's S06 ownership acknowledgement remains a
       records-only item owned by T3, not a gate on T1 work.
CLAIMS: S03 shared-file claim (2026-10-27): writer `t1/p02-s03-opening-family` owns
       `apps/editor/src/lib/authoring/adapters/layout/**` (the new Opening planners, Ink surface,
       palette and adapter) and its Layout tests, on patch base `98449a44`; review was the independent
       Codex CLI pass recorded in the acceptance evidence. The build also needed a bounded additive
       hover dispatch in `stage-facade.ts`, its route caller, and the new browser spec; those edits are
       recorded in the PR rather than hidden behind the original claim. PR #201 released its
       `apps/editor/perf/**` and shared Stage/shell claim on acceptance; the T1 S02 writer owned those
       paths, and S02's feature branch is retired after its P1 merge.
CARRY: - S03 formal performance family (F4/F8 Opening create/delete at S/M) → S04, unrun and never
         a pass.
       - S03 Stage bundle hard miss: 426.6 KiB br against ≤425 KiB, recorded as a known condition
         awaiting the owner's acceptance ruling; the per-slice +4.3 KiB growth does not waive the row.
       - S02 formal performance family (F3/F4/F8 at S/M, per-move evaluation, F2 open, F13 leak
         cycles, Stage first-load delta) → S04, unrun and never a pass.
       - S02 Stage bundle hard miss: 456.0 KiB br against ≤400 KiB, recorded as a known condition;
         attribution/reduction remains owning delivery work and S04 cannot erase it.
       - Narrow-shell residual: `lowerColumnHeight` may be one observed frame stale while Preview
         unmounts the lower column; non-blocking, T1 maintenance.
       - S06 owned follow-ons FO-1 … FO-5 and the T1 deferred-retirement rows (Room-level wall mesh
         path, Camera room-ownership branches) remain owned in their records.
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → S02 evidence: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/acceptance.md
        → S06 evidence: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md
        → contract: ../../reference/components/performance.md
        → next slice: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md
        → next gate: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/implementation-plan.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md
PAST:    ../../reference/decisions/next-wave-authorization-2026-10-27.md
         ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
