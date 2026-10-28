# T1 — Spatial world: current baton

Track-scoped handoff. **Replace only this file for T1 work.**

```text
PHASE: T1.P02 Native Wall creation is active and **CLOSABLE**. S01, S02, S03, S04, S05 and S06 are
       shipped. S04, the declared final gate, was accepted by owner 2026-10-28 at `46a31c81`; no
       phase closure or track-completion event is recorded.
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
SLICE: none active. S04 closeout is complete on PR #210; P1 merge pending. The final-gate artifact
       stays live for the phase-close decision:
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/acceptance.md
ACCEPTANCE: The owner's explicit S04 closeout trigger is the owner's review/waiver of the separate
       independent-review verdict for that slice only; no correctness or performance evidence was
       waived. Evidence at `d1fe6e5c`: 4 journeys / 26 rows in Chromium and Chrome; check 0/0,
       arch 23/188, heavy 11/138, full 224 files / 2,874 tests, all package checks clean, DB-backed
       API 14/115 with zero skips, and both builds clean. The closeout tree passed the arch/docs
       lane 23/188; the P2 correction itself is at `46a31c81`.
NEXT:  P1 merge of PR #210 (merge commit only; no squash or rebase). After that the phase-close
       decision waits on a separate owner instruction. No successor T1 implementation is authorized
       by this baton.
BLOCKERS: P1 merge and the owner phase-close decision only. Performance is **not** a blocker: the
       owner suspended the mandatory benchmarking strategy indefinitely
       (../../reference/decisions/performance-mandate-suspension-2026-10-28.md). No formal
       F2/F3/F4/F8/F13 matrix, battery certification or full `npm run perf` workflow was run or is
       authorized. S01's F2 S/M rows, S02's formal family, S03's Opening rows and S06's battery/
       grid-XL/sweep rows remain **unmeasured**, not passes; the recorded S02 456.0 KiB br and S03
       426.7 KiB br Stage results remain historical, not repaired or erased.
CARRY: T1 maintenance retains the one-frame `lowerColumnHeight` observation; S06 FO-1 … FO-5 and
       T1 deferred-retirement rows remain owned in their records. T3's S06 acknowledgement is a
       records-only item owned by T3. Performance investigations are owner-initiated only, after an
       observed slowdown.
ROUTE: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/acceptance.md
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/implementation-plan.md
       ../../reference/components/performance.md
RELEASE: ../../reference/decisions/t1-p02-s04-authorization-2026-10-28.md; the released S04 row in
       ../../roadmap/now.md stays until an owner release prunes it.
PAST:   ../../reference/decisions/t1-p02-s03-authorization-2026-10-27.md
POLICY: ../../reference/decisions/performance-mandate-suspension-2026-10-28.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
            No performance benchmark is authorized by this baton.
```
