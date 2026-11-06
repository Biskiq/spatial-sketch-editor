# Experience review 1: gaps and fix plan

**Historical record.** The current plan is [fix.md](./fix.md) (review 2); where they disagree, fix.md and [AM-11](../../../reference/composition-execution.md#am-11-guide-pacing-explore-and-return) win.

**Owner review of R217.S26–S30, 2026-11-03: not accepted.** The functionality works. The UX and UI
fall short of [Conservatory](../../../../prototypes/experience-ux-alternative/README.md). This is the
one correction pass the S26–S30 register rows allow for. The owner is the only acceptance: each round is
one PR from the latest `main`, and the owner accepts it by using the editor.

**Visual reference:** [Experience interaction sheet](../../../reference/design-system/experience-interaction-sheet.html).
It consolidates the accepted demonstrations. Production code and tests remain behavioral authority;
Git history preserves the research variants cited by this historical plan.

**Design settled 2026-11-03** (Detailed camera, Forest start page, everything else ★). The sheet is
promoted to [reference](../../../reference/design-system/experience-interaction-sheet.html). R1–R5 were
implemented together on this branch, not as five PRs, at the owner's request; acceptance is the owner's
eye test.

## Status after implementation (2026-11-03)

Implemented: B1–B11 and D1–D13 as planned, with these differences, each for the owner to accept or
send back:

- **B1:** the snapshot loop is gone. Leaving Preview now takes about 1.1 s to the first frame in the dev
  build (was 16.7–17.2 s), with no freeze. It is not under 200 ms, because the Stage still remounts after
  Preview.
- **B3:** Travel on a Stop's continuation adds its path in the same change. Travel *inside* a Stop
  (between its Views) does not add one yet. The dock's Path tool is still shown, though paths no longer
  need it.
- **D2:** unselected Views draw a short wire (0.42 m); the full frustum (1.2 m) is for the selection.
- **D11:** the welcome is restyled, but it still opens over the outside overview, not the first Stop's
  opening View.
- **R5:** the picker is in the Stage's ⚙ panel, not a World Inspector; the editor has no empty-selection
  Card to host it. Under an environment the 3D mat and its grid give way to the environment's ground,
  so Grid draws only on Paper. "Plain Paper while editing" also changes the snapshots. The published
  route `/p/…` still renders Paper.
- **Scene format 5:** a saved project with Scene 4 is refused (bump + strict refusal, no migration).
- Not touched: the Replace-project dialog keeps its old purple style; the start page shows no Recent
  list (the page has no project list to read).

## Owner picks (2026-11-03)

| Sheet | Pick |
| --- | --- |
| §1 Look through | Full Stage with safe-frame ticks |
| §2 Views | A camera in 3D, turned with the aim, with the wire frustum from the lens and the height stem; dot + short wedge in Plan. Camera style: **Detailed** (body, viewfinder, shutter, barrel) |
| §3 Paths | Ribbon + chevrons |
| §4–§6 | As recommended: handles on the route, Travel adds a straight path, links in the Guide gutter |
| §7 Toolbar | Light glass, **shared by the World and Experience Stage toolbars** (2D \| 3D ⚙, Grid · Snap, and Show in Experience) |
| §11 Preview | The guided tour gets **Prev**: a Cut back to the previous Stop's first View, no travel back |
| §9 Opening | **Forest** start page; shell-first loading tile |
| §12 Environment | R5 as proposed: four presets, Paper by default |

## Confirmed findings

Reproduced at `83a83e46` with the `x-paths` fixture admitted through *Open source JSON*, in a
1024 px browser. "Cause" points to the code involved.

### Bugs

| # | Finding | Cause |
| --- | --- | --- |
| B1 | **Leaving Preview freezes the editor.** Exit blocks the main thread for 16.7–17.2 s in one long task (reproduced twice). After that, 2D/3D and the Guide stop responding and every snapshot goes blank | `effect_update_depth_exceeded`: the `revision` effect in `StageSnapshotRenderer.svelte` calls `invalidateStageSnapshots()`. Each `ExperienceSnapshot.svelte` listener then bumps `epoch` and asks for a new render, and the loop repeats. Svelte throws an uncaught error and stops updating the page |
| B2 | **Look through is janky.** Drag spins or jumps. One trackpad flick goes from 24 mm to 85 mm | `reaimLookThroughRay` (`camera-session.ts`) aims along the pointer ray from the pose that has already turned, so the camera chases the pointer. `onWheel` steps a whole lens preset on every wheel event |
| B3 | **Choosing Travel shows a technical warning and stops playback.** A full-width banner lists a JSON path, internal ids and `(travel-gap)`. The Guide drops to 0:00 with Play and Follow disabled, and Duration shows "–". Preview refuses to start, and its toast is hidden behind the Guide | Travel creates no Camera connection (E11). `sourceFindings` is shown as a page banner. One gap makes the whole playback map unavailable |
| B4 | **Paths can't be edited.** With the Travel selected, even with the Path tool armed, clicking the route selects a nearby View and the tool switches off. Short routes are hidden under View markers and cones | Hit-testing gives marks priority over the selected route. Adding a point needs a separate armed tool |
| B5 | Transition chips cover the Stop card titles in the Guide | Chips are positioned over the card edges, not in a gutter between cards |
| B6 | Snapshots are dark. Index Presentation rows never render one, and the Transition Card's leaves/arrives tiles stay placeholders | `StageSnapshotRenderer` clears to `MAT_BACKGROUND_INK` (#1d3a33) with no ground. Some slots never request a render |
| B7 | A View that is about 24 mm reads "Custom · 24 mm" and no Lens step lights up. Views captured on the Stage never match a step | `findMatchingLensPreset` uses a 0.1° tolerance, while the label rounds to whole millimetres |
| B8 | Clicking a View marker draws a blue browser focus box | `ExperienceMarks.svelte` sets `tabindex="0"` and has no focus style |
| B9 | *Take the guided tour* on the welcome started at "Stop 4 of 6", the Stop focused in the editor | The Preview entry uses the editor's focus for the guided start |
| B10 | The Look-through HUD pill covers the Stage toolbar (Show ▾). The Card repeats Exit/Update | Pill placement; the Card and the HUD both show the same actions |
| B11 | Every change toasts "Accepted.". Refusals and source errors put ids and JSON paths in toasts | The controller's default success notice; raw refusal text reaches the UI |

### Design gaps

| # | Gap | Sheet |
| --- | --- | --- |
| D1 | Look through is a small inset, not the full Stage | §1 |
| D2 | Views: 3D icon chips with no frustum, aim or height; 2D draws long overlapping cones for every View | §2 |
| D3 | Paths have no direction. In 3D they lie flat with mono "CUT" captions | §3 |
| D4 | Paths have no editing handles; the Card shows "0 points" and a disabled Straighten | §4 |
| D5 | The Transition Card is thin: placeholder thumbnails, mono values, no mini map, no *Preview this move* | §5 |
| D6 | The Guide strip and timeline: chips overlap cards, thumbnails are dark, playback isn't in the header | §6 |
| D7 | Selection uses a blue box instead of the shell's gold | §2 |
| D8 | Show is a white pill next to dark controls, and its menu uses browser checkboxes | §7 |
| D9 | Messages use technical words, a page banner and generic toasts | §8 |
| D10 | The start page (`/`) is a dark purple card from no part of the shell, and opening a project shows a black "Opening Spatial…" page | §9 |
| D11 | The Preview start is a grey card over a view from outside the building | §11 |
| D12 | The Preview scene is a black void with flat light, and the tour controls are plain | §11 |
| D13 | The World has no environment: the Stage is always Paper with fixed lights, and nothing sets a sky, horizon or light for Preview and visitors | §12 |

## Decisions this pass changes

- **Travel makes its path** (reverses [E11](../r217.s26-experience-authoring-depth/owner-decisions.md#e11)):
  choosing Travel submits the transition change and a straight Camera connection
  (`camera-connection-create`) as **one accepted change with one Undo**. Timing is set to Auto at once.
  Switching back to Cut leaves the connection in place for later.
- **Look through fills the Stage** (replaces S28's 16:10 inset beside the Card). Drag turns the view
  relative to where you pressed. Scroll steps forward and back in 0.25 m steps. Lens moves to the Card.
  Turning and stepping go through Camera: add bounded `turn` (yaw/pitch deltas from the pose at the press)
  and `step` (move the eye and target together along the level aim) viewing intents in
  `packages/camera-core/src/viewport.ts`, next to `aim`, `lift` and `lens`. This is the only Camera
  change. The editor sends deltas and never computes a pose.
- **Messages** follow the rules in sheet §8: say it on the subject, use the creator's names, one action,
  no page banners, no toast for success the creator can already see.

## Rounds

Each round is one PR from the latest `main`. Order: R1 → R2 → R3 → R4 → R5. R1 can ship alone.

### R1: blockers

B1, B2, B3, B4, B5, B7, B8, B9, B11, and B10's pill placement.

- B1: break the loop. Invalidate snapshots only when `revision` really changes, so an invalidation can't
  re-trigger itself, and keep requests from writing state the effect reads. Leaving Preview must not
  re-register the renderer repeatedly. Exit should take under 200 ms.
- B2: `turn` and `step` intents (above). Accumulate wheel input with a threshold. The wheel no longer
  changes the lens.
- B3: implicit connection as described above. A gap left by old or imported data makes only that link
  unplayable, not the whole Guide.
- B4: when a Travel is selected, its route and handles are hit-tested first, and other marks are dimmed
  and stop taking clicks. Remove the armed Path tool.
- B7: match a lens step within 1 mm of focal length.
- B9: *Take the guided tour* starts at Stop 1. "Preview from this Stop" stays a Guide Card action.

**Done when:** you can leave Preview and keep editing straight away; drag and scroll in Look through feel
smooth; Travel plays straight away with one Undo; you can add and drag points on any selected route;
chips don't cover titles; no blue box; no "Accepted." toasts.

### R2: Stage representation

D1, D2, D3, D4, D7, D8 (sheet §1–§4 and §7).

- Look through on the full Stage with a gold edge and 16:10 safe-frame ticks. Toolbar and marks hide.
  One HUD; the Card shows Framing only.
- 3D Views: a small camera in the style the owner settles in sheet §2 (★ Soft block), in the World
  sticker finish: white faces, one ink outline, soft shadow. The wire frustum starts at the lens; height
  stem and tag; stop badge.
- Many Views stay cheap: each camera is one merged mesh with shared materials, all drawn as one
  instanced batch (state is a per-instance colour), and frustums are one merged line set. Far away or
  zoomed out a camera drops to box + lens, then to a dot. Tags and badges render only for the selection
  and the tour. Check frame time against the `x-dense` fixture (50-View Presentation, 40 Presentations). 2D Views: dot and short wedge;
  the full cone and aim knob only on the selection. Gold selection with brackets.
- Paths: a ribbon with chevrons and a start ring. Cut is dotted, with a chip on hover. 3D paths sit at
  eye height with a floor shadow and drops at each point. A segment that passes through a wall gets the
  caution chip.
- Path handles: drag points; drag a **+** to add a point; double-click or Delete removes one. Each
  gesture is one Undo.
- Stage toolbar: light glass groups in **both lenses** (World's 2D | 3D ⚙ and Grid · Snap change too);
  Show joins them in Experience, with a light popover, leaf checkboxes and an "n off" count.

**Done when:** in 3D you can tell where each View looks and how high it sits; a path's direction reads at
a glance; you can shape a path without a mode; Look through feels like standing in the room.

### R3: Cards, Guide, messages, snapshots

D5, D6, D9, B6, and the Card part of B10 (sheet §5, §6, §8, §10).

- Transition Card: leaves/arrives with real snapshots, a mini map, Duration with an Auto chip, Path
  summary and Straighten, the "also used by" chip, *Preview this move*.
- Guide: chips in a fixed gutter, playback in the header, a timeline with numbered segments, travel
  links and hatched waits.
- Messages: "n to fix" in the Head, Card problem rows with one fix, Stage chips, short toasts above the
  dock, technical detail behind ••• → *Copy details*. Rewrite the strings in the sheet's copy table.
- Snapshots: Stage Paper and grid, Stage lights, no helpers. Index rows and Transition Cards use them.

**Done when:** no message shows an id, a JSON path or an internal term; every thumbnail looks like the
Stage.

### R4: Preview and opening

D10, D11, D12 (sheet §9 and §11).

- Start page (`apps/editor/src/routes/+page.svelte`): the option the owner settles in sheet §9 (★ Paper
  and a white Card, forest primary; Recent projects when signed in). No purple.
- Opening a project (`apps/editor/src/routes/editor/+page.svelte` and the spatial route's boot): the Head and
  Paper show at once in shell colours with the project name; the Stage fades in.
- Preview welcome over the first Stop's opening View, blurred: name, welcome text, gold guided-tour card,
  *Explore freely* card. A gold "Preview" tab, Exit pill top right.
- Visitor scene: the Stage's Paper and lights without the grid, never a black void. R5 replaces this
  with the World's environment. Tour bar with the Stop title, progress and Prev · Pause · Next stop · Finish ·
  Explore freely (Prev cuts to the previous Stop, no travel back; disabled at Stop 1); a Places drawer;
  the end card.
- These changes stay inside the visitor chunk; no editor module reaches it
  (`preview-surface-boundary`).

**Done when:** Preview looks like Conservatory's, and leaving it is instant.

### R5: World environment

D13 (sheet §12). A new scope from the owner, sized as one bounded round.

- Four fixed presets: **Paper** (the default, today's look), Daylight, Golden hour and Dusk. Each sets
  the sky gradient, ground colour and horizon haze, hemisphere fill, one sun (direction, colour, soft
  shadow) and exposure. No custom values.
- One runtime-safe preset table and one environment component, used by the Stage, snapshots, Preview
  and the published visit. It is World presentation, so the visitor chunk may import it; no editor
  module comes with it.
- Scene saves `environment: { preset }`. The Scene format number goes up, older files are refused, and
  fixtures are regenerated. Layout is unchanged, so rooms and floors stay editable on their own.
- The picker sits in the World Inspector when nothing is selected. A pick is one change with one Undo.
  The Stage's ⚙ gets "Plain Paper while editing", a Stage preference that isn't saved.
- The sun is the only new shadow caster. It joins the existing on-demand shadow invalidation, and its
  shadow camera fits the Layout bounds. The sky is one dome and the ground one fading disc. Authored lights
  add on top.
- Later, not in R5: custom colours, sun position or time of day, HDRI, weather, and changing the
  environment per Stop.

**Done when:** a new World still looks like Paper; picking Daylight changes the Stage, snapshots and
Preview together with one Undo; frame time on `x-dense` stays where it was with the sun on.

## Limits and checks

- One Camera authority: poses, routes and timing come from `camera-core`. The only addition is the
  `turn` and `step` intents. Path creation uses the existing `camera-connection-create`.
- R5 is the only persisted-format change: a Scene format bump with strict refusal, no migration. If
  another round finds it needs one, it stops and asks.
- The writer runs `npm run check`, `npm run build` and the editor test lanes in
  [`apps/editor/tests/README.md`](../../../../apps/editor/tests/README.md). The writer adds tests
  for the B1 loop, Travel plus its connection as one Undo, route hit priority, lens matching, and the
  camera-core `turn`/`step` intents, and the R5 preset round-trip and refusal, and runs a short browser smoke check. Acceptance is the owner's,
  in the PR.

## Experiences list and Environment home (sheet §13–14)

Owner picked the recommended options on 2026-11-03. Both are implemented on this branch.

- **§13 Experiences.**
  - ★ *Ready draft*: entering the Experience lens shows an unnamed draft and a start card. The first Capture, Present this or Place a View creates the Experience and its first Presentation as one change, so one Undo removes both.
  - ★ *Experiences list*: an Experiences group at the top of the Index, styled like the Index's other groups, with a quiet + at the end of its title row. One click switches Experience. A new Experience gets a row whose name is ready to type.
  - The gold round + is struck.
  - Cost: the three first-step intents take an optional "create the Experience" field, applied by the existing planners as one compound change. No format change.
- **§14 Environment home.**
  - ★ An Environment chip in the Stage toolbar, after Show, in both lenses, opening a popover of presets.
  - ★ A World › Environment panel in the Inspector: presets now, then sun, sky, ground and exposure, plus saved custom looks.
  - ⚙ goes back to view preferences only.
  - Cost: the chip and the panel reuse `scene-environment-set`.

## Follow-up fixes (2026-11-03, owner live check)

- Stage under an environment: Paper's bounded sheet and its grid now stay.
  - The sheet uses Paper's unlit tone and catches the sun's shadows.
  - The ground around it is drawn unlit in the preset's colours, so tone mapping no longer muddies it.
  - Grid on and off works as on Paper.
  - The sky is no longer cleared by the Stage camera.
  - Snapshots re-render when the environment changes.
- ⚙ "Paper colour" is now one setting. It writes both the 2D plan and the 3D board preference.
- Preview opened from a selected Presentation no longer freezes the page. The run start was looping inside its own effect.

### As built (2026-11-03)

- **Ready draft.**
  - The first Capture, Present this or Place a View carries `newExperience` on `experience-capture-bind`.
  - That capture creates the Experience, its View and its Presentation in one change. Checked in the browser: one Undo returns to the draft.
  - The draft's name can be changed before it is saved; double-click its row.
- **Experiences list.**
  - Folded, it shows at most 3 rows: the current Experience, then the most recently opened ones.
  - *Show all n* lists every Experience in authored order. The list scrolls past 8 rows, and a filter appears past 8.
  - The fold choice is kept in this browser.
  - Stress-checked with 14 Experiences.
- **Creating.**
  - + opens an inline name row. Enter saves an empty Experience and opens it; Esc cancels.
- **Environment.**
  - A chip after Show, in both lenses, opens the quick pick.
  - *Edit environment…* opens the World › Environment panel. Sun, Sky & ground and Exposure appear as *later*.
  - ⚙ is back to viewing preferences only. "Plain Paper while editing" moved into the Environment panel.
- **Deviations.**
  - The panel opens under the chip, not in the right-hand Inspector, so it never fights the Card for the same space.
  - A row's ••• offers Rename only. Duplicate and Delete need their own planners.

## Review round 2 (2026-11-03, owner live check)

**Not accepted yet.** The owner's second live check found eleven gaps. Visual answers are in the
[Experience interaction sheet](../../../reference/design-system/experience-interaction-sheet.html) §15–§22. This section is the technical plan. The working tree
implements the round. The [handoff](./round-2-wip.md) records the follow-up fixes and browser checks.
The owner accepts the round by using the editor.

### Findings

| # | Finding | Cause | Fix |
| --- | --- | --- | --- |
| G1 | Dragging a View's frustum does nothing. The only way to aim is the dashed line and knob at its far end, and dragging that changes the line's length. | `experience-marks.ts` adds one `aim` mark at the wedge tip of the selected View. `beginViewEdit(…, 'aim')` moves the target to the pointer (`aimViewAtPoint`), so the eye-to-target distance changes. The wedge (`.frustum`) has `pointer-events: none`. | Sheet §16. The wedge becomes the turn grip: a press inside it turns the View about its eye, and the eye-to-target distance and height stay fixed. Add `turnViewAboutEye(pose, yaw)` next to `aimViewAtPoint`. The live edit keeps the `move`/`aim` session and still commits once on release (one Undo). Remove the dashed aim line and knob. The camera dot still moves the View. In 3D, the selected camera's frustum lines turn it the same way, on the floor plane. |
| G2 | *Present this* in 3D creates a View with no camera on the Stage, unlike Conservatory, where the new View appears in front of the object. | `+page.svelte` `presentThis` sends `bring-into-view`, waits for the editor camera to frame the subject, then records the *editor camera's* pose as the View. The new View sits exactly where the viewer is, so its camera is never visible, and the Stage has moved. | Sheet §17. Compute the framed pose without moving the Stage. Camera-core already frames for `bring-into-view`; expose the same framing as a pure query (`frameSubjectPose(bounds, lens, eyeHeight)`), so there is still one framing authority. The default is Standing eye height and the Normal lens, with the eye placed on the side of the object that faces the current viewer. The Stage stays put, the new camera and frustum appear selected, and the Card opens. Plan behaviour (place, aimed at the subject) stays. |
| G3 | The start card covers the Stage and is not useful. | `.experience-coach` is drawn over the Stage centre whenever the Experience has 0 Presentations. | Sheet §18 ★. Replace it with a small **Welcome** card in the Stage's lower-left corner: three tips and a **Got it** button. It shows once per browser (localStorage key `museum.experience.welcome-dismissed`, read inside try/catch) and can be opened again from ⌘K "Show Experience tips". It covers no part of the Stage centre and offers no buttons that do work; the dock and the Card do the work. Remove `EXPERIENCE_COACH.presentHint` and the coach tiles. |
| G4 | Scroll-zoom while looking through a View stutters as if it snaps. | `onWheel` in `+page.svelte` moves 0.25 m for every 120 units of wheel delta. A trackpad sends small deltas, so the View jumps 0.25 m at a time. | Sheet §21. Make the move continuous: the distance is proportional to the delta (about 0.004 m per unit, and larger for a mouse wheel with `deltaMode` 1). Ease each move over about 120 ms toward an accumulated target, and route every frame through the existing `step` intent. The 3 lens steps stay buttons in the Card; scroll never changes the lens. |
| G5 | Look through can turn and zoom but not pan. | Camera-core has `turn`, `step`, `aim` and `lens` look-through intents only. | Sheet §21. Add a `truck` intent to `camera-core` (`deltaRightMeters`, `deltaUpMeters`). It moves the eye and target together in the camera's own right/up plane, is bounded like `step`, and is tested next to `turn`/`step`. Gesture: right-drag, Shift-drag or two-finger drag pans; drag turns; scroll moves forward and back. Update View keeps the panned pose. |
| G6 | Golden hour and Dusk show stripes on the sheet at some angles (screenshots 3–4). | Three coplanar layers near the datum: the unlit plate (−0.004 m), the `ShadowMaterial` catcher (−0.002 m) and the environment's flat ground. The far plane covers the 400 m ground, so at grazing angles the depth buffer cannot separate 2 mm. The shadow catcher also shows acne from the low sun (`bias −0.0004`, `normalBias 0.02`). | Draw one plate with no coplanar twin. Either receive shadows on the plate itself with a custom unlit-plus-shadow material, or keep the catcher with `polygonOffset` (factor −1, units −1) and `depthWrite: false`. Drop the environment ground 0.05 m below the datum, with `depthWrite: false` and a lower `renderOrder`, so it can never fight the plate. Tune the sun's shadow per preset: `normalBias` 0.04–0.06, and fit the shadow camera to the workspace rect instead of `reach`. Fit the Stage camera's near/far to the scene plus the ground ring. Check: screenshots at elevations of 5°, 15° and 35° in all three presets, with no banding. |
| G7 | Dragging a camera path still does not work, and the dock's Path tool is still there. | Pressing the route itself (`.route-hit`) only stops the event, and a click inserts a point. Only the small point handles start a drag. In the owner's session even point drags failed. **To confirm first in the browser:** whether `acquireGesture` refuses the lease while the Guide strip owns playback (`policy: 'cancel-on-reading-change'`), or whether the route hit stroke covers the point handles. | Sheet §19. (a) Reproduce and fix the point drag at its cause, with a test. (b) Pressing and dragging the path adds a point under the pointer and moves it in **one** change (one Undo): extend `movePathAnchor` with an `insertAt` slot, applied by the existing path planner as one compound. (c) A click on the path no longer adds a point. Double-click adds one where you click; double-click a point removes it. (d) Remove the dock's Path tool, `pathArmed`/`pathReason`/`onPath` and the "Path — click the path…" hint. |
| G8 | The + handles make the path busy. | `plusHandles()` draws one + between every pair of points on the selected path. | Sheet §19. Remove `plusHandles` and `.plus`. Hovering the selected path shows the **add-point cursor** (§15) and a hint tag at the pointer: "Drag to bend · double-click to add a point". The tag hides after the first successful edit in a session. |
| G9 | Paths with many points get crowded. | Every point draws a full 22 px hit circle and a visible handle. | Sheet §19. Points draw as 3 px dots. The point nearest the pointer (within 28 px) grows to the full handle, so only one handle is ever large. The selected point stays large. Keyboard: Tab walks the points, and Delete removes the selected one. |
| G10 | With *Selection only*, a selected path shows only lines and one label, not the cameras it connects. | `ExperienceMarks.svelte` keeps marks whose state is `selected` or `strong`. A selected transition makes only its path `selected`; its two Views stay `near` and are filtered out. | Sheet §20. Add `relatedToSelection(selection, experience)` in `experience-marks.ts`, returning the ids that belong to what is selected. For a Travel: both end Views (camera, frustum, label), the path and its points. For a Cut: both end Views. For a Stop: its Views and the paths in and out. For a View: its camera and the paths that touch it. For a Presentation: its Views. *Selection only* shows exactly that set, and *Whole Guide* dims everything outside it. |
| G11 | Experience still shows routine messages ("View moved.", "View re-aimed.", "Path point added"), and its tips do not share one style (pink-on-grey toast, white hint chip, start card). | `+page.svelte:979` and `experience-controller.svelte.ts:1669` set notices for changes the Stage already shows. Notices, the dock hint and the coach each have their own CSS. | Sheet §22. Accepted changes say nothing; Undo is the confirmation. Keep notices only for what the user cannot see: refusals ("That View is shared…"), and results that happen off-screen. Use one notice component in the shell style from §8: dark glass, white text, above the dock, 4 s, at most one action. Refusals use the refuse tint. Use one pointer **hint tag** for gesture hints. |
| G12 | The Stage cursor is a hand in Select, + handles use the browser's default pointer, and nothing signals rotate, add or place. | `.stage { cursor: grab }` by default, and `data-cursor` knows only `move`, `crosshair` and `grab`. Buttons and handles use `cursor: pointer`. | Sheet §15: the Biskiq cursor set. Add one `cursors.css` in `stage/shell` that defines `--cursor-*` custom properties as `url(data:image/svg+xml…) x y, <fallback>`. The Stage's `data-cursor` gets the set's names: `select` (default, an arrow), `grab`/`grabbing` (only while panning or orbiting, or over a draggable body), `move`, `turn`, `add-point`, `place-view`, `look`, `measure`, `not-allowed`. Over a selectable object the cursor stays the arrow; selection never shows a hand. |

### Order

1. **G7 point drag.** Reproduce it in the browser and fix the cause before any redesign, because it blocks the owner's path work.
2. **G12 cursors**, because G1, G7 and G8 use them.
3. **G1** turn by frustum, **G7–G9** path editing, and **G10** related set.
4. **G2** framed *Present this*, **G4–G5** look-through motion, with the `truck` intent in camera-core.
5. **G6** rendering, checked with screenshots at fixed angles.
6. **G3** welcome and **G11** messages.

### Limits and checks

- **One Camera authority.** `truck` and the framing query are camera-core additions. The editor does no pose maths of its own, apart from the pure View-edit helpers it already has (`turnViewAboutEye` sits next to `aimViewAtPoint`).
- **No format change.** The welcome flag is a browser preference only.
- **One Undo per gesture.** Turn on release; insert-and-drag a path point as one compound.
- **Tests to add:**
  - `turnViewAboutEye` keeps the eye, height and distance.
  - Path insert-and-move is one change, and one Undo removes it.
  - No + handles are rendered.
  - The related set for each selection kind.
  - Wheel deltas map to proportional steps, with no 0.25 m quantum.
  - The camera-core `truck` intent: bounded, keeps the orientation.
  - *Present this* in 3D leaves the Stage camera where it was.
  - No notice after a View move or a point add.
  - The default Stage cursor is `select`.
- **Verification.** `npm run check`, the editor test lanes, and a browser pass at 1280×820 in Paper, Golden hour and Dusk, with screenshots for G6.

### Owner follow-up

Clicking the Floor places a View using the Stage's current heading. Dragging is optional
and sets the direction. A pre-aimed placement from Present this keeps the subject target.
This supersedes the minimum-drag requirement in the original S28 plan.

## Review round 3 (2026-11-04, owner live check)

**Not accepted yet.** The owner picked from the reference sheet's §23–§25
([interaction sheet](../../../reference/design-system/experience-interaction-sheet.html)): §23 as recommended,
§24 the World's marks with the picture in the Card only, §25 *Cards are the timeline*. The owner also
reported the live gaps below. The correction includes H1–H9 and the Camera portion of H10.

| # | Finding | Cause | Fix |
| --- | --- | --- | --- |
| H1 | In Plan the cameras vanish when the scene has no objects, and at some pans. | `experience-marks.ts` dropped a View unless its eye **and its target** projected `visible`. An empty Plan fits its depth range to the Floor, so a View at eye height is `clipped`. A target off the frame (a pan, a far look point) hid the whole View. `ExperiencePaths` had the same rule. | A mark is screen ink: only `behind` (and an eye `outside-frame`) drops it. The target only gives the wedge its direction. Tests: a far target and a clipped eye both still mark. |
| H2 | Plan shows a dot; the camera doesn't move while dragged, only on release. | The Plan eye drew a `.dot`. During a move, a separate dot-and-line preview moved while the real mark stayed. | Sheet §23 ✓. The Plan eye draws the Detailed camera from above (`planCamera` snippet, state colours as in 3D), turned to the mark's new `heading`. The wedge starts at the lens (`PLAN_LENS_PX`). `liveEdit` draws the dragged View at its provisional pose through `experienceMarkModel({ livePose })`, and a dashed ghost with the distance stays at the start pose. The turn keeps only its arc and angle. Placement ghosts use the same glyph. |
| H3 | The Card fades to 20 % while a camera is adjusted, so it can't be read. | D36 fades the Card for every non-navigation lease. | Sheet §24 *Card only*. The `experience-view-edit` and `experience-path-point` leases keep the Card clear; other authored gestures still fade it. The Card keeps its last accepted picture during the drag and refreshes after the edit is accepted. |
| H4 | Playback draws a dot and a dashed line, with no frustum. | The rig was its own dot glyph. | The rig draws the same camera and frustum a View draws (3D Detailed camera, or the Plan camera and wedge), in the tour colours, read-only. |
| H5 | The ▾ *Play from…* menu next to ▶ is one choice too many. | S30 transport menu. | Removed. ▶ plays from the playhead. Pressing a Stop card moves the playhead to its start, and pressing a move chip moves it to the end of the Stop before. A playing run keeps playing (`playback.seekStop`). *Preview this move* stays on the Transition Card. |
| H6 | The Guide's Stop cards are tall, and it shows a scrollbar. | 118 px cards stack picture, name and meta; `.cards` has a thin visible scrollbar. | Sheet §25. 176 × 50 cards with a 62 × 40 picture beside a one-line title and the Stop's time; each card carries its own progress bar. No visible scrollbar: the wheel scrolls sideways, and ‹ › arrows show only on a side with more. **Not yet:** the separate scrub bar is kept, because it is still the only home for waits and keyboard scrubbing (H10). |
| H7 | The Stop Card's kind line reads "‹ Stop 2Stop 1 of 2 · 23". | `backOf` names the previous subject even after ‹ › stepping to a sibling Stop, and the back link ran into the kind with no gap. | Sibling steps (same subject kind) show no back link, and Alt+← still returns. The back link has a hairline divider. |
| H8 | The Stop's ‹ › sit on a row of their own; "VISITSAGAIN". | A separate `.stop-nav` row; Svelte trims the space at the start of `{#if again} again`. | The steppers stack beside the Visits block. The label is one expression, `Visits again`. |
| H9 | Guided View rows are cramped: names cut to "Vi…", a large ENTRY slab, and Hold, eye, × and Preview colliding. | One 300 px flex line holds grip, number, thumbnail, name, tag, Cut/Travel/+ Path/Preview, Hold, eye and ×. | A grid row: the name gets the first line; step and Hold sit beneath; eye and × stack at the right; Preview is a play icon; *Entry* is an outlined tag like *Start*. |
| H10 | §24 *Advanced* and the rest of §25. | — | Advanced reveals the World sticker handles in 3D and lens grips in Plan. Plan height and tilt stay in the Card. The Card's picture refreshes after acceptance. The separate Guide scrub bar is still the home for waits and keyboard scrubbing. |

### Limits and checks

- **One Camera authority.** Marks only project; the live pose is the existing View-edit session's provisional pose, never authored. `seekStop` uses the Guide's own time map.
- **No format change.**
- **Tests added:** Plan marks survive a far target and a clipped eye; the live pose moves only the dragged View; `seekStop` pauses (or keeps playing) inside the whole run; the Guide has no Play-from menu; sibling Stops name no back link. The 2D placement ghost test reads the Plan camera's position.
- **Verification.** `npm run check`, `test:fast`, `test:arch` and `test:heavy` pass. A browser pass at 1280×820 on an empty project checked these:
  - The Plan camera glyph appears with no objects.
  - A live drag shows the ghost and its distance, and the Card stays clear.
  - The Guide strip has no Play-from menu and no arrows with one Stop.
  - Card click seeks.
  - The playback rig shows its frustum.
  - The Stop card has its header, steppers and View rows.

  The browser pass found and fixed two things: the strip's row was 24 px wider than the strip, which showed a false › arrow, and *Open Presentation* wrapped.
- **Open, not fixed here.**
  - At 1280 px with the Index open, the fixed 820 px Guide (round 2) runs under the Index, because the lower column spans the whole Stage. Fixing it means giving the lower column the Index lane, which also moves the Dock. That is shared shell layout in the route.
  - `beginViewEdit` and `beginPlacement` acquire the gesture lease before `setPointerCapture`. If capture throws, the lease is never released. Real presses don't hit this.

## Review round 4 (2026-11-04, owner live check)

Fixed in production:

- **A pointer capture that throws no longer strands a claim.** Every Stage press in the route now captures through `capturePointer`, which reports failure instead of throwing. The caller then hands back what it claimed: the lease (View edit, Stage press), the host tool (Measure, Erase), the adapter press, the placement press or the Look-through pointer. A composition test keeps raw `setPointerCapture` out of the route (`stage-shell-composition`). Checked in the browser: a synthetic press, whose capture throws, no longer blocks the next gesture.

Proposed in the sheet (not built):

| # | Owner finding | Trace | Sheet |
|---|---|---|---|
| R1 | View names are cut ("Chopin …"); ◆ and *Entry* both mark the first View, and *Entry* repeats the number 1. | The row spends 12 px on a grip, 14 px on a number and about 60 px on ◆ + *Entry*, leaving about 62 px of a 288 px Card. | §26: the number moves onto the picture, the grip goes (drag by the picture), *Entry* goes (position says it), and ◆ stays on the Presentation's Card. The name gets about 155 px. |
| R2 | Renaming an object in World doesn't reach Experience; a captured Presentation can't be linked to an object. | `presentThis` copies `cardIdentity.label` (with Form) into `Presentation.label` once. `subjectEntityId` is kept, but nothing reads the name back. Capture and Place a View create with `subjectEntityId: null`, and no change can set it later. | §27: the stored name becomes optional, and an empty one follows the subject's live name. Form moves to the kind line. A captured Presentation suggests the object at its Default View's centre, or lets you pick one on the Stage. Cost: one Experience format bump (strict refuse) and a subject-update intent. |
| R3 | How should scrubbing live in *Cards are the timeline*? | The separate scrub row is the only proportional time, the only place a wait shows and the only keyboard scrubber. | §28: the rail under the cards becomes one continuous scrubber, with View ticks, a ⏸ cap for waits, playback that stops at waits, and slider keys. |
| R4 | Changing the Travel time changes the next View's hold. | In the Stop Card, the step (*Cut · Travel · ▷*) and View 2's *Hold* stepper share View 2's row. The Travel time is read-only text there and can be set only through the path (`setPathDuration`, Camera connection timing). | §29: the step sits between the two Views, and a Travel carries its own stepper (Camera connection timing, *Auto* to restore, and *Same path in N steps* when shared). |

**Advanced Camera picture.** Keep the Stage marks and Card values live during the drag.
Refresh the Card's picture after the View edit is accepted, including after confirmation for
a shared View. The accepted snapshot path reuses the Stage renderer and caches the result.
This avoids a scene draw, GPU readback and PNG encode for each provisional frame.

### Revised model before building Round 4 (sheet §30)

The owner's model is a guided tour with optional exploration. **R1, R3 and R4 above are revised by sheet §30 and are not to be built as drawn.**
- Stops visit one entry View and carry one stay (seconds or until Next).
- Presentations hold an ordered list of Views. View 1 is the Default. Steps between Views are Cut or Camera path, with no holds.
- The Guide clock covers only Stops and the transitions between them.
- Exploring pauses the Guide and its channels. Coming back resumes the same playhead, where today the Stop starts over.

This means an Experience format 4 and an execution program v4, with format 3 strictly refused. Camera is unchanged. §30 lists ten open product decisions. R2 (§27) and the pointer-capture fix are not affected.

### Refinement before building Round 4 (sheet §31)

§30's model stays. [Sheet §31](../../../reference/design-system/experience-interaction-sheet.html#fz-f)
and [guide-playback-plan.md](./guide-playback-plan.md) refine how it plays (proposal, not built):

- Pacing is one Guide field, `automatic` (the default) or `manual`. Per-Stop "until Next" goes, and so do Gates.
- Next always works. Explore is in the bar at every Stop. Back to the tour restores the playhead and the
  play or pause, with a 2 s lead-in.
- A Stop can invite exploring. Ignoring the invitation never interrupts an Automatic tour.

The same format 4 and program v4 bump covers §30 and §31, and Camera is unchanged. §31 answers §30's ten
open decisions and lists eleven of its own for the owner.

**Owner picks (2026-11-04):** §31 Q1–Q9 as recommended. Q10: no old-version support. Q11: leave room
for narration only. Control placement goes to [sheet §32](../../../reference/design-system/experience-interaction-sheet.html#fz-own)
(proposal).

**Sheet consolidated (2026-11-04):** the interaction sheet now shows one settled design. Superseded
sections were removed: §6 (old Guide strip, now in §25), §26 (Stop Card View rows), §29 (Travel time vs
hold) and §30, whose model and contracts are folded into §31. Settled choices are fixed in place, and
the remaining option rows are demo switches. The section numbers cited in this plan's history still
refer to the sheet as it was then.

**§32 accepted (2026-11-04):** every recommendation, plus one owner request: a long Presentation View
list folds to the first 8 Views behind *Show all*, and opened it scrolls in its own box, never the whole Card.
