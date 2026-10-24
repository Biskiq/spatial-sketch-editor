# T4.P01 — Prepared release foundation: registration draft

**Status:** registration-ready draft, 2026-10-17. It is **not registered**: no row exists in the
[T4 phase register](../README.md#phase-register), and nothing here is a phase, slice, gate version
or authorization. **Frozen — deferred by owner ruling R1-D (2026-10-17, [record](../../../reference/decisions/next-batch-authorization-2026-10-17.md#ruling-r1-d-t4-deferral-2026-10-17)).**
All T4 planning and implementation waits for [Core Editor Stability](../../core-editor-stability.md).
The earlier D6/D7 approval and its hold ([history](../../../archive/roadmap/coordination-2026-10/next-batch-2026-10-17.md#application-hold-d6d7))
are superseded. On resumption this draft is re-validated against then-current `main` before any use.
Routes: [T4](../README.md) · [first-phase proposal](../first-phase-proposal.md) (scope and rationale,
not repeated here) · [runbook](../../../operations/t4-release/README.md) ·
[gate register](../../README.md#gate-register).

## Registration is not authorization

| Step | What it does | What it does not do |
| --- | --- | --- |
| **Register T4.P01 (D6)** | Adds the T4 phase-register row, moves T4 in the [track register](../../README.md#track-register) from `planning` to `approved`, turns this page into the phase README with a real `## Slice register` (all rows `proposed`) and `FINAL PHASE GATE: T4.P01.S05`, and creates S02–S05 plan/acceptance stubs from the proposal. | It authorizes no slice. It changes no gate state: `F5.release-envelope` and `T4.prepared-reader` stay `undrafted`, so their `Provider slice` columns cannot be wired yet. It starts no implementation and opens no cycle window. |
| **Authorize T4.P01.S01 (D7)** | Flips S01 to `approved` so its docs-only drafting can start. | It authorizes no format code, no F amendment and no gate version. S01's outputs are drafts until the owner ratifies them. |
| **Ratify F5@1 (later, D8)** | Promotes S01's F5 draft into `composition-execution.md` as a ratified amendment, gives the F5 row version `1`/`ratified`, and wires `Provider slice` `T4.P01.S02`. | It is not S02's authorization, which stays its own decision. Per the [2026-10-15 disposition 4](../../../reference/decisions/f-ratification-2026-10-15.md#policy-dispositions), the exact codecs are still frozen by S02's accepted implementation. |

## Reconciliation of the 2026-10-14 proposal against post-PR #135 `main`

The proposal predates the F ratification and every accepted provider. Its scope stands. These
statements are superseded by later recorded facts; the proposal is not rewritten, because it is
evidence:

| Proposal statement | Current fact (owner) |
| --- | --- |
| "F.1–F.5 … exact interfaces are all still `undrafted`" | F1–F4 are `accepted` with capability records. Only F5 and the two capability gates (`T3.camera-experience-cutover`, `T4.prepared-reader`) are `undrafted` ([gate register](../../README.md#gate-register)). |
| "Shared provider/readiness" listed as a decision to reconcile | Ratified 2026-10-15 ([record](../../../reference/decisions/f-ratification-2026-10-15.md)): F5 → T4.P01.S02, prepared reader → T4.P01.S05, Accepted-capabilities/Requires enforced by the gates test. |
| "F5/program" and "Domain delivery" decisions | Direction ratified as [AM-8](../../../reference/composition-execution.md#am-8-prepared-delivery-direction-v1); [AM-6](../../../reference/composition-execution.md#am-6-execution-program-and-visitor-profile-v1) fixes `ExecutionProgram@1`, accepted in T3.P01.S01. Exact F5 codecs remain S02 provider work. |
| S02 needs `F2.unit-envelope@1:unit-envelope-v1` and `F3.channels@1:inspection-v1` | Both are `active` on `main`. S02 is gated only by registration, F5@1 ratification and its own authorization. |
| S03/S04 need `F3.channels@1:camera-handoff-v1` | Still unaccepted. Its provider is `T3.P01.S03`, owner-authorized 2026-10-17 (D5). |
| S05 consumes `T3.camera-experience-cutover@1` | Still `undrafted`. T3 drafts it with the `T3.P01.S04` authorization request ([R6](../../../archive/roadmap/coordination-2026-10/cross-track-execution-2026-10-23.md#parallel-batch-2026-10-16)). |

The proposal's remaining open items move to S01 and the owner. They are "Accepted input",
"Activation/covered data" and "Product/durability", including the Release Baseline and any
publication gap. They never become blanket approvals.

## Proposed slice register (applies on registration)

The capability strings are those of the [proposal](../first-phase-proposal.md#candidate-slice-sequence),
re-checked against the live register. Every row would register as `proposed` with no authorization.

| Slice | Consumes | Requires | Readiness today | Plan |
| --- | --- | --- | --- | --- |
| T4.P01.S01 | — | — | Startable once registered and authorized; docs-only | [plan draft](./t4.p01.s01-delivery-specification/implementation-plan.md) |
| T4.P01.S02 | F1.reference@1, F2.unit-envelope@1, F3.channels@1 | F1.reference@1:references-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:inspection-v1 | Scopes accepted; waits for F5@1 ratification and authorization | written at registration |
| T4.P01.S03 | F1.reference@1, F2.unit-envelope@1, F3.channels@1, F5.release-envelope@1 | F1.reference@1:release-addresses-v1, F2.unit-envelope@1:unit-envelope-v1, F3.channels@1:camera-handoff-v1, F5.release-envelope@1:prepared-envelope-v1 | Waits for S02 and `T3.P01.S03` | written at registration |
| T4.P01.S04 | as S03 | as S03 | Storage preparation may run alongside S03; its build harness follows S03's exports | written at registration |
| T4.P01.S05 | as S03, plus T3.camera-experience-cutover@1 | as S03 | Waits for `T3.P01.S04`; it is the final gate | written at registration |

```text
PROPOSED FINAL PHASE GATE: T4.P01.S05 (exhaustive; API → immutable resources/program → cold browser)
```

T4 has no architecture-cycle window. Its slices are not exposures, and an open T1 window blocks
none of them.
