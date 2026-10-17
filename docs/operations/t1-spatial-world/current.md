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
ACTIVE: no authorized T1 slice; S04–S07 are proposed in the phase register.
BATON: S02 was accepted under owner-override on 2026-10-17. Its
       `T1.viewport-projection@1` capability remains ratified. As written, its readiness route is a
       cycle (S06 needs S04/S05, and those need the capability), so no S04–S06 start is possible.
NEXT: Owner decision on D1–D4 of the 2026-10-17 next-batch proposal: the S07 Stage↔F4 bridge as the
      viewport readiness route, and its authorization. If granted, start S07 through this runbook's
      eligibility, trusted-base and one-line cycle check (S07 is not an exposure and opens nothing).
ROUTE: ./README.md →
       ../../roadmap/next-batch-2026-10-17.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md
BLOCKER: owner decision D1–D4 (the readiness-route change and S07's authorization).
```
