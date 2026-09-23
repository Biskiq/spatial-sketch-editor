# P26 — Spatial Depth

**Phase goal:** make Layout genuinely spatial — one canonical
wall-first model acquires controlled vertical structure plus a precise
orthographic surface for authoring it. Plan stays horizontal authority;
contextual Orthographic (Section, Wall Elevation, Ceiling Focus) becomes the
vertical precision instrument; 3D proves the space. All edit one `LayoutDocument`.

FreeCAD/Bonsai harvests are supporting evidence, not architecture authority.

```text
STATUS: planning
PIPELINE: P23 (shipped) → P23B (planning) → P26 → P24 → P25 — P23B is inserted ahead of P26;
          P26 planning continues in parallel and is not the primary next-work instruction.
          The immediate work is P23B.0 measurement
STAGE: independent design exploration (REGISTER artifact available, unratified; reconciliation pending)
CURRENT: design/briefs/2026-09-22-p26-designer-brief.md
NEXT: independent design proposals, then a reconciled direction — no implementation plan in this step
GATE: no implementation approved. P26 is the SELECTED VALIDATION WINDOW of the architecture cycle —
      selected, not open (live state → ../../operations/architecture-cycle.md). Two consequences for
      this phase's own artifacts:
      · When P26's implementation plan is written or reconciled, account for the installed mechanisms
        and do not redesign P26 around them; that reconciliation writes `STATUS: ready for validation`
        in the cycle file and is what makes the window ready — installation alone does not.
      · STOP while the cycle still says installed-not-reconciled: only after `STATUS: ready for
        validation` may P26's first implementation slice start `PHASE_2_VALIDATING`, through the
        authorized procedure, recorded in the cycle file before implementation proceeds.
```

```text
ROUTE:
research → research/broad/ + research/harvests/
synthesis (authoritative) → research/synthesis/p26-architectural-spatial-depth-synthesis.md
design assignment → design/briefs/2026-09-22-p26-designer-brief.md (assignment, not a contract)
independent exploration → design/proposals/register/README.md (REGISTER; unratified, not an implementation plan)
reconciliation → none yet
plan → none yet (umbrella + child plans pending)
```

## Design

- Assignment: [`design/briefs/2026-09-22-p26-designer-brief.md`](./design/briefs/2026-09-22-p26-designer-brief.md) — self-contained brief for independent designers. An assignment, not a contract.
- Independent exploration: [REGISTER](./design/proposals/register/README.md) — codebase-aware primary direction, interaction/ceiling specification, and visual atlas covering S1–S10. **Unratified**; no reconciliation or implementation approval implied. Its atlas is self-verifying: `node design/proposals/register/check-atlas.mjs` renders every board, asserts the scenario consistency matrix, probes every displayed control, and fails if the exported vectors drift from the atlas. Review evidence, recorded owner rulings and prototype limits: [review-notes.md](./design/proposals/register/review-notes.md). Those rulings dispose of four specific decision items (ceiling regions, opening arch rise, twelve-room finite-depth semantics, fixture multiplicity); they ratify neither REGISTER nor any other submission.

## Research (supporting evidence)

- Broad: [`research/broad/deep-research-P26-phase-1.md`](./research/broad/deep-research-P26-phase-1.md) ·
  [`research/broad/deep-research-P26-phase-1-compact.md`](./research/broad/deep-research-P26-phase-1-compact.md)
- Harvests: [`research/harvests/P26-phase2-freecad-section-orthographic-harvest.md`](./research/harvests/P26-phase2-freecad-section-orthographic-harvest.md) ·
  [`research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md`](./research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md)
