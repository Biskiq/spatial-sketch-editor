# Deep research — Layout/CAD capability references for P23+

**Date:** 2026-09-07
**Purpose:** preserve external implementation precedents and Phase 3 conclusions that informed P23 Layout Depth.
**Scope:** research/reference only. The canonical implementation contract remains [`../plans/2026-09-07-P23-layout-depth-minimum-build.md`](../plans/2026-09-07-P23-layout-depth-minimum-build.md) plus the architecture/component contracts.

## Product conclusion

Scene Plan should become a **precise semantic spatial builder**, not browser AutoCAD.
The useful boundary is roughly:

```text
Figma-level directness
+ practical CAD precision
+ floor-planner semantics
+ agent-addressable operations
```

P23 should deepen numeric precision, snapping, wall/opening editing, alignment,
structure reuse, and deterministic operation semantics while preserving:

- `LayoutDocument` as authored architecture truth;
- one `compileLayoutGeometry()` pipeline for Plan + 3D + visitor runtime;
- explicit Room identity and room-local transforms;
- separate `LayoutDocument` / `SceneDocument` ownership;
- SVG as Plan presentation, not project truth;
- one logical Layout history result per completed semantic operation;
- no general constraint solver, BRep kernel, BIM model, or second CAD truth.

Research may be broader than scheduled work. A repository listed here is not an
approved dependency. Agents may inspect these public solutions directly when
planning or implementing the matching bounded capability, but must re-check the
current repository state and upstream license before reusing code.

## High-value implementation precedents

| Concern | Public reference | Relevant surface to inspect | Lesson / disposition |
|---|---|---|---|
| Atomic wall/structure edits | [openPlan3D](https://github.com/laanlabs/openPlan3D) | `src/lib/utils/wallEditing.ts`, `alignment.ts`, `roomDetection.ts`, opening/wall tests | Study/port the **plan whole candidate → validate → apply atomically** pattern and adversarial tests. Do not adopt its Canvas/store architecture or room-identity model. MIT, but verify current files before reuse. |
| Mature snap grammar | [LibreCAD](https://github.com/LibreCAD/LibreCAD) | `librecad/src/lib/actions/rs_snapper.cpp`, preview/modify actions | Study endpoint/midpoint/intersection/orthogonal behavior, preview-vs-commit interaction, and numeric drafting UX. GPL: study algorithms/UX; do not casually transplant source. |
| Architectural wall/opening semantics | [Sweet Home 3D](https://github.com/mjcipriano/sweethome3d) | `PlanController.java`, `WallController.java`, `Wall.java`, door/window and dimension models | Study wall-relative openings, direct dimensions, grouped edits, levels UX, and semantic command ideas. GPL: study only unless a separate compatible source is identified. |
| Wall-join / half-edge concepts | [Blueprint3D](https://github.com/furnishup/blueprint3d) | `src/model/{floorplan,wall,corner,room,half_edge}.ts` | Useful wall-join/topology reference. Reject its Three/render coupling and stale project architecture as product model. |
| Human + agent semantic operations | [KittyCAD / Zoo modeling-app](https://github.com/KittyCAD/modeling-app) | `src/lang/modifyAst/*.ts`, specs, `src/lib/operations.ts`, principles docs | Study typed semantic modification operations callable from UI/tests/agents. Do **not** create a universal command framework in P23; preserve Museum's existing helpers/transactions. |
| Robust geometric orientation | [robust-predicates](https://github.com/mourner/robust-predicates) | public `orient2d` / predicate API | Strong focused dependency candidate if near-collinear/intersection fixtures prove current math unstable. Wrap behind `layout-core`; do not scatter direct calls through Svelte/UI. |
| General browser 2D geometry | [Flatten.js](https://github.com/alexbol99/flatten-js) | line/segment/arc/polygon intersection + distance APIs | Prototype/reference only. Current `CompiledLayoutGeometry.queries` and internal helpers remain first choice. Never make Flatten shapes serialized truth. |
| Derived room-face diagnostics | [JTS Polygonizer](https://github.com/locationtech/jts) | `operation/polygonize/Polygonizer.java` | Reference for noded linework, candidate faces, dangles/cut edges/invalid rings. Derived faces may assist explicit Room creation/validation; they must not replace Room identity. |
| Bounded line/arc offset | [CavalierContours JS](https://github.com/msurguy/cavalier-contours-js) | polyline/arc offset operations | Strong follow-up spike for a bounded wall/chain offset. Prefer only after P23 minimum; output should bake normal Layout entities, not persist an offset relation. |
| Polygon offset/boolean comparison | [clipper2-ts](https://github.com/countertype/clipper2-ts) | offset/boolean API and tests | Compare with CavalierContours only when offset/profile needs justify it. Not a P23-minimum dependency. |
| DXF import edge | [dxf-parser](https://github.com/gdsestimating/dxf-parser) | parser API | Future adapter: DXF → candidates → normalize/validate → `LayoutDocument`; DXF never becomes internal truth. |
| DXF/vector export reference | [Maker.js](https://github.com/microsoft/maker.js) | DXF/SVG export and path/chains code | Future boundary reference; a bounded custom exporter may remain simpler. |
| IFC boundary | [web-ifc](https://github.com/ThatOpen/engine_web-ifc) | browser/WASM API, worker build | Future IFC adapter only. Import selected storey/wall/slab/opening/door/window semantics into validated candidates; do not internalize BIM truth. |
| Constraint-solver boundary | [FreeCAD](https://github.com/FreeCAD/FreeCAD), [SolveSpace](https://github.com/solvespace/solvespace) | Sketcher/GCS and solver modules | Evidence for **not** crossing into persistent global geometric constraints in P23. Study UX/complexity only. |
| BRep/kernel boundary | [replicad](https://github.com/sgenoud/replicad) / OpenCascade | browser/WASM modeling architecture | Evidence for deferral. No CAD kernel until arbitrary persistent solid boolean + fillet/chamfer + STEP roundtrip become core product workflow. |

## Phase 3 conclusions applied to current repository

### Operation architecture

The current P23 operation contract is already aligned with the research:

```text
intent
→ build complete semantic candidate
→ validate
→ transient preview
→ commit atomically
→ one Layout history entry
```

Do not add a new P23.0 framework, operation registry, or universal command bus.
Use current pure helpers, preview state, mutation runner, and transactions. Extract
only touched candidate logic from UI state when necessary.

### Wall precision

P23 should add numeric **straight-wall length** because it is core drafting
vocabulary and current `DraftSegment` line semantics can support it without a
new durable entity. The operation must identify the fixed endpoint explicitly,
preserve segment identity, update connected boundary geometry through canonical
room editing, preserve meter-based opening offsets, and reject a result that
invalidates openings/topology.

Do not add general wall-angle authoring or numeric auto-Bezier arc-length mutation
in the same minimum slice.

### Snapping

The current compiled query surface is the preferred substrate. Snap candidates
should derive from `CompiledLayoutGeometry.queries` plus transient gesture guides,
not from consumer-side SVG resampling.

P23 minimum should cover:

```text
grid
endpoint / room corner
straight-wall midpoint
intersection
nearest point on wall/reference span
orthogonal guide
opening edge while editing an opening
rotation-aware object bound edge/center where already supported
```

Pointer acquisition radius is CSS-pixel interaction state. Geometry/topology
tolerances remain model-space policy. Do not reuse one epsilon for both.

Parallel/perpendicular tracking, tangent, extension, generalized smart guides,
and the rest of a desktop CAD object-snap catalogue remain follow-up scope.

### Alignment

Keep current one-selected-Layout-object model for P23 minimum. Add a bounded
wall-centric reference such as **Center on straight wall** in addition to
object/room X/Z min/center/max alignment. Scene-owner alignment, if later added,
must be a separate Scene operation even when it reads Layout geometry.

### Openings

The current project already stores opening `offset` in meters along a segment,
which matches the research-preferred semantic model. No normalized-`t` migration
is needed merely for P23.

For straight segments, P23 should add direct Plan manipulation:

```text
opening body drag → slide along owning wall
left/right width handles → resize along owning wall
```

The gesture keeps the same segment reference, previews transiently, preserves
height/sill/profile, rejects overflow/overlap atomically, and commits one Layout
history entry. Curved-wall opening gestures may stay at existing behavior for the
minimum slice.

### Presets

Prefer **Column**, **Platform**, and **Plinth** as existing-shape presets.
A generic box called `Partition` risks creating a second wall-like concept that
cannot own openings or participate in room-boundary semantics. If a freestanding
display partition becomes a repeated product need, register it later as an
explicit fixture/template rather than pretending a box is architecture.

### Robustness

New P23 geometry work should distinguish:

- CSS-pixel pointer acquisition radius;
- minimum authored segment/object sizes in meters;
- canonical geometric equality/degeneracy policy;
- display rounding/formatting.

Add fixtures for near-collinear intersections, nearly coincident endpoints,
zero/tiny wall lengths, endpoint intersections, deterministic snap ties, and wall
resizes that would invalidate an opening. Add `robust-predicates` only if these
fixtures demonstrate a real classification weakness.

## Follow-up order after P23 minimum

These are research-backed candidates, **not P23 ship gates**:

1. mirror selected Layout structure;
2. box selection + distribute/equal spacing;
3. richer temporary guides/snaps;
4. bounded straight/non-branching wall-chain offset;
5. derived room-topology diagnostics / assisted face candidates;
6. trim/extend only after wall/reference semantics prove stable.

Longer-term/demand-gated: circular-arc wall semantics, stairs, levels, railings,
profile/extrude, reusable component definitions/instances, DXF/IFC adapters.

Still rejected for the current product category: global geometric solver,
arbitrary BRep/STEP-native authoring, general solid modeling, full BIM/MEP,
construction-document CAD, and mesh/DCC editing.

## Agent-use rule

Future agents may inspect these public repositories when implementing a bounded
capability. They should use the references as evidence and algorithm/UX precedents,
not as authority over Museum Editor ownership. Every implementation must still
resolve through current semantic IDs, the canonical geometry compiler, current
Layout transaction/history semantics, and the visitor/editor isolation boundary.
