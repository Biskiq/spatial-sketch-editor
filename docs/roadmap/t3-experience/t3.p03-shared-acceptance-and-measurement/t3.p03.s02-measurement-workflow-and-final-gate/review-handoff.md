# T3.P03.S02 — reviewer hand-off

**PR:** #180 · **Branch:** `t3/p03-s02-measurement-final-gate` → `main`
**Base:** `55683981` (PR #176 / S01) · **Reviewed head:** `ca2aa4c99b69fb010b9c2e2dfc180387d2752503`
**Corrections:** local, uncommitted. **Slice acceptance:** pending.

The review follow-up fixes invalid Save receipt timing, document-reloading lifecycle measurements,
fail-open bundle assertions, retained renderers, stale Dimensions callbacks and Svelte route-head
anchors. A separate trace-image/compositor-feedback diagnostic now demonstrates the requested
correlation method. Targeted validation and the final integrated repository gate pass, including
real Rollup module proof despite generated empty source maps. The first matrix attempt's invalid
Chromium trace-delay comparison is preserved; its causal replacement passes both browsers.
Final combined coverage is **62/62 unique passing cases, zero skips**, and parent developer review
passes. [Acceptance record](./acceptance.md) owns exact commands, raw paths, historical
withdrawals and criterion postures.

## Review order

1. **Cache and application lifetime.** `perf/lib/browser.ts` creates a fresh context for each cold
   measured run; warm/repeat-use reuse one context. Other navigation/drag flows still reload
   documents and establish cache reuse. F13 instead uses New Project and browser Back, preserving
   a sentinel and time origin. Its cold-entry row is ten cache-cleared lifecycle cycles with resident
   modules/V8; warm is one discarded plus one measured cycle; repeat-use is one discarded plus ten
   measured cycles. Entry heap stays separate from the warmed baseline. All cycles have twenty
   accepted edits: 460 including discarded cycles. Heap metric unavailability fails closed.
2. **Save milestones.** `api-transport.ts` marks the matching parsed successful acknowledgement;
   `save.spec.ts` subtracts `save:submit` on the same clock and requires complete sample counts.
   Project/operation identity, pre-submit delay exclusion and delayed-receipt sensitivity are tested.
   Saving/Saved label timestamps mean DOM updates, not presented feedback. Wire size is encoded bytes.
3. **Renderer and callback ownership.** `managed-webgl-renderer.ts` observes Three's actual shared
   DFG texture through public material hooks and releases it during Canvas teardown. All four Canvas
   sites use it. The original render method returns after discovery; survivor target/face/mip/
   viewport/scissor state is preserved. Dimensions uses a lifetime-owned controller reference for
   events, async completions and RAF callbacks. Focused blur/removal and stale-completion tests cover
   teardown. Source upload disposes its public chooser handle without Playwright's extra retainer.
4. **Route-head ownership.** The contained Svelte 5.56.4→5.57.0 upgrade applies the first released
   upstream anchor-ownership fix, preserving original route metadata. Head regressions cover exact
   connected-node counts, native growth, SSR/hydration, dynamic publication titles and noindex.
   The old-version control fails after one return. No private framework patch or head-node sweep.
5. **Labels and inertness.** F1/F2 report the first architectural frame, explicitly an rAF proxy;
   the contract's first-interactive probe remains unrun. Every input keeps a status row. Throwing
   detail/geometry getters and clock/mark spies prove disabled helpers do not evaluate their details.
6. **Two correlation proofs.** The ordinary 500 ms delayed-rAF proof preserves every input and
   exposes delay from a handler-mark clock; pre-handler queueing is omitted. Separate
   `trace-proof.spec.ts` uses normalized event timestamps and requires the installed
   sequence, geometry identity, marker pixel and exact trace mark in real Chrome JPEGs. Exact image
   source/frame IDs join one host and one nonforked ALL reporter with an unambiguous span completion.
   Missing/duplicate completions, PARTIAL-only feedback and ambiguous hosts/reporters refuse timing.
   Screenshot observation, compositor feedback and physical display time remain separate. Sampling
   cannot rule out an earlier uncaptured matching frame; physical scanout time stays null.
   Separate cold-run maxima reversed under different rendering load; the replacement checks a real
   500 ms held-input/release and zero-hold negative. Original slow observations remain disclosed.
7. **Bundle assertions.** Source-path `--forbid` requires usable maps for every emitted JS file or
   explicit Rollup provenance from the same trusted build. The latter records actual module/facade
   IDs and validates the complete JS inventory and exact hashes. Missing/stale/malformed/partial
   evidence fails closed. Module identity is separate from map byte attribution; `--forbid-file`
   checks filenames only. Known-present, known-absent and unavailable-evidence controls are required.
8. **Record honesty.** Review the criterion table, explicitly historical values, value-free hard-row
   section and unrun inventory in [acceptance.md](./acceptance.md). The runtime workflow, lifetime
   repairs and diagnostic tooling do not grant owner budget/method acceptance or phase closure.

## Current validation

- Final combined browser validation: **62/62 unique cases across thirteen files**, 31 per browser,
  zero skips. Nine unchanged Chromium diagnostics and 24 repaired trace checks are explicitly reused;
  the newly executed nine Chrome diagnostics and twenty flow cases all pass. Parent independently
  matched every case to its current inventory and actual passing log. This is combined coverage,
  not a claim that one fresh command ran all 62.
- Corrected local-stack F9: **2/2 per browser, zero skips**, ten complete samples per state plus delay control.
  API check and **80 DB-backed tests across eleven reports, zero failures/skips** pass. The guarded
  loopback database/API/preview/browser and generated helper credentials were cleaned up.
- Renderer/Dimensions: **47 focused tests**, **six lifecycle/real-WebGL overlap cases**, and the
  historical **440-edit F13** pass. Retired owners collect and survivor pixels/state remain exact.
  Final F13 runs **460 accepted edits per browser**. Warmed ten-cycle growth is **1.622818 MiB
  Chromium / 1.728813 MiB Chrome**; all warmed repeat-use native counts stay constant within each
  browser. Cold entry growth includes module/runtime loading; no hard budget is accepted. Old
  document-reloading heap evidence is withdrawn.
- Earlier targeted Chrome trace diagnostic: **8/8**. Ordinary trace matches **60/60** real image/ALL completions. Delayed
  trace retains **60 rows**, three matches and 57 explicit supersessions. Final input matches;
  wrong identities/pixels and real-trace completion/host mutations refuse unsupported evidence.
- Head fix: **6/6 head tests and 4/4 lifecycle tests across both browsers, zero skips**. All edited
  retired-project samples keep nodes 596/documents 2/listeners 57/head 43/Text 7 exact; Stage/Canvas
  collect.
- Final integrated lanes: **176 editor files / 2,264 tests**, architecture **21/172**, heavy
  **8/118**, S01 **6/88**, check **0 errors/warnings**, both static surface gates, strict all-perf
  TypeScript, seven pure trace controls and ordinary build pass.
- Bundle proof: real authoring absence passes with **233 Rollup module identities**; known visitor
  presence refuses **11 hits**. Maps-only, ordinary/no-evidence, malformed/partial/stale/edited and
  invalid CLI selections refuse. Source-map byte attribution remains incomplete and separate.
- Historical first matrix attempt: **Chromium diagnostics 16 pass / 1 fail / 0 skips**, then stopped.
  Its images/feedback match all 60 baseline inputs, but independent-mode maximum ordering fails
  under different rendering load. The causal held-input/release replacement below passes;
  raw slow observations and the failed-attempt record remain. That stopped attempt's remaining
  cases were subsequently completed; its failed trace assertion is not counted as a pass.
- Causal repair: both actual browser proofs and **22/22 pure controls** pass. Positive holds are
  501.9 / 501.7 ms, with exact post-release image/ALL feedback; real 0.1 ms zero-holds are rejected.
  Parent affected typing/controls pass; production output remains byte-identical. Runtime health
  records Chromium SwiftShader and Chrome M2 Metal, with one healthy context per condition.
- Parent independently verified **18 raw flow reports / 46 rows / 114 statistic distributions**,
  default counts, source/output identities and runtime cleanup. Source remains 528 editor/shared
  files plus 25 API files; all 118 ordinary output files remain unchanged. Final evidence and the
  per-case ledger are `/tmp/pr180-final-matrix-evidence.md` and
  `/private/tmp/pr180-final-matrix-rerun/coverage-ledger.csv`; independent audit is
  `/tmp/pr180-parent-final/final-matrix-independent-review.json`.
- Actual binaries are Chromium 153 and Chrome 155; the Desktop Chrome device profile reports UA
  153 in both row labels. Reviewed renderer health is SwiftShader versus Apple M2 Metal, not GPU
  equivalent. Chromium flows take about 1.4 h versus Chrome 18.4 min; their F7 p95 is 100–116.6 ms
  versus 16.7 ms. Power is AC, 88% charging→100% charged, Low Power Mode 0. Timing observations
  remain pre-flight, with no accepted hard budget or supplied reference calibration median.

These are agent-operated pre-flight/correctness observations. All raw artifacts remain outside Git;
the acceptance record supplies their locations. Historical numbers from `bfc4fc91` are retained there,
with invalid F9 receipts and document-reloading F13 explicitly withdrawn.

## Remaining owner work

- Assess the demonstrated trace method and its limits against the plan, then resolve the
  [proposed deviation](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
  Implementation was already authorized; method acceptance is separate.
- Operate the designated reference machine for hard rows and calibration; record dispositions.
- Review the final developer verdict/evidence and accept or return the slice. Developer correction
  review is complete; owner acceptance is separate. The human will run slice close-out and merge
  personally. No agent close-out, commit, push, merge or T3 phase closure was performed.

First-interactive probes, page INP, GPU counters, L/XL, S orbit, M/L drags, Safari/Firefox and
later-slice flows remain explicitly inventoried with reasons and reproduction routes. Both current
Chromium and Chrome matrices are complete; those additional measurements remain unrun.

## Reproduction

Build/preview uses the ordinary production bundle. Run with a disposable local API/database,
configured test-auth secret and preview public API origin; never a production service:

```sh
# From apps/editor; the config owns its preview/browser when PERF_BASE_URL is unset.
PUBLIC_API_ORIGIN=http://127.0.0.1:8792 \
PERF_API_ORIGIN=http://127.0.0.1:8792 E2E_TEST_AUTH_SECRET="$LOCAL_STACK_SECRET" \
PERF_RESULTS_DIR=/tmp/t3p03s02-review PERF_POWER_STATE="$ACTUAL_POWER_STATE" \
  npx playwright test --config perf/playwright.config.ts --project=chrome --project=chromium
```

For a reduced smoke pass, add `PERF_RUNS=2 PERF_SAMPLES=5`; every row is labelled pre-flight and
cannot replace default-count evidence. F13's fixed lifecycle workload and correctness diagnostics
are not reduced by those two variables. If reusing a running preview, set `PERF_BASE_URL` and ensure
that server received `PUBLIC_API_ORIGIN`. F9 skips with a reason if its local API/auth prerequisites
are absent; a complete local-stack validation must report zero skips. The dynamic publication-title
regression also needs a nonempty loopback preview API origin, with read-only responses intercepted.
See [perf/README.md](../../../../../apps/editor/perf/README.md) for stack requirements and metric limits.
