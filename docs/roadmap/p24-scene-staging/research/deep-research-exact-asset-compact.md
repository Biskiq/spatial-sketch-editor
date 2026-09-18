P24 Asset Harvest — Compact Reference Artifact
Thesis: Wave 1 = Poly Haven + Kenney Furniture Kit + attribution-aware SH3D Kator subset (32 assets) + Poly Haven + ambientCG materials (~40 presets) + Poly Haven HDRIs (9) + pipeline glTF Transform + gltfpack/meshoptimizer + PlanProxy oracles SH3D + Kenney top-down. Defer FreeCAD conversions, Smithsonian scans, heavy plants, arbitrary-repo mirrors to Wave 2/3 after provenance/conversion/PlanProxy gates exist.
Architecture: furniture/models = reusable Scene assets; doors/windows/stairs/structure = semantic LayoutDocument or procedural refs, not static Scene meshes.
Research date: 2026-09-07. Purpose: operational acquisition plan for first normalized, legally reusable library.
1. Executive Findings
- Three ingestion profiles validate pipeline, not one clean GLB source: Poly Haven (realistic PBR + rich metadata) + Kenney (tiny CC0 + 3D/top-view benchmark) + SH3D (semantic dims + plan metadata + B-rights legacy OBJ pipeline).
- Rights gate first: A/B/C/D confidence; commercial-use ≠ standalone-redistribution; GitHub MIT/GPL ≠ assets/ rights; every source keeps {source URL, author, asset/pack license, terms URL, acquisition date, immutable source/content hashes}.
- Do not spend cycle 1 on FreeCAD, Smithsonian, potted_plant_01/02 heavy foliage, or hidden repo assets. Wave 2 = 40–70 broader; Wave 3 = Smithsonian heroes.
- Build-time snapshot + own derivatives for bundled library; never make published experiences depend on live Poly Haven URLs; never write planIcon.png into project truth.
- Key result = 3 adapters + rights gate + normalization pipeline + PlanProxy benchmark + 32 objects + materials/HDRIs; no further discovery needed to start.
2. Key Concepts / Definitions
- Rights confidence: A explicit/low-ambiguity → bundle; B conditional/attribution → bundle once automated; C ambiguity → manual/legal, do not ship; D unsuitable → connector/reference or reject.
- Wave split: W1 clean-rights/low-cost/composition value (no forced lamps/plants; semantic lights exist; foliage needs alpha/LOD policy); W2 coverage; W3 hero/specialty + strict per-media rights.
- RightsEvidence: {sourceUrl, sourceProvider, assetOrPackId, licenseId, licenseUrl?, author?[], commercialUse, derivatives, redistribution, attributionRequired: bool|unknown, attributionText?, termsUrl?, acquiredAt, sourceHash?, evidenceSnapshotHash?}; unknown blocks Approved. Curator: Testing → automated + visual + license → Approved (existing model).
- Normalize: input → validator → GLB → meters → +Y up → canonical forward → floor/pivot → preserve names+extras → texture budget → Meshopt → bounds/stats → hash.
- PlanProxy tiers: T1 OBB (cabinet/shelf/bench); T2 silhouette (chair/table/sofa/sculpture); T3 semantic (stairs/lamp/plant/special); None (wall art/ceiling when footprint misleads). Rule: if semantic → semantic; elif box-like → OBB; else silhouette.
- Procedural boundary: NOT Scene-primary: wall, room, opening, door, window, stairs, structural column, partition, architectural frame → LayoutDocument → compileLayoutGeometry() → Plan+3D. Good Scene generators: plinth, pedestal, display case, frame, shelf/cabinet, lighting track + fixtures.
- Taxonomy (compact): Furniture{Seating{Chair,Stool,Bench,Lounge,Sofa}, Tables{Dining,Side,Coffee,Console,Desk}, Storage{Shelf,Cabinet,Drawer}, Display{Pedestal,Case}}; Lighting{Floor,Table,Wall,Pendant}; Decor{Plants,Sculpture,Vessel,Props,Signage}; Equipment{Electronics}. Architectural reference = ingest tag only; walls/doors/windows/stairs not browse categories when Layout-canonical. Small explicit source→canonical map; do not keep dozens provider names.
3. Sources / SOTA
Rank	Source	Repo/download	Why	Folder/endpoint	License	Disposition	Pri	Meta
1	Poly Haven	https://polyhaven.com/ (https://polyhaven.com/) · https://api.polyhaven.com/ (https://api.polyhaven.com/)	Clean CC0 models/materials/HDRIs; dims/polycount/tags; live commercial API	GET /assets, /info/{id}, /files/{id}	Assets CC0; live API commercial OK + visible credit + unique User-Agent	Bundle	P0	5/5
2	SH3D libraries	https://www.sweethome3d.com/importModels.jsp (https://www.sweethome3d.com/importModels.jsp) · https://sourceforge.net/projects/sweethome3d/files/SweetHome3D-models/ (https://sourceforge.net/projects/sweethome3d/files/SweetHome3D-models/)	Best spatial metadata: dims/elevation/rotation/creator/license/planIcon/deformable/shelf	SH3F ZIP: PluginFurnitureCatalog.properties + model/icon/texture	Per-pack/item: CC0/PD, CC-BY, Free Art	Bundle	P0	5/5
3	Kenney Furniture	https://kenney.nl/assets/furniture-kit (https://kenney.nl/assets/furniture-kit)	Tiny CC0 low-poly + top-down/isometric renders for PlanProxy	Official archive; Models/GLTF format/*.glb + render families	CC0	Bundle	P0	2/5
4	ambientCG	https://ambientcg.com/ (https://ambientcg.com/)	CC0 complement: marble/leather/linen/paper/some woods	IDs/ZIP; API where avail	CC0	Bundle	P0	4/5
5	pmndrs/assets	https://github.com/pmndrs/assets (https://github.com/pmndrs/assets)	Browser packaging ref: Transform + WebP + tiny HDRI + npm exports	src/models,hdri,textures, Makefile, bin	CC0	Study/pipeline + fixtures	P0	2/5
6	glTF Transform	https://github.com/donmccurdy/glTF-Transform (https://github.com/donmccurdy/glTF-Transform)	Canonical TS/Node normalization	packages/functions/src, packages/cli/src	MIT	Reuse	P0	n/a
7	meshoptimizer/gltfpack	https://github.com/zeux/meshoptimizer (https://github.com/zeux/meshoptimizer)	Optimization/simplify/Meshopt/KTX2/instancing	gltf/, src/, gltfpack CLI	MIT	Reuse	P0	n/a
8	FreeCAD Library	https://github.com/FreeCAD/FreeCAD-library (https://github.com/FreeCAD/FreeCAD-library)	Fixtures + parametric arch refs; content/code split	Architectural Parts/Living room, Lighting, Doors, Doors_Windows, Kitchen, Bathroom	CONTENT CC-BY-3.0 per author; code separate	Select harvest / study Layout	P1	4/5
9	Smithsonian 3D	https://www.si.edu/openaccess (https://www.si.edu/openaccess) · https://3d.si.edu/ (https://3d.si.edu/)	Hero exhibition objects; per-media check	Per-record 3D media	Only CC0/PD media enters bundle	Select heroes	P2	5/5
10	Quaternius	https://quaternius.com/packs/furniture.html (https://quaternius.com/packs/furniture.html) · https://quaternius.com/packs/ultimatefurniture.html (https://quaternius.com/packs/ultimatefurniture.html) · https://quaternius.com/packs/ultimatehomeinterior.html (https://quaternius.com/packs/ultimatehomeinterior.html)	Coherent packs, pages explicitly CC0	Pack archives; FBX/OBJ/Blend	CC0 on named pages; snapshot required	Bundle	P1	2/5
11	primitive-assets	https://github.com/pesaksintondji/primitive-assets-library (https://github.com/pesaksintondji/primitive-assets-library)	Tagged previews + parametric Geo Nodes incl. stairs	assets/primitives.blend, scripts/, metadata/thumbnails	CC0	Study/reimplement	P1	3/5
12	Objaverse-XL scripts	https://github.com/allenai/objaverse-xl (https://github.com/allenai/objaverse-xl)	Large-scale Blender import/validate/metadata/render patterns	scripts/rendering/blender_script.py	Code Apache-2.0; dataset rights separate	Study/pipeline	P1	5/5
13	Khronos Samples	https://github.com/KhronosGroup/glTF-Sample-Assets (https://github.com/KhronosGroup/glTF-Sample-Assets)	Pipeline/renderer/extension fixtures; per-model rights	Models/<model>/README.md, LICENSE.md	Per-model; some CC0/BY, some testing-only	QA/selective	P1	5/5
14	French Houses GN	https://github.com/IRCSS/Blender-Geometry-Node-French-Houses (https://github.com/IRCSS/Blender-Geometry-Node-French-Houses)	Foundation-driven buildings/rails/terraces/stairs/walls/towers	GeometryNodesFrenchHous.blend, Demo-MagicSchoolV2.blend, documentation/	MIT	Study/reimplement	P2	3/5
15	blenderStairs	https://github.com/blackears/blenderStairs (https://github.com/blackears/blenderStairs)	Stair params without CAD kernel	src/, addon/operator, makeDeploy.py	Apache-2.0	Study/optional reuse	P2	2/5
- Poly Haven: CC0; July 2026 API = commercial OK + unique User-Agent + visible source credit for live-API products; API gives IDs/taxonomy/tags/dims/polycount/texel/authors/hashes/dependencies/URLs/sizes. Snapshot terms at adapter build. Sources: https://polyhaven.com/our-api · https://github.com/Poly-Haven/Public-API
- SH3D: highest metadata value; official libs = redistributable PD/CC0 + CC-BY + Free Art but third-party terms can prohibit aggregation; SH3F = ZIP + PluginFurnitureCatalog.properties carrying model, planIcon, dims, elevation, rotation, creator/license, deformable/texturable, shelf fields. Sources: https://www.sweethome3d.com/importModels.jsp · https://sourceforge.net/projects/sweethome3d/files/SweetHome3D-models/ · https://www.sweethome3d.com/legal.jsp
- Kenney: official pack 140 files, CC0; low-poly 3D + 2D families; official archive = authority; mirror paths only for filename discovery, never acquisition. Source: https://kenney.nl/assets/furniture-kit
- FreeCAD: LICENSE-Assets = content (FCStd/STEP/BREP/STL/DXF/WRL/screenshots) CC-BY-3.0, code separate; per-part author attribution; ~5 GB → sparse checkout. Source: https://github.com/FreeCAD/FreeCAD-library/blob/master/LICENSE-Assets
- Quaternius: rights only from exact pages, not reputation: Furniture (23, Oct 2017) + Ultimate Furniture (20, Mar 2019) + Ultimate Interior (123, Jun 2020) = CC0 personal/commercial; snapshot page + archive. Sources: https://quaternius.com/packs/furniture.html · https://quaternius.com/packs/ultimatefurniture.html · https://quaternius.com/packs/ultimatehomeinterior.html
- Khronos: license per model dir; testing-only forbids commercial deployment; primarily validation fixtures. Source: https://github.com/KhronosGroup/glTF-Sample-Assets
4. Clone / Acquisition Sheet
Repo	Clone URL	Branch	License	Inspected	Inspect first	Ignore/warning
pmndrs/assets	https://github.com/pmndrs/assets.git (https://github.com/pmndrs/assets.git)	main	CC0	live 2026-09-07, unpinned	src/models,hdri,textures, Makefile, package.json	fonts; model files as furniture
pmndrs/market	https://github.com/pmndrs/market.git (https://github.com/pmndrs/market.git)	main	MIT app	live 2026-09-07	README, License.md, server, API/CDN/minifier	CDN rights ≠ MIT app
glTF-Transform	https://github.com/donmccurdy/glTF-Transform.git (https://github.com/donmccurdy/glTF-Transform.git)	main	MIT	files at 01cad7b; re-pin on integrate	packages/functions/src, packages/cli/src, README	docs site
meshoptimizer	https://github.com/zeux/meshoptimizer.git (https://github.com/zeux/meshoptimizer.git)	master	MIT	live; v1.1 2026-04-02, master reports 1.2 → pin tested release	gltf, src, gltfpack docs	experimental APIs
FreeCAD-library	https://github.com/FreeCAD/FreeCAD-library.git (https://github.com/FreeCAD/FreeCAD-library.git)	master	Assets CC-BY-3.0; code separate	live 2026-09-07	LICENSE-Assets; Living room, Lighting, Doors, Doors_Windows	whole 5 GB; sparse checkout
glTF-Sample-Assets	https://github.com/KhronosGroup/glTF-Sample-Assets.git (https://github.com/KhronosGroup/glTF-Sample-Assets.git)	main	Per-model	live 2026-09-07	Models/Models.md; Models/<name>/README; LICENSES	testing-only/issue-tagged for bundle
objaverse-xl	https://github.com/allenai/objaverse-xl.git (https://github.com/allenai/objaverse-xl.git)	default	Apache-2.0 code	live 2026-09-07	scripts/rendering/blender_script.py; objaverse; tests	dataset harvest w/o per-object filter
primitive-assets	https://github.com/pesaksintondji/primitive-assets-library.git (https://github.com/pesaksintondji/primitive-assets-library.git)	default	CC0	live 2026-09-07	assets/primitives.blend; scripts; docs	Bean rig; primitive duplication
French-Houses	https://github.com/IRCSS/Blender-Geometry-Node-French-Houses.git (https://github.com/IRCSS/Blender-Geometry-Node-French-Houses.git)	default	MIT	live 2026-09-07	GeometryNodesFrenchHous.blend; documentation; Demo-MagicSchoolV2.blend	generated houses as Layout truth
blenderStairs	https://github.com/blackears/blenderStairs.git (https://github.com/blackears/blenderStairs.git)	default	Apache-2.0	live 2026-09-07	src; makeDeploy.py; addon operators	Blender UI plumbing; keep algorithm only
- Poly Haven: GET https://api.polyhaven.com/assets; GET /info/{id}; GET /files/{id}; header User-Agent: MuseumEditorAssetPipeline/<version>; persist {assetId, files_hash, authors, dimensions, polycount, texel_density, tags, category, file URL/size/hash, policy snapshot, acquiredAt}.
- SH3D: first 3DModels-BlendSwap-CC-0-1.9.3.zip (175 PD/CC0) + 3DModels-KatorLegaz-1.9.3.zip (90 CC-BY) + 3DModels-Scopia-1.9.3.zip (500 CC-BY, W2); 1.9.3 released 2024-08-21; unpack .sh3f → root PluginFurnitureCatalog.properties. Do not invent member paths — schema + pack metadata verified, SourceForge members not enumerable in pass; implementation emits machine inventory {index,id,name,category,model,icon,planIcon,W/D/H,elevation,modelRotation,creator,license,resizable/deformable/texturable,shelfElevations,shelfBoxes,dropOnTopElevation} before import.
- Kenney: from https://kenney.nl/assets/furniture-kit; hash archive → keep CC0 snapshot → inventory Models/GLTF format/ → pair top-down → measure one known object → one pack-level unit fix if consistent. Units untrusted; community half-scale evidence → calibrate once pack-level. Top-down = test-oracle media, not canonical Plan truth.
- Quaternius: only named CC0 pages; inventory members pre-conversion; no filename guesses from screenshots/mirrors. Smithsonian: only specific CC0/PD media file; record metadata-rights vs media-rights separately.
5. Wave 1 Manifest — 32 Assets
Format: Source | ID | Category/Style | Dims/Native/PBR/Tris | License Rights Redis Attr Eff | PlanProxy | file/path.
Poly Haven (12, all CC0 A Yes None + Resolve from metadata/archive + glTF/GLB PBR; PlanProxy generated-silhouette except Shelf_01 OBB):
- ArmChair_01 | Seating/Armchair Victorian ~1.1m tall | ~6K | eff1 | harvest
- gallinera_chair | Seating/Chair Antique Filipino ~1.0m | ~12K | eff1
- folding_wooden_stool | Seating/Stool utility ~0.5m wide | ~6K | eff1
- painted_wooden_stool | Seating/Stool rustic ~0.6m tall | ~676 | eff1
- Sofa_01 | Seating/Sofa Victorian ~1.6m wide | ~4K | eff1
- painted_wooden_table | Tables/Dining farmhouse ~2.4m wide | ~600 | eff1
- round_wooden_table_01 | Tables/Round wood ~1.4m wide | ~9K | eff1
- wooden_table_02 | Tables/Small simple ~1.1m wide | ~196 | eff0
- side_table_01 | Tables/Side minimal ~0.6m tall | ~3K | eff1
- Shelf_01 | Storage/Shelf simple ~2.1m tall | ~182 | eff0 | generated-obb
- steel_frame_shelves_01 | Storage/Shelf industrial ~2.1m tall | ~4K | eff1
- painted_wooden_cabinet | Storage/Cabinet vintage ~1.2m wide | ~2K | eff1
Kenney (9, all Furniture Kit CC0 A Yes None eff1 | existing-topdown + generated-silhouette (cabinets: generated-obb); dims measure/normalize, GLB shared/simple, low-poly):
- chair | Models/GLTF format/chair.glb | Seating/Chair stylized
- loungeChair | loungeChair.glb | Seating/Lounge
- loungeDesignChair | loungeDesignChair.glb | Seating/Lounge design
- loungeSofa | loungeSofa.glb | Seating/Sofa
- loungeDesignSofa | loungeDesignSofa.glb | Seating/Sofa design
- table | table.glb | Tables/Dining
- sideTable | sideTable.glb | Tables/Side
- cabinetBedDrawer | cabinetBedDrawer.glb | Storage/Cabinet
- bathroomCabinet | bathroomCabinet.glb | Storage/Cabinet
SH3D KatorLegaz-1.9.3 (11, all pack 3DModels-KatorLegaz-1.9.3.zip | OBJ/MTL legacy (no PBR) | low-poly | CC-BY-3.0 B Yes Kator Legaz (exact SH3F creator/license) eff2 | existing-planIcon if present else generated-silhouette | harvest; dims in SH3F metadata):
- Futon-couch | Seating/Sofa contemporary
- Mid-century-bench-sofa | Seating/Bench mid-century
- Mid-century-sofa | Seating/Sofa mid-century
- Mid-century-chair | Seating/Chair mid-century
- Chair-ottoman | Seating/Lounge contemporary
- Bar-stool | Seating/Stool contemporary
- Dining-chair | Seating/Chair dining
- Bench | Seating/Bench generic
- Cafe-chair | Seating/Chair cafe
- Cafe-table | Tables/Cafe cafe
- Folding-table | Tables/Utility utility
Execution: Poly source → low-res derivative → validate → metadata → pivot/ground → KTX2 → Meshopt → silhouette/OBB → thumbnail → registry (0–1/5); Kenney cheap geometry but pack-scale rule + hash/snapshot; SH3D SH3F → parse dims/creator/license/planIcon → OBJ/MTL → GLB → cm→m → orientation → pivot → texture → proxy-vs-planIcon → attribution (2/5). Auto/manual: Poly ~95%/curation+pivot; Kenney 95% post-rule/calibration+curation; SH3D 85–90%/rights+QA+proxy.
6. Wave 2 / Wave 3
- W2 (40–70): BlendSwap-CC0 15–25 (post-inventory) + Scopia 10–20 (attribution automation working) + Quaternius Furniture + Ultimate Furniture 10–20 non-duplicates (post-inventory) + Kenney Nature lightweight indoor only + Poly Haven wooden_display_shelves_01, modern_wooden_cabinet, drawer_cabinet, gothic_cabinet_01, wooden_stool_01, metal_stool_01 + small plant only after foliage budget + FreeCAD Living-room only if coverage justifies conversion. No dozens near-identical chairs. Gaps: Lighting 4–6 floor/table + 4–6 wall + 3–4 pendants; Plants 6–8 lightweight indoor; Storage 3–5; Desks/consoles 4–6; Decor/signage 6–10. PointLight/SpotLight/DirectionalLight stay semantic Scene entities; fixture meshes may reference/own lights later; never encode illumination solely in lamp GLB.
- W3 Smithsonian (per-media CC0 only; metadata CC0 insufficient; keep suggested vs required attribution distinct):
ID	Title	Type	Eff
2632d078-a354-412c-825e-e70d2f546793	Armchair with slip seat	Furniture	2–3
ff607e3c-3d88-4422-a246-3976aa4839dc	Side Chair 1750–60	Furniture	2–3
57d30b85-3549-40dc-99c3-255249867462	Side Chair ca.1785 ornate	Furniture	2–3
8edffe56-c358-4c3a-a61f-019f615ccef0	Model of the Greek Slave plaster	Sculpture	3
0dc68216-3651-44c7-99cf-18e5d4d1eb9f	Kneeling winged monster limestone	Sculpture	3
082c87e9-1fe0-4772-b4c6-fe6d59bd6e74	Old Arrow Maker marble group	Sculpture	3
ff28cb3a-ad00-43b3-a928-fa61ab0a288f	George Washington plaster bust	Bust	2–3
2b4a081a-9ea1-4b0c-b1c3-6f5389da3244	Abraham Lincoln plaster portrait	Portrait	2–3
476ad7f6-6add-448d-af7f-9f2ca9ba9cb6	Buddhas/Bodhisattvas limestone relief	Relief wall-only	3
d8c62f94-4ebc-11ea-b77f-2e728ce88125	Ritual wine vessel fangyi bronze (low-res GLB/OBJ verified)	Vessel	2
All Wave 3. Reject: Uneasy Lies the Head that Wears the Crown (Prototype) — object/media third-party/restricted despite Open Access metadata.	 	 	 
7. Materials / HDRIs
Materials (~40 definitions; store only web derivatives). Provider | ID | Class | Scale | Maps | Res | KTX2 | Use | CC0 | Role:
- Plaster: Poly white_plaster_02 Wall 1m AO/ARM/Bump/Diff/Displ/Normal/Rough/Spec 1K/2K ETC1S-color+UASTC-normal/ARM clean wall Core; white_plaster_rough_01 1m full 1K aged Variant; white_rough_plaster 1m full 1K Rough/damaged plaster Variant; ambient Plaster001/002/003 provider-meta PBR 1K neutral/secondary/textured Complement.
- Concrete: concrete 4m full 1K/2K board-form Core; rough_concrete 1.2m AO/ARM/Diff/Displ/Normal/Rough 1K coarse Core; smooth_concrete_floor 2m full 1K/2K worn Core; brushed_concrete 2.5m full 1K brushed Variant; concrete_layers 1.5m full 1K weathered Variant.
- Wood floor: wood_floor 1.7m full+glTF/MaterialX 1K/2K general Core; oak_wood_planks 1.2m full 1K/2K Core; old_wood_floor 3m full 1K aged Variant; wood_floor_worn 2m full 1K worn pine Variant; diagonal_parquet provider-scale full 1K/2K parquet Feature; ambient WoodFloor064 natural oak Complement.
- Veneer/utility: oak_veneer_01 1.8m full 1K/2K Core; white_oak_veneer 0.5m full 1K/2K Core; teak_veneer provider full 1K/2K Core; sapele_veneer provider full 1K/2K dark Variant; plywood provider full 1K utility Core; ambient WoodFloor043 walnut Complement.
- Stone/tile: stone_tiles_02 2m full 1K/2K Core; granite_tile 2.3m full 1K/2K Core; marble_tiles 2m full 1K/2K Core; ambient Marble012 Carrara + Marble016 Calacatta Complement; interior_tiles provider full 1K/2K ceramic Core; terrazzo_tiles 2m full 1K/2K Core; floor_tiles_02 provider full 1K/2K marble Variant; concrete_tiles 1.9m full 1K utility Variant.
- Fabric/paper: rough_linen provider full 1K/2K linen Core; fabric_leather_01 0.4m full 1K/2K aged leather Core; fabric_pattern_05 0.5m full 1K cotton Variant; ambient Fabric061 linen + Leather037 black Complement; book_pattern provider PBR 1K canvas Core; ambient Paper001 Core + Paper002 Variant.
- Metal: metal_plate 0.5m metallic 1K diamond Specialty; blue_metal_plate 2.5m metallic 1K painted steel Specialty.
- Policy: base ETC1S-if-acceptable; normal UASTC; occlusion/rough/metal UASTC or packed ORM; height only if runtime uses; 1K default, 2K quality, 4K+ hero-only. Procedural presets (not downloads) for plain glass, clean painted metal/plastic, matte white/black, simple metallics.
HDRIs (9, all Poly Haven CC0; 16–24K = masters, not runtime; source → hash/meta → 512–1024 editor EXR/DWAB-or-PMREM → 1K–2K publish HDR/EXR-or-PMREM):
ID	Role	Source	EV/character	Editor	Published
studio_small_08	Neutral studio	16K	~17 EV	512–1024	1K–2K
white_studio_06	Bright clean	20K	~12 EV	512–1024	1K–2K
poly_haven_studio	Mixed office/studio	24K	~12 EV	512–1024	1K–2K
entrance_hall	Warm interior	16K	~15 EV	512–1024	1K–2K
events_hall_interior	Gallery/event hall neutral	20K	~12 EV	512–1024	1K–2K
urban_courtyard_02	Overcast urban daylight	16K	soft overcast	512–1024	1K–2K
nqweba_dawn	Nature / cool dawn	24K	~12 EV	512–1024	1K–2K
twilight_sunset	Warm dusk	20K	~12 EV	512–1024	1K–2K
studio_small_04	Dramatic studio	16K	~12 EV	512–1024	1K–2K
pmndrs tiny-HDRI (HDR→compressed EXR 512×512) = editor-preview ref; do not copy base64-JS packaging for larger registry.
8. PlanProxy Benchmarks / Fixtures
Fixture	Shape	Oracle	Why	Expected proxy
Kenney chair.glb	Four-leg chair	Kenney top-down	Thin legs/seat/back collapse	silhouette vs raster oracle
Kenney loungeDesignChair.glb	Lounge	Kenney top-down	Arms/irregular outline	silhouette
Kenney table.glb	Rect table	Kenney top-down	Top vs thin-leg contact	silhouette
Poly round_wooden_table_01	Round table	none	Circular top/pedestal	silhouette
Poly Shelf_01	Shelf	none	Thin long footprint	OBB then silhouette
Kenney loungeSofa.glb	Sofa	Kenney top-down	Large soft rect	silhouette
Poly potted_plant_01	Heavy foliage	none	Pot/base vs canopy	semantic likely
SH3D planIcon fixture	Floor lamp/small base	SH3F planIcon	Semantic icon vs tiny contact	authored proxy oracle
Smithsonian winged monster	Irregular sculpture	none	Concave irregular	silhouette
primitive Stairs	Stairs	parametric	Why stairs ≠ mesh silhouette	semantic Layout proxy
Smithsonian Buddhas relief	Wall relief	none	Wall-mounted	not Plan eligible
Future hanging light	Ceiling object	none pinned	No floor footprint	not Plan eligible
- SH3F oracle concept: id#N, name#N, category#N, icon#N, planIcon#N, model#N, width/depth/height#N, creator#N (+ license/shelf in newer libs).
- Harness: SH3F model+dims+optional planIcon → normalize → {OBB, silhouette, semantic} → compare planIcon bounds → human classification.
9. Procedural / Pipeline References
Procedural (Component | Project | File | Algorithm | License | Reuse? → Destination):
- Stairs | primitive-assets | assets/primitives.blend Stairs GN | W/D/H/steps repeat-zone | CC0 | study/reuse possible → Layout semantic stair
- Stairs | blenderStairs | src/ + addon/operators; makeDeploy.py | straight/curved params | Apache-2.0 | legally reusable → prefer TS/compiler reimplementation
- Doors/windows | FreeCAD | Architectural Parts/Doors, Doors_Windows | presets/dims/shape geometry | CC-BY-3.0 | no FCStd runtime → study params for Layout
- Doors/windows | SH3F schema | PluginFurnitureCatalog.properties door/window fields | thickness/cutout/swing | per-lib | schema-only → Layout opening fields
- Rails/terraces/stairs | French Houses | GeometryNodesFrenchHous.blend | foundation/profile GN groups | MIT | study; Blend reusable → reimplement in compiler
- Shelves/cabinets | SH3F | shelfElevations, shelfBoxes, dropOnTopElevation | surfaces/drop zones | schema ref | study → Scene placement metadata
- Display case / plinth | Museum native | none selected | Box/profile dimensions, glass/frame/plinth parameters | first-party | build directly → Scene procedural asset generator, not Layout architecture
- Frames | Museum native | none selected | Width/height/depth/border profile; media plane child | first-party | build directly → Scene procedural asset generator
- Lighting tracks | Museum native | none selected | Rail path + repeated fixtures + light instances | first-party | build directly → Scene procedural system; architecture only supplies mounting context
Pipeline (Need | Repo | Module | Adapt):
- Validation | Khronos Validator | CLI/lib | hard validation + stats pre-promotion
- Dedup | Transform | packages/functions/src/dedup.ts | accessors/meshes/textures/materials/skins; keep unique names
- Texture | Transform | texture-compress.ts | resize/convert; normal-safe
- Quantize | Transform | quantize.ts | KHR_mesh_quantization explicit precision
- Weld | Transform | weld.ts | weld identical verts pre/post-simplify if safe
- Instance | Transform | instance.ts | repeated static meshes → EXT_mesh_gpu_instancing where appropriate
- KTX2 | Transform CLI | packages/cli/src/cli.ts | UASTC normal/ORM; ETC1S color
- Compress/simplify | gltfpack | CLI | Use -cc; add -tc for KTX2; preserve names/materials/extras with -kn -km -ke; -si only after visual budget check
- Blender batch | Objaverse-XL | blender_script.py | manifest: Importer map, scene reset, mesh stats, bounds, linked-file and missing-texture detection, robust failures; lesson: multi-format Blender importer map, scene reset, polygon/vertex/material/object/animation counts, bounds, linked-file inspection, missing-texture detection, deterministic preview camera/render, explicit exception/error output
- Previews | Objaverse-XL | same | standardized framing/render metadata; keep real-world scale, not unit-box normalization
- Packaging | pmndrs/assets | Makefile + src/ | source→dist processing pattern, dynamic package exports; no base64-embedding large Museum Editor assets
- Provenance | Museum adaptation | new manifest | Content hash + source URL + immutable rights evidence + acquiredAt + author + transforms + derivative hashes
pmndrs pattern: src/{fonts,hdri,matcaps,models,normals,textures} + Makefile + bin + package.json; at inspection src/models = bunny.glb ~136KB, pmndrs.glb ~184KB, suzi.glb ~355KB → not furniture source; value = HDR→resized EXR; PNG/JPG/WebP→512 WebP; JSON→minified; GLB→optimize; glTF→GLB; payload→export; Museum adaptation source → immutable record → normalized store → manifest → lazy URL.
gltfpack baseline (https://github.com/zeux/meshoptimizer):
gltfpack -i input.glb -o output.glb -cc -tc -kn -km -ke
# -cc EXT_meshopt_compression; -tc texture conversion to KTX2; -kn keep named nodes/meshes; -km keep named materials; -ke keep extras
gltfpack -i input.glb -o output.glb -cc -tc -kn -km -ke -si <ratio> # only after visual QA
Do not maximize stripping; Node names, material names, animation names, and extras may become future semantic/interaction anchors. Transform primary: https://github.com/donmccurdy/glTF-Transform (dedup, prune, weld-if-safe, quantize, textureCompress/resize, KTX2 CLI, meshopt/draco, instance-only-repeated).
10. Reject / Connector-Only
Source	Class	Reason
ShapeNet	D	Noncommercial/research; not commercial bundle
3D-FRONT/FUTURE	D	Research licensing; layout research only
HM3D/Matterport	D	Academic/noncommercial
Sketchfab bulk	D bundle / B connector	Per-item + platform terms; user connector + rights capture only
BlenderKit/Blendkit mirror	D bundle / B connector	Commercial-use ≠ standalone redistribution
ShareTextures bulk	D	License ≠ site/API/bulk/plugin rights; no scrape/mirror
Poly Pizza bulk	D mirror	Per-asset/platform + anti-scrape; compliant connector only
SH3D 3D Warehouse-derived	D	SH3D rights page warns third-party aggregation bans
Smithsonian Uneasy Crown (Prototype)	D	Object/media third-party/restricted despite Open Access metadata
Amazon Berkeley Objects	C	Conflicting license evidence; resolve snapshot before bundle
pmndrs/market raw	C	MIT app ≠ raw CDN/DB rights; backend not fully inspectable
Khronos testing-only	D	Explicit commercial-deployment ban; check every README/LICENSE; never bulk-copy Models/
Poly potted_plant_01/02 W1	A/defer	CC0 but heavy geo/textures; needs LOD/foliage policy
FreeCAD static doors/windows as Scene	Arch-reject	Attributable but belong as Layout openings, not Scene clutter
Metadata richness → auto-preserve: SH3D 5/5 (dimensions, elevation, model rotation, creator, license, category, icon/planIcon, resizable/deformable/texturable, shelf/drop metadata); Poly Haven 5/5 (asset ID, taxonomy, tags, dimensions, polycount, texel density, authors, file hashes/sizes/dependencies); Smithsonian 5/5 (object ID, title, culture/date/materials, physical dimensions, rights, media rights, source institution); ambientCG 4/5 (asset ID, category/tags, physical dimensions where present, map types, resolution/download metadata); FreeCAD 4/5 (filename/category, dimensions/parameters inside FCStd, author via git/file metadata, CC-BY rights); Kenney 2/5 (pack provenance + filename/category inference; generate rest); Quaternius 2/5 (pack/version/license + filenames after unpack; manual taxonomy); pmndrs 2/5 (filenames/structure; pipeline ref).
11. Implementation Cycle / Harvest Order
Cycle outcome: 32 Scene assets + ~40 material presets + 9 HDRIs + 12 PlanProxy fixtures + evidence records + import CLI/job + thumbnails + taxonomy.
Tasks: P-A1 manifest (RightsEvidence; unknown blocks Approved); P-A2 adapters (polyhaven, local-archive, sweet-home-3d-sh3f; Kenney/Quaternius start as local-archive + manifests); P-A3 normalize (§2); P-A4 PlanProxy (§2 + oracle corpus); P-A5 derivatives (no 8K/16K in visitor); P-A6 curator gate (§2).
Harvest order tomorrow:
1. Poly Haven (12): ArmChair_01, gallinera_chair, folding_wooden_stool, painted_wooden_stool, Sofa_01, painted_wooden_table, round_wooden_table_01, wooden_table_02, side_table_01, Shelf_01, steel_frame_shelves_01, painted_wooden_cabinet
2. Kenney official (9): chair.glb, loungeChair.glb, loungeDesignChair.glb, loungeSofa.glb, loungeDesignSofa.glb, table.glb, sideTable.glb, cabinetBedDrawer.glb, bathroomCabinet.glb
3. SH3D Kator 1.9.3 (11): Futon-couch, Mid-century-bench-sofa, Mid-century-sofa, Mid-century-chair, Chair-ottoman, Bar-stool, Dining-chair, Bench, Cafe-chair, Cafe-table, Folding-table
Quaternius + BlendSwap-CC0 only after inventory tool exists; do not invent members; do not count procedural arch in 32.
12. Source / Reference Index
- Poly Haven API policy: https://polyhaven.com/our-api · Public API: https://github.com/Poly-Haven/Public-API · Assets: https://polyhaven.com/ · materials https://polyhaven.com/a/<id>
- SH3D import: https://www.sweethome3d.com/importModels.jsp · packs: https://sourceforge.net/projects/sweethome3d/files/SweetHome3D-models/ · legal: https://www.sweethome3d.com/legal.jsp
- Kenney: https://kenney.nl/assets/furniture-kit · ambientCG: https://ambientcg.com/
- FreeCAD lib: https://github.com/FreeCAD/FreeCAD-library · assets license: https://github.com/FreeCAD/FreeCAD-library/blob/master/LICENSE-Assets
- Smithsonian: https://www.si.edu/openaccess · https://3d.si.edu/
- Quaternius: https://quaternius.com/packs/furniture.html · https://quaternius.com/packs/ultimatefurniture.html · https://quaternius.com/packs/ultimatehomeinterior.html
- pmndrs/assets: https://github.com/pmndrs/assets · pmndrs/market: https://github.com/pmndrs/market
- Transform: https://github.com/donmccurdy/glTF-Transform · meshoptimizer: https://github.com/zeux/meshoptimizer
- Khronos samples: https://github.com/KhronosGroup/glTF-Sample-Assets · Objaverse-XL: https://github.com/allenai/objaverse-xl
- Primitives: https://github.com/pesaksintondji/primitive-assets-library · French Houses: https://github.com/IRCSS/Blender-Geometry-Node-French-Houses · Stairs: https://github.com/blackears/blenderStairs
13. Research Inventory / Loss Audit
- Projects/tools: Poly Haven, SH3D (+BlendSwap/Kator/Scopia), Kenney (+Nature), ambientCG, pmndrs/assets+market, glTF Transform, meshoptimizer/gltfpack, FreeCAD library, Smithsonian, Quaternius (3 packs), primitive-assets, Objaverse-XL, Khronos samples, French Houses GN, blenderStairs, Khronos Validator, ShapeNet, 3D-FRONT/FUTURE, HM3D/Matterport, Sketchfab, BlenderKit, ShareTextures, Poly Pizza, ABO, PointLight/SpotLight/DirectionalLight, KHR_mesh_quantization, EXT_mesh_gpu_instancing, Meshopt, Draco, KTX2 (ETC1S/UASTC/ORM), EXR/DWAB, PMREM, WebP.
- Quantitative: 140 Kenney files; SH3F 175 CC0 + 90 Kator + 500 Scopia; 1.9.3 date 2024-08-21; FreeCAD ~5 GB; gltfpack v1.1 2026-04-02/master 1.2; pmndrs models 136/184/355 KB; Poly dims/tris (§5: 1.1m/6K, 1.0m/12K, 0.5m/6K, 0.6m/676, 1.6m/4K, 2.4m/600, 1.4m/9K, 1.1m/196, 0.6m/3K, 2.1m/182, 2.1m/4K, 1.2m/2K); Quaternius 23 (2017) + 20 (2019) + 123 (2020); material scales/resolutions (§7); HDRI 16–24K masters → 512–1024 editor + 1K–2K publish, EVs 12/15/17; waves 32 → 40–70 → 10 heroes; auto rates 95%/95%/85–90%; efforts 0–3.
- Unresolved/caveats: SH3F SourceForge members not enumerable → machine inventory post-download; Kenney filenames mirror-cross-checked, authority = official archive; Poly Haven terms snapshot required (old ToS lag); Smithsonian per-media check mandatory; Khronos per-model, never bulk-copy; default branches unpinned → pin SHA + provenance; ambientCG IDs resolve at acquisition time.
- Matrix mapping: Top-15 → §3; Clone sheet (10) → §4; Non-Git sheets (Poly/SH3D/Kenney/Quaternius/Smithsonian) → §4; Wave-1 (32) → §5; Auto/manual → §5; W2 gaps → §6; W3 (10 + 1 reject) → §6; Materials (~42) + policy → §7; HDRIs (9) → §7; PlanProxy (12) + harness + tiers → §8; Procedural (9) + boundary → §9; Pipeline + pmndrs/gltfpack/Objaverse details → §9; Reject (14) → §10; Metadata richness (8) + taxonomy → §2/§10; Cycle outcome + P-A1–A6 → §11; Harvest order (32 names) → §11; Source index → §12.
- Loss audit: row × column + enumeration-closure + protected-token re-audit passes; every original row independently reconstructable; every enumeration member-level (polygon/vertex/material/object/animation counts; Node/material/animation names + extras; -kn nodes/meshes vs -km materials vs -ke extras; icon/planIcon; resizable/deformable/texturable; shelfElevations/shelfBoxes/dropOnTopElevation; Content hash + source URL + rights evidence + acquiredAt + author + transforms + derivative hashes; framing/render metadata); descriptive cells preserved (Rough/damaged plaster; Gallery/event hall neutral; Overcast urban daylight; Nature / cool dawn; Frames + media plane child; Lighting tracks + instances + mounting context); no umbrella substitution; no row merged unless shared fields identical; no remainder needing Raw Notes.