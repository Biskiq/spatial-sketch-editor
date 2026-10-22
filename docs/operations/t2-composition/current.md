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
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 `approved` and released from the hold (batch E, E7), starting only after
        T3.P03.S01 is merged on `main`; S02 and S03 `proposed`, not authorized. The phase README's
        slice register is authoritative.
BATON: No active T2 work yet. The upload, retention and derivative bounds are owner-accepted (E4):
       50 MiB source set, 25 MiB derivative, 24 h staging, revisions kept while referenced, the
       derivative made in the creator's browser worker with server-side structure checks.
NEXT:  When T3.P03.S01 reads `shipped` in the T3.P03 slice register on `main`, start T2.P02.S01
       through the T2 runbook start step from that base.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/README.md (phase register) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)
BLOCKER: T3.P03.S01 not yet merged. Hard performance rows run on the owner's MacBook Air M2,
         16 GB (E6 amendment).
CARRY: The owner may push the local `closed/T2.P01.S03`, `closed/T2.P01.S04` and the new
        `closed/T2.P01` tags. Cloud Save in a real browser session stays with the host evidence; model
        contact moves to T2.P02 (its placement definition), not the closed gate. T2 track
        completion remains a separate owner event.
```
