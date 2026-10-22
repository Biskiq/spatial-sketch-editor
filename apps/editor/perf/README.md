# On-demand performance harness (T3.P03.S02)

Owner-authorized 2026-10-22 by the
[product-convergence ratification](../../../docs/reference/decisions/product-convergence-ratification-2026-10-22.md)
and installed by T3.P03.S02. It is a permanent **on-demand** workflow: no CI job,
no schedule, no benchmark registry and no Vitest timing assertion. `npm test`,
`npm run check` and `npm run build` never collect or call it.

The owning contract is
[browser performance and delivery](../../../docs/reference/components/performance.md);
the workflow rule lives in
[the test contract](../tests/README.md#product-convergence-performance-workflow).

```sh
npm run perf                 # from the repository root: production build + all flows
npm run perf:bundle          # delivery report over the current production build

# one flow / one browser, reusing an existing preview server
cd apps/editor
npx playwright test --config perf/playwright.config.ts flows/drag-correlation.spec.ts --project=chromium
PERF_BASE_URL=http://127.0.0.1:4173 npx playwright test --config perf/playwright.config.ts
```

`npm run perf` builds with `vite build` and serves the ordinary production build
with `vite preview` on `http://127.0.0.1:4173`. Nothing about the harness enters
that bundle: `src/lib/platform/perf-marks.ts` is inert until the harness sets
`__BISKIQ_PERF__.enabled` through a Playwright init script. Browsers come from
Playwright's own cache (Chromium, plus branded Chrome where installed); every run
uses a fresh context, never a user profile.

## Flows

| Spec | Flow | What it records |
| --- | --- | --- |
| `flows/startup.spec.ts` | F1 startup | hub interactive, Stage first frame, FCP, LCP, long tasks, script bytes/requests, cold and warm |
| `flows/project-open.spec.ts` | F2 open | S (grid-3) and M (grid-7) admission → first architectural frame, cold and warm |
| `flows/orbit.spec.ts` | F7 orbit | 10 s scripted orbit + dolly (extended only until the run reaches 600 frames), frame-interval p50/p95/p99, dropped frames, long tasks, cold and warm |
| `flows/save.spec.ts` | F9 Save | save:submit → local feedback presented → durable receipt → saved, through the API test-auth seam on a local stack, cold and warm |
| `flows/cycles.spec.ts` | F13 repeated open/close | 10 cycles × (open + 20 edits + close), JS heap after forced GC, cold and repeat-use |
| `flows/drag-correlation.spec.ts` | F3/F4/F8 methodology | input sequence → matching preview presentation, latest-input age, final-result completion, precision commit, 20 Undo/Redo cycles, cold and warm, plus the deliberately delayed-preview proof |
| `flows/calibration.spec.ts` | CPU calibration | grid-7 compile + Stage admission, 20 runs, CDP throttling search when a reference median is supplied |

## Correlation (why the ledger exists)

Continuous inputs are not Event Timing. Each `pointermove` calls
`perfInput()`, which assigns a monotonic sequence; the Layout adapter's preview
installation records it, and the route marks `overlay:updated` only when the
overlay it paints actually changed. The harness pairs the input with the first
frame at or after that mark, so a delayed callback is reported as **latency**,
never as a sample that never arrived. Every input keeps a row with status
`presented`, `superseded`, `refused` or `unresolved`. The `drag-correlation`
spec reruns the same drag with every application rAF callback delayed by 500 ms
and asserts that all 60 samples still exist and the presented latency distribution
shifts beyond the baseline.

Presentation is attributed to the rendering-opportunity frame (rAF). That is an
approximation for the hard presentation gate: the traced-image proof belongs to
the owner-run reference rows. Page INP is reported separately from operation
completion; with ten milestone samples p95/p99 are coarse and the report says so.

## Environment

| Variable | Meaning |
| --- | --- |
| `PERF_BASE_URL` | reuse an already-running preview instead of building one |
| `PERF_PORT` | preview port (default `4173`) |
| `PERF_RUNS` | measured runs per flow × workload × cache state (default 10) |
| `PERF_WARMUP` | discarded warm-up runs (default 1) |
| `PERF_SAMPLES` | pointer samples per continuous drag (default 60) |
| `PERF_NETWORK` | `N0`, `N1` (default) or `N2` |
| `PERF_RESULTS_DIR` | raw result directory (default `$TMPDIR/biskiq-perf-results`) |
| `PERF_POWER_STATE` | declared power state, recorded with each result |
| `PERF_REFERENCE_CALIBRATION_MS` | the reference machine's owner-run calibration median |
| `PERF_API_ORIGIN` / `E2E_TEST_AUTH_SECRET` | local API stack for F9 (never production) |

A reduced pass (`PERF_RUNS<10` or `PERF_SAMPLES<60`) is labelled a pre-flight
pass in every row and is never acceptance evidence.

Flows with a navigation or drag (`F1`, `F2`, `F3`/`F4`/`F8`, `F7`, `F9`, `F13`)
run cold and warm/repeat-use; cold clears the HTTP cache and cookies before every
measured run. F13's repeated-use row is the contract's ten-cycle
repeat-use state. The delayed-preview proof remains a warm-only diagnostic, not
a flow row.

F7 paces its 60-step orbit to a 10 s wall-clock deadline. On a 60 Hz presented
clock that is the contract's ≥600 frames. If the browser presents below 60 Hz,
the same orbit continues past 10 s until it reaches 600 frames and the row
reports the actual duration, so a 30 Hz environment is visible rather than
hidden behind a "10 s" label.

## Results and budgets

Raw results are written outside Git; only the slice's acceptance record
summarizes machine, browser, power, cache, network, workload, commit and
limitations. **Hard rows — including this slice's baseline and calibration
medians — are run and accepted only on the designated reference machine, the
owner's MacBook Air M2 with 16 GB, operated by the owner** (batch E, E6
amendment). A run on another machine is pre-flight unless it is calibrated
against that machine's calibration median; with no matching rate the report says
there is no calibrated equivalence and extrapolates nothing.

## Bundle report

`perf:bundle` reproduces the convergence packet's per-route load sets on the
current tree and can refuse an injected load-set entry:

```sh
node perf/bundle-report.mjs --forbid '/p/[publicationId]=src/lib/authoring/'
node perf/bundle-report.mjs --forbid '/project/[projectId]/spatial=preview' --json /tmp/bundle.json
```

Package attribution needs a sourcemap build (`npx vite build --sourcemap`);
restore an ordinary build afterwards. The command exits non-zero on any forbidden
entry, which is the lazy-chunk absence check later consumers use.
