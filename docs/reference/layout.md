# Layout — architectural authority

**Owns:** architectural topology, levels, placed structures, reusable definitions, validated
alternatives, Walls/Junctions, Rooms/Spaces, hosted Openings, Horizontal Regions and the runtime-safe
representation. One canonical compiler produces geometry and query records. Representation consumes
that output; it never reconstructs a second topology or navigation authority.

## Wall-first model

The Wall is the authored primitive; its spatial role is derived. Walls in a closed enclosure bound
it, a Wall that encloses nothing is free-standing, and a Wall drawn across an enclosed Room divides
it. Room geometry stays derived and is never directly editable.

```text
Walls/Junctions → physical architecture + explicit connectivity
Rooms           → persistent semantic enclosed regions
Openings        → hosted by canonical Walls
Layout objects  → document-level / project-world-local
```

- **Junctions** are first-class, persisted nodes. A Wall's `centerline` is either a straight `line`
  between its endpoint Junctions or an explicit `cubic-chain` through them and its ordered interior
  bend points. Endpoints stay Junction-owned; the chain stores no endpoint point. Bend points carry
  stable identity; spans are positional (`spans.length === knots.length + 1`), one cubic each, and
  carry no identity. The persisted controls are the read-path authority: nothing re-derives or
  re-fits them, so subdivision and translation stay exact. Evaluating the stored cubics to render
  them is permitted.
- **Wall orientation** (start → end) is stable and identity-bearing because Opening `offset` is
  measured in metres from the canonical Wall start.
- **Connectivity is Junction ID equality, not proximity.** An explicit Junction snap or shared
  committed coordinate joins Walls. An unaccepted snap, a hover radius or a near miss connects
  nothing. Two independent Wall groups may occupy the same plan location or cross: the placement
  commits and creates no Junction, no shared Wall and no split. Within one connected component, a
  crossing, collinear overlap or self-intersection refuses.
- **Overlap is placement, not connection.** The editor may read "overlaps, not joined" on a
  coincident stretch; that is presentation state, never authored, serialized, in history or a
  validity rule, and it welds nothing.
- **A duplicate is a free island** with new ids for every copied Wall, Junction, Opening and Room.
  A copied door keeps position and size but not its relation to a Room outside the copy, and that
  dropped relation is named before placement.

**Commit identity.** Junction resolution is global: a draft endpoint within the `1e-9` identity
tolerance of any baseline Junction adopts that Junction's stored coordinate and ID. Retirement is
scoped: noding retires only coincident duplicate records participating in the committed
relationship, because a baseline already carrying two records for one node is a pre-existing defect
that a gesture must not silently rewrite. Snapping is separate: what connects is the committed
coordinate, so exact or near-exact unsnapped input can join an existing Junction deliberately. The
`1e-9` tolerance is coordinate identity only, never a screen-space acquisition or intersection
tolerance. Core and editor closure are distinct: the planner closes a chain implicitly when its
final point coincides with its first; the editor run closes by resolved Junction ID.

**Geometry envelope.** Authored Wall height/thickness, Opening offset/width/height/sill height and
each Wall span are limited to 1,000 m. A straight Wall is measured by its chord; a curved Wall by
its control-polygon length, which bounds its arc length. Junction positions are not dimensions, so
rigid translation remains unrestricted. Exactly 1,000 m is accepted; an over-limit edit refuses
without changing source or history, and canonical reads refuse an imported Layout before compilation
or Stage admission with a subject-specific issue.

**Vertical model.** `LayoutWall.height` is the Wall's **eave** and `LayoutWall.top` is its required
authored shape: `top(s) = height + rise(s)`, measured upward from the Floor elevation, so
`bottomY = floor.elevation` and `topY(s) = floor.elevation + wall.height + top.rise(s)`. `top` is one
of `level` (no payload), `slope` (`startRise`, `endRise`) or `gable` (`startRise`, `endRise`,
`apexRise`, `apexOffset`). Rise is at least `0`, linear in centerline **station** between
breakpoints, and the smallest end rise is exactly `0`, so `height` is always the lowest point of the
top and each shape has one encoding. A slope has one zero end and one end above the height epsilon;
a gable's apex must exceed both ends and lie inside the Wall's derived length
(`wall_top_apex_outside`, blocking). A closed Wall must be level (`closed_wall_level_only`).
`height + maximum rise` is within the geometry envelope, and an Opening must fit under the **lowest**
top over its own interval, not one scalar for the Wall. The compiled top profile exists only for a
non-level top, so a level Wall keeps its records, cache key and mesh buffers. Compiled Wall
sections still split only at Openings, never at the apex: a section's `topY` is the **maximum** of
the top over its span, so every height bound stays conservative, and a consumer needing the true
edge reads `topProfile` (the mesh adds the apex and any band crossing as clip knots). The Floor carries a
horizontal datum only (`id`, `name`, `elevation`, no vertical extent), so there is no Floor-relative
cap and a Room ceiling is the maximum of its boundary Wall heights. New Walls are `level`; new and
split Walls take `height` from layout-core's birth/inheritance rule: explicit height, else the unique
incident Wall height, else the named authoring default. `planSetWallTop` is the one top writer: it
normalises the stated rises to P1 by moving the lowest into `height`, and refuses P2/P3 values
(`wall_top_rise_invalid`, `wall_top_apex_invalid`), an apex outside the derived length
(`wall_top_apex_outside`), a closed Wall (`closed_wall_level_only`), the envelope and an Opening the
new top would no longer clear (`wall_top_below_opening`). `planExactWallHeight` keeps its signature
and shifts the whole top rigidly.

Split and crossing noding evaluate fragment ends in the source Wall's station frame and
re-normalise each fragment to its own lowest end. A cut within `WALL_TOP_STATION_EPSILON` (1 nm)
of a gable's apex takes the authored peak height at the cut and produces two slopes. A cut
farther from the apex produces a gable and a slope. If either fragment fails the rise or apex
tolerances, the split refuses atomically with `wall_top_split_degenerate`.
Join and dissolve require continuity within `WALL_HEIGHT_EPSILON` and one merged level, slope
or gable. The joint may be the gable's peak. A pair that cannot be merged refuses with
`wall_top_not_joinable`. A successful Split → Join preserves the top within the height epsilon
apart from the bounded apex station snap and produces deterministic canonical bytes. Undo and
Redo restore the captured authored bytes. Explicit Split and Join also refuse
`room_ceiling_changed` if a surviving Room's derived ceiling would move by more than the
height epsilon. Noding during Wall drawing, Space claims and open-side end slides may redefine
Rooms and move their ceilings. A length or Junction edit keeps `apexOffset` in metres and
refuses whole when the apex leaves the Wall.
Duplicate, Room move and bend/straighten carry the top unchanged, and P4 reads it on the new
centerline. Within a Round Room, member arcs may carry tops: repacking to one closed Wall still
requires every member level and equal (P5), and a radius edit scales each `apexOffset` with the
circumference exactly as it scales an Opening offset. Region fit-walls still refuses a profiled Wall
(`wall_top_profile_unsupported`) until V3's roof-form arithmetic. Region relations
and the roof fit read a Wall's top over each station interval the footprint covers, never the
continuous hull of disjoint intervals. The landed model
is one floor; a multi-floor payload is not accepted. Canonical reads accept format 11 only.

## Spaces (persisted Room records)

One persistent Room record is the product's **Space**. Room identity persists through
reconciliation; geometry remains derived.

- A Space is **enclosed** when `virtualEdges` is empty and **open** when it states virtual edges
  between existing Junctions. `boundary` remains the ordered Wall-side cycle.
- Virtual edges have no ids, height, thickness, Opening or surface and never take part in noding or
  connectivity. They are stated straight segments that close gaps between consecutive Walls.
- `composeSpaceBoundary` is the only place the mixed Wall/virtual order is parsed; its cycle key
  equals the boundary-cycle key for an enclosed Space.
- `overhead` is `closed` or `open-to-sky`. `open-to-sky` omits only the generated Room lid; Wall
  heights, the derived ceiling elevation, the floor and every Wall record stay. A `closed` Space
  keeps its lid over the whole outline. Generated Room floor and lid are zero-thickness planes.
  Room and query bounds span their elevations without slab padding.
- **Existence and reconciliation.** Open, re-close, split, duplicate and merge preserve existing
  Space identity, association and overhead rules. Division keeps the landed reconciliation: split
  survivor by evidence order, one Room born.
- **Validation.** The codec and compiler refuse a gap without enough virtual edges, an unmotivated
  virtual edge, a repeated Junction origin, a non-positive or self-crossing outline, and the overlap
  and containment rules: an open Space wholly inside an enclosed Room is the one admitted nesting
  (booth in hall); any other overlap refuses.
- The collection and type keep the name Room; `LayoutObject.roomId` and draft `connectsRoomIds`
  references are unchanged. An open Space's Wall rows keep their `room:` relation.

## Connected curves and closed circular Walls

- A **connected rotunda** is a ring of arc Walls whose identity is its Room. Arc-ring planning
  carries Room identity; it is not a second topology vocabulary.
- A **circular Room** is one ordinary Wall whose `startJunctionId` and `endJunctionId` are the same
  Junction, enclosing one persistent Room derived by the ordinary face and Room path and carrying
  `round: { center, radius }`. The single Junction is the canonical seam, authored at the rim point
  of the centre → rim gesture.
- The Wall is not a parametric circle object. Its persisted `centerline` is a `cubic-chain` of
  exactly 16 symmetric cubic spans (15 interior bend points). The codec rejects any other closed
  representation, a missing `round` fact on an enclosed closed circle, `round` on a virtual-edge or
  non-cubic boundary, and any chain whose controls fall outside the centre-local binary64
  uncertainty-aware certification bounds. Measured error at a 5 m reference radius is bounded at
  **3.4e-7 m radial** and **1.1e-6 m circumference**. All controls fit one seam phase and one
  ordered partition of the 16-span template; adjoining subspans share their cut parameter; a
  certificate with unresolved or collapsed cuts refuses.
- For Junction resolution, rounding explains a tangent continuation only when the stored centerline
  endpoints or cubic handles support antiparallel tangents. Wall thickness does not determine
  angular continuity.
- **Closed Walls are isolated.** A Wall may not connect at the seam, end on or attach to the circle,
  cross it or be noded onto it (`closed_wall_isolated`). Split and dissolve refuse; bending refuses
  (`closed_wall_not_bendable`). Walls wholly inside the circle are allowed. The seam keeps its
  identity through Save/Load; radius and centre are read from `room.round`, never inferred by
  fitting controls.
- **Rigid move** rebuilds the centre-local chain at the translated centre, adding the destination
  centre once per point; radius, seam station, bend-point ids and hosted Openings stay unchanged.
- **Radius edits** retain the seam angle and rebuild the chain at the new radius. Every hosted
  Opening keeps its angular station by scaling `offset` with the circumference and keeps its
  physical width. The whole edit refuses if an Opening no longer fits or would overlap; nothing is
  clamped.
- **Round authoring.** A selected Round Room reads **Room · Round** with Radius, Diameter, Area and
  the ordinary Room actions plus **Release round**. Radius and Diameter are one Room-owned writer:
  the Card field and the Stage's centre → seam ray submit the same `layout-round-room-radius`
  intent, so a typed value and a drag agree, and a drag previews the canonical planner on every
  move. A member arc reads **set by Radius**, hides Bend point and the geometry writers, and refuses
  bend/knot, straighten, length, angle and rim-Junction moves with **This wall is part of a round
  room. Change Radius, or release round.** Height, thickness, name and Opening edits remain
  ordinary. A Wall Card names each Room it bounds as **Go to <Room>**; a Round member that also
  separates an ordinary neighbour names both destinations. That action changes only the selection. **Release round** clears `room.round` on a ring and splits an isolated circle into two
  open arcs of the same locus; both are one undoable F.4 acceptance with captured correspondence.
  A Round Room's move carries its complete attached physical component, and Duplicate uses the A5
  enclosure copy with the seam mapped and fresh captured ids. Removing a Wall that clears the fact
  says **<name> stops being round.**

## Hosted Openings

- An Opening is hosted by a canonical Wall; interaction resolves from the **hosted relation** plus
  compiled intervals/profile — including the void and cut cap — never from boolean faces or
  nearest-face heuristics.
- `offset` is metres along the segment from the canonical start, never a sample index. Door-only
  `connectsRoomIds: [string, string]` relations are explicit and validated, never inferred from
  geometry; windows are unpaired.
- **Periodic hosts.** A closed Wall's seam is both station 0 and the circumference. One authored
  Opening record has one host, one `offset` in `[0, L)` and one `width < L`; the circumference is
  not a second spelling of the seam. An interval crossing the seam compiles into two derived
  intervals (before and after station 0) that share the Opening id, profile range and host. Plan
  strokes, mesh voids, door relations and picking consume both; selecting either fragment selects
  the one Opening. Sliding wraps continuously modulo `L`; same-Wall overlap validates modulo the
  circumference. An Opening as wide as the circumference, or one that aliases `L` as its offset,
  refuses.
- **Head-fixed arch rise.** Independent Opening arch rise with the head held is accepted
  vocabulary. Today rise derives from `width / 2` and the Wall top is one scalar height, so
  head-fixed rise needs coherent codec, profile sampling, validation, mesh and Section consumption;
  it is not a UI field alone. One authoritative Wall top definition with level as the current
  scalar case is a proposal, not an encoding.

## Wall development, Unroll and Face

The development map is the one runtime-safe Layout algorithm for flattening a Wall. It serves
straight, open multi-Bézier, S-curve, inflection and closed Walls from canonical samples; it is
never a second Wall model, writer or topology source.

- **Unroll is a session reading**, never authored data: it holds the Wall, canonical anchor station,
  closed-Wall display cut, displayed face and unroll amount. It is never serialized, never enters
  history, and Undo never changes it. The sheet is built from the same development map and samples
  as the Wall; Opening edits go through canonical planners.
- **Reference surface.** The development is isometric along the **centerline**. Stations, Opening
  offsets and widths, and Wall length are centerline quantities. Wall faces at a signed offset are
  not isometric: at full flattening both face polylines take the centerline's developed length, so
  the inner face stretches and the outer shrinks. No face length is labelled true; sheet dimensions
  are centerline stations.
- At amount 0 the map reproduces the canonical polyline and interpolation exactly. At amount 1 the
  centerline is a straight sheet where canonical station `s` sits `s − anchorStation` from the
  anchor; corrected per-segment lengths preserve that station map. Normals come from the developed
  centerline. Every developed vertex and triangle carries canonical station and source-span
  attribution, which inverse picking resolves back to canonical stations.
- An open Wall develops around its anchor. A closed Wall rotates the sheet so the display cut is at
  the sheet ends; its canonical seam remains station 0. The display cut is opposite the anchor,
  moved to the nearest solid Wall gap when it would fall inside an Opening; if the Wall is fully
  occupied, the raw cut is used. An Opening spanning the cut shows as two display fragments of one
  canonical Opening.
- `developmentOverlap` reports the first meeting stations on the developed centerline and its two
  offset faces for `0 < u < 1`; `u = 0` and `u = 1` are always safe. An overlap never adjusts the
  amount and is never written to the document.
- **Entry** uses the session pin when one exists, otherwise the selected Opening's centre when it is
  on the Wall, otherwise the station nearest the view centre, and always opens on the Room/Inside
  face. **Camera:** entry, scrub, peel, face change, pin and Opening edits do not move the Camera;
  Bring into view is the explicit framing action. Put back folds the sheet and writes no Camera
  intent. The reading never substitutes a nearby Wall.
- **Station identity.** Openings on the sheet are the as-built kit through the development map.
  Selection, slide, jamb resize, sill/head and Undo address the same canonical Opening id in
  canonical stations.
- **Faces** are named **Inside** and **Outside**. The face switch is a rigid half-turn of the sheet
  about the pin's vertical; the Camera does not move and stations stay canonical.
- Shape edits (centerline, bend point, body bend) refuse with a specific reason while unrolled;
  Opening placement/measures and Wall height remain canonical edits.
- **UI words:** Unroll, Put back, pin, bend point. Unfold, Refold, Flip, Done and Peel are not used.

**Face this wall** is one explicit Look action on the selected Wall, offered from the Card's `•••`
menu. Layout supplies the framed **bounds** and a horizontal **look** direction; camera-core's
`face` intent derives eye, target and distance and its evaluator realises them, so no UI component
writes the Camera. A folded Wall is faced at the station nearest the view centre, on the side the
settled eye is on; Plan has no eye and faces the Wall's left/Room face. A curved Wall is faced as one
plane at that station and framed by its whole extent as a face footprint — the extent moved so the
eye's side sits on the target plane, keeping the near station inside the same padding. While the
Unroll sheet is open the same action faces the displayed sheet. **Put back** returns the Camera to
the exact standpoint Face started from — pose and reading. One Face exists at a time; it is a
session reading, never serialized, never in history, never in Preview, a snapshot or a release.

## Horizontal Regions

A Horizontal Region is an independent, flat Layout slab with a counterclockwise polygon footprint,
datum-relative elevation and positive thickness. **A floor region's elevation is its top; an
overhead region's elevation is its underside.** The distinction is the elevation datum, not a
second kind. A Region can span Spaces or sit outside them; its volume may touch another region at a
boundary. Slabs with overlapping footprint interiors and elevation intervals refuse. Generated Room
planes remain derived at their own elevations and may coincide with a Region surface.

Layout compiles each Region once into bounds, Plan records and a closed slab shared by Stage and
Visitor representations. Top, underside and boundary edges have stable surface references. A Region
wins a coincident generated floor pick. Declared intentional gaps keep their Wall references through
topology splits and dissolves and lose the reference when that Wall is removed. No Room edit creates
a Region.

**Authoring.** **Terrace** creates a floor region and **Roof › Flat** an overhead region; other Roof
options are deferred. Both use Ink: **Box** names two plan corners, **Line** takes corner points
until Finish closes the ring. The Height Sheet supplies elevation; an overhead drawn at the Floor
datum takes the Wall creation default (3 m); a new Region starts **0.10 m** thick. Creation is one
captured, accepted Layout operation with the id derived from that capture; Undo removes it and Redo
reuses the id.

A selected Region's Card is its editor: kind, name, floor-relative and world elevation, thickness,
exact Width and Depth (scaled about the footprint bounds centre), Area and the derived **Relations**
list. Each related Wall reads **Meets**, **Crosses**, or a measured **Gap**, with that gap's one-shot
fit and **Mark intended**. Picking an edge adds **Add corner here**; the Card offers Space and Wall
fits and **Duplicate**. Corner knobs move footprint points and dragging one onto its neighbours'
chord removes it; the body drags to move, the turn mark rotates, and the height ray sets elevation.
A release is one accepted intent and one history entry; a refused or no-op release changes nothing.
Erase removes a Region and, for a floor Region, first discloses the derived count of Scene roots
resting on it — a read, never a Scene write.

Selected Region gaps are measured dimensions on Stage; an unselected Region draws no cue. **Lift**
consumes typed overhead sources, so a Flat Roof is lifted with Room lids, retains identity and is
addressed through its own outline in Plan and 3D. A lifted Region stays on `LIFTED_RENDER_LAYER`, and
every point, spot and sun shadow camera includes that layer. Put back ends the reading; Preview and
Look-through render as built. The Index groups Regions; a Space's Card lists Regions over it and
reads **Open to sky · under *name*** where a Flat Roof applies. Height Sheet ticks expose Region tops
and undersides.

**Surface references.** `resolveLayoutSurfaceReference` is the Layout-local geometry resolver. The
canonical tagged `LayoutSurfaceRef` names authored identities and fixed roles:
`{kind:'wall-side', wallId, side}`, `{kind:'room-floor', roomId}`, `{kind:'room-lid', roomId}` and
`{kind:'region-face', regionId, face}` where `face` is `top`, `underside` or `edge`. The authored
`resolveLayoutSurface` reads identity lifecycle only: a move, footprint, elevation or thickness edit
keeps a stable reference; deleting the subject retires it rather than redirecting to a coincident
successor. A closed Space lid resolves; an open-to-sky lid is dormant while its floor remains
present. `surfacesOfSpace` and `spaceOfSurface` read the oriented authored boundary for Wall-side
membership, each Space's floor and present lid, and whole-footprint containment for Region faces (a
face in several Spaces is ambiguous; a straddling Region is excluded and named).
`queryOverheadSupports` is the matching downward geometry query: closed lids and overhead-region
undersides; open-to-sky is no lid.

## Canonical compiler and representation

- `@portfolio/layout-core` owns the schema, validation, planning, the architectural compiler and
  the Plan representation. `LayoutDocumentWallFirst` is authored semantic CAD;
  `CompiledLayoutGeometry` is derived, cacheable, renderer-neutral and never serialized.
- **No consumer reconstructs topology.** Plan and unified 3D consume the same compile; no consumer
  resamples curves or reinterprets Opening topology. Junction resolution is derived in the same
  compile (network-aware, per-Wall attributed) and never serialized. Degree ≥ 3 Junction material is
  partitioned locally across all incident Walls: continuations suppress their shared interface,
  branches are trimmed against resolved Junction material, and every exposed Junction surface has
  one deterministic owner, so per-Wall meshes never rely on overlapping solids for closure. A
  Junction with no straight-through continuation pair (Y or star) is partitioned by its own
  equal-clearance sector beams; a configuration admitting no beam fails closed with a blocking
  `junction_partition_failed` issue and no mesh.
- No SVG strings, `THREE.*`, DOM, WebGL/WebGPU handles, materials, cameras or UI state below the
  layout boundary. The Three adapter owns buffers, materials, resource lifetime and raycast identity
  adaptation.
- **Do not deep-proxy compiled geometry through reactive session state.** Reuse and comparison work
  must measure the actual input the editor hands to the operation. Output equivalence alone does not
  establish a performance improvement; measure the candidate before adopting it.
- **Identity through Section and peel.** Every selectable derived primitive carries canonical source
  identity (`{sourceId, stream, subRef?}`, including outlines); there is no section-local entity
  identity. Selection belongs to canonical entities rather than a view, so a view transition may
  change handles but never identity. Peel is display-only: a seam-crossing Opening may show as two
  sheet fragments, but both select and edit one Opening. No merging on selectable streams; merging
  is allowed only in export paths with membership records preserved.
- **Finite depth** is a required derivation parameter with a finite default, never optional state a
  consumer may ignore. Lateral and vertical crop are range operations on the same derivation.
  Exclusion is reasoned: the single membership stage emits `outside-depth`, `outside-span`,
  `outside-crop`, `filtered-type` or `no-meaningful-projection`, and depth/crop exclusions surface a
  Reveal affordance that changes presentation and interaction eligibility for one source without
  touching depth or document history.

## Editing-path rules

These govern pointer preview, release, Undo/Redo, Open and retained roots.

| Path | Rule |
| --- | --- |
| **Pointer move → preview** | Capture the accepted baseline and affected set once. Draw transient geometry from Layout's proposal math. Reuse unchanged samples and use bounded canonical checks for live refusals. Treat unchecked proposals as pending. Keep full validation, Room reconciliation, document capture and history off the per-move path. Where canonical candidate Paper needs compilation, compile and build Paper once per **distinct candidate** through the canonical read (one whole compile per distinct candidate; an Opening Repeat proposal instead reads the planner's own delta through the project compile context), then reuse it while unchanged; never compile on an idle tick. Use the same snapped intent for preview and release. A still pointer builds at most once, compiles at most once and does no work after its first tick (`layout-candidate-memo`). |
| **Release → accepted edit** | Submit one exact intent to F.4. Validate through the canonical planner, certify the affected extent when supported and fall back to the full path when the proof is inconclusive. Share unchanged source and compiled roots and reuse the accepted result through admission. A valid release writes one history entry; cancellation or refusal writes none. |
| **Undo/Redo** | Restore the qualified immutable source and its retained geometry roots when they match. Update changed render entries and release replaced resources. Avoid revalidating, recompiling or rehashing a matching historical root. |
| **Open → usable Stage** | Validate and prepare the envelope once, then pass the qualified result to admission. Retain meshes by compiled identity, install changes in place, invalidate shadows only when their inputs change, and stop drawing at rest. Track admission and the first matching nonempty Stage presentation separately. Cold Open still has whole-project and render setup costs. |
| **Pan, pick and refresh** | Keep the evaluated Plan when its real inputs stay the same. Use a spatial pick index and maintain changed Plan sources from a certified compiler delta. Count work where it happens, including a lazy rebuild on the first pick after Open or commit. |

Keep deterministic checks at the **mounted gesture boundary**. Drive real pointer moves, assert the
preview changes without a full compile or history write, then check release installs the same
proposal once and Escape restores the accepted view. A large compile fixture checks the compiler, so
it cannot detect a Stage adapter calling it on every sample. Review the call sites that drive an
interaction whenever a planner is wired into a gesture; a correct planner called per pointer move
still makes the Stage choppy.

## Accepted future requirements

These preserve approved spatial depth. They are not claims that multi-level authoring,
arbitrary top profiles or Section are implemented; encodings remain proposals.

- **Vertical architecture.** One canonical compiler owns structure-local named datums, placed
  structures and independently identified roof, canopy, ceiling, slab and void elements. World-local
  placement has explicit qualified internal frames and never requires a Room frame. A structure
  initially supports translation and yaw; tilt, scale and reflection refuse until explicitly
  supported. Each structure has its own Junctions and datums. A connection between structures is
  declared, checked and reported broken after an incompatible edit; it never silently follows or
  shares a Junction across independently moving frames. A Wall has one base reference and one
  authoritative top definition (height, datum or supported roof-fit), with cycles refused. Floor
  steps belong to slabs. Rooms derive within a level context and never own overheads. Fitting is
  one-shot unless an explicit membership/following policy is accepted.
- **Section and representation.** Derivation splits typed primitives (**cut / projected / hidden /
  symbol**) with per-source tagging and styles at render. Nested Look/return, the view trail and
  document Undo are three separate things. A recipe records camera/framing/projection plus
  cut/depth/crops, side/station/peel, lift, mirror, Reveal and parent; different context kinds nest
  and same-kind hops replace the current level. View steps never enter document Undo and Undo does
  not navigate. An "undo these" exit summary is valid only for a verified contiguous,
  still-available suffix, invalidated by any new edit, Undo/Redo, replacement or history truncation.
  Exact return is guaranteed for still-valid references; invalidation unwinds to the nearest valid
  parent and is explained — never approximated or resolved by choosing a nearby entity.
- **Regions and deliberate gaps.** The Horizontal Region format records the slab's world elevation
  and explicit Wall lineage for intentional gaps. Fit and relation authoring follow the
  [T1 verticality plan](../plans/t1-spatial-world/v-plan-verticality.md).
- **Open presentation seams.** D5: any remaining presentation or recovery rule for an intermediate
  self-overlapping sheet is display-only and cannot change canonical periodic or seam identity.
  D6: exit-summary copy for the unavailable case and adaptive-teaching/instant/reduced-motion
  scheduling remain tunable; exact durations and thresholds are open.
