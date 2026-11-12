# Rendering and compute architecture: WebGPU, Rust/WASM and what actually limits Biskiq

Status: research assessment, written 2026-11-12 against `main` `73103c27`. **Not** a contract,
plan, roadmap change, dependency decision or authorization. No production code changed and no
benchmark ran. It proposes three small probes for the owner to authorize or decline (§6).

Labels follow the repository's research convention: **[M]** measured (with its source),
**[A]** arithmetic from stated assumptions, **[H]** a hypothesis a named probe can falsify,
**[E]** an external fact with a source, **[C]** a code fact at `73103c27`.

## 1. Answer first

1. **Rust/WASM and WebGPU do not belong in the same research effort.** One is a CPU language and
   module boundary; the other is a GPU API under the renderer. They have different triggers,
   different costs, different owners in the codebase and different deadlines. Bundling them makes
   both look more urgent and more expensive than either is.
2. **Rust/WASM: nothing has changed that reopens it.** P23B.8 closed it on 2026-09-29 with explicit
   reopen conditions, and the October studies reached the same verdict from the geometry side
   (§2). No new compute-bound path has been measured since. The one new heavy CPU candidate, T5
   booleans, points at Manifold, which is already C++ compiled to WASM. Recommendation: **no
   investigation now**; keep two cheap hygiene rules (§5.2) so that waiting stays free.
3. **WebGPU: the platform question has changed, and the useful question is narrower than
   "should we migrate".** Browser support is no longer the blocker, because three.js's
   `WebGPURenderer` falls back to WebGL2 by itself. The open questions are (a) whether it is
   *faster or slower* on our scene shape and our target laptops today, and (b) how much
   portability T2 is about to spend while adding reflections, lights, shadows and possibly post.
   (b) has a deadline; (a) does not.
4. **Neither technology removes Biskiq's predicted ceilings.** The reference-scene overruns
   identified in October (draw submissions, texture memory, triangles, per-edit evaluation) come
   from work that should not be done at all, and every one of them survives a faster language or
   API (§3). The mechanisms that remove them — instancing and shared materials, compressed
   textures, LOD, visibility — work in WebGL2 today and are portable to WebGPU later.
5. **Performance can be predicted without hours-long passes**, by separating *counts* (deterministic,
   free, from fixture data and `renderer.info`) from *unit costs* (a few constants per backend and
   device class, measured once in minutes). §6 proposes exactly that, and it doubles as the
   WebGPU go/no-go evidence.

The cheapest high-value action is not a migration or a benchmark. It is a short portability rule
for T2 slices (§5.1), so the T1/T2 refactor keeps the renderer decision open at near-zero cost.

## 2. What is already established (not re-derived here)

| Source | Finding | Still valid? |
| --- | --- | --- |
| P23B.8 decision record (PR #99, 2026-09-29; in git history at `23b0b3cb`) | D-0 gate FAILED: no residual stage was both material and compute-bound. The largest residuals were Svelte `$state` proxy reads (same merge 43.7 ms proxied vs 3.6 ms plain, 12.1×), comparison scope and discarded work. Worker and Rust/WASM both NOT JUSTIFIED, with stated reopen conditions | The method and verdict stand. Some measured paths were deleted by #115 (for example `plan-room-labels.ts`), so the *numbers* are historical; nothing has measured a new compute-bound path since |
| [Geometry, identity and performance](./native-creative-depth/geometry-identity-and-performance.md) (2026-10-25) | Curve constructions are sub-millisecond in plain JS; the production wall path is TypeScript at 3.3–9.3 ms for one 40-opening wall with algorithmic levers unused; Manifold is the one kernel worth a spike; threaded WASM should be avoided (COOP/COEP); WebGPU compute is unsuitable for deterministic geometry (float32, nondeterministic atomics); "WASM or not" is the wrong framing | Yes. T5 cites it |
| [Cinematic-scale computational strategy](./cinematic-scale-computational-strategy.md) (2026-10-24) | Reference scene overruns every budget, and none of the overruns comes from slow kernels. "Faster kernels, WASM, workers or WebGPU" were explicitly not chosen as the strategy; WebGPU compute is named a later *enabler* for cluster LOD and GPU culling | Yes; the arithmetic is code-shape driven and the code shape has not changed (§3) |
| [North Star technology gates](../docs/reference/north-star.md#technology-gates) | WebGPU/WGSL stays bounded until a real product or performance requirement justifies it; Rust/WASM needs an isolated CPU bottleneck and boundary-inclusive proof | Yes. This assessment works inside those gates |
| T1.P02.S06 acceptance (PR #190, 2026-10-27) | Indexed and incremental compile shipped; static shadow maps re-render only on change; no Rust/WASM introduced. The 2026-10-28 amendment suspended the mandatory benchmarking strategy indefinitely | Yes. §6 is designed to fit inside that suspension: no milestone pass, no battery |

The user's premise that "Biskiq has evolved considerably" is true for the *product* (T2 look, T5
geometry, the single Stage canvas). It is not true for the *CPU cost picture*, which is what the
Rust gate is about.

## 3. Where the ceilings are, and which technology touches each

Reference scene and arithmetic from the cinematic-scale study; code facts rechecked at `73103c27`.

| Ceiling (reference scene, laptop A) | Mechanism today **[C]** | Does Rust/WASM help? | Does WebGPU help? | What removes it |
| --- | --- | --- | --- | --- |
| ≈ 6,600 draws per pass vs ≤ 1,000 target **[A]** | No `InstancedMesh` or `BatchedMesh` anywhere in `apps/editor/src` or `packages/*/src`; each placement clones its model and materials (`AssetModel.svelte`, used by Stage and visitor, via `museum/assets/model-utils.ts:17–31`), and a material override builds a fresh `MeshStandardMaterial` per mesh (`museum/assets/instance-material-remap.ts:43`) | No | **Not by itself.** Lower per-draw driver cost in principle, but three's WebGPU backend has been reported at about 2× the per-draw CPU cost of `WebGLRenderer` on many-mesh scenes **[E]** (r183 report, §8). A many-mesh scene is exactly our shape | Instancing / batching + shared materials. Works in WebGL2 now |
| ≈ 2.5 GiB texture memory vs ≤ 384 MiB **[A]** | Imported maps decode to RGBA8 | No | No (same formats) | KTX2/Basis compressed textures, residency |
| ≈ 9 M triangles **[A]** | One detail level, no LOD | No | Later: compute-driven cluster LOD and GPU culling are WebGPU-native **[E]** | LOD chains, impostors, visibility from topology |
| Per-edit evaluation | Incremental compile shipped (S06); residuals were proxy/runtime-bound **[M]** | No: proxy reads and comparison scope are not arithmetic | No | Plain data across hot boundaries; influence-scoped evaluation |
| Shadow passes × casters | PCF shadow map; static-shadow invalidation shipped (`apps/editor/src/lib/render/shadow-invalidation.ts`) | No | Marginal | Cached/baked shadows; T2 Gate C budget |
| **Many lights** (T2 Lights: point/spot/directional, rigs) | Forward lighting; cost and shader variants grow with light count | No | **Possibly.** Clustered/tiled light culling is a compute-shader technique that is natural in WebGPU **[H]**, to be checked against three's current addons | Light budget (D9), clustered lighting, bake |

**Reading:** every row's main remover is backend-neutral. WebGPU is a possible accelerant on two
rows (triangles via GPU-driven LOD/culling, many lights) and a possible *regression* on the row
that is currently worst (draw submissions). Rust/WASM touches none.

## 4. Assumptions challenged

- **"Are our foundations sufficient?"** The foundations (TypeScript, Svelte 5, Three, WebGL2) are
  not what fails the reference scene. The missing *mechanisms* are. Swapping the foundation
  without the mechanisms would very likely make the reference scene slower, not faster (row 1).
- **"Rust might be faster."** It may be a constant factor faster on pure arithmetic. The measured
  residuals were not arithmetic. And the fix for the dominant residual — reading plain data instead
  of `$state` proxies — is the same prerequisite a WASM module would need anyway, and it alone
  gave 12× on the measured merge. Do that first, everywhere it matters; a WASM case can only be
  argued *after* it.
- **"WebGPU means better browser support risk later."** Inverted. WebGPU now ships by default in
  Chrome/Edge, Safari 26 and Firefox (Windows from 141, Apple-silicon macOS from 145); Linux
  Firefox and Intel-Mac Firefox are the gaps **[E]**. Because `WebGPURenderer` falls back to WebGL2,
  support is not the risk. The risks are fallback performance and shader porting.
- **"We need big benchmarks to know."** No. Frame cost on this kind of renderer is well modelled
  as counts × unit costs. The counts are deterministic; the unit costs are few and stable. §6.
- **"Waiting is risky."** For Rust, waiting costs nothing if domain code stays pure. For WebGPU,
  waiting costs something *specific and controllable*: each new `ShaderMaterial`, `onBeforeCompile`
  patch or `EffectComposer` pass must later be ported to TSL node materials, because
  `WebGPURenderer` does not support them **[E]**. Today that surface is tiny (§5). T2 is about to
  decide how reflections, glow, transmission and any post pass are built. That is the deadline.

## 5. What to do now (no migration, no benchmark)

### 5.1 WebGPU portability: current lock-in surface and a rule for T2

**[C] Inventory at `73103c27`** (non-test sources in `apps/editor/src`, `packages/*/src`):

| Surface | Count | Where |
| --- | --- | --- |
| Renderer construction | 1 factory | `apps/editor/src/lib/render/managed-webgl-renderer.ts`, used by Stage, visitor preview and `/dev/materials` |
| Hand-written GLSL (`ShaderMaterial`) | 1 file | `apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts` (editor mat grid, editor-only) |
| `onBeforeCompile` | 1 (internal) | The renderer factory briefly wraps it to capture three's shared DFG lookup texture for disposal (`managed-webgl-renderer.ts:46–75`). A WebGL-internals workaround: a WebGPU trial needs its own leak check, not a port |
| `RawShaderMaterial`, `EffectComposer`, postprocessing library | 0 | — |
| `WebGLRenderTarget` | 1 file | `StageSnapshotRenderer.svelte` |
| Shadow map control | 1 module | `shadow-invalidation.ts` (already renderer-agnostic by design) |

This is close to the best possible starting position: a WebGPU trial is a factory swap, one GLSL
file, one render-target site and a leak check, not a migration. The goal is to keep it that way through T2. Proposed rule for T2
slices (a review checklist line, not a contract change):

1. Materials come from the shared material factory using built-in Three materials; a new
   `ShaderMaterial` / `onBeforeCompile` needs a sentence in the PR naming its TSL equivalent or
   why it stays editor-only.
2. **No post-processing pipeline is built on `EffectComposer` before the backend question (§6) is
   answered.** Post is the largest single fork between the two renderers; if a Gate B/C promise
   needs bloom or similar, that is the moment to decide the backend, not after.
3. Renderer-specific API (`renderer.info`, render targets, context access) stays behind the
   existing render modules, not in Svelte components.

This costs T2 nothing it has planned today: S0's approved baseline is `MeshLambertMaterial` +
`NoToneMapping` (PR #291), and Gate B/C are not yet authorized.

### 5.2 Rust/WASM: keep waiting free

1. Domain kernels in `packages/*-core` stay pure functions over plain data (no Svelte proxies, no
   Three objects), which they already are by architecture rule. This is what made the 12× fix
   possible and is what a WASM boundary would require.
2. Hot-path inputs are copied out of `$state` once at the boundary, not read through proxies in
   loops. This is a performance rule with or without Rust.

With those two rules, a later Rust/WASM decision remains a local, per-function choice under the
P23B.8 reopen conditions. There is no lock-in to avoid.

### 5.3 For the T1/T2 joint refactor

The finding that matters most to the refactor is **not** about WebGPU or Rust: describe-once
sharing (instanced submission, shared materials instead of per-placement clones) is the largest
predicted win on the reference scene, backend-neutral, and it changes how Scene placements map to
render objects. If the refactor touches the Scene → render adapter boundary, it should leave room
for one render object to serve many placements. That is a mechanism inside the existing authority
split, not a new authority.

## 6. Proposed probes (owner decides; each is minutes to run, none uses the T2 harness)

**P1 — Count census (deterministic, no timing).** For two or three real Worlds plus the
cinematic-scale reference shape, record per presented frame: draws per pass, shadow passes ×
casters, triangles, distinct programs, texture bytes by format, light count. Source:
`renderer.info` (already read by `perf-marks.ts`) and fixture data. Output: a table. Decides
nothing alone; feeds P3.

**P2 — Unit-cost calibration (a standalone prototype page, not product code).** One page under
`prototypes/` that sweeps: N meshes (separate / instanced / batched) × light count × shadow on/off,
under three renderer configurations: `WebGLRenderer`, `WebGPURenderer` (WebGPU backend),
`WebGPURenderer` (`forceWebGL`). It reports CPU submit time per draw, GPU frame time where timer
queries are available, and first-frame / shader compile time. About five minutes per device, run
by the owner on the M-series laptop and one Iris Xe-class Windows laptop (phone optional).
Output: roughly a dozen constants per (backend, device).

**P3 — Prediction check.** Predict frame time for one existing World from P1 × P2, then take one
short real reading in Stage. If prediction and reading agree within a stated band (proposed ±30%),
the model becomes the cheap prediction tool the owner asked for; if not, the residual names what
the model is missing.

**Decisions these produce:**

| Outcome | Decision |
| --- | --- |
| WebGPU per-draw cost ≥ WebGL on target devices (expected for un-instanced scenes **[H]**) | Stay on `WebGLRenderer`; keep §5.1; re-run P2 on a later three release. Cheap to repeat |
| WebGPU wins at instanced/batched counts and on many lights | Promote a WebGPU *trial* behind the existing factory after instancing lands; port `stage-mat-grid.ts` to TSL; Tier 2 owner decision |
| `forceWebGL` fallback materially slower than `WebGLRenderer` | A switch would penalise WebGPU-less browsers; any trial must keep `WebGLRenderer` as the fallback, not three's internal one |
| P3 within band | Use counts × constants for future budget questions instead of passes |

**What I would not run:** any Rust/WASM benchmark (no named function meets the reopen
conditions); WebGPU compute for geometry (unsuitable for deterministic semantics); any milestone
pass (suspended, and unnecessary for these questions).

**Delegation.** P2 is a self-contained Tier 0 prototype and a good fit for a separate agent
session: one HTML page, three's own builds, no product imports, no dependency added to any
workspace. P1 needs a short product-side read of `renderer.info` on real Worlds and can run here.
P3 needs the owner's devices for the one real reading.

## 7. Questions for the owner

1. Is **many lights** (rigs, fixtures, several shadow-casting lights) a real T2/T3 promise for
   visitors on integrated GPUs? If yes, it is the most likely place where WebGPU becomes
   product-justified under the North Star gate, and P2 should weight it.
2. Should §5.1 become a line in the T2 slice review checklist now, ahead of Gate B?
3. Authorize P1–P3 (and whether P2 goes to a separate session), or defer all three until T2
   Gate C is authorized, which needs the same device readings anyway?

## 8. Sources

- [WebGPU is now supported in major browsers (web.dev)](https://web.dev/blog/webgpu-supported-major-browsers)
- [gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/implementation-status)
- [three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer) — `ShaderMaterial`,
  `RawShaderMaterial` and `onBeforeCompile` are unsupported; port to node materials / TSL
- [three.js forum: WebGPURenderer 2× slower CPU and 5–10× slower first frame than WebGLRenderer on
  many-mesh scenes (r183)](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904) —
  a community report, not an authoritative benchmark; P2 exists to replace it with our own numbers
- [three.js forum: WebGPURenderer(forceWebGL) vs WebGLRenderer](https://discourse.threejs.org/t/webgpurenderer-forcewebgl-true-vs-webglrenderer/87805)
- Repository: P23B.8 decision record (`git show 23b0b3cb:docs/roadmap/p23b-geometry-performance/p23b.8-rust-wasm-evaluation/2026-09-29-P23B.8-decision-record.md`),
  [geometry identity and performance](./native-creative-depth/geometry-identity-and-performance.md),
  [cinematic-scale strategy](./cinematic-scale-computational-strategy.md),
  [T2 direction §8](../docs/roadmap/t2-look-atmosphere/README.md),
  [S06 acceptance](../docs/archive/roadmap/closed-phases/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md)
