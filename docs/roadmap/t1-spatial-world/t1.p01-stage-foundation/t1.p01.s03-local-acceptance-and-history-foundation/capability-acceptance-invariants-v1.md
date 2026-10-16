# `F4.intent-acceptance@1:acceptance-invariants-v1` — accepted capability record

**Capability:** `F4.intent-acceptance@1:acceptance-invariants-v1` · **Status:** active · **Gate:**
[`F4.intent-acceptance@1`](../../../README.md#gate-register) · **Provider:** `T1.P01.S03`

F.4 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F4.intent-acceptance@1:acceptance-invariants-v1` | [AM-4 F4 local acceptance](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | source-independent lifecycle | `F1.reference@1:references-v1` | `T1.P01.S03` | `packages/project-model/src/f4/index.ts`, `apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts`, `apps/editor/src/lib/authoring/f4/history.ts` | `apps/editor/tests/lib/authoring/f4-acceptance.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/acceptance.md` | `8ec0c5f1` |

## Scope of this acceptance

One immutable accepted revision per accepted change, one atomic validated install and undo result,
fresh revision identity, canonical authored-content comparison, stale/ABA and superseded-generation
refusal, serialized admission, bounded chronological history, exact source restoration, redo
truncation, and no history for no-op/refused/cancelled work. The preparation extension is
source-independent; synthetic-source conformance does not accept F2, unit, compound or resource
capabilities. Correspondence is data only.

## Residuals

Host/Stage installation, commands, replacement baseline, selection requalification and Camera-output
rebase remain S04. Allocating production planners must capture IDs and preserve their domain's
allocation high-water discipline. The integrated result remains routed to `T1.P01.S06`.
