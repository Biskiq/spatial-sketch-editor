# Current

PHASE: Parallel batch 2026-10-16 across T1.P01, T2.P01 and T3.P01 — four owner-authorized slices,
       registered and reconciled by PR #127 (`parallel-four-slice-authorization`), merged into `main`
       as `bbff4f20`. Decision record → ../reference/decisions/parallel-slice-authorization-2026-10-16.md;
       shared-file ownership, merge protocol and remaining risks → ../roadmap/cross-track-execution.md
       (§Parallel batch 2026-10-16).
CHILD: All four are claimable on post-#127 `main`. T1.P01.S02 is `in-progress` (the cycle-window
       opener); T1.P01.S03, T2.P01.S01 and T3.P01.S01 are `approved` and start through their own
       runbooks' start steps.
       - T1.P01.S02 Shell, Stage and viewport provider (cycle-window opener) →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md
       - T1.P01.S03 Local acceptance and history foundation →
         ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md
       - T2.P01.S01 Deterministic candidates and canonical floor support →
         ../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s01-candidates-and-floor-support/implementation-plan.md
       - T3.P01.S01 Shared unit and program codecs →
         ../roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/implementation-plan.md
       T1.P01.S01 is shipped (PR #126 merged as `6964c2dc`; `ee463d0b` is an ancestor of `main`).
       Every other T1/T2/T3 slice stays `proposed`; T3.P02 is an unregistered candidate phase.
BATON: Four implementation branches are open in parallel, each cut from post-#127 `main` (`bbff4f20`)
       and each awaiting independent review. No implementation PR merges, no routine closeout and no
       additional slice authorization happens before those reviews and the owner's decisions.
NEXT: Each slice runs on its own branch under the batch protocol on the then-current `main`.
      T1.P01.S02's first authorized implementation followed `open-window`; the other three are not
      exposures. Each merges on its own after review and routine closeout, rerunning the complete
      merge gate on the then-current `main`.
      ROUTE: ../roadmap/README.md (track + gate register) → the track README's phase register → the
      phase README → the slice plan → ./t1-spatial-world/README.md, ./t2-composition/README.md or
      ./t3-experience/README.md.
BLOCKER: none (four implementations in progress; independent review pending for each).
GATE: `F1.reference@1` and `F3.channels@1` are `accepted` with their capability records. The
      authorization wires the providers `T1.viewport-projection@1` → T1.P01.S02,
      `F4.intent-acceptance@1` → T1.P01.S03 and `F2.unit-envelope@1` → T3.P01.S01; each stays
      `ratified` with empty evidence. F5 and the T3/T4 cutover gates remain undrafted. Normative text →
      ../reference/composition-execution.md; register → ../roadmap/README.md.
CYCLE: `PHASE_2_VALIDATING` · `open` · the T1.P01 window is configured with T1.P01.S02, T1.P01.S04
      and T1.P01.S05 (expected opener S02, terminal S05) and is **open**: S02's first authorized
      implementation opened it through the runbook's start step, so `Opened by` names S02. Exposure
      rows, `Closed by` and mechanism verdicts are still empty, and M5 stays `dormant` until the
      replacement wiring it names is proved. State and protocol → ./architecture-cycle.md (loaded only by its three hooks).
CARRY: Capability evidence and obligations → ../roadmap/t1-spatial-world/planning-evidence.md,
       ../roadmap/t2-composition/planning-evidence.md and
       ../roadmap/t3-experience/planning-evidence.md; T4's delivery obligations →
       ../roadmap/t4-release/README.md.
       Canonical design and non-blocking UX/3D coverage →
       ../reference/design-system/editor-shell-and-visual-system.md.
       TD dispositions (TD-1/TD-2 removed, TD-3 fixed, TD-4/TD-5 retired with the
       benchmark) → ./tech-debt/README.md.
       Recovery for the compacted #115 records — including the R115.S01 anchor degradation — → the
       acceptance stub at ../roadmap/parallel-track-cutover/acceptance.md; its `Recovery` section
       owns the routes.
       Execution structure (Track → Phase → Slice, one writable owner per concern): lifecycle and the
       gate register → ../roadmap/README.md; track objectives, phase registers and Starting
       foundations → ../roadmap/{t1-spatial-world,t2-composition,t3-experience,t4-release}/README.md;
       operational runbooks → ./{t1-spatial-world,t2-composition,t3-experience,t4-release}/README.md;
       event procedures (track completion, product integration acceptance, bounded replanning) →
       ./README.md.
