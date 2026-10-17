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
BATON: No T4 work is authorized. The owner approved T4.P01 registration (D6) and the docs-only S01
       (D7) on 2026-10-17, but both are held: S03–S05 consume gate versions that do not exist yet
       (F5@1 and the T3 cutover), so no honest registered row can be written.
NEXT: Wait for the owner's choice of hold resolution (R1–R3 in the next-batch proposal). Do not start
      implementation from this baton.
ROUTE: ./README.md →
       ../../roadmap/next-batch-2026-10-17.md →
       ../../roadmap/t4-release/t4.p01-prepared-release-foundation/README.md
BLOCKER: the D6/D7 hold, an owner choice among R1–R3.
```
