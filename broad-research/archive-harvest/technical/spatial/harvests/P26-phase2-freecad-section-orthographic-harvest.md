# P26 Phase 2 — FreeCAD Section / Orthographic Harvest

## 1. Harvest scope and repository state

- Repository: local clone at `FreeCAD/` (sibling of `spatial-sketch-editor-3/` in parent workspace).
- Commit SHA: `3f5a2ae6b89d9dc40d00729a2f058866400664a1`
- Branch: `main` (tracks `origin/main`, clean).
- Commit date/subject: `2026-08-02 — Part: Allow unorientable shapes in booleans`.
- License: `LICENSE` at repo root is **GNU LGPL v2.1** (`LGPL-2.1-or-later` per SPDX headers, e.g. `src/Mod/TechDraw/App/DrawViewArch.cpp:1`, `src/Mod/BIM/bimtests/TestArchSectionPlane.py:1`). **License boundary:** ideas and architecture patterns may transfer; do not copy FreeCAD source into the Museum Editor codebase without a license review (LGPL copyleft boundary vs. Museum licensing). Nothing in this report reproduces FreeCAD code beyond short factual references.
- Inspected subsystems (primary evidence only):
  - `src/Mod/BIM/ArchSectionPlane.py` (1850 lines — object model, cut pipeline, SVG assembly, view provider, task panel)
  - `src/Mod/BIM/bimtests/TestArchSectionPlane.py` (190 lines — full read)
  - `src/Mod/TechDraw/App/DrawViewArch.cpp` (151 lines — full read) + `DrawViewArch.h` (declaration skim)
  - `src/Mod/BIM/ArchVRM.py` (763 lines — full read via harvest + spot verification)
  - `src/Mod/BIM/ArchCommands.py` `getCutVolume` (lines 495–578 — full read)
  - `src/Mod/Draft/draftobjects/shape2dview.py` (lines ~280–360 — Depth wiring verification)
  - `src/Mod/BIM/ArchWall.py` / `ArchWindow.py` / `ArchRoof.py` / `ArchComponent.py` (targeted grep + reads: execute paths, `processSubShapes`, `getSubVolume`)
  - `src/Mod/BIM/bimcommands/BimSectionPlane.py`, `BimTDView.py`, `BimDrawingView.py` (creation/generation commands)
  - `src/Mod/BIM/ArchCutPlane.py` (distinction overview)
  - `src/Mod/Draft/draftfunctions/svg.py` + `svgshapes.py` (SVG identity check)
- Not inspected in depth (per mission): Museum Editor code, IFC import/export, structural/MEP, unrelated workbenches. P26 Phase-1 compact artifact was read first and used as hypothesis source only.

## 2. Executive findings

1. **A Section in FreeCAD is a persisted instrument object, not transient view state — but it owns no architecture.** It is an `App::FeaturePython` document object (`Type="SectionPlane"`) whose persisted state is a handful of properties (scope, flags, extents-as-view-properties, placement). Its `Shape` is a recomputed planar face. All architectural truth stays in source objects; the Section only references them. *Observed in FreeCAD source (§3). P26 implication: this validates the "instrument over canonical model" posture at the object-model level, though FreeCAD persists the instrument where P26 proposes transient-first.*
2. **Cut vs. projected geometry splits semantically in intermediate data, before styling.** `getCutShapes` returns three separate compounds — `shapes` (kept/visible), `hshapes` (hidden/behind), `sshapes` (cut faces) — and the Solid-mode renderer keeps three parallel lists (`faces` / `sections` / `hiddenEdges`). Line weight, dash, and fill are applied per stream afterward. *Observed (§5). P26 implication: keep the same separation in any `OrthographicRenderModel` — one canonical derivation producing typed streams, not one anonymous line soup styled later.*
3. **Finite depth exists in the OCC helper but is only half-wired — this is the single most instructive failure in the harvest.** `ArchCommands.getCutVolume(cutplane, shapes, clip, depth)` fully implements both lateral `clip` and far `depth` (lines 563–577). `Clip` is threaded through every path. `Depth` (the persisted `SectionPlane.Depth` property, "keep zero for unlimited") is read **only** by the Draft `Shape2DView` path (`shape2dview.py:305–308`) and **never** by the `getSVG`/TechDraw path (`getCutShapes:207` calls `getCutVolume(cutplane, shapes, clip)` with no depth; `getSectionData` does not even return depth). So the flagship drawing output silently ignores far-depth. *Observed, directly verified (§6). P26 implication: finite depth is proven practical at the geometry level but FreeCAD shows what happens when it is a property without a pipeline contract — Museum Editor should make depth a first-class parameter of the derivation function, not an optional property some consumers honor.*
4. **Source identity survives the boolean stage and dies at projection — except on fill/annotation paths.** `getCutShapes` tracks `(object, solids)` → `objectShapes` and `(object, cutFaces)` → `objectSshapes` transiently, then immediately flattens each stream with `Part.makeCompound` before `TechDraw.projectToSVG`, whose HLR output is anonymous edge groups. Only `Draft.get_svg` paths (cut fills, annotations, spaces, window symbols) emit `id="ObjectName_f0003"`-style ids (`svgshapes.py:359–362`, called from `svg.py:1105/1120/1147`). *Observed (§7). P26 implication: per-source derived primitives with identity are achievable — FreeCAD already computes them — but identity must be threaded through projection explicitly; HLR-style flattening is where it is lost. Museum Editor (Three.js, no OCC) can do better by projecting per-source and tagging each primitive.*
5. **Walls, Windows, and Roofs enter Sections as final baked solids; the Section understands no architectural semantics.** Window holes are subtracted into `Wall.Shape` at Wall recompute time via `ArchComponent.processSubShapes` + `Window.getSubVolume` (a double-depth prism); Roof panes are fused sloped solids. The section core (`sub.cut(cutvolume)` / `sub.common(cutface)`) has zero `isinstance`-on-kind branching; the only kind-aware code is cosmetic (fuse Walls/Structures by material when `joinArch`, separate Spaces, overlay 2D window swing symbols). Sloped roofs section correctly through generic plane-vs-solid intersection. *Observed (§8). P26 implication: strongly supports "sloped/overhead stays canonical 3D, Section consumes generically" and "no per-kind section handling" — the Section needs solids + an optional symbol-overlay hook, nothing more.*
6. **One Section class serves Sections, Elevations, Plans, and RCPs by orientation alone.** There is no `SectionType`/`Kind` enum anywhere in `ArchSectionPlane.py` (verified by grep: zero hits). A horizontal placement is a plan/RCP; a vertical placement is a section/elevation. `BuildingPart` (e.g. a Level container) is also accepted as a section source with a synthetic plane. *Observed (§3). P26 implication: directly supports the "shared orthographic pipeline for Section + Wall Elevation" hypothesis — FreeCAD proves one instrument + one pipeline covers all orthographic forms.*
7. **The drawing is a separate persisted object with a one-way link, and liveness is page-gated.** `TechDraw::DrawViewArch.Source` (or Draft `Shape2DView.Base`) points at the Section; the generated SVG/`Shape` is baked into the view object (`Symbol` string / `Shape`). Regeneration happens on document recompute, gated by the TechDraw page's `KeepUpToDate`. There is no SVG-element→source back-pointer; return navigation is manual (view → `Source` → section → `Objects` scope list). In-drawing selection granularity is the whole view symbol. The interactive 3D "CutView" is a GPU `SoClipPlane`, not selectable geometry. *Observed (§9). P26 implication: supports "derived drawing stays non-authoritative," but FreeCAD's persisted-SVG + manual-back-navigation is heavier than P26 needs — a transient instrument can skip the persisted-view layer entirely while keeping the one-way derivation direction.*
8. **Tests cover fitting math well and end-to-end behavior barely.** Fit/center helpers have four precise rotation/union/recenter tests; the full TechDraw workflow test ends in a bare `assert True` (smoke only); one regression test pins cut-face-with-hole area exactly. No tests for depth, clipping, empty geometry, hidden geometry, orientation of output, or serialization. *Observed (§11). P26 implication: adopt the fit-math test pattern; do not mistake FreeCAD's smoke test for a drawing-correctness contract.*

## 3. FreeCAD Section object model

### 3.1 Persisted object, transient instrument semantics

- **Observed:** `Arch.py:1216–1241` (`makeSectionPlane`) creates an `App::FeaturePython` document object with proxy class `_SectionPlane` (`ArchSectionPlane.py:1025–1031`, `self.Type = "SectionPlane"`). It is **not** a `Part::Feature` — it is a plain Python feature object whose `Shape` happens to be a plane.
- **Observed:** `execute()` (`1114–1144`) rebuilds `obj.Shape` on every recompute as `Part.makePlane(l, h, …)` sized from the **ViewObject's** `DisplayLength`/`DisplayHeight` (1120–1127), placed by `obj.Placement` (1135), with an OCC-normal-direction guard (1139–1141). `Shape` is therefore derived display state, not authored geometry.
- **Observed:** transient caches live as plain Python attributes on the proxy (`svgcache`, `shapecache`), wiped in `execute()` (1143–1144); `dumps`/`loads` persist nothing (`1150–1156`). Persisted vs. derived is clean: Properties persist; plane, booleans, and SVG do not.
- **P26 implication:** FreeCAD's split is the right one — persist the instrument *definition* (placement, scope, flags), derive everything else. P26 can go one step further and keep the definition itself transient until pinned.

### 3.2 Canonical fields (exact property references)

Data properties (`_SectionPlane.setProperties`, `1033–1108`, all `locked=True`):

| Property | Type | Default | Meaning |
|---|---|---|---|
| `Placement` | `App::PropertyPlacement` | working-plane placement at creation | Plane origin + orientation; **+Z is the looking direction** (`getSectionData:134–135`) |
| `Shape` | `Part::PropertyPartShape` | recomputed plane | Derived; see §3.1 |
| `Objects` | `App::PropertyLinkList` | `[]` | Scope; **empty means whole document** (tooltip `1057–1060`; factory docstring `Arch.py:1223–1224`) |
| `OnlySolids` | `App::PropertyBool` | `True` | `False` cuts non-solids too, "with possible wrong results" |
| `Clip` | `App::PropertyBool` | `False` | Lateral clip to the plane footprint (`1082–1083`) |
| `UseMaterialColorForFill` | `App::PropertyBool` | `False` | Cut-fill color source |
| `Depth` | `App::PropertyLength` | `0` | "Geometry further than this value will be cut off. Keep zero for unlimited." — **half-wired; see §6** |

View (coin-glyph) properties (`_ViewProviderSectionPlane.setProperties`, `1167–1289`): `DisplayLength` (1000, migrates legacy `DisplaySize`), `DisplayHeight` (1000), `ArrowSize` (50), `Transparency` (85%), `LineWidth`, `CutDistance`, `LineColor`, `CutView` (bool), `CutMargin` (1), `ShowLabel`, `FontName`, `FontSize`.

- **Inferred:** extents live on the ViewObject for historical/display reasons, but `execute()` reads them, so they are functionally part of the section definition. A cleaner model would hold extents on the data object; FreeCAD's placement is an accident of the Coin-glyph implementation.
- **P26 implication:** the P26 `SectionInstrument` sketch (`origin/tangent/lookSide/span/depth/verticalCrop`) maps almost 1:1 onto `{Placement, DisplayLength/DisplayHeight, Depth, Clip}` plus a vertical crop FreeCAD lacks as a property (crop is achieved via TechDraw page/scale or `Shape2DView`, not via the section itself).

### 3.3 Placement, direction, extents

- **Observed:** looking direction = `Placement.Rotation * (0,0,1)` (`getSectionData:134–135`; normal accessor `getNormal:1146–1148`). There is **no Flip/Direction property** — flipping means rotating `Placement` 180° (TaskPanel `rotateX/Y/Z` rotates the shape copy 90° about a local axis and writes back `Placement`, `1745–1762`) or hand-editing `Placement`.
- **Observed:** creation placement = current working plane with `Base` at the selection bounding-box center; `DisplayLength/Height` = bbox X/Y + 10% when created from a selection (`Arch.py:1246–1255`); otherwise working-plane origin with 1000×1000 defaults. Creation command itself (`bimcommands/BimSectionPlane.py:36–75`, accel `S,E`) does no point-picking — it wraps the current selection.
- **Observed:** fit helpers are pure functions of `(objects, placement)`: `getSectionPlaneLocalBoundBox` inverse-transforms each object's bbox into plane-local coords and unions them (`68–88`); `getSectionPlaneFit` adds a 10% margin (`91–99`); `getSectionPlaneCenter` returns the world-space recenter target (`102–109`). Note the margin uses **XLength only** for both axes (`margin = local_boundbox.XLength * 0.1`, line 98) — a latent bug for tall-narrow scopes, confirmed by direct read.
- **P26 implication:** direction-as-placement-quaternion is OCC-idiomatic but UX-hostile (hence the rotate-button workaround). A `lookSide`/`tangent` representation like P26's is strictly better for an instrument; convert to a matrix only at derivation time.

### 3.4 One mechanism for all orthographic forms

- **Observed:** no `SectionType`/`Kind`/`Slice`/`FarDistance` enum exists in `ArchSectionPlane.py` (grep-verified absence). Orientation is purely `Placement`; the TaskPanel rotates freely. `getSectionData` polymorphically accepts a `SectionPlane` (`Objects` + `Shape`) **or** a `BuildingPart` (`Group` + synthetic 1000×1000 plane offset by `CutMargin`, `118–127`).
- **Observed:** annotations parallel/anti-parallel to the plane are included via `isOriented` (`298–313`, used at `409–420`); `Space` objects take a separate filled-label path (`407–408`, `670–689`).
- **P26 implication:** this is precedent-grade evidence for one shared orthographic pipeline. Plan/RCP = horizontal instrument; Section/Elevation = vertical instrument; Wall Elevation = section constrained to a wall's face with narrow depth. FreeCAD implements exactly this minus the wall-constraint convenience.

## 4. Geometry/data flow

### 4.1 Call/data-flow diagram (all handoffs verified)

```text
[0] Section definition (persisted instrument)
    _SectionPlane.execute()  ArchSectionPlane.py:1114-1144
      DisplayLength/Height (view props) -> Part.makePlane -> obj.Shape (plane)
      clears Proxy.svgcache / Proxy.shapecache

[1] View trigger (separate persisted view object)
    TechDraw::DrawViewArch::execute()  DrawViewArch.cpp:93-139
      mustExecute() on Source/AllOn/RenderMode/ShowHidden/ShowFill/... touch (:71-90)
      gated by page keepUpdated() (:95) -> shells to Python:
        ArchSectionPlane.getSVG(Source, allOn, renderMode, showHidden, showFill,
          scale, linewidth, fontsize, techdraw=True, rotation, fillSpaces,
          cutlinewidth, linespacing, joinArch)
      bakes result into persisted DrawViewSymbol.Symbol (:134-135)
    -- OR --
    Draft Shape2DView.execute()  shape2dview.py  (Base -> section; honors Depth!)

[2] Scope expansion
    getSectionData(source)  ArchSectionPlane.py:112-139
      Objects (or BuildingPart.Group) -> Draft.get_group_contents(walls,spaces)
      -> (objs, cutplane, onlySolids, clip, direction)   [NO depth returned]

[3] Boolean cut  <-- semantic cut/projected split happens HERE (data, not style)
    getCutShapes(...)  ArchSectionPlane.py:142-265
      collect solids (OnlySolids) or whole shapes; optional joinArch fuse of
        Wall/Structure by material (:159-193)
      ArchCommands.getCutVolume(cutplane, shapes, clip) (:207)  [depth NOT passed]
        -> cutface / cutvolume (kept side) / invcutvolume (behind side)
      per solid: sub.cut(cutvolume) -> shapes (visible)
                 sub.common(cutface).Faces -> sshapes (cut faces)
                 [showHidden] sub.cut(invcutvolume) -> hshapes (hidden)
      optional per-object grouping -> objectSshapes (for fills only)

[4a] Wireframe projection (default renderMode)
    getSVG() :510-625
      vshapes compound -> TechDraw.projectToSVG(dir)       solid style
      hshapes compound -> projectToSVG(-dir)               dashed (scale(-1,1) wrap)
      sshapes -> fills via Draft.get_svg per (object,faces) (rotate(180) wrap)
               + outlines via projectToSVG(dir, CUT width)
    TechDraw.projectToSVG -> ProjectionAlgos (HLRBRep_Algo/HLRToShape) ->
      anonymous SVG edge groups  (ProjectionAlgos.cpp:79-100, 149-180;
      binding AppTechDrawPy.cpp:1145-1214)

[4b] Solid projection
    getSVG() :474-508 -> ArchVRM.Renderer: addObjects -> cut(cutplane[,hidden])
      -> getViewSVG + getSectionSVG(fill #ffffff) [+ getHiddenSVG]
    ArchVRM is a SOFTWARE painter's-algorithm renderer (sort/compare/zOverlaps),
      NOT OCC HLR  (ArchVRM.py:55-763; no BRepAlgoAPI_Section/HLRBRep imports —
      verified by grep)

[4c] Coin projection (GUI only)
    getSVG() :461-473 -> getCoinSVG() :810+ offscreen Coin render w/ SoClipPlane;
      returns "" headless (:813-814)

[5] Assembly  getSVG() :626-730
    svg = projected + hidden + cut(fills+outlines)
        + drafts (oriented annotations via Draft.get_svg)
        + spaces (bbox-vs-cutface culled) + window 2D swing symbols
```

### 4.2 Stage-by-stage identity / durability / caching

| Stage | Preserves source identity? | Durable? | Cached? | Rebuild trigger |
|---|---|---|---|---|
| Source model objects | yes (canonical) | yes (document) | n/a | user edit |
| Section definition | n/a (references by link) | yes (Properties) | n/a | user edit → `execute()` rebuilds plane, wipes caches |
| Boolean outputs (`shapes/hshapes/sshapes`) | transiently yes (`objectShapes/objectSshapes`) | no | `Proxy.shapecache` (plain attr; key: `fillSpaces/joinArch/allOn/objs-set`, `326–342`) | cache miss; style-only changes reuse shapes |
| SVG string | partially (fills/annotations only) | **yes, in the view** (`DrawViewArch.Symbol`, `Shape2DView.Shape`) | `Proxy.svgcache` (plain attr; 7-field key incl. renderMode/showHidden/…, `326–335`); fills always regenerate (`457–458`) | any key-field change; view `execute()` |
| Projection (HLR/VRM) | **no** for outlines (compounds → anonymous groups) | no | no | every SVG rebuild |

- **Observed:** `DrawViewArch` contains zero OCC/SVG logic — it is a 151-line property bag + Python bridge (full read, §1 evidence). All geometry lives in Python (`ArchSectionPlane`, `ArchVRM`, `ArchCommands`, `TechDraw.projectToSVG` binding).
- **Inferred:** the two-cache design (shape cache keyed narrowly, SVG cache keyed widely, fills uncached) is a pragmatic response to OCC boolean cost dominating projection cost — style tweaks skip re-booleans. Museum Editor's compiler cache can mirror this: cache the cut/projected derivation keyed on `(instrument, source versions)`, invalidate styling independently.
- **P26 implication:** the stage table is directly reusable as the `OrthographicRenderModel` contract: `derive(instrument, sources) -> {cut[], projected[], hidden[], annotations[]}` with per-primitive `sourceId`, cached on `(instrumentHash, sourceVersions)`, consumed read-only by Section/Elevation/3D-verification surfaces.

## 5. Cut vs projected geometry

- **Observed — semantic split in data first.** `getCutShapes:236–249`: kept geometry (`sub.cut(cutvolume)`), cut faces (`sub.common(cutface).Faces`), and behind-plane geometry (`sub.cut(invcutvolume)`, only when `showHidden`) are three distinct lists from birth. The Solid renderer mirrors this with three lists: `faces` (projected), `sections` (cut, forced white fill `ArchVRM.py:302–304`), `hiddenEdges` (dashed). Styling (cut line width, hidden dash pattern, fill color) is applied per stream in `getSVG:551–625` and `ArchVRM.getViewSVG/getSectionSVG/getHiddenSVG:687–763`.
- **Observed — cut-face detection** is literal solid↔face intersection: `s = sub.common(cutface); tmpSshapes.extend(s.Faces)` (`240–241`), with negative-volume guard (`237–238`). Multi-material walls split cut faces per layer for per-layer fills (`212–232`, `255–258`).
- **Observed — fills/poche:** per-`(object, faces)` via `Draft.get_svg(fillstyle=rgb)` inside `<g transform="rotate(180)">` (`589–609`); color from `getFillForObject` (`268–295`): material `SectionColor` → `Color` → first multi-material layer → default; optional `UseMaterialColorForFill`. No hatch engine in this path (the commented-out pattern stub at `446–449` was never wired; `ShowFill` is a bool, not a pattern selector).
- **Observed — hidden/foreground/background:** `ShowHidden` (DVA `:60`) controls the behind-plane stream; `AllOn` skips `Draft.removeHidden` (`397–398`); there is no near/far depth cueing (no line-weight falloff by distance) in any of the three render modes — far geometry renders at full weight or not at all. Spaces are culled by `cutface.BoundBox` intersection (`671–689`).
- **Observed — clipping against finite section limits:** lateral clip (`Clip=True`) intersects the oversized cut face with the true plane rect and fuses the resulting clip volume into both kept and behind volumes (`ArchCommands.py:568–574`), then replaces `cutface` with the true plane `p` — so cut outlines also shrink to the footprint. Far-depth uses the same fuse technique on the kept side only (`563–567`).
- **Inferred:** depth cueing (Revit/Vectorworks-style weight falloff) is absent not by oversight but because the HLR projection flattens distance — cueing would need per-edge depth, which the compound pipeline discards. This is the same flattening that kills identity (§7).
- **P26 implication:** (a) keep cut/projected/hidden as typed streams from derivation through rendering — FreeCAD proves the distinction belongs in data; (b) fills need only a color + polygon per source — poche does not require a hatch engine for P26; (c) if P26 wants far-field fading, it must preserve per-primitive depth through projection (cheaper in Three.js than in FreeCAD's HLR pipeline, since Museum Editor projects per-source anyway).

## 6. Depth, crop and clipping model

### 6.1 What each control actually does (verified)

| Control | Where stored | Who honors it | Mechanism |
|---|---|---|---|
| `Clip` (lateral) | Section data prop (`1075–1085`) | all paths (`getSectionData:131–133` → `getCutShapes:207`) | `getCutVolume` clip branch (`ArchCommands.py:568–574`) |
| `Depth` (far) | Section data prop (`1098–1108`, "keep zero for unlimited") | **Shape2DView only** (`shape2dview.py:305–308`: `depth = obj.Base.Depth.Value` → `Arch.getCutVolume(cutplane, shapes, clip, depth)`) | `getCutVolume` depth branch (`563–567`); **never called from `getSVG`/TechDraw** (verified: `getSectionData` returns no depth; `getCutShapes:207` passes no depth; repo-wide grep for `.Depth` in BIM finds only IFC round-trip + this one Shape2DView read) |
| `DisplayLength/Height` (span) | View props (`1174–1197`) | plane construction (`execute:1120–1127`) + `Clip` footprint | plane rect = span; without `Clip`, span only affects the coin glyph, not output |
| `CutMargin` | View prop, default 1 (`1250–1261`) | BuildingPart-source offset (`getSectionData:123–126`); Solid-renderer working plane (`ArchSectionPlane.py:483–486`); 3D `SoClipPlane` distance (`1524–1531`) | epsilon offsets, **not** a boolean participant |
| Vertical crop | **no property** | n/a (achieved downstream via page/scale/`Shape2DView`) | absent at section level |

### 6.2 Edge behavior (observed)

- Empty input / faceless plane / OCC error / plane-misses-everything (`bb.isCutPlane` false) → `getCutVolume` returns `(None, None, None)` (`500–503`, `520–522`, `528–530`); callers degrade gracefully: `getCutShapes` appends raw subs uncut (`248–249`); `getSVG` returns `""` for empty scope (`394–396`) and falls back `cutface = cutplane` when the cut face is missing (`665–667`).
- Zero depth = unlimited (`if depth:` guard, `563`); nonzero depth clips kept-side only (behind-plane `invcutvolume` untouched except by lateral clip) — so far-clip and show-hidden compose correctly.
- `OnlySolids=False` cuts whole shapes including wires/faces ("possible wrong results"); curve-only input under the default contributes nothing (no `.Solids`) without crashing; `isNull`/`isValid` guards at `163–205`; negative-volume solids reversed (`237–238`); failed Wall/Structure fuses degrade to raw append with a console warning (`190–193`).
- **Inferred:** `Depth`'s dead-in-TechDraw state is likely a wiring omission during the `getSectionData` refactor (the 5-tuple has no depth slot while `getCutVolume` takes depth) rather than a deliberate semantic — the IFC round-trip still persists/restores `Depth` (`ifc_export.py:316–332`, `exportIFC.py:2820–2833`, `ifc_tools.py:783–787`, `ifc_objects.py:257–275`), so the property is treated as real everywhere except the one path that matters most.
- **P26 implication:** (a) finite depth + lateral crop + cut-only are all implementable as boolean-volume operations on one pipeline — no second geometry truth needed; (b) P26's `depth: {cut-only} | {finite meters}` maps to `getCutVolume(depth)` with `depth=None/0` vs. meters, and cut-only is simply "far depth ≈ 0 / skip the kept stream"; (c) make depth a **parameter of the derivation call**, defaulted finite (P26 already proposes default-finite) — never a property that consumers may ignore. FreeCAD's bug is the negative precedent that justifies this contract choice.

## 7. Source identity through derived views

- **Observed — identity exists, then is flattened.** `getCutShapes` builds `objectShapes: [(object-or-materialKey, solids)]` (`156–157`, `178–205`) and `objectSshapes: [(object-or-material, cutFaces)]` (`251–260`, incl. per-material-layer split). The Wireframe path then calls `Part.makeCompound(vshapes/hshapes/sshapes)` (`552/569/610`) and `TechDraw.projectToSVG`, which emits anonymous `<g>` edge soup (no `id` in `ArchSectionPlane.py:551–625` or `ArchVRM.py:687–763` — verified by read). The exact loss point is the compound construction: per-source lists become one OCC compound before projection.
- **Observed — identity survives on three side paths.** `Draft.get_svg` emits `id="ObjectName"` or `id="ObjectName_f0003/_wNNNN/_nweNNNN"` (`svgshapes.py:359–362`; call sites `svg.py:1105/1120/1147`), and `getSVG` uses `Draft.get_svg` for cut **fills** (`602–608`), **annotations/dimensions** (`649–661`, with `freecad:basepoint` metadata), **spaces** (`676–687`), and **window symbols** (`715–726`). So fills are traceable to sources while the outlines around them are not.
- **Observed — no back-pointers, whole-view selection.** Generated SVG carries no per-source metadata on projected/hidden/cut-outline groups (grep for `freecad`/object attrs in the projection paths: none). Return navigation is manual: `DrawViewArch.Source` (or `Shape2DView.Base`) → SectionPlane → `Objects` scope tree (TaskPanel `1723–1743`). TechDraw selection granularity is the whole `DrawViewSymbol` (`QGIViewSymbol.cpp:179` type-check only; no per-source hit code in `DrawViewArch.{h,cpp}`). The 3D `CutView` is a GPU `SoClipPlane` at scene-graph index 0 (`1503–1538`) — clipping, not geometry — hence not selectable at all; included objects get `Lighting="One side"` as a side effect.
- **Observed — regeneration breaks nothing because views hold no identity to break:** views re-derive from `Source` on recompute (page-gated liveness, §9); annotations made on the drawing are separate document objects, not linked to model subelements.
- **P26 implication:** FreeCAD loses identity at exactly the point P26 must not — the projected-outline stream. The fix is architectural and cheap in a Three.js pipeline: project **per source** (Museum Editor has tens of walls, not thousands of OCC faces; per-source projection is affordable) and tag every derived primitive `{sourceId, subKind: cut|projected|hidden, face/edgeRef?}`. Keep FreeCAD's fill-path lesson (identity via `Draft.get_svg`-style ids) and extend it to all streams. The "outside depth → Reveal" affordance from P26 §5 is also justified here: FreeCAD has no such affordance, and scope-excluded objects are simply absent with no recourse.

## 8. Wall / Window / Roof participation

### 8.1 Final shapes (observed)

- **Wall** (`ArchWall.py:504–632`): `getExtrusionData` → base faces extruded → fused single solid (single-layer Sketch) or compound of solids (multi-layer/segment); mesh bases converted; no-base-with-only-Additions yields empty shape. Hosting subtraction applied **inside** `execute` (`base = self.processSubShapes(obj, base, pl)`, line 631) before `applyShape`. Final `Shape`: solid(s) with opening voids already absent.
- **Window** (`ArchWindow.py:369–709`): `buildShapes` extrudes frame faces, cuts glazing voids, applies louvre/leaf transforms; `execute` compounds frame/pane solids **plus 2D symbol wires** (plan/elevation swing symbols, `690–709`, `allowinvalid/allownosolid=True`). Final `Shape`: deliberately mixed solid + 2D — which is why section callers must filter `.Solids`.
- **Roof** (`ArchRoof.py:650–827`): wire/footprint branch builds per-edge sloped pane solids (profile face → `createProfilShape` extrude → `common` with vertical oversize extrusion, `666–668`) and fuses them (`810–812`); flat-roof fallback extrudes the outline by thickness; solid-base branch passes through. An oversize subtraction volume is stored in-memory (`self.sub`, `817–823`). Final `Shape`: fused sloped-slab solid(s).

### 8.2 Openings are baked before Sections ever run (observed)

- `ArchComponent.Component.processSubShapes` (`ArchComponent.py:869–1025`): collects `obj.Subtractions` **plus** any object whose `Host == obj` (legacy) or `obj in link.Hosts` (current) — hosting auto-enrolls the window as a subtraction (`959–971`). Window branch calls `getSubVolume` (`980–986`); Roof branch likewise (`987–989`); result applied as `base.cut(subvolume)` (`998–1025`, OCC errors caught).
- `Window.getSubVolume` (`ArchWindow.py:742–876`): custom `Subvolume` link wins; otherwise the hole prism depth = host wall `max(Widths) + 100` ("to ensure subtract is through", `784–816`), non-wall host falls back to bbox max dimension, ultimate fallback `1.1112`; profile = `HoleWire`-indexed or largest wire, double-depth extruded prism (`858–876`).
- **P26 implication:** this is the correct division of labor and P26 should copy the *direction* (hosting resolved at compile time into canonical solids; sections consume solids), not the mechanism (magic `+100`/oversize prisms are OCC-tolerance hacks with no meaning in a clean extruded-wall model).

### 8.3 No per-kind section handling (observed absence + three narrow exceptions)

- The boolean core (`getCutShapes:234–250`) contains **zero** `isinstance`-on-kind checks (verified: only `isinstance(o, str)` at line 217 and `isinstance(wp, Placement)` in VRM). Guards are shape-level (`isNull`/`isValid`/`Volume<0`).
- Exhaustive kind-branch inventory for the section path:
  1. `ArchSectionPlane.py:162` — `Draft.getType(o) in ["Wall","Structure"]` **only when `joinArch=True`**: fuse by material. Cosmetic merge, same intersection.
  2. `ArchSectionPlane.py:407–427, 670–728` — `Space` → filled-label path; annotation types → orientation-filtered `Draft.get_svg`; `Window` (Link-aware) → **2D swing-symbol overlay** from `Proxy.sshapes` in addition to the generic solid flow.
  3. `ArchVRM.py:490–511` — `join(otype)` fuses Walls vs. Structures vs. rest for Solid-mode join only.
- **Observed vertical params consumed generically:** Wall single `Height` scalar (`ArchWall.py:173–233`, `915–918`); Window `Width`/`Height`/`HoleDepth`/`HoleWire` but **no `Sill` property** (only legacy migration renames at `ArchWindow.py:300–313` — sill is `Placement`-relative, consumed generically); Roof per-edge `Angles/Runs/Thickness/Overhang` (`ArchRoof.py:171–225`). The Section never reads any of them.
- **P26 implication:** supports hypotheses 6 (sloped stays canonical, consumed generically) and the "no per-kind section code" corollary — P26 needs exactly one semantic hook beyond solids (opening-swing/symbol overlay is genuinely 2D-only information, like FreeCAD's window symbols) and can otherwise keep the Section kind-agnostic.

## 9. Section creation and editing UX

### 9.1 Model architecture vs. GUI convention (separated as required)

**Model:** `SectionPlane` document object + Properties (§3) + `execute()` plane rebuild + transient caches; downstream `DrawViewArch.Source` / `Shape2DView.Base` one-way links holding baked outputs (`Symbol` string / projected `Shape`); liveness = document recompute, gated for TechDraw by page `KeepUpToDate` (`DrawViewArch.cpp:95`, `DrawView.cpp:657–668`; `overrideKeepUpdated(false)` at `:137`). TaskPanel `accept`/`reject` both end in `recompute()` (`ArchSectionPlane.py:1784–1791`).

**GUI convention:** `Arch_SectionPlane` (`BimSectionPlane.py:36–75`) creates from current selection with zero picking; `BIM_TDView` (`BimTDView.py:57–105`) binds selected sections to a DrawPage (`DrawViewArch`, inherits page Scale); native equivalents `CmdTechDrawArchView` / smart-insert `isArchSection` (`Command.cpp:1725–1736/364–382`, `DrawGuiUtil.cpp:491–514`); `BIM_DrawingView` (`BimDrawingView.py:57–91`) builds an annotation `BuildingPart` container (`Arch.make2DDrawing`, `Arch.py:243–282`) with two `Shape2DView` children (Solid "viewed lines" + `InPlace=False` `Cutfaces` "cut lines", cut width scaled by `CutLineThickness`).

### 9.2 Editing operations (observed)

- Creation: selection → factory; no drag-line/drag-volume gesture; defaults Display 1000, Arrow 50, Transparency 85%, CutMargin 1.
- Direction flip: no Flip property; TaskPanel 90° `rotateX/Y/Z` (`1745–1762`) or raw `Placement` edit.
- Extents: property edit or TaskPanel `Resize to Fit` (`getSectionPlaneFit`, `1764–1770`) / `Recenter` (`getSectionPlaneCenter` → `Placement.Base`, `1772–1776`).
- Depth/scope: `Depth` property (half-wired — §6); scope via TaskPanel tree + Add-Selected/Remove (`ArchComponent.addToComponent/removeFromComponent`, `1728/1742`).
- No Draft edit-trackers/grips for sections (grep in `gui_edit.py`: zero matches — verified); the coin scene (rectangle + arrows + label, `attach:1307–1415`, `onChanged:1459–1500`) is display-only.
- Section glyph stays visible in 3D always (`getDisplayModes=["Default"]`, `1417–1427`); `CutView` toggles a scene `SoClipPlane` (property, context menu `toggleCutview:1606–1607`, or TaskPanel button `1648–1656/1794–1796`), removed on delete (`1555–1558`).
- Double-click → `setEdit` → `SectionPlaneTaskPanel` via `Control.showDialog` (`1568–1604`); context menu adds Edit + Toggle CutView (`1589–1607`).
- **P26 implication:** FreeCAD's editing is property-panel-heavy with no direct-manipulation handles — the opposite of P26's handle-first instrument. The transferable part is the *operation set* (fit, recenter, flip, scope, clip/depth, live 3D cut preview); the non-transferable part is the *interaction style*. P26's drag-line → default-finite-depth → arrow-flip → handle-adjust creation (§5 of Phase-1) has no FreeCAD precedent to copy but also no FreeCAD constraint to respect.

### 9.3 Round-trip and selection (observed absence)

- No SVG-element→source back-pointer exists; no per-source hit/selection/highlight code in `DrawViewArch.{h,cpp}`; TechDraw Arch views select as whole symbols. Return path is manual link-following. `Close` is the only TaskPanel button pair (`1696–1697`); there is no "open drawing → jump to model element" affordance.
- **P26 implication:** this gap is precisely what P26's view-independent selection identity (`O-7K3M` everywhere + "outside depth → Reveal") must fill. FreeCAD shows a derived view without identity threading is documentation-only; P26 wants an editing instrument, so identity round-trip is a requirement, not a nicety.

## 10. Vertical-form implications

- **Observed:** Wall height is a single scalar (`Height`, `ArchWall.py:173–233`); there are no stepped/sloped wall tops in the Wall object — variable height requires split walls or ArchSketch segment widths. Window vertical position is `Placement`, not a `Sill` property. Roof slope lives in per-edge angle/run lists consumed at Roof-build time. The Section intersects whatever solids result, with no slope/step awareness.
- **Inferred:** editing wall height "through" a FreeCAD section means selecting the wall (in 3D or tree) and editing its `Height` property — the section is a *viewer* of the edit, never an *authoring surface*. Nothing in the section pipeline constrains, snaps, or validates vertical edits.
- **P26 implication:** FreeCAD contributes nothing to vertical *authoring* — its value is proving vertical *derivation* needs no vertical vocabulary in the section itself. P26's Wall-top profiles, sill/head handles, and ceiling elevation/ridge handles are new authoring surface with no FreeCAD counterpart; they are justified by the gap, not by precedent. The one portable pattern is Roof's: slope authored once on the object (edge angles / shed direction+elevations / gable ridge+eaves), consumed generically downstream.

## 11. Tests and important edge cases

Test file `bimtests/TestArchSectionPlane.py:1–190` (full read; 7 tests):

| Test | Setup | Assertion | Invariant / edge revealed |
|---|---|---|---|
| `test_makeSectionPlane` (`43–54`) | factory, no objects | non-None, label kept | factory contract only |
| `FitUsesLocalAxesAfterRotateY` (`56–65`) | 1000×2000×3000 box, plane Rot(Y,90°) | fit ≈ (3300, 2300) | fit follows rotated axes; height maps to local X; 10% margin on XLength |
| `FitCombinesMultipleObjects` (`67–78`) | two boxes, 2nd offset (2000,500,−100) | fit ≈ (3300, 2800) | union of bounds, not first object |
| `FitUsesLocalAxesAfterRotateZ` (`80–89`) | plane Rot(Z,90°) | fit ≈ (2200, 1200) | in-plane rotation swaps footprint without axis bug |
| `CenterRecentersLocalBounds` (`91–103`) | off-center placement | recentered local bbox center ≈ origin | recenter truly centers scope |
| `testTechDrawViewGeneration` (`105–160`) | wire→wall + hosted Fixed window + HEA100 column in Floor; section + 2DDrawing + 2 Shape2DViews + full TechDraw page | **bare `assert True`** | end-to-end smoke only — proves "does not crash," asserts nothing about pixels/geometry; hosted-window + structure-in-floor coverage is real but unverified |
| `testShape2DViewGeneration` (`162–190`) | CW closed wire (`MakeFace=False`) → wall 3000×200; section + `InPlace=False` `Cutfaces` view | `Faces[0].isValid()`; `Area == 1200*2200 − 800*1800` | regression: CW winding once produced invalid faces; hole-subtraction area exact (window/void math pinned at the Shape2DView level) |

- **Observed absences (no tests for):** `Depth`/far-clip behavior, `Clip=True` output, empty scope, non-solid input, multiple-material join, orientation/output-direction correctness, hidden-geometry output, failed-cut fallbacks, regeneration after source edit, serialization round-trip, `OnlySolids=False` path. Fit/center are the only well-tested units.
- **P26 implication:** copy the fit/center test pattern (rotation-parameterized bbox expectations are cheap and caught real bugs); do not treat FreeCAD's suite as a drawing-correctness contract. P26's derivation needs the tests FreeCAD lacks: depth-inclusion/exclusion, cut-only, empty scope, per-source identity survival, and regeneration determinism.

## 12. What transfers well to Museum Editor

1. **Instrument-over-canonical-model object split.** Persist (or hold transiently) only placement/scope/flags; derive plane, booleans, and drawing every time. (§3)
2. **One orthographic pipeline for Section + Wall Elevation (+ Plan/RCP by orientation).** No per-form geometry code; orientation + scope + depth parameterize a single derivation. Wall Elevation = wall-face-constrained section with shallow depth. (§3.4)
3. **Typed derivation streams: cut / projected / hidden (+ annotations/spaces/symbols).** Split in data at derivation time; style per stream at render time. This is the core of the proposed `OrthographicRenderModel`. (§5)
4. **Kind-agnostic section core over baked solids.** Resolve hosting/subtraction once at compile time; sections intersect solids generically. One narrow exception: 2D-only symbol overlays (opening swing) that have no solid representation. (§8)
5. **Boolean-volume depth model.** Lateral crop and far depth as volumes fused into kept/behind sides; zero = unlimited; cut-only = minimal far depth / kept-stream suppression. Make depth a derivation parameter, not an ignorable property. (§6)
6. **Fit/recenter as pure functions of (scope, placement).** Inverse-transform bboxes to plane-local, union, margin, recenter — directly portable, including the rotation-parameterized tests. (Margin should use per-axis or max-dimension basis, not X-only.) (§3.3, §11)
7. **View→source one-way derivation.** Derived drawing is never authoritative; edits flow only through canonical intents back to `LayoutDocument`. FreeCAD's persisted-`Symbol` + recompute-on-touch is a workable cache-invalidation sketch. (§4.2, §9)
8. **Per-source fill identity.** Tagging fills/annotations with source ids (`id="Wall_f0003"` pattern) is proven sufficient for poche/selection/highlight on those streams — extend to all streams. (§7)

## 13. What should NOT transfer

1. **The half-wired `Depth` property.** A persisted depth that the flagship output path ignores is worse than no depth — it teaches users the control is broken. Depth must be a required derivation parameter with a finite default. (§6)
2. **Flatten-then-project.** Compounding all sources before projection destroys identity and distance in one step and forces the no-cueing, no-selection drawing FreeCAD has. Project per source; tag every primitive. (§7, §5)
3. **OCC/HLR machinery and its workarounds.** `multiFuse`/`removeSplitter`, negative-volume reversal, `+100` oversize subtraction prisms, `1.1112` fallback depths, and the software painter's `sort()` with `MAXLOOP=10` are OpenCascade-costume solutions. A Three.js extruded-wall model needs none of them; per-source clipping against an orthographic frustum + polygon sectioning is the native equivalent.
4. **Direction-as-quaternion with rotate-button UX.** No Flip property, 90° rotate buttons, and raw `Placement` editing are CAD-idiomatic friction. P26's `tangent/lookSide` + arrow-flip + drag handles are the correct instrument UX; nothing is lost by diverging. (§9.2)
5. **Persisted drawing objects as the editing loop.** `DrawViewArch.Symbol` baking, page-gated `KeepUpToDate`, manual link-following back to the model, and whole-symbol selection are document-production mechanics. A transient instrument that derives on scope/placement change and disposes on close avoids the entire layer. (§9)
6. **Three render modes.** Wireframe (HLR) vs. Solid (painter) vs. Coin (screenshot) exist because no single FreeCAD renderer does cut+project+hide well. One typed derivation feeding one Three.js renderer covers all three with less code.
7. **GPL-adjacent code reuse.** Beyond licensing, FreeCAD's Python geometry code assumes OCC topology (`Solids`, `common`, `removeSplitter`) that has no counterpart in Museum Editor's compiler — port the contracts and the tests, never the implementation.
8. **Property-panel-first section editing.** FreeCAD proves the operation set; its interaction style (no handles, no drag creation, no in-drawing dimension handles) is exactly the Inspector-heavy failure mode P26 Phase-1 rejects.

## 14. P26 hypothesis assessment

1. **Section can remain a view/instrument over canonical architecture rather than duplicated architecture.** — **SUPPORTED.** Observed: `SectionPlane` owns zero architecture (`Objects` links only); `Shape` is a derived plane; booleans/SVG are transient; `ArchCutPlane` (the one tool that *does* duplicate/mutate geometry) is a deliberately separate object. The one nuance: FreeCAD persists the instrument definition, while P26 proposes transient-first — a compatible refinement, not a contradiction.
2. **Cut and projected geometry can derive from one canonical model while retaining useful source identity.** — **PARTIALLY SUPPORTED.** Observed: one model feeds all streams through one boolean stage, and per-source grouping (`objectShapes`/`objectSshapes`) plus fill-path ids prove identity *can* survive. Contradicted in part: the main outline streams flatten identity at `makeCompound` → HLR, so "useful source identity" holds for fills/annotations only, not for the geometry users most need to select. The transferable idea is the derivation staging; the identity threading must be completed, not copied.
3. **Finite-depth Section is a practical way to control multi-room clutter.** — **SUPPORTED (with implementation warning).** Observed: far-depth is implemented and correct at the OCC-helper level (`getCutVolume` depth branch) and honored by `Shape2DView`; lateral crop composes with it. Warning: the TechDraw path's silent depth-drop proves depth must be contractual, and the absence of depth cueing / no depth tests shows clutter *control* (exclusion) is proven while clutter *gradation* (fading) is not.
4. **A shared orthographic projection pipeline could plausibly support both Section and Wall Elevation.** — **SUPPORTED.** Observed: one class, one `getSectionData`/`getCutShapes`/`getSVG` chain, zero form enums, orientation-only differentiation, plus `BuildingPart`-as-source polymorphism. Wall Elevation has no dedicated code because it needs none — it is a constrained section. This is the strongest single precedent in the harvest.
5. **Derived drawing geometry should remain non-authoritative.** — **SUPPORTED.** Observed: one-way links (view→section→sources), baked outputs regenerated on recompute, no drawing-to-model write path of any kind, annotations as separate objects. FreeCAD never even attempts the reverse direction, which is evidence the split is natural rather than enforced.
6. **Sloped/overhead architecture can remain canonical 3D form while Section consumes it generically.** — **SUPPORTED.** Observed: Roof builds sloped-slab solids with per-edge angles; the section core has no slope branch and sections them correctly by construction; Wall height and Window placement are consumed as baked-solid consequences. No counter-evidence found.
7. **Section functionality does not inherently require full BIM/storey/sheet machinery.** — **SUPPORTED.** Observed: the cut pipeline touches only `Shape`/`Placement`/`Material` and works on `Part::Box` test objects as readily as on Walls; the 4-line fit tests use raw boxes. Storeys (`BuildingPart`/`Floor`), pages, templates, and IFC appear only as *scope containers* (`Group`), *output paginators* (DrawPage), or *round-trip metadata* — never as geometric prerequisites. The smoke test's Floor is incidental scope, not machinery.

## 15. Impact on P26 research

### Supported

- Transient-instrument posture (H1) with one refinement: persist the instrument definition at most (placement/scope/flags), never its output — FreeCAD already separates these.
- Typed `cut / projected / hidden` derivation streams as the `OrthographicRenderModel` core (§5).
- One shared Section/Elevation pipeline parameterized by orientation + scope + depth (§3.4, H4 verdict).
- Generic consumption of sloped/overhead form; no per-kind section code beyond a 2D-symbol overlay hook (§8, H6 verdict).
- Non-authoritative derived drawing with one-way derivation (§9, H5 verdict).
- Default-finite depth as clutter control, implemented as derivation parameter (§6, H3 verdict).

### Refined

- **Depth contract:** Phase-1 proposed `depth` as instrument state; FreeCAD's failure refines this to *depth as a required derivation-function parameter with finite default*, so no consumer can silently ignore it. Add a depth-inclusion test matrix (inside / beyond / cut-only / zero-unlimited) that FreeCAD lacks.
- **Identity scope:** Phase-1's "no section-local proxy IDs" + view-independent selection is directionally right but under-specified — FreeCAD shows identity must be threaded through *projection*, not just preserved at derivation. Specify per-primitive `{sourceId, stream, subRef}` on every stream including outlines, and a "derived primitive → canonical intent" resolver for handles.
- **Wall Elevation definition:** Phase-1's `wallId + side + extent + crop + shallow background` is confirmed implementable as a constrained section, but add FreeCAD's missing piece: the constraint (wall-face plane + depth) should itself be derived from the wall each rebuild so wall moves carry the elevation along.
- **Fit margin:** adopt the pure-function fit/recenter but fix the X-only margin (per-axis or max-dimension basis) and pin with FreeCAD-style rotation tests.

### Contradicted

- **Nothing structural.** No Phase-1 thesis was contradicted. Two *candidate details* were weakened: (a) `CutMargin`-style epsilon offsets as user-visible state — FreeCAD shows they are renderer tolerances, not instrument semantics, and should stay hidden; (b) any assumption that fills/poche need a pattern engine for P26 — flat fills per source are proven sufficient for legibility.
- **"Cheap per-source derived primitives" pivot (H1 contract):** confirmed cheap at Museum Editor's scale, but FreeCAD shows per-*face* OCC derivation is the expensive part being cached — the pivot should read "per-*source* derivation is cheap; cache at source granularity," which aligns with the compiler cache better than the original wording.

### New questions

1. Where should vertical crop live — instrument property (P26 sketch) or output pagination (FreeCAD's de facto answer)? FreeCAD's absence of a crop property with no apparent pain suggests crop may belong to the view session, not the derivation contract. Design-phase question.
2. Should the elevation/section constraint auto-follow its wall (derived plane) or freeze at creation (FreeCAD's frozen `Placement`)? Follow-behavior has no FreeCAD precedent; it is new interaction design.
3. What is the minimal per-primitive identity for openings — host wall + opening id, or opening id alone? FreeCAD's window-symbol overlay keys off the window object; Museum Editor's hosted-opening intents may need both.
4. Cut-only mode: far-depth ≈ 0, or a distinct derivation skipping the kept stream? FreeCAD implements neither in the section UI (only Archicad/Rhino precedent from Phase-1); performance and snapping semantics differ between the two.
5. Do spaces/rooms need a filled-label stream in Section (FreeCAD renders Space fills+labels in plane), or stay passive? Affects whether `Room` enters the derivation scope or remains a Plan-side query.

## 16. Museum implementation reconciliation required

Likely reconciliation areas only — no Museum code was audited:

1. **Derivation-cache keying:** compiler cache likely keys on document version; orthographic derivation needs `(instrumentHash, per-source versions)` sub-keying so style/crop changes skip re-derivation (mirror of `shapecache` vs `svgcache`).
2. **`wall.topMode` / fit-to-overhead vs. baked-solid assumption:** FreeCAD bakes everything to solids before sectioning; if Museum Editor keeps parametric tops live in the compiler, decide whether the section consumes compiled solids (simpler, precedented) or parametric form (richer snapping) — the choice determines where profile handles resolve.
3. **Opening representation:** if openings remain hosted-param (not pre-subtracted solids), the derivation must perform host-minus-opening at derive time or the compiler must expose pre-cut wall solids as FreeCAD's `processSubShapes` does. Either is compatible; mixing both double-subtracts.
4. **Depth parameter plumbing:** ensure the single derivation entry point takes depth (finite default) so no consumer can repeat the TechDraw omission; audit Plan/3D/visitor paths that they never read section depth (separation) vs. the ortho renderer that must.
5. **Selection-identity table:** derived primitives need `{sourceId, stream}` at minimum; confirm the existing selection model can address non-Plan primitives without proxy-id proliferation (Phase-1 already constrains this — FreeCAD's whole-symbol selection is the anti-pattern to avoid).
6. **Datum-safe numerics:** FreeCAD stores everything in absolute millimetres with implicit world zero; P26's reserved datum semantics (`baseElevation`, relative sills) must survive the plane-local projection without collapsing to world-Y assumptions.

## 17. Recommended follow-up questions

1. H2 (Bonsai) identity round-trip: how does Blender-side raycast map a click on derived drawing/decorator geometry back to the IFC entity, and does that mechanism outperform FreeCAD's manual link-following enough to copy?
2. H2 RCP: is reflected-ceiling projection genuinely "same pipeline, flipped direction" as FreeCAD's orientation-agnosticism implies, or does Bonsai carry RCP-specific visibility logic worth borrowing for Ceiling Focus?
3. H3 (Homemaker) spanning shells: does a traces+hulls model handle the "one ceiling spans N rooms / N regions in one room" cases without the per-room culling FreeCAD's Space path needs?
4. H4 (SH3D) endpoint heights: is two-elevation-per-wall sufficient as the first Wall-top profile, given FreeCAD shows even single-height walls section fine and multi-height is rare in the wild?
5. What far-depth default (meters/rooms) keeps a museum section readable — FreeCAD offers no default (1000-unit plane, unlimited depth) and no data; this needs a product decision with mockups, not more precedent.
6. Should hidden/behind-plane geometry exist in P26 Section v1 at all (FreeCAD gates it behind `ShowHidden`, default off)? Default-off hidden + cut + near-projected may be the correct first slice.

## Appendix — source map

| Path | Symbol / region | Purpose (one line) |
|---|---|---|
| `src/Mod/BIM/ArchSectionPlane.py:68–109` | `getSectionPlaneLocalBoundBox` / `getSectionPlaneFit` / `getSectionPlaneCenter` | Pure fit/recenter math; tested |
| `src/Mod/BIM/ArchSectionPlane.py:112–139` | `getSectionData` | Normalizes SectionPlane\|BuildingPart → `(objs, cutplane, onlySolids, clip, direction)`; **no depth slot** |
| `src/Mod/BIM/ArchSectionPlane.py:142–265` | `getCutShapes` | Boolean core; three-stream split; per-object grouping; calls `getCutVolume` **without depth** (`:207`) |
| `src/Mod/BIM/ArchSectionPlane.py:268–295` | `getFillForObject` | Cut-fill color resolution (SectionColor → Color → first layer → default) |
| `src/Mod/BIM/ArchSectionPlane.py:298–313` | `isOriented` | Annotation-facing test |
| `src/Mod/BIM/ArchSectionPlane.py:316–343` | `update_svg_cache` | 7-field SVG key; shape-cache invalidation |
| `src/Mod/BIM/ArchSectionPlane.py:346–730` | `getSVG` | Three render modes + assembly (drafts/spaces/window symbols) |
| `src/Mod/BIM/ArchSectionPlane.py:1025–1156` | `_SectionPlane` | Data proxy; Properties; `execute()` plane rebuild; cache wipe |
| `src/Mod/BIM/ArchSectionPlane.py:1159–1607` | `_ViewProviderSectionPlane` | Coin glyph; Display*/Cut* props; `SoClipPlane` CutView; context menu |
| `src/Mod/BIM/ArchSectionPlane.py:1609–1796` | `SectionPlaneTaskPanel` | Fit/recenter/rotate/scope UI; no handles |
| `src/Mod/BIM/bimtests/TestArchSectionPlane.py:43–190` | 7 tests | Fit×3, center, factory, TD smoke (`assert True`), CW-wire regression |
| `src/Mod/TechDraw/App/DrawViewArch.cpp:44–68` | `RenderModeEnums` + props | View property bag (Source/AllOn/RenderMode/FillSpaces/ShowHidden/ShowFill/JoinArch/…) |
| `src/Mod/TechDraw/App/DrawViewArch.cpp:71–139` | `mustExecute` / `execute` | Touch-gated Python bridge; bakes `Symbol`; page-`keepUpdated` gate |
| `src/Mod/BIM/ArchCommands.py:495–578` | `getCutVolume` | Cut-volume builder: oversized face extrusion + depth branch (`563–567`) + clip branch (`568–574`) |
| `src/Mod/BIM/ArchVRM.py:55–325` | `Renderer` / `cut` | Software painter renderer; three-list cut/projected/hidden split |
| `src/Mod/BIM/ArchVRM.py:371–638` | `compare` / `sort` | Painter ordering (`MAXLOOP=10`); do not port |
| `src/Mod/BIM/ArchVRM.py:687–763` | `getViewSVG` / `getSectionSVG` / `getHiddenSVG` | Anonymous-group SVG emitters (identity loss point) |
| `src/Mod/Draft/draftobjects/shape2dview.py:299–308` | clip/depth read | **Only caller that honors `Depth`**; `Shape2DView` cut path |
| `src/Mod/Draft/draftfunctions/svgshapes.py:359–362` | `id=` emission | Source-identity survival on fill/annotation paths |
| `src/Mod/Draft/draftfunctions/svg.py:1105/1120/1147` | `pathname=` call sites | Per-face/per-wire id construction |
| `src/Mod/BIM/ArchComponent.py:869–1025` | `processSubShapes` | Host-side opening subtraction (hosting auto-enrollment) |
| `src/Mod/BIM/ArchWindow.py:742–876` | `getSubVolume` | Double-depth hole prism; host-width + 100 logic |
| `src/Mod/BIM/ArchRoof.py:650–827` | `_Roof.execute` / `createProfilShape` | Sloped-slab solids; fused output; in-memory `self.sub` |
| `src/Mod/BIM/ArchWall.py:504–632` | `_Wall.execute` | Extrude → subtract (`631`) → solid/compound output |
| `src/Mod/BIM/bimcommands/BimSectionPlane.py:36–75` | `Arch_SectionPlane` | Selection-wrapping creation, no picking |
| `src/Mod/BIM/bimcommands/BimTDView.py:57–105` | `BIM_TDView` | Section→DrawPage binding |
| `src/Mod/BIM/bimcommands/BimDrawingView.py:57–91` | `BIM_DrawingView` | Annotation-part container + Solid/Cutfaces Shape2DViews |
| `src/Mod/BIM/ArchCutPlane.py:117–168` | `cutComponentwithPlane` | One-shot mutating boolean; the deliberate NOT-section |
| `src/Mod/BIM/Arch.py:1216–1256` | `makeSectionPlane` | Factory; working-plane placement; bbox+10% sizing |
| `src/Mod/BIM/Arch.py:243–282` | `make2DDrawing` | Annotation BuildingPart container |
| `src/Mod/BIM/nativeifc/ifc_tools.py:783–787`, `ifc_objects.py:257–275`, `ifc_export.py:316–332` | Depth round-trip | IFC persists `Depth` the drawing path ignores |

*Evidence standard: section/finding-level claims cite `path:line` above; "Observed" = direct read or verified grep; "Inferred" = flagged reasoning from that evidence; "P26 implication" = transfer judgment, not a FreeCAD claim.*
