# Planning frontier — proposals awaiting completion

This is a handoff, **not an implementation-ready approved plan**. Complete exact contracts and per-slice acceptance before release. The owner's request is a docs-only convergence plan; Docker dependency closure is the sole code exception.

## Reconciled target direction

The accepted [PLATE contract](../../../reference/design-system/editor-shell-and-visual-system.md), [instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md), [Round 2 wireframe](../../../../prototypes/production-shell-wireframe/README.md) and [S07 acceptance](../r217.s07-selection-and-mark-layer/acceptance.md) were read. The production shell appearance should converge while its current semantic model stays intact.

| Role | Proposed concrete target | Preserve |
| --- | --- | --- |
| Head | 44 px fine-pointer reference; Index toggle, Biskiq, distinct project name, World/Experience, context, Find, Undo/Redo words, Save, gold Preview. Compress metadata before identity | Eligibility, live-proposal history refusal, project lifecycle, app preferences and keyboard access |
| Type/control | Scoped semantic roles: 13 px ordinary sans, 12–12.5 px utility, 15 px serif project identity, tabular measures. Prototype values are calibration proposals, not a new authority | At least 44×44 coarse hit areas; no blanket tiny text or CSS scale transform |
| Color | Forest #11291f; mat #1D3A33; paper #e9ebe6; Index #f6f7f5; Card white; gold #d4ad45. Active lens pale with forest ink; gold selection; neutral hover | Existing domain meanings, erase/refusal colors, visible keyboard focus |
| Index/Card | Reference widths 256/288 px; compact locator rows; one fact/writer per Card field; secondary details disclosed; contextual action styling | Canonical identities, one selection owner, precision writers, current navigation semantics |
| Height Sheet | Thin line with knob and semantic ticks, no box or permanent HEIGHT label; value/snap name on focus, drag and touch | Session height/pins, owner-qualified found tops, Plan cut, neutral 3D plane, side swap and keyboard input |
| Lower edge | One dock/palette/instrument composition; measure actual occupied span and reserve drafting/Sheet lanes | Select/Ink/Measure/Eraser/Library, all current Ink modes, typed precision and candidate lifecycle |
| Responsive | Compare 1440×900, 1280×800, 1180×820 and 820×1180; invoked Index/Card sheets at constrained widths; explicit scrim ends above dock | No implicit Camera fit/pan on layout change, active tool, selection and spatial memory |
| Experience | Shared shell homes; active Experience in Head, locator in Index, selected facts in Card, invoked Guide on lower edge | Capture current View, first-Guide intent, travel-gap behavior, F4 history and isolated Preview |

Do not manufacture a hierarchical Structure/Level Index from future PLATE concepts. Do not replace the real command/admission model with prototype click handlers. Do not remove imported models, native-form axis sizing, catalogue uniform scale, Paper/shaded preference, snap/scale settings or source utilities just because the wireframe demonstrates fewer cases.

## Candidate execution graph and ownership

Identifiers below are local planning labels, **not registered R217 slices or release permissions**. Recommended critical-path order: C01 → C02 → C03 → C04; correctness work C05/C06/C08/C09 can prepare against explicit shared-file claims. Serialise integration patches to the route, facade and Canvas. All work eventually returns to R217's existing exhaustive integrated gate; do not start S11 in this task.

| Candidate | Scope / dependencies | Exact existing ownership seam | Acceptance frontier to turn into journeys |
| --- | --- | --- | --- |
| C01 shell roles + Head | D01–05/25/26; first | T1 shell EditorHead, shell role stylesheet to be named; T3 reviews command/preferences reach | Empty/dirty/refused states; words, color and density; all former menu capabilities reachable; keyboard/coarse targets |
| C02 Index + Card | D06–10; C01 | T1 EditorIndex/EditorCard; domain contributions reviewed by T2/T3/T5 | Long/repeated names, one field per fact, selection vs frame, duplicate not destructive, no raw diagnostic prose |
| C03 lower edge + responsive Sheet | D11–14; C01/C02 | T1 route, StageDock, StageInstrumentHost, StageHeightSheet, LayoutInkPalette | Four viewports, open/close sheets, pin/drag/key height, no overlap, no Camera movement |
| C04 Experience shell integration | D24; C01–03 | T3 ExperienceSurface and shell contribution wiring; T1 sole route writer | World↔Experience, Capture/View/Guide/Preview/return, history and lens parking unchanged |
| C05 projection + live Layout preview | D15/16; independent of cosmetic work, integrate after shell coordinate contract | T1 layout.adapter, stage-facade, StageOverlay and candidate representation | Hover/press/drag Wall/Box/Opening, length/angle/snap, offset Index, cancel/refusal no mutation, one commit/Undo |
| C06 Scene/form ghosts | D17/18; C05 representation contract or separately reviewed compatible seam | T2 scene.adapter/candidate-ghost, StageCanvas; T5 StageFormGhost/form contribution | Primitive/catalogue/approved model/native form in Paper and 3D; move/turn/scale/place ghost matches candidate; no pick interception |
| C07 Junction/body manipulation | D19/20; C05, owner O2 | T1 Layout adapter/precision/wall-gesture; existing layout-core planners | Shared Junction with 2+ Walls and Opening, rigid body, snap/invalid/cancel/Undo; retain explicit length operation |
| C08 Camera basis continuity | D23; owner O3 | T3 camera-core viewport and owning Camera tests; T1 reviews Stage interaction | Full-frame transition sweep, azimuth ties, reduced motion, interruption, 20 cycles, target/scale/no roll |
| C09 finite ground clipping + coverage | D21; owner O4; serialise Camera edits after C08 | T3 owns viewport clip contract; T1 stage-grid, StageGrid/stage-grid-scene and StageCanvas mat | Shallow/medium/overhead orbit+zoom; coverage to visible ground edges, no artificial cutoff, finite geometry and stable depth |
| C10 selection material/footprint | D22; owner O1; serialise Paper/Canvas edits after C06 | T1 paper-marks/StageSelectionLayer/paper-plan; T2/T5 validate footprint identity | Walls/Openings/objects/forms in both readings; overlap/occlusion/hover, selection visibly on geometry |

C01/C08 can prepare independently. C05 and C07 cannot concurrently edit the Layout adapter. C06 and C10 must coordinate Paper/Canvas ownership. C08 and C09 share Camera viewport and merge serially. C03/C04 share route and merge serially. Every future slice needs a recorded writer, patch base, reviewers, exact contract delta and rollback condition. Do not turn this table into permission to run parallel agents; owner requested independent work with no subagents for this task.

## Owner decisions to resolve in the completed plan

- **O1 — selection contract:** recommend actual geometry tint plus contour, using prototype .28 mat/.22 Paper as initial explicit calibration, dark #74560c Paper edge versus gold mat edge. This revises accepted S07 .18 tint/bright Paper gold. Confirm aperture treatment and overlap occlusion before changing contracts. Missing Scene Paper fill is independently confirmed.
- **O2 — Junction access:** endpoint length is accepted S07 behavior. Recommend preserving it and adding an explicit canonical-Junction context affordance backed by `planExactJunctionMove`; choose exact activation/disclosure before implementation. Do not silently repurpose endpoints or restore removed angle ring/grips.
- **O3 — Camera endpoint:** recommend a basis continuous with increasing 3D elevation, keeping nearest-quarter-turn snapping and remembered elevation. Correcting the sign changes current Plan screen-axis convention; explicitly adjudicate. A global north-up policy or restoring the entire prior 3D azimuth is a separate behavior change and is not presumed.
- **O4 — ground clipping:** proven scene-bounded clip defect needs Camera-owned display-ground clipping policy distinct from semantic scene fit. Agree the finite ground envelope/depth precision limits. Do not widen authored scene bounds to fix a decoration or create a second Camera.
- **O5 — utility home:** header Index-toggle replacement is already requested. Preserve Settings/preferences/project/source utilities through Find while permanent World Settings placement is resolved; do not drop them. Decide final permanent home without blocking approved visual cleanup.

## Remaining plan obligations

Specify exact props/contribution contracts, semantic token ownership, candidate overlay shape, clipping algorithm and bounded geometry strategy; finish per-reading selection rules (fill/outline/opacity/occlusion) and exact Junction activation. Then write small implementation plans with exclusions, migration/rollback, test files, visual/browser journeys and end conditions. Existing schemas should not migrate; proposals/selection/height/ghosts stay session-only. Revert by coherent PR, including contract/test changes; never roll back by resurrecting old editor infrastructure.

Verification must follow `apps/editor/tests/README.md`: whole architecture lane before every PR, declared tier and integrated route for every future plan; focused tests alone are not acceptance. Formal performance benchmarks remain owner-initiated only. For grid acceptance use deterministic geometry-count bounds and observable browser smoothness; do not assert performance unchanged from correctness tests or introduce a timing gate.
