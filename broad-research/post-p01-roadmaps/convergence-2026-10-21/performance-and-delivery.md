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
thresholds or tool facts from primary documentation, stated from knowledge and *not re-fetched for
this packet* (no web access was used); each must be rechecked before it is written into a
contract. **Inference** — a conclusion drawn from the above. **Proposal** — unratified
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
| `vite/public-surface-boundary-plugin.ts` (build hook; build fails) + `tests/vite/public-surface-boundary-plugin.test.ts` | The resolved Rollup graph from `routes/p/[publicationId]/+page.svelte` (static + literal dynamic imports, ancestors, shared chunks) contains no module matching the forbidden set, no unresolved computed `import(expr)`, and the root exists | Byte budgets; anything not in the pattern list |
| `vite/preview-surface-boundary-plugin.ts` + `lib/visitor/preview-surface-boundary.ts` (+ two tests) | Same walk from `lib/visitor/VisitorPreviewSurface.svelte`; forbidden set = `src/lib/editor/`, Museum*/Chopin/Paris legacy, `Workspace3DView`, `EditorSceneEntities`, `project/project-codec`, `project-export-store`, `binary-texture-store` | — |
| `lib/authoring/f4-public-isolation.test.ts` (arch) | Source import closure of the public route (shared resolver `tests/helpers/import-closure.ts`) excludes `lib/authoring/f4/*` (coordinator + history), with positive controls | Other `lib/authoring/**` |
| `lib/visitor/visitor-public-route.test.ts`, `visitor-identity-isolation.test.ts` | Named visitor sources carry no `$lib/editor/`, codec/store/Chopin tokens; `lib/visitor` + `lib/museum` import nothing from `apps/editor` or `$lib/editor` | — |
| `lib/project-model/program-entry-closure.test.ts` (arch) | `project-model/program` (ExecutionProgram@1) closes over an exact module set: no source codec, compiler, root barrel, Camera evaluator or Three — the delivery-only entry a prepared reader needs | That the visitor *uses* that entry |

**Measured gap G-1.** The editor-machinery patterns in all three mechanisms name
**`src/lib/editor/`** / **`$lib/editor`**, a tree #115 deleted (`apps/editor/src/lib/editor` does not
exist). Current editor machinery lives in `src/lib/authoring/**` (Stage, adapters, Save,
F.4) and `src/lib/authoring/stage/shell/**`; only `lib/authoring/f4` is protected. Today's visitor
closure is clean (measured above), but a new `lib/authoring/**` import into a visitor module would
pass every gate. **G-2** no gate observes bytes, the landing/hub routes, lazy loading, or runtime
cost. These gates remain the right *structural* mechanism and should be retained and repointed
(proposal R-1), not replaced.

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

**Warm, in-process** ([`results/compile-warm.json`](./probes/performance/results/compile-warm.json)) — median / p95 ms.

| Step (what runs) | starter (4 W) | grid-3 (24 W · 24 O · 9 R) | grid-7 (112 · 112 · 49) | grid-14 (420 · 420 · 196) | grid-20 stress (840 · 0 · 400) |
|---|---:|---:|---:|---:|---:|
| Canonical compile `compileWallFirstLayoutGeometry` | 0.8 / 2.6 | 4.7 / 5.9 | **30.4 / 37.7** | **140.6 / 213.5** | 292.6 / 376.5 |
| Plan evaluation `evaluateLayoutPlan` | 0.06 / 0.24 | 0.37 / 1.2 | 1.4 / 2.6 | 5.1 / 12.6 | 12.1 / 19.8 |
| Layout parse + validate / serialize (medians) | 0.02 / 0.03 | 0.15 / 0.09 | 0.59 / 0.41 | 2.2 / 1.5 | 4.4 / 2.9 |
| Envelope serialize / content id, SHA-256 (medians) | 0.05 / 0.06 | 0.12 / 0.16 | 0.55 / 0.53 | 2.0 / 1.8 | 3.9 / 3.3 |
| **Project open** — Stage `admitSourceJson` (parse, validate, compile, runtime, identity) | 1.6 / 3.7 | 7.0 / 8.3 | **42.6 / 56.0** | **169.9 / 190.1** | 406 / 492 |
| **Wall drag, per pointer move** — `planWallManipulation` (rigid move; 60/60 planned) | 0.8 / 3.1 | 5.7 / 12.8 | **35.9 / 42.7** | **183.9 / 227.0** | 476 / 724 |
| Wall-chain commit planner — independent new Wall | 4.7 / 13.0 | 5.6 / 7.3 | 38.3 / 50.7 | 180.7 / 213.5 | 384 / 424 |
| Wall-chain commit planner — declared T that splits a Room | — | 6.9 / 9.7 | 39.5 / 45.2 | 189.7 / 207.1 | 428 / 703 |
| Opening create planner (last 30 of the fixture build) | — | 4.9 / 6.4 | 30.5 / 39.4 | 144.0 / 178.8 | — |
| **F.4 accept** (Wall height; real coordinator + Layout planners) | 2.0 / 20.3 | 6.7 / 8.0 | **43.0 / 136.1** | **190.6 / 242.6** | 437 / 456 |
| **Stage post-install admission** (host re-admits every accepted source) | 1.5 / 2.4 | 7.4 / 8.8 | **40.6 / 77.8** | **176.2 / 243.7** | 413 / 518 |
| Undo / Redo medians (coordinator only; the host then re-admits) | 0.4 / 0.6 | 1.1 / 1.0 | 4.6 / 4.0 | 22.7 / 13.7 | 20.3 / 20.0 |
| Retained heap: compiled geometry / admitted snapshot (MiB) | 0.26 / 0.30 | 1.7 / 1.8 | 8.0 / 8.4 | 32.6 / 33.6 | 69.1 / 70.7 |
| Layout JSON / envelope JSON (KB) | 2.3 / 4.9 | 19.2 / 26.2 | 97.8 / 123.7 | 408.3 / 500.9 | 680.1 / 813.7 |
| Fixture build through planners (one edit at a time) | 12 ms | 0.16 s | 3.7 s | 68.8 s | 10.0 s (no Openings) |

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

- **P-1 Every edit and every drag move costs about one full compile, and compile is whole-document.**
  Compile grows roughly linearly at ≈ 0.27–0.35 ms per Wall-with-Opening on the M2 (30 → 141 → 293 ms
  for 112 → 420 → 840 Walls). Relative to one compile, the per-pointer-move preview solve costs ≈ 1.2–1.3×, each commit-path
  planner ≈ 1.3× and the F.4 accept ≈ 1.4×. Nothing is incremental. By inference from the
  whole-document compile, a one-Wall change at L re-derives 420 Walls, 225 Junction resolutions and
  196 Room faces. Building the L fixture one
  Opening at a time took 69 s of planner time, which is what a long editing session pays.
- **P-2 An accepted edit compiles at least twice.** The planner compiles inside its validity gate,
  then the Stage host re-admits the accepted source through `admitSource`, which compiles again
  (`host-acceptance.ts`, "One admission path": observed). Undo/Redo restore in 1–23 ms in the
  coordinator, then go through the same `install` → `admitSource` path, so each costs another full
  admission. Measured commit before rendering: 14 / 84 / 367 ms (S / M / L) on the M2.
- **P-3 Drag is the binding constraint.** At M a pointer move needs 36 ms median of planner work
  before any rendering. That is already two 60 Hz frames on the M2, and an inferred 55–80 ms on
  reference A. At L the preview runs at about 5 Hz on the M2. The budget's ≤ 8 ms per-move evaluation
  at M needs about 5× (M2) to 10× (A) less work per move. Faster code cannot close that gap; work
  has to be avoided (E-1).
- **P-4 Representation and codecs are cheap.** Plan evaluation is 1.4 / 5.1 ms (M / L). Layout parse +
  validate, envelope serialization and the SHA-256 content id are each ≤ 2.2 ms at L. Save-side CPU
  is not a concern at any workload. The content id is computed on every accept and admission, but
  costs ≈ 1 % of compile.
- **P-5 Compiled geometry is heavy.** Retained heap is ≈ 73–84 KiB per Wall (8 MiB at M, 33 MiB at L,
  69 MiB at XL), and the admitted snapshot holds about the same again. This sets the price of
  caching several revisions, and the structured-clone cost of moving compiled output across a
  worker boundary (E-2).
- **P-6 Cold first compile costs 1.2–2.5× a warm one.** The ratio is 2.5× at S, 1.6× at M and
  1.55× at L. JIT warm-up matters most for small documents. At M/L, first-open time is set by
  document size more than by code warm-up.
- **P-7 Rendering adds about one more compile's worth per edit.** The full Wall-mesh rebuild after
  every accepted change costs ≈ 0.25 ms per Wall on the M2 (28 / 104 ms at M / L). It comes on top of
  the two compiles. One mesh per Wall also means 420+ draw-call groups at L before any Scene object.

## Reference baseline (proposal)

**Reference laptop A — "regular x86 laptop" (primary for budgets).** 4-core / 8-thread mid-range
x86 at 15–28 W (Intel Core i5-1135G7 or i5-1235U class), integrated **Intel Iris Xe** (80/96 EU),
**8 GB** dual-channel RAM (16 GB variant also recorded), 1920×1080 internal panel at 60 Hz,
**DPR 1.0**, Windows 11, balanced power plan, **on battery and on mains** (budgets are judged on
battery, the worse case). **Reference laptop B — Apple M1 MacBook Air, 8 GB**, 2560×1600 at DPR 2
(the renderer's DPR cap applies), macOS current, Safari and Chrome. **External (not re-fetched),
approximate:** single-thread throughput of an i5-1135G7 on battery is roughly 0.45–0.65× an M2 and
an M1 roughly 0.85–0.9× an M2, so the Node numbers above should be expected **≈ 1.5–2.2× slower on A**
and ≈ 1.1–1.2× on B. That factor is an inference to be replaced by calibration (below), never
written into a budget.

**Browser matrix.** Chrome stable (pinned major, recorded `chrome://version`) is **primary and
gating** on A and B. Safari (current, on B) and Firefox stable (on A) are **secondary**: they run
the same flows and must meet the *hard* gates for correctness-visible behavior (no context loss,
no unbounded long task, no leak) but report frame/latency numbers as targets. Edge inherits Chrome.

**Network profiles for the viewer cold load** (CDP `Network.emulateNetworkConditions`, applied
per request, cache disabled for cold):
- **N0 local** — unthrottled loopback (developer iteration only; never a gate).
- **N1 broadband** — 20 Mbit/s down, 5 Mbit/s up, 40 ms RTT. Gating profile for viewer and editor.
- **N2 constrained** — 1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT (External: Lighthouse's mobile
  "slow 4G" simulation values). Reported for the viewer only; a target, not a gate.

**Reproducing on a developer machine (proposal; Not run).**
1. **Pinned browser:** Playwright-managed Chromium *and* branded Chrome stable (`channel: 'chrome'`),
   versions recorded with every result; Playwright's own browser cache, never the user's profile;
   a fresh persistent context per run; extensions off; `--disable-background-timer-throttling`
   off (default) so results match users.
2. **CPU calibration against the reference:** run a fixed calibration page (the `fixtures.ts`
   grid-7 compile + the Stage's admission, bundled exactly as production) 20× on reference A in
   Chrome, record the median; on the developer machine pick the CDP
   `Emulation.setCPUThrottlingRate` (1.5–4, step 0.25) whose median lands within ±10 % of A's.
   Recalibrate per browser major and per machine; store the rate with results. CPU throttling does
   not emulate GPU, memory bandwidth, or thermal behavior: **GPU, frame-time and GPU-memory gates
   are only accepted from reference hardware runs**; throttled developer runs are pre-flight.
3. **Fixed viewport/DPR:** 1920×1080 CSS at DPR 1 for A-equivalence; 1440×900 at DPR 2 for
   B-equivalence; window not occluded (a background tab throttles rAF).
4. **Cache states:** *cold* = new context + `Network.clearBrowserCache` + `clearBrowserCookies` +
   service workers none; *warm* = same context, second navigation (HTTP cache + V8 code cache
   populated); *repeat-use* = 10 open/close cycles in one context.
5. **Runs and statistics:** 1 discarded warm-up + **≥ 10 measured runs** per flow × workload ×
   cache state for timing milestones; for frame-time and input-latency flows, **≥ 3 runs of ≥ 600
   frames / ≥ 60 inputs** each. Report median, p75 (Web-Vitals convention), p95, p99 and max per
   metric, plus the run-to-run spread; a gate compares **p95 (or p75 for Web-Vitals-style
   milestones) of the pooled samples**. Record git SHA, build hash, workload id, browser, CPU
   rate, power state, display Hz.

## Representative workloads (proposal)

Derived from the museum/pavilion use case and the first-wave slices. The measured grid fixtures
stand in for the Layout part until real pavilion fixtures exist; counts are per project.

| | **S — starter room** | **M — pavilion gallery (expected typical)** | **L — museum wing (expected maximum)** | **XL — stress (above max)** |
|---|---|---|---|---|
| Walls / Openings / Rooms | 4–24 / 4–24 / 1–9 (starter, grid-3) | ≈ 112 / 112 / 49 (grid-7) | ≈ 420 / 420 / 196 (grid-14) | ≈ 840 / 0–840 / 400 (grid-20) |
| Structures / datums / overheads (after CD-4) | 1 / 1 / 0–1 | 2 / 3 / 4 (roof, suspended ceiling, mezzanine slab, void) | 4 / 6 / 10 | 8 / 12 / 30 |
| Scene objects / distinct GLBs | 5 / 3 | 60 / 15 | 200 / 40 | 500 / 80 |
| Model bytes / triangles | ≈ 1 MiB / 30 k | ≈ 8 MiB catalogue-class (meshopt+webp, 200–550 KiB each) + 2 creator GLBs ≈ 15 MiB uncompressed with 2K maps / ≈ 600 k | ≈ 40 MiB / 1.5 M | ≈ 100 MiB / 3 M (incl. chandelier-class 100 k-tri models) |
| Texture bytes on disk / est. GPU | ≤ 4 MiB / ≤ 64 MiB | ≤ 48 MiB / ≤ 256 MiB | ≤ 128 MiB / ≤ 512 MiB | ≤ 300 MiB / > 1 GiB (expected to degrade) |
| Views / Presentations / Stops | 3 / 1 / 0–3 | 20 / 8 / 15 (S01 dense fixture) | 50 / 20 / 30 (S01 dense fixture) | 100 / 60 / 60 |
| Part annotations (CD-5/6) | 0 | 30 | 150 | 500 |
| Experiences | 1 | 1–2 | 2 | 4 |

Every flow runs **cold** and **repeated** (warm and repeat-use). S and M gate; L gates the hard
budgets marked "L" below; XL is report-only and must merely degrade gracefully (no crash, no context
loss, no single main-thread block > 1 s, an honest progress/refusal state).

## Complete user flows to measure (proposal; Not run)

Each flow is a named sequence of `performance.mark`s from the product (the P23.11 helper's
successor, enabled only by a harness flag, never shipped as a dependency) plus CDP-derived input,
frame and memory data. "First interactive frame" = first rAF after which a pointer event is handled
within 50 ms.

| # | Flow | Start → end marks | Metrics |
|---|---|---|---|
| F1 | Editor startup | navigation start (`/projects` or `/editor`) → hub interactive → Stage route first interactive frame on the starter | FCP, LCP, TBT/long tasks, JS bytes/requests per route cold+warm, first interactive frame |
| F2 | Project open | Open (hub card or Open JSON) → source admitted → first architectural frame → first interactive frame | admission (parse/validate/compile/runtime), mesh build, first render, JS heap after GC |
| F3 | Native Wall drawing (C1) | pointerdown → each pointermove → pointerup → accepted → painted | per-move input-to-next-paint, preview solve time, frame time p95/p99, long tasks, commit INP, dropped frames |
| F4 | Wall/Opening edit (C1, precision) | typed value commit → accepted → painted | INP, accept + install + mesh rebuild split |
| F5 | Object import/admission (C2) | file chosen → staged/validated → derivative ready → approved → placed → painted | main-thread long tasks during parse/decode/upload, worker time, peak JS heap, GPU memory delta, time to placed |
| F6 | Object placement (C2) | drag of a placed object, duplicate, delete | per-move latency, picking time, frame time p95/p99 |
| F7 | Orbit/navigation (Stage) | 10 s scripted orbit + dolly + pan at S/M/L | frame time p50/p95/p99, draw calls, triangles, GPU time (EXT_disjoint_timer_query where available) |
| F8 | Undo/Redo | 20 alternating Undo/Redo after F3/F4 | INP per command, recompile/admission time |
| F9 | Save | Save click → receipt → idle | main-thread blocking, serialize + hash time, request bytes |
| F10 | Capture + Preview (T3.P02.S01) | capture View → bind Presentation (accepted) → enter Preview → first preview frame → play Cut Guide → return | INP of capture/bind, Preview chunk bytes (first and repeat entry), entry/return latency, frame time in Preview, history/selection intact |
| F11 | Viewer cold load | navigation start `/p/:id` → release fetched → first architectural frame (LCP-like) → first navigable frame → models streamed | TTFB, LCP, first-navigable, TBT, bytes by kind (JS/CSS/payload/models/textures) per network profile, compile/prepare time |
| F12 | Viewer navigation + Presentation | scripted guided travel, free look, Presentation enter/advance/exit, reduced-motion variant | frame time p95/p99, input latency, transition dropped frames |
| F13 | Repeated open/close (leaks) | Stage: open → edit ×20 → close to hub, ×10; viewer: enter/exit Presentation ×20; Preview enter/exit ×20 | JS heap after forced GC per cycle, `renderer.info.memory` geometries/textures, live WebGL contexts, detached DOM nodes |

## Budgets (proposal)

**Hard** = must pass in the consuming slice's final gate on reference A (Chrome), else the slice
resolves it (see [gates](#gates-before-implementation-acceptance-proposal)). **Target** = reported, and a miss
needs a written disposition in the acceptance record. Latency budgets are input-to-next-paint
(Event Timing `duration`, i.e. INP's measure); frame budgets are rAF-to-rAF on a 60 Hz display.

**Rationale (External, not re-fetched):** 100 ms is the classic "instant response" limit
(Card/Moran/Newell; Nielsen; RAIL "respond within 100 ms") and INP's "good" bound is 200 ms at
p75 (poor > 500 ms); a 60 Hz frame is 16.7 ms and RAIL asks ≤ 10 ms of script per frame during
animation; a long task is > 50 ms (Long Tasks / Long Animation Frames APIs); LCP "good" is ≤ 2.5 s
at p75; direct-manipulation lag becomes noticeable well below 100 ms (tens of ms for dragged
objects), so drag budgets sit at 2–3 frames. **Measured anchor:** the M2 numbers above, scaled by
the uncalibrated 1.5–2.2× factor, show where today's mechanism lands on A.

| Flow / metric | S | M | L | Kind | Today (M2 measured → A inferred) |
|---|---|---|---|---|---|
| Delivery: Stage route first-load JS (br, cold) | ≤ 400 KiB | same | same | **Hard** (no growth > 25 KiB br per slice without a recorded reason) | 375.6 KiB br |
| Delivery: visitor `/p` first-load JS (br) before first architectural frame | ≤ 250 KiB | same | same | Target now, **Hard** at T4 cutover | 300.6 KiB br (incl. GLTFLoader/meshopt/extras residue) |
| Delivery: landing `/` and hub `/projects` JS (br) | ≤ 80 KiB | — | — | Target | 212.0 / 214.8 KiB br |
| Delivery: Preview chunk (T3.P02.S01) | lazy; not in Stage first-load set | — | — | **Hard** | n/a (not built) |
| Delivery: editor-only/solver modules in visitor load set | none unless visitor execution requires them (named, justified) | — | — | **Hard** | clean of `lib/authoring/**` (measured); compiler required by current cold path |
| Delivery: warm repeat visit JS transferred | ≈ 0 (immutable cache hits) | — | — | **Hard** | `/_app/immutable/*` served `public, immutable, max-age=31536000` (observed in `.vercel/output/config.json`) |
| Editor startup F1: Stage first interactive frame, cold N1 | ≤ 3.0 s | — | — | **Hard** | Not run |
| Project open F2: data-in-hand → first interactive frame | ≤ 300 ms | ≤ 800 ms | ≤ 2.0 s | **Hard** S/M, Target L | admission only: 7 / 43 / 170 ms M2 → ≈ 11–15 / 65–95 / 255–375 ms A, + mesh (6.6 / 28 / 104 ms M2) + first render |
| Wall drag F3: per-move input-to-next-paint p95 | ≤ 33 ms | ≤ 50 ms | ≤ 100 ms | **Hard** S/M/L | preview solve alone 5.7 / 36 / 184 ms median M2 → ≈ 9–13 / 54–79 / 275–405 ms A — **fails M and L** |
| Wall drag F3: frame time p95 / p99; long tasks | ≤ 16.7 / 33 ms; 0 > 50 ms | ≤ 20 / 33 ms; 0 > 50 ms | ≤ 33 / 50 ms; ≤ 1 per drag | **Hard** S/M, Target L | fails M/L by the line above |
| Commit F4 (accept + install + mesh + paint) INP | ≤ 100 ms | ≤ 100 ms | ≤ 200 ms | **Hard** | accept + post-install admission + mesh CPU 21 / 112 / 471 ms M2 → ≈ 30–45 / 170–245 / 700–1,040 ms A — **fails M and L** |
| Undo/Redo F8 INP | ≤ 100 ms | ≤ 100 ms | ≤ 200 ms | **Hard** | coordinator 1 / 5 / 23 ms, but install re-admits (≈ post-install admit) → fails M/L like F4 |
| Per-edit Layout evaluation budget (compile + representation) for one pointer move | ≤ 4 ms | ≤ 8 ms | ≤ 16 ms | **Hard** M (the sub-budget that makes F3 feasible) | full compile 4.7 / 30 / 141 ms M2 |
| Orbit/navigation F7/F12: frame time p95 / p99 | ≤ 16.7 / 25 ms | ≤ 16.7 / 33 ms | ≤ 33 / 50 ms | **Hard** S/M, Target L | Not run; one draw/BufferGeometry per Wall (observed) |
| Draw calls (Stage and viewer) | ≤ 200 | ≤ 1,000 | ≤ 2,500 | Target (trigger for E-6) | Not run |
| Object import F5: main-thread long tasks during admission | 0 > 50 ms; none > 100 ms | same | same | **Hard** | Not run |
| Object import F5: chosen → placed (local file, excl. upload) | ≤ 2 s for 5 MiB | ≤ 5 s for 25 MiB | — | Target | Not run |
| Placement F6: per-move latency p95; picking per event | ≤ 33 ms; ≤ 2 ms | ≤ 50 ms; ≤ 4 ms | ≤ 100 ms; ≤ 8 ms | **Hard** S/M | Not run |
| Save F9: main-thread work; acknowledgement | ≤ 50 ms; ≤ 100 ms | same | ≤ 100 ms; ≤ 100 ms | **Hard** | serialize + content id ≈ 0.3 / 1.1 / 3.9 ms M2 (envelope 26 / 124 / 501 KB) |
| Capture/bind F10 INP; Preview entry first frame (repeat / first use) | ≤ 100 ms; ≤ 300 ms / ≤ 800 ms | same | ≤ 200 ms; ≤ 500 ms / ≤ 1.2 s | **Hard** S/M | Not run |
| Viewer cold F11: first architectural frame (LCP-like) at N1 | ≤ 2.5 s | ≤ 2.5 s | ≤ 4.0 s | **Hard** S/M from T4, Target L; N2 reported | Not run (public reads 404 until T4) |
| Viewer cold F11: first navigable frame at N1 | ≤ 3.0 s | ≤ 3.5 s | ≤ 6 s | **Hard** S/M from T4 | Not run |
| Viewer F11 first-frame payload (excl. JS) | ≤ 1.5 MiB | ≤ 4 MiB | ≤ 10 MiB | Target; rest streamed | Not run |
| JS heap after GC — editor, project open | ≤ 120 MiB | ≤ 200 MiB | ≤ 400 MiB | Target; **Hard** "no OOM/tab crash" at XL | compiled geometry retained 1.7 / 8.0 / 32.6 MiB, admitted snapshot ≈ same (M2) |
| JS heap after GC — after 100 edits (history full) | +≤ 30 MiB | +≤ 80 MiB | +≤ 250 MiB | Target | coordinator history 5.8 / 16.1 MiB (S / M); L ≈ 60 inferred |
| JS heap — viewer | ≤ 100 MiB | ≤ 150 MiB | ≤ 300 MiB | Target | Not run |
| GPU memory estimate (textures + buffers) | ≤ 128 MiB | ≤ 384 MiB | ≤ 768 MiB | **Hard** M on A 8 GB (shared memory) | Not run |
| Leaks F13: heap growth over 10 cycles (after GC); GPU resources | ≤ 5 MiB; geometries/textures back to baseline; 1 live context | same | ≤ 10 MiB | **Hard** | Not run |

## Gates before implementation acceptance (proposal)

**Where they bind.** A slice's declared verification tier already lives in its plan and in
`apps/editor/tests/README.md`. This packet proposes a **performance evidence row** in the *final gate*
of each consuming phase (never a CI job): the slice records the harness run on reference A (and the
throttled developer pre-flight), the workload ids, browser, SHA, and pass/target/disposition per
budget line it touches. Until the owner authorizes a harness, the row is satisfied by the same
measurements taken manually with DevTools Performance + the bundle report — less repeatable, so
the record says so.

| Slice | Must meet in its final gate |
|---|---|
| **C1** native Walls (T1) | Delivery: Stage ≤ 400 KiB br, visitor set unchanged or justified; F2 (S/M), **F3 drag (S/M/L hard)**, F4 commit, F8 Undo/Redo, F7 orbit at S/M; heap after 100 edits; F13 Stage cycle. *Today's mechanism is measured to fail F3/F4/F8 at M and L*, so C1 carries the resolution work (below). |
| **C2** own GLB import (T2) | F5 long-task and time-to-placed, F6 placement + picking, F7 with the imported models in M, GPU-memory estimate per admitted model in the ingest report, F9 Save with resources; delivery: decoders (meshopt/Draco/KTX2) **lazy and only when the asset needs them**; viewer: Preview/visitor see the same derivative, bytes reported. |
| **T3.P02.S01** capture + Preview (T3) | Preview chunk lazy and passing the preview-surface boundary; F10 capture/bind INP; Preview entry/return latency; F13 Preview enter/exit ×20 leak-free; Experience lowering/interpreter time at the 50-View/30-Stop dense fixture ≤ 16 ms (target). |
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
   latest-wins coalescing, transferable buffers and no second authority.
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
list must be empty or each entry justified by *visitor execution* in the acceptance record; (c)
first-load and per-chunk br bytes are compared with the previous accepted record.

## Retain / adopt / bounded experiment (proposal)

### Retain

- **R-1** The build-time public/preview surface gates, `f4-public-isolation`,
  `program-entry-closure` and the shared closure resolver — the correct structural mechanism.
  **Repoint** their editor patterns from the deleted `src/lib/editor/` to `src/lib/authoring/`
  (all of it, with any explicitly runtime-safe sub-tree allow-listed), and add `routes/project/`,
  `routes/projects/`.
- **R-2** One canonical compiler shared by Stage and visitor (rule 4/6); runtime-safe evaluators stay
  shared. Optimizations go *inside* it.
- **R-3** Hashed immutable assets, catalogue meshopt + webp + quantization derivatives, and the
  delivery-derivative exception as the route to compiled release payloads.
- **R-4** `test:heavy`'s deterministic operation-count/differential oracles; incremental-compile
  correctness is proved there, never by timing.
- **R-5** On-demand benchmarking as the default posture (tests README) — the harness below runs when a
  slice's final gate or an investigation needs it.

### Adopt (needs owner authorization where marked)

- **A-1 (owner authorization: harness + devDependency).** A reproducible browser harness:
  **Playwright** (`@playwright/test`, Apache-2.0) driving pinned Chromium/Chrome (+ WebKit/Firefox for
  secondary) with **CDP** for `Emulation.setCPUThrottlingRate`, `Network.emulateNetworkConditions`,
  `Tracing` (devtools.timeline, blink.user_timing, v8, gpu categories), `Performance.getMetrics`,
  `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage`; in-page `PerformanceObserver` for
  `event` (INP), `long-animation-frame`, `largest-contentful-paint`; `renderer.info` for draw calls/
  memory. Lives outside the default lanes (its own config and script, e.g. `perf:browser`), runs
  on demand and in final gates, writes JSON records next to the acceptance record. **Not** a CI
  gate or scheduled job unless the owner separately authorizes that too. Workload fixtures are
  generated through public planners (as here) and real pavilion fixtures, versioned with the harness.
- **A-2 (owner authorization: script only, no dependency).** Bundle analysis as a final-gate step:
  promote `bundle-analysis.mjs` (Node built-ins + already-present `@jridgewell/sourcemap-codec`) or an
  equivalent, with a `--sourcemap` build in a temp outDir; outputs route load sets, br bytes and the
  viewer-delivery module list. Optional visual aid: `rollup-plugin-visualizer` (MIT) — not needed.
- **A-3 (slice-local, no authorization beyond the slice).** Fix the measured delivery residue in the
  first slice that touches the files: lazy-load `GLTFLoader`/`useMeshopt` with the first model
  (D-2), import `@threlte/extras` members from their subpaths or replace them to drop the gizmo/
  sprite/BVH residue (D-1), cut the landing/hub → `camera-core` → Three edge (e.g. a Three-free
  persistence reader or a dynamic import), make Preview a lazy route-local chunk (T3.P02.S01), and
  retire `p2311-perf` from the public barrel (D-3).
- **A-4 (C1-local).** Remove the double compile per accepted edit and the recompile on Undo/Redo
  (reuse candidate/admitted geometry by content id). The post-install admission is ≈ 49 % of
  accept + admission at M (40.6 of 83.6 ms, measured). Deduplication therefore removes up to that
  share of commit cost, and most of the Undo/Redo admission cost, before any incremental work.

### Bounded experiments, each with a trigger

| Id | Experiment | Trigger (measured on reference A or calibrated pre-flight) | Exit criterion / falsifier |
|---|---|---|---|
| **E-1** | **Incremental canonical compile** (Junction/Wall/Opening/Room-face invalidation inside layout-core; per-Wall mesh reuse) | **Already triggered** for C1: preview solve 36 ms (M) / 184 ms (L) median on M2 vs ≤ 8 ms per-move evaluation budget | Equal-output differential over the heavy lane's tables + grids; per-move evaluation ≤ 8 ms at M on A; if locality cannot be bounded (e.g. Room reconciliation is inherently global for topology edits), fall back to E-2 for those operations |
| **E-2** | **Worker-hosted planner/compile with latest-wins coalescing** | F3 long tasks > 50 ms on the main thread after A-4/E-1, or F2 open > 800 ms at M | Main thread free during drag (0 long tasks); preview latency = worker solve + 1 frame; structured-clone/transfer cost of compiled geometry measured (≈ 8 MiB retained at M suggests a compact transferable form is needed) |
| **E-3** | **Drag preview semantics** — keep "preview = planner output" but evaluate only the affected component/region during the drag, validating the whole document at commit | E-1 misses at L | Owner/contract call (F.4 preview semantics); must never show a candidate the commit could refuse without labelling it |
| **E-4** | **Compiled delivery derivative for the visitor** (prepared Layout geometry/meshes in the T4 package; drop compiler + scene codec from `/p`) | T4 planning, or F11 first frame misses with compile > 20 % of it | Payload bytes vs saved code bytes (≈ 30–47 KiB br: layout-core 21.8, mesh builder 7.1, scene-codec share of project-model's 18.4) and compile time (141 ms M2 at L); keep runtime compile if the derivative costs more bytes than it saves at M |
| **E-5** | **BVH picking** (`three-mesh-bvh`, MIT — already in `node_modules` transitively) | picking > 4 ms at M, or any 100 k-tri model in the placement path, or part picking (CD-5) | Picking ≤ 1 ms p95 at L; BVH build off main thread or cached per resource revision |
| **E-6** | **Batching / instancing** (merge static Wall meshes per material; `InstancedMesh`/`BatchedMesh` for repeated objects) | draw calls > 1,000 at M or F7 frame p95 > 16.7 ms at M on Iris Xe | p95 within budget; per-Wall identity preserved through `wallRanges`/`pickRanges` (already emitted by the mesh builder) |
| **E-7** | **KTX2/Basis textures** for the C2 derivative and catalogue (gltf-transform `toktx`/`etc1s`/`uastc`; KTX-Software and basis_universal are Apache-2.0) | GPU-memory estimate > budget at M, or texture upload long task > 50 ms, or creator maps > 2K | GPU memory −60 % or better at equal visual review; transcoder (≈ 0.5 MiB wasm) loaded only when a KTX2 asset exists |
| **E-8** | **LOD/culling/streaming** for L/XL viewer packages | F11 L first frame > 4 s or F12 L p95 > 33 ms | Within L targets; no change to authored truth |
| **E-9** | **WASM kernel** (CD-8 Clipper2 spike; any Rust/WASM) | Only an isolated CPU bottleneck after E-1/E-2 (North Star) | Boundary-inclusive proof: bytes + instantiate + marshal ≤ the JS cost it replaces |

## Proposed amendment locations (gists only; not edited)

- **`apps/editor/tests/README.md` §Correctness tests vs performance benchmarks.** Keep "on demand" and
  "no CI gate"; add: a phase final gate that touches a budgeted flow records a performance evidence
  row from the owner-authorized harness (A-1) and the bundle report (A-2); name the harness command,
  reference profiles, workloads, statistics (p75/p95/p99, ≥ 10 runs) and where records live; state
  that timing never substitutes for correctness oracles and correctness never substitutes for timing.
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
  Add each slice's performance gate row (table above); for C1, record that drag/commit/Undo already
  miss M/L and that A-4 + E-1 (or E-2) are in-slice scope.
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
- **U-5** External thresholds are stated from knowledge, not re-fetched; recheck before contract text.
- **U-6** The emitter of the unreferenced Draco/Basis assets was not identified; harmless to clients.
- **U-7** History retention was measured on the coordinator only; the Stage host may retain
  additional per-install snapshots.
- **U-8** Whether drag preview may evaluate less than a full candidate (E-3) is an F.4/T1 contract
  question for the owner, not a performance decision.
- **U-9** Statistics come from one recorded run per probe. Samples are n = 6–60, so the p95 values
  are indicative, and the mains-powered machine was idle but not isolated. The first warm run's
  S/M/L rows agreed within ≈ 15 % of the recorded rerun. That first run stopped at the stress row
  on a probe bug (an operation id with spaces), which was fixed for the rerun.
- **U-10** Creator GLBs (C2) may be uncompressed, with 4K PNG/JPEG maps. The catalogue's
  meshopt + webp + quantization profile is therefore not a guide to C2 import or GPU cost. Workload
  M's creator-model line is an assumption to replace with real samples.

## Handoff to the convergence lead

- **Measured:** visitor `/p` loads 300.6 KiB br JS, the Stage 375.6, and landing/hub/redirect
  211–215 each. Of that, ≈ 152 KiB br is Three, present on every route. No `lib/authoring/**` reaches the visitor; the
  Layout compiler and scene codec do, as current cold-path requirements. Gizmo/sprite/BVH residue,
  static GLTF/meshopt and a P23.11 seam do, without need. The editor-isolation patterns point at a
  deleted tree (G-1).
- **Measured:** full canonical compile 4.7 / 30 / 141 ms (24 / 112 / 420 Walls) on an M2; every
  pointer move of a Wall drag runs a full planner solve (5.7 / 36 / 184 ms); an accepted edit compiles
  twice (planner + post-install admission) and Undo/Redo re-admits. Commit CPU, including the
  full Wall-mesh rebuild, is 21 / 112 / 471 ms on the M2. At M and L this misses any
  reasonable drag and commit budget on a regular laptop. **C1 must carry A-4 and E-1 (or E-2)** —
  the owner's "resolve in the consuming slice" rule applies immediately.
- **Proposal:** reference laptop A (i5-1135G7/Iris Xe, 8 GB, 1080p60, Chrome) + B (M1 8 GB);
  S/M/L/XL workloads; 13 flows; the budget table; a final-gate performance evidence row; the
  viewer-delivery gate; owner authorization for a Playwright + CDP harness and a bundle-report step.
