# S06-E2 — owner ticks and Paper drawing evidence

**Reviewed base:** `e0ee1a58` (`codex/r217-s06-height-sheet`, PR #227).
**Evidence state:** working tree, uncommitted. The acceptance record remains NOT
ACCEPTED while other slice evidence and the parallel drag-lifecycle repair are
pending. This file records only S06-E2.

## Contract exercised

[`stage-height-owner-integration.test.ts`](../../../../../apps/editor/tests/lib/authoring/stage-height-owner-integration.test.ts)
admits one current-format project, mounts the production Layout and Scene
adapters through the host, and uses a real Layout plinth produced by
`planCommitLayoutObjectPreset` plus a floor-standing 0.75 m Scene table. The
host returns exactly Floor at 0 m, Table at 0.75 m, and the distinct Layout box
top at 1 m. Disposing the Scene registration removes the Table tick while Floor
and the plinth tick remain.

The same fixture includes 0.9 m and 3 m Walls. The Height Sheet's mounted
`plan-cut` consumer drives `facade.plan()`, and `buildPaperPlan` supplies the
actual Paper drawing stream set at each height. The 0.9 m Wall is `hidden` at
1.2 m, `cut` at 0.6 m, then `hidden` again at 1.2 m. The 3 m Wall remains in
the `cut` stream throughout. No evaluator behavior was changed.

## Verification

All commands ran from the repository root on the working tree based at
`e0ee1a58`:

| Command | Result |
| --- | --- |
| `npm exec --workspace=@portfolio/editor -- vitest run tests/lib/authoring/stage-height-owner-integration.test.ts` | Passed: 1 file, 2 tests |
| `npm exec --workspace=@portfolio/editor -- vitest run tests/lib/authoring/stage-facade.test.ts` | Passed: 1 file, 30 tests |
| `npm exec --workspace=@portfolio/editor -- vitest run tests/lib/authoring/layout-drawing-adapter.test.ts` | Passed: 1 file, 14 tests |
| `npm exec --workspace=@portfolio/editor -- vitest run tests/lib/authoring/shape-reading-adapter.test.ts` | Passed: 1 file, 20 tests |
| `npm exec --workspace=@portfolio/editor -- vitest run tests/lib/authoring/stage-paper.test.ts` | Passed: 1 file, 21 tests |
| `npm run test:arch` | Passed: 23 files, 193 tests |
| `npm run check` | Passed: `svelte-check` found 0 errors and 0 warnings |

The test suites above are complete file-level contracts, not narrowed test-name
runs. The architecture lane ran in full.

## Limits and tree state

This evidence does not cover other S06 acceptance criteria, the separate drag
repair, or integrated phase acceptance. This worktree also contains concurrent
uncommitted changes outside this finding's files; this repair did not edit or
reset them. All changes remain uncommitted.
