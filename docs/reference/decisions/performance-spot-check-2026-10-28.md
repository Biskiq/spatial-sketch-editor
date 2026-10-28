# M/L spot check — amendment to the performance suspension

**Status: owner decision, 2026-10-28.** This amends the
[performance-mandate suspension](./performance-mandate-suspension-2026-10-28.md). The mandatory
comprehensive benchmark strategy stays suspended. A lightweight M/L spot check is the approved
editor performance workflow at the triggers below. Design reviewed in PR #213; this record
authorizes the implementation. It changes no product format, package or correctness requirement.

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
CPU time alone does not establish smoothness. Thresholds and the early-stop rule live with the
runner (`apps/editor/perf/lib/spot-decision.ts`) and the
[harness readme](../../../apps/editor/perf/README.md).

## Owner signature

```text
Comprehensive performance benchmarking stays suspended. The M/L spot check is the approved
lightweight workflow at the four triggers above. No CI battery and no per-slice performance gate.
Owner: repository owner (2026-10-28 direction)   Date: 2026-10-28
```
