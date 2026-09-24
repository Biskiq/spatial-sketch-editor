# P26 — Continuous Spatial Authoring

**Phase goal:** deliver one continuous, contextually editable spatial world: Plan↔3D,
first-class circular Room creation with one self-connected Wall, Wall facing
and peeling, drawn-line Section/depth/Reveal, ceiling lift/look-up,
and exact return with view navigation separate from document Undo. P26 includes
the architectural redesign and production implementation needed for that experience.

```text
STATUS: planning — experience target accepted; production architecture/sequence proposed
CURRENT: 2026-09-24-P26-continuous-spatial-authoring-umbrella.md
NEXT: reconcile against landed P23B; prepare bounded proofs and implementation plan
EXECUTION: P23B remains preceding performance phase and primary execution track;
           P26 planning may continue in parallel. P23 remains closed.
GATE: no implementation approved by this revision; no child is implementation-ready.
      P26 is the architecture cycle's selected validation window, not open.
      The umbrella maps installed mechanisms but is not the prepared implementation plan.
      Final plan reconciliation against landed P23B and installed mechanisms must write
      STATUS: ready for validation in ../../operations/architecture-cycle.md.
      STOP while installed-not-reconciled. Only the authorized first implementation
      slice then records PHASE_2_VALIDATING before implementation starts.
```

## Authorities and routes

- **Phase-wide proposal:** [Continuous Spatial Authoring umbrella](./2026-09-24-P26-continuous-spatial-authoring-umbrella.md) — baseline/source evidence, architecture, subsystem dispositions, rebuild/migration, full scope, proofs, decisions, acceptance and P24 handoff. All substantive reconciliation lives here.
- **Accepted experience:** [Final Design Prototype](./Final-Design-Prototype/README.md) — runnable import unchanged; rationale, reconciliation, implementer reference and journeys are linked there. Its implementation shortcuts are not production contracts.
- **Shell authority unchanged:** [PLATE](../../reference/design-system/editor-shell-and-visual-system.md). Proposed deltas await the umbrella's decision gate.
- **Readiness state:** [architecture cycle](../../operations/architecture-cycle.md).
- **Primary execution:** [P23B](../p23b-geometry-performance/README.md), whose SEQUENCE remains authoritative for that phase.

## Candidate order — proposed only

No child plans or proofs are authorized. Details and dependency gates are in umbrella §6–§9.

1. Landed-P23B reconciliation and prepared implementation plan.
2. Early continuous Plan↔3D authoring slice, retaining production Wall drawing.
3. Circular Room creation and canonical single-Wall enclosure (P7), including periodic Openings and generated floor/ceiling.
4. Facing and attributed contextual cuts/recovery, using the closed-Wall fixture.
5. Canonical vertical profiles, arch rise and independent ceilings, including circular coverage.
6. Cubic and closed-circle peeling/intermediate precision (P3 consumes P7).
7. Ceiling lift/look-up and relationship recovery.
8. Session/accessibility/Scene-Camera integration and viewport cutover.
9. Integrated acceptance and P24 handoff.

D8 inclusion is accepted; representation remains technical-design/proof-gated.
The first continuous walking slice stays bounded to existing ordinary Wall and
Opening semantics. The next slice delivers circular creation and editing before
Section/coverage/peel acceptance; no multi-Wall substitute fulfills D8.

## Supporting provenance — not competing design authority

- [Research synthesis](./research/synthesis/p26-architectural-spatial-depth-synthesis.md): independently accepted domain decisions retained by the umbrella; the old separate-workspace framing is superseded.
- [Designer brief](./design/briefs/2026-09-22-p26-designer-brief.md): original assignment, now answered by the accepted prototype.
- [Broad compact](./research/broad/deep-research-P26-phase-1-compact.md), [FreeCAD harvest](./research/harvests/P26-phase2-freecad-section-orthographic-harvest.md), [Bonsai harvest](./research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md): supporting research only.

REGISTER and presentation-only reproductions of it are superseded; they are not
live P26 authorities. Preserve independently accepted product decisions through the umbrella.

**Final phase gate:** integrated acceptance makes P26 closable, not closed.
Major-phase closure is owner-invoked and follows the architecture cycle's
selected-window lifecycle. This planning revision invokes no closeout.
