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
ACTIVE: none. T1.P01.S07 (Stage↔F4 integration bridge) is accepted and shipped 2026-10-17;
        S04–S06 remain proposed and unauthorized.
BATON: S02 was accepted under owner-override on 2026-10-17. By owner ruling D1 (2026-10-17), S07's
       acceptance is the viewport readiness route; it recorded `T1.viewport-projection@1`
       (`viewport-projection-v1`) accepted with S02 as the unchanged sole provider.
NEXT: PR #137 carries the accepted increment on `T1-P01-S07`; merge candidate `049e89f5` (code head
      `ab8504aa`, `origin/main` `279e1340` merged) passed the complete gate, including the DB-backed
      API suites (65 tests, zero skips). Merge is withheld at the owner's instruction. Once the
      owner authorizes it: merge as a merge commit, verify the recorded anchor, then compact the
      closed work into its stub, tag `closed/T1.P01.S07`, and confirm consumers see the capability
      at the new trusted base.
ROUTE: ./README.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-2026-10-17 →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/acceptance.md
BLOCKER: Owner authorization to merge PR #137. Closed-work compaction and the anchor tag wait for that
         merge because a P1 anchor is only reachable from `main` after it. S04–S06 stay unauthorized
         until the owner authorizes them; their capability prerequisites are met at the merge.
```
