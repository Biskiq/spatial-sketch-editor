# R115.S01 — execution acceptance record

**Purpose.** Slice-level acceptance for PR #115, written as the work packages execute.
The plan of record is [`implementation-plan.md`](./implementation-plan.md) (revision 4).
Nothing here is a product contract; landed truth lives under `docs/reference/`.

## 1. WP0 — baseline

- **Execution start SHA:** `0cc40b670ce7e57a03cda2c8312555544b29a328`
- **Inspected baseline:** `e90a58224443bdbf44114d7285d55c983b79cc84` (2026-10-13)
- **Baseline is an ancestor of the start SHA:** yes
- **Baseline → start delta:**  1 file changed, 1030 insertions(+) (plan file only; no source delta).
- **Commit `tests/helpers/import-closure.ts`:** the §2.2 resolver, reused by the `legacy/` isolation test and WP3R.

### 1.1 Closure counts (§2.2 reproduction)

Resolver: [`apps/editor/tests/helpers/import-closure.ts`](../../../apps/editor/tests/helpers/import-closure.ts).
Static, type, dynamic and CSS imports; `$lib`, `@portfolio/*` and `virtual:museum-editor-entry` resolved.
The walk does not descend into `apps/editor/tests/**` (the test population, measured by §3).

| Entry group | Files | Plan §2.2 | Kernel files | Lines | Reproduction |
| --- | ---: | ---: | ---: | ---: | --- |
| relic (/museum/editor) | 341 | 341 | 69 | 118684 | match |
| museum (hosted /museum) | 126 | 126 | 69 | 41697 | match |
| new editor | 395 | 395 | 69 | 135330 | match |
| public visitor (/p/:publicationId) | 111 | 111 | 69 | 40339 | match |
| dev routes | 411 | 411 | 69 | 144374 | match |
| apps/museum | 125 | 125 | 69 | 41501 | match |
| apps/api | 84 | 84 | 69 | 36437 | match |
| Combined frozen closure (both museum routes) | 344 | 344 | 69 | 118979 | match |

- Relic `lib/editor` files: **194** (plan 194); shared with the new editor: **187** (plan 187); relic-only: **7** (plan 7); new-editor-only: **49** (plan 48).
- Kernel-package files in every editor closure: **69** (plan 69); frozen lines ≈ 119k (plan ≈ 119k).

### 1.2 Post-baseline delta disposition (§8.1)

The manifests classify *tracked baseline* files. Work added or edited after the baseline gets a delta disposition:

| Post-baseline file | Action | Note |
| --- | --- | --- |
| `docs/roadmap/parallel-track-cutover/implementation-plan.md` | ADD | R115 plan/acceptance record; not part of the baseline manifest |
| `apps/editor/tests/helpers/import-closure.ts` | ADD | WP0 §2.2 resolver; reused by the `legacy/` isolation test and WP3R |

The frozen-project files added by WP1 are recorded in its `FREEZE.json` and in §6, not in the baseline manifests.

EVIDENCE-PATHS: start — baseline tracked paths and prospective #115 target paths, quoted as evidence of the baseline revision and of this plan; the work packages resolve or remove them, so they are declared rather than routed.

## 2. Source manifest (§5.2)

Scope: tracked files under `apps/editor/src`, `apps/editor/vite`, `apps/editor/scripts`, `apps/museum`, `packages/*`, `apps/editor/static` and `apps/editor/assets-source` — **619 files**, each classified exactly once (first matching ordered rule wins).
Class vocabulary and rule semantics come from the plan §5.1 disposition register; `dest` is the WP1 frozen path or the retained relocation target.

**Class totals:**

| Class | Files |
| --- | ---: |
| REMOVE IN #115 | 399 |
| RETAIN AS FOUNDATION | 165 |
| ISOLATE FOR LEGACY | 28 |
| RETAIN AS FOUNDATION (relocate) | 24 |
| RETIRE AT T1 | 3 |
| **Total** | **619** |

**Rule totals:**

| Rule | Files |
| --- | ---: |
| §5.1 lib/editor shell removed; frozen copy only | 224 |
| §3.5 apps/museum superseded by legacy/chopin-museum | 78 |
| §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | 40 |
| §5.1 facades + old Plan presentation | 33 |
| §5.2 asset pipeline/provenance retained | 29 |
| §5.1 P23B bench apparatus | 20 |
| §4.3 retained pure semantics | 20 |
| §5.1 Chopin-specific; origin removed after freeze | 19 |
| §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | 18 |
| §4.1 generic renderer / resource lifetimes | 17 |
| §5.1 zero-consumer package | 17 |
| §5.1 product static assets for the generic catalogue | 14 |
| §5.1 visitor runtime/isolation; strict in WP3 | 11 |
| §5.1 Chopin content; origin removed after freeze | 7 |
| §5.1 perf routes | 7 |
| §5.1 one Camera authority; REFACTOR LATER at T3 | 7 |
| §4.1 generic catalogue | 5 |
| §4.1 platform relocation | 4 |
| §4.1 entry/hub/visitor route | 4 |
| §6 separable legacy chain | 4 |
| §5.2 vercel proxy + boundary verifiers unchanged | 3 |
| §5.1 thin facade | 3 |
| §2.2 orphan surfaces/*.svelte | 3 |
| §4.1 shared resource types | 3 |
| §4.1 visitor/preview boundary plugins | 3 |
| §5.1 legacy types/codec host definitions; T1 schema cutover | 3 |
| §6 legacy generation (no data obligations) | 3 |
| §5.1 app.html theme boot script removed from product | 2 |
| §5.1 facade / compat-runtime | 2 |
| §4.1 catalogue-configured strict codec | 2 |
| §4.1 retained only if closure ⊆ foundation | 2 |
| §3.4 museum routes removed in WP2; frozen copy | 2 |
| §4.2 preview/publish routes removed (404) | 2 |
| §4.1 workspace tsconfig | 2 |
| §5.1 renderer mesh generation shared with visitor | 1 |
| §4.1 wall-geometry-adapter | 1 |
| §5.1 unmatched rule → remove | 1 |
| §4.1 editor session layout removed; static notice replaces it | 1 |
| §4.2 foundation-reset notice | 1 |
| §3.2 virtual entry; frozen route imports MuseumEditorApp directly | 1 |

### 2.1 Per-file source manifest

> **Reading the "New / frozen path" column after §6.4.** The 28 `ISOLATE FOR LEGACY` rows and
> every other row whose destination reads `legacy/chopin-museum/…` name where WP1 **did**
> byte-copy the file. Those destinations are now **external to this repository** (§6.4): the
> column is the provenance record of the freeze, not a live path, and no product file may
> point at it again. The same applies to the `§3.5 apps/museum superseded by
> legacy/chopin-museum` rule label. Where a row's destination is a product path, it is a live
> WP2 target.

| Old path | Class | New / frozen path | Rule | Blob |
| --- | --- | --- | --- | --- |
| `apps/editor/assets-source/licenses/chandelier.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `70806e1aa17c` |
| `apps/editor/assets-source/licenses/dining-chair-02.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `a476d27774d1` |
| `apps/editor/assets-source/licenses/grand-piano.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `461311bda5d1` |
| `apps/editor/assets-source/licenses/grandfather-clock.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `95b3080883a1` |
| `apps/editor/assets-source/licenses/salon-chair.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `6e4b8cccddff` |
| `apps/editor/assets-source/licenses/salon-table.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `ea84055ba8e7` |
| `apps/editor/assets-source/licenses/sofa-03.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `0c0b4d8db493` |
| `apps/editor/assets-source/licenses/victorian-oil-lamp.md` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `f4114fccd670` |
| `apps/editor/assets-source/models/chandelier/source.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `7d1fc2ce9d87` |
| `apps/editor/assets-source/models/dining-chair-02/dining_chair_02.bin` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `8e678971cc67` |
| `apps/editor/assets-source/models/dining-chair-02/dining_chair_02_1k.gltf` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `b0128c055309` |
| `apps/editor/assets-source/models/dining-chair-02/textures/dining_chair_02_arm_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `67e12f182e48` |
| `apps/editor/assets-source/models/dining-chair-02/textures/dining_chair_02_diff_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `e18363548f0e` |
| `apps/editor/assets-source/models/dining-chair-02/textures/dining_chair_02_nor_gl_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `cc707b00af9d` |
| `apps/editor/assets-source/models/grand-piano.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `603a872e0509` |
| `apps/editor/assets-source/models/grandfather-clock/source.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `1908d48dd31d` |
| `apps/editor/assets-source/models/salon-chair/source.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `c24cb711531c` |
| `apps/editor/assets-source/models/salon-table/source.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `b4b173d3b6f3` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k.gltf.zip` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `d515afe41742` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k_gltf/sofa_03.bin` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `b60bb7325b7a` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k_gltf/sofa_03_1k.gltf` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `97322a5974d9` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k_gltf/textures/sofa_03_diff_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `d4540f956f75` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k_gltf/textures/sofa_03_nor_gl_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `305d9dd70345` |
| `apps/editor/assets-source/models/sofa-03/sofa_03_1k_gltf/textures/sofa_03_rough_1k.jpg` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `f898366353ad` |
| `apps/editor/assets-source/models/victorian-oil-lamp/source.glb` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `d0b0cb9de6c9` |
| `apps/editor/assets-source/pipeline/normalize-asset.sh` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `581306438b6b` |
| `apps/editor/assets-source/pipeline/provenance.ts` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `6bd045b5b257` |
| `apps/editor/assets-source/plan-proxy/footprint-generator.ts` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `9c0abc81535d` |
| `apps/editor/assets-source/textures/.gitkeep` | RETAIN AS FOUNDATION | — | §5.2 asset pipeline/provenance retained | `8b137891791f` |
| `apps/editor/scripts/inject-vercel-api-proxy.mjs` | RETAIN AS FOUNDATION | — | §5.2 vercel proxy + boundary verifiers unchanged | `6013e0eb5a8d` |
| `apps/editor/scripts/verify-preview-surface.mjs` | RETAIN AS FOUNDATION | — | §5.2 vercel proxy + boundary verifiers unchanged | `9e50b18739fd` |
| `apps/editor/scripts/verify-public-surface.mjs` | RETAIN AS FOUNDATION | — | §5.2 vercel proxy + boundary verifiers unchanged | `6192811252ca` |
| `apps/editor/src/app.html` | RETAIN AS FOUNDATION | — | §5.1 app.html theme boot script removed from product | `deec7d6e3eb8` |
| `apps/editor/src/lib/bench/baselines/g3-baseline.json` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `9820c484c8c7` |
| `apps/editor/src/lib/bench/bench-harness.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `e3dfa4111acc` |
| `apps/editor/src/lib/bench/bench-report.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `c0e109a32272` |
| `apps/editor/src/lib/bench/bench-types.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/bench/bench-types.ts` | §5.1 P23B bench apparatus | `2d71128266a5` |
| `apps/editor/src/lib/bench/browser-bench.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `368ae3063ec4` |
| `apps/editor/src/lib/bench/p2311-bend-fixtures.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `956c17b7d730` |
| `apps/editor/src/lib/bench/p2311-proxy-probe.svelte.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `0e9af4b87af4` |
| `apps/editor/src/lib/bench/p23b-containment.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `5b20e18ada71` |
| `apps/editor/src/lib/bench/p23b-fixtures.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `728dfc7f11bb` |
| `apps/editor/src/lib/bench/p23b-m1-attribution.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `181a695dbcf9` |
| `apps/editor/src/lib/bench/p23b-m1-cpu-profile.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `47a78dbde2da` |
| `apps/editor/src/lib/bench/p23b-m1-frame-timing.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `ab296c0ec7a1` |
| `apps/editor/src/lib/bench/p23b-m1-record.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `ecd30ca5862b` |
| `apps/editor/src/lib/bench/p23b11-connected-case.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `7e25e60877c3` |
| `apps/editor/src/lib/bench/p23b5-reuse-ratchet.cli.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `cba33541d33b` |
| `apps/editor/src/lib/bench/p23b5-reuse-ratchet.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `1579f8583218` |
| `apps/editor/src/lib/bench/plan-bench.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `d8519b3de3de` |
| `apps/editor/src/lib/bench/record-baseline.cli.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `4df7d3ad7758` |
| `apps/editor/src/lib/bench/record-baseline.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `a14c0deda76b` |
| `apps/editor/src/lib/bench/three-stats.ts` | REMOVE IN #115 | — | §5.1 P23B bench apparatus | `0b1c7716d1b2` |
| `apps/editor/src/lib/content/assets.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/content/assets.ts` | §4.1 generic catalogue | `856fbe05071e` |
| `apps/editor/src/lib/content/chopin-layout.ts` | ISOLATE FOR LEGACY | — | §5.1 Chopin content; origin removed after freeze | `37f19143c696` |
| `apps/editor/src/lib/content/chopin-project.json` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/content/chopin-project.json` | §5.1 Chopin content; origin removed after freeze | `abde62587d8d` |
| `apps/editor/src/lib/content/chopin-project.ts` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/content/chopin-project.ts` | §5.1 Chopin content; origin removed after freeze | `9215f1f1f913` |
| `apps/editor/src/lib/content/chopin-room-presentation.ts` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/content/chopin-room-presentation.ts` | §5.1 Chopin content; origin removed after freeze | `3a9cdb7e7a61` |
| `apps/editor/src/lib/content/materials.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/content/materials.ts` | §4.1 generic catalogue | `e5998e0bd446` |
| `apps/editor/src/lib/content/package-format.ts` | REMOVE IN #115 | — | §5.1 thin facade | `5ef239d9922d` |
| `apps/editor/src/lib/content/rooms-to-layout.ts` | ISOLATE FOR LEGACY | — | §5.1 Chopin content; origin removed after freeze | `9c2bf682c7b8` |
| `apps/editor/src/lib/content/rooms.ts` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/content/rooms.ts` | §5.1 Chopin content; origin removed after freeze | `dcfac893cb2d` |
| `apps/editor/src/lib/content/scene-codec/index.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/content/scene-codec/index.ts` | §5.1 thin facade | `ebf44c801b5d` |
| `apps/editor/src/lib/content/scene-format.ts` | REMOVE IN #115 | — | §5.1 thin facade | `9276c6a086e8` |
| `apps/editor/src/lib/content/scene-validation.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/content/scene-validation.ts` | §4.1 generic catalogue | `e82eb60a192d` |
| `apps/editor/src/lib/content/scene.json` | ISOLATE FOR LEGACY | — | §5.1 Chopin content; origin removed after freeze | `51c428692e47` |
| `apps/editor/src/lib/content/scene.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/content/scene.ts` | §4.1 generic catalogue | `a7b5a76488bc` |
| `apps/editor/src/lib/content/texture-uri.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/content/texture-uri.ts` | §4.1 generic catalogue | `eed7402532f7` |
| `apps/editor/src/lib/editor/CameraFlowPanel.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/CameraFlowPanel.svelte` | §5.1 lib/editor shell removed; frozen copy only | `767662eb173f` |
| `apps/editor/src/lib/editor/DEBUGGING.md` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `246f19887973` |
| `apps/editor/src/lib/editor/EditorAppBar.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorAppBar.svelte` | §5.1 lib/editor shell removed; frozen copy only | `3f4c3213c5c2` |
| `apps/editor/src/lib/editor/EditorAssetLibrary.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorAssetLibrary.svelte` | §5.1 lib/editor shell removed; frozen copy only | `11145502f3a2` |
| `apps/editor/src/lib/editor/EditorGrid.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorGrid.svelte` | §5.1 lib/editor shell removed; frozen copy only | `60ff45dac75c` |
| `apps/editor/src/lib/editor/EditorInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `1dcd081e5fea` |
| `apps/editor/src/lib/editor/EditorLeftSidebar.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorLeftSidebar.svelte` | §5.1 lib/editor shell removed; frozen copy only | `9ba330cd82ac` |
| `apps/editor/src/lib/editor/EditorLightInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorLightInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `a803c799537a` |
| `apps/editor/src/lib/editor/EditorMaterialChoiceDialog.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorMaterialChoiceDialog.svelte` | §5.1 lib/editor shell removed; frozen copy only | `599f2424290f` |
| `apps/editor/src/lib/editor/EditorMaterialInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorMaterialInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `407f2cb115b4` |
| `apps/editor/src/lib/editor/EditorModelEntity.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorModelEntity.svelte` | §5.1 lib/editor shell removed; frozen copy only | `d5d15262c6fa` |
| `apps/editor/src/lib/editor/EditorOrientationGizmo.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `eaa336ced837` |
| `apps/editor/src/lib/editor/EditorOrientationGizmoProjector.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `ed28dbcc9ab5` |
| `apps/editor/src/lib/editor/EditorPlacementInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorPlacementInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `cdc13c70e763` |
| `apps/editor/src/lib/editor/EditorPlacementTools.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorPlacementTools.svelte` | §5.1 lib/editor shell removed; frozen copy only | `297b92392ba4` |
| `apps/editor/src/lib/editor/EditorPrimitiveInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorPrimitiveInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `66d02dc48e10` |
| `apps/editor/src/lib/editor/EditorProjectMenu.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorProjectMenu.svelte` | §5.1 lib/editor shell removed; frozen copy only | `efec052a73ea` |
| `apps/editor/src/lib/editor/EditorSceneEntities.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorSceneEntities.svelte` | §5.1 lib/editor shell removed; frozen copy only | `9f4fd71c53ff` |
| `apps/editor/src/lib/editor/EditorSceneTree.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorSceneTree.svelte` | §5.1 lib/editor shell removed; frozen copy only | `aeca3b64c6fd` |
| `apps/editor/src/lib/editor/EditorSelection.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorSelection.svelte` | §5.1 lib/editor shell removed; frozen copy only | `68fbc07b4231` |
| `apps/editor/src/lib/editor/EditorSelectionHelper.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorSelectionHelper.svelte` | §5.1 lib/editor shell removed; frozen copy only | `f03e32f7e165` |
| `apps/editor/src/lib/editor/EditorTransformControls.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorTransformControls.svelte` | §5.1 lib/editor shell removed; frozen copy only | `dfe185a7c563` |
| `apps/editor/src/lib/editor/EditorTransformInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorTransformInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `e9133da6fbeb` |
| `apps/editor/src/lib/editor/EditorViewport.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorViewport.svelte` | §5.1 lib/editor shell removed; frozen copy only | `6c9822782348` |
| `apps/editor/src/lib/editor/EditorViewportGridControls.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `964817ff5bf0` |
| `apps/editor/src/lib/editor/EditorViewportToolbar.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/EditorViewportToolbar.svelte` | §5.1 lib/editor shell removed; frozen copy only | `6445f8b69244` |
| `apps/editor/src/lib/editor/MuseumEditorApp.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/MuseumEditorApp.svelte` | §5.1 lib/editor shell removed; frozen copy only | `2904f150de41` |
| `apps/editor/src/lib/editor/README.md` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `e5829faa80b2` |
| `apps/editor/src/lib/editor/UnifiedProjectTree.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `4643f89c5292` |
| `apps/editor/src/lib/editor/app/CameraPlanInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/app/CameraPlanInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `2bc595916cff` |
| `apps/editor/src/lib/editor/app/CameraPlanWorkspace.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `d1f981533459` |
| `apps/editor/src/lib/editor/app/CameraSidebar.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `50933a662643` |
| `apps/editor/src/lib/editor/app/DomainSpine.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `31cbb702f948` |
| `apps/editor/src/lib/editor/app/EditorApp.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `621741c0a986` |
| `apps/editor/src/lib/editor/app/EditorSidebar.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `778c9fc8a5d3` |
| `apps/editor/src/lib/editor/app/PlanWorkspace.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `0d6afc590725` |
| `apps/editor/src/lib/editor/app/ProjectRow.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `3dd4e521be00` |
| `apps/editor/src/lib/editor/app/ProjectShellHost.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `bb1d22bd8b13` |
| `apps/editor/src/lib/editor/app/PublishSurface.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `c0a06686ff52` |
| `apps/editor/src/lib/editor/app/StatusBar.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `555d58ec8bb1` |
| `apps/editor/src/lib/editor/app/ToolTray.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `da97e3fdec89` |
| `apps/editor/src/lib/editor/app/Workspace3DView.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `2938538efe8c` |
| `apps/editor/src/lib/editor/app/WorkspaceRibbon.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `612561ee4a9f` |
| `apps/editor/src/lib/editor/app/active-editor-selection.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/app/active-editor-selection.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `8385677d9466` |
| `apps/editor/src/lib/editor/app/editor-view-mode.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/app/editor-view-mode.ts` | §5.1 lib/editor shell removed; frozen copy only | `dfc9d6338f71` |
| `apps/editor/src/lib/editor/app/editor-view-state.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/app/editor-view-state.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `cd610d9c899f` |
| `apps/editor/src/lib/editor/app/hierarchy-navigator-state.svelte.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `4062f37b3fdf` |
| `apps/editor/src/lib/editor/app/inspector-target.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/app/inspector-target.ts` | §5.1 lib/editor shell removed; frozen copy only | `28e0a0a67345` |
| `apps/editor/src/lib/editor/app/project-persistence-presentation.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `4849e2244f01` |
| `apps/editor/src/lib/editor/app/publication-presentation.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `e30792bdfdcb` |
| `apps/editor/src/lib/editor/app/roving-focus.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/a11y/roving-focus.ts` | §4.3 retained pure semantics | `23d7a1e1c05d` |
| `apps/editor/src/lib/editor/camera-plan/CameraPlanToolbar.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `1ca29b6e6b0c` |
| `apps/editor/src/lib/editor/camera-plan/CameraPlanViewport.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `ecdccdfd9bf4` |
| `apps/editor/src/lib/editor/camera-plan/camera-plan-hit.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `3f83f5fa8a12` |
| `apps/editor/src/lib/editor/camera-plan/camera-plan-hover.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `545c2f79e657` |
| `apps/editor/src/lib/editor/camera-plan/camera-plan-state.svelte.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `3f67eff4f4ab` |
| `apps/editor/src/lib/editor/camera/EditorCameraConnectionTiming.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraConnectionTiming.svelte` | §5.1 lib/editor shell removed; frozen copy only | `d6d113bf1c86` |
| `apps/editor/src/lib/editor/camera/EditorCameraEdgePreviewActions.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraEdgePreviewActions.svelte` | §5.1 lib/editor shell removed; frozen copy only | `aa7421801f10` |
| `apps/editor/src/lib/editor/camera/EditorCameraFovField.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraFovField.svelte` | §5.1 lib/editor shell removed; frozen copy only | `8c985fd5598f` |
| `apps/editor/src/lib/editor/camera/EditorCameraFramingControls.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraFramingControls.svelte` | §5.1 lib/editor shell removed; frozen copy only | `78c30b214e81` |
| `apps/editor/src/lib/editor/camera/EditorCameraFramingHelpers.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraFramingHelpers.svelte` | §5.1 lib/editor shell removed; frozen copy only | `c82369a24fef` |
| `apps/editor/src/lib/editor/camera/EditorCameraHelpers.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraHelpers.svelte` | §5.1 lib/editor shell removed; frozen copy only | `489900819db0` |
| `apps/editor/src/lib/editor/camera/EditorCameraInspector.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraInspector.svelte` | §5.1 lib/editor shell removed; frozen copy only | `12b132397d31` |
| `apps/editor/src/lib/editor/camera/EditorCameraLabelProjector.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `9604160b4260` |
| `apps/editor/src/lib/editor/camera/EditorCameraLabelsOverlay.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `8c0bfaa392f7` |
| `apps/editor/src/lib/editor/camera/EditorCameraPathHelpers.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraPathHelpers.svelte` | §5.1 lib/editor shell removed; frozen copy only | `68ae3e462424` |
| `apps/editor/src/lib/editor/camera/EditorCameraPreviewControls.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraPreviewControls.svelte` | §5.1 lib/editor shell removed; frozen copy only | `818f487d9c9b` |
| `apps/editor/src/lib/editor/camera/EditorCameraRig.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraRig.svelte` | §5.1 lib/editor shell removed; frozen copy only | `82d822b52fbe` |
| `apps/editor/src/lib/editor/camera/EditorCameraTimelineDots.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraTimelineDots.svelte` | §5.1 lib/editor shell removed; frozen copy only | `de5554fc0bbd` |
| `apps/editor/src/lib/editor/camera/EditorCameraTimelineFrame.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraTimelineFrame.svelte` | §5.1 lib/editor shell removed; frozen copy only | `710823bec663` |
| `apps/editor/src/lib/editor/camera/EditorCameraTimelinePanel.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraTimelinePanel.svelte` | §5.1 lib/editor shell removed; frozen copy only | `819aac584e1e` |
| `apps/editor/src/lib/editor/camera/EditorCameraTimelineRuler.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraTimelineRuler.svelte` | §5.1 lib/editor shell removed; frozen copy only | `49191125b667` |
| `apps/editor/src/lib/editor/camera/EditorCameraTree.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraTree.svelte` | §5.1 lib/editor shell removed; frozen copy only | `8ac00ecd6bdc` |
| `apps/editor/src/lib/editor/camera/EditorCameraViewHelpers.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/EditorCameraViewHelpers.svelte` | §5.1 lib/editor shell removed; frozen copy only | `992bd4d21a1a` |
| `apps/editor/src/lib/editor/camera/editor-camera-connections.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-connections.ts` | §4.3 retained pure semantics | `700dbf5a1c7b` |
| `apps/editor/src/lib/editor/camera/editor-camera-framing-authoring.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-framing-authoring.ts` | §4.3 retained pure semantics | `7fb7a14048a3` |
| `apps/editor/src/lib/editor/camera/editor-camera-framing-envelope.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-framing-envelope.ts` | §4.3 retained pure semantics | `e3ea2ccc28ed` |
| `apps/editor/src/lib/editor/camera/editor-camera-framing.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-framing.ts` | §4.3 retained pure semantics | `9f5aff390580` |
| `apps/editor/src/lib/editor/camera/editor-camera-labels.svelte.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `af0724841612` |
| `apps/editor/src/lib/editor/camera/editor-camera-labels.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `b9bdb9c4e0b1` |
| `apps/editor/src/lib/editor/camera/editor-camera-path.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-path.ts` | §4.3 retained pure semantics | `a7152ae88e46` |
| `apps/editor/src/lib/editor/camera/editor-camera-preview-affordances.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/editor-camera-preview-affordances.ts` | §5.1 lib/editor shell removed; frozen copy only | `ec91aff09bd2` |
| `apps/editor/src/lib/editor/camera/editor-camera-timeline.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/editor-camera-timeline.ts` | §5.1 lib/editor shell removed; frozen copy only | `38abac143389` |
| `apps/editor/src/lib/editor/camera/editor-camera-timing.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-timing.ts` | §4.3 retained pure semantics | `89b9985346b5` |
| `apps/editor/src/lib/editor/camera/editor-camera-view.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-camera-view.ts` | §4.3 retained pure semantics | `5181fb821e8e` |
| `apps/editor/src/lib/editor/camera/editor-camera.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/camera/editor-camera.ts` | §5.1 lib/editor shell removed; frozen copy only | `55463eabb4e5` |
| `apps/editor/src/lib/editor/camera/editor-directed-edge-motion.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/editor-directed-edge-motion.ts` | §4.3 retained pure semantics | `cfe488ca6743` |
| `apps/editor/src/lib/editor/cluster-obb.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/cluster-obb.ts` | §4.3 retained pure semantics | `774ed83f46a0` |
| `apps/editor/src/lib/editor/context-menu/ContextMenu.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `ad4c97528c36` |
| `apps/editor/src/lib/editor/context-menu/camera-menu-items.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/context-menu/camera-menu-items.ts` | §5.1 lib/editor shell removed; frozen copy only | `351264fb8c38` |
| `apps/editor/src/lib/editor/context-menu/context-menu-state.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/context-menu/context-menu-state.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `49245917a1b9` |
| `apps/editor/src/lib/editor/context-menu/editable-target.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/context-menu/editable-target.ts` | §5.1 lib/editor shell removed; frozen copy only | `0c8b457672a7` |
| `apps/editor/src/lib/editor/context-menu/plan-menu-items.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/context-menu/plan-menu-items.ts` | §5.1 lib/editor shell removed; frozen copy only | `c87cc568f0d6` |
| `apps/editor/src/lib/editor/context-menu/scene-menu-items.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/context-menu/scene-menu-items.ts` | §5.1 lib/editor shell removed; frozen copy only | `2fc48939ca4b` |
| `apps/editor/src/lib/editor/context-menu/selection-before-menu.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `321c076dac46` |
| `apps/editor/src/lib/editor/editor-assets.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-assets.ts` | §5.1 lib/editor shell removed; frozen copy only | `15d06c97f592` |
| `apps/editor/src/lib/editor/editor-cluster-transform.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-cluster-transform.ts` | §5.1 lib/editor shell removed; frozen copy only | `841d7aadbf39` |
| `apps/editor/src/lib/editor/editor-command-intent.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-command-intent.ts` | §5.1 lib/editor shell removed; frozen copy only | `88d357903e6b` |
| `apps/editor/src/lib/editor/editor-lights.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-lights.ts` | §5.1 lib/editor shell removed; frozen copy only | `2491766bbf9c` |
| `apps/editor/src/lib/editor/editor-navigation-graph.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-navigation-graph.ts` | §5.1 lib/editor shell removed; frozen copy only | `b0a290468316` |
| `apps/editor/src/lib/editor/editor-orientation-gizmo.svelte.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `1e891182a318` |
| `apps/editor/src/lib/editor/editor-orientation-interaction.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `222c367d8f4b` |
| `apps/editor/src/lib/editor/editor-orientation-projection.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `a0c47476232f` |
| `apps/editor/src/lib/editor/editor-outliner.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-outliner.ts` | §5.1 lib/editor shell removed; frozen copy only | `d2b65f0b08c9` |
| `apps/editor/src/lib/editor/editor-placement.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-placement.ts` | §5.1 lib/editor shell removed; frozen copy only | `67a30751a49f` |
| `apps/editor/src/lib/editor/editor-primitives.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-primitives.ts` | §5.1 lib/editor shell removed; frozen copy only | `aeabe9f8f674` |
| `apps/editor/src/lib/editor/editor-selection.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-selection.ts` | §5.1 lib/editor shell removed; frozen copy only | `99172e754b72` |
| `apps/editor/src/lib/editor/editor-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `b250167a4c7d` |
| `apps/editor/src/lib/editor/editor-textures.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-textures.ts` | §5.1 lib/editor shell removed; frozen copy only | `dbd0ddde31cc` |
| `apps/editor/src/lib/editor/editor-transform.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-transform.ts` | §5.1 lib/editor shell removed; frozen copy only | `ba99861456fd` |
| `apps/editor/src/lib/editor/editor-types.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/editor-types.ts` | §5.1 lib/editor shell removed; frozen copy only | `827506f2f7eb` |
| `apps/editor/src/lib/editor/editor-vector.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/editor-vector.ts` | §4.3 retained pure semantics | `e5583ad1d3de` |
| `apps/editor/src/lib/editor/export/package-exporter.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/export/package-exporter.ts` | §5.1 lib/editor shell removed; frozen copy only | `c952808c2d2b` |
| `apps/editor/src/lib/editor/fields/EditorNumberField.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/fields/EditorNumberField.svelte` | §5.1 lib/editor shell removed; frozen copy only | `b4a8c5314012` |
| `apps/editor/src/lib/editor/fields/EditorProgressField.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/fields/EditorProgressField.svelte` | §5.1 lib/editor shell removed; frozen copy only | `4ad98b77cb90` |
| `apps/editor/src/lib/editor/fields/EditorVec3Field.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/fields/EditorVec3Field.svelte` | §5.1 lib/editor shell removed; frozen copy only | `ca86b8053c48` |
| `apps/editor/src/lib/editor/gizmo/EditorTransformControlsHost.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/EditorTransformControlsHost.svelte` | §5.1 lib/editor shell removed; frozen copy only | `a33ee3d96f9a` |
| `apps/editor/src/lib/editor/gizmo/camera-gizmo-adapter.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/camera-gizmo-adapter.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `c96045ded83b` |
| `apps/editor/src/lib/editor/gizmo/editor-gizmo-contract.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/editor-gizmo-contract.ts` | §5.1 lib/editor shell removed; frozen copy only | `fb2b31d1c1c4` |
| `apps/editor/src/lib/editor/gizmo/editor-gizmo-host-controller.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/editor-gizmo-host-controller.ts` | §5.1 lib/editor shell removed; frozen copy only | `b82748b6e742` |
| `apps/editor/src/lib/editor/gizmo/editor-gizmo-policy.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/editor-gizmo-policy.ts` | §5.1 lib/editor shell removed; frozen copy only | `f0c7c6556486` |
| `apps/editor/src/lib/editor/gizmo/layout-gizmo-adapter.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/layout-gizmo-adapter.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `4dd6857b88fe` |
| `apps/editor/src/lib/editor/gizmo/layout-gizmo-candidate.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/layout-gizmo-candidate.ts` | §5.1 lib/editor shell removed; frozen copy only | `c05e69d4c618` |
| `apps/editor/src/lib/editor/gizmo/layout-gizmo-target.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/layout-gizmo-target.ts` | §5.1 lib/editor shell removed; frozen copy only | `58e1d045c7ac` |
| `apps/editor/src/lib/editor/gizmo/scene-gizmo-adapter.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/gizmo/scene-gizmo-adapter.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `c66b72195393` |
| `apps/editor/src/lib/editor/helpers/document-clone.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/helpers/document-clone.ts` | §5.1 lib/editor shell removed; frozen copy only | `56dad86782d1` |
| `apps/editor/src/lib/editor/helpers/mime-sniff.ts` | RETAIN AS FOUNDATION (relocate) | `lib/platform/mime-sniff.ts` | §4.1 platform relocation | `c512516d33f6` |
| `apps/editor/src/lib/editor/helpers/package-sha.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `b580ffcc5d2c` |
| `apps/editor/src/lib/editor/helpers/register-verified-project-asset.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `5f0bc37de906` |
| `apps/editor/src/lib/editor/helpers/route-clone.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/camera/route-clone.ts` | §4.3 retained pure semantics | `728be6528e50` |
| `apps/editor/src/lib/editor/helpers/scene-keys.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/helpers/scene-keys.ts` | §5.1 lib/editor shell removed; frozen copy only | `362e8fd98c88` |
| `apps/editor/src/lib/editor/helpers/validators-runner.ts` | RETAIN AS FOUNDATION (relocate) | `lib/platform/validators-runner.ts` | §4.1 platform relocation | `6bd5be208a10` |
| `apps/editor/src/lib/editor/hierarchy/HierarchyNavigator.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `b4768463b887` |
| `apps/editor/src/lib/editor/hierarchy/HierarchyRow.svelte` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `d450e1685bd8` |
| `apps/editor/src/lib/editor/hierarchy/hierarchy-identity-presentation.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `1bb28609316a` |
| `apps/editor/src/lib/editor/hierarchy/hierarchy-page-projection.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `7c1e63f66103` |
| `apps/editor/src/lib/editor/hierarchy/hierarchy-plan-bridge.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `591465578ca3` |
| `apps/editor/src/lib/editor/hierarchy/hierarchy-search.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `6b1d5f2ea116` |
| `apps/editor/src/lib/editor/hierarchy/hierarchy-source-index.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `b9f4d107bb5d` |
| `apps/editor/src/lib/editor/hooks/editor-shell-boot-core.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/hooks/editor-shell-boot-core.ts` | §5.1 lib/editor shell removed; frozen copy only | `1eb3b69efa59` |
| `apps/editor/src/lib/editor/hooks/editor-shell-boot.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/hooks/editor-shell-boot.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `6477f9408dab` |
| `apps/editor/src/lib/editor/hooks/shortcuts.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/hooks/shortcuts.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `a5cfdb0e3032` |
| `apps/editor/src/lib/editor/hooks/use-camera-preview.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/hooks/use-camera-preview.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `8616cb830acc` |
| `apps/editor/src/lib/editor/hooks/use-camera-timeline.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/hooks/use-camera-timeline.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `9eb93e03fb8b` |
| `apps/editor/src/lib/editor/identity/layout-identity-view.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/identity/layout-identity-view.ts` | §5.1 lib/editor shell removed; frozen copy only | `41909f93a61b` |
| `apps/editor/src/lib/editor/import/package-importer.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/import/package-importer.ts` | §5.1 lib/editor shell removed; frozen copy only | `cf4e911c15c3` |
| `apps/editor/src/lib/editor/interaction-constants.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/interaction-constants.ts` | §5.1 lib/editor shell removed; frozen copy only | `d923a6f43103` |
| `apps/editor/src/lib/editor/interaction-cursor.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/interaction-cursor.ts` | §5.1 lib/editor shell removed; frozen copy only | `60842e5e6c88` |
| `apps/editor/src/lib/editor/layout/LayoutDraftToolbar.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/LayoutDraftToolbar.svelte` | §5.1 lib/editor shell removed; frozen copy only | `47eebdb51220` |
| `apps/editor/src/lib/editor/layout/LayoutPlanViewport.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/LayoutPlanViewport.svelte` | §5.1 lib/editor shell removed; frozen copy only | `b2754a660c70` |
| `apps/editor/src/lib/editor/layout/LayoutPreviewScene.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/LayoutPreviewScene.svelte` | §5.1 lib/editor shell removed; frozen copy only | `43c712ffe58d` |
| `apps/editor/src/lib/editor/layout/LayoutRenderGate.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/LayoutRenderGate.svelte` | §5.1 lib/editor shell removed; frozen copy only | `a582d0fec292` |
| `apps/editor/src/lib/editor/layout/PlanCanvasChrome.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/PlanCanvasChrome.svelte` | §5.1 lib/editor shell removed; frozen copy only | `8f33c2f39236` |
| `apps/editor/src/lib/editor/layout/PlanDraftIcon.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/PlanDraftIcon.svelte` | §5.1 lib/editor shell removed; frozen copy only | `a46c884111f5` |
| `apps/editor/src/lib/editor/layout/PlanEmptyGhost.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/PlanEmptyGhost.svelte` | §5.1 lib/editor shell removed; frozen copy only | `ceb4f005cca3` |
| `apps/editor/src/lib/editor/layout/PlanSvg.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/PlanSvg.svelte` | §5.1 lib/editor shell removed; frozen copy only | `a3b738ef67d0` |
| `apps/editor/src/lib/editor/layout/arrange-delete.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `3caef3bdb93e` |
| `apps/editor/src/lib/editor/layout/arrange-hit.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/arrange-hit.ts` | §5.1 lib/editor shell removed; frozen copy only | `88227b43dd3c` |
| `apps/editor/src/lib/editor/layout/layout-3d-picking.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-3d-picking.ts` | §5.1 lib/editor shell removed; frozen copy only | `65495841cb99` |
| `apps/editor/src/lib/editor/layout/layout-click-declaration.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-click-declaration.ts` | §5.1 lib/editor shell removed; frozen copy only | `8ab4373d349a` |
| `apps/editor/src/lib/editor/layout/layout-editing.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-editing.ts` | §5.1 lib/editor shell removed; frozen copy only | `be0cb7f28d89` |
| `apps/editor/src/lib/editor/layout/layout-exact-input.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/layout/layout-exact-input.ts` | §4.3 retained pure semantics | `b2ad2ff098ce` |
| `apps/editor/src/lib/editor/layout/layout-import-replacement.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-import-replacement.ts` | §5.1 lib/editor shell removed; frozen copy only | `630e4e461b7e` |
| `apps/editor/src/lib/editor/layout/layout-interaction.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-interaction.ts` | §5.1 lib/editor shell removed; frozen copy only | `4c6bd4cf3d05` |
| `apps/editor/src/lib/editor/layout/layout-mesh-factory.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-mesh-factory.ts` | §5.1 lib/editor shell removed; frozen copy only | `7a3e7260b653` |
| `apps/editor/src/lib/editor/layout/layout-mutation-runner.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-mutation-runner.ts` | §5.1 lib/editor shell removed; frozen copy only | `19f576d1ba75` |
| `apps/editor/src/lib/editor/layout/layout-object-editing.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-object-editing.ts` | §5.1 lib/editor shell removed; frozen copy only | `57b18ecd6e41` |
| `apps/editor/src/lib/editor/layout/layout-opening-editing.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-opening-editing.ts` | §5.1 lib/editor shell removed; frozen copy only | `a7f7036d6957` |
| `apps/editor/src/lib/editor/layout/layout-plan-transform.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-plan-transform.ts` | §5.1 lib/editor shell removed; frozen copy only | `dd038cd12a04` |
| `apps/editor/src/lib/editor/layout/layout-preview-geometry.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-preview-geometry.ts` | §5.1 lib/editor shell removed; frozen copy only | `d29bac53deac` |
| `apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-preview-state.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `c2833040f231` |
| `apps/editor/src/lib/editor/layout/layout-room-editing.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-room-editing.ts` | §5.1 lib/editor shell removed; frozen copy only | `e922f63a2174` |
| `apps/editor/src/lib/editor/layout/layout-room-transform.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-room-transform.ts` | §5.1 lib/editor shell removed; frozen copy only | `09ae09e18499` |
| `apps/editor/src/lib/editor/layout/layout-transaction.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `e437cb646a68` |
| `apps/editor/src/lib/editor/layout/layout-transient-edit.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-transient-edit.ts` | §5.1 lib/editor shell removed; frozen copy only | `69527d7a0036` |
| `apps/editor/src/lib/editor/layout/layout-transient-room-unit.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-transient-room-unit.ts` | §5.1 lib/editor shell removed; frozen copy only | `8083584ad416` |
| `apps/editor/src/lib/editor/layout/layout-wall-chain-closure.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-wall-chain-closure.ts` | §5.1 lib/editor shell removed; frozen copy only | `51756b80ece7` |
| `apps/editor/src/lib/editor/layout/layout-wall-material.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/layout-wall-material.ts` | §5.1 lib/editor shell removed; frozen copy only | `91e23755be5f` |
| `apps/editor/src/lib/editor/layout/p23b-gesture-sampling-report.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/p23b-gesture-sampling-report.ts` | §5.1 lib/editor shell removed; frozen copy only | `ef0959880089` |
| `apps/editor/src/lib/editor/layout/p23b-interaction-measure.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/p23b-interaction-measure.ts` | §5.1 lib/editor shell removed; frozen copy only | `2f3549e07cc2` |
| `apps/editor/src/lib/editor/layout/p23b-m1-room-drag-arm.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `10aeeb626545` |
| `apps/editor/src/lib/editor/layout/p23b-m1-room-label-arm.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/p23b-m1-room-label-arm.ts` | §5.1 lib/editor shell removed; frozen copy only | `a8aedb5a811f` |
| `apps/editor/src/lib/editor/layout/p23b-mesh-identity.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/p23b-mesh-identity.ts` | §5.1 lib/editor shell removed; frozen copy only | `79c50fdcdf6f` |
| `apps/editor/src/lib/editor/layout/plan-acquisition.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-acquisition.ts` | §5.1 lib/editor shell removed; frozen copy only | `3f290e5a5730` |
| `apps/editor/src/lib/editor/layout/plan-architecture-grammar.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-architecture-grammar.ts` | §5.1 lib/editor shell removed; frozen copy only | `70a5272331f4` |
| `apps/editor/src/lib/editor/layout/plan-attention.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-attention.ts` | §5.1 lib/editor shell removed; frozen copy only | `0720a09e9a16` |
| `apps/editor/src/lib/editor/layout/plan-camera-projection.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-camera-projection.ts` | §5.1 lib/editor shell removed; frozen copy only | `59bfa962683b` |
| `apps/editor/src/lib/editor/layout/plan-dimensions.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-dimensions.ts` | §5.1 lib/editor shell removed; frozen copy only | `0961ac723600` |
| `apps/editor/src/lib/editor/layout/plan-hit.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/layout/plan-hit.ts` | §4.3 retained pure semantics | `d94df456b1ee` |
| `apps/editor/src/lib/editor/layout/plan-keyboard-readout.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-keyboard-readout.ts` | §5.1 lib/editor shell removed; frozen copy only | `d88e4cfa9bfb` |
| `apps/editor/src/lib/editor/layout/plan-keyboard-session.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-keyboard-session.ts` | §5.1 lib/editor shell removed; frozen copy only | `b0e36c0857a9` |
| `apps/editor/src/lib/editor/layout/plan-keyboard-traversal.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-keyboard-traversal.ts` | §5.1 lib/editor shell removed; frozen copy only | `df3cd615dd20` |
| `apps/editor/src/lib/editor/layout/plan-numeric-entry.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/layout/plan-numeric-entry.ts` | §4.3 retained pure semantics | `681fccc92614` |
| `apps/editor/src/lib/editor/layout/plan-overlays.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-overlays.ts` | §5.1 lib/editor shell removed; frozen copy only | `c0f5be02bbb4` |
| `apps/editor/src/lib/editor/layout/plan-preview.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-preview.ts` | §5.1 lib/editor shell removed; frozen copy only | `88de35d6bada` |
| `apps/editor/src/lib/editor/layout/plan-refusal.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-refusal.ts` | §5.1 lib/editor shell removed; frozen copy only | `076a9dc5cb85` |
| `apps/editor/src/lib/editor/layout/plan-room-labels.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-room-labels.ts` | §5.1 lib/editor shell removed; frozen copy only | `35dfa5122f0a` |
| `apps/editor/src/lib/editor/layout/plan-salience.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-salience.ts` | §5.1 lib/editor shell removed; frozen copy only | `013c8954e51e` |
| `apps/editor/src/lib/editor/layout/plan-scene-footprint.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/plan-scene-footprint.ts` | §4.3 retained pure semantics | `6eefdd6e8e88` |
| `apps/editor/src/lib/editor/layout/plan-scene-hit.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/plan-scene-hit.ts` | §4.3 retained pure semantics | `d1115158d06a` |
| `apps/editor/src/lib/editor/layout/plan-scene-transform.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-scene-transform.ts` | §5.1 lib/editor shell removed; frozen copy only | `3fa7d56b1fc6` |
| `apps/editor/src/lib/editor/layout/plan-snap-grammar.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-snap-grammar.ts` | §5.1 lib/editor shell removed; frozen copy only | `d607ae8e908b` |
| `apps/editor/src/lib/editor/layout/plan-text-measure.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/plan-text-measure.ts` | §5.1 lib/editor shell removed; frozen copy only | `766a5a4891c8` |
| `apps/editor/src/lib/editor/layout/prepared-wall-meshes.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/prepared-wall-meshes.ts` | §5.1 lib/editor shell removed; frozen copy only | `90ddc00a7237` |
| `apps/editor/src/lib/editor/layout/room-label-grid-key.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/layout/room-label-grid-key.ts` | §5.1 lib/editor shell removed; frozen copy only | `f9f3e7e8b6c1` |
| `apps/editor/src/lib/editor/obb-util.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/obb-util.ts` | §4.3 retained pure semantics | `20bab9b4e355` |
| `apps/editor/src/lib/editor/placement-ghost.svelte` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/placement-ghost.svelte` | §5.1 lib/editor shell removed; frozen copy only | `b50034d167b9` |
| `apps/editor/src/lib/editor/placement-ghost.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/placement-ghost.ts` | §5.1 lib/editor shell removed; frozen copy only | `37ef6c83f41b` |
| `apps/editor/src/lib/editor/preview/preview-coordinator.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `bde902176221` |
| `apps/editor/src/lib/editor/project-asset-load.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `0edf938233d8` |
| `apps/editor/src/lib/editor/project-asset-request-scope.ts` | RETAIN AS FOUNDATION (relocate) | `lib/platform/project-asset-request-scope.ts` | §4.1 platform relocation | `9c0e949d02da` |
| `apps/editor/src/lib/editor/project-asset-upload.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `62c6c7a7e693` |
| `apps/editor/src/lib/editor/project-persistence.ts` | RETAIN AS FOUNDATION (relocate) | `lib/platform/project-persistence.ts` | §4.1 platform relocation | `7546054088dc` |
| `apps/editor/src/lib/editor/publication-client.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `807d13439738` |
| `apps/editor/src/lib/editor/scale-vector.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/scene/scale-vector.ts` | §4.3 retained pure semantics | `ce3cd7f28142` |
| `apps/editor/src/lib/editor/snap-input-validation.ts` | RETAIN AS FOUNDATION (relocate) | `lib/authoring/layout/snap-input-validation.ts` | §4.3 retained pure semantics | `92f9aa222e94` |
| `apps/editor/src/lib/editor/store/binary-texture-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/binary-texture-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `93155f0f55fa` |
| `apps/editor/src/lib/editor/store/camera-preview-commands.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/camera-preview-commands.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `3c02394bc6f5` |
| `apps/editor/src/lib/editor/store/camera-preview-controller.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/camera-preview-controller.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `fc7c911ff040` |
| `apps/editor/src/lib/editor/store/camera-timeline-controller.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/camera-timeline-controller.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `a27d3aa9ffb8` |
| `apps/editor/src/lib/editor/store/controller-hosts.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/controller-hosts.ts` | §5.1 lib/editor shell removed; frozen copy only | `402c67508ad5` |
| `apps/editor/src/lib/editor/store/document-format-policy.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/document-format-policy.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `448f6f96d774` |
| `apps/editor/src/lib/editor/store/document-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/document-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `5b159168f609` |
| `apps/editor/src/lib/editor/store/editor-interaction-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/editor-interaction-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `104c6c84a1b4` |
| `apps/editor/src/lib/editor/store/history-controller.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/history-controller.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `43137a84d806` |
| `apps/editor/src/lib/editor/store/interaction-fsm.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/interaction-fsm.ts` | §5.1 lib/editor shell removed; frozen copy only | `1129f3578a89` |
| `apps/editor/src/lib/editor/store/material-resource-mutator.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/material-resource-mutator.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `4c9fe35df85c` |
| `apps/editor/src/lib/editor/store/mutation-guards.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/mutation-guards.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `2a4123744afe` |
| `apps/editor/src/lib/editor/store/navigation-graph-mutator.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/navigation-graph-mutator.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `92cdb2591033` |
| `apps/editor/src/lib/editor/store/path-anchor-mutator.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/path-anchor-mutator.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `6afbbc5848d6` |
| `apps/editor/src/lib/editor/store/placement-cluster-mutator.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/placement-cluster-mutator.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `9a52de6d6d35` |
| `apps/editor/src/lib/editor/store/project-export-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/project-export-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `3055f1af6dda` |
| `apps/editor/src/lib/editor/store/scene-roots.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/scene-roots.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `516c6e20ab70` |
| `apps/editor/src/lib/editor/store/selection-actions.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/selection-actions.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `7d9fb1a0f883` |
| `apps/editor/src/lib/editor/store/selection-store.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/selection-store.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `da26382be16a` |
| `apps/editor/src/lib/editor/store/session-state.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/session-state.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `198c3e067c28` |
| `apps/editor/src/lib/editor/store/texture-library-controller.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/texture-library-controller.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `4ecdd1a98d82` |
| `apps/editor/src/lib/editor/store/view-keyframe-controller.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/store/view-keyframe-controller.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `8573063fc819` |
| `apps/editor/src/lib/editor/styles/controls.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/controls.css` | §5.1 lib/editor shell removed; frozen copy only | `81fc718b7015` |
| `apps/editor/src/lib/editor/styles/editor-shell.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/editor-shell.css` | §5.1 lib/editor shell removed; frozen copy only | `424a1ba79841` |
| `apps/editor/src/lib/editor/styles/inspector.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/inspector.css` | §5.1 lib/editor shell removed; frozen copy only | `88bf57cd94d6` |
| `apps/editor/src/lib/editor/styles/plan.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/plan.css` | §5.1 lib/editor shell removed; frozen copy only | `af46bddab656` |
| `apps/editor/src/lib/editor/styles/scene-palette.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/scene-palette.ts` | §5.1 lib/editor shell removed; frozen copy only | `2089e787d9c5` |
| `apps/editor/src/lib/editor/styles/timeline.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/timeline.css` | §5.1 lib/editor shell removed; frozen copy only | `2024fab0f00f` |
| `apps/editor/src/lib/editor/styles/tokens.css` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/styles/tokens.css` | §5.1 lib/editor shell removed; frozen copy only | `c3b0d0c42149` |
| `apps/editor/src/lib/editor/texture-verifier.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/texture-verifier.ts` | §5.1 lib/editor shell removed; frozen copy only | `142e20f6dc0e` |
| `apps/editor/src/lib/editor/theme.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/editor/theme.svelte.ts` | §5.1 lib/editor shell removed; frozen copy only | `2f686a8032bd` |
| `apps/editor/src/lib/editor/unified-project-tree-model.ts` | REMOVE IN #115 | — | §5.1 lib/editor shell removed; frozen copy only | `c1e9c7edf130` |
| `apps/editor/src/lib/layout/layout-codec.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-codec.ts` | §5.1 facades + old Plan presentation | `73cab14dfdaf` |
| `apps/editor/src/lib/layout/layout-compat.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-compat.ts` | §5.1 facades + old Plan presentation | `fec1c2b0c467` |
| `apps/editor/src/lib/layout/layout-duplicate.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-duplicate.ts` | §5.1 facades + old Plan presentation | `680deb0b6325` |
| `apps/editor/src/lib/layout/layout-face-extraction.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `da101f5f4675` |
| `apps/editor/src/lib/layout/layout-geometry-curve.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-curve.ts` | §5.1 facades + old Plan presentation | `b31838a733eb` |
| `apps/editor/src/lib/layout/layout-geometry-objects.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-objects.ts` | §5.1 facades + old Plan presentation | `8c697b36a4b3` |
| `apps/editor/src/lib/layout/layout-geometry-openings.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-openings.ts` | §5.1 facades + old Plan presentation | `9ddc046ca516` |
| `apps/editor/src/lib/layout/layout-geometry-queries.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-queries.ts` | §5.1 facades + old Plan presentation | `f8286e026329` |
| `apps/editor/src/lib/layout/layout-geometry-source.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `3dce3c5a4e5a` |
| `apps/editor/src/lib/layout/layout-geometry-types.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-types.ts` | §5.1 facades + old Plan presentation | `3794490b3b9b` |
| `apps/editor/src/lib/layout/layout-geometry-validation.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry-validation.ts` | §5.1 facades + old Plan presentation | `cb3d002dabe1` |
| `apps/editor/src/lib/layout/layout-geometry.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-geometry.ts` | §5.1 facades + old Plan presentation | `20859ec70901` |
| `apps/editor/src/lib/layout/layout-identity.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-identity.ts` | §5.1 facades + old Plan presentation | `0181494d8074` |
| `apps/editor/src/lib/layout/layout-migration-math.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `2d3de3aa1248` |
| `apps/editor/src/lib/layout/layout-migration.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `9fcb9ad968a1` |
| `apps/editor/src/lib/layout/layout-opening-set.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `4a3265417885` |
| `apps/editor/src/lib/layout/layout-portals.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-portals.ts` | §5.1 facades + old Plan presentation | `153cde9c8f9a` |
| `apps/editor/src/lib/layout/layout-robust-orientation.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `140b33e8c10d` |
| `apps/editor/src/lib/layout/layout-room-frame.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-room-frame.ts` | §5.1 facades + old Plan presentation | `21cf959cf019` |
| `apps/editor/src/lib/layout/layout-room-isolation.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-room-isolation.ts` | §5.1 facades + old Plan presentation | `7af295c1d8a2` |
| `apps/editor/src/lib/layout/layout-room-move.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-room-move.ts` | §5.1 facades + old Plan presentation | `61cdd3eee508` |
| `apps/editor/src/lib/layout/layout-room-reconciliation.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `87ff6b697a55` |
| `apps/editor/src/lib/layout/layout-types.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-types.ts` | §5.1 facades + old Plan presentation | `0291b9236ea5` |
| `apps/editor/src/lib/layout/layout-wall-chain.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-chain.ts` | §5.1 facades + old Plan presentation | `0ef33712417c` |
| `apps/editor/src/lib/layout/layout-wall-first-codec.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `5a44210e2917` |
| `apps/editor/src/lib/layout/layout-wall-first-precision.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-first-precision.ts` | §5.1 facades + old Plan presentation | `48fa7a286ea8` |
| `apps/editor/src/lib/layout/layout-wall-first-types.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-first-types.ts` | §5.1 facades + old Plan presentation | `de6ebc9e4f25` |
| `apps/editor/src/lib/layout/layout-wall-noding.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-noding.ts` | §5.1 facades + old Plan presentation | `9b65320cc2eb` |
| `apps/editor/src/lib/layout/layout-wall-openings.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-openings.ts` | §5.1 facades + old Plan presentation | `bea6f26a3fd4` |
| `apps/editor/src/lib/layout/layout-wall-topology-ops.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/layout-wall-topology-ops.ts` | §5.1 facades + old Plan presentation | `b55fca01e305` |
| `apps/editor/src/lib/layout/layout-wall-topology.ts` | REMOVE IN #115 | — | §5.1 facades + old Plan presentation | `83d17cfe9842` |
| `apps/editor/src/lib/layout/plan-control-grammar.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/plan-control-grammar.ts` | §5.1 facades + old Plan presentation | `199d97ab533f` |
| `apps/editor/src/lib/layout/plan-render-model.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/layout/plan-render-model.ts` | §5.1 facades + old Plan presentation | `8e60e497145c` |
| `apps/editor/src/lib/layout/wall-mesh-builder.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/layout/wall-mesh-builder.ts` | §5.1 renderer mesh generation shared with visitor | `db275860e7ab` |
| `apps/editor/src/lib/museum/EditorPlacementRoot.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/EditorPlacementRoot.svelte` | §5.1 Chopin-specific; origin removed after freeze | `36c1dd910ba1` |
| `apps/editor/src/lib/museum/MuseumAssets.svelte` | RETAIN AS FOUNDATION | — | §4.1 generic renderer / resource lifetimes | `8e0e8cb8b26a` |
| `apps/editor/src/lib/museum/MuseumCanvas.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/MuseumCanvas.svelte` | §5.1 Chopin-specific; origin removed after freeze | `e34fc9fce0a3` |
| `apps/editor/src/lib/museum/MuseumEntities.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/MuseumEntities.svelte` | §5.1 Chopin-specific; origin removed after freeze | `cfff85ce3cef` |
| `apps/editor/src/lib/museum/MuseumScene.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/MuseumScene.svelte` | §5.1 Chopin-specific; origin removed after freeze | `a5cd6662b857` |
| `apps/editor/src/lib/museum/RoomFrame.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/RoomFrame.svelte` | §5.1 Chopin-specific; origin removed after freeze | `80f247a9cce1` |
| `apps/editor/src/lib/museum/assets/AssetFallback.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/AssetFallback.svelte` | §4.1 generic renderer / resource lifetimes | `4adc08c23d84` |
| `apps/editor/src/lib/museum/assets/AssetModel.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/AssetModel.svelte` | §4.1 generic renderer / resource lifetimes | `e860fed90db7` |
| `apps/editor/src/lib/museum/assets/FallbackMaterial.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/FallbackMaterial.svelte` | §4.1 generic renderer / resource lifetimes | `3427e1f4481e` |
| `apps/editor/src/lib/museum/assets/fallbacks.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/fallbacks.ts` | §4.1 generic renderer / resource lifetimes | `ca10f33d4f62` |
| `apps/editor/src/lib/museum/assets/instance-material-remap.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/instance-material-remap.ts` | §4.1 generic renderer / resource lifetimes | `cee1a91f0280` |
| `apps/editor/src/lib/museum/assets/model-utils.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/assets/model-utils.ts` | §4.1 generic renderer / resource lifetimes | `14b3459bd4e5` |
| `apps/editor/src/lib/museum/entities/EntityLight.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/entities/EntityLight.svelte` | §4.1 generic renderer / resource lifetimes | `2048c8536d4f` |
| `apps/editor/src/lib/museum/entities/EntityPrimitive.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/entities/EntityPrimitive.svelte` | §4.1 generic renderer / resource lifetimes | `7bc96da3caec` |
| `apps/editor/src/lib/museum/layout/CentralChamber.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/layout/CentralChamber.svelte` | §5.1 Chopin-specific; origin removed after freeze | `0dcff11c1096` |
| `apps/editor/src/lib/museum/layout/GroundPlinth.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/layout/GroundPlinth.svelte` | §4.1 generic renderer / resource lifetimes | `f0d25fc4637f` |
| `apps/editor/src/lib/museum/layout/LayoutMuseumShell.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/layout/LayoutMuseumShell.svelte` | §5.1 Chopin-specific; origin removed after freeze | `a439a80ad870` |
| `apps/editor/src/lib/museum/layout/RoomPortal.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/layout/RoomPortal.svelte` | §4.1 generic renderer / resource lifetimes | `a9cee7e1e920` |
| `apps/editor/src/lib/museum/layout/wall-material-factory.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/layout/wall-material-factory.ts` | §4.1 generic renderer / resource lifetimes | `d76fe46bd95a` |
| `apps/editor/src/lib/museum/materials/MaterialPreviewItem.svelte` | RETAIN AS FOUNDATION | — | §4.1 generic renderer / resource lifetimes | `17717126a000` |
| `apps/editor/src/lib/museum/materials/MuseumMaterial.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/materials/MuseumMaterial.svelte` | §4.1 generic renderer / resource lifetimes | `a56e82c0061f` |
| `apps/editor/src/lib/museum/materials/SceneInstanceMaterial.svelte` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/materials/SceneInstanceMaterial.svelte` | §4.1 generic renderer / resource lifetimes | `4072dad2abb8` |
| `apps/editor/src/lib/museum/materials/scene-instance-material.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/materials/scene-instance-material.ts` | §4.1 generic renderer / resource lifetimes | `2bf156a013d6` |
| `apps/editor/src/lib/museum/materials/surfaces/Ceiling.svelte` | REMOVE IN #115 | — | §2.2 orphan surfaces/*.svelte | `230afb234489` |
| `apps/editor/src/lib/museum/materials/surfaces/Floor.svelte` | REMOVE IN #115 | — | §2.2 orphan surfaces/*.svelte | `d0940da2c3dc` |
| `apps/editor/src/lib/museum/materials/surfaces/Wall.svelte` | REMOVE IN #115 | — | §2.2 orphan surfaces/*.svelte | `d9d073069ae4` |
| `apps/editor/src/lib/museum/materials/texture-cache.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/museum/materials/texture-cache.ts` | §4.1 generic renderer / resource lifetimes | `953c145af29f` |
| `apps/editor/src/lib/museum/navigation/CameraDirector.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/navigation/CameraDirector.svelte` | §5.1 Chopin-specific; origin removed after freeze | `f4ccce8ac047` |
| `apps/editor/src/lib/museum/navigation/NavigationNode.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/navigation/NavigationNode.svelte` | §5.1 Chopin-specific; origin removed after freeze | `3ad34212085b` |
| `apps/editor/src/lib/museum/paris-activation.ts` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/paris-activation.ts` | §5.1 Chopin-specific; origin removed after freeze | `d0638cb1cfe4` |
| `apps/editor/src/lib/museum/placement-registry.ts` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/placement-registry.ts` | §5.1 Chopin-specific; origin removed after freeze | `36bea9ceda95` |
| `apps/editor/src/lib/museum/rooms/DepartureRoom.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/DepartureRoom.svelte` | §5.1 Chopin-specific; origin removed after freeze | `b464ce885d99` |
| `apps/editor/src/lib/museum/rooms/EntranceRoom.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/EntranceRoom.svelte` | §5.1 Chopin-specific; origin removed after freeze | `4e89fcbb9a43` |
| `apps/editor/src/lib/museum/rooms/LegacyRoom.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/LegacyRoom.svelte` | §5.1 Chopin-specific; origin removed after freeze | `4789e1e1dafb` |
| `apps/editor/src/lib/museum/rooms/MusicChamber.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/MusicChamber.svelte` | §5.1 Chopin-specific; origin removed after freeze | `e12daefbc1e1` |
| `apps/editor/src/lib/museum/rooms/ParisSalon.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/ParisSalon.svelte` | §5.1 Chopin-specific; origin removed after freeze | `3d7311857134` |
| `apps/editor/src/lib/museum/rooms/PolandRoom.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/PolandRoom.svelte` | §5.1 Chopin-specific; origin removed after freeze | `551d21382c3c` |
| `apps/editor/src/lib/museum/rooms/WorkshopRoom.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/rooms/WorkshopRoom.svelte` | §5.1 Chopin-specific; origin removed after freeze | `348da9b36c1b` |
| `apps/editor/src/lib/museum/ui/MuseumHUD.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/lib/museum/ui/MuseumHUD.svelte` | §5.1 Chopin-specific; origin removed after freeze | `dee6c7ab298b` |
| `apps/editor/src/lib/project/compat-runtime.ts` | REMOVE IN #115 | — | §5.1 facade / compat-runtime | `694a6ad9826d` |
| `apps/editor/src/lib/project/project-codec.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/project/project-codec.ts` | §4.1 catalogue-configured strict codec | `4d5b24ed9eb0` |
| `apps/editor/src/lib/project/project-layout-semantics.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/project/project-layout-semantics.ts` | §5.1 facade / compat-runtime | `8a59abf05dc6` |
| `apps/editor/src/lib/project/project-types.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/project/project-types.ts` | §4.1 catalogue-configured strict codec | `fd67f38cd8b7` |
| `apps/editor/src/lib/render/wall-geometry-adapter.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/render/wall-geometry-adapter.ts` | §4.1 wall-geometry-adapter | `631aa511679a` |
| `apps/editor/src/lib/state/runtime-state.svelte.ts` | REMOVE IN #115 | `legacy/chopin-museum/src/lib/state/runtime-state.svelte.ts` | §5.1 unmatched rule → remove | `8842bbb680f5` |
| `apps/editor/src/lib/types/assets.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/types/assets.ts` | §4.1 shared resource types | `e5f26f27ce64` |
| `apps/editor/src/lib/types/materials.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/types/materials.ts` | §4.1 shared resource types | `b54bd5c8e4c7` |
| `apps/editor/src/lib/types/scene.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/types/scene.ts` | §4.1 shared resource types | `38d2cc423ee9` |
| `apps/editor/src/lib/visitor/VisitorCameraDirector.svelte` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `eed3fe71e1cd` |
| `apps/editor/src/lib/visitor/VisitorEntities.svelte` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `55c74f07612f` |
| `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `286d4eb72f3b` |
| `apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `f8391fe66ff4` |
| `apps/editor/src/lib/visitor/preview-surface-boundary.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `59f26776a067` |
| `apps/editor/src/lib/visitor/public-release-client.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `5088921886b5` |
| `apps/editor/src/lib/visitor/room-presentation.ts` | RETAIN AS FOUNDATION | `legacy/chopin-museum/src/lib/visitor/room-presentation.ts` | §5.1 visitor runtime/isolation; strict in WP3 | `9ce9e9e120e1` |
| `apps/editor/src/lib/visitor/shipped-static-registry.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `805da523dc76` |
| `apps/editor/src/lib/visitor/visitor-cold-runtime.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `3ab83d78db2e` |
| `apps/editor/src/lib/visitor/visitor-runtime-state.svelte.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `afaa2b3786e7` |
| `apps/editor/src/lib/visitor/visitor-texture-scope.ts` | RETAIN AS FOUNDATION | — | §5.1 visitor runtime/isolation; strict in WP3 | `32bcfc035f55` |
| `apps/editor/src/routes/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 entry/hub/visitor route | `f9492485c5d9` |
| `apps/editor/src/routes/dev/assets/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 retained only if closure ⊆ foundation | `c39e494bc909` |
| `apps/editor/src/routes/dev/materials/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 retained only if closure ⊆ foundation | `c62e12b1def1` |
| `apps/editor/src/routes/dev/perf/+page.server.ts` | REMOVE IN #115 | — | §5.1 perf routes | `c60bf0a98cb9` |
| `apps/editor/src/routes/dev/perf/+page.svelte` | REMOVE IN #115 | — | §5.1 perf routes | `3544f201c4d5` |
| `apps/editor/src/routes/dev/perf/bend/+page.server.ts` | REMOVE IN #115 | — | §5.1 perf routes | `c60bf0a98cb9` |
| `apps/editor/src/routes/dev/perf/bend/+page.svelte` | REMOVE IN #115 | — | §5.1 perf routes | `f9a0eae177e1` |
| `apps/editor/src/routes/dev/perf/p23b/+page.server.ts` | REMOVE IN #115 | — | §5.1 perf routes | `d255ef046d7a` |
| `apps/editor/src/routes/dev/perf/p23b/+page.svelte` | REMOVE IN #115 | — | §5.1 perf routes | `bb563f8dd09b` |
| `apps/editor/src/routes/dev/perf/p23b/drive.ts` | REMOVE IN #115 | — | §5.1 perf routes | `14ff629ab834` |
| `apps/editor/src/routes/editor/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 entry/hub/visitor route | `95b6e1631260` |
| `apps/editor/src/routes/museum/+page.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/routes/museum/+page.svelte` | §3.4 museum routes removed in WP2; frozen copy | `84b48a37eeec` |
| `apps/editor/src/routes/museum/editor/+page.svelte` | ISOLATE FOR LEGACY | `legacy/chopin-museum/src/routes/museum/editor/+page.svelte` | §3.4 museum routes removed in WP2; frozen copy | `738784b2d37b` |
| `apps/editor/src/routes/p/[publicationId]/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 entry/hub/visitor route | `bba9183de8a8` |
| `apps/editor/src/routes/project/[projectId]/+layout.svelte` | REMOVE IN #115 | — | §4.1 editor session layout removed; static notice replaces it | `92e4fcf64016` |
| `apps/editor/src/routes/project/[projectId]/preview/+page.svelte` | REMOVE IN #115 | — | §4.2 preview/publish routes removed (404) | `d80a8ff0bdc6` |
| `apps/editor/src/routes/project/[projectId]/publish/+page.svelte` | REMOVE IN #115 | — | §4.2 preview/publish routes removed (404) | `19a5db34e0c8` |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | RETAIN AS FOUNDATION | — | §4.2 foundation-reset notice | `5c1b74e8f86f` |
| `apps/editor/src/routes/projects/+page.svelte` | RETAIN AS FOUNDATION | — | §4.1 entry/hub/visitor route | `fe417cb878df` |
| `apps/editor/src/vite-env.d.ts` | RETAIN AS FOUNDATION | — | §5.1 app.html theme boot script removed from product | `b354a68c0e0d` |
| `apps/editor/static/museum/models/decor/.gitkeep` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `8b137891791f` |
| `apps/editor/static/museum/models/decor/chandelier/chandelier2.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `0c8c214252cd` |
| `apps/editor/static/museum/models/decor/clock/grandfather-clock.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `40925a1aa675` |
| `apps/editor/static/museum/models/decor/oil-lamp/victorian-oil-lamp.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `da898e914e68` |
| `apps/editor/static/museum/models/frames/.gitkeep` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `8b137891791f` |
| `apps/editor/static/museum/models/furniture/chair/salon-chair.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `81b6fdc6b093` |
| `apps/editor/static/museum/models/furniture/sofa/sofa-03.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `abaf9cd12188` |
| `apps/editor/static/museum/models/furniture/table/salon-table.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `466745006a46` |
| `apps/editor/static/museum/models/piano/grand-piano.glb` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `519c339c96e9` |
| `apps/editor/static/textures/brass-aged/map.png` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `6f54e3b78fae` |
| `apps/editor/static/textures/plaster-warm/map.png` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `e5b0f7a5e620` |
| `apps/editor/static/textures/plaster-warm/roughness.png` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `8429d989f20b` |
| `apps/editor/static/textures/wood-walnut/map.png` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `8faa536d6594` |
| `apps/editor/static/textures/wood-walnut/roughness.png` | RETAIN AS FOUNDATION | — | §5.1 product static assets for the generic catalogue | `325c83c01288` |
| `apps/editor/vite/museum-editor-entry-plugin.ts` | REMOVE IN #115 | — | §3.2 virtual entry; frozen route imports MuseumEditorApp directly | `7e2cfd9f5bc9` |
| `apps/editor/vite/preview-surface-boundary-plugin.ts` | RETAIN AS FOUNDATION | — | §4.1 visitor/preview boundary plugins | `1a5f8aac067c` |
| `apps/editor/vite/preview-surface-dynamic-scan.ts` | RETAIN AS FOUNDATION | — | §4.1 visitor/preview boundary plugins | `35931c8c8f93` |
| `apps/editor/vite/public-surface-boundary-plugin.ts` | RETAIN AS FOUNDATION | — | §4.1 visitor/preview boundary plugins | `22971b45bfaa` |
| `apps/museum/package.json` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8a19ec5d9267` |
| `apps/museum/scripts/verify-visitor-bundle.mjs` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `9720ad841899` |
| `apps/museum/src/app.html` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e590d0f09e88` |
| `apps/museum/src/lib/content/assets.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b5972118e685` |
| `apps/museum/src/lib/content/chopin-project.json` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `abde62587d8d` |
| `apps/museum/src/lib/content/chopin-project.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `9215f1f1f913` |
| `apps/museum/src/lib/content/chopin-room-presentation.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8b842c4e1f44` |
| `apps/museum/src/lib/content/materials.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e5998e0bd446` |
| `apps/museum/src/lib/content/scene-validation.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e82eb60a192d` |
| `apps/museum/src/lib/content/scene.json` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `51c428692e47` |
| `apps/museum/src/lib/content/scene.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `a7b5a76488bc` |
| `apps/museum/src/lib/content/texture-uri.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `eed7402532f7` |
| `apps/museum/src/lib/layout/layout-geometry-curve.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b31838a733eb` |
| `apps/museum/src/lib/layout/layout-geometry-openings.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `9ddc046ca516` |
| `apps/museum/src/lib/layout/layout-geometry-types.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `3794490b3b9b` |
| `apps/museum/src/lib/layout/layout-geometry-validation.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `cb3d002dabe1` |
| `apps/museum/src/lib/layout/layout-geometry.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `20859ec70901` |
| `apps/museum/src/lib/layout/layout-types.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `0291b9236ea5` |
| `apps/museum/src/lib/layout/wall-mesh-builder.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `db275860e7ab` |
| `apps/museum/src/lib/museum/MuseumCanvas.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e34fc9fce0a3` |
| `apps/museum/src/lib/museum/MuseumEntities.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `cfff85ce3cef` |
| `apps/museum/src/lib/museum/MuseumScene.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8579d0f90199` |
| `apps/museum/src/lib/museum/RoomFrame.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `80f247a9cce1` |
| `apps/museum/src/lib/museum/assets/AssetFallback.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `4adc08c23d84` |
| `apps/museum/src/lib/museum/assets/AssetModel.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `fbbd38a53b7e` |
| `apps/museum/src/lib/museum/assets/FallbackMaterial.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `3427e1f4481e` |
| `apps/museum/src/lib/museum/assets/fallbacks.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `ca10f33d4f62` |
| `apps/museum/src/lib/museum/assets/instance-material-remap.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `7a85ddc2f66f` |
| `apps/museum/src/lib/museum/assets/model-utils.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `14b3459bd4e5` |
| `apps/museum/src/lib/museum/entities/EntityLight.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `2048c8536d4f` |
| `apps/museum/src/lib/museum/entities/EntityPrimitive.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `c6550f2ee97b` |
| `apps/museum/src/lib/museum/layout/CentralChamber.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `0dcff11c1096` |
| `apps/museum/src/lib/museum/layout/GroundPlinth.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `f0d25fc4637f` |
| `apps/museum/src/lib/museum/layout/LayoutMuseumShell.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `c8f61dc22c10` |
| `apps/museum/src/lib/museum/layout/RoomPortal.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `a9cee7e1e920` |
| `apps/museum/src/lib/museum/layout/wall-material-factory.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `d76fe46bd95a` |
| `apps/museum/src/lib/museum/materials/MuseumMaterial.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `16f84dce17f0` |
| `apps/museum/src/lib/museum/materials/SceneInstanceMaterial.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `ca58ccf1958d` |
| `apps/museum/src/lib/museum/materials/scene-instance-material.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `2bf156a013d6` |
| `apps/museum/src/lib/museum/materials/texture-cache.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b82f604e7736` |
| `apps/museum/src/lib/museum/navigation/CameraDirector.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `f4ccce8ac047` |
| `apps/museum/src/lib/museum/navigation/NavigationNode.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `3ad34212085b` |
| `apps/museum/src/lib/museum/paris-activation.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `d0638cb1cfe4` |
| `apps/museum/src/lib/museum/rooms/DepartureRoom.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b464ce885d99` |
| `apps/museum/src/lib/museum/rooms/EntranceRoom.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `4e89fcbb9a43` |
| `apps/museum/src/lib/museum/rooms/LegacyRoom.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `4789e1e1dafb` |
| `apps/museum/src/lib/museum/rooms/MusicChamber.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e12daefbc1e1` |
| `apps/museum/src/lib/museum/rooms/ParisSalon.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `3d7311857134` |
| `apps/museum/src/lib/museum/rooms/PolandRoom.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `551d21382c3c` |
| `apps/museum/src/lib/museum/rooms/WorkshopRoom.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `348da9b36c1b` |
| `apps/museum/src/lib/museum/ui/MuseumHUD.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `dee6c7ab298b` |
| `apps/museum/src/lib/project/project-codec.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `449b71f53264` |
| `apps/museum/src/lib/project/project-layout-semantics.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8a59abf05dc6` |
| `apps/museum/src/lib/project/project-types.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `fd67f38cd8b7` |
| `apps/museum/src/lib/render/wall-geometry-adapter.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `631aa511679a` |
| `apps/museum/src/lib/state/runtime-state.svelte.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `88c31b7ab8c7` |
| `apps/museum/src/lib/types/assets.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `5d74cc35c0a4` |
| `apps/museum/src/lib/types/materials.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b54bd5c8e4c7` |
| `apps/museum/src/lib/types/scene.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `38d2cc423ee9` |
| `apps/museum/src/routes/museum/+page.svelte` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `84b48a37eeec` |
| `apps/museum/src/vite-env.d.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `11f02fe2a006` |
| `apps/museum/static/museum/models/decor/.gitkeep` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8b137891791f` |
| `apps/museum/static/museum/models/decor/chandelier/chandelier2.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `0c8c214252cd` |
| `apps/museum/static/museum/models/decor/clock/grandfather-clock.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `40925a1aa675` |
| `apps/museum/static/museum/models/decor/oil-lamp/victorian-oil-lamp.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `da898e914e68` |
| `apps/museum/static/museum/models/frames/.gitkeep` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8b137891791f` |
| `apps/museum/static/museum/models/furniture/chair/salon-chair.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `81b6fdc6b093` |
| `apps/museum/static/museum/models/furniture/sofa/sofa-03.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `abaf9cd12188` |
| `apps/museum/static/museum/models/furniture/table/salon-table.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `466745006a46` |
| `apps/museum/static/museum/models/piano/grand-piano.glb` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `519c339c96e9` |
| `apps/museum/static/textures/brass-aged/map.png` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `6f54e3b78fae` |
| `apps/museum/static/textures/plaster-warm/map.png` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `e5b0f7a5e620` |
| `apps/museum/static/textures/plaster-warm/roughness.png` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8429d989f20b` |
| `apps/museum/static/textures/wood-walnut/map.png` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `8faa536d6594` |
| `apps/museum/static/textures/wood-walnut/roughness.png` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `325c83c01288` |
| `apps/museum/svelte.config.js` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `f18310d8fea5` |
| `apps/museum/tsconfig.json` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `b5fca7fbce36` |
| `apps/museum/vite.config.ts` | REMOVE IN #115 | — | §3.5 apps/museum superseded by legacy/chopin-museum | `d3403e72566f` |
| `packages/audio-plink/package.json` | REMOVE IN #115 | — | §5.1 zero-consumer package | `87d3defb0f7d` |
| `packages/audio-plink/src/index.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `de40049564ea` |
| `packages/camera-core/package.json` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `d6403fc3b546` |
| `packages/camera-core/src/camera-motion.ts` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `99dfc5bcc8fa` |
| `packages/camera-core/src/camera-route.ts` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `d75e1d97353a` |
| `packages/camera-core/src/index.ts` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `d6b6e4043648` |
| `packages/camera-core/src/navigation.ts` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `aa36dfff90f9` |
| `packages/camera-core/src/scene-types.ts` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `026f4d5af533` |
| `packages/camera-core/tsconfig.json` | RETAIN AS FOUNDATION | — | §5.1 one Camera authority; REFACTOR LATER at T3 | `76ce9f5041a2` |
| `packages/layout-core/package.json` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `187eb8c2c399` |
| `packages/layout-core/src/index.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `bc1754852a1f` |
| `packages/layout-core/src/layout-align.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `6a75fd2fc495` |
| `packages/layout-core/src/layout-codec.ts` | RETIRE AT T1 | — | §5.1 legacy types/codec host definitions; T1 schema cutover | `8f1f7efab7f8` |
| `packages/layout-core/src/layout-compat.ts` | REMOVE IN #115 | — | §6 legacy generation (no data obligations) | `93c18aa5ff29` |
| `packages/layout-core/src/layout-duplicate.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `7d205cac5fbd` |
| `packages/layout-core/src/layout-face-extraction.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `936281f30f26` |
| `packages/layout-core/src/layout-geometry-curve.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `757013a7b2cf` |
| `packages/layout-core/src/layout-geometry-objects.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `528a7ff20fd2` |
| `packages/layout-core/src/layout-geometry-openings.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `64b37d4478fe` |
| `packages/layout-core/src/layout-geometry-queries.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `e302e42a3938` |
| `packages/layout-core/src/layout-geometry-types.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `94c0bbe34d09` |
| `packages/layout-core/src/layout-geometry-validation.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `3b9f73ca67d5` |
| `packages/layout-core/src/layout-geometry.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `dce2b3cfc727` |
| `packages/layout-core/src/layout-identity.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `52639209d3de` |
| `packages/layout-core/src/layout-junction-clearance.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `3b9df8825d35` |
| `packages/layout-core/src/layout-junction-identity.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `0170d0a79b2e` |
| `packages/layout-core/src/layout-junction-resolution.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `af292687e064` |
| `packages/layout-core/src/layout-migration-math.ts` | REMOVE IN #115 | — | §6 legacy generation (no data obligations) | `1233a54c0b62` |
| `packages/layout-core/src/layout-migration.ts` | REMOVE IN #115 | — | §6 legacy generation (no data obligations) | `ae663725df7d` |
| `packages/layout-core/src/layout-opening-set.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `c3ebc2980593` |
| `packages/layout-core/src/layout-portals.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `32d569266f39` |
| `packages/layout-core/src/layout-robust-orientation.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `e7fcb43e31ee` |
| `packages/layout-core/src/layout-room-frame.ts` | RETIRE AT T1 | — | §5.1 legacy types/codec host definitions; T1 schema cutover | `c059ccfce265` |
| `packages/layout-core/src/layout-room-isolation.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `106470068ce9` |
| `packages/layout-core/src/layout-room-move.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `1262273e0483` |
| `packages/layout-core/src/layout-room-reconciliation.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `8d374414dc21` |
| `packages/layout-core/src/layout-snap.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `51273fc41ede` |
| `packages/layout-core/src/layout-topology-components.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `66f9d2a62df5` |
| `packages/layout-core/src/layout-types.ts` | RETIRE AT T1 | — | §5.1 legacy types/codec host definitions; T1 schema cutover | `fa89ca30327e` |
| `packages/layout-core/src/layout-wall-centerline.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `70c21c588be9` |
| `packages/layout-core/src/layout-wall-chain.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `5f79e50be64e` |
| `packages/layout-core/src/layout-wall-curve-algebra.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `34779bcedefa` |
| `packages/layout-core/src/layout-wall-dissolve.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `a771fbb95a1e` |
| `packages/layout-core/src/layout-wall-first-codec.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `54726375d31f` |
| `packages/layout-core/src/layout-wall-first-precision.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `e1d3c2a9638d` |
| `packages/layout-core/src/layout-wall-first-types.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `1312b2025560` |
| `packages/layout-core/src/layout-wall-heights.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `deccb4a1973a` |
| `packages/layout-core/src/layout-wall-noding.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `278f8a0051c6` |
| `packages/layout-core/src/layout-wall-offset-clearance.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `d57948ba004a` |
| `packages/layout-core/src/layout-wall-openings.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `378b4c5633a0` |
| `packages/layout-core/src/layout-wall-topology-ops.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `49ecd271d7f7` |
| `packages/layout-core/src/layout-wall-topology.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `d88e65e2cebe` |
| `packages/layout-core/src/p2311-perf.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `b599a2568c25` |
| `packages/layout-core/src/types.ts` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `eae63c6207bc` |
| `packages/layout-core/tsconfig.json` | RETAIN AS FOUNDATION | — | §5.1 canonical compiler/kernel (p2311-perf.ts = measurement seam, T1 refactor) | `76ce9f5041a2` |
| `packages/note-cursor/package.json` | REMOVE IN #115 | — | §5.1 zero-consumer package | `0c4e36adecd4` |
| `packages/note-cursor/src/NoteCursor.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `0a4191a83b15` |
| `packages/note-cursor/src/index.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `6a7a25978871` |
| `packages/note-cursor/src/types.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `2835601482d2` |
| `packages/portfolio-content/package.json` | REMOVE IN #115 | — | §5.1 zero-consumer package | `bc3f5bb6525d` |
| `packages/portfolio-content/src/index.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `daff1e563de8` |
| `packages/portfolio-hud/package.json` | REMOVE IN #115 | — | §5.1 zero-consumer package | `44b2f7c05de8` |
| `packages/portfolio-hud/src/ContactPanel.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `b0d89a630529` |
| `packages/portfolio-hud/src/MuteToggle.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `3702c6eb163d` |
| `packages/portfolio-hud/src/OverlayCard.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `a749c41faa2c` |
| `packages/portfolio-hud/src/SectionCaption.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `e816c69faec1` |
| `packages/portfolio-hud/src/SectionDots.svelte` | REMOVE IN #115 | — | §5.1 zero-consumer package | `b8303629386b` |
| `packages/portfolio-hud/src/index.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `bfebee3eb627` |
| `packages/project-model/package.json` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `930a0878b166` |
| `packages/project-model/src/compat-runtime.ts` | REMOVE IN #115 | — | §6 separable legacy chain | `8316aa9ce4dc` |
| `packages/project-model/src/index.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `3d0b31c302f3` |
| `packages/project-model/src/package-format.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `6e07722be373` |
| `packages/project-model/src/package-sha.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `256275e5f877` |
| `packages/project-model/src/project-codec.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `c42e53f899a3` |
| `packages/project-model/src/project-compat.ts` | REMOVE IN #115 | — | §6 separable legacy chain | `afab98a4483d` |
| `packages/project-model/src/project-layout-semantics.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `1812a20b4676` |
| `packages/project-model/src/project-types.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `b83d4ef2851d` |
| `packages/project-model/src/scene-codec/canonical.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `2b8a76fcfcde` |
| `packages/project-model/src/scene-codec/index.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `acf93b7680a3` |
| `packages/project-model/src/scene-codec/parse-document.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `7f9437b72b07` |
| `packages/project-model/src/scene-codec/parse-entities.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `7e684df79d39` |
| `packages/project-model/src/scene-codec/readers.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `32e29d982050` |
| `packages/project-model/src/scene-format.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `509e32aa6e42` |
| `packages/project-model/src/scene-validation.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `7af57135663b` |
| `packages/project-model/src/scene-world-conversion.ts` | REMOVE IN #115 | — | §6 separable legacy chain | `e35d8c5857bc` |
| `packages/project-model/src/scene.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `948037470a78` |
| `packages/project-model/src/shipped-static.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `1332ebb88676` |
| `packages/project-model/src/standalone-scene-import.ts` | REMOVE IN #115 | — | §6 separable legacy chain | `730833e2879e` |
| `packages/project-model/src/wall-first-project.ts` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `ffa8b540bb70` |
| `packages/project-model/tsconfig.json` | RETAIN AS FOUNDATION | — | §5.1 Scene types/codec/validation; REFACTOR LATER at T2/T3 | `76ce9f5041a2` |
| `packages/scroll-travel/package.json` | REMOVE IN #115 | — | §5.1 zero-consumer package | `74206a2a8194` |
| `packages/scroll-travel/src/index.ts` | REMOVE IN #115 | — | §5.1 zero-consumer package | `5e6373d24ca6` |
| `packages/tsconfig/base.json` | RETAIN AS FOUNDATION | — | §4.1 workspace tsconfig | `01806a07d154` |
| `packages/tsconfig/package.json` | RETAIN AS FOUNDATION | — | §4.1 workspace tsconfig | `6e85b4acd46c` |

## 3. Test manifest (§7.2)

Scope: tracked files under `apps/editor/tests` — **408 files**, of which **373** are `*.test.ts`.

**Category totals:**

| Category | Files |
| --- | ---: |
| A | 70 |
| A′ | 12 |
| A″ | 15 |
| B | 7 |
| B/A | 1 |
| C | 254 |
| D | 14 |
| SUPPORT | 35 |

**Action totals:**

| Action | Files |
| --- | ---: |
| DELETE | 254 |
| EXTRACT | 26 |
| KEEP+EXTRACT-FIXTURES | 15 |
| KEEP+MOVE | 35 |
| KEEP | 70 |
| RELOCATE+SPLIT | 1 |
| RELOCATE | 7 |

### 3.1 Per-file test manifest

| Test path (apps/editor/) | Category | Action | Reason |
| --- | --- | --- | --- |
| `tests/README.md` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/docs/documentation-references.test.ts` | A | KEEP | boundary plugin / docs reference / API auth contract |
| `tests/e2e/test-auth.test.ts` | A | KEEP | boundary plugin / docs reference / API auth contract |
| `tests/e2e/test-auth.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/angled-plan-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/camera-motion-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/docs-references.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/lib-source.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/plan-render-harness.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/helpers/wall-mesh-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/bench-boundary.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/bench-report.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/bend-perf.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/browser-bench.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-baseline-contract.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-containment.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-m1-attribution.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-m1-browser-runner.cli.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b-m1-cpu-profile.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-m1-frame-timing.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-m1-gesture.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b-m1-record.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b11-node-probe.cli.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b5-reuse-budget.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b5-reuse-ratchet.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b6-comparator-strategies.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b6-release-delay-probe.cli.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b6-s1-node-probe.cli.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b6-s3-net-benefit-probe.cli.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/bench/p23b7-capture-attribution.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/p23b7-sample-verdict-matrix.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/plan-bench.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/bench/three-stats.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/content/__fixtures__/load-fixture-scene.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/content/__fixtures__/tour-minimal.json` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/content/assets.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/chopin-layout.test.ts` | B | RELOCATE | Chopin/frozen guarantee (§7.2 B) |
| `tests/lib/content/chopin-project.test.ts` | B | RELOCATE | Chopin/frozen guarantee (§7.2 B) |
| `tests/lib/content/footprint-generator.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/normalize-asset.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/package-format.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/provenance.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/rooms.test.ts` | B | RELOCATE | Chopin/frozen guarantee (§7.2 B) |
| `tests/lib/content/scene-codec.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/content/scene.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/content/texture-uri.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/editor/EditorSelectionHelper.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/active-editor-selection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/arrange-delete.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/camera-drawer.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/editor-entry-boundary.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/editor-view-state.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/hierarchy-inspector.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/hierarchy-navigator-state.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/hierarchy-plan-bridge.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/hierarchy-projection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/inspector-identity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/inspector-junction-dissolve.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/inspector-target.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/interaction-matrix.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/live-rooms.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/navigator-identity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/new-project-boot.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/placement.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/project-persistence-presentation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/project-session-isolation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/relic-smoke.test.ts` | B | RELOCATE | frozen-project guarantee → legacy/chopin-museum/tests/ |
| `tests/lib/editor/app/room-delete.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/room-focus.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/shell-a11y-motion.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/shell-contrast-floor.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/shell-control-ownership.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/shell-state-language.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/shell-type-roles.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/app/unified-project-tree.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/asset-load-resolution.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera-plan/camera-plan-footprints.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera-plan/camera-plan-hit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera-plan/camera-plan-hover.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera-plan/camera-plan-state.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera-plan/camera-plan-timing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/camera-visualization-contract.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/cardinal-snap-motion.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/cardinal-snap-residual-drag.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-connections.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-framing-authoring.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-framing-envelope.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-framing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-labels.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-path.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-preview-affordances.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-timeline.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera-view.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-camera.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/editor-directed-edge-motion.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/camera/polar-orbit-handoff.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/cluster-obb.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/context-menu/context-menu.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-assets.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-cluster-transform.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-lights.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-navigation-graph.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-orientation-gizmo.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-outliner.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-placement.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-primitives.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-selection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-shell-boot-core.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-bind-migration.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-camera.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-package-archive.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-placement.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-selection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-shell.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store-textures.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-test-utils.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/editor-textures.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-transform-target.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-transform.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/editor-vector.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/export/package-exporter.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/export/package-roundtrip-smoke.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/camera-gizmo-adapter.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/editor-gizmo-behavior-fixtures.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/editor-gizmo-boundary.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/editor-gizmo-host.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/editor-gizmo-policy.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/layout-gizmo-adapter.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/layout-gizmo-candidate.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/layout-gizmo-target.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/gizmo/scene-gizmo-adapter.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/helpers/mime-sniff.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/helpers/package-sha.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/helpers/route-clone.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/helpers/validators-runner.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/import/package-importer.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/interaction-cursor.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout-mesh-parity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/arch-profile.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/arrange-hit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/curve-geometry.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/draft-geometry.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-3d-picking.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-3d-selection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-a1-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/layout/layout-add-junction.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-auto-bezier.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-bend-command.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-click-declaration.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-editing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-exact-input.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-height-edit-history.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-import-replacement.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-interaction.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-interior-anchor-release.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-lifecycle-semantics.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-lifecycle.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-mesh-factory.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-mutation-runner.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-names.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-object-editing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-opening-authoring.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-opening-editing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-plan-identity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-plan-transform.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-preview-bounds.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-preview-geometry.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-preview-state.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-replacement-normalization.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-room-editing.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-room-move-gesture.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-room-rotation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-room-transform.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-transaction.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-transient-allocation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-transient-preview.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-transient-room-unit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-undo-branch.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-validation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-chain-commit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-edit-gesture.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-material.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-move-adapter.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-run-height.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/layout-wall-segment-history.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b-gesture-sampling-report.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b-interaction-measure.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b-m1-room-drag-arm.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b-m1-room-label-arm.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b-mesh-identity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b11-wall-chain-acceptance.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b6-layout-preview-scene-mount-harness.svelte` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/layout/p23b6-s2-behavior-retention.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b6-s3-h6-retention.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b6-s3-prepared-generation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b6-s3b-mesh-input-contract.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b6-svelte-client-runtime.d.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/layout/p23b7-client-reactivity.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b7-mesh-identity-regression.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b7-reactive-preview-state.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/layout/p23b7-snapshot-payload-guard.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/p23b7-svelte-internal-client.d.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/editor/layout/p23b8-d9-dormant-scan.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-camera-projection.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-hit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-overlays.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-scene-footprint.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-scene-hit.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-scene-transform.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/plan-timing-pill.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/layout/rooms-to-layout.test.ts` | B | RELOCATE | frozen-project guarantee → legacy/chopin-museum/tests/ |
| `tests/lib/editor/obb-util-root.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/obb-util.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/p23-f0-stage5-small-items.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/placement-ghost.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/preview/preview-coordinator.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/preview/project-flows.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/project-format-visitor-parity.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/editor/project-format-writer-fixtures.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/editor/project-format-writers.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/editor/project-persistence.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/project/project-codec.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/publish-surface.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/scale-vector.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/shell-focus-mode.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/snap-input-validation.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/spatial-registry.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/binary-texture-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/camera-preview-controller.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/document-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/editor-interaction-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/editor-toolbar.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/history-controller.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/interaction-fsm.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/material-resource-mutator.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/mutation-guards.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/mutation-policy.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/preview-edge-timeline.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/preview-scope.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/preview-sequence.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/project-export-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/project-format-policy.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/scene-roots.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/selection-actions.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/selection-matrix.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/selection-scope.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/selection-store.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/session-model.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/session-state.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/shell-compact-controls.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/shell-header-chrome.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/shell-lanes.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/store/shell-scope.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/styles/gizmo-single-ending.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/styles/scene-palette.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/texture-conversion.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/texture-verifier.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/theme-registry.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/theme.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/editor/tmp-confirm-gizmo-pointer-pipeline.test.ts` | C | DELETE | obsolete shell/workspace/presentation/history/compatibility |
| `tests/lib/layout/__fixtures__/layout-g1-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/__fixtures__/layout-g1-normalize.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/__fixtures__/layout-g2-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/__fixtures__/layout-identity-content.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/__fixtures__/layout-scale-fixtures.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/__fixtures__/layout-scale-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/angled-plan-noding-sweeps.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/fixtures/curved-correspondence-repro.json` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/junction-matrix.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/junction-partition.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-align.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-angled-plan-integrity.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-codec.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/layout-concave-room-identity.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-correspondence.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-integration.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-curve-planners.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-read-path.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-regressions.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-schema.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curve-split-primitives.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-curved-rooms.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-dissolve-curves.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-dissolve-integration.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-dissolve-junction.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-drafting.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-duplicate.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-face-extraction.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-g2-fixtures.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-geometry-boundary.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-geometry-golden.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-geometry-parity.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-geometry.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-identity.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-junction-clearance.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-junction-identity.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-junction-resolution.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-junction-topology.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-junction-wall-ends.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-migration-math.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/layout-migration.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/layout-openings.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-p23b3a-d12-hazard.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/layout-p23b3a-reference.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/layout-p23b3a-scoped-gate.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/layout-portals.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/layout-precision.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-presets.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-render-safe-validation.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-room-frame.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/layout-room-lifecycle.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-room-move.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-room-reconciliation.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-scale-compile.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-snap-extent-parity.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/layout-snap-input-probe.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-snap.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-topology-components.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-birth-height.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-chain.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-delete.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-wall-edit.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-first-codec.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-height.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-noding.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-role.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/layout-wall-selection.test.ts` | D | EXTRACT | kernel output assertions extracted; editor-wiring assertions deleted |
| `tests/lib/layout/layout-wall-topology.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b-fixture-contract.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b-measurement-marks-wiring.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b-room-unit-proposal-cost.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b-room-unit-proposal-parity.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b11-conditional-gate.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b11-conditional-mechanisms.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b11-correspondence-cases.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b11-correspondence-reference.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b11-correspondence-reference.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b11-correspondence-shortcircuits.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-consumer-observations.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-extent-pruning.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-measurements.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-observation-collector.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b4-observed-reference.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b4-pruning-differential.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-sampling-reference.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-shared-derivation.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b4-wild-fixtures.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b5-gesture-scope-wiring.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b5-preflight-scope.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b5-s0-reachability.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b7-affected-extent.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b7-preflight-reference-cases.ts` | SUPPORT | KEEP+MOVE | test helper/fixture/harness (not a test file) |
| `tests/lib/layout/p23b7-preflight-reference.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/p23b7-verdict-scope-wiring.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/p23b7-verdict-scope.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/p23b8-d5-identity-falsifier.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/p23b8-d8-bounded-retention-comparison.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/layout/p23b8-p1-randomized-differential.test.ts` | A″ | KEEP+EXTRACT-FIXTURES | output-equivalence/identity assertions kept; measurement/budget assertions deleted |
| `tests/lib/layout/plan-attention.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-dimensions.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-door-window.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-empty-state.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-guide.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-icons.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-keyboard-navigation.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-keyboard-readout.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-keyboard-session.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-numeric-entry.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-presentation-foundation.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-preview-closure.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-refusal.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-render-boundary.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-render-harness.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-render-model.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-room-labels.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-salience.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-scene-paint.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-snap-grammar.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-state-controls.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-surrounds.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/plan-thin-wall.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/layout/shared-walls.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/layout/wall-mesh-builder.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/layout/wall-mesh-watertight-matrices.test.ts` | A | KEEP | layout-core kernel invariant |
| `tests/lib/museum/assets/instance-material-remap.test.ts` | A | KEEP | generic renderer/camera kernel invariant |
| `tests/lib/museum/camera-core-boundary.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/museum/layout/wall-material-factory.test.ts` | C | DELETE | obsolete subject (remainder) |
| `tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/museum/materials/scene-instance-material.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/museum/materials/texture-cache.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/museum/navigation/camera-motion-dense-sweeps.test.ts` | A | KEEP | generic renderer/camera kernel invariant |
| `tests/lib/museum/navigation/camera-motion.test.ts` | A | KEEP | generic renderer/camera kernel invariant |
| `tests/lib/museum/navigation/camera-route.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/museum/paris-activation.test.ts` | B | RELOCATE | frozen-project guarantee → legacy/chopin-museum/tests/ |
| `tests/lib/museum/visitor-import-boundary.test.ts` | B/A | RELOCATE+SPLIT | museum-shell direction relocates; editor direction stays |
| `tests/lib/project-model-boundary.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/project/project-compat.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/project/scene-world-conversion.test.ts` | C | DELETE | subject removed with the editor shell / legacy acceptance |
| `tests/lib/render/wall-geometry-adapter.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/state/runtime-state.test.ts` | B | RELOCATE | frozen-project guarantee → legacy/chopin-museum/tests/ |
| `tests/lib/visitor/preview-surface-boundary.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/visitor/visitor-cold-runtime.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/visitor/visitor-identity-isolation.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/lib/visitor/visitor-public-route.test.ts` | A′ | EXTRACT | Chopin fixture → wall-first/world-local fixture, identical expectations; Chopin goldens → B |
| `tests/lib/visitor/visitor-runtime-state.test.ts` | A | KEEP | kernel/foundation invariant |
| `tests/vite/preview-surface-boundary-plugin.test.ts` | A | KEEP | boundary plugin / docs reference / API auth contract |
| `tests/vite/public-surface-boundary-plugin.test.ts` | A | KEEP | boundary plugin / docs reference / API auth contract |

## 4. Docs manifest (§8)

Scope: tracked `docs/**` plus `AGENTS.md`, `README.md`, `README.original.md` — **584 files**, each receiving exactly one action.

**Action totals:**

| Action | Files |
| --- | ---: |
| DELETE | 453 |
| MOVE | 65 |
| ARCHIVE/MOVE | 33 |
| RETAIN + rewrite | 8 |
| RETAIN | 7 |
| RETAIN + update | 6 |
| CONSOLIDATE then DELETE | 5 |
| KEEP | 2 |
| KEEP byte-identical | 2 |
| CONSOLIDATE then ARCHIVE/MOVE | 2 |
| CONSOLIDATE | 1 |
| **Total** | **584** |

### 4.1 Per-file docs manifest

| Old path | Action | New path | Owner / rationale | Blob |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | RETAIN + rewrite | — | §3.6 legacy scope line; rule 4 route facts; drop scroll-travel clause | `583d4cc7b33a` |
| `README.md` | RETAIN + rewrite | — | §10 routing | `e0e1570451f1` |
| `README.original.md` | DELETE | — | §8.2 obsolete; repair incoming routes | `55950e855dbc` |
| `docs/North-star-final-decision-synthesis.md` | DELETE | — | §8.2 after promotion-coverage check | `5ac8a901acca` |
| `docs/North-star-final-synthesis-peer-review.md` | DELETE | — | §8.2 after promotion-coverage check | `2305491ba9a5` |
| `docs/README.md` | RETAIN + rewrite | — | §8.2/§10 router | `294f2681dc93` |
| `docs/World-Experience-Architecture-Synthesis.md` | DELETE | — | §8.2 after promotion-coverage check | `af016e9f092c` |
| `docs/World-Experience-Model.md` | DELETE | — | §8.2 after promotion-coverage check | `216c9d95650c` |
| `docs/archive/ASSET_WORKFLOW.md` | DELETE | — | §8.5 baseline archive default | `42c2ed94e98e` |
| `docs/archive/CAMERA_AND_LAYOUT.md` | DELETE | — | §8.5 baseline archive default | `b29a541a4414` |
| `docs/archive/README.md` | RETAIN + rewrite | — | §8.5 opt-in map + recovery rules | `93103e47b52b` |
| `docs/archive/agent-handoffs/CURRENT-pre-editor-ui.md` | DELETE | — | §8.5 baseline archive default | `3179231589fd` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-28-in-progress-refactor-slice-1-session-and-helpers.md` | DELETE | — | §8.5 baseline archive default | `ee3d7245f31a` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-30-complete-refactor-slice-1-e-vitest.md` | DELETE | — | §8.5 baseline archive default | `50a11b5082ca` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-30-complete-refactor-slice-2-scene-roots.md` | DELETE | — | §8.5 baseline archive default | `da04c667a1d9` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-3-debt-types-runner-session.md` | DELETE | — | §8.5 baseline archive default | `9d9974c424aa` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-3-document-history-preview.md` | DELETE | — | §8.5 baseline archive default | `ae308342a80a` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-5-bind-migration.md` | DELETE | — | §8.5 baseline archive default | `c9a39d6db4c4` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-6-selection-deletion.md` | DELETE | — | §8.5 baseline archive default | `d0cf5edf48dc` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-7b-camera-tree-panels.md` | DELETE | — | §8.5 baseline archive default | `93ae6881a315` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-8-polish.md` | DELETE | — | §8.5 baseline archive default | `4c5020f1940b` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-9-1-session-guards.md` | DELETE | — | §8.5 baseline archive default | `e5628d0490b7` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-9-2-nav-mutator.md` | DELETE | — | §8.5 baseline archive default | `779e3aa254e8` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-9-3-view-keyframe.md` | DELETE | — | §8.5 baseline archive default | `567a95b21693` |
| `docs/archive/agent-handoffs/complete-refactor/2026-07-31-complete-refactor-slice-9-4-camera-timeline.md` | DELETE | — | §8.5 baseline archive default | `e0ef76e57bef` |
| `docs/archive/agent-handoffs/complete-refactor/2026-08-01-complete-refactor-slice-9-5-placement-path.md` | DELETE | — | §8.5 baseline archive default | `02cb4013df13` |
| `docs/archive/agent-handoffs/museum-editor-full-track/phase-6-full-track-1.md` | DELETE | — | §8.5 baseline archive default | `601e380f7da7` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-split-1-controller-hosts.md` | DELETE | — | §8.5 baseline archive default | `3695bbdf98c7` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-split-2-preview-commands.md` | DELETE | — | §8.5 baseline archive default | `327de387e612` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-split-3-texture-controller.md` | DELETE | — | §8.5 baseline archive default | `7a755ace24c3` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-split-4-test-split.md` | DELETE | — | §8.5 baseline archive default | `c48ee8a006be` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-split-5-codec.md` | DELETE | — | §8.5 baseline archive default | `80226802df2b` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/2026-08-03-complete-priority-1-splits.md` | DELETE | — | §8.5 baseline archive default | `4e57aade3960` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-4.1.md` | DELETE | — | §8.5 baseline archive default | `241d079e05f7` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-4.2.md` | DELETE | — | §8.5 baseline archive default | `d050f7bce886` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-4.3.md` | DELETE | — | §8.5 baseline archive default | `82ec1312c678` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-4.4.md` | DELETE | — | §8.5 baseline archive default | `122cc31933c3` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-4.5.md` | DELETE | — | §8.5 baseline archive default | `c599ad8cc1a6` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-5-editor-manual-test.md` | DELETE | — | §8.5 baseline archive default | `5725ceabfd77` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-5.1.md` | DELETE | — | §8.5 baseline archive default | `8018beb46ca0` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-5.2.md` | DELETE | — | §8.5 baseline archive default | `130a48dabcee` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-5.3.md` | DELETE | — | §8.5 baseline archive default | `b93010d7d6e5` |
| `docs/archive/agent-handoffs/museum-editor-phases-4-5/phase-5.4.md` | DELETE | — | §8.5 baseline archive default | `b9c39a114b0a` |
| `docs/archive/agent-handoffs/phase-0.md` | DELETE | — | §8.5 baseline archive default | `dd1705148746` |
| `docs/archive/agent-handoffs/phase-1-slice-1.2.md` | DELETE | — | §8.5 baseline archive default | `cd312e94af13` |
| `docs/archive/agent-handoffs/phase-1-slice-1.3.md` | DELETE | — | §8.5 baseline archive default | `72ee795bbd21` |
| `docs/archive/agent-handoffs/phase-1.md` | DELETE | — | §8.5 baseline archive default | `5f93c292292b` |
| `docs/archive/agent-handoffs/phase-2.md` | DELETE | — | §8.5 baseline archive default | `1a67a7631bf2` |
| `docs/archive/agent-handoffs/phase-3.5.md` | DELETE | — | §8.5 baseline archive default | `4feebdaa90c2` |
| `docs/archive/agent-handoffs/phase-3.6.md` | DELETE | — | §8.5 baseline archive default | `f823573a8ea0` |
| `docs/archive/agent-handoffs/phase-3.md` | DELETE | — | §8.5 baseline archive default | `37ad19ca785e` |
| `docs/archive/agent-handoffs/phase-4.md` | DELETE | — | §8.5 baseline archive default | `37fad30d3f6c` |
| `docs/archive/agent-handoffs/phase-5.md` | DELETE | — | §8.5 baseline archive default | `d88c0a73dfd6` |
| `docs/archive/agent-handoffs/phase-6.1.md` | DELETE | — | §8.5 baseline archive default | `6f542f9d0921` |
| `docs/archive/agent-handoffs/phase-6.2.md` | DELETE | — | §8.5 baseline archive default | `722e5296235e` |
| `docs/archive/agent-handoffs/phase-6.5.md` | DELETE | — | §8.5 baseline archive default | `a43a0c43304e` |
| `docs/archive/agent-handoffs/phase-6.6-slice-6.md` | DELETE | — | §8.5 baseline archive default | `ca9b72356993` |
| `docs/archive/agent-handoffs/phase-6.md` | DELETE | — | §8.5 baseline archive default | `07d5f6c44cb6` |
| `docs/archive/agent-handoffs/phase-7.md` | DELETE | — | §8.5 baseline archive default | `3bdcc75a8f86` |
| `docs/archive/agent-handoffs/workspace-phases/phase-1-editor-ui-overhaul.md` | DELETE | — | §8.5 baseline archive default | `344280f069df` |
| `docs/archive/agent-handoffs/workspace-phases/phase-2.1-persistent-camera-discovery.md` | DELETE | — | §8.5 baseline archive default | `5c807b678180` |
| `docs/archive/agent-handoffs/workspace-phases/phase-2.1-remove-camera-all-tab.md` | DELETE | — | §8.5 baseline archive default | `7882e6cdf884` |
| `docs/archive/agent-handoffs/workspace-phases/phase-2.2-timeline-selection-scrub.md` | DELETE | — | §8.5 baseline archive default | `44a6f0026485` |
| `docs/archive/agent-handoffs/workspace-phases/phase-2.3-whole-guided-tour-playback.md` | DELETE | — | §8.5 baseline archive default | `3593f65f2edb` |
| `docs/archive/agent-handoffs/workspace-phases/phase-2.4-camera-key-progress-drag.md` | DELETE | — | §8.5 baseline archive default | `c2474e3f2e86` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.1-selection-play-parity.md` | DELETE | — | §8.5 baseline archive default | `1014316baab8` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.2-any-room-camera-placement.md` | DELETE | — | §8.5 baseline archive default | `2ee9b1348441` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.3-connect-delete.md` | DELETE | — | §8.5 baseline archive default | `816749b36e0f` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.4-guided-order.md` | DELETE | — | §8.5 baseline archive default | `a2e9f09f74f6` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.5-timeline-drag-connect.md` | DELETE | — | §8.5 baseline archive default | `06adbb8ec870` |
| `docs/archive/agent-handoffs/workspace-phases/phase-3.6.md` | DELETE | — | §8.5 baseline archive default | `00d086c1bb48` |
| `docs/archive/agent-handoffs/workspace-phases/workspace-owned-left-sidebar.md` | DELETE | — | §8.5 baseline archive default | `12965d3e99cd` |
| `docs/archive/designer-context-packet-2026-09-03.md` | DELETE | — | §8.5 baseline archive default | `7b0389ec3baa` |
| `docs/archive/legacy/2026-09-05-product-architecture-audit.md` | DELETE | — | §8.5 baseline archive default | `4f0f841c3db1` |
| `docs/archive/legacy/camera-plan-objects-brief-stub.md` | DELETE | — | §8.5 baseline archive default | `c4aa91c1ff54` |
| `docs/archive/legacy/plans-tracker-2026-09-17.md` | DELETE | — | §8.5 baseline archive default | `19779069b8e6` |
| `docs/archive/legacy/research/deep-research-report-2-compact.md` | DELETE | — | §8.5 baseline archive default | `796279e42dad` |
| `docs/archive/legacy/research/deep-research-report-compact.md` | DELETE | — | §8.5 baseline archive default | `fe8fdb9415fd` |
| `docs/archive/museum-editor/README.md` | DELETE | — | §8.5 baseline archive default | `3b79473a83e9` |
| `docs/archive/museum-editor/architecture-boundary.md` | DELETE | — | §8.5 baseline archive default | `827c5e7e0666` |
| `docs/archive/museum-editor/camera-and-tour.md` | DELETE | — | §8.5 baseline archive default | `d43486ab6091` |
| `docs/archive/museum-editor/north-star.md` | DELETE | — | §8.5 baseline archive default | `ea51c8b9f7a3` |
| `docs/archive/museum-editor/persistence-and-schema.md` | DELETE | — | §8.5 baseline archive default | `6a90501e3ce1` |
| `docs/archive/museum-editor/placement-and-transforms.md` | DELETE | — | §8.5 baseline archive default | `edfad4144dd7` |
| `docs/archive/museum-editor/product-overview.md` | DELETE | — | §8.5 baseline archive default | `522ce854eb17` |
| `docs/archive/museum-editor/roadmap-and-strategy.md` | DELETE | — | §8.5 baseline archive default | `89709172027f` |
| `docs/archive/museum-editor/scene-content.md` | DELETE | — | §8.5 baseline archive default | `923a4167131f` |
| `docs/archive/museum-editor/shell-and-workspaces.md` | DELETE | — | §8.5 baseline archive default | `e993bbd22807` |
| `docs/archive/plans/2026-08-17-plan-system-renewal.md` | DELETE | — | §8.5 baseline archive default | `002c110a3eaf` |
| `docs/archive/plans/2026-08-18-P1-camera-overhaul.md` | DELETE | — | §8.5 baseline archive default | `ebc613ddc820` |
| `docs/archive/plans/2026-08-18-P1.2-framing-envelope-serialization.md` | DELETE | — | §8.5 baseline archive default | `9f6dd4062fda` |
| `docs/archive/plans/2026-08-18-P1.3-envelope-sampler-guards.md` | DELETE | — | §8.5 baseline archive default | `291f315fd6a0` |
| `docs/archive/plans/2026-08-18-P2-plan-staging.md` | DELETE | — | §8.5 baseline archive default | `39f9b655b09d` |
| `docs/archive/plans/2026-08-18-P3-ui-overhaul.md` | DELETE | — | §8.5 baseline archive default | `106318b3093c` |
| `docs/archive/plans/2026-08-18-P6-editor-rename.md` | DELETE | — | §8.5 baseline archive default | `eb7e233dc6c7` |
| `docs/archive/plans/2026-08-18-scope-decision-camera-first.md` | DELETE | — | §8.5 baseline archive default | `28990b47e21d` |
| `docs/archive/plans/2026-08-19-P1.4-envelope-invariants-policy.md` | DELETE | — | §8.5 baseline archive default | `94bcf681fb1d` |
| `docs/archive/plans/2026-08-19-P1.5-camera-plan-surface.md` | DELETE | — | §8.5 baseline archive default | `52f86db3ec9c` |
| `docs/archive/plans/2026-08-19-P20-Project-assets-registry-R2.md` | DELETE | — | §8.5 baseline archive default | `802ac885f09f` |
| `docs/archive/plans/2026-08-19-P7-editor-facade-collapse.md` | DELETE | — | §8.5 baseline archive default | `ff952a33702f` |
| `docs/archive/plans/2026-08-20-P1.6-framing-authoring.md` | DELETE | — | §8.5 baseline archive default | `67bf5e142987` |
| `docs/archive/plans/2026-08-20-P1.7-camera-ui-reconciliation.md` | DELETE | — | §8.5 baseline archive default | `870341674510` |
| `docs/archive/plans/2026-08-21-P1.7-review-fixes-2d-viewport-persistence.md` | DELETE | — | §8.5 baseline archive default | `0de4d022b2a3` |
| `docs/archive/plans/2026-08-21-P1.8-camera-sequence-authoring.md` | DELETE | — | §8.5 baseline archive default | `16c8f145f455` |
| `docs/archive/plans/2026-08-21-P1.9-sidebar-simplification.md` | DELETE | — | §8.5 baseline archive default | `cfb4aa4cf162` |
| `docs/archive/plans/2026-08-21-P8-camera-preview-scopes.md` | DELETE | — | §8.5 baseline archive default | `80ee5fe40d06` |
| `docs/archive/plans/2026-08-21-scope-decision-p8-before-p2.md` | DELETE | — | §8.5 baseline archive default | `df2ce3172f55` |
| `docs/archive/plans/2026-08-23-P10-plan-arrange-objects.md` | DELETE | — | §8.5 baseline archive default | `44f2538e7a15` |
| `docs/archive/plans/2026-08-23-P3.1-visual-qa-deviations.md` | DELETE | — | §8.5 baseline archive default | `9e887aadc2bc` |
| `docs/archive/plans/2026-08-23-P7.6-strings-pre-inventory.md` | DELETE | — | §8.5 baseline archive default | `9003a9f6f762` |
| `docs/archive/plans/2026-08-23-P9-design-reconciliation.md` | DELETE | — | §8.5 baseline archive default | `0a87a9f62be4` |
| `docs/archive/plans/2026-08-24-P3B-groups-a-b-shipped.md` | DELETE | — | §8.5 baseline archive default | `b370dfc1a7d4` |
| `docs/archive/plans/2026-08-24-P3B-orientation-preview-affordances.md` | DELETE | — | §8.5 baseline archive default | `10103f180435` |
| `docs/archive/plans/2026-08-25-P11-camera-timeline-preview-ux-redesign.md` | DELETE | — | §8.5 baseline archive default | `9d7802ebe5a4` |
| `docs/archive/plans/2026-08-25-P11.2-mutation-gate-pre-inventory.md` | DELETE | — | §8.5 baseline archive default | `51b8b5ab23d2` |
| `docs/archive/plans/2026-08-26-P12-camera-timeline-contract-freeze.md` | DELETE | — | §8.5 baseline archive default | `c31f73c435c7` |
| `docs/archive/plans/2026-08-26-P12.2-slice-brief.md` | DELETE | — | §8.5 baseline archive default | `216f12147bf1` |
| `docs/archive/plans/2026-08-26-P12.3-slice-brief.md` | DELETE | — | §8.5 baseline archive default | `139c0e427219` |
| `docs/archive/plans/2026-08-27-P12-S4-designer-brief-amendment.md` | DELETE | — | §8.5 baseline archive default | `93688e2dcb1e` |
| `docs/archive/plans/2026-08-28-P14-camera-plan-footprints.md` | DELETE | — | §8.5 baseline archive default | `03ff1891c5e9` |
| `docs/archive/plans/2026-08-28-camera-plan-objects-brief.md` | DELETE | — | §8.5 baseline archive default | `6647078ef37a` |
| `docs/archive/plans/2026-08-29-P15-camera-core-extraction.md` | DELETE | — | §8.5 baseline archive default | `15bbaa94c31b` |
| `docs/archive/plans/2026-08-29-backend-persistence-migration-review.md` | DELETE | — | §8.5 baseline archive default | `dda792fce65b` |
| `docs/archive/plans/2026-08-30-P16-project-model-layout-core-extraction.md` | DELETE | — | §8.5 baseline archive default | `3d04e2f24050` |
| `docs/archive/plans/2026-08-30-P17-app-split.md` | DELETE | — | §8.5 baseline archive default | `7e2c5cafc640` |
| `docs/archive/plans/2026-08-30-P18-backend-provisioning.md` | DELETE | — | §8.5 baseline archive default | `dc8f9685d5e6` |
| `docs/archive/plans/2026-08-30-P19-project-persistence.md` | DELETE | — | §8.5 baseline archive default | `67563a034bc2` |
| `docs/archive/plans/2026-08-31-scope-decision-experience-interaction-boundary.md` | DELETE | — | §8.5 baseline archive default | `5d9e2b561824` |
| `docs/archive/plans/2026-09-02-P19.4-editor-shell.md` | DELETE | — | §8.5 baseline archive default | `86a4aa5770f8` |
| `docs/archive/plans/2026-09-03-P20.2-spatial-registry-integration.md` | DELETE | — | §8.5 baseline archive default | `ae69086a12f4` |
| `docs/archive/plans/2026-09-03-P20.3-texture-durable-conversion.md` | DELETE | — | §8.5 baseline archive default | `3a956a672724` |
| `docs/archive/plans/2026-09-03-P20.4-load-runtime-resolution.md` | DELETE | — | §8.5 baseline archive default | `d2e7f418389e` |
| `docs/archive/plans/2026-09-04-P21-unified-project-shell-spatial-reconciliation.md` | DELETE | — | §8.5 baseline archive default | `3784aca82f25` |
| `docs/archive/plans/2026-09-05-P21.4-preview-project-flows.md` | DELETE | — | §8.5 baseline archive default | `419c9df440e8` |
| `docs/archive/plans/2026-09-05-P21.5-ui-polish-pass.md` | DELETE | — | §8.5 baseline archive default | `a497d0ac0ce4` |
| `docs/archive/plans/2026-09-05-P21.6-3D-camera-UI-polish.md` | DELETE | — | §8.5 baseline archive default | `d3904e27d3d9` |
| `docs/archive/plans/2026-09-06-P21.5-slice-2B-camera-node-colors.md` | DELETE | — | §8.5 baseline archive default | `3daee87736c6` |
| `docs/archive/plans/2026-09-06-scope-decision-roadmap-reconciliation.md` | DELETE | — | §8.5 baseline archive default | `f5a7d43c3230` |
| `docs/archive/plans/2026-09-07-P22-basic-publish-visitor-runtime.md` | DELETE | — | §8.5 baseline archive default | `0346e5b000c0` |
| `docs/archive/plans/2026-09-09-scope-decision-unified-plan-3d-semantic-authoring.md` | DELETE | — | §8.5 baseline archive default | `fec069e5f3bb` |
| `docs/archive/plans/2026-09-16-P23.13-architectural-plan-drafting-finish.md` | DELETE | — | §8.5 baseline archive default | `67e613afd458` |
| `docs/archive/plans/camera-path-authoring.md` | DELETE | — | §8.5 baseline archive default | `3c580d7e6c31` |
| `docs/archive/plans/camera-view-authoring.md` | DELETE | — | §8.5 baseline archive default | `fb955ee6f807` |
| `docs/archive/plans/museum-editor-workspace.md` | DELETE | — | §8.5 baseline archive default | `53372f773017` |
| `docs/archive/plans/museum-editor-workspace/README-museum-editor.md` | DELETE | — | §8.5 baseline archive default | `021fe76de628` |
| `docs/archive/plans/museum-editor-workspace/phase-1-editor-layout.md` | DELETE | — | §8.5 baseline archive default | `168547d05b50` |
| `docs/archive/plans/museum-editor-workspace/phase-2-camera-editing-mvp.md` | DELETE | — | §8.5 baseline archive default | `9c69268dc68a` |
| `docs/archive/plans/museum-editor-workspace/phase-3-camera-graph-authoring.md` | DELETE | — | §8.5 baseline archive default | `47e67bd43eba` |
| `docs/archive/plans/phase-4-scene-creation/phase-4-scene-creation-plan.md` | DELETE | — | §8.5 baseline archive default | `e8854444a8bc` |
| `docs/archive/plans/phase-5-textures/2026-08-02-phase-5-1-schema-v6-plan.md` | DELETE | — | §8.5 baseline archive default | `bc2f851ee329` |
| `docs/archive/plans/phase-5-textures/2026-08-02-phase-5-2-texture-library-assignment-plan.md` | DELETE | — | §8.5 baseline archive default | `64f368bf68e7` |
| `docs/archive/plans/phase-5-textures/2026-08-03-priority-1-file-splits-plan.md` | DELETE | — | §8.5 baseline archive default | `33ac10343a3f` |
| `docs/archive/plans/phase-5-textures/2026-08-04-phase-5-3-shared-material-rendering-plan.md` | DELETE | — | §8.5 baseline archive default | `8655678172c2` |
| `docs/archive/plans/phase-5-textures/2026-08-07-phase-5-4-binary-upload-and-package-export-plan.md` | DELETE | — | §8.5 baseline archive default | `ec9be39108f5` |
| `docs/archive/plans/phase-5-textures/phase-5-textures-plan.md` | DELETE | — | §8.5 baseline archive default | `60770c71d1c5` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-a0-codec.md` | DELETE | — | §8.5 baseline archive default | `ba5b09783bcf` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-a1-line-geometry.md` | DELETE | — | §8.5 baseline archive default | `377919b6610f` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-a2-2-scale-editing.md` | DELETE | — | §8.5 baseline archive default | `ee81e965b601` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-a2-editor-preview.md` | DELETE | — | §8.5 baseline archive default | `42c7e254bc4c` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-c0-project-codec.md` | DELETE | — | §8.5 baseline archive default | `156b431b6dfc` |
| `docs/archive/plans/pre-h1-letters/2026-08-10-layout-cad-foundation.md` | DELETE | — | §8.5 baseline archive default | `5d0803005f24` |
| `docs/archive/plans/pre-h1-letters/2026-08-11-layout-cad-a2-3-opening-authoring.md` | DELETE | — | §8.5 baseline archive default | `21dc2b146dcb` |
| `docs/archive/plans/pre-h1-letters/2026-08-11-layout-cad-a3-1-camera-style-bend.md` | DELETE | — | §8.5 baseline archive default | `e475141fb7c6` |
| `docs/archive/plans/pre-h1-letters/2026-08-11-layout-cad-a3-bezier-arch-profiles.md` | DELETE | — | §8.5 baseline archive default | `930daface457` |
| `docs/archive/plans/pre-h1-letters/2026-08-11-layout-cad-a4-objects-inspectors-io.md` | DELETE | — | §8.5 baseline archive default | `adc1ac6dd0d2` |
| `docs/archive/plans/pre-h1-letters/2026-08-12-layout-cad-a4-1-polish.md` | DELETE | — | §8.5 baseline archive default | `242f27cfc13d` |
| `docs/archive/plans/pre-h1-letters/2026-08-12-layout-cad-b3-room-unit-relocate.md` | DELETE | — | §8.5 baseline archive default | `9c7af7a44e81` |
| `docs/archive/plans/pre-h1-letters/2026-08-12-layout-cad-b4-runtime-dual-read.md` | DELETE | — | §8.5 baseline archive default | `9c7c1e6c0f39` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-graphics-architecture-roadmap.md` | DELETE | — | §8.5 baseline archive default | `1de4a4da9618` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-graphics-g1-shared-geometry-compiler.md` | DELETE | — | §8.5 baseline archive default | `609524c20d8a` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-graphics-g2-plan-render-model.md` | DELETE | — | §8.5 baseline archive default | `329265afd8aa` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-graphics-g3-performance-harness.md` | DELETE | — | §8.5 baseline archive default | `bab89a6a36e3` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-graphics-g4-procedural-architectural-meshes.md` | DELETE | — | §8.5 baseline archive default | `fbd1da0f2cb0` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-layout-cad-b5-runtime-cutover.md` | DELETE | — | §8.5 baseline archive default | `affe252d8d22` |
| `docs/archive/plans/pre-h1-letters/2026-08-13-layout-viewport-switch-optimization.md` | DELETE | — | §8.5 baseline archive default | `943e5a4ca63b` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-s0-contracts.md` | DELETE | — | §8.5 baseline archive default | `3f4e5923f0a4` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-s1-editor-shell.md` | DELETE | — | §8.5 baseline archive default | `64a784939199` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-s2-boot-empty.md` | DELETE | — | §8.5 baseline archive default | `0d959c359456` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-s2.1-room-delete.md` | DELETE | — | §8.5 baseline archive default | `66cea2dcbf13` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-s3-cross-domain-selection.md` | DELETE | — | §8.5 baseline archive default | `94996160c0a2` |
| `docs/archive/plans/pre-h1-letters/2026-08-14-graphics-h1-unified-3d-editing.md` | DELETE | — | §8.5 baseline archive default | `dd6d1072de1d` |
| `docs/archive/plans/pre-h1-letters/2026-08-15-geometry-kernel-library-review.md` | DELETE | — | §8.5 baseline archive default | `7554e083556f` |
| `docs/archive/plans/pre-h1-letters/2026-08-15-graphics-h1-s4-unified-hierarchy.md` | DELETE | — | §8.5 baseline archive default | `30d66f2c5b49` |
| `docs/archive/plans/pre-h1-letters/2026-08-15-graphics-h1-s5-layout-3d-pick-metadata.md` | DELETE | — | §8.5 baseline archive default | `2fe3892aed7e` |
| `docs/archive/plans/pre-h1-letters/2026-08-15-graphics-h1-s6-layout-3d-selection.md` | DELETE | — | §8.5 baseline archive default | `fa127776d709` |
| `docs/archive/plans/pre-h1-letters/2026-08-16-graphics-h1-s7-single-gizmo-host.md` | DELETE | — | §8.5 baseline archive default | `c4c496ccb299` |
| `docs/archive/plans/pre-h1-letters/2026-08-16-graphics-h1-s8-layout-gizmo-candidate-session.md` | DELETE | — | §8.5 baseline archive default | `b770ebc15d8d` |
| `docs/archive/plans/pre-h1-letters/2026-08-17-graphics-h1-s10-camera-extraction.md` | DELETE | — | §8.5 baseline archive default | `47b30aa171bc` |
| `docs/archive/plans/pre-h1-letters/2026-08-17-graphics-h1-s10.1-camera-workspace-ui-rework.md` | DELETE | — | §8.5 baseline archive default | `43556e5ac780` |
| `docs/archive/plans/pre-h1-letters/2026-08-17-graphics-h1-s10.2-camera-flow-model.md` | DELETE | — | §8.5 baseline archive default | `ee6e535a34bd` |
| `docs/archive/plans/pre-h1-letters/2026-08-17-graphics-h1-s8.1-room-agnostic-placement.md` | DELETE | — | §8.5 baseline archive default | `000d64e14037` |
| `docs/archive/plans/pre-h1-letters/2026-08-17-graphics-h1-s8.2-room-focus-cluster-expansion.md` | DELETE | — | §8.5 baseline archive default | `3754e30220ae` |
| `docs/archive/plans/pre-h1-letters/2026-08-18-camera-framing-design-review.md` | DELETE | — | §8.5 baseline archive default | `f4209878efff` |
| `docs/archive/plans/pre-h1-letters/CURRENT.original.md` | DELETE | — | §8.5 baseline archive default | `2a18254ed785` |
| `docs/archive/plans/pre-h1-letters/architecture.original.md` | DELETE | — | §8.5 baseline archive default | `735685da8f35` |
| `docs/archive/plans/pre-h1-letters/north-star.original.md` | DELETE | — | §8.5 baseline archive default | `653ae3eaed17` |
| `docs/archive/plans/pre-h1-letters/persistence.original.md` | DELETE | — | §8.5 baseline archive default | `096d7df2d193` |
| `docs/archive/plans/pre-h1-letters/placement.original.md` | DELETE | — | §8.5 baseline archive default | `ba28ee4e4c5f` |
| `docs/archive/plans/pre-h1-letters/shell.original.md` | DELETE | — | §8.5 baseline archive default | `09d06f83cf44` |
| `docs/archive/refactor-audit/2026-07-28-museum-editor.md` | DELETE | — | §8.5 baseline archive default | `b8e51ec59123` |
| `docs/archive/refactor-audit/2026-07-28-refactor-plan.md` | DELETE | — | §8.5 baseline archive default | `a3e45b4a8780` |
| `docs/archive/roadmap/p23/Designer-C-proposal.md` | DELETE | — | §8.5 baseline archive default | `56e1346d53b0` |
| `docs/archive/roadmap/p23/P23.13-final-design-specification-Designer-D.md` | DELETE | — | §8.5 baseline archive default | `edd4277df42e` |
| `docs/archive/roadmap/p23/P23.13-icon-studies-Designer-D.svg` | DELETE | — | §8.5 baseline archive default | `1e55363d5189` |
| `docs/archive/roadmap/p23/P23.13-ink-and-instrument-atlas-Designer-D.html` | DELETE | — | §8.5 baseline archive default | `2c84a919634e` |
| `docs/archive/roadmap/p23/P23.13-ink-and-instrument-proposal-Designer-D.md` | DELETE | — | §8.5 baseline archive default | `4b59c72cc6d1` |
| `docs/archive/roadmap/p23/foundation-research/P23-H1-wall-room-geometry.md` | DELETE | — | §8.5 baseline archive default | `aa088b8b8109` |
| `docs/archive/roadmap/p23/foundation-research/P23-H2-snapping-selection-guides.md` | DELETE | — | §8.5 baseline archive default | `ff09ad8c9b72` |
| `docs/archive/roadmap/p23/foundation-research/P23-H3-robust-geometry.md` | KEEP | — | §8.5 named archive exceptions | `7a6c425015b8` |
| `docs/archive/roadmap/p23/foundation-research/P23-H5-room-identity-migration.md` | KEEP | — | §8.5 named archive exceptions | `d5b59b2f5db9` |
| `docs/archive/roadmap/p23/foundation-research/P23-wall-first-replan-proposal.md` | DELETE | — | §8.5 baseline archive default | `01b251e3afc2` |
| `docs/archive/roadmap/p23/foundation-research/deep-research-P23-compact.md` | DELETE | — | §8.5 baseline archive default | `c3ed54c02992` |
| `docs/archive/roadmap/p23/foundation-research/deep-research-layout-cad.md` | DELETE | — | §8.5 baseline archive default | `9b2f2a16a144` |
| `docs/archive/roadmap/p23/p23.12-designer-brief.md` | DELETE | — | §8.5 baseline archive default | `7cd14d88b3c4` |
| `docs/archive/roadmap/p23/p23.12-final-design-contract.md` | DELETE | — | §8.5 baseline archive default | `80bb64046d63` |
| `docs/archive/roadmap/p23/p23.13-architectural-plan-drafting-precedent-research.md` | DELETE | — | §8.5 baseline archive default | `fdb2d3aa93d5` |
| `docs/archive/roadmap/p23/p23.13-designer-brief.md` | DELETE | — | §8.5 baseline archive default | `b8915e965c40` |
| `docs/archive/roadmap/p23/p23.13-synthesized-direction.md` | DELETE | — | §8.5 baseline archive default | `8f3f0e450fe6` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/01-scene-plan-layout.png` | DELETE | — | §8.5 baseline archive default | `204985fc51ff` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/02-scene-plan-edit.png` | DELETE | — | §8.5 baseline archive default | `8ac542a0b117` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/03-camera-plan-timeline.png` | DELETE | — | §8.5 baseline archive default | `1bbabc21bb11` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/04-camera-3d.png` | DELETE | — | §8.5 baseline archive default | `bd5183bf40ab` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/05-scene-3d.png` | DELETE | — | §8.5 baseline archive default | `8fab80a7bb83` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/PLATE-1.png` | DELETE | — | §8.5 baseline archive default | `18e0c15d92d2` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/PLATE-2.png` | DELETE | — | §8.5 baseline archive default | `ae44d236b178` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/PLATE-3.png` | DELETE | — | §8.5 baseline archive default | `d0608f2408ea` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/screenshots/PLATE-4.png` | DELETE | — | §8.5 baseline archive default | `567230b83b30` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/context/shell-design-context.md` | DELETE | — | §8.5 baseline archive default | `0af19c9dde32` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/atlas/index.html` | DELETE | — | §8.5 baseline archive default | `06279479ff17` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/atlas/p23.13-p23.14-atlas-reconciliation.md` | DELETE | — | §8.5 baseline archive default | `00a7c72b27b1` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/briefs/p23.14-designer-brief.md` | DELETE | — | §8.5 baseline archive default | `7b376f11995a` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-a.md` | DELETE | — | §8.5 baseline archive default | `5026fca80db8` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/design-notes.md` | DELETE | — | §8.5 baseline archive default | `8f2489969e42` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/gallery.html` | DELETE | — | §8.5 baseline archive default | `9fa60b292616` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/index.html` | DELETE | — | §8.5 baseline archive default | `540126964476` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-A.png` | DELETE | — | §8.5 baseline archive default | `bdbda1a6ba6d` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-B.png` | DELETE | — | §8.5 baseline archive default | `8411dbd3676b` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-C.png` | DELETE | — | §8.5 baseline archive default | `834c18b7658b` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-D.png` | DELETE | — | §8.5 baseline archive default | `2a8c927e721b` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-E-collapsed.png` | DELETE | — | §8.5 baseline archive default | `4e04706f1dae` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-E-empty-collapsed.png` | DELETE | — | §8.5 baseline archive default | `b5a300054105` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-E-empty.png` | DELETE | — | §8.5 baseline archive default | `fb6bae54e730` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-E.png` | DELETE | — | §8.5 baseline archive default | `fd5c0376066b` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/index-F.png` | DELETE | — | §8.5 baseline archive default | `de64531552bf` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-A.png` | DELETE | — | §8.5 baseline archive default | `094c68ea9651` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-B.png` | DELETE | — | §8.5 baseline archive default | `8d9bbdfc1260` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-C.png` | DELETE | — | §8.5 baseline archive default | `ba6708bebad7` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-D.png` | DELETE | — | §8.5 baseline archive default | `c72c4afac03e` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-E-collapsed.png` | DELETE | — | §8.5 baseline archive default | `7bd9d8097d63` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-E-empty-collapsed.png` | DELETE | — | §8.5 baseline archive default | `1c2859f0ae38` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-E-empty.png` | DELETE | — | §8.5 baseline archive default | `0450738e540e` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-E.png` | DELETE | — | §8.5 baseline archive default | `cc780aa16320` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/screens/sidecar-F.png` | DELETE | — | §8.5 baseline archive default | `7900d3d92340` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/specimens.js` | DELETE | — | §8.5 baseline archive default | `e5e04abb7677` |
| `docs/archive/roadmap/p23/p23.14-shell-visual-system/design/proposals/designer-d/styles.css` | DELETE | — | §8.5 baseline archive default | `d9641447f093` |
| `docs/archive/roadmap/p25-experience/p25-unified-design/p23b-browser-report.json` | KEEP byte-identical | — | §8.3 accepted UX comparator evidence | `5c9156e1b873` |
| `docs/archive/roadmap/p25-experience/p25-unified-design/p23b-validation-result.json` | KEEP byte-identical | — | §8.3 accepted UX comparator evidence | `d8f968059d9b` |
| `docs/archive/superpowers/plans/2026-08-09-museum-editor-full-track.md` | DELETE | — | §8.5 baseline archive default | `7737843e38de` |
| `docs/archive/superpowers/plans/2026-08-10-layout-cad-foundation-plan-premerge.md` | DELETE | — | §8.5 baseline archive default | `ed1d305f12c3` |
| `docs/archive/superpowers/plans/2026-08-12-layout-room-name-canonical-export.md` | DELETE | — | §8.5 baseline archive default | `38c365ad3a6f` |
| `docs/archive/superpowers/plans/museum-editor-full-track/2026-08-09-phase-6-5-architecture-shaping-plan.md` | DELETE | — | §8.5 baseline archive default | `c7b433e57a18` |
| `docs/archive/superpowers/plans/phase-6/2026-08-08-phase-6-1-gizmo-parity.md` | DELETE | — | §8.5 baseline archive default | `e5f32c8d0a79` |
| `docs/archive/superpowers/plans/phase-6/2026-08-08-phase-6-2-obb-pivot-and-settings.md` | DELETE | — | §8.5 baseline archive default | `338a1ecb79e4` |
| `docs/archive/superpowers/reviews/2026-08-10-layout-cad-foundation-goal-alignment.md` | DELETE | — | §8.5 baseline archive default | `546cb550613e` |
| `docs/archive/superpowers/specs/2026-07-28-camera-viewport-toggles-and-connection-list.md` | DELETE | — | §8.5 baseline archive default | `8068105833b3` |
| `docs/archive/superpowers/specs/2026-08-09-museum-editor-full-track-design.md` | DELETE | — | §8.5 baseline archive default | `2c616cadb37f` |
| `docs/archive/superpowers/specs/2026-08-10-layout-cad-foundation-design.md` | DELETE | — | §8.5 baseline archive default | `a937897c705e` |
| `docs/archive/superpowers/specs/museum-editor-full-track/2026-08-09-phase-6-5-architecture-shaping-design.md` | DELETE | — | §8.5 baseline archive default | `903154fe0520` |
| `docs/archive/superpowers/specs/phase-5-textures/2026-08-02-phase-5-2-texture-library-assignment-design.md` | DELETE | — | §8.5 baseline archive default | `84cdd88ee549` |
| `docs/archive/superpowers/specs/phase-5-textures/2026-08-04-phase-5-3-shared-material-rendering-design.md` | DELETE | — | §8.5 baseline archive default | `27f2193b92a9` |
| `docs/archive/superpowers/specs/phase-5-textures/2026-08-07-phase-5-4-binary-upload-and-package-export-design.md` | DELETE | — | §8.5 baseline archive default | `aaf2b18155a1` |
| `docs/archive/superpowers/specs/phase-6/2026-08-08-phase-6-1-gizmo-parity-design.md` | DELETE | — | §8.5 baseline archive default | `aea1760b3eae` |
| `docs/archive/superpowers/specs/phase-6/2026-08-08-phase-6-2-obb-pivot-and-settings-design.md` | DELETE | — | §8.5 baseline archive default | `8840f4b39e00` |
| `docs/operations/architecture-cycle.md` | CONSOLIDATE | — | §8.5/§11 live state + operative protocol | `e33825619739` |
| `docs/operations/checkpoints/README.md` | RETAIN + rewrite | — | §8.5/§10 baton + debt | `6b477379e8f3` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-captures.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `78f6f18e43bf` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-diff-check.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `8e1ea056108c` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-docs.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `d887d8f405f1` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-domain.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `211bd8d1ac88` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-donor-typecheck.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `32158abbd10f` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-donor.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `1df97620e55c` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-integrated.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `3548ed2dd019` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-mutations.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `dd3af72d0e99` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-narrow.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `2ee2787fadc6` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-provenance.json` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `0cfc01fe266d` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-arch.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `7f890d7678ad` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-build.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `bb3c87a620b5` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-check.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `e97732999a2d` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-test.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `2c786e07e843` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-world-calibration.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `10b53e50b33d` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/owned-session-cleanup.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `1f42c58225d3` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/paused-provenance.json` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `46b2208bf6a5` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/pre-density-provenance.json` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `85baa79ce208` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-captures-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `f242d2dbe943` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-comparisons.py` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `c106340d2923` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-domain-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `23cb7dba8c4f` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-donor-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `6d880ee5eb0d` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-integrated-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `f47a6c0ca4a3` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-mutations-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `81aa8b0bef9e` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-narrow-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `e941f3cf66bd` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-arch-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `d6c2f6456854` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-build-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `ef0c643fe971` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-check-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `9273e89da17f` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-status-final.json` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `1360618230ea` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-test-final.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `61f601b0b902` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/worktree-status.txt` | MOVE | `prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/` | §8.3 | `f8144b3f37f3` |
| `docs/operations/current.md` | RETAIN + rewrite | — | §8.5/§10 baton + debt | `733948f430d5` |
| `docs/operations/tech-debt/README.md` | RETAIN + rewrite | — | §8.5/§10 baton + debt | `98c1ba0933c6` |
| `docs/operations/test-suite-harvest-2026-09-19.md` | DELETE | — | §8.5 describes a restructured tree | `170ab0d62efc` |
| `docs/operations/test-suite-harvest-inventory-2026-09-19.csv` | DELETE | — | §8.1 DELETE remainder (directory READMEs, stubs, status text) | `92114ba87796` |
| `docs/reference/architecture.md` | RETAIN | — | §8.2 live authority | `c8c8e7c758c7` |
| `docs/reference/components/assets.md` | RETAIN + update | — | §8.2 strict generation, removed facades, actual paths | `f966a42fc659` |
| `docs/reference/components/camera-tour.md` | RETAIN + rewrite | — | §8.2 camera-core kernel; graph vs order until T3 | `30a0c0686ab6` |
| `docs/reference/components/persistence.md` | RETAIN + update | — | §8.2 strict generation, removed facades, actual paths | `226e57202476` |
| `docs/reference/components/placement.md` | CONSOLIDATE then DELETE | — | §8.2 kernel facts → scene-content.md; TD-1 → T2 evidence | `5220c517f604` |
| `docs/reference/components/scene-codec.md` | RETAIN + update | — | §8.2 strict generation, removed facades, actual paths | `758f1acef1c9` |
| `docs/reference/components/scene-content.md` | RETAIN + update | — | §8.2 strict generation, removed facades, actual paths | `b604811163f9` |
| `docs/reference/components/shell.md` | DELETE | — | §8.2 landed subject removed | `395a9ae8e004` |
| `docs/reference/components/theme.md` | DELETE | — | §8.2 landed subject removed | `8cdcfd0e2256` |
| `docs/reference/composition-execution.md` | RETAIN | — | §8.2 live authority | `06ff7bde406f` |
| `docs/reference/decisions/northstar-ratification-2026-09-27.md` | RETAIN | — | §8.2 immutable provenance | `7c684914d9a5` |
| `docs/reference/decisions/world-experience-reconciliation-2026-09-29.md` | RETAIN | — | §8.2 immutable provenance | `73215a929a54` |
| `docs/reference/design-system/P23.13-drafting-icons-Designer-D.svg` | DELETE | — | §8.2 implementation removed | `e75c288cdf3a` |
| `docs/reference/design-system/camera-flow-specs.md` | DELETE | — | §8.2 implementation removed | `31fc77a1e297` |
| `docs/reference/design-system/camera-layout-design.md` | DELETE | — | §8.2 implementation removed | `2010ce375ede` |
| `docs/reference/design-system/design-plan-p21.md` | DELETE | — | §8.2 implementation removed | `62d8d5aafe25` |
| `docs/reference/design-system/design-shell-specs.md` | DELETE | — | §8.2 implementation removed | `b1f83f9ac508` |
| `docs/reference/design-system/design-specs.md` | DELETE | — | §8.2 implementation removed | `6fef61dc435b` |
| `docs/reference/design-system/editor-shell-and-visual-system.md` | RETAIN | — | §8.2 ratified design contracts | `ed13a9018c28` |
| `docs/reference/design-system/editor-shell-atlas/index.html` | ARCHIVE/MOVE | `docs/archive/technical/editor-shell/atlas/` | §8.2 whole bundle, working HTML assets | `f7807ed58a3c` |
| `docs/reference/design-system/editor-shell-atlas/notes.md` | ARCHIVE/MOVE | `docs/archive/technical/editor-shell/atlas/` | §8.2 whole bundle, working HTML assets | `58432e148ef0` |
| `docs/reference/design-system/editor-shell-ratifications.md` | ARCHIVE/MOVE | `docs/archive/technical/editor-shell/ratifications.md` | §8.2 after PLATE coverage check | `0932a31341af` |
| `docs/reference/design-system/gallery/Camera/camera-timeline-expanded.png` | DELETE | — | §8.2 implementation removed | `78ea7fba54cf` |
| `docs/reference/design-system/gallery/Future/assets-concept.png` | DELETE | — | §8.2 implementation removed | `77fd29e5893e` |
| `docs/reference/design-system/gallery/Future/project-hub-cover-enabled.png` | DELETE | — | §8.2 implementation removed | `fb8f6ee0f46a` |
| `docs/reference/design-system/gallery/Future/publish-concept.png` | DELETE | — | §8.2 implementation removed | `4a7cd06a8fab` |
| `docs/reference/design-system/gallery/P21/Preview.png` | DELETE | — | §8.2 implementation removed | `bf03f8b69fa4` |
| `docs/reference/design-system/gallery/P21/camera-3d.png` | DELETE | — | §8.2 implementation removed | `8dfe5543244f` |
| `docs/reference/design-system/gallery/P21/camera-plan.png` | DELETE | — | §8.2 implementation removed | `1306b649afc7` |
| `docs/reference/design-system/gallery/P21/scene-3d.png` | DELETE | — | §8.2 implementation removed | `faf789ae912b` |
| `docs/reference/design-system/gallery/P21/scene-plan-arrange.png` | DELETE | — | §8.2 implementation removed | `421cfae0e063` |
| `docs/reference/design-system/gallery/P21/scene-plan-layout.png` | DELETE | — | §8.2 implementation removed | `3a91b615e991` |
| `docs/reference/design-system/gallery/Scene/scene-3d-assets.png` | DELETE | — | §8.2 implementation removed | `d6244aaffd1d` |
| `docs/reference/design-system/gallery/Scene/scene-3d-layout-selection.png` | DELETE | — | §8.2 implementation removed | `569fc9177d92` |
| `docs/reference/design-system/gallery/Scene/scene-3d-object-selection-xyz-gizmo.png` | DELETE | — | §8.2 implementation removed | `04d21cf9e389` |
| `docs/reference/design-system/gallery/Scene/scene-3d-object-selection.png` | DELETE | — | §8.2 implementation removed | `25559737ae9c` |
| `docs/reference/design-system/gallery/Scene/scene-empty-plan.png` | DELETE | — | §8.2 implementation removed | `20592f34a5ca` |
| `docs/reference/design-system/gallery/Scene/scene-plan-layout.png` | DELETE | — | §8.2 implementation removed | `7f8d6f811dd5` |
| `docs/reference/design-system/gallery/x-y-z-box.png` | DELETE | — | §8.2 implementation removed | `80ddebfb4eb3` |
| `docs/reference/design-system/orientation-box-render-brief.md` | DELETE | — | §8.2 implementation removed | `f63c12a7d208` |
| `docs/reference/design-system/orientation-box-spec.md` | DELETE | — | §8.2 implementation removed | `602a9482f54c` |
| `docs/reference/design-system/p21-visual-implementation-references.md` | DELETE | — | §8.2 implementation removed | `bccb15911883` |
| `docs/reference/design-system/shell-camera-workspaces.md` | DELETE | — | §8.2 implementation removed | `3fcef2df6d10` |
| `docs/reference/design-system/shell-scene-workspaces.md` | DELETE | — | §8.2 implementation removed | `b47185367c16` |
| `docs/reference/design-system/spatial-instrument-grammar.md` | RETAIN | — | §8.2 ratified design contracts | `b7cc72413e17` |
| `docs/reference/design-system/visual-registry.md` | DELETE | — | §8.2 implementation removed | `eafdf3ae7adc` |
| `docs/reference/north-star.md` | RETAIN | — | §8.2 live authority | `5284ec11599b` |
| `docs/roadmap/README.md` | RETAIN + update | — | §10 global roadmap/track register | `a7d02c1eeccd` |
| `docs/roadmap/architecture-operating-cycle-plan.md` | CONSOLIDATE then ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/operating-cycle-plan.md` | §8.5 | `fa7da837702a` |
| `docs/roadmap/architecture-operating-cycle-workflow-harvest.md` | DELETE | — | §8.5 after consolidation | `d93c2fe2a148` |
| `docs/roadmap/architecture-operating-cycle/phase-0/2026-09-22-P0-frozen-evidence-range.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `1e3a53d6578d` |
| `docs/roadmap/architecture-operating-cycle/phase-0/2026-09-22-P0-investigation-brief.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `9136f3839a6e` |
| `docs/roadmap/architecture-operating-cycle/phase-0/README.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `3e8d01983941` |
| `docs/roadmap/architecture-operating-cycle/phase-0/adjudication.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `8a7194a217b6` |
| `docs/roadmap/architecture-operating-cycle/phase-0/mechanical-control-pass.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `10dd4b74036a` |
| `docs/roadmap/architecture-operating-cycle/phase-0/review-a.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `1421db7e6dcd` |
| `docs/roadmap/architecture-operating-cycle/phase-0/review-b.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `938ac2d25ab8` |
| `docs/roadmap/architecture-operating-cycle/phase-0/structural-workflow.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `0be9a9db5ac6` |
| `docs/roadmap/architecture-operating-cycle/phase-1/2026-09-22-P1-installation-plan.md` | ARCHIVE/MOVE | `docs/archive/technical/architecture-cycle/` | §8.5 nine-file bundle | `d38b3603a512` |
| `docs/roadmap/backlog/2026-08-21-branch-rejoin-experiment.md` | CONSOLIDATE then DELETE | — | §8.4 non-authoritative proposal/backlog | `81ac7b1851eb` |
| `docs/roadmap/backlog/2026-08-27-P13-stop-at-node-playback.md` | CONSOLIDATE then DELETE | — | §8.4 non-authoritative proposal/backlog | `ea1eeb87f40e` |
| `docs/roadmap/f-foundation-contracts/README.md` | RETAIN + update | — | §9.5 phase registration route | `304f2696a557` |
| `docs/roadmap/f-foundation-contracts/design/proposals/2026-09-27-biskiq-durable-design-commissions.md` | CONSOLIDATE then DELETE | — | §8.4 non-authoritative proposal/backlog | `9a338e42045a` |
| `docs/roadmap/model-assessment.md` | CONSOLIDATE then DELETE | — | §8.4 non-authoritative proposal/backlog | `ca726c96fdb2` |
| `docs/roadmap/p23-layout-depth/2026-09-07-P23-layout-depth-minimum-build.md` | DELETE | — | §8.5 all other P23 planning | `61b7931fb0b6` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.1-precise-placement-and-dimensions.md` | DELETE | — | §8.5 all other P23 planning | `66bb45ee4784` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.16-final-whole-product-integration-closeout.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `357a00f0d053` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.2-snapping-and-alignment.md` | DELETE | — | §8.5 all other P23 planning | `885de30ba178` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.3-openings-that-fit.md` | DELETE | — | §8.5 all other P23 planning | `fd517e3206cf` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.4-duplicate-and-linear-repeat.md` | DELETE | — | §8.5 all other P23 planning | `d0a96cf4a7e1` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.5-architectural-presets.md` | DELETE | — | §8.5 all other P23 planning | `7b5793a87ec3` |
| `docs/roadmap/p23-layout-depth/2026-09-08-P23.6-architectural-drafting-visual-pass.md` | DELETE | — | §8.5 all other P23 planning | `148ee7b3dca5` |
| `docs/roadmap/p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md` | DELETE | — | §8.5 all other P23 planning | `038257931ce2` |
| `docs/roadmap/p23-layout-depth/2026-09-09-P23.0-wall-first-foundation-migration.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 closure provenance | `8afab0f1ecf3` |
| `docs/roadmap/p23-layout-depth/2026-09-09-P23.8-wall-topology-room-regions.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 closure provenance | `2f0e335a503d` |
| `docs/roadmap/p23-layout-depth/2026-09-09-P23.9-wall-partition-sketching.md` | DELETE | — | §8.5 all other P23 planning | `261ed29f5522` |
| `docs/roadmap/p23-layout-depth/2026-09-12-P23.6H-vertical-wall-semantics.md` | DELETE | — | §8.5 all other P23 planning | `3a4b9ef6278b` |
| `docs/roadmap/p23-layout-depth/2026-09-12-P23.6I-wall-defined-vertical-envelope.md` | DELETE | — | §8.5 all other P23 planning | `d80b9ddab2e3` |
| `docs/roadmap/p23-layout-depth/2026-09-12-P23.6a-wall-first-room-unit-move.md` | DELETE | — | §8.5 all other P23 planning | `8c6806bbe9fe` |
| `docs/roadmap/p23-layout-depth/2026-09-12-P23.6b-architecture-hierarchy-inspector-reconciliation.md` | DELETE | — | §8.5 all other P23 planning | `4e2e9b6e8361` |
| `docs/roadmap/p23-layout-depth/2026-09-13-P23.6c-canonical-wall-deletion.md` | DELETE | — | §8.5 all other P23 planning | `b7b6aad62ad9` |
| `docs/roadmap/p23-layout-depth/2026-09-13-P23.6d-canonical-room-lifecycle-completion.md` | DELETE | — | §8.5 all other P23 planning | `3a782b74f5e2` |
| `docs/roadmap/p23-layout-depth/2026-09-13-P23.6e-relationship-aware-hierarchy.md` | DELETE | — | §8.5 all other P23 planning | `6b1f39086d50` |
| `docs/roadmap/p23-layout-depth/2026-09-14-P23-remaining-roadmap-reconciliation.md` | DELETE | — | §8.5 all other P23 planning | `d81083663f91` |
| `docs/roadmap/p23-layout-depth/2026-09-14-P23.10-direct-wall-and-junction-editing.md` | DELETE | — | §8.5 all other P23 planning | `61390fb82b83` |
| `docs/roadmap/p23-layout-depth/2026-09-14-P23.11-canonical-curved-walls-and-render-safe-validation.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 closure provenance | `d3ada88097a8` |
| `docs/roadmap/p23-layout-depth/2026-09-14-P23.9-wall-span-topology-regression.md` | DELETE | — | §8.5 all other P23 planning | `a49e9248726d` |
| `docs/roadmap/p23-layout-depth/2026-09-15-P23.12-names-and-stable-display-identity.md` | DELETE | — | §8.5 all other P23 planning | `e4111d74c0b1` |
| `docs/roadmap/p23-layout-depth/2026-09-17-P23-junction-dissolve-wall-join.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 closure provenance | `657bebde72b5` |
| `docs/roadmap/p23-layout-depth/P23.6e-directive.md` | DELETE | — | §8.5 all other P23 planning | `e1db4cb04935` |
| `docs/roadmap/p23-layout-depth/README.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 closure provenance | `09135c1fbcf2` |
| `docs/roadmap/p23-layout-depth/context/p23-design-context.md` | DELETE | — | §8.5 all other P23 planning | `a550d95523d2` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/2026-09-19-P23.14-plate-shell-visual-system.md` | DELETE | — | §8.5 all other P23 planning | `9891419105bf` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/context/shell-design-context.md` | DELETE | — | §8.5 all other P23 planning | `b8cf85732c74` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/atlas/notes.md` | DELETE | — | §8.5 all other P23 planning | `1a2f41dd9b24` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/atlas/p23.13-p23.14-atlas-reconciliation.md` | DELETE | — | §8.5 all other P23 planning | `5686bfe79001` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/briefs/p23.14-designer-brief.md` | DELETE | — | §8.5 all other P23 planning | `b0304e18f249` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/final-direction.md` | DELETE | — | §8.5 all other P23 planning | `88a31ff07693` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/owner-ratifications.md` | DELETE | — | §8.5 all other P23 planning | `30c047f22760` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/proposals/designer-a.md` | DELETE | — | §8.5 all other P23 planning | `8d6ca309f62c` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/design/proposals/designer-d/design-notes.md` | DELETE | — | §8.5 all other P23 planning | `27057099f29b` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `c273a1a5b3f4` |
| `docs/roadmap/p23-layout-depth/p23.14-shell-visual-system/research/editor-shell-visual-system.md` | DELETE | — | §8.5 all other P23 planning | `6ba9b9238346` |
| `docs/roadmap/p23-layout-depth/p23.15-junction-correct-wall-first-3d/2026-09-21-P23.15-junction-correct-wall-first-3d.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `35c43f311c6e` |
| `docs/roadmap/p23-layout-depth/p23.15-junction-correct-wall-first-3d/qa/2026-09-21-P23.15-junction-qa-record.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `c50038bab8a8` |
| `docs/roadmap/p23-layout-depth/p23.15-junction-correct-wall-first-3d/research/future-proof-room-wall-junction-3d-geometry.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `d8a44a437097` |
| `docs/roadmap/p23-layout-depth/p23.16-whole-product-integration-closeout/2026-09-22-P23.16-verification-plan.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `1d1ef4cdfc88` |
| `docs/roadmap/p23-layout-depth/p23.16-whole-product-integration-closeout/qa/2026-09-22-P23.16-qa-gate-record.md` | ARCHIVE/MOVE | `docs/archive/technical/p23/` | §8.5 final gates/watertight/TD-2 origin | `915f815c8d8e` |
| `docs/roadmap/p23b-geometry-performance/2026-09-22-P23B-geometry-performance-stabilization-umbrella.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `11935a597692` |
| `docs/roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `6102e876414a` |
| `docs/roadmap/p23b-geometry-performance/README.md` | ARCHIVE/MOVE | `docs/archive/technical/p23b/` | §8.5 closure provenance + algorithm decision | `bd42ee8f9c20` |
| `docs/roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-capture.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `fb49aeadfb39` |
| `docs/roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `9c193ac82d9c` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `e981df2d98ed` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-a-12-curved-walls.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `778e380b5e06` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-b-owner-40-curved-walls.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `c7bc75412ad8` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `e5454d73d2a7` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-durable-measurement-report.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `da2ea0d56166` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/2026-09-24-P23B.0-ratification-handoff.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `ad3fbabeeed6` |
| `docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `76ee1e9b5266` |
| `docs/roadmap/p23b-geometry-performance/p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-harvest-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `26da104a7e63` |
| `docs/roadmap/p23b-geometry-performance/p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-internal-geometry-pipeline-harvest.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `14e4d9211f49` |
| `docs/roadmap/p23b-geometry-performance/p23b.10-phase-closeout/2026-09-22-P23B.10-phase-closeout.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `29a0526c395d` |
| `docs/roadmap/p23b-geometry-performance/p23b.10-phase-closeout/2026-09-29-P23B.10-closeout-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `ca23ab2d7288` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-S1-browser-profile-classes.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `ae6317f415c8` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-S1-browser-profile.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `56fd210cfc10` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-S1-browser-profile.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `b7072ce08b14` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay-umbrella.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `273fd2f43c94` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `b2a869f9bf71` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S3-shortcircuit-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `839ad3466cb5` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S4-gate-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `eb506cee1a99` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S5-identity-early-out-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `c024c2cbb025` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S6-m4-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `b780f04dd2b6` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-browser-profile.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `705c52b9f7bd` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-remeasurement-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `9a175b5814c7` |
| `docs/roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-review-fix-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `33614a2cef6c` |
| `docs/roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `d73a476b5e22` |
| `docs/roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-research-navigation.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `801dbbccad07` |
| `docs/roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md` | ARCHIVE/MOVE | `docs/archive/technical/p23b/` | §8.5 closure provenance + algorithm decision | `5fa1d81ede35` |
| `docs/roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `2de513f9601e` |
| `docs/roadmap/p23b-geometry-performance/p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `fe7636eecc6e` |
| `docs/roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `26639ba7cb2d` |
| `docs/roadmap/p23b-geometry-performance/p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `14d1aa8c8fc5` |
| `docs/roadmap/p23b-geometry-performance/p23b.4-compilation-invalidation-optimization/2026-09-22-P23B.4-compilation-invalidation-optimization.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `0f81baa6ae35` |
| `docs/roadmap/p23b-geometry-performance/p23b.4-compilation-invalidation-optimization/2026-09-25-P23B.4-evidence-findings.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `35053375109c` |
| `docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/2026-09-22-P23B.5-caching-reuse-optimization.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `88b7e3730172` |
| `docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `d14a06604361` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `4a4836af4893` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-25-P23B.6-S1-attribution-data.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `3cb2ade07ffa` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-25-P23B.6-S1-attribution-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `78a6b30f0535` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S1a-post-SR-development.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `cc876c1e9f2c` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S1a-post-SR-production.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `06c614bfb51e` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S1a-post-SR-regate.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `cab66293b1d0` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S1b-final-head-coverage.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `86cfdc2e5270` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S1b-final-head.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `6f059e396b7d` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-abandonment-data.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `ed0ffb80e103` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-abandonment-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `35d995b40e97` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-comparator-reconciliation-data.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `8e705962c8d4` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-comparator-reconciliation.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `fc3f9a7202c6` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-guard-recheck-data.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `be26d3d3c2d7` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-guard-recheck.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `d1cd4df8fb08` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-integrated-probe-data.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `9bdeaa4a8a35` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-integrated-probe-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `1d4267b0ed6c` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S6-final-evidence.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `50b382fdd28b` |
| `docs/roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-release-delay-diagnosis.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `acfbda59d398` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-22-P23B.7-interaction-optimization.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `bb444d9491f6` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-pr92-correction-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `2d895f406d6e` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s4-verdict-scope-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `2b3efa1ca392` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json` | DELETE | — | §8.5 benchmark purpose fulfilled | `3b7cd95df41a` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `c772d1e95d00` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s7-capture-attribution-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `b924850d7fe4` |
| `docs/roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s7-followup-model-free-capture-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `30dae0ecffd2` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S0-leg-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `6efe28d859ba` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S10-coverage-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `1c72db1f8acb` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S4-D10-ruling.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `5b042d7ed61c` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S5-lod-disposition.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `53025753cbc3` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S6-D5-identity-revert.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `39f19c47712c` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S7-D6-compositor-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `30a55e909ad4` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S8-prune-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `1138a39e48d6` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-S9-probe-disposition.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `6127ff078ef3` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-acceptance-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `3dfa06526208` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-follow-up/2026-09-29-P23B.8-follow-up-plan.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `03a2c63fcf93` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-rust-wasm-evaluation/2026-09-22-P23B.8-rust-wasm-evaluation.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `112e07a84ccf` |
| `docs/roadmap/p23b-geometry-performance/p23b.8-rust-wasm-evaluation/2026-09-29-P23B.8-decision-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `9189cf41a164` |
| `docs/roadmap/p23b-geometry-performance/p23b.9-correctness-performance-gate/2026-09-22-P23B.9-correctness-performance-gate.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `7489dd836110` |
| `docs/roadmap/p23b-geometry-performance/p23b.9-correctness-performance-gate/2026-09-29-P23B.9-acceptance-and-closeout-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `60983b852231` |
| `docs/roadmap/p23b-geometry-performance/p23b.9-correctness-performance-gate/2026-09-29-P23B.9-gate-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `3af3cc02b5f1` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-D4-D5-D6-live-attribution-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `2cb23f692fc7` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-R1-corrections-and-attribution-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `9f534100cc33` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-S1-readiness-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `9ed143075e6b` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-S2-chrome-leg-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `f07496480c24` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-S3-electron-leg-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `6f17ba417a42` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-S4-m1-session-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `ecdb2610273f` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-release-to-presented-split-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `25f6e8d6aabb` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-R1-release-cost-ranking-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `c9692f1167e1` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-external-research-brief-room-drag-preview.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `01bb6c1bf715` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-optimization-directions-proposal.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `31e3c4b05ee6` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-pre-P23B.8-follow-up-acceptance-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `f0b469bc9b87` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-pre-P23B.8-follow-up-plan.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `adce4f174f8f` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-research-synthesis-review-and-plan.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `3ecdc3c2a34b` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-quick-sketch-design-sketch.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `991a4e017ade` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-reuse-trace-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `c88c0491aab9` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-room-move-transient-implementation-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `36f77007e0f8` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-post-release-window-attribution-and-room-label-fix-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `4b781fe667c5` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-drag-follow-ups-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `acfc6b9e9416` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-arm-before-after-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `fb58e6f5eab3` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `a3881ee9dd0d` |
| `docs/roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-record.md` | DELETE | — | §8.5 benchmark purpose fulfilled | `4d5a1b8839c4` |
| `docs/roadmap/p24-scene-staging/2026-09-08-P24-scene-staging-depth-umbrella.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `bdf8b2fbbbc2` |
| `docs/roadmap/p24-scene-staging/2026-09-08-P24A-asset-supply-canonical-ingest-annex.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `50c21883e90a` |
| `docs/roadmap/p24-scene-staging/2026-09-09-P24-reconciliation-sequence.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `bebf9f46d200` |
| `docs/roadmap/p24-scene-staging/README.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `f13d41f92eb8` |
| `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R3-shared-plan-3d-placement-contract.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `dcd073449a8e` |
| `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R4-cross-view-interaction-contract.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `46a40c73771c` |
| `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R5-R7-maturity-reconciliation.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `344cebb51279` |
| `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R8-presentation-reconciliation.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `536dfaf005cb` |
| `docs/roadmap/p24-scene-staging/reconciliation/2026-09-10-P24-R9-minimum-freeze.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `cc65ad1f4723` |
| `docs/roadmap/p24-scene-staging/research/Pascal-editor-harvest-brief.md` | DELETE | — | §8.4 | `0685c516d678` |
| `docs/roadmap/p24-scene-staging/research/Pascal-editor-harvest.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `d1a94d83530b` |
| `docs/roadmap/p24-scene-staging/research/deep-research-P24-3D-editing-compact.md` | ARCHIVE/MOVE | `docs/archive/technical/composition/` | §8.4 unique evidence | `04ed88a9a759` |
| `docs/roadmap/p24-scene-staging/research/deep-research-assets-compact.md` | ARCHIVE/MOVE | `docs/archive/technical/composition/` | §8.4 unique evidence | `a391e0df7246` |
| `docs/roadmap/p24-scene-staging/research/deep-research-exact-asset-compact.md` | ARCHIVE/MOVE | `docs/archive/technical/composition/` | §8.4 unique evidence | `d5ff9b9a9f68` |
| `docs/roadmap/p24-scene-staging/research/museum-editor-phase2-acquisition-manifest.json` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `bd7667d5fa60` |
| `docs/roadmap/p24-scene-staging/research/three-r175-r186-museum-harvest.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `0367c838786a` |
| `docs/roadmap/p24-scene-staging/slices/2026-09-10-P24-minimum-child-plans.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `44bbea67ee5d` |
| `docs/roadmap/p25-experience/2026-09-08-P25-experience-foundation-umbrella.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `723357f4dcd9` |
| `docs/roadmap/p25-experience/README.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `c59f6e477eee` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/README.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `d23beeacdbec` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/decisions-and-risks.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `dc242ddac3d4` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/design-system.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `8eea622d61be` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/implementation-evidence.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `add4c05c5041` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/implementation-plan.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `cc7c64509953` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/reconciliation.md` | MOVE | `prototypes/experience-ux-v3/design/` | §8.3 labeled inactive | `ce4a64c52434` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md` | MOVE | `prototypes/spatial-authoring/plans/experience-v2-prototype/` | §8.3 recovery anchors preserved | `be8ca33f608b` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md` | MOVE | `prototypes/spatial-authoring/plans/experience-v2-prototype/` | §8.3 recovery anchors preserved | `c4c1cec1247f` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md` | MOVE | `prototypes/spatial-authoring/plans/experience-v2-prototype/` | §8.3 recovery anchors preserved | `209857cb3594` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md` | MOVE | `prototypes/spatial-authoring/plans/unified-design-reconciliation/implementation-plan.md` | §8.3 | `963b8cfd4fd9` |
| `docs/roadmap/p25-experience/research/P25-research-compact.md` | ARCHIVE/MOVE | `docs/archive/technical/experience/` | §8.4 | `c0b413fe245b` |
| `docs/roadmap/p25-experience/research/deep-research-P25.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `a383af346c0f` |
| `docs/roadmap/p25-experience/research/deep-research-report-P25-full.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `9bcc5b26ee81` |
| `docs/roadmap/p25-experience/research/prompt-phase-5.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `5d087ac79c3f` |
| `docs/roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md` | CONSOLIDATE then ARCHIVE/MOVE | `docs/archive/technical/spatial/continuous-spatial-authoring-umbrella.md` | §8.4 D1–D8 + ceiling/periodic proofs | `0e690dba99f0` |
| `docs/roadmap/p26-spatial-depth/Final-Design-Prototype/README.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `6eb6c928cddb` |
| `docs/roadmap/p26-spatial-depth/README.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `7be215fd876b` |
| `docs/roadmap/p26-spatial-depth/design/briefs/2026-09-22-p26-designer-brief.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `e0f544196538` |
| `docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md` | MOVE | `prototypes/paper-authoring-commission/plans/inactive-adoption-plan.md` | §8.3 (inactive banner) | `1e6143ca5288` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/paper-surface-brief.md` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `3d2c2acbb765` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `e8e62e70aa1d` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/capture-transition.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `751000829d03` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/contrast-check.js` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `9a08ad629d54` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/contrast-table.md` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `f25ade173f9e` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/interaction-check.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `5cc28457f550` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/journey-check.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `adb240b5d1c1` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-flicker.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `07bd9453a2f9` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-roll.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `4f29ab67c339` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-sheet.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `78bbb44ed673` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-surface.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `55906eca0b23` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-transition.sh` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `b5983bb1b16b` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition.html` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `d3e81fe8152d` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-1100ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `b891ef03e9ff` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-1500ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `dc95d0c279e5` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-300ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `6abe3334f4b2` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-700ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `9a1c94b9443b` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-1100ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `ce6058b1d8a3` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-1500ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `d64b489567c1` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-300ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `fc036fbe1473` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-700ms.png` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `4ad7ce2f7530` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/specification-plan.md` | MOVE | `prototypes/spatial-authoring/design/visual-system-refinement/` | §8.3 protected prototype family | `841c65d4e041` |
| `docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md` | MOVE | `prototypes/spatial-authoring/plans/world-authoring-prototype.md` | §8.3 | `d4003928d92e` |
| `docs/roadmap/p26-spatial-depth/research/broad/deep-research-P26-phase-1-compact.md` | ARCHIVE/MOVE | `docs/archive/technical/spatial/` | §8.4 FreeCAD/Bonsai inspection | `66c3b3761277` |
| `docs/roadmap/p26-spatial-depth/research/broad/deep-research-P26-phase-1.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `6176e68024fb` |
| `docs/roadmap/p26-spatial-depth/research/harvests/P26-phase2-bonsai-view-identity-rcp-harvest.md` | ARCHIVE/MOVE | `docs/archive/technical/spatial/` | §8.4 FreeCAD/Bonsai inspection | `1542f684c8f5` |
| `docs/roadmap/p26-spatial-depth/research/harvests/P26-phase2-freecad-section-orthographic-harvest.md` | ARCHIVE/MOVE | `docs/archive/technical/spatial/` | §8.4 FreeCAD/Bonsai inspection | `e0e2e26ce13f` |
| `docs/roadmap/p26-spatial-depth/research/synthesis/p26-architectural-spatial-depth-synthesis.md` | DELETE | — | §8.4 all other P24/P25/P26 planning (after protected moves) | `5ac84eb8c542` |

## 5. Protected hashes (§8.3)

Protected prototype family hashes at the baseline. `sha256` is used so the WP4/WP6 "before and after" comparison does not depend on Git.

| File | Blob | sha256 |
| --- | --- | --- |
| `docs/archive/roadmap/p25-experience/p25-unified-design/p23b-browser-report.json` | `5c9156e1b873` | `b352f1fccd410791de63fa6e2fab893d747fd13fa7b1c8159a67b70f6b82fb73` |
| `docs/archive/roadmap/p25-experience/p25-unified-design/p23b-validation-result.json` | `d8f968059d9b` | `20f08870695c895930e8a6a104f64bfb8b6e843c8bbd7cd65242309187044245` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-captures.txt` | `78f6f18e43bf` | `6f3a02836e2abe610b6ceb933df2dd6fbd1a6c0fe2ae10612d3c4cae5ca66e77` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-diff-check.txt` | `8e1ea056108c` | `de1f71b2f84b641e443bac85ecb55aa30bd4328134f10fa6676d38033301475c` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-docs.txt` | `d887d8f405f1` | `43f99d218f14ec5d39debe2bd1aef306f4fb44e2df78f853d5aa848cbc7dee93` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-domain.txt` | `211bd8d1ac88` | `9a2cf2ff142aa6a8f4628669f1a2d7ee956d0e9ed205e646c307361975b7becb` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-donor-typecheck.txt` | `32158abbd10f` | `0b134f424985d9f2fea39c9b172aef8e14cac82f5b5c53bad8c696958e997667` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-donor.txt` | `1df97620e55c` | `b6ab17f5d2e4415b04b360b82a79c152b7cea057f612b504be0d7720579648bb` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-integrated.txt` | `3548ed2dd019` | `a312165f50c8735104e0144efa69221da8a26de4819ebe94e63fe5fea19ecfe0` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-mutations.txt` | `dd3af72d0e99` | `84e45b8822139babf02b09d16037d3b958a4fbd212bcbdab48eaa10bba69ca43` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-narrow.txt` | `2ee2787fadc6` | `7d93605b70de28483dd8305916a3979b562d2358dbbc3e037f51fe6f5deff25c` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-provenance.json` | `0cfc01fe266d` | `65a9de8c195ec853b67fb8beee6a1b5dd99eba9f2455d7391b5b3a2958d8b114` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-arch.txt` | `7f890d7678ad` | `edad6b15bf147232e025879f0a71ae2b2295aef282b32e7afbe8c9c7c8cc2f23` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-build.txt` | `bb3c87a620b5` | `4bb8330993701c0130b73d4676b0739f4e118c9336403025064b9682830cac7e` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-check.txt` | `e97732999a2d` | `a821f316765d442b08ddb61dfdfc4dfe2b19bff756edea246e33c60c1c9d6049` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-root-test.txt` | `2c786e07e843` | `ca47bf0e97326dea02e8a4154b651148cc50e2d2aa866d3283fbc374b2a4efa9` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/c8-world-calibration.txt` | `10b53e50b33d` | `2ec8bf89a3e58f2b902a853a68b4f78dbe582bc9c88a6f3635ed8c77ae5a3aeb` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/owned-session-cleanup.txt` | `1f42c58225d3` | `44d6726bf9527957c9eb85f85efce16b7218a1a9de99facf9d5db8da480655eb` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/paused-provenance.json` | `46b2208bf6a5` | `2b6dd17909a1b2a8c0ec93317f806f85acf61fee38a90ef6ba957c05be7b0d5f` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/pre-density-provenance.json` | `85baa79ce208` | `ec99b2d2eca218b8651766275e687e6257e8511dbf96772f043c0ef9e6782197` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-captures-final.txt` | `f242d2dbe943` | `e7d25c8edff4bce7576f025871fe85b4d34787a84a0b4ddd484fb56dc84aea0a` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-comparisons.py` | `c106340d2923` | `1e52f1bf090580f6d6e23be8268c21f77c27980943960924973b090d1ff1cda5` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-domain-final.txt` | `23cb7dba8c4f` | `25888fe1f87c72205c0e035a028bcc07532ee3db3c05764220689c79cf0068cd` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-donor-final.txt` | `6d880ee5eb0d` | `bb3714e6dce34829a9b83404030ef7c9ca72a3ffe099ace1f05bb5fd301c0cf4` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-integrated-final.txt` | `f47a6c0ca4a3` | `f76622f0bbfa0f5dd6c3e5ed80724412659ea4d104a4f8657b81cc94d179815f` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-mutations-final.txt` | `81aa8b0bef9e` | `67590e83b757cb49c21d1952c7831a9a8a5c68ebe8d2c042c6b6569fe8aff865` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-narrow-final.txt` | `e941f3cf66bd` | `a4e41cfc2b9230acdf53cb22bdd41dd19c094c789a9393d02a5b808302a7a8b9` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-arch-final.txt` | `d6c2f6456854` | `2f76bbe3a04d06f87057468b48477c19744efc24fc2e2e72d8b0084cb8354871` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-build-final.txt` | `ef0c643fe971` | `972ae759168dec960ea6ce6fa1eabe372f4e0926c9c100b74a9b6ba2ad500a4b` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-check-final.txt` | `9273e89da17f` | `a69a43f5c5df4e2cb8f3b66ed15032750644e0c84b84e12129a7e7710d1e7645` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-status-final.json` | `1360618230ea` | `802c0801bf7de80fa65b6080a814b3fbdbc255ee5fa13199a726ac06b664d986` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/v2-root-test-final.txt` | `61f601b0b902` | `8fcb87d129b92f3e2685f26fc6defe993558444f4add6967ccd4b2f865ff010b` |
| `docs/operations/checkpoints/experience-v2-conformance-evidence/worktree-status.txt` | `f8144b3f37f3` | `5e385c76b5990cb7f4ab30f578a5743fee3a8cf4ae53fd4b43ce3936570c9413` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/README.md` | `d23beeacdbec` | `3f1af94c57d084e89bc4ae49d7ee7df6329523653acb08d62dafc88694e12a76` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/decisions-and-risks.md` | `dc242ddac3d4` | `ff8b38b1f65a9680aeb22f1ef7371c2a714db10ef865ebcc61f3007a429a4de4` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/design-system.md` | `8eea622d61be` | `2adc289000b841faf8e4cc0bbfee8c5db16d4c4b3869610381f1faa3aa82c196` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/implementation-evidence.md` | `add4c05c5041` | `4ab627d84ee4f91cca9831b674c533092d75ca20bfe8e6c98e3703822f95532f` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/implementation-plan.md` | `cc7c64509953` | `935665f8a8454e540c72fe17f59c7f450d169e72a3fc5365c0bedc8d5d124053` |
| `docs/roadmap/p25-experience/design/experience-ux-v3/reconciliation.md` | `ce4a64c52434` | `1b96ed1761ba81b64c40f1b7ab33c189ca5a126bae13df4ea0b1b6dd3552a57f` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/authoring-completeness-plan.md` | `be8ca33f608b` | `a78c641b604105e8eb2ea6cd3fc3f25a28e6bd769477b546e4490769525f6cd7` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/conformance-plan.md` | `c4c1cec1247f` | `d79a44ea69d8bbd001d479c157c5c2fab31640f3c3f0063716109c0a397dd2a7` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md` | `209857cb3594` | `e0d2a274817a2e1de328ceec200d88c401b728befe084c18dbc8f790913eac83` |
| `docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md` | `963b8cfd4fd9` | `9eb676f2d137d002d5c021262ba0fab94ab8b3602ecfe6907e19c05195a45877` |
| `docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md` | `1e6143ca5288` | `42cc1921ad4fd4b7fbfe93c55e8186271dc6abac79def791d096991780be4b89` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/paper-surface-brief.md` | `3d2c2acbb765` | `cbe080c299fc239690cd8697be8485780a433f6b40ec916c58d8b5f5613d7f81` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md` | `e8e62e70aa1d` | `a1202b884a20034c6f8dfa68f66093cdff42baab7e73fa58633c0ca38ebe905e` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/capture-transition.sh` | `751000829d03` | `38039ba2ac24f80bbfb221438955f66cf901b707e1630e06f302ddce9e87dff0` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/contrast-check.js` | `9a08ad629d54` | `ce3ffaa87b09280bf1a4fc4f5b09399125a43bc4a44ef7cb711a24f139d216f1` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/contrast-table.md` | `f25ade173f9e` | `2cf76c81d56e678d3323b0886ecc20e9f0d37d0e00004e790a4605d567d5d381` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/interaction-check.sh` | `5cc28457f550` | `818ea80718f99d7c63ce03a09fb1a083405bd571b54238fc821e0a98c0de12b8` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/journey-check.sh` | `adb240b5d1c1` | `1661464675c1d2a26553ca8db1b806909ea4eef997062bdd9a0daf4e9f75869c` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-flicker.sh` | `07bd9453a2f9` | `95eb9fed95cf3c48b61148bbcfa843b6584340e9b2efc262bc03d769c37047e9` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-roll.sh` | `4f29ab67c339` | `7813a4da783b2aed03df1c9ff768f44ae745135e8f7195e77db858b29cbc82dc` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-sheet.sh` | `78bbb44ed673` | `babfe15cf84eae7968585099872e086b0e6a3380486d2292d69b91cac5e9c4fe` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-surface.sh` | `55906eca0b23` | `aa1edcc3569e139053f3c0e580b8579c8303ef853e9f1e1a07e30e906b41daba` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/probe-transition.sh` | `b5983bb1b16b` | `d4addc00648f1487b2ee507daf619502e3a578560dc0d5e3171c97fb253f55bd` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition.html` | `d3e81fe8152d` | `012949c3b062498c07891bf7dc1ba3caae00bdcabc40e6f75cb2de1a58e29868` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-1100ms.png` | `b891ef03e9ff` | `88d735fc6b648c998eb1626b50702827941862a03ef747ee452d819d2fe67fec` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-1500ms.png` | `dc95d0c279e5` | `a23a3f9e58481f17678bbe9d248f7c9f817e0e36a6fdb2ab5c6dc6118a8bccf5` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-300ms.png` | `6abe3334f4b2` | `50bf6d6c5917a2b8d1a75e6e10f38c3ee878c36273c9fc2ca40b085c524d15b8` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/after/pan-700ms.png` | `9a1c94b9443b` | `a9e3c60555aa82e3d4759ca68ce0c7e77c07348480339d4365968011ad8b348f` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-1100ms.png` | `ce6058b1d8a3` | `5754832c4377f1c8da6a1e75993f344a14af150a857c8189438489e41a429548` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-1500ms.png` | `d64b489567c1` | `f097784da5d6109947b3dc4b09005250811db0b44c33e7f6d1a1467a81b0b255` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-300ms.png` | `fc036fbe1473` | `3f8baf8e46a2e516de868c5ee512b82ceed03fb94b21cafd9978cf885d383113` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/qa/transition/before/pan-700ms.png` | `4ad7ce2f7530` | `e82abfb317de14d882f09137d2321cca4a43de7fb4fd0032db964d68153f513c` |
| `docs/roadmap/p26-spatial-depth/design/visual-system-refinement/specification-plan.md` | `841c65d4e041` | `4bbb25da48ab4674f8591488de6c533bd9a7882a5718be59cfb29f3298bd21b3` |
| `docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md` | `d4003928d92e` | `209251e2256d059a85253d14948c0c5bb94631c49524c1a1930b172c9bb276d3` |

EVIDENCE-PATHS: end

## 6. WP1 — standalone frozen project (Checkpoint A)

> **Status of this section.** WP1 produced the frozen project inside this repository and
> verified it at Checkpoint A. The owner then **moved the folder out of the repository**
> (commit `26ecb97b`, see §6.4). Everything in §6.1–§6.3 is the record of that completed,
> owner-verified work. It is a **historical record, not a live path**: no `legacy/` folder
> exists in the tree now, and the commands in §6.2 cannot be re-run from this repository.
> Section §6.5 states the recovery evidence and the verification limitation that WP2 and
> every later work package must carry.

### 6.1 What was produced

The frozen project was `legacy/chopin-museum/` — one self-contained folder outside the root
workspaces (`apps/*`, `packages/*`), deletable with `rm -rf legacy/chopin-museum`. It was
committed at `66d23520` with **385** tracked files and has since been externalized (§6.4).

| Component | Files | Source |
| --- | ---: | --- |
| `src/**` app modules | 277 | byte copies of the frozen import closure (275) plus two test-support `$lib` modules the relocated category B tests import |
| `src/app.html`, `src/vite-env.d.ts` | 2 | byte copies |
| `kernel/{layout-core,project-model,camera-core}/src/**` | 69 | byte copies of the kernel snapshot |
| `static/museum/**`, `static/textures/**` | 14 | byte copies of the editor static assets |
| `vite/museum-editor-entry-plugin.ts` | 1 | byte copy (keeps the relic route byte-identical) |
| `tests/**` | 13 | 9 relocated category B tests + their helper closure + `tests/freeze.test.ts` |
| own configs | 5 | `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts` (+ `.gitignore`, `README.md`) |

- `kit.alias` maps the three `@portfolio/*` kernel specifiers onto the in-folder snapshot,
  so every frozen **source** file is byte-identical to the baseline.
- `legacy/chopin-museum/FREEZE.json` (recoverable at `66d23520`) recorded the baseline SHA,
  **375** per-file `{baselinePath, frozenPath, sha256}` rows, and **10** new/adapted files with
  reasons (manifest, configs, `.gitignore`, README, freeze test, lockfile).
- The category B tests are relocated with their relative layout preserved
  (`tests/lib/**`), so their `$lib`/`@portfolio`/`../../../../vite` import roots resolve
  unchanged.
- **Scope note:** the §7.2 B row also names `museum/visitor-import-boundary` (museum-shell
  direction). That test checks `apps/museum` and the *editor's* `$lib/museum` shell against
  editor internals; the frozen project has neither, so only its editor-direction half stays
  in the product. The frozen project's own guarantees are covered by `relic-smoke`,
  `paris-activation`, the Chopin content tests and the freeze test.

### 6.2 Checkpoint A verification

All commands ran inside `legacy/chopin-museum/` **while the folder was in this repository**
(at `66d23520`). They passed then; they are not re-run by any later work package.

| Command | Result |
| --- | --- |
| `npm ci` | pass — 187 packages from the pinned lockfile |
| `npm test` | pass — 10 files, 60 tests (`pretest` runs `svelte-kit sync`) |
| `npm run check` | pass — `svelte-check` 0 errors, 0 warnings |
| `npm run build` | pass — adapter-vercel build, museum + editor server entries emitted |

**Browser check** against the project's own `vite preview` (`http://127.0.0.1:4321`):

- `/museum` renders the Chopin museum — HUD, tour list and 3D scene — and guided
  navigation advances (Entrance → Departure via `ArrowRight`);
- `/museum/editor` mounts the relic Scene · Camera editor: Scene/Camera tabs (no Layout
  workspace, which it refuses), the transform toolbar, the Camera timeline with its tour
  selector and transport, and the read-only Rooms list;
- no console errors on either route.

**Baseline equivalence** rests on byte-identity — `tests/freeze.test.ts` re-hashes every
file in `FREEZE.json` and passes — plus the relocated `relic-smoke` (16 tests) and
`paris-activation` (6 tests) guarantees, rather than on a second live baseline run.
Interactive placement arm/cancel and mini-player path preview were **not** exercised by
hand; they are covered by the relocated `relic-smoke` assertions.

### 6.3 Product isolation

- [`apps/editor/tests/lib/legacy-isolation.test.ts`](../../../apps/editor/tests/lib/legacy-isolation.test.ts)
  (added to `ARCH_FILES`) asserts no product file under `apps/` or `packages/` imports,
  aliases or quotes a path into `legacy/`, and that the root workspace globs exclude it.
  It never reads the folder, so it passes unchanged once the folder is deleted.
- The product is otherwise untouched: the only product changes in this checkpoint are the
  isolation test and its `test-lanes.ts` entry.
- **Rollback:** delete the folder — which is exactly what the owner later executed (§6.4).

### 6.4 Externalization (owner decision, executed)

The owner verified Checkpoint A and then removed the frozen project from this repository,
keeping it as an externally hosted, separately versioned project. The plan records this as
§3.7.

| Step | Commit | State |
| --- | --- | --- |
| WP0 baseline record and manifests | `4a98760b` | product unchanged |
| WP1 frozen project created and verified (Checkpoint A) | `66d23520` | `legacy/chopin-museum/` present, 385 tracked files |
| Owner externalizes the frozen project | `26ecb97b` | folder absent; **no product file changed** |

- The removal is a pure deletion of the folder. It touched no product source, script, lane,
alias, workspace glob or lockfile entry, because the folder was never one — this is the
independence the frozen project was built for (§3.3, §3.4).
- **No reintroduction.** Nothing in #115 recreates `legacy/`, restores frozen files, or adds
  any product dependency on the external project. `apps/museum` stays retired per §5.1; the
  externalization does not revive it.
- **Category B tests.** The seven `RELOCATE` rows (plus the split `visitor-import-boundary`)
  were moved into the folder's own `tests/` at WP1 and left with it. Their product-side
  originals are deleted in WP2 like any other subject whose home is the frozen project; they
  are not relocated a second time and no in-repo successor is fabricated. This is the state
  §7.2 records.

### 6.5 Preservation evidence and verification limitation

**Recovery (preservation is not dropped).**

- Any frozen file, byte-exactly: `git show 66d23520:legacy/chopin-museum/<path>`.
- The pre-WP1 original of any product file: `git show e90a58224443bdbf44114d7285d55c983b79cc84:<path>`.
- `FREEZE.json`: `git show 66d23520:legacy/chopin-museum/FREEZE.json` — 375 plain-sha256 rows
  tying each frozen file to its baseline path and hash.
- The frozen contract (routes, behaviour, no-forced-modernization rule, deployment guidance)
  is recorded in §6.1–§6.3 and in the external project's own README at `66d23520`.

**Limitation, stated plainly.** The §6.2 commands (`npm ci`, `npm test`, `npm run check`,
`npm run build`), the §6.2 browser check, and the frozen-project acceptance steps in the
plan's §7.4 **cannot be executed from this repository** after `26ecb97b`. They are recorded
as **owner-verified WP1 evidence**, not as a check WP2 or any later work package ran. No
work package after this one may claim a frozen-project test passed.

**What remains executable, and required.** The repository-side property the freeze existed to
buy: no product file imports, aliases or references `legacy/`, and the arch gate that asserts
it (`tests/lib/legacy-isolation.test.ts`) stays green. That is enforced for every later
checkpoint.

## 7. WP2 — new-product prune (Checkpoint B)

> **Status.** Executed on the `codex/pr115-architecture-plan` branch against the
> externalized frozen project (§6.4). Every §7.4 product gate below was run on a tree that
> does not contain `legacy/`, which is the §3.4-rule-4 deletion proof in its stronger,
> permanent form.

### 7.1 Change set

| Measure | Count |
| --- | ---: |
| Files deleted | **700** |
| Files renamed/relocated (with the rename tracked) | **28** |
| Files modified in place | **87** |
| Test files deleted | **268** |
| Test files remaining and passing | **106** |
| Tests remaining and passing | **1516** |
| `package-lock.json` | **111 deletions, 0 additions** (removal-only, §5.2) |

Deletions by area (largest first):

| Area | Deleted |
| --- | ---: |
| `apps/editor/tests/lib/**` (categories C/D) | 280 |
| `apps/museum/**` (retired, §3.5) | 78 |
| `apps/editor/src/lib/editor/layout/**` | 52 |
| `apps/editor/src/lib/layout/**` (31 facades + presentation) | 33 |
| `apps/editor/src/lib/editor/{camera,store,app,gizmo,context-menu,hierarchy,camera-plan,helpers,hooks,fields}` | 113 |
| `apps/editor/src/lib/museum/**` (Chopin-specific) | 23 |
| `apps/editor/src/lib/bench/**` | 17 |
| `apps/editor/src/lib/content/**` (Chopin project + codec facades) | 10 |
| `apps/editor/src/lib/editor/styles/**` (tokens, CSS) | 7 |
| `apps/editor/src/routes/**` (`museum/**`, `dev/perf*`, `preview`, `publish`) | 12 |
| `packages/{scroll-travel,note-cursor,portfolio-hud,portfolio-content,audio-plink}` | 17 |
| The editor's `museum-editor-entry-plugin.ts` and `vitest.perf.config.ts` | 2 |

### 7.2 Retained foundation (the §4.1 tree, verified)

- `src/lib/{content,museum,render,layout,types,project,visitor,platform,authoring}` plus
  `vite/{preview-surface-boundary-plugin,preview-surface-dynamic-scan,public-surface-boundary-plugin}`.
- `src/lib/layout/` is exactly `wall-mesh-builder.ts` (the facades are gone); the generic
  renderer, `texture-cache`, `wall-geometry-adapter` and the visitor runtime are intact.
- `src/lib/authoring/` holds exactly the §4.3 modules: `camera/` (9), `scene/` (6),
  `layout/` (4), `a11y/roving-focus.ts`.
- Routes are `/`, `/projects`, `/editor`, `/project/:id/spatial` (foundation-reset notice),
  `/p/:publicationId` and `dev/{assets,materials}`.
- `packages/`: `layout-core`, `project-model`, `camera-core`, `tsconfig` only.
- `apps/api` unchanged.

**`dev/{assets,materials}` retained.** §4.1 makes retention conditional on the WP2 closure
being a subset of the foundation. Both routes import only retained modules
(`$lib/content/{assets,materials}`, `$lib/museum/{assets/AssetModel,materials/MaterialPreviewItem}`,
`$lib/types/*`), and the `/dev/perf*` routes — whose closure was the removed bench tree — are
deleted. No rework was performed.

### 7.3 §7.4 gates — all green

| Gate | Command | Result |
| --- | --- | --- |
| Architecture lane | `npm run test:arch` | **pass** — 13 files, 101 tests |
| Full suite | `npm test` | **pass** — 106 files, 1516 tests, 0 skipped |
| Type check | `npm run check` | **pass** — 0 errors, 0 warnings |
| Build | `npm run build` | **pass** — adapter-vercel |
| Kernel packages | `npm run check:layout-core && check:project-model && check:camera-core` | **pass** — 0 errors each |
| API check | `npm run check:api` | **pass** — 0 errors |
| API tests | `npm run test:api` | **pass** — 10/10 and 6/6, **0 skipped**, DB-backed cases ran against a reachable Postgres |
| Whitespace | `git show --check a90c3be2` and `git diff --check 26ecb97b HEAD` | **pass** — no whitespace errors reported (§7.8) |

The §7.5 zero-skip requirement is satisfied for WP3 in this environment: `publication.test.mjs`
and `test-auth.test.mjs` ran their real-Postgres cases rather than skipping. WP3 must re-record
this at Checkpoint C; it is not inherited.

### 7.4 Test disposition — deletions match removed subjects

- **Category A/A′/A″ kept.** Kernel suites call `@portfolio/layout-core` directly. The three
  A″ fixture generators moved byte-identically (`R100`) from `lib/bench/` to
  `tests/lib/layout/__fixtures__/`: `p23b-fixtures.ts`, `p2311-bend-fixtures.ts`,
  `p23b11-connected-case.ts`. Their measurement, observation-count, budget and ratchet
  assertions were deleted with the harness (`p23b-room-unit-proposal-cost` and
  `p23b-fixtures-contract` keep only their structural/correctness premises).
- **Category D extractions landed.** The entangled layout suites and `project-format-*` keep
  their kernel assertions with identical expectations and drop the editor-wiring half. A bug
  introduced while re-pointing fixture imports (a literal `$1` placeholder) was found and
  repaired across every affected file.
- **Category C deletions.** 268 test files removed with their subjects, plus these cases inside
  surviving files, each because its only subject is deleted:
  - `layout-render-safe-validation`: the `apps/museum` byte-identity case and the museum source
    walk (the fork is retired);
  - `layout-curve-regressions`: the `EditorInspector.svelte` "Add Bend Point" source pin
    (its kernel half is asserted by the case that follows it);
  - `layout-openings`: the `buildPlanRenderModel` "renders one Opening primitive" case;
  - `layout-presets`: the render-model equality half of the compile-equality case;
  - `layout-wall-selection`: the highlight/hover/LOD *rendering* describes.
- **Whole files deleted for the same reason** (their only subject was a deleted module):
  `p23b-measurement-marks-wiring`, `p23b5-gesture-scope-wiring` (both source contracts on the
  removed `LayoutPlanViewport.svelte`), `tests/helpers/plan-render-harness.ts`.
- **No skip, no `todo`, no expected-failure marker was added anywhere.**

### 7.5 Deliberate deviations, with reasons

1. **`plan-control-grammar.ts` (§5.1 REMOVE) — its one retained type moved.** The retained
   resolver `authoring/layout/plan-hit.ts` takes a `PlanControlAuthority` in its public
   signature, so deleting the module outright would have broken a §4.3 module. The type moved
   into `plan-hit.ts` and the presentation half (mark shapes, acquisition radii, tiers) was
   deleted with it. No new semantics were designed.
2. **Archived records are exempt from link resolution until WP4 relocates them.** #115 removes
   the files that closed P23/P23B/P24/P26 phase records describe, so ~110 written paths in
   those records stopped resolving. Rewriting them would falsify the record, which is the rule
   `NON_DOCUMENTATION_PREFIXES` already applies to `docs/archive/`. `ARCHIVAL_RECORD_PREFIXES`
   in `tests/helpers/docs-references.ts` applies that same rule to the trees §8.4/§8.5 deletes
   or moves under `docs/archive/`; **WP4 removes the entries as it performs those moves**, so
   no new exclusion survives #115. The alternative — editing ~38 historical records now —
   would also break §8.3's before/after hash discipline.
3. **The arbitrary `> 100 Markdown files` walk assertion was replaced by semantic
   non-vacuity**, exactly as §7.3/§10.3 prescribe. The walk must now reach the router, AGENTS,
   both design contracts, the operations root, `tests/README`, a protected-prototype specimen
   and local skills, and an empty-walk mutation must fail. WP5 adds the track roadmaps and
   the operations root README to the required set when it creates them.
   §7.3's ARCH addition for `tests/docs/parallel-track-gates.test.ts` is likewise WP5's: WP5
   creates that file, so WP2 leaves it out of `ARCH_FILES` rather than leaving a dangling
   entry. The arch lane's 13 entries all resolve today.
4. **Dead references were repaired in the documents that retain their subject**:
   `docs/README.md`, `docs/reference/components/{assets,scene-codec}.md`,
   `docs/operations/tech-debt/README.md`, `tests/README.md` and this plan; the decision
   record's dead link became labeled `git show <baseline>:<path>` provenance per §8.2; the
   protected prototypes' dead paths were declared with `EVIDENCE-PATHS` regions per §8.3.
5. **Boundary suites were re-pointed rather than gutted where the invariant survives**:
   `wall-mesh-shell-boundary` now pins `VisitorLayoutShell.svelte` (the Chopin shell's
   `LayoutWallFailure`/`LayoutPhysicalWall` tokens became this file's
   `VisitorWallFailure:`/`VisitorPhysicalWall:` names); `camera-core-boundary` pins the
   product visitor/raster layer instead of the retired `apps/museum` fork and drops the
   editor-navigation-graph half with its subject; `project-model-boundary` asserts the
   facades' removal instead of their re-export shape; `layout-geometry-boundary` drops the
   editor/Chopin consumer rows and keeps the compiler, uniqueness and `$lib/layout` sweeps.
6. **Heavy lane environment removed with P23B.6.** `test:heavy` no longer sets
   `--expose-gc P23B6_REQUIRE_GC=1`; the forced-GC H-6 cases left with the bench tree.
7. **`tests/lib/editor/layout/p23b7-svelte-internal-client.d.ts` relocated** to
   `tests/lib/layout/svelte-internal-client.d.ts` rather than deleted: its consumer
   `p23b8-d5-identity-falsifier.test.ts` survives, and deleting it broke `npm run check`.

### 7.6 Frozen-project preservation

- `legacy/` is absent from the tree; nothing in #115 recreated, restored or referenced it
  (§6.4, §6.5). Every §7.4 gate above ran against a tree without it.
- The recovery path is unchanged and verified: `git show 66d23520:legacy/chopin-museum/<path>`,
  the `FREEZE.json` rows, and the baseline `e90a58224443bdbf44114d7285d55c983b79cc84`.
- **No frozen-project test was run or claimed.** Checkpoint A remains owner-verified WP1
  evidence with its stated limitation. The only frozen-project property exercised here is the
  standing repository-side one: `tests/lib/legacy-isolation.test.ts` is green (2 tests) in the
  arch lane.

### 7.7 Intentional loss (recorded, never a failing test)

Unchanged from §4.4. After WP2 the new product cannot author, edit, view in Plan or 3D, place,
light, apply materials, direct Camera, preview, publish, import or export a project, or run
benchmarks. The landed editor shell, its token/theme layer, the Plan presentation model and
the bench/PERF infrastructure are removed rather than dormant; they remain recoverable at the
baseline SHA. TD-1 and TD-2 close as *implementation removed*, TD-4/TD-5 retire with the
benchmark — never "fixed".

### 7.8 WP2 review close-out

Independent review accepted WP2 with three bounded evidence corrections, applied here without
re-running the pruning.

**A2 — the whitespace evidence is now the committed diff, not the worktree.** §7.3 originally
cited `git diff HEAD --check`, which on a clean worktree compares nothing and is therefore
vacuous. The correction, with the genuine results:

| Command | Scope | Result |
| --- | --- | --- |
| `git show --check a90c3be2` | the whole WP2 commit diff | **clean** — exit 0, no whitespace errors |
| `git show --check d9d0b474` | the evidence follow-up | **clean** — exit 0 |
| `git diff --check 26ecb97b HEAD` | base-to-head, the full #115 change set | **clean** — exit 0 |

**Non-vacuity of the checker, measured.** A scratch repository (outside this project, removed
after the probe) was committed clean and then with `b  ` on line 2: `git show --check` reported
`f.txt:2: trailing whitespace.` and exited 2. The mechanism detects this class in a commit
diff, so the clean results above are meaningful. The four trailing-blank-line errors the
worktree check *did* report during WP2 (`scene.test.ts`, `layout-duplicate.test.ts`,
`layout-openings.test.ts`, `layout-wall-delete.test.ts`) were repaired before `a90c3be2` and
are not in the committed diff.

**A1 — the temporary documentation exclusions were re-verified and narrowed.**

- Each `ARCHIVAL_RECORD_PREFIXES` entry was checked against the plan's own disposition:
  `docs/roadmap/{p23-layout-depth,p23b-geometry-performance,p24-scene-staging}`,
  `docs/roadmap/architecture-operating-cycle/`, `docs/roadmap/f-foundation-contracts/design/proposals/`,
  the four superseded syntheses and the three removed reference contracts are all §8.2/§8.4/§8.5
  DELETE or ARCHIVE-to-`docs/archive/` rows.
- **One over-broad entry was found and removed.** `docs/roadmap/p26-spatial-depth/` was listed
  as a whole folder, but §8.3 moves its `design/**` files into `prototypes/…`, which stays inside
  the walk — the blanket prefix silently exempted material that re-enters coverage as protected
  evidence. It is replaced by the two archive/deleted parts only
  (`…/research/` and the continuous-spatial-authoring umbrella). Re-running the gate after the
  narrowing passed, so no P26 `design/**` path had a dead reference and coverage is strictly
  wider.
- **Nothing authoritative or protected is excluded.** `docs/README.md`, `AGENTS.md`, the
  reference contracts, `operations/**`, `.agents/**` and the whole `prototypes/` family remain
  inside the walk, as do the immutable decision records (whose dead link was repaired with
  `git show <baseline>:<path>` provenance rather than exempted).
- **A focused control now enforces that** — `archivalExclusionProblems()` fails the gate if any
  archival prefix covers a document the walk is required to reach, or names a path that no
  longer exists. Two tests in `documentation-references.test.ts` use it (24 tests, green).
- **WP4's acceptance requirement is now explicit in the plan** (§8.1 and the §12 WP4 row): WP4
  removes the temporary list and its checker branch as it performs the §8.3–§8.5 moves, then
  runs the full gate with no new exclusions and confirms no coverage gap. The control above is
  what fails until that list is gone.

**A3 — WP3 ownership of the retained legacy room-frame path is confirmed, not actioned.**
`lib/authoring/scene/plan-scene-footprint.ts` still carries the legacy room gate: the
`roomId?` field, the `LayoutRoomRegistry` parameter, the `rooms.has(entity.roomId)` eligibility
check and the `rooms.pointInFrame(entity.roomId, …)` projection. §6 already assigns its removal
to WP3; the amendment in §6 makes that ownership explicit and adds it to the B2 seam row. It was
not touched here.

### 7.9 WP3 readiness

**Ready.** Checkpoint B is met: the §7.4 gates are green, visitor/public and `legacy/`
isolation are green, every deleted test is category C with its subject gone or has a recorded
extraction, every category B file is recorded as relocated-at-WP1 (§6.4), and the external
frozen project was neither modified nor reintroduced. §7.5's DB requirement is satisfiable in
this environment (zero skips observed), which is WP3's precondition rather than its result.
WP3 may be authorized; it has not been started.

## 8. WP3 planning amendment — current format only (revision 4)

> **Status.** Planning only. No WP3 work package has been started, and nothing in §6 of the
> plan has been executed. This section records the owner's compatibility policy, what it
> changed in the plan, and the fixture trace the WP3 executor inherits so it does not have to
> rediscover the sites.

### 8.1 Owner policy

The product supports **one document format**:

- wall-first Layout, `formatVersion: 5`;
- world-local Scene, `formatVersion: 1`;
- existing current-format validation, canonicalization and deterministic serialization unchanged.

There is deliberately **no legacy recognition contract**: no `unsupported_generation`
diagnostic, no `isLegacyLayout` detector, no unsupported-generation classifier and no
compatibility facade. A detector that recognises historical formats only in order to reject
them by name is scope the owner has removed. Anything that does not match the current format
fails **ordinary current-format validation**, and no schema rule is relaxed to make that
possible.

### 8.2 Requirements removed from the plan

| Removed | Was in |
| --- | --- |
| The named `unsupported_generation` rejection as the reader contract | §6 item 1, §4.2 API row |
| The DB-free `api.test.mjs` case asserting a legacy body is rejected on Save by name | §6 item 3 |
| The matching `project-model` kernel assertion for that code | §6 item 3 |
| The §7.5 bullet requiring that DB-free legacy-rejection case to run in every environment | §7.5 |
| The Checkpoint C clause "legacy payloads reject with the named issue (new kernel and API tests)" | §12 WP3 row |
| Any successor dedicated historical-format rejection test | §6 item 5 (explicitly forbidden) |

### 8.3 Requirements added or made explicit

- **Readers and writers call the current-format validators directly.** Obsolete generation
  dispatch, migration and compatibility branches are deleted; nothing replaces them.
- **Scene runtime seam (§6 item 2).** Room-local Scene resolution and its Room-frame
  dependencies leave the retained runtime and authoring modules. `authoring/scene/plan-scene-footprint.ts`
  is the named case: `PlanSceneFootprint.roomId?`, the `LayoutRoomRegistry` parameter,
  `rooms.has(entity.roomId)` and `rooms.pointInFrame(entity.roomId, …)` are removed. Intended
  world/local semantics, support-owned elevation and the single Geometry/Camera authorities are
  preserved; new Scene or Camera schema design belongs to T2/T3.
- **Evidence replaces the removed tests (§6 item 5):** valid current-format Layout and Scene
  validation; canonical serialization and round-trip stability; ordinary validation failure for
  malformed or incomplete input; API Save/Load/publication exercised with valid current-format
  documents; preserved geometry, identity, resource and visitor-isolation invariants.
- **Fixture rule.** Validation is never relaxed to keep an obsolete fixture passing. A fixture
  whose expectation genuinely depended on the legacy shape is a recorded finding.
- **Stop rule retained.** The deep `layout-types.ts`/`layout-codec.ts` split stays T1's
  authored-schema redesign; WP3 does not rewrite the canonical compiler to reach it.
- **§7.5 PostgreSQL gate retained** (B4): reachable database, `check:api` and `test:api`
  passing, zero skips, real Save/Load/publication coverage, recorded at Checkpoint C and never
  inherited from WP2.

### 8.4 The API fixtures WP3 must migrate

Each API test file builds a local `projectDocument()` whose `layout` is the versionless legacy
shape (`{ units, floors, objects }`, no `formatVersion`) and whose Scene carries no
`formatVersion`. All three are inside the tests that §7.5 requires to run DB-backed.

| File | Fixture | Call sites |
| --- | --- | --- |
| `apps/api/tests/api.test.mjs` | `function projectDocument(name = 'Cloud project')` (line 27) | 8 |
| `apps/api/tests/publication.test.mjs` | `function projectDocument(id, name, textures = [])` (line 41) | 19 |
| `apps/api/tests/test-auth.test.mjs` | `function projectDocument(id, name)` (line 29) | 2 |

WP3 replaces each fixture with a valid current-format document **while preserving the original
behavioural expectation of every call site**. The ownership, isolation, asset and publication
assertions those tests carry are unchanged: only the document shape they persist changes.

### 8.5 Checkpoint C contract (revised)

The §7.4 gates are green **including the §7.5 API requirement**, with the DB-backed run's skip
count and database target recorded here at Checkpoint C. §6's evidence list exists. No
`unsupported_generation` path and no legacy detection exists anywhere. Geometry, identity,
resource and visitor-isolation invariants are unchanged. Stop-rule items are recorded as §5.1
rows.

### 8.6 Remaining owner decisions

**None.** The compatibility policy is settled, and no question raised by this amendment needs an
owner ruling. Two items are deliberately deferred rather than decided here: the Layout
schema/codec split (T1) and Scene/Camera unit extraction (T2/T3).

## 9. WP3 execution — Checkpoint C evidence

> **Status.** WP3 executed on `codex/pr115-architecture-plan` from Checkpoint B (`a90c3be2`)
> against the revision-4 current-format-only plan (`c63887ca`), and was then independently
> reviewed (findings F1–F5, §9.6). The review corrections are applied on top of WP3. Checkpoint C
> is **acceptance-ready, pending independent acceptance**. WP3R, WP4 and closeout have not begun,
> and nothing below claims them. No `unsupported_generation` path, legacy detector, classifier,
> compatibility facade or dedicated historical-format rejection test was added.

**Change set (commit `d0d0ce8a`):** 45 files — 44 tracked modifications/deletions
(`+648 / −3,811`) plus the new `packages/project-model/src/runtime.ts` (`+156`). The commit totals
are `+804 / −3,811` (36 modified, 8 deleted, 1 added). §9.6 F4 records the correction to the
earlier "44 files / +512" line, which double-counted the new file and used the wrong modified-line
subtotal.

### 9.1 Production change

| §6 item | Change |
| --- | --- |
| 1 — current-format readers and writers | `validateProject`, `parseProjectJson`, `createProject`, `serializeProject` and `prepareRuntime` call `validateWallFirstLayoutDocument` + `validateSceneDocument` directly. There is no generation dispatch, migration branch, decode report or compatibility fallback, and no project-level version rule separate from the nested validators. `ProjectDocument` now names the wall-first Layout type, so boot/read values cross the codec boundary without a cast. |
| 2 — Scene runtime seam (B2) | `resolveSceneDocument(input, options)` lost its Room-registry parameter; `authoring/scene/plan-scene-footprint.ts` lost `PlanSceneFootprint.roomId`, the `LayoutRoomRegistry` parameter, the `rooms.has()` eligibility check and the `rooms.pointInFrame()` projection. `prepareRuntime` reads the Scene with no Room consultation and hands consumers the empty current-format registry. |
| 3 — layout-core | `layout-compat`, `layout-migration`, `layout-migration-math` deleted with their `index.ts` exports. |
| 4 — callers | Visitor cold runtime, editor platform persistence, the editor project codec wrapper, `content/scene.ts` and the API Save/Load/publication paths updated. |
| 5 — tests and fixtures | §9.3 (API fixtures) and §9.4 (successor dispositions). |
| 6 — stop rule | §9.5. |

EVIDENCE-PATHS: start — the files this work package deleted, and the removed names it verified absent, as written at the WP3 start revision `a90c3be2`; evidence of that revision, not routes to follow

**Deleted production modules (8 files, 2,508 lines):**

| File | Lines |
| --- | --- |
| `packages/layout-core/src/layout-migration.ts` | 1,181 |
| `packages/project-model/src/project-compat.ts` | 340 |
| `packages/project-model/src/standalone-scene-import.ts` | 219 |
| `packages/layout-core/src/layout-compat.ts` | 186 |
| `packages/layout-core/src/layout-migration-math.ts` | 178 |
| `packages/project-model/src/scene-world-conversion.ts` | 152 |
| `packages/project-model/src/compat-runtime.ts` | 149 |
| `packages/project-model/src/scene-format.ts` | 103 |

**Added:** `packages/project-model/src/runtime.ts` — the one current-format runtime
preparation (`prepareRuntime`), replacing `prepareCompatibleRuntime`.

**Verified absence (grep at Checkpoint C, excluding the audit log):** the post-WP3 worktree has
no occurrence of `decodeProjectCompatible`, `prepareCompatibleRuntime`,
`createLayoutRoomRegistry`, `createEmptyProject`, `SceneRoomResolver`,
`decodeLayoutJsonCompatible`, `decodeLayoutValueCompatible`,
`convertSceneDocumentToWorldLocal`, `identifySceneFormat`, `scene_not_world_local` or
`unsupported_generation` anywhere under `apps/` or `packages/`. At `HEAD` the first eight are
exactly the sites WP3 removed (for example `prepareCompatibleRuntime` in
`apps/editor/src/lib/visitor/visitor-cold-runtime.ts:202` and `createLayoutRoomRegistry` in
`apps/editor/tests/lib/editor/project-format-visitor-parity.test.ts`). `apps/museum` and
`apps/editor/tests/lib/project/` do not exist. The `unsupported_generation` case named in §8.2
is **not** present in this tree's history (`git log -S` finds no removal), so nothing was
deleted for it and nothing replaced it.

EVIDENCE-PATHS: end

### 9.2 §6 evidence

| §6 item 5 evidence | Carrier (post-WP3 names) | Result |
| --- | --- | --- |
| Valid current-format Layout and Scene validation | `project-format-writers.test.ts` "validates and serializes the canonical wall-first payload"; `project-format-writer-fixtures.test.ts` (21); `scene-codec.test.ts` (38); `layout-wall-first-codec.test.ts` "keeps createEmptyWallFirstLayoutDocument valid" | green |
| Canonical serialization and round-trip stability | `project-format-writers.test.ts` "serializeWallFirstProject returns all three canonical strings" and "saves round-trip through the current-format reader unchanged"; `scene-codec.test.ts` canonical-JSON and parse round-trips; `scene.test.ts` (4) | green |
| Ordinary validation failure for malformed or incomplete input | `project-format-writers.test.ts` "rejects a Layout payload with no current format discriminator", "rejects a Scene payload with no current format discriminator", "rejects a world-local scene that still carries roomId", "rejects unknown root keys, bad IDs and empty names", "throws a typed error from the strict serializer"; `scene-codec.test.ts` `room_id_forbidden_in_world_local` and invalid-shape cases; `layout-wall-height.test.ts` version rejections (35) | green |
| API Save/Load/publication on valid current-format documents | `api.test.mjs` "project save/load appends immutable versions and isolates owners" and "project body parsing keeps malformed, invalid, mismatched, and oversized JSON distinct"; `publication.test.mjs` "full loop: publish, snapshot freeze, update, unpublish, republish" and its nine siblings; `test-auth.test.mjs` seam isolation | green, real Postgres |
| Preserved geometry, identity, resource and visitor-isolation invariants | `visitor-identity-isolation.test.ts` (4), `visitor-public-route.test.ts` (15), `visitor-cold-runtime.test.ts` (14), `project-model-boundary.test.ts` (3), plus the full Layout kernel lane (noding, dissolve, curve, geometry, identity) inside `npm test` | green |

**API fixtures (§8.4).** All three `projectDocument()` fixtures now build the canonical empty
current-format document — wall-first Layout (`formatVersion: 5` with its `identity` ledger) plus
world-local Scene (`formatVersion: 1`) — and every call site's original behavioural expectation
is unchanged. `api.test.mjs` 8 call sites, `publication.test.mjs` 19, `test-auth.test.mjs` 2.
No validation rule was relaxed and no fixture expectation was rewritten.

### 9.3 Verification (Checkpoint C)

**Verified revision:** `985fea2d` (the review-correction commit, §9.6) on
`codex/pr115-architecture-plan`, over base `d0d0ce8a`; committed-change range
`a90c3be2..985fea2d` (Checkpoint B → C, 48 files, `+1172 / −3849`). The pre-review WP3 commit
`d0d0ce8a` produced the same gates with `npm test` at 106 files / 1,501 tests; the corrected head
adds exactly one case — the F1 regression assertion in `project-format-visitor-parity.test.ts`
(§9.6). The acceptance prose below is documentation-only and does not invalidate the product test
evidence for this code revision; the documentation gate re-ran green over it.

| Command | Result |
| --- | --- |
| `npm run test:arch` | 13 files / 102 tests passed |
| `npm test` | 106 files / 1,502 tests passed (fast + heavy + arch) |
| `npm run check` | `svelte-check`: 0 errors, 0 warnings |
| `npm run build` | built in 4.32 s (`@sveltejs/adapter-vercel`) |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core` | `tsc --noEmit` clean |
| `npm run check:api` | `tsc --noEmit` clean |
| `npm run test:api` | build + 3 files: 23 + 10 + 6 = **39 tests, 0 failures, 0 skipped**, real PostgreSQL at `postgresql://localhost:5432/biskiq` |
| `git diff --check a90c3be2 985fea2d` (Checkpoint B → C committed range); `git show --check d0d0ce8a` (single WP3 commit) | clean (both) — committed-change whitespace, per §7.4 (F3 replaces the earlier worktree-scoped `git diff --check`) |
| Browser check (`vite` dev server on 5173 and the API dev server on 8787) | `/`, `/projects`, `/project/x/spatial` (notice renders), `/p/x`: all 200, expected content, **zero console errors or warnings** |

The DB-backed run is a Checkpoint C result, not inherited from WP2. The frozen-project checks
remain owner-verified WP1 evidence and were not re-run here (§3.7); the repository-side
`legacy/` isolation gate is green in `test:arch`. The browser check needs the API dev server: the
`/projects` hub requests `/auth/me`, so without it the console shows one `ERR_CONNECTION_REFUSED`
that is an environment artifact, not a page defect.

### 9.4 Test disposition (predecessor / successor)

Removed cases are recorded with the §7.1 rule: a reader path disappearing is not by itself a
successor claim.

| Removed | Disposition |
| --- | --- |
| `describe('layout format identification (P23.0a dispatch)')` and its 6 cases (`layout-wall-first-codec.test.ts`) | **Deleted with their retired subject** — `decodeLayoutJsonCompatible` / `decodeLayoutValueCompatible`. The surviving rules they observed are asserted against the retained current-format gate: `layout-wall-height.test.ts` re-expressed the `4`/unknown-version rejections through `validateWallFirstLayoutDocument` + `wallFirstCanonicalFormatVersionIssue`, keeping the same code, path and "validation is a pure read" guarantees (35 tests). |
| `describe('P23.0 stage 2 — legacy compatibility round-trips')`, "a legacy layout cannot be saved through the wall-first writer", "saves round-trip through decodeProjectCompatible as wall-first" | **Re-expressed on the current-format gate**: "saves round-trip through the current-format reader unchanged" preserves the round-trip guarantee; the legacy shapes themselves are deleted because no reader accepts them. |
| "rejects a legacy (Room-owned) layout by name", "rejects a legacy (room-local) scene by name" | **Re-expressed**: "rejects a Layout payload with no current format discriminator", "rejects a Scene payload with no current format discriminator", "rejects a world-local scene that still carries roomId", "rejects a superseded layout version by name — canonical Save never migrates". Same defect class (a payload that is not the current pair must fail closed), current-format subjects. |
| `describe('P23.0 stage 4 — preparation routing and Room-frame discipline')` and its 4 cases; `describe('… legacy composer parity on a true compat shape (F0 review)')` and its case | **Re-expressed** as `describe('P23.0 stage 4 — current-format preparation discipline')` → "rejects anything that is not the current document pair, before any state is installed", plus the runtime-preparation/compiler-parity parity case. The "legacy geometry equals the direct legacy compile" case is deleted with the legacy compile path it compared against. |
| `describe('P23.6I legacy migration')` and "seeds migrated Walls from the legacy storey height and drops it from the canonical Floor" | **Deleted with the migration subject.** Its canonical half survives as "keeps floor.height out of the canonical schema". |
| The three `OR-D12-6 migration —` cases (`layout-p23b3a-d12-hazard.test.ts`) | **Deleted with their retired subject** (`migrateLegacyLayoutDocument`, and `decodeLayoutValueCompatible` which proved the fixture valid). The fail-closed correspondence rule they proved is still asserted for the retained callers through `correspondenceAuthorization` in the same file (lines 349, 571), and the file header records the retirement inline. |
| `scene-codec.test.ts` room-local fixture cases and the project-level Room gate | **Re-expressed**: the `tour-minimal` fixture is current-format, so the codec cases assert the `roomId` discipline of the current format itself; the project-level room gate has no subject left (no Scene carries `roomId`). |
| "keeps legacy no-envelope serialization byte-stable…", "rejects invalid FOV, malformed tracks, IDs, progress, targets, **and rooms**" | **Re-expressed in place** with the legacy envelope and the Room dimension dropped; every other dimension of the original assertion is retained. |

### 9.5 Stop rule, deferrals and residual findings

**No §6 item triggered the stop rule.** Every item was a deletion or a parameter removal; none
required new domain semantics. The two founded retirements stay exactly as §5.1 records them:

- `layout-core` legacy floors/rooms types, `layout-codec`, `layout-room-frame` and the legacy
  `compileLayoutGeometry` adapter — **RETIRE AT T1**'s authored-schema cutover. After WP3 they
  are reachable only from wall-first internals and tests, never from a project/API/runtime
  reader.
- The P22 authored-snapshot reader — **RETIRE AT T4** (prepared-reader cutover). Made strict in
  WP3; still the only delivery path.

T1's authored-schema redesign and the T2/T3 Scene/Camera unit extraction were not preempted.

**Residual findings, not actioned here:**

1. `apps/editor/src/lib/project/project-types.ts` is a type-only re-export of the canonical
   project-model types with **zero consumers** in the worktree. The WP0 per-file manifest
   retains it (`RETAIN AS FOUNDATION`, §2.1), so removing it is a manifest decision for WP3R's
   orphaned-abstraction class, not a WP3 edit. Its header comment still calls it a
   "compatibility facade".
2. `packages/project-model/src/runtime.ts` is new in WP3; WP3R should confirm its name and
   ownership alongside the other post-prune abstractions.
3. `parseWallFirstLayoutDocumentJson`'s malformed-JSON branch lost its only direct assertion
   when `decodeLayoutJsonCompatible` was deleted. The Scene half keeps an `invalid_json` case
   (`scene-codec.test.ts`); a Layout-half successor is WP3T's call, not a WP3 requirement.
4. The unused `LayoutRoomRegistry` **type** (and its empty-registry value) survives because the
   retained visitor renderer and Camera authoring math are typed by it. That is the §6 item 2
   "wherever it exists solely for obsolete formats" boundary being read strictly: the type is
   used, only Room-frame resolution is gone.

### 9.6 Independent review (F1–F5) and corrections

An independent review of the WP3 commit `d0d0ce8a` produced five findings. Each was checked
against current code, contracts and evidence; the dispositions and corrections follow, carried by
the review-correction commit `985fea2d` on `codex/pr115-architecture-plan` (on top of `d0d0ce8a`).
No product policy changed: one format, no legacy detector or compatibility facade, separate
Layout/Scene ownership, one geometry and Camera authority, visitor/editor isolation, and no
premature T1–T4 redesign.

| # | Finding | Disposition |
| --- | --- | --- |
| **F1** | `prepareRuntime` validated id/name/Layout/Scene but did not reject unknown root keys, whereas `validateProject` did | **Upheld — corrected.** A real regression, not an intentional split: the deleted `decodeProjectCompatible` rejected an unknown root key (`unknown_key`), and §6 requires that no unknown field be tolerated. `prepareRuntime` now opens through `validateProject` — the one canonical validator — and then compiles; the hand-rolled root/id/name checks and the second `ID_PATTERN` are gone, so runtime preparation cannot drift from the persisted-document reader. A focused assertion (`project-format-visitor-parity.test.ts`, "rejects an unknown root key through the canonical validator") pins the equivalence. |
| **F2** | WP3 rewrote the ratified decision record's historical evidence link from `compat-runtime.ts` to the new `runtime.ts` | **Upheld — corrected.** §8.2/§10.3 hold ratified decision records immutable and turn their old planning links into labeled provenance, exactly as the same record already does for its History-controller row. The row keeps its historical wording and labels the removed path's recovery: "compatible runtime preparation (removed by #115; recoverable with `git show e90a5822:packages/project-model/src/compat-runtime.ts`)". The original edit only existed because a dead link would otherwise fail the documentation gate; labeled provenance satisfies the gate and the immutability rule at once. |
| **F3** | §9.3 reported a plain `git diff --check`, which covers the worktree rather than committed changes | **Upheld — corrected.** §7.4 requires a committed-range or single-commit check. Recorded: `git diff --check a90c3be2 985fea2d` (Checkpoint B → C committed range) and `git show --check d0d0ce8a` (single WP3 commit) — both clean. §9.3 now records that scope; the worktree check is not checkpoint evidence. |
| **F4** | §9 reported 44 files; the commit has 45 | **Upheld — corrected.** `d0d0ce8a` is 45 files (36 modified, 8 deleted, 1 added), `+804 / −3,811` (44 tracked modifications/deletions at `+648 / −3,811` plus the new `runtime.ts` at `+156`). The earlier line double-counted the new file and used the wrong modified-line subtotal; the §9 preamble now records the correct count. |
| **F5** | The WP3 commit carries an agent footer and co-author trailer, contrary to `AGENTS.md` rule 12 | **Recorded, not rewritten.** `d0d0ce8a` is published on the #115 branch; removing the trailer by history rewrite or force-push is not authorized and was not done. Every commit from this review onward complies with rule 12. |

**Refinement, not a second authority.** The first F1 draft suggested keeping a deliberate split
between "runtime preparation" and "persisted-document validation". It is not kept:
`prepareRuntime` prepares the same accepted document pair and now uses the same validator. The
per-consumer differences that remain are real and intended — the visitor passes catalogue-aware
`SceneValidationOptions`, `validateProject` additionally returns canonical JSON, and
`prepareRuntime` adds compilation and Scene resolution on top.

**Claims re-checked and left unchanged.** The §9.1 verified-absence grep holds (all eleven removed
names are absent from `apps/` and `packages/`), and the `unsupported_generation` history note
holds (the term never existed under `apps/` or `packages/` — `git grep` at the baseline
`e90a5822` finds none — so its only occurrences are planning/acceptance prose and nothing was
deleted for it or replaced).

**Scope guard.** These corrections are evidence- and validation-authority fixes. They do not
reopen WP3's settled scope, and the surviving-architecture and test-organisation items remain
assigned to WP3R and WP3T.
