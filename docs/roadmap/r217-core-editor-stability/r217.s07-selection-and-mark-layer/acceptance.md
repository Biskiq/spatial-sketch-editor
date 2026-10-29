# R217.S07 — closed-work acceptance stub

**AUTHORITY: NONE.** S07 gives Stage one selection, hover and mark layer: a gold identity contour
with the 0.18 tint on the mat, a gold union-boundary re-stroke over Paper, a neutral hover below
selection, and one host-drawn mark vocabulary fed by domain descriptors. The phase
[slice register](../README.md#slice-register) owns status; the current interaction, selection and
mark contract is owned by
[architecture.md](../../../reference/architecture.md#editor-interaction-authorities).

- **Accepted:** 2026-10-29 by owner closeout direction. One dedicated cross-domain review covered
  the pre-integration tree; a second, combined review covered the S04-merged tree. Both raised only
  P2 lifecycle, ordering and record findings — all fixed and pinned before acceptance. The owner's
  rulings recorded here (remove the Wall angle ring, keep the compact free-end length ray and the
  two-way base move ray, accept screen-calibrated marks, keep edge-on withholding, defer height and
  thickness grips, keep the 0.18 tint) supersede the plan where they differ. Tested revision
  `183cad90`; accepted body `c5aa694f`. No GitHub approval was recorded. The authorization covers
  S07 only and did not add a release-list row.
- **Delivered:** Wall marks are two end points, a length ray anchored at the free endpoint and a
  two-way base move ray — no angle ring, since the angle is not in the ratified Wall vocabulary and
  Angle remains the Card's `layout-wall-angle` writer. An Opening keeps its position track and one
  free-edge width ray. Every mark submits the same planner and refusal as its Card field and makes
  one history entry per release; digits at a live gesture reuse the Card's numeric entry (Enter
  commits once, first Esc restores, second cancels, blur never commits). Disclosure marks write
  nothing, enter no history and reset on a selection or lens change, with Esc closing the
  disclosure before clearing selection. Marks are screen-calibrated (30 px ray, ±16 px two-way
  arms, 22 px fine / 44 px coarse hit areas) while `extent` stays the mark's world reach; an
  edge-on ray or ring is withheld. Paper selection/hover filters S04's own `buildPaperPlan` by
  canonical subject or entity id: a filled subject re-strokes its union boundary, non-cut lines
  remain, and no per-span tick appears. Marks sit on layer 2, are depth-test-free and order above
  Paper's drawing; 3D ink skips meshes with a hidden ancestor and draws selection above hover.
  Removed: `selectionMarker`, the `layout-wall-start` / `layout-wall-end` / `layout-wall-body`
  overlay ids and the shift-drag angle mode.
- **Verification:** at tested revision `183cad90` (clean tree): `apps/editor npm run test:arch` —
  23 files / 193 tests; `apps/editor npm run test:full` — 241 files / 3,057 tests; repo-root
  `npm run build:editor` — success. Focused `npx vitest run tests/lib/authoring` — 689 passed
  across 59 files; `npm run check` — 0 errors / 0 warnings. Playwright at 1280 × 900 covered 3D and
  Paper selection and hover, a selected Room, a 3D → Paper flip, numeric entry with two Escapes and
  Undo still disabled, and the Wall mark set (`start`, `end`, `move`, `length`; no `angle`), with
  the 30 px ray and ±16 px arms measured; no console or page errors. The archived captures below
  are that visual record; no automated screenshot diff was added.
- **Contract and entry points:** contract in
  [`architecture.md`](../../../reference/architecture.md#editor-interaction-authorities); implementation
  `apps/editor/src/lib/authoring/stage/stage-handles.ts`,
  `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte`,
  `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte`,
  `apps/editor/src/lib/authoring/stage/paper-marks.ts`,
  `apps/editor/src/lib/authoring/stage/stage-facade.ts`,
  `apps/editor/src/lib/authoring/scene/scene-pick-source.ts`,
  `apps/editor/src/lib/authoring/adapters/layout.adapter.ts`,
  `apps/editor/src/lib/authoring/adapters/layout/wall-gesture.ts`,
  `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; regressions
  `apps/editor/tests/lib/authoring/stage-handles.test.ts`,
  `apps/editor/tests/lib/authoring/paper-marks.test.ts`,
  `apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts`,
  `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`,
  `apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`.
- **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md) owns the phase's
  integrated final gate and full-tree result.
- **Residuals:** Wall height and thickness grips are deferred by owner ruling; thickness is a
  top-level Card field and grouping it under More is Card work outside S07. Two agreed as-built
  departures — PLATE gold Paper selection ink instead of the plan's `#74560c`, and one free-edge
  Opening width ray instead of two — are kept for post-S10 convergence. S11 retains the integrated
  gate.
- **Evidence:** [archived captures and manifest](../../../archive/roadmap/r217-core-editor-stability/r217.s07-selection-and-mark-layer/evidence/CLOSED.md).
- **Preservation:**

  ```text
  CLOSEOUT PRESERVATION — R217.S07 (2026-10-29)
  prose compacted:                 2   stubs at their own paths
  reference promotions:            1   selection and mark host contract in docs/reference/architecture.md
  renderable evidence archived:    10 files / 1,806,520 bytes
  evidence stubs / manifests:      1   evidence/CLOSED.md
  transient artifacts removed:     0
  historical anchor:               c5aa694fe8c0d283c3b59ac8b14c0a404d95dc52 · tag closed/r217.s07 (local only — not pushed)
  merge method:                    P1 GitHub merge commit (PR #224); post-merge anchor verification owed
  new live → archive prose links:  0
  manual-owed verification rows:   0
  remaining deferred items:        4   Wall height grip · Wall thickness grip and Card More grouping · post-S10 UX convergence (Plan ink, Opening width) · S11 integrated gate
  permanent stubs added:           2
  ```

- **Recovery:**
  `git show c5aa694fe8c0d283c3b59ac8b14c0a404d95dc52:docs/roadmap/r217-core-editor-stability/r217.s07-selection-and-mark-layer/acceptance.md`
  · tag `closed/r217.s07`.
