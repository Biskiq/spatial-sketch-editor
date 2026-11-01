# R217.S21 browser evidence (archived)

Browser captures and measurements from the S21 acceptance runs at tested revision `edfab667`, preserved
byte-for-byte from the live tree by `git mv`. The live acceptance record links here for every capture.
Nothing in this folder is an authority: the [acceptance record](../../../../../roadmap/r217-core-editor-stability/r217.s21-index-and-card/acceptance.md)
owns the results, the review and the acceptance, and the [plan stub](../../../../../roadmap/r217-core-editor-stability/r217.s21-index-and-card/implementation-plan.md)
owns the recovery line for the approved plan.

## 2026-11-01-browser

Session: agent-browser, one task-owned session, dev server on `127.0.0.1:5273` (stopped at release). A wedged
matrix session was closed and the matrix re-run in a fresh session. Coarse-pointer runs used Chromium with
touch emulation (`pointer: coarse` matched). Widths: 1440×900, 1280×800, 1180×820, 820×1180.

### Captures (40 PNG)

| File | State |
| --- | --- |
| `wall-long-repeated-{width}.png` | Wall with a long name and repeated names, all four widths |
| `opening-{width}.png` | Opening (Door), all four widths |
| `object-sphere-{width}.png` | object (Sphere), all four widths |
| `native-form-{width}.png` | native form (Shape), all four widths |
| `index-actions-keyboard-{width}.png` | a row's Actions disclosure open, from the keyboard |
| `head-chip-index-away-{width}.png` | Head chip with the Index away |
| `coarse-before-fix-{state}-{1180x820,820x1180}.png` (8) | coarse pointer, before the explicit 44 px rules (`424b78e2`); states: wall, opening, object, form |
| `coarse-final-{state}-{1180x820,820x1180}.png` (8) | coarse pointer, after the fixes (`edfab667`); same states |

### Measurements and logs (26 JSON, 8 text, 1 script, 1 probe)

| File | Produced by |
| --- | --- |
| `{state}-{width}-metrics.json` (24) | `matrix-metrics.js`, one per state and width |
| `console-{width}.txt`, `page-errors-{width}.txt` (8) | console and page error logs per width, empty on the tested tree |
| `coarse-pointer-targets.json` | coarse-pointer target measurements after the fixes: 266 controls, 0 below 44 × 44 CSS px |
| `coarse-pointer-targets-before-fix.json` | the same measurement before the explicit rules (`424b78e2`): 266 controls, 0 below 44 × 44 |
| `coarse-pass.cjs` | the coarse-pointer probe that writes both JSON files |
| `matrix-metrics.js` | the metrics probe for the fine-pointer matrix |

Per-width totals, for the record's claims: no horizontal overflow (`scrollWidth` equal to `clientWidth`),
and zero console and page errors in every width's log. The "Wall, Opening, object, form" captures are
the states named in the acceptance record's browser matrix and coarse-pointer pass.
