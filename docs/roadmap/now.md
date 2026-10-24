# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S05` | released; after the post-Batch-E documentation coordination PR is merged on `main` | [Legacy Layout retirement](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s05-legacy-layout-retirement/implementation-plan.md) |
| `T2.P02.S02` | released; after the post-Batch-E documentation coordination PR is merged on `main` | [Import, review, approve and place](./t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/implementation-plan.md) |
| `T3.P02.S02` | released; after the post-Batch-E documentation coordination PR is merged on `main` | [First Guide, Camera return and integrated final gate](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/implementation-plan.md) |

Provenance: [post-Batch-E owner release](../reference/decisions/post-batch-e-authorization-2026-10-23.md)
authorizes these three scopes and prunes the five shipped rows from
[Batch E](../reference/decisions/batch-e-authorization-2026-10-22.md). Historical permission and
acceptance remain in their records. Gate identities stay in the [gate register](./README.md#gate-register).
