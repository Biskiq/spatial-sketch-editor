# T3.P03.S02 — acceptance record: Measurement workflow and final gate

**Slice:** T3.P03.S02 · **Status:** implemented and verified on `t3/p03-s02-measurement-final-gate`;
acceptance criteria 1–5 are met on this tree; the plan's trace-correlation method is **not
implemented** and is an explicit
[deviation decision](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md)
awaiting the owner; independent review and the owner-operated hard-row pass are **pending** — no hard
product budget is accepted here · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns
the criteria) · **Phase:** [T3.P03](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T3.P03

```text
VERIFICATION: exhaustive   (declared by the plan; this record is the phase's final gate and S01's
                            declared integration route)
BASE:         55683981       merge of PR #176 (T3.P03.S01 via main) on t3/p03-s02-measurement-final-gate
STATUS:       implemented; repository gate green; all nine Chrome flows green in one clean
              sequence on this tree at default counts, with cold, warm and repeat-use for
              every flow row; trace correlation is a documented deviation awaiting the owner;
              first-interactive rows are labelled as the rAF proxy they are; unrun rows are
              inventoried below; hard rows owner-run pending; not reviewed; not accepted
```

The trace deviation is recorded at
[t3p03s02-trace-correlation-deviation-2026-10-22.md](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
It is not ratified by this record, and this record does not treat the rAF attribution as the plan's
traced-frame proof.

No product feature, source encoding or accepted capability changes. The one exported-shape addition
is the runtime-gated mark helper; it is inert unless a harness sets its flag before application code
evaluates, so the measured bundle is the ordinary production bundle. Its installation path now
checks the flag before building the sequence-carrying detail object, and a throwing-getter regression
proves that the ordinary build neither evaluates that detail nor calls `performance.now`/`mark`.

### Does this slice satisfy the plan now?

**Yes for acceptance criteria 1–5; not for the plan's scope-2 trace method.** By criterion:

| Criterion | Posture |
| --- | --- |
| 1. Cold, warm and repeat-use runs with declared statistics; delayed-preview correlation proof | **Met as written.** Every flow row ran cold, warm and repeat-use at the declared counts (10 runs, 60 samples): F1, F2 (S and M), F3/F4/F8, F7, F9 and F13. The delayed-preview proof passes (180/180 delayed inputs kept rows, delayed p95 95.84 ms / max 115.6 ms against baseline p95 16.5 ms / max 16.6 ms). This does **not** satisfy scope 2's "presented frame in the trace": no trace is recorded, and the rAF attribution remains the owner's deviation decision. |
| 2. Bundle report reproduces route sets and refuses an injected module | **Met** on the current build; the `--forbid` checks exit 0/1 as intended. |
| 3. Baseline record names every unrun reference/GPU row | **Met as an inventory**; the rows themselves remain unrun and no value is claimed for them. |
| 4. S01 integrated result rechecked | **Met** on this tree: 6 files / 88 tests and both static gates rerun. |
| 5. Complete repository gate | **Met** on this tree: check, test, arch, heavy, build, check:api and DB-backed test:api all pass. |

What still gates the slice: the owner's trace-deviation decision (or a tracing slice), the
owner-operated hard-row/calibration pass, and independent review. The cache-coverage gap that
previous revisions carried is closed: no flow row is missing a warm or repeat-use state, and F13's
warm row measures a cycle after a discarded one rather than a disguised cold load.

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
- **Flows.** F1 startup, F2 open (S and M), F7 orbit, F9 Save through the local test-auth seam, F13
  repeated open/close, and the F3/F4/F8 methodology on the shipped Wall drag, precision commit and
  Undo/Redo — each in **cold, warm and repeat-use**. Cold clears cache and cookies before every
  measured run; warm and repeat-use never clear. For the navigation/drag flows a repeat-use run
  closes back to the hub and opens a fresh project, so the cycle boundary is real. F13's repeat-use
  row is the contract's ten-cycle state; its warm row measures one cycle after a discarded cycle has
  warmed the Stage, so it is not a disguised cold load. The delayed-preview proof remains a warm-only
  diagnostic, not a flow row.
- **Calibration.** `perf/calibration/entry.ts` bundles the grid-7 compile plus Stage admission with
  the production config (esbuild, minified, `NODE_ENV=production`); the spec runs it 20×, searches
  CDP rates 1.5–4 when `PERF_REFERENCE_CALIBRATION_MS` is supplied, and reports no calibrated
  equivalence rather than extrapolating.
- **Bundle report.** `perf/bundle-report.mjs` reproduces per-route first-load sets with raw/gzip/br
  bytes and source-module attribution, and exits non-zero on a `--forbid` hit in a route's set.
- **Regression.** `tests/lib/platform/perf-marks.test.ts` proves the helper is inert by default
  (including a throwing detail getter and clock/mark spies), carries the sequence, emits user-timing
  marks and bounds the ledger.

## Trace correlation — explicit deviation, not a silent approximation

The plan requires correlation with **the presented frame in the trace**, and the contract says a lone
rAF callback is not proof of presentation. This harness does **not** do that: `trace: 'off'` in
[playwright.config.ts](../../../../../apps/editor/perf/playwright.config.ts) and the ledger pairs an
`overlay:updated` mark with the first rAF tick after it. No trace artifact, screenshot or frame image
is correlated with any mark.

The delayed-preview proof still does what criterion 1 asks of it — every dispatched input keeps a
row and the injected delay appears as latency, not a dropped sample — but it does not prove which
pixels were presented. Building a time-only mark-to-trace-frame mapping here would create a second
approximation and then call it the plan's trace proof; proving the *matching* preview needs a visual
identity that survives into the frame, which the shipped UI does not have. The tradeoff, options and
owner command are recorded in
[the deviation decision](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
Until the owner accepts Option A or authorizes Option B/C, the plan's trace method is **unmet**, and
no hard presentation row is accepted from this harness.

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
                                     boundary-plugin tests (rerun after the harness edits)
static surface gates          PASS   verify-public-surface (2 public files), verify-preview-surface
                                     (12 visitor files), both exit 0 (rerun after the harness edits)
```

All gates above were rerun after this pass's harness edits.

**Clean harness sequence (final code).** Built with `node perf/serve.mjs` (production `vite build`
plus `vite preview` on `127.0.0.1:4173`), then, from `apps/editor`:

```sh
PERF_BASE_URL=http://127.0.0.1:4173 PERF_RESULTS_DIR=/tmp/t3p03s02-final-matrix \
PERF_POWER_STATE="AC power, battery 15% charging, Low Power Mode off" \
PERF_API_ORIGIN=http://127.0.0.1:8792 E2E_TEST_AUTH_SECRET="$LOCAL_STACK_SECRET" \
  npx playwright test --config perf/playwright.config.ts --project=chrome
```

Result: **9 passed in 18.1 m**, one fresh preview server built from this tree, default counts
(`PERF_WARMUP=1`, `PERF_RUNS=10`, `PERF_SAMPLES=60`), F9 against the throwaway local Postgres
database `biskiq_t3p03s02_gate` and the API's test-auth seam on `127.0.0.1:8792` (never
production). The preview was built with `PUBLIC_API_ORIGIN=http://127.0.0.1:8792` so the shipped
Save transport reaches that local API. All rows below are from this one sequence; no earlier number
is carried forward. A reduced-count smoke pass (`PERF_RUNS=2`, `PERF_SAMPLES=5`) preceded it and is
not cited here except as evidence that each new state executes.

`PERF_BASE_URL` made the config reuse the already-running preview instead of building a second one.
The run records `browserVersion`, `chromeVersion`, platform and `powerState` with every row.
Chromium (Playwright's managed build) was exercised on the previous tree; it was not rerun here, so
this record does not claim a Chromium result for these exact sources.

## Measured pre-flight rows (no budget accepted)

Machine: Apple M2, 16 GB, macOS 15.7.2, **on AC power with the battery at 15 % and charging**, Low
Power Mode off; Chrome 153.0.8010.12; 1920×1080 CSS at DPR 1; N1 (40 ms RTT, 2.5 Mbit/s down,
625 kbit/s up); CPU rate 1×. Values are the single clean sequence above. Percentiles with ten
milestone samples are coarse (often near the maximum).

| Row | Observed |
| --- | --- |
| F1 startup, stage **first architectural frame** cold / warm / repeat-use (rAF proxy; not first-interactive; median, p95) | 1,142.6 / 775.3 / 783.7 ms; 1,242.66 / 783.45 / 789.07 ms |
| F1 FCP / LCP cold; long tasks; script bytes | 112 / 380 ms; 0; 468,014 B; warm 60 / 112 ms and repeat-use 62 / 110 ms, script bytes 0 (cache hits) |
| F2 open S cold / warm / repeat-use (total median, p95) | 83.0 / 27.2 / 26.5 ms; 85.66 / 76.0 / 27.2 ms |
| F2 open M cold / warm / repeat-use (total median, p95) | 459.35 / 460.1 / 459.2 ms; 488.54 / 494.45 / 476.11 ms |
| F3 input→matching preview (n=600; median, p95, max) | cold 15.5 / 16.3 / 16.6 ms; warm 15.5 / 16.01 / 16.6 ms; repeat-use 15.85 / 16.5 / 16.6 ms |
| F3 status rows | every state: dispatched 600, rows 600, presented 600, superseded 0, unresolved 0, refused 0; latest-input age median 15.5–15.85 ms |
| F4 precision completion (n=10; median, p95) | cold 26.85 / 27.61 ms; warm 27.35 / 36.23 ms; repeat-use 27.15 / 33.5 ms |
| F4 commit completion (n=10; median, p95) | cold 25.3 / 26.49 ms; warm 25.0 / 25.67 ms; repeat-use 25.0 / 48.91 ms |
| F8 Undo / Redo completion (n=200 each; median, p95) | cold undo 29.9 / 30.6 ms, redo 29.9 / 30.51 ms; warm undo 30.2 / 30.6 ms, redo 30.1 / 30.6 ms; repeat-use undo 30.4 / 31.3 ms, redo 14.7 / 31.0 ms |
| F3 delayed-preview proof | 180 dispatched / 180 rows / 0 missed; 9 presented, 171 superseded; delayed p95 95.84 ms, max 115.6 ms vs baseline p95 16.5 ms, max 16.6 ms |
| F7 orbit M (frames; interval median, p95, p99; dropped >33.4 ms; long tasks) | cold 6,030 total / 603 per run; 16.7 / 16.7 / 16.8 ms; 0; 0. warm 6,030 / 603 per run; 16.7 / 16.7 / 16.8 ms; 0; 0. repeat-use 6,031 / 603 per run; 16.7 / 16.7 / 16.8 ms; 0; 0 |
| F9 Save (n=10; local feedback p95; durable receipt p95; saved label p95) | cold 0.70 ms; 1,378.45 ms; 101.86 ms; warm 1.10 ms; 605.67 ms; 101.09 ms; repeat-use 0.87 ms; 610.90 ms; 100.47 ms; wire bytes 29,594 in every state |
| F13 heap (baseline → final; growth) | cold 1.49 → 4.62 MiB, +3.13 MiB; warm 4.62 → 4.62 MiB, −0.001 MiB; repeat-use 1.47 → 4.63 MiB, +3.15 MiB; every state flat after the first Stage load |
| Calibration grid-7, 20 runs (total median, p95; compile / admission median) | 57.60 / 63.26 ms; 22.80 / 33.55 ms |

**F7 frame floor and duration.** Chrome presented rAF at **60 Hz (16.7 ms) throughout this pass**,
so ten seconds produced about 600 frames. Every measured run cleared the 600-frame floor (603 in
cold and warm, 603 with one 604 in repeat-use) and finished in **10.07 s**, which the row records as
its actual duration. The 600-frame extension path is retained for a slower display but was not
needed here. A 60 Hz frame clock makes the 16.7/33 ms budget numerically comparable, but this remains
a pre-flight observation, not an owner disposition.

**Bundle report (production build, cold first-load JS, brotli):** `/` 212.0 KiB, `/editor` 211.2,
`/projects` 214.8, `/project/[projectId]/spatial` 376.6, `/p/[publicationId]` 300.6. A `--forbid` for
`preview` on the Stage route exits 0; an authoring module on the visitor route also exits 0.

**Bundle assertions (rechecked on this tree after the harness edits).**
`--forbid '/p/[publicationId]=src/lib/authoring/'` exits 0 (no hit) on both an ordinary and a
sourcemap build. On the sourcemap build, `--forbid '/p/[publicationId]=src/lib/visitor/'` exits 1
and lists the visitor modules actually in that set (13 matching lines), and
`--forbid '/project/[projectId]/spatial=authoring'` exits 1 — the check refuses a present module
rather than passing vacuously. The ordinary build was restored with `npm run build` after the
sourcemap pass.

## Hard rows — OWNER-RUN, NOT CLAIMED

The plan's acceptance forbids claiming a product budget from this pass, and the E6 amendment
requires the owner-operated reference run. The host is the designated model (Apple M2, 16 GB); this
pass ran on AC at 15 % charging with Low Power Mode off, but the reference event is owner-operated
on battery, and this agent-driven pre-flight is not it. **No hard row has a disposition in this
record.**

| Hard row | Owner-run command |
| --- | --- |
| F1 stage **first architectural frame** cold ≤ 3.0 s (the contract's first-interactive frame is not measured by this harness); F2 S ≤ 300 ms, M ≤ 800 ms (same proxy caveat); F3 S preview p95 ≤ 33 ms and frame p95/p99; F4 commit p95 ≤ 100 ms; F7 S/M frame p95/p99 ≤ 16.7/33 ms; F8 p95 ≤ 100 ms; F9 main-thread and local feedback p95 ≤ 100 ms; F13 growth ≤ 5 MiB; Stage first-load JS br ≤ 400 KiB; warm repeat ≈ 0 transferred | `cd apps/editor` then `npx playwright test --config perf/playwright.config.ts --project=chrome` (F9 needs the local API stack and `PERF_API_ORIGIN` / `E2E_TEST_AUTH_SECRET` / `PUBLIC_API_ORIGIN` exactly as `perf/README.md` describes; without them the spec skips and says so) |
| Calibration page median on the reference machine | `cd apps/editor` then `npx playwright test --config perf/playwright.config.ts --project=chrome flows/calibration.spec.ts`; record the 20-run `totalMedian` as `PERF_REFERENCE_CALIBRATION_MS` for other machines |

Pre-flight observations use the first-architectural-frame proxy for F1/F2, not the contract's
first-interactive definition. On this pass F3 matching-preview p95 is 16.01–16.5 ms, F4 commit p95
25.67–48.91 ms, F8 completion p95 at most 31.3 ms, F9 local feedback p95 0.70–1.10 ms, F2 S total
p95 27.2–85.66 ms, F1 1.14 s and F13 cold/repeat-use growth 3.13/3.15 MiB (warm flat). F9's saved
label p95 is 100.47–101.86 ms, at the edge of its 100 ms proposal. F7 ran on a 60 Hz presented clock
with p95 16.7 ms and p99 16.8 ms. None of that is a disposition; the owner's reference run decides,
and no budget is accepted here.

## Unrun and partially-run rows (criterion 3 inventory)

None of the rows below has a value in this record. Each names the reason and the command an owner
would run; rows owned by another slice name that slice rather than inventing a command here.

| Row not run or not fully run | Why | Owner command |
| --- | --- | --- |
| F1 contract **first interactive frame** (pointer handled within 50 ms) | Harness records the first architectural rAF frame after activation; it does not dispatch a pointer and test 50 ms handling. | `cd apps/editor && npx playwright test --config perf/playwright.config.ts --project=chrome flows/startup.spec.ts` plus an owner DevTools Event Timing/pointer probe. |
| F2 contract first interactive frame, mesh-build split, JS heap after GC | Same label gap; admission and first architectural frame are recorded, the mesh/heap probes are not. | `... flows/project-open.spec.ts --project=chrome`. |
| F3 native Wall drawing on S/M/L; M/L drag workloads; frame p95/p99; long tasks; preview solve time; release-to-final-result split; draw calls/triangles/GPU time; trace-matched presented frame | No native drawing feature ships in this slice; the methodology runs on the straight-Wall Dimensions drag at S only. No renderer probe; trace correlation is the documented deviation. | `... flows/drag-correlation.spec.ts --project=chrome`; Chrome Performance trace per the deviation record. |
| F4 accept/install/mesh-rebuild split, M/L precision workloads, discrete responsiveness | Only command-to-presented-result completion is captured. | `... flows/drag-correlation.spec.ts --project=chrome` plus a trace split. |
| F5 object import/admission; F6 placement; F10 capture/Preview; F11 viewer cold load; F12 viewer navigation | These flows belong to their consuming slices (T2.P02, T3.P02, T4); this harness does not pre-build them. | Their consuming slice's harness; no command in this slice. |
| F7 S and L orbits, draw calls/triangles/GPU time, presented-frame trace | Only M runs here, on a 60 Hz clock (603 frames in 10.07 s). No renderer probe; trace deviation applies. | `... flows/orbit.spec.ts --project=chrome` for S/L once fixtures exist; GPU probe/trace separately. |
| F8 recompile/admission split, discrete responsiveness | Only restored-result completion is captured. | `... flows/drag-correlation.spec.ts --project=chrome`. |
| F9 main-thread blocking, serialize/hash split, upload/RTT/server split, production-service receipt | Runs against the local test-auth stack on loopback; client marks do not split those phases. | `... flows/save.spec.ts --project=chrome` against a controlled service, with server timing. |
| F13 `renderer.info.memory` geometries/textures, live WebGL contexts, detached DOM nodes, viewer/Preview enter-exit cycles | The shipped Stage exposes no renderer probe; viewer/Preview cycles are not in this slice. | `... flows/cycles.spec.ts --project=chrome` plus a renderer probe; viewer/Preview in their slices. |
| L and XL workloads; S orbit; M/L drag; Safari and Firefox | The matrix beyond S/M and Chrome was not run. | `PERF_RUNS=10 PERF_SAMPLES=60 ... --project=<browser>` per flow/workload; L/XL fixtures are not built. |
| Chromium on this tree | The last Chromium evidence predates the harness edits that added warm/repeat-use rows; Chromium was not rerun after them. | `cd apps/editor && PERF_RUNS=10 PERF_SAMPLES=60 npx playwright test --config perf/playwright.config.ts --project=chromium` (one flow at a time if needed). |
| Calibration reference median | Owner-operated reference machine only; no `PERF_REFERENCE_CALIBRATION_MS` was supplied. | `... flows/calibration.spec.ts --project=chrome` on the designated MacBook Air M2. |
| Per-row build hash and display Hz | Rows record commit, browser, CPU rate and power; the build hash and display Hz (60 Hz this pass) are stated globally, not per row. | Owner records both when producing reference rows. |
| S01 focused recheck and static surface gates | **Rerun on this tree on 2026-10-22**: 6 files / 88 tests passed; both static gates exited 0. Not unrun. | `npx vitest run tests/lib/visitor/preview-surface-closure.test.ts tests/lib/authoring/f4-acceptance.test.ts tests/lib/authoring/f4-unit-acceptance.test.ts tests/lib/authoring/unit-acceptance-conformance.test.ts tests/vite/public-surface-boundary-plugin.test.ts tests/vite/preview-surface-boundary-plugin.test.ts`; `node scripts/verify-public-surface.mjs`; `node scripts/verify-preview-surface.mjs`. |

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
  recorded in the row's limitations. This pass measured delayed p95 95.84 ms / max 115.6 ms against
  baseline p95 16.5 ms / max 16.6 ms; 9 of 180 delayed inputs presented and 171 were superseded,
  which the proof accepts because no input lost its row.
- F7 was originally paced by a fixed per-step delay (`floor(10000/60) - 60` ms), which finished the
  60-step orbit in about 6.4 s and, with browser overhead, 7–8 s. It now paces to an absolute
  10 s deadline and, if the display cannot deliver 600 frames in that time, continues the same orbit
  until the floor is met while recording the actual duration. This pass presented at 60 Hz and needed
  no extension (603 frames in 10.07 s); the extension path is retained rather than removed.
- The cache matrix was completed in the same pass: every flow got a repeat-use row (navigation and
  drag flows close to the hub before the next open) and F13 got a warm row. While doing that, two
  defects in the in-progress edits were fixed: `startup` and `project-open` created every session with
  `cacheState: 'cold'` even for warm/repeat-use rows, and F13's first warm attempt measured an
  unwarmed first load. F13 now runs a discarded cycle before the measured warm cycle.
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
trace           scope-2 trace-of-presented-frame method not implemented; owner decision pending
hard rows       owner-operated reference pass pending (E6); no budget accepted here
calibration     reference median not recorded; other machines cannot claim equivalence yet
GPU             draw calls, triangles, GPU time/memory and traced-image presentation unrun
workloads       L and XL, S orbit, M/L drag, Safari, Firefox, viewer F11/F12, Preview F10 unrun
save            durable receipt is a local-stack target observation, not a production service baseline
```

## Self-check

```textacceptance    PASS for criteria 1–5 — every claim cites a command result; hard rows and the trace deviation remain owner decisions
tier          PASS — exhaustive final gate recorded; S01 integration rechecked on this branch
scope         PASS — harness, scripts, devDependency, marks and regression only; no product feature
isolation     PASS — perf/ is outside every Vitest lane and no root gate calls it
cache         PASS — cold, warm and repeat-use for every flow row; F13 warm is one cycle after a discarded cycle
labels        PASS — F1/F2 rows are first architectural frame (rAF proxy), never first interactive
inventory     PASS — every unrun, partial and out-of-slice row is named with its reason and owner command
correlation   PASS for the delayed-sample property; **DEVIATION** for the plan's trace-of-presented-frame method
bundle        PASS — route sets reproduced; a present module is refused, an absent one passes
hygiene       PASS — no probe, debug flag, tuned absolute threshold or formatting residue left
owner-run     PENDING — hard baseline and calibration rows await the owner's reference run
trace         PENDING — owner must accept the deviation or authorize the tracing slice
review        PENDING — no independent verdict on this revision; status is not `reviewed`
```
