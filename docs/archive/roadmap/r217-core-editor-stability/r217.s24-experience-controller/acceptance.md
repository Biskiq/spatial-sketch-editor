# R217.S24 — acceptance record: Experience controller

**Slice:** R217.S24 · **Status:** accepted 2026-11-02 at tested revision `bc24b72c` (clean independent review, one P2 evidence finding corrected; routine close-out under the owner's direction; no override) · **Plan:** [implementation-plan.md](implementation-plan.md) (closed to a stub; owns the criteria in its recovery line) · **Phase:** [R217](../../../../roadmap/r217-core-editor-stability/README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

**AUTHORITY: NONE.** This record reports what was implemented, the gates run, the browser evidence, the pixel comparison and the residuals. The [phase slice register](../../../../roadmap/r217-core-editor-stability/README.md#slice-register) owns status, and the verdict belongs to the independent review.

## What the slice did

| Part | Where | Change |
| --- | --- | --- |
| Controller | [`experience-controller.svelte.ts`](../../../../../apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts) (new) | One factory, `createExperienceController(readServices, readSnapshot)`. Owns `run`, `createExperience`, `captureAndBind`, `createFirstGuide`, `rebindToCapturedView`, `savePresentation`, `setDefaultView`, `insertStop`, `moveStop`, `saveStop`; the derived `current`, `currentGuide`, `selectedPresentation`, `selectedStop`, `travelGaps`, `stopUsage`, `guideStops`, `viewsOf` and `filteredPresentations`; and `message`, `busy` and the drafts |
| Surface | `ExperienceSurface.svelte` (retired in R217.S25) | Markup and styles only, plus the one piece of view state it kept (which Guide column is open) |
| Unchanged | `commands.ts`, `focus.svelte.ts`, `travel-gap.ts` | Still the command, focus and gap authorities |

The controller has no DOM access and holds no selection or Camera state. `readServices` and `readSnapshot` are getters because the route replaces either without unmounting the lens, which the controller test exercises.

**The slice also carries the owner's ruling of 2026-11-01** that the Experience lens crash is fixed here rather than landed separately. That fix is the slice's one intended behaviour change; the extraction is otherwise invisible.

## Implementation evidence

### Tested revision

- Final code revision: **`bc24b72c`** on `claude/r217-s24-experience-controller` (base `668eeb66` on `main`).
- Code commits: `80c48e85` the extraction; `ecd23b86` the controller tests; `bc24b72c` the lens fix and its route test. `feaf876a` is the checkpoint, docs only, and carries no code.
- The browser matrix ran from the branch worktree at `bc24b72c`; this record is committed after it and carries no code.
- `git diff --name-only 668eeb66..bc24b72c` touches no `apps/api` path, so `check:api` and `test:api` do not apply and were not run.

### Gates

Run at `bc24b72c` in a clean, detached worktree (`.claude/worktrees/s24-gates`, no uncommitted changes, `node_modules` linked out of the main checkout so the workspace packages resolve).

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check, generated tsconfig | 0 errors, 0 warnings (exit 0) |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | the whole arch lane, including the documentation and parallel-track gates | 23 files, 210 tests pass (exit 0) |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 132 pass, 6 skipped (138) (exit 0) |
| `npm run build` | `apps/editor` production build | exit 0 |
| `npm test` (clean worktree) | `apps/editor` `vitest run` | 268 files, 3493 pass, 2 fail, 6 skipped (3501) — see below |
| `npm test` (main checkout at `feaf876a`) | the same suite, real `node_modules` | 268 files, **3501 pass, 0 fail** (exit 0) |
| `git diff --check 668eeb66..bc24b72c` | whitespace | clean, no output |

**The two clean-worktree failures are that tree's, not the branch's.** `tests/lib/perf/spot-entrypoint.test.ts` spawns `node_modules/vite-node/vite-node.mjs` by path and cannot resolve it through the worktree's linked `node_modules` (`MODULE_NOT_FOUND` for the worktree path); `tests/lib/layout/t1s06-persistent-storage.test.ts` fails its `storage:vector-slots-copied` count in the same tree. Both files pass together in the main checkout at the same code (9 tests), and the complete suite there passes 3501 of 3501. The checkpoint's earlier main-checkout run (`bc24b72c`) agrees, at 2056 checked files; this svelte-check version prints only the error and warning totals, so no file count is claimed for the clean tree.

Against S23's recorded baseline (266 files, 3484 tests), S24 adds 2 files and 17 tests to the complete suite. The arch lane is unchanged at 210.

### Plan test coverage

- The five plan test files have an **empty diff against `668eeb66`** and pass with assertions unchanged: `experience-authoring.test.ts` (14), `experience-controllers.test.ts` (5), `first-guide.test.ts` (12), `preview-handover.test.ts` (6), `travel-gap.test.ts` (2) — **39 tests**.
- The new controller tests are [`experience-controller.test.ts`](../../../../../apps/editor/tests/lib/experience/experience-controller.test.ts) (14, jsdom) and [`experience-controller-boundary.test.ts`](../../../../../apps/editor/tests/lib/experience/experience-controller-boundary.test.ts) (2, node: no DOM, no second selection or Camera state).
- One run of the seven files: **55 tests, all passing**.
- Mutation proof (the tests README's replacement-claim rule) does not apply: no test asserts a replaced contract, and the five plan files are unchanged.

### Browser acceptance

Real pointer and keyboard input in **headed Chromium** (Playwright 1.63, `headless: false`), one browser per pass, closed in `finally`. Two Vite dev servers from the two trees against two instances of a scratch API on the same scratch database (`biskiq_r217_s24`, created for this slice on the local Compose Postgres, migrated, dropped at the end); sessions were signed in through the API test-auth seam.

**The two trees.**

- **After:** the branch at `bc24b72c`.
- **Before:** `main` at `668eeb66` in a temporary worktree, with **only `bc24b72c`'s route hunk applied** (`apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` at blob `8da3bda4`, the same blob the branch has). Unpatched `main` cannot be the "before" of this journey, because it freezes at step one — that is the crash fixed below.

**The journey, run identically on both trees.** Each pass mints a project, boots the empty create baseline, installs the enclosed-room starter through Find (so the Stage, Preview and the backdrop are real architecture), Saves to Cloud, then:

1. World → Experience (lens switch), 2. Create Experience, 3. press 3D and **Capture** (View + Presentation), 4. create the first Guide (`Entry`), 5. **Capture** again and **Insert selected Presentation as a Stop**, then **Move up** the last Stop, 6. **Save Stop** with `hold 4`, 7. **Capture and rebind** on the second Presentation and set the **Default View**, 8. **Enter Preview**, drag-orbit freely, 9. **Exit Preview**, 10. Experience → World.

The Stop reorder is recorded from the rendered rows: `[Presentation 1, Presentation 1, Presentation 2]` → `[Presentation 1, Presentation 2, Presentation 1]` after one **Move up**. The default-View select appeared with two Views (`View 2`, `View 3`) and accepted the second.

**Matrix: 4 runs, 12 states each, 48 screenshots.**

| Pass | States | Page errors | Failed steps | Request failures | Horizontal overflow |
| --- | --- | --- | --- | --- | --- |
| `before-1440x900` | 12 | 0 | 0 | 0 | none |
| `after-1440x900` | 12 | 0 | 0 | 0 | none |
| `before-1180x820` | 12 | 0 | 0 | 0 | none |
| `after-1180x820` | 12 | 0 | 0 | 0 | none |

Each pass logs exactly one console error: `GET /favicon.ico` 404 (TD-19, pre-existing). Files are named `<tree>-<width>x<height>-<state>.png`, with one journal per pass: [before 1440×900](evidence/2026-11-02-browser/before-1440x900-journal.json) · [after 1440×900](evidence/2026-11-02-browser/after-1440x900-journal.json) · [before 1180×820](evidence/2026-11-02-browser/before-1180x820-journal.json) · [after 1180×820](evidence/2026-11-02-browser/after-1180x820-journal.json).

**The comparison: no visible change from the extraction.** Every before/after pair is pixel-compared in full:

| State | 1440×900 differing px | share | 1180×820 differing px | share |
| --- | --- | --- | --- | --- |
| 01 world | 0 | 0% | 0 | 0% |
| 02 Experience, empty | 0 | 0% | 0 | 0% |
| 03 Create Experience | 0 | 0% | 0 | 0% |
| 04 Capture | 2229 | 0.172% | 2006 | 0.207% |
| 05 First Guide | 6709 | 0.518% | 7045 | 0.728% |
| 06 Stops and Move up | 8868 | 0.684% | 9376 | 0.969% |
| 07 Save Stop | 8868 | 0.684% | 9376 | 0.969% |
| 08 Default View | 6886 | 0.531% | 7313 | 0.756% |
| 09 Preview | 0 | 0% | 0 | 0% |
| 10 Preview, orbited | 0 | 0% | 0 | 0% |
| 11 Return to Experience | 6886 | 0.531% | 7312 | 0.756% |
| 12 Return to World | 0 | 0% | 0 | 0% |

Half the states are byte-identical at both widths. The states that differ are the ones whose text contains **generated identities** — the captured View's UUID in the Presentation card and the `Stop <id>` heading — which are new on every pass, and the differing pixels sit in exactly those text runs (bounding boxes are in the JSON). The 1-px control edges in state 04 are antialiasing.

**Run-to-run control, 1440×900.** A second pass of the *same* tree (`after2-1440x900`) was compared against the first. It differs in the same six states, inside the same bounding boxes, at the same magnitude: 04 **2342** px (0.181%), 05 **6877** (0.531%), 06/07 **8983** (0.693%), 08/11 **7065** (0.545%), every other state **0**. At this width each before/after count is at or below the same-tree count for that state (2229/2342, 6709/6877, 8868/8983, 6886/7065), so no state here carries a difference that can be attributed to the extraction.

**No control pass was run at 1180×820.** The second pass was 1440×900 only, so the 1180×820 counts have no measured noise floor and are **not** claimed to sit under one. What supports them is the bounding boxes: each differing region is a card's text block — 04 `[391,515,557,542]`, 05 `[390,422,959,577]`, 06/07 `[390,441,960,579]`, 08/11 `[390,441,960,554]` — the same run of generated identity text the 1440×900 control isolates, and every state outside those runs is byte-identical at 1180×820 as well. A repeat pass at this width would make the comparison symmetric; it was not run.

Comparison records: [before vs after, 1440×900](evidence/2026-11-02-browser/compare-before-vs-after-1440x900.json) · [before vs after, 1180×820](evidence/2026-11-02-browser/compare-before-vs-after-1180x820.json) · [after vs a second after, 1440×900](evidence/2026-11-02-browser/compare-after-vs-after2-1440x900.json).

### The Experience lens crash (owner-directed fix)

**Cause.** Since R217.S22, the route's lane effect bound the zoom slot inside the World-only branch and treated only `undefined` as "no lane". Leaving World sets the binding to `null`, so the effect called `ResizeObserver.observe(null)`; the browser throws, the effect dies and the editor stops responding.

**In the browser, on unpatched `main`.** A probe pass clicked World → Experience on both trees:

| Tree | Page errors | World clicked | World dock after the click | Lens pressed |
| --- | --- | --- | --- | --- |
| `main` `668eeb66` (unpatched) | `TypeError: Failed to execute 'observe' on 'ResizeObserver': parameter 1 is not of type 'Element'.` in `$effect` in `+page.svelte` | yes | **0** (never returned) | **Experience** (stuck) |
| `668eeb66` + `bc24b72c`'s route hunk | none | yes | **1** | **World** |

Probe records: [unpatched](evidence/2026-11-02-browser/before-unpatched.json) · [with the fix](evidence/2026-11-02-browser/before-patched.json).

**The test.** `spatial-route-gesture.test.ts` › "measures the lanes without observing an unmounted slot when the lens leaves World" stubs a browser-strict `ResizeObserver` and switches World → Experience → World. On the unpatched route with only the new test applied: **1 failed, 94 passed**, failing with `TypeError: Failed to execute 'observe' on 'ResizeObserver'`. With the fix: **95 passed**. jsdom has no `ResizeObserver`, which is why no earlier route test reached the call.

**The fix** widens `zoomSlotEl` to include `null` and treats `null` and `undefined` as "no lane" in both lane effects (zoom slot and Sheet lane). Nothing else changes.

## Residuals

- **Generated identities differ between runs by construction.** Captured View and Stop ids are UUIDs, so the states that display them (04–08, 11) can never be byte-identical across two projects. The run-to-run control quantifies this and the comparison above shows it is the whole of the difference.
- **The journey does not exercise:** a save of the Presentation's label and information text (Save Presentation was not pressed), a `travel` transition (no Camera connectivity exists between two captured Views, so the gap message would appear), the Plan-reading capture refusal, entry into Preview from the Head rather than the lens, and guide-free Preview entry from the visitor list.
- **Coarse pointer, native touch, Safari and the first server-rendered paint are not measured.** These are S11's rows; this slice's tier is `affected-subsystem`.
- **The favicon 404** is pre-existing (TD-19) and is the one console error in every pass.
- **The load-dependent flake in `scene-editing-surface.test.ts`** (persistent Place planner) seen once at the pause did not recur: both the clean-worktree and the main-checkout full runs passed that file.
- **The two clean-worktree gate failures** are the linked-`node_modules` artifact described under Gates. They are not the branch's and both files pass in the main checkout; a gate run in a tree with its own `node_modules` would clear them.

## Independent review

The coordinator's review of `bc24b72c` found **no production-code defects** in the extraction or the lens fix. It raised one evidence finding, **P2**, on the pixel-control paragraph above: the run-to-run control existed only at 1440×900 while the conclusion was stated for both widths. The paragraph is corrected — the claim is scoped to the width that was measured, and 1180×820 states plainly that it has no control pass. The review separately reproduced the affected tests, the 210 architecture tests, the empty diffs of the preserved authorities and the five plan test files, and all 24 screenshot comparison counts.

That corrected revision is what the owner accepted. On 2026-11-02 the owner directed the routine close-out and merge against it; no override was invoked. The review's result stands as recorded: no production-code defects in the extraction or the lens fix, and its one evidence finding corrected above.

## Closeout and preservation

Capability outcome, routed to the [phase register](../../../../roadmap/r217-core-editor-stability/README.md#slice-register): R217.S24 ships the Experience controller — the lens's commands, reading and drafts out of the surface and behind one factory — and the R217.S22 Experience-lens crash fix. No cutover drift: no persisted format, gate or interface changed.

Anchors, computed before the close-out commit:

```text
plan        050a30d9418a9a910a320388ae2ea4d879f1b34c   last commit with the full plan body (reachable on main); the stub
                                                       at its path names this anchor
acceptance  d38fc4c3ec9b512f943024aec06f1fd8c6bf4352   the full record before this close-out; kept in full at its path
tag         closed/r217.s24 -> d38fc4c3               annotated tag, pushed after the merge; the tag target keeps both
                                                       anchors reachable (the plan anchor is an ancestor)
merge       P1 merge commit `da278f3a337746a4219b9da615db9979772325f8` (PR #256, `--merge`; parents `668eeb66`
            and `28f0e674`, the close-out commit)
```

Post-merge verification, run on `main` at `da278f3a`:

- Both anchors are ancestors of `main`: `050a30d9` (plan) and `d38fc4c3` (acceptance). `git show` of each returns its full body at its path (the plan at `050a30d9`, the record at `d38fc4c3`).
- The tag `closed/r217.s24` is annotated, peels to `d38fc4c3`, and keeps `050a30d9` reachable. It is on origin.

```text
CLOSEOUT PRESERVATION — R217.S24 (2026-11-02)
prose compacted:                 1   approved plan -> stub at its own path; acceptance record kept in full
reference promotions:            0   no reference contract changed
renderable evidence archived:    61 files (51 PNG, 10 JSON), byte-identical to the run output
evidence stubs / manifests:      1   docs/archive/roadmap/r217-core-editor-stability/r217.s24-experience-controller/evidence/CLOSED.md
transient artifacts removed:     0   the harness lives in a git-ignored scratch directory and stays there
historical anchors:              plan 050a30d9; acceptance d38fc4c3; tag closed/r217.s24 -> d38fc4c3 (annotated; pushed after the merge)
new live -> archive prose links: 6   the record's evidence, journal and comparison links (already archive paths)
manual-owed verification rows:   3   native touch, Safari and the first server-rendered paint (S11's rows)
remaining deferred items:        6   the residuals above
permanent stubs added:           1   approved plan
```
