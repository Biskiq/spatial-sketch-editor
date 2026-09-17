# P26 Phase 2 — Bonsai / IfcOpenShell View, Identity and RCP Harvest

## 1. Harvest scope and repository state

- Repository: local clone at `IfcOpenShell/` (sibling of `spatial-sketch-editor-3/` in parent workspace).
- Commit SHA: `998060b686e22297a04eabb8154f50fdf5868641`
- Branch: `v0.9.0` (detached/tagged state; log date 2026-09-16).
- License: **split licensing** — library code (everything except Bonsai): **LGPL-3.0-or-later**; Bonsai (`src/bonsai/`): **GPL-3.0-or-later** (per `AGENTS.md` "Licensing" section; root `COPYING` = GPL-3, `COPYING.LESSER` = LGPL-3). **License boundary:** Bonsai (the drawing/UI/raycast code this harvest inspects) is GPL-3.0 — stricter than FreeCAD's LGPL-2.1. Patterns and architecture may transfer; do not copy Bonsai source into Museum Editor without license review. Nothing here reproduces Bonsai code beyond short factual references.
- Inspected subsystems (primary evidence; five parallel harvest traces + direct verification of load-bearing claims):
  - `src/bonsai/bonsai/bim/module/drawing/{prop,operator,decoration,ui,annotation,data,sheeter,svgwriter}.py`
  - `src/bonsai/bonsai/tool/drawing.py` (3032 lines) and `src/bonsai/bonsai/tool/raycast.py` (1674 lines)
  - `src/bonsai/bonsai/bim/module/context/{prop,operator,data}.py`
  - `src/ifcopenshell-python/ifcopenshell/util/representation.py` (523 lines, full read)
  - `src/ifcopenshell-python/ifcopenshell/util/{placement,element}.py` (targeted), `api/{context,spatial}/`
  - Tests: `src/bonsai/test/{tool/test_drawing.py, core/test_drawing.py, bim/module/drawing/, bim/feature/drawing.feature}`
- Deliberately not re-harvested: section boolean mechanics (FreeCAD harvest covers them), full IFC schema, import/export, MEP/structure. C++ serializer internals (`IfcOpenShell-draw` SvgSerializer) were not read — its Python-side settings and outputs were.
- Prior context: P26 Phase-1 compact artifact (hypothesis source only) + completed FreeCAD harvest (comparison baseline only).

## 2. Executive findings

1. **TargetView is an IFC enum, not a Bonsai invention — and it is policy, not pipeline.** `IfcGeometricProjectionEnum` (`PLAN/REFLECTED_PLAN/SECTION/ELEVATION/MODEL/...`) fans out to ~12 branch sites (annotation parent context, linework context priority, ±2 mm Z-offsets, RCP Y-mirror, negated camera matrix, reference harvesting, location-hint domains, UI grouping). The cut/HLR core itself is **shared and view-blind**: `auto-section`/`auto-elevation` are hardcoded `False`, and section-vs-elevation differences arrive solely via the camera element's placement/extents. *Observed (§3, §4).*
2. **RCP is "flipped Plan plus three small deltas" — not a distinct pipeline.** RCP shares Plan's context set, storey hints, and generation path; it differs by exactly: Z-negated camera matrix (`tool/drawing.py:858-860`), `svg-mirror-y` serializer flag (`operator.py:1428-1429`), −2 mm (vs +2 mm) Z-offset (`operator.py:700-712`), and `mat[1][1]` negation on camera import (`tool/drawing.py:1021-1028`). There is **no ceiling/slab type special-casing anywhere in the drawing/view code** (verified by grep). Cut height is an explicit `storey.Z + 1.6 m`. *Observed (§5). This is the harvest's most P26-relevant result: Ceiling Focus as lightweight orthographic policy is precedented, not a compromise.*
3. **Identity is threaded as an integer key through 3D and as a guid token through SVG — and Bonsai beats FreeCAD on the drawing side.** Blender objects hold `BIMObjectProperties.ifc_definition_id` (int, `bim/prop.py:744-746`); derived cut caches are keyed by `element.id()`; SVG groups carry `ifc:guid` + `ifc:name` by construction (`operator.py:743-745`) and re-resolve via `get_element_by_guid` (`:1500-1510`). But: raycast returns Blender objects, never IFC entities (callers resolve via `tool.Ifc.get_entity`); merged linework unions multiple guids into one class set (1:1 path→entity gone); openings are unconditionally excluded from drawings (`tool/drawing.py:2433`); cut-overlay pixels are not pickable. *Observed (§6, §7).*
4. **Raycast is a snap engine, not a selection resolver — and that separation is the pattern to copy.** `tool/raycast.py` (1674 lines, GPU colour-ID + CPU `obj.ray_cast` duality) returns snap dicts carrying `{"object", "face_index", ...}`; zero IFC references inside; zero type checks for Opening/Door/Window. Clipped geometry maps back to its **host** object (cut triangles re-anchored to host in `tool/snap.py:153-201`). A wall-void hit never resolves to the opening/filling — the void graph (`HasOpenings`/`FillsVoids`) is navigated only in modeling/import/QTO paths. *Observed (§7, §10).*
5. **Annotations/decorators are three cleanly separated layers: persisted annotation → cached snapshot → ephemeral GPU overlay.** Authored = `IfcAnnotation` + rep + psets + drawing-group membership. Instrumentation = `DecoratorData` caches + winspace batches + separately-registered gizmos. Decorators never write back; gizmos edit through ops. The SVG writer emits **no per-entity `id=`** — GlobalId survives only as a `GlobalId-<guid>` CSS class token. *Observed (§12). This is the strongest precedent for P26's "temp dims/handles stay instrumentation" rule.*
6. **IFC representation contexts mean one element can carry several fit-for-view geometries — a real second-truth hazard with only conventional guards.** A door ships 3D body + 2D plan swing + elevation + clearance box in different (identifier, TargetView) buckets (`api/context/add_context.py:35-45` docstring). Display resolves via pinned `Model/Body/MODEL_VIEW` or priority fallback (`get_prioritised_contexts`, `representation.py:358-425`); each element draws once from its highest-priority rep. No cross-context consistency validation exists. *Observed (§9). Museum Editor should reject authored per-view geometry and keep the pinned-single-truth half of the pattern.*
7. **Storey is a convenient datum, never a cutting prerequisite — P26's defer-Levels direction is supported.** Sections/elevations build from cursor + cardinal direction with zero Storey involvement; absolute placement resolves through `PlacementRelTo` chains independent of containment; containment (`IfcRelContainedInSpatialStructure`) is a 0..1 scheduling/FM link; plan/RCP use `storey.Z + 1.6 m` with origin fallback. `svg-without-storeys=True` is hardcoded. *Observed (§11).*
8. **Depth/crop is split-brain here too — differently.** Four independent inclusion mechanisms disagree: Blender `clip_start/clip_end` frustum slab, `Include/Exclude` selector queries (frustum wins over Include), representation-context filter (wrong-context geometry silently drops), serializer-internal prefilter/subtract. No unified view-range object. Same disease class as FreeCAD's dropped `Depth`, different symptoms. *Observed (§8).*

## 3. View taxonomy and target-view model

### 3.1 Canonical definition (Observed)

- TargetView is the IFC `IfcGeometricProjectionEnum`: `GRAPH_VIEW, SKETCH_VIEW, MODEL_VIEW, PLAN_VIEW, REFLECTED_PLAN_VIEW, SECTION_VIEW, ELEVATION_VIEW, USERDEFINED, NOTDEFINED` — bound in Python (`express/rules/IFC4.py:1000-1009`, mirrors in IFC2X3/IFC4X3 bindings), with normative semantics in `express/DocEnumeration.csv:3211-3251` (PLAN = ground view from above; RCP = same content from below; SECTION = cut-element edges; ELEVATION = bounding edges; MODEL = full 3D body).
- Python typing mirror: `TARGET_VIEW` Literal, all 9 values (`util/representation.py:45-55`, verified by direct read).
- Bonsai narrows to 5 for drawings: `TargetView = Literal["PLAN_VIEW","ELEVATION_VIEW","SECTION_VIEW","REFLECTED_PLAN_VIEW","MODEL_VIEW"]` + `TARGET_VIEW_ITEMS` (`bim/module/drawing/prop.py:284-291`, verified). Reused for Drawing (`:297-301`), DocProperties (`:420-425`), camera props (`:590-595`). The full 9-value enum survives only in the context module (`bim/module/context/prop.py:50-63`).
- Comparison with FreeCAD: FreeCAD has one class and no enum — form is derived from orientation. Here orientation is a **first-class stored value** (IFC pset `EPset_Drawing.TargetView`, read at `tool/drawing.py:785-786`, synced both ways `prop.py:233-253` / `tool/drawing.py:1073-1146`), and orientation matrices are **derived from it** — the dependency runs opposite to FreeCAD's.
- P26 implication: P26 needs an explicit view-kind column (mirroring this enum's 5 drawing values), not a derived flag. Storing kind + deriving matrices/camera is the precedented direction.

### 3.2 Consumer matrix — what actually branches per view (Observed)

| Branch site | Per-view delta |
|---|---|
| `tool/drawing.py:670-706` annotation-context routing | PLAN/RCP → `Plan/Annotation` parent; all others → `Model/Annotation` (except FALL/SECTION_LEVEL/PLAN_LEVEL types, forced Model) |
| `operator.py:609-678` linework context priority | PLAN/RCP → 4-tier Plan+Model lists; rest → Model-only lists; MODEL_VIEW fallback always appended |
| `operator.py:700-712` Z-offset | Plan-context geometry +0.002 (PLAN) / −0.002 (RCP); rest 0 — the only numeric PLAN-vs-RCP geometry delta outside matrices |
| `operator.py:1428-1429` serializer | `svg-mirror-y=True` for RCP only |
| `tool/drawing.py:1021-1028` camera import | RCP negates `mat[1][1]`; rest identity |
| `tool/drawing.py:1838-1856`, `:2015-2025` reference lines | PLAN/RCP → `clip_segment` (+Z=0); SECTION/ELEVATION → `elevate_segment`; MODEL keeps Z |
| `tool/drawing.py:2541-2565` context filters | PLAN/RCP → 12 filters (Plan+Model); rest → 6 Model-only |
| `tool/drawing.py:1601-1706` reference harvesting | SECTION/ELEVATION additionally pull Storeys + cross-referenced section/elevation drawings; rest skip |
| `data.py:125-135`, `ui.py:97-99` location-hint domains | PLAN/RCP = storey-id int; SECTION/ELEVATION = N/S/E/W; MODEL = Ortho/Persp |
| `tool/drawing.py:446-450` camera volume | MODEL `clip_end = max(viewport,10)`; rest fixed 10 |
| `prop.py:233-236` camera type | any non-MODEL TargetView forces `ORTHO` |

- No view has distinct clipping-plane/range properties: the camera block carries only raster/width/height/dpi/ortho_scale/clip_end (`prop.py:597-623, 691-724`). "Range" as a concept does not exist; cut behavior comes from camera frustum + serializer settings.
- Inferred: the branch sites cluster into **context set** (which rep buckets serialize), **projection** (matrix + mirror + offset), and **reference policy** (what gets pulled in) — never into cut semantics. Cut is uniform; views differ in what surrounds the cut.
- P26 implication: P26's per-view table should enumerate context-set + mirror + offset + hint-domain, not cut-range. No per-view cut table is needed.

### 3.3 Camera/orientation rules (Observed, directly verified)

- `update_camera_matrix(matrix, dir, up)` (`tool/drawing.py:832-845`): negates dir (Blender looks down −Z), sets right = up×dir.
- `generate_drawing_matrix(target_view, location_hint)` (`:848-901`, verified by read): int hints (PLAN/RCP only) use storey Z + 1.6 m translation, identity rotation for PLAN, Z-negated (`m.col[2] *= -1`) for RCP; ELEVATION cardinals look −Y/+Y/−X/+X (N/S/E/W); **SECTION cardinals look the exact opposite** (+Y/−Y/+X/−X) — a section looks *into* the cut from the named side; MODEL returns the viewport matrix verbatim (persp or ortho pass through).
- Pinned by `test/tool/test_drawing.py:561-662` for every (view, hint) pair at cursor (1,2,3) — the strongest invariant set in the harvest.
- Comparison with FreeCAD: FreeCAD derives form from an orientation vector; Bonsai stores a per-(view,hint) rotation table with RCP as a Z-flip, not a rotation. Both converge on "orientation parameterizes one core," but Bonsai's table is explicit and test-pinned where FreeCAD's is emergent.
- P26 implication: spec RCP as PLAN translation + Z-negation + Y-mirror at serialization, and Section as anti-Elevation direction. Both are now pinned conventions, not design choices to re-derive.

### 3.4 Persistent vs transient (Observed)

- Persistent (IFC): drawing = `IfcAnnotation(ObjectType="DRAWING")` (`core/drawing.py:297-304`); TargetView in `EPset_Drawing` (`core/drawing.py:324-342`, read back with MODEL_VIEW default); camera volume as body-rep shape matrix; project template contexts (`core/project.py:58-95`: 7 Model + 4 Plan incl. `Plan/Annotation/RCP`); annotation geometry in Plan- vs Model-Annotation subcontexts.
- Transient (Blender-only): `BIMCameraProperties` (`prop.py:497-623`) with a `representation` JSON fingerprint `{type, matrix, raster, ortho_scale, clip_end}` (`:660-689`); list/UI state (`is_expanded/is_selected`); viewport isolation; context priority order (runtime policy, `representation.py:391-425`).
- Known drift: IFC pset vs Blender props are duplicated with documented drift (`tool/drawing.py:1030-1032`).
- P26 implication: declare one source of truth for view kind and a sync direction; keep semantic kind out of transient fingerprints. Bonsai's drift comment is the warning label.

## 4. Section vs Elevation architecture

- **Verdict: same pipeline, different parameters — with exactly two TargetView branches, neither of which splits Section from Elevation.** (Observed)
- Branch A — context priority (`operator.py:656-676`): PLAN/RCP get Plan-first lists; SECTION/ELEVATION/MODEL all get Model-target→Model-model only. Section and Elevation take the identical branch.
- Branch B — RCP mirror (`operator.py:1428-1429`): RCP-only. Section and Elevation both skip it.
- Absence (verified by grep): `auto-section`/`auto-elevation` both hardcoded `False` (`:1416-1417`); no `if target_view == SECTION` serializer flag; door-arc/space-name flags uniformly `False`. Cut differences between a section and an elevation come from the **camera element's own placement/extents** (`clip_start/clip_end`, `ortho_scale` via `get_camera_dimensions:495-505`, matrix via `get_camera_matrix:2938-2945`) passed as `elevation-ref-guid` (`:1422`) — not from pipeline switches. Section/Elevation annotation *marks* exist only as a resolution guard (`ActivateDrawingByAnnotation`, `:4265-4276`), not in generation.
- Source scope: `get_drawing_elements` (`tool/drawing.py:2358-2434`) — Include selector query ∩ camera frustum, plus aggregates and own-annotation members, minus Exclude, minus (always) `IfcOpeningElement` and strays. Camera force-included (`operator.py:1072-1079`). No wall/interior-elevation special treatment found anywhere in the drawing path (verified absence).
- Comparison with FreeCAD: FreeCAD reaches "one pipeline" by having no kinds at all; Bonsai reaches it by having explicit kinds that the cut core ignores. Both architectures agree the cut kernel needs no form parameter — Bonsai's version is stronger evidence because the kinds exist and are still not consulted at cut time.
- P26 implication: Wall Elevation needs no dedicated generation path — it is a section whose camera is derived from a wall face with shallow depth. The only per-kind code P26 should plan is reference policy (which rooms/storeys get pulled as context), mirroring Branch B's family.

## 5. Reflected Plan / RCP architecture

- Camera: same storey-anchored translation as Plan (`x, y, storey.Z + 1.6`), Z-axis negated — looking +Z from below (`tool/drawing.py:858-870`, verified). Import negates `mat[1][1]` (`:1021-1028`).
- Serialization: `svg-mirror-y=True`, RCP-only (`operator.py:1428-1429`, verified). Geometry offset −2 mm vs Plan's +2 mm (`:700-712`).
- Visibility: identical context set, filters, hints, and element membership as Plan (same branches at `:650-662`, `:2541-2565`, `data.py:127-131`). Cut-plane height is the same explicit `+1.6 m`; nothing reads a ceiling elevation.
- Above/below semantics: determined by frustum + serializer, not by an RCP rule — no RCP-specific inclusion code found.
- Ceiling entities: **no `IfcCovering`/CEILING special-casing in any drawing/view file** (grep-verified absence across `bim/`; drawing hits limited to a JoinClasses comment, the RCP label, and an RCP camera-scale comment). CEILING handling exists in authoring (`model/covering.py`) and QTO deductions (`qto/calculator.py:278-301, 423-441`) — quantities, not views. Slabs get no RCP branch either (only default `JoinClasses = (IfcWall, IfcSlab)` merging, `operator.py:1548-1555`).
- Annotation contexts: RCP shares Plan's (`Plan/Annotation` parent, `:670-706`); annotation placeholder creation flips for RCP (`annotation.py:146-150`).
- **Verdict: RCP is a flipped Plan — same pipeline, same contexts, three small deltas (matrix negation, Y-mirror, ∓2 mm offset). It is neither a horizontal Section variant (no cut-face stream exists in this pipeline) nor a distinct representation policy (no unique visibility/annotation rules).** (Observed)
- Tests: RCP coverage is matrix-only (`test_drawing.py:581-595`) plus the placeholder flip; no decorator/SVG-snapshot RCP test exists (verified absence). The feature file's 20 scenarios are all `PLAN_VIEW` UI-expand steps — zero RCP/section/elevation orientation scenarios.
- Comparison with FreeCAD (E): FreeCAD's "orientation alone suffices" is confirmed and refined — orientation alone does *not* suffice; orientation + mirror flag + epsilon offset + shared context set does. The mirror flag is the piece orientation-only thinking misses.
- P26 implication: implement Ceiling Focus as lightweight orthographic policy (horizontal camera from below at explicit height + Y-mirror at export + same scope as Plan), not as a document mode. No ceiling-typed logic is needed for v1; cut height should be an explicit instrument parameter defaulting like `+1.6 m`, not derived from ceiling geometry.

## 6. Canonical identity through derived views

- Entity → Blender object: the Blender object is the runtime identity anchor holding an **integer adapter key**, not the entity: `BIMObjectProperties.ifc_definition_id` (`bim/prop.py:744-746`, verified). Resolvers: `tool/blender.py:2289-2292` (read key), `tool/ifc.py:140-163` (`get_entity`: key → `ifc.by_id`), `:175-180` (reverse via `id_map`/`guid_map`, rebuilt `:193-214`). GlobalId is secondary payload on the entity. Mesh datablocks can also carry the key for representation items (`tool/root.py:207-208`, `tool/geometry.py:456/573/616`).
- Blender object → derived representation: cut/slice/fill caches keyed by `element.id()` int (`drawing/data.py:238-240`; writes `decoration.py:1849-1861, 1978`; reads `:1724-1746`, `raycast.py:185/341`). Bisect output is bare world-space tuples with no source ref (`tool/drawing.py:2731-2793`); binding is restored positionally — `CutDecorator` loops visible meshes, resolves `element = get_entity(obj)`, indexes caches by `element.id()` (`decoration.py:1716-1747`); merged buffers keep index offsets only.
- Derived → SVG with back-pointers: serializer groups carry `g.ifc:guid + ifc:name` (`operator.py:743-745`); material-layer pass re-resolves by guid (`:761-765`); styling classes union guid into merged-polygon class sets (`:1682-1724`, guid added `:1687`); lookup `get_element_by_guid` with linked-file fallback (`:1500-1510`); sheets cross-link `data-drawing=drawing.GlobalId` (`sheeter.py:116/184/411`).
- Where identity is lost (Observed): (a) **SVG merge** — `merge_linework_and_add_metadata` joins same-class closed polygons (default Wall+Slab, `:1548-1555`), unioning multiple guids into one class set — tokens survive, 1:1 path→entity does not; (b) **cut-overlay merge** — all elements' cut verts merge into single buffers (`decoration.py:1705-1747`) drawn as one batch — an on-screen cut pixel is not pickable to an element (clicking selects the host object, never the decorator); (c) **explicit drops** — openings removed (`tool/drawing.py:2433`), annotations/openings skipped on import (`bim/import_ifc.py:1216`, void-limit stash `:374-411`), non-frustum camera misses yield empty cut/fill with no deferred queue (`decoration.py:1847-1860`); (d) **outside view** — dropped at source (frustum ∩ filters), no select-outside-crop path exists.
- No loss in the 3D snap path: slot→object tables, snap dicts keep `object` + `face_index` end to end (`raycast.py:462-465 → :541 → :543-551`; proximity `:1255-1325`).
- Comparison with FreeCAD (B): FreeCAD loses identity at compound→HLR projection of outlines while keeping fill ids; Bonsai **inverts** this — the 3D side is lossless (host-keyed), the 2D overlay keeps identity via side-table keys, and SVG is strictly better than FreeCAD's HLR output (guid back-pointers by construction) until the merge stage demotes 1:1 to 1:N. Net: Bonsai preserves more identity further downstream, but both architectures break at a **merge/flatten** stage.
- P26 implication: (a) thread an integer entity key (not string ids) through every derived cache — the codebase already does; (b) treat any merge/join stage as an identity checkpoint requiring either merge-prohibition for selectable streams or explicit 1:N membership records; (c) keep drawing-side identity as guid tokens on groups and never post-process them away; (d) P26's no-proxy-ids rule is compatible — the Blender object / derived primitive carries the canonical key, never a section-local id.

## 7. Raycast and selection path

- `tool/raycast.py` is a **snap engine**: two engines (GPU colour-ID offscreen + CPU `obj.ray_cast`/bmesh proximity), every entry returns snap dicts carrying `bpy.types.Object` (+ `face_index`), **zero IFC references inside** (verified: no `get_entity`, no Opening/Door/Window type checks in the file). Entry surface: `get_visible_objects:769`, `get_viewport_ray_data:1000`, `cast_rays_to_single_object:1458` (9-px `mouse_offset` retries), `cast_rays_and_get_best_object:1490`, `ray_cast_and_get_closest_to_camera_snaps:1553`, `ray_cast_by_proximity:1227`, GPU trio `:1068-1201`, filters `:1439/953/1665`, plane/polyline/measure/edge-X casters `:1331-1409`.
- Targets: hit = `MESH` with polygons only (`_get_tris_render_ops:431-466` skips the rest); snappable-but-not-face-raycastable = `EMPTY` origins, `CURVE` via `to_mesh()`, polygon-less wire/boundary features. NOT targets: gizmos, cut planes, SVG, decorator pixels (`POST_VIEW`/`POST_PIXEL` overlays, `decoration.py:1656/2047` — no hit testing). Clipping planes only filter candidacy (`:970-997` → `filter_objects_to_raycast:1439-1455`). Cut-decorator geometry is snappable but re-anchored to the host object (`_get_cut_object_*:173-193/323-352`; re-anchor `tool/snap.py:153-201`, `p["object"]=obj` at `:181/:198`).
- Callers: `tool/snap.py` (all snap flows), `model/polyline.py:405-472` (bbox + GPU decorator install), `project/operator.py:3333-3338` (face-area tool stores `obj.name + face_index` — precise but name-fragile), `drawing/operator.py:1171-1284` (private `cast_rays...:1735-1764` using raw `obj.ray_cast`, **not** `tool.Raycast`, for SVG fill attribution), plus edit-mode isolation (`aggregate.py:209-227`, `nest.py:128`).
- Hit→entity resolution is always caller-side `tool.Ifc.get_entity(obj)` — no resolver exists inside raycast. Selection contexts: model-viewport (native Blender selection; selected/unselected colour split `decoration.py:1726-1747`; local-view gates `:1680-1693/:2107-2120`); drawing activation (`activate_drawing:2589-2647` — imports annotation group, switches each element's representation **in place**, isolates; same Blender object survives so same-context selection survives, cross-context selection can orphan); annotation (ordinary `IfcAnnotation` objects; decorations suppressed outside camera view `:2122-2124`); derived geometry (no independent selection — cut/fill snaps re-anchor to host; SVG has no viewport picker, only `get_element_by_guid` for styling).
- Outside view/crop: unhittable by construction — candidacy requires on-screen 2D bbox (`:789-860` + `:1439-1455`) and clip-plane visibility; drawing membership requires frustum. There is no "reveal outside crop" affordance; the user must switch/expand the view.
- Comparison with FreeCAD: FreeCAD selection is view-independent (tree selection survives anything); Bonsai ties annotation/decorator visibility to camera + isolation, so view switches can orphan selection. Bonsai's raycast centralization (one snap module, explicit GPU/CPU duality, narrow `snap["object"] + face_index` waist) is the better pattern.
- P26 implication: (a) separate *hit* (geometry→primitive+sourceKey) from *resolve* (sourceKey→entity→intent) as two functions — Bonsai's snap/resolve split is the precedent; (b) persist selection as entity-key sets across view switches, not as view-local picking state; (c) P26's "outside depth → Reveal" affordance fills a gap both predecessors leave open; (d) opening hits must resolve via relation graph, never via raycast alone (§10).

## 8. Model representation vs drawing representation

- Canonical model: IFC products + `Model/Body/MODEL_VIEW` representations + placements + psets. Generated drawing: serializer SVG groups (guid-keyed) → per-layer `cache/*.svg` → combined sheet SVG on disk at the `IfcDocumentReference.Location` URI (`operator.py:1847-1858`; `core/drawing.py:286-350` pins drawing→document wiring). Annotations: authored `IfcAnnotation` products in the drawing group (round-trip via `get_group_elements`).
- Entry `CreateDrawing.execute` both creates and regenerates in place (`operator.py:314-316`, `:383-435`); full pipeline re-runs on update (syncs IFC first if flagged, `:1001-1006`); per-layer caches short-circuit unless edited-guid eviction (`:1009-1021`) or toggles-off.
- Write-back boundary: **output-only** = linework/projection/cut/fill SVG paths (no linework→IFC writer found — inferred from absence); **write-back capable** = annotation objects, drawing pset props (scale, TargetView, filters, styles, cut/linework/fill modes), camera transform (`:421-424`, `tool/drawing.py:832`), sheet composition refs.
- The exact FreeCAD analogue exists: canonical model → derived view state (camera + EPset params ≈ FreeCAD's SectionPlane props) → baked output (SVG on disk ≈ `Symbol` string) — with two differences: Bonsai's baked output lives **outside** the model file (document URI, not a persisted property), and its derived groups carry guid back-pointers FreeCAD's HLR output lacks.
- Comparison with FreeCAD (D): same one-way model→drawing relationship, held more strictly — Bonsai's linework cannot flow back even in principle (it is a file, not a property), while FreeCAD's `Symbol` at least sits in-document. Both confirm non-authoritative derivation is natural, not enforced.
- P26 implication: P26's rule ("derived display may persist as editor state, never as architectural truth") is supported twice over. Prefer Bonsai's placement of baked output (editor/session state keyed by view, outside the canonical document) over FreeCAD's (persisted property on a view object) — it makes the non-authoritative status structural rather than conventional.

## 9. IFC representation contexts and their consequences

- `util/representation.py` (523 lines, full read): query/filter/resolve helpers over `IfcShapeRepresentation` + priority ordering. No IFC mutation. Core: `get_context` (`:58-82`), `get_representations_iter` (`:119-131` — yields **every** rep on product or type-map), `get_representation` (`:134-150` — **first match wins**), `guess_type` (`:153-301`), `resolve_*` boolean/mapped-item unwrappers (`:304-355`), `get_prioritised_contexts` (`:358-425`: Model > Plan, Body/Facetation-first, MODEL_VIEW > PLAN > RCP > ELEVATION > SECTION, big-scale-first), `get_reference_line` (`:485-523`: wall axis from Plan/Axis/GRAPH_VIEW with extrusion-profile fallback).
- Contexts are **persistent IFC entities**: top-level `IfcGeometricRepresentationContext` (`Model` 3D, `Plan` 2D — "even if the 2D geometry is not a plan view", `api/context/add_context.py:58-62`) owned by `IfcProject.RepresentationContexts`; subcontexts carry `ContextIdentifier/ContextType/ParentContext/TargetView/TargetScale`. Every product rep must sit in one subcontext ("critical prior to authoring", `:35-56`). UI enums: contexts Model/Plan, 12 subcontext identifiers, all 9 target views (`bim/module/context/prop.py:32-63`).
- **Alternative authored geometry is real**: one element can carry 3D body + 2D plan swing + elevation + clearance box + cut-out profile in different buckets (canonical door example, `add_context.py:35-45`). TargetView denotes **which geometry bucket a rep belongs to**, not just drawing styling. Active rep is chosen by pinned lookup (modeling callers hard-pin `Model/Body/MODEL_VIEW` — `tool/root.py:60`, `tool/geometry.py:242`, `tool/loader.py:1106`, `tool/drawing.py:710`) or priority fallback (loader + linework context lists, target-view-first then MODEL_VIEW).
- Second-truth guards: deterministic priority + draw-once subtraction (`drawing_elements -= processed`, `operator.py:719-723`). **No cross-context consistency validation exists** — a stale PLAN_VIEW body beside a fresh MODEL_VIEW body resolves silently by priority. Guard = convention + determinism, not verification. (Observed mechanism, inferred hazard.)
- Comparison with FreeCAD: FreeCAD has one geometry per object, so the hazard class does not exist there. Bonsai proves the hazard is real wherever per-view authored geometry is allowed.
- P26 implication (H8 — see §17): reject authored per-view geometry. Keep one canonical geometry per entity; allow at most pinned-single-truth resolution (Bonsai's `Model/Body/MODEL_VIEW` pin for modeling callers) and derived/fallback presentation. If a plan-swing-style symbol is ever needed, derive it (host + type + size → symbol) rather than authoring a second rep — derivation cannot drift, authored buckets can.

## 10. Wall / Opening / Ceiling / Slab / Roof view behavior

- Pipeline is generic: frustum ∩ Include − Exclude − openings, spaces via a separate gated pass (`get_drawing_spaces`, `tool/drawing.py:2437-2458`, toggled by `print-space-names/areas`, `operator.py:1418-1419`), underlay hides empties/cameras/grids/openings (`:579-589`), class labeling generic (`get_svg_classes`, `:1436+`).
- Wall: no drawing-pipeline branch (only default join-merge with Slab, `:1548-1555`); wall code lives in authoring (opening transfer on merge, `model/wall.py:1605-1772`) and the axis helper (`representation.py:499-509`).
- Opening/Door/Window: **excluded from linework always** (`tool/drawing.py:2433`) but boolean-subtracted in the kernel (`svg-subtract-before=always`, `:1424`); door arcs off by default (`door-arcs=False`, `:1420`). Opening identity is navigated exclusively in modeling/selection/import/QTO paths via `HasOpenings→RelatedOpeningElement` (8+ sites: `void/data.py:65-67`, `void/operator.py:130`, `model/opening.py:588/825/974/1119`, `geometry/operator.py:688`, `boundary/operator.py:838-839`), `FillsVoids→RelatingOpeningElement` (`model/opening.py:276-278/434-643`, `void/operator.py:267-268`), `VoidsElements` reverse (`:1027-1028`), import void-limit gate (`import_ifc.py:374-411`), QTO deduction (`qto/calculator.py:721-723/872-873`). **No void-graph consultation exists in any hit/selection/decorator path** (verified absence in `raycast.py` and `decoration.py`).
- Slab/Roof: no view branches (Roof opening logic is authoring-side, `model/roof.py:683`).
- Ceiling/Covering: no RCP/view branch (verified absence — §5). Space: excluded from body linework by construction.
- Comparison with FreeCAD: identical substantive outcome — the subtractive feature's identity does not survive inside host faces, and the host boolean already contains the hole. Bonsai additionally filters openings out of drawings where FreeCAD at least overlaid window symbols. But Bonsai's relation graph (`HasOpenings`/`FillsVoids`/`VoidsElements`) is a navigable, tested identity source FreeCAD has no equivalent of — opening identity is recoverable by graph walk, just not by picking.
- P26 implication (H5 — see §17): opening identity must be resolved via host↔opening relations (sites listed above), never via raycast on host geometry. If P26 wants opening outlines selectable in Section, the derivation must emit opening primitives from the relation graph explicitly (host void → opening entity → primitive), because neither predecessor's geometry path preserves them.

## 11. Spatial containment and future-Level implications

- Storey↔element and Space↔element are **containment only**: `IfcRelContainedInSpatialStructure`, read by `util/element.py:1061-1103` (`get_container`, direct or walked Space→Storey→Building→Site, `selector.py:664-672`), multi-location via `ReferencedInStructures` (`:1105-1122`). `api/spatial/assign_container.py:35-60` states purpose as scheduling + FM access, **not geometry**; schema caps each element at 0..1 containing structure.
- Placement is independent: chained locals resolved through `PlacementRelTo` to root (`util/placement.py:98-127`); nothing in placement code references Storey; Storey elevation itself is *derived from* placement Z with attribute fallback (`:191-203`).
- Sections work storey-free: cursor + cardinal direction only (`tool/drawing.py:885-896`); kernel told `svg-without-storeys=True` (`operator.py:1409`); no Storey precondition found (grep `Storey|storey|CutHeight` over `bim/module/drawing/` hits only: an svgwriter annotation tag, the storey picker list, the flag, and template vars). Plan/RCP treat Storey as a datum convenience (`+1.6 m`, origin fallback at `:855-873`; picker offered for PLAN/RCP only, `data.py:127-131`).
- **Verdict: evidence SUPPORTS "reserve datum-capable vertical semantics now, defer Level hierarchy."** Sections operate on placements + explicit heights; Storey is an optional datum provider. The `+1.6 m`-with-fallback pattern is exactly a datum-capable default. No contradicting Storey requirement found.
- P26 implication: model `baseElevation`-style absolute numerics on entities now (placements already are absolute-by-chain); treat any future Level as a named datum resolving to an elevation + containment link, never as a geometric prerequisite for views. Both predecessors agree here (FreeCAD sections work on raw boxes; Bonsai sections work cursor-direct).

## 12. Annotation / decorator separation

- Authored registry: 18 creatable types (`ANNOTATION_TYPES_DATA`, `tool/drawing.py:97-116`: DIMENSION/ANGLE/RADIUS/DIAMETER/TEXT/TEXT_LEADER/STAIR_ARROW/PLAN_LEVEL/SECTION_LEVEL/BREAKLINE/SYMBOL/MULTI_SYMBOL/LINEWORK/BATTING/REVISION_CLOUD/FILL_AREA/FALL/IMAGE). Section/Elevation/Grid/Hidden-line marks are renderable but not in the registry (observed gap).
- Per-type verdict is uniform: **authored + persisted** (`IfcAnnotation` + predefined type + rep + `EPset_Annotation`/`BBIM_*` psets + drawing-group membership) with an **ephemeral GPU overlay** (19 decorator classes, `decoration.py:639-1638`, dispatched `:2012-2062` as `POST_PIXEL`, camera-gated `:2123`, per `(obj, decorator)` pairs from `data.py:831-870`). Section/elevation *marks* (circles, triangle heads, grid tags) are annotations distinct from drawing TargetViews. The cut/fill/slice overlay (`CutDecorator`, `:1641-1646`) is **viewport-only instrumentation**: derived from model meshes per frame, cached on `DecoratorData` (`data.py:238-240`), recalculated only if uncached/selected/camera-moved (checksum 1e-4 m / 0.1°, `:1809-1819`), never persisted.
- Lifecycle: creation builds a camera-plane placeholder (`annotation.py:83-171`, RCP flip `:146-150`), resolves/creates the per-TargetView annotation context, assigns class, groups, reloads rep, enables editing (`core/drawing.py:514-550`); operator poll requires only IFC + scene camera (`operator.py:1868-1869`) — no TargetView restriction. Updates never flow decorator→IFC; model mutation happens only via explicit ops (`edit_text*`, `sync_references/sync_object_placement`, `:558-593`, skipping spatials+grids). Dragging annotation verts does not regenerate SVG until `create_drawing` re-runs (inferred). Removal cascades IFC+Blender+docs (`test` pins, §13); `load_post` reinstalls decorations but force-uninstalls Cut (`handler.py:27-35`).
- Gizmos are a third layer: `gizmos.py` modal handles + snap managers + renderers edit *through ops* back to IFC. Picking must target the gizmo layer, never decorator batches (decorator verts are not pickable; parametric dims snap, schematic dims don't — `test_gizmos.py:61-74`).
- SVG writer (`svgwriter.py:227-1721`): `svgwrite` doc (`id="root"` only), per-PredefinedType dispatch (`:352-409`, FILL_AREA first, DRAWING skipped), camera-plane projection (`:1703-1710`), and **no per-entity `id=`/`data-*`** — GlobalId survives solely as a `GlobalId-<guid>` CSS class token (`:550-567`), colliding with user `Classes`. Consumers: drawing SVG files at document URIs, sheets embedding them as `<image>` under `g[data-drawing]` (`sheeter.py:114-125/191-202`); viewed in external viewers; no round-trip to selection (only drawing-level sheet ops).
- Comparison with FreeCAD: FreeCAD keeps dimensions/marks as persistent view-owned features referencing 3D geometry; Bonsai persists only the annotation curve + psets and re-derives arrowheads/labels per frame. Bonsai's split is cleaner for P26's needs.
- P26 implication (H6 — see §17): three-layer separation (authored annotation record → cached presentation snapshot → ephemeral overlay + gizmo handles) with explicit invalidation points (camera move, selection, pset edit, undo — mirroring `is_camera_moved`/`clear_cache`) is directly adoptable. Temp dims, section handles, snap indicators, and guides map to the overlay+gizmo layers and must never touch the canonical document.

## 13. Tests and edge cases

- `test/tool/test_drawing.py` (~40 classes): camera create/shift round-trip + ORTHO-shift-ignore (`:64-196`); SVG sheet file-exists (`:198-213`); delete/collection/group/import/target-view/doc-URI incl. IFC2X3 (`:216-477/700-787`); `get_annotation_context` PLAN/ELEVATION + FALL→Model (`:426-442`); body-context pinned Model/Body/MODEL_VIEW (`:444-451`); full `generate_drawing_matrix` table (`:561-662`); text-literal CRUD + font Classes + disable-keeps-committed (`:277-315/673-900`); assigned products, sheet positions `(30,30,500,500)` (`:690-698/902-1043`); drawing styles reload=3 (`:1046-1069`); reference images (`:1072-1104`); `is_drawing_active` incl. background (`:1107-1128`). Stubs: `TestCreateAnnotationObject/TestOpenSchedule/TestOpenReference/TestOpenSvg/TestRunRootAssignClassOperator` are `pass`.
- `test/core/test_drawing.py` (contract order): text/assigned-product/sheet/schedule/reference/drawing CRUD (`:23-363`); `TestAddDrawing` pins EPset defaults (Scale 1/100, HasLinework/HasAnnotation, GlobalReferencing) + doc wiring (`:335-401`); duplicate/copy-annotations/remove/rename with file moves (`:404-597`); `TestAddAnnotation` pins target-view→context→create→assign→group→reload→collect→edit (`:600-665`).
- `test/bim/feature/drawing.feature` (24 scenarios): duplicate/create/delete/activate/remove/annotation/shapely-fill/sheet/text/reference flows at smoke level; output-contains-`"cut"`+`"IfcWall"` (`:77-79`) and `"IfcWall material-null surface"` (`:240`) are the only content assertions. All 20 UI-expand steps use `PLAN_VIEW` — zero RCP/section/elevation scenarios.
- Gizmo/clip units: `test_gizmos` (parametric-snaps vs schematic-doesn't; tie-break `select_bias=-length`; NaN-safe), `test_segment_clipping` (2D rect clip identity/outside/exact-endpoints). No 3D frustum/section-plane clip tests; no bisect tests; no decorator render assertions; no SVG class/id assertions; no regeneration-determinism test; no TargetView×ObjectType matrix test; no raycast/selection-mapping tests of any kind.
- Missing coverage that matters for P26 (verified absences): RCP beyond matrices; decorator/svgwriter consumption of matrices; raycast→entity mapping (convention-only); camera-plane clipping; create-twice determinism; representation-context fallback matrix; failure paths (missing context/group).
- P26 implication: Bonsai's suite pins matrices, contracts, and file plumbing — adopt all three patterns — but leaves rendering output, identity mapping, and RCP behavior to convention. P26's conformance suite should add exactly those: RCP-mirror/offset snapshots, per-primitive identity assertions, depth-inclusion matrix, regeneration determinism.

## 14. Comparison with FreeCAD

| # | FreeCAD finding | Bonsai answer |
|---|---|---|
| A. Shared pipeline | One class, no enum, orientation defines form | **Same architecture via explicit TargetView policy.** Kinds exist as stored values, but the cut core ignores them; orientation + camera params differentiate. Stronger evidence (kinds present yet unconsulted at cut time). |
| B. Identity | Survives booleans as feature refs; dies at compound→HLR; fills keep ids | **3D side lossless** (host-keyed caches), **SVG keeps guid back-pointers by construction** until merge demotes 1:1→1:N; raycast host-anchored; openings excluded. Strictly further downstream than FreeCAD; breaks at merge stages, not projection. |
| C. Depth | Exists in helper; flagship TechDraw path drops it | **Same disease, different symptoms.** Four inclusion mechanisms (frustum slab, Include/Exclude, context filter, serializer prefilter) disagree with no unified range object; frustum wins over Include; openings unconditionally out. No single contractual path. |
| D. Derived authority | One-way model→view→baked `Symbol` | **Same, held more strictly.** Baked output is a file outside the model (document URI), not an in-document property; linework cannot flow back even in principle. |
| E. RCP | Orientation alone could represent horizontal forms | **Refined: orientation + mirror + epsilon + shared contexts.** Orientation-only thinking misses the `svg-mirror-y` flag — the one piece that is not derivable from a camera matrix. |

## 15. What transfers well to Museum Editor

1. **Explicit view-kind enum with stored values** (5 drawing kinds mirroring IFC), kind→matrix/hint-domain tables, test-pinned per-(kind,hint) matrices. (§3)
2. **One cut core, view-blind; kinds parameterize camera + context set + mirror + reference policy.** Section = anti-Elevation direction; RCP = flipped Plan + mirror; Wall Elevation = wall-derived camera, shallow depth. No per-form generation code. (§4, §5)
3. **Integer entity key threaded through every derived cache** (`ifc_definition_id`/`element.id()` pattern); guid tokens on serialized groups; `get_element_by_guid`-style reverse lookup with fallback. (§6)
4. **Hit/resolve split**: raycast returns `{primitive, sourceKey}`-style snaps with zero model knowledge; callers resolve to entities/intents. One snap module with a narrow waist. (§7)
5. **Three-layer annotation/instrumentation separation** (authored record → cached snapshot → ephemeral overlay + gizmo handles) with explicit invalidation (camera/selection/edit/undo); picking targets gizmos, never overlay batches. (§12)
6. **Opening identity via relation graph** (`HasOpenings`/`FillsVoids`/`VoidsElements` walk sites listed in §10), not via geometry picking. If openings must be selectable in Section, emit their primitives from the graph explicitly at derivation time.
7. **Storey-as-optional-datum**: explicit cut heights with `storey.Z + const` defaulting and origin fallback; placement chains independent of containment; views never require Storey. (§11)
8. **Baked output outside the canonical document** (editor/session state keyed by view), making non-authoritative status structural. (§8)

## 16. What should NOT transfer

1. **Authored per-TargetView geometry buckets.** Multiple fit-for-view reps per element with priority-only guards and no consistency validation is a second-truth machine. Keep one canonical geometry; derive presentation. (§9)
2. **Split-brain inclusion.** Four disagreeing membership mechanisms (frustum ∩ selectors − openings ∩ contexts ∩ re-filters) with silent drops is the failure to avoid. One declarative scope+range contract evaluated in a single membership stage. (§8)
3. **Silent exclusions.** Unconditional opening removal, wrong-context geometry drops, storey suppression, and empty-cut-with-no-queue are all silent. Every exclusion needs a reason code surfacing to "outside depth → Reveal"-style affordances. (§6, §8, §10)
4. **Merge stages without identity records.** Shapely union of same-class polygons and single-buffer cut overlays destroy 1:1 traceability. Either prohibit merging on selectable streams or keep membership records. (§6)
5. **GPL-3.0 Bonsai code.** Beyond licensing, the Blender-coupled implementation (draw handlers, `bpy` objects, C++ serializer settings) has no direct Three.js/Svelte counterpart — port contracts, matrices, and test tables, never implementation.
6. **SVG-as-selection-surface via class-token parsing.** `GlobalId-<guid>` in `class=` collides with user classes and cannot round-trip 1:1 after merges. Maintain an explicit node→entity index at export if sheet-picking is ever required. (§12)
7. **Documentation machinery bulk.** Sheets, schedules, titleblocks, document references, reference images, 18 annotation types, Freestyle alternates — all out of P26 scope. The boundary pattern transfers; the features do not.

## 17. P26 hypothesis assessment

- **H1 — One shared orthographic pipeline for Plan, Wall Elevation, Section, RCP via target-specific params/policies.** **SUPPORTED.** Observed: one C++ cut core + one Python assembly path; TargetView consulted at ~12 policy sites, never at cut time; section/elevation share the identical branch; RCP shares Plan's everything plus mirror/offset. Refines FreeCAD's orientation-only story with the mirror-flag correction.
- **H2 — Canonical identity survives into derived orthographic interaction without proxy ids.** **PARTIALLY SUPPORTED.** Observed: integer-key threading (3D caches), guid back-pointers (SVG), host-anchored snaps — all without section-local ids. Weakened at: merge stages (1:N), cut-overlay pixels (unpickable), openings (excluded), outside-view (dropped). Achievable with the §16.3/16.4 guards; not achieved by default.
- **H3 — Derived display stays non-authoritative while supporting model editing.** **SUPPORTED.** Observed: output-only linework (files, not entities), write-back confined to annotations/psets/camera, gizmo→op→IFC edit path with decorators strictly read-only. The three-layer split is the mechanism that makes editing-through-derived-views safe.
- **H4 — RCP as projection/visibility policy, not separate truth.** **SUPPORTED.** Observed: RCP = Plan pipeline + Z-negation + `svg-mirror-y` + ∓2 mm + shared contexts; zero ceiling-typed logic; cut height explicit. Strongest single-answer result in this harvest.
- **H5 — Opening identity available despite host subtraction.** **PARTIALLY SUPPORTED.** Observed: openings are boolean-subtracted in-kernel (identity gone from faces, as in FreeCAD) AND unconditionally excluded from linework — but the `HasOpenings`/`FillsVoids` relation graph preserves full semantic identity one walk away, with 15+ call sites proving navigability. Available via graph, not via geometry; P26 must emit opening primitives from relations explicitly.
- **H6 — Annotations/decorators separate from architectural geometry.** **SUPPORTED.** Observed: uniform authored-vs-overlay split across 18 annotation types + marks + cut overlay; decorators never mutate; gizmos mediate edits. Cleanest precedent in either harvest.
- **H7 — No full Storey/Level hierarchy required.** **SUPPORTED.** Observed: storey-free sections, placement/containment decoupling, `svg-without-storeys=True`, datum-with-fallback pattern. Both predecessors agree; no counter-evidence.
- **H8 — Avoid IFC-style multiple authored target-view geometries; keep one canonical geometry + derived presentation.** **SUPPORTED.** Observed: per-view authored buckets exist, resolve by priority convention, carry silent-drift risk with no validation. The pinned-`Model/Body/MODEL_VIEW` half of Bonsai's own practice is the single-truth anchor to copy; the buckets are the hazard to reject.

## 18. Impact on P26 research

### Supported

- Transient-instrument posture with baked output outside the canonical document (§8; strengthens FreeCAD's in-document `Symbol` precedent into a structural guarantee).
- Shared Section/Elevation pipeline; Wall Elevation as wall-derived camera + shallow depth (§4).
- RCP/Ceiling Focus as policy, with the exact delta list (negation + mirror + offset + shared contexts) and explicit cut-height default (§5).
- Hit/resolve split with a narrow snap waist; entity-key sets surviving view switches (§7).
- Overlay/gizmo/annotation three-layer split with explicit invalidation (§12).
- Datum-capable numerics now, Levels later (§11).
- Single canonical geometry; relation-graph opening identity (§9, §10).

### Refined

- **Shared-pipeline thesis gains a correction:** orientation + camera params are necessary but not sufficient — the RCP Y-mirror flag is a non-matrix policy bit that must be specified per view kind. P26's `SectionInstrument`/view-type spec needs a per-kind policy record (mirror, offset, context set, hint domain), not just a plane + depth.
- **Identity thesis gains its loss map:** preserve-by-default holds through derivation and snapping; the checkpoints requiring explicit design are merges, cut-overlay batching, opening exclusion, and frustum culling — each needs a keep-records / reason-code / graph-emission rule respectively.
- **Non-authoritative thesis gains its mechanism:** three layers + write-back allowlist (annotations, view params, camera) + output-only linework, instead of a blanket "views don't write" rule. Editing *through* derived views is safe when gizmos mediate intents.
- **Depth thesis gains its contract shape:** one membership stage evaluating scope ∩ range − exclusions with reason codes, replacing both FreeCAD's dropped-property and Bonsai's four-mechanism disagreement.

### Contradicted

- **"Orientation alone suffices for RCP" (FreeCAD's implied simplification): contradicted in one precise bit** — the serialization mirror. A mirrored projection matrix and a mirrored serialized output are not the same operation (winding/text implications differ); Bonsai carries both the negated matrix and the mirror flag, and P26 should too.
- **"Openings might survive subtraction as identifiable faces" (optimistic reading of H5): contradicted as a geometry hope, supported as a graph walk.** Neither predecessor preserves opening identity in faces; both resolve it beside geometry. Design accordingly — no face-classification fallback.
- Nothing else structural was contradicted. No evidence emerged requiring earlier Level infrastructure, per-kind section kernels, or authored per-view geometry.

### New questions

1. What reason-code taxonomy should the single membership stage emit (outside-depth vs excluded-type vs wrong-context vs filtered-vs-culled), and which codes get user-facing Reveal affordances?
2. Should merged/simplified linework exist at all in P26 v1, given both predecessors' merges are the identity-break point? (Candidate: no merging in the editing instrument; merge only in export paths with membership records.)
3. Which per-kind policy bits beyond mirror/offset/context-set does Wall Elevation need (e.g. auto-follow its wall's face plane on rebuild — decided open in the FreeCAD harvest)?
4. Cut-only mode semantics remain unanswered by both harvests (neither implements a section-UI cut-only; only zero-depth conventions exist). Product decision with prototypes.
5. Far-field fading/gradation has no implementation precedent in either codebase (both do exclusion-only). If P26 wants it, per-primitive depth must survive projection — feasible in Three.js, unprecedented elsewhere.

## 19. Museum implementation reconciliation required

Likely areas only; no Museum audit performed:

1. **View-kind + policy record:** add a stored view kind (5 IFC-mirroring values or P26 subset) plus per-kind policy (mirror, offset, context/scope rule, hint domain) beside the existing `SectionInstrument` plane/depth sketch — kind must be data, not derived.
2. **Single membership stage:** the compiler/scope path likely evaluates visibility in multiple places (Plan culling, 3D frustum, future ortho); converge ortho membership to one function returning `(included[], excludedWithReason[])` before derivation.
3. **Identity key threading:** confirm every derived ortho primitive can carry `{sourceId, stream, subRef?}` from derivation through picking; reserve the merge-prohibition (or membership-record) rule before any linework simplification lands.
4. **Opening primitives from relations:** if openings must be selectable/hoverable in Section/Elevation, the derivation must walk host→opening relations and emit opening-stream primitives — geometry picking alone will never yield them (both harvests agree).
5. **Overlay/gizmo/invalidation layering:** snap indicators, temp dims, section handles, and guides belong in ephemeral layers with camera/selection/edit/undo invalidation; picking targets handles, never overlay batches.
6. **Datum numerics:** keep absolute elevation fields on entities (placement-chain style) with Level-as-future-named-datum; never gate views on a storey/level container existing.

## 20. Remaining evidence gaps after FreeCAD + Bonsai

- Cut-only (zero-depth) section UX + semantics: neither codebase implements it as a first-class instrument mode.
- Far-field depth cueing (weight/fade falloff): neither implements it; both do exclusion-only.
- Merged-linework-with-records: both merge destructively; no precedent for identity-preserving simplification.
- Regeneration determinism under edit (create-twice byte/model equality): untested in both suites.
- In-drawing per-source selection granularity finer than whole-view: absent in both (FreeCAD: whole symbol; Bonsai: host-object or nothing).
- Wall-following constrained elevation (auto-follow on wall move): designed in P26, implemented nowhere harvested.
- Gable/shed ceiling authoring handles in Section (ridge/eave drag): no precedent in either codebase (both consume slopes generically; neither authors them orthographically).

## 21. Recommendation for whether a third repository harvest is needed

> After FreeCAD + Bonsai, what P26 architectural question still lacks strong implementation evidence?

The gap list in §20 is dominated by **interaction design** (cut-only UX, wall-following elevation, ceiling-profile handles, Reveal affordances, depth cueing) — questions no codebase harvest can answer because neither predecessor implements them. The remaining *implementation* gaps (identity-preserving merge, regeneration determinism) are decisions-with-tradeoffs, not unknowns requiring precedent; both harvests already bound the solution space (don't merge selectable streams; key caches on instrument+source versions).

**No third harvest needed.** The H1–H5 Phase-2 sequence (Homemaker traces/hulls, SH3D endpoint heights, Blueprint3D browser feed) should be stood down or repurposed: Homemaker's CellComplex would answer "is full topology needed for multi-room ceilings?" — but Bonsai's containment/contention evidence (§11) plus FreeCAD's baked-solid sections already support P26's lightweight `CeilingRegion` against that challenge, and a CellComplex harvest risks re-opening a settled direction. SH3D's endpoint-height interpolation is subsumed by the agreed piecewise-linear wall-top profile (no new question). If any follow-up lookup happens at all, it should be a **targeted read, not a harvest**: Homemaker's `GetTraces()/GetHulls()` room-free spanning as a 1–2 hour validation of multi-room `CeilingRegion` coverage — only if design-phase work specifically doubts spanning without CellComplex.

The evidence phase is closed; the open questions are design-phase decisions to prototype, not precedents to find.

## Appendix — source map

| Path | Symbol / region | Purpose (one line) |
|---|---|---|
| `src/ifcopenshell-python/ifcopenshell/util/representation.py:30-55` | `CONTEXT_TYPE` / `REPRESENTATION_IDENTIFIER` / `TARGET_VIEW` | Canonical vocab literals incl. all 9 TargetViews |
| `src/ifcopenshell-python/ifcopenshell/util/representation.py:358-425` | `get_prioritised_contexts` | Priority fallback order (Model>Plan, MODEL_VIEW first) |
| `src/bonsai/bonsai/bim/module/drawing/prop.py:284-301` | `TargetView` / `TARGET_VIEW_ITEMS` | 5-value drawing enum + labels |
| `src/bonsai/bonsai/bim/module/drawing/prop.py:497-689` | `BIMCameraProperties` + fingerprint | Transient camera state; semantic kind excluded from fingerprint |
| `src/bonsai/bonsai/bim/module/drawing/operator.py:609-678` | `get_linework_contexts` | Per-TargetView context priority (Branch A) |
| `src/bonsai/bonsai/bim/module/drawing/operator.py:1392-1430` | `setup_serialiser` | C++ serializer flags; RCP mirror (Branch B, `:1428-1429`) |
| `src/bonsai/bonsai/bim/module/drawing/operator.py:1500-1573` | `get_element_by_guid` / cut-vs-projection tokens | SVG identity round-trip + stream classification |
| `src/bonsai/bonsai/bim/module/drawing/operator.py:1533-1700` | `merge_linework_and_add_metadata` | Join/merge stage (identity 1:N demotion point) |
| `src/bonsai/bonsai/bim/module/drawing/operator.py:1792-1827` | `generate_annotation` | Frustum-filtered annotation merge, z-order |
| `src/bonsai/bonsai/tool/drawing.py:670-710` | annotation/body context resolvers | Plan-vs-Model annotation parents |
| `src/bonsai/bonsai/tool/drawing.py:848-901` | `generate_drawing_matrix` | Per-(view,hint) camera table; RCP Z-flip; section = anti-elevation |
| `src/bonsai/bonsai/tool/drawing.py:2358-2458` | `get_drawing_elements` / `get_drawing_spaces` | Membership: frustum ∩ Include − Exclude − openings; spaces separate |
| `src/bonsai/bonsai/tool/drawing.py:2652-2793` | frustum test / `bisect_mesh*` | Clip-slab culling; BISECT-alternate cut path |
| `src/bonsai/bonsai/tool/raycast.py:754-1674` | `Raycast` class | Snap engine; Blender-object waist; no IFC inside |
| `src/bonsai/bonsai/tool/snap.py:56-201` | snap flows + cut re-anchor | Host-anchored cut snaps; occlusion logic |
| `src/bonsai/bonsai/bim/module/drawing/decoration.py:163-333` | `BaseDecorator` | Shader/winspace helpers; `(obj, decorator)` ownership pattern |
| `src/bonsai/bonsai/bim/module/drawing/decoration.py:1641-1884` | `CutDecorator` | Viewport-only cut overlay; `element.id()` caches; merge buffers |
| `src/bonsai/bonsai/bim/module/drawing/decoration.py:2012-2134` | `DecorationsHandler` | Dispatch; camera/local-view gates |
| `src/bonsai/bonsai/bim/module/drawing/svgwriter.py:227-567` | doc/dispatch/classes | SVG emission; `GlobalId-<guid>` class tokens, no `id=` |
| `src/bonsai/bonsai/bim/module/drawing/svgwriter.py:1641-1710` | text + projection | Text tags; camera-plane projection |
| `src/bonsai/bonsai/bim/prop.py:744-746` | `ifc_definition_id` | Integer identity key on Blender objects |
| `src/bonsai/bonsai/tool/ifc.py:140-214` | `get_entity` / id maps | Key↔entity↔object resolution both directions |
| `src/bonsai/bonsai/bim/module/context/prop.py:32-63` | context/subcontext/view enums | Persistent IFC context vocab (UI) |
| `src/ifcopenshell-python/ifcopenshell/api/context/add_context.py:35-62` | docstring + creation | Multi-rep-per-element rationale; Model/Plan ownership |
| `src/ifcopenshell-python/ifcopenshell/util/placement.py:98-127/191-203` | placement chains | Storey-independent absolute placement; Storey-Z derivation |
| `src/ifcopenshell-python/ifcopenshell/util/element.py:1061-1122` | `get_container` | 0..1 containment; scheduling/FM purpose |
| `src/ifcopenshell-python/ifcopenshell/api/spatial/assign_container.py:35-60` | containment semantics | Aggregation vs containment statement |
| `src/bonsai/bonsai/bim/module/model/opening.py` (multi-site) | void/fill navigation | `HasOpenings`/`FillsVoids`/`VoidsElements` walks |
| `src/bonsai/bonsai/bim/module/drawing/data.py:238-240/831-870` | caches / `object_decorators` | `element.id()` cache keys; `(obj, decorator)` binding |
| `src/bonsai/bonsai/test/tool/test_drawing.py:426-662` | context + matrix tests | Annotation routing + full per-view matrix table |
| `src/bonsai/test/bim/feature/drawing.feature` | 24 scenarios | End-to-end smoke (all PLAN_VIEW expands; content asserts only cut+IfcWall) |

*Evidence standard: "Observed" = direct read or verified grep with `path:line`; "Inferred" = flagged reasoning; "Comparison with FreeCAD" = delta against the prior harvest's named findings; "P26 implication" = transfer judgment, not a Bonsai claim.*
