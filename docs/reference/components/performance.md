# Performance and delivery

**Owns:** operative measurement policy, metric meanings and evidence limits. Correctness,
architecture, build and DB-backed API checks remain required independently of benchmarking.

For implementation rules on the Layout drag, commit, Undo/Redo and Open paths, see
[Layout performance rules](./layout-performance.md).

## Measurement policy

**The mandatory performance-benchmarking strategy is suspended indefinitely.** No formal
F2/F3/F4/F8/F13 matrix, battery-mode certification or full `npm run perf` workflow may be run as an
acceptance prerequisite on an ordinary slice, phase or final gate. Performance investigations are
**owner-initiated only**, triggered by an observed slowdown. Existing measurements remain
historical evidence; they are not mandatory acceptance prerequisites, and an unmeasured row stays
**unmeasured**, never a pass. The [spot check](#ml-spot-check) is the bounded authorized workflow.

## M/L spot check

The bounded workflow permits
`npm run perf:spot` at four triggers: Core Editor Stability integrated acceptance when that
acceptance plan's owner approves the check, a significant editor hot-path integration checkpoint,
an owner-observed slowdown, and an editor release candidate after substantial relevant change.
There is no scheduled CI battery and no per-slice performance gate.

The spot check measures `grid-M` and `grid-L` only. M is judged smooth against the measured
display period. L may lag and must stay usable. Imported GLBs and texture-heavy Scene composition
are outside those grids and stay uncertified here. `npm run perf` refuses; it does not launch the
former multi-hour suite. Historical budgets are method evidence. An unmeasured row
stays unmeasured.

The [measurement repair evidence](../../archive/research/performance-spot-check/README.md) withdraws the
original #214 commit claims and records source-matched open, commit and pick observations.

Editor and viewer must remain useful on a regular laptop. Resolve demonstrated material costs
inside their consuming slices while preserving expressive architecture, correctness and one
canonical authority. Use established libraries where they justify their cost. Measurements cover
cold and repeated use, realistic project sizes and complete presented results, not just isolated
kernel time or a quick acknowledgement. Evidence and historical build/Node measurements remain in
[the research packet](../../../broad-research/post-p01-roadmaps/convergence-2026-10-21/performance-and-delivery.md).


Historical hardware profiles, suspended matrices and budgets are retained as [method evidence](../../archive/research/performance-method.md), never current acceptance prerequisites.

The runner starts with four observations and extends append-only to eight within a gesture only
on a label margin; at most three sessions follow its margin/disagreement rules. Target 3–5 minutes,
with ambiguous runs capped around 10 minutes. Retain every observation and outlier; summarize
conservatively. There is no automatic contamination retry. M smoothness requires editor time,
presentation delay and frame intervals to match the measured display period. L may lag, including
stable half-rate, but remains usable and correct: its one-shot typed-commit matching presentation
allowance is 200 ms; continuous drag/pan retains the two-frame expectation. M keeps its stricter
near-frame commit rule. Report editor, matching-render and presentation clocks separately, with
operation-matched acceptance and verified preview provenance. The [runner method](../../../apps/editor/perf/README.md)
owns reproducible commands and thresholds. No stress workloads, cache matrices, leak loops,
CPU-throttle search, traces or screenshot quotas are prerequisites of this bounded workflow.
