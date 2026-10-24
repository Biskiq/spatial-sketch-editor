# T1.P02.S06 — Performance foundation: implementation plan

**Slice:** T1.P02.S06 · **Status:** approved. Owner-authorized and released 2026-10-24
([record](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)); it
starts per the [release list](../../../now.md) · **Phase:** [T1.P02](../README.md#slice-register) ·
**Track:** [T1](../../README.md) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md) ·
**Acceptance:** [record](./acceptance.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

## Outcome and readiness

This slice is **performance only** and adds no product feature. Drawing, Opening, T2's final gate
and later scale work all build on the compile, admission and representation path. Before they do,
this slice delivers four things:

1. A fast, honest measurement method on the designated reference machine.
2. Measured evidence of how open, edit, Undo/Redo, orbit and memory scale from S to M to L, with XL
   and the realistic-L load as report-only rows.
3. Algorithmic fixes for every stage that grows faster than the project, made inside the one
   canonical compiler and its consumers, each with an equal-output proof.
4. An aggressive math and geometry library exploration under full permissive licensing, with
   adoption only where a measurement and a correctness differential justify it.

S05 is shipped. S06 runs before S02 under the owner's
[performance-first halt](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md#performance-first-halt-temporary):
no direct inheritor is released or started until S06 is accepted and merged. Recheck the trusted
base, H0 `T3.P03.S01`, the consumed gates and the active scopes through the runbook start step.

**Starting evidence.** The H0 pre-flight rows, from the
[T3.P03.S02 acceptance record](../../../t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md#measured-pre-flight-rows-no-budget-accepted)
on the M2:

- **F2 open S** (cold / warm / repeat-use median): 144.05 / 27.1 / 26.3 ms.
- **F2 open M:** 533.2 / 459.25 / 476.15 ms.
- **Calibration, grid-7:** compile plus Stage admission has a 53.35 ms median, of which compile is
  23.00 ms and admission 30.35 ms. Roughly 400 ms of each warm M open is therefore outside compile
  and admission and is unattributed. Warm open grows about 17× from S to M, while walls grow
  about 4.7×.
- **F3 drag:** measured at S only (p95 16.3 ms).
- **F13:** withdrawn as lifecycle evidence.
- **Not built:** the L and XL fixtures.

The [geometry library harvest](../../../../../broad-research/geometry-library-harvest.md) is planning
evidence for library fit (its §4 rules) and is not a decision.

## Owner direction

- **Machine:** the designated MacBook Air M2 (16 GB), on battery, Low Power Mode off, Chrome
  stable primary, with no CPU throttling. This follows the
  [performance contract](../../../../reference/components/performance.md#reference-baseline).
- **Method:** load the full project JSON and measure from the peak. Setup time is not
  measurement time.
- **Benchmark budget: at most three full passes, all run by the owner.** The full browser benchmark
  is the costly step, so agents never run it as an iteration loop. The sequence is fixed:
  1. The agent builds the method and workloads and hands them over.
  2. **Bench 1** (owner): the initial baseline.
  3. The agent optimizes, checking by hand calculation, then hands over.
  4. **Bench 2** (owner): rerun.
  5. The agent fixes what Bench 2 shows, again checking by hand calculation.
  6. **Bench 3** (owner): the final acceptance bench.

  A fourth pass needs an explicit owner ruling. See the
  [benchmark sequence](#benchmark-sequence-owner-run-at-most-three-passes).
- **Algorithm first.** A library is a means, never the goal. An in-house algorithm change with the
  same win is equally acceptable.
- **Licensing:** full permissive only, as defined by the
  [record](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md#full-permissive-licensing).
  A copyleft, source-available, public-domain-dedication or unclear license stops the candidate and
  is reported to the owner.

## Owning paths and boundaries

**T1 writes:**

- `packages/layout-core/**`, including the compiler, kernels, spatial queries and representation;
- the Layout unit in `packages/project-model` (no format change);
- Layout adapters;
- Stage admission, install and host under `apps/editor/src/lib/authoring/stage/`;
- the Layout representation and mesh build under `apps/editor/src/lib/layout/`;
- the dependency manifests and lockfile, for admitted packages only.

**Serialized with T3 review:** the shared perf harness, fixtures and flows under
`apps/editor/perf/**`, and the shared test helpers. Record the writer, the expected patch base and
the reviewer in the T1 baton before editing them.

**Other domains:** a hotspot in Scene, import or render code (T2) or in Camera, Experience or Preview
code (T3) is fixed only through a bounded patch reviewed by that owner. Otherwise it is recorded as a
named finding for that owner. S06 never changes another domain's semantics.

**Invariants:**

- one canonical compiler, with no second architectural reconstruction (rule 6);
- authored truth excludes derived, cache and session state (rule 3);
- visitor isolation, with no editor helper in visitor or public chunks (rules 4–5);
- one Camera authority;
- no authored format change. If a fix seems to need one, stop and report.

## Scope

### A. Measurement method: full JSON, measured from the peak

1. **Precomputed fixtures.** One generator script builds every workload once:
   - through the public `layout-core` planners and the canonical compiler, exactly as
     `perf/lib/fixtures.ts` does today;
   - validated with zero blocking compile issues;
   - serialized as the canonical project envelope, with a digest keyed on the generator inputs and
     the current format numbers.

   The output is a git-ignored, regenerated cache, never hand-edited and never authored product
   truth. A stale digest regenerates the fixture. Measured runs never rebuild topology through
   planners.
2. **Direct load.** Every flow seeds its project by loading the full JSON in one step through the
   real admission path. F2 keeps the real Open-source-JSON chooser because opening is what it
   measures. Every other flow treats the load as setup.
3. **Peak-first order.** A pass starts at the peak gating tier and the realistic-L load, then runs M
   and S. XL is report-only. All S and M hard rows are still measured, because peak-first changes
   the order, not the coverage.
   - The order is fixed and identical in all three benches.
   - The M2 is fanless, so a pass records its thermal state (`pmset -g therm`) at each tier
     boundary and inserts a recorded cool-down before the S and M hard tiers.
4. **Steady-state sampling inside the contract's runs.** The contract's cache states stay as
   defined: cold, warm as a second navigation, repeat-use as 10 open/close cycles, each with at
   least 10 measured runs and run-to-run spread.
   - **F2 and F13** keep the contract's entry for every run, because opening and teardown are what
     they measure.
   - **F3, F4, F7 and F8:** within each contract-defined run, the session reaches the loaded peak
     state once and takes its samples there. Between samples it resets with the product's own Undo
     or a deterministic inverse operation, never a re-open.
   - **Distinct inputs.** Each sample uses a distinct input (pointer path, typed value or delta), so
     a revision-keyed cache cannot turn a repeated input into a hit. Each sample records whether a
     reuse cache served it. Cache-served samples are reported separately and never counted in the
     F3/F4 windows.
   - **Cold runs** keep a fresh browser context, but their only setup cost is the JSON load.
5. **Setup accounting.** Setup is excluded from every measured window. Each pass reports its total
   wall time, its setup time and the setup share. Bench 1 also records the old method's wall time
   for the F2 S/M rows in A.6, and only those, as the comparison.
6. **Method validation, inside Bench 1.** Bench 1 runs F2 S/M under both the old and new methods
   on one revision. Relabel rows rather than silently overwrite them. A difference beyond
   run-to-run noise is explained from Bench 1's own traces without another pass. If it cannot be
   explained, the owner rules whether Bench 1's new-method rows stand as the baseline. A failed
   validation does not trigger an automatic rerun.
7. **Owner-ready handover.** Each handover gives the owner:
   - the exact commands for one pass;
   - the expected wall time;
   - the lock and load-check step;
   - where the report lands.

   A pass is one invocation that produces every row it needs, including the per-stage traces that
   section C reads.

   **Smoke check.** Before each handover, the agent runs a smoke check to prove the flows execute:
   every flow at every tier (S, M, L, XL and realistic-L), one run, no warmup, one sample. This
   catches timeouts or stack failures before the owner spends a pass. A smoke check is labelled
   “smoke, not evidence” and is never cited as a measurement.

   **Pass accounting.** A contaminated pass (A.8) or an aborted one (a timeout, a stack failure or a
   crash) is recorded with its cause. It does not silently count as one of the three passes, and it
   is not silently repeated. The owner rules whether it counts and whether to rerun it.
8. **Machine hygiene:**
   - a machine-wide perf lock, so only one measurement pass runs on the M2 at a time;
   - the 1-minute load average and competing processes are recorded at the start and end of each
     pass;
   - a pass that starts above a configured load threshold (default 4.0; changed only with a recorded
     reason) is marked contaminated and is not acceptance evidence;
   - no heavy test lane runs alongside a pass.
9. **Unchanged contract.** These stay as the
   [performance contract](../../../../reference/components/performance.md#complete-user-flows-to-measure)
   defines them:
   - the cache-state definitions and run counts;
   - the ledger correlation;
   - presentation-based latency;
   - the Event Timing rules.

   The harness stays on demand: no CI timing gate, registry or schedule. A method change beyond
   this list is an owner-ratified amendment to the contract, not a harness edit.

### B. Workloads

- **L and XL grids.** Build grid-14 and grid-20 per the contract's
  [representative workloads](../../../../reference/components/performance.md#representative-workloads).
  This closes T3.P03.S02's recorded L/XL gap.
- **Realistic-L load.** The realistic-L fixture named in the T3.P02.S02 owner ruling: grid-14
  compiler-built architecture plus approved GLB derivatives with textures:
  - produced once through the merged T2 import recipe (`creator-import@1`);
  - seeded as resource revisions with many placements, at the contract's L Scene, model and texture
    counts;
  - seeding against an isolated per-lane API/Compose stack, never a shared database.

  Assets come from CC0 or permissive sources and are downloaded only with owner approval per
  source. They stay outside the repository, and their source and license are recorded.
- **Headroom probes (optional; owner opt-in per pass; off by default).** A transparent, animated
  water-like surface shader and a fixed per-frame worker CPU budget can stand in for future
  simulation. They are harness-only, report-only and disposable, and leave product code unchanged.
  They run only if the owner enables them for a pass, so by default they cost no bench time.

### C. Characterization: profile first

Characterization reads **Bench 1's traces**; the agent does not run its own browser passes for it.
Before the Bench 1 handover, the harness must already emit everything this section needs. Product
stage marks are enabled only by the harness flag, as the contract requires, and a mark in T2- or
T3-owned code needs that owner's review. Bench 1, and every later bench, traces these flows at S, M
and L (XL and the realistic-L load are report-only):

- F2 open;
- F3 Wall-handle drag at S, M and L, including the M/L rows that were not run before;
- F4 commit;
- F8 Undo/Redo;
- F7 orbit;
- F13 lifecycle cycles that keep the JS realm, so a flat heap actually proves teardown.

The same pass carries the transferred rows:

- **F10 at S and M:** capture/bind completion and the traced Preview first frame, repeat and first
  use;
- **F5, F6 and GPU memory:** the import, placement and GPU-memory rows at S and M, as T2.P02.S03's
  baseline (S06 does not accept them);
- **Stage initial-load delta:** from the bundle report.

Attribute time to these stages:

- parse and validation;
- compile;
- Stage admission and install;
- representation and mesh build;
- scene-graph construction;
- reactive install;
- shader compile and first render;
- garbage collection.

For each stage, report how its cost scales against walls, rooms and objects, and name every stage
that grows faster than linear. The unattributed part of the M open is the first target.

### D. Algorithm work

1. **Remove repeated work first** (transferred from S02):
   - Deduplicate the install compile, the Undo/Redo re-admission and repeated
     representation/mesh rebuilds. Reuse a result only where revision or content identity proves it
     is the same result, with invalidation covering replacement, a new revision and changed inputs.
   - Prove full output equivalence with a heavy-lane differential and a deterministic compile-count
     oracle across an ordinary edit, a refusal, Undo/Redo and replacement.
   - Never accept stale geometry to hit a timing target.
2. **Fix the superlinear stages.** Profiling decides where. Candidates:
   - spatial indexing in place of pairwise scans;
   - incremental invalidation keyed on topology identity, so one Wall edit rebuilds only the Walls,
     Openings and Rooms it affects;
   - instancing or batching of repeated geometry where rendering is the bound;
   - revision-keyed bounded caches;
   - workers for whole pure stages.

   A worker must meet the matching-result completion deadlines as well as the main-thread budgets.
   Moving work off-thread alone proves nothing.
3. **Bounded experiment** (transferred from S02). If the hand calculation after steps 1–2, or
   Bench 2, shows F3 still missing at M, run the incremental or worker experiment inside the same compiler and evaluator authority and keep the
   full differential oracle. If it then misses at L, changing “preview equals planner output” is an
   owner decision: report the measurement and stop that semantic change.
4. **Scale invariants as correctness oracles.** Deterministic count assertions, not timings, guard
   each fix in the correctness lanes:
   - compiles per edit;
   - admissions per Undo/Redo;
   - Walls rebuilt per single-Wall edit;
   - draw calls per frame at S, M and L;
   - for a fixed local edit, constant work across S, M and L.

### E. Math and geometry library exploration

Explore aggressively across these roles:

- vector and matrix math;
- robust predicates and exact arithmetic;
- polygon boolean and offset;
- constrained triangulation;
- spatial indexes (R-tree, flat, kd, BVH);
- mesh processing and simplification;
- manifold/CSG for Openings;
- BVH-accelerated picking;
- prebuilt WASM numeric kernels.

For every candidate actually probed, record:

- the package and version;
- its license, read from the package's own license file at the pinned version, including any
  embedded or WASM-compiled sources;
- its bundle bytes against the Stage first-load budget (no growth over 25 KiB br without a recorded
  reason) and whether it can stay lazy or out of visitor chunks;
- whether it is synchronous, pure and Node/Vitest-runnable;
- its determinism;
- its expected win on the S/M/L workloads against the current kernel, by hand calculation (see
  the [benchmark sequence](#benchmark-sequence-owner-run-at-most-three-passes)), confirmed only by
  Bench 2 and rechecked by Bench 3;
- its correctness differential against an exact oracle.

Adopt a package only with:

- a win confirmed by Bench 2. Only a candidate confirmed by Bench 2 may enter the Bench 3 revision.
  A candidate that loses in Bench 3 goes to the owner, never silently out of the accepted
  revision;
- a passing differential;
- a qualifying license;
- placement inside the one compiler or its runtime-safe consumers.

Record each adopted package in the acceptance record. Remove probes that do not win and keep their
findings. A new language toolchain (Rust or C++ sources built in this repository) is out of scope;
consuming a prebuilt, permissively licensed WASM package is in scope.

### F. Tier proposal (owner decision)

From the measured slope, propose whether the L budgets or the representative workload tiers need an
amendment, for example whether realistic-L should replace the grid-only L tier. This is a proposal
only: the performance contract changes solely by owner ratification.

## Benchmark sequence (owner-run, at most three passes)

The owner set this sequence on 2026-10-24 so that the costly benchmark is not repeated. Agents never
run a full benchmark pass; between passes they work from Bench 1's data.

1. **Set up (agent).** Run the start step and record the trusted base. Build the method and
   workloads (A, B) and the harness-flag stage marks that C needs. Prove the flows execute with a
   smoke check only. Hand over to the owner (A.7).
2. **Bench 1: initial (owner).** One pass on the M2 with the new method at S, M and L, plus XL and
   the realistic-L load as report-only. It includes the old-method F2 S/M comparison (A.6) and the
   per-stage traces. The agent records it in the acceptance record as owner-run.
3. **Optimize (agent).** Characterize from Bench 1 (C), then deduplicate (D.1) and fix and explore
   (D.2–D.4, E), checking each change by hand calculation as defined below. Correctness lanes,
   differentials and count oracles run as usual, since they are not benchmarks. Hand over with the
   predicted result per row.
4. **Bench 2: rerun (owner).** The same pass and workloads, on the optimized revision. The agent
   records it next to the predictions and explains every prediction miss beyond noise.
5. **Fix (agent).** Resolve what Bench 2 shows: regressions, mispredictions, remaining hard misses
   and the D.3 experiment if needed. Algorithm fixes may continue, but no new library candidate
   enters after Bench 2 (E). Check by hand calculation again and hand over. If a hard miss
   cannot be resolved without changing “preview equals planner output” or a budget, report it to the
   owner instead of fixing it.
6. **Bench 3: final acceptance (owner).** The same pass on the final revision. Its rows are the
   slice's acceptance measurements. The agent records them, writes the tier proposal (F) and
   completes the acceptance record. A hard miss in Bench 3 goes to the owner: a fourth pass, a fix
   or a ruling. It is never re-run silently.

**Hand calculation.** For each flow and stage, the predicted time is Bench 1's measured stage time
scaled by the change in deterministic operation counts. The counts come from the D.4 oracles (for
example compiles, admissions, Walls rebuilt, draw calls or pairwise tests), or from the complexity
change with the workload sizes put in. The stages are then summed per flow and compared with the
budget, with the margin and every assumption stated. A library candidate may add one bounded Node
kernel probe of seconds, never the browser harness. It is disposable and labelled “estimate, not
evidence”. A prediction is never acceptance evidence; only Bench 2 and Bench 3 confirm a win.

Use the work-checkpoint skill at each handover, since the owner's runs separate the agent sessions.

## Acceptance and verification

| Concern | Required proof |
| --- | --- |
| Benchmark budget | At most three owner-run passes (Bench 1–3), each recorded with revision, wall time, setup share, load check and lock holder; no agent-run full pass; every smoke check and hand-calculated prediction labelled as such |
| Method | Precomputed JSON load in every flow; setup excluded and reported; old and new wall time in Bench 1; A.6 method validation in Bench 1; contamination rule applied |
| Workloads | L/XL fixtures and the realistic-L load validate; asset sources and licenses recorded; stack isolation recorded without credentials |
| Characterization | From Bench 1: per-stage attribution and scaling at S/M/L for F2/F3/F4/F7/F8/F13; superlinear stages named; XL and realistic-L load reported |
| Algorithm | Each optimization has an equal-output heavy differential and a count oracle; a recorded hand-calculated prediction; Bench 1 versus Bench 2/3 on the same workload and environment; no format change; boundary and visitor-isolation tests green |
| Budgets | From Bench 3: hard S/M rows for F2, F3, F4, F7, F8, F13 and per-edit evaluation; L hard rows (F3, F4, F8, F13); a hard miss is resolved before Bench 3 or escalated to the owner per D.3; target rows dispositioned |
| Libraries | Candidate matrix with license evidence; adopted packages recorded by package, version and license |
| Transferred rows | T3.P02.S02 Scope A rows (F10 at S/M, capture/bind, F13, Stage initial-load delta) measured in the benches, each with a disposition; T3.P03.S02 L/XL gap closed; T2.P02.S03's baseline supplied without claiming its acceptance |

Use focused whole-contract tests during iteration. Architecture-integration evidence routes to S04.
**The implementation-PR merge still runs the full required gate** from
[tests/README](../../../../../apps/editor/tests/README.md#what-a-change-requires): root check and
build, affected package checks, the fast, heavy and full editor suites, the unconditional arch lane,
the API check, and DB-backed API tests with zero skips when resource or admission contracts are
touched. Record the API DB target without credentials. Benchmarks stay on demand; a passing
correctness suite is not latency evidence.

## Exclusions

S06 does none of the following:

- add a product feature or UI;
- add drawing (S02) or Opening (S03);
- change Scene, Experience or Camera semantics;
- add T4 delivery, streaming or prepared payloads;
- add real water, physics or material features;
- change an authored format or add a gate;
- add a CI timing gate, benchmark registry or schedule;
- add a new language toolchain;
- change “preview equals planner output” semantics, or any budget, without an owner ruling;
- record the H0 trace-method ruling, which stays the owner's.
