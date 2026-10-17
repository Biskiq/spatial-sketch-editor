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
SLICES: T2.P01's slice register is authoritative — S01/S02 shipped; S03–S04 proposed and unauthorized.
BATON: No T2 slice is in progress. The phase README and closed slice records own shipped status and
       completed evidence.
NEXT: The next T2 authorization is S03 (first coherent editing surface), in batch B (not authorized),
      after T1's authorized S07 bridge ships and `viewport-projection-v1` is accepted at S03's trusted
      base. Its exact launch conditions are in its plan and the 2026-10-17 next-batch proposal. S03
      stays proposed until the owner authorizes it, and nothing authorizes it now. Phase/track closure is not available: S04,
      the declared final gate, is neither accepted nor shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/implementation-plan.md
BLOCKER: `T1.viewport-projection@1` is not accepted; under owner ruling D1 it is accepted at T1.P01.S07's
         closeout (T1-owned). S03 authorization is a later owner decision.
```
