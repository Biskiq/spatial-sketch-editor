# Next-wave authorization: T1.P02.S02 drawing and T2.P02.S03 own-model import final gate — 2026-10-27

**Status: owner-authorized 2026-10-27.** The owner directed the next production batch to be folded
into the post-S06 coordination PR (#198) instead of a separate documentation PR: authorize
`T1.P02.S02` (Wall drawing) and `T2.P02.S03` (own-model import final gate) “without expanding either
implementation scope”; complete their outstanding plan and cross-track reviews in this round where
practical, and otherwise “record explicit start conditions or retain the affected slice unreleased”;
and reconcile the release list by pruning verified shipped entries and adding the new releases.

This record is decision provenance, like the [batch E](./batch-e-authorization-2026-10-22.md) and
[post-Batch-E](./post-batch-e-authorization-2026-10-23.md) records. It ratifies no contract and
creates no gate, format, budget, package or phase. Lifecycle stays in the
[roadmap registers](../../roadmap/README.md); each slice's scope stays in its own plan; the
[release list](../../roadmap/now.md) owns permission.

**Base.** `origin/main` `4dcd53e9`, the merge of PR #189. PR #198 carries this record, the two plan
reviews and the register/release-list reconciliation.

## Authorized and released

| Scope | Condition | Plan review |
| --- | --- | --- |
| `T1.P02.S02` — Draw, close, divide and delete | Released. Starts after PR #198 merges on `main`, on its own trusted base. Plan review complete with the T3 Head/F4 and T2/T3 contribution-compatibility reviews ([review](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/plan-review.md)); the standing T3 implementation review of the shared Head/F4 diff and the owning-track review of any T2/T3 adapter edit remain merge-time obligations. Scope unchanged: no S03 Opening family, curves, levels, datums, overheads or general shell rebuild | [plan](../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s02-draw-close-divide-delete/implementation-plan.md) |
| `T2.P02.S03` — Integrated final gate | Released. Starts after PR #198 merges on `main`, with `T2.P02.S01` and `S02` already accepted, and on its own trusted base. Plan review complete ([review](../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/plan-review.md)); the C3 prerequisite wording was reconciled to the shipped `T3.P04.S01`. Scope unchanged: independent integrated acceptance of own model import | [plan](../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/implementation-plan.md) |

**T5.** The same owner coordination approved the [G0 architecture
commission](./t5-g0-approval-2026-10-27.md) as T5's next planning activity, executable once PR #198
merges. That approval authorizes planning only and is recorded separately; it is folded into this PR,
not duplicated here.

## Reviews completed in this coordination round

- **T3 review of the shared Head/F4 shell allocation — pass for the plan** with conditions: the Head
  change is additive (bounded Find), no T3-owned Save/Preview/history/F4 semantics change, no shared
  F4 contract change, and the actual Head diff keeps its standing implementation review.
- **T2/T3 contribution-compatibility review — compatible as planned** with conditions: any adapter
  registration change is additive with a default, a required T2/T3 adapter edit stays with its owner,
  and no Index/contributed entry is retired before its dock/Find/invoked route is verified reachable.
- **S03 final-gate plan review — pass**, with the stale C3 wording corrected and the carried owner-run
  rows kept with S03.

Both are pre-build plan reviews performed in this round against the named contracts and code; they do
not replace the independent implementation review, the T3 ownership acknowledgement or any acceptance
step.

## Release-list reconciliation

The owner release prunes two **verified shipped** rows from the [release list](../../roadmap/now.md):

- `T1.P02.S06` — performance foundation, accepted AC-qualified 2026-10-27 and shipped on PR #190
  (`6af62eb4`);
- `T3.P04.S01` — project rename and delete, accepted 2026-10-25 and shipped on PR #191 (`aa1db37a`),
  T3.P04 closed the same day.

and adds the two releases above. Permission and acceptance history for the pruned rows stays in their
records.

## Preserved

- the T1/T2 execution DAG: S02 drawing precedes S03 Opening and S04's final gate; `T2.P02.S03` is an
  independent final gate that waits on nothing in T1;
- shared-file ownership and the serialized shared `units/**` merge rule; each lane edits a shared
  surface only through its own recorded claim and owner review;
- **independent implementation PRs**: each slice reruns the complete merge gate on then-current
  `main`, gets an independent review and its own P1 merge commit; no combined implementation batch PR;
- every existing acceptance requirement — architecture-integration for S02, exhaustive for S03 —
  the performance rows on the designated MacBook Air M2, and the reference-hardware rule.

## Not authorized or changed

- `T1.P02.S03`, `T1.P02.S04` and every other scope omitted from the [release list](../../roadmap/now.md)
  stay under the [production hold](../../roadmap/README.md#production-implementation-hold);
- T4 stays frozen (R1-D) behind [Core Editor Stability](../../roadmap/core-editor-stability.md);
- no phase closes, no gate, format, budget or package changes, no deployment, no epoch activation;
- PR #198 contains no production implementation, and neither released slice may start before it
  merges.

## Owner signature

```text
T1.P02.S02 approved and released — starts after PR #198 merges; reviews complete with conditions
T2.P02.S03 approved and released — starts after PR #198 merges; plan review complete
T5 G0 approved as planning only — separate record
Owner: repository owner (PR #198 direction, 2026-10-27)   Date: 2026-10-27
```
