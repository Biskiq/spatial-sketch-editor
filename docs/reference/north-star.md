# North star — ratified product direction

**Read when:** choosing product direction, defining long-term scope, or reviewing
pitches. **Current implementation priorities and sequencing live in the tracker:**
[`../roadmap/README.md`](../roadmap/README.md).

**Authority:** this document carries the promoted, live statements of the ratified
2026-09-27 direction as refined by the
[`2026-09-29 World | Experience amendment`](./decisions/world-experience-reconciliation-2026-09-29.md);
the [September 27 decision record](./decisions/northstar-ratification-2026-09-27.md)
is historical decision provenance and the normative baseline. Where this document
and pre-ratification reference/roadmap text conflict, the ratified direction wins.
Landed contracts keep describing current behavior until their explicit cutover; no
target capability below is presented as shipped. Open mechanism decisions (encodings,
kernel implementation, level mechanism, channel operators) are named as open, not
invented here.

**Current shell:** the shipped `Spatial` workspace (`Scene | Camera` × `Plan | 3D`)
is the current authoring surface; `Experience`, `Assets` and `Publish` are the
project-level surfaces from the 2026-08-31 shell ratification — **Experience
authoring is still destination, not shipped**, while Assets/Publish have current partial
implementations (P20/P22). Composition, material, typography and control metrics are owned by
[`design-system/editor-shell-and-visual-system.md`](./design-system/editor-shell-and-visual-system.md);
shell changes still require focused capability/design planning. Current labels do not
constrain the destination data model or future creative scope. **Destination
product framing (owner-directed reconciliation, 2026-09-29):** creators work
through **World | Experience** lenses over one project. World is not a
`WorldDocument`; it exposes Layout/Scene truth, typed resources and Camera
inspection. Experience exposes visitor-facing composition and may delegate
View/framing/movement edits to the canonical Camera authority. The replacement
shell's accepted destination composition is recorded in the shell contract
([`design-system/editor-shell-and-visual-system.md`](./design-system/editor-shell-and-visual-system.md)
§0.8); the landed shell remains current until an explicit cutover.

## Ratified north star

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

### Current state labels

Where this document describes implemented behavior it says **current**; where it
describes the ratified destination it says **destination**. The destination is
not shipped. Foundation contract shapes are registered in the roadmap
([`../roadmap/f-foundation-contracts/README.md`](../roadmap/f-foundation-contracts/README.md));
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

**Current:** one `ProjectDocument` holds separately owned `LayoutDocument` and
`SceneDocument` domains; Layout is wall-first (`formatVersion: 5`, one floor
datum), Scene is world-local (`formatVersion: 1`, no `roomId`) with Camera data
stored inside Scene. Versionless room-frame payloads are legacy compatibility
reading only. Generated geometry, Three objects, renderer handles, decoded
runtime objects, gizmo proxies, selection, hover/transient gesture state and undo
history are not serialized as authored project truth.

**Destination:** one explicit codec-bounded unit per semantic domain inside a
project envelope holding the accepted revision and dependency lock (F.2;
[`composition-execution.md`](./composition-execution.md)). Typed resources keep
their identities whether inline, library-hosted or vendored. Camera is settled
as its own codec-bounded unit in F; the split lands in the same cutover as the
Experience order migration. Codec boundaries do not prescribe database tables,
files, or format numbers. The
Experience unit supports a collection.

**Storage is implementation, not product ceiling.** Document count, storage
layout and present algorithms do not define the architecture; the authorities
above do. Editor camera trails, temporary selections, hidden authoring aids and
pending gestures never become visitor behavior incidentally.

## Build — World architecture

Build creates and refines canonical architecture using Plan for construction and
any legible standpoint for precision. The shipped, closed P23 foundation is
**current**: wall-first, first-class Junctions/Walls, Wall-hosted Openings,
boundary/partition roles and persistent Rooms reconciled over derived
boundary-Wall faces, with world-local Layout objects.

**Destination (re-derived under F as track T1).** One continuous spatial world:
Plan↔3D authoring, contextual representations, circular/vertical architecture,
sections and peeling, level-qualified contexts, and runtime-safe Layout
representation evaluation. The accepted P26 prototype — the **Spatial Authoring
Prototype** at `prototypes/spatial-authoring/` — keeps journeys A–F as the
experience/QA authority for this direction (recorded in the
[P26 router](../roadmap/p26-spatial-depth/README.md); family boundary →
[`prototypes/README.md`](../../prototypes/README.md)); its architecture is
re-derived from F, not inherited, and its implementation shortcuts are not
production contracts. Multi-level UI and visitor reveal authoring may ship later,
but their semantic ownership and runtime boundary are established now. The old
editor-only and single-floor restrictions are superseded.

**Wall role is derived (destination, owner ruling 2026-10-03).** The Wall is the
authored primitive. Creators draw spatial geometry; whether a Wall bounds an
enclosure, divides a room or stands free is derived from the resulting topology
and explained, never chosen before drawing. Rooms stay derived, and dividing a
room is drawing a Wall across it. The current authored `boundary`/`partition`
role stays the landed encoding until an explicit Layout cutover
([architecture](./architecture.md) §Ownership); the creator-facing expression
is [PLATE §0.8.4](./design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).

`LayoutRoom` is the current enclosed-region minimum, not the universal spatial
abstraction. The destination distinguishes physical architecture (Walls,
Openings, floors/elements), derived spatial topology (faces, adjacency,
enclosure) and a semantic spatial model (Space, Site, Building, Level, Zone).
Indoor Rooms are one kind of semantic Space; future outdoor/open regions must not
require pretending the world is one giant Room. Hierarchical containment stays
conceptually separate from cross-cutting Zones, and Zones are not transform
ownership. The exact future schema is not ratified yet; do not invent
implementation types ahead of planning.

The wall-first ownership principle is:

```text
Walls/Junctions → physical architecture + explicit connectivity
Rooms           → persistent semantic enclosed regions
Openings        → hosted by canonical Walls
Layout objects  → document-level/project-world-local
```

Geometry/topology may derive candidate faces, but product reconciliation owns
persistent Room identity. Proximity may suggest a snap/join; it never becomes
implicit authored topology or ownership by itself. Every addition extends the
Layout domain and the single canonical compiler; it never creates a second
mesh-authoring or geometry authority, and Layout-owned representation
algorithms are runtime-safe from their first implementation so editor and
visitor can share them.

Broader depth (stairs, railings, richer parametric components, arbitrary curve
intersection and noding, NURBS/CAD curve operations, roof helpers, general
constraint sophistication) is demand/evidence-gated, not a prerequisite for the
first Experience proof. Deep mesh topology editing, sculpting, UV authoring,
rigging and character animation remain external-tool territory.

## Stage — World composition and shared assets

Scene owns scene-object composition: imported models, primitives, materials,
lights, placement, transforms, visibility, authored object properties,
environment/atmosphere, render settings and spatial audio emitters as
destination. Plan Arrange and 3D expose supported operations through the same
continuous spatial system according to representation and capability; a
destination does not change the owning authority.

**Destination composition model.** Distinguish a source definition, placed
instance, internal component, organizational group and attachment. World-local
roots remain the default; internal components may use declared parent-relative
frames, and attachment is a typed relationship with a host and parameters.
Proximity and grouping never imply ownership or connectivity. Shared source
resources do not share mutable pose, materials, playback or overrides.

- **Definitions and instances:** an object definition exposes an intrinsic
  interface (what it can do, parameter meaning, limits, affected channels,
  required components). Placed instances supply configuration, compatible
  per-component overrides and default behavior parameters. A Scene behavior
  binding may start a bounded ambient behavior when that Scene's execution
  context starts, through the common conductor — never a private animation loop
  writing around channel ownership.
- **Reusable performances and Experience Presentations are separate from the
  instance baseline.** Portable performance resources compose capabilities with
  optional or required Camera, light, media and content roles. Experience-owned
  Presentations supply visitor meaning and bind supported uses to concrete
  subjects; neither is an instance baseline or a second copy of intrinsic
  capability.
- **Two override mechanisms:** composition overrides establish the effective
  instance baseline (definition defaults → selected variant → allowed instance
  overrides); invocation overrides supply parameters, bindings, time mapping and
  supported local specialization without mutating that baseline. A captured
  visible pose becomes authored intent only through an explicit validated
  capture operation with a stated target scope.
- **Resources:** references need logical identity plus an exact revision or
  content identity, with a project dependency lock. Availability, authorization
  and retention travel with reuse — an authorized shared reference or a vendored
  immutable copy, never a fragile pointer into another project's private store.
  Identical immutable bytes in two packages are delivery copies of one revision.
  Detaching for independent editing creates a new authored identity. A library
  update is an offered revision requiring acceptance and impact review; existing
  projects and releases keep their locked revisions.

**Truthful ingest (destination).** Ingest declares which structure, clips,
material slots, pivots and metadata survived and which operations are supported.
Retain source bytes and conversion provenance where later reprocessing requires
them. A flat model remains useful at object level; an optimized render hierarchy
does not establish durable component identity. Native procedural definitions
retain parameters and an explicit correspondence policy. Names and indices may
locate data within a source revision; they do not prove continuity across
re-export — revision-qualified identity and a supported mapping policy are ours
to supply. A render-ready derivative must not be advertised as a preserved
semantic assembly without a separate preservation contract.

**Current implementation:** P20 project-scoped texture registry + private R2
bytes; P20.2 cloud texture upload/list/use; P22 release manifests pin verified
object keys; static catalogue models declare canonical footprint metadata; Scene
clusters are named same-room member groups with no prefab/definition model; GLB
import and provider search remain deferred. The current registry is a
project-scoped implementation, not the destination resource system.

## Direct — Camera direction

**Enduring guarantee:** Camera keeps connectivity, routes, framing, projection
and evaluation as one authority. Every profile controller — guided travel, free
look, reduced motion, film, future XR — realizes viewing intent through it. The
current `camera-route.ts` + `camera-motion.ts` mechanism, its curve/guard model,
duration-dependent guards and source filenames are replaceable implementation,
not the destination and not the motion ceiling. Travel, orbit, track, lens/focus
and retimed invocation can extend the vocabulary. No controller supplies a second
pose/FOV interpolation authority.

The camera graph answers **where can the experience move?** and authored
connectivity remains explicit. Sequence-like direction answers **which connected
traversal is presented**. Higher-level direction may describe intent such as a
reveal, orbit, push-in, rest, hero view or establishing view; assisted direction
resolves into the same inspectable project state, and manual position, path,
target/orientation, FOV, timing and framing remain available with free mixing of
manual and assisted control.

**Cutover (destination).** Editorial occurrences, order, holds, interaction
locks and detours move to Experience ownership. Camera retains possible spatial
traversal, intrinsic movement profiles, framing/projection and evaluation;
invocation time mapping is evaluated through Camera. Selecting a cut does not
invent a spatial edge; selecting travel must resolve a supported route or report
a gap. A read-only compatibility adapter may interpret legacy node order during
migration; two editable order systems may not coexist. The new interface must
prove retiming, seeking, projection and guard
behavior together — a serialized prepared form is a conformance obligation, and
dumping the current Three-object motion is not a design. Node links and
Experience order must never remain coequal writable authorities.

**Cues follow their source.** Camera emits its own progress markers; performances
own their cues; Experience owns the visitor-facing interaction bindings that
listen to them. Spatial Camera does not become the owner of every performance
event, and Experience bindings evaluate against canonical evaluation, never a
copied timeline.

## Experience lens — visitor-facing composition

Experience is a distinct authored semantic domain: the visitor-facing composition
of Presentations, Experience-wide Interactions, optional Guides and Stops with
stable occurrence identity, editorial order, content/localization/UI
configuration, choices and contextual invocation bindings. It answers:

> How does the visitor understand, navigate, and participate in the authored
> spatial experience?

Experience workspace/UI depth is future work; the ownership model and cardinality
are ratified now. A project may hold several Experiences over one shared world,
and one package may include several with explicit selection/transition semantics.
A simple UI may initially expose one Experience and simple choices. The persisted
Experience unit is a ratified destination shape (F.2;
[`composition-execution.md`](./composition-execution.md)) — not a designed
schema, codec, or backend slice.

Experience references Camera Views and routes without duplicating poses, paths,
projection/FOV truth or an interpolation system; it owns occurrences, order,
holds, continuation and explicit Gates. Its
`Event → Target → Action` interaction model composes existing project meaning
rather than compensating for missing Spatial capabilities. It must not create
`ExperienceScene`, `ExperienceCameraGraph`, `ExperienceCameraPath`,
`ExperienceRenderer` or equivalent second authorities.

**Identity and execution (destination).** Presentation identity names reusable
meaning; Stop identity names one authored Guide occurrence; a session invocation
names one actual visit. Repeated Stops can reference one Presentation, and
repeated visits to one Stop are distinct invocations. Activity runs have their
own runtime identities and lifetimes. A subject/domain capability supplies
intrinsic behavior, an optional typed performance resource supplies portable
choreography, Experience authors an Activity invocation, and an execution
session runs it. Experience cannot invent a capability absent from its owner.
Execution duration, automatic readiness and progression permission are separate;
only an explicit Gate blocks an otherwise valid manual continuation. Exploration
releases guided Camera control; rejoin uses the current Camera pose and does not
silently resume autoplay. The precise detour lifecycle remains a Prototype V2
hypothesis, not an accepted default.

**Repair and readiness (destination).** A valid authored project may retain an
explicit unresolved subject, capability, View or resource binding so it can be
inspected and repaired. Missing and intentional keep-current-viewpoint are
distinct states. No resolver silently retargets by name, proximity or Room
containment, and no repair erases the affected Presentation or Stop. Preview
disables or refuses affected required behavior; publication requires executable
closure for the selected program and supported profile. Cross-domain acceptance
remains atomic under F.4.

Representative direction:

```text
Experience
├─ Presentations → focus, explanation, View uses, Activities, Interactions
├─ Experience-wide Interactions
└─ Guide (optional) → Stops referencing Presentations
   └─ editorial order, continuation, holds and Gates
       references World subjects, Camera Views and typed resources
```

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

```text
Camera (authority)                      Experience (authority)
─────────────────────────────           ─────────────────────────────
connectivity / routes                   Presentations and Stops
paths / anchors / topology              guided order, holds, detours
framing / projection                    Gates / continuation / interaction policy
motion evaluation                       content, localization, UI config
intrinsic movement profiles             invocation bindings
progress markers / cues*                interaction bindings to markers
```

\* Cue ownership follows the source: Camera emits its own progress markers,
performances own their cues, Experience owns interaction bindings to them.

Experience may expose progressive View, framing and movement authoring, but each
edit delegates to canonical Camera operations and evaluation. It never stores
Camera pose, path, projection/FOV truth or a second graph. Transient World
inspection becomes durable Camera intent only through explicit capture. The
destination location and depth of Camera controls follow the promoted shell design
([PLATE §0.8.1](./design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression));
exact metrics and V2's remaining usability experiments stay explicit there. Camera
ownership is unchanged by lens exposure or shell promotion.

Never:

```text
Experience UI → independent XYZ/FOV interpolation
Experience order → a second writable order authority beside Camera node links
Experience timing → a copied duplicate of Camera timing
```

Motion accessibility changes presentation, not spatial truth: reduced/no-motion
preferences select a supported presentation (for example a cut or reduced
transition) that preserves meaning, without alternate camera graphs or duplicate
Presentation state.

## Interaction and behavior authoring

Interaction is the semantic behavior model of the Experience surface: a
lightweight, typed layer for common spatial and web behaviors without requiring
general-purpose application code. The authoring grammar stays close to
`Event → Target → Action`; the ratified direction adds typed session state and
bounded deterministic declarative expressions (see
[Composition, behavior, and direction model](#composition-behavior-and-direction-model))
for guards, derived values and choice availability. State transitions and
effects occur through explicit actions, never through expression evaluation, and
variant constraints remain validated by their owning domain. Scripts are the
separately governed extension-module exception, not the ordinary requirement.

```text
Enter → Gallery → Play Audio → gallery-narration.mp3
Click → Piano → Play Audio → nocturne.mp3
Reach → Camera C → Show → Painting Info
Cue Reached → Piano Reveal → Show → Piano Info
```

Prefer semantic triggers over raw seconds (`Enter/Leave Room`, `Sequence
Start/End`, `Reach Camera`, `Transition Start/End`, `Cue Reached`, `Click
Object`). Advanced temporal triggers evaluate against canonical authored
transition/timeline state, never a copied copy; a relative trigger like "at 60%"
re-evaluates when the source duration changes. Authoring should autocomplete from
the actual project and from capabilities supported by the selected object or
resource, and invalid operations should be rejected semantically.

## Web experience layer

Published experiences may combine 3D content with ordinary web content where
that serves the experience: text, images, panels, buttons, links, audio/video,
forms, responsive overlays, and page/view navigation. In the destination model
this surface is authored in Experience; graphics and rich media may be created
externally and imported, and the editor owns how they participate in the spatial
experience. The product does not become a Figma/Canva-style 2D design suite, a
general web-code IDE, a Webflow-like website builder, or a traditional
landing-page builder.

## Preview and publish

Publishing compiles an accepted project revision, selected Experience(s), and a
delivery profile into a **visitor-safe prepared package** with an explicit
semantic runtime contract, closed resource graph and verifiable provenance:

```text
accepted revision × selected Experience(s) × delivery profile
→ versioned release reader
→ compatible visitor runtime
→ interactive · embed · presenter · stills/film adapters
```

Each published Experience has its own mutable publication pointer to an immutable
release and entry point. Semantic locations survive republishing while their
subjects persist; pinned release addresses preserve historical context; removal
or incompatible replacement returns an explicit result rather than silently
redirecting. A release may include several Experiences with explicit
selection/transition semantics; a simple UI may expose one.

**Release formats are separate from source formats.** The release reader consumes
prepared visitor data and never invokes the changing authoring validator or
historical authoring compilers. Visitors never receive editor session
infrastructure: selection, undo/redo, gizmos, Inspector, editor shell state,
authoring stores, or asset-management UI. The package excludes editor tools,
unresolved drafts, private source assets, credentials and arbitrary
author-supplied executable code by default. A native **editable project export**
remains a separate artifact containing supported source and resources; a visitor
package does not promise reconstruction of the editable project.

**Delivery-derivative exception.** Immutable, versioned, reproducible delivery
derivatives are permitted outside authored documents (they were formerly
forbidden by a blanket rule). Generated Camera endpoints may exist in a compiled
delivery descriptor; they remain forbidden as a second authored set of connection
anchors. Three objects, GPU handles, selection and transient editor state remain
excluded.

**Baselines** — see [Release and Source Baselines](#release-and-source-baselines).

**Current implementation:** P22 stores an authored `ProjectDocument` snapshot plus
an asset manifest, and the public read path revalidates it with deployed code;
cold preparation also uses deployed decode/compiler code. That path is current
behavior to be cut over, not the destination. Its `RuntimeScene`/`RuntimeConnection`
forms, including resolved Camera poses/paths, are starting evidence, not schemas
to freeze or serialize blindly.

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

**Current:** `projects` + `project_versions` versioned JSONB; Save validates the
full document, locks the project row, appends a version and bumps the latest
version; Load revalidates. Save has no expected-base-revision precondition today,
so a stale full-document writer can overwrite newer intent; a stale-write/
revision-precondition contract is required before simultaneous human/agent
writers. External identity proves who the user is; Fastify + Postgres own
product authorization and project permissions.

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

Human UI and agent/API clients should be clients of the same deterministic
authoring behavior. New authoring capability should be expressible as a
deterministic domain operation independent of its toolbar/button presentation
wherever practical, with this shape:

```text
semantic intent (typed, serializable)
→ explicit inputs + expected project revision
→ validation/preconditions across affected domains and resource locks
→ deterministic candidate mutation
→ one atomic accepted result + one undo result
→ render/runtime
```

Cross-domain mutation is a separate transaction boundary from runtime evaluation.
For "insert kit, attach to Wall, capture a Camera View, bind it to a Presentation,
optionally create a Stop": prepare domain
candidates against one expected project revision, stage required resource
revisions, validate the composed result, then accept all domains and the
dependency lock together with one undo result. Renderers and publication see one
coherent accepted snapshot. Failed validation preserves the previous project;
failed uploads may leave collectable staged bytes, never a half-installed kit.
Naive stale writers are rejected by the expected-revision precondition. First
implementation of this compound acceptance lands with the Experience cutover
(capture a View, bind a Presentation and optionally add a Stop in one acceptance)
— it is not deferred
to component or kit work.

No complete generic command framework is claimed to exist today, and none is
created by this direction. Extract domain operations incrementally as real
capabilities require them, after inspecting current mutator/store/history
abstractions. Current history supports separate Layout/Scene domain entries with
a 100-entry chronological stack; compound project acceptance is the destination,
and several independent commits are never presented as one transaction.

## Sacred contracts

1. **Semantic spatial authoring, not a general mesh editor.** Richer CAD-like
   and parametric construction extends the architectural domain and the single
   canonical compiler; no parallel general-purpose mesh-modeling subsystem.
2. **One project, World | Experience lenses.** The landed shell has `Spatial`
   (`Scene | Camera` × `Plan | 3D`) plus partial project-level surfaces; it
   remains the current description until cutover. The destination creator-facing
   framing is World | Experience over one project, not a `WorldDocument` or a
   merger of semantic authorities. Shell composition, navigation and Camera
   control placement are left to focused design; visual-system roles remain
   owned by the shell contract.
3. **Distinct, never-merged semantic authorities; world-local placement.**
   Layout, Scene, Camera, Experience and typed resources are separate
   authorities and are never merged or hidden inside one another. Scene/Camera
   physical placement is project/world-local with explicit internal component
   frames and no mandatory Room frame. The current two-document encoding, fixed
   format numbers and Camera storage inside Scene are the landed encoding until
   their explicit cutover, not the destination. Legacy Room-local storage
   remains a compatibility read path for recognized legacy projects.
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
   cross-domain acceptance (F.4) extends this contract at the Experience
   cutover.
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
10. **Greenfield product lane.** New projects start from the product editor's
    own format. The frozen Chopin visitor and legacy editor relic are not a
    migration source for editor selection/history/workspace state. Persisted
    legacy project/Scene formats that the product already exports or publishes
    require explicit compatibility; compatibility never means migrating old
    editor session state.
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

## Release and Source Baselines

**Release Baseline (destination; not yet declared).** Required when external
publication is promised durable. It names the release formats/profiles, retained
dependency closure, supported behavior/window, runtime patch/deprecation policy,
and managed-delivery promises. Its reader consumes prepared visitor data without
invoking the authoring validator or historical authoring compilers. Before it is
declared, provenance must be verifiable — retained source revision and dependency
lock connected to build identity and output hashes through controlled build
records or equivalent attestation. A self-asserted manifest is not sufficient
evidence of that linkage.

**Source Baseline (destination; not yet ratified).** Ratified only after F's
formats land and the supported composition/Experience units stabilize. It
establishes durable editable-project and resource migration/version-support
obligations. It is independent of release durability: an already supported
visitor package does not force every intermediate source schema to become
permanent.

**Before the Source Baseline**, development formats may change without
accumulating historical readers. Real trial creators' accepted projects receive
bounded, scripted migrations as named pre-baseline exceptions with covered data,
validation, recovery and retirement criteria — they are not disposable fixtures.
Merging a development schema does not itself create permanent compatibility;
strict canonical validation remains required. Any earlier explicit durability
promise still needs its own documented cutover treatment.

```text
pre-baseline development data → no compatibility guarantee
Release Baseline → visitor release durability obligations
Source Baseline (after F lands) → editable source migration/version support
```

### Development-stage schema compatibility (pre-baseline)

Until the relevant baseline is declared, development schemas may break: new
work does not add migration layers, tolerant historical decoders, multi-version
canonical types, compatibility-only visitor branches or legacy writer support by
default, and obsolete compatibility code is removed rather than carried forward
solely because an earlier development revision existed. Reaching `main` does not
by itself create a backward-compatibility obligation; merge history records what
the code did, not a durability claim about what users own.

A migration or compatibility path before a baseline requires an explicit
product reason and acceptance criterion — externally distributed project files
that must remain usable, a published snapshot intentionally declared durable, an
intentional import format or external integration, or production data that
cannot reasonably be reset — documented explicitly. Existing migration code is
not itself evidence that compatibility remains required.

```text
LEGACY ADAPTER EXISTS
≠
LEGACY FORMAT IS A SUPPORTED PRODUCT CONTRACT
```

A pre-baseline reader may legitimately exist because internal demo content,
benchmark goldens or another not-yet-migrated internal asset still depends on
the older representation: a development dependency with a named owner and a
planned removal path, documented as temporary — not a promise that the format
keeps loading. This does not weaken canonical validation: current documents are
validated strictly, deterministic operations preserve ownership/history
invariants, and editor/visitor parity remains required. Intentional format
conversion (an importer that deliberately converts an external or separately
supported format into canonical project state) is a product capability, not
backward compatibility.

Keep four compatibility concerns distinct: editable-project schema, release
representation, evaluator semantics, and host/delivery API. A runtime build may
support several semantic profiles and a release declares those it requires; a
matching major version alone is insufficient if a required capability is absent.
Unsupported required behavior fails clearly, and an authored fallback may satisfy
a declared alternative profile. A changed implementation that alters supported
behavior needs a semantic version boundary, an explicit migration/rebuild, or a
documented deprecation decision — never a silent reinterpretation of an immutable
release. Conformance covers semantic traces and selected visual/numerical
tolerances, not eternal pixel identity.

*(This split replaces the former single Compatibility Baseline concept; earlier
statements of one milestone no longer describe the destination.)*

## Technology gates

Current production choices remain deliberate rather than ideological:

- SvelteKit + Svelte 5 + TypeScript remain the product/UI foundation while they
  fit measured requirements.
- SVG is the current Plan renderer and Three/Threlte the current production 3D
  renderer. T1 may rebuild the viewport around one evaluated projection;
  retaining SVG for projected precision overlays is a proposed mechanism, not a
  separate Plan geometric/input authority.
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

Use this test before expanding authoring depth: does this capability describe,
compose, direct, or validate a spatial web experience at a reusable semantic
level? Good candidates include walls, openings, doors, stairs, platforms,
dimensions, alignment, asset placement, lighting, camera shots and interactions.
Likely upstream/external-tool territory includes mesh topology editing,
sculpting, retopology, UV editing, rig authoring, general character animation,
arbitrary shader/node DCC work, and general-purpose geometry modeling. Imported
or generated results from those systems are welcome; the product does not own
their authoring workflows.

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
   relationships are never inferred merely from coordinates. Legacy Room-local
   data resolves only through explicit trusted compatibility context and is
   never double-transformed.
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

## Final conceptual hierarchy

The destination converges on:

```text
User Workspace
└─ Project
   ├─ World lens → Layout + Scene source truth; Camera inspection
   ├─ Experience lens → Experiences (one or several)
   │  ├─ Presentations → visitor meaning, content, View/Activity uses
   │  ├─ Experience-wide Interactions
   │  └─ optional Guides → Stops → Presentations; order, Gates
   ├─ Camera authority → Views, connectivity, routes, framing, evaluation
   ├─ Typed resources (project + library scopes)
   └─ Publish → per-Experience pointers → immutable releases
```

The authority flow:

```text
Layout / Scene / Camera author domain truth
        ↓
Experience references it and owns visitor meaning, occurrences, order
        ↓
shared composition/execution resolves bindings, channels, session logic
        ↓
canonical visitor runtime executes the prepared release
```

**Same project, same world, same cameras, same resources, same runtime —
different authoring lenses.** Domain document count and storage layout do not
define the product; semantic authorities do. Human and agent clients operate the
same inspectable capabilities, and the destination is never presented as shipped.
