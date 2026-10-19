# Composition and execution foundation (F) — target contract

**Read when:** designing identity/reference, persisted domain units, typed
channels or representation parameters, cross-domain acceptance, typed session
declarations, or a release envelope; deciding whether a proposed format belongs
to the common foundation.

**Status:** ratified target contract. The owner-ratified decision record
([`decisions/northstar-ratification-2026-09-27.md`](./decisions/northstar-ratification-2026-09-27.md)
§§5–6, §10) settles F.1–F.5's shapes; this document writes them. F.1–F.5 were
written 2026-09-27 and **owner-ratified 2026-09-27 with amendments (Camera
cutover timing, interface ownership, required/optional extensions).** The exact interfaces
AM-1–AM-8 below were **owner-ratified 2026-10-15**
([decision record](./decisions/f-ratification-2026-10-15.md)). AM-9 (the Camera/Experience cutover)
was **owner-ratified 2026-10-19** ([decision record](./decisions/t3-cutover-ratification-2026-10-19.md))
and supersedes AM-7, which is retained as superseded provenance.

**Owner-directed [reconciliation amendment](./decisions/world-experience-reconciliation-2026-09-29.md), 2026-09-29:** F.1 distinguishes
Presentation/Stop/visit identity and repairable authored bindings; F.2 names
the Experience composition shape; F.3 permits declared replacement/handoff
without changing default exclusive rejection; F.4 separates authored validity
from executable closure; session events are run-scoped; F.5 names Presentations.
These are later refinements, not claims about the September 27 record.

**Implementation: none of this contract is shipped.** Each
section labels current behavior where a cutover applies; current encodings are
cutover obligations, not limits, and the destination is never presented as
shipped.

**Authority and scope:** normative for new design. This contract owns the common
cross-domain shapes; domain contracts own the meaning and validity of their own
data. It does not replace domain contracts or the semantic authority table in
[`architecture.md`](./architecture.md). Byte encodings, containers, algorithms,
kernel substrate and module boundaries stay implementation decisions
(§Open mechanisms). Exact cross-domain interfaces — reference and resolution
result, unit header, project envelope, authoring intent with expected revision,
release manifest — follow this ownership rule: the first consumer that needs an
interface **drafts it in its plan, but the interface is ratified as an explicit
amendment to this contract and lands in shared code**, never in phase-local
code. Parallel tracks reuse the ratified interface; none may mint its own.

**Why this exists before capability planning:** machinery can grow one consumer
at a time; formats cannot. A phase that mints its own references, units,
channels or acceptance path creates exactly the pairwise reconciliation this
foundation prevents. Consumers must share these formats from their first new
persisted or cross-domain implementation. F is bounded contract-writing, not
another architecture research cycle and not a requirement to implement the
complete kernel.

## F.1 Identity and reference

A durable reference identifies meaning, not a location:
**domain qualification + revision context + stable subject identity + stable
instance-ID path + component/capability**. Names, indices, display labels and
mutable hierarchy paths may locate data within one revision; they never
establish identity across revisions or re-exports.

- **Stable internal IDs.** Every addressable subject, component, occurrence,
  resource and location a reference can name has a stable identity distinct
  from its display name. Instance-ID paths stay stable through edits that
  preserve the instance.
- **Revision context.** A reference names either an exact revision/content
  identity or a project revision context carried by the dependency lock. No
  hidden “latest” is embedded in a persisted reference.
- **Generation-qualified fragments.** Generated/derived fragments carry a
  generation qualification and a mapping back to their source identity; they
  are not valid durable substitutes for source identity.
- **Layout multiplicity.** Level, structure and instanced-definition
  qualification exists before vertical architecture expands; a reference that
  cannot express its level context is not durable for multi-level Layout.
- **Experience/occurrence identity.** Repeated guided placements are distinct
  Stop occurrences with stable authored identity; a Stop identity persists
  across revisions while that authored occurrence persists, even if its
  Presentation or referenced subject becomes unresolved. Editorial order never
  lives as a second writable authority beside legacy node links.
- **Presentation, Stop and invocation are distinct.** A Presentation names
  reusable Experience composition, a Stop names one authored Guide occurrence
  referencing it, and each actual visit has a session invocation identity.
  Repeated visits to the same Stop are separate runs; runtime lifecycle cannot
  be keyed solely by Presentation, Stop or authored-use identity.
- **Resources.** Inline project-local, library-hosted and vendored resources
  use the same identity semantics. Identical immutable bytes in two packages
  are delivery copies of one revision, not competing mutable definitions;
  detaching for independent editing creates a new authored identity.
- **Public addresses.** A public address names a publication or pinned release
  plus a durable semantic location keyed by subject/occurrence identity.
  Republishing preserves locations while their subjects persist; removal or
  incompatible replacement returns an explicit result (removed/orphaned/repair
  required), never a silent redirect by name or position. Each resolved result
  records its concrete release context.
- **Resolution results.** Every reference either resolves or returns an
  explicit, typed result: missing, removed, incompatible, unauthorized, or
  repair-required. Silent fallback by name, index or nearest match is not a
  resolution.
- **Repairable authored bindings.** Validation can accept an explicitly
  unresolved subject, capability, View or resource binding as authored state,
  with its original identity and repair result intact. It never silently
  retargets by name, proximity or Room containment, nor deletes the affected
  Presentation/Stop. An intentional keep-current-viewpoint policy is distinct
  from a missing View. Executable closure is a separate check (§F.4–F.5).

**Current behavior (until T2/T3 cutover):** references are plain asset IDs and
object IDs within one `ProjectDocument`; P22 publication addressing is keyed by
publication position/version, not durable semantic identity.

**Extension point:** reference kinds, each declaring target scope, validation
and resolution/repair semantics.

## F.2 Persisted units and the project envelope

The project envelope contains the **accepted project revision**, the
**dependency lock**, and one **codec-bounded, versioned unit per semantic
domain**. The envelope is coordination, not another domain authority.

Units: **Layout** · **Scene** · **Camera** · **Experience** (collection-capable)
· **typed resources**. A project may contain several Experiences over one
shared world.

Unit contract:

- Each unit has one codec boundary, an explicit version, and one validation
  entry; current-format validation is strict.
- Unit and envelope interfaces (unit header, project envelope, reference and
  resolution result) follow the interface-ownership rule in §Authority and
  scope: the first consumer drafts, this contract ratifies the amendment, and
  the implementation lands in shared code.
- A unit's format answers only for its own semantic domain. Cross-domain
  references resolve through F.1, and cross-domain validity is composed in F.4.
- Version negotiation is explicit: a reader supports a declared version or
  fails explicitly. Before the Source Baseline, development formats may change
  without accumulating historical readers; a named pre-baseline migration
  exception requires a documented product reason, covered data, validation,
  recovery and retirement criteria
  ([`north-star.md`](./north-star.md) §Release and Source Baselines).
- Codec boundaries prescribe neither database tables nor physical files nor one
  blob per resource; storage is implementation.

**Camera's codec boundary — decision (F.2, owner-ratified):** Camera is its
**own codec-bounded unit in the project envelope** (the separate-unit choice).
Camera is a never-merged authority whose evaluation and format must version
independently of Scene. The co-location is only shared storage, not a semantic
link: in `packages/project-model/src/scene.ts`, Camera data (`navigationNodes`,
`connections`) references only other Camera nodes plus world positions/targets
— no Scene entity references — so separating it is a low-cost move with no
cross-reference rewrite. The **split lands in the same cutover as the
Experience order cutover** (`nextNodeId` / `previousNodeId` / `holdSeconds`
leave Camera nodes; legacy `lockInteraction` is migration input to explicit
Experience Gates, continuation or interaction policy): one migration of
`navigationNodes`, not two. The **landed current encoding remains Camera data
inside `project.scene`** until that cutover; the co-location is a cutover
obligation, not the destination.

The Experience unit is collection-capable and owns Presentations,
Experience-wide Interactions and optional Guides whose Stops reference
Presentations. “Destination” denotes a navigation target/address role, not a
second authored entity. Camera owns View, route and projection truth; an
Experience invocation stores references and context, never a duplicate Camera
graph or pose/FOV authority. A read-only legacy order adapter may assist the
cutover; two editable order systems may not coexist.

**Typed resources** retain their identities whether inline, library-hosted or
vendored, with immutable revisions and a project dependency lock. Resource
storage is shared; semantic authority stays specific to each resource kind.

**Extension point:** domain admission. A new semantic domain declares its
authority, F.1 conformance, persisted codec unit, validation, channel
families/operators, evaluator and release lowering, effects, and conformance
fixtures — then gets its own unit. Never hide a new domain inside an existing
document merely because it has storage space.

**Current behavior:** one `ProjectDocument` holds separately owned
`LayoutDocument` and `SceneDocument` domains with Camera data inside Scene;
cloud saves append versions under a row lock but take no expected-revision
precondition. The destination units are **designed, not implemented**: their
exact shared envelope, unit-header, dependency-lock and unresolved-binding
interfaces are ratified in AM-2, while no unit codec, reader or writer exists and
the current encoding stays until the T3 cutover. A designed contract is not
shipped code.

## F.3 Channels and representation parameters

A channel address names a writable/evaluable value:
**instance → component → capability/property → frame**. Each address carries a
typed value: type, units, allowed range, scope, interpolation, and
domain-owned composition operators.

- **Domain-owned meaning.** The owning domain defines what a channel means, its
  type/units/range and its operators. The common contract owns addressing,
  binding, dependency, conflict and invalidation rules.
- **Representation parameters are channel-addressable semantic values** (cut,
  depth, peel, lift, reveal and related inspection parameters). Layout
  evaluates architectural representation from its canonical output; Camera
  evaluates viewing intent; editor/session recipes assemble these values without
  owning their domain meaning. Representation evaluation is runtime-safe
  Layout-owned code from its first implementation.
- **Authored baseline vs runtime contributions.** Authored override precedence
  computes the instance baseline (definition defaults → selected variant →
  allowed instance overrides); it does not decide runtime contention. Active
  states, performances and inspection supply contributions to declared channels.
- **Conflict rules.** Competing exclusive control is rejected by default; blend,
  additive offset, replacement or handoff is allowed only for channel families
  that define it. Transform multiplication is ordered and frame-specific; camera
  pose, categorical variants, visibility and material values use their
  domain-specific rules. An active camera output has one resolved controller per
  viewport; a second viewport is a distinct output, not another writer to the
  first. Different visitor runtimes are isolated contexts even over one authored
  world.
- **Declared replacement/handoff.** For a channel family that explicitly
  permits replacement or handoff, a newer accepted command may supersede an
  older contribution under that family's policy. Acceptance establishes an
  ordered ownership transition; the former run cannot later reclaim the
  channel or clear the newer contribution during completion, cancellation or
  cleanup. Other exclusive conflicts still reject. This is not a global
  last-write-wins rule; exact arbitration operators remain first-consumer
  interface work.
- **Domain invariants bind after arbitration.** A generic channel cannot write
  Wall topology, bypass a valid variant selection, or interpolate Camera
  pose/FOV outside canonical Camera evaluation.
- **Diagnostics.** Conflicts surface as creator-facing explanations (“Opening
  and Inspection both control this lid”) with choices to yield, stop, or apply a
  supported combination. The execution graph stays an advanced diagnostic
  surface, not the default authoring UI.

**Current behavior:** no general channel system is landed. Current mechanisms
are domain-internal (scene transforms/materials, Camera motion evaluation); the
former editor-side layout representation was removed by #115 and is a T1 rebuild.
They are replaceable mechanisms under these shapes.

**Extension point:** channel families and operators, each declaring semantics,
validation, conflict/arbitration rules and conformance.

## F.4 Compound acceptance

An authoring operation is a **deterministic function of one expected project
revision plus a typed, serializable intent**.

Acceptance sequence:

1. Allocate identities and capture external inputs or pinned resources
   explicitly before evaluation.
2. Prepare domain candidates against the one expected revision.
3. Stage required resource revisions.
4. Validate the composed result across affected domains, resource locks and
   cross-domain references (F.1).
5. Accept all domains and the dependency lock together — one atomic accepted
   result and one undo result.

- **Failure preserves the previous project.** Failed validation leaves prior
  accepted state intact; failed uploads may leave collectable staged bytes,
  never a half-installed composition. Blob upload and metadata acceptance use a
  staged protocol, not a fictitious distributed transaction across storage
  providers.
- **Stale writers are rejected**, local and cloud alike, through two distinct
  identities (AM-4): a local intent compares its `expectedRevision` against the
  local accepted revision, while cloud persistence compares a captured accepted
  source against a durable saved-base token. The saved-base token is not the
  local revision. Today's cloud Save (row lock + version append) serializes
  writes but lets a stale full-document writer overwrite newer intent; that gap
  is the F.4 cutover obligation before simultaneous human/agent writers.
- **One coherent snapshot.** Renderers, preview and publication see the accepted
  snapshot; they never observe a partially applied cross-domain change.
- **Authored validity versus executable closure.** A composed project may
  atomically accept explicit unresolved bindings when its domain and reference
  validators permit repairable authored state. This never relaxes expected
  revision, resource-lock or cross-domain acceptance. Preview refuses or
  disables affected required behavior; publication accepts only a closed
  selected program/profile. An unresolved binding is never treated as a
  silently resolved capability or View.
- **Human UI and agents use the same operations, diagnostics and
  expected-revision rule.** Temporary invalid gestures stay local previews;
  accepted cross-domain work and publication require coherent validity.
- **First implementation is staged.** The acceptance boundary first lands in a
  bounded local form — registered Layout/Scene planners over the current source,
  extended by conditional Save (AM-4) — and that local stage proves no compound,
  unit or cloud readiness. The **first compound Camera/Experience acceptance**
  arrives later through T3 at the source/runtime cutover, where one compound
  authoring intent can capture a Camera View, bind it to a Presentation and, when
  a Guide occurrence is requested, create a Stop referencing that Presentation in
  one acceptance. Do not defer the contract to component or kit work.

This contract fixes the acceptance boundary, not the history mechanism. Event
sourcing, CRDTs, branch merge and selective actor undo remain separate
decisions.

**Current behavior:** the editor's chronological undo stack (per-domain
Layout/Scene snapshot entries) was removed by #115 with the editor shell, so the
product has no history today; there is no cross-domain atomic acceptance and no
expected-revision precondition. The Layout mutation-planning layering stays as
documented in [`architecture.md`](./architecture.md) §Layout semantic mutation.

**Extension point:** intent kinds and their domain planners; stale-revision
rejection behavior for local and cloud writers.

## Session state and declarative logic

Typed session declarations are program slots of F.5; their execution semantics
are part of this foundation.

- **Declarations:** typed, serializable, with Experience or package-program
  scope, explicit initial values, reset behavior and permitted writers. Every
  declaration has an authored owner (an Experience or a typed reusable
  resource); package scope creates no second authoring authority.
- **Isolation:** runs receive isolated values unless a shared-session scope is
  explicitly declared. Runtime choices, variant selections and rejoin state are
  neither Scene overrides nor writes into authored declarations.
- **Expression form:** the kernel evaluates a bounded, deterministic,
  side-effect-free expression form for guards, derived values and choice
  availability. It reads declared state, inputs and typed semantic values.
  State transitions and effects occur through explicit actions/reducer events,
  never expression evaluation. Variant constraints remain validated by their
  owning domain. No unbounded recursion, hidden clock/network access, or
  arbitrary creator code is implied.
- **Determinism:** a session reducer derives invocation state from an initial
  state plus ordered input events; a value evaluator samples from that state and
  explicit clocks/inputs. Seeking a known run replays events or restores a
  checkpoint; it cannot infer an unrecorded visitor history.
- **Run-scoped events:** completion, cancellation and channel cleanup are
  scoped to the visit/invocation and accepted run epoch that produced them.
  A stale event cannot change a later accepted contribution (§F.3).
- Syntax, UI and the initial operator set are planning choices. Scripts remain
  the separately governed extension-module exception.

**Current behavior:** no typed session declarations, reducer or expression
evaluator exist. The earlier blanket rejection of variables/conditions is
superseded (see [`north-star.md`](./north-star.md) §Composition, behavior, and
direction model).

**Extension point:** session-state types; program node kinds.

## F.5 Release envelope and program slots

A **release** identifies an accepted project revision × selected Experience(s)
× a delivery profile. It is an immutable, derived execution artifact: changes
produce a new accepted revision and a new build.

Envelope contents (shape, not encoding):

- **Manifest and provenance:** package identity/hash; retained source revision
  and dependency lock connected to build identity and output hashes
  (verifiable, not self-asserted); compiler/toolchain identity; release-format
  version; delivery profile; resource hashes/types/sizes. No hidden “latest”
  dependencies.
- **Closure:** closed, content-addressed resource dependencies. A mutable
  external URL is not closure merely because it appears in a manifest; external
  live data is declared as such, with typed inputs and failure/replay options.
- **Required-capability profiles:** the semantic profiles a runtime must
  support. A matching major version alone is insufficient if a required
  capability is absent.
- **Selected Experience identities/entry points:** which Experiences publish,
  with explicit selection/transition semantics and supported Presentation or
  Stop entry addresses. Publication pointers belong to published Experiences,
  not exclusively to the project.
- **Semantic public addresses:** F.1 addresses resolved against the release
  context.
- **Program slots:** occurrences and editorial order; invocation bindings; typed
  session declarations with scopes and initial values; bounded side-effect-free
  guards/derived values; local time mappings; channel policies; lifecycle and
  event semantics.
- **Visitor meaning:** Presentations, contextual content, captions/transcripts,
  localization, reduced-motion/non-3D alternatives.
- **Public integration interface:** exposed parameters/actions/events and
  permitted host capabilities. Persisted audience records use these addresses
  with concrete release context.
- **Traceability:** a release-qualified mapping from runtime subjects/channels to
  authorized source identities.

Rules:

- **The release reader consumes prepared visitor data and never depends on the
  authoring validator or historical authoring compilers.** Editor preview uses
  the same semantic lowering; release preview executes the actual prepared
  package.
- **Prepared lowering from version one.** The first prepared-visitor profile
  lowers existing data into this destination-shaped envelope; it need not
  implement the complete performance engine or freeze an elaborate
  intermediate representation.
- **Baselines.** The first intentionally durable external release declares the
  **Release Baseline**; the **Source Baseline** follows after F's formats land
  and the supported composition/Experience units stabilize
  ([`north-star.md`](./north-star.md) §Release and Source Baselines).
- **Exclusions.** Editor tools, selection/history, unresolved authoring drafts,
  credentials and arbitrary author-supplied executable code are excluded by
  default. A native editable project export remains a separate artifact; a
  visitor package does not promise reconstruction of the full editable project.
- **Failure is explicit.** Unsupported required capabilities/profiles fail
  clearly; an immutable release is never silently reinterpreted by a changed
  implementation.

**Current behavior:** P22 stores an authored `ProjectDocument` snapshot plus an
asset manifest and revalidates it with deployed code at read time. That path is
replaced by the versioned prepared-payload reader at its cutover; no prepared
envelope is implemented.

**Extension point:** program node kinds; profile capabilities;
contract-version negotiation.

## Extension points and version negotiation

Every extension declares explicit semantics, validation and conformance;
unsupported required extensions or capabilities fail explicitly. Additive
capability growth uses the declared points rather than parallel formats.

| Extension kind | Must declare |
| --- | --- |
| Reference kinds | target scope, validation, resolution/repair semantics |
| Channel families / operators | types, units, conflict/arbitration rules, invalidation |
| Program node kinds | execution semantics, guard/effect boundaries, replay behavior |
| Session-state types | type, initial/reset rules, permitted writers, scope |
| Profile capabilities | required semantics, fallback behavior, conformance fixture |
| Domain admission | authority, F.1 conformance, unit, validation, channel families/operators, evaluator/lowering, effects, fixtures |

**Negotiation.** Units, program payloads and releases declare their kind and
version explicitly, and every extension or capability reference declares itself
**required** or optional. A reader must reject an unsupported required one and
may ignore an unsupported optional one. Extensions do not guarantee formats
never change: incompatible semantics require deliberate versioning or
migration, never silent reinterpretation. This is a semantic rule; it
prescribes no encoding.

**Minimum supported program/state coverage (semantic).** Occurrences and order,
invocation bindings, typed session declarations with initial values, bounded
side-effect-free guards/derived values, local time mappings, lifecycle/event
semantics, and declared capability profiles. Numeric version identifiers are
not fixed here; they are set when the relevant interface is ratified as an F
amendment (§Authority and scope). This contract fixes the slots and the
negotiation rule.

## Consumer obligations

- Share these formats from the first new persisted or cross-domain
  implementation; do not mint a feature-local reference, unit, channel or
  acceptance format. Where an interface does not exist yet, draft it in the
  consuming plan and ratify it as an amendment to this contract; the
  implementation lands in shared code.
- Reuse canonical domain evaluation. Visitor runtimes use the same runtime-safe
  evaluators as editor preview — no forked domain mathematics, no dependency on
  authoring validators.
- Keep editor-session and authoring machinery out of releases and visitor
  chunks.
- Record implementation status truthfully: landed behavior stays labeled
  current until its explicit cutover.

## Open mechanisms (implementation decisions — not fixed here)

Byte encodings and container formats; kernel substrate and module boundaries;
invalidation granularity and cache design; history implementation
(snapshot/op-log/CRDT); correspondence algorithms; compilation placement;
channel operator defaults; serialized Camera preparation; level mechanism and
Layout structure expansion versus isolation; slab/ceiling ownership; supported
component/clip/media sets; audience-record storage; device/XR profiles. These
conform to the shapes above and are settled by focused capability planning —
never by inventing a parallel format.

**Changing this contract:** guarantees and shapes change only through an
explicit owner amendment; incompatible semantic changes require deliberate
versioning. Implementation evidence may justify a smaller kernel, adopted
substrate, different packaging or more precomputation while preserving these
contracts.

## Ratified amendments

**Status:** **owner-ratified 2026-10-15**
([decision record](./decisions/f-ratification-2026-10-15.md)); these amendments carry the same
normative force as the sections above. Each amendment names its exact interface version, sole
provider assignment, consumer list and conformance requirements. Provider assignments are
planning authority, not implementation evidence: no shared code, exports, fixtures, acceptance
records or implementation commits are claimed here, and the gate register records `ratified`
with empty evidence columns until providers land. Incompatible semantic changes require a new
major with the old row `superseded`; compatible optional admissions keep the major with new
capability evidence. Numeric conformance tolerances and calibration defaults stay provider
conformance parameters unless an amendment states otherwise.

Sole providers (planning assignment; register provider column wires at phase registration):
F1/F3 → T1.P01.S01 · F4 → T1.P01.S03 (Save/unit extensions T3.P01.S02/S03) · F2 and the
ExecutionProgram codec → T3.P01.S01 · F5 → T4.P01.S02 · viewport seam → T1.P01.S02 ·
source/runtime cutover → T3.P01.S04 (contract AM-9) · prepared reader → T4.P01.S05. Behavioral-gate owners are
unchanged: viewport T1, cutover T3, reader T4.

## AM-1 F1 references v1

Exact reference interface `references-v1`. All IDs are opaque nonempty stable strings; ordering
is stable ID ordering, never a parsed display label.

| Element | Ratified meaning |
| --- | --- |
| `SemanticReference@1` | `version: 1`; `domain` ∈ Layout, Scene, Camera, Experience or a declared typed-resource kind (unsupported required domain/kind is incompatible); `revision` tagged `exact {contentRevision}` or `project-lock {projectId}` resolved against the supplied accepted snapshot and lock — no ambient latest, and a resolution records its concrete revision; `subject {kind, id}` stable canonical subject; `instancePath` ordered stable instance IDs (empty denotes the root); `location` tagged `project-root` or `layout-location {levelId, structureInstancePath}`; `componentId`/`capabilityId` explicit nullable stable identity (unknown returns a typed result, never nearest/name matching). |
| Resolution result | `resolved` with canonical subject, concrete revision and owner; or `missing \| removed \| incompatible \| unauthorized \| repair-required` with original reference, code/message and explicit repair actions. Resolvers perform no repair as a read effect. |
| `SnapshotIdentity@1` | `{acceptedRevision, sourceContentId}` with a separate host SessionEpoch. AcceptedRevision is opaque `{projectId, revisionId}`, fresh on every source change including Undo/Redo. Neither digest nor epoch is the revision token. |
| `FrameReference@1` | Project-world or an owner-qualified frame identity/reference and revision. The owning domain resolves origin/orientation/datum and validates point/vector conversion; a Room without an authored frame cannot qualify. |
| `DerivedSourceRef@1` | `{source, generationId, stream, subRef?}`, runtime-only. Selection stores the canonical source, never fragment identity; fragment details expire on recompile. |

Current-domain resolvers admit Layout, Scene and read-only current Camera subjects; Experience
and resource subjects stay explicitly unresolved until their providers land. Project-lock
resolution without an admitted F.2 lock reader returns `incompatible`; no dependency lock is
manufactured. Selection requalification across revisions uses explicit acceptance
correspondence; missing/retired subjects never retarget by proximity.

**Consumers:** all tracks. **Conformance:** fixtures for nonzero floor qualification, root
Scene, stable instance-path round trips, generation invalidation, missing/unauthorized/
unsupported resolution and refusal of nearest/name repair.

## AM-2 F2 unit envelope v1

Exact envelope interface `unit-envelope-v1`. Strict validation rejects unknown keys, non-finite
or out-of-range values, unsupported format/kind versions and duplicate/conflicting pins. No
generic object bag admits hidden domains or renderer/session state.

| Element | Ratified meaning |
| --- | --- |
| AcceptedRevision | Opaque `{projectId, revisionId}`; equality only, never currency inferred from label, date or publication version. |
| `UnitHeader` | `{domain, unitId, formatVersion, contentRevision}`: one stable codec identity per admitted domain; header/payload version mismatch rejects. |
| `DomainUnit` | `{header, data}`: one domain-owned validator/codec/evaluator boundary. Physical files, tables and blob-per-resource layouts are not prescribed. |
| `ProjectEnvelope` | `{formatVersion, id, name, acceptedRevision, dependencyLock, units}` with exactly one Layout, Scene, Camera, Experience and typed-resource unit; Experience and resource payloads are collections. |
| `DependencyLock` | `{formatVersion, entries}`: deterministic set keyed by qualified identity/instance scope; exact unit/resource content revisions and required capability/version per entry; external bytes additionally pin hash/MIME/size/immutable locator. |
| `UnresolvedBinding` | Typed authored diagnostic retaining the original F.1 reference and repair status in the owning domain — never a fabricated resolved pin. Executable closure is distinguished from structural failure. |

Admitted unit versions: envelope format 1; Layout payload 5; Scene 2 (Camera-free); Camera 1;
Experience 1; typed resources 1. The source-content digest excludes acceptedRevision and
session/history/receipt metadata; unit contentRevision hashes canonical domain data only.
The Camera codec split lands in the same cutover as the Experience order cutover (one
`navigationNodes` migration), as previously ratified.

**Consumers:** T3 coordination, T4 source/program codecs. **Conformance:** empty and
two-Experience round trips, required-kind/version refusal, reference/lock diagnostics and
genuine resource pins.

## AM-3 F3 inspection and Camera output v1

Exact channel interface `inspection-v1` with the shared Camera-output protocol. F.3 validates
shapes, negotiation and conflict rules; it exposes no unrestricted setters.

| Element | Ratified meaning |
| --- | --- |
| `ChannelAddress@1` | `{ownerReference, instancePath, componentId, capabilityId, propertyId, frame}` with no delimiter-string parsing; `frame` is a shared FrameReference@1. |
| `ChannelDescriptor@1` | Value type, units, finite range/categorical values, output/session scope, supported operators/interpolation, required/optional capability, invalidation inputs and validator identity. |
| `ChannelContribution@1` | Descriptor/address, typed value, invocation identity and monotonic accepted run epoch — separate from the authored baseline. |
| Layout ordinary Plan family | Cut height relative to an explicit datum (finite meters); depth finite meters > 0, required; optional explicit finite lateral span/crop; source-kind filter; source-qualified Reveal set (set union over declared identities only). Re-evaluate on accepted Layout revision, parameters, generation or frame change. |
| Camera session inspection family | Finite target in project-world meters, azimuth/elevation radians, positive target-plane frame height, reading/projection policy and motion policy inputs. One exclusive resolved controller per output; accepted ordered replacement/handoff. Camera evaluates pose/projection; no generic pose/FOV interpolation. |

Competing exclusive contributions reject with domain/address/owners and an actionable reason;
replacement invalidates older run cleanup and a wrong-epoch completion cannot clear the active
output. Camera-output tickets `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}`
govern inspection, guided/free navigation, Follow, Look-through and Preview through
acquire/request/replace/return/cancel; return validates current source/output context and
refuses with a reason otherwise. Exactly one Camera output owner exists per viewport/session.

**Consumers:** T1 viewport; T3 extends `camera-handoff-v1` conformance without a second
provider. **Conformance:** finite default/depth absence, invalid units/frame/range, unknown
required vs optional-unsupported families, conflict, replacement and stale cleanup, plus
runtime-safe import direction.

## AM-4 F4 local acceptance Save and retirement v1

Exact acceptance interface. F.4 records an enduring acceptance layer plus a current-source
admission that later retires; local editing remains immediate and persistence is conditional and
explicit.

| Element | Ratified meaning |
| --- | --- |
| `AuthoringIntent@1` | Version, registered kind, operation ID, expected AcceptedRevision, qualified targets, typed serializable payload and captured inputs/allocated IDs. Deterministic: no clock, random, network, closure, gesture or renderer handle enters planning. |
| `AcceptedSnapshot@1` | Validated read facade with accepted revision, source-content identity, admitted source-kind/version and domain read access. No required signature embeds the current ProjectDocument or an F.2 encoding. |
| `prepareIntent` | Evaluates against the unchanged expected baseline and returns validated candidate changes with correspondence/diagnostics, or typed rejection. Planners stay operation-specific; no universal planner base class. |
| `AcceptanceResult@1` | Accepted `{operationId, beforeRevision, afterRevision, snapshot, changes, correspondence, undoResult}`, no-op `{operationId, revision}`, or rejected `{operationId, code, expectedRevision, actualRevision when authorized, diagnostics}`. One logical install and one undo result. |
| `acceptance-invariants-v1` | The enduring shared acceptance layer on this same F.4 entry: one opaque accepted revision per accepted change, canonical content-digest comparison, one atomic validated install with exactly one undo result, stale/ABA rejection and one bounded chronological history. Established with T1.P01.S03 and **never retired**; it is the prerequisite of `local-single-domain-v1`, `unit-acceptance-v1` and `conditional-save-units-v1`. |
| `local-single-domain-v1` | Current-source adapter admission: registered Layout or Scene planners over the current source adapter, complete current-project validation, unchanged-domain/resource enforcement and refusal of multi-domain, new-unit, external-staging and resource-changing operations. Requires `acceptance-invariants-v1` and **retires with the current-source adapter at T3.P01.S04**. Proves neither unit/resource compound acceptance nor cloud Save. |
| History | One 100-entry chronological snapshot stack through the same boundary. Undo/Redo validates, installs once with fresh identity, preserves unrelated contents and truncates redo after new edits. No-op, refusal, cancel and stale results add nothing. Replacement starts a new baseline. |
| `conditional-save-current-v1` | `SaveAcceptedSource@1` captures an immutable locally accepted source/revision/digest, source-kind/version, stable operation ID and a `create-only` or `expected-saved-base {token}` precondition. The server compares the durable saved-base token, runs full source/domain/reference/lock validation and atomically records the captured revision/contents with a new saved-base token. The digest is recomputed server-side; revision identity reused for different contents rejects. Identical retries return the original receipt without another version; changed-payload retries refuse. Acknowledgment marks only the captured contents saved; newer local edits stay dirty. Conflicts preserve local work/history and remote data pending reload or explicit resolution — no automatic merge, no cloud Undo stack. It requires `local-single-domain-v1` and retires with the current-source adapter at T3.P01.S04. |
| `unit-acceptance-v1` / `conditional-save-units-v1` | Same acceptance and Save semantics over F.2 candidates with full lock validation, admitted resource staging and whole-operation history (future T3.P01.S03 capabilities; candidate-only before T3.P01.S04). They require F.2 and the enduring `acceptance-invariants-v1`, never the retiring `local-single-domain-v1`/`conditional-save-current-v1`, so unit acceptance stays eligible after the source transition. |

**Current-source content identity.** The single project-model export hashes UTF-8 canonical
authored-content JSON with `sha256Bytes` (`sha256-<hex>`): strict normalized source, ID-keyed
Layout identity maps ordered, and only `layout.identity.cursor` omitted. The cursor is persisted
allocation bookkeeping; identity assignments remain authored and affect the digest. Full canonical
source retains the cursor for Save/Load and exact Undo/Redo. Equal digests therefore do not prove
full-source byte equality: exact history restoration and changed-payload Save retries must also
compare the full captured source. This current-source rule does not define F2 unit hashing.

**Local revision and cloud saved base are separate identities.** Local acceptance rejects a stale
writer by comparing `AuthoringIntent@1.expectedRevision` against the local `AcceptedRevision`; it
never contacts the server. Cloud persistence is a separate, explicit step: `SaveAcceptedSource@1`
captures one immutable locally accepted source/revision/digest and is compared atomically against
the durable **saved-base token** through `create-only` or `expected-saved-base {token}`. The
saved-base token **is not** the local `AcceptedRevision`, not a SQL version ordinal and not a
publication pointer revision. The server recomputes the digest and runs the same shared
validation boundary; retry receipts, dirty state and conflict preservation are as in the
`conditional-save-current-v1` row. Human UI and agents use the same operations, diagnostics and
rule; no edit is executed server-per-gesture and Save adds no second history.

**Retirement is per scope and terminal (ratified):** retirement retires one named scope, never the
F.4 gate and never the enduring `acceptance-invariants-v1` layer, which persists across the source
transition and stays the prerequisite of the unit capabilities. The retiring scopes are the
current-source adapter admission (`local-single-domain-v1` current-source planning/validation and
`conditional-save-current-v1` persistence), which T3.P01.S04 removes together with all their
callers. The retired scope keeps its historical evidence and conformance record on the same F.4
entry — no parallel registry, no permanent legacy admission — but after retirement no new or
in-progress consumer may Require it, while shipped slices retain their recorded scope and evidence.
The unit capabilities therefore stay eligible by requiring `acceptance-invariants-v1` and F.2
instead of the retiring admission, and the checker must reject a `Requires` naming a retired scope
while accepting one naming the active enduring scope (see the capability-readiness rule in
[`../roadmap/f-foundation-contracts/README.md`](../roadmap/f-foundation-contracts/README.md#capability-readiness)).

**Consumers:** T1/T2 local editing; T3 Save/unit extensions. **Conformance:** captured-input
determinism, local stale/ABA rejection, real Layout/Scene registration, exact mixed
chronological Undo/Redo, redo depth/truncation, full-validation rollback, unsupported
compound/resource refusal, untouched Camera bytes, bypass-sensitive caller proof and real-DB
same-base contention (one winner), create collision, retry mismatch and stale-response/dirty
behavior for Save.

## AM-5 Shared Stage and starter gallery v1

Exact viewport seam `viewport-projection-v1` with the shared Stage host protocol and the
canonical starter gallery. Ordinary project-world Plan/3D only; Section, peel, arbitrary surface
inverses, Scene support resolution and Camera authoring are excluded.

| Element | Ratified meaning |
| --- | --- |
| `StageReadSnapshot` | Source-independent validated read facade: AcceptedRevision, separate content identity/session epoch, admitted source kind/version, compile generation and immutable domain-owned Layout/Scene/Camera read access. No required current-ProjectDocument field. |
| `ViewportRect` | CSS left/top/width/height and DPR, all finite, width/height positive. A hidden/zero-size viewport yields unavailable output, never division by zero. |
| `ViewportEvaluation` | Immutable output ID, epoch, source revision, evaluation generation, realized eye/target/up, view and projection matrices plus inverses, near/far, target-plane meters per CSS pixel, projection kind, settled reading, working-plane qualification and diagnostics. Column-major right-handed convention, project +Y up, X/Z horizontal. |
| `projectWorld` / `pointerRay` / `intersectWorkingPlane` | World→CSS with `visible \| outside-frame \| clipped \| behind`; CSS→ray from the same rendered matrix/inverse (orthographic rays vary origin, share direction); ray→plane against an explicit frame only (never nearest Room), with reasoned `parallel \| behind \| outside-supported-domain \| invalid-frame \| stale-evaluation` failures. Projection is not a membership decision. |
| `evaluateLayoutPlan` | Four typed streams `cut \| projected \| hidden \| symbol` with per-fragment correspondence, per-source membership and exclusion reasons, bounds and diagnostics. Clips/projects canonical compiled solids and query records; never re-fits curves or derives another topology. |
| `resolveSourceHit` | Candidate carries source F.1 identity and generation; stale fragments reject; Opening void/cap resolves via host plus compiled intervals/profile, never nearest mesh face. |
| `registerStageAdapter` | Editor-only registration of domain/required capabilities, world graphics, overlay contribution, eligible hit provider, selection echo, explicit task/instrument factory and disposer. Unknown required capability refuses mounting. |
| `acquireGesture` | One captured pointer/writer lease with accepted revision and operation parameterization. Policy per operation: continue-after-revalidation, suspend-proposal or cancel-on-reading-change; the host runs it once before projection changes. Loss, lens/project/task exit and unmount cancel exactly once. |
| Selection and tasks | One read-only ordered selection/primary value plus `select(reference)` and task open/close requests. Adapters may offer Card facts and precision writers but never a second selection or history. |
| Projection endpoints | Exact orthographic Plan; perspective 3D; Camera-evaluated projective transition (no near-orthographic FOV substitute, no shell tween, no second Plan transform). Flip preserves target and target-plane height, settles azimuth at the nearest 90° (lower-detent tie) and returns to the last working elevation about the current target. Aspect change preserves target, orientation and vertical framing scale. |
| Shadow selection | The Stage Canvas selects its shadow-map type explicitly (`PCFShadowMap` on the landed r186 base); no boolean `shadows` resolving to the removed PCFSoft filtering path. |
| Replacement and lifetime | Validate first, then atomically cancel writers, clear selection/task/return context and swap project/session under a new epoch. Stale loads and Camera completions cannot affect the replacement; no project-specific singleton survives. Adapters, buffers, listeners, leases and pending callbacks dispose exactly once. |
| Starter gallery | Canonical current-format source template: one rectangular enclosure, real reconciled Room/floor polygon and floor datum, no Scene objects and no Camera/Experience content. Validated boot with explicit project-replacement guard. General Wall drawing and the derived-role/schema cutover are deferred and are not prerequisites for compiled-floor support. |

An evaluation's **generation advances on every drawn frame**, so it names a frame, not a reading: a
proposal spans frames and is identified by the output, host session, accepted source revision and
settled reading, while exact projection work still validates the evaluation token it was computed
against. Keying a proposal by the generation cancels live work on any redraw.

One persistent Threlte Canvas/Stage serves all readings and lenses; renderer Camera objects
realize evaluated output only. Editor mounting contracts stay editor-only and must not pull
selection/history/runes/DOM into shared packages.

**Consumers:** T2/T3 editor adapters through the public facade (no private Stage imports).
**Conformance:** projection/inverse agreement across Plan/3D/transitions, DPR and aspect
changes; Layout correspondence with reasoned depth/crop/Reveal behavior; T2/T3-style consumer
probes; replacement teardown; shell/isolation; narrow, long-name and reduced-motion states.

## AM-6 Execution program and visitor profile v1

Shared program codec `ExecutionProgram@1` with the bounded first visitor profile. The codec is
derived from accepted Experience/Camera/source identities — never another editable order format
— and its standalone import closure carries delivery validation only.

Required fields: kind/version and required/optional capabilities; selected Experience/entry
with labelled Presentations and content records; stable Stop occurrences and Camera invocation
bindings; typed scoped state declarations with initial/reset values; finite local-time/hold
mappings; bounded guard expressions; channel policies; run-scoped lifecycle/actions. Empty cases
are explicit. No copied Camera pose/path/graph, renderer object, source selection/history or
arbitrary executable code.

Bounded v1 semantics: distinct Presentation/Stop/visit-run identities; Cut; supported Travel
with directed Camera timing; sequence-next, explicit Stop/End and covered return-to-origin
continuation; nonnegative holds with Continue; text Info Panel with ShowContent/NavigateTo/OpenUrl
activation rules; boolean/choice state with literal/state-read/equality/conjunction guards;
exclusive Camera handoff; explicit enter/arrival/complete/cancel events; reduced motion and
semantic DOM navigation reaching every admitted destination. The same required instruction means
the same thing in Preview and publication; unsupported required program/state/operator/profile
refuses. Later optional kinds extend the declared codec/profile with accepted conformance;
changed existing meaning requires a versioned cutover.

One Experience interpreter (future T3.P01.S03) and one Camera engine serve both paths: editor
Preview uses the same semantic lowering and evaluation, while release Preview executes the
actual prepared package. T4 persists the lowered program as an immutable delivery derivative
and creates no second interpreter.

**Consumers:** T3 Preview, T4 prepared delivery. **Conformance:** non-empty codec/trace
fixtures covering repeated Stops/runs, initialization/reset, guard failure, finite hold/Continue,
directed Travel/gap, Cut and stale handoff cleanup.

## AM-7 Source migration v1

**Status: superseded by [AM-9](#am-9-shared-camera-and-experience-cutover) (ratified 2026-10-19,
[record](./decisions/t3-cutover-ratification-2026-10-19.md)) — not invoked.** The owner ruled every
saved source, version, publication and resource disposable before the Source Baseline, so the F.2
migration exception has no covered data. No converter, inventory or reverse path exists. The cutover
is AM-9's clean source epoch. The bullets below are retained as superseded provenance.

Single source-conversion policy for the Camera/Experience transition (future T3.P01.S04).
Conversion is a named pre-baseline exception, not a multi-format decoder.

- **Prepare without installing.** The sole read-only converter takes the strict post-#115
  document pair plus captured IDs, policy decisions and staged pins, and produces all unit
  candidates with a mapping report and domain plus composed authored validation. Ambiguity and
  refusal are reported before acceptance; unresolved required bindings refuse execution.
- **Quiesce and accept once.** Block writes during the transition; capture one expected migration
  baseline and CAS-install Camera extraction, Experience order, Scene removal and locks together.
  No intermediate Camera-only or order-only state exists. A lost CAS race changes nothing.
- **Activate one source epoch.** Deploy new readers, API admission and runtime together; old
  clients fail with version/revision-required diagnostics. No format sniffing, transparent reader
  fallback or writable feature flag. New bootstrap emits only the new format.
- **Retire immediately.** Remove Scene/Camera legacy order fields, flow-order exports, node-keyed
  visitor orchestration and every current-source F4/Save/Stage/starter adapter with all its
  callers. Only the bounded read-only converter knows the old fields, owned by T3; it retires
  when the covered migration inventory is completed or discharged and recovery is verified,
  before the Source Baseline. No reverse serializer, dual write or indefinite migration reader.
- **Recover deliberately.** Failure before activation leaves prior state untouched. After
  activation, restore the backed-up pre-cutover source plus matching deployment as a coordinated
  rollback, or roll forward; never reverse-convert edited new-format data. Source Undo restores
  new-format authored contents with a fresh revision and never reactivates the retired schema.
- **Inventory first.** S04 approval requires actual source/project/version/publication counts,
  format coverage, backups, quiescence and a recovery plan. A publication gap additionally
  requires verified inventory and explicit owner acceptance at activation; covered releases
  without a concrete compatibility disposition block activation.

## AM-8 Prepared delivery direction v1

Approved release architecture for T4; the exact F5 envelope/profile/payload codecs and
canonicalization are provider work for T4.P01.S02 (F5 stays `undrafted` until then). No prepared
envelope, publication format or Baseline is established by this amendment.

- **Independent release identity.** One source revision yields releases keyed by an independent
  release ID over the canonical release core (source/lock/build inputs, profile, experiences,
  payload/resource hashes, program, meaning, public interface, traceability); the release's own
  hash, pointer revision, timestamps and storage locators stay outside the hash preimage.
  Release schema, payload and profile versions are independent of the installed Three.js version:
  a renderer/runtime update changes the Reader/runtime build identity and its
  supported-format matrix, never an existing release's bytes or meaning.
- **Closed resources.** Immutable content-hash resources with private storage-locator mappings;
  releases pin bytes independently of mutable asset/catalogue rows, and pinned bytes survive
  asset cleanup. Missing, corrupt or externally unclosed inputs refuse; explicit primitive
  fallback is distinct from failed required content.
- **Per-Experience pointers.** `(project, experience identity)` uniqueness, stable public ID,
  nullable active release/entry and monotonic OCC revision. Activation verifies selected-
  Experience membership; stale/ABA/concurrent writers get conflicts.
- **Pinned-context delivery.** `/p/:publicationId` resolves its pointer once to release ID,
  selection and entry; concurrent Update cannot mix releases. Unpublish denies every managed
  metadata/artifact/byte route including aliases. All public responses are `no-store` without
  storage keys or credentials.
- **One coordinated barrier.** The T4.P01.S05 cutover fences publication mutations, switches
  pointer authority with the prepared API/browser route as a compatible pair, and retires all
  authored delivery callers (source join/validator, source-version insertion/activation). No
  per-request fallback, dual writes, second writable pointer or format dispatch reactivating the
authored reader. Post-barrier rollback prefers a prior compatible prepared runtime/pointer with
  fresh OCC revisions.
- **API first.** Owner prepare/activate/update/unpublish flows precede the T4-owned thin
  publication UI; bounded T2 single-model ingest follows with accepted F.1/F.2 resource identity,
  staged F.4 acceptance and T4 resource delivery.

## AM-9 Shared Camera and Experience cutover

**Status:** **owner-ratified 2026-10-19** ([decision record](./decisions/t3-cutover-ratification-2026-10-19.md), R3); it
supersedes AM-7 for the T3 cutover. Register: `T3.camera-experience-cutover@1`, `ratified`.

Behavioral contract of `T3.camera-experience-cutover@1`. Sole provider `T3.P01.S04`. Consumers:
T3.P02, `T1.P01.S06` and later T1/T2 phases on F2 units (K1, K3), and `T4.prepared-reader@1`.
Prerequisites at the provider's trusted base: `unit-resolution-v1`, `unit-envelope-v1`,
`camera-handoff-v1`, `unit-acceptance-v1` and `conditional-save-units-v1`, plus the enduring
`acceptance-invariants-v1`.

- **Authorities after activation.** Camera owns View identity, framing, projection, connectivity,
  route geometry and intrinsic directed motion/evaluation. Experience owns Presentations, Stop
  identity, Guide order, holds, continuation, Gates and invocation time mapping. Scene and Camera
  structural types carry no editorial order, hold, detour or lock field. Each source/session has
  exactly one Experience order writer and one Camera output owner. A Presentation may exist without
  a Guide: lowering and DOM navigation keep it reachable.
- **Clean source epoch (no migration).** No saved source is covered (owner ruling 2026-10-19, [record](./decisions/t3-cutover-ratification-2026-10-19.md)), so
  F.2's migration exception is not invoked and no converter exists. Activation is one forward schema
  migration, serialized against concurrent runners. In one transaction it removes all authored
  project data (sources, versions, receipts, resources, publications, releases) and installs a schema
  that structurally admits only the F2 envelope, so a writer that predates it fails. Unreferenced
  object bytes are purged afterwards. New bootstrap and the starter emit only F2.
- **Current-format-only admission.** API admission, editor boot, import, session drafts and Save
  accept only declared F2 versions. Old clients, old files, old drafts, mixed roots and unknown
  versions fail with typed version diagnostics. There is no format sniffing, transparent fallback,
  dual write or writable feature flag. Skew between independently deployed API and editor builds
  refuses; it never misreads.
- **Retirement.** `local-single-domain-v1` and `conditional-save-current-v1` retire, with every
  caller, under AM-4's per-scope retirement rule. `acceptance-invariants-v1` persists. Also removed:
  the Scene Camera fields, legacy flow-order exports and their callers, node-keyed visitor
  orchestration, and the inactive converter module.
- **Acceptance and history.** Every project starts at a new-format baseline, and no Undo crosses the
  format boundary. AM-4's unit acceptance and Save semantics apply unchanged: one validated install
  with one undo result, fresh revisions, a saved-base CAS with one winner, receipts, and conflict
  preservation.
- **Runtime defaults at @1.** Holds and Gates start at editorial arrival. Lowering takes closed
  invocation bindings. Authored homes for the Cut/Travel selector, presentation text, state and
  lifecycle are later F2 unit amendments, owned by their first authoring consumer (T3.P02). They are
  not part of this version.
- **Publication gap.** Until `T4.P01.S05`, Publish and Update return `prepared-reader-required`.
  Every public read returns an honest not-found or unavailable result, status and Unpublish stay
  truthful, and `/p/` plus visitor isolation stay real. Prepared delivery remains T4's.
- **Recovery.** A failed migration transaction changes nothing. After activation, recovery rolls
  forward. There is no reverse serializer or old-format reader.

**Conformance.**

- Admission refusals: old-format document, old-client Save, old file, old draft, mixed roots and
  unknown version.
- Reset migration: one transaction, idempotent rerun, and a single winner under two runners.
- Structural refusal of a pre-epoch writer after the reset.
- `/p/` not-found for prior IDs, and Publish returning `prepared-reader-required`.
- Atomic compound acceptance and Undo/Redo.
- Real-Postgres Save contention with zero skips.
- Motion/continuation parity, session/handoff independence and accessibility parity.
- One evaluation authority and one order writer.
- No retired-scope caller, and no editor machinery in public chunks.
