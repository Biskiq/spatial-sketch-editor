# R217.S19 — 3D ground clipping (closed)

**AUTHORITY: NONE.** R217.S19 is accepted at tested revision `2096f940` on 2026-10-31 and ships by
the P1 merge of its implementation branch. The [acceptance record](./acceptance.md) owns delivered
behaviour, the owner ruling (plan §3b, 2026-10-31) and evidence; the
[phase slice register](../README.md#slice-register) owns status.

```text
delivered       Stage ground clipping: a camera-core ground-aware far/near range that never enters
                bounds, Fit or pose; an opaque depth-writing mat with a per-pixel ground grid that
                fades from each pixel's own spacing; the visitor plinth is off in the Stage.
contract        docs/reference/design-system/editor-shell-and-visual-system.md (mat grid paragraph,
                updated at the tested revision); the amendment note in
                docs/roadmap/r217-core-editor-stability/post-s10-convergence/target-specification.md
provenance      accepted tested revision 2096f940; acceptance record commit 9efa6641; plan §3b last
                changed at 1f91ad5d; closeout compaction on the same branch; P1 merge recorded in the
                post-merge anchor record.
evidence        Full merge gate at 2096f940 (test:arch, npm test, test:heavy, check, build, kernel
                checks, check:api, test:api:stack, diff --check) and the Stage browser sweep, all in
                the acceptance record. The §3a/§3b sweep pushes 529,200 ground samples.
entry points    implementation packages/camera-core/src/viewport.ts
                apps/editor/src/lib/authoring/stage/camera-session.ts
                apps/editor/src/lib/authoring/stage/stage-grid.ts
                apps/editor/src/lib/authoring/stage/shell/StageMatGround.svelte
                apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts
                apps/editor/src/lib/visitor/VisitorLayoutShell.svelte
                regressions apps/editor/tests/lib/authoring/stage-grid.test.ts
                apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts
residuals       Far-target near stays on the scene-sphere floor (row 5; a content-depth near is proposed
                separately). The grid's constant depth-step offset can let a line show through geometry
                within four depth steps of the datum. Manual rows (coarse pointer, native touch, Safari,
                integrated journeys) stay with S11.
recovery        git show 1f91ad5d7456c15aa603c0a1c4b350c57dec446a:docs/roadmap/r217-core-editor-stability/r217.s19-3d-ground-clipping/implementation-plan.md
                · tag closed/r217.s19
```
