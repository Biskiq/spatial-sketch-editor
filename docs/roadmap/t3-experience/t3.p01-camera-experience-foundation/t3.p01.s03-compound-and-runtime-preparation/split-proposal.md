# T3.P01.S03 — approved split direction (2026-10-17)

**Status:** **split direction approved 2026-10-17 by delegated owner decision; both follow-ups
registered and owner-authorized the same day as `T3.P01.S05` and `T3.P01.S06`**
([record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md)). This
document records the decision to divide S03's remaining obligations into two registered slices; it
does **not** accept any capability or close S03. The
[implementation plan](./implementation-plan.md#scope) requires the implementer to propose a
registered split rather than silently narrow a criterion.

**Slice:** T3.P01.S03 · **Phase:** [T3.P01](../README.md) · **Track:** [T3](../../README.md)
**Authorizing record:** [2026-10-17 next batch](../../../../reference/decisions/next-batch-authorization-2026-10-17.md) (D5)

## Why the split is required

The authorized plan carries four bodies of work whose evidence contracts are
different:

1. the F4 `unit-acceptance-v1` admission and install semantics;
2. `conditional-save-units-v1`, which needs **real-DB conformance at zero skips**
   for a format that has no live route yet;
3. the F3 `camera-handoff-v1` ownership protocol over the landed ticket protocol;
4. the Experience runtime preparation (lowering/interpreter, reducer/clock,
   holds/continuation, guard/Continue/detour, semantic DOM companion, Info Panel,
   guided/free/reduced-motion controllers) against closed fixtures.

They touch disjoint modules but they do **not** share a completion test. Parts 1
and 3 are provider seams whose criteria are conformance rows; part 2 is a
persistence contract that must be exercised against a real database; part 4 is a
runtime that only the candidate `T3.P02` can render. One acceptance record that
claimed all four from one diff would have to state at least one of them on
evidence the tier does not require — exactly the silent narrowing the plan
forbids.

The plan's own natural seam is followed: **(a) unit acceptance/Save** versus
**(b) runtime/handoff preparation**. This proposal keeps that seam and records
which criteria move where, because the first increment has already implemented
the F4 admission core and the handoff protocol.

## Proposed slices

| Proposed slice | Scope | Exported capabilities | Depends on |
| --- | --- | --- | --- |
| `T3.P01.S03a` — Unit acceptance and unit Save | The F4 unit admission (registry + preparation + reference/lock validation + resource staging), the unit install/history semantics through the landed coordinator, and the conditional Save protocol over F2 candidates with real-DB conformance. | `F4.intent-acceptance@1:unit-acceptance-v1`, `F4.intent-acceptance@1:conditional-save-units-v1` | unchanged S03 `Requires` |
| `T3.P01.S03b` — Runtime and handoff preparation | The shared Experience lowering/interpreter, reducer/clock, holds/continuation, minimal guard/Continue/detour state, semantic DOM companion/Info Panel, the guided/free/reduced-motion controllers, and the F3 `camera-handoff-v1` protocol. | `F3.channels@1:camera-handoff-v1` | `F3.channels@1:inspection-v1`, F2 program codec (both accepted) |

`F3.channels@1:camera-handoff-v1` is the only capability that changes owner in
this proposal: it is a protocol over the landed Camera-output ticket protocol with
no runtime dependence, so it belongs with the F3 extension work rather than with
the Save persistence contract. Both halves stay on T3's critical path:
`T3.P01.S04` consumes both halves' outputs, so the split changes **when each can
be accepted**, never what S04 needs.

## Criteria moved, exactly

Neither proposed slice inherits the whole S03 plan unchanged. The mapping is:

| Plan statement | Proposed owner |
| --- | --- |
| Extend F4 with `unit-acceptance-v1` and `conditional-save-units-v1` | S03a |
| Actual Camera View + Presentation + optional Stop candidates, complete domain/reference/resource-lock validation, staged admitted resources, one install/whole-operation history | S03a (candidate construction belongs to the domain planners S03a admits; the admission seam is implemented in this increment) |
| The same conditional Save protocol over F2 candidates, real-DB conformance, no new live unit writer or Save route | S03a |
| Extend F3 with `camera-handoff-v1` through the shared ticket protocol | S03b (the Follow / Look-through / Preview role half is implemented in this increment; guided/free ownership and return and the Experience session semantics are not) |
| Shared Experience lowering/interpreter, reducer/clock, holds/continuation, guard/Continue/detour, semantic DOM companion/Info Panel, guided/free/reduced-motion controllers, closed fixtures | S03b |
| Exit criteria: unit single/compound operations, resource rollback, unit Save, supported program traces (AM-6), ownership/stale-event behavior, scopes accepted on `main` before S04 | Split: unit/compound/rollback/Save → S03a; trace and ownership/stale-event → S03b |
| The current-source Save path stays the one live path | Both (unchanged behavior; no live writer added) |

## What this increment (`T3.P01.S03` in progress) already implements

The first increment deliberately implements the two **provider seams** that the
split does not have to wait for, and stops before the parts whose evidence
contracts are not met:

- `packages/project-model/src/f4/unit-acceptance.ts` — the additive unit
  admission (registry profile, preparation through the landed dispatcher, F.1
  target validation), with its F.2-dependent resource staging in
  `packages/project-model/src/units/acceptance-staging.ts` behind the inactive
  `./units` subpath, so the `f4/**` closure stays free of the unit envelope
  until the cutover. Staging takes the resolver's concrete revision, so a pinned
  external resource stages by its pin hash and one with neither revision nor pin
  refuses.
- `packages/project-model/src/channels/handoff.ts` — the **role half** of
  `camera-handoff-v1` (Follow / Look-through / Preview), return and cleanup
  discipline over `camera-output.ts`, and the displaced run's pending obligation.
  No scope constant is exported; the remainder of the allocated capability is
  S03b's.
- `packages/project-model/src/f4/prepare.ts` — an additive, optional
  `PlannerRegistry.admission` profile and a per-call `PrepareAdmission` that
  carries only `inspectTargets`. Both the registry's grant and the planner's own
  declaration must hold for a compound or resource-bearing intent; with no
  profile the dispatcher is the landed `local-single-domain-v1` rule, so no
  landed behaviour changes.
- Conformance suites:
  `apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts` and
  `apps/editor/tests/lib/project-model/camera-handoff.test.ts`.

**Not implemented in this increment, and not claimed:** the F2 candidates
themselves (domain planners that build Camera View/Presentation/Stop), the
conditional Save over F2 with real-DB evidence, the runtime/interpreter/DOM
companion and the three controllers. The acceptance record states that
explicitly; no capability is recorded as accepted.

## Delegated owner decision and required follow-up

1. **APPROVED:** S03a owns unit acceptance, F2 candidates and unit Save; S03b owns
   Experience runtime and the complete F3 Camera handoff. Every original S03 exit
   criterion is preserved. The implementation in PR #138 is accepted **for this
   preparatory increment only**, not as acceptance or closeout of S03, S03a or S03b.
2. **NOT AUTHORIZED:** The proposed S03a/S03b implementation is not permitted by this
   decision alone. Before either starts, separately register its proposed row in the
   [T3.P01 slice register](../README.md#slice-register), write its exact plan and
   acceptance stub, reconcile the allocation and capability provider identities,
   and obtain explicit implementation authorization under the existing readiness
   rules. Keep S03 in progress as the original umbrella obligation; only mark it
   shipped after both halves' original criteria have accepted evidence and the
   prescribed closeout.
3. **UNCHANGED:** `T3.P01.S04`'s `Requires` still names the accepted capability
   scopes; it may not start until all required outputs are accepted at its trusted
   base. No F3/F4 capability is accepted by PR #138, and no T4 work is authorized.

**Evidence/provenance:** decision by the assistant acting under the owner's explicit
2026-10-17 delegation in the coordinating conversation; PR #138, code increment
`b13c5d73`. This decision is not a substitute for each follow-up slice's review.

## Registration and authorization (applied 2026-10-17)

The follow-up requirement above is discharged. The owner authorized the two halves; they are
registered with numeric ids in the [T3.P01 slice register](../README.md#slice-register) as
**`T3.P01.S05` — Unit acceptance and unit Save** and **`T3.P01.S06` — Experience runtime and Camera
handoff**, with plans and acceptance stubs written at registration. The authorization provenance is
[the follow-up record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md).
The capability allocation moves `unit-acceptance-v1`/`conditional-save-units-v1` to S05 and
`camera-handoff-v1` to S06; their prerequisite sets are unchanged. S03 stays the in-progress umbrella
and closes only after both halves are accepted and its original exit criteria are reconciled.

## Explicit non-implications

Registration and authorization are not acceptance. No gate changes state, no capability
is accepted, and `T3.P01.S04` remains `proposed` and unauthorized. The split changes no ratified
contract: AM-1–AM-8, F1–F4 and the Camera authority are untouched.
