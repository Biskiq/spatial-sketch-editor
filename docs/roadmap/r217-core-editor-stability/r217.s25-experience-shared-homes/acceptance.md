# R217.S25 — acceptance record: Experience shared homes

**Slice:** R217.S25 · **Status:** implementation evidence recorded at tested revision `17cd8780`; the verdict and the slice status are for independent review and are not set here · **Plan:** [implementation-plan.md](./implementation-plan.md) · **Phase:** [R217](../README.md) · **Slice register:** [phase register](../README.md#slice-register) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/implementation-plan.md)

**AUTHORITY: NONE.** This record reports what was implemented, the gates run, the browser evidence, the parity journey and the drift and residuals. The [phase slice register](../README.md#slice-register) owns status, and the verdict belongs to the independent review.

## What the slice did

| Part | Where | Change |
| --- | --- | --- |
| Retired overlay | the route's `lens-surface` block, and `ExperienceSurface.svelte` | The full-surface overlay is no longer mounted, and the component is deleted |
| Index groups | [`EditorIndex.svelte`](../../../../apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte), [`experience-index-groups.ts`](../../../../apps/editor/src/lib/authoring/stage/shell/experience-index-groups.ts) | The Experience crumb with a sibling switch, the **Presentations** group (rows, filter, empty-state create) and the **Guide** group. The World locator is unchanged |
| Card | [`EditorCard.svelte`](../../../../apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte) | An optional `functions` list (an Experience subject passes none, so `•••` is not shown) and a nullable Bring into view. World subjects keep both |
| Card contributions | [`experience-card-model.ts`](../../../../apps/editor/src/lib/authoring/experience/experience-card-model.ts), [`ExperiencePresentationWriter.svelte`](../../../../apps/editor/src/lib/authoring/experience/ExperiencePresentationWriter.svelte), [`ExperienceStopWriter.svelte`](../../../../apps/editor/src/lib/authoring/experience/ExperienceStopWriter.svelte) | Identity, More facts and the writer's primary fields for a Presentation and for a Stop. Writer-edited facts are keyed by field id, so the Card never repeats them |
| Guide | [`ExperienceGuidePanel.svelte`](../../../../apps/editor/src/lib/authoring/experience/ExperienceGuidePanel.svelte) | The invoked instrument, mounted by `StageInstrumentHost` in the lower edge. Stops, order, Insert, the first Guide and Travel gaps. Closed by default |
| Lower edge | [`ExperienceDock.svelte`](../../../../apps/editor/src/lib/authoring/experience/ExperienceDock.svelte) | The Experience dock: Select, Capture and Guide, in the World dock's grammar |
| Controller host | [`ExperienceHomesHost.svelte`](../../../../apps/editor/src/lib/authoring/experience/ExperienceHomesHost.svelte), [`experience-homes.ts`](../../../../apps/editor/src/lib/authoring/experience/experience-homes.ts) | Creates the S24 controller while the lens is open and provides it, with the Guide's open state and the Card's subject, to the homes beneath the route |
| Controller | [`experience-controller.svelte.ts`](../../../../apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts) | One addition: `renamePresentation`, the Card's inline rename, which submits the same presentation-update intent as Save Presentation. Other commands, drafts and focus are unchanged |
| Route | [`+page.svelte`](../../../../apps/editor/src/routes/project/[projectId]/spatial/+page.svelte) | Wires the homes: the Index model, the Card's Experience subject (World otherwise), the lower edge and the Guide's open state. Closes the Guide on each entry to the lens |
| Head | [`EditorHead.svelte`](../../../../apps/editor/src/lib/authoring/stage/shell/EditorHead.svelte) | Unchanged. It is the only lens control and the only Preview entry |
| Contract | [the shell contract's Experience sections](../../../reference/design-system/editor-shell-and-visual-system.md#experience-expression-081) | Updated in the same PR to describe the landed homes. Place a View and Path are marked as destination tools that no Experience command implements yet |

**Unchanged:** Capture, View, first-Guide intent, travel-gap behaviour, F4 history and isolated Preview keep their commands, controller reads and tests. `commands.ts`, `focus.svelte.ts`, `travel-gap.ts`, `preview-entry.ts` and `preview-handover.ts` are not touched.

## Home map

Every control the retired surface carried, with its single new home. Nothing has two homes, and nothing has none.

| Old surface control | New home | Notes |
| --- | --- | --- |
| `Experience` heading | Head lens (World \| Experience, pressed) and the Index crumb | |
| Experience `<select>` (switch Experience) | Index crumb sibling switch | The lens has no picker. Switching is the locator's own control |
| Create Experience | Index, Presentations group (empty state) | Shown only when the source has no Experience |
| Enter Preview (header) | **Removed.** The Head's Preview is the only entry | |
| Preview from this Stop | **Removed.** The Head's Preview enters the focused Stop by the unchanged preview-entry rule | |
| "This world has no Experience yet" note | Index, Presentations group | |
| Search "Filter by label" | Index search, "Filter presentations" | Same filter in the controller |
| Presentation rows (label, Stop count, Default state) | Index, Presentations group (label, gold when focused) | Stop count and Default state move to the Card's More facts |
| Capture hint paragraph | **Removed.** The Capture key's title carries the words | |
| Presentation card (title, Views, Default, Subject, Used in) | Card: identity (title and kind), More facts | |
| Default View select | Card writer, primary field (a select when there are two or more Views, otherwise a read-only line) | |
| Label input | Card inline name (double-click, F2 or touch), committed by `renamePresentation` | |
| Information text | Card writer, primary field | |
| Save Presentation | Card writer, primary action | |
| Capture and rebind | Card More (the details section) | |
| Open Guide select | Guide panel's Guide select (shown with two or more Guides) and the Index Guide group | |
| Guides column closed note | **Removed.** The dock's Guide key shows the open state | |
| First Guide card (label, Create first Guide) | Guide panel, First Guide form | Its label is typed in the panel, which is closed by default (drift D-10) |
| Stop list and its meta | Guide panel, Stops list | |
| Move up / Move down | Guide panel, reorder controls | |
| Insert selected Presentation as a Stop | Guide panel, action | |
| Stop card heading (`Stop <id>`) | Card identity: `n. Presentation` for a placed Stop | |
| Entry View, Hold, Continue to, Transition | Card Stop writer, primary fields | "Continue to" names targets by place, not by identity |
| Travel gap alerts | Guide panel, beneath the Stops | Drift D-11 |
| Save Stop | Card Stop writer, primary action | |
| Dock Select | Experience dock, Select (armed, as before) | |
| Dock Capture | Experience dock, Capture | Drift D-1 |
| Dock Guide | Experience dock, Guide (pressed while open). The Index Guide group and the Card's Guide control also open it | |
| Feedback line | Above the Experience dock, `role="status"` | |
| `lens-surface` overlay container | **Removed** | |

## Implementation evidence

### Tested revision

- Branch `claude/r217-s25-experience-shared-homes`, based on `main` at `e9e778a0`.
- Code commits: `9f312415` (shell Index and Card primitives), `7a217f4d` (the homes' components and the controller rename), `18e0cc01` (route wiring and retirement of the surface).
- Docs commit: `17cd8780` (shell contract, drift register and two references). It is the **tested revision**: every gate below ran at `17cd8780`, whose code is `18e0cc01`.
- This record is committed after the tested revision and carries no code.
- `git diff --name-only e9e778a0 17cd8780 -- apps/api` returns no path. `check:api` and `test:api` do not apply and were not run.

### Gates

Run at `17cd8780`, in the worktree `.claude/worktrees/r217-s25`, with `node_modules` cloned from the main checkout (APFS, so the workspace links resolve to the worktree).

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check | 2075 files, 0 errors, 0 warnings (exit 0) |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | the arch lane | 23 files, 203 tests pass (exit 0). `e9e778a0` also runs 23 files and 203 tests |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 138 pass, 0 skipped (exit 0) |
| `npm run build` | `apps/editor` production build | exit 0 |
| `npm test` | `apps/editor` `vitest run`, the complete suite | 275 files, 3559 pass (exit 0). `e9e778a0` runs 271 files, 3525 pass, so the delta is 4 files and 34 tests (32 new tests and 2 rename tests) |
| `git diff --check e9e778a0..17cd8780` | whitespace | clean, no output |

Each command ran once, at the tested revision, with no retries. The `npm test` run was made with the lanes' own config and no filters.

### Plan test coverage

- **The S24 suites are unchanged.** `git diff e9e778a0 17cd8780` over `experience-authoring.test.ts` (14), `experience-controllers.test.ts` (5), `first-guide.test.ts` (12), `preview-handover.test.ts` (6) and `travel-gap.test.ts` (2) is empty, so they pass with their assertions as they were: 39 tests. `experience-controller-boundary.test.ts` (2) is also unchanged.
- **The gesture, shell-composition and Card suites are unchanged and green.** `spatial-route-gesture.test.ts` (including the S24 lens-crash test), `stage-shell-composition.test.ts`, `editor-card-facts.test.ts` and `editor-card-confirmation.test.ts` pass without edits.
- **`experience-controller.test.ts`** keeps its 14 tests. Two rename tests are added: an accepted rename submits the presentation-update intent, and a refused rename reports the refusal and leaves focus where it was. Its header comment now names the controller and not the retired surface.
- **New tests**, by the plan's three requirements:
  - *No second lens picker and no second Preview entry*: the route test counts the lens controls (two: the Head's pair, which the route test mounts as its probe) and asserts no `select` offers an Experience or Preview option. The home-map source test asserts that `Product lens` appears only in `EditorHead.svelte`, that no homes module names a Preview entry, and that the retired component and its `lens-surface` are gone.
  - *The Guide is closed by default*: the route test asserts closed on entry, opens from the dock and closes from its own control, and is closed again on re-entry. The state-shape test asserts the `let experienceGuideOpen = $state(false)` default and that each entry resets it.
  - *Index groups and Card contributions for Presentation and Stop*: the shell test mounts the Index's Experience groups, the empty-state create, the filter and the Guide toggle, and mounts the Card with no `•••` and no Bring into view for an Experience subject. The card-model test asserts the Presentation and Stop identities and facts and the writer-keyed fields. The route test creates an Experience through acceptance, captures a Presentation in 3D (its Card has the writer, Save Presentation and More, and no `•••`), creates the first Guide from its panel, and selects its Stop (the Card moves to the Stop, with the Stop writer).
  - *The Capture refusal*: the route test asserts that Capture in 2D names the 3D reading and writes no View.

| File | Tests | New or changed |
| --- | --- | --- |
| [`tests/lib/authoring/experience-shared-homes-shell.test.ts`](../../../../apps/editor/tests/lib/authoring/experience-shared-homes-shell.test.ts) | 8 | new |
| [`tests/lib/experience/experience-card-model.test.ts`](../../../../apps/editor/tests/lib/experience/experience-card-model.test.ts) | 8 | new |
| [`tests/lib/authoring/spatial-route-experience-homes.test.ts`](../../../../apps/editor/tests/lib/authoring/spatial-route-experience-homes.test.ts) | 9 | new |
| [`tests/lib/experience/experience-shared-homes.test.ts`](../../../../apps/editor/tests/lib/experience/experience-shared-homes.test.ts) | 7 | new |
| [`tests/lib/experience/experience-controller.test.ts`](../../../../apps/editor/tests/lib/experience/experience-controller.test.ts) | 16 (2 added) | changed |

No mutation proof is claimed. The new tests assert the new homes; none asserts a contract that a replacement removed, because the retired surface had no test of its own beyond the S24 suites, which are unchanged.

### Browser acceptance

**Setup.** Headed Chromium (Playwright 1.63 from the repository's `node_modules`), one browser per pass, closed in `finally`. Scratch database `biskiq_r217_s25` on the local Postgres (created for this slice, migrated with the API's own migrator, and dropped after the runs). Two API instances on the same scratch database: port 8797 for the branch (`EDITOR_ORIGIN` 5173) and 8798 for `main` (`EDITOR_ORIGIN` 5174). Two Vite dev servers: the branch at 5173 and `main` at 5174, the latter in a temporary worktree at `e9e778a0`, which was removed after the runs. Sessions came from the API's test-auth seam (`agent-user-a`), set on each browser context. Real pointer input throughout, with keyboard input only where the journey says so.

**The journey.** Each pass starts from New Project (the create baseline), installs the starter through Find (and confirms the Replace), selects the starter's room in the World locator, and then runs the parity steps: enter Experience, create the Experience, select 3D, Capture, create the first Guide, Capture twice more, Move up the last Stop, select Presentation 1 (View), open the Guide, Preview, exit Preview, return to World, Undo, read, Undo, read. Each step records the lens, the Index's Presentations and Stops, the Guide's state, the Card, the feedback line, whether Preview is up, Undo's state and horizontal overflow, and takes a screenshot.

**Matrix.** Eight passes at the plan's four widths, on both trees, 19 steps each. Every pass completed every step.

| Width | Tree | Steps | Page errors | Console errors | Dialogs | Max horizontal overflow | Index sheet closed to reach a control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | branch | 19 | 0 | 0 | 0 | 0 px | none |
| 1440×900 | main | 19 | 0 | 0 | 0 | 0 px | none |
| 1280×800 | branch | 19 | 0 | 0 | 0 | 0 px | none |
| 1280×800 | main | 19 | 0 | 0 | 0 | 0 px | none |
| 1180×820 | branch | 19 | 0 | 0 | 0 | 0 px | none |
| 1180×820 | main | 19 | 0 | 0 | 0 | 0 px | none |
| 820×1180 | branch | 19 | 0 | 0 | 0 | 0 px | 3D (once) |
| 820×1180 | main | 19 | 0 | 0 | 0 | 0 px | eight controls |

The console error filter drops the favicon 404 (TD-19), which is pre-existing and not recorded. Every journal is in the [evidence folder](./evidence/2026-11-02-browser/).

**Guide closed by default, at every width.** The branch's Guide is closed at entry (step 2) at all four widths, and the dock's Guide key reads `aria-pressed="false"`.

**Parity journey at 1440×900.** Before (`main`) and after (branch) values, in that order, from the journals. Every behavioural field agrees at every step, except the Guide's default state, which is the intended change. Three readout-only differences are noted under the table: the Card's kind word, and two Preview readouts at step 12.

| # | Step | Lens | Presentations | Stops (order) | Guide | Card title | Feedback | Preview |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | world-baseline | World / World | — / — | — / — | closed / closed | — / — | — / — | — / — |
| 1 | world-subject-selected | World / World | — / — | — / — | closed / closed | Draft Room 1 / Draft Room 1 | — / — | — / — |
| 2 | enter-experience | Experience / Experience | — / — | — / — | closed / closed | Draft Room 1 / Draft Room 1 | — / — | — / — |
| 3 | create-experience | Experience / Experience | — / — | — / — | **open / closed** | — / — | Accepted. / Accepted. | — / — |
| 4 | three-d | Experience / Experience | — / — | — / — | **open / closed** | — / — | Accepted. / Accepted. | — / — |
| 5 | create-presentation-1 | Experience / Experience | P1 / P1 | — / — | **open / closed** | Presentation 1 / Presentation 1 | Accepted. / Accepted. | — / — |
| 6 | create-first-guide | Experience / Experience | P1 / P1 | 1. P1 / 1. P1 | open / open | Presentation 1 / Presentation 1 | Accepted. / Accepted. | — / — |
| 7 | capture-2 | Experience / Experience | P1, P2 / P1, P2 | 1. P1, 2. P2 / 1. P1, 2. P2 | open / open | Presentation 2 / Presentation 2 | Accepted. / Accepted. | — / — |
| 8 | capture-3 | Experience / Experience | P1, P2, P3 / P1, P2, P3 | 1. P1, 2. P3, 3. P2 / same | open / open | Presentation 3 / Presentation 3 | Accepted. / Accepted. | — / — |
| 9 | reorder-move-up | Experience / Experience | P1, P2, P3 / same | 1. P1, 2. P2, 3. P3 / same | open / open | Presentation 3 / Presentation 3 | Accepted. / Accepted. | — / — |
| 10 | view-presentation-1 | Experience / Experience | P1, P2, P3 / same | 1. P1, 2. P2, 3. P3 / same | open / open | Presentation 1 / Presentation 1 | Accepted. / Accepted. | — / — |
| 11 | open-guide | Experience / Experience | P1, P2, P3 / same | 1. P1, 2. P2, 3. P3 / same | open / open | Presentation 1 / Presentation 1 | Accepted. / Accepted. | — / — |
| 12 | preview-enter | — / — | — / — | — / — | **closed / open** | — / — | — / Accepted. | yes / yes |
| 13 | preview-exit | Experience / Experience | P1, P2, P3 / same | 1. P1, 2. P2, 3. P3 / same | open / open | Presentation 1 / Presentation 1 | — / — | — / — |
| 14 | return-world | World / World | — / — | — / — | closed / closed | — / — | — / — | — / — |
| 15 | undo-1-world | World / World | — / — | — / — | closed / closed | — / — | — / — | — / — |
| 16 | undo-1-read | Experience / Experience | P1, P2, P3 / same | 1. P1, 2. P3, 3. P2 / same | open / open | Presentation 1 / Presentation 1 | — / — | — / — |
| 17 | undo-2-world | World / World | — / — | — / — | closed / closed | — / — | — / — | — / — |
| 18 | undo-2-read | Experience / Experience | P1, P2 / same | 1. P1, 2. P2 / same | open / open | Presentation 1 / Presentation 1 | — / — | — / — |

Readings:

- **Capture and the Stops.** Capture makes a Presentation and, with a Guide open, a Stop after the focused Stop. Both trees produce `1. P1, 2. P3, 3. P2` after the third capture, because the new Stop follows the focused one. Move up then reorders the last Stop, on both trees, and Undo returns the same orders on both trees.
- **View.** Step 10 selects Presentation 1 and reads its Views and Default View in the Card. On both trees the Card shows Presentation 1. The journey's "View" step is read as this selection; see drift D-2.
- **Undo.** The first Undo reverts the reorder and the second reverts the third capture, on both trees: three Presentations, then two, with the Stops in the same order.
- **Preview.** Both trees enter the visitor Preview from the Head and return to the same Experience state. The Guide stays open on return.
- **Two readout-only differences at step 12.** On `main` the surface is unmounted during Preview, so its Guide and feedback read as absent. On the branch the lower edge is hidden and inert but still in the DOM, so its Guide and feedback read as present. Neither is visible to the creator during Preview.
- **Lens parking.** The World room the creator selected before entering Experience is shown in the Card on both trees at step 2, and the first accepted Experience edit clears it on both trees at step 3. The round trip (step 14) shows no selection on either tree.

The comparison with every field is in [`parity-compare.json`](./evidence/2026-11-02-browser/parity-compare.json).

**Evidence.** The [evidence folder](./evidence/2026-11-02-browser/) holds the eight journals, the comparison, the harness ([`harness/journey.cjs`](./evidence/2026-11-02-browser/harness/journey.cjs), [`harness/compare.py`](./evidence/2026-11-02-browser/harness/compare.py)), every 1440×900 screenshot for both trees, and the key steps at the other widths (create, first Guide, reorder, Preview and the Undo read). Examples: [branch, reorder at 1440×900](./evidence/2026-11-02-browser/after-1440x900-09-reorder-move-up.png), [main, reorder at 1440×900](./evidence/2026-11-02-browser/before-1440x900-09-reorder-move-up.png), [branch, Preview at 1440×900](./evidence/2026-11-02-browser/after-1440x900-12-preview-enter.png), [branch, Preview at 820×1180](./evidence/2026-11-02-browser/after-820x1180-12-preview-enter.png).

**Not measured here.** Coarse pointer and native touch, Safari, and the first server-rendered paint. These are S11's rows, as the plan says. The 44 px coarse targets are styled, and the Index and dock keys carry the existing coarse-pointer rules, but no coarse-pointer pass was run.

### Drift reconciled at cutover

Each item below is a place where the delivered behaviour or wording differs from the plan or the contract as written. None changes a command, a persisted format, a gate, a snap or Camera behaviour.

| ID | Spec says | Delivered | Why |
| --- | --- | --- | --- |
| D-1 | Capture and View "through `StageInstrumentHost`" | Capture is a key on the Experience dock row, in the lower column. `StageInstrumentHost` hosts the Guide instrument | The host is a titled instrument panel (a heading, a target, an info control and a close control). The dock is a row of keys, as in the World dock |
| D-2 | "View" is a lower-edge command and a parity step | No look-through or Place-a-View command exists in the editor, and none was added. The step selects Presentation 1 and reads its Views and Default View in the Card | The plan names no capability for "View". Adding one would be a new Experience capability, which the plan excludes. **Owner to confirm this reading** |
| D-3 | The dock carries Place a View and Path | Not built. The contract now marks both as destination tools | No Experience command implements them, and the plan excludes new capability |
| D-4 | The Experience switch is a picker in the lens | The switch is the Index crumb's sibling list | The plan asks for one lens control, in the Head. The locator is the Index's job |
| D-5 | Preview from this Stop | Removed. The Head's Preview enters the focused Stop by the unchanged preview-entry rule | The plan asks for one Preview entry, in the Head |
| D-6 | Create Experience in the lens header | In the Index's Presentations group, when the source has no Experience | The Index is the locator, and the empty state is where creation is offered |
| D-7 | Label is a field | Label is the Card's inline name, committed through `renamePresentation`, which submits the same intent as Save Presentation | The Card is the one writer for a selected subject's name |
| D-8 | Surface copy (the Capture hint, the closed-Guide note) | Removed. The Capture key's title reads "Capture: what you see becomes a View" | One home for the words, and no second explanation |
| D-9 | Raw identities shown (Used in, Subject, Default, the Stop heading and Continue-to targets) | Counts, the subject's domain and kind, "Default View" states, and "Stop n: Presentation" labels | Canonical identity is not shown in the Experience Card; the World Card's Technical details has no Experience counterpart yet |
| D-10 | The first Guide's label is typed in the Guide | It is typed in the Guide panel, which is closed by default. Capture without that label creates a Guide-free Presentation | The first-Guide intent is unchanged. Its visibility follows the closed-by-default rule |
| D-11 | Travel gaps beside the Transition | Reported in the Guide panel, beneath the Stops (`role="alert"`) | Travel gaps describe the Guide's order, and the panel is where order is composed |
| D-12 | The subject's `•••` and Erase | Experience subjects show no `•••`, because no function or erase exists for Presentations or Stops | The S24 controller has no delete command, and the plan excludes new capability |
| D-13 | Index rows carry Stop count and Default state | Moved to the Card's More facts | The Index row is one compact line with a label, as the locator grammar asks |

### Residuals

- **R-1. Owner visual review.** The Guide panel's size and density are proposed: the `StageInstrumentHost` default (480 px wide, at most 24 rem tall), with Stop rows that show the place, the entry View, the hold, the continuation and the transition, and the reorder controls. The plan leaves these to the owner's visual acceptance.
- **R-2. "View" reading (D-2).** The journey's "View" step is the read in D-2. Owner confirmation is needed, because a Look-through or Place-a-View capability would be new Experience work.
- **R-3. 820×1180 sheet coverage.** An open Index sheet covers the Stage's 2D/3D cluster at this width. That is the S23 layout, and it applies on both trees. The journey closes the sheet to reach the control, once on the branch and eight times on `main`. Not changed by this slice.
- **R-4. World Card in the Experience lens.** A World subject selected before entering Experience stays in the Card until the first accepted Experience edit clears it. This is continuity and is the same on both trees.
- **R-5. Experience authoring Find entry.** Opening the Experience task from Find still shows the adapter's one-line summary. It is unchanged.
- **R-6. Preview readouts (step 12).** The journey's Guide and feedback readouts differ during Preview because `main` unmounts its surface and the branch hides its lower edge. The creator sees neither during Preview.
- **R-7. Coarse pointer, touch, Safari (S11's rows).** Not measured here. See the browser section.
- **R-8. Select key.** It stays decorative, as on `main`. No shortcut behaviour was added.
- **R-9. Local database.** The browser passes used a scratch database on the local Postgres, not the Compose stack. The database was dropped after the runs.
- **R-10. Console favicon 404 (TD-19).** Pre-existing. Filtered from the console records, and the journals show no other console error.

## Independent review

Not performed here. This record is the implementer's evidence. The independent review, and the owner's visual acceptance of the Guide panel and the Card (R-1), come next.

## Closeout and preservation

Not applicable until review and close-out. The slice register is not edited in this PR.
