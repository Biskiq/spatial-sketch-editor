# R217 — Core Editor Stability (repository phase)

**Phase:** R217 · **Status:** in-progress — plans approved by the owner's merge of PR #217
([rulings](../../reference/decisions/core-editor-stability-planning-2026-10-28.md)); R217.S01 and S02 are released. Released scopes and their conditions are [the release list](../now.md), and the
[production hold](../README.md#production-implementation-hold) covers every scope that list omits ·
**Registered in** the [track register](../README.md#track-register) as a repository phase, not a
track · **Milestone:** [Core Editor Stability](../core-editor-stability.md)

R217 is named after its planning PR, as R115 is. It is a shared phase because every current track
phase is closed and the work crosses T1, T2, T3 and T5 boundaries. **Ownership does not move.** Each
slice has one writer from the track that owns the concern, runs through that track's runbook start
step, and records its work in that track's baton. The other tracks review as listed in
[Ownership and review](#ownership-and-review). **Exception:** R217.S11–S25 run under one convergence
integrator through the [campaign record](../../reference/decisions/r217-convergence-campaign-2026-10-30.md); architecture ownership is unchanged.

## Post-S10 convergence plan

The owner-requested [convergence audit and plan](./post-s10-convergence/README.md) records the
findings and the target specification. The owner accepted [decisions O1–O9](./post-s10-convergence/owner-decisions.md)
on 2026-10-30 and directed that the resulting work be registered here, under
[bounded replanning](../../operations/README.md#bounded-replanning), as R217.S12–S25. The
[campaign record](../../reference/decisions/r217-convergence-campaign-2026-10-30.md) releases them together, and S11, when the owner merges
PR #230. It does not close R217. Those rulings amend landed contracts only at each slice's cutover.

## Outcome

A creator opens a project in a shell that matches the ratified production design:

- **Shell:** a compact Head, an Index that collapses to nothing, a Card that appears only for a selection, and one lower working edge, at laptop and iPad widths.
- **Plan and 3D:** they read Plan as a drawing on Paper and 3D as a model on the mat. Flipping between them keeps their place, selection and tool.
- **Drafting:** they draft with a working dock, a quiet grid, one fixed snap value, a ruler, visible zoom and Fit controls, and a Height Sheet that sets the Plan cut.
- **Legibility:** they can tell what the pointer is over, what is selected and which marks can be dragged, with a mouse or a finger.
- **Manipulation:** they move, turn and resize Walls, Openings, objects and native forms with one mark vocabulary, or by dragging the selected subject directly, and they see the result while dragging. Every valid release is one Undo step; every interrupted or invalid gesture leaves no trace.
- **Save and reload:** Save and reload restore the source exactly. Undo history and every view setting are session state and never persist.

## Starting evidence (verified at `c13a949d`)

| Area | Landed behaviour | Gap against [PLATE](../../reference/design-system/editor-shell-and-visual-system.md) and the [grammar](../../reference/design-system/spatial-instrument-grammar.md) |
| --- | --- | --- |
| Head, Index, Card | `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` has the lens switch, Undo/Redo, Save, Preview, source download and a bounded Find disclosure. `EditorIndex.svelte` is a collapsible locator that also lists contributed tool and task entries and a subject search, and becomes an overlay below 720 px. `EditorCard.svelte` is an overlay with collapse and a 72 rem narrow rule | The Head has no app menu (viewing preferences, Settings, Keys) and no location chip. A collapsed Index must take no width. The Index must hold no tools. Card and lower-edge arbitration, and the narrow sheets, are not designed as one composition |
| Plan reading | `packages/camera-core/src/viewport.ts` gives an exact orthographic Plan endpoint. `apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte` draws the same lit, fogged meshes (`VisitorLayoutShell`) on a `0x111117` ground in both readings | Plan looks like 3D seen from above. `evaluateLayoutPlan` (`packages/layout-core/src/layout-plan-representation.ts`) only feeds the pick index in `apps/editor/src/lib/authoring/stage/stage-facade.ts`, so **what Plan draws is not what Plan picks** |
| Drafting state | No Paper or mat material, grid, Scale · Grid · Snap words or Height Sheet. The Plan cut is a fixed 1.2 m calibration in `apps/editor/src/lib/authoring/stage/plan-parameters.ts` | PLATE §World authoring and §Material and working surfaces |
| Dock | `apps/editor/src/lib/authoring/stage/shell/StageDock.svelte`: Select plus contributed tools, as text keys | Icon-first keys; Measure and Eraser are missing; Ink's Wall reading has no Box (the Shape reading already has Line, Box, Round and Sketch) |
| Selection and hover | Selection on Stage is one gold SVG dot (`apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte`); other markers are grey circles. Adapters receive `hoverIntent`, but the host draws no hover | Gold contour with a quiet tint; hover below selection and never gold |
| Marks | Each adapter draws its own knobs and owns its own drag state: Layout (`apps/editor/src/lib/authoring/adapters/layout.adapter.ts`), Scene (`apps/editor/src/lib/authoring/adapters/scene.adapter.ts`) and forms (`apps/editor/src/lib/authoring/adapters/scene/shape/ray.ts`), joined through the host's no-task press offer | One mark language, drawn and arbitrated by the Stage and admitted by domain |
| Picking (S01 baseline) | Before S03, click-select asked adapters in registration order and then the Layout Plan index. Scene consulted the rendered raycast and yielded to nearer Layout. S03 moves the domain winners to `apps/editor/src/lib/authoring/layout/plan-pick-provider.ts` and `apps/editor/src/lib/authoring/adapters/scene.adapter.ts` | `apps/editor/src/lib/authoring/stage/stage-pick.ts` arbitrates between domain winners; the primary selection owner receives a no-task press |
| Gestures | `StageSession` already holds one gesture lease at a time, with per-lease reading-change policies, and live proposals that give the one "Undo unavailable" reason. The spatial route (`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`, 3,571 lines) ends a press on `pointercancel`, lost capture, Esc, lens change and replacement | Window blur, a hidden page and a second touch point are not handled; there is no hover outside an open task |
| History | One F4 history (`apps/editor/src/lib/authoring/f4/history.ts`, owned by T3). [Persistence](../../reference/components/persistence.md): history is bounded session state, and no Undo crosses a replacement baseline | Already one authority; only enforcement is missing |
| Packages | `layout-core` and `geometry-core` are independent leaves; `camera-core` depends only on `three`; `project-model` depends on all three. Runtime-safe helpers live in the editor (`apps/editor/src/lib/authoring/scene/plan-scene-footprint.ts`, `apps/editor/src/lib/authoring/scene/obb-util.ts`) | Dependency directions are not enforced, and helper ownership is unwritten |

## Scope rulings

- **Plan truth without a second renderer.** The 2D reading draws Paper from Layout's existing Plan
  representation, plus Scene footprint symbols, in the one Canvas through the one
  `ViewportEvaluation`. Plan hits resolve against what is drawn. **Paper is the default (D5)**;
  shaded Plan is an app-menu viewing preference. The Camera transition is unchanged.
- **Dock set (D3):** Select · Ink (Line, Box) · Measure · Eraser (one subject per click), with the
  Library beside it. Ink's Wall reading gains Box; the Shape reading keeps its shipped Line, Box,
  Round and Sketch. Slice, Brush and curved-Wall Round and Sketch stay absent rather than inert.
- **History is already one authority.** R217 enforces F4 and gives the live-gesture Undo refusal
  one owner. It does not rebuild history.
- **Packages are clarified, not merged.** `layout-core` (architectural topology, compilation, Plan
  representation), `geometry-core` (native form profile and extrusion), `camera-core` (viewport,
  projection, Camera evaluation) and `project-model` (units, codecs, Scene planning) stay
  separate. No new shared spatial package is created. A helper moves only when a second
  runtime-safe consumer exists.
- **Scaling follows the domain.** Catalogue objects resize uniformly and native forms per axis
  ([Scene contract](../../reference/components/scene-content.md)).
- **No big-bang refactor.** The route and facade shrink by extraction inside the slices that need
  it.
- **The wireframe is evidence.** PLATE and the grammar own behaviour; each slice's review owns
  pixels, keys and hit-area values.

## Shared Stage interaction: coordination over domain policy

The Stage coordinates; domains decide. This split governs S03, S07, S08, S09 and S10, and S01
writes it into [`architecture.md`](../../reference/architecture.md).

| The Stage host coordinates (T1) | Each domain decides (Layout T1 · Scene T2 · forms T5 · Camera/Experience T3) |
| --- | --- |
| Normalizes fine and coarse pointer input, and routes it by state. A live gesture's owner captures. A domain tool asks only its domain. A host tool (Measure, Eraser) asks every domain that declares it. Otherwise it is Select | Which of its subjects and handles are eligible in this reading, tool and selection, including its eligibility and refusal words for each host tool it declares |
| Asks each domain for **one winner**, then arbitrates **only between domain winners** by spatial truth: the nearest surface along the ray in 3D, and the Paper reading's draw order in Plan. The selected subject's admitted marks rank above world geometry | Its own hit test, its ranking within the domain (for example Opening over its host Wall in Plan Select and Eraser, with Wall-first order in 3D) and its **occlusion policy** (for example Scene support occlusion and halo probe, or Layout pick surfaces at drawn height). Appearance never changes eligibility: Paper hides meshes through the camera layer mask, never through `visible` |
| Holds hover, selection and mark-disclosure state as session state, and draws hover, selection and marks | Which marks exist: editing grips, each naming the planner it calls, and disclosure marks such as the scale point, which only reveal grips and write nothing |
| Keeps the existing single gesture lease and live-proposal Undo reason; owns every interruption trigger | What a gesture means, its candidate, its **refusal text** and its pointer capture semantics |
| Grows mark hit areas to 44 × 44 px on a coarse pointer while marks stay visually small | Whether a larger hit area could be ambiguous within its class, and how to disambiguate |

The host never computes a domain hit, reorders a domain's candidates, rewrites a refusal or imposes
one cross-domain node, anchor or object priority (grammar §Layering, occlusion and hit legibility).
Experience-lens Camera framing policies keep their T3 owner. S03 routes them through the
coordinator without changing their behaviour.

## Height Sheet foundation and the Slice seam

PLATE's Height Sheet answers "at what height". R217 builds it as a functional foundation with one
consumer. It keeps Slice out of scope without closing the door on it.

```text
SHEET (host, view/session state)          CONSUMERS (registered by role)
  height above the datum ───────────────▶ v1  Plan cut          planParameters.cutHeightMeters (R217.S06)
  ticks: datum · found surfaces · pins     ▷   Slice, horizontal  yellow inspection + "Cut at h · depth" pill (future)
  snap to ticks while dragging             ▷   Ink at height      needs a domain-admitted raised support (future)
                                           ▷   Level ticks        needs Layout Levels (vertical foundation, future)
```

- **v1 (S06):**
  - The Sheet publishes one height fact, plus session pins. Moving it re-evaluates Plan, so the cut and projected streams visibly change.
  - In 3D the Sheet plane is a quiet neutral tint: never yellow, never gold, with no cut-away, pill or Put back.
  - Ticks are the floor datum, read-only found surfaces from owner queries (Layout plinth tops, Scene floor-standing tops) and session pins.
- **The seam:** the Sheet never knows its consumers. A later Slice registers as a consumer of the same height and adds the temporary inspection, 3D cut-away and pill. A raised Ink sheet and Level ticks each arrive with their own domain admission. None of them changes who owns the height or makes it source.
- **Never, in any version:** the Sheet arms nothing, writes no source, creates no Level, enters no history and makes nothing dirty.

## Persistence, history and session state

| Kind | Examples | Saved | After reload |
| --- | --- | --- | --- |
| **Source** | Layout, Scene, Camera and Experience units | Yes; Save writes accepted source only, and never a live gesture's candidate | Byte-identical |
| **Undo history** | F4 entries | **Never**; bounded session state | Empty; Undo and Redo unavailable, with their reason |
| **Session and view state** | Selection, hover, armed tool, palette, reading, grid and snap toggles, Sheet height, pins, Index and Card open state | Never | Defaults |
| **App preferences** | Paper or shaded Plan, Reduce motion, Motion speed | Never in project source | Kept per browser; S02 decides the store |

Within a session, Undo after Save follows the landed F4 rule. No Undo crosses a replacement
baseline.

## Ownership and review

| Concern | Owner | R217 slices that touch it | Reviews |
| --- | --- | --- | --- |
| Shell (Head, Index, Card, lower edge), Stage host, input, picking coordination, selection, marks, drafting state, Height Sheet | T1 | S01–S07, S10, S11, S12–S16, S18–S23 | T3 for Head, Find and Experience-lens effects; T2 and T5 for contributions |
| Layout representation, Layout hits and planners | T1 | S04, S06, S07, S14–S16 | — |
| Scene placement, transforms, footprints, support occlusion, delete | T2 | S04 (symbols), S06 (found surfaces), S08, S10 (Eraser), S17 | T1 |
| Native forms, form handles, `geometry-core` | T5 | S04 (form footprints), S09, S17 (form marks and ghosts, reviewed by T5) | T2 for Scene adapter files, T1 for the mark layer |
| F4 acceptance and history, Save, Camera/Experience lens, the H0 harness | T3 | S01 (history enforcement), S02 (Head), S03 (Undo reason, Experience routing), S11, S24, S25 | T1 |

Each slice records its shared-file claim (writer, expected patch base, reviewer) in its writer's
baton before editing `stage-facade.ts`, `StageCanvas.svelte`, the spatial route or another track's
adapter. Lanes merge one at a time under the
[shared-file protocol](../cross-track-execution.md#shared-files-and-merge-protocol).

## Sequencing

```text
T5.P01.S03 merged
      │
     S01 ─┬─ S02 shell composition ─────────────────────────────┐
          └─ S03 interaction ─┬─ S04 Paper Plan → S05 drafting ─┼─ S06 Height Sheet
                              └─ S07 marks → S08 objects → S09 forms
                                                                └─ S10 dock (needs S02, S05, S07, S08, S09)
                                                     S11 final gate (needs all)
```

S02 and S03 can run in parallel; they touch different files apart from the route, which is
claimed. After S03 there are two lanes: drawing surface (S04 → S05 → S06) and interaction
(S07 → S08 → S09). S08 and S09 both edit the Scene adapter, so T2 merges first unless the claims
record a swap.

The post-S10 slices run before S11. They were numbered after it because accepted identities stay
stable, so S11 is still the final gate:

```text
S12 Camera basis ──────────────────────────────┐
S13 Drafting ─┬────────────────────────────────┤
              └─ S14 Live feedback ─ S15 Walls ─┬─ S16 Openings, Junction hover
                                                └─ S17 Scene and forms ─┬─ S18 Selection ink
                                                                        └─ S19 3D ground clipping
S13 → S20 Roles and Head → S21 Index and Card → S22 Geometry, Card, Sheet → S23 Ink palette, widths
S24 Experience controller ─────────────────────────────────────────────────┴─ S25 Experience homes
                                                     S11 final gate (needs all)
```

Editing comes before shell polish, because polish over a surface that cannot be edited would be
visual parity at the expense of function. The [execution plan](./post-s10-convergence/execution-plan.md#shared-file-order)
owns the total order and shared-file conflicts.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R217.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Responsibility map and boundaries](./r217.s01-responsibility-map-and-boundaries/implementation-plan.md) | [record](./r217.s01-responsibility-map-and-boundaries/acceptance.md) | owner override 2026-10-28 for PR #220 revision `06b77a29`; shipped by P1 merge |
| R217.S02 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Shell composition](./r217.s02-shell-composition/implementation-plan.md) | [record](./r217.s02-shell-composition/acceptance.md) | owner-released 2026-10-28; reviewed and accepted 2026-10-29; P1 merge |
| R217.S03 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Stage interaction coordination](./r217.s03-stage-interaction-coordination/implementation-plan.md) | [record](./r217.s03-stage-interaction-coordination/acceptance.md) | owner-released 2026-10-28; reviewed and accepted 2026-10-29; P1 merge (PR #222) |
| R217.S04 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Paper Plan](./r217.s04-paper-plan/implementation-plan.md) | [record](./r217.s04-paper-plan/acceptance.md) | owner authorized implementation 2026-10-29 without a release-list row; independently reviewed and accepted 2026-10-29; P1 merge (PR #223) |
| R217.S05 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Drafting state](./r217.s05-drafting-state/implementation-plan.md) | [record](./r217.s05-drafting-state/acceptance.md) | plan approved by the owner's merge of PR #217; owner authorized recovery/repair of existing PR #226 on 2026-10-29; independently reviewed and accepted 2026-10-29; P1 merge commit required, owner action pending |
| R217.S06 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Height Sheet foundation](./r217.s06-height-sheet-foundation/implementation-plan.md) | [record](./r217.s06-height-sheet-foundation/acceptance.md) | plan approved by the owner's merge of PR #217; independently reviewed and accepted 2026-10-30; P1 merge commit (PR #227) |
| R217.S07 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Selection, hover and the mark layer](./r217.s07-selection-and-mark-layer/implementation-plan.md) | [record](./r217.s07-selection-and-mark-layer/acceptance.md) | owner authorized implementation 2026-10-29 without a release-list row; independently reviewed and accepted 2026-10-29; P1 merge (PR #224) |
| R217.S08 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Scene object marks](./r217.s08-scene-object-marks/implementation-plan.md) | [record](./r217.s08-scene-object-marks/acceptance.md) | owner authorized implementation 2026-10-29 without a release-list row; independent review and owner Card-lifecycle correction resolved; accepted by owner closeout 2026-10-29; P1 merge (PR #225) |
| R217.S09 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Native form marks](./r217.s09-native-form-marks/implementation-plan.md) | [record](./r217.s09-native-form-marks/acceptance.md) | plan approved by the owner's merge of PR #217; independently reviewed and accepted 2026-10-30; P1 merge commit (PR #228) |
| R217.S10 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Dock completion](./r217.s10-dock-completion/implementation-plan.md) | [record](./r217.s10-dock-completion/acceptance.md) | plan approved by the owner's merge of PR #217; owner accepted 2026-10-30 after independent combined T1/T2/T3/T5 review; P1 merge required (PR #229) |
| R217.S11 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./r217.s11-integrated-final-gate/implementation-plan.md) | [record](./r217.s11-integrated-final-gate/acceptance.md) | plan approved by the owner's merge of PR #217; released by the owner's merge of PR #230 to run after R217.S12–S25; its acceptance and merge stay with the owner |
| R217.S12 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Camera basis](./r217.s12-camera-basis/implementation-plan.md) | [record](./r217.s12-camera-basis/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; released by the owner's merge of PR #230; independent T3 review ACCEPT 2026-10-30; shipped by P1 merge (PR #231) |
| R217.S13 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Drafting simplification](./r217.s13-drafting-simplification/implementation-plan.md) | [record](./r217.s13-drafting-simplification/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; released by the owner's merge of PR #230; independently reviewed CLEAN 2026-10-30; shipped by P1 merge (PR #232) |
| R217.S14 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Live feedback](./r217.s14-live-feedback/implementation-plan.md) | [record](./r217.s14-live-feedback/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; released by the owner's merge of PR #230; independently reviewed CLEAN 2026-10-30; shipped by P1 merge (PR #233) |
| R217.S15 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Wall direct manipulation](./r217.s15-wall-direct-manipulation/implementation-plan.md) | [record](./r217.s15-wall-direct-manipulation/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record; independently reviewed CLEAN 2026-10-30; shipped by P1 merge (PR #234) |
| R217.S16 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Openings and Junction hover](./r217.s16-openings-and-junction-hover/implementation-plan.md) | [record](./r217.s16-openings-and-junction-hover/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230; accepted by owner combined closeout 2026-10-31 at `0a32f53e` (owner-override: no second review); shipped by P1 merge (PR #237) |
| R217.S17 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Scene and form manipulation](./r217.s17-scene-and-form-manipulation/implementation-plan.md) | [record](./r217.s17-scene-and-form-manipulation/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record; owner-override: no additional review round; accepted by owner combined closeout 2026-10-31 at `a5099cdc`; shipped by P1 merge (PR #239) |
| R217.S18 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Selection ink](./r217.s18-selection-ink/implementation-plan.md) | [record](./r217.s18-selection-ink/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record; accepted 2026-10-31 at `f92e1211` by the owner combined acceptance-and-closeout instruction; shipped by P1 merge (PR #242, merge commit `dc341786`) |
| R217.S19 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [3D ground clipping](./r217.s19-3d-ground-clipping/implementation-plan.md) | [record](./r217.s19-3d-ground-clipping/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S20 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Roles and Head](./r217.s20-roles-and-head/implementation-plan.md) | [record](./r217.s20-roles-and-head/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S21 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Index and Card](./r217.s21-index-and-card/implementation-plan.md) | [record](./r217.s21-index-and-card/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S22 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Geometry, Card and Height Sheet](./r217.s22-geometry-card-and-height-sheet/implementation-plan.md) | [record](./r217.s22-geometry-card-and-height-sheet/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S23 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Ink palette and constrained widths](./r217.s23-ink-palette-and-constrained-widths/implementation-plan.md) | [record](./r217.s23-ink-palette-and-constrained-widths/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S24 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Experience controller](./r217.s24-experience-controller/implementation-plan.md) | [record](./r217.s24-experience-controller/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |
| R217.S25 | approved | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Experience shared homes](./r217.s25-experience-shared-homes/implementation-plan.md) | [record](./r217.s25-experience-shared-homes/acceptance.md) | owner accepted O1–O9 and directed registration 2026-10-30; plan approved and slice released by the owner's merge of PR #230, under the campaign record |

**R217.S17A** (shipped) is a follow-up to S17 outside the numbered register, whose id grammar has no suffixed slice: [plan](./r217.s17a-shape-drawing-simplification/implementation-plan.md), [record](./r217.s17a-shape-drawing-simplification/acceptance.md). Decisions O10 and O11; S11 owns its integrated acceptance.

Every consumed gate is `accepted` and every required scope `active` on `main` at this registration.
Each slice rechecks them at its own trusted base. No slice provides a gate, changes a persisted
format or adds an F interface. The architecture cycle is in its owner-verdict stage; R217
configures no window.

```text
FINAL PHASE GATE: R217.S11 → ./r217.s11-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

Passing the final gate makes R217 closable; only an explicit owner phase-close request closes it,
and `phase-closeout` then moves its track-register row to `shipped`.

## Acceptance journeys

S11 runs every journey in two browsers, with fine and coarse pointers. The criteria are in
[S11's plan](./r217.s11-integrated-final-gate/implementation-plan.md#5-journeys).

| # | Journey |
| --- | --- |
| J1 | Shell composition at wide, small-laptop and iPad widths |
| J2 | Plan truth and 2D ↔ 3D continuity |
| J3 | Drafting: grid, snap, scale, Box, Measure |
| J4 | Height Sheet: cut, ticks, pins, no source effect |
| J5 | Legibility: hover, selection and focus in both readings |
| J6 | Walls and Openings by marks and Card |
| J7 | Objects and native forms by marks, typing at the gesture and Card |
| J8 | Eraser and Undo |
| J9 | Coarse pointer and touch |
| J10 | Interrupted-gesture recovery |
| J11 | Source persistence versus session history and state |
| J12 | Plan flip continuity across azimuths |
| J13 | 3D ground and grid with the horizon in frame |
| J14 | Direct Wall, Junction and Opening editing from Plan alone |
| J15 | Direct manipulation of every subject type, in both readings |

## Non-goals

Roofs and overhead forms; materials, Brush and light editing; multi-select, marquee and
Align/Distribute; publication and all T4 work; Levels, vertical foundation and Ink at height;
Slice, Section, Face and Unroll; curved Walls, Round and Sketch; Object Focus and T5.P02 shaping;
Experience Guide and Path redesign; the full scope-model Index and global subject Find; persistent
pins; new formats or gates; phone layouts; performance benchmarks (the mandate is
[suspended](../../reference/decisions/performance-mandate-suspension-2026-10-28.md)); a wholesale
rewrite of the spatial route.
