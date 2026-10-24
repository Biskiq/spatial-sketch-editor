# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.**

```text
PHASE: T3.P03 Shared acceptance, isolation and measurement →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       T3.P02 First Capture and Cut Preview →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       T3.P04 Project lifecycle (planning only) →
       ../../roadmap/t3-experience/t3.p04-project-lifecycle/README.md
ACTIVE: T3.P02.S02 is implemented on `t3/p02-s02-integrated-final-gate` and its PR is open for the
        owner's acceptance; no closeout has run, so the slice register still reads approved.
        Shared-file claims carried by that PR: additive `units/planning.ts` Experience intents; the
        bounded T1-review host patch in `routes/project/[projectId]/spatial/+page.svelte` (Capture/
        Guide dock surface contribution, Preview handover/return, authoring-chrome guard, warm
        visitor-surface lifetime), the visitor surface/director run-epoch props, and the F10/F13
        perf flow rows. No API route, no T2 staging grant, no shared harness edit.
NEXT:   Owner acceptance of T3.P02.S02's recorded evidence. At f6de016d the Preview entry row is
        measured (55/47 ms repeat-use, 68/72 ms cold, press → first rendering opportunity) but is
        still not a traced first frame, capture/bind completion is unmeasured, and several matrix
        rows remain unrun; all need a disposition. The review fix on top of it (fffe1c5a) is
        verified by the correctness lanes only: re-running the perf pass was declined by the owner
        on 2026-10-23, so the recorded rows stay those of f6de016d. The slice hand-off is
        ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/handoff.md.
        Closeout follows acceptance; P04 planning follows by capacity and authorizes no code.
RELEASE: ../../reference/decisions/post-batch-e-authorization-2026-10-23.md
ROUTE:  ../../roadmap/cross-track-execution.md#next-parallel-batch → P02 final-gate plan.
        P03 phase README → FINAL PHASE GATE / PHASE CLOSE and retained measurement dispositions.
        P04 phase README → proposed lifecycle plan and pending final-gate acceptance.
BLOCKER: none beyond the release-list condition. P03 is closable, not closed;
         closing it needs an explicit owner phase-close request. No phase/track closes here.
CARRY:  S02 resolved the Preview handover/return token and the F10 entry cost (a warm surface now
        replaces the per-entry rebuild). Still unclaimed: the contract's traced first-frame row and
        capture/bind completion, H0's trace-method ruling, reference-machine hard rows, calibration,
        GPU/workload limitations, and the unrun matrix rows in the acceptance record.
        Previous owner overrides apply only to their named revisions. Production activation
        of F2 epoch migration 005 remains a separate owner-run operation. Track completion
        and Core Editor Stability acceptance are separate owner events.
```
