# PR #214 — measurement repair evidence

**Date:** 2026-10-28. **Measured revision:** `d5097580bed2541276bab45ca90fa0509d4bfece`.
Both the clean runner and the loaded browser module report this revision. The preview was a fresh
local production build at loopback. Later evidence/documentation commits do not change measured code.

## Scope and retained attempts

This repairs measurement correctness under the existing [M/L decision](../../decisions/performance-spot-check-2026-10-28.md).
The comprehensive benchmark remains suspended. No S/XL run, census, long input capture, leak loop,
cool-down or performance optimization was performed. Historical S06/Bench evidence is unchanged.

- [Initial validation attempt](./incomplete-5f4dab10.json): verified preview at `5f4dab10`, 16.6 s, one session per tier. Both labels were incomplete. The selected Wall claimed manipulation instead of picking; pan could receive an older frame timestamp. Those pick/pan rows are invalid and supply no feel claim. Every observation is retained.
- The harness was repaired and a [one-Room browser regression](../../../../apps/editor/perf/flows/spot-wiring.spec.ts) proved the real chooser, typed acceptance, matching render, before/after wall hits and pan clock. This is correctness QA, not another M/L session.
- [Completed spot check](./spot-d5097580.json): `SPOT_REQUIRE_VERIFIED=1 npm run perf:spot`, exit 0, 16.561 s wall time, 5 ms cached-workload setup. One M and one L session, four drag and four pan attempts each, no warm-up discarded and no additional session requested. All observations and request reasons are retained.

## Corrected timings

All figures below are milliseconds. Presentation is the documented rendering-opportunity proxy.
Open editor time reaches the first nonempty Stage render carrying the admitted content ID.

| Tier | Open admission | Open through render | Open presented | Open automation |
| --- | ---: | ---: | ---: | ---: |
| M | 101.4 | 593.1 | 607.3 | 207.7 |
| L | 284.1 | 5065.1 | 5069.4 | 229.6 |

| Tier | Typed commit editor | Through matching render | Commit presented | Commit automation | Label |
| --- | ---: | ---: | ---: | ---: | --- |
| M | 6.3 | 33.4 | 42.8 | 11.4 | not-smooth |
| L | 15.6 | 115.3 | 120.0 | 20.0 | not-usable |

| Tier | Drag editor / presented max | Drag automation max | Pan task-window / presented max | Pan automation max | Pick before / after | Undo editor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M | 4.1 / 16.4 | 17.9 | 7.0 / 15.5 | 12.4 | 6.0 / 2.7 | not required |
| L | 4.5 / 15.5 | 17.2 | 19.6 / 15.6 | 6.4 | 13.5 / 6.6 | 6.5 |

Both before/after picks actually resolved and selected the expected same Wall: M
`wall-chain-1.grid7x00000000`, L `wall-chain-1.grid14x00000000`. Selection was cleared before each
press so the body manipulation handle could not consume it. Pick-index nodes built before/after:
M 1,063/1,071; L 3,917/3,981. Raw hit identities and projected points are in the report.

## Findings and withdrawn claims

The previous #214 description reported typed commit times of **411 ms at M and 1,345 ms at L**.
Those used a stale pointer-release marker and are withdrawn. They establish no commit-performance
finding. The old 115/269 ms open numbers stopped at admission; they were not opening-through-render
measurements. The old preview revision was not independently established. No original raw file from
that earlier PR claim was available in this task; the claims are preserved here as invalid claims.

The repaired run shows fast typed acceptance (6.3/15.6 ms) and later matching presentation
(42.8/120.0 ms). These miss the unchanged commit presentation clauses; M is `not-smooth` and L is
`not-usable`. Opening through rendering takes 0.593/5.065 seconds. These are observed presentation
and opening findings, not evidence for the old slow-acceptance claim. No product optimization or
paired regression attribution is made. Performance labels are findings, not reinstated merge gates.

## Verification

See the [verification record](./verification.json). Final results: 2,876 tests across 226 files
(including heavy correctness), 188 architecture checks, 76 focused instrumentation checks, editor
and package/API type checks, production build, 115 DB-backed API tests with zero skips, four
integrated functional browser journeys with 26 recorded checks, and the one-Room wiring regression.
The [four-route smoke](./routes.json) recorded no page exceptions. The initial concurrent full-suite
repeat timed out in the existing 400-Room correctness case; complete repeats without browser
contention passed. The original timeout limit was unchanged.

## Limits and policy

- Apple M2, macOS 15.8.2, 16 GiB, Node 26.7.0, Chrome 156.0.8078.48. AC power, low-power mode off. Idle rAF period 16.70 ms. Report-time one-minute load average **9.6**; this was a busy machine, not a controlled quiet reference laptop.
- The rendering-opportunity proxy is conservative and is not physical scanout. Pan editor time is Chrome task time over the observation window, including possible render/observation work. It is not isolated pan-handler CPU. Load alone supplies no causal attribution or automatic retry.
- The initial incomplete validation attempt remains separate. The completed run has no threshold-margin or disagreement request, so no further sessions were run. No contamination retry is advertised or implemented.
- Architectural grids contain no imported GLBs or texture-heavy Scene composition. One-machine snapshots do not certify those areas, battery mode, leak behavior, rare hitches or a regression against a known-good revision.
- [PR #213](https://github.com/Biskiq/spatial-sketch-editor/pull/213) remains open and review-only. Its conflicting draft rules are explicitly superseded by the current decision and #214; it was neither merged nor closed. The four occasional triggers remain unchanged.

Measurement correctness is ready for review/merge under the approved policy. The observed
presentation/opening costs remain a separately scoped finding; they have not been optimized.
