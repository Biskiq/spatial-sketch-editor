# RR-1/RR-2 vertical and overhead probes (disposable)

Evidence for [`../../vertical-and-overhead.md`](../../vertical-and-overhead.md) §Step 2 results. Not a
product test, schema or contract. Delete with the packet's research round; nothing here is imported by
`apps/`, `packages/` or `prototypes/`.

**Run** (repo root, installed root Vitest 3.2.7, no install or download):

```sh
cd apps/editor
npx vitest run --config ../../broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/vertical/vitest.config.ts
```

- Source revision: `ce9b7156` (`git diff 78cafc3a ce9b7156 --stat -- packages prototypes apps` is empty).
- Environment: Node v26.7.0, macOS (darwin 24.6), 2026-10-22. Runtime ~1.6 s for 66 tests.
- Isolation: `vitest.config.ts` roots at this folder and includes only `*.probe.ts`; the editor suite
  includes `tests/**/*.{test,spec}.{js,ts}` relative to `apps/editor`, P3 `tests/**/*.test.ts`, and the
  API runs named `.mjs` files, so none of them match. Vite's cache goes to the OS temp directory.
- Output: `results/<probe>.json`, one row per case with `verdict` (pass/refuse/fail/untested) and the
  `expected` verdict declared before running. A row whose alternative is expected to fail is recorded as
  `fail`/`fail`; the suite only asserts that verdicts match expectations.

| File | Kind | Imports | Fixtures / oracle | Tolerance |
| --- | --- | --- | --- | --- |
| `p0-format5.probe.ts` | Production observation (read-only) | `@portfolio/layout-core` source | Hand-built format-5 documents: low ring in a hall, overlapping enclosures, datum raise, collinear overlap | exact |
| `v1-datum-frame.probe.ts` | Model probe of alternatives A/B/C + host/isolated | none | Two-pavilion fixture with bridge, basement, 3.024/3.026 m datums, nested definitions; hand-calculated world points | 1e-9 m |
| `v2-shared-wall.probe.ts` | Model probe S/I/U | none | Split-level 10 m façade, window/door across step, stacked Walls; hand-computed gap/overlap areas | 1e-9 m² |
| `o1-overhead.probe.ts` | Model probe of closure policies | none | Two Rooms + roof, suspended ceiling, closure, canopy, mezzanine slab; 0.5 m cell areas vs hand sums | 1e-9 m² |
| `g1-wings-chebyshev.probe.ts` | P3 evaluator + mesh vs independent closed form | P3 `src/model/*`, `src/scene/build/overheads.ts`, `tests/support/roofProbe.ts` (read-only) | P3 L/unequal L/T/U/plus + staircase, Z, wide-stem T, slit courtyard, rectangle control; ×{as-is, 30°, +1000 m, reversed}; L∞ oracle | evaluator 1e-9 m, mesh 1e-5 m |

Not executed here (see the packet ledger for triggers): O2, G2, R1, any Clipper2/CGAL/Manifold check
(not installed; no downloads), curved-Wall V2 cases, a native-vs-import comparison.
