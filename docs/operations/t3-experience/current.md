# T3 — Experience: current baton

Track-scoped handoff. **Replace only this file for T3 work.**

```text
PHASE: T3.P03 Shared acceptance, isolation and measurement →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       T3.P02 First Capture and Cut Preview →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
ACTIVE: No implementation slice is active. T3.P03.S01 and S02 are shipped; S02 was accepted as
        `owner-override`, making P03 closable while the phase remains open pending an explicit
        owner phase-close decision. T3.P02.S01 is accepted and shipped as `owner-override` at the
        integrated revision recorded in its acceptance record. Unrun F10/API rows remain unclaimed.
NEXT:   Owner decision whether to close T3.P03. No additional T3 implementation scope is released;
        any next slice requires its own owner authorization through its phase register.
ROUTE:  T3.P03 phase README → FINAL PHASE GATE / PHASE CLOSE; P03.S02 acceptance record retains
        trace-method and reference-row dispositions. T3.P02 phase README → slice register and S02
        final-gate route. P02.S01 acceptance record → integrated owner ruling and recovery anchor.
BLOCKER: Parent-owned complete PR178 merge gate and merge; explicit owner phase-close decision for
         T3.P03. No phase closure or new S02 authorization is recorded here.
CARRY:  Production activation of F2 epoch migration 005 remains a separate owner-run operation.
        T3 track completion remains a separate owner event.
```
