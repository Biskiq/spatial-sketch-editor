# T3.P01.S03 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this is closed work. Current truth lives in the phase README's slice register and
           the gate register; the accepted evidence lives in the two half-slice records.
STATUS:    ACCEPTED and SHIPPED 2026-10-17. Executed by the registered split halves `T3.P01.S05`
           (PR #140) and `T3.P01.S06` (PR #141); every original obligation is reconciled in
           ./acceptance.md. Routine `slice-closeout` replaced the plan body with this stub.
ROLE:      recovery and orientation stub for T3.P01.S03.
NOT:       product contract · status store · active plan.
```

## Delivered

The slice's obligations were executed by its two registered halves and accepted on `main`:

- **`T3.P01.S05`** — F4 `unit-acceptance-v1` and `conditional-save-units-v1`: real F.2 candidates,
  one-envelope validation, admitted resource staging, single/compound install with whole-operation
  history and rollback, and conditional unit Save with real-PostgreSQL conformance.
- **`T3.P01.S06`** — F3 `camera-handoff-v1`, the shared Experience lowering/interpreter over
  `ExecutionProgram@1`, the semantic companion and the guided/free/reduced-motion controllers.

Everything is accepted but inactive: no source cutover, no live unit writer and no live program
execution.

## Contract

- [Criterion reconciliation](./acceptance.md)
- [Approved split](./split-proposal.md)
- [S05 record](../t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md) ·
  [S06 record](../t3.p01.s06-experience-runtime-and-camera-handoff/acceptance.md)
- Gate register: [`../../../README.md#gate-register`](../../../README.md#gate-register)

## Residuals

```text
integration   T3.P01.S04 owns activation, the AM-7 inventory, migration, recovery and retirement
gate          T3.camera-experience-cutover@1 is undrafted; S04 is proposed and unauthorized
contract      no authored Cut/Travel selector, presentation text, state, lifecycle or channel home
timing        confirmed-arrival hold timing and the transition table's authored home are S04/T4
staging       uploaded resource bytes are host-asserted until S04's storage path verifies them
live Save     conditional-save-current-v1 remains the only live Save route
```

## Recovery

```text
git show f6962e1c:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s03-compound-and-runtime-preparation/implementation-plan.md
anchor f6962e1c · tag `closed/T3.P01.S03` (pushed)
REQUIRED MERGE METHOD — P1: merge commit, no squash/rebase, so this anchor stays reachable.
```
