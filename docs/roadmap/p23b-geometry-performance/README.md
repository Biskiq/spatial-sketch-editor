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
owner-ratified and recorded in the SEQUENCE block below. SEQUENCE steps 1–3 completed 2026-09-22.
Step 4 (P23B.0) completed its two read-only profiling passes and their reports are archived verbatim as
historical evidence; the settled interpretation is recorded in the P23B.1 plan §2. P23B.0's DURABLE work
(committed fixtures with identity, a committed control matrix, recorded baselines with provenance,
budgets) remains OUTSTANDING — archiving the reports is NOT a recorded benchmark baseline.
Step 5 (P23B.1) executed its harvest. Step 6 (P23B.2) IS SATISFIED AS TO ARTIFACT: the verbatim external
research report (Q1–Q9, source index with pinned revisions, validity precedents, handoff matrix and
explicit unknowns) is landed and awaiting evidence review. Step 7 (P23B.3) is AUTHORED: synthesis +
optimization direction, the curved-crossing owner decision record, the implementation/dependency map,
and concrete plans for P23B.0-durable and P23B.4–P23B.10. Nothing is implemented.
CURRENT: P23B.3 AUTHORED, AWAITING OWNER RATIFICATION (SEQUENCE step 8). All required evidence exists;
      discovery, synthesis and planning only — no optimization, no defect fix, no benchmark/fixture/
      baseline change, no mechanism, no cycle transition. The P23B.1 harvest record and the P23B.2
      research report are each still marked awaiting review by their own status.
NEXT: owner review of P23B.3 at the ratification gate: ratify the synthesis + acceptance criteria, rule
      on the curved-crossing policy, and accept or return the P23B.2 evidence. Until then NO benchmark
      implementation, no topology fix and no P23B.4–P23B.8 optimization is authorized, and the slice stays
      inside the PHASE 0 GATE permission boundary.
GATE: PHASE 0 GATE is satisfied (below) but the RATIFICATION GATE (SEQUENCE step 8) is NOT: no
      implementation is approved until the owner ratifies the implementation plan and the performance
      acceptance criteria. P23B.3 is the document that gate reviews. No numerical target is proposed.
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

> **SEQUENCE is unchanged.** The block above is byte-identical to its ratified form. P23B.3 did not
> reorder, restate or reinterpret it, and it is not amended here.

```text
ROUTE:
umbrella (WHAT/WHY/BOUNDARIES/DEPENDENCIES/GATES; not the order) →
  2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
harvest (P23B.1 — plan ACCEPTED; harvest record EXECUTED, awaiting review) →
  p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-internal-geometry-pipeline-harvest.md
    (the accepted contract) · 2026-09-22-P23B.1-harvest-record.md (the executed harvest: FL-1 · CG-1 ·
    SC-1 · CI-1 · TO-1 · RT-1 · PO-1 · PM-1 · UN-1)
research (P23B.2 — verbatim report landed, awaiting evidence review; folded into P23B.3 as context,
        never as authority) →
  p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
  (source index has pinned URLs; chat-specific <Cite> tags preserved in the verbatim text)
synthesis (P23B.3 — AUTHORED, awaiting owner ratification) →
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md
    (the authoritative reconciliation + direction + §8 dependency evidence + §9 owner decisions)
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md
    (the operational map: prerequisites, gates, oracles, abandonment, deferrals)
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md
    (the correctness/policy decision record — owner decision required)
child plans (plans only — no implementation is approved) →
  p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md   (prerequisite)
  p23b.4-compilation-invalidation-optimization/2026-09-22-P23B.4-compilation-invalidation-optimization.md
  p23b.5-caching-reuse-optimization/2026-09-22-P23B.5-caching-reuse-optimization.md
  p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md
  p23b.7-interaction-optimization/2026-09-22-P23B.7-interaction-optimization.md
  p23b.8-rust-wasm-evaluation/2026-09-22-P23B.8-rust-wasm-evaluation.md
  p23b.9-correctness-performance-gate/2026-09-22-P23B.9-correctness-performance-gate.md
  p23b.10-phase-closeout/2026-09-22-P23B.10-phase-closeout.md
measurement evidence (P23B.0 — archived read-only reports; NOT benchmark baselines) →
  p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-a-12-curved-walls.md
  p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-b-owner-40-curved-walls.md
  (historical local /private/tmp runner paths in Pass A are not committed; reported source hashes
  cannot be independently verified from repository fixture bytes)
durable measurement (P23B.0) → fixtures, harness, reproducible recorded baseline and budgets
          outstanding → the P23B.0-durable plan above and the P23B.1 harvest record §11.1
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
- P23B.3 synthesis and direction: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md)
- P23B.3 operational dependency map: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md)
- Curved-crossing owner decision record: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md)
- P-level status/order: [`../README.md`](../README.md)
- Product baton: [`../../operations/current.md`](../../operations/current.md)
- Operating cycle (meta, live state): [`../../operations/architecture-cycle.md`](../../operations/architecture-cycle.md)
- Carried P23 verification debt: [`../p23-layout-depth/README.md`](../p23-layout-depth/README.md) §Completed slices · [`../../operations/tech-debt/README.md`](../../operations/tech-debt/README.md)

## Child slices — planning status

`planned` means a plan exists and is **unratified**; it does not mean approved, implementation-ready or
complete. `proposed` means no plan exists. Contracts that already exist and must be extended rather than
duplicated: `apps/editor/src/lib/bench/` (versioned bench contract, provenance, budgets, recorded
baseline) and the PERF test lane.

Plan status, not order — the order and its gates are the SEQUENCE block above; dependencies are P23B.3 §8
and the dependency map.

```text
P23B.0  measurement foundation — read-only passes DONE and archived; the durable completion is PLANNED
        (prerequisite), including the committed control matrix the reports only reported
P23B.1  internal geometry-pipeline harvest — plan ACCEPTED; harvest record EXECUTED, awaiting review
P23B.2  external precedent research — report LANDED VERBATIM (Q1–Q8 answered, Q9 deferred), awaiting
        evidence review; folded into P23B.3
P23B.3  synthesis + optimization direction — AUTHORED, awaiting owner ratification
P23B.4  compilation + invalidation optimization — PLANNED, unratified
P23B.5  caching and reuse optimization — PLANNED, unratified
P23B.6  rendering optimization — PLANNED, unratified
P23B.7  interaction optimization — PLANNED, unratified
P23B.8  conditional Worker + Rust/WASM evaluation (decision only; "not justified" is a valid close) —
        PLANNED, unratified
P23B.9  correctness + performance-regression gate — PLANNED, unratified
P23B.10 phase closeout gate (makes P23B CLOSABLE; closure stays owner-invoked) — PLANNED, unratified
```

**Owner decisions open at this gate** (synthesis §9 and the decision record):

```text
1  RATIFY P23B.3 + the acceptance criteria for every slice plan (or amend them).
2  RULE on curved-crossing validity (options A–D, decision record §5). It blocks M-2b verdict reuse and
   the polarity of the negative fixture. P23B.3 §6.5 O-3 records that the external research reaches the
   same precondition independently.
3  ACCEPT, PART-RETURN or REQUIRE A REVIEW of the P23B.2 evidence (synthesis §9.2). P23B.3 stands either
   way: every mechanism is motivated by our own evidence and admitted by our own oracle.
4  Optional: the umbrella's five pre-existing open calls (fixtures/device profiles, enforced budgets,
   P23 Decision 13, Rust/WASM authorization, any numeric target) — synthesis §9.3 records the position.
```

**Startup stop:** a reader has what this phase currently needs once status, the SEQUENCE block, the phase
gate and the ROUTE block are read. All required evidence is landed (two archived P23B.0 reports, the
P23B.1 plan + harvest record, the P23B.2 research report); P23B.3's three artifacts and the eight child
plans are written but unratified; no implementation is approved; the P23B.1 harvest record and the P23B.2
report are each awaiting review; durable P23B.0 measurement work is outstanding.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
