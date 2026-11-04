# Review round 2: work in progress (2026-11-03)

## Continuation status

Round 2 is implemented in the working tree and awaits the owner's live acceptance.
The remaining work below records the original handoff.

- The cursor set is loaded. The selected frustum turns its View in Plan and 3D.
- Path gestures survive redraws. A bend inserts one point on release, and one Undo
  removes it. Selection only keeps a selected move's endpoint Views and path.
- Present this frames a standing View with the Normal lens through Camera without
  moving the Stage. Look through uses eased wheel travel and camera-plane pan.
- Paper's grid remains visible when the Plan target is above a sparse scene. Camera's
  orthographic depth range includes the datum, and the Grid toggle still controls the ink.
- Play restarts from the run's entry after the Guide ends, including when its last
  View is an untimed wait.
- Chromium at 1280×820 exercised path insertion, movement and Undo, 2D and 3D frustum
  turn, Selection only, Present this, Look through, welcome dismissal, the Paper grid
  and Guide replay. Paper, Golden hour and Dusk were checked at approximately 5°, 15°
  and 35°.

## Original handoff

Plan: [fix-plan.md](./fix-plan.md) § "Review round 2" (G1–G12). Design: sheet §15–§22, also
promoted to `docs/reference/design-system/experience-interaction-sheet.html`. Branch
`r217-experience-review-1`, nothing committed. Not yet type-checked or tested.

## Done (uncommitted, unverified)

- **G12 cursors:** `apps/editor/src/lib/authoring/stage/shell/cursors.css` is generated, defining `--cursor-select`,
  `add-point`, `turn`, `move`, `grab`, `grabbing`, `place-view`, `draw`, `look`, `not-allowed` and `busy`.
  It is **not imported yet**.
- **G1 turn by frustum (Plan only):**
  - `experience-view-edit.ts`: `turnViewAboutEye` and `yawFromEye`; `viewEditMoved` kind is now `'move' | 'turn'`.
  - `experience-marks.ts`: mark kind `'aim'` → `'turn'`.
  - `ExperienceMarks.svelte`: a turn mark draws `.turn-grip` (the wedge, `data-turn-grip`) under the other marks, with no hit circle and the turn cursor.
  - `+page.svelte`: `ViewEditKind = 'move' | 'turn'`. `grabYaw` is set in `beginViewEdit`; `eyePlanePoint()` is new; Shift snaps to 15°.
  - `viewEditPreview.turn` draws a ghost wedge, an arc and the angle (CSS `.turn-wedge/.turn-arc/.turn-angle`).
  - The "View moved./View re-aimed." notice is removed.

## Next, in order

1. **Wire the cursors.**
   - Import `cursors.css` next to `shell-roles.css` in `+page.svelte`, around line 153.
   - Stage `data-cursor` (around line 5800): `viewEdit` → `move`/`turn`, `drag?.mode` pan or orbit → `grabbing` (`drag` is a plain `let`, so make it `$state` or mirror it), `lookThroughSession` → `look`, `experienceTool==='place'` → `place-view`, `hoverMove` → `move`, ink or host tool → `draw`, else `select`.
   - Replace the `.stage { cursor: grab }` rules (around line 6390) with `var(--cursor-*)`.
2. **G7 path drag. Root cause found:** `ExperiencePaths.svelte` cancels a drag when `evaluation.token.evaluationGeneration` changes. `camera-session.evaluate()` bumps that on *every* refresh, and the bubbled pointermove makes the Stage refresh, so every drag self-cancels.
   - Compare `outputId::sessionEpoch::sourceRevision` instead.
   - `stopPropagation` on pointermove and pointerup during a drag.
3. **G7–G9 path editing in `ExperiencePaths.svelte`:**
   - Remove `plusHandles` and `.plus`.
   - Press and drag on the selected route: preview a point; on release call `controller.addPathAnchor(final, undefined, near)`. Add a `near` parameter in `experience-controller.svelte.ts` around line 1636 that resolves the slot from the press point. This keeps it one write and one Undo.
   - A click does not add. Double-click adds, and double-click on a point removes it.
   - Hover shows `cursor: var(--cursor-add-point)` and an SVG hint tag "Drag to bend · double-click to add a point", hidden after the first edit.
   - Anchors are r=3 dots; the hovered one grows.
   - Remove the dock's Path tool (`ExperienceDock.svelte`: `pathArmed`, `pathReason`, `onPath`) and its route wiring.
   - Make the path messages silent: `() => ''` instead of 'Path point added/moved/removed'.
   - Update `tests/lib/experience/camera-paths-components.test.ts`: the click-adds test becomes drag-adds.
4. **G10:** in `ExperienceMarks.svelte`, `selectionOnly` keeps only `selected`/`strong` marks. Add `relatedToSelection` in `experience-marks.ts`: a selected transition keeps both end Views, its camera, frustum and label.
5. **G2:** `+page.svelte presentThis` (around line 1232) records the editor camera pose after `bring-into-view`. Compute a framed pose instead, using camera-core framing as a pure query (Normal lens, 1.65 m eye, the side facing the viewer), and do not move the Stage.
6. **G4/G5:**
   - `onWheel` look-through branch (around line 4300): make the step proportional to the delta and eased over ~120 ms, with no 0.25 m quantum.
   - Add a `truck` intent in `packages/camera-core/src/viewport.ts`, next to `turn`/`step` (around line 291 and 1310). Wire it to `camera-session` as `truckLookThrough` and to right-drag or Shift-drag in look-through.
7. **G6:** in `StageMatGround.svelte`, the plate sits at −0.004 and the ShadowMaterial catcher at −0.002, over the flat environment ground, so they z-fight.
   - Give the catcher `polygonOffset` and `depthWrite:false`.
   - Drop the environment ground in `WorldEnvironment.svelte` by about 0.05 m, with `depthWrite:false`.
   - Set the sun `normalBias` to about 0.05.
8. **G3/G11:**
   - Replace `.experience-coach` (`+page.svelte`, around line 6090; `EXPERIENCE_COACH` in `experience-marks.ts`) with a lower-left welcome card. It shows once, with localStorage key `museum.experience.welcome-dismissed` inside try/catch, and has a "Got it" button.
   - Silence the routine `succeed(...)` toasts in the controller: View placed, Framing updated, Renamed, View moved to position.
9. **Check and verify:**
   - Fix the tests that reference `data-mark-kind="aim"` (`tests/lib/authoring/spatial-route-experience-homes.test.ts:318`) and `viewEditMoved('aim')` (`tests/lib/experience/experience-view-edit.test.ts`).
   - Run `npm run check` and the editor tests.
   - Browser test project: run `python3 <scratchpad>/tools/cors.py <scratchpad>/serve` (port 8897), open `localhost:5173/project/project:93171254-42d9-483f-89bd-7142aee0b88a/spatial?create=1`, and load `x-paths5.json` through *Open source JSON* → Replace.
