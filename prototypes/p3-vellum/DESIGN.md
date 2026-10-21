# Vellum: the design

## Point of view

**Everything is a drawing, and the drawing is read back to you.**

Non-professionals already know how to draw what they mean: a line for a wall, a loop for a room, a ∩ for an arch,
the patch of shade they want. They do not know the parameters a modelling tool wants. So Vellum has one pen that reads
what you mean, and one hand that looks and shapes. **Draw** only draws; **Select** picks, shapes, moves and turns the
table, and never draws. (The first round had no tools at all, and inspecting or nudging something too often drew
something new; a stroke starting on a wall's middle could also grab its handle instead of dividing the room.) A blank
table opens in Draw, a building you open in Select. Whatever you draw, the table says what it read ("Wall dividing Middle gallery",
"Arched opening, 1.4 × 2.6 m", "Canopy, shade drawn by its shadow"). One tap or **Tab** picks another reading, and
that choice amends the same undo step instead of adding a new one.

Revision is where tools usually break trust, so the whole surface uses the marks architects already use for honesty:

| Mark | Meaning |
| --- | --- |
| **Ink** | Accepted work. It is never changed without telling you. |
| **Pencil** (dashed, grey) | A suggestion: a borrowed room height, posts that would hold a canopy. It becomes ink only when you accept it. |
| **Red pencil** | A consequence that wants a look: a roof edge with nothing under it, a door that no longer fits. |
| **Blue** | Your hand: what is picked, its handles and live measurements. |

## The grammar

1. **One pen, read aloud.** A stroke is read against what it touches:
   - on the table: a wall, a room, a round room, a raised floor or a sunken court;
   - on a wall's face: an opening;
   - from one floor to another: a stair or ramp that follows your walk;
   - on the sheet: something in the air;
   - on a roof: a skylight.

   A circle drawn in perspective is read on screen, as the hand meant it, so it becomes one continuous round wall
   rather than a wobbly polygon. Hold ⇧ and the stroke becomes a ruled, straight line instead.

   **Snapping explains itself and never decides for you.** Ends, wall faces, square / 45° / parallel to nearby walls
   and lining up with corners all show as blue guides with a few words ("⊥ Gallery wall · 4.20 m"); ⌥ turns them off.
   A snap is only a position. A wall end that lands on another wall *touches* it, and the ripple asks whether to
   **Join** (then it follows that wall when it moves), in the same undo step. If a wall moves away from one that only
   touched it, the ripple offers to bring that one along. Touching, joining and following are never inferred from
   coordinates that happen to coincide.
2. **The sheet** is one piece of tracing vellum on a rail. It is the plane you draw on, the level you are working at,
   and an x-ray of everything above it. There is no global storey stack: every room, deck and roof keeps its own height,
   and the rail shows them as magnetic, labelled heights ("Studio top", "Mezzanine", "Old wing roof eave"). When the
   sheet lies on a floor you draw on that floor; lifted, you draw in the air. Raising it while selecting picks up
   the pen (it's paper; the dock shows Draw), and putting it away puts the pen down again.
   - **Add a floor above** is the shortcut for a conventional storey, made of the same ordinary parts: a floor at
     the room's top, walls along its outline (the same curved or round wall when one wall makes the room) and a room
     as tall as the one below. It ties nothing; the floor and walls simply stand at that height. A roof over the
     room is never moved by itself: when it is in the way, the ripple offers to lift it, in the same step. Freehand
     floors on the sheet stay for mezzanines and odd platforms.
3. **Draw the shape you mean.**
   - Roofs come from a drawn section profile: a rise with a step makes clerestory glazing, an arch makes a vault, and
     on a round room the profile spins into a dome or cone. The drawing then stays editable without redrawing: drag
     a point, drag the line to bend it (the pull fades across the smooth stretch and stops at creases and steps, and
     adds no points), double-click to add a point, ⌥-click to remove one. The pad and the blue section drawn on the
     roof are two views of the *same* authored points, so editing either updates both live, and every gesture is one
     undo step.
   - Ordinary roof sculpting happens on the roof, with a few handles that each do one thing: the peak (up and down
     scales the heights so the shape keeps its character; sideways leans it, carrying each slope along), a shoulder
     on each slope (outward is broader and fuller, inward is pointier; a symmetric roof stays symmetric; the first
     pull gives a straight slope its one smooth point, the only point it ever adds), the edges for width, and the
     eave for the whole roof. A flat roof's peak handle reads *pull up* and grows one sharp peak. Bending the
     surface, sharp/smooth, adding and removing points and the presets are depth you go to on purpose (the pad,
     the points that come out as you near them, *Shapes & settings*).
   - Handles are few by default (a wall's ends, height and move; a roof's eave, peak, shoulders and edges). Corners,
     bends and profile points come out as the pointer nears them, or all at once with *Show every point*.
   - Canopies come from their shadow; stairs from their walk.
   - Heights are given in people as well as metres ("4.2 m · about 2½ people tall"), and scale figures stand in the
     rooms.
4. **Ripples, loose ends and the tray.**
   - Every edit is one transaction that reports what moved with it. Choices (carry the floor above up, or keep it)
     and repairs (add 5 posts) amend that same step. *Put it back* refuses the whole edit.
   - Unrepaired consequences become **loose ends**: never blocking, and acknowledgeable as "it's meant to be".
   - Nothing is deleted as a side effect. Openings that lose their wall, a merged room's settings and objects that
     lose their surface go to the **set-aside tray**, where they can be put back or let go on purpose.
5. **Peeks spring back.** Lift (hold L), slice, sheet x-ray or cut, and isolate all have their own history. A pill
   says "Peeking — building unchanged", and Esc restores the exact view and camera.

## From built to told

**Make · Tell · Visit.** Tell locks the building, says so, and gives the pen a new meaning: the visitor's walk, which
climbs stairs because its height comes from the surfaces under it. Beads on the walk are **moments**: a caption, a
target to look at, a pause, and a *reveal*. The creator's own inspection tools return as presentation-only reveals
(lift the roof, cut at this level, slice through, light from above). Visit is a player with no creator tools at all.

Each sample opens with the model lifted apart and settling back as the visitor walks in. That is the moment the thing
you built becomes a thing you tell.

## How the brief's scenarios land

| Scenario | In Vellum |
| --- | --- |
| Freehand curved gallery, round room, arch | Strokes are fitted to lines and arcs. A circle becomes one round wall with centre and size handles. A ∩ on any wall face becomes an arch; feet near the floor make it a doorway. |
| Orthogonal galleries, drama overhead | Angles snap to existing walls. Pick the roof and draw its section in the pad; ceilings stay flat unless set to *open to the roof*. |
| Canopy with no walls, past the footprint | With the sheet at a room top, draw the shadow. A red ripple offers pencil posts: one click accepts, still in the same step. |
| Building too small | ⌘A picks the whole building; the corner handle scales the plan, with or without heights. Doors stay person-sized, round stays round, and the inspector lists what each element remembers. |
| Divide a room, then remove the divider | The new half borrows its height in pencil. Removing the wall makes the room whole again; a changed half's settings go to the tray. |
| Reshape a curved wall with openings | Bend handles; openings ride by their anchor (keeps its place, near the start, near the end). If one no longer fits it turns red, with slide, shrink and set-aside repairs. |
| Remove something others lean on | Hover *Remove* to see what turns red first. Afterwards, the roof stays and the ripple offers posts. |
| Two wings, plinth, bridge, stairs | Raise one room's floor for a plinth. An open stroke on the sheet between wings reads as a bridge; drawing from floor to deck makes a stair. |
| Compression, mezzanine, lightwell | A closed stroke through the deck reads as a lightwell. Raising its bottom bead above the mezzanine fills the deck back in, because the deck's outline was never cut. |
| A second storey | Pick the room, hover *+ Add a floor above* to see it, click. Choose whether the roof lifts onto it; then reshape the new walls, or pull the sheet up to the new top and sketch its roof. |
| Raise a ceiling with a floor above | A tied deck asks: carry it up (and with it the room standing on it, and that room's roof), or keep it as a mezzanine inside. The stair reports the steps it gains. |
| Move an object across levels | Ghosted and cut parts can't be picked, so you drop through to the visible floor. The ripple says "Sculpture moved from The hall to Mezzanine". |
| Imported architecture | Drop a `.glb`, or open the prepared boathouse. It can be sliced, x-rayed, walked and told, but not reshaped; switch it to a tracing underlay and draw native walls over it. |

## Where another tool is simply better

Native drawing wins for anything you will keep changing: rooms, heights, levels, openings, light, and telling it to
visitors. Rhino, SketchUp, Blender or Revit win for ornament, detailed façades, freeform surfaces, terrain, and
construction documents or BIM data. Vellum says so in the app and keeps imports honest: fixed geometry, no pretend
rooms inside them, and no section fill when cut.

## Rough edges I know about

- Readings are heuristics. A stroke that starts on a roof, or a "circle" drawn very flat, can still be read
  unexpectedly. The alternatives in the chip are the safety net.
- A ripple after a large removal can list many consequences. They fold after four, with the most serious first.
- Touch camera gestures, stair landings and code checks are not implemented.
- Navigation was smoothed for trackpads (tight follow for direct input, zoom about the pointer, Safari gestures, one
  input source at a time), but the trackpad/mouse split is still a heuristic. It is checked with recorded traces
  (`__t.trace`), not yet on every device.
- *Focus height* is a lightweight experiment: a height band, not a floor. Two wings at the same height focus together,
  and there are no per-element exceptions (a stair through the band is cut like everything else). A real floor
  workspace and 2D drafting belong to production (PLATE).
- Support is a geometric rule of thumb, not structure.

## What I would do next

1. Watch five non-professionals do the brief's journeys. In particular, check whether "the sheet" is understood
   without the hint line, and whether Tab-to-reread is discovered.
2. Pencil "before" ghosts while dragging a reshape, so the old position stays visible until you let go.
3. Draggable tray items (put an opening back by dropping it on a wall) instead of menus.
4. Touch: two-finger orbit, and a long press for the reading chip.
5. A shareable, read-only Visit link (today Visit plays locally only).
