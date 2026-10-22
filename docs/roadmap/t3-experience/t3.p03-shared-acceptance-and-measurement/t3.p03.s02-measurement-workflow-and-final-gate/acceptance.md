# T3.P03.S02 — acceptance record: Measurement workflow and final gate

**Slice:** T3.P03.S02 · **Status:** implemented and verified on `t3/p03-s02-measurement-final-gate`;
independent review and the owner-operated hard-row pass are **pending** — no hard product budget is
accepted here · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T3.P03](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T3.P03

```text
VERIFICATION: exhaustive   (declared by the plan; this record is the phase's final gate and S01's
                            declared integration route)
BASE:         55683981       merge of PR #176 (T3.P03.S01 via main) on t3/p03-s02-measurement-final-gate
STATUS:       implemented; repository gate green; all nine Chrome flows green in one clean
              sequence on this tree, with cold plus warm/repeat-use for every flow row;
              hard rows owner-run pending; not reviewed; not accepted
```

No product feature, source encoding or accepted capability changes. The one exported-shape addition
is the runtime-gated mark helper; it is inert unless a harness sets its flag before application code
evaluates, so the measured bundle is the ordinary production bundle. Its installation path now
checks the flag before building the sequence-carrying detail object, and a throwing-getter regression
proves that the ordinary build neither evaluates that detail nor calls `performance.now`/`mark`.

## Delivered

- **Harness.** `@playwright/test` 1.63.0 (exact) as an editor devDependency with its own config in
  `apps/editor/perf/`; explicit `perf` and `perf:bundle` scripts at editor and root. The default
  Vitest lanes never collect it (`vitest.shared.ts` includes only `tests/**`), and root `test`,
  `check` and `build` never call it. Fresh context per run; Playwright's browser cache supplies
  Chromium and branded Chrome.
- **Correlation.** `src/lib/platform/perf-marks.ts` assigns a monotonic sequence at each pointer
  move; the Layout adapter records preview installation, the route records an `overlay:updated` mark
  only when the painted marker set changes, and the acceptance host records the accepted result. The
  harness pairs each input with the first rendering-opportunity frame after its own mark, keeping
  `presented` / `superseded` / `refused` / `unresolved` for every input. Command, admission, Save and
  Stage-activation marks cover F1, F2, F4, F8 and F9.
- **Flows.** F1 startup (cold/warm), F2 open (S and M, cold/warm), F7 orbit (cold/warm), F9 Save
  through the local test-auth seam (cold/warm), F13 ten-cycle repeat use (cold/repeat-use), and the
  F3/F4/F8 methodology on the shipped Wall drag, precision commit and Undo/Redo (cold/warm),
  including the delayed-preview proof. Every flow row now has the contract's cold state plus its
  repeated state; the delayed-preview proof remains a warm-only diagnostic, not a flow row.
- **Calibration.** `perf/calibration/entry.ts` bundles the grid-7 compile plus Stage admission with
  the production config (esbuild, minified, `NODE_ENV=production`); the spec runs it 20×, searches
  CDP rates 1.5–4 when `PERF_REFERENCE_CALIBRATION_MS` is supplied, and reports no calibrated
  equivalence rather than extrapolating.
- **Bundle report.** `perf/bundle-report.mjs` reproduces per-route first-load sets with raw/gzip/br
  bytes and source-module attribution, and exits non-zero on a `--forbid` hit in a route's set.
- **Regression.** `tests/lib/platform/perf-marks.test.ts` proves the helper is inert by default
  (including a throwing detail getter and clock/mark spies), carries the sequence, emits user-timing
  marks and bounds the ledger.

## Verification on this tree

All commands ran from the repository root unless stated. `npm test` used the default full lane.

```text
npm run check                 PASS   svelte-check 0 errors, 0 warnings
npm test                      PASS   172 files / 2,243 tests
npm run test:arch             PASS   21 files / 172 tests
npm run test:heavy            PASS   8 files / 118 tests
npm run build                 PASS   ordinary production build; both surface-boundary plugins ran
npm run check:api             PASS   tsc --noEmit
npm run test:api              PASS   DATABASE_URL=...biskiq_t3p03s02_gate: 80 tests, 0 failures,
                                     0 skips across 11 suites
S01 recheck (focused)         PASS   6 files / 88 tests: preview-surface-closure, f4-acceptance,
                                     f4-unit-acceptance, unit-acceptance-conformance and both
                                     boundary-plugin tests
static surface gates          PASS   verify-public-surface (2 public files), verify-preview-surface
                                     (12 visitor files), both exit 0
```

The Vitest, arch, heavy, API, check and build gates were rerun after this pass's harness edits. The
S01 focused recheck and the static surface gates were recorded on this branch before those edits;
they touch no file changed here and remain green (same branch, unchanged paths).

**Clean harness sequence (final code).** Built with `node perf/serve.mjs` (production `vite build`
plus `vite preview` on `127.0.0.1:4173`), then, from `apps/editor`:

```sh
PERF_BASE_URL=http://127.0.0.1:4173 PERF_RESULTS_DIR=/tmp/t3p03s02-final-results \
PERF_POWER_STATE="pre-flight, battery 13% discharging, Low Power Mode off" \
PERF_API_ORIGIN=http://127.0.0.1:8792 E2E_TEST_AUTH_SECRET="$LOCAL_STACK_SECRET" \
  npx playwright test --config perf/playwright.config.ts --project=chrome
```

Result: **9 passed in 18.8 m**, one fresh preview server built from this tree, default counts
(`PERF_WARMUP=1`, `PERF_RUNS=10`, `PERF_SAMPLES=60`), F9 against the throwaway local Postgres
database and the API's test-auth seam on `127.0.0.1:8792` (never production). The preview was built
with `PUBLIC_API_ORIGIN=http://127.0.0.1:8792` so the shipped Save transport reaches that local API.
All rows below are from this one sequence; no earlier number is carried forward.

`PERF_BASE_URL` made the config reuse the already-running preview instead of building a second one.
The run records `browserVersion`, `chromeVersion`, platform and `powerState` with every row.
Chromium (Playwright's managed build) was exercised on the previous tree; it was not rerun here, so
this record does not claim a Chromium result for these exact sources.

## Measured pre-flight rows (no budget accepted)

Machine: Apple M2, 16 GB, macOS 15.7.2, **on battery at 13 %, discharging**, Low Power Mode off;
Chrome 153.0.8010.12; 1920×1080 CSS at DPR 1; N1 (40 ms RTT, 2.5 Mbit/s down, 625 kbit/s up); CPU
rate 1×. Values are the single clean sequence above. Percentiles with ten milestone samples are
coarse (often near the maximum).

| Row | Observed |
| --- | --- |
| F1 startup, stage first frame cold / warm (median, p95) | 1,248.95 / 1,368.63 ms; 891.5 / 892.1 ms |
| F1 FCP / LCP cold; long tasks; script bytes | 112 / 424 ms; 0; 468,020 B; warm FCP/LCP 68 / 132 ms, script bytes 0 (cache hits) |
| F2 open S cold / warm (total median, p95) | 49.55 / 89.86 ms; 57.6 / 58.99 ms |
| F2 open M cold / warm (total median, p95) | 482.45 / 489.18 ms; 490.25 / 492.1 ms |
| F3 input→matching preview (n=600; median, p95, max) | cold 31.2 / 32.6 / 33.2 ms; warm 31.2 / 32.61 / 33.3 ms |
| F3 status rows | cold and warm: dispatched 600, rows 600, presented 600, superseded 0, unresolved 0, refused 0; latest-input age median 31.2 ms |
| F4 precision completion (n=10; median, p95) | cold 27.3 / 48.52 ms; warm 29.55 / 59.04 ms |
| F4 commit completion (n=10; median, p95) | cold 53.65 / 55.17 ms; warm 53.05 / 55.63 ms |
| F8 Undo / Redo completion (n=200 each; median, p95) | cold undo 29.2 / 30.3 ms, redo 29.2 / 30.3 ms; warm undo 29.2 / 30.4 ms, redo 29.2 / 30.7 ms |
| F3 delayed-preview proof | 180 dispatched / 180 rows / 0 missed; 14 presented, 166 superseded; delayed p95 197.84 ms, max 197.9 ms vs baseline p95 32.8 ms, max 33.3 ms |
| F7 orbit M (frames; interval median, p95, p99; dropped >33.4 ms; long tasks) | cold 6,031 total / 603–604 per run; 33.3 / 33.4 / 33.4 ms; 949; 0. warm 6,030 / 603 per run; 33.3 / 33.4 / 33.4 ms; 916; 0 |
| F9 Save (n=10; local feedback p95; durable receipt p95; saved label p95) | cold 0.81 ms; 1,531.07 ms; 106.86 ms; warm 0.91 ms; 761.62 ms; 109.56 ms; wire bytes 29,594 |
| F13 ten cycles (heap baseline → final; growth) | cold 1.49 → 4.70 MiB; +3.21 MiB; repeat-use 1.47 → 4.62 MiB; +3.15 MiB; later cycles flat in both |
| Calibration grid-7, 20 runs (total median, p95; compile / admission median) | 77.7 / 82.42 ms; 33.4 / 44.0 ms |

**F7 frame floor and duration.** Chrome presented rAF at **30 Hz (33.3 ms) throughout this pass** on
this battery/thermal state. Ten seconds therefore yields about 300 frames — below the contract's
600-frame floor — so each measured run continued the same paced orbit until it reached at least 600
frames. Every run cleared the floor (603–604 frames) and took **20.14 s**, not 10 s; the row's
`durationMs` records that actual duration rather than labelling a shorter run "10 s". The 10 s
scripted base is unchanged, and the extension is disclosed rather than presenting 300 frames as if
they met the floor. Because the frame clock is 30 Hz, the 16.7/33 ms frame-time budget is not
interpreted as a pass here; this remains a pre-flight observation on an environment that is not the
owner-operated reference pass.

**Bundle report (production build, cold first-load JS, brotli):** `/` 212.0 KiB, `/editor` 211.2,
`/projects` 214.8, `/project/[projectId]/spatial` 376.6, `/p/[publicationId]` 300.6. A `--forbid` for
`preview` on the Stage route exits 0; an authoring module on the visitor route also exits 0.

**Bundle assertions.** `--forbid '/p/[publicationId]=src/lib/authoring/'` exits 0 (no hit) on both an
ordinary and a sourcemap build. On the sourcemap build, `--forbid '/p/[publicationId]=src/lib/visitor/'`
exits 1 and lists the four visitor modules actually in that set, and
`--forbid '/project/[projectId]/spatial=authoring'` exits 1 — the check refuses a present module
rather than passing vacuously. The ordinary build was restored with `npm run build` after the
sourcemap pass.

## Hard rows — OWNER-RUN, NOT CLAIMED

The plan's acceptance forbids claiming a product budget from this pass, and the E6 amendment
requires the owner-operated reference run. The host is the designated model (Apple M2, 16 GB, on
battery, Low Power Mode off), but the reference event is owner-operated; this agent-driven pre-flight
is not it. **No hard row has a disposition in this record.**

| Hard row | Owner-run command |
| --- | --- |
| F1 stage first interactive frame cold ≤ 3.0 s; F2 S ≤ 300 ms, M ≤ 800 ms; F3 S preview p95 ≤ 33 ms and frame p95/p99; F4 commit p95 ≤ 100 ms; F7 S/M frame p95/p99 ≤ 16.7/33 ms; F8 p95 ≤ 100 ms; F9 main-thread and local feedback p95 ≤ 100 ms; F13 growth ≤ 5 MiB; Stage first-load JS br ≤ 400 KiB; warm repeat ≈ 0 transferred | `cd apps/editor` then `npx playwright test --config perf/playwright.config.ts --project=chrome` (F9 needs the local API stack and `PERF_API_ORIGIN` / `E2E_TEST_AUTH_SECRET` / `PUBLIC_API_ORIGIN` exactly as `perf/README.md` describes; without them the spec skips and says so) |
| Calibration page median on the reference machine | `cd apps/editor` then `npx playwright test --config perf/playwright.config.ts --project=chrome flows/calibration.spec.ts`; record the 20-run `totalMedian` as `PERF_REFERENCE_CALIBRATION_MS` for other machines |

Pre-flight observations suggest the S hard rows for F3 preview (p95 32.6–32.61 ms), F4 commit (p95
55.17–55.63 ms), F8 (p95 30.3–30.7 ms), F9 local feedback (p95 0.81–0.91 ms), F2 S (p95 58.99–89.86
ms), F1 (1.25 s) and F13 (3.21 MiB) are close to or inside their budgets on this build. F7 ran on a
30 Hz presented frame clock, so its frame-time row is an environment observation, not a budget
claim. None of that is a disposition; the owner's run decides.

**Unrun rows.** Draw calls, triangles, GPU time and GPU memory (no renderer probe on the shipped
Stage); traced-image presentation (the harness attributes the rendering-opportunity frame); INP from
Event Timing is collected but reported only as a page-level observation; L-workload and Safari/
Firefox rows; viewer flows F11/F12 and Preview F10 belong to their consuming slices.

## Iterations a reviewer should know

- Both drag tests exceeded Playwright's 240 s default at the declared sample counts (the measured
  work is 11 runs × 60 samples × 20 Undo/Redo pairs per cache state, plus four delayed runs). The
  describe now sets 1,800 s; nothing is retried or skipped. F13 and F7 have their own 1,800 s and
  3,000 s budgets because their declared runs are longer than the default.
- The delayed-preview proof first asserted `delayed.max > baseline.median + 150 ms`, a tuned
  absolute constant. Chrome's first full pass measured 164.49999 ms against 164.5 and failed on
  floating point; the synchronous overlay refresh at the accepted commit also lets the final sample
  present before the delayed rAF callback, so an absolute threshold encoded machine speed rather than
  the property. The proof now asserts every input keeps a row, `delayed p95 > baseline p95`,
  `delayed max > 2 × baseline max`, and superseded > 0; the mechanism and its lower-bound caveat are
  recorded in the row's limitations. This pass measured delayed p95 197.84 ms / max 197.9 ms against
  baseline p95 32.8 ms / max 33.3 ms.
- F7 was originally paced by a fixed per-step delay (`floor(10000/60) - 60` ms), which finished the
  60-step orbit in about 6.4 s and, with browser overhead, 7–8 s. It now paces to an absolute
  10 s deadline. On this pass Chrome presented at 30 Hz, so 10 s still produced only ~300 frames;
  each run continues the same orbit until the contract's 600-frame floor is met, and the row records
  the resulting 20.14 s duration. The duration is never relabelled as 10 s.
- The calibration row no longer claims "this machine is the reference machine"; it states that hard
  rows are accepted only from the owner-operated pass.
- A formatting accident in the spatial route (a brace and comment merged onto one line) was repaired;
  no temporary probe, debug flag or `sed`-edited source remains. `DRAG_DISTANCE = 6` is documented as
  a short extension along the Wall that keeps every candidate valid and collision-free.

## Entry points

```text
harness         apps/editor/perf/playwright.config.ts · perf/serve.mjs · perf/lib/*
flows           apps/editor/perf/flows/{startup,project-open,orbit,save,cycles,drag-correlation,calibration}.spec.ts
calibration     apps/editor/perf/calibration/entry.ts
bundle report   apps/editor/perf/bundle-report.mjs
marks           apps/editor/src/lib/platform/perf-marks.ts
call sites      src/routes/project/[projectId]/spatial/+page.svelte
                src/lib/authoring/adapters/layout.adapter.ts
                src/lib/authoring/adapters/layout/instrument.ts
                src/lib/authoring/stage/host-acceptance.ts
                src/lib/authoring/save/head-save.ts
regression      apps/editor/tests/lib/platform/perf-marks.test.ts
contracts       docs/reference/components/performance.md · apps/editor/tests/README.md
```

## Residuals

```text
review          independent implementation review of this branch is not recorded
hard rows       owner-operated reference pass pending (E6); no budget accepted here
calibration     reference median not recorded; other machines cannot claim equivalence yet
GPU             draw calls, triangles, GPU time/memory and traced-image presentation unrun
workloads       L and XL, Safari, Firefox, viewer F11/F12, Preview F10 unrun
save            durable receipt is a local-stack target observation, not a production service baseline
```

## Self-check

```text
acceptance    PASS — every claim cites a command result above; no hard row claims a disposition
tier          PASS — exhaustive final gate recorded; S01 integration rechecked on this branch (unchanged by this pass)
scope         PASS — harness, scripts, devDependency, marks and regression only; no product feature
isolation     PASS — perf/ is outside every Vitest lane and no root gate calls it
cache         PASS — every flow row has cold plus warm/repeat-use; delayed proof is a warm diagnostic
correlation   PASS — delayed preview shows latency with no dropped sample
bundle        PASS — route sets reproduced; a present module is refused, an absent one passes
hygiene       PASS — no probe, debug flag, tuned absolute threshold or formatting residue left
owner-run     PENDING — hard baseline and calibration rows await the owner's reference run
review        PENDING — no independent verdict on this revision; status is not `reviewed`
```
