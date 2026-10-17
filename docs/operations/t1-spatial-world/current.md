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
ACTIVE: none in progress. T1.P01.S04 is authorized (batch B, 2026-10-17) and not started; S05–S06
        remain proposed and unauthorized.
BATON: S07 shipped in PR #137 (merge `a0026cf4`, a merge commit as P1 required). Its recorded anchors,
       including `ab8504aa` (`viewport-projection-v1` accepted) and the closeout anchor `d1c93d47`, are
       ancestors of `main`. The owner authorized batch B (`T1.P01.S04` ∥ `T2.P01.S03`) on 2026-10-17
       ([record](../../reference/decisions/batch-b-authorization-2026-10-17.md)). S04's scope includes
       the Head Save integration, so `conditional-save-current-v1` joined its `Requires` (ruling D3).
       Housekeeping: the `closed/T1.P01.S07` tag points at `d1c93d47` locally and is not yet on the
       remote; the owner pushes it.
NEXT: After the authorizing PR merges, start S04 through the runbook start step: eligibility at its
      trusted base (which must contain PR #137's merge), then the cycle check. The window has been
      open since S02, so no new opening is recorded. S04 runs alongside T2.P01.S03 under the
      batch B protocol (sole writer of the Head and the Layout adapters; registers through S07's
      contribution points; no host core, route or shell edits). It must be accepted before
      T2.P01.S04 starts.
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-b-2026-10-17
BLOCKER: none, once the authorizing PR merges. S05–S06 stay unauthorized.
```
