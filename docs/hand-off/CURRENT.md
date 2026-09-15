# Current handoff — live working-tree delta

Template per [`../README.md`](../README.md). Sliding window: immediate previous
slice plus one next action only.

## Working tree

- A focused curved-Room correspondence regression fix now builds predecessor
  Room polygons from the same oriented centerline samples as candidate faces.
  The supplied two-Room Layout no longer fuses into a false `2→2` component;
  adding an independent Wall and splitting the larger Room both commit.
- A focused P23.9 regression fix is implementation-complete for Wall endpoints
  projected onto oblique host spans: sub-nanometre projection dust no longer
  misses canonical T-noding or creates false Room-correspondence components.
  The child brief is
  `docs/plans/2026-09-14-P23.9-wall-span-topology-regression.md`; review is
  [PR #50](https://github.com/toni8699/spatial-sketch-editor/pull/50).
- [The P23 remaining-roadmap reconciliation](../plans/2026-09-14-P23-remaining-roadmap-reconciliation.md)
  landed on `main`/`origin/main` at `c401e2f`. It sets the credible good-enough
  wall-first architectural Plan-editor boundary and the dependency sequence
  P23.10–P23.16.

## Next action

- Review and merge PR #50, the focused P23.9 wall-span topology regression fix;
  afterward the roadmap next action remains owner review of the tightened P23
  boundaries before P23.10 implementation.

## Verification

- Supplied-layout regressions: 3 passed; focused curved/oblique Layout suites:
  28 passed. `npm run check:layout-core` and `npm run check` passed. Full editor
  suite: 3,776 passed / 1 skipped with one bend diagnosis timeout under the
  concurrent run; that diagnostic passed all 11 tests in isolation.
- Focused Wall regression suites: 49 passed. The new deterministic matrix
  covers 1,310 candidate operations across false `2→2`, `2→3`, `3→4`, missed
  noding and out-of-tolerance non-connection cases; direct regressions pin
  canonical reused-Junction ownership, shared T-node identity, and both sides
  of the polygon ring-tolerance boundary.
- `npm test`: 3,510 passed / 1 skipped; `npm run check`: editor + museum 0
  errors/warnings; `npm run build`: editor + museum passed.
- Last landed P23.6e verification from PR #47: `npm test` 3,476 passed / 1
  skipped; `npm run check` editor + museum 0 errors/warnings; `npm run build`
  editor + museum passed; focused hierarchy/Plan regressions 157 passed.
- PR #48 independently reported `npm run check:layout-core` passed and 660
  Layout tests passed across 38 files.

## Known bugs / deferred

- Issue #26: retire the legacy Room-owned Layout stack after P23; P23 closeout
  keeps only internal-dependency smoke and adds no compatibility behavior.
- Issue #28: Layout Room/mixed multi-select remains post-P23.
- Canonical wall-first 3D Wall/Opening picking + highlighting remains post-P23;
  proposed P23.15 owns junction-correct rendering only.
- General curved intersections/noding, NURBS, constraints, construction-document
  output and CAD/BIM depth remain outside the revised P23 minimum.
- Issues #32, #36 and #37 are valid post-P23 3D/material accessibility debt;
  #31, #33 and #44 are unrelated to the P23 Layout closeout boundary.

## Traps

- New editor projects already boot `createEmptyWallFirstProject()`; do not revive
  the obsolete “legacy boot decision still open” narrative.
- P23.6a–P23.6e are merged, not branch-only future work.
- The former P23.7's detailed 3D-junction and compatibility sections were removed
  from the live gate; they remain recoverable in Git history. The 2026-09-14
  roadmap is the remaining-scope authority.
- The former P23.7 is renumbered P23.16 so numeric and dependency order agree.

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
