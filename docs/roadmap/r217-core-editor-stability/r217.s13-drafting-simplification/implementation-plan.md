# R217.S13 — Drafting simplification: implementation plan

**Slice:** R217.S13 · **Status:** approved (plan); released by the
[campaign record](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) when PR #230 merges · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** the convergence
integrator · **Architecture owner:** T1 · **Specialist review:** T3: Find entries · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C09b. **Class:** Core regression, plus integration of existing zoom and Fit. Fixes D30, D39, D40, D41, D42 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Snap is one fixed value that zoom never changes. The toolbar is reduced to Grid and Snap words, Paper shows a quiet local sheet, and a minimal ruler and visible zoom and Fit controls replace the Scale control.

## 2. Dependencies

- Owner decisions O7 and O8
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file order, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Drafting](../post-s10-convergence/target-specification.md#drafting-grid-snap-and-ruler).

**Decisions settled here:**

- `stage-drafting.ts` holds the values as named constants: Grid minor 1 m, major 5 m, Snap 0.5 m. `gridIntervalMode`, `gridMinorMeters`, `GRID_MINOR_CHOICES` and `drawnGridMinorMeters` are removed. A later preference has this one seam to extend.
- `draftingSnapIncrementMeters(state)` takes no zoom input and returns 0.5, or `null` when Snap is off or suspended. Height stepping keeps its `?? 0.1` fallback.
- `gridLevelsFor` returns the fixed levels. Each fades from 16 to 8 CSS px spacing and hides below 8. A 25 m level appears only while 5 m is hidden, and hides by the same rule. Then the ruler is the only reference.
- `gridPlanFor` gains an optional Paper content rectangle: union of bounds, plus 5 m, rounded outward to 5 m, intersected with the existing visible coverage so a zoomed-in sheet cannot generate unbounded lines. An empty project uses 20 × 20 m around the target.
- The route extracts the bounds read inside `fit()` so Fit and the Paper sheet share it. S14 adds the live candidate to the same input.
- Zoom buttons call the route's existing `zoom()` with 1/1.25 for in and 1.25 for out, and Fit calls `fit()`. They appear in the World lens in both readings.
- The ruler renders in Plan only. Its length logic stays `roundScaleBarLength`.

**Files:**

- `apps/editor/src/lib/authoring/stage/stage-drafting.ts`
- `apps/editor/src/lib/authoring/stage/stage-grid.ts`
- `apps/editor/src/lib/authoring/stage/stage-measure.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageScaleBar.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageGrid.svelte`
- `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` (Grid interval and Snap items only)
- A new lower-right zoom component beside the Stage shell components
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`
- Snap call sites in `apps/editor/src/lib/authoring/adapters/layout.adapter.ts`, `apps/editor/src/lib/authoring/adapters/scene.adapter.ts` and `apps/editor/src/lib/authoring/adapters/scene/placement.ts`
- Tests: `stage-drafting.test.ts`, `stage-grid.test.ts`, `head-drafting-config.test.ts`, `layout-drawing-adapter.test.ts`, `shape-reading-adapter.test.ts`, `scene-editing-surface.test.ts`, `stage-session.test.ts`

**Rules:**

- Remove the toolbar Scale and interval controls. The ⚙ holds only those settings today, so it leaves with them and returns in R217.S20.
- Scale detents become Find entries through the existing Head Find list, and still use `scaleDetentIntent`.
- The ruler is a 1 px line with 5 px end ticks and its label below, with no fill.
- Exact placement against the Height Sheet is browser calibration; the cluster must never overlap the Sheet, dock or palette.

**Contracts this slice updates at cutover:**

- PLATE's drafting and grid paragraphs in `docs/reference/design-system/editor-shell-and-visual-system.md`, per O7 and O8.
- The Shell coherence wording in [the milestone](../../core-editor-stability.md), which still names `Scale · Grid · Snap`.

## 4. Test cases

- Snap value identical at every zoom and in every consumer: Ink, Place, Move, Measure and Height stepping.
- Line positions unchanged across zoom; each level hides below 8 CSS px; 25 m appears only when 5 m hides.
- The Paper rectangle contains all content plus its margin and never changes the pose.
- Line count stays bounded at maximum zoom-in on a large sheet.
- The ruler stays hidden in 3D.

## 5. Browser acceptance

- Zoom through the full range: no interval flicker, no moiré, crisp sheet edges.
- Draw at two zooms and confirm the points share one lattice.
- The ruler has no fill.
- Fit, zoom and detents are all reachable.
- Grid and Snap words work on both surfaces.
- Compare with the wireframe's 2D capture, and check whether D43 reproduces.

## 6. Exclusions and stop conditions

- 3D clipping, which is R217.S19.
- A preferences panel.

Stop and report if correctness needs a planner, persisted-format, new snap geometry or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
