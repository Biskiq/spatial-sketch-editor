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
BATON: No T4 work is authorized. Owner ruling R1-D (2026-10-17) defers all T4 planning and
       implementation until Core Editor Stability is accepted. It supersedes the D6/D7
       approved-but-held disposition. The T4.P01 draft is frozen evidence.
NEXT: None. Resumption is two owner acts after Core Editor Stability's recorded acceptance: renewed
      planning authorization, then separately registration/implementation. Do not start any T4 work
      from this baton.
ROUTE: ./README.md →
       ../../reference/decisions/next-batch-authorization-2026-10-17.md →
       ../../roadmap/core-editor-stability.md
BLOCKER: Core Editor Stability is not accepted (product-priority deferral R1-D).
```
