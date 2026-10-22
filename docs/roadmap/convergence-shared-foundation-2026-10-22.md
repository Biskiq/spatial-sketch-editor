# H0 — shared acceptance, isolation and performance foundation

**Status: proposed launch scope, 2026-10-22.** Local label H0, not a registered phase, slice,
gate or authorization. Its registration-ready form is the
[T3.P03 draft](./t3-experience/t3.p03-shared-acceptance-and-measurement/README.md), whose slice
plans carry the exact implementation scope and acceptance. This page keeps the rationale. This is the concrete shared prerequisite recommended by
[the canonical batch](./cross-track-execution.md#convergence-batch-and-next-planning-wave).
Production remains under the [owner hold](./README.md#production-implementation-hold).
The owner reviews this bounded scope, assigns its normal provider registration and releases
that named implementation scope before work starts. Do not reopen a closed P01 phase.

## Outcome and integration owner

T3's F4 integration owner coordinates this scope, with T1 Stage and visitor-boundary review.
A planner cannot change units outside its declared scope; the public and Preview build checks
protect the current authoring tree; engineers can collect reproducible browser and bundle
evidence for the next product slices. No product feature, source encoding or gate identity changes.

T1 plans C1 and T2 plans C2 in parallel with this proposal. New C1/C2/S01 implementation starts
from the merged shared correction after its own authorization and release; planning has no H0
dependency. S01 retains its historical authorization and all its declared acceptance scope.

## Inputs and boundaries

- Use accepted `F1.reference@1`, `F2.unit-envelope@1`, `F4.intent-acceptance@1` and
  `T1.viewport-projection@1` as applicable, including `unit-resolution-v1`, `unit-envelope-v1`,
  `acceptance-invariants-v1`, `unit-acceptance-v1`, `conditional-save-units-v1` and
  `viewport-projection-v1`. Registration declares each consumed gate and required active scope
  against the trusted base. No new readiness comes from this proposal.
- Fix per-planner enforcement inside the existing unit acceptance path. Compare actual changed
  units with that planner's own declared domain and compound scope. Preserve legitimate joint
  Experience/Camera operations, stale/ABA refusal, one accepted install and snapshot history.
- Align public/Preview build forbidden patterns with `src/lib/authoring/**`. Retain the existing
  public source-closure test, which already rejects that whole tree. Keep runtime-safe evaluators
  shared; do not classify layout-core or Camera math as editor machinery.
- The on-demand browser measurement harness and bundle report have explicit owner authorization
  under the [ratified performance contract](../reference/components/performance.md). Install them
  only after H0 provider registration, implementation authorization and named hold release.
  Permanent workflow authorization is separate from bounded measurements and is already satisfied.
  No timing assertion enters Vitest and no CI, registry or scheduled performance job is added.
- Capture a production-build baseline on available hardware with exact machine, browser, power,
  workload, network and cache state. Reference A measurements qualify hard budgets; an M2 or
  uncalibrated developer run is labelled pre-flight, never a reference-laptop pass. A functional
  harness acceptance does not claim that the product meets unrun performance budgets.

## Owned changes and merge boundary

| Writer | Owned area | Required review |
| --- | --- | --- |
| T3 F4 integration owner | Existing `packages/project-model/src/f4/` and unit-acceptance contracts, editor `lib/authoring/f4/` wiring and their owning tests | T1/T2 consumers verify admitted single-domain behavior; preserve the existing joint planner |
| Visitor-boundary owner with T1 | Public/Preview build plugins, shared boundary predicates and existing boundary tests | T3 Preview consumer; mutation proof distinguishes editor machinery from allowed runtime math |
| Test-contract owner with T1 | One browser harness, its own config outside default lanes, bundle report and explicit package scripts/devDependency | Workflow authorized 2026-10-22; consume existing shared import readers; H0 implementation still held |

No Layout schema change, native drawing, own-model ingest, annotations, attachment format,
Camera mechanism replacement, API migration, T4 release reader or shell redesign enters H0.
Compile deduplication and any incremental/worker implementation stay in C1's measured scope.

## Acceptance and verification

The T3.P03 draft splits this into `T3.P03.S01` (scope and isolation, **architecture-integration**)
and `T3.P03.S02` (measurement, the **exhaustive** final gate), so the narrowed tier has its
integration route. Use
[the test contract](../../apps/editor/tests/README.md) for the implementation's complete repository
verification and required final gate; this proposal does not narrow it to the files above.

1. The RR-4 undeclared compound counterexample now refuses without changing the accepted revision,
   source or history. Equivalent Layout-only and Scene-only operations succeed in their own scopes.
   The legitimate Experience/Camera joint planner still succeeds atomically. No-op, thrown/stale
   candidate, Undo/Redo and replacement cases retain their existing proofs.
2. Boundary mutations importing editor machinery from the public root and Preview root fail in
   the respective build checks; controls importing runtime-safe domain evaluators remain green.
   Preserve existing source-closure coverage and explain the exact defect each changed test catches.
3. The browser harness identifies an input and the frame showing its corresponding result.
   Continuous drag metrics do not use Event Timing; eligible discrete interactions may use INP.
   A worker's eventual result is timed through its rendered completion, including stale-result
   rejection and replacement. Cold/repeated flows and memory-cycle records reproduce without
   touching a user's browser profile.
4. The bundle report records route load sets, compressed bytes and visitor-reachable modules on
   a production build. Reuse the research reporter or an equivalent; no additional dependency is
   required for a visual report. Every editor module is refused; solver/runtime inclusion is
   justified by visitor execution.
5. The acceptance record names baseline limitations and all unrun reference/GPU rows. Manual
   DevTools evidence can substitute until the authorized permanent harness is installed, with its limitations
   stated. Each later consuming slice must meet its own hard budgets before acceptance; the phase
   final gate rechecks integrated behavior rather than deferring a slice's miss.

## Owner decision and follow-through

The immediate owner act is to accept or edit this launch scope, register its provider through
the owning track, and explicitly release H0 from the hold. Those acts authorize H0 alone. They authorize neither C1/C2 nor S01
resumption. After H0 merges, the next batch review can release the clarified S01 and authorize
reviewed/registered C1/C2 launch plans. Each track updates only its own operational baton.

Evidence: [RR-4 scope counterexample](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/relationships-and-revision.md),
[performance and delivery packet](../../broad-research/post-p01-roadmaps/convergence-2026-10-21/performance-and-delivery.md),
and [convergence amendments](./product-convergence-2026-10-21-amendments.md). The hold, accepted
gate identities, phase closures and existing authorization records are unchanged by this file.
