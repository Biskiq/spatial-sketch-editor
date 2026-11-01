# Post-S10 convergence — target specification

**Planning target, not a contract and not a release.** Landed contracts keep describing current behaviour until a released slice cuts over. Audit base `9139f3c2`. [Owner decisions](./owner-decisions.md) O1–O9 were accepted on 2026-10-30, and this document applies them. The work is registered as R217.S12–S25; slice names below refer to those plans.

**Governing goal.** Biskiq should feel effortless, with the wireframe as the minimum baseline and no loss of the depth already built. Visual parity is never bought with lost function. Nothing here changes a persisted format. Candidates, previews, generated names, selection, height and ghosts stay session-only.

## Drafting: Grid, Snap and ruler

These were checked against every consumer: Ink, Scene placement and Move, Measure, Height Sheet stepping and the Head's viewing menu all read one seam, `draftingSnapIncrementMeters` fed by `drawnGridMinorMeters`.

**Toolbar (O8, O5).** `2D | 3D · Grid · Snap · ⚙`. Words only, off state struck through and named as a word, as in the wireframe. No ratio or interval control. The ⚙ holds viewing preferences only (2D appearance, Height Sheet side, reduced motion, motion speed), never a drafting value. A held Alt still reads `Snap held`.

**Values (O7).** Snap is a fixed 0.5 m and Grid draws 1 m minor and 5 m major. Zoom never changes either. Consumers read a fixed increment instead of the drawn level, which is one change at one seam.

**Thinning.** Drawing only, using PLATE's existing rule: a level fades from 16 to 8 CSS px spacing and hides below 8. If 5 m hides, a single 25 m level appears so very large sites keep a reference. No level finer than 1 m appears; the snap mark shows where a point lands.

**Paper grid (D39, distinct from the 3D clipping defect).** A bounded sheet that frames the work:

```text
extent = bounds(Layout ∪ Scene ∪ live candidate) expanded by 5 m, rounded outward to 5 m
empty project = 20 × 20 m centred on the target
```

It has crisp edges, like a sheet of drafting paper. It grows when a candidate leaves the sheet and never moves the Camera. PLATE's inks stay. `gridPlanFor` already separates surfaces, so this changes the Paper branch only and the mat keeps its own coverage.

**Ruler.** `StageScaleBar.svelte` becomes a 1 px horizontal line with 5 px perpendicular end ticks and the distance label centred below it. No fill, border or badge. Ink comes from the surface. Shown in Plan only, because a perspective length is true only at the target plane. It stays bottom-left and rises only when it would actually overlap the lower column.

**Zoom cluster (D40).** Lower right: zoom in, zoom out, Fit, moving aside for the Height Sheet as in the wireframe. Fit uses the existing `fit` intent; zoom steps use the same Camera zoom the wheel drives, by a factor of 1.25 per press.

**Preserved, not removed.** Scale detents via Find; the `f` key as today; Alt for a free point; typed values everywhere. The values are named constants in one module, so a later preference has one seam to extend.

## One snap service

There is no new engine and no new snap geometry. Layout's policy is a small module in the Layout adapter that chooses what is allowed per operation and calls the existing resolvers against the captured baseline, with the moving owners excluded, as pre-prune did. Scene keeps `snapDraftingPoint`.

| Operation | Allowed targets, highest first | Falls back to |
| --- | --- | --- |
| Ink Wall point | Existing Junction and host targets; `orthogonal-guide` from the last point | Grid 0.5 m |
| Junction drag from a selected Wall | `orthogonal-guide` from that Wall's other end | Grid 0.5 m |
| Hovered Junction drag | — | Grid 0.5 m |
| Wall body and two-way grip | — | Normal distance in multiples of 0.5 m |
| Wall length ray | — | Length in multiples of 0.5 m |
| Opening slide | `resolveOpeningDragSnap` edge and centre targets | Offset in multiples of 0.5 m |
| Opening width | — | Width in multiples of 0.1 m |
| Scene and form Move | — | Grid 0.5 m, as today |
| Turn | Existing Turn steps | — |

A Junction may not snap onto another Junction or a Wall, because the planner refuses both; offering the target would promise a refused result. Alt suspends every row. The acquisition radius is `resolveLayoutSnap`'s existing 8 CSS px.

**Snap mark.** At the winning point, a small mark plus a one-word tag: `Junction`, `Aligned`, `Grid`, as the grammar requires. Nothing shows when nothing is winning.

## Hit priority

One table for Plan and 3D, Select tool, fine and coarse pointers. Applies O9.

| # | Press lands on | Click | Drag |
| --- | --- | --- | --- |
| 1 | A live gesture exists | — | The owner keeps it; a second pointer cancels and hands navigation the pair |
| 2 | An armed tool or open task | Tool decides | Tool decides, else navigation |
| 3 | Disclosure mark | Reveals | Nothing |
| 4 | Edit mark of the selection (22 px, 44 px coarse) | Nothing | That mark's edit |
| 5 | Selected subject's body, when the pick winner **is** that subject | Keeps selection | Edits, per the tables below |
| 6 | Hovered Junction, mouse in Plan only | Nothing | Junction move |
| 7 | Other geometry | Selects the winner | Pans |
| 8 | Empty Stage | Clears selection | Pans; Shift-drag orbits in 3D |

**Rules that make the table safe:**

- **Press resolves the pick once.** An Opening within a selected Wall is a different winner, so clicking it selects the Opening and dragging it pans.
- **Below 4 CSS px of travel, a press is a click.** The adapter's gesture ends without a commit and the click runs normally.
- **A zero delta commits nothing.**
- **Cursor tells the truth:** `move` over a draggable selected body, `grab` for navigation, `crosshair` under Ink. Hover ink stays neutral.

## Wall direct manipulation

Reads the existing `planRigidWallMove`, `planExactJunctionMove` and `planExactWallLength`. **No planner changes and no second geometry authority.** Applies O2 and O6.

| Target | Drag does | Planner | Tag |
| --- | --- | --- | --- |
| **Body** | Slides along the Wall's normal. Both Junctions move by one delta | `planRigidWallMove` | `Move 0.50 m` |
| **Two-way grip** | Same as body. Kept as the visible and touch affordance | `planRigidWallMove` | `Move 0.50 m` |
| **End point** | Moves that Junction freely in X/Z | `planExactJunctionMove` | `Length 4.00 m · 90°`; shared adds `· 3 Walls` |
| **Length ray** | Changes length along the Wall's own line; other end fixed | `planExactWallLength` | `Length 4.00 m` |
| **Shared Junction, hovered** | Same as end point, without selecting anything | `planExactJunctionMove` | As end point |

**Marks stay screen-calibrated.** Typing digits during a drag uses the existing numeric entry: a distance on body and ray, and X then Z on a point. **Non-pointer path:** the Card gains Start X/Z and End X/Z under a disclosure, using the same planner, because the grammar requires each precision operation to have one.

### Topology

| Situation | Behaviour |
| --- | --- |
| Shared Junction | Stays shared. Every incident Wall follows; none detach |
| Neighbour Walls | Change length and angle. Their identities, thickness and height are preserved |
| Free-standing Wall | Moves with nothing else affected |
| Openings on the moved Wall | Keep identity, host, offset, width and profile |
| Openings on a reshaped neighbour | Keep their offset. If one no longer fits, the whole candidate is refused; **Openings are never re-seated silently** |
| Junction onto a Junction or across a Wall | Refused by the planner. No merge exists |
| Room identity or portal relation breaks | Refused atomically |
| Curved Wall | Its Junctions and rigid move use the same planners; curve marks stay deferred. If `wallFrame` returns null, Card only |
| Scene objects in a changed Room | Unaffected by this gesture. They are not re-supported and show their own state after commit |

### Feedback, cancellation and Undo

| State | Shown |
| --- | --- |
| **Preview** | The planner's candidate: moved Wall in selection ink, each reshaped neighbour in a neutral outline, over the accepted drawing. In 3D, the candidate's footprint at the datum, not the full Wall mesh; no Layout candidate mesh is added |
| **Valid** | Value tag at the gesture; snap mark at the winning point |
| **Invalid** | Candidate removed, since no valid one exists. A thin neutral dashed line to the pointer and a tag with a readable reason near it. Never red, which means erase, and never a clamp to the last valid pose |
| **Refusal words** | Human text from the adapter, for example `This would cross another Wall`, never a raw id or code |
| **Cancel** | Escape, blur, hidden page, capture loss, second pointer: no trace. A reading flip keeps today's paused proposal |
| **Release** | Valid: exactly one Undo step with a named label, for example `Move Wall`. Invalid: nothing, and the tag says why |
| **Undo** | Unavailable during the gesture, with its reason, as today |

## Plan authoring

The full evidence, row by row, is in the [Plan authoring audit](./plan-authoring-audit.md).

**Candidate preview.** Adapters publish one optional contribution, drawn by the Stage and never persisted:

```ts
type StageCandidatePreview = {
	readonly id: string;
	readonly role: 'subject' | 'affected' | 'refused';
	readonly polygons: readonly (readonly Vec3[])[];
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly labels: readonly { readonly world: Vec3; readonly text: string }[];
	readonly snap?: { readonly world: Vec3; readonly name: string };
};
```

**Agreement.** Preview polygons come from compiling the planner's candidate document, the same output release commits. A test asserts the drawn preview equals the accepted geometry for every Wall, Opening and Scene operation.

**Coordinates (D15).** `inkOverlay` stops subtracting the rect, since the facade translates once.

**Drawing.** While armed, the Stage shows a cursor point with its snap mark. After the first point: a live line, `length · angle` tag, and refusal text. Wall hover must update the chain, which `hoverIntent` skips today. Box shows its live outline and both dimensions. Opening shows its aperture on the host with distance to each end.

**Ink palette.** It must not cover the drawing, per the [lower edge](#lower-edge-height-sheet-and-responsive) rule below.

**Openings.** A Plan click within an Opening's aperture selects the Opening, and Select uses the same Opening-over-host rule the Eraser already uses. A selected Opening's body drag slides it along its host, with position track and width ray kept. Door swing is [deferred](./owner-decisions.md#deferred-door-swing).

**Objects and forms.** A selected object's or form's body drag is Move, using the existing `place-on-floor` planner. Turn and Size keep their marks. Marks must not crowd a small subject: below 48 px across, the Turn ring and Scale point stay at their fixed screen radius and the body remains Move.

- **Paper ghost:** the candidate's footprint through the preview type, including concave and tilted forms.
- **3D ghost:** candidate meshes, nonpickable and ephemeral.
- **Model ghost:** approved bounds, marked as a proxy, never guessed.
- **Off a floor:** the refused state, with the Scene planner's reason.
- **Placement:** Objects shapes arm click placement with a live ghost. Typed X/Z stays as the precision path, defaulting to the visible target rather than world zero.

**Selection.** See [Selection](#selection).

**2D and 3D.** Same hit table, planners, candidate, tags, cancellation and Undo. Plan keeps X/Z and yaw; height and vertical-axis marks are withheld there.

## Camera basis

**Cause.** `upForReading('plan', azimuth)` returns `[sin a, 0, cos a]`, while the projection of world +Y approaching overhead tends to `[-sin a, 0, -cos a]`, so the basis turns 180° at the threshold.

**Target.** Negate that one vector. Transitions, pan and `viewScreenBasis` inherit the fix. Target, target-plane scale, nearest-quarter-turn snapping, remembered elevation and detented azimuth are preserved. Restoring an earlier arbitrary azimuth is a separate change and not part of this. Applies O3.

**Proven by the [probe](./evidence/rendering-investigation.md#candidate-fix-probe):** minimum consecutive right-vector dot goes from −1 to 0.999998. No existing test pins the sign, so S12 adds one.

## 3D ground clipping

**Cause.** Far clip, near clip (D28) and a four-ray footprint that loses coverage. Distinct from the Paper grid.

**Camera (`viewport.ts`).** `ViewportCameraInput` gains optional session field `displayGroundYMeters: number | null`, default `null`. The Stage supplies the datum through `camera-session.ts`. It never enters scene bounds or fit. For non-orthographic evaluations with a ground plane:

```text
extent     = targetPlaneHeight × max(1, aspect)
eyeHeight  = eye.y − displayGroundY
reach      = max(24 × extent, 64 × eyeHeight)
far        = max(distance + sceneRadius, distance + reach)
groundNear = eyeHeight × cos(halfFov) / sin(elevation + halfFov)   when eyeHeight > 0 and the angle is positive
near       = max(NEAR_FLOOR, min(distance − sceneRadius, 0.9 × groundNear))
```

**Amended 2026-10-31** by the [S19 plan §3b](../r217.s19-3d-ground-clipping/implementation-plan.md#3b-amendment--2026-10-31): the eye-height multiple is 96, the mat grid is drawn per pixel with no footprint or line budget, and the mat writes no depth instead of taking a polygon offset. The paragraphs below are the original specification.

**Grid (`stage-grid.ts`, mat branch).** Replace four corner rays with the exact frustum and datum intersection, so coverage and clipping cannot disagree. Budget: at most 6,000 lines, major lines never dropped; over budget, the minor rectangle shrinks around the target. Fixed levels from O7 replace the ladder here too.

**Mat (`StageCanvas.svelte`).** Centred on the quantised target, half-extent at least 1.5 × reach, with a polygon offset.

**Residual.** A horizon band up to about 12 CSS px at 900 px may remain, as O4 accepts. If it reads badly in S19's browser check, the slice uses O4's fade alternative, which never counts as passing a numerical row. The [slice plan](../r217.s19-3d-ground-clipping/implementation-plan.md#3a-experimental-checkpoint) owns the checkpoint, pass criteria and fallbacks. **Excluded:** infinite grid, disabled depth tests, moving the Camera, widening semantic bounds, a second evaluator, timing assertions.

## Selection

Stage ink stays on actual geometry with canonical identity. Paper uses polygons `plan-scene-footprint.ts` already owns.

| Subject | Paper fill (.22 gold) | Paper edge (`#74560c`) | 3D fill (.28 gold, depth-tested) | 3D edge |
| --- | --- | --- | --- | --- |
| Wall | Existing Plan polygons | Union boundary | Mesh clone | Gold with dark halo |
| Opening | Aperture polygon only | Aperture boundary | Synthetic aperture box | Gold with dark halo |
| Primitive, catalogue | Footprint `points` | Footprint segments | Mesh clone | Gold with dark halo |
| Approved model | Approved footprint; contour only if none | Footprint segments | Mesh clone | Gold with dark halo |
| Native form | Concave ring, or `polygons` when tilted; never a bounding rectangle | Footprint segments | Mesh clone | Gold with dark halo |

Paper fills sit under cut ink and are never a hit source. 3D stays depth-tested, with no x-ray. Hover stays neutral and untinted; a selected identity suppresses its own hover. Opacity and Paper edge apply O1.

## Shell

Values calibrate the wireframe against PLATE's roles. Roles live in one scoped shell stylesheet. No global font shrink and no CSS scale. Coarse targets stay at least 44 × 44 px.

| Role | Target |
| --- | --- |
| Type | 13 px ordinary sans; 12–12.5 px utility; 15 px serif project identity; tabular measures |
| Colour | Forest `#11291f`; mat `#1D3A33`; paper `#e9ebe6`; Index `#f6f7f5`; Card white; gold `#d4ad45`. Active lens pale with forest ink. Hover neutral |
| Density | Fine-pointer Head 44 px, Index 256 px, Card 288 px |

### Head

Order: Index toggle · Biskiq · serif project name · World / Experience · context chip · Find · Undo · Redo · Save · gold Preview.

- Eligibility and refusal semantics are unchanged; the words move into a focus, hover and tap disclosure with an accessible description.
- `Technical details` and the Stage's `Open source JSON` leave the ordinary surface. Viewing preferences, Keys, rename, delete, source download, source replacement and Scale detents each get a Find entry from S20.
- Permanent homes, per O5: viewing preferences in the Stage's ⚙; rename, delete, source download and source replacement under the project name. The ☰ menu leaves.
- The context chip shows real canonical location only.

### Index and Card

- **Index rows:** one compact line with a human label. Select, Open location and Bring into view stay distinct but disclosed.
- **Labels:** authored name, then a session-stable `Kind n` by sorted identity, with full identity available to assistive technology. Never serialized.
- **Card facts** gain an optional `fieldId`; a fact with a writer for that field is not repeated. `Stream`, `Eligible`, `Revealed` and `Domain` leave the ordinary Card.
- **Card actions** gain optional `group: 'primary' | 'secondary'`. Only `destructive: true` gets destructive styling, so Duplicate stops looking dangerous.

### Lower edge, Height Sheet and responsive

- **Measured geometry.** The route publishes Index, Card, Sheet-lane and dock spans as CSS variables, replacing the fixed `.reserved-height`. **A layout change never moves the Camera.**
- **Card during a gesture (D36).** While a gesture is live, the Card fades and takes no pointer events, returning on release. It holds its position through a refusal, and stays collapsed if the user collapsed it. It never expands because of a commit.
- **Height Sheet.** Thin line with knob and semantic ticks. Value on focus, drag and touch. Heights, pins, found tops, side swap and keyboard input preserved. The pin hint appears only on first pin use and clears by itself.
- **Ink palette.** Compact icons and modes in a single row above the dock, keeping typed X/Z, Finish, Backtrack, Cancel and Wall Box. Shape is not in Ink (O10). Parameters that need room disclose upward.
- **Notices.** `Nothing selectable there.` no longer appears on an ordinary empty click.
- **Constrained widths** (1280, 1180, 820 px). Index starts collapsed and opens as a sheet with an explicit scrim that stops above the dock. Dock, palette and drafting controls stay usable.

### Experience

Shared homes: lens in the Head, locator in the Index, selected facts in the Card, an invoked Guide on the lower edge, closed by default. Capture, View, first-Guide intent, travel-gap behaviour, F4 history and isolated Preview are unchanged.

## Non-goals

No new geometry or picking authority, new snap geometry, door swing, global shell rewrite, Junction merge, Wall height or thickness grips, angle ring, curve marks, Slice or Brush, Levels, publication feature or visitor authoring machinery. No removal of imported models, native-form axis sizing, catalogue uniform scale, Paper and shaded preference, or typed precision. No formal performance benchmark: [the mandate is suspended](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md), so slices assert deterministic bounds and observed smoothness.
