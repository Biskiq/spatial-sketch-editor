# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `R217.S02` | released 2026-10-28 by owner direction for implementation; starts from current `main` after PR #220; recheck consumed gates and active scopes at the trusted base | [Shell composition](./r217-core-editor-stability/r217.s02-shell-composition/implementation-plan.md) |
| `R217.S03` | released 2026-10-28 by owner direction for implementation; starts from `main` after PR #220; recheck consumed gates and active scopes at the trusted base | [Stage interaction coordination](./r217-core-editor-stability/r217.s03-stage-interaction-coordination/implementation-plan.md) |
| `R217.S01` | released 2026-10-28 by owner direction; starts from current `main` including PR #217 merge `686e724d`, after T5.P01.S03 merged; recheck consumed gates and active scopes at the trusted base | [Responsibility map and boundaries](./r217-core-editor-stability/r217.s01-responsibility-map-and-boundaries/implementation-plan.md) |
| `T5.P01.S01` | released; starts after PR #207 merges on `main`; the T2 prerequisite merged with PR #199 and T2.P02 closed 2026-10-27; recheck consumed gates and active scopes at its own trusted base | [Native form source and evaluation](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md) |
| `T5.P01.S02` | released 2026-10-28; owner authorized acceptance, closeout and P1 merge after clean T1/T2 reviews and satisfied repository gates; recheck consumed gates and active scopes at the trusted base | [Shape reading and sizing](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/implementation-plan.md) |
| `T5.P01.S03` | released 2026-10-28 by owner direction for the integrated final gate; starts from current `main` after PR #216 merge `c13a949d`, with one `perf:spot` checkpoint authorized; recheck consumed gates and active scopes at its own trusted base | [Integrated final gate](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/implementation-plan.md) |
| `T5.P01.S04` | released 2026-10-28 by the owner's implementation greenlight; the owner accepted T2's D8 library-scope review and the two recorded deviations on 2026-10-28, deferred browser and performance evidence to S03, and authorized acceptance, routine same-PR closeout and the P1 merge; S01 is accepted; the row remains until a later explicit owner release prunes the verified shipped scope | [My Objects: save and insert editable copies](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s04-my-objects-editable-copies/implementation-plan.md) |

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

The
[T1.P02 phase-close and S04 release decision](../reference/decisions/t1-p02-phase-close-and-s04-release-2026-10-28.md)
prunes the **verified shipped** `T1.P02.S04` row after its final gate was accepted at `46a31c81`
and P1-merged in `eb0931d6` (PR #210); T1.P02 closed 2026-10-28 by owner ruling (phase-close PR
#211). The `T5.P01.S01` row remains. The owner released `T5.P01.S02` on 2026-10-28 after
 directing the coordinator to proceed with S02 acceptance, closeout and merge, conditional on clean
 reviews and satisfied repository gates. This ruling is S02-only; it releases neither S03 nor S04
 and waives no acceptance criterion. The S02 row remains until a later explicit owner release prunes
 the verified shipped scope. On 2026-10-28 the owner also greenlit `T5.P01.S04` implementation in
that thread, then accepted T2's D8 library-scope review and the two recorded S04 deviations and
authorized acceptance, routine same-PR closeout and the P1 merge; browser and performance evidence
remain deferred to S03. The row stays until a later explicit owner release prunes the verified
shipped scope. The owner then released `T5.P01.S03` on 2026-10-28 to execute its approved exhaustive
plan from `c13a949d`, authorized one `perf:spot` checkpoint, and directed that a pass mark the final
gate accepted and T5.P01 closable; no phase closure was authorized.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
