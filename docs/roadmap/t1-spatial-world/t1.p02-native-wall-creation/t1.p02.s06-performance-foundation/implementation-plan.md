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
3. Locality: local interactions whose cost follows the affected set, not the project size. This
   means removing superlinear passes and whole-project recomputation from hot paths, inside the one
   canonical compiler and its consumers, each with an equal-output proof (see
   [Scaling objective and locality](#scaling-objective-and-locality)).
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

## Scaling objective and locality

**Objective.** An ordinary local interaction costs what it changes, not what the project contains.
Linear scaling is the floor, not the ceiling: whole-project work is a defect on any hot path where
an edit affects a small region, even when that work is O(N). A project 10× or 100× the size of M is
the design thought experiment. It is **not** a benchmark, promise or gate. The ratified S/M/L hard
rows remain the acceptance gates.

**Why this is needed now, not only at scale.** This is a hand calculation from existing evidence;
Bench 1 confirms or refutes it.

- The contract's per-edit Layout evaluation row is **≤ 8 ms at M, Hard**.
- H0 calibration measured one whole-document compile of grid-7 at a 23.00 ms median on the M2.
- Every Wall-handle pointer move (length, angle or rigid move) runs at least seven whole-document
  passes in `finalizeWallGeometryCandidate` (`layout-core/src/layout-wall-first-precision.ts`, lines
  1844–1960):
  - pre-structural and pre-topology validation;
  - face extraction;
  - Room reconciliation;
  - post-structural validation;
  - portal relations;
  - the compile.
- So eliminating superlinear loops cannot meet that row: whole-project recompute per move misses it
  about 3× even if the work were perfectly linear.

**Notation:** N is the project's entity count; k is the affected dependency set (the entities whose
compiled output an edit can change); V is the visible output.

| Operation class | Examples | Required bound | Honest limit |
| --- | --- | --- | --- |
| Local | Wall-handle drag preview, F4 commit, Undo/Redo of a local edit, pick/hover | Compute O(k log N), GPU upload O(k), history memory O(changed data) per step | k is real work, and log N is index lookups; nothing here is constant-time |
| Topology-local | Closing an enclosure, splitting or merging a Room | O(faces of the affected planar-graph component) | Can approach N in the worst case, for example one Wall closing a very large enclosure |
| Visible-output-bound | Orbit, first frame | Per-frame O(V) | Independence from N needs batching and culling beyond S06 (H6) |
| Genuinely global | Open, validating a loaded file, Save of the full canonical envelope, the content digest under the current format, replacement | Ω(N): linear with a small constant and never superlinear | Kept off the interactive hot path |

**Invariants.** S06 enforces each one with a deterministic count oracle wherever it lands. Wherever
it does not land, the measured violation is recorded as a finding.

- **I1, locality:** for a fixed local edit, these counts stay within c·k at S, M, L and XL:
  - entity evaluations;
  - validations;
  - mesh rebuilds and GPU uploads;
  - cloned objects.
- **I2, no superlinear pass:** every whole-project pass is O(N log N) or better, and every pair test
  goes through an index. Pair visits stay ≤ c·(N + output pairs).
- **I3, one evaluation per result:** compile, validation and Scene resolution run once per accepted
  candidate. Install and Undo/Redo reuse that result by content identity.
- **I4, defer global work:** canonical JSON and digests that no consumer needs synchronously are
  computed lazily and memoized per immutable snapshot, with identical values.
- **I5, incremental equals full:** every cached or incremental result equals the full canonical
  compile on the same input. The full compile stays the authority, the fallback and the differential
  oracle. Incremental evaluation runs the same compiler per entity; it is never a second
  reconstruction (rule 6).

**Hypothesis matrix, by expected end-to-end benefit.** The evidence column cites the trusted base
(`696af6ea`). The estimates are the A/B/C workload counts and the stated assumptions, not measurements.

| # | Today (evidence) | Today → proposed | Headroom estimate | Smallest discriminating check | Risk and semantics | Where |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Whole-document planner and compile on every pointer move (above) | ≥ 7 O(N) passes, plus H3's pair loops → O(k log N) incremental evaluation over the compiler's own dependency graph (Wall → Junctions → incident Walls → hosted Openings → boundary Rooms → their floor and ceiling). Per-entity results are keyed by an input digest. Global checks become index queries over the edit's swept bounds | Single-Wall drag at M: k ≈ 25–30 of N ≈ 340 entities. If per-entity cost is uniform, compile drops from 23 ms to ≈ 2 ms plus overhead. The full path grows ≥ 10× / 100× (≥ 230 ms / ≥ 2.3 s in the linear part alone), while incremental stays ≈ k | Count oracle: entities evaluated per move is constant across S/M/L/XL. Heavy differential: incremental equals full on every move of an exhaustive sweep. Bench 1/2 per-stage split | Highest value; medium-high risk (invalidation completeness). Output is identical, so “preview equals planner output” is preserved, not reopened | S06 primary experiment (D.3) |
| H2 | The accept path repeats whole-project work: the planner compile; F4 capture `structuredClone` plus deep freeze (`f4/prepare.ts:447`, `acceptance-coordinator.ts:229–274`); acceptance normalization rehashing all five units, then validate, serialize and hash again (`units/acceptance.ts:105–255`); host re-admission validating twice, compiling, resolving Scene, hashing and serializing again (`host-acceptance.ts:245`, `source-admission.ts:182–219`) | About a dozen O(N) passes per accepted result → one compile, one validation, hashes only for changed units, serialization deferred to Save or download (I3, I4) | F4/F8 at M: an estimated 2–4× fewer whole-project passes (Bench 1 gives the per-pass split). Still O(N_layout) until H1 and H5 | Count oracle per accept: compiles 1, envelope validations 1, serializations 0 before Save, unit hashes equal to the changed units. Differential: installed snapshot, content ids and refusal verdicts equal today's | Low-medium. F4 and admission semantics are T3-owned, so T3 reviews. The admission verdict (“never a snapshot the visitor runtime could not prepare”) is unchanged | S06 (D.1, widened) |
| H3 | Quadratic joins: Rooms × Openings with a boundary `find` (`layout-geometry.ts:177`); Walls × Openings `filter` (`layout-geometry.ts:300`); faces × predecessor Rooms in reconciliation (`layout-room-reconciliation.ts:678`) | O(R·O·B), O(W·O), O(F·R) → O(N) id indexes, and O(N log N + overlaps) with a box index for faces | Pair visits: M ≈ 20 k; L ≈ 297 k; 10× M ≈ 2.0 M; 100× M ≈ 204 M (seconds). With indexes they become linear | Count oracle on pair visits (reconciliation already counts pair classes). Full compiled result deep-equal on S/M/L/XL | Low | S06, first, because it is cheap and simplifies H1 |
| H4 | Every geometry change, including each drag preview, rebuilds every Wall mesh, recreates the material factory and disposes all geometry (`visitor/VisitorLayoutShell.svelte:65–111`, rendered by the Stage) | O(W) CPU build plus O(W) GPU upload per frame → retained per-entity meshes rebuilt only for entities whose compiled output changed, with persistent materials | Per drag frame at M: ≈ k/W of today's mesh and upload work. Flat at 10× / 100× | Count oracle: geometries built and uploaded per single-Wall edit ≤ c·k; materials created per edit = 0. Per-Wall buffers equal a full rebuild | Medium. The file is shared with Preview under `visitor/`, so T3 reviews. Same renderer and same output | S06 (bounded patch) |
| H5 | Each capture deep-clones and freezes the whole envelope, and each history state holds the full source plus its canonical JSON | O(N) time and memory per step → structural sharing: first unit-level (an unchanged unit is shared by reference), then entity-level copy-on-write | Memory per history step goes from ≈ the canonical envelope's size to ≈ the size of the changed data. This decides heap after 100 edits at 10× / 100× | Count oracle: objects cloned per accept ≤ c·k. Heap growth after 100 edits ∝ the changed data (F13 and heap rows) | Medium. F4 immutability and stale-writer guarantees are T3-owned | Unit-level in S06 with T3 review; entity-level persistent structure is a follow-on |
| H6 | One mesh per Wall, Room surface and door; per-object culling; raycast picking over objects | Draw calls and culling O(N) per frame → O(visible chunks) through static batching per spatial cell with per-chunk rebuild. Picking O(log N) through a BVH | Draw calls: M ≈ 300; L ≈ 1 k; 10× M ≈ 3 k (above the 2,500 target); 100× ≈ 30 k | The benches record draw calls and frame time at S/M/L/XL, plus a draw-call count oracle | A new rendering architecture: owner decision | Measure in S06. A BVH picking probe only if picking shows in the traces; batching is a follow-on |
| H7 | A content revision is SHA-256 over the canonical unit bytes; Save PUTs the full canonical JSON | Ω(unit bytes) per digest and per Save. This is inherent in the current format | At 100× this is hundreds of ms per Save; I4 keeps it off the hot path | Benches record F9 bytes and time at L/XL | A per-entity (Merkle) digest or a delta Save is a format/F/T3 decision | Owner decision |
| H8 | Open is genuinely global, and about 400 ms of warm M open is unattributed outside compile and admission (53 ms) | Ω(N) → linear with a small constant. A progressive first frame by visibility is streaming-adjacent | Bench 1 attributes it; H2 and H4 also cut its repeated passes | Bench 1 per-stage attribution is itself the experiment | Progressive or streamed open belongs to T4 | Attribution and pass removal in S06; progressive open is owner/T4 |

Everything in S06 runs inside the existing authorities. It adds no format, gate, rendering
architecture, preview semantics or bench pass. A hypothesis that needs one of those stops and becomes
an owner proposal in F.

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

Work the [hypothesis matrix](#scaling-objective-and-locality) in this order: H3, then H2, then H4
alongside H1, then H5. Each hypothesis carries its count oracle and differential from the matrix.
Linear whole-project work on a local path is a defect (I1), not only superlinear work.

1. **Remove repeated work first** (H3, H2; this includes the work transferred from S02):
   - Index the quadratic joins.
   - Make the accept, install and Undo/Redo path compile, validate and resolve once per accepted
     result.
   - Hash only the changed units, and defer serialization to Save or download.
   - Reuse a result only where revision or content identity proves it is the same result, with
     invalidation covering replacement, a new revision and changed inputs.
   - Prove full output equivalence with a heavy-lane differential and the I3 count oracle across an
     ordinary edit, a refusal, Undo/Redo and replacement.
   - Never accept stale geometry to hit a timing target.
2. **Retain the representation** (H4): per-entity meshes and persistent materials, rebuilt only for
   entities whose compiled output changed. This is a bounded patch to the shared `visitor/` shell,
   with T3 review.
3. **Primary experiment: locality-aware incremental evaluation** (H1; this replaces S02's
   conditional experiment). The hand calculation above predicts that whole-document evaluation misses
   the per-edit M row however linear it is, so this experiment is primary, not conditional on an F3
   miss. A worker alone cannot fix it: moving 23 ms off-thread leaves both the evaluation row and
   matching-result latency unmet.
   - Scope it to the single-Wall drag preview and the F4 commit of length, angle and rigid-move
     edits.
   - Evaluate the affected set k through the compiler's own per-entity functions, with per-entity
     results keyed by an input digest.
   - Answer global constraints (crossings, Room disjointness, id uniqueness) by index queries over
     the edit's swept bounds.
   - Fall back to the full compile whenever the affected set cannot be bounded.
   - The full compile stays the authority and the oracle (I5). The experiment is removable: if
     Bench 2 falsifies it, or its differential is not exhaustive and green, delete it and keep the
     full path.
   - If the per-edit row still misses at L after it, changing “preview equals planner output” is an
     owner decision: report the measurement and stop that semantic change.
4. **Structural sharing** (H5, unit level): an unchanged unit is shared by reference through capture
   and history, and only new objects are frozen. Entity-level copy-on-write is a follow-on.
5. **Scale invariants as correctness oracles.** Deterministic count assertions, not timings, guard
   each landed hypothesis in the correctness lanes, running at S, M, L and XL:
   - compiles, validations and admissions per edit and per Undo/Redo (I3);
   - entities evaluated, meshes rebuilt and objects cloned per single-Wall edit (I1);
   - pair visits per compile (I2);
   - draw calls per frame;
   - for a fixed local edit, constant work across S, M, L and XL.

   These run freely between benches, because they are correctness tests, not benchmarks.

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
amendment, for example whether realistic-L should replace the grid-only L tier. Also propose, as
owner decisions with their Bench evidence and hand-calculated 10× / 100× headroom:

- adding the I1–I5 locality invariants to the contract as count-based rows;
- entity-level structural sharing (H5);
- batched, culled rendering (H6);
- a per-entity digest or delta Save (H7);
- progressive open (H8).

These are proposals only: the performance contract and the formats change solely by owner
ratification.

## Benchmark sequence (owner-run, at most three passes)

The owner set this sequence on 2026-10-24 so that the costly benchmark is not repeated. Agents never
run a full benchmark pass; between passes they work from Bench 1's data.

1. **Set up (agent).** Run the start step and record the trusted base. Build the method and
   workloads (A, B) and the harness-flag stage marks that C needs. Prove the flows execute with a
   smoke check only. Hand over to the owner (A.7).
2. **Bench 1: initial (owner).** One pass on the M2 with the new method at S, M and L, plus XL and
   the realistic-L load as report-only. It includes the old-method F2 S/M comparison (A.6) and the
   per-stage traces. The agent records it in the acceptance record as owner-run.
3. **Optimize (agent).** Characterize from Bench 1 (C) and refit each matrix row's cost model to
   the measured per-stage times. Then land D.1–D.5 in matrix order and explore libraries (E). Check
   each change by hand calculation as defined below. Correctness lanes, differentials and count
   oracles run as usual, since they are not benchmarks. Hand over with a predicted result per row
   and per hypothesis.
4. **Bench 2: rerun (owner).** The same pass and workloads, on the optimized revision. The agent
   records it next to the predictions and explains every prediction miss beyond noise.
   **Falsification rule:** a hypothesis is refuted for this slice when the target stage's measured
   time does not fall within the stated margin of its prediction. This applies even when its count
   oracle dropped as predicted, because the cost model is then wrong; the agent re-attributes from
   the traces.
5. **Fix (agent).** Resolve what Bench 2 shows: regressions, mispredictions and remaining hard
   misses. Keep or remove the H1 experiment on its Bench 2 evidence (D.3). Algorithm fixes may continue, but no new library candidate
   enters after Bench 2 (E). Check by hand calculation again and hand over. If a hard miss
   cannot be resolved without changing “preview equals planner output” or a budget, report it to the
   owner instead of fixing it.
6. **Bench 3: final acceptance (owner).** The same pass on the final revision. Its rows are the
   slice's acceptance measurements. The agent records them, writes the tier proposal (F) and
   completes the acceptance record. A hard miss in Bench 3 goes to the owner: a fourth pass, a fix
   or a ruling. It is never re-run silently.

**Hand calculation.** For each flow and stage, the predicted time is Bench 1's measured stage time
scaled by the change in deterministic operation counts. The counts come from the D.5 oracles (for
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
| Scaling invariants | For every hypothesis S06 lands, its I1–I3 count oracle is green at S, M, L and XL, and its I5 differential is green. For every hypothesis it does not land, the measured violation and its 10× / 100× hand calculation are recorded. H6–H8 and entity-level H5 are proposed to the owner (F), never implemented silently |
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
- implement batched or culled rendering, a new digest or Save protocol, progressive open, or
  entity-level structural sharing (H5–H8 follow-ons are owner proposals in F);
- record the H0 trace-method ruling, which stays the owner's.
