# Post-S10 convergence — execution plan

**Registered 2026-10-30 as R217.S12–S25.** They run as one campaign under a [standing authorization](../../../reference/decisions/r217-convergence-campaign-2026-10-30.md) that takes effect when the owner merges PR #230. Nothing is released until then. This file owns the scope classes, order, architecture map and shared rules. Each slice's [plan](#slices) owns its scope and acceptance; the [phase register](../README.md#slice-register) owns lifecycle; the [target specification](./target-specification.md) owns behaviour.

## What this campaign fixes

**Core regressions and baseline drift: must fix.** Something worked in the pre-prune editor, or the accepted wireframe sets it as the minimum.

| Problem | Findings | Slice |
| --- | --- | --- |
| Plan flip turns the drawing over | D23 | S12 |
| Snap changes with zoom; Paper grid, ruler and toolbar drift | D30, D39, D41, D42 | S13 |
| Drafting has no live feedback, and its markers are offset | D15, D16, D34 | S14 |
| Selected Walls can't be dragged, end points can't edit Junctions freely, and drags ignore Snap | D19, D31, D33 | S15 |
| Openings can't be selected in Plan | D35 | S16 |
| Objects have no body drag or Paper ghost | D17, D33 | S17 |
| Scene selection has no Paper fill, and selection reads faint | D22 | S18 |
| 3D ground is clipped | D21, D28 | S19 |
| Head, Index, Card, lower edge, narrow widths and Experience drift from the wireframe | D01–D04, D06–D14, D24–D26, D36 | S20–S25 |

**Missing integration of existing capabilities: must wire, no new algorithms.** The capability exists; the product can't reach it.

| Existing capability | Where it gets wired | Slice |
| --- | --- | --- |
| `resolveLayoutSnap` guides and grid; `resolveOpeningDragSnap` | Ink, Wall and Opening drags, with a snap mark (D32) | S14–S16 |
| Planner candidates and `buildPaperPlan` | Live Layout outlines | S14 |
| `planExactJunctionMove`, `planRigidWallMove` | Direct Wall and Junction gestures | S15, S16 |
| `plan-scene-footprint.ts`, approved placement footprints | Paper ghosts, fills and the model proxy (D18) | S17, S18 |
| Click placement used by models | Library primitives (D37) | S17 |
| `zoom()`, `fit()`, `scaleDetentIntent` | Visible zoom and Fit, and Find entries (D40) | S13 |

**Genuinely new capabilities: future phases, out of this campaign.**

- Door swing and hinge data ([deferred](./owner-decisions.md#deferred-door-swing)).
- Junction merge and other new topology operations.
- New snap geometry: parallel-Wall alignment, `extension-guide` candidates, and Junction snapping to Walls.
- A Layout candidate mesh in 3D, and hovered Junctions in 3D.
- Wall height and thickness grips, the angle ring, curve marks, and Opening head and sill rays.
- Object placement outside a Room's floor.
- A preferences panel and print-to-scale.

## How C01–C10 became slices

Four planning labels split, because each either hid a consequential decision or mixed unrelated risks. No other slice was added. **C07's Card-armed Junction proposal is withdrawn**, and C06's scope is raised to prove that manipulation works, not that ghosts render.

| Label | Slice | Why it changed |
| --- | --- | --- |
| C08 | R217.S12 Camera basis | — |
| C09b | R217.S13 Drafting simplification | Split from C09: Paper presentation and 3D clipping are distinct problems |
| C05 | R217.S14 Live feedback | — |
| C07a | R217.S15 Wall direct manipulation | Split from C07: the new model is larger |
| C07b | R217.S16 Openings and Junction hover | Split from C07: Opening picking is a separate defect |
| C06 | R217.S17 Scene and form manipulation | Scope raised |
| C10 | R217.S18 Selection ink | — |
| C09a | R217.S19 3D ground clipping | Split from C09 |
| C01 | R217.S20 Roles and Head | — |
| C02 | R217.S21 Index and Card | — |
| C03a | R217.S22 Geometry, Card and Height Sheet | Split from C03: too large for one reviewable PR |
| C03b | R217.S23 Ink palette and constrained widths | Split from C03 |
| C04a | R217.S24 Experience controller | Split from C04: separates a no-visible-change refactor from visible change |
| C04b | R217.S25 Experience shared homes | Split from C04 |

## Order

| Wave | Slice | Fixes | Needs | Architecture owner | Specialist review |
| --- | --- | --- | --- | --- | --- |
| 1 Foundations | S12 Camera basis | D23 | O3 | T1 | T3 |
| | S13 Drafting simplification | D30, D39–D42 | O7, O8 | T1 | T3 |
| | S14 Live feedback | D15, D16, D32, D34 | S13 | T1 | T2, T5 |
| 2 Direct editing | S15 Wall manipulation | D19, D31, D33 | S13, S14, O2, O6 | T1 | T2 |
| | S16 Openings and Junction hover | D31, D35 | S15, O9 | T1 | — |
| | S17 Scene and form manipulation | D17, D18, D33, D37, D38 | S13, S14, S15, O9 | T2, T5 | T2, T5 |
| | S18 Selection ink | D22 | S17, O1 | T1 | T2, T5 |
| | S19 3D ground clipping | D21, D28 | S12, S13, S17, O4 | T1 | T3 |
| 3 Shell | S20 Roles and Head | D01–D04, D25, D26 | S13, O5 | T1 | T3 |
| | S21 Index and Card | D06–D10 | S20 | T1, T2, T5 | T2, T3, T5 |
| | S22 Geometry, Card, Height Sheet | D11, D12, D36, D42 | S20, S21 | T1 | T3 |
| | S23 Ink palette, constrained widths | D13, D14 | S14, S22 | T1 | T2, T5 |
| | S24 Experience controller | Prepares D24 | — | T3 | T3 |
| | S25 Experience shared homes | D24 | S20–S24 | T3, T1 | T3 |

**Why this order.** Creators are working around wave 1 and 2 defects daily, and shell polish over a surface that cannot be edited would be the visual parity you warned against. S13 comes first because every later drag consumes its fixed snap value.

**Writer.** One convergence integrator writes every slice. Owners above keep their authorities and contracts. Camera-core's viewport is T1's in the [architecture contract](../../../reference/architecture.md), with T3 owning route and motion.

### Shared-file order

Run slices in this total order: **S12, S13, S14, S15, owner checkpoint, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S11.** Following it resolves every conflict below.

| Shared file | Order |
| --- | --- |
| `layout.adapter.ts` | S13 → S14 → S15 → S16 → S21 |
| `scene.adapter.ts` | S13 → S17 → S21 |
| `stage-facade.ts` | S14 → S16 → S21 |
| `StageOverlay.svelte` | S14 → S17 |
| `stage-grid.ts` | S13 → S14 → S19 |
| `viewport.ts` | S12 → S19 |
| `StageCanvas.svelte` | S17 → S19 |
| `paper-marks.ts`, `StageSelectionLayer.svelte` | S18 only |
| `EditorHead.svelte`, `StageDraftingControl.svelte` | S13 → S20 → S21 (Head chip input) |
| `EditorCard.svelte` | S21 → S22 |
| `EditorIndex.svelte` | S20 → S21 → S23 → S25 |
| The spatial route | S13 → S15 → S16 → S20 → S22 → S23 → S25 |

**Sequential campaign policy:** execute one implementation slice at a time in the total order above. Do not open the next implementation slice before the current slice's reviewed PR has merged and its recovery anchor is verified. Even technically independent pairs (S12/S13, S16/S17, S18/S19, or S24 with earlier work) remain sequential unless the owner explicitly approves an exception. D05 and D27 need no work. D29 and D43 are watched, not fixed.

## Architecture map

| Concern | Sole owner | Must not |
| --- | --- | --- |
| Pose, clip planes, screen basis | `packages/camera-core/src/viewport.ts` | Learn Scene or Layout |
| Datum handed to Camera | `stage/camera-session.ts` | Enter authored bounds |
| Grid levels, footprint, budget | `stage/stage-grid.ts` | Decide snap |
| Snap value and suspension | `stage/stage-drafting.ts` | Read zoom |
| Which Layout snap targets per operation | A small Layout adapter module beside `adapters/layout/precision.ts` | Compute geometry or serve Scene; it calls `layout-core` |
| Semantic snap candidates | `packages/layout-core/src/layout-snap.ts` | Change in these slices |
| Wall and Junction outcomes | `layout-core` planners through `adapters/layout/precision.ts` | Be reimplemented in gestures |
| Pointer to parameter | `adapters/layout/wall-gesture.ts` | Decide validity |
| Hit arbitration | Route `onPointerDown`, `stage/stage-facade.ts`, `stage/stage-pick.ts` | Move domain policy to the host |
| Layout pick winner | `layout/plan-pick-provider.ts` | Ask the Scene |
| Overlay translation | `stage/stage-facade.ts` `overlays()` only | Be repeated in adapters |
| Candidate drawing | Stage overlay and Canvas | Author geometry |
| Scene footprints | `scene/plan-scene-footprint.ts` | Grow a second bounds source |
| Selection ink | `stage/paper-marks.ts`, `stage/shell/StageSelectionLayer.svelte` | Become a pick source |
| Shell geometry | The spatial route | Move the Camera |
| Experience commands | The extracted Experience controller | Depend on layout of its views |

Paths under `stage/`, `scene/`, `adapters/` and `layout/` are relative to `apps/editor/src/lib/authoring/`.

## Rules for every slice

- **Base and record:** start from current `main`; recheck consumed gates and active scopes; record the patch base and any parallel work in the T1 baton.
- **Verification:** `VERIFICATION: affected-subsystem`, `INTEGRATION ROUTE: R217.S11`, plus the whole architecture lane before the PR, per [the test manual](../../../../apps/editor/tests/README.md). Focused green runs are never acceptance.
- **Browser:** real pointer input in Chromium. Layout-affecting slices check 1440×900, 1280×800, 1180×820 and 820×1180. Native touch and Safari remain S11's.
- **Every interaction journey includes:** one release is one Undo step; Undo restores exactly; Escape leaves no trace; a refused release writes nothing; a reading flip mid-gesture leaves no trace or the existing paused proposal; save and reload match the accepted source.
- **Rollback:** revert the coherent PR with its contract and test changes. Never restore old editor infrastructure. No slice migrates a schema.
- **Contract edits:** a slice implementing an owner decision that amends a contract updates that contract in the same PR.

## Slices

| Slice | Plan | Acceptance |
| --- | --- | --- |
| R217.S12 | [Camera basis](../r217.s12-camera-basis/implementation-plan.md) | [record](../r217.s12-camera-basis/acceptance.md) |
| R217.S13 | [Drafting simplification](../r217.s13-drafting-simplification/implementation-plan.md) | [record](../r217.s13-drafting-simplification/acceptance.md) |
| R217.S14 | [Live feedback](../r217.s14-live-feedback/implementation-plan.md) | [record](../r217.s14-live-feedback/acceptance.md) |
| R217.S15 | [Wall direct manipulation](../r217.s15-wall-direct-manipulation/implementation-plan.md) | [record](../r217.s15-wall-direct-manipulation/acceptance.md) |
| R217.S16 | [Openings and Junction hover](../r217.s16-openings-and-junction-hover/implementation-plan.md) | [record](../r217.s16-openings-and-junction-hover/acceptance.md) |
| R217.S17 | [Scene and form manipulation](../r217.s17-scene-and-form-manipulation/implementation-plan.md) | [record](../r217.s17-scene-and-form-manipulation/acceptance.md) |
| R217.S18 | [Selection ink](../r217.s18-selection-ink/implementation-plan.md) | [record](../r217.s18-selection-ink/acceptance.md) |
| R217.S19 | [3D ground clipping](../r217.s19-3d-ground-clipping/implementation-plan.md) | [record](../r217.s19-3d-ground-clipping/acceptance.md) |
| R217.S20 | [Roles and Head](../r217.s20-roles-and-head/implementation-plan.md) | [record](../r217.s20-roles-and-head/acceptance.md) |
| R217.S21 | [Index and Card](../r217.s21-index-and-card/implementation-plan.md) | [record](../r217.s21-index-and-card/acceptance.md) |
| R217.S22 | [Geometry, Card and Height Sheet](../r217.s22-geometry-card-and-height-sheet/implementation-plan.md) | [record](../r217.s22-geometry-card-and-height-sheet/acceptance.md) |
| R217.S23 | [Ink palette and constrained widths](../r217.s23-ink-palette-and-constrained-widths/implementation-plan.md) | [record](../r217.s23-ink-palette-and-constrained-widths/acceptance.md) |
| R217.S24 | [Experience controller](../r217.s24-experience-controller/implementation-plan.md) | [record](../r217.s24-experience-controller/acceptance.md) |
| R217.S25 | [Experience shared homes](../r217.s25-experience-shared-homes/implementation-plan.md) | [record](../r217.s25-experience-shared-homes/acceptance.md) |

S11 stays the final gate and reuses S17's fixture. Its journeys now include J12–J15 for these slices, and its acceptance and merge stay with the owner.

## Evidence limits

The Plan audit used synthetic pointer events with capture stubbed in the page, in one Chromium session. Not exercised live: Box, Shape, Turn and Size, native forms, catalogue and models, Eraser, Measure and 3D direct edits; those rows rely on code and earlier acceptance. Native touch, Safari, authenticated save and reload, and a dense scene remain owed. The direct-manipulation model has not been prototyped, so S15's browser journey is the first real test of how it feels, and O2 can be revisited cheaply then.
