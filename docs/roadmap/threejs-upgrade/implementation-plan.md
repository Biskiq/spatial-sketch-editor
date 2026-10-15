# Three.js upgrade — scoped maintenance PR

**Status:** proposed; implementation-ready, awaiting owner authorization to execute.
**Research date:** 2026-10-14 (America/Toronto).
**Baseline:** `61baf02873a63d37e3f5a3e2992396f387600d38`, the PR #116 merge,
on `chore/threejs-upgrade`; the worktree was clean at inspection.
**Scope:** dependency modernization and demonstrated compatibility fixes only.
**VERIFICATION: exhaustive** for the eventual implementation PR, under the
[test manual](../../../apps/editor/tests/README.md#what-a-change-requires).

This proposal is an unscheduled maintenance unit, not a T1 capability phase,
an F-interface provider or authorization to rebuild the editor. The
[roadmap](../README.md#track-register) and
[current baton](../../operations/current.md) retain their existing lifecycle.
The current implementation and destination remain distinct under the
[architecture contract](../../reference/architecture.md).

## 1. Recommendation and boundary

Upgrade directly from **Three.js 0.175.0 to 0.186.1 (r186)** and from
**`@types/three` 0.175.0 to 0.186.0** in both declaring workspaces. Keep
**`@threlte/core` 8.5.16** and **`@threlte/extras` 9.21.0** at their existing
lockfile resolutions. Explicitly select `PCFShadowMap` in the two canvases that
enable shadows. Preserve the current WebGL renderer, Camera authority,
architectural compiler, persisted formats and public import boundaries.

The [npm runtime metadata](https://registry.npmjs.org/three/latest) identifies
0.186.1 as stable `latest`, published 2026-09-24. The
[type metadata](https://registry.npmjs.org/@types/three/0.186.0) identifies
0.186.0 as the matching latest r186 declaration package, published 2026-09-11.
Their patch numbers need not match. The
[r186 release](https://github.com/mrdoob/three.js/releases/tag/r186) and published
tarball confirm the target. The live migration guide already contains r187
development changes; **r187 is outside this target**. Recheck metadata when
execution starts, but do not silently retarget the PR.

Three's [migration guidance](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
recommends steps of ten releases because warnings survive ten releases. This
upgrade crosses eleven. A direct PR is still defensible: the surviving API
surface is small, all intervening sections were inspected, types are available,
peer ranges admit the target after one internal peer edit, and no retained
consumer needs a removed API. There is no evidence that an intermediate shipped
version reduces the main risks: PBR and shadow changes already occur before r186.
Use an intermediate version only to isolate a concrete failure, not as a second
planned PR.

Excluded: WebGPU/TSL, render or lighting redesign, new Stage/projection wiring,
restoring removed Plan/3D authoring, new navigation or interpolation authority,
schema migrations, asset regeneration, broad Threlte/Svelte/Vite upgrades,
renames, dead-code cleanup, prototype modernization and external frozen-project
changes. Visible differences are reviewed; they are not compensated by changing
authored material/light values or replacing shaders in this PR.

## 2. Actual dependency and runtime baseline

The manifests, `package-lock.json` (v3) and `npm ls ... --all` agree. There is
one physical Three installation and one r175 type installation; every listed
Three consumer resolves to that copy. This matters for `instanceof Mesh`,
Threlte's catalogue and loader results.

| Declaration / resolution | Post-#116 baseline | Proposed result |
| --- | --- | --- |
| [editor manifest](../../../apps/editor/package.json): runtime Three | `^0.175.0` → 0.175.0 | `^0.186.1` → 0.186.1 |
| Editor declarations | `^0.175.0` → 0.175.0 | `^0.186.0` → 0.186.0 |
| [camera-core manifest](../../../packages/camera-core/package.json): development Three/types | same r175 ranges and resolutions | same r186 ranges as editor |
| Camera peer | explicit union `^0.170.0` through `^0.175.0` | preserve that union and append `\|\| ^0.186.1` |
| Threlte core | `^8.0.4` → 8.5.16; peers Three `>=0.160`, Svelte `>=5` | preserve manifest and lock resolution |
| Threlte extras | `^9.0.2` → 9.21.0; same peers | preserve manifest and lock resolution |
| Svelte / TypeScript / Vite / Vitest | 5.56.4 / 5.9.3 / 6.4.3 / 3.2.7 | preserve resolutions |
| GLTF Transform CLI | 4.4.1 | preserve; no asset rebuild |

Caret ranges for `0.186.x` stop before `0.187.0`; they permit patches, not the
next Three revision. The peer union adds only the selected revision, without
asserting compatibility with every intervening or future revision. Existing
historical peer declarations are preserved; this PR verifies r186, not a matrix
of r170–r175. `camera-core` is private and consumed through workspace exports.

The lockfile's transitive peer constraints also admit r186: instanced-sprite-mesh
2.5.1 (`>=0.170.0`), camera-controls 3.1.2 (`>=0.126.1`), three-mesh-bvh 0.9.10
(`>=0.159.0`), three-perf 1.0.11 (`>=0.170`), three-viewport-gizmo 2.2.0
(`>=0.162.0 <1.0.0`), Troika utilities/text and instanced-uniforms-mesh
(`>=0.125.0`), and maath 0.10.8 (Three/types `>=0.134.0`). Most of these are
extras dependencies, not features used by the retained renderer. Peer acceptance
is installation evidence, not proof of runtime compatibility.

`@types/three` r186 requires TypeScript **5.6**, satisfied by installed 5.9.3.
Its required dependency changes include meshoptimizer `~1.1.1`, fflate `~0.8.3`
and Rapier declarations/runtime package `~0.12.0`; its dependency list no longer
contains `@webgpu/types`. Allow resulting lockfile entries/deduplication only
where caused by the selected type package. These do not authorize physics or
WebGPU features. Runtime `useMeshopt()` loads the decoder shipped in **Three's
addon**, not the declaration package's npm meshoptimizer dependency.

The root engine is Node `>=20`, while already-locked camera-controls 3.1.2
declares Node `>=22` / npm `>=10.5.1`. This pre-existing mismatch is not introduced
by Three. Research ran on Node 26.7.0 / npm 11.19.0. Record the execution runtime;
use an environment satisfying the existing tree rather than hiding engine
warnings. Changing the repository's supported Node policy is separate scope.

Latest stable Threlte versions were also checked: core **8.6.1** and extras
**9.22.1**, both with Three `>=0.172` / Svelte `>=5` peers. Inspection of their
published packages found no required correction to the used GLTF/Meshopt/
OrbitControls/disposal seams. Core's renderer still selects `PCFSoftShadowMap`
for boolean `shadows`. Updating Threlte would therefore not remove the concrete
shadow fix and would add independent changes. Keep the existing versions unless
execution demonstrates a specific compatibility failure fixed upstream.

## 3. Retained code paths and impact

| Consumer | Behavior to preserve / expected action |
| --- | --- |
| [VisitorPreviewSurface](../../../apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte) | Threlte `Canvas`, DPR `[1, 1.5]`, fog, opaque scene background, ambient/directional illumination. Import `PCFShadowMap` and replace boolean `shadows` with `shadows={PCFShadowMap}`. |
| [asset dev route](../../../apps/editor/src/routes/dev/assets/+page.svelte) | Second shadow-enabled Canvas; same explicit shadow fix. GLB selection, wireframe, bounds, rotation, scale and shadow toggles remain usable. |
| [material dev route](../../../apps/editor/src/routes/dev/materials/+page.svelte) | `shadows={false}` remains valid. Compare textured and `?textures=off` materials; no anticipated source edit. |
| [VisitorLayoutShell](../../../apps/editor/src/lib/visitor/VisitorLayoutShell.svelte), [wall adapter](../../../apps/editor/src/lib/render/wall-geometry-adapter.ts), [wall material factory](../../../apps/editor/src/lib/museum/layout/wall-material-factory.ts) | Shape floors/ceilings, canonical wall buffers, index-space material groups, normals/UVs and compiled Junction/opening geometry. Preserve idempotent geometry disposal and separately owned shared materials; no new topology solve. |
| [VisitorEntities](../../../apps/editor/src/lib/visitor/VisitorEntities.svelte), [EntityPrimitive](../../../apps/editor/src/lib/museum/entities/EntityPrimitive.svelte), [EntityLight](../../../apps/editor/src/lib/museum/entities/EntityLight.svelte) | World-local placement; box/plane/cylinder/sphere, scalar scaling, point/spot/directional lights, local light target and cast/receive shadows. No Capsule geometry or FirstPersonControls use. |
| [AssetModel](../../../apps/editor/src/lib/museum/assets/AssetModel.svelte), [model utilities](../../../apps/editor/src/lib/museum/assets/model-utils.ts), [material remap](../../../apps/editor/src/lib/museum/assets/instance-material-remap.ts) | `useGltf({ meshoptDecoder: useMeshopt() })`, SkeletonUtils clone, per-instance materials, bounds/metrics, fallbacks, cancellation and scoped remap. Preserve shared source geometry/textures and cloned-material ownership. |
| [MuseumMaterial](../../../apps/editor/src/lib/museum/materials/MuseumMaterial.svelte), [SceneInstanceMaterial](../../../apps/editor/src/lib/museum/materials/SceneInstanceMaterial.svelte), [texture cache](../../../apps/editor/src/lib/museum/materials/texture-cache.ts) | MeshStandardMaterial, sRGB color map vs `NoColorSpace` data maps, repeat/rotation, ref-counted cloned variants, scope-qualified cache identity. No anticipated API rewrite. |
| [public route](../../../apps/editor/src/routes/p/[publicationId]/+page.svelte), [cold runtime](../../../apps/editor/src/lib/visitor/visitor-cold-runtime.ts), [release client](../../../apps/editor/src/lib/visitor/public-release-client.ts), [texture scope](../../../apps/editor/src/lib/visitor/visitor-texture-scope.ts) | Anonymous strict current-format bootstrap and verified bytes → object URLs → callback-based TextureLoader → retained surface; abort/retry/navigation/unmount release the appropriate scope. Keep editor machinery outside this closure. |
| [VisitorCameraDirector](../../../apps/editor/src/lib/visitor/VisitorCameraDirector.svelte), [camera motion](../../../packages/camera-core/src/camera-motion.ts) | Guided position/target/FOV sampling through Camera, `useTask` delta, `lookAt` and projection update; zero-node OrbitControls and reduced motion. No Three Clock. Preserve endpoints, timing and framing guards. |
| [retained authoring semantics](../../../apps/editor/src/lib/authoring/README.md) | Camera CurvePath/Matrix4 math and Scene Box3/OBB helpers still type-check. They do not constitute an editor Stage; direct behavioral coverage is incomplete. Keep their current ownership. |
| [Vite config](../../../apps/editor/vite.config.ts) | Existing prebundling includes Three, Threlte, line addons, TransformControls and SkeletonUtils. Target exports still support both `three/addons/*` and `three/examples/jsm/*`. Do not prune unused entries as part of this upgrade. |

`layout-core` has no Three dependency; `project-model` has no direct Three
import, but depends on `camera-core`. The API consumes `project-model` validation
and publication paths, so shared dependency verification extends to it even
though no API manifest edit is anticipated.

The installed Threlte renderer uses WebGLRenderer with antialiasing/alpha,
sRGB output, enabled color management and **AgX tone mapping**. Keep these
settings and the Canvas scheduling/resize contract. No application renderer
factory or postprocessing pipeline exists to migrate.

## 4. Migration history screened against this tree

The full r175→r186 interval was screened, including changes reached indirectly
through Threlte's addons. This is a relevance assessment, not a claim that every
upstream change needs an application patch.

| Transition | Relevant migration fact and disposition |
| --- | --- |
| 175→176 | GLTFLoader stops WebP/AVIF support probing; Capsule argument rename is unused. |
| 176→177 | ColorManagement method renames and Three JSON version change; no matching app calls/serialization. |
| 177→178 | Multiply/Subtractive blending needs premultiplied alpha; neither mode is authored here. |
| 178→179 | Timer enters core; reverse-depth option rename. Neither is configured here. |
| 179→180 | RGBE→HDR loader and depth shader defines change; unused. |
| 180→181 | PBR lighting/energy compensation changes appearance; visual comparison required. |
| 181→182 | WebGL soft-shadow modernization; explicit `PCFShadowMap` required. |
| 182→183 | Clock deprecated; RoomEnvironment/Sky changes. None is used. |
| 183→184 | File/ImageBitmap loader return changes, environment rotation and FirstPersonControls changes; no direct dependency. |
| 184→185 | World-matrix dirty-flag semantics change; inspect bounds helpers. Other changed loaders/shaders are unused. |
| 185→186 | Object disposal and texture-source rename; GLTF triangulation becomes in-place. Review ownership and addon loading. |

Source for the transition screen:
[official migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide).
WebGPU/TSL-only changes throughout the interval were screened and excluded;
they do not require replacing the WebGL material/render path.

### Required shadow compatibility fix

The target's [WebGLShadowMap implementation](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/src/renderers/webgl/WebGLShadowMap.js)
warns and substitutes PCF when passed `PCFSoftShadowMap`. The guide describes
the earlier deprecation; target source confirms the old filtering implementation
is gone. Both existing and latest Threlte map boolean `shadows` to the old
constant. Pass the numeric `PCFShadowMap` constant at the two application call
sites instead of patching node_modules or adding a renderer abstraction.

Shadow filtering and point-light shadow targets changed upstream. Browser-check
point, spot and directional casters, receivers, wall openings and thin geometry;
do not tune bias/map sizes without a demonstrated regression. This is a render
compatibility change with possible visual differences, not a promise of pixel
identity to r175.

### PBR appearance and texture decoding

[Direct-light energy compensation](https://github.com/mrdoob/three.js/pull/32072)
can brighten rough materials, and the
[r181 release](https://github.com/mrdoob/three.js/releases/tag/r181) records
indirect specular/PMREM improvements. The retained plaster, wood, paper, brass
and GLB materials need comparison under the same lights, camera, browser, DPR
and exposure. Keep authored roughness/metalness/colors and AgX; material or
lighting art direction would expand scope.

Binary JSON inspection of **all seven shipped GLBs** found
`EXT_meshopt_compression` and `EXT_texture_webp`, triangle primitives (mode 4)
and no skins. The oil lamp also uses `KHR_materials_transmission`; the chandelier
uses emissive strength. These are meaningful retained paths: exercise decoding,
transmission and emissive rendering, not just a plain primitive. WebP browser
support must be checked in the agreed browser set because probing/fallback
behavior changed. No AVIF, Draco or KTX2 assets were found in that shipped set.

### Ownership, matrices and addon changes

[Object3D disposal](https://github.com/mrdoob/three.js/pull/34141) adds an event;
the [target implementation](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/src/core/Object3D.js)
does **not** recursively dispose children, geometries, materials or textures.
Threlte will now register Groups/Meshes as disposable, but its current disposal
operates on referenced `<T>` instances. `AssetModel` mounts the loaded root via
`<T is={instance}>`; its explicit cleanup still owns cloned materials. There is
no application Object3D subclass overriding `dispose()` to repair. Do not add
deep shared-geometry disposal or assume root disposal cleans a GLB subtree.
Observe model switching/unmount and repeat mounts for new exceptions or resource
growth; repair only upgrade-caused ownership failures, with a behavioral test.

[World-matrix updates](https://github.com/mrdoob/three.js/pull/33746) now honor
dirty flags when local matrix auto-update is disabled. The retained OBB helpers
call `updateWorldMatrix`, but no application call disables `matrixAutoUpdate`
or writes local matrices directly. No dirty-flag patch is currently justified;
verify nested transforms and bounds if type/runtime evidence points there.

`Source` becomes `TextureSource`, while `Texture.source` remains the property.
There is no named `Source` import in the application or used Threlte seams.
Preserve fake-loader intent if stricter types require fixture edits; prefer real
Texture instances for new ownership tests.

`toTrianglesDrawMode()` changes indirectly through
[target GLTFLoader](https://github.com/mrdoob/three.js/blob/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/jsm/loaders/GLTFLoader.js):
conversion occurs before primitive-cache installation. No shipped strip/fan
primitive exercises it. Do not add an app-level clone workaround without a
failing asset; retain the loader's ownership rather than duplicating its logic.
SkeletonUtils' used clone implementation and CurvePath's core path behavior
showed no required change in the inspected source comparison.

The 0.186.0→0.186.1
[upstream comparison](https://api.github.com/repos/mrdoob/three.js/compare/148ef33ecb6d2502ff796d4554abd1549c95d519...9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8)
contains node/common-renderer fixes, not a new WebGL application migration.
Select the latest stable patch nevertheless. WebGL 2 was already required by
r175; this upgrade does not introduce the original WebGL 1 removal.

## 5. Implementation sequence after approval

1. Confirm the baseline/rebase diff and approved target. Record Node/npm,
   dependency resolutions and browser/GPU environment. Capture the retained
   renderer's r175 specimens before dependency edits; use the same fixture
   inputs and renderer settings for comparison.
2. Edit only the Three/type ranges in both manifests and the Camera peer union
   **before** resolving, so npm cannot satisfy the old peer with a second Three.
   Regenerate the existing lockfile through npm without deleting it, using a
   lockfile-only/ignore-scripts pass to review the solver result, then `npm ci`.
   Reject unexplained refreshes of Threlte, Svelte, Kit, Vite, Vitest, asset
   tooling or unrelated services. Keep unavoidable r186 type dependencies.
3. Confirm `npm ls three @types/three @threlte/core @threlte/extras --all`
   is valid and deduplicated to the approved resolutions. Do not use
   `--legacy-peer-deps`, `--force`, overrides or warning suppression.
4. Apply the two explicit shadow constant edits. Run app/package checks and
   affected contracts. Make only demonstrated API/type compatibility fixes;
   annotate their migration cause in the PR. Remove only this app's generated
   Vite dependency cache when needed, or start Vite with force reoptimization,
   so stale r175 prebundles cannot contaminate browser evidence.
5. Build the production editor and perform the browser matrix below against
   that build as well as development previews. Capture differences and console/
   network results. If visual changes are unacceptable, stop for an owner
   decision; do not redesign rendering or alter authored values to make a
   screenshot look old.
6. Run the exhaustive merge gate on the final code/dependency tree. Record
   evidence in an acceptance record beside this plan and the PR description;
   include tree/base identity, exact resolved versions, commands/results,
   zero-skip DB evidence and the browser fixture/environment identity.
   No commit, push or PR publication is implied by this planning request.

Expected production diff: two manifests, the lockfile and two Svelte Canvas
call sites. Conditional changes are confined to the retained renderer/visitor/
Camera/authoring compatibility seams above and necessary test fixtures. A
failure requiring new architecture, broader dependency upgrades or a retained
behavior redesign needs a scope decision before editing those concerns.

## 6. Verification and regression acceptance

### Existing coverage and gaps

| Evidence | What it proves / does not prove |
| --- | --- |
| [wall adapter contract](../../../apps/editor/tests/lib/render/wall-geometry-adapter.test.ts) | Real Three buffers, attributes, groups, metadata and resource leases; no GPU image or shader proof. |
| [Camera tests](../../../apps/editor/tests/lib/museum/navigation/camera-motion.test.ts), [dense sweeps](../../../apps/editor/tests/lib/museum/navigation/camera-motion-dense-sweeps.test.ts) and adjoining route/path/timing/framing suites | Real Three math, endpoints, seek stability, distance/time behavior, target guards, FOV/near-clip invariants; no mounted `useTask` or OrbitControls interaction proof. |
| [material remap](../../../apps/editor/tests/lib/museum/assets/instance-material-remap.test.ts), [texture cache](../../../apps/editor/tests/lib/museum/materials/texture-cache.test.ts), [scene material resolution](../../../apps/editor/tests/lib/museum/materials/scene-instance-material.test.ts) | Material mapping, cache/reference semantics; texture loading uses fakes, so it cannot prove browser decoding, upload or color rendering. |
| [cold runtime](../../../apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts), [public route](../../../apps/editor/tests/lib/visitor/visitor-public-route.test.ts), [format parity](../../../apps/editor/tests/lib/project-model/project-format-visitor-parity.test.ts) | Strict reader, byte identity, scope separation, errors/aborts/URL disposal and source wiring. These are Node contracts, not mounted public renderer E2E. Cold static-resource assertions inspect build output only when it exists: build before final suite. |
| [lane membership](../../../apps/editor/test-lanes.ts), Camera/Layout/project-model/public/preview/Vite boundaries | One authority and visitor isolation; full arch lane and actual build graph still required. No tracked CI automatically enforces this today. |
| Retained authoring math and model utilities | Type checks include them, but no surviving test directly imports the retained Camera-authoring/OBB helpers or `model-utils`. Do not claim their old shell tests still run. |

All Vitest lanes use Node. There is no retained mounted Svelte/WebGL renderer
test harness and no editor Stage to exercise. Do not invent editor-gizmo,
selection, Plan/3D toggle, placement or timeline journeys as upgrade acceptance.
Those are future T1/T2/T3 integration obligations, explicitly outside this PR.

For iteration, run complete files in the wall adapter, material/remap, visitor
and Camera families, including the dense Camera contract. Add a small real-Three
model clone/cleanup contract only if cleanup changes or a demonstrated failure
needs a lasting oracle: two instances may share source geometry/textures while
owned materials remain independent; deleting one must leave the other usable.
Do not add tests merely asserting dependency strings or implementation syntax.
Any compatibility change to an uncovered retained helper needs a focused
behavioral contract for its inputs/results, not restoration of the old shell.

### Browser matrix for the retained renderer

Use the [browser-hygiene skill](../../../.agents/skills/browser-hygiene/SKILL.md)
when execution starts a browser. Reuse one owned session; close only task-owned
surfaces/processes. Compare baseline and target with identical dimensions, DPR,
camera, lights and fixture bytes. Use current Chromium and Safari/WebKit on the
available macOS environment; record actual versions/GPU and any unavailable
browser rather than substituting a Node run. Broader browser support requires
an agreed supported-browser matrix, not a claim based on peer dependencies.

| Journey | Acceptance |
| --- | --- |
| `/dev/materials` and `?textures=off` | All six material previews load; repeat/rotation, color vs data-map handling, rough/metal appearances and fallback colors remain coherent. Review expected PBR differences with paired images. |
| `/dev/assets` | Exercise all seven approved GLBs, especially piano multi-mesh, oil-lamp transmission and chandelier emissive materials. Meshopt/WebP load; metrics/bounds, scale, quarter rotation, visibility, wireframe and shadow toggles work. Induce a model load failure and confirm fallback. Switch models/revisit/unmount repeatedly; no new errors or sustained resource growth relative to baseline after warmup. |
| Cold `/p/:publicationId` with test data | Anonymous load of an empty/zero-camera project, a connected two-node tour, canonical walls with opening and Junction, world-local primitives and all three light kinds, a built-in model and scoped custom texture/remap. Verify guided forward/back, look-around, zero-node orbit/pan/zoom, reduced motion, resize/DPR and shadow behavior. |
| Public lifetime/error cases | Reload, retry, abort/navigate during load, and switch releases with colliding logical texture URIs; no stale images, partial install, leaked object URLs or editor/session requests. Capture console and network evidence. |
| Surviving product routes | Smoke `/`, `/projects`, `/editor`, `/project/x/spatial` and `/p/x`; the existing notice/redirect/error behavior works without new console errors. No frozen-project routes or removed authoring journeys. |

There are currently **no deployed releases**, and the publish UI was removed.
Do not wait for a live publication or restore publishing to test rendering.
Use a disposable local DB-backed API test publication or a reproducible local
HTTP fixture serving the existing public manifest/versioned byte endpoints;
bind it through `PUBLIC_API_ORIGIN` without changing the visitor reader or
adding a production route. Build fixtures through the existing strict
project-model constructors/validators and Camera connection shapes. Do not use
the unit tests' magic-header-only PNG as a browser image: supply decodable
texture bytes with correct MIME/length/magic. Keep QA-only fixture servers and
browser instrumentation out of production imports. A fixture HTTP server
proves the browser contract; the separate DB API suite proves persistence.

The fixture cases can be one bounded composite project plus an empty project.
Retain reproducible current-format inputs and comparison images as QA evidence
with the acceptance record, without adding a new benchmark registry/runner.
Resource counts/frame observations are diagnostic comparisons, not new timing
thresholds. Measure comparable frame/memory workloads further only if the
shadow/loader change shows a material slowdown; do not resurrect `/dev/perf`.

### Final implementation gate

Dependencies affect the shared graph; use exhaustive acceptance. The
[test manual](../../../apps/editor/tests/README.md#slice-verification-tiers-the-pr-115-wp5-cutover)
and retained
[verification ladder](../parallel-track-cutover/implementation-plan.md#77-verification-ladder-and-future-slice-acceptance)
require the complete pre-merge contract, including API DB tests. Root commands
cover the editor only. Run from the repository root:

```sh
npm ci
npm ls three @types/three @threlte/core @threlte/extras --all
npm run check
npm run check:camera-core
npm run check:layout-core
npm run check:project-model
npm run check:api
npm run build
npm run test:arch
npm test
npm run test:api
git diff --check 61baf02873a63d37e3f5a3e2992396f387600d38
```

`npm test` includes fast, arch and **heavy** correctness; an additional final
`test:heavy` run is unnecessary when that same full suite passes. The explicit
arch run stays required. `test:api` builds the API and needs reachable Postgres
with **zero skips**; record the DB target category without secrets. A skipped
DB suite is unexecuted coverage, not acceptance. Record browser results and
visual review separately. No dependency workaround, skipped/relaxed invariant,
format change, second Three instance, new public editor import or unreviewed
appearance compensation may be accepted to obtain green output.

## 7. Failure strategy, owner calls and planning evidence

If direct-upgrade checks fail, isolate the exact failing contract/asset first.
For a revision-specific regression, a temporary **0.185.1 / `@types/three`
0.185.0** diagnostic run provides a ten-revision boundary. It is not an approved
fallback release, and both diagnostic and final installs must preserve matching
revision types and a single runtime. An old-vs-new comparison must use identical
fixtures. A narrow compatibility fix can stay here; an upstream regression
without a scoped repair requires an owner choice to defer, hold a demonstrated
working version or expand scope. Restore baseline manifests/lockfile and
compatibility edits together if abandoning the attempt; never overwrite other
work or roll back project data.

**Owner decisions:**

- Authorize execution of this maintenance proposal and its direct r186 target;
  planning alone changes no track/capability eligibility. If registered as a
  repository phase/slice, establish its owner/start route before execution;
  this document does not manufacture a phase or bypass F gates.
- Accept the reviewed upstream PBR/shadow appearance differences, or defer if
  preserving the old artistic appearance is a requirement. That review follows
  concrete paired specimens; no approval of unseen visual changes is assumed.
- Decide only if evidence requires broader Threlte/engine changes, an alternate
  target, unavailable required browser/DB coverage or rendering redesign.
  None is currently proposed as necessary. Weakening the merge gate requires
  an explicit owner ruling; this plan recommends completing it.

**Evidence obtained during planning:** manifests, actual installed/locked tree,
target npm metadata/tarballs, all intervening migration sections, relevant addon
and Threlte implementation comparisons, retained app/package consumers,
shipped GLB binary JSON, surviving test contracts/lane configuration and the
post-#116 architecture/test authorities. Tarballs were inspected outside the
workspace; they were not installed. No target type-check, GPU/browser QA or
product/API test pass is claimed. The only workspace changes from this task are
this proposal and its roadmap link; documentation/arch gate results accompany
delivery of the plan.
