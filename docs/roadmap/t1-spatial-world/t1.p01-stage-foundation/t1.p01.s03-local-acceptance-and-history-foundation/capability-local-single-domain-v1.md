# `F4.intent-acceptance@1:local-single-domain-v1` — accepted capability record

**Capability:** `F4.intent-acceptance@1:local-single-domain-v1` · **Status:** retired (2026-10-19 by `T3.P01.S04` phase B) · **Gate:**
[`F4.intent-acceptance@1`](../../../README.md#gate-register) · **Provider:** `T1.P01.S03`

F.4 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F4.intent-acceptance@1:local-single-domain-v1` | [AM-4 F4 local acceptance](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | `current-source@5` (wall-first Layout / world-local Scene) — retired | `F4.intent-acceptance@1:acceptance-invariants-v1`, `F1.reference@1:references-v1` | `T1.P01.S03` | `packages/project-model/src/f4/index.ts` | `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts`, `apps/editor/tests/lib/authoring/f4-acceptance.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/acceptance.md` | `8ec0c5f1` |

## Scope of this acceptance

Current-source candidates receive full project validation, host Scene resolution and visitor
`prepareRuntime`; newly introduced blocking Layout compilation issues refuse. Conformance proves a
canonical-planner Layout change and validated Scene scalar change, rollback/refusal behavior,
Camera/resource/domain preservation, content identity invariance and distinctness, Undo to identical
authored contents, cursor handling, and public-route isolation from editor coordinator/history.
Compound, unit, resource-changing and unsupported planner registrations refuse. The current-source
scope was retired by `T3.P01.S04` phase B on 2026-10-19: its admission module and tests were removed,
no live caller or unfinished consumer requires it, and the F.4 contract remains source-agnostic. This
record stays as the historical acceptance evidence only.

## Residuals

This record accepts no F2/unit, compound/resource, Save, cloud or host-wiring readiness. The integrated
result remains routed to `T1.P01.S06`.
