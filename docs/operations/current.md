# Current handoff — live working-tree delta

Template per [`docs/README.md`](../README.md). Sliding window: immediate previous
slice plus one next action only.

## Working tree

- **`main` @ `5cfe4d0` ("P23.14 design context docs and png") is the stable tip, with
  every P23 slice to date merged**, plus an **uncommitted documentation pass** in the
  working tree (2026-09-17: the P23.14 re-scope and the PR-status reconciliation across
  the roadmap, tracker, design context and this file). P23.13 (Architectural Plan
  drafting finish) is **merged through PR #58** (`368a799`, 2026-09-17). The branch carried
  `27372a0` (S9 step 1 — passive Scene as fill-free ink), `619d6ce` (S9 steps 2–4 —
  empty/dense states, the repo-SVG icon family under the 2026-09-17 ruling, the
  seven-surround pins), `4904eb0` (S10 steps 1–2 — control-group keyboard
  traversal and announcements, the thin-wall pins, D5), `43931d2` (the driven
  acceptance pass and the spec-vs-atlas sweep) and the **post-PR review-fix
  commit** (2026-09-17, `fix(plan): announce control value, gate arrows`): the
  announcement's missing value+units, the arrow-key
  group entry, the readout outliving its focus, and the two record corrections
  below. Every commit on the branch is green, not just the tip: `619d6ce` was
  verified **standalone** at 4333 passed with the S10 half held aside.
- **The concurrent P23 child slice is also merged.** **Junction dissolve / Wall join
  merged through PR #57** (`2716f61`, implementation `e43ecf4`, 2026-09-17). It consumed
  no tracker P-number (child-plan exception) and its plan file stays live in
  [`2026-09-17-P23-junction-dissolve-wall-join.md`](../roadmap/p23-layout-depth/2026-09-17-P23-junction-dissolve-wall-join.md) (shipped, lives with the phase). Its
  shipped entry point is Delete/Backspace on a selected degree-2 Junction in the Plan;
  its **Inspector / Navigator-row / Plan-menu entry points were deferred to P23.14**.
- **Shipped narrative lives in the archive**, not here:
  [`archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md`](../archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md)
  holds the full S0–S10 record, the D1–D5 rulings and §11's close record.
- **Immediate previous slice.** P23.12 (names and stable display identity) merged
  on `main` through PR #55  (`f3efed9`, 2026-09-15) with the PR #56 anchor-release fix (`8a5a87f`); `main` HEAD was
  `c2a2404` at that point and is now `5cfe4d0`. P23.11 (canonical curved Walls)
  merged through PR #51.

## Next action

- **Open P23.14 (*Editor Shell & Visual System Foundation*)** against `main` — P23.13 is
  merged (PR #58), so nothing blocks it. **Owner review, 2026-09-17 re-scoped this slice** from
  *build shell, Navigator and Inspector finish*: it is now the slice that
  establishes the shell's visual system and interaction grammar, with a ceiling high
  enough that P23.15/P24/P26 extend it rather than each introducing their own
  language. Its slice context is
  [`p23.14-shell-visual-system/context/shell-design-context.md`](../roadmap/p23-layout-depth/p23.14-shell-visual-system/context/shell-design-context.md)
  (durability map, P23.15/P24/P26 forward-compatibility, the five-capture evidence
  set), and the roadmap entry carries the scope-change record. Still out of scope:
  product/domain architecture, document ownership, selection/history authority,
  navigation/camera systems, visitor runtime, and P24/P26 capability semantics — the
  old "wholesale shell redesign" non-goal is superseded by that narrower boundary.
  The concurrent Junction-dissolve slice is **merged** (PR #57) and **defers its
  Inspector, Navigator-row and Plan-menu entry points into P23.14's shell finish**, so
  P23.14's Inspector grammar must host a reason-coded destructive action. It owns, in addition to its own scope,
  **three rows
  P23.13 deliberately carried** by owner ruling: (i) §7's **Opening-insert**
  numeric row — a toolbar/menu insert commits on click and the viewport holds no
  transient insert candidate, so wiring the field set means inventing an insert
  draft with its own behaviour mandate; (ii) **undo while a numeric field is
  open** — the field's anchor follows the geometry while its text stays what it
  was opened with, so it can display a stale number (the commit stays honest);
  the principled fix is to cancel the entry on an external history transaction;
  (iii) the **coarse-pointer visual pass**, including the 44 px coarse target
  (the 24 px canvas acquisition target is met by S4's pinned
  `PLAN_CONTROL_TARGET_PX`). **(iv)** — added by the 2026-09-17 post-PR review and
  carried by owner ruling — the **selected Room's rotation handle**: painted and
  draggable in the Plan, not keyboard-reachable, and a **silent no-op** drag in
  wall-first documents (the move preview passes translation only, and `no_op`
  says nothing). The fix is either gating the mark to owners that support yaw
  (§6: *only where owner supports rotation*) or giving wall-first Rooms real
  rotation — a behaviour decision, not a patch. Then P23.15 → P23.16 final
  closeout.

## Verification

- **P23.13, merged to `main` as `368a799` (2026-09-17), after the review fixes.** Full editor suite
  **4362 passed / 1 skipped** (291 files, 1 skipped), `svelte-check` **0 errors /
  0 warnings**, `check:layout-core` clean. Before the review fixes: 4350 passed;
  `619d6ce` alone: **4333 passed / 1 skipped**. The five new S9/S10 suites
  (`p23-13-empty` 4, `p23-13-icons` 5, `p23-13-keyboard` 21,
  `p23-13-surrounds` 3, `p23-13-thin-wall` 3) pass 36/36.
- **Acceptance rows driven live 2026-09-17** (real editor, guest project, one
  4-Wall room + a Door + a bend, 12.2 px/m): keyboard on the **Wall** group
  (\"Junction 1 of 2 — Wall W-7V24\", wrap, Escape unwinds, `.focus-ring` moves
  with the arrows, selection and history untouched), on the **Opening** group
  (edge 1 → slide 2 → edge 3, wrap) and on a **curved Wall** (junction 1 →
  curve point 2 → junction 3), plus **Enter → numeric** (Width 0.90 → Tab →
  Offset 2.30 → Escape closes, counts unchanged); **grayscale** (viewport
  filtered: walls, grid, selection, ring, dims and labels all still separable);
  **contrast** (focus ring/wall 10.43:1, selection 3.09:1, muted small text
  5.55:1 on paper `#f5f7f8`); **targets** (the canvas acquisition target is
  S4's `PLAN_CONTROL_TARGET_PX = 24`, pinned in `p23-13-state-controls`; ribbon
  buttons measured 24 px tall, which is the shell row, not §9's target);
  **200 % text zoom** (root 32 px, no horizontal overflow); **seven themes**
  (one computed plan token set across all seven); **thin walls** (~3.95 px/m,
  0.79 px band → four 1 px `.wall-silhouette` aids, Camera Plan unaffected);
  **empty state** (ghost and its dismissed card, copy agreement, no
  self-collision); **dense** (21 rooms / 48 walls / 28 junctions, no label
  pileup at minimum zoom, legible refusal + `Cancel draft`).
- **Not observed, and recorded rather than implied:** Scene content on the
  Layout Plan (the Scene ink is pinned by `p23-13-object-scene-paint`, and the
  owner accepted the pinned-not-looked-at state on 2026-09-17 — both live fixture
  routes were tried and failed: 3D `Place in room` left *Scene Content 0*, and
  the 21-entity Chopin scene imported and validated but never painted a
  footprint), the coarse-pointer layout, and the legacy inert-smoke surface
  (D2, unit-pinned only).
- `main` at `c2a2404` carried the merged P23.12 implementation (PR #55) plus the
  PR #56 anchor-release fix — **superseded by `368a799`/`5cfe4d0`, whose gate numbers are
  the P23.13 ones above**; the last reported full runs on `c2a2404` were
  `npm test` 3,510 passed / 1 skipped, `npm run check` editor + museum 0 errors /
  0 warnings, and `npm run build` editor + museum passed.

## Known bugs / deferred

- **TD-1 (open — deferred to P24): floor-supported placement is unreachable in canonical
  wall-first projects.** No camera node, Scene primitive, light or asset can be placed:
  the placement acceptance predicate still requires membership of the room registry that
  a wall-first document deliberately leaves empty, and the placement command itself is
  room-first. Found 2026-09-17, introduced by the P23.0 F0 stage-4 / P23.3 format cutover.
  Full diagnosis, evidence and options: [`docs/operations/tech-debt/README.md`](./tech-debt/README.md).
- P23.13's three carried rows (Opening-insert, undo-with-field-open,
  coarse-pointer) — see Next action.
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
