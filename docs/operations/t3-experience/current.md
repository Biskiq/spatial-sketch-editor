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
SLICES: S01 and S02 shipped 2026-10-16. S05 (unit acceptance + unit Save) shipped 2026-10-17
        (PR #140) with `F4.intent-acceptance@1:unit-acceptance-v1` and
        `conditional-save-units-v1` accepted. S06 (Experience runtime + Camera handoff) is
        implemented and independently accepted; its closeout and merge are next. S03 stays the
        in-progress umbrella until S05 and S06 are reconciled. S04 proposed and unauthorized.
BATON: S05 closed on its branch — plan stub, acceptance record and two capability records; F4 gate
       register updated. S06 needs its own closeout record (acceptance + `camera-handoff-v1`
       capability + F3 gate entry) on a branch rebased onto post-#140 `main`, then merge.
NEXT: (1) close and merge S06 with the docs gate, merge commit only; (2) reconcile S03: map every
      original S03 exit criterion to the accepted S05/S06 evidence, record S03's acceptance, mark it
      shipped and rewrite this baton; (3) do not authorize S04 — it still needs the AM-7 inventory,
      a drafted and owner-ratified `T3.camera-experience-cutover@1`, and its own authorization.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md
BLOCKER: none for S06 closeout or S03 reconciliation. S04 remains unauthorized and its gate is
         undrafted. Disclosed residuals owned by S04/T4: no authored Cut/Travel invocation selector
         in Experience@1 (lowering takes closed bindings and a preparation-only transition table);
         holds/Gates start at editorial arrival, not Camera-confirmed arrival; uploaded resource
         bytes are host-asserted until storage verifies them; the envelope's embedded
         acceptedRevision is baseline provenance, not revision authority.
```
