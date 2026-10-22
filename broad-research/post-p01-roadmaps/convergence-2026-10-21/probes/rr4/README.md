# RR-4 disposable probes

Evidence for [RR-4](../../relationships-and-revision.md#step-2-results), not authority, not
production code and not a test suite. Run against revision `ce9b7156` (docs-only over the
evidence baseline `78cafc3a`; `git diff 78cafc3a ce9b7156 --stat` touches no inspected source).

## Reproduce

From `apps/editor` (uses the editor workspace's installed Vitest 3.2.7):

```sh
npx vitest run --config ../../broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/rr4/vitest.config.ts
```

Append `q1`, `q2`, `q3` or `q6` to run one file. Each case prints one `RR4 Q<n> <label> {json}`
line; assertions encode only the oracles. Baseline controls (repository root):

```sh
npm exec -w @portfolio/editor -- vitest run tests/lib/layout/layout-curve-split-primitives.test.ts tests/lib/layout/layout-dissolve-curves.test.ts tests/lib/authoring/f4-acceptance.test.ts
npm --prefix prototypes/p3-vellum test -- tests/hold.test.ts tests/storey.test.ts
```

Result at `ce9b7156`: controls 57/57 and 17/17 passed; probes 4 files, 14/14 passed.

## Isolation

`vitest.config.ts` has `root` = this directory and includes only `*.probe.ts`. No existing glob
matches: editor configs include `tests/**/*.{test,spec}.{js,ts}` relative to `apps/editor`;
`prototypes/p3-vellum` includes `tests/**/*.test.ts`; no editor test scans `broad-research/`.
Workspace packages resolve through the root `node_modules/@portfolio/*` links. `q6` imports the
editor-internal coordinator by relative path (`apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts`).
Nothing was placed in or changed under `apps/`, `packages/`, `prototypes/` or `docs/`.

## Files

| File | Probe | What it exercises |
| --- | --- | --- |
| `rr4-support.ts` | — | Probe-only binding/evaluator/transport, composed from exported `layout-core` primitives; occupancy allocator shaped like the landed noding adapter |
| `q1-transport.probe.ts` | Q1 | `planWallSplit` / `planDissolveJunction` on straight and canonical cubic 8 m Walls, both survivor orientations, straddle and Opening contact |
| `q2-cold-continuity.probe.ts` | Q2 | move → split → reversed dissolve → move, JSON round trip, fresh evaluation; B-mig vs B-lin vs C-pose |
| `q3-identity-aba.probe.ts` | Q3 | default chain allocation, occupancy noding, F.1 unit resolver over an F.2 envelope, P23.12 ledger cursor, captured-nonce sketch, live plinth ID capture |
| `q6-atomic-migration.probe.ts` | Q6 | live unit-host shape (unit registry + adapter `compound: true`) with probe planners; injections, Undo/Redo, undeclared compound |

Tolerances: `JUNCTION_COINCIDENCE_EPSILON` (1e-9) for straight positions, `CURVE_ARC_LENGTH_TOLERANCE`
(1e-6) for curved arc distance/position. A run leaves a Vitest results cache in `node_modules/.vite/` here; delete it, and this directory when the packet is folded.
