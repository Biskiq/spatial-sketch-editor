# Architecture — ownership and boundaries

**Owns:** semantic authorities, runtime/editor boundaries, routes, platform responsibilities and
one-authority integration. [North Star](north-star.md) owns product ambition;
[F](composition-execution.md) owns shared interfaces. Approved UX is the desired state for its
approved scope: implementation is planned backward from it. A genuine conflict with a hard
invariant requires owner judgment; current shell limitations do not amend a design.

Core Product Stability is accepted. The editor supports room/shape creation, direct manipulation,
Camera/Experience authoring and isolated visitor Preview. Future requirements are labeled below;
public prepared publication and general Object Studio are not implemented.

## Product and frozen lanes (current)

```text
apps/editor (product)            frozen Chopin project (separate)
  sign-in → project hub              independently hosted + versioned
  → /project/:id/spatial F2 Stage  /museum + /museum/editor
  → cloud Save/Load                  outside this repository entirely
  → /p/:id unavailable until T4
```

- The Stage boots one F2 envelope from starter, empty, Open JSON or stored source. Layout,
  Scene, Camera and Experience planners use one F4 host and chronological history. Conditional
  Save, conflict/Reload and explicit sign-in recovery preserve the captured source. One Canvas
  and viewport evaluation serve Plan and 3D. Wall/Opening creation, GLB import and Camera/
  Experience authoring are implemented. Public publishing requires the prepared reader;
  production activation remains owner-controlled.
- **Frozen, separate projects are outside product scope.** No product file
  imports, aliases or references them; no Chopin project/editor state or history
  migrates into the product, and no product export is promoted into the frozen
  copy. The Chopin museum project was externalized by PR #115 and is independently
  hosted and versioned.
- The product has no build-flag gating — the reduced surface is simply what ships.
- Shared visitor-safe geometry/render modules serve the product's visitor runtime
  and the frozen project; session, selection, hierarchy, gizmo, authoring, import
  and asset-store code stay editor-only. Runtime-safe domain evaluators (e.g. Layout
  representation) are shared with visitor runtimes by design — editor-only means
  session/authoring machinery, not forked domain mathematics.


## Product routes (current)

| Route | Role |
|---|---|
| `/` | Public entry (guest start or local account sign-in) |
| `/login` | Local username/password login, registration, and signed-in legacy credential enrollment |
| `/projects` | Project hub (owned cloud project list for authenticated creators) |
| `/editor` | Compatibility redirect → `/project/<fresh id>/spatial?create=1` (the mint marks a new identity, so a 404 is read as `new`, not `missing`) |
| `/project/:id/spatial` | F2 authoring Stage: stored source, starter, empty or Open JSON; unit-scoped Layout/Scene operations, one history, conditional Head Save and guarded replacement |
| `/p/:publicationId` | Visitor-only route; Public reads return honest 404 until T4 prepared-reader activation |
| `/dev/materials` · `/dev/assets` | Development previews retained inside the reduced foundation |

The `/editor` compatibility route and hub's New Project enter the starter gallery
for a minted identity; choosing an empty project is explicit. No Chopin/legacy
state is loaded or migrated. Guest/local work lives in the browser session. Authenticated cloud work
adds owned Save/Load with a project list and versioned saves. Save/Load, assets
admit only declared F2 envelopes ([live versions](./components/persistence.md#one-source-format-f2-clean-epoch)).
Old files, drafts, mixed roots and unknown versions refuse without conversion. Publication
writes return `prepared-reader-required`; see [persistence](./components/persistence.md).


## Platform boundary (current)

| Concern | Ratified owner |
|---------|-----------------|
| API runtime + compute | Fastify + TypeScript on Render |
| Platform/database state | Neon Postgres |
| Heavy asset bytes | Cloudflare R2 |
| Identity authentication | Local username/password credentials in Postgres; Museum Editor owns credential verification, sessions and authorization |
| Product/project authorization | Fastify + Postgres |

The API uses a secret `DATABASE_URL`. Authentication uses local usernames and scrypt password
hashes, secure app-owned sessions and stable owner IDs. A test-only session issuer is structurally
absent unless configured and must never be enabled in production. Asset metadata lives in
Postgres and bytes in private R2, reached only through the API.
The live source is `ProjectEnvelope`, with five distinct codec-bounded units, accepted-revision
provenance and a dependency lock. Migration 005's F2 schema fence rejects pre-epoch writers;
applying that destructive migration to the deployed environment is a separate owner-run action.
The P22 delivery path is retired: public reads are unavailable until T4's prepared reader.


## Semantic authorities (ratified destination)

A semantic owner is not a database table, storage folder, or UI mode. Each
authority is distinct, never merged, and may not be hidden inside another
document. The persisted shape of each is an F.2 codec-bounded unit inside the
project envelope ([`composition-execution.md`](./composition-execution.md) §F.2):

| Authority | Owns | Current encoding |
|---|---|---|
| **Layout** | Architectural topology, dimensions, hosted Openings, levels, placed structures, architectural definitions/instances, alternatives, parameters, validity; runtime-safe contextual representation | `units.layout.data` / `LayoutDocumentWallFirst` (`@portfolio/layout-core`), `formatVersion: 7`: Junctions, Walls (including one isolated self-connected closed Wall), persistent Rooms and Wall-hosted Openings over one floor datum, plus document-level objects. The Room-owned legacy Layout document was retired by T1.P02.S05 — there is no second reader or compatibility path; format 7 is the only recognized version |
| **Scene** | Object definitions, components, base transforms, variants, attachments, materials, lights, placed instances, native drawn forms, world presentation (environment/atmosphere, render settings, spatial trigger subjects) | `units.scene.data` / Scene 5 (`@portfolio/project-model`), world-local, no `roomId`; bounded model resources; authored native form sources evaluated by `@portfolio/geometry-core`; no admitted general components or attachments |
| **Camera** | Views, spatial connectivity, paths, framing, projection policy, intrinsic movement profiles, evaluation, reusable Camera resources | `units.camera.data` (Camera 1); `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) evaluates |
| **Experience** | Presentations, Experience-wide Interactions, optional Guides and Stops, editorial order/pacing, visitor-facing content/localization/UI configuration, contextual Activity invocations, typed session declarations | `units.experience.data` (Experience 4, collection-capable); Presentations, linear Guides, one entry View/stay per Stop, invitations, detours and visitor reach |
| **Typed resources** | Reusable states, clips, performances, role interfaces, revisions, dependency locks; project and library scopes | `units.resources.data` and the exact dependency lock; bytes stay in the P20 registry/private storage; general ingest remains future work |
| **Project coordination** | Accepted revision, dependency lock, cross-domain validation, coherent history, release preparation, deterministic typed intents (F.4) | `ProjectEnvelope`, unit F4 acceptance, one chronological history, local expected revision and durable saved-base CAS; source and cloud revision identities are distinct |
| **Execution session** | Active runs, clocks, channel control, visitor choices, media position — isolated per preview/visitor/session | The bounded Cut Preview uses an isolated session through the shared Experience interpreter; session state is never written back to authored definitions; public prepared delivery remains gated by T4 |
| **Audience/collaboration** | Comments, approvals, saved visitor configurations, shared-session snapshots, outcome analytics — outside authored source, anchored by public semantic address + release context | None; P22 release/publication rows are delivery state, not audience records |

Residual ownership: world presentation defaults to Scene; visitor-facing meaning,
localization, and UI configuration default to Experience. Admit any new semantic
domain only by declaring its authority, foundation-reference conformance,
persisted codec unit, validation, channel families/operators, evaluator and
release lowering, effects, and conformance fixtures. Never hide a new domain in
an existing document merely because it has storage space. See
[`north-star.md`](./north-star.md) §Ownership, authority, and lifetimes.

**Product lenses (destination).** World | Experience is creator-facing framing,
not a new domain split. World exposes Layout/Scene source truth and Camera
inspection; it is not a `WorldDocument`. Experience composes meaning over
domain-qualified subjects and may expose Camera authoring through canonical
Camera operations. One selection
facade, coherent history and F.4 project acceptance must serve both lenses.

**Capability and execution boundary (destination).** A subject's domain
declares intrinsic capabilities; typed resources may define reusable
performances; an Experience Activity invokes a supported capability or
performance; the execution session gives each visit and run private identity
and state. Presentation identity, Stop occurrence identity and session
visit/invocation identity are distinct. Neither a Presentation nor a Stop is a
safe sole key for runtime lifecycle. Experience-wide and Presentation-local
Interactions bind visitor events to supported behavior without fabricating
intrinsic capabilities. The first T3 capability consumes a real domain
adapter; full T2 definitions/components depth is not a prerequisite.

**Common execution path (destination).** Editor Preview, visitor runtime and
prepared release execution share semantic lowering and evaluation, with
isolated sessions and runtime-safe domain evaluators. The current visitor
surface/rendering infrastructure may be reused, but its node-based navigation
is migration input, not Experience authority. Preview never writes source;
visitor chunks exclude editor selection, history, gizmos and authoring stores.
Repairable unresolved authored bindings remain explicit under F.1/F.4;
selected executable/publication programs require closure under F.5.

### Expressive creation and revision (destination)

the [North Star](./north-star.md#creative-freedom-and-depth) owns the product principles.

World creation, composition and Object Focus refinement operate on the same domain-owned subjects
through the shared Stage, selection, F4 acceptance/history and Save path. Focus is an editing scope,
not another Scene, persisted domain or renderer. It neither merges World with Experience nor changes
PLATE's shell authority. Its entry/return, interactions and instruments remain TBD.

Layout retains architectural semantics and the canonical architectural compiler; Scene retains
object form and composition semantics; typed resources retain independently versioned source/reuse.
Camera and Experience retain their viewing and editorial authority. T5 supplies reusable numerical
capabilities through those owners, without a competing writer, whole-scene solver or compiler.
Domain computation may share libraries without transferring semantic authority to a kernel.

Admitted form edits retain sufficient authored controls, meaningful dependencies, binding policies
and source resources to support the promised revision. Evaluated presentation geometry stays derived.
Meaningful order must not be silently changed, but neither an operation graph nor fixed strata are
required. Recipes, control surfaces and other source strategies remain hypotheses. There is no
requirement to preserve every incidental construction action or invent history for imported work.

Domain-owned capability semantics declare accepted context, affected scope, following/preservation,
validity and refusal. Continuing relationships are deliberate; qualified references carry revision,
lifetime and repair meaning under F.1. No unchanged label or geometric proximity proves continuing
support. [Scene](./components/scene-content.md#expressive-editing-destination) owns object edit promises;
[persistence](./components/persistence.md#editable-source-and-revision-destination) owns recoverable
source/acceptance. No concrete edit-contract API, reference kind or F extension is ratified here.

Acceptance remains reproducible to the exactness required by existing contracts; approximations and
conversions must be explicit and reopen must not depend on transient caches. The first real consumer
must establish its minimum source and integration needs, obtain owning-track/F review where needed
and supply correctness, revision and browser-cost evidence. Representation mix, kernels, package
boundaries, evaluator/caching strategy, implementation direction and delivery sequence remain TBD;
the proposed directed hybrid has no privileged status. Visitor isolation and T4 delivery remain intact.

### Shared composition and execution contract (F — destination)

Independent evaluators joined only by ad hoc references are insufficient: each
would invent incompatible rules for binding, conflicts, invalidation, time and
repair. A shared typed composition/execution contract owns those cross-domain
rules while domain computation stays specialized. Its ratified shapes are
written in [`composition-execution.md`](./composition-execution.md):

- **F.1 Identity and reference** — domain-qualified semantic identity, stable
  instance-ID paths, revision context, generation-qualified fragments with source
  correspondence; public addresses select a publication/pinned release plus a
  durable semantic location.
- **F.2 Persisted units** — one explicit codec-bounded, versioned unit per
  semantic domain inside a project envelope holding accepted revision and
  dependency lock; the Experience unit supports a collection; Camera is settled
  as its own codec-bounded unit.
- **F.3 Channels and representation** — `instance → component →
  capability/property → frame` addresses with types, units, scope and
  domain-owned operators; representation parameters (cut, depth, peel, lift,
  reveal) are channel-addressable semantic values evaluated by their domain.
- **F.4 Compound acceptance** — one expected project revision; typed,
  serializable authoring intents; validation across affected domains and resource
  locks; one atomic accepted result and one undo result. Implemented with the
  Experience cutover.
- **F.5 Release envelope** — versioned manifest, closed dependencies,
  required-capability profiles, selected Experience identities/entry points,
  semantic public addresses, program slots for occurrences, typed session
  declarations and declarative logic.

**Extension points:** reference kinds; channel families/operators; program node
kinds; session-state types; profile capabilities. Extensions require declared
semantics, validation and conformance; unsupported required capabilities fail
explicitly. Additive capability growth uses these points rather than parallel
formats; incompatible semantics require deliberate versioning. Concrete
encodings and algorithms stay implementation decisions within these shapes;
exact cross-domain interfaces are drafted by their first consumer but promoted into [`composition-execution.md`](./composition-execution.md) and
implemented in shared code, never in phase-local code.

The kernel's four responsibilities: **resolve and compose** (resource closure,
namespace/instance expansion, role binding, override precedence, typed
references, dependency/conflict diagnostics); **control execution** (invocation
identities, typed session state, guards/derived values, local clocks, nested
lifecycles, channel leases, interruption, event ordering, replay policy);
**evaluate values** (dependency ordering, scheduling, cache/invalidation,
coherent snapshots, provenance); **perform effects** (explicit effect intents
with occurrence identity and permitted host capabilities; no effect fires merely
because a cached value is read). Domain authorities retain the meaning and
validity of their own data. These can initially be small TypeScript modules;
ratification selects the contract, not a language, package layout, ECS, WASM or
worker architecture.


## Release packages (destination)

A **release** identifies an accepted project revision × selected Experience(s) ×
a delivery profile. Publishing compiles accepted source into a **portable,
versioned visitor package**: release manifest and closure (source revision,
dependency lock, build provenance, compiler identity, required capabilities,
resource hashes), resolved runtime composition, domain payloads, the execution
program (states, performances, occurrences, typed session declarations,
bounded expressions, lifecycle semantics), visitor meaning (Presentations, order,
content, captions, localization, reduced-motion alternatives), public
integration addresses, and release-qualified traceability.

- Each published Experience has its own mutable pointer to an immutable release
  and entry point; a package may include several Experiences with explicit
  selection/transition semantics.
- The release reader is separately versioned and never depends on the changing
  authoring validator or historical authoring compilers.
- Compiler source maps, input locks and build identity preserve the link between
  a package and its source revision; an external edit of a package is a separate
  derivative with new provenance.
- The **Release Baseline** governs the first durable prepared visitor package;
  the **Source Baseline** follows landed F formats and stable composition/
  Experience units. They are independent — see
  [`north-star.md`](./north-star.md) §Release and Source Baselines.

**Current public delivery:** the authored-snapshot reader is retired. Publish/Update refuse
`prepared-reader-required`; public reads are unavailable until the prepared reader.

### Delivery-derivative exception (destination)

Authored truth contains no generated/render/session state. The former blanket
prohibition on persisted generated state is amended to permit **versioned,
immutable, reproducible delivery derivatives outside authored documents**:
compiled release payloads, including a compiled delivery descriptor that may
contain generated Camera endpoints. Three objects, GPU handles, decoded runtime
objects, selection, gizmo proxies and transient editor state remain excluded
from every persisted form. Generated Camera endpoints remain forbidden as a
second authored set of connection anchors; authored connection anchors remain
interior-only.


## Ownership (current source of truth)

| Concern | Current source of truth |
|---------|-----------------|
| Junctions, Walls, Room boundaries, Wall-hosted openings | `units.layout.data` / `LayoutDocumentWallFirst` (`@portfolio/layout-core`) |
| Rough parametric layout objects | `project.layout.objects` |
| Scene models, primitives, lights, materials, native form sources | `units.scene.data` / Scene 5 (`@portfolio/project-model`) |
| Camera nodes, connections, paths, view tracks | `units.camera.data` / Camera 1 (`@portfolio/project-model`) |
| Derived geometry | pure `compileWallFirstLayoutGeometry()` → `compileLayoutGeometrySource` (`@portfolio/layout-core`) |
| Derived native-form meshes | `@portfolio/geometry-core` (`evaluateProfile` → `extrudeProfile`, `formMeshDigest`); normals and metre UVs are editor render derivatives |
| Project/scene validation, codecs, room semantics, runtime graph | `@portfolio/project-model` |
| Cross-domain reference (F.1) and channel (F.3) interfaces | `packages/project-model/src/references` · `packages/project-model/src/channels` — shared runtime-safe interfaces with no editor/renderer dependency; their accepted readiness is recorded in the [gate register](https://github.com/Biskiq/spatial-sketch-editor/blob/5d7d7f3e/docs/roadmap/README.md#gate-register) |
| Plan presentation | The orthographic Plan reading evaluates the Layout Plan representation over compiled geometry. The Stage draws that evaluation on Paper: cut Wall poché, projected ink, hidden dashes, Opening symbols, Room-floor tint and Scene/native-form footprints. Paper and the pick path share one `PlanEvaluation` and one Scene footprint projection; appearance is a camera layer mask, never `Object3D.visible` |
| 3D wall meshes | compiled Junction contract (`CompiledJunction` / `resolveJunctionGeometry`) → Junction-aware `wall-mesh-builder` → `wall-geometry-adapter` |
| Camera route/motion | `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) — replaceable mechanism under the one Camera authority |
| Publication status, active version, revision | `publications` row (`apps/api`) |
| Published snapshots + delivery manifests | immutable `releases` rows (`apps/api`); bytes resolved per-release at visitor boot |
| Public visitor chrome | `/p/:publicationId` route (editor deployment, visitor-safe closure) |
| Project-local GLB bytes | the API's project-scoped asset registry (metadata in Postgres, bytes in R2), reached only through `apps/api` |
| Selection, history, gizmo proxies, UI | The shared Stage owns selection, Index and shell/session UI. Direct manipulation, gizmos and one chronological F4 history are implemented |

Generated geometry, Three objects, renderer handles, selection, and history
are never serialized as authored truth; immutable release derivatives are the
explicit exception above.

**Extraction discipline.**
Extract responsibilities with their callers and ownership boundaries. A forwarding
surface is justified only when it serves an intentional, owned interface or a bounded
migration. Temporary compatibility shims require an explicit retirement condition and
cannot be treated as completed extraction merely because implementation moved behind
them. Maintain one authoritative owner per mutable state fact.

This distinguishes a legitimate public interface, controlled adapter or composition
boundary from an **unowned compatibility surface retained indefinitely** after an
extraction. The decision point is implementation review. The rule targets coupling and ownership, not module size — a large single-
responsibility module is not evidence of a defect, and no line-count or module-count
threshold is applied anywhere in this repository.

**Layout semantic mutation.** Canonical Layout semantic mutation is planned
in `@portfolio/layout-core`. Each authoring operation owns its own pure
planning function, and the operation's semantics decide what that function
accepts and returns: a topology-changing chain plans a replacement
`LayoutDocumentWallFirst` (with created/split lineage and retired Room IDs),
while an alignment or measurement operation plans a value for the authoring
surface to apply. This is a layering boundary, not a protocol — a shared result
type, base class or command framework is neither required nor implied. The
editor that owned interaction, transient preview, selection and the single
history transaction was removed by #115; a rebuilt authoring surface owns
interaction, transient preview and selection, and F.4 owns the accepted result.
Scene edits are outside this rule. F.4's compound acceptance, landed with
`unit-acceptance-v1` at the T3.P01 cutover, generalizes the acceptance boundary
across domains; it does not retrofit this layering rule.

**Wall role (destination, owner ruling 2026-10-03).** The Wall is the authored
primitive, and its spatial role is derived: Walls taking part in a closed
enclosure bound it, a Wall that encloses nothing is free-standing, and a Wall
drawn across an enclosed Room divides it, producing the derived Room topology
through the canonical compiler and its lineage. Rooms stay derived, and no Room
geometry becomes editable. Layout format 7 has no authored Wall role; every closed ring encloses,
and a self-connected Wall is the isolated circular case.
Two curved Walls between the same two Junctions are a valid Room boundary when the stored
cycle matches the bounded face walk (a two-Wall lens); they are not a duplicate-Wall pair.
The chord-level overlap and the sampled curve gate still prove the loop is simple and
bounded, and the boundary keeps the face walk's direction. Division keeps the landed Room
reconciliation (P23.8 lineage:
split survivor by evidence order, one Room born). The creator-facing expression is
[PLATE §0.8.4](./design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).


## Editor interaction authorities

### Interaction coordination

`StageSession` owns the canonical selection and one gesture lease at a time, with
reading-change policy per lease. Its `registerProposal` and `liveProposal` expose live
proposals to the Undo availability reason. F4 owns the one chronological history
(`apps/editor/src/lib/authoring/f4/history.ts`). See
`apps/editor/src/lib/authoring/stage/stage-session.ts` and
`apps/editor/src/lib/authoring/stage/stage-facade.ts`.

`StageFacade.resolvePick` delegates cross-domain arbitration to
[`stage-pick.ts`](../../apps/editor/src/lib/authoring/stage/stage-pick.ts). Layout chooses
its own winner through [`plan-pick-provider.ts`](../../apps/editor/src/lib/authoring/layout/plan-pick-provider.ts),
while the Scene adapter retains its rendered-raycast, footprint and occlusion policy.
Finite forward 3D hits outrank tolerance-only hits; Plan ranks by the Paper layer order in
[`paper-plan.ts`](../../apps/editor/src/lib/authoring/stage/paper-plan.ts): Room floor 10,
hidden 20, projected 30, cut 40, Opening symbol 50 and Scene footprint 60. With no task, a
press is offered to the primary selection's owner; a fine-pointer Junction hover in Plan is
the one unselected Layout mark exception. Hover is session-only and uses the same resolver.
Window blur, hidden-page, capture loss and pointer cancellation end live
presses; a second pointer ends the authored press and hands navigation the pair. Visible
selection and marks are owned by the Stage mark host
([below](#selection-and-marks)).

Paper is an appearance mask, not pick eligibility. While settled Paper is visible,
`StageCamera` draws the Stage overlay layer 2 only; the pick source's raycaster keeps its
default layer-0 mask and `Object3D.visible` keeps meaning mounted-and-eligible. Shaded Plan
draws world layer 0 and overlay layer 2 together. Paper geometry is never parented under a
registered pick root.

### Selection and marks

The Stage owns one mark host and draws every admitted mark; domains publish descriptors and keep
their planners, refusals and gesture meaning. `StageAdapterBinding.handles` returns
`StageHandleDescriptor`s for the primary selection with no task open. An **editing grip** names the
Card `fact`, its `verb`, the registered domain `planner` a release submits and an optional
`disclosedBy`; a **disclosure mark** only reveals grips — it writes nothing and enters no history.
Admission refuses an unregistered planner or a disclosure that reveals nothing, records a
diagnostic and draws nothing. `extent` is the mark's world reach, never its drawn size: the host
draws the vocabulary at `STAGE_MARK_GLYPH_CSS` (ray 30 px, two-way half 16 px, ring radius 30 px),
keeps 22 px fine / 44 px coarse hit areas, and withholds a ray or ring whose axis is edge-on. An
overlap resolves by the owning domain's descriptor order. A press acquires the one gesture lease
through the binding's existing pointer intent, and digits at a live gesture reuse the Card's
numeric entry.

Selection ink is PLATE gold `#d4ad45` over a dark halo with the 0.18 tint in 3D; hover is neutral
`#F3F4EE`, never gold, and always drawn below selection. 3D ink is built only from a source's
visible meshes — a mesh with a hidden ancestor is skipped — and is never parented under a pick
root. On Paper the same identity is a re-stroke filter over `buildPaperPlan` in
[`paper-marks.ts`](../../apps/editor/src/lib/authoring/stage/paper-marks.ts): a filled subject uses
its union boundary, non-cut lines remain, and the marks sit on layer 2 with `depthTest: false`
above Paper's layer order. A Wall publishes start and end points, a free-end length ray and a
two-way base move ray; it publishes no angle ring — Angle stays the Card's `layout-wall-angle`
writer — and height and thickness grips remain deferred, with thickness a Card field.

A selected Wall's owner has a press on its own body: the binding resolves the pick once
with purpose `select` and claims the press only when the winner is that Wall. The body binding makes an
Opening outrank its own host Wall in Plan Select; 3D keeps Wall-first pick order. A selected Opening
claims its body only when it is the Plan pick winner and moves through the same slide operation as its
position mark. End points move their shared Junction through `planExactJunctionMove`; the body projects the pointer
delta on the Wall normal and submits the unchanged `planRigidWallMove`; the free-end ray keeps
`planExactWallLength`. A press and release below the existing 4 CSS px click tolerance is a click,
the body holds its restored distance until the pointer moves, and the Card carries Start/End X/Z
under one disclosure through the same Junction planner. A refused release writes nothing; its
reason stays at the last pointer until the next press. The cursor reads `move` over that selected
body and `grab` elsewhere.

A selected Scene catalogue model or primitive publishes the same vocabulary : a floor
**Move** track through the footprint centre, a vertical **Turn** ring, a **Scale** point disclosure
and the **Size** ray it reveals along the bounds diagonal. Move submits `place-on-floor` and keeps
the S05 snap step; Turn submits `set-yaw`; Size submits `resize-on-floor` and leaves the base on
its support through the captured `contactMinY`. The Card is the exact writer for Position X/Z,
Yaw and uniform Size, and each field calls the same planner dispatch as its mark, so a typed
value and a dragged value share refusal words and install the same fact. A light, a form, a vertical
plane or a model without verified contact publishes no object marks. Marks are drawn only while no
contributed task is open; opening Place, Compose or Import hides them. The old
Scene Arrange task, its Find entry and its instrument posture are removed; Place, Compose, Import
and the Library posture remain.

The Stage supports one optional `candidatePreview(context)` contribution beside `overlay` and `graphics`:
the subject, affected neighbours and refusal words a domain is proposing right now. A domain
publishes world-space polygons, segments, labels and the winning snap; the Stage facade projects
every point once through the accepted evaluation and `StageOverlay.svelte` draws the result as SVG
in both readings. A refused candidate keeps its full **attempted** geometry on screen as
display-only evidence, separate from the validated candidate that release would install. Its
reason stays beside the pointer; the attempted shape is never clamped or replaced by a dashed
normal, so one gesture can travel valid → invalid → valid without the preview disappearing.
Release while refused writes nothing and restores the accepted geometry with no history entry.
The attempted geometry is never compiled, persisted, admitted to history or serialized. Layout builds its preview from the planner's own
candidate document through the existing compile and `buildPaperPlan` path — the same solve release
commits — and filters it to the changed Wall and Opening ids. Paper's bounded sheet includes a live
candidate's extent, so a drag never leaves the sheet, and the Camera is never reframed by it.

### Coordination over domain policy

The Stage host coordinates pointer routing, arbitration between each domain's winner,
session selection, hover, mark disclosure, gesture leases and interruption. Domains own
eligibility, hit tests and internal ranking, occlusion, marks, gesture meaning, capture
and refusal text. The host does not compute or reorder a domain's hits. The complete
rule, including host tools, spatial arbitration and coarse-pointer targets, is in
[R217 coordination](architecture.md).

### Package responsibilities

| Package | Owns | Track |
| --- | --- | --- |
| `layout-core` | Topology, compilation, Plan representation | T1 |
| `geometry-core` | Native form profile, extrusion, digest | T5 |
| `camera-core` | Viewport, projection, Camera evaluation | T1 viewport; T3 route and motion |
| `project-model` | Units, codecs, Scene planning and validation | T2 Scene; T3 units/F4 |

A runtime-safe helper moves into a package only when it has a second runtime-safe
consumer. Session arithmetic stays in the editor. Persistence classes are specified
in [R217 persistence](architecture.md).


## Where to look (per surface)

Doc routing lives in the router ([`../README.md`](../README.md) §Where truth
lives). Contract truth lives in this document's authority table plus the
component contracts under [`components/`](./components/).


## Geometry boundary

`LayoutDocumentWallFirst` = authored semantic CAD (Junctions, Walls, persistent Rooms, Wall-hosted Openings, objects). `CompiledLayoutGeometry` = derived,
cacheable, renderer-neutral, never serialized; both are owned by
`@portfolio/layout-core`. Native form sources are authored Scene truth and
`@portfolio/geometry-core` evaluates them into a derived, deterministic,
renderer-neutral `FormMesh` that is never serialized; the editor derives normals
and metre UVs from it. No SVG strings, `THREE.*`, DOM,
WebGL/WebGPU handles, materials, cameras, or UI state below the layout
boundary. Plan and unified 3D consume the same compile; no consumer resamples
curves or reinterprets opening topology. Junction resolution is derived in the
same compile (network-aware, per-Wall attributed) and is never serialized: any
Wall end resolved against a canonical Junction carries its resolved join, so a
renderer triangulates compiled geometry instead of solving topology. Degree ≥ 3
Junction material is partitioned locally across all incident Walls — through
continuations suppress their shared interface, branches are trimmed against the
resolved Junction material, and every exposed Junction surface has one
deterministic owner — so per-Wall meshes never rely on overlapping solids for
closure. A Junction with no straight-through continuation pair (a Y or star) is
partitioned by its own equal-clearance sector beams instead, and a configuration
that admits no beam at all fails closed with a blocking
`junction_partition_failed` issue and no mesh — no consumer ever renders
overlapping Wall bodies. The Three
adapter owns buffers, materials, resource lifetime, and raycast identity
adaptation.

Representation is a Layout-owned, runtime-safe evaluation layer on top of this
canonical output (destination): architectural fragment evaluation, section
membership, display maps and supported inverses, and validity are parameterized
by F.3 channel values and consume canonical output rather than reconstructing
competing topology. Only inspection-session UX (recipes, trails, handles,
gizmos, pending gestures, tool policy) stays in the editor; a recipe decomposes
into Camera viewing intent plus typed state contributions, and explicit capture
validates and copies eligible intent into authored resources. Geometry methods
stay specialized — wall unfolding and rigid component separation need not share
mathematics.


## Hard don'ts

Dual nav graphs · a second pose/FOV interpolation authority · second
motion/geometry compiler or consumer-owned architectural reconstruction ·
persist generated endpoints as authored anchors · persist Three/render state in
authored truth (immutable release derivatives excepted) · infer ownership/
adjacency from coordinates · import Chopin/legacy editor state into the editor ·
independent layout-only import · hide the editor behind a build flag ·
Experience UI performing independent camera interpolation · Experience editing
Camera path/timing truth outside Camera · duplicating canonical timing/path
values into Experience truth · a second writable editorial-order authority
(node links beside Experience order) · hiding a semantic domain inside another
document because it has storage space · per-mode resource stores ·
`ExperienceScene` / `ExperienceCameraGraph` / `ExperienceCameraPath` /
`ExperienceRenderer` as a second spatial authority · visitor chunks containing
editor session/selection/history/gizmo code.


## Product convergence destination

[ratification record](north-star.md). This section records
the architecture destination in its owning reference. It adds no shipped capability, changes no accepted
gate identity and grants no implementation permission. Review disposition is in the
[amendment manifest](../archive/roadmap/coordination-2026-10/product-convergence-2026-10-21-amendments.md).

**Identity and revision.** The owner of a semantic fact publishes correspondence when an edit
changes an addressed identity, interval or parameterization. Layout transport maps affected input
intervals to output IDs, offsets and orientation, including side reversal. Surviving unchanged
identities resolve normally. Consumers never infer a replacement by name, order or proximity.
A cross-domain authored consequence uses a registered joint planner and one F.4 acceptance;
readers report repairable state without writing repairs.

**Vertical architecture.** Layout owns structure-local named datums, placed structures and
independently identified roof, canopy, ceiling, slab and void elements. World-local placement
has explicit qualified internal frames and never requires a Room frame. A structure initially
supports translation and yaw; tilt, scale and reflection refuse until explicitly supported.
Each structure has its own Junctions and datums. A connection between structures is declared,
checked and reported broken after an incompatible edit; it never silently follows or shares a
Junction across independently moving frames. Qualified expansion into one compile versus local
compilation remains a mechanism comparison in the vertical cutover plan.

A Wall has one base reference and one authoritative top definition (height, datum or supported
roof-fit), with cycles refused. Floor steps belong to slabs. Rooms derive within a level context
and never own overheads. Fitting is one-shot unless an explicit membership/following policy is
accepted. The cutover must qualify per-level face extraction and 3D duplicate-solid detection;
plan-component independence alone does not establish those properties. C1 can retain the current
single datum losslessly while planning the later versioned Layout cutover.

**Geometry and execution.** One canonical compiler owns persisted family parameters,
qualification, refusal, identity and correspondence. Established geometry libraries, including
higher-level roof and mesh kernels, may evaluate Layout-declared families inside that compiler.
Consumers share the resulting runtime-safe mathematics and compiled output. A kernel exception
is a typed refusal; legitimate empty results remain results. Numerical precision is declared
against a supported coordinate range or local frame. Generated meshes and caches stay outside
authored documents; reproducible compiled delivery derivatives are permitted. A solver reaches
the viewer only where viewer execution requires it. Kernels and families are qualified before
their consuming slice; no new geometry dependency is required by the first batch.

**Delivery and performance.** Editor machinery stays out of public and Preview chunks.
Optional decoders and Preview load when needed. A bundle report justifies runtime-safe solver
modules and compares delivered bytes. The [proposed performance contract](./components/performance.md)
owns browser baselines, workloads, budgets and consuming-slice evidence. C1 profiles duplicated
compile/admission work and qualifies incremental or worker mechanisms against complete result
latency as well as main-thread responsiveness, within the one compiler.

**Decisions intentionally left to consumers.** Native drawing must explicitly decide nested,
overlapping, collinear and intentionally non-enclosing cases before C1 implementation; silent
duplicate floors/solids are unacceptable. C1's answer is the owner-accepted
[T1.P02 drawing policy](../archive/roadmap/closed-phases/t1-spatial-world/t1.p02-native-wall-creation/README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22)
(batch E, E3), which applies as T1.P02's slices land it. The current per-area generated-ceiling fallback remains
until an explicit closure-policy decision. Room-switch is a proposed alternative that removes a
whole Room's fallback, including after merges; mandatory explicit gaps preserve the per-area
alternative. Wall parameter/straddle policies, attachment removal defaults, mezzanine undersides
and compound-roof massing are deferred owner calls, not first-batch prerequisites.

## Sacred contracts

1. **Semantic spatial authoring with evidence-led depth.** Architectural construction extends
   Layout and its single canonical compiler; object form and composition retain Scene ownership.
   The [creative-depth principles](north-star.md#creative-freedom-and-depth) govern specialized capability
   admission without creating a separate general-purpose modeling application.
2. **One project, World | Experience lenses.** The landed `Spatial` shell
   (`Scene | Camera` × `Plan | 3D`) was removed by #115; the bounded shared Stage
   authoring loops above have since landed. The destination
   creator-facing framing is World | Experience over one project, not a
   `WorldDocument` or a merger of semantic authorities. Shell composition,
   navigation and Camera control placement are left to focused design;
   visual-system roles remain owned by the shell contract.
3. **Distinct, never-merged semantic authorities; world-local placement.**
   Layout, Scene, Camera, Experience and typed resources are separate
   authorities and are never merged or hidden inside one another. Scene/Camera
   physical placement is project/world-local with explicit internal component
   frames and no mandatory Room frame. The current F2 units are codec-bounded;
   future source kinds require their owning contracts and explicit cutover, not a second
   format inferred from a prototype. There is no legacy Room-local
   compatibility read path: versionless room-frame
   payloads are not decoded.
4. **One canonical architectural compiler.** Architectural geometry and queries
   come from the single canonical compiler (or its evolved successor), never
   from competing consumer-specific reconstructions. Layout-owned runtime-safe
   representation algorithms consume its output; shared kernel dataflow and
   release lowering are not a second geometry authority.
5. **One Camera authority.** Connectivity, routes, framing, projection and
   evaluation have one authority; every profile controller and Experience
   navigation intent resolves through it, and no second navigation, motion or
   pose/FOV interpolation model exists. Experience owns occurrences, order,
   holds, explicit Gates, interaction policy and continuation; invocation time mapping evaluates
   through Camera. Cue ownership follows the source: Camera emits its own
   progress markers, performances own their cues, Experience owns interaction
   bindings to them. Current filenames and the curve/guard mechanism are
   replaceable implementation.
6. **Topology and Sequence stay different.** Connections describe possible
   movement; Sequence describes ordered guided traversal. Neither silently
   rewrites the other.
7. **Deterministic selection/history.** Selection identity is canonical across
   representations; one completed user/agent command or gesture produces one
   logical transaction/history result where history applies. Compound
   cross-domain acceptance (F.4) implements this boundary for the shared project;
   future geometry consumers keep the same obligation.
8. **Portable, versioned project truth; separate release formats.** The native
   editable project export is versioned and atomic; publishing compiles accepted
   source into separately versioned visitor packages instead of treating the
   authoring schema as the delivery format. Account save, cloud persistence,
   publishing and AI operate on the same authored model rather than inventing
   incompatible copies. Immutable delivery derivatives are explicit and are not
   authored truth.
9. **Visitor/editor isolation.** Published/visitor runtimes consume safe project
   data and runtime modules; editor session, selection, history, gizmo,
   import-management and authoring infrastructure never leak into the visitor
   surface. Runtime-safe domain evaluators (for example Layout representation)
   are shared with visitor runtimes — isolation is about editor machinery, not
   about forking domain mathematics into editor-only code.
10. **Greenfield product lane, and separate frozen projects.** New projects
    start from the product's own format. A frozen, separately deployed project —
    such as the Chopin museum — is not a migration source for editor selection,
    history or workspace state, and the product neither imports nor serves it.
    The product supports exactly one document format (wall-first Layout with a
    world-local Scene): there is no legacy reader, detector, classifier or
    migration path, and no compatibility obligation for formats the retired
    editor wrote. Recoverable history is a Git concern, never a product reader.
11. **Experience references World — and owns its own layer.** Experience binds
    to existing subjects, Camera views and routes and composes visitor-facing
    meaning, editorial occurrences, order, holds, continuation and interaction
    bindings; it never creates duplicate camera positions, graphs, sequences,
    paths, room definitions, scene objects or layout geometry, and it never
    performs independent camera interpolation. Experience controls may edit
    Camera truth through canonical Camera operations; declared time mapping is
    evaluated through Camera.
12. **One typed resource system with explicit identity.** Project and library
    scopes share one typed resource system with revisions, dependency locks and
    no per-mode or per-owner stores; a project-local definition may be inline
    initially provided it has the same identity, scope and reference semantics
    as a later library resource. Delivery copies of one immutable revision are
    not competing mutable definitions.
13. **One semantic authoring path per intent.** Human UI, automation, and
    future agent/API clients converge on the same validated project mutation
    semantics wherever practical. Agent authoring must not create a parallel
    Scene/Layout/Camera/Experience representation, bypass domain authority, or
    produce a second history model. This coexists with contract 7.
14. **Connectivity is explicit.** Junction IDs own Wall connectivity. Proximity
    may offer a snap/join but never silently becomes authored topology, Room
    ownership, or semantic adjacency.
15. **Persistent Room identity is product-owned.** Geometry/topology may derive
    candidate enclosed faces; it never independently allocates/recreates
    persistent semantic Rooms. Identity reconciliation/history is deterministic.
    Under the owner-accepted independent-placement policy, geometric
    coincidence, containment or shared interior alone cannot transfer Room
    identity or join independent components. A predecessor Room is carried to a
    candidate face only through operation lineage proved by canonical
    Wall/Junction identity; unrelated Room identities, boundary references,
    associated-object ownership and hosted Opening bindings remain unchanged.
