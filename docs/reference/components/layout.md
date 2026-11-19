# Layout

**Owns:** architecture, topology, Walls/Junctions, reconciled Rooms, hosted Openings,
levels/structures/architectural definitions and validated alternatives. One canonical compiler
produces geometry and query records. Runtime-safe representation consumes that output; it never
reconstructs a second topology or navigation authority.

## Current contract

Layout format 9 is wall-first. Wall role is derived. Every closed ring encloses. A free-standing
Wall encloses nothing; a dividing Wall creates reconciled Room topology. Room identity is persistent
through reconciliation, while Room geometry remains derived and is never directly editable.
Authored placement is world-local with explicit internal frames, without mandatory Room ownership.
[Editing-path rules](layout-performance.md) govern previews, commit and retained roots.

Format 9 is the only recognized version. Source always includes a `regions` collection and a
`regions` map in the identity ledger whenever the ledger is present. Every Room carries the required `virtualEdges` and
`overhead` fields; an enclosed Room has no virtual edges, and an open Space states the straight
segments that close its Wall gaps. The reader refuses every other declared version strictly, with
no migration and no second decoder: a format-8 payload fails as `unsupported_format_version`.

## Open Spaces

One persistent Room record is the product's **Space**. A Space is enclosed when `virtualEdges` is
empty, and open when it states virtual edges between existing Junctions. Wall order stays persisted;
`composeSpaceBoundary` is the only place the mixed Wall/virtual order is parsed, and its cycle key
equals today's boundary-cycle key for an enclosed Space. Virtual edges have no ids, height,
thickness, Opening or surface and never take part in noding or connectivity.

The compiler builds the outline from Wall samples plus the virtual edges' Junction endpoints. Floor
polygon, area and bounds come from that composed outline; compiled Walls, Openings, Wall bounds and
Wall query records come from the Walls only. The codec and compiler refuse a gap without enough virtual edges,
an unmotivated virtual edge, a repeated Junction origin, a non-positive or self-crossing outline,
and an overlap or containment that I7 forbids (an open Space wholly inside an enclosed Room is the
one admitted nesting).

`overhead: 'open-to-sky'` omits the generated Room lid. Wall heights, the derived
`ceilingElevation`, the floor and every Wall record stay. A `closed` Space keeps its lid over
the whole outline. The generated Room floor and lid are zero-thickness planes. Room
and query bounds span their elevations without slab padding. Open, re-close, split, duplicate
and merge preserve their existing Space identity, association and overhead rules.

The collection and type keep the name Room; `LayoutObject.roomId` and draft `connectsRoomIds`
references are unchanged. An open Space's Wall rows keep their `room:` relation. SP1a changes the
format and the compiler only: no creator-facing operation produces an open Space yet.

## Closed circular Walls

A circular Room is **one ordinary Wall** whose `startJunctionId` and `endJunctionId` are the same
Junction, enclosing **one persistent Room** derived by the ordinary face and Room path. The single
Junction is the canonical seam, authored at the rim point of the centre → rim gesture. The Wall is
not a parametric circle object and there is no second circle geometry vocabulary: its persisted
`centerline` is a `cubic-chain` of exactly 16 symmetric cubic spans (15 interior bend points). The
codec rejects any other closed representation and any chain that is not the canonical symmetric
circle; its measured error at a 5 m reference radius is bounded at 3.4e-7 m radial and 1.1e-6 m
circumference.

Closed Walls are isolated. A Wall may not connect at the seam, end on or attach to the circle,
cross it, or be noded onto it; each refuses as `closed_wall_isolated`. Split and dissolve refuse,
and bending refuses as `closed_wall_not_bendable`. Walls wholly inside the circle are allowed. The
seam keeps its identity through Save/Load; radius and diameter are read from the persisted chain,
not remembered gesture state.

- **Rigid move.** A body drag translates the seam Junction and the whole chain by the same delta.
  Radius, seam station, bend-point ids and every hosted Opening stay unchanged.
- **Radius edits.** A Card radius or diameter edit retains the seam angle and rebuilds the canonical
  chain at the new radius. Every hosted Opening keeps its angular station by scaling `offset` with
  the circumference, and keeps its physical width. The whole edit refuses if an Opening no longer
  fits or would overlap; nothing is clamped.
- **Display cut.** A closed Wall's Unroll sheet is cut at the station opposite the anchor, not at
  the canonical seam. If that station falls inside an Opening, the cut moves to the nearest solid
  Wall gap so the peel edge is real Wall; if the whole Wall is occupied, the raw cut is used. The
  seam remains station 0 and is drawn as a tick; an Opening that still spans the cut is two display
  fragments of one canonical Opening.

## Periodic Openings on a closed Wall

A closed Wall is periodic: its seam is both station 0 and the circumference. The authored Opening
remains one record with one host, one `offset` in `[0, L)` and one `width < L`; the circumference
itself is not a second spelling of the seam. An interval that crosses the seam compiles into two
derived intervals (before and after station 0) that share the same Opening id, profile range and
host. Plan strokes, mesh voids, door relations and picking consume both intervals; selecting either
fragment selects the one Opening. Sliding wraps continuously modulo `L`, and same-Wall overlap is
validated modulo the circumference. An Opening as wide as the circumference, or one that aliases
`L` as its offset, refuses.

## Wall development and the Unroll reading

The development map is the one runtime-safe Layout algorithm for flattening a Wall. It serves
straight, open multi-Bézier, S-curve, inflection and closed Walls from the canonical samples; it is
never a second Wall model, writer or topology source. Unroll is a **session reading**, never
authored data: it holds the Wall, canonical anchor station, closed-Wall display cut, displayed face
and unroll amount. It is never serialized, never enters history and Undo never changes it. The sheet
is built from the same development map and samples as the Wall; Opening edits go through the
existing canonical planners.

Lift is the second **session reading**. It lifts a Room's generated overhead out of the view and the
pointer and holds only its scope — Everything, or one Space — so the creator can read and edit
inside. Like Unroll it is never serialized, never enters history and Undo never changes it; Plan
keeps it, Preview never shows it, and a snapshot is drawn as built. The lifted overhead is selected
through its Room, because a generated lid has no subject of its own.

**Reference surface.** The development is isometric along the **centerline**. Stations, Opening
offsets and widths, and Wall length are centerline quantities and read true at every amount. Wall
faces at a signed offset are not isometric: at full flattening both face polylines take the
centerline's developed length, so the inner face stretches and the outer face shrinks. No face
length is labelled as true; dimensions on the sheet are centerline stations.

At amount 0 the map reproduces the canonical polyline and its interpolation exactly. At amount 1
the centerline is a straight sheet on which canonical station `s` sits `s − anchorStation` from the
anchor; corrected per-segment lengths preserve that station map. Normals come from the developed
centerline. Every developed vertex and triangle carries canonical station and source-span
attribution, which is what inverse picking resolves back into canonical stations; there is no
second authored set of stations.

An open Wall develops around its anchor. A closed Wall rotates the sheet so the display cut is at
the sheet ends; its canonical seam remains station 0. Intermediate amounts are display state only.
`developmentOverlap` reports the first meeting stations on the developed centerline and its two
offset faces for `0 < u < 1`; `u = 0` (canonical) and `u = 1` (straight band) are always safe. An
overlap never adjusts the amount automatically and is never written to the document.

- **Entry.** The Card's Unroll block is available on curved and closed Walls; a straight Wall is
  already flat and its entry is disabled. Entry uses the session pin when one exists, otherwise
  the selected Opening's centre when it is on the Wall, otherwise the station nearest the view
  centre, and always opens on the Room/Inside face.
- **Camera.** Entry, scrub, peel, face change, pin and Opening edits do not move the Camera; Bring
  into view is the explicit framing action. Put back folds the sheet and writes no Camera intent.
  The reading never substitutes a nearby Wall when its own Wall is no longer present.
- **Station identity.** Openings on the sheet are the as-built Opening kit through the development
  map. Selection, slide, jamb resize, sill/head and Undo address the same canonical Opening id in
  canonical stations. An Opening that spans the sheet's display cut shows as two fragments of one
  entity.
- **Faces.** The sheet opens on the Room/Inside face. The face switch is a rigid half-turn of the
  sheet about the pin's vertical; the Camera does not move and stations stay canonical. The UI
  names the faces **Inside** and **Outside**.
- **Shape edits.** Centerline, bend-point and body-bend edits are refused with a specific reason
  while the Wall is unrolled. Opening placement, Opening measures and Wall height remain canonical
  edits.
- **Exit.** Put back ends the reading. The reading leaves no history entry. **Unroll**,
  **Put back**, **pin** and **bend point** are the UI words; Unfold, Refold, Flip, Done and Peel
  are not.

## Facing a Wall

**Face this wall** is one explicit Look action on the selected Wall, offered from the Card's `•••`
menu. Layout supplies the framed **bounds** and a horizontal **look** direction; camera-core's
`face` intent derives the eye, target and distance, and its evaluator realises them, so no UI
component writes the Camera. A folded Wall is faced at the station nearest the view centre, on the
side the settled eye is on; the Plan reading has no eye and faces the Wall's left/Room face. A
curved Wall is faced as one plane at that station and framed by its whole extent as a face
footprint — the extent moved so the side the eye is on sits on the target plane, which keeps the
near station inside the same padding instead of magnifying it past the frame. That is still a
conservative frame that keeps the Wall body in view, not an exact elevation.

While the Wall's Unroll sheet is open the same action faces the **displayed sheet**: its displayed
extent at the current peel amount and side angle, square to the displayed face at the pin. Facing
changes no peel, pin or Wall.

**Put back** returns the Camera to the exact standpoint Face started from — pose and reading — and
is the action offered while that Wall is the faced one. One Face exists at a time. It is a session
reading: never serialized, never in history, Undo does not change it, and it never reaches Preview,
a snapshot or a release. Entering Unroll never invokes Face; entry preserves the current view.

## Overlap is placement, not connection

Junction ID equality is the only connectivity fact. Proximity may suggest a snap, but an
unaccepted snap or a near miss connects nothing; an explicit Junction snap or shared committed
coordinate is what joins Walls. Two independent Wall groups may occupy the same plan location or
cross: the placement commits, and it creates no Junction, no shared Wall and no Wall split, and no
existing Wall is welded or cleaned up automatically. A duplicate is such a free island, with new
ids for every copied Wall, Junction, Opening and Room. Within one connected component, a crossing,
collinear overlap or self-intersection still refuses. A closed Wall's contact rules are the
isolation refusals above.

**The overlap cue.** The editor derives where a Wall of one connected component rests on a Wall of
another and reads **overlaps, not joined** on the coincident stretch. It is presentation state:
never authored, never serialized, never in history and never a validity rule. It clears when the
coincidence ends, and it welds nothing. A Room's Duplicate copies its complete boundary enclosure
even when a boundary Wall is shared with another Room; the copy is a free island and the source
architecture is untouched. A copied door keeps its position and size but not its relation to a Room
outside the copy, and that dropped relation is named before the copy is placed.

## Accepted future requirements and open mechanisms

The requirements below preserve approved spatial depth. They are not claims that Section,
arbitrary top profiles or multi-level authoring are implemented.
Encoding and unresolved choices remain explicit; current shell limits do not narrow approved
design. Prototype mechanisms are evidence, not schemas.


## Head-fixed arch rise and independent overhead-region intent

Retain the accepted vocabulary: level/slope/gable Wall tops measured along the Wall;
**independent Opening arch rise with the head held**; independent Layout-owned CeilingRegions
with closure versus suspended intent; simple flat/shed/gable overhead forms.

Today's archive derives rise from `width / 2` and the Wall top is one scalar height, so
head-fixed rise cannot be added as a UI field alone: it needs coherent codec, profile sampling,
validation, mesh and Section consumption. Proposed schema direction — one authoritative Wall
top definition with level as the current scalar case — is a **proposal**, and this record
**asserts no encoding** for either mechanism.


## Typed cut / projected / hidden representation streams with source correspondence

Derivation must split data into typed primitives (**cut / projected / hidden / symbol**) with
per-source tagging, and style them at render. Two independent predecessor codebases fail their
identity contract at a later **merge/flatten** stage, so #115 carries the rule as a hard v1
constraint: **no merging on selectable streams**; merging is allowed only in export paths and
only with membership records preserved.


## Hosted Opening identity

Opening interaction must resolve from the **hosted relation** plus compiled intervals/profile —
including the void and cut cap — never from boolean faces or nearest-face heuristics. The
umbrella's closed-Wall extension carries this to periodic hosts: one seam-crossing Opening stays
**one entity** with multiple derived intervals, one complete profile range and one host.


## Source identity through Section and peel

Every selectable derived primitive carries canonical source identity (`{sourceId, stream,
subRef?}`, including outlines), and there is no section-local entity identity. Selection state
belongs to canonical entities rather than a view, so a view transition may change handles but
never identity. Peel is a **display-only** transform: a chosen display cut may show a
seam-crossing Opening in two sheet fragments, but both select and edit one Opening, and partial
or full peel changes no radius, Junction, persisted station or semantic identity.


## Finite depth affects geometry and membership

Finite depth is a **required derivation parameter with a finite default**, never optional state a
consumer may ignore. Lateral and vertical crop are range operations on the same single
derivation. Exclusion is **reasoned**: the single membership stage emits codes
(`outside-depth`, `outside-span`, `outside-crop`, `filtered-type`, `no-meaningful-projection`),
and depth/crop exclusions surface a Reveal affordance that changes presentation and interaction
eligibility for one source without touching depth or document history. Silent exclusion is the
shared failure of both predecessor codebases.


## Nested Look/return kept separate from document Undo

Contextual nesting, the view trail and document Undo are three separate things. A recipe records
the exact camera/framing/projection plus cut/depth/crops, side/station/peel, lift, mirror,
Reveal and parent; different context kinds nest and same-kind hops replace the current level.
Document Undo stays the chronological Scene/Layout history: **view steps do not enter it, and
Undo does not navigate.** An "undo these" exit-summary action is valid only for a verified
contiguous, still-available suffix, invalidated by any new edit, Undo/Redo, replacement or
history truncation. Exact return is guaranteed for still-valid references; invalidation unwinds
to the nearest valid parent and is explained — never silently approximated, and never resolved
by choosing a nearby entity.


## Focused mechanisms carried forward

- **D2 and D3 — datum and intentional gaps.** The Horizontal Region format records the slab's
  world elevation and explicit Wall lineage for intentional gaps. Fit and relation authoring
  follow the [verticality plan](../../roadmap/t1-spatial-world/next-batch/v-plan-verticality.md).
- **D5 — crop, cut-only, seam and ambiguous inverse.** The closed-Wall display cut is settled:
  opposite the anchor, moved to the nearest solid Wall gap when it would fall inside an Opening,
  with the canonical seam at station 0. Any remaining presentation or recovery rule for an
  intermediate sheet that self-overlaps is display-only and cannot change canonical periodic or
  seam identity. Open.
- **D6 — exit summary and motion UX.** Keep the separate histories and exact return; validate the
  "undo these" suffix; choose copy for the unavailable case. Adaptive teaching / instant /
  reduced-motion policy schedules the same transition and end state; exact durations and
  thresholds are tunable. Open.


## Horizontal Regions

A Horizontal Region is an independent, flat Layout slab with a counterclockwise polygon
footprint, datum-relative elevation and positive thickness. A floor region's elevation is its top.
An overhead region's elevation is its underside. A Region can span Spaces or sit outside
them. Its volume can touch another region at a boundary. Slabs with overlapping
footprint interiors and elevation intervals are refused. Generated Room planes remain
derived at their own elevations and may coincide with a Region surface.

Layout compiles each Region once into bounds, Plan records and a closed slab shared by
the Stage and Visitor representations. Top, underside and boundary edges have
stable surface references. A Region wins a coincident generated floor pick. Declared
intentional gaps keep their Wall references through topology splits and dissolves and
lose the reference when that Wall is removed. No Room edit creates a Region.

### Authoring a Region

**Terrace** creates a floor region and **Roof › Flat** an overhead region; the Roof options
other than Flat are deferred. Both use the existing Ink grammar: **Box** names two plan corners,
and **Line** takes corner points until Finish closes the ring. The Height Sheet supplies the
elevation, an overhead drawn at the Floor datum takes the Wall creation default (3 m), and a new
Region starts 0.10 m thick. Creation is one captured, accepted Layout operation with the
region's id derived from that capture; Undo removes it and Redo reuses the id.

A selected Region's Card is its editor surface: kind, name, floor-relative and world elevation,
thickness, exact Width and Depth (scaled about the footprint's bounds centre), Area, and the
derived **Relations** list. Each related Wall reads **Meets**, **Crosses**, or a measured **Gap**,
with that gap's one-shot fit and **Mark intended**; intentional gaps keep their Wall reference
through topology edits. The selected edge's scoped actions offer **Add corner here**; the Card
offers both Space and Wall fits where they apply, and **Duplicate**. Corner knobs move footprint points and
dragging one onto its neighbours' chord removes it; the body drags to move, the turn mark
rotates, and the height ray sets elevation. A release is one accepted intent and one history
entry; a refused or no-op release changes no document. Erase removes a Region and, for a floor
Region, first discloses the derived count of Scene roots resting on it — a read, never a Scene
write.

The selected Region's gaps are measured dimensions on the Stage; an unselected Region draws no
cue. **Lift** consumes the typed overhead sources, so a Flat Roof is lifted with Room lids,
retains its identity, and is addressed through its own outline in Plan and 3D. A lifted Region
stays on `LIFTED_RENDER_LAYER`, and every point, spot and sun shadow camera includes that layer,
so Lift changes what the Stage camera draws without removing the overhead's shadow. Put back
ends the reading, and Preview and Look-through render as built with no Lift state. The Index
groups Regions, and a Space's Card lists the Regions over it and reads **Open to sky · under
*name*** where a Flat Roof applies. Height Sheet ticks expose Region tops and undersides.

`resolveLayoutSurfaceReference` is the Layout-local resolver for those references:
a region `top`, `underside` or `edge`, or a Space `floor` or `lid`. It resolves the
authored identity plus face against canonical compiled output, so move, footprint,
elevation and thickness edits keep the same reference valid; deleting the subject
leaves it unresolved (`missing-region`/`missing-space`) rather than resolving a
coincident successor. A closed Space's generated lid resolves; an open-to-sky lid is
`open-to-sky` while its floor still resolves. The matching downward query is
`queryOverheadSupports`, which reports closed lids and overhead-region undersides and
treats open-to-sky as no lid.

## Input and validation

Exact numeric fields must never announce invalidity for a legal value because their step base and
minimum disagree. Selectable Plan streams preserve canonical source membership; export-only merging
must preserve membership records. Editor and visitor render the same canonical geometry.

## Build — World architecture

Build creates and refines canonical architecture using Plan for construction and
any legible standpoint for precision. The shipped, closed P23 foundation is
**current**: wall-first, first-class Junctions/Walls, Wall-hosted Openings,
boundary/partition roles and persistent Rooms reconciled over derived
boundary-Wall faces, with world-local Layout objects.

**Destination (re-derived under F as track T1).** One continuous spatial world:
Plan↔3D authoring, contextual representations, circular/vertical architecture,
sections and peeling, level-qualified contexts, and runtime-safe Layout
representation evaluation. The accepted P26 prototype — the **Spatial Authoring
Prototype** at `prototypes/spatial-authoring/` — keeps journeys A–F as the
experience/QA authority for this direction (recorded in the
[T1 spatial-world evidence](../components/layout.md);
family boundary →
[`prototypes/README.md`](../../../prototypes/README.md)); its architecture is
re-derived from F, not inherited, and its implementation shortcuts are not
production contracts. Multi-level UI and visitor reveal authoring may ship later,
but their semantic ownership and runtime boundary are established now. The old
editor-only and single-floor restrictions are superseded.

**Wall role is derived (destination, owner ruling 2026-10-03).** The Wall is the
authored primitive. Creators draw spatial geometry; whether a Wall bounds an
enclosure, divides a room or stands free is derived from the resulting topology
and explained, never chosen before drawing. Rooms stay derived, and dividing a
room is drawing a Wall across it. Layout format 8 derives roles and every closed ring encloses; a self-connected Wall is the isolated circular case; the creator-facing expression
is [PLATE §0.8.4](../design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).

`LayoutRoom` is the current enclosed-region minimum, not the universal spatial
abstraction. The destination distinguishes physical architecture (Walls,
Openings, floors/elements), derived spatial topology (faces, adjacency,
enclosure) and a semantic spatial model (Space, Site, Building, Level, Zone).
Indoor Rooms are one kind of semantic Space; future outdoor/open regions must not
require pretending the world is one giant Room. Hierarchical containment stays
conceptually separate from cross-cutting Zones, and Zones are not transform
ownership. The exact future schema is not ratified yet; do not invent
implementation types ahead of planning.

The wall-first ownership principle is:

```text
Walls/Junctions → physical architecture + explicit connectivity
Rooms           → persistent semantic enclosed regions
Openings        → hosted by canonical Walls
Layout objects  → document-level/project-world-local
```

Geometry/topology may derive candidate faces, but product reconciliation owns
persistent Room identity. Proximity may suggest a snap/join; it never becomes
implicit authored topology or ownership by itself. Every addition extends the
Layout domain and the single canonical compiler; it never creates a second
mesh-authoring or geometry authority, and Layout-owned representation
algorithms are runtime-safe from their first implementation so editor and
visitor can share them.

Broader depth (stairs, railings, richer parametric components, arbitrary curve
intersection and noding, NURBS/CAD curve operations, roof helpers, general
constraint sophistication) is demand/evidence-gated. Architectural extensions remain Layout-owned;
native object depth follows the [creative-depth admission boundary](../north-star.md#creative-freedom-and-depth).
UV/rigging and general character-animation authoring remain external workflows.



## Compiled geometry and measurement

Do not deep-proxy compiled geometry through reactive session state. Reuse and comparison work
must measure the actual input the editor hands to the operation. Output equivalence alone does not
establish a performance improvement; measure the candidate before adopting it.
