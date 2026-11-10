# T1 next batch: product and UX proposal

**Status:** planning proposal, 2026-11-10. Authorises no production change. **Base:** `main` at
`97e208d7` (#287 merged). Independent of the T2 Look & Atmosphere proposal (#289).

**Evidence limit:** every statement about current behaviour comes from reading code, tests and
contracts at that commit. Nothing here was exercised in a browser. Items marked *(verify)* need a
five-minute check before an implementer relies on them.

| Read | For |
| --- | --- |
| This file | Verdict, findings, priorities, roadmap, recommendation |
| [Creator journeys](./creator-journeys.md) | Where ordinary work stops today |
| [Interaction sketches](./interaction-sketches.html) | The six consequential design questions |
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

### 3. #287 left documentation debt

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
to Rooms outside the copy are dropped and named in the consequence line. Docking the copy against
existing Walls is ordinary Wall editing afterwards, not part of Duplicate.

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
| Duplicate an isolated Room | 4 | 1 | 1 | – | Small PR |
| Duplicate any Room (copy enclosure) | 4 | 3 | 2 | isolated duplicate | Small plan inside its PR |
| Face this wall | 4 | 2 | 2 | – | Small plan inside its PR |
| Pointed Opening, fixed-end choice on Length | 2 | 1 | 1 | – | Small PRs |
| Unroll the room | 4 | 4 | 3 | Face; connected-curve decision | Dedicated plan |
| Connected curved architecture | 3 | 5 | 5 | decision spike | Research, then dedicated plan |
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
decision**, covering: arc accuracy after exact subdivision, the co-circular recognition tolerance
and whether "Round" is derived or a stored hint, radius-edit behaviour when a neighbour refuses,
rejoin into a closed Wall, and Room identity through attach and detach.

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
multi-Wall loops; corner presentation; shared Walls; what Put back returns to). It must not start
before the connected-curve decision, because under model B the Room strip is the only way to see a
connected rotunda as one sheet. Sketch 5 shows the reading.

Neither is a standalone phase with its own surface. Both live in the existing Card foot, the Stage
state pill and the reading control.

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

The plan for V1–V3 is Tier 2 and can be written **in parallel now**. It touches no file the
fundamentals batch touches.

## Roadmap

```text
Now          A0 docs · A1 split · A2 join · A3 arc · A4 duplicate (isolated)      small PRs, parallel
             S1 connected-curve decision spike                                    research, parallel
             V  verticality technical plan (V1–V3)                                planning, parallel

Next         A5 duplicate any Room · A6 Face this wall · A7 small parity items    small plans in-PR
             V1 flat overhead regions                                             after owner D2, D3

Then         C  connected curves (model from S1) ─┐
             R  Unroll the room ──────────────────┘ R after C's model is chosen
             V2 Wall top profiles → V3 shed and gable

Wait         levels and multi-storey · stairs · Room rotation · curve crossing ·
             bendable circles · hosted Junctions · terrain (T2)
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
duplicate an isolated Room.

**Plan independently, starting now:** the verticality technical plan (V1–V3, Tier 2) and the
connected-curve decision spike (S1).

**Implement next, each with a short in-PR plan:** A5 duplicate any Room, A6 Face this wall.

**Plan after S1 decides:** connected curves, then Unroll the room.

**Do not start:** hosted Junctions, levels, stairs, terrain, Room rotation, general curve noding.
