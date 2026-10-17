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
SLICES: T3.P01's slice register is authoritative — S01 shipped 2026-10-16 (`F2.unit-envelope@1` and
        additive `F1.reference@1:unit-resolution-v1`); S02 shipped 2026-10-16 (PR #133) with accepted
        `F4.intent-acceptance@1:conditional-save-current-v1`; S03 owner-authorized 2026-10-17 and in
        progress with an approved split direction (S03a/S03b not yet registered or authorized);
        S04 proposed and unauthorized;
        T3.P02 is an unregistered candidate phase.
BATON: T3.P01.S02 (early conditional Save) is accepted and shipped on PR #133 from post-PR #132
       `main`. T3 owns the protocol, server path, client and framework-free client Save state; T1
       owns the Head integration (`T1.P01.S04` by default), which is not part of this slice. Runtime
       activation, source cutover, migration inventory and recovery remain T3.P01.S04's. S03 is in progress; its preparatory increment is not a completed slice.
NEXT: S03 (compound and runtime preparation) is in progress. Its first increment implements the F4
      unit-admission seam (`f4/unit-acceptance.ts`) and the F3 `camera-handoff-v1` protocol
      (`channels/handoff.ts`) with conformance suites; the F2 candidates, unit Save with real-DB
      evidence and the Experience runtime preparation are not implemented. The
      [split proposal](../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/split-proposal.md)
      has delegated owner approval, but both follow-up slices require separate registration and
      authorization before work; then run the full verification
      tier (lane, `check`, arch, zero-skip DB suite for the Save half). Phase/track closure is not
      available: S04, the declared final gate, is neither accepted nor shipped.
ROUTE: ./README.md →
       ../../roadmap/README.md#gate-register →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md
BLOCKER: none for the reviewed preparatory increment. The S03a/S03b follow-ups remain
         unregistered and unauthorized; no capability is accepted without their full evidence.
```
