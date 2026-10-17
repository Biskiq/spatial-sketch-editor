# T1.P01.S04 host-integration exception — 2026-10-17

**Owner decision.** Narrowly authorizes `T1.P01.S04` to make the host and route changes the Head
Save integration needs, and closes the three gaps its implementation review reported. It reopens no
batch-B authorization and grants no capability, gate or acceptance state.

**Context.** Batch B authorized S04 including the PLATE Head Save integration
([record](./batch-b-authorization-2026-10-17.md), ruling D3). The slice plan also said the slice
"edits no host core, route or shell module", an instruction written for adapter contributions. The
two cannot both hold: mounting `T3.P01.S02`'s `createSaveState` needs the per-epoch coordinator and the
project's saved-base metadata, both owned by the route host. Review also found that the Card name
writer had no contribution point and that Undo-during-proposal was vacuous because Layout precision
held no proposal lease.

## What this authorizes

1. **T1 alone** may edit `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` and the
   host surfaces it needs — `stage/stage-facade.ts`, `stage/stage-contributions.ts`,
   `stage/host-acceptance.ts`, `stage/shell/EditorHead.svelte` and `stage/shell/EditorCard.svelte` —
   for exactly three purposes:
   - construct and mount the conditional-Save controller per project epoch, with the loaded
     project's saved-base token/revision/content id, conflict reload returned to the existing
     replacement guard, and unsaved-work signalling at replacement and route exit;
   - add the **Card name writer** contribution point, delegating to the existing canonical Layout
     metadata planner (one writer, no second planner, no authoring in the Card);
   - make a live Layout proposal hold the host's one gesture lease so Undo/Redo report
     `live-proposal` for as long as it is held.
2. The read-only-host assertion in `editor-host-no-write.test.ts` may be narrowed to distinguish the
   one authorized writer (`api.saveAcceptedSource`, reachable only through
   `save/api-transport.ts`) from every other write path. It must still fail if any other writer is
   reached or if the authorized writer is called from another module.

## What it does not authorize

- Any second editor host, second F4 writer, second name planner or adapter-owned source mutation.
- T2/T3 scope, Scene edits, or the T2 drag/selection work in this worktree.
- Any capability, gate, acceptance, readiness, merge or closeout record. The slice remains
  unaccepted until its independent review passes.
- Relaxing the remaining no-write assertions beyond the one Save path named above.

## Boundaries carried forward

- T3 owns the Save protocol, state machine and server; T1 only mounts them.
- A conflict reload is data handed to the replacement guard; nothing installs a remote document
  automatically.
- Blur never commits; a refused proposal releases no history; undo is unavailable only while the
  lease is actually held.
