# Architecture — ownership and boundaries

**Owns:** semantic authorities, source/unit boundaries, product routes, platform responsibilities,
shared composition (F.1–F.4) and the Stage adapter seam. Product ambition is the
[harvested North Star](../../broad-research/north-star-2026-11.md). Approved visual targets own
their feature UX; this contract owns cross-feature technical authority.

## Product and frozen lanes

```text
apps/editor (product)            frozen project (separate)
  sign-in → project hub              independently hosted + versioned
  → /project/:id/spatial             /museum + /museum/editor
  → cloud Save/Load                  outside this repository entirely
  → /p/:publicationId until T4
```

- The Stage boots one F2 envelope from starter, empty, Open JSON or stored source. Layout, Scene,
  Camera and Experience planners use one F4 host and one chronological history. Conditional Save,
  conflict/Reload and explicit sign-in recovery preserve the captured source. One Canvas and one
  viewport evaluation serve Plan and 3D.
- **Frozen, separate projects are outside product scope.** No product file imports, aliases or
  references them; no frozen project/editor state or history migrates into the product, and no
  product export is promoted into the frozen copy.
- The product has no build-flag gating — the reduced surface is what ships.
- Visitor-safe geometry and render modules under `apps/editor/src/lib/render/` serve the editor
  Stage and the visitor runtime. Session, selection, hierarchy, gizmo, authoring, import and
  asset-store code stay editor-only. Runtime-safe domain evaluators are shared by design.

## Product routes

| Route | Role |
| --- | --- |
| `/` | Public entry (guest start or local account sign-in) |
| `/login` | Local username/password login, registration, signed-in legacy credential enrollment |
| `/projects` | Owned cloud project list for authenticated creators |
| `/editor` | Compatibility redirect to `/project/<fresh id>/spatial?create=1`; the mint marks new identity, so a 404 is read as `new`, not `missing` |
| `/project/:id/spatial` | F2 authoring Stage; unit-scoped operations, one history, conditional Head Save and guarded replacement |
| `/p/:publicationId` | Visitor-only route; honest 404 until T4 prepared-reader activation |
| `/dev/materials` | Development material-inspection surface |
| `/dev/assets` | Development asset preview |

The hub and `/editor` enter the starter gallery for a minted identity; choosing an empty project is
explicit. Guest work lives in the browser session. Authenticated work adds owned Save/Load with a
project list and versioned saves. Source admission accepts only declared envelopes
([persistence](./persistence.md)); old files, drafts, mixed roots and unknown versions refuse
without conversion. Publication writes return `prepared-reader-required`.

## Platform boundary

| Concern | Owner |
| --- | --- |
| API runtime and compute | Fastify + TypeScript on Render |
| Platform/database state | Neon Postgres |
| Heavy asset bytes | Cloudflare R2 |
| Identity authentication | Local username/password credentials in Postgres; the API owns verification, sessions and authorization |
| Product/project authorization | Fastify + Postgres |

The API uses a secret `DATABASE_URL`. Authentication uses local usernames and scrypt password
hashes, secure app-owned sessions and stable owner IDs. A test-only session issuer is structurally
absent unless configured and must never be enabled in production. Asset metadata lives in Postgres
and bytes in private R2, reached only through the API. The live source is `ProjectEnvelope` with
five codec-bounded units, accepted-revision provenance and a dependency lock. Applying a
destructive schema baseline to deployed storage is a separate owner-run action.

## Semantic authorities

A semantic owner is not a database table, storage folder or UI mode. Each authority is distinct,
never merged, and may not be hidden inside another document merely because it has storage space.
Each persisted shape is an F.2 codec-bounded unit.

| Authority | Owns |
| --- | --- |
| **Layout** | Architectural topology, dimensions, hosted Openings, levels, placed structures, architectural definitions/instances, alternatives, parameters, validity, and the runtime-safe contextual representation. Persisted as the Layout unit (`@portfolio/layout-core`). |
| **Scene** | Object definitions, components, base transforms, variants, attachments, materials, lights, placed instances, native drawn forms, world presentation (environment/atmosphere, render settings, spatial trigger subjects, surface finishes). Camera-free, world-local, no `roomId`; native forms are evaluated by `@portfolio/geometry-core`. |
| **Camera** | Views, spatial connectivity, paths, framing, projection policy, intrinsic movement profiles, evaluation and reusable Camera resources. Evaluated by `@portfolio/camera-core`. |
| **Experience** | Presentations, Experience-wide Interactions, optional Guides and Stops, editorial order/pacing, visitor-facing content/localization/UI configuration, contextual Activity invocations and typed session declarations. Collection-capable. |
| **Typed resources** | Reusable states, clips, performances, role interfaces, revisions and dependency locks; project and library scopes. Bytes stay in the P20 registry/private storage. |
| **Project coordination** | Accepted revision, dependency lock, cross-domain validation, coherent history, release preparation, deterministic typed intents (F.4). `ProjectEnvelope`, one chronological history, local expected revision and durable saved-base CAS. Source and cloud revision identities are distinct. |
| **Execution session** | Active runs, clocks, channel control, visitor choices, media position — isolated per preview/visitor/session. Session state is never written back to authored definitions. |
| **Audience/collaboration** | Comments, approvals, saved visitor configurations, shared-session snapshots, outcome analytics — outside authored source, anchored by public semantic address plus release context. None is implemented. |

Residual ownership: world presentation defaults to Scene; visitor-facing meaning, localization and
UI configuration default to Experience. Admit a new semantic domain only by declaring its
authority, F.1 conformance, persisted codec unit, validation, channel families/operators, evaluator,
release lowering, effects and conformance fixtures.

**Product lenses.** World | Experience is creator-facing framing, not a new domain split. World
exposes Layout/Scene source truth and Camera inspection; it is not a `WorldDocument`. Experience
composes meaning over domain-qualified subjects and exposes Camera authoring through canonical
Camera operations. One selection facade, one history and one F.4 project acceptance serve both
lenses.

**Capability and execution.** A subject's domain declares intrinsic capabilities; typed resources
may define reusable performances; an Experience Activity invokes a supported capability or
performance; the execution session gives each visit and run private identity and state.
Presentation identity, Stop occurrence identity and session visit/invocation identity are distinct.
Neither a Presentation nor a Stop is a safe sole key for runtime lifecycle. Experience-wide and
Presentation-local Interactions bind visitor events to supported behavior without fabricating
intrinsic capabilities.

**Workflow context is not capability ownership.** A lens, reading or focused scope decides which
domain operations it exposes and how densely. The owning domain decides what an operation means and
where it applies. Object Studio, World, Layout surfaces and imported models use one Finish model,
one Scene planner set, one inspection path and one history. No context receives its own material,
texturing, geometry, animation or history engine; a task-local preview evaluates owned source and
never becomes a second authority.

## Expressive creation and revision

World creation, composition and Object Studio refinement operate on the same domain-owned subjects
through the shared Stage, selection, F4 acceptance/history and Save path. Object Studio is a
focused editing scope, not another Scene, persisted domain or renderer. Its dual entry and profile
revision are implemented; later journeys follow the
[T5 Studio specification](../plans/t5-expressive-geometry/object-studio-design.md).

Admitted form edits retain sufficient authored controls, meaningful dependencies, binding policies
and source resources to support the promised revision. Evaluated presentation geometry stays
derived. Meaningful order must not be silently changed, but neither an operation graph nor fixed
strata are required. There is no requirement to preserve every incidental construction action or
invent history for imported work.

Domain-owned capability semantics declare accepted context, affected scope, following/preservation,
validity and refusal. Continuing relationships are deliberate; qualified references carry revision,
lifetime and repair meaning under F.1. No unchanged label or geometric proximity proves continuing
support. No concrete edit-contract API, reference kind or F extension is ratified here.

## Appearance authoring

Appearance is Scene-owned and shared by every supported target: native objects, imported models and
Layout surfaces through Scene `surfaceFinishes`; Layout stays appearance-free. Four boundaries hold:

- **Source and evaluator are family-owned.** Finish identity and the assignment, sharing and Ask
  model are family-independent; each family declares the target requirements that qualify an
  assignment, owns a strict versioned source grammar, its override vocabulary and its evaluator,
  and declares its capability in the dependency lock. `pbr-metallic-roughness/v1` is the first
  family, not the universal editable material format.
- **Procedural source survives its bakes.** A procedural, layered or painted family keeps its
  non-destructive source. Evaluated textures, baked maps and simplified delivery profiles are
  reproducible derivatives with recorded inputs, evaluator version and declared loss. A bake never
  silently replaces editable source; replacing source with baked results is an explicit lossy
  conversion. Generated shader code is not authored truth merely because it was generated;
  validated, sandboxed programmable source remains admissible as typed, versioned family source.
- **Surface addressing and parameterization have owners.** Geometry identity, base coordinates and
  correspondence through geometry revision belong to the geometry side: Layout for architecture,
  T5 for native forms, and imported models declare their own UV sets and material slots. Targets
  are addressed as Layout surface keys with topology lineage, Scene entity and admitted component
  or source-role identities, and import-declared slots. Scene owns appearance bindings, mappings,
  projections and texture coordinates authored against qualified geometry. Every parameterization
  declares its stability and its behavior when geometry is revised; failed correspondence is
  visible and repairable. Nothing binds to renderer buffers, evaluated/generated mesh indices or
  nearest geometry.
- **One appearance capability across contexts.** Inspection, catalogue, import, library and
  authoring operations are one capability reaching World, Object Studio and supported architectural
  or imported targets through qualified adapters, and the same for agents. A focused material
  workspace with dense graphs, layer editors, UV tools or specialised controls may present them
  when advanced work needs it; it owns no separate material model.

## F.1 Identity and reference

A durable reference identifies meaning, not a location: **domain qualification + revision context
+ stable subject identity + stable instance-ID path + component/capability**. Names, indices,
display labels and mutable hierarchy paths may locate data within one revision; they never
establish identity across revisions or re-exports.

- **Stable internal IDs.** Every addressable subject, component, occurrence, resource and location
  a reference can name has a stable identity distinct from its display name. Instance-ID paths stay
  stable through edits that preserve the instance.
- **Revision context.** A reference names either an exact revision/content identity or a project
  revision context carried by the dependency lock. No hidden "latest" is embedded in a persisted
  reference.
- **Generation-qualified fragments.** Generated/derived fragments carry a generation qualification
  and a mapping back to source identity; they are not valid durable substitutes for source identity.
- **Layout multiplicity.** Level, structure and instanced-definition qualification exists before
  vertical architecture expands; a reference that cannot express its level context is not durable
  for multi-level Layout.
- **Experience/occurrence identity.** Repeated guided placements are distinct Stop occurrences with
  stable authored identity; a Stop identity persists across revisions while that authored occurrence
  persists, even if its Presentation or referenced subject becomes unresolved. Editorial order never
  lives as a second writable authority beside legacy node links.
- **Presentation, Stop and invocation are distinct.** A Presentation names reusable Experience
  composition, a Stop names one authored Guide occurrence referencing it, and each actual visit has
  a session invocation identity. Repeated visits to the same Stop are separate runs; runtime
  lifecycle cannot be keyed solely by Presentation, Stop or authored-use identity.
- **Resources.** Inline project-local, library-hosted and vendored resources use the same identity
  semantics. Identical immutable bytes in two packages are delivery copies of one revision, not
  competing mutable definitions; detaching for independent editing creates a new authored identity.
- **Public addresses.** A public address names a publication or pinned release plus a durable
  semantic location keyed by subject/occurrence identity. Republishing preserves locations while
  their subjects persist; removal or incompatible replacement returns an explicit result
  (removed/orphaned/repair required), never a silent redirect by name or position. Each resolved
  result records its concrete release context.
- **Resolution results.** Every reference either resolves or returns an explicit, typed result:
  missing, removed, incompatible, unauthorized, or repair-required. Silent fallback by name, index
  or nearest match is not a resolution.
- **Repairable authored bindings.** Validation can accept an explicitly unresolved subject,
  capability, View or resource binding as authored state, with its original identity and repair
  result intact. It never silently retargets by name, proximity or Room containment, nor deletes the
  affected Presentation/Stop. An intentional keep-current-viewpoint policy is distinct from a
  missing View. Executable closure is a separate check (F.4/F.5).

### Reference interface (`references-v1`)

All IDs are opaque nonempty stable strings; ordering is stable ID ordering, never a parsed display
label.

| Element | Meaning |
| --- | --- |
| `SemanticReference@1` | `version: 1`; `domain` ∈ Layout, Scene, Camera, Experience or a declared typed-resource kind (unsupported required domain/kind is incompatible); `revision` tagged `exact {contentRevision}` or `project-lock {projectId}` resolved against the supplied accepted snapshot and lock — no ambient latest; `subject {kind, id}`; `instancePath` ordered stable instance IDs (empty denotes the root); `location` tagged `project-root` or `layout-location {levelId, structureInstancePath}`; `componentId`/`capabilityId` explicit nullable stable identity (unknown returns a typed result, never nearest/name matching). |
| Resolution result | `resolved` with canonical subject, concrete revision and owner; or `missing \| removed \| incompatible \| unauthorized \| repair-required` with original reference, code/message and explicit repair actions. Resolvers perform no repair as a read effect. |
| `SnapshotIdentity@1` | `{acceptedRevision, sourceContentId}` with a separate host SessionEpoch. AcceptedRevision is opaque `{projectId, revisionId}`, fresh on every source change including Undo/Redo. Neither digest nor epoch is the revision token. |
| `FrameReference@1` | Project-world or an owner-qualified frame identity/reference and revision. The owning domain resolves origin/orientation/datum and validates point/vector conversion; a Room without an authored frame cannot qualify. |
| `DerivedSourceRef@1` | `{source, generationId, stream, subRef?}`, runtime-only. Selection stores the canonical source, never fragment identity; fragment details expire on recompile. |

## F.2 Persisted units and the project envelope

The project envelope contains the **accepted project revision**, the **dependency lock**, and one
**codec-bounded, versioned unit per semantic domain**. The envelope is coordination, not another
domain authority. Units: Layout · Scene · Camera · Experience (collection-capable) · typed
resources. A project may contain several Experiences over one shared world.

- Each unit has one codec boundary, an explicit version and one validation entry; current-format
  validation is strict.
- A unit's format answers only for its own semantic domain. Cross-domain references resolve through
  F.1; cross-domain validity is composed in F.4.
- Version negotiation is explicit: a reader supports a declared version or fails explicitly. Before
  the Source Baseline, development formats may change without historical readers; a named
  pre-baseline migration exception requires documented product reason, covered data, validation,
  recovery and retirement criteria.
- Codec boundaries prescribe neither database tables nor physical files nor one blob per resource.
- Camera has its own independently versioned codec-bounded unit. The Experience unit owns
  Presentations, Experience-wide Interactions and optional Guides whose Stops reference
  Presentations. An Experience invocation stores references and context, never a duplicate Camera
  graph or pose/FOV authority. Two editable order systems may not coexist.
- Typed resources retain identity whether inline, library-hosted or vendored, with immutable
  revisions and a project dependency lock. Semantic authority stays specific to each resource kind.

### Unit envelope interface (`unit-envelope-v1`)

Strict validation rejects unknown keys, non-finite or out-of-range values, unsupported
format/kind versions and duplicate/conflicting pins. No generic object bag admits hidden domains or
renderer/session state.

| Element | Meaning |
| --- | --- |
| AcceptedRevision | Opaque `{projectId, revisionId}`; equality only, never currency inferred from label, date or publication version. |
| `UnitHeader` | `{domain, unitId, formatVersion, contentRevision}`: one stable codec identity per admitted domain; header/payload version mismatch rejects. |
| `DomainUnit` | `{header, data}`: one domain-owned validator/codec/evaluator boundary. Physical storage is not prescribed. |
| `ProjectEnvelope` | `{formatVersion, id, name, acceptedRevision, dependencyLock, units}` with exactly one Layout, Scene, Camera, Experience and typed-resource unit; Experience and resource payloads are collections. |
| `DependencyLock` | `{formatVersion, entries}`: deterministic set keyed by qualified identity/instance scope; exact unit/resource content revisions and required capability/version per entry; external bytes additionally pin hash/MIME/size/immutable locator. |
| `UnresolvedBinding` | Typed authored diagnostic retaining the original F.1 reference and repair status in the owning domain — never a fabricated resolved pin. Executable closure is distinguished from structural failure. |

The source-content digest excludes acceptedRevision and session/history/receipt metadata; unit
contentRevision hashes canonical domain data only. The Camera codec split and Experience order
cutover landed as one ownership split; source admission uses only the current units.

## F.3 Channels and representation parameters

A channel address names a writable/evaluable value:
**instance → component → capability/property → frame**. Each address carries a typed value: type,
units, allowed range, scope, interpolation and domain-owned composition operators.

- **Domain-owned meaning.** The owning domain defines what a channel means, its type/units/range
  and its operators. The common contract owns addressing, binding, dependency, conflict and
  invalidation rules.
- **Representation parameters are channel-addressable semantic values** (cut, depth, peel, lift,
  reveal and related inspection parameters). Layout evaluates architectural representation from its
  canonical output; Camera evaluates viewing intent; editor/session recipes assemble these values
  without owning their domain meaning. Representation evaluation is runtime-safe Layout-owned code.
- **Authored baseline vs runtime contributions.** Authored override precedence computes the
  instance baseline (definition defaults → selected variant → allowed instance overrides); it does
  not decide runtime contention. Active states, performances and inspection supply contributions to
  declared channels.
- **Conflict rules.** Competing exclusive control is rejected by default; blend, additive offset,
  replacement or handoff is allowed only for channel families that define it. Transform
  multiplication is ordered and frame-specific; camera pose, categorical variants, visibility and
  material values use domain-specific rules. An active camera output has one resolved controller
  per viewport; a second viewport is a distinct output, not another writer to the first. Different
  visitor runtimes are isolated contexts even over one authored world.
- **Declared replacement/handoff.** A newer accepted command may supersede an older contribution
  only where the family's policy permits it; the former run cannot later reclaim the channel or
  clear the newer contribution during completion, cancellation or cleanup. This is not global
  last-write-wins.
- **Domain invariants bind after arbitration.** A generic channel cannot write Wall topology,
  bypass a valid variant selection, or interpolate Camera pose/FOV outside canonical Camera
  evaluation.
- **Diagnostics.** Conflicts surface as creator-facing explanations ("Opening and Inspection both
  control this lid") with choices to yield, stop, or apply a supported combination. The execution
  graph stays an advanced diagnostic surface, not the default authoring UI.

### Inspection and Camera output interface (`inspection-v1`)

| Element | Meaning |
| --- | --- |
| `ChannelAddress@1` | `{ownerReference, instancePath, componentId, capabilityId, propertyId, frame}` with no delimiter-string parsing; `frame` is a shared `FrameReference@1`. |
| `ChannelDescriptor@1` | Value type, units, finite range/categorical values, output/session scope, supported operators/interpolation, required/optional capability, invalidation inputs and validator identity. |
| `ChannelContribution@1` | Descriptor/address, typed value, invocation identity and monotonic accepted run epoch — separate from the authored baseline. |
| Layout ordinary Plan family | Cut height relative to an explicit datum (finite metres); depth finite metres > 0, required; optional explicit finite lateral span/crop; source-kind filter; source-qualified Reveal set (union over declared identities only). Re-evaluate on accepted Layout revision, parameters, generation or frame change. |
| Camera session inspection family | Finite target in project-world metres, azimuth/elevation radians, positive target-plane frame height, reading/projection policy and motion policy inputs. One exclusive resolved controller per output; accepted ordered replacement/handoff. Camera evaluates pose/projection; no generic pose/FOV interpolation. |

Competing exclusive contributions reject with domain/address/owners and an actionable reason;
replacement invalidates older run cleanup and a wrong-epoch completion cannot clear the active
output. Camera-output tickets `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}` govern
inspection, guided/free navigation, Follow, Look-through and Preview through
acquire/request/replace/return/cancel; return validates current source/output context and refuses
with a reason otherwise. Exactly one Camera output owner exists per viewport/session. Negotiation
validates an address against its owner reference only; it does not check that a `componentId`
exists.

## F.4 Compound acceptance

An authoring operation is a **deterministic function of one expected project revision plus a typed,
serializable intent**.

1. Allocate identities and capture external inputs or pinned resources explicitly before evaluation.
2. Prepare domain candidates against the one expected revision.
3. Stage required resource revisions.
4. Validate the composed result across affected domains, resource locks and cross-domain references.
5. Accept all domains and the dependency lock together — one atomic accepted result and one undo
   result.

- **Failure preserves the previous project.** Failed validation leaves prior accepted state
  intact; failed uploads may leave collectable staged bytes, never a half-installed composition.
- **Stale writers are rejected** through two distinct identities: a local intent compares its
  `expectedRevision` against the local accepted revision, while cloud persistence compares a
  captured accepted source against a durable saved-base token. The saved-base token is not the local
  revision.
- **One coherent snapshot.** Renderers, preview and publication see the accepted snapshot; they
  never observe a partially applied cross-domain change.
- **Authored validity versus executable closure.** A composed project may atomically accept
  explicit unresolved bindings when its domain and reference validators permit repairable authored
  state. Preview refuses or disables affected required behavior; publication accepts only a closed
  selected program/profile.
- **Human UI and agents use the same operations, diagnostics and expected-revision rule.** Temporary
  invalid gestures stay local previews; accepted cross-domain work and publication require coherent
  validity.
- **Per-planner scope.** `PlannerAdmission` states the planner's `domain` and `compound`, plus an
  optional `writes` list of extra unit domains, using the same domain identifiers. The permitted
  write set is `domain` ∪ `writes`. A compound planner must declare at least one `writes` domain,
  each distinct, other than its own and admitted by the registry; a single-domain planner that
  declares `writes` is refused. Acceptance derives changed unit domains from candidate unit content
  revisions, not from the intent's targets, and refuses any candidate outside the planner's write
  set with one typed rejection. A scope refusal installs nothing.

### Acceptance and Save interface

| Element | Meaning |
| --- | --- |
| `AuthoringIntent@1` | Version, registered kind, operation ID, expected AcceptedRevision, qualified targets, typed serializable payload and captured inputs/allocated IDs. Deterministic: no clock, random, network, closure, gesture or renderer handle enters planning. |
| `AcceptedSnapshot@1` | Validated read facade with accepted revision, source-content identity, admitted source-kind/version and domain read access. |
| `prepareIntent` | Evaluates against the unchanged expected baseline and returns validated candidate changes with correspondence/diagnostics, or typed rejection. Planners stay operation-specific; no universal planner base class. |
| `AcceptanceResult@1` | Accepted `{operationId, beforeRevision, afterRevision, snapshot, changes, correspondence, undoResult}`, no-op `{operationId, revision}`, or rejected `{operationId, code, expectedRevision, actualRevision when authorized, diagnostics}`. One logical install and one undo result. |
| `acceptance-invariants-v1` | Enduring shared acceptance layer: one opaque accepted revision per accepted change, canonical content-digest comparison, one atomic validated install with exactly one undo result, stale/ABA rejection and one bounded chronological history. Never retired. |
| History | One 100-entry chronological snapshot stack through the same boundary. Undo/Redo validates, installs once with fresh identity, preserves unrelated contents and truncates redo after new edits. No-op, refusal, cancel and stale results add nothing. Replacement starts a new baseline. |
| `ConditionalSave@1` | Captures an immutable locally accepted source/revision/digest, source-kind/version, stable operation ID and a `create-only` or `expected-saved-base {token}` precondition. The server compares the durable saved-base token, runs full source/domain/reference/lock validation and atomically records the captured revision/contents with a new saved-base token. The digest is recomputed server-side; revision identity reused for different contents rejects. Identical retries return the original receipt; changed-payload retries refuse. Acknowledgment marks only the captured contents saved; newer local edits stay dirty. Conflicts preserve local work/history and remote data pending reload or explicit resolution — no automatic merge, no cloud Undo stack. |

**Current-source content identity.** The project-model export hashes UTF-8 canonical authored-content
JSON with `sha256Bytes` (`sha256-<hex>`): strict normalized source, ID-keyed Layout identity maps
ordered, and only `layout.identity.cursor` omitted. The cursor is persisted allocation bookkeeping;
identity assignments remain authored and affect the digest. Full canonical source retains the
cursor for Save/Load and exact Undo/Redo. Equal digests therefore do not prove full-source byte
equality: exact history restoration and changed-payload Save retries must also compare the full
captured source.

**Retirement is per scope and terminal.** A retired adapter admission cannot be required by a new
consumer. Enduring acceptance invariants persist across source transitions. No permanent legacy
admission or parallel registry is permitted.

## Session state and declarative logic

- **Declarations:** typed, serializable, with Experience or package-program scope, explicit initial
  values, reset behavior and permitted writers. Every declaration has an authored owner.
- **Isolation:** runs receive isolated values unless a shared-session scope is explicitly declared.
  Runtime choices, variant selections and rejoin state are neither Scene overrides nor writes into
  authored declarations.
- **Expression form:** the kernel evaluates a bounded, deterministic, side-effect-free expression
  form for guards, derived values and choice availability. It reads declared state, inputs and typed
  semantic values. State transitions and effects occur through explicit actions/reducer events,
  never expression evaluation. No unbounded recursion, hidden clock/network access or arbitrary
  creator code.
- **Determinism:** a session reducer derives invocation state from an initial state plus ordered
  input events; a value evaluator samples from that state and explicit clocks/inputs. Seeking a
  known run replays events or restores a checkpoint.
- **Run-scoped events:** completion, cancellation and channel cleanup are scoped to the
  visit/invocation and accepted run epoch that produced them. A stale event cannot change a later
  accepted contribution.

The shared interpreter has typed boolean/choice declarations with initial/reset values, a
deterministic reducer over explicit events, bounded literal/state-read/equality/conjunction guards,
and `runId`/`runEpoch` rejection of stale events. A same-run reset rewinds without a new epoch; no
landed asynchronous effect family exposes this. Scripts remain the separately governed
extension-module exception.

## F.5 Release envelope

Prepared publication is T4's obligation. Its envelope shape, build inputs, reader boundary and
activation gate live in [the prepared release design](../plans/t4-release/prepared-release-design.md).
Publish/Update return `prepared-reader-required`; public reads return an honest 404 with `no-store`.

## Shared Stage seam

`WorkspaceHost` is the one owner of the mounted Stage session and its lifecycle; surfaces acquire
and release the session through it rather than constructing a second Stage. `StageSession` owns the
canonical selection and one gesture lease at a time, with
reading-change policy per lease. `registerProposal` and `liveProposal` expose live proposals to the
Undo availability reason. F4 owns the one chronological history. Escape precedence is the ordered
`ESCAPE_LADDER` table; each rung names its owning feature, and the keyboard iterates the table.

`StageFacade` is a coordinator over owner leaves under `stage/facade/`: type-only contracts
(`adapter-contract.ts`, `view-contract.ts`) and executable owners for adapter bindings, selection
and pick, the Plan view and the contribution view. Each owner reaches only its named executable
dependencies and never the facade, another owner or authoring/rendering state. The spatial route
composes the Stage from controllers under `stage/route/`: project epoch, asset leases, one input
arbiter, keyboard leaf, Unfold and Artwork gestures, viewport, shell state, shell commands,
Experience binding and selection/contribution views. The route keeps no second epoch, history,
asset-lease, pointer or keyboard owner, and no controller imports the route.

Adapters and posture modules receive the Stage through `StageAdapterPort` and `StageTaskPort`
exported from `stage-adapter-host.ts`, never the whole facade or private Stage modules. A capability
registers planners through `StageAdapterServices.authoring.registerPlanner`, submits intents through
the same F4 path, keeps proposal teardown in its binding-scoped session, publishes contributions
through the domain binding, and mounts through `mountStageAdapter` from the project epoch. Bindings
end on rebind; registrations end on unmount. A focused context or capability contributes through
these slots rather than a plugin-only path.

**Picking.** `StageFacade.resolvePick` delegates cross-domain arbitration to `stage-pick.ts`.
Layout chooses its winner through `plan-pick-provider.ts`; the Scene adapter keeps its
rendered-raycast, footprint and occlusion policy. Finite forward 3D hits outrank tolerance-only
hits; Plan ranks by Paper layer order: Room floor 10, hidden 20, projected 30, cut 40, Opening
symbol 50 and Scene footprint 60. With no task, a press is offered to the primary selection's
owner; a fine-pointer Junction hover in Plan is the one unselected Layout mark exception. Hover is
session-only and uses the same resolver. Window blur, hidden-page, capture loss and pointer
cancellation end live presses; a second pointer ends the authored press and hands navigation the
pair.

**Selection and marks.** The Stage owns one mark host and draws every admitted mark; domains
publish descriptors and keep their planners, refusals and gesture meaning.
`StageAdapterBinding.handles` returns descriptors for the primary selection with no task open. An
**editing grip** names the Card `fact`, its `verb`, the registered domain `planner` a release
submits and an optional `disclosedBy`; a **disclosure mark** only reveals grips — it writes nothing
and enters no history. Admission refuses an unregistered planner or a disclosure that reveals
nothing. `extent` is the mark's world reach, never its drawn size: the host draws the vocabulary at
`STAGE_MARK_GLYPH_CSS` (ray 30 px, two-way half 16 px, ring radius 30 px), keeps 22 px fine / 44 px
coarse hit areas, and withholds a ray or ring whose axis is edge-on. An overlap resolves by the
owning domain's descriptor order. A press acquires the one gesture lease through the binding's
existing pointer intent.

Selection ink is PLATE gold `#d4ad45` over a dark halo with the 0.18 tint in 3D; hover is neutral
`#F3F4EE`, never gold, and always drawn below selection. 3D ink is built only from a source's
visible meshes — a mesh with a hidden ancestor is skipped — and is never parented under a pick
root. On Paper the same identity is a re-stroke filter over `buildPaperPlan` in `paper-marks.ts`: a
filled subject uses its union boundary, non-cut lines remain, and marks sit on layer 2 with
`depthTest: false` above Paper's layer order.

The Stage supports one optional `candidatePreview(context)` contribution beside `overlay` and
`graphics`: the subject, affected neighbours and refusal words a domain is proposing right now. A
domain publishes world-space polygons, segments, labels and the winning snap; the facade projects
every point once through the accepted evaluation and `StageOverlay.svelte` draws it as SVG in both
readings. A refused candidate keeps its full **attempted** geometry as display-only evidence,
separate from the validated candidate that release would install. Its reason stays beside the
pointer; the attempted shape is never clamped or replaced by a dashed normal. Release while refused
writes nothing and restores accepted geometry with no history entry. The attempted geometry is
never compiled, persisted, admitted to history or serialized. Layout builds its preview from the
planner's own candidate document through the existing compile and `buildPaperPlan` path — the same
solve release commits. One compile context per open project binds the incremental session for
planner steps and keeps the last compiled document; candidate Paper, Opening face and attempt builds
are memoised per live binding by document identity and released on end, cancel, rebase and binding
dispose — one compile per **distinct candidate**, never per rAF tick or unchanged frame. The
accepted intent and the preview remain the same solve; no second preview evaluator is permitted.

**Coordination over domain policy.** The host coordinates pointer routing, arbitration between each
domain's winner, session selection, hover, mark disclosure, gesture leases and interruption.
Domains own eligibility, hit tests and internal ranking, occlusion, marks, gesture meaning, capture
and refusal text. The host does not compute or reorder a domain's hits. A live gesture's owner
captures. A domain tool asks only its domain; a host tool (Measure, Eraser) asks every domain that
declares it; otherwise the input is Select. The host asks each domain for one winner and arbitrates
only between domain winners by spatial truth: nearest surface along the ray in 3D, Paper draw order
in Plan. The selected subject's admitted marks rank above world geometry. The host never rewrites a
refusal or imposes one cross-domain node, anchor or object priority.

## Known exception

**AR-7.** The neutral visitor free-look pose is driven by `OrbitControls` outside the Camera
evaluator. The owner has explicitly accepted this named exception until T3 reconciles the visitor
free-look authority. It is not a second authored Camera or a claim that one Camera authority is
satisfied. Preserve existing navigation behavior; T3 must establish a targeted regression/authority
test before removing the exception.

## Hard don'ts

Dual navigation graphs · a second pose/FOV interpolation authority · a second motion/geometry
compiler or consumer-owned architectural reconstruction · persisting generated endpoints as
authored anchors · persisting Three/render state in authored truth (immutable release derivatives
excepted) · inferring ownership/adjacency from coordinates · importing frozen-project state into the
editor · independent layout-only import · hiding the editor behind a build flag · Experience UI
performing independent camera interpolation · Experience editing Camera path/timing truth outside
Camera · duplicating canonical timing/path values into Experience truth · a second writable
editorial-order authority · hiding a semantic domain inside another document · per-mode resource
stores · `ExperienceScene` / `ExperienceCameraGraph` / `ExperienceCameraPath` / `ExperienceRenderer`
as a second spatial authority · visitor chunks containing editor session/selection/history/gizmo
code.
