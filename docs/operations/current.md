# Current

PHASE: Parallel batch 2026-10-16 across T1.P01, T2.P01 and T3.P01. Authorization and shared-file
       protocol → ../reference/decisions/parallel-slice-authorization-2026-10-16.md and
       ../roadmap/cross-track-execution.md (§Parallel batch 2026-10-16). T2.P01.S01 (PR #130) and
       T3.P01.S01 (PR #131) are shipped; T1.P01.S02 and T1.P01.S03 remain owner-authorized and
       approved. Phase registers own exact status and scope:
       - T1.P01.S02 Shell, Stage and viewport provider (cycle-window opener) →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md
       - T1.P01.S03 Local acceptance and history foundation →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md
       - T2.P01.S01 Deterministic candidates and canonical floor support — shipped 2026-10-16 →
         ../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s01-candidates-and-floor-support/acceptance.md
       - T3.P01.S01 Shared unit and program codecs — shipped 2026-10-16 →
         ../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md
       T2.P01.S02–S04 and T3.P01.S02–S04 remain proposed; T3.P02 is an unregistered candidate phase.
BATON: The next authorized implementation is T1.P01.S02 through its track runbook start step; its
       first implementation opens the configured T1.P01 cycle window. T1.P01.S03 proceeds
       independently under the batch protocol. No new slice is authorized here.
NEXT: Track-specific start step and merge protocol →
      ./t1-spatial-world/README.md or ./t2-composition/README.md.
BLOCKER: none for the remaining authorized slices. T2.P01.S02 waits on T1.P01.S03's accepted F4
      `local-single-domain-v1` evidence.
GATE: F1.reference@1 and F3.channels@1 remain accepted. F2.unit-envelope@1 and its
      unit-envelope-v1 scope, plus additive F1.reference@1:unit-resolution-v1, are accepted by
      T3.P01.S01; the scope records and exact evidence →
      ../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md.
      F4.intent-acceptance@1 and T1.viewport-projection@1 remain ratified; F5 and T3/T4 cutover gates
      remain undrafted. Normative F text → ../reference/composition-execution.md; register →
      ../roadmap/README.md.
CYCLE: Neither T2.P01.S01 nor T3.P01.S01 is an exposure and neither opened a cycle. The T1.P01
       window remains ready/configured, unopened; its state and protocol → ./architecture-cycle.md
       (read at cycle hooks only).
CARRY: T2 S01's integrated host capture, frame conversion and editing-surface behavior remain with
       T2.P01.S02–S03; exhaustive phase integration remains with T2.P01.S04. T3 S01's interpreter
       behavior remains with T3.P01.S03; runtime activation, source cutover, migration inventory and
       recovery remain with T3.P01.S04. No activation or new slice authorization is implied by the
       accepted codec scopes.
