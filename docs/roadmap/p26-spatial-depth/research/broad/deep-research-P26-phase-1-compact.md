# P26 — Architectural Spatial Depth (compact reference)

Snapshot: 2026-09-16; Scope: product model, precedent, interaction, future-proofing, Phase-2 open-source targets; Assumption: P23 final contract landed.

## 1. Thesis / direction

- P26 != small Revit. Goal: canonical architecture model that describes + precisely edits meaningful vertical spatial form.
- Product: `Layout: Plan + Orthographic(Wall Elevation, Section) + 3D`; Orthographic = contextual editing instrument, not CAD document/view-management system.
- Roles: Plan = horizontal authoring; Section = spatial-depth instrument; Wall Elevation = wall/opening instrument; 3D = verification + bounded direct manipulation.
- All consume/mutate same `LayoutDocument`. No second vertical document; no SVG-owned geometry; no visitor-specific architecture; no Scene-owned architecture. `LayoutDocument` owns truth; `SceneDocument` separate; one compiled geometry path feeds Plan/3D/visitor.
- Chain: `P23 credible Plan+topology → P26 vertical form + orthographic precision → P24 staging/material/light → P25 visitor`.
- Principles: `Plan defines where architecture is. Orthographic defines exact vertical relationships. 3D proves space. All edit one Layout truth.`; `Room stays semantic space. Ceiling becomes architecture beside Room, not owned by Room.`
- P26 problem: how one canonical wall-first model acquires controlled Y-structure + precise authoring surface. Three coupled needs, all bounded: model vocabulary; vertical instrument; canonical 3D/visitor derivation. Vocabulary-only → Inspector-heavy; gizmos-only → imprecise; rendering-only → no editable depth.

## 2. Executive findings

- Section > generic Elevation. Section exposes wall height, sill/head, platforms, ceilings, columns, adjacent rooms, overhead profile in one surface; needs explicit cut/direction/crop/depth/range. Revit: cut line + crop/depth; Archicad: infinite/limited/zero-depth + vertical range; BricsCAD: editable plane/volume.
- Elevation starts Wall-contextual, not N/S/E/W tabs. Flow: `select Wall/Opening → Open Elevation → look normal to Wall → edit wall-local U/Y → Back to Plan`. Precedent: Revit Plan markers snapping to walls; BricsCAD interior elevations per Space wall. Room → Interior Elevations = chooser over boundary Walls (BricsCAD/Archicad pattern); Room = navigation context, not geometry owner.
- Ceiling = first-class Layout region/surface; footprint may seed from ≥1 Rooms. Handles: 1 ceiling spans N Rooms; N regions in 1 Room; adjacent Rooms differ; partial coverage; slopes; gables; future Levels; Room identity survives ceiling edits. Precedent: Revit wall-bounded/sketch-bounded ceiling; Vectorworks Slab (ceiling/floor/flat-roof, wall-associated or manual).
- Bounded vertical profiles, not free solids. Vocabulary: Wall footprint/centerline (existing) + vertical top profile (new); Opening host+offset (existing) + width/sill/head richer editing + rectangular/round-arch/pointed-arch (existing); Column footprint+base+height; Platform footprint+base+thickness/top; CeilingRegion footprint + flat/shed/gable + thickness. Excludes: Roof families, compound assemblies, arbitrary wall-profile sketch, massing, family editors, solid modeling.
- No full multi-select/transform core. Mature semantics deep: Revit constrained-move vs destructive `Disjoin` (identity-replacing, Autodesk-warned); BricsCAD preserve/break connectivity; Archicad marquee moves only enclosed nodes/endpoints, enclosed polygon rigid, curves preserve central angle; SketchUp stretches raw connectivity + Autofold new folds. Museum Room-region transform harder: shared-Wall ownership; fixed neighbor; Junction creation; Wall split; host preservation; lineage; deterministic Undo; curves; partial selection. P26: selection-set primitives only if vertical tools require; no proportional Room reshape.
- Reserve datum semantics; no Levels. Stop assuming `Y=0`; no Storey/Level hierarchy. Objects express base elevation / vertical reference so future multi-level avoids redefining Wall/Opening/Column/Platform/Ceiling.
- RCP useful, not top-level peer. Revit authors ceilings in RCP; BricsCAD RCP = downward horizontal section projecting ceiling geometry. Museum: Ceiling focus / reflected Plan overlay inside Layout, not `Plan|Elevation|Section|RCP|3D`; avoids shell explosion.

## 3. Key concepts / definitions

- `LayoutDocument` vs `SceneDocument`: Layout owns architecture; Scene owns staging; compiler/evaluator single path; deterministic Layout history.
- P23 base: canonical Walls+Junctions; persistent semantic Rooms; hosted Openings; curved Walls; topology-aware direct edit; Plan snap/guides; identity; one compiler; deterministic history; credible Plan. P23.13: architectural drawing when idle; precision editor when touched. P23 single-target; marquee/multi deferred.
- Post-P23 gap = vertical authorship; current convergence: flat floor + extruded Walls + rectangular openings + mostly flat top + flat Room ceiling; curves/arches help footprint, not silhouette/volume.
- Orthographic instrument: transient editor view state deriving from Layout compiler; cut owns no Wall slices, projects them.
- `wall.topMode = {kind:'profile',profile} | {kind:'fit-to-overhead',ceilingId}` (candidate; Phase-2 reconciliation required; current per-Wall height evolves, exact migration needs layout-core inspection).
- Ownership rules: architecture/walking-surface/room-volume change → Layout Platform; artwork holder/decorative → Scene staging/plinth (P24 owns asset/staging/material/lighting, not architecture). Column: support/spatial-boundary → Layout; decorative prop → Scene; meaning decides, not mesh. Editing in 3D never transfers ownership.
- Transform future intent: `selection → transform region → lock interface → propose Wall/Junction/Opening mutations → preview → validate → one deterministic transaction or none`. Stretch-A-against-B question is policy (shared Wall moves? B shrinks? connectors? refuse? explicit B inclusion?), not math.

## 4. Current state / SOTA (precedent matrix → §4)

| Tool | Plan/Elev/Section | Vertical edit | Ceiling/overhead | P26 lesson |
|---|---|---|---|---|
| Revit | persistent Plan/Elev/Section/RCP; Section=cut line+crop+depth; Elev=Plan marker near Walls | profile edit moves user to Section/Elev; tops attach to ceiling/roof/floor | independent element, wall- or sketch-bounded; flat/sloped/cathedral | copy model/view split, not doc bulk |
| Archicad | Sections infinite/limited/zero-depth + vertical ranges; interior Elev space-related; range guides screen-only | Wall/slant/height in 3D+Section with numeric tracker | rich roof/shell incl. multi-plane linked Roof | constrained direct manipulation + temporary numeric precision |
| Vectorworks | Section/interior-elev viewports finite extents + depth cueing | wall peaks/height in 3D; door/window width in Plan, more dims in 3D | Slab=floor/ceiling/flat-roof; wall-derived or manual | views expose different DOF; ceiling need not belong to Room |
| AutoCAD Architecture | Section line length/depth/height; linked 2D/3D/live sections | property-driven; live sections linked | roof/slab independent of Room | derived views rich without duplicate architecture |
| Rhino 8 | clipping arbitrary direction, custom finite depth, zero-depth slice, optional Named View | general direct 3D, not architectural constraints | generic surface/solid | instrument first, saved view optional later |
| BricsCAD BIM | one Section entity: Section/Elev/Interior-Elev/RCP/Detail; direction/bounds/volume grips | 3D DRAG face manipulation + dynamic dims + preserve/break | RCP=downward horizontal section | one section instrument serves many views |
| SketchUp | general ortho/scenes/sections, less semantic | face/edge/endpoint stretch + Autofold creases | generic | direct but dangerous; auto-topology breaks deterministic wall-first semantics |
| Sweet Home 3D | Plan+3D consumer, little ortho authoring | Wall start/end heights; split-height interpolation | sloped ceilings need wall/model workarounds | endpoint model goes far, then runs out |

Cross-tool: no precedent for equal-weight views; pattern = `canonical model → projections/instruments → each exposes useful DOF`. Symmetric tabs = UI symmetry, not necessity.

## 5. View instruments + contracts

### Plan authority

Owns: Wall/Junction footprint; Room topology; Opening horizontal host+width; Column footprint; Platform/Ceiling footprint; Section placement; gross relationships. Not overloaded with vertical dims; lightweight selected-target indicators only: `Wall 2.8 m ↕`; `Ceiling Flat·3.2 m`; `Platform +0.45 m`; no permanent elevation-tag field. Rule survives: architecture visible; precision where user works.

### Section instrument (editor view state, not geometry)

```ts
type SectionInstrument = { origin: Vec2; tangent: Vec2; lookSide: 'left'|'right'; span: {start:number;end:number}; depth: {kind:'cut-only'}|{kind:'finite';meters:number}; verticalCrop?: {minY:number;maxY:number} };
```
Evidence: Revit authored cut line, crop/depth, moving cut changes Section; Archicad Infinite/Limited/Zero-Depth + vertical range, screen-only guides; Rhino arbitrary direction + custom/zero depth + optional persistence; BricsCAD start/end, flip, boundary, top/bottom grips.
Creation: `Section tool → click start → click end → move pointer for look/depth → click → enter`; lighter: `drag line → release → default finite depth → arrow flips → handle adjusts`. Default finite; infinite unreadable in large museums.
Edits: Wall height/top profile; Opening sill/head/width (only when Wall near/perpendicular enough); arch rise/profile; Column base/top; Platform base/top; Ceiling elevation/slope/ridge; perhaps floor datum later. Reject/redirect non-represented geometry; never fake precision from oblique projection.

### Wall Elevation (minimum)

Derived from `wall id + viewed side + horizontal extent + vertical crop + optional shallow background depth`. Not N/S/E/W. Entry: `select Wall → Open Elevation`; `select Opening → Elevation` (opens host Wall); `select Room → Interior Elevations` (chooser). Room = context only.
Handles: Opening left/right width, sill, head, arch rise/apex; exact values in Inspector. Precedent: Vectorworks Plan=width vs 3D=vertical reshape + constrained insertion/snapping; Revit explicit head/sill for hosted Doors/Windows. No Door families/jambs/transoms/catalogs/arbitrary sketches/fake handing; arch vocabulary sufficient.

### 3D + selection identity

3D = gross spatial form: Archicad Wall height/slant in Section+3D; Vectorworks peaks + per-view dims. Matrix: Plan Opening=move-along-Wall+width; Elev/Section=width+sill+head+arch; 3D=coarse width+sill/head+preview. One canonical intent path, not three implementations.
Selection identity view-independent: `Plan select O-7K3M → Elevation same O-7K3M → 3D same O-7K3M`; handles change, identity not. No section-local proxy IDs (fits P23 determinism). If outside depth: `O-7K3M outside current section depth [Reveal]`.

### View/mutation architecture (concept, not commitment)

```ts
type LayoutView = {kind:'plan'} | {kind:'wall-elevation';wallId:LayoutWallId;side:WallSide;crop?:OrthoCrop} | {kind:'section';cut:SectionCut;crop?:OrthoCrop} | {kind:'3d'};
type LayoutIntent = SetWallTopProfile | SetOpeningVerticalGeometry | SetColumnVerticalExtent | SetPlatformElevation | SetCeilingProfile;
```
Flow: Plan/Section/Elevation/3D handle + Inspector field → same intent/candidate pipeline → validation → one Layout transaction. `wallId` = canonical Wall; Section holds no copy; view state initially UI/editor state; pinning later.
Ceiling workflow: `Plan → Ceiling tool → click Room / multi-space / sketch → independent CeilingRegion → Flat/Shed/Gable → Section drag elevation/ridge/eave → 3D verify/coarse`; future `Plan → Ceiling Focus` reflected overlay.
Section UX: idle `A ──→ A`; selected `●──● →` + `depth` box; open `A–A` with wall-cut poche/window/ceiling/platform; breadcrumb `Plan / Section A–A` or `← Plan Section`; Section is Layout-only, not Camera domain.
Persistence: P26 transient (maybe workspace current); later `Pin Section/Elevation` = editor view records, not geometry; much later named Views/sheets/annotation/callouts only if documentation becomes goal.

## 6. Ceiling + vertical-form contracts

### Ownership (A/B/C rejected, D recommended)

- A Room metadata (`room.ceilingHeight=3`): trivial/auto/flat but 1:1 assumption, no spanning/multi-region/partial/slope, Room owns unrelated geometry, topology edits break lifecycle. Reject.
- B Wall-derived closure (compiler caps enclosed Rooms): simple, no entities, but same limits + unselectable + poor partial/slope/span. Fallback only when no authored ceiling.
- C First-class bound to Room: better but fails spanning/topology change; relationship must be derivable, not ownership key.
- D First-class region/surface (recommended):
```ts
interface LayoutCeilingRegion { id: LayoutCeilingId; footprint: LayoutRegionBoundary; baseElevation:number; profile: {kind:'flat'}|{kind:'shed';direction:Vec2;slope:number}|{kind:'gable';ridge:Segment2;eaveElevation:number;ridgeElevation:number}; thickness:number; }
```
Schema awaits harvest/design; ownership: Room may seed/overlap, never owns. Precedent: Revit enclosed-region-or-sketch + level/offset/type/slope; Vectorworks Slab wall-following or manual.

### Profiles

- Flat: `Ceiling → click Room → Create from Room` or `draw region`; Inspector `Elevation 3.20 m; Thickness 0.15 m; Profile Flat`; Section `── ceiling ● 3.20m`, drag Y + temp dim.
- Shed: one planar slope, no freeform mesh; `Profile Shed; Direction ←→; Low 2.8 m; High 4.1 m` or `elevation+slope`; Section two endpoint handles; 3D rise direction.
- Gable: `footprint + ridge line + eave elevation + ridge elevation + thickness`; Plan `┌──┐│ ── RIDGE ── │└──┘`; Section ⊥ ridge `∧`; fast identity. Archicad linked multi-plane Roof = evidence only, beyond P26.
- Ceiling vs Roof: no overhangs/eaves/fascia/gutters/dormers/valleys/intersections/assemblies/rafters/drainage. Need = interior volume; outer closure for visitor geometry allowed without roof semantics. Name `CeilingRegion/OverheadRegion` per design; ownership > name.
- Wall-to-ceiling: consider `Wall top [Fixed profile | Fit to ceiling C-…]`; direction `Ceiling geometry → optional Wall-top fit`, never `Room→Walls→Ceiling→Walls→Room` cycle. Revit attaches top/base to Roof/Ceiling/Floor/plane/Wall.

### Wall / Opening / Column / Platform

- Wall: constant → piecewise-linear top; forms constant `──`, single-slope `──╱`, gable `──╱╲──`. Precedent: Vectorworks peaks in 3D; SH3D start/end heights + split interpolation. No arbitrary sketch (Revit Section/Elev lines/arcs powerful but new planar topology editor + curved-Wall limits; Museum topology already hard). Concept `type WallTopPoint={distanceAlongWall:number;y:number}`; curves use arc length (wall-local Opening family); no center-chord shortcuts.
- Opening P23 base: host Wall, meter offset, width, height, sill, rectangular/rounded/pointed. P26 = authoring, not families. Elev handles: arch apex ●, head/width ●, sill/width ●; Inspector exact.
- Column: footprint + base + height/top; Plan footprint, Section/3D height (Archicad handle precedent); no structural semantics.
- Platform: footprint + base + thickness/top; Plan shape, Section rise/thickness, 3D manipulation.

## 7. Comparisons / tradeoffs (candidate models)

- A Four peers (`Plan|Elevation|Section|3D`): familiar, clear modes, doc room, Revit/Archicad mapping; but Elevation ambiguous, Section no default, shell growth, persistent view manager, CAD-doc drift, empty modes. Arch low, UX high, future very high, complexity high. Good eventual broad tool; wrong first P26.
- B Plan + contextual Orthographic + 3D (recommended): precise, bounded, clean shell, arbitrary Section, immediate Wall Elev, no Project Browser, later pinnable (`transient → pinned/saved` without rework). Weakness: navigation/return design must excel; `Plan|3D` mental model breaks. Arch: derived projection + vertical model; UX moderate; future very high; complexity medium-high.
- C Plan+3D only: simple, intuitive, no projection; but occlusion, poor dimensioning, sill/head/ridge hard, wall-local awkward, multi-room ceilings/alignments hard, gizmo overload. Model sound; UX messy at scale; future medium. Companion only.
- D Room-centric Interior (`Room→Interior→WallA/B/C/D`): museum-relevant, approachable, good interior opening workflow; but cross-Room Sections/ceilings weak, implies Room owns walls/ceilings, exterior second-class. Future medium. Use as convenience into Wall Elevation, not core.
- E Saved Section/Elev objects day one (`Views: A/B/Gallery…`): repeatable, documentable, named; but lifecycle/naming/persistence/identity/history/UI overhead, little visitor value. Rhino clipping-as-instrument + optional Named Views shows persistence can be additive. Later extension of B, not minimum.

## 8. Evidence / benchmarks

- Depth cueing/readability: Revit near/far depth; Vectorworks tone/thickness falloff; Rhino Section Styles fill/boundary; AutoCAD Architecture display components + live linked sections; BricsCAD selection dims + DRAG editable refs.
- Section defaults for many Rooms: finite span + finite far depth + optional vertical crop; hierarchy `CUT ████ strongest / NEAR ── medium / FAR ---- light / OUTSIDE hidden`; `Background [None|Faded|Full]`; cut-only for precision (Archicad zero-depth, Rhino depth=0 validate).
- Spanning/adjacent: CeilingRegion spans `A|B|C → ┌ spans A+B ┘`, no duplication, coverage derived; adjacent differing heights via `Wall physical top + Ceiling A + Ceiling B`, never `roomA.wallHeight/roomB.wallHeight`; shared Wall single entity, sides differ overhead.
- Levels: no `Building→L1/L2/L3`; reserve `wall.baseElevation + wall.topProfile; opening.sillRelativeToHostBase; platform.baseElevation; ceiling.profileElevation`; later `verticalReference={datumId:levelId,offset}` without geometric change. Precedent: BIM level/story refs; Revit ceilings level-offsets; Archicad ranges referencing zero/story. Bad trap: `wall.height // implicit y0=0`. Recommendation: reserve datum-capable numerics; defer Level entity/UI.

## 9. Visual / interaction language

- Resting Section = drawing, not debug. Priority: 1 cut, 2 near, 3 far, 4 passive, 5 hidden absent. Grammar: cut strongest + light neutral poche + closed solids legible; projected thinner; far lighter/thinner; Scene footprints passive, never Layout hit authority; selected P23 blue; hover softer; no section-red.
- Active: precision around target only (`●──● ↕ 3.40 m`; `window ┌─┐ ←1.60 m ↑0.90m sill`); show handles + temp dims + one accepted snap + guide + proposal; hide on end.
- Snap: reuse P23, no second engine. Candidates: datum; Wall top; Opening head/sill; Platform top; Ceiling surface; Column top; Section intersections; grid/metric increment. Accepted winner only; no candidate cloud.
- Invalid: `drag → proposal → validate → commit once or nothing`; visual `valid ──●` vs `invalid - - × Cannot place opening above Wall top`; no auto-repair unless explicit.
- Plan instrument: inactive `line + quiet arrow`; selected `●──● →` + finite-depth box; depth/range editor-only, no persistent crop clutter (Archicad screen-only marker precedent).
- Semantic zoom out: temp dims → secondary edges → labels → handles disappear; cut silhouette stays; architecture outlasts furniture noise.

## 10. Product / roadmap implications

- P26 core (10): contextual Section; contextual Wall Elevation; shared ortho render/selection/snap; Wall top profiles; Opening vertical edit; independent CeilingRegion flat/shed/gable; Column extent; Platform extent; bounded 3D manipulation; datum-safe architecture.
- Not core: full Levels/Roofs/BIM; persistent sheets/docs; arbitrary wall sketches; Room-owned ceilings; Scene-owned architecture; full Room transforms.
- Safe later wholes (no seam): translate/rotate/mirror whole Layout. Deferred: proportional Room resize; partial rotate/mirror; topology-creating transform; auto-split at boundary. P26 batch-only candidates: multi-Wall height; multi-Opening head align; multi-Column height; multi-Ceiling props.
- Rejected/deferred: full BIM (IFC/phases/assemblies/layers/schedules/structure/families/MEP/sheets — precedent only, not parity); full Roof; freeform Wall sketch; Room-owned ceiling; Scene architecture; separate Section geometry/slices; separate Elevation document; permanent Section/Elev manager first slice; RCP peer (overlay until staging/light proves need); full region transform (separate capability); full Levels (reserve now); auto topology repair (show why + refuse; never invent Walls/splits/identity).

## 11. Risks / limitations / unresolved (design-phase, not pre-decided)

Ortho navigation (contextual `Plan|3D + Open Section` vs `Plan|Ortho|3D` vs breadcrumb takeover); Section creation (line-first vs drag-volume, default far depth, direction, crop display, cut-only toggle, persistence, transient-only vs recent list); Wall Elev entry (double-click/context/Inspector/toolbar/floating; no expert-only hiding); handle grammar (Wall top/profile-point, sill/head, arch rise, Column/Platform top-base, eave/ridge; distinct from TransformControls); temp dims (which appear/typed/collision/selected-vs-hover/metric/keyboard); Section hierarchy (weights, poche, projected, fading, Scene passivity, Room fill/labels, ceiling language, hidden); ceiling authoring (from Room/Rooms/draw — subset?, defaults, ridge interaction, slope display, overlaps); Wall-fit-to-Ceiling inclusion + attached-state display; 3D handle subset (likely Wall/Column/Platform/Ceiling, Opening detail to Elev; avoid gizmo forest); Ceiling Focus required for P26 vs follow-up (`Ceiling selected → Edit Plan`, fade floor arch; RCP term maybe unnecessary); multi-select (same-property batch vs none; no Room-transform creep).

## 12. Recommendations

Use Model B; add five vocabularies; single intent pipeline; transient contexts → pinned views → docs only if needed; harvest per-question (H1–H5 below), not one mega-harvest mashing features.

## 13. Source / reference index

Repos (concept study; literal reuse needs license review; do not copy GPL into Museum): `FreeCAD/FreeCAD` LGPL-2+ C++/Python/Qt/OpenCascade, very mature/active (weekly 2026-09-16) — Section-plane→drawing, cut/render, Wall/Window/Roof — PRIMARY H1. `IfcOpenShell/IfcOpenShell+Bonsai` core-LGPL/Bonsai-GPL-3+ C++/Python/Blender, very active ~22k commits Sep-2026 — PLAN/ELEVATION/SECTION/REFLECTED_PLAN/MODEL taxonomy, drawing, IFC relations — PRIMARY H2. `brunopostle/homemaker-addon` GPL-3+ Python/Topologic/IfcOpenShell/Blender, small/current 2026 — CellComplex traces(2D wall/room/extrusion chains)/hulls(3D roof/soffit shells), `GetTraces()/GetHulls()`, multi-room closure — PRIMARY focused H3. Sweet Home 3D GPLv2+ Java/Java3D (+JS), mature mirror (`keich/SweetHome3D` unofficial) — endpoint heights, split interpolation, Plan↔3D — SECONDARY H4. `furnishup/blueprint3d` MIT TS/Three.js, old/prototype refactor/test debt — Floorplan(Walls/Corners/Rooms), Plan→3D — STUDY-only H5.

## 14. Phase-2 harvest contracts

- H1 FreeCAD: Q: arbitrary plane select/cut; cut vs projected/background split; finite extent; SVG/vector output; identity survival; Wall/Opening/Roof participation; derived vs persisted. Inspect: `src/Mod/BIM/ArchSectionPlane.py; bimtests/TestArchSectionPlane.py; TechDraw/App/DrawViewArch.cpp; BIM/ArchVRM.py; BIM/ArchWall.py; ArchWindow.py; ArchRoof.py`. Pivot: duplicated/lossy → don't imitate; cheap per-source derived primitives → supports reusable `OrthographicRenderModel`; curved-cut ambiguity/cost → constrain edit targets, keep full render.
- H2 Bonsai: Q: view-target rep; ortho orientation derivation; cut decorators vs projected; RCP reverse projection; raycast/selection on derived display; annotation vs model; hosted/opening canonicity across views. Inspect: `bonsai/bim/module/drawing/{prop,operator,decoration,ui}.py; tool/drawing.py; tool/raycast.py; ifcopenshell/util/representation.py; bim/{prop,operator,ui}.py` (cutaway/decorator); reflected-plan matrix-orientation tests. Pivot: RCP/Section mostly camera config → single Orthographic; separate rep contexts but original identity → copy identity split, not IFC machinery; RCP ≈ orientation+visibility → lightweight overlay.
- H3 Homemaker: Q: horizontal topology + non-horizontal hulls; cell vs shell; roof/soffit without Room ownership; shared shell; surviving topology past planar; multi-level closure needs. Inspect: `topologist/__init__.py; molior/{__init__,shell,floor,extrusion}.py`; focus `GetTraces/GetHulls/CellComplex/horizontal-vertical-nonhorizontal/space-allocation`; not Blender UI. Pivot: full CellComplex required → challenges lightweight CeilingRegion; traces+hulls compose room-free → validates proposal.
- H4 SH3D: Q: start/end-height range; variable-height tessellation; discontinuity-free splits; Plan-first height UX; ceiling insufficiency. Inspect: `model/Wall.java; viewcontroller/WallController.java; j3d/Wall3D.java; j3d/Room3D.java; swing/WallPanel.java`. Pivot: endpoints suffice → start two-elevation profile; gable needs hacks → ship piecewise now.
- H5 Blueprint3D: Q only: browser Plan→Three feed; wall-local coords; Room faces from half-edges; anti-patterns. Inspect: `src/model/{floorplan,room,wall,corner,half_edge}.ts; floorplanner/*; three/*`. Pivot: very little; no product drive; post-architecture implementation contrast only.
- Sequence: H1 cut/vector → H2 view/identity → H3 cell/hull → H4 simplicity check → H5 optional browser contrast → synthesize.

## 15. Research inventory + loss audit

Named entities: Revit; Archicad; Vectorworks; AutoCAD Architecture; Rhino 8; BricsCAD BIM (DRAG); SketchUp (Autofold); Sweet Home 3D; FreeCAD (BIM/TechDraw/OpenCascade/Qt); IfcOpenShell/Bonsai; Topologic; Homemaker/molior; Blueprint3d; Three.js; Java3D; Blender; Autodesk (`Disjoin`); Museum Editor P23/P24/P25/P26; `LayoutDocument/SceneDocument/LayoutView/SectionInstrument/LayoutCeilingRegion/WallTopPoint/LayoutIntent/OrthoCrop/SectionCut/LayoutWallId/LayoutCeilingId/LayoutRegionBoundary/Vec2/Segment2/WallSide/OrthographicRenderModel`.
Quantitative: 2026-09-16 weekly/maturity point; ~22k IfcOpenShell commits; dims 2.8 m ↕, Flat·3.2 m, +0.45 m, 3.20 m elev, 0.15 m thick, Shed Low 2.8/High 4.1, 3.40 m wall-top, window 1.60 m + sill 0.90 m; exemplar `O-7K3M`; models A–E; harvests H1–H5; P26 core 10 / non-core 9; ceiling profiles 3; arch types 3; RCP/view taxonomy 5 (`PLAN/ELEVATION/SECTION/REFLECTED_PLAN/MODEL_VIEW`); Archicad depths 3; Background modes 3; zoom steps 5; visual priorities 5.
Unresolved/hypothesis: §11 all items; `wall.topMode` + migration; `verticalReference` shape; Fit-to-Ceiling inclusion; Ceiling Focus P26 vs follow-up; batch multi-select scope; default finite depth value; overlapping-CeilingRegion behavior; gable-ridge interaction.
Structure mapping: §1←§1 core+judgments 1–7; §2←§2 P23/P23.13/gap; §4←§3 full 8-row matrix + cross-tool; §5←§4.1–4.5 + §11 view/mutation/persistence + §8.1–8.2; §6←§5.1–5.6 + §6.1–6.4 + §8.3–8.5; §7←§7 + §10 A–E; §8←§8–9 evidence; §9←§9 resting/active/snap/invalid/Plan-appearance/zoom; §10+§12←§11–12; §11←§13; §13–14←§14 harvests+sequence; §15 audit.
Field-level audit passes. All substantive source items accounted for. Row × column audit passes (8-row precedent + 5-row candidate matrices). Enumeration-closure audit passes (profiles, arches, depths, intents, core/non-core, snap, zoom, rejects, open questions). Protected-token audit passes. Exact inputs/outputs/invariants preserved in compressed syntax. No new facts; contradictions preserved; inference kept as recommendation/concept. Citation portability: no portable URLs in source beyond repo identifiers; no invented citations.
