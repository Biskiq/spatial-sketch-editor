# Creator journeys: where ordinary work stops

Part of the [T1 next-batch proposal](./README.md). Each journey is a thing a creator building a
small exhibition space would do in one sitting. "Stops at" is read from code at `97e208d7`, not
observed in a browser. J1–J6 define the completeness lane: when they pass, the lane is done.

Revision 3: each journey names the slices that make it pass. J10–J13 cover Spaces, Interior
Reveal, Slice and the T1–T2 contract with the approved policies.

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
   The door's relation to the hall is not copied and the consequence line says so.
4. He drags the copy against the hall. Nothing attaches: Room move is a rigid translation and
   overlap between independent groups is permitted, so the chapel's back Wall lies on top of the
   hall's Wall as a second Wall and the door joins no Rooms. With A5 the Stage reads **overlaps,
   not joined** on the doubled stretch.
5. To finish he erases the doubled Wall and redraws the two joints. Weld is outside this batch, so
   this journey is met up to the cue and no further. That limit is accepted.

**Needs:** A4, then A5 with the overlap cue. **Proves:** copy-never-share;
consequence wording; ids captured so Redo replays them; the copy never lands on its source.

## J5. Hang a row of windows precisely

> Lan has a 12 m wall and wants five windows at equal spacing, heads aligned at 2.4 m.

1. She places the first window. **Stops at:** there is no Repeat. She places four more by eye and
   corrects each offset in the Card.
2. With Repeat: on the Opening, **Repeat** takes a count and a spacing in metres; four cobalt
   proposals appear along the Wall; a copy that would leave the Wall or hit another Opening
   refuses the whole set in words. One entry.
3. To judge the result she wants a square view. Unroll gives a flat measured sheet, but **the view
   stays where it was**, by design. *Face this wall* is in the Card menu, disabled.
4. With Face: one explicit action squares the Camera to the wall or its sheet; Put back returns
   her to the entry view.

**Needs:** A8 Repeat (the substance), then A6 Face (the comfort). **Proves:** Repeat validates the
whole Opening set as one batch; Face goes through the one Camera authority and never fires from
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

5. Throughout, it is still **the Rotunda**: one name, one row in the Index, one thing to select,
   move, duplicate or paint. Clicking its floor selects it and shows Radius; clicking a stretch of
   its wall selects that Wall, with its own Openings and Unroll, and one step returns to the whole.
6. He tries to bend one stretch. It refuses and offers **Release round**. He leaves it round.

**Needs:** S1, then C. Unroll the room (R) serves step 4's last clause and blocks nothing. **Proves:** this is the journey that
cannot be met by a small change.

## Depth journeys (not part of the completeness lane)

### J7. A courtyard and a canopy

> Lan's museum has an open courtyard and an entrance canopy that stops short of the facade.

- Every closed ring gets a derived lid at the height of its tallest Wall. She cannot open the
  courtyard to the sky, lower a ceiling below the Walls, or author a canopy with a deliberate gap.
- With Spaces: she sets the courtyard's **Overhead** to **Open to sky**. That is a statement about
  the place and needs no geometry. The lid goes; the Walls and floor stay.
- With V1: the canopy is a flat overhead region she draws; its relation to the facade reads "gap
  0.40 m", and she marks it intended. If she later roofs part of the courtyard, it reads "Open to
  sky · under Canopy 2" and stays open by intent.

**Needs:** SP1 for the intent, V1 for the canopy.

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

### J10. A booth, a terrace and a pavilion

> Lan's exhibition has three open-fronted booths along one wall of the hall, a raised terrace
> outside, and a roofed pavilion on posts.

**Booth, from a Room.** She has a closed, named, furnished Room, "Booth 2", and erases its front
Wall. Today the Room is retired with its name. With SP1 the consequence line reads **Keeps Booth 2
as an open space**; the front becomes a dashed virtual edge; the floor, the name and the plinths
stay. The booth sits wholly inside the hall Room, which is allowed, and a plinth in it is listed
under Booth 2, not the hall.

**Booth, from partial Walls.** For Booth 3 she draws three Walls and no front. She arms **Room**
and hovers inside: the three Wall sides show in ink and the missing front as a cobalt dash. Click;
she types the name. She drags the virtual edge's grip outward to give the booth an apron and it
stops at Booth 2 with **Stops at Booth 2**.

**Terrace, from a floor.** She draws a floor region 0.3 m up with the Terrace tool. It arrives as a
Space, "Terrace", open to sky, following the floor's outline. She resizes the floor; the Space
follows.

**Pavilion.** A floor region, an overhead region above it and four posts. The Space came with the
floor; its Card reads "Open to sky · under Canopy 1".

**Closing again.** She later draws the front Wall back on Booth 2 along its virtual edge. The Card
reads Room. Same id; the finish she applied to its floor never moved.

**Needs:** S2, SP1, SP2; SP3 and V1 for the terrace and pavilion.

### J11. Working inside a finished room

> Minh's gallery has four Walls and, after V1, a dropped ceiling. He arranges plinths and aims
> lights inside it from an orbiting 3D view.

1. From above he sees a lid. He picks **Lift** from the reading control. The pill reads **Lift ·
   Gallery · Put back**; the ceiling leaves a dashed outline; he clicks straight through to the
   plinths. The spots still fall as they did: nothing is relit.
2. He needs to change the ceiling height. He clicks its outline; it draws as a ghost with its
   handles and he edits it in place.
3. From the side the near Wall is in the way. With the cutaway on **Cut** it is a low stub he can
   click through. He wants to judge the facade, holds the key, and the Walls stand whole until he
   lets go.
4. He opens Preview. Everything is as built. He comes back and Lift is still on. **Put back**.

**Needs:** X0, X1, X2.

### J12. Seeing the whole building at once

> Lan has eleven Rooms under ceilings and wants to check the visitor route through all of them.

1. Lift everything would work but leaves full-height Walls hiding the far Rooms.
2. She arms **Slice**, Level. A yellow plane appears at the Sheet's height. She drags the Sheet to
   1.2 m: every Wall is cut to a capped stub, every ceiling is gone, doors and windows read as
   gaps. The pill reads **Cut at 1.20 m · Put back**.
3. She returns to Select and moves two plinths. The cut stays.
4. She wants the long section through the entrance hall. Slice, Drawn: two clicks across the
   building; the near half disappears; **Flip** shows the other half; the depth ray pulls the
   reading back to just the hall. **Face** squares her to it.
5. **Put back.** Nothing was authored.

**Needs:** SL1 for steps 1–3, SL2 and A6 for step 4. Section (SL3) is not needed for this journey.

### J13. A finish that survives an edit

> Lan has painted the long wall of the gallery brick (T2). Then she splits it and pushes out an
> alcove, and later joins it back.

- Both pieces stay brick after the split. The joined Wall is brick.
- She joins a brick Wall to a plaster one. The consequence line reads **Plaster replaced by
  Brick**. Undo brings the plaster back.
- A duplicated chapel comes with its finishes.
- She opens Booth 2 by erasing its front Wall. Its floor finish is untouched, because the Space is
  the same Space.
- She painted the rotunda's inside once. After the gallery attaches, every arc is still painted.

**Needs:** J, relied on by T2's S5a; SP1 for the booth; C for the rotunda.
