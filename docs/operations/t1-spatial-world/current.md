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
ACTIVE: none in progress. S01–S04 and S07 are shipped (PR #148 anchors verified ancestors of
        `main`; `closed/T1.P01.S04` pushed). S05 is authorized as batch C (2026-10-19), effective
        when PR #155 merges. S06 is proposed and routed after T3.P01.S04 (ruling C3).
BATON: Batch C: S05 ∥ T2.P01.S04 under the batch C protocol; S05 owns the host core, and TD-8 is its
       first increment (it may land standalone first if T2 S04 needs it). S05's implementation is on
       branch `T1-P01-S05` (base `919c2904`), with TD-8 fixed host-side and Wall length/angle/rigid
       handles landed. Review follow-ups are in: a length dragged across the fixed endpoint is
       refused (no mirrored preview), a paused reading-flip proposal has an exact Resume/Discard in
       Dimensions, and a shared-Junction edit marks the neighbours the candidate reshaped. It is
       **not merged, not accepted**, and its record claims no acceptance. After both batch C slices
       merge, the current-source freeze holds until T3.P01.S04 merges. The cycle window stays open;
       S05 is the terminal, and its closeout records the exposure row. TD-9 is owned by the Head
       integration and verified at S06.
NEXT: S05 is implemented on its branch and awaits the batch C merge protocol. T2's final gate still
      needs T1-owned route/Head proofs (preview cancel on replace, invalid-open preservation, Save
      creator journey); that is a host follow-up, not a Scene change. Owner follow-up: push the
      local `closed/T1.P01.S07` tag.
ROUTE: ./README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19 →
       ../../reference/decisions/batch-c-authorization-2026-10-19.md
BLOCKER: none once PR #155 merges. S06 waits for T3.P01.S04's acceptance and its own authorization.
```
