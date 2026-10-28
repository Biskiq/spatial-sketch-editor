# Editor performance spot check

The current editor performance command is `npm run perf:spot`. It measures two architectural
grids after a preview is already running:

| Workload | Fixture | Expectation |
| --- | --- | --- |
| M | `grid-M` (grid-7, about 112 walls) | Smooth: editor time, handler-to-presentation delay and frame intervals match the measured display period. |
| L | `grid-L` (grid-14, about 420 walls) | Usable. Modest lag, including a stable half-rate, is acceptable. Interaction has to finish and stay correct. |

M and L are not required to post the same numbers. The grids contain no imported GLBs and no
texture-heavy Scene composition. A result here does not certify those areas.

```sh
npm run build -w @portfolio/editor
npm run preview -w @portfolio/editor          # leave this running
SPOT_REQUIRE_VERIFIED=1 npm run perf:spot     # from a clean committed tree
```

`PERF_BASE_URL` overrides `http://127.0.0.1:4173`. `SPOT_BROWSER=chromium` skips branded Chrome.
The report (machine, provenance, workload digest, raw observations, timings, labels, wall time) is written
under `PERF_RESULTS_DIR` or `$TMPDIR/biskiq-spot`. Missing workloads are generated first; that
setup time is reported separately from the measurement.

`npm run perf` refuses. The former multi-hour suite is not runnable.

## What one run does

For M, then L, in one fresh unthrottled context each:

1. Open the cached project. Report admission (`f2:open-requested` → `f2:open-admitted`), editor opening through the first nonempty Stage render carrying that admitted source content ID, and its later rendering-opportunity proxy separately. Navigation, the chooser and observation overhead form the remaining automation wall time.
2. One short wall drag, a known-wall pick, one typed Length commit, a pick on the same wall after that commit, and one short pan from the canvas margin. Picks use the cached focus wall, its projected quarter-point and the actual hit identity plus the selected Index identity; a miss or another wall is a failure.
3. Frame intervals compared with the display period (`screen.refreshRate` when the browser exposes it, otherwise the idle animation-frame period).
4. Undo at L always, and at M when the commit's editor time is past 50 ms.

Each series takes four samples and stops. It extends one sample at a time, up to eight, only while
the preserved maximum sits inside the margin of a threshold (`max(1 ms, 10% of the threshold)`).
A sample clearly past either editor or presentation threshold is kept and decides the worse label. Extensions append one move within the same pressed gesture. Missing observations keep their rows and consume an attempt; the gesture never exceeds eight attempts. Editor time, presentation
delay and automation time are separate fields. The expected measurement is about 3–5 minutes for
both workloads. A run that is still ambiguous is capped at about 10 minutes.

Exit 0 means the run finished and produced labels, including `not-smooth` or `not-usable`. Exit 1
means a required measurement was missing or the preview was down. Exit 2 means the wall-time cap
stopped the run.

## Correlation, sessions and provenance

Typed timing uses the real Card writer's `command:instrument` for `layout-wall-length`, matched
by operation ID to `accepted-result`. It never reads a pointer-release `command:commit`.
The accepted source content ID must match a nonempty Stage render before the presentation proxy
is available. Raw start, acceptance, render-end and proxy timestamps stay in the JSON.
A missing or ambiguous marker is incomplete. Undo starts at its fresh product `command:undo`.

The presentation column is a conservative rAF opportunity **after** the relevant render submission,
not physical scanout. Drag uses its matching overlay update and the existing rAF proxy. Pan uses
capture-handler receipt to rAF, with Chrome TaskDuration over that move's observation window as
the editor estimate; that task window can include render and observation work. It is not an isolated
pan-handler CPU measurement. Those limitations apply to the labels as well as the numbers.

A second session is allowed only for a threshold-margin result. A third is allowed only when the
first two session labels disagree. Every session, request reason, outlier and raw ledger is saved;
the tier summary uses the worst recorded label, never only the latest result. Failed sessions keep
their error and partial ledger. There is no automatic contamination retry: this small runner cannot
attribute a long task to GC or another non-editor cause. Load average is context, not an attribution.

The preview bundles its full Git revision at build time; a dirty build gets `-dirty`. The runner
reads that identity from the loaded browser module and compares it with its clean revision. Reports
with a missing, dirty or mismatched identity say `unverified` and have no reported revision.
`SPOT_REQUIRE_VERIFIED=1` additionally refuses an unmatched preview or dirty runner before sampling.
Commit the measurement implementation, build, and start a fresh preview before the evidence run.

PR #213 remains an open design-review record. Its draft's twelve-sample range rule, contamination
retry and harness-preservation adoption paragraph are superseded by the
[spot-check decision](../../../docs/reference/decisions/performance-spot-check-2026-10-28.md).
They are not active instructions and must not be merged over this implementation.

## What remains in this directory

| Kept | Role |
| --- | --- |
| `spot.ts`, `lib/spot-decision.ts` | The spot check and its decision rules |
| `flows/*.spec.ts` still listed in `playwright.config.ts` | Functional browser acceptance and focused trace-library checks. They are not the spot check. |
| `lib/flow.ts`, `lib/browser.ts`, `lib/ledger.ts`, `lib/fixtures.ts` | Shared product driving and perf-mark observation |
| `lib/trace-*.ts`, `lib/save-trace.ts` | Diagnostics the project-lifecycle acceptance still uses |
| `generate-workloads.ts`, `lib/workloads/grid.ts` | `grid-M` and `grid-L` only |
| `bundle-report.mjs` | Route payload report (`npm run perf:bundle`) |
| `regressions/` | Persistent-structure comparisons, not a timed suite |

## Removed

S and XL grids, museum and sweep workloads, the 1k/3k/10k and 100,000-entity stress censuses,
60-input drags, 600-frame orbits, 10-run acceptance profiles, cold/warm/repeat-use matrices,
F13 leak-cycle benchmark loops, the E5 sweep, cool-down and CPU-throttle search, screenshot and
trace collection as a requirement of the performance run, and the `perf:bench`, `perf:census` and
`perf:scale` commands.

Historical results of those runs stay in the
[S06 acceptance record](../../../docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md)
and the [performance contract](../../../docs/reference/components/performance.md). Deleting the
runner does not change those results, and it does not turn an unmeasured row into a pass.

Policy: [spot-check decision](../../../docs/reference/decisions/performance-spot-check-2026-10-28.md).
The comprehensive mandate remains suspended.
