# T3.P01 — shared F amendment proposals

**Status:** draft for later reconciliation, 2026-10-14. These recommendations support the
[phase proposal](./README.md), not an independent contract. Names and @1 versions below are
candidate interfaces; no shared gate/version/provider is registered or ratified by this file.
Normative owner: [composition-execution.md](../../../reference/composition-execution.md).
Readiness owner: [gate register](../../README.md#gate-register).

## 1. Provider and readiness decisions

| Interface/cutover | Proposed provider | What acceptance establishes | What it cannot establish |
| --- | --- | --- | --- |
| F1.reference@1 | One reconciled shared provider; T1.P01.S01 is a separate candidate | Common qualified reference/resolution/revision context, admission and conformance | Every future domain resolver or T3 behavior |
| F2.unit-envelope@1 | T3.P01.S01, subject to T2 reconciliation | Shared header/envelope/lock interface, strict actual unit codecs and candidate preparation | Live Camera split, visitor order, history or migration activation |
| F4.intent-acceptance@1 | T3.P01.S02 under current ratification; reconcile T1 request before assigning | Common deterministic intent/result/undo, composed validation and actual local/cloud CAS conformance | Camera/Experience ownership retirement or Stage authoring readiness |
| F3.channels@1 | Shared provider allocation remains open; T1 proposes S01 | Typed channel/ownership/epoch negotiation sufficient for admitted families | Full scheduler, performances, arbitrary scripting or T3 cutover behavior |
| T3.camera-experience-cutover@1 | T3.P01.S03 | Live source/runtime ownership transition, all callers/writers migrated, deterministic atomic operations and visitor behavior | General F interface authority, T1 viewport or T4 prepared delivery |
| T1.viewport-projection@1 | T1 provider and acceptance | Public shared Stage/projection/input seam for authoring | Authored Camera/Experience units or T3's first compound result |

Shared providers are not consumers of their own outputs. Their first product consumer must
wait for accepted exact versions at the trusted base. S03 provides the T3 behavioral gate;
S04 consumes it and T1 viewport, declaring camera-authoring-migration. Do not make S03 depend
on itself or require viewport readiness for pure document/runtime work.

The separate [T1 draft](../../t1-spatial-world/t1.p01-stage-foundation/README.md) proposes an
earlier, local-only F4 provider, explicitly requiring a timing amendment. It is an unratified
proposal, not a prerequisite satisfied by this worktree. Current F4 says first implementation is the
Experience cutover. **Recommendation:** keep T3 as the first complete provider, let T1 consume
it, and avoid an interim current-source acceptance adapter unless its capability value
justifies an owner amendment.

If the owner instead approves T1's early provider, retain one provider per gate major version
and one shared operation/result/history implementation. Reconcile its revision interface now
so cloud support/unit locks do not require a private T3 token. T3.P01.S02 becomes the compound/
cloud adapter extension slice, not a second provider claim. A compatible extension retains the
major and records expanded conformance/acceptance; incompatible revision or result semantics
require a new F major row and consumer re-declaration. A local-only acceptance record cannot
serve as proof of cloud CAS or cross-domain acceptance; those remain required by the behavioral
T3 gate. Resolve exact provider/extension readiness before either phase's slice register becomes
active. No local plan edits the shared gate register to make itself eligible.

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
| ProjectRevision = {projectId, revisionId} | Exact opaque identity for one accepted snapshot. Compare equality only; never infer currency from a label/date/publication version. Every successful source change, including undo, gets a fresh identity. |
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

## 4. F.4 intent, result, CAS and history draft

The common interface must serve Layout/Scene/Camera/Experience adapters without normalizing
all domain planners to the same internal algorithm. Domain-specific planning outputs are
wrapped at shared coordination. Common results are typed values, not thrown-only diagnostics.

| Proposed value/operation | Required interface semantics |
| --- | --- |
| AuthoringIntent = {formatVersion, operationId, kind, expectedRevision, targets, payload, capturedInputs} | Registered intent kind/version, one ProjectRevision, qualified targets, serializable typed payload; includes allocated IDs and sampled/pinned external inputs. No random/time/network/Three/closure read during planning. |
| prepareIntent(snapshot, intent, capturedResourceSet) | Pure deterministic candidate preparation against the exact expected snapshot. Returns candidate unit/lock changes and correspondence/diagnostics or typed refusal. Does not install state, upload bytes or emit visitor effects. |
| validateComposedCandidate(candidate, context) | All affected/preserved domain validators, cross-domain references/capabilities and lock/resource checks. Structural validity and permitted repairable authored bindings differ from selected-program executable closure. |
| acceptIntent(store, intent) | Exact revision CAS, composed validation and one snapshot install/metadata commit. No per-domain installation. Local and server adapters share operation semantics, diagnostics and strict precondition. |
| AcceptanceResult | accepted {operationId, beforeRevision, afterRevision, snapshot, changes, correspondence, undoResult}; no-op {operationId, revision}; rejected {operationId, code, expectedRevision, actualRevision when authorized, diagnostics}. Unknown/stale/unauthorized/invalid/resource-failed kinds are distinct. |
| UndoResult | One validated source-content before/after payload and resource-lock restoration data for the whole accepted operation, labelled by source action. Runtime-only history metadata, never part of authored unit data. |
| Undo/Redo intent | Targets one available chronological entry against the current expected revision; runs normal validation/CAS and installs once with a fresh revision. Does not rewrite old remote history or privilegedly assign an old revision. |

Allocate IDs and capture Camera pose/projection/aspect, resource definitions/pins and explicit
scope/migration decisions before evaluation. Revision identity creation must also be reproducible
from accepted context and captured operation identity, or supplied as an explicit captured grant;
never allocate a random revision inside a supposedly pure planner. Different operations yielding
the same source contents still have different accepted revision identity. No-op detection compares
canonical authored contents and locks before revision bookkeeping, so harmless allocation does
not itself manufacture an edit.

First compound kinds:

- CapturePresentation: captured Camera View + new/existing Presentation binding, optional new
  Stop/Guide insertion. New identities and insertion anchor are explicit; index is not identity.
- EditStop/ReorderStops/RepeatStop: occurrence-local fields/order edits; Repeat allocates a new
  Stop referring to the same Presentation, rather than cloning View geometry.
- EditCameraSupport: domain-valid View/Connection/interior-anchor/timing edit with disclosed
  shared reach and composed reference/continuation checks.
- CreateProject/ReplaceProjectSource: explicit captured source
  and complete validation; create has a create-only condition, replacement expects the current
  revision. These do not form an unrestricted stale full-document Save bypass.

Intent registration is extensible. Unsupported kinds fail explicitly; human UI and agents
cannot bypass the same adapters with raw document assignments. Group/duplicate operations
validate together, including final ID collisions and downstream reference effects.

### Local versus cloud preconditions

Use one opaque source revision type across local/server coordination. Host session epoch
qualifies callback installation/gesture lifetime separately and is not a fake durable cloud
revision. Reconcile T1's proposed combined local epoch/sequence/content token into this common
source-revision plus host-lifetime arrangement, or agree an equivalent tagged shape before
ratification; T3 cannot accept a private token just because the earlier provider is local.

Cloud source revision must be stored/returned with each saved envelope and matched under row
lock before any new version is appended. It is distinct from SQL version number and P22
expectedPublicationRevision. Missing revision, unknown source epoch or old client format returns
a typed rejection. A second writer with the same expected revision loses the CAS, even if its
document looks valid. Full-document PUT without that precondition is retired at activation.

Staged bytes/metadata are prepared before the short SQL transaction. Revalidate staged resource
tokens/pins and revision when committing. Any failure rolls back all unit/lock/version-pointer
changes; orphaned staged bytes are collectable, not installed dependencies. No fictitious atomic
transaction spans SQL and object storage. Ownership checks preserve not-found/unauthorized
privacy; do not expose another owner's actual revision in a conflict receipt.

One cloud-backed editing session uses the server as accepted authority; local provisional
geometry is not an independently accepted branch. Local-only projects use the same coordinator
in memory and can create/import into cloud explicitly. Offline branch/rebase/merge semantics are
deferred and must not appear as silent Save behavior. A source replacement/new load invalidates
old session callbacks/history context through the shared M5 guard.

Propose operation receipts outside source for retry idempotency. Look up an identical already
accepted operation before treating its old expected revision as a new stale request; return the
original receipt, without a duplicate acceptance. Payload mismatch or expired/unavailable
receipt requires explicit conflict/recovery, never a blind repeat. Receipt installation in the
client still checks its current session epoch/revision lineage.

### History mechanism and closure

Propose a 100-entry chronological snapshot history with whole-operation undo payloads, labelled
source actions and redo truncation. No source edit/history entry on no-op/refusal/cancel/stale
revision. History is runtime coordination; cloud receipts/project_versions are separate durable
metadata. This choice does not ratify CRDTs, selective actor undo, automatic rebase or a general
op log. An immutable source restoration changes the current revision even when its content is
identical to an older snapshot, preventing ABA acceptance of an old writer.

Composed authored validity can accept explicit repairable bindings supported by the domain.
Preview disables/refuses affected required behavior with a diagnosis; selected release execution
requires closure. Required execution never interprets unresolved as keep-viewpoint, skips a Stop,
matches a name, drops content or auto-creates a Camera edge. F4 acceptance alone is not publication.

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

This is a small execution contract, not the full future expression/channel engine. Exact
family/operator/program-slot spellings and conformance must be ratified in shared F code before
S03. If T1's F3 gate includes only inspection, expand its declared compatible interface and
accept the required conformance before T3 consumes it; do not claim inspection acceptance
already proves guided/Preview handoff. Broader unsupported required behavior fails explicitly.

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

Ratify F1 identity extension, F2 header/envelope/lock and bounded unit admission, F4 revision/
intent/result/undo and cloud mode, and the needed F3 run/handoff/session shape. Ratify the
pre-baseline conversion exception separately. Register/accept the behavioral T3 gate from real
retirement and visitor/acceptance evidence, not from this F text. F5 prepared delivery and
source-backed P22 retirement remain coordinated with T4; no release interface is minted here.

Stop before implementation. The next reviewable action is approval/reconciliation of S01's
shared F2 provider and its F1 prerequisite, not construction of a local Experience schema or
changes to normative F/reference documents.
