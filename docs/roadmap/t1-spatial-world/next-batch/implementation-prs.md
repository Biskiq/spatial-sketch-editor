# Implementation slices

Part of the [T1 next-batch proposal](./README.md), revision 3. Tiers follow
[`docs/workflow.md`](../../../workflow.md#risk-tiers-the-highest-applicable-tier-wins). Capability
ids marked *new* are proposed names; each implementing PR adds its own ledger row and claims it in
its title. This document claims nothing and fixes no schema, type name or format number.

Every slice inherits these acceptance rules and does not repeat them: one gesture is one history
entry; Undo and Redo replay captured ids; a refusal has words and writes nothing; session readings
are never serialized, never enter history and never reach Preview, a snapshot or a release; a
format change is a bump with strict refusal of the previous version, regenerated fixtures and no
migration.

## Lane A: completeness

Small, independently mergeable. Done when journeys J1–J5 pass.

| Slice | Capability | Delivers | Boundary | Needs | Tier |
| --- | --- | --- | --- | --- | --- |
| **A0** | – | Promote #287's enduring rules into the Layout contract; delete the completed expressive-walls plan and its roadmap row | Docs only | – | 1 |
| **A1** | `layout.wall-split` *new* | **Split wall here** in the scoped list (Card `•••`, context menu, Find) | One intent over `planWallSplitAtPoint`. No new mark, no armed mode | – | 0 |
| **A2** | `layout.wall-join` *new* | Join at a two-Wall joint: drag the joint onto the line between its neighbours (**Remove joint**), or Eraser on the joint | One intent over `planDissolveJunction`. One sentence added to the grammar's Wall row | – | 1 |
| **A3** | `layout.wall-arc` *new* | Walls plate **Arc**: start, end, bulge | `InkWallMode` gains `'arc'`. No new centerline kind | – | 0 |
| **A4** | `layout.room-duplicate` *new* | **Duplicate** for an isolated Room; the copy follows the pointer as one proposal | One intent over `planDuplicateIsolatedRoom` | – | 0 |
| **A8** | `layout.opening-repeat` *new* | **Repeat** on an Opening: count and spacing | One intent over `planRepeatWallOpening`. Spacing only | – | 0 |
| **A5** | `layout.room-duplicate` | Duplicate any Room as a free island; the **overlaps, not joined** cue | New copy-enclosure planner beside the isolated one. The cue is derived editor state. No weld. Short plan first | A4 | 1 |
| **A6** | `layout.wall-face` *new* | **Face this wall**; Put back returns to the entry pose | One `face` viewing intent in camera-core. Layout supplies bounds and a direction, never a pose. Short plan first | – | 1 |
| **A7** | existing ids | Pointed Opening profile; fixed-end choice on Card Length; length mark on curved Walls. One PR each | Each is one control over one planner; drop any that needs a design | – | 0 |

**Acceptance.**

- **A1.** Splits a straight and a curved open Wall at the pointer's station from the context menu
  and at the midpoint from the Card. The start-side Wall keeps its id; Openings on both sides keep
  their ids and world positions; the Room keeps its id. A split under an Opening and a split of a
  closed Wall refuse.
- **A2.** A collinear straight pair and a tangent curved pair join into one Wall with Openings
  re-based and the Room unchanged. A corner, a three-Wall joint and Walls of different height or
  thickness refuse, each with its own words. The curved case ships only with the id capture
  threaded through the dissolve planner; otherwise the PR is scoped to straight pairs and says so.
  The PR states which Wall survives.
- **A3.** One stroke writes one open `cubic-chain` Wall; the tag reads rise and radius; a ring
  closed with an arc makes a Room exactly as a Line does; a rise below the minimum commits a Line.
- **A4.** The copy has new ids for every Wall, Junction, Opening and the Room; its proposal starts
  clear of the source and can never be committed coincident with it; a non-isolated Room refuses
  with words that name the shared Wall.
- **A8.** N copies appear as proposals along the host; a set that leaves the Wall or collides with
  another Opening refuses whole; kind, size, sill and profile are preserved.
- **A5.** A Room with a shared Wall duplicates into a free island containing a copy of that Wall
  and its Openings; the consequence line names each dropped door relation. Any free island resting
  on another group's Wall, copied or moved there, shows **overlaps, not joined** on the coincident
  stretch, and the cue clears when the overlap ends.
- **A6.** Face squares the Camera to a straight Wall, a curved Wall and an unrolled sheet; entering
  Unroll never moves the Camera; Put back restores the entry pose; reduced motion is honoured.

**Lineage duty.** A1, A2, A4 and A5 each state in the PR description which ids survive and which
are created from which source.

## Lane S: spikes with a decision as their exit

Core only, on fixtures, no editor change. Tier 0.

| Slice | Question | Exit |
| --- | --- | --- |
| **S1** | Does the arc-ring model with the Room as identity carrier hold? | The six results in the [proposal](./README.md#the-spike-s1): accuracy; identity survival through attach, detach, Opening edits, radius edit, move, Duplicate, Undo and Redo; exact radius from a stated fact; whole-ring radius edit with whole-edit refusal; the clearing cases; one surface reference resolving to every arc. A pass on 2, 3 and 4 releases the connected-curve plan |
| **S2** | Can a Space keep its identity through opening and closing? | On fixtures: a Room whose outside Wall is erased keeps id, name, thicknesses and associated objects with one virtual edge; redrawing the Wall returns an all-Wall boundary with the same id; erasing a Wall between two Rooms still merges; erasing the last Wall retires the Space. A written account of what reconciliation had to change, and whether the fallback (identity kept only through a re-close) is needed. Releases the Space plan |

## Lane X: Interior Reveal

`layout.interior-reveal` *new*. Layout owns the representation; the shell owns the reading.

| Slice | Delivers | Boundary | Needs | Tier |
| --- | --- | --- | --- | --- |
| **X0** | A written account, with screenshots, of what the Stage shows for a closed Room from outside and from above, and whether any near-wall cutaway exists. PLATE's sentence made true or corrected | Inspection and a focused browser check; a docs fix at most | – | 0 |
| **X1** | **Lift**, with its pill and Put back | Session state beside the Unroll session. Short plan first | X0 | 1 |
| **X2** | **Near walls: Cut \| Whole**, and hold-to-see-whole. Builds the automatic cutaway if X0 found none | A pure function of Camera pose and compiled geometry. No pill, no pinning | X1, SL1 | 1 |

**Acceptance.**

- **X1.** Entered from the reading control and from a Room, Space or overhead Card. Lifts the
  selected or occupied Space, or everything. Each lifted overhead leaves a dashed outline that
  selects it; a selected lifted overhead draws as a ghost and stays editable. Put back and Escape
  exit. Camera pose and every light and shadow are identical before, during and after. Survives a
  2D/3D switch; does not survive reload.
- **X2.** With the switch on Cut, Walls between the Camera and the occupied Space's interior show
  as stubs with a plain cap and are click-through; the selected subject's host Wall is spared;
  clicking a stub selects that Wall and shows it whole. With the switch on Whole, or the key held,
  nothing is cut. No Wall changes state while the Camera is still.

## Lane SL: Slice

`layout.slice` *new*. In this batch's planning scope; outside its immediate implementation batch.

| Slice | Delivers | Boundary | Needs | Tier |
| --- | --- | --- | --- | --- |
| **SL1** | **Level cut** at the Height Sheet's height, with its pill, depth and Put back. Aligns the toolbar stub with PLATE | Session state. Cap generation is the implementer's choice. Plan first | – | 1 |
| **SL2** | **Drawn cut**: segment, depth ray, Flip, Put back | Same session; one Slice at a time | SL1 | 1 |
| **SL3** | **Face the cut** and **Section** | Face reuses A6's intent. Section consumes Layout's typed cut and projected streams. Own plan | SL2, A6 | 2 |

**Acceptance.**

- **SL1.** Arming Slice › Level shows the plane at the Sheet's height; dragging the Sheet moves it
  and snaps to its ticks; nothing above the plane is drawn; cut Walls and Openings show a cap;
  everything below stays selectable and editable with Select; a hidden subject chosen from the
  Index draws as a ghost; Put back and Escape remove the cut; lighting is unchanged.
- **SL2.** A segment drawn in Plan or on the 3D ground cuts only within its length; the near side
  is hidden; Flip swaps sides; end points, line and depth ray behave as the grammar's Slice row
  says; a second Slice replaces the first.
- **SL3.** Face and Section appear only while a drawn Slice exists; every primitive in Section
  selects its canonical source; Put back returns to the entry pose.

## Lane SP: Spaces

`layout.space` *new*. One plan (Tier 2) written on S2's report, then phased.

| Slice | Delivers | Needs | Tier |
| --- | --- | --- | --- |
| **SP-plan** | Encoding of a boundary with Wall-side and virtual edges; the stated overhead intent; reconciliation changes; the non-overlap gate; Index, Card and Paint-scope consequences; visitor parity | S2 | 2 |
| **SP1** | An opened Room stays the same Space. Virtual edges drawn, moved and replaced by Walls. **Overhead: Closed \| Open to sky**. **Remove space** | SP-plan | 2 |
| **SP2** | **Room** tool: make a Space from partial Walls, with a proposed closure and a drawn open side | SP1 | 1 |
| **SP3** | A Space that follows a floor region (Terrace tool) | SP1, V1 | 1 |

**Acceptance.**

- **SP1.** Erasing an outside Wall of a Room leaves the same id, name, floor, overhead setting and
  contents, with a virtual edge where the Wall was and the consequence line **Keeps *name* as an
  open space**. Drawing a Wall along a virtual edge replaces it; with none left the Card reads
  Room. Erasing the last Wall of a Space with no floor region removes it and says so. A virtual
  edge's mid-grip and end knobs move it; it stops at a neighbouring Space with **Stops at *name***.
  Two open spaces cannot be made to overlap; an open space wholly inside a Room is accepted and
  owns the points inside it. Open to sky removes the generated lid and nothing else. Virtual edges
  never appear to a visitor.
- **SP2.** Hovering inside partial Walls proposes one outline; click commits and the name is
  editable; an ambiguous or impossible closure offers no proposal and the open side can be drawn.
- **SP3.** Drawing a floor region creates a Space on its outline; resizing the floor resizes the
  Space; removing the floor removes the Space unless a Wall still bounds it.

## Lane D: depth

| Slice | Capability | Delivers | Needs | Tier |
| --- | --- | --- | --- | --- |
| **V-plan** | `layout.horizontal-region`, `layout.wall-top-profile` *new* | One plan for V1–V3: region encoding (one kind with a role, or two); Floor-relative heights; relation derivation; surface references and support queries; Wall top definition; compiler, mesh and visitor consumption; what becomes of the Space's thickness fields | – | 2 |
| **V1** | `layout.horizontal-region` | Flat overhead and floor regions; meets / gap / intended readout; one-shot fit | V-plan, X1, after SP1 | 2 |
| **V2** | `layout.wall-top-profile` | Slope and gable Wall tops, edited on the Unroll sheet | V-plan; after V1 by order | 2 |
| **V3** | `layout.horizontal-region` | Shed and gable forms; Edit shape; fit both ways | V1, V2 | 2 |
| **C** | `layout.connected-curve` *new* | Connected circles on the arc-ring model with the Room as carrier. Own plan | S1 | 2 |
| **R** | `layout.room-unroll` *new* | **Unroll the room** as one strip, starting at the selected Wall, clockwise from inside. Own plan | – | 1–2 |
| **J** | – | Surface references and lineage, as the first commit of #289's S5a draft PR | A1, A2 lineage rules | 2 |

**Acceptance.**

- **V1.** A canopy, a dropped ceiling and a raised floor can each be drawn, moved, resized and
  set in height. A region over an open-to-sky Space reads "Open to sky · under *name*" and changes
  no intent. An object rests on a floor region and a light mounts under an overhead region through
  the existing support queries. Each relation to a Wall reads meets, gap with its measure, or
  intended; nothing follows automatically after a fit.
- **V2.** A Wall top can be level, sloped or gabled; Openings, mesh and the Unroll sheet agree with
  it; the level case is byte-identical to today's geometry.
- **V3.** Shed and gable forms are edited with Edit shape; fit Walls to roof and fit roof to Walls
  are each one explicit, undoable action.
- **C.** Journey J6 passes end to end; the six S1 results hold in the editor.
- **R.** A rectangular Room, an L-shaped Room, a Room with a curved Wall and an open space each
  unroll to one strip; virtual edges are labelled gaps; a shared Wall shows its Room-side face;
  Openings on the strip are the as-built Openings.
- **J.** The plan names the reference shape, the lineage per operation in the proposal's table, the
  fate of an unresolved reference and how one history entry spans Layout and Scene.

## Outside this batch

Weld of coincident Walls; per-source hide; a visitor-facing cutaway; Zones; station-hosted
Junctions; a stored architectural-element record; named levels and multi-storey; stairs; terrain;
Room rotation; general curve crossing and noding; bending a closed Wall; persistent fit
constraints; a Junction tool; a "Focus" mode; any appearance data in Layout.

## Decision record

Approved by the owner in review of revisions 1 and 2, or resolved in revision 3 under the owner's
delegation ("simple, predictable concepts; sensible defaults; explicit workarounds"). Nothing here
is awaiting approval.

| # | Decision | Rationale |
| --- | --- | --- |
| Q1 | Lane A is the next batch; depth is planned in parallel, not implemented in parallel | Wiring is cheap and unblocks ordinary sessions |
| Q2 | Join by the drag gesture and by the Eraser | The drag is discoverable and matches the bend-point removal gesture; the Eraser covers already-collinear joints |
| Q3 | Duplicate copies shared Walls into a free island and drops outside door relations; **Drops** is an accepted consequence word | One meaning for Duplicate regardless of neighbours |
| Q4 | A `face` viewing intent is admitted to the Camera authority as an explicit action that Unroll never invokes | Explicit elevation work needs it; the entry-preservation ruling is untouched |
| Q5 | The names are **Face** and **Unroll the room** | Focus is the Height Sheet's word |
| Q6 | A connected circular enclosure is a ring of arc Walls; the contract's "one continuous canonical Wall" applies to the isolated case | No new connectivity primitive |
| Q7 | Region heights are Floor-relative, with the world height always shown | Cheap with one Floor, expensive to change after levels |
| Q8 | Open-to-sky is an **intent stated on the Space**; overhead regions are physical geometry and carry no intent. An intended gap is a flag on a region's relation to a Wall | Revision 2 put open intent on a closure region, which made intent depend on geometry existing. Reversed |
| Q9 | V1 before V2, as product order | A flat canopy looks finished over today's Walls |
| Q10 | Levels, stairs and terrain are outside this batch | No journey evidence; a suspended region is the probe |
| Q11 | A0 lands as a docs-only Tier 1 PR | The promotion was owed |
| Q12 | The Room carries a connected rotunda's identity; Round is a stated fact of the Room | Subject to S1 proving whole-object editing and inspectable components |
| Q13 | An opened Room stays the same Space with a virtual edge; a Space exists while a Wall bounds it or a floor lies under it | Predictable, reversible, and it ends a silent data loss |
| Q14 | Spaces do not overlap on the same surface; an open space may sit wholly inside a Room; the World is not partitioned; Zones are reserved for broader scopes | Containment in one direction covers booths in a hall without a priority rule |
| Q15 | Interior Reveal is an editor-session reading; Layout owns the representation, the shell owns the reading | Same split as Unroll |
| Q16 | Floor and overhead regions are one family in the verticality plan | The same geometry, mirrored |
| Q17 | On Join the survivor's finish wins, with a visible consequence and Undo | Join always works; nothing is lost silently |
| Q18 | The joint T1–T2 plan is the first commit of #289's S5a | One place, two reviewers |
| r3 | Level cut ships before the automatic cutaway | Deterministic before heuristic; see the comparison in the proposal |
| r3 | The cutaway has a switch and a hold key, no pinning | A deliberate cut is Slice's job |
| r3 | Edits that would break a round Room refuse; **Release round** is the workaround | A radius that never silently stops working |
| r3 | Unroll the room starts at the selected Wall and reads clockwise from inside | Resolves the display-cut question with the selection the creator already made |
| r3 | No weld in this batch | The overlap cue measures demand first |

## Left to implementers

- Which fragment keeps the Wall id on split and which Wall survives a join: follow the planners and
  state the rule.
- Refusal wording, following `adapters/layout/refusals.ts`.
- Arc input details: bulge snapping, typed rise or radius, the minimum rise.
- Where the Card's Split lands when an Opening sits at the midpoint.
- Default offset and direction of a duplicate's first proposal.
- `face` transition duration and padding within the existing `fit` rules.
- How Slice caps are generated; the cutaway's stub height and the key that holds Walls whole.
- How the Room tool orders free ends when proposing a closure, and when it declines to guess.
- Test placement per [`apps/editor/tests/README.md`](../../../../apps/editor/tests/README.md).

## Verify first

Read from code, not observed. Each is cheap and belongs to the slice named.

1. A free-standing circle inside a Room: what the outer Room's area label and floor show. (C)
2. `planDissolveJunction` on a curved pair mints a knot id from occupancy, not from the capture,
   and has no caller outside tests. (A2)
3. `planWallSplit` on a curved Wall with Openings on both sides, through Undo and Redo. (A1)
4. Whether the Room Card's scoped list has a non-destructive action slot today. (A4)
5. What the Stage shows for a closed Room from outside and from above. (X0)
6. Whether the Stage gives any cue today when two independent Walls are coincident. (A5)
7. Whether one history entry can already span a Layout and a Scene change. (J)
8. Whether a click on a Room's floor selects the Room in 3D as well as in Plan. (SP1, C)
