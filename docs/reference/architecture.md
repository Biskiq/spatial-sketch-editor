# Architecture — ownership and boundaries

**Read when:** ownership questions, editor vs relic boundary, import/export.
For a specific surface, go straight to the matching contract doc (table below).

## Two isolated lanes

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

## Product routes

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

## Platform boundary

| Concern | Ratified owner |
|---------|-----------------|
| API runtime + compute | Fastify + TypeScript on Render |
| Platform/database state | Neon Postgres |
| Heavy asset bytes | Cloudflare R2 |
| Identity authentication | Google OIDC — external identity; Museum Editor owns its session + authorization |
| Product/project authorization | Fastify + Postgres |

P18 provisions only the Render API and Neon database through secret
`DATABASE_URL`. P19 introduces the first Google OpenID Connect integration
(Authorization Code + PKCE) and the app-owned secure session needed for
verified identity, single-user project ownership, and authenticated project
Save/Load endpoints. **P20 introduces the project-scoped asset registry +
private R2 storage** — asset metadata in Postgres, heavy bytes in Cloudflare
R2 through `apps/api` only (no R2/S3 client enters the editor or shared
packages). P20.2 has landed in Spatial for project texture upload/list/use; P20 S0–S4
shipped 2026-09-04 (local live smoke against real R2 completed; production
topology smoke deferred). One `ProjectDocument` holds separately owned
`LayoutDocument` and `SceneDocument` domains — Layout owns architecture,
Scene owns entities/materials/lights/cameras; they are not merged. **P22
shipped basic Publish + visitor runtime** — `publications`/`releases` rows in
Postgres, private-R2 bytes served only through release membership, cold
public route `/p/:publicationId` on the editor deployment that stays
visitor-safe (no editor/session/selection/history/gizmo code in its closure);
`/museum` stays frozen. Richer auth
UX/hardening, permissions/memberships, teams, and collaboration also remain
later. Experience mode/schema remains outside P18/P19/P20. External identity
proves who the user is; Fastify + Postgres own product authorization and
project permissions. A test-only issuer (`POST /test-auth/session`,
allowlisted automation identities) may mint the same app-owned session for
agent/E2E testing — it replaces only the external ceremony and is
structurally absent unless explicitly configured, never in production.

## Project-level surfaces (future)

The current `Scene | Camera` × `Plan | 3D` workspaces are the canonical
**Spatial** authoring surface and remain unchanged. Per the North Star, the
project has **two primary creative modes — Spatial and Experience** — plus the
project-level supporting surfaces **Assets** and **Publish**. These are not
four identical authoring modes; they join the shell without renaming or
flattening the Spatial model:

- **Experience** — visitor-facing navigation and presentation. It *references*
  Spatial truth (existing cameras, rooms, authored destinations) and never
  creates duplicate camera positions/graphs/sequences/paths, room definitions,
  scene objects, or layout geometry. Experience navigation intent resolves
  through the canonical camera route/motion system; Experience UI never
  performs independent XYZ/FOV interpolation. Interactions are an Experience
  authoring lens (not a third mode) using an `Event → Target → Action`
  semantic model that references Spatial entities + the shared asset registry.
  **Spatial → Camera owns authored camera/path/timing/framing truth**;
  Experience interactions may reference spatial entities and canonical
  temporal evaluation, and may reuse the same 3D preview/render surface, but
  never own or edit duplicate path/camera truth. Spatial Camera may author or
  emit semantic cue markers tied to that canonical temporal evaluation, while
  Experience Interaction owns the visitor-facing action binding to those cue
  events; a cue is not a second behavior-authoring system. `ExperienceDocument`
  is a future ownership boundary only — no schema, codecs, migrations, or
  backend scope now.
- **Assets** — one shared project asset registry serving Spatial and
  Experience; no independent per-mode asset stores.
- **Publish** — basic publish shipped (P22): visitor-safe runtime +
  project data/assets through release manifests; Experience UI and
  developer/export consumption levels remain future direction (no runtime SDK
  defined now).

## Ownership

| Concern | Source of truth |
|---------|-----------------|
| Rooms, frames, boundaries, openings | `project.layout` / `LayoutDocument` (`@portfolio/layout-core`) |
| Rough parametric layout objects | `project.layout.objects` |
| Scene models, primitives, lights, materials | `project.scene` / `SceneDocument` (`@portfolio/project-model`) |
| Camera nodes, connections, paths, view tracks | `project.scene` |
| Derived geometry | pure `compileLayoutGeometry()` (`@portfolio/layout-core`) |
| Project/scene validation, codecs, room semantics, runtime graph | `@portfolio/project-model` |
| Plan presentation | `CompiledLayoutGeometry` → `PlanRenderModel` → `PlanSvg.svelte` |
| 3D wall meshes | compiled Junction contract (`CompiledJunction` / `resolveJunctionGeometry`) → Junction-aware `wall-mesh-builder` → `wall-geometry-adapter` |
| Camera route/motion | `@portfolio/camera-core` (`camera-route.ts` + `camera-motion.ts`) only |
| Publication status, active version, revision | `publications` row (`apps/api`) |
| Published snapshots + delivery manifests | immutable `releases` rows (`apps/api`); bytes resolved per-release at visitor boot |
| Public visitor chrome | `/p/:publicationId` route (editor deployment, visitor-safe closure) |
| Project-local GLB bytes | portable package manifest + editor asset store |
| Selection, history, gizmo proxies, UI | editor session only |

Generated geometry, Three objects, renderer handles, selection, and history
are never serialized.

## Where to look (per surface)

Doc routing lives in the router ([`../README.md`](../README.md) §Where truth
lives). Contract truth lives in Ownership + Geometry boundary above/below.

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

## Hard don'ts

Dual nav graphs · second motion/gizmo/geometry compiler · persist generated
endpoints · persist Three/render state · infer room ownership/adjacency from
coordinates · import Chopin/legacy editor state into the editor · independent
layout-only import · hide the editor behind a build flag · Experience UI
performing independent camera interpolation · Experience Interaction editing
camera/path truth outside Spatial · duplicating canonical timing/path values
into Experience truth · independent Experience camera evaluation · binding
narration/audio/UI actions in Spatial Camera as a competing interaction
authority · a separate Interaction asset store · `ExperienceScene` /
`ExperienceCameraGraph` / `ExperienceCameraPath` / `ExperienceRenderer` as a
second spatial authority · separate Spatial and Experience asset stores.
