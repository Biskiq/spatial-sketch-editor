# R217.S13 — Drafting simplification: implementation plan (closed)

**AUTHORITY: NONE.** R217.S13 shipped 2026-10-30. The [acceptance record](./acceptance.md) owns the
delivered contract and evidence; the phase [slice register](../README.md#slice-register) owns status.

```text
delivered       Fixed 1 m minor / 5 m major Grid and 0.5 m Snap; no zoom-driven interval.
                Bounded Paper sheet from Layout ∪ Scene bounds; Plan ruler; lower-right zoom/Fit.
                Scale detents moved to Head Find; Scale word, interval menu and ⚙ removed.

contract        post-s10-convergence/target-specification.md#drafting-grid-snap-and-ruler
                and PLATE's Drafting state / Grid and wall sheet paragraphs.

provenance      PR #232; independently reviewed CLEAN at 71c058e0; P1 merge.

evidence        apps/editor/tests/lib/authoring/stage-drafting.test.ts
                apps/editor/tests/lib/authoring/stage-grid.test.ts
                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                npm test 248 files / 3,189 tests; test:arch 23 / 194; check 0/0.
                Browser: 14 captures at 1440x900, 1280x800, 1180x820 and 820x1180,
                archived under docs/archive/roadmap/r217-core-editor-stability/
                r217.s13-drafting-simplification/evidence/2026-10-30-browser/.

entry points   implementation  apps/editor/src/lib/authoring/stage/stage-drafting.ts
                                apps/editor/src/lib/authoring/stage/stage-grid.ts
                                apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte
                                apps/editor/src/lib/authoring/stage/shell/StageScaleBar.svelte
                                apps/editor/src/lib/authoring/stage/shell/StageZoomControls.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                validation      apps/editor/tests/lib/authoring/stage-drafting.test.ts
                                apps/editor/tests/lib/authoring/stage-grid.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                regressions     apps/editor/tests/lib/authoring/stage-session.test.ts
                                apps/editor/tests/lib/authoring/layout-drawing-adapter.test.ts
                                apps/editor/tests/lib/authoring/scene-editing-surface.test.ts
                                apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts

residuals       None for this slice. 3D clipping is R217.S19; integrated journeys are R217.S11.

recovery        git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s13-drafting-simplification/implementation-plan.md
                · tag closed/r217.s13
```
