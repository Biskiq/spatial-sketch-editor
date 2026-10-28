# M/L spot check — amendment to the performance suspension

**Status: owner decision, 2026-10-28.** This amends the
[performance-mandate suspension](./performance-mandate-suspension-2026-10-28.md). The mandatory
comprehensive benchmark strategy stays suspended. A lightweight M/L spot check is the approved
editor performance workflow at the triggers below. PR #213 supplied a review-only design proposal; this record
authorizes the implementation and supersedes the proposal where they differ. It changes no product format, package or correctness requirement.

## Decision

```text
MANDATE      The comprehensive F2/F3/F4/F8/F13 matrix, battery certification and the former
             multi-hour `npm run perf` suite stay suspended. They are not an acceptance
             prerequisite on an ordinary slice, phase or final gate.
SPOT         `npm run perf:spot` is the current editor performance command. It measures grid-M
             and grid-L only, after a preview is already running, and stops on the reviewed
             threshold rule (four samples, eight only while a result is on a label margin).
             Target about 3–5 minutes; an ambiguous run is capped at about 10 minutes.
TRIGGERS     The spot check is approved at these points, and not otherwise:
             1. Core Editor Stability integrated acceptance — one M/L check on the final
                integrated revision, when that milestone acceptance plan's owner approves
                the check. It supplies basic-responsiveness evidence for that plan.
             2. A significant editor hot-path change — Layout compilation or admission,
                geometry evaluation, Plan/Stage rendering, picking, drag, commit or
                Undo/Redo — one check at a meaningful integration checkpoint, not on every PR.
             3. An owner-observed slowdown — the affected workload, current revision against
                a known-good revision.
             4. An editor release candidate — one check only when substantial relevant
                changes have accumulated since the last representative measurement.
REMOVED      S/XL, museum, sweep and 100,000-entity stress workloads; 60-input and 600-frame
             quotas; 10-run acceptance profiles; repeated cache-state matrices; F13 leak-cycle
             benchmark loops; E5 sweep machinery; cool-down, CPU-throttle search, and
             screenshot or trace collection as requirements of this workflow.
             `npm run perf` refuses and points at `perf:spot`. It cannot start the old suite.
PRESERVED    Functional browser acceptance under `perf/flows/`, architecture and correctness
             tests, reusable perf marks and the work ledger, the bundle report, and historical
             benchmark evidence and decision records.
UNMEASURED   A row the spot check does not measure stays unmeasured. grid-M and grid-L do not
             certify imported GLBs, textures or Scene composition. Those are separate
             investigations when they are what changed or what got slow.
CI           No scheduled battery, no per-slice performance gate, no automatic long benchmark.
```

## Labels

M (`grid-7`) is smooth only when editor time, handler-to-presentation delay and frame intervals
all match the measured display period. L (`grid-14`) may show modest lag, including a stable
half-rate, and must stay usable and correct. The two labels are not the same number. Low editor
CPU time alone does not establish smoothness.

**Owner clarification, 2026-10-28 — L typed-commit completion.** A one-shot L typed commit is
usable when its operation-matched accepted result reaches the rendering-opportunity proxy within
the **200 ms L completion allowance**, subject to the existing threshold-margin and correctness
checks. The previous `editor time + two refresh intervals` cap was too strict for L's expressly
permitted lag and is removed for this one-shot measure. The two-frame L presentation expectation
still applies to continuous drag/pan input; M's stricter near-frame commit rule remains. Keep the
editor, matching-render and presentation clocks separate and report slow observations even when
the usability label passes. This changes only the feel classification, never a suspended historical
gate or any recorded measurement.

Thresholds and the early-stop rule live with the
runner (`apps/editor/perf/lib/spot-decision.ts`) and the
[harness readme](../../../apps/editor/perf/README.md).

## Relationship to PR #213 and measurement repair

[PR #213](https://github.com/Biskiq/spatial-sketch-editor/pull/213) remains open, unmerged and
review-only. It is not a dependency of [PR #214](https://github.com/Biskiq/spatial-sketch-editor/pull/214).
Its original four-to-twelve range rule, automatic contamination retry and promise to preserve the
old runnable suite are superseded here: four observations, append-only extension to eight inside
one gesture, at most three sessions under the threshold-margin/disagreement rules, and the retired
suite refuses execution. No active copy of that proposal is added to this branch. Do not merge
its conflicting adoption text over this decision. This relationship changes neither PR's state.

The repair requested on 2026-10-28 keeps the triggers and thresholds above. Every measured session
and outlier is retained, including disagreements; the tier summary is conservative. There is no
automatic contamination trigger because this runner cannot identify non-editor task attribution.
The earlier #214 commit figures of 411 ms (M) and 1,345 ms (L) used a stale pointer marker for a
typed operation and are invalid. They establish no commit-performance finding. New claims require
operation-matched acceptance, a matching rendered source, and verified preview provenance.
See the [harness method](../../../apps/editor/perf/README.md#correlation-sessions-and-provenance).

The repair and all measured attempts are recorded in the
[measurement evidence](../evidence/lean-ml-spot-2026-10-28/README.md).

## Owner signature

```text
Comprehensive performance benchmarking stays suspended. The M/L spot check is the approved
lightweight workflow at the four triggers above. No CI battery and no per-slice performance gate.
Owner: repository owner (2026-10-28 direction)   Date: 2026-10-28
```
