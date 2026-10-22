# T1.P02 — Shell draft: Draw, Opening and delete

**Status:** first draft for review, 2026-10-22, under PLATE's
[feature design loop](../../../reference/design-system/editor-shell-and-visual-system.md#product-convergence-destination)
(draft → review → build → browser observation → revise). It sets no keymap, pixel or format, and it is
not the production shell until S02/S03 build it and the browser review revises it. Authority stays in
[PLATE World Paper authoring](../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
and the [lower-surface span](../../../reference/design-system/editor-shell-and-visual-system.md#contextual-lower-surface-span).

## Starting point (landed partial shell)

Head (Undo/Redo, Save, a disabled Preview), a collapsible Index, the Stage, an overlay Card anchored
bottom-left above the Stage, and one lower instrument at the bottom centre. Contributed tasks
(Place object, Arrange, Compose, Layout dimensions, plinth) appear as Index groups by declared family.
That listing departs from PLATE, where the Index is a locator and tools live on the pointer rail and
in Find. The Card overlaps the Compose instrument at common widths (the residual S06 handed to T1).

## Proposed composition

1. **Pointer rail, introduced by S02.** A compact rail on the Stage edge renders contributions by
   their declared family, in PLATE's fixed order. It shows only families with a live grammar:
   **Select** and **Draw** in S02, **Opening** in S03, and **Place** from the existing Scene
   contributions and C2's import. Measure and More appear when they exist. The Index stops listing
   tools once the rail and Find carry them. The rail is family-driven, so T2 and T3 contribute entries
   without editing the shell.
2. **Card and instrument arbitration.** The instrument keeps local span at the lower centre. The Card
   docks to the free side of that span and never covers it; when both cannot fit, the Card compresses
   to its identity line with an expand control. Opening or closing either never reframes the Stage.
   Checked at the desktop wide width, the narrow desktop threshold and the narrow viewport.

## Draw (S02)

| State | What the creator sees | Commit, undo and refusal |
| --- | --- | --- |
| Armed | Draw highlighted; option strip shows Snap/Grid defaults for the next Wall and a fading key hint; selection unchanged | Esc or Select disarms; nothing is written |
| First point | Pointer marks show the target: an existing Junction, a Wall interior (split mark) or a grid point when Snap is on | Nearness without a mark never connects |
| Drawing | Ghost Walls with live length and angle tags; the derived consequence next to the pointer: *encloses a new Room*, *divides Kitchen*, *free-standing*; digits turn the tag into numeric entry (length, then Tab for angle) | Backspace removes the last point; Esc cancels the whole chain with no source change |
| Finish | Click the start Junction to close, Enter to finish open, or end on an existing Wall | One accepted result and one undo step per chain; the last created Wall becomes selected and the tool stays armed |
| Earned disclosure | When the chain splits or creates Rooms or touches referenced identities: *Creates 3 Walls · Splits Room A · one undo step*, counts read from the planner | Shown before the finishing click, never as an Apply step |
| Refusal | Words at the pointer: *crosses Wall 12 — end on it to connect*, *overlaps Wall 4*, *closed inside Room A without connecting — connect it or draw outside* | Finishing is refused; the chain stays editable; no partial source |
| Undo while drawing | Undo/Redo unavailable with the reason *finish or cancel the Wall first* | — |

Keyboard path: with a Wall end or Junction selected, Draw starts from it; otherwise the option strip
accepts a typed start coordinate. Every subsequent point can be typed. Proposed keys, for review:
`W` arms Draw, Enter finishes, Esc cancels, Backspace removes a point.

The Card never shows a role chooser: its read-only role fact reads *Bounds Room A*, *Divides A | B* or
*Free-standing*, and it opens Details for the derivation.

## Delete (S02)

Delete sits in the Card's ⋯ list and on the Delete key for a selected Wall. When it removes Openings
or merges or opens Rooms, the consequence line names them before confirming:
*Deletes 2 Openings · Merges Rooms A and B · one undo step*. Delete is one accepted result; refusal is
in words.

## Opening (S03)

Armed Opening projects a ghost onto the hovered Wall's axis, prefers the selected host on ties, and
shows width and offset tags. Click places the default size; digits type the offset. An ineligible host
or an overlap with another Opening refuses in words. Settled size and position stay in Dimensions,
the one settled-measure writer. Removing an Opening is in its Card ⋯ list.

## Review checkpoints

- Before S02 build: owner or design review of the rail introduction and the Card arbitration, which
  are the two shared-shell changes here. Everything else is local feature composition.
- After S02 build: real-browser observation of empty → draw → close → divide → delete in Plan and 3D,
  keyboard-only, narrow and reduced motion, recorded with revision and viewport; revise this draft.
- After S03 build: the same observation for Opening.

Proposed departures for owner review: none beyond PLATE. The rail and arbitration implement PLATE
rules the partial shell has not built yet; moving tools out of the Index removes an existing departure.
