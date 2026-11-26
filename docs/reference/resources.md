# Resources — typed source, images and licences

**Owns:** the typed-resource unit and its dependency-lock closure, the material family grammar and
immutable recipe identity, P20 project image admission and closure, My Objects library transfers,
creator model staging and dependency licensing. Evaluated pixels and renderer resources are
[rendering](./rendering.md)'s concern; Finish assignment is [Scene](./scene.md)'s.

## Typed resource system

Resources are a shared **typed** system with project and library scopes, independent immutable
revisions and dependency locks — not one project-scoped registry and not per-mode stores. A
definition, state, performance, clip or Camera resource has logical identity plus an exact revision
or content identity; delivery copies of one immutable revision are not competing mutable
definitions. A library update is an offered revision requiring acceptance and impact review;
existing projects and releases keep their locked revisions, and detaching for independent editing
creates a new authored identity.

- **Closure.** Every project use resolves through an exact locked revision and provenance. A
  portable export carries its full closure. No project depends on a fragile pointer into a
  service's private store.
- **Truthful ingest.** Ingest declares which structure, clips, material slots, pivots and metadata
  survived and which operations are supported. A render-ready derivative is never advertised as a
  preserved semantic assembly; names and indices locate data in one source revision but never prove
  continuity across re-export.
- **Declared requirements.** A resource declares its type/version, required capabilities, content
  hash and source kind through the dependency lock. Unsupported required capabilities refuse;
  optional ones may degrade with a visible result.
- **Retention.** Staging, superseded revisions and provider-side copies follow the host's retention
  and authorisation policy; the lock never names a temporary or signed URL as durable source.

## Images

A project texture's Scene `id` is its logical asset id: a `/project-assets/{assetId}` texture must
carry `id === assetId` (`texture_id_mismatch`). One image therefore has one Scene texture record, so
Finish maps sharing an image share one release pin.

- **Admission.** Artwork and Finish images use the one shared `importProjectImage` procedure: static
  PNG, JPEG or WebP up to **25 MiB** and **4096 pixels per edge**, sha256 dedupe against the
  project's assets, no downscaling. A Finish image below 256 px on its short side is accepted with a
  warning; a larger original is never refused for being small. Larger originals need future
  display-derivative support.
- **Pairing.** A Finish's colour image is two records that always agree: a `scene.textures` record
  whose `id` is the P20 asset id and whose URI is `/project-assets/{assetId}`, and a pinned `texture`
  typed resource. Both are created by one `scene-finish-from-image` write; an existing record is
  reused only when URI and pin are identical, else the write refuses (`texture-mismatch`). A texture
  resource needs no dependency-lock entry; the unit validator's closure check requires it.
- **Closure.** One shared enumerator in `@portfolio/project-model` produces the closure for Save,
  Load and delivery. It deduplicates by asset id, rejects two pins or two oriented sizes for one
  image and keeps every authored path that references it. A private closure requires the authored
  `texture` pin; delivery accepts the ready registry row for a legacy pin-less texture resource. An
  unreferenced staged P20 row is outside both closures.
- **Load and repair.** Cold Load verifies the complete project-image closure before installing the
  incoming candidate — every registered project texture (including a Finish-only image and a record
  whose Finish was removed) and every Artwork shelf image: ready row, locator, MIME, byte length,
  SHA, stored bytes and declared dimensions. A refusal preserves the open session, history and saved
  base and names the code, project, saved base, asset id, expected pin, referencing paths and repair
  action. Verified bytes enter a bounded short-lived loading cache consumed at most once per entry;
  a refusal clears what it verified. The owner-only
  `PUT /projects/:projectId/assets/:assetId/repair?expectedPin=sha256-…&savedBase=saved-base:…`
  streams exact bytes to a private staging key, verifies length, digest, MIME and Artwork dimensions,
  and conditionally swaps the object key; wrong file `422`, stale base or changed pin `409`,
  inaccessible `404`, storage failure `503`. No object-store read runs inside a locked transaction,
  and no concurrent repair can mix a row with another's bytes. Repair creates no source revision,
  version, receipt or history entry.
- **Retention is not deletion.** An image whose write was cancelled, refused or undone stays in
  project assets under P20 retention. The Scene never puts bytes in Undo and never deletes them; an
  unreferenced asset is not pinned, while a texture record whose Finish is gone is still pinned.

**Artwork shelf and release.** Artwork images have project-local IDs and immutable original bytes.
Save verifies ownership, MIME, length, digest and oriented dimensions for shelf images. Reopen
verifies the shelf before replacing the current source and decodes placed images only. Undo and
deletion of a hanging leave the bytes available. Release preparation pins placed Artwork images with
the P20 texture closure, once per asset id; unplaced shelf entries stay outside delivery. The
detached visitor verifies release bytes against digest and Artwork dimensions before loading.

## Material family `pbr-metallic-roughness/v1`

`pbr-metallic-roughness/v1` is the first family, not the universal editable format. Each later family
owns its source grammar, override vocabulary and evaluator. The shared profile defines signal
meanings; the Scene codec owns Finish identity, assignments and overrides; the resources unit owns
immutable definitions, pins and vendoring.

```text
Metric  = { tileMeters: [w,h], rotation: radians, offset: [u,v] }
Mapping = { kind:"target"  | "surface", metric: Metric }
        | { kind:"uv", set: 0|1, repeat:[u,v], rotation: radians, offset:[u,v] }

Colour<I> = { image:I, mapping?:Mapping }
Normal<I> = { image:I, convention:"+Y"|"-Y", mapping?:Mapping }
Scalar<I> = { image:I, component:"r"|"g"|"b"|"a", invert:boolean, mapping?:Mapping }
Maps<I>   = { color?, normal?, roughness?, metalness?, occlusion? }
Recipe    = { profile:"pbr-metallic-roughness/v1", color:"#rrggbb",
              roughness, metalness, occlusionStrength, normalScale,
              mapping: Mapping, maps: Maps<Hash> }
LocalImage = { textureId } | { shipped: FrozenTextureURI }
Finish     = { id, name, base:{ catalogue: MaterialId } | { material: Hash },
               overrides?: { color?, roughness?, metalness?, occlusionStrength?,
                             normalScale?, mapping?, maps?: OverrideMaps<LocalImage> } }
```

- **Ranges.** Roughness, metalness and occlusion strength `[0,1]`; normal scale `(0,10]`; metric
  tile edge `[0.01,100] m`; UV repeats `[1/1024,1024]` on both axes; rotation `[0,2π)`; offset
  components `[0,1)`. The operation builder wraps angles/offsets modulo a full turn/tile, normalizes
  `−0`, and rejects invalid non-finite or out-of-range values without clamping. The strict reader
  rejects out-of-domain encodings, unknown keys, wrong role/selector pairs, invalid colour and
  unsupported profile. Material v1 admits opaque RGB colour, tangent-space RGB normal and raw scalar
  components; coverage, height and emission are outside it.
- **Defaults.** White, roughness 0.5, metalness 0, occlusion strength 1, normal scale 1, target
  mapping with a 1 m square tile, rotation 0 and offset `[0,0]`. `pbr-neutral-v1` is the frozen
  untextured catalogue base for resource-backed primitives and Forms; models use their optional
  instance base.
- **Canonical identity.** UTF-8 of `canonicalUnitJson(normalizedRecipe)` — sorted keys, no trailing
  newline — hashed by the repository's `sha256Bytes`, is the only recipe revision. Display names,
  palette slot ids, project ids, transport paths, thumbnail and locator tables live outside it. The
  neutral recipe must produce
  `sha256-ce95db1ce6fb2381d7ff4542e05f83b857599e8dc673ca01d082cfc129c973bc`;
  the same recipe in two projects with different local texture ids yields the same digest, while a
  swapped ORM component or normal convention changes it. Authored ordering elsewhere in the
  envelope is preserved.
- **Override semantics.** Omission inherits the complete binding, including mapping and convention;
  replacing a binding replaces that whole value; removing its mapping makes it follow the set;
  resetting restores the parent. Factor overrides use omission for inheritance and accept zero where
  their range includes it. An explicit override equal to the base remains authored, so inspection
  reports provenance. Empty override containers are omitted. `null` explicitly disables one base map
  ([Scene](./scene.md#finishes-and-surface-assignments)).
- **Resource binding.** A material resource's `id` and `contentRevision` are the recipe hash; `pin`
  and `unresolved` are null; its detail is `material:{recipe, images:[{hash, source:LocalImage}]}`.
  The list is unique by hash, sorted ascending, exactly covers recipe digests, and each entry
  resolves to a verified texture pin or an append-only shipped manifest entry. One digest may serve
  all five roles. Each material resource needs exactly one lock entry: domain `resource:material`,
  subjectKind `resource`, subjectId and contentRevision equal to the hash, empty instancePath, null
  pin, requiredCapabilities `[{id:"pbr-metallic-roughness",version:"1"}]`.
- **Target facts.** Derived values keyed by subject identity and geometry/asset revision:
  `TargetFacts{subject, geometryRevision, metricBasis?, draws:[{drawKey,uvSets,normalFrameSets}]}`.
  Native shapes and Layout surfaces supply a metric UV basis and surface dimensions; model
  replacements supply per-mesh draw range, actual UV0/UV1 availability and normal-frame suitability.
  Enumerate active triangles respecting indices, groups and draw range. A UV set requires a finite
  pair for every referenced vertex; a normal frame additionally needs a nonzero-area triangle with
  nonzero UV edge lengths and `abs(det(duv1,duv2)) > 1e-6 × length(duv1) × length(duv2)`. Empty draw
  ranges contribute nothing. Missing facts return `target-pending` and offer requalification. Mesh
  indices, analysis caches and renderer objects never enter a project.
- **Mappings.** `target` applies metric settings where the subject has a metric basis and identity
  UV0 on a model; `surface` requires a metric basis and refuses on a GLB; explicit `uv` reads native
  UVs directly (glTF uses the upper-left origin). Only `target` may choose a different basis per
  user. On one Finish shared by a Form and a model, target mapping uses the Form's metres and the
  model's identity UV0. `computeTextureRepeat` keeps its 0.01 lower bound. An explicit per-binding
  mapping replaces the whole set mapping; two maps using different UV sets share the upload but
  sample separately.
- **Inspection.** A request names up to the 2048 readback bound, one geometry (sphere, plane or
  block), a lighting (studio, grazing or Current World) and a display (lit, unlit colour or one solo
  role). States are `pending`, `ready`, `partial` with issues and `refused` with issues and no
  frame. The whole view set leases together; a failed image names each affected role while the other
  channels still read; a bound solo channel that cannot read is refused; only an unbound one shows
  its constant. Retry reloads only failed images. One render lane serves interactive requests before
  queued thumbnails; replacement cancels the older request; a settled request draws nothing. Only
  `ready` enters the bounded thumbnail cache, namespaced by catalogue or project scope and keyed by
  resolved recipe, dimensions, geometry and recipe versions; draft and Current World results never
  enter it.

**Curated sets.** Each set ships one qualified resolution (512, 1K or 2K), chosen by texel density at
the design viewing distance and visual qualification; there is no universal size. Images live at
`/textures/<set-id>/{color.webp,normal.webp,orm.webp}`: colour lossy sRGB WebP, normal (+Y) and ORM
(R occlusion, G roughness, B metal constant) lossless. Metal sets carry no colour map — the recipe
colour is the measured F0. Every image is pinned by sha256, MIME and byte length in the shipped
manifest; pins are append-only. Upload builds a full mip chain and samples with linear
magnification, trilinear minification and anisotropy 1. GPU residency is accounted per view against
the Finish-view ceiling and refuses with `texture-budget` instead of thrashing. Derivation records
and licences live under `apps/editor/assets-source/`; the derivation is reproducible from retained
byte-identical sources. The six legacy placeholder ids resolve unchanged but are not offered for new
use; new objects default to `plaster-painted`. Adding another resolution is an allowlist append under
a new URI, never a change to an existing pin.

**Inspection reference derivatives.** Each creator-facing entry has one 192×192 PNG engineering
reference under `/material-thumbnails/` (sphere, studio, lit and Natural), recorded with purpose,
recipe versions, key and sha256 in `src/lib/content/material-thumbnails.json`. They are regression
references, not product thumbnails. `catalogueThumbnailUri` returns a file only while its key
matches the one the current entry, size, geometry and recipe versions produce, and lookup loads no
texture. Regenerate with `node scripts/generate-material-thumbnails.mjs` from `apps/editor` with
`S8_GATE_BASE_URL` naming the dev server.

## My Objects library

The implemented library scope is owner-only, project-independent and reachable by no project,
release, visitor or publication route. A strict shared reader/writer in
`@portfolio/project-model/library` is used by editor and API; it refuses unknown keys, other format
numbers and an unevaluable body. The server recomputes canonical bytes and the `sha256` content
identity, stores at most **256 KiB** per item and **1,000 items** per owner, and refuses a mismatch.
Items are immutable; Save creates a new item; only the owner lists, reads, inserts or removes one,
and another owner's id answers as not found. Items survive project deletion. Until beta an item
records the format it was written with: older items stay listed and removable, are marked as made
with an earlier development version, and are refused at insertion; they are never migrated or
misread.

- **Form item.** Payload `{formatVersion, kind:'form', name, form, materialId, castShadow,
  receiveShadow}`; `form` is the Scene native-form source verbatim, including controls, keys,
  per-axis scale and `nextKey`. Source only: no mesh, footprint, normal, UV or cache. Inserting
  creates a **detached authored copy** through `place-form-copy`: a new entity id, the saved source
  written verbatim, and no resource, lock entry, reference or other link to the item. Editing either
  side never reaches the other. The form-only transfer keeps its catalogue fallback and discloses a
  project Finish omitted from the transfer.
- **Material item.** Payload `{formatVersion, kind:'material', name, recipe}`, where the recipe is
  the accepted Finish flattened over current palette literals, without Treatment. The content id
  covers name and recipe; a separate `recipe_hash` is the portable recipe revision. Up to **five**
  distinct image dependencies are pinned as either the owner's immutable private copy
  (`library/<namespace>/<owner>/<item>/<attempt>/...`) or a frozen shipped manifest URI. A save
  streams and verifies each private copy before inserting item, images and receipt in one
  transaction, so a list never observes a partial item. Insert reuses a matching ready project asset
  row or copies exact bytes under the destination project's key, and returns a stable Finish id plus
  local image bindings for ordinary F4 registration; the destination holds no library key or URL. A
  different body for the same operation id is `409`; a replay after the destination saved base
  advanced is `409 stale_revision`. The optional 192×192 PNG thumbnail is owner-only, capped at
  **256 KiB**, pinned to item content id and recipe key, and absent means 404 with the swatch
  fallback.

## Creator model staging and import

The landed storage foundation is not an import UI. The owner-only API stages a declared source file
set (up to **50 MiB**) and derivative (up to **25 MiB**), checks hashes, sizes and GLB/glTF structure,
and retains immutable approved revisions. Unapproved staging is removed after **24 hours** when
accessed by staging/approval routes; there is no background expiry worker. Source and derivative
bytes live in the project's private object namespace; the API does not create the derivative.
Approved revisions remain while project versions reference them; project-deletion cleanup belongs to
later C3 work.

The resources unit carries a model resource with derivative and source pins, recipe, report digest
and placement definition. Scene may name a catalogue asset or a model resource locked in the same
envelope. Editor host admission resolves the resource in the envelope, and Save checks its complete
pin against an approved revision owned by the same project. The visitor/public release path remains
catalogue-only.

Import reads one glTF or GLB, or a glTF with local buffers and maps, in a worker loaded only when
Import opens. Draco, meshopt and KTX2 decoders load only when the source uses them. Recipe
`creator-import@1` keeps every node, empty and mesh, appends one pivot root, re-encodes geometry with
meshopt and textures as WebP, and caps textures at **2048 px** with the reduction reported. The
review separates observed content (parts, clips, variants) from what Biskiq admits — the whole
object only. The creator confirms metric scale, pivot, footprint and contact (floor placement only)
and approves. Approval sits outside source history, and a cancelled, stale or project-replaced upload
never installs. The first placement installs the `model` resource, its exact lock and the entity as
one accepted result through the resource-granting planner; Undo removes all three. Later instances
reuse the pins with independent instance identity. The editor resolves each distinct pin once per
hash and shares its object URL across instances; Preview receives approved-model URLs only as a
read-only map prop, and the public route passes none.

**Ingest report.** The report distinguishes hierarchy, clips, variants and extensions observed from
capabilities actually admitted. Retaining parts enables a later component consumer without declaring
those parts admitted. A single-mesh source can still be annotated at a point. Catalogue optimizers
are not reused unchanged without that qualification. Source bytes, content hash, recipe identity and
version are retained; the derivative preserves addressable structure and capability meaning or
carries sufficient correspondence. Pruning, deduplication, joining or flattening qualifies only when
that preservation is demonstrated.

## Delivery and retention boundaries

A release manifest pins each referenced P20 texture to its verified object key and SHA-256/MIME/size.
Public bytes serve only while the publication is active and only through release membership
(`GET /publications/:id/versions/:v/assets/:asset/content`, `no-store`, correct MIME/length,
`nosniff`, no R2 redirects). The cold visitor loader verifies downloaded bytes before installing the
runtime and threads a release-scoped `TextureLoadScope` through the real material consumers,
including model-instance texture overrides. Colliding logical URIs across projects/releases never
share cache entries. Publication fails closed: a pending, missing, corrupt or wrong-size asset
blocks it. P22 does not broaden P20 ingest (image textures only, no uploaded models). Prepared public
reader activation and the retained delivery package remain T4's obligation
([prepared release design](../plans/t4-release/prepared-release-design.md)).

## Dependency licensing

The product licence remains undecided, and this contract selects none. The owner's permissive-only
ruling governs ordinary dependency admission; weak-copyleft licences (LGPL-2.1, LGPL-3.0, MPL-2.0,
including exceptions such as OCCT's) are eligible for consideration and adoption after the
documented review below. Strong copyleft (GPL, AGPL), source-available or field-of-use terms, and
missing or unclear licences still stop and are reported to the owner.

The admitting slice plan documents, and its acceptance records:

1. **Identification:** SPDX expression and exception, exact pinned version, and the licence of every
   shipped component, including vendored and WASM-compiled sources.
2. **Distribution:** how the code reaches users — browser bundle, separately loaded WASM module,
   worker or server only. Delivery to a browser is distribution.
3. **Obligations and how each is met:** licence text and notices shipped; corresponding source of
   the exact version and of any modification offered. For LGPL, the library ships as a separately
   loaded, replaceable module with build instructions so a user can substitute a modified build. For
   MPL, modified covered files stay separate and their source is offered.
4. **Compatibility:** the dependency forecloses no plausible product licence, any MPL "Incompatible
   With Secondary Licenses" designation is checked, and no strong-copyleft component ships.
5. **Modification policy:** unmodified upstream preferred; any patch published with its source.
6. **Change:** a version, licence or distribution change repeats the review.

A candidate whose obligations cannot be met in the shipped build stops. Real doubt stops for the
owner, who may seek legal review; the review identifies obligations, it does not select a library.
Other capability areas retain permissive-only admission, and existing narrower dependency admissions
remain scoped to their consumers.
