# Scene content

**Read when:** entities, asset library, materials/textures, lights, clusters, transforms.
**Last reviewed:** 2026-10-20 (T3.P01.S04 cutover implementation; PR #158 review pending, production activation owner-controlled)

---

## Current implementation

The live Scene is the world-local Scene 2 payload of the F2 envelope. Camera Views and
connections live in the separate Camera unit; Experience owns editorial order. Strict unit
validation rejects old versions and retired fields. There is no legacy recognition or conversion.

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

**Current authoring.** The T2 Scene adapter places, edits, resizes, duplicates and deletes through
unit F4 planners, sharing the Stage's single history with Layout. Definitions must already be pinned
or procedural; the starter may capture a bounded verified palette. Missing or changed pins refuse
placement; no resource is silently admitted. General GLB ingest remains T2's follow-on. The shared
Stage/visitor renderers remain under `apps/editor/src/lib/museum/`, with catalogue policy in
`apps/editor/src/lib/content/scene-validation.ts`. The directory name is not a separate product.
Open and Download use F2 source JSON. Publication UI and Camera authoring controls remain absent.

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

## Product convergence destination

**Proposed in PR #173, 2026-10-22; awaiting explicit owner ratification.** This is destination
wording for new consumers; Scene unit format 2 still refuses attachments and components.
[Review manifest](../../roadmap/product-convergence-2026-10-21-amendments.md).

**Placement and attachment.** Solve-once surface placement writes an ordinary world pose and
creates no following relationship. Deliberate attachment, if selected by the owner, has a host
reference and surface parameters whose evaluated pose is the sole pose authority. Layout owns
the frame query and transport; Scene owns the binding. Shape edits may remain Layout-only;
a topology edit needing binding rewrites is a registered joint Layout/Scene acceptance.

Out-of-span, over-Opening and frame-unavailable status is derived. Detach captures the evaluated
pose only while available. The first attachment consumer must decide deletion policy. Proposed:
detach at deletion time by default; explicit alternatives delete dependents or retain a repairable
binding. If any dependent's pose cannot evaluate, default detach refuses the whole candidate
without changes and offers explicit keep/delete. A kept binding without recovery data renders
nothing and needs Re-pick, explicit placement or deletion. Its codec, any AM-2 diagnostic reuse
and compatibility are part of the versioned attachment extension, not a change to all domains.

**Parts and annotations.** An admitted component receives a non-reused opaque identity in its
owning definition/resource table, mapping to source and derivative locators pinned to the exact
revision. A changed component migrates only with explicit preserved/retired/replaced
correspondence; an unchanged identity resolves normally. Names and node order do not establish
continuity. Annotation records belong to Experience. C2 imports whole objects with `componentId`
null; later component providers and admission operations precede part-selection/admission UI.
