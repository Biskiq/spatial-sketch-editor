# Browser performance and delivery — baseline, workloads, budgets and gates

Status: decision input for draft PR #173, 2026-10-22, at HEAD `3e8342a3` on
`codex/product-convergence-2026-10-21`. Planning/research only: no ratification, dependency
adoption, benchmark workflow, CI gate or implementation authorization. The
[owner production hold](../../../docs/roadmap/README.md#production-implementation-hold) applies.
`git diff 78cafc3a 3e8342a3 -- apps packages` is empty, so every source observation holds for the
sibling packets' revisions too. Disposable probes live in [`probes/performance/`](./probes/performance/README.md).

**Owner direction carried.** Be aggressive about editor and viewer performance on a regular laptop:
a reproducible baseline, representative workloads and explicit budgets; complete user flows
(startup, loading, editing, navigation) including input latency, frame-time tails, compilation,
memory and dependency delivery; demonstrated material problems resolved *inside the consuming
slice*, justified by profiling; editor dependencies and solvers reach the viewer only where its
execution requires them; cold and repeated use and larger realistic projects; architectural
expressiveness intact.

**Evidence labels.** **Observed** — source/build-output inspection at `3e8342a3`. **Measured** — a
command or probe executed for this packet, with its result file. **External** — published
thresholds or tool facts from primary documentation. The Event Timing/INP measurement constraints
below were checked against their linked primary sources on 2026-10-22; other external claims are
stated from knowledge and must be rechecked before contract promotion. **Inference** — a conclusion
drawn from the above. **Proposal** — unratified
recommendation. **Not run** — specified only (all browser runtime flows: no Playwright/Puppeteer is
installed and no browser was launched).

## Authority this packet works under

- **Observed** [`apps/editor/tests/README.md` §Correctness tests vs performance benchmarks](../../../apps/editor/tests/README.md#correctness-tests-vs-performance-benchmarks):
  latency/frame/memory/allocation/throughput benchmarks are **on demand**; #115 retired the P23B
  PERF harness, browser baseline recorder, reuse ratchet and every wall-clock threshold; **no**
  permanent benchmark workflow, registry, scheduled job or CI gate exists, and adding one needs
  separate owner authorization. Everything below that would be permanent is therefore a
  **proposal for owner authorization**, not an installation.
- **Observed** [North Star §Technology gates](../../../docs/reference/north-star.md#technology-gates):
  optimization follows *measured* large-scene/runtime bottlenecks (instancing, LOD, culling,
  streaming, asset optimization, cached/baked procedural derivatives) without changing ownership;
  WebGPU stays bounded; Rust/WASM needs an isolated CPU bottleneck and boundary-inclusive proof;
  compilation placement, invalidation/cache design and history implementation are **open**
  mechanism decisions inside the ratified F shapes.
- **Observed** [Architecture §Product routes, §Platform boundary, §Release packages, §Delivery-derivative exception](../../../docs/reference/architecture.md#product-routes-current):
  `/`, `/projects`, `/editor` (redirect), `/project/:id/spatial` (Stage), `/p/:publicationId`
  (visitor-only; public reads 404 until T4's prepared reader); the destination release is a
  compiled, versioned visitor package, and versioned immutable reproducible delivery derivatives
  outside authored documents are permitted.
- **Observed** AGENTS.md rules 4–6: visitor chunks carry no editor session/selection/history/
  gizmo/layout UI/authoring infrastructure; runtime-safe domain evaluators (Layout
  representation) are *shared* with visitor runtimes — isolation is about editor machinery, not
  forking domain math; one canonical architectural compiler.
- First-wave consumers ([convergence §Proposed next engineering batch](../../../docs/roadmap/product-convergence-2026-10-21.md#proposed-next-engineering-batch)):
  **C1** native straight Walls (draw, close, divide, Opening, delete; Plan/3D agree; Undo/Redo;
  Save), **C2** own flat GLB import (upload, validate/stage, scale/pivot/footprint, approve, place,
  duplicate, Save/reopen; Preview sees the same resource), **T3.P02.S01** capture + Cut Preview
  (dense 20/50-View and 15/30-Stop fixtures; isolated Preview with "no editor machinery in the
  preview chunk"). Later: CD-4 structures/datums/overheads, CD-5/CD-6 retained parts and
  annotations, CD-8 kernel spike.

## Measured delivery baseline

### Build

**Measured.** `npm run build` (root → `@portfolio/editor` → `vite build`, adapter-vercel) needs no
environment: the client reads `PUBLIC_API_ORIGIN` through `$env/dynamic/public` and no module
imports `$env/static/*` or `$env/dynamic/private` (observed by search), so no placeholder was
needed. Exit 0; **10.0 s wall** (a repeat: 8.6 s), 0.96 GiB max RSS. Vite 6.4.3's SSR pass reports
6.9 s, which includes the nested client pass at 3.6 s (691 client modules). Vite's 500 kB chunk
warning fires. `npx vite build --sourcemap` took 8.8 s. All outputs are under gitignored
`apps/editor/.svelte-kit` / `.vercel`. Repeat builds agree within 0.3 KiB br per route.

### Route load sets (what a cold navigation fetches)

**Measured** with [`bundle-analysis.mjs`](./probes/performance/bundle-analysis.mjs): SvelteKit's
server node table gives each route's exact modulepreload set (start + app entry imports + root
layout/error nodes + leaf node imports); the client manifest shows **no dynamic imports other
than route nodes** — every route loads its whole closure up front. Sizes are KiB of the emitted
files; gzip level 9 and brotli quality 11 via `node:zlib`.

| Route (leaf node) | Files | JS raw | JS gzip | **JS br** | CSS br | Role |
|---|---:|---:|---:|---:|---:|---|
| `/` (2) | 22 | 928.8 | 252.8 | **212.0** | 0.5 | landing |
| `/editor` (5) | 21 | 926.3 | 251.8 | **211.2** | 0.1 | redirect only |
| `/projects` (8) | 23 | 935.2 | 255.8 | **214.8** | 0.6 | hub |
| `/project/[projectId]/spatial` (7) | 30 | 1,562.7 | 443.0 | **375.6** | 3.6 | Stage |
| `/p/[publicationId]` (6) | 28 | 1,255.3 | 353.2 | **300.6** | 0.9 | visitor |
| `/dev/assets` (3) · `/dev/materials` (4) | 26 · 22 | 1,011.0 · 852.6 | 281.7 · 234.8 | 237.7 · 196.4 | — | dev previews |

Largest Stage-only file: the leaf node `nodes/7.*.js`, 367.7 KiB raw / 88.4 KiB br.

**Measured.** One shared chunk (`CnT3qipM.js`, 746,470 B raw / 190,093 B gzip / **155,808 B br**)
is *pure* `three` core (729.0 KiB attributed) and is in **every** route's set. Three 0.186.1 ships
its core as one large ES module (`build/three.core.js`). Rollup splits by module, not by export, so
this chunk holds the tree-shaken union of every route's Three usage.

### Package attribution per route

**Measured** from decoded sourcemaps (each generated span charged to its mapping's source; 1 %
unmapped glue). `br*` is standalone brotli of that package's spans — slightly over-states its
share. KiB.

| Package (bucket) | Stage `/project/…/spatial` raw / br* | Visitor `/p/…` raw / br* | Hub `/projects` raw / br* |
|---|---:|---:|---:|
| `three` core | 729.0 / 152.0 | 729.0 / 152.0 | 729.0 / 152.0 |
| `three/examples` addons (GLTFLoader, meshopt decoder, BufferGeometryUtils, SkeletonUtils; visitor adds OrbitControls) | 70.2 / 18.0 | 89.6 / 21.7 | — |
| `@portfolio/layout-core` | 162.3 / 42.9 (compiler + topology/noding/reconciliation planners + plan representation) | 78.5 / 21.8 (compiler + codec only) | 13.2 / 3.6 (codec, identity, types) |
| `@portfolio/project-model` | 145.2 / 31.8 | 81.3 / 18.4 | 70.2 / 15.7 |
| `@portfolio/camera-core` | 35.0 / 10.5 | 24.7 / 7.2 | 20.0 / 6.0 |
| `svelte` runtime · `@sveltejs/kit` | 55.0 / 18.6 · 28.7 / 10.0 | 53.7 / 18.1 · 28.7 / 10.0 | 49.6 / 17.0 · 28.7 / 10.0 |
| `@threlte/core` · `@threlte/extras` | 21.2 / 6.5 · 1.6 / 0.6 | 22.0 / 6.8 · 2.4 / 1.0 | — |
| `@threlte/extras` residue: `three-viewport-gizmo` · `three-mesh-bvh` (GLSL) · `@threejs-kit/instanced-sprite-mesh` | 8.1 · 7.8 · 7.5 (≈ 7.4 br*) | 8.1 · 7.8 · 7.5 (≈ 7.4 br*) | — |
| Editor authoring `lib/authoring/{adapters,stage,save,f4,a11y,scene}` | 151.1 / 41.0 | **0** | — |
| Editor routes (Stage page) | 28.3 / 8.3 | 2.9 / 1.2 (public page) | 2.5 / 1.1 |
| Shared runtime-safe renderer `lib/{layout,museum,render,content}` + `lib/visitor` | 80.0 / 21.7 | 103.0 / 28.4 | — |
| `lib/platform` (persistence) | 9.1 / 2.7 | — | 9.1 / 2.7 |
| `robust-predicates` | 2.4 / 0.8 | — | — |

### What reaches the visitor `/p/[publicationId]`

**Measured** (module list in the sourcemap report): the visitor closure contains the visitor
shell/runtime (`lib/visitor/*`), the shared renderer (`lib/museum/{assets,materials,entities,layout}`,
`lib/layout/wall-mesh-builder.ts`, `lib/render/wall-geometry-adapter.ts`, `lib/content/{assets,materials}`),
`@portfolio/camera-core` (`camera-motion`, `camera-route`, `navigation`), `@portfolio/project-model`
(scene codec + validation, units runtime/validate, Experience interpreter/companion, channels,
references) and `@portfolio/layout-core`'s **canonical compiler** (`layout-geometry*`,
`layout-junction-resolution`, `layout-junction-clearance`, `layout-wall-offset-clearance`, `layout-wall-centerline`,
the wall-first codec) plus the `p2311-perf` mark helper. It contains **no** module under
`src/lib/authoring/**` (Stage, adapters, F.4 coordinator/history, Save), no editor route code, no
`layout-wall-topology-ops`/noding/reconciliation planners, no `layout-plan-representation`, and no
`robust-predicates` (that one is Stage-only).

**Inference — what visitor execution actually requires today.** The current cold path
(`visitor-cold-runtime`) validates and compiles the *authored* release snapshot in the browser
(architecture §Release packages "Current P22 path"), so the scene codec and the Layout compiler
*are* required by visitor execution now; they are runtime-safe domain evaluators (rule 4), not
editor machinery. They become *removable* only when T4's prepared reader ships compiled delivery
derivatives — a trade (≈ 79 KiB raw layout-core + 23 KiB mesh builder + 81 KiB project-model in
code, vs the derivative's payload bytes and the compile time it saves), not a free win; see
[experiment E-4](#bounded-experiments-each-with-a-trigger).

**Measured — residue that visitor execution does not require:**

- **D-1** `@threlte/extras` barrel side effects: `three-viewport-gizmo` (7.8 KiB raw — a *gizmo*),
  `@threejs-kit/instanced-sprite-mesh` (7.5) and `three-mesh-bvh` GLSL strings (7.4) land in the
  shared asset chunk `DW4gVgCZ.js` used by `/p`, the Stage and `/dev/assets`, although source imports
  only `useGltf`, `useMeshopt` and `OrbitControls` from `@threlte/extras` (observed; its
  `package.json` declares no `sideEffects`).
- **D-2** `meshopt_decoder` (25.9 KiB raw) and `GLTFLoader` (42.9) are **static** in the first-load set
  of `/p` and the Stage even for a project with no models; every catalogue GLB uses
  `EXT_meshopt_compression` + `EXT_texture_webp` + `KHR_mesh_quantization` (observed by GLB header
  read), so they are needed *when a model loads*, not before the first architectural frame.
- **D-3** `p2311-perf.ts` (P23.11 diagnostic marks, inert unless a dev flag is set) is re-exported
  from the layout-core root. It wraps `planWallChain` and snap indexing in the Stage. Its module
  appears in the visitor's sources at ≈ 0 bytes after tree-shaking. The bytes are negligible. It is,
  however, the kind of retained bench seam the owner has called disposable.

**Measured — product routes carrying weight they do not use.** `/` (landing), `/projects` (hub) and
`/editor` (a redirect) each load ≈ 211–215 KiB br of JS, of which ≈ 152 KiB br is the full Three
chunk: `routes/+page.svelte` → `lib/platform/project-persistence.ts` → `project-model` scene codec →
`project-layout-semantics.ts` → `camera-core` `createCameraPositionPath` → `three`
(`CubicBezierCurve3`, `CurvePath`, `Vector3`, …) (observed chain). Because the union Three chunk is
shared, this does warm the cache for the Stage, but it front-loads ≈ 0.75 MB of JS parse/compile on
the landing page and the hub.

**Measured — emitted, never referenced.** Three's Draco and Basis decoders (`draco_decoder.{js,wasm}`
×2, `draco_wasm_wrapper.js` ×2, `basis_transcoder.{js,wasm}`, ≈ 1.8 MiB) are emitted into
`_app/immutable/assets` but no client chunk, node table or server file references their hashed
names: deployment weight only, never transferred. Their emitter was not identified (uncertainty U-6).

### What the existing boundary suites already guarantee

| Suite | Guarantees | Does not guarantee |
|---|---|---|
| `vite/public-surface-boundary-plugin.ts` (build hook; build fails) + `tests/vite/public-surface-boundary-plugin.test.ts` | The resolved dependency graph from `routes/p/[publicationId]/+page.svelte` (static + literal dynamic imports) contains no module matching the forbidden set, no unresolved computed `import(expr)`, and the root exists | Current `lib/authoring/**` paths absent from that forbidden set; byte budgets; ancestor layout/error roots or unrelated modules sharing an emitted chunk unless reachable from the page's dependency graph |
| `vite/preview-surface-boundary-plugin.ts` + `lib/visitor/preview-surface-boundary.ts` (+ two tests) | Same dependency walk from `lib/visitor/VisitorPreviewSurface.svelte`; forbidden set = `src/lib/editor/`, Museum*/Chopin/Paris legacy, `Workspace3DView`, `EditorSceneEntities`, `project/project-codec`, `project-export-store`, `binary-texture-store` | An independent all-`lib/authoring/**` prohibition for the Preview root; byte budgets or containing-route ancestor/chunk coverage |
| `tests/lib/authoring/f4-public-isolation.test.ts` (arch) | Source import closure of the public route (shared resolver `tests/helpers/import-closure.ts`) excludes **all `lib/authoring/**`**, including Stage, adapters, Save and F.4, plus `lib/platform/project-persistence.ts`, with positive controls | An independently rooted Preview proof, emitted chunk membership or byte budgets |
| `lib/visitor/visitor-public-route.test.ts`, `visitor-identity-isolation.test.ts` | Named visitor sources carry no `$lib/editor/`, codec/store/Chopin tokens; `lib/visitor` + `lib/museum` import nothing from `apps/editor` or `$lib/editor` | — |
| `lib/project-model/program-entry-closure.test.ts` (arch) | `project-model/program` (ExecutionProgram@1) closes over an exact module set: no source codec, compiler, root barrel, Camera evaluator or Three — the delivery-only entry a prepared reader needs | That the visitor *uses* that entry |

**Observed gap G-1.** The public/preview build forbidden set and the named visitor token checks
still name **`src/lib/editor/`** / **`$lib/editor`**, a tree #115 deleted. Current editor machinery
lives in `src/lib/authoring/**`. The existing F.4 source-closure test already rejects that **entire
tree** from the public route (`f4-public-isolation.test.ts:45`); a new reachable authoring import
would fail that test. The remaining correction is to align the build forbidden set and token
checks with it, and establish the same all-authoring guarantee independently for the Preview root.
Today's emitted visitor set is clean (measured above). **G-2** no current gate observes bytes,
landing/hub delivery, lazy loading or runtime cost. Retain the existing source-closure guarantee
and align the other structural checks (proposal R-1); do not claim that a page-root dependency
walk also proves ancestor-layout or unrelated shared-chunk isolation.

## Measured compile and evaluation cost (Node, relative)

**Measured** with [`compile.probe.ts`](./probes/performance/compile.probe.ts) (warm, in-process,
Vitest forks, `--expose-gc`), [`cold-compile.mjs`](./probes/performance/cold-compile.mjs) (fresh
process per run), [`mesh.probe.ts`](./probes/performance/mesh.probe.ts) and
[`history.probe.ts`](./probes/performance/history.probe.ts). Machine: **Apple M2 (4P+4E), 16 GiB,
macOS 15.7.2, Node v26.7.0 (V8 14.6)**, mains power. Fixtures ([`fixtures.ts`](./probes/performance/fixtures.ts))
are k×k gallery grids of 6 m rooms built only through public planners (`planWallChain` with declared
host snaps — one connected component — then one `planCreateWallFirstOpening` per Wall ≥ 3 m: doors on
interior Walls, windows on the perimeter); every fixture compiles with zero blocking issues.
**These are relative-cost and scaling evidence on a fast developer machine, not reference-laptop
budgets.** Milliseconds; median / p95 (n in the result files).

**Warm, in-process** ([`results/compile-warm.json`](./probes/performance/results/compile-warm.json),
the lead verification run at `2026-10-22T10:10:42.901Z`) — median / p95 ms. The table uses this
checked-in run; it does not mix its tails with the earlier run's medians.

| Step (what runs) | starter (4 W) | grid-3 (24 W · 24 O · 9 R) | grid-7 (112 · 112 · 49) | grid-14 (420 · 420 · 196) | grid-20 stress (840 · 0 · 400) |
|---|---:|---:|---:|---:|---:|
| Canonical compile `compileWallFirstLayoutGeometry` | 0.72 / 1.42 | 4.62 / 6.17 | **31.36 / 38.96** | **138.30 / 158.33** | 294.85 / 352.26 |
| Plan evaluation `evaluateLayoutPlan` | 0.09 / 0.21 | 0.46 / 0.98 | 1.19 / 2.17 | 4.43 / 6.53 | 12.77 / 26.13 |
| Layout parse + validate / serialize (medians) | 0.02 / 0.03 | 0.15 / 0.11 | 0.67 / 0.46 | 2.24 / 1.58 | 4.44 / 3.02 |
| Envelope serialize / content id, SHA-256 (medians) | 0.06 / 0.06 | 0.14 / 0.18 | 0.59 / 0.54 | 2.12 / 2.06 | 4.05 / 3.58 |
| **Project open** — Stage `admitSourceJson` (parse, validate, compile, runtime, identity) | 1.30 / 3.03 | 7.50 / 8.68 | **46.00 / 123.52** | **179.20 / 201.87** | 468.49 / 531.83 |
| **Wall drag, per pointer move** — `planWallManipulation` (rigid move; 60/60 planned) | 0.79 / 1.17 | 5.56 / 6.70 | **36.15 / 44.28** | **186.70 / 226.81** | 518.84 / 835.76 |
| Wall-chain commit planner — independent new Wall | 1.01 / 2.34 | 5.46 / 6.26 | 36.26 / 44.07 | 164.04 / 214.18 | 428.44 / 565.74 |
| Wall-chain commit planner — declared T that splits a Room | — | 7.98 / 9.59 | 36.85 / 45.80 | 174.93 / 212.13 | 424.81 / 592.09 |
| Opening create planner (last 30 of the fixture build) | — | 5.48 / 6.80 | 30.33 / 38.56 | 142.64 / 176.14 | — |
| **F.4 accept** (Wall height; real coordinator + Layout planners) | 1.70 / 9.24 | 6.95 / 9.72 | **43.17 / 62.17** | **195.37 / 218.55** | 464.65 / 743.93 |
| **Stage post-install admission** (host re-admits every accepted source) | 1.26 / 1.87 | 7.09 / 8.14 | **41.65 / 62.40** | **179.79 / 212.67** | 403.22 / 620.83 |
| Undo / Redo medians (coordinator only; the host then re-admits) | 0.40 / 0.43 | 1.06 / 1.02 | 3.60 / 3.58 | 14.11 / 13.51 | 21.61 / 22.62 |
| Retained heap: compiled geometry / admitted snapshot including its geometry (MiB; separate measurements, not additive) | 0.26 / 0.30 | 1.68 / 1.79 | 7.88 / 8.41 | 32.02 / 33.61 | 68.12 / 70.81 |
| Layout JSON / envelope JSON (KB) | 2.3 / 4.9 | 19.2 / 26.2 | 97.8 / 123.7 | 408.3 / 500.9 | 680.1 / 813.7 |
| Fixture build through planners (one edit at a time) | 10 ms | 0.18 s | 3.7 s | 64.8 s | 8.8 s (no Openings) |

**Cold process** ([`results/compile-cold.json`](./probes/performance/results/compile-cold.json)) — one fresh `node`
process per run, 7 runs, median (max) ms; the layout-core bundle is esbuild-built, unminified.

| Fixture | Parse + validate | **First compile (JIT-cold)** | Second | Tenth | First Plan evaluation |
|---|---:|---:|---:|---:|---:|
| grid-3 (24 W) | 1.2 (1.3) | **18.5** (19.7) | 9.7 | 7.4 | 2.6 |
| grid-7 (112 W) | 2.9 (3.2) | **58.3** (60.6) | 43.5 | 36.4 | 6.7 |
| grid-14 (420 W) | 5.8 (6.2) | **198.6** (211.8) | 145.1 | 128.0 | 19.1 |
| grid-20 (840 W, stress) | 7.7 (8.3) | **339.5** (519.2) | 279.1 | 273.3 | 21.6 |

**Wall-mesh rebuild** ([`results/mesh-warm.json`](./probes/performance/results/mesh-warm.json)). `VisitorLayoutShell`
renders both the Stage canvas and the visitor Preview surface. Its `$effect` rebuilds **every**
physical Wall mesh, one `BufferGeometry` per Wall, whenever the compiled geometry changes
(observed). The probe times the Three-free CPU half, `buildStandaloneWallMesh` over all compiled Walls,
taking median of 25: **6.6 / 28.2 / 103.7 ms** for 24 / 112 / 420 Walls. That is 24 / 112 / 420 meshes
with 8.3 k / 35.5 k / 127.5 k triangles and ≈ 0.3 / 1.4 / 5.0 MiB of buffers. `BufferGeometry` creation,
GPU upload and draw are not included.

**History retention** ([`results/history-warm.json`](./probes/performance/results/history-warm.json)). This is the
coordinator only. 120 accepted Wall-height edits (history limit 100) retain **5.8 MiB at S and 16.1 MiB at M**
after a forced GC. The figure plateaus at the limit, so the bound holds. Accept time does not drift
(M: 40.4 → 40.9 ms median, first vs last 10 edits). An L figure was not run; it scales by
extrapolation to ≈ 60 MiB (inference).

**Findings (measured unless labelled).**

- **P-1 The measured Layout edit/drag paths cost about one full compile, and compile is whole-document.**
  Compile costs ≈ 0.28–0.35 ms per Wall in these fixtures on the M2 (31 → 138 → 295 ms
  for 112 → 420 → 840 Walls; the 840-Wall stress fixture has no Openings). At M/L the
  per-pointer-move preview solve costs ≈ 1.2–1.4× a compile, the measured commit planners
  ≈ 1.2–1.3× and F.4 accept ≈ 1.4×. These paths do not reuse a prior compiled result.
  By inference from the
  whole-document compile, a one-Wall change at L re-derives 420 Walls, 225 Junction resolutions and
  196 Room faces. Building the L fixture one
  Opening at a time took 65 s of planner time, demonstrating accumulated work across many edits;
  this is not a measured browser session.
- **P-2 An accepted edit compiles at least twice.** The planner compiles inside its validity gate,
  then the Stage host re-admits the accepted source through `admitSource`, which compiles again
  (`host-acceptance.ts`, "One admission path": observed). Undo/Redo restore in 1–23 ms in the
  coordinator, then go through the same `install` → `admitSource` path, so each costs another full
  admission. The **sum of separately measured medians** for accept + admission is 14 / 85 / 375 ms
  (S / M / L) on the M2; this is not an end-to-end latency sample or a measured percentile.
- **P-3 Drag warrants immediate C1 investigation.** At M the sampled planner takes 36 ms median
  before rendering, exceeding two 60 Hz frame intervals; at L its 187 ms median implies a solve
  throughput ceiling near 5 Hz before rendering. Those are Node costs, not observed browser frame
  rates. Scaling by the uncalibrated factor suggests 54–80 ms at M on reference A (**inference**).
  The proposed ≤ 8 ms evaluation budget at M therefore motivates profiling and a bounded E-1/E-2
  comparison inside C1. Which hot work to accelerate, avoid or move follows the browser profile;
  neither incremental compilation nor a worker is established as the only viable implementation.
- **P-4 Representation and codecs are smaller costs in these fixtures.** Plan evaluation is
  1.2 / 4.4 ms (M / L). Layout parse/validate, envelope serialization and SHA-256 content identity
  each take about 2.3 ms or less at L. This isolates compile as a larger cost for these Layout-only
  envelopes; it does not measure Save's wire transfer, server receipt or future resource-heavy
  projects. Content identity costs ≈ 1–2 % of compile here.
- **P-5 Compiled geometry is heavy.** Retained heap is ≈ 72–83 KiB per Wall (8 MiB at M, 32 MiB at L,
  68 MiB at XL). The separately measured admitted snapshot is ≈ 8.4 / 33.6 / 70.8 MiB including
  its compiled geometry, not another copy to add to the compile-only measurement. These retained
  sizes motivate bounded caches; actual structured-clone/transfer time remains to be measured
  at a worker boundary (E-2).
- **P-6 Cold first compile costs 1.2–2.5× a warm one.** The ratio is 2.5× at S, 1.6× at M and
  1.55× at L when the cold process's first and tenth compiles are compared. JIT warm-up matters
  most for small documents. The measurements concern compile time, not complete browser open.
- **P-7 Rendering adds about one more compile's worth per edit.** The full Wall-mesh rebuild after
  every accepted change costs ≈ 0.25 ms per Wall on the M2 (28 / 104 ms at M / L). It comes on top of
  the two compiles. One mesh per Wall also means 420+ draw-call groups at L before any Scene object.

## Reference baseline (proposal)

The single proposed baseline, calibration procedure and browser/network profiles now live in
[the owning performance reference](../../../docs/reference/components/performance.md#reference-baseline),
prepared directly for PR #173 owner review. No reference-A browser measurement is claimed here.

## Representative workloads (proposal)

The proposed S/M/L/XL workload table lives in
[the performance reference](../../../docs/reference/components/performance.md#representative-workloads).
The measured grid fixtures above remain evidence for their Layout portion, not complete browser workloads.

## Complete user flows to measure (proposal; Not run)

Flow IDs F1–F13 and their matching-input/presented-result metric definitions live in
[the performance reference](../../../docs/reference/components/performance.md#complete-user-flows-to-measure).
Event Timing excludes pointermove; worker completion is measured through its matching final
presented result. All browser/GPU flows remain unrun in this research round.

## Budgets (proposal)

[The owning budget table](../../../docs/reference/components/performance.md#budgets) is prepared
for owner review; it is the one source for proposed hard/target values. The measured M/L envelopes
are 123,741 / 500,917 bytes. At N1's 5 Mbit/s upload they need at least 198 / 801 ms just to upload,
before escaping, RTT and server work. Save's 100 ms hard proposal concerns local visible feedback;
durable receipt has a separate payload/network-aware target pending service baseline acceptance.
Node costs and uncalibrated hardware scaling do not establish reference-laptop browser failures.

## Gates before implementation acceptance (proposal)

**Where they bind (after owner acceptance of this proposal).** A slice's declared verification tier
already lives in its plan and `apps/editor/tests/README.md`. **Every consuming slice must record
its performance evidence before acceptance/closeout**, even when it is not its phase's final slice:
reference-A run, developer pre-flight where applicable, workload ids, browser, SHA and
pass/target/disposition for each touched budget. A hard miss blocks that slice's acceptance and
is resolved there. A phase final gate separately rechecks integrated behavior required by its
plan; it does not defer earlier slice evidence or authorize phase closure.

The harness and permanent bundle-report workflow still need explicit owner authorization under
the current test contract. If budget/slice obligations are accepted before that tooling is
authorized, equivalent manual DevTools measurements and the disposable bundle report may supply
the row, with their coverage and repeatability limits stated. Missing presentation/completion
evidence is not a pass. Until owner acceptance, these remain proposed obligations, not a change
to the test contract or a production authorization.

| Slice | Evidence required before its acceptance |
|---|---|
| **C1** native Walls (T1) | Delivery: Stage ≤ 400 KiB br, visitor set unchanged or justified; F2 (S/M), **F3 matching-preview/final-result latency (S/M/L hard)** plus its main-thread budgets, F4 commit, F8 Undo/Redo, F7 orbit at S/M; heap after 100 edits; F13 Stage cycle. Node costs and observed duplication trigger dedupe/profiling now; reference-A pass/fail remains to be measured and any confirmed hard miss is resolved inside C1. |
| **C2** own GLB import (T2) | F5 long-task and time-to-placed, F6 placement + picking, F7 with the imported models in M, GPU-memory estimate per admitted model in the ingest report, F9 Save with resources; delivery: decoders (meshopt/Draco/KTX2) **lazy and only when the asset needs them**; viewer: Preview/visitor see the same derivative, bytes reported. |
| **T3.P02.S01** capture + Preview (T3) | Preview chunk lazy and passing the preview-surface boundary; F10 capture/bind final-result completion with discrete responsiveness reported separately; Preview entry/return completion; F13 Preview enter/exit ×20 leak-free; Experience lowering/interpreter time at the 50-View/30-Stop dense fixture ≤ 16 ms (target). |
| **C3** rename/delete | Hub delivery delta ≤ 5 KiB br; no new main-thread work on Stage open. |
| CD-4 structures/datums/overheads | Compile/representation per-edit budget at M/L with datums and 4/10 overheads; Plan/Section evaluation ≤ 16 ms at M; any kernel (Clipper2 spike) priced in bytes and placement (worker/WASM/compile-at-publish) before planning. |
| CD-5/CD-6 parts + annotations | Node-preserving derivative bytes vs flattened; part picking ≤ 4 ms at M (E-5 trigger); annotation overlays within F7/F12 frame budgets; Presentation in viewer within F12. |
| T4 prepared reader | Visitor first-load JS ≤ 250 KiB br becomes **Hard**; F11/F12/F13 viewer gates; decide E-4 with measurements. |

**Resolving a demonstrated material problem inside the consuming slice.** A budget miss on a hard
line is a slice defect, not a follow-up. The ladder, cheapest and least architectural first:
1. **Profile first** — a Chrome trace (Performance panel / CDP `Tracing`) on reference A or the
   calibrated pre-flight, naming the hot functions and the share of the miss each explains. No
   optimization lands without a before/after on the same workload, build and machine.
2. **Remove duplicated work** — e.g. reuse the planner's compiled candidate for the post-install
   admission instead of compiling twice; reuse the admitted snapshot on Undo/Redo by content id.
3. **Incremental computation** inside the one canonical compiler — invalidate by changed Junctions/
   Walls/Openings and recompute only affected Junction resolutions, Wall bodies and Room faces;
   proved equal to a full compile by a deterministic differential (a `test:heavy` correctness
   oracle, not a timing test).
4. **Caching** keyed by content revision (compiled geometry, plan evaluation, meshes per Wall),
   bounded (LRU) with a measured memory cost.
5. **Workers** for whole pure stages (compile, admission, GLB parse/validate/derivative) with
   latest-wins coalescing, transferable buffers and no second authority. Moving a stage does not
   satisfy a gate by itself: include queue/transfer/render time, matching-result completion,
   latest-preview age and applicable evaluation/main-thread budgets. A responsive spinner or
   zero long tasks cannot compensate for a late final result.
6. **Compiled derivatives** (prepared release payloads, cached procedural derivatives) where the
   architecture already permits them.
7. **Delivery splitting** — lazy chunks, removing side-effect residue, deferring decoders.
Escalation past step 4, or any change that alters a contract (F.4 preview semantics, what a
release package contains), goes back through the owner as an ordinary plan amendment.

**Viewer-delivery gate (Hard, every slice touching visitor-reachable code).** (a) The existing
public- and preview-surface build gates pass — *with the forbidden set repointed to the current
editor tree* (R-1); (b) the bundle report (`bundle-analysis.mjs` or its owned successor) lists the
`/p` load-set modules under `lib/authoring/**`, editor routes, `layout-wall-topology-ops`/noding/
reconciliation, `layout-plan-representation`, `robust-predicates`, decoders and any new solver; the
editor-machinery entries must be absent; runtime-safe evaluator/solver/decoder entries each need
a *visitor execution* justification in the slice's acceptance record; (c)
first-load and per-chunk br bytes are compared with the previous accepted record.

## Retain / adopt / bounded experiment (proposal)

### Retain

- **R-1** The build-time public/preview surface gates, `f4-public-isolation`,
  `program-entry-closure` and the shared closure resolver — the correct structural mechanism.
  **Retain** `f4-public-isolation`'s existing whole-authoring public source-closure assertion.
  **Repoint** the public/preview build forbidden set and visitor token checks from deleted
  `src/lib/editor/` to current editor machinery in `src/lib/authoring/`, and cover `routes/project/`
  and `routes/projects/`. Preview needs its own all-authoring guarantee; current public-root
  coverage is not an independent Preview proof. State page/root graph and emitted-load-set
  coverage separately, including ancestor modules and shared-chunk membership in the bundle report.
- **R-2** One canonical compiler shared by Stage and visitor (rule 4/6); runtime-safe evaluators stay
  shared. Optimizations go *inside* it.
- **R-3** Hashed immutable assets, catalogue meshopt + webp + quantization derivatives, and the
  delivery-derivative exception as the route to compiled release payloads.
- **R-4** `test:heavy`'s deterministic operation-count/differential oracles; incremental-compile
  correctness is proved there, never by timing.
- **R-5** On-demand benchmarking as the default posture (tests README) — the harness below runs when a
  consuming slice's acceptance, a phase integration recheck or an investigation needs it.

### Adopt (needs owner authorization where marked)

- **A-1 (owner authorization: harness + devDependency).** A reproducible browser harness:
  **Playwright** (`@playwright/test`, Apache-2.0) driving pinned Chromium/Chrome (+ WebKit/Firefox for
  secondary) with **CDP** for `Emulation.setCPUThrottlingRate`, `Network.emulateNetworkConditions`,
  `Tracing` (devtools.timeline, blink.user_timing, v8, gpu categories), `Performance.getMetrics`,
  `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage`; in-page `PerformanceObserver` for
  eligible discrete `event` entries, `long-animation-frame` and `largest-contentful-paint`;
  sequenced input/result/render marks correlated with presented frames for continuous drag and
  asynchronous completion; `renderer.info` for draw calls/memory. Lives outside the default lanes
  (its own config and script, e.g. `perf:browser`), runs on demand and before consuming-slice
  acceptance, with phase integration rechecks separately. Writes JSON beside that acceptance
  record. **Not** a CI gate or scheduled job unless the owner separately authorizes that too. Workload fixtures are
  generated through public planners (as here) and real pavilion fixtures, versioned with the harness.
- **A-2 (owner authorization: script only, no dependency).** Bundle analysis before affected-slice
  acceptance and at a phase integration recheck:
  promote `bundle-analysis.mjs` (Node built-ins + already-present `@jridgewell/sourcemap-codec`) or an
  equivalent, with a `--sourcemap` build in a temp outDir; outputs route load sets, br bytes and the
  viewer-delivery module list. Optional visual aid: `rollup-plugin-visualizer` (MIT) — not needed.
- **A-3 (slice-local, once that scope is explicitly released from the hold).** Fix the measured delivery residue in the
  first slice that touches the files: lazy-load `GLTFLoader`/`useMeshopt` with the first model
  (D-2), import `@threlte/extras` members from their subpaths or replace them to drop the gizmo/
  sprite/BVH residue (D-1), cut the landing/hub → `camera-core` → Three edge (e.g. a Three-free
  persistence reader or a dynamic import), make Preview a lazy route-local chunk (T3.P02.S01), and
  retire `p2311-perf` from the public barrel (D-3).
- **A-4 (C1-local).** Remove the double compile per accepted edit and the recompile on Undo/Redo
  (reuse candidate/admitted geometry by content id while preserving all admission checks). The
  post-install admission median is ≈ 49 % of the summed accept + admission medians at M
  (41.65 of 84.82 ms). This identifies a substantial deduplication opportunity; actual savings,
  bounded retention and invalidation require a same-workload before/after, not subtraction of
  unrelated percentile samples.

### Bounded experiments, each with a trigger

| Id | Experiment | Trigger / evidence (browser thresholds use A or calibrated pre-flight) | Exit criterion / falsifier |
|---|---|---|---|
| **E-1** | **Incremental canonical compile** (Junction/Wall/Opening/Room-face invalidation inside layout-core; per-Wall mesh reuse) | **C1 investigation already triggered** by 36 / 187 ms M/L Node preview medians and the full-compile path; profile on A or calibrated browser pre-flight before choosing the implementation | Equal-output differential over the heavy lane's tables + grids; proposed evaluation ≤ 8 ms at M on A and all applicable F3 completion/main-thread budgets; if locality is unbounded, compare E-2 without waiving those gates |
| **E-2** | **Worker-hosted planner/compile with latest-wins coalescing** | Calibrated browser profiling shows F3 main-thread or F2 open hard misses that A-4/local optimizations do not resolve | Meet matching-preview/final-result completion and latest-input-age budgets, applicable evaluation budgets and main-thread/frame limits on A. Include queueing, solve, cloning/transfer, installation and presentation. Zero long tasks alone is insufficient; moving an unchanged 187 ms solve cannot meet L's 100 ms completion budget. Measure retained/transferable payload and cache cost rather than infer transfer time from heap size |
| **E-3** | **Drag preview semantics** — keep "preview = planner output" but evaluate only the affected component/region during the drag, validating the whole document at commit | E-1 misses at L | Owner/contract call (F.4 preview semantics); must never show a candidate the commit could refuse without labelling it |
| **E-4** | **Compiled delivery derivative for the visitor** (prepared Layout geometry/meshes in the T4 package; drop compiler + scene codec from `/p`) | T4 planning, or F11 first frame misses with compile > 20 % of it | Payload bytes vs saved code bytes (≈ 30–47 KiB br: layout-core 21.8, mesh builder 7.1, scene-codec share of project-model's 18.4) and compile time (138 ms M2 at L); decide against the complete F11/F12 budgets and accepted package contract, not byte savings alone |
| **E-5** | **BVH picking** (`three-mesh-bvh`, MIT — already in `node_modules` transitively) | picking > 4 ms at M, or any 100 k-tri model in the placement path, or part picking (CD-5) | Picking ≤ 1 ms p95 at L; BVH build off main thread or cached per resource revision |
| **E-6** | **Batching / instancing** (merge static Wall meshes per material; `InstancedMesh`/`BatchedMesh` for repeated objects) | draw calls > 1,000 at M or F7 frame p95 > 16.7 ms at M on Iris Xe | p95 within budget; per-Wall identity preserved through `wallRanges`/`pickRanges` (already emitted by the mesh builder) |
| **E-7** | **KTX2/Basis textures** for the C2 derivative and catalogue (gltf-transform `toktx`/`etc1s`/`uastc`; KTX-Software and basis_universal are Apache-2.0) | GPU-memory estimate > budget at M, or texture upload long task > 50 ms, or creator maps > 2K | GPU memory −60 % or better at equal visual review; transcoder (≈ 0.5 MiB wasm) loaded only when a KTX2 asset exists |
| **E-8** | **LOD/culling/streaming** for L/XL viewer packages | F11 L first frame > 4 s or F12 L p95 > 33 ms | Within L targets; no change to authored truth |
| **E-9** | **WASM kernel** (CD-8 Clipper2 spike; any Rust/WASM) | Only an isolated CPU bottleneck after E-1/E-2 (North Star) | Boundary-inclusive proof: bytes + instantiate + marshal ≤ the JS cost it replaces |

## Proposed amendment locations (gists only; not edited)

- **`apps/editor/tests/README.md` §Correctness tests vs performance benchmarks.** Keep "on demand" and
  "no CI gate"; add, only after owner acceptance: each consuming slice records a performance
  evidence row before acceptance/closeout, from the authorized harness (A-1) and bundle report
  (A-2), with phase final integration rechecks separately. Name profiles, workloads, statistics
  (p75/p95/p99, ≥ 10 runs), continuous/discrete/completion metric definitions and record location;
  state that timing never substitutes for correctness or correctness for timing. Budget obligations
  and permanent tooling require explicit authorization; an ordinary test change authorizes neither.
- **`docs/reference/north-star.md` §Technology gates.** Add the reference baseline (laptop A/B,
  Chrome primary, N1/N2) and the budget table as the definition of "measured requirement"; make the
  resolution ladder explicit (profile → dedupe → incremental → cache → worker → derivative → split);
  keep WebGPU/WASM/kernel gates as they are.
- **`docs/reference/architecture.md` §Product routes / §Release packages / §Delivery-derivative
  exception.** Add a "Delivery budget and visitor closure" paragraph: visitor first-load JS budget,
  lazy model decoders, Preview as a lazy isolated chunk, the viewer-delivery gate's module list
  (editor machinery never; solvers only when visitor execution requires them), and that a prepared
  package may move compile out of the visitor (E-4) without changing ownership.
- **AGENTS.md rule 5** needs no wording change; it already assigns ownership to `visitor/*` and
  `public-surface-boundary`. The R-1 repoint is a code change in the first visitor-touching slice.
  It covers the forbidden set in `lib/visitor/preview-surface-boundary.ts` and the `$lib/editor`
  tokens in `visitor-public-route.test.ts` / `visitor-identity-isolation.test.ts`. Record it as a
  landed-gap correction beside the convergence proposal's §Landed gaps found by the research.
- **`docs/roadmap/product-convergence-2026-10-21.md` §C1/§C2/§Existing capture and Preview scope.**
  Add each slice's pre-acceptance performance row (table above); C1 owns A-4 and immediate browser
  profiling of the measured compile-heavy paths. E-1/E-2 are bounded candidates, with the actual
  mechanism chosen from evidence and required to meet completion and main-thread budgets. Node
  costs motivate that work; reference-A pass/fail is not yet measured.
- **`docs/roadmap/product-convergence-2026-10-21-amendments.md`.** One entry per contract amendment
  above, so step 4/5 review sees them with the others.

## Uncertainties

- **U-1** Node on an M2 is not Chrome on reference A: JIT tiers, GC and the Svelte/Three runtime
  differ; the 1.5–2.2× factor is uncalibrated. The *ratios* (S→M→L scaling, double compile, planner
  ≈ compile) are the robust findings.
- **U-2** The grid fixtures are one connected component of axis-aligned 6 m cells; real pavilions
  have curves, irregular angles and several components. Compile cost per Wall may differ; component
  scoping (D-9) would make E-1 cheaper for multi-structure projects than for a single grid.
- **U-3** Render-side costs (BufferGeometry creation, GPU upload, draw, Svelte reactivity on
  `adaptedWalls`) were not measured; the mesh probe covers only the three-free CPU build.
- **U-4** The visitor cold path could not be exercised end to end (public reads 404 until T4); F11's
  shape depends on T4's prepared reader.
- **U-5** Event Timing/INP constraints were rechecked against the linked sources. Other external
  thresholds remain stated from knowledge and need checking before contract promotion.
- **U-6** The emitter of the unreferenced Draco/Basis assets was not identified; harmless to clients.
- **U-7** History retention was measured on the coordinator only; the Stage host may retain
  additional per-install snapshots.
- **U-8** Whether drag preview may evaluate less than a full candidate (E-3) is an F.4/T1 contract
  question for the owner, not a performance decision.
- **U-9** Each checked-in result file holds one run, not a cross-run sample distribution. The warm
  table now cites the retained lead verification rerun; earlier run values are not its samples.
  Counts are n = 6–60; p95 for n < 20 is the maximum under the probe's nearest-rank estimator and
  cannot establish a stable population tail. Separate component medians are not end-to-end
  percentiles. The mains-powered machine was idle but not isolated. An earlier warm run stopped
  at the stress row on an operation-id probe bug, fixed before the retained complete runs.
- **U-10** Creator GLBs (C2) may be uncompressed, with 4K PNG/JPEG maps. The catalogue's
  meshopt + webp + quantization profile is therefore not a guide to C2 import or GPU cost. Workload
  M's creator-model line is an assumption to replace with real samples.

## Handoff to the convergence lead

- **Measured:** visitor `/p` loads 300.6 KiB br JS, the Stage 375.6, and landing/hub/redirect
  211–215 each. Of that, ≈ 152 KiB br is Three, present on every route. No `lib/authoring/**` reaches the visitor; the
  Layout compiler and scene codec do, as current cold-path requirements. Gizmo/sprite/BVH residue,
  static GLTF/meshopt and a P23.11 seam do, without need. Existing public source-closure coverage
  already excludes all authoring; stale build/token patterns and independent Preview coverage
  still need correction (G-1).
- **Measured Node costs / observed path:** full canonical compile 4.6 / 31 / 138 ms
  (24 / 112 / 420 Walls) on an M2; the Stage calls a full planner per valid Wall-drag move, sampled
  here at 5.6 / 36 / 187 ms. An accepted edit compiles twice and Undo/Redo re-admits. Summed
  component medians including Wall-mesh CPU are ≈ 21 / 113 / 479 ms for commit; these are not
  measured browser completion samples. Reference-A M/L misses remain an **inference**.
  **C1 carries A-4 and immediate performance profiling/investigation**, with E-1/E-2 available as
  bounded candidates. Any confirmed hard miss is resolved inside C1; a chosen worker or
  incremental path must meet matching-result completion and main-thread budgets, not merely
  improve INP or remove long tasks.
- **Proposal:** reference laptop A (i5-1135G7/Iris Xe, 8 GB, 1080p60, Chrome) + B (M1 8 GB);
  S/M/L/XL workloads; 13 flows with continuous/discrete/completion metrics; the budget table;
  evidence before each consuming slice's acceptance and separate phase integration rechecks; the
  viewer-delivery gate; explicit owner authorization for a Playwright + CDP harness and permanent
  bundle-report workflow. Save's ≤ 100 ms is local feedback; its receipt target accounts for
  payload/upload, RTT and server time.
