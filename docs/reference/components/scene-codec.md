# Scene codec layout

**Read when:** working inside `packages/project-model/src/scene-codec/` or its app facade.
**Last reviewed:** 2026-09-27 (ratified direction reconciled; current behavior
remains authoritative until cutover)

---

## Boundary status (ratified 2026-09-27)

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

Five files, one public surface. CURRENT canonical Scene is world-local (`formatVersion: 1`): project/world coordinates, no `roomId`. LEGACY compatibility shape is versionless room-local (`roomId` + room-frame coordinates), accepted only through the explicit legacy identification/conversion path.

```text
packages/project-model/src/scene-codec/
  index.ts          ← public barrel: validate/parse/serialize + public types
  readers.ts        ← leaf: typed JSON readers + JsonRecord, shared by all parsers
  parse-entities.ts ← entities, materials, textures, clusters
  parse-document.ts ← nodes, waypoints, connections, timing, semantic validation
  canonical.ts      ← clone helpers + deterministic serializer (consumed by index only)
```

## Boundary rule

- **Only `index.ts` is public.** Package consumers import from `@portfolio/project-model`; the editor facade at `apps/editor/src/lib/content/scene-codec/` configures the same barrel for catalogue validation. The visitor has no codec facade: `apps/museum/src/lib/content/scene.ts` calls the package directly through its catalogue-policy seam. No consumer imports the siblings.
- The boundary is **convention, not enforced by the module system.** The `@internal` JSDoc tags are the contract: they forbid sibling imports. The app facade is a thin adapter, not a second codec; restructuring the five files is safe as long as the package `index.ts` surface is unchanged.
- Public surface (frozen): `SceneDocumentIssue`, `SceneDocumentValidationResult`, `SceneDocumentValidationError`, `cameraSceneConnectionTimingFailureReason`, `validateSceneDocument`, `parseSceneDocumentJson`, `serializeSceneDocument`.

## Dependency direction

Value imports flow **into** the barrel: `index.ts` imports from `readers`, `parse-entities`, `parse-document`, `canonical`. Siblings may import the public issue type from `./index` as `import type` only — erased at compile time, so there is no runtime cycle. `readers.ts` is the shared leaf; keep helpers several parsers use there instead of duplicating them. Catalogue/material/texture policy enters through the pure `SceneValidationOptions` seam supplied by each app's `scene-validation.ts` adapter.
