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
ACTIVE: none in progress. S01–S04 and S07 are shipped. S04 merged in PR #148: its accepted head
        `2d37adef` and review fix `aa26e04a` are ancestors of `main`, and `closed/T1.P01.S04` is
        pushed (verified 2026-10-19). S05–S06 are proposed and unauthorized.
BATON: Batch C is prepared, not approved: S05 ∥ T2.P01.S04, with TD-8 as S05's first increment,
       then a current-source freeze before T3.P01.S04's caller migration, and S06 moved after the T3
       cutover with re-declared unit scopes. The cycle window stays open: the S02 and S04 rows are
       recorded, and the terminal S05 is pending. TD-9 (sign-in Save resume half-wired) is
       recorded, owned by the Head integration and verified at S06.
NEXT: The owner signs the batch C record (C1–C7) and its approval patch is applied. S05 then
      starts through the runbook start step at its own trusted base. Owner follow-up: push the
      local `closed/T1.P01.S07` tag.
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#proposed-batch-c-2026-10-19 →
       ../../reference/decisions/batch-c-authorization-2026-10-19.md
BLOCKER: owner approval of batch C; S05–S06 stay unauthorized until then.
```
