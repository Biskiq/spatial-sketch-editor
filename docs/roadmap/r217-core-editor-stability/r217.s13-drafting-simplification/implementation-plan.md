# R217.S13 — Drafting simplification: implementation plan

**Slice:** R217.S13 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T3 · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: affected-subsystem
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Planning label C09b. Fixes D30, D39, D40, D41, D42 in the [drift register](../post-s10-convergence/drift-register.md).

## 1. Outcome

Snap is one fixed value that zoom never changes. The toolbar is reduced to Grid and Snap words, Paper shows a quiet local sheet, and a minimal ruler and visible zoom and Fit controls replace the Scale control.

## 2. Dependencies

- Owner decisions O7 and O8
- Every consumed gate and required scope rechecked at this slice's trusted base.
- The [rules for every slice](../post-s10-convergence/execution-plan.md#rules-for-every-slice) apply: shared-file claims, browser widths, the interaction journey, rollback and contract edits.

## 3. Scope

**Behaviour:** [Drafting](../post-s10-convergence/target-specification.md#drafting-grid-snap-and-ruler).

**Files:**

- `apps/editor/src/lib/authoring/stage/stage-drafting.ts`
- `apps/editor/src/lib/authoring/stage/stage-grid.ts`
- `apps/editor/src/lib/authoring/stage/stage-measure.ts`
- `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageScaleBar.svelte`
- `apps/editor/src/lib/authoring/stage/shell/StageGrid.svelte`
- `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` (viewing menu)
- The spatial route, and the Scene and Layout snap call sites
- Tests: `stage-drafting.test.ts`, `stage-grid.test.ts`, `head-drafting-config.test.ts`, `layout-drawing-adapter.test.ts`, `shape-reading-adapter.test.ts`, `scene-editing-surface.test.ts`, `stage-session.test.ts`

**Rules:**

- `draftingSnapIncrementMeters` stops taking a zoom-derived level. Every consumer reads the fixed value through that one seam.
- `gridLevelsFor` returns fixed levels with thinning, and `gridPlanFor` gains the bounded Paper rectangle from content bounds. The mat branch keeps its coverage.
- Remove the toolbar interval and Scale controls. The ⚙ holds only interval and snap settings today, so it leaves with them and returns in R217.S20.
- Add Find entries for Scale detents, and the lower-right zoom and Fit cluster.
- The ruler replaces the filled badge and shows in Plan only.

**Contracts this slice updates at cutover:**

- PLATE's drafting and grid paragraphs in `docs/reference/design-system/editor-shell-and-visual-system.md`, per O7 and O8.
- The Shell coherence wording in [the milestone](../../core-editor-stability.md), which still names `Scale · Grid · Snap`.

## 4. Test cases

- Snap value identical at every zoom and in every consumer: Ink, Place, Move, Measure and Height stepping.
- Line positions unchanged across zoom; each level hides below 8 CSS px; 25 m appears only when 5 m hides.
- The Paper rectangle contains all content plus its margin, grows for a candidate and never changes the pose.
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

Stop and report if correctness needs a planner, persisted-format or Camera-authority change this plan does not name, or a decision the [owner rulings](../post-s10-convergence/owner-decisions.md) do not cover. The [Plan authoring audit](../post-s10-convergence/plan-authoring-audit.md) has the evidence behind this scope.
