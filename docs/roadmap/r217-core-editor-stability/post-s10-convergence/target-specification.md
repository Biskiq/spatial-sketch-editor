# Post-S10 convergence — target specification

**Proposal, not a contract and not a release.** This records what the convergence work should produce so the owner can rule on it. Landed contracts keep describing current behaviour until a released slice cuts over. Audit base `9139f3c2`. Findings are in the [drift register](./drift-register.md); the work is ordered in the [execution plan](./execution-plan.md).

**Rule across every section:** match the accepted wireframe's look while keeping the production interaction model. The wireframe is a minimum baseline, not a reason to remove later capabilities, and historical behaviour is evidence of a missing capability, never code to copy back. Nothing here changes a persisted format. Candidates, previews, generated names, selection, height and ghosts stay session-only.

## Owner decisions

Each decision gates only the slice named. Everything else can proceed without it.

| # | Decision | Recommendation | Gates |
| --- | --- | --- | --- |
| O1 | Selection strength and Paper ink. Revises S07's accepted 0.18 tint and bright Paper gold | Mat tint .28 with gold edge; Paper tint .22 with dark gold edge, per [Selection](#selection) | C10's calibration. The missing Scene Paper fill is a defect and needs no ruling |
| O2 | How a shared Junction is moved. Endpoint drag stays length, per S07 | Explicit Card action that arms one square Stage mark, per [Junction](#junction-manipulation) | C07 |
| O3 | Plan orientation changes. At azimuth 0 Plan goes from right −X, up +Z to right +X, up −Z | Accept: it is the only orientation continuous with 3D, per [Camera](#camera-basis) | C08 |
| O4 | Display-ground reach, line budget and horizon band | Accept the values in [Ground and grid](#ground-and-grid) | C09 |
| O5 | Permanent home for utilities displaced from the Head | Viewing preferences in the Stage's existing settings control; project lifecycle and source under the project name, per [Head](#head) | C01's final placement. An interim Find route means this cannot block visual work |

## Camera basis

**Cause.** `upForReading('plan', azimuth)` returns `[sin a, 0, cos a]`. The projection of world +Y as elevation approaches overhead tends to `[-sin a, 0, -cos a]`, so the view basis turns 180° when the pose crosses the near-overhead limit.

**Target.** Negate that one vector. No new basis derivation is needed: both sides of the threshold then agree, and transitions, pan and `viewScreenBasis` inherit the fix because they already read `viewUpForPose`.

**Preserved:** target, target-plane scale, nearest-quarter-turn snapping with its tie rule, remembered elevation, and the detented azimuth on return. Restoring an earlier arbitrary azimuth is a separate behaviour change and is not part of this.

**Proven by the [probe](./evidence/rendering-investigation.md#candidate-fix-probe):** across 21 pose combinations the minimum consecutive right-vector dot goes from −1 to 0.999998. No existing test pins the sign, so C08 must add one.

**Gate reading.** `T1.viewport-projection@1` fixes right-handedness, +Y up and the evaluation's shape, not a Plan screen-up, so this is a behaviour change without a new gate version. The owner confirms that reading under O3.

## Ground and grid

**Cause.** Three separate defects, one of which the first audit pass missed:

1. **Far clip.** `depthRange` bounds clip planes to the scene sphere. Ground beyond it is clipped even where grid geometry exists.
2. **Near clip (new).** At low elevations, ground close to the Camera is nearer than `distance − sceneRadius`, so a straight band of grid and mat disappears at the bottom of the frame.
3. **Footprint.** Four corner rays miss the ground whenever a corner is above the horizon, and accept hits beyond the far plane. Coverage and clipping can therefore disagree.

**Camera target (`viewport.ts`).** `ViewportCameraInput` gains an optional session field `displayGroundYMeters: number | null`, defaulting to `null`, which leaves today's behaviour intact. The Stage supplies the datum through `camera-session.ts`. It never enters authored scene bounds or fit. For a non-orthographic evaluation with a ground plane:

```text
extent     = targetPlaneHeight × max(1, aspect)
eyeHeight  = eye.y − displayGroundY
reach      = max(24 × extent, 64 × eyeHeight)
far        = max(distance + sceneRadius, distance + reach)
groundNear = eyeHeight × cos(halfFov) / sin(elevation + halfFov)   when eyeHeight > 0 and the angle is positive
near       = max(NEAR_FLOOR, min(distance − sceneRadius, 0.9 × groundNear))
```

Orthographic Plan keeps its exact depth range. `24` is the footprint clamp the Stage already accepts. Extending far costs almost no depth precision, because perspective precision is dominated by near (`dz ≈ z² / (near × 2²⁴)`); lowering near is the costly direction, so C09 tests it in the browser against wall and mat contact.

**Grid target (`stage-grid.ts`).** Replace the four corner rays with the exact intersection of the evaluation's frustum and the datum plane: unproject the eight frustum corners, intersect the twelve edges, and take the bounds of the hits. Horizon crossings then need no special case, and because the footprint reads the same frustum the Camera clips with, **coverage and clipping cannot disagree**.

**Budget.** The exact footprint raises the probed maximum from 1,998 to 11,138 lines, so a budget is required:

- at most **6,000 lines** per drawing, as a tested deterministic bound and not a timing gate;
- major lines are never dropped;
- over budget, drop the fading level first, then shrink the minor rectangle around the target until the drawing fits.

**Mat target (`StageCanvas.svelte`).** The mat is centred on the quantised target with half-extent at least 1.5 × reach, because reach can pass the fixed 6000 m sheet at the largest zoom. It takes a polygon offset so grid and mat cannot fight at distance.

**Acceptable residual.** At very shallow poses a thin band may remain before the geometric horizon, up to about 12 CSS px at 900 px height. It reads as the ground's edge against the background and cannot be a straight cut through drawn grid. O4 accepts or tightens this.

**Excluded:** an infinite grid, disabled depth tests, moving the Camera, widening semantic scene bounds, a second evaluator, and any timing assertion.

## Selection

Stage ink stays on actual geometry and keeps canonical identity. Paper uses the polygons `plan-scene-footprint.ts` already owns, with no new picking bounds and no independent footprint reconstruction.

| Subject | Paper fill (.22 gold) | Paper edge (dark gold `#74560c`) | 3D fill (.28 gold, depth-tested) | 3D edge (gold, dark halo) |
| --- | --- | --- | --- | --- |
| Wall | Existing Plan polygons | Union boundary | Selected mesh clone | Existing contour |
| Opening | Aperture polygon only; never the host Wall | Aperture boundary | Existing synthetic aperture box | Existing contour |
| Primitive, catalogue | Footprint `points` | Footprint segments | Mesh clone | Existing contour |
| Approved model | Approved footprint only; **no fill and contour only if none exists** | Footprint segments | Mesh clone | Existing contour |
| Native form | Concave ring, or `polygons` for a tilted form; never a bounding rectangle | Footprint segments | Mesh clone | Existing contour |

- **Order.** Paper fills sit under cut ink so the drawing stays legible. They are never a hit source.
- **Occlusion.** 3D stays depth-tested, with no x-ray fill. Hidden or unsupported subjects draw nothing.
- **Hover.** Stays neutral, thinner and untinted. A selected identity suppresses its own hover. The red Eraser tone is unchanged.

The opacities and Paper edge are O1's calibration. Returning real fills for Scene subjects is a confirmed defect fix and proceeds regardless.

## Drafting feedback

**Coordinates (D15).** The facade already translates overlay CSS once, so `inkOverlay` must stop subtracting the rect. The test is that a marker's position is unchanged as the Index opens and closes.

**One candidate preview (D16).** A new optional adapter contribution, drawn by the Stage in the overlay and never persisted:

```ts
type StageCandidatePreview = {
	readonly id: string;
	readonly tone: 'candidate' | 'refused';
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly polygons?: readonly (readonly Vec3[])[];
	readonly labels: readonly { readonly world: Vec3; readonly text: string }[];
};
```

Wall, Box and Opening fill it from the planner's own candidate, so it can never show what the planner would refuse. Wall hover must update the chain, which `hoverIntent` skips today. Labels carry live length, angle, snap and refusal. There is one current candidate and no second compiler.

**Scene and form ghosts (D17, D18).** In Paper, draw the candidate's footprint through the same preview type, since meshes on the world layer are masked there. In 3D, keep candidate meshes, nonpickable and ephemeral. An approved model's ghost uses approved bounds and is marked as a proxy, never guessed geometry.

## Junction manipulation

S07's rulings stand: endpoint drag edits length, and the angle ring and height and thickness grips stay removed. The gap is that a shared Junction cannot be moved at all.

**Recommended activation (O2).** The selected Wall's Card offers **Move start junction** and **Move end junction** under a disclosure. Choosing one arms a single square Stage mark at that node and hides the Wall's other marks. Free XZ drag previews every incident Wall through the existing neighbour preview, with grid snap. Release commits one Undo step; Escape or a refusal leaves no trace. It needs no modifier key, so it works on touch.

**Authority.** A new `layout-junction-move` planner kind in `precision.ts` wraps `planExactJunctionMove`, integrated through F4. The old viewport and snapshot Undo are not restored.

## Shell

Values are calibrations of the accepted wireframe against PLATE's roles, and PLATE stays the authority for the roles themselves. Roles live in one scoped shell stylesheet, not in scattered component CSS. There is no global font shrink and no CSS scale transform. Every coarse target stays at least 44 × 44 px.

| Role | Target |
| --- | --- |
| Type | 13 px ordinary sans; 12–12.5 px utility; 15 px serif project identity; tabular measures |
| Colour | Forest `#11291f`; mat `#1D3A33`; paper `#e9ebe6`; Index `#f6f7f5`; Card white; gold `#d4ad45`. Active lens is pale with forest ink. Hover is neutral |
| Density | Fine-pointer Head 44 px, Index 256 px, Card 288 px |

### Head

Order: Index toggle · Biskiq · serif project name · World / Experience · context chip · Find · Undo · Redo · Save · gold Preview. Metadata compresses before identity.

- Eligibility and refusal semantics are unchanged, but the words move into a focus, hover and tap disclosure with an accessible description, so refusal prose no longer grows the Head.
- `Technical details` and the Stage's `Open source JSON` leave the ordinary surface. **Every capability stays reachable:** viewing preferences, Keys, rename, delete, source download and source replacement each get a Find entry from the first shell slice.
- O5's permanent home: viewing preferences in the Stage's existing settings control; project lifecycle and source under the project name.
- The context chip shows real canonical location only. It does not invent a Structure or Level hierarchy.

### Index and Card

- **Index rows** are one compact line with a human label. `Select`, `Open location` and `Bring into view` stay distinct but are disclosed.
- **Labels** resolve as: authored name, then a session-stable `Kind n` by sorted identity, with the full identity available to assistive technology. Generated names are never serialized.
- **Card facts** gain an optional `fieldId`, and a fact with a writer for that field is not repeated. Rendering diagnostics (`Stream`, `Eligible`, `Revealed`, `Domain`) leave the ordinary Card.
- **Card actions** gain an optional `group: 'primary' | 'secondary'`. Only an action with `destructive: true` gets destructive styling, so Duplicate stops looking dangerous. Delete stays explicit.

### Lower edge, Height Sheet and responsive

- **One measured geometry.** The route publishes the Index, Card, Sheet-lane and dock spans as CSS variables, replacing the fixed `.reserved-height` that reserves 44 px for an 88 px Sheet. **A layout change never moves the Camera.**
- **Height Sheet** is a thin line with knob and semantic ticks, with no box or permanent label. The value appears on focus, drag and touch. Heights, pins, found tops, side swap and keyboard input are preserved.
- **Ink palette** becomes compact icons and modes, keeping typed X/Z, Finish, Backtrack, Cancel, Wall Box and Shape Line, Box, Round and Sketch.
- **Constrained widths** (1280, 1180 and 820 px): Index starts collapsed and opens as an invoked sheet with an explicit scrim that stops above the dock, replacing the `100vmax` shadow. Dock, palette and drafting controls stay usable.

### Experience

Experience stops being a separate dashboard and uses the shared homes: lens in the Head, locator in the Index, selected facts in the Card, and an invoked Guide on the lower edge, closed by default. `ExperienceSurface.svelte` splits into presentation for those homes while its one controller keeps every command. Capture, View, first-Guide intent, travel-gap behaviour, F4 history and isolated Preview are unchanged.

## Non-goals

No new geometry or picking authority, global shell rewrite, new feature catalogue, Slice or Brush, Levels, publication feature or visitor authoring machinery. No removal of imported models, native-form axis sizing, catalogue uniform scale, Paper and shaded preference, or snap and scale settings just because the wireframe demonstrates fewer cases. No formal performance benchmark: [the mandate is suspended](../../../reference/decisions/performance-mandate-suspension-2026-10-28.md), so these slices assert deterministic bounds and observed smoothness.
