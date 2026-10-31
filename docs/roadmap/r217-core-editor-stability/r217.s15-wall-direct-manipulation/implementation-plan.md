# R217.S15 — Wall direct manipulation: implementation plan (closed)

**AUTHORITY: NONE.** R217.S15 shipped 2026-10-30. The [acceptance record](./acceptance.md) owns the
delivered contract and evidence; the phase [slice register](../README.md#slice-register) owns status.

```text
delivered       A selected Wall's owner claims a press on its own body. The body slides along its
                normal through the unchanged planRigidWallMove; start and end points move their
                shared Junction through planExactJunctionMove; the free-end ray keeps
                planExactWallLength. Junction, body and length snapping use the fixed 0.5 m value,
                with Alt freeing them during the drag. Typed X/Z on a point and a signed distance on
                the body use the shared numeric lifecycle. Refusals are human words from one map,
                a refused release keeps its reason until the next press, and the Card carries
                Start/End X/Z under one disclosure through the same planner. A curved Wall with no
                straight frame stays Card-only.

contract        post-s10-convergence/target-specification.md#wall-direct-manipulation
                post-s10-convergence/target-specification.md#hit-priority
                docs/reference/architecture.md#editor-interaction-authorities
                docs/reference/design-system/spatial-instrument-grammar.md

provenance      PR #234; independently reviewed CLEAN at d3932ca8; P1 merge.

evidence        apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts
                apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
                apps/editor/tests/lib/authoring/layout-candidate-preview.test.ts
                apps/editor/tests/lib/authoring/layout-card-junction-fields.test.ts
                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                npm test 251 files / 3,233 tests; test:arch 23 / 194; check 0/0;
                build passed.
                Browser: 21 captures at 1440x900, 1280x800, 1180x820 and 820x1180,
                archived under docs/archive/roadmap/r217-core-editor-stability/
                r217.s15-wall-direct-manipulation/evidence/2026-10-30-browser/.

entry points   implementation  apps/editor/src/lib/authoring/adapters/layout.adapter.ts
                                apps/editor/src/lib/authoring/adapters/layout/wall-gesture.ts
                                apps/editor/src/lib/authoring/adapters/layout/precision.ts
                                apps/editor/src/lib/authoring/adapters/layout/snap.ts
                                apps/editor/src/lib/authoring/adapters/layout/refusals.ts
                                apps/editor/src/lib/authoring/adapters/layout/instrument.ts
                                apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte
                                apps/editor/src/lib/authoring/layout/plan-numeric-entry.ts
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                validation      apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts
                                apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts

residuals       Owner Wall-feel check after merge (O2, datum-footprint preview). Coarse pointer,
                native touch, Safari and integrated journeys stay S11's. Opening-over-host selection,
                hovered-Junction drag and Opening body drag are S16; Junction merge, the angle ring
                and height/thickness grips are out of scope.

recovery        git show 78670c68:docs/roadmap/r217-core-editor-stability/r217.s15-wall-direct-manipulation/implementation-plan.md
                · tag closed/r217.s15
```
