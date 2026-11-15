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

## Reference-laptop render and shadow budget (D9, proposed)

**Status: proposed 2026-11-15 by Gate C; not in force until the owner adopts it.** S0 Gate C's
19-run bounded bench is owner-authorised historical evidence under this policy. It did not run
`perf:spot` or `npm run perf`, and it does not create a scheduled gate. The full method, numbers and
limitations are in the [S0 Gate C report](../../roadmap/t2-look-atmosphere/s0-rendering-gate/report.md#gate-c--e7-rendering-performance-and-shadow-budget).

On the measured reference laptop (Apple M2, ANGLE Metal, Chrome 153, 1280 × 720, DPR 1) the Stage
rendered **zero shadow maps per frame** during a 600-frame orbit in all three reference Worlds. The
Visitor rendered **one shadow map per frame**. On the gallery visit, turning the sun's shadow off
removed at least **10 draw calls, 1,228 triangles, two texture bindings and one program per frame**
without moving p95 (17.70 ms both ways): the laptop is vsync-bound at 60 Hz, so frame interval alone
does not expose shadow cost.

Proposed D9 budget:

- one shadow-casting Sun per World, the Sky's sun;
- one **2048 × 2048** `PCFShadowMap`, radius 3, `normalBias` 0.02 on the visitor path and 0.05 on the
  flat Stage plate;
- one map per frame on the visit; zero per frame on the Stage while the camera moves;
- Stage drag p95 ≤ 2 display periods (33.3 ms), gallery visit p95 ≤ 33 ms, visit idle p95 ≤ 1 display
  period (16.7 ms). The first two were met at 17.6–17.7 ms. The visit idle target was **missed** at
  17.6–17.7 ms on the empty World as well as the gallery; p50 was 16.70 ms, so the miss is scheduler
  jitter, not scene cost. The owner decides whether to keep the strict target or authorise an
  allowance.

**Refusal rule.** A second shadow-casting light, a shadow-casting point light, a map larger than
2048², cascaded shadow maps, a baked/cached shadow architecture, or a per-frame shadow update on the
Stage is refused for this batch. It may return only with a bounded measurement on the same three
Worlds and explicit owner approval. The runtime must not silently reduce map size, disable shadows or
cap lights; reduce the default set in the design instead. D9 is a map/pass and draw-work budget, not
a GPU-time cap; phone-class hardware remains unmeasured.

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
