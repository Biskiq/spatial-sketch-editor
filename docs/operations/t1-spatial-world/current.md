# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01 and S05 are shipped.
ACTIVE: T1.P02.S06 (performance foundation), optimize step (agent), released 2026-10-25. Started
        2026-10-24 at trusted base 2215af341a650ac3a99a0fbb36e48de7e901411e; setup and the C.2
        amendment in PR #190 (D1–D9 ruled 2026-10-24). Bench 1 ran from `1c5e530c` as two
        owner-directed invocations (grid-L, then grid-M, grid-S, E5 and the transferred rows;
        grid-XL and the sweep latency rows dropped) and counts as Bench 1 by the owner's A.7
        ruling (2026-10-25). Results and hand-off: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md
NEXT:   T1.P02.S06 → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md
        It runs on an owner-run benchmark budget of at most three passes:
        set up (agent) → Bench 1 (owner) → optimize with hand calculation (agent) → Bench 2
        (owner) → fix (agent) → Bench 3 final acceptance (owner).
        Agents never run a full benchmark pass; they run smoke checks only, labelled as such.
        The one exception is owner-directed: the owner had the agent launch Bench 1 (2026-10-24).
        It covers:
        - the peak-first, setup-free harness method on the designated MacBook Air M2 (16 GB);
        - L/XL and realistic-load workloads;
        - per-stage scaling evidence;
        - algorithm work inside the one compiler;
        - the full-permissive library exploration.
        Then S02 (draw, close, divide and delete), which is held and NOT authorized. It is halted
        until S06 is accepted and merged. After that it needs its own owner authorization, a plan
        review, the T3 review of the shared Head/F4 shell allocation and the T2/T3
        contribution-compatibility review. Then S03 (outline, held) and S04 (final gate).
        Order: S06 → S02 → S03 → S04.
CLAIMS: S06 setup holds apps/editor/perf/**. Writer: the T1 S06 setup agent, branch
        `t1/p02-s06-bench-setup`; expected patch base 2215af34; reviewer: T3 (shared harness,
        fixtures, flows and the Camera/Experience fixture generator). No shared test helper under
        apps/editor/tests/helpers/** is edited. Every owner-run pass on the M2 holds the
        machine-wide perf lock.
CARRY:  - Transferred to S06 (owner replanning 2026-10-24):
          - S02's install-compile and Undo/Redo dedupe and the incremental/worker experiment;
          - T3.P02.S02's deferred Scope A performance rows (measurement and dispositions);
          - T3.P03.S02's L/XL fixtures and M/L drag rows.
        - S01's F2 S/M open timings stay assigned to S04 on the designated M2. S04 cites and
          rechecks S06's numbers. No performance evidence is claimed yet.
        - Occupancy-derived curve-knot/interior-anchor allocators stay outside accepted intents. The
          first curve-authoring slice captures them before curved drawing ships.
        - Deferred-retirement rows in the T1 track README are still live: the Room-level wall mesh
          path (VisitorLayoutShell Room branch) and the Camera room-ownership branches
          (`isWorldPointInsideRoomXZ`).
BLOCKERS: none for S06 once the coordination PR is merged. S02 is blocked by S06 and by its
        authorization and reviews above.
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/performance-foundation-authorization-2026-10-24.md
