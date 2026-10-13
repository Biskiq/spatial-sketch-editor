# Design rationale

Route: [README](./README.md) · [visual language](./visual-language.md) · [scope and critique](./scope-and-critique.md)

The authoring journey stays **Presentation → Views → Guide → Preview**. The design makes each step a
direct act on something you can see, and makes every editing surface answer one question.

## 1. Shell: one working surface, three supporting answers

| Surface | Answers | Behaviour |
| --- | --- | --- |
| **Head** (48 px, forest) | Which project, which workspace, can I undo, show me as a visitor | Identity left; World/Experience; history; gold **Preview** right. Nothing contextual lives here. |
| **Index** (236 px, or a 52 px rail) | Where things are | Presentations (expand to Views) and the Guide. One creation action (**New**). Collapses to a rail of thumbnails; on narrow widths it becomes a drawer. |
| **Stage** | The work | Plan or 3D, always dominant, never resized by selection. Mode pill top-centre only when the Stage is in a special state (placing, looking through, following). |
| **Card** (324 px) | What is selected and what I can do with it | Appears with a selection, disappears without one. Docked over the Stage’s right edge (not a fourth column), so selecting never reflows or re-frames the Stage. On narrow widths it is a bottom sheet. |
| **Guide** (dark instrument strip) | In what order visitors go, and what happens over time | Collapsible to one 46 px bar. It is both the sequence editor and the playback timeline. |

Why a docked overlay Card rather than a column: a permanent inspector is either empty or pushes the
Stage around. An overlay that appears with selection keeps the Stage stable and the Card honest.
The Plan’s *Fit* reserves the Card’s width, so opening a Card never forces a camera move.
While looking through or following, the 3D canvas narrows to the uncovered area instead, so the
composition you judge is the whole frame (pose unchanged; only aspect).

## 2. Presentations and Views

- **One creation concept.** A Presentation is created either *from a thing* (select any object →
  **Present this**, which frames a first View on it) or *from a standpoint* (**New** in the outline:
  in 3D it captures what the Stage camera sees; in Plan you place the camera by press-and-drag).
  There are no object/environment/region types. The optional subject is shown only as a quiet
  “about …” link in the Card kicker.
- **The creation action is not duplicated.** The outline has **New**; an object Card has
  **Present this**. They are different starting points, never the same button in two places. Empty
  states explain, they do not repeat the button.
- **A View is placed, not configured.** In Plan, the marker is the View: drag the dot to move it, the
  round handle to aim it. In 3D, **Capture View** records exactly what you see. Framing is two
  three-step choices — **Lens** (Wide / Normal / Close) and **Eye height** (Seated / Standing /
  Raised) — instead of numeric FOV and position fields.
- **Look through / Exit View** is the only Camera inspection posture. While looking through, drag
  re-aims and scroll steps forward/back; the View is marked *moved* until you **Update View**;
  **Exit View** (or Esc) discards and returns to the exact authoring standpoint, including Plan.
- **Selecting a View never moves the Camera.** Markers are world-anchored in Plan (they move with
  pan/zoom, keep screen size) and are camera glyphs in 3D.
- **Default View** (gold ◆) is where free exploration enters a Presentation. It is a property of the
  Presentation and is set from the View Card or menu.

## 3. Stops: “visits” a Presentation, with its own shot list

A Stop Card leads with **identity**: a large “Stop 2 · Visits **The Pleyel piano** · Open
Presentation” block. The Stop is visibly a *visit to* a Presentation, not the Presentation itself.
Then, in the brief’s order:

1. **Guided views** — an ordered shot list of the Presentation’s Views included in this visit. Drag
   (or Alt ↑/↓) to reorder; the first is tagged **Entry**. Each row has a hold time. × leaves a View
   out.
2. **Not in this Stop** — the Presentation’s other Views, dimmed, with **Include**, and the note that
   visitors still reach them in free exploration.
3. **After this Stop** — “Visitor presses **Next** → (3) Manuscripts” as a link, Cut/Travel, duration
   and a link into the Camera path. Next is *derived from Guide order*; there is no Next dropdown to
   disagree with the strip.

The working model from the brief is kept (Stop-local selection and order, entry = first, new Stop
starts at Default, Default unaffected). It is the right level: one list, two verbs (include, order),
and it makes repeated visits meaningful — Stop 5 revisits the piano from the pianist’s seat.
See [scope and critique §3](./scope-and-critique.md#3-where-this-disagrees-with-the-brief) for the
consequence it creates for routes and how the design surfaces it.

## 4. Guide: the sequence *is* the timeline

The bottom strip shows Stop tiles (entry thumbnail, number, Presentation, View count, duration,
proportional View segments) joined by **connectors** reading `NEXT · ↗ 8s` or `NEXT · ✂ Cut`.

- **Direct manipulation.** Drag tiles to reorder; drag a Presentation from the outline onto the
  strip to insert a Stop at the caret; **Add stop** picks any Presentation (again is allowed — the
  tile says *again*). The selected tile alone gets a ⋯ menu (Open Presentation, Move earlier/later,
  Remove). Keyboard: focus a tile, Alt ←/→.
- **Connectors are the transitions.** Clicking one selects the transition; its label states what
  the visitor does (*Next*) and what the camera does (*Travel 8 s* / *Cut*).
- **Timing lives on the same strip.** A scrub rail runs under the tiles; the gold playhead maps
  through each tile by its View holds and through each connector by its travel time. There is no
  second Journey surface to keep in sync with the overview.

## 5. Camera path and playback

- **The Stage is the path editor.** Selecting a Travel shows its route in gold on the Plan (and in
  3D). Drag points; click the path to add one; select a point to remove it (or Delete). A path that
  crosses a wall is drawn red-dashed and the Card says how to fix it. The straightened topology
  strip is removed: it duplicated the Plan.
- **Cut** draws as a dotted “CUT” link on the Plan, so the overview never implies motion that won’t
  happen.
- **Playback = Play/Pause → Scrub → Follow camera.** Without Follow, a gold camera puck moves along
  the route on the Stage — you watch from outside. **Follow camera** makes the Stage look through the
  moving camera; turning it off returns to the standpoint you had. **Preview this move** on a
  transition plays just that stretch.

## 6. Navigation consistency

- **Selection** is shown by gold plus a shape cue (corner brackets on Plan objects, ring + larger
  glyph on Views, 2 px ring on tiles, left bar in the outline).
- **Back** is a labelled chip in the Card (“‹ Stop 2”). It walks selection history only; it never
  undoes. **Undo** lives in the Head and only changes the document.
- **Hierarchy** is in the Card kicker with links (“View · in *The Pleyel piano*”), so “up” is always
  one click without a breadcrumb bar.
- **Stage modes** are explicit: a mode pill with its own exit (`Exit View Esc`, `Stop following Esc`,
  `Cancel Esc`) and a gold inner frame while looking through the camera.
- **No silent camera moves.** Selecting, opening/closing panels, changing width and editing never
  move the Camera. Look through, Follow, Fit and Zoom are the deliberate exceptions.

## 7. Guided tour and free exploration from one authoring system

There is one set of Presentations and Views. The Guide only orders a path through them. The design
makes the two ways in visible without a second system:

- In the outline, each View carries a filled dot (on the tour) or a hollow ring (free only);
  Presentations show the Stop numbers that use them or a dashed *free* tag.
- The Presentation Card has **Visitors reach it**: “On the tour at Stop 2 · Stop 5” and a single
  **Open in free exploration** switch.
- The Guide Card (“One museum, two ways in”) states both modes with counts, including how many
  Views only free exploration reaches, and previews either.
- In the visitor preview, **Guided** auto-advances Views by hold and waits for **Next stop** between
  Stops; **Explore freely** lists every open Presentation and View and returns with **Back to the
  tour · Stop N**.
