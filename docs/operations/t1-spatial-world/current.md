# T1 — Spatial world: current baton

Track-scoped handoff. **Replace only this file for T1 work.** It carries T1's current work and its
immediate next step; it is not a status store, a plan or another track's state.

```text
NOT:  status · a plan · the gate register · another track's state
OWNS: T1's current work and immediate next step
READ: this file → the phase README → the exact slice plan
FEED: the owning phase README (child status/order) · the gate register (exact interfaces)
```

Authoritative status stays outside this file: a phase README owns its slice register and the
[gate register](../../roadmap/README.md#gate-register) owns exact interfaces. Never synchronize another
track's baton, and never treat stale baton text as a blocker — verify Git state and the registered
prerequisites instead.

```text
PHASE: T1.P01 Stage and authoring foundation (in-progress) →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
ACTIVE: none. T1.P01.S07 is accepted and closeout-complete (2026-10-17); S04–S06 remain proposed
        and unauthorized.
BATON: S02 was accepted under owner-override on 2026-10-17. By owner ruling D1 (2026-10-17), S07's
       acceptance is the viewport readiness route; it recorded `T1.viewport-projection@1`
       (`viewport-projection-v1`) accepted with S02 as the unchanged sole provider. S07's routine
       closeout is complete: closed-work compaction, the preservation report, the
       `closed/T1.P01.S07` anchor tag (local only) and the merge-stability reconciliation are done on
       PR #137's branch; consumer eligibility starts at a base containing its merge.
NEXT: The owner merges PR #137 as a merge commit (P1 — no squash, no rebase). Post-merge, verify the
      recorded anchors are ancestors of `main` and push the `closed/T1.P01.S07` tag.
ROUTE: ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/acceptance.md →
       ../../roadmap/README.md#gate-register
BLOCKER: the owner's merge decision on PR #137. S04–S06 stay unauthorized until the owner
         authorizes them; their capability prerequisites are met once the merge is on `main`.
```
