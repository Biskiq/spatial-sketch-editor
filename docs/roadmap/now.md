# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T3.P03.S01` | released; no prior merge | [Planner scope and build isolation](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md) |
| `T3.P03.S02` | released; after `T3.P03.S01` is merged on `main` | [Measurement workflow and final gate](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md) |
| `T1.P02.S01` | released; after `T3.P03.S01` is merged on `main` | [Layout identity and format cutover](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md) |
| `T2.P02.S01` | released; after `T3.P03.S01` is merged on `main` | [Model resource storage and admission](./t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md) |
| `T3.P02.S01` | released; after `T3.P03.S01` is merged on `main` | [First capture and Cut Preview](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md) |

Provenance: [batch E](../reference/decisions/batch-e-authorization-2026-10-22.md). Gate identities stay in the [gate register](./README.md#gate-register).
