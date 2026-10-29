# R217.S04 — Paper Plan: implementation plan

**Slice:** R217.S04 · **Status:** approved (plan); not released · **Phase:** [R217](../README.md) ·
[slice register](../README.md#slice-register) · **Writer:** T1 · **Reviewers:** T2 (object
symbols), T5 (form symbols) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

Makes Plan a drawing: Paper, drawn from Layout's Plan representation and Scene footprints, picked
from the same evaluation.

## Prerequisite

R217.S03 is accepted, so Plan picking runs through the coordinator.

## Scope

1. **Paper reading.** In 2D the Stage draws on vellum, from the retained `evaluateLayoutPlan`
   result:
   - cut Walls as poché;
   - projected edges;
   - hidden edges, dashed;
   - Opening symbols.

   Scene objects and native forms are drawn as footprint outlines from their owners' footprint
   functions. A footprint function moves to its package only under S01's moving rule.
2. **One Canvas, one projection.** The linework is batched fat-line and fill geometry inside
   `StageCanvas.svelte`, drawn through the one `ViewportEvaluation`. It uses no SVG overlay and no
   second renderer, and it is editor-only: no visitor-chunk import.
3. **Drawn equals picked.** The Plan pick providers resolve against the same fragments and footprints
   that are drawn. The coordinator's Plan draw order becomes the Paper layer order: Openings and
   object symbols above cut Walls, cut Walls above projected and hidden geometry, and Rooms at the
   bottom. Within a domain, the domain's own ranking still applies.
4. **3D on the mat.** 3D uses the mat ground and calibrated lighting. Fog and the `0x111117` ground
   are retired.
5. **Shaded Plan** is the app-menu viewing preference (S02's store). **Paper is the default.**
   Picking is identical under both.
6. **Continuity.** The reading flip keeps PLATE's rules:
   - tilt about the target, with scale kept;
   - in 2D, a 90° azimuth detent;
   - back in 3D, the last working elevation;
   - no refit and no retarget;
   - selection, Card, Index, armed tool, open work, grid and snap survive.

## Not in scope

The grid and drafting words (S05), the Height Sheet (S06), selection colour (S07, which draws gold
ink on Paper), Section, Face, Unroll and elevations.

## Shared-file claims

`StageCanvas.svelte`, the Plan pick provider and `plan-parameters.ts`; `plan-scene-footprint.ts`
under T2 review.

## Acceptance criteria

1. **Drawn equals picked:** on the starter, an L fixture and a forms fixture, every pickable Plan fragment and footprint has drawn geometry. Nothing selectable is undrawn, and nothing drawn is pickable unless it is selectable or symbolic.
2. **Streams:** each stream has its specified treatment, and a seeded Wall below the cut appears as projected, not cut.
3. **Appearance:**
   - the shaded preference changes appearance only;
   - the pick differential under Paper and shaded is empty;
   - Paper is the default on a fresh browser.
4. **Continuity:** assertions hold across 2D → 3D → 2D, with the armed tool, selection and open Ink chain intact.
5. **Boundaries:** the visitor and public boundary tests are green, and no new module enters a `/p` chunk.
6. **Bundle:** the Stage bundle delta is reported. No new budget is claimed.

## Verification

Affected Stage and Layout representation contracts and the heavy Plan representation contract; the
boundary arch tests; then the complete merge gate in the
[test contract](../../../../apps/editor/tests/README.md#what-a-change-requires).
