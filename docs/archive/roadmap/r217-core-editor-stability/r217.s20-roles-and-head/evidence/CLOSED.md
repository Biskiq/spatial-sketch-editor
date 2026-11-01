# R217.S20 browser evidence (archived)

Browser captures and measurements from the S20 acceptance runs at tested revision `b5f1440b`, preserved
byte-for-byte from the live tree by `git mv`. The live acceptance record links here for every capture.
Nothing in this folder is an authority: the [acceptance record](../../../../../roadmap/r217-core-editor-stability/r217.s20-roles-and-head/acceptance.md)
owns the results and the [plan stub](../../../../../roadmap/r217-core-editor-stability/r217.s20-roles-and-head/implementation-plan.md)
owns the recovery line for the approved plan.

## 2026-11-01-browser

Session: agent-browser, its own daemon, dev server on `127.0.0.1:5273` (task-owned, stopped at release). Coarse-pointer runs used Chromium with touch emulation. Widths: 1440×900, 1280×800, 1180×820,
820×1180.

### Screenshots (23)

| File | State |
| --- | --- |
| `head-{width}-empty.png` | empty project, all four widths |
| `head-{width}-refused-undo.png` | keyboard focus on unavailable Undo, reason open |
| `head-{width}-dirty.png` | one accepted edit, Undo available |
| `head-820x1180-coarse-empty.png`, `head-1180x820-coarse-empty.png` | coarse pointer, empty |
| `head-820x1180-coarse-refused-tap.png`, `head-1180x820-coarse-refused-tap.png` | coarse pointer, touch tap on Undo |
| `head-1440x900-keyboard-save-focus.png`, `head-1440x900-keyboard-preview-focus.png`, `head-1440x900-keyboard-find-typed.png` | keyboard path |
| `head-1440x900-project-menu.png` | project name menu |
| `stage-viewing-settings-mat-1440x900.png`, `stage-viewing-settings-paper-1440x900.png` | Stage ⚙ on the mat and on Paper, after the review fixes |
| `stage-keys-panel-1440x900.png` | Keys panel reached from Find |

### Measurements (25 JSON and text files, one script)

| File | Produced by |
| --- | --- |
| `{width}-metrics-{empty,refused,dirty}.json` (12) | `head-metrics.js` |
| `{width}-errors-{empty,dirty}.json` (8) | page error log per state |
| `{width}-refused-focus.txt` (4) | refused-focus probe |
| `coarse-pointer-targets.json` | coarse-pointer target measurements at 820×1180 and 1180×820 |
| `head-metrics.js` | the probe that writes the metrics above |

Per-width totals, for the record's claims: 9 visible Head controls, one row (44 px fine pointer, 60 px
coarse), `scrollWidth` equal to `clientWidth`, and zero page errors in every error log.
