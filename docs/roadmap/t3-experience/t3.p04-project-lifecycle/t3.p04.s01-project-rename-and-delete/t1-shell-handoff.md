# Closed T1 shell handoff — T3.P04.S01

**AUTHORITY: NONE.** The bounded project-list, Head and current-route rename/delete integration
shipped in PR #191 after T1 pre-implementation review 5643884439. The accepted slice result and
browser evidence are in [acceptance.md](./acceptance.md). Current behavior is owned by
[`reference/components/persistence.md`](../../../../reference/components/persistence.md) and the
editor entry points below.

**Delivered:** saved-base rename with draft/history preservation; guarded confirmed delete; route
epoch protection; keyboard focus, narrow layout and coarse-pointer dialog behavior. The read-only
S06 comparison established route compatibility; no S06 checkout, harness or fixture was modified.
**Evidence:** final exhaustive gate and integrated journey in the acceptance record.
**Entry points:** `apps/editor/src/routes/projects/+page.svelte`,
`apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte`,
`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`,
`apps/editor/src/lib/platform/ProjectLifecycleActions.svelte`,
`apps/editor/tests/lib/platform/project-lifecycle-actions.test.ts`.
**Residuals:** no slice blocker or unreviewed T1 dependency.

**Recovery:** `git show 41800d27231db4d007314f6a8c437a90c75d5e94:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t1-shell-handoff.md` · `git show closed/T3.P04.S01:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t1-shell-handoff.md`
