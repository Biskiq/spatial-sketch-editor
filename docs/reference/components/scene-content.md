# Scene content

**Read when:** entities, asset library, materials/textures, lights, clusters, transforms.
**Last reviewed:** 2026-10-13 (#115 WP4 — current-format readers, removed editor shell;
`placement.md` merged into this contract and deleted)

---

## Current implementation

The Scene document is **world-local** and carries its own format discriminator
(`formatVersion: 1`); it is validated strict-generation alongside the wall-first Layout
(`formatVersion: 5`). Only one format is supported and there is no legacy recognition: a
malformed or incomplete document fails ordinary current-format validation, with no
`unsupported_generation` code, detector or compatibility facade.

Editable entity kinds: **model** / **primitive** (`box|plane|cylinder|sphere`) / **light**
(`point|spot|directional`) · textures · material instances · clusters.
**Architecture rooms are not scene entities** — see [`../architecture.md`](../architecture.md).

| Assets | Today |
|------------|--------|
| Models | Catalogue; world-local placement, no Room ownership |
| Shapes | Box / plane / cylinder / sphere |
| Lights | Point / spot / directional — aim by rotation |
| Textures | URI/file → bind via materials (not scene objects); project assets use logical `/project-assets/{assetId}` refs resolved by authenticated context |

Clusters = named member-id groups; the visitor renders them flat; **no** prefab library.
Current clusters are **not** a durable assembly/instance model: they carry member IDs and
editor-only hierarchy metadata, and cloning a Three hierarchy supplies no authored component
identity or revision policy. GLB provenance: [`assets.md`](./assets.md).

**The editor shell is removed by #115.** There is no authoring surface (Plan or 3D), no
publication UI and no import/export, so today a Scene document is created, validated, serialized
and rendered only by the retained paths: the strict codec in `packages/project-model`, the
catalogue-configured policy in `apps/editor/src/lib/content/scene-validation.ts`, the generic
renderer modules under `apps/editor/src/lib/museum/` (`assets/`, `entities/`, `materials/`,
`layout/` — the directory name is retained to avoid churn in test paths and does not denote a
museum product), and the visitor cold runtime. Scene authoring is a T2 capability to rebuild.

## Validation and transform contract (current)

These are the codec's own rules, not a destination: `packages/project-model/src/scene-codec/`
(with `parse-entities.ts` holding the entity parsers) rejects anything outside them.

- **Allowed keys only.** An unknown property on a document, entity, cluster or resource is
  rejected, so a document carrying a retired field does not silently load.
- **Transform**: `position` and `rotation` are required finite `Vec3` values; `scale` is optional
  and must be **finite and greater than zero** (`invalid_scale`). Scale is a single scalar — there
  is no per-axis scale field in the schema.
- **Primitive dimensions** must be finite and greater than zero (`invalid_dimension`).
- **World-local identity**: `roomId` is explicitly rejected on entities and clusters, so a
  Room-owned placement cannot be expressed or re-introduced. Placement-local bounds and footprint
  derivation are project/world space; the legacy room-frame projection branch is gone.
- **Lights**: `color` must be `#rrggbb`; `intensity` finite ≥ 0; `range` finite > 0; `angle` in
  `(0, π]`; `penumbra` in `[0, 1]`. Directional lights reject `range`/`angle`/`penumbra`, point
  lights reject `angle`/`penumbra`, and spot lights require `angle`.
- **Material instances**: `baseMaterialId` must resolve to a known material; `roughness` and
  `metalness` are unit-interval.
- **Texture URIs** must be safe root-relative public paths — no scheme, no `//`, no backslash, no
  query or fragment, no control characters, no `.`/`..` segment, and stable under repeated
  percent-decoding.
- **Catalogue seams.** The pure model cannot know which asset or material IDs a host ships, so the
  host injects that policy: `SceneValidationOptions` / `withSceneValidationOptions` in
  `packages/project-model/src/scene-validation.ts`, supplied in this app by
  `apps/editor/src/lib/content/scene-validation.ts`. An unresolvable entry fails by name
  (`unknown_asset`, `unknown_material`, `invalid_fallback`).

**Placement, transforms and attachment (ratified destination; not shipped).** Placement operates
on session-only proxies over world-local roots and declared internal component frames;
**Attachment** is a typed relationship with a host and parameters, and proximity or grouping never
implies ownership or connectivity. Overrides follow the composition/invocation split (instance
baseline vs invocation parameters), and placement never mutates a baseline an invocation owns.
Moving or replacing a placed instance is a deterministic domain operation over a typed,
serializable intent with an expected project revision, and cross-domain acceptance (F.4) is atomic
with one undo result. Resource revisions and dependency locks travel with definitions and
instances: placement does not silently rewrite a locked reference, and an incompatible replacement
is reported for repair, never auto-matched by name or position. Destination Stage graphics,
handles, measurement feedback and hit legibility follow the
[spatial-instrument grammar](../design-system/spatial-instrument-grammar.md); placement/domain
adapters retain legal operations, target eligibility and commit/cancel policy, and the grammar adds
no universal gizmo or transform capability.

**Open:** level/structure-qualified placement addressing, and the frame semantics for attached
components — implementation decisions within F.1/F.3
([`../composition-execution.md`](../composition-execution.md)), subject to its interface-ownership
rule.

> The uniform-versus-independent scale fidelity note and TD-1's acceptance-test obligations are
> carried in [`docs/roadmap/t2-composition/planning-evidence.md`](../../roadmap/t2-composition/planning-evidence.md),
> not duplicated here. The pre-#115 Arrange/ghost/gizmo surface and the room-local Scene projection
> were removed with the editor shell; their content is recoverable with
> `git show e90a58224443bdbf44114d7285d55c983b79cc84:docs/reference/components/placement.md`.

## Ratified destination (not shipped)

Scene owns scene-object composition: named definitions, placed instances, components,
attachments, materials, lights, placed-instance semantics and world presentation
(environment/atmosphere, render settings, spatial trigger subjects). Distinguish a source
definition, placed instance, internal component, organizational group, and attachment; proximity
or grouping never implies ownership or connectivity.

- **Definitions and instances.** A definition exposes an intrinsic interface — what it can do,
  what its parameters mean, supported material slots, discrete configurations, limits, affected
  channels and required components. A placed instance supplies configuration, compatible
  per-component overrides and default behavior parameters. Importing a definition never authorizes
  autoplay or external effects.
- **Ambient behavior.** A Scene behavior binding may start a bounded ambient behavior when that
  Scene's execution context starts (so an object can operate with no tour or Experience). The
  binding goes through the common conductor; it is not a private animation loop writing around
  channel ownership.
- **Two override mechanisms.** Composition overrides establish the effective instance baseline
  (definition defaults → selected variant → allowed instance overrides); invocation overrides
  supply parameters, bindings, time mapping and supported local specialization without mutating
  that baseline. A captured visible pose becomes authored intent only through an explicit validated
  capture operation.
- **Reusable presentations are not instance state.** A presentation composes capabilities with
  optional/required Camera, light, media and content roles; Experience binds roles to concrete
  subjects. An object-only presentation stays usable without a camera track.

**Resources, identity, and ingest.** Definitions, states, performances and clips are typed
resources with logical identity plus an exact revision or content identity, project and library
scopes, and a project dependency lock; a project-local definition may be stored inline initially
provided it has the same identity/scope/reference semantics as a later library resource.
Availability, authorization and retention travel with reuse — an authorized shared reference or a
vendored immutable copy, never a pointer into another project's private store. Ingest is truthful:
it declares which structure, clips, material slots, pivots and metadata survived and which
operations are supported, and retains source bytes/conversion provenance where later reprocessing
requires them. A flat model remains useful at object level; an optimized render hierarchy does not
establish durable component identity. Names and indices may locate data inside a source revision;
they do not prove continuity across re-export.

**Open mechanism decisions** (implementation decisions within
[`../composition-execution.md`](../composition-execution.md), subject to its interface-ownership
rule): the definition/instance schema, component-identity mechanics, resource storage/container
encoding, and the correspondence algorithm for ingest derivatives.
