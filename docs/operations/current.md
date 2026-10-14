# Current

PHASE: R115 — PR #115 architecture reset (frozen-lane isolation, aggressive pruning,
       parallel-track cutover). Registered in the track register →
       ../roadmap/README.md; its own README → ../roadmap/parallel-track-cutover/README.md.
CHILD: R115.S01 — the reset's single child. WP0–WP4 are accepted; WP5 is executed with its
       evidence recorded and independent review owed. Work packages and checkpoints →
       ../roadmap/parallel-track-cutover/implementation-plan.md §12; executed evidence →
       ../roadmap/parallel-track-cutover/acceptance.md.
NEXT: WP6 — cross-reference and full verification (repair links and anchors, reconcile the
      test README, routers and AGENTS, run the complete §7.4 contract). Then WP7 (acceptance,
      closeout and handoff). R115's owner-close stays pending after that.
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
BATON: #114 accepted unified design → #115 parallel-track planning cutover
       (WP0–WP5 executed; WP6–WP7 remaining) → foundation-gated production implementation.
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
