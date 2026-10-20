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
        (2026-10-19), effective from PR #155. Phase A is **accepted at `b9cb5ed1`** (independent
        round 4, no blocking findings); Phase B is implemented on PR #158 and awaiting independent
        final review. `T3.camera-experience-cutover@1` is `ratified`, with AM-9 as its contract.
BATON: The owner ratified the clean source epoch (R1–R4): saved data is disposable, AM-9
       supersedes AM-7, and the publication gap is empty by construction. S04 is authorized in two
       phases (R5). Phase A (reset migration 005 with an advisory lock, API admission, the unit Save
       live path, converter retirement, lowering and visitor) is accepted at `b9cb5ed1`, with the
       declared-handoff origin correction at `ce6678da`; the branch is merged with the frozen
       `main` at `fd3cf67e`. **Phase B is implemented** in `0d2f6ceb` with the A/B/C corrections:
       every editor boot/starter/empty/Open/Download/import path is F2, the Stage read facade and
       T1/T2 operations/history are unit-scoped, Scene definitions are pinned/procedural, the Head
       Save is the unit Save, TD-9 route-level recovery is live, the visitor Camera graph comes from
       the Camera unit, and the S06 requirement rewrite / capability retirement landed with the
       caller migration. TD-6, TD-7 and TD-9 are closed in the ledger. The exhaustive, arch, heavy,
       build, check and fresh-DB API lanes pass; the migration rehearsal and fence refusals pass.
NEXT: Obtain independent final review of the Phase B revision on PR #158. Resolve any findings and
      re-review until accepted; then record acceptance in the slice record, run between-review
      closeout (S04 is the phase's final gate, so closeout makes the phase *closable* and stops),
      commit/push the accepted changes to #158, and verify the remote head/ancestry, clean worktree
      and mergeability. Stop before merging; merge and the activation runbook are owner actions.
ROUTE: ./README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md →
       ../../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md →
       ../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover
BLOCKER: independent final review of Phase B is pending; none technical. Disclosed residuals that
         move to T3.P02/T4: the public reader (T4), catalogue model placement until r186 contact
         verification (T2 K1), the authored Cut/Travel selector, presentation text, state and
         lifecycle homes (T3.P02 F2 amendments; @1 defaults are fixed in AM-9), resource bytes
         host-asserted until storage verifies them, and the envelope's acceptedRevision as baseline
         provenance rather than revision authority.
```
