# R217.S21 — acceptance record: Index and Card

**Slice:** R217.S21 · **Status:** accepted 2026-11-01 at tested revision `edfab667` (clean independent review; routine close-out) · **Plan:** [implementation-plan.md](./implementation-plan.md) (closed to a stub; owns the criteria in its recovery line) · **Phase:** [R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

**AUTHORITY: NONE.** This record reports what was implemented, the gates run on the tested revision, the browser matrix, the independent review and the acceptance. The [phase slice register](../README.md#slice-register) owns status. The verdict is in [Acceptance](#acceptance), and the closeout anchors and preservation report are in [Closeout and preservation](#closeout-and-preservation).

## Drift reconciled at cutover

Where landed PR #247 or S20 disagreed with older text, the landed baseline stands. The reconciliations below are the stale sentences this slice corrected, each in its own file. Items 1 and 2 are the two stale statements the owner named.

| Where | Older text | Reconciled to | Source |
| --- | --- | --- | --- |
| [R217 README, Post-S19 corrections](../README.md) | "implemented on PR #247, pending owner review" | "merged on PR #247 after the owner's manual review, 2026-11-01"; the report keeps its residual routing | owner review and merge of PR #247 on 2026-11-01 |
| [T1 baton, CARRY](../../../operations/t1-spatial-world/current.md) | corrections "await the owner's manual review" | merged after the owner's manual review on 2026-11-01; the report still owns corners under 45°, the arched free-end Opening, the mat offset, ground shadows and light add/remove | owner review and merge of PR #247 on 2026-11-01 |
| [implementation plan, §3 Card types](./implementation-plan.md) | `StageCardFact` and `StageCardAction` are the only type additions | the writer contribution `StageInstrumentContent` also gains optional `fieldIds`, the fields it edits; without it the Card cannot drop a fact a writer shows | implementation `8902a6ca`; the plan named the fact and action types only |
| [implementation plan, §3 Card rendering](./implementation-plan.md) | drops a fact whose `fieldId` has a writer | also drops a fact whose `fieldId` the header carries (`name`, `kind`); a `secondary` action sits in More | implementation `3292d8fb`; target specification, Card identity |
| [implementation plan, §3 Layout facts](./implementation-plan.md) | `layout.adapter.ts` `cardFacts` sets `fieldId` and `Stream`, `Eligible`, `Revealed` and `Domain` leave | `fieldId` is set in `layoutFacts` (`layout/precision.ts`); the route composes `Stream`, `Eligible`, `Revealed` and `Domain`, which now sit under Technical details | implementation `8902a6ca`, `3292d8fb`; the facts were composed in the route, not the adapter |
| [implementation plan, §3 Context chip](./implementation-plan.md) | "Fed by real canonical location" | a Layout-located selection shows its floor's authored name; a Scene reference is `project-root` and names no location, so no chip | implementation `3292d8fb`; `semantic-selection.ts` location model |
| [target specification, Index and Card, Card facts](../post-s10-convergence/target-specification.md#index-and-card) | "`Stream`, `Eligible`, `Revealed` and `Domain` leave the ordinary Card" | the same, and they sit under Technical details; a fact whose field the header (name, kind) or a writer carries is not repeated | implementation `3292d8fb`; drift D09 and D10 |
| [target specification, Index and Card, Card actions](../post-s10-convergence/target-specification.md#index-and-card) | "Only `destructive: true` gets destructive styling" | the same, and a `secondary` action moves into the Card's More disclosure, with Focus and Open task | implementation `3292d8fb`; drift D10 |

The R217 README's "Starting evidence" table and the S20 record are left as recorded.

## Review of PR #250 at 424b78e2

The coordinator's review found one P1 and one P2, both fixed on this branch and re-gated at `edfab667`.

- **P1, coarse targets.** The explicit coarse rules are in `EditorCard.svelte` (icon and action buttons, the rename field, summaries) and `EditorIndex.svelte` (each row, its Actions toggle, the disclosed operations, the search field). Each sets 44 px under `pointer: coarse` and keeps the 32 px fine density. The measured state is in the coarse-pointer pass: before and after both 0 below 44 × 44 across 266 controls, because the host rule already applied the floor on this branch.
- **P2, a lost fact.** The object and form writers edit X and Z only, but the Position fact was dropped whenever a writer covered its field, so Y was stated nowhere. The Scene card now shows `Position (X · Z)`, keyed to the writer's `position` field, and `Elevation` as a read-only row with no field id, so the Y is stated once.

The coordinator's review accepted the judgment calls under "Decisions taken inside the plan", and those stand as cutover reconciliation.

## Implementation evidence

### Tested revision

- Branch `claude/r217-s21-index-and-card`, from `main` at `c577904c` (R217.S20 merged).
- Production and test commits, in order: `8902a6ca` (card contract types and adapter tagging), `3292d8fb` (Index labels, Card identity and the chip), `a92050a2` (tests), `43579f1c` (select and frame distinct on the route), then the review fixes `28538e19` (the Y of a writer-edited object stays stated, as a read-only Elevation fact) and `edfab667` (explicit 44 px coarse-pointer targets for Card and Index controls).
- **Tested SHA: `edfab667`.** Every gate below ran against that tree, after the review fixes. The docs commits that carry this record and its evidence change no production or test file.
- `apps/api` is untouched (`git diff --name-only c577904c HEAD` names no `apps/api` path). `npm run check:api` and `npm run test:api` therefore do not apply to this diff, and were not run.

### Gates

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check, generated tsconfig (includes `tests/`) | 2050 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | `vitest.arch.config.ts`, the whole arch lane, including the documentation and parallel-track gates | 23 files, 194 tests pass |
| `npm test` | `apps/editor` `vitest run`, the complete suite | 265 files, 3440 tests pass |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 138 tests pass |
| `npm run build` | `apps/editor` production build, adapter-vercel | exit 0 |
| `git diff --check c577904c edfab667` | whitespace over the branch | clean, no output |

Against S20's recorded baseline (262 files, 3404 tests), S21 adds three suites and 36 tests. Focused iteration runs were used during the work and are not acceptance. The authoring subtree (77 files, 1011 tests) passed before the final route test was added; the complete suite above covers the tested tree.

### Plan test coverage

- `tests/lib/authoring/stage-index-labels.test.ts` (new): authored names, blank names, long names kept whole, generated `Kind n` by sorted identity, no renumbering when a subject is named, repeated names disambiguated, kind words, membership words.
- `tests/lib/authoring/editor-card-facts.test.ts` (new): each fact once (header-carried, writer-carried, read-only kept), diagnostics under Technical details, only `destructive: true` styled destructive, Duplicate in More and not destructive, a non-destructive action runs on one press and a destructive one on its second, a generated name never prefills or reaches the rename writer, empty rename refused, long names whole in the title.
- `tests/lib/authoring/scene-object-card.test.ts`: the object writer's declared mark facts are `position`, `yaw`, `scale`.
- `tests/lib/authoring/layout-card-fields-lifetime.test.ts`: the Layout writer edits every field but the name, and the Card's only fact row for a Wall is Role.
- `tests/lib/authoring/scene-editing-surface.test.ts`: on a real host, Duplicate is `secondary` and not destructive, and the object writer declares its fields.
- `tests/lib/authoring/spatial-route-gesture.test.ts`, the S21 block (7 tests): the unnamed Wall row is labelled `Wall n` with the identity in its accessible name; the Card title matches the row; a Wall states Height and Thickness once; Delete is the only destructive action; the row's Actions disclosure is closed by default; the chip shows the floor; Select leaves the Camera and the row's Bring into view moves it.
- `tests/lib/authoring/editor-card-confirmation.test.ts`: unchanged, passing against the Card with groups.
- Review fixes: `scene-editing-surface.test.ts` (real host) asserts `Position (X · Z)` carries the writer's `position` field and `Elevation` is a read-only row; `editor-card-facts.test.ts` keeps a writer-edited subject's elevation on screen; `stage-shell-coarse-targets.test.ts` (new) pins the coarse-pointer rules for the Card and the Index in the component source, with the fine density unchanged.

### Browser matrix

- Session: agent-browser `r217-s21-accept-d5f97e222c86`, owned by this task and closed at release (`No active sessions` after close). The app was served by a task-owned Vite dev server on `127.0.0.1:5273`, stopped at release. A session that wedged mid-matrix was closed and the matrix re-run in a fresh session; the wedge is recorded under Residuals.
- Scene built through the UI in one project: the enclosed-room starter; Wall 1 renamed to a long name; Walls 2 and 3 both renamed `Party wall` (repeated); a Door on Wall 1 by the Ink Opening reading; a Sphere primitive; a native form (`Shape`). Unnamed walls, the room and the Door show generated labels where they have no authored name.
- Fine pointer, real mouse and keyboard, at 1440×900, 1280×800, 1180×820 and 820×1180. Below 1280 px the Index starts closed and the Card starts collapsed (existing arbitration); the matrix opened both before each state.

| State | 1440×900 | 1280×800 | 1180×820 | 820×1180 |
| --- | --- | --- | --- | --- |
| Wall, long and repeated names | [wall-long-repeated-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/wall-long-repeated-1440x900.png) | [wall-long-repeated-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/wall-long-repeated-1280x800.png) | [wall-long-repeated-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/wall-long-repeated-1180x820.png) | [wall-long-repeated-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/wall-long-repeated-820x1180.png) |
| Opening (Door) | [opening-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/opening-1440x900.png) | [opening-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/opening-1280x800.png) | [opening-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/opening-1180x820.png) | [opening-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/opening-820x1180.png) |
| Object (Sphere) | [object-sphere-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/object-sphere-1440x900.png) | [object-sphere-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/object-sphere-1280x800.png) | [object-sphere-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/object-sphere-1180x820.png) | [object-sphere-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/object-sphere-820x1180.png) |
| Native form (Shape) | [native-form-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/native-form-1440x900.png) | [native-form-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/native-form-1280x800.png) | [native-form-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/native-form-1180x820.png) | [native-form-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/native-form-820x1180.png) |
| Keyboard: a row's Actions disclosure open, from the keyboard | [index-actions-keyboard-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/index-actions-keyboard-1440x900.png) | [index-actions-keyboard-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/index-actions-keyboard-1280x800.png) | [index-actions-keyboard-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/index-actions-keyboard-1180x820.png) | [index-actions-keyboard-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/index-actions-keyboard-820x1180.png) |
| Head chip with the Index away | [head-chip-index-away-1440x900.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/head-chip-index-away-1440x900.png) | [head-chip-index-away-1280x800.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/head-chip-index-away-1280x800.png) | [head-chip-index-away-1180x820.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/head-chip-index-away-1180x820.png) | [head-chip-index-away-820x1180.png](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/head-chip-index-away-820x1180.png) |

Results, at every width and state:

- No horizontal overflow: `scrollWidth` equals `clientWidth` in every capture (`*-metrics.json`).
- Console and page errors: 0. `console-<width>.txt` and `page-errors-<width>.txt` are empty for each width, and the probe was checked to report a marker error when one is emitted.
- Card width 288 px and Index width 256 px at every width in which both are open.
- Select and frame stay distinct: the mounted-route test asserts that a row select leaves the Camera pose and the row's Bring into view moves it. The matrix did not measure the Camera.
- Keyboard, checked by Tab in the browser: a Wall row, its Actions toggle, then `Open location` and `Bring into view` once the disclosure is open, then the next row. In the Card: Rename, Collapse and close. The Card's writer fields, Delete, Bring into view and More were not walked by Tab in the browser.

Measurements and error logs: `<state>-<width>-metrics.json`, `console-<width>.txt`, `page-errors-<width>.txt`, and the probe [matrix-metrics.js](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/matrix-metrics.js).

### Coarse-pointer pass (review P1)

- Method: Chromium through Playwright with `hasTouch` and `isMobile` emulation, which makes `(pointer: coarse)` match in every capture. The scene was built at 1440×900 with real taps and pointer presses, then the viewport was set to 820×1180 and 1180×820. Each width measured the Wall, the Opening (Door), the object (Sphere) and the native form, with the Index open, the Cards expanded, the Wall's row Actions disclosed and the Wall's More disclosed.
- Scope: every visible Card and Index control in each capture, skipping only controls inside a closed disclosure. The Card's writer fields, rename field, buttons and summaries are included, as are each Index row, its Actions toggle, the disclosed operations and the search field.
- Result, after the fixes (`edfab667`): **266 visible controls, 0 below 44 × 44 CSS px** (minimum 44 × 44). No horizontal overflow. `(pointer: coarse)` matched in every capture.
- Before the explicit rules (`424b78e2`): also 266 controls and 0 below 44 × 44. The branch's existing host rule (`.editor-host :global(button|summary|select|input)` under `pointer: coarse`) already sets the floor, so the regression described in the review did not reproduce on this branch. The explicit component rules now keep the Card and the Index at 44 px on their own, and the fine-pointer density stays 32 px.
- Evidence, in the [2026-11-01 browser folder](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/): [coarse-pointer-targets.json](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/coarse-pointer-targets.json) (after), [coarse-pointer-targets-before-fix.json](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/coarse-pointer-targets-before-fix.json) (before), the eight PNGs of each (`coarse-final-<state>-<width>.png` and `coarse-before-fix-<state>-<width>.png`), and the probe [coarse-pass.cjs](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/coarse-pass.cjs).
- Screenshots after the fixes: [wall 820×1180](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/coarse-final-wall-820x1180.png), [opening 820×1180](../../../archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/2026-11-01-browser/coarse-final-opening-820x1180.png), and the 1180×820 captures alongside them.

### Decisions taken inside the plan

These are judgments the plan left open. None needed an owner ruling, and each is recorded here so review can overturn it.

- Diagnostics (`Stream`, `Eligible`, `Revealed`, `Domain`) went under Technical details rather than being deleted.
- The header carries the name and the kind word, so the `Kind` and `Name` fact rows drop. The eyebrow shows the kind word and the status (the Plan membership for Layout, `Scene` for Scene).
- Focus and Open task moved into More beside the secondary actions. Bring into view stays in the row.
- A Scene subject shows no context chip, because its reference names no location.
- A Scene object's plan position is split (review P2): `Position (X · Z)` carries the writer's `position` field, so the writer shows it once, and `Elevation` is a read-only row with no field id, because no writer edits Y. The Y is stated, and only once.

### Residuals

- **Constrained-width Index.** At 820×1180 and 1180×820 the Index is a sheet over the Stage with its scrim, which dims the Card beneath it. That is S23's sheet behaviour and was not changed; the sheet's width now reads `--shell-index-width`.
- **Destructive and refusal colours.** No shell role names destructive or refusal, so Delete, the error text and the destructive border keep their pre-existing values (`#8f3a22`, `#d8b7ab`, `#a33b24`). Whether to add roles is an owner decision.
- **PLATE advanced fields.** The reference doc says advanced fields such as Wall thickness sit under More. Thickness is an inline writer field, as shipped by S05 and S15. It was not moved here; it is an owner decision.
- **Head Find and task host.** The Head's Find still shows Scene subjects by `name · kind · id`, and the task host's target label still uses the raw identity. Both are outside the Index and Card scope and remain for a later slice.
- **Wedged browser session.** During the first matrix attempt the page stopped answering `eval` after a width change, and the session was closed. A fresh session ran the whole matrix to completion without a hang. No page error was logged, so the cause is not identified.
- **Coarse pointer.** Run in Chromium with touch emulation (see the coarse-pointer pass). Native touch and Safari remain S11's.
- **GPU warnings.** The coarse pass logged four Chromium `GL Driver Message … ReadPixels` warnings and no page errors. They come from the WebGL driver, not the app.
- **Perf browser flows** remain stale (TD-16), unchanged by this slice.
- **Server-refused Save** is not browser-verified, as in S20.

## Independent review

**Reviewer:** the convergence coordinator, independent of the implementer. Date: 2026-11-01.

- **First review, `424b78e2`:** one P1 and one P2.
  - P1: the Card and Index controls dropped to 32 px with no coarse-pointer rule of their own. The implementer measured that the host's existing coarse rule already held them at 44 px, so the regression did not reproduce. The explicit rules still remove that dependency.
  - P2: the object and form writers declared `position` while writing only X and Z, so the Card lost the subject's Y.
- **Accepted judgment calls:**
  - Stream, Eligible, Revealed and Domain move under Technical details.
  - The writer's optional `fieldIds`.
  - Name and kind are carried by the header.
  - Duplicate, Focus and Open task sit in More.
  - No context chip for a Scene selection; a Layout selection shows its floor's authored name.
  - The plan and specification clarifications stand as cutover reconciliation.
- **Fixes:** `28538e19` adds `Position (X · Z)` and a read-only `Elevation`, each stated once, with tests. `edfab667` adds explicit 44 px coarse rules. Coarse pass: 266 controls, 0 below 44 × 44. The re-review at `edfab667` is clean, with nothing open, withdrawn or unadjudicated.
- **Verdict at `edfab667`:** the slice meets plan §3 to §5 within the declared `affected-subsystem` tier. Generated `Kind n` labels never reach source, because rename reads the writer's authored value. The drift reconciliation follows PR #247's baseline. Routine close-out may proceed.
- **Noted for later slices:** at 1440 × 900 the Card overlaps the Height Sheet (S22, D42). The Card's Delete keeps its pre-existing destructive colour, and S23 owns the ink palette.

## Acceptance

Accepted on 2026-11-01 at tested revision `edfab667`. The owner directed that each slice go through routine
close-out after the coordinator's independent review, and this close-out is that direction. It is not an
owner override, and nothing was waived.

- **Review:** the independent review verdict covers `edfab667` and is clean, with no open, withdrawn or
  unadjudicated finding. The first review's P1 and P2 are fixed by `28538e19` and `edfab667`, with tests, and
  re-reviewed.
- **Criteria:** the reviewer's verdict records plan §3 to §5 as met within the declared `affected-subsystem`
  tier. The gates and the browser matrix cover the plan's test cases and browser rows, except one: the keyboard
  Tab path of the Card's writer fields, Delete, Bring into view and More was not walked in the browser (see
  Browser matrix). That path is carried below as a manual-owed row, distinct from the automated evidence.
- **Prerequisites:** the plan's dependency R217.S20 is shipped in the register.
- **Capability outcomes:** none. The register's Effects column for R217.S21 is `—`.
- **Gates:** no product gate was re-run at close-out. The recorded numbers above are reused. The documentation
  gate `tests/docs` ran after the link repairs.

## Closeout and preservation

Anchors, computed before the compaction commit:

```text
plan        370c99d9f1dc4a5baf92aae6b18b0e06e1026ce1   last commit with the full plan body (a branch commit,
                                                       reachable on main through the P1 merge); the stub at
                                                       its path names this anchor
acceptance  928aa5f89a2470b80092052abf9fa6e3e848b894   the full record before this close-out; kept in full at its path
tag         closed/r217.s21 -> 928aa5f8               created and pushed after the merge; the tag target keeps
                                                       both anchors reachable
merge       P1 merge of PR #250 with `--merge`; the merge-commit SHA and the post-merge verification are recorded
            by the post-merge anchors follow-up
```

```text
CLOSEOUT PRESERVATION — R217.S21 (2026-11-01)
prose compacted:                 1   approved plan -> stub at its own path; acceptance record kept in full
reference promotions:            0   the Index and Card contract already reads in PLATE (Card identity, facts and
                                     More); the target specification was reconciled at cutover
renderable evidence archived:    76 files / 6.9 MB (40 PNG, 26 JSON, 8 text, 1 script, 1 probe), moved byte-identical
evidence stubs / manifests:      1   docs/archive/roadmap/r217-core-editor-stability/r217.s21-index-and-card/evidence/CLOSED.md
transient artifacts removed:     0
historical anchors:              plan 370c99d9; acceptance 928aa5f8; tag closed/r217.s21 -> 928aa5f8 (annotated; pushed to origin)
new live -> archive prose links: 0
manual-owed verification rows:   3   native touch and Safari, owed by S11 (J9 and the Safari cells); the keyboard Tab
                                     path of the Card's writer fields, Delete, Bring into view and More, not walked
remaining deferred items:        10  the nine Residuals and the later-slice note on the Height Sheet overlap
permanent stubs added:           1   approved plan
```
