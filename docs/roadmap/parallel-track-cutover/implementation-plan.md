# PR #115 — Architecture Reset: Frozen-Lane Isolation, Aggressive Pruning & Parallel-Track Cutover

**Status:** proposed executor plan, revision 2 (production pruning in scope), ready for independent review. Nothing in this document is executed yet. Execution needs owner authorization against the reviewed plan.

**Inspected baseline:** `main` at `e90a58224443bdbf44114d7285d55c983b79cc84`, 2026-10-13. The plan is written on `codex/pr115-architecture-plan` (head `44ccbb78`, which adds only this file). Counts are taken from tracked files and exclude ignored local artifacts. Before execution, recheck the baseline-to-start diff and inspect only the files that changed in between.

**What changed from revision 1:** revision 1 forbade any production-code deletion in #115. The owner has lifted that restriction. #115 now prunes production code, presentation, supporting abstractions and tests aggressively, so that T1–T4 begin from the smallest sound foundation. Two owner statements made on 2026-10-13 are binding inputs to this revision:

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
6. **Keep and adapt revision 1's documentation and execution-system work.** Change it to match the reduced tree, and simplify the gate machinery so it is proportionate (§9).

A full rewrite of the kernels is unjustified: canonical topology, curve/Junction geometry, shared Camera evaluation, visitor isolation and resource handling are sound and heavily tested. Keeping the old shell is also unjustified. It embeds a superseded information model, and the frozen relic is its only remaining reason to exist, which the freeze removes.

**Prune-first policy:** strict current-format readers, one writer per meaning, and no historical decoder, bridge or facade added for development data. The frozen Chopin project is the only preservation exception. It sits outside the product entirely (§3.6).

## 2. Verified current state

### 2.1 Facts inspected at the baseline (carried from revision 1, still valid)

- ProjectDocument is `{ id, name, layout, scene }`. There is no Experience unit and no F envelope. Wall-first Layout format is 5. World-local Scene is `formatVersion: 1`. The legacy room-local Scene and floors/rooms Layout shapes are still decoded.
- Scene stores Camera nodes, connectivity, paths and view tracks. Editorial order (`nextNodeId`, `previousNodeId`, `holdSeconds`, `detourOfNodeId`, `lockInteraction`) is still mixed into Camera data.
- Both Layout generations lower into `compileLayoutGeometrySource`. They are format adapters to one compiler. Runtime Scene resolution generates node-position endpoints around authored interior anchors.
- EditorHistoryController is one capped, chronological stack of Layout or Scene snapshots. It has no atomic multi-unit acceptance and no expected-revision precondition. Project Save has no expected-base revision. Publication has its own optimistic-concurrency (OCC) scheme.
- `readPublicRelease` validates the saved project version with authoring code. Cold preparation calls `prepareCompatibleRuntime`, which accepts every recognized generation.
- TD-1: canonical floor-supported placement is broken (empty Room-frame registry, room-local node writes). This is confirmed from source.
- Static model cold validation uses the shipped-static identity, while `AssetModel` rendering reads the mutable catalogue `productionFile`. This resource-source seam is a T2/T4 obligation.

### 2.2 New source evidence for revision 2

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
| `/p/:publicationId` | Functional cold reader for wall-first/world-local releases. There are currently none (owner statement). |
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
| `lib/visitor/*`, vite boundary plugins | **RETAIN AS FOUNDATION**; **REFACTOR LATER at T4** prepared-reader cutover | Cold reader made strict in WP3. Isolation enforcement is preserved. The P22 authored-snapshot reader is still replaced by T4's prepared reader. The concrete dependency is F5.release-envelope plus T4.prepared-reader; until then, the strict snapshot reader is the only delivery path. |
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
npm run check:api && npm run test:api        # project-model reader behavior changed; test:api needs its DB prerequisite, otherwise record the exact unavailable step
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

## 8. Documentation pruning manifest (revision 1 §4, adjusted to the reduced tree)

### 8.1 Applying the manifest safely (unchanged rules)

This is an ordered, baseline-specific manifest. Exact-file and protected-family rules override prefix defaults. "DELETE remainder" includes directory READMEs, stubs and prompts, and leaves no empty husk. It applies only to tracked baseline files. WP0 expands it into a per-file manifest (old path, action, new path, blob hash, owner, rationale) in `acceptance.md`. Every baseline docs file gets exactly one action, and unmatched or overlapping rules fail. DELETE relies on the immutable baseline commit for recovery. Moved bundles keep their internal layout and byte-identical assets.

Revision 1's totals (378 delete/consolidate, 109 archive/move, 65 protected moves, 29 retain = 581) **are superseded**. The changed P23B rows, the deleted component contracts and the moved test inputs change them. WP0 recomputes and records the new totals. They are reproducibility checks, not quotas.

The user-directed aggressive pruning overrides the old "compact every closed prose file into a stub" default for this batch. Protected prototype plans and QA remain exempt. Existing recovery anchors are preserved and the full-body recovery commands are verified.

### 8.2 Live authorities and reference contracts

| Existing file or prefix | Action / reason |
| --- | --- |
| `docs/README.md`, `AGENTS.md`, `README.md` | **RETAIN + rewrite routing** (§10). AGENTS gains the one-line `legacy/` scope rule (§3.6), drops the `scroll-travel` clause and gets the new routes. Rules 4 and 6 are unchanged. |
| `reference/architecture.md`, `north-star.md`, `composition-execution.md`, both `decisions/*` | **RETAIN.** In `architecture.md`, rewrite the "Two isolated lanes" and "Product routes" sections: product routes per §4.2, and the one plain-text sentence about the separate frozen project (§3.4 rule 3). Decisions stay immutable. |
| `reference/components/shell.md`, `theme.md` | **DELETE.** Their landed subject is removed. The frozen relic's facts belong in the frozen project's own README, and PLATE owns the destination. |
| `reference/components/placement.md` | **CONSOLIDATE then DELETE.** Kernel-level Scene transform-validation facts go into `scene-content.md`. TD-1 acceptance obligations and the scalar-vs-independent-scale fidelity note go into T2 planning evidence. |
| `reference/components/camera-tour.md` | **RETAIN + rewrite** to describe the `camera-core` kernel, the graph-vs-order distinction (until T3), generated-vs-authored anchors and the visitor guided runtime. Remove editor timeline/Camera Plan/authoring descriptions. |
| `reference/components/persistence.md`, `scene-codec.md`, `scene-content.md`, `assets.md` | **RETAIN + update:** strict generation, removed facades, history section removed (the history implementation is deleted; F.4 is the destination), and the `apps/museum` path references replaced by actual paths. |
| ★ `legacy/chopin-museum/README.md` | **NEW, inside the frozen folder.** The §3.3 contract, `FREEZE.json` semantics, change policy, routes, dependencies, commands and deployment. It references only files inside its folder, and no product doc links to it (§3.4). |
| `reference/design-system/editor-shell-and-visual-system.md`, `spatial-instrument-grammar.md` | **RETAIN.** Repair evidence links only. |
| `reference/design-system/editor-shell-atlas/**`, `editor-shell-ratifications.md` | **ARCHIVE/MOVE** to `docs/archive/technical/editor-shell/` as landed-shell evidence (revision 1 rule). |
| `design-shell-specs.md`, `shell-scene-workspaces.md`, `shell-camera-workspaces.md`, `camera-flow-specs.md`, `camera-layout-design.md`, and every other baseline file under `reference/design-system/` | **DELETE.** Their implementation is removed, so there is nothing to consolidate into `shell.md`. Current Camera kernel facts (graph vs order, timing/framing guards, X/Z projection boundary) are checked against the rewritten `camera-tour.md` and folded in only if missing. |
| `docs/North-star-final-*`, `World-Experience-*` (4 files), `README.original.md` | **DELETE** after the promotion-coverage check (revision 1 rule). |
| `apps/editor/src/lib/editor/README.md`, `DEBUGGING.md` | **DELETE** with the directory. The `src/lib/authoring/README.md` (★, short) states the §4.3 retention criteria. |

### 8.3 Protected prototype family: exact moves (unchanged from revision 1 §4.3)

All prototypes are retained. Their READMEs identify accepted, superseded or unratified roles with PLATE/F links. The following move into their prototype evidence homes, with only links, recovery-path interpretation, historical banners and relocatable QA script locators changing (hashes recorded before and after):

- `p26-spatial-depth/design/visual-system-refinement/**` → `prototypes/spatial-authoring/design/visual-system-refinement/`
- `p26…/world-authoring-prototype/implementation-plan.md` → target prototypes/spatial-authoring/plans/world-authoring-prototype.md
- `p26…/paper-authoring-prototype/implementation-plan.md` → target prototypes/paper-authoring-commission/plans/inactive-adoption-plan.md (banner: inactive, unimplemented)
- `p25-experience/design/experience-v2-prototype/{implementation-plan,conformance-plan,authoring-completeness-plan}.md` → `prototypes/spatial-authoring/plans/experience-v2-prototype/`
- `…/ux-pruning-and-shell-reconciliation-plan.md` → target prototypes/spatial-authoring/plans/unified-design-reconciliation/implementation-plan.md
- `p25-experience/design/experience-ux-v3/**` → `prototypes/experience-ux-v3/design/`
- `operations/checkpoints/experience-v2-conformance-evidence/**` → `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/`
- `archive/roadmap/p25-experience/p25-unified-design/{p23b-browser-report,p23b-validation-result}.json`: **RETAIN byte-identically in place.** They are accepted UX comparator evidence.

Moved QA launchers keep working-directory correctness, verified with a non-browser dry run. Prototype behavior is untouched, and production pruning cannot reach it (§2.2).

### 8.4 Retired P24/P25/P26 planning and unique evidence (unchanged from revision 1 §4.4)

The revision 1 rows stand:

- P24 focused research → `archive/technical/composition/`;
- P24 reconciliation → T2 planning evidence, then delete;
- P25 compact research → `archive/technical/experience/` plus T3 extraction;
- other P25 research → delete;
- P26 broad compact and harvests → `archive/technical/spatial/`;
- P26 umbrella → T1 evidence plus archive;
- P26 synthesis → T1 evidence, then delete;
- the rest of P24/25/26 → delete;
- the two backlog proposals → a global unscheduled paragraph;
- the commission proposal and `model-assessment.md` → delete.

The required T1/T2/T3/T4 evidence contents are those of revision 1 §4.4, with these additions:

- **T1:** the §7.2 successor obligations (mesh parity, M1/M5 re-arming, Plan representation invariant), the TD-5 `$state`-proxy lesson (do not wrap compiled geometry in deep reactive proxies), the retained `lib/authoring/{layout,a11y}` routes, and the legacy Layout types/codec retirement row (§5.1).
- **T2:** TD-1's acceptance obligations (canonical Room-free placement; no camera, primitive, light or asset blocked), the retained `lib/authoring/scene` routes, and ingest/resource staging rebuild (upload/load stores removed).
- **T3:** history and acceptance invariants from deleted tests (one logical result, no-op, rollback, cap), expected-revision Save, Camera authoring math placement (`lib/authoring/camera`), and the order-field/visitor-order retirement row.
- **T4:** the strict snapshot reader is the current path, and publication UI and import/export are removed. There is still no separate T4 evidence file.

### 8.5 Closed P23/P23B, operations and archive

| Baseline prefix / exception | Action |
| --- | --- |
| P23 rows | Unchanged from revision 1: archive the README, the four foundation plans, the P23.14 QA record and p23.15/p23.16 closure bundles to `archive/technical/p23/`, and delete the remainder. |
| P23B `fixture-ledger.json`, `reuse-counter-ratchet.json` | **DELETE** (revision 1 protected them only as test inputs; their tests are removed per the owner statement). WP2 must prove no retained test or recorder imports them. |
| P23B README, curved-crossing owner decision (`p23b.3…/2026-09-22-P23B.3-curved-crossing-owner-decision.md`), `p23b.9` correctness/performance gate record and `p23b.10` phase closeout | **ARCHIVE/MOVE** to `archive/technical/p23b/`. Phase closure provenance and the algorithm decision are retained. Measurement bundles are not. |
| All other P23B files (measurement reports, budget policy, p23b.6/.8/.11 bundles, pre-p23b.8 follow-up, Rust/WASM decision) | **DELETE.** The benchmark's purpose is fulfilled (owner statement). Git holds the history. Before deletion, pull any unreconciled *correctness* debt into tech-debt; no perf debt. |
| `operations/current.md`, `checkpoints/README.md` | **RETAIN + rewrite** (§10). |
| `operations/tech-debt/README.md` | **RETAIN + update** (§8.6). |
| `operations/test-suite-harvest-2026-09-19.{md,csv}` | **DELETE.** Their measured lane evidence describes a test tree that #115 restructures. Current doctrine lives in `tests/README`. (Revision 1 archived them; with ≈220 subject tests removed, the harvest no longer describes anything recoverable that Git does not already hold.) |
| `operations/architecture-cycle.md`; `roadmap/architecture-operating-cycle-plan.md`; `architecture-operating-cycle/phase-0/**`, `phase-1/**`; `architecture-operating-cycle-workflow-harvest.md` | As in revision 1: consolidate into `architecture-cycle.md`, archive the original plan and the Phase 0/1 bundle to `archive/technical/architecture-cycle/`, and delete the harvest. |
| Baseline `docs/archive/**` | Revision 1 rule: delete by default except `archive/README.md` (rewrite), the two p25 comparator JSONs and the P23-H3/H5 harvests. `ASSET_WORKFLOW.md` facts fold into `assets.md` first. |

**Preservation invariant:** an unresolved obligation cannot disappear with its document. The expanded manifest records its surviving owner. A newly found concrete obligation gets a narrow manifest amendment, not a broad reconciliation.

### 8.6 Tech-debt dispositions caused by code removal

- **TD-1:** close as **implementation removed**, not fixed. The defective placement/Camera Plan wiring is deleted, and the Room-registry dependency leaves the new-product reader path in WP3. Its "then add" acceptance tests transfer verbatim to T2 planning evidence.
- **TD-2:** close as implementation removed. The non-recurrence criterion goes to T1 evidence.
- **TD-3:** already fixed. Compact to one line plus its anchor.
- **TD-4 and TD-5:** close as retired with the benchmark (owner statement). TD-5's lesson goes to T1 evidence.

Do not record any of these as "fixed".

## 9. Track → Phase → Slice system and gates (proportionality revision)

### 9.1 Retained from revision 1

Retained unchanged:

- the four tracks T1 Spatial/World, T2 Composition, T3 Experience and T4 Release;
- the Track → Phase → Slice hierarchy with qualified IDs (`T1.P01.S01`) and concurrent phases;
- exact slice-level prerequisites (never "T1 complete");
- F first-consumer interface amendments in `composition-execution.md`;
- the four distinct completion events: slice acceptance → routine closeout, owner-invoked phase closure, bounded track completion and product integration acceptance;
- convergence and bounded replanning through event-only `operations/README.md` sections;
- the one-owner-per-concern table (revision 1 §3.1);
- R115 as a single repository phase with sole child and final gate `R115.S01`, outside T1–T4.

The target structure is as in revision 1 §3, except that `execution-gates.json` and the CLI files are removed (§9.2).

### 9.2 What changes: the smallest enforceable gate system

Revision 1 proposed `execution-gates.json` (gates plus slice declarations with effects/writeScope), a status-table parser, an 11-event CLI with trusted-base diff scoping, coarse source-zone triggers and a lifecycle transition evaluator. That machinery is **disproportionate**. Its own text admits that false effect declarations evade it, so review remains the real guard, and its scope zones targeted directories that #115 now deletes. The replacement:

1. **One gate table** in `docs/roadmap/README.md`, `## Gate register`, with columns Gate | Kind | Owner | Contract anchor | State | Provider slice | Acceptance evidence | Commit. The states are `undrafted | ratified | implemented | accepted | superseded`. It is seeded with F1.reference, F2.unit-envelope, F3.channels, F4.intent-acceptance, F5.release-envelope, T1.viewport-projection, T3.camera-experience-cutover and T4.prepared-reader, all `undrafted`.
2. **Phase README slice table** with columns Slice | Status | Consumes | Plan | Acceptance | Authorization. Lifecycle stays README-owned. There is no JSON and no duplicated status.
3. **One arch-lane test,** `tests/docs/parallel-track-gates.test.ts`, with one small helper, `tests/helpers/markdown-tables.ts`, also used for the cycle table (§11). It enforces:
   - all IDs and routes resolve, each slice has one parent phase and each phase one track (R115 excepted);
   - no consumed gate is unknown;
   - a slice in `in-progress | accepted | shipped` has an Authorization link and a Plan, and every gate it Consumes is `accepted`;
   - `accepted` requires an existing acceptance record and a commit that is an ancestor of `HEAD` (via `git merge-base --is-ancestor`), so a prerequisite cannot be satisfied with a placeholder or a future SHA;
   - `implemented` requires an existing export path;
   - a phase `closed` stage requires its FINAL PHASE GATE child to be shipped plus an owner-closure block;
   - track complete requires its TRACK COMPLETE owner block;
   - a slice with a `camera-authoring` tag in Consumes must also consume T3.camera-experience-cutover.

   Negative fixtures are in-memory tables.
4. **Ordinary review guards** what tooling cannot: truthful consumes declarations, and a consumer not marking its own provider accepted in an unreviewed diff (revision 1 §5.2 rule, kept as review policy).

This is less than a third of revision 1's tooling and keeps every dependency-safety property that is mechanically checkable.

### 9.3 Track README minimum contents

As in revision 1 §3.2, plus a **"Starting foundation"** section. It lists the post-#115 retained modules and gates the track builds on, its deferred-retirement rows from §5.1 with exact conditions, and the capability losses (§4.4) it owns rebuilding:

- **T1:** shell/Stage/viewport/Plan/3D, Layout authoring;
- **T2:** placement, materials/lights, ingest/resources;
- **T3:** Camera/Experience authoring, preview, history/acceptance;
- **T4:** publish UI, prepared reader.

Initial phase registers are empty.

## 10. Routing, reference and workflow updates

These keep revision 1 §6, with the following adjustments:

- **Route template:**
  ```text
  START → ASSIGNED WORK (current.md → phase README → slice plan)
        → UNASSIGNED PLANNING (roadmap → track README)
        → F gap (slice plan → F amendment / gate row)
        → VERIFY (slice acceptance + tests/README)
        → event routes
        → STOP
  ```
  The CLI step is removed, and gate checks run inside the arch lane.
- **`docs/README.md` code-routing table:** remove the shell/theme/workspace rows. Add no legacy route (the frozen project is outside product routing, §3.4), and add a retained-authoring row (`src/lib/authoring/README.md`). Correct the Camera code route to `packages/camera-core` and `lib/visitor`.
- **Global roadmap:** a compact accepted-basis paragraph, the track register, the gate register, P23/P23B closure recorded once, and an unscheduled backlog paragraph. There is no P24/25/26 route.
- **`current.md`:** during execution it routes #115 WPs. At R115.S01 completion it states: "#115 reset accepted; frozen Chopin project separated; T1–T4 phase/slice planning available; capability implementation requires its own approved scope/gates", plus R115 owner close pending if not invoked.
- **Skills (focused edits as in revision 1 §6.3):**
  - `slice-closeout` resolves the exact phase README, keeps the final-gate guard and checks the cycle window table with one line (§11).
  - `phase-closeout` gets nested-phase examples and loses its ambient cycle transition table and next-P pipeline.
  - The shared `preservation.md` reference loads only at compaction.
  - `work-checkpoint` carries track/phase/slice identity.
  - The slice-closeout statement that "no docs checker exists" is corrected.
  - No new skills.
- **`tests/README.md`:** remove the bench/recorder/perf-lane sections and harvest provenance. Add the `legacy/` isolation test, the gates test and the §7.1 deletion-with-subject rule.
- **Incoming-link repair** covers all retained Markdown, HTML, JSON manifests and QA launchers (revision 1 §6.2 rules). Historical records keep their content, use the EVIDENCE-PATHS convention for removed source paths and never contain live links to deleted files.

## 11. Architecture operating-cycle migration (simplified)

This preserves:

- the completed Phase 0 investigation, frozen reviews, adjudication, the installed Phase 1 plan and the original method (archived bundle);
- `PHASE_1` state, with readiness `awaiting-bounded-slice-window-plan`;
- the bounded window rules: one to three exposure-bearing slices named by the first relevant T1 phase plan, a declared terminal, closure when the terminal plus remaining declared exposures are accepted or discharged, Phase 3 owner verdict per mechanism, and STEADY with no routine diagnosis.

**Simplification.** The JSON fence, transition evaluator, CLI action codes and dedicated lifecycle test are replaced by the following:

- **One state table** in `architecture-cycle.md`: Stage | Readiness | Window | Exposure slices (≤3) | Terminal | Opened by | Closed by. It is validated by `parallel-track-gates.test.ts` with these rules:
  - ≤3 exposures;
  - `ready`/open requires slice IDs that exist in a phase README;
  - `PHASE_2_VALIDATING` requires Opened by;
  - `PHASE_3_EVALUATE` requires Closed by plus every declared exposure accepted or discharged;
  - `STEADY` requires an owner-verdict row for each mechanism.

  Negative fixtures are in-memory.
- **One mechanism table:** M1–M7 with status and proof routes.
- **Short action headings** (`configure-window`, `open-window`, `record-exposure`, `close-window`, `owner-verdict`, `diagnosis-request`), each a few lines. Agents reach them through one-line hooks:
  - the first T1 phase planner → configure-window;
  - `slice-closeout` → "if this slice is listed in the window table, follow record-exposure / close-window";
  - explicit owner request → owner-verdict / diagnosis-request.

  Unrelated work never loads the cycle document.

**Mechanism adaptation where the monitored implementations disappear:**

| Mechanism | After #115 |
| --- | --- |
| M1 Layout semantic mutation | **Dormant.** `layout-mutation-runner` and its call-site test are removed. Core planner tests remain. Re-armed by the first T1 slice that introduces Layout mutation wiring, which must then supply the call-site proof. |
| M2 Wall/Floor vertical authority | Core proofs remain (`layout-wall-height`, `layout-wall-birth-height`). The editor half (`layout-height-edit-history`) is dormant. |
| M3 persisted canonical curves | Unchanged. Core-only proofs remain. |
| M4 Junction commit-time identity | Core proofs remain (`layout-junction-identity`, `layout-wall-chain`, `layout-room-reconciliation`). The editor half (`layout-wall-chain-commit`) is dormant. |
| M5 project replacement / Navigator guard | **Dormant.** Hierarchy and replacement wiring are removed. Re-armed by the first T1/T3 slice introducing project/session replacement. |
| M6 lifecycle transition, M7 encountered routing | Satisfied by the state table, the closeout hook and the gates test. |

The window's eligible slices must include at least one slice that re-arms a dormant mechanism. Otherwise the owner verdict for those mechanisms is "not exposed" (an honest permitted verdict, never PASS). Phase 3 outcomes are future evidence, not a #115 acceptance condition.

## 12. Executor work packages and checkpoints

Execution happens in one reviewed restructuring change set. Each WP ends at a **checkpoint**: its listed verification passes and it is recorded in `acceptance.md`. If the owner authorizes checkpoint commits on the #115 branch (decision D4), each checkpoint is one commit, so review and rollback happen per WP. No split merge may leave routes or routers targeting nonexistent paths.

| WP | Depends on | Operations | Checkpoint acceptance |
| --- | --- | --- | --- |
| **WP0 — baseline and manifests** | Owner authorization | Record the start SHA; confirm baseline ancestry and inspect intervening deltas. Commit `tests/helpers/import-closure.ts` (the §2.2 resolver; reused by the freeze test). Expand the per-file **source manifest** (§5.2), **test manifest** (§7.2, one category per test file with a reason), **docs manifest** (§8) and protected hashes into `acceptance.md`. | Every tracked file in scope is classified exactly once. Closure counts are reproduced. The new docs totals are recorded. |
| **WP1 — standalone frozen project** | WP0 | Create `legacy/chopin-museum/` per §3.2: byte copies, `FREEZE.json`, its own config, `kit.alias` kernel mapping, pinned `package.json` and lockfile, static assets and the category B tests plus a freeze test. Add the product-side `legacy/` isolation test. | **Checkpoint A:** the frozen project's `npm ci && npm test && npm run check && npm run build` pass, and the browser check against its own preview (§7.4) matches the baseline. **The product is untouched**: its routes still serve `/museum`, so the copy is proven before any deletion. Rollback: delete the folder. |
| **WP2 — new-product prune** | Checkpoint A | Relocate the §4.3 retained modules and their tests. Delete the §5.1 REMOVE rows (editor layer, styles/theme, facades, Plan presentation, bench/perf, orphans, five packages, removed routes). Add the `/project/:id/spatial` notice. Remove the editor's `/museum` routes (no redirect, §3.4). Remove `apps/museum`. Apply the §5.2 manifest/script/lane changes and regenerate the lockfile by removal only. Apply category C deletions and category A/A′/A″/D re-points and extractions. | **Checkpoint B:** all §7.4 automated gates are green. The frozen project's tests still pass and `FREEZE.json` is unchanged. The visitor/public and `legacy/` isolation tests are green. Every deleted test is either categorized C with its subject gone, or has a recorded extraction. |
| **WP3 — legacy acceptance retirement** | Checkpoint B | Apply §6 with its stop rule, including the API and visitor callers. | **Checkpoint C:** gates are green, including `test:api` or its recorded prerequisite gap. Legacy payloads reject with the named issue (new kernel tests). Stop-rule items are recorded as §5.1 rows. |
| **WP4 — documentation consolidation and pruning** | WP0 (can run in parallel with WP1–3; finalized after Checkpoint C) | Write the T1–T3 planning evidence and the frozen project README. Rewrite or delete the reference contracts (§8.2). Apply the protected moves, archival and deletion (§8.3–8.5) and the tech-debt dispositions (§8.6). | Docs walk green. Protected hashes match. Full-body recovery is verified. The old P24/25/26 trees are absent. |
| **WP5 — hierarchy, gates and cycle** | WP4 roots | Track READMEs and runbooks (with Starting foundation), the R115 phase README, the operations event sections, the roadmap track and gate registers, the markdown-table helper and gates test, the cycle tables and action headings, and the skill edits. | The gates test passes with negative controls. Ordinary slice routes load no phase/track/program/cycle procedure (route fixtures). |
| **WP6 — cross-reference and full verification** | WP1–5 | Repair links and anchors, update `tests/README`, routers and AGENTS, and run §7.4. Replace the ">100 Markdown files" assertion with semantic non-vacuity checks (revision 1 §9.1 rule). | All gates are green. There are no checker exclusions. The diff is inspected, and nothing outside the manifests changed. |
| **WP7 — acceptance, closeout and handoff** | WP6 + independent implementation review | Finalize `acceptance.md` (manifests, totals, frozen-project evidence, deletion proof (§3.4 rule 4), capability loss, residuals). Close out `R115.S01` with slice-closeout, then mark R115 closable. Update `current.md` to the handoff text. | No routine second review. No automatic R115/track/cycle closure. |

**Recovery and rollback:**

- The baseline SHA (recorded in WP0) is the full-recovery point for any deleted file: `git show <baseline>:<path>`.
- Each checkpoint is independently revertible in reverse order. Because WP1 leaves the originals intact, a failed WP2 never threatens the frozen products.
- If Checkpoint A cannot be reached (the standalone copy does not reproduce baseline behavior), **stop the reset**. Report the precise incompatibility instead of deleting shared code. Before WP2, rollback is just deleting the folder.
- No force-push or history rewrite.

## 13. Final acceptance criteria

- **Frozen project:** `legacy/chopin-museum/` builds, tests and runs on its own (`npm ci && npm test && npm run check && npm run build` inside the folder, plus the browser check against its own preview). `/museum` and `/museum/editor` are functionally preserved from a hash-frozen copy. No product file references `legacy/`. `apps/museum` is removed. The deletion proof (§3.4 rule 4) shows every product gate is green with the folder removed. Hosting is owner-handled.
- **Foundation:** only the §4.1 tree remains. Every deletion is in the source manifest. The retained modules meet the §4.3 criteria. Kernels, renderer, visitor, API and persistence are verifiable. Strict-generation readers are installed, or blockers are recorded per the stop rule.
- **Tests:** the §7.4 gates are green, with no skips or expected failures. Categories A, A′, A″ and D preserve the kernel assertions with identical expectations. Category C deletions match removed subjects. Successor obligations are recorded in track evidence.
- **Docs:** the manifest is complete. Accepted designs, prototypes, protected evidence and decisions are retained and correctly routed. Component contracts describe the reduced current truth. There are no duplicate authorities and no live links to deleted files.
- **Execution system:** four tracks with Starting-foundation sections, the gate register and tests, simplified cycle state, focused skills, and no new skills.
- **Honesty:** the capability-loss list matches reality, TD dispositions say "removed" or "retired" and never "fixed", and no destination is presented as shipped.

## 14. Exclusions, risks and owner decisions

**Excluded:**

- capability implementation;
- F interface encodings;
- Layout schema redesign (the legacy types/codec split is T1);
- Scene or Camera unit extraction;
- prepared-release implementation;
- renaming retained directories;
- dependency upgrades;
- any deployment change (frozen-project hosting is owner-handled outside #115);
- Baseline declaration;
- commits, push or merge without separate authorization.

| Risk | Treatment |
| --- | --- |
| Frozen copy behaves differently from production (missed dynamic import, CSS order, static path, `app.html` coupling) | Closure helper covers dynamic and CSS imports. Checkpoint A comes before any deletion. Browser smoke compared with the baseline. Stop rule. |
| Frozen project rots over time (Node or Vercel runtime changes) | It has its own pinned lockfile, so product upgrades cannot reach it. Its README documents the commands. A runtime break is fixed as a preservation fix, or the owner deletes the folder. |
| Production `/museum` is no longer served by the product after merge | An owner-accepted consequence; the owner deploys the frozen project separately (§3.4). It is recorded in `acceptance.md` and the PR description so it is not a surprise. |
| A hidden product → legacy coupling (shared static, docs link, root script) | §3.4 independence rules, the `legacy/` isolation test, and the deletion proof run at acceptance. |
| A deleted test was the only guard of a retained kernel invariant | Per-file test manifest with categories. A′/A″/D extraction with identical expectations. Kernel coverage in WP0 is checked against the retained modules' exports. |
| A retained module silently depended on deleted code | The §4.3 criteria are verified by the closure helper. Type check and build gate Checkpoint B. |
| Strict readers break something unexpected (API, publication) | WP3 is isolated after Checkpoint B, runs `test:api` and has a stop rule. Owner policy: dev data loss is accepted. |
| Mass deletion becomes unreviewable | Manifests, per-WP checkpoints, class-based rules and a diff restricted to the manifests. |
| Gate simplification loses ordering safety | Ancestor-commit acceptance evidence, consumes-must-be-accepted, and review policy for truthful declarations. Revision 1's extra checks protected mostly unverifiable claims. |

**Owner decisions:**

- **D1 — resolved** by the §3 design: `apps/museum` is retired and superseded by `legacy/chopin-museum`.
- **D2 — overridden by the owner:** the frozen project is outside the product, and AGENTS rules 4/6 are unchanged (§3.6).
- **D3 — accepted** (owner: does not matter).
- **D4 — approved:** one checkpoint commit per WP on the #115 branch during execution. This plan's own revision is not committed under D4.
- **Deployment — decided:** the owner handles frozen-project hosting directly, later. #115 adds no redirect or deploy configuration, and the folder must be deletable without affecting the product (§3.4).

Later owner boundaries are unchanged from revision 1: exact F amendments, first T1 window configuration approval, Phase 3 verdicts, phase closures, track completion, product integration and Baselines.

## 15. Planning stopping boundary and handoff

The planning agent changed **only this file**. Two owner statements were also saved as agent memory outside the repository. No restructuring, deletion, tooling, commit or push was performed.

**Independent review should test:**

- the standalone frozen-project boundary, zero-rewrite copy, deployment options and Checkpoint A ordering;
- the §5.1 classes against the cited closure evidence;
- the §4.3 retention criteria;
- the WP3 stop rule;
- the test matrix (especially A′/A″/D extraction);
- the gate simplification against revision 1;
- the dormant-mechanism adaptation;
- the docs manifest changes from revision 1.

Review does not need to repeat architecture discovery.

**T-track handoff after #115:** each track plans its first phase from its README's Starting foundation, deferred-retirement rows and capability-loss ownership. The gate register is all `undrafted`. The first T1 phase plan also configures the cycle window. No track waits for another track's completion. Exact slice and interface gates govern ordering.

**Planning validation performed:**

- Source inspection at the baseline: import closures for all eight entry groups, the frozen/shared split, deployment config, the `apps/museum` diff, package consumers, orphans, facades, legacy-module dependents, prototype import independence, test import classes and lanes. The commands are reproduced by WP0's helper.
- The documentation reference checker (`vitest.arch.config.ts tests/docs`) passes with this revision: 22/22 tests, 2026-10-13. Proposed target paths are written as plain text, not as links. `git diff --check` is clean.
- No other tests were run for this revision. Revision 1's `test:arch` result (24 files / 276 tests, 2026-10-13) describes the unchanged baseline.
