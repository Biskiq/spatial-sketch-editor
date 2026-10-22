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
PHASE: T3.P02 First Capture and Cut Preview (registered 2026-10-20; S01 authorized, held) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       T3.P01 is CLOSED 2026-10-20 — all six children shipped, final gate accepted at `06a8aac8`,
       merged as `9a457f6b` (PR #158). →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
ACTIVE: none. T3.P02.S01 is registered `approved` (batch D, D3) but HELD by the owner's 2026-10-22
        production hold and unimplemented; S02 is `proposed` and not authorized.
BATON: Planning only. Proposed batch E presents the H0 draft (T3.P03: planner scope, build
       isolation, measurement) and S01's finalized scope: the Experience format draft (format 2,
       Guide-free Presentation entry) and a shell draft. Nothing is registered, authorized or
       released until the owner acts on E1-E7.
NEXT:  Owner decisions in ../../roadmap/next-batch-2026-10-22.md. Only after explicit release:
       T3.P03.S01 first; S01 then resumes through the runbook start step on a base containing it.
ROUTE: ./README.md → ../../roadmap/t3-experience/README.md (phase register) →
       ../../roadmap/next-batch-2026-10-22.md →
       ../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/README.md (draft) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md
BLOCKER: the owner hold. S01 consumes only accepted gates and no architecture-cycle window applies
         to T3; its start also waits for T3.P03.S01 to merge.
CARRY:  SEPARATE AND STILL OWED: the owner-run production activation of the F2 epoch (migration 005,
        API and editor deploys, namespace-scoped R2 purge, smoke checks). The S04 merge executed no
        migration against a deployed database. Residuals that move into this phase or beyond: the
        authored Cut/Travel selector and presentation text homes (now S01's Experience format
        draft; state/lifecycle homes stay later), model resource bytes (T2.P02.S01 verifies them)
        and other resource bytes host-asserted until storage verifies them, the envelope's
        acceptedRevision as baseline provenance only, and T4's prepared public reader under the
        approved empty publication gap. T3 track completion remains a separate owner event.
```
