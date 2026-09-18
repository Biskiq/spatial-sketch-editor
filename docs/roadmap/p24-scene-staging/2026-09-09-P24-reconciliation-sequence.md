# P24 — reconciliation sequence

**R9 closeout (2026-09-10):** [Minimum freeze](reconciliation/2026-09-10-P24-R9-minimum-freeze.md) is the current inclusion/maturity/operation/acceptance authority; [P24.0–P24.5 child briefs](slices/2026-09-10-P24-minimum-child-plans.md) are implementation-ready for owner review. Earlier draft/pending-minimum wording below is superseded by R9. Source rechecks are closed as planning evidence; implementation and runtime ship gates remain open. P24 remains proposed; execution waits for the accepted P23 minimum and approval.


**Date:** 2026-09-09  
**Status:** R0–R9 planning reconciliation complete — R9 freeze and execution child briefs linked above; implementation not started
**Parent:** [P24 — Scene / Staging Depth umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md)  
**Cross-view authority:** [Unified Plan / 3D authoring addendum](../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md)  
**Pascal evidence:** [`Pascal-editor-harvest.md`](./research/Pascal-editor-harvest.md) — CLOSED at pinned revision `32c3c8a24dae17c55beaabf45029148900a3b409`  
**Three evidence:** [Three r175–r186 harvest](./research/three-r175-r186-museum-harvest.md) — source audit complete; adoption and runtime acceptance remain conditional.  
**Tracker:** P24 remains the registered plan number. This file consumes no new P-number and does not change P24's `proposed` status.

## Purpose

Turn the existing P24 research and current Museum implementation into a bounded, implementation-ready minimum without copying external editor feature lists or reopening ratified ownership.

This reconciliation may run **in parallel with P23 implementation**. It does not block P23 and does not authorize P24 implementation before its tracker dependency is satisfied.

```text
P23 implementation
→ proceeds independently through its existing child-plan dependencies (P23.1 and P23.2 already shipped on `main`; P23.9 is the current slice)

P24 reconciliation
→ may inspect current code + ratified P23 target in parallel
→ freezes implementation only after the required post-P23 seam recheck
```

P24 implementation still depends on the accepted P23 minimum useful Build set. Any P24 decision touching coordinates, placement ownership, selection routing, Plan projection or Scene/Camera migration must consume the coordinate/ownership model accepted through P23, not assume the earlier Room-local baseline remains permanent.

P23.0a → P23.8 → P23.0b implementation has landed, including world-local compatibility/cutover code. P23 F0 closed on 2026-09-10. **R0/R1/R2 are complete; R3 and R4 behavioral contracts and R5–R7 maturity reconciliation closed 2026-09-10; R8 post-F0 presentation reconciliation closed 2026-09-10; R9 minimum freeze complete; owner review of child briefs next.** Selected placement/selection/support-query and capability-specific asset/runtime seams remain open implementation/ship gates allocated by R9.

## Authority and evidence order

Read in this order:

1. [P24 umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md);
2. [Unified Plan / 3D addendum](../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md);
3. [P24A annex](2026-09-08-P24A-asset-supply-canonical-ingest-annex.md);
4. current Museum Editor code and tests for the capability being reconciled;
5. checked-in Phase 2 / Phase 4 research — durable inputs are `./research/deep-research-exact-asset-compact.md` + `museum-editor-phase2-acquisition-manifest.json` (Phase 2) and `./research/deep-research-P24-3D-editing-compact.md` (Phase 4). The legacy `museum-editor-phase2-exact-asset-harvest-P24.md` path is absent on disk; the umbrella and P24A annex now use the compact artifact as the durable Phase 2 source. The Phase 4 full source remains absent per the umbrella;
6. completed [Pascal harvest](./research/Pascal-editor-harvest.md) and [Three r175–r186 harvest](./research/three-r175-r186-museum-harvest.md) where relevant;
7. additional direct reference inspection only where a concrete unresolved maturity question remains.

Museum contracts remain authority. External references are evidence only.

The Three harvest closes source-capability questions, not runtime compatibility,
performance or R9 inclusion. Translate ADOPT to candidate KEEP/POLISH/DEEPEN
implementation choices for selected capabilities; BENCHMARK/SPIKE remains optional
evidence work; FOLLOW-UP/REJECT stays outside the minimum. **Exception: harvest
finding 06 (`Object3D.dispose()`) is downgraded from ADOPT to conditional
implementation recheck** because of Threlte disposal interaction and the relevant
post-r186 point-shadow disposal fix (`02198fbc4b`, #34522). Preserve scoped caches,
reference counts, clone ownership and asynchronous cancellation; do not infer
recursive resource disposal or delete ownership logic. The Three version is a
conditional dependency baseline selected at implementation freeze, not a pin to r186.

## Research rule

Do **not** launch another broad ecosystem survey.

For each unresolved capability:

```text
current Museum behavior
→ concrete maturity gap
→ one or two relevant direct references, if needed
→ exact source / version / license
→ KEEP | POLISH | DEEPEN | FOLLOW-UP | REJECT
```

If current code already answers the question, close it from Museum evidence rather than adding reference work for completeness.

## R-to-B mapping

| R step | Umbrella track |
|---|---|
| R0 | P23 delta map (no B equivalent) |
| R1 | P24A readiness (no B equivalent) |
| R2 | B0 capability-maturity baseline |
| R3 | B2 shared Plan/3D placement |
| R4 | B5 behavioral constraints (not a ship gate; R9/B6 decides inclusion) |
| R5 | B1 transform + arrangement |
| R6 | B3 material |
| R7 | B4 lighting + environment |
| R8 | B5 presentation/polish remainder |
| R9 | B6 minimum freeze / child-plan gate |

## R0 — current-state + P23 delta map

Before freezing P24 scope, produce one concise map of the seams P23 changes underneath Stage authoring.

At minimum inspect:

- Scene entity transform storage and world conversion;
- Scene Plan footprint/proxy projection;
- Plan Scene translate/rotate adapters;
- Scene placement entry points and floor/support assumptions;
- canonical selection identity across Plan/3D;
- Scene history/gesture lifecycle;
- Camera records only where P24 code touches shared Scene persistence/runtime;
- `LayoutDocument` / `SceneDocument` ownership boundary (`LayoutObjects` vs Scene entities) where P24 placement consults Layout geometry;
- Layout compile/query/editor-adapter cutover (`compileLayoutGeometry()`, query, migration) affecting Plan projection and support/surface resolution;
- Save/Load and P22 visitor consumption of Scene state.

Classify every finding as:

```text
stable across P23
changes in P23 F0
requires post-F0 recheck
irrelevant to P24
```

R0 prevents P24 from freezing around code that P23 is already scheduled to replace.

### R0 result — 2026-09-09 audit (historical)

R0 audit baseline:
remote parent: `e030038fa3708f578baf97a6bc4f8b6c77b5f689`
local Museum commit: `f0f1f6380a26a535bf3c50b37404fd1ff0bca42e`
P23 F0 scaffolding: uncommitted dirty tree at audit time (no F0 commit to pin).

At that audit baseline, F0 scaffolding decoded nothing wall-first and authoring
remained Room-owned/Room-local. The table below is historical evidence, not a claim
about today's implementation.

**Superseded qualification (2026-09-09):** the first audit ran before F0 acceptance and writer enablement. Its observations remain useful only as the pre-F0 delta baseline. Do not use its required-room assumptions or `requires post-F0 recheck` labels as current conclusions; the 2026-09-10 refresh below supersedes them.

| Seam | Historical class |
|---|---|
| Scene transform storage + world conversion (`packages/project-model/src/scene.ts`) | changes in F0 / required post-F0 recheck (world-local migration was P23.0b) |
| Plan footprint/proxy (`plan-scene-footprint.ts`) | logic stable / required recheck (`rooms` source changed under F0) |
| Plan translate/rotate adapters (`plan-scene-transform.ts`) | stable / required recheck (world-local identity-frame behavior not yet accepted) |
| Placement + floor assumptions (`editor-placement.ts`, `placement-cluster-mutator.svelte.ts`) | stable / required recheck (no stacked/support choice, no Layout-query lookup) |
| Selection identity (`selection-store.svelte.ts`) | stable / required R4 continuity recheck |
| History/gesture (`history-controller.svelte.ts`) | stable / required operation-owner recheck |
| Camera records in Scene | changes in F0 where touching shared resolver; pure tour routing irrelevant |
| Layout/Scene ownership boundary | changes in F0 (Layout side) / required recheck — no persistent support dep without contract |
| `compileLayoutGeometry()` / query / editor-adapter | changes in F0 / required recheck — support resolution source |
| Save/Load + P22 visitor | required recheck after world migration; package export versioning remained a separate seam |

### R0 post-F0 delta refresh — 2026-09-10

**Accepted baseline:** P23 Foundation Gate F0 is closed on `main` through PR #7 (`32b2e8f`), including the stage-6 wall-first writer flip (`455f587`), cross-format transaction-invariant restoration (`93111a2`), and final proof tightening (`79b3551`). Earlier F0 stages established the shared compatible Preview/visitor runtime (`2c9b04d`) and the no-second-transform / standalone Scene import proofs (`0d66aed`).

F0 closes the coordinate-meaning ambiguity. Canonical new Scene state is now **project/world-space** with `formatVersion: 1`; entities, clusters, navigation nodes, path anchors/waypoints and view keyframes must not carry `roomId`. Legacy room-local Scene remains an explicit compatibility input only. Successful legacy migration resolves physical values exactly once through the trusted legacy Room registry, removes `roomId`, and writes world-local meaning. A wall-first Layout paired with a legacy room-local Scene is rejected when the source Room frames are no longer available; the runtime never guesses them.

The refresh also exposes a narrower truth than “F0 made Stage world-local”: the canonical project/runtime model is world-local, but several live **editor authoring** paths still carry legacy Room context. P24 must not freeze those paths as future semantics.

| Seam | F0 delta / live code | Post-F0 status | Later P24 recheck |
|---|---|---|---|
| Scene transform storage + world conversion (`scene.ts`, `scene-format.ts`, `scene-world-conversion.ts`, `project-compat.ts`) | `formatVersion: 1` explicitly identifies project/world Scene; canonical world-local records forbid `roomId`; legacy conversion resolves position/target and full rotation once against trusted legacy frames, then strips room ownership | **STABLE F0 contract** | No semantic redecision. Keep legacy compatibility branch while old inputs remain supported; stale room-local comments may be cleaned separately |
| `LayoutDocument` / `SceneDocument` ownership boundary | F0 changes Layout's canonical generation to wall-first and Scene coordinates to project/world; it does **not** merge document ownership. Layout structure stays Layout-owned; staged models/primitives/lights/materials/cameras stay Scene-owned | **STABLE ownership** | Support/floor lookup stays a transient Layout-geometry calculation by default. Any future persistent support reference needs its own ownership/delete/history contract |
| Room resolver / coordinate adapter (`project-layout-semantics.ts`) | `pointInFrame` / `localPointInFrame` resolve a present legacy `roomId`; absent `roomId` is identity. Wall-first/world-local runtime uses an empty registry whose undefined-frame helpers are identity and whose named-room lookups fail closed | **STABLE compatibility seam** | Do not remove inverse/frame adapters merely because canonical Scene is world-local; legacy-compatible input still needs them |
| Scene Plan footprint/proxy (`plan-scene-footprint.ts`) | Projection accepts optional legacy `roomId`; world-local entities pass through identity frame after scale/yaw/translation. Y still drops only at Plan projection; lights remain non-footprinted | **STABLE projection math** | R3/R4 acceptance still must pin same-ID Plan/3D continuity, Plan eligibility and preservation of Y/pitch/roll/scale on canonical world-local entities |
| Plan Scene translate/rotate (`plan-scene-transform.ts`) | Baselines carry optional `roomId`; world pivot and inverse write use identity frame for world-local Scene, legacy frame conversion for compatibility input | **STABLE adapter math** | Recheck only integration/fixtures when P24 shared placement uses canonical world-local Scene. “Remove inverse-resolve” is no longer a requirement |
| Scene placement / grounding (`editor-placement.ts`, `placement-cluster-mutator.svelte.ts`) | Grounding remains rendered tagged-floor / 5-ray based and does not consume compiled Layout query geometry. More importantly, placement creation still accepts/writes `roomId`, and selectability still depends on selected Room context | **NOT CLOSED for canonical world-local authoring** | Before a P24 child freeze: decouple canonical placement/selectability from Room ownership; resolve floor/support Y from an explicit surface source; decide stacked-surface choice; keep persistent cross-document support links out unless separately designed; recheck duplicate re-ground |
| Selection identity / cross-view selection (`selection-store.svelte.ts`, `editor-types.ts`, `selection-actions.svelte.ts`) | Entity IDs and the existing workspace/navigation reducer remain canonical. Selection actions contain a world-local branch, but `WorkspaceSelection` still requires `roomId` and the placement selectability host remains Room-gated | **IDENTITY STABLE; ROOM CONTEXT NOT CLOSED** | Remove Room ownership as a requirement for world-local Scene selection without creating a second selection store; pin R4 Plan↔3D continuity and Plan-ineligible-selected behavior |
| Scene history / gesture lifecycle (`history-controller.svelte.ts`, format policy) | One chronological stack still tags `scene` vs `layout`; one Scene transaction validates/commits one document result, no-op commits none. F0 adds fail-closed format dispatch and cross-format transaction invariants rather than a new history model | **STABLE history architecture** | R9 still names operation owner/history behavior for each selected P24 op. No mixed Layout/Scene transaction or hidden support-side write without an explicit atomic contract |
| Layout compiler + query geometry (`layout-geometry.ts`, `layout-geometry-types.ts`, `plan-hit.ts`) | Legacy and wall-first compiler entries converge through the shared compiler core. `CompiledLayoutGeometry.queries` remains the render-neutral point/span/polygon/AABB query contract; wall-first physical-wall identity comes from canonical wall-first inputs | **STABLE compiler/query core** | P24 support placement must consume this seam rather than create another geometry/query system. Recheck exact floor/wall/support metadata needed by selected placement operations because current Stage placement does not use it yet |
| Camera records inside Scene | Nodes, path anchors/waypoints and view keyframes participate in the same one-time world-local conversion; runtime graph builds after compatible preparation | **STABLE for P24** | Pure topology/Sequence/motion stays outside P24. Do not introduce a second route or motion system; only recheck if a selected P24 capability directly touches shared Scene persistence |
| Canonical project writer / compatible decode (`wall-first-project.ts`, `project-compat.ts`) | F0 now has a canonical wall-first + world-local project writer and explicit compatible decode/migration matrix | **STABLE library boundary** | P24 persistence must use this meaning; no fallback to guessed Room frames |
| Live editor cloud Save/Load (`EditorApp.svelte`, `project-codec.ts`) | At the R0 audit baseline, live `captureValidatedSaveSnapshot()` and `loadProject()` called `validateProject` while that strict codec did not yet accept wall-first Layout | **SUPERSEDED BY P23.1** | P23.1 widened the shared codec to accept explicit wall-first Layout + world-local Scene; live Save/Load already uses that shared codec. Basic format persistence is no longer a P24A blocker; real capability round-trip acceptance remains required |
| Preview + P22 cold visitor (`compat-runtime.ts`, `preview-coordinator.ts`, `visitor-cold-runtime.ts`) | Both now open through shared `prepareCompatibleRuntime()`: decode compatibly, compile through the single shared geometry core, resolve legacy frames at most once, then operate on one runtime/world representation. F0 parity tests pin wall-first Preview/cold-visitor equality | **STABLE coordinate/runtime seam** | Only capability-specific P24 parity remains: model registry/retention, added materials/lights/environment and asset resolution if selected. No coordinate migration re-open |
| Visitor/editor isolation | Shared compatibility work lives in visitor-safe project/runtime packages; Preview and cold visitor consume canonical data/runtime meaning rather than editor selection/history/gizmo/session state | **STABLE boundary** | P24 helpers, proxies, selection, gizmos and acquisition UI remain editor-only; verify new selected capabilities do not leak them into cold visitor bundles |

**R0 conclusion:** F0 has stabilized the canonical coordinate model, Layout/Scene ownership, shared compiler/query core, Plan transform/projection math, history architecture, and Preview/cold-visitor coordinate/runtime preparation. P23.1 subsequently closed the basic strict-codec wall-first/world-local Save/Load format-acceptance gap. The remaining post-F0 blockers are narrower and concrete:

1. **Stage authoring Room coupling:** placement/selectability and workspace-selection context still assume Room ownership even though canonical world-local Scene forbids `roomId`.
2. **Support/surface integration:** the compiled Layout query core is stable, but current Scene grounding/placement still uses rendered tagged floors and has no explicit stacked/support resolver.
3. **Capability-specific asset/runtime parity:** P24A static-model source authority and any selected material/light/environment additions still need real Save/Load + cold-visitor acceptance, without reopening the now-stable coordinate runtime.

These are R9 inputs, not authorization to implement them in R0. R2/R5–R8 remain dated pre-F0 evidence where labeled; when they conflict with this refresh or the P23.1 addendum above, the newer evidence wins.

## R1 — P24A implementation-readiness reconciliation

Run the bounded readiness pass already required by the P24A annex.

Close the actual current gaps for:

- asset/provenance identity;
- deterministic model normalization;
- PlanProxy / `AssetFootprint` generation and Plan eligibility;
- normalized pivot + grounding/contact metadata;
- canonical GLB/model registry path;
- Save/Load + P22 cold visitor resolution;
- bounded material/HDRI supply;
- license/redistribution evidence.

Use the completed Pascal harvest only as supplemental evidence for the principle that one semantic item can have derived 2D and 3D representations and for Plan-eligibility/fixture ideas. Do not adopt Pascal's generic node registry or per-instance proxy ownership.

**Output:** update the P24A annex from `seed — evidence pending` only when its concrete readiness questions are closed. Do not expand the 32-object acquisition backlog into a ship gate.

### R1 evidence — 2026-09-09 dry-run + finish pass (branch `p24-reconciliation-evidence`)

Closed now (pipeline-side evidence, no runtime changes):

- Deterministic normalization job: `apps/editor/assets-source/pipeline/normalize-asset.sh` wraps `@gltf-transform/cli` (version asserted at run, mismatch fails) with hash-in/hash-out + validation + metrics + provenance JSON (`toolVersionActual`, `recipe furniture-floor v1` + recipe hash, `sourceUnitPolicy: recorded-not-baked` + explicit `unitScaleToMeters`). All files stage in a same-filesystem temp sibling dir and install via rename-with-rollback (previous good output restored if replacement fails) — failed runs never lose a good destination. Piano fixture: reruns → identical content `c8669154…b60b` from source `09627e34…6778` (matches the recorded license evidence); 1,180,076 → 1,164,508 bytes, grounded bbox, cm-scale recorded not rescaled. Covered by `normalize-asset.test.ts` (determinism + rejection + failure atomicity; skips where the toolchain is absent).
- Rights gate: `assets-source/pipeline/provenance.ts` (`classifyRights` A/B/C/D + `gateApproved`; unknown never Approved — derivatives and acquisition date included, since the pipeline itself creates derivatives) + 8 tests.
- `generated-obb`: recovers the piano 1.48 × 1.59 box, reports canonical X/Z bounds for rotated outlines, rejects non-finite input, ~50ms on a 100k-point cloud; round + thin-leg oracle archetypes benchmarked (real Kenney/SH3F corpus acquisition is P24A.3 execution, not readiness).
- Proof set frozen (12, from the manifest — rest is backlog): Poly `ArmChair_01`, `round_wooden_table_01`, `Shelf_01`, `painted_wooden_table`, `folding_wooden_stool`; Kenney `chair`, `loungeDesignChair`, `table`, `cabinetBedDrawer`; SH3D `Mid-century-chair`, `Cafe-table`, `Futon-couch` (attribution-survival proof). Covers round + irregular, top-down oracle, planIcon, OBB + silhouette, CC0 + CC-BY-3.0.
- Supply pointers (no new survey): 42 material rows + 9 HDRI rows in `museum-editor-phase2-acquisition-manifest.json`, all CC0 with source URLs; bytes acquired at P24A.3+ execution.
- Registry decision: Wave-1 remains static-only through the append-only shipped-static compatibility path first. Dynamic project/upload/provider GLB support through P20/R2 + P22 release pinning is a deferred depth path, not the P24A minimum. The remaining static runtime gap is narrower: visitor model loading must take its production source from shipped-static authority rather than validating there and then resolving from the mutable live catalogue.
- `gltfpack` disposition: **DEFER** — Meshopt decode already runs at runtime (`useMeshopt`); encode-side size wins are unmeasured and unnecessary for the minimum. Revisit as **BENCHMARK FIRST during P24A.3** if derivative sizes demand it. `meshoptimizer` stays transitively available; no new dependency.

### R1 post-F0 closeout — 2026-09-10 (after P23.1 / P23.2 shipped)

**R1 COMPLETE.** The P24A annex advances to `evidence complete — reconciliation pending`; R9 still owns minimum freeze and implementation-ready child-plan creation. P23.1 shipped via PR #9 (`d5ec0df`) and P23.2 via PR #13 (`a369a15`); P23.9 is the current P23 slice. P24.0’s remaining task is canonical Stage readiness on top of that shipped P23 minimum, not reopening P23.1 persistence.

Closed architecture/readiness decisions:

- `SceneModelEntity.assetId` remains the authored model identity; PlanProxy/`AssetFootprint` remains asset-definition metadata, never a second per-placement record;
- canonical world-local Plan projection already uses the identity frame when `roomId` is absent; legacy Room transforms remain compatibility-only;
- the `furniture-floor` normalization recipe establishes a zero floor-contact offset for that normalized recipe only; broader wall/ceiling/stacked support metadata is not inferred;
- static-first is the P24A minimum: accepted Wave-1 GLBs use stable shipped-static identities + retention; generic project/upload/provider GLB ingestion is deferred unless R9 explicitly promotes it;
- P23.1 shipped on `main` via PR #9 (`d5ec0df`) and closes basic wall-first/world-local project format acceptance in the shared codec used by live cloud Save/Load; no model-specific serializer or separate P24A persistence system is needed;
- future dynamic models, if later selected, must extend the existing P20/R2 + P22 release path with model kind/MIME/validation/hash-pinning rather than create a parallel registry;
- normalization, rights gate, proof-set selection, material/HDRI supply pointers and `gltfpack` benchmark-first disposition remain accepted from the dry run.

Remaining implementation/reconciliation blockers before implementation-ready P24A children freeze:

1. shared Stage placement/selectability must stop requiring Room ownership for canonical world-local Scene, **and reachable canonical authoring must ensure the Scene is `formatVersion: 1` before world-local Stage writes occur; legacy Scene mutation remains compatibility-only or must be explicitly adapted without mixing coordinate meanings**;
2. cold static-model rendering must resolve the production source from shipped-static compatibility authority rather than the mutable live catalogue;
3. selected floor/support placement still needs the shared Layout-query Y/ambiguity contract; normalized floor pivot metadata does not replace support resolution;
4. P24A.3–P24A.6 execution must run the frozen corpus and bounded material/HDRI supply through real Save/Load + cold-visitor acceptance.

No broad research remains for R1. Dynamic uploaded/provider GLB support does **not** block the static-first P24A minimum.

### Three conformance additions — conditional on the selected runtime/corpus

Retain glTF Transform normalization and the existing Meshopt runtime seam. Define
conformance fixtures for formats/extensions actually accepted by the selected
runtime: EXT/KHR Meshopt as applicable, rotated texture transforms and imported
instancing where present in the proof corpus. KHR Meshopt requires a compatible
baseline. Draco/KTX2, broader HDR formats, simplification and LOD remain
benchmark-first additions, not mandatory supply formats. Record deployed
decoder/transcoder resources and publication retention/resolution of every accepted
asset dependency; acquisition URLs must not become runtime dependencies.

Keep static-first Wave 1 and the benchmark-first gltfpack disposition. This does
not force uploaded-model support into Wave 1, replace the normalization/rights
pipeline or turn every harvest loader into a required fixture.

## R2 — P24B B0 capability-maturity baseline — POST-F0 REFRESH COMPLETE 2026-09-10

Audit current Stage capabilities end-to-end before deciding depth.

**Audit baseline:** live `main` at `ddccab6` after P23 F0, P23.1 and the accepted R1 reconciliation. R2 is a maturity map, not a ship-scope expansion. Missing features stay FOLLOW-UP or R9 choices unless they close a proven minimum workflow gap.

| Capability | Live post-F0 behavior / what already works | Genuine Stage-depth gap | Disposition |
|---|---|---|---|
| Selection / multi-select | One ordered `EditorSelectionStore` owns workspace + navigation selection, deterministic modifier semantics and `lastSelectedId` primary intent. `selectPlacementFromTree()` / `selectClusterFromTree()` contain partial roomless/world-local branches. | Those branches are not end-to-end functional: `WorkspaceSelection` placement/cluster variants still require `roomId`; `isPlacementSelectable()` still requires selected Room + matching entity Room; `selectCluster()`, select-all and tree expansion remain Room-gated. Canonical roomless Scene selection therefore is not closed. | **KEEP** the selection reducer/identity/order. **DEEPEN only** Room-context removal + R4 continuity fixtures; no second selection store. |
| Transform / pivot / scale | One Scene gizmo policy/host owns translate/rotate/scale. Drags capture immutable start matrices, preview roots transiently, then commit once. Shared multi-object pivot is a world-AABB center. Numeric Inspector edits already commit through the same Scene transform path. Local/World toolbar + shortcut state already exists. Independent X/Y/Z scale UI/session state also exists. | Scene gizmo policy still hardcodes `space: () => 'world'`, so the existing Local/World control is not wired to Scene behavior. Persisted Scene scale remains one scalar; independent scale is averaged on write. The Inspector still labels Scene transforms `Room-local`. Bounded pivot alternatives and per-axis persistence remain R5/R9 choices, not missing foundations. | **KEEP** one transform authority. **POLISH/DEEPEN narrowly in R5**: wire selected space semantics, clean stale labels, decide bounded pivot/per-axis depth only if useful. |
| Duplicate | `duplicateSelection()` is deterministic: +0.5 X/Z, preserves source pose/state, duplicates fully selected clusters, selects the copies, and commits one Scene transaction/history result. | No collision/bounds/support re-ground check. If only part of a cluster is selected, copies are created ungrouped without a warning. | **KEEP** operation. R5 may add duplicate-then-move spatial checks + silent-skip warning; no duplicate subsystem. |
| Groups / clusters | `SceneObjectCluster.roomId` is optional in the schema and the flat non-nested cluster concept already exists. | Live cluster create/add/select paths still require same-Room membership, write/compare `roomId`, and depend on selected Room context. Group pivot/Inspector richness is optional depth, not a canonicalization prerequisite. | **KEEP** flat grouping and no nesting. **DEEPEN only** canonical world-local Room-free CRUD/selection; R5 decides any extra UX depth. |
| Plan Scene staging | Plan footprints are derived from canonical Scene state. Roomless entities use the identity frame; models are eligible only when asset metadata has floor placement + a valid footprint; primitives derive deterministic shapes; lights intentionally have no footprint. Plan transform adapters already author X/Z + yaw while preserving Y, pitch, roll and scale. | New shared placement still needs explicit support/Y/ambiguity semantics, and selected-but-Plan-ineligible behavior still needs R4 acceptance. Projection math, eligibility and transform ownership are not gaps. | **KEEP** derived Plan projection + adapters. R3/R4 close placement/interaction fixtures; do not create persisted Plan entities/proxies. |
| Placement / grounding | One pending-placement pipeline serves models, primitives and lights. Floor grounding uses semantic tagged rendered floors, five downward rays, highest valid floor, rigid-selection Y delta, Keep/Drop-to-Floor behavior and `GROUND_EPSILON` no-op protection; commit is one Scene transaction. | Creation APIs still require/write `roomId`; reachable authoring can still start from a Scene without `formatVersion: 1`; click placement depends on room-tagged rendered floor objects rather than compiled Layout queries. Explicit stacked/support choice is absent. Wall/ceiling placement is not automatically a P24 minimum requirement. | **KEEP** placement/grounding pipeline. **DEEPEN** canonical `formatVersion: 1`/Room-free writes + shared Layout-query support/Y resolution. R3/R9 decide exact support surfaces; no persistent Layout↔Scene support link by default. |
| Asset-library placement entry points | One Asset Library already exposes Models, Shapes, Lights and Textures. Shapes/lights arm placement from the library; model selection routes to the existing Inspector `Place` action; texture local/cloud flows are separate asset-resource operations. | Model entry is less direct, and there is no shared Plan model placement/drag path yet. This is entry-point consistency after R3, not evidence for another placement framework. | **POLISH** existing entries after shared placement contract; no new asset-placement system. |
| Snapping / guides | 3D Scene transform already has translation/rotation snap preferences with modifier bypass; Plan Scene transforms already snap through their existing Plan helpers. Local/World session state exists. | Scene gizmo still ignores Local/World state; no snap-winner visual feedback or align/distribute/equal-spacing Scene operations were found. These are productivity depth choices, not missing snap infrastructure. | **KEEP** current snap seams. R5 selects exact feedback/alignment depth; **REJECT** a generic snapping framework. |
| Materials | Six built-in definitions exist; `MaterialDefinition` already supports base/normal/roughness/AO/metalness map slots + physical default tile size. `SceneMaterialInstance` and the canonical mutator already support shared-vs-unique decisions, base material/base texture, roughness/metalness overrides and one-transaction Make Unique. Single-object Inspector is live. | No authored base-color/tint instance override, no multi-selection apply, no editable physical tile-size workflow, and P24A material supply is not yet consumed. The gap is not “PBR support absent”; it is authoring breadth over an existing model. | **KEEP** material definition/instance authority. R6 decides tint/tile-scale/multi-apply/import depth; no graph/UV/slot-editor expansion. |
| Lights | `SceneLightEntity` already owns point/spot/directional lights, color, intensity, range, spot angle/penumbra and `castShadow`; renderer aims spot/directional lights along local -Z. Single-light Inspector is live and an invisible 0.12m pick proxy supports editor picking. | Light creation still requires/writes Room context. There is no light-specific visible range/cone/direction feedback or authored gallery preset. Spot angle is presented in radians and current validation accepts up to π, wider than Three's supported half-angle. | **KEEP** `SceneLightEntity` + shared transform authority. R7 may deepen helpers/angle UX/preset behavior after canonical Room-free creation; **REJECT** a second light gizmo. |
| Environment | Shared scene rendering already has system/runtime background, fog, ambient light and directional light controls; authored Scene lights render in addition. | No authored Scene-level HDRI/IBL/environment/exposure state exists. If selected, asset resolution, semantic mapping, lifecycle and visitor parity still need implementation. | Global Scene environment architecture remains ratified **conditionally**; **R9-PICK** minimum inclusion. Absence is not a blocker to the rest of Stage. |
| Outliner / Inspector | One `UnifiedProjectTree`/Inspector architecture already serves the existing domains, and the single-object transform/material/light/primitive inspectors plus commit-only numeric editing are live. | The current tree model is still legacy Room-nesting based: `buildUnifiedProjectTreeModel()` returns `{ rooms: [], cameraTour }` for wall-first Layout, so canonical world-local Scene entities/clusters are not surfaced in that hierarchy. Multi-selection editing remains shallow; cluster Inspector depth and disabled-without-reason polish remain limited. | **KEEP** one hierarchy/Inspector model. **DEEPEN only** wall-first/world-local Scene surfacing, then let R5/R6/R8/R9 choose bounded bulk/cluster/polish depth; no second hierarchy. |
| History integration | One Svelte-5 `EditorHistoryController` owns the chronological Scene/Layout stack (`HISTORY_LIMIT=100`), atomic begin/commit/cancel, validation-failure rollback, undo/redo and structural no-op suppression. Scene gizmo and placement operations already use one transaction per completed gesture. | P24 only needs owner/fixture coverage for newly selected operations and cross-view cancellation; history architecture itself is not a Stage-depth gap. | **KEEP** canonical history. Add capability-specific acceptance only; no command/history framework. |
| Editor / visitor + asset resolution | Visitor-safe runtime remains isolated from editor selection/history/gizmos. R1 confirmed built-in models have shipped-static validation/retention and P20 dynamic project bytes remain image/procedural-only. | Static model validation authority and actual load-source authority are split: cold validation uses shipped-static, while model loading still reads `productionFile` from the live catalogue. Selected P24 material/light/environment additions need capability parity. Dynamic project GLB ingest remains absent but is deferred by R1. | **KEEP** visitor/editor boundary. **DEEPEN** shipped-static source authority for the static-first minimum + selected capability parity. Dynamic GLB stays **FOLLOW-UP**. |

### R2 conclusion

**R2 COMPLETE.** The post-F0 audit narrows P24B substantially: selection/history architecture, the one Scene gizmo/transform authority, derived Plan projection/transform math, material-instance semantics, light entity authority and visitor/editor isolation are existing foundations to preserve, not systems to replace.

The genuine cross-cutting integration blockers remain narrow: reachable canonical authoring must be `Scene formatVersion: 1` before world-local/no-`roomId` writes; Stage placement/selection/group/light creation must stop treating Room as ownership; the existing `UnifiedProjectTree` must surface canonical world-local Scene entities/clusters when Layout is wall-first; placement must consult the shared Layout-query seam for support/Y/ambiguity; and the static visitor must load model bytes from shipped-static authority. R5–R7 still decide **depth**, not foundations.

R2 does **not** promote box selection, visibility/lock, generic model upload, wall/ceiling support, align/distribute, environment authoring, material graphs, a new command layer, a new selection store, a new gizmo or a new asset registry into the minimum. Existing R5–R8 hypotheses remain candidate input only; where their dated baseline wording conflicts with this refresh, this R2 result wins until the relevant reconciliation step explicitly updates it.

## R3 — B2 shared Plan / 3D placement contract — COMPLETE 2026-09-10

Closed behavioral contract: [2026-09-10-P24-R3-shared-plan-3d-placement-contract.md](reconciliation/2026-09-10-P24-R3-shared-plan-3d-placement-contract.md).

The standalone R3 record is authoritative for the frozen placement semantics. R9/B6 still owns minimum inclusion; R3 completion does not itself authorize implementation or promote optional placement depth.

## R4 — B5 cross-view interaction contract — COMPLETE 2026-09-10

Closed behavioral contract: [2026-09-10-P24-R4-cross-view-interaction-contract.md](reconciliation/2026-09-10-P24-R4-cross-view-interaction-contract.md).

The standalone R4 record is authoritative for cross-view selection, cancellation, preview/commit and single-history semantics. R8 still owns presentation/polish and R9/B6 still owns minimum inclusion. The remaining implementation seam is cancel-on-switch wiring: current view controls block active interaction instead of routing an accepted transition through the existing gesture cancel owners.

## R5–R7 post-F0 result — 2026-09-10

The [bounded maturity reconciliation](reconciliation/2026-09-10-P24-R5-R7-maturity-reconciliation.md) is the current decision source for R5–R7 and supersedes conflicting dated hypotheses/freeze-packet details below. Source audit baseline: `b14568d9c34b2f2e5e7a42a80975fda19350929f`. No product implementation or minimum freeze occurred.

- R5: retain the single authorities; wire Local/World with primary-oriented Local frames; preserve actual Selection Center default; optional Active Object pivot. Minimum uniform scale must round-trip; independent persistence and repeat arrays are follow-up. Room-free flat clusters, duplicate warnings and bounded world-X/Z arrangement are specified.
- R6: retain definitions/instances; bounded tint/tile/PBR supply and atomic multi-apply with outside-selection sharing protection. Native imported appearance and explicit whole-model replacement are distinct; DCC slot/UV/graph editing excluded.
- R7: retain three light types; explicit half-angle repair/compatibility policy and finite/unlimited semantics; editor-only helpers. Recommend one global static HDRI vertical slice, conditional on R9 supply/runtime acceptance; exposure deferred. Gallery preset resets all authored lights/environment after an explicit replacement warning in one Scene transaction; generated lights retain no preset ownership/provenance. Baseline and disposal/parity contracts are explicit.
- Next: R9 inclusion/child-plan gate; R8 presentation reconciliation is complete. Earlier pre-F0 drafts remain historical input, not an alternate current decision source.

## R5 — B1 transform + arrangement maturity

Reconcile only proven gaps in the existing transform/arrangement system:

- Local/World gizmo orientation if justified, without changing storage ownership;
- primary/active selection clarity;
- bounded pivot options;
- numeric Inspector ↔ gizmo synchronization;
- snapping/guides feedback;
- alignment/distribute/equal-spacing;
- duplicate productivity;
- group/cluster UX;
- Outliner density/selection coherence;
- cancellation/no-op/history behavior.

Use Pascal only where its completed harvest already provides useful counter-fixtures or lifecycle evidence. Use other mature references only for unresolved concrete questions.

### R5 candidate hypothesis — 2026-09-09 (NOT frozen; depth decision requires the bounded evidence below, frozen only in R9)

Evidence basis: one-host authority + bounds-center pivot + room-local/world conversion (`gizmo/scene-gizmo-adapter.svelte.ts`, `editor-cluster-transform.ts`); v6 scalar-scale loss (`editor-transform.ts`); Pascal lifecycle/counter-fixtures (completed harvest). No new direct-reference study needed unless a concrete interaction question survives the post-F0 recheck.

- Local/World gizmo orientation: WIRE the existing toolbar switch (`EditorViewportToolbar` Local/World → `interactionStore.toggleSpace`) through to the scene gizmo policy, orientation-only, storage unchanged; default stays World. The switch UI exists but the scene/camera gizmo policies currently hardcode world with no reader of `interactionStore.space`. Single-selection Local uses the selected object's orientation; the multi-selection Local frame (primary-object orientation vs another derived frame) must be resolved before R9 — do not create stored pivot/orientation state.
- Selection-Center pivot alongside Active-Object bounds-center: ADOPT if post-F0 world frame keeps pivot math rigid; no new stored pivot.
- Primary/active selection clarity + numeric Inspector ↔ gizmo sync: POLISH.
- Snap winner feedback: POLISH; no new snap framework.
- Align/distribute/equal-spacing as deterministic Scene ops (one history result each); exact op set frozen in R9.
- Duplicate-then-move: ADOPT with collision/re-ground check (closes the R2 gap).
- Cluster UX without nesting; Room-gate removal rechecked post-F0.
- No second gizmo or transform authority.

Code-verified on main: one-host authority + bounds-center pivot (`editor-cluster-transform.ts:15-32`, `scene-gizmo-adapter.svelte.ts:162-164`); v6 scalar scale, per-axis session-only (`editor-transform.ts:24-41`); duplicate +0.5 XZ, one history entry, no re-ground, partial clusters silently skipped (`placement-cluster-mutator.svelte.ts:639-669`); flat same-room clusters (`:486-508`); snap room-local + Shift-bypass, no winner feedback.

### Preferred implementation primitives — no independent minimum expansion

For already-selected capabilities, prefer public TransformControls `setColors`
and plane/rotation visibility APIs when supported by the baseline selected at
freeze. Replace private palette traversal where equivalent; preserve
`SCENE_PALETTE`, the host, adapters, cancellation, snapping and history.
`applyEditorGizmoSingleEnding`, multi-selection pivot math and gesture lifecycle
have no proven drop-in replacement. Native Object3D pivot remains an optional
implementation experiment, not a new authored pivot schema.

## R6 — B3 material maturity

Audit the existing material definition/instance path first. Decide the minimum for:

- discovery/presets;
- shared vs unique semantics;
- base color/tint;
- PBR map support;
- texture scale/physical sizing;
- multi-selection workflows;
- imported P24A materials;
- editor/visitor parity.

Do not replace the existing material model merely because a reference editor has a richer panel.

### R6 candidate hypothesis — 2026-09-09 (NOT frozen; depth decision requires the bounded evidence below, frozen only in R9)

Evidence basis: 6-entry catalogue + `SceneMaterialInstance` shared/unique + Make Unique flow (`content/materials.ts`, `material-resource-mutator.svelte.ts`, `resolveSceneMaterial`); single-select-only Inspector; P24A import path still absent (R1). No new direct-reference study needed unless a concrete authoring-semantics question survives the post-F0 recheck.

- Keep the `MaterialDefinition` / `SceneMaterialInstance` shared-vs-unique model; no slot/UV/graph scope.
- Minimum: base color/tint override, PBR map set on definitions, physical tile scale where the existing repeat path supports it, Apply-to-multiselection, shared/unique preview feedback, P24A import consumption.
- Editor/visitor parity required per material addition, including roughness/metalness, mapped PBR, alpha and transmission fixtures as applicable. If the renderer baseline changes, review BRDF/PMREM differences separately from material retuning. No node-material graph, retroreflectivity UI or arbitrary GLB slot-editing expansion follows from the harvest.

Code-verified on main: 6-entry catalogue (`materials.ts:3-63`); shared/unique + Make Unique (`material-resource-mutator.svelte.ts:193-231`); single-select Inspector (`EditorMaterialInspector.svelte:19-24`); no tint override; roughness/metalness + one map override only; repeat path read-only (`materials.ts:79-86`, `defaultTileSizeMeters`); resolver copies currently byte-identical (`scene-instance-material.ts:65` editor + museum); parity remains an acceptance requirement.

## R7 — B4 lighting + environment maturity

Audit current Scene lights and renderer/environment seams. Decide the minimum for:

- core authored light types/properties;
- selection/pick proxies and 3D handles;
- Inspector synchronization;
- useful lighting/environment preset(s);
- HDRI/environment consumption from P24A;
- exposure/environment semantics only where the current renderer can own them cleanly;
- visitor parity and editor-only helper isolation.

### R7 candidate hypothesis — 2026-09-09 (NOT frozen; depth decision requires the bounded evidence below, frozen only in R9)

Evidence basis: `SceneLightEntity` point/spot/directional + fixed -Z aim + 0.12m proxy (`editor-lights.ts`, `EntityLight.svelte`); fixed ambient+directional rig with no authored environment (`MuseumScene.svelte` both apps); P24A HDRI supply still absent (R1). No new direct-reference study needed unless a concrete lighting-interaction question survives the post-F0 recheck.

- Keep `SceneLightEntity` point/spot/directional authority; no second light-gizmo system — handles compose with the existing TransformControls.
- Candidate minimum, inclusion still R9: range visualization (point), cone/direction handles (spot), pick proxies, explicitly labeled degree-presented spot angle (canonical radians), one gallery preset as ordinary Scene ops (no persistent rig). HDRI/environment inclusion additionally requires P24A supply and runtime readiness.
- Per-light `castShadow` remains authored Scene state; shadow-map resolution/bias/quality policy remains renderer/system-owned with safe defaults and warnings. No per-light shadow-map tuning in the minimum. Environment intent and tone-mapping ownership follow the ratified boundary below.
- Units: preserve existing intensity values and direct renderer mapping; document actual units per light (point/spot: candela). Accurate labels do not require lumen conversion, a photometric authoring system or color temperature; those remain follow-up.
- Canonical spot angle is the renderer's half-angle in radians. Degree presentation must distinguish half-angle from full aperture. Current Inspector/mutator/codec validation accepts up to π; reconcile with Three's supported maximum half-angle of π/2, with explicit treatment of existing out-of-range values. Never silently reinterpret or clamp saved data; this is an existing mismatch, not an upgrade regression.
- Native light-helper geometry is a preferred implementation primitive for already-selected capabilities; it does not independently expand the minimum. Helpers remain editor-only, with handles using Museum's existing operations/gizmo/history. PointLightHelper is not a range volume; unlimited Spot lights need bounded editor presentation.

Code-verified on main: 3 light kinds, fixed -Z aim, 0.12m proxy (`EntityLight.svelte:17-54`); 2.5m drop (`editor-lights.ts:23`); radian-only angle UI (`EditorLightInspector.svelte:140-146`); fixed ambient+directional environment rig in both `MuseumScene.svelte` copies (authored `SceneLightEntity` lights render in addition). Refinements: per-light `castShadow` already exists (`editor-lights.ts:91`) — only map-level controls are absent; existing lighting presets are session viewport-only (`editor-store.svelte.ts:181-197`), not Scene ops.

### Ratified global environment architecture — inclusion remains R9

If authored environment enters the P24 minimum, its semantic model is global Scene-level intent: asset reference, lighting intensity, Y rotation, background mode and optionally authored exposure.

Native Scene environment/background controls and PMREM provide the rendering
primitives. Threlte already supplies AgX tone mapping and sRGB output; tone-mapping
choice stays system-owned, initially preserving AgX. Per-room environment blending
remains follow-up. This closes architecture, not minimum inclusion or schema.

Asset identity/bytes remain registry-owned, authored intent Scene-owned, and PMREM
or future GI caches renderer-derived. Exact schema, optional authored exposure,
asset resolution, lifecycle and Preview/Publish parity require joint reconciliation.
Object3D disposal remains the conditional implementation recheck above; scoped
caches/refcounts/async cancellation are not replaced.

A selected gallery preset must define interaction with the fixed ambient/directional
baseline and editor assist lighting, avoiding hidden extra lighting. Preserve legacy
appearance through an explicit compatibility policy. Presets create/update ordinary
authored Scene lights and any selected environment state, never a persistent rig.

## R8 — B5 final presentation reconciliation — COMPLETE 2026-09-10

Authoritative post-F0 result: [R8 presentation reconciliation](reconciliation/2026-09-10-P24-R8-presentation-reconciliation.md). Current-code gaps, minimum presentation conditions, optional polish exclusions and implementation acceptance are recorded there. R3–R7 retain behavioral ownership; R9 retains inclusion. The pre-F0 evidence below is superseded where it conflicts; “Fixed” below was a requirement, not implementation completion.

### Decided presentation rules (code-verified on main)

- Derived ghost/proxy only: Plan footprints (`plan-scene-footprint.ts:53`, live `$derived` in `LayoutPlanViewport.svelte:234-250`), 3D placement ghosts (`placement-ghost.ts/svelte`, `userData.role='placement-ghost'`, `raycast=()=>null`, disposed never serialized), Plan overlays (`plan-overlays.ts:20-25` transient), and gizmo pivots/proxies (per-mount, disposed) are never written to the document; Scene schema + canonical serializer carry authored leaves only (`scene.ts:400-414`, `scene-codec/canonical.ts:137-228`). Restated invariant: no handle/helper/ghost/preview state persists.
- Selected-but-ineligible: entity stays selected, loses unsupported handles, with reason shown (`stagingSelectionMessage` + `role=status` warning in Plan viewport and Inspector badge `Plan transform/Read-only`; context-menu and delete routers carry the same reason). This extends the ratified R3/R4 constraints.
- Handle vocabulary: Plan stages X/Z/yaw only (adapters preserve Y/pitch/roll/scale; `plan-scene-transform.ts:56-124`); 3D keeps full translate/rotate/scale. Divergence is an intentional subset, not inconsistency.
- Preview/commit agreement: pending placement, Plan staging gestures (`previewSceneGesture`/`commitSceneGesture`/`cancelSceneGesture` with immutable baselines), and gizmo drags (transient preview, single-history commit, cancel rollback) all keep preview distinct from committed state. Final displayed preview and committed result must agree (R4).
- Inspector/Outliner sync: shared selection identity, commit-only numerics (`EditorNumberField` draft/commit/Escape), single-select panels; multi-select shows Duplicate/Delete + session placement only.
- Feedback baseline: no-floor-below, ineligible/cluster staging, geometry warnings (`role=alert`), and blocked deletes already surface with reasons. Density/readability treatment exists (group headers, filters, empty states, sectioned Inspector).
- Discoverability rule: disabling a control without a reason is a defect. Known uneven spots (toolbar `toolDisabled`, inert outliner rows) are polish backlog for the R9 inclusion decision, not new-framework work.
- Experience rule/event/reference diagnostics belong to P25 authoring test lenses (E5), not P24. Scene/asset integrity diagnostics are a separate optional R9 choice below; legacy `roomId` diagnostics wait for the post-F0 recheck.

### Fixed pre-F0: silent-skip → warn

Partial drop-to-floor (warns only when `groundedCount===0`), partial cluster duplicate (`continue` with no status), and selection-blocked Plan clicks (reason only in context-menu path) must produce a status/warning instead of failing silently. Footprint-builder skips for intentionally non-projected entities (lights) stay silent by design. Scene/asset integrity diagnostics (dangling `assetId`) are an R9 inclusion decision; legacy `roomId` diagnostics wait for the post-F0 recheck.

### Left for R9 (not F0-dependent)

Bulk transform/material multi-edit, Scene/asset integrity diagnostics surface, and the disabled-without-reason polish backlog: include in minimum or defer as depth tail.

## Pre-F0 R9 freeze packet — DRAFT (not a freeze; R9 stays open until the post-F0 recheck)

### A. Product choices resolved pre-F0 (no F0-dependent seam; R9 only decides minimum inclusion)

- R5: one-host/no-second-gizmo authority; Inspector↔gizmo commit sync polish; snap-winner feedback polish (no new framework); flat non-nested cluster concept; duplicate collision/bounds check + silent-skip→warn; align/distribute semantic direction (exact op set + frames at R9/post-F0); Local/World wire direction with no stored state.
- R6: shared/unique model, no slot/UV/graph; tint override; PBR map set on definitions; physical tile scale via existing repeat path; Apply-to-multiselection; shared/unique preview feedback; per-addition editor/visitor parity as acceptance requirement.
- R7: `SceneLightEntity` authority, no second light gizmo; range/cone/pick feedback candidates use native helper geometry only as a preferred primitive for selected capabilities; explicit spot half-angle/degree semantics and out-of-range compatibility decision; existing intensity values retained with accurate units; `castShadow` authored, map policy system-owned; temperature deferred. Global Scene environment architecture is ratified conditionally; inclusion and optional authored exposure remain R9. Tone mapper system-owned, initially AgX; preset baseline/legacy behavior must be explicit.
- R8: all presentation rules above; silent-skip→warn fixes.

### B. Decisions pending post-F0 recheck (decided at R9, after R0 gate item 7)

- Selection-Center pivot rigidity in the project/world frame; multi-selection Local frame semantics.
- Align/distribute reference-frame behavior; duplicate re-ground support source; cluster/workspace Room-context removal for canonical world-local Scene.
- Plan projection/transform integration with the world-local identity-frame path; retain inverse-resolve only for explicit legacy compatibility rather than treating its removal as a goal.
- Canonical Scene placement/selectability against wall-first Layout support/surface queries; no persistent Layout/Scene support dependency by default.
- P24A import consumption; cold static-model source authority; selected-capability cold-visitor parity (R1). P23.1 shared project codec now accepts wall-first/world-local, so there is no separate P24A persistence-format cutover blocker.

### C. R9 inclusion decisions (not F0-dependent; include-in-minimum vs depth tail at freeze)

- Bulk transform/material multi-edit; Scene/asset integrity diagnostics surface; disabled-without-reason polish backlog.
- Exact align/distribute op set beyond the R8 rules.
- Authored environment inclusion and optional authored exposure; global Scene architecture is ratified, schema/runtime readiness remains open.

### Three experiments / depth tails — not minimum prerequisites

| Disposition | Candidates |
|---|---|
| Non-blocking P24 experiments | WebGL LightProbeGrid; SunLight only with a relevant sunlight fixture; native pivot |
| Benchmark only for a demonstrated need | Compression, simplification/LOD, batching, GTAO, integrated WebGL effects |
| Follow-up | Area lights, broader HDR formats, IES |
| Post-P25 renderer/asset platform | WebGPU migration, clustered lighting, SSGI/VXGI, Gaussian splats, progressive streaming |
| Excluded from P24 minimum | Node-material authoring, Three scene persistence, replacement navigation/selection systems |

None becomes a P25 prerequisite. HTMLTexture does not change the accepted semantic
DOM Info Panel direction. Harvest §G supplies bounded experiment proposals, not an
instruction to run them all or automatically adopt its numerical budgets.

### D. Remaining R9 gate checklist status

1. Minimum P24A+P24B set — open (packet A is input, not the freeze).
2. Depth tails separated — open.
3. Final maturity matrix — **R2 post-F0 baseline complete 2026-09-10**; final pass still occurs at freeze.
4. Operation/history ownership per capability — open.
5. Plan/3D acceptance — themes + R3/R4/R8 rules done; fixtures at freeze.
6. Save/Load + P22 acceptance — open as capability acceptance; basic wall-first/world-local format persistence is closed by P23.1, while static-model source authority and selected material/light/environment parity still need proof.
7. Post-F0 seam recheck — **R0 delta refresh, R1, R2 and the R3/R4 behavioral contracts are complete 2026-09-10**; selected P24 placement/selection/support-query implementation checks plus cross-view cancel-on-switch wiring remain named blockers before R9 freeze.
8. Renderer/dependency baseline + acceptance definition — open; conditional upgrade comparison, no r186 pin.
9. Child plans + owner review — last.

## R9 pre-freeze closeout — DRAFT (not a freeze; no child plans; no schema/API/code changes)

Consolidates the pre-F0 packet into freeze-ready input. Legend: [F0-FREE] resolved pre-F0 · [POST-F0 RECHECK] blocked on F0 seam recheck · [R9-PICK] F0-independent inclusion call at freeze.

### 1. Final capability maturity matrix (draft; R2 post-F0 refresh is the current baseline, and R9 still owns the final inclusion pass)

The R2 matrix above is the current source for live capability maturity. This R9 draft retains only freeze-oriented dispositions; it must not reintroduce pre-F0 Room-local behavior as current truth.

| Capability | Verified current baseline | Disposition | Remaining freeze question |
|---|---|---|---|
| Selection / multi-select | Ordered canonical reducer/identity exists; partial roomless orchestration exists but live workspace/selectability remains Room-gated for canonical roomless Scene | KEEP system; remove Room gate | R4 fixtures + canonical selection integration |
| Transform / pivot | One shared Scene gizmo/transaction authority; world-bounds-center pivot; numeric Inspector; Local/World UI state exists but Scene policy is world-only; independent scale is session-rich but scalar-persisted | KEEP authority; POLISH/DEEPEN only selected R5 depth | Local frame/pivot choice; per-axis persistence only if selected |
| Align / distribute | No Scene operators found | Candidate deterministic Scene ops only | Exact op set is an R9-PICK; no generic framework |
| Duplicate | Deterministic +0.5 XZ, one transaction; full selected clusters copy | KEEP operation | Collision/bounds/re-ground + partial-cluster warning if included |
| Groups / clusters | Flat schema permits roomless clusters; live editor CRUD/select remains same-Room/`roomId`-dependent | KEEP flat/no nesting; remove Room ownership | Any extra group pivot/Inspector depth is R5/R9-PICK |
| Box selection | No Scene box-selection path found in R2 audit | FOLLOW-UP | Do not promote from absence alone |
| Visibility / lock | No authored Scene visibility/lock fields found in the current Scene schema | FOLLOW-UP | Do not promote from absence alone |
| Placement / grounding | One pending pipeline + 5-ray tagged-floor grounding exists; creation still writes Room context and support lookup is renderer-tag based | KEEP pipeline; canonicalize writes + support query | Exact support surfaces/ambiguity behavior through R3/R9 |
| Replacement | No current replace-asset semantic operation found | FOLLOW-UP unless R9 proves minimum value | Preserve placement through normalized metadata if later selected |
| Placement entry points | Models place through Library selection → Inspector; shapes/lights arm from Library | POLISH only | Shared Plan placement entry after R3 if selected |
| Snapping | Existing Plan/3D snapping + modifier bypass; Local/World state exists; no winner feedback/align ops | KEEP seams | Exact feedback/productivity ops at R5/R9 |
| Materials | Six definitions; multi-slot PBR definition model; shared/unique instances; base texture + roughness/metalness Inspector | KEEP model | Tint/tile scale/multi-apply/P24A consumption only if selected |
| Lights | Point/spot/directional authority + Inspector + pick proxy + authored castShadow; creation still Room-coupled | KEEP authority; no second gizmo | Room-free creation, angle semantics, selected helper/preset depth |
| Environment | System/runtime ambient+directional/fog/background only; no authored Scene environment | Conditional global Scene architecture | Inclusion + optional exposure are R9-PICK |
| Outliner / Inspector | One hierarchy/Inspector architecture exists, but wall-first `buildUnifiedProjectTreeModel()` returns no room rows, so canonical world-local Scene entities/clusters are not surfaced there; single-object editors remain live | KEEP surfaces; adapt existing hierarchy | Wall-first/world-local Scene surfacing; bulk/cluster/discoverability polish only if selected |
| History | One chronological Scene/Layout stack with atomic transaction/cancel/no-op/rollback behavior | KEEP canonical history | Capability-specific owner/fixture pins only |
| Editor / visitor boundary | Visitor isolation stable; shipped-static validation/retention exists; actual static model load URL still comes from live catalogue | KEEP boundary; fix static source authority | Selected capability parity; dynamic GLB FOLLOW-UP |
| P24A supply | Normalization/rights/OBB evidence + frozen 12-object static-first proof set; dynamic GLB deferred | Evidence complete; static-first direction closed | Source authority + corpus/runtime acceptance per R1 |

No broad direct-reference survey is needed. The current R2 audit plus completed bounded harvests are enough to proceed. Later R5/R6/R7 work should inspect external references only if a concrete interaction/compatibility question remains after reading live Museum code.

### 2. Deterministic operation / history ownership matrix (draft)

One completed gesture = one history entry; cancel/no-op = none. All Scene ops target `SceneDocument`; acquisition workflow state never enters `SceneDocument` or editor undo.

| Semantic operation / current seam | Owner | Inputs | History | Sensitivity |
|---|---|---|---|---|
| Place asset [conceptual]; current `beginAssetPlacement` / `createPendingPlacementAt` seam | Placement pipeline (`pendingPlacement*` → commit) | asset id + pose intent | One entry on commit | Canonical Scene format + Room-free support/Y resolution [POST-F0 RECHECK] |
| Scene transform gesture → gizmo/Plan adapter → begin transaction → transient preview → `updatePlacementTransform*` at commit → one `commitDocumentTransaction` | Scene 3D gizmo adapter + Scene Plan gesture adapter + `editor-store` transaction | entity ids + owned components | One entry; no-op none | Local/World and selected R5 depth; world-local Plan adapter math already stable |
| Inspector transform edit → `commitPlacementTransform(id, transform)` | `editor-store.commitPlacementTransform` | single entity id + transform | One entry | Sync foundation already live; selected polish only |
| `duplicateSelection` | `placement-cluster-mutator` | selection set | One entry; partial cluster currently copies ungrouped without warning | Re-ground/warn depth [R5/R9] |
| `createCluster(name?)` / `deleteCluster` | `placement-cluster-mutator` on `SceneDocument.clusters` | member ids + optional name; schema roomless-capable, live mutator still requires same Room | One entry | Canonical Room-free cluster CRUD/select [POST-F0 RECHECK] |
| Align / distribute (new) | Deterministic Scene ops if selected | entity set + mode | One entry each | Exact set [R9-PICK] |
| `replaceSceneAsset` (new, no current seam) | Scene op via normalized metadata if selected | entity id + asset id | One entry | FOLLOW-UP unless promoted at R9 |
| `applyMaterialPatch` / `makeMaterialInstanceUnique` | `material-resource-mutator` via `store.requestMaterialEdit` | entity/material ids + patch | One transaction per logical edit | Selected R6 breadth only |
| Light authoring; current `beginLightPlacement` / `createPendingLightAt` / `updateLightFields` seam | Existing Scene light mutators | kind + props | One entry per logical edit | Canonical Room-free create + selected R7 helpers/preset depth |
| Environment edit / selected gallery preset [conditional; conceptual, no API/schema freeze] | Scene semantic operations; registry owns referenced asset bytes | Global environment intent + optional exposure only if selected | One entry per logical authored edit/preset; cache generation/update produces none | Inclusion [R9-PICK]; schema/runtime if selected |
| P24A acquire / normalize / approve | Pipeline-owned lifecycle, not editor undo | source + recipe + rights evidence | Promotion gated by acceptance, never half-approved | static registry/runtime acceptance [R1]; no editor history |

No mixed Layout/Scene transaction and no persistent cross-document support reference without a separately specified ownership/delete/history contract (umbrella invariant; addendum entity-ownership rule).

### 3. Museum-owned acceptance fixtures (draft)

- F1 same-ID Plan/3D mutation: place in 3D → move X/Z + yaw in Plan → Y/pitch/roll/scale preserved; one entity identity throughout. [R3 fixture; projection/adapter math already stable]
- F2 Plan-ineligible-but-selected: select a light in 3D or Outliner → switch to Plan → selection persists, no transform handles, `Not editable in Plan` reason shown in viewport + Inspector badge.
- F3 view-switch cancel: mid-drag placement/transform + switch view → gesture cancelled, no history result, committed state untouched.
- F4 preview/state consistency: ghost/proxy/overlay treatment never appears in serialized `SceneDocument`.
- F5 preview/commit agreement: final displayed preview equals committed result for one staging gesture.
- F6 one-handle-drag-one-history: single yaw-handle drag → exactly one history entry; failed/no-op drag → none.
- F7 duplicate-then-move: +0.5 XZ clone, collision/bounds checked, one entry; partial-cluster duplicate warns. [re-ground depth if selected]
- F8 material assign + Make Unique: shared edit prompts choice; unique clone `-copy`; editor authored output, Preview and Publish resolve materials consistently on the selected renderer baseline. Review expected BRDF/PMREM differences separately if the baseline changes.
- F9 light authoring: create point/spot → Inspector sync (explicit half-angle/degree semantics, supported range and existing out-of-range policy, `castShadow`) → visitor renders same lights with no helpers. Verify finite/unlimited range feedback and no second gizmo authority.
- F10 Save/Load + cold visitor: staged Scene/materials/lights and, if selected, global environment/optional exposure survive round-trip; referenced assets remain retained/resolvable. Cold visitor and Preview consume the same canonical meaning with no editor-only state. [asset resolution + selected-capability parity]
- F11 gallery preset: reset replaces all authored lights/environment after an explicit warning, in one Scene transaction with no persistent rig or preset provenance. Verify reset after user edits/additions and Save/Load, cancellation/failure atomicity, exact undo/redo, removed-light reference cleanup and non-light preservation. Verify explicit baseline/assist-light interaction and legacy appearance policy; environment remains conditional on R9 inclusion.
- F12 explicit support choice: ambiguous stacked surface forces a visible choice; never silent `Y = 0`. [R3/R9]

- F13 renderer/dependency acceptance [baseline selected at freeze; additional comparisons if upgraded]: use harvest §F dimensions for package/types/Threlte compatibility, editor gestures, material/light/shadow output, accepted assets/decoders, context recovery, visitor isolation, disposal and performance. Test only selected capabilities/formats; calibrate proposed numeric thresholds on named devices/fixtures before ratifying them. Include PCFSoft→PCF behavior, BRDF/PMREM/environment rotation changes and Object3D/Threlte disposal interaction as applicable. Explicitly investigate the post-r186 point-shadow disposal fix on the exact candidate baseline; later fixes cannot be assumed present. Failure requires a verified compatible baseline/fix or deferral, not an automatic r186 upgrade.

## R9 — B6 minimum freeze / child-plan gate

Only after R0–R8 have enough evidence:

1. freeze the **minimum useful P24A + P24B capability set**;
2. separate optional depth tails from ship gates;
3. record the final capability maturity matrix;
4. define deterministic operation/history ownership for every included capability;
5. define Plan/3D acceptance where both views participate;
6. define Save/Load + P22 visitor acceptance;
7. consume the completed R0/R1/R2 refresh plus the closed R3/R4 behavioral contracts, and close the named capability-specific placement/selection/support-query implementation rechecks plus cross-view cancel-on-switch wiring before freezing any affected child plan;
8. select the conditional Three/types/Threlte renderer/dependency baseline and define its acceptance gate (F13); an upgrade is separately scoped, not implied by the harvest or required for already-available capabilities. Record required compatibility/visual/lifetime/performance proof as an implementation ship gate; no changed baseline enters production until it passes;
9. then update/write implementation-ready P24 child plans and request owner review.

This planning gate is closed by the linked R9 record; P24.0–P24.5 briefs now exist. Their implementation acceptance is not yet passed.

## Required acceptance themes for the eventual P24 minimum

Start from Pascal harvest §7 candidate fixtures 1–6 (same-ID Plan/3D mutation with Y/pitch/roll/scale preservation; Plan-ineligible-but-selected; view-switch cancel with no history; preview/state consistency; preview/commit agreement; one-handle-drag-one-history with failure/no-op safety) and rewrite each as a Museum-owned fixture; do not port Pascal machinery.

The final minimum should prove, for the capabilities actually selected:

- one canonical Scene entity identity across Plan and 3D;
- selection continuity across views;
- Plan preserves transform components outside its authority;
- explicit support/floor placement height;
- cancel/no-op has no history result;
- one completed gesture has one deterministic history result;
- PlanProxy/3D representation derive from canonical asset/entity state rather than competing persisted truth;
- Save/Load preserves authored state;
- cold visitor runtime renders the same canonical Scene meaning without editor-only state;
- LayoutDocument/SceneDocument ownership remains separate;
- no second navigation/camera-motion system appears.

## Exit condition

This reconciliation is complete when P24 can answer, with current-code evidence:

> What is the smallest useful Stage capability set worth implementing after P23, which existing Museum systems remain authoritative, exactly what must deepen, and which external patterns are useful only as fixtures or study material?

At that point P24 may move from umbrella/research reconciliation toward implementation-ready child plans. Until then, capability lists remain hypotheses rather than tickets.