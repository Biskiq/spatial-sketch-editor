# Three.js r187 upgrade plan

Upgrade from Three.js 0.186.1 to 0.187.0 in one maintenance PR before T2 Look & Atmosphere.
Audit base: `837577a7b381` on `main`. This first commit is the plan for review. Implementation
keeps WebGL, the existing Canvas lifetimes, and the current editor, Preview and public rendering
boundaries. Canonical documents and resources, Layout compilation, Camera evaluation and
release payloads stay as they are.

## Dependencies

| Target | Current manifest and lock | Implementation change |
| --- | --- | --- |
| [Editor manifest](../../../apps/editor/package.json) and [camera-core manifest](../../../packages/camera-core/package.json) | `three: ^0.186.1` → `0.186.1` | Both to `^0.187.0`, resolved to `0.187.0`. |
| Same two manifests | `@types/three: ^0.186.0` → `0.186.0` | Both to `^0.187.0`, resolved to `0.187.0`. |
| Camera-core Three peer | Existing union through `^0.186.1` | Append ` \|\| ^0.187.0` and retain earlier ranges. |
| [Root lockfile](../../../package-lock.json) | One physical Three and one types package | Regenerate workspace metadata and the two package resolutions and integrity entries. Require one copy of each. |

Keep Threlte core **8.5.16** and extras **9.21.0** at their existing lock resolutions and retain
their manifest ranges. Both declare Three `>=0.160` and Svelte `>=5`. Core still imports
`PCFSoftShadowMap`, which r187 continues to export at runtime and in the types. The obsolete
filter mode already falls back to PCF in r186. Stage, Visitor and the dev asset Canvas
explicitly pass `PCFShadowMap`, and the dev material Canvas disables shadows. Core continues
to own scheduling, resize, output color, tone mapping and Canvas teardown. Extras still uses
Three's add-on loaders and decoder, and supplies Visitor's zero-node orbit control.

A static import/export comparison of product and locked Threlte sources against the published
r187 ESM package found zero missing runtime names across 158 import/export declarations.
The locked Three peers of extras' transitive consumers accept 0.187.0. The new types package
declares the same transitive dependency ranges. Keep Svelte, Vite, glTF Transform, Draco,
meshoptimizer and the related packages at their existing resolutions. Target builds, types and
live behavior remain implementation checks. [Three npm artifact](https://registry.npmjs.org/three/0.187.0),
[types npm artifact](https://registry.npmjs.org/@types%2fthree/0.187.0),
[core metadata](https://registry.npmjs.org/@threlte%2fcore/8.5.16),
[extras metadata](https://registry.npmjs.org/@threlte%2fextras/9.21.0).

## Code targets and compatibility

Paths in this table are relative to the editor's `src/lib` unless linked elsewhere.

| Area | Finding and action |
| --- | --- |
| Renderer ownership | In `render/managed-webgl-renderer.ts`, plan to retire the r186 `dfgLUT` discovery hook and global lookup disposal. In the published r187 source, `WebGLRenderer.dispose()` invokes `WebGLTextures.dispose()`, which removes the retiring renderer's listeners and frees its uploads, including the shared DFG texture, without dispatching disposal to the surviving renderer. Keep the same factory, constructor options (including Stage stencil), four Canvas callers and Threlte cleanup. Keep explicit app cleanup for owned targets, textures, geometry, caches and leases. Validate the survivor before removing the shim. [WebGL texture teardown](https://github.com/mrdoob/three.js/pull/34530), [r187 renderer source](https://github.com/mrdoob/three.js/blob/r187/src/renderers/WebGLRenderer.js). |
| Snapshot and live viewport | Update the stale DPR comment in `authoring/stage/shell/StageSnapshotRenderer.svelte`. r187 applies renderer DPR in `setViewport` and `setScissor` only on the default framebuffer. Snapshot already sets target-local viewport and scissor in physical pixels before binding, then restores the previous target before viewport/scissor restoration. Preserve this sequence, target reuse/disposal and world-only mask. `StageCamera.svelte` still supplies logical pixels on the default framebuffer. Verify successful and failed captures preserve renderer state and the next live frame. No numeric conversion is required on these call sites. [Viewport change](https://github.com/mrdoob/three.js/pull/34460). |
| Layout, selection and custom shaders | `render/wall-geometry-adapter.ts` keeps compiler positions, normals, UVs, indices, groups and pick ranges. `StageSelectionLayer.svelte` and `stage-outline.ts` keep screen-space, depth-tested, biased lines. The upstream line fixes affect world-unit branches, so no contour rewrite is expected. `stage-mat-grid.ts` uses custom GLSL and the existing `colorspace_fragment` chunk without CubeUV sampling. Check grid, stencil, occlusion, aperture rims and picks in Paper and Shaded readings. [Release notes](https://github.com/mrdoob/three.js/releases/tag/r187). |
| Shadows | r187 WebGL uses a shadow camera's layer mask when it enables any nonzero layer. Otherwise it keeps using the viewing camera's layers. `render/WorldEnvironment.svelte` and `museum/entities/EntityLight.svelte` do not assign shadow-camera layers, so keep the existing masks, bias and invalidation in `StageShadowTriggers.svelte` and `render/shadow-invalidation.ts`. Take the point-light seam and disposal fixes as shipped. Check that the real PCF passes still update on caster/light changes and ignore helpers. [Shadow layers](https://github.com/mrdoob/three.js/pull/34670), [point-light seams](https://github.com/mrdoob/three.js/pull/35267). |
| Scene, models and textures | Keep `authoring/adapters/scene/import/ingest.ts` on glTF Transform and `museum/assets/AssetModel.svelte` on `useGltf` with Meshopt. Three's GLTFLoader handles the replacement iridescence min/max internally, plus the credential and embedded-KTX2 fixes. Product code does not set the deprecated range or opt into a KTX2 loader. Preserve original bytes, derivative identity, material remaps, cloned-instance ownership and scoped URL cleanup. `museum/materials/texture-cache.ts` keeps sRGB for color maps and no color space for data maps. Keep Threlte's current sRGB output and AgX, with no retuning for the upstream color-conversion matrix fix. [Release notes](https://github.com/mrdoob/three.js/releases/tag/r187), [migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide#186--187). |
| Camera and visitor | Keep the existing Camera matrices, guide timing and visitor renderer. Compare Stage, thumbnails and Preview at the same saved View where their framing is equivalent, allowing for the intended Stage plate and visitor ground differences. The cold public route uses the same visitor surface with its existing default look and release-scoped assets. Check that public chunks exclude editor helpers. |
| Unroll | No live Unroll path on the audited base. The open [Expressive Walls and Unfolding draft](https://github.com/Biskiq/spatial-sketch-editor/pull/287) adds `StageWallDevelopment.svelte` on the existing Stage Canvas, with transient geometry from Layout and existing Camera intent. If it lands first, rebase and run the Unroll row below before merging r187. If r187 lands first, run that row on #287 after rebasing. |

The removed CubeUV mapping, r177 ColorManagement aliases and deprecated TSL normal exports have
no product callers. The other guide changes concern TSL, the WebGPU light-registration API and
XR. There is no product postprocessing stack, custom CubeUV/PMREM path or alternate renderer to
port. r187 WebGL instantiates both `WeakRef` and `FinalizationRegistry`. Check both globals in the browsers used for acceptance. Layout already uses `WeakRef`. If a
supported browser lacks either primitive, defer pending an owner decision on browser support. [Migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide#186--187),
[removed aliases](https://github.com/mrdoob/three.js/pull/34517).

## Environment and material quality

Take the existing-path shader and shadow fixes with r187. The shared World presets use an sRGB
gradient background, hemisphere fill and a directional sun. They do not set `scene.environment`.
The new cube-target PMREM filtering and roughness ramp apply automatically when Three consumes an
eligible reflection environment. There is no current preset benefit to claim. T2 can evaluate
using that path through the shared environment owner, with one target lifetime per renderer and
matching Stage/Preview inputs. EON is opt-in on `MeshPhysicalMaterial` via positive
`diffuseRoughness` and defaults to zero. Preserve current Standard and imported Physical
materials. T2 can judge EON on a rough dielectric without conflating diffuse roughness with
the existing specular roughness. [PMREM implementation](https://github.com/mrdoob/three.js/pull/34585),
[roughness ramp](https://github.com/mrdoob/three.js/pull/34645),
[EON implementation](https://github.com/mrdoob/three.js/pull/34379).

## Implementation sequence

1. On the implementation base, save matched r186 reference views and focused performance and
   teardown observations using the matrix below. Use the same project, assets, camera, viewport,
   DPR, browser and GPU for the candidate.
2. Make the manifest edits and run `npm install --package-lock-only`, then review the diff before
   a clean `npm ci`. Run `npm ls three @types/three @threlte/core @threlte/extras --all`,
   `npm run check` and `npm run check:camera-core`. Resolve concrete failures in place. Treat a
   Threlte bump as a separate decision if a reproducible failure requires it.
3. Update the snapshot comment. Verify native two-Canvas teardown before taking out the DFG shim.
   The current `managed-webgl-renderer.test.ts` fakes the r186 listener and compile hook. Preserve
   the survivor and repeated-teardown guarantees with an equivalent regression check before
   replacing it. If only manual evidence is feasible, retain the shim and its checks by default.
   Any check downgrade requires an owner decision under the repository workflow.
4. Run the full [repository verification contract](../../../apps/editor/tests/README.md#what-a-change-requires)
   and focused browser checks below. Record candidate SHA, browser/GPU/DPR, expected visual
   deltas and any uncovered browser. Owner retains final visual acceptance.

## Verification matrix

Use one saved scene with a closed room and door, native form, approved Meshopt model, textured
wall, reflective or transmissive catalogue model, an authored shadow light and two saved Views.
Use the existing dev asset/material routes and an admissible catalogue-based public fixture where
needed. Run representative focused checks on Chromium and Safari/WebKit if available. Check
DPR 1 and the app's 1.5 cap for frame and capture behavior.

| Surface | Existing automated evidence | Focused browser pass criteria |
| --- | --- | --- |
| Layout, outlines and Unroll | `wall-mesh-builder`, `wall-geometry-adapter`, `stage-pick-differential`, `stage-outline`, `stage-paper`. If #287 is present, include `wall-unfold`, `wall-unfold-opening-drag` and `stage-wall-development-lifecycle`. | Wall/door silhouette, material groups and pointer hits agree. Select, hover and erase preserve line widths, hidden edges and aperture rims during orbit and resize. If Unroll is present, open a curved wall, move an opening in the developed sheet, refold and verify geometry, outline, picking and cleanup. |
| Stage Camera and snapshots | `camera-viewport-evaluation`, dense Camera motion, `stage-snapshots`, `experience-snapshot` and `stage-shell-composition`. | Look through a saved View, resize and generate thumbnails of two aspects. PNGs fill their frame, exclude helper layers and retain correct color/orientation. Next live frame preserves viewport, scissor, clear color and framing. Exercise the failed readback restoration with a focused regression check if the state code changes. |
| Lighting, materials and imports | `shadow-invalidation`, `scene-import-ingest`, `scene-model-render`, `instance-material-remap`, `texture-cache`. | Toggle Paper/Daylight/Golden hour/Dusk. Verify shadows, point-light face seams, ground and sky colors, repeat/rotation, data maps, fallback and transmission. Import one model through the existing UI, check bounds and transform, reopen it and compare Preview. |
| Visitor and persistence | `project-format-visitor-parity`, `guide-run-parity`, `visitor-preview-surface`, `visitor-cold-runtime`, plus Preview and public boundary checks and the production build. | Compare settled Views and guided travel, scrub and exit Preview, check zero-node orbit and anonymous public boot. Verify scoped textures and navigation away during load. Reopen the same saved source on r186 and r187 with matching canonical content. |
| Performance and ownership | `managed-webgl-renderer`, `shadow-invalidation`, `spot-render-wiring`. | On identical warm scenes, compare Stage render counts at rest and during orbit, shadow pass counts, draw calls, frame-time traces and first capture/model display. Use existing renderer diagnostics for `renderer.info` and browser traces. Cycle Preview and snapshots at least five times with Stage alive, change presets, then leave Stage. Live geometry/texture counts should plateau after warm-up, detached canvases and URLs should not accumulate, and Stage must keep rendering. If the shim is removed, closing Preview must also leave the Stage lookup uploaded. Release diagnostic references before measuring retention. |

## Risks and rollback

No blocker identified in package metadata, import checks or source review. The open gates are native
renderer teardown with a surviving Canvas, browser support for the new WebGL primitives and
visual validation of the snapshot and lighting paths. Record expected upstream visual deltas
with matched views. Gate on missing geometry, wrong color or exposure, broken shadow layers,
shader/WebGL errors, load failures, lost renderer state, editor/visitor drift, sustained resource
growth, or a reproducible frame or first-render regression beyond repeat-run variation. Use
paired traces and counters in review instead of adding a timing gate.

If a targeted fix cannot restore a gate, stop the rollout. Revert the upgrade commit set as a
unit, including both manifests, the lock and any compatibility edits, then clean-install r186
and repeat the failing check. The previous reader continues to use the same authored documents
and release payloads.

**Recommendation: upgrade with bounded compatibility fixes.**
