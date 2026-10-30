# Post-S10 convergence — execution plan

**Proposal. Nothing here is registered or released.** C01–C10 are planning labels. An owner decision turns them into R217 slices under [bounded replanning](../../../operations/README.md#bounded-replanning), with a [release list](../../now.md) row for each, before any implementation starts. S11 stays R217's final gate and runs after them. Target behaviour is in the [target specification](./target-specification.md).

## Recommended order

Fix what is broken before what looks wrong: creators are working around the P1 defects today, and those slices are the smallest and most independent.

| Wave | Slice | Fixes | Needs | Size |
| --- | --- | --- | --- | --- |
| 1 Correctness | C08 Camera basis | D23 | O3 | Small |
| | C05 Drafting feedback | D15, D16 | — | Medium |
| | C06 Ghosts | D17, D18 | C05's preview type | Medium |
| | C09 Ground and grid | D21, D28 | O4, C08 merged | Medium |
| 2 Shell | C01 Roles and Head | D01–05, D25, D26 | Interim Find route; O5 for final placement | Medium |
| | C02 Index and Card | D06–10 | C01 | Medium |
| | C03 Lower edge and responsive | D11–14 | C01, C02 | Large |
| | C04 Experience integration | D24 | C01–C03 | Large |
| 3 Decided behaviour | C10 Selection | D22 | C06; O1 for calibration | Small |
| | C07 Junction | D19, D20 | C05, O2 | Medium |

D05 and D27 are already satisfied or are intentional departures, so they need no work.

**Serialise these:** C05 and C07 (Layout adapter); C06 and C10 (Paper and Canvas); C08 and C09 (`viewport.ts`); C03 and C04 (route). Every route, facade or Canvas edit records its [shared-file claim](../../cross-track-execution.md#shared-files-and-merge-protocol) first.

## Architecture map

| Concern | Sole owner | Writer | Reviews |
| --- | --- | --- | --- |
| Pose, clip planes, screen basis | `packages/camera-core/src/viewport.ts` | T3 | T1 |
| Datum handed to the Camera | `stage/camera-session.ts` | T1 | T3 |
| Grid footprint, levels and budget | `stage/stage-grid.ts` | T1 | T3 |
| Mat and ghost drawing | `stage/shell/StageCanvas.svelte` | T1 | T2, T5 |
| Overlay coordinate translation | `stage/stage-facade.ts` `overlays()` only | T1 | — |
| Candidate geometry | Domain planners, through adapters | T1, T2, T5 | T1 |
| Scene footprint polygons | `scene/plan-scene-footprint.ts` | T2 | T1, T5 |
| Selection ink | `stage/paper-marks.ts`, `shell/StageSelectionLayer.svelte` | T1 | T2, T5 |
| Junction and rigid moves | `layout-core` planners via `adapters/layout/precision.ts` | T1 | — |
| Shell roles and Head | Shell stylesheet, `shell/EditorHead.svelte` | T1 | T3 |
| Index and Card | `shell/EditorIndex.svelte`, `shell/EditorCard.svelte`, facade card types | T1 | T2, T3, T5 |
| Shell geometry | The spatial route | T1 | T3 |
| Experience commands and presentation | `experience/ExperienceSurface.svelte` and its split | T3 | T1 |

Paths under `stage/`, `shell/`, `scene/`, `adapters/` and `experience/` are relative to `apps/editor/src/lib/authoring/`, with `shell/` inside `stage/`.

## Rules for every slice

- **Base and record:** start from current `main`; recheck consumed gates and active scopes; record writer, patch base and reviewers.
- **Verification:** `VERIFICATION: affected-subsystem`, `INTEGRATION ROUTE: R217.S11`, plus the whole architecture lane before the PR, per [the test manual](../../../../apps/editor/tests/README.md). Focused green runs are never acceptance.
- **Browser:** each journey runs at 1440×900, 1280×800, 1180×820 and 820×1180 where layout is involved. Native touch and Safari remain S11's obligation and are not claimed earlier.
- **Rollback:** revert the coherent PR, including its contract and test changes. Never roll back by restoring old editor infrastructure. No slice migrates a schema, so reverting never strands data.

## Slices

### C08 — Camera basis

- **Change:** negate the Plan up vector in `upForReading`; update its comment.
- **Tests:** extend `apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts` with signed screen-axis continuity across every transition frame, for elevations 5/45/88° and azimuths 0/44/46/90/179/225/315°. Add reversal mid-transition, repeated fast switching, reduced motion, quarter-turn ties, and 20 cycles with no target or scale drift.
- **Journey:** flip 2D↔3D at several azimuths; a wall on the left of the screen stays on the left. Pan and marks still track the pointer in Plan. Selection, tool and source are unchanged.
- **Excludes:** global north-up and restoring earlier azimuths.
- **Rollback signal:** any Plan consumer found to assume the old sign. None was found by inspection, and the 290 affected tests pass with the change.

### C05 — Drafting feedback

- **Change:** remove the rect subtraction in `inkOverlay`; add `StageCandidatePreview` and its overlay rendering; make Wall hover update the chain; fill the preview from planner candidates with live labels.
- **Tests:** marker position is invariant under Index open and close; preview equals planner output; a refused candidate shows refusal and proposes nothing.
- **Journey:** hover, press and drag Wall, Box and Opening; length, angle and snap are visible; cancel and refusal leave no mutation; one release is one Undo.
- **Excludes:** Junction moves, palette redesign (C03) and a second compiler.

### C06 — Ghosts

- **Change:** Paper draws candidate footprints through the preview type; `candidate-ghost.ts` returns approved-bounds proxies for models; 3D meshes stay nonpickable.
- **Tests:** ghost matches candidate for primitive, catalogue, approved model and native form; a model with no approved bounds draws no guessed shape; ghosts never intercept a pick.
- **Journey:** place, move, turn and scale each type in Paper and 3D.
- **Excludes:** imported-model ingest changes.

### C09 — Ground and grid

- **Change:** add `displayGroundYMeters` and the depth rule; replace the footprint with the frustum intersection; add the budget; make the mat follow the target with a polygon offset.
- **Tests:** visible-ground samples lie inside coverage **and** clip range, classified as sky, behind, near or far, across elevations 5/15/45/75/89°, azimuth quadrants and diagonals, portrait and landscape, translated targets, zoom extremes, datum changes and horizon crossing. Include actual Stage wiring, not only footprint math. Assert line count ≤ 6,000 and that major lines are never dropped.
- **Journey:** orbit and zoom from overhead to shallow with the horizon in frame; no straight cut at top or bottom, no moiré band, no wall and floor fighting up close, and observably smooth.
- **Excludes:** semantic fit, infinite grid and timing gates.
- **Owed from the audit:** the eye-height term of `reach` and the budget were specified after the probe and have not been run. This slice proves them.

### C01 — Roles and Head

- **Change:** add the shell stylesheet and Head order; replace the app menu with the Index toggle; add Find entries for every displaced utility; move refusal prose into disclosures; remove `Technical details` and the Stage source button.
- **Tests:** Find reaches every former menu capability; refusal is announced accessibly; existing Head suites still pass.
- **Journey:** empty, dirty and refused states; keyboard-only; coarse-target sizes; Head stays one row at all four widths.
- **Excludes:** Index and Card content.

### C02 — Index and Card

- **Change:** human labels and compact rows; `fieldId` and `group` on Card contributions; remove diagnostics; style by operation meaning.
- **Tests:** long and repeated names; each fact appears once; Duplicate is not styled as destructive; generated names never reach a save.
- **Journey:** select versus frame stay distinct; every action remains reachable by keyboard.
- **Excludes:** Height Sheet and lower edge.

### C03 — Lower edge and responsive

- **Change:** measured shell geometry; Height Sheet line presentation; compact Ink palette; bounded scrim and invoked sheets.
- **Tests:** no Camera movement on layout change; all Ink modes and precision entry are retained; Height Sheet keyboard, pins and found tops are unchanged.
- **Journey:** all four widths with sheets open and closed; pin, drag and key height; nothing overlaps; dock stays usable behind an open Index.
- **Excludes:** Experience presentation.

### C04 — Experience integration

- **Change:** split `ExperienceSurface.svelte` into shared-home presentation with one controller; Guide invoked, closed by default.
- **Tests:** existing Experience suites unchanged; no second lens picker or Preview entry.
- **Journey:** World↔Experience; Capture, View, Guide, Preview and return; history and lens parking are unchanged.
- **Excludes:** new Experience capability. T3 writes; T1 alone writes the route.

### C10 — Selection

- **Change:** Scene Paper fills from existing polygons; opacities and Paper edge per O1.
- **Tests:** per-subject fill and contour in `paper-marks.test.ts`, including concave and tilted forms and an Opening never filled as its Wall; hover stays untinted.
- **Journey:** every subject in both readings, with overlaps, holes, light walls on dark mat, and hidden subjects.
- **Excludes:** picking changes. Without O1, ship the fill at S07's values and leave calibration open.

### C07 — Junction

- **Change:** `layout-junction-move` planner; Card actions; armed square mark.
- **Tests:** a Junction with 2+ Walls and a hosted Opening; snap; invalid, cancel and Undo; endpoint length behaviour unchanged.
- **Journey:** mouse and coarse pointer; one release is one Undo; Escape leaves no trace.
- **Excludes:** repurposing endpoints, restoring the angle ring, and height or thickness grips.

## S11 addition

When these slices are registered, S11's journeys gain: Plan flip continuity across azimuths, grid continuity at the horizon, live drafting feedback, and ghosts in both readings. S11 stays unlaunched until the owner releases it.

## Evidence limits

The audit did not cover native touch or Safari, an authenticated save and reload, exhaustive Opening and form selection in the browser, a live multi-azimuth Camera matrix, a dense imported-model scene, or a horizon-in-frame browser view of the candidate grid. The candidate fix was tested at one Plan flip and at moderate-to-low orbits, so these remain owed by the slices above and S11.
