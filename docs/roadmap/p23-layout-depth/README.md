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
FINAL PHASE GATE: P23.16 — Final whole-product integration and P23 closeout gate
  gate artifact → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
  satisfying its exit criteria makes P23 CLOSABLE, not closed.
  CLOSED requires an explicit owner request and ruling; closure then runs the owner-invoked
  phase-closeout procedure, which updates P-level status/baton and runs the close preflight.
  For P23 the cycle is WAITING, so the preflight's target is PHASE_0_DUE; the target is computed,
  never assumed.
  Landed P23 slice plans are evidence; they are not active instructions (see "Completed slices").
```

```text
ROUTE (active child P23.14 — direct; no intermediate slice router):
plan → p23.14-shell-visual-system/2026-09-19-P23.14-plate-shell-visual-system.md
context → p23.14-shell-visual-system/context/shell-design-context.md (+ context/p23-design-context.md)
QA → p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md
durable shell contract → ../../reference/design-system/editor-shell-and-visual-system.md
remaining scope → 2026-09-14-P23-remaining-roadmap-reconciliation.md §P23.14
closeout gate → 2026-09-08-P23.16-final-whole-product-integration-closeout.md
slice design evidence (superseded direction) → p23.14-shell-visual-system/design/ + research/
```

## Authorities

- Umbrella: [`2026-09-07-P23-layout-depth-minimum-build.md`](./2026-09-07-P23-layout-depth-minimum-build.md)
- Cross-view direction: [`2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md`](./2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)
- **Shell design — durable authority:**
  [`../../reference/design-system/editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md),
  whose §0.1 states the authority graph, §0.2 records the owner ratifications (R1–R4) and §0.3
  keeps the open owner calls unresolved. It is slice-independent: the slice-local design
  direction is superseded and promoted here, while P23.14 itself remains open for owner
  review. This shell grammar is the **stable baseline later phases fit into
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
routes the exact plan path.

Landed P23 slice plans below are historical evidence (each carries its own Status line);
they are not current instructions, and their full bodies become compact stubs at P23 close.

All new slice closeouts leave closed artifacts as path-preserving stubs holding a
`git show <A>:<path>` recovery line, with an archive copy only for multi-file bundles or
non-text evidence (mechanics: `slice-closeout`). Shipped narrative for P23.13 lives in
`docs/archive/plans/`.
P23.13 carried rows to P23.14 by owner ruling — now owned by the P23.14 plan
(Task 5 carried rows, Task 8 coarse-pointer pass, locked Decision 7).
