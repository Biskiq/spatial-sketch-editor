# T1/T2 consolidation — audit

**Base:** `main` at `afca870f` (merge of PR #314). **Method:** static inspection of the code against
the documented invariants, existing measurement records, and hand-calculated cost models. No
benchmark was run for this audit. Every quantitative statement is labelled:

- **Measured** — taken from an existing record (source named).
- **Counted** — derived exactly from code or workload definitions.
- **Estimate** — a hand calculation resting on a stated assumption.
- **Unknown** — not established; the owning slice measures it before acting.

A finding is a claim about the code, not a verdict on its fix. Each names the slice in
[`slices.md`](./slices.md) that carries it; the renderer findings also feed
[`renderer-refactor.md`](./renderer-refactor.md).

## 1. Evidence base

### 1.1 Workloads (counted)

The certified grids hold Layout only: `n × n` Rooms, `2n(n+1)` Walls, 6 m cells, no Scene entities
(`apps/editor/perf/lib/workloads/registry.ts`). Imported models and textured Scene composition are
uncertified by any existing record.

| Grid | n | Rooms R | Walls W |
| --- | --- | --- | --- |
| S | 3 | 9 | 24 |
| M | 7 | 49 | 112 |
| L | 14 | 196 | 420 |
| XL | 20 | 400 | 840 |

### 1.2 Existing measurements (measured)

Spot check at `d5097580`, 2026-10-28
([record](../../archive/research/performance-spot-check/README.md)), milliseconds:

| Flow | M | L |
| --- | --- | --- |
| Open: admission | 101.4 | 284.1 |
| Open: through render | 593.1 | 5,065.1 |
| Typed commit: editor | 6.3 | 15.6 |
| Typed commit: through matching render | 33.4 | 115.3 |
| Drag: editor | 4.1 | 4.5 |
| Pan: task | 7.0 | 19.6 |
| Pick index nodes | 1,063 | 3,917 |

Bench 1 at `1c5e530c` (before S06) attributed 86 % of XL open self time to Svelte mount work and
recorded a 60 fps idle re-render and 2,269 draw calls at L with three objects per Room. S06 answered
with retained Wall and object representations, on-demand rendering and shadow invalidation.

### 1.3 What the records do and do not say

- Admission scales near-linearly (L/M = 2.8 for 4× Rooms). The **render gap** does not: open through
  render minus admission is 492 ms at M and 4,781 ms at L, a 9.7× step for 3.75× Walls. Something
  between admission and first frame is super-linear. Its composition is **unknown**.
- A typed commit at L spends 15.6 ms in the editor and a further ≈100 ms reaching the matching
  frame. The composition of that 100 ms is **unknown**.
- No record covers Scene content, material or texture work, candidate previews, or frames at rest
  after S06.

## 2. Pipeline as built

```text
Authored units (F2 envelope)
  │  admitSourceOnce: validateProjectEnvelope + prepareValidatedUnitRuntime          [per accept]
  ├─ Layout ── compile session (incremental, per-entity cacheKey) ─► CompiledLayoutGeometry
  ├─ Scene + Camera ── sceneProjectionForRuntime ─ resolveSceneDocument ─► RuntimeScene (new each accept)
  └─ rooms: createEmptyLayoutRoomRegistry() (new, always empty)
        │
        ▼
Stage host (+page.svelte): rAF tick ─► refresh(): camera.evaluate, overlays, candidatePreviews  [per frame]
        │
        ├─ Plan: createPlanRetainer ─► buildPaperPlan ─► createPaperScene (whole project)
        ├─ 3D Layout: VisitorLayoutShell
        │     Walls   ─ createWallRepresentation   (retained, imperative, patch by cacheKey)
        │     Objects ─ createObjectRepresentation (retained, imperative)
        │     Rooms   ─ Svelte each: 3 meshes + 3 geometries + 3 materials per Room
        ├─ 3D Scene: VisitorEntityGroups ─► EntityPrimitive / EntityForm / AssetModel / EntityArtwork / EntityLight
        │     material: resolveSceneMaterial (per entity, per render) ─► SceneInstanceMaterial ─► texture-cache
        └─ StageCamera (invalidate per evaluation) ─► managed WebGL renderer, shadow invalidation
```

The Layout half of the pipeline is describe-once: one compiler, per-entity cache keys, retained
representations patched by key. The Scene half and the Room surfaces are not: descriptions are
re-derived per accept, resources are built per entity inside components, and nothing owns sharing.

## 3. Architecture findings

Severity: **A** violates a hard rule or reference contract as written; **B** duplicated ownership or
a surviving retired path; **C** weak ownership or naming, no behavioural effect today.

| Id | Sev | Finding | Evidence | Slice |
| --- | --- | --- | --- | --- |
| AR-1 | A | **Runtime Scene re-merges Camera.** `sceneProjectionForRuntime(scene, camera)` folds Camera views back into `RuntimeScene.navigationNodes` and `connections`, and the navigation graph is built from that merged shape. Hard rule 2 lands the split in authored units; the runtime still carries the pre-cutover shape, so a Camera edit changes Scene render identity. | `packages/project-model/src/units/runtime.ts` (`prepareValidatedUnitRuntime`, line 142) | I4 |
| AR-2 | B | **Room frame survives as a vestige.** The runtime Room registry is always empty, yet `roomId?` remains on Scene entity types, `VisitorEntityGroups` groups by `entity.roomId` and calls `rooms.getRequired`, and a `rooms` prop is threaded through the Stage canvas and shadow triggers. Hard rule 2: no mandatory Room frame; Scene 6 is world-local. | `packages/project-model/src/scene.ts` (lines 60, 137, 144, 181, 354, 386); `apps/editor/src/lib/visitor/VisitorEntityGroups.svelte` (lines 69–79) | I3 |
| AR-3 | B | **A second Wall realisation path survives.** `VisitorLayoutShell` still builds Room-owned wall meshes (`buildRoomWallMesh`, `adaptedRooms`) and loops `room.walls` for portals, beside the canonical wall representation. Format 7 is wall-first and the architecture states there is no second reader or compatibility path. Whether any current compile can populate `room.walls` is **unknown**; I3 establishes it first. | `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` (lines 8, 99, 154–167, 257) | I3 |
| AR-4 | B | **Compiled-geometry caching has five owners.** (1) the passive compile record in layout-core, written by the session-less compile but never read by it; (2) `compiledBySource` in scene planning; (3) a module-lifetime `plannerCompileSession` that outlives a closed project; (4) the host's `compileSession` plus a 52-entry `admittedByContentId`; (5) uncached session-less compiles in candidate previews and the starter gallery. One compiler (hard rule 6) holds; one owner of its results does not. | `packages/layout-core/src/layout-geometry-delta.ts` (line 228); `packages/project-model/src/scene-planning/support.ts` (line 44); `apps/editor/src/lib/authoring/adapters/layout/precision.ts` (line 252); `apps/editor/src/lib/authoring/stage/host-acceptance.ts` (line 220); `apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts` (lines 54, 72, 88, 162) | I2 |
| AR-5 | B | **Plan symbols are reconstructed by a consumer.** `openingAttemptPlanPaper` hand-builds door-swing and window symbols for candidates instead of taking them from the Layout plan representation, so accepted and candidate symbols have two sources. | `apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts`; `packages/layout-core/src/layout-plan-representation.ts` | I5 |
| AR-6 | A | **World materials are built at twelve sites.** The T2 direction fixes "one material factory" and "no slice builds a material or light outside the shared factory and resolved-look module" ([T2 direction](../t2-look-atmosphere/README.md)). See RR-7 for the sites. | section 5 | R2 |
| AR-7 | A? | **A free-look pose authority outside Camera.** The visitor's non-authored neutral frame is driven by Threlte `OrbitControls` with damping. Hard rule 1 names free look as a profile that realises viewing intent through the one Camera authority. The behaviour is deliberate and tested. This is an owner decision, not a scheduled slice. | `apps/editor/src/lib/visitor/VisitorCameraDirector.svelte` (line 639) | [Decision D2](./README.md#owner-decisions) |
| AR-8 | C | **Product code lives under legacy names.** `lib/museum/*` holds the product's materials, entities, assets and layout surfaces; `Visitor*` components are the editor Stage's renderer; `MUSEUM_SCENE_VALIDATION_OPTIONS` names product validation. The frozen museum project left the repository in PR #115. | `apps/editor/src/lib/museum/materials/MuseumMaterial.svelte` and siblings | R8 |
| AR-9 | C | **Editor session state beside a runtime-safe module.** Unfold-session state sits in `wall-unfold.ts` next to the visitor-shared wall mesh builder. The arch lane already guards visitor imports; this is placement, not a leak. | `apps/editor/src/lib/layout/wall-unfold.ts` | not scheduled |
| AR-10 | C | **Polygon union lives in Stage code.** `unionOutline` and the Paper fill builder implement outline union inside the editor Stage. Low severity; recorded so it is not copied. | `apps/editor/src/lib/authoring/stage/paper-plan.ts`; `apps/editor/src/lib/authoring/stage/paper-fill-geometry.ts` | not scheduled |
| AR-11 | — | **Directional light is retired but present.** The owner retired the Directional kind on 2026-11-13 (Sky owns the only Sun; Point and Spot remain). `EntityLight`, the Scene types, the codec and the light adapter still carry it. This is a product slice, not audit remediation; it constrains R6. | `apps/editor/src/lib/museum/entities/EntityLight.svelte`; `apps/editor/src/lib/authoring/adapters/light.adapter.ts` | [Decision D4](./README.md#owner-decisions) |

### 3.1 Enforcement gaps

| Id | Gap | Slice |
| --- | --- | --- |
| EN-1 | "Stop drawing at rest" is guarded only by a source-shape assertion that the Canvas passes `autoInvalidate: false` (`apps/editor/tests/lib/authoring/stage-shell-composition.test.ts`). That proves the machinery, not the call site; the call site regressed (PF-1). | I1 |
| EN-2 | No check counts compiles on a gesture or preview path. `layout-performance.md` forbids compilation on the per-move path; nothing fails when a preview calls the session-less compiler every frame (PF-2). | I2, G1 |
| EN-3 | No arch boundary for "one material factory". | R2 |
| EN-4 | No arch boundary for renderer portability (shader patching, raw GL, WebGL-only classes in world code). | R1 |
| EN-5 | Render identity is recovered by string name (`getObjectByName('VisitorPhysicalWall:' + id)` and prefix tests) in three modules; no representation owns an id → object map. | R1 |

### 3.2 Checked and found sound

- One architectural compiler: every path reaches `compileWallFirstLayoutGeometry`; no consumer
  rebuilds walls, junctions or openings from authored data.
- Wall unfold uses layout-core's development map; there is no second development math.
- Visitor isolation is enforced by the arch lane and the vite boundary plugins.
- Wall and object representations are retained and patched by `cacheKey`; Plan evaluation is
  retained across pans.
- Shadow maps are invalidated, not auto-updated, except under the model rule in RR-8.
- Camera: the Stage evaluates through one `camera-session`; AR-7 is the only pose authority outside
  it.

## 4. Editing-path findings

| Id | Finding | Evidence | Slice |
| --- | --- | --- | --- |
| PF-1 | **The Stage renders every frame at rest.** The route installs an unconditional rAF `tick` → `refresh()`. `refresh()` calls `stage.camera.evaluate(...)`, which increments `generation` and returns a new evaluation object every call, and assigns it to a deep `$state`. `StageCamera` invalidates in an effect that reads `evaluation`. Result: one full render per display frame, forever. `refresh()` also reassigns `markers`, `candidatePreviews` and `guides` every frame. Confidence: high (three call sites read end to end); the frame count itself is **unknown** until I1 counts it. | the Stage route `+page.svelte` (lines 788, 1571–1644, 1750–1765); `apps/editor/src/lib/authoring/stage/camera-session.ts` (lines 319–337); `apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte` (lines 82–88) | I1 |
| PF-2 | **A live candidate preview recompiles the whole project every frame.** `candidatePreviews()` runs on every tick and reaches `buildLayoutCandidatePaper`, which calls the session-less compiler, evaluates the whole Plan and builds whole-project Paper, then filters to the changed ids. In 3D an Opening preview compiles a second time; an Opening Repeat proposal also reruns its planner. Nothing memoises by candidate identity, so a still pointer pays the same as a moving one. | `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` (`candidatePreviews`, `candidatePaper`); `apps/editor/src/lib/authoring/adapters/layout/candidate-preview.ts` (line 154) | I2, G1 |
| PF-3 | **Every accepted edit re-prepares every unit's runtime.** Admission validates the whole envelope and calls `prepareValidatedUnitRuntime`. Layout goes through its session; Scene is fully re-resolved into a new `RuntimeScene`, the navigation graph is rebuilt and a new empty Room registry is created. A Wall, Camera or Experience edit therefore changes `scene` and `rooms` identity, and every Scene-keyed consumer reruns: material resolution (PF-4), shadow invalidation (RR-8), footprints, the presentation record. | `apps/editor/src/lib/authoring/stage/source-admission.ts`; `packages/project-model/src/units/runtime.ts` | G2 |
| PF-4 | **Material and texture churn per Scene identity change.** `VisitorEntityGroups` calls `entityEffective(entity)` in the template; `resolveSceneMaterial` returns a new object per entity per render. `SceneInstanceMaterial` reads it synchronously in an effect, so the effect reruns: maps cleared, the previous variant released, a new one acquired. The texture cache disposes clones at reference count zero. Whether that deletes and re-uploads the GPU texture is **unknown** (it depends on whether a shared variant's count ever reaches zero mid-flush). | `apps/editor/src/lib/visitor/VisitorEntityGroups.svelte`; `apps/editor/src/lib/museum/materials/scene-instance-material.ts` (line 65); `apps/editor/src/lib/museum/materials/SceneInstanceMaterial.svelte`; `apps/editor/src/lib/render/resources/texture-store.ts` | G2, R2b |
| PF-5 | **Paper is rebuilt whole.** `buildPaperPlan` runs over the whole project on any plan, footprint or revision change. `createPaperScene` disposes and rebuilds every line batch and every fill (shape triangulation plus merge) whenever the drawing's identity changes — including selecting or deselecting an Opening, because selection filters lines into a new drawing object. | `apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte`; `apps/editor/src/lib/authoring/stage/paper-plan.ts` (line 710); `apps/editor/src/lib/authoring/stage/paper-scene.ts` (line 72) | G3 |
| PF-6 | **Wall visibility is O(W²).** After each wall patch the shell loops every Wall and calls `getObjectByName` twice, each a recursive scan of the wall group. | `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` (lines 117–118) | R1 |

## 5. Render-resource findings

| Id | Finding | Evidence | Slice |
| --- | --- | --- | --- |
| RR-1 | **Rooms are mounted through Svelte, three meshes each.** Per Room: floor, floor-shadow and ceiling meshes; three `ShapeGeometry` (the floor shape is triangulated twice); one `MeshBasicMaterial`, one `ShadowMaterial` and one `MuseumMaterial` instance. Walls and objects left this path in S06; Rooms did not. | `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` (lines 203–237) | R3 |
| RR-2 | **Walls: one mesh and one draw per Wall.** Retained and shared-material, so correct; W draws per colour pass and per shadow pass. | `apps/editor/src/lib/render/layout-wall-representation.ts` | R7 (gated) |
| RR-3 | **Layout objects build a geometry each.** A new Box, Cylinder or Sphere geometry per object at authored dimensions; the material is shared. | `apps/editor/src/lib/render/layout-object-representation.ts` | R4 |
| RR-4 | **Scene primitives build geometry and material per entity.** Authored dimensions are constructor arguments, so a dimension edit disposes and rebuilds the GPU buffer; each entity owns a `MeshStandardMaterial`. | `apps/editor/src/lib/museum/entities/EntityPrimitive.svelte` | R4 |
| RR-5 | **Forms share evaluation, not buffers.** The evaluated mesh is cached (LRU 256) by `formEvaluationKey`, but each entity leases its own `BufferGeometry` (positions copied, normals recomputed). | `apps/editor/src/lib/museum/entities/form-geometry.ts`; `apps/editor/src/lib/content/form-evaluation.ts` | R4 |
| RR-6 | **Models duplicate materials per instance.** Each instance clones the scene graph and every material, then the remap creates a further `MeshStandardMaterial` per mesh. Geometry is shared by the clone. No instancing for repeated models. | `apps/editor/src/lib/museum/assets/model-utils.ts`; `apps/editor/src/lib/museum/assets/instance-material-remap.ts`; `apps/editor/src/lib/museum/assets/AssetModel.svelte` | R5 |
| RR-7 | **World materials are constructed at twelve sites**: wall factory, object representation, wall representation (failure), model remap, Scene instance material, `MuseumMaterial`, `FallbackMaterial`, artwork (six materials), the layout shell (three), the ground plinth, the world environment (two) and the model component. | `apps/editor/src/lib/museum/layout/wall-material-factory.ts`; `apps/editor/src/lib/museum/assets/FallbackMaterial.svelte`; `apps/editor/src/lib/museum/layout/GroundPlinth.svelte`; `apps/editor/src/lib/render/WorldEnvironment.svelte` and the files above | R2 |
| RR-8 | **Shadow triggers are identity-wide and model-pessimistic.** The triggers watch `[geometry, scene, rooms, modelUrls, formRenderRevision]`, so PF-3 turns every accept into a shadow re-render. `needsPerFrameShadows` returns true whenever the Scene holds any model and any casting light, because a model's arrival is not observable — per-frame shadow maps for a static scene. | `apps/editor/src/lib/authoring/stage/shell/StageShadowTriggers.svelte` (lines 66–74); `apps/editor/src/lib/render/shadow-invalidation.ts` (line 100) | G4 |
| RR-9 | **Artwork builds four geometries and six materials each.** A unit plane, an extruded frame, a mat shape and a backing plane per artwork, with four Lambert materials plus custom depth and distance materials. The image texture is leased and shared. | `apps/editor/src/lib/museum/entities/EntityArtwork.svelte`; `apps/editor/src/lib/render/artwork/artwork-scope.ts` | R5 |
| RR-10 | **Lights are built inside components.** `EntityLight` and `WorldEnvironment` construct Three lights directly; the T2 direction routes lights through the resolved-look module. | `apps/editor/src/lib/museum/entities/EntityLight.svelte`; `apps/editor/src/lib/render/WorldEnvironment.svelte` | R6 |
| RR-11 | **Preview is a second Canvas that renders always while active.** A second WebGL context duplicates every GPU resource by necessity; `renderMode` is `always` for an active run. Whether a run at a hold needs continuous frames is **unknown**. | `apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte` (lines 426–430) | I1 (count only) |

### 5.1 WebGPU-portability inventory

World code today is portable: it uses built-in material classes and standard properties. The
WebGL-specific sites are few, and all but one are editor-only:

| Site | Use | Portable form |
| --- | --- | --- |
| `apps/editor/src/lib/render/managed-webgl-renderer.ts` | wraps `onBeforeCompile` for the DFG lookup lifecycle | WebGL-named shim; stays the only renderer-specific module |
| `apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts` | GLSL `ShaderMaterial` for the mat and grid | editor-only; a node material when a port happens |
| `apps/editor/src/lib/authoring/stage/paper-scene.ts`, `apps/editor/src/lib/authoring/stage/paper-marks.ts`, `apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte` | fat lines (`LineSegments2`, `LineMaterial`) | editor-only; Three ships a WebGPU line variant |
| `apps/editor/src/lib/authoring/stage/shell/StageSnapshotRenderer.svelte` | `WebGLRenderTarget` | the generic `RenderTarget` |
| `apps/editor/src/lib/museum/entities/EntityArtwork.svelte` | `customDepthMaterial` / `customDistanceMaterial` for alpha-tested shadows | **world code**: `alphaTest` on the surface material, which both renderers honour for shadows (R5 verifies parity before switching) |

The refactor must not add to this list; R1 freezes it as an arch allowlist that may only shrink.

## 6. Cost model

Assumptions are numbered so a slice can replace one with a measurement.

- **A1.** One Three.js WebGL draw call costs 5–20 µs of main-thread time on the reference laptop
  (matrix and uniform upload, state sort). Not measured here.
- **A2.** The display runs at 60 Hz (16.7 ms frame); 120 Hz doubles every per-frame figure.
- **A3.** Walls and ceilings cast shadows; each shadow update redraws every caster once per
  shadow-casting light (six times for a Point light).
- **A4.** A mounted Threlte mesh with its own geometry and material is 3 components; a
  `MuseumMaterial` adds at least one more.

### 6.1 Draw calls per rendered 3D frame, Layout only (counted, upper bound before culling)

`draws = W + 3R` (one per Wall; floor, floor-shadow, ceiling per Room).

| Grid | Walls | Room meshes | Colour draws | CPU at A1 |
| --- | --- | --- | --- | --- |
| M | 112 | 147 | 259 | 1.3–5.2 ms |
| L | 420 | 588 | 1,008 | 5.0–20.2 ms |
| XL | 840 | 1,200 | 2,040 | 10.2–40.8 ms |

The measured pan task (7.0 ms at M, 19.6 ms at L) sits inside the A1 band, which is consistent with a
draw-bound frame at L but does not prove it: the pan task also carries Plan and overlay work.

### 6.2 Frames at rest (PF-1)

Counted from the call chain: one render per display frame. Estimate at A2: 60 × 1,008 ≈ **60,000
draw calls per second at L with nothing changing**, plus 60 camera evaluations and 180 overlay array
reassignments per second. The correct figure is zero. With RR-8 active (any model plus any casting
light) each of those frames also redraws every shadow caster.

### 6.3 Candidate preview (PF-2)

Counted per tick while a Layout candidate is live: one whole-project compile (two for a 3D Opening),
one whole-project Plan evaluation, one whole-project Paper build — W wall compiles per tick, so
**6,720 wall compiles per second at M and 25,200 at L** at A2, for a pointer that may not be moving.
Cost per session-less compile after S06's indexing is **unknown**; Bench 1 measured 118 ms at L
before S06, and the incremental typed commit now costs 15.6 ms at L end to end. Estimate: a
session-less compile at L costs somewhere between those two, so one preview frame at L is likely
1–7× the frame budget. The measured drag (4.1–4.5 ms) is presumed to be a path that never reaches
`candidatePaper`; G1 confirms which gestures do.

### 6.4 Per-accept re-preparation (PF-3, PF-4)

For a Scene with E entities of which T hold a textured material, an accepted edit to **any** unit
costs today (counted): 1 Scene resolution over E entities, E material resolutions, E material-effect
reruns, up to T variant release/acquire pairs, 1 shadow re-render of every caster, 1 footprint
projection, 1 whole Paper build. After G2 an edit that does not touch Scene costs 0 of the first
five.

Estimate, conditional on the unknown in PF-4: if a released variant's GPU texture is deleted, each
re-acquire uploads it again — 5.6 MB for a 1024² RGBA texture with mipmaps, 22.4 MB at 2048². Twenty
unshared 1024² variants would be ≈110 MB of upload per accepted edit. G2 measures uploads before
anything is changed; if the count is zero the texture half of PF-4 is dropped.

### 6.5 Room surfaces (RR-1)

Counted at A4, per Room: 3 meshes, 3 geometries (2 distinct shapes, 3 triangulations), 3 materials,
≈10 mounted components.

| Grid | Components | Materials | Triangulations | After R3 (retained, shared) |
| --- | --- | --- | --- | --- |
| M | ≈490 | 147 | 147 | 0 components, 3 materials, 98 triangulations |
| L | ≈1,960 | 588 | 588 | 0 components, 3 materials, 392 triangulations |
| XL | ≈4,000 | 1,200 | 1,200 | 0 components, 3 materials, 800 triangulations |

Hypothesis H-R3: Room mounting is the largest remaining term in the 4.8 s render gap at L, because
it is the only world content still mounted per entity through Svelte, the cost class Bench 1 found
dominant. The gap's super-linearity is **unexplained** by a linear mount cost alone; R3 traces the
gap before building anything.

### 6.6 Scene resources (RR-3 to RR-6, RR-9)

Counted per entity today, and after describe-once sharing:

| Content | Geometries today | Materials today | After sharing |
| --- | --- | --- | --- |
| P primitives | P | P | ≤ 4 unit geometries; one material per distinct resolved look |
| F Form instances of k distinct forms | F | F | k geometries |
| N instances of a model with m meshes | shared | 2·N·m | m per distinct remap |
| A artworks of s distinct sizes | 4·A | 6·A | 1 plane + 3·s geometries; ≤ 4 materials + one per image |

A 32 × 24 sphere is 825 vertices, ≈35 kB of buffers; 100 spheres are 3.5 MB against 35 kB shared.
Memory is the smaller gain. The larger ones are structural: a dimension edit becomes a matrix write
instead of a buffer rebuild, identical looks stop multiplying material state changes, and repeated
content becomes eligible for instancing (R7) — none of which is possible while each component owns
its resources.

### 6.7 What the model cannot say

- The split of the open render gap and of the post-commit 100 ms.
- The cost of a session-less compile after S06.
- Whether texture variants are re-uploaded (PF-4).
- Draw and frame costs with real Scene content: no certified workload contains any.
- Whether draw calls or fill rate bound the L frame once rest frames are gone.

Each is the first step of the slice that depends on it.
