# Product convergence — owning-contract review manifest

**Status: prepared for explicit owner ratification, 2026-10-22; not yet ratified.** PR #173 now
places the proposed destination wording directly in the owning references listed below, marked
unratified. This manifest routes review and records disposition; it does not duplicate the
contract text or supply implementation authority. Existing ratified sections, landed codecs,
accepted gate identities and historical authorization remain in force. No new source encoding,
capability, phase closure, permanent harness or production work is accepted by this file.

The owner reviews one concrete decision package in this PR. On explicit acceptance, record the
accepted IDs/edits here and mark the owning sections ratified destinations before merge. A later
consumer still needs version/capability decisions, normal registration, implementation
acceptance and named release from the hold. There is no separate reconciliation PR.

## Applied descriptive corrections

| ID | Location | Change |
| --- | --- | --- |
| A-D1 | [North Star › opening "Current shell"](../reference/north-star.md) | Replaces the "read-only Stage / no editing or history" paragraph with the capabilities accepted by T1.P01, T2.P01 and T3.P01, and the capabilities that are still absent. Destination framing is unchanged. |
| A-D2 | [F.1 › Current implementation](../reference/composition-execution.md#f1-identity-and-reference) | Adds: unit resolvers refuse a non-null `componentId`; landed Layout planners allocate by occupancy and can re-mint an ID after delete or Undo. |
| A-D3 | [F.3 › Current behavior](../reference/composition-execution.md#f3-channels-and-representation-parameters) | Replaces "no general channel system is landed" with the landed family-generic `inspection-v1` negotiation, its two families and its missing component-existence check. |
| A-D4 | [F.4 › Current implementation](../reference/composition-execution.md#f4-compound-acceptance) | Adds: the compound host is landed; the planner-scope gap; snapshot Undo restores many-to-one migrations exactly. |
| A-D5 | [Session state › Current behavior](../reference/composition-execution.md#session-state-and-declarative-logic) | Replaces "no typed session declarations, reducer or expression evaluator exist" with the landed AM-6 interpreter, its same-run reset behavior and the missing Presentation entry. |
| A-D6 | [Architecture › Ownership › Layout semantic mutation](../reference/architecture.md#ownership-current-source-of-truth) | States that compound acceptance landed with `unit-acceptance-v1` at the T3.P01 cutover, not at a future cutover. |

Roadmap-side corrections are now folded into the track READMEs, Core Editor Stability and
T3.P02's current planning routes. They describe landed P01 outcomes without shipping the next work.

## Proposed normative amendments

| Review IDs | Concern and exact owning section | Disposition |
| --- | --- | --- |
| N-F1–N-F6 | [F convergence destination](../reference/composition-execution.md#product-convergence-destination): non-reused captured identity; correspondence for affected references; domain-specific repairable forms; component validation; per-planner scope and removal policies; versioned reset fence | Prepared, pending owner ratification; current codecs and scopes retained |
| N-A1–N-A4 | [Architecture convergence destination](../reference/architecture.md#product-convergence-destination): transport ownership, drawing policy, structure-local datums, independent overheads, one compiler with libraries, explicit delivery placement | Prepared, pending owner ratification; closure alternatives remain deferred |
| N-N1–N-N4 | [North Star convergence destination](../reference/north-star.md#product-convergence-destination): draw/arrange/explain/revise; reusable explanations; expressive architecture; capability honesty; laptop performance and iterative feature design | Prepared, pending owner ratification; accepted P1–P3 findings retained |
| N-S1–N-S2 | [Scene convergence destination](../reference/components/scene-content.md#product-convergence-destination): solve-once placement, optional evaluated attachment, parts and annotation ownership | Prepared; attachment codec and deletion/parameter choices are deferred to their first consumer |
| N-R1 | [Assets convergence destination](../reference/components/assets.md#product-convergence-destination): retained source and qualified derivative correspondence; observed versus admitted capability | Prepared, pending owner ratification; catalogue procedure remains scoped to catalogue |
| N-P1–N-P2 | [PLATE convergence destination](../reference/design-system/editor-shell-and-visual-system.md#product-convergence-destination): deeper Card capability, relationship facts and feature-level draft/review/build/revise loop | Prepared, pending owner review; precise feature composition is consuming-slice design |
| N-T1 | [Performance contract](../reference/components/performance.md) and [test-contract proposal](../../apps/editor/tests/README.md#product-convergence-performance-proposal): matching-result metrics, baseline/budgets and evidence before consuming-slice acceptance | Prepared; owner acceptance must separately identify permanent harness/bundle workflow authorization |

**No premature compatibility claim.** Each first consumer classifies new resource/component and
annotation formats, Presentation entry, datum-qualified capture and Scene attachment extensions.
It declares exact version/capability negotiation and older-reader behavior. Reset fencing changes
existing interpreter semantics and needs a versioned interpreter/profile change. Preserve accepted
provider/evidence identities; a new incompatible interface receives a normal new gate version.

## Decisions deferred to a named consumer

| Decision | Next owner/trigger | State through this PR |
| --- | --- | --- |
| Native enclosure/nested/overlap/collinear/non-enclosing drawing behavior and role migration | T1 C1 plan, before its implementation authorization | Recommend explicit refusal/repair for unsupported cases; no silent duplicate floor/solid |
| Attachment default gesture, parameter/straddle/spacing and host-removal default | T2 attachment extension with T1 owner transport | Solve-once placement proceeds independently. Detach-at-delete is a recommendation, with atomic refusal if pose unavailable, not a globally ratified default |
| Room-switch versus per-area fallback; mezzanine underside | T1 vertical cutover | Existing per-area rule stays until explicit decision; compare merge effects and mandatory explicit gaps |
| Qualified host expansion versus isolated structure compilation | T1 vertical cutover | Fair comparison; no shared Junctions across moving frames |
| Compound plus/Z roof massing | T1 compound family consumer | P3 wing and skeleton massing differ; choose expected shape before qualification |
| Exact copyleft product licence and concrete dependency compatibility | Before a relevant dependency ships | Copyleft direction accepted by user; no licence file or dependency installed here |
| Definition-level explanation reuse / free-exploration annotation visibility | T2/T3 later explanation consumer | Preserve reuse requirement; first slice may use one placed instance/Presentation |

## Owner decision record

**Pending.** The instruction to finish this PR authorizes documentation, planning, verification and
PR preparation; it is not recorded as ratification of these new destination rules or as production
hold release. The final review can accept the core package while leaving the consumer decisions
above deferred. The precise shell layout is explicitly iterative under the owner's 2026-10-22
steering; no full shell redesign is a prerequisite to the next planning wave.

Separately state whether the permanent on-demand browser harness and bundle report are authorized.
Their proposal is concrete in the performance contract and [H0 launch scope](./convergence-shared-foundation-2026-10-22.md).
Approve/release named implementation scopes only through their normal reviewed plan/registration.
Merging this PR alone never releases the hold.

## Retained authorities

Camera's contract is unchanged; part framing is ordinary capture through the one Camera owner.
The earlier ratified decision records and accepted gate rows retain their historical identity.
T1 planning evidence D2/§12 is not silently superseded: closure remains a later explicit call.
P4 and T4 keep their deferrals. The [canonical DAG](./cross-track-execution.md#execution-dag-and-earliest-product-milestones)
owns the batch, real prerequisites, file ownership and next planning triggers; this manifest is
not another roadmap or status store.
