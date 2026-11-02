# R217.S23 — acceptance record: Ink palette and constrained widths

**Slice:** R217.S23 · **Status:** accepted 2026-11-01 at tested revision `a7598a55` (clean independent review; routine close-out under the owner's direction; no override) · **Plan:** [implementation-plan.md](./implementation-plan.md) (closed to a stub; owns the criteria in its recovery line) · **Phase:** [R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

**AUTHORITY: NONE.** This record reports what was implemented, the gates run, the browser evidence, the contrast measured, the drift reconciled and the residuals. The [phase slice register](../README.md#slice-register) owns status, and the verdict belongs to the independent review.

## Drift reconciled at cutover

Where the older text disagreed with the landed baseline (PR #247, S17A, S20–S22), the landed baseline stands.

| Where | Older text | Reconciled to | Source |
| --- | --- | --- | --- |
| [shell and visual-system reference](../../../reference/design-system/editor-shell-and-visual-system.md), Ink bullet | "palette options Sketch · Line · Box · Round" | the Wall reading (Line or Box) and the Opening reading, in one compact row above the dock | [target specification, Ink palette](../post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive); D14; O10 |
| Same reference, Ink bullet and Pen table row | Shape as one more reading on the chip; "a temporary Shape intent toggle in the Ink palette" | Shape is placed from Objects and is not an Ink reading; no Shape intent toggle exists in Ink | O10 (S17A) |
| Same reference, "Dock and palette" table row | "Select · Ink · Slice · Eraser · Brush · Measure, then Library" | "Select · Ink · Measure · Eraser, then Objects", the landed dock | S10 and S17A dock |
| Plan §4 test list | `shape-reading-adapter.test.ts` | renamed by S17A (commit `44bc0c5e`) to `shape-form-marks.test.ts`; the Ink-side Shape exclusion is now pinned by a new case in `objects-panel-guard.test.ts` | S17A |

The reference edits are wording reconciliations. They amend no contract, and the plan's "Contracts this slice updates at cutover: None" stands.

## Review fixes (first review, at `9809dad6`)

- **P1, the palette overlapped the Height Sheet.** Fixed in `1fb0d6bc`: the lower column insets by the measured Sheet lane on the Sheet's own side plus 1.5 rem, the gap the zoom cluster and the Card keep. The palette and its upward disclosures wrap inside that width. Composition test added (`stage-shell-composition.test.ts`, lane contract).
- **P2-1, the instrument facts were hover-only.** Fixed in `a7598a55`: the facts are the instrument's accessible description (`aria-describedby` on the section and the info control), and a focusable info control (`aria-expanded`, `aria-controls`) reveals them as a visible list. The header comment is corrected. New suite `stage-instrument-host.test.ts` (3 tests); the coarse target covers the info control.
- **P2-2, the Box flake.** Reproduces on `main` (`23d6d9ae`) with the same harness and the same six configurations. Recorded as pre-existing, numbers below; not fixed on this branch.
- **Nit, the 404.** Identified: `GET /favicon.ico` on the editor origin, pre-existing. Not this slice's; not fixed.

## Implementation evidence

### Tested revision

- Tested revision: **`a7598a55`** (branch `claude/r217-s23-ink-palette-and-constrained-widths`, base `23d6d9ae` on `main`).
- Code commits: `5bfd1d3b` the instrument row; `0ffa14d6` the Ink key row with upward disclosures; `5f0d7131` the constrained Index scrim and the session start; `48ba5da7` the S23 tests; `7c3bf0ee` the reference wording (the first tested code revision); `1fb0d6bc` the lane fix; `a7598a55` the facts fix.
- The browser matrix below ran from `a7598a55`. The record is committed after it.
- No `apps/api` path changed (`git diff --name-only 23d6d9ae..HEAD`), so `check:api` and `test:api` do not apply and were not run.

### Gates

Run on `a7598a55` in a clean, detached worktree of that commit (no uncommitted changes; `node_modules` linked so that the workspace packages resolve inside the worktree). One run, one tree. Every command exited 0.

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check, generated tsconfig (includes `tests/`) | 2051 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | the whole arch lane, including the documentation and parallel-track gates | 23 files, 210 tests pass |
| `npm test` | `apps/editor` `vitest run`, the complete suite | 266 files, 3484 tests pass |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 138 tests pass |
| `npm run build` | `apps/editor` production build, adapter-vercel | exit 0 |
| `git diff --check 23d6d9ae..a7598a55` | whitespace | clean, no output |

The package checks (`camera-core`, `layout-core`, `geometry-core`, `project-model`) ran in the same run and exited 0; no `packages/` file changed after the first gate run. The `check` count is the clean tree's: the main checkout counts one more file, a git-ignored generated `$types.d.ts` for a removed route left in its `.svelte-kit`. The clean tree does not have it. The `npm test` and `test:arch` counts agree in both trees.

Superseded, not repeated (the `7c3bf0ee` gate run, before the review fixes): 2051 files; `npm test` 265 files, 3479 tests; `test:arch` 23 files, 208 tests.

Against S22's recorded baseline (265 files and 3460 tests in the complete suite; 200 arch tests), S23 adds 24 tests to the complete suite and 10 to the arch lane. Its files: one new test file (`stage-instrument-host.test.ts`, 3 tests) since the first review.

The record of `test:arch` above was taken before this record was written. `test:arch` is re-run after it, and that result is in the closing note.

### Plan test coverage

- [`stage-shell-composition.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-composition.test.ts), S23 block (+10, 25 in file; the first review added the lane contract and the facts contract): one dock-material row with no caption; no retired literal colour in the palette, Opening, Objects or host; the constrained Index ends above the lower column and the viewport-sized shadow is gone; z-order (scrim 5, lower column 6, zoom 7, Card 12, Index 20); the scrim is rendered only for an open constrained Index, as a pointer-only close target; the Index starts collapsed below 1280 px as session state; every Ink, Opening and Objects hook sits inside the row or its upward disclosure; a contrast floor computed from the shell-role tokens (10 pairs).
- [`spatial-route-gesture.test.ts`](../../../../apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts), S23 block (+8, 94 in file, mounted route): every Wall key and the typed X/Z path are in the row, with X/Z drawn only once its disclosure opens; a typed path drives Finish, Backtrack and Cancel through the controller; a typed chain finishes as one history step; Box with Cancel as its only command, and back to Line; one disclosure at a time, closed by a reading change; an invalid Wall option refused in words and a valid one accepted; the Opening measures behind their disclosure, placed through the same controller; the Index closed below 1280 px, opened as a sheet, and closed by the scrim with the selection kept.
- [`stage-instrument-host.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-instrument-host.test.ts) (new, 3 tests, mounted): the facts are the instrument's description, not a hover title; the info control reveals them as a list and reports `aria-expanded`; an instrument without facts draws no info control and Close still closes.
- [`stage-shell-coarse-targets.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-coarse-targets.test.ts) (+2, 4 in file): the instrument info and close controls reach 44 × 44 CSS px under a coarse pointer; every Ink key, typed field and submit does too, and the hidden radio is excluded.
- [`objects-panel-guard.test.ts`](../../../../apps/editor/tests/lib/authoring/objects-panel-guard.test.ts) (+1, 4 in file): the Ink palette offers no Shape, Round or Sketch (O10).
- [`layout-drawing-adapter.test.ts`](../../../../apps/editor/tests/lib/authoring/layout-drawing-adapter.test.ts): not modified; its 21 tests pass. The Ink adapter contract is unchanged.
- Fit: the Opening and Scene instruments and the Objects panel (full and compact) fit the container in the browser, measured in the JSON records below. A jsdom suite cannot measure layout, so the structural facts (the host body scrolls, its maximum height, the flex-wrap rows) are pinned by source contract only.

Mutation proof (the tests README's replacement-claim rule) was not run for this slice. The contracts are composition and presentation facts, not a replacement of a prior test.

### Browser acceptance

Real pointer and keyboard input in **headed Chromium** (Playwright 1.63, `headless: false`). The app ran from this checkout (Vite on `127.0.0.1:5173`) against a scratch API on `localhost:8790` and a scratch database `biskiq_r217_s23` on the local Compose Postgres. The database was created for this slice, migrated, and dropped at the end; the API and Vite were released from their PID files. Sessions were signed in through the API test-auth seam, one browser per pass, closed in `finally`.

Each fine pass drew in an empty workspace: a Wall Line (two taps and a Finish), a Box (two corners), and an Opening placed by offset on the Line's Wall. It then walked the Index as a sheet, the dock behind it, the scrim, the Objects panel (full and compact), the Ink controls and (fine) a keyboard pass. Room passes measured the enclosed-room starter with the palette open and folded.

**Matrix at `a7598a55`: 16 runs.** Right-side Height Sheet (the default): 1440×900, 1280×800, 1180×820 and 820×1180 fine; 1180×820 and 820×1180 coarse; four starter-room passes. Left-side Height Sheet (set through the Stage's ⚙ panel): the same six fine and coarse configurations. Every run: **0 page errors, 0 failed steps, 0 horizontal overflow.** The browser logs one console error per run: the `favicon.ico` 404 (see the nit below). Files are named `<state>-<width>x<height>-<mode>[-sheet-left].png`; one JSON per run; `summary.json` is the per-run analysis.

**Overlap, with Opening options open.** The Opening options disclosure is the state the first review found overlapping the Sheet. The clearance is the horizontal gap from the instrument's nearest edge to the Sheet's lane (12 px is the 0.75 rem gap). **No palette, instrument or lower-column box overlaps the Sheet in any state of any run, on either side.**

| Run (Sheet side) | Sheet box | Instrument box | Clearance (px) |
| --- | --- | --- | --- |
| 1440×900 fine, right | 1289.6, 357, 1428, 587 | 353.8, 516.5, 1203.8, 834 | 85.8 |
| 1280×800 fine, right | 1129.6, 307, 1268, 537 | 280, 403.5, 1117.6, 734 | 12 |
| 1180×820 fine, right | 1029.6, 317, 1168, 547 | 95.8, 436.5, 945.8, 754 | 83.8 |
| 820×1180 fine, right | 669.6, 497, 808, 727 | 24, 783.5, 657.6, 1114 | 12 |
| 1180×820 coarse, right | 1000, 324.9, 1168, 554.9 | 81, 369.7, 931, 746 | 69 |
| 820×1180 coarse, right | 640, 504.9, 808, 734.9 | 24, 722, 628, 1106 | 12 |
| 1440×900 fine, left | 268, 357, 406.4, 587 | 492.2, 516.5, 1342.2, 834 | 85.8 |
| 1280×800 fine, left | 268, 307, 406.4, 537 | 418.4, 403.5, 1256, 734 | 12 |
| 1180×820 fine, left | 12, 317, 150.4, 547 | 234.2, 436.5, 1084.2, 754 | 83.8 |
| 820×1180 fine, left | 12, 497, 150.4, 727 | 162.4, 783.5, 796, 1114 | 12 |
| 1180×820 coarse, left | 12, 324.9, 180, 554.9 | 249, 369.7, 1099, 746 | 69 |
| 820×1180 coarse, left | 12, 504.9, 180, 734.9 | 192, 722, 796, 1106 | 12 |

Per-run JSON: [1440×900 fine](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1440x900-fine.json) · [1280×800 fine](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1280x800-fine.json) · [1180×820 fine](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1180x820-fine.json) · [820×1180 fine](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-820x1180-fine.json) · [1180×820 coarse](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1180x820-coarse.json) · [820×1180 coarse](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-820x1180-coarse.json) · the four room passes: [1440×900](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1440x900-room.json), [1280×800](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1280x800-room.json), [1180×820](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-1180x820-room.json), [820×1180](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/acceptance-820x1180-room.json) · the six left-side passes are the same names with `-sheet-left`.

**Overlaps that remain, all accounted for.** Across all 16 runs the Sheet overlaps only the scrim (which sits beneath it by design), the drawing candidate's bounding box (indicative; see the residuals), and, with the Sheet on the left at 1180 and 820, the **open Index sheet** (residual below). The Card, the zoom cluster and the dock do not overlap the Sheet in any state.

**Palette height at fine pointer, after the lane fix.** At 1440, 1280 and 1180 the palette is one row (32 px). At 820×1180 the narrower lower column wraps the keys to two rows (69.6 px, was 32 px before the lane fix); at coarse it is 44 px at 1180 and 93.6 px at 820.

**Constrained Index.** At 1180×820 and 820×1180 (fine and coarse) the Index opens as a sheet with a scrim. The Index ends above the lower column; **all five dock keys were reachable** behind it; a press on open ground on the scrim closed it and kept the selection.

**Starter-room pixel check** (wall-ink pixels under the palette footprint, folded): 1440×900 **0**; 1280×800 **0**; 820×1180 **0**; 1180×820 **13,621** (accepted residual, below).

**Keyboard pass (fine).** From the Line key, Tab reached Box, Point, Options and Cancel, then the Index and Head controls. Finish, Close ring and Backtrack are disabled without a chain and were not Tab stops in this pass. Enter on Point opened the typed X/Z; the typed point (6, −1) took the readout from `Points 0` to `Points 1` in each fine run.

**Coarse pass** (Chromium touch emulation). At the final state of each coarse run (Ink with its Wall options open, Index closed, Objects compact): **70 visible controls at 1180×820 and 66 at 820×1180, 0 below 44 × 44 CSS px.**

**Box, against `main`.** Same harness, same six fine and coarse configurations, same single re-press. The Box step ran after the Wall Line in each run.

| Tree (Sheet side) | Runs | First release did not commit | Still live after the re-press |
| --- | --- | --- | --- |
| `main` (`23d6d9ae`), Box step only | 6 | 2 (1440×900 fine; 820×1180 coarse) | 2 (the same two) |
| `a7598a55`, right Sheet | 6 | 3 (1440×900 fine; 1180×820 coarse; 820×1180 coarse) | 2 (1440×900 fine; 820×1180 coarse); 1180×820 coarse committed on the re-press |
| `a7598a55`, left Sheet | 6 | 2 (1440×900 fine; 1180×820 coarse) | 2 (1440×900 fine; 1180×820 coarse) |

The flake **reproduces on `main`** in the same configurations: the 1440×900 fine and 820×1180 coarse Box releases do not commit on `main` either, and the re-press does not rescue them there. It is therefore **pre-existing** and not introduced by S23. Its cause is not established in this slice; close-out routes it to tech-debt. The `main` run used the same harness, which the branch's full runs also used, so the numbers are comparable (`main` was measured with the Box step only, so its later palette steps are not part of this table).

**The 404 (nit).** Each run logs one console error, `Failed to load resource: the server responded with a status of 404`. The API and Vite logs identify it: the Vite log records `[404] GET /favicon.ico` on the editor origin at each page load. `src/app.html` declares no icon and `static/` ships no favicon, so the browser's default favicon request returns 404. Playwright's response events do not include browser-internal favicon fetches, which is why the harness's own 404 list is empty. This predates S23 (`app.html` and `static/` are unchanged by it) and is not fixed here.

### Contrast

Every new row, scrim and edge against the pale ground, from the shell-role tokens, asserted in the test suite. Text ≥ 4.5:1; icons and edges ≥ 3:1.

| Pair | Ratio | Floor |
| --- | --- | --- |
| row ink on row (text) | 13.95 | 4.5 |
| quiet ink on row (text) | 6.88 | 4.5 |
| armed key ink on armed key (text) | 13.95 | 4.5 |
| Index text on Index stone (text) | 14.24 | 4.5 |
| key edge on row (icon and edge) | 6.88 | 3 |
| armed key edge on row (edge) | 13.95 | 3 |
| focus ring on row (edge) | 7.25 | 3 |
| row fill against the pale ground (edge) | 12.85 | 3 |
| row hairline against the pale ground (edge) | 8.07 | 3 |
| Index stone against the scrimmed pale ground (edge; scrim = forest at 55% over the ground, composite `#728079`) | 3.81 | 3 |

Sampled from the headed PNGs, as a cross-check: the instrument row's fill against the pale Stage ground above it measured **10.59:1**; the Index stone against the scrimmed ground **3.77:1** (token 3.81); the scrim's own step against the unscrimmed ground **3.41:1**. Sample values are in [contrast.json](../../../archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/2026-11-01-browser/contrast.json).

## Residuals

- **Closed by design: the open Index sheet covers a Height Sheet on the left at constrained widths.** With the Sheet on the left at 1180×820 and 820×1180 (fine and coarse), the Index sheet, when open, sits over the Sheet's lane (`sheet/index`). Accepted by design, per the independent review: the Index is a scrimmed modal overlay (see the Independent review section, accepted residuals). The Sheet is operable once the Index closes.
- **The starter room's bottom wall is under the palette row at 1180×820.** At the Fit framing the room's bottom wall (ends at y 740) sits behind the palette row (top 714.6): 13,621 wall-ink px under the footprint. Accepted by the coordinator as a residual for S11, because clearing it needs Fit to inset for the lower column, a Camera framing change outside this plan.
- **At 820×1180 fine the palette is two rows (69.6 px).** The lane inset narrows the lower column, so the keys wrap. Heights are measured and within the Stage; no overlap results.
- **The Opening options panel covers the drawing while open.** About 276 px tall at 1180×820 (its top at 470). It is the creator's choice and closes back to the one row. The Sheet no longer overlaps it.
- **The Box flake is pre-existing.** It reproduces on `main` (see the Box table). Route to tech-debt at close-out; its cause is not established.
- **The Card covers part of a live Box preview at 1440×900.** The expanded Card (989.6–1277.6 × 60–710.6 in that run) overlaps the Box preview's bounding box (919.3–1150 × 410–442) on the preview's right. The Card is the S21/S22 overlay; the palette does not overlap the drawing.
- **The `drawing` rectangle is the union of the overlay's candidate groups** at the moment of measurement. It can include a stale candidate tag, so overlaps with `drawing` are indicative. Committed Walls were measured by wall-ink pixels, not by this rectangle.
- **Copy outside the info control.** The Ink palette's Wall and Box hints and the consequence line are tooltips only; the instrument's facts are now reachable through the info control and the accessible description. Copy review belongs to S11.
- **The keyboard pass did not walk the enabled chain keys.** Finish, Close ring and Backtrack need a live chain; their Tab reach with a chain is not recorded.
- **The stale browser flows in `apps/editor/perf/flows/` fill `[data-ink-x]` directly.** The typed fields sit behind the Point disclosure, so those flows need their open step (TD-16 records the flows as stale; they were not run).
- **The favicon 404** is pre-existing (see the nit above).
- **Not measured:** the first server-rendered paint before hydration, native touch and Safari (S11's rows), and performance (owner policy).

## Judgment calls

- **The scrim ends at the lower column's top, not the dock's.** The palette is never under the scrim. The scrim sits at z 5, beneath the lower column (6), zoom (7), Sheet (8), drafting (9) and Card (12).
- **The lower column now insets by the Sheet lane on the Sheet's side, plus 1.5 rem** (the review's P1). With no lane the inset is 1.5 rem on both sides, not the former 0.75 rem; the dock centres in what remains, so with the Sheet on the right it shifts left by half the lane.
- **The Height Sheet lane variables live on `.editor-body`**, which contains both the lower column and the Index. The review refers to `.stage-frame`; the Card, zoom and lower column all read the variables as descendants, so the placement is the same.
- **The info control is a new control** (a small focusable button). The review asked for facts that are reachable by keyboard, touch and a screen reader; the facts are a description and a visible list.
- **The Index's start state is read once at mount**, from `(max-width: 1279px)`; `EditorIndex.svelte` needed no change.
- **Ink's keys use text labels, not icons.** The plan leaves icon choice to browser calibration.
- **Refusal colours are unchanged** (an S21 owner decision).

## Closing note

The gate table above is the one run on the clean `a7598a55` tree. This record is a docs-only commit after `da85c591` (the reviewer's record), so its code is `a7598a55`. `npm run test:arch` (which includes the documentation gate) was re-run on the branch head that carries this record, in the main checkout: exit 0, 23 files, 210 tests pass. The docs gate was also run on its own: `cd apps/editor && npx vitest run --config vitest.arch.config.ts tests/docs`.

## Independent review

**Reviewer:** the convergence coordinator, independent of the implementer. Date: 2026-11-01.

- **First review, `9809dad6`:**
  - **Accepted:** the one-row instrument in the dock's material; the scrim ending at the lower column's measured top; the Index start state read at mount; text-labelled keys; the drift reconciliations; and, as a residual, the starter room under the palette at 1180×820, since clearing it would need a Camera Fit inset outside this plan, so S11 owns it.
  - **P1:** the palette entered the Height Sheet lane with Opening options open, breaking S22's no-overlap invariant.
  - **P2:** instrument facts were reachable only through a `title`.
  - **P2:** an unexplained Box second-corner flake.
  - **Nit:** an unidentified 404.
- **Fixes, `1fb0d6bc` and `a7598a55`:**
  - The lower column insets by the measured Sheet lane on the Sheet's side. In the 16-run matrix, no palette, instrument or lower-column box overlaps the Sheet, with options open and the Sheet on either side.
  - The facts are the instrument's `aria-describedby` description, and a focusable info control shows them as a visible list (`stage-instrument-host.test.ts`).
  - The Box flake reproduces on `main` `23d6d9ae` (2 of 6), so it is pre-existing and goes to tech-debt. The 404 is the absent `/favicon.ico`, also pre-existing.
- **Accepted residuals:**
  - At 1180 and 820 with the Sheet on the left, the open Index sheet covers the Sheet. The Index is a scrimmed modal overlay by design.
  - At 820×1180 fine, the keys wrap to two rows.
  - The live Box preview can pass under the Card or touch the Sheet. Previews aren't shell furniture.
  - **Nit, no action:** StageInstrumentHost numbers its ids with a module counter instead of `$props.id()`. It mounts only on a client task, so no hydration mismatch arises today.
- **Verdict at `a7598a55`:** the slice meets plan §3 to §5 within the declared `affected-subsystem` tier. Ink keeps exactly Wall (Line, Box) and Opening, with typed X/Z, Finish, Backtrack and Cancel, and `objects-panel-guard.test.ts` stays green. Contrast on PR #247's pale ground is measured and passes. Nothing is open, withdrawn or unadjudicated, so routine close-out may proceed.

## Acceptance

Accepted 2026-11-01 at tested revision `a7598a55` by the owner's routine close-out direction for this slice. The independent review (above) is clean at `a7598a55`: nothing is open, withdrawn or unadjudicated, and the accepted residuals are listed in the review and in [Residuals](#residuals). No override was recorded. The gate table is the one run on the clean `a7598a55` tree; the browser matrix ran from `a7598a55`.

Capability outcome, routed to the [phase register](../README.md#slice-register): R217.S23 ships the Ink palette row with Wall (Line, Box) and Opening readings, the instrument row, and the constrained Index with its scrim. Cutover drift is reconciled in the record above.

## Closeout and preservation

Anchors, computed before the close-out commit:

```text
plan        44bc0c5ea915a9988f51d62f24cfd6461c8e507f   last commit with the full plan body (reachable on main); the stub
                                                       at its path names this anchor
acceptance  b32bee31bf2b82f71f7e89cd89e2e924cfe81d81   the full record before this close-out; kept in full at its path
tag         closed/r217.s23 -> b32bee31               annotated tag object `f00a7e81d7242d8e6045940593367fd7ba8258e6`,
                                                       pushed to origin; the tag target keeps both anchors reachable
merge       P1 merge commit `6cfe0fb79da72962aecb8a95aa710b7d32b36966` (PR #254, `--merge`; parents `23d6d9ae`
            and `7dc67c27`, the close-out commit)
```

Post-merge verification, run on `main` at `6cfe0fb7`:

- Both anchors are ancestors of `main`: `44bc0c5e` (plan) and `b32bee31` (acceptance). `git show` of each returns its full body at its path (the plan at `44bc0c5e`, the record at `b32bee31`).
- The tag `closed/r217.s23` is annotated, peels to `b32bee31`, and keeps `44bc0c5e` reachable. It is on origin.

```text
CLOSEOUT PRESERVATION — R217.S23 (2026-11-01)
prose compacted:                 1   approved plan -> stub at its own path; acceptance record kept in full
reference promotions:            1   the lower column's Height Sheet lane inset, to the lower working edge of the shell reference
renderable evidence archived:    178 files (160 PNG, 18 JSON), moved byte-identical with git mv
evidence stubs / manifests:      1   docs/archive/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/evidence/CLOSED.md
transient artifacts removed:     0
historical anchors:              plan 44bc0c5e; acceptance b32bee31; tag closed/r217.s23 -> b32bee31 (annotated, object f00a7e81; pushed to origin)
new live -> archive prose links: 0
manual-owed verification rows:   2   native touch and Safari (S11's rows); the first server-rendered paint before hydration (not measured)
remaining deferred items:        12  the residuals above: S11 rows, TD-16, TD-18, TD-19, and the accepted residuals (the Index on a left Sheet is closed by design)
permanent stubs added:           1   approved plan
```
