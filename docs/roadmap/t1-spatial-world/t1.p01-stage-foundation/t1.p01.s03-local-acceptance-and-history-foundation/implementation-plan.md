# T1.P01.S03 — Local acceptance and history foundation: implementation plan

**Slice:** T1.P01.S03 · **Status:** proposed — not authorized
**Phase:** [T1.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)
**Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1
REQUIRES: F1.reference@1:references-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p01.s06-integrated-final-gate/implementation-plan.md
```

## Prerequisite

F1 references accepted at trusted base; ratified early F4 Layout/Scene admission,
source-independent revision/result/facade and capability-readiness amendments. No F2/F3 dependency.

## Produces

Sole shared `F4.intent-acceptance@1` provider with `local-single-domain-v1`, and one editor
chronological history host. Exact interfaces/conformance are in
[interfaces](../interfaces.md#f4-intentrevisionresult-and-early-local-foundation--s03-provider).

## Scope

Register Layout and Scene single-domain preparation/validation; prove one real Layout edit and
one real validated Scene scalar candidate. This is admission infrastructure, not T2 placement UI.
Preserve co-located Camera/resource fields and run complete current-project validation. Source
format is behind the current adapter, not in public signatures. Multi-domain/resource-changing/
unit requests refuse explicitly. Use captured IDs/inputs, exact expected AcceptedRevision and
one immutable install/undo result. Separate content digest and host epoch. No private T1 stack.

Undo/Redo use the same boundary, fresh revisions, exact source restoration and a 100-entry cap.
No-op/refusal/cancel adds no entry; new edits truncate redo; replacement invalidates old tokens.
Selection changes only through accepted correspondence. T3 S02 extends this provider with early
conditional Save; T3 S03 adds unit/compound/resource conformance. Those capabilities must have
separate accepted evidence on main before consumption. Local acceptance never labels Save safe.

## Acceptance criteria

Deterministic input/replay, stale and ABA refusal, one mixed Layout/Scene stack,
full-validator rollback, unsupported compound/resource/unit requests, preserved Camera bytes,
previous-epoch cancellation and source serialization round trip. One accepted revision is published
once. No direct UI/history assignment bypasses shared validation. No cloud or compound readiness
is asserted. Source cutover later replaces all current adapters with one new-format baseline.

These criteria are not met, reviewed or evidenced: this slice is proposed and unauthorized. The
recorded evidence belongs in [acceptance.md](./acceptance.md).

## Readiness declaration

`T1.P01.S03` is the expected sole provider of `F4.intent-acceptance@1` with the
`local-single-domain-v1` capability, and it declares no `Accepted capabilities` of its own beyond
the `F1.reference@1:references-v1` named above. That assignment is coordinated planning: the
[global gate register](../../../README.md#gate-register) leaves `F4.intent-acceptance` at `ratified`
with no provider slice until this phase registers and authorizes this slice, and nothing here
marks the gate `implemented` or `accepted`. No implementation, acceptance, conformance fixture or
readiness is claimed by this plan.
