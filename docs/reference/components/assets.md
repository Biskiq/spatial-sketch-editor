# Assets

**Read when:** catalogue, licences, model preparation and validation, project texture registry,
published release delivery.
**Last reviewed:** 2026-10-27 (T5 destination promotion; current single-model import remains bounded
by T2.P02 and its acceptance evidence). Landed contracts keep describing current behavior until
their explicit cutover; T5 admits no resource or dependency here.

---

## Ratified destination (not shipped)

Resources are a shared **typed** system with **project and library scopes**,
independent revisions and dependency locks — not one project-scoped registry and
not per-mode stores. A definition, state, performance, clip or Camera resource
has logical identity plus an exact revision or content identity; delivery copies
of one immutable revision are not competing mutable definitions. A library
update is an offered revision requiring acceptance and impact review, and
existing projects and releases keep their locked revisions; detaching for
independent editing creates a new authored identity. Source bytes and conversion
provenance are retained where later reprocessing requires them.

**Truthful ingest.** Ingest declares which structure, clips, material slots,
pivots and metadata survived and which operations are supported. A render-ready
derivative is never advertised as a preserved semantic assembly; a flat model
remains useful at object level, and names/indices locate data in one source
revision but never prove continuity across re-export.

**First creator loop.** Truthful single-model creator import (retained source,
provenance and explicit supported capabilities) moves into the first
creator/audience loop under the re-derived T2 track
([`../../roadmap/t2-composition/planning-evidence.md`](../../roadmap/t2-composition/planning-evidence.md))
— it is not contingent on a complete asset pipeline, and static-only catalogue supply is no longer
the scope ceiling.

## Expressive capability admission (destination)

The [T5 G0 ruling](../decisions/t5-g0-ratification-2026-10-27.md) extends no current import or
resource capability. Native and imported content expose honest supported edit sets through their
owning domains. Imported work need not acquire invented construction history or be converted into
a preferred native representation to remain useful.

Any future conversion to editable form must disclose retained source, correspondence, approximation,
lost capabilities and recovery under the [editable-source contract](./persistence.md#editable-source-and-revision-destination).
Native detail, surface or precision capabilities compete with simpler controls, materials and
external-tool exchange on demonstrated creative value and revision cost. No kernel, library,
resource format or conversion workflow is selected; current licensing/admission rules below remain.

## Current asset system (P20 shipped 2026-09-04 — S0–S4)

```text
Built-in catalogue
→ existing catalogue/static behavior
→ no P20.2 registry row required

Local file texture
→ session BinaryTextureStore
→ not durable cloud storage by itself
→ (the package portability/export path that also read it was editor
   import/export and was removed with the editor shell in #115)

Cloud file texture
→ authenticated owned project
→ registry metadata
→ private R2 bytes
→ logical /project-assets/{assetId}
→ existing SceneTextureAsset registration
→ existing drag/assignment/render path

Project registry rows
→ currently texture/image focused
→ PNG/WebP/JPEG
```

P20 does **not** build the final Assets workspace. Cloud Load resolves every referenced logical
texture before project replacement, verifies registry metadata plus MIME/size/SHA, then primes the
existing binary store; failure leaves the current project unchanged. Provider search and general
delete/GC remain deferred. Built-ins retain catalogue identity — do not invent registry behavior for
them.

## Creator model resource storage (T2.P02.S01)

The landed S01 capability is a storage and admission foundation, not an import UI. The owner-only
API stages a declared source file set (up to 50 MiB) and derivative (up to 25 MiB), checks their
hashes, sizes and GLB/glTF structure, and retains immutable approved revisions. Unapproved staging
is removed after 24 hours when accessed by the staging/approval routes; there is no background
expiry worker. The API stores source and derivative bytes in the project's private object namespace;
it does not create the derivative. Approved revisions remain while project versions reference them;
project deletion cleanup belongs to the later C3 work.

The F2 resources unit (format 2) carries a model resource with derivative and source pins, recipe,
report digest and placement definition. Scene format 3 may name a catalogue asset or a model resource
locked in the same envelope. Editor host admission resolves that resource in the envelope, and Save
checks its complete pin against an approved revision owned by the same project. The visitor/public
release path remains catalogue-only. The import procedure that produces these revisions is described in
the next section.

## Creator model import and placement (T2.P02.S02)

The editor's Import procedure reads one glTF or GLB, or a glTF with its local buffers and maps, in a
worker loaded only when Import opens. Decoders for Draco, meshopt or KTX2 sources load only when the
source uses them. Recipe `creator-import@1` keeps every node, empty and mesh, appends one pivot root,
re-encodes geometry with meshopt and textures as WebP, and caps textures at 2048 px with the reduction
reported. The review separates observed content (parts, clips and variants) from what Biskiq admits,
which is the whole object only. The creator confirms metric scale, pivot, footprint and contact (floor
placement only) and then approves. Approval sits outside source history, and a cancelled, stale or
project-replaced upload never installs.

The API structure gate admits a required `EXT_meshopt_compression` fallback declaration in a derivative
and still refuses an optional one. The first placement installs the `model` resource, its exact lock and
the entity as one accepted result through the resource-granting planner; Undo removes all three. Later
instances reuse the pins with independent instance identity. The editor resolves each distinct pin once
per hash and shares its object URL across instances. Preview receives approved-model URLs only as a
read-only map prop; the public `/p` route passes none.

## Published release delivery (P22 shipped 2026-09-08)

A release manifest pins each referenced P20 texture to its verified object
key + SHA-256/MIME/size. Public bytes serve only while the publication is active and only
through release membership (`GET /publications/:id/versions/:v/assets/:asset/content`,
`no-store`, correct MIME/length, `nosniff`, no R2 redirects). The cold visitor
loader verifies downloaded bytes before installing the runtime and threads a
release-scoped `TextureLoadScope` through the real material consumers
(including model-instance texture overrides); colliding logical URIs across
projects/releases never share cache entries. Publication **fails closed**: a pending, missing,
corrupt or wrong-size asset blocks it. P22 does not broaden P20 ingest
(image textures only, no uploaded models).

The catalogue rows below describe the built-in asset model; the current project
registry is separate and is served through the authenticated API (see
[`platform/project-persistence.ts`](../../../apps/editor/src/lib/platform/project-persistence.ts)).
It is a project-scoped implementation, not the
destination resource system: its storage unit and revision/lock model are governed
by F.2/F.1 under the contract's interface-ownership rule (see
[`../composition-execution.md`](../composition-execution.md); decision context
[`../decisions/northstar-ratification-2026-09-27.md`](../decisions/northstar-ratification-2026-09-27.md)).

---

| Stage | Location |
|-------|----------|
| Source models (raw downloads) | `apps/editor/assets-source/models/<asset-name>/` |
| Licence and acquisition notes | `apps/editor/assets-source/licenses/<asset-name>.md` |
| Production GLBs (optimized output only) | `apps/editor/static/museum/models/` |
| Manifest | `apps/editor/src/lib/content/assets.ts` |
| Plan proxy metadata | `apps/editor/assets-source/plan-proxy/` |

`AssetModel.svelte` owns load/clone/fallback. Do not add a second, room-local GLTF loader — the
legacy room-frame loader branch was removed in #115 and the single renderer path is the contract.

## Model preparation and validation checklist

Absorbed from the retired Paris asset workflow (`git show
e90a58224443bdbf44114d7285d55c983b79cc84:docs/archive/ASSET_WORKFLOW.md`), with the removed
`apps/museum` and `@portfolio/museum` commands replaced by the product catalogue workflow (the
authoring workspace itself was removed by #115). This is
the procedure for preparing a catalogue model; it is not the deferred creator-import pipeline.

**Add or replace a catalogue asset**

1. Place the raw source under `apps/editor/assets-source/models/<asset-name>/`.
2. Create or update the licence/acquisition record in
   `apps/editor/assets-source/licenses/<asset-name>.md`.
3. Optimize the source into a production GLB under `apps/editor/static/museum/models/`.
4. Add or update the catalogue entry in `apps/editor/src/lib/content/assets.ts` with `id`,
   `category`, `sourceFile`, `productionFile`, `sourceUrl`, `creator`, `license`, `attribution`,
   `defaultScale`, `castShadow`/`receiveShadow`, `status`, `rooms`, `notes` and any optional
   `fallback`.
5. Update any fallback primitive if the asset needs a new silhouette.
6. Remove stale references to a replaced asset only after the new asset is in place and verified.

**Optimization checklist.** Edit the source asset, then produce a GLB that is:

- centered on a sensible pivot — usually floor-centered for furniture, ceiling-centered for
  hanging decor;
- stripped of unused attributes where that is safe;
- merged where redundant meshes waste draw calls;
- scaled to the intended room size **in the manifest**, not baked into the layout;
- converted to WebP textures where the source allows it;
- Meshopt-compressed for runtime delivery;
- still carrying whatever materials, tangents or transmission features it needs (the sofa kept
  generated tangents; the grandfather clock kept out-of-range UVs unquantized).

**Validation after any change**

- `npm run check` and `npm run build` at the repository root cover the editor app that ships the
  model.
- `/dev/assets` shows model load status, bounds and fallback behavior.
- The production GLB exists at its `static/museum/models/` path.
- The replaced asset is no longer referenced anywhere.

**Placement rules.** Keep the piano position unchanged unless the owner explicitly asks otherwise.
Treat furniture clusters as layout data, not scene logic. Do not add a second/room-local GLTF
loader.

## Plan footprint metadata (P2.1)

Floor catalogue models may declare optional canonical `Asset.footprint` metadata:
`{ width, depth, outline? }`, in metres after asset normalization and relative
to the placement pivot. `outline` uses finite `[x, z]` points without a repeated
closing point; valid simple concave polygons are accepted and winding is
normalized. Invalid metadata is rejected by manifest validation; missing or
invalid model metadata is ineligible for Scene Plan projection. `defaultScale`
and `defaultRotation` are already reflected in canonical footprint values and
are not applied again.

## Product convergence destination

**Owner-ratified destination, 2026-10-22, PR #173.** See the
[ratification record](../decisions/product-convergence-ratification-2026-10-22.md). Existing catalogue
preparation remains a current procedure; it does not define creator-import capability.
[Review manifest](../../archive/roadmap/coordination-2026-10/product-convergence-2026-10-21-amendments.md).

A creator import retains source bytes, content hash, and recipe identity/version. Its render
derivative preserves addressable source structure and capability meaning, or carries sufficient
source-to-derivative correspondence. Pruning, deduplication, joining or flattening qualifies only
when that preservation is demonstrated. The ingest report distinguishes observed hierarchy,
clips, variants and extensions from capabilities actually admitted by Biskiq. C2 admits a whole
object; retaining parts enables a later component consumer without declaring those parts admitted.
A single-mesh source can still be annotated at a point. Catalogue optimizers are not reused for
creator import unchanged without that qualification.

Product licensing is undecided; the owner rescinded the copyleft choice
([2026-10-23 ruling](../decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction)). Evaluate
established libraries on correctness, capability and measured browser cost inside the canonical
ownership boundaries. Their admissibility cannot be assumed from the former copyleft direction.
While licensing is undecided, a new dependency is admitted only under the owner's
[permissive-only ruling](../decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction), recorded in the consuming slice's
acceptance; this selects no licence file. For T5, weak-copyleft libraries (LGPL, MPL) are eligible
after a documented compatibility, distribution and compliance review
([T5 licensing amendment](../decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-t5-dependency-licensing)).
