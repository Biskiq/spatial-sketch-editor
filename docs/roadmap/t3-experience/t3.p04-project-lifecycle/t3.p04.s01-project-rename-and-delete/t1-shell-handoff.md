# T1 shell handoff — project rename and delete

**T1 pre-implementation review required.** This records the bounded integration target for T1. No
claimed shell file has been edited. The patch remains serialized behind `T1.P02.S06`'s recorded
claim on `apps/editor/src/routes/projects/+page.svelte` and `apps/editor/src/lib/authoring/stage/shell/`.

## Current integration points

- `apps/editor/src/routes/projects/+page.svelte` authenticates, calls `api.listProjects()`, and
  renders each owned project with its name/version/date and an `Open` link. It has no row action
  state or lifecycle controls. The bounded list patch adds per-project Rename and Delete actions;
  delete confirmation names the project; successful rename/delete refreshes the list; retryable
  `project-busy` and `cleanup: pending` remain visible as typed results.
- `apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte` receives `projectId` and
  `projectName`, renders the name in its identity region, and has no lifecycle callback. Any open
  project action is a T1-owned addition under the current Round 2 shell contract, with no new global
  shell.
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` owns the current route epoch,
  `headSave`, and the existing `beforeNavigate` dirty-work confirmation. Its load path and
  `session.isCurrent(token)` checks prevent a stale replacement completion from mounting over a
  newer project. Current-project delete must use that guarded replacement path, preserve the draft
  on cancel/refusal, and return to `/projects` only after confirmed server success.

## Required T1 decisions before editing

- Confirm the exact list-row and Head action placement, keyboard/focus return behavior, narrow and
  coarse-pointer layout, and how unpublish-first/refusal/pending-cleanup messages are presented.
- Confirm the open-route integration uses the established dirty-work and guarded-replacement flow
  without clearing history or replacing a dirty draft on rename. The server rename acknowledgement
  moves the saved base; the next Save must either use that base or return conflict while retaining
  the draft.
- Confirm a current-project delete cannot retire the session before the API confirms deletion, and
  a late response after project switch cannot affect the newer session.
- Keep the patch inside the existing project list and current Head/route surfaces. A new project
  surface, global menu, or change to the Head contract beyond the bounded callbacks is a
  stop-and-report to T1.

The exact product and accessibility acceptance remains in the [implementation plan](./implementation-plan.md).
No shell implementation or browser evidence is claimed in this handoff.
