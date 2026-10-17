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
SLICES: S01 and S02 shipped 2026-10-16. S05 (unit acceptance + unit Save, PR #140) and S06
        (Experience runtime + Camera handoff, PR #141) shipped 2026-10-17; S03 shipped the same day
        with every original obligation reconciled to their accepted evidence. Accepted:
        `F4.intent-acceptance@1:unit-acceptance-v1`, `conditional-save-units-v1` and
        `F3.channels@1:camera-handoff-v1`. S04 proposed and unauthorized.
BATON: S03 closed on `main` — plan stub, umbrella acceptance and criterion reconciliation; the
       F3/F4 gate rows name all three capabilities active. T3.P01's only open child is S04, which is
       still unauthorized.
NEXT: (1) do not authorize S04 — before it can start it needs the AM-7 remote/local inventory and
      retained-bytes census, a drafted and owner-ratified `T3.camera-experience-cutover@1` at
      version 1, and its own authorization; (2) when authorized, S04 consumes the three accepted
      inactive capabilities at its trusted base and owns activation, caller migration and the live
      writer switch. All three remain inactive until then.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md
BLOCKER: none for the shipped slices. S04 remains unauthorized and its gate is undrafted. Disclosed
         residuals owned by S04/T4: no authored Cut/Travel invocation selector in Experience@1
         (lowering takes closed bindings and a preparation-only transition table); presentation
         text, state, lifecycle and channel policy have no authored F2 home; holds/Gates start at
         editorial arrival, not Camera-confirmed arrival; uploaded resource bytes are host-asserted
         until storage verifies them; the envelope's embedded acceptedRevision is baseline
         provenance, not revision authority.
```
