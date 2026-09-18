P23 Staging Research — Compact Reference Artifact
Thesis: Do not make Scene Plan into browser AutoCAD. Make it a precise semantic spatial builder.
LayoutDocument = authored truth. compileLayoutGeometry() = sole compiler. SVG = Plan renderer. Scene/Layout ownership separate. P23 = better semantic ops, precision, snapping, dependent-reference handling, deterministic structure transforms — not new CAD substrate.
Gate: No CAD kernel, constraint solver, Canvas rewrite, BRep through P23 and likely well beyond. Richer ops extend semantic layout + same compiler, never parallel truth.
Final Phase-3 answer: expand much deeper into 2D CAD only along semantic architectural operations. Target: "Figma-level directness + enough CAD precision + floor-planner semantics + agent-addressable commands." Not: "AutoCAD feature count in browser." Boundary = just before persistent global constraints, arbitrary solid topology, BIM-grade relationships.
1. Executive Findings
- Operation architecture first, not widgets. intent → plan all semantic changes → validate whole → preview → commit atomically → one history entry. Precedent: openPlan3D/src/lib/utils/wallEditing.ts:planWallResize() computes connected-corner map, validates all walls, caller applies. Adopt pattern, not geometry impl.
- Direct precision ≠ constraint system. P23: wall length=4.2m, opening width=0.9m, opening offset=1.4m, object X=2.0m, yaw=90°. Reject: permanent parallel/equal/width-locked + solver recompute. LibreCAD = snap + keyboard coordinate/distance entry. FreeCAD Sketcher / SolveSpace = DOF/equations/redundancy/conflicts/convergence/diagnostics; FreeCAD GCS.cpp ~5,000 LOC; SolveSpace = many solver types. Direct precision = P23 MINIMUM. Global solver = REJECT.
- Small snap vocabulary suffices. P23: grid, endpoint/room-corner, midpoint, intersection, nearest-on-wall/reference-segment, orthogonal, opening-edge (while editing openings). Follow-up: parallel, perpendicular, extension, equal-spacing, object center/edge, temporary guide, angle increments beyond orthogonal. Tangent + generalized snaps ≈ zero value for exhibition/showroom v1. LibreCAD full set (grid, endpoint, on-entity, center, middle, distance, intersection, H/V/orthogonal) = reference, do not clone.
- Snap tolerance (CSS px) ≠ topology tolerance (world units). Never share one EPSILON. openPlan3D caution: generous endpoint tolerances + room assumptions → multi-room/T-junction QA failures; now T-junction splitting + planar-face traversal — proves naïve room-graph fragility.
- robust-predicates = strongest small dep. Browser-native, zero-dep, TS declarations, Unlicense, 3.0.3, Shewchuk orient/incircle. Add before any framework. Wrap behind adapter (coordinate-orientation convention); never scatter in UI.
- Flatten.js (@flatten-js/core@1.6.14): prototype/adapt soon. Line/ray/segment/circle/arc/polygon, distance, intersections, transforms, containment, booleans, sets. Good: LayoutDocument → canonical compiled primitives → adapter → Flatten query. Bad: Flatten Polygon = project model.
- Opening attachment = biggest schema decision. openPlan3D: {wallId, position:0..1, width, height} — simple but t unnatural under length change (UI already shows distance-from-A/B). Recommended: {wallRef + physical arc-length offset from canonical start + width} — meters-native, uniform straight/curve, deterministic duplicate/split/mirror/resize, never floats. Migration-sensitive: need exact current wall/room/opening types first; if current = t, expose physical distance while retaining storage; no elegance-only migration.
- Rooms: explicit survives, derived assists. Reject room = inferred polygon. JTS Polygonizer requires noded linework; reports dangles/cut-edges/invalid-rings. Model: LayoutDocument(explicit IDs/ownership) + compiled topology (graph, noded segments, candidate faces, diagnostics) + assist tools (never auto-replace IDs). Preserves room-local ownership.
- Blueprint3D: joins only. Corners/walls/rooms + half-edges; HalfEdge derives interior/exterior corners from thickness/adjacency — good. But same class creates THREE.Mesh/matrices/renderer/planes — violates renderer-neutral boundary. Self-reports rushed, needs serialization/tests/refactor; stale core.
- openPlan3D = best code mine (MIT). wallEditing.ts, roomDetection.ts, alignment.ts, cadExport.ts, hitTesting.ts, outerWalls.ts, projectValidation.ts, roomPresets.ts, roomplanImport.ts, floorStack.ts + browser/geometry tests. Harvest: atomic planning, wall/opening UX, presets, alignment, import normalization, adversarial QA, multi-floor lessons, opening/dimension tests. Reject: giant Canvas Plan, Svelte-store mutation, room-identity, duplicated/render-driven arch, 20-sample quadratic Bézier length (consumer-local resampling to avoid).
- Curves: one canonical evaluator; arcs first. Forbid Plan/3D/snap/dims resampling differently. Layout curve → canonical evaluator/arc-length → compileLayoutGeometry() → shared rep → Plan/Three/snap/dims. First type: circular arc (radius/angle/length/offset/tangent). CavalierContours = line+arc + direct offset.
- Mirror > trim/extend. Mirror (mirror gallery bay / room / wall group across centerline) = one deterministic op. Trim/extend = topology/junction/selection ambiguity. Rank: mirror→early, repeat→early, offset→early/mid, trim/extend→later.
- Arrays/components: bake first. repeatSelection(count,spacing) → N independent copies; Insert Gallery Bay → walls+openings+objects as normal structure. Reject P23: ParametricArrayDefinition/ArrayInstanceOverrides/BrokenArrayItems/NestedArrays, definition/instance/override/nested/versioning (Figma/SketchUp/Revit pressure). Persistent only on repeated "change source once, all 24 bays update". Prove 3–5 families first.
- Offset: bounded, not generic. CavalierContours JS (pure TS, MIT/Apache, line+arc, open/closed offset, 232 translated tests, browser/worker) vs clipper2-ts (TS Clipper2, Boost, offset/boolean/triangulation, 258 ref tests). v1: single straight wall or simple non-branching chain; distance + side + join (miter+limit → bevel → round only with arcs); reject branches.
- No spatial index yet. RBush (MIT R-tree) / Flatbush (static) excellent but overkill; compile primitives → linear scan deterministic at museum scale. Build SnapQuerySource; index after profiling.
- DXF = interchange, never truth. dxf-parser (MIT, browser/Node, most 2D entities/layers/blocks-inserts/text, 1.1.2 old) for import; Maker.js (Apache-2.0, active, DXF/SVG/vector export) for export edge. DXF → parse → candidates → normalize units → semantic conversion → validate → LayoutDocument.
- IFC = future import adapter only. web-ifc (MPL-2.0, active, browser API + types + multithread WASM + worker). IfcBuildingStorey/Wall/WallStandardCase/Slab/OpeningElement/Door/Window → candidates → validate → LayoutDocument. No relationship/BIM-property/geometry-engine internalization.
- BRep threshold far. replicad proves OCCT-in-browser but recommends WASM+worker (expensive); custom OCCT package adds license/runtime. Gate: No BRep until persistent arbitrary solid booleans + fillet/chamfer + STEP roundtrip = core workflow. Walls/rooms/openings/stairs/arcs/extrude/arrays/rails don't justify OCCT.
- AI value = operation vocabulary. KittyCAD/Zoo: typed codemods (src/lang/modifyAst/*.ts clone+modify AST, src/lib/operations.ts prepare ops); human/LLM/codemod-shared intent; Vitest permutations. DeepCAD = ordered command sequences; CAD-Recode = CadQuery programs not meshes. Semantic ops > vertex edits.
2. Key Concepts / Definitions
- Semantic builder vs AutoCAD: authored entities + compiler vs generic kernel.
- Direct precision: one-shot numeric set with explicit anchor; no persistent relation. Persistent constraint: durable solver relation with DOF/conflict — rejected.
- SnapPrimitive (runtime-only, never serialized): {point: wall-endpoint/room-corner/wall-midpoint/opening-edge} or {segment: wall-centerline/wall-face/opening-span} + sourceId.
- WallAttachment: {wallId, offsetFromStart: physical arc-length, width} + Door {height, swing, hinge, side} / Window {height, sillHeight}; curves = arc-length, never Bézier t.
- Explicit vs derived rooms: authored id/ownership/metadata/local-frame vs compiled faces/dangles/cutEdges/invalidLoops/adjacency.
- Baked vs parametric: independent copies vs live definition+instances.
- Tolerances: snap radius (CSS px) vs coordinate-compare / min-segment / intersection-classify / display-rounding (world).
- Operation contract: planLayoutOperation(doc,op,ctx) → Result<PlannedLayoutChange,Error>; PlannedLayoutChange={next|patches, changedIds, createdIds, deletedIds, diagnostics}; no partial writes; preview = no history; one commit = one Layout entry; UI/test/agent callable; no SVG/DOM/Three/selection inside.
3. Current State / SOTA
- Browser planners converge on plan-validate-preview-commit; openPlan3D + failure docs are best evidence.
- Mature 2D CAD (LibreCAD GPL, SH3D GPL fork v7.15.0 2026-06-13 + AI command layer) = interaction/semantics reference, not reuse.
- Predicates (Shewchuk) solved; Flatten/offset (Cavalier/Clipper2)/topology (JTS)/triangulation (Earcut) = modular edges. Arcs before Bézier/NURBS. Interchange at adapter boundary. Agent CAD validates command representation.
4. Relevant Projects / Implementations
#	Project	License	Useful surface	Harvest	P23
1	openPlan3D https://github.com/laanlabs/openPlan3D (https://github.com/laanlabs/openPlan3D)	MIT	wallEditing.ts, roomDetection.ts, alignment.ts, cadExport.ts, hitTesting.ts, outerWalls.ts, projectValidation.ts, roomPresets.ts, roomplanImport.ts, floorStack.ts; wall/opening/room/browser tests	PORT algorithms + tests	Very high
2	robust-predicates https://github.com/mourner/robust-predicates (https://github.com/mourner/robust-predicates)	Unlicense 3.0.3	orient2d, incircle	REUSE	High — now
3	Flatten.js https://github.com/alexbol99/flatten-js (https://github.com/alexbol99/flatten-js)	MIT 1.6.14	point/segment/line/arc/polygon/intersection/distance/containment/boolean	PROTOTYPE via adapter	High
4	CavalierContours JS https://github.com/msurguy/cavalier-contours-js (https://github.com/msurguy/cavalier-contours-js)	MIT/Apache, 232 tests	Polyline, Shape, parallelOffset, closest-point, intersection	AFTER SPIKE	Follow-up
5	LibreCAD https://github.com/LibreCAD/LibreCAD (https://github.com/LibreCAD/LibreCAD)	GPL	rs_snapper.cpp (~1658 LOC), rs_previewactioninterface.cpp, modify/command	STUDY only	High ref
6	Sweet Home 3D https://github.com/mjcipriano/sweethome3d (https://github.com/mjcipriano/sweethome3d)	GPL, fork v7.15.0 2026-06-13 + AI commands	PlanController.java, WallController.java, model/Wall.java, DimensionLine.java, DoorOrWindow, levels	STUDY	High ref
7	Blueprint3D https://github.com/furnishup/blueprint3d (https://github.com/furnishup/blueprint3d)	MIT, stale	model/{floorplan,wall,corner,room,half_edge}.ts, floorplanner/*	CONCEPT (joins)	Medium
8	KittyCAD/Zoo https://github.com/KittyCAD/modeling-app (https://github.com/KittyCAD/modeling-app)	MIT	src/lang/modifyAst/*.ts+specs, src/lib/operations.ts, PRINCIPLES.md	STUDY op arch	Very high agent
9	JTS https://github.com/locationtech/jts (https://github.com/locationtech/jts)	EPL-2/EDL-1	operation/polygonize/Polygonizer.java	PORT algorithm/tests	Room follow-up
10	JSTS https://github.com/bjornharrtell/jsts (https://github.com/bjornharrtell/jsts)	EPL/EDL-family	polygonize/intersection/topology	STUDY (too broad)	Follow-up
11	clipper2-ts https://github.com/countertype/clipper2-ts (https://github.com/countertype/clipper2-ts)	Boost, 258 tests	inflatePaths, booleans, triangulation	OFFSET SPIKE	Follow-up
12	polygon-clipping https://github.com/mfogel/polygon-clipping (https://github.com/mfogel/polygon-clipping)	MIT (deps robust-predicates)	union,intersection,difference,xor	LATER	Profile/import
13	Maker.js https://github.com/microsoft/maker.js (https://github.com/microsoft/maker.js)	Apache-2.0	packages/maker.js/src/core/dxf.ts, chains/paths/export	DXF edge	Deferred
14	dxf-parser https://github.com/gdsestimating/dxf-parser (https://github.com/gdsestimating/dxf-parser)	MIT, 1.1.2 old	parser API/src/	IMPORT edge	Deferred
15	FreeCAD https://github.com/FreeCAD/FreeCAD (https://github.com/FreeCAD/FreeCAD)	LGPL-2.1+, 1.1.1 2026	src/Mod/Sketcher/App/planegcs/GCS.cpp (~5000 LOC)	STUDY solver	Solver ref
16	SolveSpace https://github.com/solvespace/solvespace (https://github.com/solvespace/solvespace)	GPL-3+	src/slvs/lib.cpp, solver API/docs	DO NOT EMBED	Reject solver
17	web-ifc https://github.com/ThatOpen/engine_web-ifc (https://github.com/ThatOpen/engine_web-ifc)	MPL-2.0 WASM+worker	src/ts/web-ifc-api.ts, worker build	FUTURE ADAPTER	Long-term
18	replicad https://github.com/sgenoud/replicad (https://github.com/sgenoud/replicad)	Mixed/LGPL OCCT	sketch/BRep + worker	STUDY ONLY	Avoid now
19	JSCAD https://github.com/jscad/OpenJSCAD.org (https://github.com/jscad/OpenJSCAD.org)	MIT	@jscad/modeling extrusions/booleans/expansions	STUDY extrude	Long-term
20	CAD-Recode https://github.com/nanotarv/CAD-RECODE (https://github.com/nanotarv/CAD-RECODE)	Research — verify	CadQuery program rep	STUDY vocab	Long-term AI
21	DeepCAD https://github.com/rundiwu/DeepCAD (https://github.com/rundiwu/DeepCAD)	Research	cad_json, dataset/json2vec.py	STUDY rep	Long-term AI
22	RBush https://github.com/mourner/rbush (https://github.com/mourner/rbush)	MIT	index.js R-tree; cf. Flatbush static	DEFER until profiled	Later
—	Rejected	—	Turf (GIS wrong abstraction); Concaveman (point-cloud hulls); Delaunator (Delaunay unneeded); Simplify.js (destroys precision; old/stable); JSTS-blanket (too broad); Figma/SketchUp/Revit families; AutoCAD console/selection; Konva/Fabric/Canvas rewrite; CadQuery/OCCT/STEP	REJECT/STUDY	—
SH3D fork note: v7.15.0 2026-06-13 + AI design-assistant command layer → more interesting as interaction/command ref than old SH3D alone.
5. Technical Approaches
5.1 Wall / Room / Opening Models
- Walls (4): centerline+thickness (compact, dims easy; joins derived) | stored boundary polygon (render-direct; edit/join/opening/identity painful) | vertex-edge graph (explicit topology; schema complexity) | parametric segment+thickness+attachments (line/arc+openings/dims; heavier compiler) — best long-term: wall{id, canonical dir, line/arc, thickness, height, attachments} → compiler → joins/faces/cuts/Plan-edges/3D/snap. No P23 storage rewrite unless blocks numeric/opening semantics.
- Rooms (hybrid): explicit Room{id, ownership, metadata, local frame} + derived {subdivision graph, faces, dangles, cutEdges, invalidLoops, adjacency}; ops detectRoomCandidates/createRoomFromFace/validateRoomBoundary/rebindRoomBoundary/splitRoom/mergeRooms; derived never auto-IDs. JTS lesson: noding + diagnostics, not silent cycle-search.
- Openings: offset = arc-length from canonical start (not Bézier t). Transforms: resize (fixed endpoint; offset unchanged; reject/clamp if too short) | reverse (s' = L − s, L/R invert, handedness explicit) | split at k (before→w1, after→w2 offset s−k, crossing→reject/explicit; no orphan) | duplicate (new wallId, remap, preserve offset) | mirror (reflect, recalc dir/offset from mirrored start, transform side/hinge).
- Curves: single canonical arc-length evaluator; arcs first (radius/angle/length/offset/tangent); no Bézier/NURBS.
5.2 Snap Engine
- Flow: pointer CSS → Plan screen→world → X/Z → CompiledLayoutGeometry → SnapPrimitives → tool filter → candidates → rank → SnapPreview → op args → owner plan/validate → one commit. Nothing serialized.
- Rank: tool-validity > semantic priority > screen distance > stable ID. Default endpoint/intersection > opening-target > midpoint/center > orthogonal > nearest-on-entity > grid; contextual: opening-drag opening-edge>endpoint>midpoint>grid; wall-create endpoint>intersection>orthogonal>grid.
- Zoom: worldRadius=snapRadiusCssPx/planScale (same reach 25%–400%); never 0.2m pointer tolerance. Hysteresis: hold until beyond larger release radius (threshold via testing). Agents: semantic refs (alignToWall{center}, moveWallEndpoint{wallEndpoint ref}), same resolver, no fuzzy snap.
- Runtime type (concept, session-only, not LayoutDocument):
type SnapPrimitive =
 | {kind:'point'; sourceId:string; semantic:'wall-endpoint'|'room-corner'|'wall-midpoint'|'opening-edge'; point:Vec2}
 | {kind:'segment'; sourceId:string; semantic:'wall-centerline'|'wall-face'|'opening-span'; a:Vec2; b:Vec2};
5.3 Operation / Gesture / Svelte
- Ops (concept, not current API):
type LayoutOperation =
 | {kind:'wall.setLength'; wallId:string; length:number; fixedEndpoint:'start'|'end'}
 | {kind:'wall.moveEndpoint'; wallId:string; endpoint:'start'|'end'; target:Vec2}
 | {kind:'opening.move'; openingId:string; offset:number}
 | {kind:'opening.resize'; openingId:string; width:number}
 | {kind:'structure.duplicate'; ids:string[]; translation:Vec2};
// follow-up:
 | {kind:'structure.mirror'; ids:string[]; axis:Line2}
 | {kind:'structure.repeat'; ids:string[]; count:number; delta:Vec2}
 | {kind:'path.offset'; ids:string[]; distance:number; side:'left'|'right'};
type PlannedLayoutChange = {next:LayoutDocument; changedIds:string[]; createdIds:string[]; deletedIds:string[]; diagnostics:LayoutDiagnostic[]};
planLayoutOperation(document,operation,context): Result<PlannedLayoutChange,LayoutOperationError>; // no partial writes; patches allowed by store
- setWallLength{wallId,length,fixedEndpoint}: validate finite-positive, nondegenerate, joined-endpoint, openings-valid, topology-allowed; Layout-only; one entry. resizeOpening{openingId,width}: validate min-width, on-wall interval, overlap policy, type; no ref change. duplicateStructure{ids,transform,closure}: validate clonable/complete/legal; two-pass collect stable order → alloc IDs → old→new map → clone → remap → transform → validate → commit once; no Scene mutation. alignLayoutEntities: transform-independent objects only (X/Z, center-on-wall, center-in-bounds); alignScenePlacements writes Scene-only; no mixed-document command. Arrange ownership rule preserved.
- Gesture: pointerdown(capture intent) → move(derive args→plan→transient preview) → up(commit validated, one entry); Esc→discard, zero doc/history (cf. LibreCAD preview/complete, openPlan plan-before-apply).
- Svelte5 concept:
<script lang="ts">let gesture=$state<LayoutGesture|null>(null);
let preview=$derived.by(()=>gesture?planLayoutOperation(layoutDocument,gesture.operation):null);
function commit(){if(!preview?.ok)return; commitLayoutOperation(preview.value); gesture=null;}
function cancel(){gesture=null;}</script>
Hot paths: imperative/worker preview, not huge $derived; state outside SVG DOM.
5.4 Geometry / Execution / Robustness
- P23: existing Museum math + robust-predicates (orientation/collinearity/side); intersections/distances = existing first, Flatten iff gap; booleans/offset/DXF/IFC/BRep = none; triangulation = existing compiler (Earcut only later after validity); index = linear scan.
- Follow-up: offset → Cavalier; booleans → polygon-clipping (deps robust-predicates) or clipper2-ts if offset+boolean convergence; index → RBush iff profiled; DXF import → dxf-parser, export → custom writer or bounded Maker.js. Long-term: Earcut (valid rings only) → web-ifc WASM Worker → no BRep unless gate crossed. Threads: point/segment/snap/predicates/resize/duplicate/mirror/modest-face/bounded-offset = main TS; large topology/DXF = Worker if measured; IFC = WASM Worker; OCCT = deferred. Rust/WASM-only-after-bottleneck upheld.
- Robustness: separate epsilons (compare/min-length/intersection/snap-radius/display-rounding); normalize-first (finite, dup points, zero/near-zero lengths, dup wall refs, invalid opening width/beyond-wall, self-intersection, overlap/collinearity, winding, zero-area); predicate for classification, tolerance only for product "close enough"; sort by stable key; never Date.now() IDs (cf. openPlan detectRooms() anti-pattern).
5.5 Interchange / Advanced (demand-gated)
- DXF import: LINE, LWPOLYLINE/POLYLINE, ARC, CIRCLE, layers, BLOCK/INSERT (if safely flattenable), units → wall/profile/room-boundary candidates → validate; no door/window inference from blocks. Export: wall center/faces, openings, simple dims, layers (custom writer may beat Maker.js). SVG: export yes (PlanRenderModel→SVG); import only reference/bounded profile (appearance ≠ meaning). IFC subset: IfcBuildingStorey/Wall/WallStandardCase/Slab/OpeningElement/Door/Window + normalization; worker/WASM.
- Stairs: not mesh gen; needs source/dest level, elevation, direction, landing, clearance, walkable path, Plan symbol, traversal, supports. openPlan straight/L/U = UI ref only. LONG-TERM.
- Levels: A=world coords + Level{elevation} + levelId tags (simpler interop) vs B=Level-local → rooms-local → objects room-local (stronger hierarchy, changes room-local composition). Need Layout/compile/history/transform types. LONG-TERM.
- Railings: now imported Scene asset; later path+height+profile+post-spacing sharing path/repeat infra; after path/repetition proven.
- Profile/extrude: closed 2D + height (validate simple-closed, no self-intersection, min-edge, winding, holes later; compiler triangulates) for plinth/podium/display-wall/raised-floor/blocking — better than sweep/revolve. Sweep (railing/molding/track/trim) eventually; revolve (column/decor) usually asset; sweep > revolve. Roofs: DEFER (no exterior demand).
- Components: template op → saved template → definition+instance (only if needed) → overrides/nesting (much later).
- Selection/guides: box = drag empty canvas → rect → one rule (intersects OR enclosed, consistently) in doc/render order; defer AutoCAD L→R/R→L (LibreCAD has it). P23 guides = temp extension/orthogonal, dim preview, snap marker+label; follow-up = equal-spacing/parallel/angle; defer rulers/persistent guides unless drafting demand.
6. Comparisons / Tradeoffs
6.1 Evaluation Matrix (researcher scores, 5=best; Cost 5=cheap; Risk 5=safe)
Technology	Arch	Web	TS	SVG	Robust	Semantic	Agent	License	Cost	Maint	LowRisk	Verdict
openPlan3D	5	5	5	1	2	4	3	5	4	5	4	STUDY/PORT SELECTED
robust-predicates	3	5	5	5	5	5	5	5	5	5	5	USE NOW
Flatten.js	4	5	4	5	4	4	4	5	4	5	4	ADAPT SOON
Cavalier JS	4	5	5	5	4	4	5	5	4	4	4	PROTOTYPE
clipper2-ts	3	5	5	5	5	3	4	5	4	4	4	PROTOTYPE LATER
LibreCAD	5	1	1	2	5	4	3	1	1	5	2	STUDY
Sweet Home 3D	5	2	1	2	4	5	4	1	1	5	2	STUDY
Blueprint3D	4	4	3	1	2	3	2	5	3	1	2	STUDY
JTS/JSTS	4	3	2	5	5	3	3	4	2	5	3	STUDY/BOUNDED
Maker.js	3	5	4	5	3	3	4	5	3	4	3	DEFER
dxf-parser	3	5	4	5	2	2	3	5	4	2	4	DEFER
FreeCAD	5	1	1	1	5	5	4	3	1	5	1	STUDY
SolveSpace	4	1	1	1	5	5	4	1	1	5	1	AVOID DEP
web-ifc	4	5	4	3	5	5	4	3	1	5	3	DEFER
replicad/OCCT	4	4	5	1	5	3	5	2	1	5	1	AVOID NOW
KittyCAD/KCL	3	5	5	2	5	5	5	5	1	5	2	STUDY OP MODEL
6.2 Capability → Bucket (Best ref | Reusable | Complexity | Risk)
- P23 MINIMUM: wall length (LibreCAD/openPlan | own+op | L-M | Low); thickness (openPlan/SH3D | own | L | Low); opening width/offset (SH3D/openPlan | own op | M | M); unit parse/display (LibreCAD | own central | M | Low); transient dims (LibreCAD | SVG+render | L | Low); grid/endpoint/midpoint/orthogonal (LibreCAD | own+predicates | L | Low); intersection (LibreCAD | own/Flatten | M | Low); wall projection (LibreCAD | Flatten/own | L-M | Low); align-to-ref (openPlan/Figma | pure op | L | Low); endpoint edit (floor planners | own | M | M); attachment (SH3D/openPlan | own | M | M); duplicate (CAD/floor | graph clone | M | L-M); presets Column/Platform/Plinth (floor planners | existing primitive | L | Low, only if primitive exists).
- FOLLOW-UP: persistent dims (Med/Med, iff drafting demand); parallel/perp (Med/Low); smart guides (Med/Low); distribution (Low/Low, cheap); repeat-baked (L-M/Low, promote early); mirror (M/L-M, promote early); bounded offset via Cavalier (M-H/Med, after spike); box select (L/Low, enabler); templates (L-M/Low); trim (High/High, late) / extend (M-H/High, late); room-face assist via JTS (High/Med); SVG export (L/Low, edge).
- LONG-TERM/demand: circular arc (High/M-H); stairs/levels/railings (High–VHigh/High–Med); persistent array (High/High); definition/instance (VHigh/High); profile/extrude via Earcut (High/Med); sweep (VHigh/High); revolve (High/High, low prio). DEFER: Bézier/NURBS (VHigh/High); roofs; CAD crossing selection (Low/UX-cost). REJECT: SVG semantic import (High-ambiguity/High); global solver (Extreme); BRep/STEP (Extreme). Joins = existing/foundation (M-H/High, own compiler).
6.3 Data-Model Pressure
- NO CHANGE: numeric UI, unit parse/format (unless persisting display units), transient dims, grid/object snap (derived), transient guides, align, duplicate, baked repeat, mirror (no persistent relation), bounded-offset→normal-walls, room-face assist (derived), templates, DXF/SVG/IFC adapters, SVG export.
- SMALL/migration: wall-relative opening; circular segment (small-or-major by wall model); column/platform iff primitive exists.
- NEW ENTITY: persistent dims; persistent array (definition+generation); stairs; procedural railing; profile/extrude (profile+height/material); persistent guides/offset-relation (unnecessary).
- MAJOR/REJECT: persistent symmetry, derived-room-as-truth, levels, global constraints, BRep; SVG-semantic-import = avoid.
6.4 Offset / Mirror / Trim
- Bounded offset v1 (single/chain, miter→bevel→round-later, reject branches) vs generic polygon tool — former only. Mirror (point/endpoint/yaw reflect + winding + opening remap + hand rule, source untouched, one entry, no persistent relation) — early. Trim/extend late: resolve semantic-wall identity, openings beyond trim, multi-room membership, behind-start intersections, crossed topology, room-boundary change, corner migration.
7. Evidence and Benchmarks
- Solver cost: GCS.cpp ~5,000 LOC; SolveSpace multi-type solver; rs_snapper.cpp ~1,658 LOC (GPL — study only).
- Versions/tests: predicates 3.0.3; Flatten 1.6.14; Cavalier 232 tests; Clipper2 258 tests; dxf-parser 1.1.2 (old); SH3D 7.15.0 2026-06-13; FreeCAD 1.1.1 2026.
- openPlan3D: generous tolerances → multi-room/T-junction failures (now T-split + face traversal); detectRooms() Date.now() IDs (do not port); 20-sample quadratic length (do not port); unit/display inconsistencies → fixture class.
- polygon-clipping deps robust-predicates; Earcut requires pre-validated rings.
8. Required Reliability Tests — Concrete Fixtures Preserved
- T1 Precision — setWallLength happy path. Input: wall.length=3m; op=setWallLength(wall,4m,fixed=start). Expected: start unchanged; end deterministic; connected-endpoint semantics preserved; Plan + 3D compiled from same geometry agree; one layout history entry. Purpose: numeric-edit correctness + parity + atomic history.
- T2 Reject — zero length. Input: setWallLength(wall,0). Expected: error; document byte/structural equality unchanged; no history entry. Edge: degenerate/non-finite/positive guard. Purpose: no partial mutation on invalid input.
- T3 Unit parsing — metric/imperial invariance. Input: display=metric; enter "4.2 m" → canonical internal value; switch display=imperial. Expected: same authored geometry; only formatting changes. Evidence: openPlan QA found unit/display inconsistencies across dimension surfaces → explicit fixture class. Purpose: parse/format centralization, no persisted display units.
- T4 Snap zoom invariance. Input: pointer 5 CSS px from endpoint at 50% zoom; same pointer 5 CSS px from endpoint at 400% zoom. Expected: same snap candidate both zooms via worldRadius=snapRadiusCssPx/planScale. Purpose: screen-space tolerance, never world tolerance=0.2m for pointer UX.
- T5 Snap tie — deterministic priority. Input: endpoint and grid at same screen distance. Expected: documented semantic priority wins (endpoint > grid); same result every run (tie-break: tool-validity > priority > distance > stable ID). Purpose: no flicker/randomness.
- T6 Snap cancellation — Esc discards preview. Input: drag wall endpoint → snap preview appears → Esc. Expected: LayoutDocument unchanged; history unchanged. Purpose: preview produces no history; gesture cancel semantics.
- T7 Opening move — along-wall drag. Input: door offset=1.2m; drag along same wall. Expected: wallId same; new offset deterministic; width unchanged; one history entry. Purpose: attachment preservation + atomic commit.
- T8 Wall shrink around opening — reject, no silent fix. Input: wall contains 0.9m door; op=shrink wall below legal opening interval. Expected: operation rejected; no partial wall move; do not silently delete/move opening. Edge: overlap/out-of-wall policy must be explicit/validation-state. Purpose: dependent-reference integrity.
- T9 Wall split — reference transfer. Input (if split supported): wall length=6m; opening center=4m; split at k=3m. Expected: opening transferred to second wall; new offset=1m (4−3); source reference gone; new reference valid; one transaction. Edge: opening crossing split → reject or explicit resolution; no silent orphan. Purpose: deterministic split rule.
- T10 Duplicate — room closure remap. Input: room{4 walls, 1 door, 2 windows, 3 Layout objects}; op=duplicate. Expected: every cloned ID new; all internal refs point to clones; no clone references source wall; source untouched; SceneDocument untouched. Method: two-pass collect stable order → alloc IDs → old→new map → clone → remap → transform → validate → commit once. Purpose: reference integrity + Layout/Scene ownership.
- T11 Duplicate + room-local Scene — no Scene leak. Input: source room owns Scene Chair A; op=duplicate Layout room. Expected: Chair A not duplicated; SceneDocument byte-equivalent. Unless later explicit composite op says otherwise. Purpose: visitor isolation / ownership boundary.
- T12 Mirror — handedness rule. Input: asymmetric room + left-hinged door; mirror around vertical axis. Expected: geometry reflected; valid door attachment (offset recalculated from mirrored canonical start, direction recalculated); handedness follows defined mirror rule; source unchanged. Purpose: deterministic mirror incl. side/hinge transform; one Layout entry; no persistent relation.
- T13 Offset — pathological bake-off. Inputs (run same fixtures through both cavalier-contours-js and clipper2-ts): single segment; L-chain; acute corner; obtuse corner; near-collinear chain; tiny segment; self-intersecting input; offset collapse; large coordinates; very small offset; arc+line chain (later). Expected: compare line chains, acute joins, self-intersections, collapse, arc support, performance, deterministic output, bundle cost. Hypothesis: Cavalier wins if circular arcs canonical; Clipper2 stronger if polygon shells dominate. Purpose: bounded-offset library choice; reject ambiguous branches rather than guess (miter+limit → bevel → round only with arcs).
- T14 Room assist — topology family. Inputs: rectangle; L-shape; two rooms sharing wall; T-junction divider; grid of 10 rooms; dangling interior wall; overlapping wall; self-intersecting loop; hole/courtyard (later). Expected: faces/dangles/cutEdges/invalidRings reported (JTS Polygonizer behavior as reference); compare against explicit Room entities; validation/candidate creation only, never auto-replace IDs. Evidence: catches failures documented by openPlan earlier QA. Purpose: noding + diagnostics, not inferred ownership.
- T15 Plan/3D parity — single source. Input: every compiled architectural fixture. Expected: Plan boundary identities + 3D wall-adapter boundary identities + snap geometry references all derive from same CompiledLayoutGeometry; no consumer-side remeasurement. Purpose: enforces compileLayoutGeometry() contract.
9. Product Implications
- P23 Minimum (P23.0–P23.7): P23.0 op boundary → P23.1 numeric wall (length/thickness/angle-or-endpoints, anchor endpoint; no room W/D promise) + opening (width/position, existing height/sill) + objects (X/Z/yaw, no ownership move) + central units + selected/transient dims → P23.2 snap (grid/endpoint/midpoint/intersection/nearest-on-wall/orthogonal/opening-edge; CSS-px; compiled source) → P23.3 opening drag/resize/numeric/flip with attachment + deterministic reject → P23.4 duplicate (room+structure+dependent openings+explicit objects; two-pass; Scene untouched) → P23.5 targeted align (X/Z, center-on-wall, center-in-bounds; Scene equiv separate) → P23.6 presets (Column/Platform/Plinth only if existing primitive; else defer) → P23.7 gate (T1–T15 incl. degenerate refs, zoom snap, cancel, one-op-one-entry, parity). Non-scope: persistent dims, rulers/guide-objects, mirror/offset/trim/arrays/components, curve migration, stairs/levels/railings/extrude, DXF/IFC, solver/BRep/WASM-kernel.
- Follow-up rank (Human/Agent/Reuse/Cost/Safe): 1 Mirror 5/5/5/4/4 EARLY; 2 Repeat-baked 5/5/5/5/5 EARLY (bays/columns/dividers/windows/shelves; cheaper than roadmap implies); 3 Richer snap+temp guides 5/4/4/4/5 PROMOTE; 4 Bounded offset 4/5/5/3/3 AFTER SPIKE; 5 Box select 4/2/4/5/5 enabler; 6 Distribute 4/5/5/5/5 cheap; 7 Persistent dims 3/2/3/3/3 iff drafting demand; 8 Trim/extend 3/4/3/2/2 later; 9 Arc wall 4/5/5/2/2 demand-gated; 10 Levels 5/5/5/1/1 LONG-TERM.
- Agent moat verbs: createRoom/setWallLength/setWallThickness/moveWallEndpoint/addOpening/setOpeningWidth/moveOpening/duplicateStructure/repeatStructure/mirrorStructure/alignToWall/offsetWallChain shared by human/agent/tests.
- Do-not-build (10): global solver (persistent graph, over/under-constraint, conflict UI, convergence, ordering, schema, agent conflicts — FreeCAD/SolveSpace scale); BRep kernel (second truth, WASM lifecycle, bundle, worker, CAD debugging — until STEP/solid trigger); general user booleans (internal extrude need ≠ Union/Subtract/Intersect tool); persistent command console (LibreCAD CLI good for pros; Museum uses Inspector/inline/agent API); full annotation (styles/leaders/paper/plot/title); full BIM graph (MEP/loads/cost/phases/codes/coordination; IFC stays edge); STEP authoring (only if manufactured wedge); generic mesh edit (permanent non-goal); inferred room ownership (inside-polygon ⇒ roomId conflicts with explicit ownership/room-local transforms); Canvas/Konva/Fabric rewrite (SVG sufficient; Blueprint/openPlan Canvas mixing not advantage).
10. Risks / Limitations / Unresolved
- Blocking facts (need before migration brief): (1) exact LayoutDocument wall/room/opening/object types; (2) compileLayoutGeometry() I/O incl. joins/openings/room frames; (3) Layout history/transaction/mutation API; (4) Plan pointer/snap transforms.
- Schema pending those: opening t vs arc-length migration (expose-physical-first?); wall rewrite iff blocks numeric/opening; arc-extension size; preset feasibility; Level A vs B.
- Fragility: single-epsilon, consumer resampling, timestamp IDs, silent orphan/delete, mixed-document commands, inferred ownership, persistent symmetry/offset, solver/BRep creep. Trim/extend ambiguity; stairs/levels without elevation/traversal; components/arrays before families; rulers before drafting demand; DXF door inference; SVG-semantic ambiguity; IFC variance.
11. Recommendations
- Harvest: openPlan3D files/tests (§4); LibreCAD snapper/preview/modify/command; SH3D Plan/Wall/DimensionLine/DoorOrWindow + AI/levels; Blueprint3D joins (avoid Three); KittyCAD modifyAst/specs/operations/PRINCIPLES.
- Spikes: A Snap kernel (grid/endpoint/midpoint/intersection/projection/orthogonal on CompiledLayoutGeometry + predicates ± Flatten; test T4–T6 + degenerate; gate = no schema change) | B Wall/opening harness (resize/reverse/split/duplicate/mirror + one door/window; covers T1/T2/T7–T9/T12; decides opening survival; most important) | C Clone/remap (room+walls+openings+objects+external refs; covers T10–T11) | D Offset bake-off (T13 fixtures; Cavalier vs Clipper2) | E Room assist (noded segments → {faces,dangles,cutEdges,invalidRings} vs JTS; covers T14).
- Stack: P23 = existing math + predicates (+Flatten iff gap); follow-up = Cavalier, polygon-clipping/clipper2-ts, RBush iff profiled, dxf-parser/custom-export; long-term = Earcut-validated, web-ifc worker, no BRep. Reject Turf/Concaveman/Delaunator/Simplify/JSTS-blanket.
- Scope: §9 Minimum; queue Mirror → Repeat+Distribute → Guides/snaps → Offset → Box-select → Room-diagnostics → Trim/extend; defer curves/persistent-dims/levels/stairs/railings/components/extrude/DXF/IFC/solver/BRep.
12. Source / Reference Index
- openPlan3D https://github.com/laanlabs/openPlan3D — wallEditing.ts, roomDetection.ts, alignment.ts, cadExport.ts, hitTesting.ts, outerWalls.ts, projectValidation.ts, roomPresets.ts, roomplanImport.ts, floorStack.ts, tests/browser/wall-dimensions.spec.ts, tests/wall-editing*, tests/opening*, tests/room*
- robust-predicates https://github.com/mourner/robust-predicates — orient2d, incircle
- Flatten.js https://github.com/alexbol99/flatten-js
- CavalierContours JS https://github.com/msurguy/cavalier-contours-js — Polyline, Shape, parallelOffset
- LibreCAD https://github.com/LibreCAD/LibreCAD — rs_snapper.cpp, rs_previewactioninterface.cpp
- Sweet Home 3D https://github.com/mjcipriano/sweethome3d — PlanController.java, WallController.java, model/Wall.java, DimensionLine.java
- Blueprint3D https://github.com/furnishup/blueprint3d — model/{floorplan,wall,corner,room,half_edge}.ts, floorplanner/*
- KittyCAD/Zoo https://github.com/KittyCAD/modeling-app — src/lang/modifyAst/*.ts+specs, src/lib/operations.ts
- JTS https://github.com/locationtech/jts — operation/polygonize/Polygonizer.java
- JSTS https://github.com/bjornharrtell/jsts
- clipper2-ts https://github.com/countertype/clipper2-ts — inflatePaths
- polygon-clipping https://github.com/mfogel/polygon-clipping
- Maker.js https://github.com/microsoft/maker.js — packages/maker.js/src/core/dxf.ts
- dxf-parser https://github.com/gdsestimating/dxf-parser
- FreeCAD https://github.com/FreeCAD/FreeCAD — src/Mod/Sketcher/App/planegcs/GCS.cpp
- SolveSpace https://github.com/solvespace/solvespace — src/slvs/lib.cpp
- web-ifc https://github.com/ThatOpen/engine_web-ifc — src/ts/web-ifc-api.ts
- replicad https://github.com/sgenoud/replicad
- JSCAD https://github.com/jscad/OpenJSCAD.org — @jscad/modeling
- CAD-Recode https://github.com/nanotarv/CAD-RECODE
- DeepCAD https://github.com/rundiwu/DeepCAD — cad_json, dataset/json2vec.py
- RBush https://github.com/mourner/rbush — index.js (+ Flatbush, Earcut, Turf, Concaveman, Delaunator, Simplify.js evaluated)
13. Research Inventory (Loss-Check)
- Projects/tools (all retained): §4 list incl. Figma/SketchUp/Revit/AutoCAD/Konva/Fabric/Canvas/SVG/Three/Svelte-runes/Vitest/WASM/Worker/BRep/STEP/IFC/DXF/BIM/MEP/NURBS/Bézier/Shewchuk/R-tree/Delaunay.
- Sources/links: 22 repo URLs + file/API surfaces in §4/§12; SH3D AI layer; replicad worker guidance; polygon-clipping→predicates dep; Earcut validity caveat.
- Benchmarks/quantitative: GCS ~5,000 LOC; snapper ~1,658 LOC; Cavalier 232; Clipper2 258; predicates 3.0.3; Flatten 1.6.14; dxf-parser 1.1.2; SH3D 7.15.0 2026-06-13; FreeCAD 1.1.1; 20-sample quadratic; worldRadius=px/scale; follow-up/evaluation scores.
- Unresolved: 4 codebase facts + opening/wall/level/preset/arc decisions; offset-winner conditional; hysteresis threshold via testing.
- Original matrices → preservation: Ranked shortlist (22) → §4; Evaluation (16×12) → §6.1; Capability (~37) → §6.2; Wall 4-model → §5.1; Room hybrid + 6 ops → §5.1; Opening subtypes + 5 rules → §5.1; P23.0–P23.7 + non-scope → §9; Follow-up (10) → §9; Mirror/Offset/Trim → §6.4; Stack P23/follow-up/long-term → §5.4; Snap flow/primitives/ranking/zoom/hysteresis/agent → §5.2; Op/gesture/Svelte/contracts + 4 specs → §5.3; Data-model pressure (~32) → §6.3; Stairs/Levels(A/B)/Railings/Extrude/Sweep/Revolve/Roofs/Components/Box-select/Guides/DXF/SVG/IFC/Worker/Robustness → §5.4–§5.5; Reliability tests T1–T15 with exact inputs/outputs → §8; Do-not-build (10) → §9; Harvest (5) + Spikes (A–E) + blockers + shelf + CAD boundary (core/advanced/interchange/stop) → §10–§11.
- Loss audit: section-by-section diff vs original A–L + closing brief passes; every table cell relationship kept as field (verdicts, harvest modes, licenses, complexities, risks, buckets preserved, not collapsed); T1–T15 exact inputs, outputs, invariants, and edge conditions preserved in compressed syntax (§8) — no fixture replaced by general rule; duplications merged only with unique qualifiers kept; no remainder — no Additional Notes needed.