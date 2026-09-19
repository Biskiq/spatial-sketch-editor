# P23 — Layout Depth

**Phase goal:** credible wall-first architectural Plan editor: first-class
Junctions/Walls/Wall-hosted Openings, `boundary | partition` semantics, robust
straight-wall topology, persistent Room correspondence, explicit Layout/Scene
compatibility, trustworthy legacy conversion, project/world-local Scene/Camera
placement, compiler/query/adapter cutover, then precise dimensions, deterministic
snapping, continuous sketching, openings, duplicate/presets, direct manipulation,
bounded curved-Wall authoring, stable display identity, Plan/shell finish and
junction-correct wall-first 3D.

**Phase invariants:** one `LayoutDocument` → `compileLayoutGeometry()` → Plan/3D/visitor
authority; Layout and Scene ownership separate; one camera graph/route/motion;
wall-first Junction/Wall/Opening ownership with persistent semantic Rooms.

```text
STATUS: in-progress
STAGE: P23.14 implemented on `p23.14`, owner review OPEN (PR #61)
CURRENT: p23.14-shell-visual-system/README.md (P23.14 — Editor Shell & Visual System Foundation)
NEXT: P23.14 owner review closeout, then P23.15 → P23.16 final closeout
GATE: P23.16 closeout gate below; P24 implementation waits for accepted P23 minimum + approval
```

```text
ROUTE:
remaining scope → 2026-09-14-P23-remaining-roadmap-reconciliation.md §P23.14
context → context/p23-design-context.md + p23.14 slice context
plan → p23.14-shell-visual-system/2026-09-19-P23.14-plate-shell-visual-system.md (via P23.14 slice README)
closeout gate → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
```

## Authorities

- Umbrella: [`2026-09-07-P23-layout-depth-minimum-build.md`](./2026-09-07-P23-layout-depth-minimum-build.md)
- Cross-view direction: [`2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md`](./2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)
- **Shell design — START HERE (durable, owner-ratified 2026-09-19):**
  [`../../reference/design-system/editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md),
  whose §0.1 states the authority graph. It is slice-independent: it was promoted out of the
  P23.14 slice, which is now history and keeps only supersession pointers. The P23.14 shell grammar is the **stable baseline
  later phases fit into and depend on** — P23.15, P23.16, P24 (denser content, multi-select,
  groups, materials/lights) and P26 (section/elevation as a subordinate instrument) enter
  through it rather than re-deciding shell composition, dimension or type.
  Its post-implementation ratifications are **folded into the direction itself** (§0.2):
  **R1** Tool Tray tier (7 px group / 8 px tool, opt-in 6 px compact floor), **R2** armed tool
  (material sink, no amber outline/inboard edge), **R3** closed 9–20 px type ladder + semantic
  roles + `--editor-type-scale` / `--editor-control-scale`, plus the View Bar `MODE`-as-caption
  grammar, the four distinct surface states, the shell-inheritance rule (§2.8) and
  roles-not-numbers (§2.9). Its §0.3 keeps the **open owner calls** explicitly unresolved and
  §0.4 the **implementation debt** out of design.
  Evidence annexes (evidence, not authority):
  [`editor-shell-ratifications.md`](../../reference/design-system/editor-shell-ratifications.md)
  (measurements + drift root cause) and
  [`editor-shell-atlas/`](../../reference/design-system/editor-shell-atlas/index.html)
  (interactive QA companion). The dated P23.14 QA record stays with the slice:
  [`p23.14-shell-visual-system/qa/`](./p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md).
  Pre-PLATE shell numbers — the `docs/reference/design-system/*` shell-placement/type/control
  tables and `design-plan-p21.md`'s 32 px ribbon — are **superseded for the shell** and carry
  header notes saying so; they remain canonical only for capability, ownership, exposure and
  the frozen identity/icon/Plan contracts.
  `docs/reference/design-system/*` and `docs/reference/components/shell.md` stay canonical for
  capability/ownership/exposure and the frozen Plan/identity/icon contracts, and are
  descriptive — not authoritative — for shell placement, dimension and type.

## Completed slices (shipped on `main`)

P23.0, P23.8, P23.1–P23.6e, P23.9 (+regression), P23.10, P23.11, P23.12, P23.13,
plus the concurrent Junction-dissolve / Wall join child slice (PR #57, no tracker
P-number; Inspector/Navigator-row/Plan-menu entry points deferred to P23.14).
Flat `P23.x` plan docs in this folder are legacy/grandfathered only
(pre-migration shipped slices); do not add new slice-specific plans here —
active slice plans/artifacts live in that slice's workspace, with the exact
plan path owned by the slice README. All new slice closeouts archive the whole slice bundle under
`docs/archive/roadmap/...` and leave a one-line stub here. Shipped
narrative for P23.13 lives in `docs/archive/plans/`.
P23.13 carried four rows to P23.14 by owner ruling (see slice README Carried rows).
