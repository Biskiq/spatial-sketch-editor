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
ACTIVE: none in progress. T1.P01.S04 is accepted and shipped (2026-10-18, PR #148); S05–S06 remain
        proposed and unauthorized.
BATON: S04 (existing Layout precision with the Head Save mount) shipped in the batch B pairing with
       `T2.P01.S03`; its accepted head is `2d37adef` and its closeout anchor `closed/T1.P01.S04`
       points there (local only — the owner pushes). S07's anchors, including `ab8504aa`
       (`viewport-projection-v1` accepted) and `d1c93d47`, are ancestors of `main`; the
       `closed/T1.P01.S07` tag is likewise local only. The architecture-cycle exposure window stays
       **open**: S02 and S04 exposure rows are recorded (M1/M2 re-armed), the terminal S05 is pending.
NEXT: The owner merges PR #148 as a merge commit (P1 — no squash, no rebase). Post-merge, verify
      `2d37adef` is an ancestor of `main` and push the `closed/T1.P01.S04` tag. One residual is owed
      before/with the merge: the accepted revision carries leftover `[s04-diag]` debug instrumentation
      in the spatial route (see the S04 acceptance record). After S04 merges, T1.P01.S05 (which waits
      for S04) becomes eligible on owner authorization; S06 stays the phase's final gate and
      T2.P01.S04 stays blocked on this slice's Head Save.
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s04-existing-layout-precision/acceptance.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-b-2026-10-17
BLOCKER: the owner's merge decision on PR #148 and the residual debug instrumentation above; S05–S06
         stay unauthorized.
```
