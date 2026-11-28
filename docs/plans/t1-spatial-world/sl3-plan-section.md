# T1 SL3 — Face the cut and Section (`layout.section@1`)

Authority: [sl-plan-slice.md](sl-plan-slice.md) §1–§6 (inherited, not repeated) and §4 (SL3
architecture, settled here); [implementation-prs.md](implementation-prs.md) Lane SL row SL3 and
its acceptance; [README](README.md) §Slice; [creator-journeys.md](creator-journeys.md) J12. Design:
[design system](../../design-system.md) (temporary-reading pill, Put back, Escape ladder, Paper
ink, Dimension line, selection gold). Domain: [layout.md](../../reference/layout.md) (typed streams,
identity through Section, finite depth, reasoned membership). Camera:
[camera.md](../../reference/camera.md) (one authority). Precedents followed, not re-derived: A6 Face
(`wall-face-store.ts`), V3c's roof-local Section reading (`adapters/layout/region-section.ts`), the
Unroll sheet (`StageWallDevelopment.svelte`) and Paper (`paper-plan.ts`, `paper-marks.ts`).

SL3 lands as three PRs. This file is their shared plan and is deleted when SL3c merges.

Labels, as in the SL plan:

- **Verified**: true on `main` at `b9617fdf0`, read in the code.
- **Approved**: required by the documents above. Not open to change here.
- **Decided**: this plan's engineering choice. The implementer follows it. Changing one needs a
  stop.
- **Owner**: a presentation choice with no approved visual target. The owner accepted every one as
  written (§J).
- **Assumption**: reasoned but not proven. Each names how and when it is validated.

## Goal and acceptance

**Approved** (implementation-prs.md SL3, README §Slice):

- **Face** and **Section** exist only while a drawn Slice does.
- **Face** squares the one Camera to the cut through A6's `face` intent.
- **Section** is a flat, measured 2D reading of the cut, built from Layout's typed streams. Every
  Section primitive selects its canonical source.
- **Put back** returns to the entry pose.
- Slice and Section remain session state: never serialized, never in history, Preview, snapshots
  or releases, and Undo never changes them.
- No format change. No second Camera authority. Not a sideways render.

**This plan adds the following, all Decided:**

- `layout.section@1` is a measured analytic evaluator in layout-core. It has typed `cut`,
  `projected`, `hidden` and `symbol` streams, canonical `PlanSourceRef` correspondence and one
  membership row per source with a reason.
- Its parameters derive from the live drawn Slice, including its finite depth.
- It reads these sources correctly:
  - straight and curved Walls;
  - every resolved Junction kind;
  - rectangular and arched Openings;
  - profiled Wall tops (V2);
  - floor Regions;
  - flat, shed and gable overhead Regions (V1, V3);
  - Space boundaries (SP1, SP2).
- It reuses canonical compiled geometry and the landed analytic evaluators. It never reads a
  rendered mesh.

## Slices

| Slice | Delivers | Depends | Independently useful because |
| --- | --- | --- | --- |
| **SL3a** Face the cut | Pill **Face**. Face through A6's `face` intent. Put back and Escape restore the entry pose. Flip re-faces | SL2, A6 (landed) | J12 step 4 ("Face squares her to it") needs only this. It is small, editor-only and is the user-visible half of SL3 |
| **SL3b** `layout.section@1` | The evaluator, the Wall-band and strip-patch seam, `sectionParametersOf`, and the full fixture catalogue | SL2 (landed) | A geometry contract that is reviewed and proven on fixtures alone, with no UI. It is the largest risk in SL3, so it is isolated from presentation churn. Later V-slices and any export path consume it |
| **SL3c** Section reading | Pill **Section**. The Paper sheet on the cut plane, picking and selection correspondence, dimension marks and browser QA | SL3a, SL3b | Completes the Approved SL3 acceptance |

SL3a and SL3b touch disjoint files and can proceed in parallel. They share one file, `slice-cut.ts`:
SL3a doesn't edit it and SL3b adds one function. SL3c starts after both merge. A further split was
considered and rejected:

- **Walls apart from Regions.** Rejected. Both feed one visibility pass, and either half alone
  would read occlusion wrongly.
- **Dimensions apart from the sheet.** Rejected. The sheet without measured marks fails "flat,
  measured".

## Verified current behavior

1. **Camera `face`** (`camera-core/src/viewport/pose.ts:287`, `facePoseFromBounds`).
   - Frames the AABB of `bounds` projected on the derived right and up axes. Accepts zero thickness
     (refuses only `min > max`).
   - Refuses a near-vertical `look`. Clamps the target-plane height to [0.05, 1000] m. Default
     padding is 0.1.
   - Always realizes a perspective `3d` reading with the target at the bounds centre. A plane faced
     square-on is therefore drawn as a similarity: one uniform px/m across it.
2. **A6 Face reading** (`authoring/layout/wall-face-store.ts`). One reading `{wallId, entry}`.
   - `face()` captures `entry` on every call. `reframe()` keeps it. `putBack(key)` refuses with
     `not-facing` when the key differs. `clear()` drops it without moving the Camera.
   - Keys in use: Wall ids, `floor:<roomId>` and `region-section:<regionId>` (V3c).
   - The route's port (`readings/wall-face-host.svelte.ts`) submits plain `face` on the whole
     canvas rect. It uses `fit` only for Align.
3. **V3c roof-local Section** (`adapters/layout/region-section.ts`). An editor reading of one
   Region's form.
   - Heights come from `regionUndersideAt` / `regionFormProfile`.
   - It faces through the same store, with the `region-section:` key, a `WallFaceFrame {bounds,
     look}` and plain `face`.
   - It is the closest landed precedent for Face the cut.
4. **Drawn Slice.**
   - `ResolvedSlice` drawn is `{origin, along, hiddenNormal, halfLength, depthMeters, start, end}`.
   - The visible slab is `0 ≤ −(p−origin)·hiddenNormal ≤ depth` within `|(p−origin)·along| ≤
     halfLength`.
   - Minimum length 0.1 m, minimum depth 0.1 m. `planOverridesOf` returns `{}` for drawn cuts.
   - Pill (`readings/slice-host.svelte.ts`): `{mode:'drawn', cutLabel, depthLabel, onFlip,
     onPutBack}`. `StageModePills.svelte` renders `data-slice-depth`, `data-slice-flip` and
     `data-slice-put-back`. It has **no Face or Section yet**.
5. **SL1/SL2 caps are mesh sections** (`slice/mesh-plane-section.ts`, `slice/slice-section.ts`).
   The second says analytic Section is out of its scope. SL3 does not reuse them for semantics. It
   uses them only as a differential oracle (§C.9).
6. **`layout.plan@1`** (`plan/representation/types.ts`).
   - Streams: `cut` / `projected` / `hidden` / `symbol`.
   - Refs: `PlanSourceRef {sourceId, sourceKind, generationId, stream, subRef}`.
   - Kinds: `wall`, `opening`, `object`, `room-floor`, `region`.
   - Reasons have no `outside-crop`. layout.md already names it.
   - Plan's `streamFor` places solids wholly above the cut in `projected`, but Regions above the
     cut in `hidden`. Section must define its own stream meaning rather than inherit that rule.
7. **V3b strip** (`room/region/wall-strip.ts`, `compiledWallStrip`).
   - The canonical plan body of one Wall:
     - **Cells**: ruled quads between stations made of compiled samples plus Wall-top knots over
       the resolved span. They are linear in top.
     - **Patches**: convex Junction-owned polygons (wedges, keels) at one constant top.
   - It carries top only: no Opening bands. A wedge is solid only to its highest both-solid band
     (`bothSolidTop`).
   - It states the curved-cell bound `half·(1−cos(dθ/2))` between the strip and the mesh's
     render-only knots (Verified 22).
8. **Wall vertical bands** (`geometry/openings.ts`).
   - `sections` are `side` (full height, or a sill when it carries `openingId`) and `lintel`
     (optional arch `profile` and `profileBaseY`).
   - Each `topY` is the span **maximum**. The true top is `compiledWallTopAt(topProfile, s)`
     (`wall/wall-top.ts`).
   - The arch bottom is `profileBaseY + archProfileTopAt(profile, s − start)`
     (`geometry/rooms.ts`, `archBottom`).
   - Compiled leg joins carry their own resolved `bands` and keels carry `keel.bands`
     (`geometry/types.ts`).
9. **Regions** (`geometry/types.ts`).
   - `CompiledRegion` carries canonical planar `faces {surface: top|underside|edge, polygon: Vec3[],
     normal}`.
   - `regionUndersideAt` / `regionTopAt` (`room/region/form.ts`) are the shared evaluators.
   - Plan's `region-section.ts` partitions a sloped Region at a horizontal cut through
     `partitionRegionForm`.
10. **Spaces.** `CompiledRoom` has:
    - `floorElevation` and `ceilingElevation`;
    - `overhead: closed | open-to-sky`;
    - `openSides?`: virtual edges, never Walls or pick targets;
    - `floorPolygon`.
11. **Layout objects.** Kinds are `box | plane | cylinder | sphere | profile`, with `rotation: Vec3`,
    `worldAabb` and `planFootprint`. Plan represents them by `planFootprint`.
12. **Correspondence.** `layoutSelectionReference(ref, snapshot)` (`stage/semantic-selection.ts`)
    maps any `PlanSourceRef`:
    - `room-floor` maps to its Room;
    - a `component` subRef maps to its `componentId`.
13. **Picking.**
    - `resolveStagePick` (`stage/stage-pick.ts`) takes the nearest finite `depthMeters` in 3D,
      with a 1 mm tie band, and `planLayer` in Plan.
    - `StageDomainPick` carries a `refusal` (`facade/adapter-contract.ts`).
    - The Layout adapter composes its provider at `adapters/layout.adapter.ts:67`.
14. **Paper.**
    - `PaperPlanDrawing {lines, fills, footprints}` is keyed by `sourceId`.
    - `createPaperScene(drawing)` places entries at `(x, elevation, z)`.
    - `paperMarkSet` filters that drawing by the selected identity for gold and hover ink.
    - Fills are unioned for display only (`paper-fill-geometry.ts`).
15. **Measure** draws the design system's Dimension line in `StageOverlay.svelte` (`dimensionTicks`,
    `.mark.dimension`) with `formatMeters`.
16. **Budgets** (`tools/metrics/budgets.json`) are a shrink-only ratchet.
    - `plan-pick-provider.ts` (642 lines) has its own entry.
    - `StageOverlay.svelte` is 573 lines and `slice-cut.ts` is 511.
17. The Card's **Section through here** stays disabled (README §1). It needs a cut placed from a
    Card, which is outside SL3.
18. **Camera face basis and projection.** `facePoseFromBounds` sets `backward = −look` and
    `right = normalize(up × backward)` with `up = (0, 1, 0)`, and `screenUp = backward × right`.
    `projectWorld(point, evaluation, token)` (`camera-core/src/viewport/projection.ts`) projects
    through the evaluation's own `viewProjectionMatrix`, built by `evaluateViewport`. The drawn
    normal is `drawnHiddenNormal(a, side)` (`slice-cut.ts`): `right` gives `n = (−a_z, 0, a_x)`.
19. **Exact concave partition already exists.** `room/region/form-partition.ts` ear-clips a cleaned
    footprint into convex pieces, splits them at a level of an affine field with `splitAtLevel` (each
    crossing computed once per undirected edge, so neighbours share it; a side that only touches the
    level gets no piece), and merges them back with `boundaryLoops` into maximal simple loops,
    splitting at pinch vertices. Plan's sloped-Region section and the V3 face compiler both use it.
    `cleanRing` and `earClip` are private. Region footprints are single rings, without holes.
20. **The drawn Slice hides only inside its crop.** `sliceHides` is
    `|s| ≤ halfLength && (b > 0 || b < −depth)`. Content beyond the crop is drawn as usual.
21. **SL2 caps use the same evaluated line.** `mesh-plane-section.ts` moves the plane
    `LAYOUT_SLICE_CONTACT_METERS` into the kept, visible half-space before sectioning, and welds cap
    vertices at `SECTION_WELD_TOLERANCE_METERS = 5e-5`.
22. **Compiled vertical profiles are piecewise linear.** Wall tops are `level | slope | gable` in
    station (`wall/wall-top.ts`). Arch heads are compiled `topBoundary` polylines of 16 chords of
    the authored curve, which `archProfileTopAt` interpolates linearly. The strip header bounds the
    Wall mesh's render-only knots: they move a curved face by at most `half·(1−cos(dθ/2))` relative
    to the strip. That is a strip-versus-mesh bound, not a bound against the authored curve.

## A. Challenged assumptions

Blueprint §4 was written before V1–V3 and SP landed. Each line below is now **Decided**.

| Blueprint said | Now | Why |
| --- | --- | --- |
| Wall cut regions from compiled `sections` / `solidSpans` | From the **V3b strip** pieces plus per-station **bands** from `sections`, `topProfile` and arch profiles | `solidSpans` are chord boxes, and their `topY` is a span maximum. Both are wrong for profiled tops (V2) and curved Walls. The strip is already the certified canonical plan body |
| Curved Walls "at their compiled samples" | Exact at samples, Opening edges, top knots and arch knots. Linear between, within the strip's stated bound | That is the canonical body's own precision. The mesh is no better |
| Room floor/ceiling lines | **Space** fill, floor line and lid line, plus open-side marks. **Slabs and roofs come from Regions** | Since V1, physical thickness belongs to Regions ("Thickness cutover", V-plan). Spaces describe enclosure. SP added `open-to-sky` and open sides |
| Projected Walls and objects behind as silhouettes | Planar **faces** with exact visible-line classification. `projected` is what is seen and `hidden` is what is occluded | V3 roofs present sloped surfaces in elevation, and V2 tops vary along a Wall. A silhouette alone misreads both. The `hidden` stream needed a meaning: Plan's own rule (Verified 6) does not transfer |
| "`PlanSourceRef`-shaped refs" | **`PlanSourceRef` itself**, unchanged | Every Section source kind is a Plan kind (V1 added `region`). `layoutSelectionReference` then works untouched |
| Section in "a dedicated frame" | A Paper **sheet on the cut plane** in the one Stage Canvas | §B.2 |
| Face bounds "slice extent × visible height" | Extent × the compiled Layout's vertical bounds. Plain `face`, as A6 and V3c | §B.5 |
| `outside-crop` added, and otherwise Plan's reasons | The same five-reason vocabulary as layout.md. The removed side is `outside-depth`, because depth is the range `[0, D]`. `outside-span` is never emitted | layout.md names exactly one membership stage and its reasons. No new reason is needed |
| Caps for drawn cuts are SL2's mesh sections | Kept for SL2. Section never reads them. They become a differential oracle | User constraint: semantics never come from meshes |

## B. Resolved §4 decisions

### B.1 Module ownership (Decided)

- `layout.section@1` lives in a new folder, **`packages/layout-core/src/plan/section/`**. It sits
  beside `plan/representation/` and is published through a sibling barrel,
  `plan/section-representation.ts`. It is re-exported from `@portfolio/layout-core/world`, as Plan
  is.
- **Shared with Plan:** `PlanSourceRef`, `PLAN_STREAMS`, `PLAN_SOURCE_KINDS`, the membership-reason
  vocabulary, `compareSourceIds`, `createPlanBoxIndex` and the work observer.
- **Not shared:** Plan's candidates, membership pipeline and retainer. A Plan candidate is a plan
  footprint with one vertical extent. It cannot express bands that vary by station or faces that
  vary by depth. Section evaluates whole per `(generation, parameters)` over sources pre-filtered to
  the slab. A retained Section is admissible later and is not needed at SL3's scale (§F).
- The Wall seam stays in place:
  - `compiledWallStrip` is reused unchanged in shape.
  - Its patches gain an additive `bands` field (§C.2).
  - A new `wall-bands.ts` in the section folder reads the canonical bands at a station.
  - No V3b code moves.

### B.2 Shell placement (Decided, presentation is Owner O-1)

Section is a **Paper sheet drawn on the cut plane inside the one Stage Canvas**, viewed by the one
Camera.

- It has no panel, second viewport, dock slot or new pill component.
- The drawn pill gains **Face** and **Section** in PLATE's order: *depth · Flip · Face · Section ·
  Put back*.
- The sheet covers the cut's extent × the Layout's vertical range. It is opaque vellum, readable
  from the removed side and one-sided.
- It mounts only in the `3d` reading. In Plan it would be edge-on, so the toggle stays pressed and
  nothing is drawn.

Rejected alternatives:

- **A 2D frame in the shell.** It needs its own pan and zoom, which is a second navigation
  authority. It also needs its own pick path and takes attention off the world.
- **An orthographic Camera reading.** That is a second projection authority and the "sideways
  camera" §4 forbids.

The Unroll sheet is the precedent: a developed reading drawn in the world, faced through A6.

### B.3 Scale (Decided)

- Section geometry is in **world metres on the cut plane**: `u` along the cut, `v` = world Y −
  datum.
- When faced square-on, a perspective view of a plane is a similarity (Verified 1). The sheet then
  reads at one uniform scale: px/m = viewport CSS height ÷ the faced pose's target-plane height.
- Orbiting keeps every value true and only foreshortens the drawing. Face squares it again.
- **No ratio such as 1:50 is shown or stored.** A ratio is meaningless on a zoomable screen. It is
  admissible for a later export. Numbers come from dimension marks.

### B.4 Dimension marks (Decided rules, ink is Owner O-3)

The design system's **Dimension line** (dashed, end ticks) is drawn in `StageOverlay`, projected
from sheet points exactly as Measure is. Values are labelled in **Paper-ink mono**, not the dark
live Tag, which stays hover/drag-only. Every value is measured from evaluation fragments, never read
from a compiled property. Invariant: label = `formatMeters(|b − a|)` of the two fragment points it
spans.

| Selected source | Marks, in priority order |
| --- | --- |
| None | Overall cut extent (along the sheet's bottom). Datum level |
| Wall crossed | Its cut width along `u`. Its top `v` at each crossing end (one mark if equal within 1 mm). Sill and head of each crossed hosted Opening |
| Wall beyond, not crossed | Its visible top `v` at its two `u`-extremes |
| Opening | Sill `v`, head `v` (crown for an arch) and width along `u` |
| Region crossed | Underside and top `v` at each end of each cut interval (one pair when flat). Vertical thickness at the cut |
| Space crossed | Clear height floor→lid (closed). Floor level only (open to sky) |

- At most **6** labels.
- Vertical chains sit left of the subject's `u` range and horizontal chains sit below it.
- A label whose CSS box overlaps a higher-priority one is dropped. Dropping is deterministic.
- An excluded selection gets no marks.

### B.5 Face (Decided)

- `look = −hiddenNormal`, horizontal. The eye sits on the removed side, looking into the slab.
- `bounds`:
  - **x/z**: the AABB of `start` and `end`. Zero thickness is legal (Verified 1).
  - **y**: the compiled `geometry.bounds` Y range, widened to include the datum. With no bounds,
    use `[datum, datum + 2·halfLength]`.
- Plain whole-canvas `face`, as A6's Face this wall and V3c's Section.
- The store key is `SLICE_FACE_KEY = 'slice:drawn'`.
- **First press:** `wallFace.face(...)` captures the entry. **While faced** (`isActive(key)`):
  `wallFace.reframe(...)`, so the entry is kept.
- **Flip while faced re-faces** from the new removed side and keeps the entry.
- A replaced drawn Slice keeps the Face reading. Put back still returns to the first entry.
- Another Face (a Wall, a floor, a Region section) replaces the one reading, as A6 already does.
  Slice Put back then ends the Slice without moving the Camera.

### B.6 Put back, Escape, lifecycle (Decided)

- **Put back** (pill or Escape step):
  1. If `wallFace.isActive(SLICE_FACE_KEY)`, call `wallFace.putBack(SLICE_FACE_KEY)`.
  2. Then call `sliceReading.putBack()`.
  3. The Slice always ends. A refused Camera return shows the notice *"The view could not return.
     The Slice is put away."*
- The Escape ladder is unchanged (`… selection → Lift → Slice`). Section adds no step, because Put
  back restores the exact prior standpoint and reading in one step (design system).
- Teardown, project replacement, the lens leaving World and Preview covering the Stage all clear
  the Slice. Each does `wallFace.clear()` **only if** the reading is the slice key, without a
  Camera move.
- **Section on/off** is a session flag beside the reading.
  - `sliceReading.setSection(on)` sets it, and the flag clears with the reading.
  - A replaced drawn reading keeps it. A Level reading has none.
  - Never persisted, in history or in Preview.

### B.7 Section implies Face (Decided, Owner O-2)

- Pressing **Section** submits Face when the slice key is not active. If the Camera refuses,
  Section stays off and the notice is *"This cut can't be faced from here."*
- Turning Section off leaves the Camera where it is.

### B.8 Section is read-and-select (Decided)

- Section hits answer `select` and `hover`.
- A `tool` query on the sheet returns a refusal, `SECTION_EDIT_REFUSAL`: *"The Section is a reading.
  Edit in the Card, or press Section to put it away."* No press on the sheet starts an adapter
  gesture.
- Card edits stay live, and the Section re-evaluates per accepted revision.
- Measure on the sheet is admissible later.

### B.9 Occlusion and Scene boundary (Decided)

- **Section is Layout's reading.** Scene models, lights and artwork are not in `layout.section@1`.
  That is a declared loss: a Scene section is admissible later as its own unit and kind.
- The sheet is opaque. While it is presented, `resolveStagePick` takes an optional occluder depth.
  When a front-side ray hits the sheet, it drops domain winners farther than the sheet by more than
  1 mm. The Section's own hits are at the sheet depth.
- While Section is presented, the SL2 yellow plane, caps and ghost are not drawn. The sheet and its
  x-ray replace them. The clip stays.

### B.10 Reveal (Decided)

While Section is on, the primary selection is passed as `reveal`. Reveal acts only on the two
exclusions layout.md gives a Reveal affordance: `outside-depth` and `outside-crop`. They differ in
where the source already is, because the drawn Slice hides only inside its crop (Verified 20).

| | `outside-depth` | `outside-crop` |
| --- | --- | --- |
| Where the source is | Inside the crop strip, on the removed side (`w < ε`) or beyond the depth. The Slice hides it in the world | Wholly beyond `\|u\| = halfLength`. The Slice does not hide it: it stays drawn and gold-inked in the world beside the sheet |
| Geometry extent | Its whole body inside the crop strip `\|u\| ≤ halfLength`, at any `w`, with no depth clip. Projected along `normal` | None: no part of its body lies in the crop strip |
| Fragments | Every feature edge over that extent, in `hidden` with `revealed: true`, under the source's own roles. No cut, symbol or fill | None |
| Occlusion | Neither occludes nor is occluded | – |
| Membership | Reason unchanged, `revealed: true`, `eligible: true`, `depthRange` set (`near` may be negative) | Reason unchanged, `revealed: true`, `eligible: true`, `cropOverhangMeters` set |
| Presentation | X-ray `hidden` ink on the sheet in selection gold | Nothing on the sheet. The world shows the source |
| Picking | Section pick at the lowest stroke priority (D.2). Selects the same source | Nothing on the sheet |
| Dimensions | None | None |

Every fragment therefore lies inside the crop strip, revealed or not (N5). `bounds` excludes
revealed fragments, so selecting never changes the sheet's extent. A recovery action that widens the
depth or the cut is admissible later.

## C. `layout.section@1` contract and geometry (SL3b)

### C.1 Types (Decided)

```ts
// packages/layout-core/src/plan/section/types.ts
export const LAYOUT_SECTION_REPRESENTATION = 'layout.section@1';
export const SECTION_MEMBERSHIP_REASONS = [
  'included', 'filtered-type', 'outside-depth', 'outside-span', 'outside-crop',
  'no-meaningful-projection',
] as const; // the layout.md vocabulary; `outside-span` is never emitted by Section
export type SectionMembershipReason = (typeof SECTION_MEMBERSHIP_REASONS)[number];

/** All in project-world metres, plan XZ; the section frame is right-handed (C.3). */
export type SectionParameters = {
  readonly origin: LayoutVec2;            // a plan point on the cut line
  readonly along: LayoutVec2;             // unit; +u (sectionParametersOf: screen-right when faced)
  readonly normal: LayoutVec2;            // unit, ⟂ along, toward the REMOVED side (= hiddenNormal)
  readonly halfLength: number;            // finite > 0 — lateral crop |u| ≤ halfLength
  readonly depthMeters: number;           // finite > 0 — slab 0 ≤ w ≤ depthMeters
  readonly datumMeters: number;           // v = worldY − datumMeters
  readonly sourceKindFilter: readonly PlanSourceKind[] | null;
  readonly reveal: readonly string[];
};
export type SectionSourceContext = { readonly generationId: string };

export type SectionVec2 = readonly [u: number, v: number];
export type SectionFragmentGeometry =
  | { readonly kind: 'span'; readonly start: SectionVec2; readonly end: SectionVec2 }
  | { readonly kind: 'polyline'; readonly polyline: readonly SectionVec2[] }
  | { readonly kind: 'polygon'; readonly polygon: readonly SectionVec2[] };
export type SectionFragmentRole =
  | 'body' | 'void' | 'jamb' | 'sill' | 'head' | 'floor' | 'lid' | 'space' | 'open-side';
export type SectionFragment = {
  readonly ref: PlanSourceRef;                 // unchanged Plan type; stream ∈ PLAN_STREAMS
  readonly geometry: SectionFragmentGeometry;
  readonly membership: SectionMembershipReason;
  readonly role: SectionFragmentRole;          // presentation and dimension rules; never identity
  readonly depth: { readonly near: number; readonly far: number }; // w range; < 0 only when revealed
  readonly revealed: boolean;                  // B.10 x-ray; never occludes, never occluded
};
export type SectionSourceMembership = {
  readonly sourceId: string;
  readonly sourceKind: PlanSourceKind;
  readonly reason: SectionMembershipReason;
  readonly eligible: boolean;
  readonly revealed: boolean;
  /** w range of the source's plan body inside the crop strip, or null when none is. */
  readonly depthRange: { readonly near: number; readonly far: number } | null;
  /** How far the source's plan body lies beyond |u| = halfLength, or null when it meets the strip. */
  readonly cropOverhangMeters: number | null;
};
export type SectionEvaluation = {
  readonly representation: typeof LAYOUT_SECTION_REPRESENTATION;
  readonly generationId: string;
  readonly parameters: SectionParameters;     // echoed
  readonly streams: { readonly cut; readonly projected; readonly hidden; readonly symbol };
  readonly fragments: readonly SectionFragment[]; // deterministic order (C.8)
  readonly membership: readonly SectionSourceMembership[];
  readonly unmatchedRevealIds: readonly string[];
  /** Of non-revealed fragments only, so a selection never changes framing or dimensions. */
  readonly bounds: { uMin: number; uMax: number; vMin: number; vMax: number } | null;
};
export type SectionEvaluationResult =
  | { readonly kind: 'evaluated'; readonly section: SectionEvaluation }
  | { readonly kind: 'refused'; readonly code: 'invalid-parameters' | 'invalid-context';
      readonly issues: readonly PlanIssue[] };

export function evaluateLayoutSection(
  compiled: CompiledLayoutGeometry, parameters: SectionParameters, context: SectionSourceContext,
  observer?: WorkObserver,
): SectionEvaluationResult;
```

**Refusals** (`parameters.ts`, with paths):

- any non-finite input;
- `along` or `normal` not unit within 1e-9;
- `along·normal` not 0 within 1e-9;
- `halfLength ≤ 0` or `depthMeters ≤ 0`;
- an unknown or duplicated filter kind.

Nothing is normalized silently. Depth has no default: §1.1 makes a finite value required.

**Mapping** (`apps/editor/.../slice/slice-cut.ts`, SL3b):

- `sectionParametersOf(resolved)` is total over drawn readings and absent for Level.
  - `origin` is the segment midpoint.
  - `normal = hiddenNormal`.
  - **`along = up × normal`**, taken in 3D with Y up: `(0,1,0) × (n_x, 0, n_z) = (n_z, 0, −n_x)`,
    so in plan **`along = (n_z, −n_x)`**. Camera's face basis is `right = up × backward` with
    `backward = −look = hiddenNormal` (Verified 18), so `along` is exactly the faced view's
    screen-right. For SL2's `right` side, `n = (−a_z, a_x)` gives `along = a`, the segment
    direction. For `left` it gives `−a`, so Flip mirrors `u`. Revision 1 wrote `(−n_z, n_x)`. That
    is `normal × up`, and it would have mirrored every Section.
  - The correspondence is proved through Camera's own projection, not a re-derived basis (N16).
  - `halfLength` and `depthMeters` are SL2's.
  - `datumMeters` is the live datum, with filter `null` and reveal per B.10.
- layout-core never imports session types.

### C.2 The Wall body seam (Decided)

`compiledWallStrip` is reused for the plan body. Bands come from compiled data:

- **`wallBandsAt(wall, s)`** returns the ordered solid intervals `[bottom, top]` in wall-local Y at
  station `s`, with `T(s) = compiledWallTopAt(topProfile, s)` (or `height`):
  - `side` with no `openingId`: `[0, T(s)]`.
  - `side` with `openingId` (sill): `[0, min(sill, T(s))]`.
  - `lintel`: `[min(H(s), T(s)), T(s)]` when non-empty, where `H(s)` is `section.bottomY`
    (rectangular) or `profileBaseY + archProfileTopAt(profile, s − startDistance)`.
  - Empty and sliver bands (`< LAYOUT_GEOMETRY_EPSILON`) are dropped.
  - Each section's `topY` is never used as a top: it is a span maximum (Verified 8).
- **`wallBandBreaks(wall, sa, sb)`** returns every station in `(sa, sb)` where the band set or its
  slope changes:
  - section boundaries;
  - Opening edges;
  - arch `topBoundary` knots mapped to stations;
  - `compiledWallTopKnots`.
  The strip cells already split at top knots.
- **Patches gain `bands`.** This is additive on `WallStripPatch`, so V3b consumers ignore it:
  - for wedges, the both-solid intersection intervals that `bothSolidTop` already enumerates;
  - for keels, `keel.bands`.
  - `topY` stays `max(band.top)`, asserted.
  - No V3b output changes. `wall-extrema` fixtures stay byte-identical.

### C.3 Frame, evaluated line, slab and clipping (Decided)

- For plan point `p` and world Y `y`:
  - `u = (p − origin)·along`;
  - `w = −(p − origin)·normal` (depth behind the cut);
  - `v = y − datum`.
- **The evaluated line is `L_ε: w = ε`**, with **ε = `LAYOUT_SLICE_CONTACT_METERS` (1e-4)**. The cut
  is the exact intersection of the compiled body with the vertical plane over `L_ε`. This is SL2's
  cap plane (Verified 21). It resolves face-on cases the same way: a cut on a Wall face, a jamb
  station or a Region edge reads the visible side's material. `u` on `L_ε` is the same coordinate as
  on the drawn line. The sheet draws the cut at `w = 0`, and the 0.1 mm offset is never drawn.
- **What the offset costs.** This is declared behaviour, not an error. Section measures `L_ε`, not
  the drawn line. A value whose plan gradient across the cut is `g` differs from the same value read
  on the drawn line by `ε·g`:
  - a sloped top or Region height differs by `ε·slope`;
  - the `u` of a Wall face crossed at angle θ differs by `ε·cot θ`.
  Widths between parallel faces do not move. Every closed form in the tests is evaluated on `L_ε`.
- The **slab** is `|u| ≤ halfLength`, `ε ≤ w ≤ depth`.

**Clipping preserves components.** Every planar polygon is clipped by four affine half-plane fields:
`u + L`, `L − u`, `w − ε` and `D − w`.

1. **A 2D frame per face.** Every planar face is clipped in a 2D frame where it projects
   injectively, and is lifted back exactly:
   - non-vertical faces use plan `(x, z)` and are lifted by the face's plane, since `y` is affine in
     plan;
   - vertical faces use `(t, y)`, with `t` along the face's plan line.
   The four clip fields are affine in either frame.
2. **Convex subjects** use Sutherland–Hodgman. Convex ∩ convex is one convex piece, so S–H is exact
   for them and cannot bridge. Convex subjects are Wall quads, jambs, end caps, patch sides,
   triangles and most Region edge faces.
3. **Concave subjects** take the existing exact path (Verified 19). These are Region top and
   underside faces, a gable slab's chevron edge face, object footprints, and Region footprints for
   membership.
   - The subject is reduced to convex pieces by **`convexPiecesOf(ring)`**. This is a new additive
     export in `form-partition.ts` that wraps the private `cleanRing` and `earClip` and returns them
     as a keyed `LevelField`. Partition behaviour is unchanged.
   - Each field is applied with `splitAtLevel`, keeping one side. One `LevelField` is used per clip
     line, sharing the point map. The next field's values are computed for every point, earlier
     crossings included, from the same affine formula.
   - The kept pieces are merged back with `boundaryLoops`.
   - The result is **one simple loop per connected component**. A pinch vertex yields separate
     loops, and a side that only touches a clip line yields nothing. No zero-width bridge can arise.
4. **Provenance.** Every output edge carries its source, either an original edge or a clip field.
   An edge is clip-generated iff it is not part of an original edge, and it then lies on a clip
   level. It is never drawn, never a silhouette and never an occluder boundary. An original edge
   lying exactly on a clip line stays a feature edge.

Why not Sutherland–Hodgman everywhere? On a concave subject whose intersection with the slab is
disconnected, it returns one ring joined by zero-width bridges along the clip line. Those bridges
become false edges, corrupt the containment tests visibility relies on, and keep a ring alive where
nothing is in the slab. Revision 1 used it.

### C.4 The cut stream (Decided)

Cut fragments are emitted per source piece. They are never merged across pieces or sources.

| Source | Fragments | Exactness |
| --- | --- | --- |
| **Wall cell** | Intersect `L_ε` with the cell's plan quad to get the crossing `[P_in, P_out]`. Map each point to a station through the cell's own iso-station mapping. Split at `wallBandBreaks`. For each run and each band, emit a polygon whose bottom and top chains run from `u_in` to `u_out`. `subRef = {interval, start: s_min, end: s_max}` | Class **E** at every vertex (C.9). On straight cells `u(s)` is affine and every chain is E throughout. On curved cells the chains between vertices are class **C**. Interior breaks are found by monotone root-finding of `s` along the crossing. When the crossing runs along an iso-station (`\|s_out − s_in\| ≤ 1e-9`), no interior break is emitted and the run takes the bands of its half-open station interval `[s_k, s_{k+1})` |
| **Junction patch** | The line ∩ convex polygon gives one `u` interval. One rectangle per patch band. Owner is the strip's Wall at `end`, with `subRef: null` | Exact |
| **Opening crossed** | No poché in the void. A `symbol` fragment (role `void`): the void outline over the crossing, `[sill, head(s)]`, head following the arch knots | E against the compiled arch polyline (Verified 22). Section does not refine the compiler's 16 chords. On curved cells, as Wall cells |
| **Region** | The line ∩ footprint gives sorted intervals, with a half-open rule at vertices. The intervals are never bridged across a void, which is the V3c lesson. Underside `b(u) = regionUndersideAt(p(u)) − datum` and top `b + thickness`, with breakpoints where `q(p(u)) = qRidge` | E on `L_ε`: affine per ridge piece. The same evaluator as Plan, V3b and V3c |
| **Space** | The line ∩ `floorPolygon` gives intervals. For each one: a fill polygon `[floor, ceiling]` (role `space`, kind `room-floor`, stream `cut`); a `floor` span; a `lid` span unless `open-to-sky`; and at each crossing of an `openSides` edge, a `symbol` span (role `open-side`) from floor to ceiling. The fill is a **semantic** reading and never material (C.5) | E |
| **Layout object** | Footprint ∩ line gives intervals × `[worldAabb.min.y, max.y]` | **Declared approximation**: Plan's own footprint prism. Exact for yaw-only boxes |

- A crossing whose `u` width or `v` height is below `LAYOUT_GEOMETRY_EPSILON` is dropped. A point
  contact therefore makes no cut fragment.
- A plane lying inside a Wall (parallel crossing) yields the Wall's whole elevation as poché, voids
  excluded. This is correct, not a special case.

### C.5 Faces, edges, `projected` and `hidden` (Decided)

**Faces.** Each eligible source contributes **planar polygons** in 3D, clipped to the slab.

- **Walls, from strip cells × band runs:**
  - front and back vertical quads, which are planar because both side edges are vertical;
  - top faces, split into two triangles on a curved cell;
  - Opening reveal faces: jambs, and soffit strips per arch segment;
  - free-end caps.
- **Junction patches:** vertical quads on every polygon edge × band. Internal faces are not culled:
  they lie inside solid material and are occluded by its outer faces.
- **Regions:** compiled `faces`, which are canonical and planar.
- **Objects:** prism faces.
- **Spaces:** contribute no faces.
- **Not occluders:** faces whose projected area is below 1e-9 m², i.e. edge-on horizontals.

**Feature edges.** A face boundary edge is drawn unless one of these applies:

- it is clip-generated;
- it is shared with a **coplanar** face of the same source (`|n₁·n₂| ≥ 1 − 1e-9` and plane offset
  within 1e-6);
- it is a **smooth seam**: shared by two cells of one Wall face turning by
  `≤ SECTION_SMOOTH_SEAM_RADIANS = 0.2`, *unless the faces' facing signs `sign(n·normal)` differ*,
  in which case it is a silhouette and is drawn.

Ownership of edges:

- Opening void boundary edges (jambs, sill, head) belong to the **Opening** (kind `opening`, roles
  `jamb` / `sill` / `head`, `subRef` as Plan's `openingCandidate`).
- Every other Wall edge belongs to the Wall, with `subRef` set to the station interval of its piece.
- Region edges belong to the Region.

**Visibility.** All projection is orthographic along `normal` onto `(u, v)`, analytically.

- **Only material occludes.** Occluders are the faces above of eligible Walls, Junction patches,
  Regions and objects, plus their `cut` poché polygons at `w = ε`.
- **Never occluders:**
  - Space fills, floor lines and lid lines;
  - `symbol` fragments (Opening voids, open-side marks);
  - revealed sources;
  - edge-on faces.
- A Space is an enclosure reading, not material. An edge behind a Space fill is classified exactly
  as if the Space did not exist (N14). Presentation agrees: the fill is drawn at Paper's `roomFloor`
  rank, under projected and hidden ink.
- A point on an edge is **hidden** iff it lies strictly inside an occluder's projected polygon,
  inset 1e-9, and that occluder's affine depth there is `< w_point − 1e-6`.
- Per edge and occluder: a Cyrus–Beck interval for a convex occluder, or a sorted edge-crossing
  interval set for a simple polygon. Depth along the edge is linear, so there is one split point.
- Candidates come from `createPlanBoxIndex` over `(u, v)` boxes.
- The hidden intervals are unioned. Their complement is `projected`.
- A `hidden` piece that coincides with a `projected` piece of the same source (collinear, within
  1e-6) is dropped. No two fragments of one source and stream overlap collinearly.
- **Revealed sources** (B.10) get every feature edge over their B.10 extent in `hidden`, with
  `revealed: true`. They are neither occluders nor occluded.

The result is a measured elevation with typed hidden lines. It is computed from compiled faces, not
rasterized.

### C.6 Membership (Decided)

There is one row per compiled source of every admitted kind. The **plan body** is used for
membership:

- Wall: strip pieces;
- Opening: its host strip over `[offset, offset + width]`;
- Region: footprint;
- Space: `floorPolygon`;
- object: `planFootprint`.

Precedence follows Plan's order, depth before lateral, and the first failure names the reason:

1. **`filtered-type`**: the kind is not in the filter.
2. **`outside-depth`**: the body clipped to `ε ≤ w ≤ depth` is empty. This covers both the wholly
   removed side and beyond the depth.
3. **`outside-crop`**: the body clipped to the full slab is empty.
4. **`no-meaningful-projection`**: no fragment survives. Examples are a Space the line does not
   cross (declared: Spaces read only where cut) and a point contact.
5. **`included`**.

Rules on top of the precedence:

- `eligible = included ∨ revealed`. Reveal never rewrites the reason.
- `revealed` is true only for a reveal id whose source is `outside-depth` or `outside-crop`
  (B.10). A reveal id naming an `included`, `filtered-type` or `no-meaningful-projection` source
  changes nothing, and its row keeps `revealed: false`.
- `unmatchedRevealIds` reports reveal ids that name no source.
- `depthRange` and `cropOverhangMeters` are measured on the body clipped to the crop strip. They
  serve a later recovery action and have no UI in SL3.
- **Only eligible sources emit fragments.** This deliberately differs from Plan, which emits every
  source. It keeps the cost proportional to the slab, not the building, and makes the evaluator
  honest that excluded geometry was not computed.

### C.7 Stream semantics, stated once (Decided)

| Stream | Meaning in Section |
| --- | --- |
| `cut` | Material crossed on `L_ε` within the crop. Also Space fills (kind `room-floor`, role `space`), which are semantic and never occlude |
| `projected` | Visible feature edges of eligible sources within the slab |
| `hidden` | Occluded feature edges of included sources within the slab, plus every edge of a revealed source over its B.10 extent (`revealed: true`) |
| `symbol` | Opening void outlines at the cut and Space open-side marks |

This intentionally does not copy Plan's `streamFor` (Verified 6). The difference is recorded in
layout.md when SL3b lands.

### C.8 Determinism and identity (Decided)

- **Order:**
  1. kind, in `PLAN_SOURCE_KINDS` order;
  2. `compareSourceIds`;
  3. stream, in `PLAN_STREAMS` order;
  4. role;
  5. the first vertex, in `(u, v)` lexicographic order.
- Results are independent of compiled array order.
- No section-local ids. Every `ref.sourceId` names a compiled source, and `ref.generationId` is the
  context's.
- **No merging on selectable streams.** Display unions fills only.

### C.9 Numerical invariants (Decided, each has a test)

**Exactness classes.** Every row uses these words.

- **E (compiled-exact).** A value equals the closed form of the **compiled** body on `L_ε`. It is
  tested two ways:
  - as residuals: each vertex lies on its defining surfaces within 1e-9 m. This holds at any
    crossing angle, because it never divides by the angle;
  - by forward closed-form checks on fixtures whose crossing angle is at least 1e-3 rad.
- **C (chord).** Between two E vertices on a curved cell, a top or bottom chain is a chord of the
  monotone function `T(s(u))`. The compiled height there lies between the chord's endpoint values.
  Level tops and rectangular heads are therefore exact throughout. No tighter bound is claimed.
- **Not claimed: anything against authored continuous geometry beyond the compiler's own.**
  - Curved centrelines are compiled samples, and arches are 16-chord polylines (Verified 22).
  - Near a grazing crossing of a curved face, a crossing may exist on the compiled body and not on
    the authored curve, or the reverse. Along-line error there grows as 1/sin of the crossing
    angle.
  - Section shares this compiled-body meaning with Plan, V3b, V3c and the Wall mesh.
  - Revision 1's comparison against a 4096-sample reference body is withdrawn. The strip bound it
    cited is a strip-versus-mesh bound (Verified 22), and an along-line error is not bounded by any
    face displacement at grazing angles.

| # | Invariant |
| --- | --- |
| N1 | Parameters are refused unless orthonormal within 1e-9, finite, and positive where required |
| N2 | Straight Walls, Junction patches, rectangular Openings, compiled arch heads, `level`/`slope`/`gable` tops, flat, shed and gable Regions, and Spaces are class E on `L_ε` |
| N3 | Curved Walls: every vertex is class E. It lies on `L_ε` and on its cell edge or iso-station segment within 1e-9, and its bands equal `wallBandsAt(s)` within 1e-9 for the cell's own station `s`. Chains are class C. A crossing along an iso-station emits no interior break. Nothing is claimed against the authored arc |
| N4 | The evaluated line is `L_ε`. The crop is class E at `\|u\| = halfLength`. Slivers below `LAYOUT_GEOMETRY_EPSILON` are dropped |
| N5 | Every fragment, revealed or not, has `\|u\| ≤ halfLength + 1e-9`, and `v` within the Layout's Y bounds less the datum. Non-revealed depths lie in `[ε − 1e-9, depth + 1e-9]`. Revealed depths are unrestricted (B.10). `bounds` covers non-revealed fragments only |
| N6 | For a straight Wall with a level top, crossed away from its ends and Junctions at angle θ, the cut area equals `thickness / \|sin θ\| × solid height`, voids excluded, within 1e-9 relative |
| N7 | A Region's cut top and bottom at the `L_ε` point `p(u)` equal `regionTopAt` / `regionUndersideAt` within 1e-9 |
| N8 | (editor test, SL3b) Take V3c's `regionSectionOf` line through `q` (`adapters/layout/region-section.ts`) and evaluate with `origin = q + ε·normal`, so that `L_ε` *is* V3c's line. The joint plan points and heights then match within 1e-9 |
| N9 | For every Wall and station, the max band top equals the strip's top within 1e-12. A patch's `topY` equals its max band top |
| N10 | Output is identical under any permutation of compiled arrays. Under a rigid plan motion of the Layout and the cut together, `(u, v)` fragments match within 1e-9 relative to the Layout's extent |
| N11 | Flip moves `L_ε` by 2ε. With `flip(P)` evaluated at `origin − 2ε·normal`, which is the same `L_ε`, every fragment of every kind equals `P`'s with `u → −u`, within 1e-9. The pill's Flip keeps the origin, so it reads a line 0.2 mm away, and values move by at most `2ε·g` (C.3). That is declared, and a millimetre label may change at a rounding boundary |
| N12 | No fragment of one source and stream overlaps another collinearly. No `hidden` piece coincides with a same-source `projected` piece |
| N13 | (SL3c, editor) Differential against SL2 caps, which use the same `L_ε` (Verified 21), with τ = `SECTION_WELD_TOLERANCE_METERS`. **Same-body subset:** for straight Walls, rectangular and arched Openings on straight Walls, Junction patches, tops on straight Walls, and flat and sloped Regions, the per-source Hausdorff distance between analytic cut polygons and cap loops is ≤ 2τ. **Curved Walls:** each analytic cut vertex, lifted to world, lies within `δ + 2τ` of that source's mesh surface, and each cap vertex lies within `δ + 2τ` of the strip body, with `δ = half·(1−cos(dθ/2))` for the cell's turn. Point-to-surface distance stays well conditioned at any crossing angle. No area or along-line comparison is made. **Not compared:** objects (a declared footprint prism), Spaces (no mesh) and Scene content |
| N14 | Space fills never occlude. Removing every Space from the compiled input leaves every other source's fragments, streams and classifications identical |
| N15 | Clipping: for every clipped polygon, each output loop is simple, has positive area and is one connected component. The summed area equals the analytic area of polygon ∩ slab within 1e-9 relative. No edge lies on a clip line unless it is flagged clip-generated. There are no zero-width bridges |
| N16 | Screen-right, proved by Camera. Take drawn readings at eight headings, both sides and after Flip. Build the faced pose with camera-core `facePoseFromBounds({bounds, look: −hiddenNormal})`, evaluate it with `evaluateViewport`, and project `origin`, `origin + along` and `origin + up` with `projectWorld`. Screen x must increase along `+u` and CSS y must decrease along `+v`. In SL3c the same holds for the mounted sheet's local `(u, 0, −v)`, and its frame's determinant is +1 |

## D. Presentation (SL3c)

### D.1 Sheet

- `section-frame.ts` defines the frame:
  - basis `X = along`, `Y = normal` (toward the eye), `Z = X × Y = −up`;
  - a local point is `(u, 0, −v)`;
  - the group matrix places local `(0, 0, 0)` at `(origin, datum)`.
- `paper-section.ts` maps a `SectionEvaluation` to a **`PaperPlanDrawing`** in local `[u, −v]`
  coordinates at elevation 0. It uses `PAPER_LAYER` ranks and `PAPER_LINE_STYLE` treatments:

  | Fragment | Paper treatment |
  | --- | --- |
  | Space | `room-floor` fill (rank 10) |
  | Hidden edge | `hidden` (20). Only for the selection ∪ revealed sources (Owner O-4) |
  | Projected edge | `projected` (30) |
  | Cut poché | `cut` fill and stroke (40) |
  | Symbol | `symbol` (50), with `open-side` dashed |

- `StageSectionSheet.svelte` mounts, under that group:
  - an opaque vellum quad over the Face rect (§B.5), which depth-writes;
  - `createPaperScene(drawing)`;
  - `createPaperMarkScene(paperMarkSet(drawing, selection, hover, …))`.
- Paper's selection and hover ink therefore work unchanged. Dashes stay in world metres and widths
  in CSS px.
- The drawing is rebuilt when the evaluation, selection or reveal changes. That costs ≤ 1 build per
  change and none per frame. This deviates from Paper Plan's "stable across selection" rule,
  because the hidden x-ray depends on the selection.

**Verified and Decided (A-S1).** `createPaperScene` materials are `depthTest: false`,
`depthWrite: false` and set `STAGE_OVERLAY_LAYER` (`paper-scene.ts` 185–302): Paper Plan draws as an
overlay. On the sheet that would put ink over nearer Scene content. SL3c therefore adds **one additive
option**, `createPaperScene(drawing, …, { depth: 'world' })`, which leaves the main layer, enables
depth test and keeps depth write off for ink, ordered by `PAPER_LAYER` rank over the vellum.
The default stays the overlay path, so Paper Plan output is byte-identical. **Assumption:** that
option is enough — ink in front of vellum, vellum occluding the slab, and nearer Scene content still
in front. It is validated by SL3c step 1, a rendered fixture. Anything beyond the option is a stop
(§I.1).

### D.2 Picking and correspondence

- `authoring/layout/section-pick.ts`, composed at `layout.adapter.ts:67` as
  `withSectionPick(createPlanPickProvider(...), presentedSectionNow)`. `plan-pick-provider.ts` is
  untouched.
- `presentedSectionNow()` is a non-reactive mirror (`stage/section/section-resolved.ts`), the same
  pattern as `resolvedSliceNow`.
- On a front-side ray hit inside the sheet rect, the pick returns the best fragment:
  - **filled** (cut poché, Space): containment;
  - **stroked** (projected, hidden-when-drawn, symbol): CSS distance ≤ `PLAN_HIT_TOLERANCE_CSS_PX`,
    or 22 / 44 px for coarse pointers per the design system;
  - ranked by layer (symbol > cut > projected > hidden > revealed x-ray > Space fill), then
    distance. An x-ray stroke ranks above the fill, so clicking it keeps the selection instead of
    selecting the Room.
- The hit is `{sourceKind, sourceId, generationId, stream, subRef, worldPoint}`, so
  `layoutSelectionReference` resolves it unchanged.
- `depthMeters` is the ray distance to the sheet. Blank vellum returns no Layout hit, and the B.9
  occluder still blocks what is behind it.
- Selecting in Section selects in the world, Card and Index. Selecting elsewhere inks the same
  source's Section fragments through `paperMarkSet`.

### D.3 Evaluation scheduling

- `stage/section/section-evaluation.ts` keeps a one-entry memo keyed by:
  - compiled geometry identity;
  - `generationId`;
  - a value-equal `SectionParameters`.
- It evaluates only while Section is on. During Slice handle drags it evaluates at most once per
  animation frame. Undo and Redo reuse it by identity.

### D.4 Dimensions

- `stage/section/section-dimensions.ts` is pure: evaluation × selected ref → ≤ 6 marks of the form
  `{a, b, label, priority, axis}` in `(u, v)` (§B.4).
- `StageSectionDimensions.svelte` is a child of `StageOverlay`, added with a ≤ 5-line include. It
  projects the marks through the sheet frame and reuses `dimensionTicks` and `.mark.dimension`.
  Labels are in Paper-ink mono.
- Collision culling runs in CSS space.

## E. Implementation steps

### SL3a — Face the cut (branch `t1-sl3a-face-the-cut`)

**New:** `authoring/stage/slice/slice-face.ts` (≤ 120 lines), holding `SLICE_FACE_KEY`,
`sliceVerticalRange(geometry, datum)` and `sliceFaceFrame(resolved, range): WallFaceFrame | null`.

**Edited:** `readings/slice-host.svelte.ts`, `shell/StageModePills.svelte` and
`readings/layout-readings-feature.svelte.ts`.

1. `slice-face.ts`, with unit tests for:
   - look = −hiddenNormal and `look.y = 0`;
   - bounds for the E/W/N/S and 30° segments;
   - the zero-thickness AABB;
   - no Layout bounds;
   - face bounds: their projection on Camera's derived right axis is `halfLength` within 1e-9.
2. Pill: add `onFace` to the drawn arm. Add a **Face** button (`data-slice-face`) between Flip and
   Put back. The words are "Face" plus a title such as *"Square the view to the cut"*.
3. Host wiring:
   - Face goes through `wallFace.face` or `wallFace.reframe` per B.5.
   - Flip re-faces while faced.
   - `putBackSlice` follows B.6.
   - The lifecycle clears per B.6.
   - Refusal notices use the exact words above.
4. Tests:
   - pill render and click;
   - the entry captured on first Face, kept across a re-Face, an orbit, Flip and a redraw;
   - Put back deep-equals the entry `ViewportCameraState`;
   - Escape reaches the same path;
   - teardown and lens change clear without a Camera call;
   - A6 Face this wall replacing the reading, after which slice Put back only ends the Slice;
   - Preview round trip.
5. Browser QA (iPad width and desktop):
   - draw in Plan → Face → squared view;
   - orbit → Face → squared again;
   - Flip → re-faced from the other side;
   - Put back → the exact entry pose (camera-state readout in the PR);
   - Escape → the same;
   - a Face this wall interplay;
   - reduced motion;
   - a refused Camera notice, forced by an injected port in the test.

**Gate:** the editor lane's slice and face groups (run sequentially), `npm run test:arch`, `check`.

### SL3b — `layout.section@1` (branch `t1-sl3b-section-evaluator`)

**New** in `packages/layout-core/src/plan/section/`. Each file is ≤ 600 lines and each function
≤ 200 lines.

| File | Contents |
| --- | --- |
| `types.ts` | The C.1 types |
| `parameters.ts` | C.1 refusals |
| `frame.ts` | C.3: `u`/`v`/`w` and `L_ε`, line ∩ polygon intervals with the half-open rule |
| `slab-clip.ts` | C.3 clipping: convex Sutherland–Hodgman, the concave path through `form-partition.ts`, edge provenance |
| `wall-bands.ts` | C.2 |
| `wall-section.ts` | C.4 Wall/patch/Opening cut and C.5 Wall faces and edges |
| `region-cut.ts` | C.4 Region cut and C.5 Region faces |
| `space-section.ts` | C.4 Space |
| `object-section.ts` | C.4 object |
| `visibility.ts` | C.5 |
| `membership.ts` | C.6 |
| `evaluate.ts` | Orchestration and C.8 |

`plan/section-representation.ts` is the barrel. Edits:

- `world/index.ts` adds the exports.
- `room/region/wall-strip.ts` adds the patch `bands`, plus any station helper exports.
- `room/region/form-partition.ts` adds the additive export `convexPiecesOf(ring)` (C.3) and
  nothing else.
- `apps/editor/.../slice/slice-cut.ts` adds `sectionParametersOf`. That keeps the file under 600
  lines; a sibling `slice-section-parameters.ts` is used if it would not.

1. Types, parameters, frame and slab clipping. Refusal tests (F22). Clipping tests (F27–F31, F33,
   N15), including an unchanged-output check on the existing form-partition fixtures.
2. Patch `bands` (C.2), with N9 tests over the existing Junction fixtures and unchanged
   `wall-extrema` output.
3. `wall-bands.ts`, tested against `sections` for every Opening shape and profiled top, including
   the profile dipping under a head.
4. The Wall, patch and Opening cut (F1–F13, N2–N4, N6).
5. The Region cut, the Space and the object cut (F14–F17, N7, N8).
6. Faces, edges and visibility (F19–F21, F32, F34, N12, N14).
7. Membership and Reveal per B.10 (F18, N5).
8. Evaluate, order, determinism and invariance (F23–F25, N10, N11). Work observers count candidates
   and occlusion pairs, with bounded counts in tests. Wall-clock timing is not a gate (bench
   apparatus is disposable).
9. `sectionParametersOf`, with a property test: every SL2-reachable drawn reading (random
   segments ≥ 0.1 m, depths in [0.1, far], both sides) is accepted, and `along = (n_z, −n_x)`.
   Add the Camera projection proof (F35, N16).
10. layout.md gets the landed Section semantics (C.7) and the membership vocabulary as used.

**Gate:**

- layout-core `test` and `check`;
- the editor slice group;
- `npm run test:arch`, with new files admitted to the ratchets as additions and no thresholds
  raised.

### SL3c — Section reading (branch `t1-sl3c-section-reading`)

**New:**

- `authoring/stage/section/` with `section-frame.ts`, `section-evaluation.ts`, `section-resolved.ts`,
  `paper-section.ts` and `section-dimensions.ts`;
- `authoring/stage/shell/StageSectionSheet.svelte` and `StageSectionDimensions.svelte`;
- `authoring/layout/section-pick.ts`.

**Edited:**

- `slice-reading.svelte.ts`: the section flag;
- `slice-host.svelte.ts`: the pill's `onSection`/`sectionOn`, and the canvas and overlay
  contributions;
- `StageModePills.svelte`: **Section**, `data-slice-section`, `aria-pressed`;
- `StageSliceLayer.svelte`: hide the plane, caps and ghost while presented;
- `adapters/layout.adapter.ts`: compose the pick;
- `stage-pick.ts` and its facade caller: the occluder option;
- `StageOverlay.svelte`: the include;
- `paper-scene.ts`: the additive `{ depth: 'world' }` option (A-S1).

1. **Rendered fixture first** (A-S1). Using the perf Playwright config, mount a sheet on a known cut
   and assert:
   - ink pixels sit over vellum;
   - a slab cube behind is fully occluded;
   - a nearer cube outside the crop occludes the sheet.
   If this needs more than the additive option, **stop**.
2. Frame, evaluation memo and mirror (D.1, D.3), with unit tests for:
   - the local↔world round trip within 1e-12;
   - N16 on the mounted frame: `+u` is screen-right and `+v` screen-up through `projectWorld`, and
     the determinant is +1;
   - ray → `(u, v)`;
   - a front/back-side test;
   - the memo hit and miss counts.
3. `paper-section.ts`. Tests:
   - every fragment maps to exactly one drawing entry with the source's id;
   - hidden entries appear only for x-ray ids;
   - no entry merges sources.
4. Sheet component, pill **Section**, B.7 Face-on-Section, and the B.9 plane, cap and ghost
   suppression.
5. Section pick and occluder (D.2, B.8, B.9). Tests:
   - each fragment kind selects its canonical source through `layoutSelectionReference`;
   - Space fill selects the Room;
   - an Opening outline selects the Opening;
   - a Junction patch selects its owning Wall;
   - blank vellum blocks a Scene model behind it;
   - a back-side ray passes through;
   - a `tool` query returns `SECTION_EDIT_REFUSAL`;
   - **a press-drag starting on the sheet writes no history** (mounted gesture boundary).
6. Dimensions (B.4, D.4). Tests:
   - label = `formatMeters` of the fragment-point distance;
   - priority and collision culling;
   - no marks for an excluded selection.
7. Reveal (B.10). An `outside-depth` selection is drawn as x-ray inside the crop with its reason
   intact. An `outside-crop` selection draws nothing on the sheet and stays visible in the world.
8. Differential N13 against SL2 mesh caps: the same-body subset at 2τ, and curved Walls by
   point-to-surface distance.
9. Lifecycle:
   - Section never in history, dirty state, Save, snapshots or Preview;
   - reload drops it;
   - `test:arch` keeps visitor isolation (no `stage/section/**` or `layout/section-pick` reachable
     from `/p/[publicationId]` or visitor Preview).
10. Browser QA (§G).

**Gate:**

- the editor lane groups, run sequentially;
- `npm run test:arch`;
- `check`;
- the rendered fixture;
- QA evidence in the PR, following the V3c QA precedent.

## F. Performance (Decided)

- Section is evaluated only while it is on. Sources are pre-filtered by a box index over the slab
  rectangle. The cost is proportional to the slab's content.
- Occlusion pairs come from a `(u, v)` box index. Work observers assert bounds in tests: pairs ≤
  8 × edges on the 48-Wall gallery fixture.
- There is at most one evaluation per frame during handle drags and one per accepted revision
  otherwise. A still pointer does no work.
- A Paper rebuild happens per evaluation, selection or reveal change, never per frame.
- In QA, the faced Stage under a handle drag is checked for no visible stutter on the reference iPad
  profile. If it fails, that is a **stop**: report it, with no approximation shortcuts.

## G. Browser acceptance (SL3c, on the live Stage, iPad width and desktop)

1. Straight Wall cut square-on, with a door and a window:
   - poché gaps;
   - void outlines;
   - sill and head marks;
   - the Wall's cut width equals its thickness.
2. Oblique cut through an L mitre apex, a T, an X and a Y keel. The display fill is closed, and
   each piece selects its owning Wall.
3. Curved Wall crossed twice:
   - a curved Wall beyond shows silhouettes;
   - no seam lines;
   - its back half is hidden (x-ray when selected).
4. Gable-topped Wall (V2) crossed through its apex, and an arched Opening. The top polyline has
   the apex vertex, and the head follows the arch.
5. Floor Region crossed. Flat, shed and gable overheads crossed across and along the ridge, and
   exactly at the ridge. Heights match V3c's Edit-shape Section on the same Region.
6. Closed and open-to-sky Spaces, and a Space crossed at an open side (dashed mark). The Space fill
   selects the Room.
7. Round trip:
   - click in Section → world, Card and Index select the canonical source;
   - select in the Index → the Section inks it;
   - Undo leaves Section on and unchanged in history.
8. Selected-but-excluded:
   - beyond depth → x-ray on the sheet;
   - on the removed side → x-ray on the sheet;
   - outside the crop → nothing on the sheet. It stays drawn and gold in the world beside it.
   A Wall seen through a Space's fill keeps its projected ink.
9. Put back after orbit, Face, Section on/off, Flip and a redrawn cut → the exact entry pose.
   Escape does the same.
10. A Card edit (Wall height, Opening sill, Region rise) while Section is on updates the Section
    once per accepted revision. Nothing reaches history, dirty state or Save beyond the edit
    itself.
11. A drag on the sheet does nothing but select, and the refusal words show for a tool. A Scene
    model behind the sheet is not pickable.
12. Plan reading with Section on: no sheet. Back to 3D: the sheet returns. A Preview round trip and
    a reload drop it.
13. Coarse pointer: 44 px hit targets on Section strokes.

## H. Adversarial fixtures (SL3b unless marked)

| # | Fixture | Asserts |
| --- | --- | --- |
| F1 | Perpendicular cut through a straight Wall's middle | Cut rectangle is thickness × height, exact |
| F2 | Oblique 30° crossing | Width is `t/sin 30°`. N6 |
| F3 | Plane parallel to and inside a Wall with two Openings | Whole elevation as poché, voids exact |
| F4 | Plane on the near face. Plane on the far face | Cut. `outside-depth` |
| F5 | Plane exactly through an Opening jamb station | No sliver. Band switch at one `u`. `void` symbol present |
| F6 | Pointed and round arch | Head vertices equal `archProfileTopAt` at knots |
| F7 | V2 gable top crossed obliquely through the apex knot | Apex vertex present. Section `topY` not used |
| F8 | Profile dipping below a lintel head | Lintel band empty where `T(s) ≤ H(s)` |
| F9 | L mitre, cut through the apex line | Per-source pieces are closed and owned per the strip's `end` |
| F10 | T, X, Y-keel and both-open wedge | Patches present with bands. N9 |
| F11 | Wedge where one leg's Opening touches the Junction | Patch bands are the both-solid intervals: a void through the wedge |
| F12 | Curved Wall: two crossings and a grazing tangent | N3: vertices class E, chains class C. At the grazing tangent, the compiled-body result is checked by residuals only. No seams, one silhouette per side |
| F13 | Free Wall end inside the slab | End-cap edges drawn |
| F14 | Concave U floor Region crossed through its notch | Two intervals, no bridge |
| F15 | Shed oblique. Gable across, along and exactly at the ridge | N7, N8. Ridge vertex present |
| F16 | Line touching one footprint vertex | No cut fragment. `no-meaningful-projection` unless it is projected behind |
| F17 | Closed, open-to-sky and open-side Spaces. A concave `floorPolygon` crossed twice | Fill, lines and marks per C.4 |
| F18 | Removed side, beyond depth, outside crop, filtered, depth-and-crop both, reveal of each, unmatched reveal | Precedence. The reason is preserved under reveal. An `outside-depth` reveal is hidden-only with `revealed: true`, and its removed-side depths are negative. An `outside-crop` reveal emits no fragment. An `included` reveal changes nothing. N5 |
| F19 | Wall behind a Wall. A Wall seen through a nearer Opening. A roof surface occluding a Wall top. A curved back face | `hidden` exactly equals the overlap. Visible through the void, because symbols never occlude |
| F20 | Wall straddling the depth limit | Clipped, with no clip edge |
| F21 | Wall crossing the lateral crop | Clipped at `\|u\| = L` exactly, with no clip edge |
| F22 | Non-unit along, non-orthogonal normal, depth 0/NaN/∞, halfLength ≤ 0, duplicated filter | Each refused with its path |
| F23 | Shuffled compiled arrays | Deep-equal output |
| F24 | Rigid plan motion of the Layout and the cut | N10 |
| F25 | Flip, at the shifted origin and at the pill's unchanged origin | N11, both forms |
| F26 (SL3c) | The catalogue against SL2 mesh caps | N13 |
| F27 | U floor Region, both arms in the slab, base beyond the depth | Two projected components after the far clip. No edge along `w = D`. N15 |
| F28 | U shed overhead, arms straddling `L_ε`, base on the removed side | Two cut intervals. Two in-slab top and two underside components, each vertex on its face plane within 1e-9 |
| F29 | Comb (E-shaped) Region whose teeth cross the lateral crop | One component per tooth inside the crop. Crop edges not drawn |
| F30 | Spiral footprint whose slab intersection has three components, two meeting at a pinch vertex | Three simple loops, no bridge. N15 |
| F31 | Footprint vertex exactly on `w = D`, and an edge collinear with `u = L` | No zero-area piece, no duplicated edge. The collinear original edge is still drawn. Deterministic membership |
| F32 | A Wall behind the gap of a U gable roof, and one behind an arm | Projected through the gap, hidden behind the arm. A gap never occludes, which a bridged ring would break |
| F33 | Concave Region whose notch crosses the slab corner (`u = L` and `w = D` together) | Exact component areas. N15 |
| F34 | Space fill in front of Walls and a roof edge | N14 |
| F35 (SL3b, editor) | Screen-right at eight headings, both sides and after Flip | N16 |

## I. Stop conditions

Stop and report, without working around the problem, if any of these happens:

1. Rendering the sheet needs more than A-S1's additive Paper option, or a second drawing system.
2. A press on a Section hit can start an adapter gesture, and the press path cannot refuse it
   through the existing `refusal` and hit vocabulary.
3. Visibility or clipping needs a general polygon-boolean library, or any new dependency.
4. Adding patch `bands` changes any V3b output (`wall-extrema`, fits).
5. N13 fails beyond 2τ on the same-body subset, or beyond `δ + 2τ` point-to-surface on curved
   Walls. One of the two bodies is then wrong.
10. Reusing `form-partition.ts` needs more than the additive `convexPiecesOf` export, or changes
    any existing partition output.
6. `face` refuses a valid drawn cut, or Put back cannot reproduce the entry state exactly.
7. Anything needs a format or codec change, persisted Section or Slice state, a second Camera
   reading, an orthographic projection, a section-local identity, or a merged selectable stream.
8. QA shows drag stutter attributable to Section evaluation (§F).
9. A file or function would exceed the budgets with no cohesive split available.

## J. Owner decisions (accepted)

The Section frame has no approved visual target. The defaults are written in and are reversible.
The review of revision 1 recommended accepting O-1 to O-5. **The owner accepted all five on #443
(2026-11-28).** Changing one now needs a new owner decision.

| # | Decision | Ruling |
| --- | --- | --- |
| O-1 | Section as a vellum sheet on the cut plane, in the Stage (B.2) | Accepted |
| O-2 | Pressing Section also Faces (B.7) | Accepted |
| O-3 | Dimension set (B.4), and Paper-ink mono labels instead of the dark Tag | Accepted |
| O-4 | Hidden lines shown only as x-ray for the selection and revealed sources (D.1) | Accepted |
| O-5 | The SL3a / SL3b / SL3c split | Accepted |

```text
            removed side (eye)                       faced view, after Face
                   │                     ┌──────────────────────────────────────────┐
   ┄┄┄┄┄┄┄┄┄┄┄┄ cut line ┄┄┄┄┄┄┄┄┄┄┄┄    │   ╱╲ gable overhead (projected)          │
   ┌──┐   ┌───────┐   ┌──┐   ← slab      │  ╱  ╲┄┄┄┄┄ hidden (x-ray, selection only)│
   │  │   │ Room  │   │  │     depth     │ ▓▓  ▓▓▓▓  ▓▓   ← cut poché, void gaps   │
   └──┘   └───────┘   └──┘               │ ▓▓  ░░░░  ▓▓   ← Space fill            │
                                         │ ───────────── ← floor Region cut        │
                                         │ ├── 2.40 m ──┤  dimension (selection)    │
                                         └──────────────────────────────────────────┘
                             pill:  depth · Flip · Face · Section · Put back
```

## K. Out of scope

- SP3.
- Editing in Section.
- Measure on the sheet.
- A Scene-model section.
- Export or print scale.
- A Reveal recovery action.
- A retained or incremental Section.
- Vertical crop.
- **Section through here** in the Card.
- Any format bump.
- Any refactor not listed in §E.

## L. Documents on landing

| Slice | Document updates |
| --- | --- |
| SL3a | The README §Slice readiness row |
| SL3b | layout.md: C.7 stream semantics and the Section membership use |
| SL3c | design-system.md: the Section sheet and its dimension use, after O-1–O-4. README readiness. This file is deleted. sl-plan-slice.md §4 points to the landed code |

## Implementation handoff prompts

> **SL3a.** Implement T1 SL3a Face the cut on `t1-sl3a-face-the-cut`, following
> `docs/plans/t1-spatial-world/sl3-plan-section.md` §B.5, §B.6 and §E SL3a, in order. Treat each
> Verified fact as current, re-check it when you touch it, and stop on any §I condition. Do not
> implement SL3b or SL3c.

> **SL3b.** Implement `layout.section@1` on `t1-sl3b-section-evaluator`, following §C and §E SL3b,
> step by step. Every C.9 invariant and every §H fixture is required. Do not touch editor
> presentation beyond `sectionParametersOf`.

> **SL3c.** After SL3a and SL3b merge, implement the Section reading on `t1-sl3c-section-reading`,
> following §B, §D and §E SL3c. Do the rendered fixture (step 1) before anything else. Do the §G
> browser acceptance and attach the evidence.

## Revision log

**Rev 2: review of revision 1 on #443 (2026-11-28).** Scope and architecture are unchanged.

1. **Frame sign.** `up × normal` is `(n_z, −n_x)` in plan, not `(−n_z, n_x)`. It is now proved
   through Camera's own `facePoseFromBounds`, `evaluateViewport` and `projectWorld` (N16, F35).
2. **Numerical claims.**
   - The evaluated line is named `L_ε`, and its cost against the drawn line is declared (C.3).
   - The invariants are restated against classes E and C. Revision 1's continuous-geometry claim
     on curved Walls is withdrawn.
   - N8 and N11 are rebuilt on the same `L_ε`.
   - N13 is reduced to the comparisons that both bodies support: Hausdorff on the same-body subset,
     point-to-surface on curved Walls.
3. **Clipping.** Concave subjects are clipped through the existing exact `form-partition.ts`
   machinery, with one loop per component. Sutherland–Hodgman is kept for convex subjects only.
   N15 and fixtures F27–F33 are added.
4. **Reveal.** `outside-depth` and `outside-crop` now have separate geometry extent, presentation,
   membership and picking (B.10). N5 holds for every fragment.
5. **Space fills** are excluded from occlusion (C.5, N14, F34).
6. **Roadmap.** The T1 README and the plans index now record `V2a–V2c` and `V3a–V3c` as landed.

**Rev 3: owner ruling (2026-11-28).** O-1 to O-5 accepted as written (§J).
