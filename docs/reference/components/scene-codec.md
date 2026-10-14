# Scene codec layout

**Read when:** working inside `packages/project-model/src/scene-codec/` or the app Scene seam.
**Last reviewed:** 2026-10-13 (#115 WP4 — current-format-only readers; `apps/museum` and the editor facade gone)

---

## Boundary status (ratified 2026-09-27; current-format-only since #115)

This file documents the **current** Scene codec internals. Under the ratified
destination (F.2), Scene remains one codec-bounded unit inside the project
envelope, while Camera moves to its own codec-bounded unit and the Experience
unit is added — all governed by
[`../composition-execution.md`](../composition-execution.md). The release reader
never consumes these authoring codecs (release formats are separate from source
formats, F.5), so this boundary can evolve without creating visitor
compatibility obligations. Do not grow compound-acceptance or release logic
here: compound cross-domain acceptance belongs to F.4 (one expected revision,
typed intents, one atomic accepted result and undo) and release lowering to
F.5. See [`../decisions/northstar-ratification-2026-09-27.md`](../decisions/northstar-ratification-2026-09-27.md)
and [`persistence.md`](./persistence.md).

Five files, one public surface. The canonical Scene is **world-local
(`formatVersion: 1`)** only: project/world coordinates, no `roomId`. There is
deliberately **no legacy shape and no legacy path** — #115 removed the versionless
room-local form together with its identification/conversion facade, so the
readers accept the current format and nothing else. Malformed, incomplete or
unrecognised input fails ordinary current-format validation; there is no
`unsupported_generation` diagnostic, no legacy detector or classifier, and no
compatibility facade.

```text
packages/project-model/src/scene-codec/
  index.ts          ← public barrel: validate/parse/serialize + public types
  readers.ts        ← leaf: typed JSON readers + JsonRecord, shared by all parsers
  parse-entities.ts ← entities, materials, textures, clusters
  parse-document.ts ← nodes, waypoints, connections, timing, semantic validation
  canonical.ts      ← clone helpers + deterministic serializer (consumed by index only)
```

## Boundary rule

- **Only `index.ts` is public.** Package consumers import from `@portfolio/project-model`. The app seam is `apps/editor/src/lib/content/scene.ts`, which re-exports the barrel and supplies the catalogue validation options from `apps/editor/src/lib/content/scene-validation.ts`. The editor shell and the separate `apps/museum` app are gone (#115), so the visitor cold runtime consumes that same seam. No consumer imports the siblings.
- `scene.ts` also exposes `resolveSceneDocument(input)` as the app-side resolution seam. It wraps the package entry with the catalogue options; it takes **no** Room registry, because a current-format Scene carries no Room ownership and its values are already project/world coordinates.
- The boundary is **convention, not enforced by the module system.** The `@internal` JSDoc tags are the contract: they forbid sibling imports. The app seam is a thin adapter, not a second codec; restructuring the five files is safe as long as the package `index.ts` surface is unchanged.
- Public surface (frozen): `SceneDocumentIssue`, `SceneDocumentValidationResult`, `SceneDocumentValidationError`, `cameraSceneConnectionTimingFailureReason`, `validateSceneDocument`, `parseSceneDocumentJson`, `serializeSceneDocument`.

## Removed with the current-format cutover

- the legacy Scene decoder branch and the versionless room-local acceptance path;
- the compatibility/migration facades `project-compat`, `scene-world-conversion` and `standalone-scene-import`, and the legacy `createEmptyProject`;
- `placementToModelEntity` (it built a `roomId`, which the current format forbids) and the orphaned `getNode` re-export — consumers import `getNode` from `@portfolio/camera-core` directly;
- the Room-registry parameter on Scene resolution.

None of these has a replacement detector. The retired behavior is recoverable at
the baseline (`git show e90a58224443bdbf44114d7285d55c983b79cc84:<path>`).

## Dependency direction

Value imports flow **into** the barrel: `index.ts` imports from `readers`, `parse-entities`, `parse-document`, `canonical`. Siblings may import the public issue type from `./index` as `import type` only — erased at compile time, so there is no runtime cycle. `readers.ts` is the shared leaf; keep helpers several parsers use there instead of duplicating them. Catalogue/material/texture policy enters through the pure `SceneValidationOptions` seam supplied by the app's `scene-validation.ts` adapter.
