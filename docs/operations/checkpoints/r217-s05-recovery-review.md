# R217.S05 recovery review — checkpoint

IDENTITY: T1 · R217 · R217.S05
RESUME ROUTE: ../../roadmap/r217-core-editor-stability/README.md → ../../roadmap/r217-core-editor-stability/r217.s05-drafting-state/implementation-plan.md
TYPE: interrupted implementation recovery and independent review
STATUS: repair complete; independent owner re-review pending
GOAL: Repair PR #226, preserve useful work, verify S05 and S08 integration, update acceptance evidence and PR description.

CONSTRAINTS:
- Owner authorizes recovery and repairs directly in this conversation despite the stale release-list wording. No visual polish (post-S10).
- No merge. Do not run slice closeout until the reviewing conversation finds the repair acceptable; a separate Luna medium chat will own closeout.
- Worktree: `/Users/tony/Documents/Biskiq/worktrees/r217-s05-drafting-state`; branch `codex/r217-s05-drafting-state`.
- Preserve existing work and other worktrees. A merge is currently in progress; do not restart or discard it.

READ:
- docs/README.md; T1 runbook and baton; R217 phase README; S05 implementation plan and acceptance record.
- apps/editor/tests/README.md (architecture-integration tier; full merge gate still owed).
- browser-hygiene and agent-browser skills; work-checkpoint and caveman-review skills.
- Architecture cycle start check: R217.S05 is not an exposure slice; no window transition.

ESTABLISHED:
- PR #226 initially had title `interrupted comit`, empty body, and one commit `d5c7fe4854dda29c71e51ef4baa2ac025a2535bb`.
- F1/F2/F4/viewport gates are accepted and required capabilities active. S08 merged in main at `ac944f02beaa892aa5579a03e0b5fa4561831cae`.
- The merge in this S05 worktree combines the interrupted commit with `origin/main` at
  `ac944f02beaa892aa5579a03e0b5fa4561831cae`. Both Scene conflicts are resolved from the S08
  main-side Card/marks structure; no unresolved paths remain.
- S08's exact object Position/Yaw/Size Card writers, Move/Turn/Size marks, support admission and
  F4 planner path remain in place. The obsolete Arrange editor is not restored.

EVIDENCE / FINDINGS:
- P1 fixed: Layout Ink, pointer and typed Scene Place, and S08 object Move read the live drafting state
  and share the same adaptive current Grid minor and one rounding/float-cleaning pass. Snap off and
  Alt/Option hold bypass snapping; Layout Junction/Wall precedence and Scene support checks remain
  ahead of free-point rounding.
- P1 fixed: Grid and Snap words announce the same evaluated interval. The adaptive grid refines
  below the configured 1 m value.
- P2 open: while a Camera evaluation is active, changing the configuration's `Minor interval`
  updates session view state but not the adaptive visible interval. The approved plan also calls
  the setting an interval override, so their relationship requires owner review.
- Place already rounds in pointerPlaceSupport before re-querying support and passes snappedStep to preview builders, which intentionally do not round again. Preserve this no-double-snap design; verify native/model/copy/typed paths.
- Layout Ink checks Junction/Wall before rounding free points; freePointWouldCreateContact guards undeclared contacts. Preserve identity and precedence.
- Scale detents issue existing zoom ViewingIntent through submit/requestIntent; Fit unions Layout and available Scene rendered bounds. These have been inspected, not accepted.

VERIFICATION:
- Focused S05/S08 contracts: `157 passed` across six suites (drafting arithmetic, adaptive grid,
  Layout Ink, Scene floor support, Scene editing and mounted route interaction).
- `npm run check`, `npm run check:api`, and `npm run build` passed; Vite emitted its existing
  dependency/chunk notices. `npm run test:heavy` passed (`138 tests`).
- `npm run test:arch`: `192 passed, 1 failed`. Full `npm test`: `3097 passed, 1 failed`. Both
  failures are the same `tests/docs/parallel-track-gates.test.ts` release-list guard: the T1 baton
  names this owner-authorized R217.S05 recovery, which has no release-list row. The owner authorized
  recovery despite the stale wording; this repair did not add a release-list row.
- DB-backed API tests were not run: this worktree has no `.env` or `DATABASE_URL`, and the changed
  product surface is the editor.
- Browser: worktree Vite was explicitly bound to `localhost:5174`. A fresh Enclosed room project
  switched between Plan and 3D, used Scale detents and Fit all, orbited and wheel-zoomed in 3D, and
  toggled Grid, Snap and Alt/Option hold/release. Grid and Snap both read `0.5 m` after Fit all; no
  source was saved. The owned browser and Vite server were closed.
- Tested working tree was based on `d5c7fe4854dda29c71e51ef4baa2ac025a2535bb` plus the
  `ac944f02beaa892aa5579a03e0b5fa4561831cae` merge. The merge-resolution commit records its final
  identity.

NEXT:
1. Finish the merge-resolution commit and update the existing PR description and acceptance evidence.
2. Send the repaired PR and severity-rated findings to the parent conversation for independent review.
3. Do not close out or merge; the parent will decide whether the release-list exception and
   configured-interval semantics are acceptable.

OPEN:
- Repair agent must report severity-rated fixed and unresolved findings and exact checked revision/tree.
- Parent chat: `01a18a8e-a188-7e93-ae0f-c8b613fa7174` (Review and repair PR #226). Human explicitly authorizes the repair chat to message it for re-review.
