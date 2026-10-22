# Architecture — ownership and boundaries

**Read when:** ownership questions, product vs frozen-project boundary, or which code owns a concern.
For a specific surface, go straight to the matching contract doc (table below).

**Authority:** the [ratified decision record](./decisions/northstar-ratification-2026-09-27.md),
as refined by the [2026-09-29 World | Experience amendment](./decisions/world-experience-reconciliation-2026-09-29.md),
owns the destination. This document separates **current implementation** (what the
code does today) from the **ratified destination** (what new design must conform
to). Nothing below marked destination is shipped, and current encodings are cutover
obligations, not limits. Foundation contract shapes are written in
[`composition-execution.md`](./composition-execution.md); phase registration and
status are in
[`../roadmap/f-foundation-contracts/README.md`](../roadmap/f-foundation-contracts/README.md).
The owner-directed World | Experience reconciliation of 2026-09-29 refines
product lenses and Experience composition without rewriting the historical
ratification record.

## Product and frozen lanes (current)

```text
apps/editor (product)            frozen Chopin project (separate)
  sign-in → project hub              independently hosted + versioned
  → /project/:id/spatial F2 Stage  /museum + /museum/editor
  → cloud Save/Load                  outside this repository entirely
  → /p/:id unavailable until T4
```

- **T1/T2 authoring with the T3 F2 cutover.** The spatial Stage boots one F2 envelope,
  including starter, empty and Open source JSON. T1 Layout and T2 Scene planners accept unit
  candidates through one F4 host and chronological history. The Head owns conditional Save,
  conflict/Reload and explicit sign-in Save recovery. One Canvas and one viewport evaluation
  serve both readings. Camera authoring controls, general GLB ingest, Wall creation and
  publication UI remain outside this cutover. PR #158 carries the implementation; independent
  review and owner-run production activation remain separate.
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
| `/` | Public entry (guest start, or continue with Google) |
| `/projects` | Project hub (owned cloud project list for authenticated creators) |
| `/editor` | Compatibility redirect → `/project/<fresh id>/spatial?create=1` (the mint marks a new identity, so a 404 is read as `new`, not `missing`) |
| `/project/:id/spatial` | F2 authoring Stage: stored source, starter, empty or Open JSON; unit-scoped Layout/Scene operations, one history, conditional Head Save and guarded replacement |
| `/p/:publicationId` | Visitor-only route; AM-9 public reads return honest 404 until T4 prepared-reader activation |
| `/dev/materials` · `/dev/assets` | Development previews retained inside the reduced foundation |

PR #115 removed the earlier editable workspace; the T1/T2 Stage and T3 unit cutover restore the bounded authoring loop above. Still removed by #115 are `/project/:id/publish`,
`/project/:id/preview`, the `/dev/perf` benchmark harness, and — as **product**
routes — `/museum` and `/museum/editor`, which belong to the independently
deployed frozen project.

The `/editor` compatibility route and hub's New Project enter the starter gallery
for a minted identity; choosing an empty project is explicit. No Chopin/legacy
state is loaded or migrated. Guest/local work lives in the browser session. Authenticated cloud work
adds owned Save/Load with a project list and versioned saves. Save/Load, assets
admit only declared F2 envelopes (Layout 5, Scene 2, Camera/Experience/resources 1).
Old files, drafts, mixed roots and unknown versions refuse without conversion. Publication
writes return `prepared-reader-required`; see [persistence](./components/persistence.md).

## Platform boundary (current)

| Concern | Ratified owner |
|---------|-----------------|
| API runtime + compute | Fastify + TypeScript on Render |
| Platform/database state | Neon Postgres |
| Heavy asset bytes | Cloudflare R2 |
| Identity authentication | Google OIDC — external identity; Museum Editor owns its session + authorization |
| Product/project authorization | Fastify + Postgres |

P18 provisions the Render API and Neon database through secret `DATABASE_URL`.
P19 introduced Google OpenID Connect (Authorization Code + PKCE) plus the
app-owned secure session used for verified identity, single-user project
ownership and authenticated Save/Load. P20 introduced the project-scoped asset
registry + private R2 storage (asset metadata in Postgres, heavy bytes through
`apps/api` only — no R2/S3 client enters the editor or shared packages). P22
shipped basic Publish + visitor runtime: `publications`/`releases` rows,
private-R2 bytes served only through release membership, cold public route
`/p/:publicationId` with a visitor-safe closure. A test-only issuer
(`POST /test-auth/session`, allowlisted automation identities) may mint the same
app-owned session for agent/E2E testing; it replaces only the external ceremony
and is structurally absent unless explicitly configured, never in production.
The live source is `ProjectEnvelope`, with five distinct codec-bounded units, accepted-revision
provenance and a dependency lock. Migration 005's F2 schema fence rejects pre-epoch writers;
applying that destructive migration to the deployed environment is a separate owner-run action.
The P22 delivery path is retired: public reads are unavailable until T4's prepared reader.

## Semantic authorities (ratified destination)

A semantic owner is not a database table, storage folder, or UI mode. Each
authority is distinct, never merged, and may not be hidden inside another
document. The persisted shape of each is an F.2 codec-bounded unit inside the
project envelope ([`composition-execution.md`](./composition-execution.md) §F.2):

| Authority | Owns | Current encoding (until cutover) |
|---|---|---|
| **Layout** | Architectural topology, dimensions, hosted Openings, levels, placed structures, architectural definitions/instances, alternatives, parameters, validity; runtime-safe contextual representation | `units.layout.data` / `LayoutDocument` (`@portfolio/layout-core`), wall-first `formatVersion: 5`, one floor datum |
| **Scene** | Object definitions, components, base transforms, variants, attachments, materials, lights, placed instances, world presentation (environment/atmosphere, render settings, spatial trigger subjects) | `units.scene.data` / Scene 2 (`@portfolio/project-model`), world-local, no `roomId` |
| **Camera** | Views, spatial connectivity, paths, framing, projection policy, intrinsic movement profiles, evaluation, reusable Camera resources | `units.camera.data` (Camera 1); `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) evaluates |
| **Experience** | Presentations, Experience-wide Interactions, optional Guides and Stops, editorial order/continuation/Gates, visitor-facing content/localization/UI configuration, contextual Activity invocations, typed session declarations | `units.experience.data` (Experience 1, collection-capable); later authoring amendments remain future work |
| **Typed resources** | Reusable states, clips, performances, role interfaces, revisions, dependency locks; project and library scopes | `units.resources.data` and the exact dependency lock; bytes stay in the P20 registry/private storage; general ingest remains future work |
| **Project coordination** | Accepted revision, dependency lock, cross-domain validation, coherent history, release preparation, deterministic typed intents (F.4) | `ProjectEnvelope`, unit F4 acceptance, one chronological history, local expected revision and durable saved-base CAS; source and cloud revision identities are distinct |
| **Execution session** | Active runs, clocks, channel control, visitor choices, media position — isolated per preview/visitor/session | The editor-local playback/preview state was removed by #115 with the editor shell; the surviving execution surface is the visitor cold runtime's session state, never written back to authored definitions |
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
Camera operations. The landed `Scene | Camera` shell was removed by #115, so the
lenses are destination framing over a foundation being rebuilt. One selection
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
exact cross-domain interfaces are drafted by their first consumer but ratified
as amendments to [`composition-execution.md`](./composition-execution.md) and
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

**Current P22 path (cutover obligation):** releases store an authored
`ProjectDocument` snapshot plus an asset manifest; `readPublicRelease` revalidates
the snapshot with deployed code and cold preparation uses deployed decoders/
compilers. This path stays documented until its explicit cutover and is replaced
by the versioned prepared-payload reader. No durable source-capsule bridge is
introduced during the redesign; covered pre-cutover data gets a bounded
conversion while its source tooling is available.

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
| Rooms, frames, boundaries, openings | `units.layout.data` / `LayoutDocument` (`@portfolio/layout-core`) |
| Rough parametric layout objects | `project.layout.objects` |
| Scene models, primitives, lights, materials | `project.scene` / `SceneDocument` (`@portfolio/project-model`) |
| Camera nodes, connections, paths, view tracks | `project.scene` (until the Camera codec cutover) |
| Derived geometry | pure `compileLayoutGeometry()` (`@portfolio/layout-core`) |
| Project/scene validation, codecs, room semantics, runtime graph | `@portfolio/project-model` |
| Cross-domain reference (F.1) and channel (F.3) interfaces | `packages/project-model/src/references` · `packages/project-model/src/channels` — shared runtime-safe interfaces with no editor/renderer dependency; their accepted readiness is recorded in the [gate register](../roadmap/README.md#gate-register) |
| Plan presentation | T1.P01.S02 adds the orthographic Plan reading and Layout Plan representation over compiled geometry. The current Stage draws the canonical geometry in both readings; Plan membership, Reveal, Index and hit eligibility use the representation, but it does not draw a Plan cut. Plan-cut rendering remains future work |
| 3D wall meshes | compiled Junction contract (`CompiledJunction` / `resolveJunctionGeometry`) → Junction-aware `wall-mesh-builder` → `wall-geometry-adapter` |
| Camera route/motion | `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) — replaceable mechanism under the one Camera authority |
| Publication status, active version, revision | `publications` row (`apps/api`) |
| Published snapshots + delivery manifests | immutable `releases` rows (`apps/api`); bytes resolved per-release at visitor boot |
| Public visitor chrome | `/p/:publicationId` route (editor deployment, visitor-safe closure) |
| Project-local GLB bytes | the API's project-scoped asset registry (metadata in Postgres, bytes in R2), reached only through `apps/api` |
| Selection, history, gizmo proxies, UI | T1.P01.S02 restores read-only Stage selection, Index and shell/session UI; it authors no source changes. History, gizmo proxies and editing remain future T-track capabilities |

Generated geometry, Three objects, renderer handles, selection, and history
are never serialized as authored truth; immutable release derivatives are the
explicit exception above.

**Extraction discipline (adopted by PR #115's maintainability harvest, A1).**
Extract responsibilities with their callers and ownership boundaries. A forwarding
surface is justified only when it serves an intentional, owned interface or a bounded
migration. Temporary compatibility shims require an explicit retirement condition and
cannot be treated as completed extraction merely because implementation moved behind
them. Maintain one authoritative owner per mutable state fact.

This distinguishes a legitimate public interface, controlled adapter or composition
boundary from an **unowned compatibility surface retained indefinitely** after an
extraction. The decision point is implementation review; slice closeout only confirms that
the accepted evidence contains no unowned remaining shim, and it introduces no production
edit. The rule targets coupling and ownership, not module size — a large single-
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
geometry becomes editable. *Current encoding until an explicit Layout cutover:*
the wall-first document stores an authored `role: 'boundary' | 'partition'`, and
only `boundary` Walls take part in face extraction (`LayoutWallRole`). The editor
that drew a chain and planned role changes was removed by #115, so nothing in
the product writes the authored role today; the cutover retires creator-chosen
roles as creator-facing operations, and Layout must decide two things then:
migrating existing `partition` Walls, and whether a closed ring may ever be
intentionally non-enclosing. Division keeps the landed Room reconciliation (P23.8 lineage:
split survivor by evidence order, one Room born). The creator-facing expression is
[PLATE §0.8.4](./design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination).

## Where to look (per surface)

Doc routing lives in the router ([`../README.md`](../README.md) §Where truth
lives). Contract truth lives in this document's authority table plus the
component contracts under [`components/`](./components/).

## Geometry boundary

`LayoutDocument` = authored semantic CAD. `CompiledLayoutGeometry` = derived,
cacheable, renderer-neutral, never serialized; both are owned by
`@portfolio/layout-core`. No SVG strings, `THREE.*`, DOM,
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
