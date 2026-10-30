# R217.S05 recovery review — checkpoint

IDENTITY: T1 · R217 · R217.S05
RESUME ROUTE: ../../roadmap/r217-core-editor-stability/README.md → ../../roadmap/r217-core-editor-stability/r217.s05-drafting-state/implementation-plan.md
TYPE: interrupted implementation recovery and independent review
STATUS: follow-up repair complete; final repository verification and independent owner re-review pending
GOAL: Repair PR #226, preserve useful work, verify S05 and S08 integration, update acceptance evidence and PR description.

CONSTRAINTS:
- Owner authorized recovery and repair of existing PR #226 on 2026-10-29, limited to the approved S05 plan and required verification. No visual polish (post-S10).
- No merge. Do not run slice closeout until the reviewing conversation finds the repair acceptable; a separate Luna medium chat will own closeout.
- Worktree: `/Users/tony/Documents/Biskiq/worktrees/r217-s05-drafting-state`; branch `codex/r217-s05-drafting-state`.
- Preserve existing work and other worktrees. The merge is complete; do not close out or merge the PR.

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
- P2 repaired: Automatic mode refines with zoom; Override mode changes the rendered lattice and
  shared Snap interval, with coarsening for legibility. The 8–16 px transition, finer-line fade,
  and suppression rules remain. Both labels derive from one evaluated interval. Tests include
  very small and very large choices.
- S08 Move regression assertions independently cover Snap on/off/held, changing the shared interval
  during captured drag, a stale per-session Place step, refusal at the snapped support floor
  boundary, exactly one F4 entry, and Undo restoring the prior position. Card writers remain free
  of Snap behavior.
- Place already rounds in pointerPlaceSupport before re-querying support and passes snappedStep to preview builders, which intentionally do not round again. Preserve this no-double-snap design; verify native/model/copy/typed paths.
- Layout Ink checks Junction/Wall before rounding free points; freePointWouldCreateContact guards undeclared contacts. Preserve identity and precedence.
- Scale detents issue existing zoom ViewingIntent through submit/requestIntent; Fit unions Layout and available Scene rendered bounds. These have been inspected, not accepted.

VERIFICATION:
- Previous verification against merge-resolution commit `8c5e39b5325dab650cf6e3640a4ecac2623f5338`
  found the release-list guard failed; the owner-authorized recovery row is now recorded in
  `docs/roadmap/now.md` and the R217 slice register without changing gate requirements or claiming
  acceptance.
- Follow-up verification was run on the finalized product/documentation worktree immediately before
  commit `FOLLOW-UP-REVISION`: `npm run test:arch` passed (193 tests/23 files), full `npm test`
  passed (3,101 tests/243 files), the focused S05/S08 suites passed (227 tests/10 files),
  `npm run check` passed (0 errors/0 warnings), `npm run build` passed with existing dependency and
  chunk warnings, and `git diff --check` passed. No API code changed; DB-backed API tests were not
  run.
- Browser: actual Ink and Place pointer gestures covered Snap on/off and Alt held where applicable;
  Automatic zoom and a 5 m Override were observed in Grid/Snap labels. Pointer Move was blocked by
  the ephemeral `create=1` scene's stale-selection warning after undo, so its behavior is asserted
  numerically in `scene-editing-surface.test.ts`. No source was saved.
- DB-backed API tests were not run: this worktree has no `.env` or `DATABASE_URL`, and the changed
  product surface is the editor.
- Product verification ran against merge-resolution commit
  `8c5e39b5325dab650cf6e3640a4ecac2623f5338`, tree
  `25d96ef517a6b621fe04285e4e537d9fc8ca4294`, based on interrupted commit
  `d5c7fe4854dda29c71e51ef4baa2ac025a2535bb` and main/S08 commit
  `ac944f02beaa892aa5579a03e0b5fa4561831cae`.
- PR #226 currently points at `7bcbfda5679b62ee000ea75c95df75a6008241d8`; this follow-up is not yet
  committed or pushed. It remains open and unmerged.

NEXT:
1. Finish required repository verification, update this checkpoint and acceptance with exact tested
   revisions/results, then update and push PR #226.
2. Hand the revision directly to the parent for independent review. Conditional closeout applies
   only after acceptable review; do not claim acceptance or merge this PR.

OPEN:
- Product follow-up repair is complete; final verification and independent review are pending.
- Parent chat: `01a18a8e-a188-7e93-ae0f-c8b613fa7174` (Review and repair PR #226). Human explicitly authorizes the repair chat to message it for re-review.
