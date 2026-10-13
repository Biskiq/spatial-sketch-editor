# Design rationale

Route: [README](./README.md) · [visual language](./visual-language.md) · [scope and critique](./scope-and-critique.md)

The authoring journey stays **Presentation → Views → Guide → Preview**. The design makes each step a
direct act on something you can see, and makes every editing surface answer one question.

## 0. Round 2: what changed

Round 2 refines the same prototype in place after the owner review. Interaction foundation,
components and code structure are kept; changes are targeted.

| Change | Why |
| --- | --- |
| **Guide is an invoked context.** Hidden until opened from the Index (or by *Add to Guide*, a Stop chip, dragging a Presentation in). Selecting Stops, transitions or their Views keeps it open; selecting other things does not close it either. **×** or Esc (after the selection) dismisses the instrument, its paths, Stop tags and playback puck together. | The Stage no longer assumes it belongs to one Guide; ordinary Presentation and World work carries no Guide chrome. The Index section is plural (*Guides*) so a second Guide is just another row. |
| **Compact Guide instrument.** Inset in the Stage, width follows content (3 Stops ≈ 760 px), bounded by the Card. Two bands: light **Stop cards** (composition) and a time-scaled **overview bar** (the whole Guide: scrub, playhead, gold selected Stop, a bracket for what the cards show). ⌄ collapses to the overview only. | Controls sit together in one header (name · Play · time · Follow · Add stop · density · close). The overview keeps orientation at 30 Stops; the cards scroll to the selection, follow playback and auto-scroll while dragging. Dropping a card on the overview moves a Stop anywhere. |
| **Light Stop cards on the dark instrument**, gold ring for selection, gold glow for the playing Stop, gold-filled segment on the overview. | Fixes dark-on-dark. Thumbnails do the distinguishing; text is name + count + time only. |
| **Show ▾ on the Stage** (editor visibility): *Whole Guide / Selection only*; Camera markers, frustums, paths, labels. | One small popover in the existing Stage toolbar, not a layer manager. Defaults keep the selection loud, context faint, and the selection always visible. |
| **Quieter defaults.** Outside a Guide: no paths at all. Context routes are thin, chevron-free, never red; only the selected or neighbouring route carries chips, chevrons and warnings. Names label the working set only up to 12 Views; context frustums disappear past 24 Views. Whole-Guide reading tags each Stop’s entry View with its number. | The Plan stays readable at 30 Stops / 50 Views without the creator touching Show. |
| **Scale.** Index: two-line rows (name; *4 Views · Stops 2, 5*), search from 8 Presentations, one open Presentation at a time (follows selection), up to 8 Views listed then *+N more — see all in the Card*. Presentation Card: 3-column dense grid past 8 Views; filter + *On tour / Free* past 12 (reorder needs the unfiltered list, and says so). Stop Card: *Not in this Stop* folds past 4; ‹ › step Stop to Stop. | The simplest progressive disclosure that keeps every View on one scrollable surface for comparing and reordering — no pagination. |
| **World domain in the same shell.** World tab is live: Context Index (place card, Bounds, Openings, Located here, Search, Browse rooms), object/room/wall/opening Cards with *Details*, cross-lens links, **Measure** as a World instrument in the same slot. A selected object survives the lens switch. | Shows the shared grammar (Head, Index anatomy, overlay Card, instrument, toolbar, selection states) without redesigning World tools. |
| **Polish.** White Card, stone Index (`--surface-work`); sentence-case section titles; neutral white domain pill (gold stays for selection); Stage toolbar groups Plan/3D, Show and zoom in one row. | Hierarchy and contrast, borrowed partly from UX3. |

**Adopted from UX3:** an inset, Stage-width-bounded Guide instead of a full-width strip; light
working surfaces with white Card; sentence-case bold section titles; two-line Index rows with
View counts; Index search; the Guide as one of possibly many Index items; *no empty Card*;
Stage-quiet defaults; the neutral active-lens treatment (also the World synthesis’ ask).

**Not adopted from UX3:** a permanent inspector column (the overlay Card stays — see §1); a
third *blue* Camera hue (leaf green already means Camera/route and blue would compete with gold);
the status bar (another row of chrome for one line of text); a Stage context chip duplicating
the Card kicker; separate Movement and Stop-player instruments (one Guide instrument covers both);
Avenir as the only face (the serif/sans split is kept, used more sparingly); full-row stop chips
without thumbnails.

**Where this disagrees with the owner’s suggestions:**
- *Light Stop cards* — yes; but the instrument stays dark. A light instrument over a light Plan
  loses its edge and its “this is the Guide” identity.
- *Focused neighbourhood around the selected Stop* — not as a separate mode. The cards already
  scroll to the selection and the overview shows the whole; a neighbourhood that re-centres on
  every click would make the sequence jump under the pointer.
- *Collapsible View groups / Show more* — not for Presentation Views. Groups would invent an
  authored taxonomy; *Show more* splits the reorder surface. A denser grid + filter keeps one list.
- *Guide closes when leaving it* — only explicitly. Selecting a Presentation from the Index
  keeps the Guide open, because adding a View then including it in a Stop is one task.
- *Overlay Card in World* — fits for identity and *Details*; the justified exception is wide
  World instruments (Unroll, Section) that need the Card’s side: they would take the full Stage
  width and the Card would shrink to its title, like Look through does on narrow widths.

## 1. Shell: one working surface, three supporting answers

| Surface | Answers | Behaviour |
| --- | --- | --- |
| **Head** (48 px, forest) | Which project, which workspace, can I undo, show me as a visitor | Identity left; World/Experience; history; gold **Preview** right. Nothing contextual lives here. |
| **Index** (248 px, or a 56 px rail) | Where things are | Experience: Guides, then Presentations (expand to Views; search past 8). World: place, bounds, openings, located here; search, browse. One creation action (**New**). Collapses to a rail; on narrow widths it becomes a drawer. |
| **Stage** | The work | Plan or 3D, always dominant, never resized by selection. Mode pill top-centre only when the Stage is in a special state (placing, looking through, following). |
| **Card** (324 px) | What is selected and what I can do with it | Appears with a selection, disappears without one. Docked over the Stage’s right edge (not a fourth column), so selecting never reflows or re-frames the Stage. On narrow widths it is a bottom sheet. |
| **Instrument** (dark, inset in the Stage) | The task I invoked | Absent at rest. In Experience it is the **Guide** — sequence editor *and* playback timeline — opened from the Index and closed with ×. In World it holds World tasks (Measure here). Width follows content, bounded by the Card. |

Why a docked overlay Card rather than a column: a permanent inspector is either empty or pushes the
Stage around. An overlay that appears with selection keeps the Stage stable and the Card honest.
The Plan’s *Fit* reserves the Card’s width, so opening a Card never forces a camera move.
While looking through or following, the 3D canvas narrows to the uncovered area instead, so the
composition you judge is the whole frame (pose unchanged; only aspect).

## 2. Presentations and Views

- **One creation concept.** A Presentation is created either *from a thing* (select any object →
  **Present this**, which frames a first View on it) or *from a standpoint* (**New** in the Index:
  in 3D it captures what the Stage camera sees; in Plan you place the camera by press-and-drag).
  There are no object/environment/region types. The optional subject is shown only as a quiet
  “about …” link in the Card kicker.
- **The creation action is not duplicated.** The Index has **New**; an object Card has
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
   disagree with the Guide.

The working model from the brief is kept (Stop-local selection and order, entry = first, new Stop
starts at Default, Default unaffected). It is the right level: one list, two verbs (include, order),
and it makes repeated visits meaningful — Stop 5 revisits the piano from the pianist’s seat.
See [scope and critique §3](./scope-and-critique.md#3-where-this-disagrees-with-the-brief) for the
consequence it creates for routes and how the design surfaces it.

## 4. Guide: the sequence *is* the timeline

The Guide instrument shows light Stop cards (entry thumbnail, number, Presentation, View count,
duration, proportional View segments) joined by **connectors** (`↗ 8s` or `✂`), above a
time-scaled **overview bar** of the whole Guide. It is opened from the Index, never shown by
default.

- **Direct manipulation.** Drag tiles to reorder; drag a Presentation from the Index onto the
  Guide to insert a Stop at the caret; **Add stop** picks any Presentation (again is allowed — the
  tile says *again*). The selected tile alone gets a ⋯ menu (Open Presentation, Move earlier/later,
  Remove). Keyboard: focus a tile, Alt ←/→.
- **Connectors are the transitions.** Clicking one selects the transition; its label states what
  the visitor does (*Next*) and what the camera does (*Travel 8 s* / *Cut*).
- **Timing lives on the same instrument.** The overview bar is the timeline: each Stop is a
  segment as long as its View holds, each Travel a link as long as its duration. Scrub there; the
  cards scroll to the moment. There is no second Journey surface to keep in sync.
- **Long Guides.** The overview’s bracket shows which Stops the cards show. Drag a card onto the
  overview to move it far (gold caret shows where); *Move to the start/end* in ⋯; ←/→ walk.

## 5. Camera path and playback

- **The Stage is the path editor.** Paths appear only while the Guide is open. Selecting a
  Travel shows its route in gold on the Plan (and in 3D); neighbouring routes are solid, the rest
  faint (or hidden with *Show → Selection only*). Drag points; click the path to add one; select a point to remove it (or Delete). A path that
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
  glyph on Views, 2 px ring on tiles, left bar in the Index).
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

- In the Index, each View carries a filled dot (on the tour) or a hollow ring (free only);
  Presentations show the Stop numbers that use them or a dashed *free* tag.
- The Presentation Card has **Visitors reach it**: “On the tour at Stop 2 · Stop 5” and a single
  **Open in free exploration** switch.
- The Guide Card (“One museum, two ways in”) states both modes with counts, including how many
  Views only free exploration reaches, and previews either.
- In the visitor preview, **Guided** auto-advances Views by hold and waits for **Next stop** between
  Stops; **Explore freely** lists every open Presentation and View and returns with **Back to the
  tour · Stop N**.
