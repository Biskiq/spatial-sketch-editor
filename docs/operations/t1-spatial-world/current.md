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
PHASE: T1.P01 Stage and authoring foundation (in-progress; final gate S06 authorized, unimplemented) →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
ACTIVE: T1.P01.S06 — Integrated final gate, owner-authorized 2026-10-20 as batch D
        ([record](../../reference/decisions/batch-d-authorization-2026-10-20.md), D1). S01–S05 and S07
        are shipped. It runs on the post-cutover base `9a457f6b`, consumes the accepted
        `T3.camera-experience-cutover@1`, and declares exhaustive verification over the existing
        integrated scope — not a reduced one.
BATON: TD-10 (late successful Open / accepted Reload installing over a newer epoch) is verified
       present at `9a457f6b` and is due before or with S06 (D2). Repair is narrow: capture the session
       token before admission, abandon a result whose epoch is no longer current, report nothing for
       the stale action, and add the route-level regression TD-10 names. It may land as a standalone
       tech-debt PR first (PR #159 precedent) or as S06's first increment; S06 closes the ledger entry
       and cannot claim the host journeys while it stays open. TD-9 is closed by `T3.P01.S04` and its
       sign-in Save resume is verified end to end in S06.
NEXT:   Start S06 through the runbook start step at its own trusted base: repair TD-10, then run the
        exhaustive integrated gate (including the F2-only boot, strict admission refusals, the unit
        Save/conflict/Reload journey, `check:api` + zero-skip `test:api`, and the browser journeys),
        then independent review, `slice-closeout`, and a P1 merge commit. Acceptance makes T1.P01
        closable; closing it is a separate owner event.
ROUTE: ./README.md → ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-d-2026-10-20
BLOCKER: none. TD-10 is the slice's own first obligation, not an external dependency. The T1.P01
         architecture-cycle window is CLOSED at `PHASE_3_EVALUATE` with readiness
         `owner-verdict-owed`: the per-mechanism verdicts are the owner's event, block no T1 work and
         are never fabricated by S06 or by a phase close.
CARRY:  S06 does not depend on `T3.P02.S01`, and its evidence excludes unaccepted T3.P02 work. The
        Card/Compose overlap that `T3.P01.S04` carried forward is reviewed in S06 as a defect or a
        recorded residual. Batch D is parallel: shared-file ownership is in its protocol, and the
        Stage host, the spatial route and the TD-10 repair are T1-owned.
```
