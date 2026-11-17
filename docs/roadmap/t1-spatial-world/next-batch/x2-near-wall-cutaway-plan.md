# T1 X2 — Near walls: Cut | Whole (automatic near-Wall cutaway) — implementation plan

**Capability:** `layout.interior-reveal` · **Slice:** X2 · **Tier:** 1 · **Status:** plan, ready to
implement on this branch · **Depends on:** X0 (no cutaway exists), X1 Lift, SL1/SL2 StageClip ·
**Independent of:** SP1a.

The product contract is approved and is not reopened here: [README §Interior Reveal](README.md),
[implementation-prs.md Lane X](implementation-prs.md) (X2 row, acceptance, decision record r3),
interaction sketch 9 ([interaction-sketches.html](interaction-sketches.html)), creator journey J11
step 3 ([creator-journeys.md](creator-journeys.md)), and
[editor-shell-and-visual-system.md](../../../reference/design-system/editor-shell-and-visual-system.md)
(cutaway is viewing state; "near-side walls are cut away and click-through, sparing the selection's
own host wall… no Camera change"). This plan settles the two items the record left to implementers —
**stub height** and **hold key** — and every implementation detail below them.

---

## 0. One-paragraph design

While the 3D reading inspects a Space, a pure classifier over the Camera evaluation (eye, orbit
target) and compiled Layout geometry decides which Walls stand between the eye and that Space's
interior. Those Walls render through **cutaway twin materials**: the same store materials as their
normal twins, with one extra fragment test (`world y > uCutawayTopY → discard`) bound to a single
StageClip-owned live uniform. Every other material binds a constant never-cut value, so all twins
share one program and a cut costs no compile. The stub is closed by a **plain paper cap** at
`uCutawayTopY` and **seam caps** where a cut Wall leaves an uncut neighbour's Junction interface
open, both assembled with SL1's `sectionMeshes` pipeline only when the cut set changes, never per
frame. Shadow maps are untouched (depth/distance materials are never patched), so lighting is
physically as built. Picking skips cut Wall surface above the stub and adds the cap as a Wall pick
surface. Selection spares a host Wall. Whole, the hold key, Plan, Preview and snapshots write the
live uniform to the never-cut value. Nothing is persisted and nothing reaches the visitor.

---

## 1. Verified code and contract map

All paths are relative to the repository root. Verified on `main` at `c0a7c92e` (after PR #366).

| # | Fact | Where |
|---|------|-------|
| F1 | StageCanvas creates the one clip before resources: `setStageClip(createStageClip())`, then `provideRenderResources({ clippingPlanes: stageClip.planes, sliceClip: stageClip.sliceUniforms })`. | `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte` |
| F2 | `createStageClip()` → `{ planes, sliceUniforms, apply(resolved), asBuilt(render), isActive(), clipInk(material) }`; `STAGE_CLIP_PLANE_COUNT = 2`; the comment already names X2 as an inheritor of this seam. | `apps/editor/src/lib/authoring/stage/slice/stage-clip.ts` |
| F3 | The store patches every clipping material (`clipsWithStore`: not depth/distance/shadow, not `clip:false`) with `applySliceClipShader`, which adds `vSliceWorldPosition` (world path replaces `#include <project_vertex>`; LineMaterial view path) and a fragment discard after `#include <clipping_planes_fragment>`; `customProgramCacheKey = baseKey + '|biskiq.slice-clip@1'`. Uniforms are bound per material inside `onBeforeCompile`. | `apps/editor/src/lib/render/resources/material-store.ts` |
| F4 | three r187 binds `materialProperties.uniforms = parameters.uniforms` per material (WebGLRenderer ~L2263–2277); identical `customProgramCacheKey` + parameters reuse one program. Per-material uniforms are uploaded only on `refreshMaterial` (program change or `material.id !== _currentMaterialId`, ~L2582–2600, ~L2760–2790), so **per-object values on one shared material are not reliable**; per-material uniform objects are. | `node_modules/three` 0.187.0 |
| F5 | Generic vertex attribute values are context state outside the VAO; `defaultAttributeValues` is applied only when binding state updates (WebGLBindingStates ~L323). A per-vertex "cut" attribute is therefore unsafe on geometries lacking it. | same |
| F6 | Wall meshes: one Mesh per Wall, retained by key; materials from the store via `createVisitorWallMaterialFactory(store, tint, unlitShare, treatment)`; `tagRenderIdentity(mesh, 'wall', wallId)`; `castShadow = receiveShadow = true`; failure surface `'wall-failure'`; `rematerialize(factory, target)` re-resolves materials onto a retained mesh from `materialGroups` without touching buffers (used by `setTreatment`); API `update`, `objectOf`, `setHidden`, `setTreatment` (returns changed), `dispose`. | `apps/editor/src/lib/render/layout-wall-representation.ts`, `render/layout/wall-material-factory.ts` |
| F7 | The editor draws Walls through the shared `VisitorLayoutShell`, which already takes editor-only viewing props `hiddenWallIds` and X1's `liftedRoomIds` (never passed by Preview); each has its own effect that calls the representation and `invalidate()`s on change. | `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte`, `StageCanvas.svelte` L432 |
| F8 | Scene pick walks `raycaster.intersectObject` hits; `options.hiddenAt?.(point)` (point only) makes a hit continue to the next. Slice wraps it: `pickThroughSlice(source, () => resolvedSlice)`, `pickVisibleFaceThroughSlice`. | `authoring/scene/scene-pick-source.ts`, `authoring/stage/slice/stage-slice-pick.ts`, route `+page.svelte` L173, L611 |
| F9 | Canonical Wall-first 3D picking builds Wall face pick surfaces from `solidSpans`, clamps faces to a Slice and adds cap surfaces from `cutWallBandsOf(wall, [span])` at `slice.cutY`; Opening hits are filtered with `sliceHides` and occluded through `context.pickScene`; the slice is read lazily through the module mirror `resolvedSliceNow`. | `authoring/layout/plan-pick-provider.ts`, `authoring/stage/slice/slice-resolved.ts` |
| F10 | `sectionMeshes(inputs, plane, options)` sections retained mesh buffers, welds (τ = 5e-5), balances net multiplicity per `group`, returns `loops`, open `chains` and a `CapAssemblyIssue` when a group does not close; `capFillsOf(loops)` triangulates; `appendSectionEdgesWorld` draws ink; `reportCapIssues` feeds `window.__STAGE_SLICE_DIAGNOSTICS__`; `decideCapAssembly` is the settle schedule. | `authoring/stage/slice/mesh-plane-section.ts`, `slice-cap-shapes.ts`, `slice-edges.ts`, `slice-diagnostics.ts`, `slice-cap-schedule.ts` |
| F11 | Per-Wall meshes are **open at Junction interfaces**: the builder omits faces the resolution reports interior (`CompiledLegJoin.interfaces`, end cross-sections past `clipDistance`, miter planes). Bridges belong to the seam-owning leg; keels are per-leg regions. | `apps/editor/src/lib/layout/wall-mesh-builder.ts` (~L296–470, L573+) |
| F12 | `CompiledLegJoin` publishes, per leg end: `endBoundary` (resolved footprint boundary), `bands`, `ownedSeam.polygon`, `keel.regions/bands`, `interfaces[] { wallId (the resting Wall), normal, fromDistance, toDistance, bands }`, `clipDistance`, `neighbor`. | `packages/layout-core/src/layout-geometry-types.ts` ~L440–560 |
| F13 | `CompiledRoom { roomId, floorElevation, ceilingElevation, floorPolygon, walls (segmentId = wallId), bounds2, bounds3, … }`; `CompiledPhysicalWall { wallId, role, floorId, thickness, height, samples, solidSpans, solidCenterlinePolylines, bounds2, bounds3, … }`, vertical extent `[floor elevation, + height]`. | same |
| F14 | X1 occupied-Room rule (eye XZ in `floorPolygon`, `floorElevation ≤ eye.y ≤ ceilingElevation`, tie → smallest id) via layout-core `pointInPolygon`. | `authoring/layout/interior-lift-store.svelte.ts` `initialLiftScope` |
| F15 | `ViewportEvaluation` carries `eye`, `target` (orbit target), `renderedReading: '3d' \| 'plan' \| 'transition'`, `orthographicWeight`, `token`. | `packages/camera-core/src/viewport.ts` |
| F16 | Reading control ▾ hosts exactly one extra reading today (Lift, `data-reading-more`, `data-reading-lift`), props via `StageToolbars` `viewLine.drafting`. | `authoring/stage/shell/StageDraftingControl.svelte` L74–210 |
| F17 | Held-key precedent: Alt holds Snap off (`shell.suspendSnap`), wired as window `keydown`/`keyup`/`blur` in the route `onMount`; Preview ignores entering a hold but always applies release. Single letters taken: `v p b m e l f`, digits `2 3`, `+ = -`. `pressing()` suppresses tool letters during a press; printable keys open numeric entry in adapter drag mode. | route `+page.svelte` L1350–1362, `route/stage-shell-state.svelte.ts` L455–462, `authoring/stage/stage-input.ts` `stageKeyAction`, `route/stage-keyboard.ts` |
| F18 | Selection contour/hover ink materials are created per subject and cut with `stageClip.clipInk(material)`. | `authoring/stage/shell/StageSelectionLayer.svelte` L111–232 |
| F19 | Hung artwork has **no authored host**: hosting is derived by a back-wall raycast (`artworkBackWallHit`, ≤ 1 cm). | `authoring/stage/route/stage-artwork-interaction.svelte.ts`, `authoring/artwork/artwork-wall-move.ts` |
| F20 | Openings are holes in the Wall mesh; no separate Opening fill mesh exists in the editor (`doorFrames={false}`). | `render/` listing, `StageCanvas.svelte` L432 |
| F21 | Shadows: `clipShadows = false`; depth/distance materials are never patched (F3); the shadow pass draws layer-eligible objects regardless of colour material discard. | SL plan facts, `material-store.ts` `clipsWithStore` |

**Ownership (unchanged).** Layout owns the Walls and their compiled facts; Layout representation
draws the cut state; the editor session holds the switch, the hold and the decision memory; Camera
supplies the pose and stores nothing (X2 submits **no** viewing intent); Scene is untouched; T2
lighting is untouched (T2 README §10: a surface hidden from the camera still casts and blocks
light, T1 owns how). No authored document, history entry, Save payload, snapshot or visitor chunk
learns that a cutaway exists.

---

## 2. Decisions settled

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Stub top** `stubTopY = space.floorElevation + 1.00 m`, one horizontal height for every cut Wall of the inspected Space. A Wall whose solid top is ≤ `stubTopY + 0.05 m` is never cut (nothing to remove). | Below every standing inspection eye; reads as "low". One height means one live uniform. Implementer item from r3. |
| D2 | **Hold key `W`** ("Walls"), held: every Wall whole while down; released on `keyup`, window `blur`, route teardown and on entering Preview. Ignored while a text field has focus, while `pressing()` is true, and while a gesture claims printable keys (numeric entry). No modifier. Not available in Plan (no effect there anyway). | `W` is free (F17); Alt is Snap's hold. Implementer item from r3. |
| D3 | **Default Cut**, session-only. Switch lives in the reading control ▾ under Lift as a two-way item group: `Near walls` · `Cut` / `Whole` (radio, `data-near-walls="cut|whole"`). It is not a pill, not a reading, does not enter the Escape ladder, and is reset to Cut by `resetViewContext()`. | Sketch 9c; X1 reading-control precedent; "no pill". |
| D4 | **Realization: cutaway twin materials** (store descriptor flag `cutaway: true` in the canonical key, like SL1 A-5's `clip: false`), one extra fragment test in the existing patch, version bump `biskiq.slice-clip@1 → @2`. **No** new clipping planes, no geometry swap, no visibility/layer writes, no vertex attribute. | Only per-material uniforms are reliable (F4); vertex attributes unsafe (F5); visibility/geometry would change shadows. Reuses StageClip (SL §2.6). |
| D5 | **Caps**: plain paper fill (`SLICE_INK.cap`, **not** Slice yellow) with an ink edge (`STAGE_PAINT.ink`, 2 px). Horizontal cap at `stubTopY` + vertical **seam caps** on uncut neighbours' exposed Junction interfaces above `stubTopY`. Assembled with `sectionMeshes` + `capFillsOf` only when the cut set or geometry changes. | Brief; SL §2.6; F10, F11. |
| D6 | **Inspected Space** = occupied Room (F14) else the innermost Room whose `floorPolygon` contains the orbit target XZ, with switch hysteresis (§3.1). None → nothing cut. 3D only (`renderedReading === '3d'`). | Acceptance says "occupied Space"; from outside, the target is what the user inspects. |
| D7 | **Obstruction** = sight segments from eye to interior samples crossing a candidate Wall's solid footprint below its top, with cut/uncut hysteresis (§3.2). | Pure function of pose + compiled geometry; stable at rest. |
| D8 | **Stationary stability**: decisions change only on a pose change (`|Δeye|` or `|Δtarget|` > 1e-6 m) or on a committed geometry revision. Exemption, switch and hold changes are presentation masks and may change while still (acceptance requires the stub click to restore at rest). | "No Wall changes state while the Camera is still." |
| D9 | **Host-Wall exemption** = selected Wall; host Wall of a selected Opening; derived host of selected hung artwork (as-built query, F19). A Wall that leaves the exemption while the Camera is still stays whole until the next pose change (**sticky release**), then re-enters classification. | Avoids re-cutting on Escape at rest; honours D8. |
| D10 | **Lighting** physically as built: depth/distance materials unchanged, `castShadow` unchanged, no layer moves. | F21; T2 §10. |
| D11 | **Coexistence**: Slice and cutaway compose (a surface is hidden if either hides it); Lift is independent; Plan/transition → no cut; Preview, snapshots, visitor → as built. | §5. |
| D12 | **Failure closes to whole**: a Wall whose seam closure or cap assembly cannot be balanced is not cut (stays whole), and a diagnostic is reported. Nothing ever renders an open stub. | §8. |

---

## 3. Algorithms

All pure functions take plain numbers and compiled geometry; none import Three, Svelte or the
session. Module: `apps/editor/src/lib/authoring/stage/cutaway/near-wall-classify.ts`.

### 3.1 Inspected Space

```text
input  eye, target (Vec3), rooms: CompiledRoom[], previous: { roomId } | null
occupied(eye) = rooms with pointInPolygon(eye.xz, floorPolygon) and floor ≤ eye.y ≤ ceiling
if occupied ≠ ∅ → pick innermost (smallest |area(floorPolygon)|, tie smallest roomId)  ── "occupied"
else
  containing(target) = rooms with pointInPolygon(target.xz, floorPolygon)
                       and floor − 0.05 ≤ target.y ≤ ceiling + 0.05
  candidate = innermost(containing)
  if previous ≠ null and previous room still exists:
     keep previous unless candidate ≠ previous and
       insetDistance(target.xz, candidate.floorPolygon) ≥ SPACE_SWITCH_INSET (0.25 m)
     drop previous (→ candidate or null) when target.xz is outside previous by ≥ 0.25 m
  else candidate
```

`insetDistance` = signed distance to the polygon boundary (positive inside). Innermost-by-area matches
SP §3.4 `spaceAtPoint`, so the rule extends unchanged to open Spaces (§9).

### 3.2 Candidates and obstruction

```text
space        = inspected Room; stubTopY = space.floorElevation + 1.00
samples P_k  = centroid(floorPolygon) and each vertex moved 0.30 m toward the centroid,
               kept only if inside floorPolygon; decimated evenly to ≤ 32; y = floorElevation + 1.20
candidates   = physical Walls w with
               [w.bottomY, w.topY] overlapping (space.floor, space.ceiling) and
               w.topY > stubTopY + 0.05 and
               NOT (every sample of w's centerline inset by w.thickness/2 lies strictly inside
                    floorPolygon by > 0.01 m)        ── interior content, e.g. free-standing
for each candidate w:
  m_w = max over k of max over crossings c of segment(eye.xz → P_k.xz) with
        buffer(w.solidCenterlinePolylines, w.thickness/2):
            w.topY − (eye.y + t_c · (P_k.y − eye.y))
  (m_w = −∞ when no segment crosses)
next state  cut  if m_w > +0.15
            whole if m_w < −0.05
            else previous state (default whole)
```

Crossings use exact segment–segment tests against the buffered polyline outline (two offset
polylines + end caps); a curved Wall uses its sampled centerline. A closed single (circular) Wall is
one Wall and is cut as a whole. Openings are ignored for obstruction (a window still blocks).
Boundary Walls, dividing Walls of neighbouring Rooms and free Walls outside the Space are all
candidates; only Walls wholly inside the Space are excluded.

Cost bound: ≤ 32 segments × candidates × polyline segments; at 11 Rooms / ~60 Walls this is ≤ ~20k
segment tests per evaluation.

### 3.3 Decision memory and state machine

Store: `apps/editor/src/lib/authoring/stage/cutaway/near-wall-cutaway.svelte.ts` (session
singleton, like `interior-lift-store.svelte.ts`).

```text
state    mode: 'cut' | 'whole'          (default 'cut', session only)
         held: boolean                  (W down)
         decision: { spaceId | null, cut: Set<wallId>, poseKey, geometryRevision }
         sticky: Set<wallId>            (released exemptions awaiting a pose change)

evaluate(evaluation, compiled, revision, pressing):
  if renderedReading ≠ '3d'            → decision.cut = ∅, spaceId = null (keep memory of nothing)
  else if pressing and revision changed → keep decision (frozen during a press); return
  else if poseKey(eye, target) == decision.poseKey and revision == decision.geometryRevision → no-op
  else  space  = inspectedSpace(...)
        cut    = classify(..., previous decision.cut ∩ existing walls)
        sticky = ∅ if poseKey changed
        decision = { … }

effective(selectionHosts) =
  mode == 'whole' or held or no space → ∅
  else decision.cut − selectionHosts − sticky

on selectionHosts change: walls leaving selectionHosts that are in decision.cut → add to sticky
```

`poseKey` is the eye and target rounded to 1e-6 m. Pose changes during a press still re-evaluate
(the Camera can move while dragging); only geometry revisions are frozen until release, after which
the next evaluation runs once.

### 3.4 Realization (material twin)

`material-store.ts`:

1. `StandardMaterialDescriptor` (and every descriptor kind the Wall factory can emit) gains optional
   `cutaway?: true`. It participates in the canonical lease key exactly like `clip?: false`
   (absent ≡ not a twin; never `cutaway: false` in keys).
2. `SliceClipUniforms` gains `cutawayTopY: { value: number }` — the **live** uniform, owned by
   StageClip; and the store module exports `NEVER_CUT_TOP_Y = 1e6` plus one frozen-at-construction
   uniform object `neverCut = { value: NEVER_CUT_TOP_Y }`.
3. `applySliceClipShader(material, uniforms, { cutaway })` binds `uCutawayTopY` to `uniforms.cutawayTopY`
   for twins and to `neverCut` for everything else, and adds after the slice test:
   `if ( vSliceWorldPosition.y > uCutawayTopY ) discard;` — on both the world (mesh) path and the
   LineMaterial view path, which already produce `vSliceWorldPosition` for the drawn predicate, so ink
   bound through `cutawayInk` is cut the same way. `SLICE_CLIP_PROGRAM_KEY = 'biskiq.slice-clip@2'`.
4. `clip: false` materials and depth/distance/shadow materials are unchanged (not patched).
5. `snapshotSliceClipUniforms`/`restoreSliceClipUniforms` include `cutawayTopY`.

`stage-clip.ts`: `createStageClip()` creates `cutawayTopY`; adds `setCutawayTop(y: number | null)`
(null → `NEVER_CUT_TOP_Y`), `cutawayInk(material)` (as `clipInk` but bound to the live top, for
hover/rim ink of a cut Wall), and `asBuilt(render)` parks the cutaway top too. Plane count stays 2.

`layout-wall-representation.ts`: `setCutaway(wallIds: ReadonlySet<string>): boolean` — remembered
set (like `hidden`); for each Wall whose membership changed, `rematerialize(cutawayFactory | factory,
mesh)`; meshes rebuilt by `update()` are born with the twin when their id is in the set; failure
surfaces are never twinned; returns whether anything changed. The cutaway factory is
`createVisitorWallMaterialFactory(store, tint, unlitShare, treatment, { cutaway: true })`, created
lazily on first use and rebuilt with the normal factory on `setTreatment`. Twins are leased per
tint/finish exactly as normal materials, so the store holds at most one twin per distinct Wall
material.

`VisitorLayoutShell.svelte`: prop `cutawayWallIds?: readonly string[]` (doc: never authored, never
persisted, never passed by Preview), own effect `if (walls.setCutaway(new Set(cutawayWallIds)))
invalidate();`. `VisitorPreviewSurface` does not pass it.

Toggle cost: switching Whole/hold/Plan writes the live uniform only (no swap, no assembly); the twin
set is kept so returning to Cut is instant. Twin swaps happen only when the effective set changes.

### 3.5 Caps and seam caps

Module `apps/editor/src/lib/layout/wall-cutaway-seams.ts` (pure, consumes compiled join facts only)
and `apps/editor/src/lib/authoring/stage/cutaway/cutaway-caps.ts` (assembly).

**Seam faces.** For every Junction where an effective-cut leg `C` meets a non-cut leg `U`:

1. *Interfaces.* Each entry of `U.join.interfaces` with `wallId === C` → a vertical quad on `U`'s own
   face (offset line at the face's ±half thickness matching `entry.normal`, along
   `[fromDistance, toDistance]` from that Junction end; curved Walls follow samples), vertical range
   each `entry.band ∩ [stubTopY − 0.01, C.topY]`.
2. *Shared boundary edges.* Edges of `U`'s end-region set {`endBoundary` polyline, `ownedSeam.polygon`,
   `keel.regions`} that coincide (collinear within 5e-5 m, overlapping length > 1e-4 m) with an edge
   of `C`'s set at the same Junction → vertical quad over the overlap, range
   `bandsU ∩ bandsC ∩ [stubTopY − 0.01, min(topU, topC)]`.
3. Orientation: front face points away from `U`'s material (into the removed region).
4. Two cut legs never get a seam between them; two uncut legs never get one.

The quads start 1 cm below `stubTopY`, inside the solid union, so the horizontal section crosses them.

**Horizontal cap.** Group = connected component of effective-cut Walls (sharing a Junction). Inputs to
one `sectionMeshes` call per component: each cut Wall's retained mesh buffers (including its owned
bridges and keels) with `group = component`, plus its seam quads (identity `seam:<U>:<C>`, same
group). Plane: normal `(0, −1, 0)`, constant `stubTopY` (keeps `y ≤ stubTopY`), default section
offset and weld. A balanced group yields loops → `capFillsOf` → one paper Mesh per component at
`stubTopY` + section offset; `appendSectionEdgesWorld` draws the ink outline. Seam quads are drawn as
paper too (clipped to ≥ `stubTopY` by construction of their draw copy) with ink on their free edges.

**Cache.** Per Wall section chains are a function of (mesh identity, geometry revision, `stubTopY`)
and are cached; a cut-set change re-runs only the affected components. Caps are invisible (and not
rebuilt) while Whole/held/Plan.

**Failure.** A component with a `CapAssemblyIssue`, or a seam rule that finds an exposed `U`
interface it cannot match, removes the offending Wall(s) from the effective set (D12) and reports
`{ kind: 'cutaway-cap', wallIds, issue }` through `reportCapIssues` (diagnostic key
`window.__STAGE_SLICE_DIAGNOSTICS__.cutaway`).

**Drawing.** Caps and seams follow StageSliceLayer's cap rules exactly: overlay layer
(`STAGE_OVERLAY_LAYER`), `raycast = () => {}`, unlit `MeshBasicMaterial` in `SLICE_INK.cap` (the
opaque paper tone, never white, never yellow), cut with `stageClip.clipInk` so a Level or drawn Slice
also cuts them; ink edges are `LineMaterial` at `SLICE_INK.edgeWidth` in `STAGE_PAINT.ink` (not
`SLICE_INK.plane` yellow, not gold). Being overlay ink, they are outside the shadow pass and outside the
snapshot camera mask (the snapshot renders world layers only), and they carry no render identity.

### 3.6 Picking

1. `scene-pick-source.ts`: widen the predicate additively to
   `hiddenAt?: (point: Vec3Tuple, object: Object3D) => boolean` (existing callers ignore the 2nd arg).
2. New `apps/editor/src/lib/authoring/stage/cutaway/cutaway-pick.ts`:
   `cutawayHides(point, object, state)` = `renderIdentityOf(object)` is `wall:<id>` with id in the
   effective set and `point.y > stubTopY + 1e-4`. `stageDisplayHides(point, object) = sliceHides(…) ||
   cutawayHides(…)`; `pickThroughSlice` is renamed nowhere — it receives the composed predicate
   (`stage-slice-pick.ts` gains an optional second predicate source).
3. Module mirror `cutaway-resolved.ts` (`setResolvedCutaway`/`resolvedCutawayNow`, like
   `slice-resolved.ts`) holds `{ wallIds, stubTopY } | null` for lazy readers.
4. `plan-pick-provider.ts` (3D path): `createPlanPickProvider(planFor, liftedOutlines, sliceOf,
   cutawayOf = resolvedCutawayNow)`. For a Wall in the effective set: clamp its face surfaces to
   `topY ≤ stubTopY`; add a cap surface at `stubTopY` from `cutWallBandsOf(wall, spans solid at
   stubTopY)` (same helper SL1 uses at `cutY`); drop Opening ray hits above `stubTopY` on that Wall.
   With both a Slice and the cutaway, the lower clamp wins per Wall.
5. Result: a ray over a stub passes through to the interior (click-through); a ray onto the stub's
   face or cap selects the Wall; selecting it exempts it (D9) so it shows whole immediately.
6. Hover ink on a cut Wall uses `stageClip.cutawayInk` so the hover contour matches the stub;
   the selection contour is always whole because the selected Wall is exempt.
7. Scene objects keep their own pick; a hung artwork above a stub is pickable as before (§7 O-1).
8. As-built queries (artwork hosting `artworkBackWallHit`, measure snapping, Layout gesture hit
   tests that must see real geometry) use the **unwrapped** scene pick, never the display predicate.

---

## 4. Files to change

| File | Change |
|------|--------|
| `apps/editor/src/lib/render/resources/material-store.ts` | `cutaway?: true` descriptor flag in canonical key; `cutawayTopY` in `SliceClipUniforms`; `NEVER_CUT_TOP_Y`, shared `neverCut`; patch `@2` fragment test; snapshot/restore include it. |
| `apps/editor/src/lib/authoring/stage/slice/stage-clip.ts` | Own `cutawayTopY`; `setCutawayTop`, `cutawayInk`; `asBuilt` parks it. |
| `apps/editor/src/lib/render/layout/wall-material-factory.ts` | Optional `{ cutaway: true }` option that sets the descriptor flag on every lease (and on any finish path the factory serves). |
| `apps/editor/src/lib/render/layout-wall-representation.ts` | `setCutaway(ids): boolean`, born-cut on rebuild, cutaway factory lifecycle with `setTreatment`/`dispose`. |
| `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` | `cutawayWallIds` prop + effect. |
| `apps/editor/src/lib/layout/wall-cutaway-seams.ts` (new) | Seam-face derivation from `CompiledLegJoin`. |
| `apps/editor/src/lib/authoring/stage/cutaway/near-wall-classify.ts` (new) | §3.1–3.2. |
| `apps/editor/src/lib/authoring/stage/cutaway/near-wall-cutaway.svelte.ts` (new) | §3.3 store; `resetViewContext` hook. |
| `apps/editor/src/lib/authoring/stage/cutaway/cutaway-caps.ts` (new) | §3.5 assembly + cache. |
| `apps/editor/src/lib/authoring/stage/cutaway/cutaway-pick.ts`, `cutaway-resolved.ts` (new) | §3.6. |
| `apps/editor/src/lib/authoring/stage/cutaway/StageCutawayLayer.svelte` (new) | Draws caps/seams; owns `setCutawayTop`; mounted in `StageCanvas` beside `StageSliceLayer`. |
| `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte` | Props `cutawayWallIds`, `cutawayTopY`; pass to `VisitorLayoutShell`; mount layer. |
| `apps/editor/src/lib/authoring/scene/scene-pick-source.ts` | `hiddenAt(point, object)` additive. |
| `apps/editor/src/lib/authoring/stage/slice/stage-slice-pick.ts` | Accept a composed display predicate. |
| `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts` | `cutawayOf` accessor; clamp, cap surface, Opening filter. |
| `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte` | Hover/rim ink of a cut Wall via `cutawayInk`. |
| `apps/editor/src/lib/authoring/stage/shell/StageDraftingControl.svelte`, `StageToolbars` | `nearWalls?: { mode, set(mode) } \| null` prop; radio group under Lift. |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | Feed evaluation/compiled/revision/pressing/selection hosts to the store; `W` keydown/keyup/blur; `setResolvedCutaway` (cleared where `setResolvedSlice` clears); props to Canvas and toolbar; compose pick predicate at L173/L611. |
| `docs/roadmap/t1-spatial-world/next-batch/implementation-prs.md` | X2 row links this plan (done in this commit). |

Not touched: layout-core compile, project-model, camera-core, Scene, T2 light/shadow code, visitor
routes, SP1a schema/compiler, Experience.

---

## 5. Coexistence rulings

| With | Ruling |
|------|--------|
| Level Slice (SL1) | Both apply. Native planes keep below the cut; cutaway discards above `stubTopY`. If `cutY < stubTopY` the cutaway is visually inert (still computed). Caps: Slice caps are yellow at `cutY`; cutaway caps paper at `stubTopY`; when `cutY ≤ stubTopY` the cutaway cap group is not drawn (it would be hidden above the cut). Picking uses the lower clamp. |
| Drawn Slice (SL2) | Both apply (union of hidden). Cutaway caps are clipped by the drawn predicate (they use the patched paper material). |
| Lift (X1) | Independent: Lift moves overhead sources to layer 3; cutaway only touches Walls. No interaction in the Escape ladder. |
| Plan / transition | Live top = never-cut; caps hidden; decision memory cleared on entering Plan so returning to 3D classifies fresh. |
| Camera navigation | Reads the evaluation only; submits no intent; guided travel, framing, fit unaffected. |
| Undo/Redo | Not recorded; a geometry revision from undo re-evaluates once (D8). |
| Layout gestures | Geometry revisions frozen while `pressing()`; one re-evaluation after release. A dragged Wall keeps its state during the press. |
| Preview | Separate Canvas without the prop → as built. Entering Preview releases the hold. |
| Snapshots | `renderStageSnapshot` already calls `asBuilt`, which now also parks the cutaway top; caps are overlay ink, already outside the snapshot mask. |
| Wall hide (`hiddenWallIds`) | Hidden wins (Wall not drawn; no caps for it). |
| Grid/Snap, Measure | Measure and snapping use as-built pick (§3.6.8). |

---

## 6. Ordered implementation steps

1. **Store patch @2 + twin flag** (material-store, stage-clip). Unit: key canonicality, twin and
   normal share `customProgramCacheKey`, uniform binding (twin → live, normal → `neverCut`), depth
   materials unpatched, snapshot/restore.
2. **Representation** `setCutaway` + factory option + shell prop. Unit: swap only changed Walls,
   born-cut on rebuild, failure surfaces untouched, `setTreatment` keeps twins, dispose releases
   twin leases.
3. **Classifier** (pure) with fixtures. Unit tests §10.1.
4. **Store/state machine** + route wiring (evaluation, pressing, selection hosts, hold key, switch).
5. **Seam faces + caps** with catalogue test. If the catalogue test cannot reach zero issues for a
   Junction class, implement D12 for that class and record it; do not widen scope.
6. **Picking** (scene predicate, plan-pick-provider, mirror, hover ink).
7. **Reading control UI** (radio under Lift) + `resetViewContext`.
8. **Real-WebGL fixture** additions and perf numbers (§11); browser acceptance (§10.3).

Each step leaves `npm run check` and `npm test` green; steps 1–3 can land in the same PR as the rest
(one Tier 1 PR), with this plan as its first commit.

---

## 7. Owner questions (genuine)

| ID | Question | Recommended ruling (reversible default used if unanswered) |
|----|----------|------------------------------------------------------------|
| O-1 | Hung artwork on a cut Wall: its derived host is cut, the artwork floats above the stub. | **Leave Scene objects as built in X2** (Scene authority untouched; artwork stays pickable). A follow-up may clip artwork whose derived host is cut, via the same twin flag on its store material. |
| O-2 | Stub height 1.00 m and hold key `W`. | Accept (they were left to implementers in r3; recorded here for the checkpoint). |
| O-3 | Sticky release (D9): a stub you clicked stays whole after deselecting until the Camera moves. | Accept; the alternative re-cuts on Escape at rest, which reads as flicker. |

Nothing else needs the owner: every other choice is internal to the approved contract.

---

## 8. Failure cases and stop conditions

| Case | Behaviour |
|------|-----------|
| Cap/seam component does not balance | Offending Walls stay whole (D12) + diagnostic. Never an open stub. |
| Wall build failure (`wall-failure`) | Never twinned, never cut. |
| Eye inside a Wall footprint | Classifier treats it as outside every Room unless the occupied test holds; the Wall containing the eye has crossings for every segment → cut (correct: it blocks everything). |
| Space with < 1 valid sample (sliver) | Use the centroid alone; if it is outside the polygon, nothing is cut. |
| Target on a Room boundary | Hysteresis keeps the previous Space; with none, nothing is cut. |
| Wall shared by two Rooms (dividing) | Candidate for both; classified per inspected Space. |
| Curved / tapered / step Walls | Section and seams use the mesh and compiled join facts; covered by the catalogue test. |
| Geometry revision during a press | Frozen until release. |
| Context loss / renderer rebuild | Twins are store leases; recreated with the store; the effective set is re-applied by the shell effect. |

**Stop and report (do not improvise) if:**

- any twin forces a new program (program count in the real-WebGL fixture changes when the cut set
  changes) — the shared-program premise (F4) is broken;
- shadow pixels differ between Cut and Whole in the fixture;
- the catalogue test leaves a Junction class failing **and** D12 would leave the near Wall of a
  common enclosure (rectangle, L, T) uncut;
- correctness appears to need a change in layout-core compile output, project-model, Camera or
  T2 lighting;
- a visitor/public boundary test fails.

---

## 9. SP1 compatibility and handoff

- X2 reads only `CompiledRoom.floorPolygon`, elevations and `walls`, plus physical Walls and Junction
  joins. It does not read SP1a schema, does not assume enclosure is permanent, and runs on today's
  enclosed Rooms.
- After SP1a/SP1c, open Spaces arrive as `CompiledRoom`s whose `floorPolygon` includes virtual edges
  and whose `walls` lists only real Wall segments. §3.1 already uses innermost-by-area (SP §3.4
  `spaceAtPoint`), and §3.2 naturally never cuts a virtual edge (no Wall). The only follow-up is to
  source the Space list from the SP point-ownership query once it exists, replacing the local
  innermost helper — a one-function swap.
- An open Space wholly inside a Room: the innermost rule inspects the open Space; candidate exclusion
  then treats the Room's Walls as outside → cut when obstructing. Intended.
- **T2 handoff:** lighting and shadows are untouched; if T2 later wants a lighting-aware cutaway
  (e.g. caps receiving light differently), it consumes the effective set through the mirror, never a
  second classifier. A future visitor cutaway (outside T1) would move `near-wall-classify.ts` into
  layout-core unchanged; it is pure for that reason.

---

## 10. Tests

### 10.1 Deterministic unit (vitest, `apps/editor`)

1. `near-wall-classify.test.ts`
   - Rectangle Room, eye outside south at 1.6 m, target centre → south Wall cut, others whole.
   - Same, eye above roof looking down at 60° → no Wall cut when tops are below sight lines; low-angle
     view → near Wall cut.
   - Eye inside the Room → nothing cut (convex); L-shaped Room with eye in one arm → the re-entrant
     corner Wall cut only if it blocks samples.
   - Free-standing Wall inside the Room never cut; neighbour Room's dividing Wall between eye and
     target cut.
   - Hysteresis: m_w oscillating in (−0.05, 0.15) keeps state; crossing thresholds flips.
   - Space switch hysteresis at a shared boundary; no Room → nothing.
   - Determinism: same inputs → identical sets; permuted Room/Wall order → identical sets.
   - Partial-height Wall below `stubTopY + 0.05` never cut.
2. `near-wall-cutaway.test.ts` (store): stationary pose → no change across repeated evaluations and
   geometry-revision-free ticks; exemption add/remove with sticky release; Whole/hold mask; Plan
   clears; press freezes revisions; `resetViewContext` → Cut.
3. `material-store` tests: twin key, shared program key `@2`, uniform binding, depth material
   unpatched, `clip:false` unpatched.
4. `layout-wall-representation` tests: `setCutaway` swaps only changed meshes; rebuild born-cut;
   failure surface untouched; returns change flag.
5. `wall-cutaway-seams.test.ts` + `cutaway-caps.test.ts` — **catalogue**: every Junction fixture in the
   wall-mesh catalogue (L/miter, T, X, tangent continuation, thickness step, height step, curved leg,
   degree-4 sector with keels), for every cut/uncut assignment of its legs: zero `CapAssemblyIssue`,
   and the union {stub meshes below `stubTopY`, caps, seams} has no boundary edges above the floor
   (watertight check on welded edges).
6. `cutaway-pick.test.ts` + `plan-pick-provider` cases: ray above stub → passes to interior target;
   ray at stub face → Wall; ray at cap from above → Wall; Opening above stub on cut Wall not hit;
   Slice + cutaway → lower clamp.
7. Keyboard: `W` hold sets/releases; ignored in text entry, during `pressing()`, during numeric entry;
   blur releases; Preview enter releases.
8. Boundary: visitor/public/preview boundary tests still pass; `VisitorPreviewSurface` does not pass
   `cutawayWallIds`.

### 10.2 Real-WebGL (owner-run perf lane, extend `perf/flows/stage-clip.spec.ts` +
`perf/regressions/stage-clip-entry.ts`)

- 11-Room fixture, scripted orbit around the building: program count constant before/after the first
  cut and across all cut-set changes (expected: no increase beyond the SL2 baseline once twins exist;
  first twin lease may compile **zero** new programs because the key is shared).
- Shadow-map pixel equality: render the shadow map (or a lit floor patch receiving a cut Wall's
  shadow) in Cut and Whole → byte-identical.
- Pixel check: above-stub region of a cut Wall shows interior; cap present (paper tone sample);
  no Slice-yellow pixels from the cutaway.
- Stationary: 120 frames at rest → zero twin swaps, zero cap rebuilds.

### 10.3 Focused browser QA (agent spot check; owner retains acceptance)

1. Open a project with several Rooms; 3D; orbit low outside → near Walls become paper-capped stubs
   with ink edges; interior visible.
2. Click through a stub onto a Floor/object → that selects; click the stub face → Wall selected and
   whole; Escape → stays whole until orbiting; orbit → re-cut.
3. Select an Opening → its host Wall whole.
4. Hold `W` → all whole; release → back. Switch to Whole in ▾ → all whole; back to Cut.
5. Stop orbiting → nothing changes for several seconds.
6. Level Slice on → both work; Lift on → independent.
7. Plan → no stubs; Preview → as built; take a snapshot → as built.
8. Console clean; `__STAGE_SLICE_DIAGNOSTICS__.cutaway` shows zero issues.

---

## 11. Performance criteria

| Measure | Budget | Tripwire |
|---------|--------|----------|
| Classification per evaluation (11 Rooms, ~60 Walls) | ≤ 0.5 ms p95 | 2 ms |
| Twin swap per changed Wall | ≤ 0.05 ms, no buffer upload | — |
| Cap/seam rebuild per cut-set change (≤ 8 cut Walls, cached chains) | ≤ 4 ms p95 | 16 ms → move rebuild to the 120 ms settle via `decideCapAssembly` and keep the previous caps until it lands |
| Program compiles caused by X2 | 0 at runtime after first frame | any |
| Layout recompiles caused by X2 | 0 | any |
| Shadow map re-render caused by a cut | 0 (shadow invalidation untouched) | any |
| Stationary Camera | 0 swaps, 0 rebuilds, 0 `invalidate()` from X2 | any |

On-demand rendering: X2 calls `invalidate()` only when the effective set, live top or caps change.

---

## 12. Handoff prompt (for the implementing agent)

> Implement T1 X2 on branch `t1/x2-near-wall-cutaway` following
> `docs/roadmap/t1-spatial-world/next-batch/x2-near-wall-cutaway-plan.md`. Do steps §6 in order;
> keep every decision in §2; use the reversible defaults in §7 unless the owner rules otherwise; stop
> on any §8 stop condition and report. Run the editor test contract in `apps/editor/tests/README.md`
> (unit, check, build) and the focused browser QA in §10.3; the §10.2 perf additions are written but
> run by the owner. Do not touch layout-core compile, project-model, Camera, T2 lighting, SP1a or
> visitor routes. Convert this draft PR from PLANNING ONLY when implementation lands.
