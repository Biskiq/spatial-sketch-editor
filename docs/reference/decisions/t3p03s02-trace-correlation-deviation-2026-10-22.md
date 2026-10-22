# T3.P03.S02 — trace-correlation deviation decision

**Status: proposed — owner decision required. Not ratified, not accepted.**
**Date:** 2026-10-22 · **Slice:** T3.P03.S02 · **Plan:** [measurement workflow and final gate](../../roadmap/t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md)
**Contract:** [browser performance and delivery](../components/performance.md)

## What the plan asks

Scope 2 requires continuous inputs to be correlated with **the presented frame in
the trace**. The performance contract says the same: correlate the render mark
with the trace's presented frame containing the matching preview, and states
that a lone rAF callback is not proof of presentation. The hard presentation
gate therefore needs frame evidence, not only a frame-clock attribution.

## What this harness actually does

- `perf-marks.ts` carries a monotonic input sequence from `pointermove` through
  preview installation and the accepted result.
- The route marks `overlay:updated` only when the painted marker set changes;
  the ledger pairs that mark with the first `requestAnimationFrame` tick at or
  after it.
- `apps/editor/perf/playwright.config.ts` keeps `trace: 'off'`. No trace
  artifact is produced, and no screenshot or frame image is correlated with a
  mark.
- The delayed-preview proof shows a 500 ms injected delay as latency rather than
  a dropped sample. That proves the ledger keeps every input; it does not prove
  which pixels were presented.

This is an **rAF approximation**, not the plan's traced-image correlation. It is
adequate for methodology pre-flight and for the delayed-sample property, but it
cannot establish the hard presentation gate.

## Why a trace proof was not built in this pass

A time-only mapping from a mark to the next Playwright trace screencast frame
would be a second approximation, not the required proof:

1. Trace screencast frames carry capture timestamps, not the product's input
   sequence. Selecting the first frame after a mark does not prove that frame
   contains the matching preview; a later or earlier preview could occupy it.
2. Proving the matching preview requires an identity that survives into the
   image. The product has no per-input visual token, and adding one would change
   the measured UI. Image-diff or pixel matching at 60 Hz would add an
   uncalibrated harness workload to the flow being measured.
3. Trace recording itself perturbs frame timing. Enabling it for every measured
   run would change the numbers it is meant to validate; enabling it only for a
   separate proof run leaves two different measurement conditions.

Building that pipeline is a tracing slice with its own design, not a small
addition to this harness. Recording a time-only "trace" result and calling it
the plan's correlation would be dishonest.

## Options for the owner

| Option | What it means | Consequence |
| --- | --- | --- |
| **A. Accept the deviation for T3.P03 (recommended for this gate)** | Keep the rAF attribution for pre-flight and the delayed-sample proof; run the traced-image proof as an owner-operated reference measurement using Chrome DevTools Performance, with screenshots/frames retained outside Git. | The methodology and cold/warm coverage stand; the plan's trace method remains unmet and no hard presentation budget is accepted. The phase gate can proceed only with this deviation recorded. |
| **B. Authorize a tracing sub-slice** | Add a per-input visual token or a frame-identity pipeline, capture a real trace, and prove the matching preview image for a representative sample. | Delays T3.P03 acceptance until the tracing slice lands; measured flow must be re-baselined because tracing changes overhead. |
| **C. Amend the contract** | Remove or narrow the trace requirement, keeping rAF attribution as the accepted method. | Changes the owner-ratified performance contract; not a slice-level decision. |

## Recommendation and residual

Option A is the smallest honest path for T3.P03: it does not claim the trace
proof, it keeps hard presentation rows owner-run, and it names the deviation in
the acceptance record. Under Option A the T3.P03 final gate is **not fully
satisfied by this harness alone**; the owner must either accept the deviation or
choose B/C. Under B or C no product budget is released by this document.

## Owner command for the missing evidence

On the designated reference machine, in Chrome, with the owner operating:

```sh
cd apps/editor
npx playwright test --config perf/playwright.config.ts --project=chrome flows/drag-correlation.spec.ts
```

Record a DevTools Performance trace for the drag, retain the trace and
screenshots outside Git, and correlate the matching preview by inspecting the
presented frame at each marked input. Do not report those numbers as produced by
this harness until the trace pipeline exists.
