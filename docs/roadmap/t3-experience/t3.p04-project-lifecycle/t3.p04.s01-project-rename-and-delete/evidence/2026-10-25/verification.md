# T3.P04.S01 integrated verification — 2026-10-25

**Disposition:** verification recorded; slice acceptance remains pending. See the [acceptance record](../../acceptance.md).

## Revisions and full gate

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

## Lifecycle browser run

The final one-worker Playwright run used the checked-in Vite preview, compiled local Fastify API, a private PostgreSQL database, test authentication, and a process-local in-memory ObjectStore. No production service or R2 bucket was connected. Database `biskiq_t3p04s01_lifecycle_final_20261025` was dropped after the run, and the supervisor confirms the browser, API and preview processes closed.

The Hub/Stage/API test passed. It exercised UI creation from source JSON and Save; immutable rename history and no-op/invalid names; unauthenticated and cross-owner privacy; stale and ambiguous committed rename recovery; dirty rename through Undo/Redo/Save/reopen/download; Experience Preview isolation; dirty-delete cancellation; active-publication refusal and inactive-link deletion; `project-busy` retry; pending cleanup with durable inventory and idempotent retry; a stale response after project replacement; and a 320×800 CSS coarse-touch dialog journey. The confirmed delete removed its owned asset key while an identical-content sibling asset survived. All three queued cleanup tombstones completed, with the project containing the blocked asset proving `pending → complete` and idempotent completion.

The QA server used an accelerated lifecycle policy of 5,000 ms handler timeout, 4,000 ms lease deadline, 500 ms renewal and 250 ms abort margin. Its derived cleanup spacing was 5,750 ms, not production's 187-second bound. Backend API tests exercise the lease/fence mechanics with test policy values; they do not wait through the production cleanup interval.

The collected facts and API timings are in [project-lifecycle-browser-facts.json](./project-lifecycle-browser-facts.json) and [project-lifecycle-api-timings.json](./project-lifecycle-api-timings.json). Cleanup request/results and the surviving object key inventory are in [project-lifecycle-cleanup-retry.json](./project-lifecycle-cleanup-retry.json), [project-lifecycle-cleanup-retry-result.json](./project-lifecycle-cleanup-retry-result.json), and [project-lifecycle-store-manifest.json](./project-lifecycle-store-manifest.json). Screenshots: [rename dialog](./project-lifecycle-rename-dialog.png), [dirty Head](./project-lifecycle-dirty-head.png), [Preview isolation](./project-lifecycle-preview-isolation.png), [inactive-publication warning](./project-lifecycle-inactive-publication-delete.png), [delete cancellation](./project-lifecycle-delete-confirmation.png), and [narrow coarse-touch dialog](./project-lifecycle-narrow-coarse-touch.png).

## F9 M Save measurements

The corrected F9 run used the same code revision and browser/API setup with a separate private database, `biskiq_t3p04s01_f9_final_20261025`, also dropped after the run. It performed one warm-up and ten measured rename/Save cycles for each cache state. The fixture was M grid-7 (112 walls, 112 openings, 49 rooms) with one minimal valid approved source GLB and one retained derivative; both object keys remained present through each saved revision.

| Cache | Local feedback p50 / p95 | Event Timing p50 / p95 | Main-thread RunTask sum p50 / p95 | Click → durable receipt p50 / p95 | Request bytes p50 / p95 | API `Server-Timing` p50 / p95 |
|---|---:|---:|---:|---:|---:|---:|
| Cold | 19.6 / 27.8 ms | 224 / 560 ms | 1,574 / 3,700 ms | 861 / 1,722 ms | 297,691 B | 566 / 825 ms |
| Warm | 17.0 / 19.5 ms | 160 / 200 ms | 1,230 / 1,592 ms | 712 / 928 ms | 297,691 B | 514 / 545 ms |
| Repeat-use | 16.5 / 20.2 ms | 152 / 288 ms | 1,193 / 1,321 ms | 672 / 731 ms | 297,697 B | 511 / 525 ms |

Each group has 10 rows; p95 is the maximum in this ten-sample set. Event Timing observed all 10 events per group, with none censored below the 16 ms observer threshold. Cold click-to-receipt p95 (1,722 ms) is above the harness's derived 1,056 ms receipt allowance; warm and repeat-use p95 are below it. This is an exploratory finding, not a hard-budget verdict: the operator was the agent, storage was in memory, and the retained GLB is not the expected full 15 MiB catalog. The F9 JSON includes every sample, all distributions, source/derivative key names, browser facts, and limitations: [project-lifecycle-f9-m.json](./project-lifecycle-f9-m.json). The separate F9 API timings, store inventory and supervisor record are [project-lifecycle-f9-api-timings.json](./project-lifecycle-f9-api-timings.json), [project-lifecycle-f9-store-manifest.json](./project-lifecycle-f9-store-manifest.json), and [project-lifecycle-f9-run-summary.json](./project-lifecycle-f9-run-summary.json).

## Environment and limits

- Hardware: MacBook Air `Mac14,2`, Apple M2 (8 cores: 4 performance + 4 efficiency), 16 GB RAM; macOS 15.7.2; AC power, battery charged, Low Power Mode off. Runtime: Node 26.7.0, npm 11.19.0, PostgreSQL 14.19.
- Browser: Playwright's bundled headless Chromium 153.0.8010.12. The main route used 1440×900 CSS pixels at DPR 1 and reduced motion; a separate touch context used 320×800 CSS pixels at DPR 2. F9 used 1920×1080 at DPR 1, no-preference motion, N1 latency 40 ms / upload 625 kB/s / download 2.5 MB/s, with CPU rate 1.
- The measured M payload is small and exercises retention and repeated Save behavior; it does not stand in for a large production catalog. The local memory ObjectStore exercises API ownership, inventory, retry and sibling isolation, but does not prove remote S3/R2 cancellation or commit timing.
- `feedbackMs` is click-to-rAF-callback execution after the saving-status DOM mutation. It is a presentation opportunity proxy, not proof that pixels reached the display. RunTask is the sum of renderer-main-thread `RunTask` events in the Save interval, not one contiguous task. Event Timing's 16 ms threshold is explicit.
- The user agent reported by bundled Chromium is `Chrome/153.0.8010.12` with a `Windows NT 10.0` UA string while `navigator.platform` reports `MacIntel`; this is not a branded macOS Chrome, Safari, or cross-engine run.
- The successful Vite build emitted nonfatal externalization warnings for Node built-ins (`node:fs`, `node:path`, `fs`, `path`) referenced by `@gltf-transform/core` and `draco3d`; no build error resulted.
- Browser QA covered keyboard focus/escape and coarse-touch targets, but no screen reader or dedicated assistive-technology audit was run. F9 hard rows need the owner-operated reference procedure; the agent-operated M2 results do not satisfy that gate.

## Remaining exhaustive cases

The DB-backed API suite covers lease revocation for asset upload, staged model upload and approval; deadline aborts; same-content approval serialization; migration replay/source-key backfill; `sweep-dependent` reporting; delete inventory; late-visible-key repair; and spaced cleanup proof. The integrated browser run adds real UI/session behavior and local-store sibling isolation. Remaining plan cases are several source files in one approved revision, process-restart cleanup recovery, and a held/hostile remote object write that commits after the completion proof. The dedicated assistive-technology/browser review and owner-run F9 hard rows are also outstanding. These omissions keep the slice pending acceptance.
