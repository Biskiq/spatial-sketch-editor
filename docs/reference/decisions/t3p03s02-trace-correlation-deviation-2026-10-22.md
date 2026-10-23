# T3.P03.S02 — trace-correlation deviation decision

**Status: proposed — owner decision required. Not ratified, not accepted.**
**Date:** 2026-10-22 · **Implementation update:** 2026-10-23 · **Slice:** T3.P03.S02
**Plan:** [measurement workflow and final gate](../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md)
**Contract:** [browser performance and delivery](../components/performance.md)

## What the plan asks

Scope 2 requires continuous inputs to be correlated with **the presented frame in
the trace**. The performance contract requires a matching preview and states that
a lone rAF callback is not proof of presentation. Building the diagnostic below
implements work already requested by scope 2; it does not amend that contract or
ratify acceptance of its remaining limits.

## Ordinary timing measurements

The ordinary harness carries monotonic input sequences through preview installation
and records overlay changes. Its ledger pairs an overlay change with a later rAF
scheduling opportunity. `playwright.config.ts` keeps Playwright tracing off.
These rows remain an **rAF approximation**, not traced-image presentation evidence.
The existing 500 ms rAF-delay proof preserves every input and exposes delayed work;
it alone does not establish matching pixels or the hard presentation gate.

## Separate Chrome image-identity diagnostic

`perf/flows/trace-proof.spec.ts` records a real Chrome CDP trace independently of
ordinary measurements. Playwright's own trace setting remains off; CDP
`Tracing.start` explicitly enables screenshot, User Timing and compositor events.

- A separate runtime `traceProof` flag enables a visual identity in the same SVG
  update as the actual Wall preview. The identity contains the installed input
  sequence and a signature of the actual overlay geometry. A 24 CSS-pixel magenta
  square is attached to the actual preview marker's transform. Both flags are
  required; ordinary UI and ordinary untraced timing runs render neither diagnostic.
- The decoder reads JPEGs from trace `Screenshot` events after tracing stops. A
  match requires the exact decoded sequence/signature, the corresponding product
  overlay mark in the trace, the installed preview, its marker pixel at the expected
  geometry and causal order. A nearest timestamp or unrelated token is insufficient.
- Each image retains `source_id` and `frame_sequence`. The tooling joins these
  exactly to `PipelineReporter.frame_source/frame_sequence`, retaining reporter
  states, layer-tree identities and raw events. An additional resolver requires
  one host, one nonforked `STATE_PRESENTED_ALL` reporter and an unambiguous span
  completion. It handles complete `X` spans and scoped async `b/e` identities,
  respecting ID reuse. Missing/duplicate completions, PARTIAL/forked-only reports,
  missing hosts and ambiguous hosts/full reporters yield null presentation time.
  The final-input control requires this exact image and presentation association.
- Every real pointer sample retains a row: matched, refused, superseded before
  overlay, overlay not captured, installed but not rendered, unresolved, or image
  identity only with an unsupported clock. A missing trace screenshot does not
  prove that an already submitted overlay was superseded or never displayed.
- Two exact User Timing anchors normalize trace microseconds to the page clock;
  anchor discrepancy is reported and inconsistent clocks fail. Normalized
  `event.timeStamp`, handler time, installation and overlay times remain separate.
  Modern supported image rows report `screenshotEventTimeMs`,
  `inputToScreenshotEventMs` and `latestInputAgeAtScreenshotEventMs`. Legacy or
  unknown screenshot clocks retain image identity but leave screenshot-event
  latency null with a reason. Separately, `traceReportedPresentationTimeMs`,
  `inputToTraceReportedPresentationMs` and
  `latestInputAgeAtTraceReportedPresentationMs` use the exact ALL span completion.
  Chromium supplies presentation-feedback time to that span's termination. This
  reports the earliest captured matching frame with unambiguous feedback, not
  proof that no earlier uncaptured matching frame existed. Physical display time
  stays null. Mismatched identities and absent preview pixels produce no match.
- The diagnostic retains an untraced control, an ordinary traced drag and the
  historical globally delayed-rAF condition. Each dispatches 60 real pointer
  moves. Their independent-context maxima are observations, not a causal oracle:
  global rAF delay can reduce unrelated renderer load and invert those maxima.
- A separate harness-only frame gate forwards callbacks normally during setup,
  then captures/cancels every pending application rAF after tracing begins. It
  holds all 60 real input installations, seals after the final installed preview,
  observes at least 500 ms on the page clock and explicitly releases callbacks.
  Exact gate marks must match trace-clock milestones; every overlay, matching
  image and matching ALL completion must follow release. The delivered final
  latency must include that held interval. All 60 rows remain explicit, including
  inputs superseded before overlay. Pending callback cancellation and disposal
  have deterministic controls.
- A real zero-hold gate condition must fail that same oracle despite any unrelated
  rendering delay. Synthetic missing/early release, zeroed delay and early overlay,
  image or presentation controls also fail even with very large delivered latency.
  The 900 ms final-preview hold after release is workload for trace sampling,
  never evidence. No cross-run percentile/window selection replaces the oracle.

## Timing, perturbation and platform limits

Modern Chrome emits `Screenshot.ts` in `OnFrameFromVideoConsumer` after obtaining
the bitmap. This is a **screenshot-event observation time**, not the image's exact
capture instant; consumer and delivery latency may be included. Chrome describes
`expected_display_time` as an estimate derived from a previous frame start and
vsync interval. The diagnostic retains it raw and never substitutes it for actual
presentation. Legacy screenshot timestamps are documented as incorrect and are
not used for screenshot-event latency. Chrome's exact compositor feedback span
provides separate trace-reported presentation evidence; it does not independently
verify physical display scanout, particularly in headless operation.

The trace, visual identity, diagnostic square and extra marks perturb this
separate flow. Image decoding occurs afterward. The single sequential untraced
control and traced observations disclose elapsed work; they do not estimate trace
overhead, calibrate it away or change the ordinary baseline. No hard presentation
budget or owner-operated reference acceptance follows from these diagnostic rows.

Screenshot capture requests the supported default budget of maximum 500 pixels
and 450 images, records actual dimensions/counts, rejects cap exhaustion and
requires a final-input image. Intermediate images may still be omitted. Raw
traces, decoded JPEGs, every input row, clock normalization, exact compositor
reports and negative controls remain outside Git.

Primary sources: [Chrome trace protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json),
[Chrome screenshot schemas](https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/trace/types/TraceEvents.ts),
[Chrome screenshot handler](https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/trace/handlers/ScreenshotsHandler.ts),
[Chromium trace screenshot implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/tracing_handler.cc),
[compositor span termination](https://raw.githubusercontent.com/chromium/chromium/main/cc/metrics/compositor_frame_reporter.cc)
and [presentation-feedback source](https://raw.githubusercontent.com/chromium/chromium/main/cc/metrics/compositor_frame_reporting_controller.cc).

## Local implementation evidence (2026-10-23)

Branded headless Chrome 155.0.8059.85, Apple M2 / 16 GiB, N0 loopback,
1920×1080@1, fresh contexts and S fixture: the ordinary diagnostic matched all
60/60 inputs to images and unambiguous ALL completions. The 500 ms application-rAF
delay retained all 60 rows, matched three previews and classified 57 inputs as
superseded before overlay. The final input remained matched. Maximum
input-to-trace-reported presentation was 45.914 ms ordinarily and 481.542 ms with
the delay; these are **diagnostic observations**, not baseline or budget results.

The runs retained 120 and 10 images, respectively, all 498×280, below the 450-image
cap; both clock-anchor discrepancies were zero. Mismatched identity and absent
preview-pixel controls produced zero matches. Mutating the real trace to remove or
duplicate its exact completion, retain only PARTIAL feedback, or add a second host
produced null presentation time with explicit refusal reasons. Seven focused trace
controls and the browser diagnostic passed. Power state was not recorded and the
owner was not operating, so this does not constitute reference-machine acceptance.
Artifacts were retained outside Git; shared acceptance records own the evidence
location and final repository gates.

## Causal-control correction after Chromium integration evidence

A subsequent Chromium 153.0.8010.12 integration run preserved all 60 matching
images/presentation associations and consistent clocks, but invalidated the old
independent-context maxima comparison: ordinary trace maxima were 883.859 ms
for screenshot-event observation and 1174.147 ms for reported presentation,
versus 423.102 ms and 422.944 ms with global rAF delay. The ordinary traced drag
took 25.873 s. Those timings remain evidence, not samples to filter or retune.
The global delay also reduced renderer work; its final installed preview waited
only about 336 ms for a residual delayed callback, not a guaranteed full 500 ms.

The causal gate above replaces that unsupported comparison. Chromium 153 and
Chrome 155 actual proofs passed, retaining all five conditions, exact image/ALL
refusals and every input row. The 500 ms gate observed 501.9 ms and 501.7 ms,
respectively, before release; final input-to-trace-reported presentation was
637.031 ms and 541.734 ms. Neither produced an overlay, matching image or matching
presentation before release. Their real zero-hold controls observed about 0.1 ms
and correctly failed the required-hold oracle. Eleven deterministic trace/gate
controls passed under each browser project. The synthetic high-baseline control
accepts a valid held interval even when an unrelated ordinary maximum is larger,
and refuses bypasses despite arbitrarily high incidental latency.

A harness observer reuses contexts returned by the existing Canvas getContext
calls; it does not create another WebGL context or drain its error state. Current
validation recorded one connected WebGL2 context per condition, no loss or restore
events, SwiftShader in Chromium, and Apple M2 Metal rendering in Chrome. The
historical slow trace contains many long compositor/GPU tasks and software-renderer
draw events. This supports the rendering-load confound; historical context health
cannot be reconstructed from the new observer. No product optimization or ordinary
bundle change was made to force the diagnostic comparison. These remain developer
diagnostics, with physical display time null and owner acceptance separate.

## Reproduce and owner decision boundary

Build the ordinary editor, then run the separate diagnostic in branded Chrome:

```sh
npm run build
cd apps/editor
PERF_SKIP_BUILD=1 PERF_RESULTS_DIR=/tmp/biskiq-trace-proof npx playwright test --config perf/playwright.config.ts --project=chrome flows/trace-unit.spec.ts flows/trace-gate-unit.spec.ts flows/trace-proof.spec.ts
```

The configuration owns an isolated browser and local preview, closing them on
success/failure. Artifacts and the per-pass environment/limitations are written
to the declared directory. Review `diagnostic.json`, each `correlation.json` and
`chrome-trace.json`, and the exact matching frame JPEGs together.

The previous proposal's assertion that no trace pipeline existed is superseded
by this implementation. The remaining proposed decision concerns acceptance of
the documented observation/presentation limits and designated reference-machine
operation. The owner may require further presentation evidence or explicitly
accept a bounded deviation. **This record does neither.** The contract, hard
budgets and owner acceptance remain unchanged and unratified by this document.
