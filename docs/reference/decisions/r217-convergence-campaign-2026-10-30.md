# R217 convergence campaign — standing execution authorization

**Status: proposed in PR #230. It takes effect only when the owner merges that PR.** Merging it releases R217.S12–S25 and S11 on the conditions below. Until then, nothing here authorizes implementation.

## What changes

R217.S12–S25 and S11 run as one integrated product campaign under one **convergence integrator**, who may work across T1, T2, T3 and T5 without separate track authorization. Only the process for this batch changes. No other phase or track is affected.

## What stays

- **Architecture ownership.** Layout, Scene, Camera, Experience and native forms keep their authorities and the hard rules in `AGENTS.md`. The integrator writes on behalf of those owners and does not move any authority.
- **Plans.** Each slice's plan owns its scope. The integrator may fix plan details needed for correctness and record them, but does not widen scope.
- **Lifecycle.** The phase register, final gate and phase close work as before.

## How the batch runs

| Concern | Rule |
| --- | --- |
| **Start** | Through the T1 runbook, using the T1 baton only. A slice may start when its [dependencies](../../roadmap/r217-core-editor-stability/post-s10-convergence/execution-plan.md#order) have merged and its gates are rechecked at the trusted base |
| **Shared files and sequencing** | One integrator follows the plan's [total order](../../roadmap/r217-core-editor-stability/post-s10-convergence/execution-plan.md#shared-file-order): **one active implementation slice and one implementation PR awaiting merge**. The next slice starts from `main` only after the previous slice's merge and recovery-anchor verification. Parallel implementation requires a separate explicit owner approval. Record the patch base in the T1 baton |
| **Verification** | Unchanged: the slice's declared tier, the whole architecture lane, and browser acceptance. Before merge, rebase onto current `main` and rerun the complete implementation-PR merge gate |
| **Review** | One independent review per slice from a fresh reviewer who did not write it. It also covers the slice's listed specialist concern, so no separate track sign-off is needed. Every P0–P2 finding is fixed and re-reviewed before merge |
| **Acceptance and closeout** | This record is the owner's standing combined acceptance-and-closeout request for each slice, under the `slice-closeout` skill's existing rule. It applies only when the independent review of the current revision is clean and every plan criterion is evidenced. Otherwise the skill stops and reports |
| **Commit and merge** | The integrator may commit, push, open PRs and make one P1 merge per slice, with no agent footer, after the steps above. Recovery anchors are verified after merge |

## Owner checkpoints

The integrator stops and asks only for these:

1. **Wall feel, after R217.S15.** The owner tries the Wall drag before S16 and S17 build on it, and judges whether Layout's footprint-only 3D preview is sufficient. O2 can change cheaply here.
2. **3D ground, only if R217.S19 ends with a numerical failure or capped reach.** A fade alone never counts as passing a numerical row.
3. **Material change.** Anything needing a persisted format, a new gate or gate version, a planner or Camera-authority change, a new capability, a change to an owner ruling, or a contract change its plan doesn't name.
4. **Waived evidence.** Any criterion that can't be evidenced and isn't already named as owed in its plan. Evidence a plan names as owed still blocks the slice it is carried to.
5. **Final gate.** R217.S11 may run when S12–S25 have merged. Its acceptance, its merge, phase close and milestone acceptance stay with the owner.

Browser-only visual calibration isn't a checkpoint. The integrator decides it within the role tables and attaches captures to the acceptance record.

## Stop and revocation

The owner can pause or end the campaign at any time by saying so, or by removing rows from the [release list](../../roadmap/now.md). A failed merge gate, a reverted slice or two consecutive review rounds with the same P0–P1 finding also stop the campaign until the owner has been told.
