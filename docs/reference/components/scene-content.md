# Scene content

**Read when:** entities, asset library, materials/textures, lights, clusters.
**Last reviewed:** 2026-09-27 (ratified direction reconciled; current behavior
remains authoritative until cutover)

---

## Current implementation

v6 editable: **model** / **primitive** (`box|plane|cylinder|sphere`) / **light** · textures · material instances · clusters.  
**Architecture rooms are not scene entities** — see [`../architecture.md`](../architecture.md).

| Assets tab | Today |
|------------|--------|
| Models | Catalogue; room-agnostic placement (resolves the clicked floor) |
| Shapes | Box / plane / cylinder / sphere |
| Lights | Point / spot / directional — aim by rotation |
| Textures | URI/file → bind via materials (not scene objects); P20 project assets use logical `/project-assets/{assetId}` refs resolved by authenticated editor context |

Clusters = named same-room member groups; visitor renders flat; **no** prefab library yet.  
Session lighting/fog = preview only, not saved.  
GLB provenance: [`assets.md`](./assets.md).

Current clusters are **not** a durable assembly/instance model: they carry
member IDs and editor-only hierarchy metadata, and cloning a Three hierarchy
supplies no authored component identity or revision policy.

## Ratified destination (not shipped)

Scene owns scene-object composition: named definitions, placed instances,
components, attachments, materials, lights, placed-instance semantics and world
presentation (environment/atmosphere, render settings, spatial trigger
subjects). Distinguish a source definition, placed instance, internal component,
organizational group, and attachment; proximity or grouping never implies
ownership or connectivity.

- **Definitions and instances.** A definition exposes an intrinsic interface —
  what it can do, what its parameters mean, supported material slots, discrete
  configurations, limits, affected channels and required components. A placed
  instance supplies configuration, compatible per-component overrides and
  default behavior parameters. Importing a definition never authorizes autoplay
  or external effects.
- **Ambient behavior.** A Scene behavior binding may start a bounded ambient
  behavior when that Scene's execution context starts (so an object can operate
  with no tour or Experience). The binding goes through the common conductor; it
  is not a private animation loop writing around channel ownership.
- **Two override mechanisms.** Composition overrides establish the effective
  instance baseline (definition defaults → selected variant → allowed instance
  overrides); invocation overrides supply parameters, bindings, time mapping and
  supported local specialization without mutating that baseline. A captured
  visible pose becomes authored intent only through an explicit validated
  capture operation.
- **Reusable presentations are not instance state.** A presentation composes
  capabilities with optional/required Camera, light, media and content roles;
  Experience binds roles to concrete subjects. An object-only presentation stays
  usable without a camera track.

**Resources, identity, and ingest.** Definitions, states, performances and clips
are typed resources with logical identity plus an exact revision or content
identity, project and library scopes, and a project dependency lock; a
project-local definition may be stored inline initially provided it has the same
identity/scope/reference semantics as a later library resource. Availability,
authorization and retention travel with reuse — an authorized shared reference
or a vendored immutable copy, never a pointer into another project's private
store. Ingest is truthful: it declares which structure, clips, material slots,
pivots and metadata survived and which operations are supported, and retains
source bytes/conversion provenance where later reprocessing requires them. A
flat model remains useful at object level; an optimized render hierarchy does
not establish durable component identity. Names and indices may locate data
inside a source revision; they do not prove continuity across re-export.

**Open mechanism decisions** (implementation decisions within
[`../composition-execution.md`](../composition-execution.md), subject to its
interface-ownership rule): the definition/instance schema,
component-identity mechanics, resource storage/container encoding, and the
correspondence algorithm for ingest derivatives.
