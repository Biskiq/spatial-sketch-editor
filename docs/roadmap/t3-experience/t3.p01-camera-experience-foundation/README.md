# T3.P01 — Camera/Experience cutover foundation

**Phase:** T3.P01 · **Status:** registered 2026-10-16 — `T3.P01.S01` shipped 2026-10-16 (PR #131);
`T3.P01.S02` shipped 2026-10-16 (PR #133), accepted with `conditional-save-current-v1`;
`T3.P01.S03` shipped 2026-10-17 (PRs #140/#141) through its [registered split](./t3.p01.s03-compound-and-runtime-preparation/split-proposal.md),
with its original obligations reconciled; `T3.P01.S05` shipped with both unit capabilities accepted
and `T3.P01.S06` with `camera-handoff-v1` accepted; S04 authorized 2026-10-19 ([record](../../../reference/decisions/t3-cutover-ratification-2026-10-19.md)) · **Track:** [T3](../README.md) · **Roadmap:**
[gate register](../../README.md#gate-register) · **Runbook:**
[T3 operations](../../../operations/t3-experience/README.md) · **Contracts:**
[AM-2, AM-4, AM-6, AM-7](../../../reference/composition-execution.md#ratified-amendments),
[F amendment drafts](./f-amendment-proposals.md)

Registered by the owner decision of 2026-10-16
([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) so that its first
slice, `T3.P01.S01`, can run in parallel with `T1.P01.S02`, `T1.P01.S03` and `T2.P01.S01`. That is
the phase's first implementation permission. S02 was authorized by the later owner decision of
2026-10-16 ([record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)), in parallel
with `T2.P01.S02`. S03 was authorized on 2026-10-17
([record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)), in parallel with
`T1.P01.S07`; S04 was later authorized on 2026-10-19 ([record](../../../reference/decisions/t3-cutover-ratification-2026-10-19.md)). On the same day the owner authorized S03's two
follow-ups, `T3.P01.S05` and `T3.P01.S06`, after PR #138's preparatory increment and its approved
split direction ([record](../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)).
The split moved execution ownership only; every original S03 obligation stayed registered. S05 was
accepted and shipped 2026-10-17 (PR #140) and S06 on 2026-10-17 (PR #141); S03's
[reconciliation](./t3.p01.s03-compound-and-runtime-preparation/acceptance.md) closes the umbrella.

**Phase scope (decided at registration).** This phase is the sole Camera/Experience
**source/runtime transition**: shared unit and program codecs (S01), early conditional Save (S02),
compound acceptance and runtime preparation (S03) and the live ownership cutover (S04), which is both
the provider of `T3.camera-experience-cutover@1` and this phase's final gate. The proposal's first
capture/Cut Preview slice and its integrated gate become the candidate next phase,
[T3.P02 — First capture and Cut Preview](../t3.p02-capture-and-cut-preview/README.md): they consume a
cutover gate that was then `undrafted` (ratified at version 1 on 2026-10-19, not yet accepted), so they
could not be registered truthfully,
and the activation slice is already the exhaustive integration point. Capture/Cut Preview remains the
first T3 authoring milestone and does not wait for advanced path, transport or media authoring.

All slices implement against the landed r186 base (three 0.186.1, camera-core peer extended, Threlte
unchanged) and record compatibility against their own actual base.

## Bounded outcome

A creator continues local accepted editing with one history and explicit dirty state. Early Save uses
a create-only or exact saved-base condition and atomic server validation/comparison; conflicts
preserve work. No per-edit server execution or separate cloud history is required.

The phase then performs one Camera/Experience source cutover: Camera retains routes, intrinsic
timing/framing and one output evaluator; Experience owns editorial order; collection-capable source
supports several Experiences over one world. Existing supported Travel invokes the Camera engine with
authored directional timing; missing support reports a gap, never an implicit Cut. Source conversion
preserves supported existing paths/keys/envelopes.

Minimum runtime semantics prepared here include distinct Stop/run identity, Content/Info Panel,
Activate/DestinationReached, ShowContent, NavigateTo, real OpenUrl semantics, explicit Continue,
finite holds, bounded guards/state and covered return-to-origin detours. All lower to one shared
ExecutionProgram codec/interpreter consumed by Preview (T3.P02) and T4. No parallel release language.
DOM navigation reaches every admitted destination and explains gaps/repair; author preference cannot
disable reduced motion. This phase does not complete publication UX or the first authoring surface.

## Investigated basis and implementation consequences

Source baseline: 61baf02873a63d37e3f5a3e2992396f387600d38 (PR #116 merge), inspected in the
prepared T3 worktree, and rechecked for the 2026-10-16 registration against post-PR #126 `main`
(`6964c2dc`), where F1/F3 are landed and accepted and the persistence `PUT` is still unconditional.
This is planning evidence, not compatibility proof; each implementation plan verifies
Camera/visitor behavior against its own base.

Read the [T3 evidence](../planning-evidence.md),
[ratified architecture](../../../reference/architecture.md#semantic-authorities-ratified-destination),
[F.1/F.2/F.4](../../../reference/composition-execution.md),
[Camera contract](../../../reference/components/camera-tour.md),
[World | Experience amendment](../../../reference/decisions/world-experience-reconciliation-2026-09-29.md)
and [PLATE Experience expression](../../../reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression).
The historical [V2 synthesis](../../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md)
supplies repeated-use/reach evidence; its retired shell, arrays and path keys are not formats.

| Surviving evidence | Finding and planning consequence |
| --- | --- |
| packages/project-model/src/project-types.ts and project-codec.ts | Root is strictly id/name/layout/scene, without an accepted revision or dependency lock. Layout is version 5; world-local Scene is version 1. Unknown root keys reject. Adding Camera/Experience cannot be an optional root-field write through today's codec. |
| packages/project-model/src/scene.ts and scene-codec/parse-document.ts | Scene owns the landed navigationNodes/connections storage, including next/previous/hold/detour/lock fields. The strict current codec still admits residual closed cycles and multiple open order components. Camera splitting and order conversion must happen in one named source transition. |
| packages/project-model/src/runtime.ts | prepareRuntime validates the whole project, compiles Layout once, resolves Scene and constructs its Camera graph. Change this composition root, graph construction and callers together; keep the canonical Layout compiler. |
| packages/camera-core/src/camera-route.ts | getCameraRoute finds spatial paths; getCameraConnectionRoute resolves a directed connection; getCameraMotionOptions owns directed timing. walkFlowChain/resolveFlowRoute/getFlowRoute/getFlowLoopConnectionId read editorial node links. Retire those editorial exports/callers at cutover; preserve Camera spatial route resolution. |
| packages/camera-core/src/camera-motion.ts | createCameraMotion/sampleCameraMotion and dense guard/framing invariants survive. Reuse them initially. Experience maps invocation time and holds into Camera samples; it does not lerp pose/FOV. |
| apps/editor/src/lib/visitor/visitor-runtime-state.svelte.ts | Current FSM keys navigation to activeNodeId, walks node links and checks lockInteraction. visitedRoomIds supplies no occurrence history for current world-local nodes. Stable Stop identity and fresh visit/run identity replace those editorial assumptions. |
| apps/editor/src/lib/visitor/VisitorCameraDirector.svelte | Guided requests use getCameraRoute/createCameraMotion; the component does its own free-look target adjustment and neutral OrbitControls realization. There is no occurrence hold/autoplay clock. Its route call does not apply the retained directed-edge timing resolver. Establish one Camera-owned profile controller and one Experience clock, rather than promote this component as the complete destination engine. |
| apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte | Visitor-safe renderer exists, with keyboard canvas instructions; it has no full semantic destination nav/Info Panel. There is no editor Preview route today. Reuse runtime-safe rendering; rebuild accessible visitor controls and isolated Preview admission. |
| apps/editor/src/lib/authoring/camera and its README | Nine retained files are pure modules, not nine accepted destination APIs or four files. Some take SceneDocument or Room-frame helpers; some allocate IDs/mutate passed records. Retention is not dedicated coverage. Extract Camera semantics with real consumers and immutable candidates; keep editor hit/display/gesture policy outside runtime packages. |
| apps/editor/src/lib/platform/project-persistence.ts; apps/api/src/app.ts and project-persistence.ts | Client PUT sends only document. SQL row lock appends project_versions and increments latest_version without an expected source revision. Serial write execution does not reject a stale full-document writer. Both boundaries must change; publication revision is a separate token. |

The Camera reference's description of guided playback/holds is broader than the surviving
component implements. Preserve ratified ownership and intended semantics; do not invent a
working legacy hold engine. During implementation reconcile this descriptive mismatch at the
explicit cutover. No current reference is rewritten to pretend the destination already shipped.

Additional trap: connection View keys also carry holdSeconds/easing in the current codec;
buildRouteViewTrack forwards neither timing field into motion. Inventory them separately from
node holds. Preserve Camera intrinsic framing/timing facts, and explicitly move editorial
station holds to Experience invocation context where their use is unambiguous. Never blindly
copy every similarly named field into Camera or silently discard unevaluated authored data.

## Ownership invariants

| Concern | Sole authority after activation |
| --- | --- |
| View eye/target/FOV, framing/projection, connectivity, route geometry, intrinsic directed motion/easing, spatial route finding and evaluation | Camera codec/unit and camera-core. Renderer cameras realize evaluated output. |
| Presentation meaning and subject/View uses, Default/entry roles, Stops, Guide sequence, holds, continuation, Gates, detour/choice policy and invocation time mapping | Experience codec/unit. An editorial transition refers to supported Camera motion and owns no spatial edge. |
| Source revision/lock, composed validation, atomic install, deterministic intents and undo result | Shared project coordination under F.4. UI and agents use the same admission path. |
| Visit/run identity, clock, choice state, active navigation owner and return/rejoin context | Isolated execution session. Never written back to authored source. |
| Selection, Stage mounting, gestures, Card/task/focus and authoring return | T1 shared editor host; T3 contributes public adapters. No T3 selection/history store. |
| Layout architecture and Scene objects/world presentation | Their existing owners/codecs, wrapped without semantic redesign. No WorldDocument. |

Required laws:

1. Presentation, Stop and visit/invocation identity are distinct. Insert/reorder/repeat never
   uses an array index, label, Room, pose or Camera-node ID as Stop identity. A repeated Stop
   visit starts a fresh run; two Stops may share one Presentation and one View.
2. Exactly one Guide sequence writer. In v1, Guide order is one ordered list of stable Stop IDs;
   no persisted reciprocal next/previous cache. Explicit continuation overrides the default
   sequence successor and is resolved once by Experience, including nonadjacent targets/End.
3. Exactly one Camera output owner per viewport/session. Free inspection/look, guided Travel,
   Cut, rejoin, reduced motion and authoring Follow realize Camera intents through it.
   Control handoff is declared; old completion/cancel cannot reclaim or clear a newer owner.
4. Cut resolves the View and asks Camera to realize it without travel or creating a Connection.
   Travel resolves supported Camera connectivity or returns a gap. No fallback from Travel to
   Cut, no BFS in Experience, and no copied Camera graph/pose/FOV in a Stop or Presentation.
5. View collection/display order, Stop-local View progression, Guide order and Camera
   connectivity remain distinct. A changed entry/exit role rechecks support for every admitted
   origin; it never drags or rewrites an unrelated shared path.
6. Missing View, unset Default, no Views and intentional keep-current-viewpoint are separate
   states. Repair keeps original identity; no matching by name/proximity/containment.
7. Temporary viewing/selection/playback/Preview changes no source or source history. Capturing
   or updating a View is deliberate, validated and discloses shared reach. One chronological
   source history serves both lenses; source Undo is separate from spatial return.
8. Authored anchors remain interior only. Endpoints, generated samples, geometry, Three
   objects, selection, session values and history are never authored document fields.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T3.P01.S01 | shipped | F1.reference@1, F3.channels@1 | F1.reference@1:references-v1, F3.channels@1:inspection-v1 | — | [Shared unit and program codecs](./t3.p01.s01-unit-and-program-codecs/implementation-plan.md) | [record](./t3.p01.s01-unit-and-program-codecs/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) — accepted, closed in PR #131 |
| T3.P01.S02 | shipped | F1.reference@1, F4.intent-acceptance@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1 | — | [Early conditional Save](./t3.p01.s02-early-conditional-save/implementation-plan.md) | [record](./t3.p01.s02-early-conditional-save/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)); accepted 2026-10-16 from recorded independent-review evidence; output `F4.intent-acceptance@1:conditional-save-current-v1` accepted |
| T3.P01.S03 | shipped | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1 | — | [Compound and runtime preparation](./t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md) | [record](./t3.p01.s03-compound-and-runtime-preparation/acceptance.md) | owner-authorized 2026-10-17 ([record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)); umbrella for its [registered split](./t3.p01.s03-compound-and-runtime-preparation/split-proposal.md) — accepted and shipped 2026-10-17 (PRs #140/#141); every original criterion reconciled to the half slices |
| T3.P01.S05 | shipped | F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:acceptance-invariants-v1 | — | [Unit acceptance and unit Save](./t3.p01.s05-unit-acceptance-and-unit-save/implementation-plan.md) | [record](./t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md) | owner-authorized 2026-10-17 ([record](../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)); accepted and shipped 2026-10-17 (PR #140) — `unit-acceptance-v1` and `conditional-save-units-v1` accepted; first half of the S03 split |
| T3.P01.S06 | shipped | F1.reference@1, F2.unit-envelope@1, F3.channels@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1 | — | [Experience runtime and Camera handoff](./t3.p01.s06-experience-runtime-and-camera-handoff/implementation-plan.md) | [record](./t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md) | owner-authorized 2026-10-17 ([record](../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)); accepted and shipped 2026-10-17 (PR #141) — `camera-handoff-v1` accepted; second half of the S03 split |
| T3.P01.S04 | approved | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1 | F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1 | — | [Live ownership cutover](./t3.p01.s04-live-ownership-cutover/implementation-plan.md) | [record](./t3.p01.s04-live-ownership-cutover/acceptance.md) | owner-authorized 2026-10-19 ([record](../../../reference/decisions/t3-cutover-ratification-2026-10-19.md), R5) — phase A accepted at `b9cb5ed1`; phase B implemented on PR #158, independent final review pending |

`references-v1` and `inspection-v1` were accepted on S01's trusted base. S01 and S02 are now shipped
with their accepted capabilities; their exact records, prerequisites, exports and conformance are in
the gate register and the linked capability records. S02's `local-single-domain-v1` prerequisite (with
`acceptance-invariants-v1`) was accepted at `8ec0c5f1`, an ancestor of post-PR #129 `main`, so S02 was
eligible, and its own `conditional-save-current-v1` output is now accepted. S03's prerequisite
closure — S01's `unit-envelope-v1`/`unit-resolution-v1` and S02's `conditional-save-current-v1` — is
complete on `main` (re-verified 2026-10-17 at `c9aa53cf`); S03 is owner-authorized 2026-10-17 (D5, [record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)),
independent of T1's viewport work. As
the [allocation](../../cross-track-execution.md#capability-readiness-amendment) records, S03 consumes
the still-active current-source scopes while it builds the unit implementation, but the unit
capabilities it exports declare only F2 and the enduring `acceptance-invariants-v1`. S04 consumes only
the unit scopes. Every non-base scope includes its declared prerequisite closure; no provider consumes
the new scope it supplies, and F4's sole gate provider stays `T1.P01.S03`.

S05 and S06 are the two registered halves of S03. S05 owns the original unit-acceptance, candidate,
staging, whole-operation history and unit-Save obligations (`unit-acceptance-v1` and
`conditional-save-units-v1`); S06 owns the original `camera-handoff-v1` and Experience-runtime
obligations. Their `Requires` therefore name only accepted scopes (F2 and the enduring
`acceptance-invariants-v1`; `inspection-v1` and the F2 program codec), never S03's retiring
current-source admissions and never each other's unaccepted output. The split changes no ratified F
contract, no capability prerequisite and no part of S04's scope. Both halves are accepted and S03's
original exit criteria are [reconciled](./t3.p01.s03-compound-and-runtime-preparation/acceptance.md).
S04 was authorized on 2026-10-19.

`T3.camera-experience-cutover@1` is `ratified` (2026-10-19) with AM-9 as its contract and S04 as sole
provider; T3.P02 registers only once the gate is `accepted`.

```text
FINAL PHASE GATE: T3.P01.S04 → ./t3.p01.s04-live-ownership-cutover/acceptance.md

PHASE CLOSE
Stage:        active
```

S01, S02, S03, S05 and S06 are accepted and shipped with their accepted capability records. The
final gate is declared, not closeable: the final child `T3.P01.S04` is neither accepted nor shipped, so no `PHASE
CLOSE` beyond the active stage marker is written, and phase/track closure stays a separate owner
event. The first authoring surface does not wait for this phase's closure.

## Cutover mechanics and retirement

> **Clean-reset path — owner-ratified 2026-10-19** ([T3 cutover record](../../../reference/decisions/t3-cutover-ratification-2026-10-19.md),
> R1–R3). This section restates [AM-9](../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover),
> which supersedes AM-7. The AM-7 inventory/conversion procedure this section replaces is recoverable at
> `git show 5fee2a2d:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/README.md`.

1. **No covered data, no conversion.** The owner rules every saved source, version, receipt,
   resource, publication and release disposable before the Source Baseline (R1). F.2's migration
   exception is therefore not invoked. There is no inventory, converter, conversion CAS, backup
   obligation or restore rehearsal. The inactive converter module and its conformance test retire
   in S04. Checked-in fixtures and the starter template are rewritten as F2 units in code. They may
   be generated once offline and reviewed, but the generator never ships.
2. **One forward reset migration.** It runs under an advisory lock (TD-6). In one transaction it
   removes all authored rows (`projects`, `project_versions`, `save_receipts`, `assets`,
   `publications`, `releases`) and installs a schema that structurally admits only the F2 envelope,
   so a pre-epoch writer fails. `users` and `schema_migrations` are kept. Unreferenced R2 bytes are
   purged afterwards, idempotently. A purge requires the active `005` epoch and a configured
   deployment namespace, verifies that every visible key sits under `projects/<namespace>/` and
   only uses the shape this API writes, and deletes only unreferenced keys under it. A shared
   bucket, a foreign namespace or an object of unknown provenance refuses the purge.
3. **One source epoch.** API admission, editor boot, import, session drafts and Save accept only
   declared F2 versions. Old clients, files and drafts, mixed roots and unknown versions fail with
   typed version diagnostics. There is no sniffing, fallback, dual write or writable flag. New
   bootstrap and the starter emit only F2. Skew between the independently deployed API and editor
   builds refuses and never misreads, so activation does not depend on deployment timing.
4. **Retire immediately.** Remove live node order/hold/detour/lock fields and validation from Scene
   and Camera structural types, and remove legacy flow-order exports, `visitorMainFlowNodeIds`,
   node-keyed editorial traversal and their callers. Retire the current-source F4/Save/Stage/starter
   adapters supplied by T1 and early T3, migrating every existing T1/T2 caller and its unfinished
   capability requirements together. `acceptance-invariants-v1` persists. No reverse serializer,
   dual write or old-format reader survives.
5. **Recover deliberately.** A failed migration transaction leaves the prior state untouched. After
   activation, recovery rolls forward. Every project starts at a new-format history baseline, and
   source Undo never crosses the format boundary.
6. **Activation is owner-run.** The S04 merge is the code cutover. The reset on the deployed
   environment (migration 005, then the API and editor deploys) follows the runbook in the S04 plan.
   It is not part of any planning PR.

Changes include the canonical package/source boundary, not only JSON Save. The current portable
package format has its own version/header; S04 declares the F2 admission explicitly. Unknown or
pre-epoch package/source formats fail. Coordinate that boundary with T2/T4 rather than hide a second
project reader behind import.

## Admission and refusal matrix

> **Ratified with the clean-reset path (2026-10-19).** The legacy-conversion rows (empty,
> free-only, open chain, components, cycle, detour, `lockInteraction`, View-key hold) served AM-7's
> covered data and are withdrawn with it. They are recoverable at the `git show` reference above.
> The rows below govern the new format.

| Input or operation | Required outcome |
| --- | --- |
| Pre-epoch source/package file, old-client Save, old session draft, mixed old/new roots, unknown unit/envelope version | Refuse with a typed version/revision-required diagnostic, path and action; current state unchanged; never sniffed, converted or partially read |
| New empty project or starter | F2 envelope with empty Camera and collection-capable Experience units; no fabricated Presentation/Guide/entry and no empty-ID lookup. Neutral inspection remains Camera-owned session output. |
| Presentation without a Guide | Valid; lowering and DOM navigation keep it reachable (the S06 gap is fixed before activation, R5) |
| Paths/keys/envelopes/directional durations/easing | Preserve Camera geometry/framing/intrinsic profile data. Generated endpoints stay generated. Invalid anchors/timing remain validation errors, not clamping/auto-repair. Dedicated parity probes cover both directions. |
| Missing external asset pin or View/subject binding | Preserve original identity with typed unresolved status if that binding kind permits repairable authored state. Do not accept malformed structure. Preview disables/refuses affected required behavior; selected-program closure refuses publication. |
| Duplicated IDs, malformed lock, missing revision | Reject admission with path/code/action; never manufacture an identity |
| New reorder/duplicate/delete/entry edit | Prepare whole composed candidate; keep Stop IDs on reorder, allocate new Stop identity on repeat. Validate defaults, all uses, continuation and Camera reach. Shared Camera deletion never cascade-deletes Presentations/Stops; refuse or explicitly accept supported unresolved bindings. |
| Travel missing route, Cut over same pair, keep-viewpoint | Travel reports gap and cannot play that required transition; Cut realizes resolved View without geometry; keep-viewpoint does not resolve a missing View by accident. |
| Failed staged upload, stale local/cloud writer, late prior-run event | Prior accepted source/lock/history/output remains intact; staged bytes are collectable. Typed refusal, no automatic last-write-wins/rebase, no stale cleanup affecting a newer run. |
| Publish/Update before `T4.P01.S05`; public read of any publication ID | `prepared-reader-required`; honest not-found/unavailable; status/Unpublish truthful; `/p/` and isolation real (R4) |

## Acceptance/history and cloud authority

One immutable accepted project snapshot feeds renderer, authoring and Preview preparation.
One typed intent captures all new IDs, source revision, resource revisions and any sampled
viewport pose/aspect **before** deterministic planning. Validate all affected units, preserved
units, references and resource locks before publishing the accepted result. No child mutation
may install independently, and no await between partial domain installs is allowed.

Propose snapshot-based chronological history initially, capped at 100 accepted source actions,
with one undo payload covering every domain and lock changed by the compound intent. No-op,
invalid, canceled or stale requests add nothing. Undo/redo revalidate through the same F4
boundary against the current revision, install once with a fresh revision, and truncate redo
after a new source edit. Compare canonical authored content, excluding revision/history/session
bookkeeping; revision tokens never rewind, including A→B→Undo→A (ABA). This selects a bounded
mechanism, not CRDTs, selective actor undo or an event-sourcing commitment.

**Local accepted editing with explicit conditional Save.** Use the source-independent common
revision/result contract. AcceptedRevision, canonical content digest, host epoch, saved-base token,
SQL version and publication revision are distinct. Local operations and Undo use one coordinator
and 100-entry history; local acceptance is not a cloud persistence acknowledgment.

Save captures an immutable local snapshot/revision/digest plus create-only or expected saved-base
condition, as one typed shared-coordination persistence operation. Under a server row lock, check
owner/precondition, run the same full source validation, and commit the source revision/lock/version
metadata once. The pre-F2 adapter stores accepted revision metadata beside, not inside, today's
strict document. F2 Save persists the captured envelope revision. Reject missing preconditions and
old clients; never permit an unconditional document overwrite or a separate cloud history.

An acknowledged response advances the saved-base token and saved digest only for that operation.
Edits made during Save remain local and dirty; history/selection are not reset. A previous-session
response cannot install or mark anything saved. Conflict preserves local accepted source/history
and remote data, requiring reload or explicit source resolution against a fresh saved base. No
silent merge/rebase, server-per-command requirement or claim that unsaved edits are cloud accepted.

Stable operation receipts make retry idempotent; changed captured payload under the same operation
ID refuses. A network-ambiguous Save is resolved via its receipt before retrying from a new base.
Receipt/history metadata never enters authored units. Staging occurs before short metadata commits;
failed validation/revision/resource checks leave prior source/lock intact and staged bytes collectable.

S02 activates only the current-source protocol. S05 (the first half of the S03 split) proved the
new unit adapter inactive. S04 fences old writers structurally, resets the disposable stored
sources (the ratified clean-reset path) and switches all callers to the unit adapter atomically. It
retires current-source normal admission and scope. No ordinary Undo crosses that format boundary.

## Minimum T1/T2/T4 dependencies

The [coordinated matrix/DAG and capability-readiness amendment](../../cross-track-execution.md) defines the common
assignments. T1 S01 supplies F1/F3; T1 S03 alone provides the initial local F4. T3 S01 provides F2,
S02 adds early conditional Save independently of F2, and the S03 split (S05: unit acceptance and
unit Save; S06: runtime and Camera handoff) extended unit/Save/handoff conformance before activation. Required base and extension capabilities must be accepted at trusted
base; overall local gate acceptance cannot authorize an unimplemented cloud or compound consumer.

**Viewport:** no slice of this phase consumes it; the first authoring surface in the candidate
[T3.P02](../t3.p02-capture-and-cut-preview/README.md) needs the accepted public T1 seam. Its source-
independent facade accepts the new F2 adapter without required-method changes. Canonical selection,
gesture transition policy, rendered matrices/rays/planes, capture aspect and Camera ticket/return
protocol stay single. Missing required methods block mounting; no casts/private Stage imports,
separate canvas, projection or navigation authority. This phase's data/runtime/activation work has
no viewport gate prerequisite. If a Stage host already exists, S04 must migrate it and prove replacement
cancellation as caller integration, rather than wait for all of T1 or add a second M5 guard.

**T2:** existing Scene subject labels/identity suffice for first capture; full placement/import/
component depth is not a prerequisite. S04 migrates whatever Scene adapters have actually landed.
T1's explicit starter gallery enables real floor-supported composition without general Wall drawing.

**T4:** T3 owns the sole authored-source conversion, ExecutionProgram codec/lowering/interpreter and
visitor semantic transition. T4 consumes these new units/identities, with no default legacy identity
map or second Experience interpreter. Its F5 schema needs S01's shared codec, not S04 activation;
offline lowering/storage can use closed candidate fixtures and S03 runtime primitives. Final T4
public activation waits for accepted T3 S04, not T3 authoring or phase completion. Preview uses the
same lowering/evaluation in an isolated in-memory session; it does not need a prepared reader live.

The owner approved the publication gap on 2026-10-19 (R4). Under the ratified clean-reset path (R1/R4),
every publication and release row is removed at activation, so the covered set is empty by
construction. The gap is then *no publishing from activation until T4 S05*: new source
Publish/Update returns prepared-reader-required, public cold boot stays explicitly
unavailable/not-found, status/Unpublish remain honest and /p/ boundary tests stay real. No
premature source-capsule format and no old competing visitor engine. T4 S05 owns the prepared
API/resource/browser switch and source-reader retirement.

**r186:** the separate [upgrade PR #122](https://github.com/Biskiq/spatial-sketch-editor/pull/122)
is landed (`74efb98b`: three 0.186.1 / `@types/three` 0.186.0, Threlte unchanged, explicit
`PCFShadowMap`). No Camera-authority amendment was needed: the camera-core peer admits `^0.186.1` and
the dense motion/framing suites pass on the landed base. Verify actual Camera/renderer/Threlte
compatibility against that baseline when each implementation starts.

## Verification and acceptance criteria

Tests prove public behavior and real composition roots; source scans are reserved for ownership,
caller retirement and import isolation. Retire obsolete flow-model tests only with explicit
same-defect successor coverage. Restore dedicated retained-helper contracts when their actual
consumer returns. No snapshot of implementation text substitutes for acceptance.

| Probe | Observable evidence required |
| --- | --- |
| Epoch/admission (clean reset) | Every row of the admission matrix: pre-epoch file/client/draft, mixed roots and unknown versions refuse with typed diagnostics and unchanged state. The reset migration removes all authored rows in one transaction, is a no-op on rerun and has a single winner under two runners (TD-6). A pre-epoch writer fails structurally after it. Prior `/p/` IDs are not-found, and Publish returns `prepared-reader-required`. The starter and empty boot emit only F2. |
| Shared reuse | Guide visits Piano, Gallery, Piano using two Stop IDs but one Presentation/View. Different holds/entry roles persist after reorder/insert/delete elsewhere; repeated visit to one Stop gets a fresh invocation. A second Experience sees shared Camera updates with explicit reach while retaining its own order. |
| Atomic acceptance/undo | Capture+Presentation+Stop installs one result and one undo payload. Invalid last binding, whole-group duplicate collision, lock mismatch or upload failure installs nothing. No-op adds no history. Undo/redo restores all affected authored data/locks once, preserves unrelated source, uses fresh revision, truncates redo and respects the cap. |
| Cloud contention | Two Saves with the same expected saved-base token: exactly one wins; loser gets typed conflict and no new version. Missing precondition rejects; retry returns original receipt; changed-payload retry refuses. Test transaction failure after version staging and before pointer update on real Postgres with zero skips. Distinguish publication/source revision and create-only collisions. |
| Motion/continuation | Forward/reverse authored timing, envelopes and interior Y survive; arbitrary seeks match Camera samples. Cut changes no topology; Travel gap never silently cuts or searches from Experience. Hold boundaries, explicit nonadjacent/End, Continue and detour return resolve by occurrence. All admitted exit Views are checked. |
| Session/handoff | Two previews/visitor sessions have independent clocks/choices. Free exploration releases guided control; rejoin evaluates from the actual current pose and leaves autoplay paused. Old arrival/cancel after new visit, replacement, source edit or Preview exit cannot advance order or clear the new output. Seek replays explicit ordered events/checkpoints and never guesses visitor history. |
| Accessibility | DOM nav/keyboard/pointer/touch have the same Activate meaning and reach; aria-current/progress are occurrence-derived. Info Panel focus-in/Escape/return, useful labels and links work without raycast. Reduced motion reaches the same destination without accelerated travel, and explicit media playback remains activation-safe if media is later admitted. |
| Architecture | One Camera evaluation/route authority, one order writer, shared acceptance exports, no old flow callers, runtime-safe domain adapters; cold/public/preview boundaries exclude editor stores/history/gizmos. T3 adapters import only the public T1 seam. |

Keep existing Camera fast contracts and the complete dense sweeps in the heavy lane, including
zero-width ramp exceptions, endpoint exactness, finite/nondegenerate targets, guarded angular
rate and deterministic seeks. Keep cold/public/identity/preview boundary suites and Vite plugin
tests unconditional. Relevant existing proof homes are camera-route/motion/timing/framing
contracts under tests/lib/museum/navigation and visitor-runtime-state/cold-runtime/public-route/
identity-isolation/preview-surface-boundary under tests/lib/visitor, plus apps/api/tests/projects,
assets and publication contracts. New Experience and F conformance tests get durable owners,
not phase-local copies of the same assertions.

Verification commands/tiers are owned by
[the test manual](../../../../apps/editor/tests/README.md#what-a-change-requires). During work run
affected whole contracts/package checks and relevant heavy proofs. Every implementation-PR merge
gate keeps the complete contract, including heavy tests; S04 additionally records the
integrated caller/runtime journeys, root check/build, relevant package checks, full editor lanes
and check:api/test:api on a reachable DB with **zero skips**. A focused green run cannot accept
a gate. This planning-only change runs documentation and the whole arch lane; no product
behavior or DB acceptance is claimed here.

**Acceptance:** S04 makes the behavioral cutover gate ready only with exports, conformance,
independent acceptance and a real ancestor commit recorded in the global register, and as this
phase's final gate it accepts early conditional Save and every scoped migration obligation, with
unresolved residuals named by owner. The creator loop (capture/Cut Preview) is T3.P02's acceptance.
One-Camera, one-order, current-format, visitor-isolation and source/session separation must all
hold. Refusals must be reviewable results with unchanged accepted state, not silent exclusions.

## Authorization and open decisions

- **Authorized:** `T3.P01.S01` (2026-10-16, shipped in PR #131) and `T3.P01.S02` (2026-10-16, shipped
  in PR #133), which ran in parallel with `T2.P01.S02` under the
  [pair protocol](../../cross-track-execution.md#parallel-pair-2026-10-16); `T3.P01.S03` (2026-10-17,
  [record](../../../reference/decisions/next-batch-authorization-2026-10-17.md)), executed through its
  registered split `T3.P01.S05` (PR #140) and `T3.P01.S06` (PR #141)
  ([record](../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)) and closed
  as the reconciled umbrella. All five are shipped.
- **Save ownership (settled 2026-10-16,
  [record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)):** S02 owns the
  protocol, the server path, the client and the framework-free client Save state; T1 owns the Head
  integration in its host↔F4 wiring slice (`T1.P01.S04` by default), which enables Save only with
  `conditional-save-current-v1` accepted at its own trusted base. S02 builds no shell control, and
  `T1.P01.S02` boots read-only, so no unsafe writer exists meanwhile.
- **Before S03 is authorized:** S01 and S02 accepted on `main`.
- **S04 authorized 2026-10-19** ([T3 cutover record](../../../reference/decisions/t3-cutover-ratification-2026-10-19.md)):
  the owner signed the disposability ruling (R1), AM-7's supersession by AM-9 (R2), the
  `T3.camera-experience-cutover@1` ratification (R3), the empty publication gap (R4) and the
  two-phase authorization (R5). The closed checklist is S04's
  [authorization path](./t3.p01.s04-live-ownership-cutover/implementation-plan.md#authorization-path).
- **No architecture-cycle window.** T3 slices are not exposures of the configured T1 window and do
  not open it.
