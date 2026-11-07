# Path-to-doc map

> **Covers:** where a code path's owning contract and tests live. **Read the narrowest row**, then the
> contract section it names. **Authority:** contracts own semantics; code/tests own current behavior.

| Code path | Read first | Also relevant |
| --- | --- | --- |
| `packages/layout-core/src/` | [Layout](./reference/components/layout.md) | [Persistence](./reference/components/persistence.md), [Performance](./reference/components/performance.md) |
| `packages/project-model/src/units/` | [Composition / F](./reference/composition-execution.md) | [Persistence](./reference/components/persistence.md), [architecture](./reference/architecture.md) |
| `packages/project-model/src/units/experience/` | [Experience](./reference/components/experience.md) | [Camera and tour](./reference/components/camera-tour.md) |
| `packages/camera-core/src/` | [Camera and tour](./reference/components/camera-tour.md) | [Stage grammar](./reference/design-system/spatial-instrument-grammar.md#camera-framing-instruments) |
| `packages/geometry-core/src/` | [Scene content](./reference/components/scene-content.md) | [Architecture](./reference/architecture.md) |
| `apps/editor/src/lib/authoring/stage/` | [Shell / PLATE](./reference/design-system/editor-shell-and-visual-system.md) | [Stage grammar](./reference/design-system/spatial-instrument-grammar.md), [acceptance](../apps/editor/tests/README.md) |
| `apps/editor/src/lib/authoring/experience/` | [Shell — Experience expression](./reference/design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression) | [Experience](./reference/components/experience.md), [Camera](./reference/components/camera-tour.md) |
| `apps/editor/src/lib/visitor/` | [Camera — Visitor guided runtime](./reference/components/camera-tour.md#visitor-guided-runtime) | [Architecture — platform boundary](./reference/architecture.md#platform-boundary-current) |
| `apps/editor/src/lib/authoring/save/` | [Persistence](./reference/components/persistence.md) | [F.4 acceptance](./reference/composition-execution.md#f4-compound-acceptance) |
| `apps/editor/src/routes/project/` | [Architecture — Product routes](./reference/architecture.md#product-routes-current) | [Shell](./reference/design-system/editor-shell-and-visual-system.md) |
| `apps/api/src/` | [Persistence](./reference/components/persistence.md) | [Architecture — platform boundary](./reference/architecture.md#platform-boundary-current) |
| `apps/editor/tests/` | [Test contract](../apps/editor/tests/README.md) | [Harness operation](./workflow.md) |
| `tools/harness/` | [Harness operation](./workflow.md) | [Merge gate](../.github/workflows/merge-gate.yml) |
| `docs/reference/design-system/` | [Shell](./reference/design-system/editor-shell-and-visual-system.md) | [Stage grammar](./reference/design-system/spatial-instrument-grammar.md), accepted sheets |
| `prototypes/` | [Prototype hub](../prototypes/README.md) | not product or persisted-format authority |
