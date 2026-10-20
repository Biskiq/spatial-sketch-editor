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
SLICES: S01, S02, S05 and S06 are shipped, and S03 is shipped by reconciliation. S04 is authorized
        (2026-10-19), effective from PR #155. Phase A is implemented and **accepted at `b9cb5ed1`**
        (independent round 4, no blocking findings). `T3.camera-experience-cutover@1` is `ratified`,
        with AM-9 as its contract.
BATON: The owner ratified the clean source epoch (R1–R4): saved data is disposable, AM-9
       supersedes AM-7, and the publication gap is empty by construction. S04 is authorized in two
       phases (R5). Phase A (T3-owned files: reset migration 005 with an advisory lock, API
       admission, the unit Save live path, converter retirement, lowering and visitor) is accepted
       at `b9cb5ed1`, with the declared-handoff origin correction at `ce6678da`; the branch is merged
       with the frozen `main` at `fd3cf67e`. The slice is not accepted and `#158` is not
       merge-eligible until Phase B. **Phase B is not started**: the editor still boots, imports,
       exports, stages and saves the current source, and the visitor Camera graph is still
       Scene-derived. S04 owns TD-6, TD-7 (both closed in Phase A and recorded in the ledger),
       working F2 sign-in Save recovery (TD-9; deletion does not count), the S06 requirement rewrite,
       and the Guide-free Presentation fix (shipped in Phase A as a visitor Presentation control).
NEXT: Implement Phase B on PR #158 from `fd3cf67e` as one atomic caller migration: F2 admission at
      boot/import/export, Stage read ownership and the starter; unit-backed T1/T2 operation and
      history callers; the unit Save mounted in the Head with TD-9's route-level recovery; the
      Camera-unit visitor graph; and the S06 requirement rewrite in the same commit that retires
      `local-single-domain-v1`. A partial migration is not mergeable: it would leave a second
      current-source reader alive. Then run the exhaustive lane, `check:api`, the DB-backed
      `test:api` with zero skips and the migration/concurrency rehearsal, obtain independent final
      review, close out and merge. Activation uses a dedicated bucket per environment because the
      purge refuses pre-namespace legacy keys; no data is reset until S04 merges and the owner runs
      the activation runbook.
ROUTE: ./README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md →
       ../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover
BLOCKER: none technical — the batch C freeze is complete. Phase B is the remaining authorized
         implementation. Disclosed residuals that move to T3.P02/T4: the
         authored Cut/Travel selector, presentation text, state and lifecycle homes (T3.P02 F2
         amendments; @1 defaults are fixed in AM-9); resource bytes host-asserted until storage
         verifies them; the envelope's acceptedRevision is baseline provenance, not revision
         authority.
```
