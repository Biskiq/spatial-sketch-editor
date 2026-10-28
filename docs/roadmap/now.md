# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S03` | released; starts after the [T1.P02.S03 authorization](../reference/decisions/t1-p02-s03-authorization-2026-10-27.md) batch PR (#199) merges on `main`; the registered plan is an outline, so the complete implementation plan and its plan review are recorded before implementation starts; recheck consumed gates and active scopes at its own trusted base | [Opening family](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/implementation-plan.md) |
| `T5.P01.S01` | released; starts after PR #207 merges on `main`; the T2 prerequisite merged with PR #199 and T2.P02 closed 2026-10-27; recheck consumed gates and active scopes at its own trusted base | [Native form source and evaluation](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md) |

Provenance: the
[T1.P02.S03 authorization](../reference/decisions/t1-p02-s03-authorization-2026-10-27.md) releases
the Opening family and prunes one **verified shipped** row — `T1.P02.S02` (accepted `owner-override`
and shipped 2026-10-27 on PR #201, merge commit `ce159a1e`, anchor `36c18db9` and tag
`closed/T1.P02.S02` verified reachable). The T5.P01.S01 row was added by the owner's implementation
authorization on 2026-10-27 after that verification, and it prunes one **verified shipped** row —
`T2.P02.S03` (accepted `owner-override` and shipped 2026-10-27 on PR #199, merge commit `a674eedb`,
anchor `221facc4` and tags `closed/T2.P02.S03` and `closed/T2.P02` verified reachable). The
[next-wave owner release](../reference/decisions/next-wave-authorization-2026-10-27.md),
[performance foundation](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
and [post-Batch-E](../reference/decisions/post-batch-e-authorization-2026-10-23.md) records keep the
earlier permission history, and each pruned row's own acceptance record keeps its evidence.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
