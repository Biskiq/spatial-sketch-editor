# T5.P01 — Drawn native objects

**Phase:** T5.P01 · **Status:** registered by the T5 planning PR on the owner's merge
([record](../../../reference/decisions/t5-object-focus-planning-2026-10-27.md)). Merging releases
nothing: released scopes and their conditions are the [release list](../../now.md), and the
[production hold](../../README.md#production-implementation-hold) covers every scope that list
omits · **Track:** [T5](../README.md) · **Direction:** [umbrella plan](../umbrella-plan.md) ·
**Runbook:** [T5 operations](../../../operations/t5-expressive-geometry/README.md)

## Outcome

A creator draws a closed outline with Ink in World — on the floor or on an upright sheet, and on a
Wall face once T1's face-frame query exists — reads it as a **Shape**, pulls its depth and creates a
native object. They place, turn and size it per axis, see it identically in Plan, 3D and Preview,
and keep it exactly through Undo, Redo, Save and cold reopen. They save it to **My Objects**, open
another project, insert an editable copy and refine it independently. A native object is a Scene
entity whose shape is authored source, evaluated deterministically by a runtime-safe kernel; nothing
generated is saved.

This phase builds the source, kernel and creation path that Object Focus
([umbrella plan §6.3](../umbrella-plan.md#63-t5p02--object-focus-refine-and-shape-planned)) refines.
It does not add Focus, sections, shaping, cutting, combination, anchors, shared definitions, shared
library instances or publication.

## Starting evidence

- The four native primitives are fixed shapes with no source beyond their dimensions
  (`packages/project-model/src/scene.ts`). Scene unit format 3 is the landed encoding.
- Scene planners already plan from captured inputs under per-planner record scope, and F4 unit
  acceptance gives one history entry per accepted result with conditional Save.
- The shared Scene renderer draws Stage and Preview from the same entities; Plan footprints and hits
  come from `plan-scene-footprint.ts`.
- Ink is the Layout adapter's task and reads strokes as Walls only. PLATE ratifies the Shape reading
  as part of [World authoring](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).
- `robust-predicates` is already in the tree through `@portfolio/layout-core`.

## Native form policy v1

These rules bind every slice in this phase. A change to one is a plan change, not a slice decision.

- **Source.** A form is `{ generator: extrude, scale, nextKey }`: an outline of keyed anchors in a
  local profile plane, a positive extent along that plane's normal, a per-axis source scale about the
  local origin, and a monotonic key allocator. The profile plane is `plan` (local XZ, extruded up)
  or `elevation` (local XY, extruded along local +Z). The entity transform stays an upright floor
  transform (position and yaw), so every existing floor operation keeps its meaning.
- **Outline.** A simple, closed, counter-clockwise polygon of 3–256 anchors, each a straight corner
  or a smooth anchor. Smooth anchors evaluate as quadratic curves with deterministic,
  tolerance-driven sample counts. Every control edge is at least 1 mm and every coordinate within
  ±50 m. Exact orientation predicates decide simplicity on the evaluated profile; self-intersection,
  touching and collinear degeneracy refuse with a typed reason.
- **Extent and scale.** The extent is 1 mm–100 m. Scale factors are in [0.01, 100] and every scaled
  dimension stays within 1 mm–100 m. Creation writes scale `[1, 1, 1]`; forms carry no entity-level
  uniform scale.
- **Evaluation.** Canonical evaluation uses exactly rounded arithmetic only (umbrella plan §5.5). The
  result is a closed, outward-oriented triangle mesh with regions (base cap, top cap, one side run
  per outline edge key), bounds, an XZ footprint and a floor contact.
- **Persistence.** Source only, in Scene unit format 4. Meshes, normals, UVs, footprints and caches
  are never written.
- **Floor-standing objects.** P01 forms stand on their support. An outline drawn on an upright sheet
  or a wall face becomes an `elevation` form whose lowest point rests on the floor below it, with
  its yaw taken from the sheet or face. Forms mounted at height on a wall wait for Scene surface
  placement, which is outside this phase.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T5.P01.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [closed plan stub](./t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md) | [acceptance and preservation stub](./t5.p01.s01-native-form-source-and-evaluation/acceptance.md) | plan approved by the owner's merge of the T5 planning PR ([record](../../../reference/decisions/t5-object-focus-planning-2026-10-27.md)); owner released S01 on 2026-10-27 and approved Option B selection expansion on 2026-10-28; **accepted by owner-override 2026-10-28** at product head `7c3445e1` (PR #208): missing raw browser artifacts, final-head review receipts and a full-contract rerun are not claimed; battery-mode performance is **deferred, not passed**, to `T5.P01.S03`, the plan's integration route, and AC diagnostics are not acceptance; the Stage `439.0 KiB` br exception remains; no correctness criterion, including 6, is waived; shipped under the P1 merge rule; its `T2.P02.S03` prerequisite merged with PR #199 |
| T5.P01.S02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [closed plan stub](./t5.p01.s02-shape-reading-and-sizing/implementation-plan.md) | [acceptance and preservation stub](./t5.p01.s02-shape-reading-and-sizing/acceptance.md) | owner released and accepted by reviewed evidence 2026-10-28; shipped through PR #215 under the P1 merge rule |
| T5.P01.S03 | proposed | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t5.p01.s03-integrated-final-gate/implementation-plan.md) | [record](./t5.p01.s03-integrated-final-gate/acceptance.md) | approved with S02 and S04 or after them |
| T5.P01.S04 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [closed plan stub](./t5.p01.s04-my-objects-editable-copies/implementation-plan.md) | [acceptance and preservation stub](./t5.p01.s04-my-objects-editable-copies/acceptance.md) | owner amendment in the planning PR ([record](../../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-reusable-native-objects)); accepted by the owner 2026-10-28 at product head `de9451ba` (PR #216): T2's D8 library scope and the Card-fields Save and `private, no-store` deviations were accepted; browser E2E and performance rows are **deferred, not passed**, to S03; shipped under the P1 merge rule; no S03 gate, phase closure or performance pass is claimed |

Every consumed gate is `accepted` and every required scope is `active` on `main` at this
registration; each slice rechecks them at its own trusted base through the runbook start step. No
slice here provides a gate. S01, S02 and S04 send their exhaustive proof to S03. S04 was added by
owner amendment after the final gate was numbered, so the gate keeps id S03.

```text
FINAL PHASE GATE: T5.P01.S03 → ./t5.p01.s03-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

Passing the final gate makes T5.P01 closable; only an explicit owner phase-close request closes it.
The phase configures no architecture-cycle window.

## Dependencies and boundaries

- **Scene writer order.** S01 edits the Scene unit types, codec, validation and planners that
  `T2.P02.S03` touched. `T2.P02.S03` merged with PR #199 and T2.P02 closed on 2026-10-27, so no
  T2 writer holds those files now; a new T2 Scene writer serializes with S01. Later T2 Scene work rebases on S01's format 4 under the
  [shared-file protocol](../../cross-track-execution.md#shared-files-and-merge-protocol).
- **Library scope.** S04 lands the library scope of the typed resource system for the `form` kind
  only, under T2 review (D8), with an `apps/api` migration serialized with other API writers.
- **Reviews.** T2 reviews every Scene unit, codec, planner, Scene-adapter, library-scope and API
  change (decisions D2 and D8);
  T1 reviews the Ink reading seam and any Stage host change (D5); T3 reviews any F4, Head or Save
  change, and this phase plans none.
- **T5 writes:** `packages/geometry-core/**` (new, decision D3), the native-form parts of
  `packages/project-model/src/scene*.ts`, `scene-codec/**`, `units/**` and `scene-planning/**`, the
  native-form renderer and Plan footprint entries, the Shape reading and its Card, the `form`
  library payload codec, the owner-scoped library routes and migration in `apps/api`, the Save to My
  Objects action and My Objects section, and fixtures and tests for them.
- **Excluded:** Object Focus, sections, outline revision after creation, shaping operations, cut and
  add, revolve, sweep, anchors and attachments, definitions and instances, shared library instances,
  offered updates, item revisions, library rename, folders, search and sharing, material editing beyond
  the existing material choice, any dependency beyond the resident `robust-predicates` and `earcut`,
  visitor publication of forms, and any F, PLATE or performance-contract amendment.
- **Reference hardware.** Performance rows are measured on the designated reference machine, with
  Laptop A reported.

## Follow-on

`T5.P02` (Object Focus) is planned in the [umbrella plan](../umbrella-plan.md#63-t5p02--object-focus-refine-and-shape-planned)
and registered when S01 is accepted. No P02 slice id is registered here.
