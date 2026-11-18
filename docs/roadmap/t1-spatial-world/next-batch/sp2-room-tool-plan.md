# T1 SP2 — Room tool: create Spaces from partial Walls

**Capability** `layout.space` · **Tier** 1 · **Baseline** `515e460b` (#376, SP1d merged)

**Status** Proposed implementation plan. The audit is based on the merged source and existing
tests. The algorithms, interaction details and fixtures below are implementation targets.

Build → **Room** lets the creator hover inside partial Walls, inspect a single mixed outline,
click to create an Open space, and type its name. **Draw open side** lets them state the missing
edges when the outline is absent, ambiguous or different from what they want. One implementation
PR should deliver both paths. See the [approved Spaces UX](./README.md#spaces),
[Lane SP](./implementation-prs.md#lane-sp-spaces), the
[Space invariants](./sp-plan-open-spaces.md#33-invariants) and [SP-plan §13](./sp-plan-open-spaces.md#13-implementation-slices).

## Existing capabilities and missing work

| Area | Reuse from main | SP2 work |
| --- | --- | --- |
| Space record and geometry | Format 8 `LayoutWallFirstRoom`, oriented `boundary`, ordered `virtualEdges`, overhead, thicknesses and the `rooms` identity family. `composeSpaceBoundary`, `spaceBoundaryPolygonFromEdges` and `spaceBoundaryCycleKey` in `layout-room-reconciliation.ts` already handle mixed cycles and consecutive virtual edges. | Build input to the composer from an inferred or deliberately traced cycle. Create the record directly with one new id. |
| Wall topology and geometry | `wallJunctionComponents` and `lookupIncidentWallsOrdered` supply explicit Junction adjacency. `extractBoundaryCandidateFaces` extracts Wall-only faces and strips dangles. Existing curve sampling, robust orientation, Wall segment/contact predicates, strict point-in-polygon and Plan boxes provide the geometric queries. | Discover open Wall runs, pair their ends, construct the approved cap and prove uniqueness under the cursor. The face extractor never proposes an open outline. |
| Split, lifecycle and validation | `planWallSplit` / `planWallSplitAtPoint` in `layout-wall-noding.ts` preserve Wall lineage, rewrite existing boundary refs and rebase hosted Openings. SP1d already splits on a deliberate interior anchor. The codec, `validateWallFirstTopology`, compiler and index already own their respective gates. | Stage any deliberate host splits with the Room birth, then run the canonical gates on the whole candidate. Map typed ownership and placement refusals to the existing live reason. |
| Ink and Stage | Build already registers Room as planned. `stage-shell-commands.ts` bridges Build tools into the one Ink task. `ink.ts`, `stage-pointer.ts` and `ink-session.ts` already resolve deliberate projected Junction/Wall/free targets, working-plane points and click versus navigation. `candidate-presenter.ts`, the adapter preview hooks and SP1d provide transient dashed/refused geometry and consequence cues. | Add the Room reading, its hover and manual draft controller, and an outline preview built from the composed candidate. |
| Space selection and naming | The Layout adapter, Plan picker, Stage and Space Card already select `room-floor`/labels, arbitrate innermost Space, and expose Kind, Area, Bounds, Overhead and Remove space. `layoutRoomNameTarget` writes through `layout-entity-name`; `EditorCard.svelte` already accepts a rename request and focuses/selects the text. | Select the new Space against the installed revision and issue a one-shot rename request qualified by that selection. |
| F4, Save and Visitor | `drawing-planners.ts` captures operation, revision, level and deterministic IDs. `host-acceptance.ts` and `acceptance-coordinator.ts` install one validated Layout change with chronological Undo/Redo. F2 Save/Load already carry format 8. The visitor uses the physical compiler output and SP1c parity. | Register one Layout-only creation intent and test it through those paths. |

## Wall-side ownership

**Keep I6.** The owner map keys by `(wallId, direction)`. Compute direction from the positive
composed cycle before checking ownership. In a positive cycle the interior is on the same side
of each traversed Wall. Reversing a ref to borrow its other side would reverse the boundary's
relationship to the interior. Splitting an owned Wall gives the existing owner both fragments
in that direction. I7 answers whether two footprints can coexist. It grants no Wall ref.

| Approach | Decision |
| --- | --- |
| A booth uses its own partial Walls inside a Hall, or the available side of an independent partition | **Recommended.** Existing nesting and point ownership work. Adjacent Spaces may use opposite sides of the same physical Wall. The Hall keeps its full outline and metadata. |
| Give the booth the Hall's inward side as a second owner | Requires an explicit owner decision changing I6. Wall roles, portal relations, shared-Wall erase and ownership consumers would need a new contract. |
| Transfer the inward side to the booth by cutting a notch or hole in the Hall | Changes the Hall's Wall face and I5. A Hall with a hole also exceeds the one-cycle composer. |
| Treat a coincident virtual edge or duplicated Wall as a proxy for the Hall's Wall | Hides the true physical boundary or creates duplicate architecture. The Room tool refuses a newly drawn virtual edge that rides an existing Wall and never makes a proxy Wall. |

Coordinates below use X/Z in metres and positive cycle order.

| Fixture | Expected result |
| --- | --- |
| Hall `(0,0)–(12,0)–(12,8)–(0,8)`. Independent Booth Walls `(2,5)→(2,2)→(5,2)→(5,5)`. | `9 m²` open Booth with one virtual edge, nested in the `96 m²` Hall. Hall id, name and Wall refs survive. At `(3,3)`, Space membership and floor selection choose Booth; at `(6,3)` they choose Hall. Clicking a physical Wall selects that Wall. |
| Same Hall. Attempt Booth `(2,0)→(5,0)→(5,3)→(2,3)` with its first side on the Hall's south Wall. | Even after speculative splits at `x=2` and `x=5`, the south fragment faces both interiors in the same direction. Refuse **Hall already uses this Wall side**. Accepted Hall, Walls and Openings retain their bytes. Drawing the side as virtual on the same Wall also refuses. |
| Two `4 × 3` U-shaped outlines abut on the Wall `x=4, z=0…3`, one footprint west and one east, each missing its north side. | Both are legal when authored with one physical divider ref each, in opposite directions. Compile one physical divider and two Spaces. Existing SP1 shared-Wall erase merges them under the existing metadata rules. |
| A proposed open outline intersects a neighbour's interior, encloses another Space, or only touches a neighbour. | First two cases refuse wherever the canonical I7 gate rejects the pair. Boundary-only touch is legal and point attribution continues to use the existing query. |

## Division and scope

Keep SP1's B3 **closure wins**. A Wall stroke that encloses part of a Space keeps the old id and
name on the enclosed Room and reports the unnamed remainder. Room can create a separately named
Space in that ground on a second deliberate operation. An existing two-enclosed-face split still
follows SP1. A divider that closes nothing leaves the existing open Space as SP1 specifies.

Extend the SP1 B3 fixture with physical Walls `(0,0)→(4,0)→(4,3)→(0,3)` and open side on `x=0`.
Draw `x=2` from `z=0` to `z=3`. The enclosed east half inherits the original id and reports
`6.00 m² left outside`. Hover at `(1,1.5)`. The west candidate uses the remaining south/north
fragments and the divider side opposite the Room, with a straight virtual edge on `x=0`. Creating
it adds a fresh id and name. Undo the new Space first, then undo the dividing Wall to restore the
original open Space. Redo restores those same identities in order.

Automatic birth of an open remainder, splitting one open Space into two open Spaces, and
transferring names or contents during such a split are deferred. Scope ends at Wall-supported
Spaces with existing SP1 surfaces and lifecycle. Floor-derived SP3, V1 regions, T2 finishes,
zones and multi-level authoring are separate work.

## Automatic proposal

1. **Take an accepted Layout snapshot.** Work on the current Layout floor in X/Z. Use physical
   Wall endpoint IDs, including existing splits. A free tip is a Junction with one incident
   non-closed Wall in the real Wall graph and no other incident Wall. A two-ended open Wall
   (straight or a supported curve) may form a run. A closed single-Wall loop supplies no tip.
   Virtual edges and geometric coincidence supply no adjacency.
2. **Enumerate one-gap runs.** Within each component, consider unordered pairs of distinct free
   tips. Walk all simple physical paths joining the pair, without revisiting Junctions or Walls.
   A degree-2 chain is one walk. At a branch inspect all continuations, including the available
   side of a divider on an already enclosed face. A branched component alone proves neither
   uniqueness nor ambiguity. Search order is stable by authored IDs. A pair of disconnected runs
   requires explicit drawing of the gaps. Auto pairs tips within one connected physical run only.
3. **Construct exactly one cap per run.** Normally connect the two tips with one straight
   segment. For two straight terminal legs with parallel, co-directed outward axes, use the
   front perpendicular to those axes at the farther tip. Extend the shorter leg forward to that
   line and then join across it. For level tips within the existing point tolerance use one
   segment. For staggered tips the intersection is a new virtual-only Junction. This is the
   orthogonal closure in [sketch 7](./interaction-sketches.html), with one geometric result and
   no diagonal fallback. Use robust orientation for parallelism and the dot product for
   co-direction and forward extension. For example `(0,4)→(0,0)→(6,0)→(6,2)` proposes
   `(6,2)→(6,4)→(0,4)`, area `24 m²`. A single straight Wall yields zero area and needs manual
   corners. A curve uses canonical samples and the straight endpoint cap.
4. **Compose and classify.** Assemble ordered Wall refs and virtual spans, resolve the outline
   through the SP1 composer and normalize to positive winding by reversing the entire cycle if
   needed. Deduplicate rotations by `spaceBoundaryCycleKey` using stable temporary corner
   identities derived from the normalized run when screening. Apply the shared I4 and I7
   predicates, and check exact directed-side availability. A proposed virtual span must be clear
   of physical Wall centrelines except at explicit incident endpoints. Use the existing segment
   classifier and canonical curve samples. Reject crossings, interior touches, unrelated
   coincident endpoint contacts and collinear overlap. This is Room-tool placement policy for
   new spans. I9 and SP1's treatment of later Wall edits still apply.
   Pin non-adjacent virtual-to-virtual endpoint-on-interior contact separately. The landed
   shared self-intersection helper checks proper crossings, collinear overlap and repeated
   vertices. If the fixture exposes a missed pinch, extend that shared predicate for I4 using
   the existing segment classifier and prove compiler/index agreement.
5. **Use strict cursor containment.** Query boxes as a broad phase, then require the unsnapped
   working-plane point to be strictly inside the composed polygon. An outline edge, a projected
   Ink connection hit, and UI chrome take precedence over interior hover. Existing Room floor
   picks do not mask a nested Booth candidate. No distance, area, recency or ID tie-break picks
   between distinct candidates.
6. **Return one of three outcomes.** Exactly one viable distinct cycle yields a preview only
   after the create planner succeeds. Two viable cycles yield an ambiguity reason and no
   outline. Zero viable cycles yield no actionable outline. If exactly one recognizable loop
   under the cursor fails a named rule, show its proposed virtual edges in red with the reason.
   Multiple failed outlines, degeneracy and indeterminate search get words only when the cursor
   is in relevant geometry. Off the geometry, keep the idle hint. Every failed display is
   noncommittable.

Build adjacency and sampled Wall bounds once per accepted Layout source. For component pruning,
expand the Wall bounds by their diagonal in both axes. A cap's extension is no longer than
the tip separation, so this broad phase retains every possible orthogonal cap. Cache
component walks by source identity within the binding and query their outlines by bounds. Stop
the search as soon as two viable distinct outlines are proven. Bound synchronous search to
4,096 path expansions or tip-pair visits per lookup, counting both. A cached walk counts for
the same logical work so cache history cannot turn an indeterminate result into a proposal.
An exhausted search returns
**Couldn't find one outline · Draw open side** and must never publish its partial result. The
budget is a work bound, independent of Wall dimensions, zoom and traversal timing. Reuse the
presenter's binding lifetime and cache the one prepared candidate by intent; movement within its
valid interior should reuse it. Full candidate compilation belongs to proposal preparation, never
the render loop. An eligible outline may be conservatively withheld if preparation refuses.

## Manual drawing and creator interaction

- **Arm.** Build → Room opens a Room reading of Ink, with **Draw open side** in its plate. Use
  the same working-ground projection in settled Plan and 3D and the same disposition of pan,
  orbit and UI events as Ink. Offer a reason if the working floor cannot be projected. Inactive
  readings, changed working floor, lens/tool switch, Preview and teardown release the draft.
- **Hover and create.** Highlight the physical run in ink using its sampled Wall path. Draw the
  virtual cap in cobalt dashes with the usual halo. The live tag reads `Open space · 24.0 m² ·
  Click to name`, using the canonical compiled area. Keep the accepted drawing and selection
  legible. Primary click inside the displayed proposal creates it. On touch a first tap can
  show the proposal and a second tap inside accepts that displayed outline. Dragging or pinch
  follows Stage navigation and cancels the pending press.
- **Draw a gap.** In **Draw open side**, turn off auto hover and click an existing Junction on a
  physical Wall or explicitly hit a Wall interior. An interior hit captures Wall id and station.
  Click a second Wall anchor for a straight gap, or click free corners before the second anchor.
  Use Ink's screen-space targets, exact Junction coordinates and existing grid/angle guides
  for free corners. Resolve a curved host station with the existing curve projection and
  arc-length evaluator. Ink's CSS polyline hit identifies the host, while the split station
  is measured in canonical arc metres. Show endpoint marks and an active dashed span.
  Tied incompatible host targets require a deliberate clearer hit. A free point never acquires
  a Wall connection through coordinate proximity or a grid snap.
- **Complete the cycle.** At the end of a gap, preview a unique simple Wall return path to the
  first anchor if one validates with the explicit gaps already drawn. The creator clicks
  **Create Space** (or Enter) after the full outline is shown. If several returns qualify or if a
  second gap is required, **Follow Wall** lets the creator click a highlighted incident Wall
  span and advance to its far Junction, one span at a time. At a deliberate interior start/end
  anchor only the two split fragments, in the appropriate direction, are incident. **Draw open
  side** starts the next virtual run from that cursor. Closing back at the first anchor with
  one or more Walls and one or more virtual edges enables **Create Space** after validation.
  Never choose among branch alternatives. Backspace removes the last drafted span or corner.
- **Refuse and recover.** Dashed red plus one local reason for a recognizable refusal, for
  example **Overlaps Booth 2**, **Hall already uses this Wall side**, **An open side crosses a
  Wall**, **This outline crosses itself**, or **The split crosses an Opening**. A missing or
  ambiguous outline offers **Draw open side**. A draft with no support reads **Start on a Wall**.
  Show **Splits _Wall name_** before a valid deliberate split. Keep the manual draft editable
  after a geometry refusal. Escape cancels a pending press or the whole manual draft first and
  returns to Room hover, then follows the shell's plate, tool and selection ladder. Losing
  pointer capture cancels the press; a revoked draft lease discards the draft.
- **Name.** Install with the first available `Open Space N` and `open-to-sky` using existing
  thickness defaults. Return to Select, select the fresh Space by id and focus its existing
  Card name field. Enter uses the normal trimmed name writer. Escape or blur keeps the default
  (or prior name). A blank name gets the existing refusal. Creation is one history entry,
  including all new anchors and splits. A completed rename is a second ordinary entry. Undo
  and Redo restore exact accepted data and never reopen the draft or the name input. Save uses
  the usual project path and persists the accepted Space, anchors and name.

## Core and F4 seams

1. **New `layout-space-create.ts` in Layout core.** Export an auto-query seam
   `findSpaceCreationOutline` that consumes an accepted Layout snapshot, `levelId` and cursor,
   and yields an inferred cycle, ambiguity or refusal evidence. Put graph walk and cap policy
   behind this seam. Manual path completion uses the same simple-path walk with explicit
   anchors and already stated spans. Export `planCreateOpenSpace({ baseline, levelId, capture,
   cycle })`. The serializable cycle has ordered directed Wall spans and virtual segments.
   Its vertex descriptors are `junction(id)`, `wall-station(wallId, station)` or `corner(key,
   point)`. Physical spans name their original Wall id and the applicable endpoint or station
   at each end. `corner` keys are stable within the intent. The planner is independent of
   hover, projection and snapping. It checks the supplied cycle itself, including match to
   the captured Wall geometry, support, connectedness, positive orientation, no repeated
   resolved Wall fragment and candidate-only cap clearance. Both inputs enter the same create
   planner.
2. **Resolve identities and validate a single candidate.** Existing Junctions are used by id.
   Materialize new corners as ordinary virtual-only Junctions. Group and deduplicate deliberate
   stations per original Wall, split in original Wall-id order and descending station order on
   each Wall, and resolve all intended spans through the noder's fragment mapping. Use the
   canonical station on the retained prefix as authority. Before subdivision, resolve each
   curved anchor once on the original Wall and check that subsequent splits land on that
   point within the existing Junction tolerance. Refuse a displaced anchor instead of silently
   publishing the wrong split. Refuse invalid stations,
   unsupported splits, unrepresentable repeated anchors and ID collisions. The noder rewrites
   existing Room refs and Opening stations. Keep Wall-side ownership, association targets and
   metadata on existing records. Derive one `room.open-space` id, corner ids and split ids with
   `layout-id-capture.ts` from the captured nonce and stable operation keys. Allocate the name
   using the existing Room naming policy with the `Open Space` prefix. Run
   `validateWallFirstLayoutDocument`, `validateWallFirstTopology` where the candidate introduces
   Junctions or subdivides a Wall, and `compileWallFirstLayoutGeometry` with the existing
   blocking-issue check, following the canonical gates used by Wall creation. Shared outline and
   placement checks own I4/I7. The operation preserves I5 by adding a mixed cycle and doing at
   most face-preserving Wall subdivision. Existing index certification remains the cold oracle
   on certifiable inputs. Return a typed refusal with affected IDs and optional display-only
   composed evidence, or the validated document, compiled result, new Space id, final cycle key,
   created Junction/Wall IDs, split Wall IDs and consequence data. The plan carries no Floor or
   lid geometry in authored data.
3. **New `space-create-planners.ts` in the Layout adapter.** Register `layout-open-space-create`
   in `layout.adapter.ts`, following `drawing-planners.ts` and `open-side-planners.ts`. Validate
   the payload, expected project revision, Layout content revision and level. Qualify existing
   Wall/Junction targets and require their exact match to payload references. Capture a stable
   operation id and Layout nonce, the exact ordered cycle and the resolved stations/points once
   per displayed candidate. Use the same intent for preview and commit. Acceptance replays the
   canonical planner on the expected source or consumes the existing exact-intent prepared
   candidate handoff where applicable. It never reruns hover or snapping on release. Emit
   created Space/Junction/Wall and preserved split-source correspondence for the affected
   subjects; replace only Layout through ordinary F4 unit acceptance and identity promotion.
   A changed source, projection, candidate or lease invalidates the displayed capture. A press
   must release within the same eligible interior or on the same manual confirmation control.
   A stale press cannot silently accept a new outline or read a different level.
4. **New `space-create-session.ts` beside `ink-session.ts`.** Dispatch Room through the existing
   Ink binding for pointer, hover, keys, overlay, gesture lease, cancellation and rebind. Wire
   the Build registry, `stage-shell-commands.ts`, Ink reading state, `InkPlate.svelte` and
   `LayoutInkPalette.svelte` through the same task/plate bridge. Extend `session-ports.ts` only
   for the narrow Room handoffs. Use the existing candidate preview types and Plan/3D renderer
   for ink, refusal and temporary endpoints. Use Stage's qualified selection after install;
   reuse the route's Card rename request with the fresh Space reference so a rebind or user
   selection change cannot focus another subject. Keep preview and manual draft in the binding.
5. **Runtime boundary.** Compiler output for physical Walls, Openings, Space floor and overhead
   reaches Stage and Visitor through SP1's existing representation. Room overlays, live tags,
   virtual-only handles, draft input, selection and F4 stay editor-side. Existing support
   queries see the new floor and innermost membership on the installed snapshot. Creation does
   not rewrite existing authored object assignments, Scene references or Camera paths.

## Verification

| Seam | Regression fixtures |
| --- | --- |
| Inference and create planner | Standard three-Wall U and staggered sketch U with exact points and areas; reversed Wall storage and shuffled collection order; curved run uses sampled path; two nested independent partial U runs under one cursor give ambiguity; branch plus divider yields the B3 west candidate; touching cursor, cursor outside, one straight Wall, closed ring, unsupported disjoint auto pairing, blocker crossing/touch/overlap, empty floor and search exhaustion. Compare positive cycle keys and exact virtual endpoint IDs across replay. |
| Manual and ownership | One Wall plus three explicit virtual edges; two disconnected opposite Walls with two explicit gaps; authored free corner, deliberate Junction snap and host split, including two stations on one Wall; ambiguous branch resolved by explicit Wall tracing. Test a protected Opening split refusal and an allowed split with Opening rebase. Cover the Hall, Hall-side refusal, opposite sides and I7 fixtures above. Test bad or stale references, coincident unrelated Junctions, degenerate/repeated ends and forged intent payloads against the actual planner. |
| SP1 regression | New birth → move open-side grip → redraw/absorb a partial Wall → close along the remaining open side with same id and name. Last Wall erase, shared opposite-side Wall erase and Remove space retain SP1 outcomes and prune only released anchors. Existing face extraction, topology, I4/I5 certification and compiled geometry stay coherent after deliberate splits. |
| Editor and F4 | Extend the production host harness used by `layout-drawing-adapter.test.ts`, `layout-open-space-adapter.test.ts` and `layout-open-side-handle-adapter.test.ts`. Build tool routing, hover → preview → click with same IDs and outline, refusal/ambiguity with no write, manual Escape and rebind, stale revision/level and projection, one create entry, qualified fresh selection, rename as a second entry, exact Undo/Redo and Save/Load. Assert the existing Plan picker chooses the nested Booth and Wall picks still win. |
| Read boundaries | Extend the existing Space/visitor parity fixture with a space created by this planner. The generated floor and physical Walls survive Save/Load and reach visitor geometry. The new Space has no lid by default and no virtual outline, handles, hints or authoring imports enter Preview or public delivery. Run the existing Layout geometry, Preview and public-surface boundaries. |

Focused manual browser QA after implementation uses three journeys.

1. Draw three Walls in a Hall, arm Room from Build, hover the Booth and inspect the Wall ink,
   cap and name focus. Type a name, Undo/Redo rename and creation, save/reopen and enter Preview.
   Verify nested floor picking, Wall picking and clean console output across Plan and 3D.
2. Hover an ambiguous arrangement, use **Draw open side** with a free corner or deliberate split,
   verify a red refusal against a neighbour or an owned Wall side, cancel with Escape, then
   draw a valid outline and create it. Spot-check touch or coarse-pointer targeting and pan.
3. Divide an SP1 open Space, check its named closure consequence, create the unnamed remainder
   with Room and confirm the divider is shared in opposite directions. Undo in sequence.

Use [the editor test contract](../../../../apps/editor/tests/README.md#what-a-change-requires) for
affected suites, type checks, architecture and merge-gate evidence. Focused manual browser QA
supplies interaction evidence for owner acceptance. The [workflow](../../../workflow.md#work-units-and-plans)
puts the plan in the first commit of the implementation draft PR for fresh-context review before
code. The recommended scope retains I6 and B3. A request to share the Hall's inward side would
need an explicit owner decision and an updated contract before implementation of that behavior.
