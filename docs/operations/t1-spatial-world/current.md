# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21; its registered slices are shipped.
ACTIVE: T1.P02.S05 — legacy Layout retirement. Implementation, independent review and the complete
       implementation-PR merge gate are done in worktree `batch-2026-10-23/T1.P02.S05` on branch
       `t1/p02-s05-legacy-layout-retirement` (trusted base `main` fff7dc14); PR opened, NOT merged.
       Evidence: ../t1.p02.s05-legacy-layout-retirement/acceptance.md. S01 shipped by scoped
       owner-override; the phase remains active.
NEXT: Owner acceptance of the open PR, including the plan's named owner reviews — T3 (reader/Camera)
      for `project-layout-semantics.ts` and T2 (Scene) for `scene-planning/frame.ts` — then routine
      closeout and merge. Nothing here is accepted yet and the retirement condition is NOT
      discharged. S05 must be accepted and merged before S02 drawing starts. S02–S04 remain held;
      S03 remains an outline. Order: S01 → S05 → S02 → S03 → S04 final gate.
START:  2026-10-23 eligibility PASS — S05 child row `approved`; F1.reference@1, F2.unit-envelope@1,
        F4.intent-acceptance@1 and T1.viewport-projection@1 and their four `Requires` scopes exist
        and are accepted at fff7dc14; `docs/roadmap/now.md` lists the scope and its condition
        (coordination PR merged) is met by PR #182 / fff7dc14. Cycle check: S05 is not listed under
        the T1.P01 exposure window's slices, so `open-window` does not apply (positive control:
        a non-listed slice start creates no cycle requirement).
SHARED: T1.P02.S05 claims, before editing (cross-track-execution §Next parallel batch table):
        - `packages/project-model/src/scene-planning/frame.ts` — writer T1.P02.S05 (the
          `normalizeLayoutRoomYaw` move), expected patch base fff7dc14, T2 reviews (Scene).
          T2.P02.S02 does not edit this file; if it must, it waits for this merge and rebases.
        - `packages/project-model/src/project-layout-semantics.ts` — writer T1.P02.S05 (registry
          facade exception), expected patch base fff7dc14, T3 reviews (reader/Camera).
        - `apps/editor/tests/helpers/**` — T1.P02.S05 owns the legacy fixture retirement; its
          conversions land first when another lane touches one helper; each edit triggers
          every-lane + full suite verification.
CARRY: Legacy retirement cannot pass drawing or leave this phase. The bounded registry/Scene-frame
       exception needs reader/Camera and Scene owner review. All omitted scopes remain held.
       S01's still-unrun F2 S/M open timings stay assigned to S04 on the designated MacBook Air M2,
       16 GB, against H0's baseline; no performance evidence or blanket waiver is claimed.
       Occupancy-derived curve-knot/interior-anchor allocators remain outside accepted intents;
       the first curve-authoring slice captures them before curved drawing ships.
ROUTE: ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register
       → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/implementation-plan.md
       → ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md (held, not released)

BOUNDARIES: No phase closure, T1 TRACK COMPLETE event or owner architecture verdict is recorded.

RELEASE: ../../reference/decisions/post-batch-e-authorization-2026-10-23.md
