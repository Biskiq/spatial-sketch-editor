# Scene codec layout

**Read when:** working inside `packages/project-model/src/scene-codec/` or the app Scene seam.
**Last reviewed:** 2026-11-03 (S29 Camera-unit connectivity context)

---

## Codec boundary

Scene 5 is the Camera-free Scene unit in the current envelope. The internal Scene projection used
by the Camera codec is not a second authored Scene authority. Camera and Experience are separate
units today. Release readers do not consume authoring codecs. Compound acceptance belongs to F.4.

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
