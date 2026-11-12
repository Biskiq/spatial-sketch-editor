# Portability log — three backends, one device

What survived contact between A (`WebGLRenderer`), B (`WebGPURenderer`, WebGPU backend) and C
(`WebGPURenderer({ forceWebGL: true })`) on the calibration page. This is a behaviour log, not a
cross-device study; the only device is the one below.

## Environment

| | |
| --- | --- |
| Device | MacBook Air (`Mac14,2`), Apple M2, 16 GB |
| OS | macOS 15.8.2 (24H232) |
| Browser | Chrome 157.0.8103.52 |
| Power / thermal | AC, battery 100 %, no thermal or performance warning recorded |
| Canvas | 1280×720, DPR 1 |
| three | r187, vendored builds (`vendor/`) |
| Session | one browser session, runs sequential: B, A, C |

Availability on this machine:

- **A** available. WebGL 2.0, ANGLE Metal Renderer: Apple M2.
- **B** available. `navigator.gpu.requestAdapter()` returned
  `{ vendor: "apple", architecture: "metal-3" }`. three's backend does not expose `adapter` after
  init, so the page probes `navigator.gpu` separately and records that probe.
- **C** available. The same WebGL 2 context string as A, reached through `WebGPURenderer`'s WebGL
  backend.

The selector never falls back silently. If B is unavailable the page records the reason and leaves
B unselectable; it does not run C in B's place. On this machine there was no reason to record.

## What differed

| Area | A · WebGLRenderer | B · WebGPU | C · forceWebGL |
| --- | --- | --- | --- |
| Draw count, base | 1,000 | 1,001 | 1,000 |
| Triangle count, base | 12,000 | 12,001 | 12,000 |
| `renderer.info.programs`, base | 1 | 4 | 4 |
| Program delta, 4→5 lights | +1 | 0 | 0 |
| First frame after that change | 13.6 ms | 40.4 ms | 199.7 ms |
| Timer source | `EXT_disjoint_timer_query_webgl2` | WebGPU timestamp-query | `WebGPURenderer` timer API over WebGL 2 |
| Per-draw submit | 0.000675 ms | 0.002435 ms | 0.003192 ms |
| Per-triangle | 9.94e-7 ms | 1.64e-6 ms | 1.41e-6 ms |
| Shadow pass, 1,000 draws | 0.228 ms | 1.023 ms | 0.803 ms |
| Shadow pass, 5,000 draws | 1.074 ms | 3.577 ms | 3.912 ms |
| 64 point lights, 1,000 draws | 67.45 ms | 26.85 ms | 48.65 ms |
| 5,000 separate draws, 0 lights | 7.75 ms | 20.75 ms | 20.85 ms |
| BatchedMesh, 1,000 draws | 5.20 ms | 2.55 ms | 6.40 ms |
| InstancedMesh, 5,000 draws | 4.20 ms | 4.05 ms | 4.45 ms |

All times are synchronized milliseconds (CPU submit plus GPU completion readback), so they include
roughly 1.5 ms of readback. They are comparable to each other, not to a present-to-photon frame.

## Observations

1. **B adds one draw and one triangle at the base point.** The extra submission is consistent across
   the mesh-count rows (`draws = N + 1`, `triangles = 12N + 1`). The page records it rather than
   correcting it; the likely cause is a fullscreen/clear pass, but that was not verified in three's
   source.
2. **Program counts are not comparable across backends.** A compiles one program for the base scene;
   B and C report four. A adds a program when a fifth light arrives, B and C do not. Yet B's next
   frame costs 40 ms and C's 200 ms. A budget that counts programs would see no compile on B or C.
3. **Timer support was available everywhere, with different trustworthiness.** A's timer queries are
   noisy at 1–4 ms; B's are steadier but still vary between runs. C's timer path is three's WebGPU
   API implemented over the WebGL backend, not a native WebGPU query. The page labels the source and
   keeps `gpuReason` beside every value.
4. **Shadows are the largest portability gap.** B's shadow pass is 4.5× A's at 1,000 draws and 3.3×
   at 5,000. C is closer to B than to A. At 5,000 draws, B and C cannot fit any shadowed light in
   16.7 ms, while A fits two every-frame and four cached.
5. **Instancing and batching work in all three, and change the ranking.** B's `InstancedMesh` is
   slightly faster than A's at 1,000 draws and a tie at 5,000; B's `BatchedMesh` is about twice as
   fast as A's at 1,000. C's batching is only 1.09×/2.34×, well behind B.
6. **Materials behave.** `MeshStandardMaterial` and `MeshLambertMaterial` render in all three
   configurations with no custom shader, no `onBeforeCompile` and no post-processing. No material
   was rejected by B.
7. **`forceWebGL` is the worst of both worlds on this scene shape.** C's per-draw cost is higher than
   A's (4.7×), its 5,000-draw frame is 2.4× A's, and its light-variant compile is 200 ms. It shares
   B's draw-count overhead but not B's GPU-side light advantage. A WebGPU trial must keep
   `WebGLRenderer` as the fallback, not rely on three's internal one.
8. **Light-count advantage depends on submission.** At 1,000 draws B beats A from 64 lights upward
   and loses at 32; at 5,000 draws B loses at 16 and 32 because its submit cost dominates. The
   product's saved World has 64 draws, where this page cannot distinguish the backends (both are
   intercept-dominated).

## Not checked

- **Visual parity.** No screenshots, pixel comparison, colour-management check, tone mapping,
  transmission, environment map or post-processing comparison. Only cost and counts are claimed.
- **Availability elsewhere.** No Safari, Firefox, Windows/Iris Xe, Android or iOS run. B's
  availability and C's cost on those devices are unknown.
- **Device loss, context restoration, multiple canvases, resizing.** Not exercised.
- **Long-run stability.** Each backend ran once; no thermal soak, no repeat session, no memory
  growth measurement. The cached-shadow saving at 1,000 draws is within run-to-run noise, which is
  itself a portability warning about single-run conclusions.

## Lighting systems (review sweep, 2026-11-12)

- `DynamicLighting` and `ClusteredLighting` exist only for `WebGPURenderer`. Both ran without
  errors on the WebGPU backend; neither was tried on `forceWebGL`.
- A's default lighting fails to compile at 256 point lights (`MAX_FRAGMENT_UNIFORM_VECTORS`
  1024 on ANGLE/Metal). The failure is logged, the frame renders without the material, and the
  timing looks fast; the page now captures shader and pipeline errors so such rows are marked.
- Adding a light recompiles on A (171 ms, +1 program) and on B's default lighting (334 ms, no
  program change); `DynamicLighting` does not (0.1 ms).
- B's `renderer.info` draw counter misreports on some rows (thousands of "draws" for one instanced
  mesh); timing columns are unaffected.

## What a trial would inherit

- Keep A as the production renderer and as the fallback.
- Do not switch on B without instancing; at today's 64-draw World the difference is inside
  the noise, and at 5,000 separate draws B is 2.8× slower.
- Budget for a 40 ms first-frame stall when the light set changes on B, and 200 ms on C, even when
  the program count does not move.
- Re-run this page on the target Iris Xe laptop before treating any of these constants as
  device-class facts. One M2 is a direction, not a portability result.
- If B is ever trialled, `WebGLRenderer` stays the fallback, so every material must render on
  both renderers. Node (TSL) materials do not run on `WebGLRenderer`; built-in materials do.
