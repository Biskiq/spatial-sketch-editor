# `F4.intent-acceptance@1:unit-acceptance-v1` — accepted capability record

**Capability:** `F4.intent-acceptance@1:unit-acceptance-v1` · **Status:** active · **Gate:**
[`F4.intent-acceptance@1`](../../../README.md#gate-register) · **Original gate provider:**
`T1.P01.S03` · **Extension slice:** `T3.P01.S05`

F.4 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F4.intent-acceptance@1:unit-acceptance-v1` | [AM-2 F2 unit envelope](../../../../reference/composition-execution.md#am-2-f2-unit-envelope-v1), [AM-4 F4 local acceptance](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | `F2.unit-envelope@1` (`unit-envelope`) | `F1.reference@1:unit-resolution-v1`, `F2.unit-envelope@1:unit-envelope-v1`, `F4.intent-acceptance@1:acceptance-invariants-v1` | `T3.P01.S05` | `packages/project-model/src/units/planning.ts`, `packages/project-model/src/units/acceptance.ts`, `packages/project-model/src/units/acceptance-staging.ts`, `packages/project-model/src/f4/unit-acceptance.ts` | `apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts`, `apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts`, `apps/editor/tests/lib/project-model/unit-resolution-conformance.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md` | `d7ab698418f1c705dff9d76524af8140fe9f1466` |

## Scope of this acceptance

Two real F.2 candidate planners: a single-domain Camera View update and a compound operation that
creates one Camera View, one Presentation and, when requested, one Stop inserted into an authored
Guide — one candidate, one install, one undo result. Planning captures ids before work, reads payloads
strictly, resolves every pre-existing subject against the supplied snapshot and refuses duplicate or
conflicting identities.

Admission validates the candidate through the one agreed envelope validator, re-derives unit content
revisions and unit-scoped lock revisions from the candidate's own bytes, resolves every dependency-lock
entry through F.1, and refuses executable resource closure failures. Resource targets stage through
F.1 against the accepted snapshot; a changed resource's new identity is the intent's authored identity
on the candidate registry and must equal the captured staging set. Compound and resource grants come
from one profile factory, so registry admission and adapter admission cannot diverge.

Installation reuses the landed `acceptance-invariants-v1` coordinator: one immutable admitted source,
one minted revision, one bounded chronological history, stale/epoch rejection, rollback on every
refusal and whole-operation undo/redo. F.1 read contexts name the accepted snapshot's revision and
digest; the envelope's embedded `acceptedRevision` remains baseline provenance so byte-exact history
is preserved and no second revision is minted. The scope stays inactive: no editor, visitor or API
source imports it, and the live Save route remains current-source-only.

## Residuals

Activation, migration inventory, quiescence/recovery and the live writer switch belong to
`T3.P01.S04`; the integrated result is owed to that slice's route. Uploaded resource bytes remain
host-asserted until a storage path verifies them. The baseline/embedded revision distinction is
documented and pinned, not removed. This record accepts no Experience runtime, no handoff and no
program execution.
