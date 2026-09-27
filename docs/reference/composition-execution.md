# Composition and execution foundation (F) — target contract

**Read when:** designing identity/reference, persisted domain units, typed
channels or representation parameters, cross-domain acceptance, typed session
declarations, or a release envelope; deciding whether a proposed format belongs
to the common foundation.

**Status:** ratified target contract. The owner-ratified decision record
([`decisions/northstar-ratification-2026-09-27.md`](./decisions/northstar-ratification-2026-09-27.md)
§§5–6, §10) settles F.1–F.5's shapes; this document writes them. F.1–F.5 were
written 2026-09-27 and **owner-ratified 2026-09-27 with amendments (Camera
cutover timing, interface ownership, required/optional extensions).**
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
- **Experience/occurrence identity.** Repeated visits are distinct occurrences
  with stable identity; the same Stop identity persists across revisions while
  its subject persists. Editorial order never lives as a second writable
  authority beside legacy node links.
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
Experience order cutover** (`nextNodeId` / `previousNodeId` / `holdSeconds` /
`lockInteraction` leave Camera nodes for Experience): one migration of
`navigationNodes`, not two. The **landed current encoding remains Camera data
inside `project.scene`** until that cutover; the co-location is a cutover
obligation, not the destination.

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
precondition. The destination units are not designed or implemented.

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
- **Domain invariants bind after arbitration.** A generic channel cannot write
  Wall topology, bypass a valid variant selection, or interpolate Camera
  pose/FOV outside canonical Camera evaluation.
- **Diagnostics.** Conflicts surface as creator-facing explanations (“Opening
  and Inspection both control this lid”) with choices to yield, stop, or apply a
  supported combination. The execution graph stays an advanced diagnostic
  surface, not the default authoring UI.

**Current behavior:** no general channel system is landed. Current mechanisms
are domain-internal (scene transforms/materials, Camera motion evaluation,
editor-side layout representation); they are replaceable mechanisms under these
shapes.

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
- **Stale writers are rejected** by the expected-revision precondition — local
  and cloud writers alike. Today's cloud Save (row lock + version append)
  serializes writes but lets a stale full-document writer overwrite newer
  intent; that gap is the F.4 cutover obligation before simultaneous human/agent
  writers.
- **One coherent snapshot.** Renderers, preview and publication see the accepted
  snapshot; they never observe a partially applied cross-domain change.
- **Human UI and agents use the same operations, diagnostics and
  expected-revision rule.** Temporary invalid gestures stay local previews;
  accepted cross-domain work and publication require coherent validity.
- **First implementation: the Experience cutover**, where “add Stop here” can
  create both a Camera view and a Stop in one acceptance. Do not defer the
  contract to component or kit work.

This contract fixes the acceptance boundary, not the history mechanism. Event
sourcing, CRDTs, branch merge and selective actor undo remain separate
decisions.

**Current behavior:** history is one chronological undo stack with per-domain
Layout/Scene snapshot entries; there is no cross-domain atomic acceptance and
no expected-revision precondition. The current Layout mutation-planning layering
stays as documented in [`architecture.md`](./architecture.md) §Layout semantic
mutation.

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
  with explicit selection/transition semantics. Publication pointers belong to
  published Experiences, not exclusively to the project.
- **Semantic public addresses:** F.1 addresses resolved against the release
  context.
- **Program slots:** occurrences and editorial order; invocation bindings; typed
  session declarations with scopes and initial values; bounded side-effect-free
  guards/derived values; local time mappings; channel policies; lifecycle and
  event semantics.
- **Visitor meaning:** destinations, contextual content, captions/transcripts,
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
