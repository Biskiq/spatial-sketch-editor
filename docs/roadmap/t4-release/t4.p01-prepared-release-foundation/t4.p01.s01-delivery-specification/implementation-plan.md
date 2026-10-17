# T4.P01.S01 — Delivery specification (docs-only): implementation plan draft

**Slice:** T4.P01.S01 · **Status:** draft for a phase that is not yet registered. It is proposed and
not authorized: registration is D6 and authorization D7 of the
[2026-10-17 next-batch proposal](../../../next-batch-2026-10-17.md#proposed-decisions). **Phase:**
[T4.P01 draft](../README.md) · **Track:** [T4](../../README.md) · **Runbook:**
[T4 operations](../../../../operations/t4-release/README.md)

```text
CONSUMES: —
REQUIRES: —
VERIFICATION: iteration
INTEGRATION ROUTE: T4.P01.S05 final gate (its plan path is written at phase registration)
```

**Engineering principle.** Exercise ambitious independent engineering judgment: challenge
assumptions, investigate missing invariants and cross-system failure modes, pursue stronger or
simpler solutions, and resolve demonstrated defects without speculative abstractions or
unauthorized contract changes.

## Prerequisite

T4.P01 is registered and this row reads `approved`. Nothing is consumed: the slice reads the
accepted `ExecutionProgram@1` codec from `T3.P01.S01`, the ratified [AM-6](../../../../reference/composition-execution.md#am-6-execution-program-and-visitor-profile-v1)
and [AM-8](../../../../reference/composition-execution.md#am-8-prepared-delivery-direction-v1), and
the landed API/publication code as evidence. It runs in parallel with `T1.P01.S07` and `T3.P01.S03`.
It shares no file with either: it writes only under `docs/roadmap/t4-release/**`.

## Produces (documents only)

1. **F5@1 exact-interface draft.** Release envelope, profile, payload and program slots,
   canonicalization, hash preimage boundaries and reader negotiation, plus the
   `prepared-envelope-v1` scope, inside AM-8's ratified direction. It is written as a proposed
   amendment in this workspace. Promotion into `composition-execution.md` is the owner's later
   ratification (D8), not this slice's edit.
2. **F1 `release-addresses-v1` extension draft.** Public address conformance, as an extension of the
   accepted F1 gate. It is not a second F1 provider.
3. **`T4.prepared-reader@1` capability draft.** This is the cutover gate S05 would provide.
4. **Delivery specification.** Prepared DTOs, SQL/migration shape for releases and per-Experience
   pointers, owner/anonymous API contracts, and the `no-store`/revocation rules, each traced to AM-8.
5. **Inventory and recovery plan.** What the S04/S05 execution must count and back up, coordinated
   with T3's source inventory. It is a plan only: no live database or storage is read here.
6. **Reconciled S02–S05 plans** ready for the registration commit. They take the
   [phase draft's](../README.md#reconciliation-of-the-2026-10-14-proposal-against-post-pr-135-main)
   corrections and the T3.P01.S03 dependency on `camera-handoff-v1`.

## Boundaries

No format code, no package or API change, no gate-register edit and no change to a ratified
contract. Where a draft needs T3 semantics that `T3.P01.S03` is still building (lowering,
interpreter, Camera handoff), it cites the accepted codec and T3's plan, and it records the open
point instead of freezing it. A conflict with T3's in-flight work goes to T3, not into a competing
T4 definition.

## Acceptance criteria

- Independent review of the drafts against AM-6, AM-8, the 2026-10-15 dispositions and the live
  gate register.
- Every proposed capability string has a single provider, an exact prerequisite closure and no
  self-consumption.
- The documentation and arch docs gates are green (`tests/docs/*` in the arch lane). No product
  runs are fabricated ([tests/README](../../../../../apps/editor/tests/README.md)).
- The owner receives a ratification-ready F5@1 package. Ratifying it is not part of acceptance.

## Readiness declaration

This is a draft for an unregistered phase. It holds no implementation permission and claims no
gate state, evidence or readiness.
