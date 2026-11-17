# T1 Slice — SL1 Level cut, SL2 Drawn cut, SL3 Face & Section (`layout.slice`)

Authority: [README](README.md) §Slice (rev 3), [implementation-prs.md](implementation-prs.md) Lane SL
(rows SL1–SL3 and their acceptance), [creator-journeys.md](creator-journeys.md) J12. Design
authority: [editor-shell-and-visual-system.md](../../../reference/design-system/editor-shell-and-visual-system.md)
(PLATE: dock, Slice modes, temporary-reading pill, yellow, Escape ladder) and
[spatial-instrument-grammar.md](../../../reference/design-system/spatial-instrument-grammar.md)
(Slice row: end points, line, depth ray). Domain contract:
[layout.md](../../../reference/components/layout.md) (typed cut / projected / hidden streams with
source correspondence). Precedents followed, not re-derived: [x1-lift-plan.md](x1-lift-plan.md)
(session reading, pill, Escape, snapshot seam, T2 boundary) and
[a6-wall-face-plan.md](a6-wall-face-plan.md) (Face through the one Camera authority).

This is the **integrated** architecture for the whole Slice lane and the **detailed** SL1 plan. SL2
and SL3 open their own PRs and inherit §1–§6 without repeating the research; each keeps a short
plan of its own only for what is marked *SL2 spike* or *SL3 plan* here.

**Revision 2 (peer review on #362).** Corrected: clipping plane signs (§2.1), wholly-hidden
classification (§2.4), cap assembly (§2.2), clip ownership and snapshot restoration (§2.1), and the
three depth semantics (§1.1, §4, §5). Owner rulings on A-1…A-5 are recorded in §8. See
[Revision log](#revision-log).

Labels, as in X1:

- **Verified** — true on `main` at `2710120a`, read in the code (three r187 read in its source).
- **Approved** — required by the documents above. Not open to change here.
- **Decided** — this plan's engineering choice. The implementer follows it; a change needs a stop.
- **Assumption** — a choice that is reasoned but not proven; it names how and when it is validated.

## Goal

**Approved.**

- **SL1 Level cut.** Arm Slice, Level. A translucent yellow plane appears at the Height Sheet
  height across the Layout bounds. Dragging the Sheet moves it and snaps to the Sheet ticks. Nothing
  above the plane is drawn; cut Walls and Openings show a yellow-edged cap; overheads above are gone.
  The pill reads **Cut at 1.20 m · depth ▾ · Put back**; depth sets how far below the plane is shown,
  default to the floor. The cut is a reading, not a mode: the creator returns to Select and edits
  everything below. A hidden subject chosen in the Index draws as a ghost. Put back or Escape ends
  it. One Slice at a time. Lighting is unchanged.
- **SL2 Drawn cut.** A finite segment drawn like a Wall (45° soft snap, live length tag) in Plan or
  on the 3D ground cuts only within its length; the side toward the Camera at drawing time is hidden;
  **Flip** swaps; end points redraw it, the line moves it, a depth ray sets how far behind is shown.
  Pill: depth · Flip · Face · Section · Put back. A second Slice replaces the first.
- **SL3 Face & Section.** Exist only while a drawn Slice does. **Face** squares the one Camera to the
  cut through A6's `face` intent. **Section** is a flat, measured 2D reading of the cut built from
  Layout's typed cut and projected streams; every Section primitive selects its canonical source.
  Put back returns to the entry pose.

**Approved, all slices.** Slice is session state: never serialized, never in history, never in
Preview, snapshots or releases; Undo never touches it. One gesture is one history entry; refusals
have words. No format change.

Out of scope: X2 cutaway (it *consumes* the SL1 clip seam, §2.6), a universal CSG engine, solid caps
for arbitrary Scene models, remembering a Slice across reloads, a second Slice, any new dock slot,
shortcut or pill component.

## Verified current behavior

1. **Height Sheet** (`authoring/stage/stage-height-sheet.ts`) is host-owned session view state:
   `height()`, `set(m, cause: 'drag'|'key'|'tick')`, pins, `subscribe(role, fn)`, `subscribePins`,
   `subscribeReset`, `reset()`, `maxHeightMeters`. Its doc comment anticipates "a future Slice
   registers another role here". Default height `PLAN_DEFAULT_CUT_HEIGHT_METERS = 1.2`. Its knob and
   ticks are a DOM rail in `StageViewportRegion.svelte`, live under any armed tool.
2. **The Plan cut already follows the Sheet.** `stage-facade.ts` L752–755 subscribes role
   `'plan-cut'` and calls `setPlanParameters({ cutHeightMeters })`; `facade/plan-view.ts`
   `setPlanParameters` **merges** partial overrides. The live `layout.plan@1` evaluation exists in 3D
   too: Layout's 3D pick uses it.
3. **Layout plan representation** (`layout-core/src/layout-plan-representation.ts`): streams
   cut / projected / hidden / symbol; `PlanSourceRef {sourceId, sourceKind, generationId, stream,
   subRef}`; reasoned membership (included, filtered-type, outside-depth, outside-span,
   no-meaningful-projection) with `depthBelowCutMeters`; `PLAN_DEFAULT_DEPTH_METERS = 100`. Wall
   fragments are one span per `solidSpan` (interval `subRef`, extent `bottomY/topY`), Openings are
   symbol-only, objects use `planFootprint` + `worldAabb`. `streamFor` names plan streams, not 3D
   visibility.
4. **Layout 3D pick is analytic** (`authoring/layout/plan-pick-provider.ts`): Wall fragments become
   vertical face surfaces from the matching `solidSpans` (`bottomY..topY`); other kinds are flat
   surfaces at fragment elevation; Openings are hit by ray against `compiledOpeningFaceLoops` with a
   `context.pickScene(ray)` occlusion check (L583, L641); Lift outlines join here (X1).
5. **Scene pick** (`authoring/scene/scene-pick-source.ts` ~L187–235) walks every
   `raycaster.intersectObject` hit in order. Light placement, light gestures, artwork placement and
   Layout's opening occlusion all go through `pickScene` / `pickVisibleFace`.
6. **Materials** come from one T2 store per Canvas (`render/resources/material-store.ts`,
   `createMaterialStore()` with no options, provided by `provideRenderResources()`). Stage and Preview
   never share a store. Descriptors (`material-descriptor.ts`) are standard / basic / lambert /
   imported / depth / distance, keyed canonically, no role field. Editor ink is constructed outside
   the store under an exact per-file allowlist (`material-factory-boundary.test.ts`).
7. **The environment ground** is a store material (`WorldEnvironment.svelte` L161: `FLAT_GROUND`
   basic or `LIT_GROUND` lambert, vertex colours) at `groundY − 0.05` (flat) / `− 0.02`. The sky is
   `scene.background`. `StageMatGround` is editor ink, not a store material.
8. **three r187 clipping.** `material.clippingPlanes` needs `renderer.localClippingEnabled`.
   - **Sign.** The vertex chunk sets `vClipPosition = −mvPosition.xyz`; `WebGLClipping.projectPlanes`
     uploads each plane transformed to view space as `(normal, constant)`; the fragment chunk
     discards where `dot(vClipPosition, plane.xyz) > plane.w`. Substituting,
     `−n·p > c ⇔ n·p + c < 0`: **a fragment is discarded where `plane.distanceToPoint(p) < 0`
     and kept where it is ≥ 0** (union planes; an optional intersection group via
     `clipIntersection`). The alpha-to-coverage path uses the same signed distance.
   - `numClippingPlanes` is part of the program key, so a plane-*count* change recompiles; a
     plane-*value* change is a uniform update.
   - In `WebGLClipping.setState`, `renderingShadows && !clipShadows` applies **no** local clipping,
     and `getDepthMaterial` copies `clipShadows` onto the shadow depth material. **So with
     `clipShadows = false` (default) every shadow map is rendered from the unclipped world.**
   - `Material.copy` (hence `clone()`) **clones** each plane into a new array, so a cloned material
     no longer shares its source's planes. The store's `imported` path is the only material clone in
     editor code (`material-store.ts` L158).
   - `LineMaterial` supports clipping.
9. **Render layers:** 0 world, 2 overlay ink, 3 `LIFTED_RENDER_LAYER`. The Stage camera renders
   `[0, 2]`; the snapshot camera renders world + lifted, never overlay. The Stage renders on demand:
   any retained-object change must `invalidate()`.
10. **Stage renderer** is created with `stencil: true`; stencil is already used by Paper
    (`PAPER_SHEET_STENCIL`) and the selection silhouette (ref 1). Tone mapping `NoToneMapping`.
11. **Wall meshes** (`lib/layout/wall-mesh-builder.ts`) are face-built per Wall, may be open at
    Junction interfaces, and carry `pickRanges` (`Layout3dTriangleRef`) copied to
    `geometry.userData` by `wall-geometry-adapter.ts`. Meshes are tagged with
    `tagRenderIdentity(mesh, kind, id)`; `StageSelectionLayer` already builds its gold contours by
    reading rendered meshes by identity.
12. **Paper** draws Wall cut poché from `cutWallBandsOf` (compiled samples ± thickness/2); it
    approximates 3D miters at Junctions.
13. **Slice stubs to replace:** dock key `'unavailable-slice'` (`stage-contributions.ts` ~L105,
    "Slice is not available yet."); toolbar registry tool `'slice'` stage `'planned'` with Axis X/Z and
    Offset options (`world-toolbar/registry.ts` ~L151); disabled `data-view-slice` button in
    `StageDraftingControl.svelte` ~L284 ("Slice is planned for T1"); unavailable-slice CSS in
    `StageDock.svelte` L146/160. The dock's palette anchor renders only for `key.slot === 'ink'`
    (`StageDock.svelte` L33). `STAGE_DOCK_SHORTCUTS` has no Slice letter, and PLATE assigns none.
14. **The neutral Sheet cue** (`StageCanvas.svelte` ~L223, `heightPlane`) is shown only while the
    Sheet is being set (`stage-shell-state.svelte.ts` timer) and is documented as "not the future
    Slice's yellow".
15. **Escape** (`authoring/stage/route/stage-keyboard.ts` `case 'dismiss'`): … palette close (L268)
    → task/tool → … → selection → `liftActive` → `putBackLift` (L282). X1 put Lift *after*
    selection.
16. **A6 is merged:** `lib/layout/wall-face.ts` and `authoring/layout/wall-face-store.ts`; the
    `face` intent and `facePoseFromBounds` are in camera-core; Put back restores the captured
    `ViewportCameraState`.
17. **Snapshots** render the Stage scene with the Stage renderer through `renderStageSnapshot`
    (`StageSnapshotRenderer.svelte` L61), cached on `revision`.
18. **Renderer factories** are per surface (`render/canvas-renderers.ts`): `stageCanvasRenderer`
    (stencil, `'stage'`) and `previewCanvasRenderer` (`'preview'`).
19. **The wall builder** emits per-Wall meshes that are open at Junction ends and **omits** an
    offset-face region that a resolved interface makes interior (`faceOmitted`, L1068), with keels
    (degree ≥ 3) and bevel bridges as their own faces. Interface distances split faces, so abutting
    vertices come from the same resolved values but are not guaranteed bit-identical.
20. **Paper's union** (`paper-fill-geometry.ts` `unionPaperFillPolygons`) already stitches a
    directed boundary into loops, turning clockwise at a touching point, checks in/out balance per
    node, and returns `null` rather than guessing. A real-WebGL fixture harness exists outside the
    Vitest lanes: `perf/regressions/renderer-lifetime-entry.ts` + `perf/flows/renderer-lifetime.spec.ts`
    under `perf/playwright.config.ts` (owner-run, not a CI job).

## 1. The typed cut — one contract for three slices

### 1.1 Representation (Decided)

```ts
// authoring/stage/slice/slice-cut.ts  (pure, editor-only, no Svelte, no three)
/** SL1: how far *below* a horizontal cut stays shown. Vertical. */
export type LevelDepth = { readonly kind: 'to-floor' } | { readonly kind: 'below'; readonly meters: number };

export type SliceReading =
  | { readonly kind: 'level'; readonly depth: LevelDepth }
  // SL2 adds, without changing the level arm (§5):
  // | { kind: 'drawn'; start: Vec2; end: Vec2; hidden: 'left' | 'right'; depthMeters: number }
  ;

/** A reading resolved against live view state, in world metres. The only input to every consumer. */
export type ResolvedSlice =
  | { readonly kind: 'level'; readonly cutY: number; readonly lowerY: number | null };
  // SL2: | { kind: 'drawn'; origin; along; normal (toward the hidden side); halfLength; depthMeters }
```

- A **Level** reading stores no elevation. Its elevation *is* the Height Sheet (Approved: "the plane
  appears at the Sheet height; dragging the Sheet moves it"). `resolveSlice(reading, { sheetHeight,
  datumMeters })` gives `cutY = datum + sheetHeight` and `lowerY = to-floor ? null :
  cutY − depth.meters`; a computed `lowerY ≤ datum` is normalised to `null`.

**Three depths, three meanings (Decided).** They share the word, not the type:

| Slice | Depth means | Values | Default | Consumer |
|---|---|---|---|---|
| SL1 Level | **Vertical** extent below the horizontal cut that stays shown | `to-floor` or `below: m > 0` | `to-floor` (Approved) | GPU lower plane; Plan `depthMeters` |
| SL2 Drawn | **Horizontal** inspection distance behind the vertical cut, measured along the visible-side normal, within the segment's extent | finite `depthMeters > 0` only | the distance to the far side of the Layout bounds at draw time, so the default shows everything behind | GPU predicate; depth ray |
| SL3 Section | **Projection** depth of the measured Section | **required** finite `> 0`, taken from the drawn Slice | — (inherits SL2's value) | `SectionParameters.depthMeters`; `outside-depth` membership |

- `to-floor` is **not a distance**: it means "no lower bound of the Slice's own". The GPU lower plane
  is a no-op and Plan keeps `PLAN_DEFAULT_DEPTH_METERS`, exactly as Plan reads without a Slice. The
  pill's depth menu shows it as **To the floor**. It never reaches SL2 or SL3: the type of a drawn arm
  has no `to-floor`.
- A Level `below` depth is a distance, so it travels with the cut while the Sheet moves (PLATE's
  "depth"). A drawn depth is a distance along a horizontal normal and never interacts with the Sheet.
- **Section requires finite depth** (layout.md); because a drawn arm can only hold a finite number,
  `sectionParametersOf` is total over drawn readings and does not exist for Level readings (Approved:
  Section and Face apply to a drawn Slice only).
- `sliceHides(resolved, x, y, z, eps = 1e-4): boolean` is **the single truth** for "is this point
  hidden by the Slice". Display (GPU planes), picking, ghost choice, cap trimming and tests all derive
  from `ResolvedSlice`; the GPU realization is replaceable behind §2.1 without touching consumers.
- `sliceHides` is defined over **hidden pieces**: `hiddenPiecesOf(resolved)` returns convex regions
  whose union is the hidden region and which are pairwise separated by visible space. Level: `above
  = {y > cutY}` and, when `lowerY !== null`, `below = {y < lowerY}`. Drawn (SL2): `extent ∩ nearSide`
  and `extent ∩ beyondDepth`. `sliceHides(p) = some piece contains p`. The ghost test (§2.4) uses the
  same pieces.
- `planOverridesOf(resolved)` maps a Level slice to Layout's existing `PlanParameterOverrides`:
  `depthMeters = lowerY === null ? PLAN_DEFAULT_DEPTH_METERS : cutY − lowerY`. The cut height is
  already the Sheet's (Verified 2), so Plan and the Slice can never disagree about the cut.
- SL3 adds `sectionParametersOf(resolved)` mapping a drawn slice to layout-core's new
  `SectionParameters` (§4). layout-core never imports a session type.

### 1.2 Ownership (Decided, within the Approved split)

| Concern | Owner | Where |
|---|---|---|
| Typed cut values, resolve, predicate, plan/section mapping | Stage host (session) | `authoring/stage/slice/slice-cut.ts` |
| The one live reading | Stage host (session) | `authoring/stage/slice/slice-reading.svelte.ts` |
| Cut / projected / hidden streams, membership, source refs | **Layout** | `layout.plan@1` (SL1, unchanged), `layout.section@1` (SL3, new) |
| Clip realization on materials | Stage host, via a T2 store option; **one instance per Stage Canvas** (§2.1) | `authoring/stage/slice/stage-clip.ts` + `material-store.ts` option |
| Cap / contour geometry | Stage host, from rendered meshes | `authoring/stage/slice/mesh-plane-section.ts` |
| Yellow plane, caps, ghost (ink) | Stage shell | `authoring/stage/shell/StageSliceLayer.svelte` |
| Face pose | **Camera** (A6 intent) | camera-core, unchanged |
| Pill, palette, Escape | Stage shell / route | `StageViewportRegion`, `StageDock`, `stage-keyboard.ts` |

Slice is a **host** tool like Measure and Eraser, because it cuts Layout *and* Scene content alike;
the *meaning* of a cut (what is cut, projected, hidden, and which source a primitive belongs to)
stays Layout's and is consumed, never re-derived. Capability id `layout.slice` (Approved).

### 1.3 Lifecycle (Decided)

- `sliceReading.set(reading)` replaces any live reading (one Slice at a time). `putBack()` and
  `clear()` (project replaced, route teardown, lens leaves World) end it.
- Survives: tool changes, selection, Plan ↔ 3D, Preview round trip, Lift on/off, Undo/Redo.
- Never: serialized, in history, passed to `VisitorPreviewSurface`, read by visitor/release code
  (the store is under `authoring/`, which the visitor boundary tests already exclude).
- Pill and reading activate together (PLATE): the pill shows iff a reading exists and Preview is not
  covering the Stage.

## 2. Display: clipping, caps, contours, visibility

### 2.1 Clipping realization — native planes through the Stage store (Decided)

**Plane values (Decided, from Verified 8: kept iff `n·p + c ≥ 0`).** To keep
`lowerY ≤ y ≤ cutY`:

| Plane | `normal` | `constant` | Kept | Discarded |
|---|---|---|---|---|
| Upper (cut) | `(0, −1, 0)` | `+cutY` | `y ≤ cutY` | `y > cutY` |
| Lower (depth) | `(0, +1, 0)` | `−lowerY` | `y ≥ lowerY` | `y < lowerY` |
| No-op (rest, or `lowerY === null`) | `(0, +1, 0)` | `+1e6` | `y ≥ −1e6` (everything) | nothing |

`stage-clip.ts` builds these only through one helper, `keepBelow(y)` / `keepAbove(y)` /
`keepAll()`, each documented with the kept inequality, and asserts at construction that
`keepBelow(0).distanceToPoint((0, −1, 0)) > 0` so a sign flip fails loudly in every lane. The
rendered fixture (test 14) proves the sign on a real GPU.

**Instance ownership and integration (Decided).**

- **Owner: `StageCanvas.svelte`.** It calls `createStageClip()` once in its script, *before*
  `provideRenderResources({ clippingPlanes: stageClip.planes })`, so the store is born with the
  array. Lifetime = the Stage Canvas. It publishes the instance through a Svelte context
  (`setStageClip` / `useStageClip`, in `stage-clip.ts`) for `StageSliceLayer`,
  `StageSelectionLayer`, `StageLiftLayer` and `StageSnapshotRenderer`. Nothing outside the Stage
  Canvas tree can reach it; the route never holds it.
- **The route owns the reading, not the planes.** It derives `resolvedSlice` once
  (`resolveSlice(sliceReading.reading, sheet)`) and passes the same value to `StageCanvas` (prop) and
  to the pick accessors (§2.5). `StageCanvas` applies it in one `$effect`:
  `stageClip.apply(resolvedSlice)` then `invalidate()`. GPU and CPU therefore always read one value.
- **Store integration.** `createMaterialStore(options?: { clippingPlanes?: Plane[] })`; when given,
  the store sets `material.clippingPlanes = options.clippingPlanes` — **the same array reference,
  never a copy** — on every colour material (standard, basic, lambert, imported) as the **last** step
  of construction, i.e. *after* `source.clone()` on the imported path (Verified 8: `clone()` copies
  planes into a new array). Descriptors with `clip: false` get `null`. Depth and distance kinds are
  untouched; `clipShadows` stays `false`. `provideRenderResources(options?)` forwards the option;
  Preview calls it as today.
- **No other clone.** Code outside the store must not `clone()` a store material (it would freeze a
  detached copy of the planes). Test 5 asserts reference identity for every kind; stop condition 7
  covers a consumer that clones.
- **Renderer.** `stageCanvasRenderer` (Verified 18) sets `renderer.localClippingEnabled = true` at
  creation, so the first Stage frame compiles with clipping and no frame ever recompiles for it.
  `previewCanvasRenderer` is untouched. Plane **count** is constant (2) for the Canvas's life, so
  entering, dragging and leaving a Slice **never recompiles a program** (Verified 8).
- **Ground exemption.** `BasicMaterialDescriptor` and `LambertMaterialDescriptor` gain an optional
  `clip?: false` (part of the canonical key; absent ≡ today's key). `WorldEnvironment`'s
  `FLAT_GROUND` and `LIT_GROUND` set it, so a finite depth never removes the world ground. Nothing
  else sets it in SL1.
- **Snapshots are as-built, exception-safe.** `renderStageSnapshot` gains an optional
  `asBuilt?: <T>(render: () => T) => T` seam; `StageSnapshotRenderer` passes `stageClip.asBuilt`
  from context. `asBuilt` is:

  ```ts
  asBuilt<T>(render: () => T): T {
    if (depth++ === 0) { saved = planes.map((p) => p.clone()); planes.forEach(keepAllInPlace); }
    try { return render(); }
    finally { if (--depth === 0) { planes.forEach((p, i) => p.copy(saved[i])); saved = null; } }
  }
  ```

  It mutates the shared `Plane` instances in place (never swaps the array, which every material
  holds by reference), is re-entrant, restores on throw and rethrows, and never calls
  `invalidate()` (the restored values are the ones already on screen; invalidating from inside a
  render would schedule a loop). `apply()` called during `asBuilt` (not expected: rendering is
  synchronous) updates `saved`, not the live planes, so the newest reading wins on exit. Overlay
  ink (plane, caps, ghost) is already outside the snapshot mask.
- **Lighting is unchanged — proven, not assumed.** Shadow maps ignore local clipping when
  `clipShadows` is false (Verified 8), so every caster above the cut still casts exactly as built,
  and the Slice never calls shadow invalidation. Light objects, light descriptors and the light store
  are never touched.

**Rejected alternatives.** Toggling `visible`/layers per mesh (cannot cut a mesh in half; changes
shadow eligibility — the X1 conflict); per-mesh `onBeforeRender` plane swaps (bypasses the store and
fights its sharing); a CSG or BVH boolean (out of scope, Approved); stencil-buffer clipping (stencil
is already spent on Paper and selection, Verified 10).

### 2.2 Caps — a plane section of what is actually drawn (Decided)

`mesh-plane-section.ts` (pure, typed arrays in, typed arrays out):

```ts
sectionMeshes(meshes: readonly SectionInput[], plane: { normal: Vec3; constant: number }, opts):
  { loops: SectionLoop[]; openChains: SectionChain[] }
// SectionInput: { identity: RenderIdentity; positions; index; matrixWorld; pickRanges? }
// SectionLoop / SectionChain: points in plane-local 2D + per-edge identity
```

- Inputs are the **rendered** meshes found by identity tag (Verified 11), exactly as
  `StageSelectionLayer` finds its contours: Walls (`'wall'`) and Layout objects. Openings need no
  input of their own: a cut through a door or window is a **gap** in its Wall's section, bounded by
  the jamb faces, which is "Openings are shown cut".
**Robust assembly (Decided).** Endpoint welding alone does not close contours: at a T Junction the
stem's side faces end at points that lie on (not at the ends of) the through-Wall's split face; at
X/Y Junctions keel faces meet several Walls; two coincident faces can run in opposite directions;
and overlapping-not-joined Walls (A5's "overlaps, not joined") cross each other. Per-Wall meshes are
open at their Junction ends by design (Verified 19). The assembly therefore works on the **group's
union**, not on per-mesh chains, in seven fixed steps:

1. **Groups.** One *structure* group for every Wall-owned mesh of the Layout (Walls, bridges, keels:
   together they are the closed solid the builder resolved), and one group per Layout object. Groups
   are assembled independently, so a plinth flush against a Wall never cancels the Wall's boundary.
2. **Section plane offset.** The section is taken at `cutY − 1e-4` m while the GPU clips at `cutY`.
   Sheet ticks snap to found surfaces (sills, heads, Wall tops), so a cut *exactly* on a horizontal
   face is the common case; the offset makes every triangle either straddle the plane or not, with no
   coplanar or vertex-on-plane degeneracy. (The 0.1 mm is invisible: the cap is drawn at `cutY`.)
3. **Oriented segments.** Each straddling triangle yields one segment, oriented so the solid is on
   its left seen from above (direction `planeNormal × triangleNormal`), tagged with its identity.
4. **Weld** endpoints in a spatial hash with tolerance `τ = 5e-5` m (half the offset).
5. **Split** every segment at every welded vertex lying within `τ` of its interior (T-vertices) and at
   every proper crossing with another segment of the same group.
6. **Net multiplicity.** Merge equal undirected edges, summing `+1` per segment in one direction and
   `−1` in the other. Net `0` (two coincident opposite faces) is dropped; net `±k` is kept with
   multiplicity.
7. **Union boundary and loops.** For each net edge compute the nonzero winding on its right by a
   horizontal probe ray against the group's net edges (bucketed by y-strip); winding on its left is
   right + net. Keep the edge iff exactly one side has winding `0`, oriented with the solid side on
   its left. Stitch kept edges into loops with Paper's rule (Verified 20: at a touching point turn
   clockwise from the way back). Counter-clockwise loops are outers, clockwise loops are holes, each
   hole owned by the smallest outer that contains it. The result is a set of simple,
   non-overlapping polygons with holes → `ShapeGeometry` (earcut-safe by construction).

**Validity is checked, not assumed.** Before step 7 every vertex must balance (net in = net out). A
closed input always balances after steps 4–6; an imbalance means the input was genuinely open.

- **Layout groups (Walls, Layout objects) must balance.** The test catalogue (test 3) covers every
  Junction kind and degenerate cut the builder produces; a failure there is a defect and an SL1 stop
  (stop condition 3), never a fallback. At runtime an imbalanced Layout group still draws its edges,
  **and** reports a `CapAssemblyIssue { group, identity, unmatchedVertices }` through a dev
  diagnostic (`console.error` once per group and geometry revision, plus a counter that QA reads
  through `window.__STAGE_SLICE_DIAGNOSTICS__` in dev builds). It is never silent and never throws.
- Nothing else is capped in SL1 (A-2), so no other input can degrade.

**Display.**

- **Fill:** the polygons from step 7 at `cutY`, opaque paper-tone ink, `polygonOffset` toward the
  camera. **Edge:** every loop as a `Line2`, Slice yellow `#f2d000`, 2 px; edges whose identity is
  the selected subject draw gold, 3 px. Identity per edge survives steps 5–7 (a split edge keeps its
  parent's identity; a kept edge whose net came from two identities takes the one on its solid side).
  (Approved: "yellow-edged cap"; X2 stubs are paper with an *ink* edge, so they stay distinct.)
- **Broad phase:** skip a mesh whose world bounds do not straddle the section plane.
- Scene models (`'model'`, artwork) are clipped by the planes but **not capped** in SL1 (see A-2).

**Why not the alternatives:** Paper's `cutWallBandsOf` bands disagree with the 3D miters at corners
(Verified 12); stencil caps need closed meshes, stencil bits that are already used and carry no
identity; analytic caps from compiled sections would be a second geometric derivation of the Wall
that drifts from the builder. Sectioning the built mesh is exact by construction and extends to any
future mesh (regions, roofs, gable tops) for free.

### 2.3 The yellow plane (Decided)

- While a Level slice exists and the reading is 3D: one translucent quad at `cutY`, spanning the
  Layout bounds plus 1 m, `#f2d000`, opacity 0.14, `DoubleSide`, `depthWrite: false`, overlay layer,
  `raycast = () => {}`, `renderOrder` below the caps. It **replaces** the neutral Sheet cue
  (Verified 14) while the Slice exists; the cue keeps its current behaviour otherwise.
- A finite depth adds the depth volume's floor: a dashed yellow rectangle outline at `lowerY`
  (no fill, so the band stays readable).
- In Plan the plane is not drawn: the Paper *is* the level cut (Verified 2), and depth narrows it.

### 2.4 Ghosts and selection ink (Decided)

- `StageSelectionLayer` and `StageLiftLayer` gain the same planes on their `LineMaterial`s
  (`clippingPlanes = stageClip.planes`), so a gold contour or a Lift outline above the cut is cut
  with its subject.
- **Wholly hidden — the test (Decided).** "Every vertex is hidden" is wrong: a column or Wall
  running from below `lowerY` to above `cutY` has all its vertices hidden (some above, some below)
  yet crosses the visible band. The test is defined on the hidden pieces of §1.1, which are convex
  and pairwise separated by visible space:

  > A **triangle** is wholly hidden iff **all three vertices lie in the same hidden piece**. A
  > **subject** is wholly hidden iff it has at least one drawable triangle and every drawable
  > triangle is wholly hidden.

  It is exact: a triangle is the convex hull of its vertices, so it lies inside a convex piece iff
  its vertices do; a triangle with vertices in two different pieces is connected, and the pieces are
  separated by visible space, so it crosses that space and is visible. The same rule holds for SL2's
  two pieces (`extent ∩ nearSide`, `extent ∩ beyondDepth`), which are separated by the visible slab.
  - *Drawable triangles* are those of the subject's meshes the Stage camera draws (layer 0, all
    ancestors `visible`), in world space. A lifted lid (layer 3) is not drawable; Lift's own ghost
    covers it.
  - Broad phase: if the subject's world AABB lies inside one piece, it is hidden (exact); if the AABB
    lies inside the visible band, it is visible (exact); otherwise run the triangle test.
  - **Conservative fallback** for geometry whose CPU positions do not match what is drawn (skinned,
    morph-targeted or instanced meshes): decide by the mesh's world AABB with the same rule, and when
    the AABB is in no single piece, treat the subject as **hidden** (draw the ghost). An unneeded
    ghost over a visible stub is cosmetic; a missing ghost leaves a selected subject invisible, which
    breaks the acceptance.
  - Cost: only the selected subject(s), on selection, reading, Sheet or geometry change.
- **Wholly hidden selected subject:** `StageSliceLayer` draws its meshes as a ghost — the rendered `BufferGeometry` by reference, one
  `MeshBasicMaterial` (hover neutral, opacity 0.18, `depthWrite: false`, no clipping), overlay layer,
  `raycast = () => {}` — and `StageSelectionLayer` draws that subject's gold contour **unclipped**.
  Handles and Instrument knobs are editor ink and stay where they are, so the subject is edited in
  place (Approved: "draw as a ghost when selected"; J12 step 3).
- A partly cut subject is not a ghost: its stub and cap are visible and pickable.
- The Index already selects any subject by id; nothing changes there.

### 2.5 Picking (Decided)

The selectable stream stays the existing `layout.plan@1` evaluation (Approved: one Layout
representation, no merging on selectable streams). While a Level slice exists:

1. **Plan parameters.** The route applies `planOverridesOf(resolved)` on every reading/Sheet change
   and restores `PLAN_DEFAULT_DEPTH_METERS` on Put back, so outside-depth membership and Reveal agree
   with what is drawn.
2. **Layout pick** (`plan-pick-provider.ts`) takes a `slice: () => ResolvedSlice | null` accessor:
   - Wall face surfaces are clamped to `[max(bottomY, lowerY), min(topY, cutY)]`; an empty band drops
     the surface.
   - A Wall fragment in the `cut` stream adds a flat **cap surface** at `cutY` from its plan band
     (`cutWallBandsOf`, Verified 12 — accurate enough for a hit test, never drawn).
   - Flat surfaces (objects, room floors) whose elevation `sliceHides` are dropped.
   - Opening ray hits and Lift outline hits whose world point `sliceHides` are dropped.
3. **Scene pick** (`scene-pick-source.ts`) takes an optional `hiddenAt(point) => boolean` and skips
   such hits, continuing to the next hit along the ray (Verified 5). Every consumer — selection,
   light placement and gestures, artwork placement, Layout's opening occlusion — therefore clicks
   *through* the removed part, as the eye does.
4. Hidden subjects are reachable only from the Index (Approved).

### 2.6 Extension boundary for X2 (Decided)

X2's cutaway (depends on X1 and SL1) must reuse `stage-clip.ts`, not add a second clipping path. If
X2 needs more planes than SL1's two, it raises the constant length once (one compile at load, never
at runtime). X2 stubs keep paper + ink edge; yellow stays Slice's.

## 3. Coexistence (Decided)

| With | Behaviour |
|---|---|
| Lift | Both readings live, both pills shown (Lift's first, as in X1). A lifted lid above the cut is clipped anyway; its outline is clipped (§2.4). |
| Unroll, A6 Face this wall | Unaffected: Unroll's sheet and Face are overlay/Camera; they are not clipped. |
| Plan ↔ 3D | Slice survives; in Plan only the pill and the depth narrowing apply. |
| Preview | Separate Canvas and store: as built. Pill hides while Preview covers; the reading survives. |
| Undo / Redo | Never touch the reading. An edit that changes geometry rebuilds caps (§6 budget). |
| Eraser, Measure, Ink | Use the same pick, so they never target a removed part. |
| Focus height | Under Focus the Sheet's plane becomes an outline (PLATE); the Slice plane follows that rule. |

## 4. SL3 — Section and Face (architecture fixed now; own plan, Tier 2)

**Decided.**

- **`layout.section@1`**, a new analytic evaluator in layout-core beside `layout.plan@1`:
  `evaluateLayoutSection(compiled, SectionParameters)` with `SectionParameters = { origin, along,
  normal, halfLength, depthMeters, datumMeters, sourceKindFilter, reveal }`, where `depthMeters`
  is the **projection depth**: required, finite, `> 0`, and always the drawn Slice's own
  `depthMeters` (§1.1); the evaluator refuses a non-finite or non-positive value rather than
  defaulting. It
  emits the same stream names (cut / projected / hidden / symbol), `PlanSourceRef`-shaped refs
  (`{sourceId, sourceKind, generationId, stream, subRef?}`) and reasoned membership, adding
  `outside-crop` for sources beyond the segment's extent (the code `layout.md` already lists). No
  merging on selectable streams; no section-local identity.
- **2D projection:** fragments are expressed in the section frame (`u` along, `v` = world height
  above datum), so every value is measured in metres: Wall cut regions from compiled `sections` /
  `solidSpans` intersected with the plane (straight Walls exactly; curved Walls at their compiled
  samples), Opening symbols at sill/head, projected Walls and objects behind within depth as
  silhouettes, Room floor/ceiling lines from `floorElevation` / `ceilingElevation`.
- **Correspondence:** a Section primitive's ref resolves to its canonical source through the same
  `semantic-selection.ts` path Plan uses; selecting in Section selects in the world.
- **Display:** Section is a reading on the one Camera, rendered as Paper-style ink in a dedicated
  frame; **Face** submits A6's `face` intent with `{ bounds: the slice extent × visible height,
  look: −normal }`; Put back restores A6's captured `ViewportCameraState`. No pose maths in Slice.
- **Not a sideways camera:** the Section is computed geometry, never an orthographic render of the
  3D scene.

**SL3 plan must settle** (not decided here): the Section frame's placement in the shell, its scale
and dimension marks, and whether `layout.section@1` shares a `layout-core` module with plan
evaluation or sits beside it.

## 5. SL2 — Drawn cut (bounded outline; own short plan, Tier 1)

**Decided.**

- Reading arm `{ kind: 'drawn', start, end, hidden, depthMeters }` in plan coordinates; `hidden` is
  the side toward the Camera when drawn (in Plan: the side the creator's view looked from, i.e. the
  segment's right as drawn — SL2 confirms in QA); **Flip** toggles it and keeps `depthMeters`.
- **Depth is horizontal and always finite** (§1.1): the visible slab runs from the cut plane
  `depthMeters` along the visible-side normal, within the segment's extent. Its default at draw time
  is the distance from the line to the far side of the Layout bounds on the visible side (so it shows
  everything behind); the depth ray edits it, clamped to `[0.1 m, that distance]`. It has no
  `to-floor` and never reads the Sheet. SL3 consumes this number unchanged.
- Drawing reuses the Wall draft gesture's 45° soft snap and length tag (the same helpers, not a copy);
  the draft is a cobalt proposal until release, then the reading replaces any live one.
- Grammar handles (Approved): end points redraw, the line moves, a depth ray sets depth. These are
  reading edits, not history entries.
- Caps: the same `mesh-plane-section` assembly (§2.2 steps 1–7) with a vertical plane offset 1e-4 m
  toward the visible side, then the polygons are intersected with the segment's extent in the
  plane's 2D frame. Picking: `sliceHides` for the drawn arm; Layout pick clamps through the same
  predicate. Ghosts: §2.4's rule with the two drawn pieces.

**SL2 spike — clipping (Assumption A-1).** The hidden region is *within the extent* **and** (*near
side* **or** *beyond depth*). three's native union / intersection groups cannot express
`E ∩ (N ∪ B)`. Expected realization: the Stage store, which constructs every colour material, adds one
`onBeforeCompile` chunk testing the drawn predicate from uniforms, with a constant
`customProgramCacheKey` so it compiles once. **Owner ruling: this spike is SL2's first
implementation gate.** The SL2 plan proves it, before any UI work, on the four colour kinds and the
imported kind with a rendered fixture extending test 14 (kept/discarded pixels, shadows unchanged,
stable program count); if it fails, SL2 stops. The predicate keeps the same sign discipline as §2.1:
it is written as "kept iff", and the fixture asserts both sides.

**SL2 acceptance gate:** implementation-prs.md SL2 rows, plus: no program recompile when drawing,
moving or flipping (renderer `info.programs` count stable), and shadows identical (test 3b-style).

## 6. Performance (Decided budgets; measured in QA)

- Plane moves: uniforms only, zero recompiles (Verified 8).
- **The cap rebuild never runs on a Sheet-drag frame.** The cut is a uniform update — the plane
  follows every frame for free — so a drag draws the plane and the section assembles once the Sheet
  rests (120 ms settle; a geometry or selection change assembles immediately). During the drag the
  section is removed rather than drawn stale under a moved plane. The rule is `decideCapAssembly`.
- Budget: ≤ 4 ms for the whole §2.2 assembly over 50 k candidate triangles. **Stop condition 9 has
  fired**: the eleven-Room fixture (44 Walls, 7,040 candidate triangles, all isolated — no T/X
  Junctions) measures ~29 ms best / ~32 ms median, and the profile is flat across the pass (split
  23 ms, triangle→segment 9.5 ms, winding 2 ms), so constant-factor work cannot reach 4 ms. At the
  measured linear rate 50 k triangles is ≈ 200 ms. **Owner-sanctioned resolution (2026-11-17):** keep
  the rebuild off the interaction frame and record the budget as unmet rather than fold the geometry
  rewrite into SL1; the bucketed T-vertex/crossing lookup remains the performance change's work. The
  measurement test prints the 50 k projection and holds a loose 120 ms regression ceiling.
- Broad phase by world bounds; welding, T-vertex and crossing splits through a uniform grid; winding
  probes bucketed by y-strip — no all-pairs pass. A dev-only timing log above the budget.
- Plane edits mutate the shared `Plane` instances in place; no material is touched per frame.
- No per-frame work when nothing changes (on-demand rendering preserved).
- At rest (no Slice) the two no-op planes cost one dot product per fragment per plane; QA checks frame
  time at rest is unchanged within noise.

## 7. Future compatibility (Decided)

- **Regions, slabs, roofs, gable tops (V1–V3).** They arrive as meshes → clipped by the store and
  capped by the mesh section; as Layout sources → they join plan/section candidates with their own
  `sourceKind`. Nothing in Slice is Wall-specific except the pick cap surface, which V-slices extend
  with their own band.
- **Curved Walls.** Tessellated in the built mesh (caps) and sampled in compiled geometry (pick,
  section).
- **Verticality / levels.** Elevations are world `datum + height`; a future level datum feeds
  `resolveSlice` and nothing else.
- **Lifted overhead casting (X1 trigger).** Unaffected: Slice never touches layers or `castShadow`.

## 8. Proven vs assumed

| Claim | Status | Evidence / validation |
|---|---|---|
| Shadows and lighting unchanged under clipping | Proven | r187 `WebGLClipping.setState`, `getDepthMaterial` (Verified 8); test 6 |
| No recompiles on enter / drag / exit | Proven | `numClippingPlanes` in program key, constant length (Verified 8); test 7 + QA |
| Preview and visitors untouched | Proven | separate store and Canvas (Verified 6); boundary tests |
| Plane signs keep `lowerY ≤ y ≤ cutY` | Proven from source; proven on GPU by test | r187 chunks (Verified 8); test 1b (CPU mirror), test 14 (rendered) |
| Snapshot as built, restored on throw | Proven by test | `asBuilt` seam, test 9 |
| Ghost iff wholly hidden, including band-crossing geometry | Proven (convexity argument §2.4) and by test | test 15 |
| Caps closed at every Junction kind and degenerate cut | Proven by test over the builder's output | §2.2 assembly; test 3 catalogue, zero issues required |
| **A-1** SL2 needs an injected predicate | Assumption — **owner: SL2's first implementation gate** | SL2 spike with a rendered fixture |
| **A-2** Scene models clipped without caps | **Accepted by owner** for SL1, subject to browser QA | QA 11; fallback is a back-face cap shader, its own PR |
| **A-3** Persistent yellow plane while editing | **Accepted provisionally** | QA 12; if readability fails, outline-only when the Slice tool is not armed (pre-approved fallback, no new ruling needed) |
| **A-4** Escape order `… selection → Lift → Slice` | **Accepted by owner** | test 12 |
| **A-5** Additive T2 store option and `clip: false` | **Accepted by owner**, no separate approval unless a genuine contract conflict emerges | stop condition 2 defines "genuine conflict" |

## 9. SL1 — detailed implementation plan

### Proposed new files

| File | Purpose |
|---|---|
| `apps/editor/src/lib/authoring/stage/slice/slice-cut.ts` | Types, `resolveSlice`, `sliceHides`, `planOverridesOf`, depth menu items |
| `apps/editor/src/lib/authoring/stage/slice/slice-reading.svelte.ts` | The one live reading (module singleton, like `interior-lift-store`) |
| `apps/editor/src/lib/authoring/stage/slice/stage-clip.ts` | `createStageClip()`: shared plane array, `keepBelow` / `keepAbove` / `keepAll`, `apply(resolved)`, `asBuilt`; `setStageClip` / `useStageClip` context |
| `apps/editor/src/lib/authoring/stage/slice/mesh-plane-section.ts` | Pure plane–mesh section and the §2.2 seven-step assembly, with `CapAssemblyIssue` |
| `apps/editor/src/lib/authoring/stage/slice/slice-ghost.ts` | Pure wholly-hidden classification (§2.4) |
| `apps/editor/src/lib/authoring/stage/shell/StageSliceLayer.svelte` | Yellow plane, depth outline, caps, ghost (editor ink) |
| `apps/editor/perf/regressions/stage-clip-entry.ts` | Browser-only rendered fixture for test 14 (pattern of `renderer-lifetime-entry.ts`) |
| `apps/editor/perf/flows/stage-clip.spec.ts` | Test 14, registered in `perf/playwright.config.ts` `testMatch` |

### Edited files

| File | Change |
|---|---|
| `render/resources/material-store.ts`, `render-resources.ts` | `clippingPlanes` option; skip `clip: false` |
| `render/resources/material-descriptor.ts` | optional `clip?: false` on basic / lambert, in the key |
| `render/WorldEnvironment.svelte` | ground descriptors `clip: false` |
| `render/canvas-renderers.ts` | `stageCanvasRenderer` sets `localClippingEnabled = true` |
| `authoring/stage/shell/StageCanvas.svelte` | own the `StageClip` instance, provide it by context and to the store option, apply `resolvedSlice`, mount `StageSliceLayer`, hide neutral cue under Slice |
| `authoring/stage/shell/StageSnapshotRenderer.svelte` | `asBuilt` seam from context |
| `authoring/stage/shell/StageSelectionLayer.svelte`, `StageLiftLayer.svelte` | clipping on contour/outline materials; unclipped contour for a ghosted subject |
| `authoring/layout/plan-pick-provider.ts` | `slice` accessor: clamp, cap surfaces, filters |
| `authoring/scene/scene-pick-source.ts` | optional `hiddenAt` filter |
| `authoring/stage/stage-contributions.ts`, `stage-input.ts` | Slice host dock key (slot `'slice'`, no shortcut, palette) |
| `authoring/stage/shell/StageDock.svelte` | palette anchor for any armed key with a palette; drop unavailable-slice CSS |
| `world-toolbar/registry.ts` | Slice tool aligned with PLATE: one mode, Level; no Axis/Offset |
| `authoring/stage/shell/StageDraftingControl.svelte` | remove the disabled `data-view-slice` button |
| `authoring/stage/shell/StageViewportRegion.svelte` | Slice pill |
| `authoring/stage/route/stage-keyboard.ts` | `sliceActive` / `putBackSlice` rung |
| `routes/project/[projectId]/spatial/+page.svelte` | wiring: reading → clip, plan overrides, pill, keyboard, clear on replace/teardown |
| `tests/lib/render/material-factory-boundary.test.ts` | `StageSliceLayer.svelte` allowlist entry |
| `docs/reference/components/rendering.md` | one paragraph: Stage clip seam, `clipShadows = false` contract, X2 reuse |

### Ordered steps

1. **Pure core.** `slice-cut.ts` (types, hidden pieces, `sliceHides`, depth items) and
   `slice-ghost.ts`; tests 1, 2, 15. No UI.
2. **Mesh section.** `mesh-plane-section.ts` with the §2.2 assembly; tests 3–4 over real builder
   output. **Gate:** the whole test 3 catalogue assembles with zero `CapAssemblyIssue`s before any
   rendering work starts (else stop condition 3).
3. **Clip seam.** `stage-clip.ts` (sign helpers, `apply`, re-entrant `asBuilt`, context), store
   option + descriptor flag + ground exemption, `stageCanvasRenderer` clipping flag; tests 1b, 5–7, 9.
   Then the rendered fixture, test 14, run locally against real WebGL. **Gate:** test 14 green before
   step 5 (else stop condition 8). Wire `StageCanvas` (instance, context, store option) with planes
   still no-op. **Checkpoint:** the Stage at rest is unchanged (QA 1).
4. **Reading + dock.** `slice-reading.svelte.ts`; Slice host key replaces `unavailable-slice`;
   palette with the single item **Level** (checked); arming Slice with no reading creates
   `{ kind: 'level', depth: to-floor }` at once; choosing Level again replaces it. Remove the
   toolbar Axis/Offset stub and the drafting-control button. A press on the Stage with Slice armed
   refuses with **"Drag the Height Sheet to move the cut"** and changes nothing.
5. **Render.** Route derives `resolvedSlice` with the Sheet (`subscribe('slice', …)`) and passes it to
   `StageCanvas`, whose effect calls `stageClip.apply` + `invalidate`. `StageSliceLayer`: plane,
   depth outline, caps (rAF-coalesced), ghost (via `slice-ghost.ts`), dev diagnostics.
6. **Pick.** `planOverridesOf` into `setPlanParameters`; `plan-pick-provider` slice accessor;
   `scene-pick-source` filter; tests 8, 10.
7. **Selection/Lift ink clipping and ghost contour.** Test 11.
8. **Pill.** `.mode-pill slice-pill` (`data-slice-pill`) in the existing pill component:
   **Cut at {h} m** (two decimals, live with the Sheet) · **depth ▾** (`data-slice-depth`) ·
   **Put back** (`.pill-primary`, `data-slice-put-back`). Depth menu: **To the floor** (default) and
   each Sheet tick strictly below the cut and above the datum (Levels, found surfaces, pins), labelled
   as the Sheet labels them; choosing one sets `distance = cut − tick`; the current item is checked.
   After Lift's pill in the same row. Click/pointerdown stop propagation.
9. **Escape.** Add `sliceActive()` / `putBackSlice()`; the rung follows Lift:
   `… selection → Lift → Slice`. Every earlier rung (gesture, palette collapse, tool → Select) wins,
   so Escape returns the creator to Select with the cut kept, then exits it (A-4).
10. **Snapshot seam, lifecycle clears** (project replaced, teardown, lens leaves World), docs line.
11. Focused browser QA, then the full editor test lane per `apps/editor/tests/README.md`.

### Tests

1. `slice-cut.test.ts` — resolve (datum offset, to-floor, below, `lowerY ≤ datum` → null), hidden
   pieces, `sliceHides` boundaries with eps (band inclusive), `planOverridesOf` (to-floor →
   `PLAN_DEFAULT_DEPTH_METERS`), depth items exclude ticks at/above the cut; a drawn arm cannot be
   typed with `to-floor` (type test).
   - **1b. Sign mirror.** Reads r187's `clipping_planes_vertex` / `clipping_planes_fragment` chunk
     text and asserts `vClipPosition = - mvPosition.xyz` and
     `dot( vClipPosition, plane.xyz ) > plane.w` are present (a three upgrade that changes the rule
     fails here). Then, for `stage-clip`'s planes after `apply({ cutY: 1.2, lowerY: 0.5 })`, evaluates
     the same expression on CPU in view space (`projectPlanes` math with a non-identity camera) for
     points at y = 0.49, 0.5, 1.2, 1.21 and asserts discarded / kept / kept / discarded; and kept for
     every y under `keepAll`.
2. `slice-reading.test.ts` — set replaces, putBack/clear, no history participant, never serialized
   (store absent from project serialization fixtures).
3. `mesh-plane-section.test.ts` — **catalogue over real builder output**, each asserting **zero**
   `CapAssemblyIssue`s, simple non-overlapping output polygons, and area equal to the expected
   analytic area within 1e-6 m²:
   box Wall → one rectangle; closed ring Room → one outer + one hole; L miter and bevel (with bridge);
   T Junction (stem side endpoints on the through face interior); X and Y Junctions with keels;
   straight-to-curved continuation; curved Wall → loop on the tessellation; door at a Junction; door
   gap mid-Wall → gap in the loop; arch cut through its head; cut **exactly** at a sill, a head and a
   Wall top (offset rule); two **overlapping, not joined** Walls (crossing loops → one union);
   duplicated coincident Wall (same direction, net 2) and two coincident opposite faces (net 0);
   a plinth flush against a Wall (separate groups, both boundaries kept). Plus a deliberately open
   mesh → edges drawn, one `CapAssemblyIssue`, no throw.
4. Identity: every output edge carries its source identity through split and merge; the selected
   identity's edges are isolated for gold.
5. `material-store` — option assigns **the same array reference** to every colour kind including
   `imported` (after `clone()`); `clip: false` gets `null` and keys separately; depth/distance kinds
   untouched; no option → `clippingPlanes` null (Preview path unchanged).
6. **Shadow contract** — fixture as X1 test 3b (two Rooms, Directional + Spot via the light store):
   with a Slice on, every material has `clipShadows === false`; the light store and every
   `castShadow` / `receiveShadow` / layer is identical before, during and after. Reads r187
   `WebGLClipping.js` and asserts the `renderingShadows && !clipShadows` rule text is present.
7. **No recompile** — plane array length is 2 at rest and under any reading; `apply` and `asBuilt`
   mutate the same `Plane` instances and never replace the array.
8. `plan-pick-provider` — clamped faces, cap surface hit at `cutY`, hidden flats and openings dropped,
   depth band respected, no change without a slice.
9. `asBuilt` — planes are no-ops inside the callback and restored after it; restored and rethrown
   when the callback throws; nested calls restore only at the outermost; return value passes
   through; `apply` during `asBuilt` wins on exit; no `invalidate` is called. `renderStageSnapshot`
   with a Slice on calls the seam.
10. `scene-pick-source` — `hiddenAt` skips to the next hit; absent filter behaves as today.
11. Selection layer — clipped contour normally; unclipped for a wholly hidden selected subject.
12. Keyboard — ladder order with palette, tool, selection, Lift and Slice combinations.
13. Boundary suites unchanged and green: visitor/public/preview surface, material factory (new entry).
14. **Rendered regression (real WebGL)** — `perf/flows/stage-clip.spec.ts` + its entry, built like
    `renderer-lifetime` (Verified 20), using the real `createMaterialStore` with a `createStageClip`
    instance and a real `stageCanvasRenderer`-equivalent renderer (`localClippingEnabled`). An
    orthographic side camera looks at a column of horizontal colour bands (one per 0.25 m, from
    −0.5 to 3 m) made with a standard, a lambert, a basic and an imported-clone material, plus the
    `clip: false` ground. Assertions by pixel row:
    - rest: every band drawn, and pixels identical to the same scene with no clip option;
    - `cutY = 1.2`, to-floor: bands above 1.2 absent, all below present, ground present;
    - `cutY = 1.2, lowerY = 0.5`: only the band rows within `[0.5, 1.2]` present; ground present;
    - shadows: a `DirectionalLight` with a shadow map and a caster box spanning 1.0–2.5 m over a
      receiver plane; the receiver's shadow pixels are identical with the Slice on and off;
    - `renderer.info.programs.length` is unchanged across rest → slice → move → put back;
    - `asBuilt(render)` under a Slice yields the rest image.
    Run locally with the perf Playwright config; the output is attached to the PR. It is not a CI job
    (the harness is owner-run, Verified 20); **the owner's review required it**, which is the
    authorization for this one focused fixture.
15. `slice-ghost.test.ts` — a Wall spanning `lowerY − 1` to `cutY + 1` with vertices only at its
    ends is **visible**; a ceiling light above `cutY` is hidden; an object straddling `cutY` is
    visible; an object wholly below `lowerY` is hidden; a triangle with one vertex above and two
    below is visible; AABB fast paths agree with the triangle test; a skinned mesh uses the AABB
    fallback and errs toward hidden; a subject with no drawable triangle is not ghosted.

### Browser QA (focused, not a full capture)

1. No Slice: Stage pixels and frame time at rest look unchanged; Preview unchanged.
2. Arm Slice → yellow plane at 1.20 m; walls capped with yellow edges; ceilings gone; door and window
   read as gaps; pill reads **Cut at 1.20 m · depth ▾ · Put back**.
3. Drag the Sheet: plane, caps and pill follow and snap to ticks; no stutter on an 11-Room fixture.
4. Depth ▾ → a pin or found surface: content below disappears, ground stays, outline at the bound.
5. Select tool: move a plinth, edit a Wall below the cut; cap follows the edit; one history entry.
6. Index → a ceiling-mounted light or an object above the cut: ghost + gold contour, handles work.
7. Clicks go through removed parts to what is visible behind (light placement on a far wall).
8. Lighting: sun and spots throw the same shadows with and without the Slice (toggle and compare).
9. Escape ladder; Put back; Plan ↔ 3D; Preview round trip; Lift together with Slice.
10. A thumbnail/snapshot taken during the Slice is as built.
11. (A-2) A Scene model crossing the cut: clipped, uncapped; judge legibility and report.
12. (A-3) Edit for a minute below the persistent yellow plane; if it washes out the work, apply the
    pre-approved outline-only fallback and record it on the PR.
13. Cut exactly at a sill, a head and a Wall top (Sheet ticks): caps closed, no flicker; dev
    diagnostics counter reads 0 across the 11-Room fixture and the Junction-heavy fixture.

### Acceptance (implementation-prs.md SL1, with checks)

| Acceptance | Check |
|---|---|
| Plane appears at the Sheet height | QA 2 |
| Dragging moves it and snaps | QA 3 |
| Nothing above is drawn | QA 2; tests 1b, 5, 7, **14** |
| Cut Walls and Openings show a cap | QA 2, 13; tests 3–4 |
| Everything below stays selectable and editable | QA 5, 7; tests 8, 10 |
| An Index-chosen hidden subject draws as a ghost | QA 6; tests 11, 15 |
| Put back and Escape remove the cut | QA 9; test 12 |
| Lighting is unchanged | QA 8; tests 6, **14** |
| Session only; never in Preview, snapshot, release | QA 9–10; tests 2, 9, 13 |

### Refusals (with words)

- Slice armed, press on the Stage: **Drag the Height Sheet to move the cut.**
- Depth item that would not be below the cut is never offered (no disabled items).
- Nothing else in SL1 refuses: a cut through nothing is a valid empty reading.

### Risks

- **T2 churn on `material-store.ts` / descriptors** (T2 work is in flight): the edit is small and
  additive; rebase on conflict, never reshape T2's API.
- **Cap cost:** the robust assembly costs more than chaining; budget, grid and coalescing §6, stop
  condition 9.
- **A Junction shape outside the test 3 catalogue** (a future builder case) could still produce an
  open group: it is reported loudly (§2.2), never silent, and becomes a catalogue case.
- **Gold on yellow edge contrast** for a selected Wall's cap: QA 6; gold width 3 px over 2 px yellow.
- **The rendered fixture is owner-run, not CI:** test 1b guards the sign in every lane; test 14 is
  re-run by any PR that touches `stage-clip.ts`, the store option or a three upgrade.

### Stop conditions

Stop and report (do not work around) if:

1. three's clipping does not behave as Verified 8 in the Stage (shadows change, or programs recompile
   on plane moves).
2. A **genuine T2 contract conflict**: the store option or `clip: false` would change an existing
   descriptor key, a material T2 constructs, Preview, or a T2 test's expectations; or the ground
   exemption needs more than `clip: false` on two descriptors. (Merge conflicts with in-flight T2
   work are not a conflict: rebase.)
3. Any test 3 catalogue case leaves a `CapAssemblyIssue` or a wrong area, or closing it would require
   changing the Wall builder.
4. The Height Sheet knob is not usable while Slice is armed, or `setPlanParameters` depth does not
   flow into Layout membership.
5. Any requirement would need persistence, history, a format change, a new dock slot, shortcut or
   pill component, or a change visible in Preview.
6. The work starts needing SL2/SL3 code (drawn cuts, section evaluation).
7. Any code outside the material store clones a store material, or serializes one (`toJSON`,
   exporters): the shared plane reference would be lost or leaked.
8. Test 14 contradicts §2.1 (a sign, the ground, shadows, program count or `asBuilt`), or cannot run
   on the local GPU stack.
9. The §2.2 assembly exceeds 2× its budget on the 11-Room fixture.

## Implementation handoff prompt

> Implement T1 SL1 Level cut (`layout.slice`) on branch `t1/sl1-level-cut` following
> `docs/roadmap/t1-spatial-world/next-batch/sl-plan-slice.md` §9 in order. Treat Verified facts as
> current; re-check each against the code when you touch it and stop on any stop condition. Do not
> implement SL2 or SL3. Commit per step with `feat(layout.slice): …` / `test(layout.slice): …`
> messages and no agent footer. Run focused tests per step and the full editor lane before asking for
> review; run the rendered fixture (test 14) locally with the perf Playwright config, do focused
> browser QA §9 items 1–13 and attach evidence to the PR. Revision 2 of the plan is authoritative:
> plane signs §2.1, cap assembly §2.2, ghost rule §2.4, depth semantics §1.1.

## Revision log

**Rev 3 — implementation review on #362 (2026-11-17).** Accepted findings and the one recorded
deviation:

1. *Accepted.* The reading was never cleared: `sliceReading.clear()` now runs with Lift at route
   teardown and on a replaced project, and a lens effect ends it (with the pick mirror) when the lens
   leaves World. Lifecycle text in §1.3 is now enforced by `slice-lifecycle.test.ts`.
2. *Accepted.* The §9 refusal was missing: a Stage press while Slice is armed now refuses the press
   and says **Drag the Height Sheet to move the cut.** in the shell's notice.
3. *Accepted.* The section could be lost or stale: the effect returned a cleanup, which Svelte runs
   before every re-run, and `assembled` was recorded before the assembly ran. `assembled` is now
   written only by `rebuild()`, the effect returns no cleanup, and timers are cancelled on destroy or
   when a newer schedule replaces them.
4. *Accepted.* The drag frame still assembled when the ghost's classification flipped, and a ghost
   was removed for the length of a drag. The ghost is out of the section key, drawn in its own group,
   redrawn only when the classification changes, and its world bake is cached against the selection
   and geometry.
5. *Recorded deviation, now closed.* Ink had drifted from §2.2: the plane is back to **#f2d000 at
   0.14**, and section edges are `Line2` — 2 px yellow, with a selected identity's edges 3 px gold
   from the shared selection tone (test 4 is now drawn, not only computed).
6. *Accepted.* Cap sources exclude **Wall failure surfaces** (a fallback body must not read as a
   resolved Wall), and the ghost's conservative fallback covers subjects made only of skinned or
   instanced meshes through their world bounds.
7. *Accepted.* Evidence claims were narrowed: the rendered fixture proves the cap's geometry sits at
   `cutY` and that the cap is drawn, not that the shipped pick surface was exercised (the provider's
   `cutWallBandsOf` surface is unit-tested); the ink fixture's ray is described as such.
8. *Accepted.* §6's schedule and budget status now match the code, and the stale `rendering.md`
   paragraph (one plane, offset folded in, empty array for snapshots) was rewritten to the two-plane,
   parks-in-place seam.

**Rev 2 — peer review on #362 (2026-11-16).** Findings independently verified against three r187
source and the builder:

1. *Accepted.* Clipping signs were reversed (`n·p + c < 0` is discarded). §2.1 now gives the
   kept-inequality table, sign helpers, a CPU sign mirror (1b) and a real-WebGL fixture (14).
2. *Accepted.* "Every vertex hidden" misclassified band-crossing geometry. §2.4 defines the exact
   same-convex-piece rule, with a conservative AABB fallback that errs toward drawing the ghost.
3. *Accepted.* Welding alone cannot close T/X Junctions, coincident or overlapping boundaries.
   §2.2 specifies groups, a section offset for on-plane cuts, T-vertex and crossing splits, net
   multiplicity, nonzero-winding union and Paper's stitching rule; Layout groups must balance and
   an imbalance is loud.
4. *Accepted.* The `StageClip` instance is owned by `StageCanvas`, shared by context, given to the
   store by reference after any clone, enabled in the Stage renderer factory, with a re-entrant,
   exception-safe `asBuilt`.
5. *Accepted.* SL1's `to-floor` (no lower bound; vertical), SL2's finite horizontal inspection depth
   and SL3's required finite projection depth are now distinct types and rules.

Owner rulings recorded in §8: A-2, A-3 (provisional), A-4, A-5 accepted; A-1 is SL2's first gate.
