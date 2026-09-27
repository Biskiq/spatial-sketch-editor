# Architecture — ownership and boundaries

**Read when:** ownership questions, editor vs relic boundary, import/export.
For a specific surface, go straight to the matching contract doc (table below).

**Authority:** the ratified decision record
([`decisions/northstar-ratification-2026-09-27.md`](./decisions/northstar-ratification-2026-09-27.md))
owns the destination. This document separates **current implementation** (what the
code does today) from the **ratified destination** (what new design must conform
to). Nothing below marked destination is shipped, and current encodings are cutover
obligations, not limits. Foundation contract shapes are written in
[`composition-execution.md`](./composition-execution.md); phase registration and
status are in
[`../roadmap/f-foundation-contracts/README.md`](../roadmap/f-foundation-contracts/README.md).

## Two isolated lanes (current)

```text
apps/editor (greenfield)     apps/museum (frozen Chopin visitor)
  New Project → Plan → 3D        checked-in chopin-project.json + runtime
  → portable export/import       /museum/editor = frozen legacy editor relic
```

- No Chopin project/editor state/history migration into the editor.
- No editor export promotion into `/museum`.
- The editor ships in production builds (no build-flag gating).
- Shared visitor-safe geometry/render modules may serve both lanes; session,
  selection, hierarchy, gizmo, import, and asset-store code stay editor-only.
  Runtime-safe domain evaluators (e.g. Layout representation) are shared with
  visitor runtimes by design — editor-only means session/authoring machinery,
  not forked domain mathematics.

## Product routes (current)

| Route | Role |
|---|---|
| `/` | Public entry (start creating guest project, or continue with Google) |
| `/editor` | Compatibility redirect → `/project/:id/spatial` |
| `/projects` | Project Hub (owned cloud project list for authenticated creators) |
| `/project/:id/spatial` | Spatial workspace (Scene · Camera × Plan · 3D) |
| `/project/:id/publish` | Publish surface (owner-only status, publish/update/unpublish) |
| `/p/:publicationId` | Public visitor route (cold release bootstrap, no auth) |
| `/project/:id/preview` | Visitor Preview takeover (transient snapshot, no save required) |
| `/museum` | Frozen Chopin visitor relic (checked-in `chopin-project.json`) |
| `/museum/editor` | Frozen legacy editor relic (Scene · Camera, no Layout) |
| `/dev/materials` · `/dev/assets` · `/dev/perf` | Development previews / G3 harness |

The editor boots into a fresh empty project; no Chopin/legacy state is loaded
or migrated. Guest/local work lives in the browser session with portable
export/import. Authenticated cloud work adds owned Save/Load with a project
list and versioned saves.

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
One `ProjectDocument` currently holds separately owned `LayoutDocument` and
`SceneDocument` domains; the current Scene document also stores Camera data.
These are current encodings with explicit cutovers (see the decision record's
migration step 3), not the destination partitions.

## Semantic authorities (ratified destination)

A semantic owner is not a database table, storage folder, or UI mode. Each
authority is distinct, never merged, and may not be hidden inside another
document. The persisted shape of each is an F.2 codec-bounded unit inside the
project envelope ([`composition-execution.md`](./composition-execution.md) §F.2):

| Authority | Owns | Current encoding (until cutover) |
|---|---|---|
| **Layout** | Architectural topology, dimensions, hosted Openings, levels, placed structures, architectural definitions/instances, alternatives, parameters, validity; runtime-safe contextual representation | `project.layout` / `LayoutDocument` (`@portfolio/layout-core`), wall-first `formatVersion: 5`, one floor datum |
| **Scene** | Object definitions, components, base transforms, variants, attachments, materials, lights, placed instances, world presentation (environment/atmosphere, render settings, spatial trigger subjects) | `project.scene` / `SceneDocument` (`@portfolio/project-model`), world-local `formatVersion: 1`, no `roomId` |
| **Camera** | Views, spatial connectivity, paths, framing, projection policy, intrinsic movement profiles, evaluation, reusable Camera resources | Camera data inside `project.scene`; `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) evaluates |
| **Experience** | Destinations, guided occurrences, editorial order, visitor-facing content/localization/UI configuration, choices, invocation bindings, typed session declarations | None — ratified destination; `ExperienceDocument` is not designed. F.2 settles its codec-bounded unit (collection-capable) |
| **Typed resources** | Reusable states, clips, performances, role interfaces, revisions, dependency locks; project and library scopes | P20 project-scoped texture registry + catalogue; no general resource system |
| **Project coordination** | Accepted revision, dependency lock, cross-domain validation, coherent history, release preparation, deterministic typed intents (F.4) | `ProjectDocument` + versioned cloud saves; chronological Layout/Scene history, no compound acceptance, no expected-revision precondition |
| **Execution session** | Active runs, clocks, channel control, visitor choices, media position — isolated per preview/visitor/session | Editor-local playback/preview state; never written back to authored definitions |
| **Audience/collaboration** | Comments, approvals, saved visitor configurations, shared-session snapshots, outcome analytics — outside authored source, anchored by public semantic address + release context | None; P22 release/publication rows are delivery state, not audience records |

Residual ownership: world presentation defaults to Scene; visitor-facing meaning,
localization, and UI configuration default to Experience. Admit any new semantic
domain only by declaring its authority, foundation-reference conformance,
persisted codec unit, validation, channel families/operators, evaluator and
release lowering, effects, and conformance fixtures. Never hide a new domain in
an existing document merely because it has storage space. See
[`north-star.md`](./north-star.md) §Ownership, authority, and lifetimes.

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
bounded expressions, lifecycle semantics), visitor meaning (destinations, order,
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
| Rooms, frames, boundaries, openings | `project.layout` / `LayoutDocument` (`@portfolio/layout-core`) |
| Rough parametric layout objects | `project.layout.objects` |
| Scene models, primitives, lights, materials | `project.scene` / `SceneDocument` (`@portfolio/project-model`) |
| Camera nodes, connections, paths, view tracks | `project.scene` (until the Camera codec cutover) |
| Derived geometry | pure `compileLayoutGeometry()` (`@portfolio/layout-core`) |
| Project/scene validation, codecs, room semantics, runtime graph | `@portfolio/project-model` |
| Plan presentation | `CompiledLayoutGeometry` → `PlanRenderModel` → `PlanSvg.svelte` |
| 3D wall meshes | compiled Junction contract (`CompiledJunction` / `resolveJunctionGeometry`) → Junction-aware `wall-mesh-builder` → `wall-geometry-adapter` |
| Camera route/motion | `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) — replaceable mechanism under the one Camera authority |
| Publication status, active version, revision | `publications` row (`apps/api`) |
| Published snapshots + delivery manifests | immutable `releases` rows (`apps/api`); bytes resolved per-release at visitor boot |
| Public visitor chrome | `/p/:publicationId` route (editor deployment, visitor-safe closure) |
| Project-local GLB bytes | portable package manifest + editor asset store |
| Selection, history, gizmo proxies, UI | editor session only |

Generated geometry, Three objects, renderer handles, selection, and history
are never serialized as authored truth; immutable release derivatives are the
explicit exception above.

**Layout semantic mutation.** Canonical Layout semantic mutation is planned
in `@portfolio/layout-core`. Each authoring operation owns its own pure
planning function, and the operation's semantics decide what that function
accepts and returns: a topology-changing chain plans a replacement
`LayoutDocumentWallFirst` (with created/split lineage and retired Room IDs),
while an alignment or measurement operation plans a value for the editor to
apply. This is a layering boundary, not a protocol — a shared result type,
base class or command framework is neither required nor implied. The editor owns
interaction, transient preview, selection and the single history transaction.
Scene edits are outside this rule. F.4's compound acceptance generalizes the
acceptance boundary across domains at the Experience cutover; it does not
retrofit this layering rule.

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
