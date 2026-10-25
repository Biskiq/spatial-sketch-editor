# T1 shell handoff — project rename and delete

**T1 pre-implementation review approved.** The bounded integration was approved in [PR #191 review
5643884439](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5643884439).
The approved T1 shell and route work is implemented in the PR #191 branch. This records the actual
integration and verification boundary; it does not close T3.P04.S01 acceptance.

## Implemented integration

- `apps/editor/src/routes/projects/+page.svelte` keeps the existing authenticated project list and
  adds per-row Rename/Delete actions. Each action re-reads the saved project base; Delete also
  preflights publication status. The dialog names the project, preserves typed conflict/busy and
  pending-cleanup responses, updates the list after success, and keeps an explicit refresh/retry
  path after a stale base.
- `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` renders the same actions in the
  existing Head through bounded route callbacks. No global shell or new project surface was added.
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` owns the saved-base read,
  current-session lock, and guarded delete. Rename adopts only the acknowledged name and saved base
  through the existing admission/history/Save authorities; domain edits, selection, task, history
  cursor, and camera pose remain in place. Delete checks the existing unsaved-work guard and retires
  the session only after server acknowledgement. Lifecycle requests are tied to their route epoch,
  so a late response after replacement cannot mutate the newer session.
- `apps/editor/src/lib/platform/ProjectLifecycleActions.svelte` provides the shared confirmation
  dialog, NFC/trim name validation, keyboard focus return, narrow layout, coarse-pointer target
  sizing, and visible refusal/conflict/cleanup state.

## Verification record

- The T1 route integration was checked against the claimed `T1.P02.S06` performance work. A read-only
  three-way check of the trusted base `976323da9e18e96978649e595bc555021964631a`, this branch's
  spatial route, and S06 commit `1747aaeee9bdee3bfafc1a88eb1a09ee40361e92` completed without merge
  conflicts. S06's route change is the additive performance work observer import and installation;
  the lifecycle additions compose cleanly with it. No S06 checkout, harness, fixture, or shared
  performance file was edited.
- Targeted editor contract tests cover the lifecycle component and publication transport, dirty
  rename through Undo/Redo/Save/reopen, active-publication refusal, current-project delete guarding,
  and stale completion after project replacement. The route and component test outcomes are recorded
  in the current T3 baton after the final affected test run.
- The final editor, architecture, heavy, build, package and DB-backed API gates passed; the results
  and exact revision are recorded in the [T3 acceptance evidence](./evidence/2026-10-25/verification.md).
- The integrated Chromium route journey passed through Hub, current Stage, dirty rename/delete,
  stale responses, publication handling, cleanup retry, keyboard focus/escape, and 320×800 coarse
  touch. Dedicated assistive-technology review and owner-operated F9 hard performance rows remain
  open; the browser evidence does not accept or close this slice.

## Preserved boundaries

- The existing project list, Head, route epoch, Save authority, and dirty-work confirmation remain
  the only integration surfaces.
- A saved-base conflict leaves the draft intact and requires an explicit refresh/retry decision.
  Delete does not navigate away before the API acknowledges deletion; pending byte cleanup is shown
  separately from project-access deletion.
- T3.P04.S01 remains in progress. This handoff is implementation evidence, not acceptance or merge
  authorization. Keep draft PR #191 open while the owner-run performance and accessibility review,
  exhaustive residuals, and independent slice acceptance remain.
