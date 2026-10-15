# T3.P01 — Camera/Experience cutover and first authoring foundation

**Status:** track-local phase proposal for owner review, 2026-10-14. This document does not
authorize planning or implementation. Candidate phase/slice identifiers below are not registered. No F
amendment, gate version, provider assignment, acceptance or phase closure is ratified here.
Route: [T3](../README.md) · [runbook](../../../operations/t3-experience/README.md) ·
[gate register](../../README.md#gate-register).

**Recommendation:** establish shared F.2/F.4 providers, then activate the Camera-unit split,
Experience order and revision-safe acceptance together. Accept the behavioral
T3.camera-experience-cutover gate before mounting Camera authoring on T1's shared Stage.
Finish with a small usable Experience loop, rather than rebuilding all retired Camera tools.
Exact shared interface recommendations and the provider overlap with T1 are in
[F amendment proposals](./f-amendment-proposals.md); that file is a draft for reconciliation.

## 1. Bounded outcome

A creator can create a Presentation from an existing subject or composed standpoint,
explicitly capture a Camera View, assign its Presentation use/Default, and optionally create a
Guide Stop in **one** accepted operation. They can reuse the Presentation in a second Stop,
reorder by stable occurrence identity, give the occurrences different holds/entry policies,
choose Cut or supported Travel, inspect/refuse a route gap, Undo/Redo, save with an expected
revision, and run an isolated visitor Preview. There is one shared world and a collection of
Experiences; the initial UI may concentrate on one active Experience but must switch between
two in a conformance journey without duplicating Camera or Scene.

The cutover itself establishes the foundation before this UI: strict codec units, deterministic
cross-domain acceptance/history, explicit conversion/refusal, and one occurrence-based visitor
session invoking Camera evaluation. It retires Camera-node editorial fields and main-flow
orchestration, not Camera's geometry, directed timing, framing guards or route finding.

Included minimum visitor meaning is labelled Presentations, text Content/Info Panel,
Activate/DestinationReached, ShowContent and NavigateTo through a real Camera domain adapter.
OpenUrl uses real link semantics and activation rules. Include a small typed session reducer
for explicit Continue and return-to-origin detour choices; no arbitrary scripting or hidden
clock/network input. DOM navigation reaches every available semantic destination, identifies
the current Stop, and explains unavailable/gap/repair cases. Motion preference cannot be
disabled by an author.

**Deferred to later T3 phases:** broad behavior/offer editing, narration/media scheduling,
adaptive framing UI, rich precision instruments, new motion kinds, nested performances,
general expression editors, branch-rejoin authoring, station Cue authoring and a general
timeline. Preserve their extension space and existing supported source facts. No T2
definitions/components overhaul, T1 vertical/representation expansion, asset-ingest UI or T4
publication work is required for this outcome. This phase does not complete the whole track.

## 2. Investigated basis and implementation consequences

Source baseline: 61baf02873a63d37e3f5a3e2992396f387600d38 (PR #116 merge), inspected in the
T3 worktree. This proposal records planning evidence against that shared repository baseline.
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

## 3. Ownership invariants

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

## 4. Candidate slice sequence

The register below is a **proposal**, not the lifecycle register. Recommended @1 versions are
contingent on reconciliation/ratification and actual global registration. Consumers start only
after their exact gates are accepted at the trusted base; acceptance in a consumer's own diff
does not satisfy eligibility. Same-phase order is not an exception.

| Slice | Status | Consumes | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- |
| T3.P01.S01 | proposed | F1.reference@1 | — | [Shared unit-envelope provider](#s01-shared-unit-envelope-provider) | — | — |
| T3.P01.S02 | proposed | F1.reference@1, F2.unit-envelope@1 | — | [Shared intent-acceptance provider](#s02-shared-intent-acceptance-provider) | — | — |
| T3.P01.S03 | proposed | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1 | — | [Live ownership cutover](#s03-live-ownership-cutover) | — | — |
| T3.P01.S04 | proposed | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | camera-authoring-migration | [First authoring loop](#s04-first-authoring-loop) | — | — |
| T3.P01.S05 | proposed | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1 | — | [Integrated final gate](#s05-integrated-final-gate) | — | — |

FINAL PHASE GATE: T3.P01.S05 → [integrated final-gate plan](#s05-integrated-final-gate).
Acceptance evidence is absent. PHASE CLOSE is not requested or recorded.

### S01 Shared unit-envelope provider

VERIFICATION: architecture-integration
INTEGRATION ROUTE: ./README.md#s05-integrated-final-gate

**First provider slice.** Needs phase/slice approval, accepted F1.reference at trusted base,
and ratified exact F.2 amendment/provider registration. Proposed sole provider:
F2.unit-envelope@1. Shared code belongs in project-model and domain-owned codecs, not this
phase folder. Implement strict header/envelope/lock negotiation, Camera/Experience candidate
codecs and the minimal admitted resource registry; keep current Layout/Scene semantics.
Collection shape supports several Experiences and optional Guides.

Prove empty/two-Experience round trips, version/unknown-key refusal, stable references and
resource-lock diagnostics. Implement the explicit current-source conversion planner as a
pure candidate operation with mapping report, without activating it in normal readers or
writers. New unit codecs do not make the live Camera split happen early. No new authoring or
visitor path reads these candidate documents yet. F2 acceptance proves a shared interface
and actual codec support; it does not accept the T3 behavior cutover.

### S02 Shared intent-acceptance provider

VERIFICATION: architecture-integration
INTEGRATION ROUTE: ./README.md#s05-integrated-final-gate

Proposed sole provider F4.intent-acceptance@1 under the **currently ratified first-at-T3 rule**.
Reconcile T1's early-local provider request first; no concurrent provider claims are allowed.
Implement shared prepare/validate/accept, exact expected revisions, deterministic identity/input
capture, immutable snapshots, one chronological bounded history and validated undo/redo.
Use real Camera and Experience candidate planners to prove capture View + bind Presentation +
optional Stop, not just fake two-field transactions. The resulting selected program uses a
real Camera adapter; full T2 capability depth is not a prerequisite.

Supply the cloud transaction/CAS adapter and client protocol with real-Postgres contention,
rollback and retry tests. Stage assets before the short metadata transaction. The provider
harness proves all-or-nothing behavior without exposing an alternative live source writer.
Activation of the new source admission replaces the old Save path in S03. Shared code can be
accepted before product activation; the first live compound operation remains the Experience
cutover. Neither F4 gate readiness nor a local history stack proves T3's behavioral gate.

### S03 Live ownership cutover

VERIFICATION: exhaustive

Proposed sole provider T3.camera-experience-cutover@1. This is one coordinated activation of
strict new source readers/writers, conversion, cloud CAS, shared acceptance and the visitor
order consumer. It consumes F interfaces, never its own T3 gate. It does **not** declare
camera-authoring-migration: it changes model/runtime ownership, without mounting old/new
editor Camera authoring. The later S04 consumes the accepted behavioral gate.

Replace Scene navigation construction and all editorial camera-core/runtime callers. Install
the Experience reducer/clock, occurrence-based continuation/holds, minimal gates/detours,
Camera-owned guided/free/reduced-motion controllers and semantic DOM companion/Info Panel.
Directed timing and arbitrary seeks use the same canonical Camera evaluation. Explicitly
cancel previous-epoch runs on source acceptance or project replacement; re-arm M5 where this
slice actually introduces replacement, or add conformance to T1's already re-armed guard.

Update project boot, validator/serializer, runtime preparation, source import/export,
platform pending-save/client handling, API Save/Load and their boundary tests together.
Prevent new-format P22 source publication pending T4 as specified below. Accept this gate only
after the migration/retirement/refusal matrix, stale local/cloud writers, runtime identity,
isolation and shared Camera proof pass. No surviving live legacy reader/controller is counted
as an acceptable temporary shim.

### S04 First authoring loop

VERIFICATION: architecture-integration
INTEGRATION ROUTE: ./README.md#s05-integrated-final-gate

Needs accepted T1 viewport and T3 cutover versions at trusted base. Mount on the public T1
host: Presentation thumbnails/Default/reach, explicit View capture/Update/Exit, one invoked
Guide context with repeat/reorder/hold/entry/Cut/Travel controls, direct Camera interior-anchor
editing and keyboard/numeric alternatives for the enabled operations. Restore only Camera
helpers justified by these consumers. Do not resurrect the old Camera Plan/timeline shell.

Include source Undo/Redo and revision-safe cloud behavior through shared coordination, an
isolated Preview takeover, Play/Pause/scrub/Follow reading one invocation, and explicit
return/handoff. Selection does not navigate; closing a Guide cancels its playback/helpers;
editing source cannot leave playback sampling an old revision. Captured image/projection/
aspect/thumbnail agree in the real renderer. Shared View updates invoke PLATE's scope decision;
do not offer unsupported local overrides. Rebinding to a deliberately captured new View is a
valid narrow alternative where shared update is declined.

### S05 Integrated final gate

VERIFICATION: exhaustive

Record independent acceptance of the bounded creator loop plus the tests in §9, with actual
base/export/conformance identities for every consumed gate. Reconcile landed reference
contracts only after the explicit production cutover. Verify no unowned migration shim or
legacy order caller remains. Passing makes the phase closable; owner-invoked phase closure,
track completion, T4 reader acceptance and a Source/Release Baseline are separate events.

## 5. Cutover mechanics and retirement

1. **Agree formats and coverage.** Ratify shared F amendments/provider assignment separately.
   Before S03 approval inventory actual source files/packages, pending session saves, cloud
   projects/versions and publications. Current owner evidence says there are no releases;
   it does not prove there are no saved projects. This planning pass inspected code, not live
   private DB contents. Record counts/format coverage and backups without exposing assets.
2. **Prepare without installation.** The named converter reads only the strict post-#115
   pair, retains immutable original bytes/IDs, produces all unit candidates and the mapping
   report, and runs domain plus composed authored validation. Resource pins are verified or
   explicitly unresolved; no fabricated lock. Report ambiguity/refusal before acceptance.
3. **Quiesce and accept once.** Block writes during the source transition. Capture one expected
   migration baseline (project ID, source-content identity and current cloud version where
   stored) and conversion inputs; CAS-install the entire new envelope,
   Camera, Experience, Scene and lock as one acceptance/version. Concurrent Save/conversion
   loses the CAS and changes nothing. No intermediate Camera-only or order-only state exists.
   This restricted administrative conversion establishes the new-format history baseline;
   it is not an ordinary source Undo entry into an unsupported old schema. Its recovery result
   is the preserved source/deployment rollback handle. Ordinary F4 authoring after activation,
   beginning with the compound View/Presentation/Stop operation, has one normal undo result.
4. **Activate one source epoch.** Deploy the new readers/API admission/runtime together; old
   clients fail with version/revision-required diagnostics. Normal decoding is current-format
   only. The old converter is an explicit import/migration entry, never format sniffing or a
   transparent reader fallback. New bootstrap emits only the new format.
5. **Retire immediately.** Remove live node order/hold/detour/lock fields and validation from
   Scene and Camera structural types; remove legacy flow-order exports, visitorMainFlowNodeIds,
   node-keyed editorial traversal and corresponding callers. Retire the editor-current-source
   F4 adapter if T1 introduced it. Only the bounded read-only converter knows the old fields.
   Its owner is T3; remove it when the covered migration inventory is completed/discharged
   and recovery is verified, before the Source Baseline. No reverse serializer, dual write,
   writable feature flag or indefinite migration reader.
6. **Recover deliberately.** Failed planning/staging/CAS leaves prior state untouched. For a
   failure immediately after activation, quiesce writes and restore the backed-up pre-cutover
   source plus matching deployment as a coordinated rollback. Do not reverse-convert edited
   new-format data. After any new-format edit, retain that revision and roll forward/repair or
   restore an explicitly selected backup with disclosed loss of subsequent edits. Source
   Undo restores new-format authored contents with a fresh revision; it never reactivates the
   old schema or rewinds revision identity.

Changes include the canonical package/source boundary, not only JSON Save. The current portable
package format has its own version/header; any new envelope admission needs an explicit
version/interface decision. Unknown package/source formats fail. Coordinate that boundary
with T2/T4 rather than hide a second project reader behind import.

## 6. Conversion and refusal matrix

The proposed migration exception covers **valid post-#115 current source**, not historical
room-local Scene/Layout generations, external frozen projects or old public releases. It
requires owner-approved product reason, exact inventory, recovery and converter retirement.

| Input or operation | Required outcome |
| --- | --- |
| Empty project, no Camera nodes/order | Wrap unchanged Layout/Scene content; empty Camera and collection-capable Experience units. No fabricated Presentation/Guide/entry, no empty-ID lookup. Neutral inspection remains Camera-owned session output. |
| Valid free-only node | Preserve ID as Camera View; create a labelled Presentation/View use for the visitor navigation surface. No Stop unless explicitly requested; no implied Guide order from node array order. |
| Valid reciprocal open chain | One stable Stop per legacy ordered occurrence, one Presentation/View use per node; map order to Stop IDs, node hold to that occurrence, and links to explicit Experience continuation/Travel support. Preserve View/Connection/anchor IDs and world Y/targets/FOV byte values. |
| Multiple open components | Preserve each as a separate Guide. Do not pick a main/default Guide by array order. Require explicit entry/main/detour mapping where the old codec admits more than its runtime can explain; otherwise return requires-policy-mapping before install. |
| Single admitted residual cycle | Record explicit entry choice (the old read-selected entry is a proposed, disclosed input), break reciprocal links into stable order, and encode loop continuation only when a distinct Camera closing connection supports it. A two-node pair's sole edge does not become a loop. Loop eligibility is not automatic autoplay. |
| detourOfNodeId, including singleton detour | Map to an explicit Experience choice/return-to-origin relationship and initiating invocation context. Validate origin occurrence/branch support. Ambiguous origin, self/nested relation or unsupported later rejoin refuses pending mapping; no guessed main component or Camera-owned branch. |
| lockInteraction absent/false | No added blocking Gate. |
| lockInteraction true | Never mechanically rename to wait-for-Continue: legacy direct-entry prohibition is not that meaning. Require a reviewed policy mapping preserving intended entry/availability or an explicit repair/refusal. Startup at a locked node and incoming traversal must be separately accounted for. This field is migration input only. |
| Nonzero connection View-key hold | Retain in the report and map to an Experience invocation hold at an identity-qualified Camera station only when the relevant use/direction is explicit. Multiple/unknown uses need supplied mapping or refusal; never silently drop it or turn it into a second Camera motion timeline. Zero/absent creates no editorial hold. |
| Paths/keys/envelopes/directional durations/easing | Preserve Camera geometry/framing/intrinsic profile data. Generated endpoints stay generated. Invalid anchors/timing remain validation errors, not clamping/auto-repair. Dedicated parity probes cover both directions. |
| Missing external asset pin or View/subject binding in new source | Preserve original identity with typed unresolved status if that binding kind permits repairable authored state. Do not accept malformed structure. Preview disables/refuses affected required behavior; selected-program closure refuses publication. |
| Missing/invalid legacy node, asymmetric links, unsupported old unit, duplicated IDs, malformed lock, missing revision | Reject conversion/admission with path/code/action. A valid new repairable binding is not a reason to relax the legacy codec or manufacture an identity. |
| New reorder/duplicate/delete/entry edit | Prepare whole composed candidate; keep Stop IDs on reorder, allocate new Stop identity on repeat. Validate defaults, all uses, continuation and Camera reach. Shared Camera deletion never cascade-deletes Presentations/Stops; refuse or explicitly accept supported unresolved bindings. |
| Travel missing route, Cut over same pair, keep-viewpoint | Travel reports gap and cannot play that required transition; Cut realizes resolved View without geometry; keep-viewpoint does not resolve a missing View by accident. |
| Failed staged upload, stale local/cloud writer, late prior-run event | Prior accepted source/lock/history/output remains intact; staged bytes are collectable. Typed refusal, no automatic last-write-wins/rebase, no stale cleanup affecting a newer run. |

## 7. Acceptance/history and cloud authority

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

**One authority mode per authoring session.** Local projects use the shared in-memory CAS
coordinator. Cloud sessions submit the same serializable intents to the server coordinator;
unaccepted gestures stay local previews and accepted source installs only after the response.
The server locks the project row, checks expected source revision/ownership, prepares/validates
against that exact snapshot, and commits all metadata once. SQL storage version and publication
revision remain distinct from the semantic source revision. Missing expected revision is an
error, not a backward-compatible bypass.

Cloud create/import is an explicit typed intent with a create-only precondition. A deliberate
source replacement is a typed, captured-input intent against the known current revision, with
full composed validation; it is not unrestricted raw-document PUT. Existing offline/cloud
divergence refuses Save pending reload/explicit resolution. Do not silently rebase or mint a
second local accepted writer over a cloud checkout. Server-backed sessions can retain local
proposals during disconnection, but cannot report them as accepted cloud edits. UI Save may
checkpoint/confirm the already accepted cloud revision without appending a duplicate version.
Resolve these mode/replacement rules with T1's local history before activation.

Retries use stable operation identity. An identical request returns its original accepted
receipt without another revision/history effect; reuse of the operation ID with different
captured payload refuses. Do not use retry success to apply an obsolete response to a replaced
editor session. Receipt retention is a metadata concern, outside authored units.

## 8. Minimum T1/T2/T4 dependencies

**T1 viewport is needed by S04, not S01–S03.** Consume only the accepted public projection/
input/host seam: coherent snapshot identity/epoch, actual evaluated Camera matrices and
world↔CSS/ray/explicit-plane conversion, viewport rectangle/DPR/aspect, Camera viewing-intent
requests and handoff/return, canonical selection, adapter graphics/hit registration, gesture
lease, Card/instrument slots and disposal. T3 adds an explicit F2 accepted-snapshot adapter
where T1 initially reads the old ProjectDocument. No casts/private Stage imports, independent
SVG transform, separate WebGL authoring canvas or raw OrbitControls pose writer.

Look-through/Follow/Preview takeover must negotiate the same output owner and restore through
it. Needed host additions are compatible, reviewed amendments when possible; a missing required
method blocks S04, rather than starting a private T3 host. Exact capture aspect must be exposed
or added before View capture. T1's read-only Camera conformance probe may precede cutover;
it must author no View/path/order, avoiding a dependency cycle.

T3 does not wait for T1's full phase, Wall drawing, levels, Section/peel/lift, representation
depth or precision tools. T1's cycle window is not opened/configured by this proposal; ordinary
T3 data work is outside it. Re-arm project-replacement M5 at the first real wiring, with a
call-site proof of prior-epoch cancellation and navigator/selection reset, not a second guard.

**T2:** use a real adapter for existing canonical Scene subject identity/labels and Camera View
capability. Do not fabricate object behavior. Full composition/import/component depth is not
required. Share F1/F2/F4 interfaces; do not merge T2's unratified persisted schemas here.

**T4:** this phase owns visitor semantics/Preview, not a new release envelope or prepared reader.
Do not publish a new source capsule as an interim durable format. At activation disable P22
Publish/Update for the new source epoch with a typed prepared-reader-required response until
T4's accepted F5/prepared-reader path exists. Anonymous failures and Unpublish remain honest.
Exercise the visitor-safe runtime with closed in-memory fixtures/Preview. Those are runtime
tests, not releases or a Release Baseline. If inventory discovers existing releases, S03's
activation requires an owner/T4 compatibility disposition before touching their reader; never
reinterpret old bytes or retain a competing old navigation engine as a shortcut.

## 9. Meaningful verification and acceptance criteria

Tests prove public behavior and real composition roots; source scans are reserved for ownership,
caller retirement and import isolation. Retire obsolete flow-model tests only with explicit
same-defect successor coverage. Restore dedicated retained-helper contracts when their actual
consumer returns. No snapshot of implementation text substitutes for acceptance.

| Probe | Observable evidence required |
| --- | --- |
| Codec/migration | Empty, free-only, open chain, two-node non-loop, distinct closing loop, singleton detour, multiple components, lock=true and View-key hold fixtures. Source stays unchanged on preparation/refusal; IDs/data/pins preserved; one committed transition; mixed old/new roots and unknown versions refuse. Conversion replay yields identical candidates/report from identical captured inputs. |
| Shared reuse | Guide visits Piano, Gallery, Piano using two Stop IDs but one Presentation/View. Different holds/entry roles persist after reorder/insert/delete elsewhere; repeated visit to one Stop gets a fresh invocation. A second Experience sees shared Camera updates with explicit reach while retaining its own order. |
| Atomic acceptance/undo | Capture+Presentation+Stop installs one result and one undo payload. Invalid last binding, whole-group duplicate collision, lock mismatch or upload failure installs nothing. No-op adds no history. Undo/redo restores all affected authored data/locks once, preserves unrelated source, uses fresh revision, truncates redo and respects the cap. |
| Cloud contention | Two writers with the same expected revision: exactly one wins; loser gets typed conflict and no new version. Missing revision rejects; retry returns original receipt; changed-payload retry refuses. Test transaction failure after version staging and before pointer update on real Postgres with zero skips. Distinguish publication/source revision and create-only collisions. |
| Motion/continuation | Forward/reverse authored timing, envelopes and interior Y survive; arbitrary seeks match Camera samples. Cut changes no topology; Travel gap never silently cuts or searches from Experience. Hold boundaries, explicit nonadjacent/End, Continue and detour return resolve by occurrence. All admitted exit Views are checked. |
| Session/handoff | Two previews/visitor sessions have independent clocks/choices. Free exploration releases guided control; rejoin evaluates from the actual current pose and leaves autoplay paused. Old arrival/cancel after new visit, replacement, source edit or Preview exit cannot advance order or clear the new output. Seek replays explicit ordered events/checkpoints and never guesses visitor history. |
| Accessibility | DOM nav/keyboard/pointer/touch have the same Activate meaning and reach; aria-current/progress are occurrence-derived. Info Panel focus-in/Escape/return, useful labels and links work without raycast. Reduced motion reaches the same destination without accelerated travel, and explicit media playback remains activation-safe if media is later admitted. |
| Real authoring | Selection alone never navigates. Capture/Update/Exit, Ask Rule reach, shared Default versus Stop-local entry/hold, one Guide context, path-point editing/refusal, paused edit lifecycle and one-step source Undo work on T1's host. Preview removes authoring chrome; exit preserves authoring identity and returns through Camera. Dense 20/50-View and 15/30-Stop fixtures test discovery/orientation, not product limits. |
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
gate keeps the complete contract, including heavy tests; S03 and S05 additionally record the
integrated caller/runtime journeys, root check/build, relevant package checks, full editor lanes
and check:api/test:api on a reachable DB with **zero skips**. A focused green run cannot accept
a gate. This planning-only change runs documentation and the whole arch lane; no product
behavior or DB acceptance is claimed here.

**Acceptance:** S03 makes the behavioral cutover gate ready only with exports, conformance,
independent acceptance and a real ancestor commit recorded in the global register. S05 accepts
the creator loop and all scoped migration obligations, with unresolved residuals named by owner.
One-Camera, one-order, current-format, visitor-isolation and source/session separation must all
hold. Refusals must be reviewable results with unchanged accepted state, not silent exclusions.

## 10. Owner/reconciliation decisions before work starts

- Approve this bounded phase and S01 scope; separately register the phase/provider/slice and
  ratify exact F2 interfaces. F1.reference must already be accepted at S01's trusted base.
- Reconcile the unit header/lock/resource shape with T2 and the shared reference shape with T1.
  Do not allocate two F2 providers because two tracks need units.
- Settle F4 provider/timing with T1: recommend the first complete provider at T3 under current
  ratification. An approved earlier T1 local provider must remain the sole provider of its gate
  version; T3 extends its shared interface after explicit scope/version reconciliation.
- Approve the named pre-baseline migration exception, covered source inventory, interaction-lock/
  station-hold policy mappings, quiescence/recovery and converter retirement. Accept the temporary
  unavailability of new-format publishing pending T4's prepared reader.
- Ratify only the needed F3 Camera handoff/session interface and bounded Continue/detour logic;
  accept T1.viewport-projection separately before S04. Later optional capability growth is not a
  reason to prebuild the full kernel.

**First implementation work, if approved:** T3.P01.S01 shared unit-envelope provider. If F1 is
not yet accepted, the first executable prerequisite is its agreed shared provider, not a local
T3 reference format. This proposal leaves all shared registers/contracts and implementation
unchanged and stops here for review.
