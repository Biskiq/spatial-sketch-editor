# Core Editor Stability — pre-publication product milestone

**Status:** the milestone was set by owner ruling R1-D on 2026-10-17
([record](../reference/decisions/next-batch-authorization-2026-10-17.md#ruling-r1-d-t4-deferral-2026-10-17)).
The owner approved its direction and ruled on K1–K4 on 2026-10-17 ([rulings](../reference/decisions/next-batch-authorization-2026-10-17.md#core-editor-stability-rulings-2026-10-17)).
The criteria below implement those rulings but remain **proposed pending explicit owner
confirmation**. Independent re-review does not itself ratify the exact milestone criteria. This
page is a milestone definition, not a gate, phase, slice or authorization; it changes no register.
All T4 work waits for this milestone's recorded acceptance.

**What it means.** A creator can build, compose (including one of their own models), author, preview,
save and reopen a real project in the editor, safely, responsively and repeatably, with no publication.
It needs a **useful, self-contained creator workflow**, not a collection of accepted core providers:
accepted slices are evidence toward it, never a substitute. It needs basic useful capability in every
area below. Advanced features and polish are not automatic prerequisites.

## Acceptance route

This milestone has its own acceptance route, the
[product milestone acceptance](../operations/README.md#product-milestone-acceptance) event. It is
deliberately **not** the gate-based product integration acceptance: that procedure accepts a versioned
gate-register row, and this milestone is never a gate.

1. When the contributing work below has shipped, the owner authorizes one acceptance plan, written as
   `plan.md` in `docs/roadmap/integration/core-editor-stability/`. Neither the directory nor its files
   exist before that authorization. The plan fixes the journeys, fixture
   projects and observations that evidence each criterion.
2. Evidence runs on one integrated tree at a recorded revision. That covers the complete merge gate,
   the browser journeys and responsiveness observations below, and independent review.
3. Acceptance is recorded only in that directory's `acceptance.md`, with
   this page's status line updated. No gate row, version or capability is created or changed, and the
   capability checker is untouched. No phase or track closes.
4. The acceptance unblocks only the *eligibility* to request renewed T4 planning (R1-D). Every later
   step still needs its own owner authorization.

## Criteria (proposed)

Each criterion is independently verifiable on the integrated tree. "Planned owner" names the landed
provider, registered plan or proposed continuation; an unregistered continuation is not permission.
The convergence additions below, like the exact milestone criteria, remain proposed until explicit
owner confirmation.

| Area | Required (basic, useful) | Not required | Planned owner | Today |
| --- | --- | --- | --- | --- |
| Layout editing | Select and inspect in Plan and 3D; Wall height/thickness and Opening dimensions; straight-Wall length, angle and move preserving shared Junctions; the native plinth | Arch rise, profiles, Section/Unroll, levels/structures | Closed T1.P01: S07 → S04 → S05 → S06 | Shipped; T1.P01 closed 2026-10-21 after S06 (PR #168) |
| Layout creation | From empty or the starter: draw straight Walls into closed enclosures with derived Rooms/floors, add Openings, delete Walls; explicit connections, never coordinate adoption; canonical Layout compiler authority | Curved-Wall drawing, non-enclosing rings, levels, overhead forms | Intended owner: **T1**, C1's proposed bounded native-Wall creation/role cutover after the landed F2 cutover (K3) ([T1.P01 §next boundary](./t1-spatial-world/t1.p01-stage-foundation/README.md#deliberately-deferred-scope-and-next-boundary)) | Absent; C1 has a registration-ready [T1.P02 draft](./t1-spatial-world/t1.p02-native-wall-creation/README.md), with no phase registered or implementation release |
| Scene composition | Place native primitives and admitted catalogue models on floor support; move, yaw, uniform resize, duplicate, delete; exact input in both readings | Materials/light editing (existing values preserved), multi-select, attachments | Closed T2.P01 S03 → S04, integrated into unit F4 by T3.P01.S04 | Shipped; T2.P01 closed 2026-10-20 after S04 (PR #157) |
| Own model import (K1) | One bounded **editor-side GLB import**: upload one flat GLB (with embedded or adjacent maps), validate/stage, record scale/pivot/footprint, approve, place, Save and reload; retain original bytes/hash, recipe identity/version and a parts-safe derivative | Advanced ingest (assemblies, component admission/addressing, provider search, formats beyond GLB, marketplace), and any T4 release closure or publication of the resource | Intended owner: **T2**, C2 after the landed T3.P01.S04, using F2 resource locks and T3.P01.S05's `unit-acceptance-v1`; no T4 dependency | Absent; C2 has a registration-ready [T2.P02 draft](./t2-composition/t2.p02-own-model-import/README.md) for whole-object import; qualified references keep `componentId: null`; no phase registered or implementation release |
| Camera/Experience authoring | Capture a View and bind a Guide-free Presentation in one acceptance; optionally add a Stop, reorder by identity and set holds/continuation | Advanced path/anchor authoring, rich transport, media, branch rejoin, part annotation | Landed T3.P01 S05/S06 → S04 foundation, then registered [T3.P02](./t3-experience/t3.p02-capture-and-cut-preview/README.md); proposed P1 clarification in the convergence plan | Source/runtime split and F4 foundation shipped; creator authoring unimplemented; T3.P02.S01 held |
| Isolated Preview | Cut-based Preview through the shared lowering/evaluator, with reduced motion and semantic navigation; enter a Guide-free Presentation without fabricating a Stop; no editor machinery in the runtime | Release Preview of a real package (T4), part annotations and capability-aware interaction | Registered T3.P02; proposed stop-free P1 completion before its integrated final gate | Unimplemented; T3.P02.S01 held; S02 remains proposed and unauthorized |
| Durable Save/reload | Conditional Save (create-only / expected base), dirty state, conflict preservation, reload; unit Save after cutover | Overwrite-remote resolution, collaboration | Landed T3.P01 S02/S05/S04 and T1.P01 S04 Head Save | Shipped on the F2 source tree; deployment/epoch activation remains owner-controlled |
| Deterministic history | One chronological Undo/Redo across Layout/Scene/Camera-Experience; invalid/no-op produce no entry; Redo replays captured IDs | Op-log/CRDT, exit-summary undo | Landed shared F4 from T1.P01 S03/S07 and T3.P01 S05/S04; consuming T2/T3 operations | Shared bounded unit history and Layout/Scene editing shipped; creator Capture/Preview operations await held P1 |
| Project lifecycle | Create (empty or starter), list and open own projects, rename, delete (or archive) with confirmation, guarded replacement | Duplicate, sharing, templates beyond the starter | Create/list/open/replace: landed T1.P01 + T3 Save. C3 rename/delete (K4): **T3** persistence/API, **T1** shell integration | Create/list/open/guarded replacement shipped; rename/delete absent and proposed for planning after the first wave |
| Error recovery | Explicit refusal/diagnostic states, stale/epoch rejection, conflict → download JSON → reload, resume of the sign-in Save draft, source JSON download/reopen | Automatic merge, offline queue | Landed T1.P01 and T3.P01 conditional unit Save/recovery | Shipped; new consuming scopes must retain these refusal/recovery paths |
| Representative browser workflows | Recorded journeys on the integrated tree: empty → draw → import own GLB → place → capture → Preview → Save → reload; starter → edit → conflict → recover; rename/delete; keyboard-only, narrow and reduced motion | Every edge case | The milestone acceptance plan | — |
| Basic responsiveness | Reproducible measured evidence on named fixture sizes for load, edit, Undo/Redo and Save, plus applicable consuming-slice delivery/compile/drag/commit/import/Preview/memory observations; no stale state, lost input or duplicate application | Benchmark infrastructure as an independent prerequisite when equivalent reproducible manual measurements establish the same evidence; the retired bench harness | Consuming slices plus the integrated milestone acceptance plan; H0's on-demand harness/bundle baseline is proposed support | Convergence Node measurements expose Layout drag/commit/Undo risk pending calibrated browser evidence; consuming-slice fixes and integrated evidence remain outstanding |
| Isolation | Visitor/public/preview boundaries green; no editor machinery in public chunks | — | Existing arch/build boundaries, with H0 repair proposal | Closed P01 acceptance is recorded; convergence identified stale boundary patterns that need repair and fresh integrated verification |

The [proposed convergence continuation](./cross-track-execution.md#convergence-batch-and-next-planning-wave)
and [main plan](./product-convergence-2026-10-21.md#proposed-next-engineering-batch) recommend H0,
then C1/C2 and the existing Capture/Preview P1, followed by C3 and the next planning wave. C1/C2
planning may proceed while H0 is planned; every implementation remains under the
[owner hold](./README.md#production-implementation-hold). Feature-specific shell design is consuming-slice
work under PLATE's shared invariants and can develop through draft, review, build and revision; it
does not require complete advance design for all prototype features. None of these proposals confirms
the milestone criteria, releases the hold or makes advanced vertical, part or attachment work a
milestone prerequisite.

## Sequencing findings

| # | Finding | Kind | Bounded resolution (proposed; nothing authorized) |
| --- | --- | --- | --- |
| K1 | T2's planned ingest phase assumed "T4 resource delivery". Requiring that would deadlock against R1-D. | **Resolved by ruling** | Own-model import is required, but only the bounded **editor-side GLB import**, with no T4 release closure (criteria row above). It depends on T3.P01.S04 (F2 locks) and T3.P01.S05's `unit-acceptance-v1`, not on T4. Release closure and advanced ingest stay deferred. T2 plans it through normal phase registration and slice authorization. |
| K2 | T3.P01.S04 activation needs an owner-accepted publication gap that now runs until T4's prepared-reader cutover. | **Gap approved 2026-10-19** ([record](../reference/decisions/t3-cutover-ratification-2026-10-19.md), R4) | Temporary publication unavailability is acceptable in principle (2026-10-17). Under AM-9's clean source epoch every publication and release row is removed at activation, so the covered set is empty by construction. The approved gap is no publishing from activation until `T4.P01.S05`: Publish/Update return `prepared-reader-required`, and public reads are honest not-found/unavailable. |
| K3 | Layout creation needs a T1 Wall-authoring phase, ordered against the F2 cutover. | **Ruled** | Plan bounded straight-Wall creation after the F2 cutover, as a Layout unit version under F2. Rooms stay derived, connections explicit and Layout the canonical authority. It is not authorized here. |
| K4 | Project rename/delete had no owner. | **Ruled** | T3 owns persistence/API in a separate small slice, not inside T3.P01.S04. T1 owns the shell integration. It is not authorized here. |
| K5 | Is Camera/Experience authoring or Preview blocked by T4? | No | T3.P02 consumes the accepted T3.P01.S04 cutover and viewport (via T1.P01.S07), not T4. Editor Preview uses T3's shared lowering; implementation remains held. |
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
