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
PHASE: T2.P01 Supported object composition (in-progress, CLOSABLE) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: S01, S02, S03 and the final gate S04 are shipped. The phase README's slice register is
        authoritative.
BATON: No active T2 slice. S04 (bounded composition loop and final gate) was accepted 2026-10-19 from
       the deliberate closeout invocation; its final gate is PASSED and the phase is closable. The
       accepted capability is the `scene-compose` task (numeric uniform Resize on floor, duplicate,
       delete) through AM-5 contributions only, reusing T1's source-JSON/replacement/Reload paths and
       building no host seam, Head or Save UI. Resize and Duplicate stay primitive-only and read the
       planner's own `floorTransformSupport`. The accepted-install lifetime rule covers typed and
       pointer commits. Accepted evidence, residuals and the preserved plan stub live in the slice's
       [acceptance record](../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/acceptance.md).
NEXT:   Owner phase-close decision for T2.P01 (`phase-closeout`), or leave the phase open. Nothing
        else is queued in T2.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/acceptance.md
BLOCKER: none.
CARRY:  The owner may push the local `closed/T2.P01.S03` and `closed/T2.P01.S04` tags. Cloud Save in a
        real browser session and a model-contact capability stay with the host/S06 evidence and a
        future T2 phase, not with this gate.
```
