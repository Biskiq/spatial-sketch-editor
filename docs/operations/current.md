# Current — baton navigation

**Navigation only.** This file routes current work; it holds no status. The program release list is
[`../roadmap/now.md`](../roadmap/now.md). A baton is one track. Authoritative status lives in
each phase README (slice child status and order) and the
[gate register](../roadmap/README.md#gate-register). Never synchronize another track's handoff, and
never treat stale baton text as a blocker.

```text
NOT:  status · a plan · another track's state
OWNS: the per-track baton routes
READ: your track's baton → the phase README → the exact slice plan
```

Each track owns its own baton. A task reads its **owning track's** last handoff, verifies Git state
and the registered prerequisites, completes the work, then replaces **only** that file:

```text
T1 → ./t1-spatial-world/current.md
T2 → ./t2-composition/current.md
T3 → ./t3-experience/current.md
T4 → ./t4-release/current.md
```

```text
STATUS:    ../roadmap/README.md#gate-register · the owning phase README
RUNBOOKS:  ./t1-spatial-world/README.md · ./t2-composition/README.md ·
           ./t3-experience/README.md · ./t4-release/README.md
ESCALATE:  ./README.md                     (track completion · integration · milestone · replanning)
CYCLE:     ./architecture-cycle.md         (loaded only by its three hooks)
INTERRUPT: ./checkpoints/README.md         (work-checkpoint skill)
```
