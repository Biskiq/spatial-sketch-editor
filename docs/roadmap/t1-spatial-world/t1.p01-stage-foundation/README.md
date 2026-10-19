# T1.P01 — Stage and authoring foundation

**Phase:** T1.P01 · **Status:** registered 2026-10-15 — `T1.P01.S01` accepted and shipped
(F1/F3 shared providers and readiness enforcement); `T1.P01.S03` accepted and shipped 2026-10-16
(F4 `acceptance-invariants-v1` and `local-single-domain-v1`); `T1.P01.S02` accepted and shipped
2026-10-17 by owner-override (PR #128); `T1.P01.S07` accepted and shipped 2026-10-17 (PR #137,
recording `T1.viewport-projection@1:viewport-projection-v1` accepted); `T1.P01.S04` authorized
2026-10-17 as batch B ([record](../../../reference/decisions/batch-b-authorization-2026-10-17.md)) and
accepted and shipped 2026-10-18 (PR #148); S05–S06 proposed and unauthorized ·
**Track:** [T1](../README.md) · **Roadmap:**
[track + gate register](../../README.md) · **Runbook:**
[T1 operations](../../../operations/t1-spatial-world/README.md) · **Baton:**
[`../../../operations/t1-spatial-world/current.md`](../../../operations/t1-spatial-world/current.md)

**Basis:** the F amendments and the capability-readiness rule this phase implements are
owner-ratified 2026-10-15 ([decision record](../../../reference/decisions/f-ratification-2026-10-15.md)).
The [coordinated allocation/readiness/DAG](../../cross-track-execution.md) and the
[exact interface drafts](./interfaces.md) govern this phase's recommendations; the allocation is
coordination, never a registration. The phase's implementation permissions are exactly S01
(2026-10-15), S02/S03 (2026-10-16,
[record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) and S07
(2026-10-17, [record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)) and S04
(2026-10-17, batch B, [record](../../../reference/decisions/batch-b-authorization-2026-10-17.md)); no other slice,
phase or track is authorized by this README. `F1.reference@1` and `F3.channels@1` are `accepted` for
S01's landed outputs on `main` (post-PR #126), which admits S02/S03 at their trusted base
(§Slice register).

**Objective:** provide F1/F3, a small shared Stage/viewport host and the common local F4
provider, then restore bounded Layout precision. First capability work is S01 on the landed r186
base (`74efb98b`).

## Outcome and deliberate boundary

A creator can open a valid source project, choose explicit **Start gallery**, or begin genuinely
empty. Starter gallery is a canonical current-format source template: one rectangular enclosure,
real reconciled Room/floor polygon and floor datum, no Scene objects or Camera/Experience content.
Use captured project/source IDs, strict canonical validation and the single Layout compiler to
prove real support; this is a new project/history baseline, never silent architecture insertion
into the current project. The creator confirms project replacement through the same host guard.
T3 S04 replaces this boot adapter with its F2-backed equivalent, preserving the public host seam.

The template supplies an intentionally bounded entry without general Wall drawing, role selection,
topology editing or a new floor schema. Empty boot remains honest and Scene placement there refuses
until real support exists. A plinth and a datum are never promoted to Scene support. The starter
uses retained canonical architecture, not a second topology generator. Its validation/compile
fixture proves closure, floor membership and nonzero-datum support; actual Wall drawing and the
derived-role/schema cutover remain the next T1 boundary.

On the same continuous Plan/3D Stage, creators inspect/select, place a native Layout plinth, edit
supported Wall/Opening dimensions and straight-Wall pose, cancel/refuse, Undo/Redo and download
canonical source JSON. T2/T3 mount their adapters after the viewport gate, without waiting for
later Layout tools or shell depth. Stage selection, tasks, gestures and Camera output stay shared.

Source Save is a T3-owned early extension, **S02 conditional Save**, independent of F2 activation.
Until `F4.intent-acceptance@1:conditional-save-current-v1` is accepted on main, Save explains its
unavailability. Once accepted, local edits have explicit dirty state; create-only or expected-
saved-base Save validates/compares atomically, preserves conflicts and never introduces another
history. Source download/reopen remains available independently; it is not a portable asset package.
After T3 S04, Save/source consumers re-declare unit capabilities accepted in T3 S05 (the S03
split's first half). No resource
upload, general importer, publication or complete creator-to-visitor journey is claimed here.

**Foundation prerequisite:** planning proceeds on the landed r186 base: the separate
[r186 upgrade PR #122](https://github.com/Biskiq/spatial-sketch-editor/pull/122) merged into `main`
as `74efb98b` (closeout PR #123, `d69825fe`), standardizing three 0.186.1 / `@types/three` 0.186.0
with Threlte unchanged and explicit `PCFShadowMap` at both shadow canvases. Each implementation plan records
that base and affected renderer/Camera compatibility evidence.

## Basis and retained-code findings

The [T1 planning evidence](../planning-evidence.md) supplies obligations, not a mandated P26
sequence. [Architecture](../../../reference/architecture.md#semantic-authorities-ratified-destination),
[F](../../../reference/composition-execution.md), [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md)
and the [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md)
govern the new design. [Conservatory](../../../../prototypes/experience-ux-alternative/README.md)
supplies shared-shell evidence; [World A–F](../../../../prototypes/spatial-authoring/README.md)
supplies continuity/interaction evidence; [Paper](../../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
supplies authoring depth. None supplies a production renderer, schema, camera evaluator or
history implementation. In particular, the prototype's sub-degree perspective Plan and
whole-world refitting buttons are not selected mechanisms.

| Evidence inspected | Planning consequence |
| --- | --- |
| `packages/layout-core/src/layout-geometry.ts`, `layout-geometry-types.ts`, `layout-wall-first-precision.ts`, `layout-wall-openings.ts` | Reuse `compileWallFirstLayoutGeometry`, compiled query/solid records and operation-specific planners; do not recreate topology in a view or impose one universal planner result type. Current scalar and straight-Wall precision already have a bounded implementation basis. |
| `apps/editor/src/lib/layout/wall-mesh-builder.ts`, `apps/editor/src/lib/render/wall-geometry-adapter.ts`, `apps/editor/src/lib/visitor/VisitorLayoutShell.svelte` | The Stage must use the same Junction-aware mesh builders and adapter semantics as the visitor. Share runtime-safe rendering where useful; editor-only hit/highlight layers remain outside visitor imports. |
| `packages/camera-core/src/camera-motion.ts`, `camera-route.ts`, `index.ts` | Current evaluation covers perspective guided motion; it does not export the proposed editor projection API. Add session viewing/projection evaluation inside this authority, rather than claiming the removed viewport already exists. |
| [Retained authoring inventory](../../../../apps/editor/src/lib/authoring/README.md), `authoring/layout/plan-hit.ts`, `layout-exact-input.ts`, `authoring/a11y/roving-focus.ts` | Reuse pure hit/precision/focus semantics selectively. The Plan hit resolver takes world points and tolerance; it cannot become another affine viewport. Blank numeric parsing and fixed traversal need new composed-surface proof. |
| `packages/project-model/src/project-codec.ts`, `apps/editor/src/lib/platform/project-persistence.ts`, the spatial route | Current boot/validation/serialization and API reads exist; the route is a notice and Save lacks expected revision. Rebuild the host, with explicit replacement guards; do not restore the old shell wholesale. |
| `packages/layout-core/src/layout-room-frame.ts`, current Scene/Room types | The retained frame helper consumes legacy Room frames; current wall-first Rooms carry no frame and Scene roots are world-local. Preserve explicit room-local conversion semantics when a real frame is supplied, without inventing Room ownership or reintroducing legacy decoding. |

**Reference reconciliation finding, not an amendment:**
[persistence](../../../reference/components/persistence.md#one-document-format-post-115) says
Junction reuse is global at commit. `layout-wall-chain.ts` and
`apps/editor/tests/lib/layout/layout-junction-identity.test.ts` instead document and exercise
declared-connection reuse, with independent coincident placement; the precision gates are
component-scoped. Under the router's falsifiability triage this appears to be a later retained
policy plus stale descriptive text, but its provenance/contract reconciliation is owed before
new connectivity authoring. The North Star's [sacred contracts](../../../reference/north-star.md#sacred-contracts)
explicitly preserve the accepted independent-placement policy, supporting the stale-reference
diagnosis. Preserve that explicit-connectivity invariant; do not restore global coordinate
adoption from the older persistence wording.
This phase preserves existing Junction IDs and has no Wall birth, join, split or noding
command, so it does not require a new connection policy. M4 is not claimed re-armed.

## Ownership and composition

| Concern | Writable owner and permitted integration |
| --- | --- |
| Architecture/representation | Layout in `@portfolio/layout-core`: canonical compilation, representation fragments/membership, source correspondence, supported semantic planners. Renderer adapters consume its results. |
| Viewing and navigation | `@portfolio/camera-core`: one output controller per viewport, viewing intent, framing, projection, transitions and evaluation. The Stage realizes output; shell/input controllers submit intent. |
| Shell/Stage/session | T1 editor host: Svelte 5 runes, shared PLATE tokens/type/control roles, Head/Index/Card/instrument composition, one selection, focus, task/gesture ownership and lifecycle. Threlte owns realization/lifetime, not domain math. |
| Accepted project/history | T1 S03 supplies shared local Layout/Scene coordination under the ratified F4 timing amendment; T3 S02 supplies early conditional Save and S03 unit/compound extensions. One source-independent interface/history, with exact capability readiness. |
| Scene graphics/placement | T2: canonical Scene identity, bounds, support-resolved placement, transforms/materials/lights and validation. T1 provides projection and input hosting, not a Scene mutation adapter. |
| Camera/Experience authoring | T3: Views, paths and editorial authoring adapters, Experience UI and Preview. T1's session Camera inspection changes no authored node, edge, order, hold, FOV key or unit. |

Prefer existing packages for shared runtime-safe interfaces: project-model for identity and
coordination contracts, Layout for representation parameters/evaluation, Camera for projection.
Do not add a package without real import/lifetime evidence. Editor mounting contracts remain
editor-only; they must not pull selection/history/runes/DOM into these shared packages.

**State laws:** accepted documents and compiled geometry are immutable snapshots held via
`$state.raw` or equivalent shallow ownership, never recursively proxied. One canonical
selection value is shared by both lenses; task focus, host and reference emphasis are separate.
Selection does not navigate. Source history is one chronological stack; reading, Camera
navigation, Scale/Grid/Snap, focus and disclosure never enter it. A gesture captures one
expected revision and one writer; invalid/cancel/no-op produces no entry. A reading flip keeps
selection, accepted edits, task and tool; a lens crossing cancels unaccepted writers and parks
tasks inactive. Explicit Resume revalidates without restoring old selection or viewpoint.

World-local roots remain the current document contract. An explicit room-local input frame
uses its origin/yaw and floor datum for forward/inverse conversion once at the domain boundary;
vectors exclude translation, angles remain radians internally, and round trips preserve values.
No polygon centroid, nearest Room, or containment is allowed to invent that frame. Missing
room-local context refuses the operation. This phase's precision uses project-world and
Wall-host frames; no Scene `roomId`, authored Room frame or transform migration is added.

## Slice register

One row per slice; the slice's own plan owns its scope, tier and criteria, and its acceptance
record owns recorded outcomes. `Consumes` lists exact `Gate@Version` prerequisites and `Requires`
the exact `Gate@Version:capability-vN` scopes of those gates the slice actually needs — a consumed
gate version is not by itself sufficient readiness; `Effects` names only documented effects. S01 was
**authorized** by the owner decision of 2026-10-15 and is now **accepted and shipped**: independent
review accepted its implementation at `ee463d0b`, so its provider outputs are recorded as the accepted
capabilities `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` and both gate rows are
`accepted`. **S02 and S03 were authorized** by the owner decision of 2026-10-16. S03 is accepted and
shipped with its two F4 capability records; S02 is accepted and shipped under the owner-override
documented in its row. Their prerequisites were accepted on the trusted base, where `ee463d0b` is
an ancestor. **S07 was authorized** by the owner decision of 2026-10-17 ([record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)) and is **accepted and shipped**: its acceptance records
`T1.viewport-projection@1:viewport-projection-v1` with `T1.P01.S02` unchanged as the sole provider.
**S04 is authorized** with T2.P01.S03 as batch B by the owner decision of 2026-10-17
([record](../../../reference/decisions/batch-b-authorization-2026-10-17.md)), with the Head Save integration in scope (ruling D3).
S05–S06 are **proposed** and hold no implementation permission. Same-phase sequencing
never bypasses the trusted-base rule: each consumed gate and each required capability must be
accepted at the consumer's trusted base.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1.P01.S01 | shipped | — | — | — | [Shared interface providers](./t1.p01.s01-shared-interface-providers/implementation-plan.md) | [record](./t1.p01.s01-shared-interface-providers/acceptance.md) | owner-authorized 2026-10-15 ([record](../../../reference/decisions/f-ratification-2026-10-15.md)); independently accepted at `ee463d0b`; closed 2026-10-16 by `slice-closeout` |
| T1.P01.S02 | shipped | F1.reference@1, F3.channels@1 | F1.reference@1:references-v1, F3.channels@1:inspection-v1 | — | [Shell, Stage and viewport provider](./t1.p01.s02-shell-stage-and-viewport-provider/implementation-plan.md) | [record](./t1.p01.s02-shell-stage-and-viewport-provider/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)); accepted and shipped 2026-10-17 by owner-override at PR #128 revision `567a17e7`; waived the current-main merge-gate rerun and S06 integration proof as prerequisites to S02 acceptance; `T1.viewport-projection@1` remains ratified, and its acceptance route is S07 (ruling D1, 2026-10-17) |
| T1.P01.S03 | shipped | F1.reference@1 | F1.reference@1:references-v1 | — | [Local acceptance and history foundation](./t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md) | [record](./t1.p01.s03-local-acceptance-and-history-foundation/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)); accepted 2026-10-16 from independent review evidence; F4 outputs `acceptance-invariants-v1` and `local-single-domain-v1` accepted |
| T1.P01.S07 | shipped | F1.reference@1, F3.channels@1, F4.intent-acceptance@1 | F1.reference@1:references-v1, F3.channels@1:inspection-v1, F4.intent-acceptance@1:local-single-domain-v1 | — | [Stage↔F4 integration bridge (closed stub)](./t1.p01.s07-stage-f4-integration-bridge/implementation-plan.md) | [record (closed stub)](./t1.p01.s07-stage-f4-integration-bridge/acceptance.md) | owner-authorized 2026-10-17 ([record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)); accepted 2026-10-17 after four review rounds and the complete gate at its merge candidates (API suites 65 tests, zero skips); records `viewport-projection-v1` accepted with `T1.P01.S02` as unchanged sole provider; shipped via PR #137, which must land as a merge commit so the recorded P1 anchors stay reachable |
| T1.P01.S04 | shipped | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Existing Layout precision (closed stub)](./t1.p01.s04-existing-layout-precision/implementation-plan.md) | [record (closed stub)](./t1.p01.s04-existing-layout-precision/acceptance.md) | owner-authorized 2026-10-17 as batch B with `T2.P01.S03` ([record](../../../reference/decisions/batch-b-authorization-2026-10-17.md)); Head Save integration in scope (ruling D3), so `conditional-save-current-v1` joined `Requires` at authorization; composition-root gaps closed under the [host-integration exception](../../../reference/decisions/t1-s04-host-integration-2026-10-17.md); accepted 2026-10-18 at `2d37adef`; closed 2026-10-18 by `slice-closeout` |
| T1.P01.S05 | proposed | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Existing straight-Wall manipulation](./t1.p01.s05-existing-straight-wall-manipulation/implementation-plan.md) | [record](./t1.p01.s05-existing-straight-wall-manipulation/acceptance.md) | — |
| T1.P01.S06 | proposed | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t1.p01.s06-integrated-final-gate/implementation-plan.md) | [record](./t1.p01.s06-integrated-final-gate/acceptance.md) | — |

Every slice also declares the specific capabilities it requires (`Requires`) in its own plan, and the
row above restates it for the [checker](../../../roadmap/README.md#gate-register) — a consumed gate
version is not by itself sufficient readiness, and the readiness rule this phase installs at S01 is
exactly that distinction. The requirements above describe the pre-cutover source adapter. T3 S04
migrates existing callers and unfinished plans to accepted
F2/unit-resolution/unit-acceptance capabilities from T3 S01/S05; Save users additionally
require conditional-save-units-v1. That migration does not wait for the whole T1 phase. No
current-source acceptance record proves unit capability readiness.

The [global gate register](../../README.md#gate-register) records accepted F1/F3 providers from S01,
the accepted F4 provider from S03 and the accepted `T1.viewport-projection@1` provider from S02. S03's
two AM-4 outputs have separate durable capability records, and S07's acceptance records
`viewport-projection-v1` in [its capability record](./t1.p01.s07-stage-f4-integration-bridge/capability-viewport-projection-v1.md).
`F5.release-envelope@1`
(T4.P01.S02) stays unassigned until its own phase registers.

**Viewport readiness route (owner ruling D1, 2026-10-17, [record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)).** **S07** is the
route that accepts the viewport capability. The earlier S06-coupled route was circular, and it is
recorded only in the decision record. It does the host↔F4
wiring, adapter re-binding and the AM-5 adapter contribution points, and it reruns the seam conformance
and the complete merge gate on then-current `main`. Its acceptance records `viewport-projection-v1`,
with `T1.P01.S02` as the unchanged sole provider. S06 stays the exhaustive final gate and is no longer
the viewport readiness route. S02's acceptance record is unchanged. S07's acceptance now records the
capability as `accepted`. S04 is accepted and shipped as batch B (2026-10-18); S05–S06 remain proposed and
hold no implementation permission until the owner authorizes them.

**Parallel integration.** S02 and S03 run in parallel with `T2.P01.S01` and `T3.P01.S01` under the
[batch protocol](../../cross-track-execution.md#parallel-batch-2026-10-16): one writer per shared
module, append-only barrels and lane lists, and the full merge gate rerun on the then-current `main`.
Neither consumed the other. The host↔F4 wiring (accepted install into the Stage, Undo/Redo commands,
replacement baseline, selection requalification, Camera-output rebase) is **S07's** by ruling D2
(2026-10-17), and the Head Save integration is **S04's** by ruling D3. The [batch A protocol](../../cross-track-execution.md#authorized-batch-2026-10-17) governed S07
alongside `T3.P01.S03` (both shipped). The [batch B protocol](../../cross-track-execution.md#authorized-batch-b-2026-10-17)
governed S04 alongside `T2.P01.S03` (both shipped). Batch C proposes S05 alongside `T2.P01.S04`, and
moves S06 after `T3.P01.S04` with re-declared unit scopes
([prepared record](../../../reference/decisions/batch-c-authorization-2026-10-19.md), awaiting owner
approval; [protocol](../../cross-track-execution.md#proposed-batch-c-2026-10-19)). Until the owner
approves it, S05–S06 hold no implementation permission and their rows are unchanged.

```text
FINAL PHASE GATE: T1.P01.S06 → ./t1.p01.s06-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

`T1.P01.S01`, `T1.P01.S02`, `T1.P01.S03`, `T1.P01.S04` and `T1.P01.S07` are accepted and shipped.
S02's acceptance uses the owner-override recorded in its acceptance stub; the viewport capability is
accepted through S07's record, and consumer readiness starts at a trusted base containing PR #137's
merge. S05–S06 have no accepted result. The
final gate is declared, not closeable: the phase's final child S06 is neither accepted nor shipped, so no `PHASE CLOSE` beyond this active
stage marker is written, and closure stays an explicit owner request.

## Bounded architecture-cycle window

Configured window ([bounded-window rules](../../../operations/architecture-cycle.md#bounded-window-rules)):

| Exposure slice | Real exposure already justified by capability work | Expected evidence |
| --- | --- | --- |
| T1.P01.S02 | Project/session replacement and navigation output lifetime (M5); real shell/Stage boundary | Replacement race/cancellation and consumer closure proof |
| T1.P01.S04 | Real Layout mutation call sites and Wall/Floor vertical authoring (M1/M2) | Bypass-sensitive call-site proof, valid/refused scalar edits and coherent source/history |
| T1.P01.S05 | Direct gesture-to-planner/acceptance path, existing Junction/curve identity preservation (M1/M3), replacement cancellation (M5) | Real pointer/numeric equivalence and cancellation evidence; terminal acceptance |

**Bound:** three real exposures. **Expected opener:** T1.P01.S02. **Terminal:** T1.P01.S05.
M3's installed curve proof remains green. M4's birth/join/noding editor half is not exposed;
its later owner verdict must say not-exposed if this boundary stands. M6/M7 are observed
through ordinary start/closeout routing, not an additional audit slice.

This configuration is live ([state](../../../operations/architecture-cycle.md)):
`PHASE_2_VALIDATING`, readiness `open`, this phase's window **open**, with these three IDs.
S02's first authorized implementation opened it on 2026-10-16 through the runbook's start step, and
`Opened by` names S02. The S02 and S04 exposure rows are recorded; `Closed by` and the mechanism
verdicts stay empty until real work earns them. S01 is not a listed exposure, so registering the
phase and authorizing S01 did **not** open the window; a planning change is never `open-window`.

Any listed slice starting authorized implementation opens the window, even if it is not S02.
Close only when S05 is accepted and S02/S04 are accepted or explicitly discharged in their
exposure rows; the terminal cannot be discharged. Then the owner owes per-mechanism verdicts.
S06/phase close and unrelated T2/T3/T4 work do not trigger those transitions or wait for a
cycle verdict. S07 is not a listed exposure. The window already holds its maximum of three, so S07's
start opens nothing and adds no exposure row. Do not grow the exposure list to fit later scope without an owner amendment.

## Dependencies and owner decisions

Exact [interfaces](./interfaces.md) and the [coordinated allocation/readiness amendment](../../cross-track-execution.md)
are ratified; the recommended sole providers are F1/F3 T1 S01; F4 T1 S03; F2 T3 S01;
F5 T4 S02. T3 S02 is an extension for conditional Save, not another F4 provider.
T3 S05/S06 (the S03 split) supplied the unit/Save/handoff capability records T3 S04 activation consumes. Any
breaking shared semantics requires a new major rather than a falsely compatible capability.

Approved: the canonical starter entry and bounded Layout scope; deferred general drawing
preserved. The S02 slice is accepted independently of the phase final gate; `T1.viewport-projection@1`
is accepted through S07's record (ruling D1), with S02 as the unchanged sole provider. T2/T3 UI
becomes eligible only at a trusted base that contains PR #137's merge. Local F4 and T3 unit work can run
alongside viewport work after F1. Conditional Save waits only for local F4 plus T3's accepted
current-source Save conformance.

The S02/S04/S05 exposure window above is configured and open: S02 opened it on 2026-10-16, and its
shipped exposure is recorded in the live cycle table. S04's shipped exposure is recorded at its
closeout (re-arming M1/M2); S05's exposure row and the mechanism verdicts remain owed. Capability
implementation uses the landed r186 base (`74efb98b`, three 0.186.1). This
registration changed no ratified contract, no gate state, no other phase registration and no
Baseline.

## Deliberately deferred scope and next boundary

Owner ruling K3 (2026-10-17, [Core Editor Stability](../../core-editor-stability.md)): bounded
straight-Wall creation is planned after the F2 cutover, with derived Rooms, explicit connections and
canonical Layout authority. The next T1 phase should derive a bounded **Wall authoring/schema cutover**: creator-neutral
Draw, derived Wall roles, legacy partition disposition, intentional non-enclosing rings,
connectivity-policy reconciliation, current-format change/fresh-authority decision, Room
lineage and retirement of the legacy Layout types/codec/frame/compiler adapter. None is
smuggled into this phase through a role selector or a renderer heuristic.

Levels/structures and architectural definitions/instances have addressing capacity in F.1,
but no new authored schema or multi-level UI here. Single-Wall closed circles/periodic
Openings, top profiles, head-fixed independent arch rise, slabs/CeilingRegions, gaps/fit,
Section/crop/peel/Unroll/Lift/Look-up, nested exact-return recipes and exit-summary undo are
later T1 capability plans. Ordinary Plan depth/membership/source identity is not deferred.

Scene placement/gizmos/materials/lights/resources/ingest remain T2. Authored Camera View/path
adapters, Camera extraction and Experience order, unit/compound acceptance, early conditional
Save and Preview remain T3. Any later T1 Camera-authoring migration consumes the accepted
`T3.camera-experience-cutover` version first and declares its Camera-authoring effect; none of
these slices has that effect. Release envelopes/prepared readers/publication UI remain T4.
No baseline, publication integration or track completion is proposed by this phase.
