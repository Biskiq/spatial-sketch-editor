# T1 SP-plan — Open Spaces architecture

**Status:** proposed, Tier 2, awaiting owner decision. Planning only: no production code, schema,
fixture or approved-roadmap edit is in this PR, and nothing here is production acceptance.

**Capability:** `layout.space` *new*. **Base:** `main` at `06f0d0df`.

**Authority:** the approved [T1 next batch](./README.md#spaces) (PR #290, rules 1–7, decisions Q8,
Q13, Q14), its [slices](./implementation-prs.md#lane-sp-spaces), the
[S2 spike](./spikes/s2-space-conversion.md) (PR #300), the
[Layout contract](../../../reference/components/layout.md) and
[persistence](../../../reference/components/persistence.md).

**Evidence limit.** Every statement about current behaviour was read from code at the base commit
and cites `file:line`. Nothing was run in the editor. S2's passing fixtures are simulations except
where S2 marks them production; this plan treats them as feasibility, not proof.

## 1. Verdict

Adopt S2's R1 with four corrections that S2 did not reach:

1. **An open Space is not a face.** Wall-only face extraction and the planar walk stay exactly as
   they are. Open Spaces are certified by one separate outline check. S2's suggestion to put
   virtual edges into the positive-face key is rejected (§9, alternative A).
2. **Re-close is not free.** S2 reported that `planWallChain` needs no reconciliation change. It
   passed on a rectangle because overlap evidence happened to survive a wrong predecessor polygon.
   Three reconciliation inputs are unsound for an open predecessor and must change (§3, F1–F3).
3. **Virtual-edge ends are Junctions and nothing else.** No coordinates, no ids, no station
   anchors. Order is not stored twice: it is parsed from Junction chaining by one composer.
4. **"Opening" is a reconciliation outcome, not a removal special case.** Every topology planner
   already funnels through `reconcileRooms`; the Space carry rule replaces its "room
   disappearance" block, so chain, removal, dissolve and move planners inherit it together.

The approved fallback (identity only through a re-close) stays unnecessary.

## 2. What S2 established, and what it did not

| S2 statement | Standing in this plan |
| --- | --- |
| R0 collapses a corner (12 m² for 24 m²) and prunes the corner Junction | Accepted as the reason derived gaps are refused. Regression test T3 |
| The codec accepts an open Room today; the compiler returns zero Rooms; the index refuses | Accepted. The codec acceptance is itself a defect: format 7 can persist a document that never compiles. Format 8 closes it (I4) |
| `roomBoundaryPolygon()` returns a triangle for an open rectangle | Accepted, and wider than S2 said: eight production callers use it as *reconciliation evidence* (§10) |
| Re-close needs no reconciliation change | **Rejected.** See F1–F3 |
| The world index should include virtual edges in the positive-face key | **Rejected.** See §7.4 and alternative A |
| Virtual edges are straight segments between surviving Junctions | Accepted as the format rule; its consequence for curved Walls and for sliding ends is decided in §5 and B2 |
| Shared-Wall erase still merges | True for two enclosed Rooms only. S2 has no fixture where one side is already open; production would retire both. Decided in §5.3 |
| Snapshot Undo/Redo is exact | Accepted for snapshots. F4 wiring is unproved and is an SP1c check |

### Assumptions that fail under inspection

- **F1. Wrong predecessor polygon as evidence.** `roomBoundaryPolygon`
  (`layout-room-reconciliation.ts:138`) pushes only each ref's start point, so an open boundary
  yields a polygon missing every gap end. `planWallChain` (`layout-wall-chain.ts:880`), removal
  (`layout-wall-topology-ops.ts:373`), dissolve (`layout-wall-dissolve.ts:377`), circle creation
  (`layout-circular-room.ts:217`), chain policy (`layout-wall-chain-policy.ts:374`) and the
  short-boundary gate (`layout-wall-first-precision.ts:2841`) feed that polygon into overlap and
  witness tests. On an L-shaped open Space the witness can fall outside the true outline and the
  Space is then retired or matched to a neighbour.
- **F2. The M-3 identity shortcut.** `buildCorrespondenceComponents` settles a pair without
  geometry when a Room's `canonicalBoundaryCycleKey(room.boundary)` equals a candidate face key
  (`layout-room-reconciliation.ts:680`). Its stated precondition is that the key proves unchanged
  geometry. An open Space's Wall-only key says nothing about its virtual edges, so an open
  predecessor must never claim a face by key.
- **F3. Single-component authorization.** `correspondenceAuthorization` takes a Room's component
  from its first resolvable boundary Wall (`:267`). A Room with two opposite Walls erased has
  Walls in two components; a face drawn on the second component is refused as "cross-group" and
  the Space can never close from that side.
- **F4. Junction pruning.** Removal prunes any endpoint no surviving Wall references
  (`layout-wall-topology-ops.ts:345`). The corner between two erased Walls is exactly such a
  Junction.
- **F5. The fast path.** Junction and Wall moves are certified incrementally by
  `verifySweptBoundsGeometryDelta` (`layout-world-index.ts:922`) without a compile. It knows
  nothing about outlines or the overlap gate.
- **F6. Rigid moves follow Wall connectivity.** `planWallFirstRoomMove` moves the connected group.
  An open Space spanning two components would be torn in half.
- **F7. One-identity membership.** `room-membership.ts:31` assigns an object to a Room only when
  exactly one floor witness contains it. A booth inside a hall produces two.

## 3. Recommended model

### 3.1 Representation

One persistent subject. The `rooms` collection, the `LayoutWallFirstRoom` type name, the `rooms`
identity-ledger family, `LayoutObject.roomId` and `connectsRoomIds` are unchanged. "Space" is the
product word; "Room" and "Open space" are derived readings of one record.

```ts
/** A stated straight segment between two Junctions. Never a subject, never connectivity. */
type LayoutSpaceVirtualEdge = { startJunctionId: string; endJunctionId: string };

type LayoutSpaceOverhead = 'closed' | 'open-to-sky';

type LayoutWallFirstRoom = {
  id: string;
  name: string;
  /** Wall sides only, in cycle order. At least one. Type unchanged. */
  boundary: OrientedWallRef[];
  /** In cycle order. Empty exactly when the Space is enclosed. Required. */
  virtualEdges: LayoutSpaceVirtualEdge[];
  /** Required. */
  overhead: LayoutSpaceOverhead;
  floorThickness: number;
  ceilingThickness: number;
};
```

Both new fields are required on every record, following the fresh-authority rule already applied
to `centerline`. `ceilingThickness` is kept under `open-to-sky` so switching back restores the lid;
its long-term fate belongs to the V-plan.

`boundary` keeps its type on purpose. About forty production sites read `ref.wallId` to answer
"which Spaces does this Wall bound" (role, portals, isolation, index relations, duplicate, noding).
None of them changes. Only ordered traversals change, and they all move to the composer.

### 3.2 The one composer

`composeSpaceBoundary(document, room)` in `layout-room-reconciliation.ts` is the only place the
mixed order exists. It returns `SpaceBoundaryEdge[]` (`wall` with id, direction and end Junctions,
or `virtual` with its end Junctions), or a typed failure.

```text
v = 0
for i in 0 .. n-1:                      # n = boundary.length
    emit wall(boundary[i])
    a = end Junction of boundary[i]
    b = start Junction of boundary[(i + 1) mod n]
    while a != b:
        require v < m and virtualEdges[v].startJunctionId == a
        emit virtual(virtualEdges[v]); a = virtualEdges[v].endJunctionId; v += 1
require v == m                          # m = virtualEdges.length
```

The parse is unique because Wall order is persisted, a gap exists only where consecutive Wall ends
differ, and I3 forbids a virtual chain from revisiting a Junction. Consequences:

- The gap after the last Wall ref wraps to the first; its edges come last in `virtualEdges`.
- A virtual edge where no gap exists is `space_virtual_edge_unconsumed`. A virtual-only lobe cannot
  be expressed.
- Rotation of `boundary` is not canonicalised for open Spaces. Comparisons use
  `spaceBoundaryCycleKey`, which extends the existing token and rotation rule
  (`layout-face-extraction.ts:495`) with `V~start~end` tokens. For an enclosed Space it equals
  today's key, so face keys and Room keys still cannot diverge.

`roomBoundaryPolygon` becomes a thin wrapper over the composer (Wall samples plus virtual
endpoints). That single change fixes F1 at all eight call sites.

### 3.3 Invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| I1 | A Space has at least one Wall ref. (SP3 will add "or follows a floor region".) | Codec (`room_boundary_empty` exists) |
| I2 | The composed boundary is one closed cycle and consumes every virtual edge | Codec, via the composer |
| I3 | Within one Space, no Junction is the start of two virtual edges, and no virtual edge has equal ends | Codec |
| I4 | The composed outline is simple, has positive area in the face orientation, and each virtual edge has length above `POINT_EPSILON` | Compiler (blocking), index certifier |
| I5 | `virtualEdges` is empty **iff** the Space's boundary is a positive face of the Wall graph. Every positive face has exactly one enclosed Space. No open Space's boundary is a face | Index certifier; reconciliation by construction |
| I6 | A Wall side (`wallId` + direction) is referenced by at most one Space | Codec. Today it is checked only within one Room |
| I7 | Same-surface placement: two Spaces of which at least one is open share no interior area, unless the open one lies wholly inside an enclosed one. Enclosed/enclosed pairs keep today's permissive rule | Compiler (blocking), index certifier |
| I8 | A virtual edge references existing Junctions. A Junction referenced by a virtual edge is never pruned while that edge exists, and is pruned when the last reference (Wall or edge) the operation released is gone | Codec; removal, reconcile and Remove space planners |
| I9 | Virtual edges carry no height, thickness, Opening, portal, surface reference, name or ledger entry, and never take part in noding, crossing or component labelling | Types; absence of consumers |
| I10 | Virtual edges, open-side counts and outline handles never reach a visitor chunk or a release as drawable geometry | Visitor parity test; public-surface boundary |
| I11 | `overhead` is authored intent. No geometry, region or reading changes it | Planners; V1 seam |

### 3.4 Ownership

| Owner | Owns |
| --- | --- |
| Layout document | The Space record: identity, Wall refs, virtual edges, overhead intent, thicknesses |
| `layout-room-reconciliation.ts` | The composer, the cycle key, and every transition between enclosed, open and retired |
| Canonical compiler | Outline, floor polygon, area, bounds, lid presence, and the I4 and I7 blocking issues |
| World index | Certification of I4, I5, I7 and Space relations for incremental edits |
| Layout Plan representation | The dashed open-side primitive, with source identity `{ sourceId: roomId, stream: 'symbol', subRef: '<start>><end>' }` |
| Editor adapter and shell | Intents, consequence lines, handles, Card, Index. No Space geometry of its own |
| Scene, Camera, Experience | Nothing new. A Space id is referenced exactly as a Room id is today |

## 4. Format and validation

- **Bump:** Layout `formatVersion` 7 → 8 (the next number; if another bump lands first, take the
  one after it). `KNOWN_LAYOUT_FORMAT_VERSIONS` holds only the new value. A payload declaring 7
  fails as `unsupported_format_version`. No migration, no dual reader, no defaulting of the two new
  fields: a format-8 Room without `virtualEdges` or `overhead` is `invalid_type`.
- **Codec** (`layout-wall-first-codec.ts`): `ROOM_KEYS` gains the two keys; `parseRoom` (`:859`)
  reads them; the reference pass (`:379`) adds I2, I3, I6 and I8 with codes
  `space_boundary_open`, `space_virtual_edge_unconsumed`, `space_virtual_edge_degenerate`,
  `duplicate_wall_side_reference` and the existing `missing_reference`.
- **Compiler issues (blocking):** `space_outline_self_intersects`, `space_outline_not_positive`,
  `space_overlap`, `space_contains_space`. `disconnected_boundary`
  (`layout-geometry-validation.ts:148`) remains for a composed outline that fails to chain.
- **Fixtures:** every format-7 fixture is regenerated (twenty files declare the version today).
  The S2 harness is deleted in SP1b once its cases are production tests.
- **Docs promoted at SP1a merge, not here:** the Layout contract's "Current contract" paragraph,
  persistence's Layout paragraph, and the glossary entry for Space. Persistence line 87 says "Unit
  payload versions are Layout 6" while line 111 says format 7; SP1a must establish whether the
  envelope carries a separate unit version and correct whichever is stale.

## 5. Lifecycle

`reconcileRooms` gains one input, `spacePolicy: { removedWalls, retireRoomIds }`, and its "room
disappearance" block (`:1062`) becomes the **carry rule**. Order of evaluation:

1. **Faces first, unchanged.** Predecessor polygons come from the composer. Three changes to
   correspondence: open predecessors never enter the M-3 claim map (F2); a predecessor's
   authorization is the *set* of component keys of its surviving Walls (F3); a predecessor in any
   face component leaves with that face's boundary and `virtualEdges: []`.
2. **Carry.** Every predecessor not claimed by a face component and not in `retireRoomIds`:
   keeps its surviving Wall refs in order; each removed ref that was this Space's alone becomes one
   virtual edge between that ref's oriented end Junctions; existing virtual edges stay in place.
3. **Open merge.** A removed Wall referenced by two carried predecessors splices their cycles at
   that Wall's ends into one Space.
4. **Support.** A carried Space with no surviving Wall ref retires.
5. **Outline gate.** I4 and I7 are checked on each carried Space (decision B1).
6. **Anchors.** Junctions released by the operation are pruned unless a surviving Wall or virtual
   edge references them (F4).

### 5.1 Transition table

| Edit | Result | Notes |
| --- | --- | --- |
| Erase an outside Wall of an enclosed Room | Same id, name, thicknesses, overhead, object associations; one virtual edge | A curved Wall leaves its straight chord; area changes and the consequence line states the new area |
| Erase a second outside Wall, adjacent | Two consecutive virtual edges; the corner Junction survives with no Wall | Card reads one open side: open sides are counted as maximal runs, never merged in data |
| Erase a second outside Wall, opposite | Two virtual edges; Walls now in two components | Rigid move and authorization treat the Space as one group (F3, F6) |
| Erase the last Wall | Space retires; its virtual edges and unreferenced anchors go; object `roomId` cleared | Consequence line: **Removes *name***. Unchanged portal rule |
| Erase a Wall between two enclosed Rooms | Today's 2→1 face merge | Unchanged code path |
| Erase a Wall between an open Space and any Space | Open merge: one open Space | Survivor by the existing overlap rule. Thickness conflict keeps today's `metadata_merge_conflict` refusal. Overhead conflict: the survivor's wins and the consequence line names it (Q17 precedent) |
| Erase a set that would join three or more Spaces | Refused, `unsupported_component` | Parity with today's 3+→1 |
| Draw a Wall exactly along a virtual edge | Face appears; same id; `virtualEdges` shrinks by that edge, or to empty → reads Room | Same Junction ids through the existing global Junction resolution |
| Draw Walls that enclose the Space by another path | The Space takes the new face, larger or smaller; its virtual edges go | "Closure wins." Consequence line states the area change |
| Draw a Wall dividing an open Space so one part is enclosed | The Space becomes that enclosed Room; the remainder is unnamed ground | Decision B3. The line reads ***name* becomes a room · *n* m² left outside** |
| One stroke encloses two faces inside an open Space | Existing 1→2 split; survivor keeps the id as a Room | Unchanged code path |
| Draw a Wall across or ending on a virtual edge, closing nothing | Space unchanged; the Wall is free-standing | Virtual edges are not noded (I9) |
| Draw a Wall along part of a virtual edge from one of its ends | SP1d: the edge shortens to the Wall's free end and the Wall joins the boundary | Until SP1d the Wall is free-standing and the Space is unchanged |
| Move a Junction or Wall on an open Space's boundary | Allowed; refused whole if I4 or I7 would fail | The delta certifier returns `delegate-cold` when a changed Junction or Wall belongs to an open Space (F5) |
| Split a boundary Wall | Unchanged: `rewriteBoundaryForSplit` (`layout-wall-noding.ts:301`) | Virtual edges reference Junctions, which a split does not move |
| Join at a Junction where a virtual edge ends | Refused: **An open side ends here** | The Junction must survive |
| Move or rotate a Space | All its Walls and virtual-edge Junctions move as one group | `roomBoundaryCycleKey` (`layout-room-move.ts:136`) switches to the Space key |
| Duplicate an isolated open Space | Copy carries remapped virtual edges and the same overhead | `layout-duplicate.ts:597` |
| Exact rectangle dimensions on an open Space | Refused, `unsupported_geometry` | `layout-wall-first-precision.ts:1753` already requires four Walls; add the explicit check |
| **Remove space** (open Space only) | Record removed; Walls stay; object `roomId` cleared; door relations naming it cleared; anchors pruned | New `planRemoveSpace`. No topology change, one history entry |
| `planRemoveRoom` on an enclosed Room with shared Walls | Target is in `retireRoomIds`, so it retires instead of surviving on its shared Walls | Keeps today's meaning of removing a Room |

### 5.2 Identity and content

Preserved through open and re-close: `id`, `name`, ledger reference, `floorThickness`,
`ceilingThickness`, `overhead`, every `LayoutObject.roomId`, every `connectsRoomIds` on a surviving
Wall, and (for T2) the Space's floor surface reference. Lost by design: Openings hosted on the
erased Wall, and door relations on it. A closed circular Wall is one Wall, so erasing it is always
final-support retirement.

### 5.3 Why the merge rule is extended

The approved rule says erasing a Wall between two Rooms merges them. Without an explicit open
merge, the carry rule would turn that Wall into two coincident virtual edges, one per Space: two
named places with nothing between them, sharing an edge that no creator can see or grab. The splice
is the only reading consistent with the approved sentence.

## 6. Overhead intent

- Values `closed` and `open-to-sky`. Births are `closed`. Split descendants inherit. SP2 and SP3
  creations default to `open-to-sky`. An opened Room keeps what it had.
- Edited through `planRoomMetadataUpdate` (`layout-wall-topology-ops.ts:489`), which already
  refuses `boundary`; `virtualEdges` is refused the same way, `overhead` is accepted.
- `open-to-sky` removes the generated lid and nothing else: Wall heights, the derived ceiling
  elevation (`layout-geometry.ts:238`), floor, lighting and selection are untouched. `CompiledRoom`
  gains `overhead`; `bounds3` omits the ceiling thickness; the lid mesh
  (`VisitorLayoutShell.svelte:83`) and any ceiling query record are emitted only for `closed`.
- A `closed` open Space has a lid over the full outline, including across the open side. That is
  the approved "keeps what it had" and is what a loggia or carport is.

## 7. Compiler, area, polygon, faces, index

1. **Outline.** The wall-first adapter builds Room segments per Wall ref
   (`layout-geometry.ts:335`). It also emits one `line` segment per virtual edge, marked virtual,
   in composer order. `floorPolygon` (`:1668`) and `ceilingPolygon` come from that outline.
   Compiled `walls`, Openings, wall query spans and Wall bounds come from Wall segments only.
2. **Ceiling elevation** stays `floor.elevation + max(boundary Wall heights)`; I1 guarantees a
   Wall, so `room_ceiling_undefined` (`:1482`) is unreachable for a valid Space.
3. **Area and bounds** are read from the compiled `floorPolygon` everywhere
   (`room-labels.ts:8`). No consumer computes area from `boundary`.
4. **Face extraction is untouched.** Opened Walls are dangles and are stripped as today. The planar
   map's check that positive faces equal Rooms one-to-one (`layout-world-index.ts:1818`) is
   restated per I5: faces ↔ enclosed Spaces. The Room closure loop (`:1457`) is replaced by the
   composer. Open Spaces are certified by signed area with the existing rounding bound
   (`computeHalfEdgeTwiceAreaContrib` for Wall edges, the exact shoelace term for virtual edges),
   a simplicity check, and I7 through the Wall BVH.
5. **Reuse.** The Room retention key (`layout-geometry.ts:284`) adds the virtual-edge Junction
   points and `overhead`. `layout-geometry-delta.ts:358` and `:973` add the same inputs.
6. **Point ownership.** `spaceAtPoint` returns the containing Space of smallest area. It replaces
   the reverse-order winner of `findPolygonContaining` (`layout-geometry-queries.ts:72`) for Room
   hits (`plan-hit.ts:444`) and the single-identity test in `room-membership.ts:31` (F7).

## 8. Overlap and containment

I7 in words: an open Space may touch a neighbour along an edge, may sit wholly inside an enclosed
Room, and may do nothing else with another Space. A Room inside an open Space and an open Space
inside an open Space are refused (accepted risk 2 of the proposal).

- **Predicate.** `polygonsShareInteriorArea` (exact and adjacency-aware; the reconciliation module
  already depends on it) plus a containment test: every vertex inside or on the outer outline and
  no proper edge crossing.
- **Where.** One function, called by the compiler as blocking issues and by the index certifier.
  Because every planner ends in `validateAndCompile` or a certified delta, a Wall stroke, a Room
  move or a duplicate that would break I7 refuses with words and writes nothing.
- **Existing behaviour kept.** Two enclosed Rooms from independent Wall groups may still overlap
  or nest, as "Overlap is placement, not connection" allows and A5's cue reports.
- **Different surfaces** do not interact. There is one floor today, so the gate is per document;
  V1 must supply the surface key before a raised Space exists.

## 9. Rejected alternatives

| Alternative | Why not |
| --- | --- |
| **R0, derived gaps** | S2: corner collapse, pruned Junction, wrong area. Nothing to edit |
| **A. Virtual edges as edges of the face graph** (open Spaces become faces of an augmented planar map) | It makes splits and merges of open Spaces fall out of existing code, which is attractive. But a Wall drawn around an open Space by another path leaves the old virtual edge as a chord, producing a phantom second Space that needs a pruning rule distinguishing chords from nested islands; virtual edges would join Wall components, turning permitted independent overlap into a same-component crossing refusal; and it rewrites the certified walk, the half-edge area ledger and the incremental patches in the most performance-sensitive module. The carry rule needs none of that |
| **Ordered union `boundary: (WallRef \| VirtualEdge)[]`** | One explicit list is appealing, but it changes the element type at about forty membership sites that have no interest in order, and S2 warned against it. The composer gives the same single ordering with a proof of uniqueness |
| **`afterBoundaryIndex` on each virtual edge** | Redundant with Junction chaining, so two truths that can disagree, and it shifts under every boundary rewrite |
| **Virtual-edge ids** | The Junction pair is already a stable, captured identity within a Space. An id adds an allocation family and a ledger question for something that is "a handle, not a subject" |
| **Coordinate endpoints** | A second coordinate authority beside Junctions; a moved Wall end and its open side would drift apart |
| **Station-hosted endpoints on a Wall** | Needed only for sliding an end along a Wall. It introduces partial Wall-side refs into the boundary and a second hosted relation every station-changing planner must re-base. See B2 |
| **R2, a separate Space collection** | S2: needs a new reference kind or duplicated records, and solves no compile problem |
| **Synthetic "virtual Wall" records** | Would enter noding, role, height, mesh and Opening hosting, each needing an exclusion |

## 10. Consumers that assume closed, Wall-only Rooms

Change means SP1a unless marked.

| Site | Assumption | Change |
| --- | --- | --- |
| `layout-wall-first-codec.ts:379`, `:859` | Refs exist; no closure check; side uniqueness per Room | I2, I3, I6, I8; new keys |
| `layout-room-reconciliation.ts:138` `roomBoundaryPolygon` | Contiguous refs | Wrap the composer |
| `layout-room-reconciliation.ts:250` authorization | First Wall's component | Set of components (SP1b) |
| `layout-room-reconciliation.ts:680` M-3 | Key proves geometry | Enclosed predecessors only (SP1b) |
| `layout-room-reconciliation.ts:932`–`:1043`, `:1062` | Rooms are faces; no face means retire | `virtualEdges: []` on face results; carry rule (SP1b) |
| `layout-wall-topology-ops.ts:345` | Prune by Wall reference only | I8 (SP1b) |
| `layout-wall-topology-ops.ts:489`, `:755`, `:802` | Metadata keys; exclusive Walls; remove Room | `overhead`; `retireRoomIds`; `planRemoveSpace` (SP1b) |
| `layout-geometry.ts:238`, `:284`, `:335`, `:1668`, `:1752` | One segment per Wall; lid always | Outline segments; reuse key; `overhead` |
| `layout-geometry-validation.ts:104`–`:168` | Chain and self-intersection over Wall segments | Run over the composed outline |
| `layout-geometry-delta.ts:358`, `:973` | Room inputs are Walls | Add virtual-edge inputs |
| `layout-world-index.ts:1457`, `:1818` | Closure by Wall chaining; faces = Rooms | Composer; I5 |
| `layout-world-index.ts:922` delta certifier | No outline knowledge | `delegate-cold` on open Spaces |
| `layout-room-move.ts:136`, group selection | Wall-connected group; Wall-only key | Space group; Space key (SP1b) |
| `layout-duplicate.ts:597` | Copies `boundary` only | Copy and remap `virtualEdges`, `overhead` (SP1b) |
| `layout-wall-dissolve.ts` | Any compatible degree-2 Junction dissolves | Refuse at a virtual-edge end (SP1b) |
| `layout-wall-first-precision.ts:1753`, `:2840`, `:2908`, `:2970` | Four-Wall rectangle; short-boundary gate | Refuse open; composer polygon |
| `layout-room-isolation.ts:138`–`:398`, `layout-wall-portals.ts:33`, `layout-wall-role.ts:29`, `layout-topology-components.ts:152`, `layout-wall-noding.ts:301` | Membership by `wallId` | None; covered by regression tests |
| `layout-geometry-queries.ts:72` | Last polygon wins | `spaceAtPoint` |
| `layout-plan-representation.ts:488` | `room-floor` only | Open-side symbol primitive (SP1c) |
| `VisitorLayoutShell.svelte:78` | Floor and ceiling always | Lid only when `closed` |
| `room-labels.ts:4` | Label "Room" | Area unchanged; kind word from the record (SP1c) |
| `plan-hit.ts:142`, `:444` | Reverse-order Room hit | Innermost (SP1c) |
| `room-membership.ts:31` | One witness or none | Innermost (SP1c) |
| `world-index-model.ts:37` | Rooms group | Kind and open-side count (SP1c) |
| `LayoutCardFields.svelte:209`, `split-planners.ts:162` | Membership by `wallId` | None |
| `drawing-planners.ts` `planWallDeletion`, `chain.ts:233` | Summary knows created and retired | Add kept-open, closed and merged (SP1c) |
| `project-model/src/units/validate.ts` | Validates Layout with the same codec | Inherits format 8; release test |

## 11. Index, Card, Paint scope, selection, visitor

- **Index.** One group. Rows read the kind word: **Room** when `virtualEdges` is empty, otherwise
  **Open space**. Wall rows keep their `room:` relation for open Spaces.
- **Card.** Kind line, Area from the compiled floor polygon, **Overhead: Closed | Open to sky**,
  Bounds as "3 walls · 1 open side". Open spaces list **Remove space**; Rooms do not.
- **Selection.** Floor or label click selects the Space, innermost first. A virtual edge is never a
  selection target; its handles exist only while its Space is selected. Whether a floor click
  selects in 3D today is still unverified (proposal's verify-first item 8) and is SP1c's first
  check.
- **Stage.** Open sides are a thin dashed ink line in Plan always, in 3D for the selected Space
  only.
- **Paint scope.** Space scope is the existing Layout query answering with the Space id. An open
  Space answers with its floor, its lid when `closed`, and the inner side of each boundary Wall. A
  virtual edge contributes no surface. A free-standing Wall inside the outline is not in scope.
  T2 needs no change.
- **Visitor.** Same compiled floor and Walls as the editor. No dashed line, no handle, no
  open-side count, no lid under `open-to-sky`. The parity test compares the visitor's Layout
  primitives against the editor's with editor-only streams removed.

## 12. Transactions and history

- One gesture is one F4 history entry: erase (with opening, merge or retirement), stroke (with
  closure), Remove space, overhead change, one handle drag.
- Undo and Redo restore snapshots and never re-run correspondence. Virtual edges allocate no ids.
  New anchor Junctions (SP1d) and born Rooms use the operation's capture, so Redo replays them.
- A refusal writes nothing and leaves no history entry.
- Determinism: for one baseline and one capture the result is byte-identical. Across captures the
  Space id, the Wall refs and the virtual-edge Junction pairs are identical.
- No session state is added. Handles and proposals are derived from the document and selection.

## 13. Implementation slices

SP1's approved acceptance is unchanged; it lands as four PRs so the format bump is isolated and the
reconciliation change is reviewable alone. One format-changing slice is in flight at a time.

| Slice | Delivers | Needs | Tier |
| --- | --- | --- | --- |
| **SP1a** Format and compile | §3.1–3.3, §4, §6 (data and compile only), §7, §8, the SP1a rows of §10. No planner produces an open Space yet | This plan approved | 2 |
| **SP1b** Lifecycle | §5 in full, behind a planner option `openSpaces: 'retire' \| 'keep'` defaulting to `retire` so the editor is unchanged | SP1a | 2 |
| **SP1c** Editor and visitor parity | Flips to `keep` and **deletes the option**; §11; consequence lines; **Remove space**; Overhead control | SP1b | 1 |
| **SP1d** Open-side handles | Mid-grip, end knobs, **Stops at *name***, red-dash refusal, partial-Wall absorption | SP1c, decision B2 | 1 |
| **SP2** Room tool | Space from partial Walls. Reuses the composer, I1–I8 and the overlap gate. Must decide how a booth uses a hall's own Wall side (I6 forbids sharing it) and whether dividing an open Space yields two Spaces (B3) | SP1d | 1 |
| **SP3** Space from a floor | Relaxes I1 to "or follows a region"; the outline is then the region's, not stored edges | SP1, V1 | 1 |

**Acceptance.**

- **SP1a.** Format 7 is refused; a format-8 document whose Rooms all have empty `virtualEdges` and
  `closed` overhead compiles byte-identically to its format-7 geometry (T1). A hand-built open
  fixture passes codec, compiler and certified index with the intended area (T2–T4). Every I-row
  has a refusing fixture. `open-to-sky` removes the lid and changes no other compiled record (T15).
- **SP1b.** Every row of §5.1 has a core test through the real planner. With the option at
  `retire`, the full existing suite is unchanged. The S2 harness is deleted.
- **SP1c.** The approved SP1 acceptance sentences for erase, redraw, last Wall, overhead and
  visitor hold in the running editor (focused manual browser QA). No reference to the planner
  option remains.
- **SP1d.** The approved sentences for the mid-grip, end knobs, **Stops at *name***, non-overlap
  and containment hold. A slide along a Wall is one history entry.

## 14. Tests that separate a correct design from one that only looks right

| # | Test | A superficial design fails because |
| --- | --- | --- |
| T1 | Format-8 enclosed documents: compiled geometry, cache keys and index equal format 7 across the existing fixture set | The new fields leak into keys or change Room order |
| T2 | S2's opened rectangle: codec, compiler **and** certified index all accept; area 24 m² | Compiles but is never certified, so every edit goes cold |
| T3 | S2's adjacent pair: 24 m², two edges, corner Junction present, one open side reported | Corner collapse to 12 m² (R0), or the Junction is pruned (F4) |
| T4 | `roomBoundaryPolygon` on the opened rectangle returns 24 m², at every caller | The helper is patched in one planner only (F1) |
| T5 | L-shaped Room, erase the Wall whose removal puts the old centroid outside the triangle of ref starts; then redraw | Witness evidence from the wrong polygon retires or mis-assigns the Space |
| T6 | Opposite Walls erased, then one redrawn, then the other: same id throughout | First-component authorization refuses the second closure (F3) |
| T7 | Open U whose free ends are dragged together so the Walls close with identical refs | M-3 settles by key without geometry; must still close correctly through evidence (F2) |
| T8 | Erase the Wall between an open Space and an enclosed Room | Two coincident virtual edges, or both retire, instead of one open Space |
| T9 | Close an open Space with a Wall bulging outside its virtual edge | A phantom lune Space, or the Space stays open inside a complete ring |
| T10 | Draw an independent Box partly over an open Space; move a Room onto one; duplicate onto one | Commits with overlap because only erase paths check I7 |
| T11 | Enclosed island Room inside a hall; erase the island's Wall, then the hall's | First is accepted (open inside enclosed); second follows B1 with stated words |
| T12 | Booth inside hall: an object placed in the booth belongs to the booth; a click selects the booth | Last-polygon-wins or two-witness rule picks the hall or nothing (F7) |
| T13 | Move a Junction on an open Space so its outline self-crosses | The delta fast path certifies it (F5) |
| T14 | Move an open Space with two Wall components | Half of it stays behind (F6) |
| T15 | Toggle Open to sky: only lid records differ; visitor has no lid | Ceiling elevation or Wall bounds shift |
| T16 | Erase the last Wall; Remove space; close fully: no Junction is left that nothing references, and none the operation did not release is touched | Orphan anchors accumulate, or a document-wide sweep deletes unrelated Junctions |
| T17 | Join at a Junction where an open side ends refuses; split of a boundary Wall keeps the outline | The Junction is dissolved and the Space fails to load |
| T18 | Undo and Redo of T2, T6, T8 and T9 restore exact canonical bytes; Redo with the same capture is byte-identical | Redo re-runs matching and picks another survivor |
| T19 | Visitor primitives for T2 contain no open-side symbol and no editor stream; a release round-trips at format 8 and a format-7 release is refused with the stated code | Dashed edges ship, or the visitor silently reinterprets |
| T20 | A format-8 payload with a virtual edge where no gap exists, a chain that revisits a Junction, and a Wall side used by two Spaces: each refuses with its own code | Greedy parsing accepts ambiguous orders |
| T21 | Erase a strongly curved Wall whose chord crosses another boundary Wall | Self-crossing outline is committed; must follow B1 |

## 15. Decisions for the owner

Blocking means the named slice cannot start without it.

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| **B1** | When opening would leave an invalid open Space (outline self-crosses, contains a Room or another open Space, or overlaps a neighbour): refuse the erase, or erase and retire the Space with the reason in the consequence line? | **Erase and retire, with words.** The Eraser always erases; the line is shown before commit; Undo restores. Refusal makes a Wall undeletable for a reason unrelated to the Wall | SP1b |
| **B2** | Sliding an open side's end along a Wall: split the Wall at release so the end is always a Junction, or add station-hosted ends? | **Split at release**, stated in the consequence line. Zero format cost and it reuses `planWallSplitAtPoint`. Cost: joints accumulate; they are ordinary joints that Join removes. Station ends bring partial Wall sides into every boundary consumer | SP1d only |
| **B3** | A Wall that encloses part of an open Space: closure wins and the remainder is unnamed, or the Space splits into a Room and an open space? | **Closure wins for SP1.** Splitting needs the remainder's cycle, which is planar work the carry rule avoids. SP2's Room tool names the remainder in one click; revisit there | SP1b |
| **B4** | SP1 lands as four PRs with handles last (SP1d), and the editor shows opened Rooms from SP1c before their sides can be dragged | **Yes.** No approved sentence is dropped; the data-loss fix ships two PRs earlier | SP1b onward |

Defaults taken without asking, reversible at review: overhead conflict on merge follows the
survivor (Q17 precedent) while thickness conflict keeps today's refusal; open sides are counted as
runs and never merged in data; a `closed` open Space keeps its full lid; virtual edges have no ids;
the collection and type keep the name Room.

## 16. Migration, rollback and seams

- **Migration.** None. Format 7 documents and any release published at 7 are refused by a format-8
  reader, as the standing pre-baseline rule requires. Public publication is still future work.
- **Rollback.** Reverting SP1a restores format 7 and refuses anything saved at 8. SP1b is inert at
  its default; SP1c is the behaviour switch and reverts alone. After SP1c, rollback loses open
  Spaces saved meanwhile; that is accepted under the same rule and stated in SP1c's PR.
- **T2 (S5a, J).** A Space's floor reference survives opening and closing because the record does.
  The lid reference is unresolved under `open-to-sky`; the joint plan owns what an unresolved
  reference does. Virtual edges publish no surface. Open merge needs a lineage row: the survivor's
  floor finish wins.
- **V1 and SP3.** Regions supply the second existence clause (I1), the surface key for I7, and the
  "Open to sky · under *name*" readout. V-plan decides what becomes of the two thickness fields.
- **X1 Lift.** Nothing to lift over an `open-to-sky` Space; the pill must not offer it.
- **R Unroll the room.** Strip order is composer order starting at the selected Wall; virtual edges
  are the labelled gaps.
- **C connected curves.** Erasing an arc of a round Room leaves a chord and clears Round, as the
  proposal already states. The round fact is a later field on the same record.
- **A1, A2, A5.** Split is unaffected; Join refuses at an open side's end; duplicating any Room
  must copy virtual edges.

## 17. Risks and limits

1. **Reconciliation is the most delicate module in layout-core** and SP1b changes its tail. The
   option at `retire` plus an unchanged existing suite is the containment.
2. **The chord rule changes area** when a curved Wall is erased. It is the approved "stated
   straight segment"; the consequence line is the mitigation.
3. **Split-at-release leaves joints** (B2).
4. **Closure-wins drops a remainder** without naming it until SP2 (B3).
5. **The index refuses Rooms with fewer than two refs** (`layout-world-index.ts:1457`), so a
   one-Wall open Space would never be certified. SP1a must confirm whether closed Walls already
   take the cold path here and decide the same for one-Wall Spaces.
6. **Nested floors are coincident.** A booth's generated floor lies in the hall's floor plane, as a
   nested Room's does today. What the Stage shows is unverified and is an SP1c check.
7. **Unreferenced-by-Wall Junctions** (open-side corners) are legal today and already snap
   candidates, but no surface has drawn them as part of a subject before.
8. **Nothing here was run.** Line references were read at `06f0d0df` and will drift.
