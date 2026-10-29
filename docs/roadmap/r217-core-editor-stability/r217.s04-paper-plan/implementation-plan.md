# R217.S04 — Paper Plan: implementation plan

**Slice:** R217.S04 · **Status:** approved (plan); awaits an owner release-list row · **Phase:**
[R217](../README.md) · [slice register](../README.md#slice-register) · **Writer:** T1 ·
**Reviewers:** T2 (object symbols), T5 (form symbols), T3 (reading transition) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../r217.s11-integrated-final-gate/implementation-plan.md
```

## 1. Outcome

In 2D the creator sees an architectural drawing on Paper:

- cut Walls in poché;
- what lies below the cut, drawn as projected;
- hidden edges, dashed;
- Opening symbols and object outlines.

Clicking a line selects exactly the thing the line belongs to. 3D sits on the dark mat. Shaded Plan
remains available as a viewing preference.

## 2. Why this is the smallest sensible slice

- **Layout data:** the Plan representation already exists and is already evaluated for picking
  (`evaluateLayoutPlan` → `PlanStreams` with `cut`, `projected`, `hidden` and `symbol`; geometry
  `span`, `polyline` and `polygon`).
- **Scene data:** object footprints already exist (`buildPlanSceneFootprintProjection` in
  `apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts`; kinds model, primitive and form,
  with per-entity `presentation`).
- **So:** this slice draws data the Stage already computes. It adds no evaluator, no second
  projection and no Camera change.

**Deferred:**
- the grid and drafting words (S05) and the Height Sheet (S06);
- selection ink and hover on Paper (S07);
- Section, Face, Unroll and elevations;
- dimension annotations.

## 3. Dependencies

- R217.S03 accepted: the Plan candidates come from the resolver, and this slice supplies their
  `planLayer`.
- R217.S02 accepted: the Paper | Shaded preference lives in its app preference store.
- **Claims:** `StageCanvas.svelte`, a new Paper layer component, the Layout Plan pick provider and
  the Scene footprint call site (T2-reviewed patch).

## 4. Design

### 4.1 When Paper draws

- The Paper layer is visible when `evaluation.renderedReading === 'plan'`,
  `evaluation.orthographicWeight === 1` and the preference is **Paper (default)**.
- While Paper is visible, the 3D Layout and Scene meshes are **not drawn but remain pickable**.
  The details are in §4.1.1.
- During the projective transition the 3D meshes draw on the mat. On settling at `w = 1`, Paper
  fades in over 150 ms; with Reduce motion on, it switches instantly.
- With **Shaded** chosen, 2D keeps today's mesh rendering. The semantic pick inputs are identical
  in both appearances (§4.1.1), so the winners are too.

#### 4.1.1 Appearance is a render mask, never pick eligibility

Scene's Plan pick reads the mounted meshes. `ScenePickSource.pick` raycasts the registered entity
and Layout roots, and **skips any hit under an ancestor with `visible === false`**
(`apps/editor/src/lib/authoring/scene/scene-pick-source.ts`). Scene's `pick` (S03) uses that
raycast twice in Plan: to know which entity is under the pointer, and for the edge-halo probe that
stops a footprint selecting a hidden or unmounted body. Hiding meshes with `visible = false` would
therefore make every Paper object symbol unpickable. The rules:

- **`Object3D.visible` keeps one meaning:** mounted and eligible to be hit. No appearance code
  writes it.
- **Appearance uses Three's camera layer mask:**
  - world meshes (Layout shell, Scene entities, ghosts) stay on the default layer 0;
  - the Paper layer, and every later Stage overlay drawn in the Canvas (S05 grids, S06 Sheet plane, S07 selection and hover outlines), go on a dedicated **Stage overlay layer**, 2;
  - `StageCamera.svelte`, the realizer, sets `camera.layers` to {0} in 3D and Shaded Plan, to {2} while Paper is visible, and to {0, 2} where both draw.
- **Raycasting is unaffected.** The pick source's `Raycaster` keeps its default layer mask {0},
  so it still hits world meshes while they are undrawn, and never hits overlay geometry.
- **Overlay geometry is never parented** under a registered pick root, so a recursive raycast
  cannot reach it.
- **Support occlusion is unaffected.** It uses analytic boxes and evaluated forms, not meshes.

### 4.2 The Paper layer

A new `StagePaper.svelte` in `apps/editor/src/lib/authoring/stage/shell/`, mounted inside the one
`<Canvas>`. It is editor-only and is never imported by `visitor/*`.

- **Inputs:** the facade's retained `PlanEvaluation` (the same object the pick provider uses) and
  the Scene footprint projection. Both are memoized on their generation ids.
- **Geometry:** fat lines from `three/examples/jsm/lines` (`LineSegments2`, `LineMaterial`), part of
  the existing `three` dependency, so no new package. Polygon fills use `ShapeGeometry`. The lines
  are batched into one geometry per stream and treatment.
- **Placement:** drawn on the datum plane, with `depthTest: false` and `renderOrder` by layer, so
  draw order is the layer order below.

| Layer (`planLayer`) | Source | Treatment (PLATE §Semantic color) |
| --- | --- | --- |
| 60 | Scene footprints (model, primitive, form) | Outline 1.25 px, ink `#1b201c`; no fill |
| 50 | `symbol` (Opening symbols) | 1 px ink; swing arcs as polylines |
| 40 | `cut` polygons (Walls at the cut) | Poché fill `#1b201c` with a 1.5 px ink edge |
| 30 | `projected` | 1 px ink at 0.7 opacity |
| 20 | `hidden` | 1 px dashed ink at 0.45 opacity |
| 10 | `room-floor` fragments | Paper tint `#e9ebe6`, no edge |

- **Paper ground:** vellum `#e9ebe6`, with a 1 CSS px inset perimeter that intercepts no picking.
- **Line widths** are in CSS px, so they hold constant across zoom.
- **Only eligible fragments are drawn.** The evaluator's placements already exclude ineligible
  sources, and a revealed source is drawn with its stream treatment.

### 4.3 Drawn equals picked

- The Layout pick provider (S03) and `StagePaper` read the **same** `PlanEvaluation` instance and
  the same footprint projection. The provider reports each candidate's `planLayer` from the table
  above.
- Scene footprints keep their existing Plan hit test and edge-halo probe. Only the layer rank is
  new.
- A footprint whose entity is hidden or unmounted is neither drawn nor pickable. Today's halo-probe
  rule already enforces the second half; the Paper layer applies the same filter.

### 4.4 3D on the mat

- In 3D, `StageCanvas.svelte`'s background becomes the mat background `#152C26`, with a mat ground
  `#1D3A33` at the datum.
- `<T.Fog>` is removed.
- Lights are unchanged. Visitor rendering (`VisitorLayoutShell`) is not modified.

### 4.5 Continuity

The reading flip keeps PLATE's [2D | 3D continuity](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination):

- the Camera tilts about the current target with scale kept;
- 2D settles azimuth to the nearest 90° detent;
- 3D returns to the last working elevation;
- there is no refit or retarget;
- selection, Card, Index, armed tool, open work, history, grid and snap survive.

The Camera seam (`ViewingIntent` `set-reading`) already provides the motion. This slice adds
tests and fixes only an observed violation, which must not be a Camera change.

## 5. Tests and acceptance criteria

1. **Drawn equals picked** (a new `stage-paper.test.ts` in `apps/editor/tests/lib/authoring/`). On
   the starter, the L fixture and the forms fixture:
   - every fragment the provider can return is in the Paper layer's drawn set, and every footprint it can return likewise;
   - every drawn item is either pickable or a non-selectable symbol;
   - the comparison is by source id and stream.
2. **Stream treatment.** A Wall whose top is below the cut height draws in `projected`, not `cut`.
   A seeded hidden fragment draws dashed. A revealed source draws.
3. **Picking under both appearances, with real meshes** (a new `stage-paper-pick.test.ts` in
   `apps/editor/tests/lib/authoring/`). The test mounts the actual Layout and Scene roots in a
   Three scene graph registered with `createScenePickSource`, and runs `resolveStagePick` (S03).
   On the forms fixture, under both the Paper mask and the Shaded mask:
   - a pick at each footprint's interior and at its edge-halo band resolves to its entity;
   - a footprint whose body is unmounted, or occluded below a support, resolves to nothing;
   - the Wall/Opening regression from S03 resolves as before;
   - the result sets under Paper and Shaded are identical.

   A structural check finds no write to `.visible` in Paper or appearance code. A fresh browser
   defaults to Paper.
4. **Continuity.** Across 2D → 3D → 2D: the target and `targetPlaneMetersPerCssPixel` are equal,
   the 2D azimuth is a multiple of 90°, and the 3D elevation equals the last working elevation. A
   selected Wall, the armed Ink tool and an open Ink chain survive.
5. **3D ground.** In 3D there is no fog, and the mat colours are set. Visitor render tests are
   unchanged.
6. **Boundaries.** The visitor, public and preview boundary tests are green, and `StagePaper` is not
   in any `/p` chunk.
7. **Bundle.** The Stage route's br size delta is reported in the acceptance record. No new budget is
   claimed.

## 6. Reviews and stop conditions

- **Reviews:** T2 for footprint drawing and filters; T5 for form footprints (tilted forms use the
  existing `polygons` union); T3 for the reading transition.
- **Stop and report if:**
  - a fragment cannot be drawn without changing the Plan evaluator, since that is a T1
    representation change needing its own review;
  - Paper and picking cannot share one evaluation instance;
  - a render-mask approach would change visitor rendering, since the visitor never uses layer 2;
  - a continuity rule fails inside Camera code.

## 7. Handoff

S05 lays the grid on Paper and the mat. S06 drives the cut height that this layer draws. S07 re-strokes
the selected source's fragments in gold ink and draws hover.
