# R217.S24 — Experience controller (closed)

**AUTHORITY: NONE.** R217.S24 is accepted at tested revision `bc24b72c` on 2026-11-02 and ships by the P1 merge of PR #256. The [acceptance record](./acceptance.md) owns the delivered behaviour, the evidence and the anchors; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       Experience commands and reading move out of ExperienceSurface.svelte into one rune module,
                experience-controller.svelte.ts, with one factory over readServices and readSnapshot: run,
                createExperience, captureAndBind, createFirstGuide, rebindToCapturedView, savePresentation,
                setDefaultView, insertStop, moveStop and saveStop; the derived current, currentGuide,
                selectedPresentation, selectedStop, travelGaps, stopUsage, guideStops, viewsOf and
                filteredPresentations; and message, busy and the drafts. The surface keeps markup, styles and the
                one Guide-column view fact, and reads the controller. The controller has no DOM access and no
                second selection or Camera state.
                Also fixes the R217.S22 Experience-lens crash (owner ruling 2026-11-01): both lane effects treat
                null and undefined as no lane, so leaving World no longer calls ResizeObserver.observe(null).
                That fix is the one intended behaviour change; nothing else visible changed.
contract        None. No persisted format, gate or F interface changed; no reference contract edited.
provenance      accepted tested revision bc24b72c (code 80c48e85, ecd23b86 and bc24b72c, from main 668eeb66);
                implementation PR #256; plan last changed at 050a30d9 (reachable on main); closeout on the same
                branch; the P1 merge is recorded in the post-merge anchor record.
evidence        One gate table at bc24b72c, from a clean worktree, in the acceptance record: check (0 errors,
                0 warnings), the four kernel checks, test:arch (23 files, 210 tests), npm test (268 files, 3501
                tests in the main checkout), test:heavy (11 files, 138 tests), build and git diff --check. Browser
                matrix: four headed-Chromium runs (before/after at 1440×900 and 1180×820), 12 states each, 0 page
                errors, with the pixel comparison and its run-to-run control. The unpatched-main probe and the
                mounted route test reproduce the lens crash; the fix passes it. The favicon 404 is TD-19.
entry points    implementation apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts
                                apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/experience/experience-controller.test.ts
                                apps/editor/tests/lib/experience/experience-controller-boundary.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
residuals       Generated View and Stop identities differ between runs, so the states that display them can
                never be byte-identical; the 1180×820 comparison has no run-to-run control of its own. The
                journey did not exercise Save Presentation's text, a travel transition, the Plan-reading capture
                refusal, Head-entered Preview or guide-free Preview. Native touch, Safari and the first
                server-rendered paint stay S11's rows. TD-19 (favicon 404). The scene-editing-surface Place
                planner load flake did not recur. The two clean-worktree suite failures were linked-node_modules
                artifacts, not the branch's.
recovery        git show 050a30d9:docs/roadmap/r217-core-editor-stability/r217.s24-experience-controller/implementation-plan.md
                · tag closed/r217.s24
```
