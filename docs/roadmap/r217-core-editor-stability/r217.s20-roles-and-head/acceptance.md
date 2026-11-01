# R217.S20 — acceptance record: Roles and Head

**Slice:** R217.S20 · **Status:** approved (plan); implemented, with implementation evidence below and no acceptance verdict · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:**
[R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

This record reports what was implemented and the evidence for it. It records no acceptance verdict:
review, acceptance and closeout are separate steps.

## Drift reconciled at cutover

Where landed PR #247 or the current reference doc disagreed with older target text, this slice follows
#247 and the reference doc. Each reconciliation is listed here.

| Where | Older text | Reconciled to | Source |
| --- | --- | --- | --- |
| [target specification, Shell, Colour](../post-s10-convergence/target-specification.md) | mat `#1D3A33` | 3D background `#152C26`; the 3D ground takes Paper's ground and grid tokens | [PLATE, Semantic colour](../../../reference/design-system/editor-shell-and-visual-system.md), as amended by PR #247 |
| same row | Index `#f6f7f5` | Index `#f5f6f4` (PLATE's pale stone working surface) | [PLATE, Semantic colour](../../../reference/design-system/editor-shell-and-visual-system.md) |
| [PLATE](../../../reference/design-system/editor-shell-and-visual-system.md), the shell diagram, the Head landmark rows and the Experience viewing paragraph | the app menu (☰) holds viewing preferences, Settings and Keys | the Index toggle and the project name's menu in the Head; viewing preferences in the Stage's ⚙; Keys reached from Find | owner decision O5 (contract edit at cutover) |
| [R217 README, Scope rulings](../README.md#scope-rulings) | shaded Plan is an app-menu viewing preference | shaded Plan is a Stage ⚙ viewing preference, with a Find entry in the Head | owner decision O5 (contract edit at cutover) |

The R217 README's "Starting evidence" table describes the audited base at `c13a949d` and is left as recorded.

## Implementation evidence

### Tested revision

- Production code: `1873ca4e` · `feat(shell): one Head row, scoped shell roles and the Stage ⚙`
- Tests: `62d1a743` · `test(shell): Find reaches the former menu, refusals are announced`
- Review fixes: `331fe8b4` (⚙ closes on an outside press and reads the shell roles), `8b856425` (route
  indentation and comment placement) and `b5f1440b` (Escape on the project menu, test).
- **Tested SHA: `b5f1440b`.** Every gate below ran against this tree. The docs commit that carries this
  record changes no production or test file. The earlier tested SHA `62d1a743` is superseded by the review fixes.
- Branch `claude/r217-s20-roles-and-head`, from `main` at `7cdc662e`. The existing S11 J12 docs commit
  `57f93780` is kept.

### Gates

| Command | Subject and files | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check over its generated tsconfig (includes `tests/`) | 2046 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0, no diagnostics |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0, no diagnostics |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0, no diagnostics |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0, no diagnostics |
| `npm run test:arch` | `apps/editor/vitest.arch.config.ts`, all arch files, including the documentation and parallel-track gates | 23 files, 194 tests pass |
| `npm test` | `apps/editor`, `vitest run`, the complete suite | 262 files, 3404 tests pass |
| `npm run test:heavy` | `apps/editor/vitest.heavy.config.ts` | 11 files, 138 tests pass |
| `npm run build` | `apps/editor` production build, adapter-vercel | exit 0 |
| `git diff --check` | whitespace over the branch | clean |

Focused iteration runs, which are feedback and not acceptance, on the same tree:
`tests/lib/authoring/head-drafting-config.test.ts` (11 tests), `head-find.test.ts` (8), `head-save.test.ts` (8),
`head-save-journey.test.ts` (5), `spatial-route-gesture.test.ts` (77), `spatial-route-resume-save.test.ts` (7),
`spatial-route-source-replacement.test.ts` (15), `stage-shell-composition.test.ts` (9) and
`tests/lib/platform/project-lifecycle-actions.test.ts` (5): 9 files, 145 tests pass.

Plan test coverage, in the four named files:

- `head-find.test.ts`: every former ☰ capability (2D appearance, Height Sheet side, Reduce motion, motion
  speed, rename, delete, source download, source replacement) and Keys reach Find with their verbs. Rename and
  delete run the Head's own project procedure, and nothing else reaches the host as them. The project menu holds
  the actions and the project id. Escape closes the project menu and returns focus to the project name.
- `head-save.test.ts`: a refused Save is announced in a polite live region and is the Save control's
  `aria-describedby`. A settled Save stays focusable (`aria-disabled`, not `disabled`) with its reason as its
  description, and a press opens that reason.
- `head-drafting-config.test.ts`: the ⚙ holds the four viewing preferences and no Grid interval, Snap-to-grid or
  automatic option. Grid and Snap stay the cluster's words. Escape closes the ⚙ and returns focus to it. A press
  outside the ⚙ and its panel closes the panel, including a press on another cluster control inside a wrapper that
  stops pointerdown, as the Stage's `.stage-actions` does. The Head holds no viewing value.
- `head-save-journey.test.ts`: unchanged, and still passing against the mounted Head.

Not run and not applicable: `npm run check:api` and `npm run test:api`. No `apps/api` file changed, so the
tier's API clause does not apply. No DB-backed test was run.

### Browser matrix

- Session: agent-browser `r217-s20-accept-*`, its own daemon, with the pre-existing `pr247-review` session left
  untouched. The app was served by a task-owned Vite dev server on `127.0.0.1:5273`, stopped at release.
- The project is a fresh `/editor` project with no Cloud service in this session.
- Fine pointer: real mouse and keyboard through agent-browser, at 1440×900, 1280×800, 1180×820 and 820×1180.
- Coarse pointer: Chromium launched by a task-owned Playwright script with touch enabled, at 820×1180 and 1180×820.
  Taps were real touch input by coordinate and the script closed its browser.

States:

- **Empty:** a fresh project. Undo, Redo, Save and Preview are unavailable.
- **Refused:** keyboard focus on Undo, which is unavailable, opens its reason disclosure. Save and Preview were
  checked the same way at 1440×900.
- **Dirty:** one accepted edit (Find → Place plinth → Place plinth). Undo is available.

Results at every fine-pointer width, empty and dirty:

- The Head is 44 px tall, and all nine visible controls sit in one row. No control lies outside the row.
- `scrollWidth` equals `clientWidth`, so there is no horizontal overflow.
- Page errors are 0 in every width's error log, and the console log has no error- or warning-level message.
- Tab order from the start is Index → project name → World → Find → Undo → Redo → Save → Preview. The inactive
  lens is one tab stop, and arrow keys move it.

Coarse results at 820×1180 and 1180×820:

- `(pointer: coarse)` matches.
- Every visible Head control is at least 44×44 CSS px. The smallest measured control is 44 px high, and Find is
  65×46.
- The Head grows to 60 px to hold those targets, and stays one row.
- A touch tap on unavailable Undo opens its reason.
- There is no overflow and no page error.

Keyboard only, verified in the browser:

- Ctrl+K focuses Find's search. Typing filters the list, and Enter runs the entry. Find closes and focus returns
  to Find.
- Keys takes focus when it opens, and Escape closes it and returns focus to the page.
- The ⚙ and the project menu were opened from the keyboard path. Escape on the ⚙ is covered by
  `head-drafting-config.test.ts`. Escape on the project menu closes it and returns focus to the project name, in the
  browser and in `head-find.test.ts`.

Re-check after the review fixes, at 1440×900 in a fresh session with 0 page errors:

- The ⚙ panel on the mat (3D) and on Paper (2D) reads the shell roles: forest with light ink on the mat, Paper with
  forest ink on Paper, and white selects on Paper. The S13 cluster buttons are unchanged.
- Clicking 2D, an outside press, closes an open ⚙. A real mouse press on the empty stage closes an open ⚙ (`true`
  before, `false` after).
- Escape on the project menu closes it and focus returns to the project name.

Screenshots, all in [evidence/2026-11-01-browser](./evidence/2026-11-01-browser/):

| Width | Empty | Refused (Undo focus) | Dirty |
| --- | --- | --- | --- |
| 1440×900 | [head-1440x900-empty.png](./evidence/2026-11-01-browser/head-1440x900-empty.png) | [head-1440x900-refused-undo.png](./evidence/2026-11-01-browser/head-1440x900-refused-undo.png) | [head-1440x900-dirty.png](./evidence/2026-11-01-browser/head-1440x900-dirty.png) |
| 1280×800 | [head-1280x800-empty.png](./evidence/2026-11-01-browser/head-1280x800-empty.png) | [head-1280x800-refused-undo.png](./evidence/2026-11-01-browser/head-1280x800-refused-undo.png) | [head-1280x800-dirty.png](./evidence/2026-11-01-browser/head-1280x800-dirty.png) |
| 1180×820 | [head-1180x820-empty.png](./evidence/2026-11-01-browser/head-1180x820-empty.png) | [head-1180x820-refused-undo.png](./evidence/2026-11-01-browser/head-1180x820-refused-undo.png) | [head-1180x820-dirty.png](./evidence/2026-11-01-browser/head-1180x820-dirty.png) |
| 820×1180 | [head-820x1180-empty.png](./evidence/2026-11-01-browser/head-820x1180-empty.png) | [head-820x1180-refused-undo.png](./evidence/2026-11-01-browser/head-820x1180-refused-undo.png) | [head-820x1180-dirty.png](./evidence/2026-11-01-browser/head-820x1180-dirty.png) |
| Coarse 820×1180 | [head-820x1180-coarse-empty.png](./evidence/2026-11-01-browser/head-820x1180-coarse-empty.png) | [head-820x1180-coarse-refused-tap.png](./evidence/2026-11-01-browser/head-820x1180-coarse-refused-tap.png) | — |
| Coarse 1180×820 | [head-1180x820-coarse-empty.png](./evidence/2026-11-01-browser/head-1180x820-coarse-empty.png) | [head-1180x820-coarse-refused-tap.png](./evidence/2026-11-01-browser/head-1180x820-coarse-refused-tap.png) | — |

Further captures at 1440×900: [keyboard Save focus](./evidence/2026-11-01-browser/head-1440x900-keyboard-save-focus.png),
[keyboard Preview focus](./evidence/2026-11-01-browser/head-1440x900-keyboard-preview-focus.png),
[keyboard Find typed](./evidence/2026-11-01-browser/head-1440x900-keyboard-find-typed.png),
[project menu](./evidence/2026-11-01-browser/head-1440x900-project-menu.png),
[⚙ viewing settings on the mat](./evidence/2026-11-01-browser/stage-viewing-settings-mat-1440x900.png),
[⚙ viewing settings on Paper](./evidence/2026-11-01-browser/stage-viewing-settings-paper-1440x900.png) and
[Keys panel](./evidence/2026-11-01-browser/stage-keys-panel-1440x900.png).

Measurements: `<width>-metrics-{empty,refused,dirty}.json` (produced by [head-metrics.js](./evidence/2026-11-01-browser/head-metrics.js)),
`<width>-errors-{empty,dirty}.json`, `<width>-refused-focus.txt` and [coarse-pointer-targets.json](./evidence/2026-11-01-browser/coarse-pointer-targets.json).

### Residuals

- **Perf browser flows are stale.** `apps/editor/perf/flows/*.spec.ts` and `apps/editor/perf/lib/flow.ts` still
  locate "Download source JSON" in the removed ☰ menu and "Open source JSON" on the Stage. Some of them also
  name stage controls that S13 already renamed or moved (Fit, Plan, the `.stage-actions` locator). They need the
  Cloud stack and are outside the declared tier. They were not run or updated here. The coordinator's review
  records this as a residual, and close-out routes it to tech-debt.
- **A server-refused Save is not browser-verified.** This session has no Cloud service. The refused-Save path is
  covered by `head-save.test.ts` on a mounted Head, through the refused status, the live announcement and the
  description. The browser refusal evidence is the Undo, Save and Preview reason disclosures.
- **Native touch and Safari remain S11's**, per the plan. The coarse pass is Chromium with touch emulation only.
- **Index and Card density roles are defined but not applied.** `--shell-index-width: 256px` and
  `--shell-card-width: 288px` live in `shell-roles.css`. S21 applies them (D06).
- **A pin hint sits over the Height Sheet** on first pin (visible in the dirty capture). That is S22's (D42), and
  this slice does not change it.
- **Find closes after a run and returns focus to Find.** This is a Head behaviour choice, accepted by the
  coordinator in the review of PR #248.
- **Coarse Head height is 60 px**, taller than the 44 px fine-pointer row, so that 44 px targets fit on one row.
- **A stale error in the development session.** An earlier hot-reload left `HEAD_PREFERENCE_ENTRIES is not
  defined` in one tab's error log. A fresh session logs no errors, and the Find list holds all 30 entries.

## Independent review

**Reviewer:** the convergence coordinator, independent of the implementer. Date: 2026-11-01.

- **First review, `dc931564`** (tree of the original `ca24a6f1`): no P1. P2-1: the ⚙ panel did not close on an outside press, unlike the Head's disclosures. P2-2: the new panel's colours were hard-coded instead of reading the shell roles. Nit: the route's inserted block was mis-indented and displaced a doc comment. Nit: no test for Escape on the project menu. Accepted: Find closes after a run.
- **Fixes:** `331fe8b4`, `8b856425` and `b5f1440b` resolve all four findings, with tests. The re-review at `b5f1440b` is clean, with nothing open, withdrawn or unadjudicated.
- **Commit messages rewritten:** the branch's commit messages were rewritten to drop agent trailers (AGENTS.md rule 12). Every tree is unchanged, and the SHAs in this record are the rewritten ones. Tested tree `239af05b` was `25a3f763` before the rewrite and is `b5f1440b` after it.
- **Verdict at `b5f1440b`:** the implementation meets plan §3 to §5 within the declared `affected-subsystem` tier, the recorded gates and browser matrix cover the plan's rows, and the drift reconciliation follows PR #247's baseline. Routine close-out may proceed.
