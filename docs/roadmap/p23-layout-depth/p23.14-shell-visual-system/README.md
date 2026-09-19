# P23.14 — Editor Shell & Visual System Foundation

```text
STATUS: implemented — Tasks 1–9 landed on `p23.14`; OWNER REVIEW OPEN (not closed out)
NEXT: owner review of the QA record findings F1/F2/F4/F5, then P23.15
      R1 (tray engraved tier) + R2 (armed tool) + R3 (one type scale + one control scale
      as roles, two knobs) are owner-ratified and landed; F7 is resolved by R1, F8 by R3.
      Ratifications + drift root cause: ../../../reference/design-system/editor-shell-ratifications.md
PLAN: ./2026-09-19-P23.14-plate-shell-visual-system.md
QA: ./qa/2026-09-19-P23.14-shell-qa-record.md
```
**Owner/authority:** shell-design context is authoritative for product/architecture/ownership/scope; the promoted durable shell contract (`../../../reference/design-system/editor-shell-and-visual-system.md`) is the ratified shell/system contract; research and independent proposals are evidence only. This slice established it — it is no longer a slice-local document.

## IMPLEMENT — read for normal implementation

- Phase: [`../README.md`](../README.md) · remaining scope: [`../2026-09-14-P23-remaining-roadmap-reconciliation.md`](../2026-09-14-P23-remaining-roadmap-reconciliation.md) §P23.14
- Context: [`context/shell-design-context.md`](./context/shell-design-context.md)
- **Durable contract (promoted out of this slice):**
  [`../../../reference/design-system/editor-shell-and-visual-system.md`](../../../reference/design-system/editor-shell-and-visual-system.md)
  — the P23.14 direction that used to sit in this folder is now that document. Old path:
  [`design/final-direction.md`](./design/final-direction.md) (supersession pointer).
- Relevant reference contracts: `docs/reference/components/shell.md`,
  `docs/reference/design-system/design-specs.md`,
  `docs/reference/design-system/design-shell-specs.md`.
  The implementation plan must name the exact affected reference docs —
  do not preload the rest of `design-system/`.

## DESIGN

- [`design/briefs/p23.14-designer-brief.md`](./design/briefs/p23.14-designer-brief.md) (assignment, not authority)
- Context: see IMPLEMENT above; durable contract: see IMPLEMENT above.

## EVIDENCE — read only if needed

- [`research/editor-shell-visual-system.md`](./research/editor-shell-visual-system.md) (precedent evidence, not spec)
- [`design/proposals/designer-a.md`](./design/proposals/designer-a.md) (independent concept, superseded where the durable contract rules)
- [`design/proposals/designer-d/design-notes.md`](./design/proposals/designer-d/design-notes.md) (independent exploration)
- [`../../../reference/design-system/editor-shell-atlas/index.html`](../../../reference/design-system/editor-shell-atlas/index.html) + [`notes.md`](../../../reference/design-system/editor-shell-atlas/notes.md) (visual/interaction QA evidence, not topology/validation authority; moved beside the durable contract — this slice's [`design/atlas/index.html`](./design/atlas/index.html) is now a supersession pointer)
- [`design/atlas/p23.13-p23.14-atlas-reconciliation.md`](./design/atlas/p23.13-p23.14-atlas-reconciliation.md) (QA boundaries)

## QA

- **Self-review record:** [`qa/2026-09-19-P23.14-shell-qa-record.md`](./qa/2026-09-19-P23.14-shell-qa-record.md)
  — Atlas specimens A–D, the §25.2 stress toggles, the findings that came out of it, and the
  post-review ownership pass. Fixed: F3, F6, F7 (→ R1, resolving the residual `TRANSFORM`
  call), F8 (→ R3) and the review's F1/F2/F5/F10 (→ R4 — one writable control owner per fact,
  one workspace-scoped Inspector target). Open: **F4 only**, deferred as **TD-2** rather than
  accepted. Device, screen-reader, reduced-motion and coarse-pointer rows remain
  **manual-owed**.
- Atlas specimens are QA references only.
- **Durable design authority (owner-ratified 2026-09-19):**
  [`../../../reference/design-system/editor-shell-and-visual-system.md`](../../../reference/design-system/editor-shell-and-visual-system.md)
  + its [`Atlas`](../../../reference/design-system/editor-shell-atlas/index.html) are the
  **durable, stable design authority for the editor shell** — P23.15,
  P23.16, P24 and P26 fit into this grammar and may depend on it. The `docs/reference/*`
  docs stay canonical for capability/ownership/exposure and the frozen Plan/identity/icon
  contracts, while their shell placement/dimension/type statements are descriptive of the
  landed PLATE system.
- **Owner ratifications R1–R4:**
  [`../../../reference/design-system/editor-shell-ratifications.md`](../../../reference/design-system/editor-shell-ratifications.md)
  — **R1** the Tool Tray paints the reference's engraved micro-tier (7 px group / 8 px tool,
  plus a 6 px compact floor for a word wider than the rail) rather than the 10 px engraved
  tier, which cannot fit §11's 44 px rail; **R2** an armed tool is a **darkened surface and
  nothing else** (no amber border, no inboard edge, no weight step). That file also records
  the **root cause of the drift** — the pre-P23.14 ribbon-era contract was the only written
  authority for the new rail's numbers, and the rail's shared toolbar components carry View
  Bar rules (`white-space: nowrap`) into the tray — so later phases inherit the lesson, not
  just the number. **R3** then removed the drift's actual mechanism: the shell carries no
  pinned sizes any more. Seven ladder steps (9/10/11/12/13/15/20 px) and a role for every
  recurring group (`--editor-type-*`, `--editor-control-*`, icons, fitted geometry) are all
  multiples of two knobs — `--editor-type-scale` (type) and `--editor-control-scale`
  (button/group chrome) — set on `:root`. The Atlas-derived metrics the sweep landed (View
  Bar 24 px plain buttons, Head 26 px controls / 14 px identity, 74 px Spine stations, 29 px
  Navigator rows, 10 px engraved Inspector headers, 9 px mono ruler ticks, 10 px Status Rail)
  are the resolved values of those roles, not numbers in components, and
  `tests/lib/editor/app/p23-14-type-roles.test.ts` fails if a swept surface reintroduces one.
  **R4** (post-review) settled ownership: the host decides what a control paints and the
  workspace decides what is exposed, so each writable fact has one owner (the Tool Tray paints
  no View Bar utility, the View Bar owns the menus and utilities, the Camera Drawer owns
  `POV / Observer`), and the Inspector presents one workspace-scoped target to both its header
  and its body while remembered selections stay remembered.
- **Known acceptance limitation (TD‑1):** `Add Camera` still depends on the legacy
  Room-floor placement path, and the canonical wall-first floor hit is refused, so a
  fresh canonical project cannot place a new camera. Existing TD‑1
  (`docs/operations/tech-debt/README.md`), owner-deferred to P24 — P23.14–P23.16 must not
  fix or work around it incidentally. Camera QA that needs populated
  nodes/connections/Sequence/five Timeline lanes/selected-camera 3D frustum must use an
  existing or pre-seeded canonical world-local Scene + navigation fixture over wall-first
  Layout data; a fresh-project `Add Camera` failure is expected and is not a P23.14
  acceptance failure; an unexercisable populated Camera state is marked BLOCKED /
  manual-owed, never claimed passed from source inspection or Atlas appearance.

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
