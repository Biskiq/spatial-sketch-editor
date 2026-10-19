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
        (2026-10-19), effective from PR #155. Phase A is implemented on PR #158; independent review
        requested changes, and the three substantive corrections are implemented and verified
        pending re-review. `T3.camera-experience-cutover@1` is `ratified`, with AM-9 as its contract.
BATON: The owner ratified the clean source epoch (R1–R4): saved data is disposable, AM-9
       supersedes AM-7, and the publication gap is empty by construction. S04 is authorized in two
       phases (R5). Phase A (T3-owned files: reset migration 005 with an advisory lock, API
       admission, the unit Save live path, converter retirement, lowering and visitor) is on PR #158
       and is not accepted. Phase B is the caller migration, after the current-source freeze
       (T1.P01.S05 and T2.P01.S04 merged). S04 owns TD-6, TD-7,       working F2 sign-in Save recovery (TD-9; deletion does not count), the S06 requirement rewrite,
       and the Guide-free Presentation fix (shipped in Phase A as a visitor Presentation control).
NEXT: Re-review Phase A on PR #158: Travel now resolves the authored connection, the R2 purge is
      namespace-scoped and epoch-gated, and a Stop-free Presentation is selectable and clears on a
      real advance. Mounted tests pin the camera handoff; activation uses a dedicated bucket per
      environment because the purge refuses pre-namespace legacy keys. #158 is the continuing S04
      PR, not a Phase A merge. After the batch C freeze, rebase and implement Phase B on the same
      PR; no data is reset until S04 merges and the owner runs the activation runbook.
ROUTE: ./README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md →
       ../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover
BLOCKER: phase B waits for the batch C freeze. Disclosed residuals that move to T3.P02/T4: the
         authored Cut/Travel selector, presentation text, state and lifecycle homes (T3.P02 F2
         amendments; @1 defaults are fixed in AM-9); resource bytes host-asserted until storage
         verifies them; the envelope's acceptedRevision is baseline provenance, not revision
         authority.
```
