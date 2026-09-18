# P24 3D Editing — Compact Reference Artifact

> Source: `docs/roadmap/p24-scene-staging/research/deep-research-P24-3D-editing.md` (202 lines). Compression/normalization, not summary. Covers deliverables A–S: P24B minimum 3D scene operations, follow-ups, operation spec, architecture, comparisons, tests, spikes, decision. All tools, matrix dimensions, features, ops, tests, and caveats preserved in dense form. No new research; uncertainty preserved (incl. conflicting snap increments as written); no citations invented.
> Thesis: P24B = core 3D scene operations (select, transform, pivot, duplicate, replace, align, group, floor-snap, snapping, outliner, visibility, drag/drop, inspector, shortcuts, single coalesced undo) on one unified TransformControls pipeline + PBR/HDRI environment, with LayoutDocument/SceneDocument split and no persisted Three objects. Advanced modeling, VR, collaboration, animation, physics deferred.

## 1. Tool / Repo Shortlist

- Three.js Editor (official, three.js examples) | MIT, active | scene graph panel, translate/rotate/scale gizmos, mesh/material editors. Code-centric low-level lib.
- BabylonJS Editor (`BabylonJS/Editor`) | Apache-2.0, community, medium activity | visual scenes/materials/animations, Node Material Editor + Inspector, strong lighting.
- Godot Engine | MIT, active | full engine + 3D editor, scene-tree/node system, PBR + omnidirectional lights/GI, selection/gizmos/duplicate/align.
- Blender | GPL, industry standard | modeling/editing/animation, viewport lighting, PBR shader, HDRI, outliner, pivot modes, snapping, grouping, layers, duplication. Modifier-based, complex.
- PlayCanvas | editor proprietary cloud, engine MIT | scene graph, gizmos, real-time preview, PBR, env maps/skybox, shadows, collaborative editing.
- Blockbench | GPL | low-poly/blocky focus; pivot local/world, groups, layers, duplication, bone editing; v3.9.0 added grouping + local-space rotation.
- nunuStudio (`tentone/nunuStudio`) | MIT, low/med activity | web 3D/VR engine editor, asset browser, transform controls, multi-window. Older, smaller community.
- Pascal Editor | open source, R3F/WebGPU, new (2023), license "(likely MIT)" as written | architectural walls/floors, smart snapping, procedural geometry (corners auto-cut), undo history 50 steps, built-in assets.
- A-Frame Inspector | MIT (Mozilla), open | entity select + attribute view. Limited editing, not full editor.
- Spline | closed | comparison/USability reference only, no code.
- Blockbuilder/Primrose (Patches/Vizor, Ottifox) | mixed open demos | WebXR/AR interaction examples, partially unmaintained.
- React Three Fiber examples (`react-three-x` et al.) | MIT | JSX scene + hooks code patterns, not editor UI.
- Threlte/Tres examples | open | Svelte + three.js components, code patterns.
- three.quarks | open | three.js particle system reference.
- Immersa/Norman (Experiments with Google, `norman` repo) | open, React/three | frame-by-frame 3D animation editor example.
- Wonderland Engine / Wonderbricks | engine MIT, community | WebXR engine + editor UI + bricks system.
- Others (O3DE, Torque3D) | open | heavy full engines, completeness mention only.
- License/maintenance rollup: most MIT/Apache (three.js, Babylon, Godot, PlayCanvas engine, Pascal); Blockbench GPL; actively maintained except older WebVR tools. "Last commit: thousands" for BabylonJS Editor preserved as written (vague in source).

## 2. Capability Matrix

Cols: `Tool | License | Maint | Platform | 2D/3D | PBR | IBL/HDRI | Instancing | VR | Remark`. Judgments are author's, not vendor claims.

- Three.js Editor | MIT | High | Web | 3D | Yes | Yes | Yes | Limited | code-centric JS/TS low-level
- BabylonJS Editor | Apache-2.0 | Medium | Web/Desktop | 3D | Yes | Yes | Yes | Yes | visual + NME strong lighting
- Godot | MIT | High | Desktop | 3D/2D | Yes | Yes | Yes | Yes | full engine, scriptable scene tree
- Blender | GPL | High | Desktop | 3D | Yes | Yes | Yes | Yes | standard, huge modifier-based set
- PlayCanvas Editor | Commercial* | High | Web | 3D | Yes | Yes | Yes | Yes | cloud real-time; *engine open MIT
- Blockbench | GPL | Medium | Desktop/Web | 3D | Yes | No (baked) | Yes | No | blocky, groups, local/world pivot
- nunuStudio | MIT | Low/Med | Web | 3D | Yes | Yes | Yes | Yes | VR/AR, older
- Pascal Editor | (likely MIT) | New (2023) | Web | 3D | Yes | Yes | Yes | (none) | architecture walls/floors, built-in assets
- A-Frame Inspector | MIT | Medium | Web | 3D/VR | Yes | No | No | Yes | inspector, not full editor
- R3F + editor | MIT | High | Web | 3D | Yes | Yes | Yes | Limited | code-based JSX + hooks
- Wonderland | MIT | Medium | Web | 3D | Yes | Yes | Yes | Yes | VR-focused scene editor
- Others (Spline, MagicaVox) | N/A | Closed | Web/Desktop | 3D | Yes | Yes | No | No | context only

## 3. P24B Minimum Features (17, must-build before launch)

- Selection: single + multi (click/drag/box; Ctrl+click).
- Pivot modes: world-center vs object-center; local/world axis alignment.
- Gizmos: translate (arrows) / rotate (rings) / scale (boxes); grid + vertex snap options.
- Duplicate: in-place copy (Ctrl+D); group-duplicate on multi-select. (Blockbench: duplicates inserted as block.)
- Replace: swap placeholder with another asset, retains transform.
- Align/distribute: min/center/max align + equal spacing along axes.
- Floor/surface placement: new objects auto-place on floor/nearest surface + ghost preview under cursor.
- Snapping: grid, surface/vertex, angle (90° steps as written in §D; cf. 15° in §F, 45° in §J — preserved as written, not reconciled).
- Grouping: group/ungroup into hierarchy.
- Outliner: tree of objects/rooms, drag-drop reparent.
- Visibility/lock: hide/lock toggles; locked = not selectable/transformable.
- Cross-room transforms: move objects across rooms/coordinate origins.
- Drag & drop assets: library → scene with ghost preview.
- Inspector: position/rotation/scale/material/metadata edit.
- Shortcuts: W/E/R transform, DEL delete, Ctrl+D duplicate, etc.
- Preview vs commit: preview-then-confirm for some ops (e.g. floor layout).
- Undo/redo: single chronological stack; coalesce continuous drags to one step.

## 4. Follow-Up / Long-Term (8, deferred post-stable-P24B)

Advanced modeling (custom mesh, CSG/booleans, parametrics) | terrain/environment generation (likely unneeded indoors) | VR/AR controllers | collaborative editing (complex sync) | import/export extensions (OBJ/FBX, parametric assets) | enhanced snapping (angle, symmetry) | rich node-based material editor (PBR layering, texture painting) | animation tools (beyond simple transitions).

## 5. Scene Operation Spec (21)

- Select: click/box, highlight + gizmo, single/multi (Ctrl+click). | Multi-select: Shift/Ctrl, bounding box, transform applies to all.
- Pivot: local vs world toggle + control. | Translate: arrow gizmo/drag, grid-size control. | Rotate: ring gizmo/drag, 15° snap (as written), local/world modes. | Scale: corner boxes, uniform/axis-wise, increment snap.
- Duplicate: Ctrl+D/menu, copy at same pos, group if multi. | Replace: asset swap, retains transform. | Align/distribute: axis min/center/max + equal spacing, shortcuts/panel.
- Floor placement: drop/move aligns bottom to ground/nearest surface. | Ghost: semi-transparent drag preview.
- Snapping: grid move/rotate; vertex/edge on key-hold; settings panel. | Grouping: group node, ungroup restores. | Outliner: click-select, drag reorder/hierarchy. | Visibility/lock: eye/lock icons, grayed state.
- Cross-room move: change parent room or scene-relative move. | Drag/drop: library drag → ghost → click commit. | Inspector: side panel, instant-update edits. | Shortcuts: W/E/R, DEL, Ctrl+Z, Esc deselect, Space select-mode, etc. | Preview/commit: batched edits (e.g. multi-rename) preview + confirm. | Undo coalesce: continuous drag = one step, single stack.

## 6. Architecture

- One unified TransformControls pipeline (Three.js/Threlte); no parallel code paths. One selection store, one active gizmo.
- Coords: X-Z horizontal, Y up; yaw about Y; objects anchored to room XZ. Room-local transforms composed to world.
- Models: `LayoutDocument` (floorplan) vs `SceneDocument` (objects) separate; P24A must not depend on P24B code.
- State: pure data model, Svelte-reactive; re-create scene on render; no persisted Three/Threlte objects in state.
- Materials: PBR (`MeshStandardMaterial/Physical`); albedo/metalness/roughness/normal/emissive/AO maps; presets + per-object overrides; possible multi-slots.
- Lighting/environment: directional/point/spot + ambient (hemisphere/environment); HDR/EXR env maps → PMREM `scene.environment`, optionally `scene.background` tone-mapped; shadow maps (res, near/far, PCF soft, disable option); exposure + ACES/linear tone mapping.
- Performance rails: polycount caps + instancing (e.g. chairs); no real-time GI (baked/probes); light limits; frustum culling; static-mesh merge for mobile draw calls.
- Data-model pressure: thousands of small objects → pooling/LOD; undo = shallow diffs (group/ungroup restructures graph — immutable updates/diff tracking); texture count → reuse/atlas; 4K HDR → limit/compress; data→Three conversion cost on each change in large scenes.

## 7. Plan Parity Checklist (9)

P24A floorplan vs P24B 3D ops complementary, no overlap/gaps | distinct Layout/Scene models, no P24A→P24B dependency | one undo stack | room-local transforms (test room-offset move) | one gizmo control set | centralized selection incl. cross-room | scene recreated from data, no object reuse bugs | Svelte 5 store/reactivity conventions | XZ-yaw placement, horizontal ground plane.

## 8. Tests

Visual/acceptance (12): UI smoke (canvas + grid floor) | add object (ghost → drop, floor/wall aligned) | select + move (gizmo, grid snap, Ctrl+Z) | rotate + scale (handles; 45° snap as written) | local vs world pivot difference | duplicate Ctrl+D (second selected; undo) | group/ungroup round-trip | align X-min + 3-object distribute | outliner hide/lock behavior | material reassignment preview | HDR toggle + directional/shadow change | multi-step undo/redo consistency.
Performance (6): hundreds of small objects → 30–60 FPS desktop | 100k-tri mesh degrades gracefully (~30 FPS) | shadows off with 5+ lights/100 objects improves FPS | 50 transforms + full undo without unbounded memory (diffs) | 4K HDR memory, auto-downsample suggestion | 5-min idle, no leaks.

## 9. Do-Not-Build (7)

Full CAD/CAM parametrics (bevels/NURBS/booleans) | pathfinding/simulation | mesh/texture painting | keyframe animation editor | full rigid-body/cloth physics | live video textures / deep post-processing | SVG/2D tools for this Stage.

## 10. Spikes (5)

- S1 HDRI + skybox: equirect HDR via `THREE.RGBELoader/HDRCubeTextureLoader` → environment + background, PMREM (dispose old), reflections update. Outcome: technique confirmed.
- S2 TransformControls pipeline: single instance, local/world modes, translate/rotate/scale, selection hook, undo captures matrix changes. Outcome: unified tool works.
- S3 Floor-snap + ghost: semi-transparent drag mesh follows pointer; raycast to floor/nearest mesh below, flush placement; fallback ground level. Outcome: intuitive placement.
- S4 Material presets + editor: default color/metal/rough presets; Inspector preset + map (diffuse/metalness/roughness) adjust on `MeshStandardMaterial` under lights. Outcome: baseline editing works.
- S5 Grouping + outliner sync: empty Group node, reparent selection, outliner reflects, group-move carries children. Outcome: group/ungroup cycle works.

## 11. Decision

P24B minimum (§3) confirmed must-build with polished UX. Dependencies: TransformControls (Three/Threlte), reactive scene-graph store, HDR loader (`RGBELoader`), material preset resources. Flows: drag → ghost → drop commit (Spike S3); right-click context menu (delete/duplicate/group); each flow covered by §8 tests. Gate: all visual tests pass; performance baselines met without critical slowdowns. Follow-ups (§4) deferred until stable P24B. Serves designer + developer personas.

## 12. Reference Annex (no URLs in source; names preserved, not invented)

Three.js docs (materials/lighting, PMREM, `MeshStandardMaterial`) | Playtex guides (PBR/HDRI workflow — name as written) | Needle Cloud comparison (Babylon vs three.js PBR/IBL) | Blockbench changelog (group, local rotation) | Pascal Editor overview | BabylonJS Editor repo (inspector, NME) | Godot docs (nodes, scene system, 3D editor) | Blender Manual (outliner, transforms, shading) | R3F/Threlte examples (React/Svelte patterns).

## 13. Research Inventory / Loss Audit

- Projects/tools: Three.js Editor, BabylonJS Editor, Godot, Blender, PlayCanvas, Blockbench, nunuStudio, Pascal Editor, A-Frame Inspector, Spline, Blockbuilder/Primrose (Patches/Vizor, Ottifox), R3F + react-three-x, Threlte/Tres, three.quarks, Immersa/Norman, Wonderland Engine/Wonderbricks, O3DE, Torque3D, MagicaVox, `TransformControls`, `RGBELoader/HDRCubeTextureLoader`, PMREM, `MeshStandardMaterial/Physical`.
- Quantitative: v3.9.0 Blockbench; 50-step Pascal undo; snap increments 90° (§D) / 15° (§F) / 45° (§J) as written; 100k-tri mesh; 30–60 FPS; 5+ lights/100 objects; 50 transforms; 4K HDR; 5-min idle.
- Unresolved/uncertain: Pascal license "(likely MIT)"; BabylonJS "Last commit: thousands" (vague as written); snap-increment discrepancies unreconciled; R3F/Tres examples are patterns not editors.
- Matrix mapping: capability 12×10 → §2; P24B 17 → §3; follow-up 8 → §4; op spec 21 → §5; arch/pressure → §6; parity 9 → §7; visual 12 + perf 6 → §8; do-not-build 7 → §9; spikes 5 → §10; annex 9 → §12.
- Loss audit: section-by-section A–S diff passes; every tool/feature/op/test/spike/decision retained row×column and member-level; enumerations never umbrella-collapsed; descriptive cells kept (baked HDRI, cloud-proprietary note, modifier-based complexity); no row merged unless identical; citations: source contained zero URLs and zero opaque handles — 9 annex names preserved without inventing links, no NON-PORTABLE flag applicable. Field-level audit passes; wording compressed, not verbatim.
