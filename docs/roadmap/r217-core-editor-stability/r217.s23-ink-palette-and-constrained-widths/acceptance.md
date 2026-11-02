# R217.S23 — acceptance record: Ink palette and constrained widths

**Slice:** R217.S23 · **Status:** implemented at tested revision `7c3bf0ee`; not reviewed; no verdict recorded · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

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

## Implementation evidence

### Tested revision

- Tested revision: **`7c3bf0ee`** (branch `claude/r217-s23-ink-palette-and-constrained-widths`, base `23d6d9ae` on `main`).
- Code commits, in order: `5bfd1d3b` the instrument row; `0ffa14d6` the Ink key row with upward disclosures; `5f0d7131` the constrained Index scrim and the session start; `48ba5da7` the S23 tests; `7c3bf0ee` the reference wording.
- The browser passes ran from the same code: the final working tree matched `7c3bf0ee` apart from the evidence folder and this record.
- No `apps/api` path changed (`git diff --name-only 23d6d9ae..HEAD`), so `check:api` and `test:api` do not apply and were not run.

### Gates

Run on `7c3bf0ee` from the repository root. Every command exited 0.

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check, generated tsconfig (includes `tests/`) | 2051 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | the whole arch lane, including the documentation and parallel-track gates | 23 files, 208 tests pass |
| `npm test` | `apps/editor` `vitest run`, the complete suite | 265 files, 3479 tests pass |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 138 tests pass |
| `npm run build` | `apps/editor` production build, adapter-vercel | exit 0 (built in 8.72 s) |
| `git diff --check 23d6d9ae..HEAD` | whitespace | clean, no output |

Against S22's recorded baseline (265 files and 3460 tests in the complete suite; 200 arch tests), S23 adds 19 tests to the complete suite and 8 to the arch lane. The file count is unchanged, since S23 added no test file.

The record of `test:arch` above was taken before this record was written. The record adds a documentation, so `test:arch` is re-run after it, and that count is recorded in the closing note below.

### Plan test coverage

- [`stage-shell-composition.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-composition.test.ts), S23 block (+8, 23 in file): one dock-material row with no caption; no retired literal colour in the palette, Opening, Objects or host; the constrained Index ends above the lower column and the viewport-sized shadow is gone; z-order (scrim 5, lower column 6, zoom 7, Card 12, Index 20); the scrim is rendered only for an open constrained Index, as a pointer-only close target; the Index starts collapsed below 1280 px as session state; every Ink, Opening and Objects hook sits inside the row or its upward disclosure; a contrast floor computed from the shell-role tokens (10 pairs).
- [`spatial-route-gesture.test.ts`](../../../../apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts), S23 block (+8, 94 in file, mounted route): every Wall key and the typed X/Z path are in the row, with X/Z drawn only once its disclosure opens; a typed path drives Finish, Backtrack and Cancel through the controller; a typed chain finishes as one history step; Box with Cancel as its only command, and back to Line; one disclosure at a time, closed by a reading change; an invalid Wall option refused in words and a valid one accepted; the Opening measures behind their disclosure, placed through the same controller; the Index closed below 1280 px, opened as a sheet, and closed by the scrim with the selection kept.
- [`stage-shell-coarse-targets.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-coarse-targets.test.ts) (+2, 4 in file): the instrument close reaches 44 × 44 CSS px under a coarse pointer; every Ink key, typed field and submit does too, and the hidden radio is excluded.
- [`objects-panel-guard.test.ts`](../../../../apps/editor/tests/lib/authoring/objects-panel-guard.test.ts) (+1, 4 in file): the Ink palette offers no Shape, Round or Sketch (O10).
- [`layout-drawing-adapter.test.ts`](../../../../apps/editor/tests/lib/authoring/layout-drawing-adapter.test.ts): not modified; its 21 tests pass. The Ink adapter contract is unchanged.
- Fit: the Opening and Scene instruments and the Objects panel (full and compact) fit the container in the browser, measured in the JSON records below. A jsdom suite cannot measure layout, so the structural facts (the host body scrolls, its maximum height, the flex-wrap rows) are pinned by source contract only.

Mutation proof (the tests README's replacement-claim rule) was not run for this slice. The contracts are composition and presentation facts, not a replacement of a prior test.

### Browser acceptance

Real pointer and keyboard input in **headed Chromium** (Playwright 1.63, the repository's installed package, `headless: false`). The app ran from this checkout (Vite on `127.0.0.1:5173`) against a scratch API on `localhost:8790` and a scratch database `biskiq_r217_s23` on the local Compose Postgres, created for this slice, migrated, and dropped at the end. Sessions were signed in through the API test-auth seam, one browser per pass, every page and browser closed in `finally`, and the API and Vite processes released from their PID files. Widths: 1440×900, 1280×800, 1180×820 and 820×1180.

Each fine pass drew the drawings in an empty workspace (no starter room, so no Box can fall inside a room): a Wall Line from two taps and a Finish; a Box from two corners; an Opening placed by offset on the Line's Wall, selected in the Index. Each pass then walked the Index as a sheet, the dock behind it, the scrim, the Objects panel (full and compact), the Ink controls, and (fine only) a keyboard pass. The room passes measured the enclosed-room starter with the palette open and folded, for the pixel check under the palette.

**Matrix.** Every run: **0 page errors**, **0 failed steps** in the final pass, **0 horizontal overflow**. Each run also logs one console error, a `404` resource load; it is not a page exception and its URL was not identified (`scrollWidth` equals `clientWidth`), and **0 failed steps** in the final pass. Files are named `<state>-<width>x<height>-<mode>.png`, with one JSON per run.

| Run | Probe JSON | Palette footprint (CSS px) | Wall ink under footprint (folded) |
| --- | --- | --- | --- |
| 1440×900 fine | [acceptance-1440x900-fine.json](./evidence/2026-11-01-browser/acceptance-1440x900-fine.json) | 458.7, 794.6, 1237.3, 826.6 | 0 |
| 1280×800 fine | [acceptance-1280x800-fine.json](./evidence/2026-11-01-browser/acceptance-1280x800-fine.json) | 378.7, 694.6, 1157.3, 726.6 | 0 |
| 1180×820 fine | [acceptance-1180x820-fine.json](./evidence/2026-11-01-browser/acceptance-1180x820-fine.json) | 200.7, 714.6, 979.3, 746.6 | 0 |
| 820×1180 fine | [acceptance-820x1180-fine.json](./evidence/2026-11-01-browser/acceptance-820x1180-fine.json) | 20.7, 1074.6, 799.3, 1106.6 | 0 |
| 1180×820 coarse | [acceptance-1180x820-coarse.json](./evidence/2026-11-01-browser/acceptance-1180x820-coarse.json) | 197.5, 694.6, 982.5, 738.6 | 0 |
| 820×1180 coarse | [acceptance-820x1180-coarse.json](./evidence/2026-11-01-browser/acceptance-820x1180-coarse.json) | Line mode 20.2, 1005, 799.8, 1098.6 (keys wrap to two rows, 94 px); Box mode 149.8, 1054.6, 670.2, 1098.6 (44 px) | 0 |
| Room 1440×900 | [acceptance-1440x900-room.json](./evidence/2026-11-01-browser/acceptance-1440x900-room.json) | 458.7, 794.6, 1237.3, 826.6 | starter wall ink 0 under footprint; bottom wall ends at y 781 |
| Room 1280×800 | [acceptance-1280x800-room.json](./evidence/2026-11-01-browser/acceptance-1280x800-room.json) | 378.7, 694.6, 1157.3, 726.6 | starter wall ink 0; bottom wall ends at y 690 |
| Room 1180×820 | [acceptance-1180x820-room.json](./evidence/2026-11-01-browser/acceptance-1180x820-room.json) | 200.7, 714.6, 979.3, 746.6 | **13,803 px** (see Residuals) |
| Room 820×1180 | [acceptance-820x1180-room.json](./evidence/2026-11-01-browser/acceptance-820x1180-room.json) | 20.7, 1074.6, 799.3, 1106.6 | 0 |

Fine and coarse rows: the palette is **one row** at fine pointer (32 px tall) and 44 px at coarse at 1180×820. The live Wall candidate never overlaps the palette in any run (`live_candidate_overlaps_palette: false`). Overlap pairs outside containment (the lower column and the palette inside their own host) are listed in the summary below.

**Constrained Index.** At 1180×820 and 820×1180 (fine and coarse) the Index opens as a sheet from the Head with a scrim. The Index's bottom edge ends above the lower column (1180: Index bottom 672.6, palette top 714.6; the scrim ends at the lower column's top, 680.6). **All five dock keys were reachable** behind the open Index in all four runs (`elementFromPoint` on each key's centre). A press on the scrim, on open ground, closed the Index and kept the selection.

**Keyboard pass (fine).** From the Line key, Tab reached Box, then Point, Options and Cancel; then the Index and the Head controls. Finish, Close ring and Backtrack are disabled without a chain, so they were not Tab stops in this pass. Enter on Point opened the typed X/Z field; the typed point (6, −1) took the readout from `Points 0` to `Points 1` in each fine run.

**Coarse pass** (Chromium touch emulation, `isMobile` and `hasTouch`). Measured at the final state of each run (Ink with its Wall options open, Index closed, Objects compact): **70 visible controls at 1180×820 and 66 at 820×1180, 0 below 44 × 44 CSS px.** The Objects full panel's coarse sizes are in [acceptance-820x1180-coarse.json](./evidence/2026-11-01-browser/acceptance-820x1180-coarse.json) under `states.objectsFullControls`.

**Overlap summary.** `summary.json` lists the overlap pairs in each run, excluding the lower column and the palette inside its host (the containment that is by design). Pairs that remain are listed under Residuals with their rectangles.

Evidence folder: [`evidence/2026-11-01-browser/`](./evidence/2026-11-01-browser/). Per run, the PNGs are `ink-open`, `wall-line-live`, `wall-line-done`, `folded-wall`, `box-live`, `box-done`, `opening-options`, `opening-done`, `index-open` (narrow widths), `objects-full`, `objects-compact`, `ink-panel-open` and `final`. The summary and the contrast record are [summary.json](./evidence/2026-11-01-browser/summary.json) (per-run analysis) and [contrast.json](./evidence/2026-11-01-browser/contrast.json).

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

Sampled from the headed PNGs, as a cross-check: the instrument row's fill against the pale Stage ground above it measured **10.59:1**; the Index stone against the scrimmed ground **3.77:1** (token 3.81); the scrim's own step against the unscrimmed ground **3.41:1**. Sample values are in [contrast.json](./evidence/2026-11-01-browser/contrast.json).

## Residuals

- **The Opening options disclosure reaches the Height Sheet.** With Opening options open, the palette is wider and taller: at 1280×800 its rectangle (351–1185 × 450–727) overlaps the Sheet (1130–1268 × 307–537) for about 55 × 87 px; at 820×1180 coarse the instrument's top (722) sits 12 px inside the Sheet's foot (734). The Sheet stays above the palette in z-order (8 over 6), so it is still operable, but the overlap is real. Not fixed; it needs an owner call on the lower column's right inset at a constrained width.
- **The starter room's bottom wall is under the palette at 1180×820.** At the Fit framing, the room's bottom wall (ends at y 740) sits behind the palette row (top 714.6): 13,803 wall-ink pixels under a 779 × 32 footprint. At 1440×900, 1280×800 and 820×1180 the bottom wall clears the palette (0 pixels). Not fixed: Fit is the Camera's, and a layout change never moves the Camera.
- **The Opening options panel covers the drawing while it is open.** The disclosure is about 275 px tall at 1180×820 (its top at 470). It is the creator's choice, and it closes back to the one row.
- **The Card covers part of a live Box preview at 1440×900.** The expanded Card (989.6–1277.6 × 60–710.6 in this run) overlaps the Box preview's bounding box (919.3–1150 × 410–442) on the right of the preview. The Card is the S21/S22 overlay; the palette does not overlap the drawing.
- **The live Box preview touches the Height Sheet at 820×1180** (preview 445–677, Sheet 670–808). An S22 overlay, not the palette.
- **A second Box corner press did not commit in three runs.** At 1440×900 fine, 1180×820 coarse and 820×1180 coarse, the first release of the Box's second corner left the Box live (`Box 0.500 × 2.500 m`). The harness pressed the corner once more, which committed the Box (`boxFirstReleaseUncommitted` in each JSON). The cause is not established: it may be the harness's press timing or a real gesture defect. It is not resolved here.
- **The `drawing` rectangle is the union of the overlay's candidate groups** at the moment of measurement. It can include a stale candidate tag, so overlaps with `drawing` are indicative, not exact. The committed Walls were measured by wall-ink pixels, not by this rectangle.
- **Copy moved out of visible text.** The adapter's summary and facts now sit in the instrument head's tooltip, the Ink consequence in the live readout's tooltip, and the Ink hint text is no longer drawn. Copy review belongs to S11.
- **The keyboard pass did not walk the enabled chain keys.** Finish, Close ring and Backtrack need a live chain to be enabled, and the pass ran without one. Their Tab reach with a live chain is not recorded.
- **The stale browser flows in `apps/editor/perf/flows/` fill `[data-ink-x]` directly.** The typed fields now sit behind the Point disclosure, so those flows need their open step (TD-16 already records the flows as stale; they were not run).
- **Not measured:** the first server-rendered paint before hydration (the Index's start state is set at mount), native touch, Safari (S11's rows), and performance (owner policy).
- **Environment incident (contained):** the scratch API listened on the default LAN interface during the run, as the API does by default. It was stopped with the rest of the stack, and the scratch database was dropped.
- **Plan §5 "the dock is usable behind an open Index"** is measured at 1180 and 820 as above; the Index sheet at 1280 and above stays in flow and is not an overlay.

## Judgment calls

- **The scrim ends at the lower column's top, not the dock's.** The plan's "dock's measured span" was read as the lower column (dock plus the palette above it), so the palette is never under the scrim. The scrim sits at z 5, beneath the lower column (6), zoom (7), Sheet (8), drafting (9) and Card (12), so each stays operable behind it.
- **The Index's bottom edge is the lower column plus 0.5 rem**, replacing the fixed `5rem`.
- **The lane variables moved from the Stage frame to the editor body**, which holds both the Index and the Stage frame; the Card and zoom read them as descendants, as before.
- **The Index's start state is read once at mount** from `(max-width: 1279px)` and then held as session state. The narrow-width listener still collapses the Index on entry to the constrained width, as before.
- **`EditorIndex.svelte` needed no change.** Its `open` prop already drives the hidden state, and the scrim is a route element.
- **Ink's keys use text labels, not icons.** The plan leaves icon choice to browser calibration; the labels are short and carry their shortcut as a title.
- **Refusal colours are unchanged** (the S21 residual awaits an owner decision on destructive and refusal colours). Literal colours were replaced by shell-role tokens only where the palette, Opening and Objects styles drew them.

## Closing note

The record was written after the gates above, so the documentation gate (part of `test:arch`) was re-run against it: `npm run test:arch` exited 0 with 23 files and 208 tests, the same counts as the gate run. No code changed after `7c3bf0ee`.
