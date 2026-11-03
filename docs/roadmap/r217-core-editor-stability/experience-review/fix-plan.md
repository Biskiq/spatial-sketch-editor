# Experience review 1: gaps and fix plan

**Owner review of R217.S26–S30, 2026-11-03: not accepted.** The functionality works. The UX and UI
fall short of [Conservatory](../../../../prototypes/experience-ux-alternative/README.md). This is the
one correction pass the S26–S30 register rows allow for. The owner is the only acceptance: each round is
one PR from the latest `main`, and the owner accepts it by using the editor.

**Design sheet:** [design-sheet.html](./design-sheet.html). Open the file directly; it needs no server.
Each row shows what production does now, the recommendation (★) and sometimes one alternative. This plan
builds the ★ option unless the owner picks another one in the PR.

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
| D10 | The editor opens on a black "Opening Spatial…" page | §9 |
| D11 | The Preview start is a grey card over a view from outside the building | §11 |
| D12 | The Preview scene is a black void with flat light, and the tour controls are plain | §11 |

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

Each round is one PR from the latest `main`. Order: R1 → R2 → R3 → R4. R1 can ship alone.

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
- 3D Views: camera body, wire frustum, height stem and tag, stop badge. 2D Views: dot and short wedge;
  the full cone and aim knob only on the selection. Gold selection with brackets.
- Paths: a ribbon with chevrons and a start ring. Cut is dotted, with a chip on hover. 3D paths sit at
  eye height with a floor shadow and drops at each point. A segment that passes through a wall gets the
  caution chip.
- Path handles: drag points; drag a **+** to add a point; double-click or Delete removes one. Each
  gesture is one Undo.
- Show: dark-glass group like 2D/3D, a light popover with leaf checkboxes and an "n off" count.

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

- Opening: the Head and Paper show at once in shell colours with the project name; the Stage fades in.
- Preview welcome over the first Stop's opening View, blurred: name, welcome text, gold guided-tour card,
  *Explore freely* card. A gold "Preview" tab, Exit pill top right.
- Visitor scene: daylight sky and ground outside openings, hemisphere and sun light with soft shadows,
  never a black void. Tour bar with the Stop title, progress and Pause · Next stop · Finish · Explore
  freely; a Places drawer; the end card.
- These changes stay inside the visitor chunk; no editor module reaches it
  (`preview-surface-boundary`).

**Done when:** Preview looks like Conservatory's, and leaving it is instant.

## Limits and checks

- One Camera authority: poses, routes and timing come from `camera-core`. The only addition is the
  `turn` and `step` intents. Path creation uses the existing `camera-connection-create`.
- No persisted-format change is expected. If a round finds it needs one, it stops and asks.
- The writer runs `npm run check`, `npm run build` and the editor test lanes in
  [`apps/editor/tests/README.md`](../../../../apps/editor/tests/README.md). The writer adds tests
  for the B1 loop, Travel plus its connection as one Undo, route hit priority, lens matching, and the
  camera-core `turn`/`step` intents, and runs a short browser smoke check. Acceptance is the owner's,
  in the PR.
