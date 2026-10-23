# T3.P03.S02 — reviewer hand-off

**Slice:** T3.P03.S02 · Measurement workflow and final gate (T3.P03's declared final gate)
**Branch:** `t3/p03-s02-measurement-final-gate` → `main`
**Base:** `55683981` (merge of PR #176, T3.P03.S01)
**HEAD at hand-off:** `4db6e4dc`; measured harness code is `bfc4fc91`
**Status:** acceptance criteria 1–5 met as recorded; **not accepted**. Owner decisions and owner-run
hard rows remain. [Acceptance record](./acceptance.md) is the authority; this page is an orientation.

## What this PR is

It installs the owner-authorized on-demand performance workflow and records T3.P03's integrated
result. It does **not** add a product feature or claim a product budget. The only product-source
change is a runtime-gated mark helper and its call sites: inert unless the harness sets a flag before
application code evaluates. Everything else is the `perf/` harness, its regression test, scripts and
documentation.

Review the **acceptance record first**. If a claim there cannot be traced to a command result, treat
that as the blocking finding.

## What to review, in order

1. **Cold/warm/repeat semantics** — [`perf/lib/browser.ts`](../../../../../apps/editor/perf/lib/browser.ts).
   Cold creates a **new context per measured run** (contract definition), warm and repeat-use reuse
   one context. F13 is the stated exception: one fresh context for its ten-cycle cold row, per-open
   cache/cookie clears, no V8 reset. Check that no row claims a state it did not run.
2. **Flow assertions and labels** — [`perf/flows/`](../../../../../apps/editor/perf/flows). F1/F2
   rows are **first architectural frame (rAF proxy)**, never the contract's first-interactive frame.
   Check that every dispatched input keeps a ledger row, and that "presented" is not overclaimed.
3. **Mark helper inertness** — [`perf-marks.ts`](../../../../../apps/editor/src/lib/platform/perf-marks.ts)
   and [`perf-marks.test.ts`](../../../../../apps/editor/tests/lib/platform/perf-marks.test.ts).
   The ordinary build must not evaluate the detail object or call `performance.now`/`mark`; the
   throwing-getter regression is the proof.
4. **Delayed-preview proof** — `drag-correlation.spec.ts` injects a 500 ms frame delay and asserts
   every input keeps a row, delayed p95 > baseline p95, delayed max > 2× baseline max, and
   superseded > 0. It does **not** prove which pixels presented.
5. **Record honesty** — [acceptance.md](./acceptance.md) and
   [perf/README.md](../../../../../apps/editor/perf/README.md). Check the criterion postures, the
   unrun inventory, the hard-row section (must stay value-free) and the trace deviation.

## Evidence on this tree

Measured on `bfc4fc91`, one clean preview built from this tree, Chrome 153, N1, 1920×1080 @ DPR 1,
AC power, Low Power Mode off:

```text
Chrome matrix       9 tests passed in 18.9 m   (7 flow specs × cold/warm/repeat-use
                                                + calibration + delayed-preview diagnostic)
F1 cold/warm/repeat 1,307.9 / 792.75 / 790.9 ms median (p95 1,320 / 793 / 792)
F2 S                144.05 / 27.1 / 26.3 ms median
F2 M                533.2 / 459.25 / 476.15 ms median
F3 matching preview 600/600 inputs each state; p95 16.3 / 16.0 / 16.3 ms
Delayed proof       180/180 rows, 8 presented, 172 superseded; p95 126.14 vs 16.2 ms
F7 M orbit          603 frames/run, 10.07 s, p95 16.7 ms, p99 16.8 ms, 0 dropped
F9 local feedback   p95 0.96 / 1.06 / 1.11 ms; durable receipt 1,525.9 / 607.5 / 601.7 ms
F13 heap growth     +3.13 / +0.0009 / +3.15 MiB (cold / warm / repeat-use)
Calibration         53.35 ms median, 58.35 p95
```

```text
npm run check        0 errors, 0 warnings
npm test             172 files / 2,243 tests
npm run test:arch    21 files / 172 tests
npm run test:heavy   8 files / 118 tests
npm run build        ordinary production build; both surface gates ran
npm run check:api    tsc --noEmit
npm run test:api     80 tests / 11 suites / 0 failures / 0 skips (local Postgres)
S01 focused recheck  6 files / 88 tests; both static surface gates exit 0
bundle report        / 212.0, /editor 211.2, /projects 214.8, Stage 376.6, /p 300.6 KiB br
                     (unchanged); injected-module refusal exercised on a sourcemap build
tsc --noEmit         clean
```

Raw results stay outside Git (default `$TMPDIR/biskiq-perf-results`); the record carries the summary.
The measured sequence ran on `bfc4fc91`; the later harness change is a setup-error context close, and
the rest is documentation.

## What is intentionally not claimed

- **Trace correlation.** The plan's scope 2 asks for the presented frame in a trace. The harness pairs
  the `overlay:updated` mark with the first rAF tick and runs `trace: 'off'`. This is an explicit
  deviation with options A/B/C in
  [the decision record](../../../../../docs/reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
  A reviewer should not read any rAF number as trace proof.
- **Hard rows.** F1/F2/F3/F4/F7/F8/F9/F13 budgets and the calibration median are owner-run on the
  designated MacBook Air M2; the record contains pre-flight observations only, with no disposition.
- **Coverage gaps.** Page INP, Chromium on this tree, L/XL workloads, S orbit, M/L drags, Safari,
  Firefox, renderer/GPU probes and the F10/F11/F12 flows of later slices are listed in the
  criterion-3 inventory with reasons and owner commands.

## Review history

Two independent reviewer passes were run on the branch; findings were addressed before this hand-off.

- Round 1 caught the reused-context "cold" shortcut, a false page-INP claim, the F13 labels, a broken
  self-check fence and provenance overstatements. Cold contexts and the error-path close were built;
  the rest was corrected in the record.
- Round 2 confirmed the cold rewrite and cookie/session handling, then found the review-status
  contradiction, a placeholder INP command, an outdated Chromium reason and the missing F13 carve-out.
  All are corrected; no material finding remains open.

A reviewer should still reach an independent verdict. Do not treat these rounds as acceptance.

## Open decisions for the owner

1. **Trace:** accept the deviation for T3.P03 (Option A), authorize a tracing slice (B), or amend the
   contract (C).
2. **Hard rows / calibration:** run the owner-operated reference pass; record dispositions. No budget
   is accepted until then.
3. **Acceptance:** mark the slice accepted, or send it back with findings.

## Reproduce

```sh
# from apps/editor, with a local API and DB for F9
PERF_BASE_URL=http://127.0.0.1:4173 PERF_RESULTS_DIR=/tmp/t3p03s02-review \
PERF_API_ORIGIN=http://127.0.0.1:8792 E2E_TEST_AUTH_SECRET=... \
  npx playwright test --config perf/playwright.config.ts --project=chrome
```

A reduced pass (`PERF_RUNS=2 PERF_SAMPLES=5`) exercises every state in about six minutes and is
labelled pre-flight in every row; it is not acceptance evidence. F9 skips with its reason when the
local stack variables are absent. No production endpoint is used.

## Merge / closeout

Merge only after the owner's trace decision and the reference pass. After merge, close T3.P03.S01's
integration route through this record and update the T3 handoff; do not mark the phase closed from
this page alone.
