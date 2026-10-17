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

Each criterion is independently verifiable on the integrated tree. "Planned owner" is the existing
plan; **gap** means no registered plan delivers it today.

| Area | Required (basic, useful) | Not required | Planned owner | Today |
| --- | --- | --- | --- | --- |
| Layout editing | Select and inspect in Plan and 3D; Wall height/thickness and Opening dimensions; straight-Wall length, angle and move preserving shared Junctions; the native plinth | Arch rise, profiles, Section/Unroll, levels/structures | T1.P01 S07 → S04 → S05 → S06 | S07 shipped (PR #137); S04 authorized as batch B (2026-10-17); S05–S06 proposed |
| Layout creation | From empty or the starter: draw straight Walls into closed enclosures with derived Rooms/floors, add Openings, delete Walls; explicit connections, never coordinate adoption; canonical Layout compiler authority | Curved-Wall drawing, non-enclosing rings, levels, overhead forms | Intended owner: **T1**, a bounded straight-Wall creation phase planned after the F2 cutover (K3) ([T1.P01 §next boundary](./t1-spatial-world/t1.p01-stage-foundation/README.md#deliberately-deferred-scope-and-next-boundary)) | Unplanned; needs normal registration and authorization |
| Scene composition | Place native primitives and admitted catalogue models on floor support; move, yaw, uniform resize, duplicate, delete; exact input in both readings | Materials/light editing (existing values preserved), multi-select, attachments | T2.P01 S03 → S04 | S03 authorized as batch B (2026-10-17); S04 proposed |
| Own model import (K1) | One bounded **editor-side GLB import**: upload one flat GLB (with embedded or adjacent maps) to the project, validate and stage it, record scale/pivot/footprint explicitly, approve, then place, save and reload it like a catalogue model | Advanced ingest (assemblies, provider search, formats beyond GLB, marketplace), and any T4 release closure or publication of the resource | Intended owner: **T2**, in a bounded phase planned after T3.P01.S04 (it uses F2 resource locks and T3.P01.S05's `unit-acceptance-v1`; no T4 dependency) | Unplanned; needs normal registration and authorization |
| Camera/Experience authoring | Capture a View, bind a Presentation plus an optional Stop in one acceptance, reorder by identity, set holds/continuation | Advanced path/anchor authoring, rich transport, media, branch rejoin | T3.P01 S03 (via S05/S06) → S04, then the candidate [T3.P02](./t3-experience/t3.p02-capture-and-cut-preview/README.md) | S03 shipped; S04 and T3.P02 need `T3.camera-experience-cutover@1` drafted and ratified |
| Isolated Preview | Cut-based Preview through the shared lowering/evaluator, with reduced motion and semantic navigation; no editor machinery in the runtime | Release Preview of a real package (T4) | T3.P02 | Candidate phase |
| Durable Save/reload | Conditional Save (create-only / expected base), dirty state, conflict preservation, reload; unit Save after cutover | Overwrite-remote resolution, collaboration | T3.P01 S02 and S05 (shipped), S04; Head Save in T1.P01 S04 (authorized) | Partly shipped |
| Deterministic history | One chronological Undo/Redo across Layout/Scene/Camera-Experience; invalid/no-op produce no entry; Redo replays captured IDs | Op-log/CRDT, exit-summary undo | T1.P01 S03 (shipped), S07; T2/T3 operations | Partly shipped |
| Project lifecycle | Create (empty or starter), list and open own projects, rename, delete (or archive) with confirmation, guarded replacement | Duplicate, sharing, templates beyond the starter | Create/list/open/replace: T1.P01 S02 + T3 Save. Rename/delete (K4): **T3** owns persistence/API in a separate small slice (not in T3.P01.S04); **T1** owns the shell integration | Rename/delete unplanned; needs normal slice authorization |
| Error recovery | Explicit refusal/diagnostic states, stale/epoch rejection, conflict → download JSON → reload, resume of the sign-in Save draft, source JSON download/reopen | Automatic merge, offline queue | T1.P01 S02 (shipped), S04; T3.P01 S02 (shipped) | Partly shipped |
| Representative browser workflows | Recorded journeys on the integrated tree: empty → draw → import own GLB → place → capture → Preview → Save → reload; starter → edit → conflict → recover; rename/delete; keyboard-only, narrow and reduced motion | Every edge case | The milestone acceptance plan | — |
| Basic responsiveness | On a realistic fixture project (the plan names its size: Walls, objects, Views), observed in the browser journeys: load, edit, Undo/Redo and Save do not block interaction; no stale state appears after accept, replacement or reload; no input is lost or applied twice | Benchmark infrastructure, machine-time thresholds, the retired bench harness | The milestone acceptance plan | — |
| Isolation | Visitor/public/preview boundaries green; no editor machinery in public chunks | — | Arch lane (existing) | Green |

## Sequencing findings

| # | Finding | Kind | Bounded resolution (proposed; nothing authorized) |
| --- | --- | --- | --- |
| K1 | T2's planned ingest phase assumed "T4 resource delivery". Requiring that would deadlock against R1-D. | **Resolved by ruling** | Own-model import is required, but only the bounded **editor-side GLB import**, with no T4 release closure (criteria row above). It depends on T3.P01.S04 (F2 locks) and T3.P01.S05's `unit-acceptance-v1`, not on T4. Release closure and advanced ingest stay deferred. T2 plans it through normal phase registration and slice authorization. |
| K2 | T3.P01.S04 activation needs an owner-accepted publication gap that now runs until T4's prepared-reader cutover. | **Principle accepted; gap not approved** | Temporary publication unavailability is acceptable in principle. The actual gap is approved only at T3.P01.S04, after the live inventory and compatibility review (AM-7). There is no blanket approval now. |
| K3 | Layout creation needs a T1 Wall-authoring phase, ordered against the F2 cutover. | **Ruled** | Plan bounded straight-Wall creation after the F2 cutover, as a Layout unit version under F2. Rooms stay derived, connections explicit and Layout the canonical authority. It is not authorized here. |
| K4 | Project rename/delete had no owner. | **Ruled** | T3 owns persistence/API in a separate small slice, not inside T3.P01.S04. T1 owns the shell integration. It is not authorized here. |
| K5 | Is Camera/Experience authoring or Preview blocked by T4? | No | T3.P02 needs T3.P01.S04 and the viewport (via T1.P01.S07), not T4. Editor Preview uses T3's shared lowering. |
| K6 | T1.P01 S04/S05 and T2.P01 S03/S04 are written against current-source F4. T3.P01.S04 retires those adapters. | Ordering constraint | Already planned: T3.P01.S04 migrates every T1/T2 caller and unfinished requirement together. Slices still unaccepted at that time re-declare unit scopes. |

## Not prerequisites

Publication UI, releases, prepared delivery, Release/Source Baselines, advanced ingest beyond the one
bounded GLB import, materials/lights
authoring beyond preservation, levels/structures, Section/Unroll/peel, curved-Wall drawing, advanced
Camera paths, multi-selection, collaboration and benchmark infrastructure. Any of these can be added
to the milestone only by an explicit owner amendment of this page.
