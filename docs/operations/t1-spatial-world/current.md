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
        closed by `slice-closeout` on 2026-10-19 (PR #156, merged at `06a27854`); its plan is a
        closed stub and TD-8 is fixed. S06 is proposed and routed after T3.P01.S04 (ruling C3).
        The T1.P01 architecture-cycle window is CLOSED: S02/S04/S05 exposure rows are recorded,
        `Closed by` is S05, and the cycle is `PHASE_3_EVALUATE` with readiness
        `owner-verdict-owed`. The per-mechanism verdicts are the owner's event. The separate host
        follow-up below is not a slice and does not reopen S05.
BATON: **PR #159** (`T1-host-refused-open`, head `1953f275`, base `06a27854`) implements the owed
       refused-Open follow-up and awaits independent review. A refused Source JSON Open or failed
       conflict Reload remote now reports a typed notice and keeps the mounted source, selection,
       history and saved-base metadata; a cancelled dialog is a no-op; an admitted Open still
       replaces the project with a locally minted baseline. Route-level evidence mounts the real
       spatial page. T2.P01.S04's final gate remains blocked until #159 is accepted and merged.
       TD-9 stays owned by the Head integration and is verified at S06.
NEXT: Independent implementation acceptance for #159 → owner hygiene/merge review → merge #159 →
      rebase #157 onto updated `main` for its refused-Open preservation proof and bounded browser/
      reduced-motion journey, then its final gate. #158 waits for T1/T2 to freeze before Phase B.
      Owner follow-ups: push the local `closed/T1.P01.S04` and `closed/T1.P01.S05` tags (neither is
      pushed).
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/acceptance.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: #159's review and merge block T2.P01.S04's final gate; S06 waits for T3.P01.S04's
         acceptance and its own authorization.
```
