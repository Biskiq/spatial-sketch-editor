# PR 1 — Pinned native-WebGL baseline and r187 qualification

**Status** · Implementation evidence for PR 1. Native WebGL remains the shipped
renderer; no Stage, Preview or published route has switched. PR 2 has not
started.

**Baseline** · `main` at `a53d30deb8ab0c4964bc42a41bf2e0d874ee6786` (merged
planning PR #383). Resolved packages: Three `0.187.0`, `@threlte/core` `8.5.16`,
`@threlte/extras` `9.21.0`.

**Evidence** · [`qualification.json`](./evidence/2026-11-20/qualification.json)
· [`performance.json`](./evidence/2026-11-20/performance.json) ·
[`environment.json`](./evidence/2026-11-20/environment.json) ·
[`baseline/fixtures.json`](../../../../apps/editor/experiments/webgpu-migration/baseline/fixtures.json)

## 1. What landed

| Surface | Change |
| --- | --- |
| Baseline | `apps/editor/experiments/webgpu-migration/baseline/fixtures.json` pins the commit, resolved packages, S0 comparator geometry and camera poses, 17 shipped asset/fixture SHA-256 digests, the P20 publication inputs and what is not frozen. |
| Canvas comparison | Stock Threlte 8.5.16 `Canvas` + adapter and the ready-gated host, sharing `CanvasLifecycle` and one generation owner. |
| Lifecycle tests | `webgpu-canvas-lifecycle.test.ts` (10) and `webgpu-canvas-mounted.test.ts` (12; six cases on both candidates). |
| API qualification | Isolated real Three harness under `experiments/webgpu-migration/api/`; 12 scenarios on native WebGPU and forced WebGL2. |
| Performance | Matched A/B/C gallery with 10 startup samples, three 10-second windows, shadow and light-variant probes. |
| Regression coverage | Stage asymmetric framing, baseline/asset hashes, existing first-frame observer, and an import guard that keeps node/TSL code out of `src`. |

The experiment tree is outside `src`; a guard test fails if any product file
imports it or `three/webgpu` / `three/tsl` / `WebGPURenderer`. The existing
Stage/PV tone-mapping, first-frame and public-release tests are unchanged and
still pass.

## 2. Canvas integration choice

**Chosen: stock Threlte `<Canvas>` with a thin generation adapter.** Both
candidates passed the same mounted contract, including zero pre-ready draws,
delayed and rejected initialization, unmount during init, device loss with a
fresh canvas, a surviving sibling, retained session state, and single idempotent
retirement. The stock path is selected because it keeps Threlte's DOM canvas,
camera/task contexts, resize and scheduler intact; only readiness, recovery and
retirement are Biskiq's.

The adapter is necessary because 8.5.16 calls `setAnimationLoop()` and
`dispose()` without awaiting their promises and catches only synchronous
disposal errors. `autoRender` is false until ready, the gated child mounts after
readiness, and an outer key gives recovery a genuinely new DOM canvas. The
ready-gated candidate remains in the tree as a comparison and as a fallback if
PR 2 finds a stock-path lifecycle gap.

No Threlte patch or upgrade is needed for PR 1.

## 3. Verified API results

Environment: Apple M2 (8-core GPU), macOS 15.8.2, branded Chrome 157.0.8103.80,
headless, secure loopback origin, Metal-3 WebGPU adapter, DPR 1. The harness
reports the initialized backend; every B row observed `webgpu`, every C row
`webgl2`.

| Probe | Native WebGPU | Forced WebGL2 |
| --- | --- | --- |
| Initialization | `coordinateSystem: webgpu`, 2.8 ms, red first draw, disposed | `coordinateSystem: webgl`, 14.3 ms, red first draw, disposed |
| One core | `Vector3`, `Texture`, `ColorManagement` identical across `three` and `three/webgpu`; a legacy scene drew red through `WebGPURenderer` | same |
| Two devices, one texture | both drew the shared texture; the survivor still drew after the other retired | same |
| Projection / scissor | target scissor at `(24,16,60,40)` clipped; outside was background; perspective and orthographic depth kept the near surface | same |
| DPR 1.5 scissor | CSS box `(20,10,80,40)` produced a `(30,15,120,60)` green box in a 300 × 180 buffer | same |
| TSL colour `maskNode` | upper half discarded, lower half drawn | **inverted** (see blockers) |
| Sun / Spot / Point shadows | present on all three; UV and position shadow masks changed 170–369 pixels | same |
| Textured Artwork shadow mask | map alpha is already applied by r187's shadow path; an extra texture mask changed 0 pixels. UV/position masks work | same |
| Wide lines | 8 px line measured 8 px; dashed line had 7 dashes | 8 px line measured 6 px; **0 dashes** |
| Stencil | equal-test fill inside, background outside | same |
| Colour | presented `#808080` = 128; ramp `0,17,…,255`; odd 641 × 97 readback 248,708 packed bytes | same |
| Row order | top-down | bottom-up; normalized by the harness |
| Pipelines | cold 12.1 ms → warm 1.1 ms; `compileAsync` 5.7 ms; 2 programs | cold 10.2 ms → warm 0.4 ms; `compileAsync` 3.5 ms |
| Loss | `destroyed` filtered by r187; documented hook fired; dispose resolved | `WEBGL_lose_context` fired `webglcontextlost` |

The Stage capture box is now converted by one extracted pure function
(`frame-scissor.ts`) and covered at asymmetric offsets, clamping and the absent
frame. The real renderer's DPR/projection behaviour is the harness table above.

## 4. Baseline evidence and performance

### Frozen baseline

- No live publication is used. The P20 endpoints, MIME set, 25 MiB ceiling and
  shipped-static registry version are pinned; the manifest test compares them
  with `public-release-client.ts` and `shipped-static-registry.ts`.
- 17 shipped textures/GLBs and existing render fixtures are hashed; the test
  recomputes every digest and byte count.
- The S0 gallery comparator is pinned at 12 × 7 m, 3 m walls, six 1.2 × 0.9 m
  textured quads, camera `(0,1.6,−1.2)` looking at `(0,1.4,3.5)`, 50° FOV.
- The measured 31-wall saved world is **not** in the repository. The manifest
  carries its census (10 rooms, 31 walls, 64/58 draws, 44,937/25,203 triangles)
  and marks the project itself as unfrozen.

### A/B/C on the matched gallery

All rows: 1280 × 720, DPR 1, same geometry, camera and light rig, one shadowed
Sun, 10 launches, three interleaved 10-second windows.

| Row | Observed backend | init p50/p90/max (ms) | first correct p50/p90/max (ms) | steady interval p50 / p95 / p99 / max (ms) | misses > 2T |
| --- | --- | --- | --- | --- | --- |
| A native WebGL | webgl | 4.1 / 8.2 / 9.2 | 22.2 / 25.4 / 51.8 | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |
| B native WebGPU | webgpu | 1.5 / 3.3 / 3.3 | 12.3 / 16.7 / 41.1 | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |
| C forced WebGL2 | webgl2 | 4.1 / 5.2 / 14.4 | 28.6 / 39.5 / 46.4 | 16.70 / 16.70–16.80 / 16.80 / 16.80 | 0 |

- **Synchronized diagnostic p50:** A 2.4–2.8 ms, B 1.6 ms, C 3.7–4.2 ms. These
  include a 1-pixel readback or queue wait; they are not displayed frames.
- **Shadow draw calls:** A 17 calls / 74 triangles with the Sun versus 11 / 62
  without; first shadowed frame 4.2 ms. The common renderer's `Info` does not
  include shadow submissions (12 / 63 either way on B and C), so B/C shadow
  draw counts are **not measured** by this fixture.
- **Light variant (four → five directionals):** first frame A 39.3 ms / B
  28.5 ms / C 39.7 ms; warm repeat A 1.7 / B 5.5 / C 2.2 ms.
- **Cold harness script:** 203 ms from local navigation to the module entry,
  not a production cold public load.

The steady windows are vsync-quantised at 16.7 ms and cannot establish headroom
or a winner. They confirm no drop below the display period, no miss over 2T,
and equivalent cadence. A real display and the required second laptop are
needed for the proposed gate.

## 5. Blockers and unverified items for PR 2

1. **WebGL2 `maskNode` is inverted.** The same TSL `positionWorld.y < 0` colour
   mask keeps the lower half on WebGPU and the upper half on forced WebGL2.
   Stage Level/drawn clip and Cutaway cannot ship on C until this is resolved or
   the affected material path is reworked.
2. **WebGL2 dashed wide lines render no dashes** (`Line2NodeMaterial`,
   `worldUnits: false`, 6 px width, 0 dashes). Stage Slice/drafting dashes must
   be proven on C before the ink port.
3. **Shadow submission cost on B/C is not exposed by r187 `Info`.** A
   controller-level counter (target + camera identity) is required, as the plan
   specifies; this PR records the gap instead of inventing a number.
4. **Artwork shadow mask needs a product-shaped proof.** r187 already applies a
   material `map`'s alpha in the shadow pass, so a texture mask was redundant in
   the harness. The final Lambert variant must still be tested with the existing
   shadow material semantics and a photograph/transparent asset on all three
   light kinds.
5. **Reference hardware and browsers are unavailable here.** No Intel Iris
   Xe-class laptop, Safari or Firefox row; no real display period, thermal
   state, DPR 1.5 resize on a physical display, or production cold published
   navigation with a cleared cache.
6. **The current-world fixture is not captured.** The 31-wall/10-room project
   described by the census is absent, so PR 1 has no A row for it. PR 2 must
   freeze and hash a shareable project (opening, curved wall, Room floor/lid,
   S5b Region, object, Form, Finish, textured GLB, both Artworks and the three
   shadow casters) before the cutover comparison.
7. **Actual native WebGPU device loss was not induced.** Destroying the device
   is filtered by r187; the owner test uses the documented hook. A
   browser-supported loss mechanism remains for PR 2.
8. **Stock Canvas needs the adapter.** The product may not adopt the plain
   Threlte context without the generation owner; PR 2 must keep the same
   readiness, fresh-canvas recovery and idempotent retirement rules.

## 6. Checks

Ran on the branch at Node 26 / npm 11:

- `npm test` — **490 files, 5,935 tests passed**. One unrelated X8 light-gesture
  lease assertion failed once in the first parallel run, passed alone, and the
  full rerun passed; no PR 1 file participates in it.
- `npm run check` — **0 errors**, 16 pre-existing warnings in product files
  (`VisitorPreviewSurface`, `StagePanels`, `StageToolbars`,
  `StageViewportRegion`, `StudioRootPanel` and the spatial route).
- `npm run test:arch` — **38 files, 350 tests passed**.
- `npm run build` — passed (SSR + client + adapter-vercel).
- Focused PR 1 suites — 39 tests passed: lifecycle 10, mounted 12, framing 6,
  manifest 7, isolation 4.
- Harness — qualification 10 pass / 2 fail (both forced-WebGL2 gaps above);
  performance A/B/C complete. These are owner-run and not CI checks.

The harness commands are `npm run webgpu:qualify`, `npm run webgpu:perf` and
`npm run webgpu:evidence`.
