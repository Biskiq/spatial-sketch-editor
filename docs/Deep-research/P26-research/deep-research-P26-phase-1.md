# P26 — Architectural Spatial Depth

## Deep research and product-direction study

**Research snapshot:** September 16, 2026
**Scope:** product model, architectural precedent, interaction model, future-proofing, open-source Phase 2 targets
**Assumption:** P23 final product/design contract fully landed.

---

# 1. Executive synthesis

## Core finding

P26 should **not** turn Museum Editor into small Revit.

P26 should give Museum Editor one thing P23 fundamentally lacks:

> **A canonical architecture model that can describe and precisely edit meaningful vertical spatial form.**

Best product structure:

```text
Layout
├─ Plan
├─ Orthographic
│  ├─ Wall Elevation
│  └─ Section
└─ 3D
```

But `Orthographic` should initially behave as **contextual editing instrument**, not full CAD document/view-management system.

Plan stays main horizontal authoring surface.

Section becomes main spatial-depth instrument.

Wall Elevation becomes focused wall/opening instrument.

3D becomes spatial verification plus bounded direct manipulation.

All four consume and mutate same `LayoutDocument`.

No second vertical document.
No SVG-owned geometry.
No visitor-specific architecture.
No Scene-owned architectural geometry.

This fits P23's strongest existing architecture rule: `LayoutDocument` owns architectural truth, `SceneDocument` stays separate, and one compiled geometry path feeds Plan, 3D, and visitor output.

## Most important product judgments

**1. Section matters more than generic Elevation.**

Elevation good for one Wall face. Section can expose wall height, opening sill/head, platforms, ceilings, columns, adjacent rooms, and overhead profile in one exact vertical surface. Mature systems use Sections this way, with explicit cut, direction, crop, depth, and range. Revit creates Sections from a drawn cut line plus crop/depth; Archicad exposes infinite, limited, and zero-depth section ranges; BricsCAD models a Section as an editable plane/volume.

**2. Elevation should start Wall-contextual.**

Do not introduce global North/South/East/West architectural Elevation tabs just because CAD has them.

Museum editing need usually simpler:

```text
select Wall / Opening
→ Open Elevation
→ look normal to Wall
→ edit wall-local U/Y geometry
→ Back to Plan
```

Revit elevations commonly originate from Plan markers snapping to walls; BricsCAD can derive interior elevations per Space wall. This supports contextual wall-facing workflows without requiring Museum Editor to copy their persistent documentation model.

**3. Ceiling should become first-class Layout architecture.**

Not Room metadata.

Not Scene geometry.

Not one ceiling implicitly attached to each Room.

A ceiling should be an independently addressable architectural **region/surface** whose footprint may be seeded from one or more Rooms.

Reason: mature tools frequently use room/wall boundaries as creation convenience while retaining ceiling/slab as independent model element. Revit ceiling can be generated inside enclosing walls or sketched independently. Vectorworks slab can represent ceiling, floor, or flat roof and can either associate to Walls or have manual boundaries.

That model handles:

* one ceiling spanning several Rooms;
* several ceiling regions inside one Room;
* adjacent Rooms with different ceilings;
* partial ceiling coverage;
* slopes;
* gables;
* future Level changes;
* Room identity surviving ceiling edits.

**4. P26 should add bounded vertical profiles, not free-form architectural solids.**

High-payoff vocabulary:

```text
Wall
  footprint / centerline       existing
  vertical top profile         new

Opening
  host + horizontal position   existing
  width / sill / head          existing semantics, richer editing
  rectangular / round arch /
  pointed arch                 existing

Column
  footprint
  base elevation
  height

Platform
  footprint
  base elevation
  thickness / top elevation

CeilingRegion
  footprint
  vertical profile:
    flat
    shed / single slope
    gable
  thickness
```

This creates dramatically richer museum spaces without Roof families, compound assemblies, arbitrary wall-profile sketching, massing, parametric family editors, or general solid modeling.

**5. Full architectural multi-selection/transforms should not be P26 core.**

Research shows mature tools support topology-aware transforms, but their semantics get deep fast. Revit distinguishes constrained movement from destructive `Disjoin`; BricsCAD lets users preserve or break connectivity; Archicad's marquee stretches only affected nodes/endpoints; SketchUp stretches connected raw geometry and may create new folds.

Museum's proposed semantic Room-region transformation adds even harder rules:

* shared Wall ownership;
* fixed neighbor;
* new Junction creation;
* Wall splitting;
* Opening host preservation;
* identity lineage;
* deterministic Undo;
* curved Walls;
* partial selection.

This is its own architectural capability.

P26 may establish selection-set primitives if required by vertical tools. It should not quietly absorb proportional Room reshape.

**6. Reserve vertical datum semantics now. Do not build Levels now.**

P26 should stop assuming architecture necessarily begins at `Y = 0`.

But no full Storey/Level hierarchy yet.

Canonical objects should be able to express a base elevation or equivalent vertical reference cleanly. This prevents future multi-level support from requiring every Wall, Opening, Column, Platform, and Ceiling definition to change.

**7. Reflected Ceiling Plan useful, but should not become another top-level peer yet.**

RCP is real architectural precedent. Revit authors ceilings in reflected ceiling plans; BricsCAD implements RCP as a downward-facing horizontal section that projects ceiling geometry.

Museum Editor can get most value through a **Ceiling focus / reflected Plan overlay** inside Layout rather than:

```text
Plan | Elevation | Section | RCP | 3D
```

That avoids shell explosion.

---

# 2. P26 problem definition

P23 solves architectural **topology and drafting credibility**.

It gives Museum Editor:

* canonical Walls and Junctions;
* persistent semantic Rooms;
* hosted Openings;
* curved Walls;
* topology-aware direct editing;
* Plan snapping/guides;
* architectural identity;
* one compiler/evaluator path;
* one deterministic Layout history;
* credible architectural Plan representation.

P23.13 explicitly targets:

> architectural drawing when idle; precision editor when touched.

It also keeps P23 single-target and defers marquee/multi-selection.

What remains weak after P23 is not 2D drafting.

It is **vertical authorship**.

Today, architecture can still converge visually toward:

```text
flat floor
+ extruded Walls
+ rectangular openings
+ mostly flat top
+ flat Room ceiling
```

Curved Wall footprint and arch Openings help, but silhouette and volume remain shallow.

P26 problem therefore not:

> “How add more architecture objects?”

It is:

> **How let one canonical wall-first architectural model acquire controlled Y-axis structure, and how give user a precise surface for authoring it?**

That means P26 has three coupled problems:

```text
model vocabulary
        ↓
vertical editing instrument
        ↓
canonical 3D/visitor derivation
```

Solve only model vocabulary: Inspector-heavy editing, weak spatial reasoning.

Solve only 3D gizmos: easy rough shaping, weak architectural precision.

Solve only Section rendering: nice view, no meaningful editable depth.

P26 needs all three in bounded form.

---

# 3. Precedent matrix

| Tool                     | Plan / Elevation / Section model                                                                                                               | Vertical editing signal                                                                                         | Ceiling / overhead signal                                                                      | P26 lesson                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Revit**                | Persistent Plan, Elevation, Section, RCP views. Section created with cut line, crop and depth. Elevations created from Plan marker near Walls. | Wall profile edit explicitly moves user into Section/Elevation. Wall tops can attach to ceiling/roof/floor.     | Ceiling independent element, wall-bounded or sketch-bounded; flat/sloped/cathedral.            | Orthographic editing has real value. Copy model/view split, not documentation bulk.                                            |
| **Archicad**             | Sections have infinite/limited/zero depth and vertical ranges. Interior Elevations can be space-related. Range guides can stay screen-only.    | Wall/slant/height edits available graphically in 3D and Section with numeric tracker.                           | Rich roof/shell systems, including multi-plane Roof.                                           | Strong precedent for constrained direct manipulation + temporary numeric precision.                                            |
| **Vectorworks**          | Section/interior-elevation viewports support finite extents and depth cueing.                                                                  | Wall peaks and wall height editable in 3D. Door/window width editable in Plan; more dimensions available in 3D. | Slab object covers floors, ceilings, flat roofs; can derive from Walls or manual boundary.     | Different views should expose different DOF. Ceiling need not belong to Room.                                                  |
| **AutoCAD Architecture** | Section line has length, depth, height; linked 2D/3D/live sections derive from building model.                                                 | Property-driven architectural objects; live sections remain linked.                                             | Roof/slab systems independent of Room semantics.                                               | Derived views can be rich without creating duplicate architecture.                                                             |
| **Rhino 8**              | Clipping Sections can use arbitrary direction, custom finite depth, zero-depth slice, saved Named View optionally.                             | Strong general 3D direct modeling rather than architectural constraint model.                                   | Generic surface/solid model.                                                                   | Best precedent for lightweight **instrument first, saved view optional later**.                                                |
| **BricsCAD BIM**         | One Section entity supports Section, Elevation, Interior Elevation, RCP, Detail. Editable direction/bounds/volume grips.                       | 3D DRAG exposes direct face manipulation, dynamic dimensions, preserve/break connections.                       | RCP is downward horizontal section.                                                            | Strong precedent for one underlying section instrument serving many views.                                                     |
| **SketchUp**             | General orthographic/scenes/sections, less architecture-semantic.                                                                              | Connected geometry stretches based on face/edge/endpoint; Autofold inserts geometry if needed.                  | Generic geometry.                                                                              | Great directness. Dangerous precedent for Museum because automatic topology creation hurts deterministic wall-first semantics. |
| **Sweet Home 3D**        | Strong Plan + 3D consumer workflow, little serious vertical orthographic authoring.                                                            | Wall can hold start/end heights; code interpolates split heights.                                               | Sloped ceilings historically require wall/model workarounds rather than strong ceiling entity. | Shows how far simple endpoint-height model can go, and where Plan+3D-only model runs out.                                      |

## Cross-tool conclusion

No mature precedent says every view needs equal product weight.

More useful pattern:

```text
canonical model
      ↓
several projections / instruments
      ↓
each instrument exposes useful DOF
```

This matters for Museum.

Symmetric tabs are UI symmetry.

They are not architectural necessity.

---

# 4. Plan / Elevation / Section / 3D findings

## 4.1 Plan

Plan should remain authority for:

* Wall/Junction footprint;
* Room topology;
* Opening horizontal host position and width;
* Column footprint;
* Platform/Ceiling region footprint;
* Section placement;
* gross architectural relationships.

Plan should **not** become overloaded with vertical dimensions.

Use lightweight indicators instead:

```text
Wall selected
2.8 m ↕       maybe selected-target feedback

Ceiling selected
Flat · 3.2 m

Platform selected
+0.45 m
```

No permanent field of elevation tags everywhere.

P23 principle survives:

> Architecture stays visible. Precision appears where user works.

---

## 4.2 Section

### Evidence

Revit Section creation uses an authored cut line. Crop region and depth control resulting view. Moving cut line changes Section.

Archicad makes depth explicit:

```text
Infinite
Limited
Zero Depth
```

and separately bounds vertical range. Depth/range guides can be screen-only editing aids rather than documentation geometry.

Rhino uses same useful concept in lighter form: arbitrary clipping direction, optional custom depth, zero depth for pure slice, optional named-view persistence.

BricsCAD exposes start/end, direction flip, boundary, top and bottom grips directly on Section entity.

### Product judgment

Museum Section should have canonical editor definition roughly like:

```ts
type SectionInstrument = {
  origin: Vec2;
  tangent: Vec2;
  lookSide: 'left' | 'right';

  span: {
    start: number;
    end: number;
  };

  depth:
    | { kind: 'cut-only' }
    | { kind: 'finite'; meters: number };

  verticalCrop?: {
    minY: number;
    maxY: number;
  };
};
```

This is **editor view state**, not architectural geometry.

Section surface derives from canonical Layout compiler.

The cut does not own Wall slices.

It projects them.

### Suggested creation gesture

From Plan:

```text
Section tool
↓
click start
↓
click end
↓
move pointer to choose look direction / depth
↓
click
↓
enter Section
```

A lighter variant:

```text
drag section line
release
default finite depth
arrow flips direction
depth handle adjusts range
```

Default should likely be **finite**, not infinite.

Large museums otherwise become unreadable.

### What Section can edit

Strong P26 set:

* Wall height/top profile;
* Opening sill;
* Opening head;
* Opening width when Wall lies near/perpendicular enough to projection;
* Opening arch rise/profile controls;
* Column base/top;
* Platform base/top;
* Ceiling elevation/slope/ridge;
* perhaps floor datum later.

Section should reject or redirect edits whose geometry not meaningfully represented in current cut.

Do not fake precision from oblique projected geometry.

---

## 4.3 Elevation

Three concepts exist in mature tools:

1. exterior/global Elevation;
2. arbitrary directional Elevation;
3. interior/Wall-relative Elevation.

Museum mostly needs third one.

### Recommended minimum

```text
Wall Elevation
```

Definition derived from:

```text
wall id
+ viewed side
+ horizontal extent
+ vertical crop
+ optional shallow background depth
```

Not:

```text
north elevation
south elevation
east elevation
west elevation
```

### Entry

Best entry point:

```text
select Wall
→ Open Elevation
```

Or:

```text
select Opening
→ Elevation
```

System opens host Wall.

For a Room:

```text
select Room
→ Interior Elevations
```

could later expose its boundary Walls as a small chooser, similar to interior-elevation workflows in BricsCAD and Archicad.

But Room remains navigation context.

Room does not own Wall geometry.

---

## 4.4 3D

3D should become editable for **gross spatial form**.

Archicad allows Wall height/slant edits in both Section and 3D. Vectorworks exposes wall peak/height controls in 3D. Vectorworks doors/windows expose dimensions according to view: Plan allows width; 3D exposes vertical shape controls.

Museum should use same principle.

Example:

```text
Plan:
  Opening → move along Wall
  Opening → width

Elevation / Section:
  Opening → width
  sill
  head
  arch

3D:
  coarse width
  sill/head
  spatial preview
```

One canonical intent path underneath.

Not three implementations.

---

## 4.5 Selection across views

Selection identity should not be view-owned.

Example:

```text
Plan:
select O-7K3M

→ Open Wall Elevation

Elevation:
same O-7K3M selected

→ 3D

3D:
same O-7K3M selected
```

View transition may alter available handles.

It must not alter selected architectural identity.

If an object has no meaningful representation in destination view, keep identity but show neutral status:

```text
O-7K3M outside current section depth
[Reveal]
```

This fits P23 deterministic selection and identity direction rather than creating section-local proxy IDs.

---

# 5. Ceiling and vertical-form findings

## 5.1 Ceiling ownership

Four plausible models:

### A. Ceiling as Room metadata

```ts
room.ceilingHeight = 3;
```

Good:

* trivial;
* automatic;
* easy flat extrusion.

Bad:

* one Room → one ceiling assumption;
* cannot span Rooms;
* cannot have several regions;
* slope representation ugly;
* Room becomes owner of unrelated geometry;
* edits to Room identity/topology become ceiling lifecycle problem.

**Reject as P26 model.**

---

### B. Ceiling as Wall-derived closure

Compiler finds every enclosed Room and caps it.

Good:

* still simple;
* no new entities.

Bad:

* same limits as Room metadata;
* impossible to independently select;
* poor partial/sloped coverage;
* cannot span spaces cleanly.

Useful only as default fallback when no authored ceiling exists.

---

### C. First-class Ceiling entity bound to Room

Better.

Still bad when one ceiling spans several Rooms or Room topology changes.

Room relationship should be derivable, not sole ownership key.

---

### D. First-class architectural region/surface

**Recommended.**

Concept:

```ts
interface LayoutCeilingRegion {
  id: LayoutCeilingId;

  footprint: LayoutRegionBoundary;

  baseElevation: number;

  profile:
    | { kind: 'flat' }
    | {
        kind: 'shed';
        direction: Vec2;
        slope: number;
      }
    | {
        kind: 'gable';
        ridge: Segment2;
        eaveElevation: number;
        ridgeElevation: number;
      };

  thickness: number;
}
```

Exact schema should wait for code harvest/design.

Important idea is ownership:

```text
Room may seed Ceiling.
Room may overlap Ceiling.
Room does not own Ceiling.
```

### Precedent

Revit ceiling can be created by selecting enclosed Wall region or explicit sketch. Once created, it is a ceiling element with level/offset/type/slope.

Vectorworks Slab can serve floor, ceiling, flat roof and can either follow Walls or use manual boundary.

This distinction is exactly useful for Museum.

---

## 5.2 Flat ceiling

Minimum creation:

```text
Ceiling
→ click Room
→ Create from Room

or

Ceiling
→ draw region
```

Inspector:

```text
Elevation       3.20 m
Thickness       0.15 m
Profile         Flat
```

Direct Section handle:

```text
──────── ceiling
        ● 3.20m
```

Drag Y.

Temporary dimension active.

---

## 5.3 Shed ceiling

Do not introduce freeform mesh editing.

Use one planar slope.

Author from Plan or Section:

```text
Profile: Shed
Direction: ← → 
Low: 2.8 m
High: 4.1 m
```

or:

```text
elevation + slope
```

Section shows two endpoint handles.

3D shows rise direction.

---

## 5.4 Gabled ceiling

High payoff for museums.

Simple bounded model:

```text
footprint
ridge line
eave elevation
ridge elevation
thickness
```

Plan:

```text
┌─────────────┐
│             │
│ ── RIDGE ── │
│             │
└─────────────┘
```

Section perpendicular to ridge:

```text
       /\
      /  \
_____/    \_____
```

This gives spatial identity fast.

Full roof systems go much farther. Archicad supports single- and multi-plane roofs where linked planes update together. That is useful evidence but well beyond P26's needed vocabulary.

---

## 5.5 Ceiling versus Roof

Do not make P26 solve:

* overhangs;
* eaves;
* fascia;
* gutters;
* dormers;
* valleys;
* roof intersections;
* roof assemblies;
* structural rafters;
* drainage.

These are Roof-system problems.

Museum need first:

> shape interior volume.

So P26 ceiling/overhead architecture may generate outer closure needed for visitor geometry, but should not pretend to model full roof semantics.

Call object `CeilingRegion`, `OverheadRegion`, or similar based on design phase.

Name matters less than ownership boundary.

---

## 5.6 Wall-to-ceiling relation

Mature tools commonly let Walls attach to overhead/floor geometry. Revit explicitly supports attaching Wall top/base to Roof, Ceiling, Floor, reference plane, or Wall; Wall height then conforms to target.

Museum should consider bounded equivalent:

```text
Wall top
[ Fixed profile ]
[ Fit to ceiling: C-… ]
```

But dependency direction must stay clear.

Recommended:

```text
Ceiling geometry
      ↓
optional Wall-top fit
```

Not cyclic:

```text
Room → Walls → Ceiling → Walls → Room
```

Potential canonical rule:

```text
wall.topMode =
  { kind: 'profile', profile: ... }
  | { kind: 'fit-to-overhead', ceilingId: ... }
```

Needs Phase 2 reconciliation.

> **Museum implementation reconciliation required**

Current per-Wall height can evolve toward top profile / overhead constraint, but exact migration needs actual layout-core model inspection.

---

# 6. Opening / Wall / Column / Platform vertical editing

## 6.1 Wall

### Minimum high-ceiling representation

Current constant height becomes:

```text
constant top
or
piecewise linear top profile
```

Useful first forms:

```text
constant

──────

single slope

────╱

gable / peak

──╱╲──
```

Vectorworks explicitly supports wall peaks and editing them in 3D. Sweet Home 3D has distinct start/end heights and interpolates height when Walls split.

### Why not arbitrary wall-profile sketch yet

Revit supports full Wall profile editing in Section/Elevation with lines/arcs/openings. Powerful, but this introduces another planar topology editor inside Wall geometry. It also has special limits, including curved Walls.

Museum already has hard enough canonical Wall topology.

P26 gets more value from bounded height-profile vertices.

Suggested conceptual profile:

```ts
type WallTopPoint = {
  distanceAlongWall: number;
  y: number;
};
```

For curves, distance should be **arc length**, same family of reasoning already used for wall-local hosted Openings.

No center-chord shortcuts.

---

## 6.2 Openings

P23 already gives strong semantic base:

```text
host Wall
meter offset
width
height
sill
rectangular / rounded arch / pointed arch
```

P26 mainly needs **better vertical authoring**, not richer data families.

### Wall Elevation handles

```text
      arch apex
         ●
      ╭────╮
   ●  │    │  ●   head / width
      │    │
   ●──┴────┴──●   sill / width
```

Possible handles:

* left/right width;
* sill;
* head;
* arch rise where applicable.

Properties stay exact in Inspector.

Vectorworks proves useful split: Top/Plan exposes width, while 3D can expose vertical reshape controls. Its interactive insertion also supports Wall-plane constrained sizing and snapping.

Revit exposes explicit head/sill relationships for hosted Doors/Windows.

### Do not add

* full Door family system;
* jamb construction;
* transoms;
* manufacturer catalogs;
* arbitrary opening sketches;
* fake handing semantics just to make symbols richer.

Existing arch vocabulary already unusually high-payoff for Museum.

---

## 6.3 Column

Column belongs to Layout when it represents architectural support / spatial boundary.

Needed:

```text
footprint
base elevation
height / top elevation
```

Plan handles footprint.

Section/3D handles height.

Archicad precedent exposes Column height/angle via direct handles in Section and 3D.

No structural load semantics needed.

A decorative fake marble column imported as prop may still be Scene.

Meaning decides ownership.

Not mesh shape.

---

## 6.4 Platform

Platform should mean architectural raised/lowered walkable surface.

Needed:

```text
footprint
base elevation
thickness
top elevation
```

Plan:

* shape / footprint.

Section:

* rise / thickness.

3D:

* spatial manipulation.

This is different from exhibition pedestal.

Suggested ownership rule:

```text
changes architecture / walking surface / room volume
→ Layout Platform

holds artwork / decorative object
→ Scene staging / plinth
```

P24 should retain latter. P24 already owns asset/staging/material/lighting depth, not architecture.

---

# 7. Architectural transform / multi-select findings

## Evidence

Mature systems do not have one magic universal “Room transform”.

They expose explicit topology policies.

Revit Move can preserve constraints or `Disjoin`; Disjoin can break associations and even replace element identity, which Autodesk warns about.

BricsCAD DRAG makes connectivity mode explicit: preserve connected wall conditions or break them. It combines direct preview and dynamic numeric dimensions.

Archicad marquee stretch operates at node/endpoint level:

* nodes inside marquee move;
* outside nodes remain;
* fully enclosed polygon moves rigidly;
* curved Walls preserve central-angle relationship.

SketchUp uses raw connectivity: moving face, edge, or endpoint stretches all attached geometry and Autofold may add creases.

## Museum implication

Future Museum architecture transform model can plausibly be:

```text
selection
→ determine canonical transform region
→ lock interface to unselected topology
→ compute proposed Wall/Junction/Openings mutations
→ preview
→ validate
→ one deterministic transaction or none
```

That fits P23 architecture.

### Example future intent

Suppose two Rooms:

```text
┌───────┬───────┐
│   A   │   B   │
│       │       │
└───────┴───────┘
```

User stretches A rightward.

Question not “move Room polygon”.

Need decide:

```text
shared Wall moves?
B shrinks?
B stays and new connector Walls appear?
operation refused?
user explicitly includes B boundary?
```

This is policy, not transform math.

## Recommendation

Do **not** make full architectural transform system core P26.

P26 may need a limited selection-set foundation for:

* several Walls → set height;
* several Openings → align heads;
* several Columns → set height;
* several ceiling regions → property edit.

Safe structural operations could also later include:

* translate whole Layout;
* rotate whole Layout;
* mirror whole Layout.

These have no selected/unselected topology seam when entire architectural graph participates.

But defer:

* proportional Room resize;
* partial-region rotate;
* partial-region mirror;
* topology-creating transform;
* automatic Wall split at transform boundary.

Those deserve separate design + transaction semantics.

---

# 8. Multi-room and future-Level implications

## 8.1 Many Rooms

Infinite Sections become clutter fast.

Therefore Section default should have:

```text
finite span
finite far depth
optional vertical crop
```

Projected geometry behind cut gets depth fading.

Revit and Vectorworks both use depth cueing for Section/Elevation readability. Revit ties it to near/far depth; Vectorworks can reduce line tone/thickness with distance.

---

## 8.2 Section through many Rooms

Use hierarchy:

```text
CUT
████ strongest

NEAR PROJECTED
──── medium

FAR PROJECTED
---- light

OUTSIDE DEPTH
hidden
```

No need hide Rooms arbitrarily.

Depth itself solves much clutter.

Also offer:

```text
Background
[ None ]
[ Faded ]
[ Full ]
```

`cut-only` becomes useful for precision.

Archicad's zero-depth section and Rhino's depth=0 clipping section validate this pattern.

---

## 8.3 Ceiling spanning Rooms

First-class CeilingRegion handles this naturally:

```text
Rooms:
A | B | C

Ceiling:
┌─────────────┐
│ spans A+B   │
└─────────────┘
```

No duplicated ceiling state.

Room-ceiling coverage can be derived.

---

## 8.4 Adjacent Rooms with different heights

Do not create:

```text
roomA.wallHeight
roomB.wallHeight
```

Shared Wall exists once.

Instead:

```text
Wall physical top profile
Ceiling A surface
Ceiling B surface
```

The two sides can have different overhead conditions even while Wall remains one physical entity.

---

## 8.5 Future Levels

P26 does not need:

```text
Building
  Level 1
  Level 2
  Level 3
```

yet.

But it should reserve one concept:

> **Vertical location should not be permanently synonymous with zero-based extrusion.**

Bad future trap:

```ts
wall.height
// implicit y0 = 0 forever
```

Better conceptual direction:

```ts
wall.baseElevation
wall.topProfile

opening.sillRelativeToHostBase

platform.baseElevation

ceiling.profileElevation
```

Later Level can become a reference convenience:

```ts
verticalReference = {
  datumId: levelId,
  offset: ...
}
```

without changing geometric meaning.

This is similar to mature BIM systems using level/story references for elements, but Museum does not need their hierarchy yet. Revit ceilings are level-based offsets; Archicad Section ranges and interior elevations can reference project zero or story datum.

### Recommendation

**Reserve datum-capable numeric semantics.**

**Defer Level entity and Level UI.**

---

# 9. Visual and interaction-language findings

P23 rule:

> Architecture stays visible. Precision appears where you work.

This extends cleanly to Section/Elevation.

## Resting Section

Should read like architectural drawing.

Not editor debug view.

Visual priority:

```text
1. cut geometry
2. near projected geometry
3. far projected geometry
4. passive context
5. hidden state absent
```

Rhino Section Styles explicitly separate section fill/boundary treatment. AutoCAD Architecture allows section display components and linked live sections.

### Suggested resting grammar

**Cut geometry**

* strongest line;
* light neutral poche/fill;
* closed cut solids legible.

**Projected geometry**

* thinner line.

**Far depth**

* lighter/thinner.

**Scene footprints / content**

* passive when shown;
* never get Layout hit authority.

**Selected**

* P23 selection blue.

**Hover**

* softer hover vocabulary.

No new section-specific “selected red” system.

---

## Active editing

Precision appears around active target only:

```text
selected wall top
●────────●

     ↕ 3.40 m
```

or:

```text
window

┌─────┐
│     │  ← 1.60 m
└─────┘
 ↑0.90m sill
```

Show:

* relevant direct handles;
* temporary dimensions;
* one accepted snap;
* guide;
* proposed geometry.

Hide scaffolding when edit ends.

BricsCAD selection dimensions and direct DRAG show useful precedent: selected building element gains editable dimension references, while normal model stays clean.

---

## Snap grammar

Reuse P23 rules.

Do not make vertical view separate snap engine.

Potential vertical candidates:

```text
datum
Wall top
Opening head/sill
Platform top
Ceiling surface
Column top
Section intersections
grid / metric increment
```

Still:

> accepted winner only.

No candidate cloud.

---

## Invalid language

Same P23 transaction principle:

```text
drag
↓
proposal
↓
validate
↓
commit exactly once
or install nothing
```

Visual:

```text
valid
─────●

invalid
- - - ×
Cannot place opening above Wall top
```

No auto-repair unless explicit command.

---

## Section instrument appearance in Plan

When inactive:

```text
section line + quiet arrow
```

When selected:

```text
●──────────────● →
                ┆
                ┆ finite depth
```

Depth/range boundary editor-only.

Do not print-like clutter Plan with crop rectangles all time.

Archicad's marker range lines being on-screen-only gives strong precedent.

---

## Semantic zoom

As zoom decreases:

1. temporary dimensions disappear;
2. secondary projected edges reduce;
3. labels suppress;
4. handles suppress;
5. cut silhouette stays.

Architecture never vanishes before editing furniture noise does.

---

# 10. Candidate Museum Editor product models

## Model A — Four permanent peer views

```text
Layout
├─ Plan
├─ Elevation
├─ Section
└─ 3D
```

### Strengths

* familiar CAD language;
* clear mode distinction;
* long-term room for saved documentation views;
* easy conceptual mapping to Revit/Archicad.

### Weaknesses

* Elevation meaning ambiguous;
* Section has no single natural default;
* top-level shell grows;
* implies persistent view manager;
* pushes Museum toward CAD-document system;
* large empty modes before enough data exists.

### Architectural implications

Low.

Views still can derive same canonical architecture.

### UX implications

High shell complexity.

### Future ceiling

Very high.

### Complexity

High.

### Judgment

Good eventual structure if Museum later becomes broad architectural tool.

Wrong first P26 shape.

---

## Model B — Plan + contextual Orthographic instrument + 3D

```text
Layout
├─ Plan
├─ Orthographic
│  ├─ Wall Elevation
│  └─ Section
└─ 3D
```

Orthographic context entered from target or Section line.

### Strengths

* precise;
* bounded;
* keeps shell clean;
* Section can be arbitrary;
* Wall Elevation can be immediate;
* no need for Project Browser of views;
* same instrument can later gain persistent saved states.

### Weaknesses

* navigation design must be excellent;
* current `Plan | 3D` mental model no longer enough;
* contextual state needs clear return behavior.

### Architectural implications

Requires general derived projection pipeline.

Requires vertical geometry model.

### UX implications

Moderate.

### Future ceiling

Very high.

Can later evolve to:

```text
Orthographic
├─ transient contexts
└─ pinned/saved contexts
```

without redoing architecture.

### Complexity

Medium-high.

### Judgment

**Recommended.**

---

## Model C — Plan + 3D direct editing only

```text
Layout
├─ Plan
└─ 3D
```

Add lots of 3D handles.

### Strengths

* simple navigation;
* visually intuitive;
* no new projection surface.

### Weaknesses

* occlusion;
* poor dimensioning;
* difficult exact sill/head/ridge work;
* wall-local coordinates awkward;
* hard multi-room ceiling relationships;
* difficult alignment;
* 3D gizmos become overloaded.

### Architectural implications

Model can remain sound.

### UX implications

Starts simple, grows messy.

### Future ceiling

Medium.

### Judgment

Reject as sole P26 editing model.

Keep 3D direct editing as companion.

---

## Model D — Room-centric interior editor

```text
select Room
→ Interior
→ Wall A
→ Wall B
→ Wall C
→ Wall D
```

### Strengths

* highly relevant to museums;
* very approachable;
* excellent opening/wall interior workflow.

### Weaknesses

* Sections spanning Rooms weak;
* ceiling spanning Rooms awkward;
* suggests Room owns walls/ceilings;
* exterior or cross-space architecture becomes second-class.

### Future ceiling

Medium.

### Judgment

Use as **convenience workflow into Wall Elevation**, not core model.

---

## Model E — Saved Section/Elevation objects from day one

```text
Navigator
Views
├─ Section A
├─ Section B
├─ Gallery Elevation
└─ ...
```

### Strengths

* excellent repeatability;
* future documentation;
* named locations.

### Weaknesses

* project-management overhead;
* lifecycle, naming, persistence, identity, history;
* deletion/rename/navigation UI;
* little visitor value by itself.

Rhino is interesting here because it lets clipping sections remain working instruments and optionally saves them to Named Views. Persistence is additive rather than required for section existence.

### Judgment

Good **later extension of Model B**.

Not P26 minimum.

---

# 11. Recommended research-informed direction

## Product judgment

Use **Model B**.

Conceptual product:

```text
P26 — Architectural Spatial Depth

Layout
│
├─ Plan
│   footprint/topology authoring
│   section placement
│   ceiling/platform regions
│
├─ Orthographic
│   │
│   ├─ Wall Elevation
│   │   Wall-local precision
│   │   Openings
│   │   Wall top
│   │
│   └─ Section
│       cross-space precision
│       heights
│       platforms
│       columns
│       ceilings
│       relationships
│
└─ 3D
    spatial validation
    coarse direct editing
    visual form
```

## Architectural vocabulary to add

P26 should target:

### Wall vertical profile

Constant plus bounded piecewise-linear top.

### Opening vertical editing

Width, sill, head, arch controls through Wall Elevation/Section/3D.

### CeilingRegion

Independent architectural region.

Profiles:

```text
flat
shed
gable
```

### Column vertical semantics

Base + top/height.

### Platform vertical semantics

Footprint + base + thickness/top.

These five additions give large spatial jump.

---

## Suggested view-state architecture

Product concept, not implementation commitment:

```ts
type LayoutView =
  | { kind: 'plan' }
  | {
      kind: 'wall-elevation';
      wallId: LayoutWallId;
      side: WallSide;
      crop?: OrthoCrop;
    }
  | {
      kind: 'section';
      cut: SectionCut;
      crop?: OrthoCrop;
    }
  | { kind: '3d' };
```

Important:

`wallId` references same canonical Wall.

Section contains no copied model.

View state can initially stay UI/editor state.

Pinned view persistence comes later.

---

## Suggested mutation architecture

Each surface emits canonical intents.

Example:

```ts
type LayoutIntent =
  | SetWallTopProfile
  | SetOpeningVerticalGeometry
  | SetColumnVerticalExtent
  | SetPlatformElevation
  | SetCeilingProfile;
```

Then:

```text
Plan handle
Section handle
Elevation handle
3D handle
Inspector numeric field
          │
          ▼
same intent / candidate pipeline
          │
          ▼
validation
          │
          ▼
one Layout transaction
```

This is critical.

P26 should not build:

```text
Section mutations
3D mutations
Inspector mutations
```

as unrelated paths.

---

## Suggested Ceiling workflow

```text
Plan
→ Ceiling tool
→ click Room / select multiple bounded spaces / sketch region
→ creates independent CeilingRegion
→ choose Flat / Shed / Gable
```

Then:

```text
Section
→ drag elevation/ridge/eave
```

And:

```text
3D
→ verify / coarse manipulate
```

Potential future:

```text
Plan → Ceiling Focus
```

shows reflected geometry without making RCP permanent top-level view.

---

## Suggested Section UX

Plan idle:

```text
A ─────────────→ A
```

Select Section:

```text
●──────────────────● →
│                  │
└ - - - depth - - -┘
```

Open:

```text
A–A
─────────────────────────────

██ wall cut
│ \
│  \ ceiling
│   \
│ window
│
└──────── platform
```

Header/breadcrumb:

```text
Plan  /  Section A–A
```

or:

```text
← Plan     Section
```

Do not pretend Section is Camera domain.

This is Layout-only view need.

That asymmetry is fine.

---

## Recommended persistence progression

### P26 initial

Section/Elevation contexts transient.

Maybe keep current one in workspace state.

### Later

Allow:

```text
Pin Section
Pin Elevation
```

Pinned items become editor view records.

They still do not become architectural geometry.

### Much later

Only if documentation becomes product goal:

* named architectural Views;
* sheets;
* annotation persistence;
* printed section callouts.

No need now.

---

# 12. Explicitly rejected / deferred directions

## Full BIM

Reject.

No need:

* IFC classification;
* construction phases;
* wall assemblies;
* material layers;
* schedules;
* structural systems;
* families;
* MEP;
* sheets.

Research uses BIM tools for interaction/model precedent, not feature parity.

---

## Full Roof system

Defer.

P26 gets:

```text
CeilingRegion
flat / shed / gable
```

No roof topology network.

---

## Arbitrary freeform Wall profile sketch

Defer.

Bounded top profiles first.

Revisit only if museum architecture proves constrained.

---

## Room-owned ceiling geometry

Reject.

Room remains semantic space.

---

## Scene-owned architecture in 3D

Reject.

Editing location does not determine document ownership.

A Column manipulated in 3D stays Layout architecture.

---

## Separate Section geometry

Reject.

Section is projection/instrument.

No duplicate wall slices.

---

## Separate Elevation document

Reject.

Same reason.

---

## Permanent Section/Elevation manager in first P26 slice

Defer.

Contextual instrument enough initially.

---

## RCP as permanent peer view

Defer.

Ceiling-focused Plan projection enough until staging/light-placement workflows prove need.

---

## Full architectural region transform

Defer to dedicated capability.

Do not bury giant topology solver inside “spatial depth”.

---

## Full Level/storey model

Defer.

Reserve vertical datum semantics now.

---

## Automatic topology repair during vertical edits

Reject.

If proposed form creates invalid architecture:

```text
show why
refuse
```

Do not silently invent Walls, split entities, or change identity.

---

# 13. Open questions for designers

Design phase should resolve these. Architecture research should not pre-decide them.

## Orthographic navigation

How does user see that Orthographic is contextual rather than permanent domain?

Potential forms:

```text
Plan | 3D
+ contextual “Open Section”
```

versus:

```text
Plan | Orthographic | 3D
```

versus breadcrumb-driven temporary takeover.

This needs UX proposal.

---

## Section creation

Need resolve:

* line-first versus drag-volume gesture;
* default far depth;
* how direction chosen;
* how crop appears;
* cut-only toggle;
* whether section remains visible after exit;
* whether one transient Section only or recent list.

---

## Wall Elevation entry

Need compare:

```text
double-click Wall?
context menu?
Inspector action?
toolbar?
floating action near selected Wall?
```

Avoid hidden expert-only command.

---

## Vertical handles

Need exact grammar for:

* Wall top;
* top-profile point;
* Opening sill/head;
* arch rise;
* Column top;
* Platform top/base;
* Ceiling eave/ridge.

Handles must not resemble generic TransformControls if architectural meaning differs.

---

## Temporary dimensions

Need decide:

* which distances appear;
* which can receive typed input;
* collision/suppression;
* selected-only versus hover;
* metric format;
* keyboard traversal.

---

## Section visual hierarchy

Need ratify:

* cut line weight;
* cut poche;
* projected line;
* depth fading;
* passive Scene objects;
* Room fill/labels;
* ceiling line language;
* hidden geometry.

---

## Ceiling authoring

Need compare:

```text
Create from Room
Create from Rooms
Draw ceiling region
```

and determine whether all three surface immediately.

Also need settle:

* default elevation;
* gable ridge interaction;
* slope direction display;
* how overlapping CeilingRegions behave.

---

## Wall top versus Ceiling relation

Need decide whether product exposes:

```text
Fit Wall to Ceiling
```

in P26.

If yes, design must show attached state clearly.

---

## 3D direct manipulation

Need decide which P26 dimensions deserve 3D handles.

Too many handles turns 3D into CAD gizmo forest.

Likely:

```text
Wall height/top
Column top
Platform top
Ceiling elevation/ridge
```

with Opening detail favoring Wall Elevation.

---

## Ceiling focus / reflected Plan

Need determine whether required for P26 or a follow-up.

Could simply be:

```text
Ceiling selected
→ Edit Plan
```

where ceiling geometry gains authority and normal floor architecture fades.

No separate RCP nomenclature may be needed for non-CAD audience.

---

## Multi-selection

Design should explicitly decide whether P26 needs only:

```text
same-property batch edit
```

or no multi-selection at all.

Do not let selection-set work accidentally become Room-transform scope.

---

# 14. Phase 2 code-harvest plan

Research found several useful open-source targets.

They solve different questions.

Do **not** pick one repository for all P26 questions.

---

## Candidate overview

| Repository                             | License                  | Stack                                    | Maturity                                                    | Main P26 value                                                                                      | Classification        |
| -------------------------------------- | ------------------------ | ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| **FreeCAD/FreeCAD**                    | LGPL 2+                  | C++, Python, Qt, OpenCascade             | Very mature, very active. Weekly build shipped Sep 16 2026. | Section-plane → architectural drawing projection; cut/render pipeline; Wall/Window/Roof interaction | **PRIMARY**           |
| **IfcOpenShell/IfcOpenShell + Bonsai** | Core LGPL; Bonsai GPL-3+ | C++, Python, Blender                     | Very active; ~22k commits, updated Sep 2026.                | Explicit Plan/Elevation/Section/RCP view taxonomy; drawing generation; IFC relationships            | **PRIMARY**           |
| **brunopostle/homemaker-addon**        | GPL-3-or-later           | Python, Topologic, IfcOpenShell, Blender | Smaller but current; 2026 release work.                     | Building-cell topology, traces vs hulls, walls/floors/roofs/soffits, multi-room spatial closure     | **PRIMARY, focused**  |
| **Sweet Home 3D**                      | GPL v2+                  | Java / Java3D; JS edition also exists    | Mature long-lived product; GitHub sources are mirrors       | Simple wall endpoint heights; split interpolation; consumer-level Plan↔3D                           | **SECONDARY / STUDY** |
| **furnishup/blueprint3d**              | MIT                      | TypeScript/JS, Three.js                  | Old/prototype; repo itself says major refactor/test debt.   | Browser wall/corner/room topology and Plan→3D coupling                                              | **STUDY only**        |

Licenses above describe upstream projects. Any literal code reuse needs proper license review. P26 research can freely study concepts; do not assume GPL implementation can simply be copied into Museum Editor.

---

## Harvest 1 — FreeCAD architectural Section pipeline

**Repository:**
`FreeCAD/FreeCAD`

**Why this repository:**
Strongest open source target for studying actual model → section plane → architectural vector drawing flow without depending only on UI documentation.

Repository is active and mature. Current tree contains a dedicated BIM Section plane implementation plus architectural TechDraw bridge.

**P26 questions it should answer:**

```text
How does arbitrary section plane select/cut model geometry?

How are cut faces separated from projected/background geometry?

How is finite section extent represented?

How does section output become SVG/vector drawing?

How does source-object identity survive into derived section results?

How do Walls/Openings/Roofs participate?

What computation can stay derived rather than persisted?
```

**Exact subsystem(s) to inspect:**

```text
src/Mod/BIM/ArchSectionPlane.py
src/Mod/BIM/bimtests/TestArchSectionPlane.py
src/Mod/TechDraw/App/DrawViewArch.cpp
src/Mod/BIM/ArchVRM.py

src/Mod/BIM/ArchWall.py
src/Mod/BIM/ArchWindow.py
src/Mod/BIM/ArchRoof.py
```

Current FreeCAD tree explicitly includes these BIM modules.

**What evidence would change product direction:**

If Section pipeline requires persistent duplicated drawing geometry or loses stable source identity, Museum should *not* imitate that part.

If clean per-source cut/projected primitives can be derived cheaply from canonical geometry, this strongly supports one reusable Museum `OrthographicRenderModel`.

If arbitrary cuts through curved architecture create serious ambiguity or performance cost, initial Section could constrain supported edit targets while still rendering full cut.

**License / reuse constraints:**

LGPL 2+ FreeCAD source. Study freely. Literal reuse needs license-compatible boundary/review.

**Priority:**
**Primary Phase 2 harvest #1.**

---

## Harvest 2 — IfcOpenShell / Bonsai drawing and view model

**Repository:**
`IfcOpenShell/IfcOpenShell`

**Why this repository:**

Bonsai has explicit target-view taxonomy:

```text
PLAN_VIEW
ELEVATION_VIEW
SECTION_VIEW
REFLECTED_PLAN_VIEW
MODEL_VIEW
```

in real authoring/drawing source.

Its drawing tool also groups persistent drawings by those view types.

Most useful question not “copy IFC”.

Question is:

> what boundaries does a serious open-source BIM authoring system place between canonical model representation, projection/view representation, annotation, and section clipping?

**P26 questions it should answer:**

```text
How is view target represented?

How does orthographic camera orientation derive from target view?

How are cut decorators / projected geometry separated?

How does RCP reverse projection?

How does selection/raycast work against derived section display?

How are annotations separated from model geometry?

How do hosted elements and opening geometry remain canonical while many views consume them?
```

**Exact subsystem(s) to inspect:**

```text
src/bonsai/bonsai/bim/module/drawing/prop.py
src/bonsai/bonsai/bim/module/drawing/operator.py
src/bonsai/bonsai/bim/module/drawing/decoration.py
src/bonsai/bonsai/bim/module/drawing/ui.py

src/bonsai/bonsai/tool/drawing.py
src/bonsai/bonsai/tool/raycast.py

src/ifcopenshell-python/ifcopenshell/util/representation.py
```

The source already shows target-view discrimination and tests for reflected-plan drawing matrix orientation.

Also inspect section/cutaway UI path surfaced in:

```text
src/bonsai/bonsai/bim/prop.py
src/bonsai/bonsai/bim/operator.py
src/bonsai/bonsai/bim/ui.py
```

which carries Section cutaway/decorator state.

**What evidence would change product direction:**

If RCP and Section are mostly camera/projection configuration over same model, this strengthens single `Orthographic` instrument model.

If Bonsai needs separate authored representation contexts for reliable selection/annotation but model editing still uses original object identity, Museum should copy only identity/view separation, not IFC representation machinery.

If reflected plan adds little beyond orientation + visibility policy, P26 RCP should stay lightweight overlay.

**License / reuse constraints:**

IfcOpenShell core LGPL. Bonsai source GPL-3-or-later.

Treat Bonsai harvest mainly as architectural study unless license posture specifically permits code reuse.

**Priority:**
**Primary Phase 2 harvest #2.**

---

## Harvest 3 — Homemaker / Topologic spatial decomposition

**Repository:**
`brunopostle/homemaker-addon`

**Why this repository:**

Different question from FreeCAD/Bonsai.

Homemaker uses Topologic CellComplex to understand building volume. Its source describes decomposition into:

```text
traces
→ 2D chains used for walls/rooms/extrusions

hulls
→ 3D shells used for roofs/soffits
```

Its higher-level generator explicitly obtains `GetTraces()` and `GetHulls()`.

This makes it unusually relevant to P26 ceiling/overhead questions.

**P26 questions it should answer:**

```text
How can horizontal wall/room topology coexist with non-horizontal overhead hulls?

How are rooms/cells distinguished from surrounding shell geometry?

How are roof/soffit surfaces represented without making Room own them?

How do several spaces share one shell?

Which topology data must survive when planar footprint is no longer enough?

What does future multi-level spatial closure require?
```

**Exact subsystem(s) to inspect:**

```text
topologist/__init__.py
molior/__init__.py
molior/shell.py
molior/floor.py
molior/extrusion.py
```

Focus on:

```text
GetTraces
GetHulls
CellComplex
horizontal / vertical / non-horizontal face classification
space/cell allocation
```

Not Blender UI.

**What evidence would change product direction:**

If robust ceiling/roof relationships fundamentally require full volumetric CellComplex topology, this would challenge proposed lightweight independent CeilingRegion model.

If independent traces + overhead hulls compose cleanly without room ownership, that strongly validates proposed P26 architecture.

**License / reuse constraints:**

GPL-3-or-later.

Use primarily as STUDY/algorithmic precedent unless compatible code-reuse decision made.

**Priority:**
**Primary Phase 2 harvest #3, narrowly scoped.**

---

## Harvest 4 — Sweet Home 3D simplicity study

**Repository:**

Official source is Sweet Home 3D project source distribution/SVN.

GitHub mirrors exist; one accessible mirror is:

```text
keich/SweetHome3D
```

It explicitly states it is unofficial mirror.

**Why this repository:**

Not for Section system.

Useful because it represents opposite end of spectrum: consumer-friendly architecture tool where simple Walls and synchronized 3D matter more than BIM depth.

Its Wall model exposes distinct ending height, and Room logic interpolates height when walls split.

**P26 questions it should answer:**

```text
How far can start/end Wall height model go?

How are variable-height Walls tessellated in 3D?

How are splits made without visual discontinuity?

How does simple Plan-first UX expose height?

Where does its ceiling model become insufficient?
```

**Exact subsystem(s) to inspect:**

```text
model/Wall.java
viewcontroller/WallController.java
j3d/Wall3D.java
j3d/Room3D.java
swing/WallPanel.java
```

**What evidence would change product direction:**

If endpoint-height interpolation covers most target museum forms, first P26 Wall profile may start with only two top elevations before arbitrary intermediate peaks.

If gable/complex spaces immediately require hacks, piecewise profile should ship from start.

**License / reuse constraints:**

GPL v2 or later.

Study only unless compatible reuse decision made.

**Priority:**
**Secondary Phase 2 comparison.**

---

## Harvest 5 — Blueprint3D

**Repository:**
`furnishup/blueprint3d`

**Why this repository:**

Museum-adjacent stack:

```text
TypeScript
Three.js
2D floorplan
Walls/Corners/Rooms
3D output
```

Its model source explicitly has Floorplan containing Walls, Corners and Rooms.

Could provide implementation-shape comparison close to Museum's browser environment.

**But:**

Project openly says it was rushed through prototype stages, needs major refactor, better persistence, and tests. Main repo last meaningful update is old.

**P26 questions it should answer:**

Only narrow questions:

```text
How does browser-side Plan topology feed Three geometry?

How are wall-local coordinates represented?

How are Room faces assembled from Wall half-edges?

Which patterns should Museum avoid?
```

**Exact subsystem(s) to inspect:**

```text
src/model/floorplan.ts
src/model/room.ts
src/model/wall.ts
src/model/corner.ts
src/model/half_edge.ts
src/floorplanner/*
src/three/*
```

**What evidence would change product direction:**

Very little.

This repo should not drive P26 product design.

Could help implementation comparison after stronger architecture already decided.

**License / reuse constraints:**

MIT.

**Priority:**
**STUDY-only. Not primary harvest.**

---

# Phase 2 recommended sequence

Do not make one giant agent read all repos.

Use focused harvests.

```text
H1 — FreeCAD
Section plane → cut/projected/vector pipeline

H2 — IfcOpenShell/Bonsai
view semantics → section/elevation/RCP → identity / projection boundaries

H3 — Homemaker
room/cell topology → overhead hull / roof / soffit implications

H4 — Sweet Home 3D
bounded simplicity check:
endpoint Wall heights + consumer UX

H5 — Blueprint3D
optional browser-stack contrast only
```

Then synthesize.

Not:

```text
research every repo
→ mash feature list together
```

Each harvest should answer a different architecture question.

---

# Final P26 direction

Evidence does **not** support making Museum Editor a broader CAD suite.

It supports a more specific step:

> **P26 should make Layout genuinely spatial.**

The strongest bounded product appears to be:

```text
P23
credible architectural Plan + topology
        ↓
P26
canonical vertical architectural form
+ contextual orthographic precision
        ↓
P24
stage objects/materials/light inside that space
        ↓
P25
visitor experience
```

P26 core capability set:

```text
1. contextual Section instrument
2. contextual Wall Elevation
3. shared orthographic render / selection / snap grammar
4. Wall top profiles
5. Opening vertical direct edit
6. independent CeilingRegion
   - flat
   - shed
   - gable
7. Column vertical extent
8. Platform vertical extent
9. bounded 3D architectural direct manipulation
10. vertical-datum-safe canonical architecture
```

Not P26 core:

```text
full Levels
full Roofs
full BIM
persistent sheets
architectural documentation
arbitrary wall-profile sketches
Room-owned ceilings
Scene-owned architecture
full topology-aware Room transforms
```

Most important design principle:

> **Plan defines where architecture is. Orthographic views define exact vertical relationships. 3D proves the space. All three edit one Layout truth.**

And most important schema direction:

> **Room stays semantic space. Ceiling becomes architecture beside Room, not geometry owned by Room.**

This produces high ceiling without losing Museum Editor identity as compact authoring tool.
