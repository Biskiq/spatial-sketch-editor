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
PHASE: T2.P01 Supported object composition (in-progress) →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: the phase README's slice register is authoritative. S01, S02 and S03 are shipped. S04, the
        phase's declared FINAL PHASE GATE, is authorized as batch C (2026-10-19), effective when
        PR #155 merges.
BATON: S04 runs alongside T1.P01.S05 under the batch C protocol. Scope correction C4: reuse T1's
       shipped Download/Open source JSON and Reload remote, build no persistence UI, keep numeric
       Resize as the guaranteed route, and stop-and-report for any new host seam. TD-8 is T1's to
       fix; record the base the journeys ran on.
NEXT:   After PR #155 merges, start S04 through the runbook start step at its own trusted base.
        Owner follow-up: push the local `closed/T2.P01.S03` tag.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19
BLOCKER: none once PR #155 merges.
```
