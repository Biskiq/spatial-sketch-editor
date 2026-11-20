# PR 2 — Atomic WebGPU renderer cutover

**Status** · Implementation complete and awaiting owner acceptance. The Stage,
Visitor Preview and published visit all draw through one Three r187
`WebGPURenderer`; the native `WebGLRenderer` path is retired. Nothing is merged
or activated by this branch.

**Baseline** · `main` at `0f588253` (PR #384). Three `0.187.0`, `@threlte/core`
`8.5.16`, `@threlte/extras` `9.21.0`.

**Evidence** · [`pr2-product-webgpu-dpr1.json`](./evidence/2026-11-20/pr2-product-webgpu-dpr1.json)
· [`pr2-product-webgl2-dpr1.json`](./evidence/2026-11-20/pr2-product-webgl2-dpr1.json)
· [`pr2-product-webgpu-dpr1_5.json`](./evidence/2026-11-20/pr2-product-webgpu-dpr1_5.json)
· [`pr2-product-webgl2-dpr1_5.json`](./evidence/2026-11-20/pr2-product-webgl2-dpr1_5.json)
· Stage/Preview [`pr2-stage-webgpu.json`](./evidence/2026-11-20/pr2-stage-webgpu.json),
[`pr2-stage-webgl2.json`](./evidence/2026-11-20/pr2-stage-webgl2.json)
· screenshots `pr2-product-{A-native-webgl,webgpu,webgl2}-dpr1.png` and
`pr2-stage-{webgpu,webgl2}-*.png`
· PR 1 A baseline [`performance.json`](./evidence/2026-11-20/performance.json),
[`cold-public.json`](./evidence/2026-11-20/cold-public.json)

## 1. What landed

| Surface | Change |
| --- | --- |
| Renderer | `render/renderer-backend.ts` is the one construction site: `WebGPURenderer` per generation, native WebGPU with Three's WebGL2 fallback, stencil/alpha/antialias, `NoToneMapping` at exposure 1, sRGB output, surface frame counters. `managed-webgl-renderer.ts` and `canvas-renderers.ts` are deleted. |
| Canvas | `render/CanvasHost.svelte` is the shared stock Threlte `<Canvas>`. It gates children on `init()`, owns one generation and its recovery episode, hands Threlte a ready-gated facade, and reports the observed backend. Stage, Visitor Preview, published visit and both dev benches mount it. |
| Generation and recovery | `renderer-generation.ts` owns the init deadline, idempotent retirement and blocked-draw count; `canvas-lifecycle.ts` owns the approved episode (one fresh canvas, WebGPU→WebGL2 switch, Retry on a repeated/WebGL2 loss, 30-second settle). `renderer-context.ts` exposes the real renderer to the shadow controller and snapshots. |
| Camera | `camera-realization.ts` is the one pose writer: it sets the backend coordinate system before copying the evaluated matrices, converts clip-space Z for native WebGPU and rebuilds the inverse. `frame-scissor.ts` passes a top-left capture rectangle on both backends. |
| Clipping | `render/clip/slice-clip-mask.ts` is the shared TSL graph. The Level reading keeps native `Plane`s; a drawn cut and X2's cutaway top are one `maskNode` plus a pass-through `maskShadowNode`, built from shared `uniform()` nodes. Editing a cut writes uniforms only — no GLSL, `onBeforeCompile` or program rebuild. |
| Materials and ink | `material-store.ts` attaches the mask graph once and expresses transparent Artwork shadow through `shadowAlpha` + `reference`; the depth/distance descriptor pair is gone. The mat grid is a `MeshBasicNodeMaterial` pair; fat lines use `Line2NodeMaterial` at CSS-pixel widths. |
| Shadows | `shadow-invalidation.ts` is per light: it reads each caster's `shadow.autoUpdate` / `shadow.needsUpdate` and wraps the real `render` for the count oracle. `StageShadowTriggers` keeps its input identities and the Sun key guard. |
| Snapshots | `StageSnapshotRenderer` draws through the shared renderer into a generic `RenderTarget` and reads it with `readRenderTargetPixelsAsync`. Rows are normalized to top-down per backend and encoded to sRGB once. |
| Portability guards | The production allowlist is empty: no product `onBeforeCompile`, `ShaderMaterial`, `WebGLRenderTarget`, non-2D `getContext`, custom depth/distance material or WebGL-only import path. The legacy line entry points are the only allowed `three/examples` paths. |
| Docs | Rendering reference, architecture row, S0 correction note and the portability assessment now describe the one-renderer pipeline. The plan status records PR 2 as implemented, awaiting acceptance. |

## 2. Defects found by the integrated run and fixed here

| Finding | Fix |
| --- | --- |
| `visitor:first-frame` never fired on the shipped published route. r187's common `Info` advances `info.calls` per `render()`, while the legacy `info.render.frame` slot is only refreshed inside its internal animation loop; the product runs `autoRender: false`, so the mark stayed silent and startup could not be observed. | `visitor/first-frame.ts` now prefers `info.calls` and keeps the legacy `info.render.frame` shape as a typed fallback. The unit fixture and canvas fakes use the common counter. |
| The host's `pointercancel` handler received its own synthetic `pointercancel` dispatch and recursed: a `RangeError: Maximum call stack size exceeded` on every generation change, and on any real pointer cancel. | The canvas host no longer listens for `pointercancel`. The cancel seam dispatches on the host and bubbles through the Stage viewport, which owns the listener. |
| Recovery dispatched `pointercancel` with a fabricated `pointerId: 1`, so a touch, pen or later pointer press kept editing across the canvas replacement. | `CanvasHost` reads the surface's actual captured ids (`capturedPointers`) and dispatches one cancel per id before the new generation mounts. The mounted regression uses pointer id 7 and asserts cancellation precedes generation 2. |
| The shadow oracle inferred a point light's submission from its dirty flag and counted one nested call as six maps, while r187's cube actually calls the renderer six times. The fake made one call, so it could not expose the overcount. | The wrapper observes only nested `render(scene, shadow.camera)` calls and coalesces a light's faces into one pass per outer render, with one map per face. The fake now issues six calls for a point cube; the browser journey records exactly `+6 maps / +1 pass` and zero shadow work across a settled orbit and idle second. |
| The Stage mat grid's TSL arithmetic emitted `NaN.0` and a signed derivative pair instead of `fwidth`, so the shader failed on both backends. | `stage-mat-grid.ts` uses `float(...).sub(...)` and `abs` derivatives. The Stage/Preview journey now reports no shader or console errors on either backend. |
| The WebGL2 unavailable Retry button never fired: the Stage viewport captured the press and retargeted the click. | The recovery button stops `pointerdown` propagation; the browser retry now mounts a fresh generation and returns `ready` on a new canvas. |
| The acceptance muted its browser error listener before forcing the loss, so the 16 saved validation errors were necessarily emitted **before** the deliberate loss — yet the runner classified every `Uncaptured WebGPU GPUValidationError` as device-loss noise. The errors were real: the kept-warm Preview canvas is hidden between visits, and r187 was asked to draw at 0×0, creating a zero-sized depth texture and swapchain. | The collector is never muted. Every page or console error is stored with its text and its phase in the console stream; a boundary message emitted after the last journey frame separates journey errors from recovery errors. Only recovery errors carrying `pr2-stage-forced-loss`, `[Invalid Device]`, or Three's `WebGL Device Lost` report are accepted, and the raw recovery texts remain in the evidence. Independently, the generation facade refuses a top-level draw while its canvas has zero pixels and counts it as `emptyDraws`; a regression drives a 0×0 draw and then a real one on the same renderer. |

## 3. Tests

Run from `apps/editor` on the final tree:

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 16 pre-existing warnings |
| `npm run test:fast` | 443 files, 5,455 tests pass |
| `npm run test:arch` | 38 files, 350 tests pass |
| `npm run test:heavy` | 11 files, 138 tests pass |
| focused pointer/shadow/mounted recovery/empty canvas | 4 files, 28 tests pass |
| `npm run build` | exit 0 |
| Stage/Preview browser acceptance | 2/2 journeys pass (WebGPU and WebGL2) |

## 4. Integrated product measurement

Protocol: the ordinary production build served on loopback, the pinned PR 1
current-world publication, two fresh browser processes × five cleared-cache
contexts. `A` is PR 1's native-WebGL published baseline (20 samples, DPR 1).
`B` is native WebGPU. `C` hides `navigator.gpu` so Three's automatic selection
falls back to WebGL2; every C row reports `isWebGLBackend: true` with no product
toggle. Every row also performed a warm re-entry, a real pointer orbit and one
deviceless-loss recovery.

| M2 signal | A native WebGL | B WebGPU | C auto WebGL2 |
| --- | ---: | ---: | ---: |
| Published cold first frame, DPR 1, p50 / p90 | 186 / 270 ms | 218 / 243 ms | 279 / 327 ms |
| Published cold first frame, DPR 1.5, p50 / p90 | not in PR 1 A set | 218 / 277 ms | 276 / 338 ms |
| Warm re-entry, DPR 1, p50 | not measured | 161 ms | 224 ms |
| Warm re-entry, DPR 1.5, p50 | not measured | 157 ms | 218 ms |
| Orbit animation-frame interval p95 | not measured | 16.7–16.8 ms | 16.7–16.8 ms |
| Orbit worst interval | not measured | 33.4 ms (2T) | 33.4 ms (2T) |
| Backing store, DPR 1 / 1.5 | 1280 × 528 | 1280 × 528 / 1920 × 792 | 1280 × 528 / 1920 × 792 |

- The absolute startup gate is p90 ≤ 1 s; both B and C pass at both DPRs. The
  p90 spread comes from the first page of a fresh browser process, retained in
  every summary.
- B costs about 17 % more than A at cold p50 and C about 50 %. The added work is
  the common renderer's node-material graph and pipeline/shader preparation.
  There is no demonstrated responsiveness failure, so no speculative
  optimization is included.
- Orbit p95 stays at the display period and the worst interval is 2T, inside the
  warm-input 4T allowance. Idle p95 is 16.7–16.8 ms, inside the 1.1T anchored
  allowance.

**Visual parity.** The A-side build was produced from `0f588253` in a temporary
worktree, served with the same mock publication and driven through the identical
orbit gesture. A, B and C screenshots are visually identical: mean absolute
channel difference is 0.12/255 against either candidate, with 1.2 % of channels
differing by more than 2 (antialiased edges and the grid). See
`pr2-product-A-native-webgl-dpr1.png`, `pr2-product-webgpu-dpr1.png` and
`pr2-product-webgl2-dpr1.png`.

**Recovery.** Native WebGPU receives `onDeviceLost` and automatically mounts a
second generation on a fresh canvas; it resumes drawing in the same session.
WebGL2 receives the browser's cancelable `webglcontextlost`, presents the
in-place unavailable state, and its Retry mounts a second WebGL2 generation that
resumes drawing. Both paths leave exactly one connected canvas.

### Stage and detached-Preview acceptance

Run on the shipped production build with the seeded test-auth session and the
private local API/database, in branded Chrome 157. The same journey runs once on
native WebGPU and once with `navigator.gpu` hidden so Three selects WebGL2. It
creates a Room through Ink; exercises Plan/3D, a Wall-handle drag, a curated
Finish, Slice Level/Put back, Near-wall Whole/Cut; places a Point light in
Daylight with the Sun's shadows off; captures an Experience Camera snapshot;
enters Preview into free exploration, exits and re-enters; then forces a loss
and recovers. Both backends pass every row with no journey-phase errors. The
collector stays live through recovery and records one explicit device-loss
message per backend: WebGPU's `pr2-stage-forced-loss` reason and WebGL2's
`WebGL Device Lost` report. Raw recovery texts are in the evidence, not folded
into a blanket count.

The shadow oracle records `passes: 1, maps: 6` for the Point light: six real
face submissions are one light pass, and the settled orbit plus idle second add
no further work. Recovery ends `ready` on a fresh canvas at generation 4 on both
backends (WebGPU automatic; WebGL2 unavailable → Retry). Evidence: [`pr2-stage-webgpu.json`](./evidence/2026-11-20/pr2-stage-webgpu.json),
[`pr2-stage-webgl2.json`](./evidence/2026-11-20/pr2-stage-webgl2.json); screenshots
`pr2-stage-{webgpu,webgl2}-{plan,3d,wall-drag,finish,slice,cutaway-cut,light-shadow,experience-capture,preview,recovered}.png`;
machine facts [`pr2-stage-machine-facts.json`](./evidence/2026-11-20/pr2-stage-machine-facts.json).

## 5. Remaining verification and risks

- **Stage and detached-Preview journeys are functionally accepted, not
  hardware-timed.** They now run against an authenticated project and the local
  API/database on both backends (see §4), but the performance table above remains
  the published-route measurement. Stage authoring parity is additionally
  covered by the fast, architecture and heavy suites, including the mounted
  camera, clipping, shadow, snapshot and interaction fixtures.
- Studio deliberately uses its fixed even light and omits authored Point/Spot
  lights; the acceptance selects Daylight before placing one. If owner
  acceptance wants an authored light to appear in Studio too, that is a separate
  product decision, not part of this correction.
- The measurement host is one Apple M2 in headless branded Chrome. The Intel
  Iris Xe-class laptop, Safari and Firefox rows from the plan remain unrun, as
  they did in PR 1.
- `visitor:first-frame` is a renderer-call scheduling mark, not physical scanout
  or a pixel-verified first frame; the screenshots verify the resulting image
  separately.
- The C cold-start cost is the largest migration delta and is within the gate.
  If owner acceptance wants the margin reduced, the next step is a trace of the
  WebGL2 first-frame shader/pipeline preparation, not a product change made here.
