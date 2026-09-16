# Current handoff — live working-tree delta

Template per [`../README.md`](../README.md). Sliding window: immediate previous
slice plus one next action only.

## Working tree

- **P23.12 (names and stable display identity) is merged on `main`** through
  PR #55 (`f3efed9`, 2026-09-15): persisted compact-reference ledger
  (`R/W/O/J-####`) in layout-core with provisional-mint/durable-promote/
  exact-restore/pure-read seams and a session high-water mark outside the
  history snapshot; optional Wall/Opening names through
  `planWallMetadataUpdate`/`planOpeningMetadataUpdate`; Navigator, search,
  Inspector and Plan consume one identity vocabulary; the C11 visitor
  isolation checks pass. Follow-up fix PR #56 (`8a5a87f`, anchor drag
  re-derive at release) is also on `main`. HEAD is `c2a2404`, clean and
  synced with `origin/main`.
- **P23.11 (canonical curved Walls) is merged on `main`** through PR #51
  (`9118696`, 2026-09-15): `LayoutWall.centerline` cubic chain, exact curved
  splitting, bend controls and render-safe curve validation. PR #50 (endpoint
  noding) and PR #53 (transient direct-manipulation preview) are merged too.
- The P23.12 design authorities and its implementation-ready child plan landed
  with the slice (docs-only, no code):
  [design context](../design/P23-design-context.md) ·
  [designer brief](../design/P23.12-designer-brief.md) ·
  [final design contract](../design/P23.12-final-design-contract.md) ·
  [P23.12 plan](../plans/2026-09-15-P23.12-names-and-stable-display-identity.md).
  The plan ratifies the compact-reference mechanism (persisted identity ledger
  allocated from a cursor, with a **monotone high-water mark held outside the
  history snapshot** — a canonical-ID derivative is rejected because the authoring
  allocators recycle canonical IDs) and records the code-verified starting point,
  eleven design-vs-code conflicts with their smallest resolutions, and eight
  dependency-ordered slices. Owner review (2026-09-15) approved the direction and
  required five changes — the monotone-mark resolution for Undo branching, the
  visitor criterion as code/consumption rather than data-absence, the optional
  Navigator context line, the optional-name clear patch locked as `name: null`, and
  dropping Layout object Inspector unification. A follow-up review then required
  **transient/rejected/cancelled derivation to consume no allocation** (and the
  next committed reference to be independent of pointermove history), one
  durable-vs-transient rule at the shared seams, and cursor-consistency validation:
  the plan now classifies every seam as durable-promote / provisional / exact-restore
  / pure-read, **deletes the restore-seam cursor clamp**, promotes only at the five
  `commitLayoutTransaction(capture…)` sites plus the **three persistence seams**
  (before the payload is built), and validates the persisted cursor against every
  live ledger token. A third round then fixed four pre-implementation defects: the
  allocation base is **latched per operation** as
  `max(baseline.cursor, identityHighWater)` so `create A → Undo → create B` cannot
  hand A's reference to B, promotion is **nondecreasing** in the mark (including
  commits that mint nothing), Save/export therefore always serialize a cursor ≥ the
  mark, cancelled **assignments** (not token values) are what must never leak, the
  seam check is scoped per function, pre-gesture captures are pure reads, and the
  Navigator keeps Opening kind/shared-Wall participation **visible** with the pinned
  strip showing **name + complete reference**. A fourth round closed the remaining
  persistence seams: the Layout **Copy JSON / Download JSON** commands in
  `EditorProjectMenu.svelte` (`copyLayoutJson` ~196, `downloadLayoutJson` ~211)
  serialize the live layout directly and bypass `captureValidatedSaveSnapshot`, so
  promotion now precedes them too; and the **resumed save** (`resumePendingCloudSave`
  ~1380) must submit the installed, promoted snapshot rather than hand-building
  `{ project: pending.project, … }` (~1443), so its `layout` and
  `layoutCanonicalJson` cannot disagree. The plan's allocation rule was then
  implemented as ratified, closing S1's gate; see the Working tree entry above.
- [The P23 remaining-roadmap reconciliation](../plans/2026-09-14-P23-remaining-roadmap-reconciliation.md)
  remains the remaining-scope authority for P23.13–P23.16. P23.13 evidence on
  the tree: [precedent research](../Deep-research/P23-Staging-Research/P23.13-architectural-plan-drafting-precedent-research.md)
  plus the door-swing deferral note in the roadmap; no P23.13 child plan is
  implementation-ready yet.

## Next action

- Open P23.13 (Architectural Plan drafting finish): reconcile an
  implementation-ready child plan against the landed baseline (P23.11 curves,
  P23.12 identity, PR #56 anchor release) using the precedent research and the
  roadmap's door-swing deferral note — no P23.13 code until that child plan is
  ratified. Remaining sequence after it: P23.14 → P23.15 → P23.16 final closeout.

## Verification

- `main` at `c2a2404` carries the merged P23.12 implementation (PR #55) plus
  the PR #56 anchor-release fix (see Working tree above); the numbers below are
  the last full runs reported on the P23.12 branch / its PRs.
- Supplied-layout regressions: 3 passed; focused curved/oblique Layout suites:
  28 passed. `npm run check:layout-core` and `npm run check` passed.
- **P23.12 branch verification (2026-09-15):** `check:layout-core`,
  `check:project-model` and the editor `check` clean; full editor suite
  **3,930 passed / 1 skipped**; new suites — `p23-12-identity` (18),
  `p23-12-lifecycle` + `p23-12-undo-branch`, `p23-12-transient-allocation`
  (61), `p23-12-names` (68), `p23-12-lifecycle-semantics` (65),
  `p23-12-navigator-identity` (66), `p23-12-inspector-identity`,
  `p23-12-plan-identity`, and the C11 visitor isolation checks.
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
- The “canonical **268 px** Navigator rail” figure in planning docs has no code
  constant; the shipped rail is `minmax(15rem, --editor-left-width: 300px)`
  (240–300 px). Design to that range and treat `268` as stale.
- Earlier tracker/hand-off text said “P23.11 is next” and “PR #50 awaiting
  review”; both are superseded — P23.11 is merged (PR #51), P23.12 is merged
  (PR #55 + #56 fix), and P23.13 is the next slice.
- The P23.12 plan's earlier restore-seam cursor clamp is **deleted, not deferred**: a
  clamp there lets a cancelled/rejected pointermove candidate permanently consume
  reference allocations. Monotonicity now lives in the preview state's
  high-water mark, which is *not* part of `LayoutPreviewSnapshot`; do not
  reintroduce a clamp in `restoreLayoutPreviewSnapshotUnmeasured`, and do not call
  `promoteLayoutIdentity` from a transient path (C6/C10/D1 rule T1–T6).
- Three P23.12 persistence traps: (i) `markLayoutPreviewSaved` runs **after**
  `projectApi.saveProject` (`EditorApp.svelte` ~1266/~1273), so it cannot be the
  promotion seam — promote before `captureValidatedSaveSnapshot()` (~1205);
  (ii) `copyLayoutJson`/`downloadLayoutJson` in `EditorProjectMenu.svelte`
  (~196/~211) are the real Layout export paths and never pass through the save
  seam; (iii) `resumePendingCloudSave()` (~1443) submits the pending payload while
  promotion acts on `layoutPreview.project.layout` — it must submit the installed,
  promoted snapshot so `layout` and `layoutCanonicalJson` agree. And allocation
  must read `max(document cursor, identityHighWater)` **latched at operation
  start**, never the live document cursor alone: after Undo that cursor is rewound
  and would reissue a retired reference.
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
