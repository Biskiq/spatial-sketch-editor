# Batch C authorization: T1.P01.S05 ∥ T2.P01.S04

**Date:** October 19, 2026. **Status:** **owner-authorized 2026-10-19.** The owner approved rulings
C1–C7 as written, with C3 on the post-cutover route, in the Batch C coordination session on
2026-10-19. The [approval patch](#approval-patch) is applied on the coordination PR (#155), and the
authorization takes effect when that PR merges.

This record is decision provenance, like the
[batch B record](./batch-b-authorization-2026-10-17.md). It changes no ratified contract: AM-1–AM-8
and PLATE are unchanged, lifecycle and gate identity stay in the
[roadmap register](../../roadmap/README.md#gate-register), and each slice's scope stays in its plan.
The reasoning is in the [batch C proposal](../../roadmap/batch-c-2026-10-19.md). The rules are in the
[batch C protocol](../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19).

## Authorization

| Slice | Phase | Plan | Consumes / Requires (unchanged) |
| --- | --- | --- | --- |
| `T1.P01.S05`: Existing straight-Wall manipulation (architecture-cycle terminal) | T1.P01 | [plan](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s05-existing-straight-wall-manipulation/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` / `references-v1`, `local-single-domain-v1`, `viewport-projection-v1` |
| `T2.P01.S04`: Bounded composition loop, the T2.P01 final phase gate | T2.P01 | [plan](../../roadmap/t2-composition/t2.p01-supported-composition/t2.p01.s04-bounded-composition-loop/implementation-plan.md) | `F1.reference@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1` / `references-v1`, `local-single-domain-v1`, `conditional-save-current-v1`, `viewport-projection-v1` |

**Prerequisites, verified against `main` `5fee2a2d` (post-PR #147).** Every consumed gate is
`accepted` and every required scope is `active`:

- `F1.reference@1:references-v1` at `ee463d0b`;
- `F4.intent-acceptance@1:local-single-domain-v1`, with `acceptance-invariants-v1`, at `8ec0c5f1`;
- `F4.intent-acceptance@1:conditional-save-current-v1` at `8dd53260` (PR #133);
- `T1.viewport-projection@1:viewport-projection-v1` at `ab8504aa` (S07, PR #137).

All four are ancestors of `5fee2a2d`. The in-phase prerequisites also hold:

- **For S05:** `T1.P01.S04` was accepted at `2d37adef` and merged in PR #148. The ancestor check
  passes, and `closed/T1.P01.S04` is on the remote.
- **For T2 S04:** S01–S03 are shipped, with S03's anchor `2747f169` an ancestor. T1's Head Save
  integration is accepted through `T1.P01.S04`. This dependency is not a capability, so it is
  checked against that slice's acceptance record.

Neither slice consumes the other. Each slice's runbook start step still re-checks eligibility at its
own trusted base.

## Rulings

| # | Ruling | Recommendation |
| --- | --- | --- |
| C1 | Authorize both slices to run in parallel under the batch C protocol. Each merges on its own after independent acceptance and routine closeout, rerunning the complete merge gate on then-current `main`. There is no imposed order; if both are ready together, S05 merges first. | Approve |
| C2 | **Current-source freeze (K6).** After both slices merge, no further current-source caller lands until `T3.P01.S04` merges, and no other T1/T2 slice is authorized in that window. If the owner re-sequences, an unmerged batch C slice re-declares unit scopes in its own record rather than requiring a retired one. | Approve |
| C3 | **`T1.P01.S06` route.** S06 runs once, after `T3.P01.S04` is accepted. Its own authorization re-declares unit scopes and consumes `T3.camera-experience-cutover@1`. It is not authorized here. *Alternative:* S06 on current source right after S05, with `T3.P01.S04` phase B then waiting for S06 as well. | Post-cutover |
| C4 | **T2 S04 scope correction.** Reuse T1's shipped *Download/Open source JSON*, replacement guard and *Reload remote*. T2 builds no Head, persistence or Save UI. Numeric Resize is the guaranteed route. A direct Resize handle is admitted only through S07's contribution points and the existing T2 seams; a new host seam is a stop-and-report to T1. | Approve |
| C5 | **TD-8 ownership.** TD-8 is S05's first increment, because T1 owns the host. T1 may land it as a standalone tech-debt fix PR before S05 if T2 S04's journeys need it first. T2 records the base its journeys ran on. | Approve |
| C6 | **TD-9 triage.** The sign-in Save resume that T1 S04's acceptance describes is not wired in source. It is recorded as TD-9 with owner T1 (Head integration) and is not in S05's scope. `T3.P01.S04` rewires or removes the old-format session draft, and `T1.P01.S06` verifies the journey end to end. | Approve |
| C7 | **Cycle.** S05 is the configured terminal exposure, and its start opens nothing new. At its closeout the S05 exposure row is recorded. With S02 and S04 already recorded, the window becomes closable, and the owner then owes the mechanism verdicts as a separate event. That event blocks no batch C, T2 or T3 work. | Approve |

## Explicit non-implications

- `T1.P01.S06`, `T3.P01.S04`, T3.P02, K1/K3/K4 work and all T4 work stay unauthorized (R1-D stands).
- Neither slice accepts a capability or edits a gate row.
- Approving this record does not ratify anything in the
  [T3 cutover ratification](./t3-cutover-ratification-2026-10-19.md), and the reverse is also true.

## Approval patch

Applied 2026-10-19 on PR #155, after the owner's approval:

1. The S05 row in the [T1.P01 slice register](../../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md#slice-register)
   and the S04 row in the [T2.P01 slice register](../../roadmap/t2-composition/t2.p01-supported-composition/README.md#slice-register)
   moved to `approved`, and each Authorization cell links this record.
2. The phase and track status lines, both plans' status and readiness lines and the cross-track
   header now say "authorized 2026-10-19 as batch C".
3. The [batch C protocol](../../roadmap/cross-track-execution.md#authorized-batch-c-2026-10-19)
   heading reads "Authorized", and its links were updated.
4. The T1/T2 batons name the authorized slice as NEXT.

`Requires` is unchanged, so no `parallel-track-gates.test.ts` pin changed.

## Owner signature

```text
C1 approved  C2 approved  C3 approved (post-cutover)  C4 approved  C5 approved  C6 approved  C7 approved
Owner: repository owner (approved in the coordination session)   Date: 2026-10-19
```
