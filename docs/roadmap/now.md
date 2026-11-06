# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

**Immediate next step:** implement [PR #259's reconciled harness plan](./lean-harness-proposal.md)
in that same PR. This is the owner's explicit next scope, outside the retired R217 slice sequence;
it does not create a new slice or gate. This update is planning-only; implementation has not begun.

**R217: closed, Core Product Stability accepted**, effective at PR #271 merge `ce4e232c`
(2026-11-06). The owner personally tested and accepted the integrated product, including the final
Experience changes. [S11 is owner-accepted by override; separate gate execution is waived](./r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md).
No S11 run, A–Q rerun or R217 closeout is a future prerequisite; unexecuted individual checks are
not represented as passed. #259 keeps its own CI, architecture, regression and verification duties.
R217's completed scope rows are removed by this owner ruling; earlier release provenance remains below.

| Scope | Condition | Plan |
| --- | --- | --- |

Shipped scopes pruned 2026-11-02 by owner direction: `R217.S01`–`S05`, `S10`, `S12`–`S24` and `T5.P01.S01`–`S04` have merged; each slice's own acceptance record and the tags keep its evidence. The provenance paragraphs below describe rows as of their own releases.

R217 campaign provenance: the owner directed one standing authorization for R217.S11–S25, and these
rows take effect only when the owner merges PR #230, which carries them. The
[campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md) owns the conditions and owner checkpoints.

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

The owner directly authorized recovery and repair of the existing `R217.S05` PR #226 on
2026-10-29, with slice closeout conditional on an acceptable independent review. This narrowly
scoped row records that authorization; it does not authorize omitted work or a merge.

T3 provenance: the [phase-close and P04 authorization decision](../reference/decisions/t3-phase-close-and-p04-authorization-2026-10-24.md)
closed `T3.P02` and `T3.P03` and released `T3.P04.S01`; that scope shipped, closed 2026-10-25 and no
longer holds a row. Gate identities stay in the [gate register](./README.md#gate-register).
