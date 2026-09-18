# Current handoff — live working-tree delta

Template per [`docs/README.md`](../README.md). Sliding window: immediate previous
slice plus one next action only.

## Working tree

- `main` @ `fe94150` stable tip. P23.13 merged via PR #58 (`368a799`);
  Junction-dissolve merged via PR #57 (`2716f61`). Tree clean.
- Immediate previous slice: P23.13. Full S0–S10 record + D1–D5 rulings:
  [`archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md`](../archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md).

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

- P23.13 merged as `368a799` (2026-09-17, after review fixes): **4362 passed /
  1 skipped** (291 files), `svelte-check` **0 errors / 0 warnings**,
  `check:layout-core` clean, S9/S10 suites 36/36. Acceptance driven live;
  full rows in archive record above.
- Not observed (pinned, not eyeballed): Scene ink on wall-first Plan,
  coarse-pointer layout, legacy inert-smoke surface (D2, unit-pinned only).

## Known bugs / deferred

- **TD-1 (open — deferred to P24): floor-supported placement unreachable in
  canonical wall-first projects** (placement predicate + command still
  room-first; registry empty by design). Full diagnosis + options:
  [`docs/operations/tech-debt/README.md`](./tech-debt/README.md).
- P23.13's 4 carried rows (Opening-insert, undo-with-field-open,
  coarse-pointer, Room rotation-handle) — see slice README Carried rows.
- Post-P23 scope: Issue #26 (retire Room-owned Layout stack; closeout keeps
  internal-dependency smoke only), #28 (Room/mixed multi-select), 3D
  Wall/Opening picking (P23.15 owns junction-correct rendering only), curved /
  NURBS / constraints / construction-document output outside P23 minimum.
- Issues #32, #36, #37 valid post-P23 3D/material debt; #31, #33, #44
  unrelated to Layout closeout.

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
- **The keyboard/traversal contracts in `p23-13-keyboard` are partly
  *source-string* pins** (slice `LayoutPlanViewport.svelte`, assert text). They
  passed while the announcement missed §9's value+units — drive the path live
  before trusting refactors that rename/reorder those handlers.
- **Arrows must not enter the control group** (A5: Enter enters, arrows
  traverse). `planTraversalStep` returns `null` outside the group;
  `planTraversalEnteredFor` requires keyboard entry — pointer focus also sets
  `planFocus`, so entry-from-focus let clicks steal arrows/scrolling. Do not
  "fix" back to roving-tabindex.
- **The keyboard readout is a keyboard instrument**: retired by Escape,
  mode/tool cancel, canvas-reaching primary press, or successful exact edit —
  never by pointer focus alone. Clear it, do **not** recompute per change (§9:
  one announcement per meaningful change). **Known residue**: Undo moving the
  focused control leaves stale coordinates (needs a history hook the viewport
  does not own; same family as the carried undo-with-field-open row).
- A drawing gesture on Plan needs `setPointerCapture` stubbed for synthetic
  pointers; that is the only platform call QA has ever stubbed, and no app
  gesture logic is touched by it.
- `echo ===` breaks this shell wrapper (use `printf`, or a quoted marker).

## Non-negotiables

Invariants: [`AGENTS.md`](../../AGENTS.md) hard rules 1–7 (wall-first
ownership, doc separation, one compiler/history, one camera authority,
visitor safety, no commits unless asked).
