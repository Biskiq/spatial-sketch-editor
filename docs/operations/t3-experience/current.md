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
PHASE: T3.P01 Camera-experience foundation (in-progress) →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md
SLICES: S01, S02, S05 and S06 are shipped, and S03 is shipped by reconciliation. Accepted:
        `F4.intent-acceptance@1:unit-acceptance-v1`, `conditional-save-units-v1` and
        `F3.channels@1:camera-handoff-v1`. S04 is proposed and unauthorized.
BATON: Batch C reconciled S04's authorization path, pending owner ratification. The owner ruled
       saved data disposable, so the AM-7 inventory, migration and quiescence ceremony is
       withdrawn (four preflight drafts removed; recoverable at `5fee2a2d`). AM-9 (clean source
       epoch: transactional reset, structural F2-only fence, typed refusals, atomic retirement) and
       `T3.camera-experience-cutover@1` are drafted for ratification. S04 would run in two phases:
       A on T3-owned files, in parallel with batch C; B as the caller migration after the
       current-source freeze. S04 is proposed to own TD-6, TD-7, TD-9's draft rewire or removal,
       and the Guide-free Presentation lowering fix.
NEXT: The owner signs R1–R5 of the T3 cutover record and its approval patch is applied (AM-9
      appended, gate row ratified, S04 row approved). Then S04 phase A starts through the runbook
      start step. No data is reset before S04 merges and the owner runs activation.
ROUTE: ./README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md →
       ../../reference/decisions/t3-cutover-ratification-2026-10-19.md
BLOCKER: owner ratification (R1–R4) and authorization (R5). Disclosed residuals that move to
         T3.P02/T4: the authored Cut/Travel selector, presentation text, state and lifecycle homes
         (T3.P02 F2 amendments; @1 defaults are fixed in AM-9); resource bytes host-asserted until
         storage verifies them; the envelope's acceptedRevision is baseline provenance, not
         revision authority.
```
