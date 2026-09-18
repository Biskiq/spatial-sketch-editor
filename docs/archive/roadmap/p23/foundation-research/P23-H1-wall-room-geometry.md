# P23-H1 — Wall / room / opening geometry harvest

**Status:** completed evidence harvest — 2026-09-08  
**Museum Editor baseline:** `toni8699/spatial-sketch-editor@7492b4e6d4dc3bb6148b64e3b7327117f11b6b17` (`P23 plan subslices`)  
**Scope:** P23-H1 only — wall sizing / room-boundary continuity / opening attachment and manipulation semantics.  
**Not authority to implement:** this artifact supplies evidence to the P23.1 / P23.3 reconciliation pass. It does not amend those plans.

## 1. Fixed H1 constraints

This harvest keeps the P23 architecture unchanged:

- `LayoutDocument` remains authored architecture truth. `SceneDocument` is not rewritten to compensate for layout edits.
- Room identity and ownership stay explicit. H1 does not infer room ownership, room adjacency, or shared-wall identity from proximity.
- `compileLayoutGeometry()` remains the single renderer-neutral geometry compiler. Plan and 3D do not gain consumer-local wall / curve / opening reconstruction.
- Compiled query records and `PlanRenderModel` remain the Plan geometry source. Upstream canvas or Three hit-testing code is not imported as a second geometry source.
- One completed edit / Apply / gesture produces at most one `layout` history result. Rejected, cancelled, missing-target, and no-op edits produce none.
- Candidate edits must be deterministic and atomic: resolve target → construct complete candidate → run structural + geometry validation → install/commit only on success.
- Visitor/editor isolation remains unchanged. No editor session, selection, history, controller, renderer, or gizmo infrastructure crosses into visitor-safe layout-core.

The current Museum seams already support this shape:

| Concern | Current seam at Museum baseline | H1 consequence |
|---|---|---|
| Room / segment editing | `apps/editor/src/lib/editor/layout/layout-editing.ts` — `roomPoints`, `replaceRoomPoints`, `replaceRoomVertex`, `roomEdgeLength` | Straight-wall resize should extend these pure layout helpers rather than mutate SVG/Three state. |
| Room-unit transforms | `apps/editor/src/lib/editor/layout/layout-room-transform.ts` — `transformLayoutRoomUnit`, `layoutRoomUnitPivot` | Preserve the existing whole-candidate validation / non-mutation pattern and explicit owned-object handling. Wall sizing itself must not become room-unit motion. |
| Opening authored data | `apps/editor/src/lib/editor/layout/layout-opening-editing.ts` — meter `offset`, `LayoutOpeningPatch`, `openingInterval`, deterministic opening IDs | Keep `offset` as physical distance from segment start. Do not adopt normalized upstream opening positions. |
| Geometry validation | `packages/layout-core/src/layout-geometry-validation.ts` — closed-boundary, zero-length, self-intersection, opening bounds / overlap / vertical checks | Reuse these as commit preconditions. Do not create a parallel wall/opening validator with different tolerances. |
| Canonical compiler | `packages/layout-core/src/layout-geometry.ts` — `compileLayoutGeometry`, `compileRoom`, `compileOpening` | Length / tangent / opening placement truth must come from canonical segment sampling / compiled geometry, not local resampling. |
| Transaction boundary | `apps/editor/src/lib/editor/layout/layout-mutation-runner.ts` — `runLayoutMutation`, `layoutMutationRunnerFor`; `layout-transaction.ts` | Successful standalone numeric edits: one transaction. Invalid/no-op: cancel/skip, zero history. |
| Existing acceptance seam | `apps/editor/tests/lib/editor/layout/layout-validation.test.ts`; `layout-room-transform.test.ts`; `layout-mutation-runner.test.ts` | H1 fixtures should extend these semantics instead of introducing a separate test harness. |

Current compiler behavior is especially important for P23.3: `compileOpening()` already interprets `opening.offset + opening.width / 2` as physical distance along the canonical sampled segment, derives center/tangent there, and emits the opening center polyline. H1 therefore treats the stored meter offset as durable product meaning, not an implementation detail.

---

## 2. Upstream disposition summary

| Repo | Pinned revision inspected | License rechecked live | H1 disposition | Narrow reason |
|---|---|---|---|---|
| `laanlabs/openPlan3D` | `511ff08f57526784c0bf3bc48466bfea04204bbc` | MIT, `LICENSE`, copyright 2026 theLodgeStudio | **PORT** | Port the pure **plan-all-updates-before-apply** pattern and permissively licensed adversarial fixture shapes. Adapt all units/topology/opening semantics to Museum. |
| `furnishup/blueprint3d` | `cac8b62c1a3839e929334bdc125bf8a74866be9e` | MIT in root `LICENSE.txt` (package metadata also says `(MIT OR Apache-2.0)`) | **STUDY** | Useful corner / half-edge join concepts, but its mutable corner graph and render-coupled half-edge/room model conflict with Museum ownership. No H1 code should be ported. |
| `mjcipriano/sweethome3d` | `1381e59c9e28a6b1c944234b2121f13219d2c607` (7.15.0 release merge) | GPL v2 or later, root `LICENSE.TXT` / `COPYING.TXT` | **STUDY** | Strong wall-controller / joined-endpoint / wall-bound opening semantics. GPL means concepts and independently authored fixture ideas only; no code/test transcription. |

---

# 3. openPlan3D — whole-candidate wall resize and opening hit evidence

## 3.1 Revision / license

- Repo: `laanlabs/openPlan3D`
- Revision: [`511ff08f57526784c0bf3bc48466bfea04204bbc`](https://github.com/laanlabs/openPlan3D/commit/511ff08f57526784c0bf3bc48466bfea04204bbc)
- License: MIT — [`LICENSE`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/LICENSE)
- License obligation if source or substantial test expression is ported: retain the upstream copyright / permission notice in the applicable third-party notice or copied source context.

**Disposition: `PORT`**, but only for the narrow pure-candidate pattern and selected fixture structure. The upstream store, room detector, renderer helpers, units, tolerances, and normalized opening model are not portable architecture.

## 3.2 Relevant files / functions / tests

### Wall edit core

[`src/lib/utils/wallEditing.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/src/lib/utils/wallEditing.ts)

- `wallLength(wall)`
- `connectedWallEndpoints(walls, point, excludeWallId)`
- `finitePoint(point)`
- `planWallResize(walls, id, length, fixed)`
- `validPositiveDimension(value)`
- `validOpeningPosition(value)`
- upstream constants `WALL_JOIN_TOLERANCE = 2` cm and `MIN_WALL_LENGTH = 1` cm

`planWallResize` is the high-value seam: it computes a `Map<wallId, updates>` first, validates all changed coordinates / lengths, and returns the plan without partially applying it. The moving endpoint and every joined endpoint discovered at that old corner are planned together.

### Store integration — study only

[`src/lib/stores/project.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/src/lib/stores/project.ts)

- `resizeWallLength(...)`
- `updateDoor(...)`
- `updateWindow(...)`

This layer demonstrates atomic history integration, but it is store-specific and uses normalized opening `position`. Do not port it.

### Wall-resize / dimension tests

[`tests/wall-editing.test.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/tests/wall-editing.test.ts)

Relevant cases:

1. fractional resize preserves joined corner, room metadata, wall metadata, door/window records, unrelated floor, one undo entry, undo/redo;
2. fixed-end resizing moves the opposite corner and the correct neighbor;
3. rotated walls plus reversed endpoint orientation retain connectivity;
4. near endpoints inside the upstream pointer tolerance move together while slightly farther endpoints do not;
5. curved wall resize scales its control point;
6. collapsing a connected neighbor rejects atomically;
7. non-finite / zero / negative / too-short lengths reject without project/history mutation;
8. missing wall and unchanged length do not create history and do not destroy redo;
9. invalid dimension and normalized opening-position writes reject atomically.

### Room-resolution evidence

[`src/lib/utils/roomDetection.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/src/lib/utils/roomDetection.ts)

- `splitWallsAtTJunctions`
- `detectRooms`
- `resolveRooms`
- `getRoomPolygon`

[`tests/rooms.test.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/tests/rooms.test.ts)

The detector uses a generous endpoint/T-junction tolerance and reconstructs room identity from wall sets; newly detected IDs include `Date.now()`. This is valuable negative evidence for Museum, not code to adopt.

### Opening picking evidence

[`tests/opening-hit-testing.test.ts`](https://github.com/laanlabs/openPlan3D/blob/511ff08f57526784c0bf3bc48466bfea04204bbc/tests/opening-hit-testing.test.ts)

- `findDoorAt` / `findWindowAt` behavior across zoom levels;
- physical opening width remains selectable;
- screen-space edge tolerance remains stable with zoom;
- empty space away from a wide opening must not be captured;
- rotated / curved wall picking uses rendered tangent;
- missing / degenerate walls and zero zoom do not hit;
- visual topmost opening wins when overlapping draw order exists.

## 3.3 What may come over

### PORT

1. **Plan first, apply second.** A wall-size command should produce a complete Museum `LayoutDocument` candidate before editor state is changed.
2. **Explicit fixed endpoint.** The numeric operation carries `fixed: 'start' | 'end'`; the opposite endpoint moves along the existing straight segment direction.
3. **Validate every affected edge before commit.** A selected wall may be locally valid while the predecessor/successor created by moving its shared vertex becomes degenerate. The entire room/document candidate must be checked.
4. **No-op / missing / invalid means no history.** Preserve redo where the existing history layer already does so.
5. **Adversarial fixture shapes** from `wall-editing.test.ts`: fractional lengths, rotated geometry, wrap/reversed endpoint cases, neighbor collapse, non-finite input, unrelated-room isolation, undo/redo.
6. **Opening hit-test fixture ideas** from `opening-hit-testing.test.ts`: physical-width containment plus a CSS-pixel edge halo that is invariant under zoom.

### ADAPT to Museum semantics

- Upstream centimeters → Museum meters.
- Upstream array of free walls → one explicit `LayoutRoom.boundary.segments` ring. The two affected neighbors are found by the selected segment's room/index, not by scanning coordinates.
- Upstream whole-update `Map` → pure `LayoutDocument` candidate/result with deterministic target IDs and a rejection reason.
- Upstream renderer helpers for opening center/tangent → Museum compiled/query/Plan render geometry.
- Upstream undo coalescing behavior → existing Museum transaction contract. P23 numeric Apply remains one Apply = one history result; H1 does not import upstream coalescing policy.

## 3.4 What must not come over

### REJECT

1. **Tolerance-derived topology.** `connectedWallEndpoints` scans for endpoints within 2 cm. Museum already owns topology through ordered, closed room segments. A nearby endpoint in another room must never be silently treated as joined.
2. **Room re-detection as authored truth.** `detectRooms` / `resolveRooms` reconstruct room identity from geometry / wall sets and use timestamp-derived IDs. Museum keeps explicit stable room IDs and segment IDs.
3. **The upstream 5 cm T-junction / room endpoint tolerance.** It is a product-specific inference tolerance, not Museum topology truth.
4. **Normalized opening `position ∈ [0,1]`.** Museum `LayoutOpening.offset` is physical meters from segment start.
5. **Curved-wall length implementation.** `wallLength` samples a quadratic curve at 20 fixed steps and `planWallResize` scales the control point. Museum must use its canonical segment evaluator/compiler, and P23.1 keeps auto-bezier exact sizing read-only.
6. **Upstream canvas/store architecture.** No renderer-owned geometry, Svelte store mutation, or upstream history implementation comes under `layout-core`.
7. **Upstream minimum wall policy.** `MIN_WALL_LENGTH = 1 cm` is not evidence for a Museum product minimum. Museum already has canonical degeneracy validation; do not introduce a second threshold from this source.

## 3.5 Failure cases H1 carries forward

| Failure | H1 Museum result |
|---|---|
| new wall length non-finite / non-positive | reject candidate; document/preview/history unchanged |
| target segment missing or not a straight line | reject; no fallback to curve scaling |
| moving shared vertex collapses predecessor/successor | whole candidate rejected |
| candidate breaks room closure or self-intersects | canonical geometry validation rejects |
| candidate makes any opening overflow / overlap / exceed vertical fit | canonical opening validation rejects whole wall edit |
| unrelated room endpoint lies merely near moving point | must remain untouched; proximity has no ownership authority |
| no-op exact same length | no document/history change |
| curved wall exact resize requested in P23.1 | unsupported; readout only |

---

# 4. Blueprint3D — corner graph and half-edge join study

## 4.1 Revision / license

- Repo: `furnishup/blueprint3d`
- Revision: [`cac8b62c1a3839e929334bdc125bf8a74866be9e`](https://github.com/furnishup/blueprint3d/commit/cac8b62c1a3839e929334bdc125bf8a74866be9e)
- Root license: MIT — [`LICENSE.txt`](https://github.com/furnishup/blueprint3d/blob/cac8b62c1a3839e929334bdc125bf8a74866be9e/LICENSE.txt), copyright 2015 FurnishUp Inc.
- `package.json` declares `(MIT OR Apache-2.0)`; H1 records the inspected root source license as MIT and does not rely on the package metadata to broaden obligations.

**Disposition: `STUDY`.** No Blueprint3D source is needed for P23.1/P23.3 minimum implementation.

## 4.2 Relevant files / functions / classes

### Corner / topology graph

[`src/model/corner.ts`](https://github.com/furnishup/blueprint3d/blob/cac8b62c1a3839e929334bdc125bf8a74866be9e/src/model/corner.ts)

- `Corner.wallStarts` / `wallEnds`
- `snapToAxis`
- `move` / `relativeMove`
- `combineWithCorner`
- `mergeWithIntersected`
- `removeDuplicateWalls`

A `Corner` is a mutable graph node. Moving it can merge with another nearby corner or split a wall it intersects, then removes duplicate / zero-length walls.

### Wall

[`src/model/wall.ts`](https://github.com/furnishup/blueprint3d/blob/cac8b62c1a3839e929334bdc125bf8a74866be9e/src/model/wall.ts)

- `Wall(start: Corner, end: Corner)`
- `setStart` / `setEnd`
- `frontEdge` / `backEdge`
- wall ID derived from endpoint IDs
- items, textures, thickness, height, callbacks live on the same mutable object

### Half edge / thickness-aware join

[`src/model/half_edge.ts`](https://github.com/furnishup/blueprint3d/blob/cac8b62c1a3839e929334bdc125bf8a74866be9e/src/model/half_edge.ts)

- `HalfEdge.next` / `prev`
- `interiorStart` / `interiorEnd`
- `exteriorStart` / `exteriorEnd`
- `halfAngleVector`
- `generatePlane`

The useful geometry concept is an angle-bisector/miter offset at a joined corner: interior/exterior wall faces are derived from the centerline, thickness, and predecessor/successor direction.

### Room / DCEL construction

[`src/model/room.ts`](https://github.com/furnishup/blueprint3d/blob/cac8b62c1a3839e929334bdc125bf8a74866be9e/src/model/room.ts)

- `Room(corners)`
- `updateWalls()` builds a doubly connected half-edge loop for the room
- `updateInteriorCorners()` derives interior face corners
- `generatePlane()` creates the floor plane

## 4.3 Relevant tests / fixtures

No focused first-party automated wall/corner/half-edge geometry suite was located at the pinned revision through the repository tree/code search used for H1. Therefore **no Blueprint3D test expression is a P23 acceptance source**. Any Museum fixture below is independently authored from the geometry concept, not copied from an upstream test.

## 4.4 What may come over

### STUDY / possible later ADAPT

- **Centerline vs thick-wall face distinction.** Authored semantic boundary can remain simple while the compiler derives thickness-aware interior/exterior wall faces.
- **Angle-aware join concept.** If a later P23/P26 slice needs better miter/bevel wall corners, derive join geometry from neighboring segment tangents in the canonical compiler.
- **Directed room-side semantics.** A wall may have different room-facing sides without duplicating the authored wall centerline.

These are compiler concepts only. H1 does not add a DCEL requirement to `LayoutDocument`.

## 4.5 What architecture must not come over

### REJECT

1. **Mutable corner object graph as authored truth.** Museum already has explicit ordered room boundary segments and stable IDs.
2. **Automatic merge/split on proximity.** Pointer snap feedback must not silently rewrite topology or room identity.
3. **Derived wall ID from endpoint IDs.** Museum segment identity must survive endpoint movement.
4. **Three.js inside semantic geometry.** `HalfEdge` owns `THREE.Mesh` / matrices; `Room` builds `THREE.ShapeGeometry` / `THREE.Mesh`. This directly violates the renderer-neutral layout boundary.
5. **Callbacks/render state in wall model.** Redraw callbacks, textures, attached runtime items, and planes do not belong in `LayoutDocument` or compiled renderer-neutral geometry.
6. **Unbounded miter formula as product policy.** Very shallow / near-180° joins can make angle-bisector offsets unstable or huge. If Museum later adopts miter geometry, it needs explicit deterministic degeneracy / bevel policy and tests in `layout-core`.

## 4.6 H1 failure lesson

Blueprint3D is evidence **against** solving P23.1 by introducing a new corner graph. For Museum, a straight wall resize should stay a bounded edit to one room's ordered segment ring, followed by the existing whole-document validator/compiler. Join rendering remains derived.

---

# 5. Sweet Home 3D — wall controller and wall-bound opening semantics

## 5.1 Revision / license

- Repo: `mjcipriano/sweethome3d`
- Revision: [`1381e59c9e28a6b1c944234b2121f13219d2c607`](https://github.com/mjcipriano/sweethome3d/commit/1381e59c9e28a6b1c944234b2121f13219d2c607)
- Revision context: merge committing release 7.15.0.
- License: GPL v2 or later — [`LICENSE.TXT`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/LICENSE.TXT) and `COPYING.TXT`.
- Third-party materials have separate notices; none are needed for H1 because no SH3D source/assets are imported.

**Disposition: `STUDY` only.** GPL code and JUnit expressions must not be copied or translated into Museum Editor. H1 records concepts and independently authored behavior fixtures only.

## 5.2 Relevant files / functions / tests

### Authored wall model

[`src/com/eteks/sweethome3d/model/Wall.java`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/src/com/eteks/sweethome3d/model/Wall.java)

- authored start/end coordinates;
- explicit `wallAtStart` / `wallAtEnd` relations;
- `setWallAtStart` / `setWallAtEnd` detach old symmetric join;
- `getLength()` uses straight Euclidean distance or analytic circular-arc length;
- wall thickness / height and side properties are semantic wall properties.

Key lesson: joined-endpoint identity is explicit semantic state, not discovered each numeric edit from a large spatial tolerance.

### Numeric wall controller

[`src/com/eteks/sweethome3d/viewcontroller/WallController.java`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/src/com/eteks/sweethome3d/viewcontroller/WallController.java)

Relevant controller pieces:

- editable properties include start/end coordinates, length and distance-to-end;
- `setLength(...)` recomputes an endpoint from the existing wall angle for a straight wall;
- `modifyWalls()` snapshots selected wall state, applies the grouped modification, and posts one undoable edit;
- `doModifyWalls(...)` / `undoModifyWalls(...)` form the grouped mutation/restore pair;
- `moveWallPoints(...)` explicitly propagates a changed start/end coordinate to the wall joined at that semantic endpoint, regardless of whether the joined wall stores the shared corner as its start or end.

### Wall numeric test

[`test/com/eteks/sweethome3d/junit/WallPanelTest.java`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/test/com/eteks/sweethome3d/junit/WallPanelTest.java)

Relevant behavior: changing the distance/length control on a diagonal wall updates the endpoint along the wall's current angle. H1 uses this only as corroborating behavioral evidence; no GPL test code/text is ported.

### Door / window semantic model

[`src/com/eteks/sweethome3d/model/DoorOrWindow.java`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/src/com/eteks/sweethome3d/model/DoorOrWindow.java)

Relevant semantics:

- a door/window carries wall-related placement/cutout parameters;
- cutout shape is defined in normalized local coordinates then scaled to the real opening;
- wall-cut behavior is explicit rather than inferred from appearance alone.

[`src/com/eteks/sweethome3d/viewcontroller/HomeFurnitureController.java`](https://github.com/mjcipriano/sweethome3d/blob/1381e59c9e28a6b1c944234b2121f13219d2c607/src/com/eteks/sweethome3d/viewcontroller/HomeFurnitureController.java)

- `ModifiedDoorOrWindow` snapshots `boundToWall`, wall thickness/distance, wall-relative width/left/height/top and sash state;
- reset restores those semantic wall-binding fields with the rest of the grouped edit.

Focused opening-fit JUnit coverage matching Museum's `offset + width <= segment length` model was not located. SH3D is therefore evidence for **semantic attachment / grouped preservation**, not a source of copyable opening-fit algorithms or tests.

## 5.3 What may come over

### STUDY concepts

1. **Numeric wall length is endpoint geometry, not scale.** For a straight wall, preserve direction and solve the moved endpoint from the chosen fixed endpoint.
2. **Joined endpoints propagate by semantic relationship.** Museum's equivalent is deterministic predecessor/successor segment updates inside the owning closed room, not a coordinate-nearness scan.
3. **Wall-bound opening state remains semantic during grouped edits.** Museum should preserve `LayoutOpening` identity and all fields not explicitly owned by the current operation.
4. **One property edit may require a grouped reversible operation.** Museum already has the transaction/mutation-runner boundary; reuse it rather than porting MVC undo classes.
5. **Opening cutout is derived from semantic opening parameters.** Museum already does this through `compileLayoutGeometry()` / opening sections and should keep that compiler ownership.

## 5.4 What must not come over

### REJECT

1. Any GPL source or JUnit test expression, including line-for-line translation.
2. SH3D's `Home` / MVC controller / Swing undo architecture.
3. Door/window-as-furniture ownership. Museum openings remain `LayoutDocument` architecture, not `SceneDocument` entities.
4. SH3D wall object references (`wallAtStart` / `wallAtEnd`) as a new persisted Museum graph. Museum's existing room-boundary ordering is sufficient for P23.1.
5. Java2D / Java3D/Swing renderer assumptions, cutout renderer implementation, or UI panel structure.
6. Percentage / furniture-depth wall-placement fields as Museum opening coordinates. Museum canonical coordinate is meter `offset` along the owning segment.

---

# 6. Museum seam mapping — H1 implementation targets

H1 does not authorize code, but it narrows the implementation seams the later plan should target.

## 6.1 Straight wall exact-size candidate

Preferred pure operation shape:

```ts
type ResizeStraightWallInput = {
  roomId: string;
  segmentId: string;
  length: number; // meters
  fixed: 'start' | 'end';
};

type ResizeStraightWallResult =
  | { success: true; document: LayoutDocument; affectedSegmentIds: string[] }
  | { success: false; message: string };
```

This is illustrative API shape, not a required symbol name.

The operation should:

1. structurally validate / canonicalize input document using the existing layout path;
2. resolve one explicit room + line segment by ID;
3. reject non-finite / non-positive length and unsupported curve target;
4. compute the moving endpoint from the fixed endpoint and the current line direction;
5. update the selected segment and exactly the room-ring neighbor sharing that moved vertex (including wrap-around); keep all segment IDs;
6. preserve the selected room ID / frame / metadata and every unrelated room/floor verbatim;
7. preserve every opening record verbatim — especially meter `offset`; do not normalize/rebase it as hidden resize behavior;
8. run structural validation plus `validateLayoutDocumentGeometry()` on the complete candidate;
9. reject if any boundary, intersection, opening-fit, overlap or vertical issue blocks;
10. hand a valid candidate to the existing editor transaction adapter for one commit.

**Important refinement:** choosing `fixed: 'end'` moves the segment's start but does **not** silently rewrite opening offsets. Because Museum defines `offset` from segment start in meters, openings will move in world space with the start. If the preserved offset no longer fits after resize, the whole candidate rejects. A future explicit “preserve world opening position” operation would be a separate product choice and must visibly own the opening mutation.

## 6.2 Rectangle room width/depth candidate

H1 finds no reason to replace the P23.1 seed's bounded rectangle definition. Do **not** run upstream room detection after resize.

For verified four-line rectangles:

- keep the same `LayoutRoom.id`, `frame`, four segment IDs and segment ordering;
- solve width/depth in room-local boundary coordinates from the explicit anchor policy;
- preserve `SceneDocument` and room ownership;
- preserve `LayoutOpening.offset` records exactly, then let canonical validation accept/reject the candidate;
- arbitrary polygons / curves remain outside exact width/depth editing in P23.1.

Blueprint/openPlan room inference is negative evidence here: a numeric room-size edit must not rebuild rooms or generate replacement IDs.

## 6.3 Opening manipulation candidate

P23.3 should continue to use one durable coordinate:

```text
offset = physical meters from owning segment start
```

Any UX projection is derived:

```text
start clearance = offset
center distance  = offset + width / 2
end clearance   = canonical segment length - (offset + width)
```

Center-position / end-clearance numeric fields, if exposed, convert back to `offset`; they do not add persisted coordinates.

For straight-wall direct manipulation:

- body drag changes `offset` only;
- start/end width handle changes `offset + width` or `width` according to the handle while preserving the opposite opening edge as the interaction anchor;
- `segmentId`, `id`, `kind`, `height`, `sillHeight`, `profile`, and `connectsRoomIds` stay unchanged unless the selected field explicitly owns them;
- candidate uses the same validator as numeric input;
- overflow/overlap/vertical invalidity rejects rather than silently clamping the authored value.

For hit testing, port the **fixture principle** from openPlan, not its renderer helpers: test true physical opening span first, then an edge halo expressed in CSS pixels and converted through current Plan projection. Geometry/tangent should come from compiled/query/Plan render data.

---

# 7. P23.1 seed reconciliation recommendations

These are recommendations **recorded in H1 only**. P23.1 is not edited by this harvest.

| Seed choice | H1 result | Recommended refinement for later P23.1 reconciliation |
|---|---|---|
| exact straight-wall length with explicit fixed endpoint | **CONFIRM** | Keep. Both openPlan and SH3D support endpoint-based numeric sizing. |
| whole-candidate atomic validation | **CONFIRM / strengthen** | Make it explicit that the pure operation returns a complete `LayoutDocument` candidate; the editor adapter installs only a fully validated candidate. |
| preserve segment identity / room topology | **CONFIRM / strengthen** | Resolve predecessor/successor from the owning room's ordered segment ring. Never use a tolerance scan or room re-detection. |
| opening offsets remain meter semantics | **CONFIRM / clarify** | Wall resize preserves stored opening records exactly. No hidden normalization/rebasing for either fixed endpoint. Invalid fit rejects the wall candidate. |
| auto-bezier exact sizing deferred | **CONFIRM** | Explicitly reject openPlan's fixed 20-sample length + control-point scale approach. Readout must use Museum's canonical evaluator/compiler. |
| minimum wall length TBD | **REFINE** | Do not import openPlan's 1 cm constant. Rely on existing canonical degeneracy validation for P23.1 unless product separately chooses a user-facing minimum. |
| room width/depth for verified rectangle only | **CONFIRM** | Do not introduce openPlan room re-detection or Blueprint corner graph. Stable room/segment IDs are acceptance requirements. |
| invalid candidate atomic reject | **CONFIRM / expand fixtures** | Add neighbor-collapse, near-but-unowned room, fixed-end, no-op/redo, and opening-overflow-after-wall-shrink cases. |
| one Apply = one history entry | **CONFIRM** | Do not inherit openPlan's consecutive-edit coalescing semantics as a requirement. Use existing Museum transaction boundary. |

### P23.1 specific unresolved item after H1

H1 resolves the implementation direction for straight walls, but **does not set a new product minimum wall length**. If UX later requires a visible minimum beyond existing degeneracy tolerance, P23.1 must choose it explicitly rather than inheriting `1 cm` / `20 cm` / any upstream tolerance.

---

# 8. P23.3 seed reconciliation recommendations

These are recommendations **recorded in H1 only**. P23.3 is not edited by this harvest.

| Seed choice | H1 result | Recommended refinement for later P23.3 reconciliation |
|---|---|---|
| `offset` remains physical meters from segment start | **CONFIRM strongly** | Reject openPlan normalized `position`. Treat center/end displays as derived projections back into the single `offset` field. |
| straight-wall direct body/width handles | **CONFIRM** | Derive geometry from compiled/query/Plan render seams; no `wallPointAt` / `wallTangentAt` clone. |
| overflow rejects, not clamps | **CONFIRM / strengthen** | Do not reuse insertion-time `snapSegmentOffset` clamping as edit semantics. Commit validation owns bounds/overlap/height rejection. |
| one pointer gesture = one layout history result | **CONFIRM** | Begin/preview/commit/cancel through existing transaction adapter; invalid pointer-up restores baseline and creates no history. |
| width-handle hit policy TBD | **REFINE with evidence** | Use actual opening physical span plus a CSS-pixel edge/handle tolerance that is zoom invariant; exact pixel value remains UX tuning, not harvested topology tolerance. |
| clearance readouts | **REFINE** | Compute from canonical segment length and `offset/width`: start=`offset`, end=`length-(offset+width)`. No second stored coordinate. |
| wall shrink dependency | **REFINE** | Wall resize preserves opening records exactly; if shrink makes an opening invalid, wall resize rejects atomically. Do not auto-clamp, normalize, or move opening. |
| curved opening semantics supported as-is | **CONFIRM** | Keep compiler behavior. P23.3 direct manipulation stays straight-only; do not copy upstream tangent/sampling logic for curves. |
| door room relation explicit | **CONFIRM** | SH3D wall-binding is conceptual evidence only. Museum keeps explicit `connectsRoomIds`; no adjacency inference from physical placement. |

---

# 9. Acceptance-fixture provenance ledger

These are the fixtures H1 expects the later P23.1/P23.3 implementation to carry. `PORT` means the upstream MIT fixture structure may be adapted with attribution; `ADAPT/STUDY` means independently author the Museum fixture from the observed behavior/concept.

| Fixture ID | Museum assertion | Provenance | Disposition / license note |
|---|---|---|---|
| **H1-W1 fractional fixed-start** | resize a straight segment to fractional meter length; fixed start exact; moved end exact; selected + adjacent segment IDs stable; room/floor metadata unchanged; one history; undo/redo exact | openPlan `tests/wall-editing.test.ts` “fractional resizing” case | **PORT** fixture structure, MIT attribution |
| **H1-W2 fixed-end + wrap neighbor** | fixed end exact; start moves; predecessor (including room wrap-around) shares new vertex; successor at fixed end unchanged | openPlan fixed-end case + SH3D explicit joined-end propagation concept | **PORT** openPlan structure; SH3D concept **STUDY** only |
| **H1-W3 rotated room** | same exact sizing on a rotated/non-axis-aligned rectangle, no axis assumption | openPlan rotated corner case; SH3D diagonal WallPanel behavior | **PORT/ADAPT**; do not copy GPL test expression |
| **H1-W4 neighbor-collapse atomic reject** | resize that would collapse an adjacent segment returns failure; input/preview/selection/history unchanged | openPlan collapse case | **PORT** fixture structure, MIT attribution |
| **H1-W5 invalid/no-op/redo** | NaN/Infinity/non-positive/missing/no-op produce no history; pre-existing redo remains usable | openPlan invalid/no-op cases | **PORT** fixture structure, MIT attribution |
| **H1-W6 near-but-unowned isolation** | endpoint in another room placed within openPlan-like “join tolerance” distance does **not** move; only explicit owning room ring changes | openPlan `connectedWallEndpoints` tolerance test, deliberately inverted for Museum ownership | **ADAPT** negative fixture; documents rejected upstream topology inference |
| **H1-W7 stable explicit identities** | wall/room resize preserves `room.id`, all surviving `segment.id`s and deterministic serialized result; no timestamp/generated replacement room | openPlan `resolveRooms` / timestamp room IDs as negative evidence | **ADAPT** negative fixture |
| **H1-W8 canonical curve readout** | auto-bezier length readout equals Museum canonical evaluator/compiler result; exact resize unavailable | openPlan 20-sample `wallLength` as rejected implementation; Museum compiler seam | **ADAPT** negative fixture; no local resampling |
| **H1-W9 opening dependency on shrink** | wall resize that leaves preserved meter opening out of bounds rejects whole candidate; opening record remains byte/value-equivalent | openPlan wall-resize + normalized-opening preservation contrasted with Museum `layout-validation.test.ts` | **ADAPT** to Museum meter semantics |
| **H1-R1 rectangle resize identity** | width/depth edit on verified four-line rectangle preserves room/frame/segment IDs and unrelated rooms/Scene state | Museum existing room-transform/validation fixtures + Blueprint/openPlan re-detection rejection | **Museum-authored** |
| **H1-O1 meter center/end projection** | `offset`, center distance and end clearance round-trip exactly through one stored meter offset; no normalized field appears | Museum `compileOpening` semantics; openPlan normalized position rejected | **Museum-authored** |
| **H1-O2 wide-opening picking across zoom** | physical span hits; far empty space misses; edge halo stays CSS-pixel stable across representative zooms | openPlan `tests/opening-hit-testing.test.ts` | **PORT** fixture principle/structure, MIT attribution |
| **H1-O3 rotated straight-wall picking** | body/width handles follow canonical compiled tangent/Plan geometry on a rotated straight wall | openPlan rotated picking case, adapted to Museum compiled geometry | **PORT/ADAPT**, MIT attribution |
| **H1-O4 degenerate/missing owner** | missing opening/segment or degenerate owning segment cannot begin/commit mutation; no history | openPlan opening hit missing/degenerate cases + Museum validator | **PORT/ADAPT** |
| **H1-O5 overflow / overlap / vertical reject** | direct drag or numeric patch that violates endpoint, overlap, or sill+height constraint rejects atomically | Museum `layout-validation.test.ts` existing `opening_out_of_bounds`, `opening_overlap`, `opening_over_height` fixtures | **Museum-authored existing provenance** |
| **H1-O6 field preservation** | body drag changes only `offset`; width gesture changes only owned width/offset fields; `id`, `segmentId`, kind/profile/height/sill/relation remain exact | SH3D grouped wall-bound state preservation concept + Museum ownership rules | **STUDY-derived independent fixture**, no GPL expression copied |
| **H1-O7 cancel / invalid pointer-up** | cancelled or invalid gesture restores transaction baseline and creates no history; successful gesture creates exactly one | Museum `layout-mutation-runner` / transaction contract | **Museum-authored** |

### Fixture placement guidance

Prefer extending current suites by seam rather than creating an upstream-shaped subsystem:

- pure wall/room operation tests under `apps/editor/tests/lib/editor/layout/`;
- geometry rejection fixtures in / beside `layout-validation.test.ts`;
- transaction/history integration beside `layout-mutation-runner.test.ts` and existing inspector/viewport tests;
- Plan direct-manipulation hit/gesture tests beside current Plan interaction tests;
- compiler equivalence assertions where opening/curve derived geometry is already tested.

---

# 10. Explicit not-to-import list

H1 rejects importing or recreating any of the following:

- openPlan3D `resolveRooms` / `detectRooms` as Museum room authority;
- openPlan timestamp room IDs;
- openPlan endpoint/T-junction topology tolerances as authored connectivity;
- openPlan normalized door/window `position`;
- openPlan fixed-20-sample curve length or curve-point scaling resize;
- openPlan Svelte stores/canvas renderer/history architecture;
- Blueprint3D mutable `Corner` / `Wall` graph as `LayoutDocument` truth;
- Blueprint3D automatic corner merge / wall split from proximity;
- Blueprint3D endpoint-derived wall IDs;
- Blueprint3D `THREE.Mesh`, `THREE.Matrix4`, `ShapeGeometry`, callbacks, or render planes inside semantic/compiled layout geometry;
- Sweet Home 3D GPL source or test code, including translated/transcribed implementations;
- Sweet Home 3D MVC/Swing undo/controller architecture;
- Sweet Home 3D door/window-as-furniture ownership or percentage/depth placement fields;
- any second wall/opening geometry evaluator in Plan, Inspector, Threlte, or Svelte component code.

---

# 11. H1 conclusion

P23.1/P23.3 seeds are directionally sound. H1 does **not** justify a topology rewrite, corner graph, room detector, DCEL, or second geometry subsystem.

The strongest harvested implementation pattern is much smaller:

```text
explicit target + explicit anchor/fixed end
→ pure whole-document candidate
→ preserve stable room / segment / opening identity
→ canonical structural + geometry validation
→ one existing layout transaction
→ compiler / Plan render derive the result
```

The two material seed refinements are:

1. **Straight wall resize must use explicit room-ring adjacency, never proximity-based joined-wall discovery.**
2. **Wall resize preserves Museum opening meter offsets exactly; invalid post-resize fit rejects atomically rather than normalizing, clamping, or silently moving openings.**

For P23.3, opening direct manipulation should likewise remain a projection over the existing `offset/width` model: compiled/query geometry supplies placement truth; UI hit halos stay screen-space; the canonical validator decides fit; no alternate normalized or renderer-owned opening model is introduced.

**H1 stop condition met:** upstream revisions/licenses/files/tests/failures inspected; `PORT | STUDY | REJECT` boundaries recorded; Museum seam mapping and acceptance provenance recorded; P23.1/P23.3 recommended refinements recorded here only. No parent plan, tracker, or product-code modification is part of H1.
