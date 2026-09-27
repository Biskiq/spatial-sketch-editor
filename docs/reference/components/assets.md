# Assets

**Read when:** Paris GLBs, licences, catalogue, import/replace models, project texture registry.  
**Last reviewed:** 2026-09-27 (ratified direction reconciled; current behavior
remains authoritative until cutover)
**Full checklist:** [`../archive/ASSET_WORKFLOW.md`](../../archive/ASSET_WORKFLOW.md)

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
creator/audience loop under the re-derived P24/T2 track — it is not contingent
on a complete asset pipeline, and static-only catalogue supply is no longer the
scope ceiling.

## Current asset system (P20 shipped 2026-09-04 — S0–S4)

```text
Built-in catalogue
→ existing catalogue/static behavior
→ no P20.2 registry row required

Local file texture
→ session BinaryTextureStore
→ package portability path
→ not durable cloud storage by itself

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

P20 does **not** build the final Assets workspace. Local/package durability
conversion is explicit. Cloud Load resolves every referenced logical texture
before project replacement, verifies registry metadata plus MIME/size/SHA,
then primes the existing binary store; failure leaves the current project
unchanged. GLB import, provider search, and delete/GC remain deferred. Built-ins
retain catalogue identity — do not invent registry behavior for them.

## Published release delivery (P22 shipped 2026-09-08)

A release manifest pins each referenced P20 texture to its verified object
key + SHA-256/MIME/size and projects shipped-static dependencies through the
checked-in compatibility registry (stable logical identity, never bundler
hash URLs). Public bytes serve only while the publication is active and only
through release membership (`GET /publications/:id/versions/:v/assets/:asset/content`,
`no-store`, correct MIME/length, `nosniff`, no R2 redirects). The cold visitor
loader verifies downloaded bytes before installing the runtime and threads a
release-scoped `TextureLoadScope` through the real material consumers
(including model-instance texture overrides); colliding logical URIs across
projects/releases never share cache entries. P22 does not broaden P20 ingest
(image textures only, no uploaded models).

The catalogue rows below describe the built-in asset model; the current project
registry is separate and is served through the authenticated API (see
[`editor/project-persistence.ts`](../../../apps/editor/src/lib/editor/project-persistence.ts)
and `EditorAssetLibrary.svelte`). It is a project-scoped implementation, not the
destination resource system: its storage unit and revision/lock model are governed
by F.2/F.1 under the contract's interface-ownership rule (see
[`../composition-execution.md`](../composition-execution.md); decision context
[`../decisions/northstar-ratification-2026-09-27.md`](../decisions/northstar-ratification-2026-09-27.md)).

---

| Stage | Location |
|-------|----------|
| Source models | `apps/editor/assets-source/models/` |
| Licences | `apps/editor/assets-source/licenses/` |
| Production GLBs | `apps/museum/static/museum/models/` |
| Manifest | app-local `src/lib/content/assets.ts` |
| Placements | `scene.json` via editor |

`AssetModel.svelte` owns load/clone/fallback. Do not add room-local GLTF loaders.  
The broad GLB import pipeline remains **deferred**; the first truthful
single-model creator import is re-derived into the first creator/audience loop
(see destination above), not scheduled by this reconciliation.

## Plan footprint metadata (P2.1)

Floor catalogue models may declare optional canonical `Asset.footprint` metadata:
`{ width, depth, outline? }`, in metres after asset normalization and relative
to the placement pivot. `outline` uses finite `[x, z]` points without a repeated
closing point; valid simple concave polygons are accepted and winding is
normalized. Invalid metadata is rejected by manifest validation; missing or
invalid model metadata is ineligible for Scene Plan projection. `defaultScale`
and `defaultRotation` are already reflected in canonical footprint values and
are not applied again.
