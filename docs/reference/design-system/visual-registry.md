# Museum Editor visual reference registry

**Status:** landed-era visual registry — P21+ primary visual set promoted 2026-09-04; pruned 2026-10-11 (PR #113 asset consolidation).\
**Destination design:** this registry describes the landed editor's P21-era imagery only. Destination shell and
World | Experience design live in [PLATE](./editor-shell-and-visual-system.md) and its routed design evidence;
nothing here competes with them. Images removed in the 2026-10-11 pruning (legacy Camera sequence/sidebar/timeline
mockups, unreferenced timeline drafts, top-level `collapsed`/`expanded-new` drafts, superseded Scene states and the
Future Experience concept) remain recoverable from Git history.\
**Authority:** source/tests → architecture + shell/workspace behavior specs → `docs/reference/design-system/design-plan-p21.md` for P21+ shell/IA → `docs/reference/design-system/design-specs.md` for visual language/tokens → `docs/reference/design-system/p21-visual-implementation-references.md` + the visual references registered here for concrete P21 composition.

The P21+ images now define the **primary visual composition and chrome direction** for the editor. Older Scene/Camera images are retained as specialized state/interaction references; they no longer govern shell placement, toolbar placement, persistence chrome, current terminology, or general P21+ visual composition.

The normative visual implementation companion is [`docs/reference/design-system/p21-visual-implementation-references.md`](p21-visual-implementation-references.md). P21 is not complete by merely moving existing controls into the two-row shell; the core Spatial workspaces and Visitor Preview must also be visually reconciled to the registered P21 compositions.

## Authority rules

1. **Behavior beats pixels.** If any PNG disagrees with source/tests or a governing behavior spec, the behavior spec wins. Generated-image artifacts do not redefine the product model.
2. **P21 visuals beat legacy shell chrome.** If a legacy image disagrees with `docs/reference/design-system/gallery/P21/*` on Row 1 / Row 2 composition, dimensions, panel framing, active-state styling, toolbar placement, persistence presentation, or current `Layout | Arrange` terminology, the P21 image wins.
3. **Legacy images remain useful for named states.** A legacy image may still govern the specific interaction/state named below when no newer P21 visual replaces that state. Its old shell/chrome is non-authoritative.
4. **Future visuals are directional, not feature contracts.** `docs/reference/design-system/gallery/Future/*` is canonical visual direction for future project surfaces, but internal Experience/Assets/Publish/Hub capabilities remain illustrative unless separately ratified.
5. **Minor generated-image inconsistencies are non-authoritative.** Examples include orientation-widget details, incidental graph/sidebar omissions, placeholder metadata, or decorative controls. Exact behavior continues to come from source/tests and the governing specs.

## P21 primary visual references

These images are the primary implementation-facing compositions for the P21 editor shell, core Spatial workspaces, and Visitor Preview.

| File | Surface/state | Visual authority | Governing behavior |
|---|---|---|---|
| `P21/scene-plan-layout.png` | Scene → Plan → Layout · empty/first-run | **Primary P21 shell/chrome master**; Plan surface, panel proportions, first-run treatment | `design-plan-p21`; Shell Scene §6; Design §22 |
| `P21/scene-plan-arrange.png` | Scene → Plan → Arrange · selected Scene entity | Primary populated Arrange composition; owner-aware Plan Inspector and direct yaw affordance | Shell Scene §6/§29; P10 |
| `P21/scene-3d.png` | Scene → 3D · selected Scene entity | Primary Scene 3D composition, hierarchy/Inspector density, selected-object treatment | Shell Scene §7; Design §28A |
| `P21/camera-plan.png` | Camera → Plan · selected connection + expanded Timeline | Primary Camera Plan composition, passive footprints, topology/timing/timeline presentation | Shell Camera §9/§12; Camera flow; Camera Plan footprint spec |
| `P21/camera-3d.png` | Camera → 3D · selected camera + expanded Timeline | Primary Camera 3D composition, framing/path overlays, Camera sidebar and Timeline | Shell Camera §10/§12; camera-tour contract |
| `P21/Preview.png` | Project-level Visitor Preview | Primary Visitor Preview composition; full-screen visitor-runtime isolation with minimal editor-owned Preview/Exit chrome | `design-plan-p21` §I; visitor/editor isolation contract |

### Shared P21 shell visual contract

- Row 1: project identity/persistence · project navigation · Undo/Redo · Preview · account.
- Row 2: active Spatial routing and contextual workspace commands.
- Permanent workspace tools live in Row 2; viewports keep only spatially meaningful direct-manipulation overlays.
- `#2F8CFF` is the sole generic active/selection accent; RGB axis colors remain spatial semantics only.
- Scene Plan uses the warm drafting-paper surface; Scene/Camera 3D use the dark professional real-time viewport treatment.
- Only `Spatial` is exposed in the strict P21 implementation state; future project surfaces may be shown in Future references.
- Visitor Preview intentionally drops the normal editor shell, panels, gizmos, and Timeline; only minimal editor-owned Preview/Exit chrome may remain around visitor-safe runtime content.

## Future / North-Star visual references

These images are intentionally richer future product references. Their **visual hierarchy and surface identity** are useful direction; their exact internal controls, metadata, schemas, and backend capabilities are not ratified by the image alone.

| File | Surface | Status |
|---|---|---|
| `Future/project-hub-cover-enabled.png` | Project Hub with visual project shelf + dense project list | **Future Hub visual North Star**. Cover pipeline and illustrative metadata are deferred. |
| `Future/assets-concept.png` | project-level Assets management surface | **Future Assets visual direction**. One asset system; Type/Source are filters. Exact management capabilities remain deferred. |
| `Future/publish-concept.png` | project-level Publish/release surface | **Future Publish visual direction**. Single release destination/action hierarchy is directional; Releases/Settings/custom domain/embed internals remain illustrative unless separately ratified. |

## Legacy / specialized Scene references

The files under `docs/reference/design-system/gallery/Scene/` are **not P21 shell authorities**. Keep them for the specific state or interaction they document when the P21 set does not provide an equivalent.

**Scene 3D XYZ-gizmo authority:**
`Scene/scene-3d-object-selection-xyz-gizmo.png` remains the specialized reference for a complete red X, green Y, blue Z transform gizmo at one pivot. The P21 Scene 3D composition does not supersede this exact gizmo contract.

| File | Retained specialized purpose |
|---|---|
| `Scene/scene-plan-layout.png` | populated Layout-state content reference until a populated P21 Layout visual exists; shell is legacy |
| `Scene/scene-empty-plan.png` | legacy empty-Plan reference; superseded visually by `P21/scene-plan-layout.png` |
| `Scene/scene-3d-object-selection.png` | legacy selected-object composition; superseded visually by `P21/scene-3d.png` |
| `Scene/scene-3d-object-selection-xyz-gizmo.png` | authoritative complete XYZ transform-gizmo detail |
| `Scene/scene-3d-layout-selection.png` | selected Layout surface in Scene 3D |
| `Scene/scene-3d-assets.png` | Scene 3D contextual asset browse/place state |

## Legacy / specialized Camera references

The files under `docs/reference/design-system/gallery/Camera/` are **not P21 shell authorities**. They remain useful for camera states not fully represented by the two primary P21 Camera compositions.

**Camera behavior authority:** graph/Sequence semantics come from source/tests and the Camera specs. Connections remain undirected; Sequence is ordered. Directional arrows belong only to preview/playback/timing semantics, never connection topology.

| File | Retained specialized purpose |
|---|---|
| `Camera/camera-timeline-expanded.png` | legacy expanded Timeline detail cited by the landed Camera workspace specs; P21 Camera images own overall composition. The destination has no global Camera Timeline (PLATE §0.8.1) |

## Other retained visual assets

The top-level `x-y-z-box.png` remains for the orientation-box specs; the former `collapsed.png` / `expanded-new.png` drafts live in Git history only. It does not override the P21 shell. Orientation behavior/render details continue to defer to the dedicated orientation specs and current implementation/tests.

## Visual QA

Review each image at original resolution. For implementation:

- shell/chrome and broad visual hierarchy come from the P21 primary set;
- exact behavior, ownership, topology, selection/history, transforms, and Timeline semantics come from source/tests and the governing specs;
- Visitor Preview must remain visitor-safe and authoring-chrome-free regardless of incidental generated-image details;
- Future images must not be used to infer an unratified backend or data model;
- legacy images must not reintroduce the pre-P21 app bar, permanent floating toolbar, `Staging` terminology, or old persistence/Preview chrome.

A PNG is implementation-authoritative only to the extent explicitly registered above.
