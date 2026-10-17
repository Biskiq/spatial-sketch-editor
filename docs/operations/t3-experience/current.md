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
        additive `F1.reference@1:unit-resolution-v1`); S02 shipped 2026-10-16 (PR #133) with accepted
        `F4.intent-acceptance@1:conditional-save-current-v1`; S03 owner-authorized 2026-10-17 (not started);
        S04 proposed and unauthorized; T3.P02 is an unregistered candidate phase.
BATON: T3.P01.S02 (early conditional Save) is accepted and shipped on PR #133 from post-PR #132
       `main`. T3 owns the protocol, server path, client and framework-free client Save state; T1
       owns the Head integration (`T1.P01.S04` by default), which is not part of this slice. Runtime
       activation, source cutover, migration inventory and recovery remain T3.P01.S04's. No T3 slice
       is in progress.
NEXT: S03 (compound and runtime preparation) is authorized (2026-10-17, D5). Once the authorizing PR
      merges, start it through this runbook's start step: its prerequisite closure was re-verified at
      `c9aa53cf`, and it runs in batch A beside T1's S07 under the authorized-batch shared-file
      protocol. Phase/track closure is not
      available: S04, the declared final gate, is neither accepted nor shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md
BLOCKER: none for S03 once the authorizing PR merges.
```
