# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.**

```text
PHASE: T3.P02 First Capture and Cut Preview →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       CLOSABLE, not closed (final gate T3.P02.S02 accepted 2026-10-24 as owner-override at 335820d6)
       T3.P03 Shared acceptance and measurement →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       CLOSABLE, not closed
       T3.P04 Project lifecycle (planning only) →
       ../../roadmap/t3-experience/t3.p04-project-lifecycle/README.md
ACTIVE: none. No T3 slice is in progress or authorized.
NEXT:   Owner decision on T3.P04 (project lifecycle, planning only). Its single proposed child, project
        rename and delete, is not authorized; the register says it needs its own owner decision after
        T3.P02.S02 acceptance (now met), and it also needs the explicit API handoff from T2 (T2.P02.S02
        merged 2026-10-24, PR #185).
        Owner phase-close requests for T3.P02 and T3.P03 are owner-invoked; nothing closes them here.
RELEASE: ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
         (the owner release of 2026-10-24 pruned T3.P02.S02 from docs/roadmap/now.md; T3.P04 is strictly
         unrelated to its performance-first halt and still needs its own owner decision and release)
ROUTE:   ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/acceptance.md
         (gate artifact, live; closed stubs for its plan, review and hand-off)
BLOCKER: none. PR 184 merged as P1 merge commit 663846af; closed/T3.P02.S02 → 335820d6 is pushed.
CARRY:   Performance deferred (owner ruling 2026-10-24, not claimed as passing): traced Preview first frame;
         capture/bind completion; M-workload F10 rows; F13 re-measure; reference-machine run; Stage
         initial-load delta. Transferred as measurement to T1.P02.S06 (performance foundation). A miss in
         T3-owned code is reported back to T3. The H0 trace-method ruling stays with the owner.
         S06 edits the shared H0 harness and fixtures only with T3 review.
         Unrun rows deferred (Scope B): Ask Rule; Experience paused editing; dense 20/50-View and 15/30-Stop
         fixtures; browser Preview-replacement probe; browser Save/download/reload; touch/coarse pointer;
         DOM reach without raycast; partial shared-Camera row; Travel/detour browser rows.
         Deferred T1 seam: host EditorCard has no Experience contribution seam.
         F2 epoch migration 005 production activation remains a separate owner-run operation. Track completion
         and Core Editor Stability acceptance are separate owner events.
```
