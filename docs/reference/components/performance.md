# Browser performance and delivery

**Status: proposed destination for PR #173 owner review, 2026-10-22; not yet ratified.**
This is the single proposed owner of performance profiles, workloads, metric definitions and
budget tables. No harness is installed and no browser/GPU/reference-laptop result is claimed.
The [review manifest](../../roadmap/product-convergence-2026-10-21-amendments.md) separates
ratification, permanent workflow authorization and production hold release.

Editor and viewer must remain useful on a regular laptop. Resolve demonstrated material costs
inside their consuming slices while preserving expressive architecture, correctness and one
canonical authority. Use established libraries where they justify their cost. Measurements cover
cold and repeated use, realistic project sizes and complete presented results, not just isolated
kernel time or a quick acknowledgement. Evidence and historical build/Node measurements remain in
[the research packet](../../../broad-research/post-p01-roadmaps/convergence-2026-10-21/performance-and-delivery.md).

## Reference baseline

**Reference laptop A — "regular x86 laptop" (primary for budgets).** 4-core / 8-thread mid-range
x86 at 15–28 W (Intel Core i5-1135G7 class), integrated **Intel Iris Xe** (80/96 EU),
**8 GB** dual-channel RAM (16 GB variant also recorded), 1920×1080 internal panel at 60 Hz,
**DPR 1.0**, Windows 11, balanced power plan, **on battery and on mains** (budgets are judged on
battery, the worse case). **Reference laptop B — Apple M1 MacBook Air, 8 GB**, 2560×1600 at DPR 2
(the renderer's DPR cap applies), macOS current, Safari and Chrome.

**Browser matrix.** Chrome stable (pinned major, recorded `chrome://version`) is **primary and
gating** on A and B. Safari (current, on B) and Firefox stable (on A) are **secondary**: they run
the same flows and must meet the *hard* gates for correctness-visible behavior (no context loss,
no unbounded long task, no leak) but report frame/latency numbers as targets. Edge inherits Chrome.

**Network profiles for the viewer cold load** (CDP `Network.emulateNetworkConditions`, applied
per request, cache disabled for cold):

- **N0 local** — unthrottled loopback (developer iteration only; never a gate).
- **N1 broadband** — 20 Mbit/s down, 5 Mbit/s up, 40 ms RTT. Gating profile for viewer and editor.
- **N2 constrained** — 1.6 Mbit/s down, 750 kbit/s up, 150 ms RTT (a proposed constrained profile). Reported for the viewer only; a target, not a gate.

**Reproducing on a developer machine (proposal; Not run).**

1. **Pinned browser:** Playwright-managed Chromium *and* branded Chrome stable (`channel: 'chrome'`),
   versions recorded with every result; Playwright's own browser cache, never the user's profile;
   a fresh persistent context per run; extensions off; `--disable-background-timer-throttling`
   off (default) so results match users.
2. **CPU calibration against the reference:** run a fixed calibration page (the `fixtures.ts`
   grid-7 compile + the Stage's admission, bundled exactly as production) 20× on reference A in
   Chrome, record the median; on the developer machine pick the CDP
   `Emulation.setCPUThrottlingRate` (1.5–4, step 0.25) whose median lands within ±10 % of A's.
   Recalibrate per browser major and per machine; store the rate with results. If no rate matches,
   report no calibrated equivalence and use reference hardware; do not extrapolate a pass. CPU throttling does
   not emulate GPU, memory bandwidth, or thermal behavior: **GPU, frame-time and GPU-memory gates
   are only accepted from reference hardware runs**; throttled developer runs are pre-flight.
3. **Fixed viewport/DPR:** 1920×1080 CSS at DPR 1 for A-equivalence; 1440×900 at DPR 2 for
   B-equivalence; window not occluded (a background tab throttles rAF).
4. **Cache states:** *cold* = new context + `Network.clearBrowserCache` + `clearBrowserCookies` +
   service workers none; *warm* = same context, second navigation (HTTP cache + V8 code cache
   populated); *repeat-use* = 10 open/close cycles in one context.
5. **Runs and statistics:** 1 discarded warm-up + **≥ 10 measured runs** per flow × workload ×
   cache state. Frame/input flows include **≥ 600 frames / ≥ 60 input samples per run**. Report
   sample counts, median, p75, p95, p99 and max, per-run values and run-to-run spread. A budget
   uses the statistic named in its row; timing milestones below use p95 unless stated otherwise.
   Pooling must retain every input's presented/superseded/unresolved status, not discard slow
   unfinished work. With only 10 milestone samples, p95/p99 are coarse tail estimates (often the
   maximum); report that limit rather than imply precise population percentiles. Report page INP
   separately from per-operation completion timing. Record SHA, build hash, workload id, browser,
   CPU rate, power state and display Hz.

## Representative workloads

Derived from the museum/pavilion use case and the first-wave slices. The measured grid fixtures
stand in for the Layout part until real pavilion fixtures exist; counts are per project.

| | **S — starter room** | **M — pavilion gallery (expected typical)** | **L — museum wing (expected maximum)** | **XL — stress (above max)** |
|---|---|---|---|---|
| Walls / Openings / Rooms | 4–24 / 4–24 / 1–9 (starter, grid-3) | ≈ 112 / 112 / 49 (grid-7) | ≈ 420 / 420 / 196 (grid-14) | ≈ 840 / 0–840 / 400 (grid-20) |
| Structures / datums / overheads (after CD-4) | 1 / 1 / 0–1 | 2 / 3 / 4 (roof, suspended ceiling, mezzanine slab, void) | 4 / 6 / 10 | 8 / 12 / 30 |
| Scene objects / distinct GLBs | 5 / 3 | 60 / 15 | 200 / 40 | 500 / 80 |
| Model bytes / triangles | ≈ 1 MiB / 30 k | ≈ 8 MiB catalogue-class (meshopt+webp, 200–550 KiB each) + 2 creator GLBs ≈ 15 MiB uncompressed with 2K maps / ≈ 600 k | ≈ 40 MiB / 1.5 M | ≈ 100 MiB / 3 M (incl. chandelier-class 100 k-tri models) |
| Texture bytes on disk / est. GPU | ≤ 4 MiB / ≤ 64 MiB | ≤ 48 MiB / ≤ 256 MiB | ≤ 128 MiB / ≤ 512 MiB | ≤ 300 MiB / > 1 GiB (expected to degrade) |
| Views / Presentations / Stops | 3 / 1 / 0–3 | 20 / 8 / 15 (S01 dense fixture) | 50 / 20 / 30 (S01 dense fixture) | 100 / 60 / 60 |
| Part annotations (CD-5/6) | 0 | 30 | 150 | 500 |
| Experiences | 1 | 1–2 | 2 | 4 |

Every flow runs **cold** and **repeated** (warm and repeat-use). S and M gate; L gates the hard
budgets marked "L" below; XL is report-only and must merely degrade gracefully (no crash, no context
loss, no single main-thread block > 1 s, an honest progress/refusal state).

## Complete user flows to measure

Each flow is a named sequence of `performance.mark`s from the product (the P23.11 helper's
successor, enabled only by a harness flag, never shipped as a dependency) plus CDP-derived input,
frame and memory data. "First interactive frame" = first presented architectural frame after
which a pointer event is handled within 50 ms; a lone rAF callback is not proof of presentation.

**Measurement contract (proposal; API constraints checked 2026-10-22).**

- **Continuous drag:** Event Timing excludes `pointermove`, `touchmove`, `wheel` and `drag`
  ([W3C events exposed](https://www.w3.org/TR/event-timing/#sec-events-exposed)). Assign a monotonic
  input sequence and normalized `event.timeStamp` to each sample; carry that sequence through
  coalescing, planner/worker output, preview installation and render submission. Correlate the
  render mark with the trace's presented frame containing that matching preview. Measure input
  timestamp → matching preview presentation, including queueing, solve, transfer and rendering.
  Record superseded inputs and the age of the latest presented input separately; dropping queued
  samples cannot turn unfinished work into zero latency. After the final input, measure time to
  its matching final preview. F3/F6 budgets bind delivered-preview latency, the age of inputs
  awaiting a preview during active input, and final-preview completion. An rAF-only estimate is
  labelled an approximation and cannot alone establish the hard presentation gate.
- **Acceptance and asynchronous completion:** correlate the command/operation ID and accepted
  revision with the first presented frame containing its final result. Record submission,
  accepted, installed and presented milestones independently. A spinner, acknowledgement or an
  unrelated next paint does not end the result-completion interval.
- **Discrete responsiveness:** use Event Timing for eligible clicks/taps/keys and report page INP
  separately. INP concerns next-paint responsiveness, not every eventual asynchronous effect
  ([INP definition and limits](https://web.dev/articles/inp)); it cannot replace either completion
  interval above. Enable a stated Event Timing threshold and report its censoring/rounding limits.

| # | Flow | Start → end marks | Metrics |
|---|---|---|---|
| F1 | Editor startup | navigation start (`/projects` or `/editor`) → hub interactive → Stage route first interactive frame on the starter | FCP, LCP, TBT/long tasks, JS bytes/requests per route cold+warm, first interactive frame |
| F2 | Project open | Open (hub card or Open JSON) → source admitted → first architectural frame → first interactive frame | admission (parse/validate/compile/runtime), mesh build, first render, JS heap after GC |
| F3 | Native Wall drawing (C1) | pointerdown → sequenced pointermoves → matching previews presented → pointerup → accepted revision presented | input-to-matching-preview latency, superseded inputs/latest-preview age, final-preview completion, preview solve time, frame time p95/p99, long tasks, release-to-final-result completion, discrete Event Timing separately |
| F4 | Wall/Opening edit (C1, precision) | typed value command → accepted → matching revision presented | command-to-final-result completion; accept + install + mesh rebuild split; discrete responsiveness separately |
| F5 | Object import/admission (C2) | file chosen → staged/validated → derivative ready → approved → placed → painted | main-thread long tasks during parse/decode/upload, worker time, peak JS heap, GPU memory delta, time to placed |
| F6 | Object placement (C2) | sequenced drag inputs → matching placed-object previews presented; duplicate/delete → matching accepted result presented | continuous input-to-matching-preview and command completion latency, picking time, frame time p95/p99 |
| F7 | Orbit/navigation (Stage) | 10 s scripted orbit + dolly + pan at S/M/L | frame time p50/p95/p99, draw calls, triangles, GPU time (EXT_disjoint_timer_query where available) |
| F8 | Undo/Redo | 20 alternating Undo/Redo after F3/F4 → each restored revision presented | command-to-restored-result completion, recompile/admission time; discrete responsiveness separately |
| F9 | Save | Save click → local feedback presented → durable receipt → idle | local-feedback latency, main-thread blocking, serialize + hash time, actual wire bytes, upload/RTT/server time, durable-receipt latency |
| F10 | Capture + Preview (T3.P02.S01) | capture View → bind Presentation (accepted result presented) → enter Preview → first preview frame → play Cut Guide → return | capture/bind result completion, discrete responsiveness separately, Preview chunk bytes (first and repeat entry), entry/return completion, frame time in Preview, history/selection intact |
| F11 | Viewer cold load | navigation start `/p/:id` → release fetched → first architectural frame (LCP-like) → first navigable frame → models streamed | TTFB, LCP, first-navigable, TBT, bytes by kind (JS/CSS/payload/models/textures) per network profile, compile/prepare time |
| F12 | Viewer navigation + Presentation | scripted guided travel, free look, Presentation enter/advance/exit, reduced-motion variant | frame time p95/p99, input latency, transition dropped frames |
| F13 | Repeated open/close (leaks) | Stage: open → edit ×20 → close to hub, ×10; viewer: enter/exit Presentation ×20; Preview enter/exit ×20 | JS heap after forced GC per cycle, `renderer.info.memory` geometries/textures, live WebGL contexts, detached DOM nodes |

## Budgets

**Hard** = must pass before the consuming slice's acceptance on reference A (Chrome), else the slice
resolves it (see [acceptance](#acceptance-and-workflow)). **Target** = reported, and a miss
needs a written disposition in the acceptance record. Continuous latency ends at the matching
preview's presentation; operation completion ends at the accepted result's presentation, as
defined above. Discrete Event Timing/INP is reported separately. Frame budgets use rAF-to-rAF
intervals on a 60 Hz display and do not substitute for matching-result presentation latency.

**Budget basis.** These are proposed Biskiq acceptance targets, not claims that browser
performance has already been measured on the reference hardware. The research packet retains
the measured Node/build evidence and its limitations.

| Flow / metric | S | M | L | Kind |
|---|---|---|---|---|
| Delivery: Stage route first-load JS (br, cold) | ≤ 400 KiB | same | same | **Hard** (no growth > 25 KiB br per slice without a recorded reason) |
| Delivery: visitor `/p` first-load JS (br) before first architectural frame | ≤ 250 KiB | same | same | Target now, **Hard** at T4 cutover |
| Delivery: landing `/` and hub `/projects` JS (br) | ≤ 80 KiB | — | — | Target |
| Delivery: Preview chunk (T3.P02.S01) | lazy; not in Stage first-load set | — | — | **Hard** |
| Delivery: editor-only/solver modules in visitor load set | editor machinery absent; runtime-safe solvers only where visitor execution requires them (named, justified) | — | — | **Hard** |
| Delivery: warm repeat visit JS transferred | ≈ 0 (immutable cache hits) | — | — | **Hard** |
| Editor startup F1: Stage first interactive frame, cold N1 | ≤ 3.0 s | — | — | **Hard** |
| Project open F2: data-in-hand → first interactive frame | ≤ 300 ms | ≤ 800 ms | ≤ 2.0 s | **Hard** S/M, Target L |
| Wall drag F3: input-to-matching-preview latency / latest-input age / final-preview completion p95 | ≤ 33 ms | ≤ 50 ms | ≤ 100 ms | **Hard** S/M/L |
| Wall drag F3: frame time p95 / p99; main-thread long tasks | ≤ 16.7 / 33 ms; 0 > 50 ms | ≤ 20 / 33 ms; 0 > 50 ms | ≤ 33 / 50 ms; ≤ 1 per drag | **Hard** S/M, Target L |
| Commit F4 (accept + install + mesh + final-result presentation), command-completion p95 | ≤ 100 ms | ≤ 100 ms | ≤ 200 ms | **Hard** |
| Undo/Redo F8, command-to-restored-result completion p95 | ≤ 100 ms | ≤ 100 ms | ≤ 200 ms | **Hard** |
| Per-edit Layout evaluation budget (compile + representation) for one pointer move | ≤ 4 ms | ≤ 8 ms | ≤ 16 ms | **Hard** M (applies wherever evaluation runs) |
| Orbit/navigation F7/F12: frame time p95 / p99 | ≤ 16.7 / 25 ms | ≤ 16.7 / 33 ms | ≤ 33 / 50 ms | **Hard** S/M, Target L |
| Draw calls (Stage and viewer) | ≤ 200 | ≤ 1,000 | ≤ 2,500 | Target (trigger for E-6) |
| Object import F5: main-thread long tasks during admission | 0 > 50 ms; none > 100 ms | same | same | **Hard** |
| Object import F5: chosen → placed (local file, excl. upload) | ≤ 2 s for 5 MiB | ≤ 5 s for 25 MiB | — | Target |
| Placement F6: input-to-matching-preview / completion latency p95; picking per event | ≤ 33 ms; ≤ 2 ms | ≤ 50 ms; ≤ 4 ms | ≤ 100 ms; ≤ 8 ms | **Hard** S/M |
| Save F9: main-thread work; local feedback presented p95 | ≤ 50 ms; ≤ 100 ms | same | ≤ 100 ms; ≤ 100 ms | **Hard** |
| Save F9: click → durable receipt p95 at N1 | ≤ 8 × B_wire / R_up + 2 × RTT + 500 ms | same formula | same formula | Target pending service baseline/owner acceptance |
| Capture/bind F10 final-result completion p95; Preview entry first frame (repeat / first use) | ≤ 100 ms; ≤ 300 ms / ≤ 800 ms | same | ≤ 200 ms; ≤ 500 ms / ≤ 1.2 s | **Hard** S/M |
| Viewer cold F11: first architectural frame (LCP-like) at N1 | ≤ 2.5 s | ≤ 2.5 s | ≤ 4.0 s | **Hard** S/M from T4, Target L; N2 reported |
| Viewer cold F11: first navigable frame at N1 | ≤ 3.0 s | ≤ 3.5 s | ≤ 6 s | **Hard** S/M from T4 |
| Viewer F11 first-frame payload (excl. JS) | ≤ 1.5 MiB | ≤ 4 MiB | ≤ 10 MiB | Target; rest streamed |
| JS heap after GC — editor, project open | ≤ 120 MiB | ≤ 200 MiB | ≤ 400 MiB | Target; **Hard** "no OOM/tab crash" at XL |
| JS heap after GC — after 100 edits (history full) | +≤ 30 MiB | +≤ 80 MiB | +≤ 250 MiB | Target |
| JS heap — viewer | ≤ 100 MiB | ≤ 150 MiB | ≤ 300 MiB | Target |
| GPU memory estimate (textures + buffers) | ≤ 128 MiB | ≤ 384 MiB | ≤ 768 MiB | **Hard** M on A 8 GB (shared memory) |
| Leaks F13: heap growth over 10 cycles (after GC); GPU resources | ≤ 5 MiB; geometries/textures back to baseline; 1 live context | same | ≤ 10 MiB | **Hard** |

**Save receipt proposal.** `B_wire` is the actual request-body byte count; `R_up` is the declared
upload bit rate in bits/ms and RTT is in ms. The formula explicitly allows upload time, two RTTs
for transport overhead and a proposed 500 ms local/server allowance; record those components and
confirm the allowance against the API before accepting a hard receipt gate. Production currently
sends the full canonical source as an uncompressed JSON PUT
(the current project persistence client). The ≤ 100 ms hard requirement concerns visible
local feedback that saving started, never a claim that durable storage has acknowledged it.

## Acceptance and workflow

Each consuming slice records hardware/profile, workload, browser/build/commit, cache and power
state, measured result, budget and disposition before its acceptance. Hard misses are resolved
inside that slice; targets require an explicit disposition. The phase final gate separately
rechecks integrated flows and cannot defer an earlier hard miss. T4-only rows bind the T4 cutover;
future vertical/part rows bind only their consumers, not the first batch.

Profile first. Remove duplicated work, qualify incremental invalidation, use bounded revision-keyed
caches, workers for whole pure stages, compiled derivatives and delivery splitting where measured.
Preserve one compiler and prove equal output for optimized paths with meaningful correctness
differentials. A worker must meet matching-result completion deadlines as well as main-thread
budgets; moving a slow solve off-thread alone does not establish timely results.

The permanent on-demand Playwright/CDP harness and bundle report require explicit owner
acceptance under [the test contract](../../../apps/editor/tests/README.md#correctness-tests-vs-performance-benchmarks).
They live outside default test lanes and add no CI timing gate, schedule or benchmark registry.
Equivalent manual DevTools measurements may supply evidence until the workflow is authorized,
with limitations stated. Existing public source-closure coverage already excludes all authoring
machinery; align the public and Preview build patterns without weakening that protection.

H0 prepares shared enforcement and measurement; C1 owns compile/admission deduplication and its
measured optimization experiment. Exact phase/slice registration and named release from the
production hold still precede implementation. Ratifying this contract alone releases no scope.
