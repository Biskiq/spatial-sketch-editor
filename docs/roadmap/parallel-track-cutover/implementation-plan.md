# PR #115 — Architecture Reset: Frozen-Lane Isolation, Aggressive Pruning & Parallel-Track Cutover

**Status:** proposed executor plan, revision 3 (revision 2 plus the folded-in peer-review corrections F1–F6), ready for independent re-review. Nothing in this document is executed yet. Execution needs owner authorization against the reviewed plan.

**Inspected baseline:** `main` at `e90a58224443bdbf44114d7285d55c983b79cc84`, 2026-10-13. The plan is written on `codex/pr115-architecture-plan` (head `44ccbb78`, which adds only this file). Counts are taken from tracked files and exclude ignored local artifacts. Before execution, recheck the baseline-to-start diff and inspect only the files that changed in between.

**What changed in revision 3:** sections 8–11 are now self-contained and need no earlier revision. The gate register is version-aware and checked against a trusted base. The cycle window gets an enforced opening hook. A bounded post-prune reassessment (WP3R) is added. The `/p/` visitor and snapshot reader are explicitly retained until T4. WP3 acceptance requires DB-backed API tests that actually run.

**What changed in revision 2:** revision 1 forbade any production-code deletion in #115. The owner has lifted that restriction. #115 now prunes production code, presentation, supporting abstractions and tests aggressively, so that T1–T4 begin from the smallest sound foundation. Three owner statements made on 2026-10-13 are binding inputs:

1. **No data obligations.** The only public release is the checked-in Chopin museum. The project uses fast-moving development with no versioning or compatibility support. Saved development projects and historical formats create no reader obligation.
2. **The P23B benchmark is finished.** It was built to stress-test and optimize algorithms that already pass in the kernel code. Its harness, perf routes and measurement apparatus go away together with their seams. Only kernel correctness checks survive.
3. **The frozen relic is a separate, deletable project** (§3): one self-contained folder that can be kept as an old project and deleted in one step.

**Owner rulings (2026-10-13):** D2 is overridden (the frozen project sits outside the product; §3.6). D3 (capability loss, plus strict readers making legacy-format development projects unloadable) is accepted as not mattering. D4 (checkpoint commits on the #115 branch per WP) is approved for execution. D1 is resolved by the §3 design: `apps/museum` is superseded. Deployment of the frozen project is owner-handled outside #115, and the folder must be deletable without affecting anything (§3.4). No owner decision remains open for plan approval.

**Deliverable:** one coherent architectural reset with four parts:

- an isolated frozen Chopin lane;
- a reduced new-product foundation;
- reconciled tests that pass;
- a pruned documentation and execution system from which T1–T4 plan independently.

#115 does **not** write T1–T4 capability plans or implement new capabilities.

**Approval boundary:** approving this plan authorizes the pruning described here. It is not authorization to implement capabilities, ratify an exact F interface, declare a Baseline or close a major phase.

## 1. Governing conclusions

The live authorities are unchanged:

- [North Star](../../reference/north-star.md)
- [architecture](../../reference/architecture.md)
- [F](../../reference/composition-execution.md)
- the [September 27 ratification](../../reference/decisions/northstar-ratification-2026-09-27.md) and its [World | Experience amendment](../../reference/decisions/world-experience-reconciliation-2026-09-29.md)
- the [PLATE shell/visual contract](../../reference/design-system/editor-shell-and-visual-system.md) and the [spatial-instrument grammar](../../reference/design-system/spatial-instrument-grammar.md)

Prototypes supply interaction evidence only. They never supply production formats, history or evaluators. Aggressive pruning does not reopen product direction.

**Recommendation: freeze, then subtract.**

1. **Freeze the Chopin products first, as a separate project.** Copy the full current implementation behind `/museum` and `/museum/editor` into one self-contained, hash-frozen standalone project (`legacy/chopin-museum/`). The copy includes a snapshot of the kernel packages and its own dependencies and static assets. Prove it builds and works on its own *before* deleting anything. Then the frozen products stop constraining new development, and the folder can be deleted in one step.
2. **Delete the old new-editor application layer.** This means the whole `src/lib/editor/` shell: composition, store and session, workspaces, panels, inspectors, timeline, gizmos, helpers, context menus, hierarchy, CSS, tokens and theme. It also means the editor-only routes and the old Plan presentation layer. A short, named list of pure domain-semantic modules is kept and moved out of the shell directory (§4.3).
3. **Keep the domain kernels and the delivery foundation:**
   - `layout-core`, `project-model` and `camera-core`;
   - the generic renderer and resource lifetimes;
   - the visitor runtime and its isolation plugins;
   - the API and platform;
   - project persistence, which the entry/hub routes still use.
4. **Retire legacy-generation *acceptance* in the new product.** After the freeze, nothing in the new product consumes legacy-format payloads, and the owner has stated there are no data obligations. Project-level readers, the API and the cold-release reader therefore become strict wall-first/world-local. The separable compat/migration/conversion modules are deleted. The deep legacy Layout types/codec are entangled with 37 wall-first modules, so separating them is tied to T1's first Layout schema cutover (§6).
5. **Delete tests with their subjects.** Extract the semantic assertions that guard retained kernels. Every retained gate passes. Nothing is skipped or marked expected-to-fail.
6. **Prune the documentation and rebuild the execution system to match the reduced tree** (§8–§11), with gate machinery that is proportionate but version-aware (§9.4).

A full rewrite of the kernels is unjustified: canonical topology, curve/Junction geometry, shared Camera evaluation, visitor isolation and resource handling are sound and heavily tested. Keeping the old shell is also unjustified. It embeds a superseded information model, and the frozen relic is its only remaining reason to exist, which the freeze removes.

**Prune-first policy:** strict current-format readers, one writer per meaning, and no historical decoder, bridge or facade added for development data. The frozen Chopin project is the only preservation exception. It sits outside the product entirely (§3.6).

## 2. Verified current state

### 2.1 Facts inspected at the baseline

- ProjectDocument is `{ id, name, layout, scene }`. There is no Experience unit and no F envelope. Wall-first Layout format is 5. World-local Scene is `formatVersion: 1`. The legacy room-local Scene and floors/rooms Layout shapes are still decoded.
- Scene stores Camera nodes, connectivity, paths and view tracks. Editorial order (`nextNodeId`, `previousNodeId`, `holdSeconds`, `detourOfNodeId`, `lockInteraction`) is still mixed into Camera data.
- Both Layout generations lower into `compileLayoutGeometrySource`. They are format adapters to one compiler. Runtime Scene resolution generates node-position endpoints around authored interior anchors.
- EditorHistoryController is one capped, chronological stack of Layout or Scene snapshots. It has no atomic multi-unit acceptance and no expected-revision precondition. Project Save has no expected-base revision. Publication has its own optimistic-concurrency (OCC) scheme.
- `readPublicRelease` validates the saved project version with authoring code. Cold preparation calls `prepareCompatibleRuntime`, which accepts every recognized generation.
- TD-1: canonical floor-supported placement is broken (empty Room-frame registry, room-local node writes). This is confirmed from source.
- Static model cold validation uses the shipped-static identity, while `AssetModel` rendering reads the mutable catalogue `productionFile`. This resource-source seam is a T2/T4 obligation.

### 2.2 Source evidence for production pruning

I computed import closures over tracked sources (static, type, dynamic and CSS imports; `$lib`, `@portfolio/*` and `virtual:museum-editor-entry` resolved). WP0 reproduces this as a committed helper (§12).

| Entry | Closure (files) | Notes |
| --- | --- | --- |
| `/museum/editor` relic (`routes/museum/editor` → virtual entry → `lib/editor/MuseumEditorApp.svelte`) | 341 | **194 `lib/editor` files, of which 187 are shared with the new editor and only 7 are relic-only.** These include the 3,398-line `editor-store.svelte.ts` and all six shell CSS files. The relic "shares the editor chrome pool and repaints with it". A `relic` flag threads through ~30 shared components. |
| `/museum` as hosted in `apps/editor` (`routes/museum` → `lib/museum/MuseumCanvas`) | 126 | Chopin rooms, `CameraDirector`, `MuseumHUD`, runtime state. |
| Combined frozen closure (both routes) | 344 files / ≈119k lines | Includes 69 kernel-package files (≈30k lines). |
| New editor (`/`, `/editor`, `/projects`, `/project/**`) | 395 | 48 `lib/editor` files are new-editor-only. |
| Public visitor `/p/:publicationId` | 111 | Contains **no** `lib/editor` file. Generic renderer subset only. |
| `/dev/**` (perf, assets, materials) | 411 | Perf routes pull in 236 editor files. |
| `apps/museum` (`/museum` route) | 125 | Separate app. |
| `apps/api` | 84 | Imports `layout-core` and `project-model`. |

More facts:

- **Deployment.** Root `vercel.json` builds only `@portfolio/editor` (`build:vercel`). The repository-configured production `/museum` is therefore `apps/editor/src/routes/museum/+page.svelte`. `apps/museum` is a separately buildable fork: 59 source files and 14 duplicated static assets. Sixteen of its files have diverged from their editor counterparts (for example `texture-cache.ts` by 143 lines), and it is still co-patched (P23.15/P23B.6 commits). Whether a second Vercel project deploys it is not visible in the repository (owner decision **D1**).
- **Chopin content** (`chopin-project.json`) is the **legacy floors/rooms Layout + legacy room-local Scene** generation. The frozen products are therefore the only remaining legitimate consumers of the legacy generation.
- **Legacy acceptance is live in the new product's readers:** `validateProject` in API Save/Load and publication; `prepareCompatibleRuntime` in preview and cold release. Per the owner statement this protects no data.
- **The legacy Layout code is entangled.** `layout-codec.ts` is imported by 9 wall-first modules (including `layout-wall-first-codec.ts` and `layout-wall-first-precision.ts`), and `layout-types.ts` by 37. `layout-compat`, `layout-migration` and `layout-migration-math` are consumed only through `index.ts`. In `project-model`, `project-compat`, `compat-runtime`, `scene-world-conversion` and `standalone-scene-import` form a separable legacy chain.
- **Five packages have zero app consumers:** `scroll-travel`, `note-cursor`, `portfolio-hud`, `portfolio-content` and `audio-plink`. The last is used only by the other two. `@portfolio/scroll-travel` is still an editor dependency.
- **Orphan production files** (reachable from no route or API; some only from tests): `museum/materials/surfaces/{Floor,Wall,Ceiling}.svelte`, `museum/MuseumAssets.svelte`, `editor/layout/layout-transaction.ts`, `editor/helpers/package-sha.ts`, `content/{package-format,scene-format}.ts`, `content/scene.json`, and the `layout-geometry-source`/`migration`/`opening-set` facades. The bench `record-baseline`/`reuse-ratchet` CLIs and `p2311-proxy-probe` are also orphans.
- **31 of the 34 files in `apps/editor/src/lib/layout/` are two-line re-export facades** of `layout-core`. The real app-local code is `wall-mesh-builder.ts` (1,928 lines; renderer mesh generation, shared with the visitor), `plan-render-model.ts` (1,026) and `plan-control-grammar.ts` (71). The last two are old-Plan presentation.
- **Prototypes import no production code.** I grepped every tracked prototype script for `apps/editor`, `packages/` and `@portfolio/` imports and found none. Production pruning cannot break protected prototype evidence.
- **Tests.** `apps/editor/tests` holds 408 tracked files, 373 of them `*.test.ts`. By direct import: 147 touch no `lib/editor` module, 214 touch modules shared by the relic and the new editor, and 10 touch new-editor-only modules. The lanes are ARCH (24 files), HEAVY (8) and PERF (10, all P23B/bench). `relic-smoke.test.ts` is the relic's dedicated safety net. It asserts the mount route, Paris-only room focus, placement arming, frozen transport, Flip-semantics drift and live-shell isolation.
- `app.html` contains a pre-hydration theme boot script kept in sync with `theme.svelte.ts`. The relic depends on it.

## 3. Frozen Chopin project (isolation strategy)

**Owner direction (2026-10-13):** the frozen relic must live in **one self-contained folder** that can be kept as an old, separate project and later deleted in one step. It is not a lane inside the editor app.

### 3.1 Options considered

| Option | Verdict |
| --- | --- |
| Keep sharing `lib/editor` with the relic | **Rejected.** 187 shared files mean every new-editor deletion is a relic change. |
| Fork `lib/editor` + `lib/museum` but keep sharing kernel packages | **Rejected.** T1/T2/T3 cutovers remove legacy Layout/Scene readers, Room frames and Camera node order, all of which the relic needs. Kernel fixes would also silently change a frozen product. |
| Frozen folder inside the editor app (`apps/editor/src/legacy/chopin/`), still routed and built by the deployed editor (revision 2 draft) | **Superseded.** URLs stay the same and there is no deployment change, but deleting the relic would also mean editing routes, aliases, static assets, `app.html` and dependencies. It also keeps building with the editor's dependency versions, so editor upgrades could break it. |
| **Standalone frozen project `legacy/chopin-museum/`** (own SvelteKit app, own dependencies and lockfile, own static assets, kernel snapshot and tests; deployment handled by the owner) | **Recommended, owner-confirmed.** Deleting it is `rm -rf legacy/chopin-museum`; nothing in the product references it (§3.4). |

### 3.2 Layout: everything inside one folder

```text
legacy/chopin-museum/                  outside root workspaces (root globs are apps/*, packages/*), so it is not an npm workspace
  README.md                            provenance (baseline SHA), run/build/test/deploy, contract (§3.3), how to delete
  FREEZE.json                          baseline SHA + per-file {baseline path, frozen path, sha256}
  package.json, package-lock.json      own dependencies, pinned to the versions the root lockfile resolves at the baseline
                                       (three, @threlte/core, @threlte/extras, svelte, @sveltejs/kit/adapter-vercel/vite-plugin-svelte,
                                        vite, lucide-svelte, fflate, @fontsource-variable/inter, robust-predicates, vitest, typescript, svelte-check)
  svelte.config.js, vite.config.ts, tsconfig.json, vitest config(s)
                                       copied from apps/editor; plugins limited to what the two routes need
  src/app.html                         byte copy (includes the theme boot script the relic relies on)
  src/routes/museum/+page.svelte, src/routes/museum/editor/+page.svelte   byte copies
  src/lib/**                           byte copies of the 275 app files in the frozen closure, same relative paths as apps/editor/src/lib/**
  kernel/{layout-core,project-model,camera-core}/src/**   byte copies of the three packages (69 files)
  static/museum/**, static/textures/** byte copies of the editor's static assets
  tests/**                             relic-smoke, paris-activation, runtime-state, chopin-*, rooms, theme sync, Chopin goldens, freeze test
```

**Zero-rewrite copy.** It is its own SvelteKit app, so `$lib/…` already resolves to its own `src/lib`. The three `@portfolio/*` specifiers are mapped to `kernel/<pkg>/src/index.ts` with `kit.alias`, and `robust-predicates` is a dependency of the project itself. Every frozen source file is therefore **byte-identical** to the baseline. `FREEZE.json` uses plain sha256 hashes, with no normalization step. Only the project's own config files are new or adapted, and they are listed in `FREEZE.json` as such.

The virtual relic entry plugin is copied only if the relic still needs it. Otherwise the route imports `MuseumEditorApp.svelte` directly; the route file is the one place where that edit is permitted. The relic UI, store and behavior are not rewritten.

### 3.3 Frozen-project contract

- **Functional contract (unchanged from today):**
  - `/museum` renders the Chopin museum with guided navigation and the HUD.
  - `/museum/editor` mounts the relic Scene · Camera editor on Chopin: Paris-only room focus, placement arming, the tour selector, the frozen mini-player transport, the relic's own ruler/preview controls and relic Flip semantics.
  - The relic refuses the Layout workspace and registers no Layout history.
- **No forced modernization.** It keeps its legacy formats, Room frames, Camera node order, CSS and tokens.
- **Change policy:** preservation fixes only, each as a separate reviewed change that updates `FREEZE.json` with a reason. Dependency versions do not move unless a preservation fix requires it.
- **Isolation, enforced from the product side:** one product arch test asserts that no file under `apps/` or `packages/` imports, aliases or references `legacy/`. The test passes unchanged after the folder is deleted.
- **Verification:** the project's own commands (`npm ci && npm test && npm run build` inside the folder) run at WP1 and at final acceptance. They are not part of root `npm test`, because the two codebases share nothing that could break.

### 3.4 Deployment and complete independence (final owner decision)

**Owner decision (2026-10-13):** the owner handles the frozen project's deployment directly, later and outside #115. The frozen project must be self-contained, and it must be deletable from this repository **without affecting anything in the product**. As a result:

- #115 adds **no** redirect, proxy, Vercel project or deploy configuration for the frozen project. `vercel.json` and `inject-vercel-api-proxy.mjs` are unchanged.
- WP2 removes the editor's `/museum` and `/museum/editor` routes. Once #115 merges, the product deployment no longer serves them. Serving the frozen project somewhere is the owner's separate action, and the plan records it in `acceptance.md` as owner-handled, not as a #115 gap.
- **Deployment guidance**, written in the frozen README for the owner and not acted on by #115: the frozen code and data use root-relative asset URLs (`/museum/models/…` in 11 places, `/textures/…` in 5), and the product's catalogue also uses `/textures/…`. The frozen project should therefore be deployed at **its own origin** (its own Vercel project with root directory `legacy/chopin-museum`), not proxied under a product sub-path.

**Independence rules (the "delete without affecting anything" contract):**

1. **No product → legacy dependency of any kind.** No import, alias, workspace glob, root script, lockfile entry, test-lane entry, CI step, deploy configuration, static-asset sharing or product doc link points into `legacy/`. The frozen project has its own `.gitignore` (node_modules, .svelte-kit, .vercel, build) so it also works when extracted on its own. The root `.gitignore` patterns are unanchored and incidentally cover it as well.
2. **No legacy → product dependency.** The frozen project's sources, configs, tests and README reference only files inside its own folder. Its dependencies resolve from its own `node_modules`. Product changes therefore cannot break it, even through the repository-wide docs checker, which only sees its in-folder paths.
3. **The product mentions it at most in plain text,** in one sentence in `reference/architecture.md`: "The frozen Chopin museum and legacy editor are a separate frozen project outside this product." No path link, no route row, no test.
4. **Deletion proof at acceptance.** The executor moves `legacy/chopin-museum/` aside in a scratch worktree and runs every product gate in §7.4 against the result. The gates must be green with byte-identical output to the run with the folder present (apart from timing).

### 3.5 `apps/museum`

`apps/museum` is a separate, drifted fork of the visitor museum. Sixteen of its files differ from the code production actually serves, and `vercel.json` does not deploy it. The standalone `legacy/chopin-museum` project is built from **the editor-hosted code production serves today**, and it also contains the relic editor. `apps/museum` is therefore superseded and **retired in #115**:

- remove the workspace;
- remove its root `build`/`check`/`dev:museum` entries;
- remove its static duplicates;
- remove the tests that import its copies; the kernel assertions in those tests stay, against the kernel only.

Any existing `apps/museum` deployment is the owner's to replace with the frozen project (§3.4).

### 3.6 Authority rules (owner override, D2)

The owner has overridden the AGENTS rule conflict. The frozen project sits **outside the product**. AGENTS gains one line: "`legacy/` holds frozen, separate projects outside product scope; product code never imports them; product rules, authorities and tests do not apply to them." AGENTS rules 4 and 6 themselves are unchanged. There is no exception text inside them, and no product authority treats the frozen kernel copy as a source.

## 4. Target minimum viable architecture

### 4.1 What remains

```text
TARGET TREE (after #115; ★ = new file, ⇢ = relocated)
apps/editor/src/routes/
  +page.svelte                     public entry (guest start / Google)      RETAIN
  editor/+page.svelte              redirect → /project/:id/spatial           RETAIN
  projects/+page.svelte            owned project hub (cloud list)            RETAIN
  project/[projectId]/spatial/+page.svelte  ★ foundation-reset notice (no authoring; links to /projects and /museum)
  p/[publicationId]/+page.svelte   cold public visitor route                 RETAIN
  museum/**                        REMOVE (the frozen project serves these where the owner deploys it; §3.4)
  dev/assets, dev/materials        RETAIN only if WP2 closure ⊆ foundation; otherwise REMOVE (no rework)
apps/editor/src/lib/
  content/      generic catalogue: assets.ts, materials.ts, scene.ts, scene-validation.ts, texture-uri.ts
  museum/       generic renderer: assets/*, entities/*, materials/{MuseumMaterial,SceneInstanceMaterial,
                scene-instance-material,texture-cache}.*, layout/{GroundPlinth,RoomPortal,wall-material-factory}.*
  render/       wall-geometry-adapter.ts
  layout/       wall-mesh-builder.ts (the only non-facade layout module kept)
  types/        assets.ts, materials.ts, scene.ts
  project/      project-codec.ts (catalogue-configured strict codec), project-types.ts
  visitor/      all ten files (cold runtime made strict in WP3)
  platform/   ⇢ project-persistence.ts, mime-sniff.ts, project-asset-request-scope.ts, texture-verifier.ts
  authoring/  ⇢ named pure semantics (§4.3)
apps/editor/vite/  preview-surface-boundary-plugin, preview-surface-dynamic-scan, public-surface-boundary-plugin
packages/  layout-core, project-model, camera-core, tsconfig
apps/api/  unchanged except effects of the strict project-model readers
```

Directory names (`lib/museum` for the generic renderer) are kept to avoid churn in test paths. Renaming them is cosmetic and is not part of #115.

### 4.2 Remaining entry points and expected behavior

| Route / command | Post-#115 behavior |
| --- | --- |
| `/museum`, `/museum/editor` | **Not served by the product.** Fully functional and frozen in `legacy/chopin-museum` (own `npm run dev`/`preview`/`build`). Production hosting is owner-handled (§3.4). |
| `/`, `/projects`, `/editor` | Functional: guest/Google entry, project list and redirect. |
| `/project/:id/spatial` | Static notice: authoring is unavailable during the foundation reset. No project load and no session. |
| `/project/:id/preview`, `/project/:id/publish` | **Removed** (404). |
| `/p/:publicationId` | Functional strict cold reader for wall-first/world-local releases. There are currently none (owner statement). It is kept because it is the only end-to-end consumer that keeps the public-surface boundary plugin, visitor isolation tests and API publication tests meaningful (§5.1). |
| API Save/Load/assets/publication | Functional. Legacy-generation documents are now rejected with a validation error. |
| `/dev/perf*`, `bench:record`, `reuse:record`, `test:perf` | **Removed.** |

### 4.3 Retained pure semantics (moved into `lib/authoring/`, each with its existing tests)

A module is retained only if it meets all four criteria:

- it is pure (no Svelte, runes or store);
- it does not depend on old shell/session types (`editor-types`, `editor-selection`, `editor-store`);
- it implements semantics the accepted destination still requires;
- it has direct tests.

| Module(s) | New home | Rationale | Later owner |
| --- | --- | --- | --- |
| `camera/editor-camera-framing`, `-framing-envelope`, `-framing-authoring`, `-path`, `-view`, `editor-directed-edge-motion`, `editor-camera-timing`, `editor-camera-connections`, `helpers/route-clone` | `authoring/camera/` | Pure Camera authoring math: framing envelopes, interior-anchor path editing, directed-edge timing and connectivity. These are Camera-owned semantics independent of the shell. | **REFACTOR LATER at T3** Camera-unit extraction, which decides whether they belong in `camera-core`. Editorial-order parts are not among them. |
| `layout/plan-hit`, `layout/plan-numeric-entry`, `layout/layout-exact-input`, `snap-input-validation` | `authoring/layout/` | Hit resolution against compiled query records with a locked priority, and exact-value parsing/validation. PLATE precision and refusal still require these. | T1 viewport/precision slices. |
| `cluster-obb`, `obb-util`, `scale-vector`, `editor-vector`, `layout/plan-scene-footprint`, `layout/plan-scene-hit` | `authoring/scene/` | Placement-local bounds, footprint derivation and hit. These match the T2 "derived footprint, support-owned Y" obligation. WP3 removes the footprint's legacy room-frame branch. | T2 placement slices. |
| `app/roving-focus` | `authoring/a11y/` | A keyboard roving-focus primitive (accessibility behavior). | T1 shell. |

**Everything else in `src/lib/editor/` is REMOVE.** That includes `layout-interaction` (1,706 lines, the old Plan FSM), the old Plan presentation layer (`plan-overlays`, `-room-labels`, `-dimensions`, `-salience`, `-attention`, `-snap-grammar`, `-refusal`, `-acquisition`, `-architecture-grammar`, `-text-measure`, keyboard readout/session/traversal), the Layout editor adapters (`layout-*-editing`, `-transient-*`, `-mutation-runner`, `prepared-wall-meshes`, `layout-mesh-factory`) and `editor-navigation-graph`. The last is the Scene-embedded graph mutator, which mixes Camera connectivity with T3-retired editorial order. All of these remain recoverable at the baseline SHA. A later slice that wants one restores it deliberately, with a reviewed reason; there is no dormant copy in the tree.

### 4.4 Intentional capability loss (recorded honestly)

After #115 the **new product cannot**:

- author, edit, view in Plan or 3D, place, light, apply materials, direct Camera, preview, publish, import or export a project;
- run perf benchmarks.

It can sign in, list projects, persist through the API and serve a cold public release.

These losses are by design. They are not regressions, and each one is a T-track capability to rebuild. Regressions are anything else, in particular any change to the frozen project, kernel output, visitor isolation or API behavior other than the legacy rejection.

## 5. Production disposition and deletion manifest

### 5.1 Disposition register (new five-way classification)

EVIDENCE-PATHS: start — baseline implementation paths at e90a58224443bdbf44114d7285d55c983b79cc84; #115 removes many of them

| Subsystem | Class | Rationale / exact condition |
| --- | --- | --- |
| Relic + editor-hosted museum closure, both museum routes, `static/museum/**` and `static/textures/**` copies | **ISOLATE FOR LEGACY** | §3: byte-copied into the standalone `legacy/chopin-museum/`. The editor's museum routes are then removed, and the originals are handled by the rows below. The product keeps its own static assets for the generic catalogue. |
| `lib/editor/**` shell, store, session, controllers, workspaces, panels, inspectors, timeline, tree/hierarchy, context menu, gizmo hosts and adapters, helpers/overlays, hooks, fields, import/export UI, preview coordinator, publish surface, asset upload/load stores | **REMOVE IN #115** | Obsolete composition and information model. The only other consumer was the relic, which is now frozen. PLATE and the spatial grammar own the destination. |
| `lib/editor/styles/*.css` (1,570 lines), `styles/scene-palette.ts`, `theme.svelte.ts`, theme registry, token architecture | **REMOVE IN #115** | Old presentation. PLATE owns material, type, metrics and state. The relic keeps its frozen copy. The theme boot script is removed from the product's `app.html`; the frozen project has its own copy. |
| `lib/editor` pure semantics listed in §4.3 | **RETAIN AS FOUNDATION** (relocate) | See §4.3. |
| `lib/layout/*` 31 re-export facades; `project/project-layout-semantics.ts`, `content/{package-format,scene-format}.ts` re-exports; `content/scene-codec/` facade; `project/compat-runtime.ts` | **REMOVE IN #115** | Thin facades are not domain algorithms. Callers import packages directly. |
| `lib/layout/plan-render-model.ts`, `plan-control-grammar.ts` | **REMOVE IN #115** | Old Plan presentation model. T1's Layout-owned representation evaluator (typed cut/projected/hidden streams) is the successor contract, not this model. The invariant "Plan rendering consumes compiled geometry, never reconstructs it" carries into T1 planning evidence. |
| `lib/layout/wall-mesh-builder.ts`, `render/wall-geometry-adapter.ts`, generic `lib/museum` renderer, `texture-cache`, material remap | **RETAIN AS FOUNDATION** | Renderer and resource-lifetime mechanisms shared with the visitor. Attributed geometry, cloned material ownership and release-scoped caches are preserved. The static-model source seam stays a T2/T4 obligation. |
| Chopin-specific `lib/museum` (rooms/*, `LegacyRoom`, `ParisSalon`, `CentralChamber`, `LayoutMuseumShell`, `MuseumScene`/`Entities`/`Canvas`, `RoomFrame`, `CameraDirector`, `NavigationNode`, `paris-activation`, `placement-registry`, `EditorPlacementRoot`, `ui/MuseumHUD`), `content/chopin-*`, `rooms*.ts`, `state/runtime-state` | **ISOLATE FOR LEGACY**, then remove the originals | Only frozen consumers remain once the new editor is removed. |
| Orphans (§2.2), including `surfaces/{Floor,Wall,Ceiling}.svelte` | **REMOVE IN #115** | Unreachable from any route or API. AGENTS rule 6's "prefer Floor/Wall/Ceiling planes" is rendering guidance and does not depend on these unused files. |
| Visitor runtime (`lib/visitor/*` guided runtime, cold-runtime shell, isolation), vite boundary plugins, `routes/p/[publicationId]` | **RETAIN AS FOUNDATION** | The visitor-isolation guarantee (AGENTS rule 4) needs a real visitor entry. `public-surface-boundary-plugin.ts` requires the `/p/[publicationId]` root in the module graph, so deleting the route would void the plugin, the visitor isolation tests and the API publication end-to-end tests rather than prune dead code. |
| P22 authored-snapshot reader (the snapshot → runtime path inside the cold runtime) and the API publication snapshot format | **RETIRE AT T4** prepared-reader cutover | Made strict in WP3. The concrete dependency is F5.release-envelope plus T4.prepared-reader, which replaces the reader atomically. Deleting it in #115 gains no capability and removes the only delivery path until then. |
| `project-persistence.ts` and its asset helpers | **RETAIN AS FOUNDATION** (relocate to `lib/platform/`) | The entry and hub routes consume it. **REFACTOR LATER at T3**, which adds expected-revision acceptance (F.4). |
| `publication-client.ts`, `publication-presentation.ts`, `import/package-importer`, `export/package-exporter`, `project-asset-upload/load`, `register-verified-project-asset` | **REMOVE IN #115** | No consumer remains. The server API, `project-model` package-format codec and server tests are retained. T4 rebuilds publication UI against the prepared reader. T2 rebuilds ingest and resource staging. |
| `lib/bench/**`, `/dev/perf*`, `bench:record`/`reuse:record` scripts, PERF lane, P23B measurement/attribution/budget/ratchet/containment tests and fixture ledger/ratchet JSONs | **REMOVE IN #115** | Owner statement: the purpose is fulfilled. Kernel correctness tests that used bench fixtures survive with relocated fixtures (§7). TD-4 and TD-5 retire with their implementation (§8.6). |
| `layout-core` canonical compiler, topology/noding/faces, Junction resolution/identity, curve algebra, Room reconciliation, snap/align/duplicate/room-move/dissolve planners | **RETAIN AS FOUNDATION**; **REFACTOR LATER at T1** semantic cutovers | Unchanged in #115 apart from §6 deletions. Derived Wall roles, circular enclosure, levels and structures are T1. |
| `layout-core` legacy generation: `layout-compat`, `layout-migration`, `layout-migration-math` | **REMOVE IN #115** (§6) | Consumed only through `index.ts`. There are no data obligations. |
| `layout-core` legacy floors/rooms types, `layout-codec`, `layout-room-frame`, legacy `compileLayoutGeometry` adapter, `layout-portals`/`room-isolation` legacy uses | **RETIRE AT T1's first Layout schema cutover** | The concrete dependency is that `layout-types.ts` and `layout-codec.ts` host definitions consumed by 37 and 9 wall-first modules. Separating them *is* the authored-schema redesign that T1 owns (Wall roles and levels). Doing it in #115 would be a premature schema rewrite. After WP3 they are reachable only from wall-first internals and tests, never from a project/API/runtime reader. |
| `project-model` legacy chain: `project-compat`, `compat-runtime` (→ strict `prepareRuntime`), `scene-world-conversion`, `standalone-scene-import`, legacy room-local Scene decoder branch, legacy `createEmptyProject` | **REMOVE IN #115** (§6) | Separable. There are no data obligations. |
| `project-model` Scene types/codec/validation (world-local), world transforms | **RETAIN AS FOUNDATION**; **REFACTOR LATER at T2** (Scene unit) and **T3** (Camera extraction) | Strict entity/material/light validation. |
| Scene/Camera editorial order fields; `camera-core` main-flow/node-order orchestration | **RETIRE AT T3** camera-experience cutover | The concrete dependency is that the retained visitor guided runtime consumes order, and Experience order is its successor representation. The new product has no writer for these fields after #115. |
| `camera-core` route/motion/framing evaluation | **RETAIN AS FOUNDATION** | One Camera authority. The mechanism stays replaceable. |
| `packages/{scroll-travel,note-cursor,portfolio-hud,portfolio-content,audio-plink}` | **REMOVE IN #115** | Zero consumers. AGENTS rule 7's "scroll-travel unused" clause is deleted. |
| `apps/api` | **RETAIN AS FOUNDATION**; **REFACTOR LATER at T3/T4** | No platform rewrite. Expected-revision Save is T3. Prepared release is T4. |
| `apps/museum` | **REMOVE IN #115** | Superseded by the standalone frozen project, which is built from the code production serves (§3.5). |

EVIDENCE-PATHS: end

A deferred row is valid only because it names its concrete capability dependency. "Later cleanup" is never valid.

### 5.2 Manifest expansion and dependency changes

WP0 expands §5.1 into a **per-file source manifest** in `acceptance.md`, with columns old path, class, new path, baseline blob hash and rule. It uses the committed import-closure helper (§12 WP0), the same way the docs manifest works. Every tracked file under `apps/editor/src`, `apps/editor/vite`, `apps/editor/scripts`, `apps/museum`, `packages/*` and the `apps/editor/static`/`assets-source` trees receives exactly one action. Unmatched or overlapping rules fail.

**Package, manifest and build changes:**

- **Root `package.json`:** remove `dev:museum`/`build:museum` and the museum half of `build`/`check`. The root does not build or test `legacy/`. Keep `check:{camera,layout,project}-core` scripts and API scripts. Remove `test:perf`.
- **`apps/editor/package.json`:** remove the `@portfolio/scroll-travel` dependency and the `bench:record`/`reuse:record`/`test:perf` scripts. Remove `lucide-svelte`, `fflate` and `@fontsource-variable/inter`: no retained product module uses them (checked against the §4.1 closure), and the frozen project declares its own copies. Remove `@gltf-transform/cli` **only if** no retained asset tooling uses it (`normalize-asset` tests and the asset normalizer must be checked first; default: keep).
- **`apps/editor/vite.config.ts`:** remove `museumEditorEntryPlugin`. Drop `optimizeDeps` entries only when they become unresolvable. `vercel.json` and `scripts/inject-vercel-api-proxy.mjs` are unchanged (§3.4). **`legacy/chopin-museum/`** has its own manifest and lockfile, created with `npm install` inside the folder, with versions pinned to the baseline lockfile.
- **`vitest` configs and `test-lanes.ts`:** remove the PERF lane and its config. Update ARCH and HEAVY membership (§7.3).
- **`package-lock.json`:** regenerate only through `npm install` after workspace removal. Allow no dependency version bumps. The lockfile diff must contain only the removed workspaces and their removed dependencies.
- **`vercel.json` and `inject-vercel-api-proxy.mjs`:** unchanged.

## 6. Legacy-generation acceptance retirement (WP3)

**Precondition:** WP1 (frozen project verified on its own) and WP2 (old editor removed). These remove every new-product consumer of legacy payloads.

1. `project-model`:
   - `validateProject`, `parseProjectJson`, `createProject` and `serializeProject` accept only wall-first Layout (format 5) with world-local Scene (`formatVersion: 1`). A legacy payload rejects with a named `unsupported_generation` issue.
   - `prepareCompatibleRuntime` becomes `prepareRuntime` (wall-first only).
   - Delete `project-compat`, `scene-world-conversion`, `standalone-scene-import`, the legacy Scene decoder branch and legacy `createEmptyProject`.
   - `resolveSceneDocument` loses the Room-registry parameter wherever it exists only for room-local resolution.
2. `layout-core`: delete `layout-compat`, `layout-migration` and `layout-migration-math` and their index exports.
3. Callers: visitor cold runtime, API Save/Load/publication, and retained `authoring/scene/plan-scene-footprint` (drop its legacy room-frame branch).
   - Add a DB-free case to `apps/api/tests/api.test.mjs` (fakes, like its existing project body validation cases): a legacy-generation project body is rejected on Save with the named `unsupported_generation` issue, and the matching kernel test asserts the same in `project-model`.
4. **Stop rule:** if removing an item requires designing new semantics rather than deleting a branch or parameter, stop that item. Record it in `acceptance.md` as a §5.1 "RETIRE AT T1/T2" row with the exact blocker. Do not invent a replacement.
5. Tests follow §7.2 category D.

## 7. Test disposition and verification

### 7.1 Principles

- Tests are classified by the guarantee they protect, not by location.
- A test **deleted with its subject** needs no successor. Its subject is gone, and the capability-loss list (§4.4) records the absence.
- An **extracted or replacement** assertion follows the existing successor rules in [`tests/README.md`](../../../apps/editor/tests/README.md#successors-and-deletion): same-defect proof, call-site proof where wiring matters, mutation evidence.
- **No `skip`, no `todo`, no expected-failure markers, no snapshot regeneration without a recorded semantic reason, and no fixture deletion when the fixture still protects a retained kernel.**

### 7.2 Matrix

| Category | Members at baseline (by import evidence) | Action |
| --- | --- | --- |
| **A. Kernel/foundation invariants** | `layout-core`-only tests (topology, noding, Junction, curve, dissolve, precision, identity, snap/align, reconciliation, angled/sweeps, watertight, scale compile), `project-model` tests (boundary, package-format, package-sha, codec/writer gates), `camera-core` tests (route, motion, dense sweeps, boundary), generic renderer/material/texture tests, `wall-mesh-builder`, `wall-geometry-adapter`, content catalogue/provenance/normalize/footprint/texture-uri, visitor tests, vite boundary plugin tests, `docs/documentation-references`, API e2e test-auth | **KEEP.** Re-point any `$lib/layout/*` facade import to `@portfolio/layout-core` (mechanical). |
| **A′. Kernel invariants that use Chopin content as a convenient fixture** (for example `camera-route`, `layout-geometry`, `layout-portals`, `shared-walls`, `layout-g2-fixtures`, `scene-codec`, `scene-instance-material`, `visitor-cold-runtime`/`public-route` fixtures) | **EXTRACT.** If the assertion is about the frozen product (Chopin geometry golden, Chopin route graph), move it to category B against the frozen copy. If it is about the kernel, switch to an existing wall-first/world-local fixture and keep the expectations identical. If the expectations would change, stop and classify; never regenerate to fit. |
| **A″. Kernel correctness tests that consume bench/P23B fixtures** (`p23b4-*` differential/reference, `p23b11-correspondence-*`, `p23b8-d5-identity-falsifier`, `p23b8-p1-randomized-differential`, `p23b7-affected-extent`, `layout-snap-extent-parity`, `layout-p23b3a-*`) | **KEEP the output-equivalence and identity assertions.** Move the minimal fixture generators from `lib/bench` into `tests/lib/layout/__fixtures__/`. **DELETE** measurement, observation-count, budget and timing assertions inside them. |
| **B. Frozen-project guarantees** | `relic-smoke`, `paris-activation`, `state/runtime-state`, `content/chopin-*`, `rooms`, `rooms-to-layout`, `museum/visitor-import-boundary` (museum-shell direction part), theme/app.html sync, Chopin-specific goldens from A′ | **RELOCATE** into `legacy/chopin-museum/tests/`, byte-identical apart from import roots and running under that project's own vitest config. The executor records any test-harness adaptation. Delete the obsolete "shared-store drift" and "live shell isolation" clauses: there is no shared store anymore, and the freeze test replaces them (§7.4). Shared-store tests in `editor/**` that construct a relic store or render relic-mounted components are re-pointed. The executor greps for relic construction and records each verdict. All other editor-store tests are category C. |
| **C. Obsolete shell/workspace/presentation/history/compatibility** | ≈220 `tests/lib/editor/**` files (app, store, camera-plan, gizmo, context-menu, hierarchy, styles/theme, layout gesture/transient/history/preview, camera timeline/labels/preview, editor-store*, shell-* and preview-* tests, `tmp-confirm-gizmo-pointer-pipeline`), the `tests/lib/layout/plan-*` presentation tests, `plan-render-*`, the bench tests, the PERF lane, `p23b6/7` editor retention/reactivity tests, `project-compat`, `scene-world-conversion`, `layout-migration*`, `layout-codec`/`layout-room-frame` *legacy-acceptance* assertions (WP3), editor/visitor `layout-geometry-parity`, `editor-entry-boundary`, `editor-gizmo-boundary`, `editor-store-bind-migration`, and the editor parts of the `project-format-*` and `p23-f0-stage5` tests | **DELETE with their subjects.** Tests of retained §4.3 modules stay and move with them. |
| **D. Entangled tests** | Layout tests importing shared editor modules only as a fixture builder (`layout-drafting`, `-duplicate`, `-openings`, `-presets`, `-room-lifecycle`, `-wall-delete`, `-wall-selection`, `-curve-integration`, `-dissolve-integration`, `layout-snap`), and `project-format-writers`/`-writer-fixtures`/`-visitor-parity` | **EXTRACT** assertions on `layout-core`/`project-model` output into kernel-level tests calling the core API directly, using the same fixtures and expectations. **DELETE** editor-wiring assertions. Writer-gate assertions remain against `serializeProject`. |

**Successor obligations created by deletion** (recorded in the T1/T2/T3 planning evidence, not in tests):

- editor/visitor mesh parity, re-established at the first editor Stage renderer;
- the Layout mutation call-site (M1) and project-replacement guard (M5), re-armed at their first new wiring;
- the atomic group/duplicate validation and history semantics previously proven by `history-controller`, `document-store` and `mutation-guards` (no-op, rollback, cap), which become T3 F.4 acceptance criteria;
- TD-2's numeric-field `:invalid` defect, which must not recur in the PLATE number field.

### 7.3 Lanes and the arch list

- **ARCH_FILES:** keep the visitor/public/preview isolation tests, camera-core/plan-free boundary checks, `project-model-boundary`, `layout-geometry-boundary`, `wall-mesh-shell-boundary` and `documentation-references`.
- Remove the entries whose subject is deleted: `plan-render-boundary`, `bench-boundary`, `editor-entry-boundary`, `editor-gizmo-boundary`, `editor-store-bind-migration`, the editor `project-format-*` entries and `p23-f0-stage5`.
- Add:
  - `tests/lib/legacy-isolation.test.ts`: no product file imports, aliases or references `legacy/`; it passes unchanged after the folder is deleted;
  - (The relocated `relic-smoke` and the freeze test live in the frozen project's own suite, not in ARCH_FILES.)
  - `tests/docs/parallel-track-gates.test.ts` (§9).
- HEAVY loses its P23B and editor retention files and keeps the dense kernel sweeps and normalize-asset.
- The lane union/disjointness tests stay green, and the arch lane remains unconditional.

### 7.4 Post-prune verification contract

All of these must pass, with no expected failures:

```sh
npm run test:arch
npm test
npm run check
npm run build
npm run check:layout-core && npm run check:project-model && npm run check:camera-core
npm run check:api && npm run test:api        # project-model reader behavior changed; DB-backed and zero skips required (§7.5)
git diff --check
```

**Frozen-project acceptance** (at Checkpoint A and at final acceptance): inside `legacy/chopin-museum/`, `npm ci && npm test && npm run check && npm run build` pass. Then `npm run preview` with a browser check (browser-hygiene skill, smallest owned session):

- `/museum` loads Chopin, guided navigation advances, and the HUD works;
- `/museum/editor` mounts, Paris focus works, placement arms and cancels, the tour selector and mini-player transport preview a path, and the Layout workspace is refused;
- no new console errors appear compared with the same steps at the baseline.

Also load `/`, `/projects` and `/project/x/spatial`: no console errors, and the notice renders.

**Regression vs intentional loss:**

- A failure in A, A′, A″, B, the build, the type check or the frozen-project acceptance steps is an **unanticipated regression** and blocks acceptance.
- A missing capability listed in §4.4 is **intentional**. It is never represented by a failing or skipped test.

### 7.5 API execution requirement

`apps/api/tests/publication.test.mjs` and `test-auth.test.mjs` call `t.skip(...)` when Postgres is unreachable, so `test:api` can look green while the publication and auth paths never ran. WP3 changes those readers, so:

- WP3 (Checkpoint C) and final acceptance need `check:api` and `test:api` run with a reachable Postgres (`DATABASE_URL`), with the TAP summary showing **zero skipped tests**. The run's skip count and the DB target type (local or CI) are recorded in `acceptance.md`.
- The DB-free `api.test.mjs` legacy-rejection case (§6) runs in every environment.
- If Postgres is unavailable, WP3 is **blocked**, not accepted. `acceptance.md` lists the DB-backed tests that did not run as "unexecuted", separately from the passing ones. Proceeding without them needs an explicit owner ruling recorded there.

## 8. Documentation pruning manifest

This section is complete for execution. Earlier revisions are only provenance; Git holds them.

### 8.1 Applying the manifest safely

- **Ordering:** this is an ordered, baseline-specific manifest. Exact-file and protected-family rules override prefix defaults, and later rows never re-classify a file that an earlier exact row already classified.
- **Scope:** it applies only to tracked baseline files. Untracked work, ignored local artifacts and files added after the baseline get a small delta disposition recorded in WP0.
- **DELETE remainder** covers directory READMEs, redirect stubs, research prompts and redundant status text, and leaves no empty directory.
- **Expansion (WP0):** expand the rules into a per-file manifest in `acceptance.md` with old path, action, new path, baseline blob hash, owner of any consolidated content and rationale. Every baseline docs file gets exactly one action; unmatched or overlapping rules fail the expansion.
- **Recovery:** DELETE relies on the immutable baseline commit (`git show <baseline>:<path>`). No replacement stubs are created.
- **Moves:** a moved bundle keeps its internal relative layout, byte-identical non-text assets and working render/serve dependencies.
- **Totals:** WP0 computes and records the action totals. Earlier revisions' totals are void. Totals are reproducibility checks, not quotas.
- **Compaction:** aggressive pruning replaces the old "compact every closed prose file into a stub" default for this batch only. Future slices use slice-closeout's proportional preservation.
- **Protected material:** protected prototype plans and QA are exempt from deletion and compaction. Existing recovery anchors are preserved when a closed plan moves, and the exact full-body recovery command is re-verified.
- **Consolidation is semantic extraction, not re-ratification.** Inspect source only for a claim that is missing, ambiguous or contradicted.
- **Preservation invariant:** an unresolved obligation cannot disappear with its document. The expanded manifest records its surviving owner or anchor. A newly found concrete obligation gets a narrow manifest amendment, not a broad reconciliation.

### 8.2 Live authorities and reference contracts

| Existing file or prefix | Action / reason |
| --- | --- |
| `docs/README.md`, `AGENTS.md`, `README.md` | **RETAIN + rewrite routing** (§10). AGENTS gains the one-line `legacy/` scope rule (§3.6), drops the `scroll-travel` clause, gets the new routes and keeps its hard invariants. Rules 4 and 6 are unchanged. |
| `reference/architecture.md`, `north-star.md`, `composition-execution.md`, both `decisions/*` | **RETAIN.** In `architecture.md`, rewrite "Two isolated lanes" and "Product routes" per §4.2, plus the one plain-text sentence about the separate frozen project (§3.4 rule 3). Decision records stay immutable; their old planning links become labeled provenance (`git show <baseline>:<old-path>`) per §10.3. |
| `reference/components/shell.md`, `theme.md` | **DELETE.** Their landed subject is removed. The frozen relic's facts belong in the frozen project's own README, and PLATE owns the destination. |
| `reference/components/placement.md` | **CONSOLIDATE then DELETE.** Kernel-level Scene transform-validation facts go into `scene-content.md`. TD-1 acceptance obligations and the scalar-vs-independent-scale fidelity note go into T2 planning evidence. |
| `reference/components/camera-tour.md` | **RETAIN + rewrite** to describe the `camera-core` kernel, the graph-vs-order distinction (until T3), generated-vs-authored anchors and the visitor guided runtime. Remove editor timeline, Camera Plan and authoring descriptions. |
| `reference/components/persistence.md` | **RETAIN + update:** strict generation, removed facades, history section removed (F.4 is the destination). Scope the statement that `chopin-project.json` is "the sole production project source" to the frozen project, and note that product cloud/guest projects are independent. |
| `reference/components/scene-codec.md`, `scene-content.md`, `assets.md` | **RETAIN + update:** strict generation, removed facades, actual paths instead of `apps/museum`. `assets.md` first absorbs any missing normalization/rights/provenance checklist facts from archive `ASSET_WORKFLOW.md`. |
| ★ `legacy/chopin-museum/README.md` | **NEW, inside the frozen folder.** The §3.3 contract, `FREEZE.json` semantics, change policy, routes, dependencies, commands and deployment guidance. It references only files inside its folder, and no product doc links to it (§3.4). |
| `reference/design-system/editor-shell-and-visual-system.md`, `spatial-instrument-grammar.md` | **RETAIN.** Repair evidence links only. Do not reopen acceptance. |
| `reference/design-system/editor-shell-atlas/**` | **ARCHIVE/MOVE the whole bundle** to `docs/archive/technical/editor-shell/atlas/`, keeping working HTML assets. It is landed role/state specimens, not a fallback design spec. |
| `reference/design-system/editor-shell-ratifications.md` | **ARCHIVE/MOVE** to target docs/archive/technical/editor-shell/ratifications.md, after checking that its R1–R4 role/state and one-writer outcomes are represented in PLATE. |
| `design-shell-specs.md`, `shell-scene-workspaces.md`, `shell-camera-workspaces.md`, `camera-flow-specs.md`, `camera-layout-design.md`, and every other baseline file under `reference/design-system/` | **DELETE.** Their implementation is removed. Current Camera kernel facts (graph vs order, timing/framing guards, X/Z projection boundary) are checked against the rewritten `camera-tour.md` and folded in only if missing. If the retained atlas needs an external asset, move that exact asset into the atlas bundle instead. |
| `docs/North-star-final-decision-synthesis.md`, `North-star-final-synthesis-peer-review.md`, `World-Experience-Architecture-Synthesis.md`, `World-Experience-Model.md` | **DELETE after a promotion-coverage check:** every conclusion must already be in the ratified amendment, F, North Star or `architecture.md`. Any unpromoted owner obligation moves to its owning contract or track evidence first; proposals are not promoted. |
| `README.original.md` | **DELETE**, and repair incoming routes. |
| `apps/editor/src/lib/editor/README.md`, `DEBUGGING.md` | **DELETE** with the directory. The new short `src/lib/authoring/README.md` (★) states the §4.3 retention criteria. |

### 8.3 Protected prototype family: exact moves

All prototypes are retained as functional and design evidence:

- Conservatory, Paper and World are accepted references.
- Donor/Integrated Experience, the World shell round and UX3/V3 are the comparison chain used by #111–#114.
- Object Composition is unique assembly/reach/repair research.

Each prototype README identifies its accepted, superseded or unratified role and links to PLATE and F. No prototype becomes a workspace or production dependency.

The design and QA files below still sit under P-level roadmap folders and move into prototype evidence homes:

- `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/**` moves whole to `prototypes/spatial-authoring/design/visual-system-refinement/`. That includes the specification plan, paper-surface brief, QA scripts, acceptance, contrast evidence and transition capture assets.
- `docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md` → target prototypes/spatial-authoring/plans/world-authoring-prototype.md. Keep the accepted plan, its recovery route and the #112 acceptance routes.
- `docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md` → target prototypes/paper-authoring-commission/plans/inactive-adoption-plan.md. Keep PA0–PA12 and the keymap evidence, under a banner: "inactive, unimplemented; no current authorization".
- `docs/roadmap/p25-experience/design/experience-v2-prototype/{implementation-plan,conformance-plan,authoring-completeness-plan}.md` move, keeping their filenames, to `prototypes/spatial-authoring/plans/experience-v2-prototype/`. Keep the #113 S0–S9/C1–C9 recovery anchors and the MP1–MP4 acceptance boundary.
- `docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md` → target prototypes/spatial-authoring/plans/unified-design-reconciliation/implementation-plan.md. Keep the #114 closed plan, its full-body recovery and its acceptance scope.
- `docs/roadmap/p25-experience/design/experience-ux-v3/**` moves whole (six files) to `prototypes/experience-ux-v3/design/`, labeled inactive. A matching generated PNG is not acceptance.
- `docs/operations/checkpoints/experience-v2-conformance-evidence/**` moves whole to `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/`, including the failed-run logs that qualify acceptance.
- `docs/archive/roadmap/p25-experience/p25-unified-design/{p23b-browser-report,p23b-validation-result}.json` stay **byte-identical in place** as accepted UX comparator evidence. They are the only files left in that old tree.

In protected text, only these may change: links, how recovery paths are interpreted, historical-role banners and the locators of relocatable QA scripts. Hashes are recorded before and after, and every text change needs a reviewed mechanical reason.

Moved QA launchers keep their working-directory and filename assumptions, verified by a non-browser dry run. No prototype suites are rerun and no captures are rewritten. Production pruning cannot reach prototypes, because they import no production code (§2.2). No old P25/P26 stub tree remains.

### 8.4 Retired P24/P25/P26 planning and unique evidence

| Baseline source / rule | Action and destination |
| --- | --- |
| P24 `research/deep-research-P24-3D-editing-compact.md`, `deep-research-assets-compact.md`, `deep-research-exact-asset-compact.md`, `Pascal-editor-harvest.md`, `three-r175-r186-museum-harvest.md`, `museum-editor-phase2-acquisition-manifest.json` | **ARCHIVE/MOVE** these six files, keeping their relative layout, to `docs/archive/technical/composition/`. No version or support claim is inferred from them. **DELETE** `Pascal-editor-harvest-brief.md`. |
| P24 R3/R4/R5–R7/R8/R9 reconciliation files, umbrella, P24A annex, reconciliation sequence, minimum child briefs, P24 README | **CONSOLIDATE** the surviving obligations into T2 planning evidence, then **DELETE**. The frozen minimum, corpus quotas, static-only scope and phase dependencies are retired. |
| P25 `research/P25-research-compact.md` | **ARCHIVE/MOVE** to `docs/archive/technical/experience/` with its provenance and old-model caveat. Extract current accessibility and repeated-occurrence findings to T3 evidence. |
| P25 `deep-research-P25.md`, `deep-research-report-P25-full.md`, `prompt-phase-5.md`, umbrella, README | **DELETE** after consolidation and after the §8.3 moves. |
| P26 `research/broad/deep-research-P26-phase-1-compact.md` and both `research/harvests/*` | **ARCHIVE/MOVE**, keeping the broad/harvests layout, to `docs/archive/technical/spatial/`. They contain unique spatial findings and the FreeCAD/Bonsai source inspection. **DELETE** the broad full report. |
| P26 continuous-spatial-authoring umbrella | **CONSOLIDATE** its obligations and open choices into T1 evidence, then **ARCHIVE/MOVE** it to target docs/archive/technical/spatial/continuous-spatial-authoring-umbrella.md. Its D1–D8 and ceiling/periodic proofs are valuable; its order and architecture proposals are not current plans. |
| P26 `research/synthesis/p26-architectural-spatial-depth-synthesis.md` | **CONSOLIDATE** its independent domain findings into T1 evidence, then **DELETE**. |
| All other P24/P25/P26 files, including phase READMEs, the designer brief and the Final-Design-Prototype redirect | **DELETE** after the protected moves and consolidation. No P-level route or stub remains. |
| `docs/roadmap/backlog/2026-08-27-P13-stop-at-node-playback.md`, `2026-08-21-branch-rejoin-experiment.md` | **CONSOLIDATE** into a short unscheduled-proposals paragraph in the global roadmap, then **DELETE**. T3 may assess pause-at-next-occurrence; branch rejoin stays unscheduled. |
| `docs/roadmap/f-foundation-contracts/design/proposals/2026-09-27-biskiq-durable-design-commissions.md` | **DELETE** after checking its scenarios against protected prototypes and the North Star. It is a non-authoritative proposal. |
| `docs/roadmap/model-assessment.md` | **DELETE**, and remove the global META/MODEL routes. |

**Planning-evidence contents.** Each file is written as evidence and obligations, not as an implementation plan.

- **T1 (`t1-spatial-world/planning-evidence.md`):**
  - World A–F/Conservatory/Paper division of evidence;
  - circular enclosure needs a single self-connected, continuously curved Wall;
  - head-fixed arch rise and independent overhead-region intent, without asserting an encoding;
  - typed cut/projected/hidden representation streams with source correspondence;
  - hosted Opening identity;
  - source identity through Section/peel;
  - finite depth affects geometry and membership;
  - nested Look/return kept separate from document Undo;
  - focused mechanisms carried forward: D2 datum/closure/coverage, D3 fit/gap, D5 seam/ambiguous inverse/refusal, D6 invalidated return/undo suffix;
  - D1 superseded by the seam gate, D4 under prune-first, D7 under PLATE, D8 already accepted;
  - the later Wall-role ruling and its two open decisions;
  - slab/ceiling ownership kept open where F names an open mechanism;
  - the §7.2 successor obligations: mesh parity, M1/M5 re-arming, and the Plan-representation invariant;
  - TD-2 non-recurrence;
  - TD-5's lesson: do not deep-proxy compiled geometry;
  - routes to `lib/authoring/{layout,a11y}`;
  - the legacy Layout types/codec retirement row (§5.1).
- **T2 (`t2-composition/planning-evidence.md`):**
  - one semantic Scene placement with view-specific projection;
  - derived footprint, X/Z/yaw input and support-owned Y;
  - transient support consultation is not host attachment;
  - view-independent selection and explicit ineligibility;
  - gestures cancel at real transitions;
  - a preview candidate equals its commit;
  - one acceptance/history result;
  - mutations follow entity authority;
  - TD-1's acceptance tests, verbatim;
  - atomic group/duplicate validation;
  - positive/uniform vs independent scale;
  - material/light semantic gaps;
  - static-model source drift;
  - truthful ingest/provenance/resource locking;
  - single-model import belongs in the first trial loop;
  - no renderer/library upgrade is implied;
  - ingest/resource staging must be rebuilt;
  - routes to `lib/authoring/scene`.
- **T3 (`t3-experience/planning-evidence.md`):**
  - repeated Stop/Presentation/visit distinction;
  - collection-capable Experience with no "Destination" duplicate;
  - Camera geometry and timing stay intrinsic, while order, holds, continuation and Gates move to Experience in one simultaneous Camera/F.4 cutover;
  - DOM companion navigation, keyboard and focus return, captions/transcripts, media activation constraints, a reduced-motion endpoint and Preview/public parity;
  - history/acceptance invariants from deleted tests (one logical result, no-op, rollback, cap);
  - expected-revision Save;
  - placement of the Camera authoring math (`lib/authoring/camera`);
  - the order-field retirement row.
- **T4:** no separate evidence file. The T4 README states:
  - the strict snapshot reader is the current delivery path (§5.1);
  - the prepared-reader obligation;
  - verifiable provenance and closed resources;
  - per-Experience pointers;
  - the covered-data ledger is empty by owner statement;
  - publication UI and import/export are removed.

### 8.5 Closed P23/P23B, operations and archive

| Baseline prefix / exception | Action |
| --- | --- |
| `docs/roadmap/p23-layout-depth/` README; `2026-09-09-P23.0-wall-first-foundation-migration.md`; `2026-09-09-P23.8-wall-topology-room-regions.md`; `2026-09-14-P23.11-canonical-curved-walls-and-render-safe-validation.md`; `2026-09-17-P23-junction-dissolve-wall-join.md` | **ARCHIVE/MOVE**, keeping relative paths, to `docs/archive/technical/p23/`. They hold closure provenance, format cutover, Room lineage, curve validation and dissolve invariants. |
| P23 `p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md`; `p23.15-junction-correct-wall-first-3d/**`; `p23.16-whole-product-integration-closeout/**`; `2026-09-08-P23.16-final-whole-product-integration-closeout.md` | **ARCHIVE/MOVE**, keeping relative layout, to `docs/archive/technical/p23/`. They hold final gates, watertight research and TD-2's origin. |
| All other `p23-layout-depth/**` | **DELETE.** |
| P23B `fixture-ledger.json`, `reuse-counter-ratchet.json` | **DELETE.** Their only consumers are bench tests, which are removed under the owner statement. WP2 proves no retained test or recorder imports them. |
| P23B README; `p23b.3…/2026-09-22-P23B.3-curved-crossing-owner-decision.md`; `p23b.9` correctness/performance gate record; `p23b.10` phase closeout | **ARCHIVE/MOVE** to `docs/archive/technical/p23b/`, keeping the closure provenance and the algorithm decision. |
| All other P23B files | **DELETE.** The benchmark's purpose is fulfilled. Any unreconciled *correctness* debt moves into tech-debt first; perf debt does not. |
| `operations/current.md`, `checkpoints/README.md` | **RETAIN + rewrite** (§10). |
| `operations/tech-debt/README.md` | **RETAIN + update** (§8.6). |
| `operations/test-suite-harvest-2026-09-19.{md,csv}` | **DELETE.** It describes a test tree that #115 restructures; current doctrine lives in `tests/README`. |
| `operations/architecture-cycle.md` | **CONSOLIDATE** the live state and the operative protocol here (§11). |
| `roadmap/architecture-operating-cycle-plan.md` | **CONSOLIDATE** its operative rules into `architecture-cycle.md`, then **ARCHIVE/MOVE** to target docs/archive/technical/architecture-cycle/operating-cycle-plan.md. |
| `roadmap/architecture-operating-cycle/phase-0/**`, `phase-1/**` | **ARCHIVE/MOVE** the whole nine-file bundle to `docs/archive/technical/architecture-cycle/`, keeping the phase-0/phase-1 layout. Frozen reviews are not rewritten. |
| `roadmap/architecture-operating-cycle-workflow-harvest.md` | **DELETE** after consolidation. |
| Baseline `docs/archive/**` | **DELETE by default**, with three exceptions: `archive/README.md` is rewritten as a small opt-in map plus Git recovery rules; the two p25 comparator JSONs (§8.3) are kept; and `roadmap/p23/foundation-research/P23-H3-robust-geometry.md` and `P23-H5-room-identity-migration.md` are kept in place. This default covers only the baseline archive, never newly moved technical evidence. |

### 8.6 Tech-debt dispositions caused by code removal

- **TD-1:** close as **implementation removed**, not fixed. The defective placement/Camera Plan wiring is deleted, and the Room-registry dependency leaves the product reader path in WP3. Its "then add" acceptance tests transfer verbatim to T2 evidence.
- **TD-2:** close as implementation removed. The non-recurrence criterion goes to T1 evidence.
- **TD-3:** already fixed. Compact it to one line plus its anchor.
- **TD-4 and TD-5:** close as retired with the benchmark. TD-5's lesson goes to T1 evidence.

None of these is ever recorded as "fixed".

## 9. Track → Phase → Slice system and gates

### 9.1 Target structure created by WP5

Paths are targets. #115 adds no other planning hierarchy.

```text
docs/roadmap/
  README.md                               track register + gate register (§9.4) + accepted basis + unscheduled backlog
  parallel-track-cutover/README.md        R115 repository phase; sole child and final gate R115.S01
  parallel-track-cutover/implementation-plan.md   this plan
  parallel-track-cutover/acceptance.md    #115 manifests, evidence, closeout
  f-foundation-contracts/README.md         F amendment routing; links to the gate register; no second F spec
  t1-spatial-world/{README.md, planning-evidence.md}
  t2-composition/{README.md, planning-evidence.md}
  t3-experience/{README.md, planning-evidence.md}
  t4-release/README.md
  <track>/<phase-id>-<capability>/README.md, implementation-plan.md,
        <slice-id>-<purpose>/{implementation-plan.md, acceptance.md}   (created later by authorized planning)
docs/operations/
  README.md                               event-only: track-completion, product-integration-acceptance, bounded-replanning
  current.md                              one global baton; may list several active units
  t1-spatial-world/README.md … t4-release/README.md   operational runbooks (no copied status)
  architecture-cycle.md                   sole cycle state + protocol (§11)
  tech-debt/README.md, checkpoints/README.md
apps/editor/tests/helpers/markdown-tables.ts
apps/editor/tests/docs/parallel-track-gates.test.ts
.agents/skills/slice-closeout/references/preservation.md
```

IDs are qualified:

- tracks: `T1`;
- phases: `T1.P01`;
- slices: `T1.P01.S01`;
- directory slugs: `t1.p01-<capability>/t1.p01.s01-<purpose>/`.

Numbers are stable identity, not execution order. R115 is a single non-capability repository phase registered directly in the global roadmap, not a fifth track. WP0–WP7 are the ordered packages of its sole child, R115.S01.

### 9.2 One writable owner per concern

| Concern | Sole owner | What others may do |
| --- | --- | --- |
| Product destination and design requirements | Concern-specific reference contracts and ratified decisions | Link to them. Prototypes state their own acceptance boundary. |
| F semantics and exact interfaces | `composition-execution.md` plus explicit ratified amendments | The gate register records implementation and evidence identity only. |
| Track lifecycle, gate register, product-gate registration, future work | `roadmap/README.md` | Track READMEs do not copy their own status. |
| Track objectives, phase register and dependencies | Track roadmap README | Phase READMEs route to it and do not mirror its enum. |
| Phase scope, slice register, FINAL PHASE GATE, PHASE CLOSE | Phase README | Slice plans and evidence route here. |
| Current assignments | `operations/current.md` | Track runbooks link the baton and never name NEXT. |
| Operational procedure | Track runbook | No competing plan or debt ledger. |
| Slice scope and criteria | Slice implementation plan | Review rewrites the owning sections; there is no review diary. |
| Recorded outcomes | Slice `acceptance.md` | Others point to the exact record and do not copy test counts. |
| Deferred defects, cycle state, interruptions | `tech-debt/`, `architecture-cycle.md`, `checkpoints/` | Others route to them. |

### 9.3 Status grammar and completion events

**Canonical tables** (owned rows, never generated mirrors), parsed by `markdown-tables.ts`:

```text
global roadmap — Track register: Track | Status | Roadmap
global roadmap — Gate register: see §9.4
track README  — Phase register: Phase | Status | Depends on | Workspace
phase README  — Slice register: Slice | Status | Consumes | Plan | Acceptance | Authorization
phase README  — FINAL PHASE GATE: <slice-id> → <exact gate artifact>
phase README  — PHASE CLOSE: Stage (active | closable | closed); Closed (owner, date, evidence); Final gate; Preservation
```

**Status vocabularies:**

- Track and phase rows use `proposed | planning | approved | in-progress | shipped | archived`. A shipped track also needs a TRACK COMPLETE owner/evidence block on its global row.
- Slice rows add `accepted`, meaning review and acceptance are recorded but closeout is still owed, before `shipped`, meaning routine closeout is complete.
- A status row never fabricates a merge.

**Completion events.** Each is distinct, and none implies a broader one.

| Event | Entry and authority | Consequence; what it does not imply |
| --- | --- | --- |
| Slice acceptance → routine closeout | A recorded independent review/acceptance, then slice-closeout | The phase child row, durable promotion, real gate readiness and the baton are updated. The final child sets the phase `closable`. No second review, and no phase or track close. |
| Phase closure | Explicit owner invocation, then phase-closeout | The final gate, integration and residuals are verified, and PHASE CLOSE plus the track's phase row are written. No track, product or cycle closure follows. |
| Track completion | Explicit owner request against the approved bounded objectives | Objective evidence, required phase closures and residual transfers are verified, and TRACK COMPLETE is written. Domain code, contracts, gates and regressions are kept. |
| Product integration acceptance | An approved integration plan plus its recorded acceptance | Only that gate and version are accepted. Contributing phases and tracks are not closed, and no Baseline is declared. |

The routine slice sequence is implementation → review → acceptance → closeout → merge, using recorded acceptance without re-running gates just to close. A substantive change introduced at closeout reopens only the affected review.

**Convergence and replanning:**

- A concrete, owner-authorized product goal writes one integration plan under `docs/roadmap/integration/<gate-id>/` only when needed. If a phase's integrated gate already supplies the proof, that gate is routed instead.
- Replanning happens only on a new product goal, an approved completion handoff or an orphaned obligation. The owner authorizes changed objectives, new tracks or transferred obligations.
- Accepted gate identities stay stable.
- These procedures live only in the event sections of `operations/README.md`.

### 9.4 Exact-interface gates: the smallest enforceable system

**Rationale for the simplification.** An earlier draft proposed a JSON register with slice effects and writeScope, an 11-event CLI, trusted-base diff zones and a transition evaluator. Its own text conceded that false effect declarations evade it, and its source zones targeted directories #115 deletes. The checks that matter are relationships between declared interface versions, accepted evidence and slice status, and Markdown tables plus one test enforce those.

**Gate register** (`docs/roadmap/README.md`, `## Gate register`): one row per **gate and major version**.

```text
Gate | Version | Kind | Owner | Contract anchor | State | Provider slice | Exports | Conformance | Acceptance | Commit
```

**Columns and states:**

- **State** is `undrafted | ratified | implemented | accepted | superseded`.
- **Exports** is the shared source/export path(s).
- **Conformance** is the conformance test path(s).
- **Commit** is the reviewed implementation commit.

**Versioning:**

- Version is `—` while a gate is undrafted; the first ratified amendment assigns `1`.
- A compatible, optional extension keeps the version and records its amendment anchor.
- An **incompatible amendment adds a new row** (`version + 1`) and marks the old row `superseded`.

**Seed rows:** F1.reference, F2.unit-envelope, F3.channels, F4.intent-acceptance, F5.release-envelope, T1.viewport-projection, T3.camera-experience-cutover and T4.prepared-reader, all `undrafted`, with no version and no provider. No fictitious consumer or version exists initially.

**Slice Consumes column:** a list of exact `Gate@Version` references, for example `F4.intent-acceptance@1`. Track and phase IDs are rejected, so there are no whole-track dependencies.

**`parallel-track-gates.test.ts` enforces** (with in-memory negative fixtures for each rule and positive controls):

1. **Structure:**
   - IDs and routes resolve;
   - each slice has exactly one parent phase and each phase one track (R115 excepted);
   - each FINAL PHASE GATE names a real child;
   - a phase stage `closed` requires the final child shipped plus an owner Closed block, so child acceptance alone cannot close a phase;
   - a track `shipped` requires its TRACK COMPLETE block;
   - each gate/version has exactly one provider slice.
2. **Exact versions:**
   - every Consumes entry names an existing `Gate@Version` row;
   - a bare gate name, or a track or phase ID, fails.
3. **Readiness evidence:**
   - `implemented` requires existing Exports and Conformance paths;
   - `accepted` additionally requires an existing Acceptance record and a Commit that is an ancestor of `HEAD`;
   - ratified-only or shared-code-absent gates never count as ready.
4. **Eligibility:**
   - a slice in `in-progress` or `accepted` must consume only `accepted` rows;
   - a consumer of a `superseded` row is ineligible until it re-declares the new version, so an incompatible amendment cannot leave stale consumers eligible;
   - `shipped` slices keep their historical version.
5. **No self-satisfaction:**
   - for each slice in `in-progress` or `accepted`, every consumed `Gate@Version` must already be `accepted` in the register **as it exists at the trusted base**, read at `git merge-base HEAD main`;
   - so a consumer cannot satisfy its prerequisite by editing the register in its own diff;
   - if the `main` ref is missing, the test fails with a fetch instruction and does not skip;
   - a provider accepting its own gate does not consume it, so this never blocks providers.
6. **Ordering exceptions:**
   - a slice consuming T1.viewport-projection for Camera authoring migration must also consume T3.camera-experience-cutover (tag `camera-authoring` in its Consumes cell);
   - independent slices with no shared gate remain eligible in parallel, and a positive control proves concurrent phases in one track and accepted gates whose producing phase is still open.

**Still owned by review, not tooling:**

- that a slice's declared Consumes are truthful;
- that a new persisted format names its F amendment and owner in the reviewed plan.

### 9.5 F amendment path

1. The first consumer drafts the smallest real interface in its own slice plan: inputs and outputs, identity, version, units, failure cases, capability negotiation and fixtures. Additional consumers join the same gate rather than minting a competing one.
2. The owner ratifies an amendment in `composition-execution.md` with a stable anchor, version, extension semantics, consumer list and conformance requirements. The gate row becomes `ratified`, which is not readiness.
3. A bounded provider slice, in an owning track phase, implements it in shared code with real exports and fixtures. The row becomes `implemented`, then `accepted` with evidence.
4. For F.2 and F.4, the shared interface gate is distinct from the T3 behavioral cutover gate. Camera extraction, Experience order and the first compound acceptance remain one T3 cutover.
5. A shared implementation lives in an existing package where ownership fits. A new package needs real import or lifetime evidence.

### 9.6 Track README minimum contents

**Roadmap README:**

- bounded objectives and completion evidence expectations;
- concern ownership and exclusions;
- current vs destination contracts;
- evidence roles;
- the phase register (initially empty);
- relevant gate IDs;
- a runbook link;
- a **Starting foundation** section: the retained modules and gates the track builds on, its §5.1 deferred-retirement rows with exact conditions, and the §4.4 capability losses it owns rebuilding:
  - **T1:** shell/Stage/viewport/Plan/3D and Layout authoring;
  - **T2:** placement, materials/lights, ingest and resources;
  - **T3:** Camera/Experience authoring, preview, history and acceptance;
  - **T4:** publish UI and the prepared reader.

Track objectives never become permanent domain ownership.

**Operational runbook:**

- the baton and status-owner links (global → track phase row → phase child row), with no copied status;
- execution eligibility (§9.4);
- the **implementation-start step** (§11);
- relevant test families;
- conditional review, closeout and event routes;
- scoped debt and interruption handling.

## 10. Routing, reference and workflow updates

### 10.1 Fresh-agent routing

```text
START: docs/README.md
ASSIGNED WORK: operations/current.md → exact phase README → exact slice plan
UNASSIGNED PLANNING: roadmap/README.md → requested track README → phase plan (when registered)
F-INTERFACE GAP: slice plan → F amendment / gate register row
START IMPLEMENTATION: track runbook start step (eligibility + one-line cycle check, §11)
VERIFY: slice acceptance rows + apps/editor/tests/README.md (the gates test runs in the arch lane)
SLICE CLOSE: slice-closeout (final-gate guard; cycle-window check only)
PHASE CLOSE: explicit owner invocation → phase-closeout
TRACK / PROGRAM / REPLAN: explicit event → exact operations/README.md section
STOP: no more reading unless a concrete contradiction or missing fact requires it
```

The hierarchy is ownership, not mandatory preloading. Ordinary slice work never loads the program runbook, phase-close procedure, the whole F contract, archived diagnosis or `architecture-cycle.md`.

### 10.2 Router and baton rewrites

- **`docs/README.md`:**
  - remove the shell/theme/workspace, model-assessment and P-level rows;
  - add no legacy route (§3.4);
  - add a retained-authoring row (`src/lib/authoring/README.md`);
  - point Camera code to `packages/camera-core` and `lib/visitor`.
- **`roadmap/README.md`:**
  - a compact accepted-basis paragraph linking PLATE and prototypes;
  - the track and gate registers;
  - P23/P23B closure recorded once;
  - the unscheduled backlog paragraph;
  - no #104–#114 chronology, no P24/25/26 route and no "editing UI after all data tracks" pipeline.
- **F README:**
  - registration and amendment routing linking the gate register;
  - remove stale "before P24/P25/P26" and "no child planning" text;
  - no second F specification table.
- **`current.md`:**
  - during execution, it routes the #115 WPs;
  - at R115.S01 completion, it states: "#115 reset accepted; frozen Chopin project separated; T1–T4 phase/slice planning available; capability implementation requires its own approved scope and accepted gates";
  - it lists the track routes, and R115 owner-close as pending if not yet invoked;
  - it does not claim that capability plans exist.

### 10.3 Incoming links and historical records

**Live routes.** Repair incoming routes in every retained tracked Markdown, HTML, JSON manifest and QA launcher, not only the global routers. Important callers include:

- the Conservatory README;
- the Paper proposal;
- spatial-authoring `IMPLEMENTER-REFERENCE` and the QA READMEs/conformance manifest;
- Integrated Experience reconciliation and Design-QAs;
- the PLATE evidence table.

**Historical records:**

- Ratified decision records stay immutable. Their old planning links become labeled provenance pointing to a retained archive record or `git show <baseline>:<old-path>`.
- A historical record may name a removed source or test path inside an EVIDENCE-PATHS block. That convention exempts written locators only, never real Markdown links or images.
- Frozen Phase 0 reviews and acceptance measurement bodies are never rewritten. Escaped historical links are recorded in the move manifest.

**Archive router:** a small opt-in map plus Git recovery rules, not a stub collection.

### 10.4 Skills and test doctrine (focused edits; no new skills)

- **`slice-closeout/SKILL.md`:**
  - resolve the exact phase README and child, reading the track only if needed;
  - keep recorded-acceptance use, checkpoint retirement, durable promotion, acceptance/preservation records, the child status update, the baton update and link repair;
  - add one cycle line (§11);
  - keep the final-gate branch: finish the child, set the phase `closable`, preserve the final-gate artifact, report owner closure pending and stop;
  - no track or program procedure;
  - correct the "no docs checker exists" statement (one exists: `tests/docs/documentation-references.test.ts` in the arch lane).
- **`phase-closeout/SKILL.md`:**
  - entry examples for nested phases such as `T1.P01`, keeping the owner-only guard;
  - verify the final gate, integration, residuals and owner ruling;
  - write PHASE CLOSE and the track phase row (R115 writes the global row instead);
  - reconcile the baton without assuming a next phase;
  - remove the mandatory cycle transition table, META read and next-P pipeline;
  - keep idempotent resume.
- **Shared reference target .agents/skills/slice-closeout/references/preservation.md:**
  - move slice-closeout's closed-work, research-disposition, anchor/tag/merge safety, archive mechanics and preservation-report sections here;
  - both skills link it only at their compaction step;
  - if no valid committed recovery anchor exists, retain the full body rather than fabricate one;
  - the sequence is review → acceptance → routine closeout → merge, with anchor verification after merge.
- **`work-checkpoint`:** carry track/phase/slice identity and the resume route. Lifecycle stays in READMEs and prerequisites in the gate register.
- **`consult-browser-reviewer`:** manual-only entry with a minimal packet. Gate and cycle changes never invoke it.
- **`tests/README.md`:**
  - remove the bench, recorder, perf-lane and harvest-provenance sections;
  - add the `legacy/` isolation test, the gates test and the §7.1 deletion-with-subject rule;
  - keep the arch-lane, whole-suite and successor doctrine.

## 11. Architecture operating-cycle migration (simplified)

**Preserved:**

- the completed Phase 0 investigation, frozen reviews, adjudication, the installed Phase 1 plan and the original method (archived per §8.5);
- the stage vocabulary (WAITING … STEADY);
- the current stage `PHASE_1`, with readiness `awaiting-bounded-slice-window-plan` and a *selected*, unopened T-track spatial-foundation window.

**Bounded window rules:**

- The first relevant T1 phase plan names one to three exposure-bearing slices that capability work already justifies, plus an expected opener and a terminal. The bound is 3; changing it requires an owner amendment.
- **Opening:**
  - The window opens when any listed exposure slice starts authorized implementation. It does not wait for the nominal opener.
  - The opening slice is the one that moves the cycle from `PHASE_1` to `PHASE_2_VALIDATING`.
- **Closing:**
  - Closure requires the terminal accepted and every other listed exposure accepted or explicitly discharged.
  - Closure moves the cycle to `PHASE_3_EVALUATE`, where the owner gives a per-mechanism keep/simplify/delete/not-exposed verdict.
  - After that verdict the cycle reaches `STEADY`, which triggers no routine diagnosis.
- Diagnosis happens only on a demonstrated failure plus owner authorization.
- A pending verdict blocks nothing except its own handoff.

**Simplification.** The JSON fence, transition evaluator and CLI action codes are replaced by:

- **State table** in `architecture-cycle.md`: Stage | Readiness | Window | Exposure slices (≤3) | Opener (expected) | Terminal | Opened by | Exposure rows | Closed by.
- **Mechanism table:** M1–M7 with status (installed or dormant) and proof routes.
- **Short action headings,** each only a few lines: `configure-window`, `open-window`, `record-exposure`, `close-window`, `owner-verdict`, `diagnosis-request`.
- **Three one-line hooks.** These are the only entry points, and unrelated work never loads the cycle document:
  1. **Phase planning:** the first relevant T1 phase plan follows `configure-window`.
  2. **Implementation start** (track runbook start step): "If your slice ID is listed under Exposure slices and Opened by is empty, follow `open-window` before capability work."
  3. **Slice closeout:** "If your slice is listed under Exposure slices, follow `record-exposure`, then `close-window` if the closure predicate is now true."
- **Validation:** `parallel-track-gates.test.ts` uses the same helper, with in-memory negative fixtures and positive controls:
  - ≤3 exposures;
  - readiness `ready` requires listed slice IDs that exist in a phase README, a terminal and a plan anchor;
  - **if any listed exposure slice has status `in-progress`, `accepted` or `shipped` while Opened by is empty or the stage is still `PHASE_1`, the test fails.** A missed opening is caught in that slice's own change, and the same rule enforces F3;
  - an `accepted` or `shipped` listed slice without an exposure row fails;
  - a satisfied closure predicate with a stale stage fails;
  - premature closure while a listed exposure is pending fails;
  - `STEADY` without a verdict row for every mechanism fails;
  - **positive controls:**
    - a non-listed slice starting causes no cycle requirement;
    - a listed slice other than the nominal opener may open the window;
    - unrelated T3 data and T4 envelope slices remain eligible.

**Mechanism adaptation where monitored implementations disappear:**

| Mechanism | After #115 |
| --- | --- |
| M1 Layout semantic mutation | **Dormant.** The editor mutation runner and its call-site test are removed; core planner tests remain. Re-armed by the first T1 slice that introduces Layout mutation wiring, which supplies the call-site proof. |
| M2 Wall/Floor vertical authority | Core proofs remain (`layout-wall-height`, `layout-wall-birth-height`). The editor half is dormant. |
| M3 Persisted canonical curves | Unchanged. Core proofs remain (`layout-curve-schema`, `-read-path`, `-planners`). |
| M4 Junction commit-time identity | Core proofs remain (`layout-junction-identity`, `layout-wall-chain`, `layout-room-reconciliation`). The editor half is dormant. |
| M5 Project replacement / Navigator guard | **Dormant.** Hierarchy and replacement wiring are removed. Re-armed by the first T1 or T3 slice introducing project/session replacement. |
| M6 Lifecycle transition, M7 encountered routing | Satisfied by the state table, the three hooks and the gates test. |

The first T1 window should include at least one slice that re-arms a dormant mechanism. Otherwise the owner's verdict for those mechanisms is "not exposed" (honest, never PASS). Phase 3 outcomes are future evidence, not a #115 acceptance condition.

## 12. Executor work packages and checkpoints

Execution is one reviewed restructuring change set. Each WP ends at a **checkpoint**: its verification passes and is recorded in `acceptance.md`, and D4 makes each checkpoint one commit on the #115 branch. No checkpoint may leave routes or routers targeting nonexistent paths.

| WP | Depends on | Operations | Checkpoint acceptance |
| --- | --- | --- | --- |
| **WP0 — baseline and manifests** | Owner authorization | Record the start SHA, confirm baseline ancestry and inspect intervening deltas. Commit `tests/helpers/import-closure.ts`, the §2.2 resolver, which is reused by the isolation test and WP3R. Expand the per-file **source manifest** (§5.2), **test manifest** (§7.2, one category and reason per test file), **docs manifest** (§8) and protected hashes into `acceptance.md`. | Every in-scope tracked file is classified exactly once. Closure counts are reproduced. Docs totals are recorded. |
| **WP1 — standalone frozen project** | WP0 | Create `legacy/chopin-museum/` per §3.2: byte copies, `FREEZE.json`, its own config, `kit.alias` kernel mapping, pinned `package.json`/lockfile, `.gitignore`, static assets, category B tests and a freeze test. Add the product-side `legacy/` isolation test. | **Checkpoint A:** inside the folder, `npm ci && npm test && npm run check && npm run build` pass, and the browser check against its own preview matches the baseline. **The product is untouched.** Rollback: delete the folder. |
| **WP2 — new-product prune** | Checkpoint A | Relocate the §4.3 modules and their tests. Delete the §5.1 REMOVE rows, the editor's `/museum` routes (no redirect, §3.4) and `apps/museum`. Add the `/project/:id/spatial` notice. Apply the §5.2 manifest, script and lane changes, and regenerate the lockfile by removal only. Apply category C deletions and the A/A′/A″/D re-points and extractions. Fix mechanical breakage (imports, types, dead references) here, not later. | **Checkpoint B:** the §7.4 product gates are green. The frozen project's tests pass and `FREEZE.json` is unchanged. The visitor/public and `legacy/` isolation tests are green. Every deleted test is category C with its subject gone or has a recorded extraction. |
| **WP3 — legacy acceptance retirement** | Checkpoint B | Apply §6 with its stop rule, including the API and visitor callers. | **Checkpoint C:** the §7.4 gates are green **including the §7.5 API requirement** (DB-backed tests executed, zero skips). Legacy payloads reject with the named issue (new kernel and API tests). Stop-rule items are recorded as §5.1 rows. |
| **WP3R — post-prune reassessment** | Checkpoint C | Re-run the closure helper on the **surviving** tree and inspect four classes, using evidence only: (a) **orphaned abstractions**, meaning modules, exports or types with no route/API/runtime consumer that are not §4.3-listed (listed modules are kept by criteria, not by consumer count); (b) **unnecessary coupling**, such as product modules importing across the renderer/visitor/authoring/platform boundaries without need, or a remaining facade; (c) **misleading ownership**, meaning a module whose location or name implies a domain owner it does not have (for example whether `lib/museum` still misleads, or whether Camera authoring math belongs in `camera-core`); (d) **residual legacy dependencies**, meaning legacy types/codec reachable from a product reader, test fixtures on legacy shapes, or leftover legacy names. Classify each finding as **retain** (with reason), **consolidate in #115** (only a behavior-preserving move, merge, deletion or rename with the gates green afterwards and no semantic or format change), or **defer** to a named T-track row with its concrete dependency. Apply only the "consolidate" items. | **Checkpoint D:** the findings table in `acceptance.md` has a class and reason per finding. Consolidations are applied with the §7.4 gates green and the frozen project untouched. If there are no findings, the table says "surviving foundation coherent; no consolidation" and WP4 proceeds. Substantial redesign or new capability is out of scope; it becomes a deferred row. An escalation goes to the owner only if a finding would change a §5.1 decision. |
| **WP4 — documentation consolidation and pruning** | WP0; finalized after Checkpoint D | Write the T1–T3 planning evidence and the frozen project README. Rewrite or delete the reference contracts (§8.2) to describe the post-WP3R tree. Apply §8.3–8.6. | Docs walk green. Protected hashes match. Full-body recovery is verified. Old P24/25/26 trees are absent. |
| **WP5 — hierarchy, gates and cycle** | WP4 roots | Create the §9.1 structure, track READMEs and runbooks (Starting foundation and start step), the R115 phase README, the `operations/README.md` event sections, the track and gate registers, the markdown-table helper and gates test (§9.4, §11), the cycle tables, action headings and hooks, and the §10.4 skill edits. | The gates test passes, including every §9.4 and §11 negative and positive control. Route fixtures show ordinary slice routes load no phase, track, program or cycle procedure. |
| **WP6 — cross-reference and full verification** | WP1–5 | Repair links and anchors (§10.3), update `tests/README`, routers and AGENTS, and run §7.4. In `documentation-references.test.ts`, replace the arbitrary ">100 Markdown files" assertion with semantic non-vacuity: the walk must find the router, AGENTS, both design contracts, every track roadmap and operations root, `tests/README`, local skills and a protected-prototype sentinel, and an empty-walk mutation must fail. Do not just lower or remove the threshold. | All gates are green. There are no new checker exclusions. The diff is inspected and nothing outside the manifests changed. |
| **WP7 — acceptance, closeout and handoff** | WP6 + independent implementation review | Finalize `acceptance.md`: manifests, totals, frozen-project evidence, the WP3R table, API execution evidence, the deletion proof (§3.4 rule 4), capability loss and residuals. Close out R115.S01 with slice-closeout and mark R115 closable. Update `current.md`. | No routine second review. No automatic R115, track or cycle closure. |

**Recovery and rollback:**

- The baseline SHA is the full-recovery point for any file: `git show <baseline>:<path>`.
- Checkpoint commits are revertible in reverse order.
- WP1 leaves the product intact, so a failed WP2 never threatens the frozen products.
- If Checkpoint A cannot be reached, **stop the reset** and report the incompatibility.
- No force-push or history rewrite.

## 13. Final acceptance criteria

- **Frozen project:**
  - `legacy/chopin-museum/` builds, tests and runs on its own, and `/museum` and `/museum/editor` are functionally preserved from a hash-frozen copy;
  - no product file references `legacy/`, and `apps/museum` is removed;
  - the deletion proof shows every product gate is green with the folder removed;
  - hosting is owner-handled.
- **Foundation:**
  - only the §4.1 tree remains, as adjusted by recorded WP3R consolidations;
  - every deletion is in the source manifest, and retained modules meet §4.3;
  - kernels, renderer, visitor, API and persistence are verifiable;
  - strict readers are installed, or blockers are recorded by the stop rule;
  - the WP3R table is complete.
- **Tests:**
  - the §7.4 gates are green with no skips or expected failures, and the §7.5 API requirement is met;
  - categories A, A′, A″ and D preserve the kernel assertions with identical expectations, and category C deletions match their removed subjects;
  - successor obligations are recorded in track evidence.
- **Docs:**
  - the manifest is complete;
  - accepted designs, prototypes, protected evidence and decisions are retained and routed;
  - contracts describe the reduced current truth;
  - there are no duplicate authorities and no live links to deleted files.
- **Execution system:**
  - four tracks with Starting-foundation sections;
  - a version-aware gate register enforced by the gates test, including base-revision self-satisfaction checks;
  - the cycle state table with an enforced opening rule;
  - focused skills, and no new skills.
- **Honesty:**
  - the capability-loss list matches reality;
  - TD dispositions say "removed" or "retired", never "fixed";
  - unexecuted coverage is never reported as passing;
  - no destination is presented as shipped.

## 14. Exclusions, risks and owner decisions

**Excluded from #115:**

- capability implementation and F interface encodings;
- Layout schema redesign (the legacy types/codec split belongs to T1);
- Scene or Camera unit extraction;
- prepared-release implementation;
- semantic redesign found by WP3R (deferred instead);
- dependency upgrades;
- any deployment change (frozen-project hosting is owner-handled);
- Baseline declaration;
- push or merge without separate authorization. D4 covers only the per-WP checkpoint commits.

| Risk | Treatment |
| --- | --- |
| The frozen copy behaves differently from production (missed dynamic import, CSS order, static path, `app.html` coupling) | The closure helper covers dynamic and CSS imports. Checkpoint A comes before any deletion. A browser check against the baseline. The stop rule. |
| The frozen project rots over time | It has its own pinned lockfile. Breaks are fixed as preservation fixes, or the owner deletes the folder. |
| The product no longer serves `/museum` after merge | An owner-accepted consequence (§3.4), recorded in `acceptance.md` and in the PR description. |
| A hidden product → legacy coupling | §3.4 rules, the isolation test and the deletion proof. |
| A deleted test was the only guard of a retained invariant | Per-file test manifest. A′/A″/D extraction with identical expectations. WP3R class (a)/(d) review. |
| A retained module silently depended on deleted code | Closure-helper verification of §4.3. Type check and build at Checkpoint B. |
| Strict readers break the API or publication unexpectedly | WP3 isolated after Checkpoint B. §7.5 DB-backed execution. The stop rule. |
| DB-backed API tests silently skip and look green | §7.5 requires an explicit zero-skip result; otherwise WP3 is blocked. |
| Stale consumers or self-satisfied prerequisites | §9.4 version rows, supersession and base-revision checks. |
| The cycle window opens late or never | §11 opening hook plus the test rule tied to listed-slice status. |
| Mass deletion becomes unreviewable | Manifests, per-WP checkpoint commits and class-based rules. |

**Owner decisions (all resolved for approval):**

- **D1 — resolved:** `apps/museum` is retired and superseded by `legacy/chopin-museum`.
- **D2 — overridden by the owner:** the frozen project is outside the product, and AGENTS rules 4 and 6 are unchanged (§3.6).
- **D3 — accepted.**
- **D4 — approved:** one checkpoint commit per WP.
- **Deployment — decided:** owner-handled, with no product deploy change (§3.4).

**Future owner boundaries:**

- exact F amendment ratification;
- approval of the first T1 window configuration;
- Phase 3 verdicts;
- phase closures, track completion and product integration;
- Baselines;
- providing a Postgres environment for §7.5, or explicitly ruling on its absence (§7.5).

## 15. Planning stopping boundary and handoff

**Planning boundary:**

- The planning agent changed only this file. Owner statements are also saved as agent memory outside the repository.
- No restructuring, deletion or tooling was performed.
- Revision 2 was committed and pushed on owner instruction. This revision (3, peer-review findings F1–F6) is left uncommitted for owner action.

**Independent re-review should test:**

- self-containment (§8–§11 need no earlier revision);
- the §9.4 version and base-revision rules;
- the §11 opening rule;
- WP3R's bounds;
- the §5.1 visitor/publication split;
- the §7.5 API requirement.

Earlier review items (frozen boundary, §5.1 classes, §4.3 criteria, WP3 stop rule, test matrix, dormant mechanisms) stand. Review does not need to repeat architecture discovery.

**T-track handoff after #115:**

- Each track plans its first phase from its README's Starting foundation, deferred-retirement rows and capability-loss ownership.
- The gate register is all `undrafted`.
- The first T1 phase plan configures the cycle window.
- No track waits for another track's completion; exact `Gate@Version` prerequisites govern ordering.

**Planning validation performed:**

- **Source inspection at the baseline:**
  - import closures for all eight entry groups;
  - the frozen/shared split;
  - deployment configuration;
  - the `apps/museum` diff;
  - package consumers, orphans and facades;
  - legacy-module dependents;
  - prototype import independence;
  - test import classes and lanes.
- **For revision 3:**
  - the API test DB-skip behavior (`apps/api/tests/publication.test.mjs` and `test-auth.test.mjs` skip when Postgres is unreachable; `api.test.mjs` uses fakes);
  - the `/p/` dependency of `public-surface-boundary-plugin.ts`.
- **Checker (revision 3):** the arch-lane documentation reference checker passes 22/22 and `git diff --check` is clean. Proposed target paths are written as plain text so that the checker does not treat them as existing files.
