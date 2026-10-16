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
BATON: No T4 work is authorized. The next step is an owner decision to register a T4 phase (its
       docs-only drafting slice is the candidate opener), which then authorizes its own first slice.
NEXT: Read the track README's objectives and the gate register, then wait for the owner's
      registration decision; do not start implementation from this baton.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t4-release/README.md
BLOCKER: no T4 phase is registered or authorized.
```
