# T3.P03 — Shared acceptance, isolation and measurement: registration draft

**Status:** registration-ready draft, 2026-10-22, for the H0 shared correction. It is **not
registered**: no row exists in the [T3 phase register](../README.md#phase-register), and nothing
here is a phase, slice, gate version, authorization or release from the
[production hold](../../README.md#production-implementation-hold). Scope rationale stays in the
[H0 proposal](../../convergence-shared-foundation-2026-10-22.md); sequencing, shared files and the
owner decisions stay in the [canonical batch](../../cross-track-execution.md#convergence-batch-and-next-planning-wave)
and its [coordination proposal](../../next-batch-2026-10-22.md). Routes: [T3](../README.md) ·
[runbook](../../../operations/t3-experience/README.md) · [gate register](../../README.md#gate-register).

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

## Registration is not authorization

| Act | What it does | What it does not do |
| --- | --- | --- |
| **Register T3.P03** | Adds the T3 phase-register row, turns this page into the phase README with a real slice register (both rows `proposed`) and `FINAL PHASE GATE: T3.P03.S02`, and creates the two acceptance stubs | Authorizes no slice, releases nothing from the hold, changes no gate row or capability entry, opens no architecture-cycle window |
| **Authorize S01/S02 and release T3.P03** | Flips both rows to `approved`, names T3.P03 alone as released from the hold | Releases no C1, C2 or T3.P02 scope; installs nothing before its own implementation starts |

## Proposed slice register (applies on registration)

| Slice | Consumes | Requires | Tier and route | Plan |
| --- | --- | --- | --- | --- |
| T3.P03.S01 | F2.unit-envelope@1, F4.intent-acceptance@1 | F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1 | `architecture-integration`, route S02 | [Planner scope and build isolation](./t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md) |
| T3.P03.S02 | as S01 | as S01 | `exhaustive` — the final gate | [Measurement workflow and final gate](./t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md) |

Every consumed gate is `accepted` and every required scope `active` on `main` `f516e1ff`. Each slice
rechecks them at its own trusted base through the runbook start step. Neither slice provides a gate.

```text
PROPOSED FINAL PHASE GATE: T3.P03.S02 (exhaustive; rechecks S01 on the integrated tree)
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

T3 has no architecture-cycle window; neither slice is an exposure. Production activation of the F2
epoch remains a separate owner-run operation and is not touched.
