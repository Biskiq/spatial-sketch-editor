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
SLICES: T2.P01's slice register is authoritative — S01/S02 shipped; S03 authorized (batch B,
        2026-10-17) and not started; S04 proposed and unauthorized.
BATON: No T2 slice is in progress. The owner authorized S03 as batch B with `T1.P01.S04` on
       2026-10-17 ([record](../../reference/decisions/batch-b-authorization-2026-10-17.md)). Its launch
       conditions 1–4 were verified against `main` `a8e4d45e`: S07 shipped in PR #137, and
       `viewport-projection-v1` was accepted at `ab8504aa`.
NEXT: After the authorizing PR merges, start S03 through the runbook start step (eligibility at its
      own trusted base). It runs under the batch B protocol: it is the sole writer of its Scene
      adapters, it registers only through S07's contribution points, and it makes no host core,
      route or shell edits. S04 additionally waits for T1.P01.S04's accepted Head Save integration.
      Phase/track closure is not available: S04, the declared final gate, is neither accepted nor
      shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-b-2026-10-17
BLOCKER: none, once the authorizing PR merges.
```
