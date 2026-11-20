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
· screenshots `pr2-product-{A-native-webgl,webgpu,webgl2}-dpr1.png`
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

## 3. Tests

Run from `apps/editor` on the final tree:

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 16 pre-existing warnings |
| `npm run test:fast` | 441 files, 5,451 tests pass |
| `npm run test:arch` | 38 files, 350 tests pass |
| `npm run test:heavy` | 11 files, 138 tests pass |
| `npm run build` | exit 0 |

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

## 5. Remaining verification and risks

- **Stage and detached-Preview journeys were not timed on hardware.** They need
  an authenticated project and the local API/database, which this headless run
  cannot sign in to. Stage authoring parity is covered by the fast, architecture
  and heavy suites, including the mounted camera, clipping, shadow, snapshot and
  interaction fixtures, but not by a fresh hardware A/B measurement.
- The measurement host is one Apple M2 in headless branded Chrome. The Intel
  Iris Xe-class laptop, Safari and Firefox rows from the plan remain unrun, as
  they did in PR 1.
- `visitor:first-frame` is a renderer-call scheduling mark, not physical scanout
  or a pixel-verified first frame; the screenshots verify the resulting image
  separately.
- The C cold-start cost is the largest migration delta and is within the gate.
  If owner acceptance wants the margin reduced, the next step is a trace of the
  WebGL2 first-frame shader/pipeline preparation, not a product change made here.
