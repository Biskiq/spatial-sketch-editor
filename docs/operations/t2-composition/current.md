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
PHASE: T2.P01 Supported object composition — CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: none open. S01, S02, S03 and the final gate S04 are shipped; the phase README's slice
        register is authoritative.
BATON: No active T2 work and no authorized T2 slice. The phase closed 2026-10-20 by
       `phase-closeout` under explicit owner authorization; its PHASE CLOSE block records the gate
       (`S04`, accepted 2026-10-19, merged in PR #157 as `99c38033`) and the integration it rests on.
       The declared gate artifact is now a closed-work stub at its own path; the accepted evidence,
       review history and residuals are recoverable at `5d1a7573`.
NEXT:  Owner decisions on proposed batch E (../../roadmap/next-batch-2026-10-22.md): register the
       T2.P02 own-model import draft (K1 bounded editor-side GLB import, no T4), accept its upload
       bounds, then authorize T2.P02.S01 to start after T3.P03.S01 merges. Nothing is authorized by
       this baton.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/README.md (phase register) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md (draft) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md (PHASE CLOSE and
       deferred table) → ../../roadmap/core-editor-stability.md (K1)
BLOCKER: the owner hold; T2 has no registered phase until the owner registers T2.P02.
CARRY: The owner may push the local `closed/T2.P01.S03`, `closed/T2.P01.S04` and the new
        `closed/T2.P01` tags. Cloud Save in a real browser session and a model-contact capability
        stay with the host evidence and a future T2 phase, not with the closed gate. T2 track
        completion remains a separate owner event.
```
