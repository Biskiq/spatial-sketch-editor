# Current handoff — live working-tree delta

Template per [`docs/README.md`](../README.md). Sliding window: immediate previous
slice plus one next action only.

## Working tree

- `main` @ `5cfe4d0` stable tip. P23.13 merged via PR #58 (`368a799`);
  Junction-dissolve merged via PR #57 (`2716f61`). Uncommitted docs pass in
  tree (P23.14 re-scope + tracker reconciliation).
- Immediate previous slice: P23.13. Full S0–S10 record + D1–D5 rulings:
  [`archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md`](../archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md).
- Junction-dissolve plan stays live with the phase (shipped, no P-number);
  Inspector / Navigator-row / Plan-menu entries deferred to P23.14.

## Next action

- Open P23.14 against `main` via
  [`p23.14-shell-visual-system/README.md`](../roadmap/p23-layout-depth/p23.14-shell-visual-system/README.md).
  Context: [`shell-design-context.md`](../roadmap/p23-layout-depth/p23.14-shell-visual-system/context/shell-design-context.md).
  No implementation-ready child plan yet.
- P23.14 owns shell visual system + interaction grammar, Junction-dissolve
  deferred entries, and 4 carried rows — see slice README Carried rows.
- Out of scope: product/domain architecture, document ownership,
  selection/history, camera/nav, visitor runtime, P24/P26 capability semantics.
- Then P23.15 → P23.16 final closeout.

## Verification

- P23.13 merged as `368a799` (2026-09-17, after review fixes). Full editor suite
  **4362 passed / 1 skipped** (291 files), `svelte-check` **0 errors /
  0 warnings**, `check:layout-core` clean. Five new S9/S10 suites pass 36/36.
- Acceptance rows driven live 2026-09-17 (keyboard groups, Enter→numeric,
  grayscale, contrast, targets, 200% zoom, seven themes, thin walls, empty,
  dense). Full rows in archive record above.
- Not observed (pinned, not eyeballed): Scene ink on wall-first Plan,
  coarse-pointer layout, legacy inert-smoke surface (D2, unit-pinned only).

## Known bugs / deferred

- **TD-1 (open — deferred to P24): floor-supported placement is unreachable in canonical
  wall-first projects.** No camera node, Scene primitive, light or asset can be placed:
  the placement acceptance predicate still requires membership of the room registry that
  a wall-first document deliberately leaves empty, and the placement command itself is
  room-first. Found 2026-09-17, introduced by the P23.0 F0 stage-4 / P23.3 format cutover.
  Full diagnosis, evidence and options: [`docs/operations/tech-debt/README.md`](./tech-debt/README.md).
- P23.13's 4 carried rows (Opening-insert, undo-with-field-open,
  coarse-pointer, Room rotation-handle) — see slice README Carried rows.
- Issue #26: retire the legacy Room-owned Layout stack after P23; P23 closeout
  keeps only internal-dependency smoke and adds no compatibility behavior.
- Issue #28: Layout Room/mixed multi-select remains post-P23.
- Canonical wall-first 3D Wall/Opening picking + highlighting remains post-P23;
  P23.15 owns junction-correct rendering only.
- General curved intersections/noding, NURBS, constraints, construction-document
  output and CAD/BIM depth remain outside the revised P23 minimum.
- Issues #32, #36 and #37 are valid post-P23 3D/material accessibility debt;
  #31, #33 and #44 are unrelated to the P23 Layout closeout boundary.

## Traps

- New editor projects already boot `createEmptyWallFirstProject()`; do not revive
  the obsolete “legacy boot decision still open” narrative.
- The “canonical **268 px** Navigator rail” figure in planning docs has no code
  constant; the shipped rail is `minmax(15rem, --editor-left-width: 300px)`
  (240–300 px). Design to that range and treat `268` as stale.
- **There is no live route to Scene content on a wall-first guest project**, which
  is why the S9-step-1 Scene-ink eyeball stayed pinned. Do not record the ink as
  *eyeballed* on the strength of source pins, and do not bolt a `__qa-*` plate
  into the tree to fake it (a `__`-prefixed plate runs inside the suite via
  vitest `include` and writes into the tree).
- **The whole test suite is described as 291 files; the keyboard/traversal
  contracts in `p23-13-keyboard` are partly *source-string* pins** (they slice
  `LayoutPlanViewport.svelte` and assert text). They are weaker than they look —
  they passed while the announcement was missing §9's required value and units,
  because they pinned the announcement's *shape* and never asked what a keyboard
  user actually hears. Drive the path live (or assert the composed string) before
  trusting a refactor that renames or reorders those handlers.
- **Arrows must not enter the control group** (A5: Enter enters, arrows traverse).
  Two halves, and both are load-bearing: `planTraversalStep` answers `null` for a
  focus outside the group, and `planTraversalEnteredFor` requires the keyboard to
  have *entered* that selection — because the **pointer also focuses controls**
  (`planAcquiredControl` → `setPlanFocus`), so inferring the entry from
  `planFocus` let a click unlock the arrows and steal ArrowRight/Left/Up and
  their scrolling. Do not "fix" it back to the roving-tabindex convention.
- **The keyboard readout is a keyboard instrument**: it is retired by Escape, by
  a mode/tool cancel, by a primary press that reaches the canvas, and by a
  **successful exact edit** (which changed the value the region was holding) —
  never by pointer focus alone, which stays silent. Clear it, do **not** recompute
  it on every change: §9 allows one announcement per meaningful change, and a
  self-refreshing readout is the per-change chatter it forbids. A **known
  residue**: an Undo that moves the focused control changes its value with no
  pointer and no keyboard move, so the region can hold the previous coordinates
  (same family as the carried undo-with-field-open row; closing it needs a
  history hook the viewport does not own).
- A drawing gesture on Plan needs `setPointerCapture` stubbed for synthetic
  pointers; that is the only platform call QA has ever stubbed, and no app
  gesture logic is touched by it.
- `echo ===` breaks this shell wrapper (use `printf`, or a quoted marker).

## Non-negotiables

- Canonical wall-first Junction/Wall/Opening ownership with persistent semantic
  Rooms; explicit Junction IDs own connectivity.
- `LayoutDocument` and `SceneDocument` remain separate; Layout edits never move
  world-local Scene/Camera content implicitly.
- One compiler/topology/Room-reconciliation path and deterministic selection,
  history and Undo/Redo.
- One Camera graph/route/motion authority.
- `/museum` and `/p/:publicationId` remain visitor-safe; editor-only hierarchy,
  selection, history and gizmo code never enter visitor chunks.
- No commits unless the user asks.
