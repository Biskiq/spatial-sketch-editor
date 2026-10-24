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
        T3.P02.S02 acceptance (now met), and it also needs the explicit API handoff after T2.P02.S02 merges.
        Owner phase-close requests for T3.P02 and T3.P03 are owner-invoked; nothing closes them here.
RELEASE: ../../reference/decisions/post-batch-e-authorization-2026-10-23.md
         (docs/roadmap/now.md is owner-owned and still lists T3.P02.S02 until an owner release prunes it)
ROUTE:   ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/acceptance.md
         (gate artifact, live; closed stubs for its plan, review and hand-off)
BLOCKER: PR 184 is not merged. Its P1 merge commit and post-merge anchor check
         (closed/T3.P02.S02 → 335820d6) are pending; the owner merges.
CARRY:   Performance deferred (owner ruling 2026-10-24, not claimed as passing): traced Preview first frame;
         capture/bind completion; M-workload F10 rows; F13 re-measure; reference-machine run; H0 trace-method
         ruling; Stage initial-load delta. Owned by a future performance/scale exploration.
         Unrun rows deferred (Scope B): Ask Rule; Experience paused editing; dense 20/50-View and 15/30-Stop
         fixtures; browser Preview-replacement probe; browser Save/download/reload; touch/coarse pointer;
         DOM reach without raycast; partial shared-Camera row; Travel/detour browser rows.
         Deferred T1 seam: host EditorCard has no Experience contribution seam.
         Shared file: PR 185 (T2.P02.S02) also edits +page.svelte and VisitorPreviewSurface.svelte;
         whichever merges second reruns its gate.
         F2 epoch migration 005 production activation remains a separate owner-run operation. Track completion
         and Core Editor Stability acceptance are separate owner events.
```
