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
BATON: S04 is implemented on branch `T2-P01-S04` (base `919c2904`, batch C) and has passed the
       slice lanes and two independent review rounds (the second accepted with no blocking
       findings). It adds the `scene-compose` task (uniform
       Resize, duplicate, delete) through AM-5 only, reusing T1's shipped source-JSON/Reload paths
       and extending no host seam. Resize and Duplicate are **primitive-only**: the panel disables
       them (with the reason) and the session refuses before taking a lease for a light or model;
       no Scale fact is advertised for a subject that cannot be written. An open Resize is
       cancelled when the canonical selection moves. Numeric Resize is the guaranteed route; no
       direct handle was added.
       **The phase final gate is not passed:** the persistence row still lacks active-preview
       cancellation on replace, previous-source preservation after a refused open, and the Save
       creator journey through the mounted Head. Nothing is accepted and no gate state is written.
       TD-8 is absent from this base; the Compose journeys reopen the task after each install and
       do not rely on a reused task panel.
NEXT:   Batch C merge protocol for the two slice PRs; then the remaining gate proofs (or an owner
        amendment) and a browser creator journey with reduced-motion evidence.
       Owner follow-up: push the local `closed/T2.P01.S03` tag.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: none once PR #155 merges.
```
