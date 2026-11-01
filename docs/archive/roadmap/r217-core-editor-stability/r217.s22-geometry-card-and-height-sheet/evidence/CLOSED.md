# R217.S22 browser evidence (archived)

Browser captures and measurements from the S22 acceptance runs at tested revision `fb57a662`, preserved
byte-for-byte from the live tree by `git mv`. The live acceptance record links here for every capture.
Nothing in this folder is an authority: the [acceptance record](../../../../../roadmap/r217-core-editor-stability/r217.s22-geometry-card-and-height-sheet/acceptance.md)
owns the results, the review and the acceptance, and the [plan stub](../../../../../roadmap/r217-core-editor-stability/r217.s22-geometry-card-and-height-sheet/implementation-plan.md)
owns the recovery line for the approved plan.

Runs: a Vite dev server on `localhost:5173` and a scratch API on `localhost:8790`, both no longer listening at
release, and the scratch database created for the slice, which is no longer present. Browser passes ran in
Chromium through Playwright and an agent-browser session (fine pointer; coarse pointer by touch emulation),
and the headed compositor check in a display-backed Chromium. Widths: 1440×900, 1280×800, 1180×820, 820×1180.

## 2026-11-01-browser

### Captures (81 PNG at the top level)

| File | State |
| --- | --- |
| `wall-{width}.png`, `sheet-*-{width}.png`, `ink-{width}.png` | Wall selected, the Height Sheet pinned, dragging, shaded and in 2D Paper, and the ink palette open, at the widths named in the record |
| `coarse-{1180x820,820x1180}.png`, `coarse-*-card-expanded.png`, `sheet-3d-pinned-coarse-820x1180.png` | coarse pointer, Card folded and expanded |
| `edit-under-card-{1440,1180x820}-{during,after}.png` | a Wall edited under the expanded Card, during and after the gesture |
| `kbd-walk-wall-00` to `-15`, `kbd-scene-00` to `-18`, `kbd-op-*`, `kbd-scene-op-*` | keyboard walk and operation, one PNG per stop |
| `height-*`, `pin-after-pin.png`, `refusal-card-after.png`, `commit-collapsed-*` | the Sheet height steps, the first pin, the refused writer value and the folded commit |

### Subfolders (kept with the record)

| Folder | Contents |
| --- | --- |
| `superseded-light-ground/` (6 PNG, 4 JSON) | the pre-fix captures of the owner's light-ground review; the 1280 and 820 pinned captures in the record's matrix are these files |
| `superseded-headless-compositor/` (11 PNG, 12 JSON) | the headless captures of the expanded Card, whose dark rectangle the record shows to be a compositor artifact |
| `compositor-check/` (14 PNG, 4 scripts) | the variant probes behind `compositor-check.json`: headed and headless pixels for each variant |

### Measurements, logs and scripts

| File | Produced by |
| --- | --- |
| `{state}-{width}.json` (one per state and width) | `shell-measure.js`, the Stage shell's rects, computed inks and overlap pairs |
| `sheet-contrast-measured.json` | `measure-sheet-contrast.py`, WCAG 2.x ratios for each visible ink against its rendered backing |
| `compositor-check.json` | `compositor-check/variants.cjs`, `headed.cjs`, `reach.cjs` and `probe-under-card.cjs` |
| `coarse-pointer-targets.json` | the coarse-pointer measurement: controls and their CSS-pixel sizes, 0 below 44 × 44 |
| `card-scroll-reachability.json` | the Card's controls reached by scrolling at 1440×900 and 1180×820 |
| `keyboard-walk-*.json`, `keyboard-operate-*.json` | the Tab order and operation probes, Wall and Scene object |
| `page-errors-{width}.txt` (4) | the page error log per width, empty in the record |
| `shell-passes.cjs`, `sheet-captures.cjs`, `edit-under-card.cjs` | the capture and pass scripts |
