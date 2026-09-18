# P23-H2 — Snapping / selection / guides / Plan visual grammar harvest

**Status:** harvest complete — audited implementation evidence for P23.2 and P23.6  
**Scope:** P23-H2 only. No plan or product-code changes.  
**Museum Editor baseline inspected:** `toni8699/spatial-sketch-editor@7492b4e6d4dc3bb6148b64e3b7327117f11b6b17` (`P23 plan subslices`)  
**Upstream snapshots rechecked live:**

- LibreCAD: `LibreCAD/LibreCAD@cf968cc77d1c8f0aa4ffebc660188061cfd4ac8c`
- openPlan3D: `laanlabs/openPlan3D@511ff08f57526784c0bf3bc48466bfea04204bbc`

This artifact is the P23 umbrella's bounded H2 harvest. It records exact source/test seams, behavior, license/disposition, Museum mapping, fixture provenance and recommended child-plan refinements. It does not override the P23 umbrella, edit P23.2/P23.6, or broaden into general CAD research.

---

## 1. Executive result

P23.2 and P23.6 are directionally sound. H2 recommends tightening their implementation detail while preserving the umbrella's durable contracts.

### P23.2

1. Keep snap truth on `CompiledLayoutGeometry.queries` plus transient gesture context. Do not create a second geometry model and do not let `PlanSvg.svelte` reconstruct snap geometry.
2. Keep the umbrella's deterministic winner order exactly:

   `tool/context validity → semantic feature priority → screen distance → stable ID/key`

   A valid acquired reference beats grid. Do **not** replace the umbrella order with LibreCAD's nearest-first behavior or openPlan3D's source-array/categorical ordering.
3. Use a fixed CSS-pixel reference acquisition radius, independent of grid spacing. H2 recommends **8 CSS px as the initial implementation default**, centralized and testable; visual QA may tune the value without changing the policy.
4. Treat guides/markers as transient result data. Snap-off, cancel, pointer loss, tool/mode/view changes and commit clear them. They never enter `LayoutDocument`, `SceneDocument`, persistence or history.
5. Keep alignment narrower than openPlan3D: one selected supported Layout object → one explicit reference, with rotation-aware compiled/world bounds and one Museum Layout transaction. Multi-selection and distribution stay deferred.

### P23.6

1. Reuse `PlanRenderModel` + `PlanInteractionProjection` + `PlanSvg.svelte`; no second SVG/canvas overlay authority.
2. Add a small semantic snap/guide presentation vocabulary and show the **winner**, not a cloud of all candidates.
3. Preserve one blue selection language; snap feedback must be visually distinct from hover, selection and invalid preview.
4. Keep the current major/minor grid LOD approach and tune hierarchy only.
5. **Current reconciliation required:** `PlanSvg.svelte` already synthesizes a door leaf and swing arc although the render model carries no authored hinge/handedness/swing state. P23.6 already forbids implying semantics that do not exist. The visual pass should suppress that invented swing/leaf direction until durable door semantics are explicitly designed; opening gap/jamb treatment remains valid.

---

## 2. License / disposition matrix

| Source | License rechecked | H2 disposition | Useful harvest | Explicit not-to-import |
|---|---|---|---|---|
| LibreCAD repository / `LICENSE` | GPLv2 for LibreCAD as a whole | **STUDY** | snap candidate behavior, restriction ordering, transient preview/highlight lifecycle, guide/marker grammar | any source/test text, Qt action architecture, entity/document model, overlay subsystem, full visual-snap subsystem |
| LibreCAD `rs_snapper.cpp` / `.h` | GPL | **STUDY** | ordinary snap order, strict-nearer behavior, free fallback, screen-derived catch range | translated/ported implementation or implicit call-order ties |
| LibreCAD preview / visual-snap files | GPL | **STUDY** | separate preview/highlight/guide/winner state, cleanup lifecycle, orthogonal guide presentation | preview container/action inheritance and visual-snap object graph |
| openPlan3D repository / `LICENSE` | MIT, copyright 2026 theLodgeStudio | **ADAPT** overall | pure hit-test/snap helpers, test ideas, alignment vocabulary, Plan rendering grammar | store mutation, Canvas2D architecture, project model, render-order truth |
| openPlan3D pure tests/helpers | MIT | **PORT/ADAPT** where useful | zoom-invariant opening fixture, rotated hit shape, wall/grid relation fixture intent | upstream units/store assumptions; retain MIT notice if substantial text is actually ported later |

### License obligations

- **LibreCAD:** STUDY only. H2 copies no GPL source or test code. Behavior and fixture intent are described independently in Museum terms.
- **openPlan3D:** MIT permits reuse, but H2 itself ports no source. If implementation later copies substantial source/test text, retain the upstream copyright and MIT notice.

---

## 3. Museum Editor current ground truth

### 3.1 Canonical query geometry

Inspected:

- `packages/layout-core/src/layout-geometry-types.ts`
- `packages/layout-core/src/layout-geometry-queries.ts`
- `apps/editor/src/lib/editor/layout/plan-hit.ts`
- `apps/editor/src/lib/layout/plan-render-model.ts`

`CompiledLayoutGeometry.queries` already provides the renderer-neutral source H2 needs:

- `CompiledQueryPoint`: `vertex | interior-anchor`
- `CompiledQuerySpan`: `wall | opening | solid`, with source IDs, segment identity, endpoints and cumulative distances
- `CompiledQueryPolygon`: `room-floor | object-footprint`
- `CompiledQueryAabb`: `room | wall | opening | object | floor | document`

`projectPointToSpans()` linearly evaluates canonical compiled spans and returns the nearest projection. `findPolygonContaining()` resolves from the supplied compiled polygon set. `geometryId()` provides collision-safe stable tuple serialization for compiled identities.

**H2 conclusion:** do not add persistent snap geometry. A snap-specific runtime descriptor may exist in the editor, but its geometry comes from compiled query records plus transient gesture anchors.

Conceptual shape only:

```ts
type PlanSnapCandidate = {
  kind:
    | 'endpoint'
    | 'opening-edge'
    | 'intersection'
    | 'midpoint'
    | 'orthogonal'
    | 'nearest-span'
    | 'grid';
  point: LayoutVec2;
  semanticRank: number;
  stableKey: string;
  sourceIds: readonly string[];
};
```

This is runtime/session data. It is not `LayoutDocument`, serialized JSON, history, SVG state or Three state.

### 3.2 Existing selection authority is already stronger than upstream references

Inspected:

- `apps/editor/src/lib/editor/layout/plan-hit.ts`
- `apps/editor/src/lib/editor/layout/arrange-hit.ts`
- `apps/editor/src/lib/editor/layout/layout-interaction.ts`
- `apps/editor/tests/lib/editor/layout/plan-hit.test.ts`
- `apps/editor/tests/lib/editor/layout/arrange-hit.test.ts`

Current Layout Plan hit priority is explicitly locked in `resolvePlanHit()`:

`vertex → interior anchor → opening → object → wall → room`

Current Arrange hit behavior is separately deterministic:

1. polygon containment;
2. active-owner selected member under pointer;
3. Scene layer 6 over Layout layer 5;
4. stable render/document order for same-priority ties;
5. Scene-only edge halo only when no polygon contains the pointer.

**H2 rule:** snapping never becomes a second selection resolver. A wall/object/room may be used as a reference without changing the canonical selection slot, active Arrange owner, or history.

The existing selection resolver has some intentionally order-based internal ties (`<=` point replacement, reverse traversal for some topmost content, first strictly-nearer wall). Those are current **selection** behavior. P23.2 must not copy those incidental traversal ties into snap winner resolution.

### 3.3 Existing snapping is grid-only and duplicated

Inspected:

- `apps/editor/src/lib/editor/layout/layout-plan-transform.ts`
- `apps/editor/src/lib/editor/layout/layout-object-editing.ts`
- `apps/editor/src/lib/editor/layout/layout-interaction.ts`
- Plan/Arrange/gizmo callers referenced by P23.2
- `apps/editor/tests/lib/editor/layout/layout-plan-transform.test.ts`
- `apps/editor/tests/lib/editor/layout/layout-object-editing.test.ts`

Current facts:

- `snapToGrid(point, spacing = 0.25)` rounds X/Z independently.
- `snapLayoutPlanPoint(point, step = 0.25)` duplicates quarter-meter quantization.
- `buildPlanGrid(..., minorSpacing = 0.25, majorSpacing = 1)` has another quarter-meter default.
- `PlanViewportState` already carries `snapEnabled`, `gridEnabled`, `angleSnapEnabled`.
- current tests pin quarter-meter grid behavior, 15° angle snapping and minor-grid LOD.

**H2 recommendation:** P23.2 should first centralize one effective Layout Plan grid step and route all affected Layout placement/translation/drafting callers through it. Do not accidentally change Camera Plan snapping merely because shared transform helpers are imported there.

Reference acquisition radius is a separate screen-space policy and must not derive from grid step.

### 3.4 Existing Plan render boundary is correct for H2

Inspected:

- `apps/editor/src/lib/layout/plan-render-model.ts`
- `apps/editor/src/lib/editor/layout/PlanSvg.svelte`
- `apps/editor/src/lib/editor/layout/plan-overlays.ts`
- `apps/editor/src/lib/editor/layout/PlanCanvasChrome.svelte`
- `apps/editor/src/lib/editor/styles/plan.css`
- `apps/editor/src/lib/editor/styles/tokens.css`
- `apps/editor/src/lib/editor/theme.svelte.ts`
- Plan render/theme tests referenced by P23.6

`PlanRenderModel` is pure and renderer-neutral. `PlanInteractionProjection` already owns transient selection/handles/drafts/labels/overrides. `PlanSvg.svelte` applies the view transform and styles primitives.

That is the H2 insertion seam:

`Plan snap result → plan-overlays.ts / interaction projection → PlanRenderModel → PlanSvg.svelte`

Do not create a second DOM/SVG guide layer with its own world transform.

### 3.5 Theme baseline

Current shipped theme registry contains seven themes, but the Plan paper/spatial interaction palette is intentionally invariant across themes. `plan.css` already centralizes Plan paper, grid, wall/object, hover, handle and selection tokens.

P23.6 should add shared Plan semantic tokens only where needed. Do not add a CAD-specific theme and do not hardcode per-theme snap colors in `PlanSvg.svelte`.

### 3.6 Current door-symbol semantic mismatch

Current `PlanRenderModel` opening metadata gives the SVG adapter:

- opening kind (`door | window`)
- opening width
- wall thickness
- inward room normal

`PlanSvg.svelte` nevertheless derives a door leaf and swing arc from that limited state.

There is no authored hinge side/handedness/swing direction in that projection. This is precisely the presentation-state overclaim P23.6 says to avoid.

**Required P23.6 reconciliation:**

- keep the opening void/gap;
- keep neutral jamb/window framing treatment;
- suppress an invented directional door leaf/swing until authored semantics exist;
- never use decorative SVG door geometry as snap/hit/mutation truth.

---

## 4. LibreCAD harvest — STUDY only

### 4.1 Exact inspected source

At `LibreCAD/LibreCAD@cf968cc77d1c8f0aa4ffebc660188061cfd4ac8c`:

- `LICENSE`
- `librecad/src/lib/actions/rs_snapper.cpp`
- `librecad/src/lib/actions/rs_snapper.h`
- `librecad/src/lib/actions/rs_previewactioninterface.cpp`
- `librecad/src/lib/actions/rs_actionselectbase.cpp`
- `librecad/src/lib/actions/visual_snap/lc_visual_snap_solution_solver.cpp`
- `librecad/src/lib/actions/visual_snap/lc_visual_snap_solution_visualizer.cpp`

No focused automated `RS_Snapper` unit-test suite was located during this bounded harvest. LibreCAD-derived Museum fixtures below therefore use independently written behavior/edge-case provenance, never copied GPL tests.

### 4.2 Ordinary snap behavior and tie behavior

When the visual-snap path does not resolve a special solution, `RS_Snapper::snapPoint()` evaluates ordinary enabled snap families in this order:

1. endpoint
2. center
3. middle
4. distance
5. intersection
6. on-entity
7. grid

Each family updates the current winner only when it is **strictly closer** than the prior best. Consequences:

- ordinary resolution is distance-driven;
- an exact-distance tie stays with the family evaluated earlier;
- grid is evaluated after reference families;
- if nothing is acquired, free pointer position is available.

This is useful evidence, but **Museum must not inherit the call order as semantics**. The P23 umbrella already defines the Museum order:

`tool/context validity → semantic feature priority → screen distance → stable ID/key`

H2 therefore studies LibreCAD's behavior but keeps Museum's explicit semantic rank ahead of distance.

### 4.3 Acquisition range

LibreCAD uses a screen-derived entity catch range rooted in a default 32 px constant and can further bound snapping from current grid-cell size. The result mixes pointer ergonomics with grid density.

**Museum disposition: REJECT that coupling.**

P23.2 already requires one CSS-pixel acquisition radius stable across zoom. H2 recommends initial `8 px`, converted once per event:

`worldRadius = 8 / pixelsPerMeter`

Changing `0.25 m` grid to `0.10 m` must not alter reference acquisition.

### 4.4 Restriction ordering / orthogonal guides

LibreCAD separates an acquired snap spot from horizontal/vertical/orthogonal restriction relative to a base/relative-zero point. Orthogonal restriction chooses between the horizontal and vertical constrained result.

Useful Museum lesson:

- candidate/reference acquisition and directional relation are distinct concepts;
- an orthogonal guide is transient gesture context, not document geometry;
- guide feedback can explain the relation while the winning coordinate remains one deterministic result.

Museum does **not** need LibreCAD's UCS/relative-zero/action system.

### 4.5 Visual-snap solution behavior

The inspected visual-snap solver builds guide rays/lines from eligible reference points/entities and finds candidate intersections/special points inside its snap range. Its solution visualizer keeps separate concepts for:

- highlighted source/reference entity;
- reference/vertex marks;
- guiding entities;
- projected candidate marks;
- the found/restricted point relationship;
- compact guide labels.

This is strong visual-grammar evidence for P23.6: snap result, source emphasis, guide line and marker do not need to collapse into one generic selection-looking dot.

Museum should adapt only the bounded grammar. Tangent/normal/ray/distance visual-snap families remain outside P23.2.

### 4.6 Preview / cleanup lifecycle

`RS_PreviewActionInterface` keeps preview entities, highlights and snap feedback transient. Init/finish/suspend clear the transient containers; resume reconstructs; triggering clears transient visuals around commit/redraw.

Museum mapping:

- snap winner/guides live in editor interaction/session state;
- clear on Snap off, Esc/cancel, pointer cancel/loss, tool change, Layout↔Arrange authority change, Plan↔3D switch, commit, or invalidated reference;
- no document mutation/history occurs from showing or clearing feedback.

### 4.7 Selection lesson

`RS_ActionSelectBase` routes hover through a selection catch path and highlights the caught entity separately from committed selection. The useful lesson is **hover/reference emphasis is not selection identity**.

Museum already has a stronger canonical selection model. Do not import LibreCAD selection actions or entity classes.

---

## 5. openPlan3D harvest — MIT, ADAPT selectively

### 5.1 Exact inspected source/tests

At `laanlabs/openPlan3D@511ff08f57526784c0bf3bc48466bfea04204bbc`:

**Source**

- `LICENSE`
- `src/lib/utils/hitTesting.ts`
- `src/lib/utils/canvasInteraction.ts`
- `src/lib/utils/alignment.ts`
- `src/lib/utils/furnitureGeometry.ts`
- `src/lib/utils/canvasRenderer.ts`
- `src/lib/components/editor/FloorPlanCanvas.svelte`

**Related tests**

- `tests/opening-hit-testing.test.ts`
- `tests/furniture-interactions.test.ts`

No dedicated alignment test file was located in the current tree during H2.

### 5.2 Hit testing

Useful patterns in `hitTesting.ts`:

- pure point-in-polygon and point-to-segment helpers;
- rotated furniture hit testing transforms pointer into item-local coordinates;
- handles use a fixed screen tolerance converted to world (`8 / zoom`);
- measurement/annotation/opening hit tolerances are also screen-normalized;
- furniture/openings generally traverse from the end so last drawn wins inside the same category;
- opening hit area follows the wall-aligned opening body, not a large center-point circle.

`tests/opening-hit-testing.test.ts` is especially useful provenance:

- runs across zoom values `0.25, 0.5, 1, 2, 4`;
- guards a regression where a wide opening captured empty space far from the opening body;
- proves a screen-space edge tolerance while keeping full physical opening width selectable;
- verifies wall tangent behavior for rotated/curved walls;
- pins last-drawn opening priority and degenerate/missing-wall rejection.

**Museum mapping:** use compiled opening spans/query geometry as authority. Do not derive hit/snap geometry from the rendered SVG symbol.

### 5.3 Hit behavior to reject

openPlan3D has independent per-type hit helpers with differing traversal rules:

- furniture/openings often reverse arrays;
- rooms scan forward;
- walls can return the first qualifying wall;
- curved wall picking/some placement helpers sample curves in the consumer.

Museum already has `resolvePlanHit()` / `resolveArrangeHit()` and compiled query geometry. **Reject openPlan3D's hit architecture**; retain only test/interaction ideas.

### 5.4 Grid + endpoint magnetic snapping

`canvasInteraction.ts` defines:

- `GRID = 20`
- `SNAP = 10`
- `MAGNETIC_SNAP = 15`
- `WALL_SNAP_DIST = 12`

Its pure `magneticSnap()` starts from a grid/coordinate fallback, scans wall endpoints, excludes provided wall IDs, converts magnetic range with `/ zoom`, and replaces the result only for a strictly closer endpoint.

The larger `FloorPlanCanvas.svelte` also has component-local magnetic snap behavior, demonstrating the architectural problem H2 should avoid: snapping exists in more than one place.

Useful lessons:

- screen-space acquisition;
- moving-source exclusion;
- endpoint references distinct from grid fallback.

Reject:

- duplicated component + helper resolver;
- upstream hardcoded units/constants;
- input-array order as a semantic tie-break;
- consumer-owned wall/curve geometry.

### 5.5 Tie behavior

openPlan3D's relevant loops use strict-nearer comparisons. Equal-distance endpoints/walls therefore preserve the earlier source encountered. The outcome is stable only if array order is treated as truth.

**Museum disposition:** do not use render/document iteration order as the new snap tie. P23 already requires final stable ID/key after context, semantic priority and screen distance.

### 5.6 Wall relation + grid preservation

`snapFurnitureToWalls()` in `furnitureGeometry.ts` finds the closest eligible straight wall within a threshold. Once the furniture is made flush to the wall, grid adjustment is projected only along the wall so exact perpendicular clearance is preserved.

`tests/furniture-interactions.test.ts` includes a diagonal-wall case that proves the exact wall clearance survives grid snapping.

P23.2 does not import furniture-wall snapping, but the principle is valuable:

> a weaker grid quantization must not destroy an already-acquired stronger geometric reference.

Museum simplification: if a reference candidate wins, do not grid-round that winning coordinate afterward. Grid is fallback when no valid reference is acquired.

### 5.7 Alignment

`alignment.ts` supports:

- left/right/top/bottom alignment;
- horizontal/vertical center alignment;
- horizontal/vertical distribution.

It derives axis-aligned rectangles from furniture center + effective width/depth, reads selected furniture from Svelte stores, mutates project state directly, and opens/closes its undo group internally.

Important mismatch with P23.2:

- it is multi-selection oriented;
- rotation is not represented in its alignment rectangle;
- distribution is equal center spacing, not equal visible gaps;
- algorithm is store-coupled;
- no dedicated alignment tests were found;
- no explicit no-op history guard is evident.

**Museum disposition: ADAPT vocabulary/math only.** Keep P23.2's narrower one-object-to-reference model using canonical compiled/world bounds and Museum transactions.

### 5.8 Plan visual grammar

From `canvasRenderer.ts` / `FloorPlanCanvas.svelte`, useful visual ideas are:

**Walls**

- physical thickness reads as a filled/banded wall, not a decorative centerline;
- selected wall gets a stronger selection treatment;
- selected wall endpoints/midpoint handles are visually distinct.

Museum already has physical-width wall casing/fill. Refine tokens/hierarchy; do not copy Canvas geometry.

**Dimensions**

- dimension line offset from measured geometry;
- extension lines from measured endpoints;
- compact tick marks;
- readable label gap/space around text;
- presentation can flip/shift near canvas edges.

Museum adaptation: contextual selected straight-wall length and truthful rectangular-room dimensions only; no persistent dimension entity in P23.6.

**Rooms**

- restrained fill;
- room name/area near center;
- selected room outline stronger than passive fill.

Do not present arbitrary room AABB width/depth as exact architectural dimensions for concave/curved rooms.

**Snap points**

openPlan3D can render many wall endpoints as faint snap points. Museum should **not** show an always-on candidate cloud in P23.6. Winner-only feedback better fits the current Plan hierarchy.

**Guides**

openPlan3D has persistent project/floor guides. Their dashed-line visual treatment is useful reference only. Persistent guide entities are outside P23.2 and must not be added to `LayoutDocument`.

**Grid**

openPlan3D distinguishes major/minor grid density. Museum already has equivalent LOD (`buildPlanGrid()` hides minor lines when projected spacing is below 6 px). Keep Museum's renderer.

---

## 6. Recommended Museum snap resolver contract

### 6.1 Location / ownership

Recommended pure editor seam:

`apps/editor/src/lib/editor/layout/plan-snap.ts`

The exact file name is implementation detail, but ownership should remain editor-side for P23.2 because the resolver combines canonical compiled queries with tool/gesture/session context.

Responsibilities:

- accept `CompiledLayoutQueryGeometry`;
- accept raw world pointer, `pixelsPerMeter`, active tool/gesture context and source exclusions;
- generate only context-valid candidates from compiled queries + transient gesture anchors;
- resolve one winner using the **umbrella comparator**;
- return one renderer-neutral result plus transient guide/marker descriptors.

Do not import Svelte components, DOM/SVG, Three/Threlte, Scene mutators, history or persistence.

Only promote a shared helper deeper into `layout-core` later if a real non-editor caller needs it. Do not move session snap policy into the compiler merely for cleanliness.

### 6.2 Acquisition radius

Initial recommendation:

`SNAP_ACQUIRE_RADIUS_PX = 8`

Evidence range:

- Museum Arrange already uses a 6 CSS-pixel Scene footprint halo;
- openPlan uses 5 px opening margin and 8 px precision handles/measurement targets;
- LibreCAD's broader legacy range is not a direct fit and is partly grid-coupled.

Policy is more important than exact number:

- one centralized CSS-pixel value;
- convert once using `worldRadius = px / pixelsPerMeter`;
- independent of metric grid step;
- test at multiple zooms.

**Hysteresis:** defer in first P23.2 implementation. Neither inspected source gives compelling evidence that a sticky previous winner is required for the minimum slice. Add a release radius only if visual QA/interaction fixtures demonstrate winner flicker.

### 6.3 Candidate vocabulary

Generate only context-valid candidates already approved by P23.2:

1. **Endpoint / room corner** — compiled `vertex` query points.
2. **Opening edge** — canonical compiled opening interval endpoints, only in opening-relevant context.
3. **Intersection** — intersection of eligible canonical compiled straight/query spans; dedupe self/adjacent duplicates deterministically.
4. **Straight-wall midpoint** — midpoint of the authored straight wall segment, not midpoint of every tessellated compiled subspan.
5. **Orthogonal** — transient X/Z relation from active gesture anchor/reference geometry.
6. **Nearest span** — canonical `projectPointToSpans()` over eligible query spans.
7. **Grid** — current effective grid step, only as fallback after reference resolution.

Curved nearest behavior must use existing compiled spans/canonical query data. Plan does not resample a curve.

### 6.4 Moving-source exclusion

Each gesture adapter supplies exclusions by stable semantic/source identity before candidate generation.

Examples:

- dragged object itself;
- moving room and its owned Layout geometry where self-snapping would be invalid;
- current wall/vertex source as needed by the active edit;
- actively edited opening itself when its current edge would trivially self-win.

Arrange Scene-owner gestures may read Layout references, but the snap resolver never causes a cross-document write. Scene gesture writes remain Scene-only; Layout gesture writes remain Layout-only.

### 6.5 Deterministic winner comparator — umbrella preserved

This is mandatory H2 reconciliation. Use the P23 umbrella order, not upstream order:

**A. Tool/context validity**  
Filter impossible/invalid feature kinds before comparison.

**B. Semantic feature priority**  
Use an explicit per-context rank table. Do not let function-call order or source-array order define rank. Opening-edge exists only in its valid opening context. Endpoint/room-corner should outrank generic nearest-span when both are valid; remaining family ranks are reconciled explicitly in the P23.2 implementation plan rather than inferred from upstream traversal.

**C. Screen distance**  
Within the same semantic priority, compare pointer distance in screen/CSS-pixel terms.

**D. Stable ID/key**  
For an equal/numerically tied candidate, compare a stable key assembled from semantic kind + existing source IDs/subfeature identity. Never use render layer, array position or Svelte iteration order.

**Reference vs grid:** an acquired valid non-grid reference wins over grid by contract. Grid is evaluated as fallback, not as a competing higher-priority geometry feature.

This deliberately rejects:

- LibreCAD's implicit call-order tie;
- LibreCAD's nearest-first precedence as Museum product semantics;
- openPlan's input-array tie;
- openPlan's component-local endpoint-first implementation as architecture.

### 6.6 Snap result / guide result

Conceptual output:

```ts
type PlanSnapResult = {
  point: LayoutVec2;
  kind: PlanSnapCandidate['kind'] | 'free';
  sourceIds: readonly string[];
  stableKey: string | null;
  guides: readonly PlanSnapGuide[];
};
```

`PlanSnapGuide` remains renderer-neutral transient session data, for example:

- orthogonal line through active anchor;
- short source-span emphasis;
- winner marker for point/reference feature;
- optional compact semantic label.

No result/guide is serialized. No guide change produces history.

### 6.7 Gesture apply order

For position gestures:

`raw pointer → existing context/modifier constraints → P23 reference resolution → grid fallback if no reference → preview → one commit`

Do not re-grid a winning reference coordinate.

Existing angle modifier semantics remain unchanged unless a separate approved plan changes them.

---

## 7. Alignment mapping

Keep P23.2's existing narrow product choice.

### 7.1 Supported references

- another supported Layout object's compiled world AABB;
- a room's compiled Plan bounds for explicit bounds alignment;
- a selected straight wall as a reference for bounded **Center on wall**.

Expose X or Z + min/center/max for bounds references.

### 7.2 Selected target

Use the selected object's current rotation-aware world footprint/AABB after room-local transform and yaw. Compute only the X/Z translation delta needed to match the chosen reference.

Preserve:

- elevation/height state;
- yaw;
- dimensions;
- shape/type;
- explicit `roomId` ownership.

Never infer ownership from resulting coordinates.

### 7.3 Selection neutrality

Inspector reference picking must not replace the selected object, change Arrange owner, create a second selection store, or produce history before Apply.

### 7.4 History

One successful alignment intent = one `layout` transaction/history result. Zero delta/no-op = no history.

Distribution, group alignment and mixed-owner alignment remain deferred.

---

## 8. P23.6 visual grammar mapping

### 8.1 Hierarchy

Recommended Plan hierarchy using current Museum tokens/surface:

1. authored walls / physical wall thickness — strongest neutral architecture;
2. opening voids/jambs — clear interruption of wall body;
3. restrained room fill/name;
4. Layout objects — authored but subordinate to architecture;
5. passive Scene footprints — quieter context;
6. transient preview/snap guides — visible but not selection-like;
7. active selection/handles — highest interaction emphasis.

Prefer stroke weight, opacity, dash and marker shape before adding new hues.

### 8.2 Winner markers / guides

Suggested semantic shapes; final exact glyph is P23.6 presentation work:

- endpoint / opening-edge: small square/bracket-like point mark;
- midpoint: small triangle/diamond;
- intersection: cross/`×`;
- nearest-span: point plus short perpendicular/source emphasis;
- orthogonal: thin dashed guide + right-angle cue when useful;
- grid fallback: smallest/quietest marker, no long guide.

Rules:

- screen-constant CSS-pixel geometry;
- pointer-inert (`pointer-events: none` at SVG adapter level);
- winner-only by default;
- not identical to selection handles;
- no hit/snap authority from marker geometry.

### 8.3 Plan render/token seam

Prefer a compact semantic token set rather than one token per upstream behavior. For example:

- `snap-guide`
- `snap-marker`
- `snap-label`
- `alignment-preview`

Marker shape communicates feature kind; token communicates shared state. Add new CSS variables in the existing Plan token layer only if the current palette cannot express the needed hierarchy.

Do not encode candidate identity in CSS classes or SVG DOM state.

### 8.4 Dimensions

Adapt only drafting grammar:

- extension lines;
- offset dimension line;
- concise metric label;
- readable gap/halo behind label;
- compact diagonal ticks;
- simple presentation-only flip/shift near viewport edge.

Display only semantically truthful contextual dimensions:

- selected straight-wall length;
- rectangular-room principal dimensions.

No persisted annotation/dimension system in P23.6.

### 8.5 Opening symbol truth

Suppress the current invented directional leaf/swing until authored door handedness/swing semantics exist.

Allowed now:

- opening gap/void;
- neutral jamb/window framing;
- selected opening body/width handles supplied by real P23.3 edit semantics.

Not allowed now:

- invented hinge side;
- invented swing direction;
- decorative SVG symbol as hit/snap/mutation source.

### 8.6 Grid

Keep current Museum grid model:

- major/minor world grid;
- minor-line LOD below roughly 6 projected pixels;
- shared Plan transform;
- existing paper palette.

P23.6 changes only drawing hierarchy. Visual density does not change authored snap coordinates or reference acquisition.

### 8.7 Themes / accessibility

Exercise all shipped themes, including the light `porcelain-atelier` identity. Because Plan spatial palette is invariant, snap/guide additions should normally live in the shared Plan token layer.

Verify:

- sufficient contrast on paper;
- marker feature kind not conveyed by color alone;
- focus-visible behavior for any new DOM controls;
- reduced-motion rules if a control uses transitions;
- no visitor import of editor theme/snap/guide infrastructure.

---

## 9. Acceptance fixtures with provenance

The table below is the implementation handoff. LibreCAD provenance is STUDY-only; all such Museum tests are independently authored. openPlan3D fixture text may be adapted/ported only under MIT obligations.

| Fixture | Museum acceptance | Provenance | Disposition |
|---|---|---|---|
| **H2-F1 fixed-pixel acquisition** | same CSS-pixel pointer distance acquires same reference at 50/100/200 px/m; grid-step change does not change catch radius | LibreCAD screen catch concept + rejection of grid coupling; openPlan zoom-normalized hit tolerances | independent Museum test |
| **H2-F2 opening physical extent** | full physical opening span is eligible; equally distant point outside body is not; stable across zoom | openPlan `tests/opening-hit-testing.test.ts`, regression `#18` | ADAPT/PORT under MIT if text used |
| **H2-F3 semantic priority before distance** | when two acquired valid candidates have different semantic rank, umbrella rank wins even if lower-rank candidate is nearer; same-rank candidates use screen distance | P23 umbrella + LibreCAD/openPlan evidence that upstream orders differ | Museum contract test |
| **H2-F4 stable exact tie** | equal-rank/equal-distance candidates resolve by stable key and remain same when candidate traversal order reverses | LibreCAD strict-nearer call-order tie; openPlan array-order tie | independent Museum regression |
| **H2-F5 reference beats grid** | acquired reference coordinate remains exact; no later grid rounding moves it | P23 contract + openPlan diagonal wall/grid relation | independent/adapted behavior |
| **H2-F6 moving-source exclusion** | moved target cannot self-snap; valid neighbor remains eligible | openPlan `excludeWallIds` + Museum owner model | independent Museum test |
| **H2-F7 orthogonal transient guide** | orthogonal result/guide derives from active anchor; cancel/snap-off clears it with no document/history change | LibreCAD restriction + preview lifecycle | STUDY-derived independent test |
| **H2-F8 opening-edge context** | opening-edge candidate exists only in opening-relevant context; does not globally steal unrelated gestures | P23.2 context contract + openPlan opening extent | independent Museum test |
| **H2-F9 curved nearest-span uses compiler** | curved nearest reference matches canonical compiled query projection; resolver performs no curve sampling | Museum `g2AutoBezierDocument` + rejection of openPlan consumer sampling | reuse Museum fixture |
| **H2-F10 canonical intersection** | intersection comes from eligible compiled query spans, dedupes self/adjacent duplicates and is stable across zoom | LibreCAD intersection behavior + Museum compiler boundary | independent Museum test |
| **H2-F11 non-default grid step** | one changed effective grid step reaches every affected Layout draft/placement/translation path; no hidden 0.25 path | current Museum duplicated defaults | Museum regression |
| **H2-F12 Camera isolation** | changing Layout Plan grid/reference settings does not change Camera Plan snap behavior | Museum domain/workspace boundary | Museum regression |
| **H2-F13 rotated alignment bounds** | rotated Layout target aligns using current world footprint/AABB, preserving elevation/yaw/dimensions/roomId | openPlan alignment vocabulary + rejection of rotation-blind rect | independent Museum test |
| **H2-F14 alignment no-op** | already aligned operation writes no document/history | Museum deterministic history contract; openPlan gap | Museum regression |
| **H2-F15 guide lifecycle** | Esc, pointer cancel, commit, tool change, Layout↔Arrange and Plan→3D clear feedback | LibreCAD preview/action lifecycle | STUDY-derived independent test |
| **H2-F16 visual/selection isolation** | marker/guide cannot alter `resolvePlanHit`, `resolveArrangeHit`, selection, JSON, compiled geometry or history | Museum architecture + LibreCAD separate overlay grammar | Museum contract test |
| **H2-F17 door symbol truth** | no directional leaf/swing is rendered without authored semantics; opening gap/jamb stays | current `PlanSvg.svelte` mismatch + P23.6 contract | Museum render regression |
| **H2-F18 visual hierarchy matrix** | walls/openings/rooms/objects/passive footprints/selection/snap/preview/invalid remain distinguishable at 50/100/200 px/m and all shipped themes | openPlan visual grammar + current Museum Plan/theme seams | Museum component/visual gate |

### Reuse current Museum fixture sources

Prefer existing compiler/query fixtures:

- `apps/editor/tests/layout/__fixtures__/layout-g2-fixtures.ts`
  - `g2LineRectangleDocument`
  - `g2AutoBezierDocument`
  - `g2MultipleOpeningsDocument`
  - `g2ObjectMatrixDocument`
- `apps/editor/tests/lib/editor/layout/plan-hit.test.ts`
- `apps/editor/tests/lib/editor/layout/arrange-hit.test.ts`
- `apps/editor/tests/lib/editor/layout/layout-plan-transform.test.ts`
- `apps/editor/tests/lib/editor/layout/layout-object-editing.test.ts`
- `apps/editor/tests/lib/layout/plan-render-model.test.ts`
- `apps/editor/tests/lib/layout/plan-render-boundary.test.ts`
- theme registry/controller tests referenced by P23.6

Integration fixtures should compile a real `LayoutDocument` through `compileLayoutGeometry()` and feed `geometry.queries` into the resolver. Hand-built query inputs are fine only for narrow resolver unit tests.

---

## 10. Source → Museum mapping

| Harvest finding | Museum seam | H2 mapping |
|---|---|---|
| reference candidate generation | `CompiledLayoutGeometry.queries` + new pure editor resolver | ADAPT; no new geometry truth |
| fixed CSS-pixel catch | Layout Plan event/viewport adapter | convert px→world once; independent of grid |
| deterministic winner | pure resolver | **umbrella order preserved:** context → semantic → distance → stable key |
| endpoint/corner | compiled `vertex` points | direct canonical source |
| opening edge | compiled opening interval/spans | context-scoped canonical source |
| nearest wall/span | `projectPointToSpans()` | direct canonical source; no resampling |
| midpoint | authored straight segment identity + compiled endpoints | one midpoint per authored straight wall, not tessellation chunk |
| intersection | eligible compiled spans | deterministic derived runtime candidate |
| orthogonal | active gesture anchor + canonical query references | transient editor candidate |
| grid | `snapToGrid()` with one effective Layout grid step | fallback only |
| guide/marker | `plan-overlays.ts` / `PlanInteractionProjection` | transient renderer-neutral primitives |
| Plan draw | `PlanRenderModel` → `PlanSvg.svelte` | transform/style only |
| alignment | compiled object/room bounds + straight-wall query + existing Layout transaction | one target → one ref |
| selection | existing `resolvePlanHit()` / `resolveArrangeHit()` | KEEP AS-IS; snap never selects |
| preview cleanup | `LayoutInteractionState` / component-local runes + cancellation seams | no persistence/history |
| Plan grammar | existing Plan render model / SVG / chrome | presentation only |
| theme treatment | `plan.css` / `tokens.css` / theme tests | shared Plan semantic tokens only |

---

## 11. Explicit not-to-import list

### LibreCAD

Do not import or recreate as a parallel subsystem:

- GPL source/test text;
- Qt action inheritance / `RS_Snapper` architecture;
- LibreCAD document/entity classes;
- visual-snap manager/solution object graph;
- overlay entity containers as a second Plan model;
- UCS/relative-zero system;
- full tangent/normal/ray/distance snap vocabulary;
- grid-cell-coupled acquisition policy;
- implicit function-call order as Museum snap semantics.

### openPlan3D

Do not import:

- monolithic `FloorPlanCanvas.svelte` interaction/render authority;
- Canvas2D as a second Museum Plan renderer;
- duplicate component-local + utility snap resolvers;
- render/source-array order as snap truth;
- per-type independent hit helpers as Museum's cross-type selection system;
- consumer curve sampling for snap/hit geometry;
- Svelte-store reads/writes inside alignment algorithm;
- openPlan furniture/project data semantics into `LayoutDocument`;
- multi-selection alignment/distribution into P23.2;
- persistent guide entities into P23.2;
- upstream hardcoded colors/units;
- room AABB width/depth displayed as exact dimensions for arbitrary rooms.

### Museum boundaries that remain hard

- `LayoutDocument` stays authored architecture/Layout-object truth.
- `SceneDocument` stays separate; Arrange can read references without cross-owner writes.
- room-local transforms and explicit room ownership stay authoritative.
- `compileLayoutGeometry()` remains the single layout compiler.
- Plan/SVG consumes compiled/render-model geometry and does not resample/reinterpret architecture.
- canonical selection/history remain deterministic and separate from snapping.
- one completed mutation/gesture produces one correctly tagged history result.
- snap/guide/preview state is session-only and never serialized.
- visitor runtime never imports editor snapping, selection, guide, Inspector or history infrastructure.

---

## 12. Recommended refinements to P23.2

Record during P23.2 reconciliation; **do not edit the plan in H2**.

1. **Keep the umbrella comparator unchanged:** `tool/context validity → semantic priority → screen distance → stable ID/key`.
2. Make semantic rank an explicit per-context table; never infer it from candidate generation order.
3. Pin the first implementation to **8 CSS px acquisition**, centralized; grid step never affects it. Treat 8 px as a QA-tunable implementation default, not new durable product truth.
4. Defer hysteresis/release radius until a failing interaction/visual fixture proves it necessary.
5. An acquired valid reference beats grid; do not re-grid the winning reference coordinate.
6. Keep the snap candidate/result type editor-runtime only unless a real shared caller later justifies a deeper `layout-core` abstraction.
7. Require moving-source exclusions by stable IDs for every gesture adapter.
8. Use compiled spans/query functions for curved nearest behavior; Plan never resamples curves.
9. Straight-wall midpoint is the authored wall midpoint, not each compiler subspan midpoint.
10. Opening-edge candidates are context-scoped and derive from canonical compiled opening intervals.
11. Keep alignment reference picking transient and selection-neutral.
12. Keep alignment one selected object → one explicit reference; multi-select/distribute deferred.
13. Alignment uses rotation-aware world bounds, preserves ownership/3D-preserved state, one Layout transaction, no-op = no history.
14. Snap off disables both coordinate snapping and snap guide/marker feedback.
15. Add lifecycle tests and explicit Camera Plan isolation tests, not coordinate math alone.

---

## 13. Recommended refinements to P23.6

Record during P23.6 reconciliation; **do not edit the plan in H2**.

1. Add a compact semantic snap/guide presentation vocabulary through `PlanInteractionProjection` / `PlanRenderModel`; no direct component-owned geometry truth.
2. Winner-only snap feedback by default. No always-on candidate cloud in the P23 minimum.
3. Use marker shape/pattern + shared Plan ink, not a new hue family, to communicate feature kind.
4. Keep markers/guides screen-constant and pointer-inert.
5. Adapt dimension grammar: offset line, extension lines, compact ticks, readable label gap/halo, simple presentation-only edge avoidance.
6. Restrict room dimensions to truthful rectangular cases.
7. Explicitly remove/suppress the current invented directional door leaf/swing until handedness/swing semantics are authored.
8. Keep decorative opening graphics separate from compiled opening hit/snap geometry.
9. Keep current major/minor grid LOD and Plan paper system; tune styling only.
10. Exercise all shipped themes and representative 50/100/200 px/m zooms.
11. QA selection + hover + snap + preview + invalid together so states cannot be confused.
12. Prefer semantic class/token/component assertions plus non-mutation tests; pixel snapshots are supplementary, not the only gate.

---

## 14. H2 closeout

H2 supplies the required evidence for later P23.2 and P23.6 reconciliation.

Recommended architecture remains intentionally small:

```text
CompiledLayoutGeometry.queries
        + transient gesture context
                  ↓
          pure Plan snap resolver
                  ↓
      one snapped point + guides
         ↙                    ↘
existing Layout transaction   PlanInteractionProjection
                                      ↓
                               PlanRenderModel
                                      ↓
                                PlanSvg.svelte
```

No new document model. No second geometry compiler. No second selection system. No persistent constraint/guide model. No Canvas/Three Plan renderer. No Scene/Camera ownership crossover.

**P23-H2 complete. Stop here.**
