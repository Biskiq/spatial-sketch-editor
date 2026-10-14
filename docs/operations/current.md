# Current

PHASE: R115 — PR #115 architecture reset (frozen-lane isolation, aggressive
       pruning, parallel-track cutover). Phases/order → ../roadmap/README.md.
CHILD: R115.S01 — the reset's single child. WP0–WP3T are accepted; WP4 is executed
       and its evidence recorded, awaiting independent review. Work packages and
       checkpoints → ../roadmap/parallel-track-cutover/implementation-plan.md §12;
       executed evidence → ../roadmap/parallel-track-cutover/acceptance.md.
NEXT: WP5 — execution structure: the track READMEs and runbooks, the gate
      register, the `parallel-track-gates` structure test and markdown-table
      helper, the cycle state/mechanism tables and hooks, and the §10.4 skill
      edits. Then WP6 (cross-reference reconciliation and full verification) and
      WP7 (acceptance, closeout, handoff).
BATON: #114 accepted unified design → #115 parallel-track planning cutover
       (WP0–WP3T accepted; WP4–WP7 remaining) → foundation-gated production
       implementation.
GATE: F.1–F.5 target OWNER-RATIFIED; NO PRODUCTION IMPLEMENTATION AUTHORIZED.
      Normative text → ../reference/composition-execution.md. Each exact
      interface is drafted with its first consumer and ratified as an F
      amendment; track plans cannot mint independent formats or bypass their
      readiness gates. Cycle state and protocol →
      ../operations/architecture-cycle.md.
CARRY: Capability evidence and obligations → ../roadmap/t1-spatial-world/planning-evidence.md,
       ../roadmap/t2-composition/planning-evidence.md and
       ../roadmap/t3-experience/planning-evidence.md; the T4 track →
       ../roadmap/t4-release/README.md.
       Canonical design and non-blocking UX/3D coverage →
       ../reference/design-system/editor-shell-and-visual-system.md.
       TD dispositions (TD-1/TD-2 removed, TD-3 fixed, TD-4/TD-5 retired with the
       benchmark) → ./tech-debt/README.md.
