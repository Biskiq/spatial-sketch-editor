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
removed at least **10 draw calls, 1,228 triangles, two allocated textures and one additional
compiled program**, without moving p95 (17.70 ms both ways): the laptop is vsync-bound at 60 Hz, so
frame interval alone does not expose shadow cost. `renderer.info.memory.textures` counts **allocated
textures**, not per-frame texture bindings; `renderer.info.programs.length` counts **compiled
programs**, not per-frame binds.

**Measured baseline.** One shadow-casting Sun: one **2048 × 2048** `PCFShadowMap`, radius 3,
`normalBias` 0.02 on the visitor path and 0.05 on the flat Stage plate; **1 map per frame on the
visit** and **0 maps per frame on the Stage** while the camera moves.

**Approved controls stay live.** T2 approves a Shadow control on Spot and Directional, and on Point
with Shadow off by default. D9 must not disable, hide or auto-change those controls; additional
Spot/Point casters are contract-valid and must not become inert. The earlier proposal to refuse a
second caster or a shadow-casting Point light is withdrawn.

**Proposed per-caster budget.** One 2048² PCF map per shadow-casting Directional or Spot; a
shadow-casting Point light uses six cube faces/maps. Visit: one shadow map per enabled caster per
frame, except the Point cube shadow's six faces; Stage: zero per frame while the camera moves. The
one-Sun World is the only measured total (**1 map/frame**). Multi-caster totals are **unmeasured**;
D9 does not invent a maximum caster count or a multi-caster frame cost.

**Unresolved owner policy — multi-caster shadows.** The owner must choose: (1) measure additional
Spot/Point casters on the same Worlds before promising a total budget (recommended); (2) set a
maximum simultaneous map/caster count in D9 with a visible refusal/notification state, never an
inert control; or (3) ship the controls with multi-caster cost marked unmeasured and no “budgeted”
claim. The [Gate C report](../../roadmap/t2-look-atmosphere/s0-rendering-gate/report.md#gate-c--e7-rendering-performance-and-shadow-budget)
records the full choice.

**Frame targets.** Stage drag p95 ≤ 2 display periods (33.3 ms) and gallery visit p95 ≤ 33 ms were
met at 17.6–17.7 ms. Visitor idle retains the original p95 ≤ 1 display period (16.7 ms) as
**aspirational**; the proposed allowance is **1.1 display periods (~18.3 ms) p95**. The measured
17.6–17.7 ms is within the allowance and misses the aspirational target. p50 is 16.70 ms; the
difference is scheduler jitter, not scene cost.

**Refusal rule.** A map larger than 2048², cascaded shadow maps, a baked/cached shadow architecture,
a per-frame shadow update on the Stage, and any silent runtime map-size reduction, shadow
disablement or light cap remain refused for this batch. These are architecture/quality limits, not
the approved Spot/Point controls. D9 is a map/pass and draw-work budget, not a GPU-time cap;
phone-class hardware remains **unmeasured**.

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
