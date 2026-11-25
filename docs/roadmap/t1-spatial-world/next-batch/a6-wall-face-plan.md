# T1 A6 — Face this Wall (`layout.wall-face`)

**Authority:** T1 next-batch roadmap rev 3, A6 (Tier 1). Base `main` @ `286e6339`
(PR #348 merged). Short plan, as the slice requires.

## Goal

The Card's `•••` menu turns its disabled **Face this wall** placeholder into one explicit Look
action. It squares the Camera to the selected Wall — straight, curved, or its unrolled sheet —
through the already-landed `face` viewing intent in camera-core. **Put back** returns the Camera to
the exact standpoint it had before Face. Nothing is authored, serialized, written to history or
shown to a visitor.

## Camera: reuse the one authority

`facePoseFromBounds` and the `face` intent landed with C3 checkpoint 5 and are already tested
(`camera-face-intent.test.ts`). This slice adds **no** pose mathematics: the Camera derives the
pose from bounds + `look`, eases through the one evaluator, and ends in the 3D reading.

**Put back is a standpoint restore, not a second intent.** `set-view` always ends in 3D, so it
cannot return a Plan entry. The Camera session already has the exact operation for this — the
`ViewportCameraState` entry capture/restore used by Follow. Put back restores that captured state
(pose, reading, last-reading elevation) exactly, cancels any in-flight face transition, and writes
no interpolation of its own. Reduced motion is therefore honoured by construction on the return,
and by the existing `readingIntentClockSeconds` rule on the way in (the face is submitted already
past its endpoint, so its first frame is its last).

## Layout: bounds and a direction, never a pose

- **Folded Wall.** New pure module `apps/editor/src/lib/layout/wall-face.ts`. The frame is the
  compiled Wall's `bounds3`; `look` is the horizontal inward direction of the face at the station
  nearest the view centre. The face is the one the creator is already looking at
  (`wallUnfoldSideTowardCamera`, retained for inspection exactly for this); the Plan reading has no
  eye, so it faces the Wall's left/Room face. A vertical or degenerate normal refuses rather than
  inventing a heading.
- **Unrolled sheet.** The same module derives the frame from the live `WallUnfoldDisplay` — the
  displayed positions at the current peel amount and presentation angle, and the displayed face
  normal at the pin. Face therefore squares to the sheet the creator sees, including the Outside
  face after a face switch.
- **One rule, two sources.** Both frames are `{ bounds, look }`; neither contains an eye, target,
  distance or FOV.

## Shell: one session reading

`wall-face-store.svelte.ts` holds the reading: the faced Wall and the captured entry standpoint.
The route installs one camera port (the same ownership pattern as Unroll's camera executor) that
turns a frame into a `face` intent, and a standpoint into the session restore, using the route's
own clock and reduced-motion rule. One Face exists at a time; facing another Wall replaces it.
The reading is cleared by Put back, by a replacement reset, and on unmount.

## Card

`layout-contributions.ts` contributes `layout-wall-face` for every selected Wall, first in the
menu: **Face this wall** at rest, **Put back** while that Wall is the faced one. Put back always
returns the entry standpoint — it is an explicit reversal of one action, not a mode exit, so it
stays unconditional even after the creator has orbited. `•••` no longer renders the disabled Wall
placeholder for Face; the other unbuilt functions keep theirs. The action writes no document, so
Undo, Save and the history depth are untouched.

## Scope boundaries

Not in this PR: **Face the cut** (SL3), Section, any change to Unroll's entry/exit or its
display-cut rules, the whole-Room Unroll strip, a floating Face pill, remembering the date face as
session state beyond the single reading, or any format change (format 7 stays).

## Files

- `apps/editor/src/lib/layout/wall-face.ts` *(new)* — folded and sheet face frames, face-side
  rule, refusals.
- `apps/editor/src/lib/authoring/layout/wall-face-store.ts` *(new)* — one live Face reading and
  its camera port.
- `apps/editor/src/lib/authoring/adapters/layout/layout-contributions.ts` — the Wall action and
  the Put back label.
- `apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte` — remove the Wall Face placeholder.
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` — install the camera port,
  clear on replacement.
- `apps/editor/tests/lib/authoring/layout-manipulation-boundary.arch.test.ts` — the two new Layout
  edges.
- `capabilities.json`, `docs/reference/components/layout.md`,
  `docs/reference/design-system/editor-shell-and-visual-system.md` — ledger and the enduring rule.

## Checks

- Frame suite (core fixtures): straight and curved folded Walls; a wall whose face must be chosen
  from the eye side and from Plan; an unrolled sheet before and after the face switch; a degenerate
  or refused frame.
- Adapter suite through the real facade and Layout adapter: the action is offered for a selected
  Wall; Face ends 3D with every Wall corner framed and the eye on the chosen side; Put back
  restores the exact entry pose **and** reading (including from Plan); Face and Put back write no
  history and no document; entering Unroll does not move the Camera before or after a Face; the
  unrolled sheet face is square to the sheet; reduced motion settles on the first evaluation.
- Card route suite: `•••` shows the real action and no disabled Face placeholder.
- Commands: the affected suites, `npm run check`, `npm run test:arch`, `npm run test:fast`.
- Focused browser QA of the creator journey, including the #346 known-Wall click pick that Face
  depends on. `perf:spot` is not run.

## Issue #346

The known-Wall click-pick failure is reproduced and diagnosed during that QA. If it proves a
bounded picking/selection defect it is fixed here with a focused regression; otherwise the
evidence is recorded in the PR and the issue stays separate.

## Risks

1. A curved Wall has no single plane. Face uses one tangent face direction at the view-centre
   station and frames the Wall's whole extent as a face footprint — moved so the eye-side face is
   on the target plane, so the near station is not magnified past the frame. The frame is
   conservative rather than a true elevation. Exact developed elevation is Section's job, not
   Face's.
2. Put back restoring the entry standpoint is unconditional, so a creator who orbits after facing
   and then presses Put back returns to where Face started. That is the action's stated meaning;
   it is one press to face again.
3. The face reading is session state that outlives selection, like Unroll. A replacement reset
   clears it; a document Undo does not, and the Wall id still names the same Wall.
4. The chosen face depends on the settled eye in 3D. From Plan, Face uses the Room/Inside face.
