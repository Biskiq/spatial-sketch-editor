# Current

PHASE: R115 — PR #115 architecture reset (frozen-lane isolation, aggressive pruning,
       parallel-track cutover). Registered in the track register →
       ../roadmap/README.md; its own README → ../roadmap/parallel-track-cutover/README.md.
CHILD: R115.S01 — the reset's single child. ACCEPTED AND CLOSED (shipped 2026-10-14 by
       slice-closeout). Final-gate artifact →
       ../roadmap/parallel-track-cutover/acceptance.md (§23 records the final acceptance
       verdict, the §7.4 verification and the preservation report). Work packages and
       checkpoints → ../roadmap/parallel-track-cutover/implementation-plan.md §12.
NEXT: the owner's R115 phase-close decision. The final child is closed and the phase is
      `closable`, so no work package is authorized; the owner may close R115 (phase-closeout)
      or leave it open. ROUTE: ../roadmap/parallel-track-cutover/README.md FINAL PHASE GATE
      block + the gate artifact above.
BLOCKER: owner phase-close decision (PHASE CLOSE `Stage: closable`). PR #115's merge is owner-
      controlled and the branch is merge-ready; the accepted revision and this closeout must
      land as a merge commit (no squash or rebase) so the `closed/r115.s01` anchor stays
      reachable.
EXECUTION STRUCTURE (created by WP5, now live):
      Track → Phase → Slice with one writable owner per concern. Track and phase lifecycle
      and the gate register → ../roadmap/README.md. Track objectives, phase registers and
      Starting foundations → ../roadmap/t1-spatial-world/README.md,
      ../roadmap/t2-composition/README.md, ../roadmap/t3-experience/README.md and
      ../roadmap/t4-release/README.md. Operational runbooks →
      ./t1-spatial-world/README.md, ./t2-composition/README.md,
      ./t3-experience/README.md and ./t4-release/README.md. Event procedures (track
      completion, product integration acceptance, bounded replanning) → ./README.md.
      No track phase is registered; capability implementation needs its own approved scope
      and accepted gate versions.
BATON: #114 accepted unified design → #115 parallel-track planning cutover (WP0–WP7 executed;
       R115.S01 closed, R115 closable) → owner merge + R115 phase close → foundation-gated
       production implementation.
GATE: F.1–F.5 target OWNER-RATIFIED; every gate in the gate register is `undrafted`;
      NO PRODUCTION IMPLEMENTATION AUTHORIZED. Normative text →
      ../reference/composition-execution.md. Each exact interface is drafted with its first
      consumer and ratified as an F amendment; track plans cannot mint independent formats or
      bypass their readiness gates. Cycle state and protocol →
      ../operations/architecture-cycle.md (`PHASE_1`,
      `awaiting-bounded-slice-window-plan`, window selected and not open).
CARRY: Capability evidence and obligations → ../roadmap/t1-spatial-world/planning-evidence.md,
       ../roadmap/t2-composition/planning-evidence.md and
       ../roadmap/t3-experience/planning-evidence.md; T4's delivery obligations →
       ../roadmap/t4-release/README.md.
       Canonical design and non-blocking UX/3D coverage →
       ../reference/design-system/editor-shell-and-visual-system.md.
       TD dispositions (TD-1/TD-2 removed, TD-3 fixed, TD-4/TD-5 retired with the
       benchmark) → ./tech-debt/README.md.
