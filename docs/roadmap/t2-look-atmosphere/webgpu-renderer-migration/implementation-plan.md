# T2 WebGPU renderer migration

**Status** · Approved product direction. PR 1 (r187 qualification) and PR 2 (the atomic production
cutover) are implemented; PR 2 awaits owner acceptance before merge. No further planning PR.
**Code baseline** · `main` at `e6375025`, which includes T2 S5b. The lockfile pins Three and its
types at 0.187.0, Threlte core at 8.5.16 and extras at 9.21.0. Reconfirm the source revision when
capturing the baseline and check intervening changes to the affected surfaces at cutover.
[T2 S5b #382](https://github.com/Biskiq/spatial-sketch-editor/pull/382)

All Biskiq 3D surfaces use one `WebGPURenderer` architecture when this work lands. Three selects native
WebGPU first and its WebGL2 backend when needed. Current projects, prepared releases, authoring
interactions, and the S0 look remain usable on both. Cutover is atomic across Stage, Visitor Preview,
and published visits and precedes S8 Material Depth.

This plan supersedes the earlier T2 renderer direction and the E-era renderer refactor's
portability-only scope. It carries forward the rendering contract's resource and identity rules.
The earlier benchmark recommendation addressed a trial. Its measurements remain inputs to this
cutover. [T2 §8](../README.md#8-rendering-truth-s0-is-a-gate-not-a-foundation-we-assume) ·
[Renderer refactor](../../t1-t2-consolidation/renderer-refactor.md#3-webgpu-portability) ·
[Rendering contract](../../../reference/components/rendering.md) ·
[Calibration portability log](../../../../prototypes/render-cost-calibration/portability.md)

## Baseline architecture and migration inventory

Layout compiles once. Scene resolves its instances, Finishes, and lights once. Shared render
descriptions and retained representations drive Stage and Visitor. The two Threlte Canvas hosts
construct native WebGL renderers through `canvas-renderers.ts` and `managed-webgl-renderer.ts`. Each
host supplies its MaterialStore, GeometryStore, LightStore, and caster channel. Texture sources and
texture variants share a scoped, module-level lease pool. The Stage renders on demand. An active visitor
run draws continuously and the welcome can render on demand. The Stage draws thumbnails into its
existing renderer. The published page mounts the same `VisitorPreviewSurface` as editor Preview over
prepared release inputs. [Rendering reference](../../../reference/components/rendering.md) · [Renderer
refactor](../../t1-t2-consolidation/renderer-refactor.md)

Paths below are relative to `apps/editor/src/lib` unless otherwise identified. The inventory includes
dependencies that run at frame time and portable behavior whose realization can change under r187.

| Surface | At the baseline | Migration target |
| --- | --- | --- |
| Canvas, scheduler and disposal | `render/canvas-renderers.ts`, `managed-webgl-renderer.ts`, `StageCanvas.svelte`, `VisitorPreviewSurface.svelte`, and dev assets/materials. Synchronous constructor, Stage stencil and local clipping, Threlte render modes and DPR clamp, native DFG lookup disposal shim around `onBeforeCompile`. | Shared ready-gated Canvas and renderer lifecycle. Preserve Stage stencil, alpha, antialias request, DPR 1–1.5 and scheduling. Retire native shim after the two-Canvas survival test. |
| Resource and identity graph | `render/resources`, shared texture pool, `VisitorLayoutShell`, `VisitorEntityGroups`, retained Wall/Room/Region/object and Scene entity/light representations. Native renderer caches uploads and programs. | Same lease scope and keys, fresh renderer realization per generation, shared CPU sources. Keep geometry groups, matrices, layers, pick roots, visibility updates and existing work bounds. |
| Layout and Finish surfaces | `scene-instance-material.ts`, `scene-surface-materials.ts`, `MaterialStore`, texture variant pool and retained Layout representations. Default and assigned Wall faces, Room floors/lids, Region tops/undersides, open sides and open-to-sky dormancy. Scene primitives, Forms and definitions, palette followers, Treatment, catalogue and project-image mapping. | Same compiled geometry, face identity, UVs and resolved descriptor. Built-ins where sufficient, targeted node material variants under the one factory. Keep ghost/hover/Finish live previews, accepted values, Undo/Redo and existing unresolved-reference behavior. [S5b evidence](../s5b-floor-overhead-finishes/evidence.md) |
| Artwork | `scene-artwork-representation.ts`: Lambert image, frame/mat and existing brightness/transparency. Transparent image uses separate depth and distance materials with 0.5 alpha threshold for shadows. | Same colour surface and asset scope. Shadow-only alpha mask in the Lambert node variant, covering directional, spot and point. |
| Imported models | `render/models/scene-model-support.ts`, model realization and representation, GLTFLoader + Meshopt, source material clones or Finish remap in MaterialStore. Creator import normalizes inputs. Library and published GLBs use existing scopes. | Exercise existing GLBs and accepted optional material extensions, source groups/UVs, shading, alpha modes, fallback footprint, skinned/morph/animated paths where present, wireframe, Treatment, remap, late arrival, read-only release assets and disposal. Preserve import admission and bytes. Validate source loader output classes against Three's node library. |
| Lights, shadows and Sky | LightStore and WorldEnvironment, Stage ShadowTriggers and native `shadowMap.render` wrapper. Sun/Moon directional lease and fitted bounds, Point/Spot/Directional controls, shadow catcher, lift shadow layers, hemi/neutral rigs, cubemap Sky, haze/fog, plate/plinth, exposure and softness. | Preserve light/Sky description and shared realization. Per-light invalidation and standard PCF plus actual pass counters. Validate cubemap orientation/upload, ground and catcher composition, attenuation/photometry, projected shadows, dusk/night and fog isolation. |
| Stage clip and cutaway | `stage-clip.ts`, `StageClipPlanes`, MaterialStore GLSL and local planes, `StageSliceLayer` and `StageCutawayLayer`. Level band and finite axis/drawn sections, X2 Wall/tethered twin clip, cap/edge assemblies, wholly hidden selection ghosts. CPU classification, Slice/cutaway pick rules and Lift layer state. | One fixed TSL colour-pass predicate driven from the existing clip owner. As-built shadows/snapshots, same caps and drag scheduling, same CPU pick and visual classification. |
| Stage ink | `stage-mat-grid.ts` ShaderMaterials. Native fat lines in `paper-scene.ts`, `paper-marks.ts`, `StageSelectionLayer`, `StageSliceLayer`, `StageCutawayLayer`, `StageLiftLayer`, `StageOpenSideLayer`. Standard materials elsewhere for marks, grids' surroundings, gizmos, light/dial/placement and Form/primitive ghosts. Stencil Wall outline probe via `?wallOutline=stencil`. | Port mat/ground and fat lines. Preserve widths, gutters, dash units, fade, ordering, masks, absence of fog and raycasting on helper ink, and stencil probe behavior. Keep retained ink and existing geometry where portable. |
| Camera, viewport and picking | `StageCamera.svelte` copies evaluated matrices and applies a bottom-origin scissor for Look through/capture framing. `StageSnapshotRenderer` copies evaluated matrices too. Visitor Camera director realizes the shared Camera output. Stage and Paper use CPU ray/geometry/semantic picking and owned identity. There is no GPU colour-ID pick path. | Adapt depth convention at the renderer boundary, and use the shared renderer's top-origin viewport. Keep Camera evaluation, pointer NDC/rays, View/Guide semantics, selection priority and hit identities. |
| Snapshots | `StageSnapshotRenderer.svelte`, `stage-snapshots.ts`, `snapshot-image.ts`: native offscreen target and synchronous bottom-up readback, one sRGB encode, cache and serial requests. | Generic target and async packed readback. Restore Stage state synchronously after submission, normalize rows, retain aspect/as-built inclusion and one colour transform. Never allocate a second snapshot Canvas or renderer. |
| Visitor and public delivery | `VisitorPreviewSurface`, first-frame observer, runtime-safe compiled Layout, assets and Camera. The public route `/p/[publicationId]` imports the Preview surface. Realizer has visitor-specific ground/framing and visitor-only controls. | Same shared host and look; keep accepted Stage/visitor presentation differences from Gate B, Welcome, free Explore, guided entry/travel/stays and release asset fetch. Preserve Preview and public import guards and release wire compatibility. |
| Tooling and diagnostics | Renderer counters in `perf-marks.ts`, visitor first-frame, spot wiring and existing GPU regressions. Native-only Vite optimization entries and the exact architecture allowlist. | Adapt normalized metrics to r187's common API, replace native GPU assertions with backend-verified successors, and update Vite, dev canvases and boundary guards in the cutover. |

The frozen Chopin site is outside product scope. S8 map UI/import, extra optical effects, new
shadow/lighting systems, authored formats, and unrelated Stage redesign are outside this migration.

## Target architecture

### A shared Canvas lifecycle

- Use a runtime-safe lifecycle owner under `render/` with one browser DOM canvas per generation.
  Prefer stock Threlte `<Canvas>` with the shared synchronous `createRenderer` factory and a small
  generation owner outside it. Threlte owns the DOM, camera/task contexts, resize and scheduling.
  Biskiq owns readiness, recovery, error reporting and generation-scoped resource retirement. The
  owner observes one explicit `init()` promise and gates render consumers, input and the first draw
  on successful init. Keep canvas sizing, focus and pointer routing, along with server-safe loading
  and unavailable states. PR 1 selects the integration using the same mounted lifecycle contract on
  both backends.
- The owner exposes starting, ready, recovering, unavailable and disposed states, a
  generation/cancellation token and a single retirement promise. Configure the shared S0 pipeline
  explicitly in the actual mounted context. Stage can request stencil, and dev benches can disable
  shadows by their existing policy. Hold the ready state until actual backend selection is known.
  First-frame instrumentation observes a successful **onscreen** render with nonzero dimensions after
  the host starts drawing, independent of animation ticks, compile or offscreen draws. Preserve
  `visitor:mounted` and `visitor:entry-frame` and keep instrumentation inert when disabled.
- Automatic startup uses Three's WebGPU-first `init` and internal WebGL2 fallback. Record the actual
  backend from initialized `coordinateSystem`, including in every measurement; a forced WebGPU test
  fails if it obtained WebGL2. Hold one backend record per generation using the same source for logs,
  depth conversion and row ordering. If initialization rejects after acquiring the canvas, or the first
  usable WebGPU frame has a validated backend-level failure, retire and try forced WebGL2 on a **fresh**
  canvas once. Count an internal WebGL2 attempt on the original canvas as conclusive only when the host
  can verify that the compatibility backend was tested independently of a partially acquired WebGPU
  context. After the fresh compatibility attempt fails, show an in-place rendering-unavailable state
  with Retry while keeping the editor shell or visitor chrome. Handle asset errors through their
  existing reporting/fallback paths. Treat a reproducible shader regression as a cutover failure.
- Treat `onDeviceLost` as terminal for that generation on either backend. Invalidate its token first,
  stop submissions/input to the retired canvas, unregister snapshot/caster/asset completion callbacks,
  release leases and retire asynchronously. Retry the current backend once on a new canvas with restored
  source inputs. On failed or repeated WebGPU loss within the same recovery episode, try WebGL2 once and
  keep a recovered WebGL2 surface there for its lifetime. On failed or repeated WebGL2 loss, present
  retry instead of looping. Bound a recovery episode until the new surface has run for 30 seconds
  without loss, and cap initialization at a 10-second UI deadline per attempt; a late completion can
  only retire itself. Remount only the renderer subtree and reapply the current viewport/reading/active
  visitor state. Keep the project session, unsaved history and selection outside the generation. Cancel
  a captured Stage gesture via the existing pointer-cancel seam before leaving its canvas. Keep the
  visitor interpreter, existing Camera motion/queue/progress and current guided look or Explore pose as
  runtime state in the visitor surface across ready-subtree remounts. Bind each new Three camera to that
  state, reattach the existing input/controller hooks, and suspend the render-facing clock while
  unavailable. Resume the same occurrence and Camera sample using the existing evaluator and preserving
  the user's pause state.
- Register loss/error handlers before initialization and gate callbacks by generation. Route Threlte's
  cleanup and host cancellation through the same idempotent retirement promise. Stop submissions
  synchronously, release child leases/targets before freeing the renderer, clean up a successful late
  init and consume rejected async start/stop/dispose calls. Use public APIs and a fresh canvas to
  replace a lost renderer. Keep that logic in the shared owner and reserve forced context loss for
  test fixtures. Three caches its init promise and expects the app to replace a lost renderer.
  [Three WebGPU manual](https://threejs.org/manual/pages/webgpurenderer) ·
  [Three r187 renderer](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js) ·
  [Three loss and disposal decision](https://github.com/mrdoob/three.js/pull/34688)
- Use public Three entry points and one pinned Three package resolution. Keep pure shared objects on
  `three` and use `three/webgpu` and `three/tsl` at renderer/material adapter sites. Anchor Vite
  prebundling and build dedupe to the same Three resolution, including the common core used by the two
  entry points. Verify common constructor/texture identity and one ColorManagement across optimized dev
  and production builds, including addons and Threlte. Audit the native constructor in Threlte's
  optional default branch: product always supplies the factory and the production registration test must
  prove no executable product route selects the default. Include any upstream-only retained bytes in
  the cold-load diagnostics. Replace native line optimization entries with their common geometry and
  WebGPU addon paths.

#### PR 1 Canvas choice

The pinned core 8.5.16 supports `createRenderer` on its regular Canvas. Its renderer context calls
`setAnimationLoop()` and `dispose()` without awaiting their promises, and only catches synchronous
disposal errors. The documented `@threlte/core/webgpu` Canvas arrived in a later version. The 8.7.0
package delays mounting its children until `init()` resolves and handles successful late init, but its
init chain has no rejection handler and its shared context still calls async disposal without awaiting
it. Upgrading alone leaves rejected init and shutdown to resolve. Qualify the locked version first.
A core upgrade requires a demonstrated lifecycle improvement and the usual dependency review.
[Pinned core package](https://www.npmjs.com/package/@threlte/core/v/8.5.16) ·
[Core 8.7.0 package](https://www.npmjs.com/package/@threlte/core/v/8.7.0) ·
[Threlte WebGPU Canvas](https://threlte.xyz/docs/reference/core/webgpu/)

Compare these paths in the same small mounted fixture, using the production Canvas props and one
retained Stage/visitor state model:

1. **Stock Canvas with a thin adapter.** Use the normal `createRenderer` factory, gate descendants
   on init and use the lifecycle adapter to observe any start/stop/retirement promises Threlte does
   not await. An outer key replaces the Canvas after terminal loss or failed startup.
2. **Ready-gated Canvas.** Bind the host's DOM canvas and await init before mounting one small child
   using the exported `createThrelteContext`. Supply the initialized renderer for that exact canvas
   through a synchronous factory. Threlte still owns resize, tasks and the scheduler.

Use the same delayed/rejected init, unmount-during-init, async disposal, loss/replacement and
surviving-sibling cases for the two paths. Assert zero pre-ready draws, zero unhandled rejections,
and one renderer retirement per generation. Late callbacks must have no effect on either surface.
Check resize/DPR and render modes, focus/pointer-cancel, and restoration of the Stage session and
visitor Camera/playback state. Choose
stock Canvas if public hooks and the adapter pass the contract while preserving Threlte's lifecycle.
Choose the ready-gated child if the stock path cannot do that without patching Threlte or taking over
its scheduler. Record the result and exact failing case for any rejected path in PR 1. PR 2 ships
only the selected path.

### World resources and materials

- Keep one MaterialStore and one resolved Finish look across all surfaces. Representations receive
  descriptors and leases, with no backend flag, raw context or node graph in authored data. Material
  realization uses standard Three material classes when they express the look, relying on
  `StandardNodeLibrary`. Under the same factory realize a matching node material only where Clip,
  Artwork's shadow mask or a proved shipped material compatibility case needs one. Use the library's
  standard class mapping, copying supported properties and texture references from the leased built-in
  or imported clone, then attach nodes. Retain the existing store key contract and refcounts. Keep
  descriptor identity separate from shader shape. A map-slot or render-state change can select a
  variant. In an already drawn variant, position/clip, opacity within the same blend mode, light
  colour/softness and shape-preserving Finish preview values use uniforms or built-in bindings. In
  PR 1 record which supported edits actually change the r187 pipeline, including zero crossings in
  stock materials. Exercise repeated same-shape edits on both backends. Use a stable node uniform at
  the material factory only where Three specializes a value that must remain live. Preserve
  imported alpha/fog/depth/side/blending/vertex colour, texture transforms and geometry deformation. The
  source clone must never be turned into a shared mutable node material. A reproducible incompatible
  admitted source is a gate failure. [Three r187 material
  mapping](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/nodes/StandardNodeLibrary.js)
- Keep the GeometryStore, LightStore and caster channel per generation. Use the current load-scope keys
  and idle disposal in the shared texture pool. Three uploads textures independently on each renderer.
  Re-test shared source and variant upload, disposal listeners, release/reacquire in one update, stale
  URL/asset completions, and teardown of one Canvas while another still draws the same physical and
  image materials. Retire the native DFG shim and tests only with a behavioral successor. Keep world
  identities and the compiled representation stable within a generation. In a warm mounted regression
  over the same visible content, assert that camera motion and repeat rendering retain world and GPU
  resource identities, issue zero new asset fetches and do zero world description rebuilds. An edit
  updates only its affected leases.
- Create the renderer with the common r187 output path, working space `srgb-linear`, sRGB output,
  `NoToneMapping`, exposure 1.0, and standard texture slot tags (colour/emissive sRGB, data such as
  normal/roughness without colour transfer). Start with Three's default half-float internal colour
  buffer and MSAA request. Probe fallback renderability, stencil and sample limits on the device matrix.
  Consider a common alternative buffer format or sample configuration only after it passes the same
  visual and timing gates on both backends. Keep the accepted Lambert response and current Brightness
  behavior. Use the S0 chart and actual Artwork including a photograph, translucent pixels and coloured
  lighting. [S0 pipeline](../s0-rendering-gate/pipeline.md) · [Artwork
  record](../s0-rendering-gate/artwork-fidelity.md)
- Artwork with transparent colour retains fractional alpha and keeps the colour-pass cutoff unchanged.
  In the Lambert variant, use r187's `maskShadowNode` with the existing shadow material's map-alpha, UV
  and 0.5 threshold semantics. Remove `customDepthMaterial` and `customDistanceMaterial` and their
  descriptors. Clip variants for opaque casters set a pass-through shadow mask because r187 can
  otherwise reuse `maskNode` during a shadow pass. Preserve stock alpha-test behavior for imported
  cutouts, and compose the Artwork shadow mask independently of Stage clip. Pin cut versus as-built
  shadow equality and threshold pixels on all three light kinds. [Three r187 shadow material
  path](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js)
- Use WorldEnvironment's shared Sky resolution, cube source, ground, haze and light leases. Preserve the
  S0 empty environment slot and the current ground/catcher and phase-specific light behavior. Replace
  the native frame-global shadow wrapper with a Stage controller using each leased light's
  `LightShadow.autoUpdate` and `needsUpdate`. LightStore registers active shadow light leases with the
  controller; support late registration/replacement and release. Keep invalidation for geometry/caster
  content, light preview, asset draw/release, and recovery. Sun/Moon projection changes refresh only
  that lease. Animation updates affected maps while the caster is playing, and preserves the last dirty
  frame at stop. Appearance-only Sky, Camera orbit, hover, selection, Lift and Slice must not redraw
  maps. A new renderer begins with all maps dirty and must show a correct first shadowed frame. Keep
  continuous shadow updates on active visits, actual authored Point/Spot/Directional switches and
  existing map dimensions, bias, softness and fitted frusta. Preserve layer-0/lifted-layer eligibility
  explicitly on shadow cameras where needed. Count actual shadow render submissions in the bounded
  fixture via render target and camera identity, including the six Point faces. Keep counters distinct
  from requested dirty maps and from fullscreen/output draws. [Three shadow update
  path](https://github.com/mrdoob/three.js/blob/r187/src/nodes/lighting/ShadowNode.js) · [Three point
  shadow path](https://github.com/mrdoob/three.js/blob/r187/src/nodes/lighting/PointShadowNode.js)

### Stage clip, ink, viewport and readback

- Use one Stage-owned live uniform block for two Level plane equations, the finite Slice parameters and
  X2 cutaway height. Port the exact keep/discard tests from `stage-clip.ts` and `applySliceClipShader`
  to one TSL colour mask with fixed layout. Use world position after deformation for surfaces and the
  interpolated world centreline for wide segments, matching the current line clipping intent. Preserve
  fixed bindings for normal/twin materials and park the block for the synchronous as-built snapshot
  submission. CPU pick, cap and section code consumes the same resolved reading and keeps its current
  inequalities, tolerances and ownership. Leave finite depth/axis/Flip and endpoint/Keep side semantics
  intact. A Level cap still assembles after the existing 120 ms settle, exclusively from the existing
  Layout sources, with zero cap assemblies on live drag frames. Cutaway cap/seam caching,
  wall/window/attached-object twins, selection exemptions and Lift shadow eligibility stay intact.
  Retain layer 0 for world, 2 for overlay and 3 for lifted lids. Visitor representations receive the
  as-built realization with no Stage state. Common renderer clipping groups can express planes, but the
  needed bounded cut, cutaway exemptions and isolated shadows are handled together by the one mask.
- Use `three/addons/lines/webgpu/Line2.js` and `LineSegments2.js` with `Line2NodeMaterial` and the
  existing common line geometry. Encapsulate the CSS-width/dash/style setup at one editor-only line
  factory. Explicitly test resolution, viewport and DPR for width and picking behavior, with
  orthographic Paper and perspective selection cases. Preserve independent segments for Slice edges,
  per-line opacity, world-metre dashes, occlusion/overlay policy and ghost styling. Port the mat shaders
  to local TSL nodes with the current world-anchored lattice and bounded coordinates, adaptive
  derivatives/fade, ground/plate and depth/fog behavior. Keep existing stencil/alpha operations and
  basic Stage gizmo geometry. [Three wide
  lines](https://github.com/mrdoob/three.js/blob/r187/examples/jsm/lines/webgpu/LineSegments2.js) ·
  [Three line node
  material](https://github.com/mrdoob/three.js/blob/r187/src/materials/nodes/Line2NodeMaterial.js)
- Stage and snapshot use one renderer-neutral Camera evaluation. At realization, set Three's camera
  coordinate system before copying matrices, and on WebGPU convert the evaluated clip Z from `[-w,w]` to
  `[0,w]` by setting `z' = (z + w)/2`; leave authored evaluation and XY unmodified and recompute the
  physical camera inverse projection. Disable reversed depth for this migration. Keep Visitor's pose/FOV
  realization through its existing camera path, including the current zero-node neutral Explore
  OrbitControls hookup to the new DOM canvas, and verify its first draw after init/resize/recovery. Use
  top-left CSS viewport and scissor coordinates for the common renderer on both backends. Its WebGL2
  backend converts Y internally. Test an asymmetric framed region at DPR 1 and 1.5, both orthographic
  and perspective depth/occlusion, and CPU pointer/screen projection parity after the first frame. Apply
  Camera evaluation before draw so Three's first-use projection update cannot replace the copied
  projection.
- Reuse one generic `RenderTarget` per ready Stage generation and size. Keep the 640-pixel width,
  authored pose/aspect, world + lifted layers, 8-bit linear RGBA and no MSAA target. Submit the render
  and start `readRenderTargetPixelsAsync` in a synchronous state bracket. Restore target/face/mip,
  clear, viewport/scissor and clip state before yielding. Use target-local pixels, independent of canvas
  DPR. Await the copy outside that bracket and normalize to top-down RGBA using the verified r187
  backend order; the WebGPU API returns tightly packed rows, WebGL2 full-buffer read starts at the
  bottom. Encode sRGB once and force PNG opacity as today. A test uses asymmetric corners, odd-width
  target, a non-default aspect and grey ramp to detect orientation, packing, transfer and resize errors.
- Keep one in-flight snapshot per generation and existing exact-pose cache/dedupe. Scope the
  serialization queue to the generation so a failed or hung old read cannot block the new host. Discard
  results on generation or source revision change. A pending target is only reused or disposed once that
  generation's copy settles or its renderer is retired, whichever comes first. Test rejection/loss while
  copying, thumbnail placeholder, teardown during a queued render, and the next normal onscreen Stage
  frame. A snapshot during Slice/Cutaway/Lift includes the existing as-built content; in-flight readback
  cannot keep their live uniforms parked. Keep existing authoring/visitor semantics and the published
  payload untouched. [Three renderer readback
  API](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js) · [WebGPU
  readback](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/utils/WebGPUTextureUtils.js)
  · [WebGL2
  readback](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl-fallback/utils/WebGLTextureUtils.js)

### Pass ownership

Threlte schedules the onscreen world draw. The renderer host owns its readiness and frame observation;
Stage's existing pre-render task supplies that frame's viewport and Camera evaluation. Three owns the
internal shadow and output passes. Biskiq's shadow controller marks the affected light maps dirty.
The Stage snapshot host is the only application-owned offscreen pass in this cutover. It borrows the
ready renderer, brackets its synchronous submission and state restoration, and awaits readback outside
that bracket. The mounted tests assert one onscreen draw per scheduled Stage frame, zero draws at
settled rest, and that an offscreen submission neither counts as that draw nor corrupts the next one.
This ownership is the seam an approved S8 effect would extend. Pass graph, composer and effect APIs
belong with a capability that actually needs them.

## Ordered implementation pull requests

Use two implementation PRs after this plan is reviewed. The first gives the second a measured old path
and verified API choices. The second is the single product switch and retires the native path in the
same diff. The existing runtime stays deployable after PR 1.

| PR | Depends on | Changes and evidence required to review |
| --- | --- | --- |
| **1 · Pin the shipped baseline and qualify r187** (use `release.visitor-isolation`, `layout.interior-reveal`, and `scene.model-import` in the claim) | Reviewed migration plan and the #382 baseline. | Freeze test assets/poses and the A comparison build in the PR, with fixture manifest and reproducible sample flow. Reuse S0 and existing renderer regressions. Add focused pre-cutover tests for mounted behaviour the old suite misses, including asymmetric framing and existing release assets. Compare the two Canvas integrations and record which one passes the lifecycle contract. Run the bounded API fixtures below using direct Three/Threlte harnesses isolated from product imports: init/loss/disposal, simultaneous devices and shared textures, projection/scissor, TSL masks including Point shadows, wide lines/stencil, colour/rows, and timed light-variant changes. Attach actual B/C results and the r187 configuration that passes. Keep prototypes and harnesses out of shipped routes. A's measurements on the two reference laptops, the chosen Canvas path, the candidate API proofs, and a cold public load measurement are the inputs to PR 2. |
| **2 · Replace the product renderer** (same capabilities and `camera.one-authority`, `release.prepared-package`) | Merged PR 1, validated API probes and thresholds below. Use the A SHA/fixture hashes from PR 1, refreshed against the last native baseline if intervening render changes affect the comparison. | Apply the target architecture to the world/material/shadow and Stage presentation seams in the same branch. Implement lifecycle and mounted stores first, shared look/lighting next, then Stage clip/ink/camera/picks/snapshots, then switch and exercise every Canvas and route. Put parity tests alongside each converted surface. Delete the native factory, hooks, line imports and production fallbacks. Transfer or update the arch guards and docs. Attach integrated A/B/C results with actual backend and the verified disable-WebGPU startup path. Obtain the required green merge gate and owner manual acceptance of both backends on the complete flow before activation. |

The claim uses existing capability ids. Keep the collaboration and review steps in
[workflow](../../../workflow.md). If the first PR exposes a failed subsystem, apply the bounded
resolution below before opening the cutover for approval.

## Technical unknowns and how to close them

| Open question | PR 1 proof and PR 2 closure |
| --- | --- |
| **Startup, partial init and retirement on locked canvases.** WebGL2 lack, denied WebGPU, or context acquired before failure can exercise different branches. A successful init alone does not prove an onscreen frame. | Use rejected/delayed fake init in mounted tests and both actual backends in a focused browser harness. Force native device loss and GL context loss in the harness, never the shipped feature. A test-supplied native device may be explicitly destroyed, but r187 filters a `destroyed` reason in its internal callback, so invoke the documented loss hook for deterministic owner tests and exercise a browser-supported actual loss mechanism where available. Record which was done. Assert new canvas identity, resumed render, correct backend, unchanged session/route, settled disposal and surviving sibling. Exercise rejected init, late init, unmount during pending work, repeated Enter/Exit and a failed fresh-canvas retry. If public APIs leave a reproducible native resource leak on partial failure, isolate it in a Three repro before proposing a version fix. |
| **Node masks preserve all colour/shadow variants.** Stock PCF, standard built-ins and the WebGPU line variant use different internal stages. View-dependent shader generation could discard a needed mask, flip a line, or change a shadow filter. | Use a small golden scene with transparent Artwork, alpha-tested imported mesh, an animated/deformed caster, a ground shadow receiver, Level/drawn cut and X2 twin; render matching views on A/B/C. Bind real shadow-target observations and compare the masks for Sun, Spot and all Point faces. Check focused line/cap/stencil samples at both DPRs. If the standard material loses only a required slot or shadow property, fix it once at the factory using public TSL APIs and prove both backends. A shadow filter difference is acceptable only if it passes the visual gates; do not retune authored light fields to hide it. |
| **Texture upload, stencil, MSAA and colour buffer support.** Half-float framebuffers, texture compare and multisample behavior vary by backend/device. | Prove a real first draw with the expected settings, a saturated cubemap, image and normal/roughness fixture, stencil outline, transparent PNG, and the odd-width readback. Record the actual format/sample count when observable. Prefer pinned defaults; try one common public configuration only if an attachment capability fails. Reapply both colour and AA/ink gates. A platform that cannot draw the required results through any qualified configuration is a compatibility blocker. |
| **Compilation, extra output pass, texture residency and light/shadow cost.** Stable program counts can hide pipeline compile stalls. CPU and GPU timing measure different work. | Capture pipeline creation or compile trace evidence in the fixture and time first open, first cast/receive frame, Finish reassignment, adding/enabling a light and a warm repeat. Compare matched viewport, DPR and quality. Report CPU submit, GPU pass work, first correct result and cadence separately. Profile the implicated pass before testing a targeted correction. A measured compile stall can justify `compileAsync` for a bounded set of known variants outside pointer interaction, with generation and scene revision guards. Measure cold startup and first-use latency together to check that prewarming did not just move the stall. For draw-bound cases, first remove proved redundant work. Try compatible instancing only for the implicated family and preserve identity, picks and grouped materials. Keep either optimization only if it improves the affected product flow and passes the unchanged gates on both backends. |
| **Browser-specific canvas/pipeline or bundle loading behavior.** A dev run can mask a fallback, a duplicate Three module, or an editor import through a shared path. | Verify secure-origin production builds and force/prove each mode. Record startup network/parse separately from host time, review route graph and build provenance, and measure cold public welcome through renderer start. Qualify actual devices below and prove the unavailable state when neither backend starts. A candidate that only passes under software rendering or browser flags fails the hardware rows. |

## Verification gates

### Product workload and device matrix

Run a bounded migration comparison at PR 1 and at the integrated PR 2 candidate. It is scoped to this
owner-requested renderer change under the [operative performance
policy](../../../reference/components/performance.md). Existing CI lanes and focused browser QA still
apply. A is the same product at the last native-WebGL reference SHA. B and C are the candidate with
observed native WebGPU and observed forced WebGL2 respectively. When the final candidate uses automatic
selection with WebGPU unavailable, verify that it matches C without enabling a product toggle.

- **S0 comparators** use empty, 7 × 6 starter room, and 12 × 7 gallery with six textured quads at the
  same camera positions, 1280 × 720 and DPR 1. Include the same gallery shadow-off control and the
  18-patch neutral calibration. Use the exact S0 benchmark source as a fixture reference and both actual
  product Canvas entry points for the final comparison. S0's visitor bench omitted the HUD and Camera
  input. [S0 report](../s0-rendering-gate/report.md#gate-c--e7-rendering-performance-and-shadow-budget)
- **Current-world comparator** uses a 10-room, roughly 30-wall current-format project at the scale of
  the measured saved World. PR 1 should freeze a shareable current project or reproduce the scale with
  the canonical fixture builders. Its fixed manifest must include an opening and curved Wall, a Room
  floor and lid and a standalone Region with assigned S5b faces, a layout object, Scene primitives/Form,
  a mapped Finish and imported textured GLB, one neutral and one translucent Artwork, one shadow Sun,
  one enabled shadow Spot and one shadow Point for the multi-caster run. Record exact fixture counts,
  camera/Experience, asset bytes and hashes, and the same canonical source and prepared release package
  for A/B/C. Use the existing three copy modes (source project, detached Preview, prepared publication)
  with equivalent accepted state. Add the one-Sun measurement before turning on Spot and Point to expose
  incremental cost.
- **Measure interactions on comparable modes.** Stage first frame, Plan/Paper pan, World orbit, hold at
  rest, select/drag a real object, perform one cold and one warm Finish/light edit, Level/drawn Slice
  drag and Put back, Near Wall Cutaway, Lift/Put back, framed Look through, and request one uncached and
  one cached thumbnail. On Preview/public measure Welcome/enter, one free exploration orbit, one real
  Travel plus a hold, and a return/re-entry. Focused visual QA covers all rows below; the timed samples
  are World orbit, drag, Slice motion, gallery visit, current-world visit, create/resize/re-enter,
  cold/warm light change and uncached snapshot. A fixture must show a correct rendered result to count.
- **Hardware reference pairs.** Apple Silicon MacBook Air M2 (16 GB or equivalent) in current stable
  macOS Chrome and a Windows laptop with Intel Iris Xe-class integrated graphics (record model/driver,
  8–16 GB) in current stable Chromium (Chrome or Edge). Run A/B/C on both on real GPU hardware. Run
  current Safari on the Mac and current Firefox on Windows as independent browser-engine checks with
  automatic selection and a verified WebGL2 run, including Preview/published routes. If a browser
  exposes hardware-backed WebGPU, exercise that backend as well; record actual availability and fallback
  reason. Exercise default fallback on a real environment without usable WebGPU or with WebGPU disabled,
  and manually check unavailable when both fail. Use DPR 1.5 and a resize on each required backend, in
  addition to matched DPR 1 runs. Record device, OS, browser build, graphics adapter/driver, display
  period, CSS/backbuffer size, DPR, power/thermal state, backend, revision and invalid samples. Use
  production builds from a secure context (localhost is valid). Desktop software adapters, emulation and
  prototype numbers do not qualify a laptop.
- **Repeatability.** On each A/B/C pair measure at least three interleaved 10-second steady windows per
  timed flow after warmup and ten launches or one-shot actions for cold/transition metrics, with
  warm-page re-entry separated from first page load. Compare medians of steady-window p95 values and
  show all windows, p99 and misses. Use nearest-rank p90 plus maximum for the ten-action samples.
  Capture a short diagnostic trace / GPU timers outside the ordinary presented-frame run. Report GPU
  timing as unmeasured on unsupported/disjoint timers and use the separately recorded trace or a matched
  sustained-frame test at DPR 1.5 for headroom. Separate queue/readback cost and report what each number
  includes. If variance changes the gate result, do one matched repeat batch with the same protocol,
  retaining all observations.

### Performance acceptance for this cutover

Measure a matching onscreen submission and the next presentation opportunity using the existing
spot-check clock convention. Correlate the submission with the input or runtime transition and
exclude offscreen, shadow and empty scheduler ticks. Use compositor traces where available and label
the rAF presentation proxy in the results. [Editor performance runner](../../../../apps/editor/perf/README.md)


The calibration is real rendering on one M2 and a synthetic draw distribution. The saved-world census
has **64 Stage draws, 44,937 triangles** and **58 visitor draws, 25,203 triangles** from a
31-wall/10-room project. It has no cast-shadow light and is one view, so it cannot establish today's
shadow or texture-heavy cost. S0 gallery measured **15 Stage draws in orbit**, p95 ~17.7 ms and **zero
Stage shadow passes**; visit had **24–26 draws**, p95 ~17.7 ms and one Sun pass. At 60 Hz the cadence
masks headroom. S0 first-Canvas Visitor first-frame samples were 61–101 ms and excluded public
network/bootstrap. Carry these values as context and compare against fresh A rows. [Saved-world
census](../../../../prototypes/render-cost-calibration/census/census.md) · [S0 Gate
C](../s0-rendering-gate/report.md#gate-c--e7-rendering-performance-and-shadow-budget)

| M2 calibration signal | Native WebGL A | WebGPU B | Three WebGL2 C | Implication |
| --- | ---: | ---: | ---: | --- |
| Fitted per-draw submission | 0.675 µs | 2.435 µs | 3.192 µs | C is 4.73× A on this sweep. The fitted C−A term at 64 draws is ~0.16 ms before fixed, fill, shader and shadow costs. The estimate is scale context and does not predict the product frame. |
| 5,000 separate draws, no lights, synchronized | 7.75 ms | 20.75 ms | 20.85 ms | C is 2.69× A for this exact row (the log's prose cites ~2.4×, which matches a different 5,000-mesh row). |
| Synchronized shadow slope at 1,000 / 5,000 draws | 0.228 / 1.074 ms | 1.023 / 3.577 ms | 0.803 / 3.912 ms | C is ~3.5–3.6× A. Count shadow faces and price incremental GPU work. |
| First frame after light 4 → 5 | 13.6 ms | 40.4 ms | 199.7 ms | C's ~14.7× stall is a build/variant risk even without a program-count delta. |
| 5,000 instanced, synchronized | 4.20 ms | 4.05 ms | 4.45 ms | Submission shape matters. No required batching rewrite follows from this result. |

The synchronized results include a GPU wait or readback, with backend-specific methods. Treat them as
diagnostics of cost, never as displayed frame times. [Portability
table](../../../../prototypes/render-cost-calibration/portability.md) · [A raw
rows](../../../../prototypes/render-cost-calibration/results/apple-m2-webgl.json) · [B raw
rows](../../../../prototypes/render-cost-calibration/results/apple-m2-webgpu.json) · [C raw
rows](../../../../prototypes/render-cost-calibration/results/apple-m2-webgpu-force-webgl.json)

Cutover requires correct, reliable frames and the absolute response limits below on both backends.
Use the matched native A run to explain the cost of the change. Define `T` as the observed display
period. Apply the warm interval and motion limits at DPR 1 and 1.5. These are proposed migration
thresholds. D9 and any product-wide shadow maximum remain separate decisions.

| Metric | Acceptance on **each** B and C reference laptop |
| --- | --- |
| Stage orbit, drag and live Slice, S0 and current world; guided/free visitor motion | Presented-frame interval p95 ≤ 2T (about 33 ms at 60 Hz). During warm continuous input or Travel, intervals stay within 4T. Report input-to-correct-frame delay in Stage gestures alongside intervals, p95 ≤ 2T. |
| Active Visitor rest, one Sun | p95 ≤ 1.1T (~18.3 ms at 60 Hz), anchored to S0's proposed allowance. Current-world multi-caster motion uses the 2T bound and must keep all enabled shadows. Record incremental directional/spot/Point shadow cost, auxiliary passes and visible output. |
| Canvas and published startup | Stage project ready or Visitor Canvas request → first correct draw, on a loaded route with cached fixture bytes, p90 ≤ 250 ms. Cold published navigation → first correct gallery frame p90 ≤ 1 s on the fixed local production-build connection from PR 1, with a cleared browser cache. This is a reproducible startup check for the fixed gallery payload. Report the current-world cold result and the fetch/parse/init/first-draw breakdown separately. |
| Common edits | Input → shown Finish change, light addition or shadow enablement p90 ≤ 150 ms on first use and ≤ 100 ms on warm repeats. Record the maximum and investigate any ≥ 150 ms main-thread render/compile stall in the current-world workload. |
| Snapshot, resize, reuse | First uncached 640-wide image p90 ≤ 250 ms for the warmed gallery. Stage interactions still meet their frame gate while copy is pending. Cached exact pose submits zero draws. Resize/re-entry must render the right frame within 2T once the renderer is ready and layout is stable. |
| Work invariants and lifecycle | Zero rendered Stage frames at rest after settling for a 10-second window. Zero shadow passes across 600 combined orbit/hover/selection/Slice frames with static casters and unchanged maps. A Sun edit that changes projection refreshes that map once, a dirty Point draws six faces, and a pure haze/exposure/softness change draws no Stage shadow map. Watch for ongoing idle work and a monotonic resource climb across 10 Preview open/close cycles and during recovery. Stores, renderer handles and listeners return to the existing live Stage scope after settled teardown, and shared asset variants remain reusable. |
| Public isolation | Preview and published routes pass their build-time import guards and keep authoring modules and migration probes out of the load path. |

**Required diagnostics.** Report warm CPU submit and reliable GPU pass times for the gallery and
current-world orbit/visit against A at matched quality. Log fixed output and shadow work separately.
Where comparable GPU timing is unavailable, record that and use a short pass-labelled trace where
available. Run the bundle report on A and the candidate, including bytes actually loaded through the
first public draw and parse time. Treat growth above 150 KiB gzip as an investigation trigger. Check
duplicate Three code, the upstream default constructor and chunks loaded ahead of use. A measured
CPU/GPU delta or transfer size calls for explanation. Cutover depends on the user-facing limits,
correctness, work invariants and isolation above.

Failure of an absolute limit triggers diagnosis on that device. If A also misses the limit, retain
both results and bring evidence from the intended workload to review before changing the fixture or
limit. Each backend must qualify on both reference laptops.

### Visual, functional and regression acceptance

1. **Colour and image fidelity.** Reproduce the S0 unlit calibration (max absolute channel error ≤ 1 vs
   source, with the old exact reading shown) and neutral Lambert chart on B/C in both mounted Canvas
   paths. Mid-tone mean ΔE00 ≤ 2, maximum ΔE00 ≤ 2 for the neutral chart including its dark/white
   patches, monotonic grey ramp, clipping ≤ 1% of any patch. Measure real photo patches under neutral
   light and one coloured light against A with predeclared interior samples (mean ΔE00 ≤ 2) and inspect
   transparency edges, frame and mat, alpha-shadow boundary and brightness stops. Capture the same
   pixels on Preview and a prepared release. Preserve expected Gate B differences in ground, helper ink
   and Sun framing. [S0 artwork fidelity](../s0-rendering-gate/artwork-fidelity.md) · [Gate B
   parity](../s0-rendering-gate/report.md#e6--parity-and-the-snapshot-colour-path)
2. **Snapshot pixels and state.** `#808080` must read 128 in the Stage and its snapshot. Re-run the S0
   scene at 640 × 400 and require mean whole-frame channel difference ≤ 1, ≥ 95% within two levels and
   p99 ≤ 6; record edge pixels separately and inspect non-edge colour against the chart. Include colour
   ordering, top/left orientation, no double encoding, state restoration on success, rejection and
   teardown, DPR/aspect change, Slice/finite cut and Lift/offscreen layer expectations.
3. **World behavior.** Keep structural parity for id, transform, geometry groups, UVs, layer masks and
   material properties. Compare image tiling scale/offset/rotation, palette followers,
   Natural/Flat/Clay, Surface Finish in all S5a/S5b roles, dormant lid restoration, asset URLs and
   scope, alpha masks, normal/displacement and supported standard/physical properties using the same
   source. Inspect Sun/Moon progression, Sky cube orientation and haze, local lights with shadow
   toggles, neutral Paper/Studio, catcher and Stage/visitor ground. Verify no clipped shadows and no
   newly introduced acne, leaks, missing faces, or frozen maps. Evaluate the existing angle-dependent
   shadow and Artwork picking issue against A to identify new regressions. [CP0 follow-ups
   #353](https://github.com/Biskiq/spatial-sketch-editor/issues/353)
4. **Stage reading and picks.** Exercise Paper, Shaded Plan, World, Studio, mark and gizmo hover/drag,
   accepted and preview finishes, outlines (including stencil probe), 2/3 px wide section edges and
   world dashes. Assert CSS width within 1 CSS px of A and framed viewport edge within 1 CSS px at both
   DPRs. Hit candidates and winning ids must agree with the current CPU differential fixtures, including
   before/after resize, off-centre Look through, a finite endpoint boundary, a clipped/muted twin, Lift,
   transparent Artwork, a wholly hidden selected ghost, caps/ink refusing hits and pointer-cancel on
   recovery. Assert existing cap rebuild counts and scheduling. In warmed variants, check actual
   pipeline creation during repeated clip entry/drag/exit and same-shape Finish and light edits.
   Those live value updates must create zero pipelines. Validate changed pixels and unchanged resource
   counts where the operation only updates bindings.
5. **Visitor delivery.** Use the same accepted Experience and release to traverse real Preview and a
   local prepared-publication route with anonymous input, including zero-node free Explore, guided
   movement/holds, reload/enter/leave and asset failures. Keep scene, camera and editorial order stable
   through loss/recovery, with no authoring imports in either visitor surface. A successful first-frame
   event means the onscreen scene was drawn; snapshots, warmup and failed fallback never satisfy it.
6. **Repo tests and implementation successors.** Run the existing ownership, render-layer,
   Material/LightStore, model, texture, Layout representation, look, first-frame, camera, pick, and
   preview/public boundary coverage for the touched contracts. Extend `canvas-tone-mapping` to inspect
   both mounted contexts after readiness. Replace `managed-webgl-renderer` with owning-host/generation
   plus two-real-Canvas regression coverage. Migrate `shadow-invalidation`, `shadow-g4-counts`,
   `lift-shadow-eligibility`, `stage-render-frames`, `slice-clip-uniforms`, `stage-clip-shadows`,
   Slice/cutaway, snapshot and model/Artwork suites against the successor behavior. Update the existing
   renderer-lifetime, stage-clip and Slice ink browser fixture entries under `apps/editor/perf/` and
   verify explicit B/C provenance for the GPU-dependent assertions. Add assertions for mounted loss and
   half-initialized startup, packed/oriented async readback, Stage/Visitor colour parity, top-left
   scissor, and backend-independent picking. Keep the documentation, architecture and full merge-gate
   selection in [editor tests](../../../../apps/editor/tests/README.md). Browser runs are focused on
   these contracts. Broad capture, scripted end-to-end replay, and the suspended perf matrix are outside
   this gate.

Update the exact portability guard to reject production `WebGLRenderer`, `WebGLRenderTarget`,
`ShaderMaterial`/raw GLSL, `onBeforeCompile`/program-key patches, non-2D context calls, legacy line
import paths and custom depth/distance attachments. Distinguish permitted common line geometry from old
render classes. Guard renderer/TSL API imports by resolved module reachability and owning factory/Stage
ink seams, including aliases/namespaces and Svelte `T.*`. Keep the existing material, layer, light,
identity and model lifetime boundaries, and the full resolved Preview/public graph checks. Any test-only
A baseline stays isolated from the app client/server graphs.

## Cutover, rollback and S8 handoff

The integrated PR is ready when both backend rows pass on the reference machines, default startup and
loss recovery are tested, Stage/Preview/public use the shared host, the assigned appearance and
interaction contracts pass, and the old renderer factory and ports are gone from product and dev routes.
Attach the fixture/revision/actual backend results, known browser availability and any unmeasured
diagnostics in the PR. Have the owner review the focused visual/user flows and activation under the
repo's Tier 2 rules. In that PR update the ongoing rendering reference (lifecycle, pass ownership,
clipping, snapshot, shadow and portability rules) and replace the older T2 two-renderer direction with
the unified contract.
Add the merged migration as an S8 prerequisite there. Keep historical evidence in place and use this
plan's PR history for the implementation record.

Keep the previous deployable revision and build at activation and through the first five business days
of supported-device observation. Monitor first-frame/fallback errors and reports of visibly incorrect or
slow frames through the cutover PR. A supported-device first-draw/recovery failure, a colour/feature
regression, or a confirmed performance gate failure blocks activation. After activation such a failure
calls for rolling back the **whole renderer cutover** by redeploying the previous compatible build and
reverting the cutover as needed. Scene, project and release bytes are unchanged by the migration, so no
data rollback or release rebuild is required. Ordinary recovery still uses the built-in compatibility
backend.

If a genuine blocker survives a targeted correction, stop the cutover. Record the smallest failing
World/asset and operation, pinned Three/Threlte versions, browser/device/backend, logs or pixels, which
threshold failed, reproducible A/B/C results, and the source/API causing the failure. First bring an
upstream fix or a pinned version correction with a verified blast radius and both backend results. If
that is unavailable, leave the existing production revision in service and bring the owner a bounded
deferral of the whole cutover, with the explicit target date/condition and affected devices. A
device-specific compatibility exception needs an owner decision, a tested removal condition and an
expiry review. No permanent native renderer branch, silent quality reduction, disabled shadow control,
serialized feature split or S8 work on a partial port enters this plan.

S8 can start after the integrated cutover and owner acceptance. Its starting point is the shared Finish
resolver, descriptor, texture colour-space/map/UV lease path, and the shared material factory with
demonstrated B/C fidelity. S8a and S8b retain their existing order and own their own map UI, import,
licensing and any optical-feature gates. The renderer migration needs no S8 changes to be complete.
