# Scene codec layout

**Read when:** working inside `packages/project-model/src/scene-codec/` or the app Scene seam.
**Last reviewed:** 2026-11-21 (S8 E: Scene 12 / resources 3 is the sole canonical format)

---

## Codec boundary

Scene 12 is the Camera-free Scene unit in the current envelope. The internal Scene projection used
by the Camera codec is not a second authored Scene authority. Camera and Experience are separate
units today. Release readers do not consume authoring codecs. Compound acceptance belongs to F.4.

Scene 12 stores the authored Sky. Its Sun and Moon positions are derived from time,
heading and noon height. The all-default Studio Sky normalizes to absence, as does an empty
environment. Scene 11 and earlier source and release payloads are refused with
`unsupported_format_version`; no converter exists. Publishing again requires a re-authored Scene 12
project.

Scene 12's Finish grammar is strict and is read by the material reader (`materials/read.ts`), which
never clamps. A Finish has a `catalogue` or `material` (recipe digest) base and sparse `overrides`;
an absent field inherits the base, `null` disables one base map, and an empty override container is
never persisted, so canonical bytes hash the authored content only. A `target` or `surface` mapping
carries a metric (`tileMeters`, `rotation`, `offset`); a `uv` mapping names a native UV set, repeat,
rotation and offset. Rotations normalize to [0, 2π) radians and offsets to [0, 1). The codec does not tie `normalScale` to a normal map: a disabled normal map keeps its stored strength dormant. The
F4 Finish patch refuses a patch that sets `normalScale` (or resets the normal map while leaving an authored
`normalScale`) when no normal binding remains (`normal-control-without-normal`). A colour is a lowercase `#rrggbb` literal or a `{slot}` follower, and the codec leaves
follower closure to the unit validator, which is the only reader holding the palette. Retired
Scene 11 Finish keys such as `normalFlipY` and `baseTextureId` are unknown keys, and a
`/project-assets/{assetId}` texture's Scene id must equal that asset id (`texture_id_mismatch`).
Material definitions live in resources 3, never in Scene.

Optional `surfaceFinishes` is a nonempty, sorted and unique array of assignments to canonical Layout
`wall-side`, `room-floor`, `room-lid` or `region-face` references. A Region face must be `top` or
`underside`; `edge` is refused with `unknown_surface_face`, because a perimeter strip has no Finish
face. Each assignment names exactly one curated `materialId` or non-pristine `materialInstanceId`;
an empty field is omitted. Unknown reference kinds, duplicate identities, unsorted records and
non-normal Finish references are refused. Cross-unit validation reports a retired Layout identity
as `unresolved-surface`; it is retained on read for recovery and resolved to the Layout default.

```text
packages/project-model/src/scene-codec/
  index.ts          ← public barrel: validate/parse/serialize + public types
  readers.ts        ← leaf: typed JSON readers + JsonRecord, shared by all parsers
  parse-entities.ts ← entities, materials, textures, clusters
  parse-document.ts ← nodes, waypoints, connections, timing, semantic validation
  canonical.ts      ← clone helpers + deterministic serializer (consumed by index only)
```

## Boundary rule

- **Only `index.ts` is public.** Package consumers import from `@portfolio/project-model`. The app seam is `apps/editor/src/lib/content/scene.ts`, which re-exports the barrel and supplies the catalogue validation options from `apps/editor/src/lib/content/scene-validation.ts`. The pre-#115 editable shell and separate `apps/museum` app are gone; The Stage consumes this same seam. No consumer imports the siblings.
- `scene.ts` also exposes `resolveSceneDocument(input)` as the app-side resolution seam. It wraps the package entry with the catalogue options; it takes **no** Room registry, because a current-format Scene carries no Room ownership and its values are already project/world coordinates.
- The boundary is **convention, not enforced by the module system.** The `@internal` JSDoc tags are the contract: they forbid sibling imports. The app seam is a thin adapter, not a second codec; restructuring the five files is safe as long as the package `index.ts` surface is unchanged.
- Public surface (frozen): `SceneDocumentIssue`, `SceneDocumentValidationResult`, `SceneDocumentValidationError`, `cameraSceneConnectionTimingFailureReason`, `validateSceneDocument`, `parseSceneDocumentJson`, `serializeSceneDocument`.

## Connectivity context

`SceneValidationOptions.connectivity` defaults to `single-component`: a direct Scene
document still requires every edge-bearing navigation node to belong to one connected
graph. The Camera unit explicitly uses the `independent-components` policy through
the one named `CAMERA_UNIT_SCENE_VALIDATION` constant; Camera-unit admission and its
runtime Scene projection force that policy after merging host catalogue options. Only
the global reachability walk is skipped in that context — reciprocal adjacency, one
direct edge per unordered pair, endpoint/anchor/timing/pose checks and unknown-field
refusal are unchanged. The choice is an internal validation context, never an authored
setting, and it introduces no second graph or route evaluator.

## Dependency direction

Value imports flow **into** the barrel: `index.ts` imports from `readers`, `parse-entities`, `parse-document`, `canonical`. Siblings may import the public issue type from `./index` as `import type` only — erased at compile time, so there is no runtime cycle. `readers.ts` is the shared leaf; keep helpers several parsers use there instead of duplicating them. Catalogue/material/texture policy enters through the pure `SceneValidationOptions` seam supplied by the app's `scene-validation.ts` adapter.
