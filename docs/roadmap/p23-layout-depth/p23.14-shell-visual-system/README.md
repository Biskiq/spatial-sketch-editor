# P23.14 — Editor Shell & Visual System Foundation

```text
STATUS: design reconciliation / implementation planning (no implementation-ready child plan yet)
NEXT: write implementation-ready child plan from context + final-direction below
```
**Owner/authority:** shell-design context is authoritative for product/architecture/ownership/scope; final-direction is the ratified designer contract; research and independent proposals are evidence only.

## IMPLEMENT — read for normal implementation

- Phase: [`../README.md`](../README.md) · remaining scope: [`../2026-09-14-P23-remaining-roadmap-reconciliation.md`](../2026-09-14-P23-remaining-roadmap-reconciliation.md) §P23.14
- Context: [`context/shell-design-context.md`](./context/shell-design-context.md)
- Direction: [`design/final-direction.md`](./design/final-direction.md)
- Relevant reference contracts: `docs/reference/components/shell.md`,
  `docs/reference/design-system/design-specs.md`,
  `docs/reference/design-system/design-shell-specs.md`.
  The implementation plan must name the exact affected reference docs —
  do not preload the rest of `design-system/`.

## DESIGN

- [`design/briefs/p23.14-designer-brief.md`](./design/briefs/p23.14-designer-brief.md) (assignment, not authority)
- Context + final-direction: see IMPLEMENT above.

## EVIDENCE — read only if needed

- [`research/editor-shell-visual-system.md`](./research/editor-shell-visual-system.md) (precedent evidence, not spec)
- [`design/proposals/designer-a.md`](./design/proposals/designer-a.md) (independent concept, superseded where final-direction rules)
- [`design/proposals/designer-d/design-notes.md`](./design/proposals/designer-d/design-notes.md) (independent exploration)
- [`design/atlas/index.html`](./design/atlas/index.html) + [`design/atlas/notes.md`](./design/atlas/notes.md) (visual/interaction QA evidence, not topology/validation authority)
- [`design/atlas/p23.13-p23.14-atlas-reconciliation.md`](./design/atlas/p23.13-p23.14-atlas-reconciliation.md) (QA boundaries)

## QA

- No slice `qa/` yet (plan pending). Atlas specimens are QA references only.

## NO PRELOAD — predecessor material

- Inherited display-identity rules (R/W/O/J references, name/reference lead,
  Inspector-owned rename): `docs/reference/components/shell.md` §Display identity.
  Rationale: `docs/archive/roadmap/p23/p23.12-final-design-contract.md`.
- Inherited Plan drafting ink (paper/ink/selection/focus tokens, mark treatments,
  landed toolbar marks): `docs/reference/design-system/design-specs.md` §Plan drafting ink.
  Rationale: `docs/archive/roadmap/p23/P23.13-final-design-specification-Designer-D.md`.
- Rejected/superseded proposals and broad research stay unloaded unless a design question requires them.

## Carried rows (owner-ruled, owned by this slice)

- Opening-insert draft behavior (§7 numeric row): toolbar/menu insert commits on
  click, viewport holds no transient candidate — wiring the field set means
  inventing an insert draft with its own behaviour mandate.
- Undo-with-field-open cancellation: field anchor follows geometry while text
  stays opened value (stale number, honest commit) — fix is cancel entry on
  external history transaction.
- Coarse-pointer 44 px pass (24 px canvas acquisition already met by S4
  `PLAN_CONTROL_TARGET_PX`).
- Wall-first Room rotation-handle decision: painted + draggable, not
  keyboard-reachable, silent no-op drag in wall-first docs — gate mark to owners
  supporting yaw or give wall-first Rooms real rotation (behaviour decision).
- Junction-dissolve defers Inspector / Navigator-row / Plan-menu entry points
  into this slice's shell finish (reason-coded destructive action).
