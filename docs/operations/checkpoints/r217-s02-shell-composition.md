# R217.S02 shell composition — checkpoint

IDENTITY: T1 · R217 · R217.S02
RESUME ROUTE: [phase](../../roadmap/r217-core-editor-stability/README.md) → [plan](../../roadmap/r217-core-editor-stability/r217.s02-shell-composition/implementation-plan.md)
TYPE: implementation
STATUS: paused
GOAL: Implement, review and verify S02; prepare closeout and a PR, without merging absent authorization.

CONSTRAINTS:
- Keep S03 pointer and key handlers separate; S03 reports work in an isolated worktree based on `8c2c86e6`. Serialize shared route and preserve both lanes' release and claim records on integration.
- No S05/S06 drafting or S10 dock contents, no performance benchmarks, no foreign domain writer or Camera authority changes outside approved ownership.
- T3 reviews Head, Find and Experience; T2 and T5 review moved contributions. Acceptance and closeout require those reviews and declared verification.

READ:
- [T1 runbook](../t1-spatial-world/README.md), [S02 acceptance and audit](../../roadmap/r217-core-editor-stability/r217.s02-shell-composition/acceptance.md), PLATE shared shell and responsive sections, editor test contract.

ESTABLISHED:
- Trusted base `8c2c86e638e65a4a0500fa1e3e15b647932549f7` includes merged PR #220; S01 accepted. Consumed gates and scopes were accepted and active. S02 is not an architecture-cycle exposure slice.
- First commit `708cbfe6` records the release, T1 shared-file claim and PLATE audit. Audit inventories additional Find entries, including Scene Resize, Duplicate, Delete and Import model and Experience authoring; these need owner review.
- The current Head Find already includes the contributions shown in Index. Camera evaluation uses the route's clock and the existing Camera evaluator. No motion-speed policy was found in editor or Camera source; PLATE defines movement policies and independent reduced motion.
- S02 §4.6 requires `targetPlaneMetersPerCssPixel` to remain constant across window resize. The Camera evaluator explicitly computes `targetPlaneHeightMeters / rect.height`, preserving vertical world extent instead. At 768 and 1024 px height the new acceptance test reports 0.010416666666666666 versus 0.0078125. This is the plan's Camera-owned stop condition; no shell workaround or Camera change was made.

CURRENT:
- The working diff contains unfinished shell, Find, preference and Camera clock wiring plus focused test edits. It is not accepted or reviewed. The provisional `slow`/`normal`/`fast` time mapping needs Camera/T3 review; it has not been proven across Experience or Preview. Do not treat it as a ratified policy.
- A named browser session briefly exercised a local starter at 768 and 1024 widths; this was exploratory, not the required coarse-pointer acceptance. The task-owned browser and server were closed.
- No independent review, full verification, acceptance, closeout or PR has been completed. The Camera scale requirement needs owner direction.

VERIFICATION:
- Iteration: `npx vitest run tests/lib/platform/app-preferences.test.ts` passed 2 tests on `708cbfe6` plus the two untracked files. SHA-256: module `61a43d34124e4b66e80df772c7558a1bf43525c1ecd179af2462abab2eee84f3`; test `84b15863037b9947092347ef4fb8e8f6b7eec687de1529aa065f0524a9014e8d`.
- On the subsequent working diff, focused Head Find, stage host, Layout precision and preferences tests passed (4 files / 57 tests). `npm run check` previously reported zero errors and four warnings; those warnings were subsequently edited but check has not been rerun. `stage-shell-composition.test.ts` fails 1 of 8 on viewport height scale as described above. These runs do not establish acceptance.
- `git diff --check` passed on the first-commit audit before commit. This is not acceptance. Architecture-integration verification, browser checks, all required reviews and the full implementation-PR merge gate remain owed; integration route is R217.S11.

NEXT:
1. Resolve the Camera-owned height-resize scale conflict with the owner; follow the approved resolution without introducing a shell Camera authority. Reconcile preference semantics and Camera timing with T3. Complete shell and contribution relocation without touching S03 handlers.
2. Add plan-required regression and browser evidence; run the declared tier and full implementation-PR gate, then obtain T3/T2/T5 reviews and address findings.
3. Record acceptance only after evidence and reviews, run routine slice-closeout, and prepare the PR. Merge only with authorization.
