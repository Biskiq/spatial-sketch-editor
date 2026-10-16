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
SLICES: T1.P01's slice register is authoritative — S01 (2026-10-15) and S03 (2026-10-16) shipped;
        S02 approved and not started; S04–S06 proposed.
BATON: The next authorized T1 work is T1.P01.S02 (Shell, Stage and viewport provider) — the
       configured architecture-cycle opener and the `T1.viewport-projection@1` provider.
NEXT: Start T1.P01.S02 through this track's runbook start step: eligibility at the trusted base,
      the one-line cycle check (`open-window` before capability work for a listed exposure), then
      the plan's declared verification tier and integration route.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md
BLOCKER: none.
```
