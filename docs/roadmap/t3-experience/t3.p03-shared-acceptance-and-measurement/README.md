# T3.P03 — Shared acceptance, isolation and measurement

**Phase:** T3.P03 · **Status:** registered 2026-10-22. Released scopes and their conditions are
the [release list](../../now.md). The [production hold](../../README.md#production-implementation-hold)
covers every scope that list omits · **Track:**
[T3](../README.md) · **Roadmap:** [gate register](../../README.md#gate-register) · **Runbook:**
[T3 operations](../../../operations/t3-experience/README.md) · **Contracts:**
[F.4 destination](../../../reference/composition-execution.md#product-convergence-destination),
[performance](../../../reference/components/performance.md)

This phase is the H0 shared correction. The [H0 launch scope](../../../archive/roadmap/coordination-2026-10/convergence-shared-foundation-2026-10-22.md)
keeps its rationale. Its slices ran under the historical
[batch E protocol](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#authorized-batch-e-2026-10-22); the
[coordination proposal](../../../archive/roadmap/coordination-2026-10/next-batch-2026-10-22.md) keeps the gap findings behind it.

## Why a T3 phase with two slices

T3 coordinates the F4 unit-acceptance host and owns Preview, so H0 registers through T3; T1 reviews
the Stage and visitor-boundary changes. The proposal declared an `architecture-integration` tier
without an integration route. Two slices resolve that and shorten the critical path:

- **S01** is the correctness prerequisite every first-wave product slice waits for. It merges first.
- **S02** installs the authorized on-demand measurement workflow and is the phase's exhaustive
  final gate. Product slices can start once S01 merges; until S02 lands, a consuming slice may
  record equivalent manual DevTools evidence with its limits stated.

No product feature, source encoding or accepted capability changes. The one exported-shape addition
(a compound planner's declared write set) implements the ratified
[F.4 destination](../../../reference/composition-execution.md#product-convergence-destination)
"declared domain/compound scope" and is an optional field of the existing accepted interface.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T3.P03.S01 | shipped | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1 | — | [Planner scope and build isolation](./t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md) | [record](./t3.p03.s01-planner-scope-and-build-isolation/acceptance.md) | historical Batch E permission 2026-10-22 ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E2); merges first; accepted 2026-10-22 as `owner-override` (independent-review verdict waived, [ruling](./t3.p03.s01-planner-scope-and-build-isolation/acceptance.md#owner-ruling--independent-review-verdict-waived-2026-10-22)) |
| T3.P03.S02 | shipped | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1 | — | [Measurement workflow and final gate](./t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md) | [record](./t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md) | historical Batch E permission 2026-10-22 ([record](../../../reference/decisions/batch-e-authorization-2026-10-22.md), E2); accepted and shipped 2026-10-23 as `owner-override` at `eabd4b889bdb52d0b149b6f58aab6c4788e39952`; open trace/hard-row/calibration items remain explicitly unclaimed |

Every consumed gate is `accepted` and every required scope is `active` on `main` `f516e1ff`; each
slice rechecks them at its own trusted base through the runbook start step. Neither slice provides a
gate. `T3.P03.S01` merged on `main` is the start gate for `T1.P02.S01`, `T2.P02.S01` and
`T3.P02.S01` (batch E, E7).

```text
FINAL PHASE GATE: T3.P03.S02 → ./t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md

PHASE CLOSE
Stage:        closable
```

## Ownership and boundaries

| Area | Writer | Review |
| --- | --- | --- |
| F4 adapter/dispatcher (`packages/project-model/src/f4/`, `packages/project-model/src/units/acceptance.ts`), the editor coordinator and their tests | S01 (T3 F4 owner) | T1 and T2 confirm their single-domain planners still admit |
| Public/Preview boundary predicate, both Vite boundary plugins, boundary tests and their fixtures | S01 (visitor-boundary owner) | T1; T3 Preview consumer |
| Harness, its own config, bundle report, runtime-gated performance marks on existing flows, editor devDependency and explicit scripts | S02 (test-contract owner) | T1 for Stage marks; each later consumer adds its own flow marks |

Out of scope: Layout/Scene/Experience formats, native drawing, import, Preview UI, compile
deduplication (C1 owns it), any CI job, schedule or benchmark registry, and any timing assertion
in Vitest.

**Reference hardware.** S02 records its baseline and calibration median on the designated
reference machine, the owner's MacBook Air M2 with 16 GB ([batch E, E6 amendment](../../../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)).
Laptop A stays the accessibility target the budgets describe.

T3 has no architecture-cycle window; neither slice is an exposure. Production activation of the F2
epoch remains a separate owner-run operation and is not touched.
