# North Star — product direction

**Owns:** the full creative destination, product principles, non-goals and capability admission.
Architecture owns semantic boundaries; domain and shared contracts own technical detail; approved
UX designs own their desired state. Implementation limits do not narrow an approved design.
Routine implementation does not change this reference. Change it for an actual product-contract
change, accepted design promotion, material contradiction or deliberate audit.

Core Product Stability is the owner-accepted starting point: room and shape creation, direct
manipulation, Camera and Experience authoring and visitor Preview. The complete destination below
is not a claim of shipped capability. Prepared public publishing and advanced Object Studio remain
future work. Automated evidence status is separate from owner product acceptance.


## Product destination

> Biskiq is a browser-native environment for creating, composing, inspecting, directing, and publishing editable spatial experiences. Creators work with meaningful spaces, objects, components, light, sound, and information, and shape how an audience explores and participates. A project may start from native architecture, imported content, reusable components, or an experience idea; no Room, tour, or external modeling workflow is mandatory.
>
> Its central value is a continuing creative project. Creators inspect structure, arrange alternatives, direct a presentation, share it, and revise it while retaining accepted work. Relationships preserve only the intent they explicitly declare. Changes reveal affected presentations, invalid references, and required repairs instead of silently inventing replacements.
>
> Composition distinguishes definitions, instances, components, grouping, and attachment. Native and imported content participate according to supported capabilities. Layout owns multiple levels, placed structures, reusable architectural definitions and validated alternatives through one canonical architectural compiler. Reusable architecture, objects, Camera resources, states, and performances have typed interfaces and explicit revisions; bindings and scoped overrides adapt them without duplicating authored definitions. Intrinsic behavior remains usable independently of a particular tour or project.
>
> Direction combines named states with reusable performances. Simple work can be authored as views, states, and guided Stops; richer work coordinates Camera, components, architectural representation, light, media, and visitor participation with explicit timing and lifecycle. Typed, serializable session state and bounded deterministic expressions support guards, derived values and choice availability. Arbitrary scripting is a separately governed extension, never the ordinary authoring prerequisite.
>
> Scene owns object composition, placed-instance semantics and world presentation. Camera owns views, spatial routes, framing, projection and an extensible motion vocabulary; viewer controllers realize intent through that authority. A project contains multiple Experiences over its shared world. Each owns visitor meaning, localized content, UI configuration, editorial occurrences/order and contextual orchestration. Scene ambient bindings apply across Experiences under the common channel policy. New semantic domains declare ownership, persistence, validation, evaluation and release contracts rather than being hidden in another domain.
>
> Shared composition and execution rules resolve qualified identity, bindings, overrides, typed channels, dependencies, session logic and local time while preserving specialized domain authorities. Common contract shapes precede capability formats; implementations grow through useful slices. Architectural representation is runtime-safe Layout evaluation driven by typed parameters; editor inspection recipes can explicitly capture Camera intent and state contributions for presentation. Domain document count, storage layout and present algorithms do not define the product ceiling.
>
> Temporary inspection, authored intent, evaluated output, execution-session state and persisted audience/collaboration records have distinct lifetimes. Comments, approvals, saved configurations and shared-session records remain outside authored source, with their own retention/privacy rules. Semantic addresses and release context preserve their meaning through revisions; removed subjects are reported as orphaned, and an old approval never silently approves a new revision.
>
> Publishing compiles an accepted revision, selected Experience(s), and a delivery profile into a visitor-safe package with explicit semantic compatibility and resource closure. Each published Experience has its own publication pointer; semantic locations persist across republishing while their subjects persist, and pinned release addresses preserve historical context. Compatible runtimes support interactive links, embedding, presenting, stills, and film through declared execution choices. Immutable delivery derivatives are separate from authored truth and native editable exports. A Release Baseline governs the first durable prepared-visitor package; a separate Source Baseline follows landed foundation formats. Visitor release readers never depend on the changing authoring validator.
>
> Human manipulation and agents operate the same inspectable capabilities through typed, serializable intents and expected-revision validation. Cross-domain acceptance is atomic and produces one undo result. The product earns its value through creative usefulness, reliable revision, reuse, and audience outcomes. Ordinary spatial experiences do not require general mesh modeling, engineering simulation, or game-engine programming.

Build, Stage, Direct, and Experience express capabilities, not a mandatory
waterfall. The conceptual loop is:

```text
Compose / Build
↔ Stage
↔ Direct
↔ Shape visitor experience
→ Preview / validate
→ Publish
→ Revise
```

The product is **not** a Blender replacement, a game engine, a BIM system, a
Webflow-style website builder, a general CMS, or a Figma/Canva-style 2D design
suite. Its value is the combination of **semantic spatial authoring + experience
direction + visitor-facing web UI + a portable, publishable runtime**.

Human direct manipulation, structured authoring, and AI/agent authoring operate
on the same semantic project model, as clients of one canonical state. AI is not
a separate generation mode, and the product is not primarily a prompt-to-3D
generator.

### Creative freedom and depth

These principles guide new design; they neither describe shipped T5 functionality nor select its
implementation.

- **Disciplined creative freedom.** Creators draw, shape, arrange and refine spatial work with
  room for individual expression. Complexity earns its place through creative value, predictable
  revision and reuse, rather than feature parity with another modeling application.
- **Contextual spatial creation.** Visible work and deliberately chosen spatial context can inform
  supported creation and editing. Direct interaction remains understandable, with non-sketch
  equivalents; recognition and modeling knowledge must not become admission requirements.
- **Composable relationships.** Spatial intent can be deliberately reused across form and
  arrangement. Continuing following, constraints and exceptions are explicit; proximity, a gesture
  or a one-time placement does not silently create a persistent dependency.
- **Progressive depth.** World editing and a dedicated Object Focus scope share authored subjects,
  identity, relationships and revision. Depth is available when needed without requiring an ordinary
  creator to manage mesh topology, construction order or a full CAD/DCC workflow. Exact Focus UX
  remains open within the ratified shell authority.
- **Dependable revision.** Supported edits retain their meaning across accepted changes, Undo,
  Save and reopen. Consequences, lost support and repair are legible; ambiguity never silently
  retargets or discards work. Precision and preservation promises have explicit scope.
- **Semantic ownership.** Layout, Scene, Camera, Experience and typed resources retain their own
  meaning and validation through one project acceptance path. Creative depth adds no competing
  document, compiler, history or renderer authority.
- **Evidence-led capability expansion.** Admit depth for a demonstrated creative barrier, with
  transfer, revision, correctness, browser cost and failure/recovery evidence. Simpler controls,
  imported content and existing capabilities remain valid solutions; an experiment may narrow or
  reject the proposed workflow.

Interaction design, source/geometry representations, kernels, milestone definitions, slice counts,
sequencing and specific implementation direction remain TBD where evidence is insufficient. The
workflow advantage is a hypothesis. The E0 experiment was withdrawn on 2026-10-27; T5's planning
direction is its [umbrella plan](../roadmap/t5-expressive-geometry/umbrella-plan.md), which is
roadmap authority, not a reference contract. Sculpting, surface
refinement or deliberately authored geometric controls are neither promised nor excluded solely
by technique. They must earn admission through this boundary.

### Current state labels

Where this document describes implemented behavior it says **current**; where it
describes the ratified destination it says **destination**. The destination is
not shipped. Foundation contract shapes are registered in the roadmap
([`../roadmap/f-foundation-contracts/README.md`](composition-execution.md));
capability planning follows them.



## Composition, behavior, and direction model

**Use named states as the approachable starting point, with reusable timed
performances where needed. Do not make states or moments the only representable
behavior.** Direction combines named states with reusable performances: simple
work can be authored as views, states and guided Stops; richer work coordinates
Camera, components, architectural representation, light, media and visitor
participation with explicit timing and lifecycle. This is more than an
endpoint-state model: a pump rotating while narration continues across camera
cuts has phase, cues and independent instances that endpoint states cannot
express.

| Concept | Meaning | Example |
| --- | --- | --- |
| Subject | An addressable domain-owned entity or supported component, with declared capabilities. | A Wall, assembly instance, light, camera view, or contextual content item. |
| State | A partial declaration evaluated against an explicit baseline and override policy. | Evening lighting, casing hidden, variant B. |
| Performance definition | A reusable resource declaring target roles, parameters, channels, timing or progress, child uses and lifecycle. | An object opening, a reveal, coordinated lighting and narration. |
| Binding / invocation / run | Assign definition roles to subjects; author a use with parameters and timing policy; execute it with private session state. | Two watches using the same opening definition at different times. |
| Moment | A useful authoring/preview bookmark combining a view, resolved presentation state, content and permitted interaction. It need not be another stored entity kind. | The point at which an explanation pauses for inspection. |
| Presentation | Experience-owned reusable visitor-facing meaning and composition, with an explicit entry policy; it may reference subjects, Views, content and supported Activities. It is not a portable performance definition. | “Why this piano matters” or “How power reaches the generator.” |
| Stop | A stable Guide occurrence referencing a Presentation, with contextual entry, pacing and continuation. Several Stops may reference one Presentation. | The same Piano Presentation entered twice with different framing. |
| Experience | The visitor-facing composition of Presentations, Experience-wide Interactions, optional Guides and bounded session logic. | Free exploration, a tour, or an interactive explainer. |

“Destination” remains ordinary vocabulary for a typed navigation target or
address, not a second authored entity. A Presentation can exist without a Guide;
an Experience may also expose Interactions without either a Guide or a
Presentation. A Presentation may focus on zero, one or several World subjects,
a spatial relationship or a captured viewpoint; focus does not automatically
retarget its Camera Views. A reusable **performance resource** carries portable
choreography and typed roles independently of an Experience Presentation.

Repeated occurrences need occurrence identity: the current guided flow stores
next/previous links and holds on camera nodes and its walker rejects revisiting a
node before returning to the start, so the accepted Intro → Piano → Paris →
Piano → Exit journey cannot be represented as distinct visits. Occurrence
identity is a concrete requirement of the destination. Editorial order never
lives as a second writable authority beside node links.

**Typed session state and declarative logic (destination).** Typed, serializable
session declarations have Experience or package-program scope, with explicit
initial values, reset behavior and permitted writers. Every declaration has an
authored owner: an Experience or a typed reusable resource; package scope creates
no second authoring authority. Runs receive isolated values unless a shared
session scope is explicitly declared. Runtime choices, variant selections and
rejoin state are neither Scene overrides nor writes into authored declarations.
The kernel evaluates a bounded, deterministic, side-effect-free expression form
for guards, derived values and choice availability; state transitions and effects
occur through explicit actions/reducer events, and variant constraints remain
validated by their owning domain. No unbounded recursion, hidden clock/network
access, or arbitrary creator code is implied. Syntax, UI and the initial operator
set are planning choices. This sanctioned declarative tier replaces the earlier
blanket rejection of variables or conditions; scripts remain the separately
governed extension-module exception. A future stateful simulation must expose its
state, stepping, replay limits and resource budget explicitly.



## Ownership, authority, and lifetimes

A semantic owner is not a database table, storage folder, or UI mode. Authority
is by concern, not by document count.

| Concern | Owner |
| --- | --- |
| Architectural topology, dimensions, hosted Openings, levels, placed structures, architectural definitions/instances, alternatives, parameters and validity | Layout; runtime-safe contextual representation is Layout-owned. |
| Object definitions, components, base transforms, variants, attachments, materials, lights, placed instances and world presentation | Scene, including environment/atmosphere, render settings and spatial trigger subjects. |
| Views, spatial connectivity, paths, framing, projection policy, intrinsic movement profiles and camera evaluation | Camera, including reusable Camera resources. |
| Reusable states, clips, performances, their typed role interfaces and composition | Typed resources in the common resource system; domain adapters own what their channels mean. |
| Presentations, optional Guides and Stops, editorial order, visitor-facing content/localization/UI configuration, choices and contextual Activity/Interaction bindings | Experience, as a distinct authored semantic domain. |
| Source bytes, immutable resource revisions, derivatives, provenance, retention and resolution | Shared resource infrastructure serving every domain (destination: project and library scopes, not a mode-specific store). |
| Accepted project revision, dependency lock, cross-domain validation, coherent history, release preparation | Project coordination over domain operations and resources. |
| Active runs, clocks, channel control, visitor choices and media position | Execution-session state, isolated per preview/visitor/session; playback never writes back into authored definitions. |
| Temporary authoring inspection | Editor-session recipes, trails and tools supplying permitted domain parameters; explicit capture can produce authored intent. |
| Persisted comments, approvals, saved visitor configurations, shared-session snapshots and outcome analytics | Audience/collaboration records outside authored source, anchored by public semantic address and release context, with separate access, retention and privacy policies. |

**Multiple Experiences per project (destination).** A project supports several
Experiences over one shared world — for example a client review, a public
explainer, a kiosk loop and a guided tour. Each owns its editorial occurrences and
orchestration. Scene ambient bindings apply in every Experience's execution
context; Experience invocations apply to the selected Experience. Multiple
Experiences in one package do not implicitly run simultaneously. One-Experience
initial UI does not narrow the contract.

**Layout multiplicity (destination).** Layout owns levels, placed structures,
reusable architectural definitions and validated alternatives through the one
canonical architectural compiler. World-local project placement permits explicit
structure/instance frames; it does not require one floor or mandatory Room
coordinates. Level-aware references, vertical semantics and Plan contexts are
foundation work even if the first UI exposes one level. Host-topology expansion
versus isolated structures, and slab/ceiling ownership, remain focused Layout
decisions before the relevant vertical implementation.

**Residual ownership rule (destination).** World presentation defaults to Scene;
visitor-facing meaning, localization and UI configuration default to Experience.
A spatial trigger subject and its contextual action binding therefore have
different owners. Admit any other semantic domain only by declaring its
authority, foundation-reference conformance, persisted codec unit, validation,
channel families/operators, evaluator and release lowering, effects, and
conformance fixtures. Shared data-source transport is infrastructure; any
source-specific semantic state or behavior needs this ownership declaration.
Never hide a new domain in an existing document merely because it has storage
space.

**Audience data has its own lifetime (destination).** A saved visitor
configuration records chosen public inputs against a release; it does not change
Scene defaults. A comment or approval retains its original release context even
when its subject can be located in a newer release. Carry records forward only
through identity continuity, report removed targets as orphaned, and never imply
that approval of one revision approves its successor. Persisting a session
snapshot does not turn execution state into authoring truth; its storage and
retention belong to the separate audience/collaboration boundary. Public
addresses name a publication or pinned release plus a semantic location keyed by
durable subject/occurrence identity; removal or incompatible replacement is
reported explicitly, never silently redirected by name or position.

### Project truth (current and destination)

**Current:** one F2 `ProjectEnvelope` holds distinct codec-bounded Layout, Scene, Camera,
Experience and resources units with accepted revision and dependency lock. Layout is wall-first
over one floor datum; Scene placement is world-local with no `roomId`. Exact live versions belong
to [persistence](./components/persistence.md#one-source-format-f2-clean-epoch).
There is no legacy reader, detector or migration path:
versionless room-frame payloads are no longer decoded, and a malformed or
historical payload fails ordinary current-format validation. Generated geometry,
Three objects, renderer handles, decoded runtime objects, gizmo proxies,
selection, hover/transient gesture state and undo history are not serialized as
authored project truth.

**Destination:** one explicit codec-bounded unit per semantic domain inside a
project envelope holding the accepted revision and dependency lock (F.2;
[`composition-execution.md`](./composition-execution.md)). Typed resources keep
their identities whether inline, library-hosted or vendored. Camera and Experience already have
separate codec-bounded units in the current envelope. Codec boundaries do not prescribe database tables,
files, or format numbers. The
Experience unit supports a collection.

**Storage is implementation, not product ceiling.** Document count, storage
layout and present algorithms do not define the architecture; the authorities
above do. Editor camera trails, temporary selections, hidden authoring aids and
pending gestures never become visitor behavior incidentally.



## Build — World architecture

Detailed obligations live in [Build — World architecture](components/layout.md).

## Stage — World composition and shared assets

Detailed obligations live in [Stage — World composition and shared assets](components/scene-content.md).

## Direct — Camera direction

Detailed obligations live in [Direct — Camera direction](components/camera-tour.md).

## Experience lens — visitor-facing composition

Detailed obligations live in [Experience lens — visitor-facing composition](components/experience.md).

## Same world, different authoring lens

World and Experience operate on the same project, world, cameras and resources,
exposing different authoring lenses over shared truth:

```text
same project · same world · same cameras · same resources · same runtime
        ↓
different authoring surface / authority
```

World authors Layout/Scene source truth; Experience authors visitor-facing meaning,
occurrences and interaction over it. Experience does not require an independent
renderer or an alternate scene. Do not create duplicate camera graphs, sequences,
paths, room definitions, scene objects or layout geometry, and do not fork domain
evaluation into Experience-only code. Domain count and document boundaries no
longer define the model — semantic authorities do.

Lens switching itself changes authoring intent only: the canonical selection and the
Camera standpoint carry across, and a switch never captures a View, creates a
Presentation or relation, opens a Guide, moves the Camera, or substitutes another
selected identity.



## Camera authority vs Experience interaction authority

Detailed obligations live in [Camera authority vs Experience interaction authority](components/experience.md).

## Interaction and behavior authoring

Detailed obligations live in [Interaction and behavior authoring](components/experience.md).

## Web experience layer

Detailed obligations live in [Web experience layer](components/experience.md).

## Preview and publish

Detailed obligations live in [Preview and publish](components/persistence.md).

## Developer and export direction

The same authored project supports several consumption levels (destination):

```text
Non-developer      → hosted publish
Developer          → downloadable / static self-contained profile
Experienced dev    → project package + runtime SDK
Advanced           → headless/embedded runtime over the same semantics
```

A future runtime SDK exposes loading, instance creation, supported input/action
calls, events, semantic queries and session control. It consumes the same
semantic program and canonical domain systems; it never exports editor internals,
and arbitrary writes must not bypass channel or domain rules. Authored Experience
UI is optional for developers — use it, override/style it, or build a custom
application UI. **No SDK is defined or implemented now.**

External live data must be declared as such, with typed inputs, failure behavior,
and capture/replay options where reproducible output is required. Static export
creates an independently held copy: hosted Unpublish can stop future managed
delivery but cannot revoke previously downloaded bytes. Portable playback and
irrevocable centralized revocation cannot both be guaranteed for the same
exported bytes.



## Accounts, backend, and collaboration

Local-first project editing remains valid; the complete product also supports
authenticated accounts and persistent cloud projects. Cloud persistence wraps the
canonical project document rather than replacing it.

**Current:** `projects` + `project_versions` versioned JSONB; conditional Save validates the
F2 capture and its `create-only` or `expected-saved-base` precondition under a project-row lock.
The [persistence contract](./components/persistence.md) owns saved-base conflict and recovery
semantics, distinct from local expected-revision acceptance. Local username/password credentials
authenticate account access; Fastify + Postgres own product authorization and project permissions.

**Destination:** one accepted project revision and dependency lock; deterministic
authoring operations from an expected revision plus a typed, serializable intent;
atomic cross-domain acceptance with one undo result (F.4) — first implemented
with the Experience cutover. Domain-specific intent schemas and planners remain
specialized. Blob upload and metadata acceptance need a staged protocol, never a
fictitious distributed transaction across storage providers. Event sourcing,
CRDTs, branch merge and selective actor undo remain separate decisions.

**Collaboration and audience records (destination):** persisted comments,
approvals, saved visitor configurations, shared-session snapshots and outcome
analytics live outside authored source, anchored by public semantic address and
release context, with their own access/retention/privacy policies. They follow
identity continuity across releases, report orphaned targets, and never become
authored truth or silently approve a successor revision. Live presentation
coordinates an ordered input stream and release-qualified typed session snapshots
and clocks; late join/reconnect restore supported session state without
concurrent editing of the project.



## AI and agent surface

AI is a first-class authoring client, not a separate opaque generation mode.
Human UI actions and AI/agent actions converge on the same typed, serializable
domain operations, expected-revision validation, and diagnostics:

```text
inspect → propose → apply typed operations (expected revision)
→ preview → validate → refine → checkpoint/version → publish
```

The preferred agent surface is high-level semantic operations — not arbitrary
raw project JSON mutation, generated Svelte component trees, direct Three.js
object mutation, pointer-level UI automation where a semantic operation exists,
or arbitrary JavaScript/Python execution as the primary product API. Low-level
escape hatches may exist eventually but are not the canonical contract; repeated
stable semantics with demonstrated reuse are candidates for reusable primitives.

Agents receive the same impact, binding and conflict diagnostics as people, and
AI-generated work remains normal project state: inspectable, undoable or
versionable, permission-aware, manually editable, and subject to the same
authority and validation rules. Generated resources enter the same canonical
resource ingest and provenance path — no parallel scene or resource format, no
bypass of the canonical architectural, selection, camera or persistence
pipelines.

A bounded agent/reuse proof remains direction and a §9 proof-portfolio item: test
whether a strong agent can inspect a project, make semantic edits, stage, author
camera/experience changes, validate, preview, publish and revise through the same
canonical behavior as human authoring — before broad platform expansion.
Transport (in-process TypeScript, MCP, REST, WebMCP) stays replaceable; no
custom planner, chat UI, generic agent framework or large MCP surface is required
for that proof.



## Shared authoring operations

Detailed obligations live in [Shared authoring operations](composition-execution.md).

## Sacred contracts

Detailed obligations live in [Sacred contracts](architecture.md).

## Release and Source Baselines

Detailed obligations live in [Release and Source Baselines](components/persistence.md).

## Technology gates

Current production choices remain deliberate rather than ideological:

- SvelteKit + Svelte 5 + TypeScript remain the product/UI foundation while they
  fit measured requirements.
- Three/Threlte remain the current production 3D renderer for the retained
  visitor runtime and dev previews; the editor's SVG Plan renderer
  (`PlanRenderModel` / `PlanSvg.svelte`) was removed by #115 with the editor
  shell. T1 may rebuild the viewport around one evaluated projection; retaining
  SVG for projected precision overlays is a proposed mechanism, not a separate
  Plan geometric/input authority.
- Backend, persistence, asset storage/delivery, auth, realtime, hosting and
  external integrations are platform boundaries; vendor choice may change
  without changing project truth.
- External asset/tool integrations remain adapters into one canonical
  ingest/asset-record boundary; provider schemas, temporary URLs, file formats
  and storage details do not become durable Scene/Project state.
- WebGPU/WGSL stays bounded until a real product or performance requirement
  justifies promotion. Rust/WASM requires an isolated CPU bottleneck and
  boundary-inclusive proof; it is not a default rewrite target.
- Shader/runtime implementation source never becomes serialized authored project
  truth merely because the renderer uses it.
- Optimization work follows measured large-scene/runtime bottlenecks. Future
  needs may include instancing, LOD, culling/occlusion, streaming, asset
  optimization and cached/baked procedural derivatives without changing
  ownership contracts.
- Kernel substrate, container encodings, serialized Camera preparation,
  compilation placement, correspondence algorithms, invalidation/cache design
  and history implementation (snapshot/op-log/CRDT) remain **open** mechanism
  decisions within the ratified F shapes.



## Permanent non-goals

- general-purpose DCC-style mesh editing, sculpting, UV authoring, rigging, or
  character-animation authoring as the normal editor workflow
- a second layout geometry compiler or consumer-owned architectural truth
- a second camera/navigation/motion graph competing with the canonical Camera
  authority
- two coequal writable editorial-order authorities (node links beside
  Experience order), or Experience duplicating camera, geometry, room or
  scene-authoring systems instead of referencing domain-owned World truth
- persisting Three.js/renderer objects, generated geometry, gizmo state,
  selection, or transient editor state as project truth (immutable reproducible
  delivery derivatives outside authored documents are permitted, not authored
  truth)
- making deep code or game-engine scripting mandatory for ordinary spatial
  experiences
- becoming a general-purpose 2D design suite, BIM system, game engine, CMS,
  Webflow-style website builder, or landing-page builder merely through feature
  accumulation, or competing with Figma/Canva as a 2D design suite
- a generic AI agent framework, or training a proprietary general 3D/world
  model — external models, generators and agent intelligence stay replaceable
  clients/suppliers, welcome through supported ingest
- per-mode or per-owner resource stores, or a resource format that duplicates a
  domain's authored truth
- proximity-derived implicit topology/ownership or silent automatic topology
  repair
- silently flattening/conflicting-normalizing legacy authored data merely to fit
  a newer schema
- migrating legacy/Chopin editor session state into the greenfield product

Use the [creative-depth admission test](#creative-freedom-and-depth) before expanding authoring
depth. A local shaping or surface capability is not permanently external merely because it uses
mesh controls or sculpting techniques; neither is it committed scope. General-purpose DCC/CAD,
retopology, UV/rig authoring, character animation and arbitrary shader/node authoring remain external
workflows. Imported or generated results remain welcome with truthful supported capabilities.



## Deferred scope is not a non-goal

The following may be valuable long-term even when intentionally absent from
current implementation slices:

- larger building/district workflows beyond level-owned multiplicity
- richer parametric architectural operations and terrain/roads/vegetation
- procedural resource libraries with editable parameters and cache/bake runtime
  derivatives
- canonical resource ingest/normalization, online-provider search/import, and
  provenance-aware project credits
- assisted or AI-generated layouts, staging, tours, framing, interactions, and
  complete first drafts
- multiple tours, branches, conditional experience flow, and free-roam rejoin
- Experience workspace depth: visitor menu authoring, Presentation/address binding UI,
  contextual titles/info cards, visitor preferences, reduced-motion behavior
- richer reuse: cross-project kits, library updates/repair, compatible variants,
  architectural alternatives, and participation/rejoin
- developer runtime SDK and headless runtime integration
- user-wide reusable resources ("My Assets")
- account persistence, project dashboard, backend APIs, resource storage, and a
  dedicated hosted editor
- collaboration, teams, permissions, comments and version history
- resource marketplace/licensing and advanced external 3D-tool interoperability
- hosted publishing depth, custom domains, embeds, and downloadable web builds
- community/gallery ecosystem (Landing, Examples, Guides, Sign in, Dashboard)
- agent/MCP/API authoring depth and automated preview/validation loops
- domain-level validation and observability for authoring and agent loops
  (constraint checks, spatial facts, camera/route integrity, performance
  signals) — established incrementally, not as a giant validator subsystem now

Absence from today's tracker means **not scheduled yet**, not rejected by the
product vision. Sequencing is owned by [`../roadmap/README.md`](../roadmap/README.md).



## Agent-readiness acceptance direction

Future architectural acceptance principles — not claims that they all pass
today:

1. A human UI action and an equivalent headless semantic operation produce the
   same authored document delta.
2. One completed operation produces one logical transaction/history result where
   history applies.
3. Domain operations mutate their owning authority; cross-domain operations use
   the compound acceptance contract (F.4) rather than accidental side effects.
4. Each semantic transform preserves components outside its operation; a change
   of viewpoint never changes authored state or ownership.
5. New Scene/Camera physical placement is project/world-local; explicit
   relationships are never inferred merely from coordinates, and legacy
   Room-local data is never silently or doubly converted — there is no legacy
   read path.
6. Camera operations reuse the canonical route/motion authority.
7. Generated resources enter the canonical resource ingest path.
8. Visitor runtime consumes project truth without editor
   selection/history/gizmo/session infrastructure.
9. Validation can run without requiring UI pointer interaction.
10. Project changes remain serializable/versionable and contain no
    renderer/Three objects.



## Strategic success test

The AI/reuse thesis is falsifiable. Eventually compare the same capable model,
same brief, same assets and same acceptance criteria on project types such as
gallery/exhibition, product showroom, spatial portfolio, guided educational
experience, or architectural walkthrough, against:

```text
A. Biskiq / canonical operations
B. strong reusable-code / Three.js starter baseline (not generate-from-zero)
```

Measure revisions as well as first creation: total time/intervention to accepted
published result, total cost/failed attempts, revision correctness plus unrelated
regressions, cold publish/runtime success, manual continuation/editability, and
reuse in a second project. Do not invent numeric wins — no 2×/3×/10× savings are
claimed until measured. These are strategy metrics, not current release gates.
The decisive early validation is **a revisable spatial presentation for a real
client, reviewer, or audience**: creator/audience trials around the first
complete revision loop (import or build → place → direct → publish → receive
feedback → revise → re-share), with real creator material.



## Product convergence destination

creative findings motivate this direction; they do not adopt prototype encodings or chrome.

**Draw, arrange, explain, revise.** A creator can build architecture, compose their own objects,
explain an object or an admitted part, and revise that work without losing identity or unrelated
intent. A meaningful Presentation needs no Room, Guide or Stop. An explanation is reusable
standalone, among other content in a Room/exhibition, and within a Guide, without copying Scene
truth. One Presentation over one placed instance is a bounded first-consumer choice; definition
reuse and multiple Presentations remain open growth paths.

**Expressive architecture.** Named datums live in explicit structure-local frames; conventional
storeys are an optional workflow. Walls have one base and one top definition; floor steps belong
to slabs. Roofs, canopies, ceilings, slabs and voids are independent Layout elements, usable without
Rooms. Native forms grow family by family in the canonical compiler, with honest qualification
and supported imports. The first single-datum Wall loop does not cap that ambition.

**Intelligent, capable interaction.** Gestures expose the intended result, scope and repair before
acceptance, with precision and keyboard equivalents. Independent placement and deliberate
following are distinct authored choices. An observed part, clip or variant is offered as a
capability only after its owner admits and validates it. Experience owns explanations and actions;
Camera remains the one viewing authority. Source and resource revisions preserve correspondence
or explain an unresolved reference without silently guessing a replacement.

**Performance and design development.** Editor and viewer usability is judged in a browser on a
regular laptop through [the proposed performance contract](./components/performance.md).
Resolve demonstrated material costs inside the consuming slice, preserving architectural
expressiveness. Product licensing is undecided: the owner rescinded the copyleft choice
([2026-10-23 ruling](../workflow.md)). Established
libraries remain candidates when justified by correctness, capability and performance; dependency
licence compatibility must be established for the eventual product licence and shipped build;
until then new dependencies follow the owner's permissive-only admission ruling (same record), except that T5
may adopt weak-copyleft libraries after a documented compatibility, distribution and compliance review
([T5 licensing amendment](components/assets.md)). Shared shell rules remain PLATE-owned.
Precise integration of new prototype capabilities develops in each consuming slice through a
reviewable draft, build, browser observation and revision; unfinished feature layout does not
block unrelated capability planning.
