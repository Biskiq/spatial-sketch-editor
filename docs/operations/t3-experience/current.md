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
PHASE: T3.P01 Camera-experience foundation — CLOSED 2026-10-20, all six children shipped →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
SLICES: none open. S01, S02, S03 (through S05/S06) and the final gate S04 are shipped. The phase
        README's slice register is authoritative.
BATON: The phase closed 2026-10-20 by `phase-closeout` under explicit owner authorization. The final
       gate `T3.P01.S04` was accepted at `06a8aac8` and merged as the P1 merge commit `9a457f6b`
       (PR #158); the plan anchor `f5147aca` was verified reachable after the merge, and
       `T3.camera-experience-cutover@1` is `accepted` in the gate register. The S04 gate artifact and
       plan are now closed-work stubs; accepted evidence and the runbook are recoverable at
       `fd619ef1` and `f5147aca`.
       SEPARATE AND STILL OWED: the owner-run production activation (migration 005, API and editor
       deploys, namespace-scoped R2 purge, smoke checks). The merge executed no migration against any
       deployed database, and no shared data, bucket or deployment was touched.
NEXT:  Owner decision only: register T3.P02 (first capture and Cut Preview) and authorize its S01, or
       leave T3 without a registered phase. The repository holds an unregistered proposal at
       ../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/README.md; nothing is authorized by
       this baton.
ROUTE: ./README.md →
       ../../roadmap/t3-experience/README.md (phase register) →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md (PHASE CLOSE and
       cutover mechanics) →
       ../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover
BLOCKER: none for planning. T3.P02 authorization is the owner's start gate; production activation
         is the owner's operational step and blocks no repository work.
CARRY:  The owner may push the new `closed/T3.P01` tag. Residuals that move forward: the authored
        Cut/Travel selector, presentation text, state and lifecycle homes (T3.P02 F2 amendments);
        resource bytes host-asserted until storage verifies them; the envelope's acceptedRevision is
        baseline provenance, not revision authority; T4 owns the prepared public reader under the
        approved empty publication gap. T3 track completion remains a separate owner event.
```
