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
SLICES: T2.P01's slice register is authoritative — S01, S02 and S03 shipped; S04 proposed and
        unauthorized.
BATON: S03 (first coherent editing surface) was accepted 2026-10-18 from the owner's deliberate
       closeout invocation; its record is
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md.
       The implementation is on branch `T2-P01-S03` (PR #147); merging it is the owner's decision,
       and closeout preservation (compaction, historical anchor, preservation report, link sweep)
       runs after that merge commit. No T2 slice is in implementation.
NEXT: Owner merge decision on PR #147 → post-merge preservation step. S04, the declared final phase
      gate, stays unauthorized; it waits on `T3.P01.S02`'s `conditional-save-current-v1` and on
      T1.P01.S04's accepted Head Save integration (ruling D3). Phase/track closure is not available
      until S04 is accepted and shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/acceptance.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md
BLOCKER: none for S03. S04 waits on its prerequisites and its own authorization.
```
