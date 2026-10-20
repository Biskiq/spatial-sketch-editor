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
PHASE: T3.P02 First Capture and Cut Preview (registered 2026-10-20; S01 authorized) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md
       T3.P01 is CLOSED 2026-10-20 — all six children shipped, final gate accepted at `06a8aac8`,
       merged as `9a457f6b` (PR #158). →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
ACTIVE: T3.P02.S01 — First capture and Cut Preview, owner-authorized 2026-10-20 as batch D (D3,
        [record](../../reference/decisions/batch-d-authorization-2026-10-20.md)). It declares
        architecture-integration verification with its integration route at `T3.P02.S02`. S02 is
        registered `proposed` and is NOT authorized.
BATON: Build the first authoring surface on the accepted F2 cutover: Experience create/select, View
       capture from the shared Stage, one-operation Presentation/Stop binding, Presentation reuse
       across distinct Stops, reorder by stable identity, bounded labels/text/holds/continuation, a
       first Cut Guide, isolated Preview with Camera return, and Undo/Redo/Save/reload through F2/F4.
       One Camera authority, Experience-owned order, Camera-owned View identity, shared output/return
       tickets, visitor isolation and room-local frame semantics all bind it. It contributes through
       AM-5's task/Find/instrument points and the accepted viewport facade; a new host seam is a
       stop-and-report to T1. Rich interaction grammar belongs to the PR #154 prototype and is not
       imported here.
NEXT:  Start S01 through the runbook start step at its own trusted base, implement, then independent
       review, `slice-closeout` and a P1 merge commit. Its acceptance is not the phase gate:
       `T3.P02.S02` needs its own authorization after S01 lands.
ROUTE: ./README.md → ../../roadmap/t3-experience/README.md (phase register) →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md →
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-d-2026-10-20
BLOCKER: none. S01 consumes only accepted gates; it does not wait for `T1.P01.S06`, and no
         architecture-cycle window applies to T3.
CARRY:  SEPARATE AND STILL OWED: the owner-run production activation of the F2 epoch (migration 005,
        API and editor deploys, namespace-scoped R2 purge, smoke checks). The S04 merge executed no
        migration against a deployed database. Residuals that move into this phase or beyond: the
        authored Cut/Travel selector and presentation text/state/lifecycle homes (AM-9 amendment
        drafts, S01), resource bytes host-asserted until storage verifies them, the envelope's
        acceptedRevision as baseline provenance only, and T4's prepared public reader under the
        approved empty publication gap. T3 track completion remains a separate owner event.
```
