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
NEXT: S07's host wiring, adapter re-binding, contribution points and focused tests are written; no
      typecheck, test lane or browser evidence has been run. Run the editor check, the focused
      authoring/Stage tests, the AM-5 probe table on the merged tree, then the complete merge gate and
      the browser edit→Undo/Redo→replacement evidence before review. Batch A: it runs beside
      T3.P01.S03 under the authorized-batch shared-file protocol.
ROUTE: ./README.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-2026-10-17 →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md
BLOCKER: none for S07 once the authorizing PR merges. S04–S06 wait for S07's closeout.
```
