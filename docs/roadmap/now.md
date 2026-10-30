# Release list

**Owner:** an owner release writes this file, including pruning a row whose slice has shipped. A closeout does not. Lifecycle, the track register and the gate register stay in [the roadmap](./README.md). The hold rule stays at [Production implementation hold](./README.md#production-implementation-hold).

A scope absent from this table is held. A row states the condition under which the runbook start step may begin. It does not record that the condition has already been met.

| Scope | Condition | Plan |
| --- | --- | --- |
| `R217.S11` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); runs after R217.S12–S25 have merged; its acceptance, merge and phase close stay with the owner | [Integrated final gate](./r217-core-editor-stability/r217.s11-integrated-final-gate/implementation-plan.md) |
| `R217.S12` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Camera basis](./r217-core-editor-stability/r217.s12-camera-basis/implementation-plan.md) |
| `R217.S13` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Drafting simplification](./r217-core-editor-stability/r217.s13-drafting-simplification/implementation-plan.md) |
| `R217.S14` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Live feedback](./r217-core-editor-stability/r217.s14-live-feedback/implementation-plan.md) |
| `R217.S15` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Wall direct manipulation](./r217-core-editor-stability/r217.s15-wall-direct-manipulation/implementation-plan.md) |
| `R217.S16` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Openings and Junction hover](./r217-core-editor-stability/r217.s16-openings-and-junction-hover/implementation-plan.md) |
| `R217.S17` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Scene and form manipulation](./r217-core-editor-stability/r217.s17-scene-and-form-manipulation/implementation-plan.md) |
| `R217.S18` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Selection ink](./r217-core-editor-stability/r217.s18-selection-ink/implementation-plan.md) |
| `R217.S19` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [3D ground clipping](./r217-core-editor-stability/r217.s19-3d-ground-clipping/implementation-plan.md) |
| `R217.S20` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Roles and Head](./r217-core-editor-stability/r217.s20-roles-and-head/implementation-plan.md) |
| `R217.S21` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Index and Card](./r217-core-editor-stability/r217.s21-index-and-card/implementation-plan.md) |
| `R217.S22` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Geometry, Card and Height Sheet](./r217-core-editor-stability/r217.s22-geometry-card-and-height-sheet/implementation-plan.md) |
| `R217.S23` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Ink palette and constrained widths](./r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/implementation-plan.md) |
| `R217.S24` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Experience controller](./r217-core-editor-stability/r217.s24-experience-controller/implementation-plan.md) |
| `R217.S25` | released by the owner's merge of PR #230 under the [campaign record](../reference/decisions/r217-convergence-campaign-2026-10-30.md); starts when its plan's dependencies have merged, with consumed gates and active scopes rechecked at the trusted base; the record's owner checkpoints apply | [Experience shared homes](./r217-core-editor-stability/r217.s25-experience-shared-homes/implementation-plan.md) |
| `R217.S02` | released 2026-10-28 by owner direction for implementation; starts from current `main` after PR #220; recheck consumed gates and active scopes at the trusted base | [Shell composition](./r217-core-editor-stability/r217.s02-shell-composition/implementation-plan.md) |
| `R217.S03` | released 2026-10-28 by owner direction for implementation; rebased onto `main` `71100651` after PR #221 (S02); the dedicated cross-domain review on 2026-10-29 raised one P2, now corrected with focused regression checks; acceptance pending | [Stage interaction coordination](./r217-core-editor-stability/r217.s03-stage-interaction-coordination/implementation-plan.md) |
| `R217.S10` | owner authorized direct implementation 2026-10-30 from current `main` after S06 and S09 merged, following the approved S10 plan with no additional planning PR; owner subsequently authorized independent combined T1/T2/T3/T5 review and actionable P0–P2 repairs on PR #229 on 2026-10-30; no closeout or merge is authorized | [Dock completion](./r217-core-editor-stability/r217.s10-dock-completion/implementation-plan.md) |
| `R217.S05` | owner authorized recovery and repair of existing PR #226 on 2026-10-29, limited to the approved S05 plan and required verification for independent review; closeout is conditionally authorized only after that review finds the repair acceptable; no merge or omitted scope is authorized | [Drafting state](./r217-core-editor-stability/r217.s05-drafting-state/implementation-plan.md) |
| `R217.S01` | released 2026-10-28 by owner direction; starts from current `main` including PR #217 merge `686e724d`, after T5.P01.S03 merged; recheck consumed gates and active scopes at the trusted base | [Responsibility map and boundaries](./r217-core-editor-stability/r217.s01-responsibility-map-and-boundaries/implementation-plan.md) |
| `T5.P01.S01` | released; starts after PR #207 merges on `main`; the T2 prerequisite merged with PR #199 and T2.P02 closed 2026-10-27; recheck consumed gates and active scopes at its own trusted base | [Native form source and evaluation](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/implementation-plan.md) |
| `T5.P01.S02` | released 2026-10-28; owner authorized acceptance, closeout and P1 merge after clean T1/T2 reviews and satisfied repository gates; recheck consumed gates and active scopes at the trusted base | [Shape reading and sizing](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/implementation-plan.md) |
| `T5.P01.S03` | released 2026-10-28 by owner direction for the integrated final gate; starts from current `main` after PR #216 merge `c13a949d`, with one `perf:spot` checkpoint authorized; recheck consumed gates and active scopes at its own trusted base | [Integrated final gate](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s03-integrated-final-gate/implementation-plan.md) |
| `T5.P01.S04` | released 2026-10-28 by the owner's implementation greenlight; the owner accepted T2's D8 library-scope review and the two recorded deviations on 2026-10-28, deferred browser and performance evidence to S03, and authorized acceptance, routine same-PR closeout and the P1 merge; S01 is accepted; the row remains until a later explicit owner release prunes the verified shipped scope | [My Objects: save and insert editable copies](./t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s04-my-objects-editable-copies/implementation-plan.md) |

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
