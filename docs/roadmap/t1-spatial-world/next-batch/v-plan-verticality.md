# T1 V-plan — Architectural Volume and Verticality

**Status:** proposed architecture, Tier 2, awaiting owner review. Planning only: no production
code, schema, fixture or approved-roadmap edit is in this PR, and nothing here is production
acceptance. Each slice still opens its own PR. Eight owner decisions are listed in §16 with a
recommended answer each; V1a can be authorised once OD-1, OD-2 and OD-3 are answered.

**Capabilities:** `layout.horizontal-region` *new* (V1, V3), `layout.wall-top-profile` *new* (V2).
**Base:** `main` at `6e1b7bc5`.

**Authority:** the approved [T1 next batch](./README.md#architectural-volume-and-verticality)
(PR #290; decisions Q7, Q8, Q9, Q10, Q16), its [slices](./implementation-prs.md#lane-d-depth),
journeys [J7–J9](./creator-journeys.md#j7-a-courtyard-and-a-canopy) and
[J11](./creator-journeys.md#j11-working-inside-a-finished-room), the
[SP-plan](./sp-plan-open-spaces.md) (#305), the [C-plan](./c-plan-connected-curves.md) (#304), the
[Layout contract](../../../reference/components/layout.md) (the P26 verticality vocabulary and
mechanisms D2 and D3), [persistence](../../../reference/components/persistence.md), the
[editing-path rules](../../../reference/components/layout-performance.md) and the T2 proposal's
[coordination section](../../t2-look-atmosphere/README.md#10-coordination).

**Evidence limit.** "Observed" means read from code at the base commit and cited as `file:line`.
Nothing was run in the editor. "Assumed" marks what was not read or cannot be known until an
earlier slice lands; each assumption names the slice that must check it. SP1, C1 and X1 are not
implemented at the base commit: Layout is still format 7 and no Lift reading exists in
`apps/editor/src/lib/authoring`.

## 1. Verdict

1. **One region family, one collection, a stated role.** `regions: LayoutRegion[]` with
   `role: 'floor' | 'overhead'`. A region is a slab: footprint, Floor-relative elevation,
   thickness, form. The role states which face is the datum face and which face gives support. It
   is stated at birth and never changes.
2. **Regions are physical geometry and nothing else.** They carry no closure intent, no
   appearance and no Space ownership. A Space's generated floor and lid stay derived from its
   outline and depend only on the Space's `overhead` intent (SP-plan I11). The P26 words "closure
   versus suspended" are superseded by Q8 and leave the Layout contract when V1a merges.
3. **The Room record loses `floorThickness` and `ceilingThickness`** (OD-1). Nothing renders them
   and no editor code writes them. Physical thickness belongs to regions.
4. **A Wall keeps `height` and gains one required `top`.** `height` is the lowest point of the
   top; `top` adds rise above it: `level`, `slope` or `gable`. Every reader of `wall.height`
   stays correct, and a level Wall compiles to exactly today's output, cache keys included.
5. **Shed and gable are forms of an overhead region**, defined as one or two planes over the
   footprint. No hips, valleys or extra profile joints.
6. **Relations are derived readings; fits are one-shot planners.** The only authored relation fact
   is a per-region list of Walls whose gap is intended. Two fit planners serve V1 and V3 with the
   same definitions: *Fit Roof to Walls* stops at first contact, *Fit Walls to Roof* seals.
7. **Five format bumps cross this batch, not three:** SP1a, V1a, C1, V2a, V3a. One is in flight at
   a time and numbers are taken at merge (§9, OD-3).

## 2. Observed, and assumed

### Observed at `6e1b7bc5`

| # | Fact | Where |
| --- | --- | --- |
| O1 | Layout is format 7; the Layout unit version in the F2 envelope is the same constant, not a second number | `layout-wall-first-types.ts:82`; `packages/project-model/src/units/types.ts:46` |
| O2 | A Room record is `id`, `name`, `boundary`, `floorThickness`, `ceilingThickness` | `layout-wall-first-types.ts:285`; `layout-wall-first-codec.ts:115` |
| O3 | The two thicknesses reach only Room `bounds3`, Room cache keys, the metadata planner, duplicate and the merge-conflict refusal. Births use 0.1 for both | `layout-geometry.ts:1752`, `:2182`; `layout-wall-topology-ops.ts:510`; `layout-duplicate.ts:601`; `layout-room-reconciliation.ts:113`, `:1027` |
| O4 | No file under `apps/editor/src` names either thickness field. Floors and lids are drawn as zero-thickness planes, the lid unconditionally | `VisitorLayoutShell.svelte:209`–`:231` |
| O5 | A Room's ceiling is `floor.elevation + max(boundary Wall heights)`; its floor polygon follows Wall centerlines | `layout-geometry.ts:237`–`:254`, `:1668` |
| O6 | A Wall's vertical extent is one scalar. Sections, Junction legs, endpoint bands, bounds and cache keys all take `wall.height` | `layout-geometry.ts:606`, `:607`, `:617`, `:1025`; `layout-geometry-openings.ts:149` |
| O7 | `CompiledWallSection.topY` is a scalar; the mesh builder draws one level top face per section and already handles sloped *bottoms* for arches | `layout-geometry-types.ts:163`; `wall-mesh-builder.ts:1009`, `:1043`, `:1059`, `:1096` |
| O8 | Opening fit compares `sill + height` with `wall.height`; the height planner is `planExactWallHeight` | `layout-opening-set.ts:260`; `layout-wall-first-precision.ts:554` |
| O9 | The Wall mesh carries `(station, offset, height)` on every vertex and the development map moves vertices by that attribution; the separate sheet mesh takes a scalar `height` | `layout-wall-development.ts:196`, `:709` |
| O10 | Unroll entry is disabled on a straight Wall | Layout contract, "Wall development and the Unroll reading" |
| O11 | The support query reads only `room-floor` polygons, requires a `roomId` and cross-checks the Floor datum; Scene qualifies a witness as subject `room`, stream `layout:room-floor` | `layout-floor-support.ts:274`, `:295`, `:331`; `packages/project-model/src/scene-planning/place-object.ts:262` |
| O12 | Compiled query polygons are `room-floor` or `object-footprint`; Plan emits one `room-floor` candidate per Room | `layout-geometry-types.ts:316`; `layout-plan-representation.ts:490` |
| O13 | The identity ledger has four families and a reference pattern fixed to `R`, `J`, `W`, `O` | `layout-wall-first-types.ts:298`; `layout-identity.ts:77`, `:84` |
| O14 | Document bounds feed the Camera session on every source rebase | `apps/editor/src/lib/authoring/stage/stage-facade.ts:1830` |
| O15 | The toolbar registers **Roof** (`roofline`, planned, "after T1", options Flat / Pitch / Shed) and **Terrace** (planned, "after T5") | `apps/editor/src/lib/authoring/world-toolbar/registry.ts:177`–`:195` |
| O16 | The Height Sheet takes found surfaces from each owning adapter | `layout.adapter.ts:5244`; `scene.adapter.ts:1695` |
| O17 | The authored-dimension envelope is 1,000 m | `layout-geometry-limits.ts` |

### Assumed, with the slice that must check it

| # | Assumption | Checked by |
| --- | --- | --- |
| A1 | SP1a lands the Room fields `virtualEdges` and `overhead`, `composeSpaceBoundary`, `spaceAtPoint` and `CompiledRoom.overhead` as its plan states | V1a, before it starts |
| A2 | The Plan evaluation context exposes a cut height a candidate can be classified against | V1a; fallback rule in §5.8 |
| A3 | Scene placement can resolve one support when two elevations exist at a point (a platform over a floor) from the surface under the pointer, without asking | V1d, first check |
| A4 | A Scene object keeps its world pose when its Layout support moves; nothing re-seats it silently | V1d, first check |
| A5 | X1 Lift takes its overhead set from a Layout function, not from a hard-coded Room lid | X1's plan; handoff H-1 |
| A6 | A6's `face` viewing intent exists when V3c starts | V3c; fallback in §7.4 |

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

`LayoutWallFirstRoom` loses `floorThickness` and `ceilingThickness` in V1a (OD-1). Every new field
is required, following the fresh-authority rule already applied to `centerline`: no defaulting, no
missing-field tolerance.

### 3.2 Region invariants

| # | Invariant | Enforced by |
| --- | --- | --- |
| G1 | The footprint is a simple polygon of 3 to 1,024 points, positive area in the orientation of a compiled floor polygon, no edge shorter than the point epsilon or longer than 1,000 m, no holes | Codec (count, finiteness, envelope); compiler, blocking (`region_footprint_self_intersects`, `region_footprint_not_positive`) |
| G2 | `elevation` is finite, within ±1,000 m; a floor region's is ≥ 0, an overhead region's is > 0 | Codec |
| G3 | `thickness` is finite, > 0 and ≤ 1,000 m | Codec |
| G4 | `role` never changes after birth | Planners: no intent writes it |
| G5 | Two regions share no interior volume: plan interiors share area **and** their vertical bands overlap by more than the relation epsilon. Touching and exact stacking are allowed | Compiler, blocking (`region_overlap`) |
| G6 | Every `intendedGaps` entry names an existing Wall; the list is sorted and unique | Codec (`missing_reference`, `invalid_value`); the Wall-lineage helper (§5.5) |
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
| 2 | `floorThickness`, `ceilingThickness` | Removed from the Room record and the compiled Room in V1a. Generated surfaces are planes, as they are drawn today (O4). OD-1 |
| 3 | Region identity and references | A captured document-global id; a fifth ledger family `regions`. Surface references are the region id plus `top`, `underside` or `edge`, never minted per compile. Region edits keep the id. §5.7 |
| 4 | Footprint and sloped-top geometry | G1–G5 for footprints; forms are one or two planes parameterised by `rise`, `azimuth` and `ridgeOffset` over the footprint's own extent (§7.1); Wall tops are P1–P8 |
| 5 | SP1's `overhead: closed \| open-to-sky` | Untouched and still the only thing that decides a lid. A region reads and writes no intent. The Card readout "Open to sky · under *name*" is `overhead` plus `regionsOverSpace` |
| 6 | Shared-Wall profiles, intersections, Openings, clearance | A Wall has one top for both of its sides. A Wall may pass through a region: it reads **crosses** and nothing is cut. Regions may not interpenetrate each other (G5). Openings must fit under the top over their interval (P7). Clearance is the first downward-facing surface above a point, from the overhead support query |
| 7 | Layout, Scene, Camera, Experience | §8 |
| 8 | Format sequencing | One format-changing slice in flight; numbers taken at merge; five bumps in the batch. §9 |
| 9 | Lift | V1c, the first slice in which a creator can make an overhead, does not merge before X1. V1a and V1b may (OD-2) |
| 10 | T2's J/S5a and S5b | Layout-local resolvers and queries ship in V1. The published wire type, finish storage and inheritance, unresolved-reference behaviour, persistent attachment and cross-unit history stay with J/S5. §14 |

## 5. V1 — flat horizontal regions

### 5.1 Datum and faces

```text
world datum face  = floor.elevation + region.elevation
floor region      top = datum face          bottom = top - thickness
overhead region   underside = datum face    top    = underside + thickness
```

The Card shows the Floor-relative value and the world value together (Q7). A floor region at
elevation 0 is legal: it is a paved area on the datum. Where it lies in the plane of a generated
Space floor, the authored region draws over the generated surface; that priority is a stated rule
of the Layout representation and is identical for the visitor.

### 5.2 Generated surfaces and regions

- A `closed` Space keeps its flat lid at `floor.elevation + max(boundary Wall heights)` whatever
  regions exist. A dropped ceiling is an overhead region below that lid. A creator who wants the
  region to be the only overhead sets **Open to sky**; the readout then names the region.
- No coverage arithmetic exists: no partial lid, no lid cut around a region, no "closure" region.
  This replaces the Layout contract's "Generated fallback only for uncovered enclosure" and
  "ambiguous overlapping-closure surface is refused" with G5 and the intent rule.
- "Converting a generated surface to an authored region" is two explicit steps, each its own
  history entry: **Fit to space** at region birth or later (§5.5), then **Open to sky**.

### 5.3 Planners

All in `layout-region.ts`, all returning one validated candidate or one typed refusal, all one
history entry. None changes topology, so none calls `reconcileRooms`.

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
centerlines, as a generated floor is (O5), reads **meets**.

A **gap** whose Wall id is in `intendedGaps` reads **intended** and still shows its measure. It
offers no fix. Marking is `planSetRegionIntendedGap`.

### 5.5 One-shot fits

Four explicit operations. Each is one planner, one history entry, atomic. None stores anything;
after a fit the two subjects are independent again and the next reading may be a gap.

| Operation | Planner | Effect |
| --- | --- | --- |
| **Fit to space** | `planFitRegionToSpace` | Footprint becomes the Space's compiled outline (centerline polygon; curved Walls contribute their compiled samples). Refuses above 1,024 points |
| **Meet wall** | `planFitRegionEdgeToWall` | For a horizontal gap to a straight Wall: the nearest footprint edge, if parallel to the Wall within 1e-6 rad, translates along its normal to the Wall's near face. Refuses a curved Wall or a non-parallel edge with words |
| **Fit roof to walls** | `planFitRegionToWalls` | Changes `elevation` only, to first contact with the highest chosen Wall top: flat case `slabBottom = max wallTop` |
| **Fit walls to roof** | `planFitWallsToRegion` | Sets each chosen Wall's top to the region's lower face: flat case `height = slabBottom − floor.elevation` through `planExactWallHeight`'s gates |

The last two are the flat, level case of the general definitions in §7.3. V1 implements them with
those signatures so V3 extends rather than replaces them.

**Wall lineage for `intendedGaps`.** One helper, `carryRegionWallIntents(regions, correspondence)`:
a Wall born from a source inherits the source's entries; a Wall retired into a survivor hands its
entries to the survivor; a Wall retired with no successor drops them. It is called by every planner
that changes the set of Wall ids: split and noding, dissolve and join, removal, chain commits that
node, and C's attach, repack and release. G6 in the codec is the backstop, and test T-V9 enumerates
the call sites. A1 and A2 already owe a stated lineage rule; this consumes it.

### 5.6 Support, clearance and association

- **Upward support.** `queryFloorSupports` gains `region-top` polygons for `role: 'floor'`
  regions. A witness's source becomes `{ kind: 'room', roomId } | { kind: 'region', regionId }`,
  replacing the bare `roomId`; the datum cross-check (O11) applies to Room witnesses only, and a
  region's elevation is its compiled top. Coincident supports already merge into one candidate and
  different elevations already return `choice-required`; neither rule changes.
- **Downward support.** A new `queryOverheadSupports(snapshot, { generationId, x, z,
  aboveElevation? })` in the same module, with the same generation, tolerance and choice
  contract. Candidates are the undersides of overhead regions and the lids of `closed` Spaces,
  ascending by elevation, each with its downward normal and source witness.
- **Clearance** above a point is the first candidate of that query minus the starting elevation.
  It is a reading; nothing is refused for lack of headroom.
- An overhead region's top and a floor region's underside give no support in V1. A floor region at
  height is the J9 mezzanine probe; a light under it is not served.
- **`regionsOverSpace(compiled, roomId)`**: regions whose footprint shares interior area with the
  Space's outline, ordered by id. Derived, never stored. It feeds the Card readout, Lift's Space
  scope and T2's Space paint scope.
- **`overheadSourcesOf(compiled, scope)`**: closed-Space lids plus overhead regions, each with its
  outline and elevation. This is the function A5 assumes X1 calls.
- **Surface key** for SP-plan I7: `{ kind: 'datum' } | { kind: 'region'; regionId }`. Every Space
  is on `datum` until SP3 lands a Space that follows a region.

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
- Proposed qualification above layout-core: subject kind `region` in the Layout domain, with the
  surface as `componentId`. J/S5a ratifies or replaces it (§14).

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

- `CompiledLayoutGeometry.regions` is required and empty when there are none. Query output gains
  polygons `region-top` and `region-underside` and an aabb kind `region`. Document bounds include
  region bounds.
- A region's cache key names its own record and `floor.elevation`, and nothing else. A Wall edit
  recompiles no region and a region edit recompiles no Wall or Room. `layout-geometry-delta.ts`
  and `layout-geometry-reuse.ts` gain the region family on those terms.
- G5 runs in the compiler over region aabbs first, then `polygonsShareInteriorArea`.
- **Mesh.** A new runtime-safe builder beside `wall-mesh-builder.ts` triangulates each compiled
  face and tags every triangle with `{ kind: 'region', regionId, surface }`. A retained
  representation beside the Wall and object representations reconciles by cache key and is mounted
  once in `VisitorLayoutShell.svelte`, so editor and visitor share one path. Regions cast and
  receive shadow. Material is the neutral floor tone on `top` and the neutral ceiling tone on
  `underside` and `edge` until T2 finishes exist.
- **Plan.** One candidate per region, `sourceKind: 'region'`, `subRef` naming the surface. A
  region whose slab is wholly above the Plan cut height is on the `hidden` stream (dashed
  outline); otherwise `projected` (outline, and a tint for a floor region). If the context has no
  cut height (A2), overhead regions are `hidden` and floor regions `projected`.
- **Picking.** 3D resolves from the triangle tag; Plan from the pick index. Both select the
  canonical region. No nearest-face heuristic.

### 5.9 Editor surface (V1c)

Built from the approved grammar ("Platform: corner points and a height ray") and the registered
tools. Anything not listed here is not designed and is not built.

- **Create.** **Terrace** makes a floor region; **Roof › Flat** makes an overhead region. Both
  draw like Walls: Box (two corners) or Line (click, click, close). Elevation is the Height
  Sheet's height; an overhead at datum height takes the Wall creation default instead. The
  registry stubs are aligned in the same PR (Terrace's "after T5", Roof's Pitch options).
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
- **Lift.** Overhead regions join the lifted set through `overheadSourcesOf`; a lifted, selected
  region is a ghost with working handles (X1's acceptance already says so).
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
  band clamping gains the mirror of the sloped-bottom rule it already has (O7). With no
  `topProfile` the builder takes today's code path untouched.
- Room ceilings stay `max(boundary Wall heights)`, the eave heights. A gable does not raise a lid.
- Openings: `opening_exceeds_wall_height` compares against `wallTopRange(...).min` over the
  Opening's interval, with the existing epsilon. An arch is tested by its bounding height.
- Development: the Wall mesh develops through its vertex attribution with no change (O9). The
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
  disabled (O10, OD-6).
- Top edits are height-family edits and stay allowed while a Wall is unrolled, as Wall height is.
- Nothing in Plan changes.

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
  Default azimuth for a new shed or gable is the direction of the longest footprint edge (for a
  gable, the ridge runs along it); default rise gives a 30° pitch on the longer side.
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
  supplies. If A6 has not landed (A6), V3c ships Edit shape in 3D only and Section follows it.

### 7.3 The two fits, in general

Both are explicit, atomic, one history entry, and store nothing.

For a Wall `w` under a region `R`, at station `s`, take the cross-section of the Wall body at `s`
(evaluated at both faces, and at the ridge where the ridge crosses that section):

```text
contact(w, s) = min over the cross-section of  underside(p) - wallTop(w, s)
seal(w, s)    = max over the cross-section of  underside(p) - wallTop(w, s)
```

- **Relation**, replacing the flat row of §5.4 with the same words: **gap** when `max_s seal > ε`
  (the measure is that maximum); **crosses** when the Wall's top is above `top(p)` anywhere by
  more than ε; otherwise **meets**.
- **Fit roof to walls** (`planFitRegionToWalls`). Changes `elevation` only, by
  `−min over the chosen Walls and stations of contact`. The roof moves straight up or down until it
  first touches a Wall. No Wall enters the roof. Walls that still show a gap say so.
- **Fit walls to roof** (`planFitWallsToRegion`). The set is every chosen Wall whose whole
  centerline lies inside the footprint or on its boundary; a Wall only partly under the roof is
  left alone and named in the consequence line. For each Wall, the underside along the centerline
  is sampled at the two ends and at the ridge crossing, giving a level, slope or gable top, and the
  whole top is then raised by the Wall's **sealing allowance**
  `δ = max_s ( max over the cross-section of underside − underside at the centerline )`,
  so `seal ≤ 0` everywhere and the Wall reads **meets**. If the raised Wall comes out of the top of
  the roof the consequence line says by how much; it is not refused.
- **Refusals**, each naming its subject and writing nothing: a curved Wall whose fitted top would
  not be level; a closed Wall under a sloped form; an Opening that would exceed the new top; a
  resulting height that is not positive or leaves the envelope; G5 after the move.
- A gable roof's underside along a straight Wall is concave with at most one breakpoint, so the
  fitted top is always expressible. That is the reason the Wall-top vocabulary is exactly level,
  slope and gable.

J8 is then: draw the roof, **Fit roof to walls**, **Fit walls to roof**. Every Wall reads meets,
and nothing follows either subject afterwards.

### 7.4 Support and overlap under a sloped form

`queryOverheadSupports` evaluates `regionUndersideAt` at the point and returns the face's true
normal. G5 uses the conservative band (§3.2).

## 8. Boundaries

| Domain | Owns here | Does not |
| --- | --- | --- |
| **Layout** | Region and Wall-top geometry; identity; compile; relations; fits; support and clearance queries; surface references; Plan and mesh representation | Store a colour, material, light, object, attachment or Camera fact. Move anything in another unit |
| **Scene** | Finishes keyed by a published surface reference (T2 D1); object and light placement that *reads* Layout support; any persistent attachment | Derive a surface from Room shape; write Layout |
| **Camera** | Views and framing, reading Layout bounds as today (O14) | Treat a region as a navigation surface. A View on a platform is an authored pose |
| **Experience** | Nothing new | Target a region in this batch |
| **Editor session** | Lift, ghosts, relation cues, fit proposals, Edit shape's section reading | Persist or publish any of them |

**Scene objects do not ride with a region in V1.** Moving or raising a region is a Layout edit;
Scene poses are unchanged and the object may be left in the air (A4). A change spanning Layout and
Scene in one history entry is the question J already owns (the roadmap's verify-first item 7). The
V1c Card states the count of Scene objects resting on a region before a move or erase when the
adapter can read it, and changes nothing. OD-4.

## 9. Format, sequencing and rollback

- **Rule.** A format slice claims the baton by opening its draft PR with the capability id in the
  title. No second format-changing PR carries code while one is open. Each takes the next
  admitted version at merge; no plan fixes a number. `LAYOUT_WALL_FIRST_FORMAT_VERSION` is the one
  constant, and it is also the envelope's Layout unit version (O1), so each bump is one number in
  one place.
- **Each bump:** strict refusal of the previous version, no migration, no dual reader, no
  defaulting of new fields, every maintained fixture regenerated through canonical builders.

| Order | Slice | Changes | Must follow |
| --- | --- | --- | --- |
| 1 | SP1a | Room `virtualEdges`, `overhead` | – |
| 2 | **V1a** | `regions`; ledger family `regions`; Room thickness fields removed | SP1a–SP1c |
| 3 | C1 | Room `round` | SP1a–SP1c |
| 4 | **V2a** | Wall `top` | V1a; C1 if it is open |
| 5 | **V3a** | `shed` and `gable` admitted in `form` | V2a |

- V1a and C1 both become eligible when SP1c merges and both edit the Room parser. Recommended:
  V1a first, because SP3 and T2's S5b wait on region identity while C1 unblocks only C2–C4
  (OD-3). C-plan's "format 9" then reads "the next admitted version", which that plan already
  allows.
- V1a carries `form: { kind: 'flat' }` so that V3a widens a union instead of adding a field. It is
  still a bump: a reader before V3a cannot read a gable.
- **Rollback.** Reverting a format slice restores the previous reader and refuses anything saved
  since. V1a, V2a and V3a ship no creator-reachable producer, so reverting a later slice of the
  same phase leaves every saved document valid. Once V1c, V2c or V3c has shipped, reverting its
  format slice loses regions, tops or forms saved meanwhile; that is accepted under the standing
  pre-baseline rule and is stated in each of those PRs.
- **Publication.** Unchanged. The API's publication write still answers
  `prepared-reader-required` (C-plan §6); parity is proved through Preview and runtime fixtures.
- **Docs promoted at the implementing merges, not here:** the Layout contract's current-contract
  paragraph and its sections "Head-fixed arch rise and independent overhead-region intent", D2,
  D3 and "Slab and ceiling ownership kept open" (replaced by the rules of §4–§7 as each lands);
  persistence's Layout paragraphs; the glossary. This plan is deleted when V3c merges.

## 10. Affected modules

| Area | Module | Change | Slice |
| --- | --- | --- | --- |
| Source | `packages/layout-core/src/layout-wall-first-types.ts` | `LayoutRegion`, `regions`, family `regions`; Room thickness fields removed; later `top`, forms | V1a, V2a, V3a |
| | `packages/layout-core/src/layout-wall-first-codec.ts` | Region parser and reference pass; `ROOM_KEYS`; later `top` and forms | V1a, V2a, V3a |
| | `packages/layout-core/src/layout-identity.ts` | Fifth family with its own prefix; the reference pattern | V1a |
| | `packages/layout-core/src/layout-geometry-limits.ts` | Region dimensions in the envelope | V1a |
| Regions | new `layout-region.ts`, `layout-region-relations.ts` | §5.3–§5.6, §7 | V1a (validation, accessors), V1b, V3b |
| Wall tops | new `layout-wall-top.ts` | §6.1, §6.3 arithmetic | V2a, V2b |
| Compile | `packages/layout-core/src/layout-geometry-types.ts`, `layout-geometry.ts`, `layout-geometry-delta.ts`, `layout-geometry-reuse.ts`, `layout-geometry-openings.ts` | `CompiledRegion`, query kinds, bounds, keys; thickness removal; later `topProfile` and section splits | V1a, V2a, V3a |
| Queries | `packages/layout-core/src/layout-floor-support.ts`, `layout-geometry-queries.ts` | Witness source; overhead query; `regionsOverSpace`; `overheadSourcesOf` | V1b |
| Topology | `layout-wall-noding.ts`, `layout-wall-dissolve.ts`, `layout-wall-topology-ops.ts`, `layout-wall-chain.ts`, `layout-room-reconciliation.ts`, `layout-duplicate.ts` | `carryRegionWallIntents` call sites; thickness removal; later top arithmetic on split and join | V1a (thickness), V1b, V2b |
| | `packages/layout-core/src/layout-opening-set.ts`, `layout-wall-first-precision.ts` | Opening fit against the top; `planExactWallHeight` reuse | V2a, V2b |
| Representation | `packages/layout-core/src/layout-plan-representation.ts`, `layout-wall-development.ts` | Region candidates; sheet `topProfile` | V1a, V2a |
| Mesh | `apps/editor/src/lib/layout/wall-mesh-builder.ts`; a new region builder beside it; a new region representation in `apps/editor/src/lib/render` | Sloped tops; region faces; retained meshes | V1a, V2a, V3a |
| Visitor | `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` | Mount the region representation | V1a |
| Project model | `packages/project-model/src/units/validate.ts`, `packages/project-model/src/scene-planning/support.ts`, `place-object.ts`, the Layout reference resolver | Inherit the format; region witnesses; subject kind `region` | V1a, V1d |
| Authoring | `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` and `adapters/layout/*`, `layout/plan-hit.ts`, `layout/plan-pick-provider.ts`, `stage/semantic-selection.ts`, `stage/shell/world-index-model.ts`, `world-toolbar/registry.ts`, `adapters/layout/LayoutCardFields.svelte` | Intents, picking, selection, Index, Card, tools | V1c, V2c, V3c |

## 11. Slices

Every slice inherits the batch rules: one gesture is one history entry; Undo and Redo replay
captured ids; a refusal has words and writes nothing; session readings are never saved.

| Slice | Delivers | Needs | Tier |
| --- | --- | --- | --- |
| **V1a** Format and compile | §3.1 (regions), §3.2, §5.1, §5.8, thickness removal, the format bump. Hand-built region fixtures compile, draw and pick in editor and visitor. No planner creates a region | This plan approved with OD-1–OD-3; SP1a–SP1c merged | 2 |
| **V1b** Planners and queries | §5.3–§5.6 in layout-core only: planners, relations, the four fits (flat and level case), support and clearance queries, Wall lineage. No editor intent | V1a | 1 |
| **V1c** Authoring and parity | §5.9; F4 wiring; Lift registration; visitor parity; focused browser QA of J7 and J11 | V1b; **X1 merged** | 1 |
| **V1d** Support and reference seam | Region witnesses qualified in project-model so an object rests on a floor region; `queryOverheadSupports` exported for T2's light magnet; Layout-local surface-reference resolver. A3 and A4 are its first checks | V1b. Independent of V1c. Reviewed from T2 | 1 |
| **V2a** Format and compile | §3.1 (`top`), §3.3, §6.1, §6.2, the bump. Hand-built tops compile and draw. No planner writes one | V1c merged (Q9, product order); the baton | 2 |
| **V2b** Planners | §6.3, including split, join, dissolve and C's rules | V2a; A1, A2 core | 1 |
| **V2c** Authoring and parity | §6.4; F4; visitor parity; focused browser QA | V2b | 1 |
| **V3a** Format and compile | §7.1, §7.4, the bump. Hand-built forms compile and draw | V2a; the baton | 2 |
| **V3b** Planners | §7.2 planners, §7.3 both fits in general | V3a, V2b | 1 |
| **V3c** Authoring and parity | Roof › Shed and Gable, Edit shape, both fits; focused browser QA of J8 | V3b; A6 for the Section segment | 1 |

### Acceptance

- **V1a.** The previous format is refused through the codec, `units/validate.ts` and the visitor
  release path. With no regions, compiled output equals the pre-bump output except for the listed
  differences of T-V1. Each of G1–G7 has a refusing fixture. A hand-built canopy, dropped ceiling
  and raised floor compile to the faces of §5.8, draw identically in the Stage and in Preview, and
  select the region from 3D and from Plan. A region edit recompiles no Wall and a Wall edit
  recompiles no region (T-V3). The persistence contract names one Layout number.
- **V1b.** Every planner of §5.3 and §5.5 has a core test through the real planner, with a
  refusing case. Every row of the two tables in §5.4 has a fixture. T-V4 to T-V10 pass.
- **V1c.** The approved V1 sentences hold in the running editor: a canopy, a dropped ceiling and a
  raised floor can each be drawn, moved, resized and set in height; a region over an open-to-sky
  Space reads "Open to sky · under *name*" and changes no intent; each relation reads meets, gap
  with its measure, or intended; nothing follows after a fit. J11 steps 1, 2 and 4 pass with Lift.
- **V1d.** An object placed on a floor region rests at its top and records a region witness; the
  overhead query returns the underside under a canopy and the lid in a closed Room. The PR states
  what it found for A3 and A4.
- **V2a.** The previous format is refused. T-P1 passes. Hand-built slope and gable Walls render
  with closed corners at every Junction degree in the fixture set, with and without Openings.
- **V2b.** Each row of §6.3 has a core test. T-P2 to T-P6 pass.
- **V2c.** The approved V2 sentence holds: a Wall top can be level, sloped or gabled; Openings,
  mesh and the Unroll sheet agree with it. A straight gable end is edited on its face.
- **V3a.** The previous format is refused. Flat regions compile unchanged (T-R1). Shed and gable
  fixtures compile to planar faces that close without gaps (T-R2).
- **V3b.** Both fits pass T-R3 to T-R6.
- **V3c.** The approved V3 sentence holds, and J8 passes with two explicit fits.

## 12. Tests that separate a correct design from one that only looks right

| # | Test | A superficial design fails because |
| --- | --- | --- |
| T-V1 | Across the existing fixture set with no regions, compiled output equals the pre-bump output except: `regions: []`; the two thickness fields absent; Room and document `bounds3` no longer padded by them; Room cache keys | Thickness removal moves something nobody listed, or regions leak into Wall keys |
| T-V2 | A footprint that self-crosses, is clockwise, has a repeated point or exceeds the envelope: each refuses with its own code | The triangulator accepts it and draws garbage |
| T-V3 | Compile counters: a region move rebuilds one region and no Wall or Room; a Junction move rebuilds no region | Regions are keyed on the whole document |
| T-V4 | Each row of §5.4, including a footprint drawn to Wall centerlines (meets) and a Wall rising through a canopy (crosses) | Relations are computed from centerlines only and call the generated-floor case a crossing |
| T-V5 | Fit, then move the Wall, raise it, and move the region: the other subject is byte-identical and the reading is a gap again | A fit left a stored link |
| T-V6 | Two regions made to interpenetrate by create, move, rotate, elevation, thickness and each fit: refused, document byte-identical, no history entry. Exact stacking and edge contact accepted | G5 is checked on create only |
| T-V7 | Open to sky removes the lid and leaves every region; adding, moving and removing a region changes no Space's `overhead` and no lid | A region is treated as closure |
| T-V8 | Under a platform over a Room floor, the support query returns two candidates at two elevations; on a region coplanar with the Room floor it returns one candidate with both witnesses; a Room witness with a wrong datum still refuses | Witness generalisation dropped the datum check or picked by array order |
| T-V9 | For each planner that changes the Wall id set (split, join, dissolve, removal, noded chain, and C's when present): an intended gap survives onto the right Wall and no dangling id is written | Flags are pruned, or one planner was missed |
| T-V10 | `queryOverheadSupports` under a canopy inside a closed Room returns the canopy then the lid; under open sky, none; clearance equals the difference | Lids are forgotten, or order is not by elevation |
| T-V11 | Visitor primitives for the V1 fixtures equal the editor's with editor-only streams removed; no relation cue, handle or ghost is present; a lifted overhead is still drawn and still casts shadow in Preview | Lift state leaks, or regions are drawn by an editor-only path |
| T-V12 | Undo and Redo of create, each edit, each fit and Erase restore exact canonical bytes; Redo reuses the captured region id | Redo allocates a new id |
| T-V13 | Mounted gesture boundary: a corner drag and a body drag show a preview with no full compile and no history write; release installs the same proposal once; Escape restores | The adapter calls a planner per pointer move |
| T-P1 | For every existing fixture, with every Wall `level`: compiled Walls, Junctions, cache keys and Wall mesh buffers are byte-identical to the pre-bump output | The new code path is taken for level Walls, or the key gained a field |
| T-P2 | A gable Wall split off its apex, at its apex, and rejoined: tops are exact at every cut and the round trip restores the original bytes | Split re-interpolates, or join compares gradients loosely |
| T-P3 | Corners where a sloped Wall meets a level, a taller and another sloped Wall, at degree 2, 3 and 4: the mesh is watertight and winding agrees with normals | Top heights at mitre vertices are extrapolated |
| T-P4 | An Opening under the low end of a slope refuses when it would exceed the top there; the same Opening under the high end is accepted; lowering the eave below an Opening refuses naming it | Fit is still tested against one scalar |
| T-P5 | A curved slope Wall: the sheet at amount 1 shows a straight top line; picking the top edge on the sheet resolves to the canonical station | The top is linear in chord, not station |
| T-P6 | A Junction move that would put the apex outside the Wall refuses whole; a closed Wall refuses any non-level top | The apex is clamped silently |
| T-R1 | Every flat-region fixture compiles to the same faces before and after V3a | Flat became a zero-rise shed |
| T-R2 | Shed and gable over a rectangle, an L and a triangle: faces are planar, the ridge edge is shared exactly, the underside and top are `thickness` apart vertically everywhere | Faces are triangulated per vertex and crack at the ridge |
| T-R3 | J8 fixture: Fit roof to walls leaves the eave Walls at first contact and no Wall inside the roof; Fit walls to roof then makes all four read meets, the ends gabled with the apex under the ridge | The fit solves for a plane, or seals at the centerline and leaves an interior wedge |
| T-R4 | Fit walls to roof with a curved Wall under a shed, a closed Wall under a gable, and an Opening above the new top: each refuses whole, naming its subject; nothing is written | Partial application |
| T-R5 | A Wall half under the roof is left unchanged and named in the consequence; an oblique Wall crossing the ridge gets one apex at the crossing station | The fitted top needs two breakpoints |
| T-R6 | After both fits, moving the roof, changing its rise, or moving a Wall changes only that subject | A stored constraint |

Core cases sit beside the existing Layout contracts; adapter and F4 cases beside the circle and
unit-acceptance suites; placement follows `apps/editor/tests/README.md`. Each format slice also
runs the DB-backed API tests for version refusal, Save/Load and the unchanged publication gate.

## 13. Obligations on every slice

- **Editor.** Shell roles and coarse-pointer targets from PLATE; refusal wording through
  `adapters/layout/refusals.ts`; no control shown before it works.
- **Save/Load.** One codec and one canonical byte form through editor Save, API persistence and
  the release path. A saved document reloads byte-identically at the stated version.
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
| H-1 | **X1 Lift** | Take the overhead set from `overheadSourcesOf` (lids now, regions after V1b). Until V1b exists X1 may compute lids itself behind that one function name |
| H-2 | **SL1 Level cut** | A region whose slab is above the plane is not drawn; one the plane passes through is cut at its footprint; Wall caps under a profile use `wallTopAt` |
| H-3 | **SP1** | The merge rule's thickness-conflict refusal disappears with the fields (OD-1). `open-to-sky` keeps no thickness to restore |
| H-4 | **SP3** | Gets: region id, footprint accessor, the surface key, and region planners that report affected region ids so I7 can be gated. SP3 owns the follow relation, the rule that a following Space generates no floor of its own, and the retirement rule |
| H-5 | **C** | C1 takes the next admitted version after V1a if V1a merges first; "keeps thicknesses" drops out; the Round rules of §6.3 apply once V2b lands |
| H-6 | **A1, A2** | Their stated lineage is what `carryRegionWallIntents` and the split and join arithmetic of §6.3 consume |
| H-7 | **R Unroll the room** | A strip's top edge follows each Wall's top; no further change |
| H-8 | **J / S5a, S5b (T2)** | **Proposed, not ratified:** the region and Space surface references of §5.7 and their qualification; `regionsOverSpace` as the answer to Space paint scope for regions; duplicate carries the same shared Finish; a removed region and an `open-to-sky` lid are unresolved references. **Left to J:** the wire type, where a finish is stored, what an unresolved reference does, finish inheritance, and one history entry across Layout and Scene |
| H-9 | **T2 lights** | `queryOverheadSupports` is the magnet's source. Wiring the light gesture to it is T2's. Persistent attachment of a light or object to a region is a Scene support question and is not decided here |

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
| **Keep the fields inert** | Dead authored data and a merge refusal no creator can cause or fix |
| **Replace `height` with a `top` union** | One authority, but every reader of `wall.height` changes for no behavioural gain. `height` as the lowest top keeps them all correct |
| **`topProfile` optional beside `height`, absolute heights** | Two numbers able to disagree about the eave |
| **A general list of top breakpoints** | Admits valleys and sawtooth tops, outside the approved vocabulary, and loses the closed-form split and join rules |
| **Apex as a fraction of length** | Stays centred under a length edit, but contradicts the metre-offset rule Openings follow and makes split arithmetic inexact. **Centre apex** is one Card action |
| **Roof forms as a separate entity from regions** | The approved capability and Q16 put forms in the region family; a second family repeats footprint, identity, support and references |
| **Forms as arbitrary section profiles** | Gambrel and mansard are outside scope and break the guarantee that a fitted Wall top is expressible |
| **Fit roof by solving a plane through the Wall tops** | A constraint solver, with no answer for most inputs |
| **Fit walls at the centerline with no allowance** | Leaves a visible wedge of sky along the inside of every eave Wall |
| **Fit walls to the highest underside across the body** | For an oblique Wall crossing the ridge the result has two peaks and cannot be stored |
| **Persistent meets constraints** | Outside scope by decision; P26 D3 already prefers one-shot fixes |
| **Relations compiled on every edit** | Cost on every Wall edit for a reading shown for one selected region |

## 16. Owner decisions

| # | Decision | Recommended answer | Blocks |
| --- | --- | --- | --- |
| **OD-1** | What becomes of `floorThickness` and `ceilingThickness` | **Remove both in V1a.** Observed consequences: Room and document bounds shrink by 0.1 m above and below, which the Camera session reads (O14); the merge-conflict refusal goes; SP-plan's "kept so switching back restores the lid" has nothing to keep | V1a |
| **OD-2** | Does "V1 does not merge before Lift" bind V1a | **No. It binds V1c**, the first slice in which a creator can author an overhead. V1a and V1b create nothing a creator can reach | V1a start |
| **OD-3** | Bump order and count | **V1a before C1; five bumps in the batch**, numbers taken at merge. The roadmap's risk 9 counted three | V1a start |
| **OD-4** | Scene objects on a region that moves | **They stay where they are in V1**, with the count shown before the edit. Riding along needs J's cross-unit transaction | V1c |
| **OD-5** | A closed Room under an authored roof | **It keeps its flat lid at eave height**, which is a ceiling under a pitched roof. A cathedral ceiling is **Open to sky**, read as "Open to sky · under Roof 1". The owner may prefer other words for that readout when a region covers the whole Space; the model does not change | V3c |
| **OD-6** | Where a straight Wall's top is edited, given its Unroll entry is disabled | **On the Wall's own face**, through the same marks and the same map at amount 0. The Unroll entry stays disabled for straight Walls | V2c |
| **OD-7** | What the two fits mean | **Fit roof to walls moves the roof to first contact; Fit walls to roof seals with the allowance** (§7.3). Two explicit steps for J8 | V1b |
| **OD-8** | "A light mounts under an overhead region" in V1's acceptance | **T1 delivers the query (V1d); T2 wires the magnet.** V1 is accepted on the query and on an object resting on a floor region | V1d |

## 17. Risks and limits

1. **The Wall mesh builder is the delicate module here.** V2a changes its top edge. P8 and T-P1
   are the containment: a level Wall must not enter the new path.
2. **Corner tops are clamped at mitre vertices.** Near a corner a sloped top is flat for at most
   half a Wall thickness. It keeps seams closed and is not visible at ordinary scale.
3. **A fitted Wall may stand inside the roof's thickness** by up to twice its allowance, and comes
   out of the top when the roof is thin and steep. The consequence line says so.
4. **Forms are extruded profiles.** An L-shaped gable has no valley. Hips, valleys and dormers are
   outside this batch.
5. **Footprints are straight-edged.** Over a round Room, Fit to space writes a many-pointed
   polygon that is awkward to edit by hand.
6. **Objects do not ride with regions** (OD-4), and a floor region's underside holds no light.
7. **The 1.0 m relation reach and the 1,024-point cap are chosen numbers.** Each is one named
   constant with a test at its edge.
8. **`apexOffset` in metres** means a resized gable Wall is off centre until **Centre apex** or a
   fit.
9. **Five bumps cost calendar time**, and each regenerates the fixture set.
10. **V1's editor surface is minimal by design.** Ink's reading chip ("Raised platform", "Canopy
    roof") is not built here.
11. **Nothing here was run.** Line references were read at `6e1b7bc5` and will drift; A1–A6 are
    unverified until their slices check them.
