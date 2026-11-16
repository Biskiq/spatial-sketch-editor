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
Authored units        Layout 7 · Scene 8 · Camera · Experience
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
Renderer              managed-webgl-renderer.ts · on-demand frames · shadow invalidation
```

The Canvas host — `StageCanvas.svelte` or `VisitorPreviewSurface.svelte` — calls
`provideRenderResources()` once, and everything mounted under it leases from those stores. The
snapshot renderer draws the Stage's own scene with the Stage's renderer into an offscreen target, so
it never creates a second context or store set.

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
(ambient, the Sky's hemisphere, Paper's neutral rig) and dev benches are counted per file on an exact,
shrink-only allowlist. The Stage and the Preview lease from the Canvas store.

**Guard:** `render/light-realizer-boundary`.

### One look resolver

`materials/scene-instance-material.ts` resolves every Scene Finish for every surface: the catalogue
base, then per-slot `maps`, the colour literal or palette follower, roughness/metalness, `mapping`,
normal scale/flip, and finally the World's Treatment. The resolved colour multiplies the colour map,
so a catalogue or project map keeps its base tint (`wood-walnut` stays `#3d2a1a` over its map).
`tileMeters` becomes UV repeat, `rotation` turns about the UV centre and `offset` shifts in tile
fractions; all three are part of the texture variant identity, so two looks with different mapping
never share a texture clone. Natural adds nothing to `variantSeed`; Flat colour and Clay change the
resolved values, drop every map and therefore select a different variant. The Stage, Visitor Preview
and a published visit run this one resolver over the same `RuntimeScene`, so their descriptors cannot
drift.

**Guards:** `materials/scene-instance-material`, `materials/look-parity-golden`.

The Sky's Sun is the same one light: `softness` maps to `radius = 1 + 4·softness` shadow-map texels
(the old fixed radius 3 is softness 0.5).

**Haze** is stored now and rendered by S2. `visibility` is meteorological visibility: the distance at
which a surface's contrast against `haze.color` falls to 2%. It renders as
`FogExp2(haze.color, √(ln 50) / visibility)`; an absent `visibility` is clear air. S2 owns which
world elements are exempt (sky background, ground disc, editor marks) and lands that rendering in the
shared `WorldEnvironment` with its first writer, so the Stage and the visit change together. In S1
every surface renders clear air alike.

**Treatment** runs last inside the one resolver and never writes the document:

| Treatment | Maps | Colour | Roughness | Metalness |
| --- | --- | --- | --- | --- |
| Natural (absent) | as resolved | as resolved | as resolved | as resolved |
| `flat-colour` | none | resolved factor | `max(r, FLAT_MIN_ROUGHNESS)` | 0 |
| `clay` | none | `CLAY_COLOR` | `CLAY_ROUGHNESS` | 0 |

The constants live in `render/materials/treatment.ts` (`FLAT_MIN_ROUGHNESS = 0.6`,
`CLAY_COLOR = '#d6d3cd'`, `CLAY_ROUGHNESS = 0.9`). They are tunable defaults until S6 exposes the
control and frozen after, because a release renders through current code. Treatment reaches only
resolver-routed surfaces — primitives, forms and models remapped by a Finish; Artwork, models that
keep their own materials, default Layout surfaces and editor marks are untouched until S6 extends it.
A model remap keeps the model's own UVs, so it ignores `mapping` but keeps normal strength and flip.

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

World code uses built-in Three material classes and standard properties, which both WebGL and WebGPU
renderers honour. Outside an exact allowlist, product code has no `onBeforeCompile`,
`ShaderMaterial`, `WebGLRenderTarget`, non-2D `getContext`, custom depth or distance material, or
WebGL-only Three import path. A new site fails, and so does a stale entry, so the list only shrinks.
`managed-webgl-renderer.ts` is the one renderer-specific module. The artwork shadow-pass materials
stay listed in `scene-artwork-representation.ts`, because `alphaTest` on the surface would discard
colour-pass texels and change the image.

**Guard:** `render/renderer-portability-boundary`.

### On-demand frames and shadow invalidation

The Stage renders on demand: a settled Stage renders zero frames, and each relevant input change asks
for exactly one. Shadow maps keep `autoUpdate = false` and re-render only when something they depend
on changes — a new compiled `geometry` or resolved `scene` identity, a model's arrival or release on
the caster channel, a playing animation (per frame only while one plays), or a fresh or restored
context. An orbit, hover or selection renders no shadow pass, and a static model adds no per-frame
trigger.

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

The accepted value is named once, as `CANVAS_TONE_MAPPING` in `canvas-renderers.ts`, and both product
Canvases pass it to `<Canvas>`. That attribute is load-bearing, not decoration: Threlte's Canvas
assigns its own `AgXToneMapping` default to the renderer the shared factory returns, so a Canvas that
omits the prop silently runs a pipeline Gate A rejected. Exposure needs no prop — neither the factory
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
