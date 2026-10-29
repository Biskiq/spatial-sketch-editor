# Core Editor Stability — implementation plan (proposed T1.P03)

**Status: proposal.** This page registers no phase, releases no scope and changes no register,
gate, format or milestone criterion. On owner approval it becomes **T1.P03 — Core editor
stability**: the phase README is created from this page, the phase is registered in the
[T1 phase register](./t1-spatial-world/README.md#phase-register), and each slice gets its own
implementation plan before release. Only an owner release writes [the release list](./now.md).

**Relation to the milestone.** The [Core Editor Stability milestone](./core-editor-stability.md)
owns the criteria and its own acceptance route. This plan is contributing work toward it, not its
acceptance plan, and it does not create `docs/roadmap/integration/core-editor-stability/`. Decision
D1 below asks the owner whether shell coherence becomes a milestone criterion.

**Prerequisite.** `T5.P01.S03` (the T5 integrated final gate) is accepted and merged. T5.P01 is the
last writer of the Scene adapter, form handles and Stage selection before this phase starts, and
S06 below rebases on it.

## Outcome

On one integrated tree, a creator opens a project, reads it in Plan as a drawing and in 3D as a
model, and moves between the two without losing place, selection or tool. They draft with a working
dock, grid, snap and a Height Sheet. They can see what the pointer is over, what is selected and
which marks they can drag. They move, turn and resize walls, objects and native forms with one mark
vocabulary, and every gesture is one Undo step that survives Save and reload. Underneath, one Stage
owns picking, hover, selection and gesture lifecycle; F4 stays the one history; and every package
keeps one responsibility.

## Starting evidence (verified at `c13a949d`)

| Area | Landed behaviour | Gap against the ratified destination |
| --- | --- | --- |
| Plan reading | `packages/camera-core/src/viewport.ts` gives an exact orthographic Plan endpoint. `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte` draws the same lit, fogged, shadowed meshes (`VisitorLayoutShell`) on a `0x111117` ground in both readings | Plan looks like the 3D model seen from above. PLATE wants a Paper reading. Layout's `evaluateLayoutPlan` (`packages/layout-core/src/layout-plan-representation.ts`: cut, projected, hidden and symbol streams) only feeds the pick index in `apps/editor/src/lib/authoring/stage/stage-facade.ts`, so **what Plan draws is not what Plan picks** |
| Paper and drafting state | No mat or vellum material, no grid, no Scale · Grid · Snap words. The Plan cut height is a fixed 1.2 m calibration in `apps/editor/src/lib/authoring/stage/plan-parameters.ts` | PLATE §Material and working surfaces (grid ladder and decimation), §World authoring (drafting state, reading control, 2D/3D continuity) |
| Height Sheet | Absent | PLATE §World authoring, Height Sheet |
| Dock | `apps/editor/src/lib/authoring/stage/shell/StageDock.svelte`: Select plus contributed tools, as text keys | Icon-first keys; Measure and Eraser are missing; Ink options are limited to what Layout and Scene read |
| Selection and hover | Selection on Stage is one gold SVG dot (`apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte`); other markers are grey circles. Adapters receive `hoverIntent`, but the host draws no hover | PLATE §Semantic color and §State and control hierarchy: a gold contour with a quiet tint, hover below selection, never gold |
| Manipulation marks | Each adapter owns its own knobs and drag state: Layout (`apps/editor/src/lib/authoring/adapters/layout.adapter.ts`, 2,138 lines), Scene (`apps/editor/src/lib/authoring/adapters/scene.adapter.ts`, 1,243 lines) and forms (`apps/editor/src/lib/authoring/adapters/scene/shape/ray.ts`). They are joined only through the host's no-task press offer | The [grammar's rays and points](../reference/design-system/spatial-instrument-grammar.md#rays-and-points): one mark language drawn and arbitrated by the Stage, admitted by domain |
| Picking | Three paths: the Plan pick index over Plan fragments, a Three raycast (`apps/editor/src/lib/authoring/scene/scene-pick-source.ts`), and adapter-local hits (`apps/editor/src/lib/authoring/scene/plan-scene-hit.ts`, form rays, support occlusion) | One hit arbitration for hover, press, Eraser and Measure |
| History | One F4 history (`apps/editor/src/lib/authoring/f4/history.ts`, owned by T3) | Already one authority. What is missing is enforcement, and one host-owned "Undo unavailable while a gesture is live" reason |
| Composition | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` is 3,571 lines; `stage-facade.ts` is 2,334 lines | Responsibilities are hard to review. Extraction happens only where a slice needs it |
| Packages | `layout-core` and `geometry-core` are independent leaves (both use `robust-predicates`); `camera-core` depends only on `three`; `project-model` depends on all three. Runtime-safe helpers live in the editor (`apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts`, `apps/editor/src/lib/authoring/scene/obb-util.ts`, `apps/editor/src/lib/authoring/scene/cluster-obb.ts`) | The dependency directions are not enforced, and the owner of each footprint and bound computation is unwritten |

## Scope decisions (challenges to the request)

1. **No second Plan renderer and no new camera.** Plan becomes truthful by drawing the Paper
   reading from Layout's existing Plan representation, and Scene symbols from Scene footprints,
   in the one Canvas through the one `ViewportEvaluation`. Hits in Plan resolve against the same
   evaluation that is drawn. The shaded top-down image stays as an application viewing preference.
   The Camera transition is unchanged.
2. **The Height Sheet stays bounded by what the domains support.** There is one floor datum and no
   Levels, and raised authoring is not admitted; vertical foundation is a later T1 trigger. Sheet v1
   shows the datum, read-only found surfaces and session pins, and it drives **only the Plan cut
   height**, which is view state. It never invents a Level, never arms a tool and never draws Ink at
   height. Without this bound the Sheet would advertise vertical support the product lacks.
3. **No inert dock slots.** The ratified dock has six tools. This phase ships those with a real
   pointer grammar: Select, Ink (Line and Box), Measure, Eraser (one subject per click) and the
   Library key. Slice, Brush, Sketch and Round stay absent. Each needs a capability this milestone
   excludes: temporary inspection, materials, a smarter Pen and curved Walls.
4. **History is already one authority. Do not build a second.** This phase adds an arch test that
   no adapter keeps an undo stack or commits outside F4 acceptance, and gives the host ownership of
   the live-gesture Undo refusal. F4 itself is not reworked.
5. **Unify picking, hover and gestures. Do not merge domains.** The host arbitrates hits and owns
   gesture lifecycle. Domains still say what is pickable, which handles exist and what a drag
   means. A mark the domain cannot evaluate is never drawn.
6. **Package boundaries are clarified, not consolidated.** `layout-core` (architectural topology,
   compilation, Plan representation), `geometry-core` (native form profile and extrusion kernel) and
   `camera-core` (viewport, projection, Camera evaluation) stay separate. No new shared spatial
   package is created. An editor helper moves to a package only when a second runtime-safe consumer
   exists, and session arithmetic stays in the editor.
7. **Scaling follows the domain.** Catalogue objects resize uniformly and native forms per axis, as
   the [Scene contract](../reference/components/scene-content.md) already states. The mark layer
   expresses each; it adds no per-axis scale for catalogue models.
8. **No big-bang refactor.** The route and facade shrink because S02 extracts picking and gesture
   lifecycle and S05 extracts marks. A wholesale route rewrite is a non-goal.
9. **The wireframe is evidence, not authority.** Behaviour comes from PLATE and the grammar. Pixels,
   key maps and hit algorithms come from each slice's plan and review.

## Slice register (proposed)

All slices consume the same accepted gates as T5.P01 (F1, F2, F4 unit acceptance and conditional
Save, `T1.viewport-projection@1`). None provides a gate, and none changes a persisted format.
Selection, hover, Sheet height, pins, grid, snap and reading settings are session or view state and
are never serialized.

| Slice | Title | Writer | Reviewers | Depends on | Verification |
| --- | --- | --- | --- | --- | --- |
| S01 | Responsibility map and boundary enforcement | T1 | T2, T3, T5 | T5.P01.S03 merged | affected-subsystem (arch lane) |
| S02 | One Stage interaction core: pick, hover, gesture | T1 | T2, T3, T5 | S01 | architecture-integration → S08 |
| S03 | Paper Plan: drawn from the representation | T1 | T2, T5 | S02 | architecture-integration → S08 |
| S04 | Drafting surface: grid, snap, reading control, Height Sheet | T1 | T2, T3 | S03 | architecture-integration → S08 |
| S05 | Selection, hover and the mark layer, with Layout marks | T1 | T2, T5 | S02 | architecture-integration → S08 |
| S06 | Scene and form marks on the mark layer | T2 (objects), T5 (forms) | T1 | S05 | architecture-integration → S08 |
| S07 | Dock completion: Ink Box, Measure, Eraser | T1 | T2, T3, T5 | S04, S06 | architecture-integration → S08 |
| S08 | Integrated final gate | T1 | T2, T3, T5, independent | S01–S07 | exhaustive |

```text
S01 → S02 ─┬→ S03 → S04 ─┐
           └→ S05 → S06 ─┴→ S07 → S08
```

There are two lanes after S02: **drawing surface** (S03, S04) and **interaction** (S05, S06).
Both edit `StageCanvas.svelte`, `stage-facade.ts` and the spatial route, so each lane records its
shared-file claim (writer, expected patch base, reviewer) before editing, and the lanes merge one at
a time under the [shared-file protocol](./cross-track-execution.md#shared-files-and-merge-protocol).
Every implementation PR runs the complete merge gate in the
[test contract](../../apps/editor/tests/README.md#what-a-change-requires), whatever its tier.

### S01 — Responsibility map and boundary enforcement

*No product behaviour change.*

- Add an **Editor interaction authorities** section to
  [`architecture.md`](../reference/architecture.md). It is descriptive of current truth, with the
  normative rules this plan's approval ratifies: the Stage host owns hit arbitration, hover,
  selection state and gesture lifecycle; domains own pickability, handle admission, gesture meaning
  and refusal; F4 owns history; Camera owns projection.
- Write the package responsibility table: `layout-core`, `geometry-core`, `camera-core`,
  `project-model` and the editor's `authoring/*`, with an owning track per concern and the rule for
  moving a helper.
- Add arch tests:
  - package dependency direction (`layout-core` and `geometry-core` never import each other; `camera-core` imports no `@portfolio` package; no package imports editor code);
  - no adapter keeps an undo or redo stack or writes source outside F4 acceptance;
  - no module outside the Stage host imports a Three raycaster for picking (allow-listed until S02 removes the current users).
- Record the live-gesture Undo refusal paths as found, for S02 to unify.
- **Exit:** the doc sections are reviewed by T2, T3 and T5; the arch lane is green with the
  allow-list explicit and shrinking.

### S02 — One Stage interaction core

*Behaviour-preserving, plus a hover state.*

- One host **pick service**: pointer and current evaluation in, ordered candidates out. It merges a
  reserved mark tier (empty until S05), Plan fragments in Plan, the raycast in 3D and adapter pick
  providers. Domain priority is declared by contribution, not by call order.
- **Hover** lives in the selection session as view state. It is never history, Save or dirty.
  Adapters read it; the host draws nothing new yet.
- One **gesture lifecycle**: begin → preview → commit or cancel, with one owner at a time. The host
  reports why Undo is unavailable while a gesture is live. Adapter drags move onto it without
  changing what they plan.
- Remove S01's raycast allow-list entries.
- **Exit:** a pick differential (the same fixtures and pointer samples resolve to the same subject
  before and after, in both readings); existing Layout, Scene and form journeys pass unchanged; the
  facade and route lose the extracted code rather than wrapping it.

### S03 — Paper Plan

- The 2D reading draws on **vellum** from `evaluateLayoutPlan`'s streams: cut Walls as poché,
  projected edges, hidden edges dashed, Opening symbols. Scene objects and native forms draw as
  footprint symbols from their owners' footprint functions, moved into a package only if S01's rule
  admits it. The drawing is editor-only and is drawn in the one Canvas through the one evaluation:
  no SVG second projection and no visitor-chunk import.
- Plan picking and Plan drawing consume the **same** evaluation and footprints.
- The 3D reading moves to the **mat** material. Shaded Plan becomes an app-menu viewing preference,
  with paper as the default (D5).
- The reading flip keeps PLATE's 2D/3D continuity: tilt about the target, scale kept, a 90° azimuth
  detent in 2D, return to the last working elevation, and no refit.
- **Exit:** a drawn-equals-picked test on fixtures (every pickable Plan fragment has drawn geometry,
  and nothing is drawn that is not pickable or symbolic); continuity assertions across a flip;
  visitor and public boundary tests green.

### S04 — Drafting surface

- **Grid:** 1 m minor and 5 m major on the `1, 2, 5 × 10^n` ladder, decimated by projected spacing
  (at least 16 px, fading from 16 to 8 px, suppressed below 8 px), anchored to the floor datum, on
  Paper in 2D and the mat grid in 3D.
- **Drafting words:** Scale · Grid · Snap beside the 2D | 3D control. Scale offers detents and Fit
  all as Camera framing requests. Grid and Snap each toggle one fact and name the interval in force.
  Off states are words, not colour alone.
- **One snap fact** offered by the host and consumed by Layout Ink and Scene placement through their
  adapters. Domains keep their own snap targets; the grid increment is one more target.
- **Reading control:** 2D | 3D. The ▾ is omitted until it holds a supported item, so there are no
  disabled entries.
- **Height Sheet v1** (decision 2): a right-docked slider with a datum tick, found-surface ticks from
  owner queries (plinth and Scene tops, read-only), session pins and hover or drag labels. Its
  height drives the Plan cut height. It never arms a tool, never writes source and never creates a
  Level.
- **Exit:** grid decimation and anchoring tests; Sheet tests (no history entry, no dirty state, cut
  height reaches `planParameters`, pins absent from Save); Grid and Snap words announced to
  assistive technology.

### S05 — Selection, hover and the mark layer

- **Selection:** a gold contour with a quiet tint in 3D, and contrast-safe gold ink in Plan, derived
  from the one selection state and echoed in the Index row and Card identity. The gold dot and grey
  markers are retired.
- **Hover:** a restrained edge or tint below selection, never gold, from S02's hover state, in both
  readings. Keyboard focus keeps its own non-hue cue.
- **Mark layer:** the host draws and hit-tests the grammar's marks in the one Canvas: the dashed
  white ray with a dark halo, the open arrowhead, the anchor point (gold while held), the rotation
  ring and the live value tag shown only on hover or drag. Domains contribute **handle
  descriptors** as data (kind, anchor, axis, the fact addressed and the owning planner). The host
  never invents one.
- Marks take the reserved top tier in S02's pick order. Marks never stack into unreachable targets:
  overview-zoom suppression follows the grammar's density rule.
- Layout marks migrate onto the layer: Wall end points with Junction preservation, length and angle,
  move, and Opening position and width. Thickness stays a Card field under More.
- **Exit:** a mark admission test (no mark without a domain planner); a hover-is-never-gold test; a
  valid release makes one Undo step and an invalid release makes none, on Layout marks; the Card
  field and the mark write the same fact with the same refusal.

### S06 — Scene and form marks

- T2 moves catalogue-object move, yaw and **uniform** size onto descriptors, with **progressive
  size**: the scale point reveals size, and the tag names the verb ("Size 1.10 · base stays").
- T5 moves form depth and per-axis size onto descriptors.
- Each removes its adapter-local knob drawing and drag state in the same PR, with no duplicate path
  left behind.
- Typing digits at the gesture turns the live tag into numeric entry; Esc restores and then cancels;
  blur never commits.
- **Exit:** the S05 mark exits on objects and forms; Save and reload are identical; T5.P01's and
  T2.P02's shipped journeys still pass.

### S07 — Dock completion

- Dock keys become icon-first with tooltips and key hints. The armed key is ivory. Palette collapse
  and Esc order follow PLATE.
- **Ink palette:** Line plus **Box**. Box produces the same closed-chain intent as four Lines,
  through the existing Layout planner, in one Undo step; on the Shape reading it is a rectangle
  outline.
- **Measure:** session-only distance between snapped points with a live tag. No history, no dirty
  state.
- **Eraser:** red dashes on hover only while armed. A click erases one admitted subject through its
  owning domain's existing delete planner, in one Undo step. Sweep erasing, the kind filter and
  cross-domain composed erase are deferred.
- **Library** keeps its key. Find can arm every dock tool.
- **Exit:** arming never changes selection; every tool refuses an ineligible target in words; Undo
  restores erased identities; keyboard-only arming and use work.

### S08 — Integrated final gate

Exhaustive verification on one integrated tree at a recorded revision: the complete merge gate,
the journeys below in two browsers, the visitor, public and preview boundaries, and independent
review. Only fixes that the gate itself finds are allowed in this slice. It declares
`FINAL PHASE GATE` for T1.P03.

## Acceptance journeys (S08)

| # | Journey | Must observe |
| --- | --- | --- |
| J1 | **Plan truth.** Open the starter, switch to 2D, select a Wall from its drawn line, flip to 3D and back | Vellum drawing with cut, projected, hidden and symbol streams; the pick hits what is drawn; gold ink in 2D and a gold contour in 3D on the same identity; target and scale kept, azimuth detent, no refit; the armed tool survives |
| J2 | **Drafting.** Zoom out and in; toggle Grid and Snap; draw a Box room with snap; Measure a Wall; drag the Height Sheet and add a pin | Grid decimates without sub-8 px spacing; words name the state; Box gives one Undo step with Rooms derived; Measure and Sheet add no history and no dirty state; the cut height changes Plan streams; pins are gone after reload |
| J3 | **Legibility.** Hover and select a Wall, Opening, catalogue object and native form in both readings; use the keyboard only | Hover is never gold; selection is echoed in Stage, Index and Card; Esc clears; the focus cue is distinct |
| J4 | **Objects.** Move, turn and uniformly size a catalogue object; size a form per axis; type at the gesture; make an invalid drag | One Undo step per valid release and none for an invalid one; the tag names the verb; the Card field writes the same fact and refusal; the base stays on its support |
| J5 | **Walls.** Drag a Wall end, length and Opening position; set thickness in the Card | Junctions are preserved; Plan and 3D agree; refusals appear at the mark or field |
| J6 | **Erase.** Arm the Eraser, hover, erase a Wall and an object, then Undo | Red dashes only while armed; one step each; identities are restored |
| J7 | **Survival.** Save, reload and reopen after J1–J6, at 1024 px and 768 px widths with reduced motion | Byte-identical source; no session or view state persisted; the Card collapses rather than covering the task; no editor machinery in `/p` chunks |

## Non-goals

Roofs and overhead forms; materials, Brush and light editing; multi-select, marquee and
Align/Distribute; publication, releases and all T4 work; Levels, vertical foundation and raised
drawing; Slice, Section, Face and Unroll; curved Walls, Round and Sketch; Object Focus and T5.P02
shaping; Experience lens and Guide changes; the full scope-model Index and full Find; persistent
pins; new persisted formats or F gates; phone layouts; performance benchmarks (the mandate is
[suspended](../reference/decisions/performance-mandate-suspension-2026-10-28.md); an
owner-initiated investigation follows only an observed slowdown); a wholesale rewrite of the
spatial route.

## Owner decisions requested

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Should shell coherence (Plan truth, drafting surface, selection and mark legibility) become a [milestone](./core-editor-stability.md) criterion row? | Yes, as one row whose evidence is J1–J7. Otherwise this phase is evidence the milestone never asks for |
| D2 | Height Sheet v1 bound | Datum, found surfaces and session pins; it drives only the Plan cut height |
| D3 | Dock set for this phase | Select, Ink (Line, Box), Measure, Eraser (one subject per click), Library |
| D4 | Phase home | One T1 phase with bounded T2/T5 writer slices (S06), as in T3.P04.S01's precedent, rather than three per-track phases |
| D5 | Default 2D appearance | Paper; shaded Plan as the viewing preference |

## Risks

- **Plan linework cost on large fixtures.** S03 draws from the retained Plan evaluation that picking
  already computes, so evaluation work does not grow; only the draw calls are new.
- **Wide lines in WebGL.** Use one batched fat-line geometry per stream inside the Canvas, not an SVG
  overlay, so there is still one projection.
- **Adapter migration regressions.** S02's pick differential and S05/S06's "same fact, same refusal"
  tests guard them. S06 is split by owner so each PR stays reviewable by its domain.
- **Stage bundle growth.** The Stage route already carries recorded bundle exceptions. Each slice
  reports its bundle delta; no new hard budget is claimed.
