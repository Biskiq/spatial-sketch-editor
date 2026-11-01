# R217.S18 — Selection ink (closed)

**AUTHORITY: NONE.** R217.S18 is accepted at implementation revision `f92e1211` on 2026-10-31 and
ships by the P1 merge of its implementation branch. The [acceptance record](./acceptance.md) owns
delivered behaviour and evidence; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       Scene subjects on Paper carry a selection fill from the footprint polygons the Scene
                already retains, unioned so overlapping projected faces are not blended twice; the contour uses the #74560c Paper edge.
contract        docs/reference/design-system/spatial-instrument-grammar.md (unchanged: the plan named no 0.18 value)
provenance      accepted implementation revision f92e1211; acceptance record commit 16349573; closeout compaction on the same branch; P1 merge recorded in the post-merge anchor record.
evidence        Full §7.4 gate (test:arch, npm test, test:heavy, check, build, kernel checks, check:api, test:api with 0 skips) and the mixed-fixture Plan/3D browser matrix, all in the acceptance record.
entry points    implementation apps/editor/src/lib/authoring/stage/paper-fill-geometry.ts; apps/editor/src/lib/authoring/stage/paper-marks.ts; apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte
                regressions apps/editor/tests/lib/authoring/paper-marks.test.ts; apps/editor/tests/lib/authoring/stage-handles.test.ts
residuals       Pinch-point case falls back to raw polygons (owner T1); S11 integrated journeys and manual-owed coarse pointer, native touch and Safari rows; StageOverlay's 0.18 pick-candidate fill is pick UI and excluded by the plan.
recovery        git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s18-selection-ink/implementation-plan.md
                · tag closed/r217.s18
```
