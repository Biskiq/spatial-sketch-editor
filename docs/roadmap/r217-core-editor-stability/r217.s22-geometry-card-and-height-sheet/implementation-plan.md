# R217.S22 — Geometry, Card and Height Sheet (closed)

**AUTHORITY: NONE.** R217.S22 is accepted at tested revision `fb57a662` on 2026-11-01 and ships by the
P1 merge of PR #252. The [acceptance record](./acceptance.md) owns the delivered behaviour, the evidence and
the anchors; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       The shell publishes its measured lanes (lower column, Height Sheet lane, zoom cluster) on the
                Stage frame; `.reserved-height` is gone and the lane observers submit no Camera intent. The
                Height Sheet is a thin line with a knob and semantic ticks on its own pale plate in forest ink;
                the value and tick names show on focus, drag, touch and hover. The pin hint shows on the first
                pin of each Stage session and clears itself (TD-15 fixed). The Card clears the measured lanes,
                fades to 0.2 opacity with no pointer events during an authored gesture, and sets its fold once
                when a task opens. The plain empty-click notice is removed; the excluded-subjects reason stays.
contract        docs/reference/design-system/editor-shell-and-visual-system.md (Height Sheet, Card and Stage
                lanes); the behaviour and the drift reconciled at cutover: docs/roadmap/r217-core-editor-stability/post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive
provenance      accepted tested revision fb57a662 (code 7f4865c5 and fb57a662, from main 3eaafbb9); implementation
                PR #252; plan last changed at 050a30d9 (reachable on main); closeout on the same branch; the P1
                merge is recorded in the post-merge anchor record.
evidence        Gates at fb57a662 (check, the four kernel checks on 7f4865c5, test:arch, npm test, test:heavy, build,
                git diff --check), the browser matrix at four widths, the edit under the Card, the Sheet's pins and
                keys, the light-ground contrast, the coarse-pointer pass and the keyboard walks, all in the
                acceptance record.
entry points    implementation apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte
                                apps/editor/src/lib/authoring/stage/shell/StageHeightSheet.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/authoring/stage-shell-composition.test.ts
                                apps/editor/tests/lib/authoring/stage-height-sheet.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                                apps/editor/tests/lib/authoring/fixtures/HeightSheetProbe.svelte
residuals       The expanded Card overflows its max-height at 1440×900 (every control reachable by scrolling). The
                plinth top and the 0.75 m ticks await S11 J4. Focus after Cancel on a destructive Card confirmation
                is TD-17. Native touch and Safari stay with S11.
recovery        git show 050a30d9:docs/roadmap/r217-core-editor-stability/r217.s22-geometry-card-and-height-sheet/implementation-plan.md
                · tag closed/r217.s22
