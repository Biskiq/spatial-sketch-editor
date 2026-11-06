# Core Editor Stability — pre-publication product milestone

**Status:** **Core Product Stability accepted; R217 closed**, effective at PR #271's merge
(`ce4e232c`, 2026-11-06). The owner personally tested and accepted the integrated product, including
the final Experience changes. [R217.S11 is owner-accepted by override; separate gate execution
waived](./r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md) because that
hands-on product review already occurred. This does not mark unexecuted individual checks passed.

The milestone originated in owner ruling R1-D on 2026-10-17
([record](../reference/decisions/next-batch-authorization-2026-10-17.md#ruling-r1-d-t4-deferral-2026-10-17));
the owner added Shell coherence on 2026-10-28
([rulings](../reference/decisions/core-editor-stability-planning-2026-10-28.md)). The criteria and
planning snapshot below preserve that history. No separate acceptance plan, S11 execution,
manual-journey rerun or phase closeout remains. [#259 implementation](./lean-harness-proposal.md)
is the immediate next step, with independent verification requirements; no T4 production scope
is implicitly released by this milestone acceptance.

**What it means.** A creator can build, compose (including one of their own models), author, preview,
save and reopen a real project in the editor, safely, responsively and repeatably, with no publication.
It needs a **useful, self-contained creator workflow**, not a collection of accepted core providers:
accepted slices are evidence toward it, never a substitute. It needs basic useful capability in every
area below. Advanced features and polish are not automatic prerequisites.

## Acceptance route

The owner's explicit acceptance at #271's merge supersedes the former separate milestone-plan
and S11 ceremony. The existing [S11 acceptance record](./r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md)
records the product review, owner override and limits of execution evidence. No integration
workspace, additional gate version, separate approval or closeout PR is needed.

<a id="criteria-proposed"></a>

## Accepted product criteria and historical planning snapshot

The integrated product is owner-accepted. The original scope and provider/evidence snapshot below
is historical, not a current task list or a per-row claim that all proposed checks ran. AM-11 owns
the final Experience semantics, superseding older continuation wording. Current R217 status and
execution limits live in its acceptance record; useful original evidence is retained.

| Area | Required (basic, useful) | Not required | Historical planned owner | Historical preacceptance evidence |
| --- | --- | --- | --- | --- |
| Layout editing | Select and inspect in Plan and 3D; Wall height/thickness and Opening dimensions; straight-Wall length, angle and move preserving shared Junctions; the native plinth | Arch rise, profiles, Section/Unroll, levels/structures | Closed T1.P01: S07 → S04 → S05 → S06 | Shipped; T1.P01 closed 2026-10-21 after S06 (PR #168) |
| Layout creation | From empty or the starter: draw straight Walls into closed enclosures with derived Rooms/floors, add Openings, delete Walls; explicit connections, never coordinate adoption; canonical Layout compiler authority | Curved-Wall drawing, non-enclosing rings, levels, overhead forms | Intended owner: **T1**, C1's proposed bounded native-Wall creation/role cutover after the landed F2 cutover (K3) ([T1.P01 §next boundary](./t1-spatial-world/t1.p01-stage-foundation/README.md#deliberately-deferred-scope-and-next-boundary)) | Partial: `T1.P02.S01` shipped Layout identity capture and format 6 derived Wall roles; drawing is not implemented and follows `T1.P02.S05` legacy retirement, then S02–S04 ([phase register](./t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register)) |
| Scene composition | Place native primitives and admitted catalogue models on floor support; move, yaw, uniform resize, duplicate, delete; exact input in both readings | Materials/light editing (existing values preserved), multi-select, attachments | Closed T2.P01 S03 → S04, integrated into unit F4 by T3.P01.S04 | Shipped; T2.P01 closed 2026-10-20 after S04 (PR #157) |
| Own model import (K1) | One bounded **editor-side GLB import**: upload one flat GLB (with embedded or adjacent maps), validate/stage, record scale/pivot/footprint, approve, place, Save and reload; retain original bytes/hash, recipe identity/version and a parts-safe derivative | Advanced ingest (assemblies, component admission/addressing, provider search, formats beyond GLB, marketplace), and any T4 release closure or publication of the resource | Intended owner: **T2**, C2 after the landed T3.P01.S04, using F2 resource locks and T3.P01.S05's `unit-acceptance-v1`; no T4 dependency | Partial: `T2.P02.S01` shipped model-resource storage and admission (Scene 3, resources 2); import UI, approval and placement are `T2.P02.S02` ([phase register](./t2-composition/t2.p02-own-model-import/README.md#slice-register)); qualified references keep `componentId: null` |
| Camera/Experience authoring | Capture a View and bind a Guide-free Presentation in one acceptance; optionally add a Stop, reorder by identity and set holds/continuation | Advanced path/anchor authoring, rich transport, media, branch rejoin, part annotation | Landed T3.P01 S05/S06 → S04 foundation, then registered [T3.P02](./t3-experience/t3.p02-capture-and-cut-preview/README.md); S02 integrated completion | Source/runtime split and F4 foundation shipped; `T3.P02.S01` shipped first capture and Cut Preview; first Guide and integrated completion are `T3.P02.S02` ([phase register](./t3-experience/t3.p02-capture-and-cut-preview/README.md#slice-register)) |
| Isolated Preview | Cut-based Preview through the shared lowering/evaluator, with reduced motion and semantic navigation; enter a Guide-free Presentation without fabricating a Stop; no editor machinery in the runtime | Release Preview of a real package (T4), part annotations and capability-aware interaction | Registered T3.P02; S02 integrated completion | Partial: `T3.P02.S01` shipped Cut-based Preview; Camera handover/return and integrated completion are `T3.P02.S02` ([phase register](./t3-experience/t3.p02-capture-and-cut-preview/README.md#slice-register)) |
| Durable Save/reload | Conditional Save (create-only / expected base), dirty state, conflict preservation, reload; unit Save after cutover | Overwrite-remote resolution, collaboration | Landed T3.P01 S02/S05/S04 and T1.P01 S04 Head Save | Shipped on the F2 source tree; deployment/epoch activation remains owner-controlled |
| Deterministic history | One chronological Undo/Redo across Layout/Scene/Camera-Experience; invalid/no-op produce no entry; Redo replays captured IDs; history is bounded session state, never saved, and empty after reload | Op-log/CRDT, exit-summary undo, persisted Undo history | Landed shared F4 from T1.P01 S03/S07 and T3.P01 S05/S04; consuming T2/T3 operations | Shared bounded unit history and Layout/Scene editing shipped; creator Capture/Preview operations await held P1 |
| Project lifecycle | Create (empty or starter), list and open own projects, rename, delete (or archive) with confirmation, guarded replacement | Duplicate, sharing, templates beyond the starter | Create/list/open/replace: landed T1.P01 + T3 Save. C3 rename/delete (K4): **T3** persistence/API, **T1** shell integration | Create/list/open/guarded replacement shipped; rename/delete released as `T3.P04.S01` (2026-10-24) and not started |
| Error recovery | Explicit refusal/diagnostic states, stale/epoch rejection, conflict → download JSON → reload, resume of the sign-in Save draft, source JSON download/reopen | Automatic merge, offline queue | Landed T1.P01 and T3.P01 conditional unit Save/recovery | Shipped; new consuming scopes must retain these refusal/recovery paths |
| Shell coherence | The Head, collapsible Index, contextual Card and lower working edge composed per PLATE at small-laptop and iPad widths, with layout changes never moving the Camera; Plan drawn as Paper from the Layout representation and picked from what is drawn, shaded Plan as a viewing preference, and continuous 2D ↔ 3D; grid, snap, Grid · Snap and a Height Sheet that sets the Plan cut; gold selection, hover below selection and one admitted mark language for Walls, Openings, objects and forms; dock Select · Ink (Line, Box) · Measure · Eraser · Library; fine and coarse pointer (44 px targets, touch paths for hover reveals); interrupted gestures that leave no trace; one Stage coordination over domain hit, occlusion and refusal policies | Slice, Section/Face/Unroll, Levels and Ink at height, Brush, Sketch/Round, multi-select, phone layouts, the full scope-model Index | [R217](./r217-core-editor-stability/README.md) S01–S11; S11 is its integrated evidence (journeys J1–J11) | Planned 2026-10-28; nothing released |
| Representative browser workflows | Recorded journeys on the integrated tree: empty → draw → import own GLB → place → capture → Preview → Save → reload; starter → edit → conflict → recover; rename/delete; keyboard-only, narrow, coarse-pointer and reduced motion | Every edge case | The milestone acceptance plan | — |
| Basic responsiveness | Reproducible measured evidence on named fixture sizes for load, edit, Undo/Redo and Save, plus applicable consuming-slice delivery/compile/drag/commit/import/Preview/memory observations; no stale state, lost input or duplicate application | Benchmark infrastructure as an independent prerequisite when equivalent reproducible manual measurements establish the same evidence; the retired bench harness | Consuming slices plus the integrated milestone acceptance plan; H0's shipped on-demand harness/bundle workflow supplies support | Convergence Node measurements expose Layout drag/commit/Undo risk pending calibrated browser evidence; consuming-slice fixes and integrated evidence remain outstanding |
| Isolation | Visitor/public/preview boundaries green; no editor machinery in public chunks | — | Existing arch/build boundaries, with shipped H0 repairs | Closed P01 acceptance is recorded; convergence identified stale boundary patterns that need repair and fresh integrated verification |

The older released lanes and partial-provider descriptions above record the planning baseline.
R217's integrated product acceptance now satisfies this milestone. Advanced vertical/part/attachment
work remains outside its scope; future work follows its own authorization and #259's cutover.

## Sequencing findings

| # | Finding | Kind | Bounded resolution / current consequence |
| --- | --- | --- | --- |
| K1 | T2's planned ingest phase assumed "T4 resource delivery". Requiring that would deadlock against R1-D. | **Resolved by ruling** | Own-model import is required, but only the bounded **editor-side GLB import**, with no T4 release closure (criteria row above). It depends on T3.P01.S04 (F2 locks) and T3.P01.S05's `unit-acceptance-v1`, not on T4. Release closure and advanced ingest stay deferred. T2 plans it through normal phase registration and slice authorization. |
| K2 | T3.P01.S04 activation needs an owner-accepted publication gap that now runs until T4's prepared-reader cutover. | **Gap approved 2026-10-19** ([record](../reference/decisions/t3-cutover-ratification-2026-10-19.md), R4) | Temporary publication unavailability is acceptable in principle (2026-10-17). Under AM-9's clean source epoch every publication and release row is removed at activation, so the covered set is empty by construction. The approved gap is no publishing from activation until `T4.P01.S05`: Publish/Update return `prepared-reader-required`, and public reads are honest not-found/unavailable. |
| K3 | Layout creation needs a T1 Wall-authoring phase, ordered against the F2 cutover. | **Ruled** | Plan bounded straight-Wall creation after the F2 cutover, as a Layout unit version under F2. Rooms stay derived, connections explicit and Layout the canonical authority. It is not authorized here. |
| K4 | Project rename/delete had no owner. | **Ruled** | T3 owns persistence/API in a separate small slice, not inside T3.P01.S04. T1 owns the shell integration. It is not authorized here. |
| K5 | Is Camera/Experience authoring or Preview blocked by T4? | No | T3.P02 consumes the accepted T3.P01.S04 cutover and viewport (via T1.P01.S07), not T4. Editor Preview uses T3's shared lowering; integrated T3.P02.S02 completion is released; later work remains held. |
| K6 | T1.P01 S04/S05 and T2.P01 S03/S04 originally used current-source F4; those adapters are retired. | Cutover landed | T3.P01.S04 migrated all live T1/T2 callers and unfinished requirements to unit scopes. Shipped acceptance rows preserve their historical requirements; new/in-progress consumers declare active unit capabilities. |

## Not prerequisites

Publication UI, releases, prepared delivery, Release/Source Baselines, advanced ingest beyond the one
bounded GLB import, materials/lights
authoring beyond preservation, levels/structures, Section/Unroll/peel, curved-Wall drawing, advanced
Camera paths, multi-selection, collaboration and benchmark infrastructure. Any of these can be added
to the milestone only by an explicit owner amendment of this page. Part addressing/annotations,
assemblies, attached composition, advanced vertical architecture and overhead families likewise
remain outside this milestone. A benchmark harness is not independently required if equivalent
reproducible manual measurements supply the consuming-slice and integrated performance evidence.
The earlier proposed final M/L spot check was part of the superseded separate acceptance design.
It is not future R217 work and is not claimed as executed by the owner acceptance ruling.
