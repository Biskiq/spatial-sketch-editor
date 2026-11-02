# R217.S24 Experience controller — checkpoint

IDENTITY: T1 · R217 · R217.S24
RESUME ROUTE: [R217 README](../../roadmap/r217-core-editor-stability/README.md#slice-register) → [S24 plan](../../roadmap/r217-core-editor-stability/r217.s24-experience-controller/implementation-plan.md) → [S24 record](../../roadmap/r217-core-editor-stability/r217.s24-experience-controller/acceptance.md)
TYPE: implementation
STATUS: paused
GOAL: Extract the Experience commands and state from `ExperienceSurface.svelte` into a controller with no visible change. Also carry the owner-directed fix for the Experience lens crash (below). Then complete browser acceptance, independent review, close-out and merge.

CONSTRAINTS:
- Plan scope only. Extraction must change nothing visible. The controller has no DOM access and no second selection or Camera state.
- Owner ruling, 2026-11-01: fold the `ResizeObserver` null-guard fix into S24 instead of landing it separately. That fix is the slice's one intended behaviour change: the Experience lens stops crashing.
- Routine: a Haiku implementer, then the coordinator's independent review, then a Haiku close-out (docs only) with a `--merge` merge. No commit trailers (AGENTS.md rule 12). Every gate runs on the final code SHA, and the record names that SHA.

READ:
- `apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts`, `experience-controller-root.svelte.ts`, `ExperienceSurface.svelte`
- `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`: the two lane `$effect`s after `let zoomSlotEl`, and the zoom slot `bind:this` inside `{#if lens === 'world'}`
- `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts`: "measures the lanes without observing an unmounted slot when the lens leaves World"

ESTABLISHED:
- **The problem.** Since R217.S22 (`7f4865c5`, merged in PR #252), choosing the Experience lens crashes the editor. The route binds the zoom slot inside the World-only branch. Leaving World sets that binding to `null`, but the S22 lane effect treated only `undefined` as absent and called `ResizeObserver.observe(null)`. Browsers throw `TypeError: Failed to execute 'observe' on 'ResizeObserver'`, and the page stops responding (Grid and World no longer change state).
- **Scope of the problem.** It is reproduced on `main` at `668eeb66` and on this branch, so it is not caused by the extraction. jsdom has no `ResizeObserver`, so every route test returned before observing, and S22's review never opened the Experience lens in a browser.
- **The fix.** `bc24b72c` treats `null` and `undefined` as "no lane" in both lane effects (zoom slot and Sheet lane), and widens `zoomSlotEl`'s type to include `null`.
- **The test.** The new route test stubs a browser-strict `ResizeObserver` and switches World → Experience → World. It fails without the fix (the same `TypeError`, and the World chrome doesn't return) and passes with it.
- **The extraction.** `80c48e85` and `ecd23b86`. The five plan test files have an empty diff against `668eeb66` and pass, with 39 tests. The new controller tests are 14 under jsdom and 2 under node.

EVIDENCE:
- Commits on `claude/r217-s24-experience-controller`: `80c48e85` refactor, `ecd23b86` controller tests, `bc24b72c` lens crash fix and its test.
- The implementer's gate run at `ecd23b86`, in a clean worktree: check 2055/0/0; kernel checks exit 0; test:arch 23/210; npm test 268/3500; test:heavy 11/138; build exit 0; diff --check clean. Superseded by the run at `bc24b72c` below.
- Freeze evidence, from before the fix, is in the coordinator's scratchpad and was not committed. The test above reproduces it.

RULED OUT:
- The extraction causing the freeze, since it reproduces identically on `main` `668eeb66`.

DO NOT REPEAT:
- Diagnosing the freeze. Re-checking that the five plan test files are unchanged.

CURRENT:
- The fix is committed. Browser acceptance has not run, the acceptance record has no implementation evidence yet, and there is no review verdict. Draft PR open.

VERIFICATION:
- Tier: affected-subsystem.
- Tested revision: `bc24b72c`, run in the main checkout, which includes a stale git-ignored `.svelte-kit`. The results:
  - check: 2056 files, 0 errors, 0 warnings.
  - Kernel checks: exit 0 each.
  - test:arch: 23 files, 210 tests.
  - test:heavy: 11 files, 138 tests.
  - build: exit 0.
  - git diff --check 668eeb66..HEAD: clean.
  - npm test: 268 files, 3501 tests passed on the re-run. The first full run failed 1 test: `scene-editing-surface.test.ts` › "places a verified catalogue model through the persistent Place planner" (`refused` instead of `committed`). It passes 3 of 3 alone and in the full re-run, so it is load-dependent. A clean-worktree run should confirm the counts before acceptance.
- Owed:
  - The before/after browser journey in headed Chromium at 1440×900 and 1180×820: World↔Experience, Create Experience, Capture and bind a View, Create first Guide, insert and move a Stop, save a Stop, set the default View, Enter Preview with free orbit, return.
  - "Before" is `main` `668eeb66` with only `bc24b72c`'s route hunk applied in a temporary worktree, because unpatched `main` crashes at step one. The comparison must then show no visible change from the extraction. The lens no longer crashing is the one intended difference.
  - Independent review, close-out and merge. S11 remains the integration route.

NEXT:
1. Run the before/after browser journey above with 0 page errors (the favicon 404 is TD-19). Record the tested SHA, the gate table at the final code SHA, the unchanged-assertions proof, the PNG comparison, and the lens fix with its test, under "Implementation evidence" in the S24 acceptance record.
2. Mark the PR ready. The coordinator reviews it, a Haiku agent runs the docs-only close-out, merges with `--merge`, completes this checkpoint (delete it and clear the baton's RESUME), and the next slice is R217.S25.

OPEN:
- A load-dependent flake in `scene-editing-surface.test.ts` (persistent Place planner), seen once under the full suite. If it recurs, record it for tech-debt beside TD-18.
- None for the owner. S22's acceptance record still says it ran no Experience lens check. Close-out can note that the S22 regression was found and fixed in S24.
