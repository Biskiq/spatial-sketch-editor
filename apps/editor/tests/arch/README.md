# Architecture contracts

The arch lane is one source index and thirteen contract files. Each contract imports the case modules that hold its assertions; the case modules keep their original paths so every `import.meta.url` root still resolves.

| Contract file | Case modules |
| --- | --- |
| `authoring-adapters.arch.test.ts` | `light-adapter-boundary.arch.case`, `scene-adapter-boundary.arch.case`, `layout-manipulation-boundary.arch.case`, `layout-drawing-boundary.arch.case` |
| `authoring-f4.arch.test.ts` | `f4-public-isolation.arch.case`, `slice-ink-wiring.arch.case`, `stage-facade-boundary.arch.case`, `stage-shell-composition.arch.case` |
| `authoring-integration.arch.test.ts` | `compile-entry-boundary.arch.case`, `integration-hotspots.arch.case`, `editor-host-no-write.arch.case`, `integration-ownership.arch.case` |
| `authoring-route-experience.arch.test.ts` | `spatial-route-experience-homes.arch.case` |
| `authoring-route.arch.test.ts` | `spatial-route-boundary.arch.case` |
| `authoring-save.arch.test.ts` | `save-call-sites.arch.case` |
| `camera.arch.test.ts` | `camera-core-boundary.arch.case` |
| `design.arch.test.ts` | `presentation-tokens.arch.case` |
| `experience.arch.test.ts` | `experience-controller-boundary.arch.case`, `experience-shared-homes.arch.case`, `experience-structure-tokens.arch.case` |
| `geometry.arch.test.ts` | `geometry-core-boundary.arch.case` |
| `layout.arch.test.ts` | `layout-identity-boundary.arch.case`, `program-entry-closure.arch.case`, `project-model-boundary.arch.case` |
| `render.arch.test.ts` | `canvas-tone-mapping.arch.case`, `wall-mesh-shell-boundary.arch.case`, `light-realizer-boundary.arch.case`, `material-factory-boundary.arch.case`, `model-lifecycle-boundary.arch.case`, `render-identity-boundary.arch.case`, `render-layer-boundary.arch.case`, `renderer-portability-boundary.arch.case` |
| `repository.arch.test.ts` | `legacy-isolation.arch.case`, `locality-budgets.arch.arch.case`, `preview-surface-boundary-plugin.arch.case`, `public-surface-boundary-plugin.arch.case` |
| `visitor.arch.test.ts` | `preview-surface-boundary.arch.case`, `preview-surface-closure.arch.case`, `visitor-cold-runtime.arch.case`, `visitor-identity-isolation.arch.case`, `visitor-public-route.arch.case`, `visitor-runtime-state.arch.case` |
