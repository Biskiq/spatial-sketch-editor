# Assets

**Read when:** Paris GLBs, licences, catalogue, import/replace models, project texture registry.  
**Last reviewed:** 2026-09-08 (P22 shipped — release delivery below)
**Full checklist:** [`../archive/ASSET_WORKFLOW.md`](../../archive/ASSET_WORKFLOW.md)

---

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

The catalogue rows below describe the built-in asset model; the project
registry is separate and is served through the authenticated API (see
[`editor/project-persistence.ts`](../../../apps/editor/src/lib/editor/project-persistence.ts)
and `EditorAssetLibrary.svelte`).

---

| Stage | Location |
|-------|----------|
| Source models | `apps/editor/assets-source/models/` |
| Licences | `apps/editor/assets-source/licenses/` |
| Production GLBs | `apps/museum/static/museum/models/` |
| Manifest | app-local `src/lib/content/assets.ts` |
| Placements | `scene.json` via editor |

`AssetModel.svelte` owns load/clone/fallback. Do not add room-local GLTF loaders.  
GLB import pipeline = **deferred** (not scheduled; re-registers after the P12/P3B hard gate).

## Plan footprint metadata (P2.1)

Floor catalogue models may declare optional canonical `Asset.footprint` metadata:
`{ width, depth, outline? }`, in metres after asset normalization and relative
to the placement pivot. `outline` uses finite `[x, z]` points without a repeated
closing point; valid simple concave polygons are accepted and winding is
normalized. Invalid metadata is rejected by manifest validation; missing or
invalid model metadata is ineligible for Scene Plan projection. `defaultScale`
and `defaultRotation` are already reflected in canonical footprint values and
are not applied again.
