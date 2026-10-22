# Performance and delivery probes (convergence 2026-10-21)

Disposable research harness for
[`../../performance-and-delivery.md`](../../performance-and-delivery.md). Nothing here is a
product test, a benchmark gate, a CI job or a budget: `apps/editor/tests/README.md`
§"Correctness tests vs performance benchmarks" keeps every permanent benchmark workflow
behind separate owner authorization, and these files install none. No dependency was added;
the probes use what `node_modules` already holds (Vitest 3.2.7, esbuild 0.25.12,
`@jridgewell/sourcemap-codec`, `node:zlib`).

| File | What it measures | Output |
|---|---|---|
| `bundle-analysis.mjs` | Per-route client load set (SvelteKit modulepreload set = start + app entry imports + root layout/error nodes + leaf node imports), raw / gzip-9 / brotli-11 sizes, and, when `*.js.map` exist, byte attribution to source packages by decoding each chunk's mappings | stdout; `--json <file>` |
| `compile.probe.ts` | Warm in-process cost by Layout size: compile, Plan evaluation, Layout codec, unit envelope serialize + content id, Stage admission (`admitSourceJson`), per-pointer-move Wall preview solve (`planWallManipulation`), Wall-chain commit planners, F.4 accept through the real coordinator + Layout planners, post-install Stage admission, Undo/Redo; retained heap with `--expose-gc` | `results/compile-warm.json` |
| `mesh.probe.ts` | Three-free CPU half of the full Wall-mesh rebuild (`buildStandaloneWallMesh` over all compiled Walls), mesh/triangle/buffer volume | `results/mesh-warm.json` |
| `history.probe.ts` | Retained heap of the F.4 coordinator after 120 accepted edits (history limit 100) and accept-time drift, S and M | `results/history-warm.json` |
| `cold-compile.mjs` (+ `cold-entry.ts`, `make-fixtures-entry.ts`) | Fresh Node process per run: parse/validate, first (JIT-cold) compile, second, tenth, first Plan evaluation | `results/compile-cold.json` |
| `fixtures.ts` | k×k gallery grids of 6 m cells built only through `planWallChain` (declared host snaps) and `planCreateWallFirstOpening`; Walls = 2k²+2k, Rooms = k² | — |

## Running (from the repository root)

```sh
# 1. Delivery baseline. Needs no env: the client reads PUBLIC_API_ORIGIN via $env/dynamic/public.
/usr/bin/time -l npm run build                          # timed production build (editor only)
node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/bundle-analysis.mjs
# Package attribution needs sourcemaps; this overwrites the gitignored .svelte-kit output:
(cd apps/editor && npx vite build --sourcemap)
node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/bundle-analysis.mjs --json /tmp/bundle.json
npm run build                                           # restore an ordinary build afterwards

# 2. Warm probes. A trailing filter picks one file: compile | mesh | history (none = all, ~5 min).
#    compile: PERF_SIZES=3,7,14 (default), PERF_STRESS=0 skips grid-20; mesh/history honour PERF_SIZES.
npx vitest run --config broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/vitest.config.ts compile

# 3. Cold-process compile (argument = runs per fixture, default 7)
node broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/cold-compile.mjs
```

The Vitest config's root is this directory and it includes only `*.probe.ts`; its
`cacheDir` is in the OS temp dir. `cold-compile.mjs` bundles into a fresh
`$TMPDIR/convergence-perf-cold-*` directory. Neither writes anywhere in the repository except
`results/`.

## Recorded run (2026-10-22, HEAD `3e8342a3`)

- Machine: Apple M2, 8 cores (4P+4E), 16 GiB (`sysctl -n machdep.cpu.brand_string hw.memsize`
  → `Apple M2`, `17179869184`), macOS 15.7.2 (24G325), Node v26.7.0, mains power, other
  apps idle but not quit. No two probes and no build ran concurrently.
- Build: `npm run build` exit 0, 10.0 s wall (repeat 8.6 s), 0.96 GiB max RSS. The SSR pass reports
  6.9 s including the nested 3.6 s client pass. `vite build --sourcemap` took 8.8 s. An ordinary build
  was restored afterwards.
- Recorded files: `compile-warm.json` is the second complete warm run (the first stopped at the
  stress row on an operation-id bug, since fixed). `compile-cold.json` used 7 runs per fixture.
  `mesh-warm.json` and `history-warm.json` are single runs. The bundle numbers in the packet are
  from the plain build; attribution is from the sourcemap build.

**Precision.** Route sets come from SvelteKit's own server node tables (exact). Sizes are of
the emitted files with any `sourceMappingURL` comment stripped (exact; the plain and the
sourcemap build agree within 0.1 KiB per route although a few chunk hashes differ).
Package attribution charges each generated span to the source of the mapping segment that
starts it (exact to segment granularity; `(unmapped)` is runtime glue, ~1 % of bytes).
The per-package `br*` is standalone brotli of that package's spans and over-states its share
slightly. Timings are a fast developer machine's relative-cost and scaling evidence, not
reference-laptop budgets.

**Lead verification rerun (2026-10-22).** The convergence lead reran `compile.probe.ts` at `3e8342a3`
on the same M2 machine, which regenerated `results/compile-warm.json` at
`2026-10-22T10:10:42.901Z`. The packet's warm table now cites this checked-in rerun, including its
tails: for example, the 420-Wall full-compile median/p95 is 138.30/158.33 ms and the drag-preview
solve 186.70/226.81 ms. Earlier measurements are historical comparisons, not extra samples in
this file. Sums of component medians are labelled estimates, never end-to-end percentiles.
