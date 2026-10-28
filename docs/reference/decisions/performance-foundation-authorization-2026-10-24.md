# Performance foundation authorization — 2026-10-24

**Status: owner-authorized.** The owner explicitly instructed: “Write a performance only proposal
slice and open a new PR sliced directly before any other direct inheritors (only strictly unrelated
works may continue, it's possible that this is a temporary halt. this is a doc only PR)”. The owner
set the scope as algorithm improvement, an aggressive math-library exploration under **full
permissive licensing only**, and a harness that loads the full project JSON and measures from the
peak rather than spending its time on setup, on the owner's MacBook Air M2 with 16 GB. The
owner also stated the intended state after merge: the performance exploration begins, along with
other work that is not blocked.

**Benchmark sequence (owner direction, same day).** The owner added: “i'll run the set up benchmark
before handling to agent optimization, sequence so that we avoid the costly benchmark over and
over. maximum 3 times”. The sequence the owner set is:

1. the agent sets up the benchmark;
2. **Bench 1**, the owner's initial run;
3. agent optimization, checked by hand calculation;
4. **Bench 2**, the owner's rerun;
5. agent fixes;
6. **Bench 3**, the owner's final acceptance run.

S06 is therefore capped at three full benchmark passes, all owner-run on the reference machine.
Agents run no full pass; a fourth needs an explicit owner ruling. For a contaminated or aborted
pass, the owner rules whether it counts and whether to rerun it; it is never silently repeated. The
[slice plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md#benchmark-sequence-owner-run-at-most-three-passes)
owns the details.

This record captures a **bounded replanning** event (a new owner-authorized goal, per
[operations](../../operations/README.md#bounded-replanning)) and an owner release. The
[current coordination](../../roadmap/cross-track-execution.md#next-parallel-batch) owns execution
coordination. The [slice plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md)
owns scope and evidence.

## Registered, authorized and released scope

This coordination registers **T1.P02.S06 — Performance foundation** in
[T1.P02](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md#slice-register), after
S05 and before S02. It authorizes and releases exactly this one implementation scope. The scope
starts once this documentation PR is merged on `main` (coordination trusted base
`696af6ea3b4750432383cda2a90d4f002b9ed783`):

| Scope | Outcome | Plan |
| --- | --- | --- |
| T1.P02.S06 | A peak-first, setup-free measurement method; L/XL and realistic-load workloads; per-stage scaling evidence; algorithmic fixes inside the one compiler and its consumers; a permissive-only math/geometry library exploration | [plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md) |

S06 belongs to C1 because the [performance contract](../components/performance.md#acceptance-and-workflow)
gives C1 the compile/admission deduplication and the measured optimization experiment. S06 does
that work before drawing adds hot-path load. The H0 harness stays T3's workflow, so S06's shared
harness and fixture edits are serialized with T3 review, as the existing shared-file rule requires.

## Performance-first halt (temporary)

A **direct inheritor** is a scope that consumes S06's outputs: the compile, admission or
representation path, the harness method and its fixtures, or a hard performance row that S06
re-baselines. These scopes are direct inheritors:

- T1.P02's drawing (S02), Opening (S03) and final gate (S04);
- T2.P02's integrated final gate (S03), which re-measures import, placement, GPU-memory and leak
  rows on the harness;
- the Core Editor Stability acceptance plan and everything behind it, including T4, which are
  already frozen.

Until S06 is accepted and merged, no direct inheritor is released or started. That is a precondition
on a later owner release. It is not a new lifecycle status: the registers keep their existing
states. The halt ends when S06 ships, or earlier if the owner records an explicit ruling to lift it.
Ending the halt releases nothing by itself; each inheritor still needs its own owner authorization
and release-list entry.

**Strictly unrelated work** consumes none of S06's outputs and is not a direct inheritor. It may
continue only through its ordinary route and its own owner release. Three rules apply while S06 is
running:

- A file S06 also writes, such as a bounded shell patch under `authoring/stage/shell/`, is edited
  only as a serialized, T1-reviewed patch against S06's recorded claim.
- The shared harness is used as it stands on `main`, and none of its shared harness or fixture
  files is edited while S06 holds them.
- Reference-machine measurement queues behind S06's perf lock.

Examples are:

- T3.P04 project lifecycle planning, authorization and implementation (persistence/API with a T1
  shell patch, serialized as above);
- owner-invoked phase closeouts of T3.P02 and T3.P03, whose performance residuals are transferred
  below and therefore have a named owner;
- owner-run operations such as F2 epoch activation;
- research and documentation.

Concurrent work must not run heavy test lanes or a second measurement pass on the reference
machine while S06 is measuring. The slice plan's machine lock enforces this.

## Transferred obligations

- **From T1.P02.S02 to S06.** The install-compile and Undo/Redo re-admission deduplication, its
  heavy-lane differential and compile-count oracle, and the bounded incremental or worker
  experiment inside the one compiler. S02 keeps recording the rows for its own new drawing flows on
  S06's method. The “preview equals planner output” semantics question stays an owner decision.
- **From T3.P02.S02's deferred Scope A to S06, as measurement.** The
  [owner ruling](../../roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/acceptance.md#owner-ruling--performance-and-unrun-rows-deferred-2026-10-24)
  named a separate performance and scale exploration. S06 is that exploration, and it measures:
  - the traced Preview first frame and capture/bind completion;
  - the M-workload F10 rows;
  - the F13 re-measure;
  - the reference-machine run;
  - the Stage initial-load delta.

  It records each with a disposition. A miss in T3-owned code is reported to T3. S06 does not change
  Experience or Preview semantics. The H0 trace-method ruling stays with the owner; S06 may supply
  evidence for it.
- **From T3.P03.S02 to S06.** The unbuilt L and XL fixtures, plus the M/L drag rows that were
  recorded as not run.
- **Unchanged at the time; superseded 2026-10-28.** S01's F2 S/M timings were assigned to
  T1.P02.S04, which cites S06's measurements and rechecks them on the integrated tree; T2.P02.S02's
  owner-run rows were assigned to T2.P02.S03. The [performance-mandate
  suspension](./performance-mandate-suspension-2026-10-28.md) ends both assignments: every unmeasured
  row is historical evidence, not an acceptance prerequisite, and no benchmark is authorized. S06
  supplies method and baseline, not acceptance.

## Full permissive licensing

This narrows the [2026-10-23 dependency-admission ruling](./post-batch-e-authorization-2026-10-23.md#licensing-direction)
for S06. A package is admissible only when every component it ships, including embedded,
vendored or WASM-compiled sources, carries one of these licenses:

- MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0, Zlib, 0BSD or BSL-1.0;
- an `OR` expression qualifies when one arm is on that list.

S06 records each admitted package, version and license, read from the package's own license file at
the pinned version, in its acceptance record. These stop the candidate and are reported to the
owner:

- weak or strong copyleft (LGPL, MPL, EPL, GPL, AGPL);
- source-available or field-of-use terms;
- public-domain dedications (Unlicense, CC0);
- a missing or unclear license.

Existing dependencies are not re-admitted or re-litigated here. That includes `robust-predicates`,
which `layout-core` already uses under the Unlicense. A version bump of an existing dependency
stays allowed. A new candidate whose only non-listed component is an already-present dependency at
a compatible version is admissible. The public-domain stop above applies only to newly introduced
packages and components, and the owner may rule it open. Benchmark-only assets (models and
textures) are inputs, not dependencies. They stay outside the repository and are never shipped, and
their source and license are recorded.

## Limits

This record prunes the three shipped post-Batch-E rows (T1.P02.S05, T2.P02.S02 and T3.P02.S02)
from [the release list](../../roadmap/now.md). Their history remains in the
[post-Batch-E record](./post-batch-e-authorization-2026-10-23.md), the phase registers and the
acceptance records.

No other implementation is released. None of the following is created, changed, accepted or
authorized here:

- a gate or version;
- an authored format;
- a performance budget (S06 may only propose a tier amendment for owner ratification);
- a CI timing gate, benchmark registry or schedule;
- a production deployment or epoch activation;
- a milestone acceptance, phase closure or track completion.

T4 remains frozen under R1-D. Each released plan's verification tier, complete implementation-PR
merge gate and independent review stay in force.
