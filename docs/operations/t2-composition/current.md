# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.** It carries T2's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T2's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T2.P01 Supported object composition (in-progress) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P01's slice register is authoritative — S01 shipped 2026-10-16; S02 owner-authorized
        2026-10-16, approved and not started; S03–S04 proposed and unauthorized.
BATON: The next authorized T2 work is T2.P01.S02 (Scene operations and shared history), running in
       parallel with T3.P01.S02 under the pair protocol. It consumes the accepted
       `local-single-domain-v1`, not T1.P01.S02 (PR #128) or any host.
NEXT: Start T2.P01.S02 through this track's runbook start step: eligibility at the trusted base
      (post-PR #129 `main` or later), the one-line cycle check (not an exposure), then the plan's
      declared verification tier and integration route.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s02-scene-operations-and-history/implementation-plan.md
       (pair protocol: ../../roadmap/cross-track-execution.md#parallel-pair-2026-10-16)
BLOCKER: none.
```
