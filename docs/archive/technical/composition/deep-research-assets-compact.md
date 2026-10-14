# Deep-research assets — compact reference

> Source: `docs/archive/legacy/research/deep-research-assets-source (archived; this compact is the P24 strategic base)` (~2166 lines, Sept 2026). Compression/normalization, not summary. Organization by concept; all substantive findings, qualifiers, numbers, versions, licenses, names, paths, URLs, tables, code/API/types, rejections, open questions preserved in dense form. No new research; uncertainty preserved; citations not invented.
> Relation to P24 exact-asset harvest: this doc is the overall strategy/research base (source tiers, scorecards, generator picks, ingestion architecture, 100-asset vision); `P24-3D-assets-staging/museum-editor-phase2-exact-asset-harvest-P24.md` + `deep-research-exact-asset-compact.md` are the detailed execution slice (Wave-1 32-asset manifest, 42-row material manifest, 9-HDRI set, 12 PlanProxy fixtures, exact endpoints/flags). Exact-overlap skim applied: only row-for-row duplicated execution detail is referenced rather than repeated — none found beyond shared source/tool names at different granularity, so strategic content is preserved in full with pointers. Neither supersedes the other. Citations: portable (8 verbatim external URLs in §15, no opaque handles).

## 1. Thesis / direction

- Do not build giant asset dump. Build **normalization + provenance + semantic asset layer**; feed from clean open sources + procedural primitives + external connectors + AI generation. Layer = leverage.
- Base already correct: reusable assets ≠ placed instances; `LayoutDocument` = architecture truth; `SceneDocument` = scene-object truth; Plan derives representation (no separate geometry); AI goes through same semantic project systems. Refs: `architecture.md`, `Shell-scene-workspaces.md`, `north-star.md`.
- Moat: **normalization + semantics + executable spatial authoring** — "runtime/compiler for spatial experiences", not small Blender. Unit: `Spatial Asset = geometry + dimensions + placement rules + Plan proxy + materials + optimization + provenance + semantic meaning`; `Spatial Template = layout + asset roles + style/material rules + lighting intent + camera intent`.
- Final priority chain (source §M): finish editor/publish foundation → **Asset Registry → ingestion/normalization → generated Plan proxies → curated 100-asset library → procedural gallery primitives → semantic agent command API**. AI 3D provider integration **after** normalization pipeline so Tripo/Meshy/TRELLIS.2/future-2027-model/user-GLB are one input kind.

## 2. Source tiers + license infrastructure

- Tiers:
  - T1 bundle freely: Poly Haven; ambientCG; Kenney; carefully selected Smithsonian Open Access; `pmndrs/assets`; legacy Quaternius packs only where pack explicitly says CC0; some Blender demo assets where individual file license is CC0. Cleanest legal base. Poly Haven July 2026: assets remain CC0; API now officially permits commercial use; provider attribution requested when using live API.
  - T2 ingest with attribution: Sweet Home 3D furniture libraries; FreeCAD Parts Library; selected CC-BY Objaverse; Babylon sample assets; buildingSMART community IFC samples; selected Sketchfab CC assets.
  - T3 connector, not mirror: Sketchfab; BlenderKit/Blendkit; Poly Pizza; current Quaternius QAL packs; ShareTextures. Use inside projects may be fine; asset-store redistribution / automated harvesting has terms problems.
  - T4 research only: ShapeNet (explicitly noncommercial research/education); 3D-FRONT / 3D-FUTURE (derived distributions preserve research-only terms); HM3D / Matterport (explicitly academic, noncommercial); parts of Objaverse-XL; other academic indoor datasets with research-only agreements.
- License metadata is infrastructure; six distinct layers: `code license; asset license; dataset license; model-weight license; generated-output terms; source-site ToS`. Repo MIT ≠ `assets/` redistributable. Exemplar: HM3D research code MIT, dataset noncommercial.
- ABO conflict — hold: dataset landing page says **CC BY 4.0**; AWS Open Data registry + Amazon Science announcement say **CC BY-NC 4.0**. Until archive `LICENSE` governing downloaded 3D payload pinned + legally reviewed: **treat ABO (~7,953 glTF PBR product models) as noncommercial/research-only**. No guessing.
- Six license-evidence fields gate (see §7); uncertain → `state = blocked`, not "probably okay".

## 3. 3D asset sources (harvest table, condensed; all rows/dimensions retained)

Cols: `Source | Useful | License | Web(1-5) | Bundle | Harvest | Verdict`. Product judgments are author's, not source claims.

- Poly Haven | models, HDRIs, PBR | CC0 | 5 | Yes | Excellent API | **Harvest now**.
- ambientCG | models + huge PBR | CC0 | 4 | Yes | Good | **Harvest now**.
- Kenney | furniture, buildings, environment kits | CC0 | 5 | Yes | Good | **Harvest now**; stylized/default low-poly.
- Smithsonian Open Access | sculptures, heritage, decor | CC0 Open Access subset | 3 | Yes for CC0 subset | API available | **Harvest curated**.
- `pmndrs/assets` | small web-ready model/material/HDRI set | CC0 | 5 | Yes | Excellent/npm | **Harvest + study pipeline**.
- `pmndrs/market` | web-ready model/material collection | CC0 focus | 5 | Yes where verified | API-oriented | **Worth adapting**.
- Sweet Home 3D model libraries | furniture + spatial metadata | mixed free licenses, attribution may apply | 2–3 | Conditional | Good after SH3F parser | **High priority inspect**.
- FreeCAD Parts Library | architectural, industrial, generic, parametric objects | CC-BY 3.0 content | 2 | Yes with attribution | Good | **Worth adapting**.
- Khronos glTF Sample Assets | reference-quality glTF, PBR, extensions | per-model license | 5 | Per model | Excellent | **QA/test + selective harvest**.
- BabylonJS Assets | meshes, textures, IES, environments | default CC-BY 4.0 unless overridden | 5 | Usually with attribution | Good | **Worth adapting**.
- Blender Demo Files | rich scenes/procedural examples | per-file CC0/CC-BY/etc | 2 | Per file | Manual manifest | **Selective harvest/study**.
- Godot demos | complete open demo scenes | code MIT; still inspect third-party assets | 4 | Conditional | Good | **Study/selective extraction**.
- NASA 3D Resources | spacecraft, scientific/outdoor objects | NASA media terms | 3 | Conditional | Good | **Niche source**.
- Europeana 3D | cultural heritage | per-item rights | 2 | Per item | API/metadata strong | **Connector/curated import**.
- Scan the World | sculptures/cultural meshes | individual CC licenses | 2 | Per item | Weak/moderate | **Curated sculpture source**.
- Sketchfab downloadable CC | enormous variety | per-item CC; OAuth download | 5 | Only compatible CC items | technically good; legally filter | **Connector first**.
- OpenGameArt | game assets, props, environments | CC0/CC-BY/SA/GPL etc varies | 3 | Per asset | Moderate | **Manual curated harvest**.
- Objaverse 1.0 | 800k+ annotated objects | per-object CC metadata | 3 | Allowlist only | Excellent | **Filtered harvest / agent index**.
- Objaverse-XL | 10M+ objects | dataset ODC-By; individual rights vary | 2 | Allowlist only | Excellent | **Research + filtered source**.
- Amazon Berkeley Objects | ~7,953 glTF PBR product models | **license sources conflict** | 5 | **Hold** | Excellent | **Research until legal snapshot resolved**.
- Poly Pizza | low-poly models | per-asset CC; site restricts scraping/AI harvesting | 5 | Conditional | **Do not scrape** | **External import**.
- Quaternius legacy CC0 packs | game-ready modular models | older packs may explicitly CC0 | 5 | Yes if pack explicitly CC0 | Moderate | **Harvest license-snapshotted legacy packs**.
- Quaternius current QAL | same strong low-poly ecosystem | QAL restricts standalone redistribution | 5 | **No default pack** | no | **External/use only**.
- Blendkit/BlenderKit | huge high-quality ecosystem | commercial use often fine; standalone resale/redistribution restricted | 3 | Usually **no** | API integration | **Connector later**.
- ShareTextures models | models + materials | CC0 claim but site ToS restricts collections/automation | 4 | **Not safe as harvested pack** | No | **Avoid automated harvest**.
- 3D-FRONT / 3D-FUTURE | furnished interiors + furniture | research/scientific-use restrictions | 2 | **No** | Technically excellent | **Research only**.
- ShapeNet | huge categorized object corpus | noncommercial research/education | 2 | **No** | Excellent | **Research only**.
- HM3D | 1,000 scanned buildings, GLB/OBJ | academic noncommercial | 2 | **No** | Excellent | **Research only**.
- OpenStreetMap → OSM2World | buildings/cities procedurally derived | ODbL + attribution/share-alike obligations | 3 | special treatment | Excellent | **Future outdoor/building generator**.

### 13-axis scorecard (author product assessment; legend `Q` quality · `N` quantity · `L` license clarity/friendliness · `C` commercial · `R` redistribution · `W` web-ready · `F` formats · `M` metadata · `K` consistency · `I` ingestion · `E` spatial-editor fit · `A` agent fit · `H` ecosystem health | Action)

- Poly Haven: 5/4/5/5/5/5/5/5/5/5/5/5/5 | **Harvest now**.
- ambientCG: 5/5/5/5/5/4/4/4/5/4/5/5/5 | **Harvest now**.
- Kenney: 4/4/5/5/5/5/5/4/5/5/5/5/5 | **Harvest now**.
- Smithsonian: 5/4/5/5/5/3/4/5/3/4/4/4/5 | **Harvest curated**.
- pmndrs/assets: 3/2/5/5/5/5/5/3/5/5/4/4/4 | **Harvest now**.
- pmndrs/market: 4/3/5/5/5/5/5/4/4/5/4/5/3 | **Adapt**.
- Sweet Home 3D: 3/4/4/5/4/2/3/**5**/4/4/**5**/**5**/4 | **Inspect first**.
- FreeCAD Library: 3/4/4/5/4/2/3/4/3/3/4/4/4 | Adapt.
- Khronos samples: 5/2/3/4/3/5/5/5/4/4/3/3/5 | QA/selective.
- Babylon Assets: 3/3/4/5/4/5/5/3/3/4/3/3/4 | Adapt.
- Blender demos: 5/3/3/4/3/2/2/3/3/2/4/3/5 | Selective.
- Sketchfab CC: 4/5/2/3/2/5/5/5/2/3/5/5/5 | Connector.
- Objaverse: 3/5/3/3/3/3/4/5/2/5/4/5/5 | Filter.
- OpenGameArt: 3/4/2/4/2/3/3/3/2/2/3/3/4 | Curate.
- Quaternius QAL: 4/4/2/5/1/5/5/4/5/3/5/5/5 | No bundling.
- Blendkit: 5/5/2/5/1/3/4/5/3/2/5/5/5 | Connector.
- ShareTextures: 4/4/2/5/1/4/4/3/4/1/4/4/4 | Avoid harvesting.
- 3D-FRONT: 4/5/1/1/1/2/3/5/5/4/5/5/3 | Research.
- ShapeNet: 3/5/1/1/1/2/2/5/3/4/3/4/3 | Research.
- HM3D: 5/3/1/1/1/3/4/4/5/4/3/4/4 | Research.

## 4. Textures / materials

- Table (`Source | Rights | PBR/resolution | Harvest | Recommendation`):
  - Poly Haven | CC0 | excellent PBR; HDRIs | excellent API | **Core source**.
  - ambientCG | CC0 | broad PBR, high res | excellent | **Core source**.
  - cgbookcase | CC0 | PBR, often up to 8K | good | **Core source**.
  - TextureCan | CC0 | PBR | good | **Core source**.
  - 3DTextures.me | CC0 | complete PBR sets | good | **Core source**.
  - Texture Ninja | CC0 | large architectural texture set | moderate | **Core supplemental**.
  - pmndrs/assets | CC0 | already compressed/web-oriented | excellent | **Web presets / HDRI**.
  - Kenney | CC0 | stylized textures/materials | good | Stylized themes.
  - Blender CC0 demos | per-file | procedural examples | manual | Inspiration/selective.
  - ShareTextures | restrictive site ToS despite CC0 asset claim | good | **poor for automated collection** | Do not bulk harvest.
  - Material Maker | MIT software | procedural PBR authoring | generation, not harvest | **Future procedural backend**.
  - MaterialX | Apache/open standard | graph/PBR interchange | N/A | Future interchange/schema.
- Bootstrap: **36–48 material presets**, not 500. First set: Walls 7; Floors 10; Stone/masonry 6; Wood 6; Metal 5; Fabric 5; Glass procedural presets; Canvas/paper 3. Plus **8–12 curated HDRIs**. (Later §J restates ~40 presets + 8–12 HDRIs.)
- Do not hand-build procedural marble/concrete/wood except useful parameter variations.
- Normalize to: known real-world tile scale; base-color color-space metadata; roughness/metalness conventions; normal orientation; 1K + 2K derivatives; KTX2/Basis web distribution. Basis Universal 2.1 remains strong web target; KTX2 = portable GPU-compressed textures + broad transcoding.

## 5. 2D / CAD / Plan-symbol sources + PlanProxy contract

- Ecosystem weaker than 3D/materials; no "Poly Haven of architectural top-view SVG". Own small canonical PlanProxy schema > harvesting thousands of SVGs.
- Table (`Source | Representation | Useful part | License issue | Recommendation`):
  - Sweet Home 3D | plan icons + furniture metadata | explicit top-view tied to same 3D asset | per-library rights | **Best conceptual source**.
  - easy-floorplan | JSON primitive geometry | furniture glyphs as geometry | MIT | **Inspect/adapt**.
  - QCAD Part Library | DXF/parts + RDF-like metadata | technical symbols, top view metadata | per-item + project licenses | Study/select.
  - FreeCAD Library | FCStd/STEP/Symbols | architecture + symbols | CC-BY 3.0 content | Adapt.
  - LibreCAD resources | DXF/icons | drafting vocabulary | code GPL; resources vary; icons CC0 | Study.
  - Maker.js | generated vector geometry | programmatic SVG/DXF shapes | verify dependency/license snapshot | **Library candidate**.
  - JSCAD | parametric 2D/3D | generated profiles/components | MIT | Parametric candidate.
  - OpenSCAD MCAD | parametric geometry | technical component grammar | LGPL | Reference.
  - OpenGameArt top-down packs | PNG/vector sprites | game-oriented plan-ish assets | individual license | Selective.
  - Kenney 2D packs | sprites/icons | generic top-down vocabulary | CC0 | Supplemental.
  - buildingSMART samples | IFC | semantic BIM objects | sample-specific/CC-BY | Import tests.
  - OSM building footprints | polygon + semantic tags | outdoor/site plans | ODbL | future site planning.
- Do not build Plan around SVG asset files. Store renderer-neutral geometry; SVG renderer draws it:
```ts
type PlanProxy =
  | { kind: 'box'; width: number; depth: number }
  | { kind: 'circle'; radius: number }
  | { kind: 'polygon'; points: Vec2[]; holes?: Vec2[][] }
  | { kind: 'semantic'; symbol: 'chair' | 'stairs' | 'plant' | ... }
  | { kind: 'none' };
```
- Fits architecture: renderer-specific representation out of semantic geometry boundaries (`architecture.md`).
- SH3D semantic contract (closest to need; study, don't clone): `width, depth, height, elevation, model rotation, tags, creator, resizability, texturability, shelf data, PLAN_ICON` (dedicated top-view icon). Shelf fields per §§A/L: source names only "shelf data" / "shelf metadata" (no exact keys given; capture elevations/boxes/drop-on-top semantics at inspection).

## 6. CAD / 2D geometry capabilities (do not adopt full CAD editor)

- Plan architecture stays Svelte + SVG + one renderer-neutral layout compiler (`Design-specs.md`). Add focused capability only:
  - `@flatten-js/core` (JS computational geometry: intersections, distances, affine ops, polygons) | MIT | **Strong candidate**.
  - polygon-clipping (robust union/intersection/difference/XOR) | MIT | **Use** when booleans needed.
  - Concaveman (fast concave hull) | ISC | **Use for footprints**.
  - Simplify.js (contour/polyline simplification) | BSD-2 | **Use for footprints**.
  - easy-floorplan (SVG/JS app: wall/object/snapping UX, JSON furniture) | MIT | **Study + extract concepts**.
  - Maker.js (paths/chains/layers, SVG/DXF generation) | open project; verify pinned license before dependency | Worth adapting.
  - JSCAD (JS/browser/CLI parametric profile→solid) | MIT | **Procedural object service**.
  - LibreCAD (C++/Qt: mature CAD interaction model + DXF) | GPL | **Study only / conversion process**.
  - QCAD (C++/Qt + ECMAScript: snapping, parts, dimensions, metadata) | GPL core | **Study**.
  - `web-ifc` (TS + C++ WASM IFC parser/writer) | MPL-2.0 | **Import/export boundary**.
  - OpenCascade.js (OCCT→WASM solid BRep/STEP/booleans/sweep/fillet) | LGPL-family | **Deferred**.
  - CascadeStudio (browser CAD on OCCT; scripted parametric architecture) | MIT app + OCCT dependencies | Study.
  - Clipper2/WASM (offsets + boolean polygon ops) | permissive | Add only if needed.
- Extraction (concepts, not apps): LibreCAD/QCAD → snap rules, dimension grammar, selection UX, DXF semantics, layer ideas; easy-floorplan → SVG spatial interaction, furniture proxy organization, wall/opening UX; web-ifc → IFC read/write adapter; OpenCascade → future isolated solid-operation service.
- Canonical flow only: `LayoutDocument → compileLayoutGeometry() → Plan + 3D`. No foreign CAD kernel as second project truth (`architecture.md`).
- Browser-side Plan-proxy pieces already exist: Concaveman (concave hull), polygon-clipping (union/difference), Simplify.js (contour reduction), `three-mesh-bvh` (efficient mesh spatial queries).

## 7. Ingestion architecture (durable infrastructure)

- 17-stage pipeline: `SOURCE → Source Adapter → License+Provenance Gate → Quarantine/Validation → Format Conversion → Canonical GLB → Geometry Normalization → Material/Texture Normalization → Web Optimization → Bounds/Collision/Placement Analysis → Plan Proxy Generation → Thumbnails/Turntable → Semantic Metadata+Embeddings → Curation Gate → Immutable Asset Revision → Asset Registry → Editor/Agent/Published Runtime`.
- Source adapter contract:
```ts
interface AssetSourceAdapter {
  search?(query: AssetSourceQuery): Promise<SourceAsset[]>;
  fetch(id: string): Promise<SourceAssetPayload>;
  resolveRights(id: string): Promise<SourceRightsEvidence>;
}
```
Adapters: `polyhaven; kenney; smithsonian; sweethome3d; user-upload; generated:tripo; generated:meshy; generated:trellis`.
- License gate: persist evidence at ingestion; not bare `license: 'CC0'`. Required struct: `{ licenseId; licenseUrl; sourceTermsUrl; sourceSnapshotHash; author; attribution; redistributionAllowed; derivativesAllowed; commercialAllowed; shareAlike; downloadedAt }`.
- Conversion: canonical delivery **GLB/glTF 2.0**. Assimp supports 40+ source formats; 6.0.5 release April 2026; modified BSD → backend conversion straightforward. Blender CLI when artistic/geometry normalization requires robust importer or baking.
- Validate: Khronos glTF Validator (JSON diagnostics/statistics; validates buffers, animation, images, extensions, structure). Hard gate: `errors > 0 → fail; warnings → classify`.
- Geometry contract: `unit meters; up +Y; Plan plane XZ; pivot = semantic placement pivot; floor assets grounded Y=0; front = canonical documented direction`. Do not destructively invent dimensions without reliable scale; flag `scaleConfidence: 'source' | 'estimated' | 'manual'`.
- glTF processing: **glTF Transform** main TS layer (Web + Node): `prune; dedup; Draco; Meshopt; texture resizing; WebP; KTX2/UASTC/ETC1S; custom transforms`. Matches TS stack.
- Optimization: favor **Meshopt** where renderer support exists. `gltfpack` offers `EXT_meshopt_compression`, KTX2 conversion, WebP, mesh simplification, instancing, preserving names/materials/extras. Do not auto-strip meaningful node names (later animations/interactions).
- Textures: `BaseColor → ETC1S or good KTX2 profile; Normal → UASTC; Metallic/Roughness/AO → UASTC/packed; Emissive → appropriate per content`. Derivatives: 1K default; 2K quality; 4K hero-source-only/optional.
- Bounds/LOD: emit `AABB; OBB; bounding sphere; triangle count; vertex count; material count; texture VRAM estimate; LOD0; LOD1; LOD2`. LOD not mandatory for tiny low-poly.
- Thumbnails: deterministic `front; 3/4; top; optional turntable`; same studio lighting; serves human browse + visual embeddings.
- Semantic tagging: deterministic first (`category; dimensions; placement; materials; dominant colors; license; polycount`), then AI (`style; era; descriptive tags; visual embedding; text embedding`). Never let model overwrite source rights metadata.
- Split: local import (cheap: GLB validation, bounds, basic metadata, cheap Plan proxy, preview; can run Web Worker) vs backend batch (expensive: Blender conversion, texture baking, KTX2 encode, mesh simplification, LOD, full thumbnails, embeddings, quality checks) vs harvest pipeline (`source adapter → immutable source manifest → license snapshot → batch normalization → human curation → published registry`). Project-local GLB bytes belong to portable package/asset-store boundary, not `SceneDocument` (`architecture.md`).

## 8. Automatic 3D → 2D footprint

- Policy: every Plan-eligible asset gets resolved Plan proxy; proxies need not be hand-drawn. Expected `~70–90% auto-generated, ~10–30% curated/manual`; don't hand-draw hundreds upfront. Current Plan contract already assumes canonical footprint metadata for floor catalogue models; expand via ingestion, not Plan selection rework (`Shell-scene-workspaces.md`).
- Tier ladder: `Tier 0 explicit authored proxy; Tier 1 OBB rectangle; Tier 2 generated projected silhouette; Tier 3 curated semantic proxy`.
- T1 OBB (almost free): `mesh → XZ projected bounds → oriented rectangle`. Good for: cabinets; shelves; simple sofas; boxes; benches.
- T2 projected silhouette (preferred generic): `GLB → canonical local mesh → orthographic projection onto XZ → raster mask OR projected triangle polygons → union → small morphological close/dilate → contour extraction → simplify → PlanProxy polygon`. Rasterize-first often more robust than exact triangle-union on broken web meshes.
- T3 semantic proxy: manual curated proxy when top-view appearance ≠ useful plan communication.
- Edge cases (all retained): chair w/ thin legs → silhouette + close/dilate or semantic seat/back proxy; table → **top silhouette**, not contact points; cabinet → silhouette/OBB; shelf → silhouette; floor lamp → base + semantic lamp mark; plant → pot/base or simple canopy circle; stairs → **authored parametric symbol** showing direction; wall art → normally no floor footprint; hanging lamp → no floor footprint / ceiling annotation; sculpture → generated silhouette, curate irregular heroes; huge architecture mesh → usually Layout import/semantic architecture, not furniture asset.
- Provenance:
```ts
type PlanProxySource = 'manual' | 'generated-silhouette' | 'generated-obb' | 'parametric' | 'none';
// store generation version:
generator: { name: 'mesh-silhouette-v2'; params: {...}; quality: 0.88 }
```
Pipeline must be able to regenerate proxies later.

## 9. Asset schema (AssetDefinition ≠ instance)

- Keep product split: Asset Library reusable assets vs placed scene instances (`Shell-scene-workspaces.md`). Instance stays small. Exact shape must adapt to current `SceneDocument` codec; do not invent integration without code.
```ts
type AssetId = string;
type AssetDefinition = {
  id: AssetId; revision: number;
  identity: { name: string; category: string; subcategory?: string; tags: string[] };
  provenance: {
    provider: 'first-party' | 'polyhaven' | 'kenney' | 'smithsonian' | 'sweethome3d' | 'user' | 'generated';
    sourceId?: string; sourceUrl?: string; downloadedAt?: string; contentHash: string;
    derivedFrom?: AssetId[];
    generator?: { provider: string; model: string; version: string; seed?: string; inputHashes?: string[] };
  };
  rights: {
    licenseId?: string; licenseUrl?: string; authors: string[];
    attributionText?: string; commercialUse: boolean | 'unknown'; derivatives: boolean | 'unknown';
    redistribution: boolean | 'unknown'; shareAlike: boolean | 'unknown';
    sourceTermsUrl?: string; evidenceId: string; reviewedAt?: string;
  };
  model: {
    uri: string; format: 'glb'; contentHash: string; bytes: number; gltfVersion: '2.0';
    unit: 'meter'; upAxis: '+Y'; forwardAxis?: '+X' | '-X' | '+Z' | '-Z';
    meshCount: number; primitiveCount: number; vertices: number; triangles: number;
    animations: { name: string; duration: number }[]; extensionsUsed: string[];
  };
  dimensions: { width: number; height: number; depth: number; source: 'source' | 'estimated' | 'manual' };
  bounds: {
    aabb: { min: [number, number, number]; max: [number, number, number] };
    obb?: { center: [number, number, number]; halfSize: [number, number, number]; rotation: [number, number, number, number] };
  };
  placement: {
    surfaces: Array<'floor' | 'wall' | 'ceiling' | 'free'>;
    pivot: [number, number, number]; groundOffset: number;
    snapPoints?: { id: string; position: [number, number, number]; kind: string }[];
    clearance?: { front?: number; back?: number; left?: number; right?: number };
  };
  planProxy: {
    source: 'manual' | 'generated-silhouette' | 'generated-obb' | 'parametric' | 'none';
    polygon?: Array<[number, number]>; holes?: Array<Array<[number, number]>>;
    generation?: { pipelineVersion: string; confidence: number };
  };
  materials: {
    pbr: boolean;
    slots: Array<{ id: string; name?: string; replaceable: boolean }>;
    textureMaxResolution: number; usesKtx2: boolean;
  };
  optimization: {
    profile: string; meshopt: boolean; draco: boolean; ktx2: boolean;
    lods: Array<{ level: number; uri: string; triangles: number }>;
  };
  semantics: {
    styles: string[]; materials: string[]; colors: string[]; era?: string;
    indoorOutdoor: 'indoor' | 'outdoor' | 'both'; capabilities?: string[];
    textEmbeddingRef?: string; imageEmbeddingRef?: string;
  };
  curation: { status: 'Approved' | 'Testing' | 'Placeholder' | 'Rejected'; checks: string[]; notes?: string };
};
type SceneAssetInstance = {
  id: string; assetId: AssetId; roomId?: string;
  transform: { position: [number, number, number]; rotation: [number, number, number, number]; scale: [number, number, number] };
  materialOverrides?: Record<string, string>;
};
```
- Registry value > count: 100-model library with known dimensions/pivot/scale/license/placement, good Plan proxy, thumbnail, LOD/web budget, semantic tags beats 50,000 anonymous meshes (AI-usability argument).

## 10. AI 3D generators (Sept 2026)

- Open/local table (`System | Geometry | Texture/PBR | Topology/web fit | Local req | License | Verdict`):
  - **TRELLIS.2** | **Excellent** | **full PBR** | high detail, needs optimization | official ≥24 GB NVIDIA; community lower | MIT | **Best open general foundation**.
  - Step1X-3D | strong | strong | more pipeline work | heavy GPU | Apache-2.0 | **Strong alternative**.
  - PartCrafter | structured/multipart | geometry focus | very interesting semantics | H20-tested research stack | MIT code | **Research structured generation**.
  - CraftsMan3D | good geometry/refinement | pipeline-dependent | requires remesh | local GPU | code/model licensing differs by release | Research; license pin carefully.
  - InstantMesh | good baseline | weaker than latest | predictable pipeline | moderate | Apache-2.0 | Baseline.
  - Unique3D | useful reconstruction | moderate | post-process | moderate | MIT | Baseline.
  - TripoSR | fast geometry baseline | weak/currently dated | post-process | relatively accessible | MIT code | Fast baseline.
  - Hunyuan3D 2.1 | strong | PBR | good | heavy | **territorial custom license** | **Avoid canonical global backend**.
- TRELLIS.2: MIT; explicitly high-res meshes w/ complex topology + full PBR; official stack incl. CuMesh (post-process, remesh, decimate, UV). Official HW high (≥24 GB NVIDIA); 2026 community paths 6–11 GB VRAM unofficial + slower. Verdict: internal/batch strong; browser "press Generate, instant local asset" not normal path. Caution: quality↑ → tricount↑, texture↑, ingestion work↑; never insert raw TRELLIS output into `SceneDocument`.
- Step1X-3D: inspect preprocessing, watertight pipeline, texture path, config profiles, inference outputs (independent open pipeline vs TRELLIS).
- PartCrafter: part-aware > monolithic for editor; scene model trained on 3D-FRONT → legal review before product use. Research only.
- Hunyuan3D 2.1: quality can be good; license excludes EU/UK/South Korea territory; restricts use/display of outputs outside permitted territory; extra conditions >1M MAU. Do not make canonical generator for globally hosted editor.
- Tripo P2 (Aug 2026; `P2-20260801`; first experimental adapter pick — not prettiest, but exposes needed params): triangle cap 50k; quad cap 25k (source prints "48–25k quad limit" alongside "48–50k triangle limit" — preserved as written); PBR maps; 8K optional texture quality; auto-scale into meters; deterministic geometry/texture seeds; export orientation; UV control (controlled UV export); Meshopt geometry compression; GLB workflow. Best web-oriented low-poly API / batch generic creation (with Meshy).
- Meshy 7 / Smart Topology (broad pipeline API, not just generator): text/image/multiview generation; smart topology; target polycount; quad option; remesh; UV unwrap; retexture; resize; convert; rigging; animation. Pricing at research time: 20 credits normal Meshy 7 generation + texture/topology extras per operation.
- Rodin Gen-2.5 (hero/bespoke, not bulk furniture): text or ≤5 images input; Hyper3D adding geometry/texture controls through Aug 2026; May 2026 community same-input comparison rated Rodin > TRELLIS.2 on backside completion, UV unwrap, texture, geometry — anecdotal, not benchmark, but useful practical signal.
- Winners by task: open/local foundation → **TRELLIS.2**; open structured-part research → **PartCrafter**; web low-poly API → **Tripo P2**; broad asset-processing API → **Meshy**; hero fidelity → **Rodin Gen-2.5**; batch generic → **Tripo P2 / Meshy**; predictable existing assets → **None — harvest curated source instead**.
- "Looks good" ≠ reusable. Gate every generated model (15 checks): backside complete; no catastrophic hidden geometry; reasonable watertightness where category needs it; deterministic real-world scale; canonical +Y up; sane pivot; correct floor grounding; stable UVs; ≤ web triangle budget; material maps valid; textures ≤ budget; Plan proxy valid; thumbnail valid; semantic category known; provenance + generator/version stored. Else picture-shaped mesh.
- Policy: AI = long-tail fallback, not basic supply. Bad: "generate another generic chair every time." Good: "no suitable low Victorian display cabinet exists; create one." Curated assets cheaper, deterministic, searchable, reusable, easier to optimize.

## 11. AI / procedural layout systems (study algorithms; don't ship restricted data)

- ProcTHOR: procedurally creates semantically plausible interactive houses; open Apache ecosystem. Extract: room templates; object placement constraints; spatial randomization; semantic object classes; procedural scene validation. Not runtime dependency.
- Holodeck: language → interactive environment via asset selection, layout composition, structured environment data. Model: `LLM intent → choose assets → position objects → enforce relations → produce environment`. Resembles long-term agent workflow.
- PartCrafter scene gen: compositional parts/objects, but 3D-FRONT training data → legal review; research only.
- LayoutGPT / ATISS / DiffuScene / related: strong relation reasoning, furniture distributions, semantic interior composition; poor production dependency (commercial rights bad on underlying datasets). Study algorithms; do not ship data.
- CAD-Recode: generates CadQuery code from geometry/point clouds, not opaque mesh; relevant to future CAD agent.
- DeepCAD / Text2CAD / CAD-MLLM: lesson = structured operation sequence beats generated mesh. DeepCAD = CAD construction sequences, reconstructs CAD/STEP-like outputs. Aligns with `createRoom(...); addWall(...); addWindow(...); setDimensions(...); placeAsset(...)` rather than raw mesh authority.
- Product rule: AI scene generation outputs **commands, not scene blob**: `prompt → spatial plan → semantic editor commands → deterministic validation → render → critique → revise`; not `prompt → mysterious GLB scene`.

## 12. First library / build-vs-harvest / product surface

- Static library ~100 curated (table sums 97; enough combinatorial variety): chairs 10; benches 7; stools 4; lounge/sofas 6; tables 10; desks/consoles 5; shelves/bookcases 7; cabinets/storage 7; floor/table lamps 8; wall sconces 7; pendants 5; plants 8; decor/generic props 8; electronics/signage 5. Plus procedural architecture; materials ~40; HDRIs 8–12; templates 7 (Small Gallery; Four-Room Gallery; Portfolio Exhibition; Product Showroom; Small Retail; Office/Studio; Residential Room). Templates > 50 more random chairs for AI.
- Parametric, not static (20; presets not unique meshes): wall; floor; ceiling; room; door; double door; sliding door; window; opening; column; stairs; partition; plinth; pedestal; display case; frame; shelf; cabinet; lighting track; rail. Procedural beats static for architectural families; extends `LayoutDocument` + one layout compiler, no second modeling system (`north-star.md`).
- Build/harvest/generate matrix (`Asset class | Harvest | Procedural | AI generate | Manual`): walls/rooms/floors Low|**5/5**|Low|template only; ceilings Low|**5/5**|Low|template; doors/windows Medium|**5/5**|Low|presets; stairs Low|**5/5**|Low|semantic presets; columns Medium|**5/5**|Low|styles; partitions Low|**5/5**|Low|presets; plinths/pedestals Low|**5/5**|Low|presets; display cases Medium|**5/5**|Medium|hero styles; shelving/cabinets High|**4/5**|Medium|core presets; chairs **5/5**|Low|Medium|few canonical; benches **5/5**|Medium|Medium|gallery core; tables **5/5**|Medium|Medium|core; sofas/lounge **5/5**|Low|Medium|none/few; lamps **5/5**|track system only|Medium|gallery lights; plants **5/5**|Low|**4/5**|Low; sculpture/decor High|Low|**5/5**|hero; electronics **5/5**|Low|Medium|Low; materials **5/5**|**4/5**|Medium|curation; glass/simple metal Medium|**5/5**|Low|Low; HDRIs **5/5**|Low|Low|Low; Plan symbols Medium|**auto-generation 5/5**|Low|core semantic proxies; scene templates Medium|**5/5 composition**|**5/5 assisted**|**5/5 curation**; camera tours —|semantic rules|**5/5 assisted**|authorable.
- Curated library UI (second layer external): `Assets ├── Curated ├── My Assets ├── Project └── External (Poly Haven, Sketchfab, ...)`. External assets ingested into local/project registry before placement; never live third-party runtime dependency.
- On-demand search order: `search curated → suitable? use : search external allowed source → suitable? import : generate`. Makes generation economical.
- Procedural priority: walls; floors; ceilings; rooms; openings; doors; windows; stairs; columns; partitions; shelves; cabinets; plinths; display cases; frames; rails; lighting tracks; repetition/arrays. Parameters > artistic mesh.
- Automate (15): format validation; GLB conversion; texture scan; bounds; scale heuristics; grounding; optimization; KTX2; LOD; Plan silhouette; thumbnails; initial tags; embeddings; duplicate detection; performance score. Human/review (7): final licensing judgment; bizarre scale; poor topology; semantic category; placement behavior; hero Plan proxy; final Approved status. Mechanical pipeline **70–90% automatable** after adapters mature.
- Roadmap P-A1..P-A9: A1 definition+provenance (`AssetDefinition, AssetRevision, license evidence, source provenance, content hash`, no UI explosion); A2 canonical import (GLB validation, normalization, optimization, thumbnail, bounds); A3 PlanProxy generation (`GLB → footprint → Scene Plan Arrange`, closes imported-footprint gap per `Shell-scene-workspaces.md`); A4 curated standard library (~100 assets + 40 materials); A5 semantic search (filters `category, dimensions, material, placement, style, license, poly budget` first, embeddings second); A6 procedural families first (plinth, display case, partition, frame, shelf, lighting track); A7 external adapter (Poly Haven first — API + rights clean); A8 generation provider interface (`interface AssetGenerator { generate(request: AssetGenerationRequest): Promise<ImportedAssetCandidate>; }`, Tripo/Meshy/TRELLIS same pipeline); A9 agent asset/search commands, then AI composition.
- Deliberately not build (14): Blender-style mesh editor; sculpting; UV editor; manual retopology editor; own 3D foundation model; giant asset crawler before license system; giant marketplace now; second Canvas/Fabric/Konva Plan architecture; second CAD document representation; IFC as internal truth; USD as internal truth; AI-only scene representation; separate "generated scene" pipeline; 10,000 mediocre assets before first 100 excellent — aligns with North Star permanent non-goals (`north-star.md`).
- Agent surface (semantic tools, not DOM): e.g. `searchAssets({query:'low modern wooden gallery bench', maxWidthM:1.8, placement:'floor', license:'commercial', triangleBudget:20_000}); placeAsset({assetId:'bench-oak-03', roomId:'gallery-east', position:[1.2,0,-2.4], yaw:Math.PI/2}); setMaterial({entityId:'bench-7', slot:'wood', materialId:'oak-natural'}); addCameraNode({...}); connectCameraNodes({...}); setCameraSequence({...}); validateProject(); renderPreview({...})`. Never `scene.children[43].position.x = ...`; never bypass room-local transforms, canonical selection/history, layout compiler, camera motion pipeline (`architecture.md`, `Camera-flow-specs.md`, `north-star.md`).
- Leverage path: `user intent → semantic spatial layout → known reusable assets → materials+lighting → camera experience → interactions → preview → web publish`, whole path machine-operable. Agent example: `createGalleryTemplate(...) → set room dimensions → choose standard doors → search bench assets → choose gallery lights → apply plaster/oak/concrete → place works → generate circulation → author camera graph → author sequence → preview → correct`. Mesh supply commodity; semantic spatial execution environment is harder commodity.

## 13. Repos / datasets to inspect first (15)

1. `pmndrs/assets` — web-designed, CC0, optimized GLB/textures, npm consumption. Inspect: model folders; texture/HDRI folders; optimization/build scripts; metadata/index-generation path. Goal: steal **pipeline ideas**, not just files.
2. glTF Transform (`donmccurdy/glTF-Transform`) — probably canonical TS asset-processing dependency. Inspect: `packages/core; packages/extensions; packages/functions; packages/cli`. Function code e.g. `packages/functions/src/`; `join.ts` confirms structure.
3. Khronos glTF Validator (`KhronosGroup/glTF-Validator`) — ingestion acceptance gate. Inspect: `node/; lib/; bin/; test/`.
4. Khronos glTF Sample Assets — validate renderer/extensions; build pipeline fixtures; license model-per-directory discipline. Inspect: `Models/; Models/<asset>/README.md; Models/Models.md`. Per-model licenses.
5. FreeCAD Parts Library — parametric/semantic parts, CAD source data. Inspect: `Architectural Parts/; Generic objects/; Industrial Design/; Symbols/; thumbnails/; LICENSE-Assets`. CC-BY 3.0 content.
6. Sweet Home 3D furniture libraries — download current SH3F libraries (not mainly GitHub clone). Inspect: `*.sh3f`; furniture properties; plan icons; dimensions; elevation; rotations; shelf metadata; creator/license metadata. Most important manual inspection after glTF Transform.
7. easy-floorplan — simple JSON geometry ≈ PlanProxy idea. Inspect: `furniture/; furniture/*.json`. MIT.
8. `allenai/objaverse-xl` — large-scale messy-asset normalization, rendering, metadata extraction. Inspect: `scripts/rendering/; scripts/rendering/blender_script.py`. Per-object rights mandatory.
9. Microsoft TRELLIS.2 (`microsoft/TRELLIS.2`) — open generation + postprocessing. Tree: `configs/; data_toolkit/; o-voxel/; trellis2/; app.py; app_texturing.py; example.py; example_texturing.py; train.py`.
10. Step1X-3D — preprocessing, watertight pipeline, texture path, config profiles, inference outputs; independent open pipeline vs TRELLIS.
11. PartCrafter (`wgsxm/PartCrafter`) — part-aware generation. Tree: `assets/; configs/; datasets/; scripts/; settings/; src/`. Scene model/data lineage touches 3D-FRONT → legal review.
12. `web-ifc` — IFC interop without IFC internal truth. Inspect: `src/; examples/; tests/; WASM build boundary`.
13. `three-mesh-bvh` (`gkjohnson/three-mesh-bvh`) — fast spatial queries, intersection, distance, SDF-ish ops, worker generation. Supports: footprint generation; collision proxy generation; clearance analysis; imported mesh selection later.
14. Concaveman + polygon-clipping + Simplify.js — tiny, high leverage; PlanProxy toolkit vs giant CAD library.
15. OSM2World — converts OpenStreetMap semantics → 3D; exports glTF/OBJ. Later use: outdoor scenes, campuses, neighborhoods, historical walkthrough context. ODbL needs deliberate data-license boundary.

## 14. Risks / limitations / unresolved

- No explicit open-questions section in source; embedded uncertainties preserved: ABO license conflict unresolved (hold as noncommercial until archive LICENSE pinned); ShareTextures CC0-claim vs anti-collection ToS (avoid automated harvest); Poly Pizza per-asset CC but anti-scrape (external import only); Quaternius QAL redistribution bar; Blendkit redistribution bar; Hunyuan territorial + >1M MAU terms; PartCrafter/3D-FRONT lineage review; OSM ODbL share-alike boundary; Maker.js pinned-license verification; CraftsMan3D code-vs-model license split; Khronos per-model licenses; Blender per-file licenses; Godot third-party assets; Europeana/Scan-the-World/OpenGameArt per-item variance; Sketchfab/Objaverse allowlist filtering burden; community TRELLIS 6–11 GB paths unofficial/slower; Rodin-vs-TRELLIS comparison anecdotal not benchmark; scale-estimation must not invent dimensions (flag confidence); AI must not overwrite rights metadata; raw generative output must not enter `SceneDocument` unprocessed.

## 15. Source / reference index (URLs attached to owning claims)

- https://polyhaven.com/?utm_source=chatgpt.com — T1 harvest-now; models/HDRIs/PBR; CC0; July 2026 commercial-API note.
- https://github.com/donmccurdy/glTF-Transform?utm_source=chatgpt.com — canonical TS processing dep.
- https://github.com/KhronosGroup/glTF-Validator?utm_source=chatgpt.com — acceptance gate.
- https://github.com/allenai/objaverse-xl?utm_source=chatgpt.com — messy-asset normalization reference; `scripts/rendering/blender_script.py`.
- https://github.com/microsoft/TRELLIS.2?utm_source=chatgpt.com — open generation foundation.
- https://github.com/wgsxm/PartCrafter?utm_source=chatgpt.com — structured/part-aware generation.
- https://github.com/gkjohnson/three-mesh-bvh?utm_source=chatgpt.com — spatial queries, footprint/collision support.
- https://osm2world.org/?utm_source=chatgpt.com — OSM semantics → 3D (glTF/OBJ).
- Internal refs (claims they support): `architecture.md` (doc split, compiler flow, no second truth, package/store boundary, agent constraints); `Shell-scene-workspaces.md` (asset/instance split, footprint metadata, A3 gap); `north-star.md` (LayoutDocument extension, non-goals, publish boundary); `Design-specs.md` / `Design-shell-specs.md` (Svelte+SVG Plan, compiler); `Camera-flow-specs.md` (camera pipeline protection). No other external URLs in source; named sources without URLs preserved in inventory.

## 16. Research Inventory + Loss Audit

- Named projects/products/tools/companies: Poly Haven; ambientCG; Kenney; Smithsonian Open Access; `pmndrs/assets`; `pmndrs/market`; Sweet Home 3D; FreeCAD Parts Library; Khronos glTF Sample Assets; BabylonJS Assets; Blender Demo Files; Godot demos; NASA 3D Resources; Europeana 3D; Scan the World; Sketchfab; OpenGameArt; Objaverse 1.0; Objaverse-XL; Amazon Berkeley Objects (ABO); Poly Pizza; Quaternius (legacy CC0 + current QAL); BlenderKit/Blendkit; ShareTextures; 3D-FRONT/3D-FUTURE; ShapeNet; HM3D/Matterport; OpenStreetMap/OSM2World; cgbookcase; TextureCan; 3DTextures.me; Texture Ninja; Material Maker; MaterialX; easy-floorplan; QCAD Part Library; LibreCAD; Maker.js; JSCAD; OpenSCAD MCAD; buildingSMART (IFC samples); `@flatten-js/core`; polygon-clipping; Concaveman; Simplify.js; `web-ifc`; OpenCascade.js; CascadeStudio; Clipper2/WASM; TRELLIS.2 (+CuMesh); Step1X-3D; PartCrafter; CraftsMan3D; InstantMesh; Unique3D; TripoSR; Tripo P2; Hunyuan3D 2.1; Meshy 7/Smart Topology; Rodin Gen-2.5/Hyper3D; ProcTHOR; Holodeck; LayoutGPT; ATISS; DiffuScene; CAD-Recode; DeepCAD; Text2CAD; CAD-MLLM; Assimp; Blender CLI; glTF Transform; Khronos glTF Validator; `gltfpack`; Basis Universal; KTX2; CadQuery; Revit; Fabric/Konva (rejected second Plan arch); USD (rejected truth); Three.js ecosystem (`three-mesh-bvh`).
- Source URLs (8 + internal docs): listed in §15; no URLs dropped (source contained only those 8 external links); internal doc refs retained with owning claims.
- Benchmarks/quantitative facts: Poly Haven July 2026 API change; Tripo `P2-20260801`, 48–50k tri / 48–25k quad (as written), 8K optional, 20-credit Meshy 7 pricing; TRELLIS official ≥24 GB, community 6–11 GB; Assimp 40+ formats, 6.0.5 Apr 2026; cgbookcase up to 8K; 13-axis scores (§3); web-readiness scores (§3); 36–48 presets + category counts (§4); ~100/97 library counts (§12); 70–90% auto proxy / 70–90% pipeline automation; 1K/2K/4K derivatives; Objaverse 800k+ / XL 10M+; ABO ~7,953; HM3D 1,000 buildings; P-A1..P-A9; 14 not-build items; 15 reusable-asset checks; 15 automate + 7 human tasks; Rodin ≤5 images; May 2026 anecdotal comparison; Hunyuan EU/UK/SK exclusion + >1M MAU term.
- Unresolved questions: source states no separate open-questions list; open items are the legal/technical holds in §14 (ABO LICENSE pin; SH3F per-library rights; ShareTextures/Poly Pizza ToS boundaries; QAL/Blendkit redistribution; Hunyuan territory; 3D-FRONT lineage; ODbL boundary; Maker.js license snapshot; CraftsMan3D license pin; Khronos/Blender/Godot per-asset checks; community-TRELLIS support status; Rodin benchmark gap; scale-confidence policy).
- Matrix→section mapping: 3D-source table → §3; 13-axis scorecard → §3; texture table → §4; 2D/CAD table → §5; CAD-project table → §6; open-generator table → §10; winners-by-task → §10; footprint edge cases → §8; static-library counts → §12; build/harvest/generate matrix → §12; repo inspect list → §13. Test/fixture-family mapping: reusable-asset 15-point gate → §10; silhouette pipeline + OBB/silhouette/semantic tiers → §8; footprint edge-case rows → §8; validator hard gate (`errors>0→fail`) → §7; license-gate struct + blocked rule → §7; agent command example → §12; `AssetGenerator` interface → §12; `AssetSourceAdapter` interface → §7; `PlanProxy`/`PlanProxySource`/`AssetDefinition`/`SceneAssetInstance` types → §5/§8/§9.
- Loss-audit checks (Pass 3): all original sections A–M accounted for (§1–§13 + intro/tail); every table dimension retained (license/web/bundle/harvest/verdict; 13 axes + action; texture rights/PBR/harvest/rec; 2D rep/part/license/rec; CAD stack/piece/license/rec; generator geometry/texture/topology/local/license/verdict; winners need/pick; edge asset/proxy; library group/count; build-matrix 4 outcome cols; all cell values kept, shared headers lifted only); every named project retained (§16 list); every link retained with owning claim (§15); every quantitative fact retained (§16); fixtures retained with inputs/outputs/invariants/edges (proxy tiers, silhouette steps, validator gate, 15-point gate, agent example); enumerations member-level (T1 7 / T2 6 / T3 5 / T4 5; 6 license layers; proxy tiers; adapter 8; gate 11 fields; texture profiles; thumbnail 4; tagging 7+5; local/backend/harvest splits; 20 parametric; 14 static groups + total; 7 templates; 15 automate + 7 human; 9 roadmap steps; 14 not-build; pipeline 17 stages — all recoverable above); protected tokens preserved (`PLAN_ICON`, interface/type/field/enum literals, `EXT_meshopt_compression`, `ETC1S/UASTC/KTX2/WebP/Draco/Meshopt`, `+Y/XZ/Y=0`, paths `packages/*`, `Models/*`, `*.sh3f`, `furniture/*.json`, `scripts/rendering/blender_script.py`, file trees, CLI/format IDs); rejections/deferrals retained (§12 + §6/§10); caveats + unresolved retained (§14); no invented citations; no silent conclusion changes. Field-level audit passes on inventoried items; wording is compressed, not verbatim.
