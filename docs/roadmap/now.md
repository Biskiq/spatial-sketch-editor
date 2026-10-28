# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `T1.P02.S04` | released; owner-authorized 2026-10-28 ([record](../reference/decisions/t1-p02-s04-authorization-2026-10-28.md)) from `main` at `db7e5cd9`, the verified PR #209 merge; exhaustive integrated **correctness and functional** acceptance of native Wall creation; the [2026-10-28 performance-mandate suspension](../reference/decisions/performance-mandate-suspension-2026-10-28.md) removes the deferred benchmark family from the gate, leaves unmeasured rows unmeasured, and authorizes no benchmark; recheck every consumed gate and active scope at its own trusted base; passing makes the phase closable, not closed | [Integrated final gate](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/implementation-plan.md) |
| `T5.P01.S01` | released; starts after PR #207 merges on `main`; the T2 prerequisite merged with PR #199 and T2.P02 closed 2026-10-27; recheck consumed gates and active scopes at its own trusted base | [Native form source and evaluation](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md) |

Provenance: the
[T1.P02.S04 authorization](../reference/decisions/t1-p02-s04-authorization-2026-10-28.md) releases
the phase's integrated final gate and prunes one **verified shipped** row — `T1.P02.S03` (accepted
`owner-override` 2026-10-28 and shipped on PR #209, merge commit `db7e5cd9`; acceptance anchor
`cbdb4785`). The [2026-10-28 performance-mandate
suspension](../reference/decisions/performance-mandate-suspension-2026-10-28.md) amends the S04
condition: no formal benchmark, battery certification or full `npm run perf` workflow is owed or
authorized, and existing measurements are historical evidence only. The `T5.P01.S01` row was added
by the owner's implementation authorization on 2026-10-27 after that verification, and it prunes one
**verified shipped** row — `T2.P02.S03` (accepted `owner-override` and shipped 2026-10-27 on PR #199,
merge commit `a674eedb`, anchor `221facc4` and tags `closed/T2.P02.S03` and `closed/T2.P02` verified
reachable). The
[T1.P02.S03 authorization](../reference/decisions/t1-p02-s03-authorization-2026-10-27.md),
[next-wave owner release](../reference/decisions/next-wave-authorization-2026-10-27.md),
[performance foundation](../reference/decisions/performance-foundation-authorization-2026-10-24.md)
and [post-Batch-E](../reference/decisions/post-batch-e-authorization-2026-10-23.md) records keep the
earlier permission history, and each pruned row's own acceptance record keeps its evidence.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
