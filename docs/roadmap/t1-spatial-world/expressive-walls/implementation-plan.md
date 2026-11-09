# Expressive Walls, Circular Rooms and Wall Unfolding: implementation plan

**Status:** draft plan, revision 2. This is the first commit of the draft PR that claims
`layout.wall-curve-edit`, `layout.circular-room` and `layout.wall-unfold`. It authorises no
production change. Once the owner approves it, the same PR implements all three capabilities
through the six checkpoints below. Each checkpoint is a reviewable run of commits with its own test
evidence, and none is a separate PR.

**Base:** `main` at `837577a7` (#286 merged: Living Draft shell and the World toolbar).

**Risk tier: Tier 2.** The PR:

- changes one line of the approved
  [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md#rays-and-points) (D1);
- makes an incompatible persisted-format change, because closed Walls cannot be read by format 6
  (format 7: bump, strict refusal of 6, fixtures regenerated, no migration);
- adds one Camera viewing intent inside the Camera authority (`camera.one-authority`, a contract
  detail within the hard rules);
- requires an owner browser check before merge.

No North Star or hard-rule change is proposed.

## Goal

A creator can:

- bend any Wall by grabbing it and shape several smooth curves within one canonical Wall;
- draw a true circular Room that is **one** self-connected Wall around **one** persistent Room, with
  radius and diameter editing, a stable seam and Openings that may cross the seam;
- unfold **any** valid Wall (open Bézier chains with inflections, tight curves, circles, straight
  Walls) smoothly and partially into a flat developed sheet, edit its Openings there, and fold it
  back.

Unfolding is display-only. All of this keeps Wall, Junction, Room and Opening identity, Opening
stations, connectivity and one Undo entry per edit.

## Capabilities

| ID | Outcome | Checkpoints |
| --- | --- | --- |
| **`layout.wall-curve-edit`** (C1) | Grab-anywhere bend; several cubic spans in one Wall; knot move, remove and exact X/Z; Straighten; existing Openings stay editable on curved hosts | 1 |
| **`layout.circular-room`** (C2) | Walls plate **Circle**: one closed Wall + one Room; radius/diameter; seam; new Openings on curved and closed hosts, including seam crossing; Plan/3D/visitor; Save/Load | 2, 3 |
| **`layout.wall-unfold`** (C3) | One development map for every valid Wall, open or closed; continuous partial unfold; face-on framing through Camera; inverse picking and editing through the canonical writers; explicit refusal where the inverse is ambiguous | 4, 5 |

Checkpoint 6 is the integrated browser acceptance for all three. These follow-ons stay visible but
are **not** authorised: the Walls plate **Arc**, Ink attach and split on curved Walls, length and move
marks on curved Walls, bending closed Walls, and closed Walls connected to other Walls (see D7 and D8).

## What exists today

| Area | Current state | Evidence |
| --- | --- | --- |
| Schema | `LayoutWallCenterline` is `line` or `cubic-chain`: identity-bearing knots, positional spans, `spans = knots + 1`, endpoints owned by Junctions. Format 6. Opening `offset` is metres along the centerline from the canonical start to the Opening's start edge. | [`layout-wall-first-types.ts`](../../../../packages/layout-core/src/layout-wall-first-types.ts) |
| Curve algebra | Exact de Casteljau split, one split-distance resolver, shape-preserving knot insert, local knot move that keeps join tangents, knot delete by merge | [`layout-wall-curve-algebra.ts`](../../../../packages/layout-core/src/layout-wall-curve-algebra.ts) |
| Samples | `CurveSample` carries `point`, **true arc-length** `distance` (Gauss quadrature, 1e-6 m), analytic `tangent` and `normal`. `pointAtDistance` interpolates the point linearly and normalises the lerped tangent. | [`layout-geometry-curve.ts`](../../../../packages/layout-core/src/layout-geometry-curve.ts) |
| Planners | Bend, knot insert/move/delete, convert to curve/line and curved split all exist and go through `finalizeWallGeometryCandidate`. Live proposals already accept `curve-control-move` and `wall-bend`. | [`layout-wall-first-precision.ts`](../../../../packages/layout-core/src/layout-wall-first-precision.ts) |
| Faces and Rooms | Face polygons expand curved Walls into samples. Stars at a Junction are ordered by **Junction chord**, and twins are found by `(toId, wallId)`. | [`layout-face-extraction.ts`](../../../../packages/layout-core/src/layout-face-extraction.ts) |
| Junctions | Leg resolution uses **departure tangents** (`tangentOut`). Legs are keyed by `(wallId, end)`, but two helpers skip every leg with the same `wallId`. | [`layout-junction-resolution.ts`](../../../../packages/layout-core/src/layout-junction-resolution.ts) |
| Closed Walls | Unrepresentable. The codec refuses `startJunctionId === endJunctionId`; `roomBoundaryPolygon` needs at least 3 refs; dissolve refuses self-loops. | [`layout-wall-first-codec.ts`](../../../../packages/layout-core/src/layout-wall-first-codec.ts), [`layout-room-reconciliation.ts`](../../../../packages/layout-core/src/layout-room-reconciliation.ts) |
| Openings | One interval `[offset, offset + width]` per Opening; `opening-set` validation is linear | [`layout-opening-set.ts`](../../../../packages/layout-core/src/layout-opening-set.ts) |
| Wall mesh | `buildStandaloneWallMesh` emits side faces at `sample ± normal · t/2` with `u = sample.distance`, plus `pickRanges` that partition every triangle with Wall or Opening identity. `uv` is reused inconsistently (caps, bridges), and there is **no station/offset/height attribution**. One retained mesh per Wall, keyed by cache keys; the visitor uses the same builder. | [`wall-mesh-builder.ts`](../../../../apps/editor/src/lib/layout/wall-mesh-builder.ts), [`layout-wall-representation.ts`](../../../../apps/editor/src/lib/render/layout-wall-representation.ts) |
| Camera | Viewing intents include `fit`, `set-view`, `aim` and `set-reading`. The only animated pose change is the reading flip (`ViewportTransition`, 1.0 s, smoothstep). `set-view` installs instantly. | [`viewport.ts`](../../../../packages/camera-core/src/viewport.ts), [`camera-session.ts`](../../../../apps/editor/src/lib/authoring/stage/camera-session.ts) |
| Stage | No curve UI. `wallFrame` returns `null` for curved Walls, so a curved Wall and its Openings get no marks. A selected straight Wall's body press slides the Wall along its normal. | [`layout.adapter.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout.adapter.ts), [`precision.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout/precision.ts) |
| Ink / World toolbar | `InkWallMode = 'line' \| 'box'`; Box submits one `layout-wall-chain-commit`. The Walls plate has **Arc** and **Circle** disabled. | [`ink.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout/ink.ts), [`drawing-planners.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout/drawing-planners.ts), [`InkPlate.svelte`](../../../../apps/editor/src/lib/authoring/world-toolbar/InkPlate.svelte) |
| Identity guard | An arch test fails if production code reaches `planBendWallCurveKnot`, `planInsertWallCurveKnot`, `planConvertWallToCurve` or `nextWallCurveKnotId`. Curve authoring must use captured identity. | [`layout-identity-boundary.test.ts`](../../../../apps/editor/tests/lib/layout/layout-identity-boundary.test.ts) |
| Prototype | Isometric unroll of **circular arcs only** (`k = (1 − u)/r`); per-frame re-tessellation; screen-space nearest-point scan (5 cm, then 5 mm); dog-ear peel; curvature dial; Square up; recipes. | [implementer reference](../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md) |
| geometry-core (T5) | Closed quadratic-midpoint profiles, exact `orient2d`, extrusion | [`profile.ts`](../../../../packages/geometry-core/src/profile.ts) |

**geometry-core reuse:** none. Both packages already wrap `robust-predicates` behind their own seams,
and T5's quadratic profile is a different evaluation contract. The development map below needs only
angles, sinc and prefix sums over Layout's own samples. Importing geometry-core would add a
dependency edge without sharing a single operation.

## Architectural blockers found by inspection

None of these is fundamental, and each has a specified fix in the checkpoint that owns it.

| # | Blocker | Evidence | Fix (checkpoint) |
| --- | --- | --- | --- |
| **B1** | **Bending can merge Rooms silently.** Face extraction orders a Junction's star by chord, but a bent Wall can leave a Junction on the other side of a neighbour. | Probe on `main`: A `J0→J1` straight, B `J0→J2` bent over A's free end (departure tangent 66.8°, chord −18.4°), plus C, D and E closing two Rooms. `validateWallFirstTopology` accepts it. `extractBoundaryCandidateFaces` returns **one** face (B′E′D′) and flags A and C as `boundary_cut_edge` instead of returning two faces. Junction geometry meanwhile uses tangents, so mesh and topology disagree. | Order stars by departure tangent, with a curvature tie-break and robust orientation on departure probe points. Identical to chord order for straight Walls. Lands as the **first** C1 commit with the probe as a regression test (1) |
| **B2** | Closed Walls are unrepresentable | Codec self-loop refusal; twin lookup `(toId, wallId)` is ambiguous on a loop; `roomBoundaryPolygon` and Room geometry need at least 3 refs; same-wall leg skips in `junctionPointOwner` and `coreTrimDistance` | Self-loop topology case (2) |
| **B3** | Openings cannot cross a seam | One linear interval; linear set validation | Periodic intervals on closed hosts (3) |
| **B4** | The mesh cannot be mapped into a developed sheet without guessing | No per-vertex station, offset or height; mixed `uv` semantics | Optional attribution output from the builder (4) |
| **B5** | Camera cannot animate a face-on framing | Only reading flips animate; Layout must not compute or tween camera poses | `face` viewing intent in camera-core (5) |

## Checkpoint sequence

```text
1 Expressive curved Walls ─┬─► 3 Circular Room + curved-host Openings ─► 4 Unfold proof ─► 5 Unfold ─► 6 Browser acceptance
2 Circle proof + decision ─┘          (needs 1 and 2)                     (open + closed)
```

The order is the one requested, with two adjustments:

- **B1 lands first.** Grab-anywhere bending makes it reachable, and the closed-Wall star needs the
  same tangent ordering.
- **Checkpoint 2 is core-only.** It touches topology, codec and kernel files that checkpoint 1's
  editor work does not, so it can be developed in parallel with checkpoint 1's later commits.

Checkpoint 4 comes after 3 because closed-Wall unfolding is proven on real periodic hosts with
seam-crossing Openings, not on fixtures alone. Its numeric core is already proven below, so
checkpoint 4 is mostly productionising and covers mesh attribution.

| # | Delivers | Exit evidence (all `[cap:…]`-tagged) | Owner stop? |
| --- | --- | --- | --- |
| 1 | B1 fix; C1 as specified below | Core, edge and mounted-gesture tests; arch boundary test updated | No |
| 2 | Self-loop topology on fixtures; both circle encodings measured; recommendation recorded in this plan | Proof tests (below) in the fast lane; churn and accuracy table filled in | **Yes: D6, encoding** |
| 3 | Circle tool, closed Wall + Room, radius/diameter, periodic Openings, Opening placement on all curved hosts, format 7, Plan/3D/visitor | Core and edge tests; codec fixtures regenerated; visitor representation test | No |
| 4 | `layout-wall-development.ts` in layout-core; builder attribution; proof suite on canonical samples and compiled meshes | Proof suite passes all criteria below, or stop | **Yes, only if a criterion fails** |
| 5 | Unfold context, display mesh, inverse picking/editing, `face` intent, overlap refusal, performance | Core, edge and mounted tests; camera-core tests | No |
| 6 | Integrated browser flows; plan deleted, enduring rules promoted | E2E flows below; full merge gate | **Yes: Tier 2 owner check** |

If a proof in checkpoint 2 or 4 fails, work stops at that checkpoint and this plan records the
failure and the alternatives. Scope is never silently narrowed to circles or to cosmetic flattening.

## Decisions for the owner

Implementation proceeds on the recommendation unless the owner overrides it. D6 is decided at
checkpoint 2 from evidence.

| # | Decision | Recommendation | Tradeoff |
| --- | --- | --- | --- |
| **D1** | Body press on a selected open Wall: bend or slide? | **Bend.** The hollow span-midpoint points mark where curves start. Rigid slide stays on the base move ray and the Card fields. The grammar's Wall row is amended in this PR. | Loses body-press-to-slide (R217.S15). Fallback: hollow points only, Tier 1 for this item. |
| **D2** | Removing one bend point | Click a knot to make it the **active bend point** (session state). The Card shows **Remove bend point**, and Delete/Backspace removes the active knot instead of the Wall. Esc or a selection change clears it. | Delete is overloaded while a knot is active. |
| **D3** | Openings when their host bends | **Keep arc station**, as the schema defines. An Opening that no longer fits refuses the whole edit. | Openings slide visually along the reshaped curve. |
| **D3b** | Openings when a circle's radius changes | **Keep angular position**: the radius planner writes `offset · r′/r` and keeps widths. Refuse on overlap or fit failure. | An explicit rule of the radius operation, not silent renormalisation. The alternative (keep metres) bunches Openings toward the seam. |
| **D4** | Bend-point limit | **32 knots per Wall**, enforced by the planner (`curve_knot_limit`); no codec cap | Bounds sampling, preflight and unfold cost. |
| **D5** | New Openings on curved hosts | **In scope** (checkpoint 3). This reverses revision 1. | Needed for circles and for editing on the unfolded sheet. |
| **D6** | Circle encoding | **Decided at checkpoint 2 by the criteria below.** Current evidence leans toward a **closed cubic chain with 16 symmetric spans**, against the stated preference for parametric. | See the C2 comparison. If parametric wins, circles cannot bend until a conversion exists. |
| **D7** | Connections to a closed Wall | **Isolated closed Walls** in this milestone. The seam Junction has exactly the loop's two legs. Attaching, crossing, noding or merging onto a closed Wall refuses with `closed_wall_isolated`. Walls inside the circle that don't touch it are allowed. | Keeps the self-loop case to one Junction and one face pair. Connected circles are a follow-on. |
| **D8** | Can a circular Wall bend? | **No, in this milestone.** Body press on a circular Wall moves the whole circle; its radius point resizes it. | Keeps radius and diameter meaningful under both encodings. Free-form closed Walls are a follow-on. |
| **D9** | Circle input | Same two-point input as Box: **centre, then a rim point**. The seam Junction sits at the rim point, and radius is their distance. Typed X/Z works for both points; the radius is exact through the Card. | The seam lands where the creator released, so it is visible and predictable. |
| **D10** | Unfold reference surface | **Centerline (mid-surface).** Opening offsets and widths, Wall length and stations are all centerline quantities. | Face lengths are not preserved, and the plan says so (see C3). A viewed-face reference would need a second station system. |
| **D11** | Display cut for a closed Wall | **The station opposite the anchor.** The seam is shown as a tick. An Opening across the cut shows as two fragments of one Opening. | The region in front of the creator stays continuous. Cutting at the seam would split seam Openings even when they sit in view. |
| **D12** | Unfold UX surface | **No new shell chrome.** Card actions *Face* and *Unfold*, a peel mark on the selected Wall's top edge, and while unfolded a Card **Curvature** scrubber with *Square up*, *Inside/Outside* and *Done*. 3D only: entering from Plan flips to 3D inside the same `face` transition. | Reuses the Card and mark vocabulary. The prototype's dial and breadcrumb are not ported. |
| **D13** | What can be edited while unfolded | Opening select/slide/width/sill/head, Opening placement and Wall height. **No centerline or knot edits while `u > 0`.** | Shape edits would fight the display. Fold back to bend. |
| **D14** | Camera for unfold | New camera-core intent **`face`**: Layout supplies the sheet bounds and look direction, and camera-core computes the fitted pose and animates it. Scrubbing never moves the camera. | Touches the Camera authority, which is the only legal place for this. |

**Not decisions:** the format version (always bump plus strict refusal), and what the visitor shows
(always canonical geometry; unfold never reaches visitor chunks).

## C1: `layout.wall-curve-edit` (checkpoint 1)

### B1 fix: tangent-ordered stars (first commit)

`compareOutgoingEdges` orders half-edges by their **departure direction**, not the Junction chord:

- a straight Wall uses its chord, which is identical to today;
- a curved Wall uses the first sample's tangent in its traversal direction, from
  `wallCenterlineSamples` through the same sampling derivation that face extraction already uses.

Comparison stays quadrant-first plus `orientXZ`, applied to departure probe points `origin + tangent`.
If two departures are exactly collinear, the next tie-break is signed curvature at the Junction: the
Wall that turns more counter-clockwise sorts first. Then comes the existing id tie-break.

Twin lookup uses `(wallId, opposite direction)` instead of `(toId, wallId)`, which is the same result
for every non-loop Wall.

Regression test: the probe document above yields two faces and no `boundary_cut_edge`, and its Room
areas sum to the outer face. Existing curved-Room tests stay byte-identical.

### Interaction (Select tool, Plan and 3D)

The tool is the existing Select, and the World toolbar is unchanged. Marks use the descriptor
vocabulary in [`stage-handles.ts`](../../../../apps/editor/src/lib/authoring/stage/stage-handles.ts) and
project through the one `ViewportEvaluation`.

| Selected subject | Marks |
| --- | --- |
| Straight Wall | Existing marks unchanged, **plus** one hollow point at mid-station |
| Curved open Wall | End points (existing junction-move planner); a **solid point per knot**; a **hollow point per span** at its arc-length midpoint. No length, angle, move or height marks (the Card keeps Height and Thickness). |
| Opening on a curved host | Existing Opening marks placed along the host's canonical samples |

Gestures:

1. **Bend:** press on the selected Wall's body (mark hit first, then `resolvePick` with
   `purpose: 'select'`; an Opening outranks its host) or on a hollow point. The press resolves once
   to an arc station. Nothing changes until `isPointerDrag`. While dragging, `point` is the datum
   point from `resolvePlanarDragSnap`. A press within knot tolerance promotes that knot.
2. **Knot move:** drag a solid point (`curve-control-move`).
3. **Active knot** (D2): click a solid point.
4. **Remove bend point:** Card action, or Delete with an active knot.
5. **Straighten Wall:** Card action (`planConvertWallToLine`). Refuses with its reason.
6. **Exact bend point:** the active knot's X/Z through the existing `curve-point` numeric host,
   registered in `PLAN_NUMERIC_CONTROL_TARGETS` as `curve-control`.
7. **Esc** cancels and writes nothing.

The tag shows `planarDeltaLabel` (pointer minus press), or the refusal words. The preview is the
dashed centerline through the candidate preview channel, red when refused.

### Intents (new adapter module `curve-planners.ts` beside `precision.ts`)

| Kind | Payload | Captured inputs | Core call |
| --- | --- | --- | --- |
| `layout-wall-bend` | `wallId, distance, x, z` | nonce, working level | `planBendWallCurveKnot(doc, wallId, {distance, point}, { knotId })` |
| `layout-wall-knot-move` | `wallId, knotId, x, z` | working level | `planMoveWallCurveKnot` |
| `layout-wall-knot-delete` | `wallId, knotId` | working level | `planDeleteWallCurveKnot` |
| `layout-wall-straighten` | `wallId` | working level | `planConvertWallToLine` |

Each valid release is one F.4 acceptance and one history entry. The knot id is
`layoutCapturedId(capture, wallId + ':knot')`, checked with `assertCapturedIdUnused`. Redo replays
the same id; a new bend after Undo gets a new nonce. Promotion allocates nothing.

### Core changes

1. `planBendWallCurveKnot` takes a **required** `{ knotId }` and stops calling `nextWallCurveKnotId`.
   The boundary test drops it from the uncaptured list. Previews use a fixed `${wallId}:knot.preview`
   id that is never persisted.
2. `MAX_WALL_CURVE_KNOTS = 32`, refusal `curve_knot_limit` (bend, insert, `resolveProposedCurveChain`).
3. `readWallFirstDragProposal` accepts `curve-control-move` and `wall-bend`.
4. `projectPointToWallCenterline(wall, start, end, point) → { distance, point, distanceToPath }` in
   `layout-wall-centerline.ts`, a thin wrapper over `wallCenterlineSamples` +
   `projectPointToSampledSegment`. It is the only pointer-to-station path, and C2 and C3 reuse it.

### Editor changes

- A `curvedWallFrame(document, wallId)` next to `wallFrame` returns Junctions, samples, length,
  knots and span mid-stations. `wallFrame` stays straight-only.
- A framework-free `wall-bend-gesture.ts` (the pattern of `wall-gesture.ts`) owns press → station,
  drag → intent, threshold, tag and the active-knot state. The adapter only binds it.
- The live path reuses `createWallDragReader(baseline)`.
- Existing Openings on curved hosts: `openingSpan`, `openingGhost` and the Opening mark frame evaluate
  `at(distance, elevation)` from samples (`pointAtDistance` + sample normal), and slide/width drags
  map through `projectPointToWallCenterline`. Straight hosts keep exact chord math.
- The Card shows Length (arc, read-only, labelled as arc length) and Bend points (count), with the
  actions Straighten Wall and Remove bend point.
- Grammar (D1): replace the Wall row's slide rule with the bend rule, and admit the hollow point.

### Validity, performance, checks

- Ids never change across bend, move, remove, straighten, Undo and Redo. Untouched spans stay
  byte-identical. Crossing, self-intersection, thickness fold or Opening overflow refuses live where
  the preflight knows it, and always at release. Session state is never serialized.
- Per pointer move: one `resolveProposedCurveChain`, one affected-Wall sample, the scoped preflight
  and the Opening subset check. No planner, reconciliation, compile, capture or history work. This
  is proven at the **mounted gesture boundary** with `setTopologyGateObserverForTest`,
  `setWallFirstTopologyEvaluationObserverForTest` and `setWallSamplingObserverForTest`.

| Check | Kind |
| --- | --- |
| B1 probe yields two faces; straight-only star order unchanged on every existing fixture | core |
| Bend mid-body → one knot, one entry, ids unchanged; Undo restores bytes; Redo replays the knot id | core |
| Second bend → two knots, first span byte-identical; knot move, remove and Straighten each one entry | core |
| Bending a Room-bounding Wall keeps the Room id and updates its area | core |
| Crossing, self-intersection or Opening overflow refuses live and at release, writing nothing | edge |
| Press near a knot promotes it; captured id gets a new nonce after Undo; `captured_id_in_use` | edge, arch |
| Mounted gesture: N moves → no finalize, compile or history; Esc restores; release installs once | core |
| Existing Opening on a curved host: select, slide along the arc, resize; numeric offset exact | core |
| Curved marks identical in Plan and 3D; 33rd knot refuses `curve_knot_limit` | edge |

## C2: `layout.circular-room` (checkpoints 2 and 3)

### Checkpoint 2: shared self-loop topology and the encoding proof

Both encodings need the same self-loop work, and it is most of C2's cost. Checkpoint 2 builds it
once on fixtures at a nonzero datum, then measures both encodings on it.

**Self-loop rules (layout-core):**

- **Closed Wall:** `startJunctionId === endJunctionId`. Valid only when the centerline is
  closed-capable (D6), its seam is G1 (tangent-continuous within the existing continuation
  tolerance), it does not self-intersect, and its offset faces do not fold. The codec accepts it only
  under those rules (format 7).
- **Junction:** the seam Junction has exactly two legs, `(wallId, 'start')` and `(wallId, 'end')`
  (D7). Resolution treats this pair as a continuation join with no Junction material.
  `junctionPointOwner` and `coreTrimDistance` compare legs by `(wallId, end)`, not by `wallId` alone.
- **Faces:** the loop yields two half-edges from J to J. With B1, departure tangents are opposite and
  the twin is found by direction, so the walk yields one bounded face (interior on the left) and the
  discarded outer ring.
- **Rooms:** boundary length 1 is valid. `roomBoundaryPolygon` and Room geometry require **at least 3
  polygon vertices** after sample expansion instead of at least 3 refs. This also admits two-Wall
  curved lenses, which are valid today but return `null`.
- **Mesh:** a closed Wall's samples start and end at J. The continuation join makes the ring
  watertight with no cap. Seam vertices are welded, which the builder's weld tolerance already does.
- **Refusals:** split or dissolve of a closed Wall (`closed_wall_isolated`); a Junction move on J is
  reinterpreted by the radius planner (below), never by the generic junction-move planner.

**Encoding comparison:**

| | Parametric closed circle | Closed cubic chain |
| --- | --- | --- |
| Data | New centerline kind `{ kind: 'circle', center, sweep: 'ccw' }`; radius `= \|J − center\|` | Existing `cubic-chain` with equal end Junctions; creation writes 16 symmetric spans (15 captured knots) |
| Radius / diameter | Intrinsic and exact | Exact at knots; centre = mean of the 16 on-circle points; edit = uniform scale about the centre |
| Measured accuracy | Exact | Measured on canonical samples at r = 5 m: **8 spans** length error 6.9e-5 m, radial 2.1e-5 m; **16 spans** length error 1.1e-6 m, radial 3.2e-7 m. Error scales linearly with r. |
| Stations | `s = r·θ`, exact | True-arc quadrature, 1e-6 m tolerance |
| New dispatch | A circle case at every `centerline.kind` site: **60 sites in 17 files** today, plus a new kernel segment kind (sample, length, project, split refusal) | **None** |
| C1 bend | Refused (D8); a later bend needs closed-cubic support anyway | Works unchanged once D8 is lifted |
| C3 unfold | Works on samples | Works on samples. The development proof below ran on an 8-span closed cubic circle. |
| Radius edit | Move J radially | Scale chain; refuse if any Opening fails |

**Proof criteria.** Each criterion is a test on the shared fixture:

1. A typed radius round-trips through Save/Load to display precision (1 mm), with the
   Card-displayed radius exact.
2. Circumference stays within 1e-6 m · (r / 5 m) of 2πr.
3. A radius edit keeps the Wall, Junction, Room and Opening ids and the seam station 0.
4. Station ↔ point round trip stays within the planner tolerance across the seam.
5. No change in behaviour outside sampling, projection and refusal sites. This is measured as the
   diff size of making the dispatch exhaustive.
6. The unfold development (C3) passes on the encoding's samples.

**Decision rule.** Choose **parametric** only if criterion 5 shows the circle case stays inside the
sampling/projection/refusal seams and the owner keeps D8. Otherwise choose **closed cubic**. The
measured result goes into this plan, and the owner decides D6 at this stop.

| Proof test | Kind |
| --- | --- |
| Codec accepts a closed Wall in format 7 and refuses format 6 strictly; refuses a non-G1 seam, self-intersection and fold | core |
| Face extraction on an isolated loop yields one face with boundary `[{wallId, 'forward'}]` | core |
| Room geometry on a 1-ref boundary and on a two-Wall lens | core |
| Junction resolution: continuation pair, no material, watertight mesh, no capped seam | core |
| Criteria 1–6 above, for each encoding | core |

### Checkpoint 3: Circle tool, editing, periodic Openings

**Tool** (Walls plate **Circle**, enabled):

- `InkWallMode` gains `'circle'`, and `InkPaletteSnapshot` gains `circle: { radius } | null`.
- Point 1 is the centre and point 2 is the rim, both through `resolvePlanarDragSnap` and `typePoint`.
  Taps and drags behave as they do for Box.
- The live preview is a dashed circle, with the tag `r 3.20 m · ⌀ 6.40 m`.
- Release submits **one** new intent, `layout-circle-room-create`, with payload
  `centerX, centerZ, rimX, rimZ, thickness?, height?`. Captured inputs are the nonce and working
  level.
- The intent lives in `drawing-planners.ts` and calls the new core planner
  `planCreateCircularRoom(doc, input, { wallId, junctionId, roomId, knotIds? })`. Its ids are
  captured with the seeds `wall`, `junction`, `room` and `<wallId>:knot`.
- The planner writes the Junction at the rim point and the closed Wall wound so that the forward
  traversal has the interior on its left. The Room is reconciled from the face with the captured id.
- Refusals:
  - `circle_radius_too_small`: r must exceed thickness/2 plus the offset-clearance margin;
  - `layout_geometry_limit`: the existing limits;
  - `closed_wall_isolated`: the circle would touch, cross or snap-merge an existing Wall;
  - `curve_knot_limit` cannot occur with 16 spans.
- One acceptance and one history entry.

**Editing a circular Wall** (Select):

- **Marks:** a radius point at the seam (a solid point on the rim), and Opening marks. No end points,
  knots or hollow points (D8).
- **Gestures:**
  - dragging the radius point projects the pointer radially and calls `layout-circle-radius` with
    `wallId, radius`, through `planSetCircleRadius`;
  - body press moves the circle (the existing Room/Wall rigid move through `translateWallCenterline`);
  - Esc cancels.
- **Card:** Radius and Diameter (editable, exact), Circumference (read-only arc length), Height and
  Thickness. Thickness edits refuse a fold.
- The radius planner applies D3b and refuses on Opening overlap or fit.

**Periodic Openings** (layout-core, used by compiler, mesh, Plan, picks and C3):

- On a closed host, `offset ∈ [0, L)` and `width < L`. The derived intervals are
  `[offset, min(offset + width, L)]` plus, if it wraps, `[0, offset + width − L]`.
- `CompiledOpening` gains `intervals: { from, to }[]` (one or two entries). The existing
  `offset`/`width` keep their meaning, and `centerPolyline` follows the intervals.
- `opening-set` validates circular non-overlap on closed hosts and stays linear on open hosts.
- The slide drag wraps the offset modulo L continuously, so an Opening crosses the seam without a
  jump. Both intervals pick and highlight the same `openingId`.
- `layout-wall-portals.ts` and the Plan strokes in `layout-plan-representation.ts` consume intervals.
  Door portals on curved hosts are covered by tests.

**Opening placement on any curved host:** the Ink Opening reading resolves the host station
through `projectPointToWallCenterline` and calls the existing placement planner with that station.
A typed offset is used exactly. `ProjectedWall` gets a sampled variant for curved hosts.

**Plan / 3D / visitor:**

- The compiler and builder consume the closed samples. The Room floor and ceiling come from the face
  polygon.
- `VisitorLayoutShell` needs no new code path, and a test confirms it.
- A selected circle shows radius and diameter tags in Plan.

| Check | Kind |
| --- | --- |
| Circle tool → exactly one Wall, one Junction, one Room; Undo removes all; Redo replays the captured ids | core |
| Radius/diameter edit keeps ids, scales Opening offsets (D3b), refuses on overlap; one entry each | core |
| Seam-crossing door: compile yields two intervals, one id, a watertight mesh; select from either side; slide across the seam | core |
| Touching, crossing or snapping onto a circle refuses `closed_wall_isolated`; split and dissolve refuse | edge |
| Too-small radius and a fold-inducing thickness refuse | edge |
| Opening placement on an open curved host: station exact, refusals truthful | core |
| Save/Load format 7 round trip; format 6 refused; fixtures regenerated | core |
| Visitor representation builds the circular Wall and Room from the same compiled geometry | core |
| Mounted gesture: radius drag does no compile per move; release installs once | core |

## C3: `layout.wall-unfold` (checkpoints 4 and 5)

### The development map (one mechanism, every valid Wall)

The input is the Wall's canonical samples `P_i`, true-arc stations `s_i`, unwrapped analytic tangent
angles `θ_i`, unwrapped chord angles `φ_i` with lengths `ℓ_i`, an anchor station `s_A` and a progress
`u ∈ [0, 1]`.

Curvature is scaled about the anchor: `κ_u(s) = (1 − u) κ(s)`, so the turning angle relaxes as
`θ_u(s) = θ_A + (1 − u)(θ(s) − θ_A)`. This is the natural relaxation of an inextensible strip. It
reduces exactly to the prototype's circular `k = (1 − u)/r`, keeps inflections at their stations,
and only ever reduces |κ|.

Discretely, on the same samples the mesh uses:

```text
Δθ_i = θ_{i+1} − θ_i      Δs_i = s_{i+1} − s_i      ℓ̃_i = ℓ_i / sinc(Δθ_i / 2)
λ_i(u) = ℓ̃_i · sinc((1 − u) Δθ_i / 2) · (1 + u (Δs_i / ℓ̃_i − 1))      // segment length
ψ_i(u) = θ_A + (1 − u)(φ_i − θ_A)                                     // segment direction
P_A^u = P_A;  P_{i+1}^u = P_i^u + λ_i(u)·(cos ψ_i, sin ψ_i)            // forward from the anchor
              P_{i-1}^u = P_i^u − λ_{i-1}(u)·(cos ψ_{i-1}, sin ψ_{i-1})  // backward
N_i^u = (cos α, sin α),  α = θ_A + (1 − u)(θ_i − θ_A) + π/2             // developed normal
X(s, w, y) = lerp(P_i^u, P_{i+1}^u, t) + w · normalize(lerp(N_i^u, N_{i+1}^u, t)),  Y = floor + y,  t = (s − s_i)/Δs_i
```

Properties:

- **u = 0** reproduces the canonical polyline and its interpolation exactly. This is the same
  interpolation as `pointAtDistance`, so it reproduces the canonical mesh.
- **u = 1** is a straight sheet where station `s` sits exactly `s − s_A` from the anchor.
- In between, the per-segment implied arc length moves monotonically between `ℓ̃_i` and `Δs_i`.

**Proof already run for this plan.** A scratch harness ran on layout-core's real
`wallCenterlineSamples`, at 200 u-steps per fixture; checkpoint 4 turns it into a committed test.

| Fixture | u = 0 error | u = 1 straightness / station error | Face fold (min offset/centre ratio, u = 0 → min over u) | Self-overlap over u | Inverse round trip |
| --- | --- | --- | --- | --- | --- |
| Closed 8-span circle r = 5, t = 0.2 | 1.8e-15 | 2.9e-15 / 3.6e-15 | 0.980 → 0.980 | none | 8.9e-16 |
| Quarter arc | 5.6e-17 | 1.0e-15 / 1.3e-15 | 0.947 → 0.947 | none | 8.9e-16 |
| S-curve with inflection | 1.4e-17 | 8.9e-16 / 2.7e-15 | 0.859 → 0.860 | none | 4.4e-16 |
| Six knots, mixed curvature, t = 0.3 | 8.4e-17 | 4.4e-15 / 5.3e-15 | 0.648 → 0.650 | none | 1.8e-15 |
| Tight hook (r ≈ 0.6, t = 0.3) | 6.9e-18 | 1.1e-16 / 1.8e-15 | 0.396 → 0.399 | none | 4.4e-16 |
| Hairpin, legs 0.6 m apart | 1.0e-15 | 0 / 0 | 0.433 → 0.436 | none | 8.9e-16 |
| Spirals 1.6 and 2 turns (pitch 0.44 m), anchor at start, middle, end | ≤ 3.0e-15 | ≤ 8.9e-15 / ≤ 1.4e-14 | ≥ 0.847 | none | ≤ 3.6e-15 |
| Serpentine, 5 legs 0.5 m apart, three anchors | ≤ 2.6e-16 | ≤ 5.3e-15 / ≤ 7.1e-15 | 0.053 → 0.057 | none | ≤ 1.8e-15 |
| Straight one-span chain | 2.8e-17 | 6.7e-16 / 3.1e-15 | 1.000 | none | 8.9e-16 |
| *Invalid* hook that folds at u = 0 | — | — | −0.378 | 0.005–0.275 | — |

The developed circle matches the prototype's analytic unroll within 3.8e-5 m, which is the radial
error of the 8-span cubic itself.

Two simpler variants were rejected by the same harness:

- plain chord lengths leave up to **7.8 mm** station error at u = 1 (mixed curvature) and 30 mm
  (serpentine);
- arc-consistent lengths without the final correction leave up to 1.6 mm.

**Reference surface and what is not claimed (D10):**

- The development is isometric along the **centerline**. Stations, Opening offsets and widths, and
  Wall length read true at every u.
- A face at signed offset `w` has original length `∫(1 − wκ) ds` and developed length
  `∫(1 − wκ_u) ds`. At u = 1 both faces have the centerline's length, so the inner face stretches and
  the outer face shrinks. **No face is claimed to be isometric.**
- Dimensions on the sheet are labelled as centerline stations. Face lengths are not displayed as
  true.

**Fold safety (lemma, tested):**

- Because `κ_u = (1 − u)κ`, we have `|w κ_u| ≤ |w κ|` for every u.
- The compiler already refuses a Wall whose faces fold (`WALL_OFFSET_FOLD_CODE`), so a valid Wall's
  developed faces never fold at any u.
- The only overlap the harness found was on input the compiler already rejects.

**Global self-overlap is not ruled out in theory**, even though no valid fixture produced one. An
exotic spiral could bring distant parts of the sheet together at an intermediate u. Policy:

- After every u change with `0 < u < 1`, run `sampledPolylineSelfIntersects` on the developed
  centerline and both face polylines. u = 0 is the valid canonical state and u = 1 is a straight band,
  so both are skipped.
- While overlapping, the sheet shows the refusal tint with the reason "This unfold overlaps itself:
  continue to Flat or fold back". Edit marks hide and sheet picks refuse.
- u is never changed automatically.

### Display mesh and attribution (checkpoint 4)

- **Attribution.** `buildStandaloneWallMesh(wall, floor, ends, { attribution: true })` adds
  `mesh.attribution: Float32Array` with three values per vertex: canonical **station** `s`, signed
  **offset** `w` (positive along the canonical left normal) and **height** `y` above the floor.
  Every Wall-owned face sets them where it emits the vertex: sides `(a.distance, ±t/2, y)`, top,
  bottom, terminal caps, jambs, sills, lintels and arch reveals. Default off, so the visitor and the
  retained representation pay nothing. Bump `STANDALONE_WALL_MESH_BUILDER_SIGNATURE`.
- **Isolated display build.** Unfolding shows the selected Wall's **own body** over its full
  centerline with square developed ends. Junction material and neighbours are not developed.
  - layout-core exports `isolatedWallEnds(wall)`, which returns `terminal` joins from the existing
    resolver, so the renderer still never decides Junction geometry.
  - The display mesh is built **once** on entry, on a change of display cut, or when the Wall's
    retained key changes after an edit. Scrubbing u never rebuilds it.
- **Closed Walls.** layout-core exports
  `displayCutWall(compiledWall, cutStation) → CompiledPhysicalWall`. It returns samples re-based so
  stations run `[s_cut, s_cut + L]`, with the exact cut point inserted through `pointAtDistance` and θ
  unwrapped continuously through the seam. Opening intervals are re-based and clipped at the cut.
  - Opening fragments keep their `openingId`, so `pickRanges` already gives both fragments one
    identity.
  - Attribution reports canonical stations modulo L.
- **Development module.** A new `layout-wall-development.ts` in layout-core holds pure, runtime-safe
  code with no editor imports:

  ```ts
  type WallDevelopment = { readonly wallId: string; readonly closed: boolean; readonly anchorStation: number;
    readonly cutStation: number | null; readonly sampleCount: number; /* typed arrays: s, θ, φ, ℓ, Δs, P */ };
  prepareWallDevelopment(input: { wallId: string; samples: readonly CurveSample[]; closed: boolean;
    anchorStation: number; cutStation?: number }): WallDevelopment | { refused: 'development_invalid_input' };
  evaluateWallDevelopment(dev: WallDevelopment, u: number, out: { points: Float64Array; normals: Float64Array }): void; // no allocation
  mapAttributedVertices(dev, evaluated, attribution: Float32Array, floorY: number,
    outPositions: Float32Array, outNormals: Float32Array): void;                         // O(vertices), no allocation
  developmentOverlap(dev, evaluated, thickness: number): { overlaps: false } | { overlaps: true; stations: [number, number] };
  developmentFaceFrame(dev, evaluated, side: 1 | -1): { bounds: { min: Vec3; max: Vec3 }; look: Vec3 };     // for `face`
  ```

  Vertex normals rotate about Y by the same local angle `−u(θ(s) − θ_A)`.

**Checkpoint 4 proof suite.** All of these must pass; if any fails, work stops and the failure is
reported here.

1. The table above as committed tests on canonical samples, with the same tolerances: 1e-9 m at
   u = 0/1, and inverse round trip 1e-9 m.
2. **Compiled mesh at u = 0:** mapped positions equal `buildStandaloneWallMesh` positions within
   1e-9 m for open, S-curve, circle (display-cut) and Wall-with-Openings fixtures, including jambs and
   arch reveals.
3. **Attribution completeness:** every Wall-owned vertex carries a finite `(s, w, y)`, with
   `|w| ≤ t/2 + ε` and `0 ≤ y ≤ height`.
4. **Fold lemma:** for valid fixtures, the minimum offset ratio over u is at least its u = 0 value.
5. **Overlap detector:** the invalid hook reports overlap; all valid fixtures report none.
6. **Seam:** a closed Wall with a seam-crossing Opening and a cut through another Opening shows
   three fragments, each picking its own `openingId`.
7. **Performance counts:** `evaluateWallDevelopment` + `mapAttributedVertices` do O(n + V) work
   (`countWork` counters `unfold:development-sample`, `unfold:vertex-map`), and zero
   `sampleSegment` or compile observations per evaluation.

If a criterion fails, the alternatives reported for decision are:

1. a finer display-only resampling of the same canonical curve (still one curve evaluator);
2. a per-face reference with a second station system;
3. restricting partial states to the overlap-free u range.

### Unfold context, inverse and editing (checkpoint 5)

**State (session, never serialized, never in history):** `{ wallId, anchorStation, cutStation,
side, u, entryRecipe }`. `entryRecipe` holds the exact camera state at entry, per the
[nested Look/return rule](../../../reference/components/layout.md#nested-lookreturn-kept-separate-from-document-undo).
Changing u, side or cut never enters Undo, and Undo never changes them.

**UX (D12):**

- **Entry, with a selected Wall in 3D:**
  - Card **Unfold**: the anchor is the selected Opening's centre if it is on this Wall, otherwise
    the station nearest the view-centre ray. One `face` transition to the sheet fitted at u = 1,
    with the sheet animating 0 → 1 on the same clock and easing.
  - Card **Face**: faces the Wall at u = 0.
  - **Peel mark:** a corner mark on the top edge at the station nearest the pointer, using the
    existing descriptor vocabulary. Dragging opens the context in place with no camera motion, and
    `u = |drag| / 260 css px`. On release:
    - `u < 0.04` closes silently;
    - within ±0.035 of 0.5 or 1, it snaps;
    - otherwise it stays.

    A click unfolds fully.
  - From Plan, Unfold runs the same `face` transition, which ends in the 3D reading.
- **While unfolded:**
  - The Card shows **Curvature** (a 0–100 % scrubber; it moves only the sheet, with magnetic stops
    at 50 % and Flat), **Square up** (re-face at the current u), **Inside/Outside** (flips `side`:
    one `face` transition about the anchor) and **Done**.
  - Other Walls, Room floors and Scene objects ghost while `u > 0`.
  - A station ruler runs along the sheet's foot: centerline metres from the canonical start, a seam
    tick at 0 for closed Walls, and the cut marked.
  - Opening offset dimensions are anchored on the sheet, never at screen offsets.
- **Exit:** Esc or **Done** refolds over the transition duration and runs one `face`-family
  transition back to `entryRecipe`'s pose. Selecting another Wall, Undo that removes the Wall, or
  replacing the document invalidates the context. It then returns to the entry pose with the reason
  shown, and never guesses a nearby Wall.
- **Reduced motion:** the transition and the sheet both settle instantly, to the same end state.

**Camera (D14, camera-core).** A new `ViewingIntent`:

```ts
{ kind: 'face'; bounds: { min: Vec3; max: Vec3 }; look: Vec3; rect: ViewportRect; paddingFraction?: number }
```

- camera-core computes an eye on `−look` at the distance that fits `bounds`, with the same padding
  rule as `fit` and the current FOV.
- It accepts the intent with a `ViewportTransition` that ends in `'3d'`.
- `transitionFrame` is generalised: when `from === to === '3d'`, the orthographic weight is 0 and the
  pose eases with smoothstep over `VIEWPORT_READING_TRANSITION_SECONDS`. From Plan, the existing flip
  weighting applies.
- Layout supplies `developmentFaceFrame(...)` and never builds a pose.
- The return to the entry pose is `face`'s exact-pose sibling: `set-view` gains an optional
  `transition: true`, which uses the same generalised transition.

**Inverse mapping:**

- **Pick:** raycast the display mesh, a single mesh of a few thousand triangles. Interpolate the hit
  triangle's attribution barycentrically to get canonical `(s, w, y)`, and take identity from
  `pickRanges`. The map is piecewise affine per displayed triangle, so it is unique wherever the
  sheet does not overlap. At u = 0 and u = 1 it matches the canonical piecewise-linear stations
  exactly.
- **Along-wall drags** (Opening slide and width): raycast the viewed face. If the pointer leaves the
  sheet, project the pointer in screen space onto the projected developed face polyline at the
  handle's height (exact segment projection, then station interpolation). There is no 5 cm scan.
- **Vertical drags** (sill, head, Wall height): intersect the developed face plane at the handle's
  station (normal `N^u(s)`). Fall back to a screen-parallel plane when `|n · forward| < 0.25`, which
  is the prototype's rule.
- Results go to the existing canonical writers as stations and heights: Opening move, resize,
  sill/head and placement, and Wall height. **No new Layout writer exists for unfolding.**
- After an accepted edit, the Wall's retained key changes, the display mesh is rebuilt once at the
  same u, anchor and cut, and the edit's single history entry is the only document change.
- Refusals:
  - overlap state: picks and marks are refused with the reason above;
  - edge-on vertical fallback: handled as described under vertical drags;
  - a station outside the Wall's domain: the existing planner refusal;
  - a closed-host offset wraps modulo L.

**Performance (per scrub frame):**

- one `evaluateWallDevelopment` (O(n)), one `mapAttributedVertices` (O(V)) into the reused buffers,
  `needsUpdate`, and the overlap check when `0 < u < 1`;
- no compile, planner, sampling, representation update, capture or history;
- the display mesh is built once per entry, cut change or accepted edit.

This is proven at the mounted boundary with `setWallSamplingObserverForTest`,
`setSampleSegmentObserverForTest`, the compile observers and `countWork`.

**Visitor isolation:** the unfold modules are editor-only (`release.visitor-isolation`). The visitor
imports no development or attribution code; the builder's attribution flag stays off there.

| Check | Kind |
| --- | --- |
| Unfold → scrub → edit an Opening on the sheet → refold: one history entry, ids and stations unchanged except the edited field; Undo leaves u and camera alone | core |
| Pick at u = 0, 0.5 and 1 returns the canonical station within 1e-6 m on open, S-curve and circle Walls | core |
| Seam-crossing door edited from either fragment and from a cut-split fragment edits one Opening | core |
| Overlap state refuses picks and marks with the reason; u = 0/1 never report overlap | edge |
| `face` intent: fits bounds, animates in 3D, flips from Plan, rejects invalid input; scrub never changes the camera | core (camera-core) |
| Esc returns to the exact entry pose; invalidation (Wall deleted by Undo) returns with the reason | core |
| Mounted scrub of N frames: zero compile and sampling observations, O(n + V) counts, one display-mesh build | core |
| Visitor chunk contains no unfold module | arch |
| Straight Wall unfolds trivially, identical geometry at every u | edge |

## Checkpoint 6: integrated browser acceptance

Both flows use the existing stage-conformance E2E pattern in `apps/editor/tests/e2e/`:

1. **Open Bézier Wall:**
   - draw a Line Wall, bend it twice into an S, place a window on the curved part;
   - unfold to 50 %, slide the window on the sheet, raise its head, scrub to Flat, Square up, flip
     to Outside;
   - press Esc and confirm the exact entry camera;
   - Undo through each edit, then Redo;
   - Save and reload, then confirm the visitor Preview shows the same canonical curve and window.
2. **Circular Room:**
   - use the Circle tool, set the diameter in the Card, and confirm one Wall and one Room are listed;
   - place a door across the seam, unfold, and edit the door from the fragment at the display cut;
   - refold, change the radius (the door keeps its angle), Undo and Redo;
   - Save and reload, then confirm the visitor Preview.

Merge gate: the full contract in the
[test README](../../../../apps/editor/tests/README.md#what-a-change-requires), plus the owner's
browser check (Tier 2). Before merge, this plan is deleted. Its enduring rules go into the
[Layout reference](../../../reference/components/layout.md): closed-Wall rules, periodic Openings, the
development map, the reference surface and the overlap policy. The grammar row goes into the
instrument grammar. D5 in that reference is resolved by D11 and the overlap policy.

## Out of scope

Roofs, stairs, broad CAD modelling and unrelated shell changes. The World toolbar beyond enabling
Circle. Tangent handles and corner knots; snapping knots onto geometry; the Junction dissolve UI.
Section views and cut/depth streams. The follow-ons listed under Capabilities.

## Risks

| Risk | Mitigation |
| --- | --- |
| B1 changes face order for an existing curved document | Straight order is provably unchanged; every existing curved-Room test must stay byte-identical, or the diff is reported |
| Self-loop special cases leak into consumers | D7 isolation keeps loops to one Junction with two legs; codec, faces, junctions and mesh each get a loop test; dissolve and split refuse |
| Parametric churn larger than measured | Criterion 5 measures it before commitment; closed cubic is the fallback |
| Development overlap on exotic Walls | Detector, tint and refusal; never auto-change u; u = 0/1 are always safe |
| Display mesh drifts from canonical mesh | Same builder, same samples; u = 0 equality test on compiled meshes |
| Body-bend surprises (D1) | Hollow points, move ray kept, owner browser check |
| Adapter growth | New logic lives in `wall-bend-gesture.ts`, `curve-planners.ts` and an editor `wall-unfold.ts`; the adapter only binds |

## Implementation effort

| Checkpoint | Size (commits) | Long pole |
| --- | --- | --- |
| 1 C1 + B1 | 6–7 | Curved-host Opening marks; mounted gesture tests |
| 2 Self-loop + proof | 3–4 | Face/junction loop cases; parametric spike |
| 3 Circle + periodic Openings | 6–8 | Interval model through compiler, mesh, portals and Plan |
| 4 Unfold proof + attribution | 3–4 | Attributing every face class in the builder |
| 5 Unfold context | 6–8 | Inverse drags, `face` intent, invalidation paths |
| 6 Browser acceptance + promotion | 2–3 | Two end-to-end flows |

That is roughly 26–34 commits in one PR. C2 and C3 are each about 1.5–2 times C1. The owner stops
are after checkpoint 2 (D6), only on a failed proof in checkpoint 4, and before merge.
