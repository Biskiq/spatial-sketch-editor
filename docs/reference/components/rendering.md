# Rendering

**Owns:** the world-rendering pipeline under `apps/editor/src/lib/render/` — its layers, resource
ownership, render identity, portability and frame/shadow work — and the guard that holds each rule.
Layout and Scene semantics stay with the [Layout](./layout.md) and [Scene content](./scene-content.md)
contracts; measurement policy stays with [Performance](./performance.md).

Rendering is a consumer: it reads the one compiler's output and the one Scene resolution and
derives no architecture or Scene semantics of its own (hard rule 6). The Stage and the visitor
runtime draw world content through the same modules, so editor and visitor cannot drift.

## Layers

```text
Authored units        Layout 9 · Scene 12 · Camera · Experience
      │  one compiler; one Scene resolution, retained per unit
      ▼
Derived descriptions  CompiledLayoutGeometry · resolved Scene content
      │  frozen data, no Three
      ▼
Render descriptions   one frozen RenderItem per drawable (scene-render-description.ts,
      │               scene-light-description.ts); memoised by the identity they derive from
      ▼
Render resources      per Canvas: MaterialStore · GeometryStore · LightStore · CasterChannel
      │               (render-resources.ts); module-level: the texture pool (texture-store.ts)
      ▼
Representations       Layout Walls, objects, Rooms · Scene entities · Scene lights
      │               imperative Object3D graphs, mounted once and patched by item key
      ▼
Renderer              CanvasHost.svelte · one r187 WebGPURenderer (WebGPU/WebGL2) ·
                      on-demand frames · per-light shadow invalidation
```

The Canvas host — the shared `CanvasHost.svelte`, mounted by `StageCanvas.svelte`, `VisitorPreviewSurface.svelte`
and the published visit — owns the one stock Threlte `<Canvas>` and calls `provideRenderResources()`
once; everything mounted under it leases from those stores. The snapshot renderer draws the Stage's
own scene with the Stage's renderer into an offscreen `RenderTarget`, so it never creates a second
context or store set.

### One renderer, one generation

`renderer-backend.ts` is the only construction site: one Three r187 `WebGPURenderer` per generation,
requesting native WebGPU with Three's own WebGL2 fallback, on the host's own DOM canvas. The Stage
keeps stencil, alpha, antialias, DPR 1–1.5 and the accepted `NoToneMapping` pipeline; the factory
names that pipeline once (`CANVAS_TONE_MAPPING`) and counts frames per surface.

`CanvasHost.svelte` makes the renderer usable before anything draws:

- `autoRender` stays false and children mount only after `renderer.init()` resolved, so no task,
camera copy or texture lease runs against a half-built renderer;
- Threlte receives a ready-gated facade over the real renderer; the shadow controller and snapshots
use the real object from `renderer-context.ts`;
- a fresh generation is a **new DOM canvas**, never a restored context, and a captured Stage gesture
is cancelled through the pointer-cancel seam before its canvas leaves the page;
- a failed init or a lost device retries on a fresh canvas, first with WebGPU and then with the
WebGL2-compatible request; an exhausted episode shows an in-place unavailable state with Retry.

Camera poses remain the Camera authority's: `camera-realization.ts` copies an evaluated pose onto the
Three camera at the renderer boundary, sets the camera's coordinate system first (so r187 never
recomputes the evaluated projection), converts clip-space Z for native WebGPU and rebuilds the
physical inverse. `frame-scissor.ts` hands the capture frame through as a top-left rectangle, which
is the common renderer's convention on both backends.

### Clipping and shadows

A Slice is one TSL predicate. Native `Plane`s still realize the Level reading as two clipping-plane
slots, while a drawn cut and X2's cutaway top are one `maskNode` graph built from shared `uniform()`
nodes (`render/clip/slice-clip-mask.ts`); a material carries a pass-through `maskShadowNode`, so
shadows render from the unclipped world. The material store attaches that graph once per material, so
editing a cut only writes uniforms — no program rebuilds, no GLSL and no `onBeforeCompile`.

Shadow invalidation is per light: `ShadowNode` reads each caster's `shadow.autoUpdate` /
`shadow.needsUpdate`, and `shadow-invalidation.ts` owns that decision (geometry, Scene, model
arrival/release, Sun direction, a playing animation, a fresh generation) while wrapping the real
renderer's `render` for the count oracle.

Snapshots are as-built: the Stage clip parks its planes and mask values for the draw, the camera is
the shared realization at the authored pose, and the readback is a generic 8-bit target read with
`readRenderTargetPixelsAsync`; rows are normalized to top-down per backend and encoded to sRGB once.

The per-object layers are the Stage camera's contract: layer 0 is world content, layer 2 is editor
ink on the overlay (the selection contour, and Lift's dashed outline and ghost), and layer 3 is
**lifted** — a Room's generated overhead while a Lift reading holds it out of the view, the pointer
and every snapshot. Lift never writes `Object3D.visible`: the representation moves the lid to layer
3, and the shadow pass sees it only when a light's own shadow camera asks for that layer (r187's
rule), so the visitor canvas draws the project as built. A lifted overhead sits on
`LIFTED_RENDER_LAYER`; the PR that first makes any overhead cast enables that layer on every
light-store shadow camera, and `lift-shadow-eligibility.test.ts` refuses it otherwise.

## Rules and their guards

Each rule is held by the named test under `apps/editor/tests/lib/`. Guards in the unconditional
architecture lane are listed in `apps/editor/test-lanes.ts` (`ARCH_FILES`).

### Layer direction

Each layer reads only the layer above it. `material-descriptor.ts` imports nothing; the material
store imports only Three and its descriptor; the texture store's module set is exact; the Scene
description is Three-free and store-free. Representations consume compiled output and stores: no
authored-unit reader, codec, compiler, session, adapter or project-model truth. The check follows
resolved paths and whole import closures, so a relative spelling or a barrel cannot carry a
forbidden edge. One exact visitor exception is permitted: `visitor/room-presentation.ts`.

**Guards:** `render/render-layer-boundary` (descriptor → store → representation for lights is also
pinned by `render/light-realizer-boundary`).

### One material factory

`MaterialStore.acquire(descriptor)` is the only place a world material is constructed. Equal
descriptors share one instance; the store counts references and disposes at zero. Constructors are
found through each module's import bindings, so an aliased class or namespace import is the same
site. Editor ink — Paper lines, the mat grid, selection and gizmos — is not a world surface and stays
outside the store on an exact allowlist. Model realization constructs no material, disposes nothing
itself and never clones a material per instance.

**Guards:** `render/material-factory-boundary`, `render/model-lifecycle-boundary`.

### One light realizer

The Canvas `LightStore` is the only constructor of a world Point, Spot or Sun light. Host fills
(ambient, the Sky's hemisphere, Paper's neutral rig), the offscreen inspection fills and dev
benches are counted per file on an exact,
shrink-only allowlist. The Stage and the Preview lease from the Canvas store.

**Guard:** `render/light-realizer-boundary`.

### Material inspection

`materials/inspection-host.ts` draws Finish inspections and thumbnails offscreen on the editor's own
renderer, one host per editor; today `/dev/materials` mounts it. A subject is a catalogue entry, an
accepted project Finish or an unaccepted draft, and each resolves through `sceneFinishFor`. Materials
and lights come from the Canvas stores; a draft's images load only through its own memory scope. A
descriptor with `clip: false` keeps the Stage Slice out of a swatch.

- A request names any size up to the 2048 readback bound, one geometry (sphere, plane or block), a
  lighting (studio, grazing or Current World) and a display (lit, unlit colour or one solo role).
- States are `pending`, `ready`, `partial` with issues and `refused` with issues and no frame.
- One render lane serves the interactive request before queued thumbnails. Replacement cancels the
  older request, a settled request draws nothing, and a draw's leases end with its readback.
- Only `ready` enters the bounded thumbnail cache, namespaced by catalogue or project scope. Its key
  covers the resolved recipe, output dimensions, geometry and recipe versions. Draft and Current
  World results never enter it.
- Losing the renderer cancels work and drops its GPU caches; live work resumes on the next
  generation.
- Current World uses the Stage's Sky, lights, Treatment and neutral constants
  (`stage-neutral-lighting.ts`) at an explicit anchor. It has no other geometry, cast shadows or fog.
- The studio environment exists only in the offscreen inspection scene and never lights the World.
- Inspection and thumbnail lookup stay outside visitor, public and Preview closures.

**Guards:** `render/materials/inspection-host`, `render/materials/inspection-subject`,
`render/materials/catalogue-thumbnails`, `authoring/f4-public-isolation`,
`render/light-realizer-boundary`.

### One look resolver

`materials/scene-instance-material.ts` resolves every Scene Finish for every surface: the catalogue
base, then per-slot `maps`, the colour literal or palette follower, roughness/metalness, `mapping`,
normal scale/flip, and finally the World's Treatment. The resolved colour multiplies the colour map,
so a catalogue or project map keeps its base tint (`wood-walnut` stays `#3d2a1a` over its map).
`tileMeters` becomes UV repeat, `rotation` turns about the UV centre and `offset` shifts in tile
fractions; all three are part of the texture variant identity, so two looks with different mapping
never share a texture clone. A primitive's repeat surface is its authored face size **times the
entity's uniform scale** (D1), so a curated tile keeps its metre size when the object is scaled;
Forms use their metre UVs and models keep their own UVs. Under Flat colour an image Finish keeps its
authored colour field (white for an untinted image) and drops its base map: Q7 is closed, so no
average colour is decoded and the resolver stays synchronous. Palette adoption skips image tints for
the same reason — the tint modulates a picture rather than naming a surface. Natural adds nothing to
`variantSeed`;
Flat colour and Clay change the
resolved values, drop every map and therefore select a different variant. The Stage, Visitor Preview
and a published visit run this one resolver over the same `RuntimeScene`, so their descriptors cannot
drift.

The Card's colour picker previews through the same resolver: `withFinishPreviews`
adds one synthetic instance per previewed object and changes no accepted bytes, no
history and no planner allocation. Releasing the pointer, cancelling or accepting
drops the map, so the rendered Scene is exactly the accepted one again.

**Guards:** `materials/scene-instance-material`, `materials/look-parity-golden`.

The Stage, Preview and published visit share `WorldEnvironment` and `resolveSkyLook`.
Time, noon heading and noon height determine Sun position from 06:30 to 19:30 and Moon
position from 21:00 to 04:30. Dusk and dawn hold the boundary bearing with zero direct
intensity. A single directional lease serves both bodies. **Sun shadows** applies to that
lease at all hours, and softness sets the radius to `1 + 4·softness` shadow-map texels.

The Sky background uses one reusable cube texture with a world-bearing twilight glow.
Exposure scales the Sky lights by `2^EV`. Haze uses `FogExp2` with the horizon colour and
density `√(ln 50)/visibility`, where `visibility = 20000·(60/20000)^(haze/100)` metres.
At haze zero the density is zero and the fog object remains mounted. World materials
receive fog. The background and editor-only marks, grids and ghosts stay clear. Studio
uses the neutral rig. Stage gestures render through the live preview. Snapshots, Visitor
Preview and published visits read the accepted Sky.

**Treatment** runs last inside the one resolver and never writes the document:

| Treatment | Maps | Colour | Roughness | Metalness |
| --- | --- | --- | --- | --- |
| Natural (absent) | as resolved | as resolved | as resolved | as resolved |
| `flat-colour` | none | resolved factor | `max(r, FLAT_MIN_ROUGHNESS)` | 0 |
| `clay` | none | `CLAY_COLOR` | `CLAY_ROUGHNESS` | 0 |

The constants live in `render/materials/treatment.ts` (`FLAT_MIN_ROUGHNESS = 0.6`,
`CLAY_COLOR = '#d6d3cd'`, `CLAY_ROUGHNESS = 0.9`) and are **frozen**: a release renders through
current code, so changing a look needs a new Treatment id, never a retuned constant.

Treatment reaches every drawn world surface except content and light: primitives, forms, models
remapped by a Finish, **imported models that keep their own materials**, and the **default Layout
floors, ceilings and walls**. Artwork, the Sky, authored lights, the ground/plinth, door frames and
editor marks are not treated. A model remap keeps the model's own UVs, so it ignores `mapping` but
keeps normal strength and flip.

The Wall and Room representations expose `setTreatment`. Walls take a **material-only swap**: each
retained mesh keeps its object and buffers, re-resolves one material per compiled surface group
from the new factory, and only then releases the superseded leases. Rooms take new floor/ceiling
leases, assign them to the retained meshes and release the old ones. No shared material is mutated
in place and no Wall geometry is rebuilt, so changing a Look costs materials, not a rebuild, and a
Stage, Visitor Preview and published visit keep the same structure and cannot disagree.

**Imported models.** `ImportedMaterialDescriptor.treatment` is read only when the model keeps its
own material (no remap). `constructImported` remains the one path: the store clones the source and
tunes it in place. Clay sets `CLAY_COLOR`/`CLAY_ROUGHNESS`; Flat colour keeps the authored colour
and raises roughness to at least `FLAT_MIN_ROUGHNESS`; both set metalness and emissive to 0. Every
appearance map is suppressed (normal, bump, roughness, metalness, AO, emissive, light, specular,
clearcoat, sheen, transmission, thickness, iridescence, anisotropy). Only maps that carry geometry
or alpha survive: `displacementMap`, `alphaMap`, and the base colour map when `alphaTest > 0` or the
material is transparent. Transparency, opacity, alpha test, side, depth flags, vertex colours and
skinning all survive, and the clone leaves the asset's own material untouched, so an alpha-masked
silhouette is exactly as authored. A colour-tunable but non-PBR class
(`MeshBasicMaterial`) takes the colour only. Shader, RawShader, Normal and Matcap materials cannot
take a colour and stay as authored; the store counts them in `stats().treatmentSkipped`. With no
`treatment` the imported key, clone and lease counts are exactly Natural's, which the regression
pins.

### Owned render identity

Rendered objects are found by owned identity, never by name: each representation's `objectOf(id)`
index and the `userData` identity tag are the only functional channels. Product code never calls
`getObjectByName` or `getObjectByProperty('name', …)` and never parses a debug name. Names stay on
objects for debugging only. When instancing or batching is introduced, it stays behind `objectOf`.

**Guards:** `render/render-identity-boundary`, `render/render-identity-consumers`.

### Retained representations

A representation mounts one root for its lifetime, diffs item keys on `update`, acquires and
releases through the stores, and reports built / retained / released counts; those counts are the
test oracle. It never creates geometry or material outside the stores and never disposes a borrowed
resource. Primitives, forms, artwork and models draw through `createSceneEntityRepresentation`;
authored lights through `createSceneLightRepresentation`; the Layout through the Wall, object and
Room representations. Exactly one path draws any entity. A render refactor shows structural parity
(ids, world matrices, vertices, material properties) against the path it replaces before it merges.

**Guards:** the representation suites under `render/` (counts and parity, including
`render/scene-geometry-parity`), `render/model-lifecycle-boundary`,
`render/layout/wall-mesh-shell-boundary`.

### Per-Canvas resources

WebGL objects cannot be shared across contexts, so materials, geometry, lights and the caster
channel exist once per Canvas. Teardown invalidates pending async callbacks, releases family leases,
then disposes the stores; disposal is idempotent in either order.

Texture sources and variants are the one ratified exception: a single shared, module-level pool
keyed by load scope (`TextureLoadScope`), not a per-Canvas store (owner ruling, E12). It is correct
across Canvases because Three uploads a shared `Texture` separately into each renderer; disposing a
variant releases every renderer's copy. A variant whose count reaches zero is disposed at the next
idle point (a microtask after the update that released it), so a release-then-reacquire inside one
update never deletes a GPU texture. Consumers (the Scene entity representation and
`CatalogueMaterial`) acquire and release variants through the pool's functions; the pool owns
their disposal.

**Guards:** `render/material-factory-boundary` (the Canvas owns the one store),
`render/light-realizer-boundary`, `render/materials/catalogue-material-lifecycle` (deferred variant
release).

### Portability allowlist

World code uses built-in Three material classes and standard properties; the common renderer honours
them on both backends, and every backend-specific site is now gone. The exact allowlist is **empty**:
product code has no `onBeforeCompile`, `ShaderMaterial`, `WebGLRenderTarget`, non-2D `getContext`,
custom depth or distance material, and no WebGL-only Three import path. The common line geometry and
Three's webgpu fat-line objects are the backend-neutral survivors; `renderer-backend.ts` is the one
module that names a renderer. A new site fails, and so does a stale entry, so the list only shrinks.

**Guard:** `render/renderer-portability-boundary`.

### One clip seam (a Slice)

A Slice's cut is display geometry: it changes no document, no material and no draw list membership.
`createStageClip()` owns the one `clippingPlanes` array the renderer reads, and `StageCanvas` creates
it **before** it provides the render resources, so the material store is born holding that exact array
by reference. The array always holds **two** planes, entered, dragged and left without a replacement:
the upper keeps `y ≤ cutY` (`normal (0,−1,0)`, `constant +cutY`) and the lower keeps `y ≥ lowerY`
(`normal (0,1,0)`, `constant −lowerY`); with no finite depth the lower is parked at its keep-all
constant. The GPU therefore clips at exactly `cutY` — there is no offset folded into a constant, and
no single-plane special case. `StageClipPlanes`, mounted inside the Canvas, is the one writer: it
applies the resolved reading and asks for a frame, which is also what repaints after Put back while
the ink layer is unmounted.

No other component creates clipping planes, so "the cut is on" has exactly one owner. The Stage's own
ink joins that owner rather than having its own: the selection contours and the Lift outline hold the
Canvas's array by reference, so a gold contour or a dashed lid is cut with the body it stands for. The
one exemption is a selected subject the cut hides wholly — it is drawn as an unclipped ghost, and its
gold contour is deliberately left uncut, because a selection the creator can reach from the Index must
stay visible.

The snapshot pass must not inherit it: a saved or shared image is the building, not the author's
current cut. `asBuilt(render)` **parks each plane in place** at its keep-all value for the duration of
the snapshot and writes the live constants back in `finally` — re-entrant and exception safe. It never
swaps the array: a different array would break every material's shared reference and force the
recompile the constant plane count exists to avoid.

**Guard:** `authoring/stage/slice/stage-clip`, `stage-clip-shadows` and the real-WebGL regression in
`perf/flows/stage-clip.spec.ts`. three r187 clips shadow casters only when their material sets
`clipShadows`; the Stage's materials never do, so a cut never hollows a cast shadow, and the
regression pins the shadow pass as identical cut and put back. A cap is **never built on a drag
frame**: the plane and the clipping move for free (they are the plane array), and the section waits
for the Sheet to rest (`slice-cap-schedule.ts`, 120 ms after the last change). Measured on an
eleven-Room fixture one assembly is ~30 ms against the 4 ms budget, so assembling per frame would
drop frames for the whole drag; the figure and the profile belong to that file's measurement test,
and a build over 4 ms logs its timing in development.
Caps come from **Layout meshes only**, one union for the Walls and one group per Layout object; Scene
models are clipped and never capped, and a floor is never a cap source. A group that fails to balance
is drawn open and reported: one `console.error` per group per geometry revision, plus
`window.__STAGE_SLICE_DIAGNOSTICS__` in a development build.

### On-demand frames and shadow invalidation

The Stage renders on demand: a settled Stage renders zero frames, and each relevant input change asks
for exactly one. Shadow maps keep `autoUpdate = false` and re-render only when something they depend
on changes. Inputs include compiled geometry, accepted Scene caster content, a light preview, a
model's arrival or release on the caster channel, and a fresh or restored context. A Sun or Moon
shadow-camera change refreshes one directional map. Haze, exposure, colour, Moon strength and
softness use the existing maps during preview and after acceptance. An orbit, hover or selection
renders no shadow pass. An animated caster refreshes its map while playing.

Gate C measured this contract on the reference laptop: **0 shadow maps per frame** in a 600-frame
Stage orbit across the empty, small-room and gallery Worlds, and **1 map per frame** on the visitor
path. The proposed D9 budget preserves that measured one-Sun baseline and keeps T2's approved
Spot/Point Shadow controls live; per-caster maps are budgeted, while multi-caster totals remain
unmeasured and await an owner policy. The full proposal and refusal rule live in
[performance.md](./performance.md#reference-laptop-render-and-shadow-budget-d9-proposed); they are
not in force until the owner adopts them.

**Guards:** `authoring/stage-render-frames`, `render/shadow-invalidation`, `render/shadow-g4-counts`,
`render/model-lifecycle-boundary`.

**Visitor first frame.** The Visitor Preview records `visitor:mounted`, the existing two-rAF
`visitor:entry-frame` proxy, and Gate C's `visitor:first-frame`. The last is emitted by
`lib/visitor/first-frame.ts` after the renderer's own `info.render.frame` counter advances; it is
inert unless performance marks are enabled. It is a renderer-observed frame, not a physical scanout
proof. Do not rename or remove `entry-frame`; the published-welcome path uses the same marks.

## Colour pipeline

**Rule:** every world surface renders with `NoToneMapping` at exposure 1.0, sRGB output and an
`srgb-linear` working space, with `MeshLambertMaterial` as the artwork baseline. This is Gate A's
accepted decision ([pipeline record](../../roadmap/t2-look-atmosphere/s0-rendering-gate/pipeline.md)),
and it stands (owner ruling, E12). The material store reads that record and sets no tone mapping,
exposure or output colour space.

The accepted value is named once, as `CANVAS_TONE_MAPPING` in `renderer-backend.ts`, and the one
shared Canvas host passes it to `<Canvas>`. That attribute is load-bearing, not decoration:
Threlte's Canvas assigns its own `AgXToneMapping` default to whatever renderer factory it receives,
so a host that omits the prop silently runs a pipeline Gate A rejected. Exposure needs no prop — neither the factory
nor Threlte writes `toneMappingExposure`, so Three's 1.0 stands — and output colour space is Threlte's
sRGB default, which no Canvas overrides. Stage, Visitor Preview and the published visit therefore
share one pipeline; the published route draws through the same Preview surface.

**Guard:** `render/canvas-tone-mapping` mounts both production Canvases with their shipped renderer
callbacks and reads the renderer Threlte configured — `NoToneMapping`, exposure 1.0, sRGB output,
`srgb-linear` working space, `PCFShadowMap` — then requires both sources to name the shared constant,
so a changed dependency default cannot reopen the gap silently.

**Snapshot colour path.** The Stage snapshot renders the Stage's scene through its own 640-wide 8-bit
target on the Stage's renderer and writes the image through `authoring/stage/snapshot-image.ts`. That
module is the one writer: Three renders a non-XR target in the linear working space whatever
`texture.colorSpace` says, so it maps every channel through the exact sRGB encode and flips WebGL's
bottom-up rows before `putImageData`. The target stays 8-bit, so the fix costs no GPU memory and no
extra draw. Nothing else may `putImageData` a render-target readback: when one did, a 50% grey surface
measured 55 instead of the Stage's 128 (Gate B, E6; [report](../../roadmap/t2-look-atmosphere/s0-rendering-gate/report.md#e6--parity-and-the-snapshot-colour-path)).

**Guard:** `authoring/stage/snapshot-image` pins the encode (linear 55 → 128, monotone), the row flip,
the opaque alpha, the size check, and that the snapshot renderer calls the shared writer rather than
building its own data URL.

**No environment opt-out per material.** `envMapIntensity = 0` does not remove `scene.environment`:
when a material has no own `envMap`, r187 writes the environment intensity uniform from
`scene.environmentIntensity`, and the material field is ignored. Gate B measured `envMapIntensity` 0
and 1 as identical (ΔE00 0 on every sampled surface). A surface that must not receive the environment
needs a material that does not sample it, or no `scene.environment`. The shipped app has no
`scene.environment`; do not add one and rely on a per-material opt-out.

## Open exceptions and divergences

- **AR-7 / D2 — visitor free-look.** The neutral visitor's free-look pose is driven by
  `OrbitControls` outside the Camera evaluator. It is a named, owner-accepted temporary exception,
  not a second authored Camera; T3 retires it behind a targeted regression and authority test. See
  [Architecture](../architecture.md#semantic-authorities-ratified-destination).
