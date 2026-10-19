# T1 — Spatial world: current baton

Track-scoped handoff. **Replace only this file for T1 work.** It carries T1's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T1's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T1.P01 Stage and authoring foundation (in-progress; S06 unaccepted) →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
ACTIVE: none in implementation. S01–S05 and S07 are shipped. S05 was accepted at `3d432836` and
        closed by `slice-closeout` on 2026-10-19 (PR #156; merge commit required); its plan is a
        closed stub and TD-8 is fixed. S06 is proposed and routed after T3.P01.S04 (ruling C3).
        The T1.P01 architecture-cycle window is CLOSED: S02/S04/S05 exposure rows are recorded,
        `Closed by` is S05, and the cycle is `PHASE_3_EVALUATE` with readiness
        `owner-verdict-owed`. The per-mechanism verdicts are the owner's event.
BATON: Merge queue starts with #156 (accepted + closeout complete; awaiting owner hygiene review
       and merge). A **separate T1 host follow-up** is owed after #156 merges: a refused Source
       JSON Open (invalid JSON, wrong format, project mismatch, compile refusal) currently replaces
       the mounted project because the spatial route applies the refused boot state. Contract:
       preserve the mounted source, selection/history and saved-base metadata, show a typed
       refusal, commit a baseline only after admission, and apply the same rule to failed Reload
       remote. It is not S05 scope and must not be folded into #156. T2.P01.S04's final gate is
       blocked on that follow-up. TD-9 stays owned by the Head integration and is verified at S06.
NEXT: Owner hygiene/merge review for #156 → merge commit → post-merge anchor check
      (`git merge-base --is-ancestor 3d432836 main`). Then branch the refused-Open follow-up from
      updated `main`, accept and merge it, and only then rebase #157 for its final-gate proof.
      Owner follow-ups: push the local `closed/T1.P01.S04` and `closed/T1.P01.S05` tags (neither is
      pushed).
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/acceptance.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: the refused-Open host follow-up blocks T2.P01.S04's final gate; S06 waits for
         T3.P01.S04's acceptance and its own authorization.
```
