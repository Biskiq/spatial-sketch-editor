# P26 demo — continuous spatial workspace visual refinement

**Date:** 2026-09-29

**Status:** implementation applied; owner visual acceptance recorded 2026-09-29.
Selection uses plan §3 ochre (`--sel` → `--ochre`). Owner-directed overrides of this
plan (paper rule, Wall grid, Reduce motion, return-marker removal, paper slew) are
folded into the sections they govern.

**Deliverable:** a revised, verified P26 demo, with evidence for review and merge.

**Implementation target:** [`Final-Design-Prototype/`](../../Final-Design-Prototype/README.md).

## 1. Purpose and authority

Make the existing continuous spatial workspace feel like one architectural studio:
dark cutting mat for spatial modeling, vellum for drafting, technical ink for
architecture, and restrained ochre for selection and manipulation. Architecture
and artwork remain the principal content; measurements and controls support them.

This plan covers the **P26 demo only**. Product implementation, production token
migration, and amendments to the durable visual-system contract are separate work
after P23B is clean and this demo redesign has been applied and merged. No product
rollout plan is part of this document.

The [P26 phase router](../../README.md) retains phase status and production gates.
The [PLATE contract](../../../../reference/design-system/editor-shell-and-visual-system.md)
remains the product authority. This is a proposed demo design delta, not a claim
that PLATE §4.2, §6, or §18 has been superseded. Writing this specification does not
change the operational baton or close a P26 slice or phase.

The accepted prototype journeys A–F remain the experience baseline. Preserve one
continuous workspace and its existing representations; this plan establishes no
second viewport, navigation authority, camera evaluator, or projection mechanism.
“Drafting” describes the intended experience, not a new claim of mathematically
orthographic projection in the prototype.

## 2. Scope and invariants

### Included

- Demo shell surface colors and the boundary around the working canvas.
- Plan and elevation paper, background grids, and contextual sheet materials.
- Selection, hover, manipulation, focus, and armed-state presentation.
- Dimension/readout hierarchy, including the existing numeric edit surface.
- Clearance notices, refusal presentation, and existing semantic status colors.
- Minimal presentation state, material-coordinate attributes, and accessibility
  wiring needed to expose these treatments through existing interactions.
- Reproducible before/after specimens and interaction regression evidence.

### Preserved

- Shell dimensions, panel arrangement, typography, control sizing, and tool order.
- Camera paths, projection behavior, transition timing, motion preferences, and
  exact return behavior. Paper treatment follows existing representation progress.
  During camera motion the ground's mat↔paper value is rate-limited (full swap
  420 ms) so a pan cannot flicker; the value at rest is exact.
- Wall geometry, openings, topology, cut/peel/lift evaluation, constraints, picking,
  handle positions and shapes, hit targets, units, and measurement values.
- Selection identity, edit validation, transaction boundaries, document Undo, and
  the separation between authored edits and view navigation.
- Artwork, authored object materials, fixture content, and existing model lighting,
  except local adjustments required to render the contextual drafting sheet.
- The keyed overlay pool and existing label-decluttering behavior.

Owner-directed demo controls, in scope as asked overrides of this plan: **Reduce
motion** in the view bar (forces duration to 0; distinct from Motion speed);
**Wall grid** in the view bar (paper vs the wall's real material; default on);
removal of the origin/return marker (Esc, Put it back, and crumbs already carry
return). No other new features, global interaction model, component rewrite,
framework migration, production app/package changes, dependency upgrades, or
visitor styling belong to this work. If a required result needs such a change,
report the specific conflict instead of silently extending the scope.

## 3. Checked baseline and proposed palette

Baseline inspected on 2026-09-29 in
[`styles/app.css`](../../Final-Design-Prototype/styles/app.css) and
[`app/stage.js`](../../Final-Design-Prototype/app/stage.js). Recheck these locations
at implementation start if the demo has changed. Source symbols, not line numbers,
identify the implementation anchors.

| Semantic role | Checked demo baseline | Proposed demo target |
| --- | --- | --- |
| Spatial ground | `#1D3A33` | Retain |
| Spatial background / fog endpoint | `#152C26` | Retain; do not collapse into ground color |
| Spatial grid, minor / major | `#2B5147` / `#3C6A5C` | Retain |
| Drafting paper | `#F3F4EE` | Retain |
| Shell main | `#EEF0EA` | `#EEEDE8` |
| Shell recessed / armed | `#E1E5DD` | `#E2E0D8` |
| Instrument surface | `#F8F8F4` | Retain |
| Shell hover | Existing recessed treatment | `#F0EFE9`, perceptual lift |
| Canvas perimeter | No dedicated sheet treatment | `#B8BEB3`, 1 CSS px inset stroke |
| Primary technical ink | `#17201D` | `#202422` on light surfaces |
| Reference dimension ink | Role-dependent | `#3E4440` on light surfaces |
| Light overlay ink / halo | Role-dependent | `#F3F4EE` |
| Minor paper grid | `#E2E6DD` | `#9FB2A2` at initial opacity `0.28` |
| Major paper grid | `#CFD6CB` | `#809984` at initial opacity `0.45` |
| Ochre core | `#F2B53C` | `#E5A020` |
| Dark ochre boundary | CSS `#B97E0E`; renderer selection edge `#C98A12` | `#8A5B10` on light surfaces |
| Quiet selection fill | `#FBE7B8` | Ochre core at `0.10` over the local surface |
| Clearance background | `#FCE1DA` | `#F7EDE8` |
| Clearance accent | `#EC6A50` | `#C85A48` |
| Clearance body / action text | `#8E2F1D` | `#3A241D` / `#7E2718` |
| Refusal fill / text | Shared coral treatments | `#FDF3F0` / `#7E2718`, terracotta edge |
| View displacement | `#56707C` with dashed treatment | Retain; use a legible surface variant where needed |
| Intentionally open state | Existing `--open*` family | Retain |

These are implementation targets, not claims of completed visual acceptance.
Grid opacity, perimeter strength, and surface-dependent edge widths may be tuned
within their stated roles during specimen review. Record the final values in the
acceptance evidence. Semantic assignments, interaction meanings, geometry, and
scope are not calibration variables.

Keep semantic roles separate even where values coincide. Changing selection must
not incidentally recolor warning, history-count, branding, return, or displacement
cues that currently reuse tape classes. Reuse the demo's CSS and renderer palette
structures; add a small demo-local mapping only if needed to keep them consistent.
Do not create a production design-system package in this task.

## 4. Work surfaces and drafting representation

### 4.1 Coherent contrasting surfaces

Retain the deep mat and light paper as deliberately different working surfaces.
Their specified ground/paper swatches have approximately **11.13:1** contrast;
this is not a measured full-frame contrast or a promise to remove luminance shock.
Continuity comes from stable shell geometry, the same selected subject, and the
existing movement between representations. Add no independent color-transition
timeline or delay, including in Instant/reduced-motion operation.

### 4.2 Paper boundary without layout changes

Draw the 1 CSS px perimeter inside the current stage bounds. It must neither
reduce the canvas rectangle nor change camera aspect, overlay coordinates, or
pointer mapping. A non-interactive inset/pseudo-element treatment is suitable;
it must not intercept picking or cover focus indicators and edge controls.

The reference treatment is a square hairline boundary. A very faint inner edge
shadow may be added only if the comparison specimen shows a material improvement;
it must remain within the stage. Do not inset the viewport with new padding or
turn it into a floating card. Shell panels retain their flat treatment.

### 4.3 Drawing hierarchy

Visual emphasis, strongest to weakest:

1. Cut geometry and primary poche.
2. Selected subject and active manipulation target.
3. Ordinary object boundaries and openings.
4. Dimensions and annotations.
5. Context, hidden edges, and ceiling projections.
6. Passive drafting grid.

This is not a fixed rendering order. Keep active handles, focus, refusal feedback,
and the relevant snap/measurement guide visible above the work. A live snap cue
may become prominent during its gesture; it is not a background grid line.
Retain line-weight and dash distinctions. Dark technical ink is a light-surface
role, not a universal color for marks over the dark mat.

### 4.4 Grid behavior

- At the reference architectural scale, use 1 m minor and 5 m major intervals.
  Start with the palette opacities above and 1 CSS px apparent line width.
- Use a `1, 2, 5 × 10^n` interval ladder as zoom changes, with major intervals five
  times the chosen minor interval. This defines sub-meter divisions when zoomed
  in; they are not an additional always-visible grid.
- Base decimation on projected CSS-pixel spacing, not an uncalibrated screen
  ratio such as “1:100.” Initial tuning: aim for at least 16 px between minor
  lines at the working plane; fade dense/foreshortened lines between 16 and 8 px,
  and suppress them below 8 px. Verify the major grid also avoids dense bands.
- Anchor Plan to the existing world/floor datum. Elevation coordinates are
  distance along the represented wall and height relative to its documented
  floor datum. Do not make the grid camera-relative or silently change units.
- Keep the origin stable across interval changes; use hysteresis/crossfading
  derived from zoom if needed to prevent flicker. Do not add animation that
  delays or changes a user's view transition.
- Check DPR 1 and 2, diagonal edges, zoomed-out scenes, and oblique curvature.
  A decorative grid is allowed low contrast; essential snap guides are not.

The earlier `0.18` minor opacity would be slightly fainter than the existing grid
on paper. The stronger starting values here must still remain subordinate to the
drawing; they are accepted only after the dense-scene comparison.

### 4.5 Elevation and unrolled-wall paper

`Stage.initWorld()` builds a horizontal paper ground, while `Stage.initMaterials()`
defines a separate, bright emissive `sheet` material. Updating the ground texture
alone does not update the elevation sheet.

Apply the vellum treatment to existing contextual drafting sheets, with grid
coordinates derived from wall distance `s` and local height. Preserve spacing
through round, partly peeled, and flat states, from inside and outside; do not
stretch one texture across the current world-space bounding box. Keep the seam
consistent with the existing wall identity and measurement datum.

The current `buildWallGeometry()` emits positions and normals without UVs. A
minimal generated UV or equivalent coordinate attribute is in scope, derived
from the existing sampler and strip coordinates. Positions, topology, openings,
surface evaluation, and picking must remain unchanged. Do not implement another
wall evaluator to draw this grid. Mask end/reveal faces if necessary so they do
not acquire misleading measurement grids.

Calibrate the sheet's color/emissive response so it reads as vellum rather than a
white light source. Retain artwork and opening visibility. Generated grid data
is display-only and never enters authored state or Undo. Reuse render resources;
do not regenerate textures/materials every frame during a drag or camera move.

A wall wears the sheet when it is the settled subject of a face session
(`settle > 0.5`) or it is off its footprint, straight or curved, and it keeps the
sheet when the camera tilts back to 3D. **Wall grid** off forces every wall to its
real material in every view. This is wider than “off their footprint” only; it is
the owner override for this demo.

## 5. Selection, manipulation, and focus

| State | Viewport treatment | Shell / Navigator treatment |
| --- | --- | --- |
| Rest | Existing geometry and neutral linework | Neutral ink and surfaces |
| Hover | Restrained tint/edge, below selected emphasis | Perceptual surface lift |
| Selected | Persistent contour; dark ochre on paper, contrasting ochre/light treatment on dark content. Paper and selection compose: the sheet and grid stay; `lineSel` draws the contour; no ochre fill on the page. Real-material (Wall grid off) keeps `foamSel` + `lineSel`. | Quiet tint and a persistent edge/notch on the same selected identity |
| Manipulating | Ochre core on the active handle; emphasize only the affected edge and measurement | Preserve selected identity; do not flood the whole Inspector |
| Keyboard focus | Independent offset ring: 2 px dark stroke with 2 px light halo, visibly clear of the control | Same independent focus grammar on keyboard-reachable controls |
| Armed tool | Existing tool identity and geometry | Recessed neutral surface, normal ink; no selection-colored fill |
| Refused | Explicit refusal styling on the affected control/value and readable reason | Corresponding existing error/notice location |

Focus, hover, selection, and manipulation can coexist. Refusal takes priority over
the active value's fill/border, but must not erase its focus indicator or selected
subject identity. Remove transient emphasis on completion, cancellation, lost
pointer capture, or closing the numeric editor; never leave a stale active label.

Preserve each handle's shape, orientation, operation, label, position, and hit area.
There is no new circle/square/diamond taxonomy. Keep horizontal/vertical opening
bars, circular height controls, and elongated movement handles recognizable.

On light surfaces, use a visible dark boundary. On dark surfaces, use a light halo
or contrasting core; over variable imagery use a two-tone boundary. A single dark
stroke cannot guarantee contrast on both surfaces. Do not reduce an essential
boundary to a half-pixel line. Preserve meaningful outlines around unfilled
handles as well as filled ones.

Derive presentation from current selection, handle drag, typed edit, and refusal
state. Expose only the minimal transient identity needed to associate a handle
with its measurement. Do not create a second selection or interaction authority.

## 6. Dimensions and annotations

| Role | Presentation | Behavior |
| --- | --- | --- |
| Reference | Quiet ink on paper, inverse ink on dark content; a minimal surface-compatible backing where geometry crosses the text | Read-only; retain ticks, units, and datum meaning |
| Editable | Compact neutral label, `#F8F8F4` backing, `#202422` ink, restrained boundary; use a stronger boundary if it is the essential control cue | Existing click/type path remains discoverable and keyboard-reachable |
| Active edit / drag | `#202422` backing, white text, restrained ochre indicator and contrasting outer edge where needed | Only the value being edited/manipulated receives maximum emphasis |
| Invalid / refused | `#FDF3F0` backing, `#7E2718` text, terracotta edge and explicit reason | Existing validation and accept/cancel semantics remain authoritative |

Use compact rectangular instrument labels with at most the existing small corner
radius, not a new family of large capsules. Initial visual padding is `2px 6px`;
preserve the existing interactive hit area even when the painted backing shrinks.
Keep the current mono type tier, precision, units, and label wording. Remove
decorative ochre dots and full yellow fills from passive measurements.

Do not strike text through with a dimension line: provide a local line break or
small backing. Do not paint the same charcoal active treatment on every dimension
belonging to the selected object.

Preserve keyed elements and decluttering priorities. Ensure focused and actively
edited labels remain available; changing a class must not accidentally lower
their priority or hide the active control. Test that stale attributes/classes
cannot persist when a pooled label changes role.

Where an existing editable overlay lacks semantic keyboard activation, add only
the minimal focus/Enter/Space binding to its existing type-in path. Preserve
Enter/Tab acceptance and Escape cancellation. Display errors beside that editor
or in the existing status/Inspector surface, associated with the field; a
hover-only tooltip is insufficient. A new keyboard drag model is out of scope.

## 7. Warnings and semantic status

- **Clearance caution:** `#F7EDE8` backing, `#E2CBC1` decorative border,
  `#C85A48` accent, `#3A241D` body. Keep explicit explanatory text and the existing
  recovery action; use underlined `#7E2718` for “Lift to see.”
- **Refusal:** use the dimension/control refusal treatment and a visible reason.
  Distinguish rejected input from an existing, non-blocking clearance condition
  through wording and control state, not hue alone.
- **View displacement:** preserve slate, dashes, and “Set aside”/view-only wording.
  Displaced valid architecture never becomes a warning merely because it moved.
- **Intentionally open:** preserve the existing open-state family and semantics.
  Openings, cut poche, hidden geometry, and intentional gaps remain distinguishable.
- **Destructive action:** retain a distinct existing treatment if present. Do not
  introduce a delete feature or recolor ordinary notices as destructive actions.
- **Disabled and preview:** retain non-hue distinctions and recognizable geometry;
  do not confuse disabled controls with quiet selected controls.

## 8. Implementation sequence and file boundaries

All code paths below are relative to `Final-Design-Prototype/`. Inspect dependents
as needed; mutation remains limited to the demo and this design workspace.

| Order | Work | Expected locations | Check before proceeding |
| --- | --- | --- | --- |
| 1 | Capture baseline; inventory palette consumers and current gestures | Existing journeys and capture scripts; evidence under this workspace | Exact fixture, viewport, DPR, motion mode, selection, and source revision recorded |
| 2 | Introduce semantic mappings and shell/paper perimeter | `styles/app.css`; palette in `app/stage.js`; demo-local helper only if useful | No layout, camera-aspect, or pointer-coordinate shift |
| 3 | Apply paper/grid and contextual sheet treatments | `app/stage.js`; narrowly scoped generated attributes in `app/geometry.js` if required | Correct scale, curvature, clipping, openings, and unchanged geometry |
| 4 | Apply coherent selection and handle states | CSS, `app/draw.js`, `app/overlay.js`; minimal existing gesture hooks in `app/main.js` | Same selected identity across surfaces; active emphasis resets correctly |
| 5 | Apply dimension roles and numeric-entry presentation | CSS, overlay drawing/pool, existing type-in markup/hooks | Values, hit targets, focus, validation, and one-edit/one-Undo behavior preserved |
| 6 | Apply notices and complete specimen verification | CSS and existing notice markup in `app/ui.js` if necessary | Caution, refusal, intentional open, and view displacement stay distinct |
| 7 | Record acceptance evidence; resolve findings; prepare review/merge handoff | This workspace's `qa/` artifacts | All required checks have results and the actual diff matches scope |

`app/model.js`, authored fixture data, and camera/action algorithms are not visual
implementation targets. Changes to evaluation, state transitions, or history need
separate scope. Small semantic markup changes in `index.html` are allowed only
for existing controls; no structural shell rewrite is planned.

Use the existing no-build demo entry point. The current
[`scripts/shoot.sh`](../../Final-Design-Prototype/scripts/shoot.sh) identifies useful
fixture states but writes to the prototype's existing `screens/` directory. Adapt
capture output to this workspace's evidence directory rather than overwriting
the original visual record as a side effect. Evidence setup through a fixture
hook does not replace exercising the real gesture for interaction acceptance.

## 9. Verification and acceptance

### 9.1 Contrast and rendering checks

Normal text must meet 4.5:1 against its backing; essential component/state cues
must meet 3:1 against adjacent surfaces. Evaluate composite colors, opacity,
antialiasing/line visibility, and the actual WebGL material presentation. Decorative
grids and perimeter rules are assessed for hierarchy and visibility, not falsely
classified as interactive controls. Relevant guidance:
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Calibration evidence already calculated from opaque sRGB swatches:

| Pair | Approximate contrast | Interpretation |
| --- | --- | --- |
| Paper `#F3F4EE` / shell `#EEEDE8` | 1.06:1 | Perimeter treatment needs visual verification |
| Ochre `#E5A020` / mat `#1D3A33` | 5.50:1 | Useful contrasting core on the dark mat |
| Dark ochre `#8A5B10` / paper | 5.30:1 | Useful boundary on paper |
| Charcoal `#202422` / mat | 1.28:1 | Insufficient as the sole essential cue |
| Clearance body `#3A241D` / `#F7EDE8` | 12.58:1 | Text pair passes at full opacity |
| Clearance action `#7E2718` / `#F7EDE8` | 8.32:1 | Text pair passes at full opacity |

These calculations are not a WCAG conformance claim for the demo. Measure the
final treatment and record actual limitations; do not report a pass from token
names or screenshots alone.

### 9.2 Required matched specimens

Capture baseline and revised states at identical camera/fixture settings, first
at 1440 × 900 CSS px/DPR 1. Repeat the constrained 1280 × 800 viewport and the
linework/focus cases at DPR 2. Record dimensions rather than silently resizing
images. Keep original captures and a labeled side-by-side comparison.

| ID | Specimen | Required visible result |
| --- | --- | --- |
| V1 | Plan, North wall selected | Paper perimeter separates the workspace; cut geometry dominates; quiet dimensions and selected Navigator identity agree |
| V2 | 3D overview and selected opening | Mat, model depth, and artwork retain their character; handles/labels are legible on dark ground and light geometry |
| V3 | Garden window facing and fully unrolled | Vellum sheet, honest along-wall grid spacing, distinct reference/editable dimensions, unobscured openings/artwork |
| V4 | Partly peeled wall, inside and outside | Stable grid coordinates, no stretching, moiré, seam jump, or lost handle contrast |
| V5 | Section, depth preview, and Reveal | Poche, openings, hidden context, guide, selected target, and view-only displacement remain distinct |
| V6 | Ceiling lift/look-up and clearance notice | Readable warning/recovery action, correct datum labels, intentional gaps differentiated from refusal |
| V7 | Dense dimensions at both viewport widths | Architecture stays dominant; handles and active/focused value remain available; no new overlaps or clipping |
| V8 | Real handle drag, release, and supported cancellation | Only the active control/value strengthens; valid operation and cleanup retain baseline behavior |
| V9 | Numeric entry, invalid input, Enter/Tab, Escape | Visible focus and reason; preserved values, acceptance/cancellation, and focus continuity |
| V10 | “Set aside,” find, and return | Slate/dashed view state; retained selection identity; no accidental error semantics |
| V11 | Keyboard focus, hover, armed, selected, and disabled | Distinguishable concurrent states, visible rings over both surface families |
| V12 | Plan↔3D and contextual return with ordinary and Instant/reduced-motion settings | Same geometry, orientation, transition policy, and endpoint; no new visual delay or flash |

Static captures supplement live verification. Run journeys A–F end to end and
exercise real edits/Undo, numeric entry, and return. A visual-only change must not
add history entries. Confirm no new console errors, asset failures, focus loss,
stale manipulation states, or visibly degraded interaction responsiveness.

Repository-level verification is still governed by
[`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md),
including the unconditional architecture lane before a PR. Read and apply that
contract at implementation time; demo-local scope does not waive required checks.
Record commands, results, and unresolved failures. Browser evidence supplements
the applicable repository checks; neither substitutes for the other. This
specification-writing change itself requires document/link/diff validation.

### 9.3 Evidence and completion

Store the implementation evidence in `qa/` beside this plan: baseline/revised
captures, comparisons, and a concise acceptance record. The record must include
source revision and dirty-state identity, reproduction steps, browser/viewport/DPR,
final calibrated values, specimen and journey results, contrast measurements,
required check results, and any unresolved limitation. Mark an unexercised case
as unverified rather than passed.

Demo implementation is ready for review when every required specimen and journey
has evidence, essential visibility/discoverability failures are resolved, and
preserved behavior is verified. Owner visual acceptance and the normal merge
workflow complete this demo redesign. Do not claim merge before it occurs, invoke
major-phase closure, or update production design authority as part of this scope.

## 10. Implementer handoff

Deliver the runnable revised demo, a concise change summary, final palette/state
mapping, and links to the acceptance record and matched comparisons. List any
remaining issue with its user-visible consequence and verification status. Keep
the implementation and evidence focused on this demo; later product work receives
its own scope after the prerequisites in §1 are satisfied.
