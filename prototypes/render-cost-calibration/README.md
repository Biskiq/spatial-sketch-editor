# Render cost calibration (P1 + P2, P3 prepared)

Standalone research page for
[§6 of the rendering/compute assessment](../../broad-research/rendering-compute-architecture-assessment.md#6-proposed-probes-owner-decides-each-is-minutes-to-run-none-uses-the-t2-harness).
It measures three r187's three built-in renderer configurations on deterministic scenes, records a
count census of real Worlds, and prepares the Gate C prediction without running Gate C.

Status: research evidence, not product code. No product import, no workspace dependency, no
`package.json` change, no custom shader and no post-processing. The page renders with
`MeshStandardMaterial` and `MeshLambertMaterial` only.

## Run

```sh
cd prototypes/render-cost-calibration
python3 -m http.server 8852
```

Open <http://127.0.0.1:8852/>, choose a backend and press **Run selected backend** (about 5–8
minutes), or **Run all three** (about 20 minutes). **Download JSON** writes the result. Keep the
tab visible: a backgrounded tab pauses `requestAnimationFrame` and invalidates the run.

The three recorded runs are in [`results/`](./results/):

| File | Configuration |
| --- | --- |
| `apple-m2-webgl.json` | A · `WebGLRenderer` |
| `apple-m2-webgpu.json` | B · `WebGPURenderer` (WebGPU backend) |
| `apple-m2-webgpu-force-webgl.json` | C · `WebGPURenderer({ forceWebGL: true })` |

Provenance for all three: MacBook Air M2 (`Mac14,2`, Apple M2, 16 GB), macOS 15.8.2 (24H232),
Chrome 157.0.8103.52, 1280×720 at DPR 1, AC power, battery 100 %, `pmset` recorded no thermal or
performance warning. The three runs were sequential in one browser session, B then A then C.
The page reports why a backend is unavailable instead of falling back silently; on this machine all
three were available.

## Real versus simulated

- **Real:** GPU rendering, shader compilation, draw submission, shadow passes, timer queries and
  frame synchronisation on the device. The numbers are measurements.
- **Simulated:** the scenes. They are deterministic boxes and quads with fixed positions, not
  product geometry, product materials or a product World. Light placement and intensity are chosen
  for cost, not appearance.
- **Arithmetic only:** the cinematic-scale reference row in [`census/census.md`](./census/census.md).
  That scene was not built.
- **Not run:** P3. [`model.md`](./model.md) states the prediction and the Gate C protocol; no real
  Stage reading is claimed here.

## Method

The base point is the assessment's: 1,000 separate meshes · 12 triangles each ·
`MeshStandardMaterial` · one shared material · one directional sun · shadows off · 1280×720 ·
DPR 1. One-factor sweeps vary mesh count (100–10,000), submission mode, triangles per mesh,
material, point and spot lights, shadow-casting light count, shadow caching and shadow-map size.
There are 62 configurations per backend.

Timing per configuration: 30 warm-up frames, then 90 measured frames. The page reports:

- CPU submit time around `renderer.render()`;
- `requestAnimationFrame` median and p95;
- GPU time from timer queries where available;
- `renderer.info` draws, triangles and programs;
- first-frame and light-variant compile time;
- provenance (UA, adapter, DPR, canvas, power, date, three revision).

`requestAnimationFrame` is vsync-clamped at 16.7 ms on this machine, so the fits do **not** use it.
They use the **synchronized frame**: CPU submit plus a GPU-completion readback (1×1
`gl.readPixels` for WebGL, `queue.onSubmittedWorkDone()` for WebGPU), with 24 samples per shadow
configuration and a median. The readback adds about 1.5 ms, so a synchronized value is a serial
cost, not a present-to-photon frame time. `gl.finish()` is a no-op under ANGLE/Metal and was not
used. Each backend gets a fresh canvas: one canvas cannot carry both a WebGPU and a WebGL2 context.

Fits are ordinary least squares. A fit is used only when R² ≥ 0.8 and the sweep is monotonic;
otherwise the raw curve is retained. The light-budget tables report the largest **measured** count
within 16.7/33.3 ms and the next tested count that failed. A fit estimate is shown beside the
measurement, never substituted for it: at 64 point lights the curve leaves its linear range
(A: 67.5 ms measured at 1,000 draws).

Shadow rows report authored lights and the pass count they cost. The deterministic mix is
1 directional at 1 light, +1 spot at 2, +2 spots and 1 point at 4 (9 passes), and +4 spots and 3
points at 8 (23 passes); a point light costs six cube faces.

## Constants

Synchronized milliseconds. `R²` in parentheses; **raw** marks a fit below 0.8 that is shown, not
used.

| Constant | A · WebGLRenderer | B · WebGPU | C · forceWebGL |
| --- | --- | --- | --- |
| per draw submission | 0.000675 (0.943) | 0.002435 (0.996) | 0.003192 (0.932) |
| per triangle | 9.94e-7 (0.981) | 1.64e-6 (1.000) | 1.41e-6 (1.000) |
| per unshadowed point light, N=1,000 | 0.196 (0.807) | 0.260 (0.877) | 0.233 (0.974) |
| per unshadowed point light, N=5,000 | 0.383 (0.959) | 0.269 (0.879) | **0.403 (0.781; raw)** |
| per unshadowed point light, 9 draws | 0.362 (0.982) | 0.264 (0.818) | 0.257 (0.874) |
| per shadow pass, N=1,000 | 0.228 (0.970) | 1.023 (0.984) | 0.803 (0.975) |
| per shadow pass, N=5,000 | 1.074 (0.989) | 3.577 (0.983) | 3.912 (0.970) |
| cached saving per pass, N=1,000 | +0.40 | −0.07 | −0.38 |
| cached saving per pass, N=5,000 | +1.27 | +1.61 | −2.09 |
| instancing frame ratio, N=1,000 / 5,000 | 1.21× / 1.89× | 1.93× / 5.09× | 1.51× / 3.81× |
| instancing CPU-submit ratio, N=1,000 / 5,000 | 6.25× / 51× | 6.0× / 21.3× | 6.0× / 29.3× |
| batching frame ratio, N=1,000 / 5,000 | 1.01× / 1.03× | 2.61× / 3.89× | 1.09× / 2.34× |
| compile, 4→5 lights (first frame minus steady) | 13.6 ms | 40.4 ms | 199.7 ms |
| program delta for that change | +1 | 0 | 0 |

The cached saving is the difference between the cached and every-frame rows; at 1,000 draws it is
within run-to-run noise (B and C negative), so it is reported raw and not used to derive a budget.

## Submission and frame cost

Synchronized ms for the same scene; draws in parentheses.

| Configuration | A | B | C |
| --- | --- | --- | --- |
| N=1,000, separate + shared | 6.35 (1,000) | 6.90 (1,001) | 7.10 (1,000) |
| N=5,000, separate + shared | 8.00 (5,000) | 22.40 (5,001) | 19.45 (5,000) |
| N=10,000, separate + shared | 11.00 (10,000) | 50.70 (10,001) | 44.00 (10,000) |
| N=1,000, InstancedMesh | 4.35 (1) | 3.45 (1) | 4.65 (1) |
| N=5,000, InstancedMesh | 4.20 (1) | 4.05 (1) | 4.45 (1) |
| N=1,000, BatchedMesh | 5.20 (1) | 2.55 (1) | 6.40 (1) |
| N=5,000, BatchedMesh | 7.70 (1) | 5.30 (1) | 7.25 (1) |

## Light-budget curves

Largest measured configuration within the budget; the next tested failure in parentheses.
Unshadowed lights are point lights added to the sun. Shadowed cells show `lights / passes`.

| Backend · N | Unshadowed 16.7 ms | Unshadowed 33.3 ms | Shadowed 16.7 ms | Shadowed 33.3 ms | Cached 16.7 ms | Cached 33.3 ms |
| --- | --- | --- | --- | --- | --- | --- |
| A · 1,000 | 32 (64 fails) | 32 (64 fails) | 8 / 23 (all tested) | 8 / 23 (all tested) | 4 / 9 (all tested) | 4 / 9 (all tested) |
| A · 5,000 | 16 (32 fails) | 32 (64 fails) | 2 / 2 (4 lights fails) | 8 / 23 (all tested) | 4 / 9 (all tested) | 4 / 9 (all tested) |
| B · 1,000 | 32 (64 fails) | 64 (all tested) | 4 / 9 (8 lights fails) | 8 / 23 (all tested) | 4 / 9 (all tested) | 4 / 9 (all tested) |
| B · 5,000 | none (0 fails) | 32 (64 fails) | none (0 fails) | 0 (2 lights fails) | none (2 lights fails) | none (2 lights fails) |
| C · 1,000 | 32 (64 fails) | 32 (64 fails) | 4 / 9 (8 lights fails) | 8 / 23 (all tested) | 4 / 9 (all tested) | 4 / 9 (all tested) |
| C · 5,000 | none (0 fails) | 32 (64 fails) | none (0 fails) | 0 (2 lights fails) | none (2 lights fails) | none (2 lights fails) |

At 5,000 draws, B and C fail the 16.7 ms budget before a single light is added: 5,000 separate
submissions cost more than the frame. Instancing is the only configuration that brings that shape
back inside 16.7 ms (A 4.2, B 4.05, C 4.45 ms).

## Findings

1. **On today's un-instanced scene shape, WebGPU loses.** At 1,000 draws the backends are close
   (6.35 / 6.90 / 7.10 ms). At 5,000 draws A is 2.8× faster than B; at 10,000 it is 4.6× faster.
   B's per-draw submit cost is 3.6× A's, and the page submits every mesh separately today.
2. **Collapsing submission removes A's lead; it does not establish a B lead.** With
   `InstancedMesh`, B reads 3.45 vs A's 4.35 ms at 1,000 draws and 4.05 vs 4.20 at 5,000. With
   `BatchedMesh`, B reads 2.55 vs 5.20 and 5.30 vs 7.70. These gaps are smaller than the
   difference between the backends' fixed costs (`c0` 5.66 vs 4.45 ms, [`model.md`](./model.md))
   and within the up-to-2× run-to-run slope variation noted under Limits, so they are read as a
   **tie**. B's per-triangle cost is 1.65× A's. *(Amended in review, 2026-11-12.)*
3. **WebGPU wins on many lights only when submission is not the bottleneck.** At 1,000 draws, B
   handles 64 point lights in 26.9 ms against A's 67.5 ms. At 32 lights A still wins (11.2 vs
   15.1 ms), and at 5,000 draws A wins at 16 and 32 lights because B's 5,000 submissions already
   cost 20.8 ms. The curves leave their linear range at 64 lights in every backend. This compares
   **default forward lighting** on both backends; WebGPU's many-light paths were not measured (see
   Review findings).
4. **Shadows are WebGL's clearest win.** A shadow pass costs 0.23 ms at 1,000 draws and 1.07 ms at
   5,000; B costs 1.02 and 3.58 ms; C 0.80 and 3.91 ms. Caching lifts A to 4 shadowed lights
   (9 passes) at 5,000 draws inside 16.7 ms, where every-frame reaches only 2 lights. B and C
   cannot use cached shadows at 5,000 draws because the main pass already exceeds the budget.
5. **`forceWebGL` is not a drop-in fallback.** C's per-draw cost is 4.7× A's; it takes 44 ms at
   10,000 draws against A's 11 ms, and adding a fifth light costs 200 ms on first frame even
   though the program count does not change. Any WebGPU trial must keep `WebGLRenderer` as the
   fallback, not three's internal one.
6. **Compile cost is not visible in program counts.** B and C add no program when the fifth light
   arrives, yet B spends 40 ms and C 200 ms on the next frame. A adds one program and spends 14 ms.
   A shader-count budget would miss the stall.

## Review findings (2026-11-12)

Recorded at review; the measured rows above are unchanged.

1. **WebGPU's many-light path was unmeasured; it is now measured.** three r187 ships two
   lighting systems for `WebGPURenderer` that need no custom shader, set with
   `renderer.lighting = …`: `ClusteredLighting` and `DynamicLighting`
   (`three/addons/lighting/`). Neither exists for `WebGLRenderer`. Finding 3 priced forward
   lighting only; the [lighting-system sweep](#lighting-system-sweep-2026-11-12) below prices both.
2. **B's per-draw cost is superlinear past 5,000.** From 5,000 to 10,000 separate draws B rises
   28.3 ms, about 5.7 µs per draw against the fitted 2.4 µs (C: 4.9 µs). B's and C's cinematic
   estimates in [`model.md`](./model.md) are therefore optimistic. The direction of Finding 1 is
   strengthened, not changed.
3. **`BatchedMesh` buys A nothing here.** A's batching frame ratio is 1.01× / 1.03×, against
   1.21× / 1.89× for `InstancedMesh`; multi-draw on Chrome / ANGLE-Metal behaves as if emulated.
   On `WebGLRenderer`, prefer `InstancedMesh` for collapsing submission, and recheck `BatchedMesh`
   on the Windows Gate C device before relying on it.
4. **A's fixed cost exceeding B's is unexplained.** `c0` is 5.66 ms on A and 4.45 on B, with a
   similar readback. This is why the 64-draw World prediction ranks B ahead of A; that ranking
   carries no weight.

## Lighting-system sweep (2026-11-12)

Added at review to price WebGPU's many-light path. **Button:** *Run lighting-system sweep (A + B)*
(about 8 minutes; keep the window uncovered). Result:
[`results/apple-m2-lighting-systems.json`](./results/apple-m2-lighting-systems.json).

**Setup.** Point lights get a finite range (1.5 grid cells) and are spread over the mesh plane, so
a clustered system has something to cull. Lights are unshadowed. Configurations: N = 1,000
separate meshes and N = 5,000 instanced, × 0 / 16 / 64 / 256 lights, for A's default lighting and
B's default, `DynamicLighting` (sized for 288 point lights) and `ClusteredLighting` (defaults),
plus the first frame after adding a 17th light. Shader and pipeline errors are captured, so a
failed compile cannot pass as a fast row.

**Provenance.** Same MacBook Air M2, but run in the Claude desktop app's built-in Chromium
(Chrome 156.0.8078.75), not Chrome 157. Absolute values are therefore compared only within this
file; A and B default rows were re-measured in the same session as anchors. A ran on battery (93 %),
B on AC (it was plugged in between the two). rAF stayed at 16.7 ms throughout, so no row was
throttled.

Synchronized ms (lower is better; 16.7 ms is the 60 fps budget):

| Lights | A default · 1k sep | B default · 1k sep | B dynamic · 1k sep | B clustered · 1k sep | A default · 5k inst | B default · 5k inst | B dynamic · 5k inst | B clustered · 5k inst |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 2.7 | 7.6 | 6.8 | 5.7 | 1.5 | 4.8 | 3.4 | 54.5 † |
| 16 | 5.6 | 7.2 | 7.3 | 9.6 | 6.5 | 5.8 | 6.6 | 38.2 † |
| 64 | 73.4 | 31.0 | **11.7** | 32.9 † | 102.1 | 38.1 | **10.4** | 27.2 † |
| 256 | **fails to compile** | 262.5 | **13.8** | 98.4 † | **fails to compile** | 341.3 | **16.2** | 19.5 † |

First frame after adding a 17th light: A default **171 ms**, B default **334 ms**, B dynamic
**0.1 ms**, B clustered 9.9 ms.

† Clustered rows are unstable: the synchronized value is non-monotonic in light count and well
above the same row's rAF median (21–31 ms) and GPU timestamp (2–31 ms), and the 256-light row's
first frame is 737 ms. Read them as "slower than dynamic in this scene", not as constants.

**Findings.**

1. **`DynamicLighting` is the WebGPU many-light result.** 256 ranged point lights cost 13.8 ms at
   1,000 separate draws and 16.2 ms at 5,000 instanced, inside the 60 fps budget on the M2, and
   adding a light costs nothing (0.1 ms). On A, default lighting reaches 73–102 ms at 64 lights,
   and **256 lights do not compile**: the fragment shader exceeds
   `MAX_FRAGMENT_UNIFORM_VECTORS (1024)`. Forward lighting on WebGL has a hard ceiling somewhere
   between 64 and 256 lights per material, and recompiles (171 ms here) whenever the count changes.
2. **This is three's implementation, not the API.** A fixed-size, range-tested light loop could be
   written for WebGL too, but only as custom shader code, which the T2 portability rule
   discourages. Among built-in paths, only `WebGPURenderer` + `DynamicLighting` holds hundreds of
   unshadowed lights.
3. **Clustered lighting did not beat dynamic here.** At 1,000 draws its CPU submit grows with light
   count (2.6 → 15.8 ms), and its timing is unstable. This scene is flat and front-facing, which
   gives depth slices nothing to cull; a deep interior may favour it. Not a basis for a decision.
4. **Up to about 16 lights, the backends are equivalent.** A is cheaper at 0–16 lights at 1,000
   separate draws, consistent with Finding 1 of the main run; the WebGPU advantage starts above
   that.
5. **Not measured:** shadows with these systems, spot lights, visual parity (`DynamicLighting`
   output was not compared to default lighting), any other device.

## Census (P1)

[`census/census.md`](./census/census.md) records the real Worlds. The one current-format saved
World (`Untitled project`, 31 Walls, 10 Rooms) renders **64 draws / 44,937 triangles / 6–7 programs /
3 lights (1 ambient, 2 directional) / 0 shadow-casting lights / 2 textures (512 KiB)** in Stage and
**58 draws / 25,203 triangles** in the visit view. The cinematic reference is 6,600 draws per pass
and 12 lights. The saved World is therefore about 1 % of the reference draw count and a quarter of
its lights: today's product Worlds do not exercise the regime where WebGPU's light advantage
appears.

`census/census-snippet.js` is the console hook used for that reading
(`__BISKIQ_PERF__` / `__BISKIQ_PERF_ON_RENDERER__`). See the census file for installation and limits.

## P3 (prepared, not run)

[`model.md`](./model.md) gives the count model, the M-series prediction for the named World (A 6.1,
B 5.2, C 4.6 ms synchronized, ±30 %), the arithmetic reference estimate (about 23 ms for A before
texture cost), and the Gate C protocol. No real Stage reading is claimed. Gate C is not authorized
by this prototype.

## Portability log

[`portability.md`](./portability.md) records what differed between the three backends: availability,
draw-count artefacts, program counts, timer support, compile behaviour, shadows, instancing,
batching, materials, the fallback, and what was not checked (notably visual parity).

## Limits

- One device and one browser session: MacBook Air M2, Chrome 157, AC power. No Iris Xe-class
  Windows laptop, no phone, no Safari or Firefox.
- Synthetic scenes, not product Worlds. Counts come from P1; costs come from these boxes.
- Synchronized timing includes a ~1.5 ms readback. It is comparable across these rows but is not a
  present-to-photon frame time.
- Timer queries are noisy at 1–4 ms; shadow rows repeat three times and take a median, but
  single-run variation of up to about 2× in a slope was observed across runs.
- The lighting-system sweep ran in the built-in Chromium (Chrome 156), not Chrome 157, with A on
  battery and B on AC; its numbers are compared within its own file only.
- No post-processing, no custom shaders, no visual comparison. Pixel parity between backends was
  not inspected; only cost and counts are claimed.
- The 64-light point is outside the linear fit. The budget tables therefore stop at the largest
  measured count rather than extrapolating.
