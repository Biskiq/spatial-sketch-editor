# T1 next batch: product and UX proposal

**Status:** revision 3, 2026-11-10, final for implementation planning. Owner decisions are approved
and recorded in [implementation-prs.md](./implementation-prs.md#decision-record); none remain open
in this document. Authorises no production change by itself: each slice still opens its own PR, and
Tier 2 slices their own plan. **Base:** `main` at `97e208d7` (#287 merged). Coordinated with the T2
Look & Atmosphere proposal (#289), which this PR does not edit.

**Evidence limit.** Statements about current behaviour come from reading code, tests and contracts
at that commit. Nothing was exercised in the running editor. The UX proposals are static sketches
that have not been tried by a creator. What still needs a check is listed once, under
[Verify first](./implementation-prs.md#verify-first).

| Read | For |
| --- | --- |
| This file | Verdict, findings, the designs in words, execution sequence, readiness, accepted risks |
| [Creator journeys](./creator-journeys.md) | Where ordinary work stops today, and what each slice must make pass |
| [UX proposals](./interaction-sketches.html) | Step-by-step interaction designs for the eleven consequential questions |
| [Implementation slices](./implementation-prs.md) | Slice boundaries, dependencies, acceptance criteria, decision record |

## Verdict

**T1 has a wiring gap, not a design gap, in its fundamentals.** Split, join, isolated Room
duplicate and Opening Repeat exist as tested layout-core planners that no editor intent reaches.
Arc is a disabled option on the Walls plate. These ship first as six small PRs.

Behind them sit five pieces of real design, now resolved to the level a plan can start from:

- **Spaces.** A Room that loses a Wall stays the same named place as an *open space*. Open spaces
  can also be made from partial Walls and, later, from a floor. One concept, one rule for when it
  exists, no overlap on the same surface.
- **Interior Reveal.** Lift takes overheads off; the near-wall cutaway becomes switchable. Both are
  session readings.
- **Slice.** A deliberate horizontal or drawn vertical cut, already specified by PLATE and never
  built. The horizontal cut is ranked **ahead of** the automatic cutaway.
- **Connected curves.** A connected rotunda is a ring of arc Walls whose identity is its Room. A
  bounded spike proves it before any plan.
- **Verticality.** Flat horizontal regions, then Wall top profiles, then shed and gable forms.

## What inspection found

### 1. Built and unreachable

| Operation | layout-core | Editor intent |
| --- | --- | --- |
| Split a Wall at a station or point, straight and curved (exact cubic subdivision, Openings re-based) | `planWallSplit`, `planWallSplitAtPoint`, `planWallSubdivision` | None |
| Dissolve a degree-2 Junction, merging two Walls, keeping Room identity | `planDissolveJunction` | None |
| Duplicate an isolated Room with its Walls, Junctions and Openings | `planDuplicateIsolatedRoom` | None |
| Repeat an Opening along its Wall (count 1–50, spacing in metres, one validated batch) | `planRepeatWallOpening` | None |
| Repeat a Layout object | `planRepeatLayoutObject` | None |
| Rotate a Room group; remove a Room | `planWallFirstRoomRotation`, `planRemoveRoom` | None |
| Arc Wall | Open `cubic-chain` Walls, bend and knot planners | Walls plate **Arc** is disabled |
| Pointed Opening | `profile: 'pointed'` in the schema | Ink plate **Pointed** is disabled |

The Card's `•••` menu already lists **Face this wall**, **Unroll the room** and **Section through
here** as disabled items. The World toolbar already registers **Slice**, **Room**, **Roof** and
**Terrace** as planned tools. PLATE already specifies Slice, Lift, the near-wall cutaway and Edit
shape. The shell has promised most of this batch by name.

### 2. Facts that shaped the designs

- **Overlap is permitted and silent.** The canonical topology gate allows overlap between
  independent Wall groups; a clone placed across other Walls commits and joins nothing
  (`layout-duplicate.ts`, policy D-1/E and D-9). Room move is a rigid translation that asserts no
  Room is born, retired, split or merged. Nothing in the model turns a docked island into a shared
  Wall.
- **Opening an enclosure retires the Room.** Reconciliation retires any Room whose face has no
  successor (`layout-room-reconciliation.ts`, "room disappearance"). Erase one outside Wall and the
  Room, its name and its surface thicknesses are gone. This is the behaviour the approved Space
  policy replaces.
- **A Room record bundles three things:** identity (`id`, `name`), derived topology (`boundary`)
  and physical surface data (`floorThickness`, `ceilingThickness`).
- **Crossing noding is straight-only**, a Wall can end on a curve but not pass through one, and
  face extraction synthesises no holes. All three stay as they are.
- **Slice is specified and unbuilt.** PLATE defines a horizontal cut at the Sheet height and a
  drawn vertical Slice with a pill, depth, Flip, Face and Section. Code has a disabled dock button
  and a toolbar stub whose options (Axis X / Z) do not match PLATE.
- **The automatic near-wall cutaway is specified.** PLATE says near-side walls are cut away and
  click-through while working inside a room in 3D. I found no implementation under any obvious
  name. Whether it exists is the first thing the Reveal lane establishes.

### 3. #287 left documentation debt

The expressive-walls plan was to be deleted and its rules promoted before merge. The plan is still
listed as a draft and the Layout contract still describes format 6 in places. Code is at format 7.
An agent reading the contract gets the wrong current state. This is slice A0.

## Positions taken, and why

These were open questions in earlier revisions. They are now design decisions with their reasons.
The governing direction is the owner's: **simple, predictable concepts over unrestricted
flexibility; sensible defaults; explicit workarounds.**

**Junction editing is two operations.** Split a Wall, and join two Walls. "Delete a Junction" has
no single meaning once three Walls meet. Erasing a joint joins when exactly two compatible Walls
meet there and refuses in words otherwise. Corners are never joinable.

**Duplicate copies, never shares, and says when a copy is not joined.** The copy is a free island.
It starts clear of its source. When any free island rests on another group's Wall, the Stage reads
**overlaps, not joined**. Joining a docked island (weld) is not in this batch: the cue first shows
how often creators want it.

**There is no simple connection to a circle.** A Room adjoining a rotunda puts two Junctions on the
rim. The connected rotunda becomes a ring of arc Walls.

**One architectural object does not mean one stored Wall.** The rotunda's identity is its Room,
which is how a Box with a split Wall is still one Room. Roundness is a stated fact of that Room,
never a shape re-recognised within a tolerance.

**A Space must rest on something physical.** A named outline of nothing is the failure mode of
every "zone" feature. A Space exists while a Wall stands on its boundary or a floor lies under it.

**Reveal is two readings, not a visibility system.** No eye per row, no stored hidden state,
nothing a visitor can inherit.

**Deterministic before heuristic.** A horizontal Slice is one plane at a stated height. The
automatic cutaway is a guess about which Walls are in the way. The plane ships first.

**"Focus" stays the Height Sheet's word.** The readings are Face and Unroll, as PLATE already has
them.

**Verticality is four milestones, and three are in scope.** Levels, stairs and terrain are not.

## Spaces

### The concept

A **Space** is a named place. Its boundary is a closed outline whose edges are each either a
**Wall side** or a **virtual edge**, a stated straight segment with no architecture on it.

| | Edges | Reads as | How it comes to exist |
| --- | --- | --- | --- |
| Enclosed | All Wall sides | **Room** | Derived from Walls, as today |
| Open | At least one virtual edge | **Open space** | A Room loses a Wall; or made from partial Walls; or follows a floor |

It is one subject kind with one Card, one Index group and one id. "Room" and "Open space" are what
the Card's kind line says, not two entities with a conversion between them.

### The rules

1. **Existence.** A Space exists while at least one Wall stands on its boundary or a floor region
   lies under it. When the last one goes, the Space goes with it, and the consequence line says so.
2. **Opening a Room.** Erasing a boundary Wall that faces outside keeps the Room as an open space:
   the erased stretch becomes a virtual edge between the same two ends. Name, id, floor, overhead
   setting and contents are kept. Erasing a Wall between two Rooms merges them as it does today.
3. **Closing it again.** Drawing a Wall along a virtual edge replaces that edge. When no virtual
   edge is left the Space reads Room again. Same id throughout, and Undo reverses each step.
4. **No overlap on the same surface.** Two open spaces never overlap. An open space never overlaps
   a Room it is not wholly inside. An open space **may sit wholly inside a Room** (booths in a
   hall); a point then belongs to the innermost Space. Spaces on different floors (a raised
   terrace) are on different surfaces and do not interact. The World is not partitioned: ground
   outside every Space belongs to none.
5. **Floor and overhead are generated from the outline**, exactly as a Room's are today, so an
   opened Room keeps its floor. Independent floor and overhead **regions** are separate physical
   geometry from the verticality plan.
6. **Overhead intent is the Space's, not a region's.** Each Space states **Closed** or **Open to
   sky**. Closed generates the lid; Open to sky does not. Rooms default to Closed; Spaces made from
   partial Walls or from a floor default to Open to sky; an opened Room keeps what it had. An
   authored canopy above an open-to-sky Space is physical geometry and changes no intent: the
   readout says "Open to sky · under Canopy 1".
7. **Zones are reserved** for broader, overlapping scopes (a wing, a route, a ticketed area).
   Nothing here designs them.

### The interactions

Sketches 7 and 8 draw these step by step.

- **From an opened Room.** No gesture of its own. The Eraser's consequence line reads **Keeps
  Gallery as an open space**. One history entry.
- **From partial Walls.** Arm **Room** on the Build plate (registered today as planned: "Draw a
  named room"). Hovering inside Walls that nearly enclose a place proposes the outline: Wall sides
  in ink, the missing sides as cobalt dashes joining the free ends in order. Click commits and the
  name is ready to type. Where the guess is wrong or there are no free ends to join, the creator
  draws the open side with the same tool: click, click, like a Wall.
- **From a floor.** A floor region drawn with the Terrace tool gets a Space that follows its
  outline. Resizing the floor resizes the Space; they are not edited separately. This arrives with
  floor regions, after the other two.
- **Virtual edges.** Always drawn in Plan as a thin dashed ink line, in 3D only for the selected
  Space, never for a visitor. With the Space selected, each virtual edge has a mid-grip that moves
  it perpendicular to itself and end knobs that slide along the Walls they touch. A virtual edge is
  a handle of its Space, not a subject: it has no Card and cannot be selected alone.
- **Selection.** A click on the floor or the name label selects the Space, as a Room is selected
  today. A click on a Wall selects the Wall. The Card names the kind, the area, the overhead
  setting, and lists Bounds with virtual edges counted ("3 walls · 1 open side").
- **Overlap.** A dragged edge stops at the neighbouring Space and the tag reads **Stops at Booth
  2**. A proposal that would overlap is drawn in red dashes with the reason. Nothing is clamped
  silently on commit.
- **Removing.** An open space's scoped list has **Remove space**, which removes the name and the
  generated surfaces and leaves the Walls. A Room has no such action: it is removed by removing its
  Walls, as today.

### Why this and not the alternatives

| Alternative | Why not |
| --- | --- |
| Room and open Space as two kinds with a conversion | Two ids for one place across an ordinary edit; every reference (finish, Experience target, Index) would need re-pointing |
| Free outlines with no physical anchor | Names with nothing under them; undiscoverable in 3D; no natural end of life |
| Overlap allowed, with priority | Point location becomes a rule to learn; Paint scope and the Index stop being predictable |
| Full partition of the World | Forces a Space onto ground nobody named; contradicts the Layout contract's "not one giant Room" |
| Floor regions first, Space later (revision 2) | Withdrawn. The approved conversion policy needs no region: the outline generates the floor. Waiting for V1 would leave the data-loss case open for no reason |

## Interior Reveal

Two readings, both editor-session state over Layout's representation. Sketch 9.

**Lift** removes overheads from view.

- *Enter:* the reading control's ▾ **Lift**, or the Look icon on a Room, Space or overhead Card.
  With a Space selected or the Camera inside one it lifts that Space; otherwise everything.
- *While active:* a state pill reads **Lift · Gallery ▾ · Put back**; the ▾ switches between this
  Space and everything. Each lifted overhead leaves a thin dashed outline at its true position.
  Clicks pass through to the interior. Clicking the outline, or the Index row, selects the
  overhead, which then draws as a translucent ghost so it can be edited in place.
- *Exit:* **Put back**, Escape at the temporary-reading level, or leaving the project. Lift
  survives a switch to 2D and back. It is not saved, not in history and Undo does not touch it.
- *Never:* moves the Camera, changes lighting, or appears in Preview, a snapshot or a release.

**Near-wall cutaway** is PLATE's automatic behaviour: inside a Space in 3D, Walls between the
Camera and the interior are cut to a low stub and are click-through, sparing the selected
subject's host Wall.

- *Control:* one switch in the reading control's ▾, **Near walls: Cut | Whole**, and holding a key
  shows them whole for as long as it is held. This closes PLATE's listed gap ("no
  hold-to-see-outside").
- *Appearance:* the stub's cap is plain paper with an ink edge. Yellow is the Slice's alone.
- *Selection:* clicking the stub selects the Wall and restores it whole while selected.
- *No pill:* it is viewing state, not a reading the creator entered. PLATE already says so.
- *No pinning to a named Wall.* That was proposed in revision 2 and is withdrawn: a deliberate cut
  is what Slice is for.

Ownership is unchanged from the Unroll precedent. Layout representation draws the lifted or cut
state with source identity on every primitive; the editor session holds which reading is on;
Camera supplies the pose and stores nothing; lighting stays as built; Experience gets nothing.

## Slice

PLATE specifies it and the dock already shows its disabled button. This is its interaction design.
Sketch 10.

**Level cut.** A horizontal plane at the Height Sheet's height.

- *Enter:* arm Slice; the palette offers **Level** and **Drawn**, Level first. The plane appears at
  the Sheet's current height as a translucent yellow sheet across the Layout bounds.
- *Adjust:* drag the Sheet's knob; the plane follows and snaps to the Sheet's ticks (Wall tops,
  found surfaces, pins). The pill reads **Cut at 1.20 m · depth ▾ · Put back**. Depth chooses how
  far below the plane is shown: to the floor by default.
- *Reading:* everything above the plane is not drawn. Cut Walls show a yellow-edged cap. Openings
  the plane passes through are shown cut. Overheads above the plane are gone, so a Level cut below
  the ceilings needs no Lift.
- *Working in it:* the cut is a reading, not a mode. After placing it the creator returns to
  Select and edits normally: places objects, draws Walls, aims lights. Hidden subjects stay
  reachable from the Index; selecting one draws it as a ghost.
- *Exit:* Put back or Escape. One Slice exists at a time; a new one replaces the old.

**Drawn cut.** A vertical plane along a drawn segment.

- *Draw:* like a Wall: start, end, 45° soft snap, live length tag. It cuts only within its length.
- *Reading:* the side toward the Camera at the moment of drawing is hidden. The pill reads
  **depth · Flip · Face · Section · Put back**.
- *Handles:* end points redraw the line, the line moves it, a depth ray sets how far behind the
  plane is shown (the grammar's Slice row).
- *Face* squares the Camera to the cut through the same `face` viewing intent as Face this wall.
  *Section* is the flat measured reading of that cut. Both exist only while a drawn Slice does.

**Priority against the automatic cutaway.**

| | Level cut | Automatic near-wall cutaway |
| --- | --- | --- |
| What the creator must do | One drag of the Sheet | Nothing |
| Predictable | Fully: one plane, one number | No: depends on Camera position and a guess at the working Space |
| Covers | Every Room at once, ceilings included, overview and close work | The one Space the Camera is in; ceilings need Lift |
| Fails how | Too low or too high: visibly, and fixed by the same drag | Flicker while orbiting; cuts a facade the creator wanted to judge |
| Build risk | Clip plane and cap generation, both bounded | Tuning with no clear finish line |
| Existing parts | Height Sheet, its cut-plane cue, PLATE spec | PLATE sentence only |

**Decision: Level cut before the cutaway.** It is the deterministic way to see inside and it makes
the first authored ceilings workable even without Lift. If the truth check finds the cutaway
already built, it gains its switch at once; if not, it is built after the Level cut, sized by what
the Level cut leaves uncovered. The drawn cut follows, and Section last, because Section needs
Layout's typed cut and projected streams, which nothing consumes yet.

Slice is in this batch's planning scope and outside its immediate implementation batch.

## Connected curved architecture

| | A. Seam-only attachment | B. Arc ring | C. Station-hosted Junctions |
| --- | --- | --- | --- |
| Idea | Lift the isolation refusal only at the seam Junction | Attaching to a circle splits it into open arc Walls between rim Junctions | A Junction sits on a Wall at a station without splitting it |
| Rotunda + adjoining Room | No | Yes | Yes |
| Format | None | None for the Walls | Incompatible |
| Cost | Small, little value | One planner family | Every topology consumer |

A does not solve the case. C adds a second way to be connected, which "Junction ID equality is
connectivity" exists to prevent. **B is the direction, with the Room as the identity carrier**
(approved, subject to the spike).

### Whole and components

Sketch 11.

- **The whole is the Room.** Clicking the rotunda's floor or its name selects it. Its Card reads
  **Room · Round** and carries **Radius** and **Diameter**, Area, Overhead, Duplicate, Lift and
  Unroll the room. On the Stage it shows a centre mark and one radius ray with a knob on the rim.
- **Changing the radius** drags that knob or types the value. Every rim Junction moves radially,
  attached Walls stretch, Openings keep their angle. If any neighbour would fail, the whole edit
  refuses and names the Wall. One history entry.
- **A component is a Wall.** Clicking a stretch of wall selects that arc Wall. Its Card has its own
  Height, Thickness, Openings, Unroll and Split. Its Length is shown and marked **set by Radius**.
  The Card's context line offers one step to each Room the Wall bounds.
- **Edits that would break the circle refuse, with one workaround.** Bending a member arc, or
  dragging a rim joint off the circle, refuses: "This wall is part of a round room. Change Radius,
  or release round." **Release round** on the Room's scoped list turns the ring into ordinary
  curved Walls. It is an ordinary undoable edit.
- **Round is stated, not detected.** The Room carries the fact that it is round, with its centre
  and radius. Drawing a circle states it. The radius edit maintains it. Release round, dividing the
  Room with a Wall, or opening it by erasing an arc clears it, and the consequence line says
  **Rotunda stops being round**.
- **An isolated circle is unchanged**: one closed Wall. Radius appears on both the Wall Card, as
  today, and the Room Card.

### The spike (S1)

Bounded, core only, on fixtures. It must show, for model B with the Room as carrier:

1. Arc accuracy after exact subdivision at 1, 2 and 4 attach points.
2. Round, radius, name and id survive: first and second attach, detach back to one closed Wall,
   an Opening placed and moved, a radius edit, Room move, Duplicate, and Undo and Redo of each.
3. Radius is exact from the stated fact, with no fit and no tolerance.
4. The radius edit moves every rim Junction and refuses as a whole when a neighbour fails.
5. The clearing cases behave as written: divide, open, release.
6. One surface reference for "the rotunda's inside" resolves to every arc after each attach.

If 2, 3 and 4 pass, connected curves gets its plan on model B. If 3 fails, the stored fact grows
by whatever makes it exact. If 2 or 4 fails in a way a stored fact cannot fix, the spike reports
what model C would cost and connected curves waits. It does not start C.

## Face and Unroll the room

**Face this wall** is an explicit Look action that squares the Camera to the selected Wall or its
unrolled sheet, through one `face` viewing intent in the Camera authority. Unroll never invokes it:
the #287 ruling that entry preserves the view stands. The same intent serves **Face the cut**.

**Unroll the room** shows a Space's boundary Walls as one developed strip, each Wall's existing
development map concatenated in boundary order with the Room-side face showing. Virtual edges
appear as labelled gaps. Its only blocker was the display-cut rule, now decided: the strip starts
at the selected Wall, or at the first Wall of the boundary when the Room is selected, and reads
clockwise seen from inside. It depends on neither Face nor connected curves.

## Architectural volume and verticality

The P26 contract fixes the vocabulary. The order, each phase shippable alone:

- **V1. Flat horizontal regions.** Layout-owned, independent of any Space: footprint, height,
  thickness. Overhead regions (canopy, dropped ceiling) and floor regions (terrace, platform) are
  one family. Heights are Floor-relative with the world height always shown. Each region publishes
  surface references and support through the existing owner-qualified queries, so it can be
  finished, stood on and hung from. Relations to Walls are read out as meets, gap or intended.
- **V2. Wall top profiles.** Slope and gable tops measured along the Wall, level as the scalar
  case, edited on the Unroll sheet.
- **V3. Shed and gable forms**, Edit shape, and one-shot fit in both directions.

V1 before V2 is a product order: a flat canopy over today's Walls looks finished, while a sloped
Wall top under today's flat lid looks broken. It is not a technical dependency. V2 does not depend
on Face. V1 does not merge before Lift exists, because an authored ceiling the creator cannot see
past is a regression.

Levels, stairs and terrain are outside this batch. A suspended region at height is the probe for
whether mezzanine demand is real.

## T1–T2 contract

#289 asks Layout for a published surface identity, a Space-scope query and a reveal that does not
relight. Agreed. T1's side, as approved:

1. **Surface references** are the authored source plus a role (a Wall and a side; a Space's floor;
   a region's top or underside). Opaque to T2, never minted per compile.
2. **Lineage is a duty of every topology planner.** Each states which references survive and which
   are created from which.

   | Operation | Finish consequence |
   | --- | --- |
   | Split | The new Wall inherits both sides |
   | Join | The survivor's finish wins. The consequence line names what is replaced; Undo restores it |
   | Duplicate | The copy carries the same shared Finish |
   | Attach to a circle | Every arc inherits |
   | Divide a Room | The new Room's floor inherits |
   | Open a Room | Nothing changes: the Space and its floor reference survive |

3. **Space scope** is a Layout query. It answers for Rooms today and for open spaces when they
   land, with no T2 change.
4. **Floor and overhead finishes** key to the Space's generated surfaces or to a region. T2's S5b
   waits for V1's regions; a Room floor can be finished as soon as S5a's plan defines the
   reference.
5. **The joint plan** is the first commit of #289's S5a draft PR, reviewed from both tracks. It
   also settles what an unresolved reference does and how one history entry spans Layout and
   Scene.

No lineage field is added to any planner before that plan asks for it. Lane A's PRs state their
lineage rule in words.

## Execution sequence

One format-changing slice is in flight at a time. Parallel work within a wave touches different
planners.

```text
Wave 0   A0  docs promotion owed by #287

Wave 1   A1 split · A2 join · A3 arc · A4 duplicate (isolated) · A8 repeat      implement, parallel
         X0  what the Stage shows inside a closed Room today                    check
         S1  connected-curve spike · S2  Space conversion spike                 fixtures, parallel
         V-plan (regions, Wall tops, forms)                                     write

Wave 2   A5 duplicate any Room + overlap cue · A6 Face · A7 parity items        implement
         X1  Lift                                                               implement
         SL1 Level cut                                                          plan, implement
         SP-plan (Spaces)                                                       write, on S2

Wave 3   SP1 opened Room stays a Space · SP2 Space from partial Walls           format change
         V1  flat horizontal regions                                            format change, after SP
         J   surface references and lineage, with T2's S5a                      joint plan
         X2  near-wall cutaway switch                                           implement

Wave 4   C   connected curves (plan on S1) · R  Unroll the room
         SL2 Drawn cut · SP3 Space from a floor
         V2  Wall top profiles → V3 shed and gable → SL3 Section

Outside  weld · per-source hide · visitor cutaway · Zones · hosted Junctions ·
         levels · stairs · Room rotation · curve crossing · bendable circles · terrain
```

The completeness lane is bounded by journeys J1–J6, not by a feature list. One depth plan is
written while that lane ships. Every depth phase leads with an everyday increment: Lift before
Slice's Section, an opened Room before a pavilion, a flat canopy before a gable.

## Readiness

| Part | State | What starts next |
| --- | --- | --- |
| A0, A1–A4, A8 | **Ready to implement.** Planners exist; boundaries and acceptance are written | PRs |
| A5, A6, A7 | **Ready**, each with a short plan as its first commit | PRs after wave 1 |
| S1, S2, X0 | **Ready to run.** Exits are stated | Fixtures and a browser check |
| X1 Lift, X2 cutaway switch | **Ready for a short plan**, pending X0 | After X0 |
| SL1 Level cut | **Ready for its plan.** Interaction is settled; cap generation is the implementer's | Plan |
| Spaces | **Ready for its plan once S2 reports.** Concept and rules are settled; the encoding is not, on purpose | SP-plan |
| Verticality | **Ready for its plan.** Order, datum and intent are settled | V-plan |
| Connected curves | **Not ready for a plan.** Waits for S1 | S1 |
| Section (SL3), SP3, V2, V3 | **Sequenced, not planned.** Each follows a slice that will inform it | Later |

Overall: the proposal is ready to drive implementation of the fundamentals and implementation
planning for Spaces, Reveal, Slice and verticality. It is deliberately **not** a technical plan for
any of them: no schema, type name or format number is fixed here.

## Risks accepted

1. **Spaces change what a Room record is.** Virtual edges mean a boundary that is no longer purely
   derived, and reconciliation, the most delicate module in layout-core, must learn it. Accepted
   because the alternative is the data loss creators hit today. S2 exists to find out early whether
   it is tractable; if it is not, SP1 falls back to keeping only the name and id through a re-close.
2. **Containment is allowed in one direction only** (open space inside a Room). A Room inside an
   open space, or nested open spaces, refuse. Some real layouts will hit this. The workaround is to
   make the outer place the Room or leave it unnamed.
3. **A divided or opened rotunda stops being round.** A circular hall with a partition loses
   radius editing. Accepted for a carrier that costs no new entity.
4. **Round arcs refuse direct bending.** One more refusal for creators to meet, in exchange for a
   radius that never silently stops working. Release round is the way out.
5. **The Level cut ships before the automatic cutaway**, so until then creators take one deliberate
   action to see inside, unless X0 finds the cutaway already works.
6. **A docked duplicate leaves doubled Walls**, visibly flagged, with no weld in this batch.
7. **Join can replace a finish.** It is named at the moment and reversible, but it is still a loss
   the creator did not ask for.
8. **Face re-admits a Camera intent that #287 removed.** Approved as an explicit action only.
9. **Three format changes in sequence** (Spaces, V1, V2). Each is a bump with strict refusal of the
   previous version and no migration, per the standing rule. Sequencing them avoids concurrent
   bumps and costs calendar time.
10. **The UX proposals are untested.** They follow PLATE and the grammar closely and reuse existing
    surfaces, but no creator has tried them. Each slice's own browser check is the first test.
11. **Much of "current behaviour" was read, not run.** The checks are listed and cheap, and two of
    them (X0, S2) are scheduled as work.

## Revision history

- **r1.** Fundamentals as a wiring gap; connected-curve models; Face and Unroll the room;
  verticality order.
- **r2.** Rotunda identity requirement; Open Spaces, Interior Reveal and the T1–T2 contract added;
  Opening Repeat found; docked duplicates found to overlap; three false dependencies removed.
- **r3.** Owner decisions approved and folded in. Spaces resolved to one concept with a conversion
  policy, replacing "floor first". Reveal reduced to Lift and a cutaway switch. Slice added and
  ranked ahead of the automatic cutaway. Rotunda whole and component editing designed. Sketches
  rewritten as step-by-step UX proposals. Acceptance criteria added to every slice.
