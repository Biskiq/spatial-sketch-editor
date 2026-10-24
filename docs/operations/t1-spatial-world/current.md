# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21. T1.P02 is active; S01 and S05 are shipped.
ACTIVE: none. No slice is in implementation.
        S05 (legacy Layout retirement) accepted 2026-10-23 as `owner-override` (full-suite
        clean-run waiver only) and shipped by PR #183:
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/acceptance.md
NEXT:   S02 (draw, close, divide and delete) is held and NOT authorized. Before it can start it needs
        its own owner authorization, a plan review, the T3 review of the shared Head/F4 shell
        allocation and the T2/T3 contribution-compatibility review. Then S03 (outline, held) and
        S04 (final gate). Order: S02 → S03 → S04.
CARRY:  - S01's F2 S/M open timings are still unrun; they are assigned to S04 on the designated
          MacBook Air M2 (16 GB) against H0's baseline. No performance evidence is claimed.
        - Occupancy-derived curve-knot/interior-anchor allocators stay outside accepted intents; the
          first curve-authoring slice captures them before curved drawing ships.
        - T1 track README deferred-retirement rows still live: Room-level wall mesh path
          (VisitorLayoutShell Room branch) and Camera room-ownership branches
          (`isWorldPointInsideRoomXZ`).
BLOCKERS: none for closed work. S02 is blocked only by its authorization and reviews above.
ROUTE:  ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
        → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md (held, not released)

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.
RELEASE: ../../reference/decisions/post-batch-e-authorization-2026-10-23.md
