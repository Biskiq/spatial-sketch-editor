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
STAGE: umbrella landed; child slices proposed, none approved
CURRENT: none in execution — P23B planning
NEXT: owner review of the umbrella and the proposed child slices; measurement (P23B.0) and the
      parallel harvest/research (P23B.1 · P23B.2) are the first proposal
GATE: no implementation approved — P23B implementation waits for Phase 0 adjudication and any
      justified Phase 1 response
```

```text
PHASE 0 GATE:
  The architecture cycle is PHASE_0_DUE (owner-gated, recorded by the P23 close; PR #73).
  Discovery, harvest, research, synthesis, planning and non-mutating profiling may proceed before
  and during Phase 0; committing benchmark code waits for implementation authorization.
  P23B IMPLEMENTATION does not start before Phase 0 adjudication AND any justified Phase 1
  response, and then only on an owner-ratified child plan. No audit is run here and no cycle
  mechanism changes. Validation-window ownership remains a cycle decision.
  live state → ../../operations/architecture-cycle.md
```

```text
ROUTE:
umbrella (WHAT/WHY/BOUNDARIES/ORDER/GATES) →
  2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
harvest / research / synthesis → none yet (P23B.1 · P23B.2 · P23B.3 proposed)
child plans → none yet (proposed only; no implementation-ready brief)
measurement → none yet (P23B.0 proposed)
phase status/order → ../README.md
P26 planning (unaffected) → ../p26-spatial-depth/README.md
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

P23B.0's measurement *planning* and non-mutating profiling may proceed before Phase 0 adjudication;
committing benchmark code (fixtures, harness, baselines, budgets) waits for implementation
authorization.

```text
P23B.0  measurement foundation — reproducible benchmark + bottleneck ledger
P23B.1  internal geometry-pipeline harvest        ┐ parallel discovery
P23B.2  external precedent research               ┘ → P23B.3 synthesis
P23B.3  synthesis + optimization direction (gates P23B.4–P23B.8)
P23B.4  compilation + invalidation optimization
P23B.5  caching and reuse optimization
P23B.6  rendering optimization
P23B.7  interaction optimization
P23B.8  conditional Rust/WASM evaluation (decision only; "not justified" is a valid close)
P23B.9  correctness + performance-regression gate
P23B.10 phase closeout gate (makes P23B CLOSABLE; closure stays owner-invoked)
```

**Startup stop:** a reader has what this phase currently needs once status, the Phase 0 gate, the
umbrella route and the proposed-children list above are read — no child plan or research artifact
exists yet.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
