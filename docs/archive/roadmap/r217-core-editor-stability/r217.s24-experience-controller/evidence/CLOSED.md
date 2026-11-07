# R217.S24 browser evidence (archived)

Browser captures, journals and comparisons from the S24 acceptance runs at tested revision `bc24b72c`, preserved byte-for-byte from the run output. The live acceptance record links here for every capture. Nothing in this folder is an authority: the [acceptance record](../acceptance.md) owns the results, the review and the acceptance, and the [plan stub](../implementation-plan.md) owns the recovery line for the approved plan.

Runs: two trees — **after** the branch at `bc24b72c`, and **before** `main` at `668eeb66` with only the lens fix's route hunk applied, because unpatched `main` freezes at the first lens switch. Vite dev servers on `127.0.0.1:5173` and `127.0.0.1:5175`, scratch API instances on `localhost:8790` and `localhost:8791` over one scratch database, both released after the runs and the database dropped. Browser passes ran in headed Chromium (Playwright 1.63, `headless: false`), signed in through the API test-auth seam, one browser per pass, closed in `finally`. Widths: 1440×900 and 1180×820.

## 2026-11-02-browser

### Captures (48 PNG)

Files are named `<tree>-<width>x<height>-<state>.png`, with `tree` one of `before` or `after`.

| State | State |
| --- | --- |
| `01-world` | the World lens after Save to Cloud |
| `02-experience-empty` | the Experience lens with no Experience |
| `03-create-experience` | Create Experience armed |
| `04-capture` | the captured View and its Presentation card |
| `05-first-guide` | the first Guide (`Entry`) |
| `06-stops` | three Stops, the Stop card, after Move up |
| `07-save-stop` | the Stop saved with a hold |
| `08-default-view` | the second Presentation rebound, Default View set |
| `09-preview` | the visitor Preview, entered |
| `10-preview-orbit` | the Preview after a drag orbit |
| `11-return` | back in the Experience lens |
| `12-world-return` | back in the World lens |

### Probe captures (3 PNG)

| File | State |
| --- | --- |
| `before-unpatched-in-experience.png` | unpatched `main` after choosing the Experience lens |
| `before-unpatched-after-world-click.png` | the same page after clicking World: still stuck |
| `before-patched-in-experience.png` | the same tree with the fix, after choosing the Experience lens |

### Journals, comparisons and probe records (10 JSON)

| File | Produced by |
| --- | --- |
| `before-1440x900-journal.json`, `after-1440x900-journal.json`, `before-1180x820-journal.json`, `after-1180x820-journal.json` | one per pass: steps, timings, page errors, console errors, measurements |
| `compare-before-vs-after-1440x900.json`, `compare-before-vs-after-1180x820.json` | the pixel comparison of every state, with counts, shares and bounding boxes |
| `compare-after-vs-after2-1440x900.json` | the run-to-run control: a second pass of the after tree at 1440×900 |
| `before-unpatched.json`, `before-patched.json` | the lens-crash probe: page errors, lens pressed and World dock after the click |

Every pass logs exactly one console error: the `/favicon.ico` 404 (TD-19 in the tech-debt ledger).
