# Creator journeys: where ordinary work stops

Part of the [T1 next-batch proposal](./README.md). Each journey is a thing a creator building a
small exhibition space would do in one sitting. "Stops at" is read from code at `97e208d7`, not
observed in a browser. J1–J6 define the completeness lane: when they pass, the lane is done.

## J1. Move a doorway wall without rebuilding the room

> Lan drew a 6 × 4 m gallery as a Box. She wants the right-hand third of the long wall pushed out
> by a metre to make an alcove.

1. Select the long Wall. She needs a joint at 4 m so one part can move.
2. **Stops at:** there is no way to put a joint on an existing Wall. The only route is to erase the
   Wall and redraw three Walls, which retires the Wall id, drops its Openings and makes a new Room.
3. With split: a joint appears at 4 m; the Wall on one side keeps its id and Openings; the Room
   keeps its id. She adds a second joint, drags the short piece out, and the corners follow.

**Needs:** A1 split. **Proves:** Wall, Opening and Room identity through a split, straight and
curved.

## J2. Clean up after a change of mind

> Lan drags the alcove back flush. The long wall is now three collinear pieces with two joints she
> no longer wants.

1. **Stops at:** the joints cannot be removed. Length edits, Unroll and Openings now act on a third
   of the wall. An Opening cannot be slid across a joint.
2. With join: she drags a joint onto the line between its neighbours; it reads **Remove joint**, as
   a bend point already does; release merges the two Walls into one entry. One Wall id survives,
   Openings re-base, the Room is untouched.
3. At a real corner the same gesture never offers removal, and the Eraser on that joint says why.

**Needs:** A2 join. **Proves:** dissolve keeps Room identity; refusals have words.

## J3. A curved end wall

> Minh wants a gallery whose end wall is a shallow arc between two existing corners.

1. Walls plate → **Arc**. **Stops at:** the option is disabled ("Curved walls arrive with T1").
2. Workaround today: draw a straight Wall, then Ctrl-drag its body to bend it. It works, but he
   cannot state the rise, and it is two steps and a modifier he has to know.
3. With Arc: start, end, then pull the bulge; the tag reads the rise and radius; one Wall, one
   entry; the Room closes as it does for a Line.

**Needs:** A3 Arc. **Proves:** an arc drawn in one stroke is the same canonical `cubic-chain` Wall
as a bent one.

## J4. Three identical side chapels

> Minh has one finished side room, 3 × 3 m with a door and a window, sharing its back wall with the
> main hall. He wants two more.

1. Select the Room. **Stops at:** no Duplicate anywhere. He redraws each Box and re-places and
   re-measures each Opening.
2. If the room were free-standing, the existing isolated duplicate would do it; wiring it is A4.
3. His room shares a Wall, so the isolated planner refuses (`room_not_isolated`). With A5 the copy
   is a free island: four Walls including a copy of the shared one, both Openings, one new Room.
   The door's relation to the hall is not copied and the consequence line says so. He drags the
   copy against the hall and the ordinary attach rules apply.

**Needs:** A4, then A5. **Proves:** copy-never-share; consequence wording; ids captured so Redo
replays them.

## J5. Hang a row of windows precisely

> Lan has a 12 m wall and wants five windows at equal spacing, heads aligned at 2.4 m.

1. She places the first window, then orbits to get a square view of the wall to judge spacing.
2. Unroll gives her a flat measured sheet, but **the view stays where it was**, by design. On an
   oblique view the sheet is foreshortened. **Stops at:** *Face this wall* is in the Card menu,
   disabled.
3. With Face: one explicit action squares the Camera to the wall or its sheet; she slides and
   repeats windows against the station ruler; Put back returns her to the entry view.

**Needs:** A6 Face. **Proves:** Face goes through the one Camera authority and never fires from
Unroll.

## J6. A rotunda at the end of a gallery

> Minh draws a circular Room, 8 m across, and a rectangular gallery whose end walls should run into
> the rotunda so the two spaces share a doorway.

1. He draws the circle. One Wall, one Room. Good.
2. He draws the gallery's side Wall ending on the rim. **Stops at:** `closed_wall_isolated`.
3. Workaround today: none that produces a shared boundary. He can leave a gap and stand the
   rotunda beside the gallery, but there is no door between two Rooms.
4. What he expects next, in order: the walls attach; a door in the shared arc joins the two Rooms;
   the rotunda still has a Radius he can change; changing it carries the gallery walls with it or
   refuses and shows why; he can still see the rotunda's whole inside as one sheet.

**Needs:** the connected-curve decision (S1), then C, then Unroll the room for step 4's last
clause. **Proves:** this is the journey that cannot be met by a small change.

## Depth journeys (not part of the completeness lane)

### J7. A courtyard and a canopy

> Lan's museum has an open courtyard and an entrance canopy that stops short of the facade.

- Every closed ring gets a derived lid at the height of its tallest Wall. She cannot open the
  courtyard to the sky, lower a ceiling below the Walls, or author a canopy with a deliberate gap.
- Wants: a flat region she draws or seeds from a Room; a clear statement of whether it closes the
  Room or hangs in it; "gap 0.40 m, intended" as a fact rather than an error.

**Needs:** V1. **Raises:** D2 (what the region's height is measured from), D3 (how an intended gap
or an open-to-sky Room is represented).

### J8. A gabled hall

> Minh wants a long hall with a pitched roof and the end walls rising to the ridge.

- Wall height is one scalar. A gable roof over level Walls leaves two triangular holes; raising the
  end Walls to the ridge makes a box.
- Wants: end Walls with a gable top; side Walls level at the eave; a gable form over them; a
  one-shot fit in either direction; nothing following automatically afterwards.

**Needs:** V2 then V3.

### J9. A mezzanine

> Lan wants a gallery overlooking the hall from 3 m up.

- One Floor per document. No second datum, no slab an upper Room can stand on.

**Needs:** levels (`layout.multi-level`), after V1 has shown how creators use overhead regions. A
flat suspended region at 3 m from V1 is the cheapest probe of whether this demand is real.
