# T1 C-plan — Connected Curves

**Tier 2 · Proposed production contract for owner review.** Model B keeps the Room as the whole
and ordinary Walls as its components. A connected rotunda has an all-Wall arc ring, with Junction
ID equality as the only connectivity rule. C delivers the architecture and authoring parts of J6.
R owns the whole-room sheet. J/S5a owns durable finish bindings and is paused with T2.

Authority and evidence. [Approved T1 roadmap, #290](https://github.com/Biskiq/spatial-sketch-editor/pull/290) ·
[Connected curved architecture](./README.md#connected-curved-architecture) ·
[C acceptance](./implementation-prs.md#lane-d-depth) ·
[J6](./creator-journeys.md#j6-a-rotunda-at-the-end-of-a-gallery) ·
[S1 fixtures and results](./spikes/s1-connected-curves.md) ·
[Layout contract](../../../reference/components/layout.md) ·
[Persistence contract](../../../reference/components/persistence.md) ·
[Editing-path rules](../../../reference/components/layout-performance.md).

## 1. Established behavior and C's obligations

| Established in code or S1 | C must supply |
| --- | --- |
| An isolated closed Wall has one seam and a canonical 16-span cubic chain. The closed-Wall split rejects `closed_wall_isolated`. The open-Wall split keeps the start-side ID and subdivides the stored cubic. | An explicit closed-to-ring transaction before the ordinary open-Wall attachment path. Existing direct Split on a closed Wall keeps its refusal. |
| Real face extraction and reconciliation preserved the Room through S1's staged first split and the real second attachment. Rekeying both first fragments retired the Room even with the same face. | Keep a surviving Wall anchor in both directions and assert the intended Room correspondence. A named refusal replaces unexpected retirement or rebirth. |
| S1 carried Round in an external test record and simulated radius, repack and connected Duplicate. Its detached Opening was already on the seam fragment. | Store Round in the admitted Layout unit. Plan real whole-radius, repack/rehost and copy operations with one admission each. |
| Shipped group move moved two Rooms and their shared arc. Move refused with a dangling Wall and the isolated Duplicate planner refused a shared boundary. | Expand the Round move scope through physical attachments. Use the A5 enclosure-copy policy for connected Duplicate. |
| Production divide keeps a split survivor and erase currently retires an opened Room. S1 cleared its test record in both cases. Its test surface resolver stopped when Round cleared. | Clear through the real topology operation. Use SP1 for the opened Space's survival and resolve the interior from the surviving physical boundary, independent of Round. |
| S1 used the existing history stack over fixture bytes. | Exercise the real Stage/F4 acceptance, identity ledger, Save/Load and visitor paths. |

## 2. Layout source and the SP-plan sequence

C1 takes the **next admitted Layout version after SP1a**. The proposed sequence is format 7 →
format 8 in [SP-plan #305](https://github.com/Biskiq/spatial-sketch-editor/pull/305), then format 8 →
format 9 in C1 after SP1c. SP1 owns `virtualEdges`, `overhead`, the boundary composer, open-Space
carry and the overlap gate. C owns Round on the same record and consumes those rules. Land the
format changes serially. If another Layout bump lands between them, C1 takes the next version.
Use one `LAYOUT_WALL_FIRST_FORMAT_VERSION` as the source of both Layout payload and F2 Layout
unit-header version. The project envelope and other unit versions keep their existing contracts.

- Add the optional Room field `round?: { center: [x, z]; radius: number }`. Omit it for an
  ordinary Room or an open Space. Presence states Round. Coordinates are finite project-world
  X/Z in metres. Radius is finite and positive and must satisfy the closed-circle thickness and
  existing geometry-envelope checks for the resulting Walls. The Room Card reads the scalar
  directly. A Radius write stores the entered number and a Diameter write stores half the
  entered number. Geometry and load paths never infer Round from a fitted or near-circular ring.
- A Round Room is one enclosed positive face with zero virtual edges, bounded by either one
  canonical closed Wall or a simple cycle of open cubic Walls. Use the existing ordered
  `boundary` array to retain the seam. In face traversal order, its first oriented start
  Junction is the seam. Preserve that ordering for Round survivors by rotating the reconciled
  boundary to the captured seam, without changing winding or face key. The ordinary face key
  remains cyclic and rotation-independent. Copies map the seam through their Junction ID map.
  This adds no seam scalar, membership list or second boundary model. A plan that cannot
  retain the seam refuses while Round is stated.
- Certify that the existing stored cubics are the canonical circle or an exact partition of
  its 16-span template about the stated centre/radius. For the ring, traverse from its seam,
  unwrap endpoint angles about the stated centre and bracket each in the known 22.5°
  template span. Invert the monotone polar angle by bisection to
  `WALL_CURVE_SPLIT_PARAMETER_TOLERANCE` and compare all four control points against
  the subspan from de Casteljau. Snap a template boundary only under the canonical
  Junction coincidence rule. Require ordered, gap-free coverage once around the template.
  Compare in centre-local coordinates with the closed-circle consistency budget
  (`1e-9 × max(1, radius)` metres). This is a consistency check against explicit
  data. It never sets the fact, refits geometry, or supplies render cubics. Reject a fact on an
  open/straight/malformed boundary, a missing fact on the enclosed canonical closed circle,
  off-template controls, an unresolvable seam or nonrepresentable geometry with a typed
  Room/Wall issue. Keep validation out of per-pointer work.
- A format-7 or format-8 file, old draft or old Layout unit in an envelope is refused by the
  strict new reader. Keep one decoder and regenerate maintained fixtures, seed/demo data
  and authored test snapshots through canonical builders. Reauthor maintained isolated-circle
  fixtures with explicit centre/radius; no historical fit or runtime backfill. C1 updates
  every producer of a closed circle in the same PR, including isolated creation, edit, move
  and copy. Existing persisted documents from the previous format require the owner-controlled
  pre-baseline cutover; roll back source readers only with that incompatibility understood.
  Treat published snapshots separately under their current public contract. Check for
  deployed publications before activation and bring any durability exception to owner review.
  No deployment, reset or release-format change is part of C-plan.

## 3. Topology and deterministic lineage

### Attach

Use the existing draw intent with explicit host/Junction snaps. A near miss, independent
overlap or implicit crossing uses today's placement/refusal rules. For the first explicit
attachment, capture the closed Wall, Room and seam from the accepted baseline. Resolve
snapped stations on the original cubic chain, sort and deduplicate them by canonical station
and Junction identity, and partition once. Reuse the original seam Junction and keep the
original Wall ID on the fragment departing the seam in the original orientation. Capture the
new Wall/Junction IDs from operation ID, source ID and stable cut order. Keep controls, knot
IDs where they remain interior, Wall height, thickness and authored name. An attachment at
the seam alone needs a second cut because an attached closed Wall would still violate
isolation. Try the opposite station first. Otherwise enumerate the one-third, midpoint
and two-thirds stations of each maximal solid gap in increasing periodic distance from
the opposite station, breaking ties by lower forward station. Use the first candidate
passing the same split and Junction gates. Refuse if that bounded search finds none.
Release uses the same candidates, testing pairs in that order when the seam is occupied.

Feed the partition and exact Junction snaps into ordinary Wall-chain/noding and reconcile
once against the accepted pre-gesture baseline. No intermediate ring is installed. Later
off-seam attachments use the existing exact open split and keep each fragment's start-side
ID. Existing rim Junctions are reused as-is. One gesture may attach at both ends. Keep the
rotunda's ID, name, thicknesses, associations and overhead intent when its full boundary
survives through split lineage. A born gallery receives ordinary Room data. A valid chord
across the interior is a divide and takes the clearing path below.

### Detach and clear

- Removing an outside incident Wall or an adjoining enclosure preserves Round while an
  external attachment remains. On the transition from attached to zero outside Wall
  incidence, keep the seam Junction and the Wall departing it, retire the other arc IDs,
  and rebuild the canonical 16 spans from the stated centre/radius and seam ray. Reconcile
  through the surviving Wall. Do this inside the detach operation before final validation.
  Prune a retired Junction only after checking Wall and SP virtual-edge references.
- Repack only if all member heights, thicknesses and optional Wall names agree, all
  Openings and portal consequences can be represented, and no discarded Junction anchors
  another Space. A lossful last detach refuses the whole removal and names the conflict.
  The creator can equalize the attributes or **Release round** and retry. Detached
  enclosure copies are an explicit exception to automatic repack. They retain copied Wall
  segmentation and attributes, and unrelated edits never trigger a repack.
- Divide uses the existing deterministic split survivor and clears Round from the survivor
  and every born descendant. Erasing an exterior arc clears Round and hands the removed
  Wall to SP1's open-Space carry. When admitted, the same Space retains its ID, name,
  associations and overhead, and the removed arc becomes a straight virtual chord.
  If the chord fails SP1's outline or overlap gate, follow the owner-approved SP1 policy
  for refusal or retirement. Removing a shared arc follows SP1's merge policy and clears
  Round on any changed enclosure. Re-close of a previously opened Space leaves Round
  absent. The consequence line says **Rotunda stops being round** using the actual Room name.
- Release round on an open-arc ring clears the Room field only. Release of a one-Wall
  isolated circle first converts it to two ordinary open arcs of the same locus, so editing
  can actually proceed. Prefer the original seam and an admissible opposite cut. If a
  periodic Opening covers the seam, use two admissible cuts away from it and keep the old
  seam point as a knot on the fragment containing it. That fragment keeps the Wall ID.
  Use the same deterministic solid-station search and full validation as attachment.
  If the bounded search finds no legal pair, name the blocking Opening or Junction and offer moving or
  resizing the Opening. Release creates no incoming Wall and is one undoable operation.

For every operation emit operation-local correspondence keyed to authored IDs. Room
survival maps the same ID, subdivision maps the source Wall to its surviving fragment and
descendants in station order, repack maps every old arc to the surviving Wall in traversal
order, and a copy records each source-to-new ID without retiring the source. Record Opening
rehosts as same-ID moves. Reuse the existing identity ledger for births and retirements and
F4 correspondence for selection; the extra Wall-side mapping remains Layout-local until J.
Where a selected arc retires on repack, requalify to its survivor. Where a selected Room
survives opening, requalify to the same Space ID. Do not use proximity to transfer identity.

### Member edits

One Layout guard covers geometry-changing authoring and import/acceptance verification. Refuse
bend/knot move or removal, straighten, length, angle, rectangle resize, direct move of a rim
Junction or member arc, and movement of a neighbour that would drag a rim endpoint.
Return the Round Room and offending Wall/Junction with **This wall is part of a round room.
Change Radius, or release round.** Permit height, thickness, name and Opening edits that
pass the normal gates, exact open-arc subdivision, and a tangent non-seam join only when
the ordinary join rules and Round consistency check both hold. A join that would remove the
seam or a required Junction refuses. Divide, erase, Release, whole-radius and rigid
Room-group translation are explicit operation paths with the policies above. Apply the guard
at core proposal and commit entry points, including A1/A2 and fast geometry certifiers.

## 4. Radius, move and Duplicate

**Radius.** Resolve the Round Room and the set of unique rim Junctions. For new radius
`r1` and old radius `r0`, apply `center + (p - center) * (r1 / r0)` once per rim Junction,
knot and handle. The canonical isolated Wall retains its existing one-Wall encoding and
uses the same stated-centre rule. Ring membership, orientation, IDs and Room centre stay
fixed. Extend the closed-circle builder to take the stated radius and seam ray explicitly
for repack and consistency checking. Keep the existing centre-to-rim constructor as a
wrapper for drawing, where the gesture supplies the initial radius. Scale each ring Opening's near-edge offset by the ratio, wrapping only for a
closed host. Width, height, profile and sill stay fixed.

**Neighbours.** The touched set includes every Wall incident to a moved Junction,
their Openings and adjacent Rooms/Spaces, and any virtual edge using a moved Junction.
Straight neighbours follow shared endpoints. A curved non-ring neighbour uses today's
Junction-move rule for absolute controls and knots, so its moved endpoints stretch it
while its authored interior anchors stay fixed. Do not move a far Junction, refit a curve
or scale a neighbour's Opening. A second Round Room sharing an affected rim Junction
refuses and is named. C does not solve coupled radii. Use SP's composed outlines for affected
open Spaces. Accept only with unchanged Room membership/cycles and valid face geometry,
codec/dimensions, connected topology, Opening/portal relations, SP overlap and canonical
compilation. Report the affected Wall and first actionable issue (including the Opening
or other Room where relevant). Coincidence, crossing, degeneracy, invalid curve clearance,
face change or Opening failure returns no installable candidate, leaves Layout and history
untouched and never clamps the request. A same-radius input is a no-op.

**Move.** For a selected Round Room, extend `planWallFirstRoomMove` scope to the entire
physical connected component, including dangling and branched Walls. Close the scope
transitively over any Room/Space boundary that spans components under SP1. The preview
shows the full moving group. Move each Junction, curve control, associated supported
Layout object and each moved Round centre once. Openings and virtual edges follow their
hosts/anchors. Keep radius, orientation, topology, portal relations and IDs. Validate the
whole candidate and retain current read-only object and relation refusals. This is a
Round Room translation scope extension. Ordinary Room move retains SP1's policy. Layout
objects travel only by existing explicit Room association. Scene placement and Camera
targets continue through their existing owning-domain contracts.

**Duplicate.** Use A5's copy-enclosure operation once for the chosen Room. Copy each
boundary Wall, Junction, hosted Opening and explicitly associated supported Layout
object with fresh captured IDs. Copy Round with translated centre, exact radius and
the mapped seam; retain SP overhead, dimensions, profile and per-member Wall attributes.
An isolated closed source stays one closed Wall in its copy. A ring copy keeps its member
arcs even as a free island. It has no cloned annex Walls and no welded connections.
Clear a copied door's outside relation and name it in the **Drops** consequence. Preserve
the source relations. Reuse A5's proposal placement and **overlaps, not joined** cue.
Keep one isolated-copy and one connected-copy policy in Layout; C extends their Round
handling rather than simulating deletion/grafting.

## 5. Openings and the interior surface

Opening offset remains metres from the canonical host start to the near edge. One
Opening has one authored host and ID. On exact split, use resolved distances to place the
complete interval on one fragment. An interval ending at a cut stays on the preceding
fragment; one beginning there goes on the following fragment at offset zero, under the
existing split and clearance gates. A cut through an Opening's interior refuses and names
it. For a periodic closed host, unwrap the interval across the proposed cut set. First
attach keeps the original seam as a real cut, so a seam-crossing Opening blocks first
attach until moved to fit on one fragment. The isolated Opening remains selectable and
movable modulo circumference in the meantime. Release can choose cuts outside that
interval as specified above. Use the same interval arithmetic for either orientation;
an interval on a reversed member starts at `L - (offset + width)` in rim traversal.

On repack, concatenate oriented member lengths starting at the retained seam and rebase
each Opening into `[0, circumference)` on the canonical closed Wall. Preserve its world
interval to the existing cubic station tolerance, its ID and all physical/profile fields.
Do not reverse an asymmetric profile silently. If a reversed member requires a profile
orientation that the current model cannot express, refuse repack and name it. For a
periodic interval crossing the seam keep one record and let the compiler emit both
derived intervals. On open-arc placement or movement the interval stays on one Wall;
crossing a real Junction refuses rather than creating a second Opening or implicitly
rehousing it. The J6 door is created on the shared arc, with an explicit
`connectsRoomIds` pair for the two adjacent Rooms. Use the existing portal reconciler
to preserve/remap valid relations or disclose a drop when the relation no longer exists.
Never infer a portal from a void.

**Layout interior query.** Propose the aggregate authored reference
`{ roomId, role: 'inside' }`, qualified by the Layout unit at the boundary. Resolve ordered
physical Wall-side refs from the current Room/Space's oriented boundary and compiled
Wall IDs. In positive Room traversal, forward selects the Wall's left and reverse its
right. Exclude virtual edges and outside Walls. The same reference resolves through
attach, detach, move, resize, Release and opening a surviving Space. After divide it
describes the survivor's current interior; the other Room has its own reference.
After retirement it is unresolved, and a copy uses its new Room ID. This query describes
coverage, so it does not auto-inherit a finish onto a new divider. Split/attach descendants
inherit the source's respective sides, repack follows the seam-side survivor under Q17,
and Duplicate copies source coverage with the A5 new IDs. Name overwritten assignments
when J eventually consumes the join/repack lineage. C ships the Layout-only resolver and
core lineage evidence. J/S5a owns the published reference wire type, finish inheritance,
unresolved binding policy and a cross-unit history transaction. R can consume oriented
boundary order for Unroll; virtual gaps belong to R/SP and no T2 work blocks C.

## 6. Ownership and implementation slices

| Area | Module and responsibility |
| --- | --- |
| Layout source and derived facts | `packages/layout-core/src/layout-wall-first-types.ts`, `layout-wall-first-codec.ts`, `layout-circular-room.ts` and `layout-closed-wall.ts` own encoding, construction, exact read and isolated compatibility. Add `layout-round-room.ts` for Round boundary lookup, consistency checks, proposed transforms and operation guards. |
| Topology and identity | `layout-wall-chain.ts`, `layout-wall-chain-policy.ts`, `layout-wall-noding.ts` and `layout-wall-curve-algebra.ts` own captured attachments and subdivision. `layout-room-reconciliation.ts` owns correspondence, seam order and Round carry/clear alongside SP carry. `layout-wall-topology-ops.ts` owns detach/delete integration, `layout-wall-dissolve.ts` join restrictions. Use `layout-id-capture.ts` and `layout-identity.ts` at the existing capture/install boundary. |
| Geometry, Openings and scope | `layout-wall-first-precision.ts`, `layout-world-index.ts` and `layout-geometry.ts` enforce validation, touched sets and canonical compilation. `layout-opening-set.ts`, `layout-wall-openings.ts`, `layout-wall-portals.ts` and `layout-wall-development.ts` own intervals, relation checks and solid station handling. `layout-room-isolation.ts`, `layout-room-move.ts` and `layout-duplicate.ts` own move/copy. Put interior coverage next to `layout-geometry-queries.ts`. |
| Authoring | Under `apps/editor/src/lib/authoring`, `adapters/layout.adapter.ts` routes intents. `adapters/layout/drawing-planners.ts`, `chain.ts` and `snap.ts` capture explicit connections. `precision.ts`, `split-planners.ts`, `opening-planners.ts`, `candidate-preview.ts` and `refusals.ts` bridge proposal and commit. `LayoutCardFields.svelte`, `stage/room-labels.ts`, `stage/shell/world-index-model.ts` and the Plan/Stage selection providers read the canonical facts. |
| Admission and runtime | `apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts` and `stage/selection-requalification.ts` use one accepted candidate and captured correspondence. `packages/project-model/src/units/types.ts`, `validate.ts`, `canonical.ts`, `save.ts` and `runtime.ts` share the Layout codec and canonical bytes. API `src/save-persistence.ts` and `src/project-persistence.ts` use the existing source version seam. `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` and `lib/layout/wall-mesh-builder.ts` consume existing physical compiled primitives. |

| Slice | Deliverable and exit | Dependencies |
| --- | --- | --- |
| **C1 · Source and isolated circle** | Strict format bump, fact and seam contract, producer/validator cutover, regenerated fixtures and isolated precision parity. Older format refuses; unrelated geometry and isolated compiled shape retain parity. | C-plan owner approval, SP1a–SP1c |
| **C2 · Topology and radius core** | Pure attach/detach/Release and whole-radius planners, Round edit guards, rehosting and Layout interior coverage. Exercise the real core operations in the S1 matrix and the failure rows below. Keep new gesture dispatch out until C4. | C1, A1/A2 core rules, SP1 open/delete policy |
| **C3 · Move and copy core** | Round group scope with dangling Walls, A5 boundary-copy integration, capture and consequences. Test source/copy isolation and exact centre translation. | C2, A5; A4 alone covers only isolated copies |
| **C4 · Authoring and parity** | Wire the new intents, coverage and restrictions end to end. F4, Save/Load, Preview, visitor-runtime fixtures and owner J6 checks. Promote current contract wording at the corresponding implementation merges. | C2/C3; R and J/S5a remain separate |

The core planner boundary is accepted Layout + level + typed intent + capture → one
complete validated Layout candidate with affected IDs, correspondence and consequences,
or one typed refusal. Attach uses the chain intent and its explicit snaps. Delete uses
the existing Wall-delete intent. Radius takes Room ID and requested metres. Release
takes Room ID and capture. Move/copy take Room ID and world-X/Z delta, with capture on
copy. Every preview is a projection of the same planner's inputs and geometry transform.

Use one capture per gesture and the same snapped intent for preview and release. The Room
Card reads **Room · Round** with Radius, Diameter, Area and existing Room actions. The Stage
shows centre and one radius ray/knob. Floor and Index select the Room; a wall hit selects
the Wall with height, thickness, Openings, Unroll, Split, and a link to each Room it bounds.
Member Length reads **set by Radius**. **Release round** lives in the Room's scoped action
list. The isolated Wall Card's Radius/Diameter dispatches to the same Room-owned edit.
Render drag proposals from Layout's touched geometry with existing transient overlays.
Use bounded preflight or pending feedback while dragging and full canonical validation at
release. Keep preview work outside source and history; a stale accepted baseline, cancelled
gesture or refusal writes nothing. Accepted edits go through one F4 install including the
Layout unit, identity delta and correspondence. Undo/Redo restore accepted canonical
contents and captured IDs, with the coordinator's normal fresh acceptance revision.

Save, load and editable export use the same codec and unit-version admission. Drive Preview
and the visitor runtime test harness from the accepted source and compare physical meshes,
floors, lids, Opening intervals and portal adjacency against the editor's compiled output.
The current API publication write returns `prepared-reader-required` and public delivery
is gated on T4's prepared reader. Keep that gate; a live publish round trip is outside C.
Add the Round fixture to prepared-release parity when T4 has a runnable lowering path.
Keep editor-only Round marks, controls, selection, overlap cues, history and SP virtual-edge
symbols out of visitor imports and published draw streams.

## 7. Acceptance and regression matrix

| Gate | Required evidence |
| --- | --- |
| Source and codec | Positive closed/ring round trips, exact authored radius and anchored seam after Save/Load; reject old payload/header versions and mismatches, missing isolated fact, bad values, virtual-edge Round, off-template controls and false Round on a noncircular Room. An identical released ring is ordinary. Ordinary Layout fixture geometry and the existing publication gate remain unchanged. |
| Subdivision and identity | Shipped planners replace S1 staging at 1, 2 and 4 snaps. Match original cubic locus and 5 m radial/length budgets, retain untouched spans, and exercise seam-only, two snaps in one stroke, existing Junction, array-order permutations and independent overlap. Check start-side Wall lineage and stable Room name/ID/associations. Keep the all-rekey falsifier. |
| Resize | All rim Junctions and controls, straight and curved neighbours, one and two moved endpoints, a virtual-edge neighbour, and the near-edge Opening station. Fail whole on neighbour Opening fit, topology/crossing/clearance, another Round Room and SP overlap. Assert issue target, unchanged source bytes/ledger, no history entry and no invalid preview install. |
| Openings and topology | Split at start/end and through an Opening; real rehost from later/reversed members to a closed host with same IDs and profile; periodic boundary cases; blocked first attach at occupied seam; isolated Release with an occupied seam and with no admissible cuts. Cover uniform and mixed-attribute last detach, surviving SP anchors, shared erase/merge, divide, exterior erase-to-chord, SP invalid chord policy and ordinary re-close. |
| Move and copy | Group translation with a dangling branch and shared arc, virtual-linked group, exact centre/radius, valid relations and atomic refusal. A5 detached copy keeps per-arc attributes and all hosted Openings with new IDs, drops only external relations with words, keeps source and annex, and does not weld. Verify the isolated one-Wall copy as well. |
| Interior and acceptance | One reference before and after each attach, oriented shared side including reversed Wall, Release, detach, survivor/open Space and retirement. Real F4 and adapter tests cover each operation's Undo/Redo and selection, stale refusal, one history entry and canonical bytes through Save/Load. J6 editor walkthrough includes the shared door, radius success/refusal, member refusal and Release. Visitor parity checks physical output, portal relation and absence of editor imports. R covers the whole-room sheet; T2 covers cross-unit paint. |

Keep the S1 report and its original executable snapshot intact in PR #304. In implementation,
port its assertions to production contracts as the format and APIs replace its staged paths.
Add production cases beside the existing Layout circular-room,
noding, Opening, room-move, duplicate and wall-delete contracts; add adapter/F4 cases beside
the circle and unit-acceptance suites. Run the affected contracts, package and editor checks
and repo CI merge gate for each slice. The format PR also runs DB-backed API tests for
version refusal, Save/Load and unchanged publication gating. C4 uses a focused manual J6 walkthrough
and the existing visitor boundary tests.

## 8. Decisions for Tier 2 review

| Risk or decision | Recommended resolution |
| --- | --- |
| Competing format changes and existing projects | Land SP1's format and open behavior first, then one strict C bump. Confirm the active format, public snapshot policy and owner-controlled activation before C1. |
| Seam order and numeric validation | Anchor the Round boundary at the existing seam in authored array order; keep face keys cyclic. Prove exact partition, repeated edits and large-coordinate behavior in C1/C2. Refuse when the geometry cannot be represented reliably. |
| Lossy canonical repack and seam-crossing Openings | Refuse lossy last detach and blocked attachment with actionable subjects. Keep single-host intervals. Use the safe-cut Release path and keep enclosure-copy segmentation to preserve A5 attributes. |
| Neighbour scope | Use current endpoint semantics for radius, with atomic refusal on a second Round owner. Translate the full attached component for Round Room move. Confirm both in C2/C3 fixtures before exposing gestures. |
| Open Space and surface coordination | Inherit SP1's invalid-chord decision and keep C's physical interior query live for a surviving Space. Defer durable bindings, divider finish inheritance and cross-unit undo to J/S5a when T2 resumes. |
