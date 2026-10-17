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
SLICES: T2.P01's slice register is authoritative — S01 shipped 2026-10-16; S02 shipped 2026-10-17
        under an owner override of the pending re-review of `62d4d5b0`; S03–S04 proposed and
        unauthorized.
BATON: T2.P01.S02 (Scene operations and shared history) is accepted and shipped on PR #134 from
       post-PR #132 `main`, in parallel with `T3.P01.S02` under the pair protocol. It supplies the
       Scene planner set and its conformance against the landed F.4 coordinator, owns no history and
       registered no live host (host↔F4 wiring and S03 own that). No T2 slice is in progress.
NEXT: The next T2 authorization is S03 (first coherent editing surface). Its prerequisites — T1's
      `viewport-projection-v1` and the host↔F4 wiring (`T1.P01.S04` by default) — are not complete,
      so S03 stays proposed until the owner authorizes it. Phase/track closure is not available: S04,
      the declared final gate, is neither accepted nor shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s03-first-editing-surface/implementation-plan.md
BLOCKER: none (S03 authorization is an owner decision; its prerequisites are tracked in the phase's
         minimum-dependencies table).
```
