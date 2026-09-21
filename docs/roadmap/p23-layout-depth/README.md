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
CURRENT: P23.14 — Editor Shell & Visual System Foundation
NEXT: P23.14 owner review closeout, then P23.15 → P23.16 final closeout
GATE: P23.16 closeout gate below; P24 implementation waits for accepted P23 minimum + approval
```

```text
ROUTE (active child P23.14 — direct; no intermediate slice router):
plan → p23.14-shell-visual-system/2026-09-19-P23.14-plate-shell-visual-system.md
context → p23.14-shell-visual-system/context/shell-design-context.md (+ context/p23-design-context.md)
QA → p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md
durable shell contract → ../../reference/design-system/editor-shell-and-visual-system.md
remaining scope → 2026-09-14-P23-remaining-roadmap-reconciliation.md §P23.14
closeout gate → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
slice history/design evidence → p23.14-shell-visual-system/design/ + research/ (evidence only)
```

## Authorities

- Umbrella: [`2026-09-07-P23-layout-depth-minimum-build.md`](./2026-09-07-P23-layout-depth-minimum-build.md)
- Cross-view direction: [`2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md`](./2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)
- **Shell design — durable authority:**
  [`../../reference/design-system/editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md),
  whose §0.1 states the authority graph, §0.2 records the owner ratifications (R1–R4) and §0.3
  keeps the open owner calls unresolved. It is slice-independent — promoted out of the P23.14
  slice, which is now history. This shell grammar is the **stable baseline later phases fit into
  and depend on**: P23.15, P23.16, P24 and P26 enter through it rather than re-deciding shell
  composition, material, type or state language. Evidence annexes (evidence, not authority):
  [`editor-shell-ratifications.md`](../../reference/design-system/editor-shell-ratifications.md)
  and [`editor-shell-atlas/`](../../reference/design-system/editor-shell-atlas/index.html).
  The P23.14 QA record stays with the slice:
  [`p23.14-shell-visual-system/qa/`](./p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md).
  Pre-PLATE shell numbers — the `docs/reference/design-system/*` shell-placement/type/control
  tables and `design-plan-p21.md`'s 32 px ribbon — are **superseded for the shell** and carry
  header notes saying so; `docs/reference/design-system/*` and `docs/reference/components/shell.md`
  remain canonical for capability, ownership, exposure and the frozen Plan/identity/icon
  contracts, and are descriptive only for shell placement, dimension and type.

## Completed slices (shipped on `main`)

P23.0, P23.8, P23.1–P23.6e, P23.9 (+regression), P23.10, P23.11, P23.12, P23.13,
plus the concurrent Junction-dissolve / Wall join child slice (PR #57, no tracker
P-number; Inspector/Navigator-row/Plan-menu entry points deferred to P23.14).
Flat `P23.x` plan docs in this folder are legacy/grandfathered only
(pre-migration shipped slices); do not add new slice-specific plans here —
active slice plans/artifacts live in that slice's workspace, and this phase README
routes the exact plan path. All new slice closeouts archive the whole slice bundle under
`docs/archive/roadmap/...` and leave a one-line stub here. Shipped
narrative for P23.13 lives in `docs/archive/plans/`.
P23.13 carried rows to P23.14 by owner ruling — now owned by the P23.14 plan
(Task 5 carried rows, Task 8 coarse-pointer pass, locked Decision 7).
