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
        `F4.intent-acceptance@1:conditional-save-current-v1`; S03 is the in-progress umbrella;
        S05 (unit acceptance + unit Save) and S06 (Experience runtime + Camera handoff) are
        owner-authorized 2026-10-17 and in progress in parallel; S04 proposed and unauthorized;
        T3.P02 is an unregistered candidate phase.
BATON: S03's approved split is registered and authorized as S05 and S06. Both branches carry one
       coordinated registration commit, run in parallel from post-PR #139 `main` (`d2607caf`), and
       touch disjoint surfaces: S05 owns F4/F2/unit/Save, S06 owns F3 channels and new camera-core
       runtime modules. Neither consumes the other's unaccepted output.
NEXT: Implement S05 (real F2 candidates, one-envelope validation, resource staging/rollback,
      unit/compound install and whole-operation history, `conditional-save-units-v1` with real
      Postgres at zero skips) and S06 (complete `camera-handoff-v1`, lowering/interpreter,
      reducer/clock, holds/continuation, guard/Continue/detour, DOM companion, three controllers,
      AM-6 traces), then coordinator review and independent review. No source/runtime activation and
      no live unit writer in either slice.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/implementation-plan.md
       (S06: ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md)
BLOCKER: none for implementation. Acceptance of either half requires its full evidence and
         independent review; S04 stays unauthorized until both halves' outputs are accepted at its
         trusted base and its own AM-7 inventory/cutover prerequisites are met. The missing authored
         Cut/Travel invocation selector in Experience@1 is a disclosed S06 residual for S04/T3.P02.
```
