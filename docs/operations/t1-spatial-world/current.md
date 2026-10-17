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
ACTIVE: T1.P01.S07 (Stage↔F4 integration bridge) is authorized (2026-10-17) and in progress from
        `main` at `fcf1fbaa`; S04–S06 remain proposed.
BATON: S02 was accepted under owner-override on 2026-10-17. Its `T1.viewport-projection@1`
       capability remains ratified. By owner ruling D1 (2026-10-17), S07's acceptance, not S06's,
       is the viewport readiness route; S07 also owns the host↔F4 wiring (D2), and Head Save stays
       with S04 (D3).
NEXT: PR #137 carries the complete AM-5 increment on `T1-P01-S07`: implementation `a67793e4`, first
      review fixes `4127b63f`, and a second round of fix and record corrections. Every lane that was
      run is green on the final code tree. The next step is a fresh independent review of that code
      head, then the full gate at the actual proposed merge revision, then slice acceptance. Review
      was performed in-round; acceptance, closeout and merge have not happened.
ROUTE: ./README.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-2026-10-17 →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md
BLOCKER: The final code head has had no review *after* its fixes, and no gate has run against a
         proposed merge revision (the DB-backed API suites were not run for the increment). Actual
         merge-revision acceptance remains owed; S04–S06 wait for S07's closeout.
```
