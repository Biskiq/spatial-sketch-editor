# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.** It carries T2's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T2's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T2.P01 Supported object composition (in-progress) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P01's slice register is authoritative — S01 shipped 2026-10-16; S02–S04 proposed and
        unauthorized.
BATON: No T2 slice is authorized. T2.P01.S02 (Scene operations and shared history) is next in
       sequence; its F4 `local-single-domain-v1` prerequisite is accepted, and it waits on an owner
       authorization (a baton never grants one).
NEXT: On an owner authorization, start T2.P01.S02 through this track's runbook start step:
      eligibility at the trusted base, the one-line cycle check, then the plan's declared
      verification tier and integration route.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s02-scene-operations-and-history/implementation-plan.md
BLOCKER: no live T2 blocker; S02 is unauthorized.
```
