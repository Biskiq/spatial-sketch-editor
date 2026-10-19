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
        follow-up is not a slice and does not reopen S05.
BATON: The refused-Open host follow-up shipped as **PR #159**, merged as `8011a0aa` on 2026-10-19
       (implementation `1953f275`, accepted at `f02353dd`; merge tree identical to reviewed
       `dd89d51e`). A refused Source JSON Open or failed conflict Reload remote reports a typed
       notice and keeps the mounted source, selection, history and saved-base metadata; a cancelled
       dialog is a no-op; an admitted Open still replaces the project with a locally minted
       baseline. Post-merge gate at `8011a0aa`: `check` 0/0, `npm test` 2,248/2,248. T2.P01.S04's
       final gate is unblocked. The disclosed late-successful-Open epoch race is a separate
       pre-existing host defect, recorded as **TD-10** (it does not change the refused-Open
       contract). TD-9 stays owned by the Head integration and is verified at S06.
NEXT: T2.P01.S04 rebases onto `main` for its refused-Open preservation proof and bounded
      browser/reduced-motion journey, then its final gate; T3.P01.S04 phase B follows the T1/T2
      freeze. T1 implementation resumes at S06 only after T3.P01.S04 is accepted and S06 is
      authorized (ruling C3); TD-10 is closed before or with S06.
      Owner follow-ups: push the local `closed/T1.P01.S04` and `closed/T1.P01.S05` tags (neither is
      pushed).
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/acceptance.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: S06 waits for T3.P01.S04's acceptance and its own authorization; no T1 work is blocked
         otherwise.
```
