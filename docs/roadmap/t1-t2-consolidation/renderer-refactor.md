# T1/T2 joint renderer refactor — design

**Scope:** the path **Scene → derived geometry → render resources → renderer**, for the editor Stage
and the visitor surfaces that share it. **Evidence:** [`audit.md`](./audit.md) sections 4–6.
**Execution:** slices R1–R8 in [`slices.md`](./slices.md).

This is a refactor of ownership, not a rewrite. Three r187 on WebGL stays the production renderer;
nothing here migrates to WebGPU, replaces the kernel or changes a rendered pixel on purpose.

## 1. Problem

The Layout half of the pipeline already has the shape the product needs: one compiler, a description
with a per-entity `cacheKey`, and retained representations that patch by key. Walls and Layout
objects prove it works.

The rest does not have that shape:

- **No description layer for Scene.** Components read authored entities and decide geometry,
  material and textures themselves, per entity, at mount.
- **No owner for render resources.** Geometries, materials and textures are created at twelve
  material sites and at least seven geometry sites. Nothing can share what nothing owns.
- **No owned render identity.** Selection, picking and visibility find objects by string name.
- **Svelte mounts world content per entity** for Rooms and every Scene kind — the cost class S06
  removed for Walls.

Because of this, the same content is described many times, identical resources are duplicated, any
upstream identity change rebuilds everything downstream, and instancing has no place to live.

## 2. Target shape

```text
1 Authored units          Layout 7 · Scene 6 · Camera 1 · Experience 4 · resources 2
        │  (one compiler; one Scene resolution, retained per unit — slices I2, G2, I4)
        ▼
2 Derived descriptions    CompiledLayoutGeometry (exists) · resolved Scene content
        │  pure data, frozen, no Three, runtime-safe
        ▼
3 Render descriptions     one RenderItem per drawable: what to draw, never how
        │  pure data, no Three; built once per derived-description identity
        ▼
4 Render resources        GeometryStore · MaterialStore (the one factory) · TextureStore
        │  one owner per renderer; keyed, reference-counted, disposed by the owner
        ▼
5 Retained representations  Walls · Objects (exist) · Rooms · Scene entities (new)
        │  imperative Object3D graphs patched by key; each owns an id → object index
        ▼
6 Renderer                managed WebGL renderer · on-demand frames · shadow invalidation
```

Each layer reads only the layer above it. Layers 1–3 are shared by every surface and hold no GPU
state. Layers 4–6 exist once per Canvas, because WebGL contexts cannot share GPU objects: the
snapshot renderer reuses the Stage's, and the Preview Canvas has its own.

### 2.1 Ownership

| Layer | Owner | May not |
| --- | --- | --- |
| Derived descriptions | Layout (compiler) and Scene (resolution) | hold Three objects; be rebuilt when their unit did not change |
| Render descriptions | the render module, as a pure function of layer 2 | read authored documents; decide resource sharing |
| Render resources | one resource owner per renderer | be constructed anywhere else; be disposed by a consumer |
| Representations | one module per content family | create geometry or material except through the stores; expose objects by name |
| Renderer | `managed-webgl-renderer.ts` and the Canvas host | be reached by world code |

This is a consumer-side refactor under hard rule 6: representations and stores consume the one
compiler's output and the one Scene resolution. No store, description or representation derives
architecture or Scene semantics of its own.

### 2.2 Describe once

A render description is a frozen record per drawable:

```ts
type RenderItem = {
  readonly id: string;              // authored entity or compiled element id
  readonly key: string;             // content hash: unchanged key ⇒ nothing to do
  readonly geometry: GeometryKey;   // what shape
  readonly material: MaterialKey;   // what look
  readonly transform: Transform;    // where, incl. unit-geometry scale
  readonly layer: 'world' | 'paper' | 'editor';
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
};
```

- `key` plays the role `cacheKey` plays for Walls: a representation compares keys and touches only
  what changed. Layout items reuse the compiler's `cacheKey`; Scene items derive theirs from the
  resolved entity.
- `GeometryKey` and `MaterialKey` are canonical strings. Two items with equal keys share one GPU
  resource. Sharing is therefore a property of the description, decided once, not of whichever
  component mounted first.
- Descriptions are memoised by the identity of the frozen value they derive from. After G2 an edit
  that does not touch Scene yields the same Scene description object, and every layer below does
  nothing.

### 2.3 Geometry keys

| Family | Key | Shared geometry | Per-item |
| --- | --- | --- | --- |
| Box, plane | `unit:box`, `unit:plane` | one unit geometry | scale = dimensions |
| Cylinder | `unit:cylinder:32` | one unit geometry | scale = (radius, height, radius) |
| Sphere | `unit:sphere:32x24` | one unit geometry | uniform scale |
| Form | `form:` + `formEvaluationKey` | one buffer per distinct form | transform |
| Model | `model:` + asset content id + mesh index | the loaded buffers | transform |
| Wall | `wall:` + `cacheKey` | one per Wall (unchanged) | — |
| Room floor, ceiling | `room-floor:` / `room-ceiling:` + Room `cacheKey` | floor shared by the floor and floor-shadow meshes | — |
| Artwork | `unit:plane`; `frame:` + profile + size; `mat:` + size | shared by equal sizes | transform |

A unit geometry scaled by a transform renders identically to a geometry built at size: positions
scale exactly, normals are corrected by the normal matrix, and UVs are 0–1 per face in both. R4
proves this with a vertex-level parity test before any call site moves. Tiling stays a material
concern (the texture variant's repeat), as it is today.

### 2.4 Material keys and the one factory

`MaterialStore.acquire(descriptor)` is the only place a world material is constructed. The
descriptor is plain data — class, colour, roughness, metalness, side, transparency, alpha test, map
variant keys — and its canonical serialisation is the `MaterialKey`. Equal descriptors share one
material instance; the store counts references and disposes at zero.

- The **resolved look** is the pure function from (entity, Scene materials, environment) to a
  descriptor. It replaces per-render `resolveSceneMaterial` calls and is evaluated once per Scene
  description.
- The factory encodes the T2.S0 Gate A pipeline (sRGB output, no tone mapping, exposure 1.0, Lambert
  as the approved artwork baseline). It reads that record; it does not re-decide it.
- **Texture variants** keep their identity (source × repeat × colour space) and their reference
  counts, but release is deferred: a variant whose count reaches zero is disposed at the next idle
  point if it is still unused, so a release-then-reacquire within one update never deletes a GPU
  texture.
- Editor ink — Paper lines, the mat grid, selection, gizmos — is not a world surface and stays
  outside the store, on an explicit allowlist.

### 2.5 Representations and identity

Rooms and Scene entities get retained representations with the interface Walls already have:

```ts
type Representation<Source> = {
  readonly object3d: Group;                 // mounted once, never replaced
  update(source: Source): RepresentationStats;   // counts: built, retained, released
  objectOf(id: string): Object3D | null;    // owned id → object index
  setHidden(ids: ReadonlySet<string>): void;
  dispose(): void;
};
```

- `update` diffs item keys, acquires and releases through the stores, and reports counts. Counts are
  the test oracle, as in S06.
- `objectOf` replaces every `getObjectByName` and name-prefix test. When an item is drawn as an
  instance, the index returns the instanced mesh and instance number; consumers never assume one
  object per entity.
- Svelte keeps what it is good at: mounting the representation's root once, and per-entity editor
  affordances that are not world content.

### 2.6 Instancing and batching

Instancing is a representation-internal decision over render descriptions: items with the same
(`GeometryKey`, `MaterialKey`, shadow flags) may be drawn as one `InstancedMesh`. Static batching
(Walls, floors) is the same decision for unique geometries.

Both are **gated by measurement** (slice R7) and deliberately last:

- they are only expressible once descriptions, stores and the identity index exist;
- they trade the O(changed) patch path and per-object picking for fewer draws, which pays only if
  the frame is draw-bound after rest frames are gone (audit 6.1, assumption A1);
- they must stay invisible to consumers, which `objectOf` guarantees.

### 2.7 Redundant render work

The refactor removes redundant work by construction rather than by special case:

| Redundancy | Removed by |
| --- | --- |
| Frames with nothing changed (PF-1) | I1: an unchanged evaluation is the same object; nothing invalidates |
| Whole Scene re-resolved per unrelated accept (PF-3) | G2: per-unit retention; same description identity |
| Materials re-resolved per render (PF-4) | resolved look evaluated once per description |
| Texture release/re-acquire per update (PF-4) | stable material keys; deferred variant release |
| Shadow re-render per unrelated accept; per-frame shadows for static models (RR-8) | G4: triggers on caster content; model arrival observed by the representation |
| O(W²) visibility scan (PF-6) | `setHidden` on the owned index |
| Geometry rebuilt on a dimension edit (RR-4) | unit geometry + transform |

## 3. WebGPU portability

The target is "portable", not "ported". The rules are checked by an arch boundary (slice R1):

1. World code (layers 2–5 and every component shared with the visitor) uses built-in Three material
   classes with standard properties only. No `onBeforeCompile`, no `ShaderMaterial`, no raw GL.
2. Renderer-specific code lives in `managed-webgl-renderer.ts`. Stores and representations take the
   renderer as an opaque dependency and use only API common to both Three renderers.
3. `InstancedMesh` and `BatchedMesh` are the only batching primitives (both exist on both renderers).
4. The existing editor-only exceptions (audit 5.1) are an allowlist that may shrink and never grow.
5. Alpha-tested shadows use `alphaTest` on the surface material, not custom depth materials, once
   R5 shows pixel parity.

Material descriptors are the portability seam: a future node-material backend replaces the factory's
construction step and nothing above it.

## 4. Behaviour preservation

Every R slice is a refactor with a rendered-result oracle:

- **Structural parity:** for a fixed fixture the representation yields the same set of (id, world
  matrix, vertex positions, material properties) as the component path it replaces. This is a unit
  test, not a screenshot.
- **Counts:** built / retained / released per update; live geometries, materials and textures from
  `renderer.info` at the mounted boundary.
- **Focused browser QA:** one targeted look at the changed content family in Stage and Preview
  ([AGENTS.md](../../../AGENTS.md), Verification and browser QA).

A slice that cannot show structural parity does not merge.

## 5. Out of scope

WebGPU migration, node materials, a render graph, post-processing, level-of-detail, occlusion
culling, a picking BVH, worker-side geometry, and any new visual capability. T2 look features
(Sky fields, Finishes, light kinds) land through this structure but are planned by their own slices.
