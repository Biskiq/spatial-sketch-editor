# T1 V-plan — Architectural Volume and Verticality

**Status:** V1a implementation plan for owner review before code. V1b–V1d are separate
implementation slices. V2/V3 remain planned extensions. Production cutover is subject to §9.

**Capabilities:** `layout.horizontal-region` (V1, V3), `layout.wall-top-profile` (V2).
**Base audited:** `main` at `d251445c` (SP2, #377).

**Authority:** the approved [T1 next batch](./README.md#architectural-volume-and-verticality)
(PR #290; decisions Q7, Q8, Q9, Q10, Q16), its [slices](./implementation-prs.md#lane-d-depth),
journeys [J7–J9](./creator-journeys.md#j7-a-courtyard-and-a-canopy) and
[J11](./creator-journeys.md#j11-working-inside-a-finished-room), the
[SP-plan](./sp-plan-open-spaces.md) (#305), the C-plan (#304), the
[Layout contract](../../reference/layout.md) (the P26 verticality vocabulary and
mechanisms D2 and D3), [persistence](../../reference/persistence.md), the
[editing-path rules](../../reference/layout.md#editing-path-rules) and the T2 proposal's
[coordination section](../t2-look-atmosphere/README.md#10-coordination).

**Evidence:** repository code, contracts and tests at the audited base. Deployed project and release
inventories require the cutover evidence in §9.

## 1. Verdict

1. **One region family, one collection, a stated role.** `regions: LayoutRegion[]` with
   `role: 'floor' | 'overhead'`. A region is a slab: footprint, Floor-relative elevation,
   thickness, form. The role states which face is the datum face and which face gives support. It
   is stated at birth and never changes.
2. **Regions are physical geometry and nothing else.** They carry no closure intent, no
   appearance and no Space ownership. A Space's generated floor and lid stay derived from its
   outline and depend only on the Space's `overhead` intent (SP-plan I11). The P26 words "closure
   versus suspended" are superseded by Q8 and leave the Layout contract when V1a merges.
3. **Remove `floorThickness` and `ceilingThickness` from the Room record in V1a** (OD-1, §9).
   A Space owns identity, boundary and overhead intent. Its generated floor and lid are surfaces.
   The physical thickness of an authored floor or overhead belongs to its region (§5.2).
4. **A Wall keeps `height` and gains one required `top`.** `height` is the lowest point of the
   top; `top` adds rise above it: `level`, `slope` or `gable`. Readers that need the actual top switch to `wallTopAt`/
   `wallTopRange` in V2. A level Wall compiles to today's output, cache keys included.
5. **Shed and gable are forms of an overhead region**, defined as one or two planes over the
   footprint. No hips, valleys or extra profile joints.
6. **Relations are derived readings; fits are one-shot planners.** The only authored relation fact
   is a per-region list of Walls whose gap is intended. Two fit planners serve V1 and V3 with the
   same definitions: *Fit Roof to Walls* stops at first contact, *Fit Walls to Roof* seals.
7. **Five format bumps across the batch:** SP1a has landed. V1a, C1, V2a and V3a follow in
   that order (§9, OD-3).

## 2. Landed baseline

| Area | State at `d251445c` and implication for V1 |
| --- | --- |
| Layout 8 and SP1 | `layout-wall-first-types.ts` and `layout-wall-first-codec.ts` admit required `virtualEdges` and `overhead`, and positive finite Room thicknesses. `composeSpaceBoundary`, `spaceAtPoint` and `CompiledRoom.overhead` are live. Open to sky keeps the floor and identity and removes the rendered lid. Both merge paths, split, duplicate and Room birth still carry the thickness rules. |
| SP2 | `space-create-session.ts` → `space-create-planners.ts` → `layout-space-create*.ts` and `layout-room-reconciliation.ts` implement Room tool claims and virtual closure in format 8. Preserve their planner, selection and F4 behavior through §5.2. SP1d's open-side handles remain Room/Space behavior. |
| Stage and Lift | `stage-facade.ts` rebases Camera from compiled document bounds. X1 is live: `interior-lift-store.svelte.ts` reads `overheadSourcesOf`, and the shell and Stage ink/picking still address Room lids by Room id. X2 is live and Wall-only. |
| Plan and Slice | `layout-plan-representation.ts` already evaluates datum-relative cut, depth, span and reveal in cold and retained paths. SL1/SL2 are live: `slice-cut.ts` supplies the resolved Level/Drawn cut, and Stage clipping, section mesh collection and Plan pick clipping apply it. §5.8 integrates regions with those paths. |
| Shared draw path | `StageCanvas.svelte` and `VisitorPreviewSurface.svelte` both mount `VisitorLayoutShell.svelte`, which owns retained Wall, Room and Layout-object representations. A Room floor is a plane plus a shadow catcher. The generated lid is a plane at maximum boundary Wall height, and exists in the shell only for `closed`. |
| Scene support | `layout-floor-support.ts` validates Room-floor witnesses against the Floor datum and merges equal-elevation witnesses. Scene's pointer path currently intersects the datum and checks occlusion first, then resolves support at snapped X/Z. It needs the visible raised-top path in §5.6. Scene source remains world-local. |
| Storage and public | F2 uses the Layout constant for both admitted versions. Save is conditional and append-only. Load/rename validate the latest row, whereas listing checks the F2 epoch. Preview consumes the active accepted snapshot. Product public reads are in the T4 publication gap (§9). |

## 3. Model

### 3.1 Types

```ts
/** Independent horizontal architecture. Never owned by a Space, Wall or Junction. */
type LayoutRegion = {
  id: string;
  /** Stated at birth, immutable. Decides the datum face and the supporting face. */
  role: 'floor' | 'overhead';
  footprint: { kind: 'polygon'; points: LayoutVec2[] };
  /**
   * Metres above `floor.elevation`, of the datum face at its lowest point:
   * the top of a floor region, the underside of an overhead region.
   */
  elevation: number;
  /** Metres, measured vertically. Extends down from a floor top, up from an overhead underside. */
  thickness: number;
  /** V1 admits `flat` only. V3 widens the union. */
  form: LayoutRegionForm;
  /** Wall ids whose gap to this region is intended. Sorted, unique. The only authored relation. */
  intendedGaps: string[];
  name?: string;
};

type LayoutRegionForm =
  | { kind: 'flat' }
  // V3. Overhead role only. `azimuth` is a plan angle in radians, in (-pi, pi].
  | { kind: 'shed'; rise: number; azimuth: number }
  | { kind: 'gable'; rise: number; azimuth: number; ridgeOffset: number };

type LayoutWall = {
  // ...existing fields. `height` keeps its meaning for a level Wall and becomes
  // "the lowest point of the top" for the others.
  top: LayoutWallTop; // V2. Required on every Wall.
};

type LayoutWallTop =
  | { kind: 'level' }
  // Rises in metres above `height`. Exactly one end is 0.
  | { kind: 'slope'; startRise: number; endRise: number }
  // `apexOffset` is metres from the canonical Wall start, like an Opening offset.
  | { kind: 'gable'; startRise: number; endRise: number; apexRise: number; apexOffset: number };

type LayoutDocumentWallFirst = {
  // ...existing fields
  regions: LayoutRegion[]; // V1. Required, document order.
};
```

`LayoutWallFirstRoom` loses `floorThickness` and `ceilingThickness` in V1a. `name` is optional and
follows the existing Wall/Opening nonblank-name rule. Every other new region/root field is
required. The existing optional ledger rule stays in effect at the document root. When a ledger
is present, require its `regions` map. Canonical writers emit it, using the existing global cursor
and allocation order with `regions` appended and `H-xxxx` references. Existing assignments and
cursor/high-water semantics are preserved. A region id is unique across selectable Layout
collections and the Floor datum. Keep region order on write and sort `intendedGaps` by the same
ordinal string comparison used to check it on read.

### 3.2 Region invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| G1 | The footprint is a simple polygon of 3 to 1,024 points, positive signed area in world X/Z, distinct vertices, every edge longer than `LAYOUT_GEOMETRY_EPSILON` and at most 1,000 m, no holes. Exactly 1,000 m is allowed and world translation is unrestricted | Codec (shape, count, finiteness, edge dimension); shared Layout admission/compiler check (repeated vertex, self-intersection and nonpositive area report distinct blocking issues) |
| G2 | `elevation` is finite, within ±1,000 m; a floor region's is ≥ 0, an overhead region's is > 0 | Codec |
| G3 | `thickness` is finite, > 0 and ≤ 1,000 m | Codec |
| G4 | `role` never changes after birth | Planners: no intent writes it |
| G5 | Two regions share no interior volume: plan interiors share area **and** their vertical bands overlap by more than the relation epsilon. Touching and exact stacking are allowed | Shared Layout admission/compiler check, blocking (`region_overlap`) |
| G6 | Every `intendedGaps` entry names an existing Wall; the list is sorted and unique | Codec (`missing_reference`, `invalid_value`); existing Wall writers carry lineage from V1a (§5.5) |
| G7 | A non-flat form requires `role: 'overhead'` (V3) | Codec (`region_form_requires_overhead`) |
| G8 | No Wall, Junction, Opening or Layout object references a region. A Room references one only through SP3's follow relation | Types |
| G9 | A region carries no appearance, no closure intent and no stored transform. Its points are project-world X/Z | Types |
| G10 | Relation cues, handles, ghosts and fit proposals never reach a visitor chunk or a release | Visitor parity test; public-surface boundary |

For a sloped form, G5 uses the conservative band `[elevation, elevation + rise + thickness]`. A
region cannot be tucked inside another's rise envelope where they overlap in plan; the refusal says
so.

### 3.3 Wall-top invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| P1 | `top(s) = height + rise(s)`, `rise(s) ≥ 0`, and the smallest end rise is exactly 0, so `height` is always the lowest top and each shape has one encoding | Codec |
| P2 | `slope`: one end rise is 0 and the other is > the height epsilon | Codec |
| P3 | `gable`: `apexRise` exceeds both end rises by more than the height epsilon, and `0 < apexOffset < length` by more than the station tolerance | Codec (values); compiler, blocking (`wall_top_apex_outside`) because length is derived |
| P4 | Rise is linear in **centerline station** between breakpoints, on straight and curved Walls alike | Compiler: one accessor |
| P5 | A closed Wall is `level` | Codec (`closed_wall_level_only`) |
| P6 | `height + max rise` is within the 1,000 m envelope | Codec |
| P7 | Every Opening fits under the lowest top over its own interval | Opening-set validator |
| P8 | A level Wall's compiled record, cache key and mesh buffers equal today's | Compiler; test T-P1 |

### 3.4 Ownership

| Owner | Owns |
| --- | --- |
| Layout document | Region records and Wall tops |
| A new `layout-region.ts` in layout-core | Region validation, footprint accessors, form evaluation (`regionUndersideAt`, `regionTopAt`), region planners |
| A new `layout-region-relations.ts` | The derived Wall relations and the two fit planners |
| A new `layout-wall-top.ts` | `wallTopAt`, `wallTopRange`, the breakpoint list, split and join arithmetic |
| Canonical compiler | `CompiledRegion`, region query records, the G1 and G5 blocking issues, compiled Wall top profiles |
| `layout-floor-support.ts` | Upward and downward support candidates, including regions |
| Layout Plan representation | Region primitives with source identity |
| Runtime-safe mesh builders and the shared shell | Triangulating compiled region faces and sloped Wall tops. They decide nothing |
| Editor adapter and shell | Intents, handles, Card, Index, consequence lines, relation cues. No region geometry of their own |
| Scene, Camera, Experience | Nothing new in Layout's document. §8 |

## 4. The ten architectural decisions

| # | Question | Resolution |
| --- | --- | --- |
| 1 | Authored regions versus derived Space surfaces | Separate, never merged. A Space's floor and lid are generated from its outline and are not persisted. A region is authored and independent. A region never suppresses, trims or replaces a generated surface; only the Space's `overhead` intent removes a lid. Association between the two is the derived query `regionsOverSpace` (§5.6) |
| 2 | `floorThickness`, `ceilingThickness` | Remove the authored fields and their compiled copies, cache inputs and bounds padding in V1a (OD-1, §9). Keep the generated surfaces and their source references (§5.2, §5.7). |
| 3 | Region identity and references | A captured document-global id; a fifth ledger family `regions`. Surface references are the region id plus `top`, `underside` or `edge`, never minted per compile. Region edits keep the id. §5.7 |
| 4 | Footprint and sloped-top geometry | G1–G5 for footprints; forms are one or two planes parameterised by `rise`, `azimuth` and `ridgeOffset` over the footprint's own extent (§7.1); Wall tops are P1–P8 |
| 5 | SP1's `overhead: closed \| open-to-sky` | Untouched and still the only thing that decides a lid. A region reads and writes no intent. The Card readout "Open to sky · under *name*" is `overhead` plus `regionsOverSpace` |
| 6 | Shared-Wall profiles, intersections, Openings, clearance | A Wall has one top for both of its sides. A Wall may pass through a region: it reads **crosses** and nothing is cut. Regions may not interpenetrate each other (G5). Openings must fit under the top over their interval (P7). Clearance is the first downward-facing surface above a point, from the overhead support query |
| 7 | Layout, Scene, Camera, Experience | §8 |
| 8 | Format sequencing | One format-changing slice in flight; numbers taken at merge; five bumps in the batch. §9 |
| 9 | Lift | X1 has landed. V1c, the first creator-facing authoring slice, ships with region Lift and Put back (OD-2) |
| 10 | T2's J/S5a and S5b | Layout-local resolvers and queries ship in V1. The published wire type, finish storage and inheritance, unresolved-reference behaviour, persistent attachment and cross-unit history stay with J/S5. §14 |

## 5. V1 — flat horizontal regions

### 5.1 Datum and faces

```text
world datum face  = floor.elevation + region.elevation
floor region      top = datum face          bottom = top - thickness
overhead region   underside = datum face    top    = underside + thickness
```

The Card shows both Floor-relative and world elevation (Q7). A floor region at elevation 0 is
legal. When its top is coplanar with a generated Space floor, §5.8 governs draw and pick priority.
T-V8 still requires both witnesses for coincident support.

### 5.2 Generated surfaces and regions

- A `closed` Space keeps its flat lid at `floor.elevation + max(boundary Wall heights)` whatever
  regions exist. A dropped ceiling is an overhead region below that lid. A creator who wants the
  region to be the only overhead sets **Open to sky**; the readout then names the region.
- No coverage arithmetic exists: no partial lid, no lid cut around a region, no "closure" region.
  This replaces the Layout contract's "Generated fallback only for uncovered enclosure" and
  "ambiguous overlapping-closure surface is refused" with G5 and the intent rule.
- "Converting a generated surface to an authored region" is two explicit steps, each its own
  history entry: **Fit to space** at region birth or later (§5.5), then **Open to sky**.

**Thickness cutover (OD-1).** Spaces describe places and enclosure. Independently identified
Layout elements own physical construction geometry, in line with Q8 and the
[vertical architecture contract](../../reference/layout.md#accepted-future-requirements).
Drawings can use region faces and extents for physical sections and
dimensions, and use Space surfaces and boundaries to describe the enclosure. Any future assembly
or layer model would refine the physical element's thickness authority. V1 defines the region's
single thickness scalar.

V1a removes the Room metadata writes and the thickness-only merge refusal on both the enclosed
and open merge paths. Preserve the existing survivor, overhead, identity, associations and
surface-reference rules. Switching back to **Closed** regenerates the lid at its derived
elevation. Room bounds enclose the floor plane, the lid plane if closed, and the physical boundary
Walls. Use the compiled floor and ceiling polygons at their own elevations. Floor and document bounds
can contract where padding was extremal. The delta depends on the stored values (0.1 m is the
birth default). Test cold and retained bounds, default Camera framing and source rebase (T-V1).
Generated floor/lid elevation, support and surface identity retain their existing meanings.
SP2's Room tool, SP1's open-side lifecycle and associations use the resulting Room shape.

### 5.3 Planners

The region planners in `layout-region.ts` return one validated candidate or one typed refusal.
V1c installs accepted candidates through F4. Geometry-neutral edits keep current ids, source
order and flags. A region-only operation never calls `reconcileRooms`.

| Planner | Does | Refuses |
| --- | --- | --- |
| `planCreateRegion` | Role, footprint, elevation, thickness, optional name; id from the capture | G1–G5 |
| `planMoveRegion` | Translates every point by one delta | G5 |
| `planRotateRegion` | Rotates every point about the footprint's area centroid; in V3 adds the angle to `azimuth` | G1 (precision), G5 |
| `planSetRegionFootprint` | Replaces the points: corner move, corner insert, corner remove, typed size | G1, G5 |
| `planSetRegionElevation`, `planSetRegionThickness` | Scalars | G2, G3, G5 |
| `planSetRegionIntendedGap` | Adds or removes one Wall id | Unknown Wall; no gap to mark |
| `planRenameRegion`, `planRemoveRegion` | Metadata; removal | – |
| `planDuplicateRegion` | New captured id, offset placement, empty `intendedGaps` | G5 |

### 5.4 Wall relations

A relation is a pure function of compiled output, computed on demand for one region. It is never
stored and never compiled per edit.

**Plan class** of a region `R` with footprint `F` against a Wall `W`, using `W`'s two offset face
polylines and the body strip between them:

| Class | Condition |
| --- | --- |
| `through` | Both faces have points strictly inside `F` over a common station interval |
| `edge` | Not `through`, and `F`'s boundary touches or lies within the body strip (distance ≤ ε) |
| `near` | Neither, and the distance from `F`'s boundary to the body strip is ≤ 1.0 m |
| none | Otherwise |

**Reading**, with `slabBottom` and `slabTop` from §5.1 and `wallTop` from `wallTopRange` over the
stations concerned:

| Class | Vertical condition | Reading | Measure |
| --- | --- | --- | --- |
| `through` or `edge` | `wallTop < slabBottom − ε` | **gap** | `slabBottom − wallTop`, vertical |
| `through` or `edge` | `slabBottom − ε ≤ wallTop ≤ slabTop + ε` | **meets** | – |
| `through` | `wallTop > slabTop + ε` | **crosses** | – |
| `edge` | `wallTop > slabTop + ε` | **meets** | – |
| `near` | `wallTop ≥ slabBottom − ε` | **gap** | horizontal distance |
| `near` | `wallTop < slabBottom − ε` | none | – |

`ε` is 1e-6 m, the support query's coplanar tolerance. The 1.0 m reach is a named constant. The
principle behind the table: *a Wall meets a region when their solids touch or overlap with no
visible gap and the Wall does not come out the other side.* That is why a footprint drawn to Wall
centerlines, as a generated floor is reads **meets**.

A **gap** whose Wall id is in `intendedGaps` reads **intended** and still shows its measure. It
offers no fix. Marking is `planSetRegionIntendedGap`.

### 5.5 One-shot fits

Four explicit operations. Each is one planner, one history entry, atomic. Each writes the proposed
geometry only. After a fit the two subjects are independent and the next reading may be a gap.

| Operation | Planner | Effect |
| --- | --- | --- |
| **Fit to space** | `planFitRegionToSpace` | Footprint becomes the Space's compiled outline (centerline polygon; curved Walls contribute their compiled samples). Refuses above 1,024 points |
| **Meet wall** | `planFitRegionEdgeToWall` | For a horizontal gap to a straight Wall: the nearest footprint edge, if parallel to the Wall within 1e-6 rad, translates along its normal to the Wall's near face. Refuses a curved Wall or a non-parallel edge with words |
| **Fit roof to walls** | `planFitRegionToWalls` | Changes `elevation` only, to first contact with the highest chosen Wall top: flat case `slabBottom = max wallTop` |
| **Fit walls to roof** | `planFitWallsToRegion` | Sets each chosen Wall's top to the region's lower face: flat case `height = slabBottom − floor.elevation` through `planExactWallHeight`'s gates |

The last two are for overhead regions and specialize §7.3 to flat, level geometry. Use the same
region id and explicit Wall set inputs in V1 and V3. Fit roof uses only chosen Walls whose compiled
body touches or overlaps the footprint. Fit walls requires each eligible Wall's entire centerline
inside or on the footprint. List partly covered Walls as skipped, refuse when none qualify, and
validate all height and Opening gates together against the same baseline before one acceptance.
Use compiled geometry, with no write at all if any eligible Wall fails. Preserve the existing
empty/no-op result convention.

**Wall lineage for `intendedGaps`.** V1a admits imported region source, so existing Wall writers
must preserve it from the format cutover. A single `carryRegionWallIntents(regions, correspondence)`
handles split/noding (including the retained segment and SP2 Room-tool noding), dissolve/join,
removal and noding chain commits. A split fans out to all descendants, a join unions flags into its
survivor, retirement without successor drops the id, and independent Wall births (including
duplicate) inherit none. Use the actual planner correspondence before canonical validation and
keep unchanged arrays by identity. G6 is the backstop. V1b adds the authoring planner that marks
or clears the flag. C's later attach, repack and release add their call sites (T-V9, H-5).

### 5.6 Support, clearance and association

- **Upward support (V1b).** `queryFloorSupports` gains `region-top` for floor-role regions.
  Witness source becomes `{ kind: 'room', roomId } | { kind: 'region', regionId }`. Keep Room
  datum cross-checks, generation checks, coplanar witness merging and distinct-elevation
  `choice-required`. A region witness must match compiled region id, role and top elevation.
- **Downward support (V1b).** `queryOverheadSupports(snapshot, { generationId, x, z, aboveElevation? })`
  mirrors upward support's validation, tolerance and witness merging. It returns closed-Space lids
  and overhead-region undersides, sorted by increasing elevation, with downward normals and typed
  source witnesses. If supplied, `aboveElevation` selects faces more than the coplanar tolerance above that height. Clearance reads the first result minus the starting elevation. Only the top
  of a floor region and the underside of an overhead region offer support.
- **Pointer placement (V1d).** Extend the existing Scene Place pointer path to find the nearest
  visible upward support along the actual ray, using compiled footprints, current reading visibility
  and the existing occluder test. A nearer solid side, underside, Wall or Scene body still blocks;
  only a floor-role top can win as a new support. Use the hit's world X/Z for snap, requery at the
  snapped point and pin that elevation and generation with the existing `SceneSupportChoice`.
  If snap invalidates that candidate, refuse rather than select another height. Without pointer
  evidence, preserve explicit choice for ambiguous elevations, existing datum fallback when no
  authored floor support covers the point, and required-elevation rules for Move. One candidate with
  both Room and region witnesses still resolves once.
- **Association (V1b).** `regionsOverSpace(compiled, roomId)` returns regions whose footprint
  shares positive interior area with the compiled Space, ordered by id. Lift uses this overlap
  rule for Space scope; T2's separate paint scope is H-8. Add `region` alongside `room-lid` in
  the existing `overheadSourcesOf`, sharing underside facts with the downward query. The `all`
  scope returns all lids and overhead regions, with existing lid order and stable region-id order.
- **SP3 surface key.** `{ kind: 'datum' } | { kind: 'region'; regionId }`. Every Space is on
  `datum` until SP3 provides the follow relation (§14).

### 5.7 Surface references

Layout-local, in layout-core, opaque above it:

```ts
type LayoutRegionSurfaceRef = { regionId: string; surface: 'top' | 'underside' | 'edge' };
type LayoutSpaceSurfaceRef  = { roomId: string;  surface: 'floor' | 'lid' };
```

- `edge` is the whole perimeter; edges and corners have no identity of their own.
- A Space's `lid` is unresolved while the Space is `open-to-sky`. C-plan's aggregate
  `{ roomId, role: 'inside' }` is a third member of the same family and is C's to add.
- Lineage: every region edit keeps the id, so all three references survive move, rotate,
  footprint, elevation, thickness and every fit. Duplicate creates three new references from the
  source's three. Removal leaves them unresolved. There is no region split or merge.
- V1a qualifies the Stage's selected subject as Layout `region` through the existing unit
  resolver. The representation can use the surface as a component sub-reference. V1d qualifies
  floor support evidence through F1 and exposes the Layout-local surface resolver. The evidence
  lives in the prepared placement result. T2's published finish key and storage stay with J/S5
  (§14, H-8).

### 5.8 Compiled output and presentation

```ts
type CompiledRegion = CompiledIdentity & {
  regionId: string;
  role: 'floor' | 'overhead';
  footprint: LayoutVec2[];
  /** World Y of the lowest and highest points of the slab. */
  bottomY: number;
  topY: number;
  /** Planar faces, wound outward. The builder triangulates and decides nothing. */
  faces: { surface: 'top' | 'underside' | 'edge'; polygon: Vec3[]; normal: Vec3 }[];
  bounds2: LayoutBounds2;
  bounds3: LayoutBounds3;
};
```

- **Compile.** `CompiledLayoutGeometry.regions` is required, in document order. Emit `region-top`
  for floor role, `region-underside` for overhead role and one `region` query AABB per region.
  Query records carry source id and Floor id. Keep existing query record ordering, appending region
  records after the existing subject records and before the summary Floor/document AABBs. Include
  region extents in Floor/world and document bounds without assigning regions to a Room.
- **Validation and reuse.** Share G1/G5 predicates between canonical source admission and the
  compiler's blocking diagnostics, so Save and Stage agree. Reuse `polygonsShareInteriorArea`
  after an AABB rejection, then apply the G5 vertical-band rule. Check the common unchanged-empty
  path without a region scan. Retain each region by id, Floor datum and its own geometry inputs
  (role, footprint, elevation, thickness, form), excluding name and intended gaps from geometry
  keys. In `layout-geometry-delta.ts` preserve the retained region query/bounds unit on normal
  Wall/Junction edits. A region change may use the existing full retained entry point and reuse
  unchanged Wall/Room units. Cold compile, retained fallback and certified delta must agree on
  arrays, query records, plan/reuse indexing and bounds. The certified route must prove that
  its region inputs are unchanged before carrying the unit forward.
- **Mesh and coplanarity.** A runtime-safe builder triangulates the compiler's outward planar
  faces and retains the mapping from `faceIndex` to `top`, `underside` or `edge`. For a positive X/Z
  loop, the compiler reverses the upper polygon for its upward normal, keeps the original order
  on the underside and winds the side quads outward. The closed mesh gives Slice the full solid.
  A shared retained region representation mounts once in `VisitorLayoutShell.svelte`, leases the Canvas's material resources, and uses floor
  and ceiling tones for top and underside/edge respectively until T2. Regions cast and receive
  shadows. For the floor-role top at the Floor datum, use a dedicated opaque top material with
  depth bias toward the viewer (polygon offset factor/units `-2/-2`, ahead of the Room's
  catcher at `-1/-1`). Draw it after the Room opaque floor so the later catcher fails depth
  in the overlap. Preserve canonical vertex Y, shadow-caster geometry and both source records.
  Check the overlap with the Stage mat, the Preview ground and an authored casting light.
- **Plan.** Feed one candidate per region to `evaluateLayoutPlan` and `createPlanRetainer` using
  the same builder. Classify against `datumMeters + cutHeightMeters`: wholly above is a
  `hidden` dashed outline in normal Plan, a plane strictly through the slab is `cut` at cut
  Y, and a slab below or merely tangent is `projected` at the visible face. Share the landed
  Slice contact tolerance (1e-4 m) from layout-core. Tint projected floors and outline projected
  overheads. Keep the existing depth, span, filter and reveal contracts. Use `component` subRefs
  with stable face roles. Assign the cut polygon to `edge` and the above-cut outline to
  `underside` for overheads or `top` for floor regions. Keep existing Wall/Opening/object/Room stream behavior.
- **Slice.** Level Slice hides slabs wholly above the cut or below its depth window; it uses the
  same footprint for section ink through the interior and clips hits at the same resolved limits.
  Drawn Slice clips the same rendered mesh and the same Plan polygon using the existing clip
  cells. In `scene-pick-source.ts` register each region's closed mesh under a section group
  `layout-region:<id>`, separate from Walls and other regions. Reuse the existing cap and exact
  pick filters and existing selected-hidden ghost policy. Stage clip/ink/picks must agree at
  either boundary, across drawn depth/Flip, and at zero-area tangency.
- **Picking.** Reuse the retained identity index and production hit providers. In a 3D distance
  tie within the coplanar tolerance, a region top outranks a coincident generated floor. In Plan
  the same floor tie is resolved above the Room fill; dashed overhead footprints are outline
  hits only. Preserve existing Wall/Opening and Scene arbitration. Plan and mesh hits qualify
  to the same region subject; Preview shares as-built geometry and component attribution.

### 5.9 Editor surface (V1c)

Built from the approved grammar ("Platform: corner points and a height ray") and the registered
tools. Anything not listed here is not designed and is not built.

- **Create.** **Terrace** makes a floor region; **Roof › Flat** makes an overhead region. Both
  draw like Walls: Box (two corners) or Line (click, click, close). Elevation is the Height
  Sheet's height. An overhead at datum takes the Wall creation default, and regions start at
  0.10 m thick. Enable Terrace and Roof › Flat in the registry, with Pitch options deferred to V3.
- **Edit.** Corner knobs move points; dragging a corner onto the line between its neighbours
  removes it, as a bend point is removed; **Add corner here** is a scoped-list action on an edge.
  The height ray sets elevation. Body drag moves; the turn mark rotates. Thickness, exact size
  and both elevation readouts are Card fields.
- **Card.** Kind line, name, Elevation (Floor-relative and world), Thickness, Area, and
  **Relations**: one row per related Wall reading *meets*, *gap 0.40 m*, *crosses* or
  *gap 0.40 m · intended*, each gap row with its fit and **Mark intended**.
- **Stage.** The selected region's gaps are drawn as a measured dimension. No cue is drawn for an
  unselected region.
- **Index.** One group, **Regions**. A Space's Card lists the regions over it and reads
  "Open to sky · under *name*" when that applies.
- **Lift.** Consume the typed `OverheadSourceKey`/subject in the Lift store, `StageCanvas`, the
  Stage Lift ink and Plan/3D outline pick paths. Pass typed keys from Stage to the shared shell.
  The retained region representation switches visual layers using X1's layer mechanism. Preserve
  caster eligibility in the actual Stage shadow pass for every relevant light (including sun and
  authored spot/point), and draw the selected ghost/handles only in the editor. Put back restores
  the as-built view. Preview and Look-through draw as built and carry no Lift reading.
- **Height Sheet.** Region tops and undersides are found-surface ticks from the Layout adapter.
- **Erase.** The Eraser removes a region. It asks nothing in Layout; Scene consequences are §8.

## 6. V2 — Wall top profiles

### 6.1 Geometry

`layout-wall-top.ts` is the only place a top is evaluated.

```text
breakpoints(wall, L):
  level  -> [(0, 0), (L, 0)]
  slope  -> [(0, startRise), (L, endRise)]
  gable  -> [(0, startRise), (apexOffset, apexRise), (L, endRise)]
wallTopAt(wall, s)        = height + linear interpolation at clamp(s, 0, L)
wallTopRange(wall, a, b)  = { min, max } over [a, b]
```

The clamp is deliberate: mitred corner vertices sit at stations outside `[0, L]`, and clamping
makes both Walls at a corner evaluate exactly their end height, so corner seams stay closed.

### 6.2 Compiler and mesh

- `CompiledPhysicalWall` gains optional `topProfile: { distance, topY }[]`, present only for a
  non-level top. `height` stays the authored scalar. `bounds3` uses the peak. The cache key appends
  the top only when it is not level (P8).
- Sections are additionally split at the apex. A section's `topY` is the maximum over its span, so
  every existing bound stays conservative; the true edge comes from the profile.
- Junction legs take `topY` from `wallTopAt` at their own end, and `endpointSolidBands` takes the
  same value. Height steps, keels and trims are then resolved by the existing band logic from
  local facts, unchanged.
- `wall-mesh-builder.ts`: apex distances join the clip knots; the top vertex of each face is
  `wallTopAt` at the vertex's station; the top face is a ruled quad with its normal from geometry;
  band clamping gains the mirror of the Wall mesh's sloped-bottom rule. With no
  `topProfile` the builder takes today's code path untouched.
- Room ceilings stay `max(boundary Wall heights)`, the eave heights. A gable does not raise a lid.
- Openings: `opening_exceeds_wall_height` compares against `wallTopRange(...).min` over the
  Opening's interval, with the existing epsilon. An arch is tested by its bounding height.
- Development: the Wall mesh develops through its existing station/offset/height attribution. The
  sheet mesh options gain `topProfile`; face frames use the peak.

### 6.3 Planners

| Operation | Rule |
| --- | --- |
| `planSetWallTop` | Writes kind and values, normalising to P1 (moving the lowest rise into `height`). Refuses P3, P5, P6, P7, each naming the Wall or Opening |
| `planExactWallHeight` | Unchanged signature; shifts the whole top rigidly |
| Split | Exact: each fragment's ends take `wallTopAt` at the cut; a gable split at its apex gives two slopes, elsewhere a gable and a slope; each fragment is re-normalised, so a fragment's `height` may differ from its source's |
| Join, dissolve | Accepted when the tops are continuous at the joint (within the height epsilon) and the merged top is a level, a slope or a gable: the interpolated height at the joint must equal the joint height within the epsilon, or the joint is the one peak. Otherwise `wall_top_not_joinable`. A split followed by a join round-trips |
| Length or Junction move | `apexOffset` stays in metres, as an Opening offset does. A move that leaves the apex outside the Wall refuses whole |
| Duplicate, Room move | Copy the top unchanged |
| Bend, straighten | Keep the top; P4 makes it valid on the new centerline |
| C: Round rings | Member arcs may carry tops. Repack to one closed Wall requires every member level and equal (P5). A radius edit scales `apexOffset` by the ratio, as it scales Opening offsets |
| Wall birth | `level` |

### 6.4 Editor surface (V2c)

- **Card › Top:** Level | Slope | Gable, then Height (the eave), Rise and Apex position, with
  **Centre apex**.
- **Marks.** Hexagon height knobs at each end of the top and at the apex, placed at
  `(station, height)` through the development map of the current reading. On an unrolled Wall they
  are on the sheet. On a Wall that is not unrolled they are on the Wall's own face, which is the
  same map at amount 0. This is how a straight gable end is edited although its Unroll entry is
  disabled (OD-6).
- Top edits are height-family edits and stay allowed while a Wall is unrolled, as Wall height is.
- Nothing in Plan changes.
- **Relation cue station (open from the V2a review).** A vertical gap's measure is correct: the
  region underside minus the highest Wall top over the covered station intervals. Its
  `measureSegment` is still anchored at the nearest footprint/body contact point, not at the station
  that sets that highest top. On a sloped or gabled Wall, the cue can therefore stand where the
  actual top is lower than the measured end. V2c draws the cue at the governing station, inside a
  covered interval. V3 keeps the same rule once the underside varies with the form: the cue sits at
  the station that sets the measured gap.

## 7. V3 — shed and gable forms

### 7.1 Form geometry

Let `d = (cos azimuth, sin azimuth)` and `q(p) = p · d` over the footprint, with `qMin` and `qMax`
its extremes.

```text
shed   underside(p) = datum + rise * (q(p) - qMin) / (qMax - qMin)
       azimuth points uphill.

gable  the ridge is the line q(p) = qr, qr = (qMin + qMax) / 2 + ridgeOffset
       underside(p) = datum + rise * (q(p) - qMin) / (qr - qMin)   where q(p) <= qr
                    = datum + rise * (qMax - q(p)) / (qMax - qr)   where q(p) >= qr
       azimuth is perpendicular to the ridge.

top(p) = underside(p) + thickness
```

- `elevation` is the eave, the lowest underside, on every form: the same convention as a Wall's
  `height`. Both eaves of a gable are at the eave height; the two pitches differ when the ridge is
  off centre.
- Codec: `rise > 0`; `azimuth` normalised; `|ridgeOffset|` strictly inside the half extent, which
  is a compiler check because the extent is derived.
- Any simple footprint is valid. The form is a profile extruded across the footprint and clipped
  by it. There are no hips, valleys, dormers or further joints.
- Compiled faces: the footprint is split along the ridge; each piece gives one top face and one
  underside face, and the perimeter gives vertical edge faces. `regionUndersideAt` and
  `regionTopAt` are the only evaluators, shared by compiler, relations, support and fits.
- Pitch is displayed, derived from rise and run. Only rise is stored.

### 7.2 Form planners and Edit shape

- `planSetRegionForm` writes kind and values. Changing kind keeps footprint, eave and thickness.
  When azimuth is omitted on entry to a form, choose the edge with greatest squared length in
  plan. Order each edge's endpoints lexicographically by `(x, z)` and break equal-length ties by
  the lexicographically smallest ordered endpoint pair. Let `θ = atan2(Δz, Δx)` from the first
  endpoint to the second. A shed defaults to `θ` (uphill). A gable defaults to `θ + π/2` so its
  ridge runs parallel to that edge. Normalize to `(-π, π]`. The endpoint order fixes the sign of
  `d`, so positive `ridgeOffset` moves the ridge toward `qMax`. Cyclic reindexing or a reversed
  edge traversal yields the same choice.
- A new gable defaults to `ridgeOffset: 0`. Default rise is `tan(30°)` times the full projected run
  for a shed, or the longer of the two projected eave-to-ridge runs for a gable. These defaults
  apply when the form is set. Footprint edits keep the stored azimuth, and rotation adds the
  rotation angle as in §5.3.
- **Edit shape** (PLATE, the grammar's Roof row): a roof-local section perpendicular to the ridge,
  drawn on the roof with joint points.

  | Form | Joints | Drag |
  | --- | --- | --- |
  | Shed | Low eave, high eave | Low: `elevation`. High: `rise` |
  | Gable | Eave, ridge, eave | Either eave: `elevation` (both move). Ridge: `rise` vertically, `ridgeOffset` horizontally |

  The midpoint **＋** appears on a shed only and turns it into a gable. Dragging a gable's ridge
  joint onto the line between the eaves removes it and leaves a shed, or a flat region when the
  eaves were level. A gable shows no **＋**. Exact joint values are Card fields. The ridge ray and
  the eave ray of the grammar write `rise` and `elevation`.
- The reading control's **3D | Section** segment uses A6's `face` intent with a direction Layout
  supplies. If the Face slice A6 has yet to land, V3c ships Edit shape in 3D and Section follows.

### 7.3 The two fits, in general

Both are explicit and atomic. Each accepted fit writes geometry in one history entry, with no
stored relation.

Evaluate the portion of the compiled Wall body's plan strip inside or on the roof footprint,
including resolved ends and mitres. Use the Wall's canonical top station mapping and endpoint
clamps (§6.1). Clip the plan cells at the footprint, the roof ridge and Wall profile breaks.
Where the clipped station-to-world mapping and roof evaluation are affine (including straight
Wall pieces), extrema occur at piece vertices. That premise is **not** automatic for curved Walls:
centerline station is generally nonlinear in world coordinates. V3b must certify conservative
extrema for the actual compiled curved Wall strip and evaluator, with the stated tolerance, or
refuse the fit atomically if the bounds cannot be established. Vertex-only sampling is not proof.
Use verified extrema for both fits and the derived reading. A fit requires covered Wall geometry.

```text
wallTopY(p) = floor.elevation + wallTopAt(wall, station(p))
contact     = min over covered points p of (underside(p) - wallTopY(p))
gap         = max over covered points p of (underside(p) - wallTopY(p))
overrun     = max over covered points p of (wallTopY(p) - top(p))
```

- **Relation.** Keep §5.4's plan classes and horizontal gap rule. A `through` Wall reads
  **crosses** when `overrun > ε`, including when another part has a gap. Otherwise an `edge` or
  `through` Wall reads **gap** when `gap > ε` (with that measure), and **meets** otherwise. A fit
  checks both bounds for every fitted Wall, including `edge` Walls.
- **Fit roof to walls** (`planFitRegionToWalls`). Changes `elevation` only, by
  `−min over the chosen Walls of contact`. The roof moves straight up or down to first contact.
  Walls that still show a gap say so.
- **Fit walls to roof** (`planFitWallsToRegion`). The set is every chosen Wall whose whole
  centerline lies inside the footprint or on its boundary; a Wall only partly under the roof is
  left alone and named in the consequence line. For each eligible Wall, derive the centerline
  profile from the two ends and any interior ridge crossing. Raise the whole profile by the
  smallest nonnegative uniform sealing allowance, `δ = max(0, gap)` measured against that profile.
  Admit the normalized candidate only if `gap ≤ ε` and `overrun ≤ ε` for every fitted Wall, so
  each reads **meets**. If the allowance breaches the upper face, refuse the entire fit and name
  the blocking Wall and the overrun in metres. The creator can adjust the roof thickness or shape
  and retry, or edit the Wall tops directly. Capping the allowance could leave a gap. Searching
  for a different profile within the roof thickness would change the fit rule and is deferred.
- **Refusals**, each naming its subject and writing nothing: a curved Wall whose fitted top would
  not be level; a closed Wall under a sloped form; an Opening that would exceed the new top; a
  fitted top outside P1–P7; G5 after moving the roof. A gable roof's underside along a straight
  Wall is concave with at most one breakpoint. The shape is level, slope or gable, subject to the
  existing Wall-top tolerances.

J8's hall fixture uses a roof thick enough for its Wall widths and pitch. Draw the roof, run
**Fit roof to walls**, then **Fit walls to roof**. All four Walls read **meets**. Each accepted
action has one Undo entry, and later edits are independent.

### 7.4 Support and overlap under a sloped form

`queryOverheadSupports` evaluates `regionUndersideAt` at the point and returns the face's true
normal. G5 uses the conservative band (§3.2).

## 8. Boundaries

| Domain | Owns here | Does not |
| --- | --- | --- |
| **Layout** | Region and Wall-top geometry; identity; compile; relations; fits; support and clearance queries; surface references; Plan and mesh representation | Store a colour, material, light, object, attachment or Camera fact. Move anything in another unit |
| **Scene** | Finishes keyed by a published surface reference (T2 D1); object and light placement that *reads* Layout support; any persistent attachment | Derive a surface from Room shape; write Layout |
| **Camera** | Views and framing, reading Layout bounds as today | Treat a region as a navigation surface. A View on a platform is an authored pose |
| **Experience** | Nothing new | Target a region in this batch |
| **Editor session** | Lift, ghosts, relation cues, fit proposals, Edit shape's section reading | Persist or publish any of them |

**OD-4.** Region edit and Erase are Layout-only and preserve Scene bytes. Before either action on a
floor region, the V1c Card counts the Scene roots whose contact point and base height resolve to
that region's upward witness on the accepted snapshot (V1d). Count each root once, including
coincident Room-floor witnesses. Use the existing Scene definition/model contact rules and count
zero on overheads. The count is derived from the baseline and creates no attachment.

## 9. Format, sequencing and rollback

| Order | Slice | Layout source change |
| --- | --- | --- |
| 1 | SP1a, landed (#371) | 7 → 8, adds `virtualEdges` and `overhead` |
| 2 | **V1a** | 8 → 9 on the audited base. Adds required `regions` and the region ledger map, removes Room thickness |
| 3 | C1 | Next admitted version after V1a. Adds Room `round` using the V1a Room shape |
| 4 | **V2a** | Next admitted version after C1. Requires Wall `top` |
| 5 | **V3a** | Next admitted version after V2a. Admits shed and gable forms |

**Serialization.** V1a owns the next Layout format slot (OD-3). Keep one format-changing
implementation in flight, and verify the preceding admitted format against `main` at acceptance.
`LAYOUT_WALL_FIRST_FORMAT_VERSION` also defines the F2 Layout unit's admitted version. Bump it once.
The F2 envelope version, Postgres `source_format = 'unit-envelope-v1'` epoch and all sibling
unit versions stay current. Every format slice ships one strict reader, rejects the outgoing
format at both Layout and envelope headers, and regenerates maintained fixtures, starter/demo
sources and authored test snapshots with canonical builders. Keep frozen outgoing samples for
refusal and cutover/recovery tests.

### Stored source and activation

- `apps/api/src/project-persistence.ts` lists by storage epoch and loads
  `projects.latest_version` from `project_versions`. Both Layout versions use the same
  `source_format` fence. Consequently old heads stay listed and fail Load on the new reader.
  `app.ts` currently sends a generic storage error for this case. V1a gives owner-scoped
  Load and Rename an explicit `422 unsupported_layout_format` for a Layout version mismatch, using
  the existing Scene-mismatch pattern. Keep canonical issue details on Save refusal and preserve
  local draft and saved-base state on Open/Reload/Resume failure. Keep list visibility and the
  failed Load state. The client offers recovery before any replacement Save.
- The storage contract keeps immutable versions. `save-persistence.ts` also retains each
  acknowledged operation's exact request identity and saved-base provenance. A new-format reader
  cannot replay an old-format pending capture simply because its commit may already exist.
  `platform/project-pending-save.ts` currently clears captures that fail envelope validation.
  For a structurally valid capture with a Layout version mismatch, return a typed incompatibility
  before ordinary expiration/invalid cleanup. Keep the raw capture available for download from
  the recovery prompt, including when cloud Load itself refuses. Preserve it until explicit user
  disposition and prevent a new sign-in handoff from overwriting it. Retain the operation receipt
  on the server. Reconcile against the outgoing reader or the recovery path below. Fence mixed
  old/new writers and preserve owner scoping and conditional writes.
- **Activation evidence (owner/environment gate).** Before enabling any deployment of the new
  reader over existing storage, inventory each environment and owner/trial project in authorized
  read-only access. Enumerate **every stored revision** by both
  `document.units.layout.header.formatVersion` and `document.units.layout.data.formatVersion`,
  separate latest heads from history, and report mixed/missing stamps. Inspect Room thickness
  values in all affected revisions, including latent values under open sky. Inventory known
  distributed editable files and local/pending work through the trial owners, and separately
  verify deployed publication pointers/snapshots. Record aggregate counts, owners' dispositions
  and recovery proof on the PR or its private cutover runbook. Repository evidence establishes
  reader behavior. Actual deployed counts and dispositions are open at planning.
- **Disposition.** If the inventory finds only disposable fixtures, keep the result and proceed
  with the strict format. Any real accepted trial project, promised editable source or durable
  release needs its named pre-baseline disposition under
  [persistence](../../reference/persistence.md#baselines-and-disposable-alpha).
  For accepted source, the default exception shape is a bounded, owner-approved offline
  conversion. Back up the original envelope/JSONB for every affected revision, accepted
  revision ids, dependency locks, referenced assets and receipts with a checksum and a tested
  outgoing-reader restore. Export pending captures as their exact bytes. If thickness carries
  user meaning or a promise requires in-product historical revision access, bring that concrete
  conflict to the owner before activation. Keep both values recoverable per original Room and
  revision, including non-default values. A conversion creates no slab from those values.
- **Recovery and conversion proof.** Dry-run against a restored copy using the outgoing
  validator, rebuild the edited Layout through the current F2 builder, and validate the whole
  candidate with canonical source admission and cold compile. Preserve project/owner ids,
  existing Layout subject ids and ledger assignments, topology, Room intent, sibling units,
  pins and dependency lock meaning. Recompute affected content identities from canonical bytes.
  Append a fresh accepted head through conditional Save under a writer fence. Existing version
  rows and receipts remain intact, with old-to-new head provenance recorded. Keep a usable
  export/restore for historical revisions; any requirement for those revisions to open in the
  new app belongs to the approved exception. Verify restore, current Load, stale/ambiguous
  Save behavior, and that a failed validation/write leaves the prior head and receipt state
  intact. Retire the temporary tool after the covered heads and recovery evidence are verified.
  No migration 005 rerun, database reset, bulk deletion, tolerant live reader, or implicit
  rewrite of the old revision.
- **Rollback.** Before switching readers, preserve new-format heads, history, pending captures
  and pin closure as well as outgoing data. A code rollback alone cannot open a new-format head,
  even if it contains zero regions. Exercise restoring to a separate copy (or roll forward with
  the new reader), with an explicit owner disposition for any writes accepted after the switch.
  Apply this same rule to C1, V2a and V3a, then to all later authored shapes.
- **Publication.** On the audited tree, the API refuses Publish with
  `501 prepared-reader-required` and both public document and asset endpoints return 404.
  The dormant `/p/[publicationId]` client still has an F2 cold-bundle fixture seam via
  `composeColdReleaseBundle`. Its outgoing-format fixture refuses through the same strict
  reader. Prove as-built parity in Preview and shared runtime fixtures. Preserve the public guard
  and release ABI. If the inventory finds durable snapshots, preserve their reader, pins and
  provenance under the release contract.

Promote enduring rules when their slices land, including the indicated Layout and persistence
paragraphs, glossary and SP/C handoffs. Keep the remainder of this plan for V2/V3, then retire it
after V3c.

## 10. Affected modules

Paths in the table are relative to the named workspace's `src/`.

| Slice | Owner and touchpoints |
| --- | --- |
| **V1a · source** | Layout core: `layout-wall-first-{types,codec}.ts`, `layout-identity.ts`, `layout-geometry-limits.ts`, new `layout-region.ts`, current source builders and persistent collection/materialization helpers where required. Remove Room thickness from `layout-room-reconciliation.ts`, `layout-wall-topology-ops.ts`, `layout-duplicate.ts` and callers. Add §5.5 lineage beside the existing split/noding, dissolve/join, removal and chain/Room-tool writers, using their correspondence. |
| **V1a · compile and Stage** | Layout core: `layout-geometry{,-types,-delta,-reuse,-queries}.ts`, `layout-plan-representation.ts`. Editor: shared `layout/` mesh builder, `render/` retained representation, render identity and material resources, `visitor/VisitorLayoutShell.svelte`. Authoring: `scene-pick-source.ts`, `plan-hit.ts`, `plan-pick-provider.ts`, Plan ink/surfaces, `stage/semantic-selection.ts` and Stage Slice wiring. Project model: region subject admission via `references/unit-resolution.ts`. |
| **V1a · persistence** | Project model: `units/{types,validate}.ts` and source/Save capture entry points inherit the Layout change. API: `app.ts`, `project-lifecycle.ts` and existing Save validation/receipts. Editor: `stage/source-admission.ts`, `project-session/project-session.svelte.ts` and `platform/project-pending-save.ts` for incompatible pending captures. |
| **V1b · planning and queries** | Layout core: `layout-region.ts`, new `layout-region-relations.ts`, `layout-floor-support.ts`, `layout-geometry-queries.ts`, existing height/Opening gates. Update typed callers at the witness and overhead-source seams without changing their producer workflows. |
| **V1c · authoring** | Editor: `authoring/adapters/layout.adapter.ts` and `adapters/layout/*`, F4 acceptance/history, `world-toolbar/registry.ts`, `stage/shell/world-index-model.ts`, Card, Height Sheet, `interior-lift-store.svelte.ts`, `StageCanvas.svelte`, `StageLiftLayer.svelte`, Lift outline picks and shared shell display input. |
| **V1d · consumers** | Project model: `scene-planning/{support,place-object,operations}.ts`. Editor: `adapters/scene/{pointer-support,support-occlusion,room-membership}.ts` and Scene adapter placement callers. Layout core exports its local resolver and support queries. |
| **V2/V3** | Wall-top evaluation in new `layout-wall-top.ts`, Wall compiler/mesh, Opening validation, precision and topology planners, `layout-wall-development.ts`, and the V1 region compiler/planner/render seams as specified in §§6–7. |

## 11. Slices

Every creator edit uses one chronological F4 entry with captured identity. Undo/Redo restores
authored bytes and assignments, preserving the existing cursor high-water semantics. Refusals
leave source and history intact. Ownership and code entry points are in §10. Tests use the
existing repository lanes and colocate with the suites named below.

### V1a · format, compile and read-only selection

- **Dependency and result.** SP1/SP2 have landed. Carry the next Layout version on this draft once
  the owner reviews the plan. Deliver §§3.1–3.2, 5.1–5.2, the admitted-source lineage from §5.5,
  and §5.8 through normal Stage, Preview and Save/Load entry points. Region selection is read-only
  in Stage. Pass §9 before enabling new-format readers over existing storage.
- **Tests and gate.** T-V1–T-V3, T-V9, the draw/pick portion of T-V11 and T-V14. Extend
  `layout-geometry.test.ts`, `layout-plan-representation.test.ts`, `layout-plan-retainer.test.ts`,
  SP1a–SP1d/SP2 lifecycle and parity suites, the Stage source-admission/Save suites and the
  Camera framing/rebase coverage. Verify that Load, Rename, Save and pending-capture refusal
  preserve old data and receipts and that capture recovery exports the original bytes. Use
  hand-built raised floor, canopy and dropped ceiling fixtures, a coplanar terrace with a casting
  light, concavity, touching/stacking, a mixed
  Room/Wall/region delta edit and Level/Drawn Slice cases. Exercise F2 acceptance from Open and
  Preview and the DB-backed API's Save/Load/refusal and publication gates. Existing architecture
  suites prove both visitor boundaries. A fixture with gaps survives each existing topology
  writer, and regions draw and select with the same identity through the retained shell.
- **Exclusions.** Region CRUD/fits, support behavior, Lift controls or region authoring UI.
  Existing Room/Wall editing remains available on region-bearing source. C1, SP3 and V2/V3
  producer and schema work stay in their own changes.

### V1b · planners and queries

- **Dependency and result.** After V1a. Implement §5.3, the relation/fit planners in §§5.4–5.5,
  and the Layout-owned queries of §5.6. Use the current level Wall fields through a small
  evaluator seam. V2 supplies profiled evaluation; V3 expands the existing form/fit contract.
  Keep current Scene placement and X1 behavior until their consuming slices. Narrow existing
  Scene queries to Room-floor records at the snapshot adapter until V1d updates placement, and
  narrow the editor Lift query to existing Room-lid keys until V1c wires region Lift.
- **Tests and gate.** T-V4–T-V10 through real planners and query entry points, with an accepted,
  no-op or refused result as applicable. Cover concave footprints, Room/Space outline fit,
  horizontal versus vertical gaps, Opening and geometry refusal, query qualification, stable
  ordering, and an overhead under both closed and open-to-sky Space scopes. Cover existing
  Walls and Rooms before and after fits. Treat the known closed-circle certification defect
  [#370](https://github.com/Biskiq/spatial-sketch-editor/issues/370) as an existing limitation.
  Fit to Space requires a valid compiled outline, including for curved Spaces.
- **Exclusions.** Creator tool/gesture wiring, Scene elevation selection, finish keys and
  Scene mutation, persistent follow, Wall top profiles, roof forms.

### V1c · authoring, Lift and Stage parity

- **Dependency and result.** After V1b and the V1d support/contact seam. X1 and Slice already
  exist on `main`. Implement §5.9. Region candidate creation, exact edits, move, rotate,
  corner edits, duplicate, fits, gap marking and Erase use layout-core planners on release
  and F4 for acceptance/history. Use proposal-only geometry for pointer moves and register
  region Lift with the existing shadow-preserving path.
- **Tests and gate.** T-V5, T-V7 and T-V11–T-V13. Mounted F4 coverage verifies capture, exact
  Undo/Redo, stale/refused commit, Escape and one history entry per valid gesture. Render and
  pick coverage uses the existing Lift/section-source and Stage tests, including shadow
  eligibility, Put back, and as-built Preview/Look-through. Focused QA exercises J7 and the
  applicable J11 steps 1, 2 and 4. Canopy, dropped ceiling and raised floor create, move, resize
  and change height. Fits stay one-shot and a floor move/erase reports the count from §8.
- **Exclusions.** Ink reading chips, new control grammar, multi-level/stair behavior, T2 finish
  or light UI and region attachments.

### V1d · Scene support and reference seam

- **Dependency and result.** After V1b, can be implemented independently of V1c's UI. Land before
  V1c exposes authoring. Wire §5.6 into production Scene Place (preview and commit) and qualify
  F1 support evidence using a `region` subject and `layout:region-top` stream. Update support
  witness consumers with the discriminant. Room membership filters to Room witnesses and keeps
  its current geometric checks. Provide the Layout-local resolver of §5.7 and the exported
  overhead and contact queries for T2/V1c. Source keeps the placed object pose only.
- **Tests and gate.** T-V8 and T-V10 plus production Scene support tests. Place under overlapping
  floor/terrace projections and prove the visible top, snapped X/Z and planner-revalidated
  elevation match. Test explicit ambiguity, stale evidence, an occluding Wall/Scene body,
  snapping off a raised top, and the unchanged datum/Room behavior. Verify that subsequent
  region move/erase leaves Scene bytes identical and the derived count follows current contact.
  Resolve each local region face through geometry changes, then refuse a removed region and an
  open-to-sky lid. Floor-region placement and the downward-query proof satisfy OD-8.
- **Exclusions.** T2's magnet/finish wiring, Scene format changes, persistent attachment and
  auto-ride.

### V2/V3 acceptance carried forward

V2a follows completed V1 and the format order in §9. V2b depends on V2a and the landed Wall
lineage; V2c follows V2b. V3a follows V2a and the format order; V3b follows V3a and V2b.
V3c follows V3b, with the Face dependency scoped to the Section segment in §7.2.

- **V2a.** The previous format is refused. T-P1 passes. Hand-built slope and gable Walls render
  with closed corners at every Junction degree in the fixture set, with and without Openings.
- **V2b.** Each row of §6.3 has a core test. T-P2 to T-P6 pass.
- **V2c.** The approved V2 sentence holds: a Wall top can be level, sloped or gabled; Openings,
  mesh and the Unroll sheet agree with it. A straight gable end is edited on its face.
- **V3a.** The previous format is refused. Flat regions compile unchanged (T-R1). Shed and gable
  fixtures compile to planar faces that close without gaps (T-R2).
- **V3b.** Both fits pass T-R3 to T-R6, T-R8 and T-R9. Form defaults pass T-R7.
- **V3c.** The approved V3 sentence holds, and J8 passes with two explicit fits. A thin-roof
  refusal identifies the blocking Wall and the measured overrun, with no history entry.

## 12. Tests that separate a correct design from one that only looks right

| # | Test | A superficial design fails because |
| --- | --- | --- |
| T-V1 | With no regions, compare pre- and post-bump fixtures (including non-default thickness values and `closed`/`open-to-sky` Spaces). Allow only `regions: []`, the removed compiled fields and Room key inputs, and the new unpadded Room/query, Floor and document bounds. Cold and retained compiles agree. Check Camera's default framing and source rebase against those bounds, with authored Views and the current inspection pose preserved on rebase | The renderer looks the same but compiled extents or a bounds consumer still assumes Room slab padding |
| T-V2 | A footprint that self-crosses, is clockwise, has a repeated point or exceeds the envelope: each refuses with its own code | The triangulator accepts it and draws garbage |
| T-V3 | Compile counters: a region move rebuilds one region and no Wall or Room; a Junction move rebuilds no region. Exercise a certified delta over region-bearing source and prove query, bounds and Plan parity against a cold compile | Regions are keyed on the whole document |
| T-V4 | Each row of §5.4, including a footprint drawn to Wall centerlines (meets) and a Wall rising through a canopy (crosses) | Relations are computed from centerlines only and call the generated-floor case a crossing |
| T-V5 | Fit, then move the Wall, raise it, and move the region: the other subject is byte-identical and the reading is a gap again | A fit left a stored link |
| T-V6 | Two regions made to interpenetrate by create, move, rotate, elevation, thickness or any fit that edits a region: refused, document byte-identical, no history entry. Exact stacking and edge contact accepted | G5 is checked on create only |
| T-V7 | Open to sky removes the lid and leaves every region; adding, moving and removing a region changes no Space's `overhead` and no lid | A region is treated as closure |
| T-V8 | Under a platform over a Room floor, the support query returns two candidates at two elevations; on a region coplanar with the Room floor it returns one candidate with both witnesses; a Room witness with a wrong datum still refuses | Witness generalisation dropped the datum check or picked by array order |
| T-V9 | For each planner that changes the Wall id set (split, join, dissolve, removal, noded chain, and C's when present): an intended gap survives onto the right Wall and no dangling id is written | Flags are pruned, or one planner was missed |
| T-V10 | `queryOverheadSupports` under a canopy inside a closed Room returns the canopy then the lid; under open sky, none; clearance equals the difference | Lids are forgotten, or order is not by elevation |
| T-V11 | Visitor primitives for the V1 fixtures equal the editor's with editor-only streams removed; no relation cue, handle or ghost is present; a lifted overhead is still drawn and still casts shadow in Preview. A region coplanar with a generated floor has stable drawing priority without z-fighting or duplicate shadows, retains both identities, and wins coincident surface picking in Plan and 3D; support witnesses still follow T-V8 | Lift state leaks, regions are drawn by an editor-only path, or coincident floors render and pick nondeterministically |
| T-V12 | Undo and Redo of create, each edit, each fit and Erase restore canonical authored bytes and keep the existing ledger high-water behavior. Redo reuses the captured region id | Redo allocates a new id |
| T-V13 | Mounted gesture boundary: a corner drag and a body drag show a preview with no full compile and no history write; release installs the same proposal once; Escape restores | The adapter calls a planner per pointer move |
| T-V14 | The new codec rejects either legacy Room key in an otherwise current payload. Save/Load round-trips the new shape with authored region thickness. Open/re-close and the lid toggle preserve identity and the existing association and surface-reference rules. Split and duplicate keep their lineage and overhead behavior. SP2 Room creation/claim and SP1d open-side edits preserve the new source, associations and F4 lifecycle. Run the enclosed and open thickness-conflict merge fixtures in the new shape and assert the existing survivor and overhead rules, with exact Undo. No operation synthesizes a physical region from Room metadata | The cutover drops unrelated Space behavior, leaves an obsolete refusal or turns generated planes into physical slabs |
| T-P1 | For every existing fixture, with every Wall `level`: compiled Walls, Junctions, cache keys and Wall mesh buffers are byte-identical to the pre-bump output | The new code path is taken for level Walls, or the key gained a field |
| T-P2 | A gable Wall split off its apex, at its apex, and rejoined: tops are exact at every cut and the round trip restores the original bytes | Split re-interpolates, or join compares gradients loosely |
| T-P3 | Corners where a sloped Wall meets a level, a taller and another sloped Wall, at degree 2, 3 and 4: the mesh is watertight and winding agrees with normals | Top heights at mitre vertices are extrapolated |
| T-P4 | An Opening under the low end of a slope refuses when it would exceed the top there; the same Opening under the high end is accepted; lowering the eave below an Opening refuses naming it | Fit is still tested against one scalar |
| T-P5 | A curved slope Wall: the sheet at amount 1 shows a straight top line; picking the top edge on the sheet resolves to the canonical station | The top is linear in chord, not station |
| T-P6 | A Junction move that would put the apex outside the Wall refuses whole; a closed Wall refuses any non-level top | The apex is clamped silently |
| T-R1 | Every flat-region fixture compiles to the same faces before and after V3a | Flat became a zero-rise shed |
| T-R2 | Shed and gable over a rectangle, an L and a triangle: faces are planar, the ridge edge is shared exactly, the underside and top are `thickness` apart vertically everywhere | Faces are triangulated per vertex and crack at the ridge |
| T-R3 | J8 long-hall fixture with sufficient roof thickness: Fit roof to walls reaches first contact with no Wall penetration. Fit walls to roof makes all four read **meets**, with level eave Walls and gable ends whose apex lies under the ridge. Check the lower and upper bounds across the covered Wall width, including boundary ends and mitres. Each fit has one Undo entry | The fit solves for a plane, seals only the centerline, or accepts a top that projects through the roof |
| T-R4 | Fit walls to roof with a curved Wall under a shed, a closed Wall under a gable, and an Opening above the new top: each refuses whole, naming its subject; nothing is written | Partial application |
| T-R5 | A Wall half under the roof is left unchanged and named in the consequence; an oblique Wall crossing the ridge gets one apex at the crossing station | The fitted top needs two breakpoints |
| T-R6 | After both fits, moving the roof, changing its rise, or moving a Wall changes only that subject | A stored constraint |
| T-R7 | A long rectangle defaults to a gable ridge parallel to its long edge, and a shed rises along that edge. A square selects the stated endpoint pair under every cyclic reindexing. Exercise reversed edge endpoints in the orientation rule, the centred 30° default, positive `ridgeOffset` toward `qMax`, and an explicit azimuth surviving resize and rotating with the region | The ridge is turned 90°, equal edges depend on array order, or the offset sign flips |
| T-R8 | A 45° roof over a fully covered 0.20 m thick Wall parallel to the eave has a 0.20 m underside height spread. With 0.10 m roof thickness, the sealing fit would project 0.10 m above the roof. Refuse the entire multi-Wall fit even if another selected Wall can fit. The refusal identifies the blocking Wall and overrun, preserves bytes and writes no history. At 0.20 m roof thickness, contact with the upper face passes as **meets** | The planner accepts a crossing, clips the fit and leaves a gap, or writes part of the selection |
| T-R9 | A non-level curved Wall under a sloped roof exercises interior contact/gap/overrun extrema between sampled vertices. Verify conservative bounds against a denser independent reference; accept only with certified tolerance or refuse atomically with no history when proof is unavailable | Vertex-only extrema miss a crossing and a fit falsely reads **meets** |

Core cases sit beside the existing Layout contracts; adapter and F4 cases beside the circle and
unit-acceptance suites; placement follows `apps/editor/tests/README.md`. Each format slice also
runs the DB-backed API tests for version refusal, Save/Load and the unchanged publication gate.

## 13. Obligations on every slice

- **Editor.** Shell roles and coarse-pointer targets from PLATE; refusal wording through
  `adapters/layout/refusals.ts`; no control shown before it works.
- **Save/Load.** One codec and one canonical byte form through editor Save, API persistence and
  source admission. A saved document reloads byte-identically at the stated version (§9).
- **F4 and history.** One accepted candidate per gesture through the acceptance coordinator, with
  the identity delta for region births and retirements and selection correspondence for subject
  kind `region`. Fits that touch several Walls are still one entry.
- **Visitor.** Regions and Wall tops reach the visitor through the same compiled output and the
  same builders as the editor. Nothing from §5.9, §6.4 or §7.2 is imported by a visitor chunk.
- **Performance.** Relations are derived for the selected region only. Region compile is retained
  per region (T-V3). Previews draw from proposal math (T-V13). G5 is prefiltered by aabb. The point
  cap bounds triangulation. No budget is claimed; a measurement is run only if the owner asks.

## 14. Cross-track handoffs

| # | To | Requirement |
| --- | --- | --- |
| H-1 | **X1 Lift / X2 cutaway** | Use the landed `overheadSourcesOf` seam (§§5.6, 5.9). X2 continues to classify Walls independently. |
| H-2 | **SL1 Level / SL2 Drawn Slice** | Apply §5.8 to regions through existing clip, cap and exact pick paths. V2 switches profile-dependent Wall caps to `wallTopAt`. |
| H-3 | **SP1/SP2** | Apply §5.2 to the landed Space lifecycle and Room tool. Update the thickness/padding clauses in SP-plan at cutover. Keep the Room tool's claims, virtual edges, existing overhead, associations, survivor, lineage and source references. |
| H-4 | **SP3** | Gets region identity, compiled footprint, surface key and affected region ids from planners so I7 can be gated. SP3 owns follow intent and the resulting floor generation and retirement rules. |
| H-5 | **C1–C3** | C1 consumes the next version and V1a Room shape. Drop the Room-thickness entry in C-plan's Attach preservation list. Preserve Wall dimensions, Round facts, Room identity, associations and overhead. C's writers consume §5.5 lineage and §6.3 top rules as those land. |
| H-6 | **A1 and A2** | Landed topology correspondence supplies gap lineage. |
| H-7 | **R** | Unroll's top follows the Wall evaluator when V2 lands. |
| H-8 | **J / S5a, S5b (T2)** | The [draft J contract #368](https://github.com/Biskiq/spatial-sketch-editor/pull/368) proposes an authored-id-plus-role `region-face`, a containment rule for paint scope, and dormant/retired handling. V1 supplies Layout-local identity/resolution (§5.7), positive-area overlap for the Space readout/Lift, and region edit/birth/retirement facts. S5b consumes these and owns J's ratified paint-scope policy, finish inheritance (including duplicate), storage, unresolved lifecycle, Scene version and compound F4. Keep J's draft policy out of the V1 association query. |
| H-9 | **T2 lights** | T1 delivers downward support and clearance (§5.6). T2 wires the magnet, including its gesture and acceptance. Persistent attachments are a separate Scene support decision. |

## 15. Rejected alternatives

| Alternative | Why not |
| --- | --- |
| **Two record types**, floor regions and overhead regions | Two codecs, planners, compile paths and Index groups for one geometry (Q16). The role field carries the only real differences: datum face and supporting face |
| **No role; every slab supports on top and hangs below** | Every object placed under any ceiling would meet two upward supports and be asked to choose |
| **Role derived from height or from what is beneath** | A fact re-recognised from geometry; the batch's rule is stated, not detected |
| **Footprints that reference Junctions** | A region would follow Walls, which is an implicit constraint, and would enter topology. Regions are world-local, like Layout objects |
| **Curved footprint edges in V1** | A second curve vocabulary and curved slab edges for one case. Fit to space samples the outline instead. The `footprint.kind` discriminant leaves room |
| **A stored region transform** | A second frame beside project-world points, for no creator-visible gain |
| **Regions that trim or replace the generated lid by coverage** (P26 D2 as written) | Makes a lid depend on geometry existing, which Q8 reversed, and needs partial-lid geometry and an overlap joint rule |
| **Keep the Room thickness fields and draw slabs from them** | Changes the look of every existing Room and gives generated surfaces a physical property that regions exist to carry |
| **Keep the fields as legacy Room metadata** | Preserves old values in the current shape. It also retains a second thickness input to compiled bounds and the thickness-only merge refusal. V1a's version boundary and cutover gate address source preservation explicitly (§9) |
| **Replace `height` with a `top` union** | One authority, but every reader of `wall.height` changes for no behavioural gain. `height` as the lowest top keeps them all correct |
| **`topProfile` optional beside `height`, absolute heights** | Two numbers able to disagree about the eave |
| **A general list of top breakpoints** | Admits valleys and sawtooth tops, outside the approved vocabulary, and loses the closed-form split and join rules |
| **Apex as a fraction of length** | Stays centred under a length edit, but contradicts the metre-offset rule Openings follow and makes split arithmetic inexact. **Centre apex** is one Card action |
| **Roof forms as a separate entity from regions** | The approved capability and Q16 put forms in the region family; a second family repeats footprint, identity, support and references |
| **Forms as arbitrary section profiles** | Gambrel and mansard are outside scope and break the guarantee that a fitted Wall top is expressible |
| **Fit roof by solving a plane through the Wall tops** | A constraint solver, with no answer for most inputs |
| **Fit walls at the centerline with no allowance** | Can leave a visible wedge of sky where the underside rises across a Wall |
| **Fit walls to the highest underside across the body** | For an oblique Wall crossing the ridge the result has two peaks and cannot be stored |
| **Accept or cap a sealing allowance that exceeds the upper face** | Acceptance can produce a crossing. Capping can produce a gap. An atomic refusal preserves the meaning of a successful fit |
| **Persistent meets constraints** | Outside scope by decision; P26 D3 already prefers one-shot fixes |
| **Relations compiled on every edit** | Cost on every Wall edit for a reading shown for one selected region |

## 16. Owner-authorized defaults

| # | Decision incorporated | Governing section |
| --- | --- | --- |
| OD-1 | Remove Room thickness in V1a, subject to the source-preservation activation gate | §§5.2, 9 |
| OD-2 | Lift gates creator access in V1c. X1 has landed. | §5.9 |
| OD-3 | V1a before C1. Five total Layout bumps including landed SP1a. | §9 |
| OD-4 | Preserve Scene poses and report the resting-object count before a region move or erase. | §8 |
| OD-5 | Keep the flat lid of a closed Room. Open to sky is the cathedral case. | §5.2 |
| OD-6 | Straight Wall tops edit on the Wall face, through the development map at amount 0. | §6.4 |
| OD-7 | Roof fit reaches first contact. Wall fit seals within the slab or refuses atomically. | §§5.5, 7.3 |
| OD-8 | T1 delivers floor placement and overhead support evidence. T2 owns the light magnet. | §5.6, H-9 |

All eight defaults are adopted. V1a carries the existing Wall writers' gap lineage at the first
readable format, because imported regions can reach Stage before V1b adds region planners. V1d
lands before V1c exposes authoring, so a first creator can both stand an object on a platform
and see the exact move/erase consequence. These sequence choices follow the admitted source and
acceptance paths.

## 17. Risks and limits

1. **The Wall mesh builder is the delicate module here.** V2a changes its top edge. P8 and T-P1
   are the containment: a level Wall must not enter the new path.
2. **Corner tops are clamped at mitre vertices.** Near a corner a sloped top is flat for at most
   half a Wall thickness. It keeps seams closed and is not visible at ordinary scale.
3. **A thin or steep roof may refuse a fit.** The uniform allowance keeps one expressible Wall
   profile and can exceed the available slab thickness. The refusal names the overrun (§7.3).
4. **Forms are extruded profiles.** An L-shaped gable has no valley. Hips, valleys and dormers are
   outside this batch.
5. **Footprints are straight-edged.** Over a round Room, Fit to space writes a many-pointed
   polygon that is awkward to edit by hand.
6. **The 1.0 m relation reach and the 1,024-point cap are chosen numbers.** Each is one named
   constant with a test at its edge.
7. **`apexOffset` in metres** means a resized gable Wall is off centre until **Centre apex** or a
   fit.
8. **Format cutover** requires a stored-revision disposition and recovery proof (§9).
9. **V1's editor surface is minimal by design.** Ink's reading chip ("Raised platform", "Canopy
    roof") is not built here.
10. **Closed circular Room certification** remains tracked in #370. V1 uses valid compiled Space
    outlines and carries the existing certification case unchanged.
