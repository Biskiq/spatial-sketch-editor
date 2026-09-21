# P23.15 — Future-Proof Room / Wall / Junction 3D Geometry Research

Research brief constraint me keep throughout: **Wall graph stays canonical, Junction ID stays connectivity truth, Room stays semantic, renderer stays dumb, shared Wall exists once, one compiler authority only.**

## 1. Executive finding

Strongest architecture:

```text
LayoutDocument
  canonical Wall graph + Room references
             │
             ▼
CompiledLayoutGeometry
  ┌──────────────────────────────────────┐
  │ wall paths / curves                  │
  │ junction-local network resolution    │
  │ resolved Wall side boundaries        │
  │ Wall-attributed physical shell       │
  │ derived Room boundary loops          │
  └──────────────────────────────────────┘
        │                       │
        ▼                       ▼
 physical Wall meshes      future RoomVolume
```

**Do not make Room into one ring-shaped Wall solid. Do not keep geometry computation purely per-Wall either.**

Best model = **network-resolved geometry with per-Wall ownership**.

Wall stays physical unit. But Wall cannot compute its final endpoint shape alone anymore. At Junction, compiler must inspect all canonical incident Walls, solve finite-thickness geometry once, then give each Wall its owned piece of result.

So:

> **Per-Wall mesh can stay renderer/selection unit. Per-Wall mesh must stop being geometry-solving unit.**

This closely matches strongest BIM precedent. IFC/Bonsai keeps Walls as separate physical elements and represents path connections separately; body representations then regenerate while accounting for butt/miter/notch connections. ([docs.ifcopenshell.org](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/regenerate_wall_representation/index.html?utm_source=chatgpt.com)) Revit likewise keeps individual Walls while wall joins clean visible intersections, and Room geometry comes from room-bounding elements rather than Room owning those Walls. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-E6B8D985-FB52-4A5E-A825-B12531C3EA5B.htm?utm_source=chatgpt.com)) Archicad similarly keeps connected elements separate while intersection cleanup modifies their resulting geometry. ([help.graphisoft.com](https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-271.htm?utm_source=chatgpt.com))

This also answer curved future. Junction means **topological connection**, not necessarily visible corner. Two curve legs can meet at same Junction and have tangent continuity. Compiler then suppress seam. Move one tangent, now hard bend appears. Same architecture.

---

# 2. Precedent matrix

| Product | Wall ownership | Room / Space model | Boundary representation | Junction cleanup | Curved / circular support | Useful lesson |
|---|---|---|---|---|---|---|
| **FreeCAD Arch/BIM** | Wall remains architectural object generated from base path/wire and width/height. Wall code offsets path wires to construct wall faces. ([github.com](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchWall.py?utm_source=chatgpt.com)) | `Space` represents open volume. It can use a Base solid, boundary faces, or derive shape from bounding elements. ([github.com](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Arch_Space.md?utm_source=chatgpt.com)) | Space stores boundary object/subelement references; footprint can be derived from resulting solid. | Wall path/wire offset and binding handle multi-segment form; FreeCAD may also combine base sketches in workflows. | Walls can use lines, wires, arcs and sketches. ([github.com](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Arch_Wall.md?utm_source=chatgpt.com)) | Space volume and physical Walls are separate concepts. But FreeCAD sometimes merges wall path objects, so do **not** copy its identity model directly. |
| **Bonsai / IfcOpenShell / IFC** | `IfcWall` remains independent physical element. | `IfcSpace` is independent spatial entity; `IfcRelSpaceBoundary` relates Space to physical bounding elements. ([docs.ifcopenshell.org](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/boundary/index.html?utm_source=chatgpt.com)) | Space boundary is relationship + connection geometry, including outer and inner boundaries. Opposite sides of shared Wall may have corresponding Space boundaries. ([ifc43-docs.standards.buildingsmart.org](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelSpaceBoundary2ndLevel.htm?utm_source=chatgpt.com)) | `IfcRelConnectsPathElements` expresses end/path connectivity; regeneration handles butt, miter, clipping etc. ([docs.ifcopenshell.org](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/regenerate_wall_representation/index.html?utm_source=chatgpt.com)) | IFC conceptual model allows richer curves, though current simple Bonsai wall regeneration is more constrained. | **Closest architecture precedent:** connection semantics separate from element body; final Wall geometry depends on neighbours but ownership remains Wall-local. |
| **Revit** | Walls are independent hosted physical elements with their own location lines. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-550F4B3E-7D49-4A4F-BEC7-4077D5B9FC85.htm?utm_source=chatgpt.com)) | Room derives boundary from room-bounding elements; volume then computed from boundary/height. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-9348929C-18CA-40AC-BB64-71D01CC52F2B.htm?utm_source=chatgpt.com)) | API returns ordered boundary loops containing `BoundarySegment`s rather than only polygon vertices. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/8e0919af-6172-9d16-26d2-268e42f7e936.htm?utm_source=chatgpt.com)) | Automatic Wall joins support butt, miter, square-off and join order; joins may also be disabled. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-E6B8D985-FB52-4A5E-A825-B12531C3EA5B.htm?utm_source=chatgpt.com)) | Wall layouts support arcs, circles and ellipses; openings work in curved walls. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2027/ENU/Revit-ArchDesign/files/GUID-05BAFEAA-5186-484E-80F4-8D900C454748.htm?utm_source=chatgpt.com)) | Strong support for **boundary segments, not point polygons**, plus separation between Wall location path and finished physical shape. Implementation internal, so only documented behavior reliable. |
| **Archicad** | Wall remains separate model element with reference line and construction data. | Zone may be manually drawn or automatically derived from surrounding elements. ([helpcenter.graphisoft.com](https://helpcenter.graphisoft.com/user-guide/76551/?utm_source=chatgpt.com)) | Zone can follow inner Wall edges or Wall reference lines. Net perimeter follows inner edges. ([helpcenter.graphisoft.com](https://helpcenter.graphisoft.com/user-guide/88975/?utm_source=chatgpt.com)) | Reference-line intersection establishes connection; material priority and Junction Order determine cleanup. Connected elements remain separate and associative. ([help.graphisoft.com](https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-271.htm?utm_source=chatgpt.com)) | Straight/curved Wall chains supported. Full circular Wall becomes two half-circle Wall elements because Walls need endpoints. ([help.graphisoft.com](https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-10.htm?utm_source=chatgpt.com)) | Very useful Museum Editor precedent: **tangent segmented curves may look continuous**, and a circle need not force a special closed-Wall primitive. |
| **Blender Solidify** | No architectural ownership model. Mesh only. | None. | Mesh topology. | Complex Solidify handles intersections/thickness, but sharp/high-valence geometry becomes costly and difficult. ([docs.blender.org](https://docs.blender.org/manual/en/2.82/modeling/modifiers/generate/solidify.html?utm_source=chatgpt.com)) | Arbitrary mesh/curve geometry possible. | Geometry warning only: naive offset/extrude gets hard around sharp corners and >2-way joins. Full mesh Solidify should not become Museum Editor architecture. |

Big common pattern:

```text
semantic space ≠ physical wall mass
reference/path topology ≠ final visible wall boundary
element ownership ≠ join cleanup
```

That split fits Museum Editor very well.

---

# 3. Geometry-model comparison

| Model | Good | Failure mode | Museum Editor fit |
|---|---|---|---|
| **Independent Wall prisms** | Very simple. Cheap. Easy picking and opening ownership. | Gaps, overlaps, double caps. No correct T/X joins. Curves and mixed thickness make problem worse. | **Reject as durable architecture.** Current baseline only. |
| **Junction-aware per-Wall meshes** | Keeps Wall identity, highlighting, openings, incremental rebuild. | Bad if each Wall independently guesses join. T/X/star joins become conflicting pairwise decisions. Neighbour change invalidates supposedly “local” Wall. | **Good output form, bad solve boundary.** Use only when driven by shared Junction resolver. |
| **Wall-network shell** | Junction sees all incident legs. Handles mixed angles/thickness and continuity. Shared Wall naturally once. | If flattened into one mesh, Wall identity/material/selection lost. Whole-building rebuild too expensive. | **Best basis**, but make it **local network solve + Wall provenance**, not monolithic building mesh. |
| **Per-Room ring solid** | Rectangle instantly looks like box with middle cut out. Room volume easy. | Shared Wall duplicates between Rooms. Physical ownership moves wrongly to Room. Openings/materials/mixed heights become awkward. | **Reject for Wall mass.** Useful later only as Room interior/volume derivation. |
| **Building Boolean/manifold** | Can produce clean final union. Useful for export/analysis. | Expensive and brittle for interactive web editing; attribution, incremental rebuild, picking and opening ownership hard. | **Defer.** Never core authority. |

Recommended hybrid:

```text
Wall paths
   │
   ├── offset / side generation
   │
Junction resolver
   │   sees every canonical incident leg
   │
   ├── trim
   ├── extend
   ├── suppress internal interfaces
   ├── create exposed interfaces
   └── resolve continuity
           │
           ▼
Wall-attributed shell pieces
           │
           ├── hosted Opening cuts
           ▼
renderer triangles
```

Important detail: **solve mainly in 2D footprint space, then extrude by Wall height**.

No need P23.15 full 3D CSG kernel. Most Wall-wall junction work is planar: intersect offset side boundaries, partition local cleanup region, then raise surfaces. Mixed heights become vertical exposure problem after footprint solution.

This cheaper. More deterministic. Better for browser. Easier future section/elevation work.

---

# 4. Shape walkthroughs

## Rectangle

Current:

```text
 ┌──────┐
 │      │    four independent prisms
 │      │    → corners overlap/gap
 └──────┘
```

Recommended:

```text
canonical:
J1──W1──J2
│        │
W4      W2
│        │
J4──W3──J3

compile:
each J resolves its two incident Wall legs
→ four Wall bodies meet continuously
→ internal corner caps suppressed
→ each finished face still has ownerWallId
```

Visually now reads like rectangular shell with middle cut out.

But no actual Room-owned ring Wall exists.

Room loop simply follows the appropriate inside side of W1→W2→W3→W4.

## Triangle / concave polygon

No architecture change.

Every Junction gets same local operation:

```text
centerline legs
       \ /
        J
        │
```

Compiler offsets each Wall by thickness, examines incident directions, intersects/partitions side boundaries, then outputs per-Wall surfaces.

Concave corner only changes which offset intersection forms interior versus exterior side.

This important: **Room shape never special-case rectangle, triangle, concave polygon.**

Room merely gives semantic enclosed loop.

## Shared Wall

```text
┌─────────────┬─────────────┐
│   Room A    │    Room B   │
│             │             │
└─────────────┴─────────────┘
              ↑
          one Wall W7
```

Do **not** compile:

```text
RoomA ring → W7 copy A
RoomB ring → W7 copy B
```

Compile:

```text
             Wall W7
          physical body once
           /            \
Room A boundary      Room B boundary
uses left face       uses right face
```

IFC has almost exact semantic analogue: opposite Spaces can have corresponding boundaries against opposite sides of same physical Wall. ([ifc43-docs.standards.buildingsmart.org](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelSpaceBoundary2ndLevel.htm?utm_source=chatgpt.com))

Opening remains hosted by W7 once.

Later Room A and Room B can each derive opening interruptions in their own boundary/volume view without cloning Door/Window ownership.

## Straight Wall → add Junction → bend

Start:

```text
A ───────────── B
```

One Wall.

Subdivision:

```text
A ───── J ───── B
```

Now two canonical Wall pieces sharing explicit J.

**3D should look identical**, assuming split inherits same thickness, height, alignment and material semantics.

J absolutely may remain canonical.

At compile:

```text
tangent(W1 at J) == opposite tangent(W2 at J)
→ continuity = smooth/collinear
→ no visible end caps
→ no visible seam geometry
```

J exists for history/editing/topology. It simply produces **zero visible corner**.

Then creator moves J:

```text
A ───── J
         \
          B
```

Nothing about topology changes.

What changes:

```text
endpoint tangent W1
        ≠
endpoint tangent W2
```

Compiler reclassifies same canonical degree-2 Junction:

```text
continuous → hard-turn
```

Then offset sides intersect and form deterministic corner.

That separation very important:

> **Junction existence creates connectivity. Tangent discontinuity creates visible bend.**

Internal coincident cap faces from straight subdivision should not survive renderer output.

Do not delete J merely because no seam visible.

### Opening near split

Bonsai current wall-split code gives useful precedent: it keeps filling/Opening semantics associated with one split Wall, while an opening void that straddles split can affect both generated Wall bodies. That keeps one semantic Door/Window while geometry cuts what needs cutting. [Bonsai wall source](https://github.com/IfcOpenShell/IfcOpenShell/blob/v0.9.0/src/bonsai/bonsai/bim/module/model/wall.py?utm_source=chatgpt.com)

For Museum Editor, P23.15 should **not invent new Opening migration rules**. Existing canonical split/edit mutation remains authority. Compiler only receives hosted Opening state and cuts resolved body.

If current editor rejects splitting through an Opening, preserve that. Exact Museum Editor mutation code not supplied here, so me not invent different behavior.

## Straight + curved Wall

```text
────────J
          )
         )
```

Junction solver receives endpoint tangent from both paths.

If curve tangent at J aligns with straight leg:

```text
G1 / tangent continuous
→ suppress visible corner
```

If tangent differs:

```text
hard corner
→ resolve offset-boundary intersection
```

No different renderer architecture.

## Tangent curve + curve

```text
       J
    ___)___
```

Both Walls remain distinct canonical elements.

If endpoint tangent continuous and Wall dimensions compatible:

```text
canonical seam: yes
visible geometric seam: no
```

Different materials may still cause visible material boundary later. Geometry continuity and material continuity should remain separate concepts.

## Oval / circular Room

Do not force new `ClosedWall` type for P23.15.

Archicad gives good precedent: a full circular Wall is represented as two half-circle Wall elements because Walls retain endpoints, yet result reads as one circle. ([helpcenter.graphisoft.com](https://helpcenter.graphisoft.com/user-guide/136886/?utm_source=chatgpt.com))

Museum Editor can safely support future:

```text
         J1
      ╭──────╮
    W1        W2
      ╰──────╯
         J2
```

Both Junctions tangent-continuous.

Compiler suppresses both seams.

Room loop references `W1 forward`, `W2 forward`.

Later, if product gains true closed-path Wall primitive, compiled boundary contract can support it. **No need P23.15 invent it now.**

---

# 5. Canonical versus derived data

This ownership split me recommend.

| Layer | Owns | Must NOT own |
|---|---|---|
| **`LayoutDocument`** | Junction IDs + positions; Wall IDs; Wall start/end Junction refs; canonical Wall path/curve data already allowed by P23.11; thickness; height; role; Wall-hosted Openings; stable Room identity; Room boundary as Wall references/order/orientation if canonical model supports it | Miter vertices, trim polygons, rendered caps, triangulation, welds, Room wall-solid duplication |
| **`CompiledLayoutGeometry`** | Evaluated Wall paths; endpoint tangents; incident Junction legs; deterministic angular ordering; join classification; resolved offset side boundaries; trim/extend results; exposed/internal interfaces; Opening cuts; Room-side boundary spans; provenance | Editable source truth; Scene ownership; renderer-inferred topology |
| **renderer mesh output** | positions, normals, UVs, indices, material groups, `wallId`/surface provenance needed for picking/highlight | Junction decisions, topology discovery, coordinate welding, Room semantics |
| **future `RoomVolume`** | Derived usable/semantic interior volume; interior perimeter; floor/ceiling faces or references; mappings back to Room boundary/Wall faces | Wall physical mass; duplicate Walls; canonical connectivity |

### Room boundary contract

`LayoutVec2[] polygon` alone not durable.

Better conceptual canonical contract:

```ts
type RoomBoundaryUse = {
  wallId: WallId;
  direction: 'forward' | 'reverse';
};
```

Then compile it into actual interior side geometry:

```ts
type CompiledRoomBoundarySegment = {
  wallId: WallId;
  direction: 'forward' | 'reverse';
  side: 'left' | 'right';       // derived
  span: CompiledCurveSpan2;     // derived finished room-side boundary
};
```

Why better:

```text
rectangle     ✓
triangle      ✓
concave       ✓
many-sided    ✓
line+curve    ✓
oval          ✓
shared wall   ✓
```

Raw polygon points lose Wall identity and cannot naturally represent true curve spans.

Revit's public API similarly exposes Room boundaries as **loops of boundary segments**, not merely point arrays. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/8e0919af-6172-9d16-26d2-268e42f7e936.htm?utm_source=chatgpt.com)) Archicad Zones can derive limits from actual inner Wall edges rather than only reference points. ([helpcenter.graphisoft.com](https://helpcenter.graphisoft.com/user-guide/76551/?utm_source=chatgpt.com))

One caveat: me do not know exact current `LayoutWallFirstRoom` boundary field shape from supplied source. So this is target contract, not claim current implementation already has ordered directed uses.

---

# 6. P23.15 review

Me could not line-review PR #72 itself. GitHub connection returned 404 for guessed Biskiq repository path, and uploaded material contains research brief but not exact PR plan. So this section evaluates **P23.15 direction named in brief**: per-Wall meshes, deterministic Junction seam ownership, `CompiledJunction` / `CompiledJunctionLeg`. No invented PR details.

## Stay

**Canonical Junction identity stays sole connectivity truth.** Geometry tolerance can decide whether two already-connected legs are visually tangent, but must never create connectivity.

**Walls stay physical owners.** Each finished shell surface must trace back to Wall.

**Openings stay Wall-hosted.** Do not relocate openings to Room shell.

**`CompiledJunction` and `CompiledJunctionLeg` idea stays.** This is right place where neighbour context enters compiler.

**Renderer can still receive per-Wall meshes.** This remains excellent for selection, material assignment, caching and highlighting.

**Deterministic Junction ownership stays.** But interpret this as deterministic **surface/provenance partition**, not Junction becoming physical owner.

## Change before implementation

Big change:

> Replace **“per-Wall mesh stays geometry unit”** with **“per-Wall ownership/output stays unit; Junction-local network solve determines geometry.”**

Otherwise P23.15 may fix rectangle miters but paint itself into corner for T/X joins and curves.

Add explicit intermediate resolution step:

```text
CompiledWallPath
     +
CompiledJunction incident legs
     ↓
CompiledJunctionResolution
     ↓
CompiledWallBody / surfaces
     ↓
mesh
```

`CompiledJunctionLeg` should know enough for future curve work:

```ts
type CompiledJunctionLeg = {
  wallId: WallId;
  end: 'start' | 'end';

  // evaluated at canonical Junction
  tangentOut: Vec2;

  thickness: number;
  height: number;

  // reference into already-compiled Wall path;
  // not another topology system
  path: CompiledWallPathRef;
};
```

Do **not** model leg as only endpoint + straight direction if P23.11 already introduced curved Wall paths. That would hardcode straight geometry into P23.15.

Then:

```ts
type CompiledJunctionResolution = {
  junctionId: JunctionId;

  // deterministic circular order around Junction
  legOrder: readonly WallEndRef[];

  joins: readonly CompiledLegJoin[];
};
```

Each join result can say something conceptually like:

```ts
type CompiledLegJoin = {
  wallId: WallId;
  end: 'start' | 'end';

  leftBoundary: ResolvedEndBoundary2;
  rightBoundary: ResolvedEndBoundary2;

  endCap: 'exposed' | 'suppressed';
};
```

Exact shape type should reuse P23.11 geometry types. Do not create second curve abstraction just for P23.15.

### Cache invalidation also change

Wall final geometry now depends on neighbour geometry.

So this is false:

```text
Wall changed
→ only rebuild that Wall
```

Correct dependency:

```text
Wall/Junction changed
→ recompute affected Junction resolution
→ invalidate every incident Wall body
→ rebuild those bodies only
```

Still nicely local.

No need whole-building compile.

### Join semantics

P23.15 should support generic categories, not hardcode only rectangle corner:

| Junction | Derived behavior |
|---|---|
| degree 1 | exposed terminal cap |
| degree 2, collinear/tangent | continuous; suppress interface |
| degree 2, hard turn | deterministic miter/trim; bounded fallback if miter invalid |
| degree 3, clear through-pair | through Walls continue; branch butts/trims into them |
| degree 4, clear crossing pairs | local multi-leg cleanup |
| higher degree | deterministic angular arrangement if currently valid topology permits it |

Revit documents similar distinction: ordinary intersections use butt/miter/square-off, while T connections constrain allowed join behavior. ([help.autodesk.com](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-E6B8D985-FB52-4A5E-A825-B12531C3EA5B.htm?utm_source=chatgpt.com)) IFC connection types likewise distinguish start/end/path relationships. ([docs.ifcopenshell.org](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/connect_path/index.html?utm_source=chatgpt.com))

If current Museum Editor canonical validity excludes a case, P23.15 must **not make it valid just because resolver could handle it**.

### Add acceptance invariants

Most valuable acceptance cases:

```text
split straight Wall at J
→ visual shell unchanged

move J into bend
→ corner appears deterministically

two tangent curved legs
→ no visible geometric seam

straight + tangent curve
→ no corner

T and X junction
→ no pairwise overlap/gap artifacts

two Rooms sharing one Wall
→ one physical Wall body

opening close to Junction
→ remains Wall-hosted and cuts correct body

same LayoutDocument
→ editor and visitor consume same compiled result
```

These test architecture, not just one rectangle screenshot.

## Defer

P23.15 should **not** grow into:

- author-controlled miter/butt/bevel UI;
- wall priority/material-layer cleanup system;
- RoomVolume UI;
- floor/ceiling editing;
- true closed no-Junction Wall primitive;
- NURBS/full CAD curves;
- building-wide CSG/manifold kernel;
- automatic topology welding from coordinates;
- new valid Junction degree cases.

Preserve extension points. No product scope creep.

---

# 7. Recommended compiled contracts

Me suggest roughly this shape:

```ts
type CompiledWallPath = {
  wallId: WallId;

  // Uses one compiled path abstraction capable of current
  // straight + P23.11 curve forms.
  path: CompiledPath2;

  startJunctionId: JunctionId;
  endJunctionId: JunctionId;

  thickness: number;
  height: number;
};
```

```ts
type CompiledJunctionLeg = {
  wallId: WallId;
  end: 'start' | 'end';

  tangentOut: Vec2;
  thickness: number;
  height: number;

  path: CompiledWallPathRef;
};
```

```ts
type CompiledJunction = {
  junctionId: JunctionId;
  position: Vec2;

  // canonical incidence only;
  // ordering here derived geometrically after incidence known.
  legs: readonly CompiledJunctionLeg[];

  resolution: CompiledJunctionResolution;
};
```

```ts
type CompiledWallBody = {
  wallId: WallId;

  centerPath: CompiledPath2;

  leftBoundary: readonly CompiledCurveSpan2[];
  rightBoundary: readonly CompiledCurveSpan2[];

  startBoundary: CompiledWallEndBoundary;
  endBoundary: CompiledWallEndBoundary;

  height: number;

  openingCuts: readonly CompiledOpeningCut[];
};
```

And provenance needs survive all way to mesh:

```ts
type CompiledWallSurface = {
  wallId: WallId;

  role:
    | 'side-left'
    | 'side-right'
    | 'top'
    | 'terminal'
    | 'junction-exposed'
    | 'opening-reveal';

  geometry: CompiledSurfaceGeometry;

  junctionId?: JunctionId;
  openingId?: OpeningId;
};
```

This gives future material system stable semantic surface roles without Room stealing them.

Room side:

```ts
type CompiledRoomBoundaryLoop = {
  roomId: RoomId;
  segments: readonly CompiledRoomBoundarySegment[];
};

type CompiledRoomBoundarySegment = {
  wallId: WallId;
  direction: 'forward' | 'reverse';

  // derived from loop orientation + resolved wall shell
  side: 'left' | 'right';

  span: CompiledCurveSpan2;
};
```

That contract becomes bridge to later:

```text
CompiledRoomBoundaryLoop
        +
floor elevation
        +
ceiling / upper limit
        ↓
future RoomVolume
```

No rewrite needed.

---

# 8. Decision / deferral table

| Question | Decide for P23.15 | Preserve extension point | Defer |
|---|---|---|---|
| Physical geometry ownership | **Wall owns physical material** | Per-surface provenance/material roles | — |
| Connectivity | **Canonical Junction IDs only** | — | proximity welding |
| Geometry solve scope | **Junction-local/network-aware** | larger regional solver if someday needed | global CSG |
| Mesh packaging | **May remain per Wall** | batching across Walls | making mesh topology authority |
| Degree-2 straight subdivision | **No visible geometry change** | material seam if properties diverge | — |
| Hard corner | **Derived from tangent break at existing Junction** | configurable join policy | author join UI |
| Curved joins | **Endpoint tangent is input to continuity decision** | richer exact curve offset routines | NURBS kernel |
| T/X joins | **Resolver sees all incident legs together** | priority system | material-layer priorities |
| Mixed thickness | **Offset boundaries resolved at Junction** | wall alignment/compound layer rules | BIM skin cleanup |
| Mixed height | **Same footprint solve; Wall height remains individual** | richer vertical joins | sloped/compound wall systems |
| Openings | **Remain Wall-hosted; cut resolved Wall body** | straddling-junction geometric handling | Room-owned openings |
| Room boundary | **Wall-referenced segment loop, not new point-only assumption** | holes/multiple loops/closed curves | RoomVolume authoring |
| Shared Wall | **Compile physical Wall once** | opposite room-side relationships | duplicated Room rings |
| Circle / oval | **Several tangent curved Walls is valid architecture** | future true closed path | special closed-Wall primitive |
| RoomVolume | Keep architecture compatible | compiled boundary loop | **actual volume feature** |
| Renderer | **Pure consumer** | optimized batching | topology inference |

## Final P23.15 direction

Me would revise plan around one sentence:

> **P23.15 compiles canonical Wall topology into a junction-resolved, Wall-attributed physical shell. Junction resolution is network-aware, while Wall identity remains the unit of ownership, openings, selection and optional mesh packaging. Room geometry is a separate derived boundary view over that same compiled shell.**

That solve current ugly rectangle corners.

But more important: same model survives triangle, concave Room, T/X Junction, curved Wall, tangent chain, oval Room, shared Wall, mixed thickness, RoomVolume later.

No second compiler. No Room-owned fake shell. No topology rewrite later.
