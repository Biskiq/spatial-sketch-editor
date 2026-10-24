# T3.P02 — First Capture and Cut Preview

**Phase:** T3.P02 · **Status:** registered 2026-10-20. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits. S02 is approved/released · **Track:** [T3](../README.md) · **Roadmap:**
[gate register](../../README.md#gate-register) · **Runbook:**
[T3 operations](../../../operations/t3-experience/README.md) · **Contracts:**
[AM-9](../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover),
[Camera contract](../../../reference/components/camera-tour.md), [PLATE Experience
expression](../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)

This phase is registered by the owner decision of 2026-10-20, after `T3.P01` closed with
`T3.camera-experience-cutover@1` `accepted` at `06a8aac8` and merged as `9a457f6b` (PR #158). The
2026-10-16 [proposal](#registration-basis) is its starting scope, reconciled against the accepted F2
cutover: the source it writes is the F2 envelope, the acceptance path is F4's unit acceptance, and
Save is the unit conditional Save. Nothing on this page is pre-cutover current-source work.

**The phase's first authoring milestone is here.** T3.P01 built the source, runtime and ownership
foundation without an authoring surface; this phase turns the accepted Camera/Experience split into a
creator-visible capture and preview loop. It does not wait for advanced path or anchor authoring, rich
transport/scrub UI, media, interaction grammar or T4 publication.

## Registration basis

The phase exists because both of its slices need something that did not exist on 2026-10-16: an
**accepted** `T3.camera-experience-cutover@1`. The old proposal recorded exactly that, and kept the
scope out of `T3.P01` so that phase could register truthfully. Both preconditions are now met:

- `T3.camera-experience-cutover@1` — `accepted`, provider `T3.P01.S04`, contract AM-9, in the
  [gate register](../../README.md#gate-register);
- `T1.viewport-projection@1` — `accepted`, provider `T1.P01.S02`, recorded through `T1.P01.S07`.

The proposal's candidate scope is preserved; what changed is the substrate. Capture writes Views and
Presentations into F2 units, Preview executes the one shared Experience interpreter built in
`T3.P01.S06`/`S04`, and Save uses `conditional-save-units-v1`. No slice here consumes a retired
current-source adapter, and none may re-introduce one.

## Convergence review and release

PR #173 records owner-accepted S01 destination clarifications: qualified subject references, explicitly
versioned text/entry formats, a Guide-free Presentation Preview, lazy isolated delivery and
performance evidence before consuming-slice acceptance. It preserves the complete approved
capture/Guide/history/Save scope and S02's exhaustive final gate. The S01 plan carries the
finalized scope, its [Experience format draft](./t3.p02.s01-first-capture-and-cut-preview/experience-format-draft.md)
and its [shell draft](./t3.p02.s01-first-capture-and-cut-preview/shell-draft.md); the owner accepted
them and released S01 from the production hold on 2026-10-22 (batch E, [record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E5/E7).
S01 starts only after H0's shared correction, `T3.P03.S01`, is merged on `main`; the
[batch E protocol](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-e-2026-10-22) recorded the
sequencing for that historical batch. The [post-Batch-E release](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md)
authorizes S02 per the release list (`docs/roadmap/now.md`); the
[next parallel batch](../../cross-track-execution.md#next-parallel-batch) owns current sequencing.

## Bounded outcome

A creator working on the shared Stage can **create or select an Experience**, **capture a Camera View**
from where they are looking, **bind a Presentation** (Default plus an optional Guide Stop) in one
accepted operation, **reuse the same Presentation at distinct Stops**, **reorder Stops by stable
identity**, edit bounded **labels, text, holds and continuation**, work through a first coherent **Cut
Guide**, and **enter an isolated visitor Preview** and return to the authoring context — with
Undo/Redo, Save and reload through F2/F4.

A first useful surface proves the editorial model end to end on a small Experience. It is not a
timeline editor, a motion-design tool or a publication flow.

## Ownership invariants

| Concern | Sole authority after this phase |
| --- | --- |
| View eye/target/FOV, framing, connectivity, route geometry, intrinsic motion/easing, spatial route finding and evaluation | Camera codec/unit and `camera-core`; the renderer camera only realizes evaluated output |
| Presentation meaning and subject use, Default/entry roles, Stops, Guide order, holds, continuation and invocation-time mapping | Experience unit; an editorial transition names supported Camera motion and owns no spatial edge |
| Selection, Stage mounting, task/gesture focus and authoring return | The shared T1 editor host; T3 contributes public adapters and owns no selection or history store |
| Accepted revision, typed intents, atomic install and undo | Shared F.4 coordination; UI and any agent submit through the same admission path |

Required laws (unchanged from `T3.P01`; they bind this phase's new surface):

1. **One Camera motion/evaluation authority.** Capture, Look-through, Follow, Cut and Preview all
   realize Camera intents through the Camera output owner. No second controller, pose lerp or FOV
   interpolation, and no parallel navigation graph.
2. **Experience owns editorial order.** Guide order is one ordered list of stable Stop IDs. Reorder,
   insert and repeat never key on an array index, label, Room, pose or Camera-node ID.
3. **Camera owns View identity and connectivity.** A Stop or Presentation never stores a copied Camera
   graph, pose or FOV, and Cut never manufactures a Connection.
4. **Shared Camera output/return tickets.** Inspection, Look-through, Follow and Preview hand control
   over explicitly; a stale completion or cancel cannot reclaim or clear a newer owner.
5. **Visitor/editor isolation.** Preview is an isolated session over the same lowering and interpreter
   the visitor uses; it hides authoring infrastructure, writes no source, and returns through the
   Camera return token preserving authoring identity, selection and history.
6. **Room-local transform semantics.** Capture records the View in the frame the Camera authority
   evaluates in; a supplied room-local frame converts once at the boundary and its inverse round-trips.
   Nothing invents a frame from containment or a centroid.
7. **Deterministic selection and history.** One canonical selection across Plan and 3D; capture and
   binding are one accepted F4 result with one undo payload; invalid, stale, cancelled and no-op
   requests add nothing.
8. **Svelte 5 runes, Threlte and the existing Stage adapter patterns.** New surfaces are contributed
   through AM-5's task/Find/instrument points and the accepted viewport facade — no cast, no private
   Stage import and no second canvas.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T3.P02.S01 | shipped | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | camera-authoring-migration | [First capture and Cut Preview](./t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md) | [record](./t3.p02.s01-first-capture-and-cut-preview/acceptance.md) | owner-authorized 2026-10-20 as batch D ([record](../../../reference/decisions/batch-d-authorization-2026-10-20.md), D3); historical Batch E permission 2026-10-22 ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E5/E7); start condition T3.P03.S01 merge satisfied by PR #176; accepted/shipped 2026-10-23 as `owner-override` at integrated revision `1bb281bb16dc839588e4174514b240de6c52bf79` |
| T3.P02.S02 | approved | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Integrated final gate](./t3.p02.s02-integrated-final-gate/implementation-plan.md) | [record](./t3.p02.s02-integrated-final-gate/acceptance.md) | owner-authorized and released 2026-10-23 ([record](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md)); starts per the release list (`docs/roadmap/now.md`); predecessor accepted; own gates/review/evidence remain required |

Every consumed gate is `accepted` and every required scope is `active` on `main` `9a457f6b`; each
slice re-verifies them at its own trusted base through the runbook start step. `F2.unit-envelope@1`
is provided by `T3.P01.S01`, `F3.channels@1:camera-handoff-v1` by `T3.P01.S06`, and the F4 unit scopes
by `T3.P01.S05`; the cutover gate's provider is `T3.P01.S04`. No slice here provides a new gate, and
S01's acceptance records the creator loop as a slice outcome, not as a capability entry.

```text
FINAL PHASE GATE: T3.P02.S02 → ./t3.p02.s02-integrated-final-gate/acceptance.md

PHASE CLOSE
Stage:        active
```

## Acceptance evidence to carry

`T3.P01`'s [verification probes](../t3.p01-camera-experience-foundation/README.md#verification-and-acceptance-criteria)
stay green and are not re-owned here. This phase adds:

| Probe | Observable evidence required |
| --- | --- |
| Real authoring | Selection alone never navigates. Capture / Update / Exit, Ask-Rule reach, shared Default versus Stop-local entry/hold, one Guide context, supported existing Travel with a gap that is reported rather than cut, paused edit lifecycle, and one-step source Undo all work from T1's host. Preview removes authoring chrome; exit preserves authoring identity and returns through Camera. Dense 20/50-View and 15/30-Stop fixtures test discovery and orientation, not product limits. |
| Editorial model | One Presentation reused at two distinct Stops with distinct holds and entry roles; reorder keeps Stop identity; a repeated visit to one Stop starts a fresh run; the Guide order is the only order writer. |
| Source and Save | F2-only boot; capture+bind installs one accepted result with one undo payload; conditional unit Save and *Reload remote* keep work across a conflict; a stale writer refuses; reload preserves Views, Presentations, Stops and order. |
| Isolation and reach | Preview and visitor run the same interpreter with independent sessions; no editor machinery, selection or history reaches a visitor or public chunk; DOM navigation reaches every admitted destination with an explanation for gaps. |
| Motion and accessibility | Cut resolves the View with no topology change and no implicit travel; reduced motion reaches the same destinations without accelerated travel; keyboard/pointer/touch carry the same Activate meaning; the Info Panel's labels and text are reachable without raycast. |

## Dependencies, exclusions and continuation

- **T1:** the accepted viewport facade, Stage host, selection/task/gesture ownership and F.4 history.
  No T1 slice is a prerequisite, and this phase adds no host seam — a needed one is a stop-and-report
  to T1.
- **T2:** existing Scene subject labels and identity suffice for first capture. Placement, ingest and
  resource depth are not prerequisites.
- **T4:** not consumed. Preview uses the shared lowering in an isolated in-memory session and needs no
  prepared reader.
- **Excluded from this phase:** rich interactive control authoring (Gates/choice grammar beyond the
  first Cut Guide), advanced path/anchor tools, a second Camera controller, a second Experience
  timeline, general animation orchestration, media authoring, and publication. A later T3 phase owns
  advanced Camera/path tools; they are never hidden inside this first surface.
- **Prototype boundary.** The [retained P1 prototype evidence](../../../../prototypes/README.md)
  owns the exploration of the richer interaction grammar. This phase neither commissions, schedules
  nor waits on that program, and it never promotes a prototype mechanism into a production contract.

## Verification and coordination

Verification commands and tiers are owned by
[the test manual](../../../../apps/editor/tests/README.md#what-a-change-requires). S01 was authorized
under the [batch D protocol](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-d-2026-10-20) and shipped
under the [batch E rules](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#batch-e-shared-files-and-merge-order) (historical).
S02 runs under the [current shared-file and merge protocol](../../cross-track-execution.md#shared-files-and-merge-protocol):
one writer per shared file, additive registration elsewhere, the complete merge gate rerun on
then-current `main`, independent review per slice, and each slice's own closeout and P1 merge commit. No architecture-cycle window is proposed: the T1.P01 window is closed, T3 slices are not
exposures of it, and this phase claims no mechanism verdict.
