# R217.S22 — acceptance record: Geometry, Card and Height Sheet

**Slice:** R217.S22 · **Status:** implemented at tested revision `fb57a662`; implementation evidence recorded (re-recorded after the owner's light-ground P1); independent review and acceptance pending (this record states no verdict) · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:** [R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

**AUTHORITY: NONE.** This record reports what was implemented, the gates run, the browser evidence and the drift reconciled at cutover. The [phase slice register](../README.md#slice-register) owns status. Acceptance is for the independent review.

## Drift reconciled at cutover

Where landed PR #247, S20 or S21 disagreed with older text, the landed baseline stands. Each reconciliation below is one stale sentence this slice corrected.

| Where | Older text | Reconciled to | Source |
| --- | --- | --- | --- |
| [shell and visual-system reference](../../../reference/design-system/editor-shell-and-visual-system.md), paragraph "Height Sheet" | "Labels appear on hover or drag" | "The value shows on focus, drag and touch; the tick names show with the value and on hover" | [target specification, Lower edge](../post-s10-convergence/target-specification.md#lower-edge-height-sheet-and-responsive); drift D11 |
| Same reference, pin hint | "a one-time hint after the first raised surface" | the one-time pin hint appears on the first pin of a Stage session and clears itself | target specification ("appears only on first pin use"); the approved plan §3; drift D42 |
| [T1 tech-debt register, TD-15](../../../operations/tech-debt/README.md) | "Status open" | "Status fixed (7f4865c5)"; the hint flag belongs to the Stage host, so each session shows its own first-pin hint | TD-15 fix options (scope the flag to the Stage session) |
| [`stage-shell-composition.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-composition.test.ts) and [`spatial-route-gesture.test.ts`](../../../../apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts) zoom clearance | the cluster clears a right-side Sheet by a fixed `calc(5.5rem + 1rem)` | the cluster clears the measured Sheet lane, `calc(var(--sheet-lane-right, 0px) + 1.5rem)` | plan §3 (measured geometry); drift D12 |
| Same reference, Height Sheet ink | the Sheet's ink assumed a dark backdrop and switched on the 2D-only `quiet` flag | the Sheet draws its own pale plate (`--shell-paper`) in forest ink (`--shell-forest`, `--shell-forest-raised`) on every ground; the route passes no `quiet` flag to the Sheet | the owner's P1 on PR #252 (3D ground is pale since PR #247); S11 J4 (ticks show Floor, the plinth top and 0.75 m) |

The plan's own text "`.reserved-height` goes" is done: the route no longer reserves a fixed slot. The Card's fixed right offset (`4rem`) and fixed bottom offset are replaced by lane variables. Those are not stale landed contracts; they were implementation values.

## Implementation evidence

### Tested revision

- Branch `claude/r217-s22-geometry-card-and-height-sheet`, from `main` at `3eaafbb9` (R217.S20 and S21 merged).
- Code commits: `7f4865c5` (measured lanes, the Sheet line, the Card fade and fold, TD-15, the empty-click notice) and **`fb57a662`** (the owner's light-ground fix: the Sheet's own pale plate and forest ink, the tick names, the removal of the `quiet` flag, and the tests). **Tested SHA: `fb57a662`.** Every gate below ran against that tree; no code file changed after it.
- Docs commits `2c2eb72b` (TD-15 closure and the reference alignment) and the re-recording commit that carries this section change no code. The reference's Height Sheet paragraph was updated in the re-recording commit to name the tick names, hover and the plate ink.
- Paths changed by the code commit: `EditorCard.svelte`, `StageHeightSheet.svelte`, the route `spatial/+page.svelte`, the new fixture `tests/lib/authoring/fixtures/HeightSheetProbe.svelte`, and three test suites. `git diff --name-only 3eaafbb9 7f4865c5` names no `apps/api` path, so `npm run check:api` and `npm run test:api` do not apply and were not run.

### Gates

Run on the tested revision `fb57a662` from the repository root, `apps/editor` where stated. Every command exited 0. The package checks ran on `7f4865c5`; `packages/` is unchanged since, so they are not re-run. The last complete-suite run (`npm test`) was on the final tree after the record's links were corrected.

| Command | Subject | Result |
| --- | --- | --- |
| `npm run check` | `apps/editor` svelte-check, generated tsconfig (includes `tests/`) | 2051 files, 0 errors, 0 warnings |
| `npm run check:camera-core` | `packages/camera-core`, `tsc --noEmit` | exit 0 |
| `npm run check:layout-core` | `packages/layout-core`, `tsc --noEmit` | exit 0 |
| `npm run check:geometry-core` | `packages/geometry-core`, `tsc --noEmit` | exit 0 |
| `npm run check:project-model` | `packages/project-model`, `tsc --noEmit` | exit 0 |
| `npm run test:arch` | `vitest.arch.config.ts`, the whole arch lane, including the documentation and parallel-track gates | 23 files, 200 tests pass (re-run after the record was corrected) |
| `npm test` | `apps/editor` `vitest run`, the complete suite | 265 files, 3460 tests pass (re-run on the final tree; an earlier run caught the record's stale links and was discarded) |
| `npm run test:heavy` | `vitest.heavy.config.ts` | 11 files, 138 tests pass |
| `npm run build` | `apps/editor` production build, adapter-vercel | exit 0 (run on `fb57a662`) |
| `git diff --check 3eaafbb9 fb57a662` and `git diff --check` (worktree) | whitespace | clean, no output |

Against S21's recorded baseline (265 files, 3440 tests, arch 194), S22 adds 20 tests in the complete suite (15 from the lanes and Card work, 5 from the light-ground fix) and 6 in the arch lane. The arch count includes the composition tests added here.

### Plan test coverage

- [`stage-shell-composition.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-shell-composition.test.ts), S22 block (6 tests): the measured lanes are published on the Stage frame and no fixed reserved slot remains; the two lane observers submit no Camera intent, fit, framing or Plan parameter (**no Camera movement on a layout change**); the Card fades and takes no pointer events only for a non-navigation lease; the fold is set once when a task opens and is never derived from the live task; no plain `Nothing selectable there.` notice; the pin hint flag belongs to the Stage host.
- [`stage-height-sheet.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-height-sheet.test.ts), mounted control block (7 new tests, 20 in the file): a line with a knob and ticks, no boxed title, no permanent value; the value on focus and gone on focus-out; keyboard steps and tick jumps unchanged; pins and removal unchanged; **the hint shows on the first pin, is not shown on later pins, and clears itself after `PIN_HINT_MS`** (fake timers); **a fresh Stage session shows its own first-pin hint** (two mounted sessions, the TD-15 regression); the coarse knob and track at 44 × 44 CSS px.
- [`stage-height-sheet.test.ts`](../../../../apps/editor/tests/lib/authoring/stage-height-sheet.test.ts), light-ground block (R217.S23, 5 tests): no literal colour outside a shell-role token; no `quiet` variant, so the ink does not depend on the 2D-only flag; the token pairs meet 4.5:1 for text and 3:1 for lines and pins; the tick names show with the value and a name that would stack is left out; the route passes no `quiet` flag to the Sheet.
- [`spatial-route-gesture.test.ts`](../../../../apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts), mounted route (2 S22 tests and one updated assertion): **the Card fades while an authored gesture holds the Stage and never for a navigation press**; **a folded Card stays folded when the task that folded it closes underneath, as a commit does**. The updated zoom assertion pins the measured lane.
- Mutation proof for the fold test (the tests README's replacement-claim rule): with the prior derived fold restored (`cardExpanded === null ? narrowShell || (task !== null && width < 1100) : !cardExpanded`) and the opening-edge fold disabled, the fold test fails with `expected 'Collapse' to be 'Expand'`. With the change, it passes. The route was restored byte-identical afterwards.
- Existing mounted tests still pass unchanged, including the Sheet keyboard and pin tests, the found-tick snapping test, the Experience hide test, the snap-naming test ("Snapped to Pin" while dragging) and the Camera-free panel and viewport tests.

### Browser acceptance

Real pointer and keyboard input in Chromium, at the execution plan's four widths (1440×900, 1280×800, 1180×820, 820×1180). The app ran from this checkout (Vite dev server, `localhost:5173`) against a scratch API (`localhost:8790`) on a scratch database created for this slice on the local Compose Postgres. The project is the enclosed-room starter, saved to the cloud and reloaded (`Enclosed room`). The sessions were task-owned and released at the end (see [Residuals](#residuals)).

Evidence folder: [`evidence/2026-11-01-browser/`](./evidence/2026-11-01-browser/). Every JSON file there is the probe output for one state; the probe is [`shell-measure.js`](./evidence/2026-11-01-browser/shell-measure.js).

#### Matrix: wall, pinned, palette, at each width

Each state was reached after a fresh load, so the first-pin hint was live for the pinned state. Overlap is the pairwise test of the measured boxes of the Card, Sheet, zoom cluster, dock, palette, pin hint, Index and Stage actions. Every state has **0 overlapping pairs** and **no horizontal overflow** (`scrollWidth` equals `clientWidth`).

| State | 1440×900 | 1280×800 | 1180×820 | 820×1180 |
| --- | --- | --- | --- | --- |
| Wall 1 selected | [PNG](./evidence/2026-11-01-browser/wall-1440x900.png) · [JSON](./evidence/2026-11-01-browser/wall-1440x900.json) | [PNG](./evidence/2026-11-01-browser/wall-1280x800.png) · [JSON](./evidence/2026-11-01-browser/wall-1280x800.json) | [PNG](./evidence/2026-11-01-browser/wall-1180x820.png) · [JSON](./evidence/2026-11-01-browser/wall-1180x820.json) | [PNG](./evidence/2026-11-01-browser/wall-820x1180.png) · [JSON](./evidence/2026-11-01-browser/wall-820x1180.json) |
| Pinned, first-pin hint showing (1440 and 1180 re-captured after the ink fix; 1280 and 820 are pre-fix, superseded) | [PNG](./evidence/2026-11-01-browser/sheet-3d-pinned-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-pinned-1440x900.json) | [PNG](./evidence/2026-11-01-browser/superseded-light-ground/pinned-1280x800.png) · [JSON](./evidence/2026-11-01-browser/superseded-light-ground/pinned-1280x800.json) | [PNG](./evidence/2026-11-01-browser/sheet-3d-pinned-1180x820.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-pinned-1180x820.json) | [PNG](./evidence/2026-11-01-browser/superseded-light-ground/pinned-820x1180.png) · [JSON](./evidence/2026-11-01-browser/superseded-light-ground/pinned-820x1180.json) |
| Ink palette open | [PNG](./evidence/2026-11-01-browser/ink-1440x900.png) · [JSON](./evidence/2026-11-01-browser/ink-1440x900.json) | [PNG](./evidence/2026-11-01-browser/ink-1280x800.png) · [JSON](./evidence/2026-11-01-browser/ink-1280x800.json) | [PNG](./evidence/2026-11-01-browser/ink-1180x820.png) · [JSON](./evidence/2026-11-01-browser/ink-1180x820.json) | [PNG](./evidence/2026-11-01-browser/ink-820x1180.png) · [JSON](./evidence/2026-11-01-browser/ink-820x1180.json) |

Measured geometry, CSS px (`l, t, r, b`), from the JSON files:

- **1440×900, Wall:** Card `1064, 60, 1352, 790`; Sheet `1364, 359, 1428, 585`; zoom `1242, 802, 1352, 840`; dock `736, 840, 960, 888`. The Card clears the Sheet by 12 px and sits 12 px above the zoom cluster.
- **1280×800, Wall:** Card `904, 60, 1192, 690`; Sheet `1204, 309, 1268, 535`; zoom `1082, 702, 1192, 740`.
- **1180×820, Wall (Card folded at a narrow width):** Card `804, 632, 1092, 710`; Sheet `1104, 319, 1168, 545`; zoom `982, 722, 1092, 760`.
- **820×1180, pinned (Card folded):** hint `16, 1066, 293, 1112`; dock `298, 1120, 522, 1168`; Card `444, 992, 732, 1070`. The hint clears the dock and the Card.
- **Ink palette, 820×1180:** hint `16, 802, 293, 848` and palette `132, 856, 688, 1114` clear each other by 8 px, the tightest pair measured.
- **Pin hint:** shown after the first pin, and cleared by itself about 7 s later (`pin-after-pin.json` and `pin-hint-cleared.json`). It sits above the dock on the left, never over the Card or the Sheet lane.

Console and page errors: the Playwright passes logged `errors: []`; the agent-browser error logs `page-errors-<width>.txt` are empty for all four widths.

#### Edit a subject under the Card, with the Card fading (1440 and 1180)

The Card was expanded, and a Wall was edited by a press on an endpoint outside the Card, dragged into the Card's area. Each state was read from the live DOM.

| Width | Before | During the drag | After release | Evidence |
| --- | --- | --- | --- | --- |
| 1440×900 | opacity 1, pointer-events auto | opacity 0.2, pointer-events none, `data-card-gesturing="true"`, centre point is not the Card | back to 1 / auto; the Card box is unchanged (`1064, 60, 288, 730`) | [during PNG](./evidence/2026-11-01-browser/edit-under-card-1440-during.png) · [after PNG](./evidence/2026-11-01-browser/edit-under-card-1440-after.png) · [JSON](./evidence/2026-11-01-browser/edit-under-card-1440-during.json) |
| 1180×820 | opacity 1, pointer-events auto | opacity 0.2, pointer-events none, `data-card-gesturing="true"`, centre point is not the Card | back to 1 / auto; the Card box is unchanged (`804, 60, 288, 650`) | [during PNG](./evidence/2026-11-01-browser/edit-under-card-1180x820-during.png) · [after PNG](./evidence/2026-11-01-browser/edit-under-card-1180x820-after.png) · [JSON](./evidence/2026-11-01-browser/edit-under-card-1180x820.json) |

The 1440 edit was accepted: Undo became available, and the Wall's end moved. The Card's lane and its fold did not change during the gesture.

#### Light-ground ink (R217.S23, owner P1)

The Sheet now draws its own pale plate (`--shell-paper`) and forest ink (`--shell-forest`, `--shell-forest-raised`), with gold pins (`--shell-gold`, `--shell-gold-ink`). It no longer switches on the 2D-only flag. The coordinator review found the earlier ink invisible on the pale 3D ground, and the tick names unreadable. Every capture below is re-taken on the Stage with the Sheet at 1.20 m or dragged, and the project carries a raised surface (`Shape`, top at 1.000 m), so the found tick and its name render.

Contrast is measured from the PNG: for each visible ink, the **backing actually rendered behind it** (the modal colour of the plate, chip or face in the capture) is compared with the element's computed ink, by WCAG 2.x relative luminance. Thresholds: text (value, tick names, snap, hint, glyphs) 4.5:1; line, tick, knob ring 3:1. Method and every element: [`sheet-contrast-measured.json`](./evidence/2026-11-01-browser/sheet-contrast-measured.json) (produced by [`measure-sheet-contrast.py`](./evidence/2026-11-01-browser/measure-sheet-contrast.py)).

| Capture | Text min | Line / tick min | Plate under Sheet | Mat probe (dark mat corner) | Ticks rendered (names) | PNG · JSON |
| --- | --- | --- | --- | --- | --- | --- |
| 3d pinned-1440x900 | 7.67 | 7.67 | #e9ebe6 | #152c26 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-3d-pinned-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-pinned-1440x900.json) |
| 3d dragging-1440x900 | 7.67 | 7.67 | #e9ebe6 | #152c26 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-3d-dragging-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-dragging-1440x900.json) |
| 3d pinned-1180x820 | 7.67 | 7.67 | #e9ebe6 | #152c26 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-3d-pinned-1180x820.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-pinned-1180x820.json) |
| 3d dragging-1180x820 | 7.67 | 7.67 | #e9ebe6 | #152c26 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-3d-dragging-1180x820.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-dragging-1180x820.json) |
| 2d paper-pinned-1440x900 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-2d-paper-pinned-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-2d-paper-pinned-1440x900.json) |
| 2d paper-dragging-1440x900 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-2d-paper-dragging-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-2d-paper-dragging-1440x900.json) |
| 2d paper-pinned-1180x820 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-2d-paper-pinned-1180x820.png) · [JSON](./evidence/2026-11-01-browser/sheet-2d-paper-pinned-1180x820.json) |
| 2d paper-dragging-1180x820 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-2d-paper-dragging-1180x820.png) · [JSON](./evidence/2026-11-01-browser/sheet-2d-paper-dragging-1180x820.json) |
| shaded 2d-pinned-1440x900 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-shaded-2d-pinned-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-shaded-2d-pinned-1440x900.json) |
| shaded 2d-dragging-1440x900 | 7.67 | 7.67 | #e9ebe6 | #e9ebe6 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-shaded-2d-dragging-1440x900.png) · [JSON](./evidence/2026-11-01-browser/sheet-shaded-2d-dragging-1440x900.json) |
| 3d pinned-coarse-820x1180 | 7.25 | 7.67 | #e9ebe6 | #152c26 | Floor, Shape | [PNG](./evidence/2026-11-01-browser/sheet-3d-pinned-coarse-820x1180.png) · [JSON](./evidence/2026-11-01-browser/sheet-3d-pinned-coarse-820x1180.json) |

Across the 11 captures (100 measured inks in total), the lowest text ratio is **7.25:1** (threshold 4.5) and the lowest line, tick and knob ratio is **7.67:1** (threshold 3). Every capture passes. The pair ratios on the plate are: forest on paper **12.85:1** (tick names, value, knob ring, datum tick); forest-raised on paper **7.67:1** (rail, ticks, add glyph ground); gold ink on paper **5.68:1** (pin border); paper on forest-raised **7.67:1** (add glyph); forest on gold **7.25:1** (pin glyph). The lowest text ratio in the coarse capture is the pin glyph (forest on gold, 7.25:1). The lowest line is the forest-raised rail and ticks (7.67:1).

The 3D captures show the dark mat (`#152c26`) in the top-right corner, and the Sheet stands on the pale plate in every capture. The plate is opaque, so the ink does not depend on what is behind it. No capture places the Sheet over the dark mat itself; that case is covered by the opaque plate, not by a capture (see Residuals).

Coarse pass (touch emulation, 820×1180, pinned, 3D): text min 7.25:1, line min 7.67:1; the knob and track stay 44 × 44 CSS px (see the coarse pass above).

Superseded, pre-fix captures (the P1 images, kept for comparison): [`superseded-light-ground/`](./evidence/2026-11-01-browser/superseded-light-ground/). The 1280 and 820 pinned captures in the matrix are these files, because the owner asked for 1440 and 1180 to be re-taken.

#### Pin, drag and key a height (1440)

| Step | Height (m) | Readout shown | Pins | Evidence |
| --- | --- | --- | --- | --- |
| Start | 1.20 | no | 0 | [JSON](./evidence/2026-11-01-browser/height-0-start.json) |
| Dragging the track | 1.553 | yes | 0 | [JSON](./evidence/2026-11-01-browser/height-1-dragging.json) · [PNG, pre-fix](./evidence/2026-11-01-browser/superseded-light-ground/height-1-dragging.png) |
| Released | 1.553 | no | 0 | [JSON](./evidence/2026-11-01-browser/height-2-released.json) |
| ArrowUp on the slider | 2.053 | yes | 0 | [JSON](./evidence/2026-11-01-browser/height-3-keyed.json) · [PNG, pre-fix](./evidence/2026-11-01-browser/superseded-light-ground/height-3-keyed.png) |
| Pin at 2.05 m | 2.053 | yes | 1, `Remove the pin at 2.05 metres` | [JSON](./evidence/2026-11-01-browser/pin-after-pin.json) · [PNG](./evidence/2026-11-01-browser/pin-after-pin.png) |

#### Refusal and commit: the Card holds, and does not expand

- **Refusal (Card writer, Height `-1`, the refused value):** the alert reads `Enter a value greater than zero.`; the Card box stays `1064, 60, 288, 730` and its fold stays `Collapse` ([before](./evidence/2026-11-01-browser/refusal-card-before.json) · [after](./evidence/2026-11-01-browser/refusal-card-after.json) · [PNG](./evidence/2026-11-01-browser/refusal-card-after.png)). This is a writer refusal, not a gesture refusal; a gesture refusal was not exercised in the browser (see Residuals).
- **Commit with the Card folded (1440):** the Card was collapsed by the user, then an accepted drag of the Wall's end. The Card stays `Expand` (folded) and its box stays `1064, 712, 288, 78` before and after ([before](./evidence/2026-11-01-browser/commit-collapsed-before.json) · [after](./evidence/2026-11-01-browser/commit-collapsed-after.json)). The fold test in the mounted suite pins the same rule for a task that closes underneath the Card.

#### Keyboard walk: the S21 owed row, Wall and Scene

S21 recorded that the Card's writer fields, Delete, Bring into view and More were not walked by Tab in the browser. This pass walks each of them, from the Card's first header control, at 1440×900, and then operates each one from the keyboard.

**Wall (Wall 1, the saved starter).** Focus order, as recorded in [`keyboard-walk-wall-1440x900.json`](./evidence/2026-11-01-browser/keyboard-walk-wall-1440x900.json), with a PNG per stop (`kbd-walk-wall-00.png` to `kbd-walk-wall-15.png`):

0. Collapse (header) · 1. Close selection card · 2. Name field · 3. Rename · 4. Fixed endpoint, the radio group (Start is selected; End is reached with the arrow keys) · 5. Height · 6. Thickness · 7. Length · 8. Angle · 9. Move ΔX · 10. Move ΔZ · 11. Start and End X/Z (disclosure) · 12. **Delete Wall** · 13. Bring into view · 14. More (disclosure) · 15. Technical details (disclosure).

Operation, from [`keyboard-operate-wall-1440x900.json`](./evidence/2026-11-01-browser/keyboard-operate-wall-1440x900.json) (one PNG per step, `kbd-op-*.png`):

- Collapse and Expand by Enter: fold changes as expected.
- Rename by typing and Enter: the title becomes the new name.
- Height by typing and Enter, and a zero refused with the same keys.
- Delete by Enter: the consequence is disclosed (`This deletes the Wall. It opens the enclosure and retires 1 Room.`) with `Confirm Delete Wall` and `Cancel`. Cancel by Tab and Enter clears the disclosure. The Wall was not deleted.
- Bring into view by Enter.
- More by Enter opens it; Tab reaches `Focus`, then `Open task`.
- Technical details by Enter opens it.

**Scene object (a native form placed from the Objects instrument).** Focus order, [`keyboard-walk-scene-1440x900.json`](./evidence/2026-11-01-browser/keyboard-walk-scene-1440x900.json), 19 stops with PNGs `kbd-scene-00.png` to `kbd-scene-18.png`: Collapse, Close, Form X, Form Z, Move, Place on floor, Form yaw, Turn, Form width, Form height, Form depth, Size, Duplicate, Save to My Objects, Delete, Bring into view, More, Technical details, then the dock's Select. Operation, [`keyboard-operate-scene-1440x900.json`](./evidence/2026-11-01-browser/keyboard-operate-scene-1440x900.json): Collapse and Expand by Enter, Bring into view by Enter, More and Technical details opened by Enter.

The keyboard walk and operation were run in a task-owned Playwright Chromium context ([`shell-passes.cjs`](./evidence/2026-11-01-browser/shell-passes.cjs)); the Wall walk through agent-browser in the same session gave the same order before the session lost its cookie (see Residuals).

#### Coarse-pointer pass (touch emulation, 820×1180 and 1180×820)

Chromium through Playwright with `hasTouch`, so `(pointer: coarse)` matched. Every visible Stage-shell control was measured in CSS px: the Head, the Stage actions, the zoom cluster, the dock, the Sheet's track, knob, add and pin buttons, and the Card's controls. Results in [`coarse-pointer-targets.json`](./evidence/2026-11-01-browser/coarse-pointer-targets.json):

| Width | State | Controls measured | Below 44 × 44 | Sheet knob box | Horizontal overflow | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 820×1180 | Card folded, pinned | 28 | 0 | 44 × 44 | no | [PNG](./evidence/2026-11-01-browser/coarse-820x1180.png) |
| 820×1180 | Card expanded | 43 | 0 | 44 × 44 | no | [PNG](./evidence/2026-11-01-browser/coarse-820x1180-card-expanded.png) |
| 1180×820 | Card folded, pinned | 28 | 0 | 44 × 44 | no | [PNG](./evidence/2026-11-01-browser/coarse-1180x820.png) |
| 1180×820 | Card expanded | 43 | 0 | 44 × 44 | no | [PNG](./evidence/2026-11-01-browser/coarse-1180x820-card-expanded.png) |

Touch emulation in Chromium only. Native touch and Safari remain S11's.

### Decisions taken inside the plan

These are judgments the plan left open. Review may overturn any of them.

- **Lanes measured.** The route publishes three measured spans on the Stage frame: the lower column (dock and any palette), the Height Sheet's lane width (on the side it occupies), and the zoom cluster's height. The Card clears them from CSS, and `.reserved-height` is gone. The plan also named the **Index** and the **Card** as spans. The Index is a flex sibling of the Stage at 1280 px and wider, so its edge already bounds the Stage, and below 1280 it is an overlay whose scrim belongs to S23. The Card's box is an output of the lanes, not an input. Neither is published, so no unused variable exists.
- **Card position.** The Card sits left of the Sheet lane (1.5 rem clearance) and above the zoom cluster. The zoom cluster keeps its place beside the Sheet lane and now clears it by the measured width.
- **Pin hint placement.** The hint sits on the left, above the lower column. At every width the Card occupies the Sheet's left side, so a hint beside the Sheet would overlap it. It has no dismissal control and clears itself after `PIN_HINT_MS` (6 s).
- **Hint trigger.** The first pin of a Stage session, as the approved plan and target specification say. The reference doc's earlier "after the first raised surface" was reconciled above.
- **Readout.** Shown on focus, drag and touch. It is hidden in the DOM only by opacity, so the `aria-live` value still reaches assistive technology.
- **Fold.** The constrained fold is set on a task's opening edge and is no longer re-derived from the live task. A closed task therefore never expands a folded Card. Closing a task by hand still clears the explicit choice, so the fold is reconsidered, as before.
- **Stage-host flag.** `pinHintSeen` lives on the route (the Stage host), not on the session object, which keeps the change inside the plan's named files.
- **Ink plate (owner P1).** The Sheet's ink is independent of the ground. Each part of the Sheet stands on its own pale plate (`--shell-paper`) with forest ink, so the same ink serves the pale 3D ground, Paper, Shaded and the dark mat. This replaces the dark-backdrop ink and the `quiet` switch, and no new colour was introduced: every colour is a shell-role token.
- **Tick names (S11 J4).** The names of the semantic ticks show in chips with the value (focus, drag, touch) and on hover. A name that would stack within 16 px of the one below is left out; its tick mark is still drawn.
- **Knob.** Under a coarse pointer the knob's own box is 44 × 44 with the 14 px ring drawn inside it, and the track is 44 px wide. The Sheet's lane is 88 px wide under a coarse pointer and 64 px fine.

### Residuals

- **Sheet over the dark mat.** No capture places the Sheet over the dark mat itself: the captures show the plate under the Sheet, and the mat only in the top-right corner. The plate is opaque, so the ink's contrast does not depend on the ground; the 3D mat corner is sampled in every 3D capture (`matProbe`).
- **Plinth top.** `Place plinth` created no found top in this build (the instrument closed and no Layout box appeared in the Index). The raised surface used for the semantic ticks is a Scene form whose top is at 1.000 m (`Shape`). S11 J4's plinth top and 0.75 m tick are not reproduced here.
- **Focus after Cancel (keyboard).** After Cancel clears a destructive confirmation (Delete Wall or Delete Object), focus falls to the page body rather than returning to the Delete control. Found in the keyboard pass. The Card's confirmation is S21's code and is outside this plan's scope; not fixed here. Owner: the Card follow-up.
- **Pin hint and stage notice.** The hint sits above the lower column at the left. A stage notice (`.stage-note`, bottom 6 rem on the left) can overlap it by about 16 px if both are visible at the same time. Not measured together. Owner: T1 notice placement.
- **Keys panel.** The Keys reference (opened from Find) sits at the top right and can overlap the top of a tall Card while open. Not in the matrix. Owner: S23 or the Keys follow-up.
- **Constrained-width Index.** At 1180 and 820 with the Index open, it is a 256 px overlay with a scrim over the Stage's left edge. Not measured as an overlap, because the overlay is the S23 sheet behaviour.
- **Gesture refusal.** The refusal evidence is a Card writer refusal (zero height), not a refused gesture. The mounted route suite covers the Card's position and fold through a task that folds it; a refused press in the browser was not exercised.
- **Object kind.** The Scene walk used a native form placed from the Objects instrument's default position. Choosing a Sphere switches the instrument to a kind filter with no placement control, so a sphere was not placed.
- **Browser session.** The agent-browser session lost its session cookie partway through the run (`/auth/me` reported no cookie; the project then read as forbidden). The Wall walk and matrix were taken before this, and the later passes ran in a task-owned Playwright context with the cookie set directly. This is an environment incident. No product path was found to clear the cookie.
- **Touch and Safari.** Coarse measurements are Chromium touch emulation. Native touch and Safari remain S11's rows.
- **Performance.** No performance measurement was taken; the 2026-10-28 owner policy keeps those owner-initiated.
- **Scratch data.** The browser passes used a scratch database (`biskiq_r217_s22`) created on the local Compose Postgres and a scratch API on port 8790. The database and servers are released at the end of this slice (see the final report).
