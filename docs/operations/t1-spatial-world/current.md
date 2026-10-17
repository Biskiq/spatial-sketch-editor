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
PHASE: T1.P01 Stage and authoring foundation (in-progress) →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
ACTIVE: no authorized T1 slice; S04–S06 remain proposed in the phase register.
BATON: S02 was accepted under owner-override on 2026-10-17. Its
       `T1.viewport-projection@1` capability remains ratified; S06's integrated result is still owed,
       and no consumer readiness is claimed.
NEXT: Await owner authorization for the next T1 slice, then use this runbook's eligibility, trusted-
      base and cycle checks before starting its declared verification tier and integration route.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md
BLOCKER: no next slice is authorized; S06 integration proof remains required for viewport consumer readiness.
```
