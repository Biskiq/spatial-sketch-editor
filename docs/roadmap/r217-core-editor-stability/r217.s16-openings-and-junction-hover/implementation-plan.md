# R217.S16 — Openings and Junction hover (closed)

**AUTHORITY: NONE.** R217.S16 shipped 2026-10-31. The [acceptance stub](./acceptance.md) owns delivered behavior and evidence; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       Plan-only Opening-over-host selection, Opening slide/resize, and Plan-only Junction hover/drag.
contract        docs/reference/architecture.md#editor-interaction-authorities
provenance      PR #237; accepted revision 0a32f53e086d13477e85e581bdfdcd727753c751; owner-override for no second review after bounded repair.
evidence        Full declared affected-subsystem tier and complete merge-gate evidence are recorded at the acceptance stub. S11 owns integrated and manual-owed rows.
entry points    implementation apps/editor/src/lib/authoring/adapters/layout.adapter.ts; apps/editor/src/lib/authoring/layout/plan-pick-provider.ts; apps/editor/src/lib/authoring/stage/stage-facade.ts; apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts; apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts; apps/editor/tests/lib/authoring/stage-facade.test.ts; apps/editor/tests/lib/authoring/stage-host-tools.test.ts; apps/editor/tests/lib/layout/t1s06-persistent-pipeline.test.ts
residuals       S11 integrated journeys; door swing and 3D Junction hover are outside scope.
recovery        git show 050a30d9418a9a910a320388ae2ea4d879f1b34c:docs/roadmap/r217-core-editor-stability/r217.s16-openings-and-junction-hover/implementation-plan.md
                · tag closed/r217.s16
```
