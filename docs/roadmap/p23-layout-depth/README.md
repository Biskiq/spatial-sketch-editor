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
STAGE: slice planning (P23.14 design reconciliation; no implementation-ready child plan yet)
CURRENT: p23.14-shell-visual-system/README.md (P23.14 — Editor Shell & Visual System Foundation)
NEXT: P23.14 implementation plan, then P23.15 → P23.16 final closeout
GATE: P23.16 closeout gate below; P24 implementation waits for accepted P23 minimum + approval
```

```text
ROUTE:
remaining scope → 2026-09-14-P23-remaining-roadmap-reconciliation.md §P23.14
context → context/p23-design-context.md + p23.14 slice context
plan → P23.14 slice README (no implementation-ready child plan yet)
closeout gate → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
```

## Authorities

- Umbrella: [`2026-09-07-P23-layout-depth-minimum-build.md`](./2026-09-07-P23-layout-depth-minimum-build.md)
- Cross-view direction: [`2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md`](./2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)

## Completed slices (shipped on `main`)

P23.0, P23.8, P23.1–P23.6e, P23.9 (+regression), P23.10, P23.11, P23.12, P23.13,
plus the concurrent Junction-dissolve / Wall join child slice (PR #57, no tracker
P-number; Inspector/Navigator-row/Plan-menu entry points deferred to P23.14).
Plan docs for pre-migration shipped slices stay flat in this folder
(grandfathered); all new slice closeouts archive the whole slice bundle under
`docs/archive/roadmap/...` and leave a one-line stub here. Shipped
narrative for P23.13 lives in `docs/archive/plans/`.
P23.13 carried four rows to P23.14 by owner ruling (see slice README Carried rows).
