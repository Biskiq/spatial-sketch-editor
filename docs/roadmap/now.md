# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S03` | released; starts after the [T1.P02.S03 authorization](../reference/decisions/t1-p02-s03-authorization-2026-10-27.md) batch PR (#199) merges on `main`; the registered plan is an outline, so the complete implementation plan and its plan review are recorded before implementation starts; recheck consumed gates and active scopes at its own trusted base | [Opening family](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md) |
| `T2.P02.S03` | released; starts after PR #198 merges on `main`; `T2.P02.S01` and `S02` accepted; plan review complete ([review](./t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/plan-review.md)); recheck consumed gates and active scopes at its own trusted base | [Integrated final gate](./t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/implementation-plan.md) |

Provenance: the
[T1.P02.S03 authorization](../reference/decisions/t1-p02-s03-authorization-2026-10-27.md) releases
the Opening family and prunes one **verified shipped** row — `T1.P02.S02` (accepted `owner-override`
and shipped 2026-10-27 on PR #201, merge commit `ce159a1e`, anchor `36c18db9` and tag
`closed/T1.P02.S02` verified reachable). `T2.P02.S03`'s row stays until its own PR #199 merge is
verified. The [next-wave owner release](../reference/decisions/next-wave-authorization-2026-10-27.md),
[performance foundation](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
and [post-Batch-E](../reference/decisions/post-batch-e-authorization-2026-10-23.md) records keep the
earlier permission history, and each pruned row's own acceptance record keeps its evidence.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
