# T1 next batch: product and UX proposal

**Status:** planning proposal, revision 2, 2026-11-10. Authorises no production change. **Base:**
`main` at `97e208d7` (#287 merged). Coordinated with, and mergeable independently of, the T2 Look &
Atmosphere proposal (#289, revision 2).

**What revision 2 changes** (owner review of revision 1). The plan and its order stand. Added:
an architectural-identity requirement on the connected-curve spike
([§](#architectural-identity-one-rotunda-inspectable-parts)); two future capabilities, each planned
and neither in the immediate batch, [Open Spaces](#open-spaces) and
[Interior Reveal](#interior-reveal); a [T1–T2 contract](#t1t2-contract) with #289. Corrected, from a
recheck of code: Opening Repeat is a built, unwired planner and is the real answer to the window-row
journey; a duplicated Room docked against a Wall **overlaps and joins nothing**; Unroll the room
never depended on Face or on the connected-curve decision. [The last section](#where-i-held-and-where-i-moved)
lists where I moved and where I did not.

**Evidence limit:** every statement about current behaviour comes from reading code, tests and
contracts at that commit. Nothing here was exercised in a browser. Items marked *(verify)* need a
five-minute check before an implementer relies on them.

| Read | For |
| --- | --- |
| This file | Verdict, findings, priorities, roadmap, recommendation |
| [Creator journeys](./creator-journeys.md) | Where ordinary work stops today |
| [Interaction sketches](./interaction-sketches.html) | The nine consequential design questions |
| [Implementation PRs and decisions](./implementation-prs.md) | PR boundaries, tiers, owner decisions |

## Verdict

**T1 does not have an editing-fundamentals design gap. It has a wiring gap.** Most of the operations
asked for under "editing fundamentals" already exist as tested layout-core planners that no editor
intent reaches. That work is cheap, low-risk and should ship first, as five or six small PRs.

The three deeper directions are not equal:

- **Connected curved architecture is a model decision, not a feature.** There is no useful "simple
  connection". It needs a short decision spike before anyone writes a plan.
- **Wall and Room Focus is two things of very different size**, and "Focus" is the wrong word for
  both. The Wall half is small and near-term. The Room half is a planned phase.
- **Verticality is the real next milestone**, but as bundled in the brief it is four milestones. It
  should start as a technical plan now and land in slices, the first of which contains no roof form
  at all.

Revision 2 adds two capabilities the first draft did not name, and both are already promised by the
contracts rather than new ideas:

- **Open Spaces** is in the Layout contract as the destination ("Indoor Rooms are one kind of
  semantic Space") with its schema explicitly unratified. It is a research phase now and a plan
  later. Most of its visible value is a **floor**, which belongs to verticality, not to Space.
- **Interior Reveal** is in PLATE as Lift, Reveal, the near-wall cutaway and X-ray overhead. It is
  an editor-session reading, small in model terms, and it becomes **mandatory the day V1 ships**,
  because authored ceilings and canopies hide the inside.

## What inspection found

### 1. The fundamentals are mostly built and unreachable

| Operation | layout-core | Editor intent |
| --- | --- | --- |
| Split a Wall at a station or point, straight **and curved** (exact cubic subdivision, Openings re-based) | `planWallSplit`, `planWallSplitAtPoint`, `planWallSubdivision` | **None** |
| Dissolve a degree-2 Junction, merging two Walls, keeping Room identity | `planDissolveJunction` | **None** |
| Duplicate an isolated Room with its Walls, Junctions and Openings | `planDuplicateIsolatedRoom` | **None** |
| Rotate a Room group | `planWallFirstRoomRotation` | **None** (move only) |
| Remove a Room | `planRemoveRoom` | **None** (the Eraser refuses a Room floor) |
| Arc Wall | Open `cubic-chain` Walls, bend and knot planners | Walls plate **Arc** is disabled |
| Pointed Opening | `profile: 'pointed'` is in the schema | Ink plate **Pointed** is disabled |
| Repeat an Opening along its Wall (count 1–50, spacing in metres, whole set validated as one batch) | `planRepeatWallOpening` | **None** *(revision 2)* |
| Repeat a Layout object | `planRepeatLayoutObject` | **None** *(revision 2)* |

A grep of `apps/editor/src` for those planner names returns only `planDeleteWall`. The Card's `•••`
menu already lists **Face this wall**, **Unroll the room** and **Section through here** as disabled
`Soon` items, so the shell already promises three of the brief's features by name.

### 2. Known curved-Wall limits that are deliberate

- Crossing noding is straight-only: `planWallCrossing` refuses a curved participant with
  `curved_wall_unsupported`. Attaching a new Wall's **end** to a curved host is handled
  (`layout-wall-chain.ts` projects onto sampled cubic hosts). So a Wall can end on a curve, but
  cannot be drawn through one.
- The [Layout contract](../../../reference/components/layout.md#build--world-architecture) lists
  "arbitrary curve intersection and noding" as **demand/evidence-gated**. This proposal keeps it
  gated.
- Face extraction synthesises no holes (`layout-face-extraction.ts`: "No hole/Room semantics are
  synthesized"). A free-standing rotunda inside a hall therefore does not subtract from the hall's
  Room. *(verify: what the hall's area label and floor show.)*

### 3. Rechecked in revision 2

- **Room duplication and overlap.** The duplicate planner runs the canonical topology gate, whose
  ratified policy (D-1/E, D-9 in `layout-duplicate.ts`) is that overlap between *independent*
  components is **permitted**: a clone placed across its source or any other group commits and
  joins nothing. Room move (`layout-room-move.ts`) is a rigid translation that asserts zero Room
  births, retirements, splits or merges. So nothing in the model turns a docked copy into a shared
  Wall. Revision 1's journey J4 ended with "the ordinary attach rules apply". That was wrong.
- **Opening Repeat.** Built, tested, unreachable. Revision 1 assigned the row-of-windows journey to
  Face. Repeat is the feature that journey needs; Face only makes it more comfortable.
- **Room identity is fragile to opening the enclosure.** A Room is a persistent identity reconciled
  over a *derived face*. Erase one boundary Wall and the face is gone. *(verify: whether the Room
  record, its name and its thicknesses are retired at once.)* This matters to Open Spaces, to T2's
  floor finishes and to every creator who removes a wall to make an open-sided room.
- **A Room record bundles three things**: identity (`id`, `name`), derived topology (`boundary`) and
  physical surface data (`floorThickness`, `ceilingThickness`). Open Spaces and overhead regions
  both pull on that bundle from different sides.
- **How the Stage shows the inside of a closed Room today is not established.** PLATE states that
  the near-wall cutaway and X-ray overhead are viewing state and that the cutaway is automatic. I
  found no implementation under those names. *(verify before planning Reveal.)*

### 4. #287 left documentation debt

The merged plan says "before merge, this plan is deleted" and its rules promoted. Neither happened:
the [plan](../expressive-walls/implementation-plan.md) is still listed as a draft in the
[roadmap index](../../README.md), and the Layout contract still says "Layout format 6" and that
circular Walls are not implemented. Code is at format 7 with all three capabilities landed. An
agent reading the contract today gets the wrong current state. This is the first PR.

## Pushback on the brief

**"Insert, delete and dissolve Junctions" is two operations, not three.** Insert is *split a Wall
here*. Dissolve is *join two Walls*. "Delete a Junction" has no single meaning once three Walls
meet there, and inventing one creates a topology command the creator cannot predict. The proposal
is: split and join exist; erasing a joint means join when exactly two compatible Walls meet, and
refuses in words otherwise.

**Do not make corners joinable.** `planDissolveJunction` refuses a non-collinear straight pair
(`non_collinear_straight_pair`). That is correct: joining an L into one Wall would silently turn a
corner into a curve or a polyline Wall, which the schema does not have. Keep the refusal and give
it good words.

**"Duplicate a Room including shared boundaries" should copy, never share.** The tempting version,
a duplicate that stays attached to the neighbour through the shared Wall, is topology surgery with
ambiguous Room reconciliation. The predictable version is: the copy is a new free island containing
a copy of every boundary Wall (shared ones included), their Openings and Junctions. Door relations
to Rooms outside the copy are dropped and named in the consequence line.

*Revision 2 correction.* Copy-never-share stands, but it does not finish the side-chapel journey.
A copy dragged against the hall leaves two coincident Walls and no shared door, and the model
permits that silently. Two consequences: Duplicate must **place the copy clear of its source** and
the Stage must **say "overlaps, not joined"** when a free island rests on another Wall; and joining
a docked island (a **weld** of coincident Walls) is a separate operation with real reconciliation
questions. It is a small plan, not part of Duplicate, and I would wait for the overlap cue to show
how often creators hit it.

**"A simple connection" to a circle does not exist.** The only topologically simple case is one
extra Wall meeting the circle at its seam Junction. That produces no shared boundary and no new
Room, so it does not deliver the rotunda-plus-room journey. The moment a rectangular Room adjoins a
rotunda, two Junctions sit on the rim, and the one-closed-Wall representation cannot hold them. See
[Connected curves](#connected-curved-architecture).

**"Focus" is taken.** PLATE already uses Focus for the Height Sheet's story focus ("Focus height",
"Under Focus, the Sheet's plane is drawn as an outline"). PLATE also already names the readings
this brief describes: **Face** and **Unroll**. The proposal uses those words: *Face this wall* and
*Unroll the room*. No new reading name, no new surface.

**Wall Focus was already decided against once, in part.** #287 revision 2 removed the `face`
Camera intent from Unroll because the owner wanted entry to preserve the view. That decision
stands. Face must be a separate, explicit Look action that the creator asks for, never something
Unroll does on its own.

**Verticality is bundled too tightly.** Roofs, canopies, ceilings, slabs, three forms, sloped Wall
tops, fitting, gaps, levels, storeys and terrain are at least four milestones with two unresolved
owner decisions (D2 datum, D3 gaps) underneath. Terrain is not T1 at all: the World toolbar files
Ground under T2. Named levels have their own capability (`layout.multi-level`) and should not ride
in on a roof plan.

**"One architectural object" must not depend on a tolerance.** Revision 1 leaned on a *derived*
Round reading for a connected rotunda. The owner's requirement, that the rotunda stays one
creator-facing object with inspectable parts, is right, and a reading that is re-recognised from
geometry on every edit cannot guarantee it: nudge one rim joint and the object would silently
stop existing. Identity needs a carrier. See
[Architectural identity](#architectural-identity-one-rotunda-inspectable-parts).

**An Open Space is mostly a floor.** A pavilion, terrace or booth reads as a place because of what
is under and over it. The semantic Space adds a name, a scope and a grouping. If Space ships first,
creators get a labelled outline of nothing. Physical horizontal regions come first, and they are
already V1's subject.

**Reveal is not hide.** A per-entity visibility switch (an eye in the Index) becomes persistent
layer state within one release, and then someone publishes a World with a wall they forgot to turn
back on. Reveal should be a temporary reading with a pill and Put back, like Unroll, and nothing
else.

**Not every missing operation deserves a slot.** Room rotation, general curve crossing, bending a
circle (D8) and free-form closed Walls all have plausible stories and no journey evidence. They
wait.

## Priorities

Scores are relative, 1 (low) to 5 (high). Value is creator value in ordinary sessions.

| Direction | Value | Ambiguity | Arch. risk | Depends on | Class |
| --- | --- | --- | --- | --- | --- |
| Docs promotion after #287 | 2 | 1 | 1 | – | Small PR |
| Split and join Walls (Junction editing) | 5 | 2 | 1 | – | Small PRs |
| Arc Wall in the Walls plate | 4 | 2 | 1 | – | Small PR |
| Repeat an Opening *(r2)* | 4 | 1 | 1 | – | Small PR |
| Duplicate an isolated Room | 4 | 1 | 1 | – | Small PR |
| Duplicate any Room (copy enclosure) | 3 | 3 | 2 | isolated duplicate; overlap cue | Small plan inside its PR |
| Weld a docked island *(r2)* | 3 | 4 | 3 | overlap cue evidence | Wait for demand, then small plan |
| Face this wall | 3 | 2 | 2 | – | Small plan inside its PR |
| Pointed Opening, fixed-end choice on Length | 2 | 1 | 1 | – | Small PRs |
| Unroll the room | 4 | 4 | 3 | D5 only *(r2)* | Dedicated plan |
| Connected curved architecture | 3 | 5 | 5 | decision spike, incl. identity | Research, then dedicated plan |
| Interior Reveal: Lift and near-wall cutaway *(r2)* | 5 | 3 | 2 | truth check; ships with V1 | Short plan; future capability |
| Open Spaces: semantic Space identity *(r2)* | 3 | 5 | 4 | floor regions; S2 research | Research, then dedicated plan |
| Floor and platform regions *(r2)* | 4 | 4 | 4 | V-plan | Inside the verticality plan |
| Layout surface references for T2 *(r2)* | 4 | 3 | 3 | joint with #289 S5a | Joint plan, first commit of S5a |
| Overhead regions (flat, closure and suspended) | 5 | 4 | 4 | D2, D3 | Dedicated plan, phase V1 |
| Wall top profiles (slope, gable) | 4 | 3 | 4 | format bump; V1 | Dedicated plan, phase V2 |
| Shed and gable overhead forms, Edit shape | 4 | 4 | 3 | V1, V2 | Phase V3 |
| Levels and multi-storey | 3 | 5 | 5 | V1; D2 | Wait for V1 evidence |
| Room rotation, curve crossing, bendable circles | 2 | 3 | 3 | – | Wait for demand |
| Terrain | ? | 5 | 5 | T2 | Not T1 |

## Connected curved architecture

Three candidate models. Sketch 3 draws them side by side.

| | A. Seam-only attachment | B. Arc ring with a derived Round reading | C. Station-hosted Junctions |
| --- | --- | --- | --- |
| Idea | Lift `closed_wall_isolated` only at the seam Junction | Attaching to a circle splits it into ordinary open arc Walls between rim Junctions. Co-circular arcs are recognised and offered radius editing as a group | A Junction may sit **on** a Wall at a station without splitting it; Room boundaries reference Wall sub-ranges |
| Rotunda + adjoining Room | **No** (one rim point only) | **Yes** | **Yes** |
| Topology change | Seam Junction degree > 2 | None: arcs are existing `cubic-chain` Walls | New connectivity primitive beside Junction-ID equality |
| Format | None | **None** | Incompatible: Junction hosting, ranged `OrientedWallRef` |
| Wall identity | One Wall kept | Original id survives on one arc; others are new | One Wall kept |
| Openings | Unchanged | Re-hosted by the existing curved-split planner; an Opening under an attach point refuses (`split_through_opening_interior`); no Opening may span a rim Junction | Unchanged, including across attach points |
| Radius edit | Unchanged | New group planner: scale arcs about the fitted centre, move rim Junctions radially, neighbours follow through the existing whole-network preview and refusal | Unchanged, plus neighbour follow |
| Unroll | Unchanged | One arc at a time; the whole rotunda needs Unroll the room | Unchanged |
| Reverse | – | Removing the last attachment must rejoin arcs into one closed Wall (dissolve refuses self-loops today) | – |
| Cost | Small, little value | Medium: one planner family, no schema | Large: every topology consumer |

**Assessment.** A is a simple connection that does not solve the stated case; reject it. C is the
genuinely new architectural model: it adds a second way to be connected, which is exactly what
"Junction ID equality *is* connectivity" exists to prevent, and it should not be started without
evidence that B fails creators. **B is the recommended direction to prove**, with one honest cost:
it breaks the accepted statement that a circular enclosure is "one continuous canonical Wall" for
the *connected* case. An isolated circle stays one Wall. That contract change is the owner's.

This is not ready for an implementation plan. It is ready for a **bounded spike whose exit is a
decision**, covering: arc accuracy after exact subdivision, radius-edit behaviour when a neighbour
refuses, rejoin into a closed Wall, Room identity through attach and detach, and the identity
requirement below.

### Architectural identity: one rotunda, inspectable parts

**Requirement (owner, revision 2).** A connected rotunda remains **one creator-facing architectural
object**. Its Walls and components stay individually inspectable. Sketch 7.

This changes the comparison. Model C satisfies it natively: one Wall. Model B does not, and
"derived Round" is not enough, because identity that is re-recognised within a tolerance can vanish
on an ordinary edit. Under B the whole needs a **carrier**, and there are three candidates:

| Carrier | What holds the identity | Cost | Fails when |
| --- | --- | --- | --- |
| **The Room** | The rotunda *is* its Room. The Room id already survives attach, split and move through reconciliation. Round, Radius and whole-ring actions are offered on the Room; arcs are its Bounds | None: no format change, no new subject kind | A Wall across the rotunda makes two Rooms; removing an arc leaves no Room at all (an exedra); the outside face belongs to nobody |
| **A stored Layout element** | An authored record naming the member Walls and the form ("round, r = 4 m") | Format bump, a new subject kind, membership upkeep in every topology planner | Membership drifts unless every planner maintains it; a second grouping beside Rooms |
| **Model C** | The single closed Wall | New connectivity primitive | See the table above |

Reading of this, before evidence: **the Room is the right first carrier and probably the lasting
one**, because it is how every other T1 shape already works. A Box whose Wall has been split is
still one Room with five Walls; nobody asks for the Box back as an object. The rotunda differs in
one way only: it has a parameter (radius) that spans its Walls. That is a whole-Room *action*, not
a new entity.

The Room fails in the open-ring case, and that case is exactly an Open Space with a curved screen.
I take that as a reason to keep the stored element out until Open Spaces is decided, not as a
reason to add it now.

**PLATE already has the rule for the parts**: "Expand reveals information, Focus deepens task
context, Select changes canonical identity", and "do not fabricate selectable component identity".
Here the parts are real Walls and the whole is a real Room, so nothing is fabricated in either
direction: a click selects the arc Wall, the Room is one step up through the Card's context line
and the Index, and whole-ring actions live on the Room.

**Added to the spike's exit criteria** (S1):

1. For each carrier, does the rotunda's identity (id, name, radius reading) survive: first attach,
   second attach, detach back to isolated, an Opening placed and moved, a radius edit, Room move,
   Duplicate, Undo and Redo of each?
2. What happens to it when an interior Wall divides the rotunda, and when one arc is erased?
3. Can radius be **stated from the carrier without a tolerance**, or only re-fitted from the arcs?
   If only re-fitted, what is the smallest stored fact that makes it exact?
4. With one arc selected, can the creator reach every other arc, the whole ring and the adjoining
   Room in one step each, using only the existing Card, Index and Look vocabulary?
5. Does a surface finish (T2) applied to "the rotunda's inside" survive each attach, as one finish?
   See the [T1–T2 contract](#t1t2-contract).

If the Room carrier passes 1, 3 and 4 and fails only the cases in 2, I recommend model B with the
Room as carrier and the cases in 2 deferred to Open Spaces. If it fails 3, the choice is between a
stored radius fact and model C, and that is the owner's call with the spike's numbers in hand.

## Face and Unroll the room

**Face this wall** is a Look action on the Wall Card (already listed, disabled). It asks the Camera
authority for a face-on framing of the selected Wall, or of its sheet when unrolled. It composes
with Unroll and never fires from it. The camera-core design already exists in #287's revision 1
(`face` viewing intent, generalised 3D-to-3D transition) and was removed for scope and for the
entry-preservation ruling, not because it was wrong. This is a near-term usability feature: Unroll
at Flat plus Face is the "explicit elevation editing" the brief asks for, with the canonical
Opening kit that already works on the sheet.

**Unroll the room** is a later planned phase. It is a multi-Wall development: each boundary Wall's
existing development map, concatenated in the Room's boundary order, always showing the Room-side
face. It needs answers that the Layout contract still lists as open (D5: display cut for
multi-Wall loops; corner presentation; shared Walls; what Put back returns to). Sketch 5 shows the reading.

*Revision 2 correction.* Revision 1 made Unroll the room wait for Face and for the connected-curve
decision. Neither is a dependency. The strip is a concatenation of per-Wall development maps that
#287 already ships, it works on a plain rectangular Room, and it works the same whether a rotunda
is one Wall or four arcs. Model B only raises its *priority*, because the strip is then the way to
see a connected rotunda's inside as one sheet. Its one real blocker is the owner decision on D5.
Face does not block it either: Unroll preserves the view by ruling.

Neither is a standalone phase with its own surface. Both live in the existing Card foot, the Stage
state pill and the reading control.

## Open Spaces

**What exists.** The Layout contract already names the destination: physical architecture, derived
spatial topology and a semantic spatial model (Space, Site, Building, Level, Zone) are three
things; "Indoor Rooms are one kind of semantic Space; future outdoor/open regions must not require
pretending the world is one giant Room"; "the exact future schema is not ratified yet; do not
invent implementation types ahead of planning." PLATE's Index already speaks of Spaces and Zones.
Code has only `LayoutWallFirstRoom`.

**Three things to keep apart.** Sketch 8.

| | Is | Owner today | Example |
| --- | --- | --- | --- |
| **Space identity** | A named place a creator and a visitor can refer to: name, scope for Paint and the Index, a target for Experience | Bundled into the Room record | "Terrace", "Booth 3" |
| **Extent** | Where the place is. *Derived* from enclosing Walls, or *stated* by the creator where no Walls enclose it | Derived only (`boundary`) | A face of the Wall graph; a drawn outline |
| **Physical floor or slab** | Geometry that can be stood on, finished, seen and supported from | Generated per Room from `floorThickness`; one Floor datum for the document | A deck, a plinth floor, a stage |

A pavilion is a slab, a canopy, some posts and a name. A terrace is a slab and a name. A booth is
three Walls that do not close, a slab or none, and a name. In none of them does the name carry the
geometry.

**Position.**

1. **The floor comes first and belongs to verticality.** A floor or platform region is the mirror
   of V1's overhead region: Layout-owned, independent of any Room, with a footprint, a height and a
   thickness. The V-plan should treat **horizontal regions as one family** (overhead, floor,
   platform) and decide whether it is one kind with a role or two kinds. This alone delivers a
   visible terrace and gives T2 a floor to finish.
2. **Space identity comes second and is research now.** The open questions are product questions
   that an encoding would answer by accident:
   - Is a Room a Space whose extent happens to be derived, so one identity survives closing and
     opening its Walls? Or are Room and open Space separate kinds with a conversion?
   - Do open Spaces **partition** the World like Rooms, or may they **overlap**? If they overlap,
     how is an open Space different from PLATE's Zone?
   - What does the creator do to make one: draw an outline, promote a floor region, or name a
     place where a Room used to be?
   - What is the extent of a booth: the hull of its Walls, a drawn outline, or its slab?
3. **No schema here.** I am deliberately not proposing a `Space` record, a kind enum or an owner
   for the outline. The contract forbids it ahead of planning and the evidence is not in.

**Pushback.** I would not let Open Spaces into the immediate batch, and I would not start its plan
until V1's region encoding exists, because Space extent will want to reference it. The single
piece worth pulling forward is the fragility noted above: if erasing one Wall of a named Room
destroys the Room, its name and (later) its floor finish, creators meet the Open Space problem as
*data loss* long before they ask for a pavilion. S2 should establish that behaviour first.

**Classification.** Future capability (`layout.space`, *new*). Research phase **S2** now, on paper
and fixtures. Floor and platform regions inside the verticality plan. Dedicated Space plan after V1.

## Interior Reveal

**What exists.** PLATE lists Lift and Reveal among temporary readings, says "a Ceiling [may offer]
Lift or Look up", places Lift behind the reading control, and states that "the near-wall cutaway,
X-ray overhead and Focus height are viewing state". Its open-issues list says the cutaway is
automatic with no hold-to-see-outside. The Layout contract defines typed **cut / projected /
hidden** representation streams with source identity, and a Reveal affordance that "changes
presentation and interaction eligibility for one source without touching depth or document
history". What is built is not established *(verify)*.

**Who owns what.** Sketch 9. Nothing here is new authority; the point is to stop it leaking.

| Authority | Owns in Reveal | Never |
| --- | --- | --- |
| **Layout representation** (runtime-safe, consumes the one compiler) | *How* a Wall or overhead is drawn when cut, lifted or hidden: the typed streams, the cut cap, the ghost outline, source identity on every primitive | Which sources are revealed. A second geometry |
| **Editor session** | *Which* sources are revealed and by which reading (Lift, Reveal, cutaway on or off), exactly like the Unroll session: not serialized, not in history, untouched by Undo | Authored truth. Anything a visitor loads |
| **Camera** | The pose. An automatic cutaway is a pure function of the pose and the compiled geometry, evaluated by the representation | Storing reveal state. Changing pose because something was revealed (the #287 entry ruling, again) |
| **Scene / T2** | Lighting stays as built: a revealed surface still casts and blocks light (#289's requirement, accepted) | Relighting because a ceiling is lifted |
| **Experience** | Nothing in this capability | Inheriting the creator's reveal state. A visit, snapshot, thumbnail or published release always shows as-built |

**Identity.** A revealed Wall is the same Wall: same id, same Card, same Index row, same Openings,
still selectable through its ghost and through the Index. It must not look deleted, damaged or
displaced (PLATE's rule for every temporary reading).

**Shape, smallest first.**

- **X0. Truth.** Establish what the Stage does today for a closed Room seen from outside and from
  above, and make PLATE's sentence true or correct it.
- **X1. Lift.** One reading that takes overheads off the selection's Space, with a pill and Put
  back. This is what V1 needs on the day it ships, so it lands **with V1 or just before it**.
- **X2. Near-wall cutaway, made controllable.** Automatic by default; one control to hold it off
  ("see outside") and one to pin it on a named Wall.
- **X3. Reveal one source.** The per-source hide the Layout contract describes, as a reading with
  a pill, entered from the selection. Only if X1 and X2 leave real cases uncovered.

**Pushback.** Hide, lift and cutaway were asked for as three features. I would build two readings
(Lift, cutaway) and treat per-source hide as evidence-gated, because it is the one that tends to
become persistent visibility state. And a **visitor-facing cutaway** (a dollhouse view in a
published World) is a different capability: an authored presentation that Experience would invoke
through the same Layout representation. It waits for demand and must not be reached by letting
session state through.

**Classification.** Future capability (`layout.interior-reveal`, *new*; the ledger owner is a
question, Q15). X0 now. X1 tied to V1. Not in the fundamentals batch.

## T1–T2 contract

#289 revision 2 asks Layout for three things: an opaque **surface identity** it publishes, a
**Space-scope query** ("which surfaces belong with this one"), and a cutaway that does not relight.
It keeps wall-face finishes (S5a) on its path and parks floors and overheads (S5b) until T1
decides. I agree with all of that. This section states what T1 owes and where I would amend #289.

**1. Surface references are typed and built from authored ids.** "Opaque to T2" is right. Opaque
must not mean minted per compile. A reference is the authored source plus a role: a Wall and a
side; a floor surface and its owner; an overhead and top or underside. The Layout contract's
derivation identity `{sourceId, stream, subRef?}` is the precedent. Wall-first gives one useful
property for free: Walls end at Junctions, so one side of one Wall faces at most one Room, and
"this Wall's side" is already as fine as "this Room's wall".

**2. Identity continuity is a planner obligation, and it starts with Lane A.** Split, join,
duplicate, attach-to-circle and weld all change which Wall ids exist. A finish keyed by Wall id
must follow:

| Operation | Lineage | Finish consequence |
| --- | --- | --- |
| Split (A1) | one Wall → the kept id and one new id | The new Wall inherits both sides |
| Join (A2) | two Walls → one surviving id | Same finish: nothing to say. Different: the survivor's wins and the consequence line says so, or the join refuses. Owner choice (Q17) |
| Duplicate (A4, A5) | source → copy | The copy carries the same shared Finish |
| Attach to a circle (model B) | one closed Wall → N arcs | Every arc inherits. One more cost of B that C does not pay |
| Divide a Room | one Room → the kept id and one new | The new Room's floor inherits |
| Open an enclosure | Room → none, today | **Unresolved.** The floor finish has nothing to hang on. This is the Open Space question again |

Layout stays appearance-free (#289 D1, agreed), so Layout cannot apply these itself. The contract
is that every topology plan can **state its lineage** (old reference → new references), and that
the finish follow-up commits in the same history entry. Whether that is a field on the plan result
or derived from the before and after documents is for the joint plan. I would **not** add lineage
output to A1 and A2 speculatively; I would require each of those PRs to state its lineage rule in
words, so S5a's plan can rely on it.

**3. Floor support has two meanings and both need the same answer.** A floor is a surface to
*finish* (T2) and a surface to *stand things on* (Scene's qualified support, *Light it*'s upward
cast, the visitor). Today both resolve through the Room's generated floor. Once horizontal regions
exist, a slab or a canopy must be published through the **same** owner-qualified surface and
support queries, or a terrace can be painted but not furnished. That goes into the V-plan's scope.

**4. Sequencing.** S5a (wall faces) can proceed against landed Wall identity, with the lineage rule
above. S5b should wait for the V-plan's horizontal-region decision, not only for "T1's identity":
keying floor finishes to Room ids now would have to be re-keyed when floors become regions.

**5. Amendments I would ask of #289.**
- Add lineage to S5a's plan as a named requirement on T1 planners, with the table above.
- Say what an **unresolved** surface reference does (kept and shown as detached, or dropped with a
  consequence). It will happen: Undo across documents, an opened enclosure, a welded Wall.
- Paint's widest scope is called **Space** while Space does not exist. Until it does, the query
  answers with the Room. The label is fine; the plan should say the query, not the word, is the
  contract.
- The shared plan lives in **one** place. I propose it is the first commit of S5a's draft PR,
  reviewed from both tracks, rather than a third document.

## Architectural volume and verticality

The P26 contract already fixes the vocabulary: level, slope and gable Wall tops measured along the
Wall; independent Layout-owned overhead regions with **closure** versus **suspended** intent;
simple flat, shed and gable forms; truthful meets/gap relations with explicit one-shot fixes and no
automatic following. The grammar already has a Roof row and PLATE already specifies Edit shape.
What is missing is encoding, two owner decisions and an order.

Recommended order, each phase shippable on its own:

- **V1. Flat overhead regions.** One Layout-owned region kind with footprint, height, thickness and
  closure or suspended intent. Generated Room closure stays the fallback wherever no authored
  closure covers. Delivers canopies, dropped ceilings, a lid lower than the Walls, and the first
  truthful gap readout. No Wall change. Needs D2 and D3.
- **V2. Wall top profiles.** One authoritative Wall top definition with level as today's scalar
  case; slope and gable measured along the Wall. Format bump. Edited on the Unroll sheet, which is
  why Face lands first. Opening fit, mesh, the development map and head-fixed arch rise all consume
  it.
- **V3. Shed and gable overhead forms** with Edit shape, and the one-shot "fit Walls to this roof"
  and "fit roof to these Walls" fixes.
- **Later, evidence-gated.** Named levels and multi-storey (`layout.multi-level`), then stairs.
  Terrain belongs to T2.

V1 before V2 is deliberate. A sloped Wall top under today's derived flat lid looks broken; a flat
canopy over today's Walls looks finished. V1 also forces the ownership questions (D2, D3) that
every later phase inherits, while the geometry is still trivial.

*Revision 2.* Three changes to this plan's scope, none to its order:

- **Horizontal regions are one family.** Floor and platform regions join overhead regions in the
  V-plan ([Open Spaces](#open-spaces)). Whether V1 ships both or overhead first is the plan's call.
- **Regions publish surface and support queries** ([T1–T2 contract](#t1t2-contract)).
- **V1 ships with Lift** ([Interior Reveal](#interior-reveal)). An authored ceiling the creator
  cannot see past is a regression.

And two dependencies removed: V2 does not need Face (the Unroll sheet already exists), and V1 before
V2 is a product order, not a technical dependency. If the owner wants gabled end Walls first, V2
can lead; I still recommend V1.

The plan for V1–V3 is Tier 2 and can be written **in parallel now**. It touches no file the
fundamentals batch touches.

## Roadmap

```text
Now          A0 docs · A1 split · A2 join · A3 arc · A4 duplicate (isolated)      small PRs, parallel
             A8 repeat an Opening                                                 small PR
             S1 connected-curve spike, incl. identity carrier                     research, parallel
             S2 Open Space and Room-identity research · X0 reveal truth check     research, parallel
             V  verticality plan (V1–V3, horizontal regions, support queries)     planning, parallel

Next         A5 duplicate any Room + overlap cue · A6 Face · A7 parity items      small plans in-PR
             V1 flat regions  +  X1 Lift                                          land together
             J  surface references and lineage (first commit of T2's S5a)         joint with #289

Then         C  connected curves (model and carrier from S1)
             R  Unroll the room                                                   needs D5 only
             X2 controllable cutaway
             V2 Wall top profiles → V3 shed and gable
             Space plan (after V1's regions exist)

Wait         weld a docked island · X3 per-source reveal · visitor cutaway ·
             levels and multi-storey · stairs · Room rotation · curve crossing ·
             bendable circles · hosted Junctions · stored architectural elements · terrain (T2)
```

## Answer to the main question

*How does T1 feel increasingly complete through ordinary workflows without delaying depth
indefinitely?*

Run two lanes with three rules.

1. **The completeness lane is bounded by journeys, not by a feature list.** The six journeys in
   [creator-journeys.md](./creator-journeys.md) define it. When they pass, the lane is empty until
   real usage adds a journey. That is what stops fundamentals from expanding forever.
2. **Exactly one depth plan is in flight at a time, and it is always being planned while the
   completeness lane ships.** Depth is not delayed by fundamentals because they do not share
   people-hours of the same kind: one is wiring and review, the other is decisions.
3. **Every depth phase must lead with an everyday increment.** Face before Unroll the room. A flat
   canopy before a gable. The arc ring before any new topology primitive. If a phase cannot name
   its ordinary first slice, it is not ready.

## Recommendation

**Implement immediately** (no further design needed beyond the decisions marked in
[implementation-prs.md](./implementation-prs.md)): A0 docs promotion, A1 split, A2 join, A3 Arc, A4
duplicate an isolated Room, A8 repeat an Opening.

**Plan and research independently, starting now:** the verticality technical plan (V1–V3, Tier 2,
now including floor regions, support queries and Lift); the connected-curve spike with its identity
criteria (S1); the Open Space and Room-identity research (S2); the reveal truth check (X0).

**Implement next, each with a short in-PR plan:** A5 duplicate any Room with the overlap cue, A6
Face this wall.

**Plan jointly with T2:** surface references and lineage, as the first commit of #289's S5a.

**Plan after its decision:** connected curves (S1), Unroll the room (D5), Space (V1's regions).

**Do not start:** hosted Junctions, stored architectural elements, weld, per-source hide, visitor
cutaway, levels, stairs, terrain, Room rotation, general curve noding.

## Key tradeoffs

| Tradeoff | If we go one way | If we go the other | Recommendation |
| --- | --- | --- | --- |
| Rotunda identity: Room as carrier vs stored element vs one Wall (C) | Room: free, consistent with every other shape, fails for divided and open rings | Stored element or C: exact and robust, at the cost of a format bump or a new connectivity primitive | Prove the Room carrier in S1; decide on its numbers |
| Open Spaces: floor first vs Space first | Floor first: visible value, T2 gets a surface, Space waits | Space first: the semantic model is settled early, on thin evidence, with nothing to show | Floor first |
| Reveal: readings vs visibility switches | Readings: cannot be forgotten or published, fewer controls | Switches: more flexible, become persistent state | Readings |
| Finish continuity: lineage stated by planners vs re-matched by geometry | Lineage: exact, a small duty on every topology PR | Geometry matching: no planner duty, wrong at exactly the edits creators make most | Lineage |
| Join with different finishes: survivor wins vs refuse | Wins: join always works, one finish silently lost unless named | Refuse: nothing lost, join becomes two steps | Survivor wins with a named consequence (Q17) |
| Duplicate: copy-never-share vs duplicate-and-attach | Copy: predictable, leaves doubled Walls when docked | Attach: finishes the chapel journey, needs weld and reconciliation rules | Copy now, with an overlap cue; weld on evidence |
| V1 before V2 | Canopies and ceilings first, Lift required at once | Gabled halls first, under a flat lid | V1 first |

## Where I held and where I moved

| Review point | Outcome |
| --- | --- |
| A connected rotunda is one architectural object | **Moved.** "Derived Round" was too weak. Identity needs a carrier; the spike now tests three |
| …so it should be one stored object | **Held, pending evidence.** The Room may already be that object. A stored element is not ruled out |
| Open Spaces | **Moved in scope, held in order.** Planned as a capability; floor regions before Space; no schema |
| Interior Reveal | **Moved.** Planned, and tied to V1. **Held:** two readings, not three features; no visibility switches; never visitor-facing by leakage |
| T1–T2 contract | **Moved.** Lineage is now a stated duty of Lane A's planners. **Held:** nothing is added to A1 and A2 speculatively |
| Room duplication overlap | **Corrected.** J4 was wrong; overlap cue added; weld named and deferred |
| Opening Repeat | **Corrected.** Added as A8, ahead of Face |
| Room Unroll, connected curves and verticality dependencies | **Corrected.** Three false dependencies removed; one real one added (V1 needs Lift) |
