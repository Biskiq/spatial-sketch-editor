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
PHASE: T3.P03 Shared acceptance, isolation and measurement (H0; registered 2026-10-22, batch E) →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md
       T3.P02 First Capture and Cut Preview (registered 2026-10-20; S01 released, gated on H0) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       T3.P01 is CLOSED 2026-10-20 (final gate `06a8aac8`, merged `9a457f6b`, PR #158).
ACTIVE: T3.P03.S01 `in-progress` on `t3/p03-s01-planner-scope-build-isolation`: per-planner write
        sets enforced in the F4 unit adapter, the public/Preview predicate retargeted to the live
        authoring tree, and the Preview closure proof added — awaiting review and acceptance at the
        declared `architecture-integration` tier. T3.P03.S02 stays `approved` and released (E2);
        T3.P02.S01 is `approved` with its finalized scope owner-accepted (E5) and released (E7),
        starting only after T3.P03.S01 is merged on `main`. T3.P02.S02 stays `proposed` and held.
BATON: Review and accept T3.P03.S01 against its three acceptance rows — T1 (Stage/Layout) and T2
       (Scene) confirm their single-domain planners still admit — then close it out and merge: its
       merge is the start gate for T1.P02.S01, T2.P02.S01 and T3.P02.S01. T3.P03.S02       (measurement workflow, final gate) starts after it; the default-timeout `npm test` merge
       gate is still owed on an unloaded host (the complete suite passed with timeout headroom
       while unrelated applications held the machine at load average 47).
NEXT:  T3.P03.S01 → merge → T3.P02.S01 and T3.P03.S02 in parallel. T3.P02.S01 settles its format
       draft's two open points (text bound, entryViewId) at implementation review.
ROUTE: ./README.md → ../../roadmap/t3-experience/README.md (phase register) →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md
       → ../../roadmap/cross-track-execution.md#authorized-batch-e-2026-10-22 (protocol)
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)
BLOCKER: none for T3.P03.S01. Hard performance rows (S01's F10, S02's baseline and calibration)
         run on the owner's MacBook Air M2, 16 GB, operated by the owner (E6 amendment).
CARRY:  SEPARATE AND STILL OWED: the owner-run production activation of the F2 epoch (migration 005,
        API and editor deploys, namespace-scoped R2 purge, smoke checks). The S04 merge executed no
        migration against a deployed database. Residuals that move into this phase or beyond: the
        authored Cut/Travel selector and presentation text homes (now T3.P02.S01's Experience
        format draft; state/lifecycle homes stay later), model resource bytes (T2.P02.S01 verifies them)
        and other resource bytes host-asserted until storage verifies them, the envelope's
        acceptedRevision as baseline provenance only, and T4's prepared public reader under the
        approved empty publication gap. T3 track completion remains a separate owner event.
```
