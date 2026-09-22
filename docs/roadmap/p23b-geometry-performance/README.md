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
owner-ratified and recorded in the SEQUENCE block below. SEQUENCE steps 1–3 completed 2026-09-22
(Phase 0 authorized, evidence gathered and adjudicated, and the justified Phase 1 response
installed). SEQUENCE step 4 (P23B.0) has completed its two read-only profiling passes; their settled
interpretation is recorded in the P23B.1 plan §2. P23B.0's DURABLE work (committed fixtures,
recorded baselines with provenance, budgets) remains OUTSTANDING — it is not completed, replaced or
redefined by P23B.1
CURRENT: P23B.1 harvest EXECUTED — the plan was accepted at review and the harvest record is landed
      in the slice workspace, awaiting review. Discovery/evidence only: no optimization, defect fix
      or benchmark change; the correctness mismatch it locates stays open for the owner ruling
NEXT: P23B.1 review of the harvest record; on acceptance, P23B.2 — external precedent research
      (SEQUENCE step 6), targeted at the diagnosed questions in the record §11. Until then the slice
      stays inside the PHASE 0 GATE permission boundary and no optimization slice is authorized
GATE: no implementation approved — P23B implementation waits on an owner-ratified child plan
```

```text
PHASE 0 GATE:
  Phase 0 is closed. The owner adjudicated both lanes 2026-09-22 (record →
  ../architecture-operating-cycle/phase-0/adjudication.md) and the justified Phase 1 response is
  installed, so the cycle sits at PHASE_1. The installed clauses are landed reference authority and
  apply to P23B work as they stand: the Layout semantic-mutation boundary, Wall/Floor vertical
  authority, the persisted canonical curve model, and Junction commit-time identity under ruling R1.
  P23B records material early evidence about those mechanisms in its own artifacts. It does NOT open
  formal validation: the selected window is the cycle's (P26), and P23B is an ordinary product phase.
  Discovery, harvest, research, synthesis, planning and non-mutating profiling may proceed now;
  committing benchmark code waits for implementation authorization.
  P23B IMPLEMENTATION starts only on an owner-ratified child plan. P23B's owner-close is an ordinary
  product close executed from PHASE_1 as a same-state close, and its PHASE CLOSE block records
  `CYCLE TARGET: PHASE_1 (unchanged)` — the durable proof that the selected window's trigger
  survived it. No audit is run here and no cycle mechanism changes.
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
harvest (P23B.1 — plan ACCEPTED, harvest EXECUTED awaiting review) →
   p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-internal-geometry-pipeline-harvest.md
     (the accepted contract) · 2026-09-22-P23B.1-harvest-record.md (the executed harvest: FL-1 · CG-1 ·
     SC-1 · CI-1 · TO-1 · RT-1 · PO-1 · PM-1 · UN-1)
research / synthesis → none yet (P23B.2 · P23B.3 proposed)
child plans → none yet (proposed only; no implementation-ready brief)
measurement (P23B.0) → read-only profiling passes complete, no committed artifact; durable
          benchmark/fixture/baseline work outstanding (see the P23B.1 harvest record §11.1)
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
- Operating cycle (meta, live state): [`../../operations/architecture-cycle.md`](../../operations/architecture-cycle.md)
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
Phase 0 gate and the umbrella route are read. The child artifacts today are the P23B.1 plan (the
accepted contract) and its harvest record (the executed evidence, awaiting review); no research or
synthesis artifact exists, no implementation is approved, and P23B.0's durable benchmark work stays
outstanding.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
