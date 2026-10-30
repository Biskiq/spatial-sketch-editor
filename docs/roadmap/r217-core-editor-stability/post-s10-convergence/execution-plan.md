# Post-S10 convergence — execution plan

**Proposal. Nothing here is registered or released.** The labels below are planning names. An owner decision turns them into R217 slices under [bounded replanning](../../../operations/README.md#bounded-replanning), with a [release list](../../now.md) row for each, before any implementation starts. S11 stays R217's final gate and runs after them. Behaviour is defined in the [target specification](./target-specification.md).

## How C01–C10 changed

Four slices split, because each either hid a consequential decision or mixed unrelated risks. No other slice was added.

| Before | Now | Why |
| --- | --- | --- |
| C07 Junction | **C07a** Wall direct manipulation; **C07b** Openings and Junction hover | The Card-armed proposal is withdrawn. The new model is larger, and Opening picking is a separate defect |
| C09 Ground and grid | **C09a** 3D clipping; **C09b** Drafting simplification | Paper presentation and 3D clipping are distinct problems with different owners |
| C03 Lower edge and responsive | **C03a** Geometry, Card and Height Sheet; **C03b** Ink palette and constrained widths | Too large for one reviewable PR |
| C04 Experience | **C04a** Controller extraction; **C04b** Shared homes | Separates a no-visible-change refactor from visible change |
| C06 Ghosts | **C06** Scene and form manipulation | Scope raised as you asked: it must prove manipulation works, not that ghosts render |

## Order

| Wave | Slice | Fixes | Needs | Writer | Reviews |
| --- | --- | --- | --- | --- | --- |
| 1 Foundations | C08 Camera basis | D23 | O3 | T3 | T1 |
| | C09b Drafting simplification | D30, D39–D42 | O7, O8 | T1 | T3 |
| | C05 Live feedback | D15, D16, D32, D34 | — | T1 | T2, T5 |
| 2 Direct editing | C07a Wall manipulation | D19, D31, D33 | C05, C09b, O2, O6 | T1 | T2 |
| | C07b Openings and Junction hover | D31, D35 | C07a, O9 | T1 | — |
| | C06 Scene and form manipulation | D17, D18, D33, D37, D38 | C05, C09b, O9 | T2 | T1, T5 |
| | C10 Selection | D22 | C06; O1 for calibration | T1 | T2, T5 |
| | C09a 3D clipping | D21, D28 | C08, C09b, O4 | T3, then T1 | T1, T3 |
| 3 Shell | C01 Roles and Head | D01–D04, D25, D26 | Interim Find; O5 for final placement | T1 | T3 |
| | C02 Index and Card | D06–D10 | C01 | T1 | T2, T3, T5 |
| | C03a Geometry, Card, Height Sheet | D11, D12, D36, D42 | C01, C02 | T1 | T3 |
| | C03b Ink palette, constrained widths | D13, D14 | C03a, C05 | T1 | T2, T5 |
| | C04a Experience controller | Prepares D24 | — | T3 | T1 |
| | C04b Experience shared homes | D24 | C01–C03b, C04a | T3 | T1 |

**Why this order.** Creators are working around wave 1 and 2 defects daily, and shell polish over a surface that cannot be edited would be the visual parity you warned against. C09b comes first because every later drag consumes its fixed snap value.

**Serialise:** C05 → C07a → C07b (Layout adapter). C05 → C06 → C10 (Paper and Canvas). C08 → C09a (`viewport.ts`). C09b → C09a (`stage-grid.ts`). C03a → C03b → C04b (route). Every route, facade or Canvas edit records its [shared-file claim](../../cross-track-execution.md#shared-files-and-merge-protocol) first. D05 and D27 need no work. D29 and D43 are watched, not fixed.

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

### C08 — Camera basis

- **Files:** `packages/camera-core/src/viewport.ts`; `apps/editor/tests/lib/museum/navigation/camera-viewport-evaluation.test.ts`.
- **Rules:** negate the Plan up vector and nothing else.
- **Tests:** signed screen-axis continuity on every transition frame for elevations 5/45/88° and azimuths 0/44/46/90/179/225/315°; reversal mid-transition; repeated fast switching; reduced motion; quarter-turn ties; 20 cycles without target or scale drift.
- **Browser:** flip at several azimuths; a Wall on screen-left stays there. Pan and marks track the pointer in Plan. Selection, tool and source unchanged.
- **Excludes:** north-up; restoring earlier azimuths.

### C09b — Drafting simplification

- **Files:** `stage/stage-drafting.ts`, `stage/stage-grid.ts`, `stage/stage-measure.ts`, `stage/shell/StageDraftingControl.svelte`, `stage/shell/StageScaleBar.svelte`, `stage/shell/StageGrid.svelte`, `stage/shell/EditorHead.svelte` viewing menu, spatial route, Scene and Layout snap call sites. Tests: `stage-drafting.test.ts`, `stage-grid.test.ts`, `head-drafting-config.test.ts`, `layout-drawing-adapter.test.ts`, `shape-reading-adapter.test.ts`, `scene-editing-surface.test.ts`, `stage-session.test.ts`.
- **Contract:** `draftingSnapIncrementMeters` stops taking a zoom-derived level. `gridLevelsFor` returns fixed levels with thinning. Paper rectangle from content bounds. PLATE's drafting and grid paragraphs update per O7 and O8.
- **Rules:** as specified under [Drafting](./target-specification.md#drafting-grid-snap-and-ruler). Remove the toolbar interval and Scale controls; add Find entries for detents; add the zoom cluster.
- **Tests:** snap value identical at every zoom and in every consumer (Ink, Place, Move, Measure, Height stepping). Line positions unchanged across zoom. Paper rectangle contains all content plus margin, grows for a candidate, never changes the pose. Ruler stays hidden in 3D.
- **Browser:** zoom through full range: no interval flicker, no moiré, sheet edges crisp; draw at two zooms and confirm points share a lattice; ruler has no fill; Fit, zoom and detents all reachable; Grid and Snap words work on both surfaces. Compare with the wireframe's 2D capture.
- **Excludes:** 3D clipping; a preferences panel.

### C05 — Live feedback

- **Files:** `adapters/layout.adapter.ts`, `stage/stage-facade.ts`, `stage/shell/StageOverlay.svelte`, new Stage snap helper. Tests: `layout-drawing-adapter.test.ts`, `layout-wall-manipulation.test.ts`, a new candidate-agreement test.
- **Contract:** `StageCandidatePreview` and its optional adapter contribution; snap mark.
- **Rules:** remove `inkOverlay`'s rect subtraction. Ink Wall, Box and Opening, plus existing Wall marks, publish the candidate. Add snap marks.
- **Tests:** marker position invariant as Index and Head change; preview equals compiled candidate; a refused candidate proposes nothing and shows refusal; `resolveLayoutSnap` winner names the mark.
- **Browser:** hover, press and drag Wall, Box and Opening; the line is under the cursor with Index open and closed; length, angle and snap are visible; invalid shows reason.
- **Excludes:** new gestures; palette redesign.

### C07a — Wall direct manipulation

- **Files:** `adapters/layout.adapter.ts` (`markDescriptors`, `wallMarkSpec`, `pointerIntent`), `adapters/layout/wall-gesture.ts`, `adapters/layout/precision.ts`, route `onPointerDown` and cursor. Tests: `layout-wall-manipulation.test.ts`, `spatial-route-gesture.test.ts`, `stage-handles.test.ts`. Grammar Wall row per O6.
- **Contract:** the [Wall tables](./target-specification.md#wall-direct-manipulation). New `layout-junction-move` planner kind wrapping `planExactJunctionMove`. Press with no mark offered to the selection's owner when the pick winner is that subject; adapter claims body. Below 4 px travel, gesture ends and click proceeds.
- **Rules:** end points become Junction moves; `mode: 'move'` projects the delta on the normal; length ray keeps fixed endpoint. All Wall drags use the snap helper. Card adds Start and End X/Z under a disclosure.
- **Test cases:**
  - Square room, body drag: both neighbours stretch, four Walls keep IDs, one Undo.
  - Free-standing Wall, body drag: nothing else changes.
  - Degree-3 Junction, end point: all three Walls follow.
  - Opening on moved Wall keeps offset and width.
  - Neighbour Opening no longer fits: refused, source unchanged.
  - Junction onto Junction: refused with human words.
  - Off-axis pointer on the length ray changes length only.
  - Snap on and Alt held for each target.
  - Click on selected body under 4 px: no history entry, Card unchanged.
  - Pan from empty and unselected Wall still pans.
  - Digits: body distance, point X then Z, first Esc restores, second cancels.
- **Browser:** the same list with real pointer input, in Plan and 3D. Preview matches the accepted result at release. Mouse and coarse hit sizes. Numeric entry.
- **Excludes:** Junction hover, Opening body, merge, new topology.

### C07b — Openings and Junction hover

- **Files:** `layout/plan-pick-provider.ts`, `adapters/layout.adapter.ts`, Opening branch, route hover, Paper symbol code. Tests: `plan-pick-index.test.ts`, `stage-paper-pick.test.ts`, `layout-wall-manipulation.test.ts`.
- **Rules:** in Plan, an Opening within its aperture outranks its host for Select, using the Eraser's existing rule; outside the aperture, the Wall wins. 3D picking unchanged. Opening body drag slides. Offset uses `resolveOpeningDragSnap`. Door swing drawn. With a mouse, hovering within 10 CSS px of any Junction reveals its point; dragging it moves the Junction and leaves selection alone.
- **Tests:** click aperture selects Opening; click solid Wall selects Wall; Opening at Wall end; hover reveals exactly one point; coarse pointer never reveals on hover; Junction hover never outranks a selected subject's mark.
- **Browser:** select, slide and resize an Opening from Plan only, never using the Index; corner edit with nothing selected; door swing readable.
- **Excludes:** head and sill rays.

### C06 — Scene and form manipulation

- **Files:** `adapters/scene.adapter.ts`, `adapters/scene/candidate-ghost.ts`, `adapters/scene/placement.ts`, object and form mark modules, `stage/shell/StageCanvas.svelte`, `stage/shell/StageFormGhost.svelte`. Tests: `scene-editing-surface.test.ts`, `scene-object-card.test.ts`, `native-form-marks.test.ts`, candidate-agreement test.
- **Rules:** body drag is Move, under the same hit table. Paper footprint and 3D mesh ghosts through the preview type. Model proxy from approved bounds. Library primitives arm click placement; typed fields default to the visible target. Off-floor shows the planner's refusal. Small-subject mark rule from the specification.
- **Test cases:** Move, Turn, Size and Place for primitive, catalogue, approved model and native form including concave and tilted. Candidate footprint equals accepted footprint. Model with no bounds draws no shape. Ghost never intercepts a pick. Position still snaps; Alt frees it. Off-floor release writes nothing.
- **Browser:** **Demonstrates the experience, not just rendering:** for each subject type, in Plan and in 3D, place it, drag it by its body, turn it, size it, duplicate it and undo each step, watching the ghost follow the pointer throughout.
- **Excludes:** import changes; free-floor placement outside a Room.

### C10 — Selection

- **Files:** `stage/paper-marks.ts`, `stage/shell/StageSelectionLayer.svelte`. Tests: `paper-marks.test.ts`.
- **Rules:** [Selection table](./target-specification.md#selection). Without O1, ship the Scene fill at S07's values.
- **Tests:** per-subject fill and contour; concave and tilted forms; Opening never filled as its Wall; model with no footprint contour-only; hover untinted.
- **Browser:** each subject in both readings, overlaps, light walls on the dark mat, hidden subjects.
- **Excludes:** pick changes.

### C09a — 3D clipping

- **Files:** `packages/camera-core/src/viewport.ts`, `stage/camera-session.ts`, `stage/stage-grid.ts`, `stage/shell/StageCanvas.svelte`. Tests: `camera-viewport-evaluation.test.ts`, `stage-grid.test.ts`.
- **Rules:** [3D ground clipping](./target-specification.md#3d-ground-clipping). T3 lands Camera, then T1 lands grid and mat.
- **Tests:** ground samples inside coverage **and** clip range, classified sky, behind, near or far, across elevations 5/15/45/75/89°, azimuth quadrants and diagonals, portrait and landscape, translated targets, zoom extremes, datum changes and horizon crossing, through actual Stage wiring. Line count ≤ 6,000 with major lines intact. `displayGroundYMeters: null` matches today's evaluation exactly.
- **Browser:** orbit and zoom from overhead to shallow with the horizon in frame; no straight cut, no moiré band, no fighting close up; observably smooth.
- **Owed from the audit:** the eye-height reach term and the budget have not been run. A horizon-in-frame view is uncaptured.
- **Excludes:** semantic fit; infinite grid; timing gates.

### C01 — Roles and Head

- **Files:** new shell stylesheet, `stage/shell/EditorHead.svelte`, route. Tests: `head-find.test.ts`, `head-save.test.ts`, `head-save-journey.test.ts`.
- **Rules:** [Head](./target-specification.md#head). Every displaced capability gets a Find entry in the same PR.
- **Tests:** Find reaches each former menu capability; refusal is announced accessibly.
- **Browser:** empty, dirty and refused states; keyboard only; coarse sizes; one row at all four widths.
- **Excludes:** Index and Card content.

### C02 — Index and Card

- **Files:** `stage/shell/EditorIndex.svelte`, `stage/shell/EditorCard.svelte`, `stage/stage-facade.ts` card types, adapter contributions. Tests: `scene-object-card.test.ts`, `editor-card-confirmation.test.ts`, `layout-card-fields-lifetime.test.ts`.
- **Tests:** long and repeated names; each fact once; Duplicate not styled destructive; generated names never reach a save.
- **Browser:** select versus frame stay distinct; each action reachable by keyboard.
- **Excludes:** Height Sheet; Card gesture behaviour.

### C03a — Geometry, Card and Height Sheet

- **Files:** route, `stage/shell/StageHeightSheet.svelte`, `stage/shell/EditorCard.svelte`. Tests: `stage-shell-composition.test.ts`, `stage-height-sheet.test.ts`.
- **Tests:** no Camera movement on layout change; Card takes no pointer events during a gesture; holds position through a refusal; never expands on commit; Sheet keyboard, pins and found tops unchanged.
- **Browser:** edit a subject under the Card at 1440 and 1180; pin, drag and key height; nothing overlaps.
- **Excludes:** Ink palette; narrow sheets.

### C03b — Ink palette and constrained widths

- **Files:** `adapters/layout/LayoutInkPalette.svelte`, `stage/shell/StageInstrumentHost.svelte`, `stage/shell/EditorIndex.svelte`, route.
- **Tests:** every Ink mode and typed path retained; scrim stops above the dock.
- **Browser:** all four widths; draw with the palette open and the drawing visible; dock usable behind an open Index.
- **Excludes:** Experience.

### C04a — Experience controller

- **Files:** `experience/ExperienceSurface.svelte`, a new controller beside it.
- **Rules:** extraction only. **No visible change.**
- **Tests:** existing Experience suites unchanged.
- **Browser:** World↔Experience, Capture, View, Guide, Preview and return match before and after.

### C04b — Experience shared homes

- **Files:** Experience presentation, route.
- **Tests:** no second lens picker or Preview entry; existing suites unchanged.
- **Browser:** Capture, View, Guide, Preview and return in shared homes; history and lens parking unchanged; Guide closed by default.
- **Excludes:** new Experience capability.

## S11 addition

When registered, S11's journeys gain: Plan flip continuity across azimuths; stable snap across zoom; horizon-in-frame 3D grid; direct Wall and Junction editing; Opening editing from Plan alone; manipulation of every subject type in both readings; candidate and accepted agreement. S11 stays unlaunched until you release it.

## Evidence limits

The Plan audit used synthetic pointer events with capture stubbed in the page, in one Chromium session. Not exercised live: Box, Shape, Turn and Size, native forms, catalogue and models, Eraser, Measure and 3D direct edits; those rows rely on code and earlier acceptance. Native touch, Safari, authenticated save and reload, and a dense scene remain owed. The direct-manipulation model has not been prototyped, so C07a's browser journey is the first real test of how it feels, and O2 can be revisited cheaply then.
