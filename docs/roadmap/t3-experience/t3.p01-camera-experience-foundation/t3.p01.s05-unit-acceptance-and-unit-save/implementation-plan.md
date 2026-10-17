# T3.P01.S05 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register,
           the F4 gate register and the slice's accepted capability records.
STATUS:    ACCEPTED and SHIPPED 2026-10-17 (PR #140). Routine `slice-closeout` replaced the approved
           plan body with this stub after independent review accepted the whole slice.
ROLE:      recovery and orientation stub for T3.P01.S05.
NOT:       product contract · status store · active plan.
```

## Delivered

The first half of the approved `T3.P01.S03` split, consumed as the architecture-integration route
toward `T3.P01.S04`:

- real F.2 candidate planners — single-domain Camera View update, and one compound Camera View +
  Presentation + optional Stop insertion in a Guide, with strict payloads and captured ids;
- one-envelope validation of structure, references and dependency locks, including executable
  resource closure;
- resource staging through F.1 against the accepted snapshot, with the changed resource's new
  identity carried by the intent and compared with the captured staging set;
- single/compound acceptance through the landed F.4 coordinator — one immutable install, one
  revision mint, bounded chronological history, rollback on refusal and whole-operation undo/redo;
- `SaveAcceptedSource@1` capture and server handler over F.2, with real-PostgreSQL conditional Save
  conformance at zero skips;
- an additive F.1 correction: read contexts name the accepted snapshot revision and digest, while
  the envelope keeps its baseline `acceptedRevision` for byte-exact history.

Everything stays inactive: no source cutover, no live unit writer and no route reaches the unit
admission.

## Contract

- [`F4.intent-acceptance@1:unit-acceptance-v1`](./capability-unit-acceptance-v1.md)
- [`F4.intent-acceptance@1:conditional-save-units-v1`](./capability-conditional-save-units-v1.md)
- F.2/F.4 semantics: [`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1)
- Evidence and acceptance outcome: [`acceptance.md`](./acceptance.md)

## Verification

Tested revision `983d7a60` (comment-only successor `d7ab6984`). Exact numbers, review verdicts and
the combined-candidate result are recorded in [`acceptance.md`](./acceptance.md); they are not
duplicated here.

## Entry points

```text
implementation   packages/project-model/src/units/planning.ts
                 packages/project-model/src/units/acceptance.ts
                 packages/project-model/src/units/acceptance-staging.ts
                 packages/project-model/src/units/save.ts
                 packages/project-model/src/f4/unit-acceptance.ts
                 packages/project-model/src/references/unit-resolution.ts
                 apps/api/src/save-persistence.ts
validation       apps/editor/tests/lib/authoring/unit-acceptance-conformance.test.ts
                 apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts
                 apps/editor/tests/lib/project-model/unit-resolution-conformance.test.ts
                 apps/api/tests/save-units.test.mjs
```

## Residuals

```text
integration   T3.P01.S04 owns activation, migration inventory, quiescence/recovery and the live writer
staging       uploaded resource bytes are host-asserted until S04's storage path verifies them
revision      embedded acceptedRevision is baseline provenance; the accepted snapshot is authority
consumer      no editor, visitor or API source imports the unit modules; the live Save route stays
              current-source-only until S04
```

## Recovery

```text
git show 983d7a6046509559d3b61e4453e9894dd1bfabbc:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/implementation-plan.md
anchor 983d7a6046509559d3b61e4453e9894dd1bfabbc · tag `closed/T3.P01.S05` (pushed)
REQUIRED MERGE METHOD — P1: merge commit, no squash/rebase, so this anchor stays reachable.
```
