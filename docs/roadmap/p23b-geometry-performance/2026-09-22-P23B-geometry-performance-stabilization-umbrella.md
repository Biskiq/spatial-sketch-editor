# P23B — Geometry Performance & Stabilization umbrella

**Created:** 2026-09-22 · **Status:** planning (tracker authoritative)
**Depends on:** P23 closed 2026-09-22 — the wall-first Plan editor minimum with one canonical
geometry compiler (`compileLayoutGeometry()` family) serving Plan, 3D and visitor.
**Phase 0 gate:** P23B **implementation** waits for Phase 0 adjudication (owner direction recorded
here; the cycle is `PHASE_0_DUE` and owner-gated). Discovery, harvest, research, synthesis and
planning may proceed before and during Phase 0.
**Evidence basis:** the owner-observed interaction symptom below; the landed canonical geometry
pipeline; the existing G3 benchmark harness. **No profiling, harvest or research has been executed
for this plan yet** — this document is scope and order, not findings.
**Planning model:** progressive — this umbrella owns WHAT/WHY/BOUNDARIES/ORDER/RESEARCH GATES and
high-level acceptance. It authorizes no implementation, no numerical target and no child slice.

## Outcome

P23B makes the shipped wall-first geometry pipeline stay fluid as curved and multi-room
architecture grows, and makes that speed **reproducible and regression-guarded** rather than
incidental.

It changes **cost**, not **capability**. The architecture the user outcome depends on is
preserved exactly:

```text
LayoutDocument (canonical truth)
  → one compiler: compileLayoutGeometry() / compileWallFirstLayoutGeometry()
  → Plan render model · 3D meshes · visitor
```

P23B adds no view, no document, no schema, no persisted format and no second geometry truth.

## Owner-observed problem

> Three rooms with four Bézier walls each already cause choppy interaction.

Recorded as the phase's motivating observation, verbatim in substance. It is a **symptom, not a
diagnosis.** Which stage pays the cost — curve sampling, self-intersection/noding, junction
resolution, the acceptance compile, cache invalidation and re-derivation, Plan render-model build,
3D mesh build, or per-frame interaction work — is exactly what measurement (P23B.0) is for. This
umbrella asserts no cause and no numeric target.

## Why a dedicated phase, and why here

P23 shipped the capability with performance explicitly bounded out of its acceptance: bounded
curved-Wall authoring, and incremental Junction invalidation recorded as an accepted non-goal
(P23 Decision 13). Performance therefore had no owner once P23 closed. P23B is the bounded place
where geometry *cost* becomes the goal, inserted between P23 and P26 so P26, P24 and P25 inherit a
measured, guarded baseline instead of optimizing under new feature pressure.

P23B does **not** reopen P23. P23's close record, carried verification rows and deferred debt are
historical and stay as they are. Where a P23 non-goal is genuinely implicated (Decision 13 is the
candidate), P23B may *measure* it; changing an accepted P23 decision is an explicit owner call
recorded here when it happens, never an implication of this umbrella.

## Scope

```text
IN
- performance profiling and reproducible, versioned benchmarks
- parallel internal codebase harvest + external precedent research, then one synthesis
- optimization of: compilation · invalidation · caching/reuse · rendering · interaction
- conditional Rust/WASM evaluation, driven by measured bottlenecks only
- correctness, performance-regression and closeout gates

OUT (explicit non-goals)
- no new architectural capability, view, mode, document or persisted/schema change
- no mandatory Rust migration and no WASM requirement; no new build or runtime target
- no premature repository split or new package/boundary without a measured, demonstrated need
- no reopening P23; no Phase 0 execution; no new standing audit or cycle mechanism
- no numerical performance target ratified by this plan
```

## Architecture boundaries (invariants any optimization must preserve)

- **One compiler.** `LayoutDocument` → the canonical compiler → Plan/3D/visitor. No second
  compiler, no parallel geometry truth, no per-surface geometry that can drift.
- **Equivalence over approximation.** A cache hit, a reuse guard or a broad-phase early-out must be
  provably equivalent to the recomputation it replaces (the equivalence-first discipline P23.11
  already used for the Bend path). Approximate geometry is a product change, not an optimization.
- **Parity is correctness.** Plan, 3D and visitor consume the same compiled result; a speedup that
  changes one surface's answer fails the correctness gate, not the performance gate.
- **Isolation preserved.** No optimization may pull editor-only code into visitor chunks or defeat
  the visitor bundle gate through a "shared fast path".
- **Ownership and contracts unchanged.** `LayoutDocument`/`SceneDocument` separation, one
  navigation/motion system, and the landed reference contracts (including the shell/visual-system
  contract) are untouched.

## Proposed child slices — proposed only, none approved

Sequence below is the *proposed* order; the phase README owns final order and status, and
`depends-on` — not the P-number — pins execution. No child is implementation-ready and no numeric
budget appears here: budgets come from measured evidence and an owner ratification.

| # | Proposed slice | Kind | Purpose |
|---|----------------|------|---------|
| P23B.0 | Measurement foundation | measurement | Make the symptom reproducible: fixture set (including the observed three-room / four-Bézier-wall case), profiling method, recorded baselines with provenance, and a bottleneck ledger naming where time actually goes |
| P23B.1 | Internal geometry-pipeline harvest | discovery (parallel) | Trace the pipeline end-to-end — compile, resolve, cache/invalidation, Plan render model, 3D mesh, interaction — into a stage-cost map and a cache/invalidation inventory |
| P23B.2 | External precedent research | discovery (parallel) | How mature CAD/DCC/web editors structure incremental compilation, invalidation, caching, curve tessellation and batched rendering at authoring densities |
| P23B.3 | Synthesis + optimization direction | synthesis | One authoritative conclusion: which optimization areas are in scope, in what order, and whether Rust/WASM evaluation is warranted at all |
| P23B.4 | Compilation + invalidation optimization | optimization | Reduce per-edit recomputation and unnecessary re-derivation on the canonical compile path |
| P23B.5 | Caching and reuse optimization | optimization | Make cache keys, reuse guards and invalidation honest and demonstrably sufficient — reuse only what is provably equivalent |
| P23B.6 | Rendering optimization | optimization | Plan render-model/3D mesh cost at authoring densities, without changing compiled truth or parity |
| P23B.7 | Interaction optimization | optimization | Drag/gesture, hit-test, snap and preview-install cost per frame |
| P23B.8 | Conditional Rust/WASM evaluation | evaluation | Decision record for a measured, compute-bound hot path — which may legitimately conclude "not justified" |
| P23B.9 | Correctness + performance-regression gate | gate | Prove equivalence and hold the line against regression on named fixtures |
| P23B.10 | Phase closeout gate | gate | Final phase gate; makes P23B closable (closure stays an owner-invoked decision) |

Dependencies, stated without scheduling: P23B.0 precedes every optimization slice; P23B.1 and
P23B.2 are parallel and precede P23B.3; P23B.3 gates P23B.4–P23B.8; P23B.8 may close with a
recorded "not justified"; P23B.9 precedes P23B.10.

## Measurement basis — extend what exists, invent nothing

The repository already owns a versioned benchmark contract and must not grow a second one:

- `apps/editor/src/lib/bench/` — versioned bench contract and provenance, Node and browser tiers,
  enforced vs advisory budget metrics, budget checking, a recorded baseline and a baseline
  recorder (`bench:record` in the editor app);
- the **PERF test lane** in the test contract (timing/budget gates), which already holds
  `bend-perf` plus the bench measurement/budget files;
- the dev perf routes, and the opt-in `p2311Measure` diagnostic marks (P23.11) on the compile,
  junction-resolve, snap, curve and mesh paths.

P23B.0's job is to extend this harness to the observed authoring case and to the curve/multi-room
densities that matter, with recorded provenance — not to build a new rig.

## Discovery anchors (starting points, not an exhaustive list)

Evidence to inspect, listed so the harvest starts from real seams rather than a symbol hunt:

```text
compile        packages/layout-core/src/layout-geometry.ts
               (compileLayoutGeometry · compileWallFirstLayoutGeometry · compileLayoutGeometrySource ·
                cacheKeyOf)
acceptance     packages/layout-core/src/layout-wall-first-precision.ts  (acceptance-compile)
curves         packages/layout-core/src/layout-geometry-curve.ts · layout-wall-curve-algebra.ts
junctions      packages/layout-core/src/layout-junction-resolution.ts
snap           packages/layout-core/src/layout-snap.ts  (derived index memoized by geometry identity)
Plan           apps/editor/src/lib/layout/plan-render-model.ts
3D meshes      apps/editor/src/lib/layout/wall-mesh-builder.ts ·
               apps/museum/src/lib/layout/wall-mesh-builder.ts
interaction    apps/editor/src/lib/editor/layout/layout-interaction.ts ·
               layout-transient-edit.ts · layout-preview-state.svelte.ts
```

Internal harvest and external research are **evidence, not architecture authority**; landed
reference contracts and the roadmap keep authority.

## Conditional Rust/WASM evaluation — a decision, not a mandate

P23B.8 evaluates; it does not migrate. The evaluation is admitted only where measurement shows a
hot path that is compute-bound rather than DOM/render-bound, **and** survives the TypeScript and
algorithmic work of P23B.4–P23B.7. Even then it must satisfy:

- one geometry truth preserved — a WASM core may not become a second source of compiled geometry;
- exact result equivalence with the TypeScript path, with the equivalence tested, not assumed;
- no mandatory toolchain or build-target change for contributors or deploys;
- a visitor-safe bundle boundary and an honest statement of what the guard does not prove.

"Not justified" is a **successful** outcome and the expected default; it must be recorded with the
measurement that produced it.

## Gates

```text
CORRECTNESS GATE
  compiled geometry equivalence on equivalence tests (cache/reuse/early-out vs recompute);
  Plan/3D/visitor parity on the acceptance fixture; determinism and identity preserved;
  full applicable repository suites, typecheck/build, and the visitor bundle gate.

PERFORMANCE-REGRESSION GATE
  named fixtures at recorded provenance; enforced budget metrics where the owner ratifies them;
  relative cost assertions where a wall-clock floor would be dishonest (the P23.11 Bend precedent);
  no timing assertion that passes or fails on machine noise alone.

CLOSEOUT GATE
  a final phase gate in the P23.16 pattern: accepted exit criteria make P23B CLOSABLE;
  closure is an owner-invoked `phase-closeout` decision, never automatic.
```

## Relationship to other phases and to the operating cycle

- **P23** stays closed. Its 13 owner-carried verification rows and 5 deferred debt items remain
  owed and explicit; P23B neither claims nor silently closes them, and adds its own owed rows
  through its gates.
- **P26** research and planning artifacts are untouched. P26's implementation now follows P23B in
  the pipeline; P26 planning may continue in parallel.
- **P24 / P25** are downstream and unaffected in scope.
- **Operating cycle:** the cycle is `PHASE_0_DUE` with `OWNER ACTION: required` and an empty
  validation window. This plan does not change cycle mechanisms, does not run audits, and invents
  no standing audit. Whether P23B is the cycle's validation window is a cycle decision, not a P23B
  planning decision.

## Open owner calls

1. Which fixture(s) authoritatively represent the observed symptom, and on which device profiles
   budgets are enforced.
2. Which (if any) measured budgets become enforced rather than advisory at P23B.9.
3. Whether P23 Decision 13 (incremental Junction invalidation as an accepted non-goal) is reopened
   on measured evidence.
4. Whether a Rust/WASM path is ever authorized, and if so under which equivalence contract.
5. Owner ratification of any numeric target — none is proposed in this plan.

## Registration rule

P23B is a phase tier directed by the owner and placed between P23 and P26 — not an
umbrella-internal subtrack label in the P24A/P24B sense. It consumes no existing phase number,
shifts no other phase, and its children are ordinary phase children in one flat `P23B.x` namespace.

This umbrella authorizes **no** implementation: a child optimization slice becomes actionable only
after P23B.0/P23B.3 evidence, an owner-ratified child plan, and Phase 0 adjudication.
