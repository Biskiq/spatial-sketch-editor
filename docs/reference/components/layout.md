# Layout

**Owns:** architecture, topology, Walls/Junctions, reconciled Rooms, hosted Openings,
levels/structures/architectural definitions and validated alternatives. One canonical compiler
produces geometry and query records. Runtime-safe representation consumes that output; it never
reconstructs a second topology or navigation authority.

## Current contract

Layout format 6 is wall-first. Wall role is derived; every closed ring encloses. A free-standing
Wall encloses nothing; a dividing Wall creates reconciled Room topology. Room identity is persistent
through reconciliation, while Room geometry remains derived and is never directly editable.
Authored placement is world-local with explicit internal frames, without mandatory Room ownership.
[Editing-path rules](layout-performance.md) govern previews, commit and retained roots.

## Accepted future requirements and open mechanisms

The requirements below preserve approved spatial depth. They are not claims that circular-Wall,
Section, peel, arbitrary top profiles, independent overhead regions or multi-level authoring are
implemented. Encoding and unresolved choices remain explicit; current shell limits do not narrow
approved design. Prototype mechanisms are evidence, not schemas.

## A circular enclosure needs one self-connected, continuously curved Wall

**Accepted future scope.** A direct Circular Room tool must produce **one** continuous canonical
Wall enclosing **one** persistent Room, retaining that Wall/Room identity through hosted
Openings, radius/diameter editing and unfolding. Internal spans, samples and mesh fragments may
be numerous; none becomes an independently authored Wall. The existing multi-Wall ring stays
valid architecture but does **not** satisfy this outcome.

Representation requires proof; a candidate is a narrowly scoped parametric
closed-circle centerline variant on an ordinary Layout Wall with a self-loop topology case and
one stable seam Junction. The bounded cubic alternative remains a legitimate proof alternative,
not an accepted segmented-Wall substitute. No representation is chosen here.


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


## Wall unrolling is a display reading over the canonical Wall

Unrolling is a **session reading**, never authored data: it holds the Wall, its canonical anchor
station, the closed-Wall display cut, the displayed face and the unroll amount. It is never
serialized, never enters history and Undo never changes it. The sheet is built from the same
development map and canonical samples as the Wall; no second Wall model or writer exists.

- **Entry.** Every Wall Card has one Unroll action. A straight Wall has nothing to peel, so it
  enters the same measured sheet already flat with editable Openings and no artificial unfolding
  animation; curved and closed Walls keep the physical roll-out. Entry preserves Camera
  orientation and may perform one bounded pan/zoom fit inside the Stage safe area.
- **Camera.** Peel, face change, pin and Opening edits never move the Camera. Put back restores
  the entry pose only when entry adjusted the Camera and the creator has not navigated since;
  deliberate pan, zoom or orbit is preserved. A context whose Wall or document disappears
  invalidates and returns with a reason, never by substituting a nearby Wall.
- **Station identity.** Openings on the sheet are the as-built Opening kit through the development
  map. Selection, slide, jamb resize, sill/head and Undo address the same canonical Opening id in
  canonical stations. A seam-crossing Opening shows as two fragments of one entity.
- **Faces.** The sheet opens on the face toward the Camera (in Plan, the Room side). The face
  switch is a rigid half-turn of the sheet about the pin's vertical; the Camera does not move and
  stations stay canonical. Faces are named by what they bound.
- **Shape edits.** Centerline, bend-point and body-bend edits are refused with a specific reason
  while the Wall is unrolled. Opening measures and Wall height remain canonical edits.
- **Exit.** Put back, Escape with no gesture held, the Card action, or rolling an edge home. The
  reading leaves no history entry. **Unroll**, **Put back**, **pin** and **bend point** are the UI
  words; Unfold, Refold, Flip, Done and Peel are not.


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

- **D2 — ceiling closure, coverage and datum.** Independent closure/suspended regions retained;
  decide Floor-relative versus world-fixed authored overhead under datum change, with measured
  world height shown clearly either way. Generated fallback only for uncovered enclosure; no
  duplicate authored closure overlap. Open.
- **D3 — fit/gap and intentional openings.** Prefer explicit one-shot fixes with previews and
  **no automatic following**; decide the representation of intentional Wall/ceiling gaps
  alongside closure intent. Persistent fit constraints deferred. Open.
- **D5 — crop, cut-only, seam and ambiguous inverse.** Decide the
  display-cut presentation for single-Wall and multi-Wall loops, and refusal/recovery for
  self-overlapping peeled surfaces or invalid recipes. Prefer an explicit reason plus
  square-up/host recovery over guessing. Display decisions cannot change canonical periodic or
  seam identity. Open.
- **D6 — exit summary and motion UX.** Keep the separate histories and exact return; validate the
  "undo these" suffix; choose copy for the unavailable case. Adaptive teaching / instant /
  reduced-motion policy schedules the same transition and end state; exact durations and
  thresholds are tunable. Open.


## Slab and ceiling ownership kept open

F names slab/ceiling ownership as an **open mechanism**, so it stays open: an independent
CeilingRegion owns footprint, height/profile, thickness and closure/suspended meaning; a Room
may seed or overlap a footprint but **never owns the region**. Default generated Room closure is
preserved where no authored closure overrides coverage, suspended regions do not erase
enclosure, and an ambiguous overlapping-closure surface is **refused pending an explicit joint
rule** rather than double-rendered. Generated fallback stays derived and unpersisted; converting
it to an authored region is an explicit command. Persistent fit-to-overhead is not a
prerequisite for truthful relations or one-shot fixes.


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
room is drawing a Wall across it. Layout format 6 derives roles and every closed ring encloses; the creator-facing expression
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
