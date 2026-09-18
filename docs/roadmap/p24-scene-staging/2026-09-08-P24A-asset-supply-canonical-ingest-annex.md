# P24A — Asset Supply + Canonical Ingest annex

**R9 closeout (2026-09-10):** [Minimum freeze](reconciliation/2026-09-10-P24-R9-minimum-freeze.md) is the current inclusion/maturity/operation/acceptance authority; [P24.0–P24.5 child briefs](slices/2026-09-10-P24-minimum-child-plans.md) are implementation-ready for owner review. Earlier draft/pending-minimum wording below is superseded by R9. Source rechecks are closed as planning evidence; implementation and runtime ship gates remain open. P24 remains proposed; execution waits for the accepted P23 minimum and approval.


**Ratified cross-view direction:** [Unified Plan / 3D authoring addendum](../p23-layout-depth/2026-09-09-P23-P24-unified-plan-3d-authoring-addendum.md) — read alongside this plan for entity-owned mutations, selection continuity, gesture cancellation and PlanProxy/placement ownership. Existing scope, status and dependency gates remain unchanged.  
**P24 reconciliation sequence:** [2026-09-09-P24-reconciliation-sequence.md](2026-09-09-P24-reconciliation-sequence.md)

**Created:** 2026-09-08  
**Parent:** [P24 — Scene / Staging Depth umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md)  
**Status:** `minimum frozen — implementation pending` — R1 evidence and R9 planning reconciliation complete; P24.1 executes the static-first supply minimum under the child dependencies.
**Tracker:** P24 remains the registered plan number. `P24A` is an umbrella-internal label, not a new tracker number.  
**Planning model:** child seed of the [P24 umbrella](2026-09-08-P24-scene-staging-depth-umbrella.md) — implementation detail preserved here; evidence (Phase 2 research + the readiness reconciliation) informs but never overrides the umbrella contract.

## Research basis

Reviewed against live `main`:

- `docs/roadmap/p24-scene-staging/research/deep-research-exact-asset-compact.md`
- `docs/roadmap/p24-scene-staging/research/museum-editor-phase2-acquisition-manifest.json`
- shipped P20 project asset registry/R2 contracts;
- current `Asset`, `AssetFootprint`, manifest and placement seams;
- P22 publish/visitor-runtime resource-resolution contract.

Supplemental closed evidence for the Plan/3D representation seam:

- `docs/roadmap/p24-scene-staging/research/Pascal-editor-harvest.md` — CLOSED at pinned revision `32c3c8a24dae17c55beaabf45029148900a3b409`; useful for same-identity 2D/3D representation and Plan-eligibility fixtures only. It does not authorize Pascal's generic node registry, scene model, history model or per-instance proxy ownership.

Phase 2 is specific enough to stop broad asset-source discovery. It recommends a first acquisition wave from **Poly Haven + Kenney Furniture Kit + a small attribution-aware Sweet Home 3D subset**, with a coherent **Poly Haven + ambientCG material set**, **Poly Haven HDRIs**, glTF normalization around **glTF Transform** plus measured `gltfpack`/meshoptimizer use, and **Kenney + Sweet Home 3D** as the first PlanProxy benchmark corpus.

The research JSON's 32-object Wave 1 is an **acquisition backlog**, not the P24A ship gate.

### Research closure vs implementation readiness

The **broad source-discovery gate is closed**. P24A does not need another general survey of asset sites, model repositories, material libraries or HDRI providers before planning can continue.

The bounded implementation-readiness reconciliation is also now complete. It was run against the shipped post-F0 world-local contract, current P20/P22 persistence/runtime code, the existing normalization/proxy evidence and the selected Phase 2 source/tool set. R1 resolves the architecture/readiness questions below; it does **not** implement P24A or waive R9 minimum freeze.

The readiness pass inspected the current end-to-end asset path, including:

- built-in `Asset` catalogue / manifest behavior and `AssetFootprint` generation/consumption;
- current model loading and Scene asset references;
- P20 project asset registry + R2 ownership/storage boundaries;
- current image/texture registry path and what can genuinely be reused for models;
- P22 release-resource resolution and cold visitor behavior;
- Scene Save/Load model references;
- current material definitions, texture resources and visitor material resolution;
- current Plan footprint/proxy behavior;
- editor/visitor bundle isolation.

It also verified the exact external tools/sources already selected by Phase 2 rather than reopening broad discovery. glTF Transform remains the primary normalization seam; Khronos validation remains a hard QA input; meshoptimizer/`gltfpack` remains benchmark-first; the selected Poly Haven/Kenney/Sweet Home 3D and ambientCG sources remain the acquisition authorities described by the checked-in evidence.

The same maturity rule used by P24B applies here:

> Existing asset infrastructure is not automatically product-complete because a registry, loader or catalogue seam has shipped; external tooling is not automatically better because Phase 2 recommends it. Preserve canonical Museum Editor ownership, identify the concrete pipeline gap, then extend only the seam that needs depth.

### R1 readiness finish — 2026-09-10

**Decision 1 — world-local placement/proxy meaning is ready.** `SceneModelEntity.assetId` remains the placed semantic identity. `AssetFootprint` remains asset-definition metadata relative to the normalized asset pivot; no per-instance PlanProxy record is added. For canonical world-local Scene entities, Plan projection applies effective scale + entity yaw + project/world X/Z directly; the optional `roomId` frame branch remains compatibility-only. The current Plan projection code already supports this identity-frame path, so P24A does not need another projection model.

For the static-first furniture proof set, the existing `furniture-floor` normalization recipe (`center --pivot below`) establishes the floor-contact pivot. Treat its normalized floor-contact offset as **0** for that recipe; keep the explicitly recorded `unitScaleToMeters` / current calibrated `defaultScale` semantics until a separately verified metre-baking rule replaces them. Wall/ceiling/stacked-surface contact metadata is not inferred from this floor recipe and is not required to prove the first furniture corpus.

The remaining Room coupling in live Stage **creation/selectability** is therefore an integration blocker, not an unresolved P24A supply model: P24A must reuse the single Scene placement operation once that path authors canonical world-local entities. It must not create a second asset-specific placement system to work around the editor seam.

**Decision 2 — static-first model delivery is the P24A minimum.** The minimum does not require uploaded/provider GLB ingestion. Each accepted Wave-1 model keeps one stable logical `assetId`; Scene Save/Load persists that identity plus fallback/transform/material state, never a provider URL, static path, signed URL or R2 key. The normalized GLB and its asset-definition metadata are added through the checked-in/static supply path and the append-only shipped-static compatibility registry.

Static model durability has one concrete implementation requirement before acceptance: cold visitor model **source resolution must use the shipped-static compatibility mapping as release authority**, not only validate the `assetId` there and then load the URL from the mutable live catalogue. Current `visitor-cold-runtime.ts` validates models through `getShippedModelByAssetId`, but `VisitorEntities` → `AssetModel.svelte` still resolves `productionFile` through `getAsset(assetId)`. The child plan must close that drift with one visitor-safe model-source resolver/shared seam; it must not add a visitor dependency on editor stores or a second model renderer.

For every accepted static model addition:

- append its stable `assetId` → retained production-file mapping to the canonical shipped-static registry and bump the registry version;
- retain the referenced deployed file for already-published releases;
- prove the file exists in production/static output and that cold resolution does not depend on the current editable catalogue entry;
- if stable shipped-static retention cannot be proven in the deployment topology, fall back to P22's already-ratified rule: copy/pin those required bytes into release-controlled delivery storage rather than weakening release durability.

**Decision 3 — P22 pinning has two explicit model cases.** Built-in/static P24A models use the existing append-only shipped-static retention contract; they do not need a duplicate per-release R2 hash pin when stable retention is proven. Future project/upload/provider models, if later selected, must extend the existing P20/P22 byte path and be release-pinned exactly as durable project assets are: immutable release membership plus object identity, SHA-256, MIME and byte size, then version-qualified cold delivery.

That future project-model path is **DEFERRED from the static-first P24A minimum**. Current P20 is intentionally texture/procedural-only: API/editor asset kinds exclude `model`, MIME accepts images only, upload validation sniffs images, and the public release client verifies only PNG/JPEG/WebP bytes. A later dynamic-model slice must extend those existing seams coherently (`kind: 'model'`, canonical GLB MIME/validation, project/release-scoped model source resolution) instead of inventing a parallel registry. Scene still stores the stable asset identity, not delivery coordinates.

**Decision 4 — model Save/Load semantics and current cloud format acceptance are sufficient; end-to-end proof remains.** The Scene codec already round-trips model `assetId`, fallback, transform and material-instance reference. P23.1 shipped on `main` via PR #9 (`d5ec0df`) and widened the shared project codec so `validateProject()` accepts explicit wall-first Layout + world-local Scene, and live `captureValidatedSaveSnapshot()` / `loadProject()` already flow through that shared codec. P24A therefore needs no model-specific serializer and no separate project-persistence codec cutover merely to persist a static-model identity. This does **not** mean the editor Scene-format authoring lifecycle is closed: `createEmptyProject()` still boots a legacy-compatible Scene without `formatVersion`, and live mutation policy still permits legacy-room-local Scene mutation. Before any world-local/no-`roomId` Stage write, reachable canonical authoring must therefore ensure the Scene is `formatVersion: 1`, or explicitly adapt legacy mutation without mixing coordinate meanings. The P24A implementation gate still must prove a real world-local model Save → Load round-trip.

**Decision 5 — cold visitor coordinate preparation is closed; capability delivery remains to prove.** F0's shared `prepareCompatibleRuntime()` already gives Preview and cold visitor the same world-local coordinate meaning. P24A must not reopen coordinate migration. The remaining P24A visitor proof is resource-level: selected static models resolve through the shipped-static authority, required files are retained, selected material/HDRI dependencies resolve, and no editor-warmed/global source state is required.

**R1 implementation blockers allocated by R9 to P24.0–P24.4 (all runtime gates remain open):**

1. shared Stage placement/selectability must stop requiring Room ownership for canonical world-local Scene, **and reachable canonical authoring must ensure the Scene is `formatVersion: 1` before world-local Stage writes occur; legacy Scene mutation remains compatibility-only or must be explicitly adapted without mixing coordinate meanings**;
2. cold static-model rendering must take its production source from the shipped-static compatibility authority rather than the mutable live catalogue;
3. the selected floor/support placement operation still needs the shared P24 support/surface resolution contract for Y/ambiguity; P24A's floor-normalized pivot does not replace that Layout query;
4. P24A.3–P24A.6 execution still has to acquire/run the frozen proof corpus and bounded material/HDRI supply through the decided pipeline and acceptance fixtures, including real Save/Load + cold-visitor model delivery proof.

These are implementation/reconciliation blockers, not missing broad research. Dynamic project/upload/provider GLB ingestion is a deferred depth path and does **not** block the static-first P24A minimum.

## Outcome

P24A proves one deterministic route from external reusable content to canonical Stage supply:

```text
source / provider / pack
        ↓
acquisition candidate + rights evidence
        ↓
validation + normalization
        ↓
canonical web derivative + metrics + preview
        ↓
PlanProxy / AssetFootprint where eligible
        ↓
approved reusable asset identity
        ↓
Scene placement + Save/Load + P22-compatible visitor resolution
```

Furniture/models remain Scene assets. Downloadable doors, windows, stairs and other structural meshes do not become Scene-library architecture merely because they exist; structural meaning remains `LayoutDocument`-owned or procedural where appropriate.

## Hard ownership rules

- `SceneDocument` owns placed Scene semantics, not acquisition workflow state.
- Project asset registry owns durable project asset identity/provenance/storage metadata.
- R2 owns bytes, never semantic project structure.
- Built-in/upload/provider sources converge on one accepted asset-resolution model; source identity remains provenance.
- Do not persist Three.js objects, GPU resources, provider URLs, signed URLs, R2 keys or conversion-session handles as authored truth.
- Do not turn the current `Asset` catalogue type into a dump of registry/database/acquisition state.
- Preserve visitor/editor isolation and P22 cold-runtime resolution.
- Preserve Scene selection/history, Threlte patterns and one transform authority.
- Consume the coordinate/ownership model actually shipped by P23; current Room-local Scene transforms are baseline evidence, not a permanent P24 invariant.

## P24A.0 — Acquisition and provenance contract

Define a pipeline-owned lifecycle separate from placed Scene truth. Exact type names are implementation details, but the boundary should resemble:

```text
AcquisitionCandidate
  ↓ validate / normalize / review
NormalizedAssetRevision
  ↓ approve
AssetDefinition / project asset identity
  ↓ place
SceneObject
```

Acquisition metadata may include provider, pack, source asset ID, source URL, source/content hashes, creator, source license, rights confidence, attribution requirements, acquisition date, conversion recipe and import status.

Use the research rights gate:

```text
A — explicit rights, low ambiguity
B — usable with explicit conditions/attribution
C — manual/legal review required
D — not suitable for bundled standard library
```

Unknown/unresolved rights cannot silently promote to Approved. Repository code licenses do not prove rights for bundled media. Retain dated source/terms evidence where it materially establishes redistribution rights.

## P24A.1 — Deterministic normalization pipeline

Build a repeatable CLI/job, not a per-asset manual Blender ritual.

Required stages:

```text
acquire + hash
→ validate
→ normalize units to metres
→ normalize +Y/up + canonical orientation policy
→ normalize pivot / ground contact by placement semantics
→ preserve physical dimensions
→ prune/deduplicate only where safe
→ optimize mesh/textures where measured useful
→ emit canonical GLB/web derivative
→ collect metrics
→ generate thumbnail/preview
→ generate/validate PlanProxy when eligible
→ write provenance + conversion metadata
→ promote only after acceptance
```

Primary public references agents may inspect:

- glTF Transform / existing `@gltf-transform/cli` for deterministic glTF processing;
- Khronos glTF Validator + Sample Assets for validation/QA fixtures;
- meshoptimizer / `gltfpack` for measured Meshopt/KTX2/optimization value;
- `pmndrs/assets` for browser packaging/derivative-size patterns only;
- Objaverse-XL processing scripts for batch validation/rendering patterns, not dataset harvesting.

Do **not** normalize every object to a unit box. Real scale is part of placement semantics and future agent vocabulary.

## P24A.2 — PlanProxy pipeline

Phase 2 proxy labels are pipeline strategies, not new runtime Plan entity types:

```text
generated-obb
generated-silhouette
existing-topdown
existing-planIcon
manual-review
```

Accepted Plan-eligible assets must resolve to the existing canonical footprint contract:

```text
source model / metadata / planIcon / top-down oracle
        ↓
proxy generation + simplification + review
        ↓
AssetFootprint { width, depth, outline? }
        ↓
existing Scene Plan / Arrange rendering
```

Use the Kenney + Sweet Home 3D benchmark corpus for thin-leg, round, irregular, storage and authored-plan-icon cases. Raster/top-down assets may be reference or source hints, but do not become a parallel persistent Plan truth.

Wall art and ceiling/hanging assets may remain Plan-ineligible when a floor footprint would mislead.

The completed Pascal harvest may be used only for fixture-level evidence that one semantic item can expose derived 2D/3D representations and eligibility-specific affordances. Museum's `AssetDefinition`/`SceneEntity` split remains authority: PlanProxy belongs to asset definition metadata, not a duplicate per-instance Scene record.

Post-F0 R1 closes the coordinate question: this metadata is placement-local, while the placed Scene entity is canonical project/world-local. The existing Plan projector already treats absent `roomId` as the identity frame; legacy Room conversion remains compatibility-only. Do not bake project/world position into `AssetFootprint` or generate a second per-placement proxy record.

## P24A.3 — Cross-source proof set

Before catalog expansion, prove the same pipeline on roughly **10–12 representative assets**:

- multiple Poly Haven GLB/glTF items;
- multiple Kenney GLBs after one verified package-level scale/orientation calibration;
- a small Sweet Home 3D subset exercising SH3F metadata and attribution;
- round + irregular/non-rectangular shapes;
- an item with existing top-down/`planIcon` reference;
- at least one attribution-required asset.

Acceptance:

- source and rights evidence retained;
- source/content hashes deterministic;
- physical scale correct within explicit tolerance;
- pivot/orientation correct for declared placement surface;
- canonical derivative validates and renders through the existing Threlte/Three path;
- metrics + preview generated;
- Plan-eligible items resolve to valid `AssetFootprint`;
- attribution survives catalogue/registry use;
- failed import cannot leave half-approved state;
- rerunning the same pinned input/recipe cannot silently change semantic output.

Where research marks exact archive members unresolved, implementation must enumerate the acquired archive. Do not invent SH3F member paths or use mirrors as acquisition authority.

## P24A.4 — Canonical model registry/runtime path

This is the main repository-specific integration gap, but its minimum direction is now closed by R1.

P20 shipped durable registry/R2 support around images/textures and explicitly recorded that no viable generic client GLB import/placement path existed. P22 excludes uploaded model ingestion but already ships the visitor-safe static-model compatibility registry and retention contract. P24A therefore uses **static-first** for the minimum instead of making generic uploaded GLB infrastructure a prerequisite.

Minimum path:

```text
accepted static model identity + normalized derivative
   ↓
append-only shipped-static model mapping
   ↓
SceneModelEntity.assetId + canonical world-local placement
   ↓
canonical Scene/Project Save + compatible Load
   ↓
retained shipped-static release identity
   ↓
visitor-safe shipped-static model source resolver
   ↓
cold visitor runtime
```

Rules:

- `SceneModelEntity.assetId` is the authored identity; file/storage/provider coordinates never enter Scene truth;
- built-in/static Wave-1 definitions carry PlanProxy, pivot/grounding and provenance metadata outside the placed Scene record;
- cold visitor validation **and loading** must resolve the static model through the append-only compatibility authority, not the mutable live catalogue;
- shipped files referenced by prior releases remain retained; if deployment retention is insufficient, use P22's release-controlled byte-pinning fallback;
- live project Save/Load must consume the shared canonical/compatible project persistence seam, not a model-specific serializer.

Deferred dynamic path:

```text
accepted project/upload/provider model
   ↓
P20 registry/R2 extended with model kind + canonical GLB validation
   ↓
SceneModelEntity.assetId
   ↓
release manifest hash/size/MIME pin
   ↓
version-qualified release-scoped model resolver
   ↓
cold visitor
```

That dynamic path is a later depth slice unless R9 explicitly promotes it. It must extend the existing project asset and release systems; no separate model registry/persistence system is permitted.

## P24A.5 — Materials + HDRIs supply

Use the exact Phase 2 material/HDRI manifests as the supply-side source of truth.

P24A may provide:

- bounded Poly Haven + ambientCG PBR starter materials;
- physical-scale texture metadata where available;
- KTX2/web derivatives where measured useful;
- bounded Poly Haven HDRIs with smaller editor derivatives and higher-quality runtime derivatives;
- procedural simple PBR presets for plain glass, painted metal/plastic, matte colors and other cases where downloaded textures add little value.

Boundary:

```text
P24A: bytes + metadata + provenance + reusable definitions
P24B: assign / edit / override / environment / lighting semantics
```

P24A does not define the final material editor, light gizmos, exposure UX or lighting rigs.

## P24A.6 — Wave 1 catalogue expansion

After P24A.0–P24A.5 are green, run the remaining approved entries from the 32-object Phase 2 Wave 1 manifest through the same pipeline.

This is catalogue execution, not another architecture slice. Any item requiring bespoke unsupported runtime semantics, unresolved rights or one-off conversion behavior falls out for explicit review rather than weakening the canonical pipeline.

Deferred until later evidence/gates:

- broader FreeCAD conversions;
- Smithsonian hero scans beyond per-file verified items;
- heavy foliage before an LOD/alpha policy;
- large provider connectors;
- arbitrary assets hidden in open-source repos;
- static door/window meshes as substitutes for Layout semantics.

## Non-authoritative public references

Agents may access and study these directly:

| Concern | Reference | Use |
|---|---|---|
| Realistic models/materials/HDRIs | Poly Haven | P0 acquisition + metadata/API reference |
| Low-poly models + top-down oracles | Kenney Furniture Kit | P0 acquisition + PlanProxy benchmark |
| Spatial metadata / `planIcon` | Sweet Home 3D SH3F | P0 schema/source reference, attribution-aware |
| Materials | ambientCG | P0 complementary CC0 source |
| glTF normalization | glTF Transform | reuse current tooling where appropriate |
| Optimization | meshoptimizer / `gltfpack` | benchmark/reuse if justified |
| Validation | Khronos glTF Validator | hard validation + fixture coverage |
| Packaging patterns | `pmndrs/assets` | study only |
| Batch processing patterns | Objaverse-XL scripts | study code only, dataset rights separate |
| Later coherent packs | Quaternius named CC0 packs | P1 catalogue expansion |
| Selected parts/reference | FreeCAD Parts Library | P1 selected assets + architecture reference |
| Cultural hero objects | Smithsonian Open Access 3D | P2, per-media rights verification |

These sources never override Museum Editor ownership, project model, visitor isolation or licensing gates.

## P24A acceptance gate

P24A minimum is complete when:

1. acquisition/provenance contract blocks unresolved rights;
2. repeatable normalization produces validated web assets with real dimensions, orientation/pivot policy, metrics and previews;
3. 10–12 cross-source proof assets pass one pipeline;
4. Plan-eligible proof assets compile to existing `AssetFootprint` and pass the Phase 2 proxy fixtures;
5. an attribution-required item proves provenance survives use;
6. accepted static model identity has an explicit canonical Scene placement + Save/Load + retained shipped-static visitor delivery path, with loading sourced from the compatibility authority and no live-provider/editor-warmed dependency;
7. a bounded material/HDRI set is available for P24B;
8. the rest of the 32-object manifest is demonstrably repeatable backlog work and does not gate P24B or P25.

Dynamic project/upload/provider GLB ingestion is not required to close this static-first minimum. If later promoted, it must prove P20/R2 registration + immutable P22 release pinning + release-scoped cold model resolution before shipping.

## Deferred scope

P24A minimum does not include marketplace/community catalogue, user-wide My Assets, arbitrary remote import, full asset search/discovery platform, generic project/upload/provider GLB ingestion, foliage/LOD system, every provider adapter, giant asset counts, material-editing UX, lighting authoring, shader graphs, UV editing, animation/rigging or mesh topology editing.