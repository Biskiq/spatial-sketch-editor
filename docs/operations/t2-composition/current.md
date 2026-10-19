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
        phase's declared FINAL PHASE GATE, is proposed and unauthorized.
BATON: S04's prerequisites hold on `main` `5fee2a2d`: `conditional-save-current-v1` is accepted,
       and T1's Head Save integration shipped through `T1.P01.S04` (PR #148). Batch C (prepared, not
       approved) pairs S04 with `T1.P01.S05` and corrects its scope: it reuses T1's shipped
       Download/Open source JSON and Reload remote, and builds no persistence UI. TD-8 is T1's to
       fix. S04 records the base its journeys ran on.
NEXT:   The owner signs the batch C record and its approval patch is applied; then S04 starts
        through the runbook start step. Owner follow-up: push the local `closed/T2.P01.S03` tag.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md →
       ../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#proposed-batch-c-2026-10-19
BLOCKER: owner approval of batch C.
```
