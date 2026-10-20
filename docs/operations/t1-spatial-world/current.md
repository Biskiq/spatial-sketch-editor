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
PHASE: T1.P01 Stage and authoring foundation (in-progress; final gate S06 in progress, not accepted) →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md
ACTIVE: T1.P01.S06 — Integrated final gate, owner-authorized 2026-10-20 as batch D
        ([record](../../reference/decisions/batch-d-authorization-2026-10-20.md), D1). Branch
        `T1-P01-S06` on `origin/main` `bb166c67`. S01–S05 and S07 are shipped; the slice declares
        exhaustive verification over the existing integrated scope, not a reduced one.
BATON: TD-10 is CLOSED (`21c18402`, D2): `openSourceJson` and `applyReloadOffer` capture the session
       token before admitting and drop a result whose epoch is no longer current, reporting nothing
       for the stale action. Four mounted route cases in
       `spatial-route-source-replacement.test.ts` fail without either guard. Automated gate green on
       that revision: `check` 0/0, `build`, `check:api`/`check:project-model`/`check:layout-core`/
       `check:camera-core`, `test:full` 169 files / 2,215, `test:arch` 20/166, `test:heavy` 8/118,
       DB-backed `test:api` 80 tests / 0 skips on an isolated local database.
       NOT DONE: the browser-journey leg. Executed only the boot/render, Plan selection, Compose
       instrument and reduced-motion control; the precision field edit, direct 3D edit, Undo/Redo,
       download/reopen, replacement, empty-baseline and reduced-motion behaviour, plus the F2
       Save/conflict/Reload and TD-9 sign-in resume (no cloud client in this environment), are not
       recorded browser evidence. Also unresolved: the Layout `Dimensions` task opened the route's
       membership body rather than an adapter field surface for the selected subject.
NEXT:   Finish the browser leg on a trusted base with a local Compose stack (`.env` + `stack:up`), or
        record why a journey cannot run; settle the `Dimensions` observation; then the acceptance
        record, independent review and `slice-closeout`. S06 acceptance makes T1.P01 closable — the
        phase close is a separate owner event and is not invoked here.
ROUTE: ./README.md → ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-d-2026-10-20
BLOCKER: the browser leg needs a cloud client (`.env` + Compose stack) that this environment does not
         have, and one observation (`Dimensions`) is unresolved. Neither blocks the TD-10 increment,
         which is landed and verified. The T1.P01 architecture-cycle window is CLOSED at
         `PHASE_3_EVALUATE` with readiness `owner-verdict-owed`; verdicts stay the owner's.
CARRY:  RESIDUAL, owner T1 shell composition: the Card paints over the Scene Compose instrument
        (`Card` x 368→704, y 627→884, z 12; `.instrument` x 369→1262, y 658→888, z 6 at 1280×900),
        hiding its actions and clipping its text. Not fixed: the correction is a shell-composition
        decision and S06's authorization covers no code outside the TD-10 repair. Reproduced with
        boxes and screenshots in the S06 acceptance record.
        S06 does not depend on `T3.P02.S01`, and its evidence excludes unaccepted T3.P02 work. Batch D
        is parallel: shared-file ownership is in its protocol, and the Stage host, the spatial route
        and the TD-10 repair are T1-owned.
```
