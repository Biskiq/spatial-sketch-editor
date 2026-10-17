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
        additive `F1.reference@1:unit-resolution-v1`); S02 owner-authorized 2026-10-16, approved and
        not started; S03–S04 proposed and unauthorized; T3.P02 is an unregistered candidate phase.
BATON: The next authorized T3 work is T3.P01.S02 (early conditional Save), running in parallel with
       T2.P01.S02 under the pair protocol. T3 owns protocol, server, client and client Save state;
       T1 owns the Head integration. Runtime activation, source cutover, migration inventory and
       recovery remain T3.P01.S04's.
NEXT: Start T3.P01.S02 through this track's runbook start step: eligibility at the trusted base
      (post-PR #129 `main` or later), the one-line cycle check (not an exposure), then the plan's
      declared verification tier, including the real-Postgres API suite with zero skips.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/implementation-plan.md
       (pair protocol: ../../roadmap/cross-track-execution.md#parallel-pair-2026-10-16)
BLOCKER: none.
```
