# T3.P03.S02 — Measurement workflow and final gate: implementation plan

**Slice:** T3.P03.S02 · **Status:** approved — owner-authorized 2026-10-22 as batch E (E2,
[record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md)) and released from the
hold; starts after S01 merges; not implemented · **Phase:** [T3.P03](../README.md) ·
[slice register](../README.md#slice-register) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md) ·
**Contracts:** [performance](../../../../reference/components/performance.md),
[test workflow](../../../../../apps/editor/tests/README.md#product-convergence-performance-workflow)

```text
CONSUMES: F2.unit-envelope@1, F4.intent-acceptance@1
REQUIRES: F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1
VERIFICATION: exhaustive
```

This slice installs the owner-authorized on-demand workflow and records the phase's integrated
result. It may run alongside the first product slices once S01 has merged; it is not their launch
prerequisite. A consuming slice that reaches acceptance before this merges records equivalent manual
DevTools evidence and states its limits.

## Scope

1. **Harness.** Add `@playwright/test` (pinned exact version) as an editor devDependency, with its own
   Playwright config in a `perf/` directory of the editor workspace. The default Vitest lanes never
   collect it. Explicit scripts `perf` and `perf:bundle` in the editor workspace, forwarded from the
   root; root `test`, `check` and `build` never call them. Browsers come from Playwright's own cache
   (Chromium plus branded Chrome where installed), a fresh context per run, never a user profile.
2. **Correlated measurement.** A runtime-gated mark helper in editor platform code: a no-op unless
   the harness sets its flag through an init script, so the measured build is the production build.
   Continuous inputs carry a monotonic sequence through preview installation and render submission;
   the harness correlates each with the presented frame in the trace, records superseded inputs and
   latest-input age, and times final-result presentation separately from INP. Async results are timed
   to their presented completion, including stale-result rejection.
3. **Existing-flow baseline.** Marks and flows for what ships today: F1 startup, F2 open (S and M
   fixtures), F7 orbit, F9 Save (through the test-auth seam on the local stack, never production),
   F13 open/close cycles, and the F3/F4/F8 methodology proved on the shipped straight-Wall drag,
   precision edit and Undo/Redo. That gives C1 its before-numbers. Later consumers add their own flow
   marks (F3/F4/F8 for drawing, F5/F6 import, F10 Preview); this slice does not pre-build them.
4. **Calibration.** A calibration entry built with the production config that runs the packet's
   grid-7 compile plus Stage admission; a CDP throttling search per machine and browser major; no
   extrapolated pass when no rate matches.
5. **Bundle report.** Promote
   `broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/performance/bundle-analysis.mjs`
   into the editor workspace: route load sets, raw/gzip/brotli bytes, package attribution and
   visitor-reachable modules on a production build. It can assert that a named lazy chunk is absent
   from a route's first-load set, which T3.P02.S01 needs for Preview.
6. **Results.** Raw results stay outside Git; the acceptance record summarizes machine, browser,
   power, cache, network, workload, commit, CPU rate and limitations. Developer runs are labelled
   pre-flight. GPU, frame-time and GPU-memory rows stay unrun until a Reference A run exists on the
   machine the owner designates under batch E decision E6, which also anchors the calibration.

No CI job, schedule, registry or Vitest timing assertion is added. The retired P23B bench machinery is
not restored.

## Acceptance (final gate)

1. The harness reproduces cold, warm and repeat-use runs with the declared statistics and sample
   counts, and its correlation is demonstrated on the shipped drag: a deliberately delayed preview
   shows up as latency, not as a dropped sample.
2. The bundle report reproduces the packet's route sets on the current tree and refuses an injected
   editor module in the visitor set.
3. The baseline record names every unrun reference/GPU row. Functional acceptance of the harness
   never claims a product budget is met.
4. S01's integrated result is rechecked on the merged tree: scope refusal, both build gates and the
   Preview closure test.
5. Complete repository gate: `npm run check`, `npm test`, `npm run test:arch`, `npm run test:heavy`,
   `npm run build`, and `npm run check:api` with the DB-backed `npm run test:api` at zero skips.
