# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S06` | released; after the performance-foundation documentation coordination PR is merged on `main`; runs before every direct inheritor under the performance-first halt | [Performance foundation](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md) |

Provenance: the [performance foundation owner release](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
authorizes this one scope, records the temporary performance-first halt on its direct inheritors,
and prunes the three shipped rows of the
[post-Batch-E release](../reference/decisions/post-batch-e-authorization-2026-10-23.md):
T1.P02.S05, T2.P02.S02 and T3.P02.S02. Historical permission and acceptance remain in their records.
Gate identities stay in the [gate register](./README.md#gate-register).
