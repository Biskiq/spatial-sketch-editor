# `T3.camera-experience-cutover@1` — ratification draft (ratified 2026-10-19)

**Status:** **ratified 2026-10-19** at version 1 by R3 of the
[T3 cutover record](../../../../../reference/decisions/t3-cutover-ratification-2026-10-19.md). The
contract is AM-9 in `composition-execution.md`, and the register row is `ratified`. This file is now
the ratification provenance; it claims no implementation or acceptance. It superseded the AM-7-based
draft of PR #149, which is recoverable at `5fee2a2d`.

**Drafting slice:** T3.P01.S04 (intended sole provider) · **Owning track:** T3 ·
**Kind:** capability (a declared cutover, not a foundation interface) ·
**Phase:** [T3.P01](../../README.md) · **Plan:** [implementation-plan.md](../implementation-plan.md)

## 1. Identifier and purpose

`T3.camera-experience-cutover@1` is the one declared cutover. In it, Camera and Experience become
separate authored authorities, the Scene stops carrying editorial traversal, and every live reader,
writer and consumer moves to the F2 unit format on a clean source epoch.

The cutover exists so that:

- Camera owns Views, framing, projection, connectivity, routes, intrinsic motion and evaluation;
- Experience owns Presentations, Stop identity, Guide order, holds, continuation and Gates;
- the current-source F4/Stage/Save/starter adapters retire together with their callers, and no
  normal reader accepts two formats;
- T3 authoring, T1/T2 work on F2 and T4 public delivery consume one accepted transition, instead of
  each inventing a second interpreter or a legacy identity map.

It does **not** deliver Camera authoring UI, Preview UX, publication UX or prepared delivery.

## 2. Contract

The exact text is **AM-9 Shared Camera and Experience cutover** in
`docs/reference/composition-execution.md`, appended on ratification. The heading slug is
`am-9-shared-camera-and-experience-cutover`. It is not repeated here, so that only one copy can
drift. Relative to the PR #149 draft:

| PR #149 promise | Clean-reset AM-9 |
| --- | --- |
| Read-only converter as an administrative entry | none; no covered data (R1) |
| CAS-install the converted envelope per project | one transactional reset plus a structural F2-only schema fence |
| Backups, restore rehearsal, coordinated rollback | the transaction either fails with nothing changed or commits; recovery rolls forward |
| Publication gap "if the owner approves" after inventory | gap empty by construction (R4) |
| Converter retires when inventory is discharged | no converter; the inactive module retires in S04 |
| Pre-S04 runtime decisions (selector, authored inputs, hold timing) | @1 defaults fixed; authored homes go to T3.P02 |

## 3. Provider

Exactly one provider: **`T3.P01.S04`**. No other slice may provide, extend or partially satisfy this
gate at version 1.

## 4. Consumers

| Consumer | Consumption | Eligibility |
| --- | --- | --- |
| T3.P02 (candidate, unregistered) | Authoring surface over Camera/Experience units and the shared execution program | This gate `accepted`, plus `T1.viewport-projection@1:viewport-projection-v1` |
| `T1.P01.S06` (proposed post-cutover route, batch C ruling C3) | Final T1 gate on unit admission | This gate `accepted`; re-declared in its own authorization record |
| Later F2 phases: T2 single-model ingest (K1), T1 Wall authoring/schema cutover (K3), T3 rename/delete (K4) | Work on the F2 source | This gate `accepted`; each declares it at its own registration |
| `T4.prepared-reader@1` (T4.P01.S05, deferred by R1-D) | Prepared publication/API/resource/browser activation | This gate `accepted`; T4 stays deferred until Core Editor Stability is accepted |

No consumer may self-satisfy the gate. Ratification authorizes no consumer.

## 5. Preconditions

At the provider's trusted base, all of these must be accepted and active:

- `F1.reference@1:unit-resolution-v1`
- `F2.unit-envelope@1:unit-envelope-v1`
- `F3.channels@1:camera-handoff-v1`
- `F4.intent-acceptance@1:unit-acceptance-v1`
- `F4.intent-acceptance@1:conditional-save-units-v1`
- the enduring `F4.intent-acceptance@1:acceptance-invariants-v1`, plus each scope's declared
  prerequisite closure.

The owner's R1–R5 must also be signed. The gate can be ratified before S04 is authorized, but it
cannot be **implemented** or `accepted` before S04 ships.

## 6. Verification obligations

The gate is not `accepted` until evidence exists for:

| Obligation | Evidence |
| --- | --- |
| Epoch/admission | Every admission-matrix refusal; reset migration in one transaction, rerun no-op, single winner under two runners; pre-epoch writer refused structurally; `/p/` prior IDs not-found; Publish `prepared-reader-required` |
| Atomic acceptance/undo | One compound install, one undo payload, fresh revisions; no-op adds nothing; stale/ABA refusal |
| Cloud contention | Two conditional unit Saves with one base: exactly one wins; receipts replay; changed-payload retry refuses; real Postgres, zero skips |
| Motion/continuation | Forward/reverse timing, envelopes, interior Y; Cut changes no topology; a Travel gap never silently cuts |
| Session/handoff | Two sessions with independent clocks; a stale arrival cannot advance a newer run |
| Accessibility | DOM/keyboard/pointer/touch parity, Guide-free Presentations reachable; reduced motion reaches the same destination |
| Architecture | One evaluation authority, one order writer; no legacy flow callers, converter or retired-scope caller; editor machinery absent from public chunks |
| Integrated tree | Full merge gate, root check/build, relevant package checks, full editor lanes and `check:api`/`test:api` on a reachable DB with zero skips; recorded revision |

## 7. Register row (applied on ratification)

Before 2026-10-19 the row was `undrafted` with version `—`. The ratification commit set it to
version `1`, `ratified`, provider `T3.P01.S04`, with the AM-9 anchor
`../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover`, in the same
commit that appended AM-9. The evidence columns stay empty until `implemented`/`accepted`.

The enforced lifecycle vocabulary is `undrafted | ratified | implemented | accepted | superseded`
(validated by `apps/editor/tests/docs/parallel-track-gates.test.ts`). Drafting changed no row; the single
legal transition was `undrafted → ratified`.

## 8. Ratification checklist

- [x] Owner signed R1 (disposability scope) and R2 (AM-7 supersession) on 2026-10-19.
- [x] Owner approved the AM-9 text and its anchor (R3), and ratified version 1 on 2026-10-19.
- [x] One approval commit appended AM-9 and moved the register row `undrafted → ratified`.
- [x] Provider stays `T3.P01.S04`, sole.
- [ ] Consumers re-declare the gate only in their own authorization records.
- [x] No capability, acceptance or implementation state is claimed here.
