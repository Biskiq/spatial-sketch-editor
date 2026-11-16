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
8. **three r187 clipping.** `material.clippingPlanes` needs `renderer.localClippingEnabled`. The
   fragment chunk discards where `dot(vClipPosition, plane.xyz) > plane.w` (union; optional
   intersection group via `clipIntersection`). `numClippingPlanes` is part of the program key, so a
   plane-*count* change recompiles; a plane-*value* change is a uniform update. In
   `WebGLClipping.setState`, `renderingShadows && !clipShadows` applies **no** local clipping, and
   `getDepthMaterial` copies `clipShadows` onto the shadow depth material. **So with
   `clipShadows = false` (default) every shadow map is rendered from the unclipped world.**
   `LineMaterial` supports clipping.
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

## 1. The typed cut — one contract for three slices

### 1.1 Representation (Decided)

```ts
// authoring/stage/slice/slice-cut.ts  (pure, editor-only, no Svelte, no three)
export type SliceDepth = { readonly kind: 'to-floor' } | { readonly kind: 'distance'; readonly meters: number };

export type SliceReading =
  | { readonly kind: 'level'; readonly depth: SliceDepth }
  // SL2 adds, without changing the level arm:
  // | { kind: 'drawn'; start: Vec2; end: Vec2; hidden: 'left' | 'right'; depth: SliceDepth }
  ;

/** A reading resolved against live view state, in world metres. The only input to every consumer. */
export type ResolvedSlice =
  | { readonly kind: 'level'; readonly cutY: number; readonly lowerY: number | null };
  // SL2: | { kind: 'drawn'; origin; along; normal (toward the hidden side); halfLength; depthMeters; cutY: null }
```

- A **Level** reading stores no elevation. Its elevation *is* the Height Sheet (Approved: "the plane
  appears at the Sheet height; dragging the Sheet moves it"). `resolveSlice(reading, { sheetHeight,
  datumMeters })` gives `cutY = datum + sheetHeight`, `lowerY = depth.kind === 'to-floor' ? null :
  cutY − depth.meters`. A `lowerY ≤ datum` is normalised to `null`.
- **Depth is a distance**, so it travels with the cut when the Sheet moves. That is what "depth"
  means in PLATE and the pill, and it is the same field SL2's depth ray drives.
- `sliceHides(resolved, x, y, z, eps = 1e-4): boolean` is **the single truth** for "is this point
  hidden by the Slice". Display (GPU planes), picking, ghost choice, cap trimming and tests all derive
  from `ResolvedSlice`; the GPU realization is replaceable behind §2.1 without touching consumers.
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
| Clip realization on materials | Stage host, via a T2 store option | `authoring/stage/slice/stage-clip.ts` + `material-store.ts` option |
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

- `createMaterialStore(options?: { clippingPlanes?: readonly Plane[] })`. When given, the store
  assigns that **one shared array** to `material.clippingPlanes` on every colour material it
  constructs (standard, basic, lambert, imported), except a descriptor marked `clip: false`. Depth and
  distance kinds are untouched. `clipShadows` stays `false`. `provideRenderResources(options?)`
  forwards the option. **Only `StageCanvas` passes it**; Preview's Canvas calls it as today.
- `stage-clip.ts` owns that array: **constant length 2** (SL1), each plane a no-op at rest
  (`normal (0, 1, 0)`, `constant = 1e9`). `setLevel(cutY, lowerY)` writes values only:
  upper `normal (0, 1, 0), constant = −cutY` (discards `y > cutY`), lower `normal (0, −1, 0),
  constant = lowerY` (discards `y < lowerY`), or no-op when `lowerY === null`. `setNone()` restores
  no-ops. Every change calls `invalidate()`.
- `StageCanvas` sets `renderer.localClippingEnabled = true` once at mount. Plane **count** never
  changes at runtime, so entering, dragging and leaving a Slice **never recompiles a program**
  (Verified 8); only uniforms change.
- **Ground exemption.** `BasicMaterialDescriptor` and `LambertMaterialDescriptor` gain an optional
  `clip?: false` (part of the canonical key; absent ≡ today's key). `WorldEnvironment`'s
  `FLAT_GROUND` and `LIT_GROUND` set it, so a finite depth never removes the world ground. Nothing
  else sets it in SL1.
- **Snapshots are as-built.** `renderStageSnapshot` gains an optional `asBuilt?: <T>(render: () => T) => T`
  seam that the Stage passes as `stageClip.asBuilt`, which swaps the planes to no-ops around the
  render and restores them. Overlay ink (plane, caps, ghost) is already outside the snapshot mask.
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
- Broad phase: skip a mesh whose world bounds do not straddle the plane. Triangle–plane intersection
  emits segments; endpoints are welded on a 1e-4 m grid; segments are chained **across all Walls at
  once**, so a Junction whose per-Wall meshes are open at the interface still closes into one poché
  loop that matches the 3D miter exactly. Curved Walls, arches and pointed heads are already
  tessellated, so they need nothing special.
- **Fill:** closed loops → `ShapeGeometry` (outer + holes by signed area and containment) at the cut
  plane, opaque paper-tone ink, `polygonOffset` toward the camera. **Edge:** every loop and chain as
  a `Line2`, Slice yellow `#f2d000`, 2 px; the selected subject's edges draw gold, 3 px.
  (Approved: "yellow-edged cap"; X2 stubs are paper with an *ink* edge, so they stay distinct.)
- **Open chains** (a mesh that is not closed): edge only, no fill, one `console.warn` in dev naming the
  identity. Never throw.
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
- **Wholly hidden selected subject** (every vertex of its rendered meshes satisfies `sliceHides`):
  `StageSliceLayer` draws its meshes as a ghost — the rendered `BufferGeometry` by reference, one
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
  normal, halfLength, depthMeters (required, finite), datumMeters, sourceKindFilter, reveal }`. It
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

- Reading arm `{ kind: 'drawn', start, end, hidden, depth }` in plan coordinates; `hidden` is the
  side toward the Camera when drawn (in Plan: the side the creator's view looked from, i.e. the
  segment's right as drawn — SL2 confirms in QA); **Flip** toggles it.
- Drawing reuses the Wall draft gesture's 45° soft snap and length tag (the same helpers, not a copy);
  the draft is a cobalt proposal until release, then the reading replaces any live one.
- Grammar handles (Approved): end points redraw, the line moves, a depth ray sets depth. These are
  reading edits, not history entries.
- Caps: the same `mesh-plane-section` with a vertical plane, then trimmed to the segment's extent in
  2D. Picking: `sliceHides` for the drawn arm; Layout pick clamps through the same predicate.

**SL2 spike — clipping (Assumption A-1).** The hidden region is *within the extent* **and** (*near
side* **or** *beyond depth*). three's native union / intersection groups cannot express
`E ∩ (N ∪ B)`. Expected realization: the Stage store, which constructs every colour material, adds one
`onBeforeCompile` chunk testing the drawn predicate from uniforms, with a constant
`customProgramCacheKey` so it compiles once. The SL2 plan proves it on the four material kinds and
the imported kind before any UI work; if it fails, SL2 stops.

**SL2 acceptance gate:** implementation-prs.md SL2 rows, plus: no program recompile when drawing,
moving or flipping (renderer `info.programs` count stable), and shadows identical (test 3b-style).

## 6. Performance (Decided budgets; measured in QA)

- Plane moves: uniforms only, zero recompiles (Verified 8).
- Cap rebuild runs on reading, Sheet height or geometry revision change, **coalesced to one per
  animation frame** during a Sheet drag. Budget: ≤ 4 ms for 50 k candidate triangles (an 11-Room
  exhibition is well under that); a dev-only timing log above budget. Broad phase by world bounds.
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
| Snapshot as built | Proven by test | `asBuilt` seam, test 9 |
| Caps exact at Junctions and curves | Proven by test | global chaining over built meshes; tests 3–4 |
| **A-1** SL2 needs an injected predicate | Assumption | SL2 spike, first step of SL2 |
| **A-2** Scene models clipped without caps read well enough | Assumption | owner QA in SL1; fallback is a back-face cap shader, its own PR |
| **A-3** The yellow plane stays readable while editing below it | Assumption | owner QA; fallback: plane drawn only while the Slice tool is armed, outline otherwise |
| **A-4** Escape order (§9 step 9) | Assumption against PLATE's literal ladder | owner review on this PR |
| **A-5** `clip: false` on two T2 descriptors is additive only | Assumption | T2 owner notified on the PR; no approval gate unless T2 objects |

## 9. SL1 — detailed implementation plan

### Proposed new files

| File | Purpose |
|---|---|
| `apps/editor/src/lib/authoring/stage/slice/slice-cut.ts` | Types, `resolveSlice`, `sliceHides`, `planOverridesOf`, depth menu items |
| `apps/editor/src/lib/authoring/stage/slice/slice-reading.svelte.ts` | The one live reading (module singleton, like `interior-lift-store`) |
| `apps/editor/src/lib/authoring/stage/slice/stage-clip.ts` | Shared plane array, `setLevel` / `setNone` / `asBuilt` |
| `apps/editor/src/lib/authoring/stage/slice/mesh-plane-section.ts` | Pure plane–mesh section with global chaining and loop fill input |
| `apps/editor/src/lib/authoring/stage/shell/StageSliceLayer.svelte` | Yellow plane, depth outline, caps, ghost (editor ink) |

### Edited files

| File | Change |
|---|---|
| `render/resources/material-store.ts`, `render-resources.ts` | `clippingPlanes` option; skip `clip: false` |
| `render/resources/material-descriptor.ts` | optional `clip?: false` on basic / lambert, in the key |
| `render/WorldEnvironment.svelte` | ground descriptors `clip: false` |
| `authoring/stage/shell/StageCanvas.svelte` | provide clip option, `localClippingEnabled`, mount `StageSliceLayer`, hide neutral cue under Slice, pass `asBuilt` |
| `authoring/stage/shell/StageSnapshotRenderer.svelte` | `asBuilt` seam |
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

1. **Pure core.** `slice-cut.ts` with tests 1–2. No UI.
2. **Mesh section.** `mesh-plane-section.ts` with tests 3–4 over real `IndexedWallMesh` output
   (straight, L-corner, T-junction, curved, arched opening, door gap).
3. **Clip seam.** Store option + descriptor flag + `stage-clip.ts` + ground exemption; tests 5–7.
   Wire `StageCanvas` (option, `localClippingEnabled`) with planes still no-op. **Checkpoint:** the
   Stage at rest is unchanged (QA 1).
4. **Reading + dock.** `slice-reading.svelte.ts`; Slice host key replaces `unavailable-slice`;
   palette with the single item **Level** (checked); arming Slice with no reading creates
   `{ kind: 'level', depth: to-floor }` at once; choosing Level again replaces it. Remove the
   toolbar Axis/Offset stub and the drafting-control button. A press on the Stage with Slice armed
   refuses with **"Drag the Height Sheet to move the cut"** and changes nothing.
5. **Render.** Route resolves the reading with the Sheet (`subscribe('slice', …)`) → `stageClip.setLevel`
   + `invalidate`. `StageSliceLayer`: plane, depth outline, caps (rAF-coalesced), ghost.
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

1. `slice-cut.test.ts` — resolve (datum offset, to-floor, distance, `lowerY ≤ datum` → null),
   `sliceHides` boundaries with eps, `planOverridesOf`, depth items exclude ticks at/above the cut.
2. `slice-reading.test.ts` — set replaces, putBack/clear, no history participant, never serialized
   (store absent from project serialization fixtures).
3. `mesh-plane-section.test.ts` — box Wall → one rectangle loop; L and T Junctions → one merged loop
   whose vertices equal the built miter; curved Wall → loop on the tessellation; door gap → two loops;
   arch cut through its head → loop with the arch's chord; open mesh → chain, no throw.
4. Identity: every output edge carries its source identity; selected identity edges isolated.
5. `material-store` — option assigns the shared array to colour kinds only; `clip: false` skips and
   keys separately; no option → `clippingPlanes` empty (Preview path unchanged).
6. **Shadow contract** — fixture as X1 test 3b (two Rooms, Directional + Spot via the light store):
   with a Slice on, every material has `clipShadows === false`; the light store and every
   `castShadow` / `receiveShadow` / layer is identical before, during and after. Reads r187
   `WebGLClipping.js` and asserts the `renderingShadows && !clipShadows` rule text is present.
7. **No recompile** — plane array length is 2 at rest and under any reading; `setLevel` mutates the
   same `Plane` instances.
8. `plan-pick-provider` — clamped faces, cap surface hit at `cutY`, hidden flats and openings dropped,
   depth band respected, no change without a slice.
9. Snapshot — `renderStageSnapshot` with a Slice on renders with no-op planes and restores them.
10. `scene-pick-source` — `hiddenAt` skips to the next hit; absent filter behaves as today.
11. Selection layer — clipped contour normally; unclipped for a wholly hidden selected subject.
12. Keyboard — ladder order with palette, tool, selection, Lift and Slice combinations.
13. Boundary suites unchanged and green: visitor/public/preview surface, material factory (new entry).

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

### Acceptance (implementation-prs.md SL1, with checks)

| Acceptance | Check |
|---|---|
| Plane appears at the Sheet height | QA 2 |
| Dragging moves it and snaps | QA 3 |
| Nothing above is drawn | QA 2; tests 5, 7 |
| Cut Walls and Openings show a cap | QA 2; tests 3–4 |
| Everything below stays selectable and editable | QA 5, 7; tests 8, 10 |
| An Index-chosen hidden subject draws as a ghost | QA 6; test 11 |
| Put back and Escape remove the cut | QA 9; test 12 |
| Lighting is unchanged | QA 8; test 6 |
| Session only; never in Preview, snapshot, release | QA 9–10; tests 2, 9, 13 |

### Refusals (with words)

- Slice armed, press on the Stage: **Drag the Height Sheet to move the cut.**
- Depth item that would not be below the cut is never offered (no disabled items).
- Nothing else in SL1 refuses: a cut through nothing is a valid empty reading.

### Risks

- **T2 churn on `material-store.ts` / descriptors** (T2 work is in flight): the edit is small and
  additive; rebase on conflict, never reshape T2's API.
- **Cap cost on large or imported content:** caps are Layout-only in SL1; budget and coalescing §6.
- **Non-closed Wall meshes in unusual Junctions:** edge-only fallback; tests 3 cover known shapes.
- **Readability of yellow plane + gold selection on yellow edges:** A-3, owner QA.
- **Escape order:** A-4, owner review.

### Stop conditions

Stop and report (do not work around) if:

1. three's clipping does not behave as Verified 8 in the Stage (shadows change, or programs recompile
   on plane moves).
2. The ground exemption needs anything beyond `clip: false` on two descriptors, or T2 objects.
3. Caps cannot be made exact at Junctions from the built meshes without changing the Wall builder.
4. The Height Sheet knob is not usable while Slice is armed, or `setPlanParameters` depth does not
   flow into Layout membership.
5. Any requirement would need persistence, history, a format change, a new dock slot, shortcut or
   pill component, or a change visible in Preview.
6. The work starts needing SL2/SL3 code (drawn cuts, section evaluation).

## Implementation handoff prompt

> Implement T1 SL1 Level cut (`layout.slice`) on branch `t1/sl1-level-cut` following
> `docs/roadmap/t1-spatial-world/next-batch/sl-plan-slice.md` §9 in order. Treat Verified facts as
> current; re-check each against the code when you touch it and stop on any stop condition. Do not
> implement SL2 or SL3. Commit per step with `feat(layout.slice): …` / `test(layout.slice): …`
> messages and no agent footer. Run focused tests per step and the full editor lane before asking for
> review; do focused browser QA §9 items 1–10 and attach evidence to the PR.
