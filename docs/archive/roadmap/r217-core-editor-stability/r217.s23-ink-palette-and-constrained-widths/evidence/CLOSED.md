# R217.S23 browser evidence (archived)

Browser captures and measurements from the S23 acceptance runs at tested revision `a7598a55`, preserved byte-for-byte from the live tree by `git mv`. The live acceptance record links here for every capture. Nothing in this folder is an authority: the [acceptance record](../../../../../roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/acceptance.md) owns the results, the review and the acceptance, and the [plan stub](../../../../../roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/implementation-plan.md) owns the recovery line for the approved plan.

Runs: a Vite dev server on `127.0.0.1:5173` and a scratch API on `localhost:8790`, both released after the runs, and the scratch database `biskiq_r217_s23`, dropped at the end. Browser passes ran in headed Chromium (Playwright 1.63, `headless: false`): fine pointer, and coarse pointer by touch emulation. Widths: 1440×900, 1280×800, 1180×820, 820×1180. Each state exists with the Height Sheet on the right (the default) and, with the suffix `-sheet-left`, on the left.

## 2026-11-01-browser

### Captures (160 PNG at the top level)

| Prefix (file name `<prefix>-<width>x<height>-<mode>[-sheet-left].png`) | State |
| --- | --- |
| `wall-line-live`, `wall-line-done` | a Wall Line drawn live, and after its Finish |
| `box-live`, `box-done` | a Box at its second corner, live, and once committed |
| `opening-options`, `opening-done` | an Opening with its options disclosure open, and once placed |
| `ink-open`, `ink-panel-open` | the Ink palette open, with its Wall and Opening readings |
| `index-open` | the constrained Index open as a sheet, with its scrim |
| `objects-full`, `objects-compact` | the Objects panel, full and compact |
| `folded-wall` | the enclosed-room starter with the palette open and folded (the room passes) |
| `final` | the state at the end of each run |

### Measurements, logs and summaries

| File | Produced by |
| --- | --- |
| `acceptance-{width}-{fine,coarse,room}[-sheet-left].json` (16) | one per run; the record's per-run JSON links |
| `summary.json` | the per-run analysis the record cites |
| `contrast.json` | the values sampled from the headed PNGs, which cross-check the token ratios in the record |

The browser logs one console error per run: the `/favicon.ico` 404 (TD-19 in the tech-debt ledger).
