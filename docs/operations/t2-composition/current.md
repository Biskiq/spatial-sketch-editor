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
SLICES: the phase README's slice register is authoritative. S01, S02 and S03 are shipped. S04, the
        phase's declared FINAL PHASE GATE, is authorized as batch C (2026-10-19), effective when
        PR #155 merges.
BATON: S04 is implemented on branch `T2-P01-S04` (base `919c2904`, batch C) and awaits the
       coordinator's full gate and independent review. It adds the `scene-compose` task (uniform
       Resize, duplicate, delete) through AM-5 only, reusing T1's shipped source-JSON/Reload paths
       and extending no host seam. Numeric Resize is the guaranteed route; no direct handle was
       added. The acceptance record lists each phase-matrix row as Written/Partial/Not run; nothing
       is accepted, no gate state is written, and TD-8 is absent from this base.
NEXT:   Coordinator runs `check`, `test:fast`, `test:arch`, `test:heavy` and the focused Scene/Save
        files; independent review; then the batch C merge protocol. A browser creator journey and
        reduced-motion evidence remain unproduced.
       Owner follow-up: push the local `closed/T2.P01.S03` tag.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: none once PR #155 merges.
```
