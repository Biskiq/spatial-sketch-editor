# Post-S10 convergence — execution plan

**Registered 2026-10-30 as R217.S12–S25, each `approved` and awaiting an owner release-list row.** Nothing here is released. This file owns the order, the architecture map and the shared rules. Each slice's [plan](#slices) owns its scope and acceptance; the [phase register](../README.md#slice-register) owns lifecycle; the [target specification](./target-specification.md) owns behaviour.

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

| Wave | Slice | Fixes | Needs | Writer | Reviews |
| --- | --- | --- | --- | --- | --- |
| 1 Foundations | S12 Camera basis | D23 | O3 | T1 | T3 |
| | S13 Drafting simplification | D30, D39–D42 | O7, O8 | T1 | T3 |
| | S14 Live feedback | D15, D16, D32, D34 | S13 | T1 | T2, T5 |
| 2 Direct editing | S15 Wall manipulation | D19, D31, D33 | S13, S14, O2, O6 | T1 | T2 |
| | S16 Openings and Junction hover | D31, D35 | S15, O9 | T1 | T2 |
| | S17 Scene and form manipulation | D17, D18, D33, D37, D38 | S13, S14, O9 | T2 | T1, T5 |
| | S18 Selection ink | D22 | S17, O1 | T1 | T2, T5 |
| | S19 3D ground clipping | D21, D28 | S12, S13, O4 | T1 | T3 |
| 3 Shell | S20 Roles and Head | D01–D04, D25, D26 | S13, O5 | T1 | T3 |
| | S21 Index and Card | D06–D10 | S20 | T1 | T2, T3, T5 |
| | S22 Geometry, Card, Height Sheet | D11, D12, D36, D42 | S20, S21 | T1 | T3 |
| | S23 Ink palette, constrained widths | D13, D14 | S14, S22 | T1 | T2, T5 |
| | S24 Experience controller | Prepares D24 | — | T3 | T1 |
| | S25 Experience shared homes | D24 | S20–S24 | T3 | T1 |

**Why this order.** Creators are working around wave 1 and 2 defects daily, and shell polish over a surface that cannot be edited would be the visual parity you warned against. S13 comes first because every later drag consumes its fixed snap value.

**Writers.** Camera-core's viewport is T1's in the [architecture contract](../../../reference/architecture.md), with T3 owning route and motion. So S12 and S19 are T1 slices with T3 review, and each slice keeps the phase's one writer.

**Serialise:** S14 → S15 → S16 (Layout adapter). S14 → S17 → S18 (Paper and Canvas). S12 → S19 (`viewport.ts`). S13 → S19 (`stage-grid.ts`). S22 → S23 → S25 (route). Every route, facade or Canvas edit records its [shared-file claim](../../cross-track-execution.md#shared-files-and-merge-protocol) first. D05 and D27 need no work. D29 and D43 are watched, not fixed.

## Architecture map

| Concern | Sole owner | Must not |
| --- | --- | --- |
| Pose, clip planes, screen basis | `packages/camera-core/src/viewport.ts` | Learn Scene or Layout |
| Datum handed to Camera | `stage/camera-session.ts` | Enter authored bounds |
| Grid levels, footprint, budget | `stage/stage-grid.ts` | Decide snap |
| Snap value and suspension | `stage/stage-drafting.ts` | Read zoom |
| Which snap targets per operation | A new small Stage snap helper | Compute geometry; it calls `layout-core` |
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

- **Base and record:** start from current `main`; recheck consumed gates and active scopes; record writer, patch base and reviewers.
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

S11 stays the final gate. Its journeys now include J12–J15 for these slices, and it stays unlaunched until the owner releases it.

## Evidence limits

The Plan audit used synthetic pointer events with capture stubbed in the page, in one Chromium session. Not exercised live: Box, Shape, Turn and Size, native forms, catalogue and models, Eraser, Measure and 3D direct edits; those rows rely on code and earlier acceptance. Native touch, Safari, authenticated save and reload, and a dense scene remain owed. The direct-manipulation model has not been prototyped, so S15's browser journey is the first real test of how it feels, and O2 can be revisited cheaply then.
