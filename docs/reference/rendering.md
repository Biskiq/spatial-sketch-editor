# Rendering — pipeline, resources and frame work

**Owns:** the world-rendering pipeline under `apps/editor/src/lib/render/` — layers, resource
ownership, render identity, portability, clip/shadow work and measurement policy. Layout and Scene
semantics stay with their contracts; rendering is a consumer and derives no architecture or Scene
semantics of its own. The Stage and visitor runtime draw world content through the same modules, so
editor and visitor cannot drift.

## Layers and direction

```text
Authored units        Layout · Scene · Camera · Experience
      │  one compiler; one Scene resolution, retained per unit
      ▼
Derived descriptions  CompiledLayoutGeometry · resolved Scene content
      │  frozen data, no Three
      ▼
Render descriptions   one frozen RenderItem per drawable; memoised by its source identity
      ▼
Render resources      per Canvas: MaterialStore · GeometryStore · LightStore · CasterChannel
      │               module-level: the texture pool
      ▼
Representations       Layout Walls/objects/Rooms · Scene entities/lights
      │               imperative Object3D graphs, mounted once, patched by item key
      ▼
Renderer              CanvasHost.svelte · one r187 WebGPURenderer (WebGPU/WebGL2)
                      on-demand frames · per-light shadow invalidation
```

Each layer reads only the layer above. `material-descriptor.ts` imports nothing; the material store
imports only Three and its descriptor; the texture store's module set is exact; the Scene
description is Three-free and store-free. Representations consume compiled output and stores — no
authored-unit reader, codec, compiler, session, adapter or project-model truth. The check follows
resolved paths and whole import closures, so a relative spelling or a barrel cannot carry a forbidden
edge. One exact visitor exception is permitted: `visitor/room-presentation.ts`.

## One renderer, one generation

`renderer-backend.ts` is the only construction site: one Three r187 `WebGPURenderer` per generation,
requesting native WebGPU with Three's own WebGL2 fallback, on the host's own DOM canvas. The Stage
keeps stencil, alpha, antialias, DPR 1–1.5 and the accepted `NoToneMapping` pipeline; the factory
names that pipeline once (`CANVAS_TONE_MAPPING`) and counts frames per surface.

`CanvasHost.svelte` makes the renderer usable before anything draws:

- `autoRender` stays false and children mount only after `renderer.init()` resolved;
- Threlte receives a ready-gated facade over the real renderer; shadow control and snapshots use the
  real object from `renderer-context.ts`;
- a fresh generation is a **new DOM canvas**, never a restored context, and a captured Stage gesture
  is cancelled through the pointer-cancel seam before its canvas leaves the page;
- a failed init or lost device retries on a fresh canvas — first WebGPU, then the WebGL2-compatible
  request; an exhausted episode shows an in-place unavailable state with Retry.

Camera poses remain Camera's: `camera-realization.ts` copies an evaluated pose onto the Three camera
at the renderer boundary, sets the coordinate system first (so r187 never recomputes the evaluated
projection), converts clip-space Z for native WebGPU and rebuilds the physical inverse.
`frame-scissor.ts` passes the capture frame as a top-left rectangle, the common convention on both
backends.

**Portability allowlist is empty.** Product code has no `onBeforeCompile`, `ShaderMaterial`,
`WebGLRenderTarget`, non-2D `getContext`, custom depth/distance material or WebGL-only Three import
path. The common line geometry and Three's webgpu fat-line objects are the backend-neutral survivors;
`renderer-backend.ts` is the one module that names a renderer. A new site fails, and so does a stale
entry, so the list only shrinks.

## Colour pipeline

Every world surface renders with `NoToneMapping` at exposure 1.0, sRGB output and an `srgb-linear`
working space, with `MeshLambertMaterial` as the artwork baseline. This is the accepted Gate A
decision and stands.

- The material store reads that record and sets no tone mapping, exposure or output colour space.
- `CANVAS_TONE_MAPPING` is named once and passed by the one shared Canvas host. That attribute is
  load-bearing: Threlte's Canvas assigns its own `AgXToneMapping` default to whatever factory it
  receives, so a host that omits the prop silently runs a rejected pipeline.
- Output colour space is Threlte's sRGB default; no Canvas overrides it. Stage, Visitor Preview and
  the published visit share one pipeline.
- **Colour versus data.** sRGB is decoded once for colour images and multiplied by the linear
  literal/resolved follower; raw data maps (normal, roughness, metalness, occlusion, ORM) stay
  linear. Byte 128 used simultaneously as a tint-free colour and as raw data reads approximately
  **0.216** and **0.502** respectively, in either load order.
- **Snapshot path.** Three renders a non-XR target in the linear working space whatever
  `texture.colorSpace` says, so `authoring/stage/snapshot-image.ts` maps every channel through the
  exact sRGB encode and flips WebGL's bottom-up rows before `putImageData`. Linear 55 (0.2157)
  becomes 128; linear 128 (0.502) becomes 188. The target stays 8-bit, so the fix costs no GPU memory
  and no extra draw. Nothing else may `putImageData` a render-target readback.
- **No per-material environment opt-out.** `envMapIntensity = 0` does not remove
  `scene.environment`: with no own `envMap`, r187 writes the intensity from
  `scene.environmentIntensity` and ignores the material field. A surface that must not receive the
  environment needs a material that does not sample it, or no `scene.environment`. The shipped app
  has no `scene.environment`; do not add one relying on a per-material opt-out.

## One material factory, one light realizer, one look resolver

- `MaterialStore.acquire(descriptor)` is the only place a world material is constructed. Equal
  descriptors share one instance; the store counts references and disposes at zero. Constructors are
  found through each module's import bindings, so an aliased class or namespace import is the same
  site. Editor ink — Paper lines, the mat grid, selection and gizmos — is not a world surface and
  stays outside the store on an exact allowlist. Model realization constructs no material, disposes
  nothing itself and never clones a material per instance.
- The Canvas `LightStore` is the only constructor of a world Point, Spot or Sun light. Host fills
  (ambient, the Sky's hemisphere, Paper's neutral rig), offscreen inspection fills and dev benches
  are counted per file on an exact, shrink-only allowlist. The Stage and Preview lease from the
  Canvas store.
- `materials/scene-instance-material.ts` resolves every Scene Finish for every surface: catalogue
  base, per-slot maps, colour literal or palette follower, roughness/metalness, mapping, normal
  scale/flip, then the World's Treatment. The resolved colour multiplies the colour map, so a
  catalogue or project map keeps its base tint (`wood-walnut` stays `#3d2a1a` over its map).
  `tileMeters` becomes UV repeat, `rotation` turns about the UV centre and `offset` shifts in tile
  fractions; all three are part of the texture variant identity, so two looks with different mapping
  never share a texture clone. A primitive's repeat surface is its authored face size **times the
  entity's uniform scale**; Forms use metre UVs and models keep their own. Under Flat colour an image
  Finish keeps its authored colour field (white for an untinted image) and drops its base map. Natural
  adds nothing to `variantSeed`; Flat colour and Clay change resolved values, drop every map and
  select a different variant. The Stage, Visitor Preview and published visit run this one resolver
  over the same `RuntimeScene`.
- The Finish Card previews through the same resolver: `withFinishInstancePreview` adds one synthetic
  instance (`FINISH_PREVIEW_INSTANCE_ID`), points every reached object and surface at it, and changes
  no accepted bytes, history or planner allocation. Releasing, cancelling or accepting drops the
  preview, so the rendered Scene is exactly the accepted one.
- **Treatment** runs last in the resolver and never writes the document. `flat-colour` drops maps,
  keeps the resolved colour and raises roughness to at least `FLAT_MIN_ROUGHNESS` (0.6) with metalness
  0; `clay` uses `CLAY_COLOR = '#d6d3cd'` and `CLAY_ROUGHNESS = 0.9`. Constants are frozen: a
  release renders through current code, so a new look needs a new Treatment id, never a retuned
  constant. Treatment reaches primitives, Forms, remapped models, imported models that keep their own
  materials, and default Layout floors/ceilings/walls; it never reaches Artwork, the Sky, authored
  lights, the ground/plinth, door frames or editor marks. A model remap keeps the model's UVs, so it
  ignores `mapping` but keeps normal strength and flip.
- Imported models: `ImportedMaterialDescriptor.treatment` is read only when the model keeps its own
  material. `constructImported` clones the source and tunes it in place; every appearance map is
  suppressed, while `displacementMap`, `alphaMap` and an alpha-carrying base colour map survive with
  transparency, opacity, alpha test, side, depth flags, vertex colours and skinning. A
  colour-tunable non-PBR class (`MeshBasicMaterial`) takes colour only; Shader/RawShader/Normal/Matcap
  materials stay as authored and are counted in `stats().treatmentSkipped`. With no `treatment`, the
  imported key, clone and lease counts match Natural exactly.
- Wall and Room representations expose `setTreatment`: Walls swap materials only — each retained mesh
  keeps object and buffers, re-resolves one material per compiled surface group, then releases
  superseded leases; Rooms take new floor/ceiling leases, assign them to retained meshes and release
  the old ones. No shared material is mutated in place and no Wall geometry is rebuilt.

**Tangent frames.** A normal map is unpacked to tangent space, XY strength and exactly one Y sign
are applied, then the vector is normalized into view space. For untransformed mesh UV0 with valid
tangents and handedness, use them. For transformed UVs, UV1 or absent tangents, derive the frame
from view-position derivatives and the selected **transformed** UV before wrapping, with the image
origin convention accounted for; r187's default derivative frame reads UV0, so an unqualified use
rotates the normal around the wrong frame. Guard a zero-length tangent/normal and a near-singular
frame before normalization, and use the geometric normal for an isolated degenerate fragment.

**Sky and fog.** The Stage, Preview and published visit share `WorldEnvironment` and `resolveSkyLook`.
Time, noon heading and noon height determine Sun position from 06:30 to 19:30 and Moon from 21:00 to
04:30; dusk/dawn hold the boundary bearing with zero direct intensity. One directional lease serves
both bodies. Sun shadows applies to that lease at all hours; softness sets radius to
`1 + 4·softness` shadow-map texels. The Sky background uses one reusable cube texture with a
world-bearing twilight glow; exposure scales sky lights by `2^EV`. Haze uses `FogExp2` with the
horizon colour and density `√(ln 50)/visibility`, where
`visibility = 20000·(60/20000)^(haze/100)` metres. At haze zero density is zero and the fog object
stays mounted. World materials receive fog; background and editor marks, grids and ghosts stay clear.

## Owned render identity and retained representations

Rendered objects are found by owned identity, never by name: each representation's `objectOf(id)`
index and the `userData` identity tag are the only functional channels. Product code never calls
`getObjectByName`/`getObjectByProperty('name', …)` and never parses a debug name. Names stay for
debugging only. Instancing or batching stays behind `objectOf`.

A representation mounts one root for its lifetime, diffs item keys on `update`, acquires and releases
through the stores, and reports built/retained/released counts; those counts are the test oracle. It
never creates geometry or material outside the stores and never disposes a borrowed resource.
Primitives, Forms, Artwork and models draw through `createSceneEntityRepresentation`; authored lights
through `createSceneLightRepresentation`; Layout through the Wall, object and Room representations.
Exactly one path draws any entity. A render refactor shows structural parity (ids, world matrices,
vertices, material properties) against the path it replaces before merging.

**Per-Canvas resources.** WebGL objects cannot be shared across contexts, so materials, geometry,
lights and the caster channel exist once per Canvas. Teardown invalidates pending async callbacks,
releases family leases, then disposes the stores; disposal is idempotent in either order. Texture
sources and variants are the one ratified exception: a single shared, module-level pool keyed by
`TextureLoadScope`, not a per-Canvas store. It is correct across Canvases because Three uploads a
shared `Texture` separately into each renderer; disposing a variant releases every renderer's copy.
A variant whose count reaches zero is disposed at the next idle point (a microtask after the releasing
update), so a release-then-reacquire inside one update never deletes a GPU texture.

## Texture resources

- One shared source entry per load scope and URI; one `TexImage2D` upload per source, with variants
  keyed by resolved mapping. A source keeps its decoded dimensions, typed error and generation;
  scope epoch, request serial and canvas generation travel with every async completion. One waiter's
  cancellation releases only its interest; shared IO is cancelled when its final waiter leaves. Late
  installs are rejected, decoded bitmaps close after their final owner, transient object URLs are
  revoked, and leases are idempotent.
- **Residency accounting.** Reserve exact uncompressed RGBA8 mip bytes (the sum of actual levels)
  before upload. The Finish-view ceiling is **256 MiB** (`DEFAULT_FINISH_VIEW_BUDGET_BYTES`; a
  measured gate may adopt a smaller one). Evict unleased views oldest-first, tie-breaking by key,
  and never evict a referenced view. If a requested full binding set cannot fit after eviction,
  release partial reservations and return `texture-budget` with required/available bytes; a retry
  after a working-set change is permitted. Preflight a complete set together so two builds cannot
  each wait on the other's partial reservations. GPU residency is accounted per generation.
  Separately report compressed-source and decoded-CPU peaks and release them at scope teardown.
- A pending or failed acquisition shows the resolved constant factors and a scoped diagnostic.
  Replace the surface only when the entire required set is ready; exclude that provisional draw from
  first-correct timing, thumbnail success and delivery acceptance.
- Curated and Finish images use their pins; a failed or tampered image falls back to the Finish
  colour, and a targeted Retry invalidates only that URI. Uploads build a full mip chain and sample
  with linear magnification, trilinear minification and anisotropy 1.

## One clip seam (a Slice)

A Slice's cut is display geometry: it changes no document, material or draw-list membership.
`createStageClip()` owns the one `clippingPlanes` array the renderer reads, and `StageCanvas` creates
it **before** it provides render resources, so the material store is born holding that exact array by
reference. The array always holds **two** planes, entered/dragged/left without replacement: the upper
keeps `y ≤ cutY` (normal `(0,−1,0)`, constant `+cutY`); the lower keeps `y ≥ lowerY` (normal
`(0,1,0)`, constant `−lowerY`) and parks at its keep-all constant when depth is infinite. The GPU
therefore clips at exactly `cutY`, with no offset folded into a constant and no single-plane special
case. `StageClipPlanes` is the one writer: it applies the resolved reading and asks for a frame,
which also repaints after Put back while the ink layer is unmounted.

TSL `render/clip/slice-clip-mask.ts` builds the drawn cut and X2's cutaway top as one `maskNode`
graph from shared `uniform()` nodes; a material carries a pass-through `maskShadowNode`, so shadows
still render from the unclipped world. Editing a cut writes uniforms only — no program rebuild, no
GLSL and no `onBeforeCompile`.

No other component creates clipping planes. The Stage's ink joins that owner: selection contours and
the Lift outline hold the Canvas's array by reference, so a gold contour or dashed lid is cut with
the body it stands for. The one exemption is a selected subject the cut hides wholly — it is drawn as
an unclipped ghost with an uncut gold contour, because a selection reachable from the Index must stay
visible.

A saved or shared image is the building, not the author's current cut: `asBuilt(render)` parks each
plane in place at its keep-all value for the snapshot and writes live constants back in `finally` —
re-entrant and exception safe. It never swaps the array, which would break every material's shared
reference and force the recompile the constant plane count exists to avoid. Three r187 clips shadow
casters only when their material sets `clipShadows`; the Stage's materials never do, so a cut never
hollows a cast shadow.

A cap is **never built on a drag frame**: the plane and clipping move for free, and the section waits
for the Sheet to rest (`slice-cap-schedule.ts`, 120 ms after the last change). One assembly is ~30 ms
against the 4 ms budget on an eleven-Room fixture, so per-frame assembly would drop frames for the
whole drag; a build over 4 ms logs its timing in development. Caps come from **Layout meshes only**:
one union for Walls, one group per Layout object; Scene models are clipped and never capped, and a
floor is never a cap source. A group that fails to balance is drawn open and reported — one
`console.error` per group per geometry revision, plus `window.__STAGE_SLICE_DIAGNOSTICS__` in
development.

**Lifted layer.** Layer 0 is world content, layer 2 is editor ink on the overlay, and layer 3 is
**lifted** — a Room's generated overhead while a Lift reading holds it out of the view, pointer and
every snapshot. Lift never writes `Object3D.visible`: the representation moves the lid to layer 3,
and the shadow pass sees it only when a light's shadow camera asks for that layer, so the visitor
canvas draws the project as built. A lifted overhead sits on `LIFTED_RENDER_LAYER`; the first PR that
makes any overhead cast enables that layer on every light-store shadow camera, and
`lift-shadow-eligibility.test.ts` refuses it otherwise.

## On-demand frames and shadows

The Stage renders on demand: a settled Stage renders zero frames, and each relevant input change asks
for exactly one. Shadow maps keep `autoUpdate = false` and re-render only when a dependency changes:
compiled geometry, accepted Scene caster content, a light preview, a model's arrival/release on the
caster channel, a fresh or restored context. A Sun/Moon shadow-camera change refreshes one
directional map. Haze, exposure, colour, Moon strength and softness use existing maps during preview
and after acceptance. An orbit, hover or selection renders no shadow pass. An animated caster
refreshes its map while playing.

**Visitor first frame.** Visitor Preview records `visitor:mounted`, the two-rAF
`visitor:entry-frame` proxy, and Gate C's `visitor:first-frame` after the renderer's own
`info.render.frame` counter advances. It is inert unless performance marks are enabled. It is a
renderer-observed frame, not a physical scanout proof. Do not rename or remove `entry-frame`; the
published-welcome path uses the same marks.

### D9 — reference-laptop shadow budget (proposed, not in force)

**Status: proposed 2026-11-15 by Gate C; not in force until the owner adopts it.** S0 Gate C's 19-run
bounded bench is owner-authorised historical evidence; it did not run `perf:spot` or `npm run perf`
and creates no scheduled gate. The method, numbers and limitations are in the
[S0 Gate C report](../../broad-research/t2-s0-rendering-gate/report.md).

On the measured reference laptop (Apple M2, ANGLE Metal, Chrome 153, 1280 × 720, DPR 1) the Stage
rendered **zero shadow maps per frame** during a 600-frame orbit in all three reference Worlds; the
Visitor rendered **one shadow map per frame**. On the gallery visit, turning the sun's shadow off
removed at least 10 draw calls, 1,228 triangles, two allocated textures and one additional compiled
program, without moving p95 (17.70 ms both ways): the laptop is vsync-bound at 60 Hz, so frame
interval alone does not expose shadow cost. `renderer.info.memory.textures` counts allocated textures,
not per-frame bindings; `renderer.info.programs.length` counts compiled programs, not per-frame binds.

- **Measured baseline:** one shadow-casting Sun, one **2048 × 2048** `PCFShadowMap`, radius 3,
  `normalBias` 0.02 on the visitor path and 0.05 on the flat Stage plate; **1 map per frame on the
  visit**, **0 maps per frame on the Stage** while the camera moves.
- **Approved controls stay live.** T2 approves a Shadow control on Spot and Directional, and on Point
  with Shadow off by default. D9 must not disable, hide or auto-change them; additional Spot/Point
  casters are contract-valid and must not become inert. The earlier proposal to refuse a second
  caster or a shadow-casting Point is withdrawn.
- **Proposed per-caster budget:** one 2048² PCF map per shadow-casting Directional or Spot; a
  shadow-casting Point uses six cube faces/maps. Visit: one map per enabled caster per frame, except
  the Point cube's six faces. Stage: zero per frame while the camera moves. The one-Sun World is the
  only measured total; multi-caster totals are **unmeasured**, and D9 invents no maximum caster count
  or multi-caster frame cost.
- **Unresolved owner policy:** (1) measure additional Spot/Point casters on the same Worlds before
  promising a total budget (recommended); (2) set a maximum simultaneous map/caster count with a
  visible refusal/notification state, never an inert control; or (3) ship the controls with
  multi-caster cost marked unmeasured and no "budgeted" claim.
- **Frame targets:** Stage drag p95 ≤ 2 display periods (33.3 ms) and gallery visit p95 ≤ 33 ms were
  met at 17.6–17.7 ms. Visitor idle retains p95 ≤ 1 display period (16.7 ms) as **aspirational**;
  the proposed allowance is 1.1 display periods (~18.3 ms) p95. The measured 17.6–17.7 ms is within
  the allowance and misses the aspirational target. p50 is 16.70 ms; the difference is scheduler
  jitter, not scene cost.
- **Refusal rule:** a map larger than 2048², cascaded shadow maps, a baked/cached shadow architecture,
  a per-frame shadow update on the Stage, and any silent runtime map-size reduction, shadow
  disablement or light cap remain refused. These are architecture/quality limits, not the approved
  Spot/Point controls. D9 is a map/pass and draw-work budget, not a GPU-time cap; phone-class hardware
  remains **unmeasured**.

## Measurement policy

**The mandatory performance-benchmarking strategy is suspended indefinitely.** No formal
F2/F3/F4/F8/F13 matrix, battery-mode certification or full `npm run perf` workflow may run as an
acceptance prerequisite on an ordinary slice, phase or final gate. Performance investigations are
**owner-initiated only**, triggered by an observed slowdown. Existing measurements are historical
evidence, not mandatory prerequisites, and an unmeasured row stays **unmeasured**, never a pass.

`npm run perf:spot` is the bounded workflow. It is permitted at four triggers: Core Editor Stability
integrated acceptance when that plan's owner approves the check, a significant editor hot-path
integration checkpoint, an owner-observed slowdown, and an editor release candidate after substantial
relevant change. There is no scheduled CI battery and no per-slice performance gate. It measures
`grid-M` and `grid-L` only; M is judged smooth against the measured display period and L may lag but
must stay usable. Imported GLBs and texture-heavy Scene composition are outside those grids and stay
uncertified. `npm run perf` refuses; it does not launch the former multi-hour suite.

The runner starts with four observations and extends append-only to eight within a gesture only on a
label margin; at most three sessions follow its margin/disagreement rules. Target 3–5 minutes, with
ambiguous runs capped around 10 minutes. Retain every observation and outlier; summarize
conservatively. There is no automatic contamination retry. M smoothness requires editor time,
presentation delay and frame intervals to match the measured display period. L may lag, including
stable half-rate, but remains usable and correct: its one-shot typed-commit matching presentation
allowance is **200 ms**; continuous drag/pan retains the two-frame expectation. M keeps its stricter
near-frame commit rule. Report editor, matching-render and presentation clocks separately, with
operation-matched acceptance and verified preview provenance. The
[runner method](../../apps/editor/perf/README.md) owns reproducible commands and thresholds. No stress
workloads, cache matrices, leak loops, CPU-throttle search, traces or screenshot quotas are
prerequisites of this bounded workflow.

Editor and viewer must remain useful on a regular laptop. Resolve demonstrated material costs inside
their consuming slices while preserving expressive architecture, correctness and one canonical
authority. Measurements cover cold and repeated use, realistic project sizes and complete presented
results, not isolated kernel time or a quick acknowledgement. Historical build/Node measurements
remain in the
[research packet](../../broad-research/archive-harvest/performance/performance-method.md), never
current acceptance prerequisites.

## Hard don'ts

A second `WebGLRenderer`/WebGPU construction site · a second material or light constructor · name-based
render lookup · a per-mode texture store · a second clipping-plane owner · a per-frame shadow update
on the Stage · a cap built during a drag · a renderer dependency that changes the named pipeline
silently · treating `envMapIntensity = 0` as an environment opt-out · persisting renderer state or
reverse-engineering topology from buffers.
