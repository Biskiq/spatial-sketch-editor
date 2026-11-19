# V1c — Region authoring, Lift and Stage parity

**Status:** correctness recovery, automated acceptance and the raised-platform browser journey
complete; real-browser QA remains **partial** outside that journey. This round fixed the
body-drag selection loss, the unreachable corner removal, raised-platform primitive placement,
the 3D body-drag plane and the Region's resting-copy grammar, and verified placement, movement
and Erase at a non-zero resting count in Chromium alongside J7 open-to-sky/association/intended
gaps, J11 Lift/height edit/Put back, 3D Region picking, Slice, Terrace **Line** creation and a
Space fit with exact Undo/Redo. A later review follow-up (uncommitted) fixed the Stage-local
height ray, the raised body/turn plane, the gap-cue endpoints, the Erase wording and the
edge-add control grammar; its changes are covered by the automated runs below. Approved-model
placement, as-built Preview and the complete J7/J11 scripts remain unverified (see **Browser QA
gaps**). No production deployment was made, and this evidence does not declare the PR ready for
review.

## What was implemented

- **Create.** `Terrace` (floor) and `Roof › Flat` (overhead) arm the existing Ink task with the
  new built-in readings; Box and Line use the existing draft, height-ray and Finish grammar.
  Elevation is the Height Sheet's height, an overhead at the Floor datum takes the Wall creation
  default (3 m), and new Regions start at 0.10 m. Birth is one captured planner intent; Undo
  removes it and Redo reuses the captured id.
- **Edit.** Corner knobs, corner removal on the chord, edge pick then the Card's scoped
  **Add corner here**, body move, rotation, elevation ray, Card thickness and exact Width/Depth,
  thumbnail-free duplicate,
  measured relations, one-shot fits, intended gaps and Erase all use retained region planners
  through F4. A release is one history entry; a refused or no-op release writes no document.
- **Card, relations and index.** `LayoutRegionCard.svelte` writes kind, name, both elevation
  readings, thickness, Width, Depth, Area, derived **Relations** (`Meets`, `Crosses`, measured
  `Gap`, intended gaps), per-relation fit/Mark intended, Space/Wall fits, Duplicate and the
  Erase disclosure. The selected Region's gaps are measured Stage dimensions; an unselected
  Region draws no cue. Height Sheet ticks expose tops and undersides. The Index has one
  **Regions** group, and a Space Card lists its Regions and reads **Open to sky · under name**
  where a Flat Roof applies.
- **Lift, Stage and shadow.** Lift consumes the typed `OverheadSource` list from
  `overheadSourcesOf`; floor Regions remain in the world and Flat Roofs are lifted beside Room
  lids. The region representation uses `LIFTED_RENDER_LAYER`, and every point, spot and sun
  shadow camera enables that layer. Plan and 3D outline picking resolve the lifted Region's
  own fragment; Put back, as-built Preview and Look-through are unchanged.
- **Resting objects.** A floor Region's Card and Erase action disclose the shared
  `restingObjectsOnFloorRegion` count before the operation. The reader supplies approved model
  contact from the accepted `model` resource or the verified catalogue record through
  `$lib/authoring/model-contact`; Layout does not depend on the Scene adapter and does not guess
  contact from a mesh. Card and Eraser cannot disagree because both call the same reader. A
  failed resolution is no longer converted to `0` by a local `catch`.

## Recovery findings and fixes

1. **OD-4 model contact.** `countSceneRootsOnFloorRegion` was called without
   `modelContactMinY`, so approved imported models resting on a Terrace were omitted. The
   resolver moved from the Scene adapter to neutral `$lib/authoring/model-contact.ts`; Scene
   Compose re-exports it, and Layout's shared reader passes it into the support seam.
2. **Card/Eraser divergence and swallowed failures.** Both callers now use
   `restingObjectsOnFloorRegion(snapshot, regionId)`. The two `catch { return 0 }` blocks were
   removed. The new creator-model fixture proves the approved model counts before a Layout-only
   move and does not count after the platform moves away.
3. **Browser blocker — no Layout Ink dock for Terrace/Roof.** The spatial route's `plateKind`
   omitted `terrace` and `roofline`, so those World tools armed but never rendered the Ink plate.
   Both are now included. This was a genuine V1c integration defect, not shared infrastructure.
4. **Browser blocker — region draw cancelled on first move.** A region press did not acquire a
   Stage gesture lease, so `stage-input` cancelled the adapter drag on the first pointer move.
   	`region-ink-session` now acquires `layout-region-draw` with
   `cancel-on-reading-change`, publishes a refusal when another owner holds the pointer, and
   releases the lease idempotently on clear/up.
5. **Corner removal was unreachable on a raised Region.** Two causes compounded. The pointer
   mapped onto the **floor datum** (`pointerDatumPoint`), while a Region's corner is drawn at
   `datum + elevation`; a raised corner therefore trailed the cursor by the elevation's
   parallax, so a visibly-on-chord pointer never named the chord in the footprint's world
   coordinates. Second, removal measured the **snapped** corner, while the bend rule measures
   the raw pointer, so the 0.5 m Snap could hold the corner outside the 0.12 m zone. A new
   `pointerWorkingPlanePoint` maps a pointer at an explicit elevation; corner press and move use
   `datumMeters + region.elevation`, and removal measures the raw pointer. Regression coverage:
   `layout-region-authoring.test.ts` removes a corner in one entry and Undo/Redo restores it.
6. **Raised-platform placement refused after a surface refresh.** The placement binding
   re-armed its pending tile on every surface refresh through `session.setPlacePrimitive`, which
   unconditionally cleared `candidatePlaceChoice` while leaving the live candidate in place. The
   release then committed a shown pose without the support it was pinned to and the planner
   refused `support-choice-required` ("2 floor contexts or elevations support this point").
   `setPlacePrimitive` is now idempotent when the primitive is unchanged and no model or copy
   is armed, and `applyPendingArm` only re-arms when the session's primitive differs. Coverage:
   `scene-editing-surface.test.ts` keeps the pinned raised support when the armed tile is
   re-applied before release.
7. **3D body drag grabbed on the datum plane.** The body press mapped the pointer with
   `pointerDatumPoint`, which returns the intersection with y=0. A Sphere resting at 1.20 m was
   therefore grabbed metres behind its visible body, and the first move jumped it toward the
   camera and off the terrace. A new `pointerPlanePoint(context, css, elevation)` maps the
   pointer at an explicit elevation; the body press and move grab plane now use the object's
   own base plane (`entity.position[1] + scale * contactMinY`), and `pointerDatumPoint`
   delegates to it. `move-horizontal`'s keep-the-height semantics are unchanged, so moving
   within the terrace preserves 1.20 m. Coverage: `scene-editing-surface.test.ts` keeps a
   raised object under the pointer when a 3D body drag crosses its terrace.
8. **Move over a raised Terrace was ambiguous.** Object Move previews and releases through
   `planPlaceOnFloor` (a re-seat), but the mark planner passed no support choice. A point with a
   terrace over a room floor therefore refused `support-choice-required`, and no move ghost was
   produced. The drag now pins the elevation of the face the pointer visibly stands on
   (`support.worldPoint[1]` plus the support generation) in its preview, and the released
   `place-on-floor` intent carries the same `supportChoice`. Card grammar also reads the
   singular `1 object rests on this platform`.
9. **Region Card closed when a body move was released.** Requalifying the selection after the
   accepted edit treated the Region's Plan fragment as an F.1 component. A Region's fragment
   names the compiled `edge` stream, while `layoutSelectionReference` intentionally stores
   `componentId: null`, so the comparison `null !== 'edge'` retired the subject and the shell
   closed the Card even though the edit installed. `selection-requalification.ts` now derives
   the F.1 component through `f1ComponentOf`, which returns `null` for `sourceKind: 'region'`,
   and the entry path ignores a Region representation's component. Coverage:
   `layout-region-authoring.test.ts` moves a Region selected with an `edge` representation and
   asserts the selection survives; `stage-host-acceptance.test.ts` pins the requalification
   rule directly.

Temporary instrumentation used to diagnose the browser blockers was removed before the final
runs; no diagnostic `console.log`, `console.error` or catch was left in the source.

## Review follow-up (P2/P3)

10. **Height rays used Stage-local CSS as viewport CSS.** `beginHeight` and `moveHeight` passed
    `intent.css` straight to `ctx.ray`, which subtracts the evaluation rect; on an offset Stage
    the gesture tracked a different ray from the pointer. A new `pointerViewportRay` applies the
    one translation, and both height samples use it. `layout-region-authoring.test.ts` runs the
    same height gesture at a zero-origin and an offset rect and asserts the same accepted
    elevation.
11. **Raised body and turn drags aimed at the datum.** Both gestures intersected y=0 while the
    slab and turn mark are drawn at `datum + elevation`. They now store the Region face plane at
    press and project every sample there, matching the corner gesture. The mounted 3D test
    presses and drags on the 1.10 m terrace face; the body delta is `+1.0 m` in X and the turn
    target produces a 45° rotation.
12. **Gap cues did not use the measured surfaces.** The cue connected a footprint corner to a
    Wall centerline sample while the label measured to the Wall body, and a vertical Terrace
    gap started at the slab top (the label measures to the underside). `RegionWallRelation` now
    owns `measureSegment`; `regionWallRelations` computes it from the same nearest footprint/
    Wall-body pair the measure reads, using `slabBottomY` for a vertical gap. The mounted test
    asserts the projected cue equals the relation's endpoints; `layout-region-planners.test.ts`
    asserts horizontal length `0.20 m` to the body face and a floor vertical gap of `0.10 m` to
    the underside.
13. **Erase disclosed a support that is not preserved.** The copy now says the counted objects
    **stay where they are** when the platform is gone, so the creator can judge that the
    authored world pose may be left suspended.
14. **Add corner was a persistent midpoint handle that wrote on press.** Section 5.9 asks for an
    edge-scoped list action. Region edges now expose one hover-only picker; pressing it only
    records the edge and writes nothing. The selected Region's Card action list then offers
    **Add corner here**, which inserts the midpoint through the same one-entry footprint
    planner. The mounted test asserts no document or history change on the pick and one exact
    entry on the action, with Undo restoring the footprint.

## Automated evidence

| Acceptance | Evidence |
| --- | --- |
| T-V5 | `layout-region-planners.test.ts` fit/relation/refusal coverage, including the relation's measurement endpoints against the Wall body and slab underside; `layout-region-authoring.test.ts` Card surfaces, measured selected gaps and no cue when unselected |
| T-V7 | V1b `layout-regions.test.ts`, `layout-room-lift-action.test.ts`; `layout-region-authoring.test.ts` Space association, Card delete/Undo and Lift sources (a floor Terrace is not lifted) |
| T-V11 | `lift-shadow-eligibility.test.ts` (lifted layer on point/spot/sun shadow cameras, negative control), `scene-region-support.test.ts`, `layout-outline-pick.test.ts`, `layout-region-authoring.test.ts` Lift/Put back and floor-Region retention; `scene-editing-surface.test.ts` raised-support placement and 3D body-drag support retention |
| T-V12 | `layout-region-authoring.test.ts`: body move, corner and height accept/Undo/Redo; birth Undo/Redo with captured id; Card delete Undo; refused birth adds no history; Esc adds no history |
| T-V13 | `layout-region-authoring.test.ts`: exact corner/body/height previews equal accepted geometry; an edge pick writes nothing and the Card's scoped Add corner action is the one entry; `compile` count 0 and no intents/history during pointer movement; exactly one F4 entry; exact Undo/Redo; corner removal on the neighbours' chord in one entry; corner click and degenerate corner are no-ops; stale intent refused; Esc restores; a Region selected from its `edge` stream keeps its selection and Card across an accepted body move |

`scene-editing-surface.test.ts` is now **79 tests**, including the two raised-support
regressions above (pinned support across a re-arm, and a 3D body drag over a terrace) and the
Scene Move/Mark suites. Focused coverage in `layout-region-authoring.test.ts` is **19 tests**:

- every retained region planner and the Card surface;
- body move in one history entry with Undo/Redo;
- a Region selected through its `edge` stream stays selected after an accepted body move;
- corner removal on the neighbours' chord in one entry, with exact Undo/Redo;
- corner preview equals the installed footprint, with zero Layout compiles and zero history
  writes during the drag, then exact Undo/Redo;
- body preview equals the installed footprint, with no compile/history before release;
- height-ray preview equals the installed footprint, one entry, exact Undo/Redo;
- the same height gesture reads the same elevation through an offset Stage rect;
- a 3D raised body drag stays on the slab face and the turn mark rotates at the face's rate;
- picking an edge writes nothing, and the Card's scoped Add corner action inserts one corner
  in one entry with Undo;
- click and degenerate corner are no-ops, and a stale edit intent is refused;
- Esc during corner drag writes no document and no history;
- Terrace Box at the Height Sheet with Undo;
- Flat Roof Line birth at the datum default;
- overlapping birth refusal keeps the draft and adds no history;
- selected Region measured gaps, no cue when unselected;
- approved creator model resting on a raised Terrace counts `1`, moves to `0` after a body move,
  keeps Scene bytes identical through move and Erase, and Undo/Redo restores the count without a
  Scene write;
- Space Card association and Card delete with Undo;
- Lift names the overhead beside the Room lid, excludes the floor Terrace, and Put back ends it.

Commands run from `apps/editor` on the final tree:

- `npm run check` — 0 errors, 18 pre-existing warnings.
- `npm run test:arch` — 38 files, 350 tests passed.
- `npm run test:fast` — 433 files, 5361 tests passed.
- `npm run test:heavy` — 11 files, 138 tests passed.
- `npm run test -- tests/lib/authoring/scene-editing-surface.test.ts tests/lib/authoring/layout-region-authoring.test.ts`
  — 98 tests passed (79 and 19).
- `npm run test -- tests/lib/layout/layout-region-planners.test.ts` — 35 tests passed,
  including the relation measurement endpoints.
- `npm run build` — passed.
- `node tools/harness/check-docs.mjs` (repository root) — passed.
- `node tools/harness/guards.mjs --base cd5222fc --head HEAD` — no unapproved check or bug-state
  change (earlier round).
- `node tools/harness/guards.mjs --base cd427bdc --head HEAD` — no unapproved check or
  bug-state change (this round). CI remains the authority for the merge gate and `linux-x64`.
- The review follow-up is **uncommitted**: the guard and CI results above describe `d9e37e56`,
  not the working tree with these fixes.

## Browser environment and project setup

- Local stack: `npm run dev:local`; editor `http://localhost:5177`, API `47493`, Postgres `47491`,
  objects `47492`.
- Real Chromium through the local `agent-browser` CLI, headed, with synthetic mouse moves/down/up,
  keyboard input, page reloads and screenshots. No mounted test was used as browser evidence.
- QA account: local `t1v1c-qa-2026`. Two saved projects were used:
  `project:7e8c49a2-2a49-4ca9-b7d9-6e9f453ec139` (the original Terrace-only project) and
  `project:96cdddf3-8455-4c93-8605-0a0cb68d6f98` (created empty in the previous round: a
  4-Wall Room, 24.0 m² at 3 m, plus a Flat Roof at 1.20 m; this round added a three-corner
  Line Terrace fitted to the Room and a Scene Box on the floor).
- Viewport: 1200 × 632 CSS px at device scale 2 during this round (earlier captures used
  1200 × 627). Stage handle positions were read from `[data-mark-id]`
  `getBoundingClientRect()` before each pointer sequence; screenshots are 1.67× the CSS
  viewport.
- The original project was loaded through
  `http://localhost:5177/project/project%3A7e8c49a2-2a49-4ca9-b7d9-6e9f453ec139/spatial?load=1`;
  this round's project through
  `http://localhost:5177/project/project%3A96cdddf3-8455-4c93-8605-0a0cb68d6f98/spatial?load=1`.

## Browser QA executed

### Creation and direct manipulation

- **Terrace Box created with the mouse.** `Form › Terrace`, Box, drag on the Plan. The new Region
  opened its Card and the exact fields read elevation `1.350 m`, thickness `0.20 m`, width
  `3.00 m`, depth `2.50 m`, area `7.750 m²`
  (`v1c-browser-01-terrace-plate.png`, `02-terrace-box.png`, `03-region-exact.png`).
- **Corner drag.** The bottom-right corner moved from `3.00 × 2.50` to `3.98 × 3.48 m`; the live
  preview and the accepted footprint are shown in `08-corner-preview.png` and
  `09-corner-accepted.png`. The Card kept elevation `1.35 m` and thickness `0.2 m`.
- **Height ray.** Dragging the height grip raised elevation from `1.35` to `2.66 m`; the preview
  label read `Elevation 2.661 m` and the accepted Card read `2.66 m`
  (`11-height-preview.png`, `12-height-accepted.png`).
- **Rotation.** Dragging the turn mark produced a live `13.4°` arc/label; after release the
  accepted footprint was rotated and the area stayed `10.20 m²`
  (`13-rotation-preview.png`, `14-rotation-accepted.png`).
- **Add corner.** Pressing the top edge's hollow **Add corner here** mark added a fifth corner;
  the overlay then exposed five corner marks and five edge marks
  (`15-add-corner.png`).
- **Body drag and the Card defect.** A selected body drag previewed
  `Δx 0.80 · Δz 0.60 m` while Width/Depth stayed `3.00 / 2.50 m`
  (`28-body-preview.png`). Before the fix, release accepted the edit but cleared the selection
  and closed the Card (`29-body-accepted.png`); the instrumented session reported
  `{"kind":"cleared","reason":"subject-retired"}` because the Region's `edge`
  representation was compared with its null F.1 component. After the fix the same gesture left
  all ten marks selected and the Card open (`31-body-retained.png`).
- **Duplicate.** The Card's Duplicate produced a second Terrace in the Stage
  (`18-duplicate.png`).
- **Erase and Undo.** With Erase armed, a real Stage press removed the Terrace immediately; the
  Index showed no matching subjects (`24-erase-target.png`). The Undo button restored Region 1
  (`25-erase-undo.png`). No confirmation was presented because the resting count was `0`.
- **Save/reload persistence.** Changing thickness to `0.30 m` and committing with Tab enabled
  **Save changes**; saving showed **Saved**. After a full reload, selecting Region 1 again read
  thickness `0.30 m` with elevation `1.35`, width `3.00` and depth `2.50 m`, so the edit and
  Region identity persisted (`23-save-reload-thickness.png`).

### Stage and presentation

- The selected Region rendered its corner, edge, turn and height marks in Plan and its 3D
  representation in the 3D view (`07-region-handles.png`, `10-region-3d.png`).
- The Card read `0 objects rest on this platform` and `No Wall reads against this region yet.`
  for the unassociated Terrace.
- No browser console exception was observed in the clean post-fix runs. All temporary
  diagnostics were removed from the source before the final checks.

### J7 — overhead Region, Space association and intended gaps

- A fresh project (`project:96cdddf3…`) was drawn as a 4-Wall Room, 24.0 m² at 3 m, saved and
  reloaded (`32-room.png`).
- Room Card `Overhead: Open to sky` removed the Room lid while the Walls and floor remained
  (`33-open-to-sky.png`).
- `Form › Roof › Box` at the Height Sheet created a Flat Roof at `1.20 m`; the Card read
  Width `2.74 m`, Depth `2.45 m`, Area `6.70 m²`. Relations read
  `Wall 1 Gap 0.23 m horizontal` and `Wall 2 Crosses`; **Mark intended** changed the first to
  `Gap 0.23 m horizontal · intended` and **Clear intended** restored the measured reading.
- The Region was renamed `Canopy 1` through the Card name (double-click, type, Enter).
- The Space Card read `Overhead: Open to sky · under Canopy 1` and
  `Regions: Canopy 1 (overhead)` (`34-space-under-canopy.png`).

### J11 — Lift, height edit and Put back

- `Room 1` actions → **Lift** showed the pill `Lift · Room 1 ▾ · Put back`; the Room lid and the
  Canopy drew dashed lifted outlines (`35-lift.png`).
- Pressing the lifted Canopy outline selected it with ten marks. Dragging its height ray
  previewed `Elevation 2.001 m` and the accepted Card read `2.703 m`
  (`36-lift-height.png`).
- `[data-lift-put-back]` ended Lift and restored the unlifted rendering.
- The Preview control is disabled with
  `Create an Experience in the Experience lens to Preview it.`, so J11's as-built Preview step is
  unreachable in this project (no Experience was authored).

### 3D picking, Slice and Look-through

- In 3D, a press on a Room wall opened `WALL Wall 3`; a following press on the raised Canopy's
  3D fragment opened `REGION Region 1` (`37-region-3d.png`, `38-3d-pick.png`), proving Plan and
  3D source picking for an authored Region.
- `Build › Slice` produced `Cut at 1.20 m` with `To the floor`; **Put back**
  (`[data-slice-put-back]`) ended the cut (`39-slice.png`).
- **Look-through is not exposed in this build:** the More readings menu contains only Lift and
  Near walls **Cut/Whole**, so there is no control to exercise the journey.

### Corner removal, Line creation and a Space fit

- **Corner removal.** On the raised Flat Roof (`1.20 m`), dragging the top-left corner onto the
  chord between its neighbours showed `Remove corner`; release halved the area `6.70 → 3.35 m²`
  and left three corners and eight marks (`41-corner-removed.png`). Undo restored `6.70 m²` and
  ten marks; Redo returned `3.35 m²` and eight (`42-corner-redone.png`).
- **Terrace Line.** `Form › Terrace › Line` placed three Plan points; Enter closed the ring
  (the plate's Finish control sat under the tool nav at this viewport) and created `Region 2`, a
  Terrace reading elevation `1.20 m`, area `4.01 m²`, with its Card open
  (`45-line-created.png`).
- **Fit to space.** After a real body drag moved the Line Terrace inside the Room, the Card's
  **Fit to space** became enabled. It expanded the terrace from `4.01` to `24.00 m²`, Width
  `6.00 m`, Depth `4.00 m`, and the relations changed to all four Walls `Meets`
  (`47-space-fit.png`). Undo restored `4.01 m²`; Redo returned `24.00 m²`.

### Raised-platform placement, movement and resting Erase

- The saved Room project (`project:96cdddf3…`) already held `Region 1`, the Line Terrace fitted
  to the Room at **1.20 m**, and `Region 2`, the 1.20 m Flat Roof outside the Room. Their
  footprints do not overlap, so no support at 1.20 m was ambiguous.
- `Furnish › Objects › Sphere`, then a real press on the terrace top in the Plan created
  `Primitive Sphere` resting visibly on the slab. Selecting `Region 1` read
  **`1 object rests on this platform`** — both the non-zero count and the singular grammar
  (`52-terrace-resting.png`). This is the gesture that previously refused with
  `support-choice-required` (`50-resting.png`, `51-resting2.png`).
- In 3D the Sphere was selected and body-dragged +20 × +9 CSS px with a real press/move/release.
  The Sphere stayed on the slab rather than jumping toward the camera; the accepted move left
  **Unsaved changes**, and selecting `Region 1` again still read `1 object rests on this
  platform` (`53-3d-moved.png`). `Save changes` then read **Saved**.
- With `Region 1` selected, pressing `E` armed Erase and one real press on the terrace top
  produced the non-zero disclosure (`54-erase-disclosure.png`); the text at capture time read
  `1 object rests on this platform and keeps its Scene support when the platform is gone. Walls
  are unchanged. Click again to erase.` The review follow-up changes that sentence to **stays
  where it is**; the screenshot predates the wording and was not re-captured. Escape cancelled
  the armed erase without deleting the Region; the disclosure names the count rather than
  performing the erase.

## Browser QA gaps

The following required journeys were **not executed acceptably** and are not claimed:

- Approved-model placement, authored world-pose retention and saved-form placement on a raised
  Region were not re-executed; their automated fixture coverage is listed above.
- **Flat Roof Line** creation (Terrace Line is covered; Roof creation used Box).
- Rotation, Duplicate and Erase at a non-zero count followed by Undo were not re-executed this
  round (earlier runs covered rotation, Duplicate and Erase at count `0`). The non-zero Erase
  **disclosure** is verified; the deletion it offers was deliberately not performed.
- As-built **Preview** (blocked by the missing Experience) and **Look-through** (no control).
- Coplanar Region/Room-floor priority and the visitor-output leak check.
- The complete J7 and J11 scripts.

There is no external infrastructure blocker except the unprovisioned approved model and the
missing Experience; the remaining gaps are unfinished QA. The review should therefore treat V1c
as **not accepted** until the browser matrix is completed.
