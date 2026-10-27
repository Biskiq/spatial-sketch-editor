# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S02` | released; starts after the [next-wave authorization](../reference/decisions/next-wave-authorization-2026-10-27.md) coordination PR (#198) merges on `main`; plan review complete with the T3 Head/F4 shell-allocation review and the T2/T3 contribution-compatibility review ([review](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/plan-review.md)); recheck consumed gates and active scopes at its own trusted base; the standing T3 implementation review of the shared Head/F4 diff stays before merge | [Draw, close, divide and delete](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md) |
| `T2.P02.S03` | released; starts after PR #198 merges on `main`; `T2.P02.S01` and `S02` accepted; plan review complete ([review](./t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/plan-review.md)); recheck consumed gates and active scopes at its own trusted base | [Integrated final gate](./t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/implementation-plan.md) |

Provenance: the [next-wave owner release](../reference/decisions/next-wave-authorization-2026-10-27.md)
authorizes these two scopes, records the completed plan reviews, and prunes two **verified shipped**
rows — `T1.P02.S06` (accepted 2026-10-27, PR #190 `6af62eb4`) and `T3.P04.S01` (accepted 2026-10-25,
PR #191 `aa1db37a`, phase closed). The
[performance foundation](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
and [post-Batch-E](../reference/decisions/post-batch-e-authorization-2026-10-23.md) records keep the
earlier permission history, and each pruned row's own acceptance record keeps its evidence.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
