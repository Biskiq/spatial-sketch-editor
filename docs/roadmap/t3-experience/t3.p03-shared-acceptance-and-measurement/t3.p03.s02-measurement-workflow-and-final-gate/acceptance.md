# T3.P03.S02 — acceptance record: Measurement workflow and final gate

**Slice:** T3.P03.S02 · **Status:** accepted (`owner-override`) and shipped on
`t3/p03-s02-measurement-final-gate` at revision `eabd4b88` (full revision and ruling below). This review follow-up corrects F9 receipt timing, F13 application lifetime, and fail-open bundle assertions. The earlier
F9 durable-receipt observations are withdrawn and replaced by the corrected local-stack observations
below. The persistent F13 run exposed retained renderers; the cause is attributed and the repair
passes collection and full-workload checks. A small native-node residual was independently attributed
to Svelte's route-head anchor ownership; its released upstream repair passes both-browser controls.
The separate image/exact compositor-feedback association passes its identity and refusal controls;
the first Chromium matrix attempt exposed an invalid cross-mode delay comparison. Its causal
replacement now passes both browsers and real zero-hold negatives. The plan's presented-frame method remains an explicit
[deviation decision](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md)
awaiting the owner. The final combined validation covers **62/62 unique passing cases**, with zero
skips, and the parent developer review passes. The two original independent review rounds are
historical; this follow-up has its own source and evidence review. Earlier document-reloading F13
heap observations are withdrawn as lifecycle evidence. The owner accepted this revision by explicit
`owner-override`; reference hard rows and calibration remain unrun, and no hard product budget is
claimed · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns
the criteria) · **Phase:** [T3.P03](../README.md) · **Declared** `FINAL PHASE GATE` artifact of T3.P03

```text
VERIFICATION: exhaustive   (declared by the plan; this record is the phase's final gate and S01's
                            declared integration route)
BASE:         55683981       merge of PR #176 (T3.P03.S01 via main) on t3/p03-s02-measurement-final-gate
REVISION:     eabd4b888974127d891cedf840e5e056ad0c016a
STATUS:       final integrated repository gate passes, including real Rollup module proof and
              unavailable-evidence refusals. Corrected local-stack F9, renderer collection,
              trace-image and Svelte head controls pass. Final combined Chrome+Chromium coverage
              passes 62/62 unique cases with zero skips, including both 460-edit F13 workloads.
              Parent independently checked the case ledger, raw rows, statistics, frozen identities
              and cleanup. The first failed trace comparison remains a historical failure;
              its causal replacement and real zero-hold negatives pass both browsers.
              Prior receipt and document-reloading F13 observations are withdrawn;
              mapped bundle checks and unavailable-attribution refusal are verified. Owner-run
              hard rows and calibration remain unrun and no hard budget is claimed. Trace-method
              disposition is not ratified by this record.
```

## Owner ruling — acceptance prerequisites waived (2026-10-23)

```text
DATE:       2026-10-23
RULING:     explicit owner override; accept and ship as owner-override, not reviewed
SCOPE:      T3.P03.S02 only, at revision eabd4b888974127d891cedf840e5e056ad0c016a
WAIVED:     pending independent/formal acceptance prerequisites and any missing or stale formal
            verdict/test-evidence rows, including owner trace-method disposition and owner-operated
            reference hard-row/calibration evidence
NOT CLAIMED: any unrun reference/GPU row, hard product budget, calibration value, or trace option
             (A/B/C) ratification; the existing trace deviation remains unratified
STATE:      slice accepted and shipped as owner-override; phase is closable, not closed
```

The trace deviation is recorded at
[t3p03s02-trace-correlation-deviation-2026-10-22.md](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
It is not ratified by this record, and this record does not treat the rAF attribution as the plan's
traced-frame proof.

No product feature, source encoding or accepted capability changes. The workflow's runtime-gated
mark helper is inert unless a harness sets its flag before application code evaluates, so the
measured bundle is the ordinary production bundle. This review follow-up also repairs shared WebGL
texture ownership and stale Dimensions continuations exposed by the persistent lifecycle test.
The mark helper's installation path now
checks the flag before building the sequence-carrying detail object, and a throwing-getter regression
proves that the ordinary build neither evaluates that detail nor calls `performance.now`/`mark`.

### Does this slice satisfy the plan now?

**The earlier blanket criteria 1–5 claim is withdrawn.** Targeted functional corrections and the
scope-2 diagnostic, final repository gate and complete corrected matrix are verified below.
Owner trace-method disposition remains open and unratified. By criterion:

| Criterion | Posture |
| --- | --- |
| 1. Cold, warm and repeat-use runs with declared statistics; delayed-preview correlation proof | **Execution verified; owner-override accepted with method disposition left open.** Combined coverage passes 62/62 cases, zero skips, at default counts with F9 enabled and 460 accepted F13 edits per browser. F13 preserves one app lifetime and verifies retired Stage/Canvas collection; warm/repeat-use baselines follow one discarded cycle, with entry heap separate. Cold clears cache/cookies per open while loaded modules/V8 stay resident. Other navigation/drag repeat-use helpers measure cache reuse through reloads. The trace comparison failure is preserved; causal held-input/real-zero controls pass both browsers. This record does not ratify a trace option. |
| 2. Bundle report reproduces route sets and refuses an injected module | **Met as tooling with explicit evidence.** Parent's real Rollup-provenance authoring-absence check passes; known visitor presence refuses 11 hits. Empty generated maps remain insufficient on their own. Missing/malformed/partial/stale/edited evidence refuses, and map byte attribution is separate. Ordinary output without evidence also refuses source-path proof; file-only checks retain their narrower meaning. |
| 3. Baseline record names every unrun reference/GPU row | **Met as an inventory**; the rows themselves remain unrun and no value is claimed for them. |
| 4. S01 integrated result rechecked | **Met:** final 6 files / 88 tests and both static gates pass on the repaired source. |
| 5. Complete repository gate | **Met:** final check, full editor 176 files / 2,264 tests, arch 21/172, heavy 8/118 and ordinary build pass. API check and fresh DB-backed 80 tests/11 reports/zero skips pass; subsequent changes do not touch API sources. Harness typing, Node regressions, trace controls and real module proof also pass. |

Owner-override accepts this slice at the recorded revision while leaving unrun evidence unclaimed.
The trace-method disposition and reference hard-row/calibration operation remain open as owner
decisions and measurements; they no longer block this slice's accepted status. Cache reuse across
full document reloads is not proof of application lifetime cleanup.

## Delivered

- **Harness.** `@playwright/test` 1.63.0 (exact) as an editor devDependency with its own config in
  `apps/editor/perf/`; explicit `perf` and `perf:bundle` scripts at editor and root. The default
  Vitest lanes never collect it (`vitest.shared.ts` includes only `tests/**`), and root `test`,
  `check` and `build` never call it. Cold runs use a fresh context per run; Playwright's browser
  cache supplies Chromium and branded Chrome.
- **Correlation.** `src/lib/platform/perf-marks.ts` assigns a monotonic sequence at each pointer
  move; the Layout adapter records preview installation, the route records an `overlay:updated` mark
  only when the painted marker set changes, and the acceptance host records the accepted result. The
  baseline harness pairs each input with the first rendering-opportunity frame after its own mark,
  keeping `presented` / `superseded` / `refused` / `unresolved` for every input. Here `presented`
  names the rAF proxy status, not captured pixels or physical display presentation. Command, admission, Save and
  Stage-activation marks cover F1, F2, F4, F8 and F9.
- **Flows.** F1 startup, F2 open (S and M), F7 orbit, F9 Save through the local test-auth seam, F13
  repeated open/close, and the F3/F4/F8 methodology on the shipped Wall drag, precision commit and
  Undo/Redo — each in **cold, warm and repeat-use**. Cold creates a fresh browser context for every
  measured run; warm and repeat-use reuse one context and never clear. For the navigation/drag flows
  repeat-use is sampled as ten full-document navigation cycles in that context, one measured cycle per run, closing back to
  the hub before the next open. F1 closes implicitly: `startOnce` navigates to the hub at the start of
  the next run, while the other flows close explicitly with `closeToHub`. Those rows demonstrate cache reuse, not persistent-app teardown. F13 now uses New Project and
  browser Back with a same-realm sentinel; its repeat-use row is ten measured client-side cycles
  after one discarded warm-up. Entry heap is recorded separately from the warmed baseline. Its
  cold row starts in one fresh context and clears cache/cookies before each open (the
  already-loaded modules and the renderer's V8 code cache remain resident inside that run). F13's warm row measures one cycle after a
  discarded cycle has warmed the Stage, so it is not a disguised cold load. The delayed-preview proof
  remains a warm-only diagnostic, not a flow row.
- **Calibration.** `perf/calibration/entry.ts` bundles the grid-7 compile plus Stage admission with
  the production config (esbuild, minified, `NODE_ENV=production`); the spec runs it 20×, searches
  CDP rates 1.5–4 when `PERF_REFERENCE_CALIBRATION_MS` is supplied, and reports no calibrated
  equivalence rather than extrapolating.
- **Bundle report.** `perf/bundle-report.mjs` reproduces per-route first-load sets with raw/gzip/br
  bytes and module identity. `--forbid` uses complete usable maps or explicit build-time Rollup
  provenance, and fails on hits or unavailable evidence. Provenance binds module IDs to exact JS
  bytes and the full client inventory, separately from source-map byte attribution.
  `--forbid-file` checks filenames without requiring maps.
- **Regression.** `tests/lib/platform/perf-marks.test.ts` proves the helper is inert by default
  (including a throwing detail getter and clock/mark spies), carries the sequence, emits user-timing
  marks and bounds the ledger.

## Trace correlation — separate image diagnostic and remaining disposition

The plan requires correlation with **the presented frame in the trace**, and the contract says a lone
rAF callback is not proof of presentation. Ordinary timing runs keep `trace: 'off'` in
[playwright.config.ts](../../../../../apps/editor/perf/playwright.config.ts) and the ledger pairs an
`overlay:updated` mark with the first rAF tick after it. Those values remain scheduling proxies.
Their input clock is the product's handler mark and omits pre-handler queueing.
Trace rows instead normalize the real event timestamp and retain handler time separately;
the two intervals and differently perturbed workloads must not be compared as equivalent timings.

The delayed-preview proof still does what criterion 1 asks of it — every dispatched input keeps a
row and the injected delay appears as latency, not a dropped sample — but it does not prove which
pixels were presented.

The review follow-up implements and validates a **separate diagnostic**,
`flows/trace-proof.spec.ts`. An additional `traceProof` flag renders an identity grid and a marker at the
actual preview position in the same SVG update. The decoder requires the sequence, geometry
signature, corresponding trace mark and matching marker pixel; it rejects mismatched identities,
missing marker pixels and pre-causal captures. Every dispatched input keeps a status row. Two
unique User Timing anchors normalize the trace clock. Legacy or unknown Screenshot schemas retain
image identity with null latency and an explicit clock reason. Modern latency ends at the Screenshot
event observed after bitmap acquisition and may include consumer/delivery delay; it is not exact
capture or physical presentation time. Expected display time is retained as raw estimated metadata.

Exact image source/frame IDs are also joined to one layer-tree host and one nonforked
`STATE_PRESENTED_ALL` reporter. Supported complete spans or scoped async begin/end identities
provide separate trace-reported presentation-feedback time. Missing/duplicate completions,
PARTIAL/forked-only feedback and ambiguous hosts/reporters refuse timing. This identifies the
earliest captured matching frame with unambiguous feedback, not proof that no earlier uncaptured
matching frame existed. Physical display scanout time remains null.

Tracing and the visual diagnostic perturb the workload, so this path does not replace ordinary
untraced baseline timings. Image decoding runs after recording. The tradeoff, options and remaining
owner disposition are recorded in
[the deviation decision](../../../../reference/decisions/t3p03s02-trace-correlation-deviation-2026-10-22.md).
Implementation was authorized in the review follow-up; the diagnostic's acceptance against the
plan's presented-frame requirement is not ratified here. No hard presentation row is accepted.

## Verification and correction evidence

All commands ran from the repository root unless stated. `npm test` used the default full lane.
Historical gate blocks below precede the final corrections and are labelled accordingly.

**Final integrated parent gate (2026-10-23).** All seventeen recorded checks have their expected
exit status after the complete renderer/Dimensions/Save/trace/head/provenance patch and final CLI
selection fix. The mapped/source-assertion failure that exposed generated empty maps is retained
in earlier attempt logs; explicit graph provenance repairs the method without treating empty maps
as sufficient evidence.

```text
check                       PASS  0 errors / 0 warnings
full editor                 PASS  176 files / 2,264 tests
arch / heavy                PASS  21 files / 172 tests; 8 files / 118 tests
S01 integrated              PASS  6 files / 88 tests
static public / Preview     PASS  2 / 12 files
Node bundle regression      PASS  2 tests, including invalid explicit CLI selection
strict harness typing       PASS  all 24 perf TS sources, real generated declarations, no shim
pure trace controls         PASS  7/7
mapped/provenance build      PASS  actual public authoring absence: 233 IDs, no hits
known visitor presence      PASS  refusal: 11 module hits
maps-only proof             PASS  refusal: generated empty maps remain unavailable evidence
ordinary build restored     PASS  no provenance sidecar
ordinary no-evidence proof  PASS  refusal
diff whitespace             PASS
API check / DB-backed gate  PASS  80 tests / 11 file reports / 0 failures / 0 skips
                                  from the isolated F9 gate; API sources unchanged afterward
```

Results, exact commands and final per-command logs: `/tmp/pr180-parent-final/gate-results.json`.
Source manifest at that gate (525 files, Git tracked plus nonignored source/config/fixtures; Markdown and
generated artifacts excluded): `/tmp/pr180-parent-final/final-source-manifest.json`, aggregate
SHA256 `3f014b6b9fe5f7685446b1d29b188911a1a55a67e7bfb5ef11cdab6a434d4d71`.
Ordinary output manifest (118 files): `/tmp/pr180-parent-final/final-ordinary-bundle-manifest.json`,
aggregate `f49ca0d451b147670f1edb70cd1d0d727ef121ddaedbfc8ac2eac53923a947f7`.
Raw source/module reports distinguish `moduleAttributed=true` from map byte `attributed=false`.

The first default-count Chrome/Chromium matrix attempt stopped on the trace diagnostic failure
below. Source/output stayed frozen and all resources were cleaned. That attempt is not a complete
matrix pass; the final combined result follows the causal repair. Coordination used direct
completion/blocker messages without thread-status polling.

**First final-matrix attempt: stopped, not a pass.** Chromium 153.0.8010.12 diagnostics report
**16 passed / 1 failed / 0 skipped**. Head 3/3, lifecycle 2/2, renderer 4/4 and pure trace 7/7 pass.
The actual trace proof retains all 60 baseline image/ALL matches and consistent clocks, but its
independent-run maximum comparison fails: screenshot-observation max is 883.859 ms baseline versus
423.102 ms delayed; trace-reported max is 1174.147 versus 422.944 ms. Traced elapsed work is
25.87 seconds / 211 images versus delayed 2.158 seconds / 7 images. The delayed run retains 60 rows,
three matches and 57 explicit supersessions. These slow baseline observations are retained.

The global 500 ms rAF delay changes unrelated render frequency as well as preview scheduling;
separate cold-context maxima have no causal ordering guarantee. The final delayed input also enters
an already pending delayed frame, so it does not receive a fresh 500 ms. The replacement below uses
a causal held/released-input proof and deterministic negative controls, preserving
image identity, exact feedback and every-input accounting. No threshold or sample window is retuned.
Actual hardware/context-load attribution remains observational, not assumed from this inversion.

In that stopped attempt, neither Chrome nor any remaining flow spec was started; F9/F13 final
measurements were unrun at that point. They subsequently passed in the combined validation below.
Within the configured-API lifecycle control, native nodes 611, listeners 57, documents 2 and head
43/Text 7 remain constant; all retired Stage/Canvas nodes collect. The earlier 596-node samples
used a different preview configuration and are not a cross-run equality claim. AC power changed
67→69% charging, Low Power Mode 0. Parent checked every source/output hash unchanged after the stop.
API/preview/PostgreSQL/helper/browser were removed, ports 43993–43995 closed.

Evidence and paths: `/private/tmp/pr180-final-matrix/failed-first-attempt-evidence.md`; raw diagnostics:
`/private/tmp/pr180-final-matrix/raw/diagnostics-chromium/trace-proof-chromium-1792781308729/`;
parent bounded analysis: `/tmp/pr180-parent-final/trace-control-diagnosis.md` and
`trace-control-failure-summary.json`. This failed attempt remains historical; the independently
reviewed causal repair below permits a new release without relabelling that failure.

**Causal trace repair and affected verification.** No product source or production build changes.
Five diagnostic conditions retain untraced/ordinary/global-delay observations and add a held-frame
positive plus a real zero-hold negative. The gate arms after setup/tracing, captures pending
application callbacks and 60 real inputs, seals after final installation, then observes the requested
hold before explicit page-clock/trace-confirmed release. It rejects any pre-release overlay, matching
image or matching presentation. Matching final pixels and exact ALL feedback remain mandatory in
both positive and negative cases; unrelated slowness cannot replace the hold.

| Browser / actual renderer | Observed positive hold | Final input→trace-reported presentation | Real zero-hold |
| --- | --- | --- | --- |
| Chromium 153 / Vulkan SwiftShader | 501.9 ms | 637.031 ms | 0.1 ms, correctly rejected |
| Chrome 155 / Apple M2 Metal | 501.7 ms | 541.734 ms | 0.1 ms, correctly rejected |

Each gated condition retains 60 rows: 59 superseded before overlay, final input 60 matched. No
pre-release overlay/image/feedback occurs; all gate milestones match the normalized trace. Each
zero-hold run also obtains final exact image/ALL evidence and correctly refuses the 500 ms oracle.
Original image/pixel/clock/host/completion controls remain. All actual image counts stay below 450.

Both real browser proofs pass (Chromium 46.6 s, Chrome 20.4 s). Eleven pure controls per browser
pass, **22/22**, including high unrelated baseline, missing/early release, bypass, cancellation and
disposal. Parent independently inspected raw positive/zero verdicts, every-input counts, exact final
feedback, clock spread, refusal controls and runtime health; strict checking over **27 perf TS
sources** and a parent **11/11** pure-control rerun pass. Ordinary output remains byte-identical
across all 118 files, aggregate `f49ca0d451b147670f1edb70cd1d0d727ef121ddaedbfc8ac2eac53923a947f7`.
Each condition observes one connected WebGL2 context and zero loss/restoration. The captured current
SwiftShader/Metal evidence explains why GPU equivalence must not be assumed; historical context
health was not captured and is not retrospectively asserted. Original slow observations stay intact.

Evidence: `/tmp/pr180-trace-control-final-evidence.md`; actual per-condition traces, decoded images
and correlation rows: `/tmp/pr180-trace-control/chromium/trace-proof-chromium-1792782114199/` and
`/tmp/pr180-trace-control/chrome/trace-proof-chrome-1792782176888/`. Parent checks:
`/tmp/pr180-parent-final/trace-control-affected-results.json`, `trace-control-raw-review.json`.
All implementer and parent runtime resources closed before direct matrix release.

Source audit permits only trace-proof changes, handler-clock labels in drag-correlation, and three
new isolated trace/control files. Refreshed frozen manifest (528 source files):
`/tmp/pr180-parent-final/final-source-manifest-after-trace.json`, aggregate
`5cbbf622d0e024c28baa255c1c3c584532b1609650e3de140a386424cb2a0022`.
The unchanged product/default-suite/build/API checks above remain valid; affected harness checks
are recorded separately rather than pretending a new full repository run occurred.

### Final combined validation and developer verdict — 2026-10-23

**Developer review: PASS; no outstanding developer correction finding.** The current suite has
**31 cases per browser / 62 unique cases across 13 files**, all passing with zero skips. This is
combined coverage from the actual runs below, not a claim that one fresh command ran all 62.

| Evidence group | Passing cases |
| --- | ---: |
| Unchanged Chromium head/lifecycle/renderer cases from the stopped attempt | 9 |
| Current trace controls: eleven pure cases plus one actual causal proof per browser | 24 |
| New Chrome head/lifecycle/renderer cases | 9 |
| New default flows: ten per browser, including enabled F9 and fixed F13 | 20 |
| **Total unique current cases** | **62** |

Luna's remaining run window was **19:16:38–21:02:13 UTC**. It ran one worker serially, with explicit
`PERF_RUNS=10`, `PERF_WARMUP=1`, `PERF_SAMPLES=60`, N1, and the guarded throwaway local API stack.
Parent independently matched every ledger case to the current inventory and its passing log;
checked all **18 raw flow reports / 46 rows / 114 statistic distributions**; recomputed all frozen
source/output file hashes; and verified closed ports and helper removal. Prior unchanged tests were
reused explicitly; the first failed attempt remains preserved separately.

**Final F13 observations, MiB after GC.** Each browser executes **460 accepted edits**: ten cold
cycles, one discarded plus one measured warm cycle, and one discarded plus ten measured repeat-use
cycles, with twenty edits each. Cold includes initial module/runtime loading. Warmed heap growth
remains observable; collection controls do not imply zero runtime allocation or an accepted budget.

| Browser | Cold entry→final | Warm baseline→final (growth) | Repeat-use baseline→final (growth) |
| --- | --- | --- | --- |
| Chromium | 1.420696→11.946022 | 10.333721→10.681038 (+0.347317) | 10.319809→11.942627 (+1.622818) |
| Chrome | 1.501961→11.981918 | 10.302124→10.713020 (+0.410896) | 10.331684→12.060497 (+1.728813) |

All eleven warmed repeat-use resource samples are constant within each browser: Chromium nodes
614, Chrome nodes 608, both documents 2/listeners 57. Cold Chromium node samples vary between
608 and 614 after first use; Chrome remains 608. These are not cross-configuration equality claims.
The independent lifecycle/overlap controls establish retired owner collection and survivor state.

**Final F9 local receipt observations, median / p95 ms.** Every state has ten samples for each of
Saving-label DOM update, parsed durable receipt and Saved-label DOM update. Wire bytes are 29,594.
Both pre-submit exclusion and delayed-receipt controls pass; no production-service target is accepted.

| Browser | Cold receipt | Warm receipt | Repeat-use receipt |
| --- | --- | --- | --- |
| Chromium | 226.65 / 232.735 | 231.50 / 241.965 | 209.35 / 250.680 |
| Chrome | 107.85 / 108.800 | 108.30 / 110.780 | 103.60 / 111.195 |

The ordinary delayed-rAF proof retains all **180/180 delayed inputs per browser**, with nine proxy
presentations and 171 supersessions. Baseline/delayed p95 is 53.04/358.42 ms in Chromium and
16.00/97.90 ms in Chrome. These handler-clock observations remain distinct from the causal trace proof.

**Runtime disclosure.** Apple M2 / 16 GiB, Darwin 24.6.0, Node 26.7.0, Playwright 1.63.0, AC power
88% charging→100% charged and Low Power Mode 0. Actual binaries are Chromium 153.0.8010.12 and
Chrome 155.0.8059.85; the Desktop Chrome context profile reports a 153.0.8010.12 UA in both row
labels. Reviewed trace health identifies Chromium Vulkan SwiftShader and Chrome Apple M2 Metal;
the paths are not GPU-equivalent, and the full flow run did not instrument renderer health per row.
Chromium flows take about 1.4 h versus Chrome 18.4 min. Chromium F7 frame p95 is 100/116.6/100 ms
for cold/warm/repeat-use, with median durations 42.30/47.84/38.40 s to meet the frame floor; Chrome
is 16.7 ms p95 and about 10.07 s per run. Functional passes do not accept these performance rows.
No reference calibration median was supplied; calibration totals 54.10/48.35 ms are developer observations.

Source freeze remains **528 editor/shared files**, aggregate
`5cbbf622d0e024c28baa255c1c3c584532b1609650e3de140a386424cb2a0022`, plus 25 API source/config/migration
files, combined **553** aggregate `2a79c7d7ddef5f44cd7f67f340d47bc77a3eb21019523b5edfbf0a9de1da16ea`.
All 118 ordinary output files remain byte-identical, aggregate
`f49ca0d451b147670f1edb70cd1d0d727ef121ddaedbfc8ac2eac53923a947f7`. No product rebuild occurred.
PostgreSQL/API/preview/browser resources are closed, the temporary helper removed and ports
43993–43995 closed. At that evidence-session point, no commit, push, slice close-out, owner
acceptance or merge had been performed.

Final evidence: `/tmp/pr180-final-matrix-evidence.md`; per-case ledger
`/private/tmp/pr180-final-matrix-rerun/coverage-ledger.csv`; all new logs/raw reports/manifests and
power/cleanup records under `/private/tmp/pr180-final-matrix-rerun/`. Parent's independent audit:
`/tmp/pr180-parent-final/final-matrix-independent-review.json`, reproduced by
`/tmp/pr180-parent-final/verify_final_matrix.py`. The unchanged repository/API gates above and
the separately affected trace verification together cover the final source.

**Historical original repository gate:**

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

These gates describe the earlier reviewed patch. The final combined gate above supersedes them;
earlier green counts alone did not validate new source. No root lane collects the Playwright flows.

Parent independently rechecked the static public and Preview source gates on 2026-10-23 after the
renderer wiring: both passed (2 public files / 12 visitor files), with no static ownership leaks.
`git diff --check` also passed. The final combined gate above subsequently passed.

**Parent final product-patch gate (2026-10-23).** Check passes with 0 errors / 0 warnings; full editor
suite passes **175 files / 2,263 tests**; arch **21 / 172**, heavy **8 / 118**, S01 integration
**6 / 88**, static public/Preview **2 / 12 files**, and the isolated bundle regression **1/1**.
Strict checking over all 24 perf TypeScript sources and seven pure trace controls also pass. The new
head test initially shadowed DOM `document` with its envelope local; the test-only rename fixes
strict checking without changing the product or previous lane results.

Both mapped and restored ordinary production builds pass. However, the real mapped
`--forbid '/p/[publicationId]=src/lib/authoring/'` check refuses source attribution: generated env
and start-entry chunks have empty maps. This is a remaining executable-proof gap, not an authoring
module hit. The fail-closed guard remains intact; the supported attribution repair below has passed
targeted and final integrated controls before matrix release. Exact gate results/logs: `/tmp/pr180-parent-final/`;
coherent mapped copy and gap JSON: `/tmp/pr180-parent-final/mapped-diagnosis/`. No final source-absence
success is claimed from that refused check.

**Real-build module proof repair.** An opt-in `BUNDLE_PROVENANCE=1` build records Rollup's actual
chunk module IDs and facade ID, checking each against the module graph. It binds exact final JS
hashes and the complete client JS inventory. Explicit `--provenance` selects this trusted build
artifact; missing/empty CLI selection, malformed/stale/partial/edited evidence and module-less
route assets refuse rather than fall back. Ordinary builds emit no sidecar. The integrity digest
does not authenticate an artifact producer capable of replacing and resealing all evidence.

On coherent actual mapped output, authoring absence passes with **233 module identities** and
known visitor presence refuses **11 hits**. Maps-only proof still refuses those generated empty maps;
the ordinary no-evidence check also refuses. Real edited/injected identity and stale-JS controls
fail closed. Module identity is reported separately from incomplete source-map byte attribution;
Rollup identities do not manufacture package byte ownership. Plugin and Node regression controls
cover complete inventory, facade/asset distinction, graph IDs, missing/empty source evidence,
additional/missing/stale JS, malformed records and edited identities. Targeted check/build/arch pass;
the parent integrated gate also passes after the final CLI edge correction.

Evidence/commands: `/tmp/pr180-bundle-final-evidence.md`; coherent output and control reports:
`/tmp/pr180-bundle-final/output-final` and `/tmp/pr180-bundle-final/`. The old partial output directory
is superseded. All implementer runtime resources are closed and ordinary shared output restored
before parent verification. Current reproduction from the repository root:

```sh
BUNDLE_PROVENANCE=1 npm run build -w @portfolio/editor -- --sourcemap
node apps/editor/perf/bundle-report.mjs \
  --provenance apps/editor/.svelte-kit/output/client/bundle-provenance.json \
  --forbid '/p/[publicationId]=src/lib/authoring/'
npm run build  # restore ordinary production output
```

**Review correction validation (2026-10-23; reviewed head `ca2aa4c99b69fb010b9c2e2dfc180387d2752503`
plus the working patch).** `node --test apps/editor/perf/bundle-report.test.mjs` passed its isolated
fixture regression: known-present rejection, known-absent success with maps, unavailable evidence
(missing/partial/empty maps or a missing emitted JS file), and file-only checks without maps.
The focused Chromium lifecycle regression passed (1 test, 18.0 s): three open/edit/discard/close
cycles preserved the same realm and all three retained arrays after harness-buffer cleanup;
post-GC heap grew 19.00 MiB. A full-navigation negative control erased the arrays and changed the
time origin. This is an intentional-retention sensitivity proof, not a product leak measurement.
Raw browser diagnostics are at `/tmp/pr180-sol-lifecycle-edited.log`; no owner baseline is claimed.

The final ordinary-build Chromium run passed **2 tests in 14.3 m**: F13 completed 22 cycles
(including the discarded warm-up), with 20 accepted edits per cycle, and the retained-state regression
passed. Every F13 cycle kept its sentinel and time origin. Raw results:
`/tmp/pr180-sol-f13-final-clean/2026-10-23T05-40-48-299Z-f13-cycles-chromium.json`;
runner log: `/tmp/pr180-sol-f13-final-clean.log`.

This was functional validation on Apple M2 / 16 GiB, Darwin 24.6.0, Node 26.7.0,
Chromium 153.0.8010.12, N1, 1920×1080 @ DPR 1, CPU 1×, with **power state not recorded**.
Other focused verification overlapped part of the run. These diagnostic observations are not an
owner-operated reference baseline or a budget disposition:

| F13 diagnostic state | Post-GC baseline → final; growth |
| --- | --- |
| Cold entry, then ten cache-cleared client cycles | 1.42 → 35.93 MiB; +34.51 MiB |
| Warm, one measured cycle after one discarded cycle | 13.27 → 16.03 MiB; +2.77 MiB |
| Repeat-use, ten client cycles | 1.41 → 35.90 MiB; +34.50 MiB |

The corrected lifetime revealed a rising heap trend. Passing the flow's
functional assertions does **not** mean the F13 leak budget passes. No replacement accepted baseline
is claimed.

**Retention attribution and repair (2026-10-23).** Parent heap snapshots
identified a strong path from Three r186's module-scoped `DFG_LUT` texture through its dispose
listeners to retired renderer contexts, canvases and Stage DOM. In a diagnostic control after three
client-side cycles, disposing that actual texture through its public API reduced post-GC heap from
19.08 to 10.77 MiB and DOM nodes from 13,325 to 597. This control establishes the retained owner; it
does not by itself validate a concurrent-Canvas repair. Raw evidence and the corrected strong-path
analysis are in `/tmp/pr180-memory-investigation/diagnosis.md` and
`/tmp/pr180-memory-investigation/dfg-control.log`.

The product correction owns observed shared textures per renderer through public material and
texture APIs. It restores the original render function after lookup discovery and does not reset
survivor state. All four Canvas sites use it. The public chooser-element File/DataTransfer upload
also avoids Playwright 1.63's extra retained setInputFiles handle. Dimensions callbacks use one
lifetime-owned plain controller reference, guarded across async completion and native blur during
inert-branch teardown. There is no warning suppression, private listener mutation or node_modules
patch.

Repository revalidation also passed: check (0 errors/warnings), full editor suite (173 files /
2,246 tests), arch (21 / 172), heavy (8 / 118), ordinary build, API check, and DB-backed API tests
(80 tests / 11 suites / 0 skips). This task's API run used the isolated temporary database
`pr180_sol` on loopback port 43994; the cluster was stopped and removed. Both static surface checks
passed (2 public / 12 visitor files). The initial concurrent full suite timed out in the 5-second
documentation scan; the full suite and arch passed on rerun.

Earlier preview attempts invalidated by concurrent rebuilds, and superseded interrupted runs, provide no measurement
evidence. The ordinary production build was restored. An earlier harness TypeScript check used a
check-only `ImportMeta.dirname` declaration. The final working patch instead uses the equivalent real
`dirname(fileURLToPath(import.meta.url))` path, and strict checking needs no declaration shim.
An existing optional-delay narrowing in the shared flow helper was also made explicit.

**Memory correction validation.** Ordinary production build; Chromium 153.0.8010.12; Apple M2,
16 GiB; Node 26.7.0; 1920×1080 DPR 1; CPU 1×. Lifecycle/overlap correctness uses N0 and the full F13
uses N1. Power/thermal state was not recorded; the old report header's default text is not an actual
power declaration. These are agent-operated pre-flight observations.

- 47 focused tests pass across the full renderer, Dimensions lifetime, precision adapter and Wall
  manipulation contracts. Check reports 0 errors / 0 warnings; ordinary build and strict perf
  TypeScript check pass. The final combined repository gate above subsequently passed.
- Six browser regression cases pass: 70 accepted precision edits emit zero `derived_inert`, page or
  shader errors; every retired Stage/canvas is collectible. Four real-WebGL overlap cases keep
  identical survivor pixels and target/face/mip/viewport/scissor state while every secondary
  Canvas/renderer/scene collects. Their DOM counts remain exact. The last-owner-only mutation fails
  all four overlap cases; the inert-derived blur mutation fails its focused removal case.
- Warm plus six cycles of ten edits gives post-GC heap 9.917961→11.099640 MiB (+1.181679), with
  documents 2 and listeners 57 throughout. The earlier parent control was 10.65→25.19 MiB (+14.54),
  but warmed with two edits rather than this regression's ten. This is not an exactly matched timing
  or population comparison. Native DOM totals still rise 596→602, one per measured cycle.
- Full F13 passes functionally in 14.9 minutes, including 440 accepted edits and same-realm guards.

| Corrected F13 state | Raw hub/warm baseline → final; growth | First closed Stage → final, where applicable |
| --- | --- | --- |
| Cold entry, ten cache-cleared client cycles | 1.466946→11.818649 MiB; +10.351704 | 10.238880→11.818649; +1.579769 over the remaining nine transitions |
| Warm, one measured cycle after a discarded twenty-edit cycle | 10.234512→10.469620 MiB; +0.235107 | Already warmed |
| Repeat-use, ten client cycles | 1.405914→11.741978 MiB; +10.336063 | 10.252331→11.741978; +1.489647 over the remaining nine transitions |

The first Stage/module load is included in the raw cold-entry growth. Neither raw growth nor the
first-cycle-adjusted values establish the 5 MiB hard leak budget. After the first Stage, documents
stay 2 and listeners 57; total native DOM nodes rise 596→605. The small native-node owner was
subsequently attributed to Svelte's head anchor, below; these historical totals must not be called flat. Exact retired
Stage/Canvas ownership is established by the collection controls, not a tuned heap threshold.

Raw F13 report (independently checked by parent):
`/tmp/pr180-memory-f13-final/2026-10-23T17-09-07-306Z-f13-cycles-chromium.json`.
Full unrounded samples and hashes: `/tmp/pr180-memory-final/`; browser logs:
`/tmp/pr180-memory-lifecycle-final.log`, `/tmp/pr180-memory-f13-final.log`. Ordinary client manifest
SHA256: `b3c3dd400cf16b117bb3c81c4d8aa559d1f2ec4e249a9be5747acdac9ef8c2fc`.
Implementer evidence and mutation controls: `/tmp/pr180-memory-final-evidence.md`.
All memory-implementer browser/preview resources are closed. This historical 440-edit run precedes
the final repeat-use discarded warm-up; the final workload is 460 accepted edits across all three
states. Entry and warmed-baseline heaps remain separately visible rather than hiding startup cost.

**Residual native-node attribution.** Parent independently ran four controls: empty create dialog,
starter project, source upload, and upload plus precision edits. After warming, six persistent
New Project/Back cycles added exactly six connected Text nodes in `document.head` in every case
(head children 43→49), with other connected node types, documents and listeners constant. Stage,
chooser and precision edits are therefore not necessary causes. Installed Svelte 5.56.4 leaves a
head anchor outside branch node ownership. The first fixed released stable is 5.57.0; its contained
dependency upgrade preserves the original per-route metadata architecture. Raw metrics, snapshots and strong-path analysis:
`/tmp/pr180-memory-residual/`; parent diagnosis: `/tmp/pr180-memory-residual/diagnosis.md`.

**Head correction validation.** The editor pins Svelte 5.57.0; the lock changes only Svelte and
removes its unused `@types/trusted-types`. Parent independently checked the locked-version diff
and installed upstream helper hash against the official artifact. Supported peers remain deduplicated;
no route metadata source was changed. The old-version empty-project control fails immediately:
native 311→312, head children 43→44, head Text 7→8.

Final head regressions pass **6/6, zero skips**, across Chromium 153.0.8010.12 and Chrome
155.0.8059.85 in 13.9 seconds. SSR/hydration includes all head-bearing routes, valid and invalid
publication URLs and concurrent request isolation. Dynamic escaped publication titles and noindex
update/reset correctly. In both browsers, empty-project connected nodes 98, head children 43,
head Text 7, documents 2 and listeners 44 stay exact across warm plus six cycles. Native bookkeeping
varies 311–313 without exceeding its 313 baseline. Repeated metadata navigation keeps head 54/Text 7.

The existing lifecycle regressions pass **4/4, zero skips**, in 3.0 minutes across both browsers.
Seventy accepted edits per browser keep native nodes **596**, documents **2**, listeners **57**,
head children **43** and head Text **7** exact at every baseline/retired-project sample. All retired
Stage/Canvas WeakRefs collect, without inert-derived, shader or page errors. Intentional retained
arrays remain detectable (14.13 / 14.31 MiB), and full document navigation erases them. This is
functional ownership proof, not heap-budget acceptance. Public contract 13/13, check 0 errors /
0 warnings and ordinary build also pass. All head-owned runtime resources were closed before
the parent repository gate. Evidence/commands: `/tmp/pr180-head-final-evidence.md`; logs:
`/tmp/pr180-head-final-source.log`, `/tmp/pr180-head-lifecycle.log`, `/tmp/pr180-head-control.log`.

**Trace diagnostic validation.** Branded headless Chrome 155.0.8059.85, Apple M2 / 16 GiB,
Node 26.7.0, Darwin 24.6.0, N0, 1920×1080 DPR 1, fresh contexts and S fixture. Power state was not
recorded; the owner was not operating. Eight tests pass in 13.4 seconds: one real-browser diagnostic
and seven focused trace controls. All 60 ordinary inputs match real JPEG identities, preview pixels,
trace marks and exact ALL presentation completions. With a 500 ms application-rAF delay, all 60 rows
remain: three matches and 57 explicit supersessions before overlay; final input 60 is matched.

The maximum input→trace-reported presentation is 45.914 ms ordinarily and 481.542 ms with delay;
final-input values are 42.746 / 481.542 ms. Screenshot-observation maxima are separately
32.365 / 483.714 ms. Both anchor discrepancies are zero. Captures retain 120 / 10 images at 498×280,
below the explicit 500 px / 450-image budget. The original six-pixel square correctly failed the
pixel check after downsampling; enlarging only the diagnostic square to 24 px enabled the actual
positive proof without weakening the rejection threshold.

Wrong identity and missing preview pixels produce zero matches. Actual trace mutations removing or
duplicating the exact completion, keeping PARTIAL-only feedback or adding a second host all return
null presentation time with explicit reasons. The product helper passes eight inertness/identity
tests. These observations validate the tooling and its refusals; they do not establish a product
budget or estimate trace overhead. Raw traces, decoded JPEGs and every input row:
`/tmp/pr180-trace-validation/trace-proof-chrome-1792776839799/`.
Evidence and commands: `/tmp/pr180-trace-final-evidence.md`; final browser log:
`/tmp/pr180-trace-browser-presentation.log`. All trace-owned browser/preview resources are closed.

**Corrected F9 local-stack validation (2026-10-23).** Both Chromium browser tests pass, zero skips,
using the same released ordinary client manifest above. Cold, warm and repeat-use each have ten
complete measured samples after one discarded warm-up. Apple M2 / 16 GiB / Node 26.7.0;
Chromium 153.0.8010.12; 1920×1080 DPR 1; CPU 1×; N1. Run-start power declaration: battery 74%,
discharging, Low Power Mode 0. These are agent-operated local-service pre-flight observations.

| State | Receipt median / p95 | Saving-label DOM-update p95 | Saved-label DOM-update p95 |
| --- | --- | --- | --- |
| Cold | 189.30 / 200.29 ms | 0.90 ms | 200.59 ms |
| Warm | 197.90 / 262.92 ms | 0.70 ms | 263.22 ms |
| Repeat-use | 187.85 / 261.87 ms | 0.75 ms | 262.12 ms |

Every row has ten samples for every milestone and a median encoded request body of 29,594 bytes.
Receipt is the same-page `save:submit` to project/operation-matched parsed `save:receipt` interval.
Label DOM mutations are not paint/presentation timestamps and cannot establish presented local
feedback. Ten-sample tails are coarse. The separate N0 delay control passes: a 2 s pre-submit wait
is excluded and delaying a successful response by 600 ms increases receipt latency. Exact browser
probe deltas were not printed; its assertions and the exact controlled-clock regression are the
proofs, not invented replacement values.

The guarded stack used only loopback API `43994`, preview `43995`, a generated test-auth secret,
in-memory object storage and temporary PostgreSQL on `43993`. `PUBLIC_API_ORIGIN` was supplied to
the preview's dynamic public environment. After closing API/preview, `npm run check:api` and
`DATABASE_URL=postgresql://postgres@127.0.0.1:43993/pr180_f9_api_gate npm run test:api` passed on a
fresh database: 80 tests, 0 failures, 0 skips across eleven file reports. Parent independently checked
the API summaries and that all nine F9 milestone distributions contain ten samples. API build also passed through that script.
The cluster, API helper, API, preview and browser resources were removed/closed before trace handoff.

Raw F9 report:
`/private/tmp/pr180-f9-results.retry2.hozC4E/raw/2026-10-23T17-20-40-438Z-f9-save-chromium.json`.
Evidence, exact commands, logs and typecheck config: `/private/tmp/pr180-f9-final-evidence.md` and
`/private/tmp/pr180-f9-results.retry2.hozC4E/`. No production service or receipt-target disposition is
claimed. The later full Chrome/Chromium flow coverage is recorded in the final combined validation above.

**Clean harness sequence (measured on `bfc4fc91`).** Built with `node perf/serve.mjs` (production `vite build`
plus `vite preview` on `127.0.0.1:4173`), then, from `apps/editor`:

```sh
PERF_BASE_URL=http://127.0.0.1:4173 PERF_RESULTS_DIR=/tmp/t3p03s02-final-matrix2 \
PERF_POWER_STATE="AC power, battery 15% charging, Low Power Mode off" \
PERF_API_ORIGIN=http://127.0.0.1:8792 E2E_TEST_AUTH_SECRET="$LOCAL_STACK_SECRET" \
  npx playwright test --config perf/playwright.config.ts --project=chrome
```

Result: **9 tests passed in 18.9 m**, one fresh preview server built from this tree, default counts
(`PERF_WARMUP=1`, `PERF_RUNS=10`, `PERF_SAMPLES=60`), F9 against the throwaway local Postgres
database `biskiq_t3p03s02_gate` and the API's test-auth seam on `127.0.0.1:8792` (never
production). The preview was built with `PUBLIC_API_ORIGIN=http://127.0.0.1:8792` so the shipped
Save transport reaches that local API. The retained historical rows below are from this one sequence; F9 receipt and F13 lifecycle
claims are withdrawn as stated below; no earlier number
is carried forward. A reduced-count smoke pass (`PERF_RUNS=2`, `PERF_SAMPLES=5`) preceded it and is
not cited here except as evidence that each new state executes. The current working patch changes F9 timing, F13 navigation/observation cleanup, and bundle
assertion behavior; the historical sequence does not validate those changes.

`PERF_BASE_URL` made the config reuse the already-running preview instead of building a second one.
The report header records platform, CPU, Node, power state and the commit; each row records the
browser/version string, cache state, network and CPU rate. Chromium (Playwright's managed build) was
exercised on an earlier tree; it was not rerun here, so this record does not claim a Chromium result
for these exact sources.

## Measured pre-flight rows (no budget accepted)

Machine: Apple M2, 16 GB, macOS 15.7.2, **on AC power with the battery at 15 % and charging**, Low
Power Mode off; Chrome 153.0.8010.12; 1920×1080 CSS at DPR 1; N1 (40 ms RTT, 20 Mbit/s down,
5 Mbit/s up; CDP takes bytes/s: 2,500,000 down / 625,000 up); CPU rate 1×. Values are the single clean sequence above. Percentiles with ten
milestone samples are coarse (often near the maximum).

| Row | Observed |
| --- | --- |
| F1 startup, stage **first architectural frame** cold / warm / repeat-use (rAF proxy; not first-interactive; median, p95) | 1,307.9 / 792.75 / 790.9 ms; 1,320.08 / 793.36 / 792.38 ms |
| F1 FCP / LCP cold; long tasks; script bytes | 120 / 384 ms; 0; 467,999 B; warm 80 / 116 ms and repeat-use 76 / 112 ms, script bytes 0 (cache hits) |
| F2 open S cold / warm / repeat-use (total median, p95) | 144.05 / 27.1 / 26.3 ms; 152.89 / 86.47 / 93.3 ms |
| F2 open M cold / warm / repeat-use (total median, p95) | 533.2 / 459.25 / 476.15 ms; 552.23 / 494.86 / 493.3 ms |
| F3 input→matching preview (n=600; median, p95, max) | cold 15.5 / 16.3 / 16.6 ms; warm 15.5 / 16.0 / 16.6 ms; repeat-use 15.5 / 16.3 / 16.6 ms |
| F3 status rows | every state: dispatched 600, rows 600, presented 600, superseded 0, unresolved 0, refused 0; latest-input age median 15.5 ms |
| F4 precision completion (n=10; median, p95) | cold 26.0 / 38.24 ms; warm 25.2 / 46.02 ms; repeat-use 36.1 / 49.07 ms |
| F4 commit completion (n=10; median, p95) | cold 41.6 / 51.6 ms; warm 25.35 / 49.86 ms; repeat-use 37.9 / 39.7 ms |
| F8 Undo / Redo completion (n=200 each; median, p95) | cold undo 29.5 / 30.5 ms, redo 29.4 / 30.6 ms; warm undo 29.9 / 30.5 ms, redo 29.7 / 30.4 ms; repeat-use undo 28.55 / 30.2 ms, redo 28.5 / 30.1 ms |
| F3 delayed-preview proof | 180 dispatched / 180 rows / 0 missed; 8 presented, 172 superseded; delayed p95 126.14 ms, max 149.8 ms vs baseline p95 16.2 ms, max 16.5 ms |
| F7 orbit M (frames; interval median, p95, p99; dropped >33.4 ms; long tasks) | cold 6,030 total / 603 per run; 16.7 / 16.7 / 16.8 ms; 0; 0. warm 6,030 / 603 per run; 16.7 / 16.7 / 16.8 ms; 0; 0. repeat-use 6,030 / 603 per run; 16.7 / 16.8 / 16.8 ms; 0; 0 |
| F9 Save (n=10; label DOM-update and receipt p95) | Prior Saving-label DOM-update p95: cold 0.96 ms, warm 1.06 ms, repeat-use 1.11 ms; Saved-label DOM-update p95: 101.57 / 100.77 / 100.38 ms; wire bytes: 29,594 in every state. Label mutations do not prove presentation. Historical receipt values withdrawn; corrected local-stack samples are recorded above. |
| F13 heap (baseline → final; growth) | **Withdrawn as lifecycle evidence.** The earlier full-document open/close cycles destroyed the JS realm and could erase retained modules/globals. Their flat heap cannot establish teardown cleanup. No replacement accepted baseline is claimed. |
| Calibration grid-7, 20 runs (total median, p95; compile / admission median) | 53.35 / 58.35 ms; 23.00 / 30.35 ms |

**F9 receipt evidence withdrawn.** The earlier durable-receipt values (cold / warm / repeat-use:
1,525.93 / 607.47 / 601.69 ms) came from an absolute `performance.now()` value sampled after the
saved-label poll, so they included project-open/edit setup and UI polling. They did not measure
`save:submit` to the matching successful Save acknowledgement. The harness now records the
successful acknowledgement on the same browser clock and subtracts the product's `save:submit`
mark. A controlled-clock regression exercises a long pre-Save gap and a delayed acknowledgement.
The first local-stack delay probe skipped because its API/auth prerequisites were absent. The guarded
isolated loopback reproduction subsequently passed; its replacement observations are recorded above.

**F7 frame floor and duration.** Chrome presented rAF at **60 Hz (16.7 ms) throughout this pass**,
so ten seconds produced about 600 frames. Every measured run cleared the 600-frame floor (603 in
every state) and finished in **10.07 s**, which the row records as its actual duration. The 600-frame extension path is retained for a slower display but was not
needed here. A 60 Hz frame clock makes the 16.7/33 ms budget numerically comparable, but this remains
a pre-flight observation, not an owner disposition.

**Historical bundle sizes (production build, cold first-load JS, brotli):** `/` 212.0 KiB,
`/editor` 211.2, `/projects` 214.8, Stage 376.6, visitor 300.6. These are earlier-tree sizes,
not replacement measurements for the working patch.

**Corrected bundle assertions (review checkout, 2026-10-23).** With a sourcemap build,
`--forbid '/p/[publicationId]=src/lib/visitor/'` exits 1 (10 matching modules), and
`--forbid '/p/[publicationId]=src/lib/authoring/'` exits 0. The ordinary build was restored;
its visitor source-path check exits 1 with `attributed=false`, no hits and `unavailable=true`.
Thus the earlier ordinary-build source-path absence success is withdrawn. `--forbid-file` remains
valid for emitted file-name checks without maps. The isolated Node regression covers known-present
and known-absent modules, missing/partial/empty maps, and file-only checks.

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

The hard-row table contains requirements and reproduction commands only. Observations belong to
the explicitly labelled pre-flight sections above. F1/F2 use the first-architectural-frame proxy;
the contract's first-interactive definition is still unmeasured. Only the owner-operated reference
event can give these requirements a disposition.

## Unrun and partially-run rows (criterion 3 inventory)

Rows below are unrun or partial; each names the reason and the command an owner would run. The last
row records a check that was rerun, listed only for completeness. Rows owned by another slice name
that slice rather than inventing a command here.

| Row not run or not fully run | Why | Owner command |
| --- | --- | --- |
| F1 contract **first interactive frame** (pointer handled within 50 ms) | Harness records the first architectural rAF frame after activation; it does not dispatch a pointer and test 50 ms handling. | `cd apps/editor && npx playwright test --config perf/playwright.config.ts --project=chrome flows/startup.spec.ts` plus an owner DevTools Event Timing/pointer probe. |
| F2 contract first interactive frame, mesh-build split, JS heap after GC | Same label gap; admission and first architectural frame are recorded, the mesh/heap probes are not. | `... flows/project-open.spec.ts --project=chrome`. |
| F3 native Wall drawing on S/M/L; M/L drag workloads; frame p95/p99; long tasks; preview solve time; release-to-final-result split; draw calls/triangles/GPU time; baseline presented-frame coverage | No native drawing feature ships in this slice; the methodology runs on the straight-Wall Dimensions drag at S only. No renderer counter probe. Separate image/exact compositor-feedback proof passes at S; ordinary baseline rows remain rAF proxies and the owner method disposition remains open. | `... flows/drag-correlation.spec.ts --project=chrome`; separate `... flows/trace-proof.spec.ts --project=chrome` per the deviation record. |
| F4 accept/install/mesh-rebuild split, M/L precision workloads, discrete responsiveness | Only command-to-presented-result completion is captured. | `... flows/drag-correlation.spec.ts --project=chrome` plus a trace split. |
| F5 object import/admission; F6 placement; F10 capture/Preview; F11 viewer cold load; F12 viewer navigation | These flows belong to their consuming slices (T2.P02, T3.P02, T4); this harness does not pre-build them. | Their consuming slice's harness; no command in this slice. |
| F7 S and L orbits, draw calls/triangles/GPU time, presented-frame trace | Only M runs here. Chrome reaches 603 frames per run in about 10.07 s; Chromium takes about 38–48 s median to reach its frame floor. No renderer counters; trace deviation applies. | `... flows/orbit.spec.ts --project=chrome` for S/L once fixtures exist; GPU probe/trace separately. |
| F8 recompile/admission split, discrete responsiveness | Only restored-result completion is captured. | `... flows/drag-correlation.spec.ts --project=chrome`. |
| F9 presented local feedback, main-thread blocking, serialize/hash split, upload/RTT/server split, production-service receipt | MutationObserver timestamps Saving/Saved label DOM updates, not presentation. Runs use the local test-auth stack on loopback; client marks do not split the other phases. | `... flows/save.spec.ts --project=chrome` against a controlled service, with server timing and separate feedback-frame proof. |
| Page INP from Event Timing | The ledger buffers event entries at a 16 ms duration threshold, but no row computes INP; per-operation completion is reported instead. | No in-repo command: a manual Chrome DevTools Performance / Event Timing probe at a stated threshold, recording the censoring limit. |
| F13 `renderer.info.memory` geometries/textures, live WebGL contexts, detached DOM nodes, viewer/Preview enter-exit cycles | The shipped Stage exposes no renderer probe; viewer/Preview cycles are not in this slice. | `... flows/cycles.spec.ts --project=chrome` plus a renderer probe; viewer/Preview in their slices. |
| L and XL workloads; S orbit; M/L drag; Safari and Firefox | Implemented S/M flows pass in Chromium and Chrome; these additional workloads/browsers were not run. L/XL fixtures are not built. | `PERF_RUNS=10 PERF_SAMPLES=60 ... --project=<browser>` per flow/workload. |
| Calibration reference median | Owner-operated reference machine only; no `PERF_REFERENCE_CALIBRATION_MS` was supplied. | `... flows/calibration.spec.ts --project=chrome` on the designated MacBook Air M2. |
| Per-row source/output hashes, actual browser binary and display Hz | Final source/output hashes and power are globally recorded. Browser row strings are profile UAs; actual binary versions are recorded separately. Physical display Hz is not probed; rAF intervals are measured. | Owner records per-row provenance when producing reference rows. |
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
  recorded in the row's limitations. This pass measured delayed p95 126.14 ms / max 149.8 ms against
  baseline p95 16.2 ms / max 16.5 ms; 8 of 180 delayed inputs presented and 172 were superseded,
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
- Cold now follows the contract literally: a **new browser context per measured run**, not one
  context with `Network.clearBrowserCache` between runs. The independent review caught the earlier
  shortcut, which could not reset the renderer's V8 code cache. Cold rows moved accordingly (F1
  1.14 → 1.31 s, F2 S 83 → 144 ms, F2 M 459 → 533 ms); warm and repeat-use are unaffected, and F13's
  ten-cycle cold row still runs in one context because it measures growth across those cycles.
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
review          DEVELOPER PASS — parent source/correction and combined62-case evidence review complete; slice acceptance is owner-override
trace           image/feedback and causal real-positive/zero controls verified both browsers; owner method disposition remains open and unratified
hard rows       owner-operated reference rows remain unrun (E6); no budget accepted here
calibration     reference median not recorded; other machines cannot claim equivalence yet
GPU             draw calls, triangles and GPU time/memory unrun; separate trace-image proof demonstrated
F13             renderer/head repair and final460edits/browser verified; warmed growth recorded; no owner disposition
workloads       L and XL, S orbit, M/L drag, Safari, Firefox, viewer F11/F12, Preview F10 unrun
save            old receipt values withdrawn; final both-browser local-stack/API checks pass; never a production service baseline
```

## Self-check

```text
acceptance    prior criteria 1–5 verification remains historical; F9 receipt/F13 lifecycle claims withdrawn; no replacement baseline claimed
tier          PASS — final integrated gate above, including repaired real-build source proof
save timing   PASS — controlled-clock regression 3/3 and final local-stack browser tests 2/2 per browser, zero skips; labels explicitly DOM updates
scope         PASS — workflow plus measured-defect lifetime repairs; no new product feature
isolation     PASS — Playwright flow specs stay outside Vitest/root gate collection; ordinary builds emit no provenance or measurements
cache         PARTIAL — F13 preserves app lifetime; other repeat-use rows reuse cache through full document navigation
labels        PASS — F1/F2 rows are first architectural frame (rAF proxy), never first interactive
inventory     PASS — every unrun, partial and out-of-slice row is named with its reason and owner command
correlation   PASS — association/refusal/causal hold+zero proofs and final default flow cases verified
bundle        PASS with explicit Rollup provenance — real known-present/absent controls; unavailable evidence fails closed
hygiene       PASS — diagnostics are explicitly gated and artifacts stay outside Git; no temporary source edits remain
owner-run     UNRUN — hard baseline and calibration rows remain unclaimed under the owner override
trace         TOOLING PASS — association/refusal/causal controls pass; no trace option is ratified
review        DEVELOPER PASS — final source/evidence review recorded; owner acceptance is `owner-override`
```

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P03.S02 (2026-10-23)
final-gate artifact retained live: acceptance.md (phase-close evidence)
prose compacted:                 1   review-handoff.md → stub + exact Git recovery
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
historical anchor:               eabd4b888974127d891cedf840e5e056ad0c016a · tag closed/T3.P03.S02 (pushed)
manual-owed/unrun rows:          retained as unrun; no hard budget or calibration claimed
new live → archive prose links:  0
required merge method:           P1 merge c1e4e030; anchor ancestry and full handoff recovery verified 2026-10-23
P03.S01 post-merge anchor:        verified 2026-10-23 against PR #176 merge 55683981; tag peels to
                                  f77d55542806ca66903bc6d880884b1b3ef60ef2 and `git show` recovery resolves
phase state:                     closable; owner phase-close decision remains pending
```
