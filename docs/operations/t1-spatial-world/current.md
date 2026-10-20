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
        `T1-P01-S06` on `origin/main` `bb166c67`. S01–S05 and S07 are shipped.
BATON: TD-10 is CLOSED (`21c18402`, D2). The browser leg then found and fixed two Stage-host defects
       in `5beb1e83`: pointer/overlay CSS mixed Stage-surface and viewport spaces (TD-11), and an
       adapter drag re-read the evaluation id every frame so it never committed (TD-12). Three new
       unit cases; automated gate green on that revision: `check` 0/0, `build`, `check:api`/
       `check:project-model`/`check:layout-core`/`check:camera-core`, `test:full` 169 files / 2,218,
       `test:arch` 20/166, `test:heavy` 8/118, DB-backed `test:api` 80 tests / 0 skips on an isolated
       local database (`biskiq_s06_gate`, recreated in this environment).
       EXECUTED in a real browser against a local stack (Postgres + API :8787 with the test-auth seam +
       Vite :5173): starter boot, Plan select and precision edit, typed refusal, Undo/Redo, 3D drag
       commit, Escape cancel, Save create, second-writer conflict, *Reload remote*, canonical source
       download (5,192 bytes), guarded replacement, source reopen and mismatch refusal, TD-9 sign-in
       Save resume, empty baseline, reduced-motion toggle, 720×640 overflow.
       NOT DONE: the fixture battery (nonzero datum, curved Wall, shared Junction, duplicate names,
       Opening void/cap, coincident structures, dense geometry, long identity); empty-boot plinth press
       (accepted nothing — refusal vs defect unestablished); reduced-motion *behaviour*; narrow-shell
       interaction pass.
NEXT:   Run the fixture battery and settle the plinth press, then get owner ratification of `5beb1e83`
        (it exceeds D1's TD-10-only scope), add the route-level echo/press-identity tests, and only then
        accept this record. S06 acceptance makes T1.P01 closable — the phase close is a separate owner
        event and is not invoked here.
ROUTE: ./README.md → ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md →
       ../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md →
       ../../roadmap/cross-track-execution.md#authorized-batch-d-2026-10-20
BLOCKER: none for the automated lanes. The remaining browser journeys need only the local stack this
         environment now has; acceptance still waits on owner ratification of the two host repairs.
         The T1.P01 architecture-cycle window is CLOSED at `PHASE_3_EVALUATE` with readiness
         `owner-verdict-owed`; verdicts stay the owner's.
CARRY:  RESIDUAL, owner T1 shell composition: the Card paints over the Scene Compose instrument
        (`Card` x 368→704, y 627→884, z 12; `.instrument` x 369→1262, y 658→888, z 6 at 1280×900),
        hiding its actions and clipping its text. Not fixed: the correction is a shell-composition
        decision. Reproduced with boxes and screenshots in the S06 acceptance record.
        RESOLVED observation: the Layout `Dimensions` task in the Card is the Plan membership body; the
        adapter field surface is Index → `Inspect · Layout → Dimensions`. Not a defect.
        S06 does not depend on `T3.P02.S01`, and its evidence excludes unaccepted T3.P02 work. Batch D
        is parallel: shared-file ownership is in its protocol, and the Stage host, the spatial route
        and the TD-10 repair are T1-owned.
```
