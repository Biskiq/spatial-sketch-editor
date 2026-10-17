# T4 — Release and delivery: current baton

Track-scoped handoff. **Replace only this file for T4 work.** It carries T4's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T4's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: the track README owns T4's bounded objectives and phase
register, and the [gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never
synchronize another track's baton, and never treat stale baton text as a blocker — verify Git state
and the registered prerequisites instead.

```text
TRACK: T4 Release and delivery (planning — no implementation authorized) →
       ../../roadmap/t4-release/README.md
PHASES: no capability phase is registered; `T4.prepared-reader` is an undrafted gate. Registration
        and authorization are owner decisions.
BATON: No T4 work is authorized. A registration-ready T4.P01 draft and its docs-only S01 plan exist.
       Registration (D6) and S01 authorization (D7) are separate owner decisions in the 2026-10-17
       next-batch proposal, and registration alone authorizes nothing.
NEXT: Wait for the owner's D6/D7 rulings. If both are granted, start S01 (documents only) through this
      runbook's start step. Do not start implementation from this baton.
ROUTE: ./README.md →
       ../../roadmap/next-batch-2026-10-17.md →
       ../../roadmap/t4-release/t4.p01-prepared-release-foundation/README.md
BLOCKER: no T4 phase is registered or authorized.
```
