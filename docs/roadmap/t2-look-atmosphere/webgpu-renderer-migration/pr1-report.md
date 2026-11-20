# PR 1 — Pinned native-WebGL baseline and r187 qualification

**Status** · Implementation evidence for PR 1. Native WebGL remains the shipped
renderer; no Stage, Preview or published route has switched. PR 2 has not
started. This is the correction pass requested in review, not a merge.

**Baseline** · `main` at `a53d30deb8ab0c4964bc42a41bf2e0d874ee6786` (merged
planning PR #383). Resolved packages: Three `0.187.0`, `@threlte/core` `8.5.16`,
`@threlte/extras` `9.21.0`.

**Evidence** · [`qualification.json`](./evidence/2026-11-20/qualification.json)
· [`performance.json`](./evidence/2026-11-20/performance.json) ·
[`cold-public.json`](./evidence/2026-11-20/cold-public.json) ·
[`environment.json`](./evidence/2026-11-20/environment.json) ·
[`baseline/fixtures.json`](../../../../apps/editor/experiments/webgpu-migration/baseline/fixtures.json)

## 1. Correction pass

| Review finding | Correction | Evidence |
| --- | --- | --- |
| **P1** — the gallery benchmark declared the plaster texture but drew a procedural 8 × 8 `DataTexture`. | `api/performance.ts` now loads `apps/editor/static/textures/plaster-warm/map.png` through `TextureLoader`; `run.mjs` serves `/textures/*` and `/museum/*` from `apps/editor/static`. The report records the file's 47,350 bytes and `sha256-fbc560b4…eec0`. | `performance.json.fixture.galleryTexture` |
| **P1** — both Canvas hosts leaked the 30-second episode timer on teardown. | `stock-canvas-host.svelte` and `ready-gated-canvas-host.svelte` call `lifecycle.dispose()` from `onDestroy`. Tests assert the episode timer is cleared and the host is disposed on unmount. | lifecycle 11 tests; mounted 14 tests |
| **P2** — `startupSamples()` labelled a submitted draw as the first correct frame. | Startup is split into `firstDrawSubmitted` (render returned; no pixel proof) and `firstVerifiedFrame` (a canvas copy contained a gallery; includes backend wait/readback). Both are reported, separately labelled, and neither is presentation. | `performance.json.rows[].startup`; limitations |
| **P2** — wide lines advertised DPR 1 and 1.5 but only created DPR 1 renderers. | `qualification.ts` loops `[1, 1.5]` per backend, scales the target, readback, thickness and dash sampling by DPR, and records `dpr` plus `drawingBuffer`. WebGPU passes at both; WebGL2 fails at both. | `qualification.json` → `wide-lines` |

## 2. What landed

| Surface | Change |
| --- | --- |
| Baseline | `fixtures.json` pins the commit, resolved packages, S0 comparator geometry and cameras, 17 shipped asset/fixture digests, the canonical current-world fixture, the cold-public evidence and the explicit hardware deferral request. |
| Canvas comparison | Stock Threlte 8.5.16 `Canvas` + adapter and the ready-gated host, sharing `CanvasLifecycle` and one generation owner. |
| Lifecycle tests | `webgpu-canvas-lifecycle.test.ts` (11) and `webgpu-canvas-mounted.test.ts` (14; six cases on both candidates). |
| API qualification | Isolated real Three harness under `experiments/webgpu-migration/api/`; 12 scenarios on native WebGPU and forced WebGL2. |
| Performance | Matched A/B/C gallery using the declared plaster texture, 10 startup samples per row, three 10-second windows, shadow and light-variant probes. |
| Current-world fixture | `scripts/build-webgpu-current-world.ts` deterministically emits a 10-room/31-wall F.2 project, its explicit P20-safe publication projection, two 1 × 1 artwork PNGs and a hashed summary. |
| Cold public baseline | `cold-public.mjs` builds the production app, serves it on loopback with a P20 mock API, and measures 20 fresh-cache public launches in two browser processes. |
| Regression coverage | Stage asymmetric framing, baseline/asset/fixture hashes, cold-public manifest, existing first-frame observer, and an import guard that keeps node/TSL code and product imports out of `src` experiments. |

The experiment tree remains outside `src`. A guard test fails if any product
file imports it or `three/webgpu` / `three/tsl` / `WebGPURenderer`, and a second
guard fails if experiment code imports product modules. The fixture generator
lives in `scripts/`, not `experiments/`, because it deliberately uses the
product's F.2 builders in Node and is not part of a shipped bundle.

## 3. Canvas integration choice

**Chosen: stock Threlte `<Canvas>` with a thin generation adapter.** Both
candidates passed the same mounted contract, including zero pre-ready draws,
delayed and rejected initialization, unmount during init, device loss with a
fresh canvas, a surviving sibling, retained session state, and single idempotent
retirement. The stock path is selected because it keeps Threlte's DOM canvas,
camera/task contexts, resize and scheduler intact; only readiness, recovery,
retirement and teardown are Biskiq's.

The adapter is necessary because 8.5.16 calls `setAnimationLoop()` and
`dispose()` without awaiting their promises and catches only synchronous
disposal errors. `autoRender` is false until ready, the gated child mounts after
readiness, and an outer key gives recovery a genuinely new DOM canvas. The
ready-gated candidate remains in the tree as a comparison and as a fallback if
PR 2 finds a stock-path lifecycle gap.

No Threlte patch or upgrade is needed for PR 1.

## 4. Verified API results

Environment: Apple M2 (8-core GPU), macOS 15.8.2, branded Chrome 157.0.8103.80,
headless, secure loopback origin, Metal-3 WebGPU adapter, DPR 1. The harness
reports the initialized backend; every B row observed `webgpu`, every C row
`webgl2`.

| Probe | Native WebGPU | Forced WebGL2 |
| --- | --- | --- |
| Initialization | `coordinateSystem: webgpu`, 3.7 ms this run, red first draw, disposed | `coordinateSystem: webgl`, 7.2 ms, red first draw, disposed |
| One core | `Vector3`, `Texture`, `ColorManagement` identical across `three` and `three/webgpu`; a legacy scene drew red through `WebGPURenderer` | same |
| Two devices, one texture | both drew the shared texture; the survivor still drew after the other retired | same |
| Projection / scissor | target scissor at `(24,16,60,40)` clipped; outside was background; perspective and orthographic depth kept the near surface | same |
| DPR 1.5 scissor | CSS box `(20,10,80,40)` produced a `(30,15,120,60)` green box in a 300 × 180 buffer | same |
| TSL colour `maskNode` | upper half discarded, lower half drawn | **inverted** (see blockers) |
| Sun shadow | enabling the Sun changed 472 floor pixels; shadow map allocated and enabled | same |
| Wide lines, DPR 1 | 8 px line measured 6 px; dashed line had 7 dashes | 8 px line measured 8 px; **one contiguous segment, no dash pattern** |
| Wide lines, DPR 1.5 | 8 px line measured 12 px in a 300 × 180 buffer; dashed line had 7 dashes | 8 px line measured 12 px; **one contiguous segment, no dash pattern** |
| Stencil | equal-test fill inside, background outside | same |
| Colour | `#808080` = 128; ramp `0,17,…,255`; odd 641 × 97 readback 248,708 packed bytes | `#808080` = 128; same ramp and packed byte count; bottom-up rows normalized by the harness |
| Pipelines | cold 11 ms → warm 1 ms; `compileAsync` 5 ms; 2 programs | cold 9.9 ms → warm 0.3 ms; `compileAsync` 3.7 ms |
| Loss | `destroyed` filtered by r187; documented hook fired; dispose resolved | `WEBGL_lose_context` fired `webglcontextlost` |

The Stage capture box is converted by one extracted pure function
(`frame-scissor.ts`) and covered at asymmetric offsets, clamping and the absent
frame. The real renderer's DPR/projection behaviour is the harness table above.

## 5. Baseline evidence

### 5.1 Canonical current-world fixture

The measured saved project is absent from the repository, so the approved plan's
equivalent-fixture route is used. `build-webgpu-current-world.ts` emits a
current-format F.2 envelope with:

- **10 rooms, 31 walls, 22 junctions**, one door opening and one standalone
  floor Region with an S5b face Finish.
- A curved wall in a free-standing four-wall cluster, a closed Room floor/lid,
  one Layout object, one scene primitive, one native form, a mapped plaster
  Finish and an imported textured piano GLB.
- Seven scene entities, two resources, two lights, two 1 × 1 artworks, one
  model, one primitive and one form.
- Sun, Spot and Point shadow casters; one entry View camera at `(10,1.7,3.9)`
  looking at `(10,1.4,7.5)`, 54° FOV.

The source fixture is **29,829 bytes** at
`sha256-aef406451ee4129636bfa18e8a2f2ca10ffa4312862f98a2c326a812d8037a5e`.
P20 prepared publication refuses native forms, so a separate explicit projection
without the form is **28,392 bytes** at
`sha256-2541b2e3396f0f85ea7918f53c1d9fc448eaa5c65126fd40cfb483af3053636a`.
The source keeps the form for the Stage/Preview comparator; the public
projection is what the cold public baseline serves. Both are tested: the source
prepares through `prepareUnitRuntime` with 10 rooms/31 walls, and the projection
opens through `composeColdReleaseBundle`.

The saved-world census (64/58 draws, 44,937/25,203 triangles) remains the
comparison target, **not** a claim about this fixture. The fixture reproduces
the 10-room/31-wall scale; it is not a byte-for-byte recovery of the absent
project.

### 5.2 Cold public baseline

Production build (`vite build`), `vite preview` on `127.0.0.1:4173`, route
`/p/55555555-5555-4555-8555-555555555555`, mock P20 API on `127.0.0.1:4319`,
viewport 1280 × 720 at DPR 1. Each run is a fresh browser context with HTTP cache
disabled; two browser processes × 10 launches = **20 samples**. The measured
canvas was 1280 × 528 CSS/device pixels.

| Metric | Result |
| --- | --- |
| `visitor:first-frame` p50 | **186.4 ms** |
| p90 | **269.8 ms** (gate ≤ 1 s) |
| max | **350.0 ms** |
| batch p90 | 269.8 ms / 208.2 ms |
| First-frame renderer state | **369 draw calls, 14,314 triangles, 8 textures** |
| Console errors | 0 |
| Navigation timing | responseEnd ~131.7 ms, DCL ~151.8 ms, load ~152.4 ms, FCP 176 ms |

The renderer state proves a populated gallery draw was submitted, not merely a
cleared canvas. It does **not** prove physical presentation; `visitor:first-frame`
fires when `renderer.info.render.frame` advances after mount. A discarded
exploratory batch, run before the harness was final, contained one 1,248.9 ms
first-ever sample; the retained two-batch evidence is the measurement above and
reports max explicitly rather than hiding first-process compile variance.

This is the fixed local production-build connection the plan specifies, not a
deployed URL. The public projection is used because P20 refuses native forms.

### 5.3 A/B/C on the matched gallery

All rows: 1280 × 720, DPR 1, same geometry, camera and light rig, the declared
47,350-byte plaster texture, one shadowed Sun, 10 launches, three interleaved
10-second windows.

| Row | Observed backend | init p50/p90/max (ms) | submitted draw p50/p90/max (ms) | verified frame p50/p90/max (ms) | steady interval p50 / p95 / p99 / max (ms) | misses > 2T |
| --- | --- | --- | --- | --- | --- | --- |
| A native WebGL | webgl | 4.5 / 9.1 / 10.5 | 26.9 / 31.4 / 53.3 | 33.0 / 37.8 / 71.2 | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |
| B native WebGPU | webgpu | 1.7 / 2.9 / 4.4 | 13.7 / 17.3 / 39.2 | 20.3 / 27.1 / **679.5** | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |
| C forced WebGL2 | webgl2 | 4.5 / 6.8 / 7.9 | 33.3 / 38.8 / 48.8 | 41.1 / 50.1 / 58.3 | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |

- **Boundary:** `firstDrawSubmitted` is time until `renderer.render()` returned;
  it proves no pixels and no presentation. `firstVerifiedFrame` is time until
  the canvas copy first contained a gallery, including any GPU wait/readback; it
  is an upper bound, not physical presentation.
- **B's 679.5 ms verified max** is one sample in ten; p50/p90 are 20.3/27.1 ms.
  It is consistent with a one-off pipeline compile and is reported, not trimmed.
  The same probe needs more samples before it can gate PR 2.
- **Synchronized diagnostic p50:** A 1.7–1.9 ms, B 1.2–1.3 ms, C 2.9–3.0 ms.
  These include a 1-pixel readback or queue wait; they are not displayed frames.
- **Shadow draw calls:** A 17 calls / 74 triangles with the Sun versus 11 / 62
  without; first shadowed frame 3.1 ms. The common renderer's `Info` does not
  include shadow submissions (12 / 63 on B and C), so B/C shadow draw counts are
  **not measured** by this fixture.
- **Light variant (four → five directionals):** first frame A 27.5 ms / B
  **192.8 ms** / C 38.8 ms; warm repeat A 2.0 / B 2.3 / C 2.5 ms. B's one-shot
  variant frame varied materially from the earlier run (28.5 ms); this probe
  needs repeated samples rather than a single-pass claim.

The steady windows are vsync-quantised at 16.7 ms and cannot establish headroom
or a winner. They confirm no drop below the display period, no miss over 2T, and
equivalent cadence. A real display and the reference laptop are needed for the
proposed gate.

## 6. Blockers and unverified items for PR 2

1. **WebGL2 `maskNode` is inverted.** The same TSL `positionWorld.y < 0` colour
   mask keeps the lower half on WebGPU and the upper half on forced WebGL2.
   Stage Level/drawn clip and Cutaway cannot ship on C until this is resolved or
   the affected material path is reworked.
2. **WebGL2 dashed wide lines render no dashes at DPR 1 or 1.5.** Both runs
   produce one contiguous segment with `Line2NodeMaterial`, `worldUnits: false`.
   WebGPU produces seven dashes at both DPRs. Determine whether this is material
   configuration, an r187 limitation or a renderer defect before choosing a
   workaround; Stage Slice/drafting dashes must be proven on C.
3. **Shadow submission cost on B/C is not exposed by r187 `Info`.** A
   controller-level counter (target + camera identity) is required, as the plan
   specifies; this PR records the gap instead of inventing a number.
4. **Artwork shadow mask needs a product-shaped proof.** r187 already applies a
   material `map`'s alpha in the shadow pass, so a texture mask was redundant in
   the harness. The final Lambert variant must still be tested with the existing
   shadow material semantics and a photograph/transparent asset on all three
   light kinds.
5. **Reference hardware deferral is requested, not approved.** No Intel Iris
   Xe-class laptop, Safari or Firefox row; no real display period, thermal
   state, physical DPR 1.5 resize or browser-driven native WebGPU loss. The
   manifest records `hardwareDeferralRequest.status: "pending owner approval"`
   and `approved: false`. This report does not claim that deferral.
6. **The cold public baseline is local, not deployed.** It uses a production
   build over loopback with a mock P20 API. No preview or production deployment
   was created for this correction pass.
7. **The measured saved world remains absent.** `currentWorld` is a canonical
   equivalent at the same 10-room/31-wall scale. Its draw/triangle counts are not
   the saved-world census.
8. **Stock Canvas needs the adapter.** The product may not adopt the plain
   Threlte context without the generation owner; PR 2 must keep the same
   readiness, fresh-canvas recovery and idempotent retirement rules.

## 7. Checks

Ran on the branch at Node 26 / npm 11:

- Focused PR 1 suites — **48 tests passed**: lifecycle 11, mounted 14, manifest
  9, current-world 4, isolation 4, framing 6.
- `npm run check` — **0 errors**, 16 pre-existing warnings in product files
  (`VisitorPreviewSurface`, `StagePanels`, `StageToolbars`,
  `StageViewportRegion`, `StudioRootPanel` and the spatial route).
- `npm run test:arch` — **38 files, 350 tests passed**.
- `npm run build` — passed (SSR + client + adapter-vercel) as part of the cold
  public harness.
- Fixture generator — rerun from `scripts/build-webgpu-current-world.ts`;
  emitted the same bytes and digests.
- Harness — qualification **10 pass / 2 fail** (both forced-WebGL2 gaps above);
  performance A/B/C complete; cold public 20 samples, 0 console errors.
- CI at `1965597a` — all required checks passed (run 44665860999): build,
  check, API check/tests, fast, heavy, architecture, guards, package and
  platform checks. `editor focused verification` was skipped by the path
  classifier.

Harness commands: `npm run webgpu:qualify`, `npm run webgpu:perf`,
`npm run webgpu:cold` and `npm run webgpu:evidence`.
