# Core Editor Stability — pre-publication product milestone

**Status:** the milestone was set by owner ruling R1-D on 2026-10-17
([record](../reference/decisions/next-batch-authorization-2026-10-17.md#ruling-r1-d-t4-deferral-2026-10-17)).
The owner named its scope areas. The exact criteria below are **proposed** and await owner
confirmation at independent re-review. This page is a milestone definition. It is not a gate, phase,
slice or authorization, and it changes no register. All T4 work waits for this milestone's recorded
acceptance.

**What it means.** A creator can build, compose, author, preview, save and reopen a real project in the
editor, safely and repeatably, with no publication. It needs basic useful capability in every area
below. Advanced features and polish are not automatic prerequisites.

## Acceptance route

Acceptance is a **product integration acceptance** ([event](../operations/README.md#product-integration-acceptance)).
Once the contributing phases below have shipped, the owner authorizes one integration plan under
`docs/roadmap/integration/core-editor-stability/`. Its recorded acceptance, on the integrated tree, is
the acceptance this milestone needs. Contributing phases and tracks are not closed by it, and no
Baseline is declared.

**Open point (owner).** The event's text accepts "that gate and version". The gate-register legend
admits only `foundation | capability` kinds and says a gate is "never a milestone". Before the
integration plan is written, the owner either (a) records the milestone's acceptance in the integration
plan's own acceptance record, without a register row, or (b) amends the legend with a reviewed
milestone kind. Option (a) is recommended because it changes no checker. This page decides neither.

## Criteria (proposed)

Each criterion is independently verifiable on the integrated tree. "Planned owner" is the existing
plan; **gap** means no registered plan delivers it today.

| Area | Required (basic, useful) | Not required | Planned owner | Today |
| --- | --- | --- | --- | --- |
| Layout editing | Select and inspect in Plan and 3D; Wall height/thickness and Opening dimensions; straight-Wall length, angle and move preserving shared Junctions; the native plinth | Arch rise, profiles, Section/Unroll, levels/structures | T1.P01 S07 → S04 → S05 → S06 | S07 authorized; rest proposed |
| Layout creation | From empty or the starter: draw straight Walls into closed enclosures with reconciled Rooms/floors, add Openings, delete Walls; explicit connectivity, never coordinate adoption | Curved-Wall drawing, non-enclosing rings, levels, overhead forms | **Gap:** the deferred T1 "Wall authoring/schema cutover" phase is not registered ([T1.P01 §next boundary](./t1-spatial-world/t1.p01-stage-foundation/README.md#deliberately-deferred-scope-and-next-boundary)) | Unplanned (see K3) |
| Scene composition | Place native primitives and admitted catalogue models on floor support; move, yaw, uniform resize, duplicate, delete; exact input in both readings | Creator model ingest, materials/light editing (existing values preserved), multi-select, attachments | T2.P01 S03 → S04 | Proposed; S03 waits for S07 |
| Camera/Experience authoring | Capture a View, bind a Presentation plus an optional Stop in one acceptance, reorder by identity, set holds/continuation | Advanced path/anchor authoring, rich transport, media, branch rejoin | T3.P01 S03 → S04, then the candidate [T3.P02](./t3-experience/t3.p02-capture-and-cut-preview/README.md) | S03 authorized; S04 and T3.P02 need `T3.camera-experience-cutover@1` drafted and ratified |
| Isolated Preview | Cut-based Preview through the shared lowering/evaluator, with reduced motion and semantic navigation; no editor machinery in the runtime | Release Preview of a real package (T4) | T3.P02 | Candidate phase |
| Durable Save/reload | Conditional Save (create-only / expected base), dirty state, conflict preservation, reload; unit Save after cutover | Overwrite-remote resolution, collaboration | T3.P01 S02 (shipped), S03/S04; Head Save in T1.P01 S04 | Partly shipped |
| Deterministic history | One chronological Undo/Redo across Layout/Scene/Camera-Experience; invalid/no-op produce no entry; Redo replays captured IDs | Op-log/CRDT, exit-summary undo | T1.P01 S03 (shipped), S07; T2/T3 operations | Partly shipped |
| Project lifecycle | Create (empty or starter), list and open own projects, rename, delete (or archive) with confirmation, guarded replacement | Duplicate, sharing, templates beyond the starter | Create/list/open/replace: T1.P01 S02 + T3 Save. **Gap:** rename and delete have no API route or plan | See K4 |
| Error recovery | Explicit refusal/diagnostic states, stale/epoch rejection, conflict → download JSON → reload, resume of the sign-in Save draft, source JSON download/reopen | Automatic merge, offline queue | T1.P01 S02 (shipped), S04; T3.P01 S02 (shipped) | Partly shipped |
| Representative browser workflows | Recorded journeys on the integrated tree: empty → draw → place → capture → Preview → Save → reload; starter → edit → conflict → recover; keyboard-only, narrow and reduced motion | Performance benchmarks, every edge case | The integration plan | — |
| Isolation | Visitor/public/preview boundaries green; no editor machinery in public chunks | — | Arch lane (existing) | Green |

## Sequencing findings

| # | Finding | Kind | Bounded resolution (proposed; nothing authorized) |
| --- | --- | --- | --- |
| K1 | T2's next phase, single-model ingest, needs "T4 resource delivery". If ingest were a prerequisite here, it would wait for T4, and T4 waits for this milestone. | **Deadlock if required** | Ingest is **not** a criterion. Composition uses native primitives, admitted catalogue models and T3.P01.S04's captured verified palette. If the owner later wants creator ingest before publication, split it: editor-side stage/approve/place over the existing project asset registry, without T4, and keep release closure after T4. That would be a T2 replan decision. |
| K2 | T3.P01.S04 activation needs "any owner-accepted publication gap". The gap ends at T4's prepared-reader cutover, which now follows this milestone, and Camera/Experience authoring needs T3.P01.S04. If the owner refuses a gap, nothing can proceed. | **Deadlock unless a gap is accepted** | At T3.P01.S04's authorization the owner records an inventory-backed gap that runs until the T4 cutover. Existing publications get a concrete disposition before activation. Public and owner publication routes refuse honestly, and new-format sources are never published through the retained snapshot path. This is the AM-7 obligation, unchanged by R1-D. |
| K3 | Layout creation needs the unregistered T1 Wall-authoring phase. That phase includes a current-format change, and T3.P01.S04 also changes the source format. | Ordering constraint, not a deadlock | Plan the Wall-authoring phase against the **post-cutover F2 Layout unit**, so its format change is a Layout unit version under F2, and keep it bounded to straight-Wall Draw with enclosures and Openings. Registering or planning it is a separate owner decision. |
| K4 | Project rename/delete have no owner: the API has list/get/put only. | Unowned obligation | Assign it to T3 as the persistence/API owner through T3.P01.S04, as a small T3 slice after S04, or to the integration plan. This is an owner decision. |
| K5 | Is Camera/Experience authoring or Preview blocked by T4? | No | T3.P02 needs T3.P01.S04 and the viewport (via T1.P01.S07), not T4. Editor Preview uses T3's shared lowering. |
| K6 | T1.P01 S04/S05 and T2.P01 S03/S04 are written against current-source F4. T3.P01.S04 retires those adapters. | Ordering constraint | Already planned: T3.P01.S04 migrates every T1/T2 caller and unfinished requirement together. Slices still unaccepted at that time re-declare unit scopes. |

## Not prerequisites

Publication UI, releases, prepared delivery, Release/Source Baselines, creator ingest, materials/lights
authoring beyond preservation, levels/structures, Section/Unroll/peel, curved-Wall drawing, advanced
Camera paths, multi-selection, collaboration and performance benchmarking. Any of these can be added
to the milestone only by an explicit owner amendment of this page.
