# T3.P04.S01 integrated verification — 2026-10-25

**Disposition:** verification recorded; slice acceptance remains pending. See the [acceptance record](../../acceptance.md).

## Fresh corrected F9 attribution run — 2026-10-25

The F9-only headed Chrome test passed at capture commit `31c83a7cbfc126690272c5de14c132b518d31825`,
tree `ac154840d056b9461ef9b658255a4e84e381ee20`; the worktree was clean. API/editor artifacts were
rebuilt at that revision. The product-code portion is commit `65689f4f34d4ae07ed863b32703b9aa27ea4568c`,
tree `7999d5e24ff654d896d46d373483dcc3c68ea71c`. Commit
`596e8b9cffa9e6ec4e16c94d6249fbe0a4cc1be2` makes a QA metadata-only correction to remove an
incorrect AC-powered label; it does not change the measured flow or product code.

The run used Google Chrome `155.0.8059.85` on Mac14,2 / macOS 15.7.2, 1920×1080 CSS at DPR 1,
N1 networking (40 ms latency, 625 kB/s upload, 2.5 MB/s download), one warm-up and ten measured runs
per S/M × cold/warm/repeat-use cell. All 60 samples recorded the visible “Saving…” render-boundary
label and joined an exact screenshot source/frame identity to one nonforked `STATE_PRESENTED_ALL`
report before durable receipt. Event Timing observed all ten events in each cell, with none censored
below 16 ms.

| Fixture | Cache | Save-owned work p50 / p95 / max (ms) | Presented feedback p50 / p95 (ms) | Click → receipt p95 (ms) | Receipt target (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| S | Cold | 6.0 / 7.4 / 7.4 | 69.4 / 86.1 | 125.7 | 651.5 |
| S | Warm | 4.9 / 5.5 / 5.5 | 70.2 / 70.6 | 122.5 | 651.5 |
| S | Repeat-use | 5.0 / 5.4 / 5.4 | 69.8 / 87.3 | 123.4 | 651.5 |
| M | Cold | 15.6 / 17.1 / 17.1 | 66.7 / 67.5 | 535.9 | 1,056.3 |
| M | Warm | 14.8 / 16.3 / 16.3 | 66.1 / 68.3 | 534.7 | 1,056.3 |
| M | Repeat-use | 15.1 / 33.3 / 33.3 | 67.4 / 83.7 | 535.1 | 1,056.3 |

All 60 Save-owned main-thread samples are below the 50 ms hard limit; all six presented-feedback
p95 values are below 100 ms. Every click-to-receipt sample is within its per-sample N1 target derived
from actual request bytes. The target remains a target, not a promoted hard service budget. Whole
click-to-receipt RunTask union includes ambient Stage work during async waits and remains diagnostic.

Machine facts recorded battery power at 100%, with Low Power Mode off. The owner ruling accepts
automated reference-machine observation and explicitly waives the AC/battery distinction for this
slice. M was grid-7 (112 walls, 112 openings, 49 rooms), with one minimal valid retained GLB source
and derivative; source bytes are not posted in Save. This meets the slice plan's retained-model
requirement but is not the typical 60-object / 15-GLB M workload.

The approved foreground supervisor ran from `apps/editor` with
`PROJECT_LIFECYCLE_QA_PROJECT=chrome`, `PROJECT_LIFECYCLE_QA_HEADED=1`,
`PROJECT_LIFECYCLE_QA_GREP='F9 S/M Save workload'`, `PERF_RUNS=10`, `PERF_WARMUP=1`, and
`PERF_NETWORK=N1`. It used the private local database
`biskiq_t3p04s01_f9attr_20261025_81907`; the exit trap dropped it and a post-run catalog query
confirmed it absent. The supervisor confirms the Playwright child, API and preview closed. Storage
was process-local memory with no R2 access; there were no agent-browser sessions before the run.

`npm run build:api` and `npm run build` passed at the capture revision; Vite emitted only the known
nonfatal Node built-in externalization warnings. The focused Playwright harness TypeScript check
passed after the QA metadata correction. The documentation-reference architecture lane passed
2 files / 56 tests after these evidence links and acceptance text were added.

Evidence: [all samples and distributions](./f9-attribution-31c83a7c/project-lifecycle-f9-s-m-branded-chrome.json), [foreground supervisor log](./f9-attribution-31c83a7c/foreground-supervisor.log), [machine facts](./f9-attribution-31c83a7c/project-lifecycle-machine-facts.json), [API timings](./f9-attribution-31c83a7c/project-lifecycle-api-timings.json), [store manifest](./f9-attribution-31c83a7c/project-lifecycle-store-manifest.json), [supervisor cleanup record](./f9-attribution-31c83a7c/project-lifecycle-supervisor-result.json), [S warm frame](./f9-attribution-31c83a7c/project-lifecycle-f9-feedback-s-warm.jpg), and M frames ([cold](./f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-cold.jpg), [warm](./f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-warm.jpg), [repeat-use](./f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-repeat-use.jpg)).

## Prior residual API and headed Chrome run — 2026-10-25

The residual implementation and evidence were committed as `e41dffea4eb24832b4d21a3cab005c5d5893faf4`.
The strict F9 run used that exact working-tree content; its JSON records the pre-commit `HEAD` and
the resulting source-tree commit separately. The final API suite passed
114 tests with zero failures or skips on a fresh disposable PostgreSQL database. `npm run check:api`,
the editor check, editor build, focused Save-trace tests (2/2), and the focused Playwright harness
typecheck passed. The full editor/architecture/heavy gate results below are retained as the earlier
baseline; they were not rerun after the residual tests were added.

The added API cases cover several source files in one approved revision with exact source-copy
checks; migration replay and same-content sibling survival; prefix inventory enumeration of staged
objects; cleanup resumption in fresh child processes over a persistent test object store after API
shutdown; and a hostile delayed remote PUT that commits after the completion proof, is detected by
completed-record verification, and forces spaced re-proof. A lease-renewal database failure fails
closed and releases the lease. Completed-record cleanup now lists the owned prefix before removing
durable inventory, so a late object under a previously inventoried key cannot be hidden from repair.
The full test transcript is [api-residual-test.log](./api-residual-test.log).

An earlier strict headed Chrome F9-only run passed on Google Chrome `155.0.8059.85` on Mac14,2 / macOS
15.7.2. It used 1920×1080 at DPR 1, N1 networking (40 ms latency, 625 kB/s upload, 2.5 MB/s
download), one warm-up and ten measured samples for each S/M × cold/warm/repeat-use cell. All 60
samples recorded the visible “Saving…” label at the render boundary, then joined a trace screenshot
by exact source/frame identity to one nonforked `STATE_PRESENTED_ALL` report before the durable
receipt. Event Timing reported all 10 events in every cell, with none censored below 16 ms.

| Fixture | Cache | Trace-reported feedback p50 / p95 (ms) | Click-to-receipt RunTask union p50 / p95 (ms), diagnostic only | Click → durable receipt p50 / p95 (ms) | `Server-Timing` p50 / p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| S | Cold | 60.0 / 71.3 | 19.2 / 23.6 | 120.3 / 127.0 | 86.7 / 93.3 |
| S | Warm | 70.8 / 71.1 | 17.9 / 32.6 | 120.0 / 122.4 | 85.4 / 116.0 |
| S | Repeat-use | 70.3 / 71.3 | 18.0 / 33.4 | 118.2 / 122.2 | 84.1 / 89.4 |
| M | Cold | 66.9 / 68.1 | 129.1 / 155.7 | 529.1 / 627.6 | 516.4 / 616.5 |
| M | Warm | 67.6 / 69.5 | 104.2 / 126.7 | 530.1 / 551.7 | 516.6 / 542.4 |
| M | Repeat-use | 67.0 / 69.2 | 113.9 / 122.6 | 529.9 / 580.1 | 516.8 / 570.5 |

The receipt allowance derived from request bytes and N1 is 651.5 ms for S and 1,056.3 ms for M;
measured p95 values are below those amounts. The RunTask column is the full click-to-receipt window,
including ambient Stage/rendering work during WebCrypto and network waits; it is diagnostic only and
does not measure Save-owned CPU against the 50 ms hard budget. The owner accepted automated
reference-machine observation and waived the AC/battery distinction for this slice, so operator and
power state are not acceptance blockers. Storage was process-local memory; M used a minimal valid
retained GLB source and derivative, not the expected full typical-M workload. The Chrome compositor
report is browser-reported feedback and does not prove physical panel scanout.

The complete sample data and distributions are in
[project-lifecycle-final-chrome-f9-s-m.json](./project-lifecycle-final-chrome-f9-s-m.json).
The [S warm frame](./project-lifecycle-f9-feedback-s-warm-final-chrome.jpg) and
[M cold frame](./project-lifecycle-f9-feedback-m-cold-final-chrome.jpg) show the visible “Saving…”
state. The [final F9 result](./project-lifecycle-final-chrome-f9-playwright-result.json),
[machine facts](./project-lifecycle-final-chrome-machine-facts.json),
[integrated lifecycle result](./project-lifecycle-final-chrome-playwright-result.json), and
[browser/API lifecycle evidence](./project-lifecycle-final-chrome-supervisor-result.json) are stored
beside the report. Existing bounded browser semantics coverage remains; no separate manual
screen-reader/assistive-technology audit was run or added as a gate.

## Prior static F9 attribution checkpoint — superseded by the fresh run above

The table above is the earlier trace result. Its RunTask union includes ambient Stage/rendering
work during WebCrypto and network waits, so it cannot be compared with the F9 ≤50 ms Save-owned
main-thread budget. The harness now keeps that window as a diagnostic and calculates Save-owned
work from named synchronous scopes plus the renderer tasks containing the Saving and Saved status
mutations. It unions overlapping intervals once and records async hash elapsed time separately. The
request boundary is after JSON body construction and immediately before fetch dispatch.

The accompanying [static check record](./f9-attribution-static-checks.json) contains the worktree
identity and exact check commands: eight focused test files passed (73 tests), the project-model and
editor checks passed (the editor check reported zero errors and warnings), and the focused
Playwright harness TypeScript check passed. It also records the source patch hash.

At this checkpoint, the fresh numeric sample was still pending; that status is historical and is
superseded by the fresh run at the top of this record. The owner ruling does not change the numeric
F9 hard limits, and independent slice review remains pending.

## Initial revisions and full gate

The complete repository gate ran against code revision `7c7cea0dd6c1b4a3159d9c86a2e7879874a0800e`.
Two later commits changed QA-only files: `bbe4a03d0d5804d9c9de029e731768ea4d25b54f` records rAF callback execution on the same monotonic clock as the click, and `4c0e3e6dc81fe71b77e5e264aa8b86bd3f661393` widens the local QA lease window so a fixture approval does not depend on a 250 ms deadline. Neither commit changes project/API product code. The final lifecycle and corrected F9 runs both used `4c0e3e6dc81fe71b77e5e264aa8b86bd3f661393`.

The full editor command used four workers to avoid default fan-out timeouts in the CPU-heavy suite. The full-tree documentation scan has a test-specific 15-second timeout; it completed in 2.5 seconds in the passing run. The route architecture test now allows a lifecycle request controller only when it is registered with the session writer registry; project reads remain on `runBoundLoad`.

| Lane | Result |
|---|---:|
| Editor full suite | 190 files, 2,458 passed, 0 failed, 0 skipped |
| Architecture | 22 files, 178 passed, 0 failed, 0 skipped |
| Heavy | 9 files, 125 passed, 0 failed, 0 skipped |
| `npm run check` | Passed; 0 errors, 0 warnings |
| `npm run build` | Passed; Vite reported nonfatal Node-builtin externalization warnings from `@gltf-transform/core` and `draco3d` |
| Camera-core / Layout-core / project-model checks | All passed |
| API check | Passed |
| DB-backed API suite | 110 passed, 0 failed, 0 skipped |

Exact commands and statuses are in [final-gate-summary.json](./final-gate-summary.json); the raw API test log is [api-test.log](./api-test.log). The API suite used `biskiq_t3p04s01_api_final_20261025`, created only for the run and dropped by the shell trap.
After adding these evidence links, the architecture and documentation-reference lane was rerun and passed 22 files / 178 tests in 2.64 seconds.

## Initial integrated lifecycle browser run

The final one-worker Playwright run used the checked-in Vite preview, compiled local Fastify API, a private PostgreSQL database, test authentication, and a process-local in-memory ObjectStore. No production service or R2 bucket was connected. Database `biskiq_t3p04s01_lifecycle_final_20261025` was dropped after the run, and the supervisor confirms the browser, API and preview processes closed.

The Hub/Stage/API test passed. It exercised UI creation from source JSON and Save; immutable rename history and no-op/invalid names; unauthenticated and cross-owner privacy; stale and ambiguous committed rename recovery; dirty rename through Undo/Redo/Save/reopen/download; Experience Preview isolation; dirty-delete cancellation; active-publication refusal and inactive-link deletion; `project-busy` retry; pending cleanup with durable inventory and idempotent retry; a stale response after project replacement; and a 320×800 CSS coarse-touch dialog journey. The confirmed delete removed its owned asset key while an identical-content sibling asset survived. All three queued cleanup tombstones completed, with the project containing the blocked asset proving `pending → complete` and idempotent completion.

The QA server used an accelerated lifecycle policy of 5,000 ms handler timeout, 4,000 ms lease deadline, 500 ms renewal and 250 ms abort margin. Its derived cleanup spacing was 5,750 ms, not production's 187-second bound. Backend API tests exercise the lease/fence mechanics with test policy values; they do not wait through the production cleanup interval.

The collected facts and API timings are in [project-lifecycle-browser-facts.json](./project-lifecycle-browser-facts.json) and [project-lifecycle-api-timings.json](./project-lifecycle-api-timings.json). Cleanup request/results and the surviving object key inventory are in [project-lifecycle-cleanup-retry.json](./project-lifecycle-cleanup-retry.json), [project-lifecycle-cleanup-retry-result.json](./project-lifecycle-cleanup-retry-result.json), and [project-lifecycle-store-manifest.json](./project-lifecycle-store-manifest.json). Screenshots: [rename dialog](./project-lifecycle-rename-dialog.png), [dirty Head](./project-lifecycle-dirty-head.png), [Preview isolation](./project-lifecycle-preview-isolation.png), [inactive-publication warning](./project-lifecycle-inactive-publication-delete.png), [delete cancellation](./project-lifecycle-delete-confirmation.png), and [narrow coarse-touch dialog](./project-lifecycle-narrow-coarse-touch.png).

## Earlier F9 M Save measurements

The corrected F9 run used the same code revision and browser/API setup with a separate private database, `biskiq_t3p04s01_f9_final_20261025`, also dropped after the run. It performed one warm-up and ten measured rename/Save cycles for each cache state. The fixture was M grid-7 (112 walls, 112 openings, 49 rooms) with one minimal valid approved source GLB and one retained derivative; both object keys remained present through each saved revision.

| Cache | Local feedback p50 / p95 | Event Timing p50 / p95 | Click-to-receipt RunTask union p50 / p95 (diagnostic only) | Click → durable receipt p50 / p95 | Request bytes p50 / p95 | API `Server-Timing` p50 / p95 |
|---|---:|---:|---:|---:|---:|---:|
| Cold | 19.6 / 27.8 ms | 224 / 560 ms | 1,574 / 3,700 ms | 861 / 1,722 ms | 297,691 B | 566 / 825 ms |
| Warm | 17.0 / 19.5 ms | 160 / 200 ms | 1,230 / 1,592 ms | 712 / 928 ms | 297,691 B | 514 / 545 ms |
| Repeat-use | 16.5 / 20.2 ms | 152 / 288 ms | 1,193 / 1,321 ms | 672 / 731 ms | 297,697 B | 511 / 525 ms |

Each group has 10 rows; p95 is the maximum in this ten-sample set. Event Timing observed all 10 events per group, with none censored below the 16 ms observer threshold. Cold click-to-receipt p95 (1,722 ms) is above the harness's derived 1,056 ms receipt allowance; warm and repeat-use p95 are below it. These are exploratory receipt and window diagnostics, not a Save-owned CPU result or hard-budget verdict. The F9 JSON includes every sample, all distributions, source/derivative key names, browser facts, and limitations: [project-lifecycle-f9-m.json](./project-lifecycle-f9-m.json). The separate F9 API timings, store inventory and supervisor record are [project-lifecycle-f9-api-timings.json](./project-lifecycle-f9-api-timings.json), [project-lifecycle-f9-store-manifest.json](./project-lifecycle-f9-store-manifest.json), and [project-lifecycle-f9-run-summary.json](./project-lifecycle-f9-run-summary.json).

## Earlier environment and limitations

- Hardware: MacBook Air `Mac14,2`, Apple M2 (8 cores: 4 performance + 4 efficiency), 16 GB RAM; macOS 15.7.2; AC power, battery charged, Low Power Mode off. Runtime: Node 26.7.0, npm 11.19.0, PostgreSQL 14.19.
- Browser: Playwright's bundled headless Chromium 153.0.8010.12. The main route used 1440×900 CSS pixels at DPR 1 and reduced motion; a separate touch context used 320×800 CSS pixels at DPR 2. F9 used 1920×1080 at DPR 1, no-preference motion, N1 latency 40 ms / upload 625 kB/s / download 2.5 MB/s, with CPU rate 1.
- The measured M payload is small and exercises retention and repeated Save behavior; it does not stand in for a large production catalog. The local memory ObjectStore exercises API ownership, inventory, retry and sibling isolation, but does not prove remote S3/R2 cancellation or commit timing.
- `feedbackMs` is click-to-rAF-callback execution after the saving-status DOM mutation. It is a presentation opportunity proxy, not proof that pixels reached the display. The older RunTask figures are the union of renderer-main-thread `RunTask` events in the Save interval, not a Save-owned CPU metric. Event Timing's 16 ms threshold is explicit.
- The user agent reported by bundled Chromium is `Chrome/153.0.8010.12` with a `Windows NT 10.0` UA string while `navigator.platform` reports `MacIntel`; this is not a branded macOS Chrome, Safari, or cross-engine run.
- The successful Vite build emitted nonfatal externalization warnings for Node built-ins (`node:fs`, `node:path`, `fs`, `path`) referenced by `@gltf-transform/core` and `draco3d`; no build error resulted.
- Browser QA covered the bounded keyboard, dialog semantics and coarse-touch behaviors; no screen reader or dedicated assistive-technology audit was run, and no separate manual audit gate is added. The fresh attributed F9 verdict is recorded above.

## Exhaustive-case disposition after the residual follow-up

The follow-up suite now covers the previously listed multi-source approved revision, process-restart cleanup recovery, and hostile delayed remote commit after completion proof, alongside lease revocation, deadlines, migration replay/backfill, owned-prefix inventory, late-visible-key repair and spaced cleanup proof. The integrated browser run covers real UI/session behavior, bounded dialog semantics and local-store sibling isolation. Those API residuals and fresh F9 attribution evidence are complete; independent slice review remains. No separate manual assistive-technology audit gate is added. The slice remains pending acceptance.
