# Expressive Walls and Spatial Unfolding — implementation plan

**Status:** draft plan; first commit of the draft PR that claims `layout.wall-curve-edit`. It
authorises no production change. The owner reviews it here; once approved, the same PR implements
**C1 only**. C2 and C3 below are proposed follow-on capabilities, recorded so the sequence and its
decisions stay visible. They are not claimed and not authorised.

**Base:** `main` at `837577a7` (#286 merged: Living Draft shell and the World toolbar).

**Risk tier:** **Tier 2** if D1 is approved as recommended (it changes one line of the approved
[spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md#rays-and-points));
otherwise Tier 1 (shared Stage interaction rules). No persisted-format change: `cubic-chain` is
already format 6.

## Goal

The milestone is **Expressive Walls and Spatial Unfolding**: bend Walls by direct manipulation, make
true one-Wall circular Rooms, and reversibly unfold curved Walls for inspection and editing. This PR
delivers the first useful step: **bend any Wall by grabbing it, add and edit several curves within
one canonical Wall, and keep its identity, hosted Openings, Room topology, precision and Undo.**

## What exists today

Inspection result: the curve kernel is landed and well tested, and the Stage exposes none of it.

| Area | Current state | Evidence |
| --- | --- | --- |
| Schema | `LayoutWallCenterline` is `line` or `cubic-chain` (identity-bearing knots, positional spans, `spans = knots + 1`), endpoints Junction-owned. Format 6. | [`layout-wall-first-types.ts`](../../../../packages/layout-core/src/layout-wall-first-types.ts), [persistence](../../../reference/components/persistence.md) |
| Curve algebra | Exact de Casteljau split, a single split-distance resolver, knot insert without shape change, local knot move preserving join tangents, knot delete by merge (never refit, never collapses to `line`). | [`layout-wall-curve-algebra.ts`](../../../../packages/layout-core/src/layout-wall-curve-algebra.ts) |
| Planners | `planBendWallCurveKnot` (grab station + pointer → insert or promote, then local move; straight Walls convert in the same candidate), knot insert/move/delete, convert to curve/line, exact curved split. All run `finalizeWallGeometryCandidate`, one candidate, IDs preserved. | [`layout-wall-first-precision.ts`](../../../../packages/layout-core/src/layout-wall-first-precision.ts) |
| Live proposal | `resolveProposedCurveChain` / `proposeWallFirstArchitectureGeometry` and the bounded `preflightWallFirstArchitectureCandidate` + verdict scope already accept `curve-control-move` and `wall-bend` intents. `readWallFirstDragProposal` (the adapter's Opening-aware reader) is typed for `junction-move` / `wall-move` only. | same file |
| Topology, Rooms, Openings | Curved Room faces are sampled; Room identity survives straight→curve; curve crossing and self-intersection refuse; Opening `offset` is metres of arc from the canonical start and fit uses arc length; compiler and mesh consume samples. | `layout-curve-*.test.ts` and `layout-curved-rooms.test.ts` under `apps/editor/tests/lib/layout/` (12 files) |
| Stage | **No curve UI.** `wallFrame` returns `null` for a curved Wall, so a selected curved Wall gets no marks, and Openings on a curved host get no marks either (`openingSpan` is built on `wallFrame`). Ink ignores curved Walls as hosts. The selected straight Wall's body press is rigid move along its normal. | [`layout.adapter.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout.adapter.ts), [`precision.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout/precision.ts), [`ink.ts`](../../../../apps/editor/src/lib/authoring/adapters/layout/ink.ts) |
| Identity guard | Knot IDs come from `nextWallCurveKnotId` (counts occupancy). An arch test fails as soon as any production code reaches `planBendWallCurveKnot`, `planInsertWallCurveKnot`, `planConvertWallToCurve` or that allocator: the first curve-authoring work must use captured identity. | [`layout-identity-boundary.test.ts`](../../../../apps/editor/tests/lib/layout/layout-identity-boundary.test.ts), [`layout-id-capture.ts`](../../../../packages/layout-core/src/layout-id-capture.ts) |
| Approved grammar | Wall: "the selected body slides along its normal"; a curved-Wall midpoint, "a hollow point that would bend a free Wall", is specified but not admitted until Layout has curved geometry. | [instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md#rays-and-points) |
| World toolbar (#286) | Walls plate: Line and Box live; **Arc** ("Curved walls arrive with T1") and **Circle** ("Circular rooms arrive with T1") disabled. | [`InkPlate.svelte`](../../../../apps/editor/src/lib/authoring/world-toolbar/InkPlate.svelte), [`registry.ts`](../../../../apps/editor/src/lib/authoring/world-toolbar/registry.ts) |
| geometry-core (T5) | Closed quadratic-midpoint profiles, exact `orient2d`, extrusion. No trig on canonical paths. | [`profile.ts`](../../../../packages/geometry-core/src/profile.ts) |

**geometry-core reuse:** nothing in C1 benefits from sharing. Both packages already wrap
`robust-predicates` behind their own one-line seams; the T5 profile curve (quadratic through
midpoints, closed, ≤ 50 m) is a different evaluation contract from Wall cubics. Do not import
geometry-core into layout-core for C1. Revisit only if C2 chooses a closed-cubic encoding and a
shared periodic sampler is genuinely identical.

## Capability sequence

```text
C1 layout.wall-curve-edit ──► C1b curved-host parity ──► C3 unfold (open cubic) ─┐
                         └──► C2a circle proof ──► C2 layout.circular-room ──────┴► C3 closed-circle unfold
```

| ID (proposed) | Outcome | Depends on | Status |
| --- | --- | --- | --- |
| **`layout.wall-curve-edit`** (C1) | Grab-anywhere bend; several curves in one Wall; knot move/remove; Straighten; curved Walls and their existing Openings stay selectable and editable | landed kernel | **Claimed by this PR** |
| C1b (fold into C1's id or `layout.curved-host-parity`) | New Openings placed on curved hosts; Ink attach/split on curved Walls; length/move/height/thickness marks on curved Walls; Walls plate **Arc** (draw then bend in one gesture) | C1 | Proposed |
| C2a `needs-research` spike | Decide the one-Wall circle encoding (below) with a bounded proof | none (parallel with C1) | Proposed; owner decision |
| `layout.circular-room` (C2) | Walls plate **Circle**: one self-connected Wall + one persistent Room; radius/diameter; stable seam; seam-crossing Openings; Plan/3D | C2a decision; Tier 2 format change | Proposed |
| `layout.wall-unfold` (C3) | Display-only reversible unfold/peel with isometric stations, Opening correspondence and inverse editing | C1; closed case needs C2; `needs-ux` | Proposed |

C1 first is the right dependency order: it is the only capability whose kernel is already proven,
it is format-neutral, and C2/C3 both need curved Walls to be first-class on the Stage (selection,
Opening marks on curved hosts, station picking). C2's expensive part (self-loop topology and
periodic stations) does not depend on C1 and can be proven in parallel.

## Decisions for the owner

| # | Decision | Recommendation | Tradeoff |
| --- | --- | --- | --- |
| **D1** | Body press on a selected Wall: bend or slide? | **Bend.** Press-and-drag anywhere on the body bends; the hollow span-midpoint points (the approved affordance) mark where curves can start; rigid slide keeps the two-way base ray (`layout-wall-move-mark`) and the Card ΔX/ΔZ fields. Amend the grammar's Wall row in this PR. | Matches the product direction and needs no mode. Loses body-press-to-slide, which the grammar approved (R217.S15). Fallback if declined: hollow midpoints only, body keeps sliding (Tier 1, no grammar change, less direct). |
| **D2** | Removing one bend point | Clicking a knot (no drag) makes it the **active bend point** (session state, never saved). The Card shows its X/Z and **Remove bend point**; Delete/Backspace removes the active knot instead of the Wall; Esc or a selection change clears it. | Discoverable and keyboard-reachable, no double-click semantics. Delete is overloaded while a knot is active. |
| **D3** | What Openings do when their host bends | **Keep arc station** (metres from the canonical start), as the schema already defines. An Opening that no longer fits refuses the whole edit, live and at release. | Openings slide visually along a reshaped curve; nothing is renormalised silently. |
| **D4** | Bend-point limit | Planner refusal above **32 knots per Wall** (`curve_knot_limit`); no codec change. | Bounds sampling, preflight and mark density. A reader-level cap would be a format restriction and is not needed. |
| **D5** | C1 scope boundary | Exclude new Opening placement and Ink attach/split on curved Walls (C1b). | Keeps the PR reviewable; a bent Wall cannot receive a new window until C1b. Including placement adds roughly one commit (sampled `ProjectedWall` + station helper) and is the main candidate to pull in. |
| **D6** | C2 encoding direction for the C2a proof | Lean **parametric closed circle** (reference candidate), but prove it against **closed cubic chain** first; see C2. | Exact radius and stations versus a single curve kind that C1's bend already edits. |

Unresolved and **not** decided here: C3's production UX (prototype is historical evidence, no
approved PLATE-era unfold surface), the D5 display-cut choices in the
[Layout reference](../../../reference/components/layout.md#focused-mechanisms-carried-forward), and
whether bending a circular Wall is ever wanted.

## C1 specification — `layout.wall-curve-edit`

### Interaction (Select tool, Plan and 3D readings)

The tool is the existing Select; the World toolbar is unchanged (Arc and Circle stay disabled).
Marks use the existing descriptor vocabulary in
[`stage-handles.ts`](../../../../apps/editor/src/lib/authoring/stage/stage-handles.ts); nothing draws its
own knob. All points project at the datum through the one `ViewportEvaluation`, so Plan and 3D read
the same marks.

| Selected subject | Marks |
| --- | --- |
| Straight Wall | Existing marks unchanged (end points, length ray, move ray, height stem, thickness), **plus** one hollow point at the Wall's mid-station |
| Curved Wall | End points (shared Junction X/Z via the existing junction-move planner); one **solid point per knot**; one **hollow point per span** at the span's arc-length midpoint. No length/angle/move/height/thickness marks (Card keeps Height and Thickness; C1b adds the rest) |
| Opening on a curved host | The existing Opening marks (slide point, width sides, head, sill; corners in 3D), placed along the host's canonical samples instead of a chord |

Gestures:

1. **Bend** — press on the selected Wall's body (the existing body-press resolution in the adapter:
   mark hit first, then `resolvePick` with `purpose: 'select'`; an Opening still outranks its host)
   or on a hollow point. The press resolves once to `distance` = arc station of the press (hollow
   point: its stored mid-station). Until the pointer passes the existing `isPointerDrag` threshold
   nothing changes; a click without drag is a no-op. While dragging, `point` = the datum point
   through `resolvePlanarDragSnap` (same snap policy and winner label as Room move; snapping never
   creates connectivity). A press within the knot-identity tolerance of an existing knot promotes it
   (the planner already does this; the adapter does not special-case it).
2. **Knot move** — press on a solid point and drag. Same snap path. Intent `curve-control-move`.
3. **Active knot** (D2) — click a solid point without dragging.
4. **Remove bend point** — Card action or Delete/Backspace with an active knot.
5. **Straighten Wall** — Card action on a curved Wall (`planConvertWallToLine`). Refused (with its
   reason) when Openings, topology or Rooms cannot survive.
6. **Exact bend point** — the active knot's X/Z through the existing `curve-point` numeric host
   (register it in `PLAN_NUMERIC_CONTROL_TARGETS` as `curve-control`), committing a knot move.
7. **Esc** cancels any live gesture, restores the accepted view and writes nothing.

Tag text follows the grammar's signed-change rule: `planarDeltaLabel` of pointer minus press point
during Bend/knot move; refusal words replace it when refused. The candidate preview is the dashed
centerline of the affected Wall (red with reason when refused), drawn through the existing candidate
preview channel.

### Intents and planners (editor)

New Layout intent kinds, registered like the existing precision planners (exact payload keys,
`addressedSubject` wall target, `preparedLayoutCandidate`). Put them in a new adapter module
`curve-planners.ts` beside `precision.ts`.

| Kind | Payload | Captured inputs | Core call |
| --- | --- | --- | --- |
| `layout-wall-bend` | `wallId, distance, x, z` | nonce + working level | `planBendWallCurveKnot(doc, wallId, {distance, point}, { knotId })` |
| `layout-wall-knot-move` | `wallId, knotId, x, z` | working level | `planMoveWallCurveKnot` |
| `layout-wall-knot-delete` | `wallId, knotId` | working level | `planDeleteWallCurveKnot` |
| `layout-wall-straighten` | `wallId` | working level | `planConvertWallToLine` |

Each valid release is one F.4 acceptance and one history entry; refusal and cancel write none.

**Identity:** the bend knot id is `layoutCapturedId(capture, wallId + ':knot')`, i.e.
`<wallId>:knot.<nonce>`, checked with `assertCapturedIdUnused` against the Wall's knot ids. Redo
replays the same id; a new bend after Undo gets a new nonce. The promote path allocates nothing.

### Core changes (layout-core, small and local)

1. `planBendWallCurveKnot` takes a **required** `{ knotId }` option and no longer calls
   `nextWallCurveKnotId`. Update `layout-identity-boundary.test.ts` to drop `planBendWallCurveKnot`
   from the uncaptured list (keep the allocator and the unwired planners listed; preview code may
   keep using the allocator only inside `resolveProposedCurveChain`, which never persists — if the
   source scan cannot express that, pass a fixed preview id such as `${wallId}:knot.preview`
   instead).
2. Knot limit (D4): `MAX_WALL_CURVE_KNOTS = 32`, refusal code `curve_knot_limit` from the bend and
   insert planners and from `resolveProposedCurveChain` (returns `undefined` → caller shows refusal).
3. Widen `readWallFirstDragProposal` to accept `curve-control-move` and `wall-bend` so the live
   path gets span, topology and Opening-subset verdicts from the existing code.
4. Export one station helper from `layout-wall-centerline.ts`:
   `projectPointToWallCenterline(wall, start, end, point) → { distance, point, distanceToPath }`,
   a thin wrapper over `wallCenterlineSamples` + `projectPointToSampledSegment`. It is the only
   pointer→station path for Bend presses and curved-host Opening drags.

No codec, compiler, face-extraction or reconciliation change is planned. If one appears necessary,
stop and report it.

### Editor changes

- **Curved Wall frame.** Add a `curvedWallFrame(document, wallId)` next to `wallFrame` in
  `precision.ts`: Junction ids/points, canonical samples, arc length, knots, span mid-stations and
  points. `wallFrame` stays straight-only; nothing that solves straight-Wall length/angle reads the
  curved frame.
- **Bend gesture module.** A framework-free `wall-bend-gesture.ts` (pattern of `wall-gesture.ts`)
  owns press→station, drag→intent, threshold, tag and the D2 active-knot state. The adapter binds
  it; keep new code out of the 4,900-line adapter body where a module seam exists.
- **Live path** reuses `createWallDragReader(baseline)` (gesture-scoped sampling + verdict scope).
- **Openings on curved hosts.** Generalise `openingSpan` / `openingGhost` / the Opening mark frame to
  evaluate `at(distance, elevation)` from canonical samples (`pointAtDistance` + sample normal), and
  map slide/width drags through `projectPointToWallCenterline`. Straight hosts keep today's exact
  chord math.
- **Card.** Curved Wall facts: Length (arc, read-only, labelled as arc length), Bend points (count).
  Actions: Straighten Wall; Remove bend point when a knot is active.
- **Grammar** (D1 approved): replace the Wall row's "the selected body slides along its normal"
  with the bend rule, and replace the "specified but not admitted" sentence with the admitted hollow
  point. Update the shell contract's matching open-problem bullet. No other reference changes.

### Validity and identity requirements

- Wall, Junction, Opening and Room ids never change across bend, knot move/remove, straighten, Undo
  and Redo. Room boundary refs and Opening `wallId`/`offset` are byte-identical.
- Untouched spans stay byte-identical (the algebra's contract); a bend inserted and released at the
  press point persists the exact partition.
- A bend that crosses another Wall in the same connected group, self-intersects, folds the finite
  thickness, or leaves an Opening outside the new arc length refuses live where the preflight can
  know it, and always at release.
- Session state (active knot, gesture, hover) is never serialized and never enters history.
- Visitor chunks gain no import from the new modules (`release.visitor-isolation` gates).

### Performance

Follow [Layout performance rules](../../../reference/components/layout-performance.md). Per pointer
move: one `resolveProposedCurveChain`, one affected-Wall sample, the scoped preflight and the
Opening subset check — no planner, reconciliation, compile, capture or history. Release: one intent,
the canonical planner once. Test this at the **mounted gesture boundary** with the existing planner
observers (`setTopologyGateObserverForTest`, `setWallFirstTopologyEvaluationObserverForTest`,
`setWallSamplingObserverForTest`): N moves call no finalize/compile and touch only the bent Wall's
samples; release accepts once. No timing gate (none exists after #115).

### Checks

Tag new tests `[cap:layout.wall-curve-edit core]` or `edge`.

| Check | Kind | Lane |
| --- | --- | --- |
| Bend a straight Wall mid-body → one knot, one history entry, Wall/Room/Opening ids unchanged; Undo restores bytes; Redo replays the same knot id | core | fast |
| Second bend elsewhere on the same Wall → two knots, first span byte-identical | core | fast |
| Knot move, Remove bend point, Straighten each one entry; Straighten refuses when an Opening cannot fit | core | fast |
| Bending a bounding Wall keeps its Room id and updates area | core | fast |
| Bend into a crossing / self-intersection / Opening overflow refuses live and at release, writes nothing | edge | fast |
| Press near an existing knot promotes it (no new id) | edge | fast |
| Captured knot id: new nonce after Undo, `captured_id_in_use` on collision; boundary test updated | core | arch + fast |
| Mounted gesture: preview changes per move without finalize/compile/history; Esc restores; release installs once | core | fast |
| Opening on a curved host: select, slide along arc, resize width; numeric offset exact | core | fast |
| Curved Wall marks admitted, projected identically in Plan and 3D; hollow points at span mid-stations | edge | fast |
| 33rd knot refuses `curve_knot_limit` | edge | fast |
| Browser flow: draw a Wall, bend it twice, add nothing, Undo ×2, Redo ×2, save/reload, visitor Preview shows the same curve | core | e2e in the existing stage-conformance pattern |

Merge gate: the full contract in the [test README](../../../../apps/editor/tests/README.md#what-a-change-requires)
(`check`, `test:arch`, `npm test`, `test:heavy`, `build`, package checks). The owner checks the
interaction in the browser before merge (Tier 2).

### Out of scope for C1

New Openings on curved hosts and Ink attach/split on curved Walls (D5); length/move/height/thickness
marks on curved Walls; Arc and Circle plates; tangent handles or corner (non-smooth) knots;
snapping knots onto other geometry; Junction dissolve UI; closed Walls; unfolding; any format change.

### Commit sequence (after approval, same PR)

1. Ledger + grammar text (if D1) — no code.
2. Core: required knot id, knot limit, widened drag reader, station helper, with tests.
3. Editor: curve planners and captured identity; boundary test.
4. Editor: curved Wall frame, marks, Bend/knot gestures, live preview, Card facts/actions.
5. Editor: Openings on curved hosts.
6. Browser flow; delete this plan, keeping any enduring rule in the grammar/Layout reference.

## C2 — one-Wall circular Room (proposed, not authorised)

Accepted outcome: [one self-connected, continuously curved Wall enclosing one persistent Room](../../../reference/components/layout.md#a-circular-enclosure-needs-one-self-connected-continuously-curved-wall).
The encoding is proof-gated. The archived
[continuous spatial authoring umbrella](../../../archive/technical/spatial/continuous-spatial-authoring-umbrella.md)
§3.4.1 has the detailed workflow; the comparison that matters:

**Shared by both encodings (most of the cost):** the codec rejects `startJunctionId ===
endJunctionId` today (`layout-wall-first-codec.ts:608`); face extraction compares outgoing edges by
Junction chords and finds twins by Wall id and destination, which cannot tell a loop's two ends
apart (`compareOutgoingEdges`, `nextCounterClockwiseFaceEdge`); Room reconciliation requires at
least three boundary refs (`layout-room-reconciliation.ts:144`); Opening intervals are linear; Junction
resolution and the mesh would cap the seam. Every one of these needs a self-loop / periodic case
whichever curve kind wins.

| | Parametric closed circle | Closed cubic chain |
| --- | --- | --- |
| Data | New centerline kind: authored center + orientation; seam Junction `J` is both ends; radius = \|J − center\| | Existing `cubic-chain` with equal end Junctions; creation writes 8 symmetric spans |
| Radius / diameter | Intrinsic and exact; one operation moves `J` radially | Nominal only while the chain is still circular; must label nominal vs measured and define edits without a second authority |
| Stations | `L = 2πr`, angle = s / r, exact | Arc length by quadrature (existing); 8-span radial error ≈ 4·10⁻⁶ r (≈ 0.2 mm at 50 m) |
| Bending | Refused, or explicit conversion to a closed chain later (a second kind and a conversion) | Works with C1's tools unchanged |
| New dispatch | Every `SampleableSegment` consumer gets a circle case | None |

Recommendation for the C2a spike (D6): build the shared self-loop/periodic seam once on one isolated
fixture at a nonzero datum, then evaluate both encodings on it for radius edit semantics, station
error and consumer churn. Lean parametric because radius/diameter editing is an accepted
requirement and bending circles is not; switch to closed cubic if the owner wants circles to be
bendable without conversion. C2 is Tier 2 (incompatible format: bump with strict refusal; no
migration, per the pre-baseline rule).

## C3 — unfolding / peeling (proposed, not authorised)

| | Demonstrated | Not yet proven in production |
| --- | --- | --- |
| Display map | Prototype's isometric unroll for **circular arcs only**: `k = (1 − u) / r`, distance along the sheet equals arc length at every `u` ([implementer reference](../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md)) | General cubic chains. Natural generalisation: scale the turning-angle function about an anchor, θ_u(s) = θ(s_A) + (1 − u)(θ(s) − θ(s_A)), integrate unit tangents — isometric by construction, equals the prototype for a circle |
| Inverse | Screen-space nearest-point scan on the displayed wall (5 cm then 5 mm) | Station/height round-trip within the planner tolerance on compiled samples; refusal where the displayed sheet self-overlaps |
| Geometry | Analytic caps from centerlines; re-tessellated every frame; Openings picked by jamb proximity | Mapping compiled wall meshes (thickness, reveals, joins) needs per-vertex station/offset/height attribution the mesh builder does not export today |
| Identity | Seam-crossing Opening shown in two fragments | One Opening, two display fragments, one edit, against a real periodic host (needs C2) |
| Camera | Prototype tween engine | Face/square-up must realise through the one Camera authority |

C3 needs a `needs-ux` design for the PLATE-era shell and a bounded `needs-research` spike on mesh
attribution before any implementation plan. Open-cubic unfold can follow C1; closed-circle unfold
cannot be accepted before C2.

## Risks

| Risk | Mitigation |
| --- | --- |
| Body-bend surprises users who expect slide (D1) | Hollow points and the grab cursor signal bending; the move ray remains; the owner reviews in the browser |
| Live path regresses to full planners | Mounted-gesture observer test is core, not edge |
| Curved Opening marks drift from compiled geometry | Marks read the same canonical samples the compiler uses; tests compare mark anchors to compiled Opening intervals |
| Adapter growth | New logic lives in `wall-bend-gesture.ts` and `curve-planners.ts`; the adapter only binds |
| Knot ids after split carry the original Wall id prefix | Ids are opaque; codec uniqueness is per Wall; a captured nonce keeps them globally unique |
