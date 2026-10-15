# T3.P01 — shared F amendment proposals

**Status:** draft for later reconciliation, 2026-10-14. These recommendations support the
[phase proposal](./README.md), not an independent contract. Names and @1 versions below are
candidate interfaces; no shared gate/version/provider is registered or ratified by this file.
Normative owner: [composition-execution.md](../../../reference/composition-execution.md).
Readiness owner: [gate register](../../README.md#gate-register).

## 1. Provider and readiness decisions

Use the [coordinated allocation/readiness/DAG proposal](https://github.com/Biskiq/spatial-sketch-editor/blob/codex/t1-stage-proposal/docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/cross-track-reconciliation.md); it is pending ratification,
not a shared authority or accepted dependency. Sole proposed providers: **F1/F3 T1 S01; F4 T1 S03;
F2 T3 S01; F5 T4 S02**. T3 extends the same F4 implementation; no competing gate provider.

The early timing amendment permits registered local Layout/Scene acceptance and conditional Save
before Experience. First compound View/Presentation/Stop acceptance remains T3. Ratify a source-
independent common interface before implementing it; keep AcceptedRevision, content digest and host
epoch separate. T1 local acceptance never proves cloud or compound readiness.

T3 S01 supplies F2 unit-envelope-v1, F1 unit-resolution-v1 and the shared ExecutionProgram codec.
T3 S02 independently extends F4 with conditional-save-current-v1 after local-single-domain-v1.
T3 S03 adds unit-acceptance-v1, conditional-save-units-v1 and F3 camera-handoff-v1 against candidate
source/runtime fixtures. T3 S04 consumes those preaccepted scopes and provides the behavioral
camera-experience-cutover gate. S05 authoring consumes accepted viewport plus cutover and declares
camera-authoring-migration; S06 integrates. No self-consumed provider output or viewport prerequisite
for pure/runtime preparation. All starts wait for the separate r186 upgrade to close and land.

The current register/checker does not enforce capabilities. Proposed minimal amendment:
Accepted capabilities on a gate row, linking scoped conformance/acceptance/commit records, and
Requires on a slice row naming exact gate/capability pairs. Each required scope and prerequisite
closure must be accepted at trusted base as well as current HEAD; a consumer cannot add its own
readiness. Pending scopes are not accepted entries. One gate/version retains one original provider;
extension slices are recorded only as capability contributors. Install enforcement in authorized
T1 S01 after owner ratification. This PR edits no live register/checker.

Optional kind/family/source-adapter additions keep a major only when existing required semantics
are preserved; breaking revisions/results/coordinates/lifecycle needs a new major and consumer
re-declaration. An accepted local record cannot stand in for later scopes. Source formats themselves
change explicitly at S04: current root → envelope 1, Scene 1 → Camera-free Scene 2. Current-source
normal adapters retire with all callers; no permanent dual-format protocol.

## 2. F.1 consumer reconciliation

Reuse the agreed SemanticReference/ResolutionResult, not a T3 destination ID format. T1's
candidate includes domain, revision context, subject kind/ID, stable instance path, location
qualification and optional component/capability. Reconcile actual field spelling and version
once in F/shared code. T3 requires:

- Camera View, Connection, authored anchor/View-key station; Experience, Presentation, Guide,
  Stop and authored View-use identities; existing canonical Scene subjects and resource kinds.
- Project-lock references resolve against the supplied accepted envelope/lock, never ambient
  latest. Exact references report concrete revision and do not silently float.
- Each Stop and addressable View use keeps stable authored identity. Runtime visit/run identity
  is separate and session-only. Order lists contain IDs, never positional references.
- Missing/removed/incompatible/unauthorized/repair-required results preserve original identity.
  Intentional keep-viewpoint is an explicit policy, not a null/missing View resolution.
- Generated route endpoints/samples cannot become durable source station references. A Camera
  station reference names its Camera-owned stable key/anchor or a declared depart/arrive role
  qualified by Connection and direction. Station progress is resolved by Camera, not stored as
  a second time/position authority in Experience.

These are necessary kind/resolver extensions to the common interface. The gate can be accepted
with bounded supported kinds and explicit unsupported results; kind spelling is not silently
ratified here. Public semantic-address/release context stays on the F5/T4 route.

## 3. F.2 header, envelope and lock draft

Proposed shared values are serializable and immutable. Strict field validation includes unknown
keys, finite/range checks, supported format/kind versions, uniqueness and referential structure.
No generic object bag that admits hidden domains or renderer/session state.

| Proposed shape | Required meaning |
| --- | --- |
| AcceptedRevision = {projectId, revisionId} | Exact opaque identity for one accepted snapshot. Compare equality only; never infer currency from a label/date/publication version. Every successful source change, including undo, gets a fresh identity. |
| UnitHeader = {domain, unitId, formatVersion, contentRevision} | One stable codec unit identity per admitted domain; explicit supported domain format; immutable content identity over canonical domain payload. A header/payload version mismatch rejects. |
| DomainUnit = {header, data} | One domain-owned validator/codec/evaluator boundary. Physical files/tables are not prescribed. |
| ProjectEnvelope = {formatVersion, id, name, acceptedRevision, dependencyLock, units} | Explicit envelope version, project identity/name, revision belonging to that project, complete lock and exactly one Layout/Scene/Camera/Experience/typed-resource unit. Experience and resource payloads are collections; one unit does not mean one Experience/resource. |
| DependencyLock = {formatVersion, entries} | Deterministic set keyed by qualified identity/instance scope. Each resolved dependency records exact unit/resource content revision and required capability/version; external bytes additionally pin hash/MIME/size/immutable locator as applicable. Duplicate/conflicting pins reject. |
| UnresolvedBinding | Typed authored diagnostic retaining the original F1 reference and repair status in the owning domain. An unresolved external binding is not a fabricated resolved lock pin. Executable closure distinguishes it from structural/schema failure. |

Propose envelope format 1 and initial Camera/Experience/resource unit format 1, retaining
Layout payload version 5. Scene's Camera-free payload needs a deliberate new version (propose
2), not changed meaning under today's Scene version 1. Agree unit header versus nested payload
version representation once; if both are present they must agree. The canonical source-content
digest excludes acceptedRevision and session/history/receipt metadata, avoiding a self-hash
cycle. Unit contentRevision hashes only canonical domain data. Dependency identity and ordering
are canonicalized explicitly; display order is retained where it has authored meaning.

Domain-owned v1 content recommendations:

| Unit | Bounded content and rules |
| --- | --- |
| Layout | Wrap the strict current wall-first document. No Wall-role/level/schema redesign in T3. |
| Scene | Preserve current object/material/light/world facts; remove navigationNodes/connections and their validation/evaluation ownership. Reconcile admitted texture/resource reference conversion with T2. |
| Camera | Stable Views and Connections; fixed View pose/framing/projection first; intrinsic directed duration/easing, view tracks/envelopes, target/path facts and interior anchors. Preserve IDs on extraction. Connections are authored connectivity; derive adjacency for structural kernel inputs instead of introducing another adjacency writer. No next/previous/detour/lock/node-hold fields or Guide route cache. |
| Experience | Experiences collection. Each Experience owns Presentations, Experience-wide Interactions, optional Guides, typed session declarations and visitor Content/UI meaning. Presentation owns subject references/View uses and explicit Default role; Guide owns Stops and one ordered Stop-ID list. Stop references a Presentation and has supported local entry/View progression/holds/continuation. No first-class Destination record or pose/path copy. |
| Typed resources | Initially admit only resource kinds needed for the existing project texture/asset family, with stable IDs, immutable revisions and verified pins. Scene owns material/sampler/use facts; byte/resource identity is not hidden in Scene. Empty registry is valid only when no dependency requires a resource. No generic import/component/performance registry or fake P20 pin. |

An asset's DB row version, mutable URL or asset ID alone is not an immutable resource pin. Capture
verified metadata/bytes or a reproducible builtin/procedural definition before planning. If
availability is unknown, preserve an explicitly unresolved binding where allowed and refuse
required execution. Do not claim an asset-bearing migration has a closed empty lock.

Minimum authoring states: no Presentation, Presentation with no Views, unset Default,
intentional keep-viewpoint, unresolved View, no Guide, repeated Stops, several Guides and
several Experiences. A Presentation can concern a subject, region or environment without a
mandatory object species/Room container. UI concentration on one Experience does not narrow
the persisted cardinality.

### Experience order and continuation draft

One Guide ordered Stop-ID list is the default sequence authority. Stops live as keyed records;
their IDs survive list edits. Explicit continuation is a tagged policy: sequence-next,
specified Stop, End or supported return-to-origin. Explicit targets refer to stable occurrence
identity and can be nonadjacent; the resolver reports ready/gap/needs-repair/End. Derived
previous/next labels and progress are caches only and never persisted writers.

Entry policy distinguishes explicit View-use, shared Default, Stop-local included/progression
uses, keep-viewpoint and unresolved binding. A View use references Camera, carries an authored
use ID and role/context, and copies no pose. Hold duration is finite/nonnegative Experience
context; source station holds use qualified Camera station references and invocation time
mapping. Duration/easing intrinsic to Camera motion remains Camera-owned. Unsupported policy
kinds reject rather than pretending default-next covers them.

Continuation invokes either Cut or Travel. Travel support names a Camera connection/direction
or asks Camera for a supported spatial route between resolved Views; Camera owns deterministic
route selection. The resolved route is runtime-derived and not authored Experience geometry.
Direct-edge mappings from legacy ordered links never silently become another BFS route when
their support is removed. Cut needs a resolved target View but no Connection. Reorder/entry
change prepares a composed candidate and recomputes support for all admitted origin Views.

Existing-data conversion is a named pre-baseline exception, not a common multi-format decoder.
The [phase conversion matrix](./README.md#6-conversion-and-refusal-matrix) owns coverage/refusal;
the original input, mappings, policy choices, staged pins and exact legacy migration baseline
are captured inputs to one administrative conversion request. The baseline carries project ID,
canonical source-content identity and stored version when cloud-backed; the old document has
no F4 accepted revision, so none is fabricated. The restricted converter establishes a fresh
new-format baseline with one CAS commit and a source/deployment recovery handle. It is not
normal source Undo into an unsupported schema. No separate Camera-first migration is allowed.

## 4. F.4 intent, result, conditional Save and history draft

Reuse the [T1 common source-independent signatures](https://github.com/Biskiq/spatial-sketch-editor/blob/codex/t1-stage-proposal/docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/interfaces.md#f4-intentrevisionresult-and-early-local-foundation--s03-provider).
AcceptedRevision is opaque project/revision identity, content digest compares canonical authored
source/locks, and SessionEpoch guards host callbacks. No required common method exposes today's
ProjectDocument or mandates F2 storage; domain/source adapters own full validation and candidates.
F4@1 remains one implementation with registered planners and exact capability admission.

| Capability / slice | Required meaning and conformance |
| --- | --- |
| local-single-domain-v1 / T1 S03 | Registered Layout or Scene operations over current source, one snapshot/Undo, full current validation, immutable unchanged Camera/resource context, stale/no-op/refusal/ABA proof. Compound/unit/resource mutation refuses. |
| conditional-save-current-v1 / T3 S02 | Capture local accepted source/revision/digest and create-only or expected-saved-base condition. Atomic server ownership/OCC/full-validation/append; idempotent receipt; explicit dirty/conflict behavior. No F2 or Stage prerequisite. |
| unit-acceptance-v1 / T3 S03 | F2-backed single-domain and real Camera View + Presentation + optional Stop compound operations; complete reference/lock validation and staged admitted resources; whole-operation Undo/rollback. Candidate-only before S04. |
| conditional-save-units-v1 / T3 S03 | Same Save semantics with F2 adapter/full lock validation and real-DB conformance. New source admission activates only at S04, retiring the current adapter. |

### Local acceptance and conditional persistence

`AuthoringIntent@1` carries registered kind/version, operationId, expected AcceptedRevision,
qualified targets, typed payload and captured inputs. Pure preparation allocates nothing implicitly;
revision grants/IDs/resource pins/sampled Camera pose/aspect are captured before evaluation. Domain
planners keep specialized algorithms. Composed validation checks affected/preserved domains,
references and locks, distinguishing repairable authored state from executable closure.

`AcceptanceResult@1` is accepted with before/after revisions, snapshot facade, changes,
correspondence and one undoResult; no-op with unchanged revision; or rejected with typed diagnostics
and authorized actual revision. One immutable install occurs after all validation. Local operations
use this same boundary regardless of lens; no raw direct source assignment or separate domain history.

`SaveAcceptedSource@1` captures an immutable locally accepted source/revision/digest, source-kind/
version, stable operation ID and `create-only` or `expected-saved-base {token}` precondition. A source
adapter validates this capture through shared coordination, not a parallel cloud document protocol.
Under the owned project transaction, the server compares the durable saved-base token, runs the full
source/domain/reference/lock validation and atomically records the captured revision/contents plus
new saved-base token. Initial create fails on collision; update with missing/stale token fails before
append. The pre-F2 revision/token lives in persistence metadata, not today's strict source JSON.
F2 stores the captured accepted revision in its envelope. SQL version ordinal and publication OCC
are distinct from all of these identities. The server recomputes the canonical source digest and
rejects accepted revision identity reused for different contents. Source format is negotiated explicitly.

The editor keeps local accepted work and one history, with dirty/saving/saved/conflict states.
A response acknowledges only the captured source revision/digest; newer edits stay dirty. Old-session
responses cannot install or mark source saved. Save does not create an authoring Undo entry or a new
cloud history. Divergence preserves local work and remote data pending reload/explicit resolution;
no automatic merge/rebase or requirement to execute every edit on the server.

Look up stable retry receipts before treating the original saved-base token as a new stale request:
identical capture returns the original saved receipt without another version; changed payload rejects.
Ambiguous network outcome is resolved through the receipt. Keep receipts outside source; authorize
before revealing stored state. Staged bytes are verified before the short transaction and checked
again with revision/lock metadata; failures roll back source/version/pointer changes, with orphaned
bytes collectable. No distributed transaction across SQL and object storage is claimed.

S02 replaces unrestricted legacy PUT with current-source conditional admission. S03 proves unit
admission inactive; S04 quiesces, converts once and switches readers/writers/callers to that adapter.
There is never a live format-sniffing Save fallback. In-progress T1/T2 consumers re-declare already
accepted unit capabilities; do not consume current-only Save after its adapter retires.

### Compound operation and history scope

Explicit Experience creation/select precedes first capture; any combined creation captures the
Experience identity and all other IDs before one compound acceptance. Never infer an Experience
from a source array or fabricate one during release lowering.

First unit operations are CapturePresentation (View + Presentation + optional Stop), occurrence
edit/reorder/repeat and Camera support edits with composed shared-reach checks. IDs/insertion anchors
are captured, never array-index identity. Existing Layout/Scene operations migrate unchanged in
meaning. No full component/performance/import framework is implied by admitted resource staging.

Use one 100-entry chronological snapshot history for whole accepted source operations. Compare
canonical authored contents/locks before revision bookkeeping. Undo/Redo validates against current
revision, installs once with fresh identity, preserves unrelated contents and truncates redo after
new edits. No-op/refusal/cancel/stale adds nothing. An administrative schema conversion creates a
new baseline plus retained recovery handle, not a normal Undo entry into unsupported old source.

Conformance scopes are separately accepted under the proposed readiness amendment. Initial local
acceptance must never authorize unit/resource/compound/cloud use. Required unresolved behavior is
not keep-viewpoint, a skipped Stop or an auto-created Camera edge. Publication requires closure.

## 5. Minimal F.3/session amendment needed by cutover

Reuse shared typed addresses, value families and run epochs. Propose the Camera output family
with exclusive ownership and **declared** handoff/replacement among inspection, guided motion,
free look, Follow and Preview. Camera evaluates pose/framing/projection and owns endpoint
realization; input/host/Experience controllers supply intent and explicit policy/time. A stale
run can neither clear nor reclaim a newer contribution. Unsupported competing ownership
rejects by default. No generic channel setter interpolates Camera pose/FOV outside Camera.

An Experience invocation holds session identity, Stop/View-use context, accepted run epoch,
explicit clock and ordered events. A bounded reducer handles Activate, DestinationReached,
Continue, Explore, Rejoin, ChooseDetour, Cancel and End. Propose only typed boolean/choice
declarations actually needed for availability/Continue/return policy, explicit initial/reset
scope and permitted writers, plus side-effect-free literal/state-read/equality/conjunction
guards. State transitions/effects are explicit reducer outputs. Repeated invocations and
independent sessions do not reuse lifecycle identity. No arbitrary creator script or inferred
Once/FirstVisit history is admitted by naming an event.

This is a bounded execution contract, not a general expression/channel engine. T3 S03 adds
`camera-handoff-v1` under the common F3 protocol before S04 consumes it; the original F3 provider
stays T1 S01. Initial inspection acceptance does not prove guided/Preview handoff. T3 S05 proves
real public-Stage integration and exact capture aspect, using the same role-negotiated output
acquire/request/replace/return/cancel tickets and operation-specific gesture transition host.

### Shared ExecutionProgram and F5 profile

T3 S01 supplies the proposed runtime-safe `ExecutionProgram@1` codec, separate from authoring
validator imports; T3 S03 implements its sole semantic lowering/interpreter. It is derived from
accepted Experience/Camera/source identities, not another editable Guide/order format. T4 S02
imports that codec for F5 program slots; T4 lowering and editor Preview both invoke T3's shared
semantic lowering/evaluation. Delivery validation remains independent of source codecs/compilers.

Required fields: kind/version and required capabilities; selected Experience/entry and labelled
Presentation/content records; stable Stop occurrences and Camera invocation bindings; typed scoped
state declarations/initial/reset values; finite local-time/hold mappings; bounded guard expressions;
channel policies; and run-scoped lifecycle/actions. Declare empty cases explicitly. No copied
Camera pose/path/graph, renderer object, source selection/history or arbitrary executable code.

Bounded v1 semantics include distinct Presentation/Stop/visit-run identities; Cut; supported Travel
with directed Camera timing; sequence-next, explicit Stop/End and covered return-to-origin;
nonnegative holds/Continue; text Info Panel, ShowContent/NavigateTo/OpenUrl with real activation
rules; boolean/choice state and literal/state-read/equality/conjunction guards; exclusive Camera
handoff; explicit enter/arrival/complete/cancel events; reduced motion and semantic DOM navigation.
The same required instruction has identical meaning in Preview and publication. Unsupported required
program/state/operator/profile refuses. Later optional kinds extend the declared codec/profile with
accepted conformance; changed existing meaning requires a versioned cutover.

Non-empty shared codec/trace fixtures exercise repeated Stops/runs, initialization/reset, guard
failure, finite hold/Continue, directed Travel/gap, Cut and stale handoff cleanup. T4 owns immutable
packaging, closure and delivery, not another Experience interpreter. General media, arbitrary guards,
new motion kinds, branch-rejoin authoring and path-edit UI remain follow-ons, not empty reserved
fields pretending to implement F's minimum. Program clocks never own a second Camera sampler.

Experience's clock inserts holds/continuation over Camera motion; it never integrates an
independent pose path. Reduced motion cuts/minimizes motion through Camera to the same resolved
semantic destination. Seeking an existing run replays events/restores an explicit checkpoint;
random-access Camera sampling alone cannot infer an unrecorded visitor choice/hold history.

## 6. Review/ratification checklist and stop point

Reconciliation needs actual consumers from T1/T2/T3/T4, one owning F amendment anchor per
interface, sole provider/version assignment, domain validator ownership, shared export paths,
conformance scope and required/optional negotiation. This draft intentionally names no fake
export/test/acceptance artifact as existing. Put those paths in the global register when real
implementation and recorded evidence exist.

Ratify F1 identity extension, F2 header/envelope/lock/program codec and bounded unit admission,
F4 source-independent revision/intent/result and local-edit/conditional-Save mode, the scoped
readiness amendment, and the needed F3 run/handoff/session shape. Ratify the
pre-baseline conversion exception separately. Register/accept the behavioral T3 gate from real
retirement and visitor/acceptance evidence, not from this F text. F5 prepared delivery and
source-backed P22 retirement remain coordinated with T4; no release interface is minted here.

Stop before implementation. The next reviewable action is approval/reconciliation of S01's
shared F2/program provider and its accepted F1/F3 prerequisites after r186 closure, not construction of a local Experience schema or
changes to normative F/reference documents.
