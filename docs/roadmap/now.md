# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S06` | released; after the performance-foundation documentation coordination PR is merged on `main`; runs before every direct inheritor under the performance-first halt | [Performance foundation](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md) |
| `T3.P04.S01` | released; after the T3 coordination PR #188 merges on `main`; R1/R2 owner-ratified 2026-10-25 ([review](https://github.com/Biskiq/spatial-sketch-editor/pull/188#pullrequestreview-5641779932)); strictly unrelated to the performance-first halt; its bounded T1 shell patch is serialized against `T1.P02.S06`'s claim and T1-reviewed; T2's API handoff reviews the owned-key inventory, persisted approved-source key set and revocable write fence on both model writers before shared API edits | [Project rename and delete](./t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/implementation-plan.md) |

Provenance: the [performance foundation owner release](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
authorizes this one scope, records the temporary performance-first halt on its direct inheritors,
and prunes the three shipped rows of the
[post-Batch-E release](../reference/decisions/post-batch-e-authorization-2026-10-23.md):
T1.P02.S05, T2.P02.S02 and T3.P02.S02. Historical permission and acceptance remain in their records.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closes `T3.P02` and `T3.P03` and authorizes and releases `T3.P04.S01` as a second live row. It adds
no condition to `T1.P02.S06`, does not weaken the performance-first halt, and releases no T1 or T2
scope. Both closures leave the two rows' historical permission and acceptance in their records, and
their deferred obligations keep the owners their phase READMEs name. Gate identities stay in the
[gate register](./README.md#gate-register).
