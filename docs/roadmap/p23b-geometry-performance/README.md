# P23B — Geometry Performance & Stabilization

**Phase goal:** keep the shipped wall-first geometry pipeline fluid as curved and multi-room
architecture grows, and make that speed reproducible and regression-guarded. Cost, not
capability: one `LayoutDocument` → one canonical compiler → Plan/3D/visitor is preserved, and
no new capability, view, document, schema or persisted format is introduced.

**Phase invariants:** one geometry compiler and one compiled geometry truth; equivalence over
approximation for every cache/reuse/early-out; Plan/3D/visitor parity is correctness; visitor
isolation and the landed reference contracts unchanged.

```text
STATUS: planning
STAGE: umbrella landed; child slices proposed, none approved; the post-P23 execution order is
owner-ratified and recorded in the SEQUENCE block below
CURRENT: none in execution — P23B planning
NEXT: Phase 0 owner authorization (cycle, step 1 of the SEQUENCE below) — NOT P23B measurement
GATE: no implementation approved — P23B implementation waits for Phase 0 adjudication and any
      justified Phase 1 response
```

```text
PHASE 0 GATE:
  The architecture cycle is PHASE_0_DUE (owner-gated, recorded by the P23 close; PR #73).
  Discovery, harvest, research, synthesis, planning and non-mutating profiling may proceed before
  and during Phase 0; committing benchmark code waits for implementation authorization.
  P23B IMPLEMENTATION does not start before Phase 0 adjudication AND any justified Phase 1
  response, and then only on an owner-ratified child plan. A justified Phase 1 response is
  installed first; if none is justified the cycle enters STEADY and P23B is unblocked. No audit is
  run here and no cycle mechanism changes. Validation-window ownership remains a cycle decision.
  live state → ../../operations/architecture-cycle.md
```

```text
SEQUENCE — the owner-ratified post-P23 order. THIS BLOCK IS THE ONE AUTHORITATIVE COPY;
no other document restates the order. It is deliberately sequential for evidence quality, not
optimized for elapsed time: measurement informs harvest, harvest informs external research, and
all three inform synthesis.
 1  PR #74 merge → Phase 0 owner authorization
 2  Phase 0 completed: two independent architecture reviews + the separate structural-workflow
    diagnostic, then owner adjudication                                    [CYCLE]
 3  Install any justified Phase 1 response; if none is justified, enter STEADY   [CYCLE]
 4  P23B.0 — reproduce the curved-room slowdown and establish the measured baseline on the
    existing benchmark infrastructure (read-only profiling until implementation authorization;
    the permission boundary is stated once, in the PHASE 0 GATE block above)
 5  P23B.1 — internal codebase harvest, guided by the profiling evidence
 6  P23B.2 — external precedent research (Pascal, Three.js, mature geometry systems, Workers,
    Rust/WASM), targeted at the diagnosed problems
 7  P23B.3 — synthesize measurement, internal findings and external research into the
    optimization direction
 8  OWNER RATIFICATION GATE — owner ratifies the implementation plan and the performance
    acceptance criteria; no optimization slice is authorized before this gate
 9  P23B.4–P23B.8 execute, verify and review; then the P23B.9 correctness +
    performance-regression gate and the P23B.10 closeout gate
```

```text
ROUTE:
umbrella (WHAT/WHY/BOUNDARIES/DEPENDENCIES/GATES; not the order) →
  2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
harvest / research / synthesis → none yet (P23B.1 · P23B.2 · P23B.3 proposed)
child plans → none yet (proposed only; no implementation-ready brief)
measurement → none yet (P23B.0 proposed)
phase status/order → ../README.md
P26 planning (parallel; not the primary next action) → ../p26-spatial-depth/README.md
P23 (closed, evidence only) → ../p23-layout-depth/README.md
```

```text
DEPENDS ON: P23 closed 2026-09-22 (wall-first Plan editor minimum, one canonical geometry compiler)
EXECUTION ORDER: pinned by phase README depends-on, not by P-number order
PIPELINE POSITION: P23 → P23B → P26 → P24 → P25
```

## Authorities

- Umbrella: [`2026-09-22-P23B-geometry-performance-stabilization-umbrella.md`](./2026-09-22-P23B-geometry-performance-stabilization-umbrella.md)
- P-level status/order: [`../README.md`](../README.md)
- Product baton: [`../../operations/current.md`](../../operations/current.md)
- Operating cycle (meta, owner-gated): [`../../operations/architecture-cycle.md`](../../operations/architecture-cycle.md)
- Carried P23 verification debt: [`../p23-layout-depth/README.md`](../p23-layout-depth/README.md) §Completed slices · [`../../operations/tech-debt/README.md`](../../operations/tech-debt/README.md)

## Proposed child slices — proposed only

Status here and in the umbrella is `proposed`. None is approved, none is implementation-ready,
and no numerical performance target is committed. Contracts that already exist and must be
extended rather than duplicated: `apps/editor/src/lib/bench/` (versioned bench contract,
provenance, budgets, recorded baseline) and the PERF test lane.

Inventory only — the order and its gates are the SEQUENCE block above; rationale and dependencies
are the umbrella's.

```text
P23B.0  measurement foundation — reproduce the curved-room slowdown + measured baseline
P23B.1  internal geometry-pipeline harvest (guided by the P23B.0 evidence)
P23B.2  external precedent research (targeted at the diagnosed problems)
P23B.3  synthesis + optimization direction  → owner ratification gate → P23B.4–P23B.8
P23B.4  compilation + invalidation optimization
P23B.5  caching and reuse optimization
P23B.6  rendering optimization
P23B.7  interaction optimization
P23B.8  conditional Rust/WASM evaluation (decision only; "not justified" is a valid close)
P23B.9  correctness + performance-regression gate
P23B.10 phase closeout gate (makes P23B CLOSABLE; closure stays owner-invoked)
```

**Startup stop:** a reader has what this phase currently needs once status, the SEQUENCE block, the
Phase 0 gate and the umbrella route are read. No child plan or research artifact exists yet, and the
immediate action is Phase 0 owner authorization — not P23B measurement.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
