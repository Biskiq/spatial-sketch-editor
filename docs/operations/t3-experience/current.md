# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.** It carries T3's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T3's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T3.P01 Camera-experience foundation (in-progress) →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
SLICES: T3.P01's slice register is authoritative — S01 shipped 2026-10-16 (`F2.unit-envelope@1` and
        additive `F1.reference@1:unit-resolution-v1`); S02–S04 proposed and unauthorized; T3.P02 is
        an unregistered candidate phase.
BATON: No T3 slice is authorized. T3.P01.S02 (conditional Save) is next in sequence and waits on an
       owner authorization; runtime activation, source cutover, migration inventory and recovery
       remain T3.P01.S04's.
NEXT: On an owner authorization, start T3.P01.S02 through this track's runbook start step:
      eligibility at the trusted base, the one-line cycle check, then the plan's declared
      verification tier and integration route.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/implementation-plan.md
BLOCKER: none recorded; no T3 slice is authorized.
```
