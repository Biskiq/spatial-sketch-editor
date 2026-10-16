# Current

PHASE: Parallel batch 2026-10-16 across T1.P01, T2.P01 and T3.P01. Authorization and shared-file
       protocol → ../reference/decisions/parallel-slice-authorization-2026-10-16.md and
       ../roadmap/cross-track-execution.md (§Parallel batch 2026-10-16).
CHILD: T1.P01.S02, T1.P01.S03 and T2.P01.S01 remain owner-authorized and approved; T3.P01.S01 is
       shipped. Phase registers own exact status and scope:
       - T1.P01.S02 Shell, Stage and viewport provider →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md
       - T1.P01.S03 Local acceptance and history foundation →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md
       - T2.P01.S01 Deterministic candidates and canonical floor support →
         ../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s01-candidates-and-floor-support/implementation-plan.md
       - T3.P01.S01 Shared unit and program codecs →
         ../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md
BATON: The next authorized implementation is T1.P01.S02 through its track runbook start step; its
       first implementation opens the configured T1.P01 cycle window. T1.P01.S03 and T2.P01.S01
       proceed independently under the batch protocol. T3.P01.S02–S04 remain proposed; no new T3
       slice is authorized here.
NEXT: Track-specific start step and merge protocol →
      ./t1-spatial-world/README.md, ./t2-composition/README.md or ./t3-experience/README.md.
BLOCKER: none recorded for the remaining authorized slices.
GATE: F1.reference@1 and F3.channels@1 remain accepted. F2.unit-envelope@1 and its
      unit-envelope-v1 scope, plus additive F1.reference@1:unit-resolution-v1, are accepted by
      T3.P01.S01; the scope records and exact evidence →
      ../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md.
      F4.intent-acceptance@1 and T1.viewport-projection@1 remain ratified; F5 and T3/T4 cutover gates
      remain undrafted. Normative F text → ../reference/composition-execution.md; register →
      ../roadmap/README.md.
CYCLE: T3.P01.S01 is not an exposure and opened no cycle. T1.P01 window remains ready/configured,
       unopened; its state and protocol → ./architecture-cycle.md (read at cycle hooks only).
CARRY: T3 S01's interpreter behavior remains with T3.P01.S03; runtime activation, source cutover,
       migration inventory and recovery remain with T3.P01.S04. No activation or new slice
       authorization is implied by the accepted codec scopes.
