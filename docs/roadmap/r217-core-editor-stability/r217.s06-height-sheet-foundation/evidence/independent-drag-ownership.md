# Independent repair evidence — Height Sheet drag ownership

**Finding:** S06-P2-1 (independent review of PR #227)
**Scope:** Height Sheet pointer identity and replacement-reset invalidation only.

## Change

- `StageHeightSheet.svelte` owns one `pointerId` from down through move/up/cancel/lost capture. Secondary down is stopped before capture; events from other pointers cannot move or end the drag.
- `stage-height-sheet.ts` exposes reset notifications independently of height and pin notifications. A replacement can invalidate the live control drag even when both values already equal their defaults.
- The spatial route subscribes the mounted control to its session Height Sheet reset channel. The replacement call site is `activate()` in `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`, which calls `session.replace(snapshot)` before rebuilding the facade.
- Mounted regressions cover secondary-pointer capture/move/up, continued movement by the initiating pointer, ignored movement after release, and `session.replace()` at the unchanged 1.2 m default while a drag is live.

## Verification

- `npm run test --workspace @portfolio/editor -- tests/lib/authoring/spatial-route-gesture.test.ts tests/lib/authoring/stage-height-sheet.test.ts` — passed; 2 files, 77 tests.
- `npm run check --workspace @portfolio/editor` — passed; 0 errors, 0 warnings.
- `npm run test:arch` — passed; 23 files, 193 tests.
- `git diff --check` — passed.

This is repair evidence only; it does not record slice acceptance, S11 integration acceptance, or closeout. No commit was created.
